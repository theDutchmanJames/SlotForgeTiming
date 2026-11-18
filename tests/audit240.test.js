// 2.4.0 audit: what the full review found, so it stays fixed. Race engine, Arduino race binding, automatic backups, Home figures.
const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('fs'),
  os = require('os'),
  path = require('path');
const { createRace, penaltyConfig, createHeatRace } = require('../renderer/engine.js');
const E = n => Array.from({ length: n }, (_, i) => ({ lane: i, driverId: 'd' + i, carId: 'c' + i, participant: i }));

test('a race by laps ends at its laps, even when the setup also keeps a time', () => {
  const r = createRace({ type: 'race', laps: 3, duration: 1, entries: E(1) });
  r.start(0);
  [20000, 40000, 70000].forEach(t => r.cross(0, t)); // (past the minute that is also in the setup)
  assert.equal(r.cars[0].laps.length, 3);
  assert.equal(r.cars[0].done, true);
  assert.equal(r.lapLimit, 3);
});

test('a timed race keeps going past the laps of the setup and ends on the first crossing after the time', () => {
  const r = createRace({ type: 'timed', laps: 3, duration: 1, entries: E(1) });
  r.start(0);
  [10000, 20000, 30000, 40000, 50000].forEach(t => r.cross(0, t));
  assert.equal(r.cars[0].done, false, 'five laps, still racing');
  r.cross(0, 61000);
  assert.equal(r.cars[0].done, true);
  assert.equal(r.lapLimit, 0, 'a timed race has no lap limit (the race strip and ON AIR show the laps driven)');
});

test('a disqualified car ranks behind a car that only retired, and takes no heat points from it', () => {
  const r = createRace({ type: 'race', laps: 10, entries: E(3), penalty: penaltyConfig({ dqPoints: 3 }) });
  r.start(0);
  for (let L = 1; L <= 6; L++) {
    r.cross(0, L * 5000);
    r.cross(1, L * 5000 + 100);
    if (L <= 2) r.cross(2, L * 5000 + 200);
  }
  r.addPoints(1, 3, 31000);
  r.cars[2].done = true;
  r.cars[2].retired = true;
  r.stop(40000);
  assert.deepEqual(
    r.standings().map(s => s.index),
    [0, 2, 1]
  );
  const H = createHeatRace({ participants: E(3), schedule: [E(3).map(e => ({ p: e.participant, lane: e.lane }))], resultBy: 'points', points: [10, 8, 6], lanes: 3 });
  const rows = H.record(r).rows;
  assert.equal(rows.find(x => x.participant === 2).points, 8);
});

test('a penalty given before a crash can still disqualify the car after the race is restored and resumed', () => {
  const pen = penaltyConfig({ dqUnserved: 'on', types: [{ name: 'SG', effect: 'pit', amount: 5 }] });
  const cfg = { type: 'race', laps: 3, entries: E(1), penalty: pen };
  const a = createRace(cfg);
  a.start(100000);
  a.cross(0, 110000);
  a.assign(0, 0, 115000);
  a.cross(0, 120000);
  const b = createRace(cfg);
  assert.equal(b.restore(a.snapshot(125000)), true);
  b.resume(2000); // (a new app session: its clock starts near zero)
  b.cross(0, 9000);
  assert.equal(b.cars[0].dq, true);
  assert.ok(!b.cars[0].pending.some(p => p.afterFinish));
});

test('a yellow flag raised during a pause starts when the race goes on', () => {
  const run = inPause => {
    const r = createRace({ type: 'race', laps: 50, entries: E(1), penalty: penaltyConfig({}), yellow: { target: 8000, points: 1 } });
    r.start(0);
    r.cross(0, 5000);
    r.pause(10000);
    if (inPause) r.setFlag('yellow', 300000);
    r.resume(301000);
    if (!inPause) r.setFlag('yellow', 301000);
    [306000, 311000, 316000].forEach(t => r.cross(0, t));
    return [r.yellowAt, JSON.stringify(r.cars[0].yellowFast), r.cars[0].points];
  };
  assert.deepEqual(run(true), run(false));
});

test('a car lifted off the pit sensor during a pause does not get the pause as pit time', () => {
  const fuel = { on: true, tank: 100, perLap: 10, rate: 10, empty: 'retire', pitHold: 2000 };
  const run = inPause => {
    const r = createRace({ type: 'race', laps: 50, entries: E(1), fuel });
    r.start(0);
    r.cross(0, 5000);
    r.block(0, 10000);
    r.tick(13000);
    r.pause(15000);
    if (inPause) r.unblock(0, 75000);
    r.resume(80000);
    if (!inPause) r.unblock(0, 80000);
    return r.cars[0].lastPit.duration;
  };
  assert.equal(run(true), 5000);
  assert.equal(run(false), 5000);
});

test('an adjustment during the race is logged at the moment it was given', () => {
  const r = createRace({ type: 'race', laps: 50, entries: E(1) });
  r.start(0);
  r.cross(0, 5000);
  assert.equal(r.adjust(0, { ms: 1000 }, 7000), true);
  assert.equal(r.events.filter(e => e.type === 'adjusted').at(-1).t, 7000);
});

test('the Arduino gives a reinstated car its lane power back, and tells a rebooted box everything again', () => {
  const B = require('../renderer/arduinobox.js'),
    AR = require('../renderer/arduinorace.js');
  const link = B.createLink({ now: () => 1000 }),
    sent = [];
  link.setConnected(true);
  link.setSender(b => sent.push(String.fromCharCode(...b).trim()));
  const cars = [{ lane: 0 }, { lane: 1 }, { lane: 2 }];
  const bound = AR.bind({ link, cars: () => cars, crossCar() {}, blockCar() {}, unblockCar() {}, actions: {}, trackcall() {}, phase: () => 'running', lights: () => 0, flag: () => '', setup: {}, keepalive: false });
  cars[1].dq = cars[1].retired = true;
  cars[2].retired = true;
  bound.sync();
  cars[1].dq = cars[1].retired = false; // (the Race Director takes the penalty point back)
  bound.sync();
  assert.ok(sent.includes('Q21'), 'lane 2 is powered again');
  sent.length = 0;
  link.feed(Buffer.from('[V 1.0.5 nano 8]\n'));
  assert.ok(sent.includes('Q30'), 'the retired lane 3 stays off after a reboot');
  assert.ok(sent.some(s => /^M/.test(s)), 'the track power is sent again');
  assert.ok(sent.some(s => /^L/.test(s)), 'the lights are sent again');
  bound.off();
});

test('two automatic backups in the same second keep each other', async () => {
  const A = require('../auto-backup.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-ab-'));
  const b = A.createAutoBackup({
    settings: () => ({ autoBackup: { on: true, folder: dir, keep: 5 } }),
    defaultFolder: dir,
    stateFile: path.join(dir, 's', 'state.json'),
    now: () => Date.parse('2026-11-18T10:00:00Z'),
    folderKind: () => true,
    make: async t => {
      fs.mkdirSync(t); // (exclusive, as the shared library backup is)
      fs.writeFileSync(path.join(t, 'x'), '1');
    }
  });
  const r1 = await b.run('manual'),
    r2 = await b.run('manual');
  assert.equal(r1.ok && r2.ok, true);
  assert.equal(A.own(dir).length, 2);
  assert.ok(fs.existsSync(r1.lastPath), 'the first one is still there');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('races per week count by the Monday of their own week (daylight saving and Monday midnight)', () => {
  global.window = global;
  require('../renderer/stats.js');
  const H = require('../renderer/homestats.js');
  const s = d => ({ sessionType: 'race', date: d.toISOString() });
  const now = new Date(2026, 10, 4, 12);
  assert.deepEqual(H.racesPerWeek([s(new Date(2026, 10, 2, 0, 0))], now, 3), [0, 0, 1], 'Monday 00:00 is this week');
  assert.deepEqual(H.racesPerWeek([s(new Date(2026, 10, 1, 23, 59))], now, 3), [0, 1, 0], 'Sunday night is last week');
  assert.deepEqual(H.racesPerWeek([s(new Date(2026, 9, 19, 0, 30))], now, 4), [0, 1, 0, 0], 'a week with a clock change counts once');
});
