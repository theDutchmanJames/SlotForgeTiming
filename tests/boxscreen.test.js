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
  schema: async () => schema, getSettings: async () => ({ theme: 'dark', rules: 'Be kind. No bumping.', timingHw: 'arduino' }), setSettings: async p => ({ ...(ctx.__ready ? vm.runInContext('state.settings', ctx) : {}), ...p }), dbPath: async () => 'x',
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
for (const f of ['listnum.js', 'bop.js', 'weather.js', 'tyrewear.js', 'safetycar.js', 'pushsave.js', 'endurance.js', 'failures.js', 'damage.js', 'engine.js', 'heats.js', 'rotation.js', 'championship.js', 'champpoints.js', 'tokens.js', 'speed.js', 'distance.js','stats.js','homestats.js','carstats.js','viewset.js','picture.js','uiscale.js','depth.js','theme.js','banner.js', 'icons.js', 'delta.js','avatars.js', 'picmemo.js', 'weatherwidgets.js', 'tyrewidgets.js', 'pacewidgets.js', 'boardorder.js', 'widgets.js', 'frame.js', 'backdrop.js','announcer.js','sound.js', 'timing.js', 'rows.js', 'richtext.js', 'report.js', 'canvas.js', 'liveshare.js', 'review.js', 'adjustpad.js', 'adjustui.js', 'dirfolder.js', 'penaltyui.js', 'rotationdrag.js','padui.js','livegrid.js', 'homegrid.js', 'drivergrid.js', 'homecards.js', 'liveview.js', 'database.js', 'landing.js', 'race.js', 'undo.js', 'editor.js','tokenui.js', 'bopui.js', 'enduranceui.js', 'damageui.js', 'weatherui.js', 'tyreui.js', 'pushsaveui.js', 'rotationui.js', 'championshipui.js', 'audioedit.js','widgetbuilder.js','transferui.js','themeui.js','hardware.js','trackmate.js','hardwareui.js', 'dsui.js', 'arduinobox.js', 'arduinorace.js', 'app.js']) vm.runInContext(fs.readFileSync(R + 'renderer/' + f, 'utf8'), ctx, { filename: f });
const run = s => vm.runInContext(s, ctx), E = id => document.getElementById(id);
const say = (m, c, extra) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (!c && extra ? '  [' + extra + ']' : '')); if (!c) fails++; };
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


(async () => {
  await wait(50);
  store.tracks = [{ id: 't1', name: 'Two lanes', lanes: 2 }];
  const tx = []; ctx.__tx = tx;
  const sentNow = () => tx.splice(0).join(' ');
  const hit = lane => run(`ArduinoBox.link.emit({ type: 'hit', lane: ${lane}, at: performance.now() })`);
  const lapsOf = () => JSON.stringify(eng().cars.map(c => c.laps.length));
  const setup = { id: 's1', name: 'Race', sessionType: 'race', laps: 3, endRule: 'all', startPower: 'on' };

  // ---- a race without a box connected: nothing is bound, nothing is sent ----
  await openRace(setup, store.tracks[0], rows(1, 2));
  say('1.37.0: with no box connected the race binds nothing to it', run('live.box') === undefined || run('live.box') === null);
  run('live.leave && live.leave()'); await wait(20);

  // ---- a race with the box (the race setup says nothing about the box: the defaults) ----
  run('var abConnected = () => ArduinoBox.link.connected'); // (the Arduino page of the app tells the race whether the box is connected; the page itself is not part of this test)
  run("ArduinoBox.link.setSender(b => __tx.push(String.fromCharCode.apply(null, Array.from(b)).trim())); ArduinoBox.link.setConnected(true)");
  await openRace(setup, store.tracks[0], rows(1, 2));
  const opened = sentNow();
  say('the race screen tells the box what it needs when it opens: the readings stream off, the track power on (the race setup says on) and the lights out', /\bZ0\b/.test(opened) && /\bM1\b/.test(opened) && /\bL0\b/.test(opened), opened);
  say('...and the status line of the race says the Arduino box is connected', String(E('tmstatus').textContent || '').includes('Arduino box connected'), String(E('tmstatus').textContent));
  hit(0); await wait(20);
  say('a crossing before the start does nothing', eng().cars[0].laps.length === 0);
  key(' '); await until(() => phase() === 'countdown', 3000);
  await wait(10); hit(1);   // a car crossing during the countdown (a jump start): the jump-start handling is not built yet, so it is ignored
  await until(() => phase() === 'running', 12000); await wait(60);
  const start = sentNow();
  say('the start lights follow the countdown, a short beep with every light, and GO is a green light with a long beep', /L1 B1 L2 B1 L3 B1 L4 B1 L5 B1/.test(start) && /LG B3/.test(start), start);
  say('the race runs, and the crossing during the countdown did not count', phase() === 'running' && lapsOf() === '[0,0]');
  hit(0); await wait(30); hit(1); await wait(30); hit(0); await wait(30);
  say('crossings from the box count laps (lane 1 twice, lane 2 once)', lapsOf() === '[2,1]');
  run("ArduinoBox.link.emit({ type: 'pit', pit: 1, in: true, at: performance.now() })"); await wait(20);
  say('a pit sensor makes the car of its lane stop its lap (the pit stop starts)', eng().cars[1].blockAt !== null && eng().cars[1].blockAt !== undefined);
  run("ArduinoBox.link.emit({ type: 'pit', pit: 1, in: false, at: performance.now() })"); await wait(20);
  run("ArduinoBox.link.emit({ type: 'trap', lane: 0, ms: 37, at: performance.now() })"); await wait(10);
  say('the speed trap figure is kept on the car (the widget for it is not built yet)', eng().cars[0].trapMs === 37);
  sentNow();
  run('live.actions.yellow()'); await wait(30); const y1 = sentNow();
  run('live.actions.yellow()'); await wait(30); const y2 = sentNow();
  run('live.actions.red()'); await wait(30); const r1 = sentNow();
  run('live.actions.red()'); await wait(60); const r2 = sentNow();
  say('the lights follow the flags: yellow, green again, red (STOP), green again', /\bLY\b/.test(y1) && /\bLG\b/.test(y2) && /\bLS\b/.test(r1) && /\bLG\b/.test(r2), [y1, y2, r1, r2].join(' | '));
  run("ArduinoBox.link.emit({ type: 'call', at: performance.now() })"); await wait(30);
  say('the Track call button of the box does what the Trackcall choice says (one press: yellow flag)', eng().flag === 'yellow' && /\bLY\b/.test(sentNow()));
  run('live.actions.yellow()'); await wait(30); sentNow();
  hit(0); await wait(30); hit(0); await wait(30); hit(1); await wait(30); hit(1); await wait(30); hit(1); await wait(80);
  say('the race ends on the box laps, and the lights show STOP', phase() === 'finished' && lapsOf() === '[3,3]' && /\bLS\b/.test(sentNow()));
  run('live.leave && live.leave()'); await wait(30);
  const left = sentNow();
  say('leaving the race screen sets the lights to STOP and lets go of the box', /\bLS\b/.test(left) && (run('live.box') === undefined || run('live.box') === null), left);
  hit(0); await wait(20);
  say('...and a crossing after that is not heard by the race any more', lapsOf() === '[3,3]');

  // ---- the race setup fields of the box: the form has Yes/No choices, the box wants true/false ----
  await openRace({ ...setup, boxBeeps: 'no' }, store.tracks[0], rows(1, 2)); sentNow();
  key(' '); await until(() => phase() === 'countdown', 3000); await until(() => phase() === 'running', 12000); await wait(60);
  const quiet = sentNow();
  say('1.37.0: "The box beeps the countdown and GO: No" gives the lights but no beeps', /L1 L2 L3 L4 L5/.test(quiet) && !/\bB\d\b/.test(quiet), quiet);
  run('live.leave && live.leave()'); await wait(20);
  await openRace({ ...setup, startPower: 'off' }, store.tracks[0], rows(1, 2));
  say('"Track power when a race starts: Off" switches the box power off when the race screen opens', /\bM0\b/.test(sentNow()));
  run('live.leave && live.leave()'); await wait(20);
  await openRace(setup, store.tracks[0], rows(1, 2)); sentNow();
  await openRace(setup, store.tracks[0], rows(1, 2)); // (another race opened while the first is still on screen: the first one's hold on the box is let go)
  const reopened = sentNow();
  say('a race opened over another one lets go of the first one\'s box binding (the lights go to STOP, then the new race sets its own)', /\bLS\b.*\bL0\b/.test(reopened), reopened);
  run('live.leave && live.leave()'); await wait(20);
  say('the form values: Yes means true and No means false for the box, a setup from before the box has the defaults', run("(s => ({ b: s.boxBeeps !== 'no', l: s.boxLaneLights === 'yes' }))({})").b === true && run("(s => s.boxLaneLights === 'yes')({ boxLaneLights: 'yes' })") === true);

  // ---- 1.39.0: one timing hardware at a time. The box is connected, but the Trackmate (or nothing) was chosen: the race does not bind to the box and does not touch it ----
  for (const other of ['trackmate', 'none']) {
    run(`state.settings.timingHw = '${other}'`); sentNow();
    await openRace(setup, store.tracks[0], rows(1, 2));
    say(`1.39.0: with ${other === 'none' ? 'no timing hardware' : 'the Trackmate'} chosen a connected box is left alone: nothing is bound and nothing is sent to it`, (run('live.box') === undefined || run('live.box') === null) && sentNow() === '');
    key(' '); await until(() => phase() === 'countdown', 3000); await until(() => phase() === 'running', 12000); await wait(40);
    hit(0); await wait(30);
    say('...and its crossings do not count laps', lapsOf() === '[0,0]');
    say('...the status line names the hardware that was chosen', other === 'none' ? String(E('tmstatus').textContent).includes('No timing hardware chosen') : String(E('tmstatus').textContent).includes('Trackmate not connected'), String(E('tmstatus').textContent));
    run('live.leave && live.leave()'); await wait(20);
  }
  run("state.settings.timingHw = 'arduino'"); sentNow();
  const marks = []; E('tmstatus').classList = { add() {}, remove() {}, toggle: (c, on) => marks.push(c + ':' + on) }; // (the page of the test only records the class)
  await openRace(setup, store.tracks[0], rows(1, 2));
  say('...and with the Arduino box chosen it is bound again', run('live.box') !== undefined && run('live.box') !== null);
  say('...its status line has no red mark while the box is connected', marks.length > 0 && marks[marks.length - 1] === 'hwwarn:false', marks.join());
  run("ArduinoBox.link.setConnected(false)"); await wait(10);
  say('...and when the box goes away the status line says so, in red', String(E('tmstatus').textContent).includes('Arduino box not connected') && marks[marks.length - 1] === 'hwwarn:true', String(E('tmstatus').textContent) + ' ' + marks.join());
  run('live.leave && live.leave()'); await wait(20);

  timers.forEach(t => clearInterval(t));
  reachedEnd = true;
  console.log(fails ? 'FAILED' : 'ALL BOX SCREEN TESTS PASSED'); process.exit(fails ? 1 : 0);
})();
