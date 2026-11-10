'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const H=require('../paddock-history'),{Paddock}=require('../paddock'),Database=require('../db');
const Client=require('../sqlite-client'),Repo=require('../sqlite-repository'),{SqlitePaddockStorage}=require('../paddock-storage');
const sample=()=>JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/paddock/fixtures/normal.json')));
function remote(){
 const p=sample(),token='a'.repeat(64),participants=p.participants.map(({laps,...e})=>e);
 const heads={version:1,databaseId:p.databaseId,resultToken:token,payload:{...p,participants},summaries:[],warnings:[],requiresCorrection:false,lapCounts:p.participants.map(e=>({participantId:e.id,count:e.laps.length}))};
 const listing={version:1,databaseId:p.databaseId,snapshot:'first',cursor:'first',results:[{sourceId:p.source.id,sessionId:p.sessionId,revision:p.revision,state:p.state,name:p.name,carIds:p.participants.map(e=>e.carId).filter(Boolean),resultToken:token}],nextOffset:null};
 const calls=[];let failure=null;
 return {p,token,heads,listing,calls,fail(e){failure=e;},call:async route=>{
  calls.push(route);if(failure)throw failure;
  if(route==='/v1/status')return {id:p.databaseId,permissions:{timingResults:true},capabilities:{scalable:{version:1}}};
  if(route==='/v1/scalable/results')return structuredClone(listing);
  if(route.includes('/laps/')){const u=new URL('http://localhost'+route),participantId=u.pathname.split('/').at(-1),e=p.participants.find(e=>e.id===participantId),offset=Number(u.searchParams.get('offset'));
   return {version:1,databaseId:p.databaseId,resultToken:token,sourceId:p.source.id,sessionId:p.sessionId,participantId,laps:e.laps.slice(offset,offset+250),total:e.laps.length,nextOffset:offset+250<e.laps.length?offset+250:null};}
  return structuredClone(heads);
 }};
}
async function fixture(t,kind,delivered=false){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'timing-history-')),file=path.join(dir,'original.json'),db=new Database(file);db.data.slotcars=[{id:'untouched',model:'Original',lapsDriven:123}];if(delivered){const payload=sample();db.data.sessions=[{id:payload.sessionId,date:payload.startedAt,setupName:'Local race',standings:[],paddockDelivery:{payload,status:'sent'}}];}db.saveNow();const original=fs.readFileSync(file);let worker,repo;
 if(kind==='sqlite'){require('../sqlite-migration').migrateCopy({source:file,destination:path.join(dir,'copy')});require('../sqlite-working').forkCopy(path.join(dir,'copy'),path.join(dir,'work'));worker=new Client();await worker.openWorking(path.join(dir,'work'));repo=new Repo(worker);}
 const p=repo?new Paddock(null,{storage:new SqlitePaddockStorage(repo),deliveryStore:worker}):new Paddock(db),r=remote();
 const before=await p.connection();await p.storage.setConnection({mode:'local',localKey:'b'.repeat(64)+'.json',address:'http://127.0.0.1:5001',databaseId:r.p.databaseId,name:'Synthetic',results:true,timing:true},before.revision);
 p.code='test';p.call=r.call;
 t.after(async()=>{p.stop();await p.idle();await worker?.close();await db.writesIdle();if(repo)assert.deepEqual(fs.readFileSync(file),original);fs.rmSync(dir,{recursive:true,force:true});});
 return {p,r,db,worker,repo,dir,reopen:async()=>{await worker.close();worker=new Client();await worker.openWorking(path.join(dir,'work'));p.storage=new SqlitePaddockStorage(new Repo(worker));return worker;}};
}
const ROOT='/v1/scalable/results';
function server(f,n=601){
 const {p,r}=f;const original=r.p.participants[0].laps[0];r.p.participants[0].laps=Array.from({length:n},(_,i)=>({...original,id:'lap-'+i,number:i+1}));
 r.heads.lapCounts=r.p.participants.map(e=>({participantId:e.id,count:e.laps.length}));
 let cursor='c1',token=r.token,mode='active',reset=false,events=[],fault=null;const calls=[];
 const head=()=>({...structuredClone(r.heads),resultToken:token,payload:{...structuredClone(r.heads.payload),state:mode},lapCounts:mode==='active'?r.heads.lapCounts:[]});
 const list=()=>({...structuredClone(r.listing),snapshot:cursor,cursor,results:mode==='removed'?[]:r.listing.results.map(x=>({...x,state:mode,resultToken:token}))});
 p.scalable={};p.call=async route=>{
  calls.push(route);if(fault)throw fault;
  const u=new URL('http://localhost'+route);
  if(u.pathname==='/v1/status')return {id:r.p.databaseId,permissions:{timingResults:true},capabilities:{scalable:{version:1}}};
  if(u.pathname==='/v1/scalable/status')return {version:1,databaseId:r.p.databaseId,cursor};
  if(u.pathname==='/v1/scalable/changes')return {version:1,databaseId:r.p.databaseId,kind:'results',cursor,more:false,resetRequired:reset,entries:reset||u.searchParams.get('cursor')===cursor?[]:events};
  if(u.pathname===ROOT)return list();
  if(mode==='removed')throw Object.assign(Error('gone'),{code:'SESSION_NOT_FOUND'});
  if(u.searchParams.has('token')&&u.searchParams.get('token')!==token)throw Object.assign(Error('changed'),{code:'RESULT_CHANGED'});
  if(route.includes('/laps/')){const participantId=u.pathname.split('/').at(-1),e=r.p.participants.find(e=>e.id===participantId),offset=Number(u.searchParams.get('offset'));return {version:1,databaseId:r.p.databaseId,resultToken:token,sourceId:r.p.source.id,sessionId:r.p.sessionId,participantId,laps:e.laps.slice(offset,offset+250),total:e.laps.length,nextOffset:offset+250<e.laps.length?offset+250:null};}
  return head();
 };
 return {head,list,calls,fail:e=>fault=e,change:(next='active',restore=false)=>{cursor+='x';token=(token[0]==='a'?'b':'a').repeat(64);mode=next;reset=restore;events=[{sourceId:r.p.source.id,sessionId:r.p.sessionId,operation:next==='removed'?'remove':'invalidate'}];},get cursor(){return cursor;},get token(){return token;}};
}
const opts=(f,s,kind='head')=>({kind,sourceId:f.r.p.source.id,sessionId:f.r.p.sessionId,token:s.token});
const sync=p=>p.exclusive(()=>p.syncHistory());
async function settled(p){for(let i=0;i<20;i++){await sync(p);assert.equal(p.historySyncError,'');const s=await p.historySyncState();if(!s.work)return s;}assert.fail('sync did not settle');}
for(const kind of ['json','sqlite'])test(kind+': bounded staged sync survives restart; corrections and withdrawals replace all cached pages atomically',async t=>{
 const f=await fixture(t,kind),{p,r,db}=f,s=server(f);await p.historyRead(opts(f,s));const oldRoute=H.route(opts(f,s));
 await sync(p);let saved=await p.historySyncState();assert.equal(saved.cursor,null);assert(saved.work.active);assert.equal(s.calls.filter(x=>!x.includes('/v1/status')).length,5);assert(await p.storage.historyCacheGet(H.key(r.p.databaseId,oldRoute)));
 const firstPage=H.route({...opts(f,s,'laps'),participantId:r.p.participants[0].id,offset:0});assert.equal(await p.storage.historyCacheGet(H.key(r.p.databaseId,firstPage)),null);
 if(kind==='sqlite')await f.reopen();else{await db.writesIdle();p.storage=new(require('../paddock-storage').JsonPaddockStorage)(new Database(db.file));}
 await settled(p);saved=await p.historySyncState();assert.equal(saved.cursor,s.cursor);assert.equal(s.calls.filter(x=>x.includes('/laps/')&&x.includes('offset=0')).length,1);
 assert.equal((await p.storage.historyCacheGet(H.key(r.p.databaseId,firstPage))).value.laps.length,250);
 const lastRoute=H.route({...opts(f,s,'laps'),participantId:r.p.participants[0].id,offset:500});assert.equal((await p.storage.historyCacheGet(H.key(r.p.databaseId,lastRoute))).value.laps.length,101);
 const initialCursor=saved.cursor;s.change();r.p.participants[0].laps[0].reason='Corrected';await sync(p);assert.equal((await p.historySyncState()).cursor,initialCursor);assert(await p.storage.historyCacheGet(H.key(r.p.databaseId,oldRoute)));
 await settled(p);assert.equal(await p.storage.historyCacheGet(H.key(r.p.databaseId,oldRoute)),null);p.code='';assert.equal((await p.historyRead({...opts(f,s,'laps'),participantId:r.p.participants[0].id})).value.laps[0].reason,'Corrected');p.code='test';
 s.change('withdrawn');await settled(p);assert.equal((await p.storage.historyCacheGet(H.key(r.p.databaseId,H.route(opts(f,s))))).value.payload.state,'withdrawn');assert.equal(await p.storage.historyCacheGet(H.key(r.p.databaseId,lastRoute)),null);
 s.change('removed');await settled(p);assert.deepEqual(await p.storage.historySyncRead({kind:'tracked',databaseId:r.p.databaseId}),[]);
 assert.equal(db.data.laps.length,0);assert.equal(db.data.sessions.length,0);assert.equal(db.data.slotcars[0].lapsDriven,123);
});
for(const kind of ['json','sqlite'])test(kind+': reset, changed token mid-download, offline and racing do not lose the old applied cursor',async t=>{
 const f=await fixture(t,kind),{p,r}=f,s=server(f);await p.historyRead(opts(f,s));await settled(p);const before=await p.historySyncState();s.change('active',true);
 await sync(p);assert.equal((await p.historySyncState()).cursor,before.cursor);s.change('active',true);await sync(p);assert.match(p.historySyncError,/changed/);assert.equal((await p.historySyncState()).work,null);assert.equal((await p.historySyncState()).cursor,before.cursor);
 s.fail(Error('Offline'));await sync(p);assert.match(p.historySyncError,/Offline/);assert.equal((await p.historySyncState()).cursor,before.cursor);s.fail(null);await settled(p);assert.equal((await p.historySyncState()).cursor,s.cursor);
 const n=s.calls.length;p.isRacing=()=>true;await sync(p);assert.equal(s.calls.length,n);p.isRacing=()=>false;p.quiescing=true;await p.syncHistory();assert.equal(s.calls.length,n);p.quiescing=false;
 // A failed publish must not advance progress, so retry works without re-fetching committed pages.
 s.change();const change=p.storage.historySyncChange.bind(p.storage);let reject=true;p.storage.historySyncChange=async input=>{if(reject&&input.action==='publish')throw Error('Disk full');return change(input);};
 for(let i=0;i<4&&!p.historySyncError;i++)await sync(p);assert.match(p.historySyncError,/Disk full/);assert.notEqual((await p.historySyncState()).cursor,s.cursor);reject=false;await settled(p);assert.equal((await p.historySyncState()).cursor,s.cursor);
 const cursor=(await p.historySyncState()).cursor;p.call=async()=>({version:1,databaseId:r.p.databaseId,kind:'results',cursor,more:true,resetRequired:false,entries:[]});await sync(p);assert.match(p.historySyncError,/Invalid history/);assert.equal((await p.historySyncState()).cursor,cursor);
});
test('feed validation rejects coercible identifiers and non-progress; coalesces repeated identities',()=>{
 const {changes}=require('../paddock-history-sync'),base={version:1,databaseId:'db',kind:'results',cursor:'c2',more:false,resetRequired:false,entries:[]};
 for(const bad of [{cursor:12},{entries:[{sourceId:12,sessionId:'s',operation:'remove'}]},{cursor:'c1',more:true},{resetRequired:true,entries:[{sourceId:'a',sessionId:'s',operation:'remove'}]}])assert.throws(()=>changes({...base,...bad},'db','c1'));
 assert.deepEqual(changes({...base,entries:[{sourceId:'a',sessionId:'s',operation:'invalidate'},{sourceId:'a',sessionId:'s',operation:'remove'}]},'db','c1').entries,[{sourceId:'a',sessionId:'s',operation:'remove'}]);
});
for(const kind of ['json','sqlite'])test(kind+': unopened history stays on demand, empty feed batches advance only results cursor',async t=>{
 const f=await fixture(t,kind),{p,r}=f,s=server(f);await settled(p);assert(!s.calls.some(x=>x.includes('/laps/')));p.localEventCursor='car-notification';s.change();await settled(p);assert.equal((await p.historySyncState()).cursor,s.cursor);assert.equal(p.localEventCursor,'car-notification');assert.equal((await p.historyRead({kind:'hint'})).history.pending,false);
 const n=s.calls.length;await sync(p);assert.equal(s.calls.length,n+1);assert.equal(await p.storage.historyCacheGet(H.key(r.p.databaseId,H.route(opts(f,s)))),null);
});
test('JSON failed cache transaction rolls back only history roots, retaining unrelated writes',async t=>{
 const f=await fixture(t,'json'),{p,db}=f,s=server(f,1);await p.historyRead(opts(f,s));const saved=structuredClone(db.data.paddockHistoryCache),commit=p.storage.commit.bind(p.storage);p.storage.commit=async()=>{db.data.drivers.push({id:'unrelated',name:'Retained'});throw Error('Disk full');};await sync(p);assert.match(p.historySyncError,/Disk full/);assert.deepEqual(db.data.paddockHistoryCache,saved);assert.equal(db.data.paddockHistorySync,undefined);assert.equal(db.data.paddockHistoryStage,undefined);assert.equal(db.data.drivers[0].name,'Retained');p.storage.commit=commit;await settled(p);
});
test('SQLite actual disk-full and post-write failure roll back staged data and cursor; exact retries remain safe',async t=>{
 const f=await fixture(t,'sqlite'),{p,r}=f,s=server(f,1);await p.historyRead(opts(f,s));const inputs=[],original=p.storage.historySyncChange.bind(p.storage);
 p.storage.historySyncChange=async input=>{inputs.push(structuredClone(input));return original(input);};await settled(p);
 await f.worker.close();const {WorkingStore}=require('../sqlite-working');let fail=false;const store=new WorkingStore(path.join(f.dir,'work'),{checkpoint:phase=>{if(fail&&phase==='domain-written')throw Error('Injected commit failure');}});
 try{
  const S=require('../paddock-history-sync-store'),read=()=>S.read(S.sqlAdapter(store),{kind:'state',databaseId:r.p.databaseId});
  // Start another job, then refuse its first staged page with real SQLITE_FULL.
  let state=read();const begin={...inputs.find(x=>x.action==='begin'),expected:state.version,next:{...state,work:inputs.find(x=>x.action==='begin').next.work}};
  state=store.command({id:'retry-begin',type:'syncPaddockHistory',...begin});
  const first=structuredClone(inputs.find(x=>x.action==='stage'));first.expected=state.version;first.next={...state,work:first.next.work};first.row.value.payload.notes='x'.repeat(2*1024*1024);
  const prior=read(),cache=store.get(H.CACHE,H.key(r.p.databaseId,H.route(opts(f,s))),true).value;
  store.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');const pages=store.statement('PRAGMA page_count').get().page_count;store.db.exec('PRAGMA max_page_count='+pages);
  assert.throws(()=>store.command({id:'full-page',type:'syncPaddockHistory',...first}),e=>(e.errcode&255)===13);assert.deepEqual(read(),prior);assert.equal(store.receipt('full-page'),null);assert.equal(store.statement('SELECT count(*) n FROM records WHERE entity=?').get(S.STAGE).n,0);
  store.db.exec('PRAGMA max_page_count=2147483646');
  // Replay each stage/publish/finish with a failure after its mutations, then retry.
  for(const raw of inputs.filter(x=>x.action!=='begin')){
   const input=structuredClone(raw);state=read();input.expected=state.version;input.next.version=state.version;input.next.cursor=raw.action==='finish'?raw.next.cursor:state.cursor;
   const before=read(),id='step-'+state.version,cmd={id,type:'syncPaddockHistory',...input};fail=true;
   assert.throws(()=>store.command(cmd),/Injected/);fail=false;assert.deepEqual(read(),before);assert.equal(store.receipt(id),null);
   if(input.action==='publish')assert.deepEqual(store.get(H.CACHE,cache.id,true).value,cache);
   const done=store.command(cmd);assert.deepEqual(store.command(cmd),done);
  }
  assert.equal(read().cursor,s.cursor);assert.equal(store.statement('PRAGMA integrity_check').get().integrity_check,'ok');
  assert.equal(store.get('slotcars','untouched',true).value.lapsDriven,123);
 }finally{store.close();}
});
const source=process.env.SLOTFORGE_PADDOCK_SOURCE||path.resolve(__dirname,'../../../SlotForge Slotcar Database');
test('real protected Paddock change feed: automatic refresh, correction, withdrawal and restored epoch', {skip:!fs.existsSync(path.join(source,'src/local-library.cjs'))},async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'timing-sync-host-')),profile=path.join(dir,'host');fs.mkdirSync(profile);
 const {Store}=require(path.join(source,'src/store.cjs')),{LocalLibrary}=require(path.join(source,'src/local-library.cjs')),T=require(path.join(source,'src/timing-integration.cjs'));
 const f=require(path.join(source,'tests/support/timing-fixtures.cjs')).fixtures(),store=new Store(path.join(profile,'database.json'));store.replace(f.store.snapshot());T.receive(store,f.normal);
 const host=new LocalLibrary({store,profile,folder:path.join(dir,'discovery')}),db=new Database(path.join(dir,'timing.json')),p=new Paddock(db);p.localScan=()=>require('../paddock-local-discovery').scan({folder:host.folder});p.launcherScan=async()=>[];
 t.after(async()=>{p.stop();await p.idle();host.quiesce();await host.idle();host.close();await db.writesIdle();fs.rmSync(dir,{recursive:true,force:true});});
 await host.start();const [found]=await p.discoverLocal();await p.connect({mode:'local',...found});clearTimeout(p.timer);clearTimeout(p.localTimer);
 let list=await p.historyRead({kind:'list'});const options=row=>({kind:'head',protocol:'shared',sourceId:row.sourceId,sessionId:row.sessionId,token:row.resultToken});await p.historyRead(options(list.value.results[0]));await settled(p);
 T.receive(store,f.correction);await p.localTick();clearTimeout(p.timer);clearTimeout(p.localTimer);await settled(p);
 const row=await p.storage.historyCacheGet(H.key(f.normal.databaseId,'/v1/shared-history/sessions?limit=50')),corrected=row.value.results[0],lapRoute=H.route({...options(corrected),kind:'laps',participantId:'entry-1',offset:0});assert.equal((await p.storage.historyCacheGet(H.key(f.normal.databaseId,lapRoute))).value.laps[0].valid,false);
 const old=await p.historySyncState();await store.restoreAsync(store.snapshot(),store.data.revision);await settled(p);assert.notEqual((await p.historySyncState()).cursor,old.cursor);assert.equal(await p.storage.historyCacheGet(H.key(f.normal.databaseId,lapRoute)),null);
 T.receive(store,f.withdrawal);await settled(p);const now=await p.storage.historyCacheGet(H.key(f.normal.databaseId,'/v1/shared-history/sessions?limit=50'));p.code='';assert.equal((await p.historyRead(options(now.value.results[0]))).value.payload.state,'withdrawn');assert.equal(db.data.sessions.length,0);assert.equal(db.data.laps.length,0);
});
for(const kind of ['json','sqlite'])test(kind+': multi-batch feed survives final-list failure and keeps catalogue cursor independent',async t=>{
 const f=await fixture(t,kind),{p,r}=f;server(f,1);await settled(p);const original=p.call;let finalFail=true;const seen=[];
 p.call=async route=>{
  if(route.includes('/changes?')){const from=new URL('http://localhost'+route).searchParams.get('cursor');seen.push(from);return {version:1,databaseId:r.p.databaseId,kind:'results',cursor:from==='c1'?'c2':'c3',more:from==='c1',resetRequired:false,entries:[]};}
  if(route===ROOT&&finalFail)throw Error('List temporarily offline');return original(route);
 };
 await sync(p);assert.equal((await p.historySyncState()).cursor,'c1');assert.equal((await p.historySyncState()).work.target,'c2');finalFail=false;await sync(p);assert.equal((await p.historySyncState()).cursor,'c2');assert.equal(p.historySyncPending,true);await sync(p);assert.equal((await p.historySyncState()).cursor,'c3');assert.deepEqual(seen,['c1','c2']);assert.equal(p.historySyncPending,false);
 // An invalid/ahead cursor requests a fresh baseline rather than looping forever.
 p.call=async route=>{if(route.includes('/changes?'))throw Object.assign(Error('Invalid cursor'),{code:'INVALID_CURSOR'});return original(route);};await settled(p);assert.equal((await p.historySyncState()).cursor,'c1');
});
test('SQLite legacy export and conversion preserve an unfinished sync job without modifying race history',async t=>{
 const f=await fixture(t,'sqlite'),{p,r}=f,s=server(f);await p.historyRead(opts(f,s));await sync(p);const state=await p.historySyncState();assert(state.work.active);const exported=path.join(f.dir,'cache-export.json');await f.worker.exportLegacy(exported);
 const payload=JSON.parse(fs.readFileSync(exported)).data;assert.equal(payload.paddockHistoryStage.length,3);assert.equal(payload.paddockHistorySync[0].version,state.version);assert.equal(payload.sessions.length,0);assert.equal(payload.laps.length,0);
 const restored=require('../sqlite-bulk').restoreLegacy(exported,path.join(f.dir,'restored-package'));const worker=new Client();await worker.openWorking(restored.destination);
 const storage=p.storage;try{p.storage=new SqlitePaddockStorage(new Repo(worker));assert.deepEqual(await p.historySyncState(),state);await settled(p);assert.equal((await p.historySyncState()).cursor,s.cursor);assert.equal((await p.historyRead({...opts(f,s,'laps'),participantId:r.p.participants[0].id,offset:500})).value.laps.length,101);}finally{p.storage=storage;await worker.close();}
});
test('incomplete participant count metadata cannot publish a complete cache',async t=>{
 const f=await fixture(t,'json'),{p,r}=f,s=server(f,1);await p.historyRead(opts(f,s));r.heads.lapCounts=[];await sync(p);assert.match(p.historySyncError,/Invalid central history/);assert.equal((await p.historySyncState()).cursor,null);
});

test('variable-length lap pages publish as a complete contiguous session',async t=>{
 const f=await fixture(t,'sqlite'),{p,r}=f,s=server(f,300),call=p.call;
 p.call=async route=>{const v=await call(route);if(route.includes('/laps/')){const offset=Number(new URL('http://localhost'+route).searchParams.get('offset'));v.laps=v.laps.slice(0,90);v.nextOffset=offset+v.laps.length===v.total?null:offset+v.laps.length;}return v;};
 await p.historyRead(opts(f,s));await settled(p);for(const [offset,length]of [[0,90],[90,90],[180,90],[270,30]]){const route=H.route({...opts(f,s,'laps'),participantId:r.p.participants[0].id,offset});assert.equal((await p.storage.historyCacheGet(H.key(r.p.databaseId,route))).value.laps.length,length);}
});

test('large removal batches yield after bounded cache work instead of monopolising the connection',async t=>{
 const f=await fixture(t,'sqlite'),{p,r}=f,s=server(f,1);await settled(p);const entries=[];
 for(let i=0;i<12;i++){const sessionId='removed-'+i,route=H.route({...opts(f,s),sessionId});await p.storage.historyCachePut(H.cacheRow(r.p.databaseId,route,{...s.head(),payload:{...s.head().payload,sessionId}}));entries.push({sourceId:r.p.source.id,sessionId,operation:'remove'});}
 const call=p.call;p.call=async route=>route.includes('/changes?')?{version:1,databaseId:r.p.databaseId,kind:'results',cursor:'c2',more:false,resetRequired:false,entries}:call(route);
 await sync(p);assert.equal((await p.historySyncState()).work.next,8);assert.equal((await p.historySyncState()).cursor,'c1');await settled(p);assert.equal((await p.historySyncState()).cursor,'c2');assert.deepEqual(await p.storage.historySyncRead({kind:'tracked',databaseId:r.p.databaseId}),[]);
});
