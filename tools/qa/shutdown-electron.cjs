'use strict';
const {app,dialog}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const mode=process.env.SF_SHUTDOWN_QA_MODE||'sqlite',out=path.resolve(__dirname,'../../../outputs/paddock-followup/shutdown-ui',mode);fs.mkdirSync(out,{recursive:true});
const profile=fs.mkdtempSync(path.join(out,'profile-'));app.setPath('appData',profile);app.disableHardwareAcceleration();
require('./qa-completion.cjs').preventRelaunch(app);require('./file-diagnostics.cjs')(path.join(profile,'diagnostics.log'),()=>app.exit(1));
const wait=ms=>new Promise(r=>setTimeout(r,ms));let entered=false,saved=false,rejected=false,runtime,startedAt;
dialog.showErrorBox=(title,message)=>{console.error(title,message);app.exit(1);};
if(mode==='json'){
 const dir=path.join(profile,'slotforge-timing');fs.mkdirSync(dir);fs.writeFileSync(path.join(dir,'slotforge-timing.json'),JSON.stringify({version:1,drivers:[]}));
 dialog.showMessageBox=async()=>({response:2}); // Existing profile: keep JSON.
 const Records=require('../../data-repository'),add=Records.prototype.add;
 Records.prototype.add=async function(...args){entered=true;await wait(3400);const result=await add.apply(this,args);saved=true;return result;};
}else{
 const Runtime=require('../../sqlite-runtime'),open=Runtime.open;
 Runtime.open=async(...args)=>{runtime=await open(...args);const save=runtime.records.editorSave.bind(runtime.records);runtime.records.editorSave=async request=>{entered=true;await wait(3400);const result=await save(request);saved=true;return result;};return runtime;};
}
const timer=setTimeout(()=>app.exit(2),30000);
app.on('browser-window-created',(_,win)=>{
 win.show=()=>{};win.hide();
 win.webContents.on('did-finish-load',async()=>{if(!win.webContents.getURL().endsWith('index.html'))return;
  try{
   await win.webContents.executeJavaScript("window.qaSave=api.add('drivers',{name:'Accepted slow save'});window.qaSave.catch(()=>{});true");
   for(let i=0;i<100&&!entered;i++)await wait(20);assert(entered);startedAt=Date.now();app.quit();
   rejected=await win.webContents.executeJavaScript("api.add('drivers',{name:'Too late'}).then(()=>false,error=>/closing/i.test(error.message))");assert(rejected);
  }catch(error){console.error(error);app.exit(1);}
 });
});
app.on('will-quit',()=>{try{
 assert(saved);assert(rejected);assert(Date.now()-startedAt>=3000,'Quit must wait beyond the old deadline');
 if(mode==='json'){const value=JSON.parse(fs.readFileSync(path.join(profile,'slotforge-timing','slotforge-timing.json')));assert.equal(value.drivers.filter(d=>d.name==='Accepted slow save').length,1);assert(!value.drivers.some(d=>d.name==='Too late'));}
 else{const s=new(require('../../sqlite-working').WorkingStore)(path.dirname(runtime.file));try{assert.equal(s.statement("SELECT count(*) n FROM fields WHERE entity='drivers' AND path='[\"name\"]' AND json=?").get(JSON.stringify('Accepted slow save')).n,1);assert.equal(s.statement('PRAGMA integrity_check').get().integrity_check,'ok');}finally{s.close();}}
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,mode,saved,rejected,elapsed:Date.now()-startedAt}));clearTimeout(timer);require('./qa-completion.cjs').complete();
 }catch(error){console.error(error);app.exit(1);}});
require('../../main');
