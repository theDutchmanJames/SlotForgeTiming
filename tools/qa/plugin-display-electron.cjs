const {app,dialog,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../../../outputs/plugin-display'),data=path.resolve(__dirname,'../../.tmp-test/plugin-display-electron-'+process.pid);fs.mkdirSync(out,{recursive:true});app.setPath('appData',data);app.disableHardwareAcceleration();
const pack=require('../fixtures/display-plugin.cjs').make();
pack.files[pack.entry]=Buffer.from(Buffer.from(pack.files[pack.entry],'base64').toString().replace('estimate:(c,{settings})=>{','estimate:async(c,{settings})=>{await new Promise(resolve=>setTimeout(resolve,1400));')).toString('base64');
const file=path.join(out,'race-companion.slotforge-plugin');fs.writeFileSync(file,JSON.stringify(pack,null,2));dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});
const wait=ms=>new Promise(r=>setTimeout(r,ms));let done=false;setTimeout(()=>app.exit(2),150000).unref();
app.on('browser-window-created',(_,win)=>win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 const run=s=>win.webContents.executeJavaScript('(async()=>{'+s+'})()');
 const until=async code=>{for(let i=0;i<150;i++){if(await run(code))return;await wait(60);}throw Error('Timed out: '+code);};
 const shot=async name=>{await wait(200);fs.writeFileSync(path.join(out,name+'.png'),(await win.webContents.capturePage()).toPNG());};
 try{
  win.setMinimumSize(0,0);win.setContentSize(1440,1000);win.showInactive();await wait(500);
  await run(`window.confirm=()=>true;window.qaErrors=[];addEventListener('error',e=>qaErrors.push(e.message));addEventListener('unhandledrejection',e=>qaErrors.push(String(e.reason)));window.ck=(v,m)=>{if(!v)throw Error(m)};window.qaPlugin=await api.pluginsOpen();await api.pluginsInstall();await api.pluginsStart(qaPlugin.manifest.id,qaPlugin.digest,true);await PluginDisplayClient.refresh();
   state.tab='custom';state.customSub='layouts';state.sideOpen=new Set(['opts']);
   const lane={...Widgets.newWidget('pluginlane',0,20,30),w:460,h:210,opt:{pluginView:'example.race-display/pace'},appearance:{source:'theme',border:'shade',accent:'lane',radiusPixels:14}};
   const field={...Widgets.newWidget('pluginrace',null,510,30),w:470,h:470,opt:{pluginView:'example.race-display/field'}};
   window.qaLayout={name:'Plugin widgets QA',ratioW:10,ratioH:5.5,widgets:[lane,{...Widgets.newWidget('laptime',0,20,280),w:460,h:160},field],laneColors:[{bg:'#35a8c7'}],guides:{v:[],h:[]}};
   state.editing={id:null,draft:qaLayout,sel:[lane],snap:false,dirty:true,drivers:[],cars:[],teams:[],customWidgets:[],imageSets:[],rowDesigns:[],chartDesigns:[]};await render();`);
  await until(`return document.querySelector('#canvas .plugin-view')?.textContent.includes('James');`);
  await run(`const el=document.querySelector('[data-opt=plugin_target]');ck(el,'Generated target control');el.value=12;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));`);
  await until(`return document.querySelector('#canvas .plugin-view')?.textContent.includes('12.000');`);
  await run(`const saved=await api.add('layouts',qaLayout);window.qaSaved=saved;const loaded=(await api.list('layouts')).find(l=>l.id===saved.id);ck(loaded.widgets[0].opt.plugin_target===12,'Save/reopen retains inputs');await document.fonts.ready;fitEditorWidgets();`);await shot('editor');
  assert(await run(`return [...document.querySelectorAll('#canvas .lw-val')].every(v=>Frame.textFits(v));`),'Editor text fits');
  for(const theme of ['dark','light','midnight','forest','sunset','violet','carbon','ocean']){await run(`state.settings.theme='${theme}';applyTheme();fitEditorWidgets();`);await wait(150);assert(await run(`return [...document.querySelectorAll('#canvas .lw-val')].every(v=>Frame.textFits(v));`),'Widget text fits '+theme);await shot(theme+'-widgets');}
  await run(`
   const el=document.querySelector('#canvas .lw'),val=el.querySelector('.lw-val'),w=state.editing.draft.widgets[0];
   const metric={kind:'metric',label:'Lap time',text:'12.345'};
   for(const kind of ['row','column','row']){const out={html:PluginDisplay.html({kind,children:[metric,metric,metric]})};val.innerHTML=out.html;WidgetView.fit({el,val,w,layout:qaLayout},out);ck(Frame.textFits(val),'Dynamic plugin structure refits');}
  `);
  await run(`state.editing=null;state.customSub='pluginpages';await render();`);await until(`return document.querySelector('.pd-page-output')?.textContent.includes('James');`);await shot('page');
  await run(`document.querySelector('[data-page="1"]').click();document.querySelector('[data-plugin-setting=laps]').value='';document.querySelector('[data-run]').click();`);
  await until(`return document.querySelector('.pd-page-output')?.textContent.includes('outside range');`);
  await run(`document.querySelector('[data-plugin-setting=laps]').value=60;document.querySelector('[data-run]').click();`);await wait(650);
  assert(await run(`return document.querySelector('[data-run]').disabled&&document.querySelector('[data-page-message]').textContent==='Running tool…';`),'Refresh keeps pending tool locked');await shot('tool-running');
  await until(`return document.querySelector('.pd-page-output')?.textContent.includes('10.0 minutes');`);await shot('tool');
  const themes=['dark','light','midnight','forest','sunset','violet','carbon','ocean'];
  for(const theme of themes){win.setContentSize(1440,1000);await run(`state.settings.theme='${theme}';applyTheme();state.customSub='pluginpages';await render();`);await until(`return document.querySelector('.pd-page-output')?.textContent.includes('James');`);await shot(theme);win.setContentSize(600,900);await wait(100);assert(await run(`return document.documentElement.scrollWidth<=innerWidth+2;`),'600px page fits '+theme);await shot(theme+'-600');}
  win.setContentSize(1280,950);
  // Real race/share path, including a plugin shown only on the second layout.
  await run(`const james=await api.add('drivers',{name:'James'}),sam=await api.add('drivers',{name:'Sam'});state.tab='race';state.race={setup:{id:'display-qa',name:'Plugin display race',sessionType:'race',laps:20,firstLap:'count',lightsMin:0,lightsMax:0,layout2:qaSaved.id},track:{id:'qa-track',name:'Plugin Raceway',lanes:2,minLap:0},rows:[{driverId:james.id},{driverId:sam.id}]};await render();live.actions.start();`);await until(`return live.phase==='running';`);
  await assert.rejects(run(`await api.pluginDisplayTool({plugin:'example.race-display',item:'estimate',settings:{}});`),/Finish the race/);
  await until(`const v=await api.liveGet();return Object.values(v.dyn?.pluginViews||{}).some(x=>JSON.stringify(x).includes('Plugin Raceway'));`);
  await run('await api.liveOpen();');await wait(800);const second=BrowserWindow.getAllWindows().find(w=>w!==win&&w.webContents.getURL().endsWith('#live'));assert(second,'Second Electron window opened');const run2=s=>second.webContents.executeJavaScript('(async()=>{'+s+'})()');
  await run2(`document.querySelector('[data-page="timing"], [data-tile="timing"]')?.click();`);
  // LiveView.go is intentionally public and used by the normal navigation.
  await run2(`LiveView.go('timing');`);await wait(1000);
  assert(await run2(`return document.body.textContent.includes('Plugin Raceway');`),'Second display receives plugin data');
  await assert.rejects(run2(`await api.pluginDisplayCatalog();`),/main app window/);
  fs.writeFileSync(path.join(out,'second-screen.png'),(await second.webContents.capturePage()).toPNG());second.close();
  const wire=await run('return await api.liveGet();');
  const server=require('../../server').createServer({root:path.resolve(__dirname,'../../renderer'),appRoot:path.resolve(__dirname,'../..'),schema:require('../../schema'),getSettings:()=>({theme:'dark'}),list:()=>[],customFields:()=>[],getLive:()=>wire,onCommand:()=>{}});
  const port=await server.listen(0,'127.0.0.1'),web=new BrowserWindow({show:false,width:1100,height:800,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
  await web.loadURL('http://127.0.0.1:'+port+'/#live');await wait(800);await web.webContents.executeJavaScript(`LiveView.go('timing')`);await wait(500);
  assert(await web.webContents.executeJavaScript(`document.body.textContent.includes('Plugin Raceway')&&!window.api.pluginDisplayRender`),'HTTP viewer draws plugin data without execution API');
  assert(await web.webContents.executeJavaScript(`[...document.querySelectorAll('.plugin-view .pd-metric>span')].every(n=>getComputedStyle(n).whiteSpace==='nowrap'&&Frame.textFits(n,n.parentElement,false))`),'Network metric values stay on one line and fit their own columns');
  fs.writeFileSync(path.join(out,'network-viewer.png'),(await web.webContents.capturePage()).toPNG());web.destroy();await server.close();
  await run('live.actions.stop();');await until(`return live.phase==='review';`);await run(`await live.reviewCommand({op:'discard'});`);await until(`return (await api.liveGet()).dyn?.phase==='finished';`);await run(`live.leave();live.alive=false;state.race=null;state.tab='custom';state.customSub='pluginpages';await render();`);await wait(300);
  await run(`await api.pluginsStop('example.race-display');`);await until(`return document.querySelector('.pd-page-output')?.textContent.includes('not running');`);
  await run(`state.editing={id:qaSaved.id,draft:structuredClone(qaSaved),sel:[],snap:false,dirty:false,drivers:[],cars:[],teams:[],customWidgets:[],imageSets:[],rowDesigns:[],chartDesigns:[]};await render();`);await until(`return document.querySelector('#canvas .plugin-view')?.textContent.includes('not running');`);await shot('stopped-placeholder');
  await run(`await api.pluginsRemove('example.race-display',false);await PluginDisplayClient.refresh();ck(state.editing.draft.widgets[0].opt.plugin_target===12,'Removing plugin preserves layout');`);await wait(1000);await shot('missing-placeholder');
  assert.deepEqual(await run('return qaErrors;'),[]);
  fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({passed:true,themes,widths:[1440,600],checks:['Separately installed utility-process plugin','Real Layout Editor generated settings','Save/reopen','Shared text fitting','Dynamic view structure refits','Pages and explicit tools','Tools locked during races','Second-only layout demand','Second Electron renderer without plugin execution','HTTP browser viewer without execution API','Main-frame IPC isolation','Stopped/missing placeholders','Saved settings retained','Widgets and pages in eight themes','No renderer errors']},null,2));
  console.log('PLUGIN DISPLAY ELECTRON PASSED');app.quit();
 }catch(e){console.error(e);console.error(await run('return {errors:qaErrors,body:document.body.innerText.slice(-3000)};'));await shot('failure');app.exit(1);}
}));require('../../main');
