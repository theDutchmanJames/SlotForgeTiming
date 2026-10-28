const {app}=require('electron'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const out=path.resolve(__dirname,'../../../outputs/widget-surface-implementation');fs.mkdirSync(out,{recursive:true});
app.setPath('appData',path.resolve(__dirname,'../../.tmp-test/widget-surface-'+process.pid));
let done=false;setTimeout(()=>app.exit(2),180000).unref();
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 const run=s=>win.webContents.executeJavaScript('(async()=>{'+s+'})()');
 try{
  await new Promise(r=>setTimeout(r,400));win.setMinimumSize(0,0);win.setContentSize(1200,1000);
  const checks=await run(fs.readFileSync(path.join(__dirname,'widget-surface-probe.js'),'utf8'));
  fs.writeFileSync(path.join(out,'surface-checks.json'),JSON.stringify(checks,null,2));assert.deepEqual(checks.failures,[]);
  fs.writeFileSync(path.join(out,'editor.png'),(await win.webContents.capturePage()).toPNG());
  for(const width of [1200,600]){
   win.setContentSize(width,900);
   await run(`window.surfaceView?.close();window.surfaceView=LiveCanvas.fullView(surfaceDesign,2);const real=Timing.content,samples=new Map(surfaceDesign.widgets.map(w=>[w.id,WidgetPreview.content(w,{layout:surfaceDesign})||{html:Widgets.sampleOf(Widgets.def(w.type),w.lane,w)}]));try{Timing.content=w=>samples.get(w.id);LiveCanvas.paint(surfaceView.nodes,WidgetPreview.state({},{layout:surfaceDesign}));}finally{Timing.content=real;}await document.fonts.ready;surfaceView.nodes.resize();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));`);
   await new Promise(r=>setTimeout(r,300));fs.writeFileSync(path.join(out,'live-'+width+'.png'),(await win.webContents.capturePage()).toPNG());
   console.log(await run(`return JSON.stringify({labels:document.querySelectorAll('.live .lw-lane').length,nodes:surfaceView.nodes.map(n=>({type:n.w.type,error:n.error}))});`));assert(await run(`return !document.querySelector('.live .lw-lane')&&surfaceView.nodes.every(n=>!n.error);`),'live has no editor lane tags or rendering errors');
  }
  console.log('WIDGET SURFACE ELECTRON PASS: '+checks.checks+' checks; actual editor and live at 1200/600px');app.exit(0);
 }catch(e){console.error(e.stack);fs.writeFileSync(path.join(out,'failure.png'),(await win.webContents.capturePage()).toPNG());app.exit(1);}
});});require('../../main.js');
