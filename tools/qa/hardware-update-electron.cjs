const fs=require('fs'),path=require('path'),os=require('os'),repo=path.resolve(__dirname,'../..'),req=require('module').createRequire(path.join(repo,'package.json'));
const {app,dialog}=req('electron'),out=path.resolve(__dirname,'../../../outputs/hardware-update');fs.mkdirSync(out,{recursive:true});
const isolated=fs.mkdtempSync(path.join(os.tmpdir(),'sf-hardware-review-'));app.setPath('appData',isolated);process.env.LOCALAPPDATA=path.join(isolated,'local');app.disableHardwareAcceleration();
const profile=path.join(isolated,'slotforge-timing');fs.mkdirSync(profile);new(req('./db'))(path.join(profile,'slotforge-timing.json')).saveNow();fs.writeFileSync(path.join(profile,'storage-conversion-prompt.json'),JSON.stringify({version:1,choice:'keep'}));
const lib=req('./vendor/slotforge-library/index.cjs'),open=lib.open;lib.open=o=>open({...o,sharedRoot:path.join(isolated,'shared'),legacyProfiles:[profile]});
req('./tools/qa/qa-completion.cjs').preventRelaunch(app);req('./tools/qa/file-diagnostics.cjs')(path.join(out,'diagnostics.log'),()=>app.exit(1));dialog.showErrorBox=(t,m)=>{console.error(t,m);app.exit(1);};
const wait=ms=>new Promise(r=>setTimeout(r,ms));let done=false;setTimeout(()=>app.exit(2),70000).unref();
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.setBackgroundThrottling(false);win.webContents.on('did-finish-load',async()=>{
if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
try{const run=c=>win.webContents.executeJavaScript('(async()=>{'+c+'})()');for(let i=0;i<150;i++){if(await run('return !!state.schema.racesetups'))break;await wait(40);}

win.setContentSize(1500,1100);
const checks=await run(`state.tab='settings';state.settingsSub='hardware';state.hwSub='trackmate';state.settings.timingHw='trackmate';await render();
if(typeof Phidget!=='undefined'||api.phidgetState)throw Error('Removed hardware still exposed');
if(document.querySelector('#hwtabs [data-id="phidget"]')||[...document.querySelectorAll('#hw-use option')].some(e=>/phidget/i.test(e.textContent)))throw Error('Removed hardware still selectable');
if(!document.getElementById('hw-led-call'))throw Error('Track Call indicator absent');
hw.open=true;Trackmate.link.setConnected(true);renderHardwareSettings(document.getElementById('hwbox'));
const events=[];const off=Trackmate.link.on(e=>events.push(e));tmReceive(new Uint8Array([87]));
if(!document.getElementById('hw-led-call').classList.contains('on'))throw Error('W packet did not light indicator');
renderHardwareSettings(document.getElementById('hwbox'));
if(!document.getElementById('hw-led-call').classList.contains('on'))throw Error('Redraw lost recent press');
await new Promise(r=>setTimeout(r,1100));
if(document.getElementById('hw-led-call').classList.contains('on'))throw Error('Indicator did not clear');
tmReceive(new Uint8Array([87]));Trackmate.link.setConnected(false);
if(document.getElementById('hw-led-call').classList.contains('on'))throw Error('Disconnect left indicator lit');
off();if(events.length!==2||events.some(e=>e.type!=='call'))throw Error('Monitor altered race events');
return {packet:true,redraw:true,expiry:true,disconnect:true,events:true,removal:true};`);
const themes=await run('return Theme.THEMES.map(x=>x[0]);');
for(const theme of themes){
 await run(`state.settings.theme=${JSON.stringify(theme)};applyTheme();renderHardwareSettings(document.getElementById('hwbox'));document.querySelector('[data-tm-section="connection"]').open=false;document.querySelector('[data-tm-section="sensors"]').scrollIntoView({block:'start'});tmReceive(new Uint8Array([65,87]));`);
 win.webContents.invalidate();await wait(80);win.webContents.invalidate();await wait(80);
 fs.writeFileSync(path.join(out,'track-call-'+theme+'.png'),(await win.webContents.capturePage()).toPNG());
}
win.setContentSize(700,1050);
await run(`state.settings.theme='dark';applyTheme();document.querySelector('[data-tm-section="sensors"]').scrollIntoView({block:'start'});tmReceive(new Uint8Array([87]));`);
win.webContents.invalidate();await wait(100);win.webContents.invalidate();await wait(100);
const bounds=await run(`const e=document.getElementById('hw-led-call'),r=e.getBoundingClientRect();return {left:r.left,right:r.right,width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth};`);
if(bounds.left<0||bounds.right>bounds.width||bounds.overflow)throw Error('Narrow layout overflow '+JSON.stringify(bounds));
fs.writeFileSync(path.join(out,'track-call-narrow.png'),(await win.webContents.capturePage()).toPNG());
await run('hw.open=false;Trackmate.link.setConnected(false);');
fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({checks,themes,bounds},null,2));
req('./tools/qa/qa-completion.cjs').complete();app.quit();
}catch(e){console.error(e.stack);app.exit(1);}
});});req('./main');
