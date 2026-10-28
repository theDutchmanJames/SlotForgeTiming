// Real Electron integration + geometric regression tests. Never uses the user's DB.
const {app}=require('electron'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const output=path.resolve(__dirname,'../../../outputs/widget-scaling-implementation');fs.mkdirSync(output,{recursive:true});
app.setPath('appData',path.resolve(__dirname,'../../.tmp-test/widget-scaling-'+process.pid));app.disableHardwareAcceleration();
let done=false;const wait=ms=>new Promise(r=>setTimeout(r,ms));setTimeout(()=>app.exit(2),120000).unref();
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
 const shot=async name=>fs.writeFileSync(path.join(output,name+'.png'),(await win.webContents.capturePage()).toPNG());
 try{
 await wait(500);win.setMinimumSize(0,0);win.setContentSize(1200,950);
 await run(`window.qaErrors=[];addEventListener('error',e=>qaErrors.push(e.message));window.alert=m=>{throw Error(m);};
 window.qaTrack=await api.add('tracks',{name:'Slotrace Circuit',lanes:2,length:20,minLap:.1});
 window.qaDrivers=await Promise.all(['James','Bjornie'].map(name=>api.add('drivers',{name})));
 window.qaCars=await Promise.all(['Mosler MT900R','Corvette C.08R'].map(model=>api.add('slotcars',{brand:'NSR',model})));
 window.qaProfiles=await Promise.all(['Club-night replay','Personal best challenge'].map((name,i)=>api.add('virtualrivalsystems',{name,trackId:qaTrack.id,trackName:qaTrack.name,recording:Array.from({length:30},(_,j)=>({lap:j+1,time:8000+i*1000})),end:'repeat'})));
 window.qaVirtual=await api.add('drivers',{name:'James — Virtual Rival',driverType:'virtual',virtualRivalSystem:qaProfiles[0].id});
 window.qaSetup=await api.add('racesetups',{name:'Club night',track:qaTrack.id,sessionType:'race',laps:100,endRule:'all',firstLap:'count',startMin:0,startMax:0,startStep:0});
 state.settings=await api.setSettings({lastSetupId:qaSetup.id,timingHw:'none',assignments:{[qaSetup.id]:qaDrivers.map((d,i)=>({driverId:d.id,carId:qaCars[i].id}))}});
 state.tab='home';await render();
 window.qaChange=(selector,value)=>{const e=document.querySelector(selector);if(!e)throw Error('Missing '+selector);e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}));};
 qaChange('#entry-driver',qaVirtual.id);`);await wait(250);
 assert(await run(`return document.querySelectorAll('.hs-lanes .lane').length===3&&!document.querySelector('.vr-home')&&!document.querySelector('#vr-add')&&document.querySelector('[data-vr-profile]').value===''&&!document.querySelector('#start').disabled;`),'unified row loads linked default');
 await run(`qaChange('[data-vr-profile]',qaProfiles[1].id);`);await wait(250);
 assert(await run(`return state.settings.virtualRivals[qaSetup.id][0].profileId===qaProfiles[1].id&&(await api.list('drivers')).find(d=>d.id===qaVirtual.id).virtualRivalSystem===qaProfiles[0].id;`),'override saved without modifying driver');
 await run(`state.tab='database';state.sub='drivers';await render();state.tab='home';await render();`);
 assert(await run(`return document.querySelector('[data-vr-profile]').value===qaProfiles[1].id;`),'reopen preserves override');
 await wait(200);await shot('home-1200');win.setContentSize(600,950);await wait(150);await shot('home-600');
 assert(await run(`return document.documentElement.scrollWidth<=innerWidth+1&&[...document.querySelectorAll('.rival-entry select')].every(e=>e.getBoundingClientRect().right<=innerWidth);`),'narrow Home fits');
 win.setContentSize(1200,950);
 await run(`document.querySelector('#start').click();`);await wait(300);
 assert(await run(`const e=live.engine();return e.cars.length===2&&e.cars.every((c,i)=>c.lane===i)&&e.rivals.length===1&&e.rivals[0].lane===-1&&e.rivals[0].profile.name===qaProfiles[1].name;`),'actual Home Start separates sensors and chosen replay');
 // Exercise the existing engine's new selected replay, then leave the race stopped.
 await run(`const e=live.engine();e.start(100);e.tick(9100);if(e.rivals[0].laps[0]!==9000||e.cars.some(c=>c.laps.length))throw Error('Replay isolation');e.stop(9200);`);
 const result=await run(fs.readFileSync(path.join(__dirname,'widget-scaling-probe.js'),'utf8'));
 fs.writeFileSync(path.join(output,'geometry-tests.json'),JSON.stringify(result,null,2));
 assert.deepEqual(result.failures,[]);assert.deepEqual(await run('return qaErrors;'),[]);
 // Actual Layout Editor, followed by a second width; captures use the same saved design.
 await run(`state.editing=null;state.tab='custom';state.customSub='layouts';await render();
 const widgets=[{...Widgets.newWidget('lastlap',0,15,20),w:300,h:270,opt:{columns:2,lapsPerColumn:7},typography:{mode:'auto'},fonts:{value:'highvis'}},{...Widgets.newWidget('bestlap',0,335,20),w:500,h:200,typography:{mode:'auto'}},{...Widgets.newWidget('tyrelife',0,15,310),w:220,h:220,typography:{mode:'auto'}},{...Widgets.newWidget('pace',1,255,310),w:300,h:220,opt:{look:'gauge'},typography:{mode:'auto'}},{...Widgets.newWidget('tyresets',0,575,310),w:400,h:170,typography:{mode:'auto'}}];
 window.qaLayout=await api.add('layouts',{name:'Shared sizing verification',ratioW:10,ratioH:6,guides:{v:[],h:[]},widgets,widgetAppearance:{source:'theme',accent:'lane',edge:'left',radiusPixels:14}});
 state.editing={id:qaLayout.id,draft:structuredClone(qaLayout),sel:[qaLayout.widgets[0]],snap:true,dirty:false,drivers:[],cars:[],teams:[],customWidgets:[],imageSets:[],rowDesigns:[],chartDesigns:[]};await render();await document.fonts.ready;fitEditorWidgets();`);await wait(250);await shot('editor-1200');
 win.setContentSize(600,950);await wait(250);await run(`document.querySelector('#canvas').scrollIntoView({block:'center'});`);await wait(100);await shot('editor-600');
 console.log('WIDGET SCALING ELECTRON PASS: '+result.checks+' geometry checks + Home selection, persistence and actual race start');app.exit(0);
 }catch(e){console.error(e);try{await shot('failure');}catch{}app.exit(1);}
 });});require('../../main.js');
