'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const R=require('../paddock-history-read-v1'),H=require('../paddock-history'),UI=require('../renderer/paddockhistory');
const read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/paddock-rich-history',name+'.json')));
const options=(h,kind='head')=>({kind,protocol:'shared',sourceId:h.sourceId,sessionId:h.sessionId,token:h.resultToken});
test('qualified rich heads, laps and offline revalidation preserve original data and independent eligibility',()=>{
 const h=read('head'),before=structuredClone(h),n=R.validate(h,options(h),h.databaseId);assert.deepEqual(h,before);assert.deepEqual(n.body,h.body);assert.deepEqual(R.validate(n,options(h),h.databaseId),n);
 const laps=read('laps');assert.deepEqual(R.validate(laps,{...options(h,'laps'),participantId:laps.participantId},h.databaseId).laps,laps.laps);
 const html=UI.headHtml(n);assert(html.includes('Class'));assert(html.includes('GT3'));assert(html.includes('Prototype'));assert(html.includes('Scoring evidence'));assert(!html.includes('NaN'));
 const lapHtml=UI.lapsHtml(laps,n);assert(lapHtml.includes('Personal best:'));assert(lapHtml.includes('Track record:'));assert.equal(H.matches({...h,format:'history-v1',revision:1,state:'active'},[],h.databaseId),null);
});
test('historical unknowns remain unknown, not epoch dates, invalid laps or zero times',()=>{
 const h=read('head');h.body.provenance.kind='historical';h.body.race.startedAt=null;h.body.race.endedAt=null;h.body.context.savedAt=null;h.body.race.track.id=null;h.body.context.classification=[];
 const n=R.validate(h,options(h),h.databaseId),html=UI.headHtml(n);assert(html.includes('Race date unknown'));assert(!html.includes('1970'));assert(html.includes('No verified classification'));
 const l=read('laps');Object.assign(l.laps[0],{stintId:null,heatId:null,driverId:null,lane:null,durationMs:null,endedAtMs:null,valid:null,pit:null,personalRecordEligible:null,trackRecordEligible:null,distanceM:null});
 R.validate(l,{...options(h,'laps'),participantId:l.participantId},h.databaseId);const text=UI.lapsHtml(l,n);assert(text.includes('Valid: Unknown'));assert(text.includes('Unknown driver'));assert(text.includes('Track record: Unknown'));
});

test('historical saved date is displayed with its meaning rather than an invented start time',()=>{
 const h=read('head');h.body.provenance.kind='historical';h.body.race.startedAt=null;h.body.race.endedAt=null;h.body.context.savedAt='2026-10-25T12:34:56.789Z';
 const html=UI.headHtml(R.validate(h,options(h),h.databaseId));assert(html.includes('Saved '));assert(html.includes('(start time not recorded)'));assert(!html.includes('Race date unknown'));
});
test('all-unknown historical distance is not presented as zero metres driven',()=>{
 const s=read('statistics');Object.assign(s,{measuredLaps:3,distanceM:0,unknownDistanceLaps:3,distanceComplete:false});
 assert(UI.statisticsHtml(s,'Car').includes('Physical distance: Unknown'));assert(!UI.statisticsHtml(s,'Car').includes('Physical distance: 0 m'));
 Object.assign(s,{distanceM:25,unknownDistanceLaps:2});assert(UI.statisticsHtml(s,'Car').includes('Physical distance: 25 m'));assert(UI.statisticsHtml(s,'Car').includes('incomplete: 2 laps'));
});
test('rich reads reject broken awards, eligibility, pagination and references before replacing cache',()=>{
 const h=read('head'),o=options(h);for(const mutate of [h=>h.body.context.classification.push(h.body.context.classification[0]),h=>h.body.context.classification[0].participantId='missing',h=>h.body.context.classification[0].classId='gt3',h=>h.body.context.classification[0].countedHeatIds=['missing'],h=>h.body.race.participants[0].kind='virtual',h=>h.lapCounts.pop(),h=>h.body.race.participants[0].configuration.databaseId='other',h=>h.body.context.scoringSnapshot={}]){const v=structuredClone(h);mutate(v);assert.throws(()=>R.validate(v,o,h.databaseId),{code:'HISTORY_INVALID'});}
 const l=read('laps');for(const mutate of [p=>p.laps[0].valid=null,p=>p.laps[0].pit=true,p=>p.offset=1,p=>p.nextOffset=99,p=>p.laps[0].number=0,p=>p.laps[0].durationMs='10',p=>p.laps[0].flags=['invalid']]){const v=structuredClone(l);mutate(v);assert.throws(()=>R.validate(v,{...o,kind:'laps',participantId:l.participantId},h.databaseId),{code:'HISTORY_INVALID'});}
});
test('rich presentation escapes names, separates awards and labels aggregate statistics',()=>{
 const h=read('head');h.body.race.participants[0].displayName='<img onerror=bad>';h.body.context.classification[0].effects=[{kind:'time',amount:1000,reason:'<script>'}];
 const html=UI.headHtml(R.validate(h,options(h),h.databaseId));assert(!html.includes('<script>'));assert(html.includes('&lt;script&gt;'));assert(html.includes('&lt;img'));assert(html.includes('1.000 s'));
 const stats=UI.statisticsHtml(read('statistics'),'Example');assert(stats.includes('Class wins:'));assert(stats.includes('Track-record eligible best:'));assert(stats.includes('Accepted evidence is counted once'));
});
const source=process.env.SLOTFORGE_PADDOCK_SOURCE||path.resolve(__dirname,'../../../SlotForge Slotcar Database'),hasHost=fs.existsSync(path.join(source,'src/rich-history.cjs'));
test('representative scoring fixtures are reproducible, preserve captured evidence, and respect host release gates',{skip:!hasHost},t=>{
 const {Store}=require(path.join(source,'src/store.cjs')),remote=require(path.join(source,'src/rich-history.cjs')),shared=require(path.join(source,'src/shared-history.cjs')),reader=require(path.join(source,'src/shared-history-read.cjs'));
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'timing-scoring-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 for(const fixture of require('../tools/qa/rich-scoring-fixtures.cjs').cases()){
  assert.deepEqual(read('scoring-'+fixture.name),fixture);const file=path.join(root,fixture.name+'.sqlite');new Store(file,{deferred:true}).replace(require(path.join(source,'tests/support/timing-fixtures.cjs')).fixtures().store.snapshot());const store=new Store(file,{deferred:true});
  const op=structuredClone(fixture.operation);op.recoveryId=shared.status(store).recoveryId;remote.validateBundle(op.bundle);const accepted=remote.receiveQualified(store,op);
  const h=reader.read(store,'http://localhost/v1/shared-history/sessions/'+op.sourceId+'/'+op.sessionId);const n=R.validate(h,options(h),h.databaseId);assert.deepEqual(n.body.context,op.bundle.context);
  for(const p of op.bundle.race.participants){assert.deepEqual(p.configuration,read('create').bundle.race.participants.find(x=>x.id===p.id).configuration);const page=reader.read(store,'http://localhost/v1/shared-history/sessions/'+op.sourceId+'/'+op.sessionId+'/laps/'+p.id+'?token='+h.resultToken);assert.deepEqual(R.validate(page,{...options(h,'laps'),participantId:p.id},h.databaseId).laps,p.laps);}
  const stats=reader.read(store,'http://localhost/v1/shared-history/cars/car-a/statistics');R.validate(stats,{kind:'statistics',carId:'car-a'},h.databaseId);for(const [k,v] of Object.entries(fixture.expected))assert.equal(stats[k],v,fixture.name+': '+k);
  assert.equal(op.bundle.context.scoringSnapshot,null);assert.equal(accepted.accepted.revision,1);
  if(require(path.join(source,'src/rich-history-gate.cjs')).enabled()&&op.bundle.provenance.kind==='measured')assert.equal(shared.receive(store,op).duplicate,true);else assert.throws(()=>shared.receive(store,op));
  assert.equal(shared.capability.features.historicalImports,require(path.join(source,'src/historical-approval-gate.cjs')).enabled());
 }
});
for(const kind of ['json','sqlite'])test(kind+': real qualified rich history reads, background sync, reopen, correction and withdrawal remain isolated',{skip:!hasHost,timeout:60000},async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'timing-rich-read-')),{Store}=require(path.join(source,'src/store.cjs')),file=path.join(root,'host.sqlite');
 const seed=new Store(file,{deferred:true});seed.replace(require(path.join(source,'tests/support/timing-fixtures.cjs')).fixtures().store.snapshot());const host=new Store(file,{deferred:true}),remote=require(path.join(source,'src/rich-history.cjs')),shared=require(path.join(source,'src/shared-history.cjs')),reader=require(path.join(source,'src/shared-history-read.cjs'));
 const op=read('create');op.recoveryId=shared.status(host).recoveryId;const first=remote.receiveQualified(host,op);assert.equal(shared.capability.features.historicalImports,require(path.join(source,'src/historical-approval-gate.cjs')).enabled());assert.equal(shared.capability.formats.includes('history-v1'),require(path.join(source,'src/rich-history-gate.cjs')).enabled());
 const Database=require('../db'),Client=require('../sqlite-client'),Repo=require('../sqlite-repository'),Storage=require('../paddock-storage'),db=new Database(path.join(root,'original.json'));db.saveNow();const original=fs.readFileSync(db.file);let worker,p;
 if(kind==='sqlite'){require('../sqlite-migration').migrateCopy({source:db.file,destination:path.join(root,'copy')});require('../sqlite-working').forkCopy(path.join(root,'copy'),path.join(root,'work'));worker=new Client();await worker.openWorking(path.join(root,'work'));}
 p=new(require('../paddock').Paddock)(worker?null:db,worker?{storage:new Storage.SqlitePaddockStorage(new Repo(worker)),deliveryStore:worker}:{});
 t.after(async()=>{p.stop();await p.idle();await worker?.close();await db.writesIdle();if(kind==='sqlite')assert.deepEqual(fs.readFileSync(db.file),original);fs.rmSync(root,{recursive:true,force:true});});
 await p.storage.setConnection({mode:'local',localKey:'b'.repeat(64)+'.json',address:'http://127.0.0.1:5001',databaseId:op.databaseId,name:'Fixture',results:true,timing:true,historyGuard:{version:1,databaseId:op.databaseId,reads:true,statistics:true,recoveryId:op.recoveryId}},(await p.connection()).revision);p.code='fixture';p.scalable={};const calls=[];let cursor='c1';
 p.call=async route=>{calls.push(route);if(route==='/v1/status')return {id:op.databaseId,permissions:{timingResults:true},capabilities:{scalable:{version:1}}};if(route==='/v1/scalable/status')return {version:1,databaseId:op.databaseId,cursor};if(route.startsWith('/v1/scalable/changes'))return {version:1,databaseId:op.databaseId,kind:'results',cursor,more:false,resetRequired:false,entries:[{sourceId:op.sourceId,sessionId:op.sessionId,operation:'invalidate'}]};assert(route.startsWith('/v1/shared-history/'),'rich reads must not use legacy summary route');return reader.read(host,'http://localhost'+route);};
 const list=await p.historyRead({kind:'list'});assert.equal(list.value.results[0].format,'history-v1');let token=list.value.results[0].resultToken;
 const opts=()=>({kind:'head',sourceId:op.sourceId,sessionId:op.sessionId,token});let h=await p.historyRead(opts());assert.equal(h.value.body.format,'history-v1');
 const settle=async()=>{for(let i=0;i<8;i++){await p.exclusive(()=>p.syncHistory());assert.equal(p.historySyncError,'');if(!(await p.historySyncState()).work)return;}assert.fail('sync not settled');};await settle();
 if(worker){await worker.close();worker=new Client();await worker.openWorking(path.join(root,'work'));p.storage=new Storage.SqlitePaddockStorage(new Repo(worker));}else{await db.writesIdle();p.storage=new Storage.JsonPaddockStorage(new Database(db.file));}
 p.code='';h=await p.historyRead(opts());assert(h.offline);assert.deepEqual(h.value.body.race,op.bundle.race.participants.length?{...op.bundle.race,participants:op.bundle.race.participants.map(({laps,...p})=>p)}:{});
 const lp=await p.historyRead({...opts(),kind:'laps',participantId:op.bundle.race.participants[0].id});assert(lp.offline);assert.equal(lp.value.format,'history-v1');p.code='fixture';
 const edit=read('correction');edit.recoveryId=op.recoveryId;edit.expected=first.accepted;const next=remote.receiveQualified(host,edit);cursor='c2';await settle();token=reader.read(host,'http://localhost/v1/shared-history/sessions/'+op.sourceId+'/'+op.sessionId).resultToken;assert.equal((await p.historyRead(opts())).value.accepted.revision,next.accepted.revision);
 const withdrawal=read('withdrawal');withdrawal.recoveryId=op.recoveryId;withdrawal.expected=next.accepted;remote.receiveQualified(host,withdrawal);cursor='c3';await settle();token=reader.read(host,'http://localhost/v1/shared-history/sessions/'+op.sourceId+'/'+op.sessionId).resultToken;assert.equal((await p.historyRead(opts())).value.payload.state,'withdrawn');
 assert.equal(db.data.sessions.length,0);assert.equal(db.data.laps.length,0);
});
