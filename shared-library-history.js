'use strict';
// Durable local-engine intent, created in the same transaction as Timing's
// recoverable race evidence. Never uses a network connection or activation gate.
const {randomUUID}=require('node:crypto');
const R=require('./paddock-rich-delivery'),H=require('./paddock-history-write');
const id=v=>typeof v==='string'&&/^[\w-]{1,100}$/.test(v);
function context(s){const c=s.paddockJournal?.sharedLibrary;if(c?.version!==1||!['databaseId','recoveryId','sourceId'].every(k=>id(c[k])))throw Error('Missing original shared-library race identity.');return c;}
function append(s,p,old,rawOriginal){
 const c=context(s),base=old?.payload||old?.previousPayload;
 if(base&&(!R.isRich(base)||base.databaseId!==c.databaseId||base.source.id!==c.sourceId||base.sessionId!==s.id))throw Error('The original shared result identity changed.');
 if(old?.guardBlocked)throw Error(old.guardBlocked);
 if(old&&!old.baseline&&(!base||old.transport!=='engine'||!old.guard?.operations?.length))throw Error('The earlier shared result needs recovery before correction.');
 const expected=old?.baseline?.expected||(base?R.tuple(base):null);
 if(old?.status==='sent')require('./paddock').checkedReceipt(old.receipt,base);
 p.revision=(expected?.revision||0)+1;
 const op={version:1,databaseId:c.databaseId,recoveryId:c.recoveryId,operationId:randomUUID(),editor:{installationId:c.sourceId,application:'SlotForge Timing',name:'Timing Race Director'},sourceId:c.sourceId,sessionId:s.id,expected,reason:expected?'Race Director review in Timing.':'Finalised in Timing.',action:p.state==='withdrawn'?'withdraw':expected?'replace':'create'};
 if(p.state==='withdrawn')op.withdrawalReason=p.reason;else op.bundle=structuredClone(p.bundle);
 const previous=old?.status==='sent'?[]:old?.guard?.operations||[];
 if(previous.some(o=>o.recoveryId!==c.recoveryId))throw Error('The original shared recovery generation changed.');
 const operations=[...previous,op];
 if(operations.length>16||Buffer.byteLength(JSON.stringify(operations))>48*1024*1024)throw Error('Recover pending shared results before adding more corrections.');
 const originals={...(old?.status==='sent'?{}:old?.engineOriginals),[op.operationId]:rawOriginal};
 const delivery={transport:'engine',name:s.setupName||'Saved session',payload:p,status:'pending',error:'',receipt:null,guard:{version:1,operations},engineOriginals:originals};
 R.preflight(delivery);return delivery;
}
function original(s,rows){const session=structuredClone(s);delete session.paddockDelivery;return {session,laps:structuredClone(rows)};}
function prepare(s,rows,old){
 try{const c=context(s);if(s.sessionType==='tokens'||old?.baseline?.originalOnly||require('./shared-library-original-history').isOriginal(old?.payload)){s.paddockDelivery=require('./shared-library-original-history').append(s,rows,old,'save','Corrected original race evidence in Timing.');return;}
  const historical=old?.baseline?.provenance==='historical'||old?.payload?.bundle?.provenance?.kind==='historical';
  const bundle=historical?require('./paddock-historical-evidence').nativeBundle(original(s,rows),c.databaseId,s.paddockJournal.adoptedCarIds||{}):require('./paddock-rich-mapper').measured(s,rows,c.databaseId).bundle;
  const p={format:'history-v1',databaseId:c.databaseId,source:{id:c.sourceId},sessionId:s.id,revision:1,state:'active',reason:'',bundle};
  s.paddockDelivery=append(s,p,old,original(s,rows));
 }catch(e){s.paddockDelivery={transport:'engine',name:s.setupName||'Saved session',sessionId:s.id,databaseId:s.paddockJournal?.sharedLibrary?.databaseId||'',payload:null,previousPayload:old?.payload||old?.previousPayload||null,status:'attention',error:e.message,guardBlocked:e.message,guard:old?.guard||null,engineOriginals:old?.engineOriginals||{},receipt:old?.receipt||null};}
}
function revise(db,s){prepare(s,db.laps.filter(l=>l.sessionId===s.id),s.paddockDelivery);}
function withdraw(db,s,reason){
 const old=s.paddockDelivery;if(!old||old.status==='withdrawn')return;
 const base=old.payload||old.previousPayload;
 // Never delete the only evidence for a failed/uncertain mapping.
 if(!base&&!old.baseline||old.guardBlocked)throw Error('Resolve this shared history save before deleting its local recovery evidence.');
 const prior=base||{format:'history-v1',databaseId:context(s).databaseId,source:{id:context(s).sourceId},sessionId:s.id,revision:old.baseline.expected.revision,state:old.baseline.expected.state};
 const d=old.baseline?.originalOnly||require('./shared-library-original-history').isOriginal(base)?require('./shared-library-original-history').append(s,[],old,'withdraw',reason):append(s,R.withdrawal(prior,reason),old,undefined);delete d.engineOriginals[d.guard.operations.at(-1).operationId];
 const state=require('./paddockrecords').state(db);(state.withdrawals||(state.withdrawals=[])).push(d);s.paddockDelivery={...old,status:'withdrawn'};
}
module.exports={prepare,revise,withdraw,context};
