// 1.72.0: the lane cards in place: the Race tab and the Race Director page with a card for each lane instead of the folders Adjust, Penalties, Balance of Power, Damage and Car Failures,
// against a stand-in for the app window (the cards are built from a small page, tests/minidom.js, so the buttons can be found and pressed; the race is a real engine in the race window).
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
const { Dom } = require('./minidom.js'), dom = new Dom({ lenient: true }); // (the elements that the app makes with createElement are the small page's; the rest of the page is the stand-in of the other screen tests)
const keyListeners = new Set(); const document = { addEventListener(t, f) { if (t === 'keydown') keyListeners.add(f); dom.document.addEventListener(t, f); }, removeEventListener(t, f) { if (t === 'keydown') keyListeners.delete(f); dom.document.removeEventListener(t, f); }, querySelector: () => mk(), querySelectorAll: () => [mk(), mk(), mk()],
  getElementById: id => els[id] || (els[id] = mk(id)), documentElement: { dataset: {}, style: { setProperty() {} } }, body: { contains: () => true }, createElement: tag => dom.make(tag) };
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
for (const f of ['listnum.js', 'bop.js', 'weather.js', 'tyretemperature.js', 'tyrewear.js', 'safetycar.js', 'pushsave.js', 'racelimit.js', 'endurance.js', 'failures.js', 'damage.js', 'multiclass.js', 'virtualrival.js', 'engine.js', 'heats.js', 'rotation.js', 'championship.js', 'champpoints.js', 'season.js', 'tokens.js', 'speed.js', 'distance.js','stats.js','homestats.js','carstats.js','viewset.js','picture.js','uiscale.js','depth.js','theme.js','banner.js', 'icons.js', 'delta.js','avatars.js', 'picmemo.js', 'weatherwidgets.js', 'tyrewidgets.js', 'pacewidgets.js', 'boardorder.js', 'strategywidgets.js', 'pitwidgets.js', 'allinone.js', 'chartextras.js', 'chartwidgets.js', 'widgets.js', 'frame.js', 'laphighlights.js', 'widgetview.js', 'backdrop.js','audiocalls.js','announcer.js','sound.js', 'timing.js', 'rows.js', 'richtext.js', 'report.js', 'canvas.js', 'liveshare.js','widgetpreview.js', 'review.js', 'adjustpad.js', 'adjustui.js', 'lanecards.js', 'dirfolder.js', 'penaltyui.js', 'rotationwords.js', 'championshipwords.js', 'rotationdrag.js','padui.js','livegrid.js', 'homegrid.js', 'drivergrid.js', 'homecards.js', 'liveview.js', 'setupwords.js', 'systemwords.js', 'formui.js', 'railform.js', 'temperatureeditor.js', 'database.js', 'landing.js', 'race.js', 'undo.js', 'editor.js', 'charteditor.js','tokenui.js', 'bopui.js', 'enduranceui.js', 'damageui.js', 'weatherui.js', 'tyreui.js', 'pushsaveui.js', 'virtualrivalui.js', 'rotationui.js', 'championshipui.js', 'audiostudio.js','audioedit.js','widgetbuilder.js','transferui.js','themeui.js','hardware.js','trackmate.js','hardwareui.js', 'dsui.js', 'app.js']) vm.runInContext(fs.readFileSync(R + 'renderer/' + f, 'utf8'), ctx, { filename: f });
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

const car = i => eng().cars[i];
const events = type => eng().events.filter(e => e.type === type);
const ctrlKey = n => run('live').key({ key: String(n), code: 'Digit' + n, ctrlKey: true, target: { matches: () => false }, preventDefault() {} });
const shiftKey = n => run('live').key({ key: '!', code: 'Digit' + n, shiftKey: true, target: { matches: () => false }, preventDefault() {} });
const folders = () => [...E('racehost').innerHTML.matchAll(/class="dbfolder dirfolder(?: dir-(\w+))?" data-dirf="(\w+)"(?: id="([\w-]+)")?( open)?>/g)].map(m => ({ tone: m[1] || '', id: m[2], dom: m[3], open: !!m[4] }));
const btn = (arr, i) => run(`live.${arr}[${i}].b`);
const cardOf = lane => dom.created.filter(e => e.attrs['data-lc-lane'] === String(lane)).pop();
const padOf = (lane, g) => cardOf(lane).querySelector(`[data-pad="${g}"]`);
const plus = (lane, g) => padOf(lane, g).querySelector('.lc-pp'), minus = (lane, g) => padOf(lane, g).querySelector('.lc-pm'), value = (lane, g) => padOf(lane, g).querySelector('.lc-val');
const popOf = (lane, k) => cardOf(lane).querySelector(`[data-lc-pop="${k}"]`);
const rootEl = () => dom.created.filter(e => e.attrs['data-lc-root']).pop();
const cards = () => run('live.lcPanel');
const press = el => cards().click(el); // (the race window takes the clicks of its cards with box.onclick; the stand-in page has no events, so the click is given to the cards)
const fresh = () => { dom.created.length = 0; };

(async () => {
  await wait(50); ctx.__sent = sent;
  store.damagesystems = [{ id: 'dm1', name: 'Standard', stop: 'overlap', deslotPoints: 1, latePoints: 1, earlyPoints: 1, levels: [{ name: 'Light damage', from: 3, seconds: 0.2, urgency: 'whenever', within: 0, action: 'repair' }], incidents: [{ name: 'Contact', points: 2 }, { name: 'Hard crash', points: 4 }] }];
  store.penaltysystems = [{ id: 'p1', name: 'Standard', everyPoints: 5, everySeconds: 5, types: [{ name: 'Drivethrough', kind: 'drivethrough', cost: 2 }] }];
  store.weathersystems = [{ id: 'w1', name: 'Showers', unit: 'laps', startMode: 'point', startAt: 2, rainMode: 'fixed', rainFor: 3, cloudyFor: 1, clearingFor: 1, react: 2, wetPoints: 2, dryPoints: 2 },
    { id: 'w2', name: 'By hand', unit: 'laps', startMode: 'director', rainMode: 'fixed', rainFor: 3, cloudyFor: 1, clearingFor: 1, react: 2, wetPoints: 2, dryPoints: 2 }];
  const full = over => ({ id: 'lc1', name: 'Everything', sessionType: 'race', laps: 6, endRule: 'all', layout: '', fuelRules: 'f1', bop: 'on', penaltySystem: 'p1', damageSystem: 'dm1', weather: 'w2', pitHold: 0.1, ...over });
  const track = store.tracks[0];
  api.getSettings = async () => JSON.parse(JSON.stringify({ theme: 'dark', rules: 'Be kind. No bumping.', ...vm.runInContext('state.settings', ctx) })); // (the page reads the settings when it opens: here they are the ones this test has set, as in the app, which keeps them)
  const finish = async () => { run('state.race = null; live = null'); saved.length = 0; };

  // ---------- a race with everything: the cards take the place of five folders ----------
  fresh(); await openRace(full(), track, rows(1, 2));
  let f = folders(), html = E('racehost').innerHTML;
  say('the Race tab has: Track actions, Race Director (the cards), Weather and Tyre Change; the folders Adjust, Penalties, Balance of Power and Damage are gone', f.map(x => x.id).join() === 'track,director,weather,tyre' && !/data-dirf="(adjust|penalties|bop|damage|failures)"/.test(html));
  say('...the Race Director folder is plain (no colour), has its own id, and is open', f[1].tone === 'plain' && f[1].dom === 'fd-director' && f[1].open === true && html.includes('id="lcpanel"'));
  say('the cards are built (a card for each lane), and the panels of the old folders are not', !!cards() && !!cardOf(0) && !!cardOf(1) && !run('live.penPanel') && !run('live.adjPanel') && !run('live.bopPanel') && !run('live.dmPanel') && !run('live.flPanel'));
  say('the weather folder keeps the tyres of the cars but not the row of state buttons (the cards have them)', !/data-wx="(dry|cloudy|wet|clearing)"/.test(E('wxpanel').innerHTML) && dom.created.filter(e => e.attrs['data-lc-wx']).length > 1);
  say('before the start the cards are there and nothing on them works', E('fd-director').hidden === false && [0, 1].every(l => plus(l, 'points').disabled && plus(l, 'time').disabled && plus(l, 'laps').disabled && plus(l, 'damage').disabled) && cards().view().racing === false);
  key(' '); await until(() => phase() === 'running', 5000); await wait(200);
  say('when the race runs the pads work, and the cards carry the names of the drivers', !plus(0, 'time').disabled && !plus(1, 'points').disabled && minus(0, 'points').disabled && cardOf(0).querySelector('.lc-who').textContent === car(0).driverName && cardOf(1).querySelector('.lc-who').textContent === car(1).driverName);

  // the buttons act on the race window's own race
  press(plus(0, 'points')); press(plus(0, 'points')); press(plus(1, 'time')); press(plus(1, 'laps')); press(plus(0, 'damage'));
  say('+ on penalty points (twice), time, laps and damage: the race has them (2 points for lane 1, 5 s and a lap for lane 2, a damage point for lane 1)', car(0).points === 2 && car(1).adjMs === 5000 && car(1).adjLaps === 1 && car(0).dmg === 1 && car(1).points === 0);
  await wait(60);
  say('...and the cards show them: 2, +5 s, +1, 1', value(0, 'points').textContent === '2' && value(1, 'time').textContent === '+5 s' && value(1, 'laps').textContent === '+1' && value(0, 'damage').textContent === '1');
  await until(() => sent.dyn && sent.dyn.cars && sent.dyn.cars[0].points === 2, 4000);
  say('...the race window shared the change with the other screens', sent.dyn && sent.dyn.cars && sent.dyn.cars[0].points === 2);
  press(dom.created.filter(e => e.attrs['data-lc-undo']).pop());
  say('Undo takes the last press back (the damage point)', car(0).dmg === 0 && value(0, 'damage').textContent === '0');
  say('the pop-up amounts follow the Pad values (5, 10 and 30 seconds by default), and 10 s from it goes to the race', (() => { press(value(0, 'time')); const p = popOf(0, 'amt:time'); const ok = p.hidden === false && !!p.querySelector('[data-v="10"][data-sign="1"]') && !!p.querySelector('[data-v="30"][data-sign="-1"]'); press(p.querySelector('[data-v="10"][data-sign="1"]')); return ok && car(0).adjMs === 10000; })());
  press(popOf(0, 'amt:time').querySelector('[data-v="10"][data-sign="-1"]'));
  say('...and 10 s taken off again', car(0).adjMs === 0);

  // named penalty, incident, failure, balance of power
  press(cardOf(0).querySelector('[data-lc-open="pen"]')); const pbs = popOf(0, 'pen').querySelectorAll('[data-lc-pen]');
  say('Penalty ▾ lists the penalty of the system with its cost; lane 1 has 2 points, so Drivethrough (−2) works', pbs.length === 1 && pbs[0].textContent === 'Drivethrough (−2)' && pbs[0].disabled === false);
  press(pbs[0]); await wait(60);
  say('it is given: the Drivethrough waits to be served, the 2 points are paid, the card says so', car(0).pending.length === 1 && car(0).pending[0].name === 'Drivethrough' && car(0).points === 0 && cardOf(0).querySelector('.lc-chips').children.some(c => c.textContent.includes('Drivethrough to serve')));
  press(cardOf(1).querySelector('[data-lc-open="dmg"]')); press(popOf(1, 'dmg').querySelectorAll('[data-lc-inc]')[1]); await wait(60);
  say('Damage ▾ > Hard crash gives 4 damage points to lane 2', car(1).dmg === 4 && value(1, 'damage').textContent === '4');
  const bopB = (l, k) => cardOf(l).querySelector(`[data-lc-bop="${k}"]`);
  press(bopB(1, 'hinder')); await wait(60);
  say('Hinder on lane 2: the car is hindered (Balance of Power), and its button is pressed', car(1).bop < 0 && bopB(1, 'hinder').getAttribute('aria-pressed') === 'true' && car(0).bop === 0);
  const wxb = dom.created.filter(e => e.attrs['data-lc-wx']); const target = wxb.find(b => b.attrs['aria-pressed'] === 'false' && !b.disabled);
  press(target); await wait(60);
  say('a weather button sets the weather (the Race Director chooses it in this weather system)', eng().weather !== null && run('Wx.view')(eng(), 'running', nowMs(), [0, 1]).buttons.find(b => b.state === target.attrs['data-lc-wx']).on === true);
  press(cardOf(0).querySelector('[data-lc-tyre]'));
  say('the tyre button of a card opens the Tyre Change folder (the page asks for it to be open)', run('document.getElementById')('fd-tyre') !== undefined);
  key(' '); await wait(60);
  say('Space still pauses the race after the buttons were pressed (the buttons do not keep the focus)', phase() === 'paused');
  press(plus(0, 'laps'));
  say('while the race is paused the pads work, as before', car(0).adjLaps === 1);
  key(' '); await wait(40);
  key('s'); await until(() => phase() === 'finished', 5000); await wait(150);
  say('after the finish the cards are switched off', plus(0, 'laps').disabled === true && cards().view().racing === false);
  await finish();

  // ---------- the setting brings the folders back ----------
  run("state.settings.directorView = 'folders'");
  fresh(); await openRace(full({ id: 'lc2' }), track, rows(1, 2));
  f = folders(); html = E('racehost').innerHTML;
  say('App Settings > Race Director view: "folders" gives the old folders back (Track actions, Adjust, Penalties, Balance of Power, Damage, Weather, Tyre Change)', f.map(x => x.id).join() === 'track,adjust,penalties,bop,damage,weather,tyre' && !html.includes('id="lcpanel"') && !run('live.lcPanel'));
  say('...with their panels, and the weather has its state buttons again', !!run('live.adjPanel') && !!run('live.penPanel') && !!run('live.bopPanel') && !!run('live.dmPanel') && /data-wx="(dry|cloudy|wet|clearing)"/.test(E('wxpanel').innerHTML));
  await finish();
  run("state.settings.directorView = 'cards'");
  fresh(); await openRace(full({ id: 'lc2b' }), track, rows(1, 2));
  say('..."cards" gives the cards again', folders().map(x => x.id).join() === 'track,director,weather,tyre' && !!run('live.lcPanel'));
  await finish(); run('delete state.settings.directorView');

  // ---------- the races that need less ----------
  fresh(); await openRace(full({ id: 'lc3', sessionType: 'practice', duration: 5, fuelRules: '', bop: '', penaltySystem: '', damageSystem: '', weather: '' }), track, rows(1, 2));
  say('a practice without systems has the Track actions, the Race Director folder (hidden: nothing to adjust) and Tyre Change', folders().map(x => x.id).join() === 'track,director,tyre' && E('fd-director').hidden === true && cards().usable() === false);
  await finish();
  fresh(); await openRace(full({ id: 'lc3b', penaltySystem: '', damageSystem: '', bop: '', weather: '' }), track, rows(1, 2));
  say('a race without systems still has time and laps to adjust: the cards show those two pads only', E('fd-director').hidden === false && cards().view().groups.join() === 'time,laps' && padOf(0, 'points').hidden === true && padOf(0, 'damage').hidden === true && padOf(0, 'time').hidden === false);
  await finish();
  fresh(); await openRace({ id: 'lc4', name: 'Tokens', sessionType: 'tokens', layout: '' }, store.tracks[1], rows(1, 2));
  say('a Time Token Session has no lane cards: Track actions and Time tokens, as before', folders().map(x => x.id + ':' + x.tone).join() === 'track:green,tokens:teal' && !E('racehost').innerHTML.includes('id="lcpanel"') && !run('live.lcPanel'));
  await finish();

  // ---------- four lanes ----------
  fresh(); await openRace(full({ id: 'lc5' }), store.tracks[1], rows(1, 2, 3, 4));
  say('a track with 4 lanes has 4 cards and the log as a drawer; 2 lanes keep the log next to the cards', [0, 1, 2, 3].every(l => !!cardOf(l)) && rootEl().attrs['data-n'] === '4' && rootEl().attrs['data-log'] === 'drawer');
  await finish();
  fresh(); await openRace(full({ id: 'lc5b' }), track, rows(1, 2));
  say('...(2 lanes)', rootEl().attrs['data-n'] === '2' && rootEl().attrs['data-log'] === 'docked');

  // ---------- the pad lists: the buttons follow what the Race Director made of the lists ----------
  await finish();
  run("state.settings.padSeconds = [15, 30]; state.settings.padPoints = [2]");
  fresh(); await openRace(full({ id: 'lc6' }), track, rows(1, 2)); key(' '); await until(() => phase() === 'running', 5000); await wait(150);
  press(plus(0, 'time')); press(plus(0, 'points'));
  say('lists of the Race Director: + adds the first value (15 s, 2 points) and the pop-up has the rest', car(0).adjMs === 15000 && car(0).points === 2 && plus(0, 'time').attrs['data-v'] === '15' && !!popOf(0, 'amt:time').querySelector('[data-v="30"]'));
  key('s'); await until(() => phase() === 'finished', 5000); await wait(100); await finish();
  run("state.settings.padSeconds = undefined; state.settings.padPoints = undefined; delete state.settings.padSeconds; delete state.settings.padPoints");
  say('retired setup overrides do not change the App Settings pad value (5 s)', await (async () => { fresh(); await openRace(full({ id: 'lc6b', padSeconds: [3, 6] }), track, rows(1, 2)); key(' '); await until(() => phase() === 'running', 5000); await wait(150); press(plus(1, 'time')); const ok = car(1).adjMs === 5000; key('s'); await until(() => phase() === 'finished', 5000); await wait(100); await finish(); return ok; })());

  // ---------- the Race Director page (a phone, a tablet, a second computer) ----------
  fresh(); await openRace(full({ id: 'lc7' }), track, rows(1, 2)); key(' '); await until(() => phase() === 'running', 5000); await wait(1300);
  fresh(); await run('LiveView.mount')(document.createElement('div'), {}); await wait(50); run('LiveView.go')('director'); await wait(120);
  const body = E('lv-body'), page = body.innerHTML;
  say('the Race Director page has one folder with the cards instead of Adjust, Penalties, Balance of Power, Damage and Car Failures', page.includes('id="dir-cards"') && !/data-dirf="(adjust|penalties|bop|damage|failures)"/.test(page) && ['dir-adj', 'dir-bop', 'dir-dm', 'dir-fl'].every(id => !page.includes(`id="${id}"`)) && !!cardOf(0) && !!cardOf(1));
  say('the weather folder of the page has the lanes and tyres but not the state buttons (the cards have them)', E('dir-wx').innerHTML.includes('data-lane=') && !/data-wx="(dry|cloudy|wet|clearing)"/.test(E('dir-wx').innerHTML));
  const clicksBefore = dom.count('click'), keysBefore = dom.count('keydown');
  const before = cmds.length, pclick = el => body.onclick({ target: el });
  const repaint = async () => { await wait(1300); cbs.dyn.forEach(f => f(plain(sent.dyn))); await wait(60); }; // (the race window shares its state about once a second; the page is given the message, as in the other screen tests)
  pclick(plus(1, 'points')); await wait(80);
  say('+ on the page is a command to the race window ({type:pad, group, lane, amount}) and the race window carries it out', cmds.length === before + 1 && same_(cmds.at(-1), { type: 'pad', group: 'points', lane: 1, amount: 1 }) && car(1).points === 1);
  await repaint();
  say('...and the page follows: the card shows the point (the race sends its state back)', value(1, 'points').textContent === '1' && cardOf(1).querySelector('[data-lc-open="pen"]').disabled === false);
  pclick(plus(0, 'time')); await wait(80);
  say('time on the page: 5 s for lane 1', same_(cmds.at(-1), { type: 'pad', group: 'time', lane: 0, amount: 5 }) && car(0).adjMs === 5000);
  pclick(cardOf(0).querySelector('[data-lc-open="dmg"]')); pclick(popOf(0, 'dmg').querySelectorAll('[data-lc-inc]')[0]); await wait(80);
  say('an incident from the page is the damage command, with its points', same_(cmds.at(-1), { type: 'damage', lane: 0, n: 2 }) && car(0).dmg === 2);
  pclick(cardOf(1).querySelector('[data-lc-bop="hinder"]')); await wait(80);
  say('Balance of Power from the page is the bop command', same_(cmds.at(-1), { type: 'bop', lane: 1, how: 'hinder' }) && car(1).bop < 0);
  pclick(cardOf(1).querySelector('[data-lc-open="pen"]')); const pp = popOf(1, 'pen').querySelectorAll('[data-lc-pen]');
  say('the penalties of the system are on the page, and a car with too few points cannot buy one (lane 2 has 1 point, Drivethrough costs 2)', pp.length === 1 && pp[0].disabled === true && popOf(1, 'pen').hidden === false);
  pclick(plus(1, 'points')); await repaint();
  say('...after another point it can: the button is on (the page knows from the race, not from its own guess)', car(1).points === 2 && popOf(1, 'pen').hidden === false && pp[0].disabled === false);
  pclick(pp[0]); await wait(120);
  say('with 2 points it is given from the page ({type:assign, lane, typeIndex})', same_(cmds.at(-1), { type: 'assign', lane: 1, typeIndex: 0 }) && car(1).pending.length === 1);
  const wx = dom.created.filter(e => e.attrs['data-lc-wx']).pop(); pclick(wx); await wait(80);
  say('a weather button on the page is the weather command', cmds.at(-1).type === 'weather' && cmds.at(-1).state === wx.attrs['data-lc-wx']);
  pclick(dom.created.filter(e => e.attrs['data-lc-pick'] === '1').pop()); const pickedOnPage = cardOf(1).attrs['data-sel'] === 'true' && cardOf(0).attrs['data-sel'] === 'false';
  cbs.stat.forEach(f => f({ ...JSON.parse(JSON.stringify(sent.stat)), raceId: 'another-race' })); await wait(60); cbs.dyn.forEach(f => f({ ...plain(sent.dyn), raceId: 'another-race' })); await wait(120); // (a new race: the page is given its description, and then its first state, both with the id of the new race)
  say('a new race on the page (its race id changes): the lane that was picked and Undo start again', pickedOnPage && cardOf(0).attrs['data-sel'] === 'true' && cardOf(1).attrs['data-sel'] === 'false' && dom.created.filter(e => e.attrs['data-lc-undo']).pop().disabled === true);
  run('LiveView.unmount')();
  say('when the page is closed the cards let go of the clicks and the keys of the document', dom.count('click') === clicksBefore - 1 && dom.count('keydown') === keysBefore - 1);
  key('s'); await until(() => phase() === 'finished', 5000); await wait(100); await finish();

  // a Time Token Session on the page, and the setting "folders"
  fresh(); run("state.settings.directorView = 'folders'");
  await openRace(full({ id: 'lc8' }), track, rows(1, 2)); key(' '); await until(() => phase() === 'running', 5000); await wait(1300);
  await run('LiveView.mount')(document.createElement('div'), {}); await wait(50); run('LiveView.go')('director'); await wait(120);
  say('with the setting on "folders" the Race Director page has the old folders (Adjust, Penalties, Balance of Power, Damage) and no cards', /data-dirf="adjust"/.test(E('lv-body').innerHTML) && /data-dirf="penalties"/.test(E('lv-body').innerHTML) && /data-dirf="bop"/.test(E('lv-body').innerHTML) && /data-dirf="damage"/.test(E('lv-body').innerHTML) && !E('lv-body').innerHTML.includes('id="dir-cards"'));
  run('LiveView.unmount')(); key('s'); await until(() => phase() === 'finished', 5000); await wait(100); await finish(); run('delete state.settings.directorView');

  reachedEnd = true;
  console.log(fails ? fails + ' LANE CARD SCREEN TESTS FAILED' : 'ALL LANE CARD SCREEN TESTS PASSED'); process.exit(fails ? 1 : 0);
})();
