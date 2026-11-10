'use strict';
// Read-only central history. No central result is imported into Timing's measured
// laps or mileage tables: doing so would count an acknowledged race twice.
const {createHash}=require('node:crypto');
const ROOT='/v1/scalable/results',CACHE='paddockHistoryCache';
const id=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(x);
const token=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const cursor=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,512}$/.test(x);
const integer=x=>Number.isSafeInteger(x)&&x>=0;
const key=(databaseId,route)=>createHash('sha256').update(JSON.stringify([databaseId,route])).digest('hex');
function check(ok){if(!ok)throw Object.assign(Error('Invalid central history response. The previous cached page was kept.'),{code:'HISTORY_INVALID'});}
function route(o={}){
 check(o&&typeof o==='object'&&!Array.isArray(o));if(o.protocol==='shared')return require('./paddock-history-read-v1').route(o);
 if(o.kind==='list'){
  const offset=o.offset??0;check(integer(offset)&&offset<=10000000&&(!offset||cursor(o.snapshot))&&(!o.snapshot||cursor(o.snapshot)));
  return ROOT+(o.snapshot?'?offset='+offset+'&snapshot='+encodeURIComponent(o.snapshot):'');
 }
 check(id(o.sourceId)&&id(o.sessionId));const base=ROOT+'/'+o.sourceId+'/'+o.sessionId;
 check(token(o.token));
 if(o.kind==='head')return base+'?token='+o.token;
 check(o.kind==='laps'&&id(o.participantId)&&integer(o.offset??0));
 return base+'/laps/'+o.participantId+'?token='+o.token+'&offset='+(o.offset??0);
}
function validate(v,o,databaseId){
 if(o.protocol==='shared')return require('./paddock-history-read-v1').validate(v,o,databaseId);
 check(v?.version===1&&v.databaseId===databaseId);
 if(o.kind==='list'){
  check(cursor(v.snapshot)&&v.snapshot===v.cursor&&(!o.snapshot||o.snapshot===v.snapshot)&&Array.isArray(v.results)&&v.results.length<=50);
  const seen=new Set();for(const r of v.results){check(id(r.sourceId)&&id(r.sessionId)&&integer(r.revision)&&r.revision>0&&['active','withdrawn'].includes(r.state)&&typeof r.name==='string'&&r.name.length<=10000&&token(r.resultToken)&&Array.isArray(r.carIds)&&r.carIds.every(id));const k=JSON.stringify([r.sourceId,r.sessionId]);check(!seen.has(k));seen.add(k);}
  check(v.nextOffset===null||(v.results.length>0&&v.nextOffset===(o.offset??0)+v.results.length));
 }else{
  check(v.resultToken===o.token);
  if(o.kind==='head'){
   const p=v.payload;check(p?.integrationVersion===1&&p.databaseId===databaseId&&p.source?.id===o.sourceId&&p.sessionId===o.sessionId&&integer(p.revision)&&p.revision>0&&['active','withdrawn'].includes(p.state));
   if(p.state==='active'){
    check(typeof p.name==='string'&&Number.isFinite(Date.parse(p.startedAt))&&Number.isFinite(Date.parse(p.endedAt))&&id(p.track?.id)&&typeof p.track.name==='string'&&Array.isArray(p.participants)&&p.participants.length<=256&&Array.isArray(p.standings)&&Array.isArray(p.heats));
    check(Array.isArray(p.adjustments)&&typeof p.notes==='string'&&p.heats.every(h=>id(h.id)&&typeof h.name==='string'));
    const seen=new Set();for(const e of p.participants){check(id(e.id)&&!seen.has(e.id)&&['physical','virtual'].includes(e.kind)&&(e.carId===null||id(e.carId))&&typeof e.displayName==='string'&&Array.isArray(e.drivers)&&Array.isArray(e.stints)&&!Object.hasOwn(e,'laps'));seen.add(e.id);check(e.kind!=='virtual'||(e.carId===null&&e.configuration===null));for(const d of e.drivers)check(id(d.id)&&typeof d.name==='string');for(const s of e.stints)check(id(s.id)&&e.drivers.some(d=>d.id===s.driverId)&&p.heats.some(h=>h.id===s.heatId)&&integer(s.lane)&&s.lane>0);}
    check(Array.isArray(v.lapCounts)&&v.lapCounts.every(x=>seen.has(x.participantId)&&integer(x.count)));
    check(v.lapCounts.length===p.participants.length&&new Set(v.lapCounts.map(x=>x.participantId)).size===v.lapCounts.length);
    for(const s of p.standings)check(seen.has(s.participantId)&&Number.isFinite(s.classifiedLaps)&&s.classifiedLaps>=0&&Number.isFinite(s.classifiedElapsedMs)&&s.classifiedElapsedMs>=0&&(s.position===null||(integer(s.position)&&s.position>0))&&['finished','dnf','dns','disqualified'].includes(s.status));
    check(new Set(p.standings.map(s=>s.participantId)).size===p.standings.length);
   }
   check(Array.isArray(v.summaries)&&Array.isArray(v.warnings)&&typeof v.requiresCorrection==='boolean');
   check(v.warnings.every(w=>typeof w==='string'||(w&&typeof w==='object'&&(typeof w.message==='string'||typeof w.code==='string'))));
   for(const s of v.summaries){const stats=s.statistics;check(id(s.participantId)&&typeof s.included==='boolean'&&stats&&['validLaps','recordEligibleLaps','measuredTimeMs','distanceM','wins'].every(k=>Number.isFinite(stats[k])&&stats[k]>=0)&&['bestLapMs','averageLapMs'].every(k=>stats[k]===null||(Number.isFinite(stats[k])&&stats[k]>0))&&typeof stats.distanceComplete==='boolean');}
  }else{
   check(v.sourceId===o.sourceId&&v.sessionId===o.sessionId&&v.participantId===o.participantId&&integer(v.total)&&Array.isArray(v.laps)&&v.laps.length<=250);
   const offset=o.offset??0;check(offset<=v.total&&offset+v.laps.length<=v.total&&v.nextOffset===(offset+v.laps.length===v.total?null:offset+v.laps.length));check(v.nextOffset===null||v.laps.length>0);
   const seen=new Set();for(const l of v.laps){check(id(l.id)&&!seen.has(l.id)&&id(l.stintId)&&integer(l.number)&&l.number>0&&integer(l.durationMs)&&l.durationMs>0&&integer(l.endedAtMs)&&['valid','pit','recordEligible','countsForDistance'].every(k=>typeof l[k]==='boolean')&&(l.distanceM===null||(Number.isFinite(l.distanceM)&&l.distanceM>=0))&&typeof l.reason==='string');check((l.valid&&!l.pit)||!l.recordEligible);seen.add(l.id);}
  }
 }
 return v;
}
function cacheRow(databaseId,path,value){return {id:key(databaseId,path),databaseId,route:path,value,checkedAt:new Date().toISOString()};}
function matches(result,deliveries,databaseId){
 // Delivery keys include source identity: a second installation may use the same
 // session ID. Names and session IDs alone are never sufficient evidence.
 const k=require('./delivery-key').keyOf({databaseId,source:{id:result.sourceId},sessionId:result.sessionId,revision:result.revision,state:result.state});
 return deliveries.find(d=>d.key===k&&d.status==='sent'&&(d.format||'timing-v1')===(result.format||'timing-v1'))?.sessionId||null;
}
module.exports={CACHE,key,route,validate,cacheRow,matches,methods:{
 historyRead(options={kind:'list'}){
  // Existing SSE supplies hints. This local IPC query does not scan history or
  // issue a network request and does not acknowledge the remote change cursor.
  if(options?.kind==='hint')return this.connection().then(async({connection:c})=>{const sync=c?.mode==='local'?await this.storage.historySyncRead({kind:'hint',databaseId:c.databaseId}):null;return {databaseId:c?.mode==='local'?c.databaseId:null,cursor:this.localEventCursor||null,connected:!!this.code,history:sync,error:this.historySyncError||''};});
  return this.exclusive(async()=>{
  const c=(await this.connection()).connection;
  options={...options,...(!options.protocol&&c?.historyGuard?.reads?{protocol:'shared'}:{})};
  if(options.kind==='statistics'&&!c?.historyGuard?.statistics)return {available:false};
  const path=route(options);
  if(!c||c.mode!=='local')return {available:false};
  const databaseId=c.databaseId;let cached=await this.storage.historyCacheGet(key(databaseId,path));
  // The first page is initially requested without a snapshot. Returning to it
  // offline may use its snapshot-bound route, but only if the snapshots agree.
  if(!cached&&options.kind==='list'&&!(options.offset??0)&&options.snapshot){const first=await this.storage.historyCacheGet(key(databaseId,ROOT));if(first?.value.snapshot===options.snapshot)cached=first;}
  let row=cached,offline=false,warning='';
  const canRead=!!this.code&&!this.isRacing?.()&&!this.quiescing;
  if(canRead){
   try{
    const status=await this.call('/v1/status');check(status.id===databaseId);
    if(!status.permissions?.timingResults||status.capabilities?.scalable?.version!==1)throw Object.assign(Error('This library does not currently allow central history reads.'),{code:'HISTORY_UNAVAILABLE'});
    let value=validate(await this.call(options.protocol==='shared'?require('./paddock-history-read-v1').route(options,true):path,undefined,8*1024*1024),{...options,...(options.protocol==='shared'?{recoveryId:c.historyGuard?.recoveryId}:{})},databaseId);
    if(options.protocol==='shared'&&options.kind==='head'&&value.payload.state==='active'&&value.format!=='history-v1'&&!this.isRacing?.()&&!this.quiescing){
     // The new head intentionally omits legacy eligibility/quarantine summaries.
     // One bounded compatibility read preserves those established details. Never
     // mix summaries from a differently revised classification/configuration.
     try{const old=await this.call(ROOT+'/'+options.sourceId+'/'+options.sessionId,undefined,8*1024*1024);validate(old,{...options,protocol:undefined,token:old.resultToken},databaseId);if(require('./paddock').hash(old.payload)===require('./paddock').hash(value.payload)){value.sessionSummary={payloadHash:require('./paddock').hash(value.payload),summaries:old.summaries,warnings:old.warnings,requiresCorrection:old.requiresCorrection};value=validate(value,options,databaseId);}}catch(e){if(['DATABASE_MISMATCH','UNAUTHENTICATED','INSTANCE_CHANGED'].includes(e.code))throw e;}
    }
    this.active();check((await this.connection()).connection?.databaseId===databaseId);
    const next=cacheRow(databaseId,path,value);await this.storage.historyCachePut(next);row=next;
   }catch(e){
    // Never disguise a changed/deleted/revoked result as a current cached one.
    if(e.code==='RECOVERY_CHANGED')await this.ensureLocal(c);
    if(['RECOVERY_CHANGED','RESULT_CHANGED','SNAPSHOT_CHANGED','SESSION_NOT_FOUND','SESSION_WITHDRAWN','PARTICIPANT_NOT_FOUND','DATABASE_MISMATCH','HISTORY_INVALID','HISTORY_UNAVAILABLE','PERMISSION_REQUIRED','UNAUTHORIZED','FORBIDDEN'].includes(e.code)||[400,401,403,404,409].includes(e.httpStatus))throw e;
    offline=true;warning=String(e.message||'Library unavailable');
   }
  }else{offline=true;warning=this.isRacing?.()?'History refresh is paused during racing.':'Library offline. Showing previously opened pages.';}
  if(!row)return {available:true,databaseId,offline:true,warning:warning||'This page is not cached yet.',value:null};
  row={...row,value:validate(row.value,options,databaseId)};
  const localMatches=options.kind==='list'?await this.storage.historyMatches(row.value.results,databaseId):null;
  return {available:true,databaseId,offline,warning,checkedAt:row.checkedAt,value:row.value,...(localMatches?{localMatches}:{})};
 });}
}};
