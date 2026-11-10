'use strict';
// Reproducible saved Timing evidence, built with the actual race engine/journal.
const fs=require('node:fs'),path=require('node:path');
const Engine=require('../../renderer/engine'),Journal=require('../../renderer/paddockrace');
const fixture=()=>JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../tests/fixtures/paddock-rich-history/create.json')));
function evidence(type='race'){
 const configuration=fixture().bundle.race.participants[0].configuration;
 const j={captures:{local:{name:'Captured car',configuration}},lanes:[20],heats:[]};let wall=100000;
 const e=Journal.attach(Engine.createRace({type:'race',laps:50,minLap:100,entries:[{carId:'local',driverId:'driver',driverName:'Driver',lane:0}]}),j,'1',()=>wall,t=>100000+t);
 e.start(0);wall=110000;e.cross(0,10000);wall=121000;e.cross(0,21000);e.stop(21000);e.paddockReview();
 j.classifiedTimes={local:e.spentOf(e.cars[0],e.endAt,true)};
 const session={id:'real-session',setupName:'Saved '+type,sessionType:type,trackId:'track',trackName:'Club',date:'2026-11-09T10:00:00.000Z',paddockJournal:j,standings:[{carId:'local',driverId:'driver',driverName:'Driver',pos:1,laps:2,total:21000,best:10000}]};
 const laps=j.heats[0].entries[0].laps.map((l,i)=>({id:'saved-'+i,sessionId:session.id,carId:'local',driverId:'driver',driverName:'Driver',lane:1,lapNumber:l.number,time:l.time,valid:true,pit:false}));
 return {session,laps};
}
function heatEvidence(){
 const e=evidence();e.session.sessionType='heats';e.session.resultBy='points';
 const second=structuredClone(e.session.paddockJournal.heats[0]);second.id='2';second.startedAt+=40000;second.endedAt+=40000;second.entries[0].laps.forEach(l=>l.at+=40000);e.session.paddockJournal.heats.push(second);
 const third=structuredClone(second);third.id='3';third.startedAt+=40000;third.endedAt+=40000;third.entries[0].laps.forEach(l=>l.at+=40000);e.session.paddockJournal.heats.push(third);
 const base=e.laps;e.laps=[1,2,3].flatMap(heat=>base.map(l=>({...l,id:l.id+'-'+heat,heat})));
 Object.assign(e.session.standings[0],{participant:0,laps:6,points:30,score:20,counted:1,dropped:[1],heats:2,finalName:'A'});
 e.session.heatResults=[1,2,3].map(heat=>({heat,...(heat===3?{final:'A'}:{}),rows:[{participant:0,pos:1,laps:2,points:10,total:21000,spentPen:21000}]}));
 e.session.paddockJournal.classifiedTimes.local=63000;return e;
}

function cases(){
 const list=[];
 const add=(name,e,edit=()=>{})=>{edit(e);list.push({name,evidence:e,historical:name==='historical-unknowns'});};
 add('race',evidence());add('qualifying',evidence('qualifying'));
 add('endurance',evidence('endurance'),e=>{const entry=e.session.paddockJournal.heats[0].entries[0];entry.changes=[{at:110500,driverId:'relief',driverName:'Relief'}];entry.laps[1].driverId='relief';e.laps[1].driverId='relief';Object.assign(e.session.standings[0],{asTeam:true,teamId:'team-a',teamName:'Endurance team'});});
 add('classes',evidence(),e=>{e.session.classStandings=[{...e.session.standings[0],classPos:1,raceClass:'gt3',className:'GT3',classPoints:20}];});
 add('heats-finals',heatEvidence());
 add('penalties',evidence(),e=>{Object.assign(e.session.standings[0],{pos:2,laps:1,adjMs:2000,adjLaps:-1,points:7,adjPoints:-3});e.session.paddockJournal.classifiedTimes.local=23000;e.laps[0].noTrackRecord=true;e.laps[1].noPersonalBest=true;});
 add('historical-unknowns',evidence(),e=>{delete e.session.paddockJournal;e.session.date='unknown';delete e.session.standings;});
 return list;
}
function generated(){return cases().map(f=>({...f,bundle:f.historical?require('../../paddock-historical-evidence').bundle(f.evidence,'paddock-demo'):require('../../paddock-rich-mapper').measured(f.evidence.session,f.evidence.laps,'paddock-demo').bundle}));}
if(require.main===module){const root=path.resolve(__dirname,'../../tests/fixtures/paddock-rich-mapper');fs.mkdirSync(root,{recursive:true});for(const f of generated())fs.writeFileSync(path.join(root,f.name+'.json'),JSON.stringify(f,null,2)+'\n');}
module.exports={evidence,heatEvidence,cases,generated};
