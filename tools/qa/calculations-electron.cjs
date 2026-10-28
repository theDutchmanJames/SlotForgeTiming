// Real settings persistence and editor integration in an isolated Electron profile.
const {app}=require('electron'),fs=require('fs'),path=require('path');
const out=path.resolve(__dirname,'../../../outputs/code-audit'),data=path.resolve(__dirname,'../../.tmp-test/calculations-'+process.pid);
fs.mkdirSync(data,{recursive:true});app.setPath('appData',data);app.disableHardwareAcceleration();
const wait=ms=>new Promise(r=>setTimeout(r,ms));let done=false;
const timeout=setTimeout(()=>app.exit(1),55000);timeout.unref();
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 const run=s=>win.webContents.executeJavaScript('(async()=>{'+s+'})()');
 const capture=async name=>{await wait(150);fs.writeFileSync(path.join(out,name),(await win.webContents.capturePage()).toPNG());};
 try{
  await wait(500);win.setMinimumSize(0,0);win.setContentSize(1200,950);win.showInactive();
  await run(`window.qaErrors=[];addEventListener('error',e=>qaErrors.push(e.message));addEventListener('unhandledrejection',e=>qaErrors.push(String(e.reason)));window.ck=(v,m)=>{if(!v)throw Error(m)};window.input=(q,v)=>{const el=document.querySelector(q);ck(el,'Missing '+q);el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));};
   window.fuel=await api.add('fuelrules',{name:'Club fuel',tank:120,perLap:2,rate:10,paceSource:'constant'});
   window.legacy=await api.add('pushsavesystems',{name:'Legacy pace',mode:'legacy',normal:3,saveAt:8});
   await api.add('championships',Champ.blank());
   await api.add('rotationsetups',Rot.blank(4,4,'Club rotation'));
   state.tab='settings';state.settingsSub='calculations';await render();
   ck(document.querySelectorAll('[data-prefix]').length===2,'Both independent policies');
   input('[data-prefix="pushSave"] [data-policy="Benchmark"]','average');input('[data-prefix="pushSave"] [data-policy="Window"]',5);input('[data-prefix="pushSave"] [data-policy="Minimum"]',2);
   await document.querySelector('[data-prefix="pushSave"]').onsubmit({preventDefault(){}});
   input('[data-prefix="tyreWear"] [data-policy="Benchmark"]','last');input('[data-prefix="tyreWear"] [data-policy="Window"]',3);input('[data-prefix="tyreWear"] [data-policy="Minimum"]',1);
   await document.querySelector('[data-prefix="tyreWear"]').onsubmit({preventDefault(){}});
   const s=await api.getSettings();ck(s.pushSaveBenchmark==='average'&&s.pushSaveWindow===5&&s.tyreWearBenchmark==='last','Persistence');
   await renderSettings();ck(document.querySelector('[data-prefix="pushSave"] [data-policy="Benchmark"]').value==='average','Reopen selected method');
   ck(document.querySelector('[data-preview="pushSave"]').textContent.includes('10.500'),'Production average preview');
   input('[data-example="lap"]',11);ck(document.querySelector('[data-preview="pushSave"]').textContent.includes('slower'),'Live preview input');
   input('[data-example="lap"]',9.5);
   ck(!!document.querySelector('[data-record-field="normal"]')&&!document.querySelector('[data-record-field="pushAt"]'),'Legacy curve exposes its real normal threshold');
   input('[data-record-field="normal"]',5);input('[data-record-field="saveAt"]',4);
   await document.querySelector('[data-entity="pushsavesystems"] form').onsubmit({preventDefault(){}});
   ck((await api.list('pushsavesystems')).find(x=>x.id===legacy.id).saveAt===8,'Reject invalid legacy curve');
   input('[data-record-field="saveAt"]',10);await document.querySelector('[data-entity="pushsavesystems"] form').onsubmit({preventDefault(){}});
   ck((await api.list('pushsavesystems')).find(x=>x.id===legacy.id).normal===5,'Save valid legacy curve');`);
  await capture('calculations-1200.png');
  win.setContentSize(600,1000);
  await run(`document.querySelector('[data-prefix="pushSave"]').scrollIntoView({block:'start'});`);
  await capture('calculations-600.png');
  await run(`for(const el of document.querySelectorAll('.calc-content input,.calc-content select')){const r=el.getBoundingClientRect();ck(r.width>90&&r.right<=innerWidth&&r.left>=0,'600px controls fit');}
   document.querySelector('[data-calc-section="fuel"]').click();`);await wait(200);
  await run(`input('[data-entity="fuelrules"] [data-record-field="tank"]',150);ck(document.querySelector('#calc-fuel-example').textContent.includes('75.0 laps'),'Live fuel preview');await document.querySelector('.calc-record-form').onsubmit({preventDefault(){}});ck((await api.list('fuelrules')).find(r=>r.id===fuel.id).tank===150,'Same fuel record updated');
   document.querySelector('[data-entity="fuelrules"] [data-edit-record]').click();ck(document.getElementById('f-tank').value==='150','Full editor sees freshly saved value');document.getElementById('cancel').click();`);await wait(200);
  await capture('calculations-fuel-600.png');
  for(const section of ['effects','pits','estimates','results']){
   await run(`document.querySelector('[data-calc-section="${section}"]').click();`);await wait(150);
   await run(`ck(document.querySelector('.calc-content h3').textContent.length>0,'Section content');ck(document.documentElement.scrollWidth<=innerWidth+1,'No page overflow');`);
  }
  await run(`document.querySelector('[data-entity="championships"] [data-edit-record]').click();`);await wait(350);
  await run(`ck(!!document.getElementById('ch-back'),'Real championship editor');document.getElementById('ch-back').click();state.tab='settings';state.settingsSub='calculations';await render();document.querySelector('[data-entity="rotationsetups"] [data-edit-record]').click();`);await wait(250);
  await run(`ck(!!document.getElementById('ro-back'),'Real rotation editor');document.getElementById('ro-back').click();state.tab='settings';await render();document.querySelector('[data-calc-section="effects"]').click();`);await wait(150);
  await run(`input('[name="bopWindow"]',8);input('[name="bopMinLaps"]',4);await document.querySelector('.calc-bop').onsubmit({preventDefault(){}});ck(Bop.settingsOf(await api.getSettings()).window===8,'Same BoP settings');
   state.settings.theme='light';applyTheme();document.querySelector('[data-calc-section="pace"]').click();`);await wait(150);
  win.setContentSize(420,950);await run(`document.querySelector('.calc-head').scrollIntoView({block:'start'});`);
  await capture('calculations-light-420.png');
  await run(`ck(document.documentElement.scrollWidth<=innerWidth+1,'420px no horizontal overflow');ck(qaErrors.length===0,qaErrors.join(';'));`);
  await run(`const track=await api.add('tracks',{name:'Calculation circuit',lanes:1,targetLap:10});
   const ps=await api.add('pushsavesystems',{name:'Calculation push',...PushSave.defaults()});
   const tw=await api.add('tyrewearsystems',{name:'Calculation tyres',...TyreWear.defaults(),paceWear:'on'});
   const setup={name:'Calculation race',sessionType:'race',track:track.id,laps:10,firstLap:'count',lightsMin:0,lightsMax:0,fuelRules:fuel.id,pushSave:ps.id,tyreWear:tw.id};
   state.tab='race';state.race={track,setup,rows:[{}]};await render();
   const e=live.engine();ck(e.cfg.pushsave.benchmark==='average'&&e.cfg.pushsave.pacePolicy.window===5,'App prepares selected Push & Save policy');ck(e.cfg.tyrewear.pace.benchmark==='last','App prepares separate tyre policy');
   e.start(0);e.cars[0].started=true;e.cross(0,10000);const snap=e.snapshot(10000);
   state.settings=await api.setSettings({pushSaveBenchmark:'best',tyreWearBenchmark:'track'});
   ck(e.cfg.pushsave.benchmark==='average'&&e.cfg.tyrewear.pace.benchmark==='last','Existing race retains policies after settings edit');
   live.leave();live.alive=false;state.race={track,setup,rows:[{}],resume:{eng:snap,phase:'running'}};await render();
   ck(live.engine().cfg.pushsave.benchmark==='average'&&live.engine().cfg.tyrewear.pace.benchmark==='last','Interrupted race resumes original policies');
   live.leave();live.alive=false;state.race=null;ck(qaErrors.length===0,qaErrors.join(';'));`);
  console.log('CALCULATIONS ELECTRON PASSED: save/reopen, previews, shared fuel and BoP edits, championship/rotation links, 1200/600/420px, actual race preparation/freeze/resume');clearTimeout(timeout);app.quit();
 }catch(e){console.error(e);await capture('calculations-failure.png');app.exit(1);}
});});require('../../main');
