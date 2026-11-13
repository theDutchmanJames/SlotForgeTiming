'use strict';
// Verify revised Service Stop guidance in the real app, with private fixture storage.
const {app,dialog}=require('electron'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../../../outputs/post-221-audio-review');fs.mkdirSync(out,{recursive:true});
const isolated=fs.mkdtempSync(path.join(os.tmpdir(),'sf-audio-review-'));app.setPath('appData',isolated);process.env.LOCALAPPDATA=path.join(isolated,'local');app.disableHardwareAcceleration();
const profile=path.join(isolated,'slotforge-timing');fs.mkdirSync(profile);new(require('../../db'))(path.join(profile,'slotforge-timing.json')).saveNow();
fs.writeFileSync(path.join(profile,'storage-conversion-prompt.json'),JSON.stringify({version:1,choice:'keep'}));
const lib=require('../../vendor/slotforge-library/index.cjs'),open=lib.open;lib.open=o=>open({...o,sharedRoot:path.join(isolated,'shared'),legacyProfiles:[profile]});
const completion=require('./qa-completion.cjs');completion.preventRelaunch(app);require('./file-diagnostics.cjs')(path.join(out,'diagnostics.log'),()=>app.exit(1));dialog.showErrorBox=(t,m)=>{console.error(t,m);app.exit(1);};
const wait=ms=>new Promise(r=>setTimeout(r,ms));let done=false;const timeout=setTimeout(()=>app.exit(2),60000);
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 const run=s=>win.webContents.executeJavaScript('(async()=>{'+s+'})()');
 try{
  for(let i=0;i<200;i++){if(await run('return !!state.schema.slotcars'))break;await wait(40);}
  win.setContentSize(1280,1100);
  await run(`window.qaErrors=[];addEventListener('error',e=>qaErrors.push(e.message));addEventListener('unhandledrejection',e=>qaErrors.push(String(e.reason)));state.tab='custom';state.customSub='audio';audDrivers=[];audEd={id:null,draft:Sound.defaultSet('Service Stop calls'),dirty:true};audioView={tab:'calls',category:'Pits & Service Stop',call:'serviceready',search:'',filter:'all',folders:{},variations:{}};await render();`);
  const themes=await run('return Theme.THEMES.map(t=>t[0]);');
  for(const theme of themes){
   await run(`state.settings.theme=${JSON.stringify(theme)};applyTheme();`);await wait(80);
   const text=await run(`return document.querySelector('[data-audio-call="serviceready"]').textContent;`);
   assert.match(text,/not completion of every service job/);assert.match(text,/Driver mode/);assert(!text.includes('Automatic Service Stop only'));
   assert.equal(await run(`return audEd.draft.calls.serviceready.lines[0].text;`),'{driver}, you may leave the pits.');
   fs.writeFileSync(path.join(out,theme+'.png'),(await win.webContents.capturePage()).toPNG());
  }
  await run(`Help.view().select('servicestop');Help.render(document.getElementById('view'));window.scrollTo(0,0);`);
  assert.match(await run('return document.body.textContent;'),/Penalty time always adds afterward/);
  assert.deepEqual(await run('return qaErrors;'),[]);
  fs.writeFileSync(path.join(out,'help.png'),(await win.webContents.capturePage()).toPNG());
  fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({passed:true,themes:themes.length,readyGuidance:true,defaultPhrase:true,help:true}));completion.complete();clearTimeout(timeout);app.quit();
 }catch(e){console.error(e.stack||e);app.exit(1);}
 });});
require('../../main.js');
