// Full app + real IPC + compiled helper with in-memory ports. Separate database; no physical hardware.
const { app } = require('electron'), fs = require('fs'), path = require('path'), assert = require('assert/strict'), { spawn } = require('child_process');
const data = path.join(__dirname, '../../.tmp-test/parallel-electron-' + process.pid); fs.mkdirSync(data, { recursive: true }); app.setPath('appData', data); app.disableHardwareAcceleration();
let helper, controller;
const real = require('../../parallelport');
require.cache[require.resolve('../../parallelport')].exports = { createController: options => (controller = real.createController({ ...options, allowSimulation: true, spawn: () => (helper = spawn(path.join(__dirname, '../../native/parallel/SlotForgeParallel.exe'), ['--simulate'], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })) })) };
const pause = ms => new Promise(r => setTimeout(r, ms)); let done = false;
const timeout = setTimeout(() => { console.error('Electron Parallel Port QA timed out'); app.exit(1); }, 45000); timeout.unref();
app.on('browser-window-created', (_e, win) => {
  win.hide(); win.on('show', () => win.hide());
  win.webContents.on('console-message', (_event, ...args) => { const message = _event.message || args[1]; if (_event.level === 'error' || args[0] === 3) console.error('RENDERER', message); });
  win.webContents.on('did-finish-load', async () => {
    if (done || !win.webContents.getURL().endsWith('index.html')) return; done = true;
    const run = code => win.webContents.executeJavaScript('(async()=>{' + (code.includes(';') || code.startsWith('const ') ? code : 'return ' + code) + '})()');
    try {
      await pause(700);
      await run("state.tab='settings';state.settingsSub='hardware';state.hwSub='parallel';render()");
      assert(await run("!!document.querySelector('.parallel-setup')"));
      // Save through the real page and real database, rather than injecting settings only.
      await run("const input=document.querySelector('[data-setting=name]');input.value='Electron QA port';input.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('[data-save]').click()"); await pause(150);
      assert.equal(await run("(await api.getSettings()).parallelPort.name"), 'Electron QA port');
      await run("await setTimingHw('parallel');await ppConnect()"); await pause(80); helper.stdin.write('S 192 11\n'); await pause(30); helper.stdin.write('S 128 11\n'); await pause(150);
      assert.equal(await run('ParallelPort.link.total'), 1);
      await run("state.speed=40;state.race={setup:{id:'parallel-qa',name:'Parallel QA',sessionType:'race',laps:20,firstLap:'count',lightsMin:0,lightsMax:0,startPower:'off',trackcall:'yellow'},track:{id:'qa-track',name:'QA',lanes:2,minLap:0},rows:[{},{}]};state.tab='race';await render()");
      for (let i = 0; i < 30 && !await run('live.parallel && live.parallel.ready()'); i++) await pause(30);
      assert(await run('live.parallel.ready()')); await run('live.actions.start()');
      for (let i = 0; i < 100 && await run('live.phase') !== 'running'; i++) await pause(30);
      assert.equal(await run('live.phase'), 'running');
      await pause(70); // Respect the engine's existing minimum-lap time after lights out.
      helper.stdin.write('S 192 11\n'); await pause(35); helper.stdin.write('S 128 11\n'); await pause(120);
      assert.equal(await run('live.engine().cars[0].laps.length'), 1);
      await run("state.tab='settings';state.settingsSub='hardware';state.hwSub='parallel';await render()");
      assert(await run("document.querySelector('[data-setting=name]').disabled && document.getElementById('hw-use').disabled"));
      helper.stdin.write('S 128 11\n'); await pause(40); helper.stdin.write('S 192 11\n'); await pause(30); helper.stdin.write('S 128 11\n'); await pause(120);
      assert.equal(await run('live.engine().cars[0].laps.length'), 2);
      await assert.rejects(run('await api.parallelArm(true)'), /race/i);
      // The race keeps using its existing source; the other interfaces' events cannot add a lap.
      await run("Trackmate.link.emit({type:'hit',lane:0,at:performance.now()})"); assert.equal(await run('live.engine().cars[0].laps.length'), 2);
      // Losing native timing must pause racing and preserve its configuration lock.
      helper.kill(); await pause(220); assert.equal(await run('live.phase'),'paused'); assert.equal(await run('live.engine().flag'),'red'); assert(controller.state().race);
      await run('live.actions.red()');assert.equal(await run('live.phase'),'paused');
      await assert.rejects(run("await api.setSettings({timingHw:'none'})"),/race/i);
      assert(await run("!document.querySelector('[data-connect]').disabled && document.querySelector('[data-setting=name]').disabled"));
      await run("document.querySelector('[data-connect]').click()");await pause(250);assert(await run('live.parallel.ready()'));assert.equal(await run('ParallelPort.link.power'),false);assert.equal(await run('live.phase'),'paused');
      helper.stdin.write('S 192 11\n');await pause(40);helper.stdin.write('S 128 11\n');await pause(70);assert.equal(await run('live.engine().cars[0].laps.length'),2);
      await run('live.actions.red()');await pause(180);assert.equal(await run('live.phase'),'running');assert.equal(await run('ParallelPort.link.power'),true);
      await run("window.qaResume={...state.race,setup:{...state.race.setup,startPower:'on'},resume:{eng:live.engine().snapshot(performance.now())}};live.leave();live.alive=false;state.race=null");await pause(100);
      await run("state.race=qaResume;state.tab='race';await render()");await pause(180);assert.equal(await run('live.phase'),'paused');assert(await run('live.parallel.ready()'));assert.equal(await run('ParallelPort.link.power'),false);
      await run('live.actions.pause()');await pause(80);assert.equal(await run('live.phase'),'running');assert.equal(await run('ParallelPort.link.power'),true);
      await run("live.leave();live.alive=false;state.race=null;state.tab='settings';await render()"); await pause(150); assert.equal(controller.state().race, false);
      await run("await ppClose();state.settings=await api.setSettings({parallelPort:{...ParallelPort.defaults(),lanes:2,pitMode:'separate',pitPins:[12,13,0,0,0,0,0,0]}});await ppConnect();state.race={setup:{id:'parallel-pit-qa',name:'Separate pit QA',sessionType:'race',laps:20,firstLap:'count',lightsMin:0,lightsMax:0},track:{id:'qa-track',name:'QA',lanes:2},rows:[{},{}]};state.tab='race';await render()");
      await pause(80); await run('live.actions.start()'); for (let i=0;i<100&&await run('live.phase')!=='running';i++)await pause(30); await pause(70);
      helper.stdin.write('S 192 11\n');await pause(35);helper.stdin.write('S 128 11\n');await pause(60);
      assert.equal(await run('live.engine().cars[0].laps.length'),1);
      helper.stdin.write('S 160 11\n');await pause(60);assert(await run('live.engine().cars[0].blockAt!==null'));assert.equal(await run('live.engine().cars[0].laps.length'),1);
      helper.stdin.write('S 128 11\n');await pause(60);assert.equal(await run('live.engine().cars[0].blockAt'),null);
      await run('live.leave();live.alive=false;state.race=null');await pause(60);
      const result = { realPage: true, database: true, preloadIPC: true, nativeHelper: true, raceLaps: 2, parkedRace: true, otherHardwareIgnored: true, outputTestsLocked: true, leaseReleased: true, separatePitWithoutExtraLap:true,disconnectPauses:true,reconnectViaSettings:true,restoredRacePowerOff:true };
      console.log('ELECTRON PARALLEL PORT PASSED ' + JSON.stringify(result)); clearTimeout(timeout); await controller.shutdown(); app.quit();
    } catch (x) { console.error(x); if (controller) await controller.shutdown(); app.exit(1); }
  });
});
require('../../main');
