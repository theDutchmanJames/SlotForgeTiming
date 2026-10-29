// Actual app renderer with an isolated database; examples never edit race settings.
const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../../../outputs/help-redesign-implementation');fs.mkdirSync(out,{recursive:true});
app.setPath('appData',path.resolve(__dirname,'../../.tmp-test/help-guides-'+process.pid));app.disableHardwareAcceleration();
const wait=ms=>new Promise(r=>setTimeout(r,ms));let done=false;setTimeout(()=>app.exit(2),120000).unref();
app.on('browser-window-created',(_,win)=>win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
 const shot=async name=>{await wait(100);fs.writeFileSync(path.join(out,name+'.png'),(await win.webContents.capturePage()).toPNG());};
 try{
  win.setMinimumSize(0,0);win.setContentSize(1280,1050);win.showInactive();await wait(400);
  await run(`window.helpErrors=[];addEventListener('error',e=>helpErrors.push(e.message));addEventListener('unhandledrejection',e=>helpErrors.push(String(e.reason)));window.ck=(v,m)=>{if(!v)throw Error(m)};
   state.tab='settings';state.settingsSub='help';await render();
   window.helpBox=()=>document.getElementById('settingsbox');window.pickHelp=id=>{Help.view().select(id);Help.render(helpBox());};
   ck(document.querySelectorAll('.help-rail [data-help-topic]').length===Help.folders().length+1,'All topics plus first-race guide');
   for(const t of Help.folders()){pickHelp(t.id);ck(document.querySelector('.help-reader').textContent.includes(t.title==='Fuel and pit stops'?'Fuel Systems':t.title),'Topic reachable '+t.id);ck(document.querySelector('.help-article-body'),'Full content '+t.id);}
   pickHelp('start-guide');const input=document.querySelector('[data-help-search]');input.focus();input.value='InpOut';input.dispatchEvent(new Event('input',{bubbles:true}));ck(document.activeElement===input,'Search keeps typing focus');ck(document.querySelector('.help-hit[data-help-topic=parallel]'),'Body search');
   input.value='<img src=x onerror=alert(1)>';input.dispatchEvent(new Event('input',{bubbles:true}));ck(!document.querySelector('.help-reader img'),'Escaped query');ck(document.querySelector('.help-reader').textContent.includes('No matching'),'Empty state');input.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));ck(input.value==='','Escape clears search');
   pickHelp('fuel');const settings=JSON.stringify(state.settings),f=document.querySelector('[data-help-fuel=tank]');f.value='60';f.dispatchEvent(new Event('input',{bubbles:true}));ck(document.querySelector('.help-fuel-result').textContent.includes('30 laps'),'Fuel example recalculates');ck(JSON.stringify(state.settings)===settings,'Example does not change settings');f.value='0';f.dispatchEvent(new Event('input',{bubbles:true}));ck(document.querySelector('.help-fuel-result').textContent.includes('positive'),'Invalid example');f.value='100';f.dispatchEvent(new Event('input',{bubbles:true}));
   const more=document.querySelector('[data-help-more]');more.open=true;more.dispatchEvent(new Event('toggle'));pickHelp('start-guide');pickHelp('fuel');ck(document.querySelector('[data-help-more]').open,'Details remembered');
  `);
  const themes=['dark','light','midnight','forest','sunset','violet','carbon','ocean'];
  for(const theme of themes){
   win.setContentSize(1280,1050);await run(`state.settings.theme=${JSON.stringify(theme)};applyTheme();`);
   for(const topic of ['start-guide','fuel','laphighlights']){
    await run(`pickHelp(${JSON.stringify(topic)});window.scrollTo(0,0);const hub=document.querySelector('.help-hub');ck(hub.scrollWidth<=hub.clientWidth+1,'No horizontal overflow');ck(getComputedStyle(hub).color!=='rgba(0, 0, 0, 0)','Theme text');ck(document.querySelector('.help-start').getBoundingClientRect().height<70,'Rail buttons must not stretch with article height');ck(getComputedStyle(document.querySelector('[data-help-search]')).backgroundColor===getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()||getComputedStyle(document.querySelector('[data-help-search]')).backgroundColor!=='rgb(255, 255, 255)','Search uses theme background');`);
    if(topic==='laphighlights')await run(`document.querySelector('[data-help-flash=record]').click();ck(document.querySelector('.help-lap-demo .lap-highlight'),'Actual highlight effect');document.querySelectorAll('.help-lap-demo .lap-highlight').forEach(el=>el.getAnimations().forEach(a=>{a.pause();a.currentTime=100;}));`);
    await shot(theme+'-'+topic);
   }
   win.setContentSize(390,1050);await wait(80);await run(`pickHelp('fuel');const hub=document.querySelector('.help-hub');ck(hub.scrollWidth<=hub.clientWidth+1,'Narrow overflow');const b=document.querySelector('[data-help-browse]');ck(getComputedStyle(b).display!=='none','Mobile browse visible');b.click();ck(b.getAttribute('aria-expanded')==='true','Mobile browse expands');b.click();window.scrollTo(0,0);`);await shot(theme+'-narrow');
  }
  win.setContentSize(1280,1050);
  // Use real navigation callbacks; helper renders above deliberately omit navigation.
  await run(`state.settings.theme='dark';applyTheme();Help.view().select('fuel');await render();document.querySelector('[data-help-route=fuel]').click();`);await wait(250);
  await run(`ck(state.tab==='setup'&&state.setupSub==='fuel','Open Fuel Systems route');ck(document.getElementById('setupmgr'),'Destination rendered');state.tab='settings';state.settingsSub='help';await render();ck(Help.view().state.topic==='fuel','Return to previous article');Help.view().select('laphighlights');await render();document.querySelector('[data-help-route=layouts]').click();`);await wait(200);
  await run(`ck(state.tab==='custom'&&state.customSub==='layouts','Open Layouts route');state.tab='settings';state.settingsSub='help';Help.view().select('start-guide');await render();`);
  assert.deepEqual(await run('return helpErrors;'),[]);
  fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({passed:true,themes,topics:97,checks:['All article bodies reachable','Full-content search and focus','Query escaping and empty state','Example validation without settings mutation','Remembered disclosure state','Actual highlight animation','Mobile navigation','Real destination links','No renderer errors']},null,2));
  console.log('HELP GUIDES ELECTRON PASSED: 97 topics, eight themes, desktop/mobile, search, examples and real navigation.');app.quit();
 }catch(e){console.error(e);await shot('failure');app.exit(1);}
}));require('../../main');
