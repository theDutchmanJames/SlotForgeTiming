// Pure conversion and durable delivery state; kept in the same transaction as results.
const crypto=require('node:crypto');
const id=x=>String(x||'').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,100)||'unknown';
const finite=x=>Number.isFinite(Number(x))?Number(x):0;
function state(db){return db.paddock||(db.paddock={sourceId:crypto.randomUUID(),connection:null,withdrawals:[]});}
// Explanatory metadata only: the receiving app must not reapply these amounts.
// Read final reviewed totals, never sum events (which can have been undone).
function resultContext(session,heats,mapping){
  const adjustments=[];
  const amount=(participantId,kind,value,reason)=>{
    if(value===undefined||value===null||value===0)return;
    if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>1e9)throw Error('A recorded result adjustment is outside Paddock’s supported range.');
    const n=kind==='time'?Math.round(value):value;if(n)adjustments.push({participantId,kind,amount:n,reason});
  };
  for(const row of session.standings||[]){
    const participant=mapping.get(row.carId);if(!participant)continue;
    const entries=heats.flatMap(h=>h.entries.filter(e=>e.carId===row.carId));
    const exact=entries.length&&entries.every(e=>e.resultEffects&&['reviewMs','penaltyMs','pluginMs'].every(k=>typeof e.resultEffects[k]==='number'&&Number.isFinite(e.resultEffects[k])));
    const scope=heats.length>1?' across the recorded heats (elapsed-time total)':'';
    const sum=k=>entries.reduce((n,e)=>n+e.resultEffects[k],0);
    const plugin=exact?sum('pluginMs'):row.pluginTimeMs;
    amount(participant.id,'time',exact?sum('reviewMs'):row.adjMs,'Race Director time adjustment'+scope+'. Already included in classification.');
    // A single-race saved penalty includes plugin time; split it only when both
    // values are present. Do not invent time penalties from penalty-point counts.
    const penalty=exact?sum('penaltyMs'):typeof row.penalty==='number'?row.penalty-(typeof plugin==='number'?plugin:0):undefined;
    amount(participant.id,'time',penalty,'Race-system time penalty'+scope+'. Already included in classification.');
    amount(participant.id,'time',plugin,'Plugin race-rule time adjustment'+scope+'. Already included in classification.');
    amount(participant.id,'laps',row.adjLaps,'Race Director lap adjustment. Changes the classified lap count, not measured laps or distance.');
    if(row.swapLost)amount(participant.id,'laps',-row.swapLost,'Endurance driver-change lap deduction. Already included in the classified lap count.');
    // Heat points are exported by Timing. Separate championship/class awards
    // remain local and must not masquerade as points in the wire standings.
    if(typeof row.points==='number')amount(participant.id,'points',row.adjPoints,'Race Director points adjustment. Already included in the exported overall points.');
  }
  if(adjustments.length>2000)throw Error('Too many recorded adjustments for Paddock.');
  const lines=['Reviewed Timing result. Durations use whole milliseconds. Classification already includes race adjustments; do not apply them again.'];
  const text=v=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f]+/g,' ').trim():'';
  if(session.multiclass)lines.push('Class standings and class awards remain in Timing; Paddock v1 receives overall classification only.');
  if(session.scoring||session.finals)lines.push('Heat/final scoring determines position in Timing. Exported laps, elapsed time and points are recorded overall totals, not a reconstruction of the scoring formula.');
  if(session.endedBy)lines.push('Session ended: '+text(session.endedBy));
  if(session.weatherNote)lines.push('Weather: '+text(session.weatherNote));
  if(Number.isSafeInteger(session.resumed)&&session.resumed>0)lines.push('Session recovered/resumed '+session.resumed+' time(s).');
  for(const h of heats){
    if(h.endedBy&&(!session.endedBy||heats.length>1))lines.push(text(h.name)+': ended '+text(h.endedBy));
    const legacy=(session.heatResults||[]).find(r=>String(r.heat)===String(h.id));
    const weather=text(h.weatherNote||legacy?.weatherNote);
    if(weather&&weather!==text(session.weatherNote))lines.push(text(h.name)+': weather '+weather);
  }
  let notes=lines.join('\n');if(notes.length>4000){const suffix='\n[Further session context omitted; full details remain in Timing.]';notes=notes.slice(0,4000-suffix.length).replace(/[\uD800-\uDBFF]$/,'')+suffix;}
  return {adjustments,notes};
}
function build(db,session,rows){
  const j=session.paddockJournal;if(!j?.captures||!j.heats?.length)return null;
  const captures=Object.entries(j.captures).filter(([,c])=>c?.configuration);if(!captures.length)return null;
  const databaseId=captures[0][1].configuration.databaseId;
  if(captures.some(([,c])=>c.configuration.databaseId!==databaseId))throw Error('Cars from different Paddock databases cannot share a delivery.');
  const hs=j.heats.filter(h=>h.entries?.length&&h.endedAt!=null);if(!hs.length)throw Error('No captured heat timing is available.');
  const began=Math.floor(Math.min(...hs.map(h=>h.startedAt))),ended=Math.ceil(Math.max(...hs.map(h=>h.endedAt)));
  const offset=x=>Math.max(0,Math.round(x-began));
  const rowKey=(car,lane,lap,heat)=>JSON.stringify([car,lane,lap,String(heat||'')]);
  const savedRows=new Map(rows.map(r=>[rowKey(r.carId,r.lane,r.lapNumber,r.heat),r]));
  const participants=[],mapping=new Map(),lanes=j.lanes.map((length,i)=>({lane:i+1,lengthM:length>0?length:null}));
  const heats=hs.map(h=>({id:id(h.id),name:h.name,startedAtMs:offset(h.startedAt),endedAtMs:offset(h.endedAt)}));
  for(const h of hs)for(const e of h.entries){
    const key=e.carId||'unlinked-'+e.lane;
    let p=mapping.get(key);
    if(!p){const cap=j.captures[e.carId];p={id:'entry-'+participants.length,kind:'physical',carId:cap?.configuration.carId||null,configuration:cap?.configuration||null,displayName:cap?.name||e.driverName||'Guest',drivers:[],stints:[],laps:[]};mapping.set(key,p);participants.push(p);}
    let previous=offset(h.startedAt);
    const changes=[{at:h.startedAt,driverId:e.driverId,driverName:e.driverName},...(e.changes||[])].sort((a,b)=>a.at-b.at),entryStints=[];
    for(let k=0;k<changes.length;k++){const change=changes[k],driverId=id(change.driverId);
      if(!p.drivers.some(d=>d.id===driverId))p.drivers.push({id:driverId,name:String(change.driverName||'Guest').slice(0,200)});
      const stint={id:'stint-'+p.stints.length,heatId:id(h.id),driverId,lane:e.lane,startedAtMs:offset(change.at),endedAtMs:offset(changes[k+1]?.at??h.endedAt)};p.stints.push(stint);entryStints.push(stint);
    }
    for(const l of e.laps||[]){
      if(l.removed)continue;
      if(!Number.isFinite(l.at))throw Error('A lap has no original completion timestamp. Historical or manually added laps cannot be sent as measured laps.');
      const driverId=id(l.driverId),end=offset(l.at),duration=Math.max(1,Math.floor(l.time));
      if(end<previous+duration)throw Error('Captured lap timing overlaps; keep this session locally for review.');
      const active=entryStints.find(s=>s.driverId===driverId&&end>=s.startedAtMs&&end<=s.endedAtMs);
      if(!active)throw Error('A driver change has no captured stint boundary. Keep this result locally for review.');
      // A saved record can be excluded later without rewriting the measured duration.
      const saved=savedRows.get(rowKey(e.carId,e.lane,l.number,h.id))||savedRows.get(rowKey(e.carId,e.lane,l.number,''));
      p.laps.push({id:'lap-'+p.id+'-'+h.id+'-'+l.number,stintId:active.id,number:l.number,durationMs:duration,endedAtMs:end,valid:!!l.valid,pit:!!l.pit,
        recordEligible:!!l.valid&&!l.pit&&!saved?.noTrackRecord&&!saved?.noPersonalBest,countsForDistance:true,distanceM:lanes[e.lane-1]?.lengthM??null,reason:l.pit?'Pit lap':!l.valid?'Excluded by race rules':''});previous=end;
    }
  }
  if(!participants.some(p=>p.carId))return null;
  const context=resultContext(session,hs,mapping),standings=[],seen=new Set();
  for(const s of session.standings||[]){const p=mapping.get(s.carId);if(!p)continue;if(seen.has(p.id))throw Error('This car has multiple classified entries. Paddock v1 requires one classification per physical car.');seen.add(p.id);const status=s.dq?'disqualified':s.retired?'dnf':finite(s.laps)>0?'finished':'dns';standings.push({participantId:p.id,position:status==='finished'&&s.pos>0?s.pos:null,status,classifiedLaps:Math.max(0,finite(s.laps)),classifiedElapsedMs:Math.max(0,Math.round(finite(j.classifiedTimes?.[s.carId]??(finite(s.total)+context.adjustments.filter(a=>a.participantId===p.id&&a.kind==='time').reduce((n,a)=>n+a.amount,0))))),points:finite(s.points)});}
  const type=session.sessionType==='practice'?'practice':session.sessionType==='qualifying'?'qualifying':session.sessionType==='endurance'?'endurance':'race';
  return {integrationVersion:1,databaseId,source:{id:state(db).sourceId,name:'SlotForge Timing',application:'SlotForge Timing'},sessionId:session.id,revision:1,state:'active',name:String(session.setupName||'Race session').slice(0,200),type,
    startedAt:new Date(began).toISOString(),endedAt:new Date(ended).toISOString(),track:{id:id(session.trackId),name:String(session.trackName||'Track').slice(0,200),lanes},heats,participants,standings,...context};
}
function prepare(db,s,rows,old){if(s.paddockJournal?.sharedLibrary)return require('./shared-library-history').prepare(s,rows,old);try{const rich=require('./paddock-rich-delivery');const payload=rich.select(db,old)?rich.build(db,s,rows,old):build(db,s,rows);if(payload){s.paddockDelivery={payload,status:'pending',error:'',receipt:null,...(rich.isRich(payload)?{name:s.setupName||'Saved session'}:{})};require('./paddock-history-write').attach(db,s.paddockDelivery);}}catch(e){s.paddockDelivery={name:s.setupName||'Saved session',sessionId:s.id,databaseId:Object.values(s.paddockJournal?.captures||{})[0]?.configuration?.databaseId||'',status:'attention',error:e.message,payload:null,receipt:null};}}
function revise(db,s){
 if(s.paddockDelivery?.transport==='engine'||s.paddockJournal?.sharedLibrary)return require('./shared-library-history').revise(db,s);
 if(!s.paddockDelivery||s.paddockDelivery.status==='withdrawn')return;
 const old=s.paddockDelivery,candidate={...s};delete candidate.paddockDelivery;
 prepare(db,candidate,db.laps.filter(l=>l.sessionId===s.id),old);
 s.paddockDelivery=candidate.paddockDelivery||{name:s.setupName||'Saved session',sessionId:s.id,databaseId:old.payload?.databaseId||old.databaseId||'',status:'attention',error:'The original captured timing evidence is missing. Keep this draft and compare the accepted result before sending.',payload:null,receipt:null};
 if(s.paddockDelivery.payload){
  s.paddockDelivery.payload.revision=Math.max(old.payload?.revision||0,old.previousPayload?.revision||0,old.receipt?.revision||0)+1;
  delete s.paddockDelivery.guard;delete s.paddockDelivery.guardBlocked;
  require('./paddock-history-write').attach(db,s.paddockDelivery,old);
 }else{
  s.paddockDelivery.previousPayload=old.payload||old.previousPayload||null;s.paddockDelivery.receipt=old.receipt||null;
  if(old.guard){s.paddockDelivery.guard=old.guard;s.paddockDelivery.guardBlocked=s.paddockDelivery.error;}
 }
}
function withdraw(db,s,reason){if(s.paddockDelivery?.transport==='engine')return require('./shared-library-history').withdraw(db,s,reason);const d=s.paddockDelivery;if(!d||d.status==='withdrawn')return;const p=d.payload||d.previousPayload;if(!p)return;const rich=require('./paddock-rich-delivery'),next=rich.isRich(p)?rich.withdrawal(p,reason):{integrationVersion:1,databaseId:p.databaseId,source:p.source,sessionId:p.sessionId,revision:p.revision+1,state:'withdrawn',reason};const withdrawal={name:(d.name||p.name||'Saved session')+' (withdrawal)',payload:next,status:'pending',error:'',receipt:null};require('./paddock-history-write').attach(db,withdrawal,d);state(db).withdrawals.push(withdrawal);s.paddockDelivery={...d,payload:next,status:'withdrawn'};}
// Qualification candidate only: never attached to an outbox or sent automatically.
function richCandidate(session,rows,databaseId){return require('./paddock-rich-mapper').measured(session,rows,databaseId);}
module.exports={state,build,prepare,revise,withdraw,richCandidate};
