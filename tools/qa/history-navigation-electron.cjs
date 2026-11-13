'use strict';
// Real renderer and storage, using only a disposable private/shared library.
const {app,dialog}=require('electron'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const backend=process.env.SF_HISTORY_NAV_BACKEND||'json',out=path.resolve(__dirname,'../../../outputs/history-navigation',backend);
fs.mkdirSync(out,{recursive:true});
const isolated=fs.mkdtempSync(path.join(os.tmpdir(),'sf-history-nav-'));app.setPath('appData',isolated);process.env.LOCALAPPDATA=path.join(isolated,'local');app.disableHardwareAcceleration();
const engine=require('../../vendor/slotforge-library/index.cjs'),open=engine.open;engine.open=o=>open({...o,sharedRoot:path.join(isolated,'shared'),legacyProfiles:[profile]});
require('./qa-completion.cjs').preventRelaunch(app);require('./file-diagnostics.cjs')(path.join(out,'diagnostics.log'),()=>app.exit(1));
dialog.showErrorBox=(title,message)=>{console.error(title,message);app.exit(1);};
const profile=path.join(isolated,'slotforge-timing');fs.mkdirSync(profile);
const db=new(require('../../db'))(path.join(profile,'slotforge-timing.json'));db.data.paddock={sourceId:'history-nav'};
db.data.slotcars=[{id:'car',brand:'NSR',model:'Corvette',scale:'1:32'}];db.data.drivers=[{id:'driver',name:'James'}];
db.data.tracks=Array.from({length:43},(_,i)=>({id:'track-'+i,name:'Club Circuit '+String(i+1).padStart(2,'0'),lanes:2,length:25}));
db.data.sessions=Array.from({length:44},(_,i)=>({id:'race-'+i,sessionType:i===43?'tokens':'race',setupName:i===43?'Practice token stint':'Club race '+(i+1),trackId:'track-'+i%43,trackName:db.data.tracks[i%43].name,date:new Date(Date.UTC(2026,10,1,12,i)).toISOString(),...(i===43?{token:{lane:1,bought:60000}}:{}),standings:[{pos:1,carId:'car',carName:'NSR Corvette',driverId:'driver',driverName:'James',laps:1,total:7000,best:7000}]}));
db.data.laps=db.data.sessions.map(s=>({id:s.id+'-lap',sessionId:s.id,carId:'car',driverId:'driver',trackId:s.trackId,date:s.date,lane:1,lapNumber:1,time:7000,token:s.sessionType==='tokens'}));db.saveNow();
const source=fs.readFileSync(db.file);
if(backend==='sqlite'){const generation=require('node:crypto').randomUUID(),copy=path.join(profile,'sqlite',generation);fs.mkdirSync(path.dirname(copy),{recursive:true});require('../../sqlite-migration').migrateCopy({source:db.file,destination:copy});require('../../sqlite-working').forkCopy(copy,path.join(copy,'working'));fs.writeFileSync(path.join(profile,'storage-backend.json'),JSON.stringify({format:'slotforge-storage-selection',version:1,backend:'sqlite',generation}));}
fs.writeFileSync(path.join(profile,'storage-conversion-prompt.json'),JSON.stringify({version:1,choice:'keep'}));
let done=false;const wait=ms=>new Promise(r=>setTimeout(r,ms)),timeout=setTimeout(()=>app.exit(2),110000);
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.setBackgroundThrottling(false);win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
 const until=async condition=>{for(let i=0;i<200;i++){if(await run('return '+condition))return;await wait(50);}throw Error('Timeout: '+condition);};
 const shot=async name=>{await wait(120);fs.writeFileSync(path.join(out,name+'.png'),(await win.webContents.capturePage()).toPNG());};
 const folder={tracks:'tracks',personal:'pb',sessions:'sessions'};
 const rows=key=>key==='sessions'?'document.querySelectorAll("details.sess").length':`document.querySelectorAll('[data-folder="results:${folder[key]}"] tr:has(td)').length`;
 const page=key=>`document.querySelector('[data-history-prev="${key}"]')?.parentElement.textContent`;
 try{
  await until('!!state.schema.slotcars');win.setContentSize(1400,950);
  assert.equal(await run('return (await api.storageStatus()).backend'),backend);
  await run("window.navErrors=[];addEventListener('error',e=>navErrors.push(e.message));addEventListener('unhandledrejection',e=>navErrors.push(String(e.reason)));state.tab='database';state.sub='results';state.resultsSub='racing';await render();");
  await until('document.querySelectorAll(".history-navigation").length===3');
  assert.deepEqual(await run('return [...document.querySelectorAll("#resbody > details.dbfolder")].map(x=>x.dataset.folder)'),['results:tracks','results:pb','results:sessions']);
  assert.equal(await run('return document.querySelectorAll("#resbody > .history-navigation").length'),0);
  for(const key of Object.keys(folder)){
   assert.equal(await run(`return document.querySelector('[data-history-prev="${key}"]').closest('details.dbfolder').dataset.folder`),'results:'+folder[key]);
   assert(await run(`return document.querySelector('[data-history-prev="${key}"]').disabled`));
   assert(await run(`return Number(getComputedStyle(document.querySelector('[data-history-prev="${key}"]')).opacity)<1`));
   assert.equal(await run('return '+rows(key)),key==='sessions'?12:40);
  }
  // Each pager advances only its own section, and the final page retains Previous.
  for(const key of Object.keys(folder)){
   await run(`document.querySelector('[data-history-next="${key}"]').click()`);await until(page(key)+"?.includes('Page 2')");
   assert.equal(await run('return '+rows(key)),key==='sessions'?12:3);
   assert(!await run(`return document.querySelector('[data-history-prev="${key}"]').disabled`));
   if(key!=='sessions')assert(await run(`return document.querySelector('[data-history-next="${key}"]').disabled`));
   await run(`document.querySelector('[data-history-prev="${key}"]').click()`);await until(page(key)+"?.includes('Page 1')");
   for(const other of Object.keys(folder))assert(await run('return '+page(other)+".includes('Page 1')"));
  }
  for(let p=2;p<=4;p++){await run("document.querySelector('[data-history-next=sessions]').click()");await until(page('sessions')+`?.includes('Page ${p}')`);}
  assert.equal(await run('return '+rows('sessions')),7);assert(await run("return document.querySelector('[data-history-next=sessions]').disabled"));
  await run("document.querySelector('[data-folderall=\"0\"]').click()");await until('[...document.querySelectorAll(".history-navigation")].every(x=>!x.closest("details").open)');
  assert(await run('return [...document.querySelectorAll(".history-navigation")].every(x=>!x.checkVisibility())'));
  await run("document.querySelector('[data-folderall=\"1\"]').click()");await until('[...document.querySelectorAll(".history-navigation")].every(x=>x.closest("details").open&&x.checkVisibility())');
  // Small last record pages keep the screenshot readable while testing every theme.
  for(const key of ['tracks','personal']){await run(`document.querySelector('[data-history-next="${key}"]').click()`);await until(page(key)+"?.includes('Page 2')");}
  const themes=await run('return Theme.THEMES.map(x=>x[0])');
  for(const theme of themes){await run(`state.settings.theme=${JSON.stringify(theme)};applyTheme();window.scrollTo(0,0);await document.fonts.ready;`);await shot(theme);}
  win.setMinimumSize(0,0);win.setContentSize(600,900);await run("state.settings.theme='dark';applyTheme();window.scrollTo(0,0)");await wait(100);
  assert(await run('return [...document.querySelectorAll(".history-navigation button")].every(b=>{const r=b.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})'));await shot('narrow');
  // A changed snapshot resets all cursors without losing the refresh notice.
  await run("await api.update('drivers','driver',{name:'James updated'});document.querySelector('[data-history-prev=tracks]').click()");await until('document.querySelector(".history-guidance")?.textContent.includes("Results changed")');
  for(const key of Object.keys(folder))assert(await run('return '+page(key)+".includes('Page 1')"));
  // Single-page sections, including token sessions, have no paging controls at all.
  await run("state.resultsSub='tokens';await render()");await until('document.querySelectorAll("details.sess").length===1');assert.equal(await run('return document.querySelectorAll(".history-navigation").length'),0);
  win.setContentSize(1400,950);await shot('single-page');
  assert.deepEqual(await run('return navErrors'),[]);
  const after=JSON.parse(fs.readFileSync(db.file));const before=JSON.parse(source);assert.deepEqual(after.laps,before.laps);assert.deepEqual(after.sessions,before.sessions);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,backend,themes,profile,checks:['section placement and order','12 session and 40 record limits','independent next/previous','last-page navigation','collapsed sections','single-page controls hidden','stale cursor reset','all themes','600px controls','unchanged original laps and sessions','no renderer errors']},null,2));
  require('./qa-completion.cjs').complete();clearTimeout(timeout);app.quit();
 }catch(error){console.error(error);await shot('failure');clearTimeout(timeout);app.exit(1);}
});});require('../../main');
