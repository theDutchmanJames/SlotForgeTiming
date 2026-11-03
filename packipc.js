// A narrow, main-window-only bridge for inert content packs.
const fs=require('node:fs'),path=require('node:path');
const Packs=require('./contentpacks'),Database=require('./db'),schema=require('./schema');
function register({ipcMain,dialog,BrowserWindow,db,lifecycle,records,bulk,packFile,waitStorage,getMain,isRacing,appVersion}){
 bulk ||= new (require('./bulk-storage').JsonBulkStorage)(db);
 records ||= new (require('./data-repository'))(db);
 packFile ||= db.file.replace(/\.json$/,'')+'.packs.json';
 waitStorage ||= ()=>db.fileIdle();
 const store=new Packs.Store(packFile,appVersion);let pending=null,busy=false;
 const owner=e=>{const win=getMain();if(!win||win.isDestroyed()||e.sender!==win.webContents||e.senderFrame!==undefined&&e.senderFrame!==win.webContents.mainFrame)throw Error('Content packs are managed from the main app window.');};
 const idle=()=>{if(isRacing())throw Error('Finish the race and finalise its results before changing content packs.');};
 const handle=(name,fn,mutation=false)=>ipcMain.handle('packs:'+name,async(e,...args)=>{owner(e);if(mutation){idle();if(busy)throw Error('Another pack operation is in progress.');busy=true;}try{return await fn(e,...args);}finally{if(mutation)busy=false;}});
 handle('list',async()=>{const choices=[];for(const entity of Packs.ENTITIES)choices.push([entity,{label:schema[entity].plural,items:await records.choices(entity)}]);return {...store.list(),raceLocked:isRacing(),choices:Object.fromEntries(choices)};});
 handle('open',async e=>{pending=null;const r=await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender),{properties:['openFile'],filters:[{name:'SlotForge content pack',extensions:['slotforge-pack']}]});idle();if(r.canceled||!r.filePaths.length)return {canceled:true};const file=r.filePaths[0];if(fs.statSync(file).size>Packs.MAX_BYTES)throw Error('Pack exceeds 32 MB.');let raw;try{raw=JSON.parse(fs.readFileSync(file,'utf8'));}catch{throw Error('This is not a readable JSON content pack.');}pending=Packs.validate(raw,appVersion);const existing=store.state.packs.find(p=>p.pack.manifest.id===pending.manifest.id);return {...Packs.summary(pending),file:path.basename(file),previousVersion:existing?.pack.manifest.version||'',previousAuthor:existing?.pack.manifest.author||''};},true);
 handle('cancel',()=>{pending=null;});
 handle('install',()=>{if(!pending)throw Error('Choose and review a pack first.');const result=store.install(pending);pending=null;return result;},true);
 handle('enable',(_e,id,on)=>store.enable(id,on),true);
 handle('remove',(_e,id)=>store.remove(id),true);
 handle('rollback',(_e,id)=>store.rollback(id),true);
 handle('disableAll',()=>store.disableAll(),true);
 handle('recover',()=>store.recover(),true);
 handle('copy',async(_e,id)=>{await waitStorage();idle();const p=store.available(id);if(!Object.values(p.items).some(a=>a.length))throw Error('This pack contains themes only. Use Apply theme.');return bulk.importItems({format:require('./transfer').FORMAT,fileVersion:1,items:p.items,customFields:{}},{commandId:require('node:crypto').randomUUID()});},true);
 handle('theme',async(_e,id,theme)=>{const patch=store.theme(id,theme);idle();return lifecycle?lifecycle.updateSettings(patch):db.setSettingsAsync(patch);},true);
 async function save(e,pack){const r=await dialog.showSaveDialog(BrowserWindow.fromWebContents(e.sender),{defaultPath:pack.manifest.id+'-'+pack.manifest.version+'.slotforge-pack',filters:[{name:'SlotForge content pack',extensions:['slotforge-pack']}]});idle();if(r.canceled||!r.filePath)return {saved:false};Database.writeAtomic(r.filePath,JSON.stringify(pack,null,2));return {saved:true,file:path.basename(r.filePath)};}
 handle('export',async(e,id)=>save(e,Packs.validate(store.get(id).pack,appVersion)),true);
 handle('create',async(e,picks,manifest,themes)=>{const pack=await bulk.createPack(picks,manifest,themes,appVersion);idle();return save(e,pack);},true);
 return store;
}
module.exports={register};
