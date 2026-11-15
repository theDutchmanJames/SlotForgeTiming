'use strict';
const {app,dialog}=require('electron'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const backend=process.env.SF_SETUP_HISTORY_BACKEND||'json',out=path.resolve(__dirname,'../../../outputs/setup-history-review',backend);fs.mkdirSync(out,{recursive:true});
const isolated=fs.mkdtempSync(path.join(os.tmpdir(),'sf-setup-history-ui-'));app.setPath('appData',isolated);process.env.LOCALAPPDATA=path.join(isolated,'local');app.disableHardwareAcceleration();
const profile=path.join(isolated,'slotforge-timing');fs.mkdirSync(profile);const engine=require('../../vendor/slotforge-library/index.cjs'),open=engine.open;engine.open=o=>open({...o,sharedRoot:path.join(isolated,'shared'),legacyProfiles:[profile]});
require('./qa-completion.cjs').preventRelaunch(app);require('./file-diagnostics.cjs')(path.join(out,'diagnostics.log'),()=>app.exit(1));dialog.showErrorBox=(title,message)=>{console.error(title,message);app.exit(1);};
const db=new(require('../../db'))(path.join(profile,'slotforge-timing.json'));require('../../tests/fixtures/setup-history.cjs')(db,{unrelated:12,lapCount:1200});
// The unit fixture deliberately mixes one token lap into a racing session to
// test legacy replay semantics. Shared-history adoption correctly rejects that
// inconsistent evidence for writes; native award checks use normal race data.
db.data.laps=db.data.laps.filter(l=>l.id!=='mixed-token');db.saveNow();const original=fs.readFileSync(db.file),savedReplay=structuredClone(db.data.virtualrivalsystems[0]);
if(backend==='sqlite'){const generation=require('node:crypto').randomUUID(),copy=path.join(profile,'sqlite',generation);fs.mkdirSync(path.dirname(copy),{recursive:true});require('../../sqlite-migration').migrateCopy({source:db.file,destination:copy});require('../../sqlite-working').forkCopy(copy,path.join(copy,'working'));fs.writeFileSync(path.join(profile,'storage-backend.json'),JSON.stringify({format:'slotforge-storage-selection',version:1,backend:'sqlite',generation}));}
fs.writeFileSync(path.join(profile,'storage-conversion-prompt.json'),JSON.stringify({version:1,choice:'keep'}));
let guarded=false,delayed=false;const reads=[];
for(const Repo of [require('../../data-repository'),require('../../sqlite-app-repository')]){
 const list=Repo.prototype.list,editorRead=Repo.prototype.editorRead;
 Repo.prototype.list=function(entity){if(guarded&&['sessions','laps','tracks','drivers','teams'].includes(entity))throw Error('Unexpected full collection: '+entity);return list.call(this,entity);};
 Repo.prototype.editorRead=function(kind,entity,value){if(guarded)reads.push({kind,id:value?.id});return delayed&&kind==='rival-laps'?new Promise(resolve=>setTimeout(()=>resolve(editorRead.call(this,kind,entity,value)),140)):editorRead.call(this,kind,entity,value);};
}
const source=file=>require('node:child_process').execFileSync('git',['show','HEAD:renderer/'+file],{cwd:path.resolve(__dirname,'../..'),encoding:'utf8'});
const oldRival=source('virtualrivalui.js'),oldChamp=source('championshipui.js');
let done=false,startupReady=false;require('electron').ipcMain.on('startup:ready',()=>{startupReady=true;});
const wait=ms=>new Promise(r=>setTimeout(r,ms)),timeout=setTimeout(()=>app.exit(2),110000);
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.setBackgroundThrottling(false);win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()'),until=async c=>{for(let i=0;i<180;i++){if(await run('return '+c))return;await wait(40);}throw Error('Timeout: '+c);},shot=async name=>{await wait(100);fs.writeFileSync(path.join(out,name+'.png'),(await win.webContents.capturePage()).toPNG());};
 try{
  for(let i=0;i<200&&!startupReady;i++)await wait(50);assert(startupReady,'Initial render must finish before navigating');
  await until('!!state.schema.slotcars');win.setContentSize(1400,1000);assert.equal(await run('return (await api.storageStatus()).backend'),backend);
  await run("window.qaErrors=[];window.alert=m=>qaErrors.push(m);window.confirm=()=>true;addEventListener('error',e=>qaErrors.push(e.message));addEventListener('unhandledrejection',e=>qaErrors.push(String(e.reason)));state.tab='setup';state.setupSub='virtualrivals';await render();");
  guarded=true;reads.length=0;await run("await renderVirtualRivals(document.getElementById('setupmgr'));");assert.equal(reads.length,0);
  // Compare exact list HTML with the previously committed renderer.
  const rivalList=await run("return document.getElementById('setupmgr').innerHTML");guarded=false;
  const oldRivalFn='async function renderVirtualRivals(box) {'+oldRival.split('async function renderVirtualRivals(box) {')[1];
  assert.equal(await run(`await (${oldRivalFn})(document.getElementById('setupmgr'));return document.getElementById('setupmgr').innerHTML;`),rivalList);
  guarded=true;await run("await renderVirtualRivals(document.getElementById('setupmgr'));document.querySelector('[data-rival-edit=rival]').click();");await until("!!document.getElementById('vr-source')");
  assert.deepEqual(await run('return rivalEditor.draft.recording'),savedReplay.recording);assert(reads.some(r=>r.kind==='rival-sources'));assert(reads.filter(r=>r.kind==='rival-laps').every(r=>r.id==='recording'));await shot('rival-editor-dark');
  // Source changes load only that recording; capture still uses the unchanged V.capture.
  await run("const s=document.getElementById('vr-source');s.value='other-0';await document.getElementById('setupmgr').onchange({target:s});const d=document.getElementById('vr-person');d.value='d';await document.getElementById('setupmgr').onchange({target:d});");
  assert.equal(await run('return rivalEditor.draft.sourceId'),'other-0');assert.deepEqual(await run('return rivalEditor.draft.recording'),[{lap:1,time:6000,pit:false,invalid:false}]);
  await run("await document.getElementById('vr-form').onsubmit({preventDefault(){}});");assert.equal(await run('return (await api.getRecord("virtualrivalsystems","rival")).sourceId'),'other-0');
  // Race two asynchronous choices: the slower earlier load must not replace the latest one.
  delayed=true;await run("const box=document.getElementById('setupmgr'),s=document.getElementById('vr-source');s.value='recording';window.firstSource=box.onchange({target:s});s.value='other-1';window.secondSource=box.onchange({target:s});await Promise.all([firstSource,secondSource]);");delayed=false;
  assert.equal(await run('return document.getElementById("vr-source").value'),'other-1');await run("const d=document.getElementById('vr-person');d.value='d';await document.getElementById('setupmgr').onchange({target:d});");assert.equal(await run('return rivalEditor.draft.sourceId'),'other-1');
  await run("document.getElementById('vr-back').click();");await until('rivalEditor===null');
  await run("state.setupSub='championships';await render();await renderChampionships(document.getElementById('setupmgr'));window.currentChampList=document.getElementById('setupmgr').innerHTML;");
  const oldLists=oldChamp.slice(oldChamp.indexOf('async function champLists()'),oldChamp.indexOf('// 1.78.0:'));
  guarded=false;assert(await run(`${oldLists};await renderChampionships(document.getElementById('setupmgr'));return currentChampList===document.getElementById('setupmgr').innerHTML;`));guarded=true;
  await run("await renderChampionships(document.getElementById('setupmgr'));document.querySelector('[data-edit=cup]').click();");await until('!!chEd');await shot('championship-editor');
  await run("chEd=null;state.tab='database';state.sub='results';state.resultsSub='champs';champView.id='cup';await render();");await until('!!document.getElementById("chs-pick")');const html=await run('return document.getElementById("chs-pick").parentElement.parentElement.parentElement.innerHTML');
  // Baseline standings and panel output, using the previous full-history reader.
  const oldData=oldChamp.slice(oldChamp.indexOf('async function champData()'),oldChamp.indexOf('let champView ='));
  await run('window.newChampData=champData');guarded=false;await run(`${oldData};window.oldChampData=champData;`);guarded=true;
  const compared=await run("const fresh=await newChampData({champId:'cup'});window.freshChamp=fresh;return fresh.sessions.map(s=>s.id);");assert.equal(compared.length,5);
  guarded=false;assert(await run("const old=await oldChampData(),fresh=freshChamp,c=fresh.champs.find(c=>c.id==='cup'),ctx=champCtx(fresh);return JSON.stringify(ChampPts.standings(c,old.sessions,ctx))===JSON.stringify(ChampPts.standings(c,fresh.sessions,ctx));"));guarded=true;
  await shot('championship-standings-dark');await run("state.settings.theme='light';applyTheme();");await shot('championship-standings-light');
  // Real Award and Undo handlers use the scoped history; duplicate awards replace earlier runs.
  await run("window.panel=document.createElement('div');panel.dataset.cpbox='rerun';view.append(panel);await champPanelsFor([panel]);panel.querySelector('[data-cp=award]').click();");await until("!!panel.querySelector('[data-cp=undo]')");
  assert(await run("return !!(await api.getRecord('sessions','rerun')).champ.awarded"));assert(!(await run("return !!(await api.getRecord('sessions','recording')).champ.awarded")));
  await run("panel.querySelector('[data-cp=undo]').click();");await until("!!panel.querySelector('[data-cp=award]')");assert(!(await run("return !!(await api.getRecord('sessions','rerun')).champ.awarded")));
  assert.deepEqual(await run('return qaErrors'),[]);if(backend==='sqlite')assert.deepEqual(fs.readFileSync(db.file),original);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,backend,isolated,checks:['no broad history/reference reads','Rival list has zero history reads','list HTML parity','saved replay preserved until explicit capture','selected source and save','stale asynchronous source selection','championship list HTML parity','standings parity','Award replaces rerun; Undo persists','dark/light screenshots','original JSON retained in SQLite mode']},null,2));clearTimeout(timeout);require('./qa-completion.cjs').complete();app.exit(0);
 }catch(error){console.error(error);fs.writeFileSync(path.join(out,'failure.png'),(await win.webContents.capturePage()).toPNG());clearTimeout(timeout);app.exit(1);}
});});db.writesIdle().then(()=>require('../../main')).catch(e=>{console.error(e);app.exit(1);});
