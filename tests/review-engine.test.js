'use strict';
// 2.4.0 review: the race engine and the saved results. A retired car stays behind in a correction, a lap given counts towards the finish, the "leader
// finishes" rule waits for a car that can still pass, a retired or disqualified car does not cancel the random yellow flags, and a car reinstated after
// damage or a failure disqualified it is no longer "out".
const test = require('node:test'),
  assert = require('node:assert/strict');
const E = require('../renderer/engine.js');
const RB = require('../renderer/recordbook.js');
const Dm = require('../renderer/damage.js');
const Sc = require('../renderer/safetycar.js');
const ent = n => Array.from({ length: n }, (_, i) => ({ lane: i, driverName: 'D' + i, driverId: 'd' + i }));

test('a correction keeps a retired car behind every car still running, whatever its laps', () => {
  const st = [
    { pos: 1, driverName: 'Fin', laps: 25, total: 300000 },
    { pos: 2, driverName: 'Fin2', laps: 24, total: 301000 },
    { pos: 3, driverName: 'Ret', laps: 28, total: 250000, retired: true }
  ];
  assert.deepEqual(
    RB.correct(st, { 1: { ms: 1000 } }).map(x => x.driverName),
    ['Fin', 'Fin2', 'Ret']
  );
});

test('a lap given during the race counts towards the finish, and finishes the car when it completes the distance', () => {
  const r = E.createRace({ type: 'race', laps: 3, entries: ent(2) });
  r.start(0);
  r.cross(0, 1000);
  r.cross(0, 2000);
  r.adjust(0, { laps: 1 }, 2500);
  assert.equal(r.cars[0].done, true, 'two laps driven and one given: the three laps are done');
  assert.equal(r.lapsOf(r.cars[0]), 3);
  r.cross(0, 3000);
  assert.equal(r.lapsOf(r.cars[0]), 3, 'no fourth lap after the finish');
  const t = E.createRace({ type: 'race', laps: 3, entries: ent(2) });
  t.start(0);
  t.cross(0, 1000);
  t.adjust(0, { laps: -1 }, 1500);
  t.cross(0, 2000);
  t.cross(0, 3000);
  assert.equal(t.cars[0].done, false, 'a lap taken: the car drives one more');
  t.cross(0, 4000);
  assert.equal(t.cars[0].done, true);
});

test('"the leader finishes" waits while a car still racing can pass a leader penalised by a lap', () => {
  const P = E.penaltyConfig({ rules: [{ from: 1, laps: 1 }] });
  const r = E.createRace({ type: 'race', laps: 2, endRule: 'leader', entries: ent(2), penalty: P });
  r.start(0);
  r.cross(0, 1000);
  r.cross(1, 1100);
  r.addPoints(0, 1, 1200);
  r.cross(0, 2000);
  assert.equal(r.status, 'running', 'car 1 has as many scoring laps and is still racing');
  r.cross(1, 2100);
  assert.equal(r.status, 'finished');
  assert.equal(r.standings()[0].car.driverName, 'D1');
  const plain = E.createRace({ type: 'race', laps: 2, endRule: 'leader', entries: ent(2) });
  plain.start(0);
  plain.cross(0, 1000);
  plain.cross(1, 1100);
  plain.cross(0, 2000);
  assert.equal(plain.status, 'finished', 'without penalties the race ends when the leader finishes, as before');
});

test('a disqualified car does not cancel the planned random yellow flags', () => {
  const sc = Sc.clean({
    targetOn: 'off',
    rndOn: 'on',
    rndChance: 100,
    rndMode: 'range',
    rndMin: 3,
    rndMax: 3,
    rndLen: 5,
    rndFrom: 10,
    rndTo: 90,
    rndGap: 0
  });
  const P = E.penaltyConfig({ dqOn: 'on', dqPoints: 1 });
  let seed = 1;
  const r = E.createRace({
    type: 'timed',
    duration: 10,
    entries: ent(2),
    safetycar: sc,
    penalty: P,
    rnd: () => (seed = (seed * 16807) % 2147483647) / 2147483647
  });
  r.start(0);
  r.addPoints(0, 1, 1000);
  assert.equal(r.cars[0].dq, true);
  let flags = 0;
  for (let t = 2000; t < 600000; t += 1000) {
    r.tick(t);
    if (r.flag === 'yellow') {
      flags++;
      r.setFlag('yellow', t);
    }
    if (t % 10000 === 0) r.cross(1, t);
  }
  assert.equal(flags, 3);
});

test('a car reinstated after damage disqualified it is no longer out', () => {
  const dm = Dm.clean({ levels: [{ name: 'X', from: 2, seconds: 1, action: 'dq' }] }, 0);
  const r = E.createRace({ type: 'race', laps: 3, entries: ent(2), damage: dm, fuel: { on: false, pitHold: 500 } });
  r.start(0);
  r.cross(0, 1000);
  r.cross(1, 1100);
  r.addDamage(0, 2, 1200);
  r.block(0, 2000);
  r.tick(3600);
  r.unblock(0, 3700);
  assert.equal(r.cars[0].dmgOut, 'dq');
  r.stop(4000);
  r.setDq(0, false);
  assert.equal(r.cars[0].dq, false);
  assert.equal(r.cars[0].dmgOut, '', 'not "out by damage" in the result or the points');
});
