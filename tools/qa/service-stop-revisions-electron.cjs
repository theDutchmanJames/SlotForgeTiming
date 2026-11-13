const fs=require('fs'),path=require('path'),os=require('os'),repo=path.resolve(__dirname,'../..'),req=require('module').createRequire(path.join(repo,'package.json'));
const {app,dialog}=req('electron'),out=path.resolve(__dirname,'../../../outputs/service-stop-revisions');fs.mkdirSync(out,{recursive:true});
const isolated=fs.mkdtempSync(path.join(os.tmpdir(),'sf-service-review-'));app.setPath('appData',isolated);process.env.LOCALAPPDATA=path.join(isolated,'local');app.disableHardwareAcceleration();
const profile=path.join(isolated,'slotforge-timing');fs.mkdirSync(profile);new(req('./db'))(path.join(profile,'slotforge-timing.json')).saveNow();fs.writeFileSync(path.join(profile,'storage-conversion-prompt.json'),JSON.stringify({version:1,choice:'keep'}));
const lib=req('./vendor/slotforge-library/index.cjs'),open=lib.open;lib.open=o=>open({...o,sharedRoot:path.join(isolated,'shared'),legacyProfiles:[profile]});
req('./tools/qa/qa-completion.cjs').preventRelaunch(app);req('./tools/qa/file-diagnostics.cjs')(path.join(out,'diagnostics.log'),()=>app.exit(1));dialog.showErrorBox=(t,m)=>{console.error(t,m);app.exit(1);};
const assert=require('assert/strict'),capture=true,images=out;
const wait = ms => new Promise(r => setTimeout(r, ms)); let done = false;
const timeout = setTimeout(() => { console.error('Service Stop Electron check timed out'); app.exit(1); }, 70000); timeout.unref();
app.on('browser-window-created', (_e, win) => {
  win.hide(); win.webContents.setBackgroundThrottling(false);
  win.webContents.on('console-message', e => { if (e.level === 'error') console.error('RENDERER', e.message); });
  win.webContents.on('did-finish-load', async () => {
    if (done || !win.webContents.getURL().endsWith('index.html')) return; done = true;
    const run = code => win.webContents.executeJavaScript('(async()=>{' + code + '})()');
    const shot = async name => { if (!capture) return; win.webContents.invalidate(); await wait(100); win.webContents.invalidate(); await wait(100); fs.writeFileSync(path.join(images, name + '.png'), (await win.webContents.capturePage()).toPNG()); console.log('Captured ' + name); };
    try {
      for(let i=0;i<150;i++){if(await run('return !!state.schema.racesetups'))break;await wait(40);} win.setSize(1320, 960); console.log('Service Stop QA: form');
      await run(`window.pitQA={};pitQA.track=await api.add('tracks',{name:'Service Stop QA',lanes:2});state.refs.tracks=await api.list('tracks');
        state.tab='racesetup';openForm('racesetups',null,{sessionType:'race'});
        const el=id=>document.getElementById('f-'+id),set=(id,v)=>{el(id).value=v;el(id).dispatchEvent(new Event('change',{bubbles:true}));};
        if(el('pitHoldMode').options.length!==3||el('pitHoldReturn'))throw Error('Release choices'); if(el('serviceStop').value!=='off')throw Error('default must be Off');
        set('name','Service Stop QA');set('track',pitQA.track.id);set('serviceStop','on');set('pitHoldMode','manual');set('pitHoldSeconds','30');set('pitServiceWork','add');set('pitHold','0.1');
        document.querySelector('[data-fg="service"]').open=true;document.querySelector('[data-fg="service"]').scrollIntoView();`);
      console.log('Service Stop QA: form ready');
      await shot('01-setup-dark');
      await run(`document.documentElement.dataset.theme='light';`); await shot('02-setup-light');
      await run(`document.documentElement.dataset.theme='ocean';`); await shot('03-setup-ocean');
      await run(`document.documentElement.dataset.theme='dark';await document.getElementById('frm').onsubmit({preventDefault(){}});pitQA.saved=(await api.list('racesetups')).find(x=>x.name==='Service Stop QA');
        if(!pitQA.saved||pitQA.saved.serviceStop!=='on'||Number(pitQA.saved.pitHoldSeconds)!==30||pitQA.saved.pitServiceWork!=='add')throw Error('real form/database save');
        openForm('racesetups',pitQA.saved);if(document.getElementById('f-serviceStop').value!=='on')throw Error('reopen');document.getElementById('cancel').click();
        state.speed=1;state.race={setup:{...pitQA.saved,firstLap:'count',lightsMin:0,lightsMax:0},track:pitQA.track,rows:[{},{}]};state.tab='race';await render();live.actions.start();`);
      for (let i = 0; i < 400 && !await run(`return live.phase==='running';`); i++) await wait(40);
      assert(await run(`return live.phase==='running'&&!!document.getElementById('pitholdpanel');`), JSON.stringify(await run(`return {phase:live.phase,pit:live.engine().cfg.pitControl,saved:pitQA.saved.serviceStop};`)));
      await run(`live.pitBtns[0].b.click();`); await wait(350);
      assert(await run(`return !!live.engine().cars[0].pitHold&&!document.querySelector('.pit-hold-release').disabled;`));
      await run(`live.actions.pause();pitQA.remaining=live.engine().pitHoldOf(0,performance.now()).remaining;`); await wait(200);
      assert(await run(`return live.engine().pitHoldOf(0,performance.now()).remaining===pitQA.remaining;`));
      await run(`live.actions.pause();const e=live.engine();e.pitSensor(0,false,performance.now());e.unblock(0,performance.now());pitQA.laps=e.cars[0].laps.length;e.cross(0,performance.now()+1000);if(e.cars[0].laps.length!==pitQA.laps)throw Error('lap while held');document.getElementById('pitholdpanel').scrollIntoView();`);
      await shot('04-race-held');
      for (let i = 0; i < 100 && !await run(`return !document.querySelector('.pit-hold-release').disabled;`); i++) await wait(40);
      assert(await run(`return !document.querySelector('.pit-hold-release').disabled;`));
      await shot('05-race-ready');
      await run(`document.querySelector('.pit-hold-release').click();if(live.engine().cars[0].pits.length!==1)throw Error('real release button');`);
      // Feed the real viewer, then use the authenticated director command channel back to the parked race.
      await run(`live.pitBtns[0].b.click();`); await wait(300);
      await run(`pitQA.host=document.createElement('div');document.getElementById('view').appendChild(pitQA.host);await LiveView.mount(pitQA.host,{});LiveView.go('director');`); await wait(250);
      assert(await run(`return !!document.querySelector('#dir-pithold .pit-hold-clock')&&!document.querySelector('#dir-pithold .pit-hold-release').disabled;`));
      win.setContentSize(744, 1200);
      await run(`document.querySelector('#dir-pithold').scrollIntoView({block:'start'});window.scrollTo(0,document.documentElement.scrollHeight);`); await shot('06-director-narrow');
      await run(`window.confirm=()=>true;document.querySelector('#dir-pithold .pit-hold-release').click();`); await wait(200);
      assert(await run(`return live.engine().events.some(e=>e.type==='pitrelease'&&e.early);`));
      assert(await run(`return document.querySelector('#dir-pithold .pit-hold-buttons').hidden;`));
      await run(`LiveView.unmount();pitQA.host.remove();live.leave();live.alive=false;state.race=null;
        openForm('racesetups',pitQA.saved);const toggle=document.getElementById('f-serviceStop');toggle.value='off';toggle.dispatchEvent(new Event('change',{bubbles:true}));await document.getElementById('frm').onsubmit({preventDefault(){}});pitQA.saved=(await api.list('racesetups')).find(x=>x.id===pitQA.saved.id);
        openForm('racesetups',pitQA.saved);if(document.getElementById('f-serviceStop').value!=='off'||Number(document.getElementById('f-pitHoldSeconds').value)!==30||pitQA.saved.pitServiceWork!=='add')throw Error('Off must retain settings');
        if(PitHold.raceConfig(pitQA.saved).pitControl)throw Error('Off must restore normal rules');document.getElementById('cancel').click();`);
      win.setContentSize(1320,1000);
      for(const mode of ['auto','manual','driver']) {
        await run(`openForm('racesetups',pitQA.saved);const el=document.getElementById('f-pitHoldMode');el.value=${JSON.stringify(mode)};el.dispatchEvent(new Event('change',{bubbles:true}));await document.getElementById('frm').onsubmit({preventDefault(){}});pitQA.saved=(await api.list('racesetups')).find(x=>x.id===pitQA.saved.id);if(pitQA.saved.pitHoldMode!==${JSON.stringify(mode)})throw Error('Mode save');`);
      }
      await run(`openForm('racesetups',{...pitQA.saved,serviceStop:'on'});document.querySelector('[data-fg="service"]').open=true;document.querySelector('[data-fg="service"]').scrollIntoView();`);
      for(const theme of await run('return Theme.THEMES.map(x=>x[0]);')){
        await run(`state.settings.theme=${JSON.stringify(theme)};applyTheme();`);await shot('driver-setup-'+theme);
      }
      await run('document.getElementById("cancel").click();');
      console.log('ELECTRON SERVICE STOP PASSED ' + JSON.stringify({ form: true, database: true, reopen: true, independent: true, pause: true, lapGate: true, manualRelease: true, sharedDirector: true, earlyReleaseIPC: true, offRetainsSettings: true, screenshots: capture ? 15 : 0 }));
      fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({form:true,reopen:true,manualBeforeDeadline:true,sharedDirector:true,pause:true,lapGate:true,offRetainsSettings:true,allModesSaved:true,themes:9}));req('./tools/qa/qa-completion.cjs').complete();clearTimeout(timeout); app.quit();
    } catch (e) { console.error(e.stack || e); app.exit(1); }
  });
});
req('./main');
