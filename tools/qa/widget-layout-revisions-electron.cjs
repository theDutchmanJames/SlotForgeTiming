const fs=require('fs'),path=require('path'),os=require('os'),repo=path.resolve(__dirname,'../..'),req=require('module').createRequire(path.join(repo,'package.json'));
const {app,dialog}=req('electron'),out=path.resolve(__dirname,'../../../outputs/widget-fit-implementation');fs.mkdirSync(out,{recursive:true});
const isolated=fs.mkdtempSync(path.join(os.tmpdir(),'sf-widget-review-'));app.setPath('appData',isolated);process.env.LOCALAPPDATA=path.join(isolated,'local');app.disableHardwareAcceleration();
const profile=path.join(isolated,'slotforge-timing');fs.mkdirSync(profile);new(req('./db'))(path.join(profile,'slotforge-timing.json')).saveNow();fs.writeFileSync(path.join(profile,'storage-conversion-prompt.json'),JSON.stringify({version:1,choice:'keep'}));
const lib=req('./vendor/slotforge-library/index.cjs'),open=lib.open;lib.open=o=>open({...o,sharedRoot:path.join(isolated,'shared'),legacyProfiles:[profile]});
req('./tools/qa/qa-completion.cjs').preventRelaunch(app);req('./tools/qa/file-diagnostics.cjs')(path.join(out,'diagnostics.log'),()=>app.exit(1));dialog.showErrorBox=(t,m)=>{console.error(t,m);app.exit(1);};
const wait=ms=>new Promise(r=>setTimeout(r,ms));let done=false;setTimeout(()=>app.exit(2),70000).unref();
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.setBackgroundThrottling(false);win.webContents.on('did-finish-load',async()=>{
if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
try{const run=c=>win.webContents.executeJavaScript('(async()=>{'+c+'})()');for(let i=0;i<150;i++){if(await run('return !!state.schema.racesetups'))break;await wait(40);}
win.setContentSize(1500,1050);
const editor=await run(fs.readFileSync(path.join(__dirname,'widget-layout-editor-probe.js'),'utf8'));
fs.writeFileSync(path.join(out,'editor.png'),(await win.webContents.capturePage()).toPNG());
await run('editorLeave();');
const result=await run(fs.readFileSync(path.join(__dirname,'widget-layout-revisions-probe.js'),'utf8'));
const leaderboards=await run(fs.readFileSync(path.join(__dirname,'leaderboard-sizing-probe.js'),'utf8'));
const themes=await run('return Theme.THEMES.map(x=>x[0]);');
await run('columnSpacingGallery();');win.webContents.invalidate();await wait(120);
fs.writeFileSync(path.join(out,'column-spacing.png'),(await win.webContents.capturePage()).toPNG());
for(const theme of themes){
 await run(`state.settings.theme=${JSON.stringify(theme)};applyTheme();revisionGallery();`);
 await wait(120);
 fs.writeFileSync(path.join(out,'all-in-one-'+theme+'.png'),(await win.webContents.capturePage()).toPNG());
 await run('revisionDetailGallery();');
 win.webContents.invalidate();
 await wait(120);
 const meterChecks=await run(`return [...document.querySelectorAll('.fuel-gauge[data-fuel-placement="overlay"] .fg-meter')].map(e=>({fits:Frame.textFits(e.querySelector('.fg-values'),e),meter:e.getBoundingClientRect().toJSON(),text:[...e.querySelectorAll('.fg-value,.fg-detail')].map(n=>({text:n.textContent,rect:n.getBoundingClientRect().toJSON(),font:getComputedStyle(n).fontSize}))}));`);
 if(meterChecks.some(x=>!x.fits))throw Error('Fuel overlay '+theme+JSON.stringify(meterChecks));
 const states=await run('return [...document.querySelectorAll("#revision-canvas .lw")].map(e=>e.dataset.fitStatus);');
 if(states.some(x=>x!=='fits'))throw Error('Theme gallery did not fit: '+theme+JSON.stringify(states));
 fs.writeFileSync(path.join(out,'laps-fuel-'+theme+'.png'),(await win.webContents.capturePage()).toPNG());
 await run('leaderboardReviewGallery();');win.webContents.invalidate();await wait(120);
 win.webContents.invalidate();await wait(120);
 fs.writeFileSync(path.join(out,'leaderboards-'+theme+'.png'),(await win.webContents.capturePage()).toPNG());
}
fs.writeFileSync(path.join(out,'revisions.json'),JSON.stringify({...result,editor,themes,leaderboards},null,2));
req('./tools/qa/qa-completion.cjs').complete();app.quit();
}catch(e){console.error(e.stack);app.exit(1);}
});});req('./main');
