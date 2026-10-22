// 1.15.0: the Race tab as folders (like the Race Director page): the order and the colours of the folders, the Track actions cards (Lap, Pit, Call), the Penalties folder, a closed folder that stays closed,
// and the Time token session's folders, against a stand-in for the app window.
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
  getElementById: id => els[id] || (els[id] = mk(id)), documentElement: { dataset: {}, style: { setProperty() {} } }, body: { contains: () => true }, createElement: () => { const el = mk(), attrs = {}; el.setAttribute = (k, v) => { attrs[k] = String(v); }; el.attrs = attrs; return el; } };
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
for (const f of ['listnum.js', 'bop.js', 'weather.js', 'tyrewear.js', 'safetycar.js', 'pushsave.js', 'racelimit.js', 'endurance.js', 'failures.js', 'damage.js', 'engine.js', 'heats.js', 'rotation.js', 'championship.js', 'champpoints.js', 'season.js', 'tokens.js', 'speed.js', 'distance.js','stats.js','homestats.js','carstats.js','viewset.js','picture.js','uiscale.js','depth.js','theme.js','banner.js', 'icons.js', 'delta.js','avatars.js', 'picmemo.js', 'weatherwidgets.js', 'tyrewidgets.js', 'pacewidgets.js', 'boardorder.js', 'widgets.js', 'frame.js', 'backdrop.js','announcer.js','sound.js', 'timing.js', 'rows.js', 'richtext.js', 'report.js', 'canvas.js', 'liveshare.js', 'review.js', 'adjustpad.js', 'adjustui.js', 'dirfolder.js', 'penaltyui.js', 'rotationdrag.js','padui.js','livegrid.js', 'homegrid.js', 'drivergrid.js', 'homecards.js', 'liveview.js', 'setupwords.js', 'systemwords.js', 'formui.js', 'railform.js', 'database.js', 'landing.js', 'race.js', 'undo.js', 'editor.js','tokenui.js', 'bopui.js', 'enduranceui.js', 'damageui.js', 'weatherui.js', 'tyreui.js', 'pushsaveui.js', 'rotationui.js', 'championshipui.js', 'audioedit.js','widgetbuilder.js','transferui.js','themeui.js','hardware.js','trackmate.js','hardwareui.js', 'dsui.js', 'app.js']) vm.runInContext(fs.readFileSync(R + 'renderer/' + f, 'utf8'), ctx, { filename: f });
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

(async () => {
  await wait(50); ctx.__sent = sent;
  store.damagesystems = [{ id: 'dm1', name: 'Standard', stop: 'overlap', deslotPoints: 1, latePoints: 1, earlyPoints: 1, levels: [{ name: 'Light damage', from: 3, seconds: 0.2, urgency: 'whenever', within: 0, action: 'repair' }], incidents: [{ name: 'Contact', points: 2 }, { name: 'Hard crash', points: 4 }] }];
  store.penaltysystems = [{ id: 'p1', name: 'Standard', everyPoints: 5, everySeconds: 5, types: [{ name: 'Drivethrough', kind: 'drivethrough', cost: 2 }] }];
  store.weathersystems = [{ id: 'w1', name: 'Showers', unit: 'laps', startMode: 'point', startAt: 2, rainMode: 'fixed', rainFor: 3, cloudyFor: 1, clearingFor: 1, react: 2, wetPoints: 2, dryPoints: 2 }];
  const full = over => ({ id: 'rf1', name: 'Everything', sessionType: 'race', laps: 6, endRule: 'all', layout: '', fuelRules: 'f1', bop: 'on', penaltySystem: 'p1', damageSystem: 'dm1', weather: 'w1', pitHold: 0.1, ...over });
  const track = store.tracks[0];

  // ---------- a race with everything: the folders, in the order and the colours of the Race Director page ----------
  await openRace(full(), track, rows(1, 2));
  const f = folders();
  say('the Race tab has the folders of the Race Director page, in its order: Track actions, Adjust, Penalties, Balance of Power, Damage, Weather, Tyre Change (1.32.0: in every race)', f.map(x => x.id).join() === 'track,adjust,penalties,bop,damage,weather,tyre');
  say('...with the colours: green, plain, yellow, white, red, blue, purple', f.map(x => x.tone).join() === 'green,plain,yellow,white,red,blue,purple');
  say('...each folder has an id of its own on the Race tab, and they are open to begin with', f.every(x => x.dom === 'fd-' + x.id && x.open));
  const html = E('racehost').innerHTML;
  say('the old flat cards and buttons are gone: no Adjust button, no button strips, no cards around the panels', !/id="(adjbtn|lapbtns|pitbtns|callbtns|penbtns)"/.test(html) && !/class="card (boppanel|tkpanel)/.test(html) && !html.includes('class="card boppanel adjpanel"'));
  say('the panels are inside their folders (the panel of a folder has no card of its own)', ['boppanel', 'dmpanel', 'wxpanel', 'typanel'].every(id => new RegExp(`<div class="df-body">[^]*id="${id}" class="boppanel"`).test(html)) && html.includes('id="adjpanel" class="boppanel adjpanel"') && html.includes('id="penpanel"'));
  say('the Calls strip, when there are calls, is above the folders; the review is below them', html.indexOf('id="calls"') > 0 && html.indexOf('id="calls"') < html.indexOf('data-dirf="track"') && html.indexOf('id="review"') > html.indexOf('data-dirf="weather"'));
  say('the keys are said on the page, as before', html.includes('Ctrl + number (or the Call button)'));

  // ---------- the Track actions cards ----------
  say('there is a card for each lane: the buttons Lap, Pit and Call keep their texts and their lists', run('live.trkCards.length') === 2 && run('live.lapBtns.length') === 2 && run('live.pitBtns.length') === 2 && run('live.callBtns.length') === 2
    && ['Lap 1', 'Lap 2'].every((t, i) => btn('lapBtns', i).textContent === t) && ['Pit 1', 'Pit 2'].every((t, i) => btn('pitBtns', i).textContent === t) && ['Call 1', 'Call 2'].every((t, i) => btn('callBtns', i).textContent === t));
  say('the keys are on the buttons: 1 for Lap, Shift + 1 for Pit, Ctrl + 1 for Call', btn('lapBtns', 0).attrs['data-key'] === '1' && btn('pitBtns', 1).attrs['data-key'] === '⇧2' && btn('callBtns', 0).attrs['data-key'] === 'Ctrl 1');
  say('the buttons have a colour of their own (green Lap, orange Pit, amber Call) in the style sheet, and the Pit button lights while the car is in the pit',
    ['trk-lap', 'trk-pit', 'trk-call'].every(c => btn(c === 'trk-lap' ? 'lapBtns' : c === 'trk-pit' ? 'pitBtns' : 'callBtns', 0).className.includes(c)) && /\.trk-pit\[aria-pressed="true"\]/.test(fs.readFileSync(R + 'renderer/styles.css', 'utf8')));
  say('before the start every button is switched off, and the cards carry the names of the drivers once the race is drawn', [0, 1].every(i => btn('lapBtns', i).disabled && btn('pitBtns', i).disabled && btn('callBtns', i).disabled));
  say('1.16.1: ...and the folder says why: the buttons work while the race is running, press Start (or Space) first; a switched off Lap button says so in its tooltip', E('trkhint').hidden === false && E('trkhint').textContent === 'The Lap, Pit and Call buttons work while the race is running. Press Start (or Space) first.' && btn('lapBtns', 0).title.includes('Press Start'));
  key(' '); await until(() => phase() === 'running', 5000); await wait(150);
  say('1.16.1: while the race runs the line is gone, and the Lap button says what it does (counts a lap by hand, as if the sensor had seen the car)', E('trkhint').hidden === true && E('trkhint').textContent === '' && /counts a lap by hand/.test(btn('lapBtns', 0).title) && /sensor/.test(btn('lapBtns', 1).title));
  say('while the race runs the buttons work, and the names are on the cards', [0, 1].every(i => !btn('lapBtns', i).disabled && !btn('pitBtns', i).disabled && !btn('callBtns', i).disabled) && run('live.trkCards[0].who.textContent') === car(0).driverName && run('live.trkCards[1].who.textContent') === car(1).driverName);
  say('...no lane is lit yet (no car in the pit, no call)', btn('pitBtns', 0).attrs['aria-pressed'] === 'false' && btn('callBtns', 0).attrs['data-active'] === 'false');
  key('1'); await wait(60); key('1'); await wait(60); shiftKey(1); await wait(120);
  say('Shift + 1 puts the car in the pit: the button says Leave pit 1 and lights up (the other lane does not)', car(0).blockAt !== null && btn('pitBtns', 0).textContent === 'Leave pit 1' && btn('pitBtns', 0).attrs['aria-pressed'] === 'true' && btn('pitBtns', 1).attrs['aria-pressed'] === 'false');
  btn('pitBtns', 0).onclick(); await wait(150);
  say('the button again: the car drives off, the light goes out', car(0).blockAt === null && btn('pitBtns', 0).textContent === 'Pit 1' && btn('pitBtns', 0).attrs['aria-pressed'] === 'false');
  btn('callBtns', 1).onclick(); await wait(120);
  say('a call from lane 2 lights the Call 2 button (and not Call 1) while it waits for the Race Director', eng().calls.length === 1 && btn('callBtns', 1).attrs['data-active'] === 'true' && btn('callBtns', 0).attrs['data-active'] === 'false');
  E('calls').onclick({ target: { closest: () => ({ dataset: { call: 'dismiss', id: String(eng().calls[0].id) } }) } }); await wait(120);
  say('...and when the call is dismissed the light goes out', btn('callBtns', 1).attrs['data-active'] === 'false');
  key('y'); await wait(40); if (eng().flag === 'yellow') key('y');

  // ---------- the Penalties folder ----------
  const pen = E('penpanel');
  say('the Penalties folder has the table of the Race Director page: a row for each lane, −1, Penalty point +1 and the special penalty of the system, and the log', pen.innerHTML.includes('data-row="0"') && pen.innerHTML.includes('data-row="1"') && pen.innerHTML.includes('data-n="-1"') && pen.innerHTML.includes('Penalty point +1')
    && pen.innerHTML.includes('Drivethrough (−2)') && pen.innerHTML.includes('Penalty log') && !!run('live.penPanel'));
  const press = (cmd, lane, extra = {}) => { pen.onclick({ target: { closest: () => ({ dataset: { cmd, lane: String(lane), ...extra }, disabled: false }) } }); };
  press('penalty', 1, { n: '1' }); press('penalty', 1, { n: '1' });
  say('Penalty point +1 gives the point to that lane, right here (two presses, two points)', car(1).points === 2 && car(0).points === 0);
  press('penalty', 1, { n: '-1' });
  say('−1 takes one back', car(1).points === 1);
  press('assign', 1, { type: '0' });
  say('a special penalty costs points: not with one point', car(1).pending.length === 0 && car(1).points === 1);
  press('penalty', 1, { n: '1' }); press('assign', 1, { type: '0' });
  say('...with two points it is given: the Drivethrough waits to be served, and the points are paid', car(1).pending.length === 1 && car(1).pending[0].name === 'Drivethrough' && car(1).points === 0);
  say('a button that is switched off does nothing', (pen.onclick({ target: { closest: () => ({ dataset: { cmd: 'penalty', lane: '0', n: '1' }, disabled: true }) } }), car(0).points === 0));
  key(' '); await wait(60);
  press('penalty', 0, { n: '1' });
  say('while the race is paused a penalty can be given, as before', phase() === 'paused' && car(0).points === 1);
  say('1.16.1: ...and the line says that Lap and Pit wait for the resume while Call works (the Lap button is off, the Call button is on)', E('trkhint').hidden === false && /paused/.test(E('trkhint').textContent) && /Call works now/.test(E('trkhint').textContent) && btn('lapBtns', 0).disabled && !btn('callBtns', 0).disabled);
  key(' '); await wait(40);
  say('the log is made of the events of the race (the same lines as on the Race Director page)', run('PenaltyPanel.logHtml(live.engine())').includes('must serve: Drivethrough') && run('PenaltyPanel.logHtml(live.engine())').includes('+1 point'));
  run('state.race = null; live = null'); saved.length = 0;

  // ---------- a folder that is closed stays closed ----------
  run("DirFolder.shut.add('track'); DirFolder.shut.add('weather')");
  await openRace(full({ id: 'rf2' }), track, rows(1, 2));
  say('a folder you closed stays closed when the next race is drawn, the others are open', folders().filter(x => !x.open).map(x => x.id).join() === 'track,weather');
  run('DirFolder.shut.clear()');
  run('state.race = null; live = null'); saved.length = 0;

  // ---------- only the folders the race needs ----------
  await openRace(full({ id: 'rf3', sessionType: 'practice', duration: 5, fuelRules: '', bop: '', penaltySystem: '', damageSystem: '', weather: '' }), track, rows(1, 2));
  say('a practice without systems has the Track actions, the Adjust folder (hidden, there is nothing to adjust) and the Tyre Change folder only', folders().map(x => x.id).join() === 'track,adjust,tyre' && E('fd-adjust').hidden === true && !E('racehost').innerHTML.includes('id="penpanel"') && !run('live.penPanel'));
  say('...and no penalty system: no penalty folder, no penalty buttons anywhere', !E('racehost').innerHTML.includes('Penalty point +1') && run('live.penBtns') === undefined);
  run('state.race = null; live = null'); saved.length = 0;

  // ---------- the Time Token Session ----------
  await openRace({ id: 'rf4', name: 'Tokens', sessionType: 'tokens', layout: '' }, store.tracks[1], rows(1, 2));
  const ft = folders();
  say('a Time Token Session has Track actions (green) and Time tokens (teal): no Adjust, no pit buttons', ft.map(x => x.id + ':' + x.tone).join() === 'track:green,tokens:teal' && run('live.pitBtns.length') === 0 && run('live.callBtns.length') === 4);
  say('...the lane controls of the tokens are in their folder', E('racehost').innerHTML.includes('id="tokenpanel" class="tkpanel"') && !!run('live.tkPanel'));
  run('state.race = null; live = null'); saved.length = 0;

  reachedEnd = true;
  console.log(fails ? fails + ' RACE FOLDER TESTS FAILED' : 'ALL RACE FOLDER TESTS PASSED'); process.exit(fails ? 1 : 0);
})();
