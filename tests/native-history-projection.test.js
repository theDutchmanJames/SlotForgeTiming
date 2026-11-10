'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../integration/timing-legacy/project.cjs'),E=require('../paddock-historical-evidence');
const saved='2026-10-25T12:34:56.789Z';
// Production lapRows omits valid:true and pit:false, as do old JSON/SQLite saves.
function fixture(){return {session:{id:'native-race',sessionType:'qualifying',date:saved,setupName:'Qualifying',trackId:'track',trackName:'Club',standings:[{carId:'car',driverId:'driver',driverName:'James',laps:3,best:6795,pos:1}]},laps:[7021,6795,30302].map((time,i)=>({id:'lap-'+i,sessionId:'native-race',carId:'car',driverId:'driver',trackId:'track',lane:2,lapNumber:i+1,time,date:saved,...(i===2?{tooSlow:true,noTrackRecord:true,noPersonalBest:true}:{})}))};}
const project=e=>P.session(e.session,e.laps,{databaseId:'library',carIds:{car:'canonical-car'}});
test('native saved rows retain known lane, saved date and eligible laps without inventing clocks or distance',()=>{
 const e=fixture(),before=structuredClone(e),p=project(e),b=p.bundle,ls=b.race.participants[0].laps;
 assert.equal(p.projectionStatus,'projected');assert.deepEqual(e,before);assert.deepEqual(p.rawOriginal,e);
 assert.equal(b.context.savedAt,saved);assert.equal(b.race.startedAt,null);assert.equal(b.race.endedAt,null);
 assert.deepEqual(ls.map(l=>[l.lane,l.valid,l.pit,l.personalRecordEligible,l.trackRecordEligible]),[[2,true,false,true,true],[2,true,false,true,true],[2,false,false,false,false]]);
 assert(ls.every(l=>l.endedAtMs===null&&l.distanceM===null));assert.equal(b.race.track.lanes[0].lengthM,null);
 assert(b.provenance.missing.includes('lane-lengths'));assert(!b.provenance.missing.includes('record-eligibility'));
 assert(!/pending|not accepted/i.test(b.context.notes));assert.equal(b.provenance.kind,'historical');
 const review=E.bundle(e,'library',{car:'canonical-car'});assert.equal(review.race.participants[0].laps[0].valid,null);assert.equal(review.race.participants[0].laps[0].pit,null);assert(review.race.participants[0].laps.every(l=>l.trackRecordEligible===false));
});
test('native exclusions, independent record controls, explicit unknowns and virtual laps remain excluded',()=>{
 const e=fixture(),base=e.laps[0];
 const variants=[{}, {noTrackRecord:true},{noPersonalBest:true},{invalid:true},{tooSlow:true},{redFlag:true},{late:true},{pit:true},{valid:false},{valid:null},{pit:null},{virtualRival:true},{time:0},{invalid:1}];
 e.laps=variants.map((v,i)=>({...base,id:'case-'+i,lapNumber:i+1,...v}));
 const b=project(e).bundle,ls=b.race.participants.flatMap(p=>p.laps),byId=new Map(ls.map(l=>[l.originLapId,l]));
 assert.deepEqual(variants.map((_,i)=>{const l=byId.get('case-'+i);return [l.personalRecordEligible,l.trackRecordEligible];}),[[true,true],[true,false],[false,true],...Array.from({length:11},()=>[false,false])]);
 assert.equal(byId.get('case-11').countsForDistance,false);assert.equal(byId.get('case-9').valid,null);assert.equal(byId.get('case-10').pit,null);
 assert(b.provenance.missing.includes('record-eligibility'));
});
test('only captured lane lengths supply distance; current track metadata is never a historical snapshot',()=>{
 const e=fixture();e.session.track={length:999,lanes:[999,999]};assert(project(e).bundle.race.participants[0].laps.every(l=>l.distanceM===null));
 e.session.paddockJournal={lanes:[20,22.5]};const b=project(e).bundle;assert(b.race.participants[0].laps.every(l=>l.distanceM===22.5));assert.equal(b.race.track.lanes[0].lengthM,22.5);
});
test('saved dates support actual ISO and epoch milliseconds without substituting race start or parsing ambiguous dates',()=>{
 for(const [value,expected]of [[saved,saved],[Date.parse(saved),saved],[0,'1970-01-01T00:00:00.000Z'],[null,null],['2026-10-25',null],['25/10/2026',null],[1e100,null],[Infinity,null]]){
  const e=fixture();e.session.date=value;const b=project(e).bundle;assert.equal(b.context.savedAt,expected);assert.equal(b.race.startedAt,null);
 }
});
test('corrections of adopted native history preserve exclusion semantics and shared identity',()=>{
 const e=fixture(),old={transport:'engine',status:'adopted',baseline:{version:1,provenance:'historical',expected:{revision:1,state:'active',contentHash:'a'.repeat(64)}}};
 e.session.paddockJournal={sharedLibrary:{version:1,databaseId:'library',recoveryId:'epoch',sourceId:'source'},adoptedCarIds:{car:'canonical-car'}};
 e.laps[0].noTrackRecord=true;require('../shared-library-history').prepare(e.session,e.laps,old);
 const d=e.session.paddockDelivery;assert.equal(d.status,'pending',d.error);assert.equal(d.payload.revision,2);assert.equal(d.payload.sessionId,e.session.id);
 const [first,second]=d.payload.bundle.race.participants[0].laps;assert.equal(first.personalRecordEligible,true);assert.equal(first.trackRecordEligible,false);assert.equal(second.trackRecordEligible,true);
 assert.equal(d.guard.operations[0].action,'replace');assert.deepEqual(d.guard.operations[0].expected,old.baseline.expected);
});
test('Timing record adapter retains the saved-date basis from central history',()=>{
 const R=require('../shared-library-reads'),client={installationId:'source',localId:x=>x},r={sourceId:'source',sessionId:'session',originLapId:'lap',carId:'car',lane:2,durationMs:6795,startedAt:null,savedAt:saved};
 assert.equal(R.mappedRecord(r,client).date,saved);assert.equal(R.mappedRecord(r,client).dateBasis,'saved');
 r.startedAt='2026-10-25T12:00:00.000Z';assert.equal(R.mappedRecord(r,client).date,r.startedAt);assert.equal(R.mappedRecord(r,client).dateBasis,'started');
});
test('contradictory native session identity remains original-only evidence',()=>{
 const e=fixture();e.laps[0].sessionId='another-session';const p=project(e);
 assert.equal(p.bundle,null);assert.equal(p.projectionStatus,'raw-only');assert.match(p.projectionReason,/another session/);assert.deepEqual(p.rawOriginal,e);
});
