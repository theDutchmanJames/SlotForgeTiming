// Actual app, generated profile; no personal database or timing hardware.
const {app,nativeImage}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../../../outputs/sqlite-conversion/reference-ui');fs.mkdirSync(out,{recursive:true});
const profile=fs.mkdtempSync(path.join(out,'profile-'));app.setPath('appData',profile);app.disableHardwareAcceleration();
require('./file-diagnostics.cjs')(path.join(profile,'diagnostics.log'),()=>app.exit(1));
const Database=require('../../db'),Repository=require('../../data-repository'),D=require('../../renderer/trackdesign');
fs.mkdirSync(path.join(profile,'slotforge-timing'),{recursive:true});
const seed=new Database(path.join(profile,'slotforge-timing','slotforge-timing.json'));
const picture=nativeImage.createFromPath(path.resolve(__dirname,'../../build/icon.png')).resize({width:64}).toDataURL();
const design=D.normalize(JSON.parse(fs.readFileSync(path.join(__dirname,'../../tests/fixtures/trackbuilder/01-two-lane.slotforge.json'),'utf8'))),savedDesign=D.configure(design,design.track.lanes.map(l=>l.id),true);
seed.data.drivers=Array.from({length:205},(_,i)=>({id:'d'+i,name:'Driver '+i,driverType:'human',avatar:picture}));
seed.data.slotcars=[{id:'c',model:'GT3',picture,serviceInterval:100,lapsSinceService:110,lapsDriven:110},{id:'c2',model:'Prototype',picture},{id:'archived',model:'Linked',picture,paddock:{name:'Archived Paddock car',archived:true,configuration:{photo:picture}}}];
seed.data.tracks=[{id:'t',name:'Circuit import',lanes:2,length:20,laneLengths:[20,21],trackDesign:savedDesign,picture,targetLap:5}];
seed.data.layouts=[{id:'layout',name:'Club layout',laneColors:[{bg:'#38bdf8'},{bg:'#d8a158'}],widgets:[]}];seed.data.audiosets=[{id:'audio',name:'Club audio',calls:{}}];
seed.data.imagesets=[{id:'used',name:'Selected weather',kind:'weather',images:{dry:picture}},{id:'unused',name:'Unselected weather',kind:'weather',images:{dry:picture}}];
seed.data.racesetups=[{id:'setup',name:'Club race',sessionType:'race',track:'t',raceBy:'laps',laps:10,layout:'layout',audioSet:'audio'}];
seed.data.sessions=[{id:'s',date:'2026-11-03',setupName:'Previous race',sessionType:'race',trackId:'t',standings:[{pos:1,driverId:'d1',driverName:'Driver 1',carId:'c',carName:'GT3',laps:1,total:5000,best:5000}]}];
seed.data.laps=[{id:'l',sessionId:'s',trackId:'t',driverId:'d1',carId:'c',time:5000,lane:1,lapNumber:1}];
seed.saveNow();
let done=false;const wait=ms=>new Promise(r=>setTimeout(r,ms)),timer=setTimeout(()=>app.exit(2),90000);
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
 const until=async exp=>{for(let i=0;i<100;i++){if(await run('return '+exp))return;await wait(50);}throw Error('Timed out: '+exp);};
 try{
  await wait(350);win.setContentSize(1280,960);
  const broad=[],details=[],pictures=[];const originalList=Repository.prototype.list,originalDetails=Repository.prototype.referenceDetails,originalPicture=Repository.prototype.cataloguePicture;
  Repository.prototype.list=function(e){if(['drivers','slotcars','tracks','teams','layouts','audiosets','imagesets'].includes(e)){broad.push(e);throw Error('Unexpected full-list read: '+e);}return originalList.call(this,e);};
  Repository.prototype.referenceDetails=function(e,ids,revision){details.push({entity:e,ids});return originalDetails.call(this,e,ids,revision);};
  Repository.prototype.cataloguePicture=function(e,id,revision){pictures.push(id);return originalPicture.call(this,e,id,revision);};
  await run(`window.qaErrors=[];addEventListener('error',e=>qaErrors.push(e.message));addEventListener('unhandledrejection',e=>qaErrors.push(String(e.reason)));window.qaAlerts=[];window.alert=message=>qaAlerts.push(message);
    state.settings=await api.setSettings({timingHw:'none',lastSetupId:'setup',assignments:{setup:[{driverId:'d1',carId:'c'},{driverId:'d204',carId:'c2'}]},homeGrid:{cols:3,rows:3,boards:[{c:1,r:1,w:2,h:3,opt:{card:'start'}},{c:3,r:1,w:1,h:1,opt:{card:'weather',weatherSet:'used'}},{c:3,r:2,w:1,h:1,opt:{card:'mileage',pics:true}},{c:3,r:3,w:1,h:1,opt:{card:'service',pics:true}}]}});state.tab='home';resetHome();await renderHome();`);
  assert.equal(await run("return document.querySelector('select[data-k=driverId]').options.length"),206);
  assert(await run("return ![...document.querySelectorAll('select[data-k=carId] option')].some(o=>o.textContent.includes('Archived Paddock car'))"));
  await until("document.querySelector('#hmc-mileage img')?.naturalWidth>0&&document.querySelector('#hmc-service img')?.naturalWidth>0");
  assert(details.some(d=>d.entity==='imagesets'&&d.ids.join()==='used'));assert(!details.some(d=>d.ids.includes('unused')));assert.deepEqual([...new Set(pictures)],['c']);assert.deepEqual(broad,[]);
  const themes=await run('return Theme.THEMES.map(x=>x[0])');for(const theme of themes){await run(`state.settings.theme=${JSON.stringify(theme)};applyTheme();`);await wait(120);fs.writeFileSync(path.join(out,theme+'.png'),(await win.webContents.capturePage()).toPNG());}
  win.setContentSize(600,960);await wait(160);const minimumViewport=await run('return innerWidth');fs.writeFileSync(path.join(out,'home-minimum.png'),(await win.webContents.capturePage()).toPNG());win.setContentSize(1280,960);await wait(120);
  // Database member selectors use the same metadata contract without loading avatars.
  await run("state.tab='database';state.sub='teams';await render()");assert.equal(await run('return state.refs.drivers.length'),205);assert.deepEqual(broad,[]);
  await run("state.tab='home';await renderHome()");
  // A stale track read must not launch a race with mixed old/new configuration.
  await run("await api.update('tracks','t',{name:'Updated Circuit'});document.querySelector('#start').click()");await until('qaAlerts.length===1');assert.equal(await run('return state.tab'),'home');
  await run('await renderHome()');
  // A background read completing after navigation must not start a hidden race.
  Repository.prototype.referenceDetails=function(e,ids,r){if(e==='tracks')return new Promise(resolve=>setTimeout(()=>resolve(originalDetails.call(this,e,ids,r)),150));return originalDetails.call(this,e,ids,r);};
  await run("document.querySelector('#start').click();state.tab='rules';await render()");await wait(250);assert.equal(await run('return state.tab'),'rules');
  Repository.prototype.referenceDetails=originalDetails;
  await run("state.tab='home';await renderHome()");
  Repository.prototype.list=originalList;
  await run("document.querySelector('#start').click()");await until("state.tab==='race'&&!!live?.engine");
  const track=await run('return state.race.track');assert.deepEqual(track.trackDesign,savedDesign);assert.deepEqual(track.laneLengths,[20,21]);
  assert.equal(await run('return live.engine().cars.length'),2);assert.equal(await run('return live.engine().cars[1].driverName'),'Driver 204');
  assert.deepEqual(await run('return qaErrors'),[]);
  fs.writeFileSync(path.join(out,'race.png'),(await win.webContents.capturePage()).toPNG());
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,themes,profile,minimumViewport,checks:['all 205 driver choices','no full collection reads for reference entities on Home','only selected image set','visible card photos only','Paddock archived choice','team member selectors','stale launch rejected','late launch cancelled after navigation','full Circuit geometry at race startup','two-driver engine']},null,2));clearTimeout(timer);app.exit(0);
 }catch(error){console.error(error);fs.writeFileSync(path.join(out,'failure.png'),(await win.webContents.capturePage()).toPNG());clearTimeout(timer);app.exit(1);}
});});seed.writesIdle().then(()=>require('../../main')).catch(error=>{console.error(error);app.exit(1);});
