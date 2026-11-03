'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const Database=require('../db'),Client=require('../sqlite-client'),{WorkingStore,forkCopy}=require('../sqlite-working'),{migrateCopy}=require('../sqlite-migration');
const {StorageLifecycle,JsonLifecycleBackend,SqliteLifecycleBackend}=require('../storage-lifecycle');
const snap=name=>({v:1,race:{name,setup:{extra:[{},[]]}},eng:{v:1,laps:[10,11],best:Infinity},phase:'paused'});
async function fixture(t,kind='sqlite'){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sf-lifecycle-')),file=path.join(dir,'source.json'),db=new Database(file);
 db.data.drivers=[{id:'d',name:'Driver',picture:'data:image/png;base64,YWJjZA=='}];db.saveNow();await db.setSettingsAsync({theme:'light',extension:{preserve:[]}});await db.saveResumeAsync(snap('Imported race'));
 const originals=[file,db.settingsPath,db.resumeFile()].map(p=>[p,fs.readFileSync(p)]);let client,work;
 if(kind==='sqlite'){migrateCopy({source:file,destination:path.join(dir,'copy')});work=path.join(dir,'work');forkCopy(path.join(dir,'copy'),work);client=new Client();await client.openWorking(work);}
 const backend=kind==='sqlite'?new SqliteLifecycleBackend(client):new JsonLifecycleBackend(db),lifecycle=await new StorageLifecycle(backend).initialize();
 t.after(async()=>{await lifecycle.shutdown();await db.writesIdle();if(kind==='sqlite')for(const [p,bytes] of originals)assert.deepEqual(fs.readFileSync(p),bytes);fs.rmSync(dir,{recursive:true,force:true});});return {dir,file,db,client,work,backend,lifecycle};
}
for(const kind of ['json','sqlite']){
 test(kind+': settings are serialized, immutable to callers, and persist unknown values',async t=>{
  const {lifecycle,backend}=await fixture(t,kind),patch={extension:{newValue:1},id:'extension-id'};
  const a=lifecycle.updateSettings(patch);patch.extension.newValue=99;const b=lifecycle.updateSettings({theme:'dark'});await Promise.all([a,b]);
  const value=lifecycle.settings();assert.equal(value.extension.newValue,1);value.extension.newValue=0;assert.equal(lifecycle.settings().extension.newValue,1);assert.equal((await backend.settings()).theme,'dark');assert.equal((await backend.settings()).id,'extension-id');
 });
 test(kind+': normal and between-heat recovery round trips; clear cannot be overtaken by an older save',async t=>{
  const {lifecycle}=await fixture(t,kind);assert.equal((await lifecycle.resume()).race.name,'Imported race');
  const original=snap('Queued');const save=lifecycle.saveResume(original);original.race.name='Changed by caller';const clear=lifecycle.clearResume();await Promise.all([save,clear]);assert.equal(await lifecycle.resume(),null);
  const heat={v:1,race:{name:'Heat break'},heat:{state:{idx:2,results:[]}},phase:'between'};await lifecycle.saveResume(heat);assert.deepEqual(await lifecycle.resume(),heat);
  assert.equal(await lifecycle.saveResume({v:2,race:{},eng:{}}),false);assert.deepEqual(await lifecycle.resume(),heat);
 });
 test(kind+': shutdown drains pending settings/recovery and rejects new work',async t=>{
  const {lifecycle,backend,work,db}=await fixture(t,kind);let release;const original=backend.saveSettings.bind(backend);backend.saveSettings=async(...args)=>{await new Promise(r=>release=r);return original(...args);};
  const write=lifecycle.updateSettings({theme:'dark'});await new Promise(r=>setImmediate(r));const save=lifecycle.saveResume(snap('Final snapshot'));let finished=false;const stop=lifecycle.shutdown().then(()=>finished=true);await new Promise(r=>setImmediate(r));assert.equal(finished,false);await assert.rejects(lifecycle.updateSettings({theme:'light'}),/shutting down/);release();await Promise.all([write,save,stop]);
  if(kind==='sqlite'){const reopened=new WorkingStore(work);try{assert.equal(reopened.get('@meta','settings').value.theme,'dark');assert.equal(reopened.get('@meta','raceResume').value.race.name,'Final snapshot');}finally{reopened.close();}}
  else{assert.equal(JSON.parse(fs.readFileSync(db.settingsPath)).theme,'dark');assert.equal(db.getResume().race.name,'Final snapshot');}
 });
}
test('JSON failed settings persistence never changes visible or in-memory settings',async t=>{
 const {db,lifecycle}=await fixture(t,'json'),before=lifecycle.settings(),bytes=fs.readFileSync(db.settingsPath),write=db.sw.write;
 db.sw.write=async()=>{throw Error('disk full');};try{await assert.rejects(lifecycle.updateSettings({theme:'broken'}),/disk full/);assert.deepEqual(lifecycle.settings(),before);assert.deepEqual(db.getSettings(),before);assert.deepEqual(fs.readFileSync(db.settingsPath),bytes);}finally{db.sw.write=write;}
 await lifecycle.updateSettings({theme:'dark'});assert.equal(lifecycle.settings().theme,'dark');
});
test('SQLite recovery command is revision-checked, idempotent and rolls back faults',async t=>{
 const {lifecycle,work}=await fixture(t);await lifecycle.shutdown();const store=new WorkingStore(work);try{
  const command={id:'resume',type:'setRaceResume',expectedRevision:0,snapshot:JSON.parse(JSON.stringify(snap('New')))};store.command(command);assert.deepEqual(store.command(command),{revision:1});assert.throws(()=>store.command({...command,id:'stale'}),/revision conflict/);
  store.checkpoint=phase=>{if(phase==='recovery-written')throw Error('disk full');};assert.throws(()=>store.command({id:'clear',type:'setRaceResume',snapshot:null,expectedRevision:1}),/disk full/);assert.equal(store.get('@meta','raceResume').value.race.name,'New');assert.equal(store.receipt('clear'),null);
 }finally{store.close();}
});
test('native and legacy SQLite backups retain ordinary race recovery',async t=>{
 const {client,lifecycle,dir}=await fixture(t);await lifecycle.saveResume(snap('In backup'));const backup=path.join(dir,'backup'),restored=path.join(dir,'restored');await client.backupSnapshot(backup);await lifecycle.clearResume();await client.restoreSnapshot(backup,restored);
 const other=new Client();try{await other.openWorking(restored);const service=await new StorageLifecycle(new SqliteLifecycleBackend(other)).initialize();assert.equal((await service.resume()).race.name,'In backup');const json=path.join(dir,'backup.json');await other.exportLegacy(json);const restoredJson=await other.restoreLegacy(json,path.join(dir,'legacy'));const store=new WorkingStore(restoredJson.destination);try{assert.equal(store.get('@meta','raceResume').value.race.name,'In backup');}finally{store.close();}await service.shutdown();}finally{await other.close();}
});
test('changed recovery sidecar prevents publishing a working fork',async t=>{
 const {dir}=await fixture(t);fs.writeFileSync(path.join(dir,'copy','race-resume.json'),'{}');const dest=path.join(dir,'tampered');assert.throws(()=>forkCopy(path.join(dir,'copy'),dest),/checksum/);assert(!fs.existsSync(path.join(dest,'working.sqlite')));
});
test('SQLite diagnostics do not reconstruct the catalogue or recovery contents',async t=>{
 const {work,lifecycle}=await fixture(t);await lifecycle.shutdown();const store=new WorkingStore(work);try{store.get=()=>{throw Error('No record reconstruction for diagnostics');};const stats=store.lifecycleDiagnostics();assert.equal(stats.backend,'sqlite');assert(stats.database.physicalBytes>0);assert.equal(stats.save.persistentRecovery,true);assert(!JSON.stringify(stats).includes('YWJjZA'));}finally{store.close();}
});
test('resource and ordinary recovery share one queue, with resource priority and complete clear',async()=>{
 let ordinary=snap('old'),resource={v:1,race:{resources:{runId:'run'}},eng:{v:1}},calls=[];
 const service=await new StorageLifecycle({settings:()=>({}),pending:()=>false,idle:async()=>{},resume:async()=>ordinary,clearResume:async()=>{ordinary=null;calls.push('ordinary');return true;}},{resources:{read:async()=>({checkpoint:resource}),clear:async()=>{resource=null;calls.push('resources');},idle:async()=>{}}}).initialize();
 assert.equal((await service.resume()).race.resources.runId,'run');await service.clearResume();assert.deepEqual(calls,['resources','ordinary']);assert.equal(await service.resume(),null);await service.shutdown();
});


test('JSON failed recovery deletion is reported and its snapshot remains recoverable',async t=>{
 const {db,lifecycle}=await fixture(t,'json');const unlink=fs.promises.unlink;
 fs.promises.unlink=async function(file,...args){if(file===db.resumeFile())throw Object.assign(Error('Access denied'),{code:'EACCES'});return unlink.call(this,file,...args);};
 try{await assert.rejects(lifecycle.clearResume(),/Could not remove/);assert.equal((await lifecycle.resume()).race.name,'Imported race');}finally{fs.promises.unlink=unlink;}
 await lifecycle.clearResume();assert.equal(await lifecycle.resume(),null);
});
test('SQLite rejected settings command leaves cache and durable settings unchanged',async t=>{
 const {lifecycle,client}=await fixture(t),before=lifecycle.settings(),command=client.command.bind(client);client.command=async c=>{if(c.type==='setSettings')throw Error('Write refused');return command(c);};
 await assert.rejects(lifecycle.updateSettings({theme:'lost'}),/Write refused/);assert.deepEqual(lifecycle.settings(),before);assert.deepEqual((await client.snapshot('@meta','settings',true)).record.value,before);
 client.command=command;await lifecycle.updateSettings({theme:'dark'});assert.equal(lifecycle.settings().theme,'dark');
});
test('SQLite rejects resource snapshots on ordinary recovery command without modifying records',async t=>{
 const {lifecycle,client}=await fixture(t),before=await lifecycle.resume();
 await assert.rejects(client.command({id:'bad-resource',type:'setRaceResume',expectedRevision:0,snapshot:{v:1,race:{resources:{}},eng:{}}}),/atomic ledger/);
 assert.deepEqual(await lifecycle.resume(),before);
 await assert.rejects(client.command({id:'bad-shape',type:'setRaceResume',expectedRevision:0,snapshot:{v:1,race:[],eng:{}}}),/Invalid race/);
 assert.deepEqual(await lifecycle.resume(),before);
});
test('queued settings writes are bounded and shutdown drains accepted work',async()=>{
 let release;const gate=new Promise(r=>release=r);let settings={};const service=await new StorageLifecycle({settings:()=>settings,pending:()=>false,idle:async()=>{},saveSettings:async patch=>{await gate;return settings={...settings,...patch};}}).initialize();
 const accepted=Array.from({length:32},(_,i)=>service.updateSettings({value:i}));await assert.rejects(service.updateSettings({value:32}),/queue is full/);
 const stop=service.shutdown();release();await Promise.all([...accepted,stop]);assert.equal(service.settings().value,31);
});
test('settings refresh publishes externally restored settings without retaining stale values',async t=>{
 const {db,lifecycle}=await fixture(t,'json');await lifecycle.updateSettings({discard:'later edit'});db.replaceAll({...db.data,settings:{theme:'dark'}});await db.writesIdle();await lifecycle.refreshSettings();assert.equal(lifecycle.settings().theme,'dark');assert.equal(lifecycle.settings().discard,undefined);
 assert.throws(()=>lifecycle.updateSettings(JSON.parse('{"__proto__":{"polluted":true}}')),/Invalid settings/);
 const bad=snap('circular');bad.eng.self=bad;assert.equal(await lifecycle.saveResume(bad),false);
});
