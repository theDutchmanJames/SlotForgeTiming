// The plugin path uses the same level decoder and race actions as real hardware.
const assert=require('node:assert/strict'),C=require('../renderer/timingplugin'),P=require('../renderer/phidget'),PR=require('../renderer/parallelrace'),PS=require('../renderer/pitsensors'),E=require('../renderer/engine');
const tick=()=>new Promise(r=>setImmediate(r));
function config(extra={}){return C.sensorConfig(C.config({id:'example.simulated-timing',...extra}));}
(async()=>{
 for(const separate of [false,true]){
  const c=config({pitMode:separate?'separate':'shared'}),l=P.createLink({config:c});let at=0;
  const r=E.createRace({type:'race',laps:50,entries:[{lane:0},{lane:1}],fuel:{pitHold:1000},pitControl:{mode:'auto',seconds:3,waitReturn:true}});r.start(0);l.setConnected(true);
  const sensors=PS.bind({eng:()=>r,now:()=>at,hardware:'plugin',link:l});sensors.sync();let disconnected=0;
  const bind=PR.bind({link:l,pitMs:1000,setup:{},cars:()=>r.cars,phase:()=>r.status,lights:()=>0,flag:()=>r.flag,crossCar:(i,t)=>r.cross(i,t),holdCar:(i,t)=>r.block(i,t,true),blockCar:(i,t)=>r.block(i,t,true),unblockCar:(i,t)=>r.unblock(i,t),trackcall:()=>{},acquire:async()=>({lease:1}),release:async()=>{},outputs:async()=>{},onDisconnected:()=>{disconnected++;r.pause(at);}});await tick();
  const input=separate?c.pit[0]:c.lap[0];const f=(time,value)=>{at=time;l.feed({key:P.key(input.address),at,value});l.tick(at);r.tick(at);};
  f(0,0);f(1000,1);at=2000;l.tick(at);r.tick(at);assert(r.cars[0].pitHold);f(2500,0);assert(r.cars[0].pitHold);at=5500;l.tick(at);r.tick(at);assert(r.cars[0].pitHold,'wait for return');
  // Unused input kind must not release the held service stop.
  const unused=separate?c.lap[0]:c.pit[0];l.feed({key:P.key(unused.address),at:5600,value:0});assert(r.cars[0].pitHold);
  f(6000,1);f(6500,0);assert.equal(r.cars[0].pits.length,1);assert.equal(r.cars[0].laps.length,separate?0:1);
  l.setConnected(false);assert.equal(disconnected,1);assert.equal(r.status,'paused');assert.equal(r.cars[0].pitSensor,null);bind.off();sensors.off();
 }
 const T=require('../renderer/tyrewear'),W=require('../renderer/weather'),Push=require('../renderer/pushsave'),SC=require('../renderer/safetycar'),D=require('../renderer/damage');
 const opts={type:'race',laps:50,minLap:800,skipFirst:true,entries:[{lane:0,tyre:'S'},{lane:1,tyre:'M'}],fuel:{on:true,tank:100,start:100,perLap:2,rate:10,pitHold:1000},tyrewear:T.clean({setsMode:'none',effect:'off'}),pushsave:Push.clean({mode:'median',from:2}),weather:W.clean({unit:'laps',startAt:4},7),safetycar:SC.clean({target:15,points:1}),damage:D.clean({levels:[{name:'Repair',from:1,seconds:5,action:'repair'}]}),penalty:E.penaltyConfig({everyPoints:1,everySeconds:2})};
 const r=E.createRace(opts),direct=E.createRace(opts),c=config({pitMode:'none',lapMap:[1,0,2,3,4,5,6,7]}),link=P.createLink({config:c});r.start(0);direct.start(0);link.setConnected(true);
 for(let i=0;i<2;i++)link.feed({key:P.key(c.lap[i].address),value:0,at:0});
 const bind=PR.bind({link,pitMs:1000,setup:{},cars:()=>r.cars,phase:()=>r.status,lights:()=>0,flag:()=>r.flag,crossCar:(i,t)=>r.cross(i,t),unblockCar:()=>{},trackcall:()=>{},acquire:async()=>({lease:1}),release:async()=>{},outputs:async()=>{}});await tick();
 const both=fn=>{fn(r);fn(direct);};
 for(const [lane,at] of [[0,1000],[1,1500],[0,11000],[0,11100],[1,12000],[0,21000],[1,23000],[0,32000],[1,34000],[0,46000],[1,47000],[0,57000]]){
  if(at===21000)both(x=>x.addDamage(0,1,20000));
  if(at===32000)both(x=>x.setFlag('yellow',30000));
  if(at===46000){both(x=>x.setFlag('red',40000));both(x=>x.setFlag('red',43000));}
  link.feed({key:P.key(c.lap[lane].address),value:1,at});direct.cross(lane,at);link.feed({key:P.key(c.lap[lane].address),value:0,at:at+10});
 }
 both(x=>x.addPoints(0,2,58000,'director'));
 assert.deepEqual(r.cars,direct.cars,'mapped plugin inputs preserve all engine effects');assert.deepEqual(r.events,direct.events);assert(r.cars[0].fuel<100&&r.cars[0].twLife<100);assert(r.cars[0].invalid.length>0);assert(r.penMs(r.cars[0])>0);assert.equal(r.cars[0].laps.length,5,'formation and minimum lap are preserved');
 const snap=r.snapshot(60000),restored=E.createRace(opts);assert(restored.restore(snap),'existing race checkpoint format remains usable');
 both(x=>x.setSystem('fuel',false,61000));const fuel=r.cars[0].fuel;link.feed({key:P.key(c.lap[0].address),value:1,at:67000});direct.cross(0,67000);assert.equal(r.cars[0].fuel,fuel);assert.deepEqual(r.cars,direct.cars);bind.off();
 console.log('PLUGIN TIMING RACE PASSED: mapped lanes, formation/minimum laps, fuel, tyres, weather, damage, penalties, flags, checkpoint, shared/separate Service Stops and system toggles.');
})().catch(e=>{console.error(e);process.exitCode=1;});
