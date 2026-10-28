const assert = require('assert/strict'), E = require('../renderer/engine'), P = require('../renderer/pithold'), T = require('../renderer/tyrewear'), D = require('../renderer/damage');
let groups = 0;
const test = (name, fn) => { fn(); groups++; console.log('ok   ' + name); };
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
const mk = (mode = 'manual', extra = {}) => { const r = E.createRace({ type: 'race', laps: 50, entries: [{ lane: 0, driverName: 'A', tyre: 'S' }, { lane: 1, driverName: 'B', tyre: 'M' }], fuel: { on: true, tank: 100, perLap: 2, rate: 1, pitHold: 2000 }, pitControl: { mode, seconds: 30, waitReturn: true }, ...extra }); r.start(1000); return r; };
const pit = (r, on = true) => { if (on !== null) r.pitSensor(0, on, 10000); r.block(0, 10000); r.tick(12000); };
const due = 42000;

test('legacy setups and token sessions keep Follow sensor; invalid settings are bounded', () => {
  assert.deepEqual(P.raceConfig({}), {}); assert.deepEqual(P.raceConfig({ sessionType: 'tokens', serviceStop: 'on', pitHoldMode: 'auto' }), {});
  assert.equal(P.clean({ seconds: -1 }).seconds, 30); assert.equal(P.clean({ seconds: 1e9 }).seconds, 86400);
  assert.equal(P.raceConfig({ serviceStop: 'on', pitHoldMode: 'auto', pitHoldReturn: 'no' }).pitControl.waitReturn, false);
  const r = mk('follow'); pit(r); assert.equal(r.unblock(0, 13000), true); assert.equal(r.cars[0].pits.length, 1); assert.equal(r.cars[0].pitHold, undefined);
});
test('manual stop ignores removal, replacement and lap triggers, while other lanes keep timing', () => {
  const r = mk(); pit(r); const n = r.cars[0].laps.length;
  r.pitSensor(0, false, 13000); assert.equal(r.unblock(0, 13000), false); assert.equal(r.cross(0, 16000), false);
  r.pitSensor(0, true, 18000); assert.equal(r.block(0, 18000), false); assert.equal(r.cross(0, 18000), false);
  assert.equal(r.cross(1, 18000), true); assert.equal(r.cars[0].laps.length, n); assert.equal(r.pitRelease(0, 41000), false);
  r.tick(90000); assert.ok(r.cars[0].pit); assert.equal(r.pitRelease(0, 90000), true); assert.equal(r.cars[0].pits.length, 1);
  assert.equal(r.cross(0, 91000), false); r.pitSensor(0, false, 92000); assert.equal(r.cross(0, 95000), true);
});
test('automatic return guard requires covered then clear after expiry, including an early return still covered', () => {
  const r = mk('auto'); pit(r); r.pitSensor(0, false, 14000); r.pitSensor(0, true, 19000); r.pitSensor(0, false, 21000);
  r.tick(due + 1000); assert.ok(r.cars[0].pit); assert.equal(r.pitHoldOf(0, due + 1000).text, 'Return car to sensor');
  r.pitSensor(0, true, 45000); assert.equal(r.cross(0, 45000), false); r.pitSensor(0, false, 46000);
  assert.equal(r.cars[0].pits.length, 1); assert.equal(r.cars[0].lastPit.duration, 36000);
  const b = mk('auto'); pit(b); b.pitSensor(0, false, 14000); b.pitSensor(0, true, 20000); b.tick(due); b.pitSensor(0, false, 43000); assert.equal(b.cars[0].pits.length, 1);
});
test('automatic stop without return guard closes exactly at deadline, even on a late tick', () => {
  const r = mk('auto', { pitControl: { mode: 'auto', seconds: 30, waitReturn: false } }); pit(r); r.pitSensor(0, false, 13000); r.tick(80000);
  assert.equal(r.cars[0].lastPit.duration, due - 10000); assert.equal(r.events.find(e => e.type === 'pitrelease').t, due);
  assert.equal(r.cars[0].pitRearm, false); assert.equal(r.cars[0].pits.length, 1);
});
test('pause and red flag freeze service; return observations during pause cannot release', () => {
  const r = mk('auto'); pit(r); r.pause(22000); near(r.pitHoldOf(0, 100000).remaining, 20000);
  r.pitSensor(0, false, 30000); r.pitSensor(0, true, 40000); r.pitSensor(0, false, 50000); assert.ok(r.cars[0].pit);
  r.resume(122000); r.tick(142000); assert.ok(r.cars[0].pit); r.pitSensor(0, true, 143000); r.pitSensor(0, false, 144000);
  assert.equal(r.cars[0].pits.length, 1); near(r.cars[0].lastPit.duration, 34000);
  const b = mk(); pit(b); b.setFlag('red', 22000); near(b.pitHoldOf(0, 1e8).remaining, 20000);
});
test('interruption restores remaining time and requires fresh sensor evidence', () => {
  const r = mk('auto'); pit(r); r.tick(22000); const snap = r.snapshot(22000), b = mk('auto'); assert.equal(b.restore(snap), true);
  near(b.pitHoldOf(0, 99999).remaining, 20000); assert.equal(b.cars[0].pitSensor, null); b.resume(100000); b.tick(120000); assert.ok(b.cars[0].pit);
  b.pitSensor(0, false, 120001); assert.ok(b.cars[0].pit); b.pitSensor(0, true, 121000); b.pitSensor(0, false, 122000); assert.equal(b.cars[0].pits.length, 1);
});
test('unknown/disconnected sensors cannot automatically release; explicit button release supports button-only pits', () => {
  const r = mk('auto'); pit(r); r.pitSensor(0, null, 15000); r.tick(100000); assert.ok(r.cars[0].pit);
  assert.equal(r.pitRelease(0, 100001), true); assert.equal(r.cars[0].pitRearm, false);
  const b = mk(); pit(b, null); b.tick(due); assert.equal(b.pitRelease(0, due), true); assert.equal(b.block(0, due + 1000), true);
});
test('fixed service preserves additive and overlapping work proportions', () => {
  const a = P.servicePlan({ fuel: 10000, repair: 15000, tyres: 20000, repairAdd: true, tyreAdd: true }, 30000); near(a.fuel, 10000 * 2 / 3); near(a.repair, 25000 * 2 / 3); near(a.tyres, 30000);
  const p = P.servicePlan({ fuel: 10000, repair: 15000, tyres: 20000 }, 30000); near(p.fuel, 15000); near(p.repair, 22500); near(p.tyres, 30000);
});
test('fuel, repairs and tyres finish within fixed service time, with actual additive order retained', () => {
  const r = mk('manual', { damage: D.clean({ stop: 'add', levels: [{ name: 'Repair', from: 1, seconds: 15, action: 'repair' }] }), tyrewear: T.clean({ changeSeconds: 20, stop: 'add', setsMode: 'none', effect: 'off' }) });
  r.cars[0].fuel = 92; r.addDamage(0, 1, 9000); pit(r); // arrival uses 2 fuel: 10 + 15 + 20 = 45 normal seconds
  r.tick(18000); assert.ok(r.fuelOf(0, 18000) < 100); assert.equal(r.cars[0].dmg, 1); assert.equal(r.cars[0].twStops, 0);
  r.tick(19000); near(r.fuelOf(0, 19000), 100); assert.equal(r.cars[0].dmg, 1);
  r.tick(29000); assert.equal(r.cars[0].dmg, 0); assert.equal(r.cars[0].twStops, 0);
  r.tick(due); assert.equal(r.cars[0].twStops, 1); near(r.cars[0].twLife, 100); assert.equal(r.pitRelease(0, due), true);
  assert.equal(r.events.filter(e => e.type === 'repaired').length, 1); assert.equal(r.cars[0].pits.length, 1);
});
test('penalties are additive after service, including multiple penalties and newly assigned penalties', () => {
  const penalty = E.penaltyConfig({ types: [{ name: 'SG', kind: 'stopgo', seconds: 10, extra: 2 }] });
  const r = mk('auto', { penalty, pitControl: { mode: 'auto', seconds: 30, waitReturn: false } }); r.assign(0, 0, 9000); r.assign(0, 0, 9001); pit(r); r.pitSensor(0, false, 13000);
  r.tick(due); assert.equal(r.cars[0].served.length, 0); assert.equal(r.pitHoldOf(0, due).text, 'Serving penalty'); near(r.pitHoldOf(0, due).remaining, 20000);
  r.tick(52000); assert.equal(r.cars[0].served.length, 1); assert.equal(r.pitRelease(0, 52000), false);
  r.assign(0, 0, 53000); r.tick(72001); assert.equal(r.cars[0].served.length, 3); assert.equal(r.cars[0].lastPit.duration, 62000);
  assert.deepEqual(r.cars[0].served.map(p => p.servedAt), [52000, 62000, 72000]);
});
test('early release is logged, keeps incomplete work and applies early-departure penalties', () => {
  const r = mk('manual', { penalty: E.penaltyConfig({ types: [{ name: 'SG', kind: 'stopgo', seconds: 10, extra: 2 }] }) });
  r.assign(0, 0, 9000); pit(r); assert.equal(r.pitRelease(0, 15000, true), true); assert.equal(r.cars[0].points, 2); assert.ok(r.cars[0].fuel < 100);
  assert.equal(r.events.find(e => e.type === 'pitrelease').early, true); assert.equal(r.pitRelease(0, 16000, true), false);
});
test('race stop closes one pit, clears latch and prevents subsequent release or extra laps', () => {
  const r = mk(); pit(r); r.stop(17000); assert.equal(r.cars[0].pits.length, 1); assert.equal(r.cars[0].pitHold, null); assert.equal(r.pitRelease(0, 50000), false); assert.equal(r.cross(0, 50000), false);
});
test('Service Stop is opt-in and independent of race systems, including practice and qualifying', () => {
  const s = { sessionType: 'race', serviceStop: 'off', pitHoldSeconds: 17, pitHoldMode: 'manual', pitServiceWork: 'add' };
  assert.deepEqual(P.raceConfig(s), {}); s.serviceStop = 'on'; assert.equal(P.raceConfig(s).pitControl.seconds, 17); s.serviceStop = 'off'; assert.equal(s.pitHoldSeconds, 17);
  for (const type of ['race', 'timed', 'practice', 'qualifying']) {
    const r = mk('manual', { type, fuel: { pitHold: 2000 } }); pit(r); r.pitSensor(0, false, 13000); r.tick(due); assert.ok(r.cars[0].pitHold); assert.equal(r.pitRelease(0, due), true);
    assert.equal(r.cars[0].pits.length, 1); assert.equal(r.cars[0].lastPit.refuelled, 0);
  }
});
test('Race Setup work choice overrides each system without changing their stored settings', () => {
  const damage = D.clean({ stop: 'add', levels: [{ name: 'Repair', from: 1, seconds: 15, action: 'repair' }] }), tyrewear = T.clean({ changeSeconds: 20, stop: 'add', effect: 'off' });
  for (const work of ['add', 'overlap']) {
    const r = mk('manual', { damage, tyrewear, pitControl: { mode: 'manual', seconds: 30, work } }); r.cars[0].fuel = 92; r.addDamage(0, 1, 9000); pit(r);
    const w = r.cars[0].pit.work; near(w.fuel, work === 'add' ? 30000 * 10 / 45 : 15000); near(w.repair, work === 'add' ? 30000 * 25 / 45 : 22500);
    assert.equal(damage.stop, 'add'); assert.equal(tyrewear.stop, 'add');
  }
});
test('fixed service respects available tyre sets and counts a mandatory tyre stop only once', () => {
  const r = mk('manual', { tyrewear: T.clean({ changeSeconds: 90, setsMode: 'car', sets: { S: 2, M: 0, H: 0, SS: 0, INT: 0, W: 0 }, mandStops: 1, effect: 'off' }) });
  pit(r); r.pitSensor(0, false, 13000); r.tick(due); const stops = r.cars[0].twStops; r.tick(due + 5000); r.tick(due + 6000);
  assert.equal(stops, 1); assert.equal(r.cars[0].twStops, 1); assert.equal(r.mandOf(0).stopsOk, true); assert.equal(r.cars[0].twSets.S, 0);
});
test('a return signal with an older timestamp cannot overwrite newer sensor evidence', () => {
  const r = mk('auto'); pit(r); r.pitSensor(0, false, 14000); r.tick(due); r.pitSensor(0, true, 44000); assert.equal(r.pitSensor(0, false, 43000), false); assert.ok(r.cars[0].pitHold);
  r.pitSensor(0, false, 45000); assert.equal(r.cars[0].pits.length, 1);
});
console.log(`PIT HOLD TESTS PASSED (${groups} groups)`);
