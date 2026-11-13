// Load the real packaged code on its native OS, with isolated data and no hardware.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {app}=require('electron'),root=path.resolve(__dirname,'../..'),out=path.join(root,'.tmp-test/desktop-smoke');
fs.mkdirSync(out,{recursive:true});const isolated=path.join(out,'profile-'+process.pid);app.setPath('appData',isolated);process.env.LOCALAPPDATA=path.join(isolated,'local-app-data');app.disableHardwareAcceleration();
const relative=process.platform==='win32'?'win-unpacked/resources/app.asar':process.platform==='darwin'?'mac-universal/SlotForge Timing.app/Contents/Resources/app.asar':'linux-unpacked/resources/app.asar';
const asar=path.join(root,'dist',relative);assert(fs.existsSync(asar),'Packaged application missing');
assert.equal(require(path.join(asar,'package.json')).version,require('../../package.json').version);
// The shared library also stays inside this disposable profile on every OS.
const engine=require(path.join(asar,'vendor/slotforge-library/index.cjs')),open=engine.open;
engine.open=options=>open({...options,sharedRoot:path.join(isolated,'shared-library')});
require('./qa-completion.cjs').preventRelaunch(app);
let done=false;setTimeout(()=>app.exit(2),60000).unref();
app.on('browser-window-created',(_,win)=>{
  win.hide();win.webContents.setBackgroundThrottling(false);const errors=[];
  win.webContents.on('did-fail-load',(_,code,text)=>errors.push({code,text}));
  win.webContents.on('render-process-gone',(_,info)=>errors.push(info));
  win.webContents.on('did-finish-load',async()=>{
    if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
    try{
      await new Promise(r=>setTimeout(r,800));win.setContentSize(1250,950);
      const status=await win.webContents.executeJavaScript(`(async()=>{if(Widgets.REGISTRY.length<70)throw Error('Widget catalogue missing');if(typeof WidgetView.fit!=='function')throw Error('Widget renderer missing');state.tab='database';state.sub='slotcars';await render();const ed=await PaddockUI.open(api);if(!ed.dialog.textContent.includes('Connect to Dealership')||!ed.dialog.querySelector('[data-address]'))throw Error('Dealership UI missing');const s=await api.paddockStatus();if(s.connected||s.linked.length)throw Error('Profile not isolated');return {widgets:Widgets.REGISTRY.length,paddock:true};})()`);
      assert.equal(errors.length,0);assert(app.getPath('userData').startsWith(out));
      // DOM/IPC work can finish before Chromium presents the new dialog frame.
      await new Promise(r=>setTimeout(r,350));
      fs.writeFileSync(path.join(out,'app.png'),(await win.webContents.capturePage()).toPNG());
      fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({platform:process.platform,arch:process.arch,version:require('../../package.json').version,status,errors,packagedCode:true},null,2));
      console.log('PACKAGED DESKTOP SMOKE PASS');app.exit(0);
    }catch(e){console.error(e);app.exit(1);}
  });
});
require(path.join(asar,'main.js'));
