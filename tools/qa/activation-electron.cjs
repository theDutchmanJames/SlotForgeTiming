const {app,dialog,ipcMain}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.SF_ACTIVATION_QA,stage=process.env.SF_ACTIVATION_STAGE;
if(!base||!['activate','race','finalize','verify','restored'].includes(stage))throw Error('Use the isolated activation launcher.');
app.setPath('appData',path.join(base,'appdata'));app.disableHardwareAcceleration();
require('./file-diagnostics.cjs')(path.join(base,stage+'.log'),()=>app.exit(1));
let done=false;const wait=ms=>new Promise(r=>setTimeout(r,ms)),timer=setTimeout(()=>app.exit(2),60000);
const pass=()=>{clearTimeout(timer);console.log('ACTIVATION '+stage+' PASS');};
app.relaunch=()=>pass();dialog.showMessageBox=async()=>({response:1});
const backup=path.join(base,'backup.json');dialog.showSaveDialog=async()=>({filePath:backup,canceled:false});dialog.showOpenDialog=async()=>({filePaths:[backup],canceled:false});
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 const run=code=>{console.log('STEP '+code.slice(0,90));return win.webContents.executeJavaScript('(async()=>{'+code+'})()');};
 try{
  await wait(350);win.setContentSize(1280,900);await run("window.qaErrors=[];addEventListener('error',e=>qaErrors.push(e.message));addEventListener('unhandledrejection',e=>qaErrors.push(String(e.reason)));window.confirm=()=>true;");
  if(stage==='activate'){
   assert.equal((await run('return api.storageStatus();')).backend,'json');
   await run("state.tab='settings';state.settingsSub='general';await render();const folder=document.querySelector('#sqliteactivate').closest('details');folder.open=true;folder.scrollIntoView({block:'center'});");await wait(200);
   fs.writeFileSync(path.join(base,'activation-settings.png'),(await win.webContents.capturePage()).toPNG());
   await run("document.querySelector('#sqliteactivate').click();");return;
  }
  assert.equal((await run('return api.storageStatus();')).backend,'sqlite');
  if(stage==='race'){
   await run("window.driver=await api.add('drivers',{name:'Activation racer'});window.car=await api.add('slotcars',{model:'Activation car'});window.track=await api.add('tracks',{name:'Activation circuit',lanes:1,length:20,minLap:.8});window.setup=await api.add('racesetups',{name:'Crash recovery race',track:track.id,sessionType:'race',raceBy:'laps',laps:10,endRule:'all',firstLap:'count',lightsMin:0,lightsMax:0});state.settings=await api.setSettings({theme:'light',timingHw:'none',lastSetupId:setup.id,assignments:{[setup.id]:[{driverId:driver.id,carId:car.id}]}});state.tab='home';await render();document.querySelector('#start').click();");await wait(300);
   await run('live.actions.start();');for(let i=0;i<150&&!await run('return live.phase==="running";');i++)await wait(50);assert.equal(await run('return live.phase;'),'running');
   await run('const e=live.engine(),t=performance.now();e.t0=t-12000;e.cars[0].last=e.t0;e.cross(0,t-1000);live.cpAt=undefined;live.actions.pause();');await wait(350);assert.equal((await run('return api.getResume();')).eng.cars[0].laps.length,1);
   pass();app.exit(73);return;
  }
  if(stage==='finalize'){
   assert(await run("return !!document.querySelector('#resumego');"));fs.writeFileSync(path.join(base,'recovered-home.png'),(await win.webContents.capturePage()).toPNG());
   await run("document.querySelector('#resumego').click();");await wait(350);assert.equal(await run('return live.engine().cars[0].laps.length;'),1);
   ipcMain.removeHandler('resume:clear');ipcMain.handle('resume:clear',()=>{pass();app.exit(73);});
   await run('live.actions.stop(true);');await wait(150);await run('live.actions.finalize();');return;
  }
  assert.equal((await run("return api.list('sessions');")).length,1);assert.equal((await run("return api.list('laps');")).length,1);assert.equal((await run("return api.list('slotcars');"))[0].lapsDriven,1);assert.equal(await run('return api.getResume();'),null);
  await run("state.tab='settings';state.settingsSub='general';await render();const folder=document.querySelector('#storagemsg').closest('details');folder.open=true;folder.scrollIntoView({block:'center'});");await wait(200);assert.equal(await run("return document.querySelector('#bgsave').disabled;"),true);
  fs.writeFileSync(path.join(base,stage+'-settings.png'),(await win.webContents.capturePage()).toPNG());assert.deepEqual(await run('return qaErrors;'),[]);
  if(stage==='verify'){
   assert.equal((await run('return api.backupSave();')).saved,true);await run("await api.add('drivers',{name:'After backup'});");assert.equal((await run('return api.backupOpen();')).ok,true);await run('return api.backupRestore();');return;
  }
  assert.equal((await run("return api.list('drivers');")).length,1);pass();app.quit();
 }catch(error){console.error(error);app.exit(1);}
 });});require('../../main');
