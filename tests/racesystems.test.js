const assert=require('assert/strict'), E=require('../renderer/engine'), S=require('../renderer/racesystems'), T=require('../renderer/tyrewear'), D=require('../renderer/damage'), W=require('../renderer/weather');
let groups=0;const test=(n,f)=>{f();groups++;console.log('ok   '+n)};
const mk=extra=>{const r=E.createRace({type:'race',laps:100,duration:10,entries:[{lane:0,tyre:'S'},{lane:1,tyre:'M'}],fuel:{on:true,tank:100,rate:10,perLap:2,pitHold:1000},...extra});r.start(0);return r};
test('saved switches retain references and only configured systems can be enabled',()=>{
 const a={fuelRules:'fuel1',disabledSystems:''};a.disabledSystems=S.toggle(a.disabledSystems,'fuel',false);assert.equal(a.fuelRules,'fuel1');assert.deepEqual(S.raceConfig(a),{systemsDisabled:['fuel']});assert.equal(S.toggle(a.disabledSystems,'fuel',true),'');assert.deepEqual(S.clean(['fuel','fuel','bogus']),['fuel']);
 const r=mk();assert.equal(r.setSystem('weather',false,100),false);assert.equal(r.setSystem('fuel','no',100),false);
});
test('fuel can switch both ways without reset, retroactive consumption or changed lap times',()=>{
 const r=mk();r.cross(0,10000);assert.equal(r.cars[0].fuel,98);assert.equal(r.setSystem('fuel',false,11000),true);r.cross(0,20000);r.cross(0,30000);assert.equal(r.cars[0].fuel,98);assert.equal(r.fuel.on,false);assert.equal(r.fuelOf(0,30000),null);
 assert.equal(r.setSystem('fuel',true,31000),true);r.cross(0,40000);assert.equal(r.cars[0].fuel,96);assert.deepEqual(r.cars[0].laps,[10000,10000,10000,10000]);assert.equal(r.events.filter(x=>x.type==='systemtoggle').length,2);
});
test('tyre wear freezes while lap/stint history continues, then resumes at retained life',()=>{
 const r=mk({tyrewear:T.clean({setsMode:'none',effect:'off'})});r.cross(0,10000);const life=r.cars[0].twLife;r.setSystem('tyrewear',false,11000);r.cross(0,20000);r.cross(0,30000);assert.equal(r.cars[0].twLife,life);assert.equal(r.tyrewear,null);assert.equal(r.twStintsOf(0).stints[0].laps,3);
 r.setSystem('tyrewear',true,31000);r.cross(0,40000);assert.ok(r.cars[0].twLife<life);assert.equal(r.cars[0].twStops,0);
});
test('already-issued points and Stop-and-Go remain, while new penalties stop',()=>{
 const r=mk({penalty:E.penaltyConfig({everyPoints:1,everySeconds:2,types:[{name:'SG',kind:'stopgo',seconds:5,extra:2}]})});r.addPoints(0,3,1000);r.assign(0,0,1001);const ms=r.penMs(r.cars[0]);r.setSystem('penalty',false,2000);assert.equal(r.penMs(r.cars[0]),ms);assert.equal(r.addPoints(0,1,3000),false);assert.equal(r.assign(0,0,3000),false);
 r.block(0,4000);r.tick(9000);assert.equal(r.cars[0].served.length,1);r.unblock(0,10000);r.setSystem('penalty',true,11000);assert.equal(r.addPoints(0,1,11001),true);
});
test('damage deadlines pause for laps driven while off',()=>{
 const r=mk({damage:D.clean({levels:[{name:'Repair',from:1,seconds:5,within:2,urgency:'asap',action:'repair'}]})});r.addDamage(0,1,500);const due=r.cars[0].dmgDue;r.setSystem('damage',false,1000);r.cross(0,10000);r.cross(0,20000);assert.equal(r.addDamage(0,1,21000),false);assert.equal(r.cars[0].dmg,1);r.setSystem('damage',true,22000);assert.equal(r.cars[0].dmgDue,due===null?null:due+2);
});
test('weather time schedules resume with remaining time rather than catching up',()=>{
 const r=mk({weather:W.clean({unit:'time',startAt:1,cloudyFor:0.1,rainFor:0.2},7)});r.tick(1000);r.setSystem('weather',false,2000);r.tick(120000);assert.equal(r.wxState,'dry');r.setSystem('weather',true,120000);r.tick(120001);assert.equal(r.wxState,'dry');assert.equal(r.wxStage,0);r.tick(180000);assert.notEqual(r.wxState,'dry');
});
test('existing fixed-time pit work finishes once after its systems are turned off',()=>{
 const r=mk({pitControl:{mode:'manual',seconds:3},tyrewear:T.clean({changeSeconds:9,setsMode:'none',effect:'off'}),damage:D.clean({levels:[{name:'Repair',from:1,seconds:10,action:'repair'}]})});r.addDamage(0,1,100);r.block(0,1000);r.tick(2000);r.setSystem('fuel',false,2100);r.setSystem('tyrewear',false,2200);r.setSystem('damage',false,2300);r.tick(5000);assert.equal(r.cars[0].dmg,0);assert.equal(r.cars[0].twStops,1);assert.equal(r.fuelOf(0,5000),100);assert.equal(r.pitRelease(0,5000),true);assert.equal(r.cars[0].pits.length,1);
});
test('new pits do not start disabled work and turning it back on preserves values',()=>{
 const r=mk({systemsDisabled:['fuel','tyrewear'],tyrewear:T.clean({changeSeconds:1,setsMode:'none',effect:'off'})});assert.equal(r.fuel.on,false);r.block(0,1000);r.tick(5000);assert.equal(r.cars[0].twStops,0);r.unblock(0,5000);r.setSystem('fuel',true,6000);r.setSystem('tyrewear',true,6000);r.cross(0,10000);assert.equal(r.cars[0].fuel,98);r.block(0,11000);r.tick(15000);assert.equal(r.cars[0].twStops,1);
});
test('disabled state and schedule offsets survive snapshot/restore',()=>{
 const cfg={weather:W.clean({unit:'time',startAt:1,cloudyFor:0.1},3)};const r=mk(cfg);r.setSystem('weather',false,1000);r.tick(30000);const b=mk(cfg);assert.equal(b.restore(r.snapshot(30000)),true);assert.equal(b.systemEnabled('weather'),false);b.resume(100000);b.setSystem('weather',true,101000);b.tick(101001);assert.equal(b.wxState,'dry');
});
test('finished races reject switches and past retirement is never undone',()=>{
 const r=mk({fuel:{on:true,tank:1,perLap:2,rate:1,empty:'retire',pitHold:1000}});r.cross(0,10000);assert.equal(r.cars[0].retired,true);r.setSystem('fuel',false,11000);r.setSystem('fuel',true,12000);assert.equal(r.cars[0].retired,true);r.stop(13000);assert.equal(r.setSystem('fuel',false,14000),false);
});
console.log(`RACE SYSTEM SWITCH TESTS PASSED (${groups} groups)`);
