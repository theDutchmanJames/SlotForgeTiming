'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
 const backend=process.argv[2]||'json';assert(['json','sqlite'].includes(backend));process.env.SF_SHARED_ENGINE_BACKEND=backend;delete process.env.SF_SHARED_ENGINE_ROOT;
 const ui=path.resolve(__dirname,'../../../outputs/shared-engine-ui',backend),out=path.resolve(__dirname,'../../../outputs/shared-engine-restore',backend);fs.mkdirSync(out,{recursive:true});
 require('./qualified-ui.cjs')('shared-engine-electron.cjs',ui,120000);
 const fixture=JSON.parse(fs.readFileSync(path.join(ui,'result.json')));assert(fixture.passed&&path.dirname(fixture.isolated)===os.tmpdir()&&path.basename(fixture.isolated).startsWith('sf-engine-'));
 let worker,db,client;try{
  if(backend==='sqlite'){const selected=require('../../storage-activation').selected(fixture.profile);worker=new(require('../../sqlite-client'))();await worker.openWorking(path.join(selected.directory,'working'));}
  else db=new(require('../../db'))(path.join(fixture.profile,'slotforge-timing.json'));
  const storage=worker?new(require('../../paddock-storage').SqlitePaddockStorage)(new(require('../../sqlite-repository'))(worker)):new(require('../../paddock-storage').JsonPaddockStorage)(db);
  client=await require('../../shared-library-client').SharedLibraryClient.open({installationId:'native-timing',storage,sharedRoot:fixture.sharedRoot,legacyProfiles:[fixture.profile]});
  const backup=path.join(fixture.isolated,'native-restore-backup'),privateBackup=target=>worker?worker.backupSnapshot(target):new(require('../../bulk-storage').JsonBulkStorage)(db).backup(target);
  await require('../../shared-library-backup').create({client,destination:backup,backend,privateBackup});const before=await client.status();
  await client.save({...before,action:'create',set:{name:'Must disappear on restore'}});
  client.handle.carWrite=async()=>{throw Error('Simulated worker interruption');};const pending=await client.save({...before,action:'create',set:{name:'Must not replay after restore'}});
  await require('../../shared-library-restore').prepare({client,profile:fixture.profile,directory:backup,backend,privateBackup});
  const plan=path.join(out,'plan.json');fs.writeFileSync(plan,JSON.stringify({...fixture,backend,before,pendingId:pending.id,out}));process.env.SF_RESTORE_QA_PLAN=plan;
 }finally{await client?.close();await worker?.close();await db?.writesIdle();}
 require('./qualified-ui.cjs')('shared-restore-electron.cjs',out,120000);
})().catch(e=>{console.error(e);process.exitCode=1;});
