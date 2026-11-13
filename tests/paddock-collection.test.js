'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const Database=require('../db'),{Paddock}=require('../paddock'),{JsonPaddockStorage,SqlitePaddockStorage}=require('../paddock-storage'),Client=require('../sqlite-client'),Repo=require('../sqlite-repository');
const source=process.env.SLOTFORGE_PADDOCK_SOURCE||path.resolve(__dirname,'../../../SlotForge Slotcar Database');
const hostAvailable=fs.existsSync(path.join(source,'src/local-library.cjs'));
const photo='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF1sAAAAASUVORK5CYII=';
async function approveCollection(store,kind){const q=require(path.join(source,'src/sqlite-query.cjs')),view=q.read(store,null,r=>require(path.join(source,'src/timing-collection-review.cjs')).inbox(r,true)).value;const items=view.rows.filter(r=>r.kind===kind);assert(items.length);const result=await require(path.join(source,'src/domain-tasks.cjs')).run(store,{kind:'timing-collection-review',input:{databaseId:view.databaseId,recoveryId:view.recoveryId,action:'approve',note:'Owner reviewed initial collection',items}});assert(result.results.every(r=>r.status==='approved'),JSON.stringify(result));}
async function fixture(t,kind){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'timing-first-')),file=path.join(dir,'timing.json');let db=new Database(file);
 db.data.slotcars=[{id:'old-car',brand:'NSR',model:'Old GT3',reference:'0143',picture:photo,damageFactor:1.3,custom:{club:'keep'},lapsDriven:123}];
 db.data.sessions=[{id:'old-session',date:'2018-03-03',setupName:'Years before Paddock',sessionType:'race',trackId:'old-track',trackName:'Original track',standings:[{carId:'old-car',driverName:'Original driver',laps:2,pos:1}]}];
 db.data.laps=[1,2].map(n=>({id:'old-lap-'+n,sessionId:'old-session',carId:'old-car',driverId:'driver',lane:1,heat:1,lapNumber:n,time:8000+n,valid:true,pit:false}));
 db.saveNow();db=new Database(file);db.saveNow();const originals=structuredClone({sessions:db.data.sessions,laps:db.data.laps}),bytes=fs.readFileSync(file);
 let worker,p,store,host;
 if(kind==='sqlite'){require('../sqlite-migration').migrateCopy({source:file,destination:path.join(dir,'copy')});require('../sqlite-working').forkCopy(path.join(dir,'copy'),path.join(dir,'work'));worker=new Client();await worker.openWorking(path.join(dir,'work'));}
 p=worker?new Paddock(null,{storage:new SqlitePaddockStorage(new Repo(worker)),deliveryStore:worker}):new Paddock(db);
 const timers=()=>{clearTimeout(p.timer);clearTimeout(p.localTimer);};
 t.after(async()=>{p.stop();await p.idle();await worker?.close();if(host){host.quiesce();await host.idle();host.close();}await db.writesIdle();if(kind==='sqlite')assert.deepEqual(fs.readFileSync(file),bytes);fs.rmSync(dir,{recursive:true,force:true});});
 async function startHost(){
  const {Store}=require(path.join(source,'src/store.cjs')),{LocalLibrary}=require(path.join(source,'src/local-library.cjs'));
  fs.mkdirSync(path.join(dir,'host'),{recursive:true});store=new Store(path.join(dir,'host','db.sqlite'));store.persist(store.data);
  host=new LocalLibrary({store,profile:path.join(dir,'host'),folder:path.join(dir,'discovery')});await host.start();assert.equal(host.error,'');
  p.localScan=()=>require('../paddock-local-discovery').scan({folder:host.folder});p.launcherScan=async()=>[];
  await p.startSharedLibrary();timers();assert.equal((await p.connection()).connection.databaseId,store.data.id);
 }
 async function reopen(){timers();if(worker){await worker.close();worker=new Client();await worker.openWorking(path.join(dir,'work'));p.storage=new SqlitePaddockStorage(new Repo(worker));p.deliveryStore=worker;}else{await p.storage.db.writesIdle();p.storage=new JsonPaddockStorage(new Database(file));}}
 async function tick(){await p.syncLocalTransfers();await p.syncCollectionMigration();await p.syncHistoricalReviews();timers();}
 async function car(){return worker?(await worker.snapshot('slotcars','old-car',true)).record.value:p.storage.db.data.slotcars[0];}
 async function unchanged(){assert.deepEqual(worker?(await worker.snapshot('sessions','old-session',true)).record.value:p.storage.db.data.sessions[0],originals.sessions[0]);for(const lap of originals.laps)assert.deepEqual(worker?(await worker.snapshot('laps',lap.id,true)).record.value:p.storage.db.data.laps.find(l=>l.id===lap.id),lap);}
 async function fake(){await p.storage.setConnection({mode:'local',automatic:true,databaseId:'collection',address:'http://127.0.0.1:5001',name:'Synthetic',localKey:'b'.repeat(64)+'.json',results:true,timing:true,historyGuard:{version:1,databaseId:'collection',recoveryId:'recovery'}},(await p.connection()).revision);}
 return {p,db,dir,originals,startHost,get store(){return store;},get host(){return host;},timers,reopen,tick,car,unchanged,fake};
}
for(const kind of ['json','sqlite']){
 test(kind+': Timing first, then clean Paddock; approved cars and genuinely old laps associate without invented captures',{skip:!hostAvailable,timeout:45000},async t=>{
  const f=await fixture(t,kind);assert.equal((await f.car()).paddock,undefined);await f.startHost();assert.equal(f.store.data.cars.length,0);
  const preview=await f.p.collectionMigration({action:'preview'});assert.equal(preview.cars.length,1);assert.equal(preview.laps,2);assert.equal(preview.cars[0].matches.length,0);assert(!JSON.stringify(preview).includes('base64'));
  await f.p.collectionMigration({action:'start',revision:preview.revision});f.timers();await f.tick();await f.tick();
  let transfers=await f.p.localTransfers();assert.equal(transfers.length,1);assert.equal(transfers[0].state,'pending');assert.equal((await f.p.historicalReview({action:'list'})).length,0);
  await f.reopen();await f.p.collectionMigration({action:'start',revision:preview.revision});f.timers();await f.tick();assert.equal((await f.p.localTransfers()).length,1);
  const row=await f.p.storage.localRead({kind:'get',id:transfers[0].id});
  await approveCollection(f.store,'car');
  await f.tick();await f.tick();const c=await f.car();assert.equal(c.id,'old-car');assert.equal(c.damageFactor,1.3);assert.equal(c.custom.club,'keep');assert.equal(f.store.data.cars[0].picture,photo);
  const imports=await f.p.historicalReview({action:'list'});assert.equal(imports.length,1,JSON.stringify(await f.p.collectionMigration({action:'status'})));assert.equal(imports[0].state,'pending',imports[0].error);
  const frozen=await f.p.storage.historicalRead({kind:'get',id:imports[0].id,full:true}),participant=frozen.request.items[0].bundle.race.participants[0];
  assert.equal(participant.carId,c.paddock.carId);assert.equal(participant.configuration,null);assert.equal(participant.laps[0].personalRecordEligible,false);assert.equal(participant.laps[0].trackRecordEligible,false);assert.equal(participant.laps[0].distanceM,null);assert.deepEqual(frozen.evidence,{session:f.originals.sessions[0],laps:f.originals.laps});
  assert.equal(f.store.data.timing.sessions.length,0);const pending=f.store.data.timing.imports[0];
  await approveCollection(f.store,'history');
  await f.p.historicalReview({action:'refresh',id:imports[0].id});await f.tick();await f.reopen();await f.tick();await f.tick();
  const status=await f.p.collectionMigration({action:'status'});assert.equal(status.plan.state,'complete');assert.equal(status.plan.counts.sessions.complete,1);assert.equal(f.store.data.cars.length,1);assert.equal(f.store.data.timing.sessions.length,1);
  const stats=require(path.join(source,'src/shared-history-read.cjs')).read(f.store,'http://localhost/v1/shared-history/cars/'+c.paddock.carId+'/statistics');assert.equal(stats.historicalSessions,1,JSON.stringify(stats));await f.unchanged();
 });
 test(kind+': plan save, pause, restore block and photo-free preview preserve originals',async t=>{
  const f=await fixture(t,kind);await f.fake();const preview=await f.p.storage.collectionRead({kind:'preview'});
  const first=await f.p.storage.collectionChange({action:'start',revision:preview.revision});await f.reopen();assert.equal((await f.p.storage.collectionChange({action:'start',revision:'stale'})).id,first.id);
  await f.p.storage.collectionChange({action:'pause'});await f.p.syncCollectionMigration();assert.equal((await f.p.localTransfers()).length,0);
  const conn=await f.p.connection();await f.p.storage.setConnection({...conn.connection,historyGuard:{...conn.connection.historyGuard,recoveryId:'restored'}},conn.revision);
  await assert.rejects(f.p.storage.collectionChange({action:'resume'}),/restored/);
  await f.p.storage.collectionChange({action:'block',error:'Restored library requires review'});await f.reopen();assert.equal((await f.p.storage.collectionRead({kind:'status'})).plan.state,'blocked');await f.unchanged();
 });
}
test('possible identical-model matches require an explicit physical-car decision',()=>{
 const M=require('../paddock-collection-store');let row;const a={connection:()=>({mode:'local',databaseId:'db',historyGuard:{recoveryId:'r'}}),source:()=> 'source',catalog:()=>({cars:[{id:'remote',name:'Same model',model:'GT3',revision:1}]}),inventory:()=>({cars:[{id:'local',model:'GT3'}],sessions:[],laps:0}),get:()=>row,put:r=>row=r};
 const p=M.read(a,{kind:'preview'});assert.equal(p.cars[0].matches.length,1);assert.throws(()=>M.change(a,{action:'start',revision:p.revision}),/possible match/);M.change(a,{action:'start',revision:p.revision,choices:{local:{action:'create'}}});assert.equal(Object.values(row.items)[0].target,undefined);
});
test('migration progress distinguishes approval, exclusions and untouched originals',()=>{
 const html=require('../renderer/paddockcollection').progress({state:'running',counts:{cars:{linked:1},sessions:{queued:2}},items:[{name:'<car>',error:'Kept local'}]});assert.match(html,/Received or pending does not mean accepted/);assert.match(html,/&lt;car&gt;/);assert.match(html,/Review → Timing collection/);
});
