'use strict';
// A cross-database import is a durable, resumable operation, never an implied
// transaction across two files. IDs and recovery generation are frozen first.
const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto'),T=require('./transfer'),hash=require('./paddock-value-hash'),A=require('./storage-activation');
const file=profile=>path.join(profile,'shared-library-import.json');
function read(profile){try{const s=fs.lstatSync(file(profile));if(!s.isFile()||s.isSymbolicLink()||s.size>64*1024*1024)throw Error('Invalid retained import journal.');const j=JSON.parse(fs.readFileSync(file(profile),'utf8'));if(j.format!=='slotforge-shared-import'||j.version!==1||hash(j.items)!==j.itemsHash||!['prepared','complete'].includes(j.phase))throw Error('Retained import changed.');return j;}catch(e){if(e.code==='ENOENT')return null;throw e;}}
async function prepare(client,profile,bundle){
 const prior=read(profile),inputHash=hash(bundle);if(prior?.phase==='prepared'){if(prior.inputHash!==inputHash)throw Error('Finish the retained import before importing another file.');return prior;}
 if(Buffer.byteLength(JSON.stringify(bundle))>48*1024*1024)throw Error('Use a complete backup for imports larger than 48 MiB.');
 const data={customFields:{}};for(const e of T.ORDER){data[e]=[];data.customFields[e]=[];}
 const counts=T.apply({data,saveNow(){}},bundle),s=await client.status(),id=randomUUID();
 const j={format:'slotforge-shared-import',version:1,phase:'prepared',id,inputHash,databaseId:s.databaseId,recoveryId:s.recoveryId,sourceId:client.installationId,items:data,itemsHash:hash(data),counts,operations:{}};
 for(const e of ['slotcars','sessions'])for(const row of data[e])j.operations[e+':'+row.id]=randomUUID();j.fields={};for(const field of data.customFields.slotcars||[])j.fields[field.id]={fieldId:'timing-field-'+hash(JSON.stringify([j.sourceId,j.id,field.id])),operationId:randomUUID()};j.orphans=randomUUID();A.publish(file(profile),j);return j;
}
async function resume(client,base,profile){
 const j=read(profile);if(!j)return null;if(j.phase==='complete')return j.counts;
 const s=await client.status();if(j.databaseId!==s.databaseId||j.recoveryId!==s.recoveryId||j.sourceId!==client.installationId)throw Error('The library changed since this import began. Its original journal is retained; it will not be imported into a restored or different database.');
 const context={databaseId:j.databaseId,recoveryId:j.recoveryId,sourceId:j.sourceId},project=require('./integration/timing-legacy/project.cjs'),carIds={};
 for(const f of j.items.customFields.slotcars||[]){const ids=j.fields?.[f.id];if(!ids)throw Error('This older import needs its custom-field migration reviewed.');await client.handle.customDefinitionWrite({...context,...ids,expectedRevision:0,legacy:{sourceId:j.sourceId,fieldId:f.id},definition:{label:f.label,type:f.type==='list'?'choice':f.type,group:f.group||'',options:f.options||[]}});}
 for(const row of j.items.slotcars){const spec=project.car(row,{raceClasses:j.items.raceclasses,databaseId:j.databaseId});spec.data.custom=Object.fromEntries(Object.entries(row.custom||{}).filter(([id])=>j.fields?.[id]).map(([id,v])=>[j.fields[id].fieldId,v===null||v===undefined?'':String(v)]));const r=await client.handle.adoptCar({...context,operationId:j.operations['slotcars:'+row.id],...spec});if(!r?.carId)throw Error('Car import acknowledgement was incomplete.');carIds[row.id]=r.carId;}
 for(const row of j.items.sessions){const laps=j.items.laps.filter(l=>l.sessionId===row.id),spec=project.session(row,laps,{databaseId:j.databaseId,carIds});await client.handle.adoptSession({...context,operationId:j.operations['sessions:'+row.id],...spec,carIds:[...new Set(laps.map(l=>carIds[l.carId]).filter(Boolean))]});}
 const known=new Set(j.items.sessions.map(s=>s.id)),orphans=j.items.laps.filter(l=>!known.has(l.sessionId));
 if(orphans.length){if(!j.orphans)throw Error('Retain this older orphan import for reconciliation.');await client.handle.adoptSession({...context,operationId:j.orphans,originalId:j.orphans,sessionId:j.orphans,bundle:null,projectionReason:'Imported original laps have no surviving session.',rawOriginal:{session:null,laps:orphans},carIds:[...new Set(orphans.map(l=>carIds[l.carId]).filter(Boolean))]});}
 for(const row of j.items.slotcars){const service=await client.handle.serviceRead({carId:carIds[row.id]});if(service.service.revision)continue;const values={};for(const k of ['lapsDriven','lapsSinceService','servicesDone'])if(Number.isSafeInteger(row[k])&&row[k]>=0)values[k]=row[k];if(row.serviceDate&&Number.isFinite(Date.parse(row.serviceDate)))values.lastServicedAt=new Date(row.serviceDate).toISOString();await client.handle.serviceWrite({...context,operationId:'service-'+j.operations['slotcars:'+row.id],action:'initialize',carId:carIds[row.id],expectedCarRevision:service.carRevision,expectedRevision:0,values});}
 // Private settings and race-recovery evidence use those same frozen IDs. Cars
 // themselves are never installed as another editable private collection.
 await base.importSharedPrepared({id:j.id,items:j.items});await client.loadAliases();
 A.publish(file(profile),{...j,phase:'complete',completedAt:new Date().toISOString()});return j.counts;
}
function applyPrivate(data,items){
 for(const e of T.ORDER){if(e==='slotcars')continue;for(const row of items[e]||[]){const old=data[e].find(x=>x.id===row.id);if(old&&hash(old)!==hash(row))throw Error('An imported item changed before recovery. Keep the import journal.');}}
 const next=structuredClone(data.customFields||{});
 for(const e of T.ORDER){if(e==='slotcars')continue;next[e]||=[];for(const field of items.customFields?.[e]||[]){const old=next[e].find(f=>f.id===field.id);if(old&&hash(old)!==hash(field))throw Error('An imported field identity conflicts.');if(!old)next[e].push(field);}}
 for(const e of T.ORDER)if(e!=='slotcars')for(const row of items[e]||[])if(!data[e].some(x=>x.id===row.id))data[e].push(structuredClone(row));data.customFields=next;
}
module.exports={read,prepare,resume,applyPrivate};
