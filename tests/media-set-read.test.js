'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const Database=require('../db'),Repository=require('../data-repository'),{migrateCopy}=require('../sqlite-migration'),{forkCopy,WorkingStore}=require('../sqlite-working'),UI=require('../renderer/editordata'),M=require('../media-set-read');
const picture='data:image/png;base64,AQID',sound='data:audio/wav;base64,BAUG';
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sf-media-read-')),db=new Database(path.join(dir,'source.json'));
 db.data.imagesets=Array.from({length:203},(_,i)=>({id:'image-'+i,name:'Pictures '+i,kind:i%2?'flags':'fuel',steps:4,images:i%2?{red:picture,green:'',yellow:null,empty:{}}:[picture,null,'',picture]}));
 db.data.audiosets=Array.from({length:203},(_,i)=>({id:'audio-'+i,name:'Sounds '+i,voice:i%2?'Test voice':'',calls:{start:{on:true,lines:[{text:'Hello',file:sound}]},stop:{on:false,file:sound},lap:{},missing:null,disabled:false,legacy:true},ambient:{music:{file:sound}}}));
 db.data.audiosets[0].calls={...require('../renderer/sound').defaultSet().calls,...db.data.audiosets[0].calls};
 db.data.audiosets[1].calls=[{on:false,lines:[{file:sound}]},{on:0},{},null];
 db.saveNow();const original=fs.readFileSync(db.file),copy=path.join(dir,'copy'),work=path.join(dir,'work');migrateCopy({source:db.file,destination:copy});forkCopy(copy,work);const store=new WorkingStore(work),repo=new Repository(db);
 t.after(async()=>{store.close();await db.writesIdle();assert.deepEqual(fs.readFileSync(db.file),original);fs.rmSync(dir,{recursive:true,force:true});});return {db,store,repo};
}
const plain=p=>{p=structuredClone(p);delete p.revision;if(p.next)delete p.next.revision;return p;};
test('all media summaries retain order, names, slot presence and enabled calls across JSON and SQLite pages',async t=>{
 const {db,repo,store}=fixture(t);
 for(const entity of ['imagesets','audiosets']){
  let a=null,b=null,items=[];do{const x=repo.editorRead('media',entity,{cursor:a}),y=store.editorRead('media',entity,{cursor:b});assert.deepEqual(plain(y),plain(x));assert(y.items.length<=100);items.push(...y.items);a=x.next;b=y.next;}while(a);
  assert.deepEqual(items,db.list(entity).map(row=>M.summary(entity,row)));assert.equal(items.length,203);assert(!JSON.stringify(items).includes('base64'));assert(!JSON.stringify(items).includes('Hello'));
 }
 assert.deepEqual(await UI.choices({editorRead:(...args)=>store.editorRead(...args)},'imagesets','media'),db.list('imagesets').map(row=>M.summary('imagesets',row)));
});
test('overview reads never fetch full records, media bytes or audio sentence bodies',t=>{
 const {store}=fixture(t),statement=store.statement.bind(store);store.get=()=>{throw Error('Full record requested');};
 const paths=[];store.statement=sql=>{
  assert(!/SELECT[^;]*\b(bytes|original|\*)\b[^;]*FROM (assets|media_blobs)/i.test(sql),'Unexpected media payload query: '+sql);
  const stmt=statement(sql);return new Proxy(stmt,{get(target,key){const value=Reflect.get(target,key);if(typeof value!=='function')return value;return (...args)=>{if(sql.startsWith('SELECT json FROM fields'))paths.push(args.at(-1));return value.apply(target,args);};}});
 };
 for(const entity of ['imagesets','audiosets'])store.editorRead('media',entity);
 assert(!paths.some(p=>/lines|ambient|file/.test(p)));assert.equal(store.statement('PRAGMA integrity_check').get().integrity_check,'ok');
});
test('targeted full reads retain exact pictures and audio for editing/duplication',t=>{
 const {db,store}=fixture(t);
 for(const entity of ['imagesets','audiosets'])for(const row of db.list(entity).slice(0,2))assert.deepEqual(store.compatibilityRead('get',entity,row.id),row);
 assert.equal(store.compatibilityRead('get','imagesets','deleted'),null);
});
test('invalid media requests and stale or cross-kind cursors are rejected',t=>{
 const {repo,store}=fixture(t);
 for(const source of [repo,store]){
  const p=source.editorRead('media','imagesets');
  for(const [kind,entity,cursor] of [['media','tracks',null],['media','audiosets',p.next],['page','imagesets',p.next],['media','imagesets',{...p.next,kind:'editor'}]])assert.throws(()=>source.editorRead(kind,entity,{cursor}));
  assert.throws(()=>source.editorRead('media','imagesets',{cursor:{...p.next,revision:'old'}}),e=>e.code==='CATALOGUE_CHANGED');
 }
});
test('changed metadata pages restart once without duplicates and repeated changes surface an error',async()=>{
 let count=0;const api={editorRead:async(kind,entity,{cursor})=>{assert.equal(kind,'media');count++;if(count===2)throw Object.assign(Error('changed'),{code:'CATALOGUE_CHANGED'});return cursor?{items:[{id:'b'}],next:null}:{items:[{id:'a'}],next:{ordinal:0}};}};
 assert.deepEqual(await UI.choices(api,'imagesets','media'),[{id:'a'},{id:'b'}]);assert.equal(count,4);
 await assert.rejects(UI.choices({editorRead:async()=>{throw Object.assign(Error('changed'),{code:'CATALOGUE_CHANGED'});}},'imagesets','media'),/changed/);
});
