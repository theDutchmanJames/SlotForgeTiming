// Real renderer / preload / IPC / isolated database. No user data or hardware.
const {app,dialog}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const version=require('../../package.json').version;
const P=require('../../contentpacks'),W=require('../../renderer/widgets'),Theme=require('../../renderer/theme');
const out=path.resolve(__dirname,'../../../outputs/content-packs');fs.mkdirSync(out,{recursive:true});
app.setPath('appData',path.resolve(__dirname,'../../.tmp-test/content-packs-'+process.pid));app.disableHardwareAcceleration();
const input=path.join(out,'club-night.slotforge-pack'),output=path.join(out,'exported.slotforge-pack');
const pack={format:P.FORMAT,apiVersion:1,manifest:{id:'example.club-night',name:'Club Night Collection',author:'SlotForge example',license:'CC0-1.0',description:'An editable timing screen, comparison chart and teal app palette.',version:'1.0.0',minAppVersion:'1.99.2'},items:{chartdesigns:[{id:'lap-chart',name:'Club lap comparison',style:'bars',drivers:'selected',lanes:[0,1,2,3],reference:'none'}],layouts:[{id:'club-layout',name:'Club timing screen',ratioW:16,ratioH:9,widgets:[W.newWidget('name',0,20,20),{...W.newWidget('racechart',null,20,180),w:900,h:350,opt:{chartDesign:'lap-chart'}}]}]},themes:[{id:'teal',name:'Club Teal',colors:{...Theme.DEFAULT,accent:'#43c9b0'}}]};
fs.writeFileSync(input,JSON.stringify(P.validate(pack,version),null,2));
dialog.showOpenDialog=async()=>({canceled:false,filePaths:[input]});dialog.showSaveDialog=async()=>({canceled:false,filePath:output});
const wait=ms=>new Promise(r=>setTimeout(r,ms));let done=false;setTimeout(()=>app.exit(2),120000).unref();
app.on('browser-window-created',(_,win)=>win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
 const shot=async name=>{await wait(100);fs.writeFileSync(path.join(out,name+'.png'),(await win.webContents.capturePage()).toPNG());};
 const click=async selector=>{await run(`document.querySelector(${JSON.stringify(selector)}).click();`);for(let i=0;i<60;i++){await wait(50);if(await run(`return !document.querySelector('#settingsbox[aria-busy]');`))return;}throw Error('UI operation timed out');};
 try{
  win.setMinimumSize(0,0);win.setContentSize(1280,1000);win.showInactive();await wait(400);
  await run(`window.packErrors=[];addEventListener('error',e=>packErrors.push(e.message));addEventListener('unhandledrejection',e=>packErrors.push(String(e.reason)));window.confirm=()=>true;window.ck=(v,m)=>{if(!v)throw Error(m)};state.tab='settings';state.settingsSub='transfer';await render();ck(document.getElementById('tr-export')&&document.getElementById('bk-save'),'Original sharing and backups available');document.querySelector('[data-transfer-view=\"packs\"]').click();`);
  await wait(150);await run(`ck(document.getElementById('pack-open'),'Content Packs under Import and Export');`);await shot('empty');await click('#pack-open');
  await run(`ck(document.querySelector('.pack-review'),'Review visible');ck((await api.packsList()).packs.length===0,'Review does not install');`);await shot('review');await click('#pack-install');
  await run(`ck((await api.packsList()).packs.length===1,'Installed');`);
  await click('[data-pack-action="copy"]');
  await run(`const m=await api.packsList();ck(m.choices.layouts.items.length===1&&m.choices.chartdesigns.items.length===1,'Linked content copied');const layouts=await api.list('layouts'),charts=await api.list('chartdesigns');ck(layouts[0].widgets[1].opt.chartDesign===charts[0].id,'Copied link remapped');window.originalCopies=JSON.stringify(layouts);`);
  await run(`window.sharedDriver=await api.add('drivers',{name:'Example export driver'});document.querySelector('[data-transfer-view="items"]').click();`);await wait(150);
  await run(`const input=document.querySelector('[data-item="drivers:'+sharedDriver.id+'"]');input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}));`);await wait(150);
  await run(`ck(!document.getElementById('tr-export').disabled,'Existing item selection still works');document.querySelector('[data-transfer-view="packs"]').click();`);await wait(150);
  await run(`ck((await api.packsList()).packs.length===1,'Switch keeps library');document.querySelector('[data-transfer-view="items"]').click();`);await wait(150);
  await run(`ck(document.querySelector('[data-item="drivers:'+sharedDriver.id+'"]').checked,'Item selection survives workflow switch');ck(document.getElementById('bk-open')&&document.getElementById('tr-open'),'Backup and import actions retained');document.querySelector('[data-transfer-view="packs"]').click();`);await wait(150);
  // Return to Installed via the real rail after the install review selected its folder.
  const themes=['dark','light','midnight','forest','sunset','violet','carbon','ocean'];
  for(const theme of themes){
   win.setContentSize(1280,1000);await run(`state.settings.theme=${JSON.stringify(theme)};applyTheme();await ContentPacksPage.render(document.getElementById('settingsbox'));document.querySelector('[data-interface-go="installed"]').click();window.scrollTo(0,0);`);
   await shot(theme+'-installed');
   await run(`state.settingsSub='plugins';await render();ck(!document.getElementById('pack-open'),'Code plugins are separate from content imports');document.querySelector('[data-interface-go="roadmap"]').click();const text=document.getElementById('settingsbox').textContent;ck(text.includes('What plugins can do')&&text.includes('Race rules')&&text.includes('app-rendered blocks'),'Available APIs and display limits explicit');`);await shot(theme+'-plugin-plan');
   win.setContentSize(600,1000);await wait(80);await run(`const box=document.getElementById('settingsbox');ck(box.scrollWidth<=box.clientWidth+2,'Plugin plan fits 600px');`);await shot(theme+'-plugin-plan-narrow');
   await run(`ck(!document.getElementById('settingsbox').textContent.includes('Content Packs'),'Plugin guidance stays focused on plugins');state.settingsSub='transfer';TransferViews.select('packs');await render();`);await wait(100);await run(`ck(state.settingsSub==='transfer'&&document.getElementById('pack-open'),'Content Packs remain available under Import and Export');`);
   win.setContentSize(600,1000);await wait(80);await run(`const box=document.getElementById('settingsbox');ck(box.scrollWidth<=box.clientWidth+2,'Collections fit 600px');`);await shot(theme+'-narrow');
  }
  win.setContentSize(1280,1000);await click('[data-pack-action="theme"]');await run(`ck(state.settings.theme==='custom'&&state.settings.customColors.accent==='#43c9b0','Theme applied explicitly');`);
  await click('[data-pack-action="enable"]');await run(`ck(!(await api.packsList()).packs[0].enabled,'Disabled');ck(JSON.stringify(await api.list('layouts'))===originalCopies,'Disable retains copies');`);await click('[data-pack-action="enable"]');
  pack.manifest.version='1.1.0';pack.manifest.description='Updated library; existing copies remain yours.';fs.writeFileSync(input,JSON.stringify(pack));await click('#pack-open');await click('#pack-install');await click('[data-pack-action="rollback"]');await run(`ck((await api.packsList()).packs[0].manifest.version==='1.0.0','Rollback');`);
  await click('[data-pack-action="export"]');assert.equal(P.validate(JSON.parse(fs.readFileSync(output,'utf8')),version).manifest.version,'1.0.0');
  await run(`document.querySelector('[data-interface-go="create"]').click();for(const [k,v]of Object.entries({id:'example.shared',name:'My shared collection',author:'Example author',version:'1.0.0',license:'CC0-1.0'})){const el=document.querySelector('[data-pack-meta="'+k+'"]');el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));}const p=document.querySelector('[data-pack-pick="layouts"]');p.checked=true;p.dispatchEvent(new Event('change',{bubbles:true}));const t=document.getElementById('pack-theme-on');t.checked=true;t.dispatchEvent(new Event('change',{bubbles:true}));`);
  await run(`ck(document.getElementById('pack-theme-on').getBoundingClientRect().width===16,'Compact sharing checkbox');ck(getComputedStyle(document.getElementById('pack-theme-on').parentElement).flexDirection==='row','Checkbox and label share one row');`);
  await shot('create');await click('#pack-create');const shared=P.validate(JSON.parse(fs.readFileSync(output,'utf8')),version);assert.equal(shared.items.chartdesigns.length,1);assert.equal(shared.themes.length,1);
  await run(`state.tab='custom';state.customSub='layouts';await render();document.querySelector('#setupbox [data-edit]').click();`);await wait(250);
  await run(`ck(document.querySelectorAll('#canvas .lw[data-i]').length===2,'Copied layout renders in real editor');ck(document.querySelector('#canvas svg'),'Copied chart produces its preview');`);await shot('copied-layout');
  await run(`editorLeave();state.tab='settings';state.settingsSub='transfer';await render();`);
  await click('[data-pack-action="remove"]');await run(`ck((await api.packsList()).packs.length===0,'Removed from library');ck(JSON.stringify(await api.list('layouts'))===originalCopies,'Remove keeps copied layouts');ck((await api.getSettings()).customColors.accent==='#43c9b0','Theme remains');`);
  assert.deepEqual(await run('return packErrors;'),[]);
  fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({passed:true,themes,widths:[1280,600],checks:['Content Packs under Import and Export','Available runtime, timing, display and rule APIs distinguished','Content Packs remain available under Import and Export','Item export selection survives workflow switching','Original import/backup actions retained','Real navigation and file review','Installation through IPC','Copied dependencies remapped','Explicit theme application','Disable leaves copies intact','Manual update and rollback','Export round-trip','Create with dependencies and palette','Removal retains copies and theme','Copied layout renders in real editor','No renderer errors']},null,2));
  console.log('CONTENT PACKS ELECTRON PASSED: eight themes, 600/1280 widths, real install/copy/theme/update/rollback/export/create/remove flows.');app.quit();
 }catch(e){console.error(e);await shot('failure');app.exit(1);}
}));require('../../main');
