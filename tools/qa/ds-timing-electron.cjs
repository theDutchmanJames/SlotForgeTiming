'use strict';
const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../../../outputs/ds-timing/ui');fs.mkdirSync(out,{recursive:true});
const isolated=fs.mkdtempSync(path.join(out,'profile-'));app.setPath('appData',isolated);process.env.LOCALAPPDATA=path.join(isolated,'local');app.disableHardwareAcceleration();
require('./qa-completion.cjs').preventRelaunch(app);require('./file-diagnostics.cjs')(path.join(out,'diagnostics.log'),()=>app.exit(1));
const profile=path.join(isolated,'slotforge-timing');fs.mkdirSync(profile);
const db=new(require('../../db'))(path.join(profile,'slotforge-timing.json'));db.saveNow();fs.writeFileSync(path.join(profile,'storage-conversion-prompt.json'),JSON.stringify({version:1,choice:'keep'}));
const engine=require('../../vendor/slotforge-library/index.cjs'),open=engine.open;engine.open=options=>open({...options,sharedRoot:path.join(isolated,'shared'),legacyProfiles:[profile]});
let done=false;const timer=setTimeout(()=>app.exit(2),100000),wait=ms=>new Promise(r=>setTimeout(r,ms));
const trace=s=>fs.appendFileSync(path.join(out,'steps.log'),s+'\n');
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.setBackgroundThrottling(false);win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
 const until=async expr=>{for(let n=0;n<200;n++){if(await run('return '+expr))return;await wait(50);}throw Error('Timed out: '+expr);};
 try{
  await until("typeof state!=='undefined'&&state.schema.slotcars");await wait(400);trace('loaded');
  await run(`window.dsErrors=[];addEventListener('error',e=>dsErrors.push(e.message));addEventListener('unhandledrejection',e=>dsErrors.push(String(e.reason)));state.tab='settings';state.settingsSub='hardware';state.hwSub='ds';state.settings.dsType='ds200';await render();`);
  assert(await run(`return [...document.querySelector('#hw-use').options].some(x=>x.value==='ds');`));
  await run(`await setTimingHw('ds');state.settings=await api.setSettings({dsType:'ds200'});renderHardwareArea(document.querySelector('#settingsbox'));`);
  for(const theme of ['dark','light','midnight','forest','sunset','violet','carbon','ocean','custom']) {
   win.setMinimumSize(0,0);win.setContentSize(1400,1000);
   await run(`state.settings.theme='${theme}';applyTheme();document.querySelectorAll('[data-interface-section]').forEach(s=>s.open=['connection','racing'].includes(s.dataset.interfaceSection));scrollTo(0,0);`);await wait(60);
   assert(await run('return document.documentElement.scrollWidth<=innerWidth+1'));fs.writeFileSync(path.join(out,'setup-'+theme+'.png'),(await win.webContents.capturePage()).toPNG());
  }
  win.setContentSize(600,900);await wait(100);assert(await run('return document.documentElement.scrollWidth<=innerWidth+1'));fs.writeFileSync(path.join(out,'setup-600.png'),(await win.webContents.capturePage()).toPNG());trace('themes verified');
  win.setContentSize(1400,1000);
  await run(`window.sendDs=(lane,n,marker=false,code=null)=>{const b=new Uint8Array(21);b[0]=224;b[1]=n%256;b[2]=21;b[7]=code===null?27:0;b[8]=code||0;b[10]=dscType()==='ds200'?lane:128>>(lane-1);b[12]=n;b[20]=235;if(marker)b.set([0,170,171,170,170],13);else b.set([0,0,0,81,35],13);b[18]=DsProtocol.checksum(b);dsController.enqueue(b);};`);
  for(const model of ['ds200','ds300']) {
   trace(model+' setup');
   await run(`state.settings=await api.setSettings({dsType:'${model}'});state.tab='settings';state.settingsSub='hardware';state.hwSub='ds';await render();window.dsWritten=0;dsc.dev={open:async()=>{},setSignals:async()=>{},getSignals:async()=>({}),close:async()=>{},readable:new ReadableStream({start(c){window.dsController=c;}}),get writable(){dsWritten++;throw Error('No DS protocol writes');}};await document.querySelector('#ds-conn').onclick();`);
   assert(await run(`return DsTiming.link.connected&&document.querySelector('.tm-headerstate').textContent.includes('Connected for timing');`));
   await run(`state.settings.theme='dark';applyTheme();state.speed=30;state.race={setup:{name:'DS replay check',sessionType:'practice',firstLap:'count',lightsMin:0,lightsMax:0,minLap:0.01,layout:''},track:{id:'ds-fixture',name:'Disposable DS test track',lanes:2},rows:[{},{}]};state.tab='race';await render();live.actions.start();`);
   await until("live.phase==='running'");trace(model+' running');
   await run('sendDs(1,1,true);sendDs(2,1,true);');await wait(600);await run('sendDs(1,2);sendDs(2,2);');await wait(80);
   assert.deepEqual(await run('return live.engine().cars.map(c=>c.laps);'),[[512.3],[512.3]]);
   assert(await run("return document.querySelector('#tmstatus').textContent.includes('DS Electronics connected')"));
   await run('sendDs(1,2);');await wait(40);assert.equal(await run('return live.engine().cars[0].laps.length'),1);
   fs.writeFileSync(path.join(out,'race-'+model+'.png'),(await win.webContents.capturePage()).toPNG());
   await run('sendDs(1,3,false,165);');await until("live.phase==='paused'");await run('sendDs(1,3,false,166);');await wait(40);assert.equal(await run('return live.phase'),'paused');
   await run('live.actions.pause();');await until("live.phase==='running'");await run('await dscClose();');await until("live.phase==='paused'");
   assert.equal(await run('return dsWritten'),0);
   await run(`live.leave();clearInterval(live.timers);live.alive=false;live.phase='finished';state.race=null;state.tab='settings';state.settingsSub='hardware';state.hwSub='ds';await render();`);trace(model+' complete');
   // Exercise the actual Time Token controls and their DS lane filtering.
   await run("dsc.dev.readable=new ReadableStream({start(c){window.dsController=c;}});await document.querySelector('#ds-conn').onclick();state.race={setup:{id:'ds-token-'+dscType(),name:'DS token check',sessionType:'tokens',layout:'',minLap:0.01},track:{id:'ds-token-fixture',name:'Disposable token test',lanes:2},rows:[{},{}]};state.tab='race';await render();live.actions.start();");
   await until("live.phase==='running'");await run('sendDs(1,1);sendDs(1,1,true);');await wait(40);
   assert.equal(await run('return live.phase'),'running');assert.equal(await run('return live.engine().cars[0].laps.length'),0);
   await run('live.tokenOps.add(0,5);sendDs(1,3,true);');await wait(600);await run('sendDs(1,4);');await wait(40);
   assert.deepEqual(await run('return live.engine().cars[0].laps'),[512.3]);
   await run('live.tokenOps.end(0);live.tokenOps.clear(0);live.tokenOps.add(0,5);sendDs(1,7,true);');await wait(600);await run('sendDs(1,8);');await wait(40);
   assert.equal(await run('return live.phase'),'running');assert.deepEqual(await run('return live.engine().cars[0].laps'),[512.3]);
   await run("await dscClose();await live.flushTokens();live.leave();clearInterval(live.timers);live.alive=false;live.phase='finished';state.race=null;state.tab='settings';state.settingsSub='hardware';state.hwSub='ds';await render();");trace(model+' token stints verified');

  }
  await run("state.settings.dsType='ds030';renderDsSettings(document.querySelector('#hwbox'));");assert(await run("return document.querySelector('#hwbox').textContent.includes('Capture only')"));
  assert.deepEqual(await run('return dsErrors'),[]);trace('PASS');
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed:true,models:['ds200','ds300'],checks:['9 themes','600px layout','real renderer serial input','measured duration','duplicate suppression','unpaid token lanes ignored','fresh token stints reset counters','pause without automatic resume','disconnect pauses','no protocol writes','other models capture-only','no renderer errors']},null,2));
  clearTimeout(timer);require('./qa-completion.cjs').complete();app.exit(0);
 }catch(e){fs.writeFileSync(path.join(out,'failure.txt'),e.stack);fs.writeFileSync(path.join(out,'failure.png'),(await win.webContents.capturePage()).toPNG());clearTimeout(timer);app.exit(1);}
});});require('../../main');
