const {app}=require('electron'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const out=path.resolve(__dirname,'../../../outputs/widget-options-review');fs.mkdirSync(out,{recursive:true});
app.setPath('appData',path.resolve(__dirname,'../../.tmp-test/widget-options-'+process.pid));app.disableHardwareAcceleration();
let done=false;const wait=ms=>new Promise(r=>setTimeout(r,ms));setTimeout(()=>app.exit(2),300000).unref();
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
 try{
  await wait(350);win.setMinimumSize(0,0);win.setContentSize(1300,1000);
  await run(`window.qaErrors=[];addEventListener('error',e=>qaErrors.push(e.message));`);
  const result=await run(fs.readFileSync(path.join(__dirname,'widget-options-probe.js'),'utf8'));
  fs.writeFileSync(path.join(out,'option-controls.json'),JSON.stringify(result,null,2));
  console.log('Option controls:',result.checks,'checks,',result.variants,'variants; failures:',result.failures);
  assert.deepEqual(result.failures,[]);
  assert.deepEqual(await run('return qaErrors;'),[]);
  if(fs.existsSync(path.join(__dirname,'widget-options-visual.js'))){
   const visual=await run(fs.readFileSync(path.join(__dirname,'widget-options-visual.js'),'utf8'));
   fs.writeFileSync(path.join(out,'geometry.json'),JSON.stringify(visual,null,2));
   await wait(200);fs.writeFileSync(path.join(out,'widgets.png'),(await win.webContents.capturePage()).toPNG());
   assert.deepEqual(visual.failures,[]);
  }
  console.log('WIDGET OPTIONS ELECTRON PASSED');app.exit(0);
 }catch(e){console.error(e);try{fs.writeFileSync(path.join(out,'failure.png'),(await win.webContents.capturePage()).toPNG());}catch{}app.exit(1);}
});});require('../../main.js');
