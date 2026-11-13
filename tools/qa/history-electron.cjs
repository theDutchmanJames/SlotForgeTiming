// Real app, disposable profile, file-backed diagnostics. Never uses personal data.
const {app,ipcMain}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
require('./qa-completion.cjs').preventRelaunch(app);
const out=path.resolve(__dirname,'../../../outputs/sqlite-conversion/history-ui');fs.mkdirSync(out,{recursive:true});
const profile=fs.mkdtempSync(path.join(out,'profile-'));app.setPath('appData',profile);app.disableHardwareAcceleration();
require('./file-diagnostics.cjs')(path.join(profile,'diagnostics.log'),()=>app.exit(1));
let done=false,pdf='';const timer=setTimeout(()=>app.exit(2),90000),wait=ms=>new Promise(r=>setTimeout(r,ms));
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
 const until=async expression=>{for(let i=0;i<100;i++){if(await run('return '+expression))return;await wait(50);}throw Error('Timed out: '+expression);};
 try{
  await wait(300);win.setContentSize(1200,900);
  assert.equal((await run('return api.storageStatus()')).backend,'sqlite','History QA must exercise SQLite');
  ipcMain.removeHandler('pdf:export');ipcMain.handle('pdf:export',(_e,html)=>{pdf=html;return {saved:false};});
  await run(`window.historyErrors=[];addEventListener('error',e=>historyErrors.push(e.message));addEventListener('unhandledrejection',e=>historyErrors.push(String(e.reason)));
   window.qaDriver=await api.add('drivers',{name:'James'});window.qaCar=await api.add('slotcars',{brand:'SlotForge',model:'GT3',scale:'1:32'});window.qaTrack=await api.add('tracks',{name:'Club Circuit',length:22,lanes:2});
   window.qaSessions=[];for(let i=0;i<26;i++){const token=i===0;qaSessions.push(await api.saveSession({date:'2026-11-03',setupName:token?'Club token session':'Club race '+i,sessionType:token?'tokens':'race',trackId:qaTrack.id,trackName:qaTrack.name,token:token?{lane:1,bought:120}:undefined,standings:[{pos:1,driverId:qaDriver.id,driverName:'James',carId:qaCar.id,carName:'SlotForge GT3',laps:240,best:5000,total:1228680}]},Array.from({length:240},(_,j)=>({driverId:qaDriver.id,carId:qaCar.id,trackId:qaTrack.id,token,lapNumber:j+1,time:5000+j,lane:1,date:'2026-11-03'}))));}
   state.tab='database';state.sub='results';state.resultsSub='racing';await render();`);
  await until("document.querySelectorAll('[data-history-open]').length===12");assert.equal(await run("return document.querySelectorAll('[data-pdf]').length"),0);
  await run("document.querySelector('[data-history-next=sessions]').click()");await until("document.querySelector('[data-history-prev=sessions]').parentElement.textContent.includes('Page 2')");
  await run("document.querySelector('[data-history-prev=sessions]').click()");await until("document.querySelector('[data-history-prev=sessions]').parentElement.textContent.includes('Page 1')");
  await run("document.querySelector('[data-history-open]').click()");await until("!!document.querySelector('.history-laps')");
  assert(await run("return document.querySelector('.history-laps').textContent.includes('1–100 of 240')"));
  assert.equal(await run("return document.querySelectorAll('[data-pdf]').length"),1);
  await run("document.querySelector('[data-laps-next]').click()");await until("document.querySelector('.history-laps')?.textContent.includes('101–200 of 240')");
  await run("document.querySelector('[data-pdf]').click()");await until('dlg.open');
  // Select all lap pages for the PDF using the actual export options dialog.
  await run("for(const input of dlg.querySelectorAll('input[type=checkbox]'))input.checked=true;dlg.querySelector('#pdfgo').click()");
  for(let i=0;i<80&&!pdf;i++)await wait(50);assert(pdf.includes('<td>240</td>')&&pdf.includes('5.239'),'PDF includes last lap outside the visible page');
  await run("await api.update('drivers',qaDriver.id,{name:'James updated'});document.querySelector('[data-history-next=sessions]').click()");await until("document.querySelector('.history-guidance')?.textContent.includes('Results changed')");
  assert(await run("return document.querySelector('.history-navigation').textContent.includes('Page 1')"));
  await run("document.querySelector('[data-folderall=\"0\"]').click()");await until("[...document.querySelectorAll('#resbody details.dbfolder')].every(x=>!x.open)");
  await run("document.querySelector('[data-folderall=\"1\"]').click()");await until("[...document.querySelectorAll('#resbody details.dbfolder')].every(x=>x.open)");
  const themes=await run('return Theme.THEMES.map(x=>x[0])');
  for(const theme of themes){await run(`state.settings.theme=${JSON.stringify(theme)};applyTheme();document.querySelector('details.sess[open]').scrollIntoView({block:'start'});`);await wait(50);fs.writeFileSync(path.join(out,theme+'.png'),(await win.webContents.capturePage()).toPNG());}
  await run("state.resultsSub='tokens';await renderResults(byId('subview'));");await until("document.querySelectorAll('[data-history-open]').length===1");
  await run("document.querySelector('[data-history-open]').click()");await until("!!document.querySelector('.history-laps')");assert(await run("return document.querySelector('.history-laps').textContent.includes('240')"));
  fs.writeFileSync(path.join(out,'tokens.png'),(await win.webContents.capturePage()).toPNG());
  await run("state.sub='slotcars';await render();document.querySelector('#subview [data-view]').click()");await until("dlg.open&&document.querySelector('#vc_byTrack')?.textContent.includes('Club Circuit')");
  fs.writeFileSync(path.join(out,'car-statistics.png'),(await win.webContents.capturePage()).toPNG());await run('dlg.close()');
  win.setMinimumSize(0,0);win.setContentSize(600,850);await run("state.sub='results';state.resultsSub='racing';state.settings.theme='dark';applyTheme();await render();");await until("document.querySelectorAll('[data-history-open]').length===12");
  assert.equal(await run('return innerWidth'),600);assert(await run("return [...document.querySelectorAll('.history-navigation button')].every(b=>b.getBoundingClientRect().right<=innerWidth)"));
  fs.writeFileSync(path.join(out,'narrow.png'),(await win.webContents.capturePage()).toPNG());
  await run("document.querySelector('[data-history-open]').click()");await until("!!document.querySelector('.history-laps')");await run("document.querySelector('details.sess[open]').scrollIntoView({block:'start'})");
  assert(await run('return document.documentElement.scrollWidth<=innerWidth'));await wait(350);fs.writeFileSync(path.join(out,'narrow-session.png'),(await win.webContents.capturePage()).toPNG());
  assert.deepEqual(await run('return historyErrors'),[]);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,themes,profile,checks:['SQLite backend','12 session bound','lazy session details','100 lap paging','complete PDF','stale cursor refresh','token history','selected car statistics','all themes','600px controls','runtime errors']},null,2));require('./qa-completion.cjs').complete();clearTimeout(timer);app.exit(0);
 }catch(error){console.error(error);fs.writeFileSync(path.join(out,'failure.png'),(await win.webContents.capturePage()).toPNG());clearTimeout(timer);app.exit(1);}
});});require('../../main');
