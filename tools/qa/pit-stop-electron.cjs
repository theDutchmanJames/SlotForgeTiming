// Production forms, race page, database and shared Race Director; isolated data and no physical hardware.
const { app } = require('electron'), fs = require('fs'), path = require('path'), assert = require('assert/strict');
const data = path.join(__dirname, '../../.tmp-test/pit-stop-electron-' + process.pid); fs.mkdirSync(data, { recursive: true }); app.setPath('appData', data); app.disableHardwareAcceleration();
const capture = process.argv.includes('--screenshots'), images = path.join(__dirname, '../../docs/ui-reference/service-stop'); if (capture) fs.mkdirSync(images, { recursive: true });
const wait = ms => new Promise(r => setTimeout(r, ms)); let done = false;
const timeout = setTimeout(() => { console.error('Service Stop Electron check timed out'); app.exit(1); }, 45000); timeout.unref();
app.on('browser-window-created', (_e, win) => {
  win.hide(); win.on('show', () => win.hide());
  win.webContents.on('console-message', e => { if (e.level === 'error') console.error('RENDERER', e.message); });
  win.webContents.on('did-finish-load', async () => {
    if (done || !win.webContents.getURL().endsWith('index.html')) return; done = true;
    const run = code => win.webContents.executeJavaScript('(async()=>{' + code + '})()');
    const shot = async name => { if (!capture) return; await wait(120); fs.writeFileSync(path.join(images, name + '.png'), (await win.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG()); console.log('Captured ' + name); };
    try {
      await wait(600); win.setSize(1320, 960); console.log('Service Stop QA: form');
      await run(`window.pitQA={};pitQA.track=await api.add('tracks',{name:'Service Stop QA',lanes:2});state.refs.tracks=await api.list('tracks');
        state.tab='racesetup';openForm('racesetups',null,{sessionType:'race'});
        const el=id=>document.getElementById('f-'+id),set=(id,v)=>{el(id).value=v;el(id).dispatchEvent(new Event('change',{bubbles:true}));};
        if(el('serviceStop').value!=='off')throw Error('default must be Off');
        set('name','Service Stop QA');set('track',pitQA.track.id);set('serviceStop','on');set('pitHoldMode','manual');set('pitHoldSeconds','3');set('pitServiceWork','add');set('pitHold','0.1');
        document.querySelector('[data-fg="service"]').open=true;document.querySelector('[data-fg="service"]').scrollIntoView();`);
      console.log('Service Stop QA: form ready');
      await shot('01-setup-dark');
      await run(`document.documentElement.dataset.theme='light';`); await shot('02-setup-light');
      await run(`document.documentElement.dataset.theme='ocean';`); await shot('03-setup-ocean');
      await run(`document.documentElement.dataset.theme='dark';await document.getElementById('frm').onsubmit({preventDefault(){}});pitQA.saved=(await api.list('racesetups')).find(x=>x.name==='Service Stop QA');
        if(!pitQA.saved||pitQA.saved.serviceStop!=='on'||Number(pitQA.saved.pitHoldSeconds)!==3||pitQA.saved.pitServiceWork!=='add')throw Error('real form/database save');
        openForm('racesetups',pitQA.saved);if(document.getElementById('f-serviceStop').value!=='on')throw Error('reopen');document.getElementById('cancel').click();
        state.speed=20;state.race={setup:{...pitQA.saved,firstLap:'count',lightsMin:0,lightsMax:0},track:pitQA.track,rows:[{},{}]};state.tab='race';await render();live.actions.start();`);
      for (let i = 0; i < 80 && !await run(`return live.phase==='running';`); i++) await wait(40);
      assert(await run(`return live.phase==='running'&&!!document.getElementById('pitholdpanel');`), JSON.stringify(await run(`return {phase:live.phase,pit:live.engine().cfg.pitControl,saved:pitQA.saved.serviceStop};`)));
      await run(`live.pitBtns[0].b.click();`); await wait(350);
      assert(await run(`return !!live.engine().cars[0].pitHold&&document.querySelector('.pit-hold-release').disabled;`));
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
      assert(await run(`return !!document.querySelector('#dir-pithold .pit-hold-clock')&&document.querySelector('#dir-pithold .pit-hold-release').disabled;`));
      win.setSize(430, 900);
      await run(`document.querySelector('#dir-pithold').scrollIntoView();`); await shot('06-director-narrow');
      await run(`window.confirm=()=>true;document.querySelector('#dir-pithold .pit-hold-early').click();`); await wait(200);
      assert(await run(`return live.engine().events.some(e=>e.type==='pitrelease'&&e.early);`));
      assert(await run(`return document.querySelector('#dir-pithold .pit-hold-buttons').hidden;`));
      await run(`LiveView.unmount();pitQA.host.remove();live.leave();live.alive=false;state.race=null;
        openForm('racesetups',pitQA.saved);const toggle=document.getElementById('f-serviceStop');toggle.value='off';toggle.dispatchEvent(new Event('change',{bubbles:true}));await document.getElementById('frm').onsubmit({preventDefault(){}});pitQA.saved=(await api.list('racesetups')).find(x=>x.id===pitQA.saved.id);
        openForm('racesetups',pitQA.saved);if(document.getElementById('f-serviceStop').value!=='off'||Number(document.getElementById('f-pitHoldSeconds').value)!==3||pitQA.saved.pitServiceWork!=='add')throw Error('Off must retain settings');
        if(PitHold.raceConfig(pitQA.saved).pitControl)throw Error('Off must restore normal rules');document.getElementById('cancel').click();`);
      console.log('ELECTRON SERVICE STOP PASSED ' + JSON.stringify({ form: true, database: true, reopen: true, independent: true, pause: true, lapGate: true, manualRelease: true, sharedDirector: true, earlyReleaseIPC: true, offRetainsSettings: true, screenshots: capture ? 6 : 0 }));
      clearTimeout(timeout); app.quit();
    } catch (e) { console.error(e.stack || e); app.exit(1); }
  });
});
require('../../main');
