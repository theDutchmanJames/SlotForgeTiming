'use strict';
const H=require('./history-read'),C=require('./sqlite-catalogue'),Order=require('./catalogue-read'),Stats=require('./renderer/stats');
// Disposable working-copy indexes. Authoritative session/lap records are unchanged.
function selected(s,entity,id,keys){
  if(typeof id!=='string')return null;
  if(!s.statement('SELECT 1 FROM records WHERE entity=? AND id=?').get(entity,id))return null;
  return Object.fromEntries(keys.map(k=>{if(k==='paddock'){const name=C.read(s,entity,id,['paddock','name']);return [k,name===undefined?undefined:{name}];}return [k,C.read(s,entity,id,[k])];}).filter(([,v])=>v!==undefined));
}
function sessionValue(s,id){
  const shape=s.statement("SELECT shape FROM records WHERE entity='sessions' AND id=?").get(id);
  if(!shape)return null;
  const keys=JSON.parse(shape.shape)[1].map(x=>x[0]).filter(k=>!['paddockDelivery','paddockJournal'].includes(k));
  return H.sessionValue(selected(s,'sessions',id,keys));
}
function index(s,entity,id){
  if(entity==='sessions'){
    s.statement('DELETE FROM history_sessions WHERE id=?').run(id);s.statement('DELETE FROM history_wins WHERE sessionId=?').run(id);
    const r=s.statement("SELECT ordinal FROM records WHERE entity='sessions' AND id=?").get(id);if(!r)return;
    const value=selected(s,entity,id,['id','date','setupName','sessionType','trackId','trackName','token','champ','standings','virtualRivals','rivalClassification']);
    s.statement('INSERT INTO history_sessions VALUES(?,?,?,?)').run(id,r.ordinal,value.sessionType==='tokens'?1:0,JSON.stringify(H.summary(value)));
    for(const carId of new Set((Array.isArray(value.standings)?value.standings:[]).filter(x=>x&&Stats.isWinner(value,x)&&typeof x.carId==='string').map(x=>x.carId)))s.statement('INSERT INTO history_wins VALUES(?,?)').run(carId,id);
  }else if(entity==='laps'){
    s.statement('DELETE FROM history_laps WHERE id=?').run(id);
    const r=s.statement("SELECT ordinal FROM records WHERE entity='laps' AND id=?").get(id);if(!r)return;
    const l=C.read(s,entity,id,[]),n=Number(l.time),finite=Number.isFinite(n)&&n>0;
    s.statement('INSERT INTO history_laps VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,r.ordinal,l.token?1:0,l.trackId||'',l.driverId||'',finite?n:null,l.noTrackRecord?0:1,l.noPersonalBest?0:1,Number(l.heat)||0,Number(l.lapNumber)||0);
  }
}
function upgrade(s){s.transaction(()=>{
  const version=s.statement("SELECT value FROM info WHERE key='workingFormat'").get().value;
  if(['4','5','6'].includes(version)){s.db.exec("CREATE INDEX IF NOT EXISTS history_track_start ON history_laps(trackId,ordinal); CREATE INDEX IF NOT EXISTS history_championship ON history_sessions(json_extract(summary,'$.champ.id'),ordinal)");s.statement('SELECT id,ordinal,token,summary FROM history_sessions LIMIT 0').all();s.statement('SELECT id,trackId,personal FROM history_laps LIMIT 0').all();s.statement('SELECT carId FROM history_wins LIMIT 0').all();return;}
  if(version!=='3')throw Error('Unsupported history format.');
  s.db.exec(`CREATE TABLE history_sessions(id TEXT PRIMARY KEY,ordinal INTEGER NOT NULL,token INTEGER NOT NULL,summary TEXT NOT NULL);
    CREATE INDEX history_session_order ON history_sessions(token,ordinal DESC);
    CREATE INDEX history_championship ON history_sessions(json_extract(summary,'$.champ.id'),ordinal);
    CREATE TABLE history_wins(carId TEXT NOT NULL,sessionId TEXT NOT NULL,PRIMARY KEY(carId,sessionId));
    CREATE TABLE history_laps(id TEXT PRIMARY KEY,ordinal INTEGER NOT NULL,token INTEGER NOT NULL,trackId TEXT NOT NULL,driverId TEXT NOT NULL,time REAL,track INTEGER NOT NULL,personal INTEGER NOT NULL,heat REAL NOT NULL,lap REAL NOT NULL);
    CREATE INDEX history_track ON history_laps(token,track,trackId,time,ordinal);
    CREATE INDEX history_track_start ON history_laps(trackId,ordinal);
    CREATE INDEX history_personal ON history_laps(token,personal,trackId,driverId,time,ordinal);`);
  for(const entity of ['sessions','laps'])for(const {id} of s.statement('SELECT id FROM records WHERE entity=? ORDER BY ordinal').iterate(entity))index(s,entity,id);
  s.statement("UPDATE info SET value='4' WHERE key='workingFormat'").run();
});}
function sync(s){for(const {entity,id} of s.changed.values())index(s,entity,id);}
function page(s,pool,value){const opts=H.options(pool,value);return s.transaction(()=>{
  const revision=C.revision(s),token=pool==='tokens'?1:0;for(const c of Object.values(opts))if(c)H.checkRevision(c.revision,revision);
  const result={revision};
  for(const section of ['sessions','tracks','personal']){
    const offset=opts[section]?.offset||0,limit=section==='sessions'?12:40;
    let rows;
    if(section==='sessions')rows=s.statement('SELECT summary FROM history_sessions WHERE token=? ORDER BY ordinal DESC LIMIT ? OFFSET ?').all(token,limit+1,offset).map(x=>JSON.parse(x.summary));
    else{
      const field=section==='tracks'?'track':'personal',group=section==='tracks'?'trackId':'trackId,driverId';
      rows=s.statement(`WITH winners AS (SELECT *,ROW_NUMBER() OVER(PARTITION BY ${group} ORDER BY time,ordinal) AS place,MIN(ordinal) OVER(PARTITION BY ${group}) AS firstOrdinal FROM history_laps WHERE token=? AND ${field}=1 AND time>0 ${token&&field==='personal'?"AND driverId<>''":''}) SELECT w.id FROM winners w LEFT JOIN catalogue_index c ON c.entity='tracks' AND c.id=w.trackId WHERE w.place=1 ORDER BY COALESCE(c.sortKey,?),w.time,w.firstOrdinal LIMIT ? OFFSET ?`).all(token,Order.key('(deleted)'),limit+1,offset).map(r=>C.read(s,'laps',r.id,[]));
    }
    result[section]={items:rows.slice(0,limit),next:rows.length>limit?{pool,section,revision,offset:offset+limit}:null};
  }
  result.refs=H.refs((...args)=>selected(s,...args),[...result.tracks.items,...result.personal.items]);return H.noMedia(result);
});}
function session(s,pool,id,value){H.options(pool);const o=H.detailOptions(value);return s.transaction(()=>{
  const revision=C.revision(s);H.checkRevision(o.revision,revision);
  if(!s.statement('SELECT 1 FROM history_sessions WHERE id=? AND token=?').get(id,pool==='tokens'?1:0))return null;
  const saved=sessionValue(s,id),laps=s.statement(`SELECT f.json FROM lap_index l JOIN history_laps h ON h.id=l.id JOIN fields f ON f.entity='laps' AND f.id=l.id AND f.path='[]' WHERE l.sessionId=? AND h.token=? ORDER BY h.heat,h.lap,h.ordinal`).all(id,pool==='tokens'?1:0).map(x=>JSON.parse(x.json));
  const related=H.refs((...args)=>selected(s,...args),laps,[saved]);
  return {revision,session:saved,laps:H.noMedia(o.exportAll?laps:laps.slice(o.offset,o.offset+100)),offset:o.offset,total:laps.length,figures:Stats.forSession(saved,laps,related.tracks,related.slotcars),refs:related};
});}
function car(s,id){return s.transaction(()=>{
  const value=selected(s,'slotcars',id,H.CAR);if(!value)return null;
  const tracks=new Map(),dates=new Map(),trackOf=tid=>{if(!tracks.has(tid))tracks.set(tid,selected(s,'tracks',tid,H.TRACK));return tracks.get(tid);},dateOf=sid=>{if(!dates.has(sid))dates.set(sid,typeof sid==='string'?C.read(s,'sessions',sid,['date']):undefined);return dates.get(sid);};
  const rows=s.statement("SELECT f.json FROM lap_index l JOIN records r ON r.entity='laps' AND r.id=l.id JOIN fields f ON f.entity='laps' AND f.id=l.id AND f.path='[]' WHERE l.carId=? ORDER BY r.ordinal").iterate(id);
  function* laps(){for(const row of rows)yield JSON.parse(row.json);}
  return H.carDetails(value,laps(),trackOf,dateOf,s.statement('SELECT COUNT(*) AS n FROM history_wins WHERE carId=?').get(id).n);
});}
module.exports={upgrade,sync,page,session,car,sessionValue,selected};
