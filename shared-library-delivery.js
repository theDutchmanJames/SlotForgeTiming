'use strict';
const {randomUUID}=require('node:crypto'),H=require('./paddock-history-write'),R=require('./paddock-rich-delivery');
const fault=(code,message)=>Object.assign(Error(message),{code});
const O=require('./shared-library-original-history');
// Uses the existing JSON/SQLite durable outbox but never the HTTP sender.
class SharedLibraryDelivery {
 constructor(client,store,{isRacing=()=>false}={}){this.client=client;this.store=store;this.isRacing=isRacing;this.running=null;this.closed=false;}
 flush(){if(this.running)return this.running;if(this.closed||this.isRacing())return Promise.resolve({deferred:true,sent:0});this.running=this.run().finally(()=>{this.running=null;});return this.running;}
 async run(){let after=0,sent=0;const state=await this.client.status();
  for(;;){const rows=await this.store.outbox(state.databaseId,{status:'pending',after,limit:50});if(!rows.length)break;
   for(const row of rows){if(this.closed||this.isRacing())return {deferred:true,sent};
    const snap=await this.store.deliverySnapshot(row.key,{engineOriginals:true});if(snap.transport!=='engine')continue;
    let attempt;try{attempt=await this.store.command({id:randomUUID(),type:'claimDelivery',deliveryKey:row.key,databaseId:state.databaseId,transport:'engine'});}catch(e){if(e.code==='DELIVERY_NOT_READY')continue;throw e;}
    try{
     if(attempt.payloadHash!==snap.payloadHash)throw fault('HISTORY_REVIEW_REQUIRED','The saved result changed while claiming delivery.');
     if(snap.guardBlocked)throw fault('HISTORY_REVIEW_REQUIRED',snap.guardBlocked);const original=O.isOriginal(snap.payload);(original?O:R).preflight(snap);
     let receipt;
     for(const op of snap.guard.operations){
      const now=await this.client.status();if(now.databaseId!==op.databaseId)throw fault('DATABASE_MISMATCH','The result belongs to another shared library.');if(now.recoveryId!==op.recoveryId)throw fault('RECOVERY_CHANGED','The library was restored. Retain this result for deliberate recovery.');
      if(op.sourceId!==this.client.installationId||!original&&op.editor.installationId!==this.client.installationId)throw fault('HISTORY_REVIEW_REQUIRED','This result belongs to another Timing installation.');
      let r;try{r=await this.client.handle.receipt({operationId:op.operationId,databaseId:op.databaseId,recoveryId:op.recoveryId});}catch(e){if(e.code!=='OPERATION_NOT_FOUND')throw e;}
      if(!r){const rawOriginal=snap.engineOriginals?.[op.operationId];if(!['withdraw','restore'].includes(op.action)&&!rawOriginal)throw fault('HISTORY_REVIEW_REQUIRED','Original race evidence is missing.');r=original?await this.client.handle.originalHistoryWrite(O.request(op,rawOriginal)):await this.client.handle.historyWrite({...op,...(rawOriginal?{rawOriginal}:{})});}
      receipt=original?O.receipt(r,op):H.receipt(r,op,R.fromOperation(op));
     }
     const applied=await this.store.command({id:randomUUID(),type:'acknowledgeDelivery',deliveryKey:row.key,attemptToken:attempt.attemptToken,receipt:(original?O:H).legacy(receipt,snap.payload),guardReceipt:receipt,checkError:original?'':H.notice(receipt)});if(applied.applied)sent++;
    }catch(e){await this.store.command({id:randomUUID(),type:'failDelivery',deliveryKey:row.key,attemptToken:attempt.attemptToken,code:String(e.code||'').slice(0,100),message:String(e.message).slice(0,2000),retryAfterMs:60000});throw e;}
   }after=rows.at(-1).sequence;
  }return {sent};
 }
 async close(){this.closed=true;await this.running;}
}
module.exports=SharedLibraryDelivery;
