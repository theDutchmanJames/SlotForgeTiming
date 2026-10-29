// Exercise real feature shortcuts without activating plugins or changing hardware.
const {app,dialog}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../../../outputs/plugin-guidance');fs.mkdirSync(out,{recursive:true});
app.setPath('appData',path.resolve(__dirname,'../../.tmp-test/plugin-guidance-'+process.pid));app.disableHardwareAcceleration();
let file,done=false;dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});
const wait=ms=>new Promise(r=>setTimeout(r,ms));setTimeout(()=>app.exit(2),90000).unref();
app.on('browser-window-created',(_,win)=>win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
 const shot=async name=>{await wait(120);fs.writeFileSync(path.join(out,name+'.png'),(await win.webContents.capturePage()).toPNG());};
 try{
  win.setMinimumSize(0,0);win.setContentSize(1440,1100);await wait(400);
  await run(`window.qaErrors=[];addEventListener('error',e=>qaErrors.push(e.message));addEventListener('unhandledrejection',e=>qaErrors.push(String(e.reason)));window.ck=(v,m)=>{if(!v)throw Error(m)};state.tab='settings';state.settingsSub='plugins';await render();window.qaSettings=JSON.stringify(await api.getSettings());`);
  const display=require('../fixtures/display-plugin.cjs').make(),widgets=require('../fixtures/display-plugin.cjs').make(),timing=require('../fixtures/timing-plugin.cjs').make(),rules=require('../fixtures/rule-plugin.cjs').make();
  widgets.manifest.id='example.only-widgets';widgets.manifest.name='Widget-only example';widgets.manifest.display.pages=[];widgets.manifest.display.tools=[];
  for(const p of [display,widgets,timing,rules]){file=path.join(out,p.manifest.id+'.slotforge-plugin');fs.writeFileSync(file,JSON.stringify(p));await run(`await api.pluginsOpen();await api.pluginsInstall();`);}
  await run(`await PluginsPage.render(document.getElementById('settingsbox'));const card=document.querySelector('[data-plugin-id="example.only-widgets"]');ck(card.querySelector('[data-plugin-go="widgets"]'),'Widget shortcut');ck(!card.querySelector('[data-plugin-go="pages"]'),'Widget-only plugin does not offer empty Pages & Tools');ck(document.querySelector('[data-plugin-id="${display.manifest.id}"] [data-plugin-go="pages"]'),'Page/tool shortcut');`);
  const targets=[['timing',timing.manifest.id,"state.tab==='settings'&&state.settingsSub==='hardware'&&state.hwSub==='plugin'"],['widgets',widgets.manifest.id,"state.tab==='custom'&&state.customSub==='layouts'"],['pages',display.manifest.id,"state.tab==='custom'&&state.customSub==='pluginpages'"],['rules',rules.manifest.id,"state.tab==='setup'&&state.setupSub==='setups'"]];
  for(const [target,id,check] of targets){
   await run(`document.querySelector('[data-plugin-id="${id}"] [data-plugin-go="${target}"]').click();`);await wait(180);
   await run(`ck(${check},'Correct ${target} destination');ck(JSON.stringify(await api.getSettings())===qaSettings,'Shortcut does not change settings');ck((await api.pluginsList()).plugins.every(p=>!p.enabled&&p.state==='stopped'),'Shortcut does not start plugins');state.tab='settings';state.settingsSub='plugins';await render();`);
  }
  const themes=['dark','light','midnight','forest','sunset','violet','carbon','ocean'];
  for(const theme of themes){
   win.setContentSize(1440,1100);await run(`state.settings.theme='${theme}';applyTheme();await PluginsPage.render(document.getElementById('settingsbox'));document.querySelectorAll('[data-settings-section]').forEach(el=>el.open=false);document.querySelector('[data-interface-go="roadmap"]').click();const box=document.getElementById('settingsbox');ck(!box.textContent.includes('Content Packs'),'No unrelated sharing references');ck(box.querySelectorAll('.plugin-capability').length===5,'All five feature groups');ck(box.textContent.includes('new version’s default settings'),'Update defaults explained');ck(box.textContent.includes('If only a widget, page or tool times out'),'Display timeout explained');ck(!box.textContent.includes('Available APIs'),'Plain language folder');`);await shot(theme);
   win.setContentSize(600,1000);await wait(80);await run(`const box=document.getElementById('settingsbox');ck(box.scrollWidth<=box.clientWidth+2,'Narrow page fits');for(const card of box.querySelectorAll('.plugin-capability'))ck(card.scrollWidth<=card.clientWidth+2,'Feature card fits');document.querySelector('[data-interface-go="roadmap"]').click();`);await shot(theme+'-600');
  }
  win.setContentSize(1440,1100);await run(`state.settings.theme='dark';applyTheme();document.querySelector('[data-settings-section="roadmap"]').open=false;document.querySelector('[data-interface-go="installed"]').click();`);await shot('installed-shortcuts');
  win.setContentSize(600,1000);await wait(80);await run(`for(const card of document.querySelectorAll('.plugin-card'))ck(card.scrollWidth<=card.clientWidth+2,'Installed feature shortcuts fit narrow cards');`);await shot('installed-shortcuts-600');
  assert.deepEqual(await run('return qaErrors;'),[]);
  fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({passed:true,themes,widths:[1440,600],checks:['Feature-specific installed shortcuts','Widget-only plugin excludes Pages & Tools','All four real navigation routes','No hardware/settings changes or automatic plugin starts','Update defaults and recovery explained','Five readable feature groups','No Content Packs references','No renderer errors']},null,2));
  console.log('PLUGIN GUIDANCE ELECTRON PASSED');app.quit();
 }catch(e){console.error(e);await shot('failure');app.exit(1);}
}));require('../../main');
