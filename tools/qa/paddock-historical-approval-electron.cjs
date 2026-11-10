'use strict';
const {app,dialog}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../../../outputs/historical-approval');fs.mkdirSync(out,{recursive:true});
const isolated=fs.mkdtempSync(path.join(out,'profile-'));app.setPath('appData',isolated);app.disableHardwareAcceleration();process.env.LOCALAPPDATA=path.join(isolated,'local-app-data');process.env.SF_UI_QA_LOCAL_LIBRARY='1';
require('./qa-completion.cjs').preventRelaunch(app);require('./file-diagnostics.cjs')(path.join(isolated,'diagnostics.log'),()=>app.exit(1));dialog.showErrorBox=(t,m)=>{console.error(t,m);app.exit(1);};
const source=process.env.SLOTFORGE_PADDOCK_SOURCE||path.resolve(__dirname,'../../../../SlotForge Slotcar Database');
// Isolated test-only owner worker. Never edits Paddock's shipped gate.
require(path.join(source,'tests/support/historical-approval-preload.cjs'));
const threads=require('node:worker_threads'),Worker=threads.Worker;
threads.Worker=class extends Worker{constructor(file,options){super(path.resolve(String(file))===path.join(source,'src/domain-worker.cjs')?path.join(source,'tests/support/historical-approval-worker.cjs'):file,options);}};
const {Store}=require(path.join(source,'src/store.cjs')),{LocalLibrary}=require(path.join(source,'src/local-library.cjs'));
const pprofile=path.join(isolated,'paddock');fs.mkdirSync(pprofile);const store=new Store(path.join(pprofile,'database.json'));store.persist(store.data);
const fixture=require(path.join(source,'tests/support/timing-fixtures.cjs')).fixtures(),T=require(path.join(source,'src/timing-integration.cjs'));store.replace(fixture.store.snapshot());
const host=new LocalLibrary({store,profile:pprofile,folder:require('../../paddock-local-discovery').directory()});
const wait=ms=>new Promise(r=>setTimeout(r,ms));let done=false;const timer=setTimeout(()=>app.exit(2),210000);
app.on('browser-window-created',(_,win)=>{win.show=()=>{};win.hide();win.webContents.on('console-message',(_e,level,message)=>{if(level>=2)console.error(message);});win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()').catch(e=>{console.error('Failed script',code);throw e;});
 const until=async (condition,attempts=250)=>{for(let i=0;i<attempts;i++){if(await run('return '+condition))return;await wait(40);}throw Error('Timeout '+condition+'; '+await run('return [...document.querySelectorAll("[data-status],[data-error]")].map(x=>x.textContent).join(" / ")'));};
 const shot=async name=>{await wait(150);fs.writeFileSync(path.join(out,name+'.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());};

 try{
  await until('!!state.schema.slotcars');win.setMinimumSize(0,0);win.setContentSize(1200,960);win.setOpacity(0);win.showInactive();
  assert.equal(await run('return (await api.storageStatus()).backend'),'sqlite');await until('!(await api.paddockStatus()).busy');
  await run(`window.qaErrors=[];addEventListener('error',e=>qaErrors.push(e.message));addEventListener('unhandledrejection',e=>qaErrors.push(String(e.reason)));window.qaOld=await api.saveSession({setupName:'Historic club sprint',sessionType:'race',date:'2020-04-12',trackId:'track-old',trackName:'Original club circuit',standings:[{carId:'car-old',driverId:'driver-old',driverName:'James',carName:'Club GT3',pos:1,laps:1,total:8500,best:8500}]},Array.from({length:1800},(_,i)=>({carId:'car-old',driverId:'driver-old',driverName:'James',trackId:'track-old',lane:1,heat:1,lapNumber:i+1,time:8500,valid:true,pit:false})));state.tab='database';state.sub='results';state.resultsSub='racing';await render();`);
  await until('!!document.querySelector("details.sess")');await run('document.querySelector("[data-history-open]").click()');await until('!!document.querySelector("[data-historical-session]")');
  await run('document.querySelector("[data-historical-session]").click()');await until('!!document.querySelector("[data-historical-submit], [data-historical-retry]")');
  if(await run('return !!document.querySelector("[data-historical-retry]")')){await until('!(await api.paddockStatus()).busy');await run('document.querySelector("[data-historical-retry]").click()');await until('!!document.querySelector("[data-historical-submit]")');}
  assert(await run('return document.querySelector(".historical-dialog").textContent.includes("Saved overall/class results")'));

  assert(await run('return document.querySelector(".historical-dialog").textContent.includes("Received is not accepted")'));
  const themes=await run("return Theme.THEMES.filter(x=>x[0]!=='custom').map(x=>x[0])");
  for(const theme of themes){await run(`state.settings.theme=${JSON.stringify(theme)};applyTheme();await document.fonts.ready;`);await shot('preview-'+theme);}
  for(const width of [600,360]){win.setContentSize(width,900);await wait(100);assert(await run('const d=document.querySelector(".historical-dialog");return d.scrollWidth<=d.clientWidth+1'),'preview fit '+width);await shot('preview-'+width);}
  win.setContentSize(1200,960);await run('document.querySelector("[data-historical-submit]").click()');await until('document.querySelector(".historical-dialog")?.textContent.includes("Pending review — not accepted")');await shot('received');assert.equal(store.data.timing.sessions.length,0);assert.equal(store.data.timing.imports.length,1);assert.equal(store.data.timing.imports[0].item.bundle.race.participants[0].laps.length,1800);
  await run('document.querySelector("[data-historical-close]").click();document.querySelector("[data-historical-review] details").open=true;document.querySelector("[data-historical-review]").scrollIntoView({block:"start"})');
  await until('!!document.querySelector("[data-review-cancel]")');
  for(const width of [1200,600,360]){win.setContentSize(width,900);await wait(100);assert(await run('const d=document.querySelector("[data-historical-review]");return d.scrollWidth<=d.clientWidth+1'),'status fit '+width);await shot('status-'+width);}
  const item=store.data.timing.imports[0];
  await require(path.join(source,'src/domain-tasks.cjs')).run(store,{kind:'history-import',action:'review',input:{action:'approve',databaseId:item.batch.databaseId,recoveryId:item.batch.recoveryId,id:item.id,requestHash:item.requestHash,note:'Synthetic UI qualification'}});
  await run('document.querySelector("[data-review-refresh]").click()');await until('document.querySelector("[data-historical-review]")?.textContent.includes("original acceptance confirmed")');
  assert.equal(store.data.timing.imports[0].status,'approved');assert.equal(store.data.timing.sessions.length,1);
  assert(await run('return !document.querySelector("[data-review-cancel]")'));
  win.setContentSize(1200,960);
  for(const theme of themes){await run(`state.settings.theme=${JSON.stringify(theme)};applyTheme();await document.fonts.ready;document.querySelector('[data-historical-review]').scrollIntoView({block:'start'});`);await shot('approved-'+theme);}
  for(const width of [600,360]){win.setContentSize(width,900);await wait(100);assert(await run('const d=document.querySelector("[data-historical-review]");return d.scrollWidth<=d.clientWidth+1'),'approved fit '+width);await shot('approved-'+width);}
  assert.equal(await run('return (await api.historyPage("racing",{})).sessions.items.length'),1);assert.deepEqual(await run('return qaErrors'),[]);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,themes,isolated,checks:['actual normal Results page entry','preview and explicit submission','eight themes','360/600/1200px fit','real host receives 1800 laps through chunked upload, pending only','real test-only owner worker approval and status button','approved receipt distinguished from current history','local result unchanged','no renderer errors']},null,2));
  host.quiesce();await host.idle();host.close();require('./qa-completion.cjs').complete();clearTimeout(timer);app.quit();
 }catch(e){console.error(e);host.close();clearTimeout(timer);app.exit(1);}
});});
host.start().then(()=>{assert.equal(host.error,'');require('../../main');}).catch(e=>{console.error(e);app.exit(1);});
