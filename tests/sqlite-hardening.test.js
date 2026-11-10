'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {DatabaseSync}=require('node:sqlite'),{migrateCopy}=require('../sqlite-migration'),{WorkingStore,forkCopy}=require('../sqlite-working'),{SqliteStore}=require('../sqlite-store'),Structure=require('../sqlite-structure');
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sf-hardening-')),source=path.join(dir,'source.json'),work=path.join(dir,'working');
 const original=Buffer.from(JSON.stringify({version:1,drivers:[{id:'d',name:'Driver',avatar:'data:image/png;base64,YWJj\nZA=='}],tracks:[{id:'t',name:'Track',length:20}],slotcars:[{id:'c',model:'Car'}],sessions:[{id:'s',date:'2026-11-01',standings:[{driverId:'d',carId:'c'}]}],laps:[{id:'l',sessionId:'s',driverId:'d',carId:'c',trackId:'t',lane:1,time:1200,valid:true}]}));fs.writeFileSync(source,original);
 migrateCopy({source,destination:path.join(dir,'copy')});forkCopy(path.join(dir,'copy'),work);const stores=[];
 const f={dir,work,file:path.join(work,'working.sqlite'),open(options){const s=new WorkingStore(work,options);stores.push(s);return s;}};f.open().close();
 t.after(()=>{for(const s of stores)s.close();assert.deepEqual(fs.readFileSync(source),original);fs.rmSync(dir,{recursive:true,force:true});});return f;
}
function damage(f,sql){const db=new DatabaseSync(f.file);try{db.exec('PRAGMA foreign_keys=OFF; '+sql);}finally{db.close();}}
function refused(f,detail){const bytes=fs.readFileSync(f.file);for(const open of [()=>f.open(),()=>new SqliteStore(f.file)])assert.throws(open,e=>e.code==='STORAGE_STRUCTURE_INVALID'&&e.message.includes(detail));assert.deepEqual(fs.readFileSync(f.file),bytes);}
for(const name of Object.keys({...Structure.base,...Structure.working,...Structure.media,...Structure.delivery,...Structure.finalization}))test('missing authoritative '+name+' is refused before any repair or opening writes',t=>{
 const f=fixture(t);damage(f,'DROP INDEX lap_session; DROP TABLE '+name);refused(f,name);
 const db=new DatabaseSync(f.file,{readOnly:true});try{assert.equal(db.prepare("SELECT 1 FROM sqlite_master WHERE name='lap_session'").get(),undefined);}finally{db.close();}
});
for(const [table,column]of [['fields','json'],['command_receipts','fingerprint'],['delivery_outbox','attemptToken'],['asset_refs','original']])test('missing required column '+table+'.'+column+' stops opening',t=>{
 const f=fixture(t);damage(f,(table==='asset_refs'?'DROP VIEW assets; ':'')+'ALTER TABLE '+table+' RENAME COLUMN '+column+' TO unexpected');refused(f,table+'.'+column);
});
test('a view cannot impersonate durable receipts',t=>{const f=fixture(t);damage(f,'ALTER TABLE command_receipts RENAME TO saved_receipts; CREATE VIEW command_receipts AS SELECT * FROM saved_receipts');refused(f,'command_receipts');});
test('receipts lost after opening cannot execute an old command again',t=>{
 const f=fixture(t),s=f.open(),command={id:'once',scope:s.editorScope(),type:'editorSave',operation:'add',args:['drivers',{name:'Once'}]};s.command(command);s.db.exec('PRAGMA foreign_keys=OFF; DROP TABLE command_receipts');
 const count=s.statement("SELECT count(*) n FROM records WHERE entity='drivers'").get().n;assert.throws(()=>s.command(command),/command_receipts/);assert.equal(s.statement("SELECT count(*) n FROM records WHERE entity='drivers'").get().n,count);
});
test('verified recovery copies and original format-one workspaces still open and upgrade',t=>{
 const f=fixture(t),copy=new SqliteStore(path.join(f.dir,'copy','timing.sqlite'));assert.equal(Structure.check(copy.db),0);copy.close();
 const legacy=path.join(f.dir,'legacy');forkCopy(path.join(f.dir,'copy'),legacy);const s=new WorkingStore(legacy);try{assert.equal(Structure.check(s.db),6);assert.equal(s.get('drivers','d',true).value.name,'Driver');}finally{s.close();}
});
const canonical=rows=>rows.map(row=>JSON.stringify(row)).sort();
const dump=s=>Object.fromEntries(s.statement("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(({name})=>[name,canonical(s.statement('SELECT * FROM '+name).all())]));
const repairs=[['home_totals','home-totals-repaired'],['car_stat_totals','car-totals-repaired'],['history_details','history-details-repaired']];
function protect(s,except){for(const {name}of s.statement("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all())if(!except.includes(name))for(const action of ['INSERT','UPDATE','DELETE'])s.db.exec(`CREATE TRIGGER guard_${name}_${action} BEFORE ${action} ON ${name} BEGIN SELECT RAISE(ABORT,'Healthy table changed: ${name}'); END;`);}
function guards(s){return s.statement("SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'guard_%' ORDER BY name").all().map(r=>r.name);}
function unprotect(s){for(const name of guards(s))s.db.exec('DROP TRIGGER '+name);}
for(const [table,phase]of repairs)test('targeted '+table+' recovery preserves healthy tables and subsequent updates',t=>{
 const f=fixture(t);let s=f.open(),before=dump(s);protect(s,[table]);const expectedGuards=guards(s);s.db.exec('DROP TABLE '+table);s.close();
 // Totals repair must not decode source lap or media bodies.
 const statement=SqliteStore.prototype.statement;
 if(table!=='history_details'){SqliteStore.prototype.statement=function(sql){if(/SELECT.*(?:f\.json|shape).*FROM/i.test(sql))throw Error('Source record decoded during totals repair');return statement.call(this,sql);};}
 try{s=f.open();}finally{SqliteStore.prototype.statement=statement;}
 assert.deepEqual(guards(s),expectedGuards);assert.deepEqual(dump(s),before);unprotect(s);
 s.command({id:'track-edit',type:'updateRecord',entity:'tracks',recordId:'t',expectedRevision:s.revision('tracks','t'),patch:{length:40}});
 s.command({id:'eligibility',type:'setLapEligibility',lapId:'l',expectedRevision:s.revision('laps','l'),flags:{noPersonalBest:true}});
 const totals=dump(s);s.db.exec("DELETE FROM info WHERE key IN ('homeIndexVersion','carStatisticsVersion','historyDetailVersion')");s.close();s=f.open();
 for(const name of ['home_totals','car_stat_totals','history_details'])assert.deepEqual(dump(s)[name],totals[name]);
 s.command({id:'delete-session',type:'deleteSession',sessionId:'s',expectedRevision:s.revision('sessions','s')});assert.equal(s.statement('SELECT count(*) n FROM '+table).get().n,0);assert.equal(s.statement('PRAGMA integrity_check').get().integrity_check,'ok');assert.deepEqual(s.statement('PRAGMA foreign_key_check').all(),[]);
});
for(const [table,phase]of repairs)test('failed targeted '+table+' repair rolls back then succeeds on retry',t=>{
 const f=fixture(t);let s=f.open();const before=dump(s);s.db.exec('DROP TABLE '+table);s.close();
 assert.throws(()=>f.open({checkpoint:name=>{if(name===phase)throw Error('repair interrupted');}}),/repair interrupted/);
 const db=new DatabaseSync(f.file,{readOnly:true});try{assert.equal(db.prepare('SELECT 1 FROM sqlite_master WHERE name=?').get(table),undefined);}finally{db.close();}
 s=f.open();assert.deepEqual(dump(s),before);
});
test('multiple missing totals repair independently; stale bases still take full recovery',t=>{
 const f=fixture(t);let s=f.open();const before=dump(s);s.db.exec('DROP TABLE home_totals; DROP TABLE car_stat_totals; DROP TABLE history_details');s.close();s=f.open();assert.deepEqual(dump(s),before);
 s.db.exec("DROP TABLE home_totals; UPDATE home_laps SET time=9999; UPDATE info SET value='old' WHERE key='homeIndexSequence'; DROP TABLE car_stat_parts;");s.close();s=f.open();assert.deepEqual(dump(s),before);
});
