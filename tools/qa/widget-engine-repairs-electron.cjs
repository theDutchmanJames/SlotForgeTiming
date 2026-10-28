const {app,BrowserWindow}=require('electron'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const out=path.resolve(process.argv[2]||path.join(__dirname,'../../../outputs/widget-engine-repairs'));fs.mkdirSync(out,{recursive:true});
app.setPath('appData',path.resolve(__dirname,'../../.tmp-test/widget-engine-'+process.pid));app.disableHardwareAcceleration();
let done=false;const wait=ms=>new Promise(r=>setTimeout(r,ms));setTimeout(()=>app.exit(2),180000).unref();
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
 const capture=async w=>{for(let i=0;i<3;i++){try{return await w.webContents.capturePage();}catch(e){if(i===2)throw e;await wait(300);}}};
 const shot=async name=>fs.writeFileSync(path.join(out,name+'.png'),(await capture(win)).toPNG());
 try{
  await wait(350);win.setMinimumSize(0,0);win.setContentSize(1200,900);
  await run(`window.qaErrors=[];addEventListener('error',e=>qaErrors.push(e.message));`);
  const result=await run(fs.readFileSync(path.join(__dirname,'widget-engine-repairs-probe.js'),'utf8'));
  fs.writeFileSync(path.join(out,'electron-regressions.json'),JSON.stringify(result,null,2));assert.deepEqual(result.failures,[]);
  const geometry=await run(fs.readFileSync(path.join(__dirname,'widget-scaling-probe.js'),'utf8'));
  fs.writeFileSync(path.join(out,'geometry-tests.json'),JSON.stringify(geometry,null,2));assert.deepEqual(geometry.failures,[]);
  // Save/reopen both generations through the real app database. Open the real Layout Editor.
  await run(`window.qaDesign={name:'Widget engine verification',ratioW:10,ratioH:7,guides:{v:[],h:[]},widgets:[
   {...Widgets.newWidget('lastlap',0,20,20),w:300,h:240,opt:{columns:2,lapsPerColumn:7}},
   {...Widgets.newWidget('tyrelife',0,340,20),w:260,h:240},
   {...Widgets.newWidget('pace',1,620,20),w:360,h:240,opt:{look:'gauge'}},
   {...Widgets.newWidget('aiotiming',0,20,280),w:580,h:180},
   {...Widgets.newWidget('clock',0,620,280),w:360,h:180,opt:{style:'digital'}},
   {...Widgets.newWidget('textlane',0,20,480),w:580,h:200,opt:{composition:WidgetCompose.clean({root:{kind:'component',component:'lastlap',options:{columns:2,lapsPerColumn:3}}})}},
   {...Widgets.newWidget('bestlap',1,620,480),w:360,h:200}
  ].map(w=>({...w,typography:{mode:'auto'},fonts:{value:'highvis'}})),widgetAppearance:{source:'theme',accent:'lane',edge:'left',radiusPixels:14}};
  window.qaSaved=await api.add('layouts',qaDesign);const reopened=(await api.list('layouts')).find(l=>l.id===qaSaved.id);if(JSON.stringify(reopened.widgets)!==JSON.stringify(qaDesign.widgets))throw Error('Modern layout changed on save');
  const legacy={...qaDesign,name:'Legacy layout',widgetAppearance:undefined,widgetRadius:14,laneColorStyle:'side',widgets:qaDesign.widgets.map(w=>({...w,titleSpace:true}))};const saved=await api.add('layouts',legacy);if(JSON.stringify((await api.list('layouts')).find(l=>l.id===saved.id).widgets)!==JSON.stringify(legacy.widgets))throw Error('Legacy layout changed on save');
  state.editing=null;state.tab='custom';state.customSub='layouts';await render();state.editing={id:qaSaved.id,draft:structuredClone(qaSaved),sel:[],snap:true,dirty:false,drivers:[],cars:[],teams:[],customWidgets:[],imageSets:[],rowDesigns:[],chartDesigns:[]};await render();await document.fonts.ready;fitEditorWidgets();`);
  for(const width of [1200,600]){win.setContentSize(width,950);await wait(200);await run(`document.querySelector('#canvas').scrollIntoView({block:'center'});fitEditorWidgets();`);await wait(100);await shot('editor-'+width);}
  // Same production renderer used by the main screen and Live Race viewer.
  for(const [width,theme]of [[1920,'dark'],[1200,'light'],[600,'ocean']]){
   win.setContentSize(width,900);await run(`window.qaView?.close();document.documentElement.dataset.theme='${theme}';window.qaView=LiveCanvas.fullView(qaDesign,2);const content=Timing.content,samples=new Map(qaDesign.widgets.map(w=>[w.id,{html:Widgets.sampleOf(Widgets.def(w.type),w.lane,w)}]));try{Timing.content=w=>samples.get(w.id);LiveCanvas.paint(qaView.nodes,{});}finally{Timing.content=content;}await document.fonts.ready;qaView.nodes.resize();`);await wait(250);await shot('live-'+width+'-'+theme);
   const boxes=await run(`return qaView.nodes.map(n=>({type:n.w.type,error:n.error||null,status:n.el.dataset.fitStatus||'specialised',box:n.el.getBoundingClientRect().toJSON()}));`);fs.writeFileSync(path.join(out,'live-'+width+'.json'),JSON.stringify(boxes,null,2));assert(boxes.every(b=>!b.error));
  }
  await run(`qaView.close();
  const eng=RaceEngine.createRace({type:'race',laps:100,minLap:100,firstLap:'count',fuel:{on:true,tank:100,perLap:2,rate:2,empty:'warn'},tyrewear:TyreWear.clean({}),pushsave:PushSave.clean(PushSave.defaults()),entries:[{lane:0,driverName:'James',carName:'NSR Mosler MT900R'},{lane:1,driverName:'Bjornie',carName:'NSR Corvette'}]});eng.start(0);for(let i=1;i<=15;i++){eng.cross(0,i*8000);eng.cross(1,i*8100);}eng.pause(123000);
  window.qaRace={raceId:'renderer-qa',title:'Widget engine verification',eng,now:123000,phase:'paused',layout:qaDesign,lanes:2,setup:{sessionType:'race',laps:100},track:{name:'Slotrace Circuit',lanes:2},base:{personal:new Map(),track:Infinity},flash:new Map(),bestBy:new Map(),bestAll:Infinity};
  api.liveStatic(LiveShare.packStatic(qaRace));api.livePush(LiveShare.packDynamic(qaRace));await api.liveOpen();`);
  let second;for(let i=0;i<80;i++){second=BrowserWindow.getAllWindows().find(w=>w!==win&&w.webContents.getURL().endsWith('#live'));if(second&&!second.webContents.isLoading())break;await wait(50);}
  assert(second,'actual second-screen window opened');second.setMinimumSize(0,0);second.setContentSize(1200,900);await wait(200);
  await second.webContents.executeJavaScript(`LiveView.go('timing');`);await wait(200);
  assert(await second.webContents.executeJavaScript(`LiveView.nodes().length===7&&LiveView.nodes().every(n=>!n.error)&&!!document.querySelector('.twbox2')&&!!document.querySelector('.psgauge')`),'actual second-screen widgets render shared race snapshot');
  fs.writeFileSync(path.join(out,'second-display-1200.png'),(await capture(second)).toPNG());
  assert(await second.webContents.executeJavaScript(`(()=>{const nodes=LiveView.nodes();LiveView.go('tiles');return nodes.disposed&&nodes.every(n=>n.disposed);})()`),'second-screen navigation disposes widgets');
  second.close();assert.deepEqual(await run('return qaErrors;'),[]);
  console.log('WIDGET ENGINE ELECTRON PASS: '+result.checks+' lifecycle/adapter/performance checks, '+geometry.checks+' geometry checks, persisted legacy/modern layouts, editor/live captures');app.exit(0);
 }catch(e){console.error(e);try{await shot('failure');}catch{}app.exit(1);}
});});require('../../main.js');
