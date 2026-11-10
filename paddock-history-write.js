'use strict';
const {randomUUID}=require('node:crypto');
const ROOT='/v1/shared-history',id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v),digest=v=>require('./paddock').hash(v);
const fault=(message,code='RECEIPT_MISMATCH')=>Object.assign(Error(message),{code});
const R=require('./paddock-rich-delivery');
const tuple=p=>R.isRich(p)?R.tuple(p):({revision:p.revision,contentHash:digest(p),state:p.state});
const same=(a,b)=>digest(a)===digest(b);
function validTuple(t){return t&&Number.isSafeInteger(t.revision)&&t.revision>0&&/^[a-f0-9]{64}$/.test(t.contentHash)&&['active','withdrawn'].includes(t.state);}
function capability(c){return c?.version===1&&c.features?.guardedWrites===true&&Array.isArray(c.formats)&&c.formats.includes('timing-v1')&&c.writeScope==='trusted-local'&&c.operations===ROOT+'/operations'&&c.receipt===ROOT+'/operations/{installationId}/{operationId}'&&c.recovery===ROOT+'/status';}
function context(v,db){if(v?.version!==1||v.databaseId!==db||!id(v.recoveryId)||!capability(v.capability))throw fault('Invalid guarded-history capability or database identity.');return {version:1,databaseId:db,recoveryId:v.recoveryId,...(v.capability.formats.includes('history-v1')?{richWrites:true}:{}),reads:require('./paddock-history-read-v1').supported(v.capability),statistics:v.capability.features.statistics===true&&v.capability.statistics==='/v1/shared-history/cars/{carId}/statistics'};}
// Called inside the same local transaction as finalisation/correction/deletion.
// Unacknowledged predecessors travel with the draft, so an offline edit cannot
// discard an operation that may already have committed on the host.
function attach(db,d,old){
 const c=db.paddock?.connection,previous=old?.guard?.operations||[],last=previous.at(-1);
 const ctx=last?{databaseId:last.databaseId,recoveryId:last.recoveryId}:c?.mode==='local'?c.historyGuard:null;
 if(!ctx||ctx.databaseId!==d.payload?.databaseId){if(old?.guard){d.guard=old.guard;d.guardBlocked='The guarded result identity needs review. Its saved operations were retained.';d.status='attention';d.error=d.guardBlocked;}return;}
 try{
  if(old?.guardBlocked)throw Error(old.guardBlocked);
  const p=d.payload,base=old?.payload||old?.previousPayload;
  if(old&&(!base||old.status!=='sent'&&!previous.length))throw Error('An earlier unguarded result is still unconfirmed. Compare its Paddock receipt before sending this correction.');
  if(base&&(R.isRich(base)!==R.isRich(p)||p.databaseId!==base.databaseId||p.source.id!==base.source.id||p.sessionId!==base.sessionId))throw Error('Changing the history format of an existing result requires a separately reviewed migration.');
  if(R.isRich(p)){require('./paddock-rich-gate').assertEnabled();R.validate(p);}
  const expected=base?tuple(base):null;
  if(old?.status==='sent')require('./paddock').checkedReceipt(old.receipt,base);
  if(p.revision!==(expected?.revision||0)+1)throw Error('The pending revision needs comparison with accepted history.');
  const operation={version:1,databaseId:p.databaseId,recoveryId:ctx.recoveryId,operationId:randomUUID(),editor:{installationId:db.paddock.sourceId,application:'SlotForge Timing',name:'Timing Race Director'},sourceId:p.source.id,sessionId:p.sessionId,expected,reason:expected?'Race Director review in Timing.':'Finalised in Timing.',action:p.state==='withdrawn'?'withdraw':expected?'replace':'create'};
  if(p.state==='withdrawn')operation.withdrawalReason=p.reason;else operation.bundle=R.isRich(p)?structuredClone(p.bundle):{format:'timing-v1',payload:structuredClone(p)};
  if(!id(operation.editor.installationId)||!id(operation.recoveryId)||Buffer.byteLength(JSON.stringify(operation))>8*1024*1024)throw Error('Guarded result exceeds the supported inline limits or has no valid recovery identity.');
  const operations=[...(old?.status==='sent'?[]:previous),operation];
  if(operations.length>16||Buffer.byteLength(JSON.stringify(operations))>48*1024*1024)throw Error('Too many unconfirmed corrections. Recover earlier deliveries before submitting further changes.');
  d.guard={version:1,operations,...(old?.status!=='sent'&&old?.guard?.uploads?{uploads:old.guard.uploads}:{})};
 }catch(e){d.guard=old?.guard||{version:1,operations:[]};d.guardBlocked=e.message;d.status='attention';d.error=e.message;if(old)d.previousPayload=old.payload||old.previousPayload||null;}
}
function payload(op,source,format){if(op.bundle?.format==='history-v1'||format==='history-v1')return R.fromOperation(op);return op.action==='withdraw'?{integrationVersion:1,databaseId:op.databaseId,source,sessionId:op.sessionId,revision:op.expected.revision+1,state:'withdrawn',reason:op.withdrawalReason}:op.bundle?.payload;}
function receipt(r,op,p){
 if(!r||r.version!==1||['databaseId','recoveryId','operationId','sourceId','sessionId'].some(k=>r[k]!==op[k])||r.status!=='committed'||r.requestHash!==digest(op)||!validTuple(r.accepted)||!same(r.accepted,tuple(p))||!(r.current===null||validTuple(r.current))||typeof r.duplicate!=='boolean'||!Number.isFinite(Date.parse(r.committedAt)))throw fault('Guarded receipt does not match the immutable saved operation. The local result was retained.');
 return r;
}
const lookup=op=>ROOT+'/operations/'+op.editor.installationId+'/'+op.operationId+'?recoveryId='+encodeURIComponent(op.recoveryId);
const legacy=(r,p)=>({ok:true,databaseId:p.databaseId,sourceId:p.source.id,sessionId:p.sessionId,...r.accepted,receivedAt:r.committedAt});
const notice=r=>same(r.accepted,r.current)?'':'Paddock now has a different accepted revision (or this result was removed). This receipt confirms the original operation only. Compare Race history before making another correction.';
async function send(call,snapshot,stopped,transport={}){
 if(snapshot.guardBlocked)throw fault(snapshot.guardBlocked,'HISTORY_REVIEW_REQUIRED');
 const operations=snapshot.guard?.operations;if(!operations?.length)throw fault('Missing saved history operation.','HISTORY_REVIEW_REQUIRED');
 if(R.isRich(snapshot.payload)){R.assertTransport(snapshot.payload,transport.capability);R.preflight(snapshot);}
 let accepted;
 for(const op of operations){
  if(op.version!==1||op.databaseId!==snapshot.payload.databaseId||op.sourceId!==snapshot.payload.source.id||op.sessionId!==snapshot.payload.sessionId||!id(op.operationId)||!id(op.editor?.installationId)||!id(op.recoveryId))throw fault('Saved history operation identity changed.','HISTORY_REVIEW_REQUIRED');
  if(stopped())throw fault('History delivery paused.','DELIVERY_PAUSED');
  const p=payload(op,snapshot.payload.source,snapshot.payload.format);
  if(R.isRich(p)!==R.isRich(snapshot.payload)||op.bundle&&op.bundle.format!==(R.isRich(p)?'history-v1':'timing-v1'))throw fault('Saved operation format changed.','HISTORY_REVIEW_REQUIRED');
  if(R.isRich(p))R.validate(p);
  let r;
  try{r=await call(lookup(op));}catch(e){if(e.code!=='OPERATION_NOT_FOUND')throw e;}
  if(!r){if(stopped())throw fault('History delivery paused.','DELIVERY_PAUSED');const U=require('./paddock-history-upload');r=transport.prepare&&U.supported(transport.capability)&&Buffer.byteLength(JSON.stringify(op))>U.CHUNK?await U.send(call,op,transport.prepare,stopped,transport.capability):await call(ROOT+'/operations',op);}
  accepted=receipt(r,op,p);
 }
 const op=operations.at(-1);receipt(accepted,op,snapshot.payload);
 let result=legacy(accepted,snapshot.payload),checkError=notice(accepted);
 if(!R.isRich(snapshot.payload)&&!checkError&&!stopped())try{result=require('./paddock').checkedReceipt(await call('/v1/timing/sessions/'+snapshot.payload.source.id+'/'+snapshot.payload.sessionId),snapshot.payload);}catch(e){checkError='Operation accepted; latest result warnings could not be checked: '+String(e.message).slice(0,1000);}
 return {receipt:result,guardReceipt:accepted,checkError};
}
module.exports={ROOT,context,capability,validTuple,attach,tuple,receipt,lookup,legacy,notice,payload,send};
