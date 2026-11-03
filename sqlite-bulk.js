'use strict';
// Bulk operations on the active working generation; restore always creates a separate copy.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const Transfer = require('./transfer'), Backup = require('./backup'), schema = require('./schema');
const { SqliteStore, hash } = require('./sqlite-store');
const MAX_TRANSFER = 48 * 1024 * 1024, MAX_LEGACY = require('./sqlite-migration').MAX_JSON_BYTES;
const FORMAT = 'slotforge-timing-sqlite-backup';
function digest(file) {
  const fd = fs.openSync(file, 'r'), bytes = Buffer.alloc(65536), h = crypto.createHash('sha256');
  try { let n; while ((n = fs.readSync(fd, bytes, 0, bytes.length, null))) h.update(bytes.subarray(0,n)); }
  finally { fs.closeSync(fd); } return h.digest('hex');
}
function readJson(file, limit) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.size > limit) throw Error('Expected a regular file within the legacy size limit.');
  const bytes = fs.readFileSync(file);
  if (bytes.length > limit) throw Error('File grew beyond the legacy size limit.');
  return JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));
}
function sync(file) { const fd = fs.openSync(file,'r+'); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); } }
function writeNew(file, value) { const fd = fs.openSync(file,'wx'); try { fs.writeFileSync(fd,value); fs.fsyncSync(fd); } finally { fs.closeSync(fd); } }
function verify(file) {
  const store = new SqliteStore(file);
  try {
    if (!['1','2','3','4','5','6'].includes(store.statement("SELECT value FROM info WHERE key='workingFormat'").get()?.value)) throw Error('Not a supported working snapshot.');
    if (store.statement('PRAGMA integrity_check').get().integrity_check !== 'ok' || store.statement('PRAGMA foreign_key_check').all().length) throw Error('Snapshot integrity check failed.');
    let records=0, assets=0;
    for (const row of store.statement('SELECT entity,id FROM records').iterate()) {
      const record=store.get(row.entity,row.id);
      for(const asset of record.assets){
        let value=record.value;
        for(const part of asset.path){if(value===null || typeof value!=='object' || !Object.hasOwn(value,part))throw Error('Snapshot media path is invalid.');value=value[part];}
        if(value!==null)throw Error('Snapshot media placeholder is invalid.');
      }
      records++;
    }
    const shared=store.statement("SELECT value FROM info WHERE key='workingFormat'").get().value==='6';
    // Hash each shared body once, including any unreferenced body; references are
    // separately validated by foreign keys, paths and exact URI spelling.
    if(shared)for(const a of store.statement('SELECT bytes,digest FROM media_blobs').iterate())if(hash(a.bytes)!==a.digest)throw Error('Snapshot media checksum failed.');
    for (const a of store.statement(shared?'SELECT digest,mime,original FROM asset_refs':'SELECT bytes,digest,mime,original FROM assets').iterate()) {
      if (!shared&&hash(a.bytes)!==a.digest) throw Error('Snapshot media checksum failed.');
      if(a.original!==null){const m=/^data:([^;,]+);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(a.original);if(!m||m[1]!==a.mime||hash(Buffer.from(m[2],'base64'))!==a.digest)throw Error('Snapshot original media checksum failed.');}
      assets++;
    }
    return {records,assets};
  } finally { store.close(); }
}
function snapshot(store, destination, info={}, checkpoint=()=>{}) {
  // Exclusive directory: errors or worker cancellation leave an unpublished staging copy.
  require('./storage-space').check(destination,store.statement('PRAGMA page_count').get().page_count*store.statement('PRAGMA page_size').get().page_size*2,'SQLite backup');
  fs.mkdirSync(destination);
  const staging=path.join(destination,'snapshot.pending'), file=path.join(destination,'snapshot.sqlite');
  store.db.prepare('VACUUM INTO ?').run(staging); // Includes committed WAL contents, not just the main file.
  checkpoint('snapshot-written'); sync(staging);
  const counts=verify(staging), sha256=digest(staging);
  fs.renameSync(staging,file); checkpoint('before-publish');
  const manifest={format:FORMAT,version:1,state:'verified',date:new Date().toISOString(),appVersion:info.version||'',sha256,...counts};
  writeNew(path.join(destination,'manifest.pending'),JSON.stringify(manifest,null,2));
  fs.renameSync(path.join(destination,'manifest.pending'),path.join(destination,'manifest.json'));
  return {destination,...manifest};
}
function restore(source,destination,checkpoint=()=>{}) {
  const manifest=readJson(path.join(source,'manifest.json'),65536), file=path.join(source,'snapshot.sqlite');
  if (manifest.format!==FORMAT || manifest.version!==1 || manifest.state!=='verified' || !/^[a-f0-9]{64}$/.test(manifest.sha256||'')) throw Error('Unsupported or incomplete SQLite backup.');
  if (!fs.lstatSync(file).isFile() || fs.existsSync(file+'-wal') || fs.existsSync(file+'-journal')) throw Error('Backup is not a sealed snapshot.');
  require('./storage-space').check(destination,fs.statSync(file).size*3,'SQLite restore');
  fs.mkdirSync(destination); const staging=path.join(destination,'restore.pending');
  fs.copyFileSync(file,staging,fs.constants.COPYFILE_EXCL); sync(staging);
  if (digest(staging)!==manifest.sha256) throw Error('Backup checksum mismatch. Nothing was restored.');
  const counts=verify(staging); checkpoint('before-publish');
  writeNew(path.join(destination,'restore-info.json'),JSON.stringify({sourceSha256:manifest.sha256,...counts}));
  fs.renameSync(staging,path.join(destination,'working.sqlite'));
  return {destination,...counts};
}
function reader(store) {
  let size=0; const cache=new Map();
  const findRecord=(entity,id)=>{
    const key=JSON.stringify([entity,id]); if(cache.has(key))return cache.get(key);
    const row=store.get(entity,id,true)?.value;
    if(row){size+=Buffer.byteLength(JSON.stringify(row));if(size>MAX_TRANSFER)throw Error('Selected export exceeds the 48 MiB legacy transfer limit. Use a native backup for large collections.');}
    cache.set(key,row);return row;
  };
  return {findRecord,customFields:store.get('@meta','customFields',true)?.value||{},
    *lapsFor(id){for(const row of store.statement("SELECT r.id FROM lap_index l JOIN records r ON r.entity='laps' AND r.id=l.id WHERE l.sessionId=? ORDER BY r.ordinal").iterate(id))yield findRecord('laps',row.id);},
    *tyresFor(compound){for(const row of store.statement("SELECT id FROM records WHERE entity='tyrewearsystems' ORDER BY ordinal").iterate()){if(store.field('tyrewearsystems',row.id,['tyres',compound,'name']).present || store.get('tyrewearsystems',row.id)?.value?.tyres?.[compound])yield findRecord('tyrewearsystems',row.id);}}
  };
}
function collect(store,picks,deps=true,info={}) { return store.transaction(()=>Transfer.collect(reader(store),picks,deps,info)); }
function dependencies(store,picks) { return store.transaction(()=>Transfer.dependencies(reader(store),picks)); }
function importItems(store,{bundle}) {
  // Reuse remapping/legacy upgrades; only existing titles and field definitions are needed.
  const data={customFields:store.get('@meta','customFields',true)?.value||{}};
  for(const entity of Transfer.ORDER){
    data[entity]=[]; data.customFields[entity] ||= [];
    if(bundle.items?.[entity]?.length && !['sessions','laps'].includes(entity))
      for(const row of store.statement('SELECT id FROM records WHERE entity=? ORDER BY ordinal').iterate(entity))
        data[entity].push(Object.fromEntries((schema[entity].title||[]).map(key=>[key,store.field(entity,row.id,[key]).value])));
  }
  const lengths=Object.fromEntries(Transfer.ORDER.map(e=>[e,data[e].length]));
  const counts=Transfer.apply({data,saveNow(){}},bundle);
  for(const entity of Transfer.ORDER)for(const row of data[entity].slice(lengths[entity]))store.insert(entity,row);
  if(Object.keys(bundle.customFields||{}).length)store.replace('@meta','customFields',data.customFields);
  store.checkpoint('import-written');return counts;
}
function importFile(store,file,commandId,expectedHash) {
  const bundle=readJson(file,MAX_TRANSFER), actual=hash(JSON.stringify(bundle));
  if(actual!==expectedHash)throw Error('Import file changed since review. Review it again.');
  return store.command({id:commandId,type:'importItems',bundle});
}
function inspect(file) {
  const bundle=readJson(file,MAX_TRANSFER), result=Transfer.check(bundle);
  if(!result.ok)throw Error(result.error);return {...result,sha256:hash(JSON.stringify(bundle))};
}
function exportLegacy(store,file,info={},checkpoint=()=>{}) {
  // Write one record at a time within one snapshot. No database-sized IPC or JSON string.
  if(fs.existsSync(file))throw Error('Choose a new export filename; existing files are not overwritten.');
  const temp=file+'.'+crypto.randomUUID()+'.pending', fd=fs.openSync(temp,'wx');let bytes=0;
  const write=text=>{bytes+=Buffer.byteLength(text);if(bytes>MAX_LEGACY)throw Error('Legacy backup exceeds the runtime JSON size limit. Use a native SQLite backup.');fs.writeFileSync(fd,text);};
  try {
    store.transaction(()=>{
      const header=Backup.make({},info);delete header.data;write(JSON.stringify(header).slice(0,-1)+',"data":{');let firstRoot=true;
      for(const root of store.statement('SELECT key,kind FROM roots ORDER BY ordinal').iterate()){
        write((firstRoot?'':',')+JSON.stringify(root.key)+':');firstRoot=false;
        if(root.kind==='meta')write(JSON.stringify(store.get('@meta',root.key,true).value));
        else {write('[');let first=true;for(const row of store.statement('SELECT id FROM records WHERE entity=? ORDER BY ordinal').iterate(root.key)){write((first?'':',')+JSON.stringify(store.get(root.key,row.id,true).value));first=false;checkpoint('record-written');}write(']');}
      }write('}}');
    });fs.fsyncSync(fd);
  } catch(error){fs.closeSync(fd);try{fs.unlinkSync(temp);}catch{}throw error;}
  fs.closeSync(fd);
  // A hard link publishes exclusively; even a concurrent file creation cannot be overwritten.
  try{checkpoint('before-publish');fs.linkSync(temp,file);}finally{fs.unlinkSync(temp);}
  return {file,bytes};
}
function restoreLegacy(file,destination) {
  const bundle=readJson(file,MAX_LEGACY), check=Backup.check(bundle);if(!check.ok)throw Error(check.error);
  // Apply the same legacy normalization as JSON restore, entirely in memory on copied data.
  const original=fs.readFileSync(file);if(hash(JSON.stringify(JSON.parse(original.toString('utf8').replace(/^\uFEFF/,''))))!==hash(JSON.stringify(bundle)))throw Error('Backup changed while reading.');
  const Database=require('./db'), facade={data:structuredClone(bundle.data)};Database.prototype.ensure.call(facade);
  require('./storage-space').check(destination,original.length*8,'Legacy backup restore');
  fs.mkdirSync(destination);writeNew(path.join(destination,'original-backup.json'),original);
  const raw=path.join(destination,'normalized.json');writeNew(raw,JSON.stringify(facade.data));
  require('./sqlite-migration').migrateCopy({source:raw,destination:path.join(destination,'recovery')});
  const work=path.join(destination,'restored');require('./sqlite-working').forkCopy(path.join(destination,'recovery'),work);
  return {destination:work};
}
module.exports={FORMAT,MAX_TRANSFER,MAX_LEGACY,snapshot,restore,collect,dependencies,importItems,importFile,inspect,exportLegacy,restoreLegacy,verify,digest};
