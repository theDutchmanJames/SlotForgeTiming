// Design review only. Uses the actual widget renderer in an isolated Electron
// profile, then applies proposed presentation overrides to those preview nodes.
const {app}=require('electron'),fs=require('fs'),path=require('path');
const out=path.resolve(__dirname,'../../../outputs/widget-surface-design');fs.mkdirSync(out,{recursive:true});
app.setPath('appData',path.resolve(__dirname,'../../.tmp-test/surface-design-'+process.pid));
let done=false;setTimeout(()=>app.exit(2),90000).unref();
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 try{
  win.setContentSize(1100,1030);await new Promise(r=>setTimeout(r,500));
  await win.webContents.executeJavaScript('(async()=>{'+fs.readFileSync(path.join(__dirname,'widget-surface-design-probe.js'),'utf8')+'})()');
  fs.writeFileSync(path.join(out,'design.png'),(await win.webContents.capturePage()).toPNG());
  const page=await win.webContents.executeJavaScript(`'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Widget background and alignment proposal</title>'+[...document.querySelectorAll('link[rel="stylesheet"]')].map(n=>'<link rel="stylesheet" href="'+n.href+'">').join('')+document.getElementById('proposal-css').outerHTML+'</head><body>'+document.body.innerHTML+'</body></html>'`);
  fs.writeFileSync(path.join(out,'design.html'),page);
  console.log(await win.webContents.executeJavaScript('JSON.stringify(window.proposalChecks)'));app.exit(0);
 }catch(e){console.error(e.stack);app.exit(1);}
});});require('../../main.js');
