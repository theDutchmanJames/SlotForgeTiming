'use strict';
const ROOT='/v1/shared-history',ID=/^[A-Za-z0-9_-]{1,100}$/,HASH=/^[a-f0-9]{64}$/;
const text=(v,re)=>typeof v==='string'&&re.test(v),opaque=v=>typeof v==='string'&&v.length>0&&v.length<=8192&&/^[A-Za-z0-9_.-]+$/.test(v);
const check=ok=>{if(!ok)throw Object.assign(Error('Invalid shared history response or filter. Previous cached data was retained.'),{code:'HISTORY_INVALID'});};
const tuple=v=>v&&Number.isSafeInteger(v.revision)&&v.revision>0&&text(v.contentHash,HASH)&&['active','withdrawn'].includes(v.state);
function supported(c){return c?.features?.historyReads===true&&c.sessions===ROOT+'/sessions'&&c.session===ROOT+'/sessions/{sourceId}/{sessionId}'&&c.laps===ROOT+'/sessions/{sourceId}/{sessionId}/laps/{participantId}'&&c.sessionPageSize===50&&c.lapPageSize===250;}
function route(o,wire=false){
 const q=new URLSearchParams();let base=ROOT+'/sessions';
 if(o.kind==='list'||o.kind==='statistics'){
  for(const k of ['carId','sourceId','trackId','sessionId','participantId','driverId'])if(o[k]!==undefined){check(text(o[k],ID));if(k!=='carId'||o.kind==='list')q.set(k,o[k]);}
  check(!o.trackId||o.sourceId);check(!(o.sessionId||o.participantId||o.driverId)||o.kind==='statistics'&&['sourceId','sessionId','participantId','driverId'].every(k=>text(o[k],ID)));
  for(const k of ['from','to'])if(o[k]!==undefined){check(typeof o[k]==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(o[k])&&Number.isFinite(Date.parse(o[k]))&&new Date(o[k]).toISOString()===o[k].replace(/Z$/,o[k].includes('.')?'Z':'.000Z'));q.set(k,o[k]);}
  check(!o.from||!o.to||Date.parse(o.from)<Date.parse(o.to));
  if(o.kind==='list'){
   if(o.q!==undefined){check(typeof o.q==='string'&&o.q.length<=200);if(o.q)q.set('q',o.q);}
   if(o.state!==undefined){check(['all','active','withdrawn'].includes(o.state));if(o.state!=='all')q.set('state',o.state);}
   const limit=o.limit??50;check(Number.isInteger(limit)&&limit>=1&&limit<=50);q.set('limit',limit);
   if(o.page){check(opaque(o.page));q.set('page',o.page);}
  }else{
   check(text(o.carId,ID));base=ROOT+'/cars/'+o.carId+'/statistics';
   if(o.snapshot){check(opaque(o.snapshot));q.set('snapshot',o.snapshot);}
   if(o.lane!==undefined){check(Number.isInteger(o.lane)&&o.lane>=1&&o.lane<=64);q.set('lane',o.lane);}
  }
 }else{
  check(text(o.sourceId,ID)&&text(o.sessionId,ID)&&text(o.token,HASH));base+='/'+o.sourceId+'/'+o.sessionId;
  if(o.kind==='laps'){check(text(o.participantId,ID)&&Number.isSafeInteger(o.offset??0)&&(o.offset??0)>=0);base+='/laps/'+o.participantId;q.set('offset',o.offset??0);q.set('token',o.token);}
  else{check(o.kind==='head');if(!wire)q.set('token',o.token);}
 }
 return base+(q.size?'?'+q:'');
}
function validate(v,o,db){
 check(v?.version===1&&v.databaseId===db&&text(v.recoveryId,ID));
 if(o.recoveryId&&o.recoveryId!==v.recoveryId)throw Object.assign(Error('The library was restored. Refresh history before continuing.'),{code:'RECOVERY_CHANGED'});
 const H=require('./paddock-history');
 if(o.kind==='statistics'){
  check(v.carId===o.carId&&opaque(v.snapshot)&&v.cursor===v.snapshot&&(!o.snapshot||o.snapshot===v.snapshot));
  for(const k of ['acceptedSessions','historicalSessions','measuredLaps','validLaps','personalRecordLaps','trackRecordLaps','unknownDistanceLaps','overallWins','classWins','quarantinedSessions'])check(Number.isSafeInteger(v[k])&&v[k]>=0);
  for(const k of ['measuredTimeMs','distanceM'])check(Number.isFinite(v[k])&&v[k]>=0);
  for(const k of ['averageLapMs','bestPersonalLapMs','bestTrackLapMs'])check(v[k]===null||Number.isFinite(v[k])&&v[k]>0);
  check(v.manualIncluded===false&&typeof v.distanceComplete==='boolean'&&v.validLaps<=v.measuredLaps&&v.personalRecordLaps<=v.validLaps&&v.trackRecordLaps<=v.validLaps&&v.distanceComplete===(v.unknownDistanceLaps===0));return v;
 }
 if(o.kind==='list'){
  check(opaque(v.snapshot)&&v.cursor===v.snapshot&&(!o.page||!o.snapshot||o.snapshot===v.snapshot));
  // Cached values use the established renderer shape plus their wire entries.
  check(Array.isArray(v.entries)&&v.entries.length<=(o.limit??50)&&(v.nextPage===null||opaque(v.nextPage))&&(!v.nextPage||v.entries.length>0));
  for(const e of v.entries)check(e&&tuple(e.accepted)&&['timing-v1','history-v1'].includes(e.format)&&['measured','historical'].includes(e.provenance)&&(e.format!=='timing-v1'||e.provenance==='measured')&&(e.startedAt===null||typeof e.startedAt==='string'&&Number.isFinite(Date.parse(e.startedAt)))&&(e.savedAt==null||typeof e.savedAt==='string'&&Number.isFinite(Date.parse(e.savedAt))));
  const n={...v,results:v.entries.map(e=>({...e,revision:e.accepted.revision,state:e.accepted.state})),nextOffset:null,protocol:'shared'};
  H.validate({...n,snapshot:'validated',cursor:'validated'},{kind:'list'},db);return n;
 }
 check(v.sourceId===o.sourceId&&v.sessionId===o.sessionId);
 if(v.resultToken!==o.token)throw Object.assign(Error('Result changed. Refresh history to see its current revision.'),{code:'RESULT_CHANGED'});
 if(o.kind==='laps'&&v.format==='history-v1')return require('./paddock-rich-read').laps(v,o);
 if(o.kind==='laps'){check(v.format==='timing-v1'&&v.offset===(o.offset??0));return H.validate(v,{...o,protocol:undefined},db);}
 check(tuple(v.accepted)&&Array.isArray(v.lapCounts)&&v.lapCounts.every(c=>c&&text(c.participantId,ID)&&Number.isSafeInteger(c.count)&&c.count>=0));
 if(v.body?.format==='history-v1')return require('./paddock-rich-read').head(v);
 let p=v.body?.payload;
 if(v.accepted.state==='withdrawn'){check(v.body===null&&v.lapCounts.length===0);p={integrationVersion:1,databaseId:db,source:{id:o.sourceId},sessionId:o.sessionId,revision:v.accepted.revision,state:'withdrawn',reason:''};}
 else check(v.body?.format==='timing-v1'&&p?.revision===v.accepted.revision&&p?.state===v.accepted.state&&Array.isArray(p.participants)&&p.participants.every(e=>e&&text(e.id,ID)));
 const counts=v.accepted.state==='active'?p.participants.map(e=>v.lapCounts.find(c=>c.participantId===e.id)||{participantId:e.id,count:0}):[];check(new Set(v.lapCounts.map(c=>c.participantId)).size===v.lapCounts.length&&v.lapCounts.every(c=>counts.some(e=>e.participantId===c.participantId)));
 const summary=v.sessionSummary;check(!summary||summary.payloadHash===require('./paddock').hash(p));
 const n={...v,lapCounts:counts,payload:p,summaries:summary?.summaries||[],warnings:summary?.warnings||[],requiresCorrection:summary?.requiresCorrection||false,summaryCoverage:summary?'available':'unavailable',protocol:'shared'};
 return H.validate(n,{...o,protocol:undefined},db);
}
module.exports={ROOT,supported,route,validate};
