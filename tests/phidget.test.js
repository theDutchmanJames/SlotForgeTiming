const assert=require('node:assert/strict'),P=require('../renderer/phidget'),PR=require('../renderer/parallelrace'),PS=require('../renderer/pitsensors'),E=require('../renderer/engine');
const address=(channel,type='digital',serial=123,hubPort=-1)=>({serial,channel,type,hubPort,hubDevice:false});
function cfg(extra={}){const c=P.defaults();c.lanes=2;c.lap[0].address=address(0);c.lap[1].address=address(1);c.pit[0].address=address(2);c.pit[1].address=address(3);c.call.address=address(4);return {...c,...extra};}
const tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
 assert.deepEqual(P.validate(cfg()),[]);assert(P.validate(cfg({lanes:9})).length);assert(P.validate(cfg({rearm:-1})).length);
 const dup=cfg();dup.lap[1].address=address(0);assert(P.validate(dup).some(s=>s.includes('already assigned')));dup.lap[1].address=address(0,'digital',124);assert.deepEqual(P.validate(dup),[]);
 const a=cfg();a.lap[0].address=address(0,'voltage');a.lap[0].clear=1;assert(P.validate(a).some(s=>s.includes('threshold')));
 const hub=cfg();hub.lap[0].address={...address(0,'digital',321,2),hubDevice:true};hub.lap[1].address={...address(0,'voltage',321,2),hubDevice:true};
 assert(P.validate(hub).some(s=>s.includes('already assigned')),'hub-port input modes share one physical pin');
 hub.lap[1].address.hubPort=3;assert.deepEqual(P.validate(hub),[]);assert(!P.addressValid({...hub.lap[0].address,channel:1}));
 const analogue=cfg();analogue.lap[0].address=address(0,'voltage');analogue.lap[1].address=address(0,'ratio');Object.assign(analogue.lap[1],{trigger:0.2,clear:0.5});
 assert(P.validate(analogue).some(s=>s.includes('already assigned')),'voltage and ratio modes cannot reserve the same sensor twice');
 const output=cfg({outputsOn:true,outputs:[{address:address(0,'output'),active:false,role:'master'}]});assert(P.validate(output).some(s=>s.includes('FALSE')));
 const calls=cfg({trackcall:true}),callLink=P.createLink({config:calls}),callEvents=[];callLink.on(e=>callEvents.push(e));callLink.setConnected(true);
 for(const [at,value] of [[0,0],[1,1],[2,1],[3,0],[4,1]])callLink.feed({key:P.key(calls.call.address),at,value});
 assert.equal(callEvents.filter(e=>e.type==='call').length,2);assert.equal(callLink.total,0,'track calls never count as laps');
 const c=cfg({rearm:50}),L=P.createLink({config:c}),events=[];L.on(e=>events.push(e));L.setConnected(true);const feed=(at,value,lane=0)=>L.feed({at,key:P.key(c.lap[lane].address),value});
 feed(0,1);feed(100,1);assert.equal(L.total,0,'blocked at attach cannot count');feed(200,0);feed(240,1);assert.equal(L.total,0,'clear rearm suppresses bounce');feed(300,0);feed(400,1);feed(500,1);assert.equal(L.total,1);L.setHold(1000);L.tick(1400);assert.equal(events.filter(e=>e.type==='block').length,1);feed(1500,0);assert.equal(events.at(-1).type,'free');assert.equal(events[0].at,400,'source callback timestamp preserved');assert.equal(feed(1499,1),false,'out of order rejected');assert.equal(feed(1600,2),false,'invalid digital level rejected');L.rearm();feed(1700,1);L.rearm();feed(1800,1);assert.equal(L.total,2,'rebind does not create a held-sensor crossing');L.setConnected(false);assert.equal(feed(1900,0),false);
 for(const below of [true,false]){const c=cfg();Object.assign(c.lap[0],{address:address(0,'ratio'),below,trigger:below?0.3:0.7,clear:0.5});const l=P.createLink({config:c});l.setConnected(true);const values=below?[0.8,0.2,0.4,0.25,0.6,0.2]:[0.2,0.8,0.6,0.75,0.4,0.8];values.forEach((v,i)=>l.feed({key:P.key(c.lap[0].address),at:i*100,value:v}));assert.equal(l.total,2,'analogue hysteresis');}
 const inv=cfg();inv.lap[0].active=false;const il=P.createLink({config:inv});il.setConnected(true);il.feed({key:P.key(inv.lap[0].address),at:0,value:1});il.feed({key:P.key(inv.lap[0].address),at:100,value:0});assert.equal(il.total,1);
 for(const separate of [false,true]){
  const c=cfg({pitMode:separate?'separate':'shared'}),l=P.createLink({config:c});let at=0;const r=E.createRace({type:'race',laps:50,entries:[{lane:0},{lane:1}],fuel:{pitHold:1000},pitControl:{mode:'auto',seconds:3,waitReturn:true}});r.start(0);l.setConnected(true);
  const sensors=PS.bind({eng:()=>r,now:()=>at,hardware:'phidget',link:l});sensors.sync();let disconnected=0,outs=[];
  const bind=PR.bind({link:l,pitMs:1000,setup:{},cars:()=>r.cars,phase:()=>r.status,lights:()=>0,flag:()=>r.flag,crossCar:(i,t)=>r.cross(i,t),holdCar:(i,t)=>r.block(i,t,true),blockCar:(i,t)=>r.block(i,t,true),unblockCar:(i,t)=>r.unblock(i,t),trackcall:()=>{},acquire:async()=>({lease:1}),release:async()=>{},outputs:async v=>outs.push(v),onDisconnected:()=>{disconnected++;r.pause(at);}});await tick();
  const input=separate?c.pit[0]:c.lap[0];const f=(time,value)=>{at=time;l.feed({key:P.key(input.address),at,value});l.tick(at);r.tick(at);};f(0,0);f(1000,1);at=2000;l.tick(at);r.tick(at);assert(r.cars[0].pitHold,'service stop starts');f(2500,0);assert(r.cars[0].pitHold,'remove car retains stop');at=5500;l.tick(at);r.tick(at);assert(r.cars[0].pitHold,'wait for return');f(6000,1);f(6500,0);assert.equal(r.cars[0].pits.length,1);assert.equal(r.cars[0].laps.length,separate?0:1,'service return does not add a second lap');
  l.setConnected(false);assert.equal(disconnected,1);assert.equal(r.status,'paused');assert.equal(r.cars[0].pitSensor,null);bind.off();sensors.off();
 }
 // Feed the same race through Phidget and directly: all race systems must see identical events.
 const T=require('../renderer/tyrewear'),W=require('../renderer/weather'),PSave=require('../renderer/pushsave'),SC=require('../renderer/safetycar'),D=require('../renderer/damage');
 const opts={type:'race',laps:50,minLap:800,entries:[{lane:0,tyre:'S'},{lane:1,tyre:'M'}],
  fuel:{on:true,tank:100,start:100,perLap:2,rate:10,pitHold:1000},tyrewear:T.clean({setsMode:'none',effect:'off'}),
  pushsave:PSave.clean({mode:'median',from:2}),weather:W.clean({unit:'laps',startAt:4},7),
  safetycar:SC.clean({target:15,points:1}),damage:D.clean({levels:[{name:'Repair',from:1,seconds:5,action:'repair'}]}),
  penalty:E.penaltyConfig({everyPoints:1,everySeconds:2})};
 const r=E.createRace(opts),direct=E.createRace(opts),cc=cfg({pitMode:'none'}),link=P.createLink({config:cc});
 r.start(0);direct.start(0);link.setConnected(true);for(let lane=0;lane<2;lane++)link.feed({key:P.key(cc.lap[lane].address),value:0,at:0});
 const bind=PR.bind({link,pitMs:1000,setup:{},cars:()=>r.cars,phase:()=>r.status,lights:()=>0,flag:()=>r.flag,
  crossCar:(i,t)=>r.cross(i,t),unblockCar:()=>{},trackcall:()=>{},acquire:async()=>({lease:1}),release:async()=>{},outputs:async()=>{}});
 await tick();
 const both=fn=>{fn(r);fn(direct);};
 for(const [lane,at] of [[0,10000],[1,10500],[0,19000],[1,21000],[0,28000],[1,31000],[0,40000],[1,42000],[0,50000],[1,52000]]){
  if(at===19000)both(x=>x.addDamage(0,1,15000));
  if(at===28000)both(x=>x.setFlag('yellow',25000));
  if(at===50000)both(x=>x.setFlag('yellow',43000));
  if(at===50000){both(x=>x.setFlag('red',45000));both(x=>x.setFlag('red',48000));}
  link.feed({key:P.key(cc.lap[lane].address),value:1,at});direct.cross(lane,at);
  link.feed({key:P.key(cc.lap[lane].address),value:0,at:at+10});
 }
 assert.deepEqual(r.cars,direct.cars,'Phidget produces the same race-system state as ordinary crossings');
 assert.deepEqual(r.events,direct.events);assert(r.cars[0].fuel<100);assert(r.cars[0].twLife<100);
 assert(r.cars[0].invalid.length>0);assert(r.penMs(r.cars[0])>0,'Safety Car adds penalties through normal engine');
 assert(!r.goodLaps(r.cars[0]).includes(r.cars[0].laps.at(-1)),'red-flag lap excluded from records');
 both(x=>x.setSystem('fuel',false,53000));const fuel=r.cars[0].fuel;
 link.feed({key:P.key(cc.lap[0].address),value:1,at:60000});direct.cross(0,60000);
 assert.equal(r.cars[0].fuel,fuel);assert.deepEqual(r.cars,direct.cars);bind.off();
 console.log('Phidget passed: strict configuration, channel identities, initial levels, pulse rearm, both polarities, hysteresis, source timestamps, shared/separate pits, Service Stop remove/return, disconnect and engine integration.');
})().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={cfg,address};
