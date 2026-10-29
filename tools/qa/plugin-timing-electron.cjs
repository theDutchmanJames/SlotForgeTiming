// Real main process, preload, plugin utility process, settings UI and race engine.
const {app,dialog}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {make}=require('../fixtures/timing-plugin.cjs');
const out=path.resolve(__dirname,'../../../outputs/plugin-timing'),data=path.resolve(__dirname,'../../.tmp-test/plugin-timing-electron-'+process.pid);fs.mkdirSync(out,{recursive:true});app.setPath('appData',data);app.disableHardwareAcceleration();
const pack=make(),file=path.join(out,'simulated-timing.slotforge-plugin');fs.writeFileSync(file,JSON.stringify(pack,null,2));dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});
const wait=ms=>new Promise(r=>setTimeout(r,ms));let done=false;setTimeout(()=>app.exit(2),120000).unref();
app.on('browser-window-created',(_,win)=>win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 const run=s=>win.webContents.executeJavaScript('(async()=>{'+s+'})()');
 const until=async code=>{for(let i=0;i<150;i++){if(await run(code))return;await wait(40);}throw Error('Timed out: '+code);};
 const shot=async name=>{await wait(350);fs.writeFileSync(path.join(out,name+'.png'),(await win.webContents.capturePage()).toPNG());};
 const input=async(kind,on,channel=0)=>run(`await api.pluginTimingSimulate({kind:${JSON.stringify(kind)},channel:${channel},on:${on}});`);
 const cross=async(channel=0)=>{await input('lap',true,channel);await wait(30);await input('lap',false,channel);await wait(60);};
 try{
  win.setMinimumSize(0,0);win.setContentSize(1440,1050);win.showInactive();await wait(500);
  await run(`window.qaErrors=[];addEventListener('error',e=>qaErrors.push(e.message));addEventListener('unhandledrejection',e=>qaErrors.push(String(e.reason)));window.ck=(v,m)=>{if(!v)throw Error(m)};window.qaPlugin=await api.pluginsOpen();await api.pluginsInstall();ck(!(await api.pluginsList()).plugins[0].enabled,'Installation does not execute');await setTimingHw('plugin');state.tab='settings';state.settingsSub='hardware';state.hwSub='plugin';await render();`);
  await until(`return !!document.querySelector('.plugin-timing-setup');`);
  await run(`const e=document.querySelector('[data-setting=id]');e.value='${pack.manifest.id}';e.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('[data-setting=outputsOn]').checked=true;document.querySelector('[data-setting=outputsOn]').dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('[data-setting=trackcall]').checked=true;document.querySelector('[data-setting=trackcall]').dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('[data-save]').click();`);
  await until(`return (await api.getSettings()).pluginTiming?.outputsOn===true;`);
  await until(`return !document.querySelector('[data-driver-save]').disabled;`);
  await run(`document.querySelector('[data-plugin-setting=start_covered]').checked=true;document.querySelector('[data-driver-save]').click();`);
  await until(`return (await api.pluginsList()).plugins[0].settings.start_covered===true;`);
  await run(`await api.pluginsStart(qaPlugin.manifest.id,qaPlugin.digest,true);await renderPluginTimingSettings(document.getElementById('hwbox'));`);
  await until(`return !document.querySelector('[data-connect]').disabled;`);await run(`document.querySelector('[data-connect]').click();`);await until('return pt.link.connected;');
  await run(`ck(HomeStats.timing({hardware:'plugin',plugin:true,pluginName:'Simulated Timing Interface'}).state!=='warn','Hardware status recognizes driver');ck(pt.link.total===0,'Covered at connection does not count a lap');document.querySelector('[data-go=diagnostics]').click();`);await input('lap',false);await cross();assert.equal(await run('return pt.link.total;'),1);await shot('connected-diagnostics');
  await run(`state.speed=40;state.race={setup:{id:'plugin-qa',name:'Timing Plugin QA',sessionType:'race',laps:20,firstLap:'count',lightsMin:0,lightsMax:0,startPower:'off',serviceStop:'on',pitHold:2,pitHoldSeconds:3,trackcall:'yellow',redFlagLap:'invalid'},track:{id:'qa-track',name:'QA',lanes:2,minLap:0},rows:[{},{}]};state.tab='race';await render();`);
  await until('return live.plugin?.ready();');await run('live.actions.start();');await until(`return live.phase==='running';`);await wait(70);await cross();assert.equal(await run('return live.engine().cars[0].laps.length;'),1);
  await run(`Trackmate.link.emit({type:'hit',lane:0,at:performance.now()});state.tab='settings';state.settingsSub='hardware';state.hwSub='plugin';await render();`);await until(`return !!document.querySelector('.plugin-timing-setup');`);
  assert.equal(await run(`return document.querySelector('[data-setting=id]').disabled;`),true);
  await assert.rejects(run(`await api.setSettings({timingHw:'none'});`),/race/i);await assert.rejects(run(`await api.pluginsStop('${pack.manifest.id}');`),/race/i);await assert.rejects(run(`await api.pluginsSettings('${pack.manifest.id}',{});`),/race/i);
  await cross();assert.equal(await run('return live.engine().cars[0].laps.length;'),2,'parked race receives correct source only');
  await input('call',true);await input('call',false);assert.equal(await run('return live.engine().flag;'),'yellow');
  await run(`await api.pluginTimingSimulate({kind:'disconnect'});`);await until(`return live.phase==='paused'&&!pt.link.connected;`);assert.equal(await run('return live.engine().flag;'),'red');await run('live.actions.red();');assert.equal(await run('return live.phase;'),'paused');
  await run('await ptConnect();');await until('return live.plugin.ready();');assert.equal(await run('return live.phase;'),'paused');assert.equal(await run('return pt.link.power;'),false);await input('lap',false);await cross();assert.equal(await run('return live.engine().cars[0].laps.length;'),2);
  await run('live.actions.red();');await until(`return live.phase==='running';`);await wait(80);await cross();assert.equal(await run('return live.engine().cars[0].laps.length;'),3);assert(await run('return live.engine().cars[0].invalid.length>0;'),'interrupted lap invalid');
  await run(`window.qaResume={...state.race,resume:{eng:live.engine().snapshot(performance.now()),race:{timingPlugin:TimingPlugin.provenance(pt.identity)}}};ck(!!live.pitSensors,'Service Stop sensor subscription');live.leave();live.alive=false;state.race=null;`);await until(`return !(await api.pluginTimingList()).race;`);
  await run(`state.race=qaResume;state.tab='race';await render();`);await until('return live.plugin.ready();');assert.equal(await run('return live.phase;'),'paused');assert.equal(await run('return pt.link.power;'),false);await run('live.actions.pause();');await wait(100);assert.equal(await run('return live.phase;'),'running');
  await run(`live.leave();live.alive=false;state.race=null;`);await until(`return !(await api.pluginTimingList()).race;`);await run('await ptClose();');
  const themes=['dark','light','midnight','forest','sunset','violet','carbon','ocean'];
  for(const theme of themes){
   win.setContentSize(1440,1050);await run(`state.settings.theme='${theme}';applyTheme();state.tab='settings';state.settingsSub='hardware';state.hwSub='plugin';await render();`);await until(`return !!document.querySelector('.plugin-timing-setup');`);await run(`document.querySelector('[data-section=sensors]').open=true;window.scrollTo(0,0);`);await shot(theme);
   win.setContentSize(600,1000);await wait(100);assert(await run(`return document.documentElement.scrollWidth<=innerWidth+2;`),'600px page fits: '+theme);await shot(theme+'-600');
  }
  assert.deepEqual(await run('return qaErrors;'),[]);
  fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({passed:true,themes,widths:[1440,600],checks:['Normal install and explicit trust','UI saves driver selection and lane assignments','Real Electron utility process','Mapped lap inputs through race engine','Track-call yellow flag','Other source ignored','Parked race continues','Main-process settings and lifecycle locks','Disconnect red flag','Explicit same-driver reconnect','Manual restart only','Interrupted lap invalid','Race checkpoint restore with provenance','Race reservation cleanup','No renderer errors']},null,2));
  console.log('PLUGIN TIMING ELECTRON PASSED: real UI, IPC, utility process, race integration, recovery, eight themes and 600px.');app.quit();
 }catch(e){console.error(e);console.error(await run(`return {backend:pt.backend,errors:qaErrors,notice:document.querySelector('[data-message]')?.textContent,phase:typeof live!=='undefined'&&live?.phase};`));await shot('failure');app.exit(1);}
}));require('../../main');
