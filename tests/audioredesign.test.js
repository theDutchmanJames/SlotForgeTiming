const assert=require('node:assert/strict');
const E=require('../renderer/engine'),A=require('../renderer/announcer'),C=A.catalogue,S=require('../renderer/sound'),Tw=require('../renderer/tyrewear');
let count=0;function test(name,fn){S.stop();S.resetCool();fn();count++;console.log('ok '+name);}
const entries=[{lane:0,driverId:'a',driverName:'Alex',nickname:'Ace',tyre:'S'},{lane:1,driverId:'b',driverName:'Sam',tyre:'M'}];
const race=(cfg={})=>{const r=E.createRace({type:'race',laps:100,entries,...cfg});r.start(0);r.cars.forEach(c=>c.started=true);return r;};
const opts=(...ids)=>({calls:Object.fromEntries(ids.map(id=>[id,{on:true}]))});
const watch=(r,o)=>{const a=A.create(o);a.observe(r,{phase:'running',now:0});return (t,phase='running',extra={})=>a.observe(r,{phase,now:t,...extra});};
const has=(es,id)=>es.filter(e=>e.call===id);
test('new calls are unique, documented and quiet in new and old audio sets',()=>{
 assert.equal(C.definitions.length,42);assert.equal(new Set(A.CALLS.map(c=>c.id)).size,A.CALLS.length);
 C.definitions.forEach(([id])=>{assert.equal(S.defaultSet().calls[id].on,false);assert.equal(S.choose({calls:{}},id,A.SAMPLE),null);});
 A.CALLS.forEach(c=>c.lines.forEach(t=>assert.deepEqual(C.inspect(t,c,A.SAMPLE),{unknown:[],missing:[]})));
});
test('normalisation preserves recordings, custom wording, conditions and settings',()=>{
 const old={id:'old',name:'Club',futureOption:42,calls:{tyrenew:{on:false,lines:[{text:'Custom tyres!',file:'data:audio/wav;base64,AA',only:{driver:'a'}}]},winner:{on:true,lines:[{text:'{driver} wins the race!'}]}}};
 const d=S.normalize(old);assert.equal(d.futureOption,42);assert.deepEqual(d.calls.tyrenew,old.calls.tyrenew);assert.equal(d.calls.winner.lines[0].text,'{driver} leads the provisional results');assert.equal(old.calls.winner.lines[0].text,'{driver} wins the race!');
 assert.equal(S.profile(d,'Broadcast').calls.tyrenew.lines[0].file,old.calls.tyrenew.lines[0].file);
});
test('unsupported or missing values choose a valid fallback; heat/final concatenation remains compatible',()=>{
 const d=S.defaultSet();d.calls.penalty.lines=[{text:'Bad {time}',only:{driver:'a'}},{text:'Points {points}'}];
 assert.equal(S.choose(d,'penalty',{driver:'Alex',points:3},()=>0,{driverId:'a'}).text,'Points 3');
 d.calls.prerace.lines=[{text:'Heat {heat}{final}'}];assert.equal(S.choose(d,'prerace',{heat:'',final:'B'}).text,'Heat B');
 d.calls.racesummary={on:true,lines:[{text:'Range {fuellaps}'},{text:'{driver} is racing'}]};assert.equal(S.choose(d,'racesummary',{driver:'Alex',fuellaps:''},()=>0).text,'Alex is racing');
});
test('three-decimal time and record improvements preserve milliseconds',()=>{
 assert.equal(A.speakTime(10421,3),'10.421');assert.equal(A.speakDiff(6,3),'0.006 seconds');
 const r=race(),w=watch(r,{spokenDecimals:3,base:{track:10427}});r.cross(0,10421);const es=w(10421),record=has(es,'trackrecord')[0];
 assert.ok(record);assert.equal(record.vars.time,'10.421');assert.equal(record.vars.improved,'0.006 seconds');assert.equal(record.vars.best,'10.421');
});
test('service ready follows the real combined timer, sensor return and manual release rules',()=>{
 const r=race({fuel:{on:true,tank:100,perLap:2,rate:1,pitHold:2000},pitControl:{mode:'auto',seconds:30,waitReturn:true},penalty:E.penaltyConfig({types:[{name:'Stop',kind:'stopgo',seconds:5}]})}),w=watch(r,opts('servicestart','servicecountdown','serviceready'));
 r.assign(0,0,9000);
 r.pitSensor(0,true,10000);r.block(0,10000);r.tick(12000);assert.equal(has(w(12000),'servicestart').length,1);
 r.tick(42000);assert.equal(has(w(42000),'serviceready').length,0);assert.equal(C.driverValues(r,r.cars[0],{}, {now:42000}).penaltyremaining,'5 seconds');
 r.pitSensor(0,null,43000);r.tick(47000);assert.equal(has(w(47000),'serviceready').length,0);
 r.pitSensor(0,true,48000);assert.equal(has(w(48000),'serviceready').length,1);assert.equal(has(w(49000),'serviceready').length,0);
 const m=race({fuel:{on:false,pitHold:1000},pitControl:{mode:'manual',seconds:2}}),v=watch(m,opts('serviceready','serviceearly'));
 m.block(0,10000);m.tick(11000);v(11000);m.tick(20000);assert.equal(has(v(20000),'serviceready').length,0);
});
test('a sensor removal cannot produce a ready call before the car is returned',()=>{
 const r=race({fuel:{on:false,pitHold:1000},pitControl:{mode:'auto',seconds:3,waitReturn:true}}),w=watch(r,opts('serviceready'));
 r.pitSensor(0,true,10000);r.block(0,10000);r.tick(11000);w(11000);r.pitSensor(0,false,12000);r.tick(15000);
 assert.equal(has(w(15000),'serviceready').length,0);r.pitSensor(0,true,16000);assert.equal(has(w(16000),'serviceready').length,1);
});
test('hardware connection calls are edges, named per interface, with no invented initial reconnect',()=>{
 const r=race(),w=watch(r,opts('hardwarelost','hardwareback')),hw=(id,connected)=>({hardware:{id,name:id,connected}});
 assert.equal(has(w(1,'running',hw('parallel',true)),'hardwareback').length,0);
 assert.equal(has(w(2,'running',hw('parallel',false)),'hardwarelost').length,1);assert.equal(has(w(3,'running',hw('parallel',false)),'hardwarelost').length,0);
 assert.equal(has(w(4,'running',hw('parallel',true)),'hardwareback')[0].vars.interface,'parallel');
});
test('Safety Car pit exit calls also work for sensor-following stops without Service Stop',()=>{
 const r=race({fuel:{on:false,pitHold:1000}}),w=watch(r,opts('pitheld','pitclear'));r.block(0,10000);r.tick(11000);w(11000);
 let held=true;r.cars[0].rndPitExit=true;r.pitExitHeld=()=>held;
 assert.equal(has(w(12000),'pitheld').length,1);assert.equal(has(w(13000),'pitheld').length,0);held=false;assert.equal(has(w(14000),'pitclear').length,1);assert.equal(has(w(15000),'pitclear').length,0);
});
test('review edits announce actual invalidation, restoration and classification changes once',()=>{
 const r=race(),w=watch(r,opts('lapinvalid','laprestored','resultcorrected'));r.cross(0,10000);w(10000);r.stop(11000);w(11000,'review');
 r.setInvalid(0,0,true);assert.equal(has(w(11000,'review'),'lapinvalid').length,1);assert.equal(has(w(11000,'review'),'lapinvalid').length,0);
 r.setInvalid(0,0,false);assert.equal(has(w(11000,'review'),'laprestored').length,1);
 r.cars[0].extraMs+=5000;assert.equal(has(w(11000,'review'),'resultcorrected').length,1);
});
test('one tyre fitting produces one ambient effect while the car remains in the pit',()=>{
 const r=race({fuel:{on:true,tank:100,perLap:1,rate:1,pitHold:2000},tyrewear:Tw.clean({changeSeconds:2,setsMode:'none'})}),w=watch(r,{});
 r.cross(0,10000);w(10000);r.twQueue(0,'H',11000);w(11000);r.block(0,12000);r.tick(20000);const es=w(20000);
 assert.ok(r.cars[0].pit);assert.equal(has(es,'tyrenew').length,1);assert.equal(has(es,'tyrechange').length,0);
 const d=S.defaultSet(),before=S.state.amb.log.length;d.calls.ambtyres={on:true,lines:[{file:'data:audio/wav;base64,AA'}]};S.state.ambBackend={play:()=>({stop(){},volume(){}})};
 es.forEach(e=>S.ambientFor(d,e.call,e.vars,e.facts));assert.equal(S.state.amb.log.slice(before).filter(x=>x.id==='ambtyres').length,1);
 assert.match(S.choose(d,'tyrenew',has(es,'tyrenew')[0].vars,()=>0).text,/fitted/);
});
test('penalty escalation replaces the unserved tier and suppresses duplicate generic calls',()=>{
 const r=race({penalty:E.penaltyConfig({ruleMode:'custom',rules:[{from:1,pit:8},{from:3,pit:15}]})}),w=watch(r,opts('penaltyconsequence','penaltyupgrade'));
 r.addPoints(0,1,1000);let es=w(1000);assert.equal(has(es,'penaltyconsequence').length,1);assert.equal(has(es,'penalty').length,0);assert.equal(has(es,'specialpenalty').length,0);
 r.addPoints(0,2,2000);es=w(2000);assert.equal(has(es,'penaltyupgrade')[0].vars.requiredstop,'15 seconds');assert.equal(r.cars[0].pending.length,1);assert.equal(has(es,'penaltyconsequence')[0].vars.pointstotal,3);
});
test('low-fuel warning uses configurable levels and resets only above the reset level',()=>{
 const r=race({fuel:{on:true,tank:100,perLap:1}}),c=r.cars[0],w=watch(r,{fuelLow:20,fuelReset:40});
 c.fuel=21;assert.equal(has(w(100),'fuellow').length,0);c.fuel=20;assert.equal(has(w(200),'fuellow').length,1);assert.equal(has(w(300),'fuellow').length,0);
 c.fuel=35;w(400);c.fuel=19;assert.equal(has(w(500),'fuellow').length,0);c.fuel=41;w(600);c.fuel=19;assert.equal(has(w(700),'fuellow').length,1);
});
test('fuel estimates use clean samples and actual remaining fuel, never made-up zeroes',()=>{
 const r=race({fuel:{on:true,tank:100,perLap:2}}),c=r.cars[0];
 for(let n=1;n<=5;n++)r.cross(0,n*10000);
 let v=C.driverValues(r,c,{}, {now:50000});assert.equal(v.fuelpercent,90);assert.equal(v.fuellaps,45);
 r.setInvalid(0,0,true);r.setInvalid(0,1,true);r.setInvalid(0,2,true);v=C.driverValues(r,c,{}, {now:50000});assert.equal(v.fuellaps,'');
});
test('pace state waits for consecutive laps and a normal band prevents boundary chatter',()=>{
 const r=race(),w=watch(r,{...opts('pushstate','savestate','normalstate'),paceLaps:2,paceHysteresis:0.2});let pace=-3;r.psInfo=()=>({kind:pace<0?'push':'save',p:pace,ref:10000});let at=0;
 const lap=()=>{r.cross(0,at+=10000);return w(at);};
 assert.equal(has(lap(),'pushstate').length,0);assert.equal(has(lap(),'pushstate').length,1);pace=0.1;assert.equal(has(lap(),'normalstate').length,0);pace=-0.1;assert.equal(has(lap(),'normalstate').length,1);
 pace=2;lap();assert.equal(has(lap(),'savestate').length,1);
});
test('final results and championship calls use saved classification and awarded scoring',()=>{
 const es=C.resultCalls({standings:[{pos:1,driverName:'Sam',driverId:'b',laps:10,best:10000},{pos:2,driverName:'Alex'}]});assert.equal(es[1].vars.driver,'Sam');
 assert.equal(C.champCalls({state:'race',awarded:false}).length,0);
 const view={state:'race',awarded:true,round:2,decided:1,total:2,rows:[{driverId:'a',name:'Alex',round:25,total:43,pos:1}],before:{drivers:[{id:'b',pos:1}]},after:{drivers:[{id:'a',name:'Alex',total:43,pos:1}]}};
 let out=C.champCalls(view);assert.equal(has(out,'roundpoints')[0].vars.championshippoints,43);assert.equal(has(out,'champleader').length,1);assert.equal(has(out,'champwinner').length,0);view.decided=2;assert.equal(has(C.champCalls(view),'champwinner').length,1);
});
test('sound then speech completes in order; expired commentary cannot displace a service call',()=>{
 const d=S.defaultSet(),played=[],pending=[];let clock=0;S.state.now=()=>clock;S.state.backend={stop(){},file(u,o,done){played.push('file');pending.push(done);},speak(t,o,done){played.push(t);pending.push(done);}};
 d.calls.newleader.lines=[{text:'{driver}',file:'data:audio/wav;base64,AA',mode:'both'}];S.say(d,'newleader',{driver:'Alex'});assert.deepEqual(played,['file']);pending.shift()();assert.deepEqual(played,['file','Alex']);
 S.say(d,'overtake',{driver:'Sam',other:'Alex',position:'first'});d.calls.serviceready.on=true;S.say(d,'serviceready',{driver:'Alex'});clock=20000;pending.shift()();assert.match(played.at(-1),/stop is complete/);pending.shift()();assert.equal(played.length,3);assert.ok(S.diagnostics.some(x=>x.why==='Expired while waiting'));S.state.now=()=>Date.now();
});
test('loop red-flag fade respects opt-in and resumes without starting duplicate players',()=>{
 const d=S.defaultSet();d.calls.ambcrowd={on:true,lines:[{file:'data:audio/wav;base64,AA'}],redPause:true,fadeIn:0,fadeOut:0};let players=0,vol;
 S.state.ambBackend={play(){players++;return{stop(){},volume(v){vol=v;}};}};S.ambientFor(d,'lightsout',{});S.ambientFor(d,'redflag',{});assert.equal(vol,0);S.ambientFor(d,'greenflag',{});assert.ok(vol>0);assert.equal(players,1);
});
test('results finalisation preserves heat-point announcements already waiting',()=>{
 const d=S.defaultSet(),played=[],next=[];['heatpoints','resultsfinal','finalwinner'].forEach(id=>d.calls[id].on=true);
 S.state.backend={stop(){},speak(t,o,done){played.push(t);next.push(done);}};
 S.say(d,'heatpoints',{driver:'Alex',heatpoints:10});S.say(d,'heatpoints',{driver:'Sam',heatpoints:8});S.say(d,'resultsfinal',{});S.say(d,'finalwinner',{driver:'Alex'});
 while(next.length)next.shift()();assert.deepEqual(played,['Alex, 10 heat points.','Sam, 8 heat points.','The results are now final.','The confirmed winner is Alex.']);
});
S.stop();console.log(`${count} audio redesign integration groups passed`);
