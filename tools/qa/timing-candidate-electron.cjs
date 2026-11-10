'use strict';
// Load an unchanged candidate archive with the matching Electron runtime.
// This is a packaged-code smoke check, not installer or paired-host qualification.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {app,BrowserWindow,dialog}=require('electron');
const outputs=path.resolve(__dirname,'../../../outputs'),parent=path.resolve(process.env.SF_TIMING_CANDIDATE_DIR||''),out=path.resolve(process.env.SF_TIMING_CANDIDATE_SMOKE||'');
assert.equal(path.dirname(parent),outputs);assert(path.basename(parent).startsWith('timing-2.2.0-candidate-'));assert.equal(path.dirname(out),parent);assert(path.basename(out).startsWith('smoke-'));assert(process.env.SF_UI_QA_RUN_ID);
require('./file-diagnostics.cjs')(path.join(out,'diagnostics.log'),()=>app.exit(1));
dialog.showErrorBox=(title,message)=>{console.error(title,message);app.exit(1);};
const manifest=JSON.parse(fs.readFileSync(path.join(parent,'candidate-manifest.json'))),archive=path.join(parent,'dist/win-unpacked/resources/app.asar');
const archiveBytes=()=>require('original-fs').readFileSync(archive);
assert.equal(manifest.archive,archive);assert.equal(manifest.archiveSha256,crypto.createHash('sha256').update(archiveBytes()).digest('hex'));
const profile=path.join(out,'appdata');fs.mkdirSync(profile);app.setPath('appData',profile);app.setPath('userData',path.join(profile,'slotforge-timing'));
process.env.LOCALAPPDATA=path.join(out,'private-discovery');delete process.env.SF_UI_QA_LOCAL_LIBRARY;delete process.env.PORTABLE_EXECUTABLE_DIR;
app.setAsDefaultProtocolClient=()=>false;app.removeAsDefaultProtocolClient=()=>false;app.disableHardwareAcceleration();
require('./qa-completion.cjs').preventRelaunch(app);
assert.equal(require(path.join(archive,'package.json')).version,'2.2.0');assert.equal(require(path.join(archive,'paddock-rich-gate.js')).enabled(),true);
const errors=[];let started=false;const wait=ms=>new Promise(r=>setTimeout(r,ms));const timer=setTimeout(()=>app.exit(2),75000);
app.on('browser-window-created',(_,win)=>{
 win.setOpacity(0);win.show=()=>{};win.showInactive=()=>{};
 win.webContents.on('render-process-gone',(_,info)=>errors.push(info));
 win.webContents.on('did-fail-load',(_,code,text)=>errors.push({code,text}));
 win.webContents.on('did-finish-load',async()=>{
  if(started||!win.webContents.getURL().endsWith('/renderer/index.html'))return;started=true;
  try{
   win.setContentSize(1280,900);BrowserWindow.prototype.showInactive.call(win);await wait(500);
   const status=await win.webContents.executeJavaScript(`(async()=>{
    const storage=await api.storageStatus(),p=await api.paddockStatus();
    if(storage.backend!=='sqlite')throw Error('New profile did not choose SQLite');
    if(p.connected||p.linked.length||p.connection)throw Error('Unexpected real library connection');
    state.tab='database';state.sub='results';await render();
    if(!document.body.textContent.includes('Results and Records'))throw Error('Results page missing');
    return {backend:storage.backend,connected:p.connected,widgets:Widgets.REGISTRY.length};
   })()`);
   await wait(450);fs.writeFileSync(path.join(out,'results.png'),(await win.webContents.capturePage()).toPNG());
   await win.webContents.executeJavaScript(`(async()=>{state.sub='slotcars';await render();await PaddockUI.open(api);})()`);
   await wait(450);fs.writeFileSync(path.join(out,'connection.png'),(await win.webContents.capturePage()).toPNG());
   assert.equal(errors.length,0);assert.equal(app.getPath('userData'),path.join(profile,'slotforge-timing'));
   assert.equal(crypto.createHash('sha256').update(archiveBytes()).digest('hex'),manifest.archiveSha256);
   fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,version:'2.2.0',archiveSha256:manifest.archiveSha256,packagedCode:true,installedExecutable:false,jointQualification:false,status,errors,profile:app.getPath('userData')},null,2));
   require('./qa-completion.cjs').complete();clearTimeout(timer);app.quit();
  }catch(error){console.error(error);app.exit(1);}
 });
});
require(path.join(archive,'main.js'));
