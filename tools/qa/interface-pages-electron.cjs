// Isolated real-app UI checks. Arduino uses its simulator; DS uses an in-memory serial stream.
const {app}=require('electron'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../../../outputs/interface-pages'),data=path.resolve(__dirname,'../../.tmp-test/interface-pages-'+process.pid);fs.mkdirSync(out,{recursive:true});fs.mkdirSync(data,{recursive:true});app.setPath('appData',data);app.disableHardwareAcceleration();
let done=false;const wait=ms=>new Promise(r=>setTimeout(r,ms));const timer=setTimeout(()=>app.exit(1),90000);
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.on('did-finish-load',async()=>{if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
try{
 await wait(400);win.setMinimumSize(0,0);win.setContentSize(1540,1100);win.showInactive();
 await run(`window.qaErrors=[];addEventListener('error',e=>qaErrors.push(e.message));state.tab='settings';state.settingsSub='hardware';state.hwSub='arduino';await render();`);
 assert.equal(await run(`return document.querySelectorAll('.ab-setup [data-interface-go]').length;`),8);
 await run(`document.querySelector('[data-interface-go="power"]').click();`);assert(await run(`return document.querySelector('[data-interface-section="power"]').open&&document.querySelector('[data-interface-go="power"]').getAttribute('aria-current')==='true';`));
 // Collapsed folders and current section survive reconnects and pin redraws.
 await run(`document.querySelector('[data-interface-section="pins"]').open=false;`);await wait(40);
 await run(`renderArduinoSettings(document.querySelector('#hwbox'));`);
 assert(await run(`return !document.querySelector('[data-interface-section="pins"]').open&&document.querySelector('[data-interface-section="power"]').open;`));
 await run(`const v=document.querySelector('#ab-virtual');v.checked=true;await v.onchange({target:v});`);await wait(3100);
 assert(await run(`return ab.open&&ab.dev.virtual&&ArduinoBox.link.slotforge;`),'virtual box connection');
 await run(`document.querySelector('[data-interface-go="pins"]').click();document.querySelector('#ab-blackout').value='450';await document.querySelector('#ab-blackout').onchange({target:document.querySelector('#ab-blackout')});await abSend(ArduinoBox.C.list());`);await wait(100);
 assert.equal(await run(`return ArduinoBox.link.options.blackout[0];`),450);
 await run(`const select=document.querySelector('[data-sensor="0"]');select.value='1';select.dispatchEvent(new Event('change',{bubbles:true}));`);await wait(150);
 assert.deepEqual(await run(`return state.settings.abLaneMap.slice(0,2);`),[1,0]);
 await run(`document.querySelector('#ab-save').click();document.querySelector('[data-interface-go="monitor"]').click();`);await wait(100);
 assert(await run(`return document.querySelector('#ab-log').textContent.length>0;`),'Arduino log');
 // Capture all page/theme/width combinations; only the pins table may scroll internally.
 for(const page of ['arduino','ds'])for(const [width,theme]of [[1540,'dark'],[1000,'ocean'],[600,'light'],[420,'dark']]){
  win.setContentSize(width,1100);await run(`document.documentElement.dataset.theme='${theme}';state.hwSub='${page}';renderHardwareArea(document.querySelector('#settingsbox'));document.querySelectorAll('[data-interface-section]').forEach(s=>s.open=s.dataset.interfaceSection==='connection');scrollTo(0,0);`);await wait(100);
  assert(await run(`return document.documentElement.scrollWidth<=innerWidth+2;`),'page overflow '+page+'/'+width);
  assert(await run(`return [...document.querySelectorAll('.interface-setup [id]')].every((n,i,a)=>a.findIndex(x=>x.id===n.id)===i);`),'duplicate IDs');
  fs.writeFileSync(path.join(out,page+'-'+width+'-'+theme+'.png'),(await win.webContents.capturePage()).toPNG());
  if(width===420){await run(`document.querySelectorAll('[data-interface-section]').forEach(s=>s.open=true);`);await wait(60);assert(await run(`return document.documentElement.scrollWidth<=innerWidth+2;`),'open folders overflow '+page);await run(`document.querySelector('[data-interface-go="${page==='arduino'?'pins':'serial'}"]').click();`);await wait(60);fs.writeFileSync(path.join(out,page+'-420-expanded.png'),(await win.webContents.capturePage()).toPNG());}

 }
 await run(`await abClose();state.hwSub='ds';renderHardwareArea(document.querySelector('#settingsbox'));window.dsWritten=0;dsc.dev={open:async c=>{window.dsOpened=c;},close:async()=>{},setSignals:async s=>{window.dsSignals=s;},getSignals:async()=>({clearToSend:true}),readable:new ReadableStream({start(c){window.dsController=c;}}),writable:new WritableStream({write(){dsWritten++;}})};dsc.info={usbVendorId:0x403,usbProductId:0x6001};state.settings=await api.setSettings({dsType:'ds300'});renderDsSettings(document.querySelector('#hwbox'));document.querySelector('#ds-baud').value='19200';document.querySelector('#ds-baud').onchange({target:document.querySelector('#ds-baud')});await document.querySelector('#ds-conn').onclick();`);await wait(100);
 assert(await run(`return dsc.open&&document.querySelector('#ds-baud').disabled&&dsOpened.baudRate===19200&&document.querySelector('.tm-headerstate').textContent.includes('Listening');`),'DS connection status');
 await run(`document.querySelector('[data-interface-go="monitor"]').click();dsController.enqueue(new Uint8Array([76,49,32,55,46,51,53,13,10]));document.querySelector('#ds-note').value='Lane 1 passed the sensor';document.querySelector('#ds-addnote').click();`);await wait(100);
 assert(await run(`return dsc.bytes===9&&document.querySelector('#ds-log').textContent.includes('Lane 1 passed the sensor')&&dsWritten===0;`),'DS capture data/notes without writes');
 win.setContentSize(1540,1100);await run(`document.documentElement.dataset.theme='dark';document.querySelector('[data-interface-go="monitor"]').click();`);await wait(80);fs.writeFileSync(path.join(out,'ds-capture.png'),(await win.webContents.capturePage()).toPNG());
 await run(`await document.querySelector('#ds-conn').onclick();`);assert(await run(`return !dsc.open&&!document.querySelector('#ds-baud').disabled;`));
 assert.deepEqual(await run('return qaErrors'),[]);
 fs.writeFileSync(path.join(out,'electron-results.json'),JSON.stringify({passed:true,checks:['Arduino simulator connection','settings command round-trip','lane map swap','save-to-box and monitor','section navigation and redraw persistence','DS serial configuration','DS receive stream and notes without protocol writes','disconnect controls','no overflow at 1540/1000/600/420 across themes','no duplicate IDs','no runtime errors']},null,2));console.log('INTERFACE PAGES ELECTRON PASS');clearTimeout(timer);app.quit();
}catch(e){console.error(e);console.error(await run('return qaErrors'));fs.writeFileSync(path.join(out,'failure.png'),(await win.webContents.capturePage()).toPNG());app.exit(1);}
});});require('../../main');
