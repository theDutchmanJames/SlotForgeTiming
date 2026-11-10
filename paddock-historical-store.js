'use strict';
const E=require('./paddock-historical-evidence'),{randomUUID}=require('node:crypto');
const ROOT='paddockHistoricalImports',BASE='/v1/shared-history/imports';
function summary(r){return {id:r.id,databaseId:r.request.databaseId,recoveryId:r.request.recoveryId,name:r.name,migrationId:r.migrationId||null,originHash:r.request.items[0].originHash,sessionId:r.request.items[0].sessionId,createdAt:r.createdAt,checkedAt:r.checkedAt||null,state:r.state,error:r.error||'',code:r.code||'',cancelRequested:!!r.cancelRequested,nextAttempt:r.nextAttempt||0,items:r.receipt?.items||r.request.items.map(i=>({itemId:i.itemId,sourceId:i.sourceId,sessionId:i.sessionId,status:r.transportCancelled?'cancelled':'queued',accepted:null,message:r.transportCancelled?'Upload cancelled before delivery to Review.':'Saved locally; receipt not confirmed.'}))};}
function receipt(r,q,requestHash=E.hash(q),bundleHashes){
 const bad=()=>{throw Object.assign(Error('Historical Review receipt does not match the frozen submission. Original evidence is retained.'),{code:'RECEIPT_MISMATCH'});};
 const tuple=v=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===3&&Number.isInteger(v.revision)&&v.revision>=1&&v.revision<=1000000&&typeof v.contentHash==='string'&&/^[a-f0-9]{64}$/.test(v.contentHash)&&['active','withdrawn'].includes(v.state);
 if(!r||r.version!==1||['databaseId','recoveryId','operationId'].some(k=>r[k]!==q[k])||r.requestHash!==requestHash||!Array.isArray(r.items)||r.items.length!==q.items.length)bad();
 r.items.forEach((v,n)=>{
  const i=q.items[n];if(!v||['itemId','sourceId','sessionId'].some(k=>v[k]!==i[k])||!['pending','approved','rejected','cancelled','conflict'].includes(v.status)||typeof v.message!=='string'||v.message.length>2000)bad();
  if(v.status==='approved'){
   // Reading a verified owner decision never grants Timing approval authority.
   // Lightweight journals carry hashes computed from the frozen request at creation.
   const expected=bundleHashes?.[n]||(i.bundle&&E.hash(q)===requestHash?E.hash(i.bundle):null);
   if(!expected||!tuple(v.accepted)||v.accepted.revision!==1||v.accepted.state!=='active'||v.accepted.contentHash!==expected)bad();
  }else if(v.status==='conflict'){if(v.accepted!==null&&!tuple(v.accepted))bad();}
  else if(v.accepted!==null)bad();
 });
 return structuredClone(r);
}
function decision(a,row,value){
 let hashes=row.bundleHashes;
 const bad=message=>{throw Object.assign(Error(message),{code:'RECEIPT_MISMATCH'});};
 if(hashes!==undefined&&(!Array.isArray(hashes)||hashes.length!==row.request.items.length||hashes.some(h=>typeof h!=='string'||!/^[a-f0-9]{64}$/.test(h))))bad('Saved historical bundle hashes changed. Original evidence was retained.');
 if(Array.isArray(value?.items)&&value.items.some(i=>i?.status==='approved')&&!hashes){
  // Upgrade old journals lazily, from their original frozen request only.
  const full=a.get(row.id,true);
  if(!full?.request||!Array.isArray(full.request.items)||full.request.items.some(i=>i.bundle?.format!=='history-v1')||E.hash(full.request)!==row.requestHash)bad('Saved historical request changed. Approval cannot be verified.');
  hashes=full.request.items.map(i=>E.hash(i.bundle));
 }
 const r=receipt(value,row.request,row.requestHash,hashes);
 if(row.receipt){receipt(row.receipt,row.request,row.requestHash,hashes);r.items.forEach((item,n)=>{
  const prior=row.receipt.items[n];
  if(prior.status!=='pending'&&(item.status!==prior.status||E.hash(item.accepted)!==E.hash(prior.accepted)))throw Object.assign(Error('A completed historical decision changed. The original receipt was retained.'),{code:'RECEIPT_MISMATCH'});
 });}
 return {receipt:r,...(hashes?{bundleHashes:hashes}:{})};
}
function read(a,o){
 if(o.kind==='list')return a.list();
 if(o.kind==='verifyReceipt'){if(!E.id(o.id))throw Error('Invalid historical submission identity.');const row=a.get(o.id);if(!row)throw Error('Historical submission not found.');return decision(a,row,o.receipt).receipt;}
 if(o.kind==='get'){if(!E.id(o.id))throw Error('Invalid historical submission identity.');return a.get(o.id,o.full===true);}
 if(o.kind==='preview'){const c=a.connection();if(c?.mode!=='local')throw Error('Connect to the local car collection first.');const e=a.evidence(o.sessionId);const p=E.preview(e,c.databaseId,o.migrationId?a.mappings(o.migrationId):undefined);delete p.bundle;return {...p,collectionName:c.name||c.databaseId,databaseId:c.databaseId,recoveryId:c.historyGuard?.recoveryId};}
 throw Error('Invalid historical review read.');
}
function change(a,o){
 if(o.action==='create'){
  const c=a.connection();if(c?.mode!=='local'||c.automatic===false||c.databaseId!==o.databaseId||c.historyGuard?.recoveryId!==o.recoveryId||!E.id(o.recoveryId)||!E.id(a.source()))throw Error('The collection changed. Preview this session again.');
  const prior=a.list().find(r=>r.databaseId===c.databaseId&&r.sessionId===o.sessionId&&(r.state!=='complete'||r.originHash===o.originHash||r.items?.some(i=>i.status==='approved')));if(prior)throw Error('This session already has a retained historical submission. Use its status and recovery controls; it will not be duplicated.');
  const reviewedCars=o.migrationId?a.mappings(o.migrationId):undefined;const evidence=a.evidence(o.sessionId),p=E.preview(evidence,c.databaseId,reviewedCars);if(p.originHash!==o.originHash)throw Error('The session changed since preview. Reopen the preview; nothing was sent.');
  const request={version:1,databaseId:c.databaseId,recoveryId:o.recoveryId,operationId:randomUUID(),editor:{installationId:a.source(),application:'SlotForge Timing',name:'Timing Race Director'},items:[{itemId:randomUUID(),sourceId:a.source(),sessionId:o.sessionId,originHash:p.originHash,bundle:p.bundle}]};
  if(Buffer.byteLength(JSON.stringify(request))>8*1024*1024)throw Error('This historical submission exceeds Paddock’s 8 MiB limit. The session remains local.');
  const identity={...request,items:request.items.map(({bundle,...i})=>i)};
  const row={id:request.operationId,name:p.name,request,identity,requestHash:E.hash(request),bundleHashes:request.items.map(i=>E.hash(i.bundle)),evidence,...(o.migrationId?{migrationId:o.migrationId,reviewedCars}:{}),state:'queued',createdAt:new Date().toISOString(),nextAttempt:0};a.put(row);return summary(row);
 }
 if(!E.id(o.id))throw Error('Invalid historical submission identity.');const row=a.get(o.id);if(!row)throw Error('Historical submission not found.');
 if(o.action==='upload'){
  if(row.state!=='queued'||row.cancelRequested)throw Error('This submission cannot start an upload.');
  const full=a.get(o.id,true),U=require('./paddock-history-upload');
  if(E.hash(full.request)!==row.requestHash||E.hash(full.evidence)!==row.request.items[0].originHash)throw Error('Saved historical evidence changed.');
  const upload=U.prepare({operations:[full.request],uploads:{[o.id]:full.upload}},o.id,o.replaceUploadId,'import').upload;
  a.put({...row,upload,uploadManifest:upload.manifest});return upload;
 }
 if(o.action==='transportCancelled'){
  if(!row.cancelRequested||row.receipt||row.state==='blocked')throw Error('Upload cancellation is not eligible.');
  const next={...row,transportCancelled:true,state:'complete',error:'',code:'',checkedAt:new Date().toISOString()};a.put(next);return summary(next);
 }
 if(o.action==='cancel'){if(row.state==='blocked')throw Error('Resolve the collection/recovery mismatch before cancelling in Paddock.');if(row.state==='complete')return summary(row);a.put({...row,cancelRequested:true,nextAttempt:0});return summary({...row,cancelRequested:true});}
 if(o.action==='result'){
  const verified=o.receipt?decision(a,row,o.receipt):null,r=verified?.receipt;
  const next={...row,...(r?{...verified,checkedAt:new Date().toISOString()}:{}),state:r?r.items.some(i=>i.status==='pending')?'pending':'complete':o.blocked?'blocked':row.state,error:String(o.error||'').slice(0,1500),code:o.code||'',nextAttempt:Date.now()+60000};
  a.put(next);return summary(next);
 }
 throw Error('Invalid historical review mutation.');
}
function sqlAdapter(s){const C=require('./sqlite-catalogue');return {
 mappings:id=>{const M=require('./paddock-collection-store');return M.mappings(M.sqlAdapter(s),id);},
 connection:()=>C.read(s,'@meta','paddock',['connection']),source:()=>C.read(s,'@meta','paddock',['sourceId']),
 evidence:sessionId=>{
  if(!E.id(sessionId))throw Error('Invalid session identity.');
  // Only the selected session and indexed laps are hydrated. No catalogue/media scan.
  const ids=s.statement("SELECT l.id FROM lap_index l JOIN records r ON r.entity='laps' AND r.id=l.id WHERE l.sessionId=? ORDER BY r.ordinal LIMIT 50001").all(sessionId);
  if(ids.length>50000)throw Error('Historical Review supports at most 50,000 laps per session.');
  const bytes=s.statement("SELECT COALESCE(SUM(length(CAST(json AS BLOB))),0) n FROM fields WHERE entity='sessions' AND id=?").get(sessionId).n+s.statement("SELECT COALESCE(SUM(length(CAST(f.json AS BLOB))),0) n FROM lap_index l JOIN fields f ON f.entity='laps' AND f.id=l.id WHERE l.sessionId=?").get(sessionId).n;
  if(bytes>48*1024*1024)throw Error('The original evidence exceeds the 48 MiB local journal limit.');
  return E.capture(s.get('sessions',sessionId,true)?.value,ids.map(r=>s.get('laps',r.id,true).value));
 },
 list:()=>s.statement('SELECT id FROM records WHERE entity=? ORDER BY ordinal DESC').all(ROOT).map(r=>C.read(s,ROOT,r.id,['summary'])),
 get:(id,full=false)=>{if(full)return s.get(ROOT,id,true)?.value||null;if(!s.statement('SELECT 1 FROM records WHERE entity=? AND id=?').get(ROOT,id))return null;const row={};for(const key of ['id','name','migrationId','identity','requestHash','bundleHashes','state','createdAt','nextAttempt','checkedAt','receipt','cancelRequested','error','code','uploadManifest','transportCancelled']){const v=C.read(s,ROOT,id,[key]);if(v!==undefined)row[key]=v;}row.request=row.identity;return row;},
 put:row=>{if(row.evidence)return s.insert(ROOT,{...row,summary:summary(row)});for(const key of ['bundleHashes','state','nextAttempt','checkedAt','receipt','cancelRequested','error','code','upload','uploadManifest','transportCancelled'])if(Object.hasOwn(row,key))require('./sqlite-records').setPath(s,ROOT,row.id,[key],row[key]);require('./sqlite-records').setPath(s,ROOT,row.id,['summary'],summary(row));}

};}
module.exports={ROOT,BASE,summary,receipt,read,change,sqlAdapter};
