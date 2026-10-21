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
for (const f of ['listnum.js', 'bop.js', 'weather.js', 'tyrewear.js', 'safetycar.js', 'pushsave.js', 'racelimit.js', 'endurance.js', 'failures.js', 'damage.js', 'engine.js', 'heats.js', 'rotation.js', 'championship.js', 'champpoints.js', 'season.js', 'tokens.js', 'speed.js', 'distance.js','stats.js','homestats.js','carstats.js','viewset.js','picture.js','uiscale.js','depth.js','theme.js','banner.js', 'icons.js', 'delta.js','avatars.js', 'picmemo.js', 'weatherwidgets.js', 'tyrewidgets.js', 'pacewidgets.js', 'boardorder.js', 'widgets.js', 'frame.js', 'backdrop.js','announcer.js','sound.js', 'timing.js', 'rows.js', 'richtext.js', 'report.js', 'canvas.js', 'liveshare.js', 'review.js', 'adjustpad.js', 'adjustui.js', 'dirfolder.js', 'penaltyui.js', 'rotationdrag.js','padui.js','livegrid.js', 'homegrid.js', 'drivergrid.js', 'homecards.js', 'liveview.js', 'database.js', 'landing.js', 'race.js', 'undo.js', 'editor.js','tokenui.js', 'bopui.js', 'enduranceui.js', 'damageui.js', 'weatherui.js', 'tyreui.js', 'pushsaveui.js', 'rotationui.js', 'championshipui.js', 'audioedit.js','widgetbuilder.js','transferui.js','themeui.js','hardware.js','trackmate.js','hardwareui.js', 'dsui.js', 'app.js']) vm.runInContext(fs.readFileSync(R + 'renderer/' + f, 'utf8'), ctx, { filename: f });
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
  say('the race screen names the race and its distance', html().includes('Race on Long track') && html().includes('52 m'));
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

  // ---------- 1.62.0: a race limited by a time ----------
  {
    saved.length = 0;
    await openRace({ id: 'rt1', name: 'By the clock', sessionType: 'race', raceBy: 'time', duration: 0.05, laps: 20, distance: 52, layout: 'DL' }, meas, rows(1, 2));
    say('a Race limited by a time is raced as a Timed race: its minutes are the length, and the laps and the distance of the setup mean nothing', eng().type === 'timed' && eng().cfg.duration === 0.05 && !eng().distance && eng().limitOf(eng().cars[0]) === 0 && html().includes('Timed race on Long track') && html().includes('0.05 minutes') && !html().includes('52 m')); // (3 seconds: the race clock does not follow the test speed)
    say('...the Race Laps widget has no laps to count down, and the Race Info widget no laps left', !/\/20/.test(show('rl')) && !/laps? left/.test(show('inf')));
    key(' '); await until(() => phase() === 'running', 5000); await wait(60);
    await lapOn(0); await lapOn(0); await lapOn(1);
    say('while the time runs nobody has finished, whatever the laps', !eng().cars.some(c => c.done) && !eng().timeUp);
    await until(() => eng().timeUp, 8000);
    say('when the time is up the race goes on until every car has crossed the line', eng().timeUp === true && phase() === 'running');
    await lapOn(0); await lapOn(1);
    await until(() => phase() === 'finished', 6000); await wait(150); await until(() => saved.length > 0, 5000);
    const ss = saved[0] && saved[0][0];
    say('...that last lap counts: lane 1 has 3 laps and wins, lane 2 has 2, and the session is saved as a Timed race', !!ss && ss.sessionType === 'timed' && ss.standings[0].laps === 3 && ss.standings[1].laps === 2 && ss.standings[0].driverId === 'd1');
    run('state.race = null; live = null'); timers.forEach(clearInterval);
  }

  // ---------- 1.64.0: a race limited by a time, compared by distance ----------
  {
    const tsetup = over => ({ id: 'rc1', name: 'Clock', sessionType: 'race', raceBy: 'time', duration: 5, compareBy: 'distance', layout: 'DL', ...over });
    const home = async (setup, track) => {
      store.racesetups = [{ track: track.id, ...setup }]; store.tracks[0] = meas;
      run("state.settings.lastSetupId = '" + setup.id + "'; state.settings.assignments = " + JSON.stringify({ [setup.id]: [{ driverId: 'd1', carId: 'c1' }, { driverId: 'd2', carId: 'c2' }] }) + "; state.tab = 'home'; state.race = null; live = null");
      await run('render()'); await wait(30); return E('view').innerHTML.replace(/&quot;/g, '"');
    };
    let hh = await home(tsetup(), meas);
    say('Home: a time race compared by distance on a track with lane lengths has no problem, can be started, and its pill says "by distance"', !hh.includes('has no length') && hh.includes('id="start"') && !/id="start"[^>]*disabled/.test(hh) && hh.includes('<span class="hs-chip">5 min · by distance</span>'));
    hh = await home(tsetup({ compareBy: 'laps' }), meas);
    say('...compared by laps it says nothing of it', hh.includes('<span class="hs-chip">5 min</span>') && !hh.includes('by distance'));
    hh = await home(tsetup(), store.tracks[1]);
    say('on a track without a length the distance cannot be worked out: Home says so, with the way out, and the race can not start', hh.includes('The cars are compared by distance, so the lane lengths are needed. The track has no length. Add the track length in the Database.') && /id="start"[^>]*disabled/.test(hh));
    store.tracks[1] = { id: 'dn', name: 'No length', lanes: 2, laneModifier: 'measured', laneLengths: ', 10' };
    hh = await home(tsetup(), store.tracks[1]);
    say('...a lane without a length is named', hh.includes('The cars are compared by distance, so the lane lengths are needed. Lane 1 has no length. Add the lane lengths in the Database.') && !hh.includes('driver swaps are counted'));
    store.tracks[1] = { id: 'dn', name: 'No length', lanes: 2 };
    hh = await home(tsetup({ compareBy: 'laps' }), store.tracks[1]);
    say('a time race compared by laps on a track without a length is no problem (as before), and neither is an old setup without the setting', !hh.includes('has no length') && !/id="start"[^>]*disabled/.test(hh)
      && !(await home((({ compareBy, ...rest }) => rest)(tsetup()), store.tracks[1])).includes('has no length'));
    hh = await home({ id: 'rc1', name: 'Heats', sessionType: 'heats', heatBy: 'time', duration: 4, compareBy: 'distance', heatPlan: 'manual', heats: 2, layout: 'DL' }, meas);
    say('heats of a time compared by distance: the plan on Home says so', hh.includes('2 heats, each 4 minutes') && hh.includes('compared by the distance they drive'));
    hh = await home({ id: 'rc1', name: 'Heats', sessionType: 'heats', heatBy: 'time', duration: 4, heatPlan: 'manual', heats: 2, layout: 'DL' }, meas);
    say('...compared by laps it does not', hh.includes('2 heats, each 4 minutes') && !hh.includes('compared by the distance'));
    hh = await home({ id: 'rc1', name: 'Heats', sessionType: 'heats', heatBy: 'time', duration: 4, compareBy: 'laps', heatPlan: 'manual', heats: 2, layout: 'DL' }, meas);
    say('...also when the setting says laps', hh.includes('2 heats, each 4 minutes') && !hh.includes('compared by the distance'));
    run('state.race = null; live = null');

    // the race: lane 1 is 10 m, lane 2 is 10.5 m; both drive the same laps, lane 1 crosses the line first every time
    const drive = async () => {
      key(' '); await until(() => phase() === 'running', 5000); await wait(60);
      await lapOn(0); await lapOn(1); await lapOn(0); await lapOn(1);
      await until(() => eng().timeUp, 8000);
      await lapOn(0); await lapOn(1);
      await until(() => phase() === 'finished', 6000); await wait(150); await until(() => saved.length > 0, 5000);
    };
    saved.length = 0;
    await openRace({ id: 'rc1', name: 'Clock', sessionType: 'race', raceBy: 'time', duration: 0.05, compareBy: 'distance', layout: 'DL' }, meas, rows(1, 2));
    say('a time race compared by distance: the engine knows the lane lengths (10 m and 10.5 m), and the race header says it', !!eng().compare && eng().compare.by === 'distance' && eng().compare.lanes.map(l => l.length).join() === '10,10.5' && html().includes('compared by distance'));
    await drive();
    const ss = saved[0] && saved[0][0];
    say('...three laps each (30 m and 31.5 m): lane 2 wins although lane 1 crossed the line first every time, and the session is saved as a Timed race compared by distance', !!ss && ss.sessionType === 'timed' && ss.compareBy === 'distance'
      && ss.standings.map(x => x.driverId + ':' + x.laps).join() === 'd2:3,d1:3' && ss.standings[0].pos === 1);
    run('state.race = null; live = null'); timers.forEach(clearInterval);

    saved.length = 0;
    await openRace({ id: 'rc1', name: 'Clock', sessionType: 'race', raceBy: 'time', duration: 0.05, layout: 'DL' }, meas, rows(1, 2));
    say('the same race without the setting (an old setup) is compared by laps: no lane lengths in the engine, no note in the header', eng().compare === null && !html().includes('compared by distance'));
    await drive();
    const sl = saved[0] && saved[0][0];
    say('...with equal laps the lowest time wins: lane 1 crossed first every time (Alex first), and the session has no compare note', !!sl && sl.standings.map(x => x.driverId + ':' + x.laps).join() === 'd1:3,d2:3' && !('compareBy' in sl));
    run('state.race = null; live = null'); timers.forEach(clearInterval);

    saved.length = 0;
    await openRace({ id: 'rc1', name: 'Clock', sessionType: 'heats', heatBy: 'time', duration: 0.05, compareBy: 'distance', heatPlan: 'manual', heats: 1, layout: 'DL' }, meas, rows(1, 2));
    say('heats of a time compared by distance: the engine of the heat knows the lane lengths, and the header says it', !!eng().compare && eng().compare.lanes.map(l => l.length).join() === '10,10.5' && html().includes('compared by distance'));
    await drive();
    const sh = saved[0] && saved[0][0];
    say('...the heat is won by distance (lane 2), its row has the metres, and the saved session says it was compared by distance', !!sh && sh.compareBy === 'distance' && sh.heatResults[0].rows.map(r => r.pos + ':' + r.dist).join() === '1:31.5,2:30');
    run('state.race = null; live = null'); timers.forEach(clearInterval);
    store.tracks[0] = meas;
  }

  // ---------- 1.65.0: the scoring of heats of a time ----------
  {
    const hsetup = over => ({ id: 'hs1', name: 'Time heats', sessionType: 'heats', heatBy: 'time', duration: 0.05, compareBy: 'distance', resultByTime: 'lapstime', resultBy: 'laps', heatPlan: 'manual', heats: 1, layout: 'DL', ...over });
    const home = async setup => {
      store.racesetups = [{ track: 'dt', ...setup }]; store.tracks[0] = meas;
      run("state.settings.lastSetupId = '" + setup.id + "'; state.settings.assignments = " + JSON.stringify({ [setup.id]: [{ driverId: 'd1', carId: 'c1' }, { driverId: 'd2', carId: 'c2' }] }) + "; state.tab = 'home'; state.race = null; live = null");
      await run('render()'); await wait(30); return E('view').innerHTML.replace(/&quot;/g, '"');
    };
    let hh = await home(hsetup());
    say('Home: heats of a time counted by the most laps or the furthest distance, then the lowest total time say so (by distance when the cars are compared by distance)', hh.includes('the furthest total distance wins; with the same distance the lowest total time wins'));
    hh = await home(hsetup({ compareBy: 'laps' }));
    say('...by laps when they are compared by laps', hh.includes('the most laps wins; with the same laps the lowest total time wins') && !hh.includes('furthest total distance'));
    hh = await home(hsetup({ resultByTime: 'laps' }));
    say('...total laps (the old way) and points say nothing of it', !hh.includes('lowest total time wins') && !(await home(hsetup({ resultByTime: 'points', resultBy: 'points' }))).includes('lowest total time wins'));
    hh = await home((({ resultByTime, ...rest }) => ({ ...rest, resultBy: 'points' }))(hsetup()));
    say('...a setup from before 1.65.0 (no choice, points) is counted by points as it was: no sentence about laps and time', !hh.includes('lowest total time wins') && hh.includes('<'));
    run('state.race = null; live = null');

    const drive = async () => {
      key(' '); await until(() => phase() === 'running', 5000); await wait(60);
      await lapOn(0); await lapOn(1); await lapOn(0); await lapOn(1);
      await until(() => eng().timeUp, 8000);
      await lapOn(0); await lapOn(1);
      await until(() => phase() === 'finished', 6000); await wait(150); await until(() => saved.length > 0, 5000);
    };
    saved.length = 0;
    await openRace(hsetup(), meas, rows(1, 2));
    say('a heat of a time counted by distance on the race screen says above the result how it counts', html().includes('the furthest total distance wins; with the same distance the lowest total time wins'));
    const inLane = n => eng().cars.find(c => c.lane === n).driverId; // (who races in which lane of the heat is shuffled)
    const l1 = inLane(0), l2 = inLane(1);
    await drive();
    const ss = saved[0] && saved[0][0], o = ss && ss.standings;
    say('...both drove 3 laps (30 m on lane 1, 31.5 m on lane 2): the driver of lane 2 wins on the distance, the result is in metres with the total time, and it is saved with the result of the heats', !!ss && o.map(x => x.driverId + ':' + x.laps).join() === l2 + ':3,' + l1 + ':3' && o[0].measure === 'distance' && o[0].score === 31.5 && o[1].score === 30 && Number.isFinite(o[0].timeAll) && ss.resultBy === 'laps' && ss.scoring.lapsFirst === true && ss.scoring.byDistance === true);
    say('...and the overall table of the race screen shows it: 31.5 m and the time', /31\.5 m · \d/.test(E('overall').innerHTML) && /30\.0 m · \d/.test(E('overall').innerHTML));
    run('state.race = null; live = null'); timers.forEach(clearInterval);

    // the same in feet: the table of the race screen follows the unit of App Settings
    run('state.settings.distanceUnit = "ft"'); saved.length = 0;
    await openRace(hsetup(), meas, rows(1, 2));
    await drive();
    say('...and in feet when App Settings say so (103.3 ft and 98.4 ft)', /103\.3 ft · \d/.test(E('overall').innerHTML) && /98\.4 ft · \d/.test(E('overall').innerHTML) && !/ m · \d/.test(E('overall').innerHTML));
    run('state.settings.distanceUnit = "m"; state.race = null; live = null'); timers.forEach(clearInterval);

    saved.length = 0;
    await openRace(hsetup({ compareBy: 'laps' }), meas, rows(1, 2));
    const m1 = eng().cars.find(c => c.lane === 0).driverId, m2 = eng().cars.find(c => c.lane === 1).driverId;
    await drive();
    const sl = saved[0] && saved[0][0], ol = sl && sl.standings;
    say('compared by laps the same heat is won by the lowest time with the same laps: lane 1 crossed first every time, and the result says laps and time', !!sl && ol.map(x => x.driverId + ':' + x.laps).join() === m1 + ':3,' + m2 + ':3' && ol[0].score === 3 && !ol[0].measure && /3 laps · \d/.test(E('overall').innerHTML));
    run('state.race = null; live = null'); timers.forEach(clearInterval);

    // a final that is added to the heats: the metres of the final are saved with the result
    saved.length = 0;
    await openRace(hsetup({ finals: 'a', finalMode: 'added' }), meas, rows(1, 2));
    key(' '); await until(() => phase() === 'running', 5000); await wait(60);
    await lapOn(0); await lapOn(1); await until(() => eng().timeUp, 8000); await lapOn(0); await lapOn(1);
    await until(() => phase() === 'between', 6000);
    run("live.pickAction('random')"); key(' '); await until(() => phase() === 'running', 5000); await wait(60);
    await lapOn(0); await lapOn(1); await lapOn(0); await until(() => eng().timeUp, 8000); await lapOn(0); await lapOn(1);
    await until(() => phase() === 'finished', 6000); await wait(150); await until(() => saved.length > 0, 5000);
    const sf = saved[0] && saved[0][0], of = sf && sf.standings;
    say('a final A that is added to heats of a time counted by distance: each driver is saved with the metres of the heat and of the final, and the result is the sum', !!sf && of.length === 2 && of.every(x => x.measure === 'distance' && x.finalName === 'A' && Number.isFinite(x.finalDist) && x.finalDist > 0 && Number.isFinite(x.heatScore) && Math.abs(x.score - (x.heatScore + x.finalDist)) < 1e-9));
    say('...and the overall table shows the heat, the final and the total (x m + y m final = z m, then the time)', / m \+ [\d.]+ m final = [\d.]+ m · \d/.test(E('overall').innerHTML));
    run('state.race = null; live = null'); timers.forEach(clearInterval);

    saved.length = 0;
    await openRace(hsetup({ resultByTime: 'laps', compareBy: 'laps' }), meas, rows(1, 2));
    say('total laps (the old way): nothing is said about the lowest total time', !html().includes('lowest total time wins'));
    run('state.race = null; live = null'); timers.forEach(clearInterval);
    store.tracks[0] = meas;
  }

  // ---------- 1.66.0: sectors ----------
  {
    const stk = { id: 'sx', name: 'Sector track', lanes: 3, length: 10, sectors: 4, sectorNames: 'Start,Hairpin,,Back' };
    const ssetup = over => ({ id: 'sec1', name: 'Sectors', sessionType: 'race', raceBy: 'laps', laps: 3, endRule: 'leader', layout: 'DL', ...over });
    const review = () => E('review').innerHTML;
    const choose = (car, value) => E('review').onchange({ target: { closest: () => ({ dataset: { rvs: String(car) }, value: String(value) }) } });
    const click = (rv, dataset) => E('review').onclick({ target: { closest: () => ({ disabled: false, dataset: { rv, ...dataset } }) } });
    saved.length = 0;
    await openRace(ssetup(), stk, rows(1, 2, 3));
    say('a race on a track with sectors gets them in its settings (the track has 4, the third without a name)', eng().sectors && eng().sectors.count === 4 && eng().sectors.names.join() === 'Start,Hairpin,,Back');
    run('state.autoFinalize = false');
    key(' '); await until(() => phase() === 'running', 5000); await wait(60);
    await lapOn(0); await lapOn(1); await lapOn(2); await lapOn(0); await lapOn(1); await lapOn(2); await lapOn(0);
    await until(() => phase() === 'review', 6000); await wait(100);
    const who = i => eng().cars[i].driverName;
    say('the lead car finished the 3 laps and the others did not: the review is open, and only the cars that did not finish have the choice of a sector', phase() === 'review' && eng().cars[0].done && !eng().cars[1].done && !eng().cars[2].done && !review().includes('data-rvs="0"') && review().includes('data-rvs="1"') && review().includes('data-rvs="2"') && review().includes('Sector 2 \u00b7 Hairpin'));
    say('...with no sector chosen the second car to cross the line (lane 2) is second, as it always was', eng().standings().map(x => x.index).join() === '0,1,2');
    choose(2, 3);
    say('choosing a sector for the third car in the review puts it ahead of the second car, which has the same laps and no sector', eng().cars[2].sector === 3 && eng().standings().map(x => x.index).join() === '0,2,1' && /<option value="3" selected>/.test(review().split('data-rvs="2"')[1].split('</tr>')[0]));
    say('...and the review shows the new order: the third car is in place 2', (review().split('<tr><td>2</td>')[1] || '').split('</tr>')[0].includes(who(2)));
    choose(1, 3);
    say('...both in sector 3: arrows appear', review().includes('data-rv="sectormove"') && eng().sectorGroup(1).length === 2);
    say('...in the same order as they crossed the line to begin with (the second car first)', eng().standings().map(x => x.index).join() === '0,1,2');
    click('sectormove', { car: '2', dir: '-1' });
    say('...the arrow of the third car puts it ahead', eng().standings().map(x => x.index).join() === '0,2,1' && eng().cars[2].secOrder === 1);
    click('sectormove', { car: '2', dir: '1' });
    say('...and its arrow down puts it back', eng().standings().map(x => x.index).join() === '0,1,2');
    choose(1, 1);
    say('...a car that is moved to an earlier sector goes behind the car in the later one', eng().standings().map(x => x.index).join() === '0,2,1' && eng().cars[1].sector === 1);
    click('finalize', {});
    await until(() => saved.length > 0, 5000); await wait(100);
    const ss = saved[0] && saved[0][0], o = ss && ss.standings;
    say('Finalize saves the sector of the cars that did not finish with the result (the name of the sector when it has one), and the car that finished has none', !!ss && o.length === 3 && o[0].sector === undefined && o[1].driverId === 'd3' && o[1].sector === 3 && o[1].sectorName === undefined && o[2].driverId === 'd2' && o[2].sector === 1 && o[2].sectorName === 'Start');
    run('state.race = null; live = null'); timers.forEach(clearInterval);

    saved.length = 0;
    await openRace(ssetup(), { ...stk, sectors: 0 }, rows(1, 2, 3));
    run('state.autoFinalize = false');
    key(' '); await until(() => phase() === 'running', 5000); await wait(60);
    await lapOn(0); await lapOn(1); await lapOn(2); await lapOn(0); await lapOn(1); await lapOn(2); await lapOn(0);
    await until(() => phase() === 'review', 6000); await wait(100);
    say('a track without sectors: no choice in the review, nothing in the saved result', eng().sectors === null && !review().includes('data-rvs') && !review().includes('rv-secnote'));
    click('finalize', {}); await until(() => saved.length > 0, 5000); await wait(100);
    say('...and the saved result has no sector', saved[0][0].standings.every(x => x.sector === undefined && x.sectorName === undefined));
    run('state.race = null; live = null'); timers.forEach(clearInterval);
    store.tracks[0] = meas;
  }

  // ---------- 1.67.0: a leaderboard that counts over all heats ----------
  {
    const Dz = JSON.parse(run('JSON.stringify(Rows.defaultDesign())'));
    store.rowdesigns = [{ ...Dz, id: 'rd', name: 'Overall row', widgets: ['position', 'name', 'lap', 'bestlap', 'avglap', 'totaltime', 'gap'].map((t, i) => { const w = JSON.parse(run(`JSON.stringify(Widgets.newWidget('${t}', 0, ${10 + i * 100}, 5))`)); w.w = 95; w.h = 60; w.showTitle = false; return w; }) }];
    store.rowdesigns.push({ ...Dz, id: 'rdd', name: 'Overall distance', widgets: ['name', 'distance'].map((t, i) => { const w = JSON.parse(run(`JSON.stringify(Widgets.newWidget('${t}', 0, ${10 + i * 100}, 5))`)); w.w = 95; w.h = 60; w.showTitle = false; return w; }) });
    const lb = (id, opt) => ({ ...JSON.parse(run("JSON.stringify(Widgets.newWidget('leaderboard', null, 10, 10))")), id, opt });
    store.layouts = [{ ...layout, id: 'OV', name: 'Overall boards', widgets: [lb('lbAll', { countOver: 'all' }), lb('lbRow', { countOver: 'all', design: 'rd' }), lb('lbHeat', {}), lb('lbRowHeat', { design: 'rd' }), lb('lbDist', { countOver: 'all', design: 'rdd' })] }];
    const ptrack = { id: 'plain', name: 'Plain track', lanes: 2, length: 10, laneModifier: 'measured', laneLengths: '10, 12' };
    const oset = over => ({ id: 'hov', name: 'Overall heats', sessionType: 'heats', heatBy: 'laps', laps: 2, heatPlan: 'manual', heats: 2, resultBy: 'laps', layout: 'OV', ...over });
    const board = id => run('live.nodes').find(n => n.w.id === id).val.innerHTML;
    const text = h => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    // the total time of a car that is on track runs on with the clock, so two screens drawn a moment apart can differ in that column only
    const noTotal = t => t.replace(/(\d+ \S+ \d+ (?:[\d.]+|\u2013) (?:[\d.]+|\u2013)) [\d.]+/g, '$1 T');
    const click = (rv, dataset) => E('review').onclick({ target: { closest: () => ({ disabled: false, dataset: { rv, ...dataset } }) } });
    const viewerBoard = (opt, extra) => run(`(() => { const v = LiveShare.viewer(); v.feedStatic(${JSON.stringify(sent.stat)}); v.feedDynamic(${JSON.stringify(sent.dyn)}, performance.now()); const S = v.shared(performance.now()); return Timing.content({ type: 'leaderboard', opt: ${JSON.stringify(opt)} }, { ...S, rowDesigns: ${JSON.stringify(store.rowdesigns)} }).html; })()`);
    kept.snap = null;
    await openRace(oset(), ptrack, rows(1, 2, 3));
    run('state.autoFinalize = false');
    say('before the start the overall board lists every driver of the race, the heat board only the two cars of the first heat', ['Alex', 'Sam', 'Kim'].every(n => text(board('lbAll')).includes(n)) && !text(board('lbHeat')).includes(eng().cars.length === 2 ? ['Alex', 'Sam', 'Kim'].find(n => !eng().cars.some(c => c.driverName === n)) : 'xx'));
    say('...the static part of the live link carries who is who (3 drivers), and nothing from earlier heats yet', sent.stat.roster.length === 3 && sent.stat.roster[1].driverName === 'Sam' && Array.isArray(sent.stat.prior) && sent.stat.prior.length === 0);
    key(' '); await until(() => phase() === 'running', 5000); await wait(60);
    const ln = i => eng().cars[i].lane, nm = i => eng().cars[i].driverName, out1 = [0, 1, 2].map(i => ['Alex', 'Sam', 'Kim'][i]).filter(n => !eng().cars.some(c => c.driverName === n))[0];
    await lapOn(ln(0)); await lapOn(ln(1)); await lapOn(ln(0)); await lapOn(ln(1));
    await until(() => phase() === 'review', 6000); await wait(100);
    say('heat 1 is over and waits in the review: the overall board has all three drivers, the two who raced with 2 laps and the one who did not at the bottom, 2 laps behind', text(board('lbAll')).includes(out1) && text(board('lbAll')).endsWith('+2 laps') && text(board('lbAll')).indexOf(out1) > text(board('lbAll')).indexOf(nm(0)) && text(board('lbAll')).indexOf(out1) > text(board('lbAll')).indexOf(nm(1)));
    say('...the same drivers in a row design: place, name, laps, best lap, average lap, total time and the gap', /^1 \S+ 2 [\d.]+ [\d.]+ [\d.]+ 2 \S+ 2 [\d.]+ [\d.]+ [\d.]+ 3 \S+ 0 – – – \+2 laps$/.test(text(board('lbRow'))));
    say('...and the boards that are not set to count over all heats show the two cars of the heat only', !text(board('lbHeat')).includes(out1) && !text(board('lbRowHeat')).includes(out1));
    eng().adjust(1, { laps: 1 }); // (the Race Director gives the second car a lap in the review: 3 laps count)
    const lens = [10, 12], exp = eng().cars.map((c, i) => (c.laps.length + (i === 1 ? 1 : 0)) * lens[c.lane]); // (the metres that count: the laps times the length of the lane each car drove in; the heat plan is drawn by chance, so the lanes are read from the cars)
    click('finalize', {}); await until(() => phase() === 'between', 5000); await wait(250);
    say('heat 1 is finalized: the next heat gets the roster and what heat 1 left behind (both drivers, with 2 laps and 3 laps (a lap was added in the review), 2 valid lap times each and their best lap)', sent.stat.roster.length === 3 && sent.stat.prior.length === 2 && sent.stat.prior.map(x => x.laps).sort().join() === '2,3' && sent.stat.prior.every(x => x.valid.length === 2 && x.best > 0 && x.pts === 0));
    say('...what was left behind is rounded to milliseconds (the best lap and every lap time), and a heat by laps on a track with lane lengths has its metres (the laps that count times the length of the lane each car drove in)', sent.stat.prior.every(x => x.best === Math.round(x.best * 1000) / 1000 && x.valid.every(t => t === Math.round(t * 1000) / 1000)) && sent.stat.prior.map(x => x.dist).sort((a, b) => a - b).join() === [...exp].sort((a, b) => a - b).join() && exp[0] !== exp[1]);
    say('...the board between the heats is the one of the end of the heat: the same drivers in the same places with what they drove (the driver who did not race at the bottom, on the grid of heat 2 with nothing driven yet)', /^1 \S+ 3 [\d.]+ [\d.]+ [\d.]+ 2 \S+ 2 [\d.]+ [\d.]+ [\d.]+ \+1 lap 3 \S+ 0 \u2013 \u2013 0\.000 \+3 laps$/.test(text(board('lbRow'))));
    say('...a board with the distance adds up the metres of the two who raced (the car with the lap added first), nothing yet for the one who did not', new RegExp('^\\S+ ' + exp[1] + ' m \\S+ ' + exp[0] + ' m \\S+ 0 m$').test(text(board('lbDist'))));
    say('...the lap times that count are what the average and the median are made of: they are those of the cars of heat 1, in milliseconds', (() => { const m = new Map(sent.stat.prior.map(x => [x.p, x.valid])); return [...m.values()].every(v => v.every(t => t > 0 && t < 5000)); })());
    say('...the heat that is kept for a restart holds them too (memoBy: 2 drivers with their lap times)', !!kept.snap && !!kept.snap.heat && Array.isArray(kept.snap.heat.memoBy) && kept.snap.heat.memoBy.length === 2 && kept.snap.heat.memoBy.every(e => e[1].laps.length === 2 && e[1].n === 1));
    say('between the heats the overall board still shows all three drivers with what they did (3, 2 and 0 laps: 1 lap and 3 laps behind the leader)', text(board('lbAll')).includes(out1) && text(board('lbAll')).includes('+1 lap') && text(board('lbAll')).includes('+3 laps'));
    key(' '); await until(() => phase() === 'running', 8000); await wait(60);
    const third = ['Alex', 'Sam', 'Kim'].filter(n => eng().cars.some(c => c.driverName === n));
    await lapOn(ln(0)); await wait(60);
    const dyn = sent.dyn.heat;
    say('in heat 2 the order is that of the standing including the heat that runs: the live link carries it (a lap of the first car in heat 2 is counted at once)', Array.isArray(dyn.order) && dyn.order.length === 3 && dyn.ovBy === 'laps' && dyn.order.every(x => x[1] === null || Number.isFinite(x[1])));
    say('...the driver who raced heat 1 and has a lap in heat 2 now leads or follows with 3 laps, the others have their laps; the board and the live link agree', (() => { const t = text(board('lbAll')); return /3/.test(t) && t.split('+').length >= 2; })());
    say('another screen draws the same overall board from what the live link carries, classic and row design', viewerBoard({ countOver: 'all' }) === board('lbAll') && noTotal(text(viewerBoard({ countOver: 'all', design: 'rd' }))) === noTotal(text(board('lbRow'))));
    say('...and without the setting it draws the heat only, as before', viewerBoard({}) === board('lbHeat'));
    run('state.race = null; live = null'); timers.forEach(clearInterval);
    // heats of a time that compare by distance: the order counts metres (the car on the longer lane is ahead with fewer laps), and says so
    saved.length = 0;
    await openRace(oset({ id: 'hdt', name: 'Overall distance heats', heatBy: 'time', duration: 0.1, compareBy: 'distance', resultByTime: 'lapstime', resultBy: 'laps' }), { id: 'two', name: 'Two lengths', lanes: 2, length: 10, laneModifier: 'measured', laneLengths: '10, 14' }, rows(1, 2, 3));
    key(' '); await until(() => phase() === 'running', 5000); await wait(60);
    const pOf = lane => eng().cars.find(c => c.lane === lane).participant;
    await lapOn(0); await lapOn(0); await lapOn(0); await lapOn(0); await lapOn(1); await lapOn(1); await lapOn(1); await wait(150);
    say('heats of a time that compare by distance: the order is in metres (42 m on the lane of 14 m before 40 m on the lane of 10 m, though it has fewer laps), and the gap is told in metres', sent.dyn.heat.ovBy === 'distance' && sent.dyn.heat.order[0][0] === pOf(1) && sent.dyn.heat.order[0][1] === 42 && sent.dyn.heat.order[1][0] === pOf(0) && sent.dyn.heat.order[1][1] === 40);
    run('state.race = null; live = null'); timers.forEach(clearInterval);

    // heats scored by points on a track without lane lengths: the order counts the points of the heats that are done only (not the heat that is next), and no metres are told
    saved.length = 0;
    await openRace(oset({ id: 'hpt', name: 'Overall points', resultBy: 'points', points: '10, 8, 6' }), { id: 'nolen', name: 'No lengths', lanes: 2 }, rows(1, 2, 3));
    run('state.autoFinalize = false');
    key(' '); await until(() => phase() === 'running', 5000); await wait(60);
    await lapOn(ln(0)); await lapOn(ln(1)); await lapOn(ln(0)); await lapOn(ln(1));
    await until(() => phase() === 'review', 6000); await wait(100);
    say('heats scored by points: the order counts the places of the heat that runs now (10 and 8 points, the driver who is not racing 0), and it says that it counts points', sent.dyn.heat.ovBy === 'points' && sent.dyn.heat.order.map(x => x[1]).join() === '10,8,0');
    click('finalize', {}); await until(() => phase() === 'between', 5000); await wait(250);
    say('...between the heats the points are those of the heat that is done (10, 8 and 0), not those of the heat that is next', sent.dyn.heat.order.map(x => x[1]).join() === '10,8,0');
    say('...a track without lane lengths has no metres: the heats left behind tell none, and the Distance column is a dash for everybody', sent.stat.prior.length === 2 && sent.stat.prior.every(x => !('dist' in x)) && (text(board('lbDist')).match(/–/g) || []).length === 3);
    run('state.race = null; live = null'); timers.forEach(clearInterval);
  }

  // ---------- 1.67.0: the sector choice works in every heat ----------
  {
    const stk = { id: 'sx', name: 'Sector track', lanes: 3, length: 10, sectors: 4, sectorNames: 'Start,Hairpin,,Back' };
    const hs = { id: 'hsec', name: 'Sector heats', sessionType: 'heats', heatBy: 'laps', laps: 3, heatPlan: 'manual', heats: 2, endRule: 'leader', resultBy: 'laps', layout: 'DL' };
    const review = () => E('review').innerHTML;
    const choose = (car, value) => E('review').onchange({ target: { closest: () => ({ dataset: { rvs: String(car) }, value: String(value) }) } });
    const click = (rv, dataset) => E('review').onclick({ target: { closest: () => ({ disabled: false, dataset: { rv, ...dataset } }) } });
    saved.length = 0;
    await openRace(hs, stk, rows(1, 2, 3));
    run('state.autoFinalize = false');
    key(' '); await until(() => phase() === 'running', 5000); await wait(60);
    const ln = i => eng().cars[i].lane;
    for (let k = 0; k < 2; k++) { await lapOn(ln(0)); await lapOn(ln(1)); await lapOn(ln(2)); }
    await lapOn(ln(0));
    await until(() => phase() === 'review', 6000); await wait(100);
    say('heat 1 of a heat race on a track with sectors: the review has the choice of a sector for the two cars that did not finish, and not for the one that did', eng().cars[0].done && review().includes('data-rvs="1"') && review().includes('data-rvs="2"') && !review().includes('data-rvs="0"'));
    choose(2, 3);
    say('...a sector chosen in heat 1 puts that car ahead of the other one that is on the same laps (before the heat is finalized)', eng().cars[2].sector === 3 && eng().standings().map(x => x.index).join() === '0,2,1');
    const n1 = eng().cars[1].driverName, n2 = eng().cars[2].driverName;
    click('finalize', {});
    await until(() => phase() === 'between', 5000); await wait(150);
    key(' '); await until(() => phase() === 'running', 8000); await wait(60);
    say('...heat 2 starts clean: no car has a sector from heat 1', eng().cars.every(c => !c.sector));
    for (let k = 0; k < 2; k++) { await lapOn(ln(0)); await lapOn(ln(1)); await lapOn(ln(2)); }
    await lapOn(ln(0));
    await until(() => phase() === 'review', 6000); await wait(100);
    say('...and heat 2 has its own review with the choice of a sector for the cars that did not finish, with nothing chosen yet', eng().cars[0].done && review().includes('data-rvs="1"') && review().includes('data-rvs="2"') && !review().includes(' selected>Sector') && eng().cars.every(c => !c.sector));
    choose(1, 1);
    say('...a sector chosen in heat 2 belongs to that heat and to that car only', eng().cars[1].sector === 1 && !eng().cars[2].sector);
    click('finalize', {});
    await until(() => saved.length > 0, 8000); await wait(150);
    const sr = saved[0] && saved[0][0], hr = sr && sr.heatResults;
    const secs = h => h.rows.filter(r => r.sector !== undefined).map(r => r.driverName + ':' + r.sector).join();
    say('the saved race has both heats; the sector of heat 1 is in the row of heat 1 (the car it was chosen for), the one of heat 2 in heat 2', !!hr && hr.length === 2 && secs(hr[0]) === n2 + ':3' && secs(hr[1]) === n1 + ':1');
    run('state.race = null; live = null'); timers.forEach(clearInterval);
  }

  reachedEnd = true;
  console.log(fails ? fails + ' DISTANCE SCREEN TESTS FAILED' : 'ALL DISTANCE SCREEN TESTS PASSED'); process.exit(fails ? 1 : 0);
})();
