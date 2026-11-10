'use strict';
// Disposable Home projections. Original lap records remain the authority.
// Kept in the same transaction as domain writes; older writers are detected on reopen.
const C=require('./sqlite-catalogue'),Home=require('./renderer/homestats'),Stats=require('./renderer/stats');
const text=v=>typeof v==='string'?v:'';
const date=v=>Number.isFinite(Date.parse(v))?Date.parse(v):null;
function lap(s,id,row){
 if(!row)return;const l=JSON.parse(row.json),time=Number(l.time);if(l.token||l.invalid||l.tooSlow||l.late||!Number.isFinite(time)||time<=0)return;
 const n=Math.round(Number(l.lane)),lane=n>=1?Math.min(n,Number.MAX_SAFE_INTEGER):0;
 s.statement('INSERT INTO home_laps VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,row.ordinal,text(l.trackId),text(l.driverId),text(l.carId),text(l.sessionId),time,lane,date(l.date),l.date?0:1);
}
function adjust(s,row,delta){
 const key=[row.trackId,row.carId,row.lane];
 if(delta>0)s.statement('INSERT INTO home_totals VALUES(?,?,?,?,?) ON CONFLICT(trackId,carId,lane) DO UPDATE SET n=n+1,first=min(first,excluded.first)').run(...key,1,row.ordinal);
 else {const old=s.statement('SELECT n,first FROM home_totals WHERE trackId=? AND carId=? AND lane=?').get(...key);if(!old)throw Error('Home totals are inconsistent.');
  if(old.n===1)s.statement('DELETE FROM home_totals WHERE trackId=? AND carId=? AND lane=?').run(...key);
  else {const first=old.first===row.ordinal?s.statement('SELECT min(ordinal) n FROM home_laps WHERE trackId=? AND carId=? AND lane=?').get(...key).n:old.first;s.statement('UPDATE home_totals SET n=n-1,first=? WHERE trackId=? AND carId=? AND lane=?').run(first,...key);}
 }
}
function index(s,entity,id){
 if(entity==='sessions'){
  s.statement('DELETE FROM home_dates WHERE id=?').run(id);
  if(s.statement("SELECT 1 FROM records WHERE entity='sessions' AND id=?").get(id))s.statement('INSERT INTO home_dates VALUES(?,?)').run(id,date(C.read(s,entity,id,['date'])));
 }else if(entity==='laps'){
  const old=s.statement('SELECT trackId,carId,lane,ordinal FROM home_laps WHERE id=?').get(id);
  s.statement('DELETE FROM home_laps WHERE id=?').run(id);if(old)adjust(s,old,-1);
  const row=s.statement("SELECT r.ordinal,f.json FROM records r JOIN fields f ON f.entity=r.entity AND f.id=r.id AND f.path='[]' WHERE r.entity='laps' AND r.id=?").get(id);
  lap(s,id,row);const added=s.statement('SELECT trackId,carId,lane,ordinal FROM home_laps WHERE id=?').get(id);if(added)adjust(s,added,1);
 }
}
function stamp(s){s.statement("INSERT INTO info VALUES('homeIndexSequence',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(s.statement('SELECT coalesce(max(sequence),0) n FROM changes').get().n));}
function upgrade(s){s.transaction(()=>{
 const zone=Intl.DateTimeFormat().resolvedOptions().timeZone;
 const revision=String(s.statement('SELECT coalesce(max(sequence),0) n FROM changes').get().n);
 const current=s.statement("SELECT value FROM info WHERE key='homeIndexVersion'").get()?.value==='3'&&s.statement("SELECT value FROM info WHERE key='homeIndexZone'").get()?.value===zone&&s.statement("SELECT value FROM info WHERE key='homeIndexSequence'").get()?.value===revision;
 if(current&&require('./sqlite-derived').tables(s,['home_laps','home_dates'])){
  if(!require('./sqlite-derived').tables(s,['home_totals'])){
   s.db.exec('CREATE TABLE home_totals(trackId TEXT NOT NULL,carId TEXT NOT NULL,lane REAL NOT NULL,n INTEGER NOT NULL,first INTEGER NOT NULL,PRIMARY KEY(trackId,carId,lane)); INSERT INTO home_totals SELECT trackId,carId,lane,COUNT(*),MIN(ordinal) FROM home_laps GROUP BY trackId,carId,lane;');
   s.checkpoint('home-totals-repaired');
  }
  s.db.exec('CREATE INDEX IF NOT EXISTS home_last ON home_laps(sessionId,time,ordinal); CREATE INDEX IF NOT EXISTS home_group ON home_laps(trackId,carId,lane,ordinal); CREATE INDEX IF NOT EXISTS home_week ON home_laps(trackId,driverId,time,ordinal);');return;
 }
 s.db.exec(`DROP TABLE IF EXISTS home_totals; DROP TABLE IF EXISTS home_laps; DROP TABLE IF EXISTS home_dates;
 CREATE TABLE home_dates(id TEXT PRIMARY KEY,ms REAL);
 CREATE TABLE home_laps(id TEXT PRIMARY KEY,ordinal INTEGER NOT NULL,trackId TEXT NOT NULL,driverId TEXT NOT NULL,carId TEXT NOT NULL,sessionId TEXT NOT NULL,time REAL NOT NULL,lane REAL NOT NULL,ownDate REAL,fallback INTEGER NOT NULL);`);
 for(const {id} of s.statement("SELECT id FROM records WHERE entity='sessions'").iterate())index(s,'sessions',id);
 for(const row of s.statement("SELECT r.id,r.ordinal,f.json FROM records r JOIN fields f ON f.entity=r.entity AND f.id=r.id AND f.path='[]' WHERE r.entity='laps' ORDER BY r.ordinal").iterate())lap(s,row.id,row);
 s.db.exec(`
 CREATE INDEX home_last ON home_laps(sessionId,time,ordinal);
 CREATE INDEX home_group ON home_laps(trackId,carId,lane,ordinal);
 CREATE TABLE home_totals(trackId TEXT NOT NULL,carId TEXT NOT NULL,lane REAL NOT NULL,n INTEGER NOT NULL,first INTEGER NOT NULL,PRIMARY KEY(trackId,carId,lane));
 INSERT INTO home_totals SELECT trackId,carId,lane,COUNT(*),MIN(ordinal) FROM home_laps GROUP BY trackId,carId,lane;
 CREATE INDEX home_week ON home_laps(trackId,driverId,time,ordinal);`);
 s.statement("INSERT INTO info VALUES('homeIndexZone',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(zone);
 s.statement("INSERT INTO info VALUES('homeIndexVersion','3') ON CONFLICT(key) DO UPDATE SET value=excluded.value").run();stamp(s);
});}
function sync(s){for(const {entity,id} of s.changed.values())if(entity==='sessions'||entity==='laps'&&require('./sqlite-lap-effects').changed(s,id,'home'))index(s,entity,id);}
function summary(s,o,{last,cars,tracks,now}){
 const needed=new Set(o.boards.map(b=>b.key)),rec=new Map(),personal=new Map(),weekly=new Map(),mile={all:new Map(),year:new Map()},distances=new Map(),trackOrder=new Map();let valid=0,lastLap=null;
 const order=new WeakMap();const load=id=>{const l=C.read(s,'laps',id,[]);order.set(l,s.statement("SELECT ordinal FROM records WHERE entity='laps' AND id=?").get(id).ordinal);return l;};
 if(last){const row=s.statement('SELECT id FROM home_laps WHERE sessionId=? ORDER BY time,ordinal LIMIT 1').get(last.id);if(row)lastLap=load(row.id);}
 if(needed.has('records')||needed.has('record')){
  const ids=needed.has('records')?s.statement('SELECT trackId,MIN(ordinal) first FROM history_laps WHERE token=0 GROUP BY trackId ORDER BY first').all().map(x=>x.trackId):[o.trackId];
  for(const id of ids){trackOrder.set(id,trackOrder.size);const row=s.statement('SELECT id FROM history_laps WHERE token=0 AND track=1 AND trackId=? AND time>0 ORDER BY time,ordinal LIMIT 1').get(id);if(row)rec.set(id,load(row.id));}
 }
 if(needed.has('record')||needed.has('bests')){
  // Only selected grid drivers can appear in either card.
  for(const id of new Set([...o.driverIds,...o.grid.map(x=>x.driverId)])){
   const row=s.statement('SELECT id FROM history_laps WHERE token=0 AND personal=1 AND trackId=? AND driverId=? AND time>0 ORDER BY time,ordinal LIMIT 1').get(o.trackId,id);if(row)personal.set(id,load(row.id));
  }
 }
 if(needed.has('fastest')){
  const all=o.boards.some(b=>b.key==='fastest'&&b.scope==='all'),week=Home.weekStart(now).getTime();
  const filter="h.trackId<>'' AND h.driverId<>'' AND (?=1 OR h.trackId=?) AND (CASE WHEN h.fallback=1 THEN d.ms ELSE h.ownDate END)>=?";
  const rows=s.statement('SELECT h.trackId,h.driverId,MIN(time) best,MIN(ordinal) first FROM home_laps h LEFT JOIN home_dates d ON d.id=h.sessionId WHERE '+filter+' GROUP BY h.trackId,h.driverId ORDER BY first').all(all?1:0,o.trackId,week);
  for(const row of rows){const winner=s.statement('SELECT h.id FROM home_laps h LEFT JOIN home_dates d ON d.id=h.sessionId WHERE h.trackId=? AND h.driverId=? AND h.time=? AND (CASE WHEN h.fallback=1 THEN d.ms ELSE h.ownDate END)>=? ORDER BY h.ordinal LIMIT 1').get(row.trackId,row.driverId,row.best,week);const l=load(winner.id);weekly.set(JSON.stringify([l.trackId,l.driverId]),l);}
 }
 if(needed.has('glance')||needed.has('mileage')){
  const periods=new Set(o.boards.filter(b=>b.key==='mileage').map(b=>b.period));
  const add=(rows,period)=>{for(const r of rows){const len=Stats.lapLength(tracks.get(r.trackId)||{},{lane:r.lane});
   if(period==='all'){valid+=r.laps;if(!trackOrder.has(r.trackId))trackOrder.set(r.trackId,trackOrder.size);if(needed.has('glance')&&len>0)distances.set(r.trackId,(distances.get(r.trackId)||0)+len*r.laps);}
   if(periods.has(period)&&r.carId&&cars.has(r.carId)){let m=mile[period].get(r.carId);if(!m){m={carId:r.carId,name:cars.get(r.carId),picture:'',laps:0,dist:new Map()};mile[period].set(r.carId,m);}m.laps+=r.laps;if(len>0)m.dist.set(r.trackId,(m.dist.get(r.trackId)||0)+len*r.laps);}
  }};
  // All-time totals grow with track/car/lane combinations, not with lap count.
  // Current track metadata still determines distance; year cutoffs stay dynamic.
  if(needed.has('glance')||periods.has('all'))add(s.statement('SELECT trackId,carId,lane,n laps FROM home_totals ORDER BY first').all(),'all');
  if(periods.has('year'))add(s.statement('SELECT trackId,carId,lane,COUNT(*) laps,MIN(ordinal) first FROM home_laps WHERE ownDate>=? GROUP BY trackId,carId,lane ORDER BY first').all(Home.yearStart(now).getTime()),'year');
 }
 const compact=[...new Set([...rec.values(),...personal.values()])].sort((a,b)=>order.get(a)-order.get(b));
 return {rec,personal,weekly,mile,distances,trackOrder,lastLap,valid,compact};
}
module.exports={upgrade,sync,stamp,summary};
