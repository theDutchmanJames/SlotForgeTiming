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
  if(['4','5','6'].includes(version)&&require('./sqlite-derived').tables(s,['history_laps','history_sessions','history_wins'])){s.db.exec("CREATE INDEX IF NOT EXISTS history_track_start ON history_laps(trackId,ordinal); CREATE INDEX IF NOT EXISTS history_championship ON history_sessions(json_extract(summary,'$.champ.id'),ordinal); CREATE INDEX IF NOT EXISTS history_session_order ON history_sessions(token,ordinal DESC); CREATE INDEX IF NOT EXISTS history_track ON history_laps(token,track,trackId,time,ordinal); CREATE INDEX IF NOT EXISTS history_personal ON history_laps(token,personal,trackId,driverId,time,ordinal);");return;}
  if(!['3','4','5','6'].includes(version))throw Error('Unsupported history format.');
  s.db.exec(`DROP TABLE IF EXISTS history_sessions; DROP TABLE IF EXISTS history_wins; DROP TABLE IF EXISTS history_laps;
    CREATE TABLE history_sessions(id TEXT PRIMARY KEY,ordinal INTEGER NOT NULL,token INTEGER NOT NULL,summary TEXT NOT NULL);
    CREATE INDEX history_session_order ON history_sessions(token,ordinal DESC);
    CREATE INDEX history_championship ON history_sessions(json_extract(summary,'$.champ.id'),ordinal);
    CREATE TABLE history_wins(carId TEXT NOT NULL,sessionId TEXT NOT NULL,PRIMARY KEY(carId,sessionId));
    CREATE TABLE history_laps(id TEXT PRIMARY KEY,ordinal INTEGER NOT NULL,token INTEGER NOT NULL,trackId TEXT NOT NULL,driverId TEXT NOT NULL,time REAL,track INTEGER NOT NULL,personal INTEGER NOT NULL,heat REAL NOT NULL,lap REAL NOT NULL);
    CREATE INDEX history_track ON history_laps(token,track,trackId,time,ordinal);
    CREATE INDEX history_track_start ON history_laps(trackId,ordinal);
    CREATE INDEX history_personal ON history_laps(token,personal,trackId,driverId,time,ordinal);`);
  for(const entity of ['sessions','laps'])for(const {id} of s.statement('SELECT id FROM records WHERE entity=? ORDER BY ordinal').iterate(entity))index(s,entity,id);
  if(version==='3')s.statement("UPDATE info SET value='4' WHERE key='workingFormat'").run();
  s.statement("DELETE FROM info WHERE key='historyDetailVersion'").run();
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
  if(o.summaryOnly)return {revision,session:JSON.parse(s.statement('SELECT summary FROM history_sessions WHERE id=?').get(id).summary),deliveryStatus:C.read(s,'sessions',id,['paddockDelivery','status'])||null};
  const saved=sessionValue(s,id);
  return {revision,session:saved,offset:o.offset,...require('./sqlite-history-detail').read(s,id,saved,o)};
});}
function car(s,id){return require('./sqlite-car-statistics').read(s,id);}
module.exports={upgrade,sync,page,session,car,sessionValue,selected};
