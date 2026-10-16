// 1.10.0: the Damage System on screen: the damage panel of the race screen (the buttons give and take back damage points), the Race Director command, the automatic deslot from the track,
// the repair in the pits, leaving too early, a car that damage retires, what is shared with other windows and what is saved, against a stand-in for the app window.
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
for (const f of ['bop.js', 'weather.js', 'endurance.js', 'damage.js', 'engine.js', 'heats.js', 'rotation.js', 'tokens.js', 'speed.js','stats.js','viewset.js','picture.js','uiscale.js','theme.js','banner.js', 'icons.js', 'delta.js','avatars.js', 'weatherwidgets.js', 'widgets.js', 'frame.js', 'backdrop.js','announcer.js','sound.js', 'timing.js', 'rows.js', 'richtext.js', 'report.js', 'canvas.js', 'liveshare.js', 'review.js', 'liveview.js', 'database.js', 'landing.js', 'race.js', 'undo.js', 'editor.js','tokenui.js', 'bopui.js', 'enduranceui.js', 'damageui.js', 'weatherui.js', 'rotationui.js', 'audioedit.js','widgetbuilder.js','transferui.js','themeui.js','hardware.js','trackmate.js','hardwareui.js', 'dsui.js', 'app.js']) vm.runInContext(fs.readFileSync(R + 'renderer/' + f, 'utf8'), ctx, { filename: f });
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
const view = () => run('Damage.view(live.engine(), [0, 1], performance.now(), live.phase)');

(async () => {
  await wait(50); ctx.__sent = sent;
  store.damagesystems = [{ id: 'dm1', name: 'Standard', stop: 'overlap', deslotPoints: 1, latePoints: 1, earlyPoints: 1,
    levels: [{ name: 'Light damage', from: 3, seconds: 0.2, urgency: 'whenever', within: 0, action: 'repair' }, { name: 'Heavy damage', from: 9, seconds: 0.2, urgency: 'asap', within: 2, action: 'repair' }, { name: 'Critical damage', from: 10, seconds: 0, urgency: 'asap', within: 1, action: 'retire' }],
    incidents: [{ name: 'Contact', points: 2 }, { name: 'Hard crash', points: 4 }] }];
  store.penaltysystems = [{ id: 'p1', name: 'Standard', everyPoints: 5, everySeconds: 5 }];
  const dsetup = over => ({ id: 'ds1', name: 'Damage race', sessionType: 'race', laps: 5, endRule: 'all', damageSystem: 'dm1', penaltySystem: 'p1', pitHold: 0.1, layout: '', ...over });
  const track = { ...store.tracks[0], deslotTime: 0 };
  const lapOn = async lane => { key(String(lane + 1)); await wait(80); };
  const give1 = async (lane, n) => { await give(lane, n); await wait(20); };

  // ---------- the race with a Damage System ----------
  await openRace(dsetup(), track, rows(1, 2));
  say('the race has the rules of the Damage System: three levels, two incidents, and no deslot time (the track has none)', eng().damage && eng().damage.levels.map(l => l.name).join() === 'Light damage,Heavy damage,Critical damage' && eng().damage.incidents.map(x => x.name + x.points).join() === 'Contact2,Hard crash4' && eng().damage.deslotMs === 0);
  say('...the damage panel is there, with a button for every incident and for taking points back', !!run('live.dmPanel') && E('dmpanel').hidden === false && E('dmpanel').innerHTML.includes('Contact +2') && E('dmpanel').innerHTML.includes('Hard crash +4') && E('dmpanel').innerHTML.includes('Take back one damage point on lane 1'));
  say('...before the start no damage can be given, and the panel says nothing is to be given or taken', eng().addDamage(0, 2, 10) === false && view().rows.every(r => !r.give && !r.take));
  key(' '); await until(() => phase() === 'running', 5000); await wait(60);
  say('while racing the buttons can give, but not take back where there is no damage', view().rows.every(r => r.give && !r.take && r.points === 0 && r.chip === 'No damage'));
  await give1(0, 2);
  say('the button "Contact +2" gives lane 1 two damage points (not lane 2), logged as a damage event', car(0).dmg === 2 && car(1).dmg === 0 && events('damage').length === 1 && events('damage')[0].delta === 2 && events('damage')[0].car === 0);
  say('...the panel now shows them: "Minor damage" below the first level, and the points can be taken back', view().rows[0].points === 2 && view().rows[0].chip === 'Minor damage' && view().rows[0].take === true && view().rows[1].take === false);
  await give1(0, 2);
  say('four points is Light damage: pit whenever you can, 0.2 seconds in the pits; the level is logged once', car(0).dmg === 4 && view().rows[0].chip === 'Light damage' && /^Pit whenever you can, 0.2 seconds in the pits$/.test(view().rows[0].note) && events('damagelevel').length === 1 && view().rows[0].kind === 'amber');
  await give1(0, -1);
  say('"-1" takes a point back (3: still Light damage)', car(0).dmg === 3 && view().rows[0].chip === 'Light damage');
  api.liveCommand({ type: 'damage', lane: 1, n: 4 }); await wait(60);
  say('the Race Director page gives damage by command: lane 2 has 4 points, and a lane that does not exist, nothing or a strange number do nothing', car(1).dmg === 4 && (api.liveCommand({ type: 'damage', lane: 9, n: 2 }), api.liveCommand({ type: 'damage', lane: 0, n: 0 }), api.liveCommand({ type: 'damage', n: 2 }), api.liveCommand({ type: 'damage', lane: 0, n: 'x' }), true));
  await wait(60);
  say('...(and nothing else changed)', car(0).dmg === 3 && car(1).dmg === 4 && events('damage').length === 4);
  await wait(300);
  say('what is shared with the other windows: the rules in the settings and the damage of the cars', sent.stat.cfg.damage && sent.stat.cfg.damage.levels.length === 3 && !('rnd' in sent.stat.cfg) && sent.dyn.cars[0].dmg === 3 && sent.dyn.cars[1].dmg === 4 && sent.dyn.cars[1].dmgLvl === 0);
  say('...and a race that is continued after a crash keeps the damage (the snapshot of the race has it)', kept.snap && JSON.stringify(kept.snap).includes('"dmg":3') && JSON.stringify(kept.snap).includes('"dmg":4'));

  // the repair: lane 1 goes to the pits, stands still for 0.2 seconds, and the damage is gone
  run('live.pitBtns[0].b.onclick()'); await wait(60);
  say('on the sensor, before the pit stop has started, nothing is repaired', car(0).dmg === 3 && events('repaired').length === 0);
  await wait(400);
  say('standing long enough in the pits repairs the car: no damage, one repair, "repaired" is logged with the time', car(0).dmg === 0 && car(0).repairs.length === 1 && events('repaired').length === 1 && events('repaired')[0].car === 0 && events('repaired')[0].ms >= 190 && view().rows[0].chip === 'No damage');
  run('live.pitBtns[0].b.onclick()'); await wait(40);
  say('...leaving afterwards costs nothing', car(0).points === 0 && events('repairearly').length === 0);

  // leaving too early: the damage stays, and there is a penalty point
  await give1(0, 4);
  run('live.pitBtns[0].b.onclick()'); await wait(150);
  run('live.pitBtns[0].b.onclick()'); await wait(60);
  say('a car that leaves the pits before the repair is done keeps its damage and gets a penalty point', car(0).dmg === 4 && car(0).points === 1 && events('repairearly').length === 1);

  // a hard crash: critical damage, and the car is retired when it stops in the pits
  await give1(0, 4); await give1(0, 4); await give1(0, 2);
  say('ten points is Critical damage: the car should come in to retire (laps keep counting until it stops in the pits)', car(0).dmg === 14 && view().rows[0].chip === 'Critical damage' && view().rows[0].note.includes('the car is retired') && !car(0).done);
  await lapOn(0);
  say('...it still counts laps', car(0).laps.length >= 1 && !car(0).done);
  run('live.pitBtns[0].b.onclick()'); await wait(300);
  say('on the sensor in the pits it is retired by damage: out of the race, with its result kept', car(0).dmgOut === 'retire' && car(0).done === true && car(0).retired === true && events('damageout').length === 1 && view().rows[0].chip === 'Retired' && view().rows[0].give === false);
  say('...a retired car takes no more damage', (await give1(0, 2), car(0).dmg === 14));
  run('live.pitBtns[0].b.onclick()'); await wait(40);
  for (let n = 0; n < 10 && car(1).laps.length < 5; n++) await lapOn(1);
  await wait(100); await until(() => phase() === 'finished', 5000); await wait(200);
  const s1 = saved[0] && saved[0][0];
  say('the race is saved: the damage note and the figures of every car, and the retired one is marked as out by damage', saved.length === 1 && s1.standings.length === 2);
  const out = s1.standings.find(x => x.damageOut), other = s1.standings.find(x => !x.damageOut);
  say('...the car that damage put out: retired, with the note, the points, the repair and the time in the pits', out && out.retired === true && out.damageOut === 'retire' && out.damagePoints === 18 && out.repairs === 1 && out.repairMs >= 190 && /retired by damage/.test(out.damageNote) && /1 repair/.test(out.damageNote) && /left the pits too early once/.test(out.damageNote) && /late for the pits once/.test(out.damageNote));
  say('...the other car: its points and what was not repaired', other && /^4 damage points, 4 damage points not repaired$/.test(other.damageNote) && !other.damageOut);
  say('...the results say why a car is out (not "out of fuel")', run(`Stats.outText(${JSON.stringify(out)})`) === 'retired, too much damage' && run(`Stats.notesText(${JSON.stringify(other)})`).startsWith('Damage: '));
  say('...and its penalty points (one for leaving early, one for being late for the pits) are in the result', out.penaltyPoints === 2);
  run('state.race = null; live = null'); saved.length = 0;

  // ---------- the automatic deslot: a lap that is slower than the deslot time of the track ----------
  await openRace(dsetup({ id: 'ds2' }), { ...track, deslotTime: 0.35 }, rows(1, 2));
  say('the deslot time of the track is in the rules of the race (in milliseconds)', eng().damage.deslotMs === 350 && eng().damage.deslotPoints === 1);
  key(' '); await until(() => phase() === 'running', 5000); await wait(450);
  await lapOn(0);
  say('a first lap slower than the deslot time is a deslot: one damage point, logged as a deslot', car(0).dmg === 1 && events('damage').length === 1 && events('damage')[0].why === 'deslot');
  await lapOn(0); await lapOn(0);
  say('...quick laps after it give nothing more', car(0).dmg === 1);
  await wait(450); await lapOn(0);
  say('...another slow lap is another deslot (2 points), lane 2 has none', car(0).dmg === 2 && car(1).dmg === 0);
  run('state.race = null; live = null'); saved.length = 0;

  // ---------- a race without a Damage System ----------
  await openRace(dsetup({ id: 'ds3', damageSystem: '' }), { ...track, deslotTime: 0.35 }, rows(1, 2));
  say('a race without a Damage System has no damage, no panel, and a slow lap is no deslot', eng().damage === null && !run('live.dmPanel'));
  key(' '); await until(() => phase() === 'running', 5000); await wait(450); await lapOn(0);
  say('...nothing is given, and the Race Director command does nothing', car(0).dmg === 0 && (api.liveCommand({ type: 'damage', lane: 0, n: 2 }), await wait(60), car(0).dmg === 0));
  run('state.race = null; live = null');

  reachedEnd = true;
  console.log(fails ? fails + ' DAMAGE SCREEN TESTS FAILED' : 'ALL DAMAGE SCREEN TESTS PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERROR', e.stack); process.exit(1); });
