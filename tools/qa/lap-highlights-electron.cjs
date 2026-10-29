const {app}=require('electron'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../../../outputs/lap-highlights-implementation');fs.mkdirSync(out,{recursive:true});
app.setPath('appData',path.resolve(__dirname,'../../.tmp-test/lap-highlights-'+process.pid));app.disableHardwareAcceleration();
const wait=ms=>new Promise(r=>setTimeout(r,ms));let done=false;setTimeout(()=>app.exit(2),120000).unref();
app.on('browser-window-created',(_,win)=>win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
 const capture=async name=>{await wait(80);fs.writeFileSync(path.join(out,name+'.png'),(await win.webContents.capturePage()).toPNG());};
 try{
  win.setMinimumSize(0,0);win.setContentSize(1280,900);win.showInactive();await wait(350);
  await run(`window.lapErrors=[];addEventListener('error',e=>lapErrors.push(e.message));window.ck=(v,m)=>{if(!v)throw Error(m)};
   state.tab='custom';state.customSub='layouts';state.sideOpen=new Set(['status']);
   const w={...Widgets.newWidget('name',0,20,20),w:500,h:180};
   state.editing={id:null,draft:{name:'Lap Highlights QA',ratioW:10,ratioH:6,widgets:[w],guides:{v:[],h:[]}},sel:[w],snap:false,dirty:true,drivers:[],cars:[],teams:[],customWidgets:[],imageSets:[],rowDesigns:[],chartDesigns:[]};await render();
   window.setLap=(key,value)=>{const el=document.querySelector('#side [data-key="'+key+'"]');ck(el,'Missing setting '+key);if(el.type==='checkbox')el.checked=value;else el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));};
   setLap('lapIntensity',35);setLap('lapDuration',1050);setLap('lapSource','lane');setLap('lapKeepRecords',true);setLap('lapPbColor','#24cc78');
   document.querySelector('#side [data-lap-preview="pb"]').click();ck(document.querySelector('.lap-settings-preview .lap-highlight'),'Preview works');
   const saved=await api.add('layouts',state.editing.draft),loaded=(await api.list('layouts')).find(x=>x.id===saved.id);ck(loaded.widgets[0].appearance.lapDuration===1050,'Round trip duration');ck(loaded.widgets[0].appearance.lapPbColor==='#24cc78','Round trip colour');
   document.getElementById('e-appearance').click();ck(document.querySelector('#dlg [data-key="lapEnabled"]')||document.querySelector('dialog [data-key="lapEnabled"]'),'Layout defaults contain controls');document.querySelector('dialog[open]').close();
  `);await capture('editor');
  await run(`
   window.lapEngine=RaceEngine.createRace({type:'race',skipFirst:true,laps:100,entries:[{lane:0,driverId:'a',driverName:'James',carName:'NSR Mosler MT900R'},{lane:1,driverId:'b',driverName:'Bjornie',carName:'NSR Corvette C8.R'}],fuel:{on:true,tank:100,perLap:2,rate:10}});lapEngine.start(0);lapEngine.cross(0,1000);lapEngine.cross(1,1000);
   window.lapBase={personal:new Map([['a',9000],['b',9500]]),track:8000};window.lapLive={flash:new Map(),bestBy:new Map(),bestAll:Infinity};window.lapNow=1000;
   window.lapLayout={name:'Lap Highlights',ratioW:10,ratioH:6,widgets:[],widgetAppearance:{lapDuration:1050,lapIntensity:35},laneColors:[{bg:'#2f9fc5'},{bg:'#e1b836'}]};
   ['aiolane','laptime','bestlap','fuel'].forEach((type,i)=>{for(let lane=0;lane<2;lane++)lapLayout.widgets.push({...Widgets.newWidget(type,lane,15+i*245,20+lane*190),w:230,h:170,appearance:{source:'theme',border:'shade',accent:'lane',edge:'left',radiusPixels:14},opt:type==='fuel'?{barStyle:'digital'}:{}});});
   lapLayout.widgets.push({...Widgets.newWidget('leaderboard',-1,15,410),w:725,h:170},{...Widgets.newWidget('clock',-1,755,410),w:230,h:170});
   window.lapCtx=()=>({raceId:'highlight-qa',eng:lapEngine,layout:lapLayout,setup:{sessionType:'race',laps:100},track:{},lanes:2,base:lapBase,now:lapNow,phase:'running',...lapLive});
   window.lapState=()=>LiveShare.makeShared(lapCtx());window.lapFull=LiveCanvas.fullView(lapLayout,2);LiveCanvas.paint(lapFull.nodes,lapState());
   window.hit=(time)=>{const c=lapEngine.cars[0],before=c.laps.length;lapNow=time;lapEngine.cross(0,time);LapHighlights.record(c,before,lapLive,lapBase,time);LiveCanvas.paint(lapFull.nodes,lapState());};
   window.freeze=()=>document.getAnimations().forEach(a=>{a.pause();a.currentTime=126;});
   window.assertPulse=()=>{ck(lapFull.nodes.filter(n=>n.w.lane===0).every(n=>n.el.querySelector('.lap-highlight')),'Every lane widget pulses');ck(lapFull.nodes.filter(n=>n.w.lane===1).every(n=>!n.el.querySelector('.lap-highlight')),'Other lane steady');ck(!lapFull.nodes.at(-1).el.querySelector('.lap-highlight'),'Global clock steady');ck(lapFull.nodes.find(n=>n.w.type==='leaderboard').el.querySelector('[data-lap-lane="0"] .lap-highlight'),'Correct leaderboard row');};
   hit(11000);assertPulse();freeze();ck(lapLive.flash.get(lapEngine.cars[0]).kind==='','Ordinary lap');
   const el=lapFull.nodes[0].el,content=lapFull.nodes[0].val.firstChild,animation=el.querySelector('.lap-highlight').getAnimations()[0];LiveCanvas.paint(lapFull.nodes,lapState());ck(el.querySelector('.lap-highlight').getAnimations()[0]===animation,'Unchanged frame does not restart animation');ck(lapFull.nodes[0].val.firstChild===content,'Unchanged content retained');
  `);await capture('lap-recorded');
  await run(`hit(19500);assertPulse();freeze();ck(lapLive.flash.get(lapEngine.cars[0]).kind==='pb','Personal best');`);await capture('personal-best');
  const themes=await run(`return Theme.THEMES.filter(t=>t[0]!=='custom').map(t=>t[0]);`);
  for(const theme of themes){await run(`state.settings.theme='${theme}';applyTheme();hit(lapNow+${7500-themes.indexOf(theme)*50});freeze();ck(lapLive.flash.get(lapEngine.cars[0]).kind==='record','Record priority');`);await capture('record-'+theme);}
  await run(`
   const host=document.createElement('div');host.className='canvas';host.style.cssText='position:fixed;left:20px;top:20px;width:500px;height:180px;z-index:999999';document.body.append(host);
   const custom={...Widgets.newWidget('textlane',0,0,0),w:1000,h:360,opt:{composition:WidgetCompose.template('timing')},appearance:{source:'custom',baseColor:'#ffffff',fill:'gradient',gradientSource:'lane',lapSource:'lane',lapKeepRecords:false,lapAppearance:'glow',radiusPixels:14}};
   const layout={ratioW:1000,ratioH:360,laneColors:lapLayout.laneColors,widgets:[custom]};const nodes=LiveCanvas.build(host,layout,2,{maxH:0});LiveCanvas.paint(nodes,lapState());const n=nodes[0],rect=n.el.getBoundingClientRect(),background=n.el.style.background,html=n.val.innerHTML;
   hit(lapNow+9000);LiveCanvas.paint(nodes,lapState());ck(n.el.querySelector('.lap-highlight-glow'),'Builder composition pulses');ck(!n.el.querySelector('.lap-highlight-surface'),'Glow only');ck(n.el.style.background===background&&n.el.getBoundingClientRect().width===rect.width,'Gradient and dimensions preserved');ck(n.el.querySelector('.lap-highlight').style.getPropertyValue('--lap-flash')==='#2f9fc5','Lane colour override');
   const animation=n.el.querySelector('.lap-highlight').getAnimations()[0];for(let i=0;i<100;i++)LiveCanvas.paint(nodes,lapState());ck(n.el.querySelector('.lap-highlight').getAnimations()[0]===animation,'100 paints do not restart pulse');
   LiveCanvas.dispose(nodes);host.remove();
   window.viewer=LiveShare.viewer();viewer.feedStatic(LiveShare.packStatic(lapCtx()));viewer.feedDynamic(LiveShare.packDynamic(lapCtx()),performance.now());
   window.viewerNode={w:{type:'name',lane:0},layout:lapLayout,el:document.createElement('div'),val:document.createElement('span')};document.body.append(viewerNode.el);LapHighlights.update(viewerNode,viewer.shared(performance.now()));ck(!viewerNode.el.querySelector('.lap-highlight'),'Late viewer does not replay old event');
   hit(lapNow+7000);viewer.feedDynamic(LiveShare.packDynamic(lapCtx()),performance.now());LapHighlights.update(viewerNode,viewer.shared(performance.now()));ck(viewerNode.el.querySelector('.lap-highlight'),'New shared event pulses on viewer');LapHighlights.dispose(viewerNode);viewerNode.el.remove();
   const c=lapEngine.cars[0];c.redInterrupted=true;hit(lapNow+2000);ck(lapLive.flash.get(c).kind==='','Interrupted lap cannot be record');ck(lapLive.bestAll===7000,'Interrupted lap does not corrupt record');
   lapLayout.widgets[0].appearance.lapEnabled=false;hit(lapNow+9000);ck(!lapFull.nodes[0].lapActive.size,'Disabled override');
   for(const n of lapFull.nodes)LapHighlights.dispose(n);LiveCanvas.paint(lapFull.nodes,lapState());ck(lapFull.nodes.every(n=>!n.el.querySelector('.lap-highlight')),'Dispose clears overlays');
   lapFull.close();
  `);
  assert.deepEqual(await run('return lapErrors;'),[]);
  fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({passed:true,themes,checks:['Editor controls','Save/reopen','Layout defaults','All-in-One and scalar widgets','Fuel semantics','Lane isolation','Leaderboard row','Global exclusion','No repaint/restart','Late viewer and fresh shared event','Red-flag invalidity','Off override','Disposal']},null,2));
  console.log('LAP HIGHLIGHTS ELECTRON PASSED');app.quit();
 }catch(e){console.error(e);await capture('failure');app.exit(1);}
}));require('../../main');
