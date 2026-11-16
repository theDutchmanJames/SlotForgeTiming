// Audit fixes (2.2.5) in the race engine: the finish, the order and the gaps when laps are lost to penalties, red flags over a pause,
// penalty stops that a finished car can no longer serve, the tyre temperature after a crash restore, and the saved result time.
const assert = require('assert/strict'), fs = require('fs'), path = require('path');
const E = require('../renderer/engine.js'), T = require('../renderer/tyrewear.js'), Temp = require('../renderer/tyretemperature.js');
let groups = 0; const test = (n, f) => { f(); groups++; console.log('ok   ' + n); };
const entries = n => Array.from({ length: n }, (_, i) => ({ lane: i, driverId: 'd' + i, carId: 'c' + i, driverName: 'D' + i }));

test('timed race: a crossing stamped before time-up is not the finish, even when the timer tick was read first', () => {
  const r = E.createRace({ type: 'timed', duration: 1, entries: entries(2) }); r.start(0);
  for (let k = 1; k <= 11; k++) { r.cross(0, k * 5000); r.cross(1, k * 5000 + 50); }
  r.tick(60005); r.cross(0, 59990);
  assert.equal(r.timeUp, true); assert.equal(r.cars[0].done, false);
  r.cross(0, 64990); assert.equal(r.cars[0].done, true);
  const same = E.createRace({ type: 'timed', duration: 1, entries: entries(2) }); same.start(0);
  for (let k = 1; k <= 11; k++) { same.cross(0, k * 5000); same.cross(1, k * 5000 + 50); }
  same.cross(0, 59990); assert.equal(same.cars[0].done, false); // (the same crossing read in order: the same answer)
});
test('timed race: a crossing stamped after time-up is the finish, even before the timer tick noticed', () => {
  const r = E.createRace({ type: 'timed', duration: 1, entries: entries(2) }); r.start(0);
  for (let k = 1; k <= 11; k++) r.cross(0, k * 5000);
  r.cross(0, 60010); assert.equal(r.cars[0].done, true); assert.equal(r.timeUp, true);
});

const lapPen = E.penaltyConfig({ types: [{ name: 'LapPen', effect: 'laps', amount: 2, points: 0 }] });
test('"lead car finished": a car that took the flag first but lost two laps does not end the race or win it', () => {
  const r = E.createRace({ type: 'race', laps: 5, endRule: 'leader', entries: entries(2), penalty: lapPen }); r.start(0);
  r.assign(0, 0, 1000);
  for (let k = 1; k <= 5; k++) { r.cross(0, k * 5000); if (k < 5) r.cross(1, k * 5000 + 100); }
  assert.equal(r.cars[0].done, true); assert.equal(r.status, 'running'); // (car 1 has 4 scoring laps, car 0 has 3: car 1 leads and has not finished)
  assert.deepEqual(r.standings().map(x => x.index), [1, 0]);
  r.cross(1, 25100); assert.equal(r.status, 'finished'); assert.deepEqual(r.standings().map(x => x.index), [1, 0]);
});
test('...the same race with "all cars finish" gives the same order, and a race without penalties ends as before', () => {
  const r = E.createRace({ type: 'race', laps: 5, endRule: 'all', entries: entries(2), penalty: lapPen }); r.start(0); r.assign(0, 0, 1000);
  for (let k = 1; k <= 5; k++) { r.cross(0, k * 5000); r.cross(1, k * 5000 + 100); }
  assert.deepEqual(r.standings().map(x => x.index), [1, 0]);
  const plain = E.createRace({ type: 'race', laps: 3, endRule: 'leader', entries: entries(2) }); plain.start(0);
  for (let k = 1; k <= 3; k++) { plain.cross(0, k * 5000); if (k < 3) plain.cross(1, k * 5000 + 100); }
  assert.equal(plain.status, 'finished'); assert.deepEqual(plain.standings().map(x => x.index), [0, 1]);
});
test('a finished car ranks ahead of a running car with the same scoring laps, and behind one with more', () => {
  const r = E.createRace({ type: 'race', laps: 3, endRule: 'all', entries: entries(3), penalty: lapPen }); r.start(0);
  r.assign(0, 0, 500);
  for (let k = 1; k <= 3; k++) { r.cross(0, k * 5000); r.cross(1, k * 5000 + 100); if (k < 3) r.cross(2, k * 5000 + 200); }
  // car 0: 3 raw, 1 scoring, done; car 1: 3, done; car 2: 2 laps, running
  assert.deepEqual(r.standings().map(x => x.index), [1, 2, 0]);
});

test('gaps compare the laps that count: a car that lost laps to penalties is shown behind, not level', () => {
  const r = E.createRace({ type: 'race', laps: 50, endRule: 'all', entries: entries(2), penalty: lapPen }); r.start(0);
  for (let k = 1; k <= 4; k++) { r.cross(0, k * 5000); r.cross(1, k * 5000 + 100); }
  r.assign(1, 0, 20500); // car 1 loses two laps
  const st = r.standings(), row = st.find(x => x.index === 1);
  assert.equal(st[0].index, 0); assert.equal(row.gap, '+' + E.fmtTime(10100)); // (car 1 has 2 scoring laps after 20.1 s; car 0 had 2 laps after 10 s)
  const g = r.gapInfo()[1]; assert.equal(g.lead, 10100); assert.equal(g.down, 2);
});
test('gaps without penalties are unchanged', () => {
  const r = E.createRace({ type: 'race', laps: 50, entries: entries(2) }); r.start(0);
  for (let k = 1; k <= 4; k++) { r.cross(0, k * 5000); r.cross(1, k * 5100); }
  assert.equal(r.standings()[1].gap, '+' + E.fmtTime(400)); const g = r.gapInfo()[1]; assert.equal(g.lead, 400); assert.equal(g.down, 0);
  r.cross(0, 25000); assert.equal(r.standings()[1].gap, '+' + E.fmtTime(400)); // (a lapped car is compared at its own lap count)
});

test('a red flag raised while the race is already paused still invalidates the interrupted laps and adds its result time', () => {
  const r = E.createRace({ type: 'race', laps: 50, entries: entries(2), redFlagSeconds: 10 }); r.start(0);
  r.cross(0, 5000); r.cross(1, 5100);
  r.pause(6000); r.setFlag('red', 7000);
  assert.equal(r.flag, 'red'); assert.equal(r.status, 'paused');
  assert.equal(r.events.filter(e => e.type === 'redlap').length, 2); assert.deepEqual(r.cars.map(c => c.extraMs), [10000, 10000]);
  r.setFlag('red', 20000); assert.equal(r.status, 'running'); r.cross(0, 24000);
  assert.deepEqual(r.cars[0].invalid, [1]); assert.deepEqual(r.cars[0].redLaps, [1]);
  const direct = E.createRace({ type: 'race', laps: 50, entries: entries(2), redFlagSeconds: 10 }); direct.start(0); direct.cross(0, 5000); direct.cross(1, 5100); direct.setFlag('red', 7000);
  assert.deepEqual(direct.cars.map(c => c.extraMs), r.cars.map(c => c.extraMs)); // (the same as a red flag while running)
});

const ladder = E.penaltyConfig({ dqUnserved: 'on', rules: [{ from: 2, time: 0, laps: 0, pit: 5 }] });
test('a penalty stop given after a car took the flag does not disqualify it at the end; it stays for the review', () => {
  const r = E.createRace({ type: 'race', laps: 3, endRule: 'all', entries: entries(2), penalty: ladder }); r.start(0);
  r.addPoints(0, 1, 500);
  for (let k = 1; k <= 3; k++) r.cross(0, k * 5000);
  assert.equal(r.cars[0].done, true);
  r.addPoints(0, 1, 15500);
  assert.equal(r.cars[0].pending.length, 1); assert.equal(r.cars[0].pending[0].afterFinish, true);
  for (let k = 1; k <= 3; k++) r.cross(1, k * 6000);
  assert.equal(r.status, 'finished'); assert.equal(!!r.cars[0].dq, false); assert.equal(r.cars[0].pending.length, 1);
});
test('...a stop given before the finish and not served still disqualifies, as the rule says', () => {
  const r = E.createRace({ type: 'race', laps: 3, endRule: 'all', entries: entries(2), penalty: ladder }); r.start(0);
  r.addPoints(0, 2, 500);
  for (let k = 1; k <= 3; k++) { r.cross(0, k * 5000); r.cross(1, k * 6000); }
  assert.equal(r.status, 'finished'); assert.equal(r.cars[0].dq, true); assert.equal(!!r.cars[1].dq, false);
});
test('...a stop given by a point on the finishing lap itself cannot be served either', () => {
  const r = E.createRace({ type: 'race', laps: 3, endRule: 'all', entries: entries(2), penalty: ladder }); r.start(0);
  r.addPoints(0, 1, 500);
  for (let k = 1; k <= 2; k++) r.cross(0, k * 5000);
  // a point given at the very moment of the finishing crossing (as the yellow-flag and fuel rules do inside the crossing)
  r.addPoints(0, 1, 15000); r.cross(0, 15000);
  assert.equal(r.cars[0].done, true); assert.equal(r.cars[0].pending[0].afterFinish, true);
  for (let k = 1; k <= 3; k++) r.cross(1, k * 6000);
  assert.equal(!!r.cars[0].dq, false);
});

const twoTiers = E.penaltyConfig({ dqUnserved: 'on', rules: [{ from: 2, time: 0, laps: 0, pit: 5 }, { from: 4, time: 0, laps: 0, pit: 10 }] });
test('a higher penalty tier given after the flag does not wipe out a stop that was due before it: the car is still disqualified', () => {
  const a = E.createRace({ type: 'race', laps: 3, endRule: 'all', entries: entries(2), penalty: twoTiers }); a.start(0);
  a.addPoints(0, 2, 500); a.cross(0, 5000); a.cross(1, 5100); a.cross(0, 10000); a.cross(1, 10100);
  a.addPoints(0, 2, 15000); a.cross(0, 15000); a.cross(1, 15100);
  assert.equal(a.status, 'finished'); assert.equal(a.cars[0].dq, true);
  const b = E.createRace({ type: 'race', laps: 3, endRule: 'all', entries: entries(2), penalty: twoTiers }); b.start(0);
  b.addPoints(0, 2, 500); for (let k = 1; k <= 3; k++) b.cross(0, k * 5000);
  b.addPoints(0, 2, 16000); for (let k = 1; k <= 3; k++) b.cross(1, k * 5100);
  assert.equal(b.cars[0].dq, true); assert.equal(b.cars[0].pending[0].since, 500);
});
test('a stop given at the moment of a finishing crossing that is read a little later is beyond reach too', () => {
  const sg = E.penaltyConfig({ dqUnserved: 'on', types: [{ name: 'SG', effect: 'pit', amount: 5, points: 0 }] });
  const r = E.createRace({ type: 'race', laps: 3, endRule: 'all', entries: entries(2), penalty: sg }); r.start(0);
  for (let k = 1; k <= 2; k++) { r.cross(0, k * 5000); r.cross(1, k * 5100); }
  r.assign(0, 0, 15010); r.cross(0, 15005); r.cross(1, 15300);
  assert.equal(r.status, 'finished'); assert.equal(!!r.cars[0].dq, false); assert.equal(r.cars[0].pending[0].afterFinish, true);
});
test('results show time added without a penalty system as added time, not as a penalty with empty points', () => {
  for (const f of ['report.js', 'database.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'renderer', f), 'utf8');
    assert.ok(src.includes("x.penaltyPoints != null ?") && src.includes('added time)'), f);
  }
});
test('after a crash restore in a new app session the tyre temperature cools in the pits again', () => {
  const base = { tempOn: 'on', paceWear: 'off', effect: 'off', setsMode: 'none', changeSeconds: 600, tyres: { M: { wear: 2 } }, temperature: { tyres: { M: { ...Temp.DEFAULT } } } };
  const cfg = () => ({ type: 'race', laps: 1000, entries: [{ lane: 0, tyre: 'M', driverId: 'd', carId: 'c', driverName: 'A' }], fuel: { on: true, tank: 10000, perLap: 0.1, rate: 10, pitHold: 1000 }, tyrewear: T.clean(base) });
  const a = E.createRace(cfg()); a.start(0); a.cars[0].twTemp = 90; a.tick(500000); a.block(0, 501000, true); a.tick(531000); // (the same race without the crash: 1 s on track, then 30 s in the pits)
  const b = E.createRace(cfg()); b.start(0); b.cars[0].twTemp = 90; b.tick(500000);
  const n = E.createRace(cfg()); assert.equal(n.restore(b.snapshot(500000)), true); n.resume(2000);
  assert.equal(n.cars[0].twTemp, 90); // (the offline time is not simulated)
  n.block(0, 3000, true); n.tick(33000);
  assert.ok(n.cars[0].twTemp < 90); assert.equal(n.cars[0].twTemp.toFixed(2), a.cars[0].twTemp.toFixed(2));
});

test('a single race saves the time the race added (red-flag result time) also without a penalty system', () => {
  const race = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'race.js'), 'utf8');
  assert.ok(/\(penCfg\.on\|\|rulePlan\) \? \{ penaltyPoints[^}]*\} : eng\.penMs\(x\.car\) \? \{ penalty: eng\.penMs\(x\.car\) \} : \{\}/.test(race));
  const r = E.createRace({ type: 'race', laps: 50, entries: entries(1), redFlagSeconds: 7 }); r.start(0); r.cross(0, 5000); r.setFlag('red', 6000);
  assert.equal(r.penMs(r.cars[0]), 7000); // (what is saved: penMs, which the review and the order use too)
});

console.log(`ENGINE AUDIT TESTS PASSED (${groups} groups)`);
