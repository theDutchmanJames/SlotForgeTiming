const {app}=require('electron'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const out=path.resolve(__dirname,'../../../outputs/widget-preview-migration');
app.setPath('appData',path.resolve(__dirname,'../../.tmp-test/preview-charts-'+process.pid));app.disableHardwareAcceleration();
const wait=ms=>new Promise(r=>setTimeout(r,ms));let done=false;setTimeout(()=>app.exit(2),90000).unref();
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 try{await wait(350);win.setMinimumSize(0,0);win.setContentSize(1300,1000);
 const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
 await run(`window.chartErrors=[];addEventListener('error',e=>chartErrors.push(e.message));state.tab='custom';state.customSub='charts';state.editing=null;chartEd={id:null,draft:ChartWidgets.clean({name:'Shared preview race',drivers:'selected',lanes:[0,1,2,3],points:true}),dirty:false};await render();`);
 for(const style of ['trend','bars','delta']){
  await run(`document.querySelector('[data-chart-style="${style}"]').click();`);await wait(250);
  assert(await run(`return !!document.querySelector('#chart-preview svg');`),style+' chart drawn');
  fs.writeFileSync(path.join(out,'chart-editor-'+style+'.png'),(await win.webContents.capturePage()).toPNG());
 }
 assert.deepEqual(await run('return chartErrors;'),[]);console.log('Chart Editor: three styles rendered with shared preview race');app.exit(0);
 }catch(e){console.error(e);app.exit(1);}
});});require('../../main.js');
