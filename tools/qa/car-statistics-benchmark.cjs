'use strict';
// Synthetic collection only. Benchmark the former raw-lap read against the
// maintained car summary with identical source records and calculation rules.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {migrateCopy}=require('../../sqlite-migration'),{forkCopy,WorkingStore}=require('../../sqlite-working');
const H=require('../../history-read'),C=require('../../sqlite-catalogue');
const out=path.resolve(__dirname,'../../../outputs/paddock-followup');fs.mkdirSync(out,{recursive:true});
const dir=fs.mkdtempSync(path.join(out,'car-statistics-benchmark-')),source=path.join(dir,'source.json');
const data={version:1,settings:{},drivers:[{id:'d',name:'Synthetic driver'}],slotcars:[{id:'c',model:'Synthetic car'}],tracks:[{id:'t',name:'Synthetic circuit',lanes:2,length:20}],sessions:[],laps:[]};
for(let j=0;j<100;j++){
 data.sessions.push({id:'s'+j,sessionType:'race',date:'2026-11-03',trackId:'t',standings:[{carId:'c',driverId:'d',pos:1}]});
 for(let i=0;i<200;i++)data.laps.push({id:'l'+j+'-'+i,sessionId:'s'+j,carId:'c',driverId:'d',trackId:'t',lane:1,time:5000+i,lapNumber:i+1});
}
const bytes=JSON.stringify(data);fs.writeFileSync(source,bytes);
migrateCopy({source,destination:path.join(dir,'copy')});forkCopy(path.join(dir,'copy'),path.join(dir,'work'));const s=new WorkingStore(path.join(dir,'work'));
try{
 let rows=0;
 function prior(){return s.transaction(()=>{
  const tracks=new Map(),dates=new Map(),car=H.pick(data.slotcars[0],H.CAR);
  function* laps(){for(const r of s.statement("SELECT f.json FROM lap_index l JOIN records r ON r.entity='laps' AND r.id=l.id JOIN fields f ON f.entity='laps' AND f.id=l.id AND f.path='[]' WHERE l.carId=? ORDER BY r.ordinal").iterate('c')){rows++;yield JSON.parse(r.json);}}
  return H.carDetails(car,laps(),id=>{if(!tracks.has(id))tracks.set(id,require('../../sqlite-history').selected(s,'tracks',id,H.TRACK));return tracks.get(id);},id=>{if(!dates.has(id))dates.set(id,C.read(s,'sessions',id,['date']));return dates.get(id);},s.statement('SELECT COUNT(*) n FROM history_wins WHERE carId=?').get('c').n);
 });}
 const measurements=[];for(let i=0;i<3;i++){
  rows=0;const start=performance.now(),old=prior(),oldMs=performance.now()-start,now=performance.now(),current=s.carStatistics('c'),newMs=performance.now()-now;
  // Grouping floating-point distance sums by session changes their last bits.
  // Require agreement within one micrometre; all other output stays exact.
  const compared=structuredClone(current);for(const key of ['mileage','mileageSince']){assert.ok(Math.abs(current[key].distance-old[key].distance)<1e-6);compared[key].distance=old[key].distance;}
  assert.deepEqual(compared,old);measurements.push({oldMs:+oldMs.toFixed(2),newMs:+newMs.toFixed(2),oldLapBodies:rows,newLapBodies:0});
 }
 assert.equal(fs.readFileSync(source,'utf8'),bytes);
 const report={laps:data.laps.length,sessions:data.sessions.length,measurements,originalJsonUnchanged:true};
 fs.writeFileSync(path.join(out,'car-statistics-benchmark.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{s.close();}
