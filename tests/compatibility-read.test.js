'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const Database=require('../db'),Json=require('../data-repository'),Client=require('../sqlite-client');
const {migrateCopy}=require('../sqlite-migration'),{forkCopy,WorkingStore}=require('../sqlite-working');
const {SqliteCompatibilityReads,MAX_BYTES}=require('../compatibility-read');
const {createServer}=require('../server');
async function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sf-compat-')),db=new Database(path.join(dir,'source.json'));
 db.data.drivers=Array.from({length:140},(_,i)=>({id:'d'+i,name:'Driver '+i,picture:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',custom:{club:i%2?'A':'B'},extra:[{},[]]}));
 db.data.laps=[{id:'l1',driverId:'d0',carId:'c',trackId:'t',time:1000,valid:true},{id:'l2',driverId:'d0',carId:'c',trackId:'t',time:1200,valid:false}];
 db.data.imagesets=[{id:'images',name:'Artwork',images:['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=']}];
 db.data.customFields.drivers=[{id:'club',label:'Club',type:'text',options:[]}];db.saveNow();
 const bytes=fs.readFileSync(db.file),copy=path.join(dir,'copy'),work=path.join(dir,'work');migrateCopy({source:db.file,destination:copy});forkCopy(copy,work);
 const client=new Client();await client.openWorking(work);const sql=new SqliteCompatibilityReads(client);
 t.after(async()=>{await client.close();await db.writesIdle();assert.deepEqual(fs.readFileSync(db.file),bytes);fs.rmSync(dir,{recursive:true,force:true});});
 return {dir,db,client,sql,json:new Json(db),work};
}
test('compatibility pages preserve full ordered records, media, custom fields and linked counts',async t=>{
 const {sql,json}=await fixture(t);
 for(const entity of ['drivers','laps','imagesets','tracks'])assert.deepEqual(await sql.list(entity),json.list(entity));
 assert.deepEqual(await sql.get('drivers','d0'),json.get('drivers','d0'));assert.equal(await sql.get('drivers','missing'),null);
 assert.deepEqual(await sql.customFields('drivers'),json.customFields('drivers'));
 for(const [e,id] of [['drivers','d0'],['slotcars','c'],['tracks','t'],['teams','any']])assert.equal(await sql.linkedLaps(e,id),json.linkedLaps(e,id));
 assert.deepEqual(await sql.choices('imagesets'),json.choices('imagesets'));
});
test('stale pages reject instead of returning a mixed or truncated list',async t=>{
 const {client}=await fixture(t);const first=await client.compatibilityRead('page','drivers',{});assert.equal(first.items.length,64);
 await client.command({id:'edit',type:'updateRecord',entity:'drivers',recordId:'d139',expectedRevision:0,patch:{name:'Changed'}});
 await assert.rejects(client.compatibilityRead('page','drivers',{cursor:first.next}),e=>e.code==='CATALOGUE_CHANGED');
 await assert.rejects(client.compatibilityRead('page','tracks',{cursor:first.next}),/cursor/);
 await assert.rejects(client.compatibilityRead('page','drivers',{cursor:{...first.next,ordinal:-1}}),/cursor/);
});
test('private metadata and prototype names cannot enter compatibility queries',async t=>{
 const {sql}=await fixture(t);for(const entity of ['@meta','settings','__proto__','constructor']){
  await assert.rejects(sql.list(entity),/Unknown item/);await assert.rejects(sql.get(entity,'settings'),/Unknown item/);await assert.rejects(sql.customFields(entity),/Unknown item/);
 }
});
test('Content Pack choices never reconstruct photo or audio objects',async t=>{
 const {client,work}=await fixture(t);await client.close();const store=new WorkingStore(work);
 try{store.get=()=>{throw Error('Full record read forbidden');};const page=store.compatibilityRead('page','imagesets',{mode:'choices'});assert.deepEqual(page.items,[{id:'images',name:'Artwork'}]);assert(!JSON.stringify(page).includes('base64'));}finally{store.close();}
});

test('Import and Export choices preserve titles without loading media or full sessions',async t=>{
 const {client,work,json,sql}=await fixture(t);
 for(const entity of ['drivers','imagesets','sessions','slotcars'])assert.deepEqual(await sql.transferChoices(entity),json.transferChoices(entity));
 await client.close();const store=new WorkingStore(work);
 try{store.get=()=>{throw Error('Full record read forbidden');};assert.deepEqual(store.compatibilityRead('page','imagesets',{mode:'transfer'}).items,[{id:'images',name:'Artwork'}]);}finally{store.close();}
});
test('oversized compatibility collection fails explicitly, never returning its partial rows',async()=>{
 const sql=new SqliteCompatibilityReads({compatibilityRead:async()=>({items:[{id:'x'}],bytes:MAX_BYTES+1,next:null})});await assert.rejects(sql.list('drivers'),/too large/);
});
test('network routes await worker reads and keep private endpoints and commands protected',async t=>{
 const {sql}=await fixture(t),root=path.resolve(__dirname,'..');let settings={netPassword:'private',theme:'dark'},commands=[];
 const server=createServer({root:path.join(root,'renderer'),appRoot:root,schema:{},getSettings:()=>settings,list:e=>sql.list(e),customFields:e=>sql.customFields(e),getLive:()=>({stat:null,dyn:null}),onCommand:c=>commands.push(c),failDelay:0});
 const port=await server.listen(0,'127.0.0.1');t.after(()=>server.close());const url='http://127.0.0.1:'+port;
 const list=await fetch(url+'/api/list/drivers');assert.equal(list.status,200);assert.equal((await list.json()).length,140);
 assert.equal((await (await fetch(url+'/api/custom/drivers')).json())[0].id,'club');
 assert.equal((await fetch(url+'/api/list/settings')).status,404);assert.equal((await fetch(url+'/api/list/@meta')).status,404);
 assert(!JSON.stringify(await (await fetch(url+'/api/settings')).json()).includes('private'));
 const post=(route,b)=>fetch(url+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)});
 assert.equal((await post('/api/command',{cmd:{type:'start'}})).status,401);
 const {token}=await (await post('/api/auth',{password:'private'})).json();assert.equal((await post('/api/command',{token,cmd:{type:'pause'}})).status,200);assert.equal(commands.length,1);
 settings={...settings,netPassword:'changed'};assert.equal((await post('/api/command',{token,cmd:{type:'start'}})).status,401);
 await sql.client.close();assert.equal((await fetch(url+'/api/list/drivers')).status,400);
});
test('production list IPC awaits an asynchronous repository before measuring and returning rows',async()=>{
 const vm=require('node:vm'),source=fs.readFileSync(path.resolve(__dirname,'../main.js'),'utf8'),line=source.split('\n').find(s=>s.includes("ipcMain.handle('db:list'"));let handler,measured;
 vm.runInNewContext(line,{records:{list:async()=>[{id:'d'}]},watch:{sent:(_e,r)=>measured=r},ipcMain:{handle:(_n,f)=>handler=f}});
 const rows=await handler({},'drivers');assert.deepEqual(rows,[{id:'d'}]);assert.equal(measured,rows);
});
test('Content Pack bridge works without a JSON database using SQLite reads and bulk operations',async t=>{
 const {sql,client,dir}=await fixture(t),Packs=require('../contentpacks'),handlers={},sender={mainFrame:{}},win={webContents:sender,isDestroyed:()=>false};let racing=false,waited=false;
 const bulk=new(require('../bulk-storage').SqliteBulkStorage)(client),lifecycle=await new(require('../storage-lifecycle').StorageLifecycle)(new(require('../storage-lifecycle').SqliteLifecycleBackend)(client)).initialize();
 const file=path.join(dir,'created.slotforge-pack'),store=require('../packipc').register({ipcMain:{handle:(n,f)=>handlers[n]=f},dialog:{showSaveDialog:async()=>({filePath:file,canceled:false})},BrowserWindow:{fromWebContents:()=>win},records:sql,bulk,lifecycle,packFile:path.join(dir,'packs.json'),waitStorage:async()=>{waited=true;await lifecycle.idle();},getMain:()=>win,isRacing:()=>racing,appVersion:'2.0.0'});
 const call=(n,...args)=>handlers['packs:'+n]({sender,senderFrame:sender.mainFrame},...args);
 const pack={format:Packs.FORMAT,apiVersion:1,manifest:{id:'test.compat',name:'Test',author:'Test',license:'CC0',version:'1.0.0',minAppVersion:'2.0.0'},items:{chartdesigns:[{id:'ch',name:'Shared chart',style:'bars'}]}};
 store.install(pack);await call('copy','test.compat');assert(waited);assert.equal((await sql.list('chartdesigns')).length,1);
 const choices=await call('list');assert.deepEqual(choices.choices.imagesets.items,[{id:'images',name:'Artwork'}]);
 await call('create',{imagesets:['images']},pack.manifest,[]);assert.equal(Packs.validate(JSON.parse(fs.readFileSync(file)),'2.0.0').items.imagesets[0].images[0],'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=');
 racing=true;await assert.rejects(call('copy','test.compat'),/Finish/);assert.equal((await sql.list('chartdesigns')).length,1);
 await assert.rejects(handlers['packs:list']({sender:{}}),/main app/);
});


test('byte-sized pages preserve every large record exactly once',async t=>{
 const {client,sql}=await fixture(t),text='x'.repeat(2300000);
 for(let i=0;i<3;i++)await client.command({id:'large-'+i,type:'addRecord',entity:'layouts',item:{name:'Large '+i,notes:text}});
 const first=await client.compatibilityRead('page','layouts',{});assert.equal(first.items.length,1);assert(first.next);
 const all=await sql.list('layouts');assert.deepEqual(all.map(r=>r.name),['Large 0','Large 1','Large 2']);assert(all.every(r=>r.notes===text));
});
test('oversized records are rejected before reconstructing media',async t=>{
 const {client,work}=await fixture(t);await client.close();const store=new WorkingStore(work),statement=store.statement.bind(store);
 try{store.statement=sql=>sql.includes('SELECT length(CAST(shape AS BLOB))')?{get:()=>({n:65*1024*1024})}:statement(sql);store.get=()=>{throw Error('Media should not be read');};assert.throws(()=>store.compatibilityRead('page','drivers',{}),/too large/);}finally{store.close();}
});
test('a race starting during asynchronous pack preparation cancels export and releases the action lock',async t=>{
 const {dir}=await fixture(t),handlers={},sender={mainFrame:{}},win={webContents:sender,isDestroyed:()=>false};let racing=false,release,dialogs=0;
 const bulk={createPack:()=>new Promise(r=>release=r)};
 require('../packipc').register({ipcMain:{handle:(n,f)=>handlers[n]=f},dialog:{showSaveDialog:async()=>{dialogs++;return {canceled:true};}},BrowserWindow:{fromWebContents:()=>win},records:{choices:async()=>[]},bulk,packFile:path.join(dir,'async-packs.json'),waitStorage:async()=>{},getMain:()=>win,isRacing:()=>racing,appVersion:'2.0.0'});
 const call=()=>handlers['packs:create']({sender,senderFrame:sender.mainFrame},{},{},[]);
 const preparing=call();racing=true;release({});await assert.rejects(preparing,/Finish/);assert.equal(dialogs,0);
 racing=false;bulk.createPack=async()=>{throw Error('Read failed');};await assert.rejects(call(),/Read failed/);assert.equal(dialogs,0);
 bulk.createPack=async()=>({manifest:{id:'test',version:'1'}});assert.deepEqual(await call(),{saved:false});assert.equal(dialogs,1);
});
