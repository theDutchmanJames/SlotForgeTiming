'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const Database=require('../db'),Transfer=require('../transfer'),Backup=require('../backup'),Bulk=require('../sqlite-bulk');
const {migrateCopy}=require('../sqlite-migration'),{WorkingStore,forkCopy}=require('../sqlite-working'),Client=require('../sqlite-client');
const {JsonBulkStorage}=require('../bulk-storage');
const image='data:image/png;base64,YWJjZA==',audio='data:audio/wav;base64,ZWZnaA==';
async function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sf-bulk-')),source=path.join(dir,'source.json'),db=new Database(source);
 db.data.drivers=[{id:'d',name:'Driver',custom:{club:'A'}}];db.data.slotcars=[{id:'c',model:'Car',picture:image,paddock:{databaseId:'host',carId:'remote'}}];db.data.tracks=[{id:'t',name:'Track'}];
 db.data.audiosets=[{id:'a',name:'Sounds',calls:{start:{lines:[{audio}]}}}];db.data.imagesets=[{id:'i',name:'Pictures',extension:{image,wrapped:'data:image/png;base64,YWJj\nZA=='}}];
 db.data.customFields.drivers=[{id:'club',label:'Club',type:'text'}];
 db.data.sessions=[{id:'s',trackId:'t',resourceRunId:'original-run',standings:[{driverId:'d',carId:'c',laps:1}],paddockDelivery:{status:'sent'},extension:{keep:[{},[],image]}}];
 db.data.laps=[{id:'l',sessionId:'s',driverId:'d',carId:'c',trackId:'t',time:10000,valid:true}];
 db.data.extension={empty:{},array:[[],image,audio]};db.data.resourceLedger={profiles:{},checkpoint:null};db.saveNow();
 await db.setSettingsAsync({theme:'light',example:'sidecar only'});const before=fs.readFileSync(source),settings=fs.readFileSync(db.settingsPath);
 migrateCopy({source,destination:path.join(dir,'copy')});const work=path.join(dir,'work');forkCopy(path.join(dir,'copy'),work);const store=new WorkingStore(work);
 t.after(async()=>{store.close();await db.writesIdle();assert.deepEqual(fs.readFileSync(source),before);assert.deepEqual(fs.readFileSync(db.settingsPath),settings);fs.rmSync(dir,{recursive:true,force:true});});
 return {dir,source,db,store,work};
}
test('selected SQLite exports match JSON dependencies, media and privacy exactly',async t=>{
 const {store,db}=await fixture(t),picks={sessions:['s'],audiosets:['a'],imagesets:['i']},info={date:'fixed'};
 assert.deepEqual(Bulk.collect(store,picks,true,info),Transfer.collect(db.data,picks,true,info));
 assert.deepEqual(Bulk.dependencies(store,picks),Transfer.dependencies(db.data,picks));
 const calls=[],get=store.get.bind(store);store.get=(e,id,...rest)=>{calls.push([e,id]);return get(e,id,...rest);};
 assert.equal(Bulk.collect(store,{drivers:['d']}).items.drivers[0].name,'Driver');assert(!calls.some(([e])=>['laps','imagesets','audiosets','slotcars'].includes(e)));
});
test('import remaps links and custom fields, strips Paddock, survives reopen and retries once',async t=>{
 const {store,db,work}=await fixture(t),bundle=Transfer.collect(db.data,{sessions:['s'],audiosets:['a'],imagesets:['i']});
 const command={id:'import',type:'importItems',bundle},result=store.command(command);assert.equal(result.laps,1);assert.deepEqual(store.command(command),result);
 const sessions=store.statement("SELECT id FROM records WHERE entity='sessions' AND id!='s'").all();assert.equal(sessions.length,1);
 const session=store.get('sessions',sessions[0].id,true).value,lap=store.get('laps',store.sessionLaps(session.id)[0].id).value;
 assert.notEqual(lap.carId,'c');assert.equal(session.standings[0].carId,lap.carId);assert.equal(session.paddockDelivery,undefined);assert.equal(session.resourceRunId,undefined);assert.equal(store.statement('SELECT count(*) n FROM resource_sessions').get().n,1);
 assert.equal(store.get('slotcars',lap.carId,true).value.picture,image);assert.equal(store.get('slotcars',lap.carId).value.paddock,undefined);
 assert.equal(store.get('drivers',lap.driverId).value.custom.club,'A');assert.equal(store.historyPage('racing').sessions.items.length,2);
 store.close();const reopened=new WorkingStore(work);try{assert.deepEqual(reopened.command(command),result);assert.equal(reopened.statement("SELECT count(*) n FROM records WHERE entity='laps'").get().n,2);}finally{reopened.close();}
});
test('import disk failure rolls back records, assets, indexes and receipt',async t=>{
 const {store,db}=await fixture(t),before=store.statement('SELECT count(*) n FROM records').get().n;
 store.checkpoint=stage=>{if(stage==='import-written')throw Error('disk full');};
 assert.throws(()=>store.command({id:'fail',type:'importItems',bundle:Transfer.collect(db.data,{sessions:['s']})}),/disk full/);
 assert.equal(store.statement('SELECT count(*) n FROM records').get().n,before);assert.equal(store.receipt('fail'),null);assert.equal(store.sessionLaps('s').length,1);
});
test('snapshot includes uncheckpointed WAL writes, media and receipt; restore leaves active copy unchanged',async t=>{
 const {store,dir,work}=await fixture(t);store.command({id:'edit',type:'updateRecord',entity:'drivers',recordId:'d',expectedRevision:0,patch:{name:'Latest'}});
 const target=path.join(dir,'backup');const report=Bulk.snapshot(store,target);assert(report.assets>=3);
 store.command({id:'later',type:'updateRecord',entity:'drivers',recordId:'d',expectedRevision:1,patch:{name:'Later'}});
 const dest=path.join(dir,'restore');Bulk.restore(target,dest);const restored=new WorkingStore(dest);
 try{assert.equal(restored.get('drivers','d').value.name,'Latest');assert.equal(store.get('drivers','d').value.name,'Later');assert.deepEqual(restored.get('@meta','extension',true).value,{empty:{},array:[[],image,audio]});assert.equal(restored.get('@meta','settings').value.example,'sidecar only');assert.equal(restored.get('sessions','s').value.resourceRunId,'original-run');assert.equal(restored.statement('SELECT sessionId FROM resource_sessions WHERE runId=?').get('original-run').sessionId,'s');assert(restored.receipt('edit'));assert.equal(restored.receipt('later'),null);}finally{restored.close();}
 assert.throws(()=>Bulk.restore(target,work),/EEXIST/);assert.throws(()=>Bulk.snapshot(store,target),/EEXIST/);
});
test('corruption, unsupported version and interrupted publication never create a usable restore',async t=>{
 const {store,dir}=await fixture(t),backup=path.join(dir,'backup');Bulk.snapshot(store,backup);
 const dest=path.join(dir,'interrupted');assert.throws(()=>Bulk.restore(backup,dest,()=>{throw Error('power cut');}),/power cut/);assert(!fs.existsSync(path.join(dest,'working.sqlite')));
 const broken=path.join(dir,'broken');assert.throws(()=>Bulk.snapshot(store,broken,{},()=>{throw Error('disk full');}),/disk full/);assert(!fs.existsSync(path.join(broken,'manifest.json')));assert.throws(()=>Bulk.restore(broken,path.join(dir,'nope')));
 const file=path.join(backup,'snapshot.sqlite');fs.appendFileSync(file,'changed');assert.throws(()=>Bulk.restore(backup,path.join(dir,'corrupt')),/checksum/);assert(!fs.existsSync(path.join(dir,'corrupt','working.sqlite')));
 const m=path.join(backup,'manifest.json'),manifest=JSON.parse(fs.readFileSync(m));manifest.version=99;fs.writeFileSync(m,JSON.stringify(manifest));assert.throws(()=>Bulk.restore(backup,path.join(dir,'future')),/Unsupported/);
});
test('streamed legacy backup round trips every root and restores only into copies',async t=>{
 const {store,dir,db}=await fixture(t),file=path.join(dir,'backup.json');Bulk.exportLegacy(store,file);
 const parsed=JSON.parse(fs.readFileSync(file));assert(Backup.check(parsed).ok);assert.deepEqual(parsed.data,db.data);
 assert.throws(()=>Bulk.exportLegacy(store,file),/not overwritten/);
 const result=Bulk.restoreLegacy(file,path.join(dir,'legacy'));assert.deepEqual(fs.readFileSync(path.join(dir,'legacy','original-backup.json')),fs.readFileSync(file));
 const restored=new WorkingStore(result.destination);try{assert.deepEqual(restored.get('sessions','s',true).value,db.data.sessions[0]);assert.equal(restored.get('@meta','settings').value.example,'sidecar only');}finally{restored.close();}
 const fail=path.join(dir,'fail.json');assert.throws(()=>Bulk.exportLegacy(store,fail,{},()=>{throw Error('disk full');}),/disk full/);assert(!fs.existsSync(fail));assert(!fs.readdirSync(dir).some(n=>n.startsWith('fail.json.')));
});
test('file import review detects replacement and worker receipt prevents duplicate retries',async t=>{
 const {store,dir,work,db}=await fixture(t);store.close();const client=new Client();await client.openWorking(work);try{
 const file=path.join(dir,'items.json');fs.writeFileSync(file,JSON.stringify(Transfer.collect(db.data,{drivers:['d']})));
 const review=await client.inspectImport(file);const first=await client.bulkImport(file,'file-import',review.sha256);assert.deepEqual(await client.bulkImport(file,'file-import',review.sha256),first);
 fs.writeFileSync(file,JSON.stringify(Transfer.collect(db.data,{slotcars:['c']})));await assert.rejects(client.bulkImport(file,'new',review.sha256),/changed since review/);
 const backup=path.join(dir,'worker-backup');await client.backupSnapshot(backup);const restored=path.join(dir,'worker-restored');await client.restoreSnapshot(backup,restored);
 const legacy=path.join(dir,'worker.json');await client.exportLegacy(legacy);assert(Backup.check(JSON.parse(fs.readFileSync(legacy))).ok);
 }finally{await client.close();}
});
test('JSON safety backup includes sidecar settings; write failure prevents a misleading recovery copy',async t=>{
 const {db}=await fixture(t),bulk=new JsonBulkStorage(db),file=await bulk.safetyCopy();const recovered=JSON.parse(fs.readFileSync(file));assert(Backup.check(recovered).ok);assert.deepEqual(recovered.data,db.data);
 const saved=db.file;db.file=path.join(saved,'missing','db.json');try{await assert.rejects(bulk.safetyCopy());}finally{db.file=saved;}
});
test('duplicate imported identities are rejected before any mutation; unusual legacy IDs remap safely',async t=>{
 const {store}=await fixture(t),bundle={format:Transfer.FORMAT,fileVersion:1,items:{drivers:[{id:'same',name:'A'},{id:'same',name:'B'}]}};
 assert.equal(Transfer.check(bundle).ok,false);assert.throws(()=>store.command({id:'duplicate',type:'importItems',bundle}),/duplicate/);assert.equal(store.receipt('duplicate'),null);
 bundle.items.drivers=[{id:'__proto__',name:'Old identity'}];bundle.items.sessions=[{id:'old-session',standings:[{driverId:'__proto__'}]}];store.command({id:'unusual',type:'importItems',bundle});
 const result=store.statement("SELECT id FROM records WHERE entity='sessions' AND id!='s'").get();assert.equal(store.get('drivers',store.get('sessions',result.id).value.standings[0].driverId).value.name,'Old identity');
});
test('export resolves frozen classes and custom tyre systems, while omitting unrelated cars',async t=>{
 const {store,db}=await fixture(t);db.data.slotcars[0].tyreCompound='C_0123456789ABCDEF';db.data.tyrewearsystems=[{id:'tyre',name:'Custom tyre',tyres:{C_0123456789ABCDEF:{name:'Club'}}}];db.data.sessions[0].multiclass={classes:[{id:'deleted-class',name:'Historic'}]};
 store.changed=new Map();store.transaction(()=>{store.replace('slotcars','c',db.data.slotcars[0]);store.replace('sessions','s',db.data.sessions[0]);store.insert('tyrewearsystems',db.data.tyrewearsystems[0]);});
 assert.deepEqual(Bulk.collect(store,{sessions:['s']},true,{date:'fixed'}),Transfer.collect(db.data,{sessions:['s']},true,{date:'fixed'}));
});
test('native verification rejects internally corrupted media even with an updated file checksum',async t=>{
 const {store,dir}=await fixture(t),target=path.join(dir,'backup');Bulk.snapshot(store,target);
 const file=path.join(target,'snapshot.sqlite'),sqlite=new (require('node:sqlite').DatabaseSync)(file);sqlite.exec("UPDATE media_blobs SET bytes=x'626164'");sqlite.close();
 const manifestFile=path.join(target,'manifest.json'),manifest=JSON.parse(fs.readFileSync(manifestFile));manifest.sha256=Bulk.digest(file);fs.writeFileSync(manifestFile,JSON.stringify(manifest));
 assert.throws(()=>Bulk.restore(target,path.join(dir,'invalid')),/checksum/);assert(!fs.existsSync(path.join(dir,'invalid','working.sqlite')));
});
test('legacy partial backups are defaulted, invalid backups leave no working copy',async t=>{
 const {dir}=await fixture(t),file=path.join(dir,'partial.json');fs.writeFileSync(file,JSON.stringify(Backup.make({drivers:[{id:'old',name:'Older backup'}]})));
 const result=Bulk.restoreLegacy(file,path.join(dir,'partial'));const copy=new WorkingStore(result.destination);try{assert.equal(copy.get('@meta','settings').value.theme,'dark');assert.equal(copy.page('laps').length,0);assert.equal(copy.get('drivers','old').value.name,'Older backup');}finally{copy.close();}
 fs.writeFileSync(file,JSON.stringify(Backup.make({drivers:'broken'})));assert.throws(()=>Bulk.restoreLegacy(file,path.join(dir,'invalid')),/not a list/);assert(!fs.existsSync(path.join(dir,'invalid')));
});
test('JSON exports cannot overwrite the active database, settings or race recovery file',async t=>{
 const {db}=await fixture(t),bulk=new JsonBulkStorage(db);for(const target of [db.file,db.settingsPath,db.resumeFile()])await assert.rejects(bulk.backup(target),/separate export/);
});
test('bulk IPC enforces window ownership, race guards and one mutation at a time',async()=>{
 const handlers={},sender={mainFrame:{}},win={webContents:sender,isDestroyed:()=>false};let racing=false,release;
 const access=require('../bulk-access')({ipcMain:{handle:(n,f)=>handlers[n]=f},getMain:()=>win,isRacing:()=>racing}),event={sender,senderFrame:sender.mainFrame};
 access.handle('transfer:apply',async()=>{await new Promise(r=>release=r);access.idle();return true;});
 await assert.rejects(handlers['transfer:apply']({sender:{}}),/main app/);await assert.rejects(handlers['transfer:apply']({sender,senderFrame:{}}),/main app/);
 racing=true;await assert.rejects(handlers['transfer:apply'](event),/Finish/);racing=false;
 const pending=handlers['transfer:apply'](event);await assert.rejects(handlers['transfer:apply'](event),/in progress/);racing=true;release();await assert.rejects(pending,/Finish/);racing=false;
 const next=handlers['transfer:apply'](event);release();assert.equal(await next,true);
});
for(const operation of ['snapshot','exportLegacy'])test('terminating a '+operation+' worker cannot publish a partial backup',async t=>{
 const {store,dir,work}=await fixture(t);store.close();const destination=path.join(dir,operation==='snapshot'?'cancelled':'cancelled.json');
 const {Worker}=require('node:worker_threads');
 const worker=new Worker(`const {parentPort,workerData:d}=require('node:worker_threads');const {WorkingStore}=require(d.working);const bulk=require(d.bulk),store=new WorkingStore(d.work);bulk[d.operation](store,d.destination,{},()=>{parentPort.postMessage('staged');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0);});`,{eval:true,workerData:{work,destination,operation,working:require.resolve('../sqlite-working'),bulk:require.resolve('../sqlite-bulk')}});
 try{await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);});}finally{await worker.terminate();}
 assert(!fs.existsSync(operation==='snapshot'?path.join(destination,'manifest.json'):destination));
 const reopened=new WorkingStore(work);try{assert.equal(reopened.get('drivers','d').value.name,'Driver');assert.equal(reopened.sessionLaps('s').length,1);}finally{reopened.close();}
});
test('oversized legacy transfer files fail before parsing or importing',async t=>{
 const {dir}=await fixture(t),file=path.join(dir,'oversized.json'),fd=fs.openSync(file,'wx');try{fs.ftruncateSync(fd,Bulk.MAX_TRANSFER+1);}finally{fs.closeSync(fd);}
 assert.throws(()=>Bulk.inspect(file),/size limit/);
});
test('SQLite content packs preserve saved layout styles and remap linked chart designs',async t=>{
 const {store,work}=await fixture(t),Widgets=require('../renderer/widgets');
 const chart=store.command({id:'chart',type:'addRecord',entity:'chartdesigns',item:{name:'Comparison',style:'bars'}});
 const widget=Widgets.newWidget('racechart',0,0,0);widget.opt={chartDesign:chart.recordId};
 const styles=[{id:'club',name:'Club',style:{appearance:{baseColor:'#123456'}}}];
 const layout=store.command({id:'layout',type:'addRecord',entity:'layouts',item:{name:'Race night',ratioW:16,ratioH:9,widgets:[widget],widgetStyles:styles}});store.close();
 const client=new Client();try{
  await client.openWorking(work);const bulk=new (require('../bulk-storage').SqliteBulkStorage)(client);
  const pack=await bulk.createPack({layouts:[layout.recordId]},{id:'club.test',name:'Club collection',author:'Club',license:'CC0-1.0',version:'1.0.0',minAppVersion:'1.99.2'},[],'2.0.0');
  assert.equal(pack.items.chartdesigns[0].id,chart.recordId);const result=await bulk.importItems({format:Transfer.FORMAT,fileVersion:1,items:pack.items,customFields:{}},{commandId:'pack-copy'});assert.equal(result.layouts,1);
  const rows=await client.page('layouts');assert.equal(rows.length,2);const copy=(await client.get('layouts',rows[1].id,true)).value;
  assert.notEqual(copy.widgets[0].opt.chartDesign,chart.recordId);assert.deepEqual(copy.widgetStyles,styles);assert.equal((await client.get('chartdesigns',copy.widgets[0].opt.chartDesign)).value.style,'bars');
 }finally{await client.close();}
});
for(const [name,sql] of [
 ['asset path',`UPDATE assets SET path='["missing","child"]' WHERE entity='slotcars'`],
 ['original data URI',`UPDATE assets SET original='data:image/png;base64,YmFk' WHERE entity='slotcars'`]
])test('native verification rejects a corrupted '+name,async t=>{
 const {store,dir}=await fixture(t),target=path.join(dir,'backup');Bulk.snapshot(store,target);
 const file=path.join(target,'snapshot.sqlite'),sqlite=new (require('node:sqlite').DatabaseSync)(file);sqlite.exec(sql);sqlite.close();
 const manifestFile=path.join(target,'manifest.json'),manifest=JSON.parse(fs.readFileSync(manifestFile));manifest.sha256=Bulk.digest(file);fs.writeFileSync(manifestFile,JSON.stringify(manifest));
 assert.throws(()=>Bulk.restore(target,path.join(dir,'invalid')),/media/);assert(!fs.existsSync(path.join(dir,'invalid','working.sqlite')));
});
