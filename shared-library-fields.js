'use strict';
const field=f=>({...f,type:f.type==='choice'?'list':f.type==='notes'?'text':f.type==='yesno'?'list':f.type,options:f.type==='yesno'?['Yes','No']:f.options,shared:true});
const localField=(client,f)=>f.legacy?.sourceId===client.installationId?f.legacy.fieldId:f.id;
async function definitions(client){return (await client.handle.customSchema()).definitions.map(f=>({...field(f),id:localField(client,f),canonicalId:f.id}));}
async function hydrate(client,car){
 const [custom,service]=await Promise.all([client.handle.customRead({carId:car.id}),client.handle.serviceRead({carId:car.id})]);
 const ids=new Map(custom.definitions.map(f=>[f.id,localField(client,f)]));
 return {custom:Object.fromEntries(Object.entries(custom.values).map(([k,v])=>[ids.get(k)||k,v])),serviceDate:service.service.lastServicedAt||'',servicesDone:service.service.servicesDone,lapsDriven:service.service.lapsDriven,lapsSinceService:service.service.lapsSinceService};
}
async function write(client,definition,old,operationId){const s=await client.status(),r=await client.stateSave('customDefinitionWrite',{databaseId:s.databaseId,recoveryId:s.recoveryId,...(operationId?{operationId}:{}),...(old?{fieldId:old.id}:{}),expectedRevision:old?.revision||0,definition});if(r.state!=='committed')throw Error(r.error||'The field save is retained. Check Save history before repeating it.');return field(r.receipt.field);}
async function classes(base,client){const rows=await base.list('raceclasses');let offset=0,token;do{const p=await client.handle.timingRead({kind:'classes',offset,limit:100,...(token?{token}:{})});token=p.token;for(const {label} of p.rows)if(!rows.some(r=>r.name===label))rows.push({id:'shared-class-'+require('node:crypto').createHash('sha256').update(label).digest('hex'),name:label,color:'#8b86d9',icon:'flag',shared:true});offset=p.nextOffset;}while(offset!==null);return rows;}
module.exports={definitions,hydrate,write,classes};
