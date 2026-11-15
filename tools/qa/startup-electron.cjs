'use strict';
const {app,nativeTheme,dialog,ipcMain}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const appRoot=process.env.SF_STARTUP_QA_APP_ROOT||path.resolve(__dirname,'../..'),fromApp=name=>require(path.join(appRoot,name));
const mode=process.env.SF_STARTUP_QA_MODE||'normal',out=process.env.SF_STARTUP_QA_OUTPUT||path.resolve(__dirname,'../../../outputs/startup-feedback',mode);fs.mkdirSync(out,{recursive:true});
const profile=fs.mkdtempSync(path.join(out,'profile-'));app.setPath('appData',profile);process.env.LOCALAPPDATA=path.join(profile,'local');app.disableHardwareAcceleration();
const engine=fromApp("vendor/slotforge-library/index.cjs"),engineOpen=engine.open;engine.open=options=>engineOpen({...options,sharedRoot:path.join(profile,'shared-library')});
require('./qa-completion.cjs').preventRelaunch(app);require('./file-diagnostics.cjs')(path.join(profile,'diagnostics.log'),()=>app.exit(1));
const wait=ms=>new Promise(r=>setTimeout(r,ms)),runtime=fromApp("sqlite-runtime"),open=runtime.open;
let release,started=false,finished=false,directory,feedback,mainCount=0,verified=false,opened,writeFinished=false,renderDelayed=false;const errors=[];
dialog.showErrorBox=(title,message)=>{errors.push({title,message});console.error(title,message);};
const Feedback=fromApp("startup-feedback"),createFeedback=Feedback.create;
Feedback.create=options=>createFeedback({...options,BrowserWindow:class extends options.BrowserWindow{constructor(value){super(value);feedback=this;}}});
const gate=new Promise(resolve=>{release=resolve;});
runtime.open=async(...args)=>{started=true;directory=args[0];assert.ok(feedback?.isVisible(),'feedback is visible before storage opens');await gate;if(mode==='storage-failure')throw Error('QA storage unavailable');const result=await open(...args);opened=result;finished=true;return result;};
const rollout=fromApp("storage-rollout"),rolloutStartup=rollout.startup;
rollout.startup=async(...args)=>{if(mode.startsWith('large-')){started=true;assert.ok(feedback?.isVisible());await gate;}const result=await rolloutStartup(...args);if(mode==='large-json')finished=true;return result;};
if(mode.startsWith('large-')){
 const dir=path.join(profile,'slotforge-timing');fs.mkdirSync(dir,{recursive:true});const db=new(fromApp("db"))(path.join(dir,'slotforge-timing.json'));
 db.data.drivers=Array.from({length:2000},(_,i)=>({id:'qa-driver-'+i,name:'QA Driver '+i}));
 db.data.sessions=[{id:'qa-session',name:'QA history',sessionType:'race',date:'2026-11-01T12:00:00Z',standings:[]}];
 db.data.laps=Array.from({length:20000},(_,i)=>({id:'qa-lap-'+i,sessionId:'qa-session',driverId:'qa-driver-0',time:5000+i%100,date:'2026-11-01T12:00:00Z'}));db.save();
 dialog.showMessageBox=async()=>({response:mode==='large-json'?2:0});
}
// Delay the first renderer read; this used to expose an unfinished main window.
const handle=ipcMain.handle.bind(ipcMain);
ipcMain.handle=(channel,listener)=>handle(channel,async(...args)=>{
 if(channel==='settings:get'&&['slow-render','boot-failure'].includes(mode)&&!renderDelayed){renderDelayed=true;await wait(750);const win=require('electron').BrowserWindow.fromWebContents(args[0].sender);assert.ok(feedback.isVisible());assert.equal(win.isVisible(),false);if(mode==='boot-failure')throw Error('QA first screen failed');}
 return listener(...args);
});
const realExit=app.exit.bind(app);
app.exit=code=>{
 if(mode==='storage-failure'&&code===1&&errors.length===1&&errors[0].message==='QA storage unavailable'){
  assert.equal(mainCount,0);assert.equal(finished,false);assert.equal(opened,undefined);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,mode,profile,errors}));require('./qa-completion.cjs').complete();realExit(0);return;
 }realExit(code);
};
const timer=setTimeout(()=>app.exit(2),60000);
app.on('browser-window-created',(_,win)=>{

 if(mode==='load-failure'){
  const load=win.loadFile.bind(win);win.loadFile=(file,...args)=>{
   if(path.basename(file)!=='index.html')return load(file,...args);
   const command=opened.client.command.bind(opened.client);opened.client.command=async value=>{await wait(150);return command(value);};
   opened.records.add('drivers',{name:'Accepted before page failure'}).then(()=>{writeFinished=true;},error=>errors.push({writeError:error.message}));
   return Promise.reject(Error('QA main page could not load'));
  };
 }
 if(mode==='early-close')win.once('ready-to-show',()=>win.close());
 win.webContents.on('did-finish-load',async()=>{try{
  const url=win.webContents.getURL();
  if(url.endsWith('startup.html')){
   if(mode==='early-close')return;
   feedback=win;for(let i=0;i<400&&!started;i++)await wait(25);assert.ok(started);assert.equal(finished,false);
   assert.equal(await win.webContents.executeJavaScript('typeof window.api'),'undefined');
   for(const theme of ['dark','light']){nativeTheme.themeSource=theme;await wait(200);assert(await win.webContents.executeJavaScript('document.documentElement.scrollWidth<=innerWidth && document.documentElement.scrollHeight<=innerHeight'));const image=await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});fs.writeFileSync(path.join(out,theme+'.png'),image.toPNG());}
   if(mode==='close'){win.close();await wait(60);assert.equal(finished,false);assert.equal(mainCount,0);}
   release();
  }else if(url.endsWith('index.html')){
   mainCount++;assert.notEqual(mode,'close');assert.ok(finished);
   for(let i=0;i<600&&!feedback.isDestroyed();i++)await wait(25);assert.ok(feedback.isDestroyed(),'splash closes after first render');assert.ok(win.isVisible());
   assert.equal((await win.webContents.executeJavaScript('api.storageStatus()')).backend,mode==='large-json'?'json':'sqlite');
   if(mode==='boot-failure')assert.match(await win.webContents.executeJavaScript('document.body.innerText'),/QA first screen failed/);
   else assert.equal(await win.webContents.executeJavaScript('!!document.querySelector("#bootfailed")'),false);
   fs.writeFileSync(path.join(out,'main.png'),(await win.webContents.capturePage()).toPNG());verified=true;app.quit();
  }
 }catch(error){console.error(error);clearTimeout(timer);app.exit(1);}});
});
app.on('will-quit',()=>{
 try{if(mode==='early-close'){assert.equal(mainCount,0);assert.equal(started,false);assert.deepEqual(errors,[]);require('./qa-completion.cjs').complete();clearTimeout(timer);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,mode,profile}));return;}assert.ok(finished);if(mode==='close'||mode==='load-failure'){assert.equal(mainCount,0);const s=new(fromApp("sqlite-working").WorkingStore)(path.join(directory,'working'));try{assert.equal(s.statement('PRAGMA integrity_check').get().integrity_check,'ok');if(mode==='load-failure'){assert.ok(writeFinished);assert.equal(s.statement("SELECT COUNT(*) n FROM fields WHERE entity='drivers' AND path='[\"name\"]' AND json=?").get(JSON.stringify('Accepted before page failure')).n,1);assert.ok(feedback.isDestroyed());assert.equal(errors.length,1);assert.match(errors[0].message,/QA main page could not load/);}verified=true;}finally{s.close();}}
 if(mode!=='load-failure')assert.deepEqual(errors,[]);
 assert.ok(verified);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,mode,profile,mainCount,finished,writeFinished,renderDelayed,errors}));require('./qa-completion.cjs').complete();clearTimeout(timer);
 }catch(error){console.error(error);app.exit(1);}
});
fromApp("main");
