// 1.60.0: the Performance line on screen: the folder Performance in App Settings > General (the switch, the report, Copy report) and the line under the buttons of the race screen,
// against a stand-in for the app window (the frames come from a timer here, and the figures of the core of the app from a made-up answer).
const vm = require('vm'), fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..') + '/';
const schema = require(R + 'schema.js');
let fails = 0;
process.on('unhandledRejection', e => { console.log('UNHANDLED:', e.stack || e.message); process.exit(1); });
const mk = () => new Proxy({ innerHTML: '', style: {}, dataset: {}, hidden: false, value: '', checked: false, disabled: false, classList: { add() {}, remove() {}, toggle() {} } },
  { get: (t, k) => (k in t ? t[k] : () => mk()), set: (t, k, v) => { t[k] = v; return true; } });
const els = {}; const copied = [];
const iv = new Set(), raf = { calls: 0, cancelled: 0, last: null }; // (the timers that are running, and the frames the page asked for)
class PO { constructor(cb) { PO.last = this; this.cb = cb; this.observed = null; this.disconnected = false; } observe(o) { this.observed = o; } disconnect() { this.disconnected = true; } } // (the observer of long tasks)
const keyListeners = new Set(); const document = { addEventListener(t, f) { if (t === 'keydown') keyListeners.add(f); }, removeEventListener(t, f) { if (t === 'keydown') keyListeners.delete(f); }, querySelector: () => mk(), querySelectorAll: () => [mk(), mk(), mk()],
  getElementById: id => els[id] || (els[id] = mk()), documentElement: { dataset: {}, style: { setProperty() {} } }, body: { contains: () => true }, createElement: () => mk() };
const store = {
  tracks: [{ id: 't1', name: 'Living room', lanes: 2 }, { id: 't4', name: 'Big track', lanes: 4 }],
  drivers: [{ id: 'd1', name: 'Alex', nickname: 'Speedy', flag: 'NL' }, { id: 'd2', name: 'Sam' }, { id: 'd3', name: 'Kim' }, { id: 'd4', name: 'Lee' }],
  slotcars: [1, 2, 3, 4].map(i => ({ id: 'c' + i, brand: 'Car' + i, ...(i === 1 ? { tyreCompound: 'S' } : {}) })), racesetups: [], weathersystems: [], fuelrules: [{ id: 'f1', name: 'Standard', tank: 100, perLap: 2, rate: 10, empty: 'retire' }], layouts: [], rowdesigns: [], sessions: [], laps: []
};
const saved = [], added = [], updated = [];
const sent = { stat: null, dyn: null, n: 0, last: null, log: [], gaps: 0 }, cbs = { stat: [], dyn: [], cmd: [] }, cmds = []; // what the race window shares with other windows (as plain text, like the real link)
// like the app does: the messages of the race window are put together into the whole state (sent.dyn), which a window that opens late is given; sent.last is the last message as it was sent
const merge = (state, m) => vm.runInContext('LiveShare', ctx).applyDynamic(state, m);
const plain = d => { const x = { ...d }; delete x.seq; return x; }; // a whole state without a message number (what an older race window sends): always accepted
const api = { liveStatic: s => { sent.stat = JSON.parse(JSON.stringify(structuredClone(s))); sent.dyn = null; sent.last = null; }, livePush: d => { const m = JSON.parse(JSON.stringify(structuredClone(d))); sent.last = m; sent.log.push(m); sent.n++; const r = merge(sent.dyn, m); if (r.ok) { if (!r.stale) sent.dyn = r.state; } else { sent.dyn = null; sent.gaps++; } },
  liveGet: async () => JSON.parse(JSON.stringify({ stat: sent.stat, dyn: sent.dyn })), onLive: f => { cbs.dyn.push(f); return () => {}; }, onLiveStatic: f => { cbs.stat.push(f); return () => {}; }, liveOpen: async () => ({ second: true }), liveCommand: c => { cmds.push(c); cbs.cmd.forEach(f => f(JSON.parse(JSON.stringify(c)))); }, onCommand: f => { cbs.cmd.push(f); return () => { cbs.cmd = cbs.cmd.filter(x => x !== f); }; },
  schema: async () => schema, getSettings: async () => ({ theme: 'dark', rules: 'Be kind. No bumping.' }), setSettings: async p => ({ ...(ctx.__ready ? vm.runInContext('state.settings', ctx) : {}), ...p }), dbPath: async () => 'x',
  list: async e => JSON.parse(JSON.stringify(store[e] || [])), customFields: async () => [], linkedLaps: async () => 0,
  saveSession: async (s, l) => { saved.push([s, l]); }, add: async (e, rec) => { added.push([e, rec]); return {}; }, update: async (e, id, rec) => { updated.push([e, id, rec]); return {}; }, remove: async () => {} };
// the app reports a screen that could not be drawn with console.error: that is a failed test (unless the test expects it)
const appConsole = { ...console, expected: false, seen: 0, error: (...a) => { if (appConsole.expected) { appConsole.seen++; return; } console.log('FAIL the app reported an error: ' + a.map(x => (x && x.stack) || x).join(' ').slice(0, 300)); fails++; } };
// the real app passes everything through Electron's structured clone, which refuses a function ("An object could not be cloned"): every call of the app interface is checked the same way here
for (const k of Object.keys(api)) { const f = api[k]; if (typeof f === 'function') api[k] = (...x) => { x.forEach(v => { if (typeof v !== 'function') structuredClone(v); }); return f(...x); }; }
const ctx = vm.createContext({ document, api, console: appConsole, Intl, URL, Image: function () {}, confirm: () => true, alert() {}, setTimeout, clearTimeout, setInterval: (f, ms) => { const id = setInterval(f, ms); iv.add(id); return id; }, clearInterval: id => { iv.delete(id); clearInterval(id); }, performance, requestAnimationFrame: f => { raf.calls++; raf.last = f; return setTimeout(() => f(performance.now()), 16); }, cancelAnimationFrame: id => { raf.cancelled++; clearTimeout(id); }, PerformanceObserver: PO, navigator: { clipboard: { writeText: async t => { copied.push(t); } } } });
ctx.__ready = true; ctx.window = ctx; ctx.innerWidth = 1280; ctx.innerHeight = 720; ctx.devicePixelRatio = 1; let quietN = 0; ctx.Quiet = { skipped: () => (quietN += 50) }; ctx.addEventListener = () => {}; ctx.removeEventListener = () => {};
for (const f of ['listnum.js', 'bop.js', 'weather.js', 'tyrewear.js', 'safetycar.js', 'pushsave.js', 'endurance.js', 'failures.js', 'damage.js', 'engine.js', 'heats.js', 'rotation.js', 'championship.js', 'champpoints.js', 'tokens.js', 'speed.js', 'distance.js','stats.js','homestats.js','carstats.js','viewset.js','picture.js','uiscale.js','depth.js','theme.js','banner.js', 'icons.js', 'delta.js','avatars.js', 'weatherwidgets.js', 'tyrewidgets.js', 'pacewidgets.js', 'boardorder.js', 'widgets.js', 'frame.js', 'backdrop.js','announcer.js','sound.js', 'timing.js', 'rows.js', 'richtext.js', 'canvas.js', 'liveshare.js', 'review.js', 'adjustpad.js', 'adjustui.js', 'dirfolder.js', 'penaltyui.js', 'rotationdrag.js','padui.js','livegrid.js', 'homegrid.js', 'drivergrid.js', 'homecards.js', 'liveview.js', 'database.js', 'landing.js', 'perf.js', 'perfui.js', 'race.js', 'undo.js', 'editor.js','tokenui.js', 'bopui.js', 'damageui.js', 'weatherui.js', 'tyreui.js', 'pushsaveui.js', 'rotationui.js', 'championshipui.js', 'audioedit.js','widgetbuilder.js','transferui.js','themeui.js','hardware.js','trackmate.js','hardwareui.js', 'dsui.js', 'app.js']) vm.runInContext(fs.readFileSync(R + 'renderer/' + f, 'utf8'), ctx, { filename: f });
const run = s => vm.runInContext(s, ctx), E = id => document.getElementById(id);
const say = (m, c) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (cond, ms = 8000) => { for (let t = 0; t < ms && !cond(); t += 25) await wait(25); };
const key = k => run('live').key({ key: k, target: { matches: () => false }, preventDefault() {} });
const phase = () => run('live.phase');
const node = type => run('live.nodes').find(n => n.w.type === type);
const flagIs = name => { const h = node('flag').val.innerHTML; return h.includes('class="flagsvg"') && h.includes('aria-label="' + name + '"'); }; // the Race Flag widget draws a flag; its label names the state
const rows = (...ids) => ids.map(i => ({ driverId: 'd' + i, carId: 'c' + i }));
const openRace = async (setup, track, r, extra = {}) => { setup = { restartAfterRed: 'resume', ...setup }; run(`state.speed=40; state.race=${JSON.stringify({ setup, track, rows: r, ...extra })}; state.tab='race'`); await run('render()'); };const Wx_ = () => vm.runInContext('Wx', ctx), same_ = (a, b) => JSON.stringify(a) === JSON.stringify(b);



(async () => {
  await wait(50); run('state.autoFinalize = true');
  const P = () => vm.runInContext('PerfUI', ctx), Pf = () => vm.runInContext('Perf', ctx);
  store.safetycarsystems = []; store.penaltysystems = [{ id: 'p1', name: 'Points', timeRule: 'every', everyPoints: 5, everySeconds: 5 }];
  const setup = { id: 's-pf', name: 'Perf race', sessionType: 'race', laps: 100, layout: '', lightsMin: 0, lightsMax: 0, fuelRules: 'f1', penaltySystem: 'p1', endRule: 'all', pitHold: 0.1 };
  const place = el => { el.isConnected = true; el.parentElement = { getClientRects: () => [{}] }; return el; };
  // like the real page: when the page is drawn again the old elements are gone from it (disconnected) and new ones are made
  const fresh = () => { for (const id of ['perfout', 'perfline', 'perfcopy', 'perfmsg', 'perfswitch']) if (els[id]) { els[id].isConnected = false; delete els[id]; } };

  // ---------- App Settings > General > Performance ----------
  run("state.settings = { theme: 'dark' }; state.tab = 'settings'; state.settingsSub = 'general'"); await run('render()'); await wait(30);
  { const h = E('settingsbox').innerHTML, fg = h.slice(h.indexOf('data-folder="general:performance"'));
    say('the General page has the folder Performance, between Pictures and Database file', h.includes('data-folder="general:performance"') && h.indexOf('data-folder="general:pictures"') < h.indexOf('data-folder="general:performance"') && h.indexOf('data-folder="general:performance"') < h.indexOf('data-folder="general:data"'));
    say('...with the switch for the line on the race screen (off to begin with), the report, and the Copy report button', /<input id="perfswitch" type="checkbox">/.test(fg) && fg.includes('Show the Performance line on the race screen') && fg.includes('id="perfout"') && fg.includes('id="perfcopy"') && fg.includes('Copy report'));
    say('...and a hint that says what the line shows and that nothing is measured while it is off', fg.includes('Nothing is measured while it is off.') && fg.includes('whether the window is drawn by the graphics card or by the processor')); }
  { await E('perfswitch').onchange({ target: { checked: true } }); await wait(20);
    say('the switch is saved as a setting (perfLine), and the page is not drawn again for it (the report goes on)', run('state.settings.perfLine') === true && P().watching() === 1);
    await E('perfswitch').onchange({ target: { checked: false } }); await wait(20);
    say('...and switched off again', run('state.settings.perfLine') === false);
    run("state.settings.perfLine = true"); fresh(); await run('render()'); await wait(30);
    say('a saved switch is drawn as ticked', /<input id="perfswitch" type="checkbox" checked>/.test(E('settingsbox').innerHTML)); run("state.settings.perfLine = false"); }

  // the report: shown in the box while the folder is open, with the figures of the core of the app, and copied
  { api.perfStats = async () => ({ at: 1, metrics: [{ type: 'Tab', cpu: 14.2, memMB: 300 }, { type: 'GPU', cpu: 6.5, memMB: 100 }, { type: 'Browser', cpu: 3.1, memMB: 100 }], gpuStatus: { gpu_compositing: 'disabled_software', rasterization: 'disabled_software' }, gpuDevice: 'V3D 7.1', display: { width: 1920, height: 1080, scale: 1, count: 1 }, session: 'wayland', os: { platform: 'linux', arch: 'arm64', model: 'Raspberry Pi 5 Model B', cpus: 4, memoryMB: 8192, freeMB: 5000, load: [1, 1, 1] }, thermal: { tempC: 62.5, mhz: 2400, maxMhz: 2400 }, versions: { app: '1.60.0' }, lag: { max10: 14, max60: 40, all: 90 }, save: { writes: 3, lastMs: 3, maxMs: 9, failed: 0 } });
    fresh(); run("state.tab = 'home'"); run("state.tab = 'settings'"); await run('render()'); place(E('perfout')); await wait(1300);
    const t = E('perfout').textContent;
    say('the report is written in the box within a second, with the figures of the core of the app', typeof t === 'string' && t.startsWith('SlotForge Timing 1.60.0: performance report') && t.includes('Raspberry Pi 5 Model B') && t.includes('window drawn by SOFTWARE') && t.includes('CPU of the app (% of one core): total 24'));
    say('...it is only measured while somebody looks: one watcher while the box is there', P().watching() === 1);
    await E('perfcopy').onclick(); await wait(30);
    say('Copy report puts the report on the clipboard and says so', copied.length === 1 && copied[0].startsWith('SlotForge Timing 1.60.0') && E('perfmsg').textContent === 'Copied. Paste it in a message.');
    ctx.navigator.clipboard.writeText = async () => { throw new Error('no'); };
    await E('perfcopy').onclick(); await wait(30);
    say('...and when the clipboard is not allowed it says how to copy by hand', E('perfmsg').textContent.startsWith('Could not copy'));
    fresh(); await wait(1200);
    say('when the page is drawn again (the box is gone), the old report stops looking', P().watching() === 0);
    run("state.tab = 'home'"); run("state.tab = 'settings'"); await run('render()'); const po = place(E('perfout')); po.parentElement = { getClientRects: () => [] }; await wait(1200);
    say('a report in a folder that is closed is not watched (nothing is measured for it)', P().watching() === 0);
    po.parentElement = { getClientRects: () => [{}] }; await wait(1200);
    say('...and is watched when the folder is opened', P().watching() === 1); fresh(); await wait(1200); }
  { api.perfStats = async () => { throw new Error('gone'); }; fresh(); run("state.tab = 'home'"); run("state.tab = 'settings'"); await run('render()'); place(E('perfout')); await wait(1300);
    say('when the core of the app does not answer the report still comes, with the window figures and the way to say it', E('perfout').textContent.includes('The core of the app did not answer') && E('perfout').textContent.includes('Frames:'));
    fresh(); await wait(1200); delete api.perfStats; }

  // ---------- the line on the race screen ----------
  const openRace = async (extra = {}) => { run(`state.speed=40; state.race=${JSON.stringify({ setup, track: store.tracks[1], rows: rows(1, 2), ...extra })}; state.tab='race'`); await run('render()'); };
  run("state.settings = { theme: 'dark' }"); fresh(); await openRace(); place(E('perfline')); await wait(100);
  say('the line is not there when the switch is off: nothing is watched, nothing is timed, no stop function', P().watching() === 0 && run('typeof live.perfStop') === 'undefined' && P().monitor().snapshot().updateAvg === null);
  run("state.settings.perfLine = true"); run('live.shown()'); await wait(50);
  say('switched on, the line is made when the race screen is shown again, and one thing is watched', run('typeof live.perfStop') === 'function' && P().watching() === 1);
  api.perfStats = async () => ({ metrics: [{ type: 'Tab', cpu: 14.2 }, { type: 'GPU', cpu: 6.5 }, { type: 'Browser', cpu: 3.1 }], lag: { max10: 14 }, save: { writes: 3, lastMs: 3.4 } });
  run('live.perfStop()'); run('live.perfStop = null'); run('live.shown()'); place(E('perfline')); await wait(1400);
  { const t = E('perfline').textContent;
    say('after a second the line says the frames a second and the CPU of the app (and the stalls of the core, and the race save)', E('perfline').hidden === false && /\d+ frames\/s|measuring/.test(t) && t.includes('app CPU 24% (window 14, graphics 7, core 3)') && t.includes('core stalled up to 14 ms') && t.includes('race save 3.4 ms'));
    say('...with the time of a screen update (measured in the race screen while it is watched)', P().monitor().snapshot().updateAvg !== null && /screen update [0-9.]+ ms/.test(t) && P().monitor().snapshot().updateAvg < 50); }
  run("state.settings.perfLine = false"); run('live.shown()');
  say('switched off again: the line is hidden and nothing is watched any more', E('perfline').hidden === true && P().watching() === 0 && run('live.perfStop') === null);
  run("state.settings.perfLine = true"); run('live.shown()'); say('...and on again', P().watching() === 1);
  fresh(); await openRace({ rows: rows(1, 2, 3) }); place(E('perfline')); await wait(100);
  say('a new race takes the old line away first (one watcher, not two) and makes its own', P().watching() === 1 && run('typeof live.perfStop') === 'function');
  say('...and the figures about the race screen are given to the report (name, widgets, lanes)', P().race && P().race().name === 'Perf race' && P().race().widgets > 0 && P().race().lanes >= 2);
  run('live.perfStop()'); run('live.perfStop = null'); say('stopping the line stops the watching', P().watching() === 0);
  say('the Performance line on the race screen is in the page of the race (hidden to begin with)', fs.readFileSync(R + 'renderer/race.js', 'utf8').includes('<p id="perfline" class="muted perfline" hidden'));
  // a line that is not on the screen (the race is parked behind another tab) measures nothing
  { run('live.shown()'); const el = place(E('perfline')); el.parentElement = { getClientRects: () => [] }; await wait(1200);
    say('a line whose race screen is parked behind another tab is not watched', P().watching() === 0);
    el.parentElement = { getClientRects: () => [{}] }; await wait(1200);
    say('...and is watched again when the race screen is back', P().watching() === 1); run('live.perfStop()'); }


  // ---------- the watching itself, the timers, and the edges (found by breaking the code on purpose) ----------
  api.perfStats = async () => ({ metrics: [{ type: 'Tab', cpu: 10 }], lag: { max10: 3 }, save: { writes: 1, lastMs: 2 } });
  { P().watch()(); // (a clean start: what was measured before is forgotten)
    say('nothing is watched now, and so a time that is told is not kept', P().watching() === 0 && P().active() === false && (P().noteUpdate(7), P().monitor().snapshot().updateAvg === null));
    P().monitor().long(300, performance.now());
    const u1 = P().watch(), u2 = P().watch();
    say('a new watching starts clean: what was measured before is forgotten', P().monitor().snapshot().longCount === 0);
    say('...two watchers are two, with one observer of long tasks (long tasks only)', P().watching() === 2 && !!PO.last && PO.last.observed && PO.last.observed.entryTypes[0] === 'longtask' && P().active() === true);
    PO.last.cb({ getEntries: () => [{ duration: 120, startTime: performance.now() - 120 }] });
    say('...a long task the observer tells about is counted', P().monitor().snapshot().longCount === 1 && P().monitor().snapshot().longMax === 120);
    P().noteUpdate(7); say('...a time told while watched is kept', P().monitor().snapshot().updateAvg === 7);
    await wait(200); say('...the writes the page left out are taken from the guard (quiet.js) with every frame', P().monitor().snapshot().skipped > 0);
    const c0 = raf.cancelled, obs = PO.last;
    u1(); u1(); say('...stopping one watcher twice counts once (one is left)', P().watching() === 1 && obs.disconnected === false && raf.cancelled === c0);
    u2(); say('...the last one stopped: the frame that was asked for is cancelled and the observer is let go', P().watching() === 0 && raf.cancelled === c0 + 1 && obs.disconnected === true && P().active() === false);
    const c1 = raf.calls; raf.last(performance.now());
    say('...and a frame that still comes does not ask for the next one', raf.calls === c1);
    const u3 = P().watch(); say('...a new watcher starts again from nothing', P().watching() === 1 && PO.last !== obs); u3(); }

  { const el = place(mk()), before = iv.size, stop = P().line(el);
    say('the line has one timer and one watcher', iv.size === before + 1 && P().watching() === 1);
    el.isConnected = false; await wait(1200);
    say('...an element that is gone from the page stops it by itself (timer cleared, nothing watched, hidden)', iv.size === before && P().watching() === 0 && el.hidden === true);
    const el2 = place(mk()), st = P().line(el2); st();
    say('...stopping it takes its timer away, hides it and lets the watching go', iv.size === before && el2.hidden === true && P().watching() === 0);
    const out = place(mk()), pn = P().panel({ out, copy: mk(), msg: mk() });
    say('the report has one timer and one watcher', iv.size === before + 1 && P().watching() === 1);
    out.isConnected = false; await wait(1200);
    say('...a box that is gone from the page stops it by itself', iv.size === before && P().watching() === 0);
    const out2 = place(mk()), pn2 = P().panel({ out: out2 }); pn2();
    say('...stopping it takes its timer away and lets the watching go', iv.size === before && P().watching() === 0);
    const out3 = place(mk()), pn3 = P().panel({ out: out3 }); out3.parentElement = { getClientRects: () => [] }; await wait(1200);
    say('...a box in a folder that is closed is let go of but keeps its timer (the folder may open again)', P().watching() === 0 && iv.size === before + 1);
    pn3(); }

  { const slowCore = () => { const k = { inflight: 0, maxIn: 0, calls: 0 }; api.perfStats = () => new Promise(res => { k.calls++; k.inflight++; k.maxIn = Math.max(k.maxIn, k.inflight); setTimeout(() => { k.inflight--; res({ metrics: [], lag: {}, save: {} }); }, 2500); }); return k; };
    const k1 = slowCore(), el = place(mk()), stop = P().line(el); await wait(3300); stop();
    say('the line: a core that answers slowly (2.5 seconds) is not asked again before it answered (never two questions at once)', k1.maxIn === 1 && k1.calls === 2);
    await wait(2600);
    const k2 = slowCore(), out = place(mk()), pn = P().panel({ out }); await wait(3300); pn();
    say('...the report too', k2.maxIn === 1 && k2.calls === 2);
    await wait(2600); }

  { api.perfStats = async () => ({ metrics: [{ type: 'Tab', cpu: 10 }], lag: { max10: 3 }, save: { writes: 1, lastMs: 2 } });
    const out = place(mk()), pn = P().panel({ out }); await wait(150); pn();
    const t = out.textContent;
    say('the report tells the window (its size) and the race screen that is open (the name, the widgets, the lanes)', t.includes('Window: 1280 x 720') && /Race screen: Perf race, \d+ widgets, \d+ lanes/.test(t)); }

  { run("state.settings = { theme: 'dark', perfLine: true }"); fresh(); await openRace(); place(E('perfline')); await wait(50);
    say('a race screen with the switch on has its line (one watcher)', P().watching() === 1);
    const n0 = iv.size; run('live.shown()'); run('live.shown()'); run('live.shown()');
    say('showing the race screen again does not make another line: still one watcher and one timer', P().watching() === 1 && iv.size === n0);
    run('live.perfStop()'); run('live.perfStop = null'); }

  { const tags = fs.readFileSync(R + 'renderer/index.html', 'utf8').match(/<script src="[^"]+"><\/script>/g) || [], at = n => tags.findIndex(t => t.includes('"' + n + '"'));
    say('index.html loads perf.js and then perfui.js, before race.js and app.js (the race screen and the settings use them)', at('perf.js') > at('webapi.js') && at('perf.js') >= 0 && at('perfui.js') === at('perf.js') + 1 && at('perfui.js') < at('race.js') && at('race.js') < at('app.js')); }

  console.log(fails ? `\n${fails} FAILED` : '\nPERF SCREEN TESTS PASSED'); process.exit(fails ? 1 : 0);
})();
