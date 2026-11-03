'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {migrateCopy}=require('../sqlite-migration'),{forkCopy,WorkingStore}=require('../sqlite-working'),Bulk=require('../sqlite-bulk'),Activation=require('../storage-activation');
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sf-resilience-')),source=path.join(dir,'slotforge-timing.json'),copy=path.join(dir,'copy'),work=path.join(dir,'work');
 fs.writeFileSync(source,JSON.stringify({version:1,settings:{theme:'dark'},drivers:[{id:'d',name:'Kept'}],slotcars:[{id:'c',model:'Kept',lapsDriven:0}],sessions:[],laps:[]}));
 const original=fs.readFileSync(source);migrateCopy({source,destination:copy});forkCopy(copy,work);const s=new WorkingStore(work);
 t.after(()=>{s.close();assert.deepEqual(fs.readFileSync(source),original);fs.rmSync(dir,{recursive:true,force:true});});return {dir,source,copy,work,s};
}
const full=()=>Object.assign(Error('No space left on device'),{code:'ENOSPC'});
for(const kind of ['result','settings','record'])test('real SQLITE_FULL rolls back '+kind+' and permits an exact retry',t=>{
 const {s}=fixture(t);const snap={v:1,race:{storageRunId:'run'},eng:{v:1}};
 s.command({id:'recovery',type:'setRaceResume',expectedRevision:0,snapshot:snap});
 const big='x'.repeat(2*1024*1024);
 const cmd=kind==='result'?{id:'write',type:'finalizeSession',session:{saveKey:'run',notes:big,standings:[]},laps:[{carId:'c',time:5000,valid:true}]}:kind==='settings'?{id:'write',type:'setSettings',expectedRevision:s.revision('@meta','settings'),patch:{note:big}}:{id:'write',type:'updateRecord',entity:'drivers',recordId:'d',expectedRevision:s.revision('drivers','d'),patch:{name:'Changed',notes:big}};
 const counts=()=>s.statement('SELECT count(*) n FROM records').get().n,original=counts(),revision=s.revision('drivers','d');
 s.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');const pages=s.statement('PRAGMA page_count').get().page_count;s.db.exec('PRAGMA max_page_count='+pages);
 assert.throws(()=>s.command(cmd),e=>{assert.equal(e.errcode&255,13);return true;});
 assert.equal(counts(),original);assert.equal(s.receipt('write'),null);assert.equal(s.revision('drivers','d'),revision);assert.equal(s.get('@meta','raceResume').value.race.storageRunId,'run');assert.equal(s.field('slotcars','c',['lapsDriven']).value,0);
 assert.equal(s.statement('PRAGMA integrity_check').get().integrity_check,'ok');assert.deepEqual(s.statement('PRAGMA foreign_key_check').all(),[]);
 s.db.exec('PRAGMA max_page_count=2147483646');const saved=s.command(cmd);assert.deepEqual(s.command(cmd),saved);
 if(kind==='result'){assert.equal(s.field('slotcars','c',['lapsDriven']).value,1);assert.equal(s.get('@meta','raceResume').value,null);}
});
for(const operation of ['writeFileSync','fsyncSync','renameSync'])test('ENOSPC during selection '+operation+' never replaces the previous marker',t=>{
 const {dir}=fixture(t),file=path.join(dir,'selection.json');Activation.publish(file,{kept:true});
 const original=fs.readFileSync(file);const mock=t.mock.method(fs,operation,()=>{throw full();});
 assert.throws(()=>Activation.publish(file,{kept:false}),{code:'ENOSPC'});mock.mock.restore();assert.deepEqual(fs.readFileSync(file),original);
 Activation.publish(file,{kept:false});assert.equal(JSON.parse(fs.readFileSync(file)).kept,false);
});
test('disk-full migration never publishes a copy or changes the source',t=>{
 const {dir,source}=fixture(t),destination=path.join(dir,'failed-copy');const original=fs.writeFileSync;
 const mock=t.mock.method(fs,'writeFileSync',(...args)=>{if(typeof args[0]==='number')throw full();return original(...args);});
 assert.throws(()=>migrateCopy({source,destination}),{code:'ENOSPC'});mock.mock.restore();assert(!fs.existsSync(path.join(destination,'manifest.json')));
 migrateCopy({source,destination:path.join(dir,'retry-copy')});
});
for(const operation of ['writeFileSync','fsyncSync','linkSync'])test('disk-full legacy export '+operation+' leaves no published backup and can retry',t=>{
 const {dir,s}=fixture(t),file=path.join(dir,'backup.json');const mock=t.mock.method(fs,operation,()=>{throw full();});
 assert.throws(()=>Bulk.exportLegacy(s,file),{code:'ENOSPC'});mock.mock.restore();assert(!fs.existsSync(file));assert(!fs.readdirSync(dir).some(n=>n.startsWith('backup.json.')));
 Bulk.exportLegacy(s,file);assert.equal(JSON.parse(fs.readFileSync(file)).data.drivers[0].name,'Kept');
});
test('full snapshot manifest and restore copy cannot be mistaken for completed backups',t=>{
 const {dir,s}=fixture(t),failed=path.join(dir,'failed-backup');const mock=t.mock.method(fs,'fsyncSync',()=>{throw full();});
 assert.throws(()=>Bulk.snapshot(s,failed),{code:'ENOSPC'});mock.mock.restore();assert(!fs.existsSync(path.join(failed,'manifest.json')));
 const good=path.join(dir,'good-backup');Bulk.snapshot(s,good);const target=path.join(dir,'failed-restore'),cp=t.mock.method(fs,'copyFileSync',()=>{throw full();});
 assert.throws(()=>Bulk.restore(good,target),{code:'ENOSPC'});cp.mock.restore();assert(!fs.existsSync(path.join(target,'working.sqlite')));assert.equal(s.get('drivers','d').value.name,'Kept');
 Bulk.restore(good,path.join(dir,'restored'));
});
test('Unicode and spaced paths survive production activation, backup, and reopen',async t=>{
 const {dir,source}=fixture(t),profile=path.join(dir,'Timing café 日本'),backup=path.join(dir,'Backup café 日本');fs.mkdirSync(profile);fs.copyFileSync(source,path.join(profile,'slotforge-timing.json'));
 Activation.request(profile);const chosen=await Activation.startup(profile),Runtime=require('../sqlite-runtime');let r=await Runtime.open(chosen.directory,{profileRoot:profile});
 try{await r.records.update('drivers','d',{name:'Zoë 日本'});await r.client.backupSnapshot(backup);}finally{await r.lifecycle.shutdown();}
 r=await Runtime.open((await Activation.startup(profile)).directory,{profileRoot:profile});try{assert.equal((await r.records.get('drivers','d')).name,'Zoë 日本');}finally{await r.lifecycle.shutdown();}
});

test('legacy limits reject impossible V8 strings before reading or copying input',t=>{
 const {dir,source}=fixture(t),Migration=require('../sqlite-migration');
 assert(Migration.MAX_JSON_BYTES<=require('node:buffer').constants.MAX_STRING_LENGTH);assert.equal(Bulk.MAX_LEGACY,Migration.MAX_JSON_BYTES);
 const stat=fs.statSync;const mock=t.mock.method(fs,'statSync',(file,...args)=>file===source?{isFile:()=>true,size:Migration.MAX_JSON_BYTES+1}:stat(file,...args));
 const read=fs.readFileSync;let readSource=false;const reader=t.mock.method(fs,'readFileSync',(file,...args)=>{if(file===source)readSource=true;return read(file,...args);});
 assert.throws(()=>Migration.migrateCopy({source,destination:path.join(dir,'too-large')}),/runtime legacy size limit/);reader.mock.restore();mock.mock.restore();assert.equal(readSource,false);
});

test('SQLITE_FULL after domain writes rolls back recovery reconciliation and counters',t=>{
 const {s}=fixture(t);s.command({id:'recovery',type:'setRaceResume',expectedRevision:0,snapshot:{v:1,race:{storageRunId:'full-late'},eng:{v:1}}});
 const cmd={id:'late',type:'finalizeSession',session:{saveKey:'full-late',standings:[]},laps:[{carId:'c',time:5000,valid:true}]};
 s.checkpoint=phase=>{if(phase==='domain-written'){const pages=s.statement('PRAGMA page_count').get().page_count;s.db.exec('PRAGMA max_page_count='+pages);s.db.exec('CREATE TABLE pressure(b BLOB);INSERT INTO pressure VALUES(zeroblob(2097152))');}};
 assert.throws(()=>s.command(cmd),e=>(e.errcode&255)===13);s.checkpoint=()=>{};s.db.exec('PRAGMA max_page_count=2147483646');
 assert.equal(s.receipt('late'),null);assert.equal(s.get('@meta','raceResume').value.race.storageRunId,'full-late');assert.equal(s.statement('SELECT count(*) n FROM session_finalizations').get().n,0);assert.equal(s.field('slotcars','c',['lapsDriven']).value,0);
 const id=s.command(cmd).sessionId;assert.equal(s.command(cmd).sessionId,id);assert.equal(s.field('slotcars','c',['lapsDriven']).value,1);
});

for(const phase of ['before-publish','after-publish'])test('native restore recovers from an abrupt exit '+phase,async t=>{
 const {dir}=fixture(t);Activation.request(dir);const old=await Activation.startup(dir),Runtime=require('../sqlite-runtime');let r=await Runtime.open(old.directory);const backup=path.join(dir,'native');
 await r.client.backupSnapshot(backup);await r.records.update('drivers','d',{name:'Newer'});await r.lifecycle.shutdown();await Activation.requestNativeRestore(dir,backup);
 const script="require(process.argv[1]).startup(process.argv[2],{checkpoint:p=>{if(p===process.argv[3])process.exit(73)}}).catch(()=>process.exit(1));";
 const result=require('node:child_process').spawnSync(process.execPath,['-e',script,require.resolve('../storage-activation'),dir,phase],{stdio:'pipe',windowsHide:true,timeout:30000});assert.equal(result.status,73,String(result.stderr));
 const restored=await Activation.startup(dir);assert.notEqual(restored.generation,old.generation);r=await Runtime.open(restored.directory);assert.equal((await r.records.get('drivers','d')).name,'Kept');await r.lifecycle.shutdown();
 r=await Runtime.open(old.directory);assert.equal((await r.records.get('drivers','d')).name,'Newer');await r.lifecycle.shutdown();
});

test('corrupt native input and an asynchronous restore cancellation never select a replacement',async t=>{
 const {dir}=fixture(t);Activation.request(dir);const old=await Activation.startup(dir),r=await require('../sqlite-runtime').open(old.directory),backup=path.join(dir,'native');await r.client.backupSnapshot(backup);await r.lifecycle.shutdown();
 await assert.rejects(Activation.requestNativeRestore(dir,backup,{beforePublish:async()=>{throw Error('Race started');}}),/Race started/);assert.equal(Activation.canCancel(dir),false);
 fs.appendFileSync(path.join(backup,'snapshot.sqlite'),'corrupt');await assert.rejects(Activation.requestNativeRestore(dir,backup),/checksum/);assert.equal(Activation.selected(dir).generation,old.generation);
});

test('disk-full native restore staging preserves the active generation and permits retry',async t=>{
 const {dir}=fixture(t);Activation.request(dir);const old=await Activation.startup(dir),r=await require('../sqlite-runtime').open(old.directory),backup=path.join(dir,'native');await r.client.backupSnapshot(backup);await r.lifecycle.shutdown();
 const cp=t.mock.method(fs.promises,'copyFile',async()=>{throw full();});await assert.rejects(Activation.requestNativeRestore(dir,backup),{code:'ENOSPC'});cp.mock.restore();
 assert.equal(Activation.canCancel(dir),false);assert.equal(Activation.selected(dir).generation,old.generation);
 await Activation.requestNativeRestore(dir,backup);assert.equal(Activation.canCancel(dir),true);const next=await Activation.startup(dir);assert.notEqual(next.generation,old.generation);
});

test('JSON restore awaits asynchronous final checks before publishing a request',async t=>{
 const {dir}=fixture(t);Activation.request(dir);const old=await Activation.startup(dir),file=path.join(dir,'restore.json');fs.writeFileSync(file,'{}');
 await assert.rejects(Activation.requestRestore(dir,file,await Activation.digest(file),{beforePublish:async()=>{throw Error('Race started');}}),/Race started/);
 assert.equal(Activation.canCancel(dir),false);assert.equal(Activation.selected(dir).generation,old.generation);
});
