'use strict';
const {randomUUID}=require('node:crypto');
const BASE='/v1/local-library',validId=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
const rejected=new Set(['CAR_WISHLIST','INVALID_OPERATION','INVALID_FIELD','RECOVERY_REQUIRED','LOCAL_WRITES_DISABLED','DATABASE_MISMATCH','RECOVERY_CHANGED','REVISION_CONFLICT','CAR_ARCHIVED','CAR_REBUILT','INSTALLED_PART_CONFLICT','CAR_NOT_FOUND','OPERATION_CONFLICT','PAYLOAD_TOO_LARGE']);
function projection(v){if(!v||!validId(v.id)||!Number.isSafeInteger(v.revision)||v.revision<1||typeof v.archived!=='boolean'||!v.fields||typeof v.fields!=='object'||Array.isArray(v.fields)||typeof v.fields.name!=='string'||v.fields.name.length>200||v.truncated!==undefined&&(!Array.isArray(v.truncated)||v.truncated.some(k=>typeof k!=='string'))||v.unparsed!==undefined&&(!v.unparsed||typeof v.unparsed!=='object'||Array.isArray(v.unparsed)))throw Object.assign(Error('Invalid shared car projection.'),{code:'RECEIPT_MISMATCH'});return v;}
function receipt(r,request){
 if(!r||r.version!==1||['databaseId','recoveryId','sourceId','operationId','action'].some(k=>r[k]!==request[k])||r.requestHash!==require('./paddock').hash(request)||!Number.isFinite(Date.parse(r.committedAt)))throw Object.assign(Error('Shared car receipt does not match the saved request.'),{code:'RECEIPT_MISMATCH'});
 if(!r.current||typeof r.current.present!=='boolean'||typeof r.current.archived!=='boolean'||!(r.current.present?Number.isSafeInteger(r.current.revision)&&r.current.revision>=1:r.current.revision===null)||typeof r.duplicate!=='boolean')throw Object.assign(Error('Invalid shared receipt state.'),{code:'RECEIPT_MISMATCH'});projection(r.car);if(request.carId&&request.carId!==r.car.id)throw Object.assign(Error('Shared car receipt changed identity.'),{code:'RECEIPT_MISMATCH'});return r;
}
module.exports={
 async sharedContext(){
  const c=(await this.connection()).connection;
  if(c?.mode!=='local'||c.automatic===false)throw Error('Connect to your car collection to edit its cars.');
  const status=await this.ensureLocal(c),cap=status.capabilities?.localLibrary?.sharedCars;
  if(!status.permissions?.sharedCars||cap?.version!==1||cap.schema!==BASE+'/car-schema'||cap.operations!==BASE+'/car-operations'||cap.car!==BASE+'/cars/{carId}')throw Error('This Paddock version does not support editing cars from Timing. Update Paddock; cached cars remain available.');
  const schema=await this.call(BASE+'/car-schema',undefined,131072);
  if(schema.databaseId!==c.databaseId||!validId(schema.recoveryId)||schema.version!==1||!schema.fields||typeof schema.fields!=='object')throw Error('Invalid shared car schema.');
  return schema;
 },
 sharedCar(id){return this.exclusive(async()=>{
  const schema=await this.sharedContext();if(id===undefined||id===null)return {schema,car:null};if(!validId(id))throw Error('Invalid car identity.');
  const result=await this.call(BASE+'/cars/'+id,undefined,131072);
  if(result.version!==1||result.databaseId!==schema.databaseId||result.recoveryId!==schema.recoveryId)throw Error('Paddock was restored while opening this car. Reload before editing.');
  projection(result);if(result.id!==id)throw Error('Paddock returned a different car.');return {schema,car:result};
 });},
 async sharedOperations(){return this.storage.sharedRead({kind:'list'});},
 sharedSave(input){return this.exclusive(async()=>{
  if(this.isRacing?.())throw Error('Finish the race before editing cars.');
  const schema=await this.sharedContext();
  if(input?.databaseId!==schema.databaseId||input.recoveryId!==schema.recoveryId)throw Error('This library was restored or changed. Reopen the car before saving. Your draft has not been sent.');
  if(!['create','patch','archive','restore'].includes(input.action))throw Error('Invalid car action.');
  const outstanding=(await this.sharedOperations()).find(x=>x.request.databaseId===schema.databaseId&&(x.state==='pending'||x.state==='blocked'&&['RECOVERY_CHANGED','RECEIPT_MISMATCH','OPERATION_CONFLICT'].includes(x.code))&&(input.action==='create'?x.request.action==='create':x.request.carId===input.carId));
  if(outstanding)throw Error('An earlier save for this car still needs attention. Open Save history to recover it before making another change.');
  const source=(await this.storage.localRead({kind:'source'}));
  const request={version:1,databaseId:schema.databaseId,recoveryId:schema.recoveryId,sourceId:source,operationId:randomUUID(),action:input.action};
  for(const k of ['carId','expectedRevision','set','clear'])if(Object.hasOwn(input,k))request[k]=input[k];
  if(Buffer.byteLength(JSON.stringify(request))>131072)throw Error('Car changes exceed the 128 KiB limit.');
  await this.storage.sharedChange({action:'create',request});
  return this.sendSharedOperation(request.operationId);
 });},
 async sendSharedOperation(id){
  const row=await this.storage.sharedRead({kind:'get',id});if(!row)throw Error('Saved operation not found.');
  if(row.transport==='engine')throw Error('This save belongs to the shared database, not a network connection.');
  if(row.state!=='pending')return row;
  const c=(await this.connection()).connection,r=row.request;
  if(c?.mode!=='local'||c.databaseId!==r.databaseId||c.automatic===false)throw Error('Reconnect this operation’s original local library.');
  let result,attemptedPost=false;
  try{
   try{result=await this.call(BASE+'/car-operations/'+r.sourceId+'/'+r.operationId,undefined,262144,r.recoveryId);}
   catch(e){if(e.code!=='OPERATION_NOT_FOUND')throw e;attemptedPost=true;result=await this.call(BASE+'/car-operations',r,262144);}
   receipt(result,r);
  }catch(e){return this.storage.sharedChange({action:'result',operationId:id,blocked:attemptedPost&&rejected.has(e.code)||['RECOVERY_CHANGED','RECEIPT_MISMATCH','OPERATION_CONFLICT'].includes(e.code),code:e.code||'NETWORK_ERROR',error:e.message,...(e.details?{details:e.details}:{})});}
  // Persist the acknowledgement before any cache refresh; cache errors cannot resend a commit.
  const saved=await this.storage.sharedChange({action:'result',operationId:id,receipt:result});this.localDirty=true;this.nextCatalogueCheck=0;return saved;
 },
 sharedResolve(id){return this.exclusive(()=>this.storage.sharedChange({action:'resolve',operationId:id}));},
 sharedRetry(id){return this.exclusive(()=>this.sendSharedOperation(id));},
 async syncSharedOperations(){
  const c=(await this.connection()).connection;if(c?.mode!=='local'||c.automatic===false)return;
  for(const row of (await this.sharedOperations()).filter(x=>x.transport!=='engine'&&x.state==='pending'&&x.request.databaseId===c.databaseId).slice(0,10)){
   if(this.isRacing?.()||this.stopped||this.quiescing)break;
   const next=await this.sendSharedOperation(row.id);if(next.state==='pending')break;
  }
 }
};
module.exports.validateReceipt=receipt;
