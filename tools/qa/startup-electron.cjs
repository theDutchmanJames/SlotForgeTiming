'use strict';
const {app,nativeTheme,dialog}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const mode=process.env.SF_STARTUP_QA_MODE||'normal',out=path.resolve(__dirname,'../../../outputs/sqlite-conversion/startup-ui',mode);fs.mkdirSync(out,{recursive:true});
const profile=fs.mkdtempSync(path.join(out,'profile-'));app.setPath('appData',profile);app.disableHardwareAcceleration();
require('./qa-completion.cjs').preventRelaunch(app);require('./file-diagnostics.cjs')(path.join(profile,'diagnostics.log'),()=>app.exit(1));
const runtime=require('../../sqlite-runtime'),open=runtime.open,wait=ms=>new Promise(r=>setTimeout(r,ms));let release,started=false,finished=false,directory,feedback,mainCount=0,verified=false;
let opened,writeFinished=false;const errors=[];dialog.showErrorBox=(title,message)=>errors.push({title,message});
// Keep the native test window transparent while capturing its rendered page.
const Feedback=require('../../startup-feedback'),createFeedback=Feedback.create;
Feedback.create=options=>createFeedback({...options,BrowserWindow:class extends options.BrowserWindow{constructor(value){super({...value,opacity:0});}}});
const gate=new Promise(resolve=>{release=resolve;});runtime.open=async(...args)=>{started=true;directory=args[0];await gate;const result=await open(...args);opened=result;finished=true;return result;};
const timer=setTimeout(()=>app.exit(2),45000);
app.on('browser-window-created',(_,win)=>{
 win.show=()=>{};win.hide();
 if(mode==='load-failure'){
  const load=win.loadFile.bind(win);win.loadFile=(file,...args)=>{
   if(path.basename(file)!=='index.html')return load(file,...args);
   const command=opened.client.command.bind(opened.client);opened.client.command=async value=>{await wait(150);return command(value);};
   opened.records.add('drivers',{name:'Accepted before page failure'}).then(()=>{writeFinished=true;},error=>{errors.push({writeError:error.message});});
   return Promise.reject(Error('QA main page could not load'));
  };
 }
 win.webContents.on('did-finish-load',async()=>{try{
  const url=win.webContents.getURL();
  if(url.endsWith('startup.html')){
   feedback=win;win.setOpacity(0);win.showInactive();for(let i=0;i<200&&!started;i++)await wait(25);assert.ok(started);assert.equal(finished,false);
   assert.equal(await win.webContents.executeJavaScript('typeof window.api'),'undefined');
   for(const theme of ['dark','light']){nativeTheme.themeSource=theme;await wait(250);assert(await win.webContents.executeJavaScript('document.documentElement.scrollWidth<=innerWidth && document.documentElement.scrollHeight<=innerHeight'));const image=await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true}),pixels=image.toBitmap();assert.ok(pixels.some((value,i)=>value!==pixels[i%4]),'capture contains rendered content');fs.writeFileSync(path.join(out,theme+'.png'),image.toPNG());}
   if(mode==='close'){win.close();await wait(60);assert.equal(finished,false);assert.equal(mainCount,0);}
   release();
  }else if(url.endsWith('index.html')){
   mainCount++;assert.notEqual(mode,'close');assert.ok(finished);
   for(let i=0;i<100&&!feedback.isDestroyed();i++)await wait(20);assert.ok(feedback.isDestroyed());
   assert.equal((await win.webContents.executeJavaScript('api.storageStatus()')).backend,'sqlite');verified=true;app.quit();
  }
 }catch(error){console.error(error);clearTimeout(timer);app.exit(1);}});
});
app.on('will-quit',()=>{
 try{assert.ok(finished);if(mode==='close'||mode==='load-failure'){assert.equal(mainCount,0);const s=new(require('../../sqlite-working').WorkingStore)(path.join(directory,'working'));try{assert.equal(s.statement('PRAGMA integrity_check').get().integrity_check,'ok');if(mode==='load-failure'){assert.ok(writeFinished);assert.equal(s.statement("SELECT COUNT(*) n FROM fields WHERE entity='drivers' AND path='[\"name\"]' AND json=?").get(JSON.stringify('Accepted before page failure')).n,1);assert.ok(feedback.isDestroyed());assert.equal(errors.length,1);assert.match(errors[0].message,/QA main page could not load/);}verified=true;}finally{s.close();}}
 if(mode!=='load-failure')assert.deepEqual(errors,[]);
 assert.ok(verified);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,mode,profile,mainCount,finished,writeFinished,errors}));require('./qa-completion.cjs').complete();clearTimeout(timer);
 }catch(error){console.error(error);app.exit(1);}
});
require('../../main');
