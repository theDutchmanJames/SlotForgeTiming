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

// ---- 1.60.3: the look of the page in the report (the depth and the layers of the widgets), and the slow frames of a hidden window
{ const m = Perf.cleanMain({ metrics: [{ type: 'Tab', cpu: 14.2, memMB: 300 }] });
  const lines = x => Perf.report(R0, m, x).split('\n'), at = (L, re) => L.findIndex(l => re.test(l));
  const soft = lines({ race: { name: 'Club race', widgets: 41, lanes: 4 }, look: { depth: 'Soft lift (35)', layers: true } });
  ok('the report has a Look line: the depth, and whether the changing text of the widgets is on layers of their own', soft.includes('Look: depth Soft lift (35), widgets on their own layers: on'));
  ok('...it comes right before the race screen line (the two are read together)', at(soft, /^Look:/) >= 0 && at(soft, /^Look:/) + 1 === at(soft, /^Race screen:/));
  ok('...and with the tickbox off it says off, with Flat it says Flat', lines({ look: { depth: 'Flat', layers: false } }).includes('Look: depth Flat, widgets on their own layers: off'));
  ok('...a window that does not know its look (an older page, an error) gives no Look line at all', !lines({}).some(l => /^Look:/.test(l)) && !lines({ look: null }).some(l => /^Look:/.test(l)));
  ok('...a depth without a name is "unknown", and a long or odd one is cut (it is text of the page)', lines({ look: { depth: '', layers: true } }).includes('Look: depth unknown, widgets on their own layers: on') && lines({ look: { depth: 'x'.repeat(500), layers: true } }).find(l => /^Look:/.test(l)).length < 120);
  ok('...a report without figures (the core did not answer) still has it', Perf.report(null, null, { look: { depth: 'Soft lift (35)', layers: true } }).includes('Look: depth Soft lift (35)')); }
// ---- 1.60.6: the report says whether the big pictures of the widgets go to the page as short links
{ const m = Perf.cleanMain({ metrics: [{ type: 'Tab', cpu: 14.2, memMB: 300 }] });
  const lines = x => Perf.report(R0, m, x).split('\n'), at = (L, re) => L.findIndex(l => re.test(l));
  const on = lines({ race: { name: 'Club race', widgets: 41, lanes: 4 }, look: { depth: 'Soft lift (35)', layers: true }, links: { on: true, count: 10, bytes: 4087519 } });
  ok('the report says that the big pictures go to the page as short links, how many are kept and how much they hold', on.includes('Big pictures in the widgets as short links (1.60.6): on, 10 kept, 4.1 MB'));
  ok('...it comes between the Look line and the race screen line', at(on, /^Big pictures/) === at(on, /^Look:/) + 1 && at(on, /^Race screen:/) === at(on, /^Big pictures/) + 1);
  ok('...switched off it says off and nothing more', lines({ links: { on: false, count: 0, bytes: 0 } }).includes('Big pictures in the widgets as short links (1.60.6): off'));
  ok('...a window that does not know (an older page, an error) gives no such line', !lines({}).some(l => /^Big pictures/.test(l)) && !lines({ links: null }).some(l => /^Big pictures/.test(l)) && !lines({ links: 'on' }).some(l => /^Big pictures/.test(l)));
  ok('...odd figures do not break the line', lines({ links: { on: true, count: 'x', bytes: 'y' } }).includes('Big pictures in the widgets as short links (1.60.6): on, – kept, 0 MB'));
  ok('...a report without figures (the core did not answer) still has it', Perf.report(null, null, { links: { on: true, count: 2, bytes: 2e6 } }).includes('short links (1.60.6): on, 2 kept, 2 MB'));
  // 1.60.8: and the pictures that were made ready before they were needed
  const rd = r => lines({ links: { on: true, count: 10, bytes: 4087519, ready: r } }).find(l => /^Big pictures/.test(l));
  ok('the pictures made ready ahead of time (the start lights, when the race screen was built) are counted in the same line, with the time it took', rd({ made: 10, left: 0, waiting: 0, ms: 62.34 }) === 'Big pictures in the widgets as short links (1.60.6): on, 10 kept, 4.1 MB; made ready ahead of time: 10 (62.3 ms)', rd({ made: 10, left: 0, waiting: 0, ms: 62.34 }));
  ok('...pictures that had no room, and pictures that still wait, are said too', rd({ made: 3, left: 2, waiting: 5, ms: 9 }) === 'Big pictures in the widgets as short links (1.60.6): on, 10 kept, 4.1 MB; made ready ahead of time: 3 (9 ms), 2 without room, 5 still waiting', rd({ made: 3, left: 2, waiting: 5, ms: 9 }));
  ok('...nothing made ready (a race with no lights set), a window that does not know, odd figures: no such part', rd({ made: 0, left: 0, waiting: 0, ms: 0 }) === 'Big pictures in the widgets as short links (1.60.6): on, 10 kept, 4.1 MB' && rd(undefined) === rd(null) && rd(5) === rd({}) && !String(rd({ made: 'x', left: 'y', waiting: null, ms: 'z' })).includes('ready'));
  ok('...nothing made yet but pictures that had no room, or that still wait: said too (the figure for "made" is 0, not left out)', rd({ made: 0, left: 2, waiting: 0, ms: 0 }) === 'Big pictures in the widgets as short links (1.60.6): on, 10 kept, 4.1 MB; made ready ahead of time: 0 (0 ms), 2 without room' && rd({ made: 0, left: 0, waiting: 4, ms: 0 }) === 'Big pictures in the widgets as short links (1.60.6): on, 10 kept, 4.1 MB; made ready ahead of time: 0 (0 ms), 4 still waiting', rd({ made: 0, left: 0, waiting: 4, ms: 0 }));
  ok('...a time that is not a number counts as 0 ms (never "NaN" or "undefined" in the text)', rd({ made: 2, left: 0, waiting: 0, ms: 'z' }) === 'Big pictures in the widgets as short links (1.60.6): on, 10 kept, 4.1 MB; made ready ahead of time: 2 (0 ms)' && rd({ made: 2, left: 0, waiting: 0 }) === 'Big pictures in the widgets as short links (1.60.6): on, 10 kept, 4.1 MB; made ready ahead of time: 2 (0 ms)', rd({ made: 2, left: 0, waiting: 0, ms: 'z' }));
  ok('...switched off, nothing about it', lines({ links: { on: false, count: 0, bytes: 0, ready: { made: 4, left: 0, waiting: 0, ms: 3 } } }).find(l => /^Big pictures/.test(l)) === 'Big pictures in the widgets as short links (1.60.6): off'); }
{ const M = Perf.createMonitor({ now: () => 0, wall: () => 5000 }); M.newRace(1000, 7000);
  M.loaf({ dur: 150, script: 1, render: 1, forced: 0 }, 1700); M.loaf({ dur: 5000, script: 0, render: 0, forced: 0 }, 1800); M.loaf({ dur: 2001, script: 0, render: 0, forced: 0 }, 1850); M.loaf({ dur: 2000, script: 0, render: 0, forced: 0 }, 1900);
  const s = M.snapshot(2000);
  ok('a slow frame over two seconds (the window was hidden or the computer slept) is not counted: not in the slow frames, and not the longest of the race', s.loaf && s.loaf.count === 2 && s.loaf.max === 2000 && s.race.loaf === 2000);
  ok('...the same as with the frames: 2000 ms is still a slow frame, 2001 is not', s.loaf.count === 2); }
{ const M = Perf.createMonitor({ now: () => 0, wall: () => 5000 }); M.loaf({ dur: 90000, script: 0, render: 0, forced: 0 }, 100);
  ok('...and a monitor that only saw such a frame has seen no slow frame at all', M.snapshot(200).loaf === null); }


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

// =========================================================== 1.60.1: where the time goes, the worst of the race, the rows, the marks ===========================================================
const fillUpdates = (M, n, f) => { for (let i = 0; i < n; i++) f(i * 100); }; // (n updates, one every 100 ms)

// ---- the parts of an update and the widgets ----
{ const M = Perf.createMonitor({ now: () => 0 });
  M.frame(0);
  fillUpdates(M, 20, t => { M.update(50, t); M.part('state', 10, t); M.part('widgets', 30, t); M.part('panels', 5, t); M.widget('leaderboard', 2, 6, 20, t); M.widget('clock', 1, 1, 0, t); });
  const s = M.snapshot(2000);
  ok('the parts of an update: the average per update, the biggest first (widgets 30, state 10, panels 5)', s.parts.map(x => x.name).join() === 'widgets,state,panels' && s.parts[0].avg === 30 && s.parts[1].avg === 10 && s.parts[2].avg === 5);
  ok('the widgets: text, page and fit apart, the total per update, the slowest first (leaderboard 28 = 2 + 6 + 20)', s.widgets.length === 2 && s.widgets[0].type === 'leaderboard' && s.widgets[0].avg === 28 && s.widgets[0].draw === 2 && s.widgets[0].write === 6 && s.widgets[0].fit === 20 && s.widgets[1].type === 'clock' && s.widgets[1].avg === 2);
  ok('...and how many of that type were drawn in an update (one each)', s.widgets[0].count === 1 && s.widgets[1].count === 1);
  const T = Perf.createMonitor({ now: () => 0 }); T.frame(0);
  fillUpdates(T, 10, t => { T.update(10, t); T.widget('leaderboard', 1, 1, 1, t); T.widget('leaderboard', 1, 1, 1, t); T.widget('leaderboard', 1, 1, 1, t); });
  const st = T.snapshot(1000);
  ok('three widgets of one type in an update are one line: x3, the times added (9 ms)', st.widgets.length === 1 && st.widgets[0].count === 3 && st.widgets[0].avg === 9 && st.widgets[0].draw === 3); }

{ const M = Perf.createMonitor({ now: () => 0 }); M.frame(0);
  M.part('state', 10, 100); M.widget('clock', 1, 1, 1, 100);
  const s = M.snapshot(1000);
  ok('parts and widgets without a single update (no race running) give empty lists, not NaN', Array.isArray(s.parts) && s.parts.length === 0 && Array.isArray(s.widgets) && s.widgets.length === 0); }

{ const M = Perf.createMonitor({ now: () => 0 }); M.frame(0);
  M.update(5, 100); M.part('ok', 4, 100);
  M.part('neg', -1, 100); M.part('nan', NaN, 100); M.part('str', '3', 100); M.part(5, 3, 100); M.part(undefined, 3, 100); M.part('inf', Infinity, 100);
  M.widget('neg', -1, 1, 1, 100); M.widget('str', '1', 1, 1, 100); M.widget('nan', 1, NaN, 1, 100); M.widget(7, 1, 1, 1, 100); M.widget('inf', 1, 1, Infinity, 100);
  const s = M.snapshot(500);
  ok('a time that is not a number, below zero or infinite, and a name that is not text, are left out (only the good part is there)', s.parts.length === 1 && s.parts[0].name === 'ok' && s.widgets.length === 0);
  const P = Perf.createMonitor({ now: () => 0 }); P.frame(0); P.update(5, 100); P.part('__proto__', 3, 100); P.part('constructor', 2, 100); P.widget('__proto__', 1, 1, 1, 100); P.widget('toString', 1, 1, 1, 100);
  const sp = P.snapshot(500);
  ok('a name like __proto__ or constructor is only a name (nothing breaks, nothing leaks)', sp.parts.length === 2 && sp.widgets.length === 2 && ({}).polluted === undefined && sp.parts.find(x => x.name === '__proto__').avg === 3); }

{ const M = Perf.createMonitor({ now: () => 0 }); M.frame(0);
  for (let i = 0; i < 15; i++) M.part('p' + i, i + 1, 100);
  for (let i = 0; i < 12; i++) M.widget('w' + i, i + 1, 0, 0, 100);
  M.update(1, 100);
  const s = M.snapshot(500);
  ok('at most 12 parts and 8 widgets are given, the biggest ones (p14 first, w11 first)', s.parts.length === 12 && s.parts[0].name === 'p14' && s.widgets.length === 8 && s.widgets[0].type === 'w11' && s.parts[11].name === 'p3' && s.widgets[7].type === 'w4'); }

{ const M = Perf.createMonitor({ now: () => 0 }); M.frame(0);
  for (let i = 0; i < 100; i++) { M.update(10, i * 100); M.part('old', 100, i * 100); }
  for (let i = 100; i < 200; i++) { M.update(10, i * 100); M.part('new', 20, i * 100); }
  const s = M.snapshot(20000);
  ok('only the last ten seconds count: what was spent ten to twenty seconds ago is forgotten (the old part is gone, the new one is 20 ms per update)', s.parts.length === 1 && s.parts[0].name === 'new' && s.parts[0].avg === 20); }

{ const M = Perf.createMonitor({ now: () => 0 }); M.frame(0);
  M.update(10, 0); M.part('a', 4, 0); M.widget('x', 1, 2, 3, 0); M.reset();
  M.frame(10); M.update(10, 100); const s = M.snapshot(1500);
  ok('reset (somebody looks again) starts the parts and the widgets from nothing', s.parts.length === 0 && s.widgets.length === 0); }

// ---- the browser's own account of slow frames ----
{ const f = Perf.loafFrom({ duration: 120, startTime: 1000, renderStart: 1070, scripts: [{ duration: 40, forcedStyleAndLayoutDuration: 8, sourceFunctionName: 'update', sourceURL: 'file:///app/renderer/race.js?x=1', invoker: 'TimerHandler:setInterval' }, { duration: 20, forcedStyleAndLayoutDuration: 2, invoker: 'FrameRequestCallback' }] });
  ok('a slow frame: the length, the scripts together (60), the drawing of the page after the scripts (1120 - 1070 = 50), the layout the scripts forced (10)', f.dur === 120 && f.script === 60 && f.render === 50 && f.forced === 10);
  ok('...the biggest script is named by its function and file, without the folder and the query', f.top.name === 'update race.js' && f.top.ms === 40);
  const g = Perf.loafFrom({ duration: 80, startTime: 0, renderStart: 0, scripts: [{ duration: 10, invoker: 'FrameRequestCallback' }] });
  ok('...a frame with no render time known gives 0 for it, and a script without a function name is named by who called it', g.render === 0 && g.top.name === 'FrameRequestCallback');
  const h = Perf.loafFrom({ duration: 50, startTime: 0, renderStart: 10, scripts: [{ duration: 500, forcedStyleAndLayoutDuration: 900 }] });
  ok('...scripts cannot be longer than the frame (50), the forced layout cannot be more than the scripts', h.script === 50 && h.forced === 50 && h.top.name === 'script');
  ok('...a frame with no scripts has no biggest script', Perf.loafFrom({ duration: 70, startTime: 0, renderStart: 20 }).top === null);
  ok('...rubbish gives null (nothing, no duration, a negative one, not a number)', Perf.loafFrom(null) === null && Perf.loafFrom({}) === null && Perf.loafFrom({ duration: -5 }) === null && Perf.loafFrom({ duration: 'x' }) === null && Perf.loafFrom('a') === null);
  const k = Perf.loafFrom({ duration: 60, startTime: 0, renderStart: 30, scripts: [null, 'x', { duration: -3 }, { duration: 'y' }, { duration: 10, forcedStyleAndLayoutDuration: -4 }, { duration: NaN }] });
  ok('...scripts that are rubbish are skipped (only the one of 10 ms counts, a negative forced time is nothing)', k.script === 10 && k.forced === 0);
  const many = Array.from({ length: 100 }, () => ({ duration: 1 }));
  ok('...at most 60 scripts are looked at', Perf.loafFrom({ duration: 500, startTime: 0, renderStart: 400, scripts: many }).script === 60);
  const long = 'x'.repeat(200);
  ok('...a long name is cut', Perf.loafFrom({ duration: 50, startTime: 0, renderStart: 10, scripts: [{ duration: 5, sourceFunctionName: long, sourceURL: '/a/' + long }] }).top.name.length <= 71); }

{ const M = Perf.createMonitor({ now: () => 0 });
  M.frame(0);
  ok('a monitor that has seen no slow frame says null (no figures at all)', M.snapshot(100).loaf === null);
  M.loaf({ dur: 100, script: 60, render: 30, forced: 10, top: { name: 'a race.js', ms: 40 } }, 100);
  M.loaf({ dur: 200, script: 100, render: 90, forced: 20, top: { name: 'a race.js', ms: 60 } }, 200);
  M.loaf({ dur: 60, script: 20, render: 30, forced: 0, top: { name: 'b canvas.js', ms: 10 } }, 300);
  const l = M.snapshot(1000).loaf;
  ok('slow frames: the number (3), the average (120), the longest (200), the average script (60), drawing (50) and forced layout (10)', l.count === 3 && l.avg === 120 && l.max === 200 && l.script === 60 && l.render === 50 && near(l.forced, 10, 1e-9));
  ok('...the slowest scripts, as an average over the slow frames: a race.js (40 + 60) / 3, then b canvas.js (10 / 3)', l.top.length === 2 && l.top[0].name === 'a race.js' && near(l.top[0].ms, 100 / 3, 1e-9) && l.top[1].name === 'b canvas.js' && near(l.top[1].ms, 10 / 3, 1e-9));
  M.loaf(null, 400); M.loaf({ dur: 'x' }, 400); M.loaf({}, 400);
  ok('...rubbish is not counted', M.snapshot(1000).loaf.count === 3);
  ok('...and after ten seconds they are forgotten', M.snapshot(11000).loaf === null);
  const N = Perf.createMonitor({ now: () => 0 }); for (let i = 0; i < 6; i++) N.loaf({ dur: 100, script: 1, render: 1, forced: 0, top: { name: 's' + i, ms: i + 1 } }, 100);
  ok('...at most three scripts are named', N.snapshot(200).loaf.top.length === 3 && N.snapshot(200).loaf.top[0].name === 's5');
  N.loaf({ dur: 100, script: 1, render: 1, forced: 0 }, 150);
  ok('...a slow frame without a script to name is counted but names nothing', N.snapshot(200).loaf.count === 7); }

// ---- the worst figures of the race ----
{ const M = Perf.createMonitor({ now: () => 0, wall: () => 5000 });
  ok('before a race has started there are no worst figures (and no rows)', M.snapshot(0).race === null && M.snapshot(0).history.length === 0 && M.due(0) === false);
  M.newRace(1000, 7000);
  M.frame(1000); M.frame(1017); M.frame(1217); M.update(30, 1300); M.update(90, 1400); M.update(40, 1500); M.long(120, 1500); M.long(70, 1600); M.loaf({ dur: 150, script: 1, render: 1, forced: 0 }, 1700); M.loaf({ dur: 90, script: 1, render: 1, forced: 0 }, 1800);
  const s = M.snapshot(2000);
  ok('after a race has started: the slowest frame (200), the longest update (90), the longest stuck (120), the longest slow frame (150)', s.race && s.race.frame === 200 && s.race.update === 90 && s.race.long === 120 && s.race.loaf === 150);
  ok('...when it started (the clock time given) and how long ago in seconds', s.race.wall === 7000 && s.race.seconds === 1);
  M.frame(5000); // a gap of 3.7 seconds: the window was hidden, not a slow frame
  ok('...a gap of more than two seconds between frames is a hidden window: it is not the slowest frame of the race', M.snapshot(5001).race.frame === 200);
  M.frame(6900); M.frame(7000);
  ok('...a gap of just under two seconds is (1900)', M.snapshot(7001).race.frame === 1900 || M.snapshot(7001).race.frame === 1900.0);
  M.update(NaN, 7000); M.update(-5, 7000); M.long('x', 7000); M.long(-1, 7000); M.loaf({ dur: NaN }, 7000);
  const w = M.snapshot(7100).race;
  ok('...rubbish does not change the worst figures', w.update === 90 && w.long === 120 && w.loaf === 150); }

{ const M = Perf.createMonitor({ now: () => 0 });
  M.newRace(0, 1000); M.frame(0);
  for (let t = 0; t < 4000; t += 100) { M.frame(t); }
  ok('the frames a second: the least seen in the race is kept (60 at first)', M.snapshot(4000).race.minFps >= 9);
  const a = M.snapshot(4000).race.minFps;
  for (let t = 4000; t < 7000; t += 500) M.frame(t);
  const b = M.snapshot(7000).race.minFps;
  ok('...it goes down when the screen gets slower (about 2 a second now)', b < a && b <= 3);
  for (let t = 7000; t < 13000; t += 16.7) M.frame(t);
  ok('...and does not go up again when it gets fast again', M.snapshot(13000).race.minFps === b);
  const L = Perf.createMonitor({ now: () => 0 }); L.newRace(0, 1); L.frame(0);
  for (let i = 0; i < 20; i++) L.update(90, i * 100);
  const l1 = L.snapshot(2000);
  ok('the busiest the updates were (9 times a second... 90 ms each = 90%) is kept', l1.race.load >= 89);
  for (let i = 20; i < 200; i++) L.update(1, i * 100);
  ok('...and stays when they are quick again', L.snapshot(20000).race.load >= 89 && L.snapshot(20000).updateLoad < 5); }

{ const M = Perf.createMonitor({ now: () => 0 });
  M.newRace(0, 1000); M.update(77, 100); M.frame(0); M.frame(1900); M.mark('a', 5);
  M.reset();
  const s = M.snapshot(200);
  ok('reset (the race screen was away and is looked at again) keeps the worst figures and the marks, and forgets the figures of the last ten seconds', s.race.update === 77 && s.race.frame === 1900 && s.marks.length === 1 && s.updateAvg === null && s.fps === null);
  M.newRace(300, 2000);
  const n = M.snapshot(400);
  ok('a new race starts the worst figures from nothing, with the time it started', n.race.update === 0 && n.race.frame === 0 && n.race.long === 0 && n.race.load === 0 && n.race.loaf === 0 && n.race.minFps === null && n.race.wall === 2000);
  ok('...and the marks stay (they tell what happened, race or not)', n.marks.length === 1); }

// ---- a row every 30 seconds ----
{ const M = Perf.createMonitor({ now: () => 0 });
  const r = { fps: 55, updateAvg: 73.5, updateMax: 90, updateLoad: 70 }, m = { procs: { memoryMB: 1234.6, window: 21.4 } };
  ok('without a race there is no row (and none is due)', M.sample(r, m, { heapMB: 100, dom: 2000 }, 1000) === false && M.snapshot(1000).history.length === 0 && M.due(1000) === false);
  M.newRace(1000, 1);
  ok('in a race a row is due at once', M.due(1000) === true);
  ok('...the first row is taken', M.sample(r, m, { heapMB: 100.4, dom: 2000.2 }, 1000) === true);
  const h = M.snapshot(1000).history[0];
  ok('...with the seconds since the race started (0), the frames, the update, the load, the app memory (rounded), the window CPU (rounded), the memory of the page and the elements', h.at === 0 && h.fps === 55 && h.update === 73.5 && h.updateMax === 90 && h.load === 70 && h.memMB === 1235 && h.winCpu === 21 && h.heapMB === 100 && h.dom === 2000);
  ok('...the next one is not due before 30 seconds are over (29.9 s: no)', M.due(30900) === false && M.sample(r, m, {}, 30900) === false);
  ok('...at 30 seconds it is due, and its time is 30 seconds', M.due(31000) === true && M.sample({ ...r, fps: 40 }, m, {}, 31000) === true && M.snapshot(31000).history[1].at === 30 && M.snapshot(31000).history[1].fps === 40);
  ok('...and not again straight after', M.sample(r, m, {}, 31010) === false);
  const q = M.snapshot(31000).history[1];
  ok('...without figures of the page or the core the row says null (and no crash)', q.heapMB === null && q.dom === null);
  M.sample(r, null, undefined, 61000);
  const z = M.snapshot(61000).history[2];
  ok('...without the answer of the core (an older app, a phone) the memory and CPU are null', z.memMB === null && z.winCpu === null && z.at === 60);
  M.sample(r, m, { heapMB: 'x', dom: NaN }, 91000);
  ok('...a figure that is not a number is null', M.snapshot(91000).history[3].heapMB === null && M.snapshot(91000).history[3].dom === null);
  M.reset();
  ok('...reset keeps the rows (a race screen that comes back is still the same race)', M.snapshot(100000).history.length === 4);
  M.newRace(100000, 9);
  ok('...a new race starts the rows again, and the first is due at once', M.snapshot(100000).history.length === 0 && M.due(100000) === true);
  ok('...a missing snapshot gives no row', M.sample(null, m, {}, 100000) === false && M.snapshot(100000).history.length === 0); }

{ const M = Perf.createMonitor({ now: () => 0 }); M.newRace(0, 1);
  for (let i = 0; i < 300; i++) M.sample({ fps: 1, updateAvg: i, updateMax: i, updateLoad: i }, null, {}, i * 30000);
  const hh = M.snapshot(1e9).history;
  ok('at most 240 rows are kept (two hours): the oldest go', hh.length === Perf.HIST_MAX && hh.length === 240 && hh[0].update === 60 && hh[239].update === 299);
  hh[0].update = -1;
  ok('...the snapshot gives copies (changing one does not change the monitor)', M.snapshot(1e9).history[0].update === 60); }

// ---- the marks ----
{ const M = Perf.createMonitor({ now: () => 0, wall: () => 4242 });
  M.mark('Race started'); M.mark('  Live Race tab pressed \u0001 ', 5000); M.mark(''); M.mark('   '); M.mark(null); M.mark(5); M.mark(undefined);
  const ms = M.snapshot(0).marks;
  ok('marks: the text and the clock time (the clock of the monitor when none is given), rubbish and empty ones are left out, control characters and spaces cleaned', ms.length === 2 && ms[0].text === 'Race started' && ms[0].at === 4242 && ms[1].text === 'Live Race tab pressed' && ms[1].at === 5000);
  M.mark('x'.repeat(200));
  ok('...a long text is cut at 80', M.snapshot(0).marks[2].text.length === 80);
  const M2 = Perf.createMonitor({ now: () => 0 }); for (let i = 0; i < 50; i++) M2.mark('m' + i, i);
  const m2 = M2.snapshot(0).marks;
  ok('...at most 40 are kept, the newest', m2.length === 40 && m2[0].text === 'm10' && m2[39].text === 'm49');
  m2[0].text = 'changed';
  ok('...the snapshot gives copies', M2.snapshot(0).marks[0].text === 'm10'); }

// ---- what the core tells: windows, stalls, marks ----
{ const raw = { at: 5, metrics: [{ type: 'Browser', pid: 1, cpu: 2, memMB: 100 }, { type: 'Tab', pid: 11, cpu: 20.04, memMB: 900.4 }, { type: 'Tab', pid: 12, cpu: 25, memMB: 700 }, { type: 'GPU', pid: 3, cpu: 3, memMB: 300 }],
    windows: [{ title: 'SlotForge Timing', pid: 11, visible: true, minimized: false, focused: false, live: false }, { title: 'Live Race', pid: 12, visible: false, minimized: true, focused: true, live: true }],
    stalls: [{ at: 100, ms: 1468.4 }], marks: [{ at: 90, text: 'Live Race window opened (1460 ms in the core)' }] };
  const m = Perf.cleanMain(raw);
  ok('each window gets the CPU and the memory of its own process (by the number of the process)', m.windows.length === 2 && m.windows[0].cpu === 20 && m.windows[0].memMB === 900 && m.windows[1].cpu === 25 && m.windows[1].memMB === 700);
  ok('...its title, whether it is the Live Race window, shown, minimized and in front', m.windows[0].title === 'SlotForge Timing' && m.windows[0].live === false && m.windows[0].visible === true && m.windows[1].live === true && m.windows[1].visible === false && m.windows[1].minimized === true && m.windows[1].focused === true);
  ok('...two windows with two processes do not share', m.windows[0].shares === false && m.windows[1].shares === false);
  ok('the stalls and the marks come through (the stall rounded)', m.stalls.length === 1 && m.stalls[0].at === 100 && m.stalls[0].ms === 1468 && m.marks.length === 1 && m.marks[0].at === 90 && m.marks[0].text.startsWith('Live Race window opened'));
  const two = Perf.cleanMain({ metrics: [{ type: 'Tab', pid: 11, cpu: 30, memMB: 800 }], windows: [{ title: 'A', pid: 11 }, { title: 'B', pid: 11, live: true }] });
  ok('two windows in one process say so (one process for both) and both have the figures of it', two.windows[0].shares === true && two.windows[1].shares === true && two.windows[0].cpu === 30 && two.windows[1].memMB === 800);
  const one = Perf.cleanMain({ metrics: [{ type: 'Tab', pid: 11, cpu: 30, memMB: 800 }], windows: [{ title: 'A', pid: 11 }] });
  ok('a single window does not share', one.windows[0].shares === false);
  const lone = Perf.cleanMain({ metrics: [{ type: 'GPU', pid: 3, cpu: 5, memMB: 100 }], windows: [{ title: 'A', pid: 3 }, { title: 'B' }, { title: 'C', pid: 'x' }] });
  ok('a window whose process is not a window process (the GPU), or has no number, has no figures', lone.windows[0].cpu === null && lone.windows[0].memMB === null && lone.windows[1].pid === null && lone.windows[1].cpu === null && lone.windows[2].pid === null && lone.windows[1].shares === false);
  const none = Perf.cleanMain({ metrics: [] });
  ok('an answer without windows, stalls or marks (an older app) gives empty lists', none.windows.length === 0 && none.stalls.length === 0 && none.marks.length === 0);
  const bad = Perf.cleanMain({ windows: 'x', stalls: 5, marks: { a: 1 } });
  ok('...and a wrong kind of answer too', bad.windows.length === 0 && bad.stalls.length === 0 && bad.marks.length === 0);
  const junk = Perf.cleanMain({ windows: [null, 'x', 5, { title: 'ok', pid: 1 }].concat(Array.from({ length: 20 }, (_, i) => ({ title: 'w' + i, pid: 100 + i }))), stalls: [null, { at: 1 }, { ms: 1 }, { at: 'x', ms: 5 }, { at: 1, ms: 'x' }].concat(Array.from({ length: 20 }, (_, i) => ({ at: i, ms: 100 + i }))), marks: [null, { at: 1 }, { text: 'x' }, { at: 1, text: '' }, { at: 1, text: '  ' }, { at: 'a', text: 'b' }].concat(Array.from({ length: 30 }, (_, i) => ({ at: i, text: 'm' + i }))) });
  ok('windows: rubbish is skipped and at most 8 are given', junk.windows.length === 8 && junk.windows[0].title === 'ok');
  ok('stalls: rubbish is skipped and at most the last 10 are given', junk.stalls.length === 10 && junk.stalls[9].ms === 119 && junk.stalls[0].ms === 110);
  ok('marks: rubbish is skipped and at most the last 20 are given', junk.marks.length === 20 && junk.marks[19].text === 'm29' && junk.marks[0].text === 'm10');
  const big = Perf.cleanMain({ stalls: [{ at: 1, ms: 1e9 }, { at: 2, ms: -5 }], marks: [{ at: 1, text: 'x'.repeat(300) }], windows: [{ title: 'y'.repeat(300) }] });
  ok('a stall is kept within an hour, below zero is zero, long texts are cut', big.stalls[0].ms === 3600000 && big.stalls[1].ms === 0 && big.marks[0].text.length === 100 && big.windows[0].title.length === 60); }

// ---- the report ----
{ let T = 0; const M = Perf.createMonitor({ now: () => T, wall: () => 1760970000000 });
  M.newRace(0, 1760970000000);
  for (let s = 0; s < 125; s++) { T = s * 1000; for (let k = 0; k < 10; k++) { const t = T + k * 100; M.frame(t); M.update(70, t); M.part('state', 12, t); M.part('widgets', 40, t); M.widget('leaderboard', 2, 5, 20, t); M.loaf({ dur: 120, script: 60, render: 55, forced: 9, top: { name: 'update race.js', ms: 41 } }, t); }
    M.sample(M.snapshot(T), { procs: { memoryMB: 1200 + s * 12, window: 20 } }, { heapMB: 100 + s, dom: 3000 + s * 10 }, T); }
  T = 124999; M.mark('Live Race tab pressed', 1760970060000);
  const r = M.snapshot(T);
  const m = Perf.cleanMain({ metrics: [{ type: 'Tab', pid: 11, cpu: 20, memMB: 900 }, { type: 'Tab', pid: 12, cpu: 25, memMB: 700 }], windows: [{ title: 'SlotForge Timing', pid: 11, visible: true }, { title: 'Live Race', pid: 12, live: true, visible: true, focused: true }],
    stalls: [{ at: 1760970061000, ms: 1468 }], marks: [{ at: 1760970060500, text: 'Live Race window opened (1460 ms in the core)' }] });
  const rep = Perf.report(r, m, { when: 'x', race: { name: 'T', widgets: 57, lanes: 2 } }), lines = rep.split('\n');
  const at = s => lines.findIndex(x => x.includes(s));
  ok('the report says where a screen update spends its time: the parts, the biggest first, with milliseconds', at('Where a screen update spends its time') >= 0 && lines[at('Where a screen update spends its time') + 1] === '  widgets 40 ms · state 12 ms');
  ok('...the slowest widgets with text, page and fit', lines[at('Slowest widgets') + 1] === '  leaderboard: 27 ms (text 2, page 5, fit 20)');
  ok('...the slow frames: how many, the average, the longest, what script, what page, what forced', rep.includes('Slow frames (over 50 ms) in the last 10 seconds: 100, 120 ms on average, the longest 120 ms. On average: scripts 60 ms (of which the page measuring itself 9 ms), drawing the page 55 ms'));
  ok('...and the slowest scripts', rep.includes('  slowest scripts: update race.js 41 ms'));
  ok('...the worst of the race with the time it started and how long ago', /Worst since the race started \(\d\d:\d\d:\d\d, 2 min 5 s ago\): slowest frame 100 ms, longest screen update 70 ms, longest stuck 0 ms, longest slow frame 120 ms, fewest frames \d+ a second, busiest \d+% of the time on updates/.test(rep));
  const rows = lines.filter(x => /^ {2}\d+:\d\d {2}/.test(x));
  ok('...the rows of the history: 5 rows of 30 seconds (0:00 to 2:00 in steps of half a minute)', rows.length === 5 && rows[0].startsWith('  0:00') && rows[1].startsWith('  0:30') && rows[4].startsWith('  2:00'));
  ok('...each row with the frames, the update, the load, the memory of the app and the page, the elements and the CPU', /^ {2}2:00 {2}\d+ frames\/s · update 70 ms \(\d+% of the time, slowest 70\) · app \d+ MB · page \d+ MB · \d+ elements · window CPU 20%$/.test(rows[4]));
  ok('...the windows with their own CPU and memory', rep.includes('Windows (2 open):') && rep.includes('  SlotForge Timing: CPU 20%, 900 MB') && rep.includes('  Live Race: CPU 25%, 700 MB, in front'));
  ok('...the stalls with the clock time', /The core of the app was stuck for over 100 ms at: \d\d:\d\d:\d\d \(1468 ms\)/.test(rep));
  const ev = lines.slice(at('What happened (clock time):') + 1, at('What happened (clock time):') + 4);
  ok('...what happened, from the window and from the core together, in the order of the clock', ev.length >= 3 && /Live Race tab pressed/.test(ev[0]) && /Live Race window opened \(1460 ms in the core\)/.test(ev[1]) && /Race started/.test(ev[2]) === false || (ev[0].includes('Race started') === false));
  ok('...the notes: the Live Race window, the stall of 1468 ms, the widget that takes the time', rep.includes('The Live Race window is open: it draws the timing page a second time, in a process of its own.') && /The core of the app was stuck for 1468 ms at \d\d:\d\d:\d\d\./.test(rep) && rep.includes('The widget "leaderboard" takes 27 ms of every update'));
  ok('...and the part that was already there is still there (the first line, Frames, Screen updates, Race save)', lines[0].startsWith('SlotForge Timing') && rep.includes('Frames: 10 a second') && rep.includes('Screen updates: 10 a second') && rep.includes('Race save:')); }

{ const M = Perf.createMonitor({ now: () => 0 }); M.frame(0); for (let i = 0; i < 20; i++) M.frame(i * 16.7 + 17);
  const r = M.snapshot(400), rep = Perf.report(r, null, {});
  ok('a report without a race, a slow frame or a window has none of the new parts', !/Where a screen update|Slowest widgets|Slow frames|Worst since|Since the race started|Windows \(|stuck for over|What happened/.test(rep)); }

{ const M = Perf.createMonitor({ now: () => 0 }); M.newRace(0, 1760970000000); M.frame(0);
  for (let i = 0; i < 100; i++) M.sample({ fps: 30, updateAvg: i, updateMax: i, updateLoad: i }, null, {}, i * 30000);
  const rep = Perf.report(M.snapshot(3000000), null, {}), rows = rep.split('\n').filter(x => /^ {2}\d+:\d\d {2}/.test(x));
  ok('a long race: at most 24 rows are in the report, and the first and the last of the race are among them', rows.length === 24 && rows[0].startsWith('  0:00') && rows[23].startsWith('  49:30'));
  const M2 = Perf.createMonitor({ now: () => 0 }); M2.newRace(0, 1); for (let i = 0; i < 24; i++) M2.sample({ fps: 30, updateAvg: i, updateMax: i, updateLoad: i }, null, {}, i * 30000);
  ok('...24 rows are all given', Perf.report(M2.snapshot(1e9), null, {}).split('\n').filter(x => /^ {2}\d+:\d\d {2}/.test(x)).length === 24); }

{ const M = Perf.createMonitor({ now: () => 0 }); M.frame(0); M.update(5, 0);
  M.mark('a'); const r = M.snapshot(100);
  const m = Perf.cleanMain({ marks: [{ at: 1, text: 'from the core' }, { at: 5e12, text: 'late' }] });
  const rep = Perf.report(r, m, {}), ev = rep.split('\n').filter(x => /^ {2}\d\d:\d\d:\d\d {2}/.test(x));
  ok('what happened: the marks of the window and of the core are put in the order of the clock', ev.length === 3 && ev[0].includes('from the core') && ev[1].includes(' a') && ev[2].includes('late'));
  const many = Perf.cleanMain({ marks: Array.from({ length: 30 }, (_, i) => ({ at: i + 1, text: 'e' + i })) });
  const rep2 = Perf.report(null, many, {}).split('\n').filter(x => /^ {2}\d\d:\d\d:\d\d {2}/.test(x));
  ok('...at most the last 24 are in the report (1.61.1: room for the saves and the lists sent), and the core is given at most 20 of them', rep2.length === 20 && rep2[19].includes('e29') && rep2[0].includes('e10'));
  const mixed = Perf.report({ marks: Array.from({ length: 10 }, (_, i) => ({ at: 100 + i * 2, text: 'w' + i })) }, Perf.cleanMain({ marks: Array.from({ length: 20 }, (_, i) => ({ at: 101 + i * 2, text: 'c' + i })) }), {}).split('\n').filter(x => /^ {2}\d\d:\d\d:\d\d {2}/.test(x));
  ok('...with the notes of the window and of the core together the last 24 are in the report, in the order of the clock', mixed.length === 24 && mixed[23].includes('c19') && mixed[0].includes('w3') && mixed[1].includes('c3') && mixed[2].includes('w4')); }

{ const rep = Perf.report(null, Perf.cleanMain({ windows: [{ title: 'Race', pid: 11 }, { title: 'Live Race', pid: 12, live: true, visible: false, minimized: true }, { title: 'Other', pid: 13, live: true }, { title: '', pid: 14 }], metrics: [{ type: 'Tab', pid: 12, cpu: 5, memMB: 50 }] }), {});
  ok('a window with no title is untitled; a Live Race window whose title does not say so is marked; hidden and minimized are said; no process figures say unknown', rep.includes('  Race: CPU unknown, memory unknown') && rep.includes('  Live Race: CPU 5%, 50 MB, hidden, minimized') && rep.includes('  Other [Live Race]: CPU unknown') && rep.includes('  untitled: CPU unknown'));
  const sh = Perf.report(null, Perf.cleanMain({ windows: [{ title: 'A', pid: 1 }, { title: 'B', pid: 1 }], metrics: [{ type: 'Tab', pid: 1, cpu: 9, memMB: 99 }] }), {});
  ok('...two windows in one process say so', sh.split('(one process for both windows)').length === 3); }

// ---- the notes ----
{ const base = { fps: 60, updateAvg: 20, updates: 10, updateLoad: 5, updateMax: 25, longCount: 0, longMax: 0, widgets: [], parts: [], loaf: null, history: [] };
  const has = (r, m, s) => Perf.notes(r, m).some(x => x.includes(s));
  const w = (avg, over = {}) => ({ ...base, updateAvg: 20, widgets: [{ type: 'leaderboard', avg, draw: 1, write: 1, fit: 1, count: 1, ...over }] });
  ok('a widget that takes 7 ms of a 20 ms update (35% but under 8 ms) is not named', !has(w(7), null, 'The widget'));
  ok('...8 ms of a 40 ms update (20%) is not named, and 8 ms of 23 ms (34.8%) is not either', !has({ ...w(8), updateAvg: 40 }, null, 'The widget') && !has({ ...w(8), updateAvg: 23 }, null, 'The widget'));
  ok('...8 ms of a 22 ms update (36%) is named', has({ ...w(8), updateAvg: 22 }, null, 'The widget "leaderboard" takes 8 ms of every update, 36% of it'));
  ok('...exactly 35% (14 of 40 ms) is named', has({ ...w(14), updateAvg: 40 }, null, 'The widget "leaderboard"'));
  ok('...34% (13.6 of 40 ms) is not', !has({ ...w(13.6), updateAvg: 40 }, null, 'The widget'));
  ok('...mostly fit: it says so (fit 15 of 20)', has(w(20, { fit: 15, draw: 2, write: 3 }), null, ', mostly in fitting it to its place.'));
  ok('...mostly in the page: it says so (write 15 of 20)', has(w(20, { fit: 3, draw: 2, write: 15 }), null, ', mostly in putting it in the page.'));
  ok('...fit exactly half is "mostly fit" (10 of 20)', has(w(20, { fit: 10, draw: 5, write: 5 }), null, 'mostly in fitting'));
  ok('...text mostly: it says nothing about where', has(w(20, { fit: 1, draw: 18, write: 1 }), null, 'of every update, ') && !has(w(20, { fit: 1, draw: 18, write: 1 }), null, 'mostly'));
  ok('...several of them are counted (3 of them)', has(w(20, { count: 3 }), null, '(3 of them)') && !has(w(20, { count: 1 }), null, 'of them'));
  ok('...no update time known: no widget note (nothing divided by nothing)', !has({ ...w(20), updateAvg: null }, null, 'The widget'));
  ok('a slow frame that is mostly drawing the page says so (render over script)', has({ ...base, loaf: { count: 3, avg: 100, max: 120, script: 40, render: 50, forced: 0, top: [] } }, null, 'more time goes in drawing the page') && !has({ ...base, loaf: { count: 3, avg: 100, max: 120, script: 50, render: 50, forced: 0, top: [] } }, null, 'more time goes in drawing the page'));
  ok('...forced layout: 5 ms and a quarter of the script is named', has({ ...base, loaf: { count: 3, avg: 100, max: 120, script: 20, render: 5, forced: 5, top: [] } }, null, 'the page measuring itself again and again'));
  ok('...4.9 ms is not', !has({ ...base, loaf: { count: 3, avg: 100, max: 120, script: 20, render: 5, forced: 4.9, top: [] } }, null, 'measuring itself'));
  ok('...5 ms of 40 ms script (under a quarter) is not', !has({ ...base, loaf: { count: 3, avg: 100, max: 120, script: 40, render: 5, forced: 5, top: [] } }, null, 'measuring itself'));
  const row = (at, o = {}) => ({ at, fps: 30, update: 70, updateMax: 80, load: 50, memMB: 1000, winCpu: 20, heapMB: 100, dom: 3000, ...o });
  const hist = (a, b, n = 3) => ({ ...base, history: [a, ...Array.from({ length: n - 2 }, (_, i) => row(30 + i * 5)), b] });
  ok('an update that took 70 ms and now takes 98 ms (x1.4) after a minute: "it gets slower during the race"', has(hist(row(0), row(60, { update: 98 })), null, 'it gets slower during the race') && has(hist(row(0), row(60, { update: 98 })), null, 'took 70 ms at 0:00 of the race and 98 ms at 1:00: it gets slower'));
  ok('...x1.39 is not', !has(hist(row(0), row(60, { update: 97.5 })), null, 'gets slower'));
  ok('...and 15 ms more is needed (10 ms to 14.9 ms is x1.49 but only +4.9: no; 10 to 25 is yes)', !has(hist(row(0, { update: 10 }), row(60, { update: 24.9 })), null, 'gets slower') && has(hist(row(0, { update: 10 }), row(60, { update: 25 })), null, 'gets slower'));
  ok('...under a minute into the race it is too early to say', !has(hist(row(0), row(59, { update: 200 })), null, 'gets slower') && has(hist(row(0), row(60, { update: 200 })), null, 'gets slower'));
  ok('...two rows are too few to say', !has({ ...base, history: [row(0), row(120, { update: 300 })] }, null, 'gets slower') && has(hist(row(0), row(120, { update: 300 }), 4), null, 'gets slower'));
  ok('...rows without an update time are not used (null)', !has({ ...base, history: [row(0, { update: null }), row(60, { update: null }), row(120, { update: null })] }, null, 'gets slower'));
  ok('the memory of the page doubled and 100 MB more: named; 99 MB more is not; x1.99 is not', has(hist(row(0, { heapMB: 100 }), row(60, { heapMB: 200 })), null, 'The memory of the page grew from 100 MB to 200 MB') && !has(hist(row(0, { heapMB: 100 }), row(60, { heapMB: 199 })), null, 'memory of the page') && !has(hist(row(0, { heapMB: 1000 }), row(60, { heapMB: 1900 })), null, 'memory of the page'));
  ok('...no figure: not named', !has(hist(row(0, { heapMB: null }), row(60, { heapMB: 900 })), null, 'memory of the page') && !has(hist(row(0, { heapMB: 100 }), row(60, { heapMB: null })), null, 'memory of the page'));
  ok('the page grew by half and 1000 elements: named; 999 more is not; x1.49 is not', has(hist(row(0, { dom: 2000 }), row(60, { dom: 3000 })), null, 'The page grew from 2000 to 3000 elements') && !has(hist(row(0, { dom: 2000 }), row(60, { dom: 2999 })), null, 'elements') && !has(hist(row(0, { dom: 5000 }), row(60, { dom: 7400 })), null, 'elements'));
  ok('the memory of the app grew by half and 500 MB: named; 499 more is not; x1.49 is not', has(hist(row(0, { memMB: 1000 }), row(60, { memMB: 1500 })), null, 'The memory of the app grew from 1000 MB to 1500 MB') && !has(hist(row(0, { memMB: 1000 }), row(60, { memMB: 1499 })), null, 'memory of the app') && !has(hist(row(0, { memMB: 2000 }), row(60, { memMB: 2990 })), null, 'memory of the app'));
  const cm = (o = {}) => Perf.cleanMain({ windows: [{ title: 'Race', pid: 1 }], ...o });
  ok('the Live Race window open: named; only the race window: not', has(null, cm({ windows: [{ title: 'Race', pid: 1 }, { title: 'Live Race', pid: 2, live: true }] }), 'The Live Race window is open') && !has(null, cm(), 'Live Race window'));
  ok('a stall of 500 ms is named with its time; 499 ms is not; the latest big one is named', has(null, cm({ stalls: [{ at: 1760970061000, ms: 500 }] }), 'was stuck for 500 ms at') && !has(null, cm({ stalls: [{ at: 1, ms: 499 }] }), 'was stuck for') && has(null, cm({ stalls: [{ at: 1, ms: 900 }, { at: 2, ms: 600 }, { at: 3, ms: 100 }] }), 'stuck for 600 ms'));
  ok('when all is well there is nothing to note', Perf.notes({ ...base, history: [row(0), row(30), row(60)] }, cm()).length === 0); }

// ---- 1.60.1, the edges (found by breaking the code on purpose and seeing what the tests did not notice) ----
{ const A = Perf.createMonitor({ now: () => 0 }); A.newRace(0, 1); A.frame(0); A.frame(2000);
  const B = Perf.createMonitor({ now: () => 0 }); B.newRace(0, 1); B.frame(0); B.frame(2001);
  ok('a frame that came 2000 ms after the one before is a slow frame of the race; one that came 2001 ms after is a window that was hidden (not counted)', A.snapshot(2000).race.frame === 2000 && B.snapshot(2001).race.frame === 0);
  const U = Perf.createMonitor({ now: () => 0 }); U.newRace(0, 1); U.update(33.37, 10); U.update(12.04, 20); U.long(41.6, 30);
  const us = U.snapshot(2600).race;
  ok('the worst of the race: the update to a tenth of a millisecond, the stuck time and the seconds rounded', us.update === 33.4 && us.long === 42 && us.seconds === 3);
  const P = Perf.createMonitor({ now: () => 0 }); P.part('widgets', 40, 100); P.update(5, 100); P.update(5, 14000);
  ok('the times of the parts that are older than ten seconds do not count, when the updates go on', P.snapshot(14500).parts.length === 0);
  const H = Perf.createMonitor({ now: () => 0 }); H.newRace(1000, 1); H.sample({ fps: 30, updateAvg: 5, updateMax: 6, updateLoad: 1 }, null, {}, 2500);
  ok('a row of the history says the seconds since the race started, rounded (1.5 s is 2)', H.snapshot(3000).history[0].at === 2);
  const R = Perf.createMonitor({ now: () => 0 }); R.update(5, 100); R.part('state', 3, 100); R.reset(); R.update(5, 200);
  ok('after reset the times of the parts that were there before do not come back', R.snapshot(300).parts.length === 0);
  const R2 = Perf.createMonitor({ now: () => 0 }); R2.update(5, 100); R2.part('state', 3, 100); R2.part('state', 3, 2500); R2.reset(); R2.update(5, 2600);
  ok('...also when they were in an earlier second', R2.snapshot(2700).parts.length === 0);
  const D = Perf.createMonitor({ now: () => 0 }); D.update(1, 0); D.update(1, 100); D.update(1, 200); D.part('state', 1, 250); D.widget('y', 0.5, 0.25, 0.25, 250);
  const ds = D.snapshot(300);
  ok('averages over the updates are rounded to a hundredth: 1 ms over 3 updates is 0.33; 0.5, 0.25 and 0.25 are 0.17, 0.08, 0.08 (1.0 is 0.33)', ds.parts[0].avg === 0.33 && ds.widgets[0].draw === 0.17 && ds.widgets[0].write === 0.08 && ds.widgets[0].fit === 0.08 && ds.widgets[0].avg === 0.33);
  const C = Perf.createMonitor({ now: () => 0 }); C.update(1, 0); C.update(1, 100); C.widget('z', 1, 1, 1, 150); C.widget('z', 1, 1, 1, 160); C.widget('z', 1, 1, 1, 170);
  ok('...the number of widgets of a type is the number drawn over the updates, rounded (3 draws over 2 updates is 2)', C.snapshot(300).widgets[0].count === 2); }

{ const L = Perf.loafFrom({ duration: 100, startTime: 0, scripts: [{ duration: 10, sourceFunctionName: 'a' }, { duration: 40, sourceFunctionName: 'b', sourceURL: 'http://x/y/race.js?v=1' }, { duration: 20, sourceFunctionName: 'c' }] });
  ok('the biggest script of a slow frame is named (not the first one)', L.top.name === 'b race.js' && L.top.ms === 40);
  const E = Perf.loafFrom({ duration: 100, startTime: 0, scripts: [{ duration: 20, sourceFunctionName: 'first' }, { duration: 20, sourceFunctionName: 'second' }] });
  ok('...of two that are as big the first one', E.top.name === 'first');
  ok('the time of drawing the page is what is left of the frame after the render started (never below zero)', Perf.loafFrom({ duration: 50, startTime: 100, renderStart: 120, scripts: [] }).render === 30 && Perf.loafFrom({ duration: 50, startTime: 100, renderStart: 200, scripts: [] }).render === 0); }

{ const w = Perf.cleanMain({ windows: [{ title: 'A' }, { title: 'B', visible: false, live: true }] }).windows;
  ok('a window that does not say whether it is shown is shown, and one that does not say it is the Live Race window is not (and not minimized or in front)', w[0].visible === true && w[0].live === false && w[0].minimized === false && w[0].focused === false && w[1].visible === false && w[1].live === true);
  const rep = Perf.report(null, Perf.cleanMain({ windows: [{ title: 'A' }] }), {});
  ok('...so the report does not call it hidden', rep.includes('  A: CPU unknown, memory unknown') && !/hidden|minimized|in front/.test(rep));
  const s = Perf.cleanMain({ stalls: [null, { at: 1 }, { ms: 1 }, { at: 'x', ms: 5 }, { at: 5, ms: 'x' }, { at: 6, ms: 200 }] }).stalls;
  ok('a stall needs a time and a length (rubbish is left out, also when there are only a few)', s.length === 1 && s[0].at === 6 && s[0].ms === 200);
  const k = Perf.cleanMain({ marks: [null, { at: 1 }, { text: 'x' }, { at: 2, text: '' }, { at: 3, text: '   ' }, { at: 4, text: 5 }, { at: 'x', text: 'y' }, { at: 5, text: 'ok' }] }).marks;
  ok('a mark needs a time and a text (rubbish and empty ones are left out, also when there are only a few)', k.length === 1 && k[0].at === 5 && k[0].text === 'ok'); }

// ---- the notes at their edges ----
{ const base = { fps: 60, updateAvg: 20, updates: 10, updateLoad: 5, updateMax: 25, longCount: 0, longMax: 0, widgets: [], parts: [], loaf: null, history: [] };
  const has = (r, m, s) => Perf.notes(r, m).some(x => x.includes(s));
  const w = (avg, over = {}) => ({ ...base, updateAvg: 20, widgets: [{ type: 'leaderboard', avg, draw: 1, write: 1, fit: 1, count: 1, ...over }] });
  const loaf = (script, forced) => ({ ...base, loaf: { count: 3, avg: 100, max: 120, script, render: 5, forced, top: [] } });
  const row = (at, o = {}) => ({ at, fps: 30, update: 70, updateMax: 80, load: 50, memMB: 1000, winCpu: 20, heapMB: 100, dom: 3000, ...o });
  ok('two windows and none of them is the Live Race window: no note about it', !has(null, Perf.cleanMain({ windows: [{ title: 'Race', pid: 1 }, { title: 'Other', pid: 2 }] }), 'Live Race window is open'));
  ok('a widget whose page part is exactly half of its time is "mostly in putting it in the page" (10 of 20, the fit being less)', has(w(20, { fit: 5, draw: 5, write: 10 }), null, 'mostly in putting it in the page') && !has(w(20, { fit: 5, draw: 6, write: 9 }), null, 'mostly'));
  ok('slow frames: forced layout is named from 5 ms and a quarter of the script, not under 5 ms of a small script (4.9 of 10), not under a quarter of a big one (24.9 of 100)', has(loaf(100, 25), null, 'measuring itself') && !has(loaf(100, 24.9), null, 'measuring itself') && !has(loaf(10, 4.9), null, 'measuring itself') && has(loaf(10, 5), null, 'measuring itself'));
  const hist = (...rows) => ({ ...base, history: rows });
  ok('rows without an update time are left out of the comparison (one between two real ones: two are too few; one at the end is not the last)', !has(hist(row(0), row(30, { update: null }), row(60, { update: 98 })), null, 'gets slower') && has(hist(row(0), row(30), row(60, { update: 98 }), row(90, { update: null })), null, '70 ms at 0:00 of the race and 98 ms at 1:00'));
  ok('...the note says when the first and the last row were (the first row need not be at the start)', has(hist(row(10), row(40), row(70, { update: 98 })), null, '70 ms at 0:10 of the race and 98 ms at 1:10: it gets slower during the race'));
  ok('the memory of the page: x2 but only 99 MB more is not named; 100 MB more is', !has(hist(row(0, { heapMB: 40 }), row(30), row(60, { heapMB: 139 })), null, 'memory of the page') && has(hist(row(0, { heapMB: 40 }), row(30), row(60, { heapMB: 140 })), null, 'memory of the page'));
  ok('the elements of the page: x3 but only 999 more is not named; 1000 more is', !has(hist(row(0, { dom: 500 }), row(30), row(60, { dom: 1499 })), null, 'page grew') && has(hist(row(0, { dom: 500 }), row(30), row(60, { dom: 1500 })), null, 'page grew'));
  ok('the memory of the app: x1.8 but only 499 MB more is not named; 500 MB more is', !has(hist(row(0, { memMB: 600 }), row(30), row(60, { memMB: 1099 })), null, 'memory of the app') && has(hist(row(0, { memMB: 600 }), row(30), row(60, { memMB: 1100 })), null, 'memory of the app')); }

// ---- 1.60.2: the note about drawing the page needs figures the browser really gave ----
{ const base = { fps: 60, updateAvg: 20, updates: 10, updateLoad: 5, updateMax: 25, longCount: 0, longMax: 0, widgets: [], parts: [], loaf: null, history: [] };
  const has = (r, s) => Perf.notes(r, null).some(x => x.includes(s));
  const lo = (script, render, avg = 100) => ({ ...base, loaf: { count: 3, avg, max: 120, script, render, forced: 0, top: [] } });
  ok('slow frames with 0 ms of scripts and 0 ms of drawing (the browser gave no detail) do not say the page is drawn too slowly', !has(lo(0, 0), 'drawing the page'));
  ok('...nor does a little drawing (4.9 ms) that is more than the scripts', !has(lo(0, 4.9), 'drawing the page') && !has(lo(1, 4.9), 'drawing the page'));
  ok('...5 ms of drawing that is more than the scripts is named', has(lo(0, 5), 'drawing the page') && has(lo(4, 5), 'drawing the page'));
  ok('...drawing that is not more than the scripts is not named', !has(lo(5, 5), 'drawing the page') && !has(lo(60, 30), 'drawing the page'));
  const rep = (script, render, avg) => { const M = Perf.createMonitor({ now: () => 0 }); M.loaf({ dur: avg, script, render, forced: 0 }, 100); return Perf.report(M.snapshot(200), Perf.cleanMain({}), { when: 'x' }); };
  ok('the report says so when the browser does not tell where the time of the slow frames went (scripts and drawing together under a quarter)', rep(0, 0, 100).includes('drawing the page 0 ms (the browser does not say where the rest of the time went)') && rep(10, 14, 100).includes('(the browser does not say'));
  ok('...and does not when it does (a quarter or more)', !rep(10, 15, 100).includes('the browser does not say') && !rep(60, 30, 120).includes('the browser does not say'));
  ok('the table of the widgets says that making the text includes seeing whether it changed', Perf.report({ ...base, seconds: 20, widgets: [{ type: 'clock', avg: 2, draw: 2, write: 0, fit: 0, count: 1 }], parts: [] }, Perf.cleanMain({}), { when: 'x' }).includes('making the text and seeing whether it changed')); }

// ---- the report at its edges ----
{ const wall = new Date(2026, 9, 20, 14, 5, 9).getTime();
  const M = Perf.createMonitor({ now: () => 0 }); M.newRace(0, wall); M.frame(0); M.update(5, 10);
  const rep = Perf.report(M.snapshot(400), null, {});
  ok('the worst of the race says the hour, minute and second the race started (14:05:09), and "–" for the fewest frames when there were not enough to count', rep.includes('Worst since the race started (14:05:09, 0 s ago): slowest frame 0 ms') && rep.includes('fewest frames –, busiest'));
  ok('...and how long ago it started', Perf.report(M.snapshot(5400), null, {}).includes('(14:05:09, 5 s ago)'));
  const N = Perf.createMonitor({ now: () => 0 }); N.newRace(0, null); N.frame(0);
  ok('...a race with no clock time is "–" (not 1970)', Perf.report(N.snapshot(100), null, {}).includes('Worst since the race started (–, '));
  const F = Perf.createMonitor({ now: () => 0 }); F.newRace(0, wall); for (let i = 0; i <= 60; i++) F.frame(i * 20);
  ok('...and when there were enough frames it says how many a second at the fewest', /fewest frames 50 a second,/.test(Perf.report(F.snapshot(1200), null, {})));
  const Q = Perf.createMonitor({ now: () => 0 }); Q.frame(0); Q.update(5, 0); Q.loaf({ dur: 100, script: 50, render: 20, forced: 0, top: null }, 10);
  const rq = Perf.report(Q.snapshot(100), null, {});
  ok('slow frames without a named script have no line of slowest scripts', rq.includes('Slow frames (over 50 ms)') && !rq.includes('slowest scripts'));
  const T = Perf.createMonitor({ now: () => 0 }); T.newRace(0, wall); T.frame(0);
  for (let i = 0; i < 100; i++) T.sample({ fps: 30, updateAvg: i, updateMax: i, updateLoad: i }, null, {}, i * 30000);
  const rows = Perf.report(T.snapshot(3000000), null, {}).split('\n').filter(x => /^ {2}\d+:\d\d {2}/.test(x));
  ok('a long race: the rows that are left are spread over the race (the 3rd one is the 10th of 100: 4:30)', rows[1].startsWith('  2:00') && rows[2].startsWith('  4:30') && rows[22].startsWith('  47:30'));
  const none = Perf.report(null, Perf.cleanMain({ metrics: [] }), {});
  ok('a core that tells no windows and no stalls has no list of them in the report', !none.includes('Windows (') && !none.includes('stuck for over'));
  const stalls = Perf.report(null, Perf.cleanMain({ stalls: [{ at: wall, ms: 250 }] }), {});
  ok('...and one that tells a stall has it with the clock time', stalls.includes('The core of the app was stuck for over 100 ms at: 14:05:09 (250 ms)') && !stalls.includes('Windows (')); }

// ---- 1.60.4: the longest update of the race says which parts it spent its time on, and when ----
{ const M = Perf.createMonitor({ now: () => 0 }); M.newRace(1000, 1760970000000);
  const upd = (parts, total, t) => { parts.forEach(([n, v]) => M.part(n, v, t)); M.update(total, t); };
  upd([['save point', 0.3], ['widgets', 4.6], ['panels', 0.2]], 5, 2000);
  let r = M.snapshot(2000);
  ok('the longest update keeps its parts of at least a millisecond (the small ones are left out) and when it was, in seconds from the start of the race', r.race.update === 5 && r.race.updateAt === 1 && r.race.updateParts.length === 1 && r.race.updateParts[0].name === 'widgets' && r.race.updateParts[0].ms === 4.6, JSON.stringify(r.race));
  upd([['save point', 151], ['widgets', 13.64], ['panels', 3.24], ['state', 1.4], ['share', 0.9]], 169, 6350);
  r = M.snapshot(6000);
  ok('...a longer update takes its place: its three biggest parts, the biggest first', r.race.update === 169 && r.race.updateAt === 5 && r.race.updateParts.map(x => x.name + ':' + x.ms).join() === 'save point:151,widgets:13.6,panels:3.2', JSON.stringify(r.race.updateParts));
  upd([['widgets', 90]], 100, 7000); upd([['widgets', 90]], 169, 7500); r = M.snapshot(7500);
  ok('...a shorter update after it (or an equal one) does not take its place', r.race.update === 169 && r.race.updateAt === 5 && r.race.updateParts[0].name === 'save point');
  const rep = Perf.report(r, null, {});
  ok('...the report says it: the figure, then (at the time of the race: the parts)', rep.includes('longest screen update 169 ms (at 0:05: save point 151 ms, widgets 14 ms, panels 3 ms), longest stuck'), rep.split('\n').find(x => x.includes('Worst since')));
  const N = Perf.createMonitor({ now: () => 0 }); N.newRace(0, 1); N.update(60, 1000); N.part('b', 80, 2000); N.update(90, 2000);
  ok('...the parts of the update before are not in the next one, and the parts of one name are added up', N.snapshot(2000).race.updateParts.length === 1 && N.snapshot(2000).race.updateParts[0].name === 'b');
  const S = Perf.createMonitor({ now: () => 0 }); S.newRace(0, 1); S.part('widgets', 10, 100); S.part('widgets', 15, 100); S.part('state', 2, 100); S.update(30, 100);
  ok('...a part that comes twice in one update is added up', S.snapshot(100).race.updateParts.map(x => x.name + ':' + x.ms).join() === 'widgets:25,state:2');
  const Q = Perf.createMonitor({ now: () => 0 }); Q.newRace(0, 1); Q.update(40, 100); Q.update(50, 200);
  ok('...an update without parts (the report was not open) leaves the line as it was', Q.snapshot(200).race.updateParts.length === 0 && !/longest screen update 50 ms \(/.test(Perf.report(Q.snapshot(200), null, {})) && Perf.report(Q.snapshot(200), null, {}).includes('longest screen update 50 ms, longest stuck'));
  const P = Perf.createMonitor({ now: () => 0 }); P.newRace(0, 1); P.part('widgets', 40, 100); P.newRace(1000, 1);
  ok('...a new race starts without the parts of an update before it, and nothing yet of the longest update', P.snapshot(1500).race.updateParts.length === 0 && P.snapshot(1500).race.updateAt === null);
  P.update(50, 1500); ok('...(the update after it has none of those parts either)', P.snapshot(1500).race.updateParts.length === 0 && P.snapshot(1500).race.update === 50);
  const R = Perf.createMonitor({ now: () => 0 }); R.newRace(0, 1); R.part('widgets', 40, 100); R.reset(); R.update(50, 200);
  ok('...and when the window figures start again the parts that were waiting go too', R.snapshot(200).race.updateParts.length === 0);
  const Z = Perf.createMonitor({ now: () => 0 }); Z.newRace(0, 1); for (let i = 0; i < 100; i++) Z.part('p' + i, 5, 100); Z.update(500, 100);
  ok('...a flood of parts is kept within bounds and still gives three', Z.snapshot(100).race.updateParts.length === 3);
  Z.update(NaN, 200); Z.update(-4, 300); ok('...and an update with no usable time changes nothing', Z.snapshot(300).race.update === 500 && Z.snapshot(300).race.updateParts.length === 3); }

// ---- 1.60.5: the longest update also names its slowest widgets; a row says what its slowest update was; the Delta Timer badges are counted ----
{ const M = Perf.createMonitor({ now: () => 0 }); M.newRace(1000, 1760970000000);
  const wid = (list, t) => list.forEach(([ty, d, w, f]) => M.widget(ty, d, w, f, t));
  wid([['laptime', 0.1, 0.2, 0], ['clock', 0.1, 0.2, 0]], 2000); M.part('widgets', 4, 2000); M.update(5, 2000);
  let r = M.snapshot(2000);
  ok('the longest update keeps the widgets that took a millisecond or more (the small ones are left out), by type, with text, page and fit apart', r.race.updateWidgets.length === 0 && r.race.update === 5);
  wid([['dsessionrecord', 1, 1.2, 40.55], ['dsessionrecord', 0.25, 0.5, 20.25], ['dlaptime', 0.4, 0.5, 59.4], ['carpicture', 5.5, 0, 0], ['position', 0.2, 0.3, 0.1], ['avatar', 1.2, 0, 0], ['lap', 0.1, 0.1, 0]], 6350); M.update(160.34, 6350);
  r = M.snapshot(6350);
  const w = r.race.updateWidgets;
  ok('...a longer update takes its place: the biggest four types, the biggest first, a type that comes twice is added up with its count', w.map(x => x.type + ':' + x.count).join() === 'dsessionrecord:2,dlaptime:1,carpicture:1,avatar:1', JSON.stringify(w));
  ok('...the figures are rounded to a tenth: text, page, fit and the total', w[0].ms === 63.8 && w[0].draw === 1.3 && w[0].write === 1.7 && w[0].fit === 60.8 && w[1].fit === 59.4, JSON.stringify(w[0]));
  wid([['x', 0, 0, 90]], 7000); M.update(100, 7000); wid([['y', 0, 0, 90]], 7500); M.update(160.34, 7500); r = M.snapshot(7500);
  ok('...a shorter update after it, or an equal one, does not take its place', r.race.updateWidgets[0].type === 'dsessionrecord' && r.race.update === 160.3);
  const rep = Perf.report(r, null, {}).split('\n'), at = rep.findIndex(x => x.startsWith('Worst since the race started'));
  ok('...the report says it on a line under the worst figures: type x count: ms (text, page, fit), the biggest first', rep[at + 1] === '  The widgets in that update: dsessionrecord x2: 63.8 ms (text 1.3, page 1.7, fit 60.8) · dlaptime: 60.3 ms (text 0.4, page 0.5, fit 59.4) · carpicture: 5.5 ms (text 5.5, page 0, fit 0) · avatar: 1.2 ms (text 1.2, page 0, fit 0)', rep[at + 1]);
  const N = Perf.createMonitor({ now: () => 0 }); N.newRace(0, 1); wid.call(null, []); N.widget('a', 0, 0, 80, 100); N.update(90, 100); N.widget('b', 0, 0, 50, 200); N.update(95, 200);
  ok('...the widgets of the update before are not in the next one', N.snapshot(200).race.updateWidgets.length === 1 && N.snapshot(200).race.updateWidgets[0].type === 'b');
  const Q = Perf.createMonitor({ now: () => 0 }); Q.newRace(0, 1); Q.update(50, 100);
  ok('...an update without widgets (nothing was timed) leaves the line out', Q.snapshot(100).race.updateWidgets.length === 0 && !Perf.report(Q.snapshot(100), null, {}).includes('The widgets in that update'));
  const P = Perf.createMonitor({ now: () => 0 }); P.newRace(0, 1); P.widget('a', 0, 0, 80, 100); P.newRace(1000, 1); P.update(50, 1500);
  ok('...a new race starts without the widgets that were waiting, and without the longest update of the race before', P.snapshot(1500).race.updateWidgets.length === 0);
  const R = Perf.createMonitor({ now: () => 0 }); R.newRace(0, 1); R.widget('a', 0, 0, 80, 100); R.reset(); R.update(50, 200);
  ok('...and when the window figures start again the widgets that were waiting go too', R.snapshot(200).race.updateWidgets.length === 0);
  const Z = Perf.createMonitor({ now: () => 0 }); Z.newRace(0, 1); for (let i = 0; i < 1000; i++) Z.widget('w' + (i % 50), 0, 0, 2, 100); Z.update(500, 100);
  ok('...a flood of widgets is kept within bounds (the last 300 count) and still gives four', Z.snapshot(100).race.updateWidgets.length === 4 && Z.snapshot(100).race.updateWidgets.every(x => x.count <= 7));
  const B = Perf.createMonitor({ now: () => 0 }); B.newRace(0, 1); B.widget(5, 1, 1, 1, 100); B.widget('a', -1, 0, 0, 100); B.widget('a', NaN, 0, 0, 100); B.widget('ok', 0, 0, 30, 100); B.update(40, 100);
  ok('...a widget with no usable type or time is not counted', B.snapshot(100).race.updateWidgets.map(x => x.type).join() === 'ok'); }

{ // the rows: what the slowest update of the last ten seconds was (kept when it took 20 ms or more, and it is the one the row's "slowest" is about)
  const M = Perf.createMonitor({ now: () => 0 });
  M.part('widgets', 330, 1000); M.widget('avatar', 100, 0, 0, 1000); M.widget('dlaptime', 0, 0, 200, 1000); M.update(369, 1000); // before the race starts
  M.part('widgets', 3, 1500); M.update(4, 1500);
  M.newRace(2000, 1760970000000);
  const snap = M.snapshot(2100); M.sample(snap, null, {}, 2100);
  const h = M.snapshot(2100).history[0];
  ok('the first row has the update from before the race clock started: a race that starts with a slow update (the screen being built) says what it was', h.slow && h.slow.ms === 369 && h.slow.parts[0].name === 'widgets' && h.slow.widgets.map(x => x.type).join() === 'dlaptime,avatar', JSON.stringify(h));
  const rows = Perf.report(M.snapshot(2100), null, {}).split('\n'), at = rows.findIndex(x => /^ {2}0:00 /.test(x));
  ok('...and the report puts it under the row: the slowest update, its parts, its widgets', at > 0 && rows[at + 1] === '        its slowest update (369 ms): widgets 330 ms · dlaptime: 200 ms (text 0, page 0, fit 200) · avatar: 100 ms (text 100, page 0, fit 0)', rows[at + 1]);
  const Q = Perf.createMonitor({ now: () => 0 }); Q.newRace(0, 1); Q.part('widgets', 10, 100); Q.update(15, 100); Q.sample(Q.snapshot(200), null, {}, 200);
  ok('a row whose slowest update is under 20 ms has nothing to say about it (null, and no extra line)', Q.snapshot(200).history[0].slow === null && !Perf.report(Q.snapshot(200), null, {}).includes('its slowest update'));
  const W = Perf.createMonitor({ now: () => 0 }); W.newRace(0, 1); W.part('widgets', 90, 1000); W.update(100, 1000); W.part('widgets', 40, 12000); W.update(50, 12000); W.sample(W.snapshot(12500), null, {}, 12500);
  ok('...an update that is out of the ten seconds of the row is not the row\'s: the slowest one in the window is (50 ms, not 100)', W.snapshot(12500).history[0].slow.ms === 50);
  const E = Perf.createMonitor({ now: () => 0 }); E.newRace(0, 1); E.part('widgets', 40, 1000); E.update(45, 1000); E.update(10, 2000); E.sample(E.snapshot(2500), null, {}, 2500);
  ok('...the row\'s slowest update is the biggest one of the window, not the last one', E.snapshot(2500).history[0].slow.ms === 45);
  const F = Perf.createMonitor({ now: () => 0 }); F.newRace(0, 1); for (let i = 0; i < 200; i++) { F.part('widgets', 30, 100 + i); F.update(30 + i, 100 + i); }
  ok('...a flood of slow updates keeps the window bounded and the slowest one', (F.sample(F.snapshot(400), null, {}, 400), F.snapshot(400).history[0].slow.ms === 229));
  const S = Perf.createMonitor({ now: () => 0 }); S.newRace(0, 1); S.part('widgets', 30, 100); S.update(40, 100); S.reset(); S.update(10, 200); S.sample(S.snapshot(300), null, {}, 300);
  ok('...and when the window figures start again the slow updates that were kept go too', S.snapshot(300).history[0].slow === null);
  const S2 = Perf.createMonitor({ now: () => 0 }); S2.newRace(0, 1); S2.part('widgets', 30, 100); S2.update(40, 100); S2.reset(); S2.update(40, 200); S2.sample(S2.snapshot(300), null, {}, 300);
  ok('...also when the update after it is just as slow: the row has that update, without the parts of the one before', S2.snapshot(300).history[0].slow.ms === 40 && S2.snapshot(300).history[0].slow.parts.length === 0);
  const U = Perf.createMonitor({ now: () => 0 }); U.newRace(0, 1); U.part('widgets', 22, 100); U.update(25, 100); U.part('widgets', 19, 200); U.update(19.9, 200); U.part('widgets', 20, 300); U.update(20, 300);
  ok('an update of 20 ms is kept, one of 19.9 ms is not (the limit is 20; 25 is kept too)', (U.sample(U.snapshot(400), null, {}, 400), U.snapshot(400).history[0].slow.ms === 25) && (() => { const V = Perf.createMonitor({ now: () => 0 }); V.newRace(0, 1); V.part('widgets', 20, 100); V.update(20, 100); V.sample(V.snapshot(200), null, {}, 200); const W2 = Perf.createMonitor({ now: () => 0 }); W2.newRace(0, 1); W2.part('widgets', 19, 100); W2.update(19.9, 100); W2.sample(W2.snapshot(200), null, {}, 200); return V.snapshot(200).history[0].slow.ms === 20 && W2.snapshot(200).history[0].slow === null; })());
  const X = Perf.createMonitor({ now: () => 0 }); X.newRace(0, 1); X.part('widgets', 90, 1000); X.update(100, 1000); X.sample({ fps: 30, updateAvg: 1, updateMax: 5, updateLoad: 1 }, null, {}, 1500); X.sample({ fps: 30, updateAvg: 1, updateMax: 100, updateLoad: 1 }, null, {}, 40000);
  ok('a row whose "slowest" is not that update (the figures were taken from another moment) does not claim it; neither does one far later than the update', X.snapshot(2000).history[0].slow === null && X.snapshot(2000).history[1].slow === null);
  const Y = Perf.createMonitor({ now: () => 0 }); Y.newRace(0, 1); Y.update(40, 100); Y.sample(Y.snapshot(200), null, {}, 200);
  ok('a slow update whose parts and widgets were not timed (nothing to name) has a row without the extra line', Y.snapshot(200).history[0].slow !== null && Y.snapshot(200).history[0].slow.parts.length === 0 && !Perf.report(Y.snapshot(200), null, {}).includes('its slowest update')); }

{ // the Delta Timer badges
  const M = Perf.createMonitor({ now: () => 0 });
  const m = { boxW: 59, boxH: 97, w: 62.34, h: 40.04, row: true };
  M.delta('dlaptime', { why: 'first', how: 'shrunk', steps: 2, m }, 1000); M.delta('dlaptime', { why: 'again', how: 'shrunk', steps: 1, m }, 1100); M.delta('dlaptime', { why: 'skip' }, 1200); M.delta('dlaptime', { why: 'skip' }, 1200);
  M.delta('dlaptime', { why: 'shape', how: 'roomy', steps: 0, m, key: '▲ +0.00|dlt-badge up|', prev: '▼ -0.00|dlt-badge down|' }, 1300); M.delta('dlaptime', { why: 'recheck', how: 'tight', steps: 0, m }, 1400); M.delta('dlaptime', { why: 'resize' }, 1500);
  M.delta('dbestlap', { why: 'skip' }, 1500);
  const d = M.snapshot(2000).delta;
  ok('the badges are counted by widget type: looked at, left alone, measured; the one with the most measures first', d.length === 2 && d[0].type === 'dlaptime' && d[0].calls === 6 && d[0].skipped === 2 && d[0].measured === 4 && d[1].type === 'dbestlap' && d[1].measured === 0, JSON.stringify(d));
  ok('...why they were measured (first, shape, recheck, again) and how it came out (roomy, shrunk, tight), with the steps added up', d[0].first === 1 && d[0].shape === 1 && d[0].recheck === 1 && d[0].again === 1 && d[0].roomy === 1 && d[0].shrunk === 2 && d[0].tight === 1 && d[0].unknown === 0 && d[0].steps === 3);
  ok('...a resize is counted on its own (the widget or the window changed size), and is not one of the looks of an update', d[0].resize === 1 && d[0].calls === 6);
  ok('...the last measure is kept (rounded to a tenth), and the last change of shape with what it was before', JSON.stringify(d[0].last) === JSON.stringify({ m: { boxW: 59, boxH: 97, w: 62.3, h: 40, row: true }, how: 'tight', steps: 0, from: '▼ -0.00|dlt-badge down|', to: '▲ +0.00|dlt-badge up|' }), JSON.stringify(d[0].last));
  ok('...a type that was only left alone has nothing measured to show', d[1].last === null && d[1].skipped === 1);
  const R = Perf.report(M.snapshot(2000), null, {}).split('\n'), at = R.findIndex(x => x.startsWith('Delta Timer badges'));
  ok('the report has a part for the Delta Timer badges, with the counts that are not zero in plain words', at >= 0 && R[at + 1] === '  dlaptime: 6 badges looked at in the last 1 s, 4 measured, 2 left alone; the widget or the window changed size 1 time(s) (each time every badge is measured again)' &&
    R[at + 2] === '    why measured: 1 for the first time, 1 the text changed shape (signs, number of figures, class or style), 1 the regular check (every 30th time), 1 it did not fit with room to spare the last time' &&
    R[at + 3] === '    how it came out: 1 fitted with room to spare, 2 had to be made smaller (1.5 steps on average), 1 fitted, but without room to spare' &&
    R[at + 4] === '    last measured: badge box 59 x 97 px, text 62.3 x 40 px, value and badge side by side' && R[at + 5] === '    last change of shape: "▼ -0.00|dlt-badge down|" -> "▲ +0.00|dlt-badge up|"' && R[at + 6] === '  dbestlap: 1 badge looked at in the last 1 s, 0 measured, 1 left alone', JSON.stringify(R.slice(at, at + 8)));
  { const C = Perf.createMonitor({ now: () => 0 }); C.delta('col', { why: 'first', how: 'shrunk', steps: 1, m: { ...m, row: false } }, 1000); C.delta('odd', { why: 'first', how: 'unknown', steps: 0, m: { ...m, row: undefined } }, 1000);
    const T2 = Perf.report(C.snapshot(2000), null, {}); const lm = T2.split('\n').filter(x => x.includes('last measured'));
    ok('...a badge below the value, or one whose layout is not known, says so; one that could not be measured says that', lm.length === 2 && lm.some(x => x.endsWith('badge below the value')) && lm.some(x => x.endsWith('layout not known')) && T2.includes('1 could not be measured (not on the screen yet)'), lm.join(' | ')); }
  const W = Perf.createMonitor({ now: () => 0 }); W.delta('a', { why: 'first', how: 'roomy', steps: 0, m }, 1000);
  ok('the figures are for the last ten seconds: after that they are forgotten (the last measure is kept for the type)', W.snapshot(20000).delta.length === 0);
  const B = Perf.createMonitor({ now: () => 0 });
  B.delta(5, { why: 'first' }); B.delta('a', null); B.delta('a', 'x'); B.delta('a', { why: 'nonsense' }); B.delta('a', { why: 'first', how: 'weird', steps: 'many', m: 'x' }, 100); B.delta('a', { why: 'shape', how: 'roomy', key: 5, prev: 6 }, 110);
  const b = B.snapshot(200).delta;
  ok('odd input is made safe: no type or no valid reason counts nothing; a measure that is no measure, a strange "how" and steps count as unknown and 0', b.length === 1 && b[0].calls === 2 && b[0].unknown === 1 && b[0].roomy === 1 && b[0].steps === 0 && b[0].last.m === null && b[0].last.from === null, JSON.stringify(b));
  const T = Perf.createMonitor({ now: () => 0 }); T.delta('a', { why: 'shape', how: 'roomy', steps: 0, key: 'k'.repeat(500), prev: 'p'.repeat(500) }, 100);
  ok('a shape of a very long style is cut (100 characters each)', T.snapshot(200).delta[0].last.to.length === 100 && T.snapshot(200).delta[0].last.from.length === 100);
  const X = Perf.createMonitor({ now: () => 0 }); for (let i = 0; i < 9; i++) X.delta('t' + i, { why: 'first', how: 'roomy', steps: 0 }, 100 + i);
  ok('at most five types are in the report', X.snapshot(200).delta.length === 5);
  const Y = Perf.createMonitor({ now: () => 0 }); Y.delta('a', { why: 'first', how: 'roomy', steps: 0 }, 100); Y.reset();
  ok('when the window figures start again the counts and the last measures go', Y.snapshot(200).delta.length === 0);
  ok('a report without any Delta Timer badges has no part for them', !Perf.report(Y.snapshot(200), null, {}).includes('Delta Timer badges') && !Perf.report(null, null, {}).includes('Delta Timer badges'));
  const Z = Perf.createMonitor({ now: () => 0 }); Z.delta('a', { why: 'shape', how: 'roomy', steps: 0, key: 'new', prev: 'old' }, 100); Z.delta('a', { why: 'recheck', how: 'roomy', steps: 0, key: 'new', prev: 'new' }, 200); Z.delta('a', { why: 'again', how: 'tight', steps: 0, key: 'x', prev: 'x' }, 300);
  ok('only a change of shape sets "the last change of shape" (a recheck or another measure with the same shape leaves it)', Z.snapshot(400).delta[0].last.from === 'old' && Z.snapshot(400).delta[0].last.to === 'new');
  const Z2 = Perf.createMonitor({ now: () => 0 }); Z2.delta('a', { why: 'first', how: 'roomy', steps: 0, key: 'k', m }, 100);
  ok('...and a type that never changed shape has no such line, but has its last measure', !Perf.report(Z2.snapshot(200), null, {}).includes('last change of shape') && Perf.report(Z2.snapshot(200), null, {}).includes('last measured: badge box 59 x 97 px'));
  const Z3 = Perf.createMonitor({ now: () => 0 }); for (let i = 0; i < 10; i++) Z3.delta('quiet', { why: 'skip' }, 100); Z3.delta('busy', { why: 'first', how: 'roomy', steps: 0, m }, 100); Z3.delta('busy', { why: 'again', how: 'roomy', steps: 0, m }, 100);
  ok('the types are ordered by what was measured, not by how often they were looked at', Z3.snapshot(200).delta.map(x => x.type).join() === 'busy,quiet');
  const rz = Perf.report(Z3.snapshot(200), null, {}).split('\n'), qz = rz.findIndex(x => x.startsWith('  quiet:'));
  ok('...a type that was only left alone has no "why measured" and no "how it came out"', qz > 0 && !rz.slice(qz, qz + 3).some(x => x.includes('why measured') || x.includes('how it came out')));
  const Z4 = Perf.createMonitor({ now: () => 0 }); Z4.delta('r', { why: 'resize' }, 100); Z4.delta('r', { why: 'resize' }, 100);
  ok('a type that was only resized (no update looked at it) is in the report with that', Z4.snapshot(200).delta.length === 1 && Z4.snapshot(200).delta[0].calls === 0 && Z4.snapshot(200).delta[0].resize === 2 && Perf.report(Z4.snapshot(200), null, {}).includes('r: 0 badges looked at in the last 0 s, 0 measured, 0 left alone; the widget or the window changed size 2 time(s)'));
  const Z5 = Perf.createMonitor({ now: () => 0 }); Z5.delta('a', { why: 'shape', how: 'roomy', steps: 0, key: 'new', prev: 'old' }, 100); Z5.reset(); Z5.delta('a', { why: 'skip' }, 200);
  ok('when the window figures start again the last measure and shape go too (a type that is only left alone afterwards has none)', Z5.snapshot(300).delta[0].last === null); }

// ---- 1.60.7: a badge that was made smaller is left alone with the size that was found before: the report counts those ("kept")
{ const m = { boxW: 59, boxH: 97, w: 62.34, h: 40.04, row: true };
  const K = Perf.createMonitor({ now: () => 0 });
  K.delta('dlaptime', { why: 'first', how: 'shrunk', steps: 2, m }, 1000);
  for (let i = 0; i < 5; i++) K.delta('dlaptime', { why: 'skip', how: 'kept' }, 1100 + i); K.delta('dlaptime', { why: 'skip' }, 1200);
  const d = K.snapshot(2000).delta;
  ok('a badge that is left alone with the smaller size found before is counted as left alone, and as "kept" (a part of the left-alone ones)', d.length === 1 && d[0].calls === 7 && d[0].skipped === 6 && d[0].kept === 5 && d[0].measured === 1, JSON.stringify(d));
  ok('...it is not a measure: how it came out and the steps are not touched, and the last measure stays what it was', d[0].shrunk === 1 && d[0].steps === 2 && d[0].roomy === 0 && d[0].unknown === 0 && d[0].last && d[0].last.how === 'shrunk' && d[0].last.steps === 2 && d[0].last.m.boxW === 59);
  const R = Perf.report(K.snapshot(2000), null, {}).split('\n'), at = R.findIndex(x => x.startsWith('Delta Timer badges'));
  ok('the report says it in plain words, after the left-alone count', R[at + 1] === '  dlaptime: 7 badges looked at in the last 1 s, 1 measured, 6 left alone (5 of them put at the smaller size that was found before)', R[at + 1]);
  ok('...and the heading tells that a badge that had to be made smaller is put at the size found before', R[at].includes('one that had to be made smaller is put at the size found before'));
  const N = Perf.createMonitor({ now: () => 0 }); N.delta('a', { why: 'first', how: 'roomy', steps: 0, m }, 1000); N.delta('a', { why: 'skip' }, 1100);
  const Rn = Perf.report(N.snapshot(2000), null, {}).split('\n'), an = Rn.findIndex(x => x.startsWith('Delta Timer badges'));
  ok('without any kept the line is as before (no clause)', Rn[an + 1] === '  a: 2 badges looked at in the last 1 s, 1 measured, 1 left alone' && N.snapshot(2000).delta[0].kept === 0, Rn[an + 1]);
  const O = Perf.createMonitor({ now: () => 0 }); O.delta('a', { why: 'first', how: 'kept', steps: 0, m }, 1000); O.delta('a', { why: 'resize', how: 'kept' }, 1000); O.delta('a', { why: 'recheck', how: 'kept', steps: 1 }, 1100);
  ok('"kept" only means something on a badge that was left alone: on a measure it is an odd answer, counted as unknown; on a resize it is nothing', O.snapshot(2000).delta[0].kept === 0 && O.snapshot(2000).delta[0].unknown === 2 && O.snapshot(2000).delta[0].resize === 1);
  const W = Perf.createMonitor({ now: () => 0 }); W.delta('a', { why: 'skip', how: 'kept' }, 1000);
  ok('the figures are for the last ten seconds: after that the kept ones are forgotten too', W.snapshot(20000).delta.length === 0);
  const Y = Perf.createMonitor({ now: () => 0 }); Y.delta('a', { why: 'skip', how: 'kept' }, 100); Y.reset(); Y.delta('a', { why: 'skip' }, 200);
  ok('when the window figures start again the kept ones are counted from nothing', Y.snapshot(300).delta[0].kept === 0 && Y.snapshot(300).delta[0].skipped === 1);
  ok('a report from an older snapshot (no kept in it) prints no clause and no "undefined"', (() => { const sn = K.snapshot(2000); delete sn.delta[0].kept; const t = Perf.report(sn, null, {}); return t.includes('6 left alone') && !t.includes('of them put') && !t.includes('undefined'); })());
}

// ---- 1.61.0: the database in the report ----
{ const DB = { file: { bytes: 147200000, saves: 12, lastMs: 913.46, maxMs: 1210.4, textMs: 402.2, fileMs: 511.3, failed: 0 }, settings: { bytes: 5120, writes: 9, lastMs: 1.84, maxMs: 6.2, failed: 0 }, tables: [{ name: 'drivers', bytes: 91000000 }, { name: 'laps', bytes: 41500000 }, { name: 'audioSets', bytes: 9300000 }, { name: 'cars', bytes: 800000 }, { name: 'tracks', bytes: 412000 }, { name: 'sixth', bytes: 1 }], total: 147200000 };
  const m = Perf.cleanMain({ database: DB }), rep = Perf.report(R0, m, {}), L = rep.split('\n'), at = re => L.findIndex(x => re.test(x)), has = (r, mm, re) => Perf.notes(r, mm).some(x => re.test(x));
  ok('1.61.0: the report tells the database file: its size, the saves since the start, the last, the time of the text and of the file, the slowest, the failed', rep.includes('Database file (1.61.0): 147.2 MB, 12 saved since the app started, last 913.5 ms (making the text 402.2, writing the file 511.3), slowest 1210.4 ms, 0 failed'));
  ok('...the settings file: size, written, last, slowest, failed', rep.includes('Settings file: 5.1 KB, 9 written, last 1.8 ms, slowest 6.2 ms, 0 failed'));
  ok('...and the biggest parts, five of them, counted (the sixth is left out)', rep.includes('Biggest parts of the database (counted, about): drivers 91 MB, laps 41.5 MB, audioSets 9.3 MB, cars 800 KB, tracks 412 KB') && !rep.includes('sixth'));
  ok('...in order, straight after the race save and before the notes', at(/^Race save:/) >= 0 && at(/^Database file/) === at(/^Race save:/) + 1 && at(/^Settings file/) === at(/^Race save:/) + 2 && at(/^Biggest parts/) === at(/^Race save:/) + 3 && at(/^Notes:/) > at(/^Biggest parts/));
  ok('...a database that saves in 150 ms or more is noted, with what it means and what is written apart', has(R0, m, /Saving the whole database \(147\.2 MB\) took up to 1210 ms.*Settings are written apart/) && has(R0, Perf.cleanMain({ database: { ...DB, file: { ...DB.file, maxMs: 150 } } }), /took up to 150 ms/) && !has(R0, Perf.cleanMain({ database: { ...DB, file: { ...DB.file, maxMs: 149 } } }), /whole database/));
  ok('...a save of the database that failed is noted, and so is a write of the settings file (each on its own)', has(R0, Perf.cleanMain({ database: { ...DB, file: { ...DB.file, failed: 2 } } }), /^2 save\(s\) of the database could not be written/) && !has(R0, Perf.cleanMain({ database: { ...DB, file: { ...DB.file, failed: 2 } } }), /settings file/) && has(R0, Perf.cleanMain({ database: { ...DB, settings: { ...DB.settings, failed: 3 } } }), /^3 write\(s\) of the settings file could not be done/) && !has(R0, m, /could not be/));
  const none = Perf.report(R0, Perf.cleanMain({}), {}), old = Perf.report(R0, Perf.cleanMain({ save: { writes: 3 } }), {});
  ok('...a core that tells nothing about the database (an older one, or an error) prints no line and no "undefined" or "NaN"', !none.includes('Database file') && !none.includes('Settings file') && !old.includes('Biggest parts') && !/undefined|NaN/.test(none + old + rep));
  const junk = Perf.cleanMain({ database: { file: { bytes: -5, saves: 'x', lastMs: NaN, maxMs: 1e99, textMs: null, fileMs: {}, failed: Infinity }, settings: 'no', tables: [null, 3, { name: 7, bytes: 1 }, { name: 'ok', bytes: 'big' }, { name: 'fine', bytes: 2048 }, { name: 'x'.repeat(200), bytes: 5 }], total: 'x' } });
  const jr = Perf.report(R0, junk, {});
  ok('...nonsense from the core is made safe: sizes clamp to what is possible, bad tables are left out, long names are cut', junk.database.has === true && junk.database.file.bytes === 0 && junk.database.file.saves === 0 && junk.database.file.maxMs <= 1e7 && junk.database.settings.bytes === 0 && junk.database.tables.length === 2 && junk.database.tables[0].name === 'fine' && junk.database.tables[1].name.length <= 40 && !/undefined|NaN|Infinity/.test(jr));
  ok('...cleanMain gives a database that has nothing in it when the core tells nothing', Perf.cleanMain({}).database.has === false && Perf.cleanMain({}).database.tables.length === 0);
  const tiny = Perf.report(R0, Perf.cleanMain({ database: { file: { bytes: 999000, saves: 1 }, settings: { bytes: 0 }, tables: [] } }), {});
  ok('...a size under a million is in KB, the line of the parts is left out when no table is told', tiny.includes('Database file (1.61.0): 999 KB') && !tiny.includes('Biggest parts'));
}

console.log(fails ? `\n${fails} FAILED` : '\nperf PASSED');
process.exit(fails ? 1 : 0);
