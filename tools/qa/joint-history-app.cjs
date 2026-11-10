'use strict';
// Test driver only: two real desktop entry points, never a packaged override.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {app,dialog}=require('electron');
const [role,root,backend,source]=process.argv.slice(2);
const allowed=path.resolve(__dirname,'../../../outputs/joint-history');
assert(['timing','paddock'].includes(role)&&['json','sqlite'].includes(backend));
assert(root&&path.dirname(path.resolve(root))===allowed&&fs.existsSync(path.join(root,'qualification.json')),'Disposable qualification profile required');
assert(process.send,'Run through the joint qualification launcher');
const profile=path.join(root,role),appData=path.join(root,role+'-appdata');
fs.mkdirSync(profile,{recursive:true});fs.mkdirSync(appData,{recursive:true});
app.setPath('appData',appData);app.setPath('userData',profile);app.disableHardwareAcceleration();
process.env.LOCALAPPDATA=path.join(root,'discovery');
process.env.SF_UI_QA_LOCAL_LIBRARY='1';
require('./qa-completion.cjs').preventRelaunch(app);
require('./file-diagnostics.cjs')(path.join(root,role+'-diagnostics.log'),()=>app.exit(1));
dialog.showErrorBox=(title,message)=>{console.error(title,message);app.exit(1);};
const timeout=setTimeout(()=>app.exit(2),240000);let win,chain=Promise.resolve();
process.on('disconnect',()=>app.exit(2));
process.on('message',message=>{chain=chain.then(async()=>{
 try{
  let value;
  if(message.action==='quit'){clearTimeout(timeout);app.quit();return;}
  assert(win&&!win.isDestroyed(),'Desktop window is not ready');
  if(message.action==='eval')value=await win.webContents.executeJavaScript('(async()=>{'+message.code+'})()');
  else if(message.action==='screenshot'){
   assert(/^[a-z0-9-]+$/.test(message.name));
   fs.writeFileSync(path.join(root,role+'-'+message.name+'.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());value=true;
  }else throw Error('Unknown qualification command');
  process.send({id:message.id,value});
 }catch(error){process.send({id:message.id,error:error.stack||String(error)});}
});});
app.on('browser-window-created',(_,window)=>{
 window.show=()=>{};window.hide();
 window.webContents.on('did-finish-load',async()=>{
  if(!window.webContents.getURL().endsWith('/index.html'))return;
  win=window;win.setContentSize(1200,950);win.setOpacity(0);win.showInactive();
  await win.webContents.executeJavaScript("window.qaErrors=[];addEventListener('error',e=>qaErrors.push(e.message));addEventListener('unhandledrejection',e=>qaErrors.push(String(e.reason)));void 0;");
  process.send({ready:true,role});
 });
});
if(role==='paddock'){
 // Load before Store imports the capability module and caches the fixed gate.
 require(path.join(source,'tests/support/historical-approval-preload.cjs'));
 // Seed once before opening the normal app; on restart use its existing files.
 const file=path.join(profile,'database.json');
 if(!fs.existsSync(file)&&!fs.existsSync(path.join(profile,'database.sqlite'))){
  const {Store}=require(path.join(source,'src/store.cjs'));
  new Store(file).replace(require(path.join(source,'tests/support/timing-fixtures.cjs')).fixtures().store.snapshot());
 }
 // Only the approval gate's disposable in-memory copy is enabled here.
 const threads=require('node:worker_threads'),Worker=threads.Worker;
 threads.Worker=class extends Worker{constructor(file,options){super(path.resolve(String(file))===path.join(source,'src/domain-worker.cjs')?path.join(source,'tests/support/historical-approval-worker.cjs'):file,options);}};
 require(path.join(source,'src/main.cjs'));
}else{
 const actual=path.join(appData,'slotforge-timing');fs.mkdirSync(actual,{recursive:true});
 const file=path.join(actual,'slotforge-timing.json');
 if(!fs.existsSync(file)){
  const Database=require('../../db'),db=new Database(file);db.saveNow();
  fs.copyFileSync(file,path.join(root,'timing-original.json'));
  if(backend==='json')fs.writeFileSync(path.join(actual,'storage-conversion-prompt.json'),JSON.stringify({version:1,choice:'keep'}));
  else require('../../storage-activation').request(actual);
 }
 require('../../main');
}
