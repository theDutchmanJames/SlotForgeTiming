'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {Paddock,hash,request}=require('../paddock'),T=require('../paddock-local-transfers'),D=require('../paddock-local-discovery');
const Database=require('../db'),{SqlitePaddockStorage}=require('../paddock-storage'),Client=require('../sqlite-client'),Repository=require('../sqlite-repository');
const {migrateCopy}=require('../sqlite-migration'),{forkCopy}=require('../sqlite-working');
const key='a'.repeat(64)+'.json';
function profile(databaseId,carId){return {integrationVersion:1,databaseId,car:{id:carId,name:'Approved GT3',maker:'NSR',model:'GT3',raceClass:'GT3',archived:false},configuration:{databaseId,carId,carRevision:1,capturedAt:'2026-11-09T10:00:00.000Z',signature:'a'.repeat(64),technical:{weight:80}}};}
async function fixture(t,kind){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'timing-local-')),file=path.join(dir,'source.json'),db=new Database(file);db.data.slotcars=[{id:'car-a',brand:'NSR',model:'Local GT3',raceClass:'gt3',lapsDriven:123,damageFactor:1.3,custom:{club:'keep'}},{id:'car-b',model:'Local B'}];db.data.raceclasses=[{id:'gt3',name:'GT3'}];db.ensure();db.saveNow();const original=fs.readFileSync(file);let worker,repo,p;
 if(kind==='sqlite'){migrateCopy({source:file,destination:path.join(dir,'copy')});forkCopy(path.join(dir,'copy'),path.join(dir,'work'));worker=new Client();await worker.openWorking(path.join(dir,'work'));repo=new Repository(worker);p=new Paddock(null,{storage:new SqlitePaddockStorage(repo),deliveryStore:worker});}
 else p=new Paddock(db);
 t.after(async()=>{p.stop();await p.idle();await worker?.close();await db.writesIdle();if(kind==='sqlite')assert.deepEqual(fs.readFileSync(file),original);fs.rmSync(dir,{recursive:true,force:true});});
 let descriptor={format:'slotforge-local-library',version:1,instanceId:'instance-1',pid:1,address:'http://127.0.0.1:51000',token:'t'.repeat(43),databaseId:'library-1',name:'Test library',key};
 const receipts=new Map(),requests=[],calls=[];let loseResponse=false;
 p.localScan=async()=>descriptor?[{...descriptor}]:[];
 p.hostRequest=async(base,route,code,dbId,body,limit,instance)=>{
  calls.push({route,instance});assert.equal(code,descriptor.token);assert.equal(dbId,descriptor.databaseId);assert.equal(instance,descriptor.instanceId);assert.equal(base,descriptor.address);
  if(route==='/v1/status')return {id:descriptor.databaseId,name:'Test library',localInstanceId:descriptor.instanceId,permissions:{browse:true,timingResults:true,localImport:true},capabilities:{localLibrary:{version:1,imports:'/v1/local-library/imports'},timing:{versions:[1]}}};
  if(route==='/v1/local-library/imports'){
   requests.push(structuredClone(body));let r=receipts.get(body.transferId);if(!r){r={version:1,databaseId:body.databaseId,submissionId:'sub-'+body.transferId,sourceId:body.sourceId,transferId:body.transferId,hash:hash(body),status:'pending',cars:body.export.items.slotcars.map((c,i)=>({index:i,itemId:'item-'+i,timingCarId:c.id,action:body.targets?'link':'create',paddockCarId:body.targets?.[i].paddockCarId||'remote-'+c.id,decision:'pending',status:'pending',reviewedAt:null,carRevision:null,present:false,archived:false}))};receipts.set(body.transferId,r);}
   if(loseResponse){loseResponse=false;throw Error('Connection lost after commit');}return structuredClone(r);
  }
  if(route.startsWith('/v1/local-library/imports/')){const id=route.split('/')[5],r=receipts.get(id);if(!r)throw Object.assign(Error('Not received'),{code:'IMPORT_NOT_FOUND'});if(route.endsWith('/cancel')){for(const c of r.cars)if(c.status==='pending'&&body.itemIds.includes(c.itemId))Object.assign(c,{status:'cancelled',decision:'reject'});r.status=r.cars.some(c=>c.status==='pending')?'pending':'reviewed';}return structuredClone(r);}
  if(route.startsWith('/v1/timing/cars/'))return profile(descriptor.databaseId,route.split('/').at(-1));
  throw Error('Unexpected route '+route);
 };
 await p.connect({mode:'local',key,databaseId:'library-1'});clearTimeout(p.timer);clearTimeout(p.localTimer);
 return {p,db,worker,repo,dir,receipts,requests,calls,get:async id=>repo?(await repo.get('slotcars',id,true)).record.value:db.data.slotcars.find(c=>c.id===id),edit:async(id,patch)=>{if(repo){const r=await repo.get('slotcars',id);await repo.execute(require('node:crypto').randomUUID(),'updateRecord',{entity:'slotcars',recordId:id,expectedRevision:r.revision,patch});}else{Object.assign(db.data.slotcars.find(c=>c.id===id),patch);await db.commit();}},lose(){loseResponse=true;},descriptor(v){descriptor=v;},getDescriptor:()=>descriptor,approve(id){const r=receipts.get(id);r.status='reviewed';r.cars.forEach(c=>Object.assign(c,{status:'approved',decision:'accept',reviewedAt:'2026-11-09T11:00:00Z',carRevision:1,present:true}));}};
}
for(const kind of ['json','sqlite']){
 test(kind+': a missing receipt cannot undo a completed link or reapply changed specifications',async t=>{
  const f=await fixture(t,kind),[s]=await f.p.createLocalTransfers([{localId:'car-a'}]);f.approve(s.id);await f.p.refreshLocalTransfer(s.id);
  const approved=structuredClone(f.receipts.get(s.id));f.receipts.delete(s.id);
  await assert.rejects(f.p.refreshLocalTransfer(s.id),/no longer has/);
  assert.equal((await f.p.localTransfers())[0].state,'linked');
  await f.edit('car-a',{damageFactor:1.7});f.receipts.set(s.id,approved);
  f.p.profile=async()=>{throw Error('Completed transfers must not fetch and reapply a car');};
  await f.p.refreshLocalTransfer(s.id);
  const row=(await f.p.localTransfers())[0];assert.equal(row.state,'linked');assert.equal(row.error,'');
  assert.equal((await f.get('car-a')).damageFactor,1.7);assert.equal(f.requests.length,1);
 });
 test(kind+': review-gated linking keeps IDs/history/settings and exact durable retry',async t=>{
  const f=await fixture(t,kind);f.lose();const [s]=await f.p.createLocalTransfers([{localId:'car-a'}]);assert.equal(s.state,'queued');assert.match(s.error,/lost/);assert.equal((await f.get('car-a')).paddock,undefined);
  const journal=await f.p.storage.localRead({kind:'get',id:s.id,full:true});assert.equal(journal.request.export.items.raceclasses[0].name,'GT3');assert.equal(journal.request.export.items.slotcars[0].lapsDriven,undefined);
  await f.p.refreshLocalTransfer(s.id);assert.equal(f.requests.length,1);assert.equal((await f.p.localTransfers())[0].state,'pending');f.approve(s.id);await f.p.refreshLocalTransfer(s.id);
  const car=await f.get('car-a');assert.equal(car.id,'car-a');assert.equal(car.lapsDriven,123);assert.equal(car.damageFactor,1.3);assert.equal(car.custom.club,'keep');assert.equal(car.paddock.carId,'remote-car-a');assert.equal((await f.p.localTransfers())[0].state,'linked');
  const status=JSON.stringify(await f.p.status());assert(!status.includes(f.getDescriptor().token));assert(!JSON.stringify(journal).includes(f.getDescriptor().token));
  await f.p.refreshLocalTransfer(s.id);assert.equal((await f.get('car-a')).lapsDriven,123);
 });
 test(kind+': local edits block automatic approval; explicit reviewed revision is required',async t=>{
  const f=await fixture(t,kind),[s]=await f.p.createLocalTransfers([{localId:'car-a'}]);await f.edit('car-a',{model:'Changed locally'});f.approve(s.id);await f.p.refreshLocalTransfer(s.id);
  assert.equal((await f.p.localTransfers())[0].state,'conflict');assert.equal((await f.get('car-a')).paddock,undefined);
  const preview=await f.p.previewLocalTransfer(s.id);assert.equal(preview.current.model,'Changed locally');await assert.rejects(f.p.acceptLocalTransfer(s.id,'stale'),/changed again/);await f.p.acceptLocalTransfer(s.id,preview.expected);assert.equal((await f.p.localTransfers())[0].state,'linked');
 });
 test(kind+': cancellation retains approved cars; missing acknowledged receipt never resubmits',async t=>{
  const f=await fixture(t,kind),entries=await f.p.createLocalTransfers([{localId:'car-a'},{localId:'car-b'}]);const a=entries.find(x=>x.localId==='car-a'),b=entries.find(x=>x.localId==='car-b');f.approve(a.id);
  await f.p.cancelLocalTransfer(a.id);await f.p.cancelLocalTransfer(b.id);const states=await f.p.localTransfers();assert.equal(states.find(x=>x.id===a.id).state,'linked');assert.equal(states.find(x=>x.id===b.id).state,'cancelled');
  f.receipts.delete(a.id);await assert.rejects(f.p.refreshLocalTransfer(a.id),/no longer has/);assert.equal(f.requests.length,2);assert.equal((await f.get('car-a')).paddock.carId,'remote-car-a');
 });
 test(kind+': identity, one-to-one links, invalid targets and disconnect safety',async t=>{
  const f=await fixture(t,kind);await assert.rejects(f.p.createLocalTransfers([{localId:'car-a',target:{carId:'remote',revision:1}},{localId:'car-b',target:{carId:'remote',revision:1}}]),/physical/);assert.equal((await f.p.localTransfers()).length,0);
  await assert.rejects(f.p.connect({address:'127.0.0.1:51000',code:'password'}),/Forget/);
  f.descriptor({...f.getDescriptor(),databaseId:'replacement'});await assert.rejects(f.p.ensureLocal((await f.p.connection()).connection),/different database/);
  await f.p.disconnect(false);assert.equal((await f.p.connection()).connection.automatic,false);await f.p.localTick();assert.equal(f.p.code,'');clearTimeout(f.p.localTimer);
 });
 test(kind+': pending request is small to poll, oversized photos fail before sending',async t=>{
  const f=await fixture(t,kind);await f.edit('car-a',{picture:'data:image/png;base64,'+'A'.repeat(100000)});const [s]=await f.p.createLocalTransfers([{localId:'car-a'}]);const small=await f.p.storage.localRead({kind:'get',id:s.id});assert(JSON.stringify(small).length<6000);
  await f.edit('car-b',{picture:'data:image/png;base64,'+'A'.repeat(8388608)});await assert.rejects(f.p.createLocalTransfers([{localId:'car-b'}]),/8 MiB/);assert.equal(f.requests.length,1);
 });
}
test('discovery rejects non-loopback descriptors, extra fields and untrusted paths without exposing credentials',async t=>{
 const descriptor={format:'slotforge-local-library',version:1,instanceId:'x',pid:1,address:'http://127.0.0.1:51000',token:'x'.repeat(43),databaseId:'db',name:'Library'};
 assert.equal(D.descriptor(descriptor),descriptor);for(const bad of [{address:'http://192.168.1.2:51000'},{address:'http://localhost:51000'},{address:'http://127.0.0.1:51000/'},{token:'short'},{extra:true},{databaseId:null},{instanceId:123}])assert.throws(()=>D.descriptor({...descriptor,...bad}),/Invalid/);
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'timing-discovery-')));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,key);fs.writeFileSync(file,JSON.stringify(descriptor));fs.writeFileSync(path.join(dir,'ignored.tmp'),'not json');
 const entries=await D.scan({folder:dir,platform:'win32',checkWindows:async()=>{}});assert.equal(entries.length,1);
 await assert.rejects(D.scan({folder:dir,platform:'win32',checkWindows:async()=>{throw Error('Unprotected');}}),/Unprotected/);
 fs.writeFileSync(file,'x'.repeat(8193));assert.deepEqual(await D.scan({folder:dir,platform:'win32',checkWindows:async()=>{}}),[]);
 const good='b'.repeat(64)+'.json';fs.writeFileSync(path.join(dir,good),JSON.stringify(descriptor));
 assert.deepEqual((await D.scan({folder:dir,platform:'win32',checkWindows:async()=>{}})).map(x=>x.key),[good]);
 fs.writeFileSync(file,JSON.stringify({...descriptor,databaseId:'untrusted'}));
 assert.deepEqual((await D.scan({folder:dir,platform:'win32',checkWindows:async()=>[good]})).map(x=>x.key),[good]);
 fs.writeFileSync(file,'{"token":"DO-NOT-EXPOSE"');assert.deepEqual((await D.scan({folder:dir,platform:'win32',checkWindows:async()=>{}})).map(x=>x.key),[good]);
});
test('local HTTP carries instance/database/extension headers and never follows redirects',async t=>{
 const http=require('node:http');let seen;const server=http.createServer((req,res)=>{seen=req.headers;res.writeHead(req.url==='/redirect'?302:200,{'Content-Type':'application/json',Location:'http://example.invalid'});res.end(JSON.stringify({ok:true}));});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const base='http://127.0.0.1:'+server.address().port;
 await request(base,'/v1/collection','secret','db',undefined,1000,'instance');assert.equal(seen['x-slotforge-instance'],'instance');assert.equal(seen['x-slotforge-database'],'db');assert.equal(seen['x-slotforge-extensions'],'scalable-v1');assert.equal(seen.origin,undefined);await assert.rejects(request(base,'/redirect','secret','db',undefined,1000,'instance'),/302/);
});
test('all supplied Paddock receipt fixtures pass; content and identity substitutions fail',()=>{
 const folder=path.join(__dirname,'fixtures/paddock-local-v1'),read=name=>JSON.parse(fs.readFileSync(path.join(folder,name+'.json'))),create=read('request-create'),link=read('request-link');
 for(const name of ['receipt-pending','receipt-partial','receipt-cancelled','receipt-duplicate'])assert.doesNotThrow(()=>T.receipt(read(name),create));
 assert.doesNotThrow(()=>T.receipt(read('receipt-linked'),link));
 const rejected={...create,transferId:'transfer-reject',export:{...create.export,items:{slotcars:[{id:'rejected-car',name:'Not wanted'}]}}};assert.doesNotThrow(()=>T.receipt(read('receipt-rejected'),rejected));
 const r=read('receipt-linked');for(const patch of [{databaseId:'wrong'},{hash:'0'.repeat(64)},{transferId:'wrong'},{status:'pending'}])assert.throws(()=>T.receipt({...r,...patch},link),/does not match/);
 const bad=structuredClone(r);bad.cars[0].paddockCarId='wrong';assert.throws(()=>T.receipt(bad,link),/does not match/);
 for(const value of [null,undefined,123]){
  assert.throws(()=>T.receipt({...r,submissionId:value},link),/does not match/);
  const badItem=structuredClone(r);badItem.cars[0].itemId=value;assert.throws(()=>T.receipt(badItem,link),/does not match/);
  const badCar=read('receipt-pending');badCar.cars[0].paddockCarId=value;assert.throws(()=>T.receipt(badCar,create),/does not match/);
 }
});
test('SQLite link and journal acknowledgement roll back together on disk failure, then survive reopen and backup',async t=>{
 const f=await fixture(t,'sqlite'),[x]=await f.p.createLocalTransfers([{localId:'car-a'}]);f.approve(x.id);
 await f.p.storage.localChange({action:'receipt',transferId:x.id,receipt:f.receipts.get(x.id)});
 f.p.stop();await f.p.idle();await f.worker.close();
 const {WorkingStore}=require('../sqlite-working');let s=new WorkingStore(path.join(f.dir,'work'),{checkpoint:phase=>{if(phase==='paddock-car-written')throw Error('Disk full injection');}});
 const command={id:'apply-local-transfer',type:'localLibraryTransfer',action:'apply',transferId:x.id,profile:profile('library-1','remote-car-a')};
 assert.throws(()=>s.command(command),/Disk full/);assert.equal(s.get('slotcars','car-a',true).value.paddock,undefined);assert.equal(s.paddockRead('localTransfers',{kind:'list'})[0].state,'approved');s.close();
 s=new WorkingStore(path.join(f.dir,'work'));try{assert.equal(s.command(command).state,'linked');assert.equal(s.command(command).state,'linked');s.backupSnapshot(path.join(f.dir,'backup'));}finally{s.close();}
 s=new WorkingStore(path.join(f.dir,'work'));try{assert.equal(s.paddockRead('localTransfers',{kind:'list'})[0].state,'linked');assert.equal(s.get('slotcars','car-a',true).value.lapsDriven,123);}finally{s.close();}
 const backup=require('../sqlite-bulk').verify(path.join(f.dir,'backup','snapshot.sqlite'));assert(backup);
});
test('JSON journals survive reopening and migration; request dates and hashes stay exact',async t=>{
 const f=await fixture(t,'json'),[s]=await f.p.createLocalTransfers([{localId:'car-a'}]);const before=await f.p.storage.localRead({kind:'get',id:s.id,full:true});await f.db.saved();
 const reopened=new Database(f.db.file);assert.deepEqual(reopened.data.localLibraryTransfers.find(x=>x.id===s.id).request,before.request);await reopened.writesIdle();
 const copy=path.join(f.dir,'migrated'),work=path.join(f.dir,'converted');migrateCopy({source:f.db.file,destination:copy});forkCopy(copy,work);const store=new(require('../sqlite-working').WorkingStore)(work);
 try{const after=store.paddockRead('localTransfers',{kind:'get',id:s.id,full:true});assert.deepEqual(after.request,before.request);assert.equal(after.requestHash,before.requestHash);f.approve(s.id);store.command({id:'converted-receipt',type:'localLibraryTransfer',action:'receipt',transferId:s.id,receipt:f.receipts.get(s.id)});assert.equal(store.command({id:'converted-link',type:'localLibraryTransfer',action:'apply',transferId:s.id,profile:profile('library-1','remote-car-a')}).state,'linked');}finally{store.close();}
});
test('automatic reconnect and transfer work pause while racing; credential rotation is rediscovered',async t=>{
 const f=await fixture(t,'json'),before=f.calls.length;f.p.isRacing=()=>true;await f.p.localTick();clearTimeout(f.p.localTimer);assert.equal(f.calls.length,before);
 f.p.isRacing=()=>false;f.descriptor({...f.getDescriptor(),token:'u'.repeat(43),instanceId:'restarted',address:'http://127.0.0.1:51001'});await f.p.ensureLocal((await f.p.connection()).connection);assert.equal(f.p.code,'u'.repeat(43));assert.equal(f.calls.at(-1).instance,'restarted');
});
test('failed JSON receipt save does not undo an unrelated concurrent car edit',async t=>{
 const f=await fixture(t,'json'),[s]=await f.p.createLocalTransfers([{localId:'car-a'}]);const old=f.p.storage.commit;
 f.p.storage.commit=async()=>{f.db.data.slotcars[0].model='Concurrent user edit';throw Error('Disk full');};
 try{await assert.rejects(f.p.storage.localChange({action:'receipt',transferId:s.id,receipt:f.receipts.get(s.id)}),/Disk full/);assert.equal((await f.get('car-a')).model,'Concurrent user edit');}finally{f.p.storage.commit=old;}
});
test('SQLite revision changes remain conflicts even if the visible fields are changed back',async t=>{
 const f=await fixture(t,'sqlite'),[s]=await f.p.createLocalTransfers([{localId:'car-a'}]),original=(await f.get('car-a')).model;
 await f.edit('car-a',{model:'Temporary edit'});await f.edit('car-a',{model:original});f.approve(s.id);await f.p.refreshLocalTransfer(s.id);assert.equal((await f.p.localTransfers())[0].state,'conflict');
});
test('SQLite stores each transfer separately and receipt updates leave request pictures untouched',async t=>{
 const f=await fixture(t,'sqlite');await f.edit('car-a',{picture:'data:image/png;base64,YWJjZA=='});const entries=await f.p.createLocalTransfers([{localId:'car-a'},{localId:'car-b'}]);const a=entries.find(x=>x.localId==='car-a');
 f.p.stop();await f.p.idle();await f.worker.close();const s=new(require('../sqlite-working').WorkingStore)(path.join(f.dir,'work'));
 try{
  assert.equal(s.statement("SELECT count(*) n FROM records WHERE entity='localLibraryTransfers'").get().n,2);assert.equal(s.get('@meta','localLibraryTransfers'),null);
  const original=s.paddockRead('localTransfers',{kind:'get',id:a.id,full:true}).request;
  s.db.exec("CREATE TEMP TRIGGER protect_transfer_photo BEFORE DELETE ON asset_refs WHEN old.entity='localLibraryTransfers' BEGIN SELECT RAISE(ABORT,'request picture rewritten'); END;");
  s.command({id:'receipt-only',type:'localLibraryTransfer',action:'receipt',transferId:a.id,receipt:f.receipts.get(a.id)});
  assert.deepEqual(s.paddockRead('localTransfers',{kind:'get',id:a.id,full:true}).request,original);
 }finally{s.close();}
});
