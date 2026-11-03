'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {Scalable,car,media}=require('../paddock-scalable'),{Paddock}=require('../paddock'),Database=require('../db');
const Client=require('../sqlite-client'),Repo=require('../sqlite-repository'),{SqlitePaddockStorage}=require('../paddock-storage');
const {migrateCopy}=require('../sqlite-migration'),{forkCopy}=require('../sqlite-working');
const seed=()=>JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/paddock/fixtures/profile-car-a.json')));
function photo(text='a'.repeat(300000)){const picture='data:image/png;base64,'+Buffer.from(text).toString('base64'),hash=crypto.createHash('sha256').update(picture).digest('hex');return {picture,ref:{hash,size:Buffer.byteLength(picture),mime:'image/png',encoding:'utf8-data-uri',url:'/v1/scalable/cars/car-a/media/'+hash}};}
function remote(){const p=seed();p.car.picture='';const pic=photo();let cursor='initial',changes=[],reset=false;const requests=[];
 const call=async route=>{requests.push(route);const base={version:1,databaseId:p.databaseId};
  if(route==='/v1/status')return {id:p.databaseId,name:'Scalable test host',revision:1,permissions:{timingResults:true},capabilities:{timing:{versions:[1]},scalable:{version:1,root:'/v1/scalable'}}};
  if(route.startsWith('/v1/scalable/changes'))return {...base,kind:'cars',resetRequired:reset,reason:reset?'configuration-dependency':null,cursor,entries:changes,more:false};
  if(route==='/v1/scalable/cars')return {...base,snapshot:cursor,cursor,cars:[car({...p.car,revision:p.configuration.carRevision,media:pic.ref})],nextOffset:null};
  if(route==='/v1/scalable/cars/car-a/profile')return {version:1,profile:structuredClone(p),media:pic.ref};
  if(route.startsWith(pic.ref.url)){const offset=Number(new URL('http://localhost'+route).searchParams.get('offset')),b=Buffer.from(pic.picture).subarray(offset,offset+262144);return {...base,hash:pic.ref.hash,size:pic.ref.size,offset,data:b.toString('base64'),nextOffset:offset+b.length===pic.ref.size?null:offset+b.length};}
  throw Error('Unexpected request '+route);
 };
 return {p,pic,requests,call,change(operation='invalidate'){cursor='next';changes=[{carId:'car-a',operation}];},reset(){reset=true;cursor='reset';}};
}
async function setup(t,kind){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'timing-scalable-')),file=path.join(dir,'source.json'),db=new Database(file);db.saveNow();const original=fs.readFileSync(file);let worker,repo;const work=path.join(dir,'work');
 if(kind==='sqlite'){migrateCopy({source:file,destination:path.join(dir,'copy')});forkCopy(path.join(dir,'copy'),work);worker=new Client();await worker.openWorking(work);repo=new Repo(worker);}
 const client=repo?new Paddock(null,{storage:new SqlitePaddockStorage(repo),deliveryStore:worker}):new Paddock(db),r=remote();client.hostRequest=(_b,route)=>r.call(route);await client.connect({address:'127.0.0.1:5001',code:'test'});clearTimeout(client.timer);
 t.after(async()=>{client.stop();await client.idle();await worker?.close();await db.writesIdle();if(repo)assert.deepEqual(fs.readFileSync(file),original);fs.rmSync(dir,{recursive:true,force:true});});
 return {client,r,db,worker,work,get:async id=>repo?(await repo.get('slotcars',id,true)).record.value:db.data.slotcars.find(c=>c.id===id)};
}
for(const kind of ['json','sqlite']){
 test(kind+': legacy linked photo survives extension upgrade without crossing the catalogue write boundary',async t=>{
  const {client,r,get}=await setup(t,kind);const old=client.scalable;client.scalable=null;const request=client.hostRequest;client.hostRequest=async(_b,route)=>route.startsWith('/v1/timing/cars/')?{...structuredClone(r.p),car:{...r.p.car,picture:r.pic.picture}}:r.call(route);
  const linked=await client.link('car-a');assert.equal((await get(linked.id)).paddock.mediaHash,undefined);client.scalable=old;client.hostRequest=request;
  const write=client.storage.catalogue.bind(client.storage);client.storage.catalogue=(...args)=>{assert(!JSON.stringify(args).includes(r.pic.picture));return write(...args);};await client.catalogue(true,false);client.code='';client.scalable=null;
  const view=await client.catalogue(false,false);assert.equal((await get(linked.id)).paddock.mediaHash,r.pic.ref.hash);assert.equal(await client.picture('car-a',view.cars[0].pictureKey),r.pic.picture);
 });
 test(kind+': metadata-only snapshot, lazy chunks, incremental invalidation and offline pinned captures',async t=>{
  const {client,r,get}=await setup(t,kind);let v=await client.catalogue(true,false);assert.equal(v.error,'');assert.equal(v.cars.length,1);assert(!r.requests.some(x=>x.includes('/media/')));assert(!JSON.stringify(await client.storage.cache()).includes(r.pic.picture));
  assert.equal(await client.picture('car-a',v.cars[0].pictureKey),r.pic.picture);assert.equal(r.requests.filter(x=>x.includes('/media/')).length,2);
  const linked=await client.link('car-a'),race=await client.prepare([linked.id]),pinned=structuredClone(race);const before=r.requests.length;
  r.p.car.name='Renamed';r.p.configuration.technical.motor='New motor';r.change();v=await client.catalogue(true,false);assert.equal(v.error,'');assert.equal(v.cars[0].name,'Renamed');assert(!r.requests.slice(before).some(x=>x==='/v1/scalable/cars'||x.includes('/media/')));assert.equal((await get(linked.id)).motor,'New motor');assert.deepEqual(race,pinned);
  r.p.configuration.technical.motor='Reset motor';r.reset();await client.catalogue(true,false);assert.equal((await get(linked.id)).motor,'Reset motor');
  client.code='';client.scalable=null;v=await client.catalogue(false,false);assert.equal(await client.picture('car-a',v.cars[0].pictureKey),r.pic.picture);assert.equal((await client.prepare([linked.id])).warnings.length,1);
 });
 test(kind+': failed transaction retains cursor and linked data; replay succeeds then removal archives',async t=>{
  const {client,r,get}=await setup(t,kind);await client.catalogue(true,false);const linked=await client.link('car-a'),cache=await client.storage.cache(),old=await get(linked.id);r.change();r.p.car.name='Retry change';const write=client.storage.catalogue.bind(client.storage);client.storage.catalogue=async()=>{throw Error('disk full');};
  let view=await client.catalogue(true,false);assert.match(view.error,/disk full/);assert.deepEqual(await client.storage.cache(),cache);assert.deepEqual(await get(linked.id),old);client.storage.catalogue=write;
  view=await client.catalogue(true,false);assert.equal(view.error,'');assert.equal((await client.storage.cache()).scalableCursor,'next');assert.equal((await get(linked.id)).paddock.name,'Retry change');
  r.change('remove');await client.catalogue(true,false);assert.equal((await get(linked.id)).paddock.archived,true);assert.equal((await client.storage.cache()).cars.length,0);await assert.rejects(client.prepare([linked.id]),/no longer available/);
 });
 test(kind+': metadata refresh stays photo-free; interrupted selection preserves offline image',async t=>{
  const {client,r,get}=await setup(t,kind);await client.catalogue(true,false);const linked=await client.link('car-a'),cache=await client.storage.cache();Object.assign(r.pic,photo('changed'.repeat(50000)));r.change();const call=r.call;r.call=async route=>{if(route.includes('/media/')&&route.includes('offset=262144'))throw Error('connection lost');return call(route);};
  const view=await client.catalogue(true,false);assert.equal(view.error,'');assert.equal((await client.storage.cache()).scalableCursor,'next');await assert.rejects(client.link('car-a'),/connection lost/);assert.notEqual((await get(linked.id)).picture,r.pic.picture);
  r.call=call;await client.link('car-a');assert.equal((await get(linked.id)).picture,r.pic.picture);
 });
}
test('chunk integrity, exact offsets, size and origin are enforced',async()=>{
 const r=remote();for(const mutate of [v=>({...v,offset:1}),v=>({...v,hash:'0'.repeat(64)}),v=>({...v,nextOffset:0}),v=>({...v,data:Buffer.alloc(262144).toString('base64')})]){
  const api=new Scalable(async route=>mutate(await r.call(route)),r.p.databaseId);await assert.rejects(api.picture(r.pic.ref),/Invalid Paddock/);assert.equal(api.photos.size,0);
 }
 assert.throws(()=>media({...r.pic.ref,url:'http://external.invalid/image'},'car-a'),/Invalid/);assert.throws(()=>media({...r.pic.ref,size:13*1024*1024},'car-a'),/Invalid/);
});
test('snapshot restart is bounded and partial pages are discarded',async()=>{
 const r=remote();let calls=0;const api=new Scalable(async()=>{calls++;if(calls===2)throw Object.assign(Error('changed'),{code:'SNAPSHOT_CHANGED'});const base=await r.call('/v1/scalable/cars');return {...base,nextOffset:calls===1?1:null};},r.p.databaseId);assert.equal((await api.listing()).cars.length,1);assert.equal(calls,3);
});
test('SQLite restart resumes the applied cursor, keeps offline photos and does not rewrite unchanged data',async t=>{
 const f=await setup(t,'sqlite');await f.client.catalogue(true,false);const linked=await f.client.link('car-a');f.client.stop();await f.worker.close();
 const worker=new Client();await worker.openWorking(f.work);const client=new Paddock(null,{storage:new SqlitePaddockStorage(new Repo(worker)),deliveryStore:worker});
 try{let view=await client.catalogue(false,false);assert.equal(await client.picture('car-a',view.cars[0].pictureKey),f.r.pic.picture);assert.equal((await client.prepare([linked.id])).warnings.length,1);
  client.hostRequest=(_b,route)=>f.r.call(route);await client.connect({address:'127.0.0.1:5001',code:'test'});clearTimeout(client.timer);const before=await client.storage.cache(),revision=(await client.connection()).revision,n=f.r.requests.length;
  await client.catalogue(true,false);assert.deepEqual(await client.storage.cache(),before);assert.equal((await client.connection()).revision,revision);assert.deepEqual(f.r.requests.slice(n),['/v1/status','/v1/scalable/changes?kind=cars&cursor=initial']);
 }finally{client.stop();await client.idle();await worker.close();}
});
test('archive hides selection, unarchive restores it, and race-time refresh sends no requests',async t=>{
 const {client,r,get}=await setup(t,'json');await client.catalogue(true,false);const linked=await client.link('car-a');r.p.car.archived=true;r.change();let view=await client.catalogue(true,false);assert.equal(view.error,'');assert.equal(view.cars.length,0);assert.equal((await get(linked.id)).paddock.archived,true);
 r.p.car.archived=false;view=await client.catalogue(true,false);assert.equal(view.cars.length,1);assert.equal((await get(linked.id)).paddock.archived,false);const n=r.requests.length;client.isRacing=()=>true;await client.catalogue(true,false);await client.picture('car-a',view.cars[0].pictureKey);assert.equal(r.requests.length,n);
});
test('old and unsaved hosts retain the original catalogue protocol',async t=>{
 const {client,r}=await setup(t,'json');const legacy={id:r.p.databaseId,revision:1,cars:[{...r.p.car,picture:r.pic.picture}],nextOffset:null};
 for(const advertised of [false,true]){client.hostRequest=async(_b,route)=>{if(route==='/v1/status'){const status=await r.call(route);if(!advertised)delete status.capabilities.scalable;return status;}if(route.startsWith('/v1/scalable'))throw Object.assign(Error('Save host first'),{code:'STORAGE_REQUIRED',httpStatus:409});if(route==='/v1/collection')return legacy;throw Error(route);};const view=await client.catalogue(true,false);assert.equal(view.error,'');assert.equal(view.cars.length,1);assert.equal(await client.picture('car-a',view.cars[0].pictureKey),r.pic.picture);}
});
test('database mismatch and malformed pages keep the last complete cache',async t=>{
 const {client,r}=await setup(t,'json');await client.catalogue(true,false);const before=await client.storage.cache(),call=r.call;r.call=async route=>route.includes('/changes')?{version:1,databaseId:'other'}:call(route);const view=await client.catalogue(true,false);assert.match(view.error,/identity changed/);assert.equal(client.code,'');assert.deepEqual(await client.storage.cache(),before);
 const api=new Scalable(async()=>({version:1,databaseId:r.p.databaseId,snapshot:'x',cursor:'x',cars:[car({...r.p.car,revision:1,media:null})],nextOffset:100}),r.p.databaseId);await assert.rejects(api.listing(),/Invalid/);
});
test('SQLite catalogue failure rolls back profile, class, photo hash and cursor atomically',async t=>{
 const f=await setup(t,'sqlite');await f.client.catalogue(true,false);const linked=await f.client.link('car-a'),before=await f.get(linked.id),cache=await f.client.storage.cache();await f.worker.close();
 const {WorkingStore}=require('../sqlite-working'),store=new WorkingStore(f.work,{checkpoint:p=>{if(p==='catalogue-written')throw Error('simulated disk full');}});
 try{const profile={...structuredClone(f.r.p),media:f.r.pic.ref};profile.car.name='Unsaved';profile.car.raceClass='Unsaved class';const revision=store.revision('slotcars',linked.id);
  assert.throws(()=>store.command({id:'failed-scalable',type:'applyPaddockCatalogue',databaseId:f.r.p.databaseId,expectedRevision:store.revision('@meta','paddock'),cache:{...cache,scalableCursor:'unsaved'},updates:[{recordId:linked.id,expectedRevision:revision,profile,preservePicture:true}]}),/disk full/);
  assert.deepEqual(store.get('slotcars',linked.id,true).value,before);assert.deepEqual(store.paddockRead('cache'),cache);assert.equal(store.statement("SELECT count(*) n FROM fields WHERE entity='raceclasses' AND json=?").get(JSON.stringify('Unsaved class')).n,0);
 }finally{store.close();}
});
test('native persisted Paddock host negotiates, refreshes deltas and verifies captures', {skip:!process.env.PADDOCK_SOURCE},async t=>{
 const root=process.env.PADDOCK_SOURCE,{Store}=require(path.join(root,'src/store.cjs')),A=require(path.join(root,'src/scalable-api.cjs')),T=require(path.join(root,'src/timing-integration.cjs'));
 const f=await setup(t,'sqlite'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'paddock-public-host-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const s=new Store(path.join(dir,'database.json'));s.replace(require(path.join(root,'tests/support/timing-fixtures.cjs')).fixtures().store.snapshot());
 // Exercise the real public projection against its SQLite database, never a user's host.
 f.client.hostRequest=async(_b,route)=>{if(route==='/v1/status')return {id:s.data.id,name:'Real Paddock',revision:s.data.revision,permissions:{timingResults:true},capabilities:{timing:{versions:[1]},scalable:A.capability}};try{return A.handle(s,'GET',new URL('http://localhost'+route),{browse:true,timingResults:true},s.data.id);}catch(e){e.code=e.apiCode;throw e;}};
 let v=await f.client.catalogue(true,false);assert.equal(v.error,'');assert.equal(v.cars.length,2);const linked=await f.client.link('car-a');T.verifyConfiguration(s.data,'car-a',(await f.client.prepare([linked.id])).captures[linked.id].configuration);
 s.mutate('car.save',{id:'car-a',revision:s.data.cars[0].revision,data:{name:'Real changed car',picture:f.r.pic.picture}});v=await f.client.catalogue(true,false);assert.equal(v.error,'');assert.equal(v.cars.find(c=>c.id==='car-a').name,'Real changed car');assert.equal(await f.client.picture('car-a',v.cars.find(c=>c.id==='car-a').pictureKey),f.r.pic.picture);await f.client.link('car-a');assert.equal((await f.get(linked.id)).picture,f.r.pic.picture);
 T.verifyConfiguration(s.data,'car-a',(await f.client.prepare([linked.id])).captures[linked.id].configuration);
});
