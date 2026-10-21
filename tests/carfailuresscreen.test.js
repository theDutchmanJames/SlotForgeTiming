// 1.44.0: Car Failures, release 2, on screen: the folder and panel of the race screen (Give and Clear), the Race Director commands, a car that a failure retired and the Race Director brings back,
// the failures in the saved results, what is shared with other windows, against a stand-in for the app window.
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
const ctx = vm.createContext({ document, api, console: appConsole, Intl, URL, Image: function () {}, confirm: () => true, alert() {}, setTimeout, clearTimeout, setInterval, clearInterval, performance });
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
const car = i => eng().cars[i];
// the buttons of the Car Failures panel, as a finger would press them: Give (with the failure that is chosen in the list of the lane) and Clear
const fl = (lane, what, k = -1) => E('flpanel').onclick({ target: { closest: () => ({ disabled: false, dataset: { fl: what }, blur() {}, closest: () => ({ dataset: { lane: String(lane) }, querySelector: () => ({ value: String(k) }) }) }) } });
const view = () => run('Failures.view(live.engine(), [0, 1], performance.now(), live.phase)');

(async () => {
  await wait(50); ctx.__sent = sent;
  const levels = [{ name: 'Light damage', from: 3, seconds: 0.2, urgency: 'whenever', within: 0, action: 'repair' }, { name: 'Heavy damage', from: 9, seconds: 0.2, urgency: 'asap', within: 2, action: 'repair' }, { name: 'Critical damage', from: 10, seconds: 0, urgency: 'asap', within: 1, action: 'retire' }];
  store.damagesystems = [
    { id: 'dm1', name: 'With failures', stop: 'overlap', deslotPoints: 1, latePoints: 1, earlyPoints: 1, levels, incidents: [{ name: 'Contact', points: 2 }],
      failuresOn: 'on', failFrom: 10, failTo: 90, failMax: 1, failures: [{ name: 'Slow Puncture', level: 'Heavy damage', chance: 0, seconds: 0.3 }, { name: 'Engine Failure, Box to Retire', level: 'Critical damage', chance: 0, seconds: 0 }, { name: 'Lift and Coast', level: 'Light damage', chance: 0, seconds: 0.3 }] },
    { id: 'dm2', name: 'Without failures', stop: 'overlap', levels, incidents: [{ name: 'Contact', points: 2 }], failuresOn: 'off', failures: [{ name: 'Slow Puncture', level: 'Heavy damage', chance: 50, seconds: 0.3 }] }];
  store.penaltysystems = [{ id: 'p1', name: 'Standard', everyPoints: 5, everySeconds: 5 }];
  const dsetup = over => ({ id: 'ds1', name: 'Failure race', sessionType: 'race', laps: 5, endRule: 'all', damageSystem: 'dm1', penaltySystem: 'p1', pitHold: 0.1, layout: '', ...over });
  const track = { ...store.tracks[0], deslotTime: 0 };
  const lapOn = async lane => { key(String(lane + 1)); await wait(80); };
  const act = async f => { await f(); await wait(60); };

  // ---------- a race without Car Failures: no folder, no panel ----------
  await openRace(dsetup({ damageSystem: 'dm2' }), track, rows(1, 2));
  say('a Damage System with Car Failures off: the race has no failures, no folder and no panel for them (the damage panel is there)', eng().failures === null && !run('live.flPanel') && !E('racehost').innerHTML.includes('fd-failures') && !!run('live.dmPanel') && E('racehost').innerHTML.includes('id="fd-damage"'));
  run('state.race = null; live = null');

  // ---------- the race with Car Failures ----------
  await openRace(dsetup(), track, rows(1, 2));
  say('the race has the failures of the Damage System: three (they are rolled when the race starts)', eng().failures && eng().failures.list.map(f => f.name).join() === 'Slow Puncture,Engine Failure, Box to Retire,Lift and Coast' && eng().cars.every(c => c.flPlan === null));
  const host = E('racehost').innerHTML;
  say('the folder Car Failures is on the race screen, right after the Damage folder, with its own panel', host.includes('id="fd-failures"') && host.includes('<strong>Car Failures</strong>') && host.includes('id="flpanel"') && host.indexOf('id="fd-damage"') < host.indexOf('id="fd-failures"') && host.indexOf('id="fd-failures"') < host.indexOf('id="fd-weather"') + (host.includes('id="fd-weather"') ? 0 : 1e9));
  say('...it is red like the Damage folder, and the panel is built: a list with "At random" and the three failures (with their chances), a Give and a Clear button for every lane', host.includes('dir-red') && !!run('live.flPanel') && E('flpanel').hidden === false
    && E('flpanel').innerHTML.includes('<option value="-1">At random</option>') && E('flpanel').innerHTML.includes('<option value="0">Slow Puncture (0%)</option>') && E('flpanel').innerHTML.includes('<option value="2">Lift and Coast (0%)</option>')
    && E('flpanel').innerHTML.includes('Give the car on lane 1 the failure that is chosen') && E('flpanel').innerHTML.includes('Clear the failure of the car on lane 2'));
  say('...before the start nothing can be given or cleared, and a press does nothing', view().on === true && view().rows.every(r => !r.give && !r.clear) && (await act(() => fl(0, 'give', 0)), car(0).fail === null));
  key(' '); await until(() => phase() === 'running', 5000); await wait(60);
  say('while racing both cars can be given a failure, nothing can be cleared; nothing was rolled for the cars (the chances are 0)', view().rows.every(r => r.give && !r.clear && r.chip === 'No failure') && eng().cars.every(c => Array.isArray(c.flPlan) && c.flPlan.length === 0));

  // Give, with the failure that is chosen
  await act(() => fl(0, 'give', 0));
  say('"Give" with Slow Puncture chosen: lane 1 has the failure (lane 2 not), the log says the Race Director gave it', car(0).fail && car(0).fail.name === 'Slow Puncture' && car(1).fail === null && events('failure').length === 1 && events('failure')[0].by === 'director' && events('failure')[0].car === 0);
  say('...the panel shows it: the name, red (Slow Puncture is urgent), what it asks; it can be cleared and not given another', view().rows[0].chip === 'Slow Puncture' && view().rows[0].kind === 'red' && /^Pit in \d laps?, 0.3 seconds in the pits$/.test(view().rows[0].note) && view().rows[0].give === false && view().rows[0].clear === true);
  await act(() => fl(0, 'give', 2));
  say('a car that has a failure is not given a second one', car(0).fail.name === 'Slow Puncture' && events('failure').length === 1);

  // the Race Director page gives and clears by command
  api.liveCommand({ type: 'failure', lane: 1, k: 2 }); await wait(60);
  say('the Race Director page gives a failure by command: lane 2 has Lift and Coast, amber (pit whenever you can)', car(1).fail && car(1).fail.name === 'Lift and Coast' && view().rows[1].kind === 'amber' && events('failure').length === 2);
  [{ type: 'failure', lane: 9, k: 0 }, { type: 'failure', lane: 0, k: 1 }, { type: 'failure', k: 1 }, { type: 'failure', lane: 1, k: 7 }, { type: 'failureclear', lane: 9 }, { type: 'failureclear' }].forEach(c => api.liveCommand(c)); await wait(80);
  say('...a lane that does not exist, a car that has a failure already, a number that is not in the list, or no lane: nothing happens', events('failure').length === 2 && car(0).fail.name === 'Slow Puncture' && car(1).fail.name === 'Lift and Coast' && events('failurecleared').length === 0);
  await wait(300);
  say('what is shared with the other windows: the failures in the settings, and the failure of each car', sent.stat.cfg.damage && sent.stat.cfg.damage.failures && sent.stat.cfg.damage.failures.list.length === 3 && !('flPlan' in sent.dyn.cars[0]) && sent.dyn.cars[0].fail.name === 'Slow Puncture' && sent.dyn.cars[1].fail.name === 'Lift and Coast');
  say('...and a race that is continued after a crash keeps them (the snapshot has the failure)', kept.snap && JSON.stringify(kept.snap).includes('"Slow Puncture"') && JSON.stringify(kept.snap).includes('"Lift and Coast"'));

  // Clear
  await act(() => fl(1, 'clear'));
  say('"Clear" takes the failure of lane 2 away: no failure, logged as cleared by the Race Director, no penalty', car(1).fail === null && events('failurecleared').length === 1 && events('failurecleared')[0].car === 1 && events('failurecleared')[0].name === 'Lift and Coast' && car(1).points === 0 && view().rows[1].chip === 'No failure' && view().rows[1].clear === false);
  await act(() => fl(1, 'clear'));
  say('...a second press has nothing to clear', events('failurecleared').length === 1);

  // the stop in the pits clears the failure of lane 1
  run('live.pitBtns[0].b.onclick()'); await wait(80);
  say('on the sensor, before the stop has started as a pit stop, nothing is repaired', car(0).fail !== null && events('failurerepaired').length === 0);
  await wait(600);
  say('standing long enough clears the failure: no failure, "repaired" is logged with the seconds, the time in the pits is counted', car(0).fail === null && events('failurerepaired').length === 1 && events('failurerepaired')[0].ms === 300 && car(0).failMs === 300 && view().rows[0].chip === 'No failure');
  run('live.pitBtns[0].b.onclick()'); await wait(40);
  say('...leaving afterwards costs nothing', car(0).points === 0 && events('failureearly').length === 0);

  // a failure that retires the car, and the Race Director brings the car back
  api.liveCommand({ type: 'failure', lane: 0, k: 1 }); await wait(60);
  say('the Engine Failure: shown as one that ends the car (grey, the car is retired when it stops in the pits), the car is still racing', car(0).fail.name === 'Engine Failure, Box to Retire' && view().rows[0].kind === 'out' && /the car is retired$/.test(view().rows[0].note) && !car(0).done);
  run('live.pitBtns[0].b.onclick()'); await wait(400);
  say('on the sensor in the pits it is retired by the failure: out of the race, the panel says Retired and offers Clear', car(0).failOut === 'retire' && car(0).done === true && car(0).retired === true && events('failureout').length === 1 && view().rows[0].chip === 'Retired' && view().rows[0].give === false && view().rows[0].clear === true);
  await act(() => fl(0, 'clear'));
  say('"Clear" brings the car back: racing again, logged as cleared and as reinstated', car(0).failOut === '' && car(0).done === false && car(0).retired === false && events('failurecleared').length === 2 && events('failurecleared')[1].out === true && events('reinstated').length === 1 && view().rows[0].chip === 'No failure');
  run('live.pitBtns[0].b.onclick()'); await wait(40);
  await lapOn(0);
  say('...and it counts laps again', car(0).laps.length >= 1);

  // a last failure for lane 2: it is retired, and the race ends when lane 1 has driven its laps
  await act(() => fl(1, 'give', 2)); await act(() => fl(1, 'clear'));
  api.liveCommand({ type: 'failure', lane: 1, k: 1 }); await wait(60);
  run('live.pitBtns[1].b.onclick()'); await wait(400);
  say('lane 2 is put out by the Engine Failure at its stop', car(1).failOut === 'retire' && car(1).done === true && events('failureout').length === 2);
  run('live.pitBtns[1].b.onclick()'); await wait(40);
  for (let n = 0; n < 12 && car(0).laps.length < 5; n++) await lapOn(0);
  await wait(100); await until(() => phase() === 'finished', 5000); await wait(200);
  const s1 = saved[0] && saved[0][0];
  say('the race is saved with what the failures did to each car', saved.length === 1 && s1.standings.length === 2);
  const r0 = s1.standings.find(x => x.driverId === 'd1'), r1 = s1.standings.find(x => x.driverId === 'd2');
  say('...lane 1: the note (repaired with the seconds, the one that was cleared, nothing about the one it did not have), how many, how many were repaired, the time in the pits; not out', r0 && r0.failureNote === 'Slow Puncture (repaired, 0.3 seconds in the pits), Engine Failure, Box to Retire (cleared by the Race Director)' && r0.failures === 2 && r0.failureRepairs === 1 && r0.failureMs === 300 && !('failureOut' in r0) && !r0.retired);
  say('...lane 2: the car that the failure retired: marked out, with the note', r1 && r1.retired === true && r1.failureOut === 'retire' && r1.failureNote === 'Lift and Coast (cleared by the Race Director), Lift and Coast (cleared by the Race Director), Engine Failure, Box to Retire (retired)' && r1.failures === 3 && r1.failureRepairs === 0 && r1.failureMs === 0);
  say('...the results say why the car is out, and show the notes behind the names', run(`Stats.outText(${JSON.stringify(r1)})`) === 'retired by a failure' && run(`Stats.notesText(${JSON.stringify(r0)})`).startsWith('Failures: Slow Puncture (repaired') && run(`Stats.notesText(${JSON.stringify(r1)})`).includes('Failures: Lift and Coast'));
  say('...a race without damage has no failure figures in its rows (the other cars of the damage tests are unchanged)', !('damageNote' in r0) && !('damagePoints' in r0));
  run('state.race = null; live = null'); saved.length = 0;

  // ---------- the Race Director page and the phones: the same folder, the same buttons ----------
  { const lv = fs.readFileSync(R + 'renderer/liveview.js', 'utf8'), rc = fs.readFileSync(R + 'renderer/race.js', 'utf8'), sv = fs.readFileSync(R + 'server.js', 'utf8'), idx = fs.readFileSync(R + 'renderer/index.html', 'utf8');
    say('the Race Director page has the folder Car Failures after Damage, and its buttons send the commands "failure" (with the number from the list, -1 for random) and "failureclear"',
      lv.includes("folder('failures', 'Car Failures'") && lv.indexOf("folder('damage'") < lv.indexOf("folder('failures'") && lv.includes("FailurePanel.build($('dir-fl')") && lv.includes("send({ type: 'failure', lane: l, k })") && lv.includes("send({ type: 'failureclear', lane: l })") && lv.includes('flPanel.update()'));
    say('...the panel only comes when the race has failures; both the race screen and that page build the same panel (damageui.js is on the page)', lv.includes('st.cfg.damage && st.cfg.damage.failures') && rc.includes('FailurePanel.build(ui(\'flpanel\')') && idx.includes('<script src="damageui.js"></script>') && sv.includes("'failure', 'failureclear'")); }

  reachedEnd = true;
  console.log(fails ? fails + ' CAR FAILURE SCREEN TESTS FAILED' : 'ALL CAR FAILURE SCREEN TESTS PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERROR', e.stack); process.exit(1); });
