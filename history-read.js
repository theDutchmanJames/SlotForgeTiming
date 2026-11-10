'use strict';
const C=require('./catalogue-read'),Stats=require('./renderer/stats'),CarStats=require('./renderer/carstats'),Rival=require('./renderer/virtualrival');
const TRACK=['id','name','length','lanes','laneModifier','outsideLane','laneSpacing','netTurns','laneLengths','trackShape','scale','deslotTime'];
const CAR=['id','brand','manufacturer','model','scale','serviceDate','paddock'];
const pick=(value,keys)=>Object.fromEntries(keys.filter(k=>Object.hasOwn(value||{},k)).map(k=>[k,value[k]]));
function noMedia(value){if(typeof value==='string'&&/^data:[^;,]+;base64,/.test(value))return null;if(Array.isArray(value))return value.map(noMedia);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,noMedia(v)]));return value;}
function summary(s){
  s={...s,standings:Array.isArray(s.standings)?s.standings:[]};
  const winner=(Rival.savedStandings(s)||[]).find(x=>x.pos===1)||(s.standings||[])[0];
  return {...pick(s,['id','date','setupName','sessionType','trackId','trackName','token','champ']),standings:winner?[pick(winner,['pos','driverId','driverName','carName','best','laps','total','dq','retired'])]:[],historySummary:true};
}
function options(pool,value={}){
  if(!['racing','tokens'].includes(pool)||!value||typeof value!=='object')throw Error('Invalid history query.');
  const result={};for(const section of ['sessions','tracks','personal']){const cursor=value[section]??null;if(cursor!==null&&(!cursor||cursor.pool!==pool||cursor.section!==section||typeof cursor.revision!=='string'||!Number.isSafeInteger(cursor.offset)||cursor.offset<0))throw Error('Invalid history cursor.');result[section]=cursor;}return result;
}
function checkRevision(expected,actual){if(expected!==undefined&&expected!==actual)throw C.stale();}
function page(rows,offset,limit,pool,section,revision){const items=rows.slice(offset,offset+limit);return {items,next:rows.length>offset+limit?{pool,section,revision,offset:offset+limit}:null};}
function refs(get,laps,sessions=[]){
  const ids={tracks:new Set(),slotcars:new Set(),drivers:new Set(),sessions:new Set()};
  for(const l of laps){ids.tracks.add(l.trackId);ids.slotcars.add(l.carId);ids.drivers.add(l.driverId);ids.sessions.add(l.sessionId);}
  for(const s of sessions){ids.tracks.add(s.trackId);for(const row of s.standings||[])ids.slotcars.add(row.carId);}
  const keys={tracks:TRACK,slotcars:CAR,drivers:['id','name'],sessions:['id','setupName']};
  return Object.fromEntries(Object.entries(ids).map(([entity,set])=>[entity,[...set].filter(id=>typeof id==='string'&&id).map(id=>get(entity,id,keys[entity])).filter(Boolean)]));
}
function referenceRequest(rows){if(!Array.isArray(rows)||rows.length>100||rows.some(r=>!r||!['tracks','slotcars'].includes(r.entity)||typeof r.id!=='string'||r.id.length>500))throw Error('Invalid history references.');return rows;}
function jsonReferences(db,rows){return noMedia(referenceRequest(rows).map(r=>jsonGet(db,r.entity,r.id,r.entity==='tracks'?TRACK:CAR)));}
function carDetails(car,laps,trackOf,dateOf,wins){
  const tracks=new Map(),sessions=new Set(),mileage={laps:0,distance:null},since={laps:0,distance:null};let last=NaN,deslots=0;
  function distance(target,l,track){target.laps++;const len=Stats.lapLength(track,l);if(len>0)target.distance=(target.distance||0)+len;}
  for(const l of laps){if(!l||l.carId!==car.id||l.token)continue;
    const date=dateOf(l.sessionId),at=Date.parse(l.date||date),track=trackOf(l.trackId)||{},time=Number(l.time);
    if(Number.isFinite(at)&&(!Number.isFinite(last)||at>last))last=at;if(l.sessionId)sessions.add(l.sessionId);
    const validTime=Number.isFinite(time)&&time>0,clean=!(l.invalid||l.tooSlow||l.late);
    if(validTime&&clean){distance(mileage,l,track);if(CarStats.afterService(car,l,date))distance(since,l,track);}
    if(time>0&&!l.pit&&Number(track.deslotTime)>0&&time>Number(track.deslotTime)*1000)deslots++;
    if(time>0&&clean&&!l.pit){let row=tracks.get(l.trackId);if(!row){row={trackId:l.trackId,name:track.name||'',laps:0,best:Infinity,total:0,count:0};tracks.set(l.trackId,row);}row.laps++;row.best=Math.min(row.best,time);if(validTime){row.total+=time;row.count++;}}
  }
  const rows=[...tracks.values()].map(({total,count,...r})=>({...r,avg:count?total/count:null})).sort((a,b)=>b.laps-a.laps||(a.name<b.name?-1:a.name>b.name?1:0));
  const fast=rows.reduce((a,b)=>!a||b.best<a.best?b:a,null);
  if(!mileage.laps)mileage.distance=0;if(!since.laps)since.distance=0;
  return {mileage,mileageSince:since,lastDriven:Number.isFinite(last)?new Date(last).toISOString():'',sessions:sessions.size,wins,deslots,fastest:fast?{time:fast.best,trackId:fast.trackId,trackName:fast.name}:null,tracks:rows};
}
function jsonGet(db,entity,id,keys){const row=db.data[entity]?.find(x=>x.id===id);if(!row)return null;const out=pick(row,keys.filter(k=>k!=='paddock'));if(keys.includes('paddock')&&row.paddock?.name!==undefined)out.paddock={name:row.paddock.name};return out;}
function jsonPage(db,pool,value){
  const opts=options(pool,value),revision=C.jsonRevision(db),token=pool==='tokens';for(const c of Object.values(opts))if(c)checkRevision(c.revision,revision);
  const sessions=db.data.sessions.filter(s=>(s.sessionType==='tokens')===token).map(summary).reverse();
  const maps={tracks:new Map(),personal:new Map()};
  for(const l of db.data.laps){if(!!l.token!==token||!Number.isFinite(Number(l.time))||!(Number(l.time)>0))continue;
    for(const kind of ['tracks','personal']){if(l[kind==='tracks'?'noTrackRecord':'noPersonalBest']||(token&&kind==='personal'&&!l.driverId))continue;
      const key=JSON.stringify(kind==='tracks'?[l.trackId||'']:[l.trackId||'',l.driverId||'']),old=maps[kind].get(key);if(!old||Number(l.time)<Number(old.time))maps[kind].set(key,l);}}
  const trackNames=new Map(db.data.tracks.map(t=>[t.id,C.key(t.name)]));
  const sort=(a,b)=>C.compare(trackNames.get(a.trackId)||C.key('(deleted)'),trackNames.get(b.trackId)||C.key('(deleted)'))||Number(a.time)-Number(b.time);
  const sections={sessions:page(sessions,opts.sessions?.offset||0,12,pool,'sessions',revision)};
  for(const kind of ['tracks','personal'])sections[kind]=page([...maps[kind].values()].sort(sort),opts[kind]?.offset||0,40,pool,kind,revision);
  const records=[...sections.tracks.items,...sections.personal.items];return noMedia({revision,...sections,refs:refs((...args)=>jsonGet(db,...args),records)});
}
function detailOptions(value={}){const {offset=0,revision,exportAll=false,summaryOnly=false}=value;if(!Number.isSafeInteger(offset)||offset<0||typeof exportAll!=='boolean'||typeof summaryOnly!=='boolean'||revision!==undefined&&typeof revision!=='string')throw Error('Invalid session query.');return {offset,revision,exportAll,summaryOnly};}
function lapOrder(a,b){return (Number(a.heat)||0)-(Number(b.heat)||0)||(Number(a.lapNumber)||0)-(Number(b.lapNumber)||0);}
function sessionValue(s){return noMedia({...Object.fromEntries(Object.entries(s).filter(([k])=>!['paddockDelivery','paddockJournal','historySummary'].includes(k))),standings:Array.isArray(s.standings)?s.standings:[]});}
function jsonSession(db,pool,id,value){
  options(pool);const o=detailOptions(value),revision=C.jsonRevision(db);checkRevision(o.revision,revision);
  const found=db.data.sessions.find(s=>s.id===id&&(s.sessionType==='tokens')===(pool==='tokens'));if(!found)return null;
  if(o.summaryOnly)return {revision,session:summary(found),deliveryStatus:found.paddockDelivery?.status||null};
  const session=sessionValue(found),laps=db.data.laps.filter(l=>l.sessionId===id&&!!l.token===(pool==='tokens')).sort(lapOrder);
  const related=refs((...args)=>jsonGet(db,...args),laps,[session]);
  return {revision,session,laps:noMedia(o.exportAll?laps:laps.slice(o.offset,o.offset+100)),offset:o.offset,total:laps.length,figures:Stats.forSession(session,laps,related.tracks,related.slotcars),refs:related};
}
function jsonCar(db,id){const car=db.data.slotcars.find(c=>c.id===id);if(!car)return null;
  const dates=new Map(db.data.sessions.map(s=>[s.id,s.date])),tracks=new Map(db.data.tracks.map(t=>[t.id,t]));
  const wins=db.data.sessions.filter(s=>(s.standings||[]).some(r=>r.carId===id&&Stats.isWinner(s,r))).length;
  return carDetails(car,db.data.laps,tid=>tracks.get(tid),sid=>dates.get(sid),wins);
}
module.exports={referenceRequest,jsonReferences,TRACK,CAR,pick,noMedia,summary,options,checkRevision,refs,carDetails,detailOptions,lapOrder,sessionValue,jsonPage,jsonSession,jsonCar};
