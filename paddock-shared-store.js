'use strict';
const ROOT='sharedCarOperations',POLICY='paddockLocalPolicy';
function summary(row){return {id:row.id,state:row.state,...(row.transport?{transport:row.transport}:{}),code:row.code||'',error:row.error||'',createdAt:row.createdAt,request:Object.fromEntries(['databaseId','recoveryId','action','carId'].filter(k=>row.request[k]!==undefined).map(k=>[k,row.request[k]])),...(row.receipt?{receipt:{car:{id:row.receipt.car?.id||row.receipt.carId||'',fields:{name:row.receipt.car?.fields?.name||row.receipt.field?.label||''}}}}:{})};}
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
function change(a,input){
 if(input.action==='policy'){if(typeof input.disabled!=='boolean')throw Error('Invalid local library preference.');a.policy({disabled:input.disabled});return {disabled:input.disabled};}
 if(input.action==='create'){
  const r=input.request;
  const actions=input.transport==='engine'&&r?.engineMethod==='timingSettingsWrite'?['bind','patch']:input.transport==='engine'&&['serviceWrite','customDefinitionWrite'].includes(r?.engineMethod)?['initialize','set','reset','definition']:['create','patch','archive','restore'];
  if(!r||!id(r.operationId)||!id(r.sourceId)||!id(r.databaseId)||!id(r.recoveryId)||!actions.includes(r.action)||Buffer.byteLength(JSON.stringify(r))>131072)throw Error('Invalid shared car operation.');
  if(input.transport!==undefined&&input.transport!=='engine')throw Error('Invalid shared car transport.');
  const prior=a.get(r.operationId);if(prior){if(prior.transport!==input.transport||require('./paddock').hash(prior.request)!==require('./paddock').hash(r))throw Error('Shared operation identity conflict.');return prior;}
  const row={id:r.operationId,request:structuredClone(r),...(input.transport?{transport:input.transport}:{}),state:'pending',error:'',createdAt:new Date().toISOString()};a.put(row);return row;
 }
 const row=a.get(input.operationId);if(!row)throw Error('Saved shared car operation not found.');
 if(input.action==='resolve'){if(row.state!=='blocked'||!['RECOVERY_CHANGED','RECEIPT_MISMATCH','OPERATION_CONFLICT','COMMAND_CONFLICT','CAR_MERGED','MERGE_SETTINGS_REQUIRED','SETTINGS_CONFLICT'].includes(row.code))throw Error('Only a reviewed retained outcome can be acknowledged.');const next={...row,state:'reconciled',updatedAt:new Date().toISOString()};a.put(next);return next;}
 if(input.action==='result'){
  if(row.state==='committed')return row;
  const next={...row,state:input.receipt?'committed':input.blocked?'blocked':'pending',code:input.code||'',error:String(input.error||'').slice(0,1500),...(input.receipt?{receipt:input.receipt}:{}),...(input.details?{details:input.details}:{}),updatedAt:new Date().toISOString()};a.put(next);return next;
 }
 throw Error('Unsupported shared journal operation.');
}
function sqlAdapter(s){return {
 get:id=>s.get(ROOT,id,true)?.value||null,put:row=>{const stored={...row,summary:summary(row)};return s.get(ROOT,row.id)?s.replace(ROOT,row.id,stored):s.insert(ROOT,stored);},
 policy:value=>s.replace('@meta',POLICY,value)
};}
function sqlRead(s,o){if(o.kind==='policy')return s.get('@meta',POLICY)?.value||{};if(o.kind==='get')return sqlAdapter(s).get(o.id);if(o.kind==='list')return s.statement('SELECT id FROM records WHERE entity=? ORDER BY ordinal').all(ROOT).map(x=>require('./sqlite-catalogue').read(s,ROOT,x.id,['summary'])).filter(Boolean);throw Error('Invalid shared journal read.');}
module.exports={ROOT,POLICY,change,summary,sqlRead,sqlCommand:(s,input)=>change(sqlAdapter(s),input)};
