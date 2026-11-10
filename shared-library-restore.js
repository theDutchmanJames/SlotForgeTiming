'use strict';
// Restore only the common library. Timing settings/current race recovery remain
// intact. Durable intents always keep their original database recovery epoch.
const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto'),A=require('./storage-activation'),B=require('./shared-library-backup');
const FORMAT='slotforge-shared-library-restore',marker=profile=>path.join(profile,'shared-library-restore.json');
function read(profile){
 let value;try{const file=marker(profile),s=fs.lstatSync(file);if(!s.isFile()||s.isSymbolicLink()||s.size>65536)throw Error('Invalid restore journal.');value=JSON.parse(fs.readFileSync(file,'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}
 if(value.format!==FORMAT||value.version!==1||!['prepared','restored','complete','held'].includes(value.phase)||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value.request?.operationId||'')||!/^[a-f0-9]{64}$/.test(value.sha256||''))throw Error('Invalid shared-library restore journal. Keep it for recovery.');
 const expected=path.join(fs.realpathSync(profile),'shared-library-restores',value.request.operationId,'source.sfpbackup');
 if(value.request.source!==expected||value.phase!=='complete'&&fs.realpathSync(path.dirname(expected))!==path.dirname(expected))throw Error('Restore input was redirected. Nothing was restored.');
 return value;
}
async function prepare({client,profile,directory,backend,privateBackup,beforePublish=()=>{}}){
 const existing=read(profile);if(existing&&!['complete','held'].includes(existing.phase))throw Error('Finish or explicitly hold the previous shared-library restore before preparing another.');
 const manifest=await B.verify(directory),root=fs.realpathSync(profile),id=randomUUID(),folder=path.join(root,'shared-library-restores',id);await fs.promises.mkdir(folder,{recursive:true});
 if(fs.realpathSync(folder)!==folder)throw Error('Restore staging directory was redirected.');
 const file=manifest.files.find(f=>f.path==='library.sfpbackup'),source=path.join(folder,'source.sfpbackup');
 await fs.promises.copyFile(path.join(directory,'library.sfpbackup'),source,fs.constants.COPYFILE_EXCL);if(await A.digest(source)!==file.sha256)throw Error('The selected backup changed. Nothing was scheduled.');
 const fd=fs.openSync(source,'r+');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
 // Before-restore safety copy includes the private queue/recovery data too.
 const before=path.join(folder,'before');await B.create({client,destination:before,backend,privateBackup,profile});
 const s=await client.status(),request={databaseId:s.databaseId,recoveryId:s.recoveryId,revision:s.revision,operationId:id,source};
 const journal={format:FORMAT,version:1,phase:'prepared',request,sha256:file.sha256,sourceId:client.installationId,before,preparedAt:new Date().toISOString()};
 await beforePublish();A.publish(marker(root),journal);return journal;
}
async function run(client,profile){
 const j=read(profile);if(!j||['complete','held'].includes(j.phase))return null;if(j.sourceId!==client.installationId)throw Error('This restore belongs to another Timing installation.');if(j.phase==='restored')return j.result;
 if(await A.digest(j.request.source)!==j.sha256)throw Error('The retained restore input changed. Nothing was restored.');
 const result=await client.handle.restore(j.request);
 if(result?.status!=='restored'||result.operationId!==j.request.operationId||!result.reopenRequired||typeof result.databaseId!=='string'||typeof result.recoveryId!=='string'||result.recoveryId===j.request.recoveryId||!/^[a-f0-9]{64}$/.test(result.sourceDigest||''))throw Error('Restore acknowledgement could not be verified. Keep the original request for recovery.');
 A.publish(marker(profile),{...j,phase:'restored',result});return result;
}
async function complete(client,profile){
 const j=read(profile);if(!j||j.phase==='complete')return;if(j.phase!=='restored')throw Error('The restore has not been acknowledged.');
 const s=await client.status();if(s.databaseId!==j.result.databaseId||s.recoveryId!==j.result.recoveryId)throw Error('The restored library changed again. Reconcile the retained recovery copies.');
 // Old operations remain in the private journal. Their unchanged recoveryId
 // makes both result and car senders quarantine them instead of recreating data.
 A.publish(marker(profile),{...j,phase:'complete',completedAt:new Date().toISOString()});
}
function hold(profile,error){
 const j=read(profile);if(!j||j.phase==='complete')throw Error('No incomplete restore to hold.');
 const held={...j,phase:'held',heldAt:new Date().toISOString(),error:String(error?.message||error||'Held by user'),code:String(error?.code||'RESTORE_UNCERTAIN')};
 // Retain the exact request alongside its input/safety copies even if a later,
 // explicitly confirmed restore replaces the active startup marker.
 A.publish(path.join(path.dirname(j.request.source),'held-request.json'),held);A.publish(marker(profile),held);return held;
}
module.exports={read,prepare,run,complete,hold,FORMAT};
