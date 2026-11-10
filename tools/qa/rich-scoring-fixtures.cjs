'use strict';
// Synthetic qualification evidence only; not imported by the application.
// The compact Timing examples mirror the fields saved by renderer/race.js.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../tests/fixtures/paddock-rich-history');
const base=()=>JSON.parse(fs.readFileSync(path.join(root,'create.json')));
function cases(){
 const fixtures=[];
 const add=(name,edit,timingEvidence,expected={overallWins:1,classWins:0})=>{
  const operation=base();operation.operationId='fixture-'+name;operation.sessionId='fixture-'+name;operation.bundle.race.name='Qualification · '+name;
  operation.bundle.context.classification=operation.bundle.context.classification.filter(a=>a.scope==='overall');operation.bundle.context.classes=[];
  edit(operation.bundle);fixtures.push({name,qualificationOnly:true,timingEvidence,operation,expected});
 };
 add('race',()=>{}, {sessionType:'race',standings:[{carId:'car-a',pos:1,laps:4,total:41000}]});
 add('qualifying',b=>{b.race.type='qualifying';b.context.classification.forEach(a=>{a.points=null;a.score=10000;a.scoreUnit='ms';});}, {sessionType:'qualifying',standings:[{carId:'car-a',pos:1,best:10000,laps:4,total:41000}]},{overallWins:0,classWins:0});
 add('endurance',b=>{
  b.race.type='endurance';b.context.teams=[{id:'team-a',name:'Endurance team'}];const p=b.race.participants[0];p.teamId='team-a';p.drivers.push({id:'driver-2',name:'Second driver'});p.stints[1].driverId='driver-2';for(const l of p.laps)if(l.heatId==='heat-2')l.driverId='driver-2';
 },{sessionType:'endurance',standings:[{carId:'car-a',asTeam:true,teamId:'team-a',pos:1,drivers:[{driverId:'driver-1',laps:3},{driverId:'driver-2',laps:1}]}]});
 add('classes',b=>{b.context.classes=base().bundle.context.classes;b.context.classification=base().bundle.context.classification;}, {standings:[{carId:'car-a',pos:1,raceClass:'gt3'}],classStandings:[{carId:'car-a',classPos:1,raceClass:'gt3',classPoints:20}]},{overallWins:1,classWins:1});
 add('heats-finals',b=>{
  const overall=b.context.classification[0];b.context.classification=[
   {...structuredClone(overall),scope:'heat',scopeId:'heat-1',points:10,countedHeatIds:['heat-1']},
   {...structuredClone(overall),scope:'final',scopeId:'final-a',points:25,countedHeatIds:['heat-2'],droppedHeatIds:['heat-1'],score:25,scoreUnit:'points'},
   {...structuredClone(overall),scope:'championship-award',scopeId:'champ-round-1',points:30,countedHeatIds:[],score:null,scoreUnit:null}
  ];
 },{resultBy:'points',standings:[{carId:'car-a',finalName:'A Final',finalPos:1,finalPoints:25,score:25,counted:[2],dropped:[1]}],champ:{id:'champ-round-1'}},{overallWins:0,classWins:0});
 add('penalties',b=>{
  const a=b.context.classification[0];a.position=2;a.laps=3;a.elapsedMs=43000;a.points=7;a.effects=[{kind:'laps',amount:-1,reason:'Reviewed lap adjustment'},{kind:'time',amount:2000,reason:'Two-second penalty'},{kind:'points',amount:-3,reason:'Championship points adjustment'}];b.context.classification[1].position=1;
 },{standings:[{carId:'car-a',pos:2,laps:3,total:41000,adjLaps:-1,adjMs:2000,adjPoints:-3,points:7}],paddockJournal:{classifiedTimes:{'car-a':43000}}},{overallWins:0,classWins:0,distanceM:80,measuredTimeMs:31000});
 add('historical-unknowns',b=>{
  b.provenance={kind:'historical',evidence:'Synthetic older saved Timing laps; dates, boundaries and scoring were not recorded.',missing:['race-date','crossing-times','driver-boundaries','lane-lengths','classification','record-eligibility']};b.race.startedAt=null;b.race.endedAt=null;b.context.savedAt=null;b.context.classification=[];
  for(const h of b.race.heats)h.startedAtMs=h.endedAtMs=null;
  for(const l of b.race.track.lanes)l.lengthM=null;
  for(const p of b.race.participants){p.stints=[];for(const l of p.laps){l.stintId=null;l.endedAtMs=null;l.driverId=null;l.lane=null;l.distanceM=null;l.personalRecordEligible=null;l.trackRecordEligible=null;}}
 },{sessionType:'race',date:'unknown',standings:[],laps:[{carId:'car-a',lapNumber:1,time:10000}]},{overallWins:0,classWins:0,historicalSessions:1,distanceM:0,unknownDistanceLaps:4,personalRecordLaps:0,trackRecordLaps:0});
 return fixtures;
}
if(require.main===module)for(const fixture of cases())fs.writeFileSync(path.join(root,'scoring-'+fixture.name+'.json'),JSON.stringify(fixture,null,2)+'\n');
module.exports={cases};
