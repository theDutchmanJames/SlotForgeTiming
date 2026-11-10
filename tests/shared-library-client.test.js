'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {SharedLibraryClient}=require('../shared-library-client'),engine=require('../vendor/slotforge-library/index.cjs');
async function fixture(t,backend,seed=()=>{}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'timing-common-engine-')),profile=path.join(root,'slotforge-timing');fs.mkdirSync(profile);
 const Database=require('../db'),db=new Database(path.join(profile,'slotforge-timing.json'));db.data.paddock={sourceId:'timing-test'};db.data.customFields.slotcars=[{id:'keep',label:'Legacy note',type:'number',options:[]}];db.data.slotcars=[{id:'old-car',brand:'NSR',model:'Historic',gearing:'9/27',tyres:'Rubber',weight:'80 g',damageFactor:1.3,custom:{keep:42}}];db.saveNow();
 seed(db.data);db.saveNow();const original=fs.readFileSync(db.file);let worker,storage;
 if(backend==='sqlite'){
  const generation=require('node:crypto').randomUUID(),copy=path.join(profile,'sqlite',generation),work=path.join(copy,'working');fs.mkdirSync(path.dirname(copy),{recursive:true});
  require('../sqlite-migration').migrateCopy({source:db.file,destination:copy});require('../sqlite-working').forkCopy(copy,work);
  fs.writeFileSync(path.join(profile,'storage-backend.json'),JSON.stringify({format:'slotforge-storage-selection',version:1,backend:'sqlite',generation}));
  worker=new(require('../sqlite-client'))();await worker.openWorking(work);storage=new(require('../paddock-storage').SqlitePaddockStorage)(new(require('../sqlite-repository'))(worker));
 }else storage=new(require('../paddock-storage').JsonPaddockStorage)(db);
 const options={installationId:'timing-test',storage,sharedRoot:path.join(root,'shared'),legacyProfiles:[profile]};
 const client=await SharedLibraryClient.open(options),peer=await engine.open({application:'SlotForge Paddock',installationId:'paddock-test',sharedRoot:options.sharedRoot,legacyProfiles:[]});
 t.after(async()=>{await client.close();await peer.close();await worker?.close();await db.writesIdle();if(backend==='sqlite')assert.deepEqual(fs.readFileSync(db.file),original);fs.rmSync(root,{recursive:true,force:true});});
 return {client,peer,storage,options,db,worker};
}
for(const backend of ['json','sqlite']){
 test(backend+': shared-only measured sessions respect peer corrections rather than stale native companions',async t=>{
  const {client,peer,db,worker}=await fixture(t,backend),base=worker?new(require('../sqlite-app-repository'))(worker):new(require('../data-repository'))(db),records=require('../shared-library-records').wrap(base,client);
  const raw=require('../tools/qa/rich-mapper-fixtures.cjs').evidence(),capture=await client.prepare(['old-car']),status=await peer.status();raw.session.paddockJournal.captures.local=capture.captures['old-car'];
  const bundle=require('../paddock-rich-mapper').measured(raw.session,raw.laps,status.databaseId).bundle;
  await peer.adoptSession({databaseId:status.databaseId,recoveryId:status.recoveryId,operationId:'foreign-native',sourceId:'other-timing',originalId:raw.session.id,sessionId:raw.session.id,rawOriginal:raw,bundle});
  const id='shared:'+JSON.stringify(['other-timing',raw.session.id]);let page=await records.historyPage('racing');assert.equal(page.sessions.items[0].id,id);
  let detail=await records.historySession('racing',id,{revision:page.revision,exportAll:true});assert.equal(detail.session.standings[0].total,21000);assert.equal(detail.session.readOnly,true);assert.equal(detail.laps.length,2);assert.equal(detail.laps[0].carId,'old-car');
  const head=await peer.historyRead({kind:'detail',sourceId:'other-timing',sessionId:raw.session.id});bundle.context.classification[0].elapsedMs=24000;
  await peer.historyWrite({version:1,databaseId:status.databaseId,recoveryId:status.recoveryId,operationId:'foreign-correction',sourceId:'other-timing',sessionId:raw.session.id,action:'replace',expected:head.accepted,editor:{installationId:'paddock-test',application:'SlotForge Paddock',name:'QA'},reason:'Corrected time',bundle});
  page=await records.historyPage('racing');detail=await records.historySession('racing',id,{revision:page.revision,exportAll:true});assert.equal(detail.session.standings[0].total,24000);assert.equal(detail.session.standings[0].penalty,undefined);assert.equal(detail.figures[0].distance,40);
  assert.equal((await peer.extensionRead({namespace:'timing.historyOriginals',sourceId:'other-timing',originalId:raw.session.id})).value.session.standings[0].total,21000);
 });
 test(backend+': normal results retain native totals, dates, controls and shared-only sessions without duplicates',async t=>{
  const {client,peer,db,worker}=await fixture(t,backend,d=>{
   d.drivers=[{id:'driver',name:'James'}];d.tracks=[{id:'club',name:'Club',length:25,lanes:2,laneModifier:'none'}];
   d.sessions=Array.from({length:15},(_,i)=>({id:'native-'+i,sessionType:'race',setupName:'Race '+i,trackId:'club',trackName:'Club',date:new Date(Date.UTC(2026,10,i+1)).toISOString(),standings:[{pos:1,carId:'old-car',driverId:'driver',driverName:'James',carName:'NSR Historic',laps:2,best:6000,total:13000,penalty:2000,adjMs:1000,penaltyPoints:2}],weatherNote:'Sunny'}));
   d.laps=d.sessions.flatMap(s=>[6000,7000].map((time,i)=>({id:s.id+'-lap-'+i,sessionId:s.id,trackId:'club',driverId:'driver',carId:'old-car',lane:i+1,lapNumber:i+1,time,date:s.date})));
  });
  const base=worker?new(require('../sqlite-app-repository'))(worker):new(require('../data-repository'))(db),records=require('../shared-library-records').wrap(base,client);
  const page=await records.historyPage('racing');assert.equal(page.sessions.items.length,12);assert.equal(page.tracks.items.length,1);assert.equal(page.personal.items.length,1);
  const detail=await records.historySession('racing','native-14',{revision:page.revision});assert.equal(detail.session.readOnly,undefined);assert.equal(detail.session.standings[0].total,13000);assert.equal(detail.session.standings[0].penalty,2000);assert.equal(detail.session.standings[0].adjMs,1000);assert.equal(detail.session.weatherNote,'Sunny');assert.equal(detail.session.date,'2026-11-15T00:00:00.000Z');assert.equal(detail.figures[0].distance,50);
  const second=await records.historyPage('racing',{sessions:page.sessions.next});assert.equal(second.sessions.items.length,3);assert.equal(second.sessions.next,null);assert.equal(new Set([...page.sessions.items,...second.sessions.items].map(s=>s.id)).size,15);
  // Simulate a retained central session with no private recovery copy.
  await base.removeSession('native-14');const onlyPage=await records.historyPage('racing');assert.equal(onlyPage.sessions.items.filter(s=>s.id==='native-14').length,1);
  const only=await records.historySession('racing','native-14',{revision:onlyPage.revision,exportAll:true});assert.equal(only.session.readOnly,true);assert.equal(only.session.standings[0].total,13000);assert.equal(only.laps.length,2);assert.equal(only.figures[0].distance,50);
  // A peer withdrawal must hide the retained local recovery copy too.
  const status=await peer.status(),head=await peer.historyRead({kind:'detail',sourceId:client.installationId,sessionId:'native-13'});
  await peer.historyWrite({version:1,databaseId:status.databaseId,recoveryId:status.recoveryId,operationId:'withdraw-results-test',editor:{installationId:'paddock-test',application:'SlotForge Paddock',name:'QA'},sourceId:client.installationId,sessionId:'native-13',action:'withdraw',expected:head.accepted,reason:'QA withdrawal',withdrawalReason:'QA withdrawal'});
  await assert.rejects(records.historyPage('racing',{sessions:onlyPage.sessions.next}),/changed/i);
  const refreshed=await records.historyPage('racing');assert(!refreshed.sessions.items.some(s=>s.id==='native-13'));assert.equal(await records.historySession('racing','native-13',{revision:refreshed.revision}),null);
 });
 test(backend+': original record grouping is applied before pagination across cars and lanes',async t=>{
  const {client,db,worker}=await fixture(t,backend,d=>{
   d.slotcars.push({id:'second-car',model:'Second car'});d.drivers=[{id:'driver',name:'James'}];d.tracks=Array.from({length:43},(_,i)=>({id:'track-'+i,name:'Track '+String(i).padStart(2,'0')}));
   d.sessions=d.tracks.map((track,i)=>({id:'group-'+i,sessionType:'practice',setupName:'Practice',trackId:track.id,trackName:track.name,date:'2026-11-01T00:00:00.000Z',standings:['old-car','second-car'].map((carId,n)=>({carId,driverId:'driver',driverName:'James',laps:2,best:n?5000:7000,pos:n+1}))}));
   d.laps=d.sessions.flatMap(s=>['old-car','second-car'].flatMap((carId,n)=>[1,2].map(lane=>({id:s.id+'-'+n+'-'+lane,sessionId:s.id,trackId:s.trackId,driverId:'driver',carId,lane,lapNumber:lane,time:n?5000+lane:7000+lane,date:s.date}))));
  });
  const base=worker?new(require('../sqlite-app-repository'))(worker):new(require('../data-repository'))(db),records=require('../shared-library-records').wrap(base,client);
  const p=await records.historyPage('racing');assert.equal(p.tracks.items.length,40);assert.equal(p.personal.items.length,40);assert(p.tracks.items.every(l=>l.time===5001&&l.carId==='second-car'));
  const next=await records.historyPage('racing',{tracks:p.tracks.next,personal:p.personal.next});assert.equal(next.tracks.items.length,3);assert.equal(next.personal.items.length,3);assert.equal(next.tracks.next,null);
  assert.equal(new Set([...p.personal.items,...next.personal.items].map(l=>l.trackId+'|'+l.driverId)).size,43);
  // The existing lane-specific engine API remains unchanged for other callers.
  const lanes=await client.handle.timingRead({kind:'records',scope:'personal',sourceId:client.installationId,trackId:'track-0'});assert.equal(lanes.rows.length,4);
 });
 test(backend+': native historical laps populate shared records, dates and averages without guessing distance',async t=>{
  const saved='2026-10-25T12:34:56.789Z';
  const {client,peer,db,worker,options}=await fixture(t,backend,d=>{
   d.drivers=[{id:'james',name:'James'}];d.tracks=[{id:'club',name:'Club',length:999}];
   d.sessions=[{id:'legacy-qualifying',sessionType:'qualifying',setupName:'Qualifying',trackId:'club',trackName:'Club',date:saved,standings:[{carId:'old-car',driverId:'james',driverName:'James',laps:3,best:6795,pos:1}]}];
   d.laps=[7021,6795,30302].map((time,i)=>({id:'legacy-lap-'+i,sessionId:'legacy-qualifying',trackId:'club',carId:'old-car',driverId:'james',lane:2,lapNumber:i+1,time,date:saved,...(i===2?{tooSlow:true,noPersonalBest:true,noTrackRecord:true}:{})}));
  });
  const carId=client.canonicalId('old-car'),stats=await peer.historyRead({kind:'statistics',carId});
  assert.equal(stats.validLaps,2);assert.equal(stats.averageLapMs,6908);assert.equal(stats.bestPersonalLapMs,6795);assert.equal(stats.bestTrackLapMs,6795);assert.equal(stats.unknownDistanceLaps,3);assert.equal(stats.distanceComplete,false);
  const base=worker?new(require('../sqlite-app-repository'))(worker):new(require('../data-repository'))(db),records=require('../shared-library-records').wrap(base,client);
  const page=await records.historyPage('racing'),record=page.tracks.items.find(x=>x.time===6795);assert(record);assert.equal(record.lane,2);assert.equal(record.date,saved);assert.equal(record.dateBasis,'saved');
  const carStats=await records.carStatistics('old-car');assert.equal(carStats.mileage.laps,3);assert.equal(carStats.mileage.distance,null);assert.equal(carStats.lastDriven,saved);
  const from=await peer.timingRead({kind:'records',scope:'track',from:'2026-10-25T00:00:00.000Z',to:'2026-10-26T00:00:00.000Z'});assert.equal(from.rows.length,1);assert.equal(from.rows[0].startedAt,null);assert.equal(from.rows[0].savedAt,saved);
  const original=await peer.extensionRead({namespace:'timing.historyOriginals',sourceId:client.installationId,originalId:'legacy-qualifying'});
  assert.equal(original.value.laps[0].valid,undefined);assert.equal(original.value.laps[0].pit,undefined);assert.equal(original.value.session.date,saved);
  await client.close();const reopened=await SharedLibraryClient.open(options);try{const again=await reopened.handle.historyRead({kind:'statistics',carId});assert.equal(again.measuredLaps,3);assert.equal(again.validLaps,2);}finally{await reopened.close();}
 });
 test(backend+': deleting a private track withdraws its adopted shared sessions without losing retained evidence',async t=>{
 const {client,peer,db,worker}=await fixture(t,backend,d=>{d.tracks=[{id:'track-delete',name:'Old circuit'}];d.sessions=[{id:'old-race',trackId:'track-delete',sessionType:'race',standings:[]}];d.laps=[{id:'old-lap',sessionId:'old-race',trackId:'track-delete',carId:'old-car',lapNumber:1,lane:1,time:9000}];});
 const base=worker?new(require('../sqlite-app-repository'))(worker):new(require('../data-repository'))(db),records=require('../shared-library-records').wrap(base,client),pump=new(require('../shared-library-delivery'))(client,worker||new(require('../json-delivery-store'))(db));await records.remove('tracks','track-delete');await pump.flush();assert.equal((await peer.historyRead({kind:'detail',sourceId:client.installationId,sessionId:'old-race'})).accepted.state,'withdrawn');assert.equal((await peer.extensionRead({namespace:'timing.historyOriginals',sourceId:client.installationId,originalId:'old-race'})).value.laps.length,1);await pump.close();
 });
 test(backend+': shared custom values, maintenance receipts and peer class labels use the canonical car',async t=>{
  const {client,peer,db,worker}=await fixture(t,backend),base=worker?new(require('../sqlite-app-repository'))(worker):new(require('../data-repository'))(db),records=require('../shared-library-records').wrap(base,client);
  const field=await records.addCustomField('slotcars',{label:'Setup note',type:'text',options:[]}),car=await client.car('old-car'),state=await client.status();
  const saved=await client.save({...state,action:'patch',carId:car.id,expectedRevision:car.revision,set:{raceClass:'GT3'},customValues:{set:{[field.id]:'Soft braid'},clear:[]}});assert.equal(saved.state,'committed',saved.error);
  const row=await records.get('slotcars','old-car');assert.equal(row.custom[field.id],'Soft braid');assert.equal((await records.list('raceclasses')).find(c=>c.id===row.raceClass).name,'GT3');assert.equal((await peer.customRead({carId:car.id})).values[field.id],'Soft braid');
  const before=await client.editor('old-car'),write=client.handle.serviceWrite.bind(client.handle);let calls=0;client.handle.serviceWrite=async r=>{calls++;await write(r);throw Error('Lost maintenance acknowledgement');};
  const pending=await client.stateSave('serviceWrite',{...state,carId:car.id,expectedCarRevision:before.car.revision,expectedRevision:before.service.service.revision,action:'reset'});assert.equal(pending.state,'pending');
  const retry=await client.retry(pending.id);assert.equal(retry.state,'committed',retry.error);assert.equal(calls,1);assert.equal((await records.get('slotcars','old-car')).servicesDone,before.service.service.servicesDone+1);
  const refreshed=await client.editor('old-car');assert.equal(refreshed.custom.values[field.id],'Soft braid');assert.equal(refreshed.service.service.lapsSinceService,0);
 });
 test(backend+': held restore preserves the exact request without retrying on startup',async t=>{
  const {client,db,worker,options}=await fixture(t,backend),B=require('../shared-library-backup'),R=require('../shared-library-restore'),profile=options.legacyProfiles[0],directory=path.join(path.dirname(options.sharedRoot),'held-source'),privateBackup=p=>worker?worker.backupSnapshot(p):new(require('../bulk-storage').JsonBulkStorage)(db).backup(p);
  await B.create({client,destination:directory,backend,privateBackup});await R.prepare({client,profile,directory,backend,privateBackup});const retained=R.read(profile);R.hold(profile,Error('Conflict with peer edits'));assert.deepEqual(R.read(profile).request,retained.request);client.handle.restore=async()=>{throw Error('Must not restore');};assert.equal(await R.run(client,profile),null);assert(fs.existsSync(path.join(path.dirname(retained.request.source),'held-request.json')));
 });
 test(backend+': imports resume exact IDs after a lost reply and never create a private car copy',async t=>{
  const {client,peer,db,worker,options}=await fixture(t,backend),base=worker?new(require('../sqlite-app-repository'))(worker):new(require('../data-repository'))(db),I=require('../shared-library-import'),profile=options.legacyProfiles[0];
  const bundle={format:'slotforge-timing-export',fileVersion:1,items:{slotcars:[{id:'import-car',model:'Imported physical car',lapsDriven:25,servicesDone:2,custom:{note:'Retained note'}}],sessions:[{id:'import-race',sessionType:'race',setupName:'Imported laps',standings:[]}],laps:[{id:'import-lap',carId:'import-car',sessionId:'import-race',lapNumber:1,time:12345,lane:1}]},customFields:{slotcars:[{id:'note',label:'Note',type:'text',options:[]}]}};
  const journal=await I.prepare(client,profile,bundle),adopt=client.handle.adoptCar.bind(client.handle);let calls=0;
  client.handle.adoptCar=async r=>{calls++;const result=await adopt(r);if(calls===1)throw Error('Lost import acknowledgement');return result;};
  await assert.rejects(I.resume(client,base,profile),/Lost import/);assert.equal((await peer.catalogue({})).total,2);
  await assert.rejects(I.prepare(client,profile,{...bundle,app:'changed'}),/Finish/);
  const counts=await I.resume(client,base,profile);assert.equal(counts.slotcars,1);assert.equal((await peer.catalogue({})).total,2);
  assert.equal((await base.list('slotcars')).length,1);assert(await base.get('sessions',journal.items.sessions[0].id));assert.equal((await peer.historyRead({kind:'sessions'})).entries.length,1);const imported=await peer.customRead({carId:client.canonicalId(journal.items.slotcars[0].id)});assert(Object.values(imported.values).includes('Retained note'));assert.equal((await peer.serviceRead({carId:imported.carId})).service.lapsDriven,25);
  await I.resume(client,base,profile);assert.equal((await base.list('sessions')).length,1);
 });
 test(backend+': normal statistics use canonical history once and current car exports use peer edits',async t=>{
  const {client,peer,db,worker}=await fixture(t,backend),base=worker?new(require('../sqlite-app-repository'))(worker):new(require('../data-repository'))(db),records=require('../shared-library-records').wrap(base,client),outbox=worker||new(require('../json-delivery-store'))(db),pump=new(require('../shared-library-delivery'))(client,outbox),e=require('../tools/qa/rich-mapper-fixtures.cjs').evidence(),captured=await client.prepare(['old-car']);
  e.session.paddockJournal.captures.local=captured.captures['old-car'];e.session.paddockJournal.sharedLibrary=captured.sharedLibrary;await records.saveSession(e.session,e.laps);await pump.flush();
  assert.equal((await records.transferChoices('slotcars')).length,1);assert.equal((await records.get('slotcars','old-car')).custom.keep,'42');assert((await records.customFields('slotcars')).some(f=>f.id==='keep'));const stats=await records.carStatistics('old-car');assert.equal(stats.sessions,1);assert.equal(stats.mileage.laps,2);
  const home=await records.homeStatistics({trackId:'',grid:[],driverIds:[],now:new Date().toISOString(),boards:[{key:'glance',count:5,scope:'all',period:'all'}]});assert.equal(home.cards.glance.glance.laps,2);
  const page=await records.historyPage('racing');assert(page.tracks.items.length);assert(page.tracks.items.every(l=>l.time>0));
  const car=await client.car('old-car'),s=await client.status();await peer.carWrite({databaseId:s.databaseId,recoveryId:s.recoveryId,operationId:'peer-export-change',action:'patch',carId:car.id,expectedRevision:car.revision,set:{model:'Current shared model'}});
  const bulk=require('../shared-library-bulk').wrap({},records,client,''),exported=await bulk.collect({slotcars:['old-car']},false);assert.equal(exported.items.slotcars[0].model,'Current shared model');
  const originalBefore=await client.original('old-car');
  await records.update('slotcars','old-car',{tyreCompound:'S'});
  assert.equal((await records.get('slotcars','old-car')).tyreCompound,'S');
  assert.equal((await client.currentSettings('old-car')).effective.tyreCompound,'S');
  assert.deepEqual(await client.original('old-car'),originalBefore,'Current settings must not rewrite original car evidence');
  assert.equal((await client.car('old-car')).fields.rearTyres,'Rubber');await pump.close();
 });
 test(backend+': adopted historical and original-only edits keep original provenance and exact guarded predecessors',async t=>{
  const {client,peer,db,worker}=await fixture(t,backend,d=>{
   d.sessions=[{id:'historic',sessionType:'race',setupName:'Older race',standings:[]},{id:'token',sessionType:'tokens',setupName:'Older tokens',standings:[]}];
   d.laps=[{id:'h-lap',sessionId:'historic',carId:'old-car',lane:1,lapNumber:1,time:8123},{id:'t-lap',sessionId:'token',carId:'old-car',lane:1,lapNumber:1,time:12345,token:true}];
  });
  const base=worker?new(require('../sqlite-app-repository'))(worker):new(require('../data-repository'))(db),records=require('../shared-library-records').wrap(base,client),outbox=worker||new(require('../json-delivery-store'))(db),pump=new(require('../shared-library-delivery'))(client,outbox);
  const before=(await peer.historyRead({kind:'sessions'})).entries.find(e=>e.sessionId==='historic');assert(before);
  await records.update('laps','h-lap',{noTrackRecord:true});const pending=await base.get('sessions','historic');assert.equal(pending.paddockDelivery.status,'pending',pending.paddockDelivery.error);assert.equal(pending.paddockDelivery.payload.bundle.provenance.kind,'historical');assert.deepEqual(pending.paddockDelivery.guard.operations[0].expected,before.accepted);assert.equal((await pump.flush()).sent,1);
  await records.update('laps','t-lap',{noPersonalBest:true});assert.equal((await pump.flush()).sent,1);const raw=await peer.originalHistory({kind:'detail',sourceId:client.installationId,originalId:'token'});assert.equal(raw.revision,2);
  await records.removeSession('token');assert.equal((await pump.flush()).sent,1);assert.equal((await peer.originalHistory({kind:'detail',sourceId:client.installationId,originalId:'token'})).state,'withdrawn');
  await records.removeSession('historic');assert.equal((await pump.flush()).sent,1);await pump.close();
 });
 test(backend+': coordinated restore keeps private data, safely recovers a lost reply and blocks pre-restore intentions',async t=>{
  const {client,peer,db,worker,storage,options}=await fixture(t,backend),B=require('../shared-library-backup'),Restore=require('../shared-library-restore'),profile=options.legacyProfiles[0],directory=path.join(path.dirname(options.sharedRoot),'restore-source'),privateBackup=target=>worker?worker.backupSnapshot(target):new(require('../bulk-storage').JsonBulkStorage)(db).backup(target);
  await B.create({client,destination:directory,backend,privateBackup});const s=await client.status();
  await client.save({...s,action:'create',set:{name:'After backup'}});const write=client.handle.carWrite.bind(client.handle);client.handle.carWrite=async()=>{throw Error('Unavailable');};const pending=await client.save({...s,action:'create',set:{name:'Old pending intention'}});client.handle.carWrite=write;
  await Restore.prepare({client,profile,directory,backend,privateBackup});const retained=Restore.read(profile),restore=client.handle.restore.bind(client.handle);let writes=0;client.handle.restore=async r=>{writes++;await restore(r);throw Error('Lost restore response');};
  await assert.rejects(Restore.run(client,profile),/Lost restore response/);assert.deepEqual(Restore.read(profile).request,retained.request);client.handle.restore=restore;
  const now=await peer.status();assert.notEqual(now.recoveryId,s.recoveryId);await peer.carWrite({databaseId:now.databaseId,recoveryId:now.recoveryId,operationId:'post-restore-edit',action:'create',set:{name:'New write after restore'}});
  const result=await Restore.run(client,profile);assert.equal(result.duplicate,true);assert.equal(writes,1);assert.equal((await peer.catalogue({})).cars.some(c=>c.fields.name==='After backup'),false);assert((await peer.catalogue({})).cars.some(c=>c.fields.name==='New write after restore'));
  await client.close();const reopened=await SharedLibraryClient.open(options);try{await Restore.complete(reopened,profile);assert.equal(Restore.read(profile).phase,'complete');await reopened.recoverSaves();const blocked=await storage.sharedRead({kind:'get',id:pending.id});assert.equal(blocked.code,'RECOVERY_CHANGED');assert.equal(blocked.state,'blocked');assert.equal((await peer.catalogue({})).cars.some(c=>c.fields.name==='Old pending intention'),false);assert(await B.verify(retained.before));}finally{await reopened.close();}
 });
 test(backend+': token history remains original-only through retry, correction and withdrawal',async t=>{
  const {client,peer,db,worker}=await fixture(t,backend),repo=worker?new(require('../sqlite-app-repository'))(worker):new(require('../data-repository'))(db),outbox=worker||new(require('../json-delivery-store'))(db),pump=new(require('../shared-library-delivery'))(client,outbox);
  const captured=await client.prepare(['old-car']),session={setupName:'Token stint',sessionType:'tokens',token:{bought:30000},paddockJournal:captured,standings:[{carId:'old-car',laps:1}]},laps=[{carId:'old-car',lane:1,time:10000,lapNumber:1,custom:{preserve:'yes'}}];
  const sid=await repo.saveSession(session,laps),saved=await repo.get('sessions',sid);assert.equal(saved.paddockDelivery.status,'pending',saved.paddockDelivery.error);
  const write=client.handle.originalHistoryWrite.bind(client.handle);let writes=0;client.handle.originalHistoryWrite=async r=>{writes++;await write(r);throw Error('Lost original receipt');};await assert.rejects(pump.flush(),/Lost original receipt/);
  const pending=(await outbox.outbox(captured.sharedLibrary.databaseId,{status:'pending'}))[0];await outbox.command({id:require('node:crypto').randomUUID(),type:'retryDelivery',deliveryKey:pending.key,expectedHash:pending.payloadHash});assert.equal((await pump.flush()).sent,1);assert.equal(writes,1);client.handle.originalHistoryWrite=write;
  let page=await peer.originalHistory({kind:'sessions'});assert.equal(page.rows.length,1);assert.equal(page.rows[0].sessionId,sid);assert.equal((await peer.historyRead({kind:'sessions'})).entries.length,0);
  const lap=(await repo.list('laps')).find(l=>l.sessionId===sid);await repo.update('laps',lap.id,{noTrackRecord:true});assert.equal((await pump.flush()).sent,1);
  const detail=await peer.originalHistory({kind:'detail',sourceId:client.installationId,originalId:sid});assert.equal(detail.revision,2);assert.equal(detail.session.token.bought,30000);
  const original=await peer.originalHistory({kind:'laps',sourceId:client.installationId,originalId:sid});assert.equal(original.rows[0].custom.preserve,'yes');assert.equal(original.rows[0].noTrackRecord,true);
  await repo.removeSession(sid);assert.equal((await pump.flush()).sent,1);page=await peer.originalHistory({kind:'sessions',state:'withdrawn'});assert.equal(page.rows[0].revision,3);assert.equal((await peer.originalHistory({kind:'laps',sourceId:client.installationId,originalId:sid})).total,1);await pump.close();
 });
 test(backend+': complete backup contains canonical history and private recovery without replacing existing files',async t=>{
  const {client,db,worker,options}=await fixture(t,backend),B=require('../shared-library-backup'),destination=path.join(path.dirname(options.sharedRoot),'complete-backup');
  fs.writeFileSync(path.join(options.legacyProfiles[0],'shared-library-import.json'),JSON.stringify({retained:'pending test request'}));
  const saved=await B.create({client,destination,backend,profile:options.legacyProfiles[0],privateBackup:target=>worker?worker.backupSnapshot(target):new(require('../bulk-storage').JsonBulkStorage)(db).backup(target)});
  const checked=await B.verify(destination);assert.equal(checked.library.databaseId,(await client.status()).databaseId);assert(checked.files.some(f=>f.path==='library.sfpbackup'));assert(checked.files.some(f=>f.path==='shared-library-import.json'));assert.equal(saved.saved,true);
  await assert.rejects(B.create({client,destination,backend,privateBackup:()=>{throw Error('Must not replace');}}),/exist/i);
  fs.appendFileSync(path.join(destination,'library.sfpbackup'),'broken');await assert.rejects(B.verify(destination),/checksums/);
  const failed=path.join(path.dirname(destination),'incomplete');await assert.rejects(B.create({client,destination:failed,backend,privateBackup:()=>{throw Error('Disk full');}}),/Disk full/);assert.equal(fs.existsSync(path.join(failed,'manifest.json')),false);
 });
 test(backend+': finalization, uncertain acknowledgement, correction and withdrawal use the shared engine only',async t=>{
  const {client,peer,db,worker}=await fixture(t,backend),repo=worker?new(require('../sqlite-app-repository'))(worker):new(require('../data-repository'))(db),outbox=worker||new(require('../json-delivery-store'))(db);
  const pump=new(require('../shared-library-delivery'))(client,outbox),e=require('../tools/qa/rich-mapper-fixtures.cjs').evidence();
  const captured=await client.prepare(['old-car']);e.session.paddockJournal.captures.local=captured.captures['old-car'];e.session.paddockJournal.sharedLibrary=captured.sharedLibrary;
  // Timing retains its original car ID while the captured profile uses the canonical ID.
  e.session.paddockJournal.captures['old-car']=e.session.paddockJournal.captures.local;delete e.session.paddockJournal.captures.local;
  e.session.paddockJournal.heats.forEach(h=>h.entries.forEach(x=>x.carId='old-car'));e.session.standings.forEach(x=>x.carId='old-car');e.laps.forEach(x=>x.carId='old-car');
  const saved=await repo.saveSession(e.session,e.laps),record=await repo.get('sessions',saved);assert.equal(record.paddockDelivery.transport,'engine');assert.equal(record.paddockDelivery.status,'pending',record.paddockDelivery.error);
  let network=0;const http=new(require('../delivery-service'))(outbox,{call:async()=>{network++;throw Error('No network permitted');}});await http.flush(captured.sharedLibrary.databaseId);assert.equal(network,0);
  const write=client.handle.historyWrite.bind(client.handle);let writes=0;client.handle.historyWrite=async input=>{writes++;await write(input);throw Error('Lost acknowledgement');};
  await assert.rejects(pump.flush(),/Lost acknowledgement/);
  const pending=(await outbox.outbox(captured.sharedLibrary.databaseId,{status:'pending'}))[0];await outbox.command({id:require('node:crypto').randomUUID(),type:'retryDelivery',deliveryKey:pending.key,expectedHash:pending.payloadHash});
  assert.equal((await pump.flush()).sent,1);assert.equal(writes,1);client.handle.historyWrite=write;
  let history=await peer.historyRead({kind:'sessions'});assert.equal(history.entries?.length,1,JSON.stringify(history));assert.equal(history.entries[0].sessionId,saved);
  const original=await peer.extensionRead({namespace:'timing.historyOriginals',sourceId:client.installationId,originalId:saved});assert.equal(original.value.laps.length,2);assert.equal(original.value.session.id,saved);
  const lap=(await repo.list('laps')).find(x=>x.sessionId===saved);await repo.update('laps',lap.id,{noTrackRecord:true});assert.equal((await pump.flush()).sent,1);
  const corrected=await repo.get('sessions',saved);assert.equal(corrected.paddockDelivery.receipt.revision,2);
  await repo.removeSession(saved);assert.equal((await pump.flush()).sent,1);history=await peer.historyRead({kind:'sessions',state:'withdrawn'});assert.equal(history.entries[0].accepted.state,'withdrawn');
  assert.equal((await peer.extensionRead({namespace:'timing.historyOriginals',sourceId:client.installationId,originalId:saved})).value.laps.length,2);
  await pump.close();
 });
 test(backend+': automatic aliases, direct peer edits, durable lost-ack recovery and network separation',async t=>{
  const {client,peer,storage}=await fixture(t,backend),s=await client.status(),car=await client.car('old-car');assert.notEqual(car.id,'old-car');assert.equal(client.localId(car.id),'old-car');
  assert.equal((await client.original('old-car')).value.custom.keep,42);assert.equal(car.fields.pinion,9);assert.equal(car.fields.gear,27);
  const changed=await peer.carWrite({databaseId:s.databaseId,recoveryId:s.recoveryId,operationId:'peer-edit',action:'patch',carId:car.id,expectedRevision:car.revision,set:{name:'Peer edit'}});assert.equal((await client.car('old-car')).fields.name,'Peer edit');
  const conflict=await client.save({...s,action:'patch',carId:car.id,expectedRevision:car.revision,set:{name:'Stale'}});assert.equal(conflict.state,'blocked');assert.equal(conflict.code,'REVISION_CONFLICT');
  const reloaded=await client.car('old-car'),retryDraft=await client.save({...s,action:'patch',carId:car.id,expectedRevision:reloaded.revision,set:{livery:'Fresh draft'}});assert.equal(retryDraft.state,'committed',retryDraft.error);
  // A different car avoids deliberately unresolved conflicts on the first one.
  const create=client.handle.carWrite.bind(client.handle);let writes=0;client.handle.carWrite=async r=>{writes++;await create(r);throw Error('Acknowledgement lost');};
  const pending=await client.save({...s,action:'create',set:{name:'One car only'}});assert.equal(pending.state,'pending');assert.equal(pending.transport,'engine');
  client.isRacing=()=>true;await client.recoverSaves();assert.equal((await storage.sharedRead({kind:'get',id:pending.id})).state,'pending');
  client.isRacing=()=>false;await client.recoverSaves();const recovered=await storage.sharedRead({kind:'get',id:pending.id});assert.equal(recovered.state,'committed');assert.equal(writes,1);assert.equal((await peer.catalogue({})).total,2);
  const base={list:async e=>{assert.equal(e,'raceclasses');return [];},get:()=>{throw Error('Private cars must not be read.');},raceInputs:async()=>({collections:{slotcars:[]}})};
  const records=require('../shared-library-records').wrap(base,client),page=await records.catalogue('slotcars',{limit:1});assert.equal(page.items.length,1);assert(page.next);
  const next=await records.catalogue('slotcars',{limit:1,cursor:page.next});assert.equal(next.items.length,1);assert.equal(next.next,null);
  assert.equal([...page.items,...next.items].find(x=>x.record.id==='old-car').record.damageFactor,1.3);
  const selected=await records.get('slotcars','old-car');assert.equal(selected.id,'old-car');assert.equal(selected.damageFactor,1.3);assert.equal(selected.name,'Peer edit');assert.equal(selected.paddock,undefined);
  const inputs=await records.raceInputs({rows:[{carId:'old-car'}]});assert.equal(inputs.collections.slotcars[0].id,'old-car');
  await peer.carWrite({databaseId:s.databaseId,recoveryId:s.recoveryId,operationId:'clear-gearing',action:'patch',carId:car.id,expectedRevision:(await peer.car(car.id)).revision,clear:['pinion','gear']});
  assert.equal((await records.get('slotcars','old-car')).gearing,'');
  await assert.rejects(records.catalogue('slotcars',{limit:1,cursor:page.next}),/changed/i);
  assert.equal((await storage.sharedRead({kind:'get',id:pending.id})).request.operationId,pending.id);
  const network=require('../paddock-shared');await assert.rejects(network.sendSharedOperation.call({storage},pending.id),/not a network/);
  const history=await client.history({kind:'list'});assert.equal(history.offline,false);assert.deepEqual(history.value.results,[]);
  await peer.close();assert.equal((await client.car('old-car')).fields.name,changed.car.fields.name);
 });
 test(backend+': no engine write before durable intent; recovery change blocks replay',async t=>{
  const {client,storage}=await fixture(t,backend),s=await client.status();const write=client.handle.carWrite.bind(client.handle),change=storage.sharedChange.bind(storage);let calls=0;
  client.handle.carWrite=async r=>{calls++;return write(r);};storage.sharedChange=async()=>{throw Error('Disk full');};
  await assert.rejects(client.save({...s,action:'create',set:{name:'Unsaved'}}),/Disk full/);assert.equal(calls,0);storage.sharedChange=change;
  client.handle.carWrite=async()=>{throw Error('Worker unavailable');};const pending=await client.save({...s,action:'create',set:{name:'Pending'}}),before=structuredClone(pending.request);
  client.handle.status=async()=>({...s,recoveryId:'restored-generation'});
  const blocked=await client.retry(pending.id);assert.equal(blocked.state,'blocked');assert.equal(blocked.code,'RECOVERY_CHANGED');assert.deepEqual(blocked.request,before);assert.equal(calls,0);
 });
 test(backend+': canonical details and Timing extras commit together and reject stale extras',async t=>{
  const {client,peer}=await fixture(t,backend),s=await client.status(),car=await client.car('old-car'),extra=await client.original('old-car');
  const draft=await client.editor('old-car');assert.equal(draft.timing.originalId,'old-car');assert.equal(draft.timing.values.damageFactor,1.3);assert.equal(draft.timing.values.custom,undefined);
  const result=await client.save({...s,action:'patch',carId:car.id,expectedRevision:car.revision,set:{name:'Atomic edit'},timingExtras:{sourceId:client.installationId,originalId:'old-car',expectedRevision:extra.revision,patch:{damageFactor:1.5}}});
  assert.equal(result.state,'committed',result.error);assert.equal((await peer.car(car.id)).fields.name,'Atomic edit');assert.equal((await client.original('old-car')).value.damageFactor,1.5);
  const prior=await client.car('old-car'),only=await client.save({...s,action:'patch',carId:car.id,expectedRevision:prior.revision,set:{},clear:[],timingExtras:{sourceId:client.installationId,originalId:'old-car',expectedRevision:(await client.original('old-car')).revision,patch:{failureFactor:0}}});assert.equal(only.state,'committed',only.error);assert.equal((await peer.car(car.id)).revision,prior.revision);assert.equal((await client.original('old-car')).value.failureFactor,0);
  const latest=await client.car('old-car'),stale=await client.save({...s,action:'patch',carId:car.id,expectedRevision:latest.revision,set:{name:'Must roll back'},timingExtras:{sourceId:client.installationId,originalId:'old-car',expectedRevision:extra.revision,rawOriginal:{damageFactor:2}}});
  assert.equal(stale.state,'blocked');assert.equal(stale.code,'REVISION_CONFLICT');assert.equal((await peer.car(car.id)).fields.name,'Atomic edit');assert.equal((await client.original('old-car')).value.damageFactor,1.5);
 });
}
test('Paddock-first adoption keeps the original source identity even after private Timing initializes a new one',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'timing-origin-')),profile=path.join(root,'slotforge-timing');fs.mkdirSync(profile);const file=path.join(profile,'slotforge-timing.json');
 fs.writeFileSync(file,JSON.stringify({version:1,slotcars:[{id:'original',model:'One physical car'}],sessions:[],laps:[]}));
 const originKey=require('../integration/timing-legacy/index.cjs').describe(profile).originKey,sharedRoot=path.join(root,'shared');
 const peer=await engine.open({application:'Paddock',installationId:'paddock-first',sharedRoot,legacyProfiles:[profile]});
 const db=new(require('../db'))(file);db.data.paddock={sourceId:'new-private-source'};db.saveNow();const storage=new(require('../paddock-storage').JsonPaddockStorage)(db);
 const client=await SharedLibraryClient.open({installationId:'new-private-source',storage,sharedRoot,legacyProfiles:[profile],originKey});
 t.after(async()=>{await client.close();await peer.close();await db.writesIdle();fs.rmSync(root,{recursive:true,force:true});});
 assert.equal(client.installationId,'legacy-'+originKey);assert.equal((await peer.catalogue({})).total,1);assert.equal((await client.original('original')).value.model,'One physical car');assert.equal(client.localId((await client.car('original')).id),'original');
});

test('normal car editor sends only changed simulation fields and validates their ranges',()=>{
 const {timingChanges}=require('../renderer/paddockshared'),fields=require('../schema').slotcars.fields.filter(f=>['damageFactor','serviceInterval','tyreCompound'].includes(f.key));
 const t={sourceId:'source',originalId:'original',revision:3,fields,values:{damageFactor:1.3,serviceInterval:50}};
 assert.equal(timingChanges(t,{damageFactor:'1.3',serviceInterval:'50'}),null);
 assert.deepEqual(timingChanges(t,{damageFactor:'0',serviceInterval:''}),{sourceId:'source',originalId:'original',expectedRevision:3,patch:{damageFactor:0,serviceInterval:null}});
 assert.throws(()=>timingChanges(t,{damageFactor:'-1'}),/Check/);assert.throws(()=>timingChanges(t,{serviceInterval:'2.5'}),/Check/);assert.throws(()=>timingChanges(t,{tyreCompound:'invented'}),/Check/);
});

test('alias enumeration restarts atomically and bounded selected-car reads do not flood the worker',async()=>{
 let calls=0;const handle={adoptionStatus:async o=>{calls++;if(calls===2)throw Object.assign(Error('Changed'),{code:'QUERY_CHANGED'});return calls===1?{token:{revision:1},rows:[{entity:'car',originalId:'discarded',carId:'discarded'}],nextOffset:200}:{token:{revision:2},rows:[{entity:'car',originalId:'original',carId:'canonical'}],nextOffset:null};}};
 const {SharedLibraryClient}=require('../shared-library-client'),client=new SharedLibraryClient(handle,'source',{});await client.loadAliases();assert.equal(calls,3);assert.equal(client.aliases.has('discarded'),false);assert.equal(client.canonicalId('original'),'canonical');
 let active=0,max=0;const later=async v=>{active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,1));active--;return v;};
 Object.assign(handle,{customRead:async()=>later({values:{},definitions:[]}),serviceRead:async()=>later({service:{}}),timingRead:async()=>({rows:[],nextOffset:null})});
 const token={id:'db',epoch:'epoch',revision:1};Object.assign(client,{catalogue:async()=>({token}),car:async id=>later({id,revision:1,fields:{name:id,pinion:null,gear:null}}),original:async()=>later(null)});
 const adapter=require('../shared-library-records').wrap({list:async()=>[],raceInputs:async()=>({collections:{}})},client),ids=Array.from({length:32},(_,i)=>'car-'+i);
 assert.equal((await adapter.referenceDetails('slotcars',ids,JSON.stringify(token))).length,32);assert(max<=16,max);assert.equal((await adapter.raceInputs({rows:ids.map(carId=>({carId})),carRevision:JSON.stringify(token)})).collections.slotcars.length,32);
});
