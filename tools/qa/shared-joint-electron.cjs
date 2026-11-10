'use strict';
// One-shot, explicitly registered disposable peer test. Never selects a normal
// user profile and never seeds, restores or adopts into the peer library.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {app,dialog}=require('electron');
const root=path.resolve(process.env.SF_JOINT_ROOT||''),exchange=path.resolve(process.env.SF_JOINT_EXCHANGE||'');
if(!process.env.SF_JOINT_ROOT||!process.env.SF_JOINT_EXCHANGE||!fs.existsSync(path.join(root,'library.json')))throw Error('An existing disposable registration and new exchange folder are required.');
const permit=JSON.parse(fs.readFileSync(path.join(root,'joint-qa-permission.json'),'utf8'));
assert.equal(permit.disposable,true);assert.equal(permit.allowTimingWrites,true);
fs.mkdirSync(exchange); // Reject reuse: a stale go file must not start writes.
const isolated=fs.mkdtempSync(path.join(os.tmpdir(),'sf-joint-')),profile=path.join(isolated,'slotforge-timing');fs.mkdirSync(profile);
app.setPath('appData',isolated);process.env.LOCALAPPDATA=path.join(isolated,'local-app-data');app.disableHardwareAcceleration();
const engine=require('../../vendor/slotforge-library/index.cjs'),open=engine.open;
engine.open=options=>open({...options,sharedRoot:root,legacyProfiles:[]});
const db=new(require('../../db'))(path.join(profile,'slotforge-timing.json'));db.data.paddock={sourceId:'joint-native-timing',connection:null,withdrawals:[]};db.saveNow();
fs.writeFileSync(path.join(profile,'storage-conversion-prompt.json'),JSON.stringify({version:1,choice:'keep'}));
assert.equal(require('../../shared-library-activation').enabled,true);
require('./qa-completion.cjs').preventRelaunch(app);require('./file-diagnostics.cjs')(path.join(exchange,'diagnostics.log'),()=>app.exit(1));
dialog.showErrorBox=(title,message)=>{console.error(title,message);app.exit(1);};
const wait=ms=>new Promise(r=>setTimeout(r,ms));let started=false;
const timeout=setTimeout(()=>{console.error('Joint handshake deadline exceeded');app.exit(2);},180000);
const publish=(name,value)=>{const file=path.join(exchange,name);fs.writeFileSync(file+'.tmp',JSON.stringify(value,null,2));fs.renameSync(file+'.tmp',file);};
app.on('browser-window-created',(_,win)=>{win.show=()=>{};win.hide();win.webContents.on('did-finish-load',async()=>{
 if(started||!win.webContents.getURL().endsWith('index.html'))return;started=true;
 const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
 const until=async condition=>{for(let n=0;n<250;n++){if(await run('return '+condition))return;await wait(40);}throw Error('Timeout: '+condition);};
 try{
  await until('!!state.schema.slotcars');win.webContents.setBackgroundThrottling(false);win.setOpacity(0);win.showInactive();await run(`window.qaErrors=[];addEventListener('error',e=>qaErrors.push(e.message));addEventListener('unhandledrejection',e=>qaErrors.push(String(e.reason)));state.tab='database';state.sub='slotcars';await render();`);
  const status=await run('return api.libraryStatus()');assert.equal(status.available,true);
  publish('ready.json',{isolated,profile,root,status});
  for(let n=0;!fs.existsSync(path.join(exchange,'go.json'));n++){if(n>=500)throw Error('No peer go signal');await wait(200);}
  const command=JSON.parse(fs.readFileSync(path.join(exchange,'go.json'),'utf8'));
  assert.equal(command.databaseId,status.databaseId);assert.equal(typeof command.carId,'string');assert.equal(typeof command.name,'string');assert(command.name.length>0&&command.name.length<120);
  await run(`document.querySelector('[data-edit='+CSS.escape(${JSON.stringify(command.carId)})+']').click()`);
  await until('!!document.querySelector("[data-field=name]")');
  await run(`document.querySelector('[data-field=name]').value=${JSON.stringify(command.name)};document.querySelector('.shared-car-dialog form').requestSubmit();`);
  await until('!document.querySelector(".shared-car-dialog[open]")');
  const edited=await run(`return api.getRecord('slotcars',${JSON.stringify(command.carId)})`);assert.equal(edited.name,command.name);
  const evidence=require('./rich-mapper-fixtures.cjs').evidence();
  const sessionId=await run(`const e=${JSON.stringify(evidence)},captured=await api.paddockPrepare([${JSON.stringify(command.carId)}]);e.session.paddockJournal.captures={local:captured.captures[${JSON.stringify(command.carId)}]};e.session.paddockJournal.sharedLibrary=captured.sharedLibrary;return api.saveSession(e.session,e.laps);`);
  const peer=await open({application:'Timing QA readback',installationId:'joint-verifier',sharedRoot:root,appData:isolated,legacyProfiles:[]});
  try{let accepted;for(let n=0;n<200;n++){accepted=(await peer.historyRead({kind:'sessions',sourceId:'joint-native-timing'})).entries.find(e=>e.sessionId===sessionId);if(accepted)break;await wait(100);}assert(accepted);publish('written.json',{sessionId,accepted,edited,status:await peer.status()});}finally{await peer.close();}
  for(let n=0;!fs.existsSync(path.join(exchange,'finish.json'));n++){if(n>=250)throw Error('No peer finish signal');await wait(200);}
  const finish=JSON.parse(fs.readFileSync(path.join(exchange,'finish.json'),'utf8'));
  if(finish.carId||finish.name){assert.equal(finish.carId,command.carId);assert.equal(typeof finish.name,'string');
   await until(`document.body.innerText.includes(${JSON.stringify(finish.name)})`);
   const refreshed=await run(`return api.getRecord('slotcars',${JSON.stringify(finish.carId)})`);assert.equal(refreshed.name,finish.name);
  }
  assert.deepEqual(await run('return qaErrors'),[]);publish('result.json',{passed:true,sessionId,root,isolated});
  require('./qa-completion.cjs').complete();clearTimeout(timeout);app.quit();
 }catch(e){let ui;try{ui=await run(`return {text:document.body.innerText,invalid:[...document.querySelectorAll('input:invalid,select:invalid')].map(e=>({field:e.dataset,value:e.value,message:e.validationMessage}))}`);}catch{}publish('failure.json',{message:e.message,stack:e.stack,ui});console.error(e);clearTimeout(timeout);app.exit(1);}
 });});
require('../../main');
