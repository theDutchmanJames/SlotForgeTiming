// Real renderer, isolated appData: no user settings, saved designs or hardware touched.
const {app}=require('electron'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../../../outputs/subtab-colours-implementation');
const data=path.resolve(__dirname,'../../.tmp-test/tabstyle-'+process.pid);
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(data,{recursive:true});app.setPath('appData',data);app.disableHardwareAcceleration();
let done=false;const wait=ms=>new Promise(r=>setTimeout(r,ms)),timer=setTimeout(()=>app.exit(1),90000);
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
 try{
  await wait(400);win.setMinimumSize(0,0);win.setContentSize(1280,900);
  await run(`window.qaErrors=[];addEventListener('error',e=>qaErrors.push(e.message));addEventListener('unhandledrejection',e=>qaErrors.push(String(e.reason)));`);
  const themes=await run(`return Theme.THEMES.filter(x=>x[0]!=='custom').map(x=>x[0]);`);
  const report=[];
  for(const theme of [...themes,'custom-dark','custom-light']){
   await run(`state.settings.theme=${JSON.stringify(theme.startsWith('custom')?'custom':theme)};state.settings.customColors=${JSON.stringify(theme==='custom-light'?{bg:'#f2f5f3',panel:'#ffffff',ink:'#15251c',muted:'#52675a',line:'#bccbbf',accent:'#397352'}:{bg:'#141522',panel:'#23243a',ink:'#f5edff',muted:'#b0acc9',line:'#41435e',accent:'#bb9be8'})};applyTheme();`);
   for(const [page,sub,bar]of [['custom','widgets','customtabs'],['settings','hardware','settingstabs'],['setup','fuel','setuptabs'],['database','tracks','subtabs']]){
    await run(`state.tab='${page}';state.customSub='widgets';state.settingsSub='hardware';state.hwSub='trackmate';state.setupSub='fuel';state.sub='tracks';await render();scrollTo(0,0);`);
    await wait(40);
    const stats=await run(`
     const tabs=[...document.querySelectorAll('#${bar} .tab,#${bar} .sstab')];
     const colour=s=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const c=canvas.getContext('2d');c.fillStyle=s;c.fillRect(0,0,1,1);return '#'+[...c.getImageData(0,0,1,1).data].slice(0,3).map(x=>x.toString(16).padStart(2,'0')).join('');};
     return tabs.map(el=>{const c=getComputedStyle(el),bg=colour(c.backgroundColor),ink=colour(c.color);return {id:el.dataset.id,tone:colour(c.getPropertyValue('--tab-tone')),edge:colour(c.borderLeftColor),border:c.borderLeftWidth,contrast:Theme.ratio(ink,bg),selected:el.getAttribute('aria-selected')==='true',shadow:c.boxShadow,system:el.classList.contains('sstab')?colour(c.getPropertyValue('--c')):null};});`);
    assert(stats.length>0);assert(stats.every(x=>x.border==='3px'&&x.tone===x.edge),theme+'/'+page+' colour edge');
    assert(stats.every(x=>x.contrast>=4.5),theme+'/'+page+' text contrast');
    assert(stats.filter(x=>x.selected).every(x=>x.shadow.includes('inset')),theme+'/'+page+' selection underline');
    assert(stats.filter(x=>x.system).every(x=>x.tone===x.system),theme+' system palette');
    if(theme==='custom-light'&&page==='setup')assert.equal(stats.find(x=>x.id==='bop').tone,'#5b6470','custom light uses light system palette');
    if(page==='custom'||page==='settings')assert(new Set(stats.map(x=>x.tone)).size===stats.length,'distinct semantic colours');
    report.push({theme,page,minContrast:Math.min(...stats.map(x=>x.contrast))});
    fs.writeFileSync(path.join(out,theme+'-'+page+'.png'),(await win.webContents.capturePage()).toPNG());
    if(page==='settings'){
     await run(`document.querySelector('#settingstabs [data-id="theme"]').click();`);await wait(50);
     assert(await run(`return state.settingsSub==='theme'&&document.querySelector('#settingstabs [aria-selected="true"]').dataset.id==='theme';`),'tab navigation');
    }
   }
  }
  // Real Race Setup choices still change their underlying form values.
  await run(`state.tab='setup';state.setupSub='setups';state.settings.theme='dark';applyTheme();await render();openForm('racesetups',null);`);await wait(100);
  const choice=await run(`const b=document.querySelector('.fu-seg .fu-b:not(.on)');if(!b)throw Error('Missing Race Setup choice');const id=b.dataset.pick,v=b.dataset.val;b.click();return {id,v,value:document.getElementById('f-'+id)?.value};`);
  assert.equal(choice.value,choice.v,'settings choice still changes its value');
  await run(`dlg.close();`);
  // Shared choice families including disabled and keyboard focus, without saving data.
  await run(`const panel=document.createElement('section');panel.id='qa-choices';panel.className='setupform ss-tyre rsform';panel.innerHTML='<div class="seg"><button class="btn on" aria-pressed="true">Cards</button><button class="btn">List</button></div><div class="fu-seg"><button class="fu-b on">Selected setting</button><button class="fu-b" disabled>Unavailable</button></div><div class="twseg"><button class="btn on">Tyre preset</button></div><div class="audio-tabs"><button class="btn" data-audio-tab="calls" aria-pressed="true">Calls</button></div><div class="audio-choices"><button class="btn" aria-pressed="true">Call</button></div><div class="parallel-setup"><div class="pp-seg"><button aria-pressed="true">By lane</button></div></div>';document.getElementById('view').append(panel);`);
  assert(await run(`return [...document.querySelectorAll('#qa-choices button')].every(b=>{const c=getComputedStyle(b);return c.borderLeftWidth==='3px'&&c.borderRightWidth==='1px'&&c.borderRadius==='8px'&&(b.disabled?Number(c.opacity)<=.5:(!b.matches('.on,[aria-pressed="true"]')||c.boxShadow.includes('inset')));});`),'all matching control families');
  await run(`document.querySelector('#qa-choices .btn').focus();`);win.webContents.sendInputEvent({type:'keyDown',keyCode:'Tab'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Tab'});await wait(50);
  assert(await run(`return document.activeElement.matches('#qa-choices button')&&getComputedStyle(document.activeElement).outlineStyle==='solid';`),'keyboard focus');
  await run(`document.getElementById('qa-choices').remove();`);
  for(const page of ['custom','settings','setup','database']){
   win.setContentSize(420,900);await run(`state.tab='${page}';state.settingsSub='hardware';state.hwSub='trackmate';state.customSub='widgets';await render();scrollTo(0,0);`);await wait(80);
   assert(await run(`return [...document.querySelectorAll('.sub[role="tablist"],.setupstrip')].every(bar=>[...bar.querySelectorAll('button')].every(b=>{const r=b.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1;}));`),'narrow tabs '+page);
   fs.writeFileSync(path.join(out,'420-'+page+'.png'),(await win.webContents.capturePage()).toPNG());
  }
  assert.deepEqual(await run('return qaErrors'),[]);
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed:true,report,checks:['all eight built-in themes','light and dark custom palettes','4.5:1 text contrast','system colour inheritance','tab navigation','settings selection','disabled and keyboard focus','420px wrapping']},null,2));
  console.log('TAB STYLE ELECTRON PASS',report.length,'theme/page combinations');clearTimeout(timer);app.quit();
 }catch(e){console.error(e);fs.writeFileSync(path.join(out,'failure.png'),(await win.webContents.capturePage()).toPNG());app.exit(1);}
});});require('../../main');
