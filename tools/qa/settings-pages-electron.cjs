// Real Electron controls with isolated settings; file dialogs and network status
// are simulated through IPC. No local network is opened and no user files change.
const {app,ipcMain}=require('electron'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../../../outputs/settings-pages'),data=path.resolve(__dirname,'../../.tmp-test/settings-pages-'+process.pid);
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(data,{recursive:true});app.setPath('appData',data);app.disableHardwareAcceleration();
let done=false,restores=0,exportCount=0,imports=0;const wait=ms=>new Promise(r=>setTimeout(r,ms)),timer=setTimeout(()=>app.exit(1),90000);
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
 const mock=(name,fn)=>{ipcMain.removeHandler(name);ipcMain.handle(name,fn);};
 try{
  await wait(400);win.setMinimumSize(0,0);win.setContentSize(1400,1000);
  mock('net:status',()=>({on:true,passwordSet:false,urls:[{url:'http://192.0.2.1:8787/',svg:'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64"/></svg>'}]}));
  mock('transfer:open',()=>({ok:true,file:'Example export.json',summary:{drivers:{count:1,names:['Example driver']}}}));
  mock('transfer:apply',()=>{imports++;return {drivers:1};});
  mock('transfer:export',()=>{exportCount++;return {saved:true,path:'Example export.json',counts:{drivers:1}};});
  mock('backup:open',()=>({ok:true,file:'Example backup.json',counts:{drivers:1},laps:0}));
  mock('backup:restore',()=>{restores++;return {};});
  await run(`window.qaErrors=[];addEventListener('error',e=>qaErrors.push(e.message));addEventListener('unhandledrejection',e=>qaErrors.push(String(e.reason)));state.tab='settings';state.settingsSub='general';await render();`);
  const go=async page=>{await run(`state.settingsSub='${page}';await renderSettings();`);await wait(70);};
  const rail=async id=>{await run(`document.querySelector('[data-interface-go="${id}"]').click();`);await wait(40);};
  await rail('names');await run(`document.getElementById('appname').value='Settings test';await document.getElementById('appname').onchange({target:document.getElementById('appname')});`);
  assert.equal(await run(`return (await api.getSettings()).appName;`),'Settings test');
  await go('general');assert(await run(`return document.querySelector('[data-settings-section="names"]').open&&document.querySelector('[aria-current="true"]').dataset.interfaceGo==='names';`),'rail survives redraw');
  await run(`document.querySelector('[data-folderall="0"]').click();`);await wait(100);
  assert(await run(`return [...document.querySelectorAll('[data-settings-section]')].every(s=>!s.open);`),'Close all');
  await run(`document.querySelector('[data-folderall="1"]').click();`);await wait(100);
  assert(await run(`return [...document.querySelectorAll('[data-settings-section]')].every(s=>s.open);`),'Open all');
  await rail('performance');assert(await run(`return !!document.getElementById('perfout')&&document.getElementById('perfcopy').onclick instanceof Function;`),'performance panel retains controls');
  // Existing banner/logo previews still initialise and resize after their folder opens.
  await run(`const pic='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100"><rect fill="teal" width="400" height="100"/></svg>');state.settings=await api.setSettings({homeHeader:pic,clubLogo:pic,homeLogoSide:'left',homeHeaderHeight:20});await renderGeneralSettings(document.getElementById('settingsbox'));`);await rail('header');
  assert(await run(`return document.getElementById('hdrprev').getBoundingClientRect().width>0;`),'banner preview has a measured size');
  await go('theme');await run(`await document.getElementById('settingsbox').onclick({target:document.querySelector('[data-pick="ocean"]')});`);await wait(80);
  assert(await run(`return document.documentElement.dataset.theme==='ocean'&&(await api.getSettings()).theme==='ocean';`),'theme saves');
  await rail('colours');await run(`const c=document.querySelector('[data-color="accent"]');c.value='#445588';document.getElementById('settingsbox').oninput({target:c});await document.getElementById('settingsbox').onchange({target:c});`);await wait(80);
  assert(await run(`return (await api.getSettings()).customColors.accent==='#445588'&&document.querySelector('[data-settings-section="colours"]').open;`),'custom colour and redraw');
  await go('director');await rail('values');await run(`const i=document.getElementById('pad-time');i.value='5, 15, 30';await document.getElementById('settingsbox').onchange({target:i});`);
  assert(await run(`return AdjustPad.valuesOf(await api.getSettings(),'time').join() === '5,15,30'&&document.getElementById('pad-preview').innerHTML.includes('data-v="15"');`),'pad values and preview');
  await rail('layout');await run(`await document.getElementById('settingsbox').onclick({target:document.querySelector('[data-padlayout="v"]')});`);
  assert(await run(`return (await api.getSettings()).padLayout==='v'&&document.getElementById('pad-preview').innerHTML.includes('pad-v');`),'pad layout saves');
  await go('network');await rail('access');await run(`const i=document.getElementById('net-pass');i.value='example';await i.onchange({target:i});`);
  assert.equal(await run(`return (await api.getSettings()).netPassword;`),'example');await rail('devices');
  assert(await run(`return document.getElementById('net-info').textContent.includes('192.0.2.1')&&!!document.querySelector('[data-qrpdf]');`),'addresses and QR action');
  assert.equal(await run(`return !!(await api.getSettings()).netOn;`),false,'test never starts sharing');
  await run(`window.qaDriver=await api.add('drivers',{name:'Example driver'});`);await go('transfer');await rail('export');
  await run(`const c=document.querySelector('[data-item="drivers:'+qaDriver.id+'"]');c.checked=true;await document.getElementById('settingsbox').onchange({target:c});`);await wait(120);
  assert(await run(`return document.querySelector('[data-settings-section="export"]').open&&!document.getElementById('tr-export').disabled;`),'export selection and open state');
  await run(`await document.getElementById('tr-export').onclick();`);assert.equal(exportCount,1);
  await rail('import');await run(`await document.getElementById('tr-open').onclick();`);await wait(100);
  assert(await run(`return document.querySelector('[data-settings-section="import"]').open&&!!document.getElementById('tr-apply');`),'import review visible');
  await run(`await document.getElementById('tr-apply').onclick();`);await wait(100);assert.equal(imports,1);
  await rail('backup');await run(`await document.getElementById('bk-open').onclick();`);await wait(100);
  assert(await run(`return document.querySelector('[data-settings-section="backup"]').open&&document.getElementById('bk-apply').textContent.includes('Replace everything');`),'restore warning/action retained');
  await run(`window.confirm=()=>false;await document.getElementById('bk-apply').onclick();`);assert.equal(restores,0,'cancelled restore');
  await run(`await document.getElementById('bk-cancel').onclick();`);await wait(80);
  const pages=['general','theme','director','network','transfer'],themes=await run(`return Theme.THEMES.filter(x=>x[0]!=='custom').map(x=>x[0]);`);
  for(const page of pages){
   for(const theme of themes){
    win.setContentSize(1400,1000);await run(`state.settings.theme='${theme}';applyTheme();`);await go(page);await run("scrollTo({top:0,behavior:'instant'})");await wait(100);
    assert(await run(`return document.querySelectorAll('.settings-page').length===1&&[...document.querySelectorAll('#settingsbox [id]')].every((e,i,a)=>a.findIndex(x=>x.id===e.id)===i);`),'one frame / unique IDs '+page);
    fs.writeFileSync(path.join(out,page+'-'+theme+'.png'),(await win.webContents.capturePage()).toPNG());
   }
   for(const width of [1000,600,420]){
    win.setContentSize(width,1000);await run(`document.querySelectorAll('[data-settings-section]').forEach(s=>s.open=true);scrollTo(0,0);`);await wait(70);
    assert(await run(`return document.documentElement.scrollWidth<=innerWidth+2;`),'no page overflow '+page+'/'+width);
    fs.writeFileSync(path.join(out,page+'-'+width+'.png'),(await win.webContents.capturePage()).toPNG());
   }
  }
  assert.deepEqual(await run('return qaErrors'),[]);
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed:true,checks:['five settings pages in eight themes','1000/600/420px with open folders','unique control IDs','rail and folder state across redraws','Open all / Close all','general saves and banner preview','theme and custom colour saves','pad values, layout and inert preview','network password and simulated QR output','export selection and simulated file actions','restore confirmation preserved','no runtime errors']},null,2));
  console.log('SETTINGS PAGES ELECTRON PASS');clearTimeout(timer);app.quit();
 }catch(e){console.error(e);fs.writeFileSync(path.join(out,'failure.png'),(await win.webContents.capturePage()).toPNG());app.exit(1);}
});});require('../../main');

