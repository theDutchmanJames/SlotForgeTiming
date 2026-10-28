const {app}=require('electron'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const output=path.resolve(__dirname,'../../../outputs/virtual-rival-lanes');fs.mkdirSync(output,{recursive:true});app.setPath('appData',path.resolve(__dirname,'../../.tmp-test/virtual-lanes-'+process.pid));app.disableHardwareAcceleration();
let done=false,step=0;const wait=ms=>new Promise(r=>setTimeout(r,ms));setTimeout(()=>{console.error('QA timeout at step '+step);app.exit(1);},150000).unref();
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.on('did-finish-load',async()=>{if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;const run=code=>{if(!code.startsWith('return live.phase'))console.log('STEP '+(++step)+' '+code.slice(0,100));return win.webContents.executeJavaScript('(async()=>{'+code+'})()');};
try{await wait(700);win.setMinimumSize(0,0);win.setContentSize(1200,1050);win.showInactive();
await run(`window.qaErrors=[];window.confirm=message=>{throw Error('Unexpected confirmation: '+message);};addEventListener('error',e=>qaErrors.push(e.message));window.qaChange=(s,v,event='change')=>{const e=document.querySelector(s);if(!e)throw Error(s);e.value=v;e.dispatchEvent(new Event(event,{bubbles:true}));};
window.qaTrack=await api.add('tracks',{name:'Slotrace Circuit',lanes:2,length:20,minLap:.8});window.qaDriver=await api.add('drivers',{name:'James'});window.qaOther=await api.add('drivers',{name:'Bjornie'});window.qaCar=await api.add('slotcars',{brand:'NSR',model:'Mosler MT900R'});window.qaCar2=await api.add('slotcars',{brand:'NSR',model:'Corvette C.08R'});
window.qaSource=await api.saveSession({trackId:qaTrack.id,trackName:qaTrack.name,setupName:'Club-night recording',sessionType:'race',date:new Date().toISOString(),standings:[{driverId:qaDriver.id,driverName:'James',carName:'NSR Mosler MT900R',laps:30,best:8200,total:260000,pos:1}]},Array.from({length:30},(_,i)=>({driverId:qaDriver.id,carId:qaCar.id,trackId:qaTrack.id,lane:1,lapNumber:i+1,time:i===13?21000:8200+(i%5)*90,...(i===13?{pit:true}:{}),...(i===21?{invalid:true}:{} )})));
state.tab='setup';state.setupSub='virtualrivals';await render();document.querySelector('[data-rival-new]').click();`);await wait(150);
await run(`qaChange('#vr-source',qaSource);qaChange('#vr-person',qaDriver.id);qaChange('[data-vr=name]','Club-night replay','input');qaChange('[data-vr=end]','repeat','input');document.querySelector('[data-vr-mode=competitor]').click();document.querySelector('#vr-form').requestSubmit();`);await wait(250);
assert.equal(await run('return (await api.list("virtualrivalsystems")).length;'),1,'save profile');
await run(`window.qaProfile=(await api.list('virtualrivalsystems'))[0];if(VirtualRival.sequence(qaProfile).length!==28)throw Error('source eligibility');rivalEditor=null;await render();document.querySelector('[data-rival-edit]').click();`);await wait(200);
assert.equal(await run('return document.querySelector("#vr-chart").querySelectorAll("path").length;'),2);
for(const width of [1200,600]){win.setContentSize(width,1050);await run('window.scrollTo(0,0);');await wait(250);assert(await run('return document.documentElement.scrollWidth<=innerWidth+1;'),'editor overflow '+width);fs.writeFileSync(path.join(output,'setup-'+width+'.png'),(await win.webContents.capturePage()).toPNG());await run(`document.querySelector('[data-fg=sequence]').scrollIntoView({block:'start'});`);await wait(100);fs.writeFileSync(path.join(output,'sequence-'+width+'.png'),(await win.webContents.capturePage()).toPNG());}
win.setContentSize(1200,1050);
await run(`state.settings.theme='light';applyTheme();document.querySelector('[data-fg=playback]').open=true;document.querySelector('[data-fg=playback]').scrollIntoView({block:'start'});qaChange('[data-vr=speed]',110,'input');`);await wait(150);fs.writeFileSync(path.join(output,'playback-light.png'),(await win.webContents.capturePage()).toPNG());
await run(`qaChange('[data-vr=speed]',100,'input');rivalEditor.dirty=false;state.settings.theme='dark';applyTheme();window.scrollTo(0,0);`);
await run(`state.tab='database';state.sub='drivers';await render();openForm('drivers',null);qaChange('#f-name','James — Virtual Rival','input');qaChange('#f-driverType','virtual');qaChange('#f-virtualRivalSystem',qaProfile.id);document.querySelector('#frm').requestSubmit();`);await wait(250);
await run(`window.qaVirtual=(await api.list('drivers')).find(d=>d.driverType==='virtual');if(!qaVirtual||qaVirtual.virtualRivalSystem!==qaProfile.id)throw Error('driver link not saved');openForm('drivers',qaVirtual);`);await wait(100);fs.writeFileSync(path.join(output,'driver.png'),(await win.webContents.capturePage()).toPNG());
await run(`dlg.close();rivalEditor=null;window.qaSetup=await api.add('racesetups',{name:'Virtual Rival QA',track:qaTrack.id,sessionType:'race',laps:2,endRule:'all',firstLap:'count',lightsMin:0,lightsMax:0});state.settings=await api.setSettings({lastSetupId:qaSetup.id,assignments:{[qaSetup.id]:[{driverId:qaDriver.id,carId:qaCar.id},{driverId:qaOther.id,carId:qaCar2.id}]},virtualRivals:{[qaSetup.id]:[qaVirtual.id]},timingHw:'none'});state.tab='home';await render();`);await wait(150);
// Select a virtual driver in the actual second lane control.
await run(`qaChange('[data-row="1"] [data-k="driverId"]',qaVirtual.id);`);await wait(250);
assert(await run(`return document.querySelectorAll('.hs-lanes [data-row]').length===2&&document.querySelector('[data-row="1"] [data-k="rivalProfileId"]')&&!document.querySelector('[data-row="1"] [data-k="carId"]')&&!document.querySelector('#start').disabled&&!document.querySelector('[data-vr-entry]');`),'one human plus one virtual fills two normal lanes');
for(const width of [1200,600]){win.setContentSize(width,900);await wait(200);assert(await run('return document.documentElement.scrollWidth<=innerWidth+1;'),'Home overflow '+width);fs.writeFileSync(path.join(output,'home-'+width+'.png'),(await win.webContents.capturePage()).toPNG());}
win.setContentSize(1200,900);
await run(`window.qaOverride=await api.add('virtualrivalsystems',{...qaProfile,id:undefined,name:'Alternate replay',speed:110});qaChange('[data-row="1"] [data-k="driverId"]',qaOther.id);`);await wait(200);
assert(await run(`return !!document.querySelector('[data-row="1"] [data-k="carId"]')&&document.querySelector('#start').disabled;`),'switching back to human restores car choice and requires a car');
await run(`qaChange('[data-row="1"] [data-k="carId"]',qaCar2.id);`);await wait(150);
assert(await run(`return !document.querySelector('#start').disabled;`),'two humans remain valid');
await run(`qaChange('[data-row="1"] [data-k="driverId"]',qaVirtual.id);`);await wait(150);
await run(`qaChange('[data-row="1"] [data-k="rivalProfileId"]',qaOverride.id);`);await wait(150);
await run(`await renderHome();`);await wait(150);
assert(await run(`return document.querySelector('[data-row="1"] [data-k="rivalProfileId"]').value===qaOverride.id&&(await api.list('drivers')).find(d=>d.id===qaVirtual.id).virtualRivalSystem===qaProfile.id;`),'override persists without changing driver default');
await run(`qaChange('[data-row="1"] [data-k="rivalProfileId"]','');`);await wait(150);
await run(`document.querySelector('#start').click();`);await wait(250);
assert(await run(`return live.engine().cars.length===1&&live.engine().cars[0].lane===0&&live.engine().rivals[0].lane===1;`),'actual Home Start creates one physical and one assigned replay');
await run(`live.actions.start();`);
for(let i=0;i<500&&!await run('return live.phase==="running";');i++)await wait(40);
assert(await run('return live.phase==="running";'),'countdown completed');
await run(`const e=live.engine();e.t0=performance.now()-9000;e.cars[0].last=e.t0;`);await wait(150);
assert(await run(`return live.nodes.some(n=>n.w.lane===1&&n.w.type==='name'&&n.val.textContent.includes('Virtual'))&&live.engine().rivals[0].laps.length===1;`),'normal lane widgets render the rival');
assert(await run(`return live.lapBtns.find(x=>x.lane===1).b.hidden&&live.pitBtns.find(x=>x.lane===1).b.hidden&&live.callBtns.find(x=>x.lane===1).b.hidden;`),'physical controls are absent from virtual lane');
await run(`const e=live.engine();window.qaBeforeHuman=e.cars[0].laps.length;document.dispatchEvent(new KeyboardEvent('keydown',{key:'2',code:'Digit2',bubbles:true}));live.actions.penalty(1);live.actions.pitRelease(1);`);await wait(100);
assert(await run(`return live.engine().cars[0].laps.length===qaBeforeHuman&&live.engine().cars[0].points===0&&live.engine().rivals[0].points===0;`),'virtual lane input cannot alter either car');
await run(`document.querySelector('#canvas').scrollIntoView({block:'start'});`);await wait(150);fs.writeFileSync(path.join(output,'live-lanes.png'),(await win.webContents.capturePage()).toPNG());

await run(`const e=live.engine(),t=performance.now();e.t0=t-20000;e.cars.forEach(c=>c.last=e.t0);e.cross(0,t-10000);e.cross(0,t-10);live.actions.stop(true);`);await wait(200);
assert.equal(await run('return live.engine().cars.length;'),1,'physical entries only');assert.equal(await run('return live.engine().rivals[0].laps.length;'),2);
await run(`window.qaWall=document.createElement('div');qaWall.style.cssText='position:fixed;inset:0;z-index:999;background:var(--bg);overflow:auto';document.body.appendChild(qaWall);await LiveView.mount(qaWall,{second:true});`);await wait(250);
assert(await run(`return qaWall.textContent.includes('Virtual')&&qaWall.textContent.includes('James');`),'second display includes rival');fs.writeFileSync(path.join(output,'results.png'),(await win.webContents.capturePage()).toPNG());
await run(`LiveView.unmount();qaWall.remove();live.actions.finalize();`);await wait(250);
assert(await run(`const sessions=await api.list('sessions'),laps=await api.list('laps');const s=sessions.find(s=>s.setupName==='Virtual Rival QA');return !!s?.virtualRivals?.length&&!laps.some(l=>l.driverId===qaVirtual.id);`),'saved separately from physical records');
assert(await run(`const s=(await api.list('sessions')).find(s=>s.setupName==='Virtual Rival QA');return VirtualRival.savedStandings(s)[0].virtualRival&&VirtualRival.savedStandings(s)[1].driverId===qaDriver.id;`),'saved classification matches live results');
// Run two real heats: replay starts fresh, while heat points stay physical.
await run(`window.qaHeatSetup={...qaSetup,name:'Virtual Rival heat QA',sessionType:'heats',heatBy:'laps',laps:1,resultBy:'points',points:'10,8',breakTime:0};state.race={setup:qaHeatSetup,track:qaTrack,rows:[{driverId:qaDriver.id,carId:qaCar.id},{driverId:qaVirtual.id}],schedule:[[{p:0,lane:0},{p:1,lane:1}],[{p:1,lane:0},{p:0,lane:1}]],virtualRivals:VirtualRival.gridEntries([{driverId:qaVirtual.id}],await api.list('drivers'),await api.list('virtualrivalsystems'),qaTrack.id).entries};state.tab='race';await render();`);
for(let heat=0;heat<2;heat++){
 assert.equal(await run('return live.engine().rivals[0].laps.length;'),0,'new heat resets replay');assert.equal(await run('return live.engine().rivals[0].lane;'),1-heat,'heat rotation moves virtual lane');assert.equal(await run('return live.engine().cars.length;'),1);await run('live.actions.start();');
 for(let i=0;i<500&&!await run('return live.phase==="running";');i++)await wait(40);
 assert(await run('return live.phase==="running";'),'heat starts');
 await run(`const e=live.engine(),t=performance.now();e.t0=t-21000;e.cars.forEach(c=>c.last=e.t0);e.cross(0,t-1000);`);await wait(250);
 assert.equal(await run('return live.phase;'),'review');await run('live.actions.finalize();');await wait(250);
 if(heat===0){
   assert(await run(`const snap=await api.getResume();return snap?.phase==='between'&&!snap.eng&&snap.race.virtualRivals.length===1;`),'between-heat checkpoint retains frozen replay');
   await run(`live.leave();clearInterval(live.breakTimer);live.alive=false;live.phase='finished';state.race=null;state.tab='home';await render();document.querySelector('#resumego').click();`);await wait(350);
   assert(await run(`return live.phase==='between'&&live.engine().rivals.length===1&&live.rivalHeats.length===1;`),'Home resumes a waiting heat with replay and its history');
 }
}
assert(await run(`const s=(await api.list('sessions')).find(s=>s.setupName==='Virtual Rival heat QA');return s.virtualRivals.length===2&&s.virtualRivals.every(h=>h.rivals[0].laps===1)&&!s.standings.some(r=>r.driverId===qaVirtual.id)&&!s.heatResults.some(h=>h.rows.some(r=>r.driverId===qaVirtual.id));`),'heats preserve replay history and physical scoring');
// A rival may deliberately trigger the finish before any physical lap exists.
await run(`const entries=VirtualRival.entries([qaVirtual.id],await api.list('drivers'),await api.list('virtualrivalsystems'),qaTrack.id).entries;entries[0].profile.canFinish=true;state.race={setup:{...qaSetup,name:'Virtual-only finish QA',laps:1,endRule:'leader'},track:qaTrack,rows:[{driverId:qaDriver.id,carId:qaCar.id}],virtualRivals:entries};await render();live.actions.start();`);
for(let i=0;i<500&&!await run('return live.phase==="running";');i++)await wait(40);
await run(`const e=live.engine();e.t0=performance.now()-9000;`);await wait(250);assert.equal(await run('return live.phase;'),'review');await run('live.actions.finalize();');await wait(250);
assert(await run(`const s=(await api.list('sessions')).find(s=>s.setupName==='Virtual-only finish QA');return !!s&&s.standings.length===0&&s.virtualRivals[0].laps===1;`),'virtual-only finish persists without inventing a human result');
assert.deepEqual(await run('return qaErrors;'),[]);console.log('VIRTUAL LANE ELECTRON PASS: source copy, save/reopen, chart, 1200/600 layouts, driver linking, Home, real race, second-screen results and physical-record isolation');app.exit(0);
}catch(e){console.error(e);app.exit(1);}});});require('../../main');
