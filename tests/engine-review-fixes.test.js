// Review fixes: a mandatory-stop DQ is not undone by penalty points, heats by total time with uneven heat counts, a token stint is a fresh car,
// a failure keeps its rules when its level is gone, bad Arduino frames are dropped, fmtTime never prints "-0.000".
const E = require('../renderer/engine.js'), Tw = require('../renderer/tyrewear.js'), Fl = require('../renderer/failures.js'), AB = require('../renderer/arduinobox.js'), Heats = require('../renderer/heats.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };

// 1. the mandatory stops disqualify: penalty points do not bring the car back
{
  const ent = [0, 1].map(i => ({ lane: i, driverName: 'D' + i, driverId: 'd' + i, tyre: 'M' }));
  const R = E.createRace({ type: 'race', laps: 2, entries: ent, tyrewear: Tw.clean({ mandStops: 1, mandPenalty: 'dq' }, {}), penalty: E.penaltyConfig({ everyPoints: 5, everySeconds: 5, dqOn: 'off' }) });
  R.start(0); R.cross(0, 5000); R.cross(0, 10000);
  ok('a car that missed its mandatory stop is disqualified and marked as such', R.cars[0].dq === true && R.cars[0].msDq === true);
  R.addPoints(0, 1, 11000); R.addPoints(0, -1, 11500);
  ok('a penalty point given or taken back does not reinstate it', R.cars[0].dq === true && !R.events.some(e => e.type === 'reinstated'));
  const snap = R.snapshot(12000), R2 = E.createRace({ type: 'race', laps: 2, entries: ent, tyrewear: Tw.clean({ mandStops: 1, mandPenalty: 'dq' }, {}), penalty: E.penaltyConfig({ everyPoints: 5, everySeconds: 5, dqOn: 'off' }) });
  ok('the mark survives a snapshot and restore', R2.restore(snap) && R2.cars[0].msDq === true);
  const P = E.createRace({ type: 'race', laps: 5, entries: ent, penalty: E.penaltyConfig({ everyPoints: 5, everySeconds: 5, dqOn: 'on', dqPoints: 3 }) });
  P.start(0); P.cross(0, 5000); P.addPoints(0, 3, 6000);
  const dqd = P.cars[0].dq; P.addPoints(0, -1, 7000);
  ok('a disqualification by penalty points is still undone by taking a point back', dqd === true && P.cars[0].dq === false);
}

// 2. heats by total time with a driver who races more heats
{
  const parts = [0, 1, 2].map(i => ({ driverId: 'd' + i, driverName: 'D' + i })), pace = [1200, 1000, 1100];
  const run = (schedule, countBy) => {
    const H = E.createHeatRace({ participants: parts, schedule, lanes: 2, resultBy: 'time', countBy });
    while (H.hasNext()) { const ents = H.entries(), R = E.createRace({ type: 'race', laps: 3, entries: ents }); R.start(0); const t = ents.map(() => 0); for (let k = 0; k < 3; k++) ents.forEach((e, i) => { t[i] += pace[e.participant]; R.cross(i, t[i]); }); H.record(R); }
    return H.overall();
  };
  const uneven = [[{ p: 1, lane: 0 }, { p: 0, lane: 1 }], [{ p: 1, lane: 0 }, { p: 2, lane: 1 }]];
  const o = run(uneven, 'total');
  ok('uneven heats: the driver with more heats that count ranks first, the others by time', o.map(x => x.driverName).join() === 'D1,D2,D0' && o[0].heats === 2);
  const a = run(uneven, 'average');
  ok('average per heat: the fastest per heat wins', a.map(x => x.driverName).join() === 'D1,D2,D0' && a[0].timeScore === 3000);
  const even = [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }], [{ p: 1, lane: 0 }, { p: 2, lane: 1 }], [{ p: 2, lane: 0 }, { p: 0, lane: 1 }]];
  ok('equal heat counts: still the lowest total time first', run(even, 'total').map(x => x.driverName).join() === 'D1,D2,D0');
}
{
  const src = require('fs').readFileSync(require('path').join(__dirname, '../renderer/heats.js'), 'utf8');
  ok('the warning for uneven heats explains the time result', /adds the heat times up, and a driver with more heats that count ranks above those with fewer/.test(src));
}

// 3. a new token stint is a fresh car
{
  const R = E.createRace({ type: 'timed', duration: 60, entries: [{ lane: 0, driverName: 'A', driverId: 'a', tyre: 'M' }] });
  R.start(0); R.cross(0, 1000); R.cross(0, 2000);
  Object.assign(R.cars[0], { twLife: 40, twStops: 2, twTemp: 90, twTempAt: 1, swapLost: 500, swapLaps: [1], dmg: 7, dmgTotal: 7, dmgLvl: 1, dmgOut: 'retire', msDone: true, msDq: true });
  const same = R.cars[0]; R.restartCar(0, 3000, { driverName: 'B', driverId: 'b' });
  const c = R.cars[0];
  ok('restartCar keeps the car object and takes the new driver', c === same && c.driverName === 'B' && c.laps.length === 0 && c.started === false && c.last === 3000);
  ok('tyre wear, temperature, swaps, damage and the mandatory stops start again', c.twLife === 100 && c.twStops === 0 && c.twTemp === undefined && c.swapLost === 0 && c.swapLaps.length === 0 && c.dmg === 0 && c.dmgTotal === 0 && c.dmgLvl === -1 && c.dmgOut === '' && !c.msDone && !c.msDq && c.tyre === 'M');
}

// 4. a failure whose level is gone keeps the rules it was saved with
{
  const LV = [{ name: 'Light', urgent: false, within: 0, action: 'repair' }, { name: 'Critical', urgent: true, within: 1, action: 'retire' }];
  const saved = { name: 'Engine', level: 'Critical', chance: 2, seconds: 0, rules: Fl.rulesOf('Critical', LV) };
  ok('rulesOf gives the rules of a level, from raw or cleaned levels', JSON.stringify(saved.rules) === '{"urgent":true,"within":1,"action":"retire"}' && Fl.rulesOf('x', [{ name: 'X', urgency: 'asap', within: 2, action: 'dq' }]).urgent === true && Fl.rulesOf('nope', LV) === null);
  const c = Fl.clean({ on: true, list: [saved] }, [{ name: 'Critical damage', urgent: true, within: 1, action: 'repair' }]).list[0];
  ok('renamed level: the failure still retires the car, and says the level was not found', c.levelFound === false && c.rulesKept === true && c.action === 'retire' && c.urgent === true && c.within === 1);
  const old = Fl.clean({ on: true, list: [{ name: 'Old', level: 'Gone', chance: 1 }] }, LV).list[0];
  ok('without saved rules it still asks the least', old.action === 'repair' && !old.rulesKept);
  const none = Fl.clean({ on: true, list: [{ name: 'N', level: '', chance: 1, rules: saved.rules }] }, LV).list[0];
  ok('a failure set to no level does not use old saved rules', none.action === 'repair');
  ok('the form warns about a failure without its level', /Engine \(Critical\)/.test(Fl.lostText([saved], [{ name: 'Other' }])) && Fl.lostText([saved], LV) === '');
}

// 5. bad Arduino frames are dropped
{
  const L = AB.createLink({ now: () => 1000 }); L.setConnected(true); const ev = []; L.on(e => ev.push(e));
  L.feed(Buffer.from('[V 1.0.5 nano 8]200\n\r[B9 100][K12][B3][B2 x][P0+][P2][T9 50][K2][B1 50][P3+]A', 'latin1'));
  const hits = ev.filter(e => e.type === 'hit'), btn = ev.filter(e => e.type === 'button'), pit = ev.filter(e => e.type === 'pit');
  ok('bad B, K and P frames are dropped', hits.every(e => Number.isInteger(e.lane) && Number.isFinite(e.at)) && btn.length === 1 && btn[0].lane === 1 && pit.length === 1 && pit[0].pit === 2 && !ev.some(e => e.type === 'trap'));
  ok('good frames still come through', hits.length === 2 && hits[0].buffered && hits[0].lane === 0 && hits[0].at === 950);
}

// 6. fmtTime never prints a minus before zero
ok('fmtTime: -0.4 ms is 0.000; real negatives keep the minus', E.fmtTime(-0.4) === '0.000' && E.fmtTime(-0) === '0.000' && E.fmtTime(-1) === '-0.001' && E.fmtTime(-61000) === '-1:01.000' && E.fmtTime(1234) === '1.234');

if (fails) { console.log(fails + ' FAILED'); process.exit(1); }
console.log('PASS engine-review-fixes');
