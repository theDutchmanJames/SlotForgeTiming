// Read-only investigation. Loads a saved layout into an isolated app profile;
// all proposed rendering changes are temporary and confined to this QA renderer.
const {app}=require('electron'),fs=require('fs'),path=require('path');
const out=path.resolve(process.argv.find(x=>x.startsWith('--out='))?.slice(6)||path.join(__dirname,'../../../outputs/layout-editor-performance'));
fs.mkdirSync(out,{recursive:true});
const userRoot=path.join(app.getPath('appData'),'slotforge-timing');
const db=JSON.parse(fs.readFileSync(path.join(userRoot,'slotforge-timing.json'),'utf8'));
const settings=JSON.parse(fs.readFileSync(path.join(userRoot,'slotforge-timing.settings.json'),'utf8'));
const layout=db.layouts.find(x=>x.name==='JamesUI v2');
if(!layout)throw Error('Expected test layout was not found');
const input={layout,settings,rowDesigns:db.rowdesigns,chartDesigns:db.chartdesigns,imageSets:db.imagesets,customWidgets:db.customwidgets};
app.setPath('appData',path.resolve(__dirname,'../../.tmp-test/layout-performance-'+process.pid));
let done=false;setTimeout(()=>app.exit(2),240000).unref();
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
 try{
  win.setContentSize(1680,1360);
  await run(`window.qaInput=${JSON.stringify(input)};`);
  const results=await run(fs.readFileSync(path.join(__dirname,'layout-editor-performance-probe.js'),'utf8'));
  results.gpu=app.getGPUFeatureStatus();results.method='Hidden Electron window, hardware acceleration enabled. Synchronous handler costs, not measured on-screen FPS. Isolated profile; saved user layout read only.';
  fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify(results,null,2));
  fs.writeFileSync(path.join(out,'layout.png'),(await win.webContents.capturePage()).toPNG());
  if(process.argv.includes('--verify')){
   const checks=await run(fs.readFileSync(path.join(__dirname,'layout-editor-performance-checks.js'),'utf8'));
   fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(checks,null,2));
   if(checks.failures.length)throw Error(JSON.stringify(checks.failures));
   for(const width of [1200,600]){
    win.setMinimumSize(0,0);win.setContentSize(width,1000);
    await run('renderEditor();document.querySelector("#canvas").scrollIntoView({block:"start"});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));');
    fs.writeFileSync(path.join(out,'editor-'+width+'.png'),(await win.webContents.capturePage()).toPNG());
   }
   console.log('PERFORMANCE REGRESSIONS',checks.checks);
  }
  if(process.argv.includes('--controls')){
   const controls=await run(fs.readFileSync(path.join(__dirname,'widget-options-probe.js'),'utf8'));
   fs.writeFileSync(path.join(out,'controls.json'),JSON.stringify(controls,null,2));
   if(controls.failures.length)throw Error(JSON.stringify(controls.failures));
   console.log('WIDGET OPTION REGRESSIONS',controls.checks);
  }
  console.log(JSON.stringify(results,null,2));app.exit(0);
 }catch(e){console.error(e.stack);app.exit(1);}
});});require('../../main.js');
