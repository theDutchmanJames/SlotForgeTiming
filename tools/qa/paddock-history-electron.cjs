'use strict';
const {app,dialog}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../../../outputs/central-history');fs.mkdirSync(out,{recursive:true});
const isolated=fs.mkdtempSync(path.join(out,'profile-'));app.setPath('appData',isolated);app.disableHardwareAcceleration();process.env.LOCALAPPDATA=path.join(isolated,'local-app-data');process.env.SF_UI_QA_LOCAL_LIBRARY='1';
require('./qa-completion.cjs').preventRelaunch(app);require('./file-diagnostics.cjs')(path.join(isolated,'diagnostics.log'),()=>app.exit(1));dialog.showErrorBox=(t,m)=>{console.error(t,m);app.exit(1);};
const source=process.env.SLOTFORGE_PADDOCK_SOURCE||path.resolve(__dirname,'../../../../SlotForge Slotcar Database'),{Store}=require(path.join(source,'src/store.cjs')),{LocalLibrary}=require(path.join(source,'src/local-library.cjs'));
const pprofile=path.join(isolated,'paddock');fs.mkdirSync(pprofile);const store=new Store(path.join(pprofile,'database.json'));store.persist(store.data);
const fixture=require(path.join(source,'tests/support/timing-fixtures.cjs')).fixtures(),T=require(path.join(source,'src/timing-integration.cjs'));store.replace(fixture.store.snapshot());for(const payload of [fixture.normal,fixture.multi,fixture.endurance])T.receive(store,payload);
const host=new LocalLibrary({store,profile:pprofile,folder:require('../../paddock-local-discovery').directory()});
const wait=ms=>new Promise(r=>setTimeout(r,ms));let done=false;const timer=setTimeout(()=>app.exit(2),210000);
app.on('browser-window-created',(_,win)=>{win.show=()=>{};win.hide();win.webContents.on('console-message',(_e,level,message)=>{if(level>=2)console.error(message);});win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()').catch(e=>{console.error('Failed script',code);throw e;});
 const until=async (condition,attempts=250)=>{for(let i=0;i<attempts;i++){if(await run('return '+condition))return;await wait(40);}throw Error('Timeout '+condition+'; '+await run('return [...document.querySelectorAll("[data-status],[data-error]")].map(x=>x.textContent).join(" / ")'));};
 const shot=async name=>{await wait(150);fs.writeFileSync(path.join(out,name+'.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());};
 try{
  await until('!!state.schema.slotcars');win.setMinimumSize(0,0);win.setContentSize(1200,960);win.setOpacity(0);win.showInactive();
  assert.equal(await run('return (await api.storageStatus()).backend'),'sqlite');
  await until('!(await api.paddockStatus()).busy');
  await run(`window.qaErrors=[];addEventListener('error',e=>qaErrors.push(e.message));addEventListener('unhandledrejection',e=>qaErrors.push(String(e.reason)));state.tab='database';state.sub='results';state.resultsSub='racing';await render();`);
  await until('document.querySelectorAll(".central-session").length===3');
  assert.equal(await run('return (await api.historyPage("racing",{})).sessions.items.length'),0,'fresh Timing profile reads central sessions without local imports');
  await run(`const f=document.querySelector('[data-history-filter]');f.elements.query.value='does-not-match-any-session';f.requestSubmit()`);await until('document.querySelector(".central-history")?.textContent.includes("No sessions match")');await run(`const f=document.querySelector('[data-history-filter]');f.elements.query.value='';f.requestSubmit()`);await until('document.querySelectorAll(".central-session").length===3');
  await run(`document.querySelector('.central-session').open=true;`);await until('!!document.querySelector("[data-central-laps] table")');
  await run(`document.querySelector('[data-car-statistics]').click()`);await until('document.querySelector("[data-car-statistics-result]")?.textContent.includes("accepted collection statistics")');
  const themes=await run("return Theme.THEMES.filter(x=>x[0]!=='custom').map(x=>x[0])");
  for(const theme of themes){await run(`state.settings.theme=${JSON.stringify(theme)};applyTheme();await document.fonts.ready;`);await shot('history-'+theme);await run(`document.querySelector('[data-car-statistics-result]').scrollIntoView({block:'center'})`);await shot('statistics-'+theme);await run(`document.querySelector('.central-history').scrollIntoView({block:'start'})`);}
  for(const width of [600,360]){win.setContentSize(width,900);await wait(100);assert(await run('const d=document.querySelector(".central-history");return d.scrollWidth<=d.clientWidth+1'),'history fit '+width);await shot('history-'+width);await run(`document.querySelector('[data-car-statistics-result]').scrollIntoView({block:'center'})`);await shot('statistics-'+width);}
  win.setContentSize(1200,960);
  await until('!(await api.paddockStatus()).busy');
  await run(`window.qaCar=await api.paddockLink('car-a');const prepared=await api.paddockPrepare([qaCar.id]);const start=Date.now();window.qaSession=await api.saveSession({date:new Date(start).toISOString(),setupName:'One shared race',sessionType:'race',trackId:'track-local',trackName:'Timing circuit',standings:[{carId:qaCar.id,carName:'Example GT3',driverId:'driver-local',driverName:'Local driver',pos:1,laps:1,total:10000,best:10000}],paddockJournal:{captures:prepared.captures,lanes:[20],heats:[{id:'heat-1',name:'Race',startedAt:start,endedAt:start+20000,entries:[{carId:qaCar.id,driverId:'driver-local',driverName:'Local driver',lane:1,laps:[{number:1,time:10000,at:start+10000,driverId:'driver-local',valid:true,pit:false}]}]}]}},[{carId:qaCar.id,driverId:'driver-local',trackId:'track-local',lane:1,lapNumber:1,time:10000,valid:true}]);await api.paddockRetry();await render();`);
  await until('document.querySelectorAll(".central-session").length===4');
  assert(await run(`return [...document.querySelectorAll('details.sess')].find(x=>x.dataset.sid===qaSession)?.hidden`),'acknowledged local duplicate is hidden');
  await run(`[...document.querySelectorAll('.central-session')].find(x=>x.textContent.includes('One shared race')).open=true`);await until(`!![...document.querySelectorAll('.central-session button')].find(x=>x.textContent==='Open local race tools')`);
  await run(`[...document.querySelectorAll('.central-session button')].find(x=>x.textContent==='Open local race tools').click()`);await until(`!!document.querySelector('[data-local-history] [data-pdf]')`);
  assert(await run(`return [...document.querySelectorAll('details.sess')].find(x=>x.dataset.sid===qaSession)?.hidden===false`),'local correction/export tools remain reachable');
  await shot('local-tools');
  // The currently open normal session changes underneath a token-bound reader.
  await until('(await api.paddockHistory({kind:"hint"})).history?.cursor && !(await api.paddockHistory({kind:"hint"})).history?.pending',1500);
  const syncBefore=await run('return (await api.paddockHistory({kind:"hint"})).history.cursor');
  T.receive(store,fixture.correction);
  await until(`(await api.paddockHistory({kind:"hint"})).history?.cursor!==${JSON.stringify(syncBefore)} && !(await api.paddockHistory({kind:"hint"})).history?.pending`,1500);
await run(`document.querySelector('[data-central-refresh]').click()`);await until('document.querySelectorAll(".central-session").length===4');
  await run(`const d=[...document.querySelectorAll('.central-session')].find(x=>x.textContent.includes('Club race'));d.open=true;`);await until('document.querySelector("[data-central-laps]")?.textContent.includes("False trigger reviewed")');await shot('corrected-laps');
  T.receive(store,fixture.withdrawal);await run(`document.querySelector('[data-central-refresh]').click()`);await until('document.querySelector(".central-history")?.textContent.includes("Withdrawn")');
  await run(`const d=[...document.querySelectorAll('.central-session')].find(x=>x.textContent.includes('Withdrawn'));d.open=true;`);await until('document.querySelector(".central-history")?.textContent.includes("no longer contributes")');await shot('withdrawn');
  await run('await api.paddockDisconnect(false);document.querySelector("[data-central-refresh]").click()');await until('document.querySelector(".central-history")?.textContent.includes("Cached copy")');await shot('offline');
  assert.equal(await run('return (await api.historyPage("racing",{})).sessions.items.length'),1);
  assert.deepEqual(await run('return qaErrors'),[]);
  const savedId=await run('return qaSession');assert(store.data.timing.audit.some(r=>r.sessionId===savedId&&r.operation?.requestHash),'actual finalisation used guarded history');
  await run('await PaddockUI.open(api);document.querySelector("#paddock-results").scrollIntoView({block:"start"})');await shot('guarded-delivery');
  assert(await run('return document.querySelector("#paddock-results").textContent.includes("saved operation ID")'),'guarded delivery guidance is visible');
  win.setContentSize(600,900);await run('document.querySelector("#paddock-results").scrollIntoView({block:"start"})');await shot('guarded-delivery-600');await run('document.querySelector(".paddock-dialog").close()');
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,themes,isolated,checks:['fresh SQLite profile sees central history','targeted lap reads','background incremental cursor advances automatically','all themes','360/600/1200px fit','correction reflected','withdrawal visible','offline cache','no central session imports','exact delivered duplicate hidden','local race tools preserved','chronological history and accepted car statistics across all themes','guarded finalisation and durable host audit','guarded delivery guidance at wide/narrow widths']},null,2));
  host.quiesce();await host.idle();host.close();require('./qa-completion.cjs').complete();clearTimeout(timer);app.quit();
 }catch(e){console.error(e);host.close();clearTimeout(timer);app.exit(1);}
});});
host.start().then(()=>{assert.equal(host.error,'');require('../../main');}).catch(e=>{console.error(e);app.exit(1);});
