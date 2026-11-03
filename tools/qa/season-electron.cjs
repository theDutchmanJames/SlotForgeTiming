// Actual app, generated profile; no personal database or timing hardware.
const {app,nativeImage}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../../../outputs/sqlite-conversion/season-ui');fs.mkdirSync(out,{recursive:true});
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
Object.assign(seed.data.layouts[0],{widgets:require('../../renderer/widgets').defaultLayout().widgets,ratioW:16,ratioH:9});
seed.data.imagesets=[{id:'used',name:'Selected weather',kind:'weather',images:{dry:picture}},{id:'unused',name:'Unselected weather',kind:'weather',images:{dry:picture}}];
seed.data.racesetups=[{id:'setup',name:'Club race',sessionType:'race',track:'t',raceBy:'laps',laps:10,layout:'layout',audioSet:'audio'}];
seed.data.sessions=[{id:'s',date:'2026-11-03',setupName:'Previous race',sessionType:'race',trackId:'t',standings:[{pos:1,driverId:'d1',driverName:'Driver 1',carId:'c',carName:'GT3',laps:1,total:5000,best:5000}]}];
seed.data.laps=[{id:'l',sessionId:'s',trackId:'t',driverId:'d1',carId:'c',time:5000,lane:1,lapNumber:1}];

const W=require('../../renderer/widgets'),Rows=require('../../renderer/rows'),Champ=require('../../renderer/championship');
const w=(type,x,y,width,height,opt={},lane=0)=>({...W.newWidget(type,lane,x,y),w:width,h:height,opt});
seed.data.teams=[{id:'art',name:'SlotForge Team',picture},{id:'unused',name:'Unused Team',picture}];
seed.data.imagesets.push({id:'faces',name:'Race avatars',kind:'avatars',images:{1:picture,2:picture}});
seed.data.rowdesigns=[{...Rows.defaultDesign(),id:'row',name:'Championship row'}];
seed.data.rowdesigns[0].widgets.push(w('avatar',5,5,60,60,{imageSet:'faces'}));
seed.data.rowdesigns[0].widgets[0].x=70;seed.data.rowdesigns[0].widgets[0].w=50;
seed.data.rowdesigns[0].widgets[1].x=125;seed.data.rowdesigns[0].widgets[1].w=40;
seed.data.chartdesigns=[{id:'chart',name:'Race progression',style:'trend',metric:'lap'},{id:'secondary-chart',name:'Track tracker',style:'track'},{id:'unused',name:'Unused'}];
seed.data.layouts[0].widgets=[w('name',10,10,380,65),w('clock',400,10,290,65),w('teampicture',710,10,100,65,{team:'art'}),w('leaderboard',10,90,980,160,{design:'row',countOver:'all'}),w('racechart',10,270,590,225,{chartDesign:'chart'}),w('textlane',620,270,370,225,{composition:{root:{kind:'column',children:[{kind:'component',component:'avatar',options:{imageSet:'faces'},height:100},{kind:'value',key:'laps',label:'Laps driven'}]}}}),w('start',10,505,160,48),w('stop',180,505,160,48)];
seed.data.layouts.push({id:'secondary',name:'Secondary tracker',ratioW:16,ratioH:9,widgets:[w('racechart',10,10,980,540,{chartDesign:'secondary-chart'})]});
seed.data.racesetups[0].layout2='secondary';
seed.data.championships=[Champ.clean({id:'cup',name:'Club Championship',roster:[{driver:'d1'},{driver:'d204'}],rounds:[{id:'r1',name:'Earlier round',sessions:[{id:'s1',setup:'setup',share:100}]},{id:'r2',name:'Today',sessions:[{id:'s2',setup:'setup',share:100}]}]},true)];
seed.data.sessions[0].champ={id:'cup',roundId:'r1',sessionId:'s1',kind:'race',share:100,awarded:'2026-11-01'};
seed.saveNow();
const race={setup:seed.data.racesetups[0],track:seed.data.tracks[0],rows:[{driverId:'d1',carId:'c'},{driverId:'d204',carId:'c2'}],champ:{id:'cup',name:'Club Championship',roundId:'r2',sessionId:'s2',kind:'race',share:100,round:2,session:1}};
let done=false;const wait=ms=>new Promise(r=>setTimeout(r,ms)),timer=setTimeout(()=>app.exit(2),90000);
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
 const until=async exp=>{for(let i=0;i<100;i++){if(await run('return '+exp))return;await wait(50);}throw Error('Timed out: '+exp);};
 try{
  await wait(400);win.setContentSize(1280,960);
  const originalList=Repository.prototype.list,originalSeason=Repository.prototype.raceSeason,originalCharts=Repository.prototype.raceCharts;
  const broad=[],chartReads=[];
  Repository.prototype.list=function(e){if(['laps','sessions','tracks','championships','rowdesigns','chartdesigns','imagesets','teams','drivers'].includes(e)){broad.push(e);throw Error('Unexpected full-list read: '+e);}return originalList.call(this,e);};
  Repository.prototype.raceCharts=function(ids){chartReads.push(ids);return originalCharts.call(this,ids);};
  await run(`window.qaErrors=[];window.qaAlerts=[];window.alert=x=>qaAlerts.push(x);addEventListener('error',e=>qaErrors.push(e.message));addEventListener('unhandledrejection',e=>qaErrors.push(String(e.reason)));const shared=LiveShare.makeShared;LiveShare.makeShared=ctx=>{window.qaShare=ctx;return shared(ctx)};state.settings=await api.setSettings({timingHw:'none'});state.tab='race';state.race=${JSON.stringify(race)};await render()`);
  await until('!!live?.engine&&!!window.qaShare');
  assert.equal(await run('return live.engine().cars.length'),2);
  assert.deepEqual(await run('return qaShare.past'),[{p:0,laps:1,best:5000,valid:[5000],t0:5000,t1:5000,dist:Math.round(require('../../renderer/speed').laneLength(seed.data.tracks[0],0)*1000)/1000}]);
  assert.equal(await run('return qaShare.season.pts[0][2]'),25);
  assert.deepEqual(await run('return qaShare.chartDesigns.map(d=>d.id)'),['chart','secondary-chart']);
  assert.deepEqual(await run('return qaShare.imageSets.map(d=>d.id)'),['faces']);
  await until("[...document.querySelectorAll('#canvas img')].some(i=>i.naturalWidth>0)");
  assert(!(await run("return document.querySelector('#canvas').textContent")).includes('Choose a saved design'));
  await run("const e=live.engine();e.start(100000);e.cross(0,105000);e.cross(1,105200);e.cross(0,110100);e.cross(1,110500);e.cross(0,115050);e.cross(1,115600);e.pause(116000);live.phase='paused';await live.reloadCharts()");chartReads.length=0;
  await until("document.querySelector('#canvas svg')!==null");
  const themes=await run('return Theme.THEMES.map(x=>x[0])');for(const theme of themes){await run(`state.settings.theme=${JSON.stringify(theme)};applyTheme()`);await wait(150);fs.writeFileSync(path.join(out,theme+'.png'),(await win.webContents.capturePage()).toPNG());}
  await run("await api.update('chartdesigns','chart',{name:'Updated live chart',style:'bars'});await live.reloadCharts()");assert.equal(chartReads.length,1);assert.deepEqual(chartReads[0],['chart','secondary-chart']);assert.equal(await run("return qaShare.chartDesigns.find(d=>d.id==='chart').style"),'bars');
  // Secondary viewer uses the same resolved resources and render path.
  assert(await run("const s=LiveShare.makeShared({...qaShare,layout:state.race.setup.layout2});const w={type:'racechart',opt:{chartDesign:'secondary-chart'},chartSize:{width:900,height:450}};return Timing.content(w,s).html.includes('<svg')"));
  // Out-of-order chart refreshes must keep the newest edit.
  let reloads=0;Repository.prototype.raceCharts=function(ids){const rows=originalCharts.call(this,ids);return ++reloads===1?new Promise(resolve=>setTimeout(()=>resolve(rows),180)):rows;};
  await run("window.olderRefresh=live.reloadCharts()");await run("await api.update('chartdesigns','chart',{name:'Newest chart'});await live.reloadCharts();await olderRefresh");assert.equal(await run("return qaShare.chartDesigns.find(d=>d.id==='chart').name"),'Newest chart');
  // A delayed chart edit cannot repaint an obsolete race.
  Repository.prototype.raceCharts=function(ids){return new Promise(resolve=>setTimeout(()=>resolve(originalCharts.call(this,ids)),150));};
  await run("window.oldRace=live;window.pendingChart=live.reloadCharts();live=null;await pendingChart;live=oldRace");Repository.prototype.raceCharts=originalCharts;
  assert.deepEqual(await run('return qaErrors'),[]);assert.deepEqual(await run('return qaAlerts'),[]);assert.deepEqual(broad,[]);
  // Leaving during a championship read must never create a hidden engine.
  await run('live.leave();live.alive=false;live=null;state.race=null');
  let pendingSeason=0;Repository.prototype.raceSeason=function(o){pendingSeason++;return new Promise(resolve=>setTimeout(()=>resolve(originalSeason.call(this,o)),180));};
  await run(`state.race=${JSON.stringify(race)};state.tab='race';window.pendingRace=renderRace()`);for(let i=0;i<100&&!pendingSeason;i++)await wait(10);assert.equal(pendingSeason,1);await run("state.tab='rules';await pendingRace");assert.equal(await run('return live'),null);
  Repository.prototype.raceSeason=()=>{throw Error('Fixture history failure');};
  // Restore list reads for rendering Home after a preparation failure.
  Repository.prototype.list=originalList;
  await run(`state.race=${JSON.stringify(race)};state.tab='race';await renderRace()`);assert.equal(await run('return live'),null);assert.equal(await run('return state.tab'),'home');assert((await run('return qaAlerts.at(-1)')).includes('Fixture history failure'));
  Repository.prototype.raceSeason=originalSeason;
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,themes,profile,checks:['championship totals and 25 prior points','no renderer full-list reads','row images and custom composition','primary and secondary chart dependencies','all themes','selected chart refresh','out-of-order chart refresh preserves newest edit','late chart refresh discarded','late championship response discarded','championship error prevents incomplete race']},null,2));clearTimeout(timer);app.exit(0);
 }catch(error){console.error(error);fs.writeFileSync(path.join(out,'failure.png'),(await win.webContents.capturePage()).toPNG());clearTimeout(timer);app.exit(1);}
});});seed.writesIdle().then(()=>require('../../main')).catch(error=>{console.error(error);app.exit(1);});
