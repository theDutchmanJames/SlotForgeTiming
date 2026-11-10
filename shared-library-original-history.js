'use strict';
// Exact unsupported session evidence in the common file. This is deliberately
// separate from measured history: no record eligibility or mileage is inferred.
const hash=require('./paddock-value-hash'),{randomUUID}=require('node:crypto');
const isOriginal=p=>p?.format==='original-history-v1';
const fail=message=>{throw Object.assign(Error(message),{code:'HISTORY_REVIEW_REQUIRED'});};
function request(op,rawOriginal){const {requestHash,contentHash,...input}=op;return {...input,...(rawOriginal?{rawOriginal}:{})};}
function payload(op){return {format:'original-history-v1',databaseId:op.databaseId,source:{id:op.sourceId},originalId:op.originalId,sessionId:op.sessionId,revision:op.expectedRevision+1,state:op.action==='withdraw'?'withdrawn':'active',contentHash:op.contentHash};}
function append(s,rows,old,action,reason){
 const c=require('./shared-library-history').context(s),prior=old?.payload||old?.previousPayload||(old?.baseline?.originalOnly?{format:'original-history-v1',databaseId:c.databaseId,source:{id:c.sourceId},sessionId:s.id,originalId:s.id,...old.baseline.expected}:null);
 if(old&&(old.transport!=='engine'||!isOriginal(prior)||old.guardBlocked))fail('Recover the earlier original history operation first.');
 if(prior&&(prior.databaseId!==c.databaseId||prior.source.id!==c.sourceId||prior.sessionId!==s.id||prior.originalId!==s.id))fail('Original history identity changed.');
 if(old?.status==='sent'){require('./paddock').checkedReceipt(old.receipt,prior);receipt(old.guardReceipt,old.guard.operations.at(-1),prior);}
 const rawOriginal=action==='withdraw'?null:(()=>{const session=structuredClone(s);delete session.paddockDelivery;return {session,laps:structuredClone(rows)};})();
 const op={databaseId:c.databaseId,recoveryId:c.recoveryId,sourceId:c.sourceId,originalId:s.id,sessionId:s.id,operationId:randomUUID(),action:action==='withdraw'?'withdraw':prior?'replace':'create',expectedRevision:prior?.revision||0,reason};
 if(rawOriginal){const used=new Set([...rows,...(s.standings||[])].map(x=>x.carId).filter(Boolean));op.carIds=[...new Set([...Object.entries(s.paddockJournal?.captures||{}).filter(([id])=>used.has(id)).map(([,x])=>x.configuration?.carId),...Object.entries(s.paddockJournal?.adoptedCarIds||{}).filter(([id])=>used.has(id)).map(([,id])=>id)].filter(Boolean))];op.projectionReason=old?.baseline?.projectionReason||'Unsupported session preserved in its original Timing format; excluded from measured collection statistics.';}
 op.contentHash=rawOriginal?hash(rawOriginal):prior.contentHash;op.requestHash=hash(request(op,rawOriginal));
 const operations=[...(old?.status==='sent'?[]:old?.guard?.operations||[]),op],engineOriginals={...(old?.status==='sent'?{}:old?.engineOriginals),...(rawOriginal?{[op.operationId]:rawOriginal}:{})};
 const result={transport:'engine',name:s.setupName||'Original session',payload:payload(op),guard:{version:1,operations},engineOriginals,status:'pending',error:'',receipt:null};preflight(result);return result;
}
function preflight(s){
 if(s.transport!=='engine'||!isOriginal(s.payload)||s.guardBlocked||s.guard?.version!==1||!Array.isArray(s.guard.operations)||!s.guard.operations.length||s.guard.operations.length>16)fail('Invalid original history save.');
 let previous=null;const seen=new Set();
 for(const op of s.guard.operations){
  if(!['create','replace','withdraw','restore'].includes(op.action)||!Number.isSafeInteger(op.expectedRevision)||op.expectedRevision<0||seen.has(op.operationId)||['databaseId','sessionId','originalId'].some(k=>op[k]!==s.payload[k])||op.sourceId!==s.payload.source.id||!/^[a-f0-9]{64}$/.test(op.contentHash||''))fail('Original history operation identity changed.');
  seen.add(op.operationId);const raw=s.engineOriginals?.[op.operationId];
  if(['create','replace'].includes(op.action)&&(!raw||hash(raw)!==op.contentHash)||hash(request(op,raw))!==op.requestHash)fail('Original history evidence changed.');
  if(previous&&(op.expectedRevision!==previous.expectedRevision+1||op.recoveryId!==previous.recoveryId))fail('Original history predecessor changed.');previous=op;
 }
 if(hash(payload(previous))!==hash(s.payload)||Buffer.byteLength(JSON.stringify(s.engineOriginals))>200*1024*1024)fail('Original history snapshot changed or is too large.');
}
function receipt(r,op,p=payload(op)){
 if(!r||r.status!=='committed'||r.originalOnly!==true||['databaseId','recoveryId','sourceId','originalId','sessionId','operationId','action','requestHash'].some(k=>r[k]!==op[k])||r.accepted?.revision!==p.revision||r.accepted.state!==p.state||r.accepted.contentHash!==p.contentHash)throw Object.assign(Error('The original history receipt does not match the retained evidence.'),{code:'RECEIPT_MISMATCH'});return r;
}
const legacy=(r,p)=>({ok:true,databaseId:p.databaseId,sourceId:p.source.id,sessionId:p.sessionId,revision:p.revision,state:p.state,contentHash:hash(p)});
module.exports={isOriginal,request,payload,append,preflight,receipt,legacy};
