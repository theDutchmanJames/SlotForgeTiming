'use strict';
// Mergeable numeric contributions; names and wins are resolved from current
// metadata. Keep the same eligibility and service rules as history-read.
const Stats=require('./renderer/stats'),CarStats=require('./renderer/carstats');
const empty=()=>({mileage:{laps:0,distance:null},since:{laps:0,distance:null},last:null,sessions:[],deslots:0,tracks:[]});
function contribution(car,entries,trackOf,dateOf){
 const out=empty(),tracks=new Map(),sessions=new Set();
 function distance(target,l,track){target.laps++;const len=Stats.lapLength(track,l);if(len>0)target.distance=(target.distance||0)+len;}
 for(const {lap:l,ordinal} of entries){
  if(!l||l.carId!==car.id||l.token)continue;
  const date=dateOf(l.sessionId),at=Date.parse(l.date||date),track=trackOf(l.trackId)||{},time=Number(l.time);
  if(Number.isFinite(at)&&(out.last===null||at>out.last))out.last=at;if(l.sessionId)sessions.add(l.sessionId);
  const valid=Number.isFinite(time)&&time>0,clean=!(l.invalid||l.tooSlow||l.late);
  if(valid&&clean){distance(out.mileage,l,track);if(CarStats.afterService(car,l,date))distance(out.since,l,track);}
  if(time>0&&!l.pit&&Number(track.deslotTime)>0&&time>Number(track.deslotTime)*1000)out.deslots++;
  if(time>0&&clean&&!l.pit){
   let row=tracks.get(l.trackId);if(!row){row={trackId:l.trackId,first:ordinal,laps:0,best:Infinity,total:0,count:0};tracks.set(l.trackId,row);}
   row.laps++;row.best=Math.min(row.best,time);if(valid){row.total+=time;row.count++;}
  }
 }
 out.sessions=[...sessions];out.tracks=[...tracks.values()];return out;
}
function merge(parts){
 const out=empty(),tracks=new Map(),sessions=new Set();
 for(const p of parts){
  for(const k of ['mileage','since']){out[k].laps+=p[k].laps;if(p[k].distance!==null)out[k].distance=(out[k].distance||0)+p[k].distance;}
  if(p.last!==null&&(out.last===null||p.last>out.last))out.last=p.last;
  for(const id of p.sessions)sessions.add(id);out.deslots+=p.deslots;
  for(const r of p.tracks){const old=tracks.get(r.trackId);if(!old)tracks.set(r.trackId,{...r});else{old.first=Math.min(old.first,r.first);old.laps+=r.laps;old.best=Math.min(old.best,r.best);old.total+=r.total;old.count+=r.count;}}
 }
 out.sessionCount=sessions.size;out.tracks=[...tracks.values()].sort((a,b)=>a.first-b.first);return out;
}
function details(value,nameOf,wins){
 const rows=value.tracks.map(r=>({trackId:r.trackId,name:nameOf(r.trackId)||'',laps:r.laps,best:r.best,avg:r.count?r.total/r.count:null})).sort((a,b)=>b.laps-a.laps||(a.name<b.name?-1:a.name>b.name?1:0));
 const fast=rows.reduce((a,b)=>!a||b.best<a.best?b:a,null);
 const mileage=v=>({laps:v.laps,distance:v.laps?v.distance:0});
 return {mileage:mileage(value.mileage),mileageSince:mileage(value.since),lastDriven:value.last===null?'':new Date(value.last).toISOString(),sessions:value.sessionCount??value.sessions.length,wins,deslots:value.deslots,fastest:fast?{time:fast.best,trackId:fast.trackId,trackName:fast.name}:null,tracks:rows};
}
// Older JSON imports can contain the string "Infinity" as a lap time.
// Preserve its existing best-lap behavior through the derived JSON cache.
const encode=value=>JSON.stringify(value,(_k,v)=>typeof v==='number'&&!Number.isFinite(v)?{nonfinite:String(v)}:v);
const decode=value=>JSON.parse(value,(_k,v)=>v&&typeof v==='object'&&Object.keys(v).length===1&&v.nonfinite?Number(v.nonfinite):v);
module.exports={empty,contribution,merge,details,encode,decode};
