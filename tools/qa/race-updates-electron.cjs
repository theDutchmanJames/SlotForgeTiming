// Production form and live-control smoke test for 1.84.0. Uses a private app-data folder; no timing hardware is opened.
const { app } = require('electron'), fs = require('fs'), path = require('path'), assert = require('assert/strict');
const data = path.join(__dirname, '../../.tmp-test/race-updates-electron-' + process.pid); fs.mkdirSync(data, { recursive: true }); app.setPath('appData', data); app.disableHardwareAcceleration();
const wait = ms => new Promise(resolve => setTimeout(resolve, ms)); let done = false;
const timeout = setTimeout(() => { console.error('Race updates Electron check timed out'); app.exit(1); }, 45000); timeout.unref();
app.on('browser-window-created', (_event, win) => {
  win.hide(); win.on('show', () => win.hide());
  win.webContents.on('console-message', e => { if (e.level === 'error') console.error('RENDERER', e.message); });
  win.webContents.on('did-finish-load', async () => {
    if (done || !win.webContents.getURL().endsWith('index.html')) return; done = true;
    const run = code => win.webContents.executeJavaScript('(async()=>{' + code + '})()');
    try {
      await wait(600); win.setSize(1280, 900);
      await run(`window.upQA={};upQA.track=await api.add('tracks',{name:'Race updates QA',lanes:2});upQA.fuel=await api.add('fuelrules',{name:'QA fuel',tank:20,perLap:1,rate:5});state.refs.tracks=await api.list('tracks');state.refs.fuelrules=await api.list('fuelrules');
        state.tab='racesetup';openForm('racesetups',null,{sessionType:'race'});
        const el=id=>document.getElementById('f-'+id),set=(id,v)=>{el(id).value=v;el(id).dispatchEvent(new Event('change',{bubbles:true}));};
        set('name','Race updates QA');set('track',upQA.track.id);set('fuelRules',upQA.fuel.id);set('redFlagSeconds','5');
        if(!document.querySelector('#f-system-switches [data-system-key="fuel"]'))throw Error('fuel setup switch missing');
        document.querySelector('#f-system-switches [data-system-key="fuel"]').click();
        if(document.getElementById('f-disabledSystems').value!=='fuel')throw Error('saved system switch did not set default off');
        document.querySelector('#f-system-switches [data-system-key="fuel"]').click();
        if(document.getElementById('f-disabledSystems').value!=='')throw Error('saved system switch did not restore default on');
        await document.getElementById('frm').onsubmit({preventDefault(){}});upQA.setup=(await api.list('racesetups')).find(x=>x.name==='Race updates QA');
        if(!upQA.setup||upQA.setup.fuelRules!==upQA.fuel.id||Number(upQA.setup.redFlagSeconds)!==5||upQA.setup.disabledSystems)throw Error('setup did not persist');
        state.speed=20;state.race={setup:{...upQA.setup,firstLap:'count',lightsMin:0,lightsMax:0},track:upQA.track,rows:[{},{}]};state.tab='race';await render();live.actions.start();`);
      for (let i = 0; i < 80 && !await run(`return live.phase==='running';`); i++) await wait(40);
      assert(await run(`return live.phase==='running'&&!!document.querySelector('#systempanel [data-system-key="fuel"]')&&live.engine().systemEnabled('fuel');`), JSON.stringify(await run(`return {phase:live.phase,panel:document.getElementById('systempanel')&&document.getElementById('systempanel').innerHTML,systems:live.engine().systemsOf(),fuel:live.engine().fuel,setup:upQA.setup};`)));
      await run(`document.querySelector('#systempanel [data-system-key="fuel"]').click();`); await wait(80);
      assert(await run(`return !live.engine().systemEnabled('fuel')&&document.querySelector('#systempanel [data-system-key="fuel"]').textContent.includes('Off');`), 'main switch turns fuel off');
      await run(`document.querySelector('#systempanel [data-system-key="fuel"]').click();`); await wait(80);
      assert(await run(`return live.engine().systemEnabled('fuel')&&document.querySelector('#systempanel [data-system-key="fuel"]').textContent.includes('On');`), 'main switch restores fuel');
      await run(`upQA.host=document.createElement('div');document.getElementById('view').appendChild(upQA.host);await LiveView.mount(upQA.host,{});LiveView.go('director');`); await wait(250);
      assert(await run(`return !!document.querySelector('#dir-systems [data-system-key="fuel"]');`), 'shared Race Director panel is present');
      await run(`document.querySelector('#dir-systems [data-system-key="fuel"]').click();`); await wait(160);
      assert(await run(`return !live.engine().systemEnabled('fuel')&&document.querySelector('#systempanel [data-system-key="fuel"]').textContent.includes('Off');`), 'shared Race Director command reaches this race');
      await run(`const e=live.engine(),t=performance.now();e.cross(0,t+10000);e.setFlag('red',t+14000);e.setFlag('red',t+114000);e.cross(0,t+116000);
        if(!e.cars[0].invalid.length||!e.cars[0].redLaps.length||e.cars[0].laps.length!==2)throw Error('red lap was not protected');
        LiveView.unmount();upQA.host.remove();live.leave();live.alive=false;state.race=null;`);
      console.log('ELECTRON RACE UPDATES PASSED ' + JSON.stringify({ savedDefaults: true, redFlagSetting: true, mainControls: true, sharedDirector: true, redLap: true }));
      clearTimeout(timeout); app.quit();
    } catch (e) { console.error(e.stack || e); app.exit(1); }
  });
});
require('../../main');
