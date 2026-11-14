'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const engine=require('../vendor/slotforge-library'),{SharedLibraryClient}=require('../shared-library-client');
const {Store}=require('../vendor/slotforge-library/engine/src/store.cjs');
async function fixture(t,backend){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'timing-wishlist-')),profile=path.join(root,'private');fs.mkdirSync(profile);
 const db=new(require('../db'))(path.join(profile,'slotforge-timing.json'));db.data.paddock={sourceId:'timing-wishlist'};db.data.slotcars=[{id:'original',model:'Existing car',damageFactor:1.3}];
 db.data.sessions=[{id:'old-session',sessionType:'practice',date:'2026-10-01T12:00:00Z',trackId:'track',standings:[{carId:'original',laps:1}]}];db.data.laps=[{id:'old-lap',sessionId:'old-session',carId:'original',trackId:'track',lane:1,lapNumber:1,time:8000}];db.saveNow();const original=fs.readFileSync(db.file);
 let worker,storage,client;
 if(backend==='sqlite'){const copy=path.join(root,'copy'),work=path.join(root,'working');require('../sqlite-migration').migrateCopy({source:db.file,destination:copy});require('../sqlite-working').forkCopy(copy,work);worker=new(require('../sqlite-client'))();await worker.openWorking(work);storage=new(require('../paddock-storage').SqlitePaddockStorage)(new(require('../sqlite-repository'))(worker));}
 else storage=new(require('../paddock-storage').JsonPaddockStorage)(db);
 const options={installationId:'timing-wishlist',storage,sharedRoot:path.join(root,'shared'),legacyProfiles:[profile]};client=await SharedLibraryClient.open(options);
 const base=worker?new(require('../sqlite-app-repository'))(worker):new(require('../data-repository'))(db),records=require('../shared-library-records').wrap(base,client);
 t.after(async()=>{await client.close();await worker?.close();await db.writesIdle();if(worker)assert.deepEqual(fs.readFileSync(db.file),original);fs.rmSync(root,{recursive:true,force:true});});
 return {client,options,storage,base,records,db,worker,store:await Store.open((await client.status()).file)};
}
test('bundled wishlist support is qualified by capability; activation stays off and all manifest hashes match',()=>{
 const dir=path.join(__dirname,'../vendor/slotforge-library'),m=require('../vendor/slotforge-library/MANIFEST.json');
 assert.equal(require('../vendor/slotforge-library/engine/src/wishlist-activation.json').enabled,false);
 assert.equal(m.upstreamManifestSha256,'349d3a22d9cb85863b45fd80350680edd8fb8e817ea45c8af48413d077de8974');
 for(const f of m.files)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,f.path))).digest('hex'),f.sha256,f.path);
});
for(const backend of ['json','sqlite']){
 test(backend+': all car projections exclude wishes, purchase retains ID, restore invalidates selections and history survives',async t=>{
  const {client,records,store,options}=await fixture(t,backend),status=await client.status();assert.equal(status.capabilities.wishlistFiltering,1);
  const picture='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  store.mutate('car.save',{data:{name:'Wanted label only',ownership:'Wanted'}});
  const wish=store.mutate('car.save',{data:{name:'Wishlist GT',collectionStatus:'wishlist',picture,raceClass:'Wish class'}}).result;
  const canonical=client.canonicalId('original'),history=await client.handle.historyRead({kind:'sessions'});
  store.transact(db=>{const seed=db.cars.find(c=>c.id===wish);for(let i=0;i<104;i++)db.cars.push({...seed,id:'fixture-'+i,name:'Fixture '+String(i).padStart(3,'0'),collectionStatus:i%2?'wishlist':'collection',raceClass:''});});
  const count=54;let ids=[],cursor;do{const p=await records.catalogue('slotcars',{limit:48,cursor});ids.push(...p.items.map(x=>x.record.id));cursor=p.next;}while(cursor);
  assert.equal(ids.length,count);assert(!ids.includes(wish));assert(ids.includes('original'));
  const refs=await records.referencePage('slotcars',{limit:200});assert.equal(refs.items.length,count);assert(!refs.items.some(x=>x.id===wish));
  assert.equal((await records.list('slotcars')).length,count);assert.equal((await records.transferChoices('slotcars')).length,count);
  assert(!(await records.list('raceclasses')).some(x=>x.name==='Wish class'));
  assert.equal((await records.catalogue('slotcars',{search:'Wishlist GT'})).items.length,0);
  await assert.rejects(client.editor(wish),e=>e.code==='CAR_NOT_FOUND');await assert.rejects(records.get('slotcars',wish),e=>e.code==='CAR_NOT_FOUND');
  for(const action of ['patch','archive','restore'])await assert.rejects(client.handle.carWrite({databaseId:status.databaseId,recoveryId:status.recoveryId,operationId:'wish-'+action,action,carId:wish,expectedRevision:1,...(action==='patch'?{set:{name:'Not editable'}}:{})}),e=>e.code==='CAR_NOT_FOUND');
  await assert.rejects(records.raceInputs({trackId:'track',setup:{},championship:false,rows:[{carId:wish}]}),e=>e.code==='CAR_NOT_FOUND');await assert.rejects(client.prepare([wish]),e=>e.code==='CAR_WISHLIST');
  const before=await client.status(),checkpoint=store.snapshot(),page=await records.catalogue('slotcars',{limit:1});
  const captured=await client.prepare(['original']),frozen=structuredClone(captured);
  store.mutate('car.purchase',{id:wish,revision:1,confirmed:true});
  assert((await client.handle.changes({after:before.changeCursor})).entries.some(x=>x.carId===wish&&x.operation==='invalidate'));
  await assert.rejects(records.catalogue('slotcars',{limit:1,cursor:page.next}),e=>e.code==='QUERY_CHANGED'||/changed/i.test(e.message));
  assert.equal((await records.get('slotcars',wish)).picture,picture);assert((await records.list('raceclasses')).some(x=>x.name==='Wish class'));
  assert.equal((await client.prepare([wish])).captures[wish].configuration.carId,wish);assert.deepEqual(captured,frozen);
  const reopened=await SharedLibraryClient.open(options);try{assert.equal((await reopened.car(wish)).id,wish);assert.equal((await reopened.catalogue()).total,count+1);}finally{await reopened.close();}
  const purchased=await client.status();await store.restoreAsync(checkpoint,store.data.revision);
  assert.equal((await client.handle.changes({after:purchased.changeCursor})).resetRequired,true);
  assert.equal((await client.catalogue()).total,count);await assert.rejects(client.prepare([wish]),e=>e.code==='CAR_WISHLIST');
  const blocked=await client.handle.carWrite({databaseId:purchased.databaseId,recoveryId:purchased.recoveryId,operationId:'unsafe-old-write',action:'patch',carId:wish,expectedRevision:2,set:{name:'Wrong'}}).catch(e=>e);assert.equal(blocked.code,'RECOVERY_CHANGED');
  assert.equal(client.canonicalId('original'),canonical);const restored=await client.handle.historyRead({kind:'sessions'});
  assert.notEqual(restored.entries[0].resultToken,history.entries[0].resultToken); // Restore invalidates tokens, not evidence.
  const evidence=entries=>entries.map(({resultToken,...row})=>row);assert.deepEqual(evidence(restored.entries),evidence(history.entries));
  store.transact(db=>{db.cars.find(car=>car.id===canonical).collectionStatus='wishlist';});
  assert.deepEqual((await client.handle.historyRead({kind:'sessions'})).entries,restored.entries,'current membership never hides accepted history');
 });
 test(backend+': a rejected wishlist save is retained and not automatically retried',async t=>{
  const {client,storage}=await fixture(t,backend),s=await client.status();let calls=0;
  client.handle.carWrite=async()=>{calls++;throw Object.assign(Error('This car is on the Wishlist. Mark it purchased in Paddock before retrying.'),{code:'CAR_WISHLIST'});};
  const row=await client.save({...s,action:'create',set:{name:'Retained draft'}});assert.equal(row.state,'blocked');assert.equal(row.code,'CAR_WISHLIST');
  await client.recoverSaves();assert.equal(calls,1);assert.deepEqual((await storage.sharedRead({kind:'get',id:row.id})).request,row.request);
 });
 test(backend+': wishlist result rejection retains exact evidence until deliberate retry',async t=>{
  const {client,base,records,db,worker,store}=await fixture(t,backend),outbox=worker||new(require('../json-delivery-store'))(db),pump=new(require('../shared-library-delivery'))(client,outbox);
  t.after(()=>pump.close());const e=require('../tools/qa/rich-mapper-fixtures.cjs').evidence(),capture=await client.prepare(['original']);
  e.session.paddockJournal.captures.local=capture.captures.original;e.session.paddockJournal.sharedLibrary=capture.sharedLibrary;
  const id=await records.saveSession(e.session,e.laps),row=(await outbox.outbox(capture.sharedLibrary.databaseId,{status:'pending'}))[0],before=await outbox.deliverySnapshot(row.key,{engineOriginals:true});
  const carId=client.canonicalId('original');store.transact(db=>{db.cars.find(car=>car.id===carId).collectionStatus='wishlist';});
  const write=client.handle.historyWrite.bind(client.handle);let calls=0;client.handle.historyWrite=async(...args)=>{calls++;return write(...args);};
  await assert.rejects(pump.flush(),e=>e.code==='CAR_WISHLIST');assert.equal((await outbox.outbox(capture.sharedLibrary.databaseId))[0].status,'attention');
  await pump.flush();assert.equal(calls,1);const after=await outbox.deliverySnapshot(row.key,{engineOriginals:true});assert.deepEqual(after.payload,before.payload);assert.deepEqual(after.engineOriginals,before.engineOriginals);assert(await base.get('sessions',id));
  store.mutate('car.purchase',{id:carId,revision:store.data.cars.find(car=>car.id===carId).revision,confirmed:true});
  client.handle.historyWrite=write;await outbox.command({id:crypto.randomUUID(),type:'retryDelivery',deliveryKey:row.key,expectedHash:row.payloadHash});assert.equal((await pump.flush()).sent,1);assert.equal((await pump.flush()).sent,0);
 });
}
