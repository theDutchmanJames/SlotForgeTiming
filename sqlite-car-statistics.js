'use strict';
// Disposable per-car/session contributions and merged totals. Updated inside
// the authoritative write transaction; reads never decode lap histories.
const H=require('./history-read'),C=require('./sqlite-catalogue'),S=require('./car-statistics');
const TRACK=H.TRACK.filter(k=>!['name','scale'].includes(k));
const LAP_SQL="SELECT f.json,h.ordinal FROM car_stat_laps h JOIN fields f ON f.entity='laps' AND f.id=h.id AND f.path='[]' WHERE h.carId=? AND h.sessionId=? ORDER BY h.ordinal";
function source(s,entity,id){
 const keys=entity==='tracks'?TRACK:entity==='slotcars'?['serviceDate']:['date'];
 return require('./sqlite-history').selected(s,entity,id,keys);
}
function part(s,carId,sessionId){
 s.statement('DELETE FROM car_stat_parts WHERE carId=? AND sessionId=?').run(carId,sessionId);
 s.statement('DELETE FROM car_stat_refs WHERE carId=? AND sessionId=?').run(carId,sessionId);
 if(!s.statement('SELECT 1 FROM car_stat_laps WHERE carId=? AND sessionId=? LIMIT 1').get(carId,sessionId))return;
 const inputs=new Map();
 function get(entity,id){
  if(typeof id!=='string'||!id)return null;
  const key=JSON.stringify([entity,id]);if(!inputs.has(key))inputs.set(key,{entity,id,value:source(s,entity,id)});return inputs.get(key).value;
 }
 const car={...get('slotcars',carId),id:carId};
 function* entries(){for(const row of s.statement(LAP_SQL).iterate(carId,sessionId))yield {lap:JSON.parse(row.json),ordinal:row.ordinal};}
 const value=S.contribution(car,entries(),id=>get('tracks',id),id=>get('sessions',id)?.date);
 s.statement('INSERT INTO car_stat_parts VALUES(?,?,?)').run(carId,sessionId,S.encode(value));
 for(const {entity,id,value:input} of inputs.values())s.statement('INSERT INTO car_stat_refs VALUES(?,?,?,?,?)').run(carId,sessionId,entity,id,JSON.stringify(input));
}
function total(s,id){
 const rows=s.statement('SELECT summary FROM car_stat_parts WHERE carId=? ORDER BY sessionId').iterate(id);
 function* values(){for(const row of rows)yield S.decode(row.summary);}
 const value=S.merge(values());
 s.statement('INSERT INTO car_stat_totals VALUES(?,?) ON CONFLICT(carId) DO UPDATE SET summary=excluded.summary').run(id,S.encode(value));
 if(!s.statement('SELECT 1 FROM car_stat_parts WHERE carId=? LIMIT 1').get(id))s.statement('DELETE FROM car_stat_totals WHERE carId=?').run(id);
}
function stamp(s){s.statement("INSERT INTO info VALUES('carStatisticsSequence',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(s.statement('SELECT coalesce(max(sequence),0) n FROM changes').get().n));}
function upgrade(s){s.transaction(()=>{
 const sequence=String(s.statement('SELECT coalesce(max(sequence),0) n FROM changes').get().n);
 if(s.statement("SELECT value FROM info WHERE key='carStatisticsVersion'").get()?.value==='1'&&s.statement("SELECT value FROM info WHERE key='carStatisticsSequence'").get()?.value===sequence&&require('./sqlite-derived').tables(s,['car_stat_laps','car_stat_parts','car_stat_refs'])){
  if(!require('./sqlite-derived').tables(s,['car_stat_totals'])){
   s.db.exec('CREATE TABLE car_stat_totals(carId TEXT PRIMARY KEY,summary TEXT NOT NULL)');
   for(const {carId} of s.statement('SELECT DISTINCT carId FROM car_stat_parts').iterate())total(s,carId);
   s.checkpoint('car-totals-repaired');
  }
  s.db.exec('CREATE INDEX IF NOT EXISTS car_stat_lap_order ON car_stat_laps(carId,sessionId,ordinal); CREATE INDEX IF NOT EXISTS car_stat_dependency ON car_stat_refs(entity,recordId,carId,sessionId);');return;
 }
 s.db.exec(`DROP TABLE IF EXISTS car_stat_laps; DROP TABLE IF EXISTS car_stat_parts; DROP TABLE IF EXISTS car_stat_refs; DROP TABLE IF EXISTS car_stat_totals;
 CREATE TABLE car_stat_laps(id TEXT PRIMARY KEY,carId TEXT NOT NULL,sessionId TEXT NOT NULL,ordinal INTEGER NOT NULL);
 CREATE INDEX car_stat_lap_order ON car_stat_laps(carId,sessionId,ordinal);
 CREATE TABLE car_stat_parts(carId TEXT NOT NULL,sessionId TEXT NOT NULL,summary TEXT NOT NULL,PRIMARY KEY(carId,sessionId));
 CREATE TABLE car_stat_refs(carId TEXT NOT NULL,sessionId TEXT NOT NULL,entity TEXT NOT NULL,recordId TEXT NOT NULL,inputs TEXT NOT NULL,PRIMARY KEY(carId,sessionId,entity,recordId));
 CREATE INDEX car_stat_dependency ON car_stat_refs(entity,recordId,carId,sessionId);
 CREATE TABLE car_stat_totals(carId TEXT PRIMARY KEY,summary TEXT NOT NULL);
 INSERT INTO car_stat_laps SELECT l.id,l.carId,coalesce(l.sessionId,''),r.ordinal FROM lap_index l JOIN records r ON r.entity='laps' AND r.id=l.id WHERE l.carId IS NOT NULL;`);
 for(const row of s.statement('SELECT DISTINCT carId,sessionId FROM car_stat_laps').all())part(s,row.carId,row.sessionId);
 for(const {carId} of s.statement('SELECT DISTINCT carId FROM car_stat_parts').all())total(s,carId);
 s.statement("INSERT INTO info VALUES('carStatisticsVersion','1') ON CONFLICT(key) DO UPDATE SET value=excluded.value").run();stamp(s);
});}
function sync(s){
 const affected=new Map(),cars=new Set();
 const add=row=>{if(row){affected.set(JSON.stringify([row.carId,row.sessionId]),row);cars.add(row.carId);}};
 for(const {entity,id} of s.changed.values()){
  if(entity==='laps'){
   if(!require('./sqlite-lap-effects').changed(s,id,'car'))continue;
   add(s.statement('SELECT carId,sessionId FROM car_stat_laps WHERE id=?').get(id));
   s.statement('DELETE FROM car_stat_laps WHERE id=?').run(id);
   s.statement("INSERT INTO car_stat_laps SELECT l.id,l.carId,coalesce(l.sessionId,''),r.ordinal FROM lap_index l JOIN records r ON r.entity='laps' AND r.id=l.id WHERE l.id=? AND l.carId IS NOT NULL").run(id);
   add(s.statement('SELECT carId,sessionId FROM car_stat_laps WHERE id=?').get(id));
  }else if(['slotcars','tracks','sessions'].includes(entity)){
   const prior=s.statement('SELECT inputs FROM car_stat_refs WHERE entity=? AND recordId=? LIMIT 1').get(entity,id);
   if(!prior||prior.inputs===JSON.stringify(source(s,entity,id)))continue;
   for(const row of s.statement('SELECT carId,sessionId FROM car_stat_refs WHERE entity=? AND recordId=?').all(entity,id))add(row);
  }
 }
 for(const row of affected.values())part(s,row.carId,row.sessionId);
 for(const id of cars)total(s,id);
}
function read(s,id){return s.transaction(()=>{
 if(typeof id!=='string')return null;
 if(!s.statement("SELECT 1 FROM records WHERE entity='slotcars' AND id=?").get(id))return null;
 const row=s.statement('SELECT summary FROM car_stat_totals WHERE carId=?').get(id);
 const wins=s.statement('SELECT count(*) n FROM history_wins WHERE carId=?').get(id).n;
 return S.details(row?S.decode(row.summary):S.empty(),tid=>typeof tid==='string'?C.read(s,'tracks',tid,['name']):'',wins);
});}
module.exports={upgrade,sync,stamp,read};
