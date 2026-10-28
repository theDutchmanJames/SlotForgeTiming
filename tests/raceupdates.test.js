const assert=require('assert/strict'),E=require('../renderer/engine'),C=require('../renderer/championship'),W=require('../renderer/weather'),T=require('../renderer/tyrewear'),WW=require('../renderer/weatherwidgets'),Server=require('../server');
let groups=0;const test=(n,f)=>{f();groups++;console.log('ok   '+n)};
const race=extra=>{const r=E.createRace({type:'race',laps:20,entries:[{lane:0,driverName:'A'},{lane:1,driverName:'B'}],...extra});r.start(0);return r};
test('red-flag coasting laps count for distance but cannot become live bests or records',()=>{
 const r=race();r.cross(0,10000);r.setFlag('red',14000);assert.equal(r.cross(0,15000),false);r.setFlag('red',114000);assert.equal(r.cross(0,116000),true);
 assert.deepEqual(r.cars[0].laps,[10000,6000]);assert.deepEqual(r.cars[0].invalid,[1]);assert.deepEqual(r.cars[0].redLaps,[1]);assert.equal(r.cars[0].best,10000);assert.deepEqual(r.goodLaps(r.cars[0]),[10000]);assert.equal(r.lapsOf(r.cars[0]),2);assert.equal(r.setInvalid(0,1,false),false);
 r.cross(0,126000);assert.deepEqual(r.cars[0].invalid,[1]);assert.equal(r.cars[0].best,10000);
});
test('optional additions affect results once per call while measured times and duration clock stay intact',()=>{
 const r=race({redFlagSeconds:5});r.cross(0,10000);r.setFlag('red',14000);assert.equal(r.penMs(r.cars[0]),5000);r.pause(15000);assert.equal(r.penMs(r.cars[0]),5000);r.setFlag('red',114000);r.cross(0,116000);
 assert.equal(r.cars[0].laps[1],6000);assert.equal(r.elapsed(116000),16000);assert.equal(r.timeOf(r.cars[0]),21000);
});
test('only active started cars are marked; first timing-line crossings and finished cars are handled',()=>{
 const r=race({skipFirst:true,redFlagSeconds:5});r.setFlag('red',1000);r.setFlag('red',2000);assert.equal(r.cars[0].redInterrupted,undefined);assert.equal(r.cars[0].extraMs,0);r.cross(0,3000);r.cross(0,13000);assert.equal(r.cars[0].invalid.length,0);
 r.cars[0].done=true;r.setFlag('red',14000);assert.equal(r.cars[0].redInterrupted,undefined);assert.equal(r.cars[1].redInterrupted,undefined);
});
test('pending red interruption survives recovery, lap removal and repeated flags',()=>{
 const r=race();r.cross(0,10000);r.setFlag('red',14000);const b=race();assert.equal(b.restore(r.snapshot(14000)),true);b.resume(114000);b.cross(0,116000);assert.equal(b.cars[0].invalid[0],1);b.removeLap(0,0,true);assert.equal(b.cars[0].redLaps[0],0);assert.equal(b.setInvalid(0,0,false),false);
 const a=race();a.cross(0,10000);a.setFlag('red',11000);a.setFlag('red',12000);a.setFlag('red',13000);a.setFlag('red',14000);a.cross(0,15000);assert.deepEqual(a.cars[0].redLaps,[1]);
});
test('Time Token lane restart clears a previous driver’s pending interruption',()=>{
 const r=race();r.setFlag('red',1000);r.setFlag('red',2000);r.restartCar(0,2100,{driverName:'New'});r.cross(0,3000);r.cross(0,13000);assert.deepEqual(r.cars[0].invalid,[]);
});
const setups=[{id:'p',sessionType:'practice'},{id:'q',sessionType:'qualifying'},{id:'r',sessionType:'race'}];
const champ=()=>C.clean({id:'c',name:'Club',rounds:[{id:'round',sessions:[{id:'p1',setup:'p'},{id:'q1',setup:'q'},{id:'r1',setup:'r'}]}]},true);
test('practice and qualifying skip independently and preserve actual driven counts',()=>{
 const original=champ(),p=C.skipSession(original,0,0,{setups,sessions:[]}).rec;assert.equal(original.rounds[0].sessions[0].skipped,undefined);assert.equal(C.progress(p,[]).next.session,1);assert.equal(C.progress(p,[]).driven,0);assert.equal(C.progress(p,[]).skipped,1);
 const q=C.skipSession(p,0,1,{setups,sessions:[]}).rec;assert.equal(C.progress(q,[]).next.session,2);assert.equal(C.progress(q,[]).skipped,2);const saved=[{date:'2026-10-26',champ:{id:'c',roundId:'round',sessionId:'r1'}}];assert.equal(C.progress(q,saved).complete,true);assert.equal(C.progress(q,saved).driven,1);
});
test('skips persist, can be undone, never skip races or completed sessions, and do not spread to new rounds',()=>{
 const c=C.skipSession(champ(),0,0,{setups,sessions:[]}).rec,clean=C.clean(c,true);assert.equal(C.progress(clean,[]).skipped,1);assert.equal(C.progress(C.skipSession(clean,0,0,{setups,sessions:[]},false).rec,[]).next.session,0);
 assert.ok(C.skipSession(clean,0,2,{setups,sessions:[]}).error);assert.ok(C.skipSession(clean,0,0,{setups,sessions:[{champ:{id:'c',roundId:'round',sessionId:'p1'}}]}).error);
 assert.equal(C.addRound(c).rec.rounds[1].sessions[0].skipped,undefined);assert.equal(C.setSession(c,0,0,{setup:'r'}).rec.rounds[0].sessions[0].skipped,undefined);
});
test('all nine tyre options share correct icons, classes and authenticated command validation',()=>{
 assert.equal(W.TYRES.length,9);for(const [code,color] of [['SS','#e8002d'],['US','#9b4dff'],['HS','#f3a4d6'],['SH','#ff8700']]){assert.equal(W.tyreOf(code).color,color);assert.equal(W.classOf(code),'dry');assert.ok(WW.tyreSvg(code).includes(color));assert.equal(Server.tyreCommand({type:'tyre',lane:0,tyre:code}),true);assert.equal(Server.tyreNextCommand({type:'tyrenext',lane:0,tyre:code}),true)}
 assert.equal(W.tyreOf('H').color,'#f4f4f4');assert.equal(W.tyreOf('M').color,'#ffd12e');assert.equal(W.tyreOf('S').color,'#e8002d');
});
test('new compounds have configurable wear and sets while old compound defaults retain their values',()=>{
 const t=T.defaults();assert.equal(t.tyres.H.wear,2);assert.equal(t.tyres.M.wear,3);assert.equal(t.tyres.S.wear,4.5);assert.equal(t.tyres.SS.wear,7);assert.ok(t.tyres.SH.wear<t.tyres.H.wear);assert.ok(t.tyres.US.wear>t.tyres.SS.wear);assert.ok(t.tyres.HS.wear>t.tyres.US.wear);
 for(const code of ['US','HS','SH']){assert.ok(Number.isFinite(T.clean({}).tyres[code].wear));const r=race({entries:[{lane:0,tyre:code}],tyrewear:T.clean({setsMode:'none',effect:'off'})});r.cross(0,10000);assert.equal(r.cars[0].tyre,code);assert.ok(r.cars[0].twLife<100)}
});
console.log(`RACE UPDATE TESTS PASSED (${groups} groups)`);
