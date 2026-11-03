'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const Activation=require('../storage-activation'),D=require('../db'),Runtime=require('../sqlite-runtime');
function fixture(t,setup=()=>{}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sf-activation-')),db=new D(path.join(dir,'slotforge-timing.json'));db.data.drivers=[{id:'driver',name:'Kept'}];db.data.slotcars=[{id:'car',model:'Kept'}];db.saveNow();
 setup(db);db.saveNow();const original=fs.readFileSync(db.file);t.after(async()=>{await db.writesIdle();assert.deepEqual(fs.readFileSync(db.file),original);fs.rmSync(dir,{recursive:true,force:true});});return {dir,db};
}
test('activation is explicit, verified, durable and never falls back to legacy JSON',async t=>{
 const {dir}=fixture(t);assert.equal(await Activation.startup(dir),null);Activation.request(dir);const chosen=await Activation.startup(dir);assert.equal(chosen.backend,'sqlite');
 let r=await Runtime.open(chosen.directory,{profileRoot:dir});await r.records.update('drivers','driver',{name:'SQLite only'});await r.lifecycle.shutdown();
 r=await Runtime.open((await Activation.startup(dir)).directory,{profileRoot:dir});assert.equal((await r.records.get('drivers','driver')).name,'SQLite only');await r.lifecycle.shutdown();
 fs.writeFileSync(path.join(chosen.directory,'working','working.sqlite'),'broken');await assert.rejects(Runtime.open(chosen.directory));assert.equal(Activation.selected(dir).generation,chosen.generation);
 fs.writeFileSync(path.join(dir,'storage-backend.json'),'{broken');await assert.rejects(Activation.startup(dir),/cannot be read/);
});
for(const phase of ['before-copy','copy-verified','fork-created','working-verified','before-publish','after-publish'])test('abrupt activation exit at '+phase+' preserves a recoverable selection',async t=>{
 const {dir}=fixture(t);Activation.request(dir);
 const script="require(process.argv[1]).startup(process.argv[2],{checkpoint:p=>{if(p===process.argv[3])process.exit(73)}}).then(()=>process.exit(0)).catch(()=>process.exit(1));";
 const result=spawnSync(process.execPath,['-e',script,require.resolve('../storage-activation'),dir,phase],{stdio:'pipe',windowsHide:true,timeout:30000});assert.equal(result.status,73,String(result.stderr));
 const published=Activation.selected(dir);assert.equal(!!published,phase==='after-publish');const selected=await Activation.startup(dir);if(published)assert.equal(selected.generation,published.generation);
 const r=await Runtime.open(selected.directory,{profileRoot:dir});try{assert.equal((await r.records.get('drivers','driver')).name,'Kept');}finally{await r.lifecycle.shutdown();}
});
test('invalid requests and escaping selections fail closed without a new database',async t=>{
 const {dir}=fixture(t);fs.writeFileSync(path.join(dir,'sqlite-activation-request.json'),JSON.stringify({format:Activation.REQUEST,version:9,id:'x'}));await assert.rejects(Activation.startup(dir),/Invalid/);
 fs.writeFileSync(path.join(dir,'storage-backend.json'),JSON.stringify({format:Activation.FORMAT,version:1,backend:'sqlite',generation:'../elsewhere'}));await assert.rejects(Activation.startup(dir),/Unsupported/);assert(!fs.existsSync(path.join(dir,'sqlite')));
});

for(const phase of ['session-written','laps-written','finalization-reconciled','before-commit','after-commit'])test('abrupt finalization exit at '+phase+' commits all results or none',async t=>{
 const {dir}=fixture(t);Activation.request(dir);const selected=await Activation.startup(dir),work=path.join(selected.directory,'working');
 const snap={v:1,race:{storageRunId:'run',setup:{id:'race'}},eng:{v:1},phase:'review'};
 let r=await Runtime.open(selected.directory);await r.lifecycle.saveResume(snap);await r.client.command({id:'connect',type:'setPaddockConnection',expectedRevision:0,connection:{databaseId:'host',address:'127.0.0.1:5000',name:'Fixture',timing:true,results:true}});await r.lifecycle.shutdown();
 const journal={captures:{car:{name:'Kept',configuration:{databaseId:'host',carId:'remote'}}},lanes:[20],heats:[{id:'1',name:'Heat',startedAt:100000,endedAt:120000,entries:[{carId:'car',driverId:'driver',driverName:'Kept',lane:1,laps:[{number:1,time:1500,at:110000,driverId:'driver',valid:true}]}]}]};
 const command={id:'finalize-crash',type:'finalizeSession',session:{saveKey:'run',setupName:'Crash race',standings:[],paddockJournal:journal},laps:[{carId:'car',driverId:'driver',time:1500,valid:true}]};
 const file=path.join(dir,'command.json');fs.writeFileSync(file,JSON.stringify(command));
 const script="const S=require(process.argv[1]).WorkingStore,s=new S(process.argv[2],{checkpoint:p=>{if(p===process.argv[4])process.exit(73)}});s.command(JSON.parse(require('fs').readFileSync(process.argv[3])));if(process.argv[4]==='after-commit')process.exit(73);s.close();";
 const result=spawnSync(process.execPath,['-e',script,require.resolve('../sqlite-working'),work,file,phase],{stdio:'pipe',windowsHide:true,timeout:30000});assert.equal(result.status,73,String(result.stderr));
 r=await Runtime.open(selected.directory);try{
  const committed=phase==='after-commit';assert.equal((await r.records.list('sessions')).length,committed?1:0);assert.equal((await r.records.list('laps')).length,committed?1:0);assert.equal(!!await r.lifecycle.resume(),!committed);
  assert.equal((await r.client.outbox('host')).length,committed?1:0);
  const saved=await r.records.saveSession(command.session,command.laps);assert.equal(await r.records.saveSession({...command.session,date:'a later retry'},command.laps),saved);
  await r.lifecycle.saveResume(snap);assert.equal(await r.lifecycle.resume(),null);assert.equal((await r.records.get('slotcars','car')).lapsDriven,1);assert.equal((await r.records.list('sessions')).length,1);
  await r.records.removeSession(saved);await assert.rejects(r.records.saveSession(command.session,command.laps),/deleted/);
 }finally{await r.lifecycle.shutdown();}
});
test('token stints reconcile atomically and late settings cannot resurrect saved stints',async t=>{
 const {dir}=fixture(t);Activation.request(dir);const selected=await Activation.startup(dir);let r=await Runtime.open(selected.directory);
 const tokens={setup:{storageRunId:'token-run',data:{v:1,closed:[{id:1},{id:2}],lanes:[{stint:null}]}}};await r.lifecycle.updateSettings({tokenSessions:tokens});
 await r.records.saveSession({saveKey:'token-run:1',sessionType:'tokens',standings:[]},[]);assert.deepEqual(r.lifecycle.settings().tokenSessions.setup.data.closed,[{id:2}]);await r.lifecycle.updateSettings({tokenSessions:tokens});await r.lifecycle.shutdown();
 r=await Runtime.open(selected.directory);try{assert.deepEqual(r.lifecycle.settings().tokenSessions.setup.data.closed,[{id:2}]);await r.records.saveSession({saveKey:'token-run:2',sessionType:'tokens',standings:[]},[]);await r.lifecycle.updateSettings({tokenSessions:tokens});assert.deepEqual(r.lifecycle.settings().tokenSessions,{});}finally{await r.lifecycle.shutdown();}
});

for(const phase of ['copy-verified','fork-created','before-publish','after-publish'])test('restore activation survives exit at '+phase+' and keeps the previous SQLite generation',async t=>{
 const {dir}=fixture(t);Activation.request(dir);const original=await Activation.startup(dir);let r=await Runtime.open(original.directory);
 const file=path.join(dir,'backup.json');await r.bulk.backup(file,{});await r.records.update('drivers','driver',{name:'After backup'});await r.lifecycle.shutdown();
 await Activation.requestRestore(dir,file,await Activation.digest(file));
 const script="require(process.argv[1]).startup(process.argv[2],{checkpoint:p=>{if(p===process.argv[3])process.exit(73)}}).catch(()=>process.exit(1));";
 const result=spawnSync(process.execPath,['-e',script,require.resolve('../storage-activation'),dir,phase],{stdio:'pipe',windowsHide:true,timeout:30000});assert.equal(result.status,73,String(result.stderr));
 const selected=await Activation.startup(dir);assert.notEqual(selected.generation,original.generation);
 r=await Runtime.open(selected.directory);assert.equal((await r.records.get('drivers','driver')).name,'Kept');await r.lifecycle.shutdown();
 r=await Runtime.open(original.directory);assert.equal((await r.records.get('drivers','driver')).name,'After backup');await r.lifecycle.shutdown();
});
test('changed restore input is rejected and changed JSON cannot be activated',async t=>{
 const {dir,db}=fixture(t);Activation.request(dir);await assert.rejects(Activation.startup(dir,{checkpoint:p=>{if(p==='working-verified')fs.writeFileSync(db.file,'{}');}}),/changed before activation/);
 // Restore the generated source before the fixture's unchanged-source check.
 db.saveNow();assert.equal(Activation.selected(dir),null);const selected=await Activation.startup(dir),r=await Runtime.open(selected.directory);const file=path.join(dir,'backup.json');await r.bulk.backup(file,{});await r.lifecycle.shutdown();
 const hash=await Activation.digest(file);fs.appendFileSync(file,' ');await assert.rejects(Activation.requestRestore(dir,file,hash),/changed after/);assert.equal(Activation.selected(dir).generation,selected.generation);
});
test('pending changes can be cancelled without removing either database or completed selection',async t=>{
 const {dir}=fixture(t);Activation.request(dir);assert.equal(Activation.canCancel(dir),true);Activation.cancel(dir);assert.equal(await Activation.startup(dir),null);
 Activation.request(dir);const selected=await Activation.startup(dir);const r=await Runtime.open(selected.directory),file=path.join(dir,'backup.json');await r.bulk.backup(file,{});await r.lifecycle.shutdown();
 await Activation.requestRestore(dir,file,await Activation.digest(file));assert.equal(Activation.canCancel(dir),true);Activation.cancel(dir);assert.equal((await Activation.startup(dir)).generation,selected.generation);assert.equal(Activation.canCancel(dir),false);
 await assert.rejects(Activation.requestRestore(dir,file,await Activation.digest(file),{beforePublish:()=>{throw Error('Race started');}}),/Race started/);assert.equal(Activation.canCancel(dir),false);
});
for(const phase of ['before-commit','after-commit'])test('token settings survive an abrupt finalization exit '+phase,async t=>{
 const {dir}=fixture(t);Activation.request(dir);const chosen=await Activation.startup(dir);let r=await Runtime.open(chosen.directory);
 const tokens={setup:{storageRunId:'tokens',data:{v:1,closed:[{id:1},{id:2}],lanes:[{stint:null}]}}};await r.lifecycle.updateSettings({tokenSessions:tokens});await r.lifecycle.shutdown();
 const command={id:'token-save',type:'finalizeSession',session:{saveKey:'tokens:1',sessionType:'tokens',standings:[]},laps:[]},file=path.join(dir,'token-command.json');fs.writeFileSync(file,JSON.stringify(command));
 const script="const S=require(process.argv[1]).WorkingStore,s=new S(process.argv[2],{checkpoint:p=>{if(p===process.argv[4])process.exit(73)}});s.command(JSON.parse(require('fs').readFileSync(process.argv[3])));process.exit(73);";
 const exited=spawnSync(process.execPath,['-e',script,require.resolve('../sqlite-working'),path.join(chosen.directory,'working'),file,phase],{stdio:'pipe',windowsHide:true,timeout:30000});assert.equal(exited.status,73,String(exited.stderr));
 r=await Runtime.open(chosen.directory);try{assert.equal((await r.records.list('sessions')).length,phase==='after-commit'?1:0);assert.deepEqual(r.lifecycle.settings().tokenSessions.setup.data.closed,phase==='after-commit'?[{id:2}]:[{id:1},{id:2}]);}finally{await r.lifecycle.shutdown();}
});
test('copying results strips their finalization identity; SQLite performance reports describe SQLite',()=>{
 const T=require('../transfer'),P=require('../renderer/perf');const bundle=T.collect({sessions:[{id:'s',saveKey:'private-run',standings:[]}],laps:[]},{sessions:['s']});assert.equal(bundle.items.sessions[0].saveKey,undefined);
 const main=P.cleanMain({database:{backend:'sqlite',physicalBytes:8192,media:{count:2,bytes:4096}}});const report=P.report(null,main,{});assert.match(report,/SQLite storage/);assert.doesNotMatch(report,/Race save: 0|Database file \(1\.61/);
});

test('shutdown drains an accepted finalization without failing its settings refresh',async t=>{
 const {dir}=fixture(t);Activation.request(dir);const chosen=await Activation.startup(dir);let r=await Runtime.open(chosen.directory);
 const saving=r.records.saveSession({saveKey:'shutdown-run',standings:[]},[]),closing=r.lifecycle.shutdown();
 const id=await saving;await closing;r=await Runtime.open(chosen.directory);try{assert.equal((await r.records.list('sessions'))[0].id,id);}finally{await r.lifecycle.shutdown();}
});

test('conversion reconciles already-saved legacy recovery identities on its copy',async t=>{
 const {dir}=fixture(t,db=>{
  db.data.sessions=[{id:'saved',saveKey:'legacy-run',standings:[]},{id:'stint',saveKey:'tokens:1',standings:[]}];
  db.setSettings({tokenSessions:{setup:{storageRunId:'tokens',data:{closed:[{id:1},{id:2}],lanes:[{stint:null}]}}}});
  db.setResume({v:1,race:{storageRunId:'legacy-run',setup:{id:'race'}},eng:{v:1},phase:'review'});
 });
 const before=fs.readFileSync(path.join(dir,'race-resume.json'));Activation.request(dir);const chosen=await Activation.startup(dir),r=await Runtime.open(chosen.directory);
 try{assert.equal(await r.lifecycle.resume(),null);assert.deepEqual(r.lifecycle.settings().tokenSessions.setup.data.closed,[{id:2}]);assert.equal((await r.records.list('sessions')).length,2);}finally{await r.lifecycle.shutdown();}
 assert.deepEqual(fs.readFileSync(path.join(dir,'race-resume.json')),before);
});

test('native backup and restore preserve deleted-result finalization tombstones',async t=>{
 const {dir}=fixture(t);Activation.request(dir);const chosen=await Activation.startup(dir),r=await Runtime.open(chosen.directory);
 const session={saveKey:'deleted-run',standings:[]},backup=path.join(dir,'native-backup'),destination=path.join(dir,'native-restored');
 try{const id=await r.records.saveSession(session,[]);await r.records.removeSession(id);await r.client.backupSnapshot(backup);await r.client.restoreSnapshot(backup,destination);}finally{await r.lifecycle.shutdown();}
 const client=new(require('../sqlite-client'))();await client.openWorking(destination);
 try{await assert.rejects(client.command({id:'resurrect',type:'finalizeSession',session,laps:[]}),/deleted/);}finally{await client.close();}
});
