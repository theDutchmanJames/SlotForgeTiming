const {app}=require('electron'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../../../outputs/database-actions'),data=path.resolve(__dirname,'../../.tmp-test/database-actions-'+process.pid);
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(data,{recursive:true});app.setPath('appData',data);app.disableHardwareAcceleration();
let done=false;const wait=ms=>new Promise(r=>setTimeout(r,ms)),timer=setTimeout(()=>app.exit(1),60000);
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
 try{
  await wait(300);win.setContentSize(1280,900);await run(`window.qaErrors=[];addEventListener('error',e=>qaErrors.push(e.message));addEventListener('unhandledrejection',e=>qaErrors.push(String(e.reason)));`);
  const entities=await run('return [...COPY_SETUP_ENTITIES];');
  for(const entity of entities){
   await run(`window.seed={...Object.fromEntries(state.schema['${entity}'].fields.filter(f=>f.default!==undefined).map(f=>[f.key,f.default])),name:'Club setup',track:'track-reference',custom:{note:'Retained'},auditNested:{items:[1,2,3]}};window.original=await api.add('${entity}',seed);window.originalJSON=JSON.stringify(original);state.tab='setup';await render();`);
   for(const mode of ['list','grid']){
    await run(`state.settings.dbView=state.settings.setupView='${mode}';await mountManager(document.getElementById('setupmgr'),'${entity}');const b=document.querySelector('[data-copy="'+original.id+'"]');if(!b)throw Error('Missing Copy: ${entity}/${mode}');await document.getElementById('setupmgr').onclick({target:b});`);
    const info=await run(`const rows=await api.list('${entity}'),copy=rows.find(x=>x.name==='Club setup (${mode==='list'?'copy':'copy 2'})');if(!copy)throw Error('Copy missing from saved list');if(!document.querySelector('[data-edit="'+copy.id+'"]'))throw Error('Copy missing from screen');const expected={...original,id:copy.id,name:copy.name};if(JSON.stringify(copy)!==JSON.stringify(expected))throw Error('Copy changed fields');await api.update('${entity}',copy.id,{name:copy.name+' edited',auditNested:{items:[99]}});const source=(await api.list('${entity}')).find(x=>x.id===original.id);if(JSON.stringify(source)!==originalJSON)throw Error('Source changed');await api.update('${entity}',copy.id,{name:'Club setup (${mode==='list'?'copy':'copy 2'})'});return {id:copy.id,source:original.id};`);
    assert.notEqual(info.id,info.source);
   }
  }
  await run(`state.setupSub='fuel';await render();`);await wait(80);fs.writeFileSync(path.join(out,'copy-fuel.png'),(await win.webContents.capturePage()).toPNG());
  for(const width of [480,760]){
   win.setMinimumSize(0,0);win.setContentSize(width,900);await wait(60);
   assert(await run(`return [...document.querySelectorAll('.gcard .row button')].every(b=>{const r=b.getBoundingClientRect(),c=b.closest('.gcard').getBoundingClientRect();return r.left>=c.left+10&&r.right<=c.right-10;});`),'copy actions fit narrow cards');
  }
  win.setContentSize(1280,900);
  for(const entity of ['tracks','drivers','slotcars']){
   await run(`for(const n of ['Zulu','Car 10','Car 2','alpha'])await api.add('${entity}',${entity==='slotcars'?' {brand:n,manufacturer:"Test",model:"GT"}':' {name:n,lanes:2}'});state.tab='database';state.sub='${entity}';await render();window.storedOrder=(await api.list('${entity}')).map(x=>x.id).join();`);
   for(const mode of ['list','grid']){
    await run(`state.settings.dbView='${mode}';await mountManager(document.getElementById('subview'),'${entity}');`);
    const names=await run(`return [...document.querySelectorAll('#subview [data-view]')].map(x=>x.getAttribute('aria-label').replace(/^View /,''));`);
    assert.deepEqual(names,entity==='slotcars'?['alpha Test GT','Car 2 Test GT','Car 10 Test GT','Zulu Test GT']:['alpha','Car 2','Car 10','Zulu']);
    assert(await run(`return (await api.list('${entity}')).map(x=>x.id).join()===storedOrder;`),'view sorting changed persisted order');
    assert(await run(`return !document.querySelector('#subview [data-copy]');`),'database records must not get setup Copy action');
   }
  }
  await run(`state.sub='drivers';await render();`);await wait(80);fs.writeFileSync(path.join(out,'alphabetical-drivers.png'),(await win.webContents.capturePage()).toPNG());
  // Re-read the saved records through the main-process API.
  assert(await run(`return (await api.list('tyrewearsystems')).length===3;`));
  assert.deepEqual(await run('return qaErrors'),[]);
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed:true,checks:['eight setup types copied in List and Cards/Grid','unique IDs and copy names','all saved fields and links retained','editing a copy leaves original unchanged','tracks, drivers and slotcars A–Z in both views','stored record order unchanged','no runtime errors']},null,2));
  console.log('DATABASE ACTIONS ELECTRON PASS');clearTimeout(timer);app.quit();
 }catch(e){console.error(e);fs.writeFileSync(path.join(out,'failure.png'),(await win.webContents.capturePage()).toPNG());app.exit(1);}
});});require('../../main');
