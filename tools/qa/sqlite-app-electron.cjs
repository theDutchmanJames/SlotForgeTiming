const {app,dialog}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.SF_SQLITE_QA_ROOT,stage=process.env.SF_SQLITE_QA_STAGE;
if(!base||!['write','resume','verify'].includes(stage))throw Error('Use the isolated SQLite app launcher.');
fs.mkdirSync(path.join(base,'appdata'),{recursive:true});app.setPath('appData',path.join(base,'appdata'));app.disableHardwareAcceleration();
let chosenFile=path.join(base,'selected-export.json');
dialog.showSaveDialog=async()=>({filePath:chosenFile,canceled:false});dialog.showOpenDialog=async()=>({filePaths:[chosenFile],canceled:false});
require('./file-diagnostics.cjs')(path.join(base,stage+'.log'),()=>app.exit(1));
const wait=ms=>new Promise(r=>setTimeout(r,ms));let done=false;const timeout=setTimeout(()=>{console.error('SQLite app QA timeout');app.exit(2);},75000);
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 const run=code=>{console.log('STEP '+code.slice(0,110));return win.webContents.executeJavaScript('(async()=>{'+code+'})()');};
 try{
  await wait(400);win.setContentSize(1280,900);assert((await run('return api.dbPath();')).endsWith('working.sqlite'));
  await run("window.qaErrors=[];addEventListener('error',e=>qaErrors.push(e.message));addEventListener('unhandledrejection',e=>qaErrors.push(String(e.reason)));window.confirm=()=>true;window.alert=t=>{throw Error(t);};");
  if(stage==='write'){
   await run("window.field=await api.addCustomField('drivers',{label:'Club',type:'text',group:'personal'});");
   await run("window.driver=await api.add('drivers',{name:'SQLite racer',custom:{[field.id]:'SlotForge'}});window.car=await api.add('slotcars',{brand:'NSR',model:'SQLite car'});window.track=await api.add('tracks',{name:'SQLite Circuit',lanes:1,length:20,minLap:.8});window.setup=await api.add('racesetups',{name:'SQLite reopen race',track:track.id,sessionType:'race',raceBy:'laps',laps:10,endRule:'all',firstLap:'count',lightsMin:0,lightsMax:0});state.settings=await api.setSettings({theme:'light',timingHw:'none',sqliteQa:true,lastSetupId:setup.id,assignments:{[setup.id]:[{driverId:driver.id,carId:car.id}]}});state.tab='home';await render();document.querySelector('#start').click();");await wait(300);
   await run('live.actions.start();');for(let i=0;i<150&&!await run('return live.phase==="running";');i++)await wait(50);assert.equal(await run('return live.phase;'),'running');
   await run('const e=live.engine(),t=performance.now();e.t0=t-12000;e.cars[0].last=e.t0;e.cross(0,t-1000);live.cpAt=undefined;live.actions.pause();');await wait(350);
   assert.equal((await run('return api.getResume();')).eng.cars[0].laps.length,1);
   fs.writeFileSync(path.join(base,'race-before-close.png'),(await win.webContents.capturePage()).toPNG());
  }else if(stage==='resume'){
   assert.equal((await run('return api.getSettings();')).sqliteQa,true);assert.equal((await run("return api.list('drivers');"))[0].name,'SQLite racer');
   assert(await run("return !!document.querySelector('#resumego');"));fs.writeFileSync(path.join(base,'home-after-reopen.png'),(await win.webContents.capturePage()).toPNG());
   await run("document.querySelector('#resumego').click();");await wait(350);assert.equal(await run('return live.phase;'),'paused');assert.equal(await run('return live.engine().cars[0].laps.length;'),1);
   await run('live.actions.stop(true);');await wait(150);await run('live.actions.finalize();');await wait(500);
   assert.equal(await run('return api.getResume();'),null);const sessions=await run("return api.list('sessions');");assert.equal(sessions.length,1);assert.equal(sessions[0].setupName,'SQLite reopen race');
   await run("const lap=(await api.list('laps'))[0];await api.update('laps',lap.id,{noTrackRecord:true});const s=(await api.list('sessions'))[0];await api.update('sessions',s.id,{champ:{id:'qa',awarded:true}});state.tab='database';state.sub='slotcars';await render();");await wait(200);
   fs.writeFileSync(path.join(base,'cars-after-finalize.png'),(await win.webContents.capturePage()).toPNG());
  }else{
   assert.equal((await run("return api.list('sessions');")).length,1);assert.equal((await run("return api.list('laps');"))[0].noTrackRecord,true);assert.equal((await run("return api.list('sessions');"))[0].champ.awarded,true);assert.equal((await run("return api.list('slotcars');"))[0].lapsDriven,1);assert.equal(await run('return api.getResume();'),null);
   assert.equal((await run("return api.paddockStatus();")).connected,false);
   assert.equal((await run("return api.exportData({drivers:[(await api.list('drivers'))[0].id]},{});")).saved,true);
   assert.equal((await run('return api.importOpen();')).ok,true);assert.equal((await run('return api.importApply();')).drivers,1);
   await run("const ds=await api.list('drivers');if(ds.length!==2)throw Error('Import count');await api.remove('drivers',ds[1].id);");
   chosenFile=path.join(base,'complete-backup.json');assert.equal((await run('return api.backupSave();')).saved,true);
   const backup=JSON.parse(fs.readFileSync(chosenFile));assert.equal(backup.data.sessions.length,1);assert.equal(backup.data.settings.sqliteQa,true);
   assert.equal((await run('return api.backupOpen();')).ok,true);
   assert(await run("try{await api.backupRestore();return false;}catch(e){return /separate working copy/.test(e.message);}"));
   await run('await api.backupCancel();');
  }
  assert.deepEqual(await run('return qaErrors;'),[]);clearTimeout(timeout);console.log('SQLITE APP '+stage+' PASS');app.quit();
 }catch(error){console.error(error);app.exit(1);}
 });});require('../../main');
