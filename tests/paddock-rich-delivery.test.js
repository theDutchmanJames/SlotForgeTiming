'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),Module=require('node:module'),{randomUUID}=require('node:crypto');
const Records=require('../paddockrecords'),R=require('../paddock-rich-delivery'),H=require('../paddock-history-write'),{hash,checkedReceipt}=require('../paddock');
const {evidence}=require('../tools/qa/rich-mapper-fixtures.cjs');
const gatePath=require.resolve('../paddock-rich-gate'),sourceGate=require(gatePath);
function compiledGate(enabled){
 const m=new Module(gatePath,module);m.filename=gatePath;m.paths=module.paths;
 const code=fs.readFileSync(gatePath,'utf8');assert.equal((code.match(/const VERIFIED = (?:false|true);/g)||[]).length,1);
 m._compile(code.replace(/const VERIFIED = (?:false|true);/,`const VERIFIED = ${enabled};`),gatePath);m.loaded=true;return m;
}
const gate=compiledGate(false).exports;
const source=process.env.SLOTFORGE_PADDOCK_SOURCE||path.resolve(__dirname,'../../../SlotForge Slotcar Database');
const hostAvailable=fs.existsSync(path.join(source,'src/rich-history.cjs'));
// Qualification ONLY: compile an in-memory copy of the closed gate in this
// node:test process. No application source, settings, environment switch, IPC,
// user profile or Paddock source is changed. This helper is not packaged.
function qualify(t,enabled=true){
 const original=require.cache[gatePath];require.cache[gatePath]=compiledGate(enabled);t.after(()=>require.cache[gatePath]=original);
}
const oldPayload=()=>JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/paddock/fixtures/normal.json')));
for(const kind of ['json','sqlite'])test(kind+': negotiated rich capability survives connection command and reopen, and downgrade clears it without rebinding queued results',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rich-negotiation-')),Database=require('../db'),Client=require('../sqlite-client'),Repo=require('../sqlite-repository'),{Paddock}=require('../paddock'),{JsonPaddockStorage,SqlitePaddockStorage}=require('../paddock-storage');
 const originalFile=path.join(root,'original.json'),work=path.join(root,'work');let db=new Database(originalFile),client,p;
 const base={address:'http://127.0.0.1:51234',databaseId:'paddock-demo',name:'Test host',mode:'local',localKey:'a'.repeat(64)+'.json',automatic:true,timing:true,results:true};
 db.data.paddock={sourceId:'timing',connection:{...base,historyGuard:{version:1,databaseId:base.databaseId,recoveryId:'old-generation'}},withdrawals:[]};
 const saved=evidence();Records.prepare(db.data,saved.session,saved.laps);db.data.sessions=[saved.session];db.data.laps=saved.laps;db.saveNow();const original=fs.readFileSync(originalFile),queued=structuredClone(saved.session.paddockDelivery);
 t.after(async()=>{p?.stop();await p?.idle();await client?.close();await db.writesIdle();if(kind==='sqlite')assert.deepEqual(fs.readFileSync(originalFile),original);fs.rmSync(root,{recursive:true,force:true});});
 if(kind==='sqlite'){require('../sqlite-migration').migrateCopy({source:originalFile,destination:path.join(root,'copy')});require('../sqlite-working').forkCopy(path.join(root,'copy'),work);}
 async function reopen(){p?.stop();await p?.idle();if(kind==='sqlite'){await client?.close();client=new Client();await client.openWorking(work);p=new Paddock(null,{storage:new SqlitePaddockStorage(new Repo(client)),deliveryStore:client});}else{await db.writesIdle();db=new Database(originalFile);p=new Paddock(db);}}
 await reopen();
 let formats=['timing-v1','history-v1'],generation='current-generation';
 const capability=()=>({version:1,features:{guardedWrites:true},formats,writeScope:'trusted-local',operations:H.ROOT+'/operations',receipt:H.ROOT+'/operations/{installationId}/{operationId}',recovery:H.ROOT+'/status'});
 async function negotiate(){p.hostRequest=async(_address,route)=>route==='/v1/status'?{id:base.databaseId,localInstanceId:'instance',capabilities:{sharedHistory:capability()}}:{version:1,databaseId:base.databaseId,recoveryId:generation,capability:capability()};await p.negotiateHistory({address:base.address,databaseId:base.databaseId,instanceId:'instance',token:'synthetic'});}
 await negotiate();await reopen();assert.equal((await p.connection()).connection.historyGuard.richWrites,true);
 assert.equal(require('../paddock-rich-gate').enabled(),sourceGate.enabled(),'A saved host flag never changes the compiled gate');
 formats=['timing-v1'];generation='after-restore';await negotiate();await reopen();let c=await p.connection();assert.equal(Object.hasOwn(c.connection.historyGuard,'richWrites'),false);assert.equal(c.connection.historyGuard.recoveryId,generation);
 const retained=kind==='sqlite'?(await client.snapshot('sessions',saved.session.id,true)).record.value.paddockDelivery:db.data.sessions[0].paddockDelivery;assert.deepEqual(retained,queued);assert.equal(retained.guard.operations[0].recoveryId,'old-generation');
 if(kind==='sqlite'){
  for(const flag of [true,false,undefined,'true',1]){c=await p.connection();const historyGuard={...c.connection.historyGuard};delete historyGuard.richWrites;if(flag!==undefined)historyGuard.richWrites=flag;await p.storage.setConnection({...c.connection,historyGuard},c.revision);await reopen();assert.equal((await p.connection()).connection.historyGuard.richWrites,flag===true?true:undefined);}
  c=await p.connection();await assert.rejects(p.storage.setConnection({...c.connection,historyGuard:{...c.connection.historyGuard,databaseId:'wrong',richWrites:true}},c.revision),/recovery context/);
  c=await p.connection();await p.storage.setConnection({...c.connection,mode:'network',historyGuard:{...c.connection.historyGuard,richWrites:true}},c.revision);await reopen();assert.equal((await p.connection()).connection.historyGuard,undefined);
 }
});
test('closed gate resists host capability, stored settings or environment claims',async t=>{
 qualify(t,false);
 assert.equal(gate.enabled(),false);assert(Object.isFrozen(gate));const e=evidence(),db={paddock:{sourceId:'source',connection:{mode:'local',historyGuard:{databaseId:'paddock-demo',recoveryId:'generation',richWrites:true}}},settings:{richHistory:true}};
 process.env.SLOTFORGE_RICH_HISTORY='1';try{Records.prepare(db,e.session,e.laps);assert.equal(e.session.paddockDelivery.payload.integrationVersion,1);assert.equal(e.session.paddockDelivery.guard.operations[0].bundle.format,'timing-v1');assert.equal(gate.enabled(),false);}finally{delete process.env.SLOTFORGE_RICH_HISTORY;}
 const bundle=require('../paddock-rich-mapper').measured(e.session,e.laps,'paddock-demo').bundle,p={format:'history-v1',databaseId:'paddock-demo',source:{id:'source'},sessionId:e.session.id,revision:1,state:'active',reason:'',bundle};
 const op={version:1,databaseId:p.databaseId,sourceId:'source',sessionId:p.sessionId,operationId:'operation',recoveryId:'generation',editor:{installationId:'source'},action:'create',expected:null,bundle};let calls=0;
 await assert.rejects(H.send(async()=>{calls++;}, {payload:p,guard:{operations:[op]}},()=>false,{capability:{formats:['timing-v1','history-v1']}}),/disabled/);assert.equal(calls,0);
 assert.equal(require('../paddock-historical-store').receipt instanceof Function,true);
});
test('gate-qualified new writes stay local-only, never promote existing legacy or uncertain identities',t=>{
 qualify(t);const e=evidence(),db={paddock:{sourceId:'source',connection:{mode:'local',historyGuard:{databaseId:'paddock-demo',recoveryId:'generation',richWrites:true}}}};
 Records.prepare(db,e.session,e.laps);assert(R.isRich(e.session.paddockDelivery.payload),e.session.paddockDelivery.error);
 assert.equal(R.select(db,{payload:oldPayload(),status:'sent'}),false);assert.equal(R.select(db,{previousPayload:oldPayload(),status:'attention'}),false);assert.equal(R.select(db,{status:'attention'}),false);
 db.paddock.connection.mode='network';assert.equal(R.select(db),false);
 db.paddock.connection.mode='local';delete db.paddock.connection.historyGuard.richWrites;const legacy=evidence();Records.prepare(db,legacy.session,legacy.laps);assert.equal(legacy.session.paddockDelivery.payload.integrationVersion,1);
 const mixed={payload:{...oldPayload(),revision:2},status:'pending'};H.attach(db,mixed,e.session.paddockDelivery);assert(mixed.guardBlocked);assert.equal(mixed.status,'attention');
});
test('production SQLite worker follows the compiled gate when a stored host advertises rich writes',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rich-delivery-worker-')),Database=require('../db'),Client=require('../sqlite-client');let client;
 t.after(async()=>{await client?.close();fs.rmSync(root,{recursive:true,force:true});});
 const db=new Database(path.join(root,'original.json'));db.data.paddock={sourceId:'source',withdrawals:[],connection:{mode:'local',databaseId:'paddock-demo',historyGuard:{databaseId:'paddock-demo',recoveryId:'generation',richWrites:true}}};db.saveNow();const original=fs.readFileSync(db.file);
 require('../sqlite-migration').migrateCopy({source:db.file,destination:path.join(root,'copy')});require('../sqlite-working').forkCopy(path.join(root,'copy'),path.join(root,'work'));
 client=new Client();await client.openWorking(path.join(root,'work'));const e=evidence();await client.command({id:randomUUID(),type:'finalizeSession',session:e.session,laps:e.laps});const rows=await client.outbox('paddock-demo',{}),s=await client.deliverySnapshot(rows[0].key);
 assert.equal(R.isRich(s.payload),sourceGate.enabled());assert.equal(s.guard.operations[0].bundle.format,sourceGate.enabled()?'history-v1':'timing-v1');assert.deepEqual(fs.readFileSync(db.file),original);
 await client.close();client=new Client();await client.openWorking(path.join(root,'work'));assert.deepEqual((await client.deliverySnapshot(rows[0].key)).payload,s.payload);
});
test('rich corrections retain the original source; a closed gate preserves evidence instead of downgrading',t=>{
 qualify(t);const e=evidence(),db={laps:e.laps,paddock:{sourceId:'original-source',withdrawals:[],connection:{mode:'local',historyGuard:{databaseId:'paddock-demo',recoveryId:'generation',richWrites:true}}}};
 Records.prepare(db,e.session,e.laps);const original=structuredClone(e.session.paddockDelivery);
 db.paddock.sourceId='new-installation';Records.revise(db,e.session);const corrected=e.session.paddockDelivery;
 assert.equal(corrected.payload.source.id,'original-source');assert.equal(corrected.guard.operations[1].editor.installationId,'new-installation');assert.equal(corrected.payload.revision,2);
 require.cache[gatePath].exports=gate;Records.revise(db,e.session);const blocked=e.session.paddockDelivery;
 assert.equal(blocked.status,'attention');assert.equal(blocked.payload,null);assert.deepEqual(blocked.previousPayload,corrected.payload);assert.deepEqual(blocked.guard,corrected.guard);
 Records.withdraw(db,e.session,'Deleted locally');assert.equal(db.paddock.withdrawals[0].status,'attention');assert(R.isRich(db.paddock.withdrawals[0].payload));assert.deepEqual(original.guard.operations[0],blocked.guard.operations[0]);
});
test('preflight validates the entire correction chain before sending even the first request',async t=>{
 qualify(t);const e=evidence(),db={laps:e.laps,paddock:{sourceId:'source',connection:{mode:'local',historyGuard:{databaseId:'paddock-demo',recoveryId:'generation',richWrites:true}}}};
 Records.prepare(db,e.session,e.laps);Records.revise(db,e.session);const s=e.session.paddockDelivery;R.preflight(s);
 for(const mutate of [s=>s.guard.operations[1].operationId='bad/id',s=>s.guard.operations[1].version=2,s=>s.guard.operations[1].extra=true,s=>s.guard.operations[1].editor.name=15,s=>s.guard.operations[1].recoveryId='changed',s=>s.guard.operations[1].expected.contentHash='0'.repeat(64),s=>s.guard.operations[1].bundle={format:'timing-v1',payload:oldPayload()}]){
  const bad=structuredClone(s);mutate(bad);assert.throws(()=>R.preflight(bad),{code:'HISTORY_REVIEW_REQUIRED'});
 }
 const cap={version:1,features:{guardedWrites:true},formats:['timing-v1','history-v1'],writeScope:'trusted-local',operations:H.ROOT+'/operations',receipt:H.ROOT+'/operations/{installationId}/{operationId}',recovery:H.ROOT+'/status'};
 const bad=structuredClone(s);bad.guard.operations[1].editor.installationId='bad/id';let calls=0;await assert.rejects(H.send(async()=>{calls++;},bad,()=>false,{capability:cap}),{code:'HISTORY_REVIEW_REQUIRED'});assert.equal(calls,0);
});
function hostFixture(root){
 const {Store}=require(path.join(source,'src/store.cjs')),shared=require(path.join(source,'src/shared-history.cjs')),remote=require(path.join(source,'src/rich-history.cjs')),schema=require(path.join(source,'src/shared-history-schema.cjs')),uploads=require(path.join(source,'src/history-uploads.cjs'));
 const file=path.join(root,'paddock.sqlite');new Store(file,{deferred:true}).replace(require(path.join(source,'tests/support/timing-fixtures.cjs')).fixtures().store.snapshot());let store=new Store(file,{deferred:true});
 const capability={...shared.capability,formats:['timing-v1','history-v1']},recoveryId=shared.status(store).recoveryId,events=[],qualifiedSchema=remote.operationSchema();
 async function call(route,body,_limit,_recovery,method){
  events.push({route,body:structuredClone(body),method});
  try{
   if(route==='/v1/status')return {id:'paddock-demo',permissions:{timingResults:true}};
   const url=new URL('http://localhost'+route),parts=url.pathname.split('/');
   if(route===H.ROOT+'/operations'&&body)return remote.receiveQualified(store,body);
   if(url.pathname.startsWith(H.ROOT+'/operations/'))return shared.lookup(store,parts[4],parts[5],url.searchParams.get('recoveryId'));
   if(url.pathname.startsWith('/v1/shared-history/uploads')){
    const action=parts[5]==='chunks'?'chunk':parts[5]==='commit'?'commit':method==='DELETE'?'cancel':body?'start':'status';
    const input=body||{version:1,databaseId:'paddock-demo',recoveryId:url.searchParams.get('recoveryId'),uploadId:parts[4]};
    // Paddock PUBLIC uploads deliberately reject rich writes today. This
    // test-only dispatch uses its qualified schema/receiver, keeping its real
    // staging SQLite, chunk validation, durable receipts and restore checks.
    const oldSchema=schema.operation,oldReceive=shared.receive;schema.operation=qualifiedSchema;shared.receive=remote.receiveQualified;
    try{return uploads.run(store,{action,input,...(parts[4]?{uploadId:parts[4]}:{}),...(action==='chunk'?{index:Number(parts[6])}:{})});}finally{schema.operation=oldSchema;shared.receive=oldReceive;}
   }
   assert.fail('Unexpected route (no legacy fallback): '+route);
  }catch(e){if(e.apiCode)e.code=e.apiCode;throw e;}
 }
 return {call,capability,recoveryId,events,shared,remote,get store(){return store;},reopen(){store=new Store(file,{deferred:true});}};
}
async function fixture(t,kind){
 qualify(t);const root=fs.mkdtempSync(path.join(os.tmpdir(),'rich-delivery-')),host=hostFixture(root),Database=require('../db');let db=new Database(path.join(root,'original.json')),store,client;
 db.data.paddock={sourceId:'timing-editor-a',withdrawals:[],connection:{mode:'local',databaseId:'paddock-demo',historyGuard:{databaseId:'paddock-demo',recoveryId:host.recoveryId,richWrites:true}}};db.saveNow();const original=fs.readFileSync(db.file);
 if(kind==='sqlite'){require('../sqlite-migration').migrateCopy({source:db.file,destination:path.join(root,'copy')});require('../sqlite-working').forkCopy(path.join(root,'copy'),path.join(root,'work'));store=new(require('../sqlite-working').WorkingStore)(path.join(root,'work'));}
 const makeClient=()=>store?{outbox:async(...a)=>store.outbox(...a),deliverySnapshot:async(...a)=>store.deliverySnapshot(...a),deliveryPayload:async(...a)=>store.deliveryPayload(...a),command:async c=>store.command(c)}:new(require('../json-delivery-store'))(db);
 client=makeClient();const service=new(require('../delivery-service'))(client,{call:host.call,historyCapability:()=>host.capability});
 const save=async(count=2)=>{const e=evidence();if(count>2){const h=e.session.paddockJournal.heats[0],entry=h.entries[0];h.endedAt=h.startedAt+count*10000;entry.laps=Array.from({length:count},(_,i)=>({...entry.laps[0],number:i+1,time:10000,at:h.startedAt+(i+1)*10000}));e.laps=entry.laps.map(l=>({carId:'local',driverId:'driver',lane:1,lapNumber:l.number,time:l.time}));e.session.standings[0].laps=count;}
  return store?store.command({id:randomUUID(),type:'finalizeSession',session:e.session,laps:e.laps}).sessionId:db.saveSessionAsync(e.session,e.laps);};
 const edit=async id=>{if(store){const lap=store.lapsFor(id)[0];store.command({id:randomUUID(),type:'setRecordEligibility',sessionId:id,expectedRevision:store.revision('sessions',id),edits:[{lapId:lap.id,flags:{noTrackRecord:true}}]});}else{db.update('laps',db.data.laps.find(l=>l.sessionId===id).id,{noTrackRecord:true});await db.saved();}};
 const remove=async id=>{if(store)store.command({id:randomUUID(),type:'deleteSession',sessionId:id,expectedRevision:store.revision('sessions',id)});else{db.removeSession(id);await db.saved();}};
 const snapshot=async id=>{for(const row of await client.outbox('paddock-demo',{limit:200})){const s=await client.deliverySnapshot(row.key);if(s.payload.sessionId===id)return s;}return null;};
 const reopen=async()=>{if(store){store.close();store=new(require('../sqlite-working').WorkingStore)(path.join(root,'work'));}else{await db.writesIdle();db=new Database(db.file);}client=makeClient();service.client=client;host.reopen();};
 t.after(async()=>{store?.close();await db.writesIdle();if(kind==='sqlite')assert.deepEqual(fs.readFileSync(db.file),original);fs.rmSync(root,{recursive:true,force:true});});
 return {host,service,save,edit,remove,snapshot,reopen,client:()=>client,db:()=>db,store:()=>store};
}
for(const kind of ['json','sqlite'])test(kind+': qualified finalisation, lost response, offline correction and withdrawal survive reopen',{skip:!hostAvailable},async t=>{
 const f=await fixture(t,kind),id=await f.save(),first=await f.snapshot(id);assert.equal(first.payload.format,'history-v1');const op=first.guard.operations[0];let lost=true;
 f.service.call=async(...args)=>{const r=await f.host.call(...args);if(args[0]===H.ROOT+'/operations'&&lost){lost=false;throw Error('Lost committed reply');}return r;};
 await assert.rejects(f.service.flush('paddock-demo'),/Lost/);await f.edit(id);const changed=await f.snapshot(id);assert.deepEqual(changed.guard.operations[0],op);assert.equal(changed.guard.operations.length,2);assert.deepEqual(changed.guard.operations[1].expected,R.tuple(first.payload));
 assert.deepEqual(changed.payload.bundle.race.participants[0].laps.map(l=>l.id),first.payload.bundle.race.participants[0].laps.map(l=>l.id),'JSON and SQLite pin lap identities before finalisation');
 await f.reopen();await f.service.retry('paddock-demo');await f.service.flush('paddock-demo');let done=await f.snapshot(id);assert.equal(done.status,'sent');assert.equal(done.guard.operations.length,1);checkedReceipt(done.receipt||H.legacy(f.host.shared.lookup(f.host.store,op.editor.installationId,changed.guard.operations[1].operationId,op.recoveryId),done.payload),done.payload);
 await f.service.checkReceipt(done.key);await f.remove(id);const withdrawal=await f.snapshot(id);assert.equal(withdrawal.payload.state,'withdrawn');assert.equal(withdrawal.guard.operations[0].expected.revision,2);await f.service.flush('paddock-demo');assert.equal((await f.snapshot(id)).status,'sent');
 const last=withdrawal.guard.operations[0],receipt=f.host.shared.lookup(f.host.store,last.editor.installationId,last.operationId,last.recoveryId);assert.deepEqual(receipt.accepted,R.tuple(withdrawal.payload));assert.equal(receipt.accepted.revision,3);assert(!f.host.events.some(e=>e.route.startsWith('/v1/timing/sessions')));
});
for(const kind of ['json','sqlite'])test(kind+': qualified chunked delivery resumes frozen bytes and survives lost commit acknowledgement',{skip:!hostAvailable},async t=>{
 const f=await fixture(t,kind),id=await f.save(1800),first=await f.snapshot(id),op=first.guard.operations[0];let dropChunk=true,dropCommit=true;
 f.service.call=async(...args)=>{const r=await f.host.call(...args);if(args[4]==='PUT'&&dropChunk){dropChunk=false;throw Error('Lost chunk');}if(args[0].endsWith('/commit')&&dropCommit){dropCommit=false;throw Error('Lost commit');}return r;};
 await assert.rejects(f.service.flush('paddock-demo'),/Lost chunk/);const staged=(await f.snapshot(id)).guard.uploads[op.operationId];assert.equal(JSON.parse(staged.serialized).bundle.format,'history-v1');
 await f.reopen();await f.service.retry('paddock-demo');await assert.rejects(f.service.flush('paddock-demo'),/Lost commit/);await f.reopen();await f.service.retry('paddock-demo');await f.service.flush('paddock-demo');const done=await f.snapshot(id);assert.equal(done.status,'sent');assert.equal(done.guard.uploads,undefined);assert.equal(f.host.events.filter(e=>e.route.endsWith('/chunks/0')).length,1);assert.deepEqual(done.guard.operations,[op]);
});
for(const kind of ['json','sqlite'])test(kind+': acknowledgement disk failure and host restore cannot rewrite identities',{skip:!hostAvailable},async t=>{
 const f=await fixture(t,kind),id=await f.save(),first=await f.snapshot(id),command=f.client().command.bind(f.client());let failed=false;
 f.client().command=async c=>{if(c.type==='acknowledgeDelivery'&&!failed){failed=true;throw Error('Disk full');}return command(c);};await assert.rejects(f.service.flush('paddock-demo'),/Disk full/);await f.reopen();await f.service.retry('paddock-demo');await f.service.flush('paddock-demo');assert.equal((await f.snapshot(id)).status,'sent');assert.equal(f.host.events.filter(e=>e.route===H.ROOT+'/operations').length,1);
 await f.edit(id);const before=await f.snapshot(id);await f.host.store.restoreAsync(f.host.store.snapshot(),f.host.store.data.revision);await assert.rejects(f.service.flush('paddock-demo'),{code:'RECOVERY_CHANGED'});const after=await f.snapshot(id);assert.equal(after.status,'attention');assert.deepEqual(after.guard,before.guard);assert.equal(after.payload.source.id,first.payload.source.id);
});
for(const kind of ['json','sqlite'])test(kind+': closed gate blocks queued writes and legacy fallback; reopening preserves the queue',{skip:!hostAvailable},async t=>{
 const f=await fixture(t,kind),id=await f.save(),before=await f.snapshot(id);require.cache[gatePath].exports=gate;
 await f.reopen();await assert.rejects(f.service.flush('paddock-demo'),{code:'HISTORY_REVIEW_REQUIRED'});const after=await f.snapshot(id);
 assert.equal(after.status,'attention');assert.deepEqual(after.payload,before.payload);assert.deepEqual(after.guard,before.guard);assert(f.host.events.every(e=>e.route==='/v1/status'));
});
for(const kind of ['json','sqlite'])test(kind+': central Results matches only acknowledged results of the same format',{skip:!hostAvailable},async t=>{
 const f=await fixture(t,kind),id=await f.save();await f.service.flush('paddock-demo');const s=await f.snapshot(id),p=s.payload;
 const row={sourceId:p.source.id,sessionId:p.sessionId,revision:p.revision,state:p.state,format:'history-v1'},key=JSON.stringify([row.sourceId,row.sessionId]);
 const matches=rows=>kind==='sqlite'?f.store().paddockRead('historyMatches',{rows,databaseId:p.databaseId}):new(require('../paddock-storage').JsonPaddockStorage)(f.db()).historyMatches(rows,p.databaseId);
 assert.equal((await matches([row]))[key],id);for(const patch of [{format:'timing-v1'},{revision:2},{sourceId:'another'}])assert.equal(Object.values(await matches([{...row,...patch}]))[0],null);
 const summary=kind==='sqlite'?f.store().paddockRead('summary'):new(require('../paddock-storage').JsonPaddockStorage)(f.db()).summary();assert.equal(summary.deliveries[0].format,'history-v1');assert(summary.deliveries[0].name);
});
test('qualified transport refuses an unguarded rich payload instead of using the legacy POST',{skip:!hostAvailable},async t=>{
 const f=await fixture(t,'json'),id=await f.save(),s=f.db().data.sessions.find(x=>x.id===id);delete s.paddockDelivery.guard;f.db().touch(s);await f.db().commit();
 await assert.rejects(f.service.flush('paddock-demo'),{code:'HISTORY_REVIEW_REQUIRED'});assert.equal((await f.snapshot(id)).status,'attention');assert(f.host.events.every(e=>e.route==='/v1/status'));
});
test('qualified preflight rejects changed bytes, mixed formats and lost capability before any request',{skip:!hostAvailable},async t=>{
 const f=await fixture(t,'json'),id=await f.save(),s=await f.snapshot(id);let calls=0;const call=async()=>{calls++;};
 const bad=structuredClone(s);bad.payload.bundle.race.name='tampered';await assert.rejects(H.send(call,bad,()=>false,{capability:f.host.capability}),/does not match/);
 await assert.rejects(H.send(call,s,()=>false,{capability:{...f.host.capability,formats:['timing-v1']}}),/does not advertise/);assert.equal(calls,0);
 const op=s.guard.operations[0],r=f.host.remote.receiveQualified(f.host.store,op);assert.throws(()=>H.receipt({...r,accepted:{...r.accepted,contentHash:hash(s.payload)}},op,s.payload),{code:'RECEIPT_MISMATCH'});
 if(require(path.join(source,'src/rich-history-gate.cjs')).enabled())assert.equal(f.host.shared.receive(f.host.store,op).duplicate,true);
 else assert.throws(()=>f.host.shared.receive(f.host.store,op));
 assert.equal(f.host.shared.capability.features.historicalImports,require(path.join(source,'src/historical-approval-gate.cjs')).enabled());
});
