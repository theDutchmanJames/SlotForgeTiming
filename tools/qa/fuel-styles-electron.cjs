const {app}=require('electron'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../../../outputs/fuel-styles');fs.mkdirSync(out,{recursive:true});
app.setPath('appData',path.resolve(__dirname,'../../.tmp-test/fuel-styles-'+process.pid));app.disableHardwareAcceleration();
const wait=ms=>new Promise(r=>setTimeout(r,ms));let done=false;setTimeout(()=>app.exit(2),90000).unref();
app.on('browser-window-created',(_,win)=>win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
 const capture=async name=>{await wait(120);fs.writeFileSync(path.join(out,name+'.png'),(await win.webContents.capturePage()).toPNG());};
 try{
  win.setMinimumSize(0,0);win.setContentSize(1280,950);win.showInactive();await wait(400);
  await run(`window.fuelErrors=[];addEventListener('error',e=>fuelErrors.push(e.message));window.ck=(v,m)=>{if(!v)throw Error(m)};
   state.tab='custom';state.customSub='layouts';state.sideOpen=new Set(['opts']);
   const w={...Widgets.newWidget('fuel',0,0,0),w:600,h:250};
   state.editing={id:null,draft:{name:'Fuel styles',ratioW:10,ratioH:6,widgets:[w],guides:{v:[],h:[]}},sel:[w],snap:false,dirty:true,drivers:[],cars:[],teams:[],customWidgets:[],imageSets:[],rowDesigns:[],chartDesigns:[]};await render();
   window.setFuelOption=(key,value)=>{const el=document.querySelector('#side [data-opt="'+key+'"]');ck(el,'Missing control '+key);if(el.type==='checkbox')el.checked=value;else el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));};
   setFuelOption('barStyle','digital');ck(!!document.querySelector('#side [data-opt="segments"]'),'Digital controls appear');setFuelOption('segments',20);setFuelOption('glow',false);setFuelOption('dir','vertical');setFuelOption('warningText','show');setFuelOption('barValues','both');
   ck(state.editing.sel[0].opt.segments===20&&state.editing.sel[0].opt.glow===false,'Typed options retained');
   setFuelOption('barStyle','scale');ck(!document.querySelector('#side [data-opt="segments"]'),'Digital controls hidden for scale');setFuelOption('barStyle','digital');
   const saved=await api.add('layouts',state.editing.draft),loaded=(await api.list('layouts')).find(l=>l.id===saved.id);ck(JSON.stringify(saved.widgets)===JSON.stringify(loaded.widgets),'Save/reopen');
   await document.fonts.ready;fitEditorWidgets();`);
  await capture('editor');
  const geometry=await run(`
   const host=document.createElement('div');host.className='canvas';Object.assign(host.style,{position:'fixed',left:'0',top:'0',zIndex:'99999'});document.body.append(host);const failures=[],checks=[];
   for(const style of ['original','digital','scale'])for(const dir of ['horizontal','vertical'])for(const [width,height]of dir==='vertical'?[[90,240],[160,320]]:[[200,60],[360,140]])for(const level of [0,1,20,72,100]){
    host.replaceChildren();host.style.width=width+'px';host.style.height=height+'px';
    const w={...Widgets.newWidget('fuel',0,0,0),w:1000,h:height/width*1000,title:'Fuel',opt:{barStyle:style,dir,warningText:'show',barValues:'both',segments:20},typography:{mode:'auto'}};
    const layout={ratioW:width,ratioH:height,widgets:[w]},n=WidgetView.mount(host,w,layout);n.val.innerHTML=Widgets.fuelHtml(level,100,w.opt);WidgetView.fit(n,{});
    const fits=Frame.textFits(n.val),status=n.el.dataset.fitStatus,bar=n.val.querySelector('.fg-meter,.fbar'),r=bar.getBoundingClientRect();
    const result={style,dir,width,height,level,fits,status,bar:[r.width,r.height]};checks.push(result);if(!fits||status!=='fits'||r.width<2||r.height<2){const box=n.val.getBoundingClientRect();result.text=[...n.val.querySelectorAll('.fg-warning,.fg-value,.fg-detail,.fg-scale-labels span,.ftxt')].filter(x=>x.getClientRects().length).map(x=>{const range=document.createRange();range.selectNodeContents(x);const r=range.getBoundingClientRect();return {text:x.textContent,size:getComputedStyle(x).fontSize,rect:[r.left-box.left,r.top-box.top,r.right-box.left,r.bottom-box.top],box:[box.width,box.height],local:Frame.textFits(x,x,false)}});failures.push(result);}
   }
   host.remove();return {checks,failures};`);
  fs.writeFileSync(path.join(out,'geometry.json'),JSON.stringify(geometry,null,2));assert.deepEqual(geometry.failures,[]);
  await run(`
   window.fuelEngine=RaceEngine.createRace({type:'race',laps:100,entries:[{lane:0,driverName:'Alex'},{lane:1,driverName:'Sam'}],fuel:{on:true,tank:100,perLap:2,rate:10}});fuelEngine.start(0);fuelEngine.cars[0].fuel=72;fuelEngine.cars[1].fuel=20;
   window.fuelLayout={name:'Fuel styles',ratioW:10,ratioH:5.8,widgets:[],guides:{v:[],h:[]}};
   ['original','digital','scale'].forEach((barStyle,i)=>{
    const base={...Widgets.newWidget('fuel',0,10+i*330,10),w:310,h:150,title:['Original','Digital Segments','Reserve Scale'][i],opt:{barStyle},appearance:{source:'theme',border:'shade',radiusPixels:14}};
    fuelLayout.widgets.push(base,{...structuredClone(base),id:base.id+'v',x:10+i*330,y:185,w:110,h:330,title:'Fuel',opt:{barStyle,dir:'vertical'}},{...structuredClone(base),id:base.id+'c',x:135+i*330,y:210,w:180,h:60,lane:1,title:'Compact',opt:{barStyle}},{...structuredClone(base),id:base.id+'n',x:135+i*330,y:330,w:180,h:130,lane:1,title:'Low fuel',opt:{barStyle}});
   });
   window.fuelState=LiveShare.makeShared({raceId:'fuel-style-qa',eng:fuelEngine,now:0,phase:'running',setup:{sessionType:'race'},layout:fuelLayout,lanes:2,track:{},base:{personal:new Map(),track:Infinity},flash:new Map(),bestBy:new Map(),bestAll:Infinity});
   window.fuelLive=LiveCanvas.fullView(fuelLayout,2);LiveCanvas.paint(fuelLive.nodes,fuelState);`);
  for(const theme of ['dark','light','ocean']){
   await run(`state.settings.theme='${theme}';applyTheme();fuelLive.nodes.resize();LiveCanvas.paint(fuelLive.nodes,fuelState);`);await capture(theme);
   const result=await run(`return fuelLive.nodes.map(n=>({type:n.w.opt.barStyle,status:n.el.dataset.fitStatus,fits:Frame.textFits(n.val)}));`);assert(result.every(x=>x.status==='fits'&&x.fits),JSON.stringify(result));
  }
  await run(`state.settings.theme='dark';applyTheme();document.documentElement.style.setProperty('--accent','#ff7800');fuelEngine.cars[0].fuel=100;LiveCanvas.paint(fuelLive.nodes,fuelState);`);await capture('orange-theme-full');
  assert.deepEqual(await run('return fuelErrors;'),[]);
  console.log('FUEL STYLES ELECTRON PASSED: real editor controls, save/reopen, 60 geometry cases, actual live renderer, dark/light/Ocean and orange accent');app.quit();
 }catch(e){console.error(e);await capture('failure');app.exit(1);}
}));require('../../main');
