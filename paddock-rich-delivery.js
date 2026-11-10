'use strict';
// Local durable wrapper. This wrapper is NEVER a legacy timing HTTP payload.
// The host hashes active bundles and minimal withdrawn metadata differently.
const hash=v=>require('./paddock').hash(v);
const fail=message=>{throw Object.assign(Error(message),{code:'HISTORY_REVIEW_REQUIRED'});};
const isRich=p=>p?.format==='history-v1';
function metadata(p){return {databaseId:p.databaseId,source:{id:p.source.id},sessionId:p.sessionId,revision:p.revision,state:p.state,reason:p.state==='withdrawn'?p.reason:''};}
function tuple(p){return {revision:p.revision,contentHash:hash(p.state==='active'?p.bundle:metadata(p)),state:p.state};}
function select(db,old){
 const previous=old?.payload||old?.previousPayload;
 if(previous)return isRich(previous); // Never migrate a delivered/uncertain identity.
 if(old)return false;
 const c=db.paddock?.connection;
 return require('./paddock-rich-gate').enabled()&&c?.mode==='local'&&c.historyGuard?.richWrites===true;
}
function build(db,session,rows,old){
 require('./paddock-rich-gate').assertEnabled();
 const configurations=Object.values(session.paddockJournal?.captures||{}).map(x=>x?.configuration).filter(Boolean);
 if(!configurations.length)return null;
 const databaseId=configurations[0].databaseId;
 const {bundle}=require('./paddock-rich-mapper').measured(session,rows,databaseId);
 const previous=old?.payload||old?.previousPayload;
 if(previous&&(previous.databaseId!==databaseId||previous.sessionId!==session.id||!isRich(previous)))fail('The original rich-history identity changed.');
 const sourceId=previous?.source?.id||require('./paddockrecords').state(db).sourceId;
 return {format:'history-v1',databaseId,source:{id:sourceId},sessionId:session.id,revision:1,state:'active',reason:'',bundle};
}
function fromOperation(op){
 return {format:'history-v1',databaseId:op.databaseId,source:{id:op.sourceId},sessionId:op.sessionId,revision:(op.expected?.revision||0)+1,state:op.action==='withdraw'?'withdrawn':'active',reason:op.action==='withdraw'?op.withdrawalReason:'',bundle:op.action==='withdraw'?null:op.bundle};
}
function withdrawal(p,reason){return {...metadata(p),format:'history-v1',revision:p.revision+1,state:'withdrawn',reason,bundle:null};}
function validate(p,{localHistorical=false}={}){
 const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
 if(!isRich(p)||!id(p.databaseId)||!id(p.source?.id)||!id(p.sessionId)||!Number.isSafeInteger(p.revision)||p.revision<1||p.revision>1000000||!['active','withdrawn'].includes(p.state)||typeof p.reason!=='string'||p.reason.length>2000)fail('Invalid saved rich-history identity.');
 if(p.state==='active'){
  if(p.reason!=='')fail('Active rich-history metadata changed.');
  require('./paddock-rich-mapper').validate(p.bundle);
  if(p.bundle.provenance.kind!=='measured'&&!localHistorical)fail('Historical evidence must use Historical Review, not ordinary result delivery.');
  if(p.bundle.race.participants.some(x=>x.configuration?.kind==='current'&&x.configuration.databaseId!==p.databaseId))fail('Captured configuration belongs to another collection.');
 }else if(p.bundle!==null)fail('Withdrawal cannot contain an active bundle.');
 return p;
}
function assertTransport(p,capability){
 require('./paddock-rich-gate').assertEnabled();validate(p);
 if(!require('./paddock-history-write').capability(capability)||!capability.formats.includes('history-v1'))fail('This Paddock host does not advertise verified rich-history writes. No legacy fallback was attempted.');
}
function preflight(snapshot){
 const validation={localHistorical:snapshot.transport==='engine'},p=validate(snapshot.payload,validation),operations=snapshot.guard?.operations;
 if(snapshot.guard?.version!==1||!Array.isArray(operations)||!operations.length||operations.length>16||Buffer.byteLength(JSON.stringify(operations))>48*1024*1024)fail('Missing, unsupported or oversized rich-history operation chain.');
 const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v),seen=new Set();let previous=null;
 const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));
 for(const op of operations){
  const keys=['version','databaseId','recoveryId','operationId','editor','sourceId','sessionId','expected','reason','action',op?.action==='withdraw'?'withdrawalReason':'bundle'];
  if(!exact(op,keys)||op.version!==1||!id(op.operationId)||!id(op.recoveryId)||!exact(op.editor,['installationId','application','name'])||!id(op.editor.installationId)||!['SlotForge Timing','SlotForge Paddock'].includes(op.editor.application)||typeof op.editor.name!=='string'||op.editor.name.length>200||typeof op.reason!=='string'||op.reason.length>2000||Buffer.byteLength(JSON.stringify(op))>8*1024*1024)fail('Saved rich-history operation envelope changed.');
  if(op.expected!==null&&(!exact(op.expected,['revision','contentHash','state'])||op.expected.revision>1000000))fail('Saved rich-history expected revision changed.');
  const key=JSON.stringify([op.editor.installationId,op.operationId]);if(seen.has(key))fail('Duplicate saved rich-history operation identity.');seen.add(key);
  if(op.databaseId!==p.databaseId||op.sourceId!==p.source.id||op.sessionId!==p.sessionId||!['create','replace','withdraw'].includes(op.action)||op.action==='create'&&op.expected!==null||op.action!=='create'&&!require('./paddock-history-write').validTuple(op.expected)||op.action!=='withdraw'&&op.bundle?.format!=='history-v1'||op.action==='withdraw'&&op.bundle!==undefined)fail('Saved rich-history operation identity or format changed.');
  const value=validate(fromOperation(op),validation);
  if(previous&&(hash(op.expected)!==hash(tuple(previous))||op.recoveryId!==operations[0].recoveryId))fail('Saved rich-history predecessor or recovery identity changed.');
  previous=value;
 }
 if(hash(previous)!==hash(p))fail('Saved rich-history operation does not match the delivery snapshot.');
}
module.exports={isRich,metadata,tuple,select,build,fromOperation,withdrawal,validate,assertTransport,preflight};
