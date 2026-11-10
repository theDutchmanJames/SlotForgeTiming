'use strict';
const {app,dialog}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../../../outputs/shared-car-library');fs.mkdirSync(out,{recursive:true});
const isolated=fs.mkdtempSync(path.join(out,'profile-'));app.setPath('appData',isolated);app.disableHardwareAcceleration();process.env.LOCALAPPDATA=path.join(isolated,'local-app-data');process.env.SF_UI_QA_LOCAL_LIBRARY='1';
require('./qa-completion.cjs').preventRelaunch(app);require('./file-diagnostics.cjs')(path.join(isolated,'diagnostics.log'),()=>app.exit(1));dialog.showErrorBox=(t,m)=>{console.error(t,m);app.exit(1);};
const source=process.env.SLOTFORGE_PADDOCK_SOURCE||path.resolve(__dirname,'../../../../SlotForge Slotcar Database'),{Store}=require(path.join(source,'src/store.cjs')),{LocalLibrary}=require(path.join(source,'src/local-library.cjs'));
const pprofile=path.join(isolated,'paddock');fs.mkdirSync(pprofile);const store=new Store(path.join(pprofile,'database.json'));store.persist(store.data);
const car=store.mutate('car.save',{data:{name:'Club GT3',maker:'NSR',marque:'Aston Martin',raceClass:'GT3'}}).result;
const host=new LocalLibrary({store,profile:pprofile,folder:require('../../paddock-local-discovery').directory()});
const wait=ms=>new Promise(r=>setTimeout(r,ms));let done=false;const timer=setTimeout(()=>app.exit(2),130000);
app.on('browser-window-created',(_,win)=>{win.show=()=>{};win.hide();win.webContents.on('console-message',(_e,level,message)=>{if(level>=2)console.error(message);});win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()').catch(e=>{console.error('Failed script',code);throw e;});
 const until=async condition=>{for(let i=0;i<250;i++){if(await run('return '+condition))return;await wait(40);}throw Error('Timeout '+condition+'; '+await run('return [...document.querySelectorAll("[data-status],[data-error]")].map(x=>x.textContent).join(" / ")'));};
 const shot=async name=>{await wait(150);fs.writeFileSync(path.join(out,name+'.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());};
 try{
  await until('!!state.schema.slotcars');win.setMinimumSize(0,0);win.setContentSize(1200,960);win.setOpacity(0);win.showInactive();
  assert.equal(await run('return (await api.storageStatus()).backend'),'sqlite');assert.equal(await run('return (await api.paddockStatus()).connection.mode'),'local');
  await run(`window.qaErrors=[];addEventListener('error',e=>qaErrors.push(e.message));addEventListener('unhandledrejection',e=>qaErrors.push(String(e.reason)));window.confirm=()=>true;window.alert=x=>qaErrors.push(x);window.qaLocal=await api.add('slotcars',{brand:'Scalextric',model:'Keep local',lapsDriven:77});state.tab='database';state.sub='slotcars';await render();`);
  await until('document.querySelectorAll("[data-shared-edit]").length===1');await until('[...document.querySelectorAll("[data-local-car]")].filter(x=>x.dataset.localCar).length===1');await shot('shared-slotcars');
  await until('!(await api.paddockStatus()).busy');await run('document.querySelector("[data-shared-edit]").click()');await until('!!document.querySelector("[data-field=name]")');
  const themes=await run("return Theme.THEMES.filter(x=>x[0]!=='custom').map(x=>x[0])");
  for(const theme of themes){await run(`state.settings.theme=${JSON.stringify(theme)};applyTheme();await document.fonts.ready;`);await shot('editor-'+theme);}
  for(const width of [600,360]){win.setContentSize(width,900);await wait(100);assert(await run('const d=document.querySelector(".shared-car-dialog");return d.scrollWidth<=d.clientWidth+1'),'editor fit '+width);await shot('editor-'+width);}
  win.setContentSize(1200,960);await run(`const x=document.querySelector('[data-field=name]');x.value='Edited in Timing';x.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('.shared-car-dialog form').requestSubmit();`);await until('!document.querySelector(".shared-car-dialog")');
  assert.equal(store.data.cars.find(c=>c.id===car).name,'Edited in Timing');assert.equal(store.data.submissions.length,0);
  await until('!document.querySelector("[data-shared-add]").disabled');await run('document.querySelector("[data-shared-add]").click()');await until('!!document.querySelector("[data-field=name]")');await run(`document.querySelector('[data-field=name]').value='New shared car';document.querySelector('.shared-car-dialog form').requestSubmit();`);await until('!document.querySelector(".shared-car-dialog")');assert.equal(store.data.cars.length,2);
  await run(`const track=await api.add('tracks',{name:'Test circuit',lanes:2,length:20});const setup=await api.add('racesetups',{name:'Shared race',sessionType:'race',track:track.id,laps:10});state.settings=await api.setSettings({lastSetupId:setup.id});state.tab='home';await render();`);assert(await run(`return [...document.querySelectorAll('select[data-k="carId"] option')].some(x=>x.value==='shared:${car}')`),'normal race dropdown shows uncached shared cars');
  await run(`const s=document.querySelector('select[data-k="carId"]');s.value='shared:${car}';s.dispatchEvent(new Event('change',{bubbles:true}));`);await until(`(await api.paddockStatus()).linked.some(x=>x.databaseId===${JSON.stringify(store.data.id)})`);await until('!document.querySelector("select[data-k=carId]")?.disabled');
  assert(!await run('return JSON.stringify(await api.getSettings()).includes("shared:")'),'placeholder never persisted');await shot('home-shared-selection');
  assert.equal(await run('return (await api.getRecord("slotcars",qaLocal.id)).lapsDriven'),77);
  await run(`state.tab='database';state.sub='slotcars';await render();`);await until('document.querySelectorAll("[data-shared-edit]").length===2');await run(`document.querySelector('[data-shared-edit="${car}"]').click()`);await until('!!document.querySelector("[data-archive]")');await run('document.querySelector("[data-archive]").click()');await until('!document.querySelector(".shared-car-dialog")');assert.equal(store.data.cars.find(c=>c.id===car).archived,true);
  await run('document.querySelector("[data-shared-saves]").click()');await until('!!document.querySelector("[data-open]")');await shot('shared-saves');
  assert.deepEqual(await run('return qaErrors'),[]);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,themes,isolated,checks:['automatic local pairing','SQLite journal','normal Slotcars combines local and shared cars','direct edit/create without Review','all themes','360/600/1200px editor fit','normal Home selector caches shared car before saving','local mileage retained','archive and receipts available']},null,2));
  host.quiesce();await host.idle();host.close();require('./qa-completion.cjs').complete();clearTimeout(timer);app.quit();
 }catch(e){console.error(e);host.close();clearTimeout(timer);app.exit(1);}
});});
host.start().then(()=>{assert.equal(host.error,'');require('../../main');}).catch(e=>{console.error(e);app.exit(1);});
