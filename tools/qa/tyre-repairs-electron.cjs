const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../../../outputs/tyre-repairs');fs.mkdirSync(out,{recursive:true});
app.setPath('appData',path.resolve(__dirname,'../../.tmp-test/tyre-repairs-'+process.pid));app.disableHardwareAcceleration();
let done=false;setTimeout(()=>app.exit(2),90000).unref();
app.on('browser-window-created',(_,win)=>win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
 const shot=async name=>{await new Promise(r=>setTimeout(r,120));fs.writeFileSync(path.join(out,name+'.png'),(await win.webContents.capturePage()).toPNG())};
 try{
  win.setMinimumSize(0,0);win.setContentSize(1200,950);win.showInactive();
  await run(`window.repairErrors=[];addEventListener('error',e=>repairErrors.push(e.message));`);
  const result=await run(fs.readFileSync(path.join(__dirname,'tyre-repairs-fixtures.js'),'utf8'));
  fs.writeFileSync(path.join(out,'edgecases.json'),JSON.stringify(result,null,2));
  for(const [i,size] of [11,32].entries()){
   const r=result.typography[i];assert.equal(parseFloat(r.detailSize),size);assert(r.detailFont.includes('Roboto Mono'));assert.equal(r.primaryWeight,'900');assert.equal(r.iconWidth,i?100:20);assert.equal(r.status,'fits');
  }
  assert.equal(result.fuelTypography.weight,'900');assert.equal(result.fuelTypography.supportWeight,'700');assert(result.fuelTypography.supportFont.includes('Roboto Mono'));assert.equal(result.fuelTypography.status,'fits');
  for(const r of result.oneFact){assert.equal(r.status,'fits');assert.equal(r.primaryWidth,r.footerWidth);assert(r.text.trim());}
  for(const r of result.labels){assert.equal(r.shown,r.tyre);assert.equal(r.meters,1);assert.equal(r.heads,1);assert.equal(r.status,'fits');}
  for(const r of result.geometry){assert.equal(r.status,'fits',JSON.stringify(r));if(r.fields.showGrip&&!r.fields.showPct&&!r.fields.showLeft){assert(r.text.includes('grip'));assert(!r.detailHidden);}}
  for(const theme of ['dark','light','ocean']){await run(`state.settings.theme='${theme}';applyTheme();`);await shot(theme);}
  const saved=await run(`
   document.querySelectorAll('body>.canvas').forEach(n=>n.remove());
   window.ck=(v,m)=>{if(!v)throw Error(m)};
   const old={...Widgets.newWidget('tyrelife',0,0,0),opt:{look:'bar',dir:'vertical'},w:180,h:350};
   const fresh={...Widgets.newWidget('tyrelife',1,200,0),opt:{...Widgets.newWidget('tyrelife').opt,look:'bar'},w:450,h:300};
   const layout={name:'Repair compatibility',ratioW:10,ratioH:6,widgets:[old,fresh],guides:{v:[],h:[]}};
   const before=JSON.stringify(layout.widgets),record=await api.add('layouts',layout),loaded=(await api.list('layouts')).find(x=>x.id===record.id);
   ck(JSON.stringify(loaded.widgets)===before,'saved layout options changed');
   state.tab='custom';state.customSub='layouts';state.sideOpen=new Set(['opts']);state.editing={id:record.id,draft:loaded,sel:[loaded.widgets[0]],snap:false,dirty:false,drivers:[],cars:[],teams:[],customWidgets:[],imageSets:[],rowDesigns:[],chartDesigns:[]};await render();
   ck(document.querySelector('#side [data-opt="barStyle"]').value==='legacy','older layout style not shown');
   ck(!document.querySelector('#side [data-opt="showIcon"]'),'classic shows unsupported control');
   state.editing.sel=[loaded.widgets[1]];await render();ck(document.querySelector('#side [data-opt="barStyle"]').value==='original','new widget style not shown');ck(document.querySelector('#side [data-opt="showIcon"]').checked,'new icon default');
   state.editing.sel=[loaded.widgets[0]];await render();const select=document.querySelector('#side [data-opt="barStyle"]');select.value='original';select.dispatchEvent(new Event('change',{bubbles:true}));
   ck(state.editing.sel[0].opt.barStyle==='original','explicit upgrade did not save');ck(document.querySelector('#side [data-opt="showIcon"]'),'upgrade controls missing');
   return {unchanged:true,oldStyle:'legacy',newStyle:'original',upgrade:true};
  `);
  await shot('editor');fs.writeFileSync(path.join(out,'compatibility.json'),JSON.stringify(saved,null,2));
  assert.deepEqual(await run('return repairErrors;'),[]);
  console.log('TYRE REPAIRS ELECTRON PASSED: computed typography, icon sizes, literal names, single-fact geometry, three themes, saved layouts and actual editor compatibility controls');app.quit();
 }catch(e){console.error(e);await shot('failure');app.exit(1);}
}));require('../../main');
