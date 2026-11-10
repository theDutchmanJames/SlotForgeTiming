'use strict';
const hash=require('./paddock-value-hash');
function evidence(session,laps){const s=structuredClone(session);delete s.paddockDelivery;return {session:s,laps:structuredClone(laps).sort((a,b)=>String(a.id).localeCompare(String(b.id)))};}
function attach(session,laps,input){
 if(!session||hash(evidence(session,laps))!==input.expectedHash)throw Error('The saved race changed while opening its shared history. Reopen it before editing.');
 const b=input.baseline,c=input.context;
 if(b?.version!==1||!Number.isInteger(b.expected?.revision)||b.expected.revision<1||!['active','withdrawn'].includes(b.expected.state)||!/^[a-f0-9]{64}$/.test(b.expected.contentHash||'')||c?.version!==1||!['databaseId','recoveryId','sourceId'].every(k=>typeof c[k]==='string'&&/^[\w-]{1,100}$/.test(c[k])))throw Error('Invalid adopted history identity.');
 if(b.expected.state!=='active')throw Error('This shared race has been withdrawn. Retain the local recovery evidence.');
 if(session.paddockDelivery?.transport==='engine')throw Error('This race already has a shared save identity. Reopen it.');
 const out=structuredClone(session);
 out.paddockJournal={...out.paddockJournal,sharedLibrary:c,adoptedCarIds:input.carIds||{}};
 out.paddockDelivery={transport:'engine',status:'adopted',baseline:b,name:out.setupName||'Adopted session',payload:null};return out;
}
async function prepare(base,client,id){
 const session=await base.get('sessions',id);if(!session||session.paddockDelivery?.transport==='engine')return;
 const sourceId=client.installationId,origin=await client.handle.origin({sourceId,originalId:id,entity:'session'});if(!origin)return;
 const current=await base.historySession(session.sessionType==='tokens'?'tokens':'racing',id,{exportAll:true});
 if(!current)throw Error('The original race evidence is unavailable.');
 const laps=current.laps,s=await client.status(),stored=await client.handle.extensionRead({namespace:'timing.historyOriginals',sourceId,originalId:id});
 if(!stored?.value||hash(evidence(session,laps))!==hash(evidence(stored.value.session,stored.value.laps)))throw Error('The local race differs from the shared original. Reconcile that race before editing; no shared data was overwritten.');
 let raw;try{raw=await client.originalHistory({kind:'detail',sourceId,originalId:id});}catch(e){if(e.code!=='UNSUPPORTED_COVERAGE')throw e;raw={originalOnly:false};}let expected,provenance='historical';
 if(raw.originalOnly)expected={revision:raw.revision,state:raw.state,contentHash:raw.contentHash};
 else {const head=await client.handle.historyRead({kind:'detail',sourceId,sessionId:origin.sessionId||id});expected=head.accepted;provenance=head.body?.provenance?.kind||head.body?.bundle?.provenance?.kind||head.body?.payload?.provenance?.kind||'historical';}
 const carIds={};for(const row of laps)if(row.carId){const mapped=client.aliases.get(row.carId);if(mapped)carIds[row.carId]=mapped;}
 await base.attachSharedHistory({sessionId:id,expectedHash:hash(evidence(session,laps)),context:{version:1,databaseId:s.databaseId,recoveryId:s.recoveryId,sourceId},carIds,baseline:{version:1,originalOnly:raw.originalOnly,expected,provenance,projectionReason:raw.projectionReason||''}});
}
module.exports={evidence,attach,prepare};
