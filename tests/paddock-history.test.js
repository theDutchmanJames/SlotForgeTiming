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
for(const kind of ['json','sqlite'])test(kind+': lazy central heads and paged laps, offline reopen, no local lap/mileage writes',async t=>{
 const f=await fixture(t,kind),{p,r,db,dir}=f;let worker=f.worker;const list=await p.historyRead({kind:'list'});assert.equal(list.value.results.length,1);assert(!r.calls.some(x=>x.includes('/laps/')));
 const o={sourceId:r.p.source.id,sessionId:r.p.sessionId,token:r.token};const head=await p.historyRead({kind:'head',...o});assert.equal(head.value.payload.name,r.p.name);assert(!r.calls.some(x=>x.includes('/laps/')));
 const laps=await p.historyRead({kind:'laps',...o,participantId:r.p.participants[0].id,offset:0});assert.deepEqual(laps.value.laps,r.p.participants[0].laps);
 if(worker){worker=await f.reopen();}else{await db.writesIdle();p.storage=new(require('../paddock-storage').JsonPaddockStorage)(new Database(db.file));}
 p.code='';assert.equal((await p.historyRead({kind:'list',offset:0,snapshot:'first'})).value.snapshot,'first');const offline=await p.historyRead({kind:'head',...o});assert.equal(offline.offline,true);assert.deepEqual(offline.value,head.value);
 assert.equal((await p.historyRead({kind:'laps',...o,participantId:'missing',offset:0})).value,null);
 assert.equal(db.data.slotcars[0].lapsDriven,123);assert.equal(db.data.sessions.length,0);assert.equal(db.data.laps.length,0);
 if(worker){const output=path.join(dir,'export.json');await worker.exportLegacy(output);const snapshot=JSON.parse(fs.readFileSync(output)).data;assert.equal(snapshot.sessions.length,0);assert.equal(snapshot.laps.length,0);assert.equal(snapshot.paddockHistoryCache.length,3);}
});
for(const kind of ['json','sqlite'])test(kind+': identity, revocation, changed revisions and failed cache writes cannot publish a false current page',async t=>{
 const {p,r}=await fixture(t,kind);const good=await p.historyRead({kind:'list'});
 r.listing.databaseId='wrong';await assert.rejects(p.historyRead({kind:'list'}),/Invalid central/);r.listing.databaseId=r.p.databaseId;
 for(const code of ['RESULT_CHANGED','SNAPSHOT_CHANGED','SESSION_NOT_FOUND','PERMISSION_REQUIRED','DATABASE_MISMATCH']){r.fail(Object.assign(Error(code),{code}));await assert.rejects(p.historyRead({kind:'list'}),new RegExp(code));}
 r.fail(Object.assign(Error('Connection refused'),{code:'ECONNREFUSED'}));assert.equal((await p.historyRead({kind:'list'})).offline,true);r.fail(null);
 p.storage.historyCachePut=async()=>{throw Error('Disk full');};r.listing.results[0].name='Uncached update';const failed=await p.historyRead({kind:'list'});assert.equal(failed.offline,true);assert.deepEqual(failed.value,good.value);
 p.code='';const before=await p.connection();await p.storage.setConnection(null,before.revision);assert.equal((await p.historyRead({kind:'list'})).available,false);
});
test('strict routes, duplicate identities, token mixing and impossible lap pages are rejected',()=>{
 const r=remote(),o={kind:'head',sourceId:r.p.source.id,sessionId:r.p.sessionId,token:r.token};
 assert.throws(()=>H.route({...o,sourceId:'../other'}));assert.throws(()=>H.route({kind:'list',offset:50}));assert.throws(()=>H.route({kind:'list',offset:-1}));
 assert.throws(()=>H.validate({...r.listing,results:[...r.listing.results,...r.listing.results]},{kind:'list'},r.p.databaseId));
 assert.throws(()=>H.validate({...r.heads,resultToken:'b'.repeat(64)},o,r.p.databaseId));
 const lap={...r.p.participants[0].laps[0],valid:false,recordEligible:true};
 assert.throws(()=>H.validate({version:1,databaseId:r.p.databaseId,resultToken:r.token,sourceId:o.sourceId,sessionId:o.sessionId,participantId:'entry-1',laps:[lap],total:1,nextOffset:null},{...o,kind:'laps',participantId:'entry-1'},r.p.databaseId));
});
test('deduplication requires exact database, source, session, revision and acknowledged state',()=>{
 const r=remote(),result=r.listing.results[0],delivery={key:require('../delivery-key').keyOf(r.p),status:'sent',sessionId:r.p.sessionId};
 assert.equal(H.matches(result,[delivery],r.p.databaseId),r.p.sessionId);
 for(const changed of [{...result,sourceId:'another'},{...result,revision:2},{...result,state:'withdrawn'}])assert.equal(H.matches(changed,[delivery],r.p.databaseId),null);
 assert.equal(H.matches(result,[{...delivery,status:'pending'}],r.p.databaseId),null);assert.equal(H.matches(result,[delivery],'other-db'),null);
});
test('central renderer escapes supplied text and keeps record eligibility separate from classification',()=>{
 const ui=require('../renderer/paddockhistory'),r=remote();r.heads.payload.track.name='<script>alert(1)</script>';r.heads.payload.participants[0].displayName='<img onerror=bad>';
 const html=ui.headHtml(r.heads);assert(!html.includes('<script>'));assert(!html.includes('<img'));assert(html.includes('Eligible best'));assert(html.includes('Classified time'));assert(html.includes('not cross-track records'));
});
const source=process.env.SLOTFORGE_PADDOCK_SOURCE||path.resolve(__dirname,'../../../SlotForge Slotcar Database');
test('actual protected Paddock host: fresh Timing sees existing history; multi-page laps, corrections, withdrawal and reset',{skip:!fs.existsSync(path.join(source,'src/local-library.cjs')),timeout:30000},async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'timing-central-host-')),profile=path.join(dir,'paddock');fs.mkdirSync(profile);
 const {Store}=require(path.join(source,'src/store.cjs')),{LocalLibrary}=require(path.join(source,'src/local-library.cjs')),T=require(path.join(source,'src/timing-integration.cjs'));
 const f=require(path.join(source,'tests/support/timing-fixtures.cjs')).fixtures(),store=new Store(path.join(profile,'database.json'));store.replace(f.store.snapshot());
 for(const payload of [f.normal,f.multi,f.endurance])T.receive(store,payload);
 const large=structuredClone(f.normal);large.sessionId='long-session';large.endedAt='2026-10-31T10:11:00.000Z';large.heats[0].endedAtMs=600000;large.participants[0].stints[0].endedAtMs=600000;
 large.participants[0].laps=Array.from({length:601},(_,i)=>({...large.participants[0].laps[0],id:'lap-'+i,number:i+1,durationMs:500,endedAtMs:(i+1)*500}));T.receive(store,large);
 const host=new LocalLibrary({store,profile,folder:path.join(dir,'discovery')}),db=new Database(path.join(dir,'timing.json')),p=new Paddock(db);p.localScan=()=>require('../paddock-local-discovery').scan({folder:host.folder});p.launcherScan=async()=>[];
 t.after(async()=>{p.stop();await p.idle();host.quiesce();await host.idle();host.close();await db.writesIdle();fs.rmSync(dir,{recursive:true,force:true});});
 await host.start();assert.equal(host.error,'');const [found]=await p.discoverLocal();await p.connect({mode:'local',...found});clearTimeout(p.timer);clearTimeout(p.localTimer);
 let list=await p.historyRead({kind:'list'});assert.equal(list.value.results.length,4);assert.equal(db.data.sessions.length,0);
 const request=result=>({sourceId:result.sourceId,sessionId:result.sessionId,token:result.resultToken});
 const long=list.value.results.find(r=>r.sessionId==='long-session'),o=request(long),collected=[];
 let at=0;do{const page=await p.historyRead({kind:'laps',...o,participantId:'entry-1',offset:at});collected.push(...page.value.laps);assert(page.value.laps.length<=250);at=page.value.nextOffset;}while(at!==null);assert.deepEqual(collected,large.participants[0].laps);
 for(const payload of [f.multi,f.endurance]){const result=list.value.results.find(r=>r.sessionId===payload.sessionId),head=await p.historyRead({kind:'head',...request(result)});for(const participant of payload.participants){const page=await p.historyRead({kind:'laps',...request(result),participantId:participant.id});assert.deepEqual(page.value.laps,participant.laps);}assert.deepEqual(head.value.payload.participants[0].configuration,payload.participants[0].configuration);}
 const normal=list.value.results.find(r=>r.sessionId===f.normal.sessionId),old=request(normal);await p.historyRead({kind:'head',...old});T.receive(store,f.correction);
 await assert.rejects(p.historyRead({kind:'head',...old}),{code:'RESULT_CHANGED'});list=await p.historyRead({kind:'list'});let now=request(list.value.results.find(r=>r.sessionId===f.normal.sessionId));const corrected=await p.historyRead({kind:'laps',...now,participantId:'entry-1'});assert.equal(corrected.value.laps[0].valid,false);
 T.receive(store,f.withdrawal);list=await p.historyRead({kind:'list'});now=request(list.value.results.find(r=>r.sessionId===f.normal.sessionId));assert.equal((await p.historyRead({kind:'head',...now})).value.payload.state,'withdrawn');
 const beforeRestore=request(list.value.results.find(r=>r.sessionId==='long-session'));await store.restoreAsync(store.snapshot(),store.data.revision);await assert.rejects(p.historyRead({kind:'head',...beforeRestore}),{code:'RECOVERY_CHANGED'});
 assert.equal(db.data.sessions.length,0);assert.equal(db.data.laps.length,0);
});

for(const kind of ['json','sqlite'])test(kind+': matching local delivery is targeted and hints never request remote data',async t=>{
 const {p,r}=await fixture(t,kind,true);p.storage.summary=()=>{throw Error('Do not scan all deliveries and linked cars');};
 const result=await p.historyRead({kind:'list'}),key=JSON.stringify([r.p.source.id,r.p.sessionId]);assert.equal(result.localMatches[key],r.p.sessionId);
 const n=r.calls.length;p.localEventCursor='event';const hint=await p.historyRead({kind:'hint'});assert.equal(hint.cursor,'event');assert.equal(r.calls.length,n);
 r.listing.results[0].sourceId='another-installation';const other=await p.historyRead({kind:'list'});assert.equal(Object.values(other.localMatches)[0],null);
});
