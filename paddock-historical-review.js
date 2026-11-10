'use strict';
const S=require('./paddock-historical-store');
const blocked=new Set(['RECOVERY_CHANGED','DATABASE_MISMATCH','OPERATION_CONFLICT','RECEIPT_MISMATCH','INVALID_PAYLOAD','PAYLOAD_TOO_LARGE','UNSUPPORTED_COVERAGE','HISTORY_REVIEW_REQUIRED','UPLOAD_CONFLICT','CHUNK_CONFLICT','HASH_MISMATCH']);
const stopped=p=>p.stopped||p.quiescing||p.isRacing?.();
const methods={
 historicalReview(o={}){
  if(o.action==='list')return this.storage.historicalRead({kind:'list'});
  return this.exclusive(async()=>{
   if(stopped(this))throw Error('Finish the race before submitting or changing historical evidence.');
   if(o.action==='preview'||o.action==='submit'){
    const c=(await this.connection()).connection;if(c?.mode!=='local'||c.automatic===false)throw Error('Connect to the local car collection first.');
    await this.ensureLocal(c);
    if(this.historyCapability?.features?.historicalReview!==true)throw Error('This Paddock version does not support Historical Review. Update Paddock; your saved sessions remain unchanged.');
    if(o.action==='preview')return {...await this.storage.historicalRead({kind:'preview',sessionId:o.sessionId}),approvalEnabled:this.historyCapability?.features?.historicalImports===true};
    const row=await this.storage.historicalChange({...o,action:'create'});return this.sendHistoricalReview(row.id);
   }
   if(o.action==='cancel')await this.storage.historicalChange({action:'cancel',id:o.id});
   else if(o.action!=='refresh')throw Error('Invalid historical review action.');
   const c=(await this.connection()).connection;if(c?.mode!=='local')throw Error('Reconnect the original local collection.');await this.ensureLocal(c);
   return this.sendHistoricalReview(o.id);
  });
 },
 async sendHistoricalReview(id){
  const row=await this.storage.historicalRead({kind:'get',id});if(!row)throw Error('Historical submission not found.');
  if(row.state==='blocked'||row.state==='complete')return S.summary(row);
  const c=(await this.connection()).connection,q=row.request;
  if(c?.mode!=='local'||c.automatic===false||c.databaseId!==q.databaseId)throw Error('Reconnect this submission’s original collection.');
  const route=S.BASE+'/'+q.editor.installationId+'/'+q.operationId;
  try{
   if(stopped(this))return S.summary(row);
   if(this.historyCapability?.features?.historicalReview!==true)throw Error('Historical Review is unavailable on this host. The original submission remains saved.');
   let r;try{r=await this.call(route+'?recoveryId='+encodeURIComponent(q.recoveryId),undefined,131072);}catch(e){if(e.code!=='OPERATION_NOT_FOUND')throw e;}
   if(!r){
    if(row.receipt)throw Object.assign(Error('The previously received submission disappeared. Review the collection before retrying.'),{code:'RECEIPT_MISMATCH'});
    if(stopped(this))return S.summary(row);
    // Even an uncertain cancelled submission is looked up/received with its
    // original identity before cancellation. Never abandon a lost acknowledgement.
    const frozen=await this.storage.historicalRead({kind:'get',id,full:true});
    if(require('./paddock').hash(frozen.request)!==row.requestHash||require('./paddock').hash(frozen.evidence)!==q.items[0].originHash)throw Object.assign(Error('Saved evidence integrity check failed.'),{code:'RECEIPT_MISMATCH'});
    const U=require('./paddock-history-upload');
    if(row.cancelRequested&&row.uploadManifest){
     const m=row.uploadManifest;U.verify(frozen.upload,frozen.request,'import');
     if(require('./paddock').hash(m)!==require('./paddock').hash(frozen.upload.manifest))throw Object.assign(Error('Saved upload identity changed.'),{code:'RECEIPT_MISMATCH'});
     try{
      const cancelled=await this.call(U.ROOT+'/'+m.uploadId+'?recoveryId='+encodeURIComponent(m.recoveryId),undefined,131072,undefined,'DELETE');
      if(cancelled?.version!==1||cancelled.cancelled!==true||['databaseId','recoveryId','uploadId'].some(k=>cancelled[k]!==m[k]))throw Object.assign(Error('Invalid upload cancellation receipt.'),{code:'RECEIPT_MISMATCH'});
      return await this.storage.historicalChange({action:'transportCancelled',id});
     }catch(e){
      if(!['UPLOAD_COMMITTED','UPLOAD_NOT_FOUND','UPLOAD_EXPIRED','UPLOAD_CANCELLED'].includes(e.code))throw e;
      // Resolve a lost commit before treating cancelled/expired staging as local-only.
      try{r=await this.call(route+'?recoveryId='+encodeURIComponent(q.recoveryId),undefined,131072);}catch(lookup){
       if(lookup.code!=='OPERATION_NOT_FOUND'||e.code==='UPLOAD_COMMITTED')throw lookup;
       return await this.storage.historicalChange({action:'transportCancelled',id});
      }
     }
    }
    if(!r){
     const call=(path,body,limit,recovery,method)=>this.call(path,body,limit||131072,recovery,method);
     r=U.supported(this.historyCapability,'import')&&Buffer.byteLength(JSON.stringify(frozen.request))>U.CHUNK
      ?await U.send(call,frozen.request,(_operationId,replaceUploadId)=>this.storage.historicalChange({action:'upload',id,...(replaceUploadId?{replaceUploadId}:{})}),()=>stopped(this),this.historyCapability,{kind:'import',lookup:()=>route+'?recoveryId='+encodeURIComponent(q.recoveryId)})
      :await this.call(S.BASE,frozen.request,131072);
    }
   }
   await this.storage.historicalRead({kind:'verifyReceipt',id,receipt:r});
   if(row.cancelRequested&&r.items.some(i=>i.status==='pending')&&!stopped(this)){
    // Keep newly observed approval/rejection decisions even if cancellation loses its reply.
    await this.storage.historicalChange({action:'result',id,receipt:r});
    const cancel={version:1,databaseId:q.databaseId,recoveryId:q.recoveryId,operationId:q.operationId,itemIds:r.items.filter(i=>i.status==='pending').map(i=>i.itemId)};
    r=await this.call(route+'/cancel',cancel,131072);await this.storage.historicalRead({kind:'verifyReceipt',id,receipt:r});
   }
   return await this.storage.historicalChange({action:'result',id,receipt:r});
  }catch(e){return this.storage.historicalChange({action:'result',id,error:e.message,code:e.code||'NETWORK_ERROR',blocked:blocked.has(e.code)});}
 },
 async syncHistoricalReviews(){
  const c=(await this.connection()).connection;if(stopped(this)||c?.mode!=='local'||c.automatic===false)return;
  const row=(await this.storage.historicalRead({kind:'list'})).filter(r=>['queued','pending'].includes(r.state)&&r.databaseId===c.databaseId&&r.nextAttempt<=Date.now()).sort((a,b)=>a.nextAttempt-b.nextAttempt)[0];
  if(row)await this.sendHistoricalReview(row.id);
 }
};
module.exports={methods};
