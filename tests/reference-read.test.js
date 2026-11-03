'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const Database=require('../db'),Repository=require('../data-repository'),Client=require('../sqlite-client'),{migrateCopy}=require('../sqlite-migration'),{forkCopy,WorkingStore}=require('../sqlite-working');
const R=require('../reference-read'),media='data:image/png;base64,'+Buffer.alloc(32768,7).toString('base64');
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'timing-references-')),db=new Database(path.join(dir,'source.json'));
 db.data.drivers=Array.from({length:425},(_,i)=>({id:'d'+i,name:'Driver '+i,driverType:i===0?'virtual':'human',virtualRivalSystem:'rival',raceClass:'gt3',avatar:media,custom:{club:'private'},unknown:'keep'}));
 db.data.tracks=[{id:'t',name:'Circuit',lanes:2,length:20,laneLengths:[20,21],minLap:2,targetLap:5,notes:'complete notes',picture:media,trackDesign:{artwork:media,lanes:[{points:[[0,0],[1,1]]}],tuning:{speed:1}}}];
 db.data.slotcars=[{id:'c',brand:'Car',raceClass:'gt3',serviceInterval:100,lapsDriven:90,picture:media,extraPictures:[media],paddock:{databaseId:'host',carId:'remote',name:'Paddock car',archived:true,configuration:{photo:media}}},{id:'empty',paddock:{}},{id:'null',paddock:null}];
 db.data.teams=[{id:'team',name:'Team',drivers:['d1','d2'],raceClass:'gt3',picture:media}];
 db.data.layouts=[{id:'layout',name:'Layout',laneColors:[{bg:'#ff0000'}],widgets:[{picture:media}]}];db.data.audiosets=[{id:'audio',name:'Audio',calls:{lap:{sound:'data:audio/wav;base64,'+Buffer.alloc(100000).toString('base64')}}}];db.data.imagesets=[{id:'image',name:'Weather',kind:'weather',images:{dry:media}}];db.saveNow();
 const copy=path.join(dir,'copy'),work=path.join(dir,'work');migrateCopy({source:db.file,destination:copy});forkCopy(copy,work);const store=new WorkingStore(work),repo=new Repository(db);
 t.after(async()=>{store.close();await db.writesIdle();fs.rmSync(dir,{recursive:true,force:true});});return {db,store,repo,work};
}
test('reference pages preserve all choices and relevant metadata with JSON/SQLite parity and no embedded media',t=>{
 const {db,repo,store}=fixture(t);
 for(const entity of R.ENTITIES){const a=repo.referencePage(entity),b=store.referencePage(entity);assert.deepEqual(a.items,b.items);assert.ok(!JSON.stringify(b).includes('base64'));assert.ok(!JSON.stringify(b).includes('configuration'));
  const ids=db.data[entity].slice(0,3).map(r=>r.id);assert.deepEqual(repo.referenceDetails(entity,ids,a.revision),db.data[entity].slice(0,3));assert.deepEqual(store.referenceDetails(entity,ids,b.revision),db.data[entity].slice(0,3));
 }
 for(const reader of [repo,store]){const ids=[];let cursor=null;do{const p=reader.referencePage('drivers',{cursor,limit:173});ids.push(...p.items.map(x=>x.id));cursor=p.next;}while(cursor);assert.deepEqual(ids,db.data.drivers.map(x=>x.id));}
 const refs=repo.referencePage('drivers');assert.ok(Buffer.byteLength(JSON.stringify(refs))<Buffer.byteLength(JSON.stringify(db.data.drivers))/100);
 assert.equal(store.referencePage('slotcars').items[0].paddock.archived,true);assert.deepEqual(store.referencePage('tracks').items[0].laneLengths,[20,21]);assert.equal(store.referencePage('drivers').items[0].virtualRivalSystem,'rival');
});
test('selected details are complete and detached; stale selection, invalid entities and oversized requests fail closed',t=>{
 const {db,repo,store}=fixture(t);
 for(const reader of [repo,store]){
  const rev=reader.referencePage('tracks').revision,full=reader.referenceDetails('tracks',['t'],rev);assert.deepEqual(full[0],db.data.tracks[0]);assert.deepEqual(reader.referenceDetails('tracks',['gone'],rev),[null]);
  full[0].laneLengths[0]=999;assert.equal(reader.referencePage('tracks').items[0].laneLengths[0],20);
  assert.throws(()=>reader.referencePage('sessions'),/Unsupported/);assert.throws(()=>reader.referencePage('drivers',{limit:201}),/Invalid/);assert.throws(()=>reader.referenceDetails('tracks',Array.from({length:33},(_,i)=>String(i)),rev),/Invalid/);
  assert.throws(()=>reader.referenceDetails('tracks',['t'],rev+'x'),{code:'CATALOGUE_CHANGED'});
 }
 const p=repo.referencePage('drivers');db.update('drivers','d0',{name:'Changed'});assert.throws(()=>repo.referencePage('drivers',{cursor:p.next}),{code:'CATALOGUE_CHANGED'});
 const q=store.referencePage('drivers');store.command({id:'edit',type:'updateRecord',entity:'drivers',recordId:'d0',expectedRevision:0,patch:{name:'Changed'}});assert.throws(()=>store.referencePage('drivers',{cursor:q.next}),{code:'CATALOGUE_CHANGED'});
 assert.throws(()=>store.referencePage('teams',{cursor:q.next}),/Invalid/);
});
test('SQLite reference queries read only projected leaves and never get full records or blobs',t=>{
 const {store}=fixture(t);store.get=store.asset=()=>{throw Error('Broad read');};for(const e of R.ENTITIES)assert.ok(store.referencePage(e).items.length);
});
test('worker preserves selected artwork and reference metadata',async t=>{
 const {work}=fixture(t),client=new Client();try{await client.openWorking(work);const p=await client.referencePage('tracks');assert.equal(p.items[0].trackDesign,undefined);const [t]=await client.referenceDetails('tracks',['t'],p.revision);assert.equal(t.trackDesign.artwork,media);assert.equal(t.trackDesign.tuning.speed,1);}finally{await client.close();}
});
function helpers(api){const source=fs.readFileSync(path.join(__dirname,'../renderer/app.js'),'utf8'),context=vm.createContext({api});vm.runInContext(source.slice(source.indexOf('const REFERENCE_ENTITIES='),source.indexOf("const DEFAULT_NAME =")),context);return context;}
test('renderer loads every page and retries stale reads without duplicating records',async()=>{
 let calls=0;const c=helpers({referencePage:async(_e,{cursor})=>{calls++;if(calls===2)throw Error('The catalogue changed. Refresh the list before continuing.');return cursor?{items:[{id:'2'}],revision:'new',next:null}:{items:[{id:'1'}],revision:'new',next:{ordinal:0}};}});
 assert.equal(JSON.stringify(await vm.runInContext("readReferenceSet('drivers')",c)),JSON.stringify({items:[{id:'1'},{id:'2'}],revision:'new'}));assert.equal(calls,4);
});
test('reference groups cannot silently combine database revisions and retries are bounded',async()=>{
 let count=0;const c=helpers({referencePage:async()=>({items:[],revision:String(++count),next:null})});await assert.rejects(vm.runInContext("readReferenceGroups(['tracks','drivers'])",c),/catalogue changed/);assert.equal(count,6);
});
test('legacy adapters and non-reference collections retain their complete data',async()=>{
 const c=helpers({list:async()=>[{id:'x',unknown:42}]});assert.equal(JSON.stringify(await vm.runInContext("referenceList('sessions')",c)),'[{"id":"x","unknown":42}]');
});
