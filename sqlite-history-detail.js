'use strict';
// Rebuildable session projections. Authoritative laps and saved results are unchanged.
// Calculate full-race figures on writes, never by reading every lap on each page.
const H=require('./history-read'),Stats=require('./renderer/stats');
const KEYS={tracks:H.TRACK,slotcars:H.CAR,drivers:['id','name'],sessions:['id','setupName']};
const FIGURES=['count','avg','median','spread','distance','speed','scalespeed'];
const TRACK_INPUTS=H.TRACK.filter(k=>!['name','deslotTime'].includes(k));
const LAP_SQL="SELECT f.json FROM history_detail_laps h JOIN fields f ON f.entity='laps' AND f.id=h.id AND f.path='[]' WHERE h.sessionId=? AND h.token=? ORDER BY h.heat,h.lap,h.ordinal";
function ids(laps,saved){
 const result={tracks:new Set(),slotcars:new Set(),drivers:new Set(),sessions:new Set()};
 for(const l of laps){result.tracks.add(l.trackId);result.slotcars.add(l.carId);result.drivers.add(l.driverId);result.sessions.add(l.sessionId);}
 result.tracks.add(saved.trackId);for(const row of saved.standings)result.slotcars.add(row.carId);
 return Object.fromEntries(Object.entries(result).map(([entity,set])=>[entity,[...set].filter(id=>typeof id==='string'&&id)]));
}
function refs(s,id){
 const {selected}=require('./sqlite-history'),out={};
 for(const [entity,keys] of Object.entries(KEYS))out[entity]=s.statement('SELECT recordId FROM history_detail_refs WHERE sessionId=? AND entity=? ORDER BY ordinal').all(id,entity).map(r=>selected(s,entity,r.recordId,keys)).filter(Boolean);
 return out;
}
function inputs(s,saved,token){
 const {selected}=require('./sqlite-history');
 return JSON.stringify([token,saved.id,saved.trackId,selected(s,'tracks',saved.trackId,TRACK_INPUTS),saved.standings.map(row=>[row.driverId,row.asTeam,row.teamId,row.carId,selected(s,'slotcars',row.carId,['scale'])])]);
}
function sourceInputs(s,entity,id){return ['tracks','slotcars'].includes(entity)?JSON.stringify(require('./sqlite-history').selected(s,entity,id,entity==='tracks'?TRACK_INPUTS:['scale'])):null;}
function rebuildSession(s,id,force=true,preserveRefs=false){
 const row=s.statement('SELECT token FROM history_sessions WHERE id=?').get(id);
 const saved=row&&require('./sqlite-history').sessionValue(s,id),signature=row&&inputs(s,saved,row.token);
 if(row&&!force&&s.statement('SELECT inputs FROM history_details WHERE id=?').get(id)?.inputs===signature)return;
 s.statement('DELETE FROM history_details WHERE id=?').run(id);
 if(!preserveRefs)s.statement('DELETE FROM history_detail_refs WHERE sessionId=?').run(id);
 if(!row)return;
 const laps=s.statement(LAP_SQL).all(id,row.token).map(r=>JSON.parse(r.json));
 if(!preserveRefs){const references=ids(laps,saved),insert=s.statement('INSERT INTO history_detail_refs VALUES(?,?,?,?,?)');
 for(const [entity,list] of Object.entries(references))list.forEach((recordId,ordinal)=>insert.run(id,entity,recordId,ordinal,sourceInputs(s,entity,recordId)));}
 const related=refs(s,id),figures=Stats.forSession(saved,laps,related.tracks,related.slotcars).map(f=>FIGURES.map(k=>Number.isFinite(f[k])||f[k]===null?f[k]:String(f[k])));
 // Only numeric lap-derived figures are cached. Saved pit/penalty/tyre metadata
 // is composed on read, preserving undefined properties and current tyre rules.
 s.statement('INSERT INTO history_details VALUES(?,?,?,?)').run(id,laps.length,JSON.stringify(figures),signature);
}
function stamp(s){s.statement("INSERT INTO info VALUES('historyDetailSequence',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(s.statement('SELECT coalesce(max(sequence),0) n FROM changes').get().n));}
function upgrade(s){s.transaction(()=>{
 const sequence=String(s.statement('SELECT coalesce(max(sequence),0) n FROM changes').get().n);
 if(s.statement("SELECT value FROM info WHERE key='historyDetailVersion'").get()?.value==='1'&&s.statement("SELECT value FROM info WHERE key='historyDetailSequence'").get()?.value===sequence&&require('./sqlite-derived').tables(s,['history_detail_laps','history_detail_refs'])&&!require('./sqlite-derived').tables(s,['history_details'])){
  s.db.exec('CREATE TABLE history_details(id TEXT PRIMARY KEY,total INTEGER NOT NULL,figures TEXT NOT NULL,inputs TEXT NOT NULL)');
  for(const {id}of s.statement('SELECT id FROM history_sessions').iterate())rebuildSession(s,id,true,true);
  s.checkpoint('history-details-repaired');
 }
 if(s.statement("SELECT value FROM info WHERE key='historyDetailVersion'").get()?.value==='1'&&s.statement("SELECT value FROM info WHERE key='historyDetailSequence'").get()?.value===sequence&&require('./sqlite-derived').tables(s,['history_details','history_detail_laps','history_detail_refs'])){s.db.exec('CREATE INDEX IF NOT EXISTS history_detail_order ON history_detail_laps(sessionId,token,heat,lap,ordinal); CREATE INDEX IF NOT EXISTS history_detail_dependency ON history_detail_refs(entity,recordId,sessionId);');return;}
 s.db.exec(`DROP TABLE IF EXISTS history_details; DROP TABLE IF EXISTS history_detail_laps; DROP TABLE IF EXISTS history_detail_refs;
 CREATE TABLE history_details(id TEXT PRIMARY KEY,total INTEGER NOT NULL,figures TEXT NOT NULL,inputs TEXT NOT NULL);
 CREATE TABLE history_detail_laps(id TEXT PRIMARY KEY,sessionId TEXT,token INTEGER NOT NULL,heat REAL NOT NULL,lap REAL NOT NULL,ordinal INTEGER NOT NULL);
 CREATE INDEX history_detail_order ON history_detail_laps(sessionId,token,heat,lap,ordinal);
 CREATE TABLE history_detail_refs(sessionId TEXT NOT NULL,entity TEXT NOT NULL,recordId TEXT NOT NULL,ordinal INTEGER NOT NULL,inputs TEXT,PRIMARY KEY(sessionId,entity,recordId));
 CREATE INDEX history_detail_dependency ON history_detail_refs(entity,recordId,sessionId);
 INSERT INTO history_detail_laps SELECT h.id,l.sessionId,h.token,h.heat,h.lap,h.ordinal FROM history_laps h JOIN lap_index l ON l.id=h.id;`);
 for(const {id} of s.statement('SELECT id FROM history_sessions').iterate())rebuildSession(s,id);
 s.statement("INSERT INTO info VALUES('historyDetailVersion','1') ON CONFLICT(key) DO UPDATE SET value=excluded.value").run();stamp(s);
});}
function sync(s){
 const affected=new Set(),lapChanges=new Set();
 for(const {entity,id} of s.changed.values()){
  if(entity==='laps'){
   if(!require('./sqlite-lap-effects').changed(s,id,'detail'))continue;
   const old=s.statement('SELECT sessionId FROM history_detail_laps WHERE id=?').get(id);if(typeof old?.sessionId==='string'){affected.add(old.sessionId);lapChanges.add(old.sessionId);}
   s.statement('DELETE FROM history_detail_laps WHERE id=?').run(id);
   s.statement('INSERT INTO history_detail_laps SELECT h.id,l.sessionId,h.token,h.heat,h.lap,h.ordinal FROM history_laps h JOIN lap_index l ON l.id=h.id WHERE h.id=?').run(id);
   const next=s.statement('SELECT sessionId FROM history_detail_laps WHERE id=?').get(id);if(typeof next?.sessionId==='string'){affected.add(next.sessionId);lapChanges.add(next.sessionId);}
  }else if(['sessions','tracks','slotcars'].includes(entity)){
   if(entity!=='sessions'){
    const prior=s.statement('SELECT inputs FROM history_detail_refs WHERE entity=? AND recordId=? LIMIT 1').get(entity,id),next=sourceInputs(s,entity,id);
    if(!prior||prior.inputs===next)continue;
    s.statement('UPDATE history_detail_refs SET inputs=? WHERE entity=? AND recordId=?').run(next,entity,id);
   }
   if(entity==='sessions')affected.add(id);
   for(const r of s.statement('SELECT sessionId FROM history_detail_refs WHERE entity=? AND recordId=?').all(entity,id))affected.add(r.sessionId);
  }
 }
 // A mileage counter, name change or delivery acknowledgement must not reread
 // old lap histories. Only changed numeric inputs invalidate their figures.
 for(const id of affected)rebuildSession(s,id,lapChanges.has(id));
}
function read(s,id,saved,options){
 const summary=s.statement('SELECT total,figures FROM history_details WHERE id=?').get(id);
 if(!summary)throw Error('Session history index is incomplete. Reopen Timing to check storage.');
 const token=s.statement('SELECT token FROM history_sessions WHERE id=?').get(id).token;
 const rows=options.exportAll?s.statement(LAP_SQL).all(id,token):s.statement(LAP_SQL+' LIMIT 100 OFFSET ?').all(id,token,options.offset);
 const related=refs(s,id),numeric=JSON.parse(summary.figures);
 const figures=Stats.forSession(saved,[],related.tracks,related.slotcars).map((f,i)=>Object.assign(f,Object.fromEntries(FIGURES.map((k,j)=>[k,typeof numeric[i][j]==='string'?Number(numeric[i][j]):numeric[i][j]]))));
 return {laps:H.noMedia(rows.map(r=>JSON.parse(r.json))),total:summary.total,figures,refs:related};
}
module.exports={upgrade,sync,stamp,read};
