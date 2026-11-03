'use strict';
const Season=require('./renderer/season'),H=require('./history-read');
function options(o){
 if(!o||!o.tag||typeof o.tag.id!=='string'||!o.tag.id||!Array.isArray(o.people)||o.people.length>4096||o.people.some(p=>!p||['driverId','teamId'].some(k=>p[k]!==undefined&&typeof p[k]!=='string')||['asTeam','virtualRival'].some(k=>p[k]!==undefined&&typeof p[k]!=='boolean')))throw Error('Invalid championship race request.');
 return o;
}
function read(source,value){
 const o=options(value),own=Season.of(source.championship(o.tag.id),o.tag);if(!own)return null;
 const sessions=[...source.sessions(o.tag.id)],tracks=new Map();
 source.prepare?.(Season.counted(own.c,sessions,own.tag),o.people);
 const track=id=>{if(!tracks.has(id))tracks.set(id,source.track(id));return tracks.get(id);};
 return {...own,sessions,past:Season.pastFrom(own.c,sessions,own.tag,o.people,source.laps,track)};
}
function jsonSource(db){const buckets=new Map();return {
 prepare(sessions,people){const ids=new Set(sessions.map(s=>s.id)),drivers=new Set(people.filter(p=>!p.asTeam&&!p.virtualRival).map(p=>p.driverId)),teams=new Set(people.filter(p=>p.asTeam&&!p.virtualRival).map(p=>p.teamId));for(const l of db.data.laps)if(l&&ids.has(l.sessionId)&&(drivers.has(l.driverId)||teams.has(l.teamId))){if(!buckets.has(l.sessionId))buckets.set(l.sessionId,[]);buckets.get(l.sessionId).push(l);}},
 championship:id=>db.data.championships.find(c=>c.id===id),
 *sessions(id){for(const s of db.data.sessions)if(s.champ?.id===id)yield H.sessionValue(s);},
 *laps(id,p){for(const l of buckets.get(id)||[])if((p.asTeam?l.teamId===p.teamId:l.driverId===p.driverId))yield l;},
 track:id=>H.pick(db.data.tracks.find(t=>t.id===id),H.TRACK)
};}
module.exports={options,read,jsonSource};
