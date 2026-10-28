// Production editor/live renderers with an isolated profile and synthetic fuel states.
const {app}=require('electron'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../../../outputs/fuel-colours');fs.mkdirSync(out,{recursive:true});
app.setPath('appData',path.resolve(__dirname,'../../.tmp-test/fuel-colours-'+process.pid));app.disableHardwareAcceleration();
let done=false;const wait=ms=>new Promise(r=>setTimeout(r,ms));setTimeout(()=>app.exit(2),90000).unref();
app.on('browser-window-created',(_,win)=>win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;win.hide();console.log('Fuel QA: app loaded');
 const run=s=>win.webContents.executeJavaScript('(async()=>{'+s+'})()');
 try{
  await wait(400);win.setMinimumSize(0,0);win.setContentSize(1200,820);win.showInactive();
  await run(`window.fuelErrors=[];addEventListener('error',e=>fuelErrors.push(e.message));
   window.fuelLevels=[100,75,50,25,17,5];
   window.fuelRace=RaceEngine.createRace({type:'race',laps:100,entries:fuelLevels.map((_,lane)=>({lane,driverId:'fuel-'+lane,driverName:'Driver '+(lane+1)})),fuel:{on:true,tank:100,perLap:1,rate:10,pitHold:1000,empty:'warn'}});fuelRace.start(0);fuelRace.cars.forEach((c,i)=>c.fuel=fuelLevels[i]);
   window.fuelLayout={name:'Fuel quantity colour verification',ratioW:16,ratioH:9,widgets:fuelLevels.map((pct,i)=>({...Widgets.newWidget('fuel',i,25+(i%3)*325,35+Math.floor(i/3)*250),w:300,h:210,title:'Fuel · '+pct+'%',showTitle:true,laneColorStyle:'none',bgColor:'#242c34',textColor:'#f0f0ed',opt:{mode:'both'}})),guides:{v:[],h:[]}};
   window.fuelState={...WidgetPreview.state({},{layout:fuelLayout}),eng:fuelRace,now:0,phase:'running',setup:{sessionType:'race',laps:100},carByLane:lane=>fuelRace.cars.find(c=>c.lane===lane),rowOf:c=>fuelRace.standings().find(r=>r.car===c)};
   state.tab='custom';state.customSub='layouts';state.editing={id:null,draft:fuelLayout,sel:[],snap:true,dirty:false,drivers:[],cars:[],teams:[],customWidgets:[],imageSets:[],rowDesigns:[],chartDesigns:[]};await render();await document.fonts.ready;fitEditorWidgets();
   if(!document.querySelector('#canvas .ffill'))throw Error('Editor fuel preview missing');
   window.fuelLive=LiveCanvas.fullView(fuelLayout,6);LiveCanvas.paint(fuelLive.nodes,fuelState);
  `);
  console.log('Fuel QA: editor and live ready');const checks=[];
  for(const theme of ['dark','light','ocean']){
   await run(`document.documentElement.dataset.theme='${theme}';document.documentElement.style.setProperty('--accent','#f28a20');fuelLive.nodes.resize();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));`);await wait(350);
   const data=await run(`return {accent:getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),bars:fuelLive.nodes.map(n=>{const f=n.el.querySelector('.ffill');return {colour:getComputedStyle(f).backgroundColor,width:f.getBoundingClientRect().width/ f.parentElement.getBoundingClientRect().width,text:n.el.querySelector('.ftxt')?.textContent};}),errors:fuelErrors};`);
   assert.equal(data.accent,'#f28a20');assert.equal(data.bars[0].colour,'rgb(47, 184, 106)');assert.equal(data.bars[3].colour,'rgb(255, 212, 0)');assert.equal(data.bars[5].colour,'rgb(214, 40, 40)');assert.equal(new Set(data.bars.map(b=>b.colour)).size,6);
   data.bars.forEach((b,i)=>{assert(Math.abs(b.width-fuelLevelsForTest[i]/100)<.015);assert.equal(b.text,fuelLevelsForTest[i]+' L');});assert.deepEqual(data.errors,[]);
   checks.push({theme,...data});fs.writeFileSync(path.join(out,theme+'-orange.png'),(await win.webContents.capturePage()).toPNG());
  }
  await run(`fuelLayout.widgets.forEach(w=>{w.opt.dir='vertical';});fuelLive.close();fuelLive=LiveCanvas.fullView(fuelLayout,6);LiveCanvas.paint(fuelLive.nodes,fuelState);fuelLive.nodes.resize();`);await wait(350);
  const vertical=await run(`return fuelLive.nodes.map(n=>{const f=n.el.querySelector('.ffill');return {colour:getComputedStyle(f).backgroundColor,fill:f.getBoundingClientRect().height/f.parentElement.getBoundingClientRect().height};});`);
  vertical.forEach((b,i)=>{assert.equal(b.colour,checks[0].bars[i].colour);assert(Math.abs(b.fill-fuelLevelsForTest[i]/100)<.015);});
  fs.writeFileSync(path.join(out,'vertical-orange.png'),(await win.webContents.capturePage()).toPNG());
  fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({checks,vertical},null,2));
  console.log('FUEL COLOURS ELECTRON PASS: actual editor/live; six fuel levels; dark, light and Ocean with orange accent; horizontal/vertical.');app.exit(0);
 }catch(e){console.error(e.stack);if(!win.isDestroyed())try{fs.writeFileSync(path.join(out,'failure.png'),(await win.webContents.capturePage()).toPNG());}catch{}app.exit(1);}
}));
const fuelLevelsForTest=[100,75,50,25,17,5];require('../../main.js');
