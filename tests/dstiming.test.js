const {test}=require('node:test'),assert=require('node:assert/strict');
const DS=require('../renderer/dstiming'),P=require('../renderer/dsprotocol');
const {createRace,fuelConfig}=require('../renderer/engine');
function packet({lane=1,n=1,ticks=50000,marker=false,model='ds300',control}={}) {
  const b=Buffer.alloc(21);b[0]=224;b[1]=n%256;b[2]=21;b[20]=235;
  b[7]=control===undefined?27:0;b[8]=control||0;b[10]=model==='ds200'?lane:128>>(lane-1);
  const bcd=n=>(Math.floor(n/10)<<4)|(n%10);
  b[11]=bcd(Math.floor(n/100));b[12]=bcd(n%100);
  if(marker)b.set([0,170,171,170,170],13);
  else {let seconds=Math.floor(ticks/10000);b[13]=bcd(Math.floor(seconds/3600));b[14]=bcd(Math.floor(seconds/60)%60);b[15]=bcd(seconds%60);b[16]=bcd(Math.floor(ticks%10000/100));b[17]=bcd(ticks%100);}
  b[18]=P.checksum(b);return b;
}
function harness(config={},model='ds300'){
  let at=0,r=createRace({type:'race',laps:30,entries:[{lane:0},{lane:1}],...config});
  const link=DS.createLink({now:()=>at}),faults=[];link.setConnected(true,model);
  const binding=DS.bind({link,engine:()=>r,phase:()=>r.status,lanes:2,crossCar:(i,t,held,o)=>r.cross(i,t,o),onFault:message=>{faults.push(message);r.setFlag('red',at);}});
  return {get r(){return r;},link,binding,faults,sendRaw(t,bytes){at=t;link.feed(bytes);},send(t,o){at=t;link.feed(packet({...o,model}));},start(t=0){at=t;r.start(t);binding.sync();},pause(t){at=t;r.pause(t);binding.sync();},resume(t){at=t;r.resume(t);binding.sync();},replace(){r=createRace({type:'race',laps:30,entries:[{lane:0},{lane:1}]});binding.sync();}};
}
for(const model of ['ds200','ds300'])test(model+' preserves device precision and uses normal fuel/lap/finish processing',()=>{
 const h=harness({laps:2,fuel:fuelConfig({tank:100,perLap:10})},model);h.start();
 h.send(100,{marker:true});assert.equal(h.r.cars[0].laps.length,0);
 h.send(5350,{n:2,ticks:51234});h.send(10500,{n:3,ticks:50000});
 assert.deepEqual(h.r.cars[0].laps,[5123.4,5000]);assert.equal(h.r.cars[0].best,5000);
 assert.equal(h.r.cars[0].done,true);assert.equal(h.r.cars[0].total,10500);
 assert(h.r.cars[0].fuel<100);assert.equal(h.faults.length,0);
});
test('duplicate packets and global sequence changes never add laps',()=>{
 const h=harness();h.start();h.send(100,{marker:true});h.send(5100,{n:2});h.send(5200,{n:2});
 const b=packet({n:2});b[1]=253;b[18]=P.checksum(b);h.link.feed(b);
 assert.deepEqual(h.r.cars[0].laps,[5000]);assert.equal(h.faults.length,0);
});
test('pause drops device interval, excludes stopped time and then resumes accurate durations',()=>{
 const h=harness();h.start();h.send(100,{marker:true});h.pause(2100);h.send(4000,{n:2});h.resume(6100);
 h.send(8100,{n:3,ticks:90000});assert.equal(h.r.cars[0].laps[0],4000);
 h.send(13200,{n:4,ticks:50001});assert.equal(h.r.cars[0].laps[1],5000.1);
});
test('DS controls pause but never start or resume Timing',()=>{
 const h=harness();h.send(0,{control:163});assert.equal(h.r.status,'ready');h.start();
 h.send(100,{control:165});assert.equal(h.r.status,'paused');h.send(200,{control:166});h.send(300,{control:163});assert.equal(h.r.status,'paused');
 h.resume(400);h.send(500,{control:164});assert.equal(h.r.status,'paused');
 h.resume(600);h.send(700,{control:167});assert.equal(h.r.status,'paused');
 h.resume(800);h.send(900,{control:161});assert.equal(h.r.status,'paused');
});
test('disconnect pauses, same-model reconnect is ready without automatically resuming',()=>{
 const h=harness();h.start();h.send(100,{marker:true});h.link.setConnected(false);assert.equal(h.r.status,'paused');assert.equal(h.binding.ready(),false);
 h.link.setConnected(true,'ds300');assert(h.binding.ready());assert.equal(h.r.status,'paused');
 h.link.setConnected(true,'ds200');assert.equal(h.binding.ready(),false);
});
test('lost counters pause for review and never invent laps',()=>{
 const h=harness();h.start();h.send(100,{marker:true});h.send(10100,{n:3});assert.equal(h.r.status,'paused');assert.equal(h.r.cars[0].laps.length,0);assert.match(h.faults[0],/missed crossing/);
});
test('counter rollover is accepted; reset markers and conflicting duplicates are faults',()=>{
 const h=harness();h.start();h.send(100,{n:9999,marker:true});h.send(5100,{n:0});assert.equal(h.r.cars[0].laps.length,1);
 h.send(5200,{n:0,ticks:50001});assert.equal(h.r.status,'paused');h.resume(6000);h.send(7000,{n:1,marker:true});assert.equal(h.r.status,'paused');
});
test('noise, malformed packets, unsupported types and unknown lanes never reach engine',()=>{
 const h=harness();h.start();const bad=packet();bad[18]^=255;h.link.feed(bad);h.link.feed(Buffer.from([1,2,3]));
 const final=packet();final[7]=28;final[18]=P.checksum(final);h.link.feed(final);h.send(200,{lane:8});assert.equal(h.r.cars[0].laps.length,0);assert.equal(h.faults.length,0);
 for(const model of ['ds030','ds0045','ds200b','ds300rc']){h.link.setConnected(true,model);assert(!h.link.connected);assert.equal(h.link.feed(packet()).length,0);}
});
test('new heat resets counter history and disposal detaches race listeners',()=>{
 const h=harness();h.start();h.send(100,{n:9,marker:true});h.replace();h.start();h.send(100,{marker:true});h.send(5100,{n:2});assert.equal(h.r.cars[0].laps.length,1);h.binding.off();h.send(10100,{n:3});h.link.setConnected(false);assert.equal(h.r.status,'running');assert.equal(h.r.cars[0].laps.length,1);
});
test('virtual lanes are ignored and manual crossings invalidate device interval',()=>{
 const h=harness();h.r.cars[1].virtualRival=true;h.start();h.send(100,{lane:2,marker:true});h.send(5100,{lane:2,n:2});assert.equal(h.r.cars[1].laps.length,0);
 h.send(100,{marker:true});h.r.cross(0,2000);h.send(5100,{n:2});assert.equal(h.r.cars[0].laps.at(-1),3100);
});
test('zero device durations cannot set records',()=>{const h=harness();h.start();h.send(100,{marker:true});h.send(200,{n:2,ticks:0});assert.equal(h.r.status,'paused');assert.equal(h.r.cars[0].best,null);});
test('a recovered race opened offline accepts reconnection of its saved DS model',()=>{
 const link=DS.createLink(),r=createRace({entries:[{lane:0}]});
 const b=DS.bind({link,model:'ds200',engine:()=>r,phase:()=>r.status,lanes:2,crossCar(){},onFault(){}});
 assert(!b.ready());link.setConnected(true,'ds200');assert(b.ready());link.setConnected(true,'ds300');assert(!b.ready());b.off();
});
test('too many track lanes fail readiness for each DS model',()=>{
 for(const model of ['ds200','ds300']){const link=DS.createLink();link.setConnected(true,model);const b=DS.bind({link,engine:()=>({}),phase:()=> 'ready',lanes:DS.lanes(model)+1,crossCar(){},onFault(){}});assert(!b.ready());b.off();}
});
test('minimum lap rejection never causes the next measurement to lose elapsed laps',()=>{
 const h=harness({minLap:1000});h.start();h.send(100,{marker:true});h.send(300,{n:2,ticks:2000});assert.equal(h.r.cars[0].laps.length,0);
 h.send(5100,{n:3,ticks:48000});assert.equal(h.r.cars[0].laps[0],5000);
});
test('measured durations still respect red-flag record exclusion and yellow penalties',()=>{
 const h=harness({yellow:{target:6000,points:1}});h.start();h.r.setFlag('yellow',50);h.send(100,{marker:true});h.send(5200,{n:2,ticks:50000});assert.equal(h.r.cars[0].yellowFast.length,1);
 h.r.setFlag('red',5300);h.binding.sync();h.resume(6000);h.send(11000,{n:3});assert(h.r.cars[0].invalid.includes(1));assert.equal(h.r.cars[0].best,5000);
});
test('a rejected lap sharing an arrival timestamp does not lend its interval to the next lap',()=>{
 const h=harness({minLap:1000});h.start();h.send(100,{marker:true});
 h.sendRaw(5100,Buffer.concat([packet({n:2,ticks:50000}),packet({n:3,ticks:2000})]));
 h.send(10100,{n:4,ticks:48000});assert.deepEqual(h.r.cars[0].laps,[5000,5000]);
});
test('conflicting packets from unused, virtual and completed lanes cannot pause active racers',()=>{
 for(const lane of [2,8]){const h=harness();h.r.cars[1].virtualRival=true;h.start();h.send(100,{lane,n:1});h.send(200,{lane,n:1,ticks:60000});assert.equal(h.r.status,'running');}
 const h=harness();h.start();h.r.cars[1].done=true;h.send(100,{lane:2,n:1});h.send(200,{lane:2,n:1,ticks:60000});assert.equal(h.r.status,'running');
});
test('partial serial packets cannot straddle a pause or new heat',()=>{
 for(const transition of ['pause','heat']){
  const h=harness();h.start();h.send(100,{marker:true});const b=packet({n:2});h.sendRaw(2100,b.subarray(0,12));
  if(transition==='pause'){h.pause(2100);h.resume(6100);}else{h.replace();h.start(6100);}
  h.sendRaw(6200,b.subarray(12));assert.equal(h.r.cars[0].laps.length,0);
 }
});
test('one failed status observer cannot prevent remaining observers or disconnect cleanup',()=>{
 const errors=[],link=DS.createLink({onError:e=>errors.push(e.message)}),changes=[];
 link.onStatus(()=>{throw Error('display failed');});link.onStatus(on=>changes.push(on));
 assert.doesNotThrow(()=>link.setConnected(true,'ds200'));assert.doesNotThrow(()=>link.setConnected(false));
 assert.deepEqual(changes,[true,false]);assert.deepEqual(errors,['display failed','display failed']);
});


test('phase changes are synchronised before completing a fragmented packet',()=>{
 const h=harness();h.start();h.send(100,{marker:true});const b=packet({n:2});h.sendRaw(2100,b.subarray(0,12));
 h.r.pause(2100);h.r.resume(6100); // No UI update/sync in between.
 h.sendRaw(6200,b.subarray(12));assert.equal(h.r.cars[0].laps.length,0);
 h.send(11100,{n:3});assert.equal(h.r.status,'paused','a missing crossing must be reviewed');
});
test('a failed crossing callback pauses the race and reports the error',()=>{
 let phase='running';const errors=[],faults=[],link=DS.createLink({onError:e=>errors.push(e.message)});
 link.setConnected(true,'ds300');const r=createRace({entries:[{lane:0}]});r.start(0);
 const b=DS.bind({link,engine:()=>r,phase:()=>phase,lanes:1,crossCar(){throw Error('failed processing');},onFault:m=>{faults.push(m);phase='paused';}});
 link.feed(packet({marker:true}));assert.equal(phase,'paused');assert.equal(faults.length,1);assert.deepEqual(errors,['failed processing']);b.off();
});

const E=require('../renderer/engine'),Tw=require('../renderer/tyrewear'),Ps=require('../renderer/pushsave'),W=require('../renderer/weather'),Dm=require('../renderer/damage'),Sc=require('../renderer/safetycar'),Res=require('../renderer/resources');
const systemConfig=()=>({type:'race',laps:100,minLap:800,maxLap:30000,entries:[{lane:0,driverId:'d1',carId:'c1',tyre:'M'},{lane:1,driverId:'d2',carId:'c2',tyre:'M'}],
 fuel:{on:true,tank:100,perLap:2,rate:20,pitHold:1000},
 pushsave:Ps.clean({mode:'median',benchmark:'track',trackTarget:10,from:1}),
 tyrewear:Tw.clean({tempOn:'on',changeSeconds:2,tyres:{M:{wear:2}}}),
 weather:W.clean({startMode:'manual'}),
 damage:Dm.clean({levels:[{name:'Dent',from:1,seconds:2,action:'repair'}]}),
 penalty:E.penaltyConfig({everyPoints:5,everySeconds:2}),
 safetycar:Sc.clean({target:15,points:2}),bop:{mode:'manual'},
 resources:Res.prepare({id:'ds-stock',...Res.clean({owner:'car',tyres:{M:3,H:3,W:3},repairsOn:true,repairs:2})},{runId:'ds-test'})});
for(const model of ['ds200','ds300'])test(model+' matches the normal race engine with all resource/pace/weather/pit systems enabled',()=>{
 const cfg=systemConfig(),h=harness(structuredClone(cfg),model),normal=createRace(structuredClone(cfg));h.start();normal.start(0);
 h.send(100,{marker:true});normal.cross(0,100,{startOnly:true});
 let n=1;const cross=(t,ms)=>{h.send(t,{n:++n,ticks:ms*10});normal.cross(0,t);};
 cross(10100,10000);cross(19600,9500);cross(30600,11000);
 assert(h.r.cars[0].fuel<100);assert(h.r.cars[0].twLife<100);assert(h.r.cars[0].twTemp>0);
 for(const r of [h.r,normal]){r.bopSet(0,-20,31000);r.wxSet('wet',31000,'director');r.setFlag('yellow',30600);r.addDamage(0,1,32000);}
 cross(40600,10000);assert(h.r.cars[0].yellowFast.length>0);
 for(const r of [h.r,normal]){r.block(0,45000);r.tick(55000);r.unblock(0,55000);r.setFlag('green',55000);}
 // Manual pit entry moved the engine baseline. The next DS interval includes
 // that entry and must be discarded in favour of Timing's current baseline.
 h.send(60600,{n:++n,ticks:200000});normal.cross(0,60600);
 assert.equal(h.r.cars[0].dmg,0);assert(h.r.resources.events.length>2);
 assert.deepEqual(h.r.cars,normal.cars);assert.deepEqual(h.r.resources,normal.resources);assert.deepEqual(h.r.events,normal.events);assert.equal(h.faults.length,0);
});
test('DS measured pace, rather than serial arrival jitter, drives Push & Save and tyre wear',()=>{
 const cfg=systemConfig();cfg.tyrewear=Tw.clean({tempOn:'off',effect:'off',tyres:{M:{wear:2}}});cfg.weather=null;const h=harness(cfg);h.start();h.send(100,{marker:true});
 h.send(12000,{n:2,ticks:100000}); // 11.9s on the host, 10s measured by DS.
 const effect=Ps.lapEffect(h.r.pushSave,{lapMs:10000,ref:10000,lapNo:1});
 assert.equal(h.r.cars[0].laps[0],10000);assert(Math.abs(h.r.cars[0].fuel-(100-2*effect.fuel))<1e-6,JSON.stringify({fuel:h.r.cars[0].fuel,ps:h.r.cars[0].psNow,effect,config:h.r.pushSave}));
 assert(Math.abs(h.r.cars[0].twLife-(100-2*effect.tyres))<1e-6);assert.equal(h.r.cars[0].total,12000);
});
test('practice, qualifying, timed/endurance and lap races accept DS input through normal scoring',()=>{
 for(const type of ['practice','qualifying','timed','race']){
  const h=harness({type,duration:60,laps:3});h.start();h.send(100,{marker:true});h.send(5100,{n:2});h.send(10100,{n:3});h.send(15100,{n:4});
  assert.equal(h.r.cars[0].laps.length,3);assert.equal(h.r.cars[0].best,5000);
  assert.equal(h.r.cars[0].done,type==='race');assert.equal(h.faults.length,0);
 }
});


test('a fresh Time Token stint does not inherit the previous stint counter',()=>{
 const h=harness({type:'practice'});h.start();h.send(100,{marker:true});h.send(5100,{n:2});
 h.r.restartCar(0,10000);h.send(10100,{n:10,marker:true});h.send(15100,{n:11});
 assert.equal(h.r.status,'running');assert.deepEqual(h.r.cars[0].laps,[5000]);assert.equal(h.faults.length,0);
});
test('unpaid Time Token lanes cannot raise packet faults and can start cleanly when paid',()=>{
 let allowed=false,at=0;const faults=[],link=DS.createLink({now:()=>at}),r=createRace({type:'practice',entries:[{lane:0}]});link.setConnected(true,'ds300');r.start(0);
 const b=DS.bind({link,engine:()=>r,phase:()=>r.status,lanes:1,laneAllowed:()=>allowed,crossCar:(i,t,held,o)=>r.cross(i,t,o),onFault:m=>faults.push(m)});
 link.feed(packet({n:1}));link.feed(packet({n:1,ticks:60000}));assert.equal(faults.length,0);assert.equal(r.cars[0].laps.length,0);
 allowed=true;at=100;link.feed(packet({n:40,marker:true}));at=5100;link.feed(packet({n:41}));assert.deepEqual(r.cars[0].laps,[5000]);b.off();
});


test('DS-300 routes a buffered eight-lane field without mixing counters or times',()=>{
 const h=harness({entries:Array.from({length:8},(_,lane)=>({lane}))});h.start();
 h.sendRaw(100,Buffer.concat(Array.from({length:8},(_,i)=>packet({lane:i+1,marker:true}))));
 h.sendRaw(10000,Buffer.concat(Array.from({length:8},(_,i)=>packet({lane:i+1,n:2,ticks:50000+i}))));
 assert.deepEqual(h.r.cars.map(c=>c.laps),Array.from({length:8},(_,i)=>[(50000+i)/10]));assert.equal(h.faults.length,0);
});
test('DS laps feed class and heat scoring without changing measured times',()=>{
 const M=require('../renderer/multiclass'),multiclass=M.clean({classes:[{id:'gt',name:'GT3'},{id:'proto',name:'Prototype'}]});
 const entries=[{lane:0,participant:0,driverId:'a',raceClass:'gt'},{lane:1,participant:1,driverId:'b',raceClass:'proto'}];
 const h=harness({laps:1,entries,multiclass,classPoints:[10,8]});h.start();h.send(100,{marker:true});h.send(100,{lane:2,marker:true});h.send(5100,{n:2});h.send(6100,{lane:2,n:2,ticks:60000});
 assert.deepEqual(h.r.classStandings().map(x=>[x.classPos,x.classPoints,x.car.best]),[[1,10,5000],[1,10,6000]]);
 const heat=E.createHeatRace({participants:entries,schedule:[entries.map((e,p)=>({p,lane:e.lane}))],lanes:2,resultBy:'points',points:[10,8],multiclass});heat.record(h.r);
 assert.deepEqual(heat.overall().map(x=>x.scorePoints),[10,8]);
});
test('DS laps continue after an endurance driver swap and frozen plugin rules use measured time',()=>{
 const En=require('../renderer/endurance'),Rules=require('../renderer/ruleplugin');
 const rulePlugin=Rules.snapshot({api:1,id:'test.rules',name:'Test',version:'1.0.0',digest:'a'.repeat(64),settings:{},plan:{lapTimeMs:{op:'if',args:[{op:'lt',args:[{var:'lapMs'},6000]},1000,0]}}});
 const h=harness({type:'timed',duration:600,endurance:En.clean({sessionType:'endurance',swapMode:'free',swapConfirm:'button'}),rulePlugin,entries:[{lane:0,driverId:'a',teamId:'t',roster:[{id:'a',name:'Alex'},{id:'b',name:'Bea'}]}]});h.start();h.send(100,{marker:true});h.send(5500,{n:2,ticks:50000});
 assert.equal(h.r.pluginTimeOf(h.r.cars[0]),1000);assert.equal(h.r.cars[0].best,5000);
 assert.equal(h.r.swap(0,5600).to,'b');h.send(10700,{n:3,ticks:50000});assert.equal(h.r.cars[0].driverId,'b');assert.deepEqual(h.r.cars[0].laps,[5000,5000]);assert.equal(h.faults.length,0);
});
