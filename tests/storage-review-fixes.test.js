'use strict';
// Storage review repairs: layout team links and 'none' sentinels, shared-library
// field/name matching, track deletion and Virtual Rival Systems, backup identities,
// the old-name migration of race-resume.json and generic session removal.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const Transfer=require('../transfer'),Packs=require('../contentpacks'),Import=require('../shared-library-import'),Cascades=require('../record-cascades');
const Backup=require('../backup'),{migrate}=require('../migrate'),Database=require('../db'),Repository=require('../data-repository'),schema=require('../schema');
const {migrateCopy}=require('../sqlite-migration'),{WorkingStore,forkCopy}=require('../sqlite-working');
const empty=()=>{const d={customFields:{}};for(const k of Object.keys(schema)){d[k]=[];d.customFields[k]=[];}return d;};
const temp=t=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sf-review-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;};

test('a top-level layout widget fixed to a team exports and remaps that team',()=>{
 const src=empty();src.teams.push({id:'T1',name:'Red'});
 src.layouts.push({id:'L1',name:'X',widgets:[{type:'teamname',opt:{team:'T1'}},{type:'composed',opt:{composition:{root:{kind:'component',component:'teamname',options:{team:'T1'}}}}}]});
 const bundle=Transfer.collect(src,{layouts:['L1']});assert.deepEqual(bundle.items.teams.map(t=>t.id),['T1']);
 assert.deepEqual(Transfer.dependencies(src,{layouts:['L1']}).teams,[{id:'T1',required:false}]);
 const d=empty();Transfer.apply({data:d,saveNow(){}},bundle);const id=d.teams[0].id;
 assert.equal(d.layouts[0].widgets[0].opt.team,id);assert.equal(d.layouts[0].widgets[1].opt.composition.root.options.team,id);
 // Without the team the link is cleared, never left pointing at another database's team.
 const alone=Transfer.collect(src,{layouts:['L1']},false),d2=empty();Transfer.apply({data:d2,saveNow(){}},alone);assert.equal(d2.layouts[0].widgets[0].opt.team,'');
});

test('content packs refuse a personal team link on a top-level widget, as in a composition',()=>{
 const pack=team=>({format:Packs.FORMAT,apiVersion:Packs.API,manifest:{id:'club.review',name:'R',version:'1.0.0',author:'A',license:'CC0',minAppVersion:'1.0.0'},items:{layouts:[{id:'L1',name:'X',widgets:[team]}]}});
 assert.throws(()=>Packs.validate(pack({type:'teamname',opt:{team:'T1'}})),/Missing dependency: teams/);
 assert.throws(()=>Packs.validate(pack({type:'composed',opt:{composition:{root:{kind:'component',component:'teamname',options:{team:'T1'}}}}})),/Missing dependency: teams/);
 assert.doesNotThrow(()=>Packs.validate(pack({type:'teamname',opt:{}})));
});

test("'none' image sets and row designs survive an import",()=>{
 const d=empty(),bundle={format:Transfer.FORMAT,fileVersion:1,items:{layouts:[{id:'L1',name:'X',widgets:[{type:'avatar',opt:{imageSet:'none'}},{type:'leaderboard',opt:{design:'none'}}]}]}};
 Transfer.apply({data:d,saveNow(){}},bundle);assert.equal(d.layouts[0].widgets[0].opt.imageSet,'none');assert.equal(d.layouts[0].widgets[1].opt.design,'none');
});

test('shared-library private import reuses matching fields and marks name clashes, and resumes',()=>{
 const priv=empty();priv.drivers.push({id:'D0',name:'Ann',custom:{abc12345:'x'}});priv.customFields.drivers.push({id:'abc12345',label:'Club',type:'text',options:[],group:''});
 const bundle={format:Transfer.FORMAT,fileVersion:1,items:{drivers:[{id:'D9',name:'Ann',custom:{f1:'y'}},{id:'D8',name:'Bob',custom:{f2:'z'}}]},customFields:{drivers:[{id:'f1',label:'Club',type:'text'},{id:'f2',label:'Pit',type:'text'}]}};
 const journal=()=>{const facade=empty();Transfer.apply({data:facade,saveNow(){}},bundle);return facade;},first=journal();
 Import.applyPrivate(priv,first);Import.applyPrivate(priv,first); // (a resumed import adds nothing twice)
 Import.applyPrivate(priv,journal());
 assert.deepEqual(priv.customFields.drivers.map(f=>f.label),['Club','Pit']);
 assert.deepEqual(priv.drivers.map(d=>d.name),['Ann','Ann (imported)','Bob','Ann (imported)','Bob (imported)']);
 const pit=priv.customFields.drivers[1].id;assert.deepEqual(priv.drivers[1].custom,{abc12345:'y'});assert.deepEqual(priv.drivers[4].custom,{[pit]:'z'});
 const changed=structuredClone(first);changed.drivers[0].name='Other';assert.throws(()=>Import.applyPrivate(priv,changed),/changed before recovery/);
});

test('deleting a track clears Virtual Rival System tracks on JSON and SQLite alike',async t=>{
 assert.ok(Cascades.dependencies('tracks').includes('virtualrivalsystems'));
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sf-review-')),db=new Database(path.join(dir,'source.json'));
 db.data.tracks=[{id:'t',name:'Track'},{id:'u',name:'Other'}];db.data.virtualrivalsystems=[{id:'v',name:'Ghost',trackId:'t'},{id:'w',name:'Keep',trackId:'u'}];db.saveNow();
 migrateCopy({source:db.file,destination:path.join(dir,'copy')});forkCopy(path.join(dir,'copy'),path.join(dir,'work'));const store=new WorkingStore(path.join(dir,'work'));t.after(async()=>{store.close();await db.writesIdle();fs.rmSync(dir,{recursive:true,force:true});});
 db.remove('tracks','t');
 store.command({id:'del',type:'removeRecord',entity:'tracks',recordId:'t',expectedRevision:0});
 const sql=['v','w'].map(id=>store.get('virtualrivalsystems',id).value.trackId);
 assert.deepEqual(db.data.virtualrivalsystems.map(v=>v.trackId),['','u']);assert.deepEqual(sql,['','u']);
});

test('backups without identities or with duplicate identities are refused',()=>{
 assert.match(Backup.check(Backup.make({drivers:[{name:'A'}]})).error,/without an identity/);
 assert.match(Backup.check(Backup.make({drivers:[{id:'a'},{id:'a'}]})).error,/same identity/);
 assert.equal(Backup.check(Backup.make({drivers:[{id:'a'},{id:'b'}]})).ok,true);
});

test('the old-name migration carries an interrupted race',t=>{
 const app=temp(t),from=path.join(app,'slot-lap-timer');fs.mkdirSync(from);
 fs.writeFileSync(path.join(from,'slot-lap-timer.json'),'{}');fs.writeFileSync(path.join(from,'race-resume.json'),'{"race":1}');fs.writeFileSync(path.join(from,'notes.json'),'{}');
 assert.equal(migrate(app,{strict:true}),true);const to=path.join(app,'slotforge-timing');
 assert.equal(fs.readFileSync(path.join(to,'race-resume.json'),'utf8'),'{"race":1}');assert.ok(fs.existsSync(path.join(to,'slotforge-timing.json')));assert.ok(!fs.existsSync(path.join(to,'notes.json')));
});

test("generic remove('sessions') on JSON takes the laps and car counters along",async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sf-review-')),db=new Database(path.join(dir,'database.json'));t.after(async()=>{await db.writesIdle();fs.rmSync(dir,{recursive:true,force:true});});
 db.data.slotcars=[{id:'c',model:'Car',lapsDriven:2,lapsSinceService:2}];db.data.sessions=[{id:'s',date:'2026-01-01',standings:[{carId:'c'}]}];
 db.data.laps=[{id:'l1',sessionId:'s',carId:'c',time:1},{id:'l2',sessionId:'s',carId:'c',time:1}];db.saveNow();
 await new Repository(db).remove('sessions','s');
 assert.equal(db.data.sessions.length,0);assert.equal(db.data.laps.length,0);assert.equal(db.data.slotcars[0].lapsDriven,0);
});
