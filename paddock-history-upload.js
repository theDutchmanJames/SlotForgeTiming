'use strict';
const {createHash,randomUUID}=require('node:crypto');
const ROOT='/v1/shared-history/uploads',CHUNK=262144,MAX=8388608;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=message=>Object.assign(Error(message),{code:'HISTORY_REVIEW_REQUIRED'});
function supported(c,kind='operation'){return (kind==='import'?c?.features?.resumableHistoricalImports===true&&c?.features?.historicalReview===true:c?.features?.resumableUploads===true)&&c.uploads===ROOT&&c.maxChunkBytes===CHUNK&&Number.isSafeInteger(c.maxUploadBytes)&&c.maxUploadBytes>0&&c.maxUploadBytes<=MAX;}
// Persisted before any transport request. The operation never changes; transport
// can get a fresh ID only after confirmed expiry/cancellation/loss of staging.
function prepare(guard,operationId,replaceUploadId,kind='operation'){
 const op=guard?.operations?.find(x=>x.operationId===operationId);if(!op)throw fail('Saved operation is missing.');
 const prior=guard.uploads?.[operationId];
 if(prior&&!replaceUploadId){verify(prior,op,kind);return {guard,upload:prior};}
 if(replaceUploadId&&prior?.manifest.uploadId!==replaceUploadId)throw fail('Upload changed while restarting transport.');
 const serialized=JSON.stringify(op),bytes=Buffer.from(serialized);if(bytes.length>MAX)throw fail('Result exceeds the 8 MiB upload limit.');
 const upload={serialized,manifest:{version:1,databaseId:op.databaseId,recoveryId:op.recoveryId,uploadId:randomUUID(),editor:op.editor,kind,byteLength:bytes.length,sha256:sha(bytes)}};
 return {guard:{...guard,uploads:{...guard.uploads,[operationId]:upload}},upload};
}
function verify(u,op,kind='operation'){
 const m=u?.manifest,b=typeof u?.serialized==='string'?Buffer.from(u.serialized):null;
 let parsed;try{parsed=JSON.parse(u.serialized);}catch{throw fail('Saved upload bytes are not valid JSON.');}
 if(!b||b.length>MAX||m?.version!==1||m.kind!==kind||!['operation','import'].includes(kind)||!(/^[A-Za-z0-9_-]{1,100}$/).test(m.uploadId)||m.databaseId!==op.databaseId||m.recoveryId!==op.recoveryId||m.byteLength!==b.length||m.sha256!==sha(b)||require('./paddock').hash(parsed)!==require('./paddock').hash(op)||require('./paddock').hash(m.editor)!==require('./paddock').hash(op.editor))throw fail('Saved upload bytes or identity changed.');
 return b;
}
function status(v,u){
 const m=u.manifest,count=Math.ceil(m.byteLength/CHUNK);
 if(v?.version!==1||['databaseId','recoveryId','uploadId','byteLength','sha256'].some(k=>v[k]!==m[k])||v.chunkBytes!==CHUNK||!['staging','committed','expired'].includes(v.state)||typeof v.expiresAt!=='string'||!Number.isFinite(Date.parse(v.expiresAt))||!Array.isArray(v.received)||v.received.length>count||new Set(v.received).size!==v.received.length||v.received.some(i=>!Number.isInteger(i)||i<0||i>=count)||v.state!=='committed'&&v.receipt!==null||v.state==='committed'&&(!v.receipt||v.received.length!==count))throw fail('Invalid resumable upload status. Saved operation retained.');
 if(v.state==='expired')throw Object.assign(Error('Upload staging expired.'),{code:'UPLOAD_EXPIRED'});
 return v;
}
async function send(call,op,prepareUpload,stopped,capability,options={}){
 const kind=options.kind||'operation';
 let u=await prepareUpload(op.operationId),renewed=false;
 const check=()=>{if(stopped())throw Object.assign(Error('History upload paused.'),{code:'DELIVERY_PAUSED'});};
 for(;;){
  const bytes=verify(u,op,kind),m=u.manifest;if(bytes.length>capability.maxUploadBytes)throw fail('Result exceeds this library’s upload limit.');
  const route=ROOT+'/'+m.uploadId,query='?recoveryId='+encodeURIComponent(m.recoveryId);let v;
  try{
   check();try{v=status(await call(route+query),u);}catch(e){if(e.code!=='UPLOAD_NOT_FOUND')throw e;check();v=status(await call(ROOT,m),u);}
   if(v.state==='committed')return v.receipt;
   for(let index=0;index<Math.ceil(bytes.length/CHUNK);index++){
    if(v.received.includes(index))continue;check();const chunk=bytes.subarray(index*CHUNK,(index+1)*CHUNK);
    v=status(await call(route+'/chunks/'+index,{version:1,databaseId:m.databaseId,recoveryId:m.recoveryId,uploadId:m.uploadId,index,sha256:sha(chunk),data:chunk.toString('base64')},undefined,undefined,'PUT'),u);
    if(v.state==='committed')return v.receipt;
    if(!v.received.includes(index))throw fail('Paddock did not retain the acknowledged chunk.');
   }
   check();v=status(await call(route+'/commit',{version:1,databaseId:m.databaseId,recoveryId:m.recoveryId,uploadId:m.uploadId,sha256:m.sha256}),u);
   if(v.state!=='committed')throw fail('Upload has not been accepted as history.');return v.receipt;
  }catch(e){
   if(!['UPLOAD_EXPIRED','UPLOAD_CANCELLED'].includes(e.code)||renewed)throw e;
   // Acceptance always wins over transport expiry. Never manufacture a new
   // operation if its original receipt exists, even after staging disappeared.
   check();try{return await call(options.lookup?options.lookup(op):require('./paddock-history-write').lookup(op));}catch(r){if(r.code!=='OPERATION_NOT_FOUND')throw r;}
   u=await prepareUpload(op.operationId,m.uploadId);renewed=true;
  }
 }
}
module.exports={ROOT,CHUNK,MAX,sha,supported,prepare,verify,status,send};
