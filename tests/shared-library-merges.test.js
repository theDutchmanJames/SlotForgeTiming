'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fixture=require('./support/shared-library-merge-fixture');
const source='../vendor/slotforge-library/engine/src/';
async function merged(f,{includeHistory=true}={}){
 const {client}=f,s=await client.status(),sourceId=client.installationId,old=client.canonicalId('old-car');
 const main=await client.handle.adoptCar({...s,sourceId,operationId:'main-adoption',originalId:'main-original',data:{name:'Main'},rawOriginal:{damageFactor:2,failureFactor:1,tyreCompound:'M'}});
 const host=require(source+'car-merge-storage.cjs').openHost(s.file);let n=0;
 function envelope(action,payload){return {databaseId:s.databaseId,recoveryId:s.recoveryId,sourceId:'reviewer',operationId:'merge-fixture-'+ ++n,action,payload};}
 let p=host.command(envelope('create',{mainCarId:main.carId,retiredCarId:old})).result;
 assert.equal((await client.catalogue({})).total,2);assert.equal(host.read().mergeProposals.find(x=>x.id===p.id).status,'pending');
 const choices=structuredClone(p.choices);for(const key of Object.keys(choices.history))choices.history[key]=includeHistory;choices.settings[JSON.stringify([sourceId,'damageFactor'])]=JSON.stringify(['incoming',require(source+'car-merge-settings.cjs').states(host.read(),old,sourceId)[0].key]);
 p=host.command(envelope('save',{id:p.id,expectedRevision:p.revision,choices})).result;
 const request=envelope('approve',{id:p.id,expectedRevision:p.revision}),approved=host.command(request),again=host.command(request);
 assert.equal(again.duplicate,true);assert.deepEqual(again.result,approved.result);
 const saved=host.read().mergeProposals.find(x=>x.id===p.id);assert.equal(require(source+'portable-backup.cjs').verify(saved.backup.path).digest,saved.backup.digest);assert.equal(host.read().schema,11);
 await client.merges.refresh();return {main:main.carId,old,host,command:(action,payload)=>host.command(envelope(action,payload)).result};
}
for(const backend of ['json','sqlite']){
 test(backend+': published legacy optional fixtures preserve each original and reject undocumented representations',async t=>{
  const {client}=await fixture(t,backend),cases=require('../vendor/slotforge-library/merge-contract/fixtures/legacy-optionals.json');let index=0;
  for(const item of [...cases.cases,...cases.rejectedOriginalRepresentations.map(original=>({original,reject:true}))]){
   const originalId='legacy-case-'+index++,s=await client.status();await client.handle.adoptCar({...s,sourceId:client.installationId,operationId:originalId,originalId,data:{name:originalId},rawOriginal:item.original});await client.merges.refresh();
   const before=await client.original(originalId);if(item.reject)await assert.rejects(client.currentSettings(originalId),{code:'INVALID_FIELD'});else{const b=await client.currentSettings(originalId);assert.deepEqual(b.fields,item.fields);assert.deepEqual(b.effective,item.effective);assert.deepEqual((await client.editor(originalId)).timing.values,item.fields);}
   assert.deepEqual(await client.original(originalId),before);
  }
 });
 test(backend+': cursor-only settings changes refresh effective values and preserve other-source bindings',async t=>{
  const f=await fixture(t,backend),{client,peer}=f,{main}=await merged(f),binding=await client.currentSettings(main),before=await client.status(),car=await client.car(main);
  await client.handle.timingSettingsWrite({databaseId:before.databaseId,recoveryId:before.recoveryId,operationId:'cursor-settings',sourceId:client.installationId,carId:main,action:'patch',expectedRevision:binding.revision,expectedBindingToken:binding.bindingToken,set:{damageFactor:0,serviceInterval:null,tyreCompound:'custom-dry'}});
  const delta=await client.handle.changes({kind:'cars',after:before.changeCursor});assert.deepEqual(delta.entries,[]);assert.notEqual(delta.cursor,before.changeCursor);assert.equal((await client.car(main)).revision,car.revision);
  const current=await client.currentSettings(main);assert.equal(current.effective.damageFactor,0);assert.equal(current.effective.serviceInterval,null);assert.equal(current.effective.tyreCompound,'custom-dry');assert.equal(client.merges.generation.revision,(await client.status()).revision);
  const other=await peer.timingSettings({sourceId:'paddock-test',carId:main});await peer.timingSettingsWrite({databaseId:before.databaseId,recoveryId:before.recoveryId,operationId:'other-source-settings',sourceId:'paddock-test',carId:main,action:'patch',expectedRevision:other.revision,expectedBindingToken:other.bindingToken,set:{damageFactor:4,failureFactor:0}});
  assert.equal((await peer.timingSettings({sourceId:'paddock-test',carId:main})).effective.damageFactor,4);assert.equal((await client.currentSettings(main)).effective.damageFactor,0);
  await assert.rejects(client.stateSave('timingSettingsWrite',{sourceId:'paddock-test'}),{code:'SOURCE_MISMATCH'});
 });
 test(backend+': joint fixture late delivery retains frozen identity, pending inclusion and one accepted result',async t=>{
  const f=await fixture(t,backend),{client,worker,db}=f,repo=worker?new(require('../sqlite-app-repository'))(worker):new(require('../data-repository'))(db),outbox=worker||new(require('../json-delivery-store'))(db);
  const pump=new(require('../shared-library-delivery'))(client,outbox),e=require('../tools/qa/rich-mapper-fixtures.cjs').evidence(),captured=await client.prepare(['old-car']);t.after(()=>pump.close());
  e.session.paddockJournal.captures={'old-car':captured.captures['old-car']};e.session.paddockJournal.sharedLibrary=captured.sharedLibrary;
  e.session.paddockJournal.heats.forEach(h=>h.entries.forEach(x=>x.carId='old-car'));e.session.standings.forEach(x=>x.carId='old-car');e.laps.forEach(x=>x.carId='old-car');
  const sid=await repo.saveSession(e.session,e.laps),pending=(await outbox.outbox(captured.sharedLibrary.databaseId,{status:'pending'}))[0],snap=await outbox.deliverySnapshot(pending.key,{engineOriginals:true}),originalOperations=structuredClone(snap.guard.operations),ids=await merged(f);
  let writes=0;const write=client.handle.historyWrite;client.handle.historyWrite=async input=>{writes++;await write(input);throw Error('late reply lost');};
  await assert.rejects(pump.flush(),/late reply lost/);client.handle.historyWrite=write;
  const intake=ids.host.read().mergeInclusions.filter(i=>i.late);assert(intake.length>0);assert(intake.every(i=>i.status==='pending'));const intakeIds=intake.map(i=>i.id);
  await outbox.command({id:require('node:crypto').randomUUID(),type:'retryDelivery',deliveryKey:pending.key,expectedHash:pending.payloadHash});assert.equal((await pump.flush()).sent,1);assert.equal(writes,1);assert.equal((await pump.flush()).sent,0);
  assert.deepEqual(ids.host.read().mergeInclusions.filter(i=>i.late).map(i=>i.id),intakeIds);
  assert.deepEqual((await outbox.deliverySnapshot(pending.key,{engineOriginals:true})).guard.operations,originalOperations);
  const rows=await client.contributions({sourceId:client.installationId,sessionId:sid});assert(rows.rows.length);assert(rows.rows.every(r=>r.originalCarId===ids.old&&r.canonicalCarId===ids.main&&r.status==='pending'));
  const sessions=await client.handle.historyRead({kind:'sessions'});assert.equal(sessions.entries.filter(r=>r.sessionId===sid).length,1);assert.equal((await client.handle.timingRead({kind:'carStatistics',carId:ids.main})).summary.recordedLaps,0);
  const reread=await repo.get('sessions',sid);assert.equal(reread.paddockJournal.captures['old-car'].configuration.carId,ids.old);
  // Correction/withdrawal use the same source/session, never recapture main.
  const lap=(await repo.list('laps')).find(l=>l.sessionId===sid);await repo.update('laps',lap.id,{noTrackRecord:true});assert.equal((await pump.flush()).sent,1);
  const corrected=ids.host.read().mergeInclusions.filter(i=>i.late);assert(corrected.some(i=>i.revision>intake.find(x=>x.id===i.id).revision));
  const records=require('../shared-library-records').wrap(repo,client),globalBefore=await records.historyPage('racing');
  for(const i of corrected)assert.equal(ids.command('includeHistory',{id:i.id,expectedRevision:i.revision,include:true}).status,'included');
  assert((await client.handle.timingRead({kind:'carStatistics',carId:ids.main})).summary.recordedLaps>0);
  const globalAfter=await records.historyPage('racing');
  await repo.removeSession(sid);assert.equal((await pump.flush()).sent,1);assert.equal((await client.handle.historyRead({kind:'sessions',state:'withdrawn'})).entries.find(r=>r.sessionId===sid).accepted.state,'withdrawn');
  assert.equal((await client.handle.timingRead({kind:'carStatistics',carId:ids.main})).summary.recordedLaps,0);
  assert.deepEqual(globalAfter.tracks.items,globalBefore.tracks.items);assert.deepEqual(globalAfter.personal.items,globalBefore.personal.items);
 });
 test(backend+': joint fixture actual restore discards effective mapping cache and blocks retained post-merge intent',async t=>{
  const f=await fixture(t,backend),{client,storage,options}=f,path=require('node:path'),before=await client.status(),backup=path.join(path.dirname(options.sharedRoot),'pre-merge.sfpbackup');
  await client.handle.backup({databaseId:before.databaseId,recoveryId:before.recoveryId,revision:before.revision,destination:backup});const ids=await merged(f),b=await client.currentSettings('main-original');
  const write=client.handle.timingSettingsWrite;client.handle.timingSettingsWrite=async()=>{throw Error('lost before write');};const pending=await client.stateSave('timingSettingsWrite',{databaseId:before.databaseId,recoveryId:before.recoveryId,carId:ids.main,action:'patch',expectedRevision:b.revision,expectedBindingToken:b.bindingToken,set:{failureFactor:0}});client.handle.timingSettingsWrite=write;assert.equal(pending.state,'pending');
  const request=structuredClone((await storage.sharedRead({kind:'get',id:pending.id})).request),now=await client.status();
  const result=await client.handle.restore({databaseId:now.databaseId,recoveryId:now.recoveryId,revision:now.revision,operationId:'restore-joint-fixture',source:backup});assert.notEqual(result.recoveryId,before.recoveryId);
  const restored=await client.currentSettings('old-car');assert.equal(restored.carId,ids.old);assert.equal(client.merges.edges.size,0);assert.equal((await client.retry(pending.id)).code,'RECOVERY_CHANGED');assert.deepEqual((await storage.sharedRead({kind:'get',id:pending.id})).request,request);
  const reopened=await require('../shared-library-client').SharedLibraryClient.open(options);try{assert.equal((await reopened.currentSettings('old-car')).carId,ids.old);assert.equal((await reopened.catalogue({})).total,1);}finally{await reopened.close();}
 });
 test(backend+': joint fixture old SQL handles cannot write after merge while compatible settings still commit',async t=>{
  const f=await fixture(t,backend),{client}=f,s=await client.status(),{DatabaseSync}=require('node:sqlite'),old=new DatabaseSync(s.file);
  try{await merged(f);assert.throws(()=>old.exec("UPDATE state SET value=value WHERE key='change_sequence'"),/MERGE_ENGINE_REQUIRED/);}finally{old.close();}
  const newlyOpened=new DatabaseSync(s.file);try{assert.throws(()=>newlyOpened.exec("UPDATE state SET value=value WHERE key='change_sequence'"),/MERGE_ENGINE_REQUIRED/);}finally{newlyOpened.close();}
  const b=await client.currentSettings('main-original'),current=await client.status(),saved=await client.stateSave('timingSettingsWrite',{databaseId:current.databaseId,recoveryId:current.recoveryId,carId:b.carId,action:'patch',expectedRevision:b.revision,expectedBindingToken:b.bindingToken,set:{failureFactor:0}});assert.equal(saved.state,'committed');
 });
 test(backend+': legacy blank optional settings project to clears without altering originals or relaxing new writes',async t=>{
  const {client}=await fixture(t,backend,d=>Object.assign(d.slotcars[0],{serviceInterval:'',damageFactor:'',failureFactor:''}));
  const before=await client.original('old-car');assert.equal(before.value.serviceInterval,'');
  const binding=await client.currentSettings('old-car');assert.deepEqual(binding.fields,{serviceInterval:null,damageFactor:null,failureFactor:null});assert.deepEqual(binding.effective,{tyreCompound:'M',damageFactor:1,failureFactor:1,serviceInterval:null});
  const editor=await client.editor('old-car');assert.equal(editor.timing.values.serviceInterval,null);assert.equal((await client.catalogue({})).total,1);
  const status=await client.status();await assert.rejects(client.handle.timingSettingsWrite({databaseId:status.databaseId,recoveryId:status.recoveryId,sourceId:client.installationId,operationId:'reject-new-blank',action:'patch',carId:binding.carId,expectedRevision:binding.revision,expectedBindingToken:binding.bindingToken,set:{damageFactor:''}}),{code:'INVALID_FIELD'});
  assert.deepEqual(await client.original('old-car'),before);
 });
 test(backend+': excluded old history remains in normal global Results and records',async t=>{
  const f=await fixture(t,backend,d=>{d.drivers=[{id:'driver',name:'James'}];d.tracks=[{id:'track',name:'Club',length:25}];d.sessions=[{id:'race',sessionType:'race',setupName:'Old race',trackId:'track',trackName:'Club',date:'2026-11-01T12:00:00.000Z',standings:[{carId:'old-car',driverId:'driver',driverName:'James',carName:'Historic',laps:1,total:6000,best:6000,pos:1}]}];d.laps=[{id:'lap',sessionId:'race',trackId:'track',carId:'old-car',driverId:'driver',lane:1,lapNumber:1,time:6000,date:'2026-11-01T12:00:00.000Z'}];});
  const {client,worker,db}=f,base=worker?new(require('../sqlite-app-repository'))(worker):new(require('../data-repository'))(db),records=require('../shared-library-records').wrap(base,client),before=await records.historyPage('racing');
  const ids=await merged(f,{includeHistory:false}),page=await records.historyPage('racing');assert.deepEqual(page.tracks.items,before.tracks.items);assert.deepEqual(page.personal.items,before.personal.items);assert.equal(page.sessions.items.length,1);
  const detail=await records.historySession('racing','race',{revision:page.revision});assert.equal(detail.laps[0].carId,'old-car');assert.equal(detail.session.standings[0].total,6000);
  const contributions=await client.contributions({sourceId:client.installationId,sessionId:'race',limit:1});assert.equal(contributions.rows[0].status,'excluded');assert.equal(contributions.rows[0].originalCarId,ids.old);assert.equal(typeof contributions.token,'object');
  const again=await client.contributions({sourceId:client.installationId,sessionId:'race',limit:1,offset:0,token:contributions.token});assert.deepEqual(again,contributions);
  assert.equal((await client.handle.timingRead({kind:'carStatistics',carId:ids.main})).summary.recordedLaps,0);
 });
 test(backend+': merged settings and selectors keep original evidence and reject retired race selections',async t=>{
  const f=await fixture(t,backend),{client,worker,db}=f,original=await client.original('old-car'),ids=await merged(f);
  assert.equal(client.canonicalId('old-car'),ids.old);assert.equal(client.localId(ids.old),'old-car');
  assert.equal(client.merges.resolve(ids.old),ids.main);
  const binding=await client.currentSettings('old-car');assert.equal(binding.localCarId,'main-original');assert.equal(binding.effective.damageFactor,1.3);
  assert.deepEqual(await client.original('old-car'),original);
  const base=worker?new(require('../sqlite-app-repository'))(worker):new(require('../data-repository'))(db),records=require('../shared-library-records').wrap(base,client);
  const page=await records.catalogue('slotcars');assert.equal(page.items.length,1);assert.equal(page.items[0].record.id,'main-original');assert.equal(page.items[0].record.damageFactor,1.3);
  const detail=await records.get('slotcars','main-original');assert.equal(detail.sharedLibrary.settingsBinding.bindingToken,binding.bindingToken);
  await assert.rejects(client.prepare(['old-car']),{code:'CAR_MERGED'});await assert.rejects(client.prepare(['old-car','main-original']),/physical car/);
  const prepared=await client.prepare(['main-original']);assert.equal(prepared.timingSettings['main-original'].effective.damageFactor,1.3);
  await assert.rejects(records.update('slotcars','old-car',{tyreCompound:'S'}),{code:'CAR_MERGED'});
 });
 test(backend+': effective editor saves atomically; null and zero survive restart and lost acknowledgement',async t=>{
  const f=await fixture(t,backend),{client,storage,options}=f,{main}=await merged(f),editor=await client.editor('main-original');
  const patch=require('../renderer/paddockshared').timingChanges(editor.timing,{damageFactor:'',failureFactor:'0'});
  assert.deepEqual(patch.set,{damageFactor:null,failureFactor:0});
  const input={databaseId:editor.schema.databaseId,recoveryId:editor.schema.recoveryId,action:'patch',carId:main,expectedRevision:editor.car.revision,set:{name:'Renamed'},clear:[],timingSettings:patch};
  const write=client.handle.carWrite;client.handle.carWrite=async r=>{await write(r);throw Error('lost acknowledgement');};
  const queued=await client.save(input);assert.equal(queued.state,'pending');const frozen=(await storage.sharedRead({kind:'get',id:queued.id})).request;
  client.handle.carWrite=write;const saved=await client.retry(queued.id);assert.equal(saved.state,'committed');assert.deepEqual((await storage.sharedRead({kind:'get',id:queued.id})).request,frozen);
  assert.equal((await client.currentSettings(main)).effective.damageFactor,1);assert.equal((await client.currentSettings(main)).effective.failureFactor,0);
  const current=await client.car(main),bad=await client.save({...input,expectedRevision:current.revision,set:{name:'Must not commit'}});assert.equal(bad.state,'blocked');assert.equal(bad.code,'REVISION_CONFLICT');assert.equal((await client.car(main)).fields.name,'Renamed');
  assert.equal((await client.original('main-original')).value.damageFactor,2);
  const reopened=await require('../shared-library-client').SharedLibraryClient.open(options);try{assert.equal((await reopened.currentSettings(main)).effective.failureFactor,0);}finally{await reopened.close();}
 });
 test(backend+': bind journal, receipt recovery and retired writes are durable and never rewritten',async t=>{
  const f=await fixture(t,backend),{client,storage}=f,s=await client.status(),b=await client.currentSettings('old-car');
  const bind=await client.stateSave('timingSettingsWrite',{databaseId:s.databaseId,recoveryId:s.recoveryId,carId:b.carId,action:'bind',expectedRevision:b.revision,expectedBindingToken:b.bindingToken});assert.equal(bind.state,'committed');
  const now=await client.currentSettings('old-car');const again=await client.stateSave('timingSettingsWrite',{databaseId:s.databaseId,recoveryId:s.recoveryId,carId:b.carId,action:'bind',expectedRevision:now.revision,expectedBindingToken:now.bindingToken});assert.equal(again.state,'committed');assert.equal(again.receipt.revision,now.revision);
  const ids=await merged(f),car=await client.car(ids.old),request={databaseId:s.databaseId,recoveryId:s.recoveryId,action:'patch',carId:ids.old,expectedRevision:car.revision,set:{name:'Blocked'}};
  const rejected=await client.save(request);assert.equal(rejected.state,'blocked');assert.equal(rejected.code,'CAR_MERGED');assert.equal(rejected.details.identity.canonicalCarId,ids.main);
  const before=(await storage.sharedRead({kind:'get',id:rejected.id})).request;await client.recoverSaves();assert.deepEqual((await storage.sharedRead({kind:'get',id:rejected.id})).request,before);
  await storage.sharedChange({action:'resolve',operationId:rejected.id});assert.equal((await storage.sharedRead({kind:'get',id:rejected.id})).state,'reconciled');
 });
 test(backend+': overlay-only change during capture invalidates race preparation',async t=>{
  const {client}=await fixture(t,backend),profile=client.profile.bind(client);let once=true;
  client.profile=async id=>{const value=await profile(id);if(once){once=false;const b=await client.currentSettings(id),s=await client.status();await client.handle.timingSettingsWrite({databaseId:s.databaseId,recoveryId:s.recoveryId,operationId:'concurrent-settings',sourceId:client.installationId,carId:b.carId,action:'patch',expectedRevision:b.revision,expectedBindingToken:b.bindingToken,set:{damageFactor:0}});}return value;};
  await assert.rejects(client.prepare(['old-car']),{code:'QUERY_CHANGED'});
 });
 test(backend+': pre-merge successful receipts recover unchanged; changed recovery blocks uncertain settings',async t=>{
  const f=await fixture(t,backend),{client,storage}=f,s=await client.status(),car=await client.car('old-car'),write=client.handle.carWrite;client.handle.carWrite=async input=>{await write(input);throw Error('lost acknowledgement');};
  const pending=await client.save({databaseId:s.databaseId,recoveryId:s.recoveryId,carId:car.id,action:'patch',expectedRevision:car.revision,set:{name:'Saved before merge'}});assert.equal(pending.state,'pending');client.handle.carWrite=write;
  const frozen=(await storage.sharedRead({kind:'get',id:pending.id})).request;await merged(f);const saved=await client.retry(pending.id);assert.equal(saved.state,'committed');assert.equal(saved.receipt.car.id,car.id);assert.deepEqual((await storage.sharedRead({kind:'get',id:pending.id})).request,frozen);
  const b=await client.currentSettings('main-original'),method=client.handle.timingSettingsWrite;client.handle.timingSettingsWrite=async()=>{throw Error('uncertain');};
  const queued=await client.stateSave('timingSettingsWrite',{databaseId:s.databaseId,recoveryId:s.recoveryId,carId:b.carId,action:'patch',expectedRevision:b.revision,expectedBindingToken:b.bindingToken,set:{failureFactor:0}});assert.equal(queued.state,'pending');client.handle.timingSettingsWrite=method;
  const readStatus=client.handle.status;client.handle.status=async()=>({...await readStatus(),recoveryId:'restored-generation'});assert.equal((await client.retry(queued.id)).code,'RECOVERY_CHANGED');client.handle.status=readStatus;assert.equal((await client.currentSettings(b.carId)).effective.failureFactor,1);
 });
}
test('mapping refresh never publishes partial or cyclic mappings',async()=>{
 const {MergeView}=require('../shared-library-merges'),status={databaseId:'db',recoveryId:'epoch',revision:1};let calls=0;
 const client={status:async()=>status,loadAliases:async()=>{},handle:{mergeMappings:async()=>{calls++;return {databaseId:'db',recoveryId:'epoch',mergeRevision:1,rows:[{id:'m',retiredCarId:'old',mainCarId:'new',revision:1}],nextCursor:'repeat'};}}};
 const view=new MergeView(client);view.edges.set('original','kept');await assert.rejects(view.refresh(),{code:'INVALID_QUERY'});assert.equal(view.edges.get('original'),'kept');assert.equal(calls,2);
 client.handle.mergeMappings=async()=>({databaseId:'db',recoveryId:'epoch',mergeRevision:1,rows:[{id:'m',retiredCarId:'old',mainCarId:'old',revision:1}],nextCursor:null});await assert.rejects(view.refresh(),{code:'MERGE_LINEAGE_CONFLICT'});
});
test('qualified artifact enables activation and validates published settings fixtures',()=>{
 assert.equal(require(source+'car-merge-storage.cjs').enabled(),true);
 const fixtures=require('../vendor/slotforge-library/merge-contract/fixtures/timing-settings.json'),schema=require('../vendor/slotforge-library/merge-contract/timing-settings.schema.json'),validate=require(source+'timing-schema.cjs').validate;
 for(const c of fixtures.cases){validate(c.response,schema.$defs.projection);require('../shared-library-merges').settings(c.response,c.response);}
 for(const bad of fixtures.invalidPatches)assert.equal(require('../shared-library-merges').validFields(bad),false);
});
