'use strict';
// Adapt shared history to Timing's established Results and Records contract.
// Do not turn a storage provenance model into another user-facing results page.
const H=require('./history-read'),Stats=require('./renderer/stats'),C=require('./catalogue-read');
const scoped=(source,id,own)=>!id?id:source===own?id:'shared:'+JSON.stringify([source,id]);
function identity(id,own){
 if(typeof id!=='string')throw Error('Invalid session identity.');
 if(!id.startsWith('shared:'))return {sourceId:own,sessionId:id};
 let pair;try{pair=JSON.parse(id.slice(7));}catch{throw Error('Invalid session identity.');}
 if(!Array.isArray(pair)||pair.length!==2||pair.some(v=>typeof v!=='string'||!v||v.length>200))throw Error('Invalid session identity.');
 return {sourceId:pair[0],sessionId:pair[1]};
}
async function sessions(base,client,pool,cursor,localRevision,token,read){
 let lo=cursor?.localOffset??cursor?.offset??0,so=cursor?.sharedOffset??0;
 if(![lo,so].every(v=>Number.isSafeInteger(v)&&v>=0))throw Error('Invalid session page.');
 let locals=[],shared=[],localEnd=false,sharedEnd=false;
 async function localHead(){for(;;){
  if(!locals.length){if(localEnd)return null;const p=await base.historyPage(pool,{sessions:{pool,section:'sessions',revision:localRevision,offset:lo}});if(p.revision!==localRevision)throw C.stale();locals=p.sessions.items;localEnd=!p.sessions.next;if(!locals.length)return null;}
  const row=locals[0],state=await read(client,{kind:'sessionState',sourceId:client.installationId,sessionId:row.id,token});
  // A shared withdrawal must not resurrect the retained private recovery copy.
  if(state.row?.state==='withdrawn'){locals.shift();lo++;continue;}
  return row;
 }}
 async function sharedHead(){for(;;){
  if(!shared.length){if(sharedEnd)return null;const p=await read(client,{kind:'resultSessions',offset:so,limit:12,token});shared=p.rows;sharedEnd=p.nextOffset===null;if(!shared.length)return null;}
  const r=shared[0];
  if(r.sourceId===client.installationId&&await base.historySession(pool,r.sessionId,{revision:localRevision,summaryOnly:true})){shared.shift();so++;continue;}
  let s=r;
  const raw=await client.handle.extensionRead({namespace:'timing.historyOriginals',sourceId:r.sourceId,originalId:r.sessionId,selectedFields:['session']});s=raw?.value.session?{...raw.value.session,setupName:r.setupName,date:r.date||raw.value.session.date}:r;
  if((s.sessionType==='tokens')!==(pool==='tokens')){shared.shift();so++;continue;}
  return {...H.summary({...s,id:scoped(r.sourceId,r.sessionId,client.installationId)}),readOnly:true};
 }}
 const items=[];let next=null;
 for(;;){const a=await localHead(),b=await sharedHead();if(!a&&!b)break;
  if(items.length===12){next={localOffset:lo,sharedOffset:so,offset:lo+so};break;}
  if(a&&(!b||(Date.parse(a.date)||0)>=(Date.parse(b.date)||0))){items.push(a);locals.shift();lo++;}
  else{items.push(b);shared.shift();so++;}
 }
 await read(client,{kind:'resultSessions',limit:1,token});
 return {items,next};
}
async function detail(base,client,pool,id,options,revision,read){
 const {sourceId,sessionId}=identity(id,client.installationId),own=sourceId===client.installationId;
 const o=H.detailOptions(options),state=await read(client,{kind:'sessionState',sourceId,sessionId,token:revision.shared});
 const local=own?await base.historySession(pool,sessionId,{...o,revision:revision.private}):null;
 if(!state.row)return local;
 if(state.row.state!=='active')return null;
 const saved=own&&local?await base.historySession(pool,sessionId,{revision:revision.private,summaryOnly:true}):null;
 // Unsent corrections remain visible, with the existing durable delivery path.
 if(['pending','attention'].includes(saved?.deliveryStatus))return {...local,revision:JSON.stringify(revision)};
 const original=await client.handle.extensionRead({namespace:'timing.historyOriginals',sourceId,originalId:sessionId});
 let session,laps,tracks=[],cars=[],drivers=[];
 const useOriginal=original?.value.session&&(state.row.originalOnly||await currentOriginal(client,sourceId,state.row,original.value));
 if(useOriginal){
  session=H.sessionValue(original.value.session);laps=structuredClone(original.value.laps||[]);
  const lengths=original.value.session.paddockJournal?.lanes;
  if(Array.isArray(lengths))tracks=[{id:session.trackId,name:session.trackName,lanes:lengths.length,laneModifier:'measured',laneLengths:lengths}];
  if((session.sessionType==='tokens')!==(pool==='tokens'))return null;
  // Native evidence retains all Timing-specific race systems, classifications,
  // penalties, dates and optional fields; never round-trip it through rich DTOs.
  if(local){
   const current={session:H.sessionValue(local.session),laps:await allLocalLaps(base,pool,sessionId,revision.private)};
   const retained={session:H.sessionValue(original.value.session),laps:[...laps].sort(H.lapOrder)};
   await read(client,{kind:'resultSessions',limit:1,token:revision.shared});
   if(require('./paddock-value-hash')(current)===require('./paddock-value-hash')(retained))return {...local,revision:JSON.stringify(revision)};
  }
 }else{
  if(pool==='tokens')return null;
  const head=await client.handle.historyRead({kind:'detail',sourceId,sessionId});
  if(head.accepted.state!=='active')return null;
  const body=head.body,race=body.race||body.payload,classification=body.context?.classification||race.standings||[];
  session={id:sessionId,setupName:race.name,sessionType:race.type,date:body.context?.savedAt||race.startedAt||'',trackId:race.track.id,trackName:race.track.name,standings:[]};laps=[];
  const laneCount=Math.max(1,...(race.track.lanes||[]).map(l=>l.lane));
  tracks=[{id:race.track.id,name:race.track.name,lanes:laneCount,laneModifier:'measured',laneLengths:Array.from({length:laneCount},(_,i)=>race.track.lanes.find(l=>l.lane===i+1)?.lengthM??null)}];
  for(const p of race.participants){let offset=0;
   do{const page=await client.handle.historyRead({kind:'laps',sourceId,sessionId,participantId:p.id,offset,token:head.resultToken});
    for(const l of page.laps){const stint=p.stints?.find(s=>s.id===l.stintId),driverId=l.driverId??stint?.driverId;
     laps.push({id:l.originLapId||l.id,sessionId,carId:p.carId||p.id,driverId,trackId:race.track.id,lane:l.lane??stint?.lane,lapNumber:l.number,time:l.durationMs,date:session.date,invalid:l.valid!==true,pit:l.pit!==false,noPersonalBest:!(l.personalRecordEligible??l.recordEligible),noTrackRecord:!(l.trackRecordEligible??l.recordEligible)});
    }offset=page.nextOffset;
   }while(offset!==null);
   const a=classification.find(a=>a.participantId===p.id&&(!a.scope||a.scope==='overall')),d=p.drivers?.[0];
   const clean=laps.filter(l=>l.carId===(p.carId||p.id)&&!l.invalid&&!l.pit&&l.time>0);
   session.standings.push({carId:p.carId||p.id,carName:p.carName||p.displayName||'',driverId:d?.id,driverName:d?.name||p.displayName||'',pos:a?.position??null,laps:a?.laps??null,best:clean.length?clean.reduce((n,l)=>Math.min(n,l.time),Infinity):null,total:a?.elapsedMs??null,points:a?.points??null,dq:a?.status==='disqualified',retired:a?.status==='retired'});
   if(a?.scoreUnit==='points'||a?.points!=null)session.resultBy='points';
   drivers.push(...p.drivers||[]);cars.push({id:p.carId||p.id,model:p.carName||p.displayName});
  }
 }
 // Shared-only sessions retain source-scoped track/driver IDs. Never match a
 // different physical car, track or driver merely by its displayed name.
 const carIds=new Map();
 for(const cid of new Set([...session.standings.map(x=>x.carId),...laps.map(l=>l.carId)].filter(Boolean))){
  const origin=await client.handle.origin({sourceId,entity:'car',originalId:cid}),captured=original?.value.session?.paddockJournal?.captures?.[cid]?.configuration?.carId;carIds.set(cid,client.localId(origin?.carId||captured||cid));
 }
 const mapCar=cid=>carIds.get(cid)||cid,mapId=v=>scoped(sourceId,v,client.installationId);
 for(const row of session.standings){cars.push({id:row.carId,model:row.carName||''});drivers.push({id:row.driverId,name:row.driverName||''});row.carId=mapCar(row.carId);row.driverId=mapId(row.driverId);}
 session={...session,id,trackId:mapId(session.trackId),readOnly:true};
 laps=laps.map(l=>({...l,id:mapId(l.id),sessionId:id,trackId:mapId(l.trackId),driverId:mapId(l.driverId),carId:mapCar(l.carId)})).sort(H.lapOrder);
 tracks=tracks.map(t=>({...t,id:mapId(t.id)}));cars=cars.map(c=>({...c,id:mapCar(c.id)}));drivers=drivers.map(d=>({...d,id:mapId(d.id)}));
 if(own){const related=await base.historyReferences([{entity:'tracks',id:session.trackId||''},...[...new Set(laps.map(l=>l.carId).filter(Boolean))].map(id=>({entity:'slotcars',id}))]);if(related[0])tracks=[related[0]];cars.push(...related.slice(1).filter(Boolean));}
 if(!tracks.length&&session.trackId)tracks=[{id:session.trackId,name:session.trackName||''}];
 const refs={tracks,cars,slotcars:cars,drivers,sessions:[{id,setupName:session.setupName}]};
 await read(client,{kind:'resultSessions',limit:1,token:revision.shared});
 const privateCheck=await base.historyPage(pool);if(privateCheck.revision!==revision.private)throw C.stale();
 return {revision:JSON.stringify(revision),session,laps:o.exportAll?laps:laps.slice(o.offset,o.offset+100),offset:o.offset,total:laps.length,figures:Stats.forSession(session,laps,tracks,cars),refs};
}
async function allLocalLaps(base,pool,id,revision){const d=await base.historySession(pool,id,{revision,exportAll:true});return d?.laps||[];}
async function currentOriginal(client,sourceId,state,raw){
 // A peer may correct the accepted result without replacing Timing's native
 // companion. Never let that older companion overwrite the current result.
 const carIds={};for(const id of new Set((raw.laps||[]).map(l=>l.carId).filter(Boolean))){const origin=await client.handle.origin({sourceId,entity:'car',originalId:id});if(origin?.carId)carIds[id]=origin.carId;}
 try{
  const databaseId=(await client.status()).databaseId;
  const bundle=state.provenance==='historical'?require('./paddock-historical-evidence').nativeBundle(raw,databaseId,carIds):require('./paddock-rich-mapper').measured(raw.session,raw.laps,databaseId).bundle;
  return require('./paddock-value-hash')(bundle)===state.contentHash;
 }catch{return false;}
}
module.exports={sessions,detail,identity};
