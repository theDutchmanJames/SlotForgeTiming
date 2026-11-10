'use strict';
const {app,dialog}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../../../outputs/paddock-local-library');fs.mkdirSync(out,{recursive:true});
const isolated=fs.mkdtempSync(path.join(out,'profile-'));app.setPath('appData',isolated);app.disableHardwareAcceleration();process.env.LOCALAPPDATA=path.join(isolated,'local-app-data');
require('./qa-completion.cjs').preventRelaunch(app);require('./file-diagnostics.cjs')(path.join(isolated,'diagnostics.log'),()=>app.exit(1));
dialog.showErrorBox=(t,m)=>{console.error(t,m);app.exit(1);};
const source=process.env.SLOTFORGE_PADDOCK_SOURCE||path.resolve(__dirname,'../../../../SlotForge Slotcar Database');
const {Store}=require(path.join(source,'src/store.cjs')),{LocalLibrary}=require(path.join(source,'src/local-library.cjs'));
const pprofile=path.join(isolated,'paddock');fs.mkdirSync(pprofile);const store=new Store(path.join(pprofile,'database.json'));store.data.settings.name='Club Library · Test';store.persist(store.data);
const host=new LocalLibrary({store,profile:pprofile,folder:require('../../paddock-local-discovery').directory()});
const wait=ms=>new Promise(r=>setTimeout(r,ms));let done=false;const timer=setTimeout(()=>app.exit(2),140000);
app.on('browser-window-created',(_,win)=>{win.show=()=>{};win.hide();win.webContents.on('console-message',(_e,level,message)=>{if(level>=2)console.error(message);});win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
 const until=async condition=>{for(let i=0;i<200;i++){if(await run('return '+condition))return;await wait(40);}throw Error('Timeout '+condition+'; '+await run('return document.querySelector("[data-error]")?.textContent'));};
 const shot=async name=>{await wait(120);fs.writeFileSync(path.join(out,name+'.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());};
 try{
  await until('!!state.schema.slotcars');win.setMinimumSize(0,0);win.setContentSize(1200,1000);win.setOpacity(0);win.showInactive();
  assert.equal(await run('return (await api.storageStatus()).backend'),'sqlite');
  await run(`window.qaErrors=[];addEventListener('error',e=>qaErrors.push(e.message));addEventListener('unhandledrejection',e=>qaErrors.push(String(e.reason)));window.confirm=()=>true;
   window.qaCar=await api.add('slotcars',{brand:'NSR',model:'Club GT3',lapsDriven:42,custom:{club:'Keep'}});
   state.tab='database';state.sub='slotcars';await render();await PaddockUI.open(api);`);
  await until('!!document.querySelector("[data-local-find]")');await run('document.querySelector("[data-local-find]").click()');await until('document.querySelector("[data-local-host]").options.length===2');
  await run('document.querySelector("[data-local-connect]").click()');await until('(await api.paddockStatus()).connected&&!document.querySelector("[data-local-connect]").disabled');
  assert(!await run(`return JSON.stringify(await api.paddockStatus()).includes(${JSON.stringify(host.token)})`));
  await run('const s=document.querySelector("[data-transfer-cars]");s.options[0].selected=true;s.dispatchEvent(new Event("change"));document.querySelector("[data-transfer-create]").click()');await until('document.querySelector("[data-transfer-list]").textContent.includes("Awaiting Paddock approval")');
  assert.equal(store.data.cars.length,0);const sub=store.data.submissions[0];
  const themes=await run("return Theme.THEMES.filter(x=>x[0]!=='custom').map(x=>x[0])");
  for(const theme of themes){
   await run(`state.settings.theme=${JSON.stringify(theme)};applyTheme();document.querySelector('#paddock-connection').scrollIntoView();await document.fonts.ready;`);await shot('connection-'+theme);
   await run("document.querySelector('#paddock-transfers').scrollIntoView()");await shot('transfers-'+theme);
  }
  for(const width of [600,360]){win.setContentSize(width,900);await wait(150);assert(await run('const d=document.querySelector(".paddock-dialog");return d.scrollWidth<=d.clientWidth+1'),'dialog width '+width);await run("document.querySelector('#paddock-transfers').scrollIntoView()");await shot('transfers-'+width);}
  win.setContentSize(1200,1000);
  await store.mutateAsync('submission.review',{id:sub.id,carId:sub.package.cars[0].id,decision:'accept',revision:0,fields:['name','maker','model'],note:''},{snapshot:false});
  await run('document.querySelector("[data-transfer-refresh]").click()');await until('document.querySelector("[data-transfer-list]").textContent.includes("Approved and linked")');
  assert.equal(await run('return (await api.paddockStatus()).linked[0].id'),await run('return qaCar.id'));await shot('approved-link');
  await run('document.querySelector("[data-browse]").click()');await until('document.querySelectorAll("[data-catalog] .paddock-car").length===1&&!document.querySelector("[data-browse]").disabled');
  await run('document.querySelector("[data-local-disconnect]").click()');await until('!(await api.paddockStatus()).connected');assert.equal(await run('return (await api.paddockStatus()).connection.automatic'),false);
  await until('!document.querySelector("[data-local-forget]").disabled');await run('document.querySelector("[data-local-forget]").click()');await until('!(await api.paddockStatus()).connection&&!document.querySelector("[data-local-forget]").disabled');
  assert.equal(await run('return document.querySelectorAll("[data-catalog] .paddock-car").length'),0,'forget must clear catalogue and link buttons');
  assert.equal(await run('return (await api.paddockTransfers())[0].state'),'linked','forget preserves completed transfer history');await shot('forgotten-library');
  await run('document.querySelector("[data-local-connect]").click()');await until('(await api.paddockStatus()).connected&&!document.querySelector("[data-local-connect]").disabled');
  assert.equal(await run('return document.querySelectorAll("[data-catalog] .paddock-car").length'),1,'new connection retains its freshly loaded catalogue');
  await run('document.querySelector("[data-mode=network]").click();document.querySelector("#paddock-connection").scrollIntoView()');await shot('network-option');
  assert.deepEqual(await run('return qaErrors'),[]);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,themes,checks:['actual protected Paddock host','SQLite Timing profile','local discovery and connect through UI','review approval and original Timing ID','no credential in renderer status','360/600/1200px fit','disconnect stops automatic connection','forget clears stale catalogue without removing linked history','reconnect displays freshly loaded catalogue','network mode retained'],isolated},null,2));
  host.quiesce();await host.idle();host.close();require('./qa-completion.cjs').complete();clearTimeout(timer);app.quit();
 }catch(e){console.error(e);host.close();clearTimeout(timer);app.exit(1);}
});});
host.start().then(()=>{assert.equal(host.error,'');require('../../main');}).catch(e=>{console.error(e);app.exit(1);});
