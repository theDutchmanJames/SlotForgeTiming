// Exercise the actual renderer and persistence with isolated app data.
const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../../../outputs/comparison-rows'),data=path.resolve(__dirname,'../../.tmp-test/comparison-rows-'+process.pid);
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(data,{recursive:true});app.setPath('appData',data);app.disableHardwareAcceleration();
let done=false;const wait=ms=>new Promise(r=>setTimeout(r,ms)),timer=setTimeout(()=>app.exit(1),120000);
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
 const shot=async name=>fs.writeFileSync(path.join(out,name+'.png'),(await win.webContents.capturePage()).toPNG());
 try{
  await wait(350);win.setMinimumSize(0,0);win.setContentSize(1440,1000);
  await run(`window.qaErrors=[];addEventListener('error',e=>qaErrors.push(e.message));addEventListener('unhandledrejection',e=>qaErrors.push(String(e.reason)));
   const track=await api.add('tracks',{name:'Slotrace Circuit',lanes:2});window.qaBase={track:track.id,sessionType:'race',raceBy:'laps',laps:65,name:'Saturday Club Grand Prix',bop:'on'};
   for(const [field,entity] of [['fuelRules','fuelrules'],['penaltySystem','penaltysystems'],['damageSystem','damagesystems'],['safetyCar','safetycarsystems'],['tyreWear','tyrewearsystems'],['weather','weathersystems'],['pushSave','pushsavesystems']]){
    const row=await api.add(entity,{...Object.fromEntries(state.schema[entity].fields.filter(f=>f.default!==undefined).map(f=>[f.key,f.default])),name:'Club '+field});qaBase[field]=row.id;
   }
   window.qaSetup=await api.add('racesetups',qaBase);
   await api.add('racesetups',{name:'Free Practice',track:track.id,sessionType:'practice'});
   await api.add('racesetups',{...qaBase,name:'Qualifying — the evening session',sessionType:'qualifying',disabledSystems:'fuel,weather'});
   await api.add('racesetups',{...qaBase,name:'Time Tokens',sessionType:'tokens'});
   state.settings.setupView='grid';state.tab='setup';state.setupSub='setups';setupFilter='all';await render();`);
  await wait(150);
  const themes=await run(`return Theme.THEMES.filter(x=>x[0]!=='custom').map(x=>x[0]);`),report=[];
  for(const theme of [...themes,'custom-dark','custom-light']){
   await run(`state.settings.theme=${JSON.stringify(theme.startsWith('custom')?'custom':theme)};state.settings.customColors=${JSON.stringify(theme==='custom-light'?{bg:'#f2f5f3',panel:'#ffffff',ink:'#15251c',muted:'#52675a',line:'#bccbbf',accent:'#397352'}:{bg:'#141522',panel:'#23243a',ink:'#f5edff',muted:'#b0acc9',line:'#41435e',accent:'#bb9be8'})};applyTheme();await render();await document.fonts.ready;`);
   for(let attempt=0;attempt<50&&!await run(`return document.querySelectorAll('.rslinked .system-switch').length===16;`);attempt++)await wait(20);
   const palette=await run(`const keys={fuel:'fuel',penalty:'pen',damage:'dmg',safetycar:'sc',tyrewear:'tyre',weather:'wx',pushsave:'ps',bop:'bop'};return [...document.querySelectorAll('.rslinked .system-switch')].map(b=>{const c=getComputedStyle(b);return {key:b.dataset.systemKey,actual:c.getPropertyValue('--sys').trim(),expected:c.getPropertyValue('--c-'+keys[b.dataset.systemKey]).trim(),height:b.getBoundingClientRect().height};});`);
   assert(palette.length===16);assert(palette.every(x=>x.height===52&&x.actual===x.expected),theme+' matching colours and equal switches');report.push({theme,palette});
   await shot(theme);
   // Initial Add/Edit colour and live switches use the same theme palette as cards.
   for(const editing of [false,true]){
    await run(`openForm('racesetups',${editing?'qaSetup':'null'},${editing?'undefined':"{sessionType:'practice'}"});`);
    assert.equal(await run(`return document.getElementById('frm').dataset.sessionKind;`),editing?'race':'practice','initial form session');
    const name=await run(`return document.getElementById('f-name').value;`);
    for(const kind of ['practice','qualifying','tokens','race']){
     await run(`document.querySelector('#frm button[data-kind="${kind}"]').click();`);
     await wait(60); // Let Electron paint the new session before capturing its visual state.
     assert(await run(`const form=document.getElementById('frm'),s=getComputedStyle(form),expected=${kind==='practice'?"s.getPropertyValue('--c-wx')":kind==='qualifying'?"s.getPropertyValue('--c-pen')":"getComputedStyle(document.body).getPropertyValue('--accent')"};return form.dataset.sessionKind==='${kind}'&&s.getPropertyValue('--accent').trim()===expected.trim();`),theme+' '+kind+' live form colour');
     assert.equal(await run(`return document.getElementById('f-name').value;`),name,'colour update retains input');
     if(editing&&['dark','light'].includes(theme)&&kind!=='tokens')await shot('edit-'+theme+'-'+kind);
    }
    await run(`dlg.close();`);
   }
  }
  await run(`state.settings.theme='dark';applyTheme();await render();`);
  for(const width of [2560,2400,1920,1800,1440,1200,1199,900,600,420,360]){
   win.setContentSize(width,1000);await wait(90);
   const geometry=await run(`const cards=[...document.querySelectorAll('.rscards>.rscard')];return {width:innerWidth,scroll:document.documentElement.scrollWidth,cards:cards.map(c=>{const r=c.getBoundingClientRect();return {left:r.left,right:r.right,buttons:[...c.querySelectorAll('button')].map(b=>{const q=b.getBoundingClientRect();return {left:q.left,right:q.right,height:q.height,overflow:b.scrollWidth>b.clientWidth+1};})};})};`);
   assert(geometry.scroll<=geometry.width+1,JSON.stringify(geometry));
   assert(geometry.cards.every(c=>c.left>=0&&c.right<=width&&c.buttons.every(b=>b.left>=c.left&&b.right<=c.right&&!b.overflow)),width+' card contents fit');
   assert.equal(await run(`return getComputedStyle(document.querySelector('.rscards')).gridTemplateColumns.split(' ').length;`),width>=2400?4:width>=1800?3:width>=1200?2:1,width+' responsive card columns');
   assert(await run(`const card=document.querySelector('.rscards>.rscard:has(.system-switches)'),c=getComputedStyle(card),w=card.clientWidth-parseFloat(c.paddingLeft)-parseFloat(c.paddingRight),n=getComputedStyle(card.querySelector('.system-switches')).gridTemplateColumns.split(' ').length;return n===(w>=1000?3:w<=320?1:2);`),width+' system columns follow card width');
   assert(await run(`const rows=new Map();for(const card of document.querySelectorAll('.rscards>.rscard')){const r=card.getBoundingClientRect(),footer=card.querySelector('.rsactions').getBoundingClientRect(),key=Math.round(r.top);if(!rows.has(key))rows.set(key,[]);rows.get(key).push({height:r.height,footer:footer.bottom});}return [...rows.values()].every(row=>row.every(x=>Math.abs(x.height-row[0].height)<1&&Math.abs(x.footer-row[0].footer)<1));`),width+' equal card heights and aligned actions within each row');
   assert(await run(`const toolbar=document.querySelector('.rstoolbar'),add=toolbar.querySelector('#add').getBoundingClientRect();return Math.abs(add.left-toolbar.getBoundingClientRect().left)<1&&[...toolbar.children].every(el=>el.getBoundingClientRect().top>=add.top);`),width+' primary action first on left');
   await shot('width-'+width);
   if(width===420){await run(`document.querySelector('.rscards').scrollIntoView();`);await wait(40);await shot('card-420');await run(`scrollTo(0,0);`);}
   await run(`document.querySelector('.ssdropdown').open=true;`);await wait(40);
   assert(await run(`return [...document.querySelectorAll('.ssdropdown[open] button')].every(b=>{const r=b.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;});`),width+' menu fits');
   if(width===420)await shot('menu-420');
   await run(`document.querySelector('.ssdropdown').open=false;`);
  }
  win.setContentSize(1440,1000);
  // Toggle through the real event handler and re-read the saved setup.
  await run(`const b=document.querySelector('[data-system-setup="'+qaSetup.id+'"][data-system-key="fuel"]');await document.getElementById('setupmgr').onclick({target:b});`);
  assert(await run(`const saved=(await api.list('racesetups')).find(x=>x.id===qaSetup.id),button=document.querySelector('[data-system-setup="'+qaSetup.id+'"][data-system-key="fuel"]');return saved.disabledSystems==='fuel'&&button.getAttribute('aria-checked')==='false'&&button.closest('.rscard').querySelector('.rslinked-head').textContent.includes('7 on · 1 off');`),'toggle persists and count updates');
  await run(`await render();`);
  assert(await run(`return document.querySelector('[data-system-setup="'+qaSetup.id+'"][data-system-key="fuel"]').getAttribute('aria-checked')==='false';`),'disabled state survives re-render');
  await run(`await document.getElementById('setupmgr').onclick({target:document.querySelector('[data-rsf="practice"]')});`);
  assert.equal(await run(`return document.querySelectorAll('.rscards>.rscard').length;`),1,'filter');
  await run(`await document.getElementById('setupmgr').onclick({target:document.querySelector('[data-rsf="all"]')});await document.getElementById('setupmgr').onclick({target:document.querySelector('[data-copy="'+qaSetup.id+'"]')});`);
  assert(await run(`window.qaCopy=(await api.list('racesetups')).find(x=>x.name===qaSetup.name+' (copy)');return qaCopy&&qaCopy.id!==qaSetup.id&&qaCopy.fuelRules===qaSetup.fuelRules&&qaCopy.disabledSystems==='fuel';`),'independent copy keeps links and switch state');
  await run(`window.confirm=()=>true;await document.getElementById('setupmgr').onclick({target:document.querySelector('[data-del="'+qaCopy.id+'"]')});`);await wait(80);
  assert(await run(`return !(await api.list('racesetups')).some(x=>x.id===qaCopy.id);`),'delete copied setup');
  await run(`await document.getElementById('setupmgr').onclick({target:document.getElementById('vlist')});`);
  assert(await run(`return !!document.querySelector('#setupmgr table')&&state.settings.setupView==='list';`),'table alternative');
  await run(`await document.getElementById('setupmgr').onclick({target:document.getElementById('vgrid')});await document.getElementById('setupmgr').onclick({target:document.querySelector('[data-edit="'+qaSetup.id+'"]')});`);await wait(80);
  assert(await run(`return dlg.open&&!!document.getElementById('f-name');`),'edit form opens');await run(`dlg.close();`);
  await run(`document.querySelector('.ssdropdown').open=true;document.querySelector('#setuptabs [data-id="fuel"]').click();`);await wait(120);
  assert(await run(`return state.setupSub==='fuel'&&document.querySelector('#setuptabs>.sstab[data-id="fuel"]').getAttribute('aria-selected')==='true'&&!document.querySelector('.sscurrent');`),'direct Fuel navigation and selection');
  for(const id of ['tyrewear','penalties']){
   await run(`document.querySelector('#setuptabs>.sstab[data-id="${id}"]').click();`);await wait(80);
   assert(await run(`return state.setupSub==='${id}'&&document.querySelectorAll('#setuptabs [data-id="${id}"]').length===1&&document.querySelector('#setuptabs>.sstab[data-id="${id}"]').getAttribute('aria-selected')==='true';`),id+' direct navigation without duplicate');
  }
  await run(`document.querySelector('.ssdropdown').open=true;document.querySelector('#setuptabs [data-id="damage"]').click();`);await wait(80);
  assert(await run(`return state.setupSub==='damage'&&document.querySelector('.sscurrent').textContent==='Damage Systems';`),'remaining menu navigation and current label');
  await run(`const ds=[...document.querySelectorAll('.ssdropdown')];ds[0].open=true;`);await wait(40);
  await run(`document.querySelectorAll('.ssdropdown')[1].open=true;`);await wait(40);
  assert.equal(await run(`return document.querySelectorAll('.ssdropdown[open]').length;`),1,'only one menu open');
  await run(`const s=document.querySelector('.ssdropdown[open]>summary');s.focus();s.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));`);
  assert(await run(`return !document.querySelector('.ssdropdown[open]')&&document.activeElement.tagName==='SUMMARY';`),'Escape closes menu and returns focus');
  // Interleaved records, including equal types and an unknown future type.
  await run(`for(const [name,sessionType] of [['Endurance test','endurance'],['Practice second','practice'],['Heats test','heats'],['Race second','race'],['Future type','future']])await api.add('racesetups',{name,sessionType});window.qaStoredOrder=(await api.list('racesetups')).map(x=>x.id);state.setupSub='setups';await render();`);
  for(const mode of ['grid','list']){
   await run(`state.settings.setupView='${mode}';await mountManager(document.getElementById('setupmgr'),'racesetups');`);
   assert.deepEqual(await run(`const rows=await api.list('racesetups');return [...document.querySelectorAll('#setupmgr [data-edit]')].map(b=>rows.find(x=>x.id===b.dataset.edit).name);`),['Free Practice','Practice second','Qualifying — the evening session','Saturday Club Grand Prix','Race second','Heats test','Endurance test','Time Tokens','Future type'],mode+' session order, stable within type, unknown last');
  }
  assert(await run(`return JSON.stringify((await api.list('racesetups')).map(x=>x.id))===JSON.stringify(qaStoredOrder);`),'sorting does not mutate saved record order');
  assert.deepEqual(await run('return qaErrors'),[]);
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed:true,report,checks:['10 theme palettes','11 widths from 360 to 2560px','one to four cards per row','primary action first on left','system columns follow card width','equal 52px switches','switch persistence and counts','filters','copy and delete','table view','edit form','group navigation and Escape','no runtime errors']},null,2));
  console.log('COMPARISON ROWS ELECTRON PASS');clearTimeout(timer);app.quit();
 }catch(e){console.error(e);await shot('failure');app.exit(1);}
});});require('../../main');
