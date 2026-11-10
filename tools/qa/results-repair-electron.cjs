'use strict';
const {app,dialog,ipcMain}=require('electron'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const backend=process.env.SF_RESULTS_BACKEND||'json',out=path.resolve(__dirname,'../../../outputs/results-repair',backend);fs.mkdirSync(out,{recursive:true});
const isolated=fs.mkdtempSync(path.join(os.tmpdir(),'sf-results-repair-'));app.setPath('appData',isolated);app.disableHardwareAcceleration();process.env.LOCALAPPDATA=path.join(isolated,'local');
const sharedRoot=path.join(isolated,'shared'),engine=require('../../vendor/slotforge-library/index.cjs'),open=engine.open;engine.open=o=>open({...o,sharedRoot});
require('./qa-completion.cjs').preventRelaunch(app);require('./file-diagnostics.cjs')(path.join(isolated,'diagnostics.log'),()=>app.exit(1));dialog.showErrorBox=(t,m)=>{console.error(t,m);app.exit(1);};
const profile=path.join(isolated,'slotforge-timing');fs.mkdirSync(profile);
const db=new(require('../../db'))(path.join(profile,'slotforge-timing.json'));db.data.paddock={sourceId:'results-native',connection:null,withdrawals:[]};
db.data.slotcars=[{id:'car-a',brand:'NSR',model:'Corvette C.08R',scale:'1:32'},{id:'car-b',brand:'AvantSlot',model:'Aston Martin Vantage V12',scale:'1:32'}];
db.data.drivers=[{id:'driver-a',name:'Bjorn'},{id:'driver-b',name:'James'}];db.data.tracks=[{id:'track',name:'Slotrace Circuit',lanes:2,length:25,laneModifier:'none'}];
db.data.sessions=Array.from({length:15},(_,i)=>({id:'race-'+i,sessionType:i===0?'tokens':'race',setupName:i===0?'Token session':"James’ Slotrace GP "+i,trackId:'track',trackName:'Slotrace Circuit',date:new Date(Date.UTC(2026,10,i+1,1,42,49)).toISOString(),...(i===0?{token:{lane:1,bought:60000}}:{}),standings:[{pos:1,carId:'car-a',driverId:'driver-a',driverName:'Bjorn',carName:'NSR Corvette C.08R',laps:130,best:6600,total:870000},{pos:2,carId:'car-b',driverId:'driver-b',driverName:'James',carName:'AvantSlot Aston Martin Vantage V12',laps:130,best:6800,total:900000,penalty:2000,penaltyPoints:2,adjMs:1000}]}));
db.data.laps=db.data.sessions.flatMap(s=>s.standings.flatMap((row,j)=>Array.from({length:130},(_,i)=>({id:s.id+'-'+j+'-'+i,sessionId:s.id,carId:row.carId,driverId:row.driverId,trackId:'track',date:s.date,lane:j+1,lapNumber:i+1,time:row.best+i,token:s.sessionType==='tokens',...(i===3?{invalid:true,noTrackRecord:true,noPersonalBest:true}:{})}))));db.saveNow();
const original=fs.readFileSync(db.file);
if(backend==='sqlite'){const generation=require('node:crypto').randomUUID(),copy=path.join(profile,'sqlite',generation);fs.mkdirSync(path.dirname(copy),{recursive:true});require('../../sqlite-migration').migrateCopy({source:db.file,destination:copy});require('../../sqlite-working').forkCopy(copy,path.join(copy,'working'));fs.writeFileSync(path.join(profile,'storage-backend.json'),JSON.stringify({format:'slotforge-storage-selection',version:1,backend:'sqlite',generation}));}
fs.writeFileSync(path.join(profile,'storage-conversion-prompt.json'),JSON.stringify({version:1,choice:'keep'}));
const wait=ms=>new Promise(r=>setTimeout(r,ms));let done=false,peer,pdf='';const timeout=setTimeout(()=>app.exit(2),110000);
app.on('browser-window-created',(_,win)=>{win.show=()=>{};win.hide();win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
 const until=async condition=>{for(let i=0;i<160;i++){if(await run('return '+condition))return;await wait(50);}throw Error('Timeout: '+condition+' / '+await run('return document.body.innerText.slice(-2500)'));};
 const shot=async name=>{await wait(100);fs.writeFileSync(path.join(out,name+'.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());};
 try{
  await until('!!state.schema.slotcars');win.setContentSize(1400,950);win.setOpacity(0);win.showInactive();
  assert.equal(await run('return (await api.storageStatus()).backend'),backend);assert.equal(await run('return (await api.libraryStatus()).available'),true);
  ipcMain.removeHandler('pdf:export');ipcMain.handle('pdf:export',(_e,html)=>{pdf=html;return {saved:false};});
  await run("window.qaErrors=[];addEventListener('error',e=>qaErrors.push(e.message));addEventListener('unhandledrejection',e=>qaErrors.push(String(e.reason)));state.tab='database';state.sub='results';state.resultsSub='racing';await render();");
  await until('document.querySelectorAll("[data-history-open]").length===12');
  assert(!await run('return !!document.querySelector(".central-history,.original-history,[data-historical-review]")'));
  assert(!await run('return /Original session evidence|revision 2|Missing evidence/.test(document.body.innerText)'));
  await shot('overview');
  await run("document.querySelector('[data-history-open]').click()");await until('!!document.querySelector(".history-laps")');
  const detail=await run('return document.querySelector("details.sess[open]").innerText');
  assert(detail.includes('14:30.000')&&detail.includes('15:03.000'),detail);assert(!/Unknown heat|Unknown points|classification evidence/i.test(detail));
  assert(await run('return !!document.querySelector("details.sess[open] [data-delsession]")'));
  const themes=await run('return Theme.THEMES.map(x=>x[0])');
  for(const theme of themes){await run(`state.settings.theme=${JSON.stringify(theme)};applyTheme();document.querySelector('details.sess[open]').scrollIntoView({block:'start'});await document.fonts.ready;`);await shot('session-'+theme);}
  await run("document.querySelector('[data-laps-next]').click()");await until('document.querySelector(".history-laps")?.innerText.includes("101–200")');
  await run("document.querySelector('[data-pdf]').click()");await until('dlg.open');await run("for(const i of dlg.querySelectorAll('input[type=checkbox]'))i.checked=true;dlg.querySelector('#pdfgo').click()");for(let i=0;i<100&&!pdf;i++)await wait(40);
  assert(pdf.includes('130')&&pdf.includes('6.929')&&pdf.includes('15:03.000'),'Complete PDF and adjusted time');
  // PDF preferences can change the private snapshot; reload before testing page navigation.
  await run("await render()");await until('document.querySelectorAll("[data-history-open]").length===12');
  await run("document.querySelector('[data-history-next=sessions]').click()");await until('document.querySelector(".history-navigation")?.innerText.includes("Page 2")');
  assert.equal(await run('return document.querySelectorAll("details.sess").length'),2); // 14 racing sessions, 12 on the first page
  await run("state.resultsSub='tokens';await render()");await until('document.querySelectorAll("[data-history-open]").length===1');await run("document.querySelector('[data-history-open]').click()");await until('!!document.querySelector(".history-laps")');await shot('tokens');
  // A second Timing installation contributes a native session, no private copy here.
  peer=await engine.open({application:'SlotForge Paddock',installationId:'qa-peer',legacyProfiles:[]});const state=await peer.status();
  const raw=require('./rich-mapper-fixtures.cjs').evidence(),capture=await run("return api.paddockPrepare(['car-a'])");raw.session.paddockJournal.captures.local=capture.captures['car-a'];raw.session.setupName='Shared-only Timing race';
  const bundle=require('../../paddock-rich-mapper').measured(raw.session,raw.laps,state.databaseId).bundle;
  await peer.adoptSession({databaseId:state.databaseId,recoveryId:state.recoveryId,operationId:'qa-shared-only',sourceId:'other-timing',originalId:raw.session.id,sessionId:raw.session.id,rawOriginal:raw,bundle});
  const sid='shared:'+JSON.stringify(['other-timing',raw.session.id]);await run(`state.resultsSub='racing';state.focusSession=${JSON.stringify(sid)};await render()`);await until('document.querySelector("details.sess[open]")?.innerText.includes("Shared-only Timing race")');
  assert(await run('return document.querySelector("details.sess[open]").innerText.includes("21.000")'));assert(!await run('return !!document.querySelector("details.sess[open] [data-delsession]")'));await shot('shared-only');
  win.setMinimumSize(0,0);win.setContentSize(600,850);await run("state.settings.theme='dark';applyTheme();state.focusSession='race-14';await render()");await until('document.querySelector("details.sess[open]")?.innerText.includes("15:03.000")');await run("document.querySelector('details.sess[open]').scrollIntoView({block:'start'})");assert(await run('return document.documentElement.scrollWidth<=innerWidth'));await shot('narrow');
  assert.deepEqual(await run('return qaErrors'),[]);if(backend==='sqlite')assert.deepEqual(fs.readFileSync(db.file),original);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,backend,profile,sharedRoot,themes,checks:['original sections only','native totals and adjustments','points and heats applicable only','12 session and 100 lap pagination','complete PDF','shared-only session in normal view','source-safe controls','token view','all themes','600px fit','no runtime errors']},null,2));await peer.close();peer=null;require('./qa-completion.cjs').complete();clearTimeout(timeout);app.quit();
 }catch(e){console.error(e);await shot('failure');await peer?.close();clearTimeout(timeout);app.exit(1);}
});});require('../../main');
