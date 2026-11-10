'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const E=require('../paddock-historical-evidence'),S=require('../paddock-historical-store'),{Paddock,hash}=require('../paddock'),Database=require('../db'),Client=require('../sqlite-client'),Repo=require('../sqlite-repository'),{JsonPaddockStorage,SqlitePaddockStorage}=require('../paddock-storage');
const source=process.env.SLOTFORGE_PADDOCK_SOURCE||path.resolve(__dirname,'../../../SlotForge Slotcar Database'),hasHost=fs.existsSync(path.join(source,'src/history-imports.cjs'));
function evidence(){return E.capture({id:'old-race',setupName:'Historical sprint',sessionType:'race',date:'2020-01-01',trackId:'old-track',trackName:'Original circuit',standings:[{carId:'old-car',driverName:'James',laps:1,pos:1}]},[{id:'lap-1',sessionId:'old-race',carId:'old-car',driverId:'driver-1',lane:1,heat:1,lapNumber:1,time:8500,valid:true,pit:false}]);}
test('historical mapper preserves unknowns and never fabricates current links, clocks or awards',()=>{
 const e=evidence(),before=structuredClone(e),b=E.bundle(e,'collection');assert.deepEqual(e,before);
 assert.equal(b.race.startedAt,null);assert.equal(b.context.savedAt,null);assert.equal(b.race.participants[0].carId,null);assert.equal(b.race.track.lanes[0].lengthM,null);
 const lap=b.race.participants[0].laps[0];assert.equal(lap.durationMs,8500);assert.equal(lap.endedAtMs,null);assert.equal(lap.personalRecordEligible,false);assert.equal(lap.trackRecordEligible,false);assert.equal(b.context.scoringSnapshot,null);assert.equal(b.context.classification.length,1);assert.equal(b.context.classification[0].position,1);assert.equal(b.context.classification[0].points,null);assert.equal(b.context.classification[0].elapsedMs,null);
 e.laps[0].virtualRival=true;assert.equal(E.bundle(e,'collection').race.participants[0].laps[0].countsForDistance,false);
 for(const bad of [{...e.session,paddockDelivery:{payload:{}}},{...e.session,sessionType:'tokens'}])assert.throws(()=>E.capture(bad,e.laps));
 assert.throws(()=>E.bundle({...e,laps:[{...e.laps[0],lapNumber:0}]},'collection'));
 assert.throws(()=>E.capture(e.session,Array(50001).fill(e.laps[0])));
});
function mockReceipt(q,status='pending'){return {version:1,databaseId:q.databaseId,recoveryId:q.recoveryId,operationId:q.operationId,requestHash:hash(q),items:q.items.map(({itemId,sourceId,sessionId})=>({itemId,sourceId,sessionId,status,accepted:null,message:'Awaiting review'}))};}
async function fixture(t,kind,real=false,lapCount=1){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'timing-historical-')),db=new Database(path.join(dir,'original.json')),e=evidence();if(lapCount>1)e.laps=Array.from({length:lapCount},(_,i)=>({...e.laps[0],id:'lap-'+i,lapNumber:i+1}));db.data.sessions=[e.session];db.data.laps=e.laps;db.data.slotcars=[{id:'old-car',model:'Keep me',lapsDriven:23}];db.saveNow();const original=fs.readFileSync(db.file);
 let worker,repo,p,host,store;
 if(kind==='sqlite'){require('../sqlite-migration').migrateCopy({source:db.file,destination:path.join(dir,'copy')});require('../sqlite-working').forkCopy(path.join(dir,'copy'),path.join(dir,'work'));worker=new Client();await worker.openWorking(path.join(dir,'work'));repo=new Repo(worker);}
 p=repo?new Paddock(null,{storage:new SqlitePaddockStorage(repo),deliveryStore:worker}):new Paddock(db);
 const timers=()=>{clearTimeout(p.timer);clearTimeout(p.localTimer);};
 t.after(async()=>{p.stop();await p.idle();await worker?.close();if(host){host.quiesce();await host.idle();host.close();}await db.writesIdle();if(kind==='sqlite')assert.deepEqual(fs.readFileSync(db.file),original);fs.rmSync(dir,{recursive:true,force:true});});
 if(real){const {Store}=require(path.join(source,'src/store.cjs')),{LocalLibrary}=require(path.join(source,'src/local-library.cjs'));const profile=path.join(dir,'host');fs.mkdirSync(profile);store=new Store(path.join(profile,'database.json'));store.persist(store.data);host=new LocalLibrary({store,profile,folder:path.join(dir,'discovery')});await host.start();assert.equal(host.error,'');p.localScan=()=>require('../paddock-local-discovery').scan({folder:host.folder});p.launcherScan=async()=>[];const [found]=await p.discoverLocal();await p.connect({mode:'local',...found});timers();}
 else{const c={mode:'local',automatic:true,localKey:'b'.repeat(64)+'.json',address:'http://127.0.0.1:5001',name:'Synthetic',timing:true,results:true,databaseId:'collection',historyGuard:{version:1,databaseId:'collection',recoveryId:'recovery'}};await p.storage.setConnection(c,(await p.connection()).revision);p.historyCapability={features:{historicalReview:true}};p.ensureLocal=async()=>({});p.code='test';}
 async function reopen(){timers();if(worker){await worker.close();worker=new Client();await worker.openWorking(path.join(dir,'work'));p.storage=new SqlitePaddockStorage(new Repo(worker));p.deliveryStore=worker;}else{await db.writesIdle();p.storage=new JsonPaddockStorage(new Database(db.file));} }
 const preview=()=>p.historicalReview({action:'preview',sessionId:e.session.id});const submit=async()=>p.historicalReview({action:'submit',...await preview()});
 return {p,db,host,store,dir,preview,submit,reopen,timers,worker:()=>worker,original};
}
for(const kind of ['json','sqlite']){
 test(kind+': lost intake reply, reopen, polling, cancellation, immutable evidence and unchanged records',async t=>{
  const f=await fixture(t,kind),p=f.p;let saved,posts=0,lost=true;const calls=[];
  p.call=async(route,body)=>{calls.push(route);if(route===S.BASE){posts++;saved=mockReceipt(body);if(lost){lost=false;throw Error('Lost acknowledgement');}}else if(route.endsWith('/cancel'))saved.items[0].status='cancelled';else if(!saved)throw Object.assign(Error('Not found'),{code:'OPERATION_NOT_FOUND'});return structuredClone(saved);};
  let row=await f.submit();assert.equal(row.state,'queued');assert.match(row.error,/Lost/);assert.equal(posts,1);
  const frozen=await p.storage.historicalRead({kind:'get',id:row.id,full:true});assert.deepEqual(frozen.evidence,evidence());assert.equal(frozen.request.items[0].originHash,hash(frozen.evidence));
  await f.reopen();row=await p.historicalReview({action:'refresh',id:row.id});assert.equal(row.state,'pending');assert.equal(posts,1);assert.equal(row.items[0].accepted,null);
  const small=await p.storage.historicalRead({kind:'get',id:row.id});assert.equal(small.evidence,undefined);assert.equal(small.request.items[0].bundle,undefined);
  row=await p.historicalReview({action:'cancel',id:row.id});assert.equal(row.items[0].status,'cancelled');assert.equal(row.state,'complete');assert.equal(posts,1);
  const retained=await p.storage.historicalRead({kind:'get',id:row.id,full:true});assert.deepEqual(retained.evidence,frozen.evidence);assert.deepEqual(retained.request,frozen.request);
  await assert.rejects(f.submit(),/retained historical submission/);
  if(kind==='json'){assert.deepEqual(p.storage.db.data.sessions,[evidence().session]);assert.equal(p.storage.db.data.laps.length,1);assert.equal(p.storage.db.data.slotcars[0].lapsDriven,23);}else{assert.deepEqual((await f.worker().snapshot('sessions','old-race',true)).record.value,evidence().session);assert.equal((await f.worker().snapshot('slotcars','old-car',true)).record.value.lapsDriven,23);}
 });
 test(kind+': restore and malformed/reserved receipts block retries without changing original identity',async t=>{
  const f=await fixture(t,kind),p=f.p;p.call=async()=>{throw Object.assign(Error('Restored database'),{code:'RECOVERY_CHANGED'});};
  let row=await f.submit();assert.equal(row.state,'blocked');const before=await p.storage.historicalRead({kind:'get',id:row.id,full:true});let calls=0;p.call=async()=>{calls++;};await p.historicalReview({action:'refresh',id:row.id});assert.equal(calls,0);
  const r=mockReceipt(before.request);for(const patch of [{requestHash:'0'.repeat(64)},{recoveryId:'other'},{items:[{...r.items[0],status:'approved'}]},{items:[{...r.items[0],status:'already-present'}]},{items:[{...r.items[0],accepted:{revision:1,contentHash:'a'.repeat(64),state:'active'}}]}])assert.throws(()=>S.receipt({...r,...patch},before.request));
  assert.equal((await p.storage.historicalRead({kind:'get',id:row.id})).request.recoveryId,'recovery');
 });
 test(kind+': preview CAS, race pause, unsupported host and durable-write failure never submit',async t=>{
  const f=await fixture(t,kind),p=f.p;let calls=0;p.call=async()=>{calls++;};const preview=await f.preview();
  await assert.rejects(p.historicalReview({action:'submit',...preview,originHash:'0'.repeat(64)}),/changed since preview/);
  p.isRacing=()=>true;await assert.rejects(f.submit(),/race/i);p.isRacing=()=>false;p.historyCapability=null;await assert.rejects(f.preview(),/does not support/);p.historyCapability={features:{historicalReview:true}};
  const change=p.storage.historicalChange.bind(p.storage);p.storage.historicalChange=async()=>{throw Error('disk full');};await assert.rejects(f.submit(),/disk full/);p.storage.historicalChange=change;assert.equal(calls,0);assert.deepEqual(await p.historicalReview({action:'list'}),[]);
 });
 test(kind+': real Paddock intake and cancellation never affect accepted history',{skip:!hasHost,timeout:30000},async t=>{
  const f=await fixture(t,kind,true),before=f.store.data.timing.sessions.length,row=await f.submit();assert.equal(row.items[0].status,'pending',row.error);assert.equal(row.items[0].accepted,null);assert.equal(f.store.data.timing.sessions.length,before);
  assert.equal((f.store.data.timing.imports||[]).length,1);await f.reopen();const cancelled=await f.p.historicalReview({action:'cancel',id:row.id});assert.equal(cancelled.items[0].status,'cancelled',cancelled.error);assert.equal(f.store.data.timing.sessions.length,before);assert.equal((f.store.data.timing.imports||[]).length,1);
 });
}
test('JSON commit failure rolls back journal creation and retains original records',async t=>{
 const f=await fixture(t,'json'),preview=await f.preview(),before=structuredClone(f.db.data);f.p.storage.commit=async()=>{throw Error('disk full');};await assert.rejects(f.p.storage.historicalChange({...preview,action:'create'}),/disk full/);assert.deepEqual(f.db.data,before);
});
test('review wording and evidence preview are explicit and escape untrusted names',()=>{
 const ui=require('../renderer/paddockhistorical'),p=E.preview(evidence(),'collection');p.name='<script>';const html=ui.previewHtml(p);assert(html.includes('&lt;script&gt;'));assert(html.includes('Received is not accepted'));assert(html.includes('approval is not available'));assert(html.includes('not linked automatically'));assert(html.includes('virtual replay summaries stay'));
});
test('SQLite legacy export/restore and JSON conversion retain immutable evidence and receipts',async t=>{
 const f=await fixture(t,'json');f.p.call=async(route,q)=>{if(q)return mockReceipt(q);throw Object.assign(Error('Missing'),{code:'OPERATION_NOT_FOUND'});};const row=await f.submit();await f.db.writesIdle();
 const frozen=await f.p.storage.historicalRead({kind:'get',id:row.id,full:true});
 const converted=path.join(f.dir,'converted');require('../sqlite-migration').migrateCopy({source:f.db.file,destination:converted});const work=path.join(f.dir,'converted-work');require('../sqlite-working').forkCopy(converted,work);const worker=new Client();await worker.openWorking(work);
 try{
  let storage=new SqlitePaddockStorage(new Repo(worker));assert.equal((await storage.historicalRead({kind:'list'}))[0].items[0].status,'pending');assert.deepEqual((await storage.historicalRead({kind:'get',id:row.id,full:true})).evidence,frozen.evidence);
  const file=path.join(f.dir,'export.json');await worker.exportLegacy(file);const restored=require('../sqlite-bulk').restoreLegacy(file,path.join(f.dir,'restored'));const second=new Client();await second.openWorking(restored.destination);
  try{storage=new SqlitePaddockStorage(new Repo(second));const retained=await storage.historicalRead({kind:'get',id:row.id,full:true});assert.deepEqual(retained.request,frozen.request);assert.deepEqual(retained.receipt,frozen.receipt);assert.deepEqual(retained.evidence,frozen.evidence);}finally{await second.close();}
 }finally{await worker.close();}
});
test('SQLite failure after journal write rolls back, including command receipt',async t=>{
 const f=await fixture(t,'sqlite'),preview=await f.preview();await f.worker().close();let fail=true;
 const store=new(require('../sqlite-working').WorkingStore)(path.join(f.dir,'work'),{checkpoint:phase=>{if(fail&&phase==='domain-written')throw Error('Injected disk failure');}});
 try{const cmd={id:'journal-save',type:'historicalReview',input:{...preview,action:'create'}};assert.throws(()=>store.command(cmd),/Injected disk/);assert.equal(store.receipt(cmd.id),null);assert.deepEqual(S.read(S.sqlAdapter(store),{kind:'list'}),[]);fail=false;const saved=store.command(cmd);assert.equal(saved.state,'queued');assert.equal(store.command(cmd).id,saved.id);}finally{store.close();}
});
for(const kind of ['json','sqlite'])test(kind+': cancellation intent survives restart and a lost cancellation reply',async t=>{
 const f=await fixture(t,kind),p=f.p;let r,lost=true,posts=0;p.call=async(route,q)=>{if(route===S.BASE){posts++;r=mockReceipt(q);}else if(route.endsWith('/cancel')){r.items[0].status='cancelled';if(lost){lost=false;throw Error('Lost cancellation reply');}}else if(!r)throw Object.assign(Error('Missing'),{code:'OPERATION_NOT_FOUND'});return structuredClone(r);};
 let row=await f.submit();row=await p.historicalReview({action:'cancel',id:row.id});assert.equal(row.cancelRequested,true);assert.equal(row.state,'pending');await f.reopen();row=await p.historicalReview({action:'refresh',id:row.id});assert.equal(row.items[0].status,'cancelled');assert.equal(posts,1);
});
test('real Paddock rejection, conflicts and restore generation are reconciled without acceptance',{skip:!hasHost,timeout:30000},async t=>{
 const f=await fixture(t,'sqlite',true),p=f.p,row=await f.submit(),H=require(path.join(source,'src/history-imports.cjs')),remote=f.store.data.timing.imports[0];
 H.review(f.store,{action:'reject',id:remote.id,requestHash:remote.requestHash,databaseId:remote.batch.databaseId,recoveryId:remote.batch.recoveryId,note:'Insufficient evidence'});
 const rejected=await p.historicalReview({action:'refresh',id:row.id});assert.equal(rejected.items[0].status,'rejected');assert.equal(f.store.data.timing.sessions.length,0);
 const full=await p.storage.historicalRead({kind:'get',id:row.id,full:true});assert.deepEqual(full.evidence,evidence());
 // A different operation cannot overwrite a pending source/session tuple.
 const q=structuredClone(full.request);q.operationId='other-batch';q.items[0].itemId='other-item';const second=await p.call(S.BASE,q);assert.equal(second.items[0].status,'pending');q.operationId='third-batch';q.items[0].itemId='third-item';const conflict=await p.call(S.BASE,q);assert.equal(conflict.items[0].status,'conflict');S.receipt(conflict,q);
 await f.store.restoreAsync(f.store.snapshot(),f.store.data.revision);
 await assert.rejects(p.call(S.BASE+'/'+q.editor.installationId+'/'+q.operationId+'?recoveryId='+q.recoveryId),{code:'RECOVERY_CHANGED'});assert.equal(f.store.data.timing.sessions.length,0);
});
test('preview verifies input limits and immutable snapshots with many laps',async t=>{
 const f=await fixture(t,'json'),e=evidence();f.db.data.laps=Array.from({length:40000},(_,i)=>({...e.laps[0],id:'lap-'+i,lapNumber:i+1}));const preview=await f.preview();let sent=0;f.p.call=async()=>{sent++;};
 await assert.rejects(f.p.historicalReview({action:'submit',...preview}),/8 MiB/);assert.equal(sent,0);assert.deepEqual(await f.p.historicalReview({action:'list'}),[]);
});
test('SQLite polling and status persistence never hydrate frozen lap evidence',async t=>{
 const f=await fixture(t,'sqlite');f.p.call=async(route,q)=>{if(q)return mockReceipt(q);throw Object.assign(Error('Missing'),{code:'OPERATION_NOT_FOUND'});};const row=await f.submit();await f.worker().close();
 const store=new(require('../sqlite-working').WorkingStore)(path.join(f.dir,'work'));try{
  const before=store.get(S.ROOT,row.id,true).value,original=store.get.bind(store);store.get=(entity,id,full)=>{assert.notEqual(entity,S.ROOT,'lightweight polling must not get the full journal');return original(entity,id,full);};
  const a=S.sqlAdapter(store);assert.equal(S.read(a,{kind:'get',id:row.id}).request.items[0].bundle,undefined);assert.equal(S.read(a,{kind:'list'})[0].state,'pending');
  store.command({id:'small-receipt',type:'historicalReview',input:{action:'result',id:row.id,receipt:before.receipt}});store.get=original;
  const after=store.get(S.ROOT,row.id,true).value;assert.deepEqual(after.evidence,before.evidence);assert.deepEqual(after.request,before.request);
 }finally{store.close();}
});
test('deleted local sessions retain their independent cancellation and recovery evidence',async t=>{
 const f=await fixture(t,'sqlite');let r;f.p.call=async(route,q)=>{if(route===S.BASE)r=mockReceipt(q);else if(route.endsWith('/cancel'))r.items[0].status='cancelled';else if(!r)throw Object.assign(Error('Missing'),{code:'OPERATION_NOT_FOUND'});return structuredClone(r);};const row=await f.submit(),before=await f.p.storage.historicalRead({kind:'get',id:row.id,full:true});
 const repo=new Repo(f.worker()),s=await repo.get('sessions','old-race');await repo.execute('delete-original','deleteSession',{sessionId:'old-race',expectedRevision:s.revision});await f.reopen();
 assert.equal((await f.p.historicalReview({action:'cancel',id:row.id})).items[0].status,'cancelled');assert.deepEqual((await f.p.storage.historicalRead({kind:'get',id:row.id,full:true})).evidence,before.evidence);
});
test('background poll is bounded, defers recently checked receipts and pauses racing',async t=>{
 const f=await fixture(t,'json');let r,calls=0;f.p.call=async(route,q)=>{calls++;if(q)r=mockReceipt(q);if(!r)throw Object.assign(Error('Missing'),{code:'OPERATION_NOT_FOUND'});return r;};const row=await f.submit();calls=0;
 await f.p.syncHistoricalReviews();assert.equal(calls,0);f.db.data[S.ROOT][0].nextAttempt=0;f.p.isRacing=()=>true;await f.p.syncHistoricalReviews();assert.equal(calls,0);f.p.isRacing=()=>false;await f.p.syncHistoricalReviews();assert.equal(calls,1);assert.equal((await f.p.historicalReview({action:'list'}))[0].id,row.id);
});

for(const kind of ['json','sqlite']){
 test(kind+': real historical upload resumes after restart and lost commit without accepting evidence',{skip:!hasHost,timeout:60000},async t=>{
  const f=await fixture(t,kind,true,1800),p=f.p,U=require('../paddock-history-upload');assert(U.supported(p.historyCapability,'import'));
  const call=p.call.bind(p),chunks=[];let fail=true,lost=true;
  p.call=async(...args)=>{const route=args[0];if(route.includes('/chunks/')){chunks.push(route);if(fail&&route.endsWith('/1')){fail=false;throw Error('Interrupted connection');}}const r=await call(...args);if(route.endsWith('/commit')&&lost){lost=false;throw Error('Lost commit reply');}return r;};
  let row=await f.submit();assert.equal(row.state,'queued');assert.match(row.error,/Interrupted/);assert.equal((f.store.data.timing.imports||[]).length,0);
  const saved=await p.storage.historicalRead({kind:'get',id:row.id,full:true});assert.equal(saved.upload.manifest.kind,'import');assert.equal(saved.upload.serialized,JSON.stringify(saved.request));assert.equal((await p.storage.historicalRead({kind:'get',id:row.id})).upload,undefined);
  await f.reopen();row=await p.historicalReview({action:'refresh',id:row.id});assert.match(row.error,/Lost commit/);assert.equal((f.store.data.timing.imports||[]).length,1);
  await f.reopen();row=await p.historicalReview({action:'refresh',id:row.id});assert.equal(row.state,'pending',row.error);assert.equal(row.items[0].accepted,null);assert.equal(chunks.filter(x=>x.endsWith('/0')).length,1);assert.equal(f.store.data.timing.sessions.length,0);
  const retained=await p.storage.historicalRead({kind:'get',id:row.id,full:true});assert.deepEqual(retained.upload,saved.upload);assert.deepEqual(retained.evidence,saved.evidence);
  row=await p.historicalReview({action:'cancel',id:row.id});assert.equal(row.items[0].status,'cancelled');assert.equal(f.store.data.timing.sessions.length,0);
 });
 test(kind+': cancel unfinished transport does not deliver it to Review',{skip:!hasHost,timeout:60000},async t=>{
  const f=await fixture(t,kind,true,1800),p=f.p,call=p.call.bind(p);let fail=true;
  let lostCancel=true;
  p.call=async(...args)=>{if(fail&&args[0].includes('/chunks/1')){fail=false;throw Error('Disconnected');}const r=await call(...args);if(args[4]==='DELETE'&&lostCancel){lostCancel=false;throw Error('Lost cancellation reply');}return r;};
  let row=await f.submit();assert.equal(row.state,'queued');await f.reopen();row=await p.historicalReview({action:'cancel',id:row.id});assert.equal(row.state,'queued');assert.match(row.error,/Lost cancellation/);await f.reopen();row=await p.historicalReview({action:'refresh',id:row.id});assert.equal(row.state,'complete',row.error);assert.equal(row.items[0].status,'cancelled');assert.match(row.items[0].message,/before delivery/);assert.equal((f.store.data.timing.imports||[]).length,0);assert.equal(f.store.data.timing.sessions.length,0);
 });
}
test('historical upload capability stays independent of ordinary result uploads',()=>{
 const U=require('../paddock-history-upload'),c={features:{resumableUploads:true,historicalReview:true},uploads:U.ROOT,maxChunkBytes:U.CHUNK,maxUploadBytes:U.MAX};assert(U.supported(c));assert(!U.supported(c,'import'));c.features.resumableHistoricalImports=true;assert(U.supported(c,'import'));c.features.historicalReview=false;assert(!U.supported(c,'import'));
});
test('restore during historical upload blocks retries without rebinding the submission',{skip:!hasHost,timeout:60000},async t=>{
 const f=await fixture(t,'sqlite',true,1800),p=f.p,call=p.call.bind(p);let fail=true;
 p.call=async(...args)=>{if(fail&&args[0].includes('/chunks/1')){fail=false;throw Error('Interrupted');}return call(...args);};
 let row=await f.submit();const saved=await p.storage.historicalRead({kind:'get',id:row.id,full:true});assert(saved.upload);
 await f.store.restoreAsync(f.store.snapshot(),f.store.data.revision);await f.reopen();row=await p.historicalReview({action:'refresh',id:row.id});assert.equal(row.state,'blocked');assert.equal(row.code,'RECOVERY_CHANGED');assert.equal((f.store.data.timing.imports||[]).length,0);
 const retained=await p.storage.historicalRead({kind:'get',id:row.id,full:true});assert.deepEqual(retained.upload,saved.upload);assert.deepEqual(retained.request,saved.request);
});
test('older hosts receive the same large historical evidence inline',{skip:!hasHost,timeout:60000},async t=>{
 const f=await fixture(t,'json',true,1800),p=f.p,ensure=p.ensureLocal.bind(p),call=p.call.bind(p);p.ensureLocal=async(...args)=>{const r=await ensure(...args);p.historyCapability.features.resumableHistoricalImports=false;return r;};let inline=0;
 p.call=async(...args)=>{assert(!args[0].includes('/uploads'));if(args[0]===S.BASE)inline++;return call(...args);};const row=await f.submit();assert.equal(row.state,'pending',row.error);assert.equal(inline,1);assert.equal(f.store.data.timing.sessions.length,0);
});
test('historical upload persistence failure prevents transport and keeps the frozen evidence',async t=>{
 const f=await fixture(t,'sqlite',false,1800),p=f.p,U=require('../paddock-history-upload');p.historyCapability={features:{historicalReview:true,resumableHistoricalImports:true},uploads:U.ROOT,maxChunkBytes:U.CHUNK,maxUploadBytes:U.MAX};
 const save=p.storage.historicalChange.bind(p.storage);p.storage.historicalChange=o=>{if(o.action==='upload')throw Error('disk full before upload');return save(o);};let writes=0;p.call=async(_route,body)=>{if(body)writes++;throw Object.assign(Error('missing'),{code:'OPERATION_NOT_FOUND'});};
 const row=await f.submit();assert.match(row.error,/disk full/);assert.equal(writes,0);const frozen=await p.storage.historicalRead({kind:'get',id:row.id,full:true});assert.equal(frozen.request.items[0].bundle.race.participants[0].laps.length,1800);assert.equal(frozen.upload,undefined);
});
test('expired historical transport looks up its import receipt before replacing only the upload identity',async()=>{
 const U=require('../paddock-history-upload'),q={version:1,databaseId:'db',recoveryId:'epoch',operationId:'original-import',editor:{installationId:'timing',application:'SlotForge Timing',name:'Director'},items:[]};
 let guard={operations:[q]},prepared=0,upload,received=false,lookedUp=false;const cap={maxUploadBytes:U.MAX};
 const prepare=async(id,replace)=>{prepared++;const next=U.prepare(guard,id,replace,'import');guard=next.guard;return upload=next.upload;};await prepare(q.operationId);const old=upload.manifest.uploadId;
 const status=()=>({version:1,...Object.fromEntries(['databaseId','recoveryId','uploadId','byteLength','sha256'].map(k=>[k,upload.manifest[k]])),state:received?'committed':'staging',chunkBytes:U.CHUNK,received:received?[0]:[],expiresAt:new Date(Date.now()+3600000).toISOString(),receipt:received?mockReceipt(q):null});
 const call=async(route)=>{if(route==='/original-import-receipt'){lookedUp=true;throw Object.assign(Error('Missing'),{code:'OPERATION_NOT_FOUND'});}if(route.includes(old))throw Object.assign(Error('Expired'),{code:'UPLOAD_EXPIRED'});assert(lookedUp);if(route.includes('/chunks/')){const s=status();s.received=[0];return s;}if(route.endsWith('/commit'))received=true;return status();};
 const r=await U.send(call,q,prepare,()=>false,cap,{kind:'import',lookup:()=>'/original-import-receipt'});S.receipt(r,q);assert.notEqual(upload.manifest.uploadId,old);assert.equal(upload.manifest.kind,'import');assert.equal(JSON.parse(upload.serialized).operationId,q.operationId);assert.equal(prepared,3);
});
test('SQLite export and restore retain exact staged historical upload bytes without hydrating them during polling',async t=>{
 const f=await fixture(t,'sqlite',false,1800),p=f.p,row=await p.storage.historicalChange({action:'create',...await f.preview()});
 const upload=await p.storage.historicalChange({action:'upload',id:row.id});assert(upload.manifest.byteLength>262144);
 const file=path.join(f.dir,'staged-export.json');await f.worker().exportLegacy(file);const restored=require('../sqlite-bulk').restoreLegacy(file,path.join(f.dir,'restored-upload'));const worker=new Client();await worker.openWorking(restored.destination);
 try{const storage=new SqlitePaddockStorage(new Repo(worker)),full=await storage.historicalRead({kind:'get',id:row.id,full:true}),light=await storage.historicalRead({kind:'get',id:row.id});assert.deepEqual(full.upload,upload);assert.equal(light.upload,undefined);assert.equal(light.evidence,undefined);assert.equal(light.request.items[0].bundle,undefined);require('../paddock-history-upload').verify(full.upload,full.request,'import');const modified=structuredClone(full.upload);modified.serialized+=' ';assert.throws(()=>require('../paddock-history-upload').verify(modified,full.request,'import'));assert.deepEqual(await storage.historicalChange({action:'upload',id:row.id}),upload);}finally{await worker.close();}
});
