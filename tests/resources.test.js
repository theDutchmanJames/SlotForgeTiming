const assert=require('assert/strict'),fs=require('fs'),path=require('path'),os=require('os');
const Res=require('../renderer/resources'),E=require('../renderer/engine'),T=require('../renderer/tyrewear'),W=require('../renderer/weather'),D=require('../renderer/damage'),Store=require('../resource-store'),Database=require('../db');
let passed=0;const test=async(name,fn)=>{await fn();passed++;console.log('ok '+name);};
const entry=(i=0)=>({lane:i,driverId:'d'+i,driverName:'Driver '+i,carId:'c'+i,carName:'Car '+i,teamId:'team',teamName:'Club team',tyre:'M'});
const profile=(x={})=>({id:'allocation',...Res.clean({owner:'car',tyres:{M:3,H:2,W:2,INT:2},...x})});
const state=(p=profile(),runId='run',ledger)=>Res.prepare(p,{runId,champId:'champ'},ledger);
const race=(s=state(),over={})=>E.createRace({type:'race',laps:100,entries:[entry()],fuel:{on:true,tank:100,perLap:1,rate:20,pitHold:1000},tyrewear:T.clean({changeSeconds:2,paceWear:'off',setsMode:'car',sets:{M:99}}),resources:s,resourceHeat:0,...over});
const pit=(r,t=10000)=>{r.block(0,t);r.tick(t+2500);};
const snap=(s,r)=>({v:1,race:{resources:structuredClone(s)},eng:r?r.snapshot(12000):{v:1},phase:'paused'});
(async()=>{
await test('tyre views use the resource allowance and ownership, including persisted initial stock',()=>{
 const r=race(state(profile({owner:'team',tyres:{M:5}})),{entries:[entry(),entry(1)]});r.start(0);
 let row=T.view(r,[0],0).rows[0];assert.equal(row.sets.M,3);assert.equal(row.setsStart.M,5);assert.equal(row.setsMode,'team');assert.equal(row.teamName,'Club team');assert.equal(row.teamDrivers.length,2);
 r.resources.profile.tyres.M=99;row=T.view(r,[0],0).rows[0];assert.equal(row.setsStart.M,5,'profile edits must not rewrite the original allocation');
 const legacy=T.view(race(null),[0],0).rows[0];assert.equal(legacy.setsStart.M,99);assert.equal(legacy.setsMode,'car');
 const driver=T.view(race(state(profile({owner:'driver'}))),[0],0).rows[0];assert.equal(driver.setsMode,'driver');assert.equal(driver.teamName,'');
});
await test('old races keep existing tyre set behaviour',()=>{const r=race(null);assert.equal(r.cars[0].twSets.M,98);assert.equal(r.resources,undefined);r.start(0);pit(r);assert.equal(r.cars[0].twSets.M,97);});
await test('resources replace rather than stack with tyre set limits',()=>{const r=race();assert.equal(r.resourceBalance(r.cars[0])['tyre:M'],3);assert.equal(r.resources.events.length,0);r.start(0);assert.equal(r.twOf(0,0).sets.M,2);pit(r);assert.equal(r.twOf(0,0).sets.M,1);assert.equal(r.cars[0].twStops,1);r.tick(20000);assert.equal(r.resources.events.length,2);});
await test('early exit and repeated ticks cannot spend another set',()=>{const r=race();r.start(0);r.block(0,10000);r.tick(11100);r.unblock(0,11500);assert.equal(r.resources.events.length,1);pit(r,20000);r.tick(30000);assert.equal(r.resources.events.length,2);});
await test('shared team starting grid preflight is atomic',()=>{const r=race(state(profile({owner:'team',tyres:{M:1}})),{entries:[entry(),entry(1)]});assert.equal(r.start(0),false);assert.equal(r.status,'ready');assert.equal(r.resources.events.length,0);assert.equal(r.resourceBalance(r.cars[0])['tyre:M'],1);assert(r.resourceAdjust(0,'tyre:M',1,'Extra starting set',0));r.start(0);assert.equal(r.status,'running');assert.equal(r.resourceBalance(r.cars[1])['tyre:M'],0);});
await test('a missing owner refuses a start without spending',()=>{const r=race(state(profile({owner:'team'})),{entries:[{...entry(),teamId:''}]});assert.equal(r.start(0),false);assert.match(r.resourceError,/team/);assert.equal(r.resources.events.length,0);});
await test('no available tyres means no fresh tyre and no mandatory-stop credit',()=>{const r=race(state(profile({tyres:{M:1}})));r.start(0);r.cars[0].twLife=25;pit(r);assert(r.cars[0].twLife<=25);assert.equal(r.cars[0].twStops,0);assert.equal(r.resources.events.length,1);assert.equal(r.cars[0].resourceBlocked,'tyre:M');});
await test('event allocation follows the owner through heat/lane changes',()=>{const s=state();const a=race(s);a.start(0);const b=race(s,{resourceHeat:1,entries:[{...entry(),lane:3}]});b.start(0);assert.equal(b.resourceBalance(b.cars[0])['tyre:M'],1);assert.equal(Object.keys(s.accounts).length,1);});
await test('race scope starts a new allocation for each heat',()=>{const s=state(profile({scope:'race'}));const a=race(s);a.start(0);const b=race(s,{resourceHeat:1});b.start(0);assert.equal(b.resourceBalance(b.cars[0])['tyre:M'],2);assert.equal(Object.keys(s.accounts).length,2);});
await test('team supply survives a driver change; driver supply follows the active driver',()=>{for(const owner of ['driver','team']){const r=race(state(profile({owner})));r.start(0);r.cars[0].driverId='relief';r.cars[0].driverName='Relief';pit(r);assert.equal(r.resourceBalance(r.cars[0])['tyre:M'],owner==='team'?1:2);}});
await test('restoring after a completed service preserves one charge',()=>{const s=state(),r=race(s);r.start(0);pit(r);const saved=r.snapshot(12500),copy=race(structuredClone(s));assert(copy.restore(saved));copy.resume(20000);copy.tick(21000);assert.equal(copy.resources.events.length,2);assert.equal(copy.resourceBalance(copy.cars[0])['tyre:M'],1);});
await test('pre-start recovery retains the prepared starting tyres',()=>{const r=race();r.resourceStart();const saved=r.snapshot(0),copy=race(state());assert(copy.restore(saved));assert.equal(copy.status,'ready');copy.start(100);assert.equal(copy.resources.events.length,1);});
await test('damage repair consumes a credit only at completion, then blocks when exhausted',()=>{const r=race(state(profile({tyresOn:false,repairsOn:true,repairs:1})),{tyrewear:null,damage:D.clean({levels:[{name:'Dent',from:1,seconds:2,action:'repair'}]})});r.start(0);r.addDamage(0,1,1000);r.block(0,10000);r.tick(11100);assert.equal(r.resourceBalance(r.cars[0]).repair,1);r.tick(12500);assert.equal(r.cars[0].dmg,0);assert.equal(r.resourceBalance(r.cars[0]).repair,0);r.unblock(0,13000);r.addDamage(0,1,14000);pit(r,20000);assert.equal(r.cars[0].dmg,1);assert.equal(r.cars[0].resourceBlocked,'damage');r.resourceAdjust(0,'repair',1,'Director allowance',23000);r.tick(24000);assert.equal(r.cars[0].dmg,0);assert.equal(r.resourceBalance(r.cars[0]).repair,0);});
await test('failure repair requires component and credit atomically',()=>{const r=race(state(profile({tyresOn:false,repairsOn:true,repairs:2,componentsOn:true,components:0})),{tyrewear:null,damage:D.clean({levels:[],failuresOn:'on',failures:[{name:'Motor',chance:0,action:'repair',seconds:2}],failMax:0})});r.start(0);assert(r.giveFailure(0,0,1000));pit(r);assert(r.cars[0].fail);assert.equal(r.resourceBalance(r.cars[0]).repair,2);r.resourceAdjust(0,'component',1,'Spare motor',13000);r.tick(14000);assert.equal(r.cars[0].fail,null);assert.equal(r.resourceBalance(r.cars[0]).repair,1);assert.equal(r.resourceBalance(r.cars[0]).component,0);});
await test('weather-only tyre changes also draw from stock',()=>{const r=race(state(),{tyrewear:null,weather:W.clean({startMode:'manual'})});r.start(0);r.wxSet('wet',5000,'director');pit(r);assert.equal(r.cars[0].tyre,'W');assert.equal(r.resourceBalance(r.cars[0])['tyre:W'],1);});
await test('custom compounds are counted with their stable compound code',()=>{const custom='C_1234567890ABCDEF',tyres={[custom]:{name:'Club slick',icon:'M',cls:'dry',wear:.125}};const r=race(state(profile({tyres:{[custom]:3}})),{entries:[{...entry(),tyre:custom}],tyrewear:T.clean({tyres,changeSeconds:2})});r.start(0);pit(r);assert.equal(r.resourceBalance(r.cars[0])['tyre:'+custom],1);assert.equal(r.cars[0].tyre,custom);});
await test('changing the fitted compound corrects stock once; it does not replenish tyre life',()=>{const r=race();r.start(0);r.cars[0].twLife=40;assert(r.setTyre(0,'H',1000));assert.equal(r.resourceBalance(r.cars[0])['tyre:M'],3);assert.equal(r.resourceBalance(r.cars[0])['tyre:H'],1);assert.equal(r.cars[0].twLife,40);assert.equal(r.setTyre(0,'H',2000),false);});
await test('director adjustments require a reason, integer amount and nonnegative resulting balance',()=>{const r=race();assert(!r.resourceAdjust(0,'tyre:M',1,''));assert(!r.resourceAdjust(0,'tyre:M',.5,'test'));assert(!r.resourceAdjust(0,'tyre:M',-4,'test'));assert(!r.resourceAdjust(0,'repair',2,'disabled'));assert(r.resourceAdjust(0,'tyre:M',2,'Supplied extra'));assert.equal(r.resourceBalance(r.cars[0])['tyre:M'],5);});
await test('championship scope requires a loaded championship',()=>assert.throws(()=>Res.prepare(profile({scope:'championship'}),{runId:'x'}),/championship/));
await test('the production start waits for storage and respects cancellation or a hardware fault during that wait',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../renderer/race.js'),'utf8'),from=source.indexOf('  const goRunning = async'),to=source.indexOf('  const startTimers',from),vm=require('vm');assert(from>=0&&to>from);
 for(const interrupt of [false,true]){
  let release;const gate=new Promise(r=>release=r),calls=[],context={live:{alive:true,phase:'countdown',runId:1},resourceState:{},eng:{resourceStart:()=>true,start:()=>calls.push('start')},checkpoint:()=>gate,now:()=>100,power:on=>calls.push('power:'+on),update:()=>{},startTimers:()=>{},startSim:()=>{}};
  const start=vm.runInNewContext(source.slice(from,to)+'\ngoRunning;',context),pending=start();assert.equal(calls.length,0);
  if(interrupt){context.live.runId++;context.live.phase='ready';}
  release(true);await pending;assert.deepEqual(calls,interrupt?[]:['start','power:true']);
 }
});
await test('two blocked jobs warn once each, without an event flood on every tick',()=>{
 const A=require('../renderer/announcer'),r=race(state(profile({tyresOn:false,repairsOn:true,repairs:0,componentsOn:true,components:0})),{tyrewear:null,damage:D.clean({levels:[{name:'Dent',from:1,seconds:2,action:'repair'}],failuresOn:'on',failures:[{name:'Motor',chance:0,seconds:2}],failMax:0})});
 r.start(0);const observer=A.create({calls:{resourceblocked:{on:true}}});observer.observe(r,{phase:'running',now:0});r.addDamage(0,1,1000);r.giveFailure(0,0,2000);pit(r);for(let t=13000;t<20000;t+=100)r.tick(t);
 const events=r.events.filter(e=>e.type==='resourceblocked');assert.equal(events.length,2);assert.deepEqual(events[1].missing,['repair','component']);
 const calls=observer.observe(r,{phase:'running',now:20000}).filter(e=>e.call==='resourceblocked');assert.equal(calls.length,2);assert.equal(calls[1].vars.resource,'repair credits and replacement components');assert.equal(observer.observe(r,{phase:'running',now:20100}).filter(e=>e.call==='resourceblocked').length,0);
});
await test('durable ledger is idempotent, atomic with recovery, and survives database reload',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sft-resources-')),file=path.join(dir,'db.json'),db=new Database(file);db.bg=true;
 const p=db.add('resourcesystems',profile({scope:'championship'}));await db.saved();const store=new Store(db),s=await store.begin(p.id,{runId:'a',champId:'c'}),r=race(s);r.start(0);pit(r);await store.save(snap(s,r));await store.save(snap(s,r));
 let l=await store.read();assert.equal(l.history.length,2);assert.equal(Object.values(l.accounts)[0].balance['tyre:M'],1);assert.equal(l.checkpoint.race.resources.events.length,2);
 const disk=JSON.parse(fs.readFileSync(file));assert.equal(disk.resourceLedger.history.length,2);assert.equal(disk.resourceLedger.checkpoint.race.resources.events.length,2);
 const ids=await Promise.all([store.saveSession({resourceRunId:s.runId,standings:[]},[]),store.saveSession({resourceRunId:s.runId,standings:[]},[])]);assert.equal(ids[0],ids[1]);assert.equal(db.list('sessions').filter(x=>x.resourceRunId===s.runId).length,1);
 db.removeSession(ids[0]);await db.saved();assert.equal((await store.read()).history.length,2,'deleting results does not refund consumed resources');
 await assert.rejects(store.begin(p.id,{runId:'b',champId:'c'}),/unfinished/);
 const commit=db.commit.bind(db);r.resourceAdjust(0,'tyre:M',1,'Extra set',14000);db.commit=()=>Promise.reject(Error('Disk full'));
 await assert.rejects(store.save(snap(s,r)),/Disk full/);assert.equal((await store.read()).history.length,2);assert.equal((await store.read()).checkpoint.race.resources.events.length,2);db.commit=commit;
 await store.save(snap(s,r));await store.clear();l=await store.read();assert.equal(l.checkpoint,null);assert.equal(l.history.length,3);await assert.rejects(store.save(snap(s,r)),/ended/);
 const next=await store.begin(p.id,{runId:'b',champId:'c'}),n=race(next);n.start(0);assert.equal(n.resourceBalance(n.cars[0])['tyre:M'],1);await store.save(snap(next,n));await store.clear();
 const other=await store.begin(p.id,{runId:'z',champId:'new-champ'}),fresh=race(other);fresh.start(0);assert.equal(fresh.resourceBalance(fresh.cars[0])['tyre:M'],2);
 // Editing a limit does not refill an existing championship account.
 db.update('resourcesystems',p.id,{tyres:{M:99}});await db.saved();const edited=await store.begin(p.id,{runId:'d',champId:'c'});assert.equal(Res.available(edited,entry(),0,'tyre:M'),1);
});
console.log(`${passed} resource integration groups passed`);
})().catch(e=>{console.error(e);process.exitCode=1;});
