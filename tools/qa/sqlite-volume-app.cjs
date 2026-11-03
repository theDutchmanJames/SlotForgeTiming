// Open only a completed synthetic volume fixture, never the user's profile.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../../outputs/sqlite-conversion');
if(!process.versions.electron){
 const dir=fs.realpathSync(process.argv[2]||'');assert.equal(path.dirname(dir),fs.realpathSync(root));assert(path.basename(dir).startsWith('volume-'));
 const report=JSON.parse(fs.readFileSync(path.join(dir,'result.json')));assert.equal(report.status,'passed');assert.equal(report.dir,dir);
 const fd=fs.openSync(path.join(dir,'app-launcher.log'),'w'),env={...process.env,SF_SQLITE_VOLUME_APP:dir};delete env.ELECTRON_RUN_AS_NODE;
 let result;try{result=require('node:child_process').spawnSync(require('electron'),[__filename],{env,stdio:['ignore',fd,fd],windowsHide:true,timeout:120000});}finally{fs.closeSync(fd);}
 console.log('VOLUME APP exit '+result.status+': '+dir);process.exitCode=result.status??1;
}else{
 const dir=process.env.SF_SQLITE_VOLUME_APP;if(!dir)throw Error('Use the isolated volume launcher.');
 const {app,ipcMain}=require('electron'),out=path.join(dir,'appdata'),profile=path.join(dir,'profile');fs.mkdirSync(out,{recursive:true});
 const link=path.join(out,'slotforge-timing');if(!fs.existsSync(link))fs.symlinkSync(profile,link,process.platform==='win32'?'junction':'dir');assert.equal(fs.realpathSync(link),fs.realpathSync(profile));
 app.setPath('appData',out);app.disableHardwareAcceleration();require('./file-diagnostics.cjs')(path.join(dir,'app.log'),()=>app.exit(1));
 const wait=ms=>new Promise(r=>setTimeout(r,ms));let done=false;const start=Date.now(),timer=setTimeout(()=>app.exit(2),110000);
 app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.on('did-finish-load',async()=>{if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 try{
  win.setContentSize(1280,900);await wait(300);const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
  const status=await run('return api.storageStatus();');assert.equal(status.backend,'sqlite');
  let fullLists=0;ipcMain.removeHandler('db:list');ipcMain.handle('db:list',()=>{fullLists++;throw Error('Full collection read forbidden in transfer UI');});
  const started=Date.now(),choices=await run('return api.transferChoices();');const bytes=Buffer.byteLength(JSON.stringify(choices));assert(bytes<100000);
  const firstChoicesMs=Date.now()-started,warmStart=Date.now();await run('return api.transferChoices();');const warmChoicesMs=Date.now()-warmStart;
  await run("state.tab='settings';state.settingsSub='transfer';await render();document.querySelectorAll('#settingsbox details').forEach(d=>d.open=true);");
  assert(await run("return !!document.getElementById('bk-native-save')&&!!document.getElementById('bk-native-restore')&&!!document.getElementById('tr-open');"));assert.equal(fullLists,0);await run("document.getElementById('bk-native-save').scrollIntoView({block:'center'});");await wait(200);
  fs.writeFileSync(path.join(dir,'app-transfer.png'),(await win.webContents.capturePage()).toPNG());
  const report={platform:process.platform,electron:process.versions.electron,choicesBytes:bytes,images:choices.imagesets.length,audio:choices.audiosets.length,sessions:choices.sessions.length,firstChoicesMs,warmChoicesMs,transferMs:Date.now()-started,startupAndCheckMs:Date.now()-start,fullCollectionReads:fullLists,status:'passed'};
  fs.writeFileSync(path.join(dir,'app-result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));clearTimeout(timer);app.exit(0);
 }catch(e){console.error(e.stack||e);app.exit(1);}
 });});require('../../main');
}
