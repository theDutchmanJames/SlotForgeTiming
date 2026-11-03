'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const Database=require('../db'),Repository=require('../data-repository'),Client=require('../sqlite-client');
const {migrateCopy}=require('../sqlite-migration'),{forkCopy,WorkingStore}=require('../sqlite-working');
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
function fixture(t,mutate=()=>{}){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'timing-catalogue-')),db=new Database(path.join(dir,'source.json'));
  db.data.drivers=Array.from({length:125},(_,i)=>({id:'d'+i,name:'Driver '+i,avatar:png,avatarFrame:{zoom:2,x:0,y:0},custom:{club:'Club '+i},unknown:{history:'large'}}));
  db.data.slotcars=[{id:'local',model:'Local',picture:png,extraPictures:[png,png],custom:{}},{id:'remote',model:'Remote',paddock:{databaseId:'host',carId:'x',configuration:{photo:png}},picture:png}];
  db.data.tracks=[{id:'t',name:'Track',picture:png,trackDesign:{artwork:png,points:[1,2,3]},notes:'a'.repeat(100)}];
  db.data.teams=[{id:'team',name:'Team',drivers:['d1','d2'],picture:png}];
  db.data.customFields.drivers=[{id:'club',label:'Club',type:'text'}];mutate(db);db.saveNow();
  const copy=path.join(dir,'copy'),work=path.join(dir,'work');migrateCopy({source:db.file,destination:copy});forkCopy(copy,work);
  const store=new WorkingStore(work),repo=new Repository(db),clients=[];
  t.after(async()=>{for(const c of clients)await c.close().catch(()=>{});store.close();await db.writesIdle();fs.rmSync(dir,{recursive:true,force:true});});
  return {db,repo,store,dir,work,client(){const c=new Client();clients.push(c);return c;}};
}
function content(page){return page.items;}
test('JSON and SQLite catalogues have identical media-free summaries and natural ordering',t=>{
  const {repo,store}=fixture(t);
  for(const entity of ['drivers','tracks','slotcars','teams']){
    const a=repo.catalogue(entity),b=store.catalogue(entity);assert.deepEqual(content(a),content(b));
    assert.ok(!JSON.stringify(a).includes('base64'));assert.ok(!JSON.stringify(a).includes('trackDesign'));
  }
  assert.deepEqual(store.catalogue('drivers',{limit:4}).items.map(r=>r.record.name),['Driver 0','Driver 1','Driver 2','Driver 3']);
  assert.deepEqual(store.catalogue('slotcars').items.map(r=>r.record.id),['local']);
  assert.equal(store.catalogue('slotcars').items[0].galleryCount,2);
});
test('paging has no duplicates and rejects changed or cross-query cursors',t=>{
  const {repo,store,db}=fixture(t);
  for(const reader of [repo,store]){let cursor=null,ids=[];do{const p=reader.catalogue('drivers',{limit:17,cursor});ids.push(...p.items.map(x=>x.record.id));cursor=p.next;}while(cursor);assert.equal(ids.length,125);assert.equal(new Set(ids).size,125);}
  const page=store.catalogue('drivers',{limit:1});assert.throws(()=>store.catalogue('drivers',{search:'other',cursor:page.next}),/cursor/);
  store.command({id:'rename',type:'updateRecord',entity:'drivers',recordId:'d1',patch:{name:'AA'},expectedRevision:0});
  assert.throws(()=>store.catalogue('drivers',{cursor:page.next}),{code:'CATALOGUE_CHANGED'});
  const json=repo.catalogue('drivers',{limit:1});db.update('drivers','d1',{name:'AA'});assert.throws(()=>repo.catalogue('drivers',{cursor:json.next}),/catalogue changed/i);
  assert.equal(store.catalogue('drivers').items[0].record.name,'AA');
});
test('search treats punctuation as text, folds accents, and keeps identical-name rows',t=>{
  const {store}=fixture(t);
  for(const [i,name] of ['Éclair 10','eclair 2','eclair 2','100% _ literal'].entries())store.command({id:'add'+i,type:'addRecord',entity:'drivers',item:{name}});
  assert.deepEqual(store.catalogue('drivers',{search:'ÉCLAIR'}).items.map(x=>x.record.name),['eclair 2','eclair 2','Éclair 10']);
  assert.equal(store.catalogue('drivers',{search:'% _'}).items.length,1);
  for(const limit of [0,101,NaN])assert.throws(()=>store.catalogue('drivers',{limit}),/query/);
  assert.throws(()=>store.catalogue('laps'),/catalogue/);
});
test('only requested pictures load, stale image requests are refused, full details remain intact',t=>{
  const {repo,store,db}=fixture(t),page=store.catalogue('tracks');
  const get=store.get;store.get=()=>{throw Error('Whole-record read in catalogue');};const asset=store.asset;store.asset=()=>{throw Error('BLOB read in catalogue');};
  assert.equal(store.catalogue('tracks').items.length,1);store.asset=asset;store.get=get;
  assert.equal(store.cataloguePicture('tracks','t',page.revision),png);
  assert.equal(repo.cataloguePicture('tracks','t',repo.catalogue('tracks').revision),png);
  assert.equal(store.get('tracks','t',true).value.trackDesign.artwork,png);assert.equal(db.getRecord('tracks','t').notes.length,100);
  store.command({id:'edit',type:'updateRecord',entity:'tracks',recordId:'t',expectedRevision:0,patch:{name:'Changed'}});
  assert.throws(()=>store.cataloguePicture('tracks','t',page.revision),/catalogue changed/i);
});
test('index updates roll back with writes and survive reopen, deletion and linked-car changes',t=>{
  const {store,work}=fixture(t);store.checkpoint=step=>{if(step==='before-commit')throw Error('disk failure');};
  assert.throws(()=>store.command({id:'fail',type:'updateRecord',entity:'drivers',recordId:'d1',expectedRevision:0,patch:{name:'ZZ'}}),/disk failure/);
  assert.equal(store.catalogue('drivers',{search:'ZZ'}).items.length,0);store.checkpoint=()=>{};
  store.command({id:'delete',type:'removeRecord',entity:'drivers',recordId:'d1',expectedRevision:0});assert.ok(!store.catalogue('drivers',{search:'Driver 1'}).items.some(x=>x.record.id==='d1'));
  store.close();const reopened=new WorkingStore(work);try{assert.equal(reopened.catalogue('drivers',{limit:100}).items.length,100);}finally{reopened.close();}
});
test('actual worker exposes catalogue pages and selected media without enabling read-copy writes',async t=>{
  const f=fixture(t),c=f.client();await c.openWorking(f.work);const page=await c.catalogue('drivers',{limit:2});assert.equal(page.items.length,2);
  assert.equal(await c.cataloguePicture('drivers','d1',page.revision),png);
});

test('cursors cannot be used against a different database even at the same revision',t=>{
  const a=fixture(t),b=fixture(t);
  assert.throws(()=>b.store.catalogue('drivers',{cursor:a.store.catalogue('drivers',{limit:1}).next}),{code:'CATALOGUE_CHANGED'});
  assert.throws(()=>b.repo.catalogue('drivers',{cursor:a.repo.catalogue('drivers',{limit:1}).next}),{code:'CATALOGUE_CHANGED'});
});

test('legacy empty linked metadata remains excluded and frame summaries cannot mutate JSON records',t=>{
  const {db,repo,store}=fixture(t,db=>db.data.slotcars.push({id:'empty',model:'Empty link',paddock:{}}));
  assert.equal(repo.catalogue('slotcars').items.length,1);assert.equal(store.catalogue('slotcars').items.length,1);
  const page=repo.catalogue('drivers');page.items[0].record.avatarFrame.zoom=99;assert.equal(db.data.drivers[0].avatarFrame.zoom,2);
});

test('version 2 forks gain the catalogue index without changing the recovery copy',t=>{
  const {store,dir,work}=fixture(t),copy=path.join(dir,'copy','timing.sqlite'),before=fs.readFileSync(copy);
  store.db.exec("DROP TABLE history_laps;DROP TABLE session_finalizations; DROP TABLE history_sessions;DROP TABLE history_wins;DROP TABLE catalogue_index;DELETE FROM info WHERE key='catalogueIdentity';UPDATE info SET value='2' WHERE key='workingFormat'");store.close();
  const reopened=new WorkingStore(work);try{assert.equal(reopened.catalogue('drivers').items.length,48);assert.deepEqual(fs.readFileSync(copy),before);}finally{reopened.close();}
});

test('lazy pictures stay globally bounded across page changes and discard stale responses',async()=>{
  const vm=require('node:vm'),source=fs.readFileSync(path.join(__dirname,'../renderer/database.js'),'utf8');
  const pending=[],observers=[];let current=true;
  class Observer{constructor(callback){this.callback=callback;this.images=[];observers.push(this);}observe(img){this.images.push(img);}unobserve(){}disconnect(){this.disconnected=true;}}
  const context=vm.createContext({IntersectionObserver:Observer,api:{cataloguePicture:(_e,id)=>new Promise(resolve=>pending.push({id,resolve}))}});
  vm.runInContext(source.slice(source.indexOf('let cataloguePictureActive='),source.indexOf('async function mountManager')),context);
  const mount=vm.runInContext('loadCataloguePictures',context);
  const images=prefix=>Array.from({length:12},(_,i)=>({dataset:{cataloguePicture:prefix+i},isConnected:true}));
  const a=images('a'),b=images('b'),stop=mount({querySelectorAll:()=>a},'drivers','1',()=>current);
  assert.equal(pending.length,0);observers[0].callback(a.map(target=>({target,isIntersecting:true})));assert.equal(pending.length,4);
  stop();const stop2=mount({querySelectorAll:()=>b},'drivers','2',()=>current);observers[1].callback(b.map(target=>({target,isIntersecting:true})));assert.equal(pending.length,4);
  pending.slice(0,4).forEach(p=>p.resolve(png));await new Promise(setImmediate);assert.equal(pending.length,8);assert.ok(a.every(img=>!img.src));
  current=false;pending.slice(4).forEach(p=>p.resolve(png));await new Promise(setImmediate);assert.equal(pending.length,8);assert.ok(b.every(img=>!img.src));stop2();
});

test('QA diagnostics tolerate closed console pipes and retain unexpected failures in a file',t=>{
  const {spawnSync}=require('node:child_process'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'timing-qa-log-')),log=path.join(dir,'diagnostics.log');
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const script=`let fatal=0;require(${JSON.stringify(path.resolve(__dirname,'../tools/qa/file-diagnostics.cjs'))})(${JSON.stringify(log)},()=>fatal++);
    process.stdout.emit('error',Object.assign(Error('closed output'),{code:'EPIPE'}));process.stderr.emit('error',Object.assign(Error('closed error pipe'),{code:'EPIPE'}));
    console.error('Recorded diagnostic');if(fatal)process.exit(2);process.stderr.emit('error',Object.assign(Error('other error'),{code:'EIO'}));if(fatal!==1)process.exit(3);`;
  const child=spawnSync(process.execPath,['-e',script],{encoding:'utf8'});assert.equal(child.status,0,child.stderr);
  const text=fs.readFileSync(log,'utf8');assert.match(text,/Recorded diagnostic/);assert.match(text,/other error/);
});

test('linking a local car to Paddock removes it from the local catalogue atomically',t=>{
  const {store}=fixture(t),profile=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/paddock/fixtures/profile-car-a.json')));
  store.command({id:'connect',type:'setPaddockConnection',expectedRevision:0,connection:{databaseId:profile.databaseId,address:'127.0.0.1:51234',name:'Fixture',timing:true,results:true}});
  assert.equal(store.catalogue('slotcars').items.length,1);
  store.command({id:'link',type:'linkPaddockCar',localId:'local',expectedRevision:0,profile});
  assert.equal(store.catalogue('slotcars').items.length,0);
  assert.equal(store.get('slotcars','local',true).value.paddock.carId,profile.car.id);
});
