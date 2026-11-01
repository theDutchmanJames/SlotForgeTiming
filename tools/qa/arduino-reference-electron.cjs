// Real app, isolated database and virtual serial device; never opens physical hardware.
const {app}=require('electron'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../../../outputs/arduino-reference'),data=path.resolve(__dirname,'../../.tmp-test/arduino-reference-'+process.pid);
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(data,{recursive:true});app.setPath('appData',data);app.disableHardwareAcceleration();
let done=false;const wait=ms=>new Promise(r=>setTimeout(r,ms));const timer=setTimeout(()=>app.exit(2),90000);
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
 try{
  await wait(400);win.setMinimumSize(0,0);win.setContentSize(1360,1000);
  await run(`window.qaErrors=[];addEventListener('error',e=>qaErrors.push(e.message));addEventListener('unhandledrejection',e=>qaErrors.push(String(e.reason)));state.tab='settings';state.settingsSub='hardware';state.hwSub='arduino';await render();`);
  assert(await run(`return document.querySelector('.ab-setup').textContent.includes('Arduino Sketch') && state.schema.racesetups.groups.find(g=>g.id==='box').title==='Arduino Sketch';`),'page and setup folder name');
  await run(`const v=document.querySelector('#ab-virtual');v.checked=true;await v.onchange({target:v});`);await wait(3200);
  assert(await run(`return ab.open&&ab.dev.virtual&&ArduinoBox.link.version.version===ArduinoSketch.version;`),'matching embedded and virtual firmware');
  const change=async(id,value)=>{await run(`const el=document.getElementById(${JSON.stringify(id)});el.value=${JSON.stringify(value)};await el.onchange({target:el});`);await wait(200);};
  await change('ab-lights','2');assert.equal(await run('return ArduinoBox.link.options.lights[0]'),2);
  await change('ab-lanerelays','1');
  assert(await run(`return ArduinoBox.link.options.relay[1]===0&&document.querySelector('#ab-msg').textContent.includes('share D7');`),'plain LEDs block Nano relay overlap');
  await change('ab-lights','0');await change('ab-lanerelays','1');
  assert.equal(await run('return ArduinoBox.link.options.relay[1]'),1,'accepted options read back');
  await change('ab-lights','2');
  assert(await run(`return ArduinoBox.link.options.lights[0]===0&&document.querySelector('#ab-msg').textContent.includes('share D7');`),'relays block Nano LED overlap');
  await run(`document.querySelector('[data-interface-go="firmware"]').click();`);
  for(const [width,theme] of [[1360,'dark'],[600,'light']]){
   win.setContentSize(width,1000);await run(`state.settings.theme='${theme}';applyTheme();document.querySelector('[data-interface-go="connection"]').click();scrollTo(0,0);`);await wait(100);
   assert(await run('return document.documentElement.scrollWidth<=innerWidth+2;'),'page fits '+width);
   fs.writeFileSync(path.join(out,theme+'.png'),(await win.webContents.capturePage()).toPNG());
  }
  await run(`await abClose();ArduinoBox.link.version={version:ArduinoSketch.version,board:'mega',pins:16};renderArduinoSettings(document.querySelector('#hwbox'));`);
  assert(await run(`return document.querySelector('#ab-lanerelays').max==='8'&&document.querySelector('#ab-lights').textContent.includes('D30..D36');`),'Mega pin map and eight relays');
  assert.deepEqual(await run('return qaErrors'),[]);
  fs.writeFileSync(path.join(out,'ui-results.json'),JSON.stringify({passed:true,checks:['Arduino Sketch page and Race Setup folder','Virtual/embedded firmware version','Output readback','Nano conflict in both directions','Mega labels and relay count','1360px dark and 600px light without overflow','No renderer errors']},null,2));
  console.log('ARDUINO REFERENCE ELECTRON PASS');clearTimeout(timer);app.quit();
 }catch(e){console.error(e);fs.writeFileSync(path.join(out,'failure.txt'),String(e.stack||e));app.exit(1);}
});});require('../../main');
