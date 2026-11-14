'use strict';
const {app,dialog}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const backend=process.env.SF_SHARED_ENGINE_BACKEND||'json',out=path.resolve(__dirname,'../../../outputs','wishlist-ui',backend);fs.mkdirSync(out,{recursive:true});
const isolated=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'sf-engine-'));app.setPath('appData',isolated);app.disableHardwareAcceleration();process.env.LOCALAPPDATA=path.join(isolated,'local-app-data');
// This check always uses a new library, never a user's registered database.
const sharedRoot=path.join(isolated,'shared');fs.mkdirSync(sharedRoot);
const engine=require('../../vendor/slotforge-library/index.cjs'),engineOpen=engine.open;engine.open=options=>engineOpen({...options,sharedRoot});
require('./qa-completion.cjs').preventRelaunch(app);require('./file-diagnostics.cjs')(path.join(isolated,'diagnostics.log'),()=>app.exit(1));dialog.showErrorBox=(title,message)=>{console.error(title,message);app.exit(1);};
const profile=path.join(isolated,'slotforge-timing');fs.mkdirSync(profile);
const db=new(require('../../db'))(path.join(profile,'slotforge-timing.json'));db.data.paddock={sourceId:'native-timing',connection:null,withdrawals:[]};db.data.slotcars=[{id:'original-car',brand:'NSR',manufacturer:'Aston Martin',model:'Original GT3',damageFactor:1.3}];db.saveNow();
db.data.drivers=[{id:'legacy-driver',name:'James'}];db.data.tracks=[{id:'legacy-track',name:'Club circuit',lanes:2,length:25}];
db.data.sessions=[{id:'old-session',sessionType:'qualifying',setupName:'Original race history',trackId:'legacy-track',trackName:'Club circuit',date:'2026-10-25T12:34:56.789Z',standings:[{carId:'original-car',driverId:'legacy-driver',driverName:'James',laps:3,best:6795,pos:1}]}];
db.data.laps=[7021,6795,30302].map((time,i)=>({id:i?'original-lap-'+i:'original-lap',sessionId:'old-session',trackId:'legacy-track',carId:'original-car',driverId:'legacy-driver',lane:2,lapNumber:i+1,time,...(i===2?{tooSlow:true,noTrackRecord:true,noPersonalBest:true}:{})}));db.saveNow();
db.data.racesetups=[{id:'qa-race',name:'Wishlist qualification',track:'legacy-track',sessionType:'practice'}];db.saveNow();
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
  assert.equal(require('../../vendor/slotforge-library/engine/src/wishlist-activation.json').enabled,false);
  peer=await engine.open({application:'Paddock QA peer',installationId:'native-paddock',legacyProfiles:[]});
  const s=await peer.status();assert.equal(s.capabilities.wishlistFiltering,1);
  const store=await require('../../vendor/slotforge-library/engine/src/store.cjs').Store.open(s.file);
  const wish=store.mutate('car.save',{data:{name:'Wishlist GT3',collectionStatus:'wishlist',raceClass:'Wishlist only class'}}).result;
  store.mutate('car.save',{data:{name:'Wanted label car',ownership:'Wanted'}});
  await run("window.qaErrors=[];addEventListener('error',e=>qaErrors.push(e.message));addEventListener('unhandledrejection',e=>qaErrors.push(String(e.reason)));state.tab='database';state.sub='slotcars';await render()");
  await until('document.body.innerText.includes("Wanted label car")');assert(!await run('return document.body.innerText.includes("Wishlist GT3")'));await shot('catalogue-excludes-wishlist');
  await run("state.tab='home';await render()");await until('!!document.querySelector("select[data-k=carId]")');
  const names=()=>run('return [...document.querySelectorAll("select[data-k=carId] option")].map(x=>x.textContent)');
  assert(!(await names()).some(x=>x.includes('Wishlist GT3')));assert((await names()).some(x=>x.includes('Wanted label car')));await shot('home-excludes-wishlist');
  await run("state.tab='database';state.sub='slotcars';await render();document.activeElement?.blur()");
  store.mutate('car.purchase',{id:wish,revision:1,confirmed:true});await until('document.body.innerText.includes("Wishlist GT3")');await shot('purchased-same-car-visible');
  await run("state.tab='home';await render()");await until('!!document.querySelector("select[data-k=carId]")');assert((await names()).some(x=>x.includes('Wishlist GT3')));await shot('home-purchased-selectable');
  const capture=await run('return api.paddockPrepare(['+JSON.stringify(wish)+'])');assert.equal(capture.captures[wish].configuration.carId,wish);
  assert.deepEqual(await run('return qaErrors'),[]);await peer.close();peer=null;
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,backend,isolated,sharedRoot,capability:1,activation:false,checks:['actual database excludes wish','legacy Wanted visible','Home selectors exclude wish','purchase refresh while open','same ID selectable after purchase','actual race configuration capture','no renderer errors']},null,2));
  require('./qa-completion.cjs').complete();clearTimeout(timeout);app.quit();
 }catch(e){console.error(e);await peer?.close();clearTimeout(timeout);app.exit(1);}
});});
require('../../main');
