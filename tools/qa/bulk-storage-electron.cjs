// Production JSON IPC and UI, isolated app profile and deterministic native file dialogs.
const {app,dialog}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../../../outputs/sqlite-conversion/bulk-ui');fs.mkdirSync(out,{recursive:true});
const profile=fs.mkdtempSync(path.join(out,'profile-'));app.setPath('appData',profile);app.disableHardwareAcceleration();
require('./qa-completion.cjs').preventRelaunch(app);
// This harness tests JSON's in-process restore/reload. Fresh installs now default
// to SQLite, whose restart path belongs to activation-electron.cjs instead.
fs.mkdirSync(path.join(profile,'slotforge-timing'));
const seed=new(require('../../db'))(path.join(profile,'slotforge-timing','slotforge-timing.json'));seed.saveNow();
const originalMessageBox=dialog.showMessageBox.bind(dialog);
dialog.showMessageBox=(...args)=>args.at(-1)?.title==='Upgrade database storage'?Promise.resolve({response:2}):originalMessageBox(...args);
require('./file-diagnostics.cjs')(path.join(out,'diagnostics.log'),()=>app.exit(1));
let saveFile=path.join(profile,'items.json'),openFile=saveFile,done=false;
dialog.showSaveDialog=async()=>({filePath:saveFile,canceled:false});dialog.showOpenDialog=async()=>({filePaths:[openFile],canceled:false});
const wait=ms=>new Promise(r=>setTimeout(r,ms));setTimeout(()=>{console.error('Bulk UI timeout');app.exit(2);},60000).unref();
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 const run=code=>{console.log('QA '+code.slice(0,150));return win.webContents.executeJavaScript('(async()=>{try{'+code+'}catch(e){throw Error(e.stack||e.message||String(e));}})()');};
 try{
  await wait(400);win.setContentSize(1280,900);
  assert.equal((await run('return api.storageStatus();')).backend,'json','Bulk JSON harness must not use the SQLite restart path');
  const driver=await run("return api.add('drivers',{name:'Bulk QA driver'});");
  const id=typeof driver==='string'?driver:driver.id;
  assert(id);assert.equal((await run(`return api.exportData({drivers:[${JSON.stringify(id)}]},{});`)).saved,true);
  assert.equal((await run('return api.importOpen();')).ok,true);assert.equal((await run('return api.importApply();')).drivers,1);
  assert.equal((await run("return api.list('drivers');")).length,2);
  saveFile=path.join(profile,'backup.json');await run("await api.setSettings({theme:'light',bulkQa:'sidecar'});return api.backupSave();");
  const backup=JSON.parse(fs.readFileSync(saveFile));assert.equal(backup.data.settings.bulkQa,'sidecar');assert.equal(backup.data.drivers.length,2);
  await run("await api.add('drivers',{name:'After backup'});await api.setSettings({bulkQa:'newer'});");
  openFile=saveFile;assert.equal((await run('return api.backupOpen();')).ok,true);
  // Hold the requested reload until the IPC result has been checked; then load the real UI again.
  const reload=win.webContents.reload.bind(win.webContents);let reloadRequested=false;win.webContents.reload=()=>{reloadRequested=true;};
  const restored=await run('return api.backupRestore();');await wait(200);assert(reloadRequested);
  const safety=JSON.parse(fs.readFileSync(restored.safety));assert.equal(safety.data.drivers.length,3);assert.equal(safety.data.settings.bulkQa,'newer');
  assert.equal((await run("return api.list('drivers');")).length,2);assert.equal((await run('return api.getSettings();')).bulkQa,'sidecar');
  await new Promise(resolve=>{win.webContents.once('did-finish-load',resolve);reload();});await wait(300);
  // A hidden window can lose its compositor surface on reload. Repaint without
  // taking focus before capturing evidence; this is not a new app launch.
  win.showInactive();await wait(200);
  await run("state.tab='settings';state.settingsSub='transfer';await render();document.querySelectorAll('#settingsbox details').forEach(d=>d.open=true);");
  assert(await run("return !!document.getElementById('bk-save') && !!document.getElementById('tr-open');"));
  for(const theme of ['light','dark']){await run(`state.settings.theme='${theme}';applyTheme();`);await wait(150);fs.writeFileSync(path.join(out,'backup-'+theme+'.png'),(await win.webContents.capturePage()).toPNG());}
  // Ordinary recovery uses the same lifecycle service as resource recovery.
  await run("window.confirm=()=>true;window.qaTrack=await api.add('tracks',{name:'Lifecycle Circuit',lanes:1,length:20,minLap:.8});window.qaDriver=(await api.list('drivers'))[0];window.qaCar=await api.add('slotcars',{brand:'NSR',model:'Lifecycle car'});window.qaSetup=await api.add('racesetups',{name:'Ordinary recovery check',track:qaTrack.id,sessionType:'race',raceBy:'laps',laps:10,endRule:'all',firstLap:'count',lightsMin:0,lightsMax:0});state.settings=await api.setSettings({timingHw:'none',lastSetupId:qaSetup.id,assignments:{[qaSetup.id]:[{driverId:qaDriver.id,carId:qaCar.id}]}});state.tab='home';await render();document.querySelector('#start').click();");await wait(300);
  await run('live.actions.start();');for(let i=0;i<150&&!await run('return live.phase==="running";');i++)await wait(50);assert.equal(await run('return live.phase;'),'running');
  await run('const e=live.engine(),t=performance.now();e.t0=t-12000;e.cars[0].last=e.t0;e.cross(0,t-1000);live.cpAt=undefined;live.actions.pause();');await wait(300);
  assert.equal((await run('return api.getResume();')).eng.cars[0].laps.length,1);
  await run("live.leave();clearInterval(live.timers);live.alive=false;live.phase='finished';state.race=null;state.tab='home';await render();");
  assert(await run("return !!document.querySelector('#resumego');"));fs.writeFileSync(path.join(out,'ordinary-recovery.png'),(await win.webContents.capturePage()).toPNG());
  await run("document.querySelector('#resumego').click();");await wait(300);assert.equal(await run('return live.phase;'),'paused');assert.equal(await run('return live.engine().cars[0].laps.length;'),1);
  await run('live.actions.stop(true);');await wait(150);await run('live.actions.finalize();');await wait(300);assert.equal(await run('return api.getResume();'),null);
  assert(await run("return (await api.list('sessions')).some(s=>s.setupName==='Ordinary recovery check');"));
  console.log('ORDINARY RECOVERY UI PASS: real engine lap, Home resume, paused restart and finalization clear.');
  fs.writeFileSync(path.join(out,'completion.json'),JSON.stringify({passed:true,runId:process.env.SF_BULK_QA_RUN_ID,profile,backend:'json',checks:['export','import','backup','restore','reload','race recovery','finalization']}));
  console.log('BULK UI PASS: real export/import, backup, sidecar-aware recovery copy, restore and reload; light/dark controls.');app.exit(0);
 }catch(error){console.error(error);fs.writeFileSync(path.join(out,'failure.png'),(await win.webContents.capturePage()).toPNG());app.exit(1);}
 });});seed.writesIdle().then(()=>require('../../main')).catch(error=>{console.error(error);app.exit(1);});
