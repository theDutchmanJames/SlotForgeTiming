'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const M=require('../paddock-rich-mapper'),Records=require('../paddockrecords'),E=require('../paddock-historical-evidence');
const Engine=require('../renderer/engine'),Journal=require('../renderer/paddockrace');
const fixture=()=>JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/paddock-rich-history/create.json')));
const source=process.env.SLOTFORGE_PADDOCK_SOURCE||path.resolve(__dirname,'../../../SlotForge Slotcar Database');
const {evidence,heatEvidence,cases}=require('../tools/qa/rich-mapper-fixtures.cjs');
const map=e=>M.measured(e.session,e.laps,'paddock-demo');
test('actual engine journal maps independently eligible records without mutating saved evidence',()=>{
 const e=evidence(),before=structuredClone(e);e.laps[0].noTrackRecord=true;e.laps[1].noPersonalBest=true;const frozen=structuredClone(e),b=map(e).bundle;
 assert.deepEqual(e,frozen);assert.equal(b.context.classification[0].elapsedMs,21000);assert.equal(b.context.classification[0].points,null);
 assert.equal(b.race.startedAt,'1970-01-01T00:01:40.000Z');assert.notEqual(b.race.startedAt,e.session.date);
 assert.deepEqual(b.race.participants[0].laps.map(l=>[l.personalRecordEligible,l.trackRecordEligible]),[[true,false],[false,true]]);
 assert.deepEqual(b.race.participants[0].configuration,before.session.paddockJournal.captures.local.configuration);
 assert.deepEqual(Records.richCandidate(e.session,e.laps,'paddock-demo'),map(e));
});
test('qualifying uses best lap as score; penalties never change physical laps or distance',()=>{
 const e=evidence('qualifying');Object.assign(e.session.standings[0],{adjMs:2000,adjLaps:-1,laps:1,points:8,adjPoints:-2});e.session.paddockJournal.classifiedTimes.local=23000;
 const b=map(e).bundle,a=b.context.classification[0];assert.equal(a.score,10000);assert.equal(a.scoreUnit,'ms');assert.equal(a.elapsedMs,23000);assert.equal(a.laps,1);assert.deepEqual(a.effects.map(x=>[x.kind,x.amount]),[['time',2000],['laps',-1],['points',-2]]);assert.equal(b.race.participants[0].laps.reduce((n,l)=>n+l.distanceM,0),40);
});
test('endurance preserves recorded driver swaps and team identity',()=>{
 const e=evidence('endurance'),entry=e.session.paddockJournal.heats[0].entries[0];entry.changes=[{at:110500,driverId:'relief',driverName:'Relief'}];entry.laps[1].driverId='relief';e.laps[1].driverId='relief';Object.assign(e.session.standings[0],{asTeam:true,teamId:'team-a',teamName:'Team'});
 const b=map(e).bundle,p=b.race.participants[0];assert.equal(p.teamId,'team-a');assert.equal(p.stints.length,2);assert.equal(p.laps[1].driverId,'relief');assert.deepEqual(b.context.teams,[{id:'team-a',name:'Team'}]);
});
test('class awards, unknown points and count-valued time flags retain their meaning',()=>{
 const e=evidence();e.session.classStandings=[{...e.session.standings[0],raceClass:'gt3',className:'GT3',classPos:1,points:99,incomplete:2,estimated:0,classGap:{kind:'time',value:30}}];const b=map(e).bundle,a=b.context.classification[1];
 assert.equal(a.points,null);assert.equal(a.incomplete,true);assert.equal(a.estimated,false);assert.deepEqual(a.gap,{value:30,unit:'ms'});assert.equal(a.scope,'class');assert.equal(a.scopeId,'gt3');
});
test('class-only heat points never inherit the overall laps scoring unit',()=>{
 const e=heatEvidence();e.session.resultBy='laps';e.session.multiclass={pointsMode:'class'};e.session.classStandings=[{...e.session.standings[0],raceClass:'gt3',className:'GT3',classPos:1,classPoints:20,score:20,classGap:{kind:'leader',value:0}}];
 assert.equal(map(e).bundle.context.classification.find(a=>a.scope==='class').score,null);
 e.session.classResultBy='points';const a=map(e).bundle.context.classification.find(a=>a.scope==='class');assert.equal(a.score,20);assert.equal(a.scoreUnit,'points');assert.equal(map(e).bundle.context.classification[0].scoreUnit,'laps');
});
test('numeric counted heats resolve through saved indices; finals are distinct scoped awards',()=>{
 const b=map(heatEvidence()).bundle,a=b.context.classification[0];assert.deepEqual(a.countedHeatIds,[b.race.heats[1].id]);assert.deepEqual(a.droppedHeatIds,[b.race.heats[0].id]);assert.equal(a.scoreUnit,'points');assert.deepEqual(b.context.classification.map(a=>a.scope),['overall','heat','heat','final']);assert.equal(b.context.classification[3].points,10);
});
test('older heat indices never use sorted standings order as participant identity',()=>{
 const e=heatEvidence();delete e.session.standings[0].participant;e.session.champ={id:'champ'};const r=map(e);assert.equal(r.bundle.context.classification.length,1);assert.deepEqual(r.bundle.context.classification[0].countedHeatIds,[]);assert(r.warnings.some(w=>w.includes('participant-to-car')));assert(!r.bundle.context.classification.some(a=>a.scope==='championship-award'));
});
test('stable participant and lap identities survive correction and source array reordering',()=>{
 const e=heatEvidence(),a=map(e);e.session.paddockJournal.heats.reverse();e.laps.reverse();e.session.standings[0].points=17;const b=map(e);assert.deepEqual(a.bundle.race,b.bundle.race);assert.equal(b.sourceSessionId,a.sourceSessionId);assert.equal(b.bundle.context.classification[0].points,17);
});
test('missing eligibility stays unknown; incomplete or conflicting measured evidence fails closed',()=>{
 const e=evidence();const b=M.measured(e.session,[],'paddock-demo').bundle;assert.equal(b.race.participants[0].laps[0].personalRecordEligible,null);
 for(const edit of [e=>delete e.session.paddockJournal.heats[0].entries[0].laps[0].at,e=>e.session.paddockJournal.heats[0].entries[0].laps[1].at=110001,e=>e.session.paddockJournal.captures.local.configuration.databaseId='wrong',e=>e.laps.push(e.laps[0]),e=>e.session.paddockJournal.heats[0].entries[0].changes=[{at:99999,driverId:'x'}]]){const c=evidence();edit(c);assert.throws(()=>map(c));}
});
test('historical enrichment retains saved classification without inventing race dates or eligibility',()=>{
 const e=evidence();delete e.session.paddockJournal;e.session.classStandings=[{...e.session.standings[0],classPos:1,raceClass:'gt3',className:'GT3'}];const original=structuredClone(e),b=E.bundle(E.capture(e.session,e.laps),'paddock-demo');
 assert.equal(b.provenance.kind,'historical');assert.equal(b.race.startedAt,null);assert.equal(b.context.classification.length,2);assert.equal(b.context.classification[0].elapsedMs,null);assert.equal(b.race.participants[0].carId,null);assert(b.race.participants[0].laps.every(l=>l.personalRecordEligible===false&&l.trackRecordEligible===false));assert.deepEqual(e,original);
});
test('real engine heat scoring produces compatible saved shapes',()=>{
 const h=Engine.createHeatRace({participants:[{carId:'local',driverId:'driver'}],schedule:[[{p:0,lane:0}]],resultBy:'points',points:[10],lanes:1});
 const race=Engine.createRace({type:'race',laps:2,minLap:100,entries:h.entries()});race.start(0);race.cross(0,10000);race.cross(0,21000);h.record(race);
 const r=h.overall()[0];assert.equal(typeof r.counted,'number');const e=evidence();e.session.sessionType='heats';e.session.resultBy='points';e.session.standings=[{...r,total:null}];e.session.heatResults=h.results;const b=map(e).bundle;
 assert.equal(b.context.classification[0].points,10);assert.equal(b.context.classification[1].scope,'heat');assert.deepEqual(b.context.classification[0].countedHeatIds,[b.race.heats[0].id]);
});
test('handoff fixtures are generated from saved Timing evidence, not hand-written output bundles',()=>{
 for(const f of require('../tools/qa/rich-mapper-fixtures.cjs').generated())assert.deepEqual(JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/paddock-rich-mapper',f.name+'.json'))),f);
});
test('review rejects overlapping empty stints, contradictory eligibility and duplicate classification',()=>{
 const e=evidence();e.laps.forEach(l=>l.heat=1);const h=e.session.paddockJournal.heats[0],duplicate=structuredClone(h);duplicate.id='2';duplicate.entries[0].laps=[];e.session.paddockJournal.heats.push(duplicate);assert.throws(()=>map(e),/stint/);
 const b=map(evidence()).bundle;b.race.participants[0].laps[0].pit=true;assert.throws(()=>M.validate(b),/Ineligible/);
 const c=map(evidence()).bundle;c.context.classification.push(c.context.classification[0]);assert.throws(()=>M.validate(c),/Duplicate/);
});
test('manual, foreign-session and mismatched lap evidence cannot silently become measured history',()=>{
 for(const edit of [e=>e.laps.push({...e.laps[0],id:'manual',lapNumber:3}),e=>e.laps[0].time=9000,e=>e.laps[0].sessionId='other',e=>e.laps[0].virtualRival=true]){const e=evidence();edit(e);assert.throws(()=>map(e));}
 const e=evidence();e.laps.forEach(l=>{delete l.valid;delete l.pit;});assert.equal(map(e).bundle.race.participants[0].laps[0].personalRecordEligible,true,'Actual saved lapRows omit false flags; measured validity comes from the journal');
});
test('system changes keep unknown wall times; captured heat penalties explain totals only once',()=>{
 const e=heatEvidence();e.session.systemChanges=[{system:'fuel',enabled:false,at:9876}];
 e.session.paddockJournal.heats.forEach(h=>h.entries[0].resultEffects={reviewMs:0,penaltyMs:1000,pluginMs:500});
 const b=map(e).bundle,a=b.context.classification[0];assert.deepEqual(a.effects.map(x=>[x.kind,x.amount]),[['time',3000],['time',1500]]);assert.equal(a.elapsedMs,63000);assert.equal(b.context.systemChanges[0].atMs,null);
});
for(const backend of ['json','sqlite'])test(backend+': finalisation/reopen preserves heat identity and leaves ordinary delivery timing-v1',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mapper-reopen-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const Database=require('../db'),db=new Database(path.join(root,'original.json'));db.saveNow();const original=fs.readFileSync(db.file),e=heatEvidence();let session,laps;
 if(backend==='json'){
  const id=await db.saveSessionAsync(e.session,e.laps);await db.writesIdle();const reopened=new Database(db.file);session=reopened.data.sessions.find(s=>s.id===id);laps=reopened.data.laps.filter(l=>l.sessionId===id);
 }else{
  require('../sqlite-migration').migrateCopy({source:db.file,destination:path.join(root,'copy')});const {forkCopy,WorkingStore}=require('../sqlite-working');forkCopy(path.join(root,'copy'),path.join(root,'work'));let store=new WorkingStore(path.join(root,'work'));
  try{const saved=store.command({id:'mapper-finalize',type:'finalizeSession',session:e.session,laps:e.laps});store.close();store=new WorkingStore(path.join(root,'work'));session=store.get('sessions',saved.sessionId,true).value;const ids=store.statement("SELECT id FROM records WHERE entity='laps' ORDER BY ordinal").all();laps=ids.map(r=>store.get('laps',r.id,true).value);assert.deepEqual(fs.readFileSync(db.file),original);}finally{store.close();}
 }
 assert.equal(session.standings[0].participant,0);const before=structuredClone(session.paddockDelivery);const result=Records.richCandidate(session,laps,'paddock-demo');assert.equal(result.bundle.context.classification.length,4);assert.deepEqual(session.paddockDelivery,before);assert.equal(before.payload.integrationVersion,1);assert(!before.payload.format);
});
test('Paddock qualifies production mapper outputs, corrections and statistics without changing release gates',{skip:!fs.existsSync(path.join(source,'src/rich-history.cjs'))},t=>{
 const {Store}=require(path.join(source,'src/store.cjs')),remote=require(path.join(source,'src/rich-history.cjs')),shared=require(path.join(source,'src/shared-history.cjs')),reader=require(path.join(source,'src/shared-history-read.cjs'));
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'timing-production-mapper-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 for(const {name:n,evidence:e,historical} of cases()){
  if(historical){remote.validateBundle(E.bundle(e,'paddock-demo'),{historicalIntake:true});continue;}
  const f=path.join(root,n+'.sqlite');new Store(f,{deferred:true}).replace(require(path.join(source,'tests/support/timing-fixtures.cjs')).fixtures().store.snapshot());const store=new Store(f,{deferred:true});
  const bundle=map(e).bundle,op={...fixture(),operationId:'mapper-'+n,sessionId:e.session.id,recoveryId:shared.status(store).recoveryId,bundle};remote.validateBundle(bundle);const receipt=remote.receiveQualified(store,op);assert.equal(receipt.accepted.revision,1);
  const stats=reader.read(store,'http://localhost/v1/shared-history/cars/car-a/statistics');assert.equal(stats.distanceM,n==='heats-finals'?120:40);assert.equal(stats.overallWins,['qualifying','penalties'].includes(n)?0:1);assert.equal(stats.classWins,n==='classes'?1:0);
  e.session.standings[0].dq=true;const correction={...op,operationId:'correct-'+n,action:'replace',expected:receipt.accepted,bundle:map(e).bundle};const next=remote.receiveQualified(store,correction);assert.equal(next.accepted.revision,2);assert.equal(remote.receiveQualified(store,correction).duplicate,true);assert.equal(reader.read(store,'http://localhost/v1/shared-history/cars/car-a/statistics').overallWins,0);
  assert.throws(()=>shared.receive(store,{...op,operationId:'public-'+n}));assert.equal(shared.capability.formats.includes('history-v1'),require(path.join(source,'src/rich-history-gate.cjs')).enabled());assert.equal(shared.capability.features.historicalImports,require(path.join(source,'src/historical-approval-gate.cjs')).enabled());
 }
 const old=evidence();delete old.session.paddockJournal;remote.validateBundle(E.bundle(E.capture(old.session,old.laps),'paddock-demo'),{historicalIntake:true});
});
