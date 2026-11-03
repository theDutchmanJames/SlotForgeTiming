'use strict';
const crypto=require('node:crypto');
// Keep the legacy seven-column SQL interface for all readers and write adapters.
// MIME and exact noncanonical data-URI spelling belong to each reference.
const SCHEMA=`
 CREATE TABLE media_blobs(digest TEXT PRIMARY KEY,bytes BLOB NOT NULL);
 CREATE TABLE asset_refs(entity TEXT NOT NULL,id TEXT NOT NULL,path TEXT NOT NULL,mime TEXT NOT NULL,digest TEXT NOT NULL,original TEXT,
   PRIMARY KEY(entity,id,path),FOREIGN KEY(entity,id) REFERENCES records(entity,id),FOREIGN KEY(digest) REFERENCES media_blobs(digest));
 CREATE INDEX asset_digest ON asset_refs(digest);
 CREATE VIEW assets AS SELECT r.entity,r.id,r.path,r.mime,b.bytes,r.digest,r.original FROM asset_refs r JOIN media_blobs b ON b.digest=r.digest;
 CREATE TRIGGER asset_insert INSTEAD OF INSERT ON assets BEGIN
   SELECT CASE WHEN EXISTS(SELECT 1 FROM media_blobs WHERE digest=NEW.digest AND bytes!=NEW.bytes) THEN RAISE(ABORT,'Media digest collision') END;
   INSERT OR IGNORE INTO media_blobs VALUES(NEW.digest,NEW.bytes);
   INSERT INTO asset_refs VALUES(NEW.entity,NEW.id,NEW.path,NEW.mime,NEW.digest,NEW.original);
 END;
 CREATE TRIGGER asset_delete INSTEAD OF DELETE ON assets BEGIN
   DELETE FROM asset_refs WHERE entity=OLD.entity AND id=OLD.id AND path=OLD.path;
   DELETE FROM media_blobs WHERE digest=OLD.digest AND NOT EXISTS(SELECT 1 FROM asset_refs WHERE digest=OLD.digest);
 END;
 CREATE TRIGGER asset_update INSTEAD OF UPDATE ON assets BEGIN
   DELETE FROM assets WHERE entity=OLD.entity AND id=OLD.id AND path=OLD.path;
   INSERT INTO assets VALUES(NEW.entity,NEW.id,NEW.path,NEW.mime,NEW.bytes,NEW.digest,NEW.original);
 END;`;
function upgrade(s){
 const version=s.statement("SELECT value FROM info WHERE key='workingFormat'").get().value;
 if(version==='6'){s.statement('SELECT digest,length(bytes) FROM media_blobs LIMIT 0').all();return;}
 if(version!=='5')throw Error('Unsupported shared media format.');
 const size=s.statement('SELECT coalesce(sum(length(bytes)+coalesce(length(CAST(original AS BLOB)),0)),0) n FROM assets').get().n;
 require('./storage-space').check(s.file,Math.ceil(size*2),'Shared media upgrade');
 s.transaction(()=>{
   // Another worker may have upgraded while this connection waited for the
   // write lock. Recheck inside BEGIN IMMEDIATE before changing any schema.
   const lockedVersion=s.statement("SELECT value FROM info WHERE key='workingFormat'").get().value;
   if(lockedVersion==='6'){s.statement('SELECT digest,length(bytes) FROM media_blobs LIMIT 0').all();return;}
   if(lockedVersion!=='5')throw Error('Unsupported shared media format.');
   s.db.exec('ALTER TABLE assets RENAME TO legacy_assets');s.db.exec(SCHEMA);
   const insert=s.db.prepare('INSERT INTO assets VALUES(?,?,?,?,?,?,?)');
   for(const a of s.db.prepare('SELECT * FROM legacy_assets').iterate()){
     if(crypto.createHash('sha256').update(a.bytes).digest('hex')!==a.digest)throw Error('Media checksum failed during shared storage upgrade.');
     if(a.original!==null){const m=/^data:([^;,]+);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(a.original);if(!m||m[1]!==a.mime||crypto.createHash('sha256').update(Buffer.from(m[2],'base64')).digest('hex')!==a.digest)throw Error('Original media checksum failed during shared storage upgrade.');}
     insert.run(a.entity,a.id,a.path,a.mime,a.bytes,a.digest,a.original);
   }
   s.checkpoint?.('media-copied');
   s.db.exec('DROP TABLE legacy_assets');
   s.statement("UPDATE info SET value='6' WHERE key='workingFormat'").run();
   s.checkpoint?.('media-upgraded');
 });
 s.statements.clear();
}
// Only the refresh journal expires. Receipts, result identities and deliveries do not.
const KEEP_CHANGES=10000;
function prune(s){
 const high=s.statement('SELECT coalesce(max(sequence),0) n FROM changes').get().n,cutoff=high-KEEP_CHANGES;
 if(cutoff<=0)return;
 s.statement('DELETE FROM changes WHERE sequence<=?').run(cutoff);
 s.statement("INSERT INTO info VALUES('changesFloor',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(cutoff));
}
module.exports={upgrade,prune,KEEP_CHANGES};
