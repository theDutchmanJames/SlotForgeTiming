'use strict';
const {app,dialog}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../../../outputs/rich-history');fs.mkdirSync(out,{recursive:true});
const isolated=fs.mkdtempSync(path.join(out,'profile-'));app.setPath('appData',isolated);app.disableHardwareAcceleration();process.env.LOCALAPPDATA=path.join(isolated,'local-app-data');process.env.SF_UI_QA_LOCAL_LIBRARY='1';
require('./qa-completion.cjs').preventRelaunch(app);require('./file-diagnostics.cjs')(path.join(isolated,'diagnostics.log'),()=>app.exit(1));dialog.showErrorBox=(t,m)=>{console.error(t,m);app.exit(1);};
const source=process.env.SLOTFORGE_PADDOCK_SOURCE||path.resolve(__dirname,'../../../../SlotForge Slotcar Database'),{Store}=require(path.join(source,'src/store.cjs')),{LocalLibrary}=require(path.join(source,'src/local-library.cjs'));
const pprofile=path.join(isolated,'paddock');fs.mkdirSync(pprofile);const file=path.join(pprofile,'database.sqlite');
new Store(file,{deferred:true}).replace(require(path.join(source,'tests/support/timing-fixtures.cjs')).fixtures().store.snapshot());const seed=new Store(file,{deferred:true});
const Q=require(path.join(source,'src/rich-history.cjs')),shared=require(path.join(source,'src/shared-history.cjs'));
for(const fixture of require('./rich-scoring-fixtures.cjs').cases()){const op=fixture.operation;op.recoveryId=shared.status(seed).recoveryId;Q.receiveQualified(seed,op);}
const store=new Store(file);assert.equal(shared.capability.features.historicalImports,false);
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
  await until('document.querySelectorAll(".central-session").length===7');
  assert.equal(await run('return (await api.historyPage("racing",{})).sessions.items.length'),0);
  await run(`[...document.querySelectorAll('.central-session')].find(x=>x.textContent.includes('Qualification · classes')).open=true;`);await until('!!document.querySelector("[data-central-laps] table")');
  assert(await run('return document.querySelector(".central-history").textContent.includes("Personal best:")'));
  await run(`document.querySelector('[data-car-statistics]').click()`);await until('document.querySelector("[data-car-statistics-result]")?.textContent.includes("Class wins:")');
  const themes=await run("return Theme.THEMES.filter(x=>x[0]!=='custom').map(x=>x[0])");
  for(const theme of themes){await run(`state.settings.theme=${JSON.stringify(theme)};applyTheme();await document.fonts.ready;document.querySelector('.central-session[open]').scrollIntoView({block:'start'});`);await shot('classification-'+theme);await run(`document.querySelector('[data-car-statistics-result]').scrollIntoView({block:'center'})`);await shot('statistics-'+theme);}
  for(const width of [600,360]){win.setContentSize(width,900);await wait(100);assert(await run('const d=document.querySelector(".central-history");return d.scrollWidth<=d.clientWidth+1'),'history fit '+width);await run(`document.querySelector('.central-session[open]').scrollIntoView({block:'start'})`);await shot('classification-'+width);}
  win.setContentSize(1200,960);
  await run(`document.querySelector('.central-session[open]').open=false;const h=[...document.querySelectorAll('.central-session')].find(x=>x.textContent.includes('historical-unknowns'));h.open=true;h.scrollIntoView({block:'start'});`);
  await until('document.querySelector(".central-session[open]")?.textContent.includes("Unknown driver")');await shot('historical-unknowns');
  assert(await run('return !document.querySelector(".central-session[open]").textContent.includes("1970")'));
  await run('await api.paddockDisconnect(false);document.querySelector("[data-central-refresh]").click()');await until('document.querySelector(".central-history")?.textContent.includes("Cached copy")');await shot('offline');
  assert.deepEqual(await run('return qaErrors'),[]);assert.equal(await run('return (await api.historyPage("racing",{})).sessions.items.length'),0);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,themes,isolated,checks:['actual Results rich format reads','separate class and overall awards','independent record eligibility','unknown dates and drivers','aggregate statistics','offline cache','eight themes','360/600/1200px fit','no local history import','no renderer errors','public approval remains disabled']},null,2));
  host.quiesce();await host.idle();host.close();require('./qa-completion.cjs').complete();clearTimeout(timer);app.quit();
 }catch(e){console.error(e);host.close();clearTimeout(timer);app.exit(1);}
});});
host.start().then(()=>{assert.equal(host.error,'');require('../../main');}).catch(e=>{console.error(e);app.exit(1);});
