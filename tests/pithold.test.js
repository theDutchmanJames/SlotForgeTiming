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
  assert.equal(P.raceConfig({ serviceStop: 'on', pitHoldMode: 'driver' }).pitControl.mode, 'driver');
  const r = mk('follow'); pit(r); assert.equal(r.unblock(0, 13000), true); assert.equal(r.cars[0].pits.length, 1); assert.equal(r.cars[0].pitHold, undefined);
});
test('manual stop ignores removal, replacement and lap triggers, while other lanes keep timing', () => {
  const r = mk(); pit(r); const n = r.cars[0].laps.length;
  r.pitSensor(0, false, 13000); assert.equal(r.unblock(0, 13000), false); assert.equal(r.cross(0, 16000), false);
  r.pitSensor(0, true, 18000); assert.equal(r.block(0, 18000), false); assert.equal(r.cross(0, 18000), false);
  assert.equal(r.cross(1, 18000), true); assert.equal(r.cars[0].laps.length, n); assert.equal(r.pitHoldOf(0, 41000).canRelease, true);
  r.tick(90000); assert.ok(r.cars[0].pit); assert.equal(r.pitRelease(0, 90000), true); assert.equal(r.cars[0].pits.length, 1);
  assert.equal(r.cross(0, 91000), false); r.pitSensor(0, false, 92000); assert.equal(r.cross(0, 95000), true);
});
test('driver release requires removal, return and departure, and ignores the timer', () => {
  const r = mk('driver'); pit(r); r.pitSensor(0, false, 14000); r.tick(15000); assert.ok(r.cars[0].pit);
  r.pitSensor(0, false, 16000); assert.ok(r.cars[0].pit);
  r.pitSensor(0, true, 19000); assert.ok(r.cars[0].pit); assert.equal(r.cross(0, 19000), false);
  r.pitSensor(0, false, 21000); assert.equal(r.cars[0].pits.length, 1); assert.equal(r.cars[0].lastPit.duration, 11000);
  assert.equal(r.events.find(e=>e.type==='pitrelease').by,'sensor'); assert.equal(r.events.find(e=>e.type==='pitrelease').early,true);
  const b = mk('driver'); pit(b); b.tick(100000); assert.ok(b.cars[0].pit); b.pitSensor(0,false,101000); assert.ok(b.cars[0].pit); b.pitSensor(0,true,102000); b.pitSensor(0,false,103000); assert.equal(b.cars[0].pits.length,1);
});
test('timer mode closes exactly at deadline, even on a late tick', () => {
  const r = mk('auto', { pitControl: { mode: 'auto', seconds: 30, waitReturn: false } }); pit(r); r.pitSensor(0, false, 13000); r.tick(80000);
  assert.equal(r.cars[0].lastPit.duration, due - 10000); assert.equal(r.events.find(e => e.type === 'pitrelease').t, due);
  assert.equal(r.cars[0].pitRearm, false); assert.equal(r.cars[0].pits.length, 1);
});
test('pause and red flag freeze service; paused departure cannot release on resume', () => {
  const r = mk('auto'); pit(r); r.pause(22000); near(r.pitHoldOf(0, 100000).remaining, 20000);
  r.pitSensor(0, false, 30000); r.pitSensor(0, true, 40000); r.pitSensor(0, false, 50000); assert.ok(r.cars[0].pit);
  r.resume(122000); r.tick(160000); assert.equal(r.cars[0].pits.length, 1); near(r.cars[0].lastPit.duration, 32000);
  const b = mk('driver'); pit(b); b.setFlag('red', 22000); near(b.pitHoldOf(0, 1e8).remaining, 20000);
  b.pitSensor(0,false,30000); b.pitSensor(0,true,40000); b.pitSensor(0,false,50000); b.resume(122000); b.tick(160000); assert.ok(b.cars[0].pit);
  b.pitSensor(0,true,161000); b.pitSensor(0,false,162000); assert.equal(b.cars[0].pits.length,1);
});
test('interruption restores remaining time and requires fresh sensor evidence', () => {
  const r = mk('driver'); pit(r); r.tick(22000); const snap = JSON.parse(JSON.stringify(r.snapshot(22000))), b = mk('driver'); assert.equal(b.restore(snap), true);
  near(b.pitHoldOf(0, 99999).remaining, 20000); assert.equal(b.cars[0].pitSensor, null); b.resume(100000); b.tick(120000); assert.ok(b.cars[0].pit);
  b.pitSensor(0, false, 120001); assert.ok(b.cars[0].pit); b.pitSensor(0, true, 121000); b.pitSensor(0, false, 122000); assert.equal(b.cars[0].pits.length, 1);
});
test('timer release does not require a sensor; driver release requires fresh evidence after disconnect', () => {
  for (const sensor of [true,false,null]) {const r=mk('auto');pit(r);r.pitSensor(0,sensor,15000);r.tick(100000);assert.equal(r.cars[0].lastPit.duration,32000);assert.equal(r.cars[0].pitRearm,sensor!==false);}
  const b=mk('driver');pit(b);b.pitSensor(0,false,14000);b.pitSensor(0,true,15000);b.pitSensor(0,null,16000);b.pitSensor(0,false,17000);b.tick(100000);assert.ok(b.cars[0].pit);
  assert.equal(b.pitRelease(0,100001),true);
  const c=mk();pit(c,null);assert.equal(c.pitRelease(0,13000),true);assert.equal(c.block(0,14000),true);
});
test('service schedule retains actual additive and overlapping durations regardless of timer', () => {
  assert.deepEqual(P.servicePlan({fuel:15000,tyres:2000,tyreAdd:true},30000),{fuel:15000,repair:0,tyres:17000});
  assert.deepEqual(P.servicePlan({fuel:10000,repair:15000,tyres:20000,repairAdd:true,tyreAdd:true},30000),{fuel:10000,repair:25000,tyres:45000});
  assert.deepEqual(P.servicePlan({fuel:10000,repair:15000,tyres:20000},30000),{fuel:10000,repair:15000,tyres:20000});
});
test('fuel, repairs and tyres run at their actual speeds, even beyond the service timer', () => {
  const r = mk('manual', { damage: D.clean({ stop: 'add', levels: [{ name: 'Repair', from: 1, seconds: 15, action: 'repair' }] }), tyrewear: T.clean({ changeSeconds: 20, stop: 'add', setsMode: 'none', effect: 'off' }) });
  r.cars[0].fuel = 92; r.addDamage(0, 1, 9000); pit(r);
  r.tick(19000); near(r.fuelOf(0,19000),97); assert.equal(r.cars[0].dmg,1);
  r.tick(22000); near(r.fuelOf(0,22000),100); assert.equal(r.cars[0].dmg,1);
  r.tick(37000); assert.equal(r.cars[0].dmg,0); assert.equal(r.cars[0].twStops,0);
  r.tick(due); assert.equal(r.cars[0].twStops,0); r.tick(57000); assert.equal(r.cars[0].twStops,1); near(r.cars[0].twLife,100);
  assert.equal(r.pitRelease(0,57000),true); assert.equal(r.events.filter(e=>e.type==='repaired').length,1);
});
test('penalties are additive after service, including multiple penalties and newly assigned penalties', () => {
  const penalty = E.penaltyConfig({ types: [{ name: 'SG', kind: 'stopgo', seconds: 10, extra: 2 }] });
  const r = mk('auto', { penalty, pitControl: { mode: 'auto', seconds: 30, waitReturn: false } }); r.assign(0, 0, 9000); r.assign(0, 0, 9001); pit(r); r.pitSensor(0, false, 13000);
  r.tick(due); assert.equal(r.cars[0].served.length, 0); assert.equal(r.pitHoldOf(0, due).text, 'Serving penalty'); near(r.pitHoldOf(0, due).remaining, 20000);
  r.tick(52000); assert.equal(r.cars[0].served.length, 1); assert.equal(r.pitRelease(0, 52000, false, 'timer'), false);
  r.assign(0, 0, 53000); r.tick(72001); assert.equal(r.cars[0].served.length, 3); assert.equal(r.cars[0].lastPit.duration, 62000);
  assert.deepEqual(r.cars[0].served.map(p => p.servedAt), [52000, 62000, 72000]);
});
test('early release is logged, keeps incomplete work and applies early-departure penalties', () => {
  const r = mk('manual', { penalty: E.penaltyConfig({ types: [{ name: 'SG', kind: 'stopgo', seconds: 10, extra: 2 }] }) });
  r.cars[0].fuel = 50; r.assign(0, 0, 9000); pit(r); assert.equal(r.pitRelease(0, 15000, true), true); assert.equal(r.cars[0].points, 2); assert.ok(r.cars[0].fuel < 100);
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
    const w = r.cars[0].pit.work; near(w.fuel, 10000); near(w.repair, work === 'add' ? 25000 : 15000);
    assert.equal(damage.stop, 'add'); assert.equal(tyrewear.stop, 'add');
  }
});
test('actual service work respects available tyre sets and counts a mandatory tyre stop only once', () => {
  const r = mk('manual', { tyrewear: T.clean({ changeSeconds: 90, setsMode: 'car', sets: { S: 2, M: 0, H: 0, SS: 0, INT: 0, W: 0 }, mandStops: 1, effect: 'off' }) });
  pit(r); r.pitSensor(0, false, 13000); r.tick(due); assert.equal(r.cars[0].twStops,0); r.tick(102000); const stops = r.cars[0].twStops; r.tick(107000); r.tick(108000);
  assert.equal(stops, 1); assert.equal(r.cars[0].twStops, 1); assert.equal(r.mandOf(0).stopsOk, true); assert.equal(r.cars[0].twSets.S, 0);
});
test('a return signal with an older timestamp cannot overwrite newer sensor evidence', () => {
  const r = mk('driver'); pit(r); r.pitSensor(0, false, 14000); r.tick(due); r.pitSensor(0, true, 44000); assert.equal(r.pitSensor(0, false, 43000), false); assert.ok(r.cars[0].pitHold);
  r.pitSensor(0, false, 45000); assert.equal(r.cars[0].pits.length, 1);
});

test('director releases any mode before deadline, retaining fuel and leaving unfinished work and penalties', () => {
  for(const mode of ['auto','manual','driver']) {
    const r=mk(mode,{damage:D.clean({levels:[{name:'Repair',from:1,seconds:20,action:'repair'}]}),tyrewear:T.clean({changeSeconds:20,effect:'off'}),penalty:E.penaltyConfig({types:[{name:'SG',kind:'stopgo',seconds:10}]})});
    r.cars[0].fuel=50;r.addDamage(0,1,9000);r.assign(0,0,9000);pit(r);const life=r.cars[0].twLife;
    assert.equal(r.pitRelease(0,17000),true);near(r.cars[0].fuel,53);assert.equal(r.cars[0].twLife,life);assert.equal(r.cars[0].twStops,0);assert.equal(r.cars[0].dmg,1);assert.equal(r.cars[0].pending.length,1);assert.equal(r.cars[0].served.length,0);
  }
});
test('timer releases both lanes at equal service durations despite lane lengths and late ticks', () => {
  const r=mk('auto',{laneLengths:[10,11],distance:{lanes:[{lane:0,length:10,laps:50},{lane:1,length:11,laps:46}]},tyrewear:T.clean({changeSeconds:90,effect:'off'},{laneLen:[10,11]})});
  pit(r);r.pitSensor(1,true,10400);r.block(1,10400);r.tick(12400);r.tick(100000);
  assert.deepEqual(r.cars.map(c=>c.lastPit.duration),[32000,32000]);assert.deepEqual(r.cars.map(c=>c.twStops),[0,0]);
  assert.deepEqual(r.events.filter(e=>e.type==='pitrelease').map(e=>e.t),[42000,42400]);
});
test('15 seconds of fuel then 2 seconds of tyres finish at 17, and wait to 30 in timer mode', () => {
  const r=mk('auto',{tyrewear:T.clean({changeSeconds:2,stop:'add',effect:'off'})});r.cars[0].fuel=87;pit(r);
  r.tick(26000);near(r.fuelOf(0,26000),99);assert.equal(r.cars[0].twStops,0);
  r.tick(27000);near(r.fuelOf(0,27000),100);assert.equal(r.cars[0].twStops,0);
  r.tick(29000);assert.equal(r.cars[0].twStops,1);assert.ok(r.cars[0].pit);
  r.tick(42000);assert.equal(r.cars[0].pits.length,1);assert.equal(r.cars[0].lastPit.duration,32000);
});
test('zero-rate fuel cannot instantly complete sequential work, including JSON recovery', () => {
  const r=mk('manual',{fuel:{on:true,tank:100,rate:0,perLap:2,pitHold:2000},tyrewear:T.clean({changeSeconds:2,stop:'add',effect:'off'})});r.cars[0].fuel=50;pit(r);
  assert.equal(r.cars[0].pit.work.tyres,null);r.tick(50000);assert.equal(r.cars[0].twStops,0);
  const b=E.createRace(r.cfg);assert.equal(b.restore(JSON.parse(JSON.stringify(r.snapshot(50000)))),true);b.resume(100000);b.tick(200000);assert.equal(b.cars[0].twStops,0);assert.equal(b.pitRelease(0,200000),true);near(b.cars[0].fuel,48);
});


test('stopping between ticks cannot extend a timed stop or complete later work', () => {
 const r=mk('auto',{tyrewear:T.clean({changeSeconds:90,effect:'off'})});pit(r);r.stop(150000);assert.equal(r.cars[0].lastPit.duration,32000);assert.equal(r.cars[0].twStops,0);
});
test('early driver departure never spends unfinished tyre or repair resources', () => {
 const Res=require('../renderer/resources'),resources=Res.prepare({id:'pit-stock',...Res.clean({owner:'car',tyres:{M:3},repairsOn:true,repairs:3})},{runId:'pit-test'});
 const r=mk('driver',{entries:[{lane:0,carId:'car',tyre:'M'}],resources,tyrewear:T.clean({changeSeconds:20,effect:'off'}),damage:D.clean({levels:[{name:'Repair',from:1,seconds:20,action:'repair'}]})});
 r.addDamage(0,1,9000);pit(r);const stock=JSON.stringify(r.resourceBalance(r.cars[0]));r.pitSensor(0,false,14000);r.pitSensor(0,true,15000);r.pitSensor(0,false,16000);
 assert.equal(JSON.stringify(r.resourceBalance(r.cars[0])),stock);assert.equal(r.cars[0].dmg,1);assert.equal(r.cars[0].twStops,0);
});

console.log(`PIT HOLD TESTS PASSED (${groups} groups)`);
