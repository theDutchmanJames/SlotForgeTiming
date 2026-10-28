const assert = require('node:assert/strict');
const E = require('../renderer/engine'), W = require('../renderer/widgets'), T = require('../renderer/timing');
const St = require('../renderer/strategywidgets'), Sc = require('../renderer/safetycar'), En = require('../renderer/endurance'), Ps = require('../renderer/pushsave');
const Share = require('../renderer/liveshare');
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('ok   ' + name); };
const entries = [{ lane: 0, driverName: 'James', driverId: 'a' }, { lane: 1, driverName: 'Bjornie', driverId: 'b' }];
const race = (extra = {}) => { const e = E.createRace({ type: 'race', laps: 100, minLap: 100, entries, ...extra }); e.start(0); return e; };
const state = (eng, now) => ({ eng, now, phase: eng.status, setup: { sessionType: eng.cfg.type }, carByLane: l => eng.cars.find(c => c.lane === l), standings: () => eng.standings(), rowOf: c => eng.standings().find(r => r.car === c) });
const read = (e, type, now, lane = 0, opt = {}) => St.read(type, e.cars[lane], state(e, now), opt);
const fuel = { on: true, tank: 100, perLap: 2, rate: 2, pitHold: 2000, empty: 'warn' };
const held = (mode = 'manual', extra = {}) => race({ fuel, pitControl: { mode, seconds: 30, waitReturn: true }, ...extra });
const pit = e => { e.pitSensor(0, true, 10000); e.block(0, 10000); e.tick(12000); };
const context = (eng, now) => ({ raceId: 'test', eng, now, phase: eng.status, setup: { sessionType: eng.cfg.type }, layout: { widgets: [], laneColors: [] }, track: {}, lanes: 2, base: { personal: new Map(), track: Infinity }, flash: new Map(), bestBy: new Map(), bestAll: Infinity });
const remote = (eng, now) => { const c = context(eng, now), v = Share.viewer(); v.feedStatic(JSON.parse(JSON.stringify(Share.packStatic(c)))); v.feedDynamic(JSON.parse(JSON.stringify(Share.packDynamic(c))), now); return v.shared(now); };

test('all seven widgets have unique definitions, samples, per-lane rendering and missing-lane behavior', () => {
  const e = race();
  assert.equal(W.REGISTRY.length, 92);
  for (const [type, label, group] of St.DEFINITIONS) {
    const d = W.def(type); assert.equal(d.label, label); assert.equal(d.group, group); assert(d.perLane);
    assert(d.sample(0, {}).includes('strategy-value'));
    assert(T.content({ type, lane: 0 }, state(e, 1000)).html.includes('strategy-widget'));
    assert.equal(T.content({ type, lane: 7 }, state(e, 1000)).html, '');
  }
});
test('Service Stop uses total time plus penalties, freezes on pause, and never says GO for manual release', () => {
  const e = held(); pit(e); e.cars[0].pending.push({ name: 'Stop', kind: 'stopgo', seconds: 5 }); e.tick(12000);
  assert.equal(read(e, 'servicestop', 22000).value, '00:25.0');
  assert.match(read(e, 'servicestop', 22000).note, /5 s penalty/);
  e.pause(22000); assert.equal(read(e, 'servicestop', 90000).value, 'PAUSED');
  assert.match(read(e, 'servicestop', 90000).note, /00:25.0/);
  e.resume(92000); e.tick(117000);
  assert.equal(read(e, 'servicestop', 117000).value, 'READY');
  e.pitRelease(0, 117000); assert.equal(read(e, 'servicestop', 117000).note, 'Not in pits');
});
test('automatic release respects return, disconnected sensor and Random Flag holds on both screens', () => {
  const e = held('auto'); pit(e); e.pitSensor(0, false, 13000); e.tick(42000);
  assert.equal(read(e, 'servicestop', 42000).value, 'RETURN');
  e.pitSensor(0, null, 43000); assert.equal(read(e, 'servicestop', 43000).value, 'HOLD');
  e.pitSensor(0, true, 44000); assert.equal(read(e, 'servicestop', 44000).value, 'GO');
  const r = held('auto', { type: 'timed', duration: 2, pitControl: { mode: 'auto', seconds: 5, waitReturn: false }, safetycar: Sc.clean({ target: 12, rndOn: 'on', rndMode: 'exact', rndMin: 1, rndFrom: 0, rndTo: 0, rndLen: 60, rndPitExit: 'on' }) });
  r.block(0, 1000); r.tick(10000);
  assert.equal(read(r, 'servicestop', 10000).value, 'HOLD');
  const s = remote(r, 10000);
  assert.equal(St.read('servicestop', s.eng.cars[0], s).value, 'HOLD');
});
test('fuel range learns actual use, follows refuelling and survives snapshots and second-display transfer', () => {
  const e = race({ fuel });
  assert.match(read(e, 'fuelrange', 0).note, /Learning/);
  [10000, 20000, 30000].forEach(t => e.cross(0, t));
  assert.equal(read(e, 'fuelrange', 30000).value, '≈ 47.0 laps');
  e.block(0, 40000); e.tick(42000);
  assert.equal(read(e, 'fuelrange', 44000).value, '≈ 48.0 laps');
  const snap = e.snapshot(44000), restored = race({ fuel }); assert(restored.restore(snap));
  assert.equal(read(restored, 'fuelrange', 999999).value, '≈ 48.0 laps');
  const s = remote(e, 44000); assert.deepEqual(St.read('fuelrange', s.eng.cars[0], s), read(e, 'fuelrange', 44000));
  e.setInvalid(0, 0, true); e.setInvalid(0, 1, true); assert.match(read(e, 'fuelrange', 44000).note, /Learning/);
});
test('fuel samples are bounded and reindexed on lap removal; toggling Push & Save off still counts laps', () => {
  const e = race({ fuel: { ...fuel, tank: 1000 }, pushsave: Ps.clean({ ...Ps.defaults(), from: 1 }) });
  for (let n = 1; n <= 25; n++) e.cross(0, n * 10000);
  assert.equal(e.cars[0].fuelSamples.length, 20);
  const sample = { ...e.cars[0].fuelSamples[0] }; e.removeLap(0, 0, true);
  assert.equal(e.cars[0].fuelSamples[0].lap, sample.lap - 1);
  e.setSystem('pushsave', false, 25001);
  assert.doesNotThrow(() => e.cross(0, 260000));
  e.setSystem('fuel', false, 260001); assert.equal(read(e, 'fuelrange', 260001).note, 'Fuel system off');
  e.setSystem('fuel', true, 260002); assert.match(read(e, 'fuelrange', 260002).note, /0\/3/);
});
test('gap to next driver uses the immediate opponent and escapes their name', () => {
  const e = race({ entries: [...entries, { lane: 2, driverName: 'C' }] });
  e.cross(0, 10000); e.cross(1, 11000); e.cross(2, 11500);
  assert.equal(read(e, 'gapnext', 12000, 2).value, '+0.500');
  assert.match(read(e, 'gapnext', 12000, 2).note, /Bjornie/);
  e.cars[1].driverName = '<img src=x onerror=alert(1)>';
  assert(!T.content({ type: 'gapnext', lane: 2 }, state(e, 12000)).html.includes('<img'));
  assert.equal(read(e, 'gapnext', 12000).value, 'LEADER');
});
test('penalty widget keeps outstanding penalties visible when the penalty system is switched off', () => {
  const e = held('manual', { penalty: E.penaltyConfig({ everyPoints: 5, everySeconds: 5 }) }); pit(e);
  e.cars[0].pending.push({ kind: 'stopgo', seconds: 5 }, { kind: 'drivethrough', seconds: 0 }); e.tick(12000);
  e.setSystem('penalty', false, 13000);
  assert.equal(read(e, 'penaltyserve', 43000).value, '00:04.0');
  assert.match(read(e, 'penaltyserve', 43000).note, /drive-through/);
  e.tick(47000); assert.equal(read(e, 'penaltyserve', 47000).value, 'CLEAR');
  e.cars[0].pending.push({ kind: 'drivethrough', seconds: 0 });
  assert.equal(read(e, 'penaltyserve', 47000).value, 'PIT REQUIRED');
});
test('lap validity identifies current red-flag, completed red-flag, slow, reviewed and removed laps', () => {
  const e = race({ maxLap: 20000 });
  assert.equal(read(e, 'lapvalidity', 1000).value, 'VALID SO FAR');
  e.setFlag('red', 5000); assert.equal(read(e, 'lapvalidity', 6000).value, 'INVALID');
  const s = remote(e, 6000); assert.equal(St.read('lapvalidity', s.eng.cars[0], s).value, 'INVALID');
  e.resume(10000); e.cross(0, 15000);
  assert.match(read(e, 'lapvalidity', 15000, 0, { lap: 'last' }).note, /red flag/);
  e.cross(0, 40000); assert.equal(read(e, 'lapvalidity', 40000, 0, { lap: 'last' }).value, 'EXCLUDED');
  e.cross(0, 50000); e.setInvalid(0, 2, true);
  assert.equal(read(e, 'lapvalidity', 50000, 0, { lap: 'last' }).value, 'INVALID');
  e.removeLap(0, 2, false); assert.equal(read(e, 'lapvalidity', 50000, 0, { lap: 'last' }).value, 'REMOVED');
});
test('Safety Car target judges only complete yellow laps and matches on a receiving display', () => {
  const e = race({ safetycar: Sc.clean({ target: 12, points: 1 }) });
  assert.match(read(e, 'safetycartarget', 1000).note, /not deployed/);
  e.setFlag('yellow', 2000); e.cross(0, 10000);
  assert.match(read(e, 'safetycartarget', 10000).note, /awaiting/);
  e.cross(0, 21000); assert.match(read(e, 'safetycartarget', 21000).note, /−1.000 s · too fast/);
  const s = remote(e, 21000); assert.deepEqual(St.read('safetycartarget', s.eng.cars[0], s), read(e, 'safetycartarget', 21000));
  e.cross(0, 34000); assert.match(read(e, 'safetycartarget', 34000).note, /on target/);
});
test('stint time follows the current driver, freezes while paused and resets after a swap', () => {
  const e = race({ type: 'timed', duration: 20, endurance: En.clean({ sessionType: 'endurance', swapConfirm: 'button' }), entries: [{ ...entries[0], roster: [{ id: 'a', name: 'James' }, { id: 'b', name: 'Bjornie' }] }] });
  assert.equal(read(e, 'stinttime', 20000).value, '00:20.0');
  e.pause(20000); assert.equal(read(e, 'stinttime', 100000).value, '00:20.0');
  e.resume(100000); assert(e.swap(0, 110000));
  assert.equal(read(e, 'stinttime', 115000).value, '00:05.0');
  assert.match(read(e, 'stinttime', 115000).note, /Bjornie/);
});
test('drawing widgets does not advance service, consume fuel, award penalties or alter recorded laps', () => {
  const e = held(); pit(e); const before = e.snapshot(18000);
  for (const [type] of St.DEFINITIONS) for (let n = 0; n < 5; n++) T.content({ type, lane: 0 }, state(e, 18000));
  assert.deepEqual(e.snapshot(18000), before);
  const old = structuredClone(before); delete old.cars[0].fuelSamples;
  const restored = held(); assert(restored.restore(old));
  assert.match(read(restored, 'fuelrange', 99999).note, /Learning/);
  assert.equal(read(restored, 'servicestop', 99999).value, 'PAUSED');
});
console.log(`${passed} STRATEGY WIDGET GROUPS PASSED`);
