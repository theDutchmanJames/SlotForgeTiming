// Verify the actual app shell with isolated data; never touch the user's database.
const {app}=require('electron'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../../../outputs/brand-footer');fs.mkdirSync(out,{recursive:true});
app.setPath('appData',path.join(out,'profile-'+process.pid));app.disableHardwareAcceleration();
require('./qa-completion.cjs').preventRelaunch(app);
require('./file-diagnostics.cjs')(path.join(out,'diagnostics.log'),()=>app.exit(1));
let done=false;const wait=ms=>new Promise(r=>setTimeout(r,ms));const timer=setTimeout(()=>app.exit(2),90000);
app.on('browser-window-created',(_,win)=>{
 win.hide();win.webContents.setBackgroundThrottling(false);
 win.webContents.on('did-finish-load',async()=>{
  if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
  const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
  try{
   await wait(500);win.setMinimumSize(0,0);win.setContentSize(1280,900);
   await run(`window.brandErrors=[];addEventListener('error',e=>brandErrors.push(e.message));state.tab='rules';await render();`);
   const checks=[];
   async function inspect(expected,credits){
    await wait(60);
    const header=await run(`const h=document.querySelector('body>header'),icon=h.querySelector('.app-identity-icon'),word=h.querySelector('.header-wordmark'),logo=word&&[...word.querySelectorAll('img')].find(i=>getComputedStyle(i).display!=='none');return {width:h.clientWidth,overflow:h.scrollWidth>h.clientWidth,icon:icon.complete&&icon.naturalWidth>0,slogan:h.querySelector('.app-slogan').textContent,logo:logo&&{loaded:logo.complete&&logo.naturalWidth>0,src:logo.getAttribute('src')},ink:document.documentElement.dataset.headerBrandInk};`);
    assert(!header.overflow,'header reflows without horizontal overflow');assert(header.icon);assert.equal(header.slogan,'EVERY LAP COUNTS');assert(header.logo?.loaded);assert(header.logo.src.endsWith(header.ink==='dark'?'timing-wordmark-light.svg':'timing-wordmark-dark.svg'));
    const geometry=await run(`const box=s=>document.querySelector(s).getBoundingClientRect();const icon=box('.app-identity-icon'),copy=box('.app-identity-copy'),word=box('.header-wordmark'),slogan=box('.app-slogan');return {iw:icon.width,ih:icon.height,ch:copy.height,center:Math.abs(icon.y+icon.height/2-copy.y-copy.height/2),widthDifference:Math.abs(word.width-slogan.width),ratio:word.width/word.height};`);
    assert.equal(geometry.iw,42);assert.equal(geometry.ih,42);assert.equal(geometry.ch,42);assert(geometry.center<1);assert(geometry.widthDifference<1);assert(Math.abs(geometry.ratio-456.49/90.34)<.02);
    const r=await run(`const footer=document.getElementById('app-footer'), f=footer.getBoundingClientRect(),v=view.getBoundingClientRect(),c=document.getElementById('app-credits');const images=[...footer.querySelectorAll('img')].filter(i=>getComputedStyle(i).display!=='none');return {visible:!footer.hidden,after:f.top>=v.bottom-.5,right:f.right<=innerWidth+.5,credits:!c.hidden,text:c.textContent,images:images.map(i=>({src:i.getAttribute('src'),loaded:i.complete&&i.naturalWidth>0,w:i.getBoundingClientRect().width,h:i.getBoundingClientRect().height,right:i.getBoundingClientRect().right})),bottom:f.bottom,rightEdge:f.right,viewport:innerHeight};`);
    assert(r.visible&&r.after&&r.right,'footer follows content without overflow');assert.equal(r.credits,credits);assert.equal(r.images.length,1);const img=r.images[0];assert(img.loaded);assert.equal(img.w,120);assert(Math.abs(img.h-120*90.34/620.94)<.1);assert(img.src.endsWith('slotforge-wordmark-'+expected+'.svg'));assert(Math.abs(img.right-(r.rightEdge-20))<1,'right margin');
    if(credits)assert(r.text.includes('theDutchmanJames, Codex & Claude.')&&r.text.includes('Bjorn and Joanne')&&r.text.includes('@SlotForum.com: Kevan, Roguejackal, Dangermouse, Dopamine, LMP & Superslab'));
    return r;
   }
   for(const theme of ['dark','light','midnight','forest','sunset','violet','carbon','ocean']){
    await run(`state.settings.theme=${JSON.stringify(theme)};applyTheme();`);
    await inspect(['light','ocean'].includes(theme)?'light':'dark',true);checks.push('theme '+theme);
    if(['dark','light'].includes(theme))fs.writeFileSync(path.join(out,'rules-'+theme+'.png'),(await win.webContents.capturePage()).toPNG());
   }
   for(const [bg,panel,expected] of [['#ffffff','#222831','light'],['#171b21','#ffffff','dark'],['#888888','#ffffff','light']]){
    await run(`state.settings.theme='custom';state.settings.customColors={bg:${JSON.stringify(bg)},panel:${JSON.stringify(panel)}};applyTheme();`);
    await inspect(expected,true);checks.push('custom background '+bg);
   }
   for(const theme of ['dark','light'])for(const tab of ['home','database','setup','custom','settings','rules']){
    await run(`state.settings.theme=${JSON.stringify(theme)};applyTheme();state.tab=${JSON.stringify(tab)};await render();`);
    await inspect(theme,tab==='rules');checks.push(theme+' page '+tab);
    if(tab==='home')fs.writeFileSync(path.join(out,'home-'+theme+'.png'),(await win.webContents.capturePage()).toPNG());
   }
   for(const width of [600,320]){
    win.setContentSize(width,900);await run(`state.tab='rules';state.settings.theme='dark';applyTheme();await render();`);
    const r=await inspect('dark',true);assert(r.images[0].right<=width-19);
    assert(await run(`return document.getElementById('app-credits').scrollWidth<=document.getElementById('app-credits').clientWidth;`),'credits wrap');
    await run(`document.getElementById('app-footer').scrollIntoView({block:'end'});`);await wait(80);
    fs.writeFileSync(path.join(out,'rules-'+width+'.png'),(await win.webContents.capturePage()).toPNG());checks.push('width '+width);
   }
   win.setContentSize(1280,900);
   await run(`state.settings.appName='Club <img src=x onerror=alert(1)>';applyName();`);
   assert(await run(`return document.querySelector('.app-identity h1').textContent===state.settings.appName&&!document.querySelector('.app-identity h1 img')&&document.title===state.settings.appName;`),'custom names stay safe and update window title');
   await run(`state.settings.appName='SlotForge Timing';applyName();`);checks.push('custom app name and default branding round-trip');
   await run(`state.tab='rules';await render();scrollTo(0,0);document.querySelector('#rules').innerHTML=Array(80).fill('<p>Long rules document.</p>').join('');`);
   const long=await inspect('dark',true);assert(long.bottom>long.viewport);checks.push('long content pushes footer below page');
   await run(`showRace(true);`);assert(await run(`return document.getElementById('app-footer').hidden;`));checks.push('race view excludes footer');
   await run(`showRace(false);document.body.classList.add('lv-window');`);
   assert(await run(`return getComputedStyle(document.getElementById('app-footer')).display==='none'&&getComputedStyle(document.body).display!=='flex';`));checks.push('second-screen layout excludes footer');
   await run(`document.body.classList.remove('lv-window');state.tab='rules';await render();`);
   assert.deepEqual(await run('return brandErrors;'),[]);
   fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed:true,checks},null,2));console.log('BRAND FOOTER ELECTRON PASS: '+checks.length+' checks');require('./qa-completion.cjs').complete();clearTimeout(timer);app.quit();
  }catch(e){console.error(e);fs.writeFileSync(path.join(out,'failure.png'),(await win.webContents.capturePage()).toPNG());app.exit(1);}
 });
});
require('../../main');
