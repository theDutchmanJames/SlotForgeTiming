'use strict';
const {app,dialog}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const backend=process.env.SF_SHARED_ENGINE_BACKEND||'json',out=path.resolve(__dirname,'../../../outputs',process.env.SF_MERGE_CLIENT_QA==='1'?'merge-client-ui':'shared-engine-ui',backend);fs.mkdirSync(out,{recursive:true});
// Older private qualification runs explicitly enabled the client here. Normal
// launches now use its qualified default; production never reads this QA flag.
if(process.env.SF_MERGE_CLIENT_QA==='1'){const C=require('../../shared-library-client').SharedLibraryClient,open=C.open.bind(C);C.open=options=>open({...options,mergeCompatibility:true});}
const isolated=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'sf-engine-'));app.setPath('appData',isolated);app.disableHardwareAcceleration();process.env.LOCALAPPDATA=path.join(isolated,'local-app-data');
// A new, explicitly named test registration can be retained for the peer app.
// Existing directories are rejected rather than accidentally adopting real data.
const sharedRoot=process.env.SF_SHARED_ENGINE_ROOT?path.resolve(process.env.SF_SHARED_ENGINE_ROOT):path.join(isolated,'shared');fs.mkdirSync(sharedRoot);
const engine=require('../../vendor/slotforge-library/index.cjs'),engineOpen=engine.open;engine.open=options=>engineOpen({...options,sharedRoot});
require('./qa-completion.cjs').preventRelaunch(app);require('./file-diagnostics.cjs')(path.join(isolated,'diagnostics.log'),()=>app.exit(1));dialog.showErrorBox=(title,message)=>{console.error(title,message);app.exit(1);};
const profile=path.join(isolated,'slotforge-timing');fs.mkdirSync(profile);
const db=new(require('../../db'))(path.join(profile,'slotforge-timing.json'));db.data.paddock={sourceId:'native-timing',connection:null,withdrawals:[]};db.data.slotcars=[{id:'original-car',brand:'NSR',manufacturer:'Aston Martin',model:'Original GT3',damageFactor:1.3}];db.saveNow();
db.data.drivers=[{id:'legacy-driver',name:'James'}];db.data.tracks=[{id:'legacy-track',name:'Club circuit',lanes:2,length:25}];
db.data.sessions=[{id:'old-session',sessionType:'qualifying',setupName:'Original race history',trackId:'legacy-track',trackName:'Club circuit',date:'2026-10-25T12:34:56.789Z',standings:[{carId:'original-car',driverId:'legacy-driver',driverName:'James',laps:3,best:6795,pos:1}]}];
db.data.laps=[7021,6795,30302].map((time,i)=>({id:i?'original-lap-'+i:'original-lap',sessionId:'old-session',trackId:'legacy-track',carId:'original-car',driverId:'legacy-driver',lane:2,lapNumber:i+1,time,...(i===2?{tooSlow:true,noTrackRecord:true,noPersonalBest:true}:{})}));db.saveNow();
if(backend==='sqlite'){
 const generation=require('node:crypto').randomUUID(),copy=path.join(profile,'sqlite',generation);fs.mkdirSync(path.dirname(copy),{recursive:true});
 require('../../sqlite-migration').migrateCopy({source:db.file,destination:copy});require('../../sqlite-working').forkCopy(copy,path.join(copy,'working'));
 fs.writeFileSync(path.join(profile,'storage-backend.json'),JSON.stringify({format:'slotforge-storage-selection',version:1,backend:'sqlite',generation}));
}
fs.writeFileSync(path.join(profile,'storage-conversion-prompt.json'),JSON.stringify({version:1,choice:'keep'}));
assert.equal(require('../../shared-library-activation').enabled,true); // Verify ordinary enabled startup.
const wait=ms=>new Promise(r=>setTimeout(r,ms));let done=false,peer;
const timeout=setTimeout(()=>app.exit(2),110000);
app.on('browser-window-created',(_,win)=>{win.show=()=>{};win.hide();win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()').catch(error=>{throw Error(error.message+' / '+code);});
 const until=async condition=>{for(let i=0;i<200;i++){if(await run('return '+condition))return;await wait(40);}throw Error('Timeout: '+condition+' / '+await run('return document.body.innerText.slice(0,2000)'));};
 const shot=async name=>{await wait(100);fs.writeFileSync(path.join(out,name+'.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());};
 try{
  await until('!!state.schema.slotcars');win.setContentSize(1200,850);win.setOpacity(0);win.showInactive();
  assert.equal(await run('return (await api.libraryStatus()).available'),true);
  assert.equal(await run('return (await api.storageStatus()).backend'),backend);
  peer=await require('../../vendor/slotforge-library/index.cjs').open({application:'Paddock QA peer',installationId:'native-paddock',appData:isolated,legacyProfiles:[]});
  await run(`window.qaErrors=[];addEventListener('error',e=>qaErrors.push(e.message));addEventListener('unhandledrejection',e=>qaErrors.push(String(e.reason)));state.tab='database';state.sub='slotcars';await render();`);
  await until('document.body.innerText.includes("Original GT3")');assert.equal(await run('return !!document.querySelector("[data-paddock-browser]")'),false);await shot('normal-slotcars');
  await run(`document.querySelector('[data-edit="original-car"]').click()`);await until('!!document.querySelector("[data-field=name]")');
  await shot('normal-car-editor');
  await run(`const input=document.querySelector('[data-field=name]');input.value='Edited in normal Timing database';input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-timing=damageFactor]').value='1.5';document.querySelector('.shared-car-dialog form').requestSubmit();`);
  await until('!document.querySelector(".shared-car-dialog")');assert.equal((await peer.catalogue({})).cars[0].fields.name,'Edited in normal Timing database');
  await until('document.body.innerText.includes("Edited in normal Timing database")');
  await run(`document.querySelector('[data-edit="original-car"]').click()`);await until('!!document.querySelector("[data-timing=failureFactor]")');
  await run(`document.querySelector('[data-timing=failureFactor]').scrollIntoView({block:'center'});`);await shot('normal-simulation-settings');
  await run(`document.querySelector('[data-timing=failureFactor]').value='0';document.querySelector('.shared-car-dialog form').requestSubmit();`);await until('!document.querySelector(".shared-car-dialog")');assert.equal(await run('return (await api.getRecord("slotcars","original-car")).failureFactor'),0);
  const customField=await run("return api.addCustomField('slotcars',{label:'Shared setup note',type:'text',options:[]})");
  await until('!!document.querySelector("[data-edit=original-car]")');await wait(200);
  await run("document.querySelector('[data-edit=original-car]').click()");await until('!!document.querySelector("[data-custom]")');
  await run("document.querySelector('[data-custom]').value='Soft braid';document.querySelector('.shared-car-dialog form').requestSubmit()");await until('!document.querySelector(".shared-car-dialog")');
  assert.equal(await run(`return (await api.getRecord('slotcars','original-car')).custom[${JSON.stringify(customField.id)}]`),'Soft braid');
  await run("state.tab='database';state.sub='slotcars';await render()");await until('!!document.querySelector("[data-edit=original-car]")');
  await run("document.querySelector('[data-edit=original-car]').click()");await until('!!document.querySelector("[data-service-save]")');
  await run("const x=document.querySelector('[data-service=servicesDone]');x.value='5';x.closest('details').open=true;document.querySelector('[data-service-save]').click()");
  await until('document.querySelector("[data-service=servicesDone]")?.value==="5" && !document.querySelector("[data-service-save]").disabled');
  assert.equal(await run("return (await api.getRecord('slotcars','original-car')).servicesDone"),5);
  await run("document.querySelector('[data-service-save]').scrollIntoView({block:'center'})");await shot('normal-service-fields');await run("document.querySelector('.shared-car-dialog [data-close]').click()");await until('!document.querySelector(".shared-car-dialog")');
  await run('document.querySelector("#add").click()');await until('!!document.querySelector("[data-field=name]")');await run(`document.querySelector('[data-field=name]').value='Created in Timing';document.querySelector('.shared-car-dialog form').requestSubmit();`);await until('!document.querySelector(".shared-car-dialog")');assert.equal((await peer.catalogue({})).total,2);
  const status=await peer.status(),first=(await peer.catalogue({})).cars.find(c=>c.fields.name==='Edited in normal Timing database');await peer.carWrite({databaseId:status.databaseId,recoveryId:status.recoveryId,operationId:'native-peer-change',action:'patch',carId:first.id,expectedRevision:first.revision,set:{name:'Updated by the other app'}});
  await run('document.activeElement?.blur()');await until('document.body.innerText.includes("Updated by the other app")');
  await run(`state.tab='home';await render();`);await until('document.body.innerText.includes("START A RACE")||document.body.innerText.includes("Start a race")');await shot('normal-home');
  await run(`state.tab='database';state.sub='results';state.resultsSub='racing';await render();`);await until('document.querySelector("details.sess")?.innerText.includes("Original race history")');assert(!await run('return !!document.querySelector(".central-history,.original-history")'));await shot('normal-results');
  await run("document.querySelector('[data-history-open]').click()");await until('document.querySelector("details.sess[open] .sessbody")?.innerText.includes("6.795")');
  assert(!await run('return document.querySelector("details.sess[open]").innerText.includes("Pending historical")'));
  await run(`document.querySelector('details.sess[open]').scrollIntoView({block:'start'})`);await shot('native-historical-detail');
  const evidence=require('./rich-mapper-fixtures.cjs').evidence();
  const saved=await run(`const e=${JSON.stringify(evidence)},captured=await api.paddockPrepare(['original-car']);e.session.paddockJournal.captures={local:captured.captures['original-car']};e.session.paddockJournal.sharedLibrary=captured.sharedLibrary;return api.saveSession(e.session,e.laps);`);
  for(let i=0;i<100;i++){if((await peer.historyRead({kind:'sessions'})).entries.some(e=>e.sessionId===saved))break;await wait(40);}
  assert((await peer.historyRead({kind:'sessions'})).entries.some(e=>e.sessionId===saved));
  const tokenId=await run(`const captured=await api.paddockPrepare(['original-car']);return api.saveSession({setupName:'Native Time Token stint',sessionType:'tokens',paddockJournal:captured,standings:[{carId:'original-car',laps:1}]},[{carId:'original-car',lapNumber:1,lane:1,time:12345}]);`);
  for(let i=0;i<100;i++){if((await peer.originalHistory({kind:'sessions'})).rows.some(e=>e.sessionId===tokenId))break;await wait(40);}
  assert((await peer.originalHistory({kind:'sessions'})).rows.some(e=>e.sessionId===tokenId));
  await run(`state.tab='database';state.sub='results';await render();`);await until('document.body.innerText.includes("Saved race")');await shot('shared-finalised-results');
  await run("state.resultsSub='tokens';await render()");await until('document.querySelector("details.sess")?.innerText.includes("Native Time Token stint")');await run("document.querySelector('[data-history-open]').click()");await until('document.querySelector("details.sess[open] .sessbody")?.innerText.includes("12.345")');await shot('shared-original-token-history');
  assert.deepEqual(await run('return qaErrors'),[]);
  const sharedStatus=await peer.status();await peer.close();peer=null;assert.equal(await run('return (await api.getRecord("slotcars","original-car")).damageFactor'),1.5);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,isolated,sharedRoot,sharedStatus,profile,savedSessionId:saved,tokenSessionId:tokenId,checks:['normal source startup','normal Slotcars reads canonical data','normal editor writes canonical data','simulation-only edits retained atomically','create without Review','peer changes refresh normal catalogue','Home reference scopes','Results renders','normal finalization saves shared history','token session visible in normal Token Records','peer absent reads']},null,2));
  fs.copyFileSync(path.join(out,'result.json'),path.join(sharedRoot,'timing-qa-result.json'),fs.constants.COPYFILE_EXCL);
  require('./qa-completion.cjs').complete();clearTimeout(timeout);app.quit();
 }catch(e){console.error(e);await peer?.close();clearTimeout(timeout);app.exit(1);}
});});
require('../../main');
