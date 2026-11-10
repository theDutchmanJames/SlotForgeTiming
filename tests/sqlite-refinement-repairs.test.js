'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {DatabaseSync}=require('node:sqlite'),{migrateCopy}=require('../sqlite-migration'),{WorkingStore,forkCopy}=require('../sqlite-working'),Bulk=require('../sqlite-bulk');
const image='data:image/png;base64,YWJj\nZA==',audio='data:audio/wav;base64,YWJjZA==';
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sf-refinement-repair-')),source=path.join(dir,'source.json'),work=path.join(dir,'working');
 const bytes=Buffer.from(JSON.stringify({version:1,drivers:[{id:'d',name:'Driver',avatar:image}],tracks:[{id:'t',name:'Track',length:20}],slotcars:[{id:'c',model:'Car'}],audiosets:[{id:'a',name:'Sound',sound:audio}],sessions:[{id:'s',standings:[]}],laps:[{id:'l',sessionId:'s',driverId:'d',carId:'c',trackId:'t',time:1200}],paddock:{sourceId:'preserved-source',connection:null,withdrawals:[]}}));fs.writeFileSync(source,bytes);
 migrateCopy({source,destination:path.join(dir,'copy')});forkCopy(path.join(dir,'copy'),work);const stores=[];
 t.after(()=>{for(const s of stores)s.close();assert.deepEqual(fs.readFileSync(source),bytes);fs.rmSync(dir,{recursive:true,force:true});});
 return {dir,work,open(where=work,options){const s=new WorkingStore(where,options);stores.push(s);return s;}};
}
const intent=s=>({id:crypto.randomUUID(),scope:s.editorScope(),type:'editorSave',operation:'add',args:['drivers',{name:'Pending save'}]});
const dump=s=>s.statement("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r=>[r.name,s.statement('SELECT * FROM '+r.name).all()]);

test('native restore rejects old editor commands before receipt lookup, whether the receipt was backed up or not',t=>{
 const f=fixture(t),s=f.open(),old=intent(s),before=path.join(f.dir,'before'),after=path.join(f.dir,'after');Bulk.snapshot(s,before);const created=s.command(old);Bulk.snapshot(s,after);
 const source=s.get('@meta','paddock',true).value,scope=s.editorScope(),catalogue=s.statement("SELECT value FROM info WHERE key='catalogueIdentity'").get().value;
 for(const [name,backup,hasReceipt] of [['before',before,false],['after',after,true]]){
  const originalBackup=fs.readFileSync(path.join(backup,'snapshot.sqlite')),dest=path.join(f.dir,'restored-'+name);Bulk.restore(backup,dest);let r=f.open(dest);
  assert.notEqual(r.editorScope(),scope);const newScope=r.editorScope();assert.equal(!!r.receipt(old.id),hasReceipt);
  const prior=dump(r);assert.throws(()=>r.command(old),e=>e.code==='EDITOR_GENERATION_CHANGED');assert.deepEqual(dump(r),prior);
  assert.equal(r.statement("SELECT value FROM info WHERE key='catalogueIdentity'").get().value,catalogue);assert.deepEqual(r.get('@meta','paddock',true).value,source);
  if(hasReceipt)assert.equal(r.receipt(old.id).recordId,created.recordId);
  const fresh=intent(r),saved=r.command(fresh);r.close();r=f.open(dest);assert.equal(r.editorScope(),newScope);assert.equal(r.command(fresh).recordId,saved.recordId);
  assert.deepEqual(fs.readFileSync(path.join(backup,'snapshot.sqlite')),originalBackup);
 }
 assert.equal(s.command(old).recordId,created.recordId);
});

test('ordinary upgrade preserves the previous editor scope and receipt identity',t=>{
 const f=fixture(t);let s=f.open();const old=intent(s),result=s.command(old);s.statement("DELETE FROM info WHERE key='editorGeneration'").run();s.close();s=f.open();assert.equal(s.editorScope(),old.scope);assert.deepEqual(s.command(old),result);
});

test('failed restore before publication leaves source, snapshot and active generation intact',t=>{
 const f=fixture(t),s=f.open(),scope=s.editorScope(),backup=path.join(f.dir,'backup'),dest=path.join(f.dir,'failed');Bulk.snapshot(s,backup);const original=fs.readFileSync(path.join(backup,'snapshot.sqlite'));
 assert.throws(()=>Bulk.restore(backup,dest,phase=>{if(phase==='before-publish')throw Error('interrupted publication');}),/interrupted/);
 assert(!fs.existsSync(path.join(dest,'working.sqlite')));assert.equal(s.editorScope(),scope);assert.deepEqual(fs.readFileSync(path.join(backup,'snapshot.sqlite')),original);
});

test('all 20 lookup indexes are individually repaired without changing any table contents',t=>{
 const f=fixture(t);let s=f.open();s.command(intent(s));const indexes=s.statement("SELECT name FROM sqlite_master WHERE type='index' AND sql IS NOT NULL ORDER BY name").all();assert.equal(indexes.length,20);const before=dump(s);
 for(const {name} of indexes){s.db.exec('DROP INDEX '+name);s.close();s=f.open();assert.ok(s.statement("SELECT 1 FROM sqlite_master WHERE type='index' AND name=?").get(name),name);assert.deepEqual(dump(s),before,name);}
 const plan=s.statement('EXPLAIN QUERY PLAN SELECT id FROM lap_index WHERE sessionId=? ORDER BY id LIMIT 10').all('s');assert(plan.some(r=>r.detail.includes('lap_session')));assert(!plan.some(r=>r.detail.includes('TEMP B-TREE')));
});

for(const target of ['asset_insert','asset_delete','asset_update','assets'])test('missing '+target+' is repaired with exact media and future writes preserved',t=>{
 const f=fixture(t);let s=f.open(),before=dump(s);s.db.exec('DROP '+(target==='assets'?'VIEW':'TRIGGER')+' '+target);s.close();s=f.open();assert.deepEqual(dump(s),before);
 assert.equal(s.get('drivers','d',true).value.avatar,image);assert.equal(s.get('audiosets','a',true).value.sound,audio);
 s.command({id:'patch',type:'updateRecord',entity:'drivers',recordId:'d',expectedRevision:0,patch:{avatar:'data:image/png;base64,bmV3'}});
 // Exercise the view UPDATE trigger too; normal field edits use delete/insert.
 s.transaction(()=>s.statement("UPDATE assets SET original=original WHERE entity='drivers' AND id='d'").run());
 s.command({id:'delete',type:'removeRecord',entity:'drivers',recordId:'d',expectedRevision:s.revision('drivers','d')});
 assert.equal(s.get('audiosets','a',true).value.sound,audio);assert.equal(s.statement('PRAGMA integrity_check').get().integrity_check,'ok');assert.deepEqual(s.statement('PRAGMA foreign_key_check').all(),[]);
});

for(const target of ['asset_refs','media_blobs'])test('missing authoritative '+target+' fails safely without replacing it',t=>{
 const f=fixture(t),s=f.open();s.close();const file=path.join(f.work,'working.sqlite');let db=new DatabaseSync(file);db.exec('PRAGMA foreign_keys=OFF; DROP TABLE '+target);const before=db.prepare('SELECT * FROM records').all();db.close();
 assert.throws(()=>f.open(),e=>e.code==='STORAGE_STRUCTURE_INVALID');db=new DatabaseSync(file);try{assert.equal(db.prepare('SELECT 1 FROM sqlite_master WHERE name=?').get(target),undefined);assert.deepEqual(db.prepare('SELECT * FROM records').all(),before);}finally{db.close();}
});

test('failed index repair rolls back all new lookup indexes and can be retried',t=>{
 const f=fixture(t),s=f.open();s.db.exec('DROP INDEX lap_session; DROP INDEX delivery_ready; DROP INDEX asset_digest');const before=dump(s);s.close();
 assert.throws(()=>f.open(f.work,{checkpoint:phase=>{if(phase==='lookup-indexes-repaired')throw Error('disk failure');}}),/disk failure/);
 const db=new DatabaseSync(path.join(f.work,'working.sqlite'));try{assert.equal(db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name IN ('lap_session','delivery_ready','asset_digest')").get().n,0);}finally{db.close();}
 const repaired=f.open();assert.deepEqual(dump(repaired),before);
});

test('failed media interface repair rolls back view and triggers together',t=>{
 const f=fixture(t),s=f.open();s.db.exec('DROP VIEW assets');s.close();
 assert.throws(()=>f.open(f.work,{checkpoint:phase=>{if(phase==='media-interface-repaired')throw Error('disk failure');}}),/disk failure/);
 const db=new DatabaseSync(path.join(f.work,'working.sqlite'));try{assert.equal(db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name IN ('assets','asset_insert','asset_update','asset_delete')").get().n,0);}finally{db.close();}
 assert.equal(f.open().get('drivers','d',true).value.avatar,image);
});
