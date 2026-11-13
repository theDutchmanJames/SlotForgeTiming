'use strict';
const {app,nativeImage}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const sqlite=process.env.SF_THUMBNAIL_QA_SQLITE==='1';
const out=path.resolve(__dirname,'../../../outputs/shared-thumbnails/'+(sqlite?'ui-sqlite':'ui'));fs.mkdirSync(out,{recursive:true});
const isolated=fs.mkdtempSync(path.join(out,'profile-'));app.setPath('appData',isolated);process.env.LOCALAPPDATA=path.join(isolated,'local');app.disableHardwareAcceleration();
require('./qa-completion.cjs').preventRelaunch(app);require('./file-diagnostics.cjs')(path.join(out,'diagnostics.log'),()=>app.exit(1));
const profile=path.join(isolated,'slotforge-timing');fs.mkdirSync(profile);
const image=nativeImage.createFromPath(path.resolve(__dirname,'../../build/icon.png')).resize({width:1600}).toDataURL();
const db=new(require('../../db'))(path.join(profile,'slotforge-timing.json'));db.data.paddock={sourceId:'thumbnail-ui'};db.data.settings.dbView='grid';
db.data.slotcars=Array.from({length:60},(_,n)=>({id:'qa-car-'+n,brand:'SlotForge',model:'Touring car '+String(n).padStart(2,'0'),picture:image,extraPictures:[image],tyreCompound:'M',damageFactor:1.1,lapsSinceService:0}));db.saveNow();
fs.writeFileSync(path.join(profile,'storage-conversion-prompt.json'),JSON.stringify({version:1,choice:'keep'}));
if(sqlite){const generation=require('node:crypto').randomUUID(),copy=path.join(profile,'sqlite',generation);fs.mkdirSync(path.dirname(copy),{recursive:true});require('../../sqlite-migration').migrateCopy({source:db.file,destination:copy});require('../../sqlite-working').forkCopy(copy,path.join(copy,'working'));fs.writeFileSync(path.join(profile,'storage-backend.json'),JSON.stringify({format:'slotforge-storage-selection',version:1,backend:'sqlite',generation}));}
const original=fs.readFileSync(db.file),engine=require('../../vendor/slotforge-library/index.cjs'),open=engine.open;let handle,overviewCalls=0,encodes=0;
engine.open=async options=>{
 const encode=options.thumbnailEncoder;fs.appendFileSync(path.join(out,'steps.log'),'engine opening\n');
 handle=await open({...options,sharedRoot:path.join(isolated,'shared'),legacyProfiles:[profile],thumbnailEncoder:async source=>{encodes++;return encode(source);}});
 fs.appendFileSync(path.join(out,'steps.log'),'engine opened\n');const overview=handle.catalogueOverview;handle.catalogueOverview=async o=>{overviewCalls++;await new Promise(r=>setTimeout(r,200));return overview(o);};return handle;
};
const trace=msg=>fs.appendFileSync(path.join(out,'steps.log'),new Date().toISOString()+' '+msg+'\n');trace('fixture ready');
let done=false;const timer=setTimeout(async()=>{trace('TIMEOUT');for(const w of require('electron').BrowserWindow.getAllWindows())if(w.webContents.getURL().endsWith('index.html')){fs.writeFileSync(path.join(out,'timeout.png'),(await w.webContents.capturePage()).toPNG());trace(await w.webContents.executeJavaScript('document.body.innerText'));}app.exit(2);},60000),wait=ms=>new Promise(r=>setTimeout(r,ms));
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.setBackgroundThrottling(false);win.webContents.on('console-message',(event)=>{const {level,message}=event;if(level==='error')fs.appendFileSync(path.join(out,'renderer.log'),message+'\n');});win.webContents.on('did-finish-load',async()=>{
 trace('loaded '+win.webContents.getURL());if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
 const until=async expr=>{for(let n=0;n<200;n++){if(await run('return '+expr))return;await wait(50);}throw Error('Timed out: '+expr);};
 try{
  trace('waiting schema');await until("typeof state!=='undefined'&&state.schema.slotcars");await wait(300);
  await run("window.thumbnailErrors=[];addEventListener('error',e=>thumbnailErrors.push(e.message));addEventListener('unhandledrejection',e=>thumbnailErrors.push(String(e.reason)));state.settings.dbView='grid';state.tab='database';state.sub='drivers';await render();");
  trace('drivers ready');const start=Date.now();await run("document.querySelector('#subtabs [data-id=slotcars]').click();for(let n=0;n<20;n++)document.querySelector('#subtabs [data-id=slotcars]').click();");
  assert(await run("return document.querySelector('#subview [role=status]')?.textContent.includes('Loading Slotcars')"));
  await until("document.querySelectorAll('#subview .gcard').length===48");const loadMs=Date.now()-start;trace('cards ready');
  assert.equal(overviewCalls,1);trace('waiting images');await until("document.querySelector('#subview [data-catalogue-picture]')?.naturalWidth>0");
  assert(await run("return [...document.querySelectorAll('#subview img')].every(i=>!i.naturalWidth||i.naturalWidth<=512)"));
  await wait(300);assert.equal(encodes,1,'Identical originals share a persisted derivative');
  win.setContentSize(1400,900);await wait(100);fs.writeFileSync(path.join(out,'overview-dark.png'),(await win.webContents.capturePage()).toPNG());
  trace('images ready');const id=await run("return document.querySelector('#subview [data-view]').dataset.view");
  trace('opening detail');await run("document.querySelector('#subview [data-view]').click()");await until('dlg.open');
  await until("[...dlg.querySelectorAll('img')].some(i=>i.naturalWidth===1600)");
  trace('full-size detail ready');await until("!dlg.querySelector('#vc_byTrack').textContent.includes('Calculating')");await wait(250);fs.writeFileSync(path.join(out,'full-picture.png'),(await win.webContents.capturePage()).toPNG());await run('dlg.close()');await wait(500);
  for(const theme of ['light','dark']){await run(`state.settings.theme='${theme}';applyTheme();await mountManager(byId('subview'),'slotcars');`);await wait(400);fs.writeFileSync(path.join(out,'overview-'+theme+'.png'),(await win.webContents.capturePage()).toPNG());}
  win.setMinimumSize(0,0);win.setContentSize(600,800);await run("await mountManager(byId('subview'),'slotcars');");await wait(200);fs.writeFileSync(path.join(out,'overview-600.png'),(await win.webContents.capturePage()).toPNG());
  assert(await run('return document.documentElement.scrollWidth<=innerWidth+1'));
  assert.deepEqual(await run('return thumbnailErrors'),[]);assert.equal(encodes,1);
  // Reopen the shared engine without an encoder: a warm thumbnail needs no original decode.
  trace('desktop layouts verified; reopening');const peer=await open({application:'QA reopen',installationId:'qa-reopen',sharedRoot:path.join(isolated,'shared'),legacyProfiles:[]});
  try{const page=await peer.catalogue({limit:1});const data=await peer.thumbnail({carId:page.cars[0].id});assert(data.startsWith('data:image/png;base64,'));assert.equal(nativeImage.createFromDataURL(data).getSize().width,512);}finally{await peer.close();}
  trace('reopen verified');const before=JSON.parse(original),after=JSON.parse(fs.readFileSync(db.file,'utf8'));const hash=x=>require('node:crypto').createHash('sha256').update(JSON.stringify(x)).digest('hex');assert.equal(hash(after.slotcars),hash(before.slotcars),'Original car records unchanged');trace('source car records verified');
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,backend:sqlite?'sqlite':'json',loadMs,overviewCalls,encodes,profile:isolated,checks:['rapid repeated clicks','immediate loading feedback','48 cards','stored shared thumbnail','full-resolution details','dark/light/600px','reopen without encoder','unchanged source car records','no renderer errors']},null,2));
  clearTimeout(timer);require('./qa-completion.cjs').complete();app.exit(0);
 }catch(e){fs.writeFileSync(path.join(out,'failure.txt'),e.stack);fs.writeFileSync(path.join(out,'failure.png'),(await win.webContents.capturePage()).toPNG());clearTimeout(timer);app.exit(1);}
});});require('../../main');
