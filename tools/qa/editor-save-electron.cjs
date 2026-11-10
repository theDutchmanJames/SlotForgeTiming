'use strict';
// Bounded real-app test with a fresh profile. Never opens installed user data.
const {app,ipcMain}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
require('./qa-completion.cjs').preventRelaunch(app);
const out=path.resolve(__dirname,'../../../outputs/paddock-followup/editor-save-ui');fs.mkdirSync(out,{recursive:true});
const profile=fs.mkdtempSync(path.join(out,'profile-'));app.setPath('appData',profile);app.disableHardwareAcceleration();
require('./file-diagnostics.cjs')(path.join(profile,'diagnostics.log'),()=>app.exit(1));
const handle=ipcMain.handle.bind(ipcMain),ids=[];let lose=true;
ipcMain.handle=(channel,fn)=>handle(channel,channel==='db:editor-save'?async(...args)=>{ids.push(args[1].id);const value=await fn(...args);if(lose){lose=false;throw Error('QA lost acknowledgement after commit');}return value;}:fn);
let stage=0;const timer=setTimeout(()=>app.exit(2),60000),wait=ms=>new Promise(r=>setTimeout(r,ms));
app.on('browser-window-created',(_,win)=>{
 win.show=()=>{};win.hide();
 win.webContents.on('did-finish-load',async()=>{
  if(!win.webContents.getURL().endsWith('index.html'))return;
  const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
  const until=async expression=>{for(let n=0;n<100;n++){if(await run('return '+expression))return;await wait(30);}throw Error('Timed out: '+expression);};
  try{
   await wait(250);assert.equal((await run('return api.storageStatus()')).backend,'sqlite');
   if(stage===0){stage=1;
    const error=await run("try{await api.add('drivers',{name:'Retry verification driver'});return '';}catch(e){return e.message;}");assert.match(error,/could not be confirmed/);
    assert.equal(await run("return Object.keys(localStorage).filter(k=>k.startsWith('slotforge-editor-save-v1:')).length"),1);
    win.reload();return;
   }
   if(stage!==1)return;stage=2;
   const row=await run("return api.add('drivers',{name:'Retry verification driver'})");assert.ok(row.id);assert.equal(ids[0],ids[1]);
   assert.equal(await run("return (await api.list('drivers')).filter(x=>x.name==='Retry verification driver').length"),1);
   assert.equal(await run("return Object.keys(localStorage).filter(k=>k.startsWith('slotforge-editor-save-v1:')).length"),0);
   await run("await Promise.all([api.add('drivers',{name:'Double click'}),api.add('drivers',{name:'Double click'})])");
   assert.equal(await run("return (await api.list('drivers')).filter(x=>x.name==='Double click').length"),1);
   const field=await run("return api.addCustomField('drivers',{label:'Retry club',type:'text'})");assert.ok(field.id);
   await run(`await api.update('drivers',${JSON.stringify(row.id)},{name:'Retry verified',custom:{${JSON.stringify(field.id)}:'Club'}});state.tab='database';state.sub='drivers';await render();`);
   await wait(250);win.setContentSize(1200,900);win.setOpacity(0);win.showInactive();await wait(250);
   fs.writeFileSync(path.join(out,'drivers.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
   assert.match(await run('return document.body.textContent'),/Retry verified/);
   await run("window.qaServiceCar=await api.add('slotcars',{model:'Service retry',lapsSinceService:20});state.sub='slotcars';await render();document.querySelector('[data-edit]').click();");
   await until("dlg.open&&!!document.querySelector('[data-svcreset]')");
   await run("document.querySelector('[data-svcreset]').click()");lose=true;
   await run("document.querySelector('#frm').requestSubmit()");await until("document.querySelector('#err')?.textContent.includes('could not be confirmed')");
   const firstDate=await run("return (await api.getRecord('slotcars',qaServiceCar.id)).serviceDate");assert.ok(firstDate);await wait(100);
   await run("document.querySelector('#frm').requestSubmit()");await until('!dlg.open');
   const serviced=await run("return api.getRecord('slotcars',qaServiceCar.id)");assert.equal(serviced.servicesDone,1);assert.equal(serviced.serviceDate,firstDate);assert.equal(ids.at(-1),ids.at(-2));
   fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,profile,ids,checks:['sandboxed preload','SQLite save','lost committed acknowledgement','actual window reload','same command identity','one created record','double-click coalescing','custom field','record update','database display','actual service-reset form retry and stable timestamp']},null,2));
   require('./qa-completion.cjs').complete();clearTimeout(timer);app.quit();
  }catch(error){console.error(error);clearTimeout(timer);app.exit(1);}
 });
});require('../../main');
