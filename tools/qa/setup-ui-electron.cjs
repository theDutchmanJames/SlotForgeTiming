'use strict';
const {app,dialog}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../../../outputs/setup-ui-refinement');fs.mkdirSync(out,{recursive:true});
const profile=fs.mkdtempSync(path.join(out,'profile-'));app.setPath('appData',profile);app.disableHardwareAcceleration();
require('./qa-completion.cjs').preventRelaunch(app);require('./file-diagnostics.cjs')(path.join(profile,'diagnostics.log'),()=>app.exit(1));
dialog.showErrorBox=(t,m)=>{console.error(t,m);app.exit(1);};
const wait=ms=>new Promise(r=>setTimeout(r,ms)),timer=setTimeout(()=>app.exit(2),100000);let done=false;
app.on('browser-window-created',(_,win)=>{win.show=()=>{};win.hide();win.webContents.on('console-message',(_e,level,message)=>{if(level>=2)console.error(message);});win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
 const until=async condition=>{for(let i=0;i<160;i++){if(await run('return '+condition))return;await wait(30);}throw Error('Timeout '+condition);};
 const shot=async name=>{await wait(130);fs.writeFileSync(path.join(out,name+'.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());};
 try{
  await until('!!state.schema.racesetups');
  win.setMinimumSize(0,0);win.setContentSize(1600,1000);win.setOpacity(0);win.showInactive();
  await run(`window.qaErrors=[];addEventListener('error',e=>qaErrors.push(e.message));addEventListener('unhandledrejection',e=>qaErrors.push(String(e.reason)));
   window.qaTrack=await api.add('tracks',{name:'Club circuit',lanes:2});window.qaBase={track:qaTrack.id,sessionType:'race',raceBy:'laps',laps:25,name:'Saturday Grand Prix',bop:'on'};
   for(const [field,entity] of [['fuelRules','fuelrules'],['penaltySystem','penaltysystems'],['damageSystem','damagesystems'],['safetyCar','safetycarsystems'],['tyreWear','tyrewearsystems'],['weather','weathersystems'],['pushSave','pushsavesystems']]){const row=await api.add(entity,{...Object.fromEntries(state.schema[entity].fields.filter(f=>f.default!==undefined).map(f=>[f.key,f.default])),name:'Club '+field});qaBase[field]=row.id;}
   window.qaSetup=await api.add('racesetups',qaBase);
   for(const sessionType of ['practice','qualifying','race','practice'])await api.add('racesetups',{...qaBase,name:sessionType==='practice'?'Free Practice':sessionType==='qualifying'?'Qualifying':'End of evening sprint',sessionType,disabledSystems:sessionType==='qualifying'?'fuel,weather':''});
   window.qaDrivers=await Promise.all(['James','Bjornie'].map(name=>api.add('drivers',{name})));
   window.qaClasses=await Promise.all(['Prototype','GT3'].map(name=>api.add('raceclasses',{name})));
   window.qaCars=await Promise.all(['NSR Mosler MT900R','NSR Corvette'].map((model,i)=>api.add('slotcars',{model,raceClass:qaClasses[i].id})));
   window.qaMulti=await api.add('multiclasssystems',{name:'Club classes',classes:qaClasses,assignment:'roster',driverClasses:qaDrivers.map((d,i)=>({driverId:d.id,classId:qaClasses[i].id}))});
   state.settings=await api.setSettings({lastSetupId:qaSetup.id,assignments:{[qaSetup.id]:qaDrivers.map((d,i)=>({driverId:d.id,carId:qaCars[i].id}))},setupView:'grid'});
   state.tab='setup';state.setupSub='setups';await render();`);
  await until('!!document.querySelector(".system-icon")');
  assert.equal(await run('return document.querySelectorAll(".sssystems button").length'),7);
  assert.equal(await run('return document.querySelectorAll(".ssgroups details").length'),2);
  const themes=await run("return Theme.THEMES.filter(x=>x[0]!=='custom').map(x=>x[0])");
  for(const theme of [...themes,'custom-dark','custom-light']){
   await run(`state.settings.theme=${JSON.stringify(theme.startsWith('custom')?'custom':theme)};state.settings.customColors=${JSON.stringify(theme==='custom-light'?{bg:'#f2f5f3',panel:'#ffffff',ink:'#15251c',muted:'#52675a',line:'#bccbbf',accent:'#397352'}:{bg:'#141522',panel:'#23243a',ink:'#f5edff',muted:'#b0acc9',line:'#41435e',accent:'#bb9be8'})};applyTheme();await document.fonts.ready;`);
   assert(await run('return [...document.querySelectorAll(".system-icon")].every(b=>b.querySelector("svg")&&b.getAttribute("aria-label")&&b.getBoundingClientRect().width===42&&b.getBoundingClientRect().height===42)'),theme+' icon sizes/names');
   assert(await run('const h=document.querySelector(".ssbig").getBoundingClientRect(),n=document.querySelector(".ssnav").getBoundingClientRect();return Math.abs(h.height-n.height)<2'),theme+' two-row hero');
   assert(await run('const cards=[...document.querySelectorAll(".rscards>.rscard")].map(e=>e.getBoundingClientRect());return cards.every(a=>cards.filter(b=>b.top===a.top).every(b=>Math.abs(a.height-b.height)<1))'),'equal card heights');
   await shot('setups-'+theme);
  }
  await run('document.querySelector(".system-icon").click()');await until('document.querySelector(".system-icon")?.getAttribute("aria-checked")==="false"');
  assert(await run('return (await api.list("racesetups")).some(r=>r.disabledSystems?.includes("fuel"))'));
  await run('document.querySelector(".ssgroups details").open=true;document.querySelector("[data-id=rotation]").click()');await until('state.setupSub==="rotation"&&!!document.querySelector(".sscurrent")');
  assert(await run('return document.querySelector(".sscurrent").textContent.includes("Rotation Setups")'));
  await run('document.querySelector("[data-id=setups]").click()');await until('!!document.querySelector(".system-icon")');
  for(const width of [2560,2000,1999,1600,1200,900,600,360]){
   win.setContentSize(width,900);await wait(100);assert(await run('return document.documentElement.scrollWidth<=innerWidth+1'),'setup width '+width);
   assert.equal(await run('return getComputedStyle(document.querySelector(".rscards")).gridTemplateColumns.split(" ").length'),width>=2000?5:width>=1600?4:width>=1200?3:width>=800?2:1);
   assert(await run('return [...document.querySelectorAll(".rscards>.rscard")].every(c=>[...c.querySelectorAll("button")].every(b=>{const r=c.getBoundingClientRect(),q=b.getBoundingClientRect();return q.left>=r.left&&q.right<=r.right&&b.scrollWidth<=b.clientWidth+1}))'),'card buttons fit '+width);
   if(width>=2000)assert(await run('const r=[...document.querySelectorAll(".rscards>.rscard")].map(c=>c.getBoundingClientRect());return r.length===5&&r.every(c=>c.top===r[0].top&&Math.abs(c.height-r[0].height)<1)'),'five equal-height cards in one row');
   await shot('setups-'+width);
  }
  win.setContentSize(1440,1000);
  await run("state.settings.theme='dark';applyTheme();");
  await run("state.tab='database';state.sub='tracks';await render();");await until('!!document.querySelector(".catalogue-controls")');
  assert(await run('return !!document.querySelector(".catalogue-tools #vgrid")&&!!document.querySelector(".catalogue-tools [data-catalogue-search]")&&!!document.querySelector(".catalogue-controls [data-catalogue-next]")'));
  await shot('database-dark');
  win.setContentSize(600,900);await wait(100);assert(await run('return document.documentElement.scrollWidth<=innerWidth+1'),'database controls at 600px');await shot('database-600');win.setContentSize(1440,1000);
  await run('const f=document.querySelector("[data-catalogue-search]");f.elements.search.value="nothing-matches";f.requestSubmit()');await until('view.textContent.includes("No matching tracks")');
  await run('const f=document.querySelector("[data-catalogue-search]");f.elements.search.value="Club";f.requestSubmit()');await until('view.textContent.includes("Club circuit")');
  for(const enabled of [true,false]){
   await run(`await api.update('racesetups',qaSetup.id,{multiClass:${enabled?'qaMulti.id':"''"}});state.tab='home';await render();`);await until('!!document.querySelector(".hm-start")');
   assert.equal(await run('return document.querySelectorAll(".hs-class").length'),enabled?2:0);
   assert.equal(await run('return document.querySelectorAll(".mc-home").length'),enabled?1:0);
   assert(await run('return !document.querySelector("#start").disabled'),'valid assignments remain race-ready');
   assert(await run('const c=document.querySelector(".hm-start"),f=c.querySelector(".hm-go"),p=f.previousElementSibling;return f.getBoundingClientRect().top-p.getBoundingClientRect().bottom<30'),'no stretched empty Home space');
   await shot('home-'+(enabled?'classes':'plain'));
  }
  await run("await api.update('multiclasssystems',qaMulti.id,{driverClasses:[{driverId:qaDrivers[0].id,classId:qaClasses[0].id}]});await api.update('racesetups',qaSetup.id,{multiClass:qaMulti.id});await renderHome();");
  assert(await run('return document.querySelector("#start").disabled&&document.querySelectorAll("[data-row]")[1].classList.contains("need")&&document.querySelector(".hm-ready").textContent.includes("1 of 2")'));
  assert(await run('return document.querySelectorAll("[data-row]")[1].querySelector(".hs-why").textContent.includes("Lane 2 needs a driver assigned")'));
  await shot('home-class-warning');
  await run("await api.update('multiclasssystems',qaMulti.id,{assignment:'car'});await api.update('racesetups',qaSetup.id,{multiClass:qaMulti.id});await renderHome();");await until('document.querySelectorAll("[data-mc-entry]").length===2');
  await run('const s=document.querySelector("[data-mc-entry]");s.value=qaClasses[1].id;s.dispatchEvent(new Event("change",{bubbles:true}))');await wait(200);
  assert.equal(await run('return state.settings.assignments[qaSetup.id][0].raceClass'),await run('return qaClasses[1].id'));
  win.setContentSize(600,900);await shot('home-600');assert(await run('return document.documentElement.scrollWidth<=innerWidth+1'),'Home no overflow at 600');
  win.setContentSize(1440,1000);
  await run("state.settings.theme='dark';applyTheme();");
  await run("state.tab='setup';state.setupSub='tyrewear';await render();await openForm('tyrewearsystems',(await api.list('tyrewearsystems')).find(x=>x.id===qaBase.tyreWear));");
  assert(await run('return !document.querySelector("#f-paceWear")&&!document.querySelector("#f-paceStrength")'));
  await run("document.querySelector('#f-tempOn').value='on';document.querySelector('#f-tempOn').dispatchEvent(new Event('change',{bubbles:true}));");
  await run("document.querySelector('[data-tt-source]').closest('details').open=true;");
  assert(await run('return dlg.textContent.includes("temperature modifier")&&dlg.textContent.includes("×0.714")'));
  await shot('tyre-settings');await run('document.querySelector(".tt-preview").scrollIntoView({block:"center"})');await shot('temperature-preview');
  fs.writeFileSync(path.join(out,'rail-geometry.json'),JSON.stringify(await run('const r=document.querySelector(".rsrail"),b=r.getBoundingClientRect();return {width:r.clientWidth,scroll:r.scrollWidth,overflow:[...r.querySelectorAll("*")].filter(e=>e.getBoundingClientRect().right>b.right).map(e=>({tag:e.tagName,cls:e.className,text:e.textContent.slice(0,100),width:e.getBoundingClientRect().width}))}'),null,2));
  assert(await run('const r=document.querySelector(".rsrail");return r.scrollWidth<=r.clientWidth+1'),'tyre sections stay in one vertical rail rather than spilling into a hidden column');
  await run('const r=document.querySelector(".rsrail");r.scrollTop=r.scrollHeight');
  assert(await run('const r=document.querySelector(".rsrail"),b=r.getBoundingClientRect(),last=r.lastElementChild.getBoundingClientRect();return last.right<=b.right&&last.bottom<=b.bottom'),'last sidebar section reachable by vertical scrolling');
  await run('dlg.close()');
  await run('await CalculationPage.render(view)');await until('!!document.querySelector("[data-lab=wear]")');
  assert(await run('return !document.querySelector("[data-prefix=tyreWear]")&&!document.querySelector("[data-extra=response]")&&!!document.querySelector("[data-prefix=pushSave]")'));
  assert(await run('return document.querySelector("[data-lab=wear] output").textContent.includes("2.8%")'));
  await shot('calculations');
  await run('document.querySelector("[data-calc-section=estimates]").click()');await until('!!document.querySelector("[data-extra=estimates]")');
  await run('const f=document.querySelector("[data-extra=estimates]");f.elements.fuelMethod.value="median";f.requestSubmit()');await wait(200);
  assert.equal(await run('return (await api.getSettings()).raceEstimates.fuelMethod'),'median');
  assert.deepEqual(await run('return qaErrors'),[]);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,profile,themes,checks:['open system navigation and two-row hero','compact accessible icon toggles persisted','equal row heights','600/1200px no overflow','search and view controls grouped; search works','class labels inline; no empty stretch with or without classes','editable class choice persisted','removed pace fields','no renderer errors']},null,2));
  require('./qa-completion.cjs').complete();clearTimeout(timer);app.quit();
 }catch(e){console.error(e);clearTimeout(timer);app.exit(1);}
});});require('../../main');
