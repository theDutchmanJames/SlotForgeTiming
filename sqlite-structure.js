'use strict';
// Metadata-only preflight. Missing authoritative data must never be repaired
// with empty defaults. Disposable views/projections have separate upgrade paths.
const base={info:['key','value'],roots:['key','ordinal','kind'],records:['entity','id','ordinal','shape'],fields:['entity','id','path','json'],lap_index:['id','entity','sessionId','carId','driverId','trackId','time','valid','pit']};
const working={command_receipts:['id','fingerprint','result'],changes:['sequence','commandId','kind','changed'],revisions:['entity','id','revision'],field_versions:['entity','id','path','version'],ordinals:['entity','next'],resource_sessions:['runId','sessionId','fingerprint']};
const media={media_blobs:['digest','bytes'],asset_refs:['entity','id','path','mime','digest','original']};
const legacyMedia={assets:['entity','id','path','mime','bytes','digest','original']};
const delivery={delivery_outbox:['sequence','key','owner','databaseId','sourceId','sessionId','revision','state','payloadHash','payload','current','status','error','receipt','receiptCheckedAt','receiptCheckError','attempts','attemptToken','leaseUntil','nextAttemptAt']};
const finalization={session_finalizations:['saveKey','sessionId']};
function fault(detail){return Object.assign(Error('Required database storage is missing or incompatible: '+detail+'. Keep this database and restore a verified backup. No replacement data has been created.'),{code:'STORAGE_STRUCTURE_INVALID'});}
function tables(db,definitions){
 for(const [name,columns]of Object.entries(definitions)){
  if(db.prepare('SELECT type FROM sqlite_master WHERE name=?').get(name)?.type!=='table')throw fault(name);
  const found=new Set(db.prepare('PRAGMA table_info('+name+')').all().map(r=>r.name));
  for(const column of columns)if(!found.has(column))throw fault(name+'.'+column);
 }
}
function check(db){
 tables(db,base);
 const raw=db.prepare("SELECT value FROM info WHERE key='workingFormat'").get()?.value;
 if(raw!==undefined&&!['1','2','3','4','5','6'].includes(raw))throw fault('unsupported working format');
 const version=raw===undefined?0:Number(raw);
 tables(db,version>=6?media:legacyMedia);
 if(version){tables(db,working);if(version>=2)tables(db,delivery);if(version>=5)tables(db,finalization);}
 return version;
}
module.exports={check,tables,fault,base,working,media,legacyMedia,delivery,finalization};
