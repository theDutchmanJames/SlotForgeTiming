'use strict';
// This entry exists ONLY in the explicitly instrumented disposable package.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {app,BrowserWindow,dialog}=require('electron');
const packageRoot=path.resolve(process.execPath,'../../..'),run=path.resolve(process.env.SF_MERGE_QA_RUN||'');
assert(app.isPackaged);assert(path.basename(packageRoot).startsWith('merge-installed-'));
assert(run.startsWith(path.join(packageRoot,'runs')+path.sep));assert(fs.existsSync(path.join(run,'run.json')));
const config=JSON.parse(fs.readFileSync(path.join(run,'run.json'))),control=path.join(run,'control');
for(const key of ['appData','localAppData'])assert(typeof config[key]==='string'&&path.resolve(config[key]).startsWith(packageRoot+path.sep));
for(const dir of [config.appData,config.localAppData,control])fs.mkdirSync(dir,{recursive:true});
app.setPath('appData',config.appData);app.setPath('userData',path.join(config.appData,'slotforge-timing'));process.env.APPDATA=config.appData;process.env.LOCALAPPDATA=config.localAppData;delete process.env.PORTABLE_EXECUTABLE_DIR;
app.setAsDefaultProtocolClient=()=>false;app.removeAsDefaultProtocolClient=()=>false;app.relaunch=()=>{throw Error('Unexpected QA relaunch');};app.disableHardwareAcceleration();
const errors=[];let mainWindow,seen='',busy=false;
function fatal(e){fs.appendFileSync(path.join(control,'fatal.log'),String(e.stack||e)+'\n');app.exit(1);}
process.on('uncaughtException',fatal);process.on('unhandledRejection',fatal);dialog.showErrorBox=(title,message)=>fatal(Error(title+': '+message));
app.on('browser-window-created',(_,win)=>{win.show=()=>{};win.showInactive=()=>{};win.setOpacity(0);win.webContents.setBackgroundThrottling(false);win.webContents.on('render-process-gone',(_,e)=>errors.push(e));win.webContents.on('did-finish-load',()=>{if(!win.webContents.getURL().endsWith('/renderer/index.html'))return;mainWindow=win;win.setContentSize(1280,900);BrowserWindow.prototype.showInactive.call(win);fs.writeFileSync(path.join(control,'ready.json'),JSON.stringify({pid:process.pid,packaged:app.isPackaged,profile:app.getPath('userData'),exe:process.execPath}));});});
const timer=setInterval(async()=>{if(busy||!mainWindow||mainWindow.isDestroyed())return;let cmd;try{cmd=JSON.parse(fs.readFileSync(path.join(control,'command.json')));}catch{return;}if(cmd.id===seen)return;assert(/^[\w-]+$/.test(cmd.id));seen=cmd.id;busy=true;try{
 let value;if(cmd.action==='js')value=await mainWindow.webContents.executeJavaScript('(async()=>{'+cmd.code+'})()');
 else if(cmd.action==='status')value={errors,packaged:app.isPackaged,profile:app.getPath('userData')};
 else if(cmd.action==='capture'){assert(/^[\w-]+\.png$/.test(cmd.file));const file=path.join(run,cmd.file);fs.writeFileSync(file,(await mainWindow.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());value=file;}
 else if(cmd.action==='quit'){value=true;setTimeout(()=>app.quit(),100);}
 else throw Error('Unknown QA command');fs.writeFileSync(path.join(control,cmd.id+'.json'),JSON.stringify({ok:true,value:value??null}));
 }catch(e){fs.writeFileSync(path.join(control,cmd.id+'.json'),JSON.stringify({ok:false,error:e.stack}));}finally{busy=false;}},50);timer.unref();
require('./main.js');
