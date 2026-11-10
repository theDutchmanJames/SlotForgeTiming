'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const Database=require('../db'),Repository=require('../data-repository'),{migrateCopy}=require('../sqlite-migration'),{forkCopy,WorkingStore}=require('../sqlite-working'),UI=require('../renderer/editordata');
const picture='data:image/png;base64,AQID',gallery='data:image/png;base64,BAUG';
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'timing-editor-read-')),db=new Database(path.join(dir,'source.json'));
 db.data.drivers=[{id:'empty',name:'No photo'},{id:'driver',name:'Driver',avatar:picture,gallery:[gallery]}];
 db.data.slotcars=[{id:'car',model:'Car',picture,gallery:[gallery],paddock:{capture:{private:'unused'}}}];
 db.data.teams=[{id:'team',name:'Team',picture,gallery:[gallery]}];
 db.data.tracks=[{id:'track',name:'Track',lanes:2,targetLap:8,laneLengths:'20,21',picture:gallery,trackDesign:{empty:{},routes:[{points:[[1,2],[3,4]]}],artwork:{image:picture}}}];
 db.data.layouts=Array.from({length:203},(_,i)=>({id:'layout'+i,name:'Layout '+i,note:'Keep',ratioW:16,ratioH:9,widgets:[{type:'fuel',opt:{imageSet:'fuel'}}],bgImage:gallery}));
 db.data.imagesets=[{id:'fuel',name:'Fuel',kind:'fuel',images:[picture]},{id:'unused',name:'Unused',kind:'flag',images:{green:gallery}}];db.saveNow();const before=fs.readFileSync(db.file);
 const copy=path.join(dir,'copy'),work=path.join(dir,'work');migrateCopy({source:db.file,destination:copy});forkCopy(copy,work);const store=new WorkingStore(work),repo=new Repository(db);
 t.after(async()=>{store.close();await db.writesIdle();assert.deepEqual(fs.readFileSync(db.file),before);fs.rmSync(dir,{recursive:true,force:true});});return {db,store,repo,dir};
}
const plain=p=>{p=structuredClone(p);delete p.revision;if(p.next)delete p.next.revision;return p;};
test('editor metadata pages match JSON/SQLite without loading layouts, gallery or imported geometry',t=>{
 const {repo,store}=fixture(t);store.get=()=>{throw Error('Full record requested');};
 for(const entity of ['layouts','tracks','teams','imagesets']){
  let a=null,b=null,total=0;do{const x=repo.editorRead('page',entity,{cursor:a}),y=store.editorRead('page',entity,{cursor:b});assert.deepEqual(plain(x),plain(y));assert(!JSON.stringify(y).includes('base64'));total+=y.items.length;a=x.next;b=y.next;}while(a);assert.equal(total,entity==='layouts'?203:entity==='imagesets'?2:1);
 }
 assert.equal(store.editorRead('page','tracks').items[0].hasTrackDesign,true);assert.equal(store.editorRead('page','layouts').items[0].widgetCount,1);
});
test('targeted framing samples and track preserve needed media, arrays and empty objects without whole-record reads',t=>{
 const {repo,store}=fixture(t);store.get=()=>{throw Error('Full record requested');};
 for(const entity of ['drivers','slotcars','teams'])assert.deepEqual(store.editorRead('sample',entity),repo.editorRead('sample',entity));
 const track=store.editorRead('track','tracks','track');assert.deepEqual(track,repo.editorRead('track','tracks','track'));assert.equal(track.trackDesign.artwork.image,picture);assert(!('picture'in track));assert.deepEqual(track.trackDesign.empty,{});assert.equal(store.editorRead('track','tracks','deleted'),null);
});
test('oversized unrelated media reproduces compatibility error but cannot prevent layout choices or editor data loading',async t=>{
 const {store}=fixture(t),bytes=Buffer.alloc(34*1024*1024,7),digest=crypto.createHash('sha256').update(bytes).digest('hex');
 // A valid large shared blob, referenced only by unrelated galleries/backgrounds.
 store.statement('INSERT INTO media_blobs(digest,bytes) VALUES(?,?)').run(digest,bytes);
 store.statement('UPDATE asset_refs SET digest=?,original=NULL WHERE digest=?').run(digest,crypto.createHash('sha256').update(Buffer.from([4,5,6])).digest('hex'));
 assert.throws(()=>store.compatibilityRead('page','slotcars',{}),/too large for a compatibility list/);
 assert.throws(()=>store.compatibilityRead('page','layouts',{}),/too large for a compatibility list/);
 const api={editorRead:(...a)=>Promise.resolve(store.editorRead(...a)),list:e=>{assert(['raceclasses','rowdesigns','chartdesigns','customwidgets'].includes(e));return [];},getRecord:()=>{throw Error('Unneeded full record');}};
 const ed={draft:{widgets:[]}};await UI.load(api,ed);assert.equal(ed.cars[0].picture,picture);assert.equal(ed.previewTracks[0].name,'Track');assert(!ed.previewTracks[0].trackDesign);assert.equal((await UI.choices(api,'layouts')).length,203);assert.equal(store.db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
});
test('editor cursors reject wrong collections and changed revisions; invalid reads are refused',t=>{
 const {store}=fixture(t),page=store.editorRead('page','layouts');assert.throws(()=>store.editorRead('page','tracks',{cursor:page.next}),/cursor/);
 assert.throws(()=>store.editorRead('page','layouts',{cursor:{...page.next,revision:'old'}}),e=>e.code==='CATALOGUE_CHANGED');
 for(const args of [['page','laps'],['sample','layouts'],['track','drivers','driver'],['track','tracks',3],['bad','tracks']])assert.throws(()=>store.editorRead(...args));
});
test('preview fetches only referenced sets and selected tracks, follows nested rows, caches and retries failed loads',async()=>{
 const calls=[],api={editorRead:async(k,e,id)=>{calls.push(id);return {id,trackDesign:{document:{}}};},getRecord:async(e,id)=>{calls.push(id);return {id,images:[picture]};}};
 const ed={draft:{widgets:[{type:'leaderboard',opt:{design:'row'}}]},rowDesigns:[{id:'row',widgets:[{type:'textlane',opt:{composition:{root:{kind:'component',component:'fuel',options:{imageSet:'fuel'}}}}}]}],chartDesigns:[{id:'chart',style:'track'}],imageSets:[{id:'fuel'},{id:'unused'}],previewTracks:[{id:'track'},{id:'other'}],previewTrackId:'track'};
 assert(await UI.refresh(api,ed));assert.deepEqual(calls,['fuel']);assert.equal(await UI.refresh(api,ed),false);
 ed.draft.widgets.push({type:'racechart',opt:{chartDesign:'chart'}});assert(await UI.refresh(api,ed));ed.previewTrackId='other';await UI.refresh(api,ed);assert.deepEqual(calls,['fuel','track','other']);
 ed.draft.widgets.push({type:'fuel',opt:{imageSet:'unused'}});let fail=true;api.getRecord=async()=>{if(fail)throw Error('Temporary read failure');return {id:'unused',images:[picture]};};await assert.rejects(UI.refresh(api,ed),/Temporary/);fail=false;assert(await UI.refresh(api,ed));assert.equal(ed.imageSets[1].images[0],picture);
});
test('metadata pagination restarts on revision change without mixing old choices',async()=>{
 let n=0;const api={editorRead:async()=>{n++;if(n===1)return {items:[{id:'old'}],next:{}};if(n===2)throw Object.assign(Error('changed'),{code:'CATALOGUE_CHANGED'});return {items:[{id:'new'}],next:null};}};assert.deepEqual(await UI.choices(api,'layouts'),[{id:'new'}]);
});
test('concurrent preview refreshes share reads and both repaint; abandoned asset generations cannot overwrite newer data',async()=>{
 let resolve,calls=0;const api={editorRead(){},getRecord:()=>{calls++;return new Promise(r=>resolve=r);}},ed={draft:{widgets:[{type:'fuel',opt:{imageSet:'fuel'}}]},imageSets:[{id:'fuel'}],previewTracks:[]};
 const first=UI.refresh(api,ed),second=UI.refresh(api,ed);await Promise.resolve();assert.equal(calls,1);resolve({id:'fuel',images:[picture]});assert.deepEqual(await Promise.all([first,second]),[true,true]);
 ed.previewLoads=new Map();const stale=UI.refresh(api,ed);await Promise.resolve();ed.previewLoads=new Map();ed.imageSets=[{id:'fuel',name:'New choices'}];resolve({id:'fuel',images:['stale']});assert.equal(await stale,false);assert.equal(ed.imageSets[0].name,'New choices');assert(!ed.imageSets[0].images);
});
