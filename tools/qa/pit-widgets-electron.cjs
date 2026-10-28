const {app}=require('electron'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../../../outputs/pit-widgets');fs.mkdirSync(out,{recursive:true});
app.setPath('appData',path.resolve(__dirname,'../../.tmp-test/pit-widgets-'+process.pid));app.disableHardwareAcceleration();
let done=false;const wait=ms=>new Promise(r=>setTimeout(r,ms));setTimeout(()=>app.exit(2),120000).unref();
app.on('browser-window-created',(_,win)=>win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
 const settle=async()=>{await run('await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));');await wait(100);};
 try{
  win.setMinimumSize(0,0);win.setContentSize(1200,900);win.showInactive();await wait(400);
  await run(`window.pitErrors=[];addEventListener('error',e=>pitErrors.push(e.message));
   window.pitFixture=RaceEngine.createRace({type:'timed',duration:60,firstLap:'count',minLap:100,entries:['Alex','Jamie','Morgan','Sam'].map((driverName,lane)=>({lane,driverId:'pit-'+lane,driverName,tyre:'S'})),fuel:{on:true,tank:100,perLap:1,rate:20,pitHold:1000,empty:'warn'},penalty:{on:true,perPoint:5},damage:Damage.clean(Damage.defaults()),tyrewear:TyreWear.clean({})});pitFixture.start(0);
   pitFixture.addDamage(0,3,221000);pitFixture.cars[1].pending.push({kind:'stopgo',name:'Stop & go',seconds:8});pitFixture.events.push({type:'assigned',car:1,lane:1,driverName:'Jamie',raceMs:225000,name:'8-second stop & go'});pitFixture.cars[3].twLife=18;pitFixture.cross(3,230000);pitFixture.setFlag('yellow',266000);pitFixture.cars[2].fuel=12;pitFixture.tick(269000);
   window.pitLayout={name:'Pit Stops overview',ratioW:10,ratioH:7,widgets:['needsattention','recentevents'].map((type,i)=>({...Widgets.newWidget(type,0,20+i*490,35),w:470,h:600,typography:{mode:'auto'},appearance:{radiusPixels:14,fill:'gradient',source:'theme',gradientSource:'custom',gradientColor:i?'#65bde6':'#35bba2',gradientOpacity:12,angle:160}})),guides:{v:[],h:[]}};
   window.pitState={...WidgetPreview.state({},{layout:pitLayout}),eng:pitFixture,now:272000,phase:'running',carByLane:lane=>pitFixture.cars.find(c=>c.lane===lane),rowOf:c=>pitFixture.standings().find(r=>r.car===c)};
   state.tab='custom';state.customSub='layouts';state.sideOpen=new Set(['opts']);state.editing={id:null,draft:pitLayout,sel:[pitLayout.widgets[0]],snap:true,dirty:true,drivers:[],cars:[],teams:[],customWidgets:[],imageSets:[],rowDesigns:[],chartDesigns:[]};await render();await document.fonts.ready;fitEditorWidgets();
   for(const type of ['needsattention','recentevents']){const b=document.querySelector('[data-add="'+type+'"]');if(!b||b.closest('details').querySelector('summary').textContent!=='Pit Stops')throw Error('Palette folder '+type);}
   const saved=await api.add('layouts',pitLayout),loaded=(await api.list('layouts')).find(l=>l.id===saved.id);if(JSON.stringify(saved.widgets)!==JSON.stringify(loaded.widgets))throw Error('Layout save/reopen changed widget settings');
  `);
  fs.writeFileSync(path.join(out,'editor.png'),(await win.webContents.capturePage()).toPNG());
  await run('window.pitLive=LiveCanvas.fullView(pitLayout,4);LiveCanvas.paint(pitLive.nodes,pitState);');
  const reports=[];
  for(const [theme,width]of [['dark',1200],['light',1200],['ocean',1200],['dark',600]]){
   win.setContentSize(width,900);await run(`document.documentElement.dataset.theme='${theme}';pitLive.nodes.resize();LiveCanvas.paint(pitLive.nodes,pitState);await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));`);await wait(150);
   const report=await run(`return {theme:'${theme}',width:${width},errors:pitErrors,widgets:pitLive.nodes.map(n=>({type:n.w.type,status:n.el.dataset.fitStatus,visible:[...n.val.querySelectorAll('.pcw-row')].filter(r=>!r.hidden).length,fits:Frame.textFits(n.val),font:parseFloat(getComputedStyle(n.val).fontSize),error:n.error||null}))};`);
   assert.deepEqual(report.errors,[]);for(const w of report.widgets){assert.equal(w.error,null);assert(w.visible>0);assert(w.fits,JSON.stringify(w));assert.equal(w.status,'fits');assert(w.font>=14);}reports.push(report);
   fs.writeFileSync(path.join(out,theme+'-'+width+'.png'),(await win.webContents.capturePage()).toPNG());
  }
  await run(`pitLayout.widgets.forEach(w=>w.h=260);pitLive.close();pitLive=LiveCanvas.fullView(pitLayout,4);LiveCanvas.paint(pitLive.nodes,pitState);pitLive.nodes.resize();`);
  const compact=await run(`return pitLive.nodes.map(n=>({fits:Frame.textFits(n.val),hidden:n.val.querySelectorAll('.pcw-row[hidden]').length,more:n.val.querySelector('.pcw-more').hidden}));`);
  assert(compact.every(n=>n.fits&&n.hidden>0&&!n.more));reports.push({compact});fs.writeFileSync(path.join(out,'compact-600.png'),(await win.webContents.capturePage()).toPNG());
  await run(`pitLayout.widgets[0].opt={lanes:'2',showdamage:false};pitLayout.widgets[1].opt={lanes:'0',showfuel:false};pitLive.close();pitLive=LiveCanvas.fullView(pitLayout,4);LiveCanvas.paint(pitLive.nodes,pitState);`);
  const filtered=await run(`return pitLive.nodes.map(n=>n.val.textContent);`);assert(filtered[0].includes('Morgan'));assert(!filtered[0].includes('Alex'));assert(filtered[1].includes('Alex'));assert(!filtered[1].includes('Morgan'));
  await run(`pitFixture.cars[2].fuel=100;LiveCanvas.paint(pitLive.nodes,pitState);`);assert(!(await run('return pitLive.nodes[0].val.textContent;')).includes('Low fuel'));
  // Manual title/value settings must remain independent, including after a refit.
  win.setContentSize(1200,900);
  await run(`pitLayout.widgets.forEach(w=>{w.w=470;w.h=520;w.valueAlign='right';w.typography={mode:'manual',valueSize:24,titleSize:46,shrink:true};w.opt={};});pitLive.close();pitLive=LiveCanvas.fullView(pitLayout,4);LiveCanvas.paint(pitLive.nodes,pitState);pitLive.nodes.resize();`);
  await settle();
  const manual=await run(`return pitLive.nodes.map(n=>({fits:Frame.textFits(n.val)&&n.val.querySelector('.pcw').getBoundingClientRect().bottom<=n.val.getBoundingClientRect().bottom+1,titleBottom:n.el.querySelector('.lw-title').getBoundingClientRect().bottom,bodyTop:n.val.querySelector('.pcw-meta').getBoundingClientRect().top,align:getComputedStyle(n.val.querySelector('.pcw-message')).textAlign}));`);
  assert(manual.every(n=>n.fits&&n.bodyTop>n.titleBottom&&n.align==='right'),JSON.stringify(manual));reports.push({manual});
  fs.writeFileSync(path.join(out,'audit-manual-titles.png'),(await win.webContents.capturePage()).toPNG());
  // Extreme compact frames retain a truthful count instead of overflowing one long row.
  await run(`pitLayout.widgets.forEach(w=>{w.h=125;w.typography={mode:'auto'};w.valueAlign='left';});pitFixture.cars[0].driverName='A driver with a deliberately very long display name';pitLive.close();pitLive=LiveCanvas.fullView(pitLayout,4);LiveCanvas.paint(pitLive.nodes,pitState);pitLive.nodes.resize();`);
  await settle();
  const tiny=await run(`return pitLive.nodes.map(n=>({fits:Frame.textFits(n.val),more:n.val.querySelector('.pcw-more').textContent,status:n.el.dataset.fitStatus}));`);
  assert(tiny.every(n=>n.fits&&n.status==='fits'),JSON.stringify(tiny));reports.push({tiny});
  fs.writeFileSync(path.join(out,'audit-tiny.png'),(await win.webContents.capturePage()).toPNG());
  // The added integration rows use the actual engine, including serialized viewer data.
  await run(`const resources=Resources.prepare({id:'qa',...Resources.clean({owner:'driver',tyresOn:false,repairsOn:true,repairs:0})},{runId:'qa'});
   pitFixture=RaceEngine.createRace({type:'timed',duration:60,minLap:100,entries:[{lane:0,driverId:'a',driverName:'Alex',tyre:'M'},{lane:1,driverId:'b',driverName:'Jamie',tyre:'M',roster:[{id:'b',name:'Jamie'},{id:'relief',name:'Relief'}]}],fuel:{on:true,tank:100,rate:10,perLap:1,pitHold:1000},resources,damage:Damage.clean({levels:[{name:'Body damage',from:1,seconds:2,action:'repair'}]}),weather:Wx.clean({startMode:'manual'}),tyrewear:TyreWear.clean({mandStops:1,tempOn:'on'}),endurance:Endurance.clean({sessionType:'endurance',swapUnit:'laps',swapEvery:2,swapGrace:1,swapConfirm:'button',swapLate:'stop'})});pitFixture.start(0);pitFixture.addDamage(0,1,1000);pitFixture.block(0,2000);pitFixture.tick(3000);pitFixture.cross(1,2000);pitFixture.cross(1,4000);pitFixture.tick(7000);pitFixture.wxSet('wet',8000);pitFixture.cars[1].twTemp=150;pitFixture.cars[1].twTempAt=8000;
   pitState={...pitState,eng:pitFixture,now:8000,carByLane:lane=>pitFixture.cars.find(c=>c.lane===lane)};pitLayout.widgets.forEach(w=>{w.h=620;w.opt={maxItems:10};});pitLive.close();pitLive=LiveCanvas.fullView(pitLayout,2);LiveCanvas.paint(pitLive.nodes,pitState);pitLive.nodes.resize();`);
  await settle();
  const systems=await run(`return pitLive.nodes.map(n=>({fits:Frame.textFits(n.val),text:n.val.innerText}));`);
  assert(systems.every(n=>n.fits));assert(systems[0].text.includes('resources exhausted'));assert(systems[0].text.includes('Driver swap overdue'));reports.push({systems});
  fs.writeFileSync(path.join(out,'audit-systems.png'),(await win.webContents.capturePage()).toPNG());
  await run(`pitLive.close();pitLayout.widgets=[{...Widgets.newWidget('textrace',0,20,35),w:960,h:620,showTitle:false,opt:{composition:WidgetCompose.clean({root:{id:'root',kind:'free',children:['needsattention','recentevents'].map((component,i)=>({id:'part'+i,kind:'component',component,options:{lanes:'0',maxItems:4},frame:{x:i*50,y:0,w:48,h:100}}))}})}}];pitLive=LiveCanvas.fullView(pitLayout,2);LiveCanvas.paint(pitLive.nodes,pitState);pitLive.nodes.resize();`);
  await settle();
  const composed=await run(`return [...pitLive.nodes[0].val.querySelectorAll('.wc-standard')].map(el=>({fits:Frame.textFits(el.querySelector('.lw-val')),text:el.innerText}));`);
  assert.equal(composed.length,2);assert(composed.every(c=>c.fits&&!c.text.includes('Jamie')));reports.push({composed});
  fs.writeFileSync(path.join(out,'audit-builder-components.png'),(await win.webContents.capturePage()).toPNG());
  fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(reports,null,2));console.log('PIT WIDGETS ELECTRON PASS: palette, save/reopen, real editor/live, independent filters, resolved alerts, dark/light/Ocean and 600px sizing.');app.exit(0);
 }catch(e){console.error(e.stack);if(!win.isDestroyed())try{fs.writeFileSync(path.join(out,'failure.png'),(await win.webContents.capturePage()).toPNG());}catch{}app.exit(1);}
}));require('../../main.js');
