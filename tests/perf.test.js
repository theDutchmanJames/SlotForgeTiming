// 1.60.0: the Performance line (renderer/perf.js): the monitor of the window (frames, screen updates, long tasks, writes left out), what the core of the app tells made safe,
// the line, the notes and the report.
const Perf = require('../renderer/perf.js');
let fails = 0;
const ok = (m, c) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const near = (a, b, d) => typeof a === 'number' && Math.abs(a - b) <= d;

// ---- the monitor ----
{ const M = Perf.createMonitor({ now: () => 0 });
  const s0 = M.snapshot(0);
  ok('a monitor that has seen nothing has no figures (and no long tasks)', s0.fps === null && s0.slowest === null && s0.updates === null && s0.updateAvg === null && s0.updateMax === null && s0.updateLoad === null && s0.skipped === null && s0.longCount === 0 && s0.longMax === 0 && s0.seconds === 0);
  for (let i = 0; i <= 180; i++) M.frame(i * 1000 / 60);
  const s1 = M.snapshot(3000);
  ok('3 seconds of frames at 60 a second: 60 frames a second, the slowest frame about 17 ms', near(s1.fps, 60, 1) && near(s1.slowest, 17, 1) && near(s1.seconds, 3, 0.1));
  M.frame(3200); // a frame that came 200 ms late
  const s2 = M.snapshot(3200);
  ok('...one frame that came late is the slowest frame, and the frames a second go down a little', s2.slowest === 183 || s2.slowest === 200 || near(s2.slowest, 190, 12));
  const s3 = M.snapshot(14000);
  ok('...and after ten seconds of nothing it is forgotten (no frames, no slow frame)', s3.slowest === null && s3.fps === 0);
  const F = Perf.createMonitor({ now: () => 0 });
  F.frame(0); F.frame(100);
  ok('less than half a second of looking is not enough for frames a second (null, not a wrong number)', F.snapshot(100).fps === null); }

{ const M = Perf.createMonitor({ now: () => 0 });
  M.frame(0);
  for (let i = 0; i < 20; i++) M.update(i % 2 ? 0.5 : 1.5, i * 100);
  const s = M.snapshot(2000);
  ok('screen updates: ten a second of 1 ms on average, the slowest 1.5 ms, 1% of the time', near(s.updates, 10, 0.5) && near(s.updateAvg, 1, 0.01) && s.updateMax === 1.5 && near(s.updateLoad, 1, 0.1));
  M.update(NaN, 2100); M.update(-3, 2100); M.update('x', 2100); M.update(undefined, 2100);
  ok('...a figure that is not a time is left out', M.snapshot(2200).updateAvg === s.updateAvg || near(M.snapshot(2200).updateAvg, 1, 0.01));
  M.long(80, 100); M.long(250, 500); M.long(NaN, 600);
  const t = M.snapshot(2200);
  ok('long tasks: the number and the longest', t.longCount === 2 && t.longMax === 250);
  ok('...they are forgotten after ten seconds', M.snapshot(11000).longCount === 0 && M.snapshot(11000).longMax === 0);
  const K = Perf.createMonitor({ now: () => 0 });
  K.skipped(0, 0); K.skipped(500, 1000); K.skipped(1000, 2000);
  ok('writes left out: the difference of the total over the time (500 a second)', K.snapshot(2000).skipped === 500);
  const K2 = Perf.createMonitor({ now: () => 0 }); K2.skipped(100, 0);
  ok('...one sample is not enough (null)', K2.snapshot(10).skipped === null);
  K2.skipped(50, 1000);
  ok('...a total that went down (a reload) is never a negative number', K2.snapshot(1000).skipped === 0);
  M.reset();
  const r = M.snapshot(5000);
  ok('reset forgets everything', r.fps === null && r.updateAvg === null && r.longCount === 0 && r.skipped === null && r.seconds === 0); }

{ let t = 1000; const M = Perf.createMonitor({ now: () => t });
  M.frame(); t += 17; M.frame(); t += 17; M.frame(); M.update(2); M.long(60);
  const s = M.snapshot();
  ok('without a time given the monitor uses its own clock', s.slowest === 17 && s.updateAvg === 2 && s.longCount === 1); }

// ---- what the core of the app tells, made safe ----
{ ok('nothing, or something that is not a list of figures, gives nothing', Perf.cleanMain(null) === null && Perf.cleanMain(undefined) === null && Perf.cleanMain('x') === null && Perf.cleanMain(5) === null);
  const m = Perf.cleanMain({});
  ok('an empty answer is an answer with zeros and unknowns (nothing breaks)', m && m.procs.total === 0 && m.gpu.drawsWindow === null && m.gpu.drawsContent === null && m.thermal.tempC === null && m.lag.max10 === null && m.save.writes === 0 && m.display.width === 0 && m.display.scale === 1 && m.os.load.length === 0 && m.switches.length === 0);
  const g = Perf.cleanMain({ metrics: [{ type: 'Browser', cpu: 3.14, memMB: 100 }, { type: 'Tab', cpu: 20.04, memMB: 300 }, { type: 'Tab', cpu: 5, memMB: 100 }, { type: 'GPU', cpu: 7.5, memMB: 200 }, { type: 'Utility', cpu: 1, memMB: 40 }, { type: 'Zygote', cpu: 0.5 }],
    gpuStatus: { gpu_compositing: 'enabled_on', rasterization: 'disabled_software', opengl: 'enabled_on', secret: 'x', webgl: 'enabled_readback' },
    gpuDevice: 'V3D 7.1', display: { width: 1920, height: 1080, scale: 1.5, count: 2 }, session: 'wayland', switches: ['--ozone-platform=x11', '--disable-gpu'],
    os: { platform: 'linux', arch: 'arm64', release: '6.6', model: 'Raspberry Pi 5', cpuModel: 'Cortex-A76', cpus: 4, memoryMB: 8000, freeMB: 4000, load: [1.234, 0.9, 0.5, 9] },
    thermal: { tempC: 61.26, mhz: 2399.6, maxMhz: 2400, governor: 'ondemand' }, versions: { app: '1.60.0', electron: '38', chrome: '140', node: '22' },
    lag: { max10: 12.4, max60: 40, all: 90 }, save: { writes: 5, lastMs: 3.3, maxMs: 9, failed: 1 }, at: 123 });
  ok('the processes are added up by kind: window (Tab), graphics (GPU), core (Browser), other', g.procs.window === 25 && g.procs.graphics === 7.5 && g.procs.core === 3.1 && g.procs.other === 1.5 && near(g.procs.total, 37.2, 0.05) && g.procs.memoryMB === 740);
  ok('the graphics: composited by the card and rasterized by the processor are told apart, and only the known status keys are kept', g.gpu.drawsWindow === true && g.gpu.drawsContent === false && g.gpu.status.opengl === 'enabled_on' && g.gpu.status.secret === undefined && g.gpu.device === 'V3D 7.1');
  ok('screen, session, switches, computer, processor, versions, stalls and saves are carried over (rounded)', g.display.width === 1920 && g.display.scale === 1.5 && g.display.count === 2 && g.session === 'wayland' && g.switches.length === 2 && g.os.cpus === 4 && g.os.model === 'Raspberry Pi 5' && g.os.load.length === 3 && g.os.load[0] === 1.2 && g.thermal.tempC === 61.3 && g.thermal.mhz === 2400 && g.versions.electron === '38' && g.lag.max10 === 12 && g.lag.all === 90 && g.save.failed === 1 && g.at === 123);
  const old = Perf.cleanMain({ gpuStatus: { compositing: 'disabled_off' } });
  ok('an older name for the compositing is understood too', old.gpu.drawsWindow === false);
  const bad = Perf.cleanMain({ metrics: [null, 'x', { type: 'Tab', cpu: NaN }, { type: 'Tab', cpu: -50 }, { type: 'Tab', cpu: 1e9 }], display: { width: -5, height: 'x', scale: 1e9 }, os: { cpus: 1e9, load: ['a', null, 2] }, thermal: { tempC: 1e9, mhz: -1 }, lag: { max10: -4, max60: 'x' }, save: { writes: -1, lastMs: NaN },
    session: 'wayland\u0000\u0007evil', switches: new Array(50).fill('--x'), gpuDevice: 'y'.repeat(1000) });
  ok('nonsense is made safe: negative, huge and missing figures are clamped, text is cleaned and cut, a list is cut', bad.procs.window === 10000 && bad.display.width === 0 && bad.display.height === 0 && bad.display.scale === 20 && bad.os.cpus === 1024 && bad.os.load.join() === '0,0,2' && bad.thermal.tempC === 200 && bad.thermal.mhz === 0 && bad.lag.max10 === 0 && bad.lag.max60 === null && bad.save.writes === 0 && bad.save.lastMs === 0 && !/[\u0000-\u001f]/.test(bad.session) && bad.switches.length === 12 && bad.gpu.device.length === 160); }

// ---- the line ----
const M0 = Perf.cleanMain({ metrics: [{ type: 'Tab', cpu: 14.2 }, { type: 'GPU', cpu: 6.5 }, { type: 'Browser', cpu: 3.1 }], lag: { max10: 14 }, save: { writes: 3, lastMs: 3.4 } });
const R0 = { fps: 58, slowest: 41, updates: 10, updateAvg: 0.62, updateMax: 3, updateLoad: 0.6, longCount: 0, longMax: 0, skipped: 900, seconds: 10 };
{ ok('the line: frames a second, the slowest frame, the time of an update, the CPU of the app in its parts, the stalls, the save', Perf.line(R0, M0) === '58 frames/s · slowest frame 41 ms · screen update 0.6 ms (10/s) · app CPU 24% (window 14, graphics 7, core 3) · core stalled up to 14 ms · race save 3.4 ms');
  ok('...without the figures of the core only the window part is there', Perf.line(R0, null) === '58 frames/s · slowest frame 41 ms · screen update 0.6 ms (10/s)');
  ok('...without the window figures only the core part', Perf.line(null, M0).startsWith('app CPU 24%') && !Perf.line(null, M0).includes('frames'));
  ok('...in the first moments it says it is measuring, and has no race save to tell about', Perf.line({ ...R0, fps: null, slowest: null, updateAvg: null }, Perf.cleanMain({})) === 'measuring... · app CPU 0% (window 0, graphics 0, core 0)');
  ok('...with nothing at all it is empty', Perf.line(null, null) === ''); }

// ---- the notes ----
{ const hot = Perf.cleanMain({ gpuStatus: { gpu_compositing: 'enabled_on', rasterization: 'enabled_on' }, thermal: { tempC: 55, mhz: 2400, maxMhz: 2400 }, lag: { max10: 5 }, save: { maxMs: 10 }, os: { cpus: 4, memoryMB: 8000, freeMB: 4000 }, metrics: [{ type: 'Tab', cpu: 20 }] });
  ok('when all is well there is nothing to note', Perf.notes(R0, hot).length === 0 && Perf.notes(null, null).length === 0);
  const has = (r, m, re) => Perf.notes(r, m).some(x => re.test(x));
  ok('software drawing of the window is noted, with what it usually means on a Raspberry Pi', has(R0, Perf.cleanMain({ gpuStatus: { gpu_compositing: 'disabled_software' } }), /drawn in software.*Raspberry Pi/));
  ok('...the card drawing the window but not what is in it is noted', has(R0, Perf.cleanMain({ gpuStatus: { gpu_compositing: 'enabled_on', rasterization: 'disabled_software' } }), /not what is in it/));
  ok('...a hot processor (80 °C and over)', has(R0, Perf.cleanMain({ thermal: { tempC: 82 } }), /hot \(82 °C\)/) && !has(R0, Perf.cleanMain({ thermal: { tempC: 79.9 } }), /hot/));
  ok('...a processor that runs far below its top speed', has(R0, Perf.cleanMain({ thermal: { tempC: 50, mhz: 1000, maxMhz: 2400 } }), /1000 MHz of 2400 MHz/) && !has(R0, Perf.cleanMain({ thermal: { tempC: 50, mhz: 2000, maxMhz: 2400 } }), /MHz/));
  ok('...the core of the app stuck for 100 ms or more', has(R0, Perf.cleanMain({ lag: { max10: 100 } }), /stuck for 100 ms/) && !has(R0, Perf.cleanMain({ lag: { max10: 99 } }), /stuck/));
  ok('...a slow race save, and a save that failed', has(R0, Perf.cleanMain({ save: { maxMs: 150 } }), /up to 150 ms/) && has(R0, Perf.cleanMain({ save: { failed: 2 } }), /2 race save/));
  ok('...a computer nearly out of memory, and an app that uses nearly all of the processor', has(R0, Perf.cleanMain({ os: { memoryMB: 8000, freeMB: 700 } }), /out of memory/) && has(R0, Perf.cleanMain({ os: { cpus: 4 }, metrics: [{ type: 'Tab', cpu: 290 }] }), /nearly all of the processor/));
  ok('...a window that draws less than 25 frames a second, a race screen that spends over 10% of the time on updates, a window that was stuck', has({ ...R0, fps: 24 }, null, /24 frames a second/) && !has({ ...R0, fps: 25 }, null, /frames a second/) && has({ ...R0, updateLoad: 12 }, null, /12% of the time/) && has({ ...R0, longCount: 2, longMax: 300 }, null, /2 time\(s\).*300 ms/)); }

// ---- the report ----
{ const m = Perf.cleanMain({ metrics: [{ type: 'Tab', cpu: 14.2, memMB: 300 }, { type: 'GPU', cpu: 6.5, memMB: 100 }, { type: 'Browser', cpu: 3.1, memMB: 100 }], gpuStatus: { gpu_compositing: 'disabled_software', rasterization: 'disabled_software' }, gpuDevice: 'V3D 7.1', display: { width: 1920, height: 1080, scale: 1, count: 1 }, session: 'wayland', switches: ['--disable-gpu'],
    os: { platform: 'linux', arch: 'arm64', release: '6.6', model: 'Raspberry Pi 5 Model B', cpuModel: 'Cortex-A76', cpus: 4, memoryMB: 8192, freeMB: 5120, load: [1.2, 0.9, 0.6] }, thermal: { tempC: 62.5, mhz: 2400, maxMhz: 2400, governor: 'ondemand' }, versions: { app: '1.60.0', electron: '38.0.0', chrome: '140.0', node: '22.0' }, lag: { max10: 14, max60: 40, all: 120 }, save: { writes: 12, lastMs: 3.4, maxMs: 18.2, failed: 0 } });
  const rep = Perf.report(R0, m, { when: '20 Oct 2026, 14:30', screen: { w: 1920, h: 1080, dpr: 1 }, race: { name: 'Club race', widgets: 41, lanes: 4 } });
  const L = rep.split('\n');
  ok('the report starts with the app, its version and the moment', L[0] === 'SlotForge Timing 1.60.0: performance report (20 Oct 2026, 14:30)');
  ok('...tells the computer (a Raspberry Pi says which one), its memory, the load, the processor (heat and speed) and the screen', rep.includes('Computer: Raspberry Pi 5 Model B, 4 x Cortex-A76, 8 GB memory (5 GB free) [linux 6.6]') && rep.includes('Load average: 1.2 / 0.9 / 0.6') && rep.includes('Processor: 62.5 °C, 2400 MHz of 2400 MHz, ondemand') && rep.includes('Screen: 1920 x 1080, wayland session'));
  ok('...the graphics in words (software in capitals), their status, and what the app was started with', rep.includes('Graphics: window drawn by SOFTWARE (the processor), contents drawn by the processor [V3D 7.1]') && rep.includes('Graphics status: gpu_compositing=disabled_software, rasterization=disabled_software') && rep.includes('Started with: --disable-gpu'));
  ok('...the window, the race screen, the frames, the screen updates, the long tasks and the writes left out', rep.includes('Window: 1920 x 1080') && rep.includes('Race screen: Club race, 41 widgets, 4 lanes') && rep.includes('Frames: 58 a second, slowest frame 41 ms') && rep.includes('Screen updates: 10 a second, 0.6 ms each, slowest 3 ms, 0.6% of the time') && rep.includes('Window stuck (long tasks over 50 ms): 0 time(s), longest 0 ms') && rep.includes('Writes to the page left out because the value was the same: 900 a second'));
  ok('...the CPU of the app in its parts, the stalls of the core and the race save', rep.includes('CPU of the app (% of one core): total 24, window 14, graphics 7, core 3, other 0; memory 500 MB') && rep.includes('Core of the app stalled: up to 14 ms (10 s), 40 ms (60 s), 120 ms (since measuring began)') && rep.includes('Race save: 12 written, last 3.4 ms, slowest 18.2 ms, 0 failed'));
  ok('...and the notes at the end', rep.includes('\nNotes:\n- The window is drawn in software'));
  const none = Perf.report(null, null, {});
  ok('a report without any figures still says what it is, that the core did not answer, and that no race screen is open', none.includes('performance report') && none.includes('The core of the app did not answer') && none.includes('Race screen: not open') && !none.includes('Notes:'));
  const idle = Perf.report({ ...R0, updateAvg: null, updateMax: null, updateLoad: null, updates: null, skipped: null }, m, { race: null });
  ok('with no race running the screen updates say so, and the writes left out are a dash', idle.includes('Screen updates: none (no race running)') && idle.includes('left out because the value was the same: –'));
  ok('the version comes from the core of the app when the window does not give it', Perf.report(R0, m, {}).startsWith('SlotForge Timing 1.60.0: performance report')); }


// ---- the edges (found by breaking the figures on purpose) ----
{ const clean = Perf.cleanMain, has = (r, m, re) => Perf.notes(r, m).some(x => re.test(x));
  const R = { fps: 58, slowest: 41, updates: 10, updateAvg: 0.62, updateMax: 3, updateLoad: 0.6, longCount: 0, longMax: 0, skipped: 900, seconds: 10 };
  ok('notes: graphics that the core did not tell about are not "software" (nothing is noted)', Perf.notes(R, clean({})).length === 0 && !has(R, clean({ gpuStatus: { gpu_compositing: 'enabled_on' } }), /not what is in it/) && !has(R, clean({ gpuStatus: { rasterization: 'enabled_on' } }), /software/));
  ok('notes: exactly 80 °C is hot; exactly 70% of the top speed is not slow, one MHz less is', has(R, clean({ thermal: { tempC: 80 } }), /hot \(80 °C\)/) && !has(R, clean({ thermal: { tempC: 50, mhz: 1680, maxMhz: 2400 } }), /MHz/) && has(R, clean({ thermal: { tempC: 50, mhz: 1679, maxMhz: 2400 } }), /MHz/));
  ok('notes: a save of 149 ms is fine, 150 ms is slow; one failed save is noted', !has(R, clean({ save: { maxMs: 149 } }), /Saving/) && has(R, clean({ save: { maxMs: 150 } }), /Saving the race took up to 150/) && has(R, clean({ save: { failed: 1 } }), /1 race save\(s\) could not/));
  ok('notes: exactly 10% of the memory free is not "nearly out"; 799 of 8000 MB is; 15% is not', !has(R, clean({ os: { memoryMB: 8000, freeMB: 800 } }), /memory/) && has(R, clean({ os: { memoryMB: 8000, freeMB: 799 } }), /out of memory/) && !has(R, clean({ os: { memoryMB: 8000, freeMB: 1200 } }), /memory/));
  ok('notes: 280% of 4 processors is not "nearly all", 281% is; 240% is not', !has(R, clean({ os: { cpus: 4 }, metrics: [{ type: 'Tab', cpu: 280 }] }), /processor/) && has(R, clean({ os: { cpus: 4 }, metrics: [{ type: 'Tab', cpu: 281 }] }), /nearly all of the processor/) && !has(R, clean({ os: { cpus: 4 }, metrics: [{ type: 'Tab', cpu: 240 }] }), /processor/));
  ok('notes: updates at exactly 10% of the time are fine, 10.1% is noted, 7% is fine; one time stuck is noted', !has({ ...R, updateLoad: 10 }, null, /of the time/) && has({ ...R, updateLoad: 10.1 }, null, /10% of the time/) && !has({ ...R, updateLoad: 7 }, null, /of the time/) && has({ ...R, longCount: 1, longMax: 90 }, null, /stuck 1 time\(s\).*90 ms/));
  ok('at most 64 processes are added up', clean({ metrics: new Array(100).fill({ type: 'Tab', cpu: 1 }) }).procs.window === 64); }

{ const A = Perf.createMonitor({ now: () => 0 });
  A.frame(1000);
  ok('monitor: a first frame has nothing before it, so there is no slowest frame yet', A.snapshot(1000).slowest === null);
  const W = Perf.createMonitor({ now: () => 0 });
  for (let t = 0; t <= 8000; t += 100) W.frame(t);
  for (let t = 8000 + 1000 / 60; t <= 10000; t += 1000 / 60) W.frame(t);
  ok('...the frames a second are those of the last two seconds (60 here), not of the last ten (20)', near(W.snapshot(10000).fps, 60, 2));
  const K = Perf.createMonitor({ now: () => 0 }); K.skipped(0, 0); K.skipped(1000, 2000); K.skipped('x', 2500); K.skipped(NaN, 2600);
  ok('...a total of writes that is not a number is left out', K.snapshot(2600).skipped === 500);
  const D = Perf.createMonitor({ now: () => 0 }); D.skipped(100, 1000); D.skipped(900, 1000);
  ok('...two totals at the same moment give no rate (not infinity)', D.snapshot(1000).skipped === null);
  const L = Perf.createMonitor({ now: () => 0 }); L.frame(0);
  for (let i = 0; i < 300; i++) L.update(1 / 3, i * 100);
  const s = L.snapshot(30000);
  ok('...after half a minute of ten updates a second it still says ten (the rate of the last ten seconds)', near(s.updates, 10, 0.5) && near(s.updateLoad, 0.3, 0.11));
  ok('...and the average time of an update is rounded to hundredths (0.33 ms)', s.updateAvg === 0.33 && s.updateMax === 0.33); }

console.log(fails ? `\n${fails} FAILED` : '\nperf PASSED');
process.exit(fails ? 1 : 0);
