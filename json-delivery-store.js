'use strict';
const crypto=require('node:crypto'),Records=require('./paddockrecords');
const {hash,checkedReceipt,TERMINAL_CODES}=require('./paddock');
const {keyOf}=require('./delivery-key');
// The JSON backend implements the same delivery command boundary as the worker.
// Only delivery metadata changes; photos, captures and unrelated rows are untouched.
class JsonDeliveryStore {
 constructor(db){this.db=db;this.keys=new Map();this.sequence=0;this.tail=Promise.resolve();}
 entries(){return [...this.db.data.sessions.filter(s=>s.paddockDelivery&&s.paddockDelivery.status!=='withdrawn').map(s=>({d:s.paddockDelivery,row:s})),...(Records.state(this.db.data).withdrawals||[]).map(d=>({d,row:null}))];}
 find(key){return this.entries().find(x=>keyOf(x.d.payload)===key);}
 async outbox(databaseId,{status='all',after=0,limit=50}={}){
  await this.db.saved();const rows=[];
  for(const {d} of this.entries()){const key=keyOf(d.payload);if(!key||d.payload.databaseId!==databaseId)continue;if(!this.keys.has(key))this.keys.set(key,++this.sequence);const sequence=this.keys.get(key);if(sequence>after&&(status==='all'||d.status===status))rows.push({key,sequence,d});}
  // Enumerate the legacy collection, but only encode payloads for this batch.
  return rows.sort((a,b)=>a.sequence-b.sequence).slice(0,limit).map(({key,sequence,d})=>({key,sequence,databaseId,status:d.status,payloadHash:hash(d.payload),leaseUntil:d.leaseUntil||0}));
 }
 deliverySnapshot(key,options={}){const x=this.find(key);if(!x)throw Error('Delivery not found.');return {key,current:true,status:x.d.status,transport:x.d.transport||'network',...(options.engineOriginals?{engineOriginals:structuredClone(x.d.engineOriginals||null)}:{}),payloadHash:hash(x.d.payload),payload:structuredClone(x.d.payload),guard:structuredClone(x.d.guard||null),guardBlocked:x.d.guardBlocked||null};}
 deliveryPayload(key,token){const d=this.find(key)?.d;if(!d||d.status!=='pending'||d.attemptToken!==token||d.leaseUntil<=Date.now())throw Error('Delivery attempt expired or was superseded.');return structuredClone(d.payload);}
 async patch(x,patch){const before=new Map(Object.keys(patch).map(k=>[k,{present:Object.hasOwn(x.d,k),value:x.d[k]}]));Object.assign(x.d,patch);if(x.row)this.db.touch(x.row);
  try{await this.db.commit();await this.db.saved();}catch(error){for(const [k,old] of before)if(old.present)x.d[k]=old.value;else delete x.d[k];if(x.row)this.db.touch(x.row);throw error;}
 }
 command(command){const p=this.tail.catch(()=>{}).then(()=>this.apply(command));this.tail=p;return p;}
 async apply(c){
  const x=this.find(c.deliveryKey),d=x?.d,p=d?.payload;
  if(c.type==='claimDelivery'){
   if(!d||d.status!=='pending'||d.leaseUntil>Date.now()||d.nextAttemptAt>Date.now())throw Object.assign(Error('Delivery is unavailable, leased or waiting to retry.'),{code:'DELIVERY_NOT_READY'});
   if((d.transport||'network')!==(c.transport||'network'))throw Error('Result transport mismatch.');
   if(p.databaseId!==c.databaseId||d.transport!=='engine'&&Records.state(this.db.data).connection?.databaseId!==c.databaseId)throw Error('Connect to the original Paddock database before sending.');
   const attemptToken=crypto.randomUUID(),leaseUntil=Date.now()+30000;await this.patch(x,{attemptToken,leaseUntil,attempts:(d.attempts||0)+1});return {attemptToken,leaseUntil,payloadHash:hash(p)};
  }
  if(c.type==='prepareDeliveryUpload'){if(!d||d.guardBlocked||d.status!=='pending'||d.attemptToken!==c.attemptToken||typeof c.attemptToken!=='string')throw Object.assign(Error('Delivery changed.'),{code:'DELIVERY_NOT_READY'});const next=require('./paddock-history-upload').prepare(d.guard,c.operationId,c.replaceUploadId);await this.patch(x,{guard:next.guard,leaseUntil:Date.now()+30000});return next.upload;}
  if(!d)return {applied:false,stale:true};
  if(c.type==='acknowledgeDelivery'||c.type==='failDelivery'){
   if(typeof c.attemptToken!=='string'||d.attemptToken!==c.attemptToken)return {applied:false,stale:true};
   if(c.type==='acknowledgeDelivery'&&d.guard){if(d.guardBlocked)throw Error(d.guardBlocked);require(d.transport==='engine'&&require('./shared-library-original-history').isOriginal(p)?'./shared-library-original-history':'./paddock-history-write').receipt(c.guardReceipt,d.guard.operations.at(-1),p);}
   const patch=c.type==='acknowledgeDelivery'?{receipt:checkedReceipt(c.receipt,p),status:'sent',error:'',receiptCheckedAt:new Date().toISOString(),receiptCheckError:c.checkError||'',...(c.guardReceipt&&d.guard?{guardReceipt:c.guardReceipt,guard:{version:1,operations:[d.guard.operations.at(-1)]}}:{}),leaseUntil:0,nextAttemptAt:0,attemptToken:null}:{status:TERMINAL_CODES.has(c.code)?'attention':'pending',error:c.message,leaseUntil:0,attemptToken:null,nextAttemptAt:Date.now()+(c.retryAfterMs||60000)};
   await this.patch(x,patch);return {applied:true};
  }
  if(c.type==='recordDeliveryCheck'){
   if(d.status!=='sent'||hash(p)!==c.expectedHash)return {applied:false,stale:true};
   await this.patch(x,c.receipt?{receipt:checkedReceipt(c.receipt,p),receiptCheckedAt:new Date().toISOString(),receiptCheckError:''}:{receiptCheckError:c.error});return {applied:true};
  }
  if(c.type==='retryDelivery'){
   if(d.leaseUntil>Date.now())throw Object.assign(Error('Delivery is leased.'),{code:'DELIVERY_NOT_READY'});
   if(!['attention','pending'].includes(d.status)||hash(p)!==c.expectedHash)throw Error('Delivery changed or needs review before retrying.');
   await this.patch(x,{status:'pending',error:'',nextAttemptAt:0,leaseUntil:0,attemptToken:null});return {pending:true};
  }
  throw Error('Unsupported delivery command.');
 }
}
module.exports=JsonDeliveryStore;
