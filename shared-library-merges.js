'use strict';
// Private client qualification only. Original aliases and historical evidence
// stay in SharedLibraryClient; this projection is for current cars/settings.
const fault=(code,message)=>Object.assign(Error(message),{code});
const id=v=>typeof v==='string'&&/^[\w-]{1,100}$/.test(v);
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const number=v=>Number.isSafeInteger(v)&&v>=0;
const FIELDS=['tyreCompound','damageFactor','failureFactor','serviceInterval'];
function validFields(fields,complete=false){
 if(!fields||typeof fields!=='object'||Array.isArray(fields)||Object.keys(fields).some(k=>!FIELDS.includes(k)))return false;
 if(complete&&FIELDS.some(k=>!Object.hasOwn(fields,k)))return false;
 return Object.entries(fields).every(([k,v])=>k==='tyreCompound'?typeof v==='string'&&v.trim().length>0&&v.length<=100:v===null?(!complete||k==='serviceInterval'):typeof v==='number'&&Number.isFinite(v)&&(k==='serviceInterval'?Number.isSafeInteger(v)&&v>=1:v>=0));
}
function settings(value,{databaseId,recoveryId,sourceId,carId}){
 if(!value||value.version!==1||Object.entries({databaseId,recoveryId,sourceId,carId}).some(([k,v])=>value[k]!==v)||!id(value.bindingId)||typeof value.localCarId!=='string'||!value.localCarId||value.localCarId.length>200||!number(value.revision)||!number(value.mergeRevision)||!hash(value.bindingToken)||!validFields(value.fields)||!validFields(value.effective,true))throw fault('RECEIPT_MISMATCH','Invalid effective Timing settings binding.');
 const expected={tyreCompound:value.fields.tyreCompound??'M',damageFactor:value.fields.damageFactor??1,failureFactor:value.fields.failureFactor??1,serviceInterval:value.fields.serviceInterval??null};
 if(FIELDS.some(k=>expected[k]!==value.effective[k]))throw fault('RECEIPT_MISMATCH','Timing settings defaults do not match their stored values.');
 return value;
}
class MergeView{
 constructor(client){this.client=client;this.edges=new Map();this.generation=null;this.inflight=null;}
 async refresh(){
  if(this.inflight)return this.inflight;
  this.inflight=this.readMappings().finally(()=>{this.inflight=null;});return this.inflight;
 }
 async readMappings(){
  const c=this.client;
  for(let attempt=0;attempt<3;attempt++)try{
   const before=await c.status();
   if(this.generation&&['databaseId','recoveryId','revision'].every(k=>before[k]===this.generation[k]))return;
   const edges=new Map(),seen=new Set();let cursor,revision;
   do{
    const page=await c.handle.mergeMappings({limit:100,...(cursor?{cursor}:{})});
    if(page.databaseId!==before.databaseId||page.recoveryId!==before.recoveryId||!number(page.mergeRevision)||revision!==undefined&&page.mergeRevision!==revision)throw fault('SNAPSHOT_CHANGED','The merge mapping changed. Refresh the selection.');
    revision=page.mergeRevision;
    if(!Array.isArray(page.rows)||page.rows.length>100||page.nextCursor!==null&&(typeof page.nextCursor!=='string'||!page.nextCursor||page.nextCursor.length>2048||seen.has(page.nextCursor)))throw fault('INVALID_QUERY','Invalid merge mapping continuation.');
    for(const row of page.rows){if(!id(row.id)||!id(row.retiredCarId)||!id(row.mainCarId)||!number(row.revision)||edges.has(row.retiredCarId))throw fault('MERGE_LINEAGE_CONFLICT','Invalid merge mapping.');edges.set(row.retiredCarId,row.mainCarId);}
    cursor=page.nextCursor;if(cursor)seen.add(cursor);
   }while(cursor);
   for(const key of edges.keys())this.resolve(key,edges);
   // Also refresh immutable origin lookup after adoption, without deriving an
   // effective identity from its historical reverse map.
   const origins=await c.loadAliases({commit:false});
   const after=await c.status();if(['databaseId','recoveryId','revision'].some(k=>after[k]!==before[k]))throw fault('SNAPSHOT_CHANGED','The library changed while loading identities.');
   c.aliases=origins.aliases;c.reverse=origins.reverse;this.edges=edges;this.generation={...after,mergeRevision:revision};return;
  }catch(e){if(!['QUERY_CHANGED','SNAPSHOT_CHANGED'].includes(e.code)||attempt===2)throw e;}
 }
 resolve(carId,edges=this.edges){const seen=new Set();while(edges.has(carId)){if(seen.has(carId))throw fault('MERGE_LINEAGE_CONFLICT','Cyclic merge mapping.');seen.add(carId);carId=edges.get(carId);}return carId;}
 async binding(id){await this.refresh();const carId=this.resolve(this.client.canonicalId(id));return settings(await this.client.handle.timingSettings({sourceId:this.client.installationId,carId}),{...this.generation,sourceId:this.client.installationId,carId});}
 async assertCurrent(id){await this.refresh();const requested=this.client.canonicalId(id),canonical=this.resolve(requested);if(requested!==canonical)throw Object.assign(fault('CAR_MERGED','This selected car was merged. Select the current car before starting or saving.'),{details:{identity:await this.client.handle.carIdentity({carId:requested})}});return requested;}
}
module.exports={MergeView,settings,validFields,FIELDS};
