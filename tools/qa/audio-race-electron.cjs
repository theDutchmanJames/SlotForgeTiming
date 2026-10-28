// Exercise real renderer → IPC → database finalisation, with a silent playback backend.
const {app,ipcMain}=require('electron'),path=require('path'),assert=require('assert/strict');
app.setPath('appData',path.resolve(__dirname,'../../.tmp-test/audio-race-'+process.pid));app.disableHardwareAcceleration();let done=false;
const wait=ms=>new Promise(r=>setTimeout(r,ms));setTimeout(()=>app.exit(1),45000).unref();
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
 try{
  await wait(600);
  await run(`Sound.state.backend={stop(){},speak(t,o,done){done()},file(u,o,done){done()}};window.audioEvents=[];const original=Sound.say;Sound.say=(...args)=>{audioEvents.push(args[1]);return original(...args)};
   const d=Sound.defaultSet('Race audio QA');Object.values(d.calls).forEach(c=>c.on=false);d.calls.resultsfinal.on=true;d.calls.finalwinner.on=true;
   window.qaSet=await api.add('audiosets',d);window.qaTrack=await api.add('tracks',{name:'Audio QA',lanes:2});window.qaDrivers=[await api.add('drivers',{name:'Alex'}),await api.add('drivers',{name:'Sam'})];window.qaCars=[await api.add('slotcars',{brand:'NSR',model:'Mosler'}),await api.add('slotcars',{brand:'NSR',model:'Corvette'})];
   window.startAudioRace=async name=>{if(live){live.leave();live.alive=false;}state.speed=30;state.settings.timingHw='none';state.race={setup:{name,sessionType:'race',laps:10,endRule:'all',firstLap:'count',lightsMin:0,lightsMax:0,audioSet:qaSet.id,layout:''},track:qaTrack,rows:qaDrivers.map((d,i)=>({driverId:d.id,carId:qaCars[i].id}))};state.tab='race';await render();live.actions.start();};await startAudioRace('Successful save');`);
  const finish=async()=>{
   for(let i=0;i<100&&!await run(`return live.phase==='running'`);i++)await wait(30);
   assert(await run(`return live.phase==='running'`));
   await run(`const e=live.engine(),t=performance.now();e.cross(0,t+1000);e.cross(1,t+1200);e.cross(0,t+2200);e.cross(1,t+2400);live.actions.stop(true);`);
   for(let i=0;i<100&&!await run(`return live.phase==='review'`);i++)await wait(30);
   assert(await run(`return live.phase==='review'`));
   assert.equal(await run(`return audioEvents.filter(x=>x==='resultsfinal').length`),0);
   await run(`live.actions.finalize();`);
  };
  await finish();
  for(let i=0;i<100&&!await run(`return audioEvents.includes('resultsfinal')`);i++)await wait(30);
  assert(await run(`const s=(await api.list('sessions')).find(s=>s.setupName==='Successful save');return !!s&&s.audioSetId===qaSet.id&&audioEvents.filter(x=>x==='resultsfinal').length===1&&audioEvents.filter(x=>x==='finalwinner').length===1&&Sound.state.log.includes('The confirmed winner is Alex.');`),'successful save announcements');
  ipcMain.removeHandler('session:save');ipcMain.handle('session:save',()=>{throw Error('QA save failure');});
  await run(`audioEvents.length=0;await startAudioRace('Failed save');`);await finish();await wait(200);
  assert(await run(`return !audioEvents.includes('resultsfinal')&&!audioEvents.includes('finalwinner')&&document.getElementById('msg').textContent.includes('Could not save');`),'failed save must stay unconfirmed');
  console.log('AUDIO RACE PASS: real save emits confirmed calls once; simulated IPC save failure emits neither.');app.exit(0);
 }catch(e){console.error(e);app.exit(1);}
});});require('../../main');
