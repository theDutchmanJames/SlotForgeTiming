const {app,dialog,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../../../outputs/plugin-rules'),data=path.resolve(__dirname,'../../.tmp-test/plugin-rules-electron-'+process.pid);fs.mkdirSync(out,{recursive:true});app.setPath('appData',data);app.disableHardwareAcceleration();
const pack=require('../fixtures/rule-plugin.cjs').make(),file=path.join(out,'club-rules.slotforge-plugin');fs.writeFileSync(file,JSON.stringify(pack,null,2));dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});
const wait=ms=>new Promise(r=>setTimeout(r,ms));let done=false;setTimeout(()=>app.exit(2),150000).unref();
app.on('browser-window-created',(_,win)=>win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 const run=s=>win.webContents.executeJavaScript('(async()=>{'+s+'})()');
 const until=async code=>{for(let i=0;i<150;i++){if(await run(code))return;await wait(70);}throw Error('Timed out: '+code);};
 const shot=async name=>{await wait(250);fs.writeFileSync(path.join(out,name+'.png'),(await win.webContents.capturePage()).toPNG());};
 try{
  win.setMinimumSize(0,0);win.setContentSize(1440,1000);win.showInactive();await wait(500);
  await run(`window.confirm=()=>true;window.qaAlerts=[];window.alert=s=>qaAlerts.push(s);window.qaErrors=[];addEventListener('error',e=>qaErrors.push(e.message));addEventListener('unhandledrejection',e=>qaErrors.push(String(e.reason)));window.ck=(v,m)=>{if(!v)throw Error(m)};
    window.qaPlugin=await api.pluginsOpen();await api.pluginsInstall();await api.pluginsStart(qaPlugin.manifest.id,qaPlugin.digest,true);
    window.qaTrack=await api.add('tracks',{name:'Club Raceway',lanes:2,minLap:0,length:15});
    window.qaSetup=await api.add('racesetups',{name:'Club Challenge',sessionType:'race',track:qaTrack.id,laps:20,firstLap:'count',lightsMin:0,lightsMax:0});
    window.qaJames=await api.add('drivers',{name:'James'});window.qaSam=await api.add('drivers',{name:'Sam'});
    state.tab='setup';state.setupSub='setups';await render();openForm('racesetups',qaSetup);document.querySelector('[data-rail="rules"]')?.click();
    const f=document.querySelector('#f-rulePlugin');ck(f,'Rule selector');f.value=qaPlugin.manifest.id;f.dispatchEvent(new Event('change',{bubbles:true}));`);
  const themes=['dark','light','midnight','forest','sunset','violet','carbon','ocean'];
  for(const theme of themes){await run(`state.settings.theme='${theme}';applyTheme();document.querySelector('#f-rulePlugin').scrollIntoView({block:'center'});`);await shot(theme+'-setup');}
  win.setContentSize(600,900);await run(`document.querySelector('#f-rulePlugin').scrollIntoView({block:'center'});`);await shot('setup-600');
  await run(`document.querySelector('#frm').requestSubmit();`);await until(`return !dlg.open;`);await run(`qaSetup=(await api.list('racesetups')).find(x=>x.id===qaSetup.id);ck(qaSetup.rulePlugin===qaPlugin.manifest.id,'Saved selector');`);
  win.setContentSize(1440,1000);await run(`state.settings.theme='dark';applyTheme();state.tab='race';state.race={setup:qaSetup,track:qaTrack,rows:[{driverId:qaJames.id},{driverId:qaSam.id}]};await render();ck(live.engine().cfg.rulePlugin.settings.target===10,'Frozen settings');`);await shot('ready');
  await run('live.actions.start();');await until(`return live.phase==='running';`);await wait(1200);
  await run(`live.lapBtns[0].b.click();live.lapBtns[1].b.click();const e=live.engine();ck(e.cars.every(c=>c.laps.length===1),'Both lap buttons use shared crossing');ck(e.cars.every(c=>e.pluginTimeOf(c)===2000),'Rule time applied');ck(e.cars.every(c=>c.laps[0]<10000&&c.best===c.laps[0]),'Raw best unchanged');`);
  await assert.rejects(run(`await api.pluginRulePrepare(qaPlugin.manifest.id);`),/Finish the race/);
  await until(`return (await api.getResume())?.race?.rulePlugin?.digest===qaPlugin.digest;`);
  await until(`return (await api.getResume())?.eng?.cars?.[0]?.laps?.length===1;`);
  await run(`window.qaRecovery=await api.getResume();`);
  await run('live.actions.stop(true);');await until(`return live.phase==='review';`);await shot('review');
  await until(`return (await api.liveGet()).dyn?.phase==='review';`);
  await run('await api.liveOpen();');await wait(800);
  const second=BrowserWindow.getAllWindows().find(w=>w!==win&&w.webContents.getURL().endsWith('#live'));assert(second,'Second Electron window opened');
  const run2=s=>second.webContents.executeJavaScript('(async()=>{'+s+'})()');
  await run2(`state.settings.resultsView={summary:['total','best','laps','invalid']};LiveView.go('results');`);await wait(400);
  const totals=await run(`return live.engine().cars.map(c=>RaceEngine.fmtTime(live.engine().timeOf(c)));`);
  assert(await run2(`return ${JSON.stringify(totals)}.every(t=>document.body.textContent.includes(t));`),'Second screen displays effective rule-adjusted totals');
  fs.writeFileSync(path.join(out,'second-screen.png'),(await second.webContents.capturePage()).toPNG());
  const wire=await run('return await api.liveGet();');
  const server=require('../../server').createServer({root:path.resolve(__dirname,'../../renderer'),appRoot:path.resolve(__dirname,'../..'),schema:require('../../schema'),getSettings:()=>({theme:'dark',resultsView:{summary:['total','best','laps','invalid']}}),list:()=>[],customFields:()=>[],getLive:()=>wire,onCommand:()=>{}});
  const port=await server.listen(0,'127.0.0.1'),web=new BrowserWindow({show:false,width:1100,height:800,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
  await web.loadURL('http://127.0.0.1:'+port+'/#live');await wait(800);await web.webContents.executeJavaScript(`LiveView.go('results')`);await wait(400);
  assert(await web.webContents.executeJavaScript(`${JSON.stringify(totals)}.every(t=>document.body.textContent.includes(t))`),'HTTP viewer shows the same effective totals without a plugin worker');
  fs.writeFileSync(path.join(out,'network-viewer.png'),(await web.webContents.capturePage()).toPNG());web.destroy();await server.close();
  for(const theme of themes){await run(`state.settings.theme='${theme}';applyTheme();`);await shot(theme+'-review');}
  await run(`live.reviewCommand({op:'invalid',car:0,lap:0,on:true});ck(live.engine().pluginTimeOf(live.engine().cars[0])===0,'Review removes consequence');`);await shot('invalidated');
  await wait(800);const reviewed=await run(`return RaceEngine.fmtTime(live.engine().timeOf(live.engine().cars[0]));`);
  assert(await run2(`return document.body.textContent.includes(${JSON.stringify(reviewed)});`),'Second screen receives lap-review changes');second.close();
  await run(`await live.actions.finalize();`);await until(`return (await api.list('sessions')).some(s=>s.rulePlugin?.id===qaPlugin.manifest.id);`);
  await run(`const s=(await api.list('sessions')).find(s=>s.rulePlugin?.id===qaPlugin.manifest.id);ck(s.rulesSnapshot.config.rulePlugin.digest===qaPlugin.digest,'Result provenance');ck(s.standings.every(x=>x.pluginPoints===1),'Saved bonuses');ck(s.standings.find(x=>x.driverId===qaSam.id).penalty===2000,'Saved penalty includes rule component');ck(s.standings.find(x=>x.driverId===qaJames.id).pluginTimeMs===0,'Saved reviewed consequence');window.qaSavedResult=s;`);
  await until(`return (await api.liveGet()).dyn?.phase==='finished';`);
  await until(`return (await api.getResume())===null;`);
  await run(`live.leave();live.alive=false;state.race=null;await api.pluginsStop(qaPlugin.manifest.id);await api.pluginRulePrepare(qaPlugin.manifest.id,qaSavedResult.rulePlugin);`);
  // Corrupted required-rule ledgers must preserve recovery and never expose a fresh race.
  await run(`const bad=JSON.parse(JSON.stringify(qaRecovery));bad.eng.cars[0].pluginLaps=[];await api.saveResume(bad);window.qaBrokenRecovery=JSON.stringify(await api.getResume());state.race={...bad.race,resume:bad};state.tab='race';await render();ck(state.tab==='home'&&!state.race&&!live.alive,'Bad rule ledger blocks recovery');ck(qaAlerts.at(-1).includes('Cannot restore this plugin race'),'Recovery explanation');window.qaRecoveryAfter=await api.getResume();`);
  const recoveryPair=await run(`return {before:JSON.parse(qaBrokenRecovery),after:qaRecoveryAfter};`);fs.writeFileSync(path.join(out,'recovery-check.json'),JSON.stringify(recoveryPair,null,2));assert.deepEqual(recoveryPair.after,recoveryPair.before,'Original recovery is retained');
  await shot('blocked-recovery');
  await run(`await api.clearResume();`);
  // Stopped and missing dependencies must never become an ordinary unmodified race.
  await run(`state.tab='race';state.race={setup:qaSetup,track:qaTrack,rows:[{driverId:qaJames.id},{driverId:qaSam.id}]};await render();ck(qaAlerts.at(-1).includes('Start'),'Stopped dependency blocked');`);
  await run(`await api.pluginsRemove(qaPlugin.manifest.id,false);`);await assert.rejects(run(`await api.pluginRulePrepare(qaPlugin.manifest.id,qaSavedResult.rulePlugin);`));
  assert.deepEqual(await run('return qaErrors;'),[]);
  fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({passed:true,themes,widths:[1440,600],checks:['Real plugin worker preparation','Race Setup selection saved/reopened','Eight-theme setup and finalize screens','Lap buttons use shared sensor crossing','Raw times and personal-best eligibility unchanged','Plugin time separated and saved','Second Electron window and HTTP viewer display adjusted totals','Second screen receives lap review updates','Lap invalidation removes consequence','Rejected rule ledger blocks start and preserves checkpoint','Frozen checkpoint and result provenance','Competition bonus persisted','Race-time mutation lock','Stopped/new and missing/resume dependency blocked','Saved plan verified without worker execution','No renderer errors']},null,2));
  console.log('PLUGIN RULE ELECTRON PASSED');app.quit();
 }catch(e){console.error(e);console.error(await run('return {errors:qaErrors,alerts:qaAlerts,body:document.body.innerText.slice(-2000)};'));await shot('failure');app.exit(1);}
}));require('../../main');
