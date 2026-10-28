const {app}=require('electron'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const output=path.resolve(__dirname,'../../../outputs/all-in-one');fs.mkdirSync(output,{recursive:true});
app.setPath('appData',path.resolve(__dirname,'../../.tmp-test/all-in-one-'+process.pid));app.disableHardwareAcceleration();
let done=false;const wait=ms=>new Promise(r=>setTimeout(r,ms));setTimeout(()=>app.exit(1),90000).unref();
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
 try{
  await wait(500);win.setMinimumSize(0,0);win.setContentSize(1200,950);win.showInactive();
  await run(`
   window.qaErrors=[];addEventListener('error',e=>qaErrors.push(e.message));window.check=(v,m)=>{if(!v)throw Error(m);};
   const defs=AllInOne.DEFINITIONS,layout={name:'All-in-One QA',ratioW:16,ratioH:9,laneColorStyle:'side',radius:3,guides:{v:[],h:[]},laneColors:[{bg:'#2fafd7',text:'#e8e6e1'}],widgets:defs.map(([type],i)=>Widgets.newWidget(type,0,10+i*10,10+i*10))};
   state.tab='custom';state.customSub='layouts';state.sideOpen=new Set(['opts']);state.editing={id:null,draft:layout,sel:[layout.widgets[2]],snap:true,dirty:true,drivers:[],cars:[],teams:[],customWidgets:[],imageSets:[],rowDesigns:[]};await render();
   for(const [type,label] of defs){const b=document.querySelector('[data-add="'+type+'"]');check(b&&b.textContent===label&&b.closest('details').querySelector('summary').textContent==='All-in-One','palette '+type);}
   const change=(id,value)=>{const el=document.getElementById(id);check(el,id);el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));};
   change('o-preset','compact');check(state.editing.sel[0].opt.avatar===false,'compact preset applies');
   change('o-preset','detailed');check(state.editing.sel[0].opt.avatar===true&&state.editing.sel[0].opt.last===true,'detailed applies');
   document.getElementById('o-car').click();check(state.editing.sel[0].opt.car===false,'individual override');
   await editorSave();const saved=(await api.list('layouts')).find(x=>x.name==='All-in-One QA');check(saved.widgets.length===7&&saved.widgets[2].opt.car===false,'save');
   state.editing={id:saved.id,draft:structuredClone(saved),sel:[],snap:true,dirty:false,drivers:[],cars:[],teams:[],customWidgets:[],imageSets:[],rowDesigns:[]};await render();check(document.querySelectorAll('#canvas .aio-box').length===7,'reopen');
   const e=RaceEngine.createRace({type:'race',laps:65,minLap:100,fuel:{on:true,tank:100,perLap:2,rate:2,pitHold:2000},tyrewear:TyreWear.clean({}),pushsave:PushSave.clean(PushSave.defaults()),pitControl:{mode:'manual',seconds:30},entries:[{lane:0,driverId:'a',driverName:'James',carName:'NSR Mosler MT900R'},{lane:1,driverId:'b',driverName:'Bjornie',carName:'NSR Corvette C7.R'}]});e.start(0);for(let n=1;n<=5;n++){e.cross(0,n*10000);e.cross(1,n*10300);}
   window.qaE=e;window.qaContext={raceId:'aio-ui',eng:e,now:55000,phase:'running',setup:{sessionType:'race',name:'Club night',laps:65},track:{name:'Slotrace Circuit'},base:{personal:new Map(),track:Infinity},flash:new Map(),bestBy:new Map(),bestAll:Infinity};
   document.body.innerHTML='<main style="padding:20px"><h1>All-in-One widgets</h1><div id="qa-host"></div></main>';
   window.qaDraw=(type,width,height,opt={})=>{
    const w={...Widgets.newWidget(type,0,0,0),w:1000,h:height/width*1000,opt},layout={ratioW:width,ratioH:height,laneColorStyle:'side',radius:3,laneColors:[{bg:'#2fafd7',text:'#e8e6e1'}],widgets:[w]},ctx={...qaContext,layout,lanes:2};
    const viewer=LiveShare.viewer();viewer.feedStatic(JSON.parse(JSON.stringify(LiveShare.packStatic(ctx))));viewer.feedDynamic(JSON.parse(JSON.stringify(LiveShare.packDynamic(ctx))),55000);
    document.getElementById('qa-host').innerHTML='<div id="qa-canvas" class="canvas live"></div>';const canvas=document.getElementById('qa-canvas');window.qaNodes=LiveCanvas.build(canvas,layout,2);canvas.style.width=width+'px';LiveCanvas.paint(qaNodes,viewer.shared(55000));window.qaViewer=viewer;
   };
  `);
  for(const [type,width,height] of await run(`return AllInOne.DEFINITIONS.map(d=>[d[0],d[2],d[3]]);`)){
   await run(`qaDraw('${type}',${width},${height});`);await wait(40);
   assert(!await run(`return !!document.querySelector('.aio-small');`),'default size fits '+type);
   assert(await run(`return [...document.querySelectorAll('.aio-fact b')].every(e=>e.scrollWidth<=e.clientWidth+1);`),'default values fit their columns '+type);
   fs.writeFileSync(path.join(output,type+'-default.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
  }
  await run(`qaDraw('aiodriver',450,420);const c=document.getElementById('qa-canvas'),s=qaViewer.shared(55000);s.layout.widgets[0].showTitle=true;s.layout.widgets[0].title='Driver Dashboard';s.layout.widgets[0].titleSize=20;qaNodes=LiveCanvas.build(c,s.layout,2);LiveCanvas.paint(qaNodes,s);`);await wait(40);
  assert(await run(`const t=document.querySelector('.lw-title').getBoundingClientRect(),b=document.querySelector('.aio-content').getBoundingClientRect();return b.top>=t.bottom&&!document.querySelector('.aio-small');`),'title stays above content');
  let cases=0;
  for(const theme of ['dark','light'])for(const width of [460,300])for(const type of ['aiolane','aiotiming','aiodriver','aiopit','aiorace','aiostrategy','aioresults']){
   await run(`document.documentElement.dataset.theme='${theme}';qaDraw('${type}',${width},${type==='aiodriver'?470:type==='aiopit'?410:340});`);await wait(40);
   const fit=await run(`return [...document.querySelectorAll('.aio-box')].map(b=>({small:b.classList.contains('aio-small'),overflow:[...b.querySelectorAll('.aio-fact b')].some(e=>e.scrollWidth>e.clientWidth+1),text:b.textContent}));`);
   assert(fit.every(x=>!x.small&&!x.overflow),JSON.stringify({theme,width,type,fit}));cases++;
   if(theme==='dark'&&width===460)fs.writeFileSync(path.join(output,type+'.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
  }
  await run(`qaDraw('aiodriver',460,470);qaE.cars[0].driverName='A very long driver name which must wrap safely';qaE.cars[0].carName='An exceptionally long slotcar description with manufacturer, model and racing livery';LiveCanvas.paint(qaNodes,LiveShare.makeShared({...qaContext,layout:qaViewer.shared(55000).layout}));`);await wait(40);
  assert.equal(await run(`return !!document.querySelector('.aio-small');`),false,'long names readable');
  await run(`qaDraw('aiodriver',120,60);`);assert(await run(`return !!document.querySelector('.aio-small');`),'small size message');
  await run(`qaE.cars[0].driverName='James';qaE.cars[0].carName='NSR Mosler MT900R';qaDraw('aiodriver',460,470);`);assert(!await run(`return !!document.querySelector('.aio-small');`),'growing restores content');
  for(const [width,theme] of [[1100,'dark'],[640,'dark'],[640,'light']]){
   win.setContentSize(width,900);await run(`document.documentElement.dataset.theme='${theme}';qaDraw('aiodriver',${width===1100?580:340},${width===1100?470:490});`);await wait(180);
   fs.writeFileSync(path.join(output,'driver-'+width+'-'+theme+'.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
  }
  assert.deepEqual(await run('return qaErrors;'),[]);
  console.log('ALL-IN-ONE ELECTRON PASSED: palette, presets, individual overrides, save/reopen, shared live rendering, '+cases+' size/theme cases, long names and minimum size recovery');app.exit(0);
 }catch(e){console.error(e);app.exit(1);}
});});require('../../main');
