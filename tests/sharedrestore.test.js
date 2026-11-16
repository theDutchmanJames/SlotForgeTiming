'use strict';
// Audit 2.2.5, #14 (option A), end to end with the real shared-library engine: a race from before a restore of the shared library can be
// corrected afterwards, and the correction arrives in the restored library.
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
const restoreLibrary=async({client,db,worker,options},backend,backupFirst)=>{
 const B=require('../shared-library-backup'),Restore=require('../shared-library-restore'),profile=options.legacyProfiles[0],directory=path.join(path.dirname(options.sharedRoot),'restore-source'),privateBackup=target=>worker?worker.backupSnapshot(target):new(require('../bulk-storage').JsonBulkStorage)(db).backup(target);
 await B.create({client,destination:directory,backend,privateBackup});await backupFirst?.();await Restore.prepare({client,profile,directory,backend,privateBackup});await Restore.run(client,profile);
 await client.close();const reopened=await SharedLibraryClient.open(options);await Restore.complete(reopened,profile);return reopened;
};
const measured=captured=>{const e=require('../tools/qa/rich-mapper-fixtures.cjs').evidence();e.session.paddockJournal.captures={'old-car':captured.captures['old-car']};e.session.paddockJournal.sharedLibrary=captured.sharedLibrary;
 e.session.paddockJournal.heats.forEach(h=>h.entries.forEach(x=>x.carId='old-car'));e.session.standings.forEach(x=>x.carId='old-car');e.laps.forEach(x=>x.carId='old-car');return e;};
const saveRace=async(repo,captured,type)=>{if(type==='tokens')return repo.saveSession(race(captured,'tokens'),laps());const e=measured(captured);return repo.saveSession(e.session,e.laps);};
const race=(captured,type='race')=>({setupName:type==='tokens'?'Token stint':'Club race',sessionType:type,...(type==='tokens'?{token:{bought:30000}}:{}),paddockJournal:captured,standings:[{carId:'old-car',laps:2}]});
const laps=()=>[{carId:'old-car',lane:1,time:9000,lapNumber:1},{carId:'old-car',lane:1,time:8800,lapNumber:2}];
for(const backend of ['json','sqlite'])for(const type of ['race','tokens']){
 test(backend+' '+type+': a race sent before a library restore can be corrected and deleted afterwards; both arrive in the restored library',async t=>{
  const f=await fixture(t,backend),{client,peer,db,worker,storage}=f,repo=worker?new(require('../sqlite-app-repository'))(worker):new(require('../data-repository'))(db),outbox=worker||new(require('../json-delivery-store'))(db);
  const read=async(c,sid)=>type==='tokens'?(x=>({state:x.state,revision:x.revision}))(await peer.originalHistory({kind:'detail',sourceId:c.installationId,originalId:sid})):(await peer.historyRead({kind:'detail',sourceId:c.installationId,sessionId:sid})).accepted;
  const captured=await client.prepare(['old-car']),sid=await saveRace(repo,captured,type);
  const pump=new(require('../shared-library-delivery'))(client,outbox);assert.equal((await pump.flush()).sent,1);await pump.close();
  const first=await client.status(),reopened=await restoreLibrary(f,backend);t.after(()=>reopened.close());
  const now=await reopened.status();assert.notEqual(now.recoveryId,first.recoveryId);assert.equal((await read(reopened,sid)).revision,1);
  await storage.setSharedLibraryGuard({databaseId:now.databaseId,recoveryId:now.recoveryId}); // (what main.js does when the library opens)
  const after=new(require('../shared-library-delivery'))(reopened,outbox);t.after(()=>after.close());
  const lap=(await repo.list('laps')).find(l=>l.sessionId===sid);await repo.update('laps',lap.id,{noTrackRecord:true});
  assert.equal((await after.flush()).sent,1);assert.deepEqual(await read(reopened,sid),{...await read(reopened,sid),state:'active',revision:2});
  await repo.removeSession(sid);assert.equal((await after.flush()).sent,1);assert.equal((await read(reopened,sid)).state,'withdrawn');assert.equal((await read(reopened,sid)).revision,3);
  assert.deepEqual((await storage.summary()).deliveries.filter(d=>d.transport==='engine'&&d.status==='attention'),[]);
 });
}
for(const backend of ['json','sqlite']){
 test(backend+': a correction the restored library cannot take (it holds another version of the race) is refused and shown, not forced',async t=>{
  const f=await fixture(t,backend),{client,peer,db,worker,storage}=f,repo=worker?new(require('../sqlite-app-repository'))(worker):new(require('../data-repository'))(db),outbox=worker||new(require('../json-delivery-store'))(db);
  let sid;const reopened=await restoreLibrary(f,backend,async()=>{const captured=await client.prepare(['old-car']);sid=await saveRace(repo,captured,'race');const pump=new(require('../shared-library-delivery'))(client,outbox);assert.equal((await pump.flush()).sent,1);await pump.close();});
  t.after(()=>reopened.close());const now=await reopened.status();await storage.setSharedLibraryGuard({databaseId:now.databaseId,recoveryId:now.recoveryId});
  await assert.rejects(peer.historyRead({kind:'detail',sourceId:reopened.installationId,sessionId:sid})); // (the backup was made before this race)
  const after=new(require('../shared-library-delivery'))(reopened,outbox);t.after(()=>after.close());
  const lap=(await repo.list('laps')).find(l=>l.sessionId===sid);await repo.update('laps',lap.id,{noTrackRecord:true});
  await assert.rejects(after.flush());
  const shown=(await storage.summary()).deliveries.filter(d=>d.transport==='engine'&&d.sessionId===sid);
  assert.equal(shown.length,1);assert.equal(shown[0].status,'attention');assert.ok(shown[0].error.length>0,'the reason is kept for App Settings');
 });
}
