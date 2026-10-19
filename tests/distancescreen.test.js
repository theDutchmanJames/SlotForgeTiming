const vm = require('vm'), fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..') + '/';
const schema = require(R + 'schema.js');
let fails = 0, reachedEnd = false;
process.on('exit', code => { if (code === 0 && !reachedEnd) { console.log('FAIL the test stopped before its end (something waited for ever)'); process.exitCode = 1; } });
process.on('unhandledRejection', e => { console.log('UNHANDLED:', e.stack || e.message); process.exit(1); });
// (the stand-in does not read html: when the whole editor is drawn again, the parts inside it are given the html that the real page would have, as the real page does)
const parts = ['ro-pool', 'ro-hold', 'ro-grid', 'ro-remarks', 'ro-names', 'ro-groups', 'ro-how', 'ro-genopts', 'ro-msg'];
const syncParts = html => parts.forEach(id => {
  const open = html.indexOf(`id="${id}"`); if (open < 0) return;
  const start = html.indexOf('>', open) + 1, tag = /<(\w+)/.exec(html.slice(html.lastIndexOf('<', open)))[1], re = new RegExp(`<(/?)${tag}\\b`, 'g'); re.lastIndex = start;
  let depth = 1, m, end = html.length; while ((m = re.exec(html))) { depth += m[1] ? -1 : 1; if (depth === 0) { end = m.index; break; } }
  const el = els[id] || (els[id] = mk()); el.innerHTML = html.slice(start, end); if (id === 'ro-msg') el.textContent = '';
});
const mk = id => new Proxy({ innerHTML: '', style: {}, dataset: {}, hidden: false, value: '', checked: false, disabled: false, classList: { add() {}, remove() {}, toggle() {} } },
  { get: (t, k) => (k in t ? t[k] : () => mk()), set: (t, k, v) => { t[k] = v; if (id === 'setupmgr' && k === 'innerHTML') syncParts(String(v)); return true; } });
const els = {};
const keyListeners = new Set(); const document = { addEventListener(t, f) { if (t === 'keydown') keyListeners.add(f); }, removeEventListener(t, f) { if (t === 'keydown') keyListeners.delete(f); }, querySelector: () => mk(), querySelectorAll: () => [mk(), mk(), mk()],
  getElementById: id => els[id] || (els[id] = mk(id)), documentElement: { dataset: {}, style: { setProperty() {} } }, body: { contains: () => true }, createElement: () => mk() };
const store = {
  tracks: [{ id: 't1', name: 'Living room', lanes: 2 }, { id: 't4', name: 'Big track', lanes: 4 }],
  drivers: [{ id: 'd1', name: 'Alex', nickname: 'Speedy', callsign: 'Alpha', flag: 'NL', avatar: 'av1' }, { id: 'd2', name: 'Sam' }, { id: 'd3', name: 'Kim' }, { id: 'd4', name: 'Lee' }],
  slotcars: [1, 2, 3, 4].map(i => ({ id: 'c' + i, brand: 'Car' + i, ...(i === 1 ? { tyreCompound: 'S' } : {}) })), racesetups: [], rotationsetups: [], teams: [], weathersystems: [], fuelrules: [{ id: 'f1', name: 'Standard', tank: 100, perLap: 2, rate: 10, empty: 'retire' }], layouts: [], rowdesigns: [], sessions: [], laps: []
};
const saved = [], writes = [];
const sent = { stat: null, dyn: null, n: 0, last: null, log: [], gaps: 0 }, cbs = { stat: [], dyn: [], cmd: [] }, cmds = []; // what the race window shares with other windows (as plain text, like the real link)
// like the app does: the messages of the race window are put together into the whole state (sent.dyn), which a window that opens late is given; sent.last is the last message as it was sent
const merge = (state, m) => vm.runInContext('LiveShare', ctx).applyDynamic(state, m);
const plain = d => { const x = { ...d }; delete x.seq; return x; }; // a whole state without a message number (what an older race window sends): always accepted
const api = { liveStatic: s => { sent.stat = JSON.parse(JSON.stringify(s)); sent.dyn = null; sent.last = null; }, livePush: d => { const m = JSON.parse(JSON.stringify(d)); sent.last = m; sent.log.push(m); sent.n++; const r = merge(sent.dyn, m); if (r.ok) { if (!r.stale) sent.dyn = r.state; } else { sent.dyn = null; sent.gaps++; } },
  liveGet: async () => JSON.parse(JSON.stringify({ stat: sent.stat, dyn: sent.dyn })), onLive: f => { cbs.dyn.push(f); return () => {}; }, onLiveStatic: f => { cbs.stat.push(f); return () => {}; }, liveOpen: async () => ({ second: true }), liveCommand: c => { cmds.push(c); cbs.cmd.forEach(f => f(JSON.parse(JSON.stringify(c)))); }, onCommand: f => { cbs.cmd.push(f); return () => { cbs.cmd = cbs.cmd.filter(x => x !== f); }; },
  schema: async () => schema, getSettings: async () => ({ theme: 'dark', rules: 'Be kind. No bumping.' }), setSettings: async p => ({ ...(ctx.__ready ? vm.runInContext('state.settings', ctx) : {}), ...p }), dbPath: async () => 'x',
  list: async e => JSON.parse(JSON.stringify(store[e] || [])), customFields: async () => [], linkedLaps: async () => 0,
  saveSession: async (s, l) => { saved.push([s, l]); },
  add: async (e, item) => { const row = { ...item, id: 'N' + (store[e].length + 1) }; store[e].push(row); writes.push(['add', e, JSON.parse(JSON.stringify(item))]); return row; },
  update: async (e, id, p) => { writes.push(['update', e, id, JSON.parse(JSON.stringify(p))]); const r = store[e].find(x => x.id === id); Object.assign(r, p); return r; },
  remove: async (e, id) => { writes.push(['remove', e, id]); store[e] = store[e].filter(x => x.id !== id); } };
// the file that keeps a race that is running (the main program writes it next to the database)
const kept = { snap: null, saves: 0, clears: 0 };
api.saveResume = async snap => { kept.snap = JSON.parse(JSON.stringify(snap)); kept.saves++; return true; }; api.getResume = async () => (kept.snap ? JSON.parse(JSON.stringify(kept.snap)) : null); api.clearResume = async () => { kept.snap = null; kept.clears++; return true; };
// the app reports a screen that could not be drawn with console.error: that is a failed test (unless the test expects it)
const appConsole = { ...console, expected: false, seen: 0, error: (...a) => { if (appConsole.expected) { appConsole.seen++; return; } console.log('FAIL the app reported an error: ' + a.map(x => (x && x.stack) || x).join(' ').slice(0, 300)); fails++; } };
// the real app passes everything through Electron's structured clone, which refuses a function ("An object could not be cloned"): every call of the app interface is checked the same way here
for (const k of Object.keys(api)) { const f = api[k]; if (typeof f === 'function') api[k] = (...x) => { x.forEach(v => { if (typeof v !== 'function') structuredClone(v); }); return f(...x); }; }
const timers = new Set(); // (every timer of the app: a race that is dropped by the test, without finishing, would keep its timer)
const ctx = vm.createContext({ document, api, console: appConsole, Intl, URL, Image: function () {}, confirm: () => true, alert() {}, setTimeout, clearTimeout, setInterval: (f, ms) => { const t = setInterval(f, ms); timers.add(t); return t; }, clearInterval, performance });
ctx.__ready = true; ctx.window = ctx; ctx.addEventListener = () => {}; ctx.removeEventListener = () => {};
for (const f of ['listnum.js', 'bop.js', 'weather.js', 'tyrewear.js', 'endurance.js', 'failures.js', 'damage.js', 'engine.js', 'heats.js', 'rotation.js', 'tokens.js', 'speed.js', 'distance.js','stats.js','homestats.js','carstats.js','viewset.js','picture.js','uiscale.js','depth.js','theme.js','banner.js', 'icons.js', 'delta.js','avatars.js', 'weatherwidgets.js', 'tyrewidgets.js', 'boardorder.js', 'widgets.js', 'frame.js', 'backdrop.js','announcer.js','sound.js', 'timing.js', 'rows.js', 'richtext.js', 'report.js', 'canvas.js', 'liveshare.js', 'review.js', 'adjustpad.js', 'adjustui.js', 'dirfolder.js', 'penaltyui.js', 'rotationdrag.js','padui.js','livegrid.js', 'homegrid.js', 'drivergrid.js', 'homecards.js', 'liveview.js', 'database.js', 'landing.js', 'race.js', 'undo.js', 'editor.js','tokenui.js', 'bopui.js', 'enduranceui.js', 'damageui.js', 'weatherui.js', 'tyreui.js', 'rotationui.js', 'audioedit.js','widgetbuilder.js','transferui.js','themeui.js','hardware.js','trackmate.js','hardwareui.js', 'dsui.js', 'app.js']) vm.runInContext(fs.readFileSync(R + 'renderer/' + f, 'utf8'), ctx, { filename: f });
const run = s => vm.runInContext(s, ctx), E = id => document.getElementById(id);
const say = (m, c) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (cond, ms = 8000) => { for (let t = 0; t < ms && !cond(); t += 25) await wait(25); };
const key = k => run('live').key({ key: k, target: { matches: () => false }, preventDefault() {} });
const phase = () => run('live.phase');
const node = type => run('live.nodes').find(n => n.w.type === type);
const flagIs = name => { const h = node('flag').val.innerHTML; return h.includes('class="flagsvg"') && h.includes('aria-label="' + name + '"'); }; // the Race Flag widget draws a flag; its label names the state
const rows = (...ids) => ids.map(i => ({ driverId: 'd' + i, carId: 'c' + i }));
const openRace = async (setup, track, r, extra = {}) => { setup = { restartAfterRed: 'resume', ...setup }; run(`state.speed=40; state.autoFinalize = true; state.race=${JSON.stringify({ setup, track, rows: r, ...extra })}; state.tab='race'`); await run('render()'); await wait(30); };
const eng = () => run('live.engine()'), same_ = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const nowMs = () => run('performance.now()');

const events = type => eng().events.filter(e => e.type === type);
const give = (lane, n) => E('dmpanel').onclick({ target: { closest: () => ({ disabled: false, dataset: { n: String(n) }, blur() {}, closest: () => ({ dataset: { lane: String(lane) } }) }) } });
const car = i => eng().cars[i];
const lookOf0 = i => eng().enLook(i, nowMs());
const view = () => run('Damage.view(live.engine(), [0, 1], performance.now(), live.phase)');


(async () => {
  await wait(50); ctx.__sent = sent;
  const meas = { id: 'dt', name: 'Long track', lanes: 2, length: 10.5, laneModifier: 'measured', laneLengths: '10, 10.5' }; // lanes of 10 m and 10.5 m
  store.tracks = [meas, { id: 'dn', name: 'No length', lanes: 2 }];
  const wd = (id, type, lane, i, opt = {}) => ({ ...JSON.parse(run(`JSON.stringify(Widgets.newWidget('${type}', ${lane}, 10, ${10 + 70 * i}))`)), id, opt });
  const layout = { ...JSON.parse(run('JSON.stringify(Widgets.defaultLayout())')), id: 'DL', name: 'Distance layout' };
  layout.widgets = [0, 1].flatMap(lane => [wd('dx' + lane, 'distance', lane, 0, { update: 'exact', decimals: '1' }), wd('ds' + lane, 'distance', lane, 1, {}), wd('dl' + lane, 'distleft', lane, 2, { update: 'exact', decimals: '1' }), wd('lt' + lane, 'lapstogo', lane, 3, {})])
    .concat([wd('rl', 'racelaps', null, 8), wd('inf', 'info', null, 9)]);
  store.layouts = [layout];
  const dsetup = over => ({ id: 'ds1', name: 'Sprint', sessionType: 'race', raceBy: 'distance', distance: 52, endRule: 'all', layout: 'DL', ...over });
  const lapOn = async lane => { key(String(lane + 1)); await wait(60); };
  const html = () => E('racehost').innerHTML;
  const show = id => run('live.nodes').find(n => n.w.id === id).val.innerHTML;

  // ---------- the Home tab ----------
  {
    const home = async (setup, track) => {
      store.racesetups = [{ track: track.id, ...setup }]; store.tracks[0] = meas;
      run("state.settings.lastSetupId = '" + setup.id + "'; state.settings.assignments = " + JSON.stringify({ [setup.id]: [{ driverId: 'd1', carId: 'c1' }, { driverId: 'd2', carId: 'c2' }] }) + "; state.tab = 'home'; state.race = null; live = null");
      await run('render()'); await wait(30); return E('view').innerHTML.replace(/&quot;/g, '"');
    };
    let hh = await home(dsetup(), meas);
    say('a race by distance on a track with lane lengths can be started: no problem is reported and Start race is not disabled', !hh.includes('has no length') && !hh.includes('no distance') && hh.includes('id="start"') && !/id="start"[^>]*disabled/.test(hh));
    hh = await home(dsetup(), store.tracks[1]);
    say('on a track without a length the laps cannot be worked out: Home says so, with the way out, and the race can not start', hh.includes('The track has no length, so the laps for the distance cannot be worked out. Add the track length in the Database.') && /id="start"[^>]*disabled/.test(hh));
    hh = await home(dsetup({ distanceMode: 'laps' }), store.tracks[1]);
    say('...also when the lanes drive the same number of laps (they come from the track length)', hh.includes('The track has no length, so the laps for the distance cannot be worked out.'));
    store.tracks[1] = { id: 'dn', name: 'No length', lanes: 2, laneModifier: 'measured', laneLengths: ', 10' };
    hh = await home(dsetup(), store.tracks[1]);
    say('a lane without a length is named', hh.includes('Lane 1 has no length, so the laps for the distance cannot be worked out. Add the lane lengths in the Database.'));
    store.tracks[1] = { id: 'dn', name: 'No length', lanes: 2 };
    hh = await home(dsetup({ distance: 0 }), meas);
    say('a setup with no distance says so', hh.includes('This race setup has no distance. Add it in Race Setup.') && /id="start"[^>]*disabled/.test(hh));
    hh = await home({ id: 'ds1', name: 'Laps', sessionType: 'race', laps: 5, layout: 'DL' }, store.tracks[1]);
    say('a race by laps on a track without a length is no problem (as before)', !hh.includes('has no length') && !/id="start"[^>]*disabled/.test(hh));
    hh = await home({ id: 'ds1', name: 'Heats', sessionType: 'heats', heatBy: 'distance', distance: 60, heatPlan: 'manual', heats: 2, layout: 'DL' }, meas);
    say('heats by distance: the plan on Home says how long a heat is', hh.includes('2 heats, each 60 m.'));
    run('state.settings.distanceUnit = "ft"'); await run('render()'); await wait(30); hh = E('view').innerHTML;
    say('...in feet when App Settings say so', hh.includes('2 heats, each 197 ft.')); run('delete state.settings.distanceUnit');
    run('state.race = null; live = null');
  }

  // ---------- the race ----------
  saved.length = 0;
  await openRace(dsetup(), meas, rows(1, 2));
  say('the race screen names the race and its distance', html().includes('Race by laps or distance on Long track') && html().includes('52 m'));
  say('every lane drives its own laps: lane 1 (10 m) 6 laps, lane 2 (10.5 m) 5 laps; the engine knows the distance settings', !!eng().distance && eng().distance.mode === 'same' && eng().limitOf(eng().cars[0]) === 6 && eng().limitOf(eng().cars[1]) === 5 && eng().type === 'race');
  say('before the start: nothing driven, the whole distance to go (60 m and 52.5 m), all the laps to go', show('dx0') === '0.0 m' && show('dx1') === '0.0 m' && show('dl0') === '60.0 m' && show('dl1') === '52.5 m' && show('lt0') === '6 laps to go' && show('lt1') === '5 laps to go');
  say('...the Race Laps and Race Info widgets know the laps of the leader\'s lane (lane 1 leads at the start: the laps of lane 1)', show('rl') === '1/6' && show('inf') === '6 laps left');
  key(' '); await until(() => phase() === 'running', 5000); await wait(60);
  await lapOn(0); await lapOn(1);
  say('after a lap each: 10.0 m and 10.5 m driven, 50.0 m and 42.0 m to go, and the laps to go 5 and 4 (the smooth distance is a little further on)', show('dx0') === '10.0 m' && show('dx1') === '10.5 m' && show('dl0') === '50.0 m' && show('dl1') === '42.0 m' && show('lt0') === '5 laps to go' && show('lt1') === '4 laps to go'
    && parseFloat(show('ds0')) >= 10 && /^\d+ m$/.test(show('ds0')));
  for (let n = 0; n < 4; n++) { await lapOn(0); await lapOn(1); }
  say('lane 2 has driven its 5 laps and has finished first (52.5 m), lane 1 still has a lap to drive (5 of 6)', eng().cars[1].done && !eng().cars[0].done && eng().cars[1].place === 1 && eng().cars[0].laps.length === 5);
  say('...its widgets say so: nothing to go and finished; the other lane is on its last lap, 10 m to go', show('dl1') === '0.0 m' && show('lt1') === 'Finished' && show('dx1') === '52.5 m' && show('lt0') === 'Last lap' && show('dl0') === '10.0 m');
  await lapOn(0); await until(() => phase() !== 'running', 5000); await wait(80);
  say('the race is over when lane 1 has finished too, 60 m driven; the first to finish ranks first (lane 2)', eng().status === 'finished' && eng().cars[0].done && eng().standings()[0].index === 1 && eng().standings()[1].index === 0 && show('dx0') === '60.0 m' && show('lt0') === 'Finished');
  await until(() => saved.length > 0, 5000);
  say('what is saved: a race, lane 2\'s driver first with 5 laps, lane 1\'s driver second with 6 laps', saved.length === 1 && saved[0][0].sessionType === 'race' && saved[0][0].standings[0].driverId === 'd2' && saved[0][0].standings[0].laps === 5 && saved[0][0].standings[1].driverId === 'd1' && saved[0][0].standings[1].laps === 6);
  run('state.race = null; live = null');

  // ---------- 1.36.0: the Driver stats grid has the distance cells (they show when the lane has a length) and laps to go ----------
  {
    await openRace(dsetup(), meas, rows(1, 2)); key(' '); await until(() => phase() === 'running', 5000); await wait(60); await lapOn(0);
    { const n0 = sent.n; await until(() => sent.n >= n0 + 2, 3000); } // (a page opened now shows what the race sent last: wait until the race has sent the lap)
    const host = document.createElement('div'); await run('LiveView.mount')(host, {}); await wait(50);
    const cellsOf = (...keys) => `{ cols: ${keys.length}, rows: 1, boards: [${keys.map((k, i) => `{ c: ${i + 1}, r: 1, w: 1, h: 1, opt: { cell: '${k}', label: true } }`).join(',')}] }`;
    run('state.settings.driverGrid = ' + cellsOf('distance', 'distleft', 'lapstogo')); run('LiveView.go')('driver');
    const h = () => E('lv-dstats').innerHTML, v = k => (new RegExp(`data-cell="${k}"[^>]*><span[^>]*>[^<]*</span><strong>([^<]*)</strong>`).exec(h()) || [])[1], quiet = () => (h().match(/lv-dg quiet/g) || []).length;
    say('the Driver stats page of a race by distance on a track with lane lengths has the distance driven, the distance to go and the laps to go of the lane (lane 1: a lap of its 6 driven, 5 to go)', /^\d+(\.\d)? m$/.test(v('distance')) && parseFloat(v('distance')) >= 10 && /^\d+(\.\d)? m$/.test(v('distleft')) && parseFloat(v('distleft')) <= 50.5 && v('lapstogo') === '5' && quiet() === 0);
    run('LiveView.unmount')(); key('s'); await wait(30); run('state.race = null; live = null');
    await openRace({ id: 'nl', name: 'Laps', sessionType: 'race', laps: 5, layout: 'DL' }, store.tracks[1], rows(1, 2));
    const h2 = document.createElement('div'); await run('LiveView.mount')(h2, {}); await wait(50); run('state.settings.driverGrid = ' + cellsOf('distance', 'distleft', 'lapstogo')); run('LiveView.go')('driver'); await wait(80);
    say('...on a track without a length the distance cells have nothing to show and are blank (the laps to go still show: the race has 5 laps)', h().includes('data-cell="lapstogo"') && !h().includes('data-cell="distance"') && !h().includes('data-cell="distleft"') && quiet() === 2 && v('lapstogo') === '5');
    run('LiveView.unmount')(); key('s'); await wait(30); run('state.race = null; live = null');
    await openRace({ id: 'pr', name: 'Practice', sessionType: 'practice', layout: 'DL' }, store.tracks[1], rows(1, 2));
    const h3 = document.createElement('div'); await run('LiveView.mount')(h3, {}); await wait(50); run('state.settings.driverGrid = ' + cellsOf('position', 'lapstogo')); run('LiveView.go')('driver'); await wait(80);
    say('...and in free practice (no number of laps) the laps to go have nothing to show either', h().includes('data-cell="position"') && !h().includes('data-cell="lapstogo"') && quiet() === 1);
    run('LiveView.unmount')(); run('state.settings.driverGrid = undefined'); key('s'); await wait(30); run('state.race = null; live = null'); saved.length = 0;
  }

  // ---------- heats by distance: the lane of the car in the heat decides its laps ----------
  await openRace({ ...dsetup(), sessionType: 'heats', heatBy: 'distance', heatPlan: 'manual', heats: 1, resultBy: 'time' }, meas, rows(1, 2));
  say('a heat race by distance: the heat is a race by distance, every car with the laps of its lane (whichever lane the plan gives it: lane 1 6 laps, lane 2 5 laps), and the header says the distance of a heat', eng().type === 'race' && eng().cars.length === 2 && eng().cars.every(c => eng().limitOf(c) === (c.lane === 0 ? 6 : 5)) && new Set(eng().cars.map(c => c.lane)).size === 2 && html().includes('1 heats, each 52 m'));
  run('state.race = null; live = null');

  // ---------- the final of a heat race by distance has a distance of its own ----------
  await openRace({ ...dsetup(), sessionType: 'heats', heatBy: 'distance', heatPlan: 'manual', heats: 1, finals: 'a', finalDistance: 30, resultBy: 'time' }, meas, rows(1, 2));
  const heatLimits = eng().cars.map(c => [c.lane, eng().limitOf(c)]).sort((a, b) => a[0] - b[0]);
  say('the heat drives the distance of the setup (52 m: 6 laps on lane 1, 5 laps on lane 2)', same_(heatLimits, [[0, 6], [1, 5]]) && eng().distance.distance === 52);
  key(' '); await until(() => phase() === 'running', 5000); await wait(60);
  for (let n = 0; n < 8; n++) for (const c of eng().cars) if (!c.done) { key(String(c.lane + 1)); await wait(60); }
  await until(() => phase() !== 'running', 5000); await wait(100);
  say('...and the race waits for the final when the heat is over', phase() === 'between');
  say('the final A is a race by distance of its own length: 30 m, so 3 laps on lane 1 (30 m) and 3 laps on lane 2 (31.5 m)', run("live.pickAction('random')") === true && (key(' '), await until(() => phase() === 'running', 5000), eng().distance.distance === 30
    && same_(eng().cars.map(c => [c.lane, eng().limitOf(c)]).sort((a, b) => a[0] - b[0]), [[0, 3], [1, 3]]) && same_(eng().distance.lanes.map(l => l.asked), [30, 30])));
  run('state.race = null; live = null');

  // ---------- an Endurance Race by distance ----------
  store.teams = [{ id: 'T1', name: 'Red Bulls', drivers: ['d1', 'd2'] }, { id: 'T2', name: 'Blue Moons', drivers: ['d3', 'd4'] }];
  await openRace({ id: 'es1', name: 'Day race', sessionType: 'endurance', enduranceBy: 'distance', distance: 104, distanceMode: 'same', endRule: 'all', swapUnit: 'laps', swapMode: 'every', swapEvery: 5, layout: 'DL' }, meas, [{ teamId: 'T1', carId: 'c1', driverId: 'd1' }, { teamId: 'T2', carId: 'c2', driverId: 'd3' }]);
  say('an Endurance Race set to a distance is a race by distance with swaps: 11 laps on lane 1 (110 m), 10 laps on lane 2 (105 m); the swap rules are there too', !!eng().distance && eng().limitOf(eng().cars[0]) === 11 && eng().limitOf(eng().cars[1]) === 10 && !!eng().endurance && eng().cars.every(c => c.en) && html().includes('104 m'));
  run('state.race = null; live = null'); timers.forEach(clearInterval); // (a race that is not finished has its timer running)

  // ---------- an Endurance Race with the swaps counted in distance (1.35.1) ----------
  {
    timers.forEach(clearInterval);
    const sl = { ...JSON.parse(run('JSON.stringify(Widgets.defaultLayout())')), id: 'SL', name: 'Swap layout' };
    sl.widgets = [0, 1].flatMap(lane => [wd('st' + lane, 'swaptimer', lane, 0, {}), wd('sg' + lane, 'swapsignal', lane, 1, {}), wd('cd' + lane, 'currentdriver', lane, 2, {})]);
    store.layouts = [layout, sl];
    const ssetup = over => ({ id: 'sw1', name: 'Swap race', sessionType: 'endurance', enduranceBy: 'laps', laps: 6, endRule: 'all', swapUnit: 'distance', swapMode: 'every', swapEveryDist: 20, swapWarnDist: 5, swapWhere: 'line', swapConfirm: 'button', swapNext: 'order', swapGrace: 30, swapLate: 'count', layout: 'SL', ...over });
    const asg = [{ teamId: 'T1', carId: 'c1', driverId: 'd1' }, { teamId: 'T2', carId: 'c2', driverId: 'd3' }];
    const home2 = async (setup, track) => {
      store.racesetups = [{ track: track.id, ...setup }]; store.tracks[0] = meas;
      run('state.settings.homeGrid = ' + JSON.stringify({ cols: 4, rows: 3, boards: [{ c: 1, r: 1, w: 2, h: 1, opt: { card: 'start' } }, { c: 3, r: 1, w: 2, h: 2, opt: { card: 'rules' } }] }) + ';'); run("state.settings.lastSetupId = '" + setup.id + "'; state.settings.assignments = " + JSON.stringify({ [setup.id]: asg }) + "; state.tab = 'home'; state.race = null; live = null");
      await run('render()'); await wait(30); return E('view').innerHTML.replace(/&quot;/g, '"');
    };
    const rules = () => E('hmc-rules').innerHTML.replace(/&quot;/g, '"');
    let hh = await home2(ssetup(), meas);
    say('Home: an Endurance Race with swaps counted in distance on a track with lane lengths has no problem, and the rules say the swaps', !hh.includes('lane lengths are needed') && rules().includes('<span class="muted">Driver swaps</span><strong>Every 20 m, at the line</strong>'));
    hh = await home2(ssetup(), store.tracks[1]);
    say('...on a track without lane lengths Home says the lengths are needed, with the way out', hh.includes('The driver swaps are counted in distance, so the lane lengths are needed. The track has no length. Add the track length in the Database.') && /id="start"[^>]*disabled/.test(hh));
    hh = await home2(ssetup({ swapUnit: 'laps', swapEvery: 2 }), store.tracks[1]);
    say('...swaps counted in laps need no lengths', !hh.includes('lane lengths are needed'));
    hh = await home2(ssetup({ swapWhere: 'anywhere' }), meas);
    say('...anywhere on the track is told too', rules().includes('<strong>Every 20 m, anywhere on the track</strong>'));
    run("state.settings.distanceUnit = 'ft'"); hh = await home2(ssetup({ swapEveryDist: 15.24 }), meas);
    say('...in feet when App Settings say so', rules().includes('<strong>Every 50 ft, at the line</strong>')); run('delete state.settings.distanceUnit');
    run('delete state.settings.homeGrid');

    const n0 = saved.length;
    await openRace(ssetup(), meas, [{ teamId: 'T1', carId: 'c1', driverId: 'd1' }, { teamId: 'T2', carId: 'c2', driverId: 'd3' }]);
    say('the race has the swaps in distance: the rules are in metres, every car knows the length of its lane, and the race header says the swaps', eng().endurance.unit === 'distance' && eng().endurance.every === 20 && eng().endurance.where === 'line' && same_(eng().cfg.laneLengths, [10, 10.5]) && eng().cars.every(c => c.en) && html().includes('6 laps, a swap every 20 m at the line'));
    key(' '); await until(() => phase() === 'running', 5000); await wait(60);
    say('...nothing is driven, so the Swap Timer counts the whole 20 m and the Swap Signal is quiet', show('st0') === 'Swap in 20 m' && show('sg0') === '' && show('sg1') === '' && show('cd0').includes('Alex'));
    await lapOn(0); await lapOn(1);
    say('after a lap each (10 m and 10.5 m): 10 m and 9.5 m to go', show('st0') === 'Swap in 10 m' && show('st1') === 'Swap in 9.5 m' && show('sg0') === '' && lookOf0(0).dist === 10 && lookOf0(1).dist === 10.5);
    await lapOn(0);
    say('after the second lap of lane 1 (20 m) the swap is due: the Swap Timer and the Swap Signal say so, with who comes out and who steps in, and the other lane is not touched', show('st0') === 'SWAP NOW' && show('sg0').includes('<b>SWAP</b>') && show('sg0').includes('Alex → Sam') && show('sg1') === '' && events('swapdue').length === 1 && events('swapdue')[0].car === 0 && events('swapdue')[0].why === 'interval');
    say('...nobody has been swapped yet: Alex is at the wheel, and the signal stays', eng().cars[0].driverName === 'Alex' && show('sg0').includes('SWAP'));
    api.liveCommand({ type: 'swap', lane: 0 }); await wait(80);
    say('Swap done: Sam is at the wheel, the stint of Alex was 20 m, the signal goes, and the next swap is 20 m further on', eng().cars[0].driverName === 'Sam' && events('swapdone')[0].stintM === 20 && show('sg0') === '' && show('st0') === 'Swap in 20 m' && show('cd0').includes('Sam'));
    for (let n = 0; n < 4; n++) await lapOn(0);
    say('...Sam drives the 4 laps left (40 m): his swap was due at 20 m again and is waiting for a button', show('sg0').includes('Sam → Alex') && lookOf0(0).stintM === 40);
    await lapOn(1); await lapOn(1); // lane 2 has driven 3 laps (31.5 m): Kim swaps for Lee, who drives 2 laps (21 m), then Kim drives the last lap (10.5 m)
    api.liveCommand({ type: 'swap', lane: 1 }); await wait(80);
    await lapOn(1); await lapOn(1);
    say('...a stint of 2 laps of 10.5 m is 21 m, and the swap of the other lane was made at 31.5 m', eng().cars[1].driverName === 'Lee' && lookOf0(1).stintM === 21 && events('swapdone').filter(e => e.car === 1)[0].stintM === 31.5);
    api.liveCommand({ type: 'swap', lane: 1 }); await wait(80);
    await lapOn(1);
    await until(() => phase() === 'finished', 5000); await wait(150);
    await until(() => saved.length > n0, 5000);
    const s2 = saved[n0] && saved[n0][0], red = s2 && s2.standings.find(x => x.teamId === 'T1'), blue = s2 && s2.standings.find(x => x.teamId === 'T2');
    say('what is saved: Red Bulls have Alex with 20 m (2 laps) and Sam with 40 m (4 laps), the stints name their metres, and Blue Moons have Kim with 31.5 + 10.5 = 42 m (4 laps) and Lee with 21 m (2 laps)', !!red && red.drivers.map(d => d.driverId + ':' + d.laps + ':' + d.meters).join() === 'd1:2:20,d2:4:40' && red.stints.map(q => q.driverId + ':' + q.meters).join() === 'd1:20,d2:40' && blue.drivers.map(d => d.driverId + ':' + d.laps + ':' + d.meters).join() === 'd3:4:42,d4:2:21' && blue.stints.map(q => q.driverId + ':' + q.meters).join() === 'd3:31.5,d4:21,d3:10.5' && s2.setupName === 'Swap race');
    run('state.race = null; live = null'); timers.forEach(clearInterval);

    // the distances in feet when App Settings say so: the header of the race and the Swap Timer
    run("state.settings.distanceUnit = 'ft'");
    await openRace(ssetup({ swapEveryDist: 15.24 }), meas, [{ teamId: 'T1', carId: 'c1', driverId: 'd1' }, { teamId: 'T2', carId: 'c2', driverId: 'd3' }]);
    key(' '); await until(() => phase() === 'running', 5000); await wait(60);
    say('in feet: the race says "a swap every 50 ft at the line" and the Swap Timer counts in feet (15.24 m is 50 ft)', html().includes('6 laps, a swap every 50 ft at the line') && eng().endurance.disp === 'ft' && show('st0') === 'Swap in 50 ft');
    await lapOn(0);
    say('...after a lap of 10 m, 36 ft to go', show('st0') === 'Swap in 17.2 ft'.replace('17.2', String(Math.round((15.24 - 10) / 0.3048 * 10) / 10)));
    run('delete state.settings.distanceUnit; state.race = null; live = null'); timers.forEach(clearInterval);

    // one message for a track without a length, not two, when the race is by distance as well
    hh = await home2(ssetup({ enduranceBy: 'distance', distance: 104 }), store.tracks[1]);
    say('Home: an Endurance Race by distance with swaps in distance on a track without a length says it once', (hh.match(/The track has no length/g) || []).length === 1 && !hh.includes('lane lengths are needed'));

    // a heat-based Endurance Race: every heat swaps by distance, and the result of each team has the metres of every driver and of every stint
    const plan2 = [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }], [{ p: 0, lane: 0 }, { p: 1, lane: 1 }]];
    saved.length = 0;
    await openRace(ssetup({ enduranceBy: 'heats', heatBy: 'laps', laps: 4, heatPlan: 'manual', heats: 2, resultBy: 'laps', teamDriver: 'order' }), meas, [{ teamId: 'T1', carId: 'c1' }, { teamId: 'T2', carId: 'c2' }], { byTeam: true, schedule: plan2 });
    key(' '); await until(() => phase() === 'running', 5000); await wait(60);
    await lapOn(0); await lapOn(0);
    say('heat 1: the swap is due after 20 m (2 laps of 10 m)', lookOf0(0).state === 'due' && lookOf0(0).dist === 20);
    api.liveCommand({ type: 'swap', lane: 0 }); await wait(80);
    for (let n = 0; n < 2; n++) await lapOn(0);
    for (let n = 0; n < 4; n++) await lapOn(1);
    await until(() => phase() === 'between', 6000);
    say('...the heat ends, the next heat starts from nothing (the distance of the new cars is 0)', phase() === 'between' && eng().cars.every(c => c.en && c.en.stints.length === 1));
    key(' '); await until(() => phase() === 'running', 5000); await wait(60);
    for (let n = 0; n < 4; n++) { await lapOn(0); await lapOn(1); }
    await until(() => phase() === 'finished', 6000); await wait(150);
    await until(() => saved.length > 0, 5000);
    const hs = saved[0] && saved[0][0], hred = hs && hs.standings.find(x => x.teamId === 'T1');
    say('the heats are saved with the metres: Red Bulls drove Alex 20 m + 40 m (heat 2: no swap) = 60 m and Sam 20 m, in stints of 20, 20 and 40 m', !!hred && hred.drivers.map(d => d.driverId + ':' + d.meters).join() === 'd1:60,d2:20' && hred.stints.map(q => q.heat + ':' + q.driverId + ':' + q.meters).join() === '1:d1:20,1:d2:20,2:d1:40');
    run('state.race = null; live = null'); timers.forEach(clearInterval);
  }

  reachedEnd = true;
  console.log(fails ? fails + ' DISTANCE SCREEN TESTS FAILED' : 'ALL DISTANCE SCREEN TESTS PASSED'); process.exit(fails ? 1 : 0);
})();
