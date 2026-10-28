// Bounded retained-heap probe; this is not an overnight endurance test.
const {app}=require('electron'),fs=require('fs'),path=require('path');
const out=path.resolve(__dirname,'../../../outputs/widget-options-review');
app.setPath('appData',path.resolve(__dirname,'../../.tmp-test/widget-memory-'+process.pid));app.disableHardwareAcceleration();
let started=false;setTimeout(()=>app.exit(2),420000).unref();
const wait=ms=>new Promise(r=>setTimeout(r,ms));
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.on('did-finish-load',async()=>{
 if(started||!win.webContents.getURL().endsWith('index.html'))return;started=true;
 try{
  await wait(300);win.setMinimumSize(0,0);win.setContentSize(1200,900);
  const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
  await run(`document.body.innerHTML='<div id="soak" class="canvas" style="width:1100px;height:800px"></div>';window.soakCycle=()=>{
   const types=['lastlap','pace','tyrelife','textlane','aiolane','clock','bop','currentdriver','fuel','swapsignal'];
   const widgets=Array.from({length:40},(_,i)=>({...Widgets.newWidget(types[i%types.length],i%8,(i%5)*200,Math.floor(i/5)*90),w:190,h:85,opt:types[i%types.length]==='pace'?{look:'gauge'}:{}}));
   const layout={ratioW:10,ratioH:7.5,widgets},host=document.getElementById('soak'),nodes=LiveCanvas.build(host,layout,8);
   for(const n of nodes){n.val.innerHTML=Widgets.sampleOf(Widgets.def(n.w.type),n.w.lane,n.w);WidgetView.fit(n,{});}nodes.resize();nodes.dispose();host.replaceChildren();
   if(!nodes.disposed||nodes.some(n=>!n.disposed))throw Error('Undisposed widget');
  };for(let i=0;i<20;i++)soakCycle();`);
  win.webContents.debugger.attach('1.3');
  const measure=async cycle=>{await win.webContents.debugger.sendCommand('HeapProfiler.collectGarbage');return {cycle,at:Date.now(),...(await win.webContents.debugger.sendCommand('Runtime.getHeapUsage')),...(await win.webContents.debugger.sendCommand('Memory.getDOMCounters'))};};
  const measures=[await measure(0)],begin=Date.now();
  for(let cycle=1;cycle<=300;cycle++){await run('soakCycle();');await wait(1000);if(cycle%60===0){measures.push(await measure(cycle));fs.writeFileSync(path.join(out,'memory-soak.json'),JSON.stringify({cycles:cycle,widgets:cycle*40,elapsedMs:Date.now()-begin,measures},null,2));}}
  console.log(JSON.stringify({cycles:300,elapsedMs:Date.now()-begin,measures}));app.exit(0);
 }catch(e){console.error(e);app.exit(1);}
});});require('../../main.js');
