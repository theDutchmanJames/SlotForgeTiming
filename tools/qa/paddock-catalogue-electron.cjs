// Real Timing UI with an isolated Paddock host; never touches either user's database.
const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
if(!process.env.PADDOCK_SOURCE)throw Error('Set PADDOCK_SOURCE.');
const {Network}=require(path.join(process.env.PADDOCK_SOURCE,'src/network.cjs')),{Store,migrate}=require(path.join(process.env.PADDOCK_SOURCE,'src/store.cjs'));
const store=new Store();store.data=migrate(JSON.parse(fs.readFileSync(path.join(__dirname,'../../tests/fixtures/paddock/fixtures/demo-database.json'))));
const host=new Network(store),hosting=host.start().then(()=>host.controls({allowTimingResults:true}));
const out=path.resolve(__dirname,'../../../outputs/paddock-catalogue');fs.mkdirSync(out,{recursive:true});
const profile=path.resolve(__dirname,'../../.tmp-test/catalogue-electron-'+process.pid);fs.mkdirSync(profile,{recursive:true});app.setPath('appData',profile);app.disableHardwareAcceleration();
const wait=ms=>new Promise(r=>setTimeout(r,ms));let done=false;setTimeout(()=>app.exit(2),150000).unref();
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.on('did-finish-load',async()=>{
  if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
  const run=async code=>{const result=await win.webContents.executeJavaScript('(async()=>{try{'+code+'}catch(e){return {qaFailure:e.stack||e.message};}})()');if(result?.qaFailure)throw Error(result.qaFailure);return result;};
  const until=async code=>{for(let i=0;i<150;i++){if(await run(code))return;await wait(60);}throw Error('Timed out: '+code);};
  const shot=async name=>{await wait(200);fs.writeFileSync(path.join(out,name+'.png'),(await win.webContents.capturePage()).toPNG());};
  try{
    await hosting;win.setMinimumSize(0,0);win.setContentSize(1280,960);await wait(500);
    await run(`window.qaErrors=[];window.ck=(x,m)=>{if(!x)throw Error(m);};window.alert=m=>qaErrors.push(m);addEventListener('error',e=>qaErrors.push(e.message));addEventListener('unhandledrejection',e=>qaErrors.push(String(e.reason)));await api.add('slotcars',{model:'Timing local car'});await api.paddockConnect({address:'127.0.0.1:${host.port}',code:'${host.timingCode}'});state.tab='database';state.sub='slotcars';await render();ck(document.getElementById('subview').textContent.includes('Timing local car'),'Local cars visible');document.getElementById('paddock-view').click();`);
    await until(`return document.querySelector('[data-paddock-browser] [data-use="car-a"]')&&!document.querySelector('[data-refresh]').disabled;`);
    await run(`ck(!document.querySelector('[data-cars]').textContent.includes('Timing local car'),'Remote and local views separated');ck(!(await api.list('slotcars')).some(c=>c.paddock),'Browsing does not create cars');`);
    for(const theme of ['dark','light','midnight','forest','sunset','violet','carbon','ocean']){await run(`state.settings.theme='${theme}';applyTheme();ck(document.documentElement.scrollWidth<=innerWidth+2,'Page fits');`);await shot('catalogue-'+theme);}
    win.setContentSize(600,900);await shot('catalogue-600');await run(`ck(document.querySelector('.paddock-browser').scrollWidth<=document.querySelector('.paddock-browser').clientWidth+2,'600px catalogue fits');document.querySelector('[data-use="car-a"]').click();`);
    await until(`return document.querySelector('#dlg').open;`);
    await run(`ck((await api.list('slotcars')).filter(c=>c.paddock).length===1,'View caches one stable link');dlg.close();`);
    // Returning to Local never exposes the linked cache as a local car.
    await run(`document.querySelector('[data-source="local"]').click();`);await until(`return !!document.getElementById('paddock-view');`);
    await run(`ck(!document.getElementById('subview').querySelector('.paddock-source'),'Linked cars excluded from Local view');window.qaTrack=await api.add('tracks',{name:'Test track',lanes:2,length:20});window.qaD=await api.add('drivers',{name:'James'});window.qaRace=await api.add('racesetups',{name:'Test practice',track:qaTrack.id,sessionType:'practice'});state.settings=await api.setSettings({lastSetupId:qaRace.id,assignments:{[qaRace.id]:[{driverId:qaD.id,carId:''},{driverId:qaD.id,carId:''}]}});state.tab='home';await render();`);
    win.setContentSize(1280,960);await run(`ck(document.querySelector('[data-paddock-pick="0"]'),'Home car picker');document.querySelector('[data-paddock-pick="0"]').click();`);
    await until(`return !!document.querySelector('dialog[open] [data-use="car-b"]');`);await shot('race-picker');
    await run(`document.querySelector('dialog[open] [data-use="car-b"]').click();`);
    await until(`return !document.querySelector('.paddock-dialog[open]');`);
    await until(`return !!document.querySelector('[data-row="0"] [data-k="carId"]')?.value;`);
    await run(`window.qaSelected=(await api.list('slotcars')).find(c=>c.id===document.querySelector('[data-row="0"] [data-k="carId"]').value);ck(qaSelected.paddock.carId==='car-b','Direct remote selection assigns correct cached car');`);await shot('home-selected');
    const remote=store.data.cars.find(c=>c.id==='car-b');store.mutate('car.save',{id:remote.id,revision:remote.revision,data:{name:'Renamed club car'}});
    await run(`await api.paddockCatalogue(true);ck((await api.list('slotcars')).filter(c=>c.paddock?.carId==='car-b').length===1,'Rename does not duplicate');ck((await api.list('slotcars')).find(c=>c.id===qaSelected.id).paddock.name==='Renamed club car','Rename refreshes display name');await api.paddockDisconnect();document.querySelector('[data-paddock-pick="0"]').click();`);
    await until(`return document.querySelector('dialog[open] [data-summary]')?.textContent.includes('Offline');`);await shot('offline-catalogue');
    await run(`ck(!document.querySelector('dialog[open] [data-use="car-b"]').disabled,'Captured car remains selectable offline');document.querySelector('dialog[open] [data-close]').click();ck(qaErrors.length===0,qaErrors.join('; '));`);
    store.mutate('car.save',{id:remote.id,revision:store.data.cars.find(c=>c.id===remote.id).revision,data:{raceClass:'Prototype'}});
    await run(`await api.paddockConnect({address:'127.0.0.1:${host.port}',code:'${host.timingCode}'});await api.paddockCatalogue(true);window.qaClasses=await api.list('raceclasses');window.qaMC=await api.add('multiclasssystems',{name:'Class test',assignment:'roster',classes:qaClasses,driverClasses:[{driverId:qaD.id,classId:qaClasses.find(c=>c.name==='GT3').id}]});await api.update('racesetups',qaRace.id,{multiClass:qaMC.id});await render();document.querySelector('[data-paddock-pick="0"]').click();`);
    await until(`return !!document.querySelector('dialog[open] [data-use="car-a"]');`);
    await run(`ck(!document.querySelector('dialog[open] [data-use="car-b"]'),'Mismatched remote class is filtered');document.querySelector('dialog[open] [data-use="car-a"]').click();`);
    await until(`return !document.querySelector('.paddock-dialog[open]');`);
    await run(`ck((await api.list('slotcars')).find(c=>c.id===document.querySelector('[data-row="0"] [data-k="carId"]').value).paddock.carId==='car-a','Matching class selects normally');ck(qaErrors.length===0,qaErrors.join('; '));`);
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed:true,themes:8,widths:[1280,600],checks:['Local/Paddock isolation','Direct race car selection','Stable cache identity','Rename refresh','Offline selection','Multi-Class filters after remote reclassification','No renderer errors']},null,2));
    console.log('PADDOCK CATALOGUE ELECTRON PASS');await host.stop();app.quit();
  }catch(e){console.error(e);await shot('failure');await host.stop();app.exit(1);}
});});require('../../main');
