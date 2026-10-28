const {app}=require('electron'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const out=path.resolve(__dirname,'../../../outputs/widget-preview-migration');fs.mkdirSync(out,{recursive:true});
app.setPath('appData',path.resolve(__dirname,'../../.tmp-test/widget-preview-'+process.pid));app.disableHardwareAcceleration();
let done=false;const wait=ms=>new Promise(r=>setTimeout(r,ms));setTimeout(()=>app.exit(2),300000).unref();
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
 try{
  await wait(400);win.setMinimumSize(0,0);win.setContentSize(1300,1000);
  await run(`window.qaErrors=[];addEventListener('error',e=>qaErrors.push(e.message));`);
  const controls=await run(fs.readFileSync(path.join(__dirname,'widget-options-probe.js'),'utf8'));
  fs.writeFileSync(path.join(out,'controls.json'),JSON.stringify(controls,null,2));
  // Compare every computed property, including pseudo-elements, using identical
  // production content and the real renderer. Only the three cleaned sheets vary.
  const files=['styles.css','widgetsettings.css','allinone.css'];
  const baseline=files.map(f=>fs.readFileSync(path.join(__dirname,'fixtures/widget-css',f),'utf8'));
  const current=files.map(f=>fs.readFileSync(path.join(__dirname,'../../renderer',f),'utf8'));
  await run(`window.qaSheets=${JSON.stringify({files,baseline,current})};`);
  const css=await run(fs.readFileSync(path.join(__dirname,'widget-preview-css-probe.js'),'utf8'));
  fs.writeFileSync(path.join(out,'css-equivalence.json'),JSON.stringify(css,null,2));
  for(const width of [1200,600]){
   win.setContentSize(width,1000);
   await run(`document.documentElement.dataset.theme='dark';document.body.innerHTML='<main id="gallery" style="display:grid;grid-template-columns:repeat('+(${width}>=900?3:2)+',minmax(0,1fr));gap:14px;padding:16px"></main>';const gallery=document.querySelector('#gallery');
    for(const type of ['aiolane','lastlap','pace','tyrelife','fuel','clock','wxforecast','aiotiming','classposition']){
     const opt=type==='lastlap'?{columns:2,lapsPerColumn:7}:type==='pace'?{look:'gauge',showRef:true}:type==='clock'?{style:'digital'}:{};
     const w={...Widgets.newWidget(type,1,0,0),w:1000,h:700,opt,appearance:{source:'theme',accent:'lane',edge:'left'}};
     const layout={ratioW:10,ratioH:7,laneColors:[{bg:'#35a8cf'},{bg:'#80b354'}],widgets:[w]};
     const host=document.createElement('section');host.className='canvas';host.style.cssText='width:100%;aspect-ratio:10/7;position:relative;';gallery.append(host);
     const cell=WidgetView.mount(host,w,layout);const result=WidgetPreview.content({...w,previewLayout:layout});cell.val.innerHTML=result.html;WidgetView.fit(cell,result);
    } await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));`);
   await wait(250);fs.writeFileSync(path.join(out,'gallery-'+width+'.png'),(await win.webContents.capturePage()).toPNG());
  }
  assert.deepEqual(await run('return qaErrors;'),[]);
  assert.deepEqual(controls.failures,[]);
  assert.deepEqual(css.failures,[]);
  console.log('PREVIEW ELECTRON PASSED',controls.checks,'control checks;',css.cases,'CSS cases;',css.properties,'computed values');app.exit(0);
 }catch(e){console.error(e);try{fs.writeFileSync(path.join(out,'failure.png'),(await win.webContents.capturePage()).toPNG());}catch{}app.exit(1);}
});});require('../../main.js');
