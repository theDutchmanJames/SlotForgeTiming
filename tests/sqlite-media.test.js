'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {DatabaseSync}=require('node:sqlite'),{migrateCopy}=require('../sqlite-migration'),{forkCopy,WorkingStore}=require('../sqlite-working'),Bulk=require('../sqlite-bulk'),Media=require('../sqlite-media'),Space=require('../storage-space');
const image='data:image/png;base64,YWJjZA==';
function fixture(t,data={version:1,drivers:[{id:'a',name:'A',picture:image},{id:'b',name:'B',picture:image}],settings:{theme:'dark'}}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'timing-media-')),source=path.join(dir,'source.json'),copy=path.join(dir,'copy'),work=path.join(dir,'work');fs.writeFileSync(source,JSON.stringify(data));const original=fs.readFileSync(source);migrateCopy({source,destination:copy});forkCopy(copy,work);const stores=[];
 t.after(()=>{for(const s of stores)s.close();assert.deepEqual(fs.readFileSync(source),original);fs.rmSync(dir,{recursive:true,force:true});});return {dir,source,copy,work,data,open(opts){const s=new WorkingStore(work,opts);stores.push(s);return s;}};
}
function counts(s){return s.statement('SELECT count(*) n,coalesce(sum(length(bytes)),0) bytes FROM media_blobs').get();}
function patch(s,id,picture,command='patch-'+id){return s.command({id:command,type:'updateRecord',entity:'drivers',recordId:id,expectedRevision:s.revision('drivers',id),patch:{picture}});}
test('upgrade deduplicates media bodies, preserves MIME and exact spelling and reopens',t=>{
 const data={version:1,settings:{},drivers:[{id:'a',picture:image},{id:'b',picture:'data:audio/wav;base64,YWJjZA=='},{id:'c',picture:'data:image/png;base64,YWJj\nZA=='}]};const f=fixture(t,data);let s=f.open();assert.deepEqual({...counts(s)},{n:1,bytes:4});for(const d of data.drivers)assert.deepEqual(s.get('drivers',d.id,true).value,d);s.close();s=f.open();assert.equal(counts(s).n,1);assert.equal(s.statement('PRAGMA foreign_key_check').all().length,0);
 const stats=s.lifecycleDiagnostics().database;assert.equal(stats.media.count,3);assert.equal(stats.media.savedBytes,8);assert.equal(stats.media.uniqueCount,1);assert(stats.freeBytes===null||stats.freeBytes>=0);
});
test('replacement and last-reference deletion reclaim only unreferenced bodies',t=>{
 const s=fixture(t).open();patch(s,'a','data:image/png;base64,bmV3');assert.equal(counts(s).n,2);assert.equal(s.get('drivers','b',true).value.picture,image);patch(s,'b','');assert.equal(counts(s).n,1);patch(s,'a','','remove-a');assert.equal(counts(s).n,0);
});
test('failed media writes roll back shared bodies, references, versions and receipts',t=>{
 const f=fixture(t),s=f.open({checkpoint:stage=>{if(stage==='domain-written')throw Error('simulated disk full');}});assert.throws(()=>patch(s,'a','data:image/png;base64,bmV3'),/disk full/);assert.equal(counts(s).n,1);assert.equal(s.get('drivers','a',true).value.picture,image);assert.equal(s.revision('drivers','a'),0);assert.equal(s.receipt('patch-a'),null);
});
test('interrupted upgrade is atomic and corrupt media cannot publish format 6',t=>{
 const f=fixture(t),file=path.join(f.work,'working.sqlite');assert.throws(()=>f.open({checkpoint:stage=>{if(stage==='media-copied')throw Error('interrupt');}}),/interrupt/);
 let d=new DatabaseSync(file);assert.equal(d.prepare("SELECT type FROM sqlite_master WHERE name='assets'").get().type,'table');assert.equal(d.prepare("SELECT value FROM info WHERE key='workingFormat'").get().value,'5');d.exec("UPDATE assets SET digest='bad'");d.close();assert.throws(()=>f.open(),/checksum/);
 d=new DatabaseSync(file);assert.equal(d.prepare("SELECT type FROM sqlite_master WHERE name='assets'").get().type,'table');d.close();
});
test('native snapshot, restore and legacy export preserve exact media and future writes',t=>{
 const f=fixture(t),s=f.open(),dest=path.join(f.dir,'backup');Bulk.snapshot(s,dest);const restored=path.join(f.dir,'restored');Bulk.restore(dest,restored);const r=new WorkingStore(restored);try{assert.equal(counts(r).n,1);patch(r,'a','');assert.equal(r.get('drivers','b',true).value.picture,image);}finally{r.close();}
 const file=path.join(f.dir,'export.json');Bulk.exportLegacy(s,file);assert.deepEqual(JSON.parse(fs.readFileSync(file)).data.drivers,f.data.drivers);
});
test('digest collision is rejected and does not alter an existing reference',t=>{
 const s=fixture(t).open(),digest=s.statement('SELECT digest FROM media_blobs').get().digest;assert.throws(()=>s.transaction(()=>s.statement('INSERT INTO assets VALUES(?,?,?,?,?,?,?)').run('drivers','a','["other"]','image/png',Buffer.from('different'),digest,null)),/collision/);assert.equal(counts(s).n,1);assert.equal(s.get('drivers','a',true).value.picture,image);
});
test('refresh journal retention preserves receipts, stale cursor detection and monotonic revisions',t=>{
 const s=fixture(t).open(),first={id:'first',type:'updateRecord',entity:'drivers',recordId:'a',expectedRevision:0,patch:{name:'Changed'}};const saved=s.command(first);
 s.transaction(()=>{const receipt=s.statement('INSERT INTO command_receipts VALUES(?,?,?)'),change=s.statement('INSERT INTO changes(commandId,kind,changed) VALUES(?,?,?)');for(let i=0;i<10100;i++){receipt.run('test-'+i,'hash','{}');change.run('test-'+i,'test','{}');}Media.prune(s);});
 assert.equal(s.statement('SELECT count(*) n FROM changes').get().n,Media.KEEP_CHANGES);assert.throws(()=>s.changes(0),/expired/);assert.equal(s.changes(101).length,50);assert.deepEqual(s.command(first),saved);assert.equal(s.statement('SELECT count(*) n FROM command_receipts').get().n,10101);assert.equal(s.revision('drivers','a'),1);
});
test('disk-space preflight rejects insufficient space and tolerates unavailable probes',t=>{
 const f=fixture(t);assert.throws(()=>Space.check(f.dir,100,'Test',()=>10),/free space/);assert.equal(Space.check(f.dir,100,'Test',()=>null).availableBytes,null);assert.throws(()=>Space.check(f.dir,-1),/estimate/);assert.equal(Space.available(f.dir,()=>{throw Error('unsupported');}),null);
 const check=Space.check;Space.check=()=>{throw Object.assign(Error('No free space'),{code:'ENOSPC'});};try{assert.throws(()=>f.open(),/free space/);}finally{Space.check=check;}const d=new DatabaseSync(path.join(f.work,'working.sqlite'));try{assert.equal(d.prepare("SELECT type FROM sqlite_master WHERE name='assets'").get().type,'table');}finally{d.close();}assert.equal(counts(f.open()).n,1);
});
test('abrupt process exit during media upgrade reopens the original layout and retries safely',t=>{
 const f=fixture(t),child=require('node:child_process').spawnSync(process.execPath,['-e',`new(require('./sqlite-working').WorkingStore)(process.argv[1],{checkpoint:s=>{if(s==='media-copied')process.exit(77);}});`,f.work],{cwd:path.join(__dirname,'..'),stdio:'ignore',windowsHide:true});assert.equal(child.status,77);
 const d=new DatabaseSync(path.join(f.work,'working.sqlite'));try{assert.equal(d.prepare("SELECT type FROM sqlite_master WHERE name='assets'").get().type,'table');assert.equal(d.prepare('SELECT count(*) n FROM assets').get().n,2);}finally{d.close();}assert.equal(counts(f.open()).n,1);
});
test('SQLite disk-full during media upgrade rolls back the schema and succeeds after space returns',t=>{
 const f=fixture(t),s=f.open();require('./fixtures/legacy-media.cjs')(s);s.db.exec("UPDATE info SET value='5' WHERE key='workingFormat';VACUUM");const pages=s.statement('PRAGMA page_count').get().page_count;s.db.exec(`PRAGMA max_page_count=${pages}`);assert.throws(()=>Media.upgrade(s),/full/);assert.equal(s.statement("SELECT type FROM sqlite_master WHERE name='assets'").get().type,'table');assert.equal(s.get('drivers','a',true).value.picture,image);s.db.exec('PRAGMA max_page_count=1000000');Media.upgrade(s);assert.equal(counts(s).n,1);
});
test('many repeated images and sounds occupy one body and compact native backup retains all references',t=>{
 const bytes=require('node:crypto').randomBytes(256*1024),dataUri='data:image/png;base64,'+bytes.toString('base64'),data={version:1,drivers:Array.from({length:32},(_,i)=>({id:String(i),picture:dataUri})),audiosets:[{id:'audio',clip:'data:audio/wav;base64,'+bytes.toString('base64')}],settings:{}};
 const f=fixture(t,data),s=f.open(),stats=s.lifecycleDiagnostics().database.media;assert.equal(stats.bytes,bytes.length);assert.equal(stats.logicalBytes,33*bytes.length);assert.equal(stats.savedBytes,32*bytes.length);Bulk.snapshot(s,path.join(f.dir,'compact'));assert(fs.statSync(path.join(f.dir,'compact','snapshot.sqlite')).size<fs.statSync(path.join(f.copy,'timing.sqlite')).size/4);assert.equal(s.get('audiosets','audio',true).value.clip,data.audiosets[0].clip);
});
test('upgrade rejects a corrupt original URI without replacing the legacy asset table',t=>{
 const f=fixture(t),d=new DatabaseSync(path.join(f.work,'working.sqlite'));d.exec("UPDATE assets SET original='data:image/png;base64,YmFk'");d.close();assert.throws(()=>f.open(),/Original media checksum/);const r=new DatabaseSync(path.join(f.work,'working.sqlite'));try{assert.equal(r.prepare("SELECT type FROM sqlite_master WHERE name='assets'").get().type,'table');assert.equal(r.prepare('SELECT count(*) n FROM assets').get().n,2);}finally{r.close();}
});
