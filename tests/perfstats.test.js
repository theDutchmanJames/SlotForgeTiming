// 1.60.0: what the core of the app tells about the computer and the app (perfstats.js), with the things it asks given to it: the processes, the graphics, the screen, the computer,
// the processor's heat and speed, how long the core was stuck, the race save. And the whole way to the line: what it tells, made safe by renderer/perf.js, as a report.
const fs = require('fs'), path = require('path');
const { createCollector, STEP, KEEP, IDLE_STOP, STALLS_KEEP } = require('../perfstats.js');
const Perf = require('../renderer/perf.js');
let fails = 0;
const ok = (m, c) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const wait = ms => new Promise(r => setTimeout(r, ms));

const files = { '/proc/device-tree/model': 'Raspberry Pi 5 Model B Rev 1.0\u0000', '/sys/class/thermal/thermal_zone0/temp': '62500\n', '/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq': '2400000\n', '/sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_max_freq': '2400000\n', '/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor': 'ondemand\n' };
function deps(over = {}) {
  const clock = { t: 1000000 }, timers = [];
  const d = {
    app: { getAppMetrics: () => [{ type: 'Browser', cpu: { percentCPUUsage: 3 }, memory: { workingSetSize: 102400 } }, { type: 'Tab', cpu: { percentCPUUsage: 15 }, memory: { workingSetSize: 307200 } }, { type: 'GPU', cpu: { percentCPUUsage: 6 }, memory: { workingSetSize: 204800 } }],
      getGPUFeatureStatus: () => ({ gpu_compositing: 'disabled_software', rasterization: 'disabled_software', opengl: 'enabled_on' }),
      getGPUInfo: async () => ({ gpuDevice: [{ active: false, vendorId: 1, deviceId: 2 }, { active: true, vendorId: 5, deviceId: 6, driverVendor: 'Mesa', driverVersion: '24.2' }], auxAttributes: { glRenderer: 'V3D 7.1.7' } }) },
    screen: { getPrimaryDisplay: () => ({ size: { width: 1920, height: 1080 }, scaleFactor: 1 }), getAllDisplays: () => [{}, {}] },
    os: { platform: () => 'linux', arch: () => 'arm64', release: () => '6.6.62', cpus: () => [1, 2, 3, 4].map(() => ({ model: 'Cortex-A76' })), totalmem: () => 8 * 1073741824, freemem: () => 5 * 1073741824, loadavg: () => [1.2, 0.9, 0.6] },
    process: { env: { XDG_SESSION_TYPE: 'wayland' }, argv: ['electron', '.', '--ozone-platform=x11', '--disable-gpu', '--inspect=9229', '--no-sandbox'], versions: { electron: '38.0.0', chrome: '140.0.0.0', node: '22.0.0' } },
    db: { resumeStats: () => ({ writes: 7, lastMs: 3.2, maxMs: 11.4, failed: 0 }) }, version: '1.60.0',
    readText: async p => { if (p in files) return files[p]; throw new Error('ENOENT'); },
    now: () => clock.t, setInterval: (f, ms) => { const t = { f, ms, off: false, unref() { t.unrefd = true; } }; timers.push(t); return t; }, clearInterval: t => { t.off = true; }, ...over
  };
  return { d, clock, timers };
}

(async () => {
  { const { d, clock, timers } = deps(), C = createCollector(d);
    ok('before anybody asks nothing is running (no timer, nothing measured)', timers.length === 0 && C.running() === false);
    const a = await C.collect();
    ok('the first question starts the looking: one timer, every 100 ms', timers.length === 1 && timers[0].ms === STEP && STEP === 100 && C.running() === true);
    ok('the processes: the kind, the CPU, the memory in MB', a.metrics.length === 3 && a.metrics[1].type === 'Tab' && a.metrics[1].cpu === 15 && a.metrics[1].memMB === 300 && a.metrics[0].memMB === 100);
    ok('the graphics: the status, and the device (the one that is in use, with the driver)', a.gpuStatus.gpu_compositing === 'disabled_software' && a.gpuDevice === 'V3D 7.1.7 Mesa 24.2');
    ok('the screen: the size, the scale, the number of screens', a.display.width === 1920 && a.display.height === 1080 && a.display.scale === 1 && a.display.count === 2);
    ok('the session of the computer (and where it is read from when that is missing)', a.session === 'wayland');
    { const x = await createCollector(deps({ process: { env: { WAYLAND_DISPLAY: 'wayland-0' }, argv: [], versions: {} } }).d).collect(), y = await createCollector(deps({ process: { env: { DISPLAY: ':0' }, argv: [], versions: {} } }).d).collect(), z = await createCollector(deps({ process: { env: {}, argv: [], versions: {} } }).d).collect();
      ok('...from WAYLAND_DISPLAY, from DISPLAY, or empty', x.session === 'wayland' && y.session === 'x11' && z.session === ''); }
    ok('what the app was started with: only the switches that matter for drawing (not --inspect, not the first two words)', a.switches.join(' ') === '--ozone-platform=x11 --disable-gpu --no-sandbox');
    ok('the computer: system, kind, memory in MB, load', a.os.platform === 'linux' && a.os.arch === 'arm64' && a.os.cpus === 4 && a.os.cpuModel === 'Cortex-A76' && a.os.memoryMB === 8192 && a.os.freeMB === 5120 && a.os.load[0] === 1.2);
    ok('a Raspberry Pi says which one it is (without the character that ends its name), how hot it is and how fast it runs', a.os.model === 'Raspberry Pi 5 Model B Rev 1.0' && a.thermal.tempC === 62.5 && a.thermal.mhz === 2400 && a.thermal.maxMhz === 2400 && a.thermal.governor === 'ondemand');
    ok('the versions, and how the race save goes', a.versions.app === '1.60.0' && a.versions.electron === '38.0.0' && a.versions.chrome === '140.0.0.0' && a.save.writes === 7 && a.save.maxMs === 11.4);
    ok('nothing was stuck yet', a.lag.max10 === 0 && a.lag.all === 0);

    // the core is stuck: the clock jumps 600 ms between two looks (100 ms was expected)
    clock.t += 100; C.sample(); clock.t += 600; C.sample(); clock.t += 100; C.sample();
    const b = await C.collect();
    ok('a look that came 500 ms too late is a stall of 500 ms: in the last ten seconds, in the last minute and in all', b.lag.max10 === 500 && b.lag.max60 === 500 && b.lag.all === 500);
    for (let i = 0; i < 110; i++) { clock.t += 100; C.sample(); } C.touch(); const c = await C.collect();
    ok('...after eleven seconds it no longer counts for the ten seconds, but it does for the minute', c.lag.max10 === 0 && c.lag.max60 === 500 && c.lag.all === 500);
    for (let i = 0; i < 650; i++) { clock.t += 100; C.sample(); if (i % 100 === 0) C.touch(); } const e = await C.collect(); // (a minute of looks, one every 100 ms, with somebody asking now and then)
    ok('...and after a minute only "all" remembers it', e.lag.max60 === 0 && e.lag.all === 500);
    for (let i = 0; i < 320; i++) { clock.t += 100; C.sample(); } // (32 seconds of looks, and nobody asks)
    ok('when nobody has asked for 30 seconds the looking stops by itself (the timer is cleared)', C.running() === false && timers[0].off === true && IDLE_STOP === 30000 && KEEP === 60000);
    await C.collect();
    ok('...and the next question starts it again (a new timer, and the time in between is not counted as a stall)', C.running() === true && timers.length === 2 && (await C.collect()).lag.max10 === 0);
    C.stop(); ok('stop() stops it at once', C.running() === false && timers[1].off === true); }

  { const { d, clock, timers } = deps(), C = createCollector(d);
    await C.collect();
    ok('the looking does not keep the program alive (its timer is let go of with unref)', timers[0].unrefd === true);
    for (let i = 0; i < 700; i++) { clock.t += 100; C.sample(); if (i % 100 === 0) C.touch(); }
    ok('...and it keeps the last minute only (601 looks, not 700)', C.size() >= 599 && C.size() <= 601); }

  { const { d, clock } = deps(), C = createCollector(d);
    C.touch(); clock.t += 600; C.sample(); // (a look that came 500 ms too late)
    clock.t += 10000; const a = await C.collect();
    ok('a stall of exactly ten seconds ago still counts for the ten seconds', a.lag.max10 === 500);
    clock.t += 1; const b = await C.collect();
    ok('...one millisecond later it does not (but the minute remembers it)', b.lag.max10 === 0 && b.lag.max60 === 500); }

  { const a = await createCollector(deps({ process: { env: { WAYLAND_DISPLAY: 'wayland-0', DISPLAY: ':0' }, argv: [], versions: {} } }).d).collect();
    ok('a Wayland session that also has an X display (XWayland: both are set) is a wayland session', a.session === 'wayland'); }

  { const a = await createCollector(deps({ readText: async () => '   \n' }).d).collect();
    ok('a file with only spaces in it is no number (not zero degrees, not 0 MHz)', a.thermal.tempC === null && a.thermal.mhz === null && a.thermal.maxMhz === null); }

  { const realSet = global.setTimeout, realClear = global.clearTimeout, live = new Set();
    global.setTimeout = (f, ms, ...r) => { const id = realSet(() => { live.delete(id); f(...r); }, ms); live.add(id); return id; };
    global.clearTimeout = id => { live.delete(id); realClear(id); };
    await createCollector(deps().d).collect();
    const left = live.size; global.setTimeout = realSet; global.clearTimeout = realClear;
    ok('the wait for the graphics device is taken away when the answer came (no timer is left behind)', left === 0); }

  { const { d } = deps({ os: { platform: () => 'win32', arch: () => 'x64', release: () => '10', cpus: () => [{ model: 'i5' }], totalmem: () => 1073741824, freemem: () => 536870912, loadavg: () => [0, 0, 0] } }), a = await createCollector(d).collect();
    ok('on another system than Linux there are no heat and speed figures (and no model)', JSON.stringify(a.thermal) === '{}' && a.os.model === undefined && a.os.platform === 'win32'); }

  { const { d } = deps({ readText: async () => { throw new Error('no'); } }), a = await createCollector(d).collect(), m = Perf.cleanMain(a);
    ok('files that can not be read give unknown figures, not an error', a.thermal.tempC === null && a.thermal.mhz === null && a.thermal.governor === '' && m.thermal.tempC === null && a.os.model === undefined);
    const e = deps({ readText: async () => 'abc' }), x = await createCollector(e.d).collect();
    ok('...and text that is not a number is not a number', x.thermal.tempC === null && x.thermal.mhz === null && x.os.model === 'abc'); }

  { const { d } = deps({ app: { getAppMetrics: () => { throw new Error('not ready'); }, getGPUFeatureStatus: () => { throw new Error('x'); }, getGPUInfo: async () => { throw new Error('x'); } }, screen: { getPrimaryDisplay: () => { throw new Error('x'); }, getAllDisplays: () => [] }, os: { platform: () => 'linux', cpus: () => { throw new Error('x'); } } });
    const a = await createCollector(d).collect(), m = Perf.cleanMain(a);
    ok('when Electron can not tell (not ready yet, no screen), the answer has what it has and nothing fails', a.metrics.length === 0 && Object.keys(a.gpuStatus).length === 0 && a.gpuDevice === '' && a.display && Object.keys(a.display).length === 0 && m && m.procs.total === 0); }

  { let n = 0; const { d } = deps(); d.app.getGPUInfo = async () => { n++; return { gpuDevice: [{ vendorId: 4318, deviceId: 7 }] }; };
    const C = createCollector(d); const a = await C.collect(), b = await C.collect();
    ok('the graphics device is asked for once (it does not change), and without a name it is the numbers', n === 1 && a.gpuDevice === 'vendor 4318 device 7' && b.gpuDevice === a.gpuDevice); }

  { const { d } = deps(); d.app.getGPUInfo = () => new Promise(() => {});
    const t0 = Date.now(), a = await createCollector(d).collect();
    ok('a graphics device that does not answer does not hold the answer up for more than a second (and is empty)', Date.now() - t0 < 1500 && a.gpuDevice === ''); }

  { const { d } = deps(), a = await createCollector(d).collect(), m = Perf.cleanMain(JSON.parse(JSON.stringify(a)));
    ok('the whole way: what the core tells (over the link as text) is understood by the window as the same figures', m.procs.window === 15 && m.procs.graphics === 6 && m.procs.core === 3 && m.procs.total === 24 && m.gpu.drawsWindow === false && m.gpu.device === 'V3D 7.1.7 Mesa 24.2' && m.os.model === 'Raspberry Pi 5 Model B Rev 1.0' && m.thermal.tempC === 62.5 && m.lag.max10 === 0 && m.save.writes === 7 && m.versions.app === '1.60.0');
    const rep = Perf.report(null, m, {});
    ok('...and it makes a report that names the Pi and says the window is drawn in software', rep.includes('Raspberry Pi 5 Model B Rev 1.0') && rep.includes('SOFTWARE')); }

  { const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8'), pre = fs.readFileSync(path.join(__dirname, '..', 'preload.js'), 'utf8'), web = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'webapi.js'), 'utf8');
    ok('main.js answers "perf:stats" from the collector (made when the database is there), the preload script and the browser version have perfStats', /createCollector\(\{ app, screen, os, process, db,/.test(main) && main.includes("ipcMain.handle('perf:stats', () => perf.collect())") && pre.includes("perfStats: () => call('perf:stats')") && /perfStats: async \(\) => null/.test(web)); }

  // ---- 1.60.1: the stalls with their clock time, the marks, the windows ----
  { const { d, clock } = deps(), C = createCollector(d);
    await C.collect(); // (somebody asks: it looks)
    clock.t += 100; C.sample(); clock.t += 199; C.sample(); clock.t += 200; C.sample(); clock.t += 1568; C.sample();
    const a = await C.collect();
    ok('a look that came 99 ms late is not written down; 100 ms late is, and 1468 ms late is, each with the clock time of the look', a.stalls.length === 2 && a.stalls[0].ms === 100 && a.stalls[0].at === 1000499 && a.stalls[1].ms === 1468 && a.stalls[1].at === 1002067); }
  { const x = deps(), K = createCollector(x.d); await K.collect(); x.clock.t += 199; K.sample();
    const r = await K.collect();
    ok('a look that was 99 ms late (199 ms after the last) is no stall', r.stalls.length === 0);
    x.clock.t += 200; K.sample(); const r2 = await K.collect();
    ok('...and one that was exactly 100 ms late is (the smallest stall that is written down)', r2.stalls.length === 1 && r2.stalls[0].ms === 100); }
  { const x = deps(), K = createCollector(x.d); await K.collect();
    for (let i = 0; i < 40; i++) { x.clock.t += 100 + 100 + i; K.sample(); K.touch(); }
    const r = await K.collect();
    ok('at most the last 10 stalls are given (of 40 that were written down: 100 + i ms, the last ones)', r.stalls.length === 10 && r.stalls[9].ms === 139 && r.stalls[0].ms === 130);
    r.stalls[0].ms = -5; const r2 = await K.collect();
    ok('...they are copies', r2.stalls[0].ms === 130);
    ok('...the collector keeps 10 (STALLS_KEEP), not more', STALLS_KEEP === 10 && require('../perfstats.js').STALL_MIN === 100); }
  { for (const n of [10, 11]) { const x = deps(), K = createCollector(x.d); await K.collect();
      for (let i = 0; i < n; i++) { x.clock.t += 100 + 100 + i; K.sample(); K.touch(); }
      const r = await K.collect();
      ok(`${n} stalls written down: all ten of them are given when there are ten, the last ten when there are eleven`, r.stalls.length === 10 && r.stalls[9].ms === 100 + n - 1 && r.stalls[0].ms === 100 + n - 10);
      const y = deps(), L = createCollector(y.d); for (let i = 0; i < n; i++) L.mark('m' + i);
      const c = await L.collect();
      ok(`...and the same for ${n} marks`, c.marks.length === 10 && c.marks[9].text === 'm' + (n - 1) && c.marks[0].text === 'm' + (n - 10)); } }
  { const x = deps(), K = createCollector(x.d);
    K.mark('Live Race window opened (1460 ms in the core)');
    ok('a mark is kept when nobody is looking (no timer is started for it)', K.running() === false && x.timers.length === 0);
    const a = await K.collect();
    ok('...and is given with the clock time of the mark', a.marks.length === 1 && a.marks[0].text === 'Live Race window opened (1460 ms in the core)' && a.marks[0].at === 1000000);
    K.mark(''); K.mark(null); K.mark(5); K.mark(undefined); K.mark({}); K.mark('y'.repeat(300));
    const b = await K.collect();
    ok('...a mark that is not text, or empty, is left out; a long one is cut at 100', b.marks.length === 2 && b.marks[1].text.length === 100);
    for (let i = 0; i < 50; i++) K.mark('m' + i);
    const c = await K.collect();
    ok('...at most the last 10 are given', c.marks.length === 10 && c.marks[9].text === 'm49' && c.marks[0].text === 'm40');
    c.marks[0].text = 'changed';
    ok('...as copies', (await K.collect()).marks[0].text === 'm40');
    ok('...and 10 are kept', require('../perfstats.js').MARKS_KEEP === 10); }
  { const { d } = deps(), C = createCollector(d), a = await C.collect();
    ok('the processes come with their number (so a window can be given its own figures)', a.metrics.every(m => typeof m.pid === 'number' || m.pid === undefined) && a.metrics.length === 3); }
  { const calls = [];
    const { d } = deps({ windows: () => { calls.push(1); return [{ title: 'SlotForge Timing', pid: 11, visible: true, minimized: false, focused: true, live: false }, { title: 'Live Race', pid: 12, visible: true, minimized: false, focused: false, live: true }]; } });
    const a = await createCollector(d).collect();
    ok('the windows are asked of the app each time the core is asked', a.windows.length === 2 && a.windows[1].live === true && a.windows[0].title === 'SlotForge Timing' && calls.length === 1);
    const { d: d2 } = deps({ windows: () => { throw new Error('gone'); } });
    ok('...a window list that throws is an empty list (the rest of the answer is still given)', (await createCollector(d2).collect()).windows.length === 0 && (await createCollector(d2).collect()).os.cpus === 4);
    const { d: d3 } = deps({ windows: () => null });
    ok('...a list that is nothing is an empty list', (await createCollector(d3).collect()).windows.length === 0);
    const { d: d4 } = deps();
    ok('...an app that has no list of windows gives an empty list', (await createCollector(d4).collect()).windows.length === 0);
    const { d: d5 } = deps({ windows: () => Array.from({ length: 20 }, (_, i) => ({ title: 'w' + i, pid: i })) });
    ok('...at most 8 windows are given', (await createCollector(d5).collect()).windows.length === 8); }
  { // the whole way: a stall, a mark and two windows, made safe and put in a report
    const px = 21, { d, clock } = deps({ app: { getAppMetrics: () => [{ type: 'Tab', pid: 11, cpu: { percentCPUUsage: 15 }, memory: { workingSetSize: 307200 } }, { type: 'Tab', pid: 12, cpu: { percentCPUUsage: 25 }, memory: { workingSetSize: 614400 } }], getGPUFeatureStatus: () => ({ gpu_compositing: 'enabled_on', rasterization: 'enabled_on' }), getGPUInfo: async () => ({}) },
      windows: () => [{ title: 'SlotForge Timing', pid: 11, visible: true }, { title: 'Live Race', pid: 12, live: true, visible: true }] });
    const C = createCollector(d); await C.collect(); C.mark('Live Race window opened (1460 ms in the core)'); clock.t += 1568; C.sample();
    const m = Perf.cleanMain(await C.collect()), rep = Perf.report(null, m, {});
    ok('a stall, a mark and two windows come through the core, made safe, into the report', m.windows[1].cpu === 25 && m.windows[1].memMB === 600 && m.windows[0].memMB === 300 && /was stuck for 1468 ms at \d\d:\d\d:\d\d/.test(rep) && rep.includes('Live Race window opened (1460 ms in the core)') && rep.includes('Windows (2 open):') && rep.includes('The Live Race window is open')); }
  { const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
    ok('main.js gives the collector the list of windows (title, process, shown, minimized, in front, and which one is the Live Race window)', /windows: \(\) => BrowserWindow\.getAllWindows\(\)\.filter\(w => !w\.isDestroyed\(\)\)\.map\(w => \{ try \{ return \{ title: w\.getTitle\(\), pid: w\.webContents\.getOSProcessId\(\), visible: w\.isVisible\(\), minimized: w\.isMinimized\(\), focused: w\.isFocused\(\), live: w === liveWin \}/.test(main));
    ok('...tells it when the Live Race window opened and how long that took in the core, and when it closed', /const opened = Date\.now\(\);/.test(main) && /perfCollector\.mark\(`Live Race window opened \(\$\{Date\.now\(\) - opened\} ms in the core\)`\)/.test(main) && /perfCollector\.mark\('Live Race window closed'\)/.test(main));
    ok('...the collector is the one that answers "perf:stats" and is the one the window opening tells', /const perf = perfCollector = require\('\.\/perfstats'\)\.createCollector\(/.test(main) && /let perfCollector = null;/.test(main));
    ok('...the time is taken before the window is made and the mark is written after it is there', main.indexOf('const opened = Date.now();') < main.indexOf('liveWin = new BrowserWindow(') && main.indexOf('liveWin = new BrowserWindow(') < main.indexOf('perfCollector.mark(`Live Race window opened')); }

  console.log(fails ? fails + ' PERFSTATS TESTS FAILED' : 'ALL PERFSTATS TESTS PASSED'); process.exit(fails ? 1 : 0);
})();
