'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const Records=require('../paddockrecords'),Engine=require('../renderer/engine'),Journal=require('../renderer/paddockrace'),Database=require('../db');
const profile=()=>JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/paddock/fixtures/profile-car-a.json')));
function session(){const p=profile();return {id:'reviewed',setupName:'Reviewed race',sessionType:'race',trackId:'track',trackName:'Club',endedBy:'Stopped',weatherNote:'Dry, then light rain.',standings:[{carId:'local',pos:1,laps:2,total:21000}],paddockJournal:{captures:{local:{name:p.car.name,configuration:p.configuration}},lanes:[20],heats:[{id:'1',name:'Heat 1',startedAt:100000,endedAt:130000,entries:[{carId:'local',lane:1,driverId:'driver',driverName:'Driver',laps:[{number:1,time:10000,at:110000,driverId:'driver',valid:true,pit:false},{number:2,time:11000,at:121000,driverId:'driver',valid:true,pit:false}]}]}]}};}
const build=s=>Records.build({paddock:{sourceId:'source'}},s,[]);
test('reviewed details explain final classification without changing laps, configuration or mileage',()=>{
 const s=session(),base=build(s);Object.assign(s.standings[0],{adjMs:-500,penalty:3000,pluginTimeMs:1000,adjLaps:1,laps:3,points:9,adjPoints:-1});const p=build(s);
 assert.deepEqual(p.adjustments.map(a=>[a.kind,a.amount]),[['time',-500],['time',2000],['time',1000],['laps',1],['points',-1]]);
 assert(p.adjustments.every(a=>a.participantId===p.participants[0].id&&a.reason));assert.equal(p.standings[0].classifiedElapsedMs,23500);assert.equal(p.standings[0].classifiedLaps,3);assert.equal(p.standings[0].points,9);assert.deepEqual(p.participants,base.participants);assert.match(p.notes,/Session ended: Stopped/);assert.match(p.notes,/Weather: Dry, then light rain/);
 s.paddockJournal.classifiedTimes={local:25000};assert.equal(build(s).standings[0].classifiedElapsedMs,25000,'Authoritative elapsed time is not adjusted twice');
});
test('engine review takes net penalties and adjustments after undo/reset; repeated review is idempotent',()=>{
 const s=session(),j={...s.paddockJournal,heats:[]};let wall=100000;
 const e=Journal.attach(Engine.createRace({type:'race',laps:50,minLap:100,penalty:{on:true,every:1,seconds:2},entries:[{carId:'local',driverId:'driver',driverName:'Driver',lane:0}]}),j,'1',()=>wall,t=>100000+t);
 e.start(0);wall=110000;e.cross(0,10000);wall=121000;e.cross(0,21000);e.addPoints(0,2,21000);e.stop(21000);e.adjust(0,{ms:1000,laps:2});e.adjustReset(0);e.nullify(0);e.paddockReview();
 s.paddockJournal=j;let p=build(s);assert.deepEqual(p.adjustments,[]);assert.match(p.notes,/Stopped/);
 e.restorePoints(0);e.adjust(0,{ms:-500,laps:1});e.paddockReview();Object.assign(s.standings[0],{laps:e.lapsOf(e.cars[0]),adjLaps:e.cars[0].adjLaps,adjMs:e.cars[0].adjMs});j.classifiedTimes={local:e.spentOf(e.cars[0],e.endAt,true)};
 p=build(s);assert.deepEqual(p.adjustments.map(a=>[a.kind,a.amount]),[['time',-500],['time',4000],['laps',1]]);const pinned=structuredClone(p);e.paddockReview();assert.deepEqual(build(s),pinned);assert.equal(p.participants[0].laps.length,2);assert.equal(p.standings[0].classifiedElapsedMs,24500);
});
test('rotated heats use each physical car once, report net time across heats and include per-heat context',()=>{
 const s=session(),h=structuredClone(s.paddockJournal.heats[0]);s.sessionType='heats';s.endedBy='';s.weatherNote='';s.scoring={countBy:'best'};
 s.paddockJournal.heats[0].endedBy='Time up';s.paddockJournal.heats[0].weatherNote='Dry';s.paddockJournal.heats[0].entries[0].resultEffects={reviewMs:500,penaltyMs:1000,pluginMs:200};
 Object.assign(h,{id:'2',name:'Heat 2',startedAt:140000,endedAt:170000,endedBy:'Stopped',weatherNote:'Wet'});h.entries[0].laps.forEach(l=>l.at+=40000);h.entries[0].resultEffects={reviewMs:-200,penaltyMs:0,pluginMs:300};s.paddockJournal.heats.push(h);s.paddockJournal.classifiedTimes={local:43800};Object.assign(s.standings[0],{laps:4,total:null,adjMs:300,points:16,adjPoints:1});
 const p=build(s);assert.equal(p.participants.length,1);assert.equal(p.participants[0].laps.length,4);assert.deepEqual(p.adjustments.map(a=>[a.kind,a.amount]),[['time',300],['time',1000],['time',500],['points',1]]);assert.equal(p.standings[0].classifiedElapsedMs,43800);assert.match(p.notes,/Heat 1: weather Dry/);assert.match(p.notes,/Heat 2: ended Stopped/);assert.match(p.notes,/not a reconstruction/);
});
test('older journals use saved final fields without inventing penalties or exporting unrelated awards',()=>{
 const s=session();Object.assign(s.standings[0],{adjMs:-100,adjLaps:-1,penaltyPoints:5,adjPoints:2,swapLost:1});const p=build(s);
 assert.deepEqual(p.adjustments.map(a=>[a.kind,a.amount]),[['time',-100],['laps',-1],['laps',-1]]);assert.equal(p.standings[0].points,0);
 s.heatResults=[{heat:1,weatherNote:'Legacy weather summary'}];delete s.weatherNote;assert.match(build(s).notes,/Legacy weather summary/);
});
test('bounded context is explicit about omitted text and never includes private journal data',()=>{
 const s=session();s.multiclass={classes:[]};s.weatherNote='Weather '.repeat(1000);s.paddockJournal.secret='PRIVATE';s.privateNotes='PRIVATE';const p=build(s);assert(p.notes.length<=4000);assert.match(p.notes,/Further session context omitted/);assert.match(p.notes,/Class standings/);assert(!JSON.stringify(p).includes('PRIVATE'));
 s.standings[0].adjMs=Infinity;Records.prepare({paddock:{sourceId:'source'}},s,[]);assert.equal(s.paddockDelivery.status,'attention');assert.match(s.paddockDelivery.error,/adjustment/);
});
test('JSON finalization, correction and reopen retain reviewed details in the same durable delivery',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'paddock-context-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'database.json'),db=new Database(file),s=session();s.standings[0].adjMs=1000;
 const id=await db.saveSessionAsync(s,[{carId:'local',lane:1,lapNumber:1,time:10000}]);let saved=db.data.sessions.find(s=>s.id===id);const payload=structuredClone(saved.paddockDelivery.payload);assert.equal(payload.adjustments[0].amount,1000);
 db.update('laps',db.data.laps[0].id,{noTrackRecord:true});await db.commit();await db.saved();saved=new Database(file).data.sessions.find(s=>s.id===id);assert.equal(saved.paddockDelivery.payload.revision,2);assert.deepEqual(saved.paddockDelivery.payload.adjustments,payload.adjustments);assert.equal(saved.paddockDelivery.payload.participants[0].laps[0].recordEligible,false);assert.equal(saved.paddockDelivery.payload.notes,payload.notes);
});
test('SQLite finalization and correction preserve context, captures and original JSON',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'paddock-context-sqlite-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'database.json'),db=new Database(file);db.saveNow();const original=fs.readFileSync(file);const {migrateCopy}=require('../sqlite-migration'),{forkCopy,WorkingStore}=require('../sqlite-working');migrateCopy({source:file,destination:path.join(dir,'copy')});forkCopy(path.join(dir,'copy'),path.join(dir,'work'));let store=new WorkingStore(path.join(dir,'work'));
 try{const s=session();s.standings[0].adjMs=1000;const result=store.command({id:'context-save',type:'finalizeSession',session:s,laps:[{carId:'local',lane:1,lapNumber:1,time:10000}]});const saved=store.get('sessions',result.sessionId,true).value;assert.equal(saved.paddockDelivery.payload.adjustments[0].amount,1000);const lap=store.statement("SELECT id FROM records WHERE entity='laps'").get();store.command({id:'context-edit',type:'setRecordEligibility',sessionId:result.sessionId,expectedRevision:store.revision('sessions',result.sessionId),edits:[{lapId:lap.id,flags:{noTrackRecord:true}}]});store.close();store=new WorkingStore(path.join(dir,'work'));const updated=store.get('sessions',result.sessionId,true).value;assert.equal(updated.paddockDelivery.payload.revision,2);assert.deepEqual(updated.paddockDelivery.payload.adjustments,saved.paddockDelivery.payload.adjustments);assert.deepEqual(fs.readFileSync(file),original);
 }finally{store.close();}
});
test('current Paddock validates and receives detailed results without counting adjustments as measured mileage',{skip:!process.env.PADDOCK_SOURCE},()=>{
 const root=process.env.PADDOCK_SOURCE,T=require(path.join(root,'src/timing-integration.cjs')),f=require(path.join(root,'tests/support/timing-fixtures.cjs')).fixtures();const s=session();s.paddockJournal.captures.local.configuration=f.profiles[0].configuration;Object.assign(s.standings[0],{adjLaps:2,laps:4,adjMs:1000,penalty:2000,points:8,adjPoints:-2});const p=build(s),receipt=T.receive(f.store,p);
 assert.equal(receipt.ok,true);assert.equal(receipt.summaries[0].statistics.distanceM,40);assert.equal(receipt.summaries[0].statistics.measuredTimeMs,21000);assert.equal(f.store.data.timing.sessions[0].payload.standings[0].classifiedElapsedMs,24000);assert.deepEqual(f.store.data.timing.sessions[0].payload.adjustments,p.adjustments);assert.equal(T.receive(f.store,p).duplicate,true);
});
