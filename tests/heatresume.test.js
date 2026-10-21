// 1.24.0: a heat-based race that is interrupted (a crash, a power cut) can be carried on: the heats that are done, the finals, the laps and figures of the finished races, the race that was racing (or none while it waited
// between two races) and the file on the Home tab, against a stand-in for the app window.
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
for (const f of ['listnum.js', 'bop.js', 'weather.js', 'tyrewear.js', 'safetycar.js', 'pushsave.js', 'racelimit.js', 'endurance.js', 'failures.js', 'damage.js', 'engine.js', 'heats.js', 'rotation.js', 'championship.js', 'champpoints.js', 'season.js', 'tokens.js', 'speed.js', 'distance.js','stats.js','homestats.js','carstats.js','viewset.js','picture.js','uiscale.js','depth.js','theme.js','banner.js', 'icons.js', 'delta.js','avatars.js', 'picmemo.js', 'weatherwidgets.js', 'tyrewidgets.js', 'pacewidgets.js', 'boardorder.js', 'widgets.js', 'frame.js', 'backdrop.js','announcer.js','sound.js', 'timing.js', 'rows.js', 'richtext.js', 'report.js', 'canvas.js', 'liveshare.js', 'review.js', 'adjustpad.js', 'adjustui.js', 'dirfolder.js', 'penaltyui.js', 'rotationdrag.js','padui.js','livegrid.js', 'homegrid.js', 'drivergrid.js', 'homecards.js', 'liveview.js', 'setupwords.js', 'formui.js', 'database.js', 'landing.js', 'race.js', 'undo.js', 'editor.js','tokenui.js', 'bopui.js', 'enduranceui.js', 'weatherui.js', 'tyreui.js', 'pushsaveui.js', 'rotationui.js', 'championshipui.js', 'audioedit.js','widgetbuilder.js','transferui.js','themeui.js','hardware.js','trackmate.js','hardwareui.js', 'dsui.js', 'app.js']) vm.runInContext(fs.readFileSync(R + 'renderer/' + f, 'utf8'), ctx, { filename: f });
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
const lookOf = i => eng().enLook(i, nowMs());
const events = type => eng().events.filter(e => e.type === type);
const pressSwap = (lane, over = {}) => E('enpanel').onclick({ target: { closest: () => ({ disabled: false, dataset: { en: 'swap' }, blur() {}, closest: () => ({ dataset: { lane: String(lane) }, querySelector: () => ({ hidden: true, value: '' }), ...over }) }) } });

(async () => {
  await wait(50); ctx.__sent = sent;
  const hset = over => ({ id: 'hr1', name: 'Heat night', sessionType: 'heats', heatBy: 'laps', laps: 2, heatPlan: 'manual', heats: 3, resultBy: 'laps', fuelRules: '', lightsMin: 0, lightsMax: 0, endRule: 'all', layout: '', ...over });
  const plan3 = [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }], [{ p: 1, lane: 0 }, { p: 0, lane: 1 }], [{ p: 0, lane: 0 }, { p: 1, lane: 1 }]];
  const track = store.tracks[0];
  const lapOn = async lane => { key(String(lane + 1)); await wait(60); };
  const bothLaps = async n => { for (let k = 0; k < n; k++) { await lapOn(0); await lapOn(1); } };
  const startHeat = async () => { key(' '); await until(() => phase() === 'running', 5000); await wait(60); };
  const open = (setup, extra) => openRace(setup, track, rows(1, 2), { schedule: plan3, ...extra });
  const homeView = async () => { run("state.tab = 'home'; state.race = null; live = null"); await run('render()'); await wait(40); return E('view').innerHTML.replace(/&quot;/g, '"'); };
  const click = async b => { await E('view').onclick({ target: { closest: sel => (sel === 'button' ? { dataset: {}, ...b } : null) } }); await wait(40); };

  // ---------- nothing is kept before the first race is racing; then the state of the heats is kept ----------
  await open(hset());
  say('before the first heat starts nothing is kept', kept.saves === 0 && kept.snap === null);
  await startHeat();
  await bothLaps(1); await wait(150);
  say('while heat 1 runs, a snapshot is kept: the setup, the track, the lanes, the plan of the heats, the clock and the engine', kept.saves > 0 && kept.snap && kept.snap.v === 1 && kept.snap.kind === 'Heat-based race' && kept.snap.name === 'Heat night' && same_(kept.snap.race.schedule, plan3) && kept.snap.race.setup.name === 'Heat night' && kept.snap.eng && kept.snap.eng.cars.length === 2 && kept.snap.heat.state.idx === 0 && kept.snap.heat.phase === 'running');
  say('...and says where it is, for the note on the Home tab', /^\d+:\d\d into heat 1 of 3$/.test(kept.snap.where));
  await bothLaps(1);
  await until(() => phase() === 'between', 6000); await wait(250);
  const atBreak = kept.snap;
  say('when heat 1 is done the race waits between two heats, and that is kept at once: no engine, the heat that is done, its laps and its figures', phase() === 'between' && atBreak && atBreak.eng === null && atBreak.phase === 'between' && atBreak.heat.state.idx === 1 && atBreak.heat.state.results.length === 1 && atBreak.heat.laps.length >= 4 && atBreak.heat.laps.every(l => l.heat === 1) && atBreak.where === 'between heat 1 and heat 2');

  // ---------- heat 2 is racing: the snapshot, a crash, and the race comes back ----------
  await startHeat();
  await lapOn(0); await lapOn(1); await wait(200);
  const midHeat = kept.snap;
  say('heat 2 is racing: the snapshot has the engine of heat 2 (one lap each) and the heat that is done', midHeat.eng && midHeat.eng.cars.every(c => c.laps.length === 1) && midHeat.heat.state.idx === 1 && midHeat.heat.state.results.length === 1 && /into heat 2 of 3$/.test(midHeat.where) && midHeat.heat.laps.every(l => l.heat === 1));
  say('...and the plan of the heats (the cars swap lanes in heat 2), so the same heats come back', same_(midHeat.heat.state.schedule, plan3) && same_(midHeat.race.schedule, plan3));
  run('live.alive = false; clearInterval(live.timers); clearInterval(live.breakTimer); (live.sim || []).forEach(clearTimeout); document.removeEventListener("keydown", live.key)'); // (the crash: the race screen is gone, nothing more is written)
  const n0 = kept.saves; await wait(200); say('...a race that is not there any more writes nothing', kept.saves === n0);
  run('state.race = null; live = null');

  kept.snap = midHeat; saved.length = 0;
  let hv = await homeView();
  say('the Home tab says a race was interrupted: the name, the kind, the track, where it was, and that the heats that were done are kept', hv.includes('A race was interrupted') && hv.includes('<strong>Heat night</strong> · Heat-based race on Living room') && hv.includes('into heat 2 of 3 when it was saved') && hv.includes('The heats that were done are kept.'));
  kept.snap = atBreak; hv = await homeView();
  say('...between two heats it says so', hv.includes('between heat 1 and heat 2 when it was saved'));
  kept.snap = midHeat; hv = await homeView();
  await click({ id: 'resumego' });
  const st = JSON.parse(run('JSON.stringify(state.race)'));
  say('Resume the race opens the Race tab with the saved race: the setup, the track, the lanes, and the plan of the heats', run('state.tab') === 'race' && st.setup.name === 'Heat night' && st.track.id === 't1' && same_(st.rows, rows(1, 2)) && same_(st.schedule, plan3) && st.resume.heat.state.idx === 1 && !st.resume.stopNow);
  await wait(60);
  say('the race comes back paused in heat 2, with one lap each and the clock where it was', phase() === 'paused' && eng().cars.every(c => c.laps.length === 1) && eng().resumes === 1 && E('msg').textContent.includes('The race was interrupted and is back'));
  say('...heat 1 is still in the overall result and in the plan (Done)', E('overall').innerHTML.includes('<td class="num">1</td>') && E('heatlist').innerHTML.includes('Done') && E('heatlist').innerHTML.includes('Racing now'));
  say('...the lanes of the cars are the lanes of heat 2 of the plan', eng().cars.map(c => c.lane + ':' + c.participant).join() === plan3[1].map(x => x.lane + ':' + x.p).join());
  key(' '); await until(() => phase() === 'running', 5000); await wait(60);
  say('Space carries on', phase() === 'running');
  await bothLaps(2); await until(() => phase() === 'between', 6000); await wait(150);
  say('heat 2 is done and heat 3 waits', phase() === 'between' && E('msg').textContent.includes('Heat 2 finished'));
  await startHeat(); await bothLaps(2);
  await until(() => phase() === 'finished', 8000); await wait(250);
  const s1 = saved[0] && saved[0][0], l1 = saved[0] && saved[0][1];
  say('the heat race is saved with all three heats, the first one as it was before the crash', saved.length === 1 && s1.sessionType === 'heats' && s1.heatResults.length === 3 && s1.heatResults[0].rows.every(x => x.laps === 2));
  say('...every heat has its laps in the lap rows: heat 1 from before the crash, heat 2 with the lap of the first part and the lap after it, heat 3', [1, 2, 3].every(h => l1.filter(l => l.heat === h).length === 4) && s1.heatResults.every(h => h.rows.every(x => x.laps === 2)));
  say('...the lap after the restart is not for the records, the other laps are (the lap that was being driven when it stopped)', l1.filter(l => l.heat === 2 && l.lapNumber === 2).every(l => l.tooSlow && l.noTrackRecord && l.noPersonalBest) && l1.filter(l => !(l.heat === 2 && l.lapNumber === 2)).every(l => !l.tooSlow && !l.noTrackRecord));
  say('...and the standings count all the heats (6 laps for each driver)', s1.standings.length === 2 && s1.standings.every(x => x.laps === 6));
  say('...it says that it was interrupted and carried on once (the first lap after it is not for the records)', s1.resumed === 1 && run(`Stats.resumeText(${JSON.stringify(s1)})`).startsWith('This race was interrupted and carried on.'));
  say('...the file is deleted once the result is saved, and nothing is written after that', kept.snap === null && kept.clears >= 1 && (await wait(250), kept.snap === null));
  run('state.race = null; live = null');

  // ---------- the race comes back between two heats ----------
  kept.snap = atBreak; saved.length = 0; kept.saves = 0;
  await homeView(); await click({ id: 'resumego' }); await wait(60);
  say('a race that was interrupted between two heats comes back between two heats, and does not start by itself', phase() === 'between' && E('msg').textContent.includes('back, between two races') && eng().status === 'ready' && eng().cars.every(c => c.laps.length === 0));
  say('...heat 1 is done and heat 2 is next, with the lanes of the plan', E('heatlist').innerHTML.includes('Done') && E('heatlist').innerHTML.includes('Next') && eng().cars.map(c => c.lane + ':' + c.participant).join() === plan3[1].map(x => x.lane + ':' + x.p).join());
  await wait(200);
  say('...the state is kept again (the same heat that is done), also before the first key is pressed', kept.saves > 0 && kept.snap && kept.snap.heat.state.idx === 1 && kept.snap.eng === null);
  say('...the figures of the heat that is done come back too: its laps, the best laps, and the pits and penalty points of every driver', run('live.laps.length') === 4 && run('live.priorAll') < 1e12 && run('live.priorBy.size') === 2 && run('live.extraBy.size') === 2);
  say('...and so does what a leaderboard that counts over all heats remembers of heat 1 (the lap times that count and the heats driven, of both drivers)', run('live.memoBy.size') === 2 && run('[...live.memoBy.values()].every(m => m.n === 1 && m.laps.length === 2 && m.laps.every(t => t > 0))') === true);
  await startHeat(); await bothLaps(2); await until(() => phase() === 'between', 6000);
  await startHeat(); await bothLaps(2); await until(() => phase() === 'finished', 8000); await wait(250);
  say('the heats are raced to the end and saved with all three heats (and it does not say it was carried on: no lap was lost between two heats)', saved.length === 1 && saved[0][0].heatResults.length === 3 && saved[0][0].heatResults[0].heat === 1 && kept.snap === null && !('resumed' in saved[0][0]));
  run('state.race = null; live = null');

  // ---------- Save what was recorded ----------
  kept.snap = midHeat; saved.length = 0;
  await homeView(); await click({ id: 'resumesave' }); await wait(200);
  say('Save what was recorded in the middle of a heat ends the race with that heat (it is checked first, and it does not go on with heat 3)', saved.length === 1 && saved[0][0].heatResults.length === 2 && saved[0][0].heatResults[0].heat === 1 && saved[0][0].heatResults[1].heat === 2 && kept.snap === null);
  say('...it says it was carried on once, and the laps of heat 1 and of the part of heat 2 are saved', saved[0][0].resumed === 1 && saved[0][1].filter(l => l.heat === 1).length === 4 && saved[0][1].filter(l => l.heat === 2).length === 2);
  run('state.race = null; live = null');
  kept.snap = atBreak; saved.length = 0;
  await homeView(); await click({ id: 'resumesave' }); await wait(200);
  say('...between two heats it saves the heats that are done', saved.length === 1 && saved[0][0].heatResults.length === 1 && saved[0][0].heatResults[0].heat === 1 && kept.snap === null);
  run('state.race = null; live = null');

  // ---------- a race that does not fit any more ----------
  kept.snap = midHeat; saved.length = 0; kept.saves = 0; kept.clears = 0;
  await homeView(); run('state.autoFinalize = true');
  await openRace(hset(), track, rows(1, 2, 3), { resume: midHeat, schedule: undefined });
  await wait(60);
  say('a race with other drivers (the plan does not fit) does not come back: it says so and starts as a new race, and writes nothing', phase() === 'ready' && E('msg').textContent.includes('does not fit this race setup any more') && (await wait(300), kept.saves === 0));
  run('state.race = null; live = null');
  await openRace(hset(), track, rows(1, 2), { resume: { ...midHeat, heat: undefined }, schedule: plan3 });
  say('a file with no state of the heats does not come back either', phase() === 'ready' && E('msg').textContent.includes('does not fit this race setup any more'));
  run('state.race = null; live = null');

  // ---------- a final A: the lanes that were chosen are kept ----------
  {
    const plan2 = plan3.slice(0, 2);
    kept.snap = null; saved.length = 0; kept.saves = 0;
    await openRace(hset({ id: 'hr2', heats: 2, finals: 'a', finalMode: 'places' }), track, rows(1, 2), { schedule: plan2 });
    await startHeat(); await bothLaps(2); await until(() => phase() === 'between', 6000);
    await startHeat(); await bothLaps(2); await until(() => phase() === 'between', 6000); await wait(250);
    say('after the last heat the final waits for the lanes: that is kept (nobody has chosen yet)', E('finalpick').hidden === false && kept.snap && kept.snap.heat.state.idx === 2 && kept.snap.heat.state.finalPlan.length === 1 && kept.snap.heat.state.finalPlan[0].name === 'A' && Object.values(kept.snap.heat.state.picks).flat().length === 0 && kept.snap.where === 'between heat 2 and final A');
    run('live.cpAt = performance.now()'); // (a snapshot was written a moment ago: a lane that is chosen is kept at once all the same)
    run('live.pickAction("lane", 1)'); await wait(30);
    const picked = kept.snap;
    say('a lane that is chosen is kept at once (with two drivers the last lane is left for the other one)', (picked.heat.state.picks.A || []).length === 2 && picked.heat.state.picks.A[0].lane === 1 && picked.heat.state.picks.A[1].lane === 0);
    const first = (picked.heat.state.picks.A || [{}])[0].p;
    run('live.alive = false; clearInterval(live.timers); clearInterval(live.breakTimer); (live.sim || []).forEach(clearTimeout); document.removeEventListener("keydown", live.key)'); run('state.race = null; live = null');
    await homeView(); await click({ id: 'resumego' }); await wait(80);
    say('the race comes back between the heats and the final, with the lanes that were chosen', phase() === 'between' && E('finalpick').hidden === false && E('finalpick').innerHTML.includes('Lane 2: ') && E('finalpick').innerHTML.includes('All lanes are chosen') && eng().cars.find(c => c.lane === 1).participant === first);
    run('live.pickAction("clear")'); await wait(60);
    say('...and the choices can be changed again: after Clear choices the first driver chooses', E('finalpick').innerHTML.includes('chooses a lane') && !E('finalpick').innerHTML.includes('All lanes are chosen'));
    run('live.pickAction("lane", 0)'); await wait(60);
    await startHeat(); await bothLaps(2); await until(() => phase() === 'finished', 8000); await wait(250);
    say('the final is raced and saved with the heats: final A and its result', saved.length === 1 && saved[0][0].heatResults.length === 3 && saved[0][0].heatResults[2].final === 'A' && saved[0][0].finals && kept.snap === null);
    run('state.race = null; live = null');
  }

  // ---------- teams as participants: the driver who drives for each team in the next heat ----------
  {
    store.teams = [{ id: 'T1', name: 'Red Bulls', drivers: ['d1', 'd2', 'd3'] }, { id: 'T2', name: 'Blue Moons', drivers: ['d4'] }];
    run('state.rand = () => 0'); // (by lot, and the lot always takes the first driver who has driven the fewest heats: so what the history holds decides who drives in heat 3)
    const trows = [{ teamId: 'T1', carId: 'c1' }, { teamId: 'T2', carId: 'c2' }];
    const who = () => eng().cars.map(c => c.teamName + ':' + c.driverName).sort().join();
    kept.snap = null; saved.length = 0; kept.saves = 0;
    await openRace(hset({ id: 'hr3', teamDriver: 'random' }), track, trows, { byTeam: true, schedule: plan3 });
    say('teams race: heat 1 has the first driver of each team', who() === 'Blue Moons:Lee,Red Bulls:Alex');
    await startHeat(); await bothLaps(2); await until(() => phase() === 'between', 6000); await wait(250);
    say('...heat 2 has the next driver of each team (and that is what is kept)', who() === 'Blue Moons:Lee,Red Bulls:Sam' && same_(kept.snap.heat.drivers, ['d2', 'd4']) && same_(kept.snap.heat.teamHist, [['d1'], ['d4']]) && kept.snap.race.byTeam === true);
    const teamSnap = kept.snap;
    run('live.alive = false; clearInterval(live.timers); clearInterval(live.breakTimer); (live.sim || []).forEach(clearTimeout); document.removeEventListener("keydown", live.key)'); run('state.race = null; live = null');
    await homeView(); await click({ id: 'resumego' }); await wait(80);
    say('Resume the race gives the teams back (byTeam is passed on), with the drivers of heat 2 and not the first drivers again', run('state.race.byTeam') === true && phase() === 'between' && who() === 'Blue Moons:Lee,Red Bulls:Sam');
    await startHeat(); await bothLaps(2); await until(() => phase() === 'between', 6000);
    say('...the lot goes on from the history that was kept: in heat 3 the driver who has not driven yet drives (Kim), not Alex again', who() === 'Blue Moons:Lee,Red Bulls:Kim');
    await startHeat(); await bothLaps(2); await until(() => phase() === 'finished', 8000); await wait(250);
    say('...the result names the driver of every heat', saved.length === 1 && saved[0][0].heatResults[0].rows.some(x => x.driverName === 'Red Bulls (Alex)') && saved[0][0].heatResults[1].rows.some(x => x.driverName === 'Red Bulls (Sam)') && saved[0][0].heatResults[2].rows.some(x => x.driverName === 'Red Bulls (Kim)'));
    run('state.race = null; live = null'); store.teams = [];
  }

  // ---------- the weather of the heat that was interrupted goes on ----------
  {
    store.weathersystems = [{ id: 'w9', name: 'Random rain', unit: 'laps', startMode: 'random', startFrom: 1, startTo: 6, rainMode: 'random', rainMin: 1, rainMax: 6, cloudyFor: 1, clearingFor: 1, react: 2, wetPoints: 2, dryPoints: 2, sameInHeats: 'new' }];
    kept.snap = null; saved.length = 0;
    await open(hset({ id: 'hr4', weather: 'w9', laps: 8 }));
    await startHeat(); await bothLaps(1); await until(() => phase() === 'between', 100).catch(() => {});
    await wait(200);
    const plan0 = JSON.stringify(eng().wxPlan), seed0 = kept.snap.wxHeat;
    say('the seed of the weather of the race that is racing is kept', Number.isFinite(seed0) && seed0 > 0 && kept.snap.wxSeed > 0 && seed0 !== kept.snap.wxSeed);
    const snapW = kept.snap;
    run('live.alive = false; clearInterval(live.timers); clearInterval(live.breakTimer); (live.sim || []).forEach(clearTimeout); document.removeEventListener("keydown", live.key)'); run('state.race = null; live = null');
    await homeView(); await click({ id: 'resumego' }); await wait(80);
    say('...and the race that comes back has the same forecast (not a new random one)', JSON.stringify(eng().wxPlan) === plan0 && plan0.length > 20);
    run('clearInterval(live.timers); clearInterval(live.breakTimer); (live.sim || []).forEach(clearTimeout); document.removeEventListener("keydown", live.key)'); run('state.race = null; live = null'); store.weathersystems = [];
  }

  reachedEnd = true;
  console.log(fails ? fails + ' HEAT RESUME TESTS FAILED' : 'ALL HEAT RESUME TESTS PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERROR', e.stack); process.exit(1); });
