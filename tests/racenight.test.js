'use strict';
// Phase 2 (race night, 2.3.0): the sensor test, the virtual DS box, the DS choice of what a pause does with laps that are driven during it,
// timing hardware that is found when it is plugged in, and the setup guide of a fresh install.
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const ST = require('../renderer/sensortest.js'),
  DsSim = require('../renderer/dssim.js'),
  P = require('../renderer/dsprotocol.js'),
  DS = require('../renderer/dstiming.js'),
  E = require('../renderer/engine.js'),
  HD = require('../renderer/hwdetect.js'),
  WZ = require('../renderer/setupwizard.js'),
  SCHEMA = require('../schema.js');

// ---- the sensor test ----
test('the sensor test counts crossings per lane, ignores a bouncing sensor, and names the lanes that saw no car', () => {
  const T = ST.createTally(4);
  assert.equal(ST.summary(T).text, 'No lane has seen a car yet. Drive a car over the line in every lane.');
  ST.hit(T, 0, 1000);
  ST.hit(T, 0, 1100); // (a bounce: 100 ms later)
  ST.hit(T, 0, 6200);
  ST.hit(T, 2, 1500);
  assert.deepEqual(T.hits, [2, 0, 1, 0]);
  assert.equal(T.lap[0], 5200, 'the lap time is from the first crossing, not the bounce');
  assert.deepEqual(ST.summary(T), { ok: false, text: 'Lanes 2 and 4 have not seen a car yet.' });
  ST.hit(T, 1, 2000);
  assert.equal(ST.summary(T).text, 'Lane 4 has not seen a car yet.');
  ST.hit(T, 3, 2500);
  ST.hit(T, 5, 2600); // (a sensor of a lane that this race does not have)
  const s = ST.summary(T);
  assert.equal(s.ok, true);
  assert.match(s.text, /Every lane has seen a car\..*lane 6, which this race does not have/);
});

test('a lap time the hardware measured itself (DS) is used as it is', () => {
  const T = ST.createTally(2);
  ST.hit(T, 1, 500, undefined);
  ST.hit(T, 1, 520, 5432.1); // (a DS frame can arrive right after the previous one: its own measured time counts)
  assert.equal(T.hits[1], 2);
  assert.equal(T.lap[1], 5432.1);
});

test('every timing interface reports a crossing in the same shape: lane from 0', () => {
  const link = () => {
    const fs = new Set();
    return { connected: true, on: f => (fs.add(f), () => fs.delete(f)), emit: e => fs.forEach(f => f(e)), count: () => fs.size };
  };
  const g = { Trackmate: { link: link(), laneMap: m => m || [0, 1] }, ArduinoBox: { link: link() }, DsTiming: { link: link() } };
  const seen = [];
  const offT = ST.source('trackmate', { tmLaneMap: [1, 0] }, g).listen((lane, at) => seen.push(['tm', lane, at]));
  g.Trackmate.link.emit({ type: 'hit', lane: 0, at: 10 });
  g.Trackmate.link.emit({ type: 'block', lane: 0, at: 11 }); // (not a crossing)
  const offA = ST.source('arduino', {}, g).listen((lane, at) => seen.push(['ab', lane, at]));
  g.ArduinoBox.link.emit({ type: 'hit', lane: 2, at: 20 });
  const offD = ST.source('ds', {}, g).listen((lane, at, ms) => seen.push(['ds', lane, at, ms]));
  g.DsTiming.link.emit({ kind: 'lap', lane: 3, at: 30, timeTicks: 51230 });
  g.DsTiming.link.emit({ kind: 'control', action: 'pause', at: 31 });
  assert.deepEqual(seen, [
    ['tm', 1, 10],
    ['ab', 2, 20],
    ['ds', 2, 30, 5123]
  ]);
  [offT, offA, offD].forEach(f => f());
  assert.equal(g.Trackmate.link.count() + g.ArduinoBox.link.count() + g.DsTiming.link.count(), 0, 'closing stops listening');
  assert.equal(ST.source('none', {}, g), null, 'no hardware: nothing to test');
});

// ---- the virtual DS box ----
test('the virtual DS box sends frames the DS decoder accepts: a marker per lane, then laps counted 1, 2, 3 with their times', () => {
  for (const model of ['ds200', 'ds300']) {
    const sim = DsSim.createSim({ model, lanes: model === 'ds200' ? 2 : 6, random: () => 0.5 }),
      fs = new P.FrameStream(model),
      ev = [];
    sim.onData(b => ev.push(...fs.push(b)));
    sim.start(0);
    for (let t = 0; t <= 40000; t += 20) sim.tick(t);
    assert.equal(fs.rejectedCandidates, 0, model);
    const lanes = model === 'ds200' ? 2 : 6;
    for (let lane = 1; lane <= lanes; lane++) {
      const mine = ev.filter(e => e.lane === lane);
      assert.equal(mine[0].kind, 'first-crossing-marker', model + ' lane ' + lane);
      assert.deepEqual(
        mine.slice(1, 4).map(e => e.counter),
        [1, 2, 3]
      );
      assert(
        mine.slice(1).every(e => e.kind === 'lap' && e.timeTicks > 40000 && e.timeTicks < 70000),
        'lap times between 4 and 7 s'
      );
    }
  }
});

// ---- DS: keep the laps of a pause ----
function packet(lane, n, ticks) {
  return DsSim.frame({ model: 'ds300', seq: n, lane, counter: n, ms: ticks / 10 });
}
function rig(counts) {
  let at = 0;
  const r = E.createRace({ type: 'race', laps: 30, entries: [{ lane: 0 }, { lane: 1 }] });
  const link = DS.createLink({ now: () => at }),
    ignored = [],
    held = [];
  link.setConnected(true, 'ds300');
  const b = DS.bind({
    link,
    engine: () => r,
    phase: () => r.status,
    lanes: 2,
    crossCar: (i, t, _held, o) => r.cross(i, t === undefined ? at : t, o),
    onFault: () => {},
    onIgnored: l => ignored.push(l),
    pauseCounts: () => counts,
    onHeld: l => held.push(l)
  });
  return {
    r,
    b,
    ignored,
    held,
    send(t, lane, n, ticks) {
      at = t;
      link.feed(packet(lane, n, ticks));
    },
    start() {
      r.start(0);
      b.sync();
    },
    pause(t) {
      at = t;
      r.pause(t);
      b.sync();
    },
    resume(t) {
      at = t;
      r.resume(t);
      return b.flushHeld();
    }
  };
}

test('DS, "keep those laps": laps driven during a pause are added on resume with the times the box measured', () => {
  const h = rig(true);
  h.start();
  h.send(100, 1, 1, 50000);
  h.send(5100, 1, 2, 50000);
  h.pause(6000);
  h.send(10100, 1, 3, 50000);
  h.send(15100, 1, 4, 50000);
  assert.deepEqual(h.held, [1, 1]);
  assert.equal(h.r.cars[0].laps.length, 1, 'not yet: Timing is paused');
  assert.equal(h.resume(16000), 2, 'added on resume');
  const c = h.r.cars[0];
  assert.equal(c.laps.length, 3);
  assert.deepEqual(c.laps.slice(1).map(Math.round), [5000, 5000], 'the box measured them');
  assert.deepEqual(c.resumedLaps || [], [], 'a lap the box timed is not "the first lap after a pause"');
  h.send(20100, 1, 5, 50000);
  assert.equal(Math.round(c.laps[3]), 5000, 'the next lap carries on with the box time, not the time since the resume');
  assert.equal(h.b.held(), 0);
});

test('DS, "do not count" (the standard): crossings during a pause are reported, not added', () => {
  const h = rig(false);
  h.start();
  h.send(100, 1, 1, 50000);
  h.pause(2000);
  h.send(5100, 1, 2, 50000);
  assert.deepEqual(h.ignored, [1]);
  assert.equal(h.resume(6000), 0);
  assert.equal(h.r.cars[0].laps.length, 0);
});

// ---- hardware found when it is plugged in ----
test('a plugged-in USB device: the remembered one connects, another remembered one is offered, a new one is asked about', () => {
  const ch340 = { usbVendorId: 0x1a86, usbProductId: 0x7523 },
    ftdi = { usbVendorId: 0x0403, usbProductId: 0x6001 };
  const S = { tmDevice: { vid: 0x0403, pid: 0x6001 } };
  assert.deepEqual(HD.decide(S, ftdi, { chosen: 'trackmate', open: false }), { action: 'connect', hw: 'trackmate' });
  assert.deepEqual(HD.decide(S, ftdi, { chosen: 'trackmate', open: true }), { action: 'none' }, 'already connected');
  assert.deepEqual(HD.decide(S, ftdi, { chosen: 'trackmate', racing: true }), { action: 'none' }, 'never in the middle of a race');
  assert.deepEqual(HD.decide(S, ftdi, { chosen: 'ds', open: false }), { action: 'switch', hw: 'trackmate' });
  assert.deepEqual(HD.decide(S, ftdi, { chosen: 'ds', open: true }), { action: 'none' }, 'the hardware in use works: no question');
  assert.deepEqual(HD.decide(S, ch340, { chosen: 'ds' }), { action: 'ask', hw: null });
  assert.deepEqual(
    HD.decide(S, { usbVendorId: 0x2341, usbProductId: 0x43 }, { chosen: 'ds' }),
    { action: 'ask', hw: 'arduino' },
    'an Arduino says so'
  );
  assert.deepEqual(
    HD.decide({ hwIgnored: ['1A86:7523'] }, ch340, { chosen: 'ds' }),
    { action: 'none' },
    '"not timing hardware" is remembered'
  );
  assert.deepEqual(HD.decide(S, {}, { chosen: 'ds' }), { action: 'none' }, 'a COM port without USB numbers cannot be told apart');
  assert.deepEqual(HD.decide(S, { ...ch340, virtual: true }, { chosen: 'ds' }), { action: 'none' }, 'nor the virtual boxes');
});

test('the Home card asks what a new device is, or offers the remembered one for races', () => {
  const ask = HD.homeHtml([{ key: '1A86:7523', info: { usbVendorId: 0x1a86, usbProductId: 0x7523 }, action: 'ask', hw: null }]);
  assert.match(ask, /A USB device was plugged in: CH340 USB serial \(1A86:7523\)/);
  ['data-detect-use="trackmate"', 'data-detect-use="arduino"', 'data-detect-use="ds"', 'data-detect-later', 'data-detect-ignore'].forEach(
    x => assert(ask.includes(x), x)
  );
  const sw = HD.homeHtml([{ key: '0403:6001', info: { usbVendorId: 0x0403, usbProductId: 0x6001 }, action: 'switch', hw: 'trackmate' }]);
  assert.match(sw, /Trackmate Interface is plugged in/); // (2.4.0: "The Trackmate is here", with why it asks)
  assert(sw.includes('Use Trackmate Interface for races'));
});

// ---- the setup guide ----
test('the setup guide shows for a fresh install until it is finished or skipped, and comes back to the step it was at', () => {
  assert.equal(WZ.shouldShow({}, { setups: 0 }), true, 'a fresh install');
  assert.equal(WZ.shouldShow({}, { setups: 2 }), false, 'someone who already races');
  assert.equal(WZ.shouldShow({ setupGuide: 'skipped' }, { setups: 0 }), false);
  assert.equal(WZ.shouldShow({ setupGuide: 'done' }, { setups: 0 }), false);
  assert.equal(WZ.shouldShow({ setupGuide: { step: 3 } }, { setups: 5 }), true, 'started again from App Settings');
  assert.deepEqual(WZ.progressOf({ setupGuide: { step: 4, trackId: 't', driverIds: ['a', '', 7], carIds: ['c'] } }), {
    step: 4,
    trackId: 't',
    driverIds: ['a'],
    carIds: ['c']
  });
  assert.equal(WZ.progressOf({ setupGuide: { step: 99 } }).step, WZ.STEPS.length - 1);
});

test('the test race is a 3-lap race on the track, with every other setting as a new race setup starts', () => {
  const r = WZ.setupRecord(SCHEMA, 't1');
  assert.equal(r.name, 'Test race (3 laps)');
  assert.equal(r.sessionType, 'race');
  assert.equal(r.raceBy, 'laps');
  assert.equal(r.laps, 3);
  assert.equal(r.track, 't1');
  const withDefault = SCHEMA.racesetups.fields.filter(
    f => f.key && f.default !== undefined && !['name', 'sessionType', 'raceBy', 'laps', 'track'].includes(f.key)
  );
  assert(withDefault.length > 10);
  withDefault.forEach(f => assert.deepEqual(r[f.key], f.default, f.key));
});

test('the guide puts the drivers on their lanes in order, with their cars, and never adds a name twice', () => {
  assert.deepEqual(WZ.assignmentRows(4, ['a', 'b'], ['x']), [
    { driverId: 'a', carId: 'x' },
    { driverId: 'b', carId: '' }
  ]);
  assert.deepEqual(WZ.assignmentRows(2, ['a', 'b', 'c'], []).length, 2, 'more drivers than lanes: the first ones race');
  assert.deepEqual(WZ.namesOf([' Anna ', '', 'anna', 'Bjorn']), ['Anna', 'Bjorn']);
});

// ---- DS lap times that do not fit Timing's arrival moments (2.3.1) ----
const Mapper = require('../paddock-rich-mapper.js'),
  { s: dsBase, L: dsRows } = require('./fixtures/rich-mapper-rounding/keyboard-race.json');
const dsDb = Object.values(dsBase.paddockJournal.captures)[0].configuration.databaseId;
function dsRace(edit) {
  const s = structuredClone(dsBase),
    rows = structuredClone(dsRows),
    e = s.paddockJournal.heats[0].entries[0];
  e.laps.forEach(l => (l.measured = true));
  edit(e, n => rows.find(r => r.carId === e.carId && r.lapNumber === n));
  return { s, rows };
}
test('DS: a measured lap a little longer than the gap between two arrivals is accepted, with its time untouched and a note', () => {
  const { s, rows } = dsRace((e, row) => {
    e.laps[3].time += 25; // (the serial line delivered the crossing 25 ms early, relative to the one before)
    row(4).time = e.laps[3].time;
  });
  const { bundle } = Mapper.measured(s, rows, dsDb),
    p = bundle.race.participants.find(x => x.laps.some(l => l.number === 4));
  assert.equal(p.laps.find(l => l.number === 4).durationMs, s.paddockJournal.heats[0].entries[0].laps[3].time, 'the measured time is kept');
  let prior = null;
  for (const l of p.laps) {
    if (prior !== null) assert(l.endedAtMs - l.durationMs >= prior);
    prior = l.endedAtMs;
  }
  assert(/moved forward to fit the lap times measured/.test(bundle.context.notes), 'the race says so');
});
test('DS: laps kept during a pause, all added at the resume, are accepted in order', () => {
  const { s, rows } = dsRace(e => {
    const at = e.laps[5].at;
    e.laps[3].at = at;
    e.laps[4].at = at; // (laps 4, 5 and 6 arrive together when the race resumes)
  });
  const { bundle } = Mapper.measured(s, rows, dsDb),
    laps = bundle.race.participants.flatMap(p => p.laps).filter(l => l.lane === s.paddockJournal.heats[0].entries[0].lane);
  assert.deepEqual(
    laps.map(l => l.number),
    [...laps.map(l => l.number)].sort((a, b) => a - b)
  );
  const duration = Date.parse(bundle.race.endedAt) - Date.parse(bundle.race.startedAt);
  assert(
    laps.every(l => l.endedAtMs <= duration),
    'the session still covers its last crossing'
  );
});
test('DS: a mismatch of more than 15 minutes is no clock difference and stays refused; Timing-timed laps keep the 1 ms rule', () => {
  const { s, rows } = dsRace((e, row) => {
    e.laps[3].time += 16 * 60e3;
    row(4).time = e.laps[3].time;
  });
  assert.throws(() => Mapper.measured(s, rows, dsDb), /overlap or are incomplete/);
});
test('the race journal marks the laps whose time the hardware measured', () => {
  const PR = require('../renderer/paddockrace.js'),
    E = require('../renderer/engine.js');
  const r = E.createRace({ type: 'race', laps: 10, entries: [{ lane: 0, carId: 'c', driverId: 'd' }] }),
    journal = { heats: [] };
  PR.attach(
    r,
    journal,
    1,
    () => 0,
    t => t
  );
  r.start(0);
  r.cross(0, 100);
  r.cross(0, 5100);
  r.cross(0, 10150, { measuredMs: 5020 });
  const laps = r.paddockReview().entries[0].laps;
  assert.equal(laps[0].measured, undefined, 'a lap of Timing’s own clock');
  assert.equal(laps[1].measured, true);
});
// ---- (2.4.0) a DS race from before 2.3.1: its journal does not say which laps the box measured ----
test('a journal from before the marks (a DS race of then) is accepted, with the note; a journal with marks keeps the strict rule', () => {
  const old = () => {
    const s = structuredClone(dsBase),
      rows = structuredClone(dsRows),
      e = s.paddockJournal.heats[0].entries[0];
    e.laps.forEach(l => delete l.measured); // (no lap says the box measured it)
    e.laps[3].time += 25;
    rows.find(r => r.carId === e.carId && r.lapNumber === 4).time = e.laps[3].time;
    return { s, rows };
  };
  const a = old();
  delete a.s.paddockJournal.marks;
  const { bundle } = Mapper.measured(a.s, a.rows, dsDb);
  assert(/moved forward to fit the lap times measured/.test(bundle.context.notes));
  const b = old();
  b.s.paddockJournal.marks = 1;
  assert.throws(
    () => Mapper.measured(b.s, b.rows, dsDb),
    /overlap or are incomplete/,
    'a lap of Timing’s own clock that overlaps is a real contradiction'
  );
});
test('a new race journal carries the marks; a journal that has heats already is left as it is', () => {
  const PR = require('../renderer/paddockrace.js'),
    E = require('../renderer/engine.js');
  const mk = () => E.createRace({ type: 'race', laps: 10, entries: [{ lane: 0, carId: 'c', driverId: 'd' }] });
  const fresh = { heats: [] };
  PR.attach(
    mk(),
    fresh,
    1,
    () => 0,
    t => t
  );
  assert.equal(fresh.marks, 1);
  const older = { heats: [{ id: 1, name: 'Heat 1', startedAt: 0, endedAt: null, entries: [], crossings: {} }] };
  PR.attach(
    mk(),
    older,
    1,
    () => 0,
    t => t
  );
  assert.equal(older.marks, undefined, 'a race resumed after the update keeps what its journal could say');
});
