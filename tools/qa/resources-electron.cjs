const {app}=require('electron'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const Store=require('../../resource-store'),realWrite=Store.prototype.write;let failNextWrite=false;
Store.prototype.write=function(next){if(failNextWrite){failNextWrite=false;return Promise.reject(Error('Simulated disk write failure'));}return realWrite.call(this,next);};
const output=path.resolve(__dirname,'../../../outputs/resources');fs.mkdirSync(output,{recursive:true});app.setPath('appData',path.resolve(__dirname,'../../.tmp-test/resources-'+process.pid));app.disableHardwareAcceleration();
let done=false,step=0;const wait=ms=>new Promise(r=>setTimeout(r,ms));setTimeout(()=>{console.error('QA timeout step '+step);app.exit(1);},180000).unref();
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.on('did-finish-load',async()=>{if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;const run=code=>{console.log('STEP '+(++step)+' '+code.slice(0,90));return win.webContents.executeJavaScript('(async()=>{'+code+'})()');},shot=async name=>{await wait(180);fs.writeFileSync(path.join(output,name+'.png'),(await win.webContents.capturePage()).toPNG());};
try{
 await wait(650);win.setMinimumSize(0,0);win.setContentSize(1200,1000);win.showInactive();
 await run(`window.qaErrors=[];window.confirm=()=>true;window.alert=message=>{throw Error('Unexpected alert: '+message);};addEventListener('error',e=>qaErrors.push(e.message));window.change=(s,v,type='input')=>{const el=document.querySelector(s);if(!el)throw Error('Missing '+s);if(el.type==='checkbox')el.checked=v;else el.value=v;el.dispatchEvent(new Event(type,{bubbles:true}));};state.settings=await api.setSettings({timingHw:'none'});state.tab='setup';state.setupSub='resources';await render();document.querySelector('#resource-new').click();`);await wait(200);
 await run(`change('[data-resource=name]','Club endurance supplies');change('[data-resource=owner]','car');change('[data-resource-tyre=M]',5);change('[data-resource=repairsOn]',true);change('[data-resource=componentsOn]',true);document.querySelector('#resource-form').requestSubmit();`);await wait(250);
 assert(await run(`window.profile=(await api.list('resourcesystems'))[0];return profile.name==='Club endurance supplies'&&profile.tyres.M===5&&profile.repairsOn&&profile.componentsOn;`),'editor saves the allocation');
 await shot('setup-1200');win.setContentSize(600,1000);await wait(150);await shot('setup-600');
 assert(await run('return document.documentElement.scrollWidth<=innerWidth+1;'),'600px setup does not overflow');
 await run(`document.querySelector('[data-rail=tyres]').click();`);await shot('tyres-600');
 win.setContentSize(1200,1000);await run(`document.querySelector('[data-rail=repairs]').click();`);await shot('repairs-1200');
 await run(`window.track=await api.add('tracks',{name:'Club Circuit',lanes:2,length:20,minLap:.8});window.drivers=await Promise.all(['James','Bjornie'].map(name=>api.add('drivers',{name})));window.cars=await Promise.all(['Mosler','Porsche'].map(model=>api.add('slotcars',{brand:'NSR',model,tyreCompound:'M'})));window.tw=await api.add('tyrewearsystems',{...TyreWear.defaults(),name:'Club tyres',changeSeconds:2,setsMode:'car',sets:{M:99}});window.setup=await api.add('racesetups',{name:'Resource QA',track:track.id,sessionType:'race',raceBy:'laps',laps:10,endRule:'all',firstLap:'count',lightsMin:0,lightsMax:0,resourceSystem:profile.id,tyreWear:tw.id});state.settings=await api.setSettings({lastSetupId:setup.id,assignments:{[setup.id]:drivers.map((d,i)=>({driverId:d.id,carId:cars[i].id}))}});state.tab='home';await render();document.querySelector('#start').click();`);await wait(400);
 assert(await run(`return live.engine().resources.profile.id===profile.id&&live.engine().resources.events.length===0;`),'Home uses chosen profile without spending before start');
 await run('live.actions.start();');for(let i=0;i<250&&!await run('return live.phase==="running";');i++)await wait(50);
 assert.equal(await run('return live.phase;'),'running');
 assert(await run(`return live.engine().resourceBalance(live.engine().cars[0])['tyre:M']===4;`),'starting set consumed once');
 await run(`const e=live.engine(),t=performance.now();e.t0=t-20000;e.cars.forEach(c=>c.last=e.t0);e.block(0,t-4000);e.tick(t);`);await wait(300);
 assert(await run(`const e=live.engine(),l=await api.resourceLedger();return e.cars[0].twStops===1&&e.resourceBalance(e.cars[0])['tyre:M']===3&&l.history.length===3&&l.checkpoint.race.resources.events.length===3;`),'completed pit service and recovery are committed together');
 await run(`document.querySelector('#fd-resources').open=true;document.querySelector('#resource-live').scrollIntoView({block:'center'});`);await shot('race-resources');
 await run(`document.querySelector('[data-stock-apply="0"]').closest('details').open=true;change('[data-stock-kind="0"]','tyre:M');change('[data-stock-amount="0"]',2);change('[data-stock-reason="0"]','Extra box supplied');document.querySelector('[data-stock-apply="0"]').click();`);await wait(250);
 assert(await run(`return live.engine().resourceBalance(live.engine().cars[0])['tyre:M']===5&&(await api.resourceLedger()).history.length===4;`),'director adjustment is saved with reason');
 assert(await run(`const got=await api.liveGet(),v=LiveShare.viewer();v.feedStatic(got.stat);v.feedDynamic(got.dyn,performance.now());const row=TyreWear.view(v.shared(performance.now()).eng,[0],performance.now()).rows[0];return row.sets.M===5&&row.setsStart.M===5&&row.setsMode==='car';`),'shared live display sees the effective stock and original resource allowance');
 failNextWrite=true;
 await run(`live.engine().resourceAdjust(0,'repair',1,'Test recovery of a supplied credit',performance.now());`);await wait(350);
 assert(await run(`return live.resourceFault&&live.phase==='paused'&&(await api.resourceLedger()).history.length===4;`),'a failed write pauses racing without partial ledger changes');
 await run(`document.querySelector('[data-stock-retry]').click();`);await wait(300);
 assert(await run(`return !live.resourceFault&&(await api.resourceLedger()).history.length===5;`),'retry commits the pending transaction exactly once');
 await run(`window.saved=await api.getResume();live.leave();clearInterval(live.timers);live.alive=false;live.phase='finished';state.race=null;state.tab='home';await render();document.querySelector('#resumego').click();`);await wait(350);
 assert(await run(`return live.phase==='paused'&&live.engine().resourceBalance(live.engine().cars[0])['tyre:M']===5&&(await api.resourceLedger()).history.length===5;`),'Home recovery does not charge completed services twice');
 await run('live.actions.stop(true);');await wait(120);await run('live.actions.finalize();');await wait(400);
 assert(await run(`window.result=(await api.list('sessions')).find(s=>s.setupName===setup.name);return result?.resources.events.length===5&&result.resourceRunId&&!(await api.getResume());`),'results include usage and close recovery');
 assert(await run(`const before=(await api.list('sessions')).length,id=await api.saveSession(result,[]);return id===result.id&&(await api.list('sessions')).length===before;`),'repeated final saving does not duplicate results');
 // A second event starts fresh; its allocations then carry through heats and recovery.
 await run(`window.heatSetup={...setup,name:'Resource heat QA',sessionType:'heats',heatBy:'laps',laps:1,resultBy:'laps',breakTime:0};state.race={setup:heatSetup,track,rows:drivers.map((d,i)=>({driverId:d.id,carId:cars[i].id})),schedule:[[{p:0,lane:0},{p:1,lane:1}],[{p:0,lane:1},{p:1,lane:0}]]};state.tab='race';await render();`);
 for(let h=0;h<2;h++){
  await run('live.actions.start();');for(let i=0;i<250&&!await run('return live.phase==="running";');i++)await wait(50);assert.equal(await run('return live.phase;'),'running');
  assert.equal(await run(`return live.engine().resourceBalance(live.engine().cars[0])['tyre:M'];`),4-h);
  await run(`const e=live.engine(),t=performance.now();e.t0=t-10000;e.cars.forEach(c=>c.last=e.t0);e.cars.forEach((c,i)=>e.cross(i,t-1000+i*100));`);await wait(200);assert.equal(await run('return live.phase;'),'review');await run('live.actions.finalize();');await wait(300);
  if(h===0){assert(await run(`return (await api.getResume())?.phase==='between';`),'between-heat recovery exists');await run(`live.leave();clearInterval(live.breakTimer);live.alive=false;live.phase='finished';state.race=null;state.tab='home';await render();document.querySelector('#resumego').click();`);await wait(350);assert.equal(await run('return live.phase;'),'between');}
 }
 assert(await run(`const s=(await api.list('sessions')).find(s=>s.setupName===heatSetup.name);return s?.resources.events.length===4&&s.heatResults.length===2;`),'heat event spends two sets per car across rotation');
 await run(`state.tab='setup';state.setupSub='resources';resourceEditor={id:profile.id,draft:Resources.clean(profile),dirty:false,rail:'balances'};await render();document.querySelector('[data-rail=balances]').click();`);await shot('history-1200');
 await run(`document.querySelectorAll('[data-theme]').forEach(e=>e.dataset.theme='light');document.querySelector('[data-rail=repairs]').click();`);await shot('repairs-light');
 win.setContentSize(600,1000);await wait(180);await shot('repairs-light-600');assert(await run('return document.documentElement.scrollWidth<=innerWidth+1;'),'light narrow setup has no overflow');
 assert.deepEqual(await run('return qaErrors;'),[]);console.log('RESOURCES ELECTRON PASS');app.exit(0);
}catch(e){console.error(e);console.error(await win.webContents.executeJavaScript('document.body.innerText.slice(-5000)'));await shot('failure');app.exit(1);}
});});require('../../main');
