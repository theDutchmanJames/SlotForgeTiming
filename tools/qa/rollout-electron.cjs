const {app,dialog}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.SF_ROLLOUT_QA,stage=process.env.SF_ROLLOUT_STAGE;
if(!base||!['fresh','reopen','later','deferred','keep','convert','converted'].includes(stage))throw Error('Use the isolated rollout launcher.');
app.setPath('appData',path.join(base,'appdata'));app.disableHardwareAcceleration();
require('./file-diagnostics.cjs')(path.join(base,stage+'.log'),()=>app.exit(1));
let prompts=0,done=false;const timer=setTimeout(()=>app.exit(2),60000),wait=ms=>new Promise(r=>setTimeout(r,ms));
dialog.showMessageBox=async options=>{assert.equal(options.title,'Upgrade database storage');prompts++;fs.writeFileSync(path.join(base,stage+'-prompt.json'),JSON.stringify(options,null,2));return {response:stage==='convert'?0:stage==='keep'?2:1};};
dialog.showErrorBox=(title,message)=>{console.error(title,message);app.exit(1);};
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
 try{
  await wait(350);assert.equal(prompts,['later','keep','convert'].includes(stage)?1:0);
  const backend=['later','deferred','keep'].includes(stage)?'json':'sqlite';assert.equal((await run('return api.storageStatus();')).backend,backend);
  if(stage==='fresh')await run("await api.add('drivers',{name:'Fresh SQLite driver'});");
  if(stage==='reopen')assert.equal((await run("return api.list('drivers');"))[0].name,'Fresh SQLite driver');
  if(['convert','converted'].includes(stage))assert.equal((await run("return api.list('drivers');"))[0].name,'Original JSON driver');
  win.setContentSize(1200,800);
  await run("state.tab='settings';state.settingsSub='general';await render();document.querySelector('#storagemsg').closest('details').open=true;document.querySelector('#storagemsg').scrollIntoView({block:'center'});");await wait(150);
  assert.equal(await run("return !!document.querySelector('#sqliteactivate');"),backend==='json');
  fs.writeFileSync(path.join(base,stage+'-settings.png'),(await win.webContents.capturePage()).toPNG());
  clearTimeout(timer);console.log('ROLLOUT '+stage+' PASS');app.quit();
 }catch(e){console.error(e);app.exit(1);}
 });});require('../../main');
