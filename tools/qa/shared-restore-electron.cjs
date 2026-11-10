'use strict';
const {app,dialog}=require('electron'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const plan=JSON.parse(fs.readFileSync(process.env.SF_RESTORE_QA_PLAN));assert(plan.passed&&path.dirname(plan.isolated)===os.tmpdir()&&path.basename(plan.isolated).startsWith('sf-engine-'));assert.equal(plan.profile,path.join(plan.isolated,'slotforge-timing'));
app.setPath('appData',plan.isolated);process.env.LOCALAPPDATA=path.join(plan.isolated,'local-app-data');app.disableHardwareAcceleration();require('./qa-completion.cjs').preventRelaunch(app);require('./file-diagnostics.cjs')(path.join(plan.out,'diagnostics.log'),()=>app.exit(1));dialog.showErrorBox=(t,m)=>{console.error(t,m);app.exit(1);};
const engine=require('../../vendor/slotforge-library/index.cjs'),open=engine.open;engine.open=options=>open({...options,sharedRoot:plan.sharedRoot});assert.equal(require('../../shared-library-activation').enabled,true);
let done=false;const timeout=setTimeout(()=>app.exit(2),110000),wait=ms=>new Promise(r=>setTimeout(r,ms));
app.on('browser-window-created',(_,win)=>{win.show=()=>{};win.hide();win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
 try{
  for(let i=0;i<200&&!await run('return !!state.schema.slotcars');i++)await wait(40);
  const status=await run('return api.libraryStatus()');assert.notEqual(status.recoveryId,plan.before.recoveryId);assert.equal(require('../../shared-library-restore').read(plan.profile).phase,'complete');
  const cars=await run(`return api.list('slotcars')`);assert.equal(cars.length,2);assert(!cars.some(c=>/Must (disappear|not replay)/.test(c.name)));
  let pending;for(let i=0;i<100;i++){pending=(await run('return api.librarySaves()')).find(r=>r.id===plan.pendingId);if(pending?.state==='blocked')break;await wait(40);}assert.equal(pending?.code,'RECOVERY_CHANGED');
  const originals=await run(`return api.libraryOriginalHistory({kind:'sessions'})`);assert(originals.rows.some(r=>r.sessionId===plan.tokenSessionId));
  win.setContentSize(1200,850);win.setOpacity(0);win.showInactive();await run(`state.tab='settings';await render();await renderTransferSettings(document.querySelector('main')||document.body);document.querySelector('#bk-save').closest('details').open=true;`);
  assert(await run(`return document.body.innerText.includes('Restoring the shared library affects both apps.')`));await wait(100);fs.writeFileSync(path.join(plan.out,'restored-backup-settings.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
  fs.writeFileSync(path.join(plan.out,'result.json'),JSON.stringify({passed:true,backend:plan.backend,isolated:plan.isolated,recoveryId:status.recoveryId,checks:['pending restore processed before normal app writes','library reopened with new epoch','old car intent blocked','post-backup car absent','measured/token history retained','shared backup settings rendered']},null,2));require('./qa-completion.cjs').complete();clearTimeout(timeout);app.quit();
 }catch(e){console.error(e);clearTimeout(timeout);app.exit(1);}
});});require('../../main');
