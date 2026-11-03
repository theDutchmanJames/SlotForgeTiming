// Test-only reconstruction of the pre-shared-media schema for old-format upgrades.
module.exports=s=>{s.statements.clear();s.db.exec(`
 CREATE TABLE old_assets(entity TEXT NOT NULL,id TEXT NOT NULL,path TEXT NOT NULL,mime TEXT NOT NULL,bytes BLOB NOT NULL,digest TEXT NOT NULL,original TEXT,PRIMARY KEY(entity,id,path),FOREIGN KEY(entity,id) REFERENCES records(entity,id));
 INSERT INTO old_assets SELECT * FROM assets;
 DROP VIEW assets; DROP TABLE asset_refs; DROP TABLE media_blobs;
 ALTER TABLE old_assets RENAME TO assets;`);s.statements.clear();};
