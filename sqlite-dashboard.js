'use strict';
const D=require('./dashboard-read'),Race=require('./race-read'),C=require('./sqlite-catalogue'),R=require('./sqlite-references'),H=require('./history-read');
function source(s){return {
 revision:()=>C.revision(s),
 meta(entity){return s.statement('SELECT id FROM records WHERE entity=? ORDER BY ordinal').all(entity).map(r=>R.project(s,entity,r.id));},
 get:(entity,id)=>s.get(entity,id,true)?.value??null,
 *sessions(){for(const {id} of s.statement('SELECT id FROM history_sessions ORDER BY ordinal').iterate())yield Object.fromEntries(D.SESSION.map(k=>[k,C.read(s,'sessions',id,[k])]).filter(([,v])=>v!==undefined));},
 *navigationSessions(o){for(const {id} of s.statement("SELECT id FROM history_sessions WHERE (json_extract(summary,'$.sessionType')='qualifying' AND json_extract(summary,'$.trackId')=?) OR (?<>'' AND json_extract(summary,'$.champ.id')=?) ORDER BY ordinal").iterate(o.trackId,o.champId,o.champId))yield Object.fromEntries(D.SESSION.map(k=>[k,C.read(s,'sessions',id,[k])]).filter(([,v])=>v!==undefined));},
 navigationSession:id=>{const row=s.get('sessions',id,false)?.value;return row?H.sessionValue(row):null;},
 *laps(trackId){const rows=trackId===undefined?s.statement("SELECT f.json FROM records r JOIN fields f ON f.entity='laps' AND f.id=r.id AND f.path='[]' WHERE r.entity='laps' ORDER BY r.ordinal").iterate():s.statement("SELECT f.json FROM history_laps h JOIN fields f ON f.entity='laps' AND f.id=h.id AND f.path='[]' WHERE h.trackId=? ORDER BY h.ordinal").iterate(trackId);for(const row of rows)yield JSON.parse(row.json);}
};}
const home=(s,o)=>s.transaction(()=>D.home(source(s),o));
const navigation=(s,o)=>s.transaction(()=>D.navigation(source(s),o));
const race=(s,o)=>s.transaction(()=>Race.read(source(s),o));
const charts=(s,ids)=>s.transaction(()=>require('./display-read').charts(source(s),ids));
const season=(s,o)=>s.transaction(()=>{
 const H=require('./sqlite-history');return require('./season-read').read({
  championship:id=>s.get('championships',id,false)?.value,
  *sessions(id){for(const row of s.statement("SELECT id FROM history_sessions WHERE json_extract(summary,'$.champ.id')=? ORDER BY ordinal").iterate(id))yield H.sessionValue(s,row.id);},
  *laps(id,p){for(const row of s.statement("SELECT f.json FROM lap_index l JOIN records r ON r.entity='laps' AND r.id=l.id JOIN fields f ON f.entity='laps' AND f.id=l.id AND f.path='[]' WHERE l.sessionId=? AND (?=1 OR l.driverId=?) ORDER BY r.ordinal").iterate(id,p.asTeam?1:0,p.driverId||'')){const lap=JSON.parse(row.json);if(p.asTeam?lap.teamId===p.teamId:lap.driverId===p.driverId)yield lap;}},
  track:id=>H.selected(s,'tracks',id,require('./history-read').TRACK)
 },o);
});
module.exports={home,navigation,race,season,charts};
