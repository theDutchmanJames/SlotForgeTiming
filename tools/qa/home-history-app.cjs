'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../../outputs/sqlite-conversion');
if(!process.versions.electron){
 const base=fs.realpathSync(process.argv[2]);assert.equal(path.dirname(base),fs.realpathSync(root));assert(path.basename(base).startsWith('home-performance-'));
 const report=JSON.parse(fs.readFileSync(path.join(base,'result.json')));assert.equal(report.status,'passed');assert.equal(report.out,base);
 fs.writeFileSync(path.join(base,'sqlite-test-profile.json'),JSON.stringify({format:require('../../sqlite-runtime').FORMAT,version:1}));
 const env={...process.env,SF_HOME_HISTORY_QA:base};delete env.ELECTRON_RUN_AS_NODE;
 for(const stage of ['first','reopen']){const fd=fs.openSync(path.join(base,'app-'+stage+'-launcher.log'),'w');let r;try{r=require('node:child_process').spawnSync(require('electron'),[__filename,'--sqlite-test-profile='+base],{env:{...env,SF_HOME_HISTORY_STAGE:stage},stdio:['ignore',fd,fd],windowsHide:true,timeout:120000});}finally{fs.closeSync(fd);}assert.equal(r.status,0,stage+': '+r.error);}
 console.log('LARGE HOME APP PASS: '+base);
}else{
 const base=process.env.SF_HOME_HISTORY_QA,stage=process.env.SF_HOME_HISTORY_STAGE;if(!base)throw Error('Use the isolated Home launcher.');
 const {app}=require('electron');fs.mkdirSync(path.join(base,'appdata'),{recursive:true});app.setPath('appData',path.join(base,'appdata'));app.disableHardwareAcceleration();
 require('./file-diagnostics.cjs')(path.join(base,'app-'+stage+'.log'),()=>app.exit(1));let done=false;const started=Date.now(),wait=ms=>new Promise(r=>setTimeout(r,ms)),timer=setTimeout(()=>app.exit(2),110000);
 app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.on('did-finish-load',async()=>{if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
  const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
  try{
   win.setContentSize(1280,960);await wait(300);assert.equal((await run('return api.storageStatus()')).backend,'sqlite');
   await run("window.qaErrors=[];addEventListener('error',e=>qaErrors.push(e.message));addEventListener('unhandledrejection',e=>qaErrors.push(String(e.reason)));");
   let broad=0;const proto=require('../../compatibility-read').SqliteCompatibilityReads.prototype,original=proto.list;proto.list=function(entity){if(['laps','sessions','imagesets','audiosets','slotcars','drivers','tracks','layouts'].includes(entity)){broad++;throw Error('Unexpected full collection read on Home: '+entity);}return original.call(this,entity);};
   if(stage==='first')await run("window.qaSetup=await api.add('racesetups',{name:'Million-lap Home check',sessionType:'race',track:'t',raceBy:'laps',laps:10});state.settings=await api.setSettings({lastSetupId:qaSetup.id,timingHw:'none',homeGrid:null,assignments:{[qaSetup.id]:[{driverId:'d',carId:'c'},{driverId:'',carId:''}]}});");
   const renderMs=await run("const t=performance.now();state.tab='home';resetHome();await renderHome();return performance.now()-t;");
   const request={trackId:'t',driverIds:['d'],grid:[{driverId:'d',color:'#fff'}],now:new Date().toISOString(),boards:['record','glance'].map(key=>({key,count:5,period:'all',scope:'all'}))};
   const values=await run('return api.homeStatistics('+JSON.stringify(request)+')');assert.equal(values.cards.glance.glance.laps,1000000);assert.equal(values.cards.record.rec.record.time,5000);
   assert((await run("return document.querySelector('#hmc-record').textContent")).includes('5.000'));assert(await run("return !!document.querySelector('#hmc-glance')"));assert.equal(broad,0);
   for(const theme of ['dark','light']){await run('state.settings.theme='+JSON.stringify(theme)+';applyTheme();');await wait(120);fs.writeFileSync(path.join(base,'home-'+stage+'-'+theme+'.png'),(await win.webContents.capturePage()).toPNG());}
   win.setContentSize(600,960);await wait(120);fs.writeFileSync(path.join(base,'home-'+stage+'-narrow.png'),(await win.webContents.capturePage()).toPNG());
   assert.deepEqual(await run('return qaErrors'),[]);fs.writeFileSync(path.join(base,'app-'+stage+'-result.json'),JSON.stringify({status:'passed',platform:process.platform,renderMs,startupAndChecksMs:Date.now()-started,fullCollectionReads:broad,minimumViewport:await run('return innerWidth'),laps:values.cards.glance.glance.laps},null,2));clearTimeout(timer);app.quit();
  }catch(e){console.error(e.stack||e);app.exit(1);}
 });});require('../../main');
}
