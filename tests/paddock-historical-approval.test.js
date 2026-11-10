'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const S=require('../paddock-historical-store'),{hash,Paddock}=require('../paddock'),Database=require('../db'),Client=require('../sqlite-client'),Repo=require('../sqlite-repository');
const {JsonPaddockStorage,SqlitePaddockStorage}=require('../paddock-storage');
const read=n=>JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/paddock-historical-approval',n+'.json')));
const source=process.env.SLOTFORGE_PADDOCK_SOURCE||path.resolve(__dirname,'../../../SlotForge Slotcar Database');
const hasHost=fs.existsSync(path.join(source,'tests/support/historical-approval-preload.cjs'));
const gateFiles=[require.resolve('../paddock-rich-gate'),...(hasHost?['src/historical-approval-gate.cjs','src/rich-history-gate.cjs'].map(f=>path.join(source,f)):[])];
const initialGates=gateFiles.map(f=>fs.readFileSync(f));
function gatesUnchanged(){gateFiles.forEach((f,i)=>assert.deepEqual(fs.readFileSync(f),initialGates[i],'Qualification must not modify production gates'));}
function response(q,states=['approved','pending','rejected']){return {version:1,databaseId:q.databaseId,recoveryId:q.recoveryId,operationId:q.operationId,requestHash:hash(q),items:q.items.map((i,n)=>({itemId:i.itemId,sourceId:i.sourceId,sessionId:i.sessionId,status:states[n],accepted:states[n]==='approved'?{revision:1,state:'active',contentHash:hash(i.bundle)}:null,message:'Owner decision'}))};}
test('published approved and mixed receipts match exact frozen bundles; reserved and forged decisions fail',()=>{
 const q=read('request'),m=read('manifest');assert.equal(hash(q),m.requestHash);
 for(const name of ['pending','mixed-decisions','after-cancellation'])assert.deepEqual(S.receipt(read(name),q),read(name));
 const good=read('mixed-decisions');
 for(const mutate of [r=>r.databaseId='other',r=>r.recoveryId='other',r=>r.operationId='other',r=>r.requestHash='0'.repeat(64),r=>r.items.reverse(),r=>r.items.pop(),r=>r.items[0].sessionId='other',r=>r.items[0].status='already-present',r=>r.items[0].accepted=null,r=>r.items[0].accepted.revision=2,r=>r.items[0].accepted.state='withdrawn',r=>r.items[0].accepted.contentHash=hash(q),r=>r.items[1].accepted=r.items[0].accepted,r=>r.items[2].accepted=r.items[0].accepted]){
  const r=structuredClone(good);mutate(r);assert.throws(()=>S.receipt(r,q),{code:'RECEIPT_MISMATCH'});
 }
 const conflict=response(q,['conflict','pending','rejected']);conflict.items[0].accepted={revision:3,state:'withdrawn',contentHash:'a'.repeat(64)};assert.equal(S.receipt(conflict,q).items[0].status,'conflict');
 gatesUnchanged();
});
async function fixture(t,kind,{old=false,recoveryId,batchId}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'timing-approval-')),db=new Database(path.join(root,'original.json')),q=read('request');
 if(recoveryId)q.recoveryId=recoveryId;if(batchId){q.operationId=batchId;q.items.forEach(i=>i.sessionId+='-'+batchId);}
 const evidence={session:{id:q.items[0].sessionId,setupName:'Original saved race',date:'2020-01-01'},laps:[]};q.items.forEach(i=>i.originHash=hash(evidence));
 const row={id:q.operationId,name:'Three original historical items',request:q,identity:{...q,items:q.items.map(({bundle,...i})=>i)},requestHash:hash(q),evidence,state:'queued',nextAttempt:0,createdAt:new Date().toISOString(),...(!old?{bundleHashes:q.items.map(i=>hash(i.bundle))}:{})};
 row.summary=S.summary(row);db.data[S.ROOT]=[row];db.data.sessions=[evidence.session];db.data.slotcars=[{id:'original-car',model:'Unchanged',lapsDriven:23}];db.data.paddock={sourceId:q.editor.installationId,withdrawals:[],connection:{mode:'local',automatic:true,databaseId:q.databaseId,historyGuard:{databaseId:q.databaseId,recoveryId:q.recoveryId}}};db.saveNow();const original=fs.readFileSync(db.file);let worker,p;
 const work=path.join(root,'work');if(kind==='sqlite'){require('../sqlite-migration').migrateCopy({source:db.file,destination:path.join(root,'copy')});require('../sqlite-working').forkCopy(path.join(root,'copy'),work);worker=new Client();await worker.openWorking(work);}
 p=worker?new Paddock(null,{storage:new SqlitePaddockStorage(new Repo(worker)),deliveryStore:worker}):new Paddock(db);p.code='synthetic';p.historyCapability={features:{historicalReview:true,historicalImports:false}};p.ensureLocal=async()=>({});
 t.after(async()=>{p.stop();await p.idle();await worker?.close();await db.writesIdle();if(kind==='sqlite')assert.deepEqual(fs.readFileSync(db.file),original);assert.equal(path.dirname(root),os.tmpdir());fs.rmSync(root,{recursive:true,force:true});});
 const refresh=()=>p.historicalReview({action:'refresh',id:row.id}),full=()=>p.storage.historicalRead({kind:'get',id:row.id,full:true});
 const reopen=async()=>{if(worker){await worker.close();worker=new Client();await worker.openWorking(work);p.storage=new SqlitePaddockStorage(new Repo(worker));p.deliveryStore=worker;}else{await p.storage.db.writesIdle();p.storage=new JsonPaddockStorage(new Database(db.file));}};
 return {p,q,row,root,work,db,refresh,full,reopen,worker:()=>worker};
}
for(const kind of ['json','sqlite']){
 test(kind+': mixed approval survives lost cancellation reply and restart without resubmitting or changing local history',async t=>{
  const f=await fixture(t,kind),before=await f.full();let r=response(f.q),lost=true,posts=0;
  f.p.call=async(route,body)=>{if(route===S.BASE){posts++;assert.fail('Never recreate a received batch');}if(route.endsWith('/cancel')){assert.deepEqual(body.itemIds,[f.q.items[1].itemId]);r=response(f.q,['approved','cancelled','rejected']);if(lost){lost=false;throw Error('Lost cancellation reply');}}return structuredClone(r);};
  // Cancellation was requested before we learned about an approval.
  let result=await f.p.historicalReview({action:'cancel',id:f.row.id});assert.equal(result.state,'pending');assert.equal(result.items[0].status,'approved');assert.match(result.error,/Lost/);
  await f.reopen();result=await f.refresh();assert.equal(result.state,'complete');assert.deepEqual(result.items.map(i=>i.status),['approved','cancelled','rejected']);assert.equal(posts,0);
  const after=await f.full();assert.deepEqual(after.request,before.request);assert.deepEqual(after.evidence,before.evidence);assert.deepEqual(after.bundleHashes,before.bundleHashes);
  let calls=0;f.p.call=async()=>{calls++;throw Error('No network for completed batches');};await f.p.syncHistoricalReviews();await f.refresh();await f.p.historicalReview({action:'cancel',id:f.row.id});assert.equal(calls,0);
  if(kind==='json'){assert.deepEqual(f.p.storage.db.data.sessions,[before.evidence.session]);assert.equal(f.p.storage.db.data.laps.length,0);assert.equal(f.p.storage.db.data.slotcars[0].lapsDriven,23);}else{assert.deepEqual((await f.worker().snapshot('sessions',before.evidence.session.id,true)).record.value,before.evidence.session);assert.equal((await f.worker().snapshot('slotcars','original-car',true)).record.value.lapsDriven,23);}
 });
 test(kind+': old journals gain verified bundle hashes only on approval; corrupt frozen requests cannot be approved',async t=>{
  const f=await fixture(t,kind,{old:true}),before=await f.full();f.p.call=async()=>response(f.q,['pending','pending','pending']);await f.refresh();assert.equal((await f.full()).bundleHashes,undefined);
  f.p.call=async()=>response(f.q);await f.refresh();const after=await f.full();assert.deepEqual(after.bundleHashes,f.q.items.map(i=>hash(i.bundle)));assert.deepEqual(after.request,before.request);await f.reopen();assert.deepEqual((await f.full()).bundleHashes,after.bundleHashes);
  const bad=structuredClone(before);bad.request.items[0].bundle.race.name='changed';const adapter={get:(_id,full)=>full?bad:{...bad,request:bad.identity}};
  assert.throws(()=>S.read(adapter,{kind:'verifyReceipt',id:bad.id,receipt:response(f.q)}),{code:'RECEIPT_MISMATCH'});
  for(const patch of [{bundleHashes:['invalid']},{receipt:{...response(f.q),items:[]}}]){const damaged={...after,...patch};assert.throws(()=>S.read({get:()=>damaged},{kind:'verifyReceipt',id:damaged.id,receipt:response(f.q)}),{code:'RECEIPT_MISMATCH'});}
  for(const items of [{},'invalid',[null,null,null]])assert.throws(()=>S.read({get:()=>before},{kind:'verifyReceipt',id:before.id,receipt:{...response(f.q),items}}),{code:'RECEIPT_MISMATCH'});
 });
 test(kind+': completed decisions cannot regress; restore retains the approved receipt and original generation',async t=>{
  const f=await fixture(t,kind);f.p.call=async()=>response(f.q);await f.refresh();const first=await f.full();
  f.p.call=async()=>response(f.q,['pending','pending','rejected']);const blocked=await f.refresh();assert.equal(blocked.state,'blocked');assert.match(blocked.error,/completed historical decision/);assert.deepEqual((await f.full()).receipt,first.receipt);
  await f.reopen();let calls=0;f.p.call=async()=>{calls++;};await f.refresh();assert.equal(calls,0);
 });
 test(kind+': recovery change during mixed pending decisions never rebinds or recreates the import',async t=>{
  const f=await fixture(t,kind);f.p.call=async()=>response(f.q);await f.refresh();const before=await f.full();f.p.call=async()=>{throw Object.assign(Error('Library restored'),{code:'RECOVERY_CHANGED'});};
  assert.equal((await f.refresh()).state,'blocked');await f.reopen();const after=await f.full();assert.deepEqual(after.request,before.request);assert.deepEqual(after.receipt,before.receipt);assert.equal(after.code,'RECOVERY_CHANGED');
 });
}
test('JSON failed approval save rolls back receipt and can recover the same batch',async t=>{
 const f=await fixture(t,'json');f.p.call=async()=>response(f.q);const commit=f.p.storage.commit.bind(f.p.storage);let fail=true;f.p.storage.commit=async()=>{if(fail){fail=false;throw Error('Disk full');}return commit();};
 const failed=await f.refresh();assert.equal(failed.state,'queued');assert.equal((await f.full()).receipt,undefined);await f.reopen();const result=await f.refresh();assert.equal(result.items[0].status,'approved');assert.equal(result.state,'pending');
});
test('SQLite approval decision, summary and command receipt roll back together',async t=>{
 const f=await fixture(t,'sqlite');await f.worker().close();let fail=true;const store=new(require('../sqlite-working').WorkingStore)(f.work,{checkpoint:phase=>{if(fail&&phase==='domain-written')throw Error('Injected write failure');}});
 try{const cmd={id:'approval-save',type:'historicalReview',input:{action:'result',id:f.row.id,receipt:response(f.q)}};assert.throws(()=>store.command(cmd),/Injected/);assert.equal(store.receipt(cmd.id),null);assert.equal(store.paddockRead('historicalReview',{kind:'get',id:f.row.id}).receipt,undefined);fail=false;const saved=store.command(cmd);assert.equal(saved.items[0].status,'approved');assert.deepEqual(store.command(cmd),saved);}finally{store.close();}
 await f.reopen();assert.equal((await f.full()).receipt.items[0].status,'approved');
});
test('SQLite approved polling uses stored hashes instead of hydrating lap evidence',async t=>{
 const f=await fixture(t,'sqlite');await f.worker().close();const store=new(require('../sqlite-working').WorkingStore)(f.work);
 try{const get=store.get.bind(store);store.get=(entity,...args)=>{assert.notEqual(entity,S.ROOT);return get(entity,...args);};assert.equal(store.paddockRead('historicalReview',{kind:'verifyReceipt',id:f.row.id,receipt:response(f.q)}).items[0].status,'approved');store.command({id:'approved-light',type:'historicalReview',input:{action:'result',id:f.row.id,receipt:response(f.q)}});}finally{store.close();}
});
test('UI shows each decision and distinguishes original approval from current history',()=>{
 const UI=require('../renderer/paddockhistorical'),q=read('request'),receipt=read('mixed-decisions'),html=UI.rowHtml({id:q.operationId,name:'<script>',databaseId:q.databaseId,sessionId:q.items[0].sessionId,state:'pending',items:receipt.items});
 assert(html.includes('&lt;script&gt;'));assert(html.includes('original acceptance confirmed'));assert(html.includes('Pending review — not accepted'));assert(html.includes('Rejected — not accepted'));assert(html.includes('later corrections or withdrawal'));assert(!html.includes('data-review-approve'));assert(html.includes('data-review-cancel'));q.items.forEach(i=>assert(html.includes(i.sessionId)));
});
test('an approved identity cannot be resubmitted even after its local evidence changes',()=>{
 const a={connection:()=>({mode:'local',databaseId:'collection',historyGuard:{recoveryId:'generation'}}),source:()=> 'source',list:()=>[{databaseId:'collection',sessionId:'saved',state:'complete',originHash:'old',items:[{status:'approved'}]}],evidence:()=>assert.fail('Must stop before rebuilding evidence')};
 assert.throws(()=>S.change(a,{action:'create',databaseId:'collection',recoveryId:'generation',sessionId:'saved',originHash:'new'}),/retained historical submission/);
});
test('historical actions retry only pre-admission contention, preserve input and stop on close',async()=>{
 const {requestWhenReady}=require('../renderer/paddockhistorical'),busy=()=>Error("Error invoking remote method 'paddock:historical-review': Error: Wait for the current Paddock operation.");
 const input={action:'submit',originHash:'original',sessionId:'saved'},seen=[],waits=[];let calls=0,commits=0;
 assert.equal(await requestWhenReady(async()=>{seen.push(input);if(++calls<3)throw busy();commits++;return 'pending';},()=>true,async ms=>waits.push(ms)),'pending');
 assert.equal(commits,1);assert(seen.every(x=>x===input));assert.deepEqual(waits,[250,500]);
 calls=0;await assert.rejects(requestWhenReady(async()=>{calls++;throw busy();},()=>true,async()=>{}),/current Paddock/);assert.equal(calls,6);
 let open=true;calls=0;await assert.rejects(requestWhenReady(async()=>{calls++;throw busy();},()=>open,async()=>{open=false;}),/closed/);assert.equal(calls,1);
 for(const message of ['Lost reply','RECOVERY_CHANGED','Disk full','Wait for the current Paddock operation. extra']){
  calls=0;await assert.rejects(requestWhenReady(async()=>{calls++;throw Error(message);},()=>true,async()=>assert.fail('An uncertain/rejected write must not be retried')),e=>e.message===message);assert.equal(calls,1);
 }
});
test('history list retries temporary contention, remains bounded, and stops on navigation',async()=>{
 const {readWhenReady}=require('../renderer/paddockhistory'),busy=()=>Error('Wait for the current Paddock operation.');let calls=0,waits=[];
 assert.equal(await readWhenReady(async()=>{if(++calls<3)throw busy();return 'ready';},()=>true,async ms=>waits.push(ms)),'ready');assert.deepEqual(waits,[250,500]);
 calls=0;await assert.rejects(readWhenReady(async()=>{calls++;throw busy();},()=>true,async()=>{}),/current Paddock/);assert.equal(calls,6);
 let active=true;calls=0;await assert.rejects(readWhenReady(async()=>{calls++;throw busy();},()=>active,async()=>{active=false;}),/closed/);assert.equal(calls,1);
 calls=0;await assert.rejects(readWhenReady(async()=>{calls++;throw Error('Recovery changed');},()=>true,async()=>assert.fail('Do not retry identity errors')),/Recovery changed/);assert.equal(calls,1);
});
// Test-only preloads compile closed gate copies in the disposable host/worker.
// Production source, HTTP receivers and schemas are not modified.
for(const kind of ['json','sqlite'])test(kind+': real owner worker approval, HTTP polling, restart, cancellation race, withdrawal and restore',{skip:!hasHost,timeout:60000},async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'sf-local-qualify-timing-approval-')),{Store}=require(path.join(source,'src/store.cjs'));
 new Store(path.join(root,'database.sqlite')).replace(require(path.join(source,'tests/support/timing-fixtures.cjs')).fixtures().store.snapshot());
 const {host,request}=require(path.join(source,'tests/support/local-recovery-qualification.cjs')),preloads=['historical-approval-preload.cjs','rich-delivery-preload.cjs'].map(n=>path.join(source,'tests/support',n));let h=await host(root,{preloads});
 t.after(async()=>{await h.kill();assert.equal(path.dirname(root),os.tmpdir());fs.rmSync(root,{recursive:true,force:true});});
 const status=(await request(h,'/v1/shared-history/status')).value;
 const f=await fixture(t,kind,{recoveryId:status.recoveryId});
 const connect=client=>{client.p.ensureLocal=async()=>{client.p.localDescriptor=h.descriptor;client.p.code=h.descriptor.token;return {};};client.p.historyCapability=status.capability;};connect(f);
 const call=f.p.call.bind(f.p);let lost=true,posts=0;
 f.p.call=async(...args)=>{if(args[0]===S.BASE)posts++;const r=await call(...args);if(args[0]===S.BASE&&lost){lost=false;throw Error('Lost intake acknowledgement');}return r;};
 assert.equal((await f.refresh()).state,'queued');assert.equal(posts,1);
 const input=(index,action='approve')=>({action,databaseId:f.q.databaseId,recoveryId:f.q.recoveryId,requestHash:hash(f.q),id:'import-'+hash(['import-'+hash([f.q.recoveryId,f.q.editor.installationId,f.q.operationId]),f.q.items[index].itemId]),note:'Owner reviewed original evidence'});
 await h.command('history-review',input(0));await h.command('history-review',input(2,'reject'));
 await h.kill();h=await host(root,{preloads});await f.reopen();let result=await f.refresh();assert.deepEqual(result.items.map(i=>i.status),['approved','pending','rejected']);assert.equal(posts,1);
 let cancellationLost=true;f.p.call=async(...args)=>{
  if(args[0].endsWith('/cancel')&&cancellationLost){await h.command('history-review',input(1));const r=await call(...args);cancellationLost=false;assert.equal(r.items[1].status,'approved');throw Error('Lost cancellation reply');}return call(...args);
 };
 result=await f.p.historicalReview({action:'cancel',id:f.row.id});assert.equal(result.items[0].status,'approved');await f.reopen();result=await f.refresh();assert.deepEqual(result.items.map(i=>i.status),['approved','approved','rejected']);assert.equal(result.state,'complete');
 const approvedStats=await call('/v1/shared-history/cars/car-a/statistics');assert.equal(approvedStats.historicalSessions,2);assert.equal(approvedStats.personalRecordLaps,0);assert.equal(approvedStats.trackRecordLaps,0);
 const original=await f.full(),item=f.q.items[0],approved=result.items[0].accepted;
 const withdrawal={version:1,databaseId:f.q.databaseId,recoveryId:f.q.recoveryId,operationId:'withdraw-original',editor:f.q.editor,sourceId:item.sourceId,sessionId:item.sessionId,action:'withdraw',expected:approved,reason:'Evidence withdrawn',withdrawalReason:'Evidence withdrawn'};
 await call('/v1/shared-history/operations',withdrawal);const head=await call('/v1/shared-history/sessions/'+item.sourceId+'/'+item.sessionId);assert.equal(head.accepted.state,'withdrawn');
 assert.equal((await call('/v1/shared-history/cars/car-a/statistics')).historicalSessions,1);
 const currentReceipt=await call(S.BASE+'/'+f.q.editor.installationId+'/'+f.q.operationId+'?recoveryId='+f.q.recoveryId);assert.deepEqual(S.receipt(currentReceipt,f.q).items[0].accepted,approved);await f.refresh();assert.deepEqual((await f.full()).request,original.request);
 // A separate pending batch must stop when a real backup restore changes generation.
 const pending=await fixture(t,kind,{recoveryId:status.recoveryId,batchId:'restore-pending'});connect(pending);await pending.refresh();const before=await pending.full();await h.command('backup');await h.command('restore');const blocked=await pending.refresh();assert.equal(blocked.state,'blocked');assert.equal(blocked.code,'RECOVERY_CHANGED');assert.deepEqual((await pending.full()).request,before.request);
 gatesUnchanged();
});
