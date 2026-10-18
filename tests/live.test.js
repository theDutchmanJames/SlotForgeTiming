// Runs whole races through the live timing page against a stand-in for the app window.
const vm = require('vm'), fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..') + '/';
const schema = require(R + 'schema.js');
let fails = 0;
process.on('unhandledRejection', e => { console.log('UNHANDLED:', e.stack || e.message); process.exit(1); });
const mk = () => new Proxy({ innerHTML: '', style: {}, dataset: {}, hidden: false, value: '', checked: false, disabled: false, classList: { add() {}, remove() {}, toggle() {} } },
  { get: (t, k) => (k in t ? t[k] : () => mk()), set: (t, k, v) => { t[k] = v; return true; } });
const els = {};
const fsCalls = []; let fsWas = false; // what the window was asked: full screen or back, and how it was before
const keyListeners = new Set(); const document = { addEventListener(t, f) { if (t === 'keydown') keyListeners.add(f); }, removeEventListener(t, f) { if (t === 'keydown') keyListeners.delete(f); }, querySelector: () => mk(), querySelectorAll: () => [mk(), mk(), mk()],
  getElementById: id => els[id] || (els[id] = mk()), documentElement: { dataset: {}, style: { setProperty() {} } }, body: { contains: () => true, appended: [], appendChild(e) { this.appended.push(e); const body = this; try { e.parentNode = { removeChild(c) { body.appended = body.appended.filter(x => x !== c); return c; } }; } catch (x) { /* not settable */ } return e; } }, createElement: () => mk() };
const store = {
  tracks: [{ id: 't1', name: 'Living room', lanes: 2 }, { id: 't4', name: 'Big track', lanes: 4 }],
  drivers: [{ id: 'd1', name: 'Alex', nickname: 'Speedy', flag: 'NL' }, { id: 'd2', name: 'Sam' }, { id: 'd3', name: 'Kim' }, { id: 'd4', name: 'Lee' }],
  slotcars: [1, 2, 3, 4].map(i => ({ id: 'c' + i, brand: 'Car' + i })), racesetups: [], layouts: [], rowdesigns: [], sessions: [], laps: []
};
const saved = [];
const sent = { stat: null, dyn: null, n: 0, last: null, log: [], gaps: 0 }, cbs = { stat: [], dyn: [], cmd: [] }, cmds = []; // what the race window shares with other windows (as plain text, like the real link)
// like the app does: the messages of the race window are put together into the whole state (sent.dyn), which a window that opens late is given; sent.last is the last message as it was sent
const merge = (state, m) => vm.runInContext('LiveShare', ctx).applyDynamic(state, m);
const plain = d => { const x = { ...d }; delete x.seq; return x; }; // a whole state without a message number (what an older race window sends): always accepted
const api = { liveStatic: s => { sent.stat = JSON.parse(JSON.stringify(structuredClone(s))); sent.dyn = null; sent.last = null; }, livePush: d => { const m = JSON.parse(JSON.stringify(structuredClone(d))); sent.last = m; sent.log.push(m); sent.n++; const r = merge(sent.dyn, m); if (r.ok) { if (!r.stale) sent.dyn = r.state; } else { sent.dyn = null; sent.gaps++; } },
  liveGet: async () => JSON.parse(JSON.stringify({ stat: sent.stat, dyn: sent.dyn })), onLive: f => { cbs.dyn.push(f); return () => {}; }, onLiveStatic: f => { cbs.stat.push(f); return () => {}; }, liveOpen: async () => ({ second: true }), windowFullscreen: async on => { fsCalls.push(on); return { on: !!on, was: fsWas }; }, liveCommand: c => { cmds.push(c); cbs.cmd.forEach(f => f(JSON.parse(JSON.stringify(c)))); }, onCommand: f => { cbs.cmd.push(f); return () => { cbs.cmd = cbs.cmd.filter(x => x !== f); }; },
  schema: async () => schema, getSettings: async () => ({ theme: 'dark', rules: 'Be kind. No bumping.' }), setSettings: async p => ({ ...(ctx.__ready ? vm.runInContext('state.settings', ctx) : {}), ...p }), dbPath: async () => 'x',
  list: async e => JSON.parse(JSON.stringify(store[e] || [])), customFields: async () => [], linkedLaps: async () => 0,
  saveSession: async (s, l) => { saved.push([s, l]); }, add: async () => ({}), update: async () => ({}), remove: async () => {} };
// the app reports a screen that could not be drawn with console.error: that is a failed test (unless the test expects it)
const appConsole = { ...console, expected: false, seen: 0, error: (...a) => { if (appConsole.expected) { appConsole.seen++; return; } console.log('FAIL the app reported an error: ' + a.map(x => (x && x.stack) || x).join(' ').slice(0, 300)); fails++; } };
// the real app passes everything through Electron's structured clone, which refuses a function ("An object could not be cloned"): every call of the app interface is checked the same way here
for (const k of Object.keys(api)) { const f = api[k]; if (typeof f === 'function') api[k] = (...x) => { x.forEach(v => { if (typeof v !== 'function') structuredClone(v); }); return f(...x); }; }
const ctx = vm.createContext({ document, api, console: appConsole, Intl, URL, Image: function () {}, confirm: () => true, alert() {}, setTimeout, clearTimeout, setInterval, clearInterval, performance });
ctx.__ready = true; ctx.window = ctx; ctx.addEventListener = () => {}; ctx.removeEventListener = () => {};
for (const f of ['listnum.js', 'bop.js', 'weather.js', 'endurance.js', 'damage.js', 'engine.js', 'heats.js', 'rotation.js', 'tokens.js', 'speed.js', 'distance.js','stats.js','homestats.js','carstats.js','viewset.js','picture.js','uiscale.js','theme.js','banner.js', 'icons.js', 'delta.js','avatars.js', 'weatherwidgets.js', 'boardorder.js', 'widgets.js', 'frame.js', 'backdrop.js','announcer.js','sound.js', 'timing.js', 'rows.js', 'richtext.js', 'canvas.js', 'liveshare.js', 'review.js', 'adjustpad.js', 'adjustui.js', 'dirfolder.js', 'penaltyui.js', 'rotationdrag.js','padui.js','livegrid.js', 'homegrid.js', 'drivergrid.js', 'homecards.js', 'liveview.js', 'database.js', 'landing.js', 'race.js', 'undo.js', 'editor.js','tokenui.js', 'bopui.js', 'weatherui.js', 'tyreui.js', 'rotationui.js', 'audioedit.js','widgetbuilder.js','transferui.js','themeui.js','hardware.js','trackmate.js','hardwareui.js', 'dsui.js', 'app.js']) vm.runInContext(fs.readFileSync(R + 'renderer/' + f, 'utf8'), ctx, { filename: f });
const run = s => vm.runInContext(s, ctx), E = id => document.getElementById(id);
const say = (m, c) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (cond, ms = 8000) => { for (let t = 0; t < ms && !cond(); t += 25) await wait(25); };
const key = k => run('live').key({ key: k, target: { matches: () => false }, preventDefault() {} });
const phase = () => run('live.phase');
const node = type => run('live.nodes').find(n => n.w.type === type);
const flagIs = name => { const h = node('flag').val.innerHTML; return h.includes('class="flagsvg"') && h.includes('aria-label="' + name + '"'); }; // the Race Flag widget draws a flag; its label names the state
const rows = (...ids) => ids.map(i => ({ driverId: 'd' + i, carId: 'c' + i }));
const openRace = async (setup, track, r) => { setup = { restartAfterRed: 'resume', ...setup }; run(`state.speed=40; state.race=${JSON.stringify({ setup, track, rows: r })}; state.tab='race'`); await run('render()'); };

(async () => {
  await wait(50); run('state.autoFinalize = true'); // the race review is tested at the end
  // ---------- a race by laps on the default layout ----------
  await openRace({ name: 'Sprint', sessionType: 'race', laps: 3, endRule: 'all', layout: '' }, store.tracks[0], rows(1, 2));
  say('default layout: 25 widgets for a 2-lane track (lanes 3-6 left out)', run('live.nodes.length') === 25 && run('live.nodes').every(n => n.w.lane === null || n.w.lane < 2));
  say('4 lane buttons -> only 2 on this track', run('live.lapBtns.length') === 2);
  say('before the start: flag widget says Pre-Race, names show', flagIs('Pre-Race') && run("live.nodes.find(n=>n.w.type==='name'&&n.w.lane===0).val.innerHTML") === 'Alex');
  say('nickname and flag icon of the driver', run("live.nodes.find(n=>n.w.type==='driverflag'&&n.w.lane===0).val.innerHTML").includes('fi-nl'));
  say('pause button is disabled before the start, start is enabled', node('pause').val.disabled === true && node('start').val.disabled === false);
  key(' ');
  say('Space starts the countdown', phase() === 'countdown');
  await until(() => phase() === 'running');
  say('...then the race runs', phase() === 'running' && flagIs('Racing (green flag)') && node('start').val.disabled === true);
  key('y'); say('Y: yellow flag shows, race keeps running', flagIs('Yellow flag') && phase() === 'running');
  key('y'); say('Y again clears it', flagIs('Racing (green flag)'));
  key('r'); say('R: red flag pauses the race', flagIs('Red flag') && phase() === 'paused' && node('pause').val.innerHTML === 'Resume');
  key('r'); say('R again clears it and the race runs on', phase() === 'running' && flagIs('Racing (green flag)'));
  key(' '); say('Space pauses', phase() === 'paused' && flagIs('Paused'));
  key(' '); say('Space resumes', phase() === 'running');
  node('pause').val.onclick({ currentTarget: { blur() {} } }); say('the Pause widget works like Space', phase() === 'paused');
  node('pause').val.onclick({ currentTarget: { blur() {} } });
  // manual crossings by hand: number keys and Lap buttons, no simulated cars
  const lapOf = lane => run(`live.nodes.find(n=>n.w.type==='lap'&&n.w.lane===${lane}).val.innerHTML`);
  say('before any crossing both cars are on lap 1', lapOf(0) === '1/3' && lapOf(1) === '1/3');
  await wait(60); key('1'); say('key 1 crosses the line on lane 1', lapOf(0) === '2/3' && lapOf(1) === '1/3');
  await wait(60); run('live.lapBtns[1].b.onclick()'); say('the Lap 2 button crosses the line on lane 2', lapOf(1) === '2/3');
  for (let k = 0; k < 12 && phase() !== 'finished'; k++) { await wait(60); key('1'); key('2'); }
  say('the race finished and saved once', phase() === 'finished' && saved.length === 1 && saved[0][0].sessionType === 'race');
  say('both drivers completed 3 laps', saved[0][0].standings.length === 2 && saved[0][0].standings.every(x => x.laps === 3) && saved[0][1].length === 6);
  say('flag widget shows Finished', flagIs('Finished (chequered flag)'));

  // ---------- highlights against earlier laps ----------
  saved.length = 0;
  store.laps = [{ id: 'x1', driverId: 'd1', trackId: 't1', time: 9000, lapNumber: 1 }, { id: 'x2', driverId: 'd2', trackId: 't1', time: 9500, lapNumber: 1 }];
  const W = (type, lane, x, y) => ({ id: type + lane, type, lane, x, y, w: 200, h: 80, textSize: '', textColor: '', bgColor: '', opt: {} });
  store.layouts = [{ id: 'H1', name: 'Highlights', ratioW: 16, ratioH: 9, widgets: [W('recordlap', 0, 0, 0), W('laptime', 0, 200, 0), W('laptime', 1, 400, 0), W('bestlap', 0, 600, 0)] }];
  await openRace({ name: 'Practice', sessionType: 'practice', layout: 'H1' }, store.tracks[0], rows(1, 2));
  say('record lap widget starts from the saved personal best', run("live.nodes.find(n=>n.w.type==='recordlap'&&n.w.lane===0).val.innerHTML") === '9.000');
  E('sim').checked = true; key(' '); await until(() => phase() === 'running');
  await until(() => run('live.flash.size') > 0);
  const lt = run("live.nodes.find(n=>n.w.type==='laptime'&&n.w.lane===0)");
  const f = [...run('live.flash').values()][0];
  say('a lap faster than every saved lap is a track record (gold)', f.kind === 'record');
  say('lap time widget shows the record colour on the crossing', lt.el.style.background === '#ffc400' || run("live.nodes.filter(n=>n.w.type==='laptime').some(n=>n.el.style.background==='#ffc400')"));
  await wait(300);
  say('record lap widget follows the new best', Number(run("live.nodes.find(n=>n.w.type==='recordlap'&&n.w.lane===0).val.innerHTML")) < 9);
  say('practice runs until stopped', phase() === 'running'); run('live.actions.stop()'); await wait(80);
  say('stop saves the laps', phase() === 'finished' && saved.length === 1 && saved[0][1].length > 0);

  // ---------- delta timers on the live page ----------
  saved.length = 0;
  store.laps = [{ id: 'x1', driverId: 'd1', trackId: 't1', time: 9000, lapNumber: 1 }, { id: 'x2', driverId: 'd2', trackId: 't1', time: 9500, lapNumber: 1 }];
  store.layouts = [{ id: 'D1', name: 'Deltas', ratioW: 16, ratioH: 9, widgets: [
    W('drecordlap', 0, 0, 0), W('drecordlap', 1, 200, 0), W('dtrackrecord', 0, 400, 0), W('dbestlap', 0, 600, 0),
    { ...W('dlaptime', 1, 0, 100), opt: { measure: 'self', decimals: '2', arrow: 'none' } }, { ...W('drecordlap', 0, 200, 100), opt: { compare: 'leader' } }] }];
  await openRace({ name: 'Deltas', sessionType: 'practice', layout: 'D1' }, store.tracks[0], rows(1, 2));
  const dn = (type, lane, i = 0) => run(`live.nodes.filter(n=>n.w.type==='${type}'&&n.w.lane===${lane})[${i}]`);
  const badgeOf = n => { const m = /<span class="dlt-badge dlt-(\w+)"[^>]*>(.*?)<\/span>(?:<\/span>)?$/.exec(n.val.innerHTML) || /class="dlt-badge dlt-(\w+)"[^>]*>(.*)$/.exec(n.val.innerHTML); return m ? { kind: m[1], text: m[2].replace(/<[^>]+>/g, '') } : null; };
  say('delta widgets are drawn on the live page', run("live.nodes.filter(n=>/^d(recordlap|trackrecord|bestlap|laptime)$/.test(n.w.type)).length") === 6);
  say('before the start: lane 1 personal best 9.000 against lane 2 (9.500) is a green −0.500', (b => b && b.kind === 'fast' && b.text === '▲−0.500')(badgeOf(dn('drecordlap', 0, 0))) && /9\.000/.test(dn('drecordlap', 0, 0).val.innerHTML));
  say('...and lane 2 against lane 1 is a red +0.500', (b => b && b.kind === 'slow' && b.text === '▼+0.500')(badgeOf(dn('drecordlap', 1, 0))));
  say('...against the leader, the leader itself has nothing to compare with (a dash)', (b => b && b.kind === 'none')(badgeOf(dn('drecordlap', 0, 1))));
  say('the track record delta starts at zero against the best saved lap (equal, grey)', (b => b && b.kind === 'equal')(badgeOf(dn('dtrackrecord', 0, 0))));
  say('a delta that needs a lap shows a dash before the first lap', (b => b && b.kind === 'none')(badgeOf(dn('dbestlap', 0, 0))) && (b => b && b.kind === 'none')(badgeOf(dn('dlaptime', 1, 0))));
  E('sim').checked = true; key(' '); await until(() => phase() === 'running');
  await until(() => run("live.nodes.find(n=>n.w.type==='dbestlap'&&n.w.lane===0).val.innerHTML.indexOf('dlt-none')") < 0, 30000);
  const b1 = badgeOf(dn('dbestlap', 0, 0));
  say('after a lap the best lap delta shows a real difference, coloured by its sign', b1 && (b1.kind === 'fast' || b1.kind === 'slow' || b1.kind === 'equal') && /\d/.test(b1.text) && (b1.kind === 'equal' || b1.text[1] === (b1.kind === 'fast' ? '−' : '+')));
  await until(() => !!badgeOf(dn('dlaptime', 1, 0)) && badgeOf(dn('dlaptime', 1, 0)).kind !== 'none', 30000);
  const lb = badgeOf(dn('dlaptime', 1, 0));
  say('lane 2 against its own best lap: two decimals, no arrow', lb && /^[−+]?\d+\.\d\d$/.test(lb.text) && !/[▼▲]/.test(lb.text));
  say('the delta widgets keep the ordinary widget on the left', /class="dlt-val"/.test(dn('drecordlap', 0, 0).val.innerHTML));
  run('live.actions.stop()'); await wait(80);

  // ---------- a chosen layout, more lanes ----------
  store.layouts = [{ id: 'L1', name: 'Tiny', ratioW: 4, ratioH: 3, widgets: [{ id: 'a', type: 'clock', lane: null, x: 0, y: 0, w: 300, h: 100, textSize: 50, textColor: '#ff0000', bgColor: '', opt: {} }, { id: 'b', type: 'bestlap', lane: 3, x: 0, y: 200, w: 300, h: 100, textSize: '', textColor: '', bgColor: '', opt: {} }] }];
  await openRace({ name: 'Chosen', sessionType: 'practice', layout: 'L1' }, store.tracks[1], rows(1, 2, 3, 4));
  say('a saved layout is used when the race setup chooses it', run('live.nodes.length') === 2 && node('clock').el.style.fontSize === '5cqw');
  await openRace({ name: 'Chosen', sessionType: 'practice', layout: 'L1' }, store.tracks[0], rows(1, 2));
  say('...and widgets for lanes the track lacks are hidden', run('live.nodes.length') === 1 && run('live.nodes')[0].w.type === 'clock');
  await openRace({ name: 'Gone', sessionType: 'practice', layout: 'deleted-id' }, store.tracks[0], rows(1, 2));
  say('a missing layout falls back to the default', run('live.nodes.length') === 25);
  await openRace({ name: 'Wide', sessionType: 'practice', layout: '' }, store.tracks[1], rows(1, 2, 3, 4));
  say('4-lane track: default layout shows 41 widgets', run('live.nodes.length') === 41);

  // ---------- heats ----------
  saved.length = 0; store.laps = [];
  await openRace({ name: 'Heats', sessionType: 'heats', heatBy: 'laps', laps: 2, endRule: 'all', heatPlan: 'roundrobin', resultBy: 'points', points: '10, 8, 6', layout: '' }, store.tracks[0], rows(1, 2, 3));
  say('heats: info widget shows the heat', node('info').val.innerHTML.startsWith('Heat 1 of 3'));
  E('sim').checked = true;
  let n = 0;
  while (phase() !== 'finished' && n++ < 6) { key(' '); await until(() => ['between', 'finished'].includes(phase())); if (phase() === 'between') { say('between heats: start button names heat ' + (run('live.nodes').length ? (n + 1) : ''), node('start').val.innerHTML === 'Start heat ' + (n + 1) && node('start').val.disabled === false); } }
  say('3 heats run, race finished, one session saved', n === 3 && saved.length === 1 && saved[0][0].heatResults.length === 3 && saved[0][0].standings.length === 3);
  say('points total 3 heats x (10+8)', saved[0][0].standings.reduce((s, x) => s + x.points, 0) === 54);

  // 0.94.0: how the heats add up (average, worst heat dropped, a bonus for the fastest lap, the tie-breaker): the table on the race screen, the saved result
  { saved.length = 0;
    await openRace({ name: 'Heats', sessionType: 'heats', heatBy: 'laps', laps: 2, endRule: 'all', heatPlan: 'roundrobin', resultBy: 'points', points: '10, 8, 6', countBy: 'average', dropWorst: 'yes', fastestBonus: 2, tieBreak: 'wins', layout: '' }, store.tracks[0], rows(1, 2, 3));
    const view = E('racehost').innerHTML;
    say('the race screen says how the overall result is counted, and the table has a Result column', view.includes('id="overallnote"') && view.includes('the average per heat; the worst heat of every driver is dropped; 2 bonus points for the fastest lap of every heat; a tie is decided by the most heat wins first.') && view.includes('<th>Result</th>'));
    E('sim').checked = true; let m = 0;
    while (phase() !== 'finished' && m++ < 6) { key(' '); await until(() => ['between', 'finished'].includes(phase())); }
    const sess = saved[0][0], rowsAll = sess.heatResults.flatMap(h => h.rows);
    say('3 heats run and saved with the way they were counted', m === 3 && saved.length === 1 && sess.scoring.countBy === 'average' && sess.scoring.dropWorst === true && sess.scoring.fastestBonus === 2 && sess.scoring.tieBreak === 'wins');
    say('every heat gave one bonus of 2 points for the fastest lap (and the points of that row include it)', sess.heatResults.every(h => h.rows.filter(r => r.bonus === 2).length === 1 && h.rows.every(r => r.points === [10, 8][r.pos - 1] + (r.bonus || 0))) && rowsAll.reduce((t, r) => t + r.points, 0) === 3 * (10 + 8 + 2));
    say('the saved overall result has the number that counts, the heats that counted and the heats driven', sess.standings.length === 3 && sess.standings.every(x => Number.isFinite(x.score) && x.counted >= 1 && x.counted <= x.heats && x.heats === 2 && x.counted === 1) && sess.standings.every((x, i, a) => i === 0 || a[i - 1].score >= x.score));
    say('...and the points and laps still show everything that was driven', sess.standings.reduce((t, x) => t + x.points, 0) === 60);
    say('the Result column on the race screen is filled in', E('overall').innerHTML.includes('(1 of 2 heats)') && E('overall').innerHTML.includes(' avg'));
    saved.length = 0;
    await openRace({ name: 'Heats', sessionType: 'heats', heatBy: 'laps', laps: 2, endRule: 'all', heatPlan: 'roundrobin', resultBy: 'points', points: '10, 8, 6', fastestBonus: 1, layout: '' }, store.tracks[0], rows(1, 2, 3));
    say('with only a bonus there is a note but no Result column', E('racehost').innerHTML.includes('id="overallnote"') && !E('racehost').innerHTML.includes('<th>Result</th>'));
    E('sim').checked = true; m = 0;
    while (phase() !== 'finished' && m++ < 6) { key(' '); await until(() => ['between', 'finished'].includes(phase())); }
    say('...and the saved standings have no Result numbers, but the way of counting is saved', saved.length === 1 && saved[0][0].standings.every(x => x.score === undefined) && saved[0][0].scoring.fastestBonus === 1);
    await openRace({ name: 'Heats', sessionType: 'heats', heatBy: 'laps', laps: 2, endRule: 'all', heatPlan: 'roundrobin', resultBy: 'laps', dropWorst: 'yes', layout: '' }, store.tracks[0], rows(1, 2, 3));
    say('dropping the worst heat alone also gives the note and the Result column (the number that counts differs from the laps)', E('racehost').innerHTML.includes('Overall result: the worst heat of every driver is dropped.') && E('racehost').innerHTML.includes('<th>Result</th>'));
    await openRace({ name: 'Heats', sessionType: 'heats', heatBy: 'laps', laps: 2, endRule: 'all', heatPlan: 'roundrobin', resultBy: 'laps', countBy: 'best', bestHeats: 2, layout: '' }, store.tracks[0], rows(1, 2, 3));
    say('the best heats alone: the note and the Result column too', E('racehost').innerHTML.includes('only the best 2 heats of every driver count.') && E('racehost').innerHTML.includes('<th>Result</th>'));
    saved.length = 0;
    await openRace({ name: 'Heats', sessionType: 'heats', heatBy: 'laps', laps: 2, endRule: 'all', heatPlan: 'roundrobin', resultBy: 'points', points: '10, 8, 6', layout: '' }, store.tracks[0], rows(1, 2, 3));
    say('with the standard there is nothing extra: no note, no Result column, nothing saved about the counting', !E('racehost').innerHTML.includes('overallnote') && !E('racehost').innerHTML.includes('<th>Result</th>'));
    E('sim').checked = true; m = 0;
    while (phase() !== 'finished' && m++ < 6) { key(' '); await until(() => ['between', 'finished'].includes(phase())); }
    say('...and the saved result is as before (no scoring, no extra numbers on the standings)', saved.length === 1 && saved[0][0].scoring === undefined && saved[0][0].standings.every(x => x.score === undefined && x.counted === undefined) && saved[0][0].heatResults.every(h => h.rows.every(r => r.bonus === undefined)));
  }

  // 1.7.0: the total race time as the result of the heats
  { saved.length = 0;
    await openRace({ name: 'Heats', sessionType: 'heats', heatBy: 'laps', laps: 2, endRule: 'all', heatPlan: 'roundrobin', resultBy: 'time', layout: '' }, store.tracks[0], rows(1, 2, 3));
    const view = E('racehost').innerHTML;
    say('the total race time: the note says so and the table has a Result column', view.includes('id="overallnote"') && view.includes('the lowest total race time wins') && view.includes('<th>Result</th>'));
    E('sim').checked = true; let m = 0;
    while (phase() !== 'finished' && m++ < 6) { key(' '); await until(() => ['between', 'finished'].includes(phase())); }
    const sess = saved[0] && saved[0][0];
    say('3 heats run and one session saved as a result by time', m === 3 && saved.length === 1 && sess.resultBy === 'time' && sess.scoring && sess.scoring.byTime === true);
    say('every heat row has a finish time and the saved standings carry the time that counts', sess.heatResults.every(h => h.rows.every(r => r.fin === true || r.fin === false)) && sess.standings.length === 3 && sess.standings.every(x => Number.isFinite(x.score) && x.score > 0));
    say('the standings are ordered by the lowest total time', sess.standings.every((x, i, a) => i === 0 || a[i - 1].score <= x.score));
    say('the Result column on the race screen shows times', /\d:\d\d\.\d\d\d|\d+\.\d\d\d/.test(E('overall').innerHTML));
  }

  // 1.7.0: the heat list on the race screen, in the data for the other screens and as a widget
  { saved.length = 0; const layoutsWere = store.layouts;
    store.layouts = [...layoutsWere, { id: 'HL', name: 'Heat list', ratioW: 16, ratioH: 9, widgets: [{ ...W('heatlist', null, 0, 0), w: 600, h: 300 }, { ...W('heatlist', null, 0, 320), w: 600, h: 100, opt: { show: 'near', detail: 'all', lanes: false } }] }];
    await openRace({ name: 'Heats', sessionType: 'heats', heatBy: 'laps', laps: 2, endRule: 'all', heatPlan: 'roundrobin', resultBy: 'points', points: '10, 8, 6', layout: 'HL' }, store.tracks[0], rows(1, 2, 3));
    const dh = () => (sent.dyn && sent.dyn.heat) || null, card = E('racehost').innerHTML, rowsOf = () => (E('heatlist').innerHTML.match(/<tr class="hl-[a-z]+"/g) || []);
    say('the race screen has a heat list card, open, with a print button and a message place', card.includes('id="heatlistcard"') && card.includes('<summary>Heat list (3 heats)</summary>') && card.includes(' open>') && card.includes('id="heatprint"') && card.includes('id="heatprintmsg"') && !card.includes('Heat schedule'));
    let hl = E('heatlist').innerHTML;
    say('before the start: a row per heat with the drivers by lane, the first heat is next, nobody has won yet', rowsOf().length === 3 && rowsOf()[0] === '<tr class="hl-next"' && rowsOf()[1] === '<tr class="hl-later"' && hl.includes('Lane 1: ') && hl.includes('>Next</span>') && !hl.includes('Racing now') && hl.includes('<th>Points</th>'));
    await until(() => !!dh());
    say('...every heat has its place in the data of the other screens too (3 heats, by points)', !!dh() && dh().list.length === 3 && dh().by === 'points' && dh().list[0].drivers.length > 0);
    say('...and the Heat List widgets of the live page show them (the second one only the heat that is next and the two after it, without lane numbers)', node('heatlist').val.innerHTML.includes('class="hlw"') && (node('heatlist').val.innerHTML.match(/<tr /g) || []).length === 3 && run("live.nodes.filter(n=>n.w.type==='heatlist')[1].val.innerHTML").includes('hlw-next') && !/<td class="hlw-d">\d: /.test(run("live.nodes.filter(n=>n.w.type==='heatlist')[1].val.innerHTML")));
    E('sim').checked = true; key(' '); await until(() => phase() === 'running');
    say('while the heat races it is marked as racing now, in the list and in the widget', E('heatlist').innerHTML.includes('<tr class="hl-current"') && E('heatlist').innerHTML.includes('Racing now') && !E('heatlist').innerHTML.includes('hl-next') && node('heatlist').val.innerHTML.includes('hlw-current'));
    await until(() => ['between', 'finished'].includes(phase()));
    hl = E('heatlist').innerHTML;
    say('after the heat: it is done, with its winner and the points of the places, and the next heat is next', rowsOf().join() === '<tr class="hl-done",<tr class="hl-next",<tr class="hl-later"' && hl.includes('>Done</span>') && /1\. [A-Za-z]+ 10 · 2\. [A-Za-z]+ 8</.test(hl));
    say('...with a result by points the laps of every place are in a column of their own', hl.includes('<th>Laps</th>') && /<td>\d+ · \d+<\/td><\/tr>/.test(hl));
    say('...the winner is the driver who came first, in the winner column', (m => m && hl.includes(`<td>${m[1]}</td><td>1. ${m[1]} 10`))(/<td>1\. ([A-Za-z]+) 10/.exec(hl)));
    say('...the other screens get the result of that heat (two drivers on this track, the first with 10 points) and the widget shows a star for the winner', (await until(() => dh() && dh().list && dh().list[0].rows.length === 2), !!dh() && dh().list[0].rows.length === 2 && dh().list[0].rows[0].points === 10 && dh().list[1].rows.length === 0) && node('heatlist').val.innerHTML.includes('class="hlw-win">★ ') && node('heatlist').val.innerHTML.includes('hlw-done'));
    say('...the dynamic message that is sent holds the list as well, so a phone or a second window can draw it', !!sent.dyn && !!sent.dyn.heat && sent.dyn.heat.list.length === 3 && sent.dyn.heat.list[0].rows.length === 2);
    let m = 1;
    while (phase() !== 'finished' && m++ < 6) { key(' '); await until(() => ['between', 'finished'].includes(phase())); }
    say('after the last heat every heat is done and has a winner', rowsOf().every(x => x === '<tr class="hl-done"') && (E('heatlist').innerHTML.match(/>Done<\/span>/g) || []).length === 3);
    // a race by laps and a race by time: the last column and its heading
    await openRace({ name: 'Heats', sessionType: 'heats', heatBy: 'laps', laps: 2, endRule: 'all', heatPlan: 'roundrobin', resultBy: 'laps', layout: '' }, store.tracks[0], rows(1, 2, 3));
    say('a result by laps: the last column of the heat list is the laps (and there is no second laps column)', E('heatlist').innerHTML.includes('<th>Laps</th>') && (E('heatlist').innerHTML.match(/<th>Laps<\/th>/g) || []).length === 1 && (await until(() => dh() && dh().by === 'laps'), dh().by === 'laps'));
    await openRace({ name: 'Heats', sessionType: 'heats', heatBy: 'laps', laps: 2, endRule: 'all', heatPlan: 'roundrobin', resultBy: 'time', layout: '' }, store.tracks[0], rows(1, 2, 3));
    say('a result by total race time: the last column is the times', E('heatlist').innerHTML.includes('<th>Times</th>') && (await until(() => dh() && dh().by === 'time'), dh().by === 'time'));
    E('sim').checked = true; key(' '); await until(() => ['between', 'finished'].includes(phase()));
    say('...and a finished heat shows the finish times', /1\. [A-Za-z]+ \d+(:\d\d)?\.\d\d\d/.test(E('heatlist').innerHTML));
    // a race that is no heat race has no list
    await openRace({ name: 'Sprint', sessionType: 'race', laps: 2, endRule: 'all', layout: '' }, store.tracks[0], rows(1, 2));
    say('a race without heats has no heat list card', !E('racehost').innerHTML.includes('id="heatlistcard"') && (await until(() => !dh() || !dh().list), !dh() || dh().list === undefined));
    // a final: its drivers are in the list once the heats are raced
    await openRace({ name: 'Heats', sessionType: 'heats', heatBy: 'laps', laps: 2, endRule: 'all', heatPlan: 'roundrobin', resultBy: 'points', points: '10, 8, 6', finals: 'a', layout: '' }, store.tracks[0], rows(1, 2, 3));
    say('with a final the card says so and the list ends with Final A, whose drivers are not known yet', E('racehost').innerHTML.includes('Heat list (3 heats and a final)') && rowsOf().length === 4 && E('heatlist').innerHTML.includes('Final A') && E('heatlist').innerHTML.includes('decided after the heats'));
    store.layouts = layoutsWere;
  }

  // 0.95.0: the break between two heats
  { saved.length = 0;
    const mkBreak = over => openRace({ name: 'Heats', sessionType: 'heats', heatBy: 'laps', laps: 2, endRule: 'all', heatPlan: 'roundrobin', resultBy: 'laps', layout: '', ...over }, store.tracks[0], rows(1, 2, 3));
    const infoText = () => node('info').val.innerHTML, msg = () => E('msg').textContent;
    await mkBreak({});
    E('sim').checked = true; key(' '); await until(() => phase() === 'between');
    say('no break set: the race waits for Start as before (no countdown, no "next heat in")', phase() === 'between' && run('live.breakLeft') === 0 && msg() === 'Heat 1 finished. Press Space for the next heat.' && !infoText().includes('next heat in'));
    key(' '); await until(() => phase() === 'running'); await until(() => phase() === 'between');
    say('...and it still waits after heat 2 (3 heats for 3 drivers on 2 lanes)', phase() === 'between' && infoText().startsWith('Heat 3 of 3'));
    run('live.actions.stop(true)'); await wait(80);
    // a break of 120 s: the test clock runs 40 times faster, so 3 s of real time
    saved.length = 0;
    await mkBreak({ breakSeconds: 120 });
    E('sim').checked = true; key(' '); await until(() => phase() === 'between');
    const left0 = run('live.breakLeft');
    say('a break of 120 seconds: the race waits and counts down from 2:00', phase() === 'between' && left0 >= 118 && left0 <= 120 && /^Heat 1 finished\. Heat 2 starts when you press Space in [12]:\d\d or after the break\.$/.test(msg()) && /next heat in [12]:\d\d/.test(infoText()) && infoText().startsWith('Heat 2 of 3'));
    say('...the start button still says which heat is next', node('start').val.innerHTML === 'Start heat 2' && node('start').val.disabled === false);
    await wait(500);
    say('...the countdown runs (500 ms of test time is 20 seconds)', run('live.breakLeft') < left0 - 10 && run('live.breakLeft') > 0 && /next heat in [01]:\d\d/.test(infoText()));
    { const host = document.createElement('div'); await run('LiveView.mount')(host, {}); run('LiveView.go')('timing');
      say('the Live Race page says it too: "Heat finished · next heat in ..."', /Heat finished · next heat in [01]:\d\d/.test(E('lv-status').textContent)); }
    key(' ');
    say('Space during the break starts the next heat at once and ends the break', phase() === 'countdown' && run('live.breakLeft') === 0 && !infoText().includes('next heat in'));
    await until(() => phase() === 'running');
    say('...and the countdown is gone while that heat runs', phase() === 'running' && run('live.breakLeft') === 0 && !infoText().includes('next heat in'));
    await until(() => phase() === 'between');
    say('after heat 2 the break starts again from 2:00', run('live.breakLeft') >= 118 && msg().includes('Heat 2 finished. Heat 3 starts when you press Space in '));
    run('live.actions.stop(true)'); await wait(80);
    say('stopping during a break ends the race and saves the heats so far, and the countdown stops', phase() === 'finished' && saved.length === 1 && saved[0][0].heatResults.length === 2 && run('live.breakLeft') === 0);
    // a short break, nobody presses anything: the message changes, the race waits for Start
    saved.length = 0;
    await mkBreak({ breakSeconds: 40 });
    E('sim').checked = true; key(' '); await until(() => phase() === 'between');
    await until(() => run('live.breakLeft') === 0, 4000); await wait(100);
    say('a break that is over: the race still waits for Start, and the message says so', phase() === 'between' && msg() === 'The break is over. Press Space for heat 2.' && !infoText().includes('next heat in'));
    key(' ');
    say('...and Start starts the next heat', phase() === 'countdown');
    await until(() => phase() === 'running'); run('live.actions.stop(true)'); await wait(80);
    // the lights begin by themselves
    saved.length = 0;
    await mkBreak({ breakSeconds: 40, breakAuto: 'yes' });
    E('sim').checked = true; key(' '); await until(() => phase() === 'between');
    say('with automatic start the message says so (and that Space starts it now)', /^Heat 1 finished\. Heat 2 starts by itself in [01]:\d\d \(Space starts it now\)\.$/.test(msg()));
    await wait(250);
    say('...and the message keeps counting down while the break runs', phase() === 'between' && /^Heat 1 finished\. Heat 2 starts by itself in 0:[0-3]\d \(Space starts it now\)\.$/.test(msg()));
    await until(() => ['countdown', 'running'].includes(phase()), 5000);
    say('...and when the break is over the lights begin by themselves: heat 2 is on', ['countdown', 'running'].includes(phase()) && infoText().startsWith('Heat 2 of 3'));
    await until(() => phase() === 'between'); run('live.actions.stop(true)'); await wait(1600);
    say('stopping during a break with automatic start: the race stays stopped when the break would have been over', phase() === 'finished' && run('live.breakLeft') === 0 && saved.length === 1);
    // the last heat has no break
    saved.length = 0;
    await mkBreak({ breakSeconds: 40, breakAuto: 'yes' });
    E('sim').checked = true; let k = 0;
    while (phase() !== 'finished' && k++ < 8) { if (phase() === 'ready') key(' '); await until(() => ['finished'].includes(phase()), 12000); }
    say('with automatic start all three heats run by themselves, there is no break after the last heat, and the result is saved once', phase() === 'finished' && saved.length === 1 && saved[0][0].heatResults.length === 3 && run('live.breakLeft') === 0);
  }
  // 0.96.0: finals. 4 drivers on 2 lanes, 2 heats of 2 laps, then a final B and a final A of 3 laps; the drivers choose their lanes
  { saved.length = 0;
    const mkFin = over => openRace({ name: 'Finals', sessionType: 'heats', heatBy: 'laps', laps: 2, endRule: 'all', heatPlan: 'manual', heats: 2, resultBy: 'points', points: '10, 8, 6, 5', layout: '', finals: 'ab', finalLaps: 3, ...over }, store.tracks[0], rows(1, 2, 3, 4));
    const infoText = () => node('info').val.innerHTML, msg = () => E('msg').textContent, pickBox = () => E('finalpick'), click = (fp, lane) => pickBox().onclick({ target: { closest: () => ({ dataset: { fp, lane }, disabled: false }) } });
    const lanesNow = () => run("live.engine().cars.map(c => c.lane + ':' + c.driverName).join()");
    await mkFin({});
    say('before the heats: no lane panel, the race info says Heat 1 of 2, and the title that is shared tells about the finals', pickBox().hidden === true && infoText().startsWith('Heat 1 of 2') && /2 heats, each 2 laps, then finals B and A of 3 laps/.test(sent.stat.title));
    E('sim').checked = true; key(' '); await until(() => phase() === 'between');
    say('after heat 1 the next race is heat 2, no lanes to choose (and pressing the lane buttons does nothing)', infoText().startsWith('Heat 2 of 2') && pickBox().hidden === true && msg() === 'Heat 1 finished. Press Space for the next heat.' && run("live.pickAction('lane', 0)") === false && run("live.pickAction('random')") === false && msg() === 'Heat 1 finished. Press Space for the next heat.');
    key(' '); await until(() => phase() === 'running'); await until(() => phase() === 'between');
    say('after the last heat the final B is next: the start button says so, and it is not available before the lanes are chosen', node('start').val.innerHTML === 'Start final B' && node('start').val.disabled === true && infoText().startsWith('Final B'));
    say('...the lane panel is there with the drivers of the final B in the order of the heat result, and the best-placed driver chooses first', pickBox().hidden === false && pickBox().innerHTML.includes('Final B: choose the lanes') && pickBox().innerHTML.includes('chooses a lane') && (pickBox().innerHTML.match(/data-fp="lane"/g) || []).length === 2);
    say('...and the message says what to do', msg() === 'Heat 2 finished. Choose the lanes for Final B first, then press Space.');
    key(' ');
    say('Space before the lanes are chosen does not start the final', phase() === 'between' && msg().includes('Choose the lanes for Final B first'));
    const first = lanesNow();
    click('lane', '1');
    say('the best-placed driver takes lane 2; the other driver gets the lane that is left (nothing to choose)', pickBox().innerHTML.includes('All lanes are chosen') && /^0:.+,1:.+$/.test(lanesNow()) && lanesNow() !== undefined && pickBox().innerHTML.includes('Lane 2: ') && pickBox().innerHTML.includes('Lane 1: '));
    say('...now the final can start, and the start button is available', node('start').val.disabled === false && msg() === 'Heat 2 finished. Press Space for final B.');
    click('clear');
    say('Clear choices starts again', pickBox().innerHTML.includes('chooses a lane') && node('start').val.disabled === true);
    click('random');
    say('Pick the rest at random gives every driver a lane', pickBox().innerHTML.includes('All lanes are chosen') && new Set(run("live.engine().cars.map(c => c.lane)")).size === 2);
    key(' ');
    say('the final B starts, with the laps of the final (3), and the lane panel is gone', phase() === 'countdown' && pickBox().hidden === true && infoText().startsWith('Final B') && infoText().includes('3 laps left'));
    await until(() => phase() === 'running'); await until(() => phase() === 'between');
    say('after the final B the final A is next and its lanes are to be chosen (the choices of the B final do not count)', node('start').val.innerHTML === 'Start final A' && pickBox().innerHTML.includes('Final A: choose the lanes') && node('start').val.disabled === true && msg() === 'Final B finished. Choose the lanes for Final A first, then press Space.');
    click('lane', '0'); key(' ');
    await until(() => phase() === 'running'); say('the final A runs with 3 laps', infoText().startsWith('Final A') && phase() === 'running');
    await until(() => phase() === 'finished'); await wait(60);
    const s = saved[0] && saved[0][0], laps = saved[0] ? saved[0][1] : [];
    say('the race is saved once, with 4 results: two heats and the finals B and A', saved.length === 1 && s.heatResults.map(h => h.heat + (h.final || '')).join() === '1,2,3B,4A');
    say('...the session knows about the finals and how they count', JSON.stringify(s.finals) === JSON.stringify({ finals: 'ab', finalMode: 'places' }));
    say('...the places: the two drivers of the final A first, then the two of the final B, in the order of their finals', s.standings.map(x => x.pos).join() === '1,2,3,4' && s.standings.slice(0, 2).every(x => x.finalName === 'A') && s.standings.slice(2).every(x => x.finalName === 'B') && s.standings.every(x => x.finalPos === 1 || x.finalPos === 2));
    say('...the A final decided: the winner of the final A is first', s.standings[0].finalPos === 1 && s.standings[1].finalPos === 2 && s.standings[2].finalPos === 1 && s.standings[3].finalPos === 2);
    say('...the laps of the finals are saved with the final (heat number 3 and 4)', laps.filter(l => l.final === 'B').length >= 3 && laps.filter(l => l.final === 'B').every(l => l.heat === 3) && laps.filter(l => l.final === 'A').every(l => l.heat === 4) && laps.filter(l => !l.final).every(l => l.heat <= 2));
    say('...a final has the laps of a final: no more than 3 laps for a driver in the finals (the heats had 2)', ['A', 'B'].every(f => Object.values(laps.filter(l => l.final === f).reduce((m, l) => { m[l.driverId] = (m[l.driverId] || 0) + 1; return m; }, {})).every(n => n >= 3 && n <= 4)));
    say('...at the end the widgets still name the last race: Final A', node('info').val.innerHTML.startsWith('Final A'));
    say('...the overall table has the Final column in its header, and the note says how the finals count', E('racehost').innerHTML.includes('<th>Final</th>') && E('racehost').innerHTML.includes('The finals decide the final places.'));
    say('...the race screen overall table has a Final column', E('overall').innerHTML.includes('Final A: 1st') && E('overall').innerHTML.includes('Final B: 2nd'));
  }
  // a race by time: the final has its own duration (and 0 is the duration of a heat). The test clock does not speed up a timed race, so the heat is 3 seconds (0.05 minutes)
  { for (const [fd, left, said] of [[0.1, '0:06 left', '6 seconds'], [0, '0:03 left', 'as long as a heat (3 seconds)']]) {
      saved.length = 0;
      await openRace({ name: 'Finals', sessionType: 'heats', heatBy: 'time', duration: 0.05, heatPlan: 'manual', heats: 1, resultBy: 'laps', layout: '', finals: 'a', finalDuration: fd }, store.tracks[0], rows(1, 2, 3));
      E('sim').checked = true; key(' '); await until(() => phase() === 'between', 20000);
      say(`a race by time with finals: after the heat the final A is next, and it lasts ${said}`, phase() === 'between' && node('info').val.innerHTML.startsWith('Final A') && node('info').val.innerHTML.includes(left));
      run('live.actions.stop(true)'); await wait(80);
    } }
  // a final that waits for the lanes while the break runs out, even with automatic start
  { saved.length = 0;
    const mkFin = over => openRace({ name: 'Finals', sessionType: 'heats', heatBy: 'laps', laps: 2, endRule: 'all', heatPlan: 'manual', heats: 1, resultBy: 'laps', layout: '', finals: 'a', finalLaps: 0, breakSeconds: 40, breakAuto: 'yes', ...over }, store.tracks[0], rows(1, 2, 3));
    const msg = () => E('msg').textContent;
    await mkFin({});
    E('sim').checked = true; key(' '); await until(() => phase() === 'between');
    say('a break before a final, with automatic start: the message asks for the lanes', /^Heat 1 finished\. Choose the lanes for Final A first, then press Space\.$/.test(msg()) && run('live.breakLeft') > 0);
    { await wait(200); const host = document.createElement('div'); await run('LiveView.mount')(host, {}); run('LiveView.go')('timing');
      say('the Live Race page says "next final A in ..." during that break', /Heat finished · next final A in [01]:\d\d/.test(E('lv-status').textContent)); }
    await until(() => run('live.breakLeft') === 0, 4000); await wait(150);
    say('...the break runs out and the final does not start by itself', phase() === 'between' && msg() === 'The break is over. Choose the lanes for Final A first, then press Space.');
    E('finalpick').onclick({ target: { closest: () => ({ dataset: { fp: 'random' }, disabled: false }) } });
    await wait(150);
    say('...the lanes are chosen after the break: still no automatic start, the message says Space starts it', phase() === 'between' && msg() === 'The break is over. Press Space for final A.');
    key(' '); say('...and Space starts the final, which is as long as a heat when no length is set for it (2 laps)', phase() === 'countdown' && node('info').val.innerHTML.startsWith('Final A') && node('info').val.innerHTML.includes('2 laps left'));
    await until(() => phase() === 'running'); run('live.actions.stop(true)'); await wait(80);
    say('stopping in the final saves what was raced, as for a heat: the heat and the final are in the result', phase() === 'finished' && saved.length === 1 && saved[0][0].heatResults.length === 2 && saved[0][0].heatResults[1].final === 'A');
  }
  // the final result is added to the heat result; the final only for the A final (3 drivers on 2 lanes: the two best)
  { saved.length = 0;
    await openRace({ name: 'Finals', sessionType: 'heats', heatBy: 'laps', laps: 2, endRule: 'all', heatPlan: 'roundrobin', resultBy: 'points', points: '10, 8, 6', layout: '', finals: 'a', finalMode: 'added' }, store.tracks[0], rows(1, 2, 3));
    E('sim').checked = true; let n = 0;
    while (phase() !== 'finished' && n++ < 10) { if (phase() === 'between' && run('live.pickAction')('random')) { /* the lanes of the final */ } key(' '); await until(() => ['between', 'finished'].includes(phase()), 12000); }
    await wait(60);
    const s = saved[0] && saved[0][0];
    say('added: 3 heats and a final A are saved (4 results)', saved.length === 1 && s.heatResults.length === 4 && s.heatResults[3].final === 'A' && s.finals.finalMode === 'added');
    say('...the drivers of the final A have the heat score, the final points and the result that adds them up', s.standings.filter(x => x.finalName === 'A').length === 2 && s.standings.filter(x => x.finalName === 'A').every(x => Number.isFinite(x.heatScore) && x.finalPoints >= 6 && Math.abs(x.score - (x.heatScore + x.finalPoints)) < 1e-9));
    say('...the driver who was not in the final has no final fields, and is placed last', s.standings[2].finalName === undefined && s.standings[2].finalPos === undefined && s.standings[2].heatScore === undefined);
    say('...the Result column of the race screen shows the sum', /\+ \d+ final = /.test(E('overall').innerHTML));
  }
  // 0.92.0: the plan that was made on the Home tab is the plan that is raced (and a plan that does not fit is not used)
  { const mkRace = schedule => { const setup = { restartAfterRed: 'resume', name: 'Heats', sessionType: 'heats', heatBy: 'laps', laps: 2, endRule: 'all', heatPlan: 'roundrobin', resultBy: 'laps', layout: '' }; run(`state.speed=40; state.race=${JSON.stringify({ setup, track: store.tracks[0], rows: rows(1, 2, 3), schedule })}; state.tab='race'`); return run('render()'); };
    await mkRace([[{ p: 2, lane: 0 }, { p: 0, lane: 1 }], [{ p: 1, lane: 0 }, { p: 2, lane: 1 }]]);
    say('a plan from the Home tab is used: heat 1 has participant 3 in lane 1 and participant 1 in lane 2, and there are 2 heats (the setup alone would make 3)', run("live.engine().cars.map(c => c.lane + ':' + c.driverId).sort().join()") === '0:d3,1:d1' && node('info').val.innerHTML.startsWith('Heat 1 of 2'));
    await mkRace([[{ p: 9, lane: 0 }]]);
    say('a plan with a participant that is not there is not used: the race makes its own (3 heats for 3 drivers on 2 lanes)', node('info').val.innerHTML.startsWith('Heat 1 of 3'));
    await mkRace(undefined);
    say('with no plan at all the race makes its own', node('info').val.innerHTML.startsWith('Heat 1 of 3')); }
  // stop between heats
  saved.length = 0;
  await openRace({ name: 'Heats', sessionType: 'heats', heatBy: 'laps', laps: 2, endRule: 'all', heatPlan: 'roundrobin', resultBy: 'laps', layout: '' }, store.tracks[0], rows(1, 2, 3));
  E('sim').checked = true; key(' '); await until(() => phase() === 'between');
  run('live.actions.stop()'); await wait(80);
  say('stop between heats saves the heat driven so far', phase() === 'finished' && saved.length === 1 && saved[0][0].heatResults.length === 1);

  // ---------- stopping a race: the S key and the Stop button ----------
  saved.length = 0; store.laps = [];
  await openRace({ name: 'Stop test', sessionType: 'race', laps: 50, endRule: 'all', layout: '' }, store.tracks[0], rows(1, 2));
  say('Stop button is disabled before the race starts', E('stopbtn').disabled === true);
  E('sim').checked = true; key(' '); await until(() => phase() === 'running'); await wait(300);
  say('Stop button is enabled while racing', E('stopbtn').disabled === false);
  key('s'); await wait(80);
  say('S stops the race and saves the laps so far', phase() === 'finished' && saved.length === 1 && saved[0][1].length > 0);
  say('Stop button is disabled again afterwards', E('stopbtn').disabled === true);
  saved.length = 0;
  await openRace({ name: 'Stop test 2', sessionType: 'race', laps: 50, endRule: 'all', layout: '' }, store.tracks[0], rows(1, 2));
  E('sim').checked = true; key(' '); await until(() => phase() === 'running'); await wait(300);
  E('stopbtn').onclick({ currentTarget: { blur() {} } }); await wait(80);
  say('the Stop button under the page ends the race too', phase() === 'finished' && saved.length === 1);
  await openRace({ name: 'Stop test 3', sessionType: 'race', laps: 50, endRule: 'all', layout: 'L1' }, store.tracks[0], rows(1, 2));
  E('sim').checked = true; key(' '); await until(() => phase() === 'running'); await wait(100);
  say('stop works even when the layout has no Stop widget', !run('live.nodes').some(n => n.w.type === 'stop'));
  key('s'); await wait(80); say('...S still ends the race', phase() === 'finished');

  // ---------- titles and lane colours on the live page ----------
  const WD = (type, lane, extra = {}) => ({ id: type + lane, type, lane, x: 0, y: lane * 100, w: 300, h: 80, textSize: '', textColor: '', bgColor: '', opt: {}, ...extra });
  store.layouts = [{ id: 'T1', name: 'Titles', ratioW: 16, ratioH: 9,
    laneColors: [{ text: '#ff0000', bg: '#001122' }, { text: '', bg: '#003300' }],
    widgets: [WD('bestlap', 0), WD('bestlap', 1, { title: 'Fastest', textColor: '#00ff00' }), WD('name', 0, { showTitle: false }), WD('start', null, { y: 400 }), WD('clock', null, { y: 300, bgColor: '#abcdef' })] }];
  await openRace({ name: 'Titles', sessionType: 'practice', layout: 'T1' }, store.tracks[0], rows(1, 2));
  const nodeOf = (type, lane) => run('live.nodes').find(n => n.w.type === type && n.w.lane === lane);
  say('a widget shows its own name as its title', nodeOf('bestlap', 0).tit && nodeOf('bestlap', 0).tit.textContent === 'Best lap');
  say('a renamed title is shown', nodeOf('bestlap', 1).tit.textContent === 'Fastest');
  say('a hidden title is not built', nodeOf('name', 0).tit === null);
  say('buttons have no title', run("live.nodes.find(n=>n.w.type==='start')").tit === null);
  say('title size follows the widget setting (default 1.2)', nodeOf('bestlap', 0).tit.style.fontSize === '1.2cqw');
  say('a lane\'s colours reach all of its widgets', nodeOf('bestlap', 0).el.style.color === '#ff0000' && nodeOf('bestlap', 0).el.style.background === '#001122' && nodeOf('name', 0).el.style.background === '#001122');
  say('a widget\'s own text colour wins over its lane colour (lane background still applies)', nodeOf('bestlap', 1).el.style.color === '#00ff00' && nodeOf('bestlap', 1).el.style.background === '#003300');
  say('widgets without a lane use their own colour or the theme', nodeOf('clock', null).el.style.background === '#abcdef' && nodeOf('clock', null).el.style.color === 'var(--ink)');

  // ---------- border and transparency on the live page ----------
  store.layouts = [{ id: 'F1', name: 'Frames', ratioW: 16, ratioH: 9, laneColors: [],
    widgets: [WD('clock', null, { y: 0, bgColor: '#336699', borderMode: 'shade', borderShade: 25 }), WD('bestlap', 0, { y: 100, transparency: 40 }), WD('name', 0, { y: 200, borderMode: 'off', bgColor: '#003300' }), WD('lap', 0, { y: 300 })] }];
  await openRace({ name: 'Frames', sessionType: 'practice', layout: 'F1' }, store.tracks[0], rows(1, 2));
  say('a shaded border is made from the widget\'s background', nodeOf('clock', null).el.style.borderColor === 'color-mix(in srgb, white 50%, #336699)' && nodeOf('clock', null).el.style.background === '#336699');
  say('transparency fades the background and the theme\'s border, not the text', nodeOf('bestlap', 0).el.style.background === 'color-mix(in srgb, var(--panel) 60%, transparent)' && nodeOf('bestlap', 0).el.style.borderColor === 'color-mix(in srgb, var(--line) 60%, transparent)' && nodeOf('bestlap', 0).el.style.color === 'var(--ink)' && nodeOf('bestlap', 0).val.style.opacity === undefined);
  say('"no border" draws a clear border', nodeOf('name', 0).el.style.borderColor === 'transparent' && nodeOf('name', 0).el.style.background === '#003300');
  say('a widget without these settings keeps the style sheet\'s border', nodeOf('lap', 0).el.style.borderColor === '' && nodeOf('lap', 0).el.style.background === 'var(--panel)');

  // ---------- corner radius on the live page ----------
  store.layouts = [{ id: 'C1', name: 'Corners', ratioW: 16, ratioH: 9, laneColors: [], radius: 20,
    widgets: [WD('clock', null, { y: 0, w: 400, h: 100 }), WD('bestlap', 0, { y: 100, w: 100, h: 100, radius: 50 }), WD('name', 0, { y: 200, radius: 0 }), WD('lap', 0, { y: 300, radius: '' })] }];
  await openRace({ name: 'Corners', sessionType: 'practice', layout: 'C1' }, store.tracks[0], rows(1, 2));
  const u = Math.round(100 * 100 / 1000 * 100) / 100;
  say('the layout\'s corner radius is a percent of the widget\'s shorter side', nodeOf('clock', null).el.style.borderRadius === '2cqw' && nodeOf('lap', 0).el.style.borderRadius === '1.6cqw');
  say('a widget\'s own radius wins: 50 on a square widget is fully round, 0 is square', nodeOf('bestlap', 0).el.style.borderRadius === '5cqw' && nodeOf('name', 0).el.style.borderRadius === '0cqw');
  store.layouts = [{ id: 'C2', name: 'Classic', ratioW: 16, ratioH: 9, laneColors: [], widgets: [WD('clock', null, { y: 0 }), WD('start', null, { y: 400 })] }];
  await openRace({ name: 'Classic', sessionType: 'practice', layout: 'C2' }, store.tracks[0], rows(1, 2));
  say('a layout without a radius keeps the style sheet\'s corners', nodeOf('clock', null).el.style.borderRadius === '' && run("live.nodes.find(n=>n.w.type==='start')").el.style.borderRadius === '');

  // ---------- the page background picture ----------
  { const PIC = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==', fake = () => ({ innerHTML: '', style: {}, children: [], appendChild(e) { this.children.push(e); return e; } });
    const lay = extra => ({ ratioW: 16, ratioH: 9, laneColors: [], widgets: [WD('clock', null, { y: 0 }), WD('lap', 0, { y: 100 })], ...extra });
    ctx.__c1 = fake(); ctx.__l1 = lay({ bgImage: PIC, bgBlur: 50, bgBrightness: 80 }); run('LiveCanvas.build(__c1, __l1, 2, {})');
    say('a layout with a picture gets the picture as the first thing in the page, then the widgets', ctx.__c1.children.length === 3 && ctx.__c1.children[0].className === 'bgpic' && ctx.__c1.children[1].className.startsWith('lw live'));
    say('...with its filters on the picture layer only', ctx.__c1.children[0].style.cssText.includes('filter:blur(2cqw) brightness(80%)') && ctx.__c1.children[0].style.cssText.includes(PIC) && !ctx.__c1.children[1].style.filter);
    ctx.__c2 = fake(); ctx.__l2 = lay({}); run('LiveCanvas.build(__c2, __l2, 2, {})');
    say('a layout without a picture is built as before', ctx.__c2.children.length === 2 && ctx.__c2.children.every(c => c.className.startsWith('lw live')));
    ctx.__c3 = fake(); ctx.__l3 = lay({ bgImage: 'http://evil.example/x.png' }); run('LiveCanvas.build(__c3, __l3, 2, {})');
    say('a picture that points elsewhere is not used', ctx.__c3.children.length === 2);
    store.layouts = [lay({ id: 'B1', name: 'Pic', bgImage: PIC, bgBlur: 30 })];
    await openRace({ name: 'Pic', sessionType: 'practice', layout: 'B1' }, store.tracks[0], rows(1, 2));
    say('the layout (with its picture) is shared with the Race Director page and the tablets', sent.stat && sent.stat.layout.bgImage === PIC && sent.stat.layout.bgBlur === 30);
  }

  // ---------- the club logo in the race window ----------
  { run("state.settings.clubLogo = 'data:image/png;base64,RACELOGO'");
    store.layouts = [{ id: 'L9', name: 'Logos', ratioW: 16, ratioH: 9, laneColors: [], widgets: [WD('logo', null, { id: 'lg1', y: 0 }), WD('logo', null, { id: 'lg2', y: 100, opt: { image: 'data:image/png;base64,OWNPIC' } })] }];
    await openRace({ name: 'Logos', sessionType: 'practice', layout: 'L9' }, store.tracks[0], rows(1, 2));
    const logos = run('live.nodes').filter(n => n.w.type === 'logo');
    say('in the race window a Logo widget without a picture shows the club logo, and one with its own picture shows that', logos.length === 2 && logos[0].val.innerHTML.includes('RACELOGO') && logos[1].val.innerHTML.includes('OWNPIC') && !logos[1].val.innerHTML.includes('RACELOGO'));
    run('delete state.settings.clubLogo'); }

  // ---------- transparency for all widgets of a layout ----------
  store.layouts = [{ id: 'T9', name: 'See-through', ratioW: 16, ratioH: 9, laneColors: [], widgetTransparency: 40,
    widgets: [WD('clock', null, { y: 0, bgColor: '#336699' }), WD('bestlap', 0, { y: 100, transparency: 0 }), WD('name', 0, { y: 200, transparency: 80 }), WD('lap', 0, { y: 300, transparency: '' })] }];
  await openRace({ name: 'See-through', sessionType: 'practice', layout: 'T9' }, store.tracks[0], rows(1, 2));
  say('widgets without a setting of their own follow the layout\'s transparency', nodeOf('clock', null).el.style.background === 'color-mix(in srgb, #336699 60%, transparent)' && nodeOf('lap', 0).el.style.background === 'color-mix(in srgb, var(--panel) 60%, transparent)' && nodeOf('lap', 0).el.style.borderColor === 'color-mix(in srgb, var(--line) 60%, transparent)');
  say('a widget\'s own setting wins: 0 is solid, 80 is more see-through', nodeOf('bestlap', 0).el.style.background === 'var(--panel)' && nodeOf('bestlap', 0).el.style.borderColor === '' && nodeOf('name', 0).el.style.background === 'color-mix(in srgb, var(--panel) 20%, transparent)');
  say('the layout\'s setting is shared with the Race Director page and the tablets', sent.stat && sent.stat.layout.widgetTransparency === 40);

  // ---------- batch B widgets on the live page ----------
  const WB = (type, lane, extra = {}) => ({ id: type + lane, type, lane, x: 0, y: 0, w: 300, h: 100, textSize: '', textColor: '', bgColor: '', opt: {}, ...extra });
  store.drivers[0].callsign = 'ALX';
  store.laps = [{ id: 'old1', driverId: 'd2', carId: 'c2', trackId: 't1', time: 4500, date: 'x' }];
  store.layouts = [{ id: 'B1', name: 'B', ratioW: 16, ratioH: 9, laneColors: [{ text: '#ffffff', bg: '#aa0000' }], widgets: [WB('callsign', 0), WB('sessionrecord', null), WB('trackrecord', null), WB('leaderboard', null, { opt: { design: 'RD1', scale: 70, gaps: 0, fill: 'rows' } }), WB('lastlap', 0, { opt: { lapsPerColumn: 3, columns: 2 } })] }];
  store.rowdesigns = [{ ...vm.runInContext('Rows.defaultDesign()', ctx), id: 'RD1', name: 'Wide rows' }];
  ctx.__fits = 0; run('(() => { const f = Rows.fitText; Rows.fitText = (r, m) => { __fits++; return f(r, m); }; })()');
  await openRace({ name: 'B', sessionType: 'practice', layout: 'B1' }, store.tracks[0], rows(1, 2));
  say('callsign reaches the page', nodeOf('callsign', 0).val.innerHTML === 'ALX');
  say('track record from earlier laps shows time and who set it', node('trackrecord').val.innerHTML.includes('4.500') && node('trackrecord').val.innerHTML.includes('Sam'));
  say('no session record before any lap', node('sessionrecord').val.innerHTML === '–');
  say('a leaderboard widget with a row design shows the rows, sized to the widget frame, the size choice and the closed-up columns', node('leaderboard').val.innerHTML.includes('class="rrows"') && node('leaderboard').val.innerHTML.includes('--rtot:146;--rk:0.7;--rw:985') && node('leaderboard').val.innerHTML.includes('aspect-ratio:985 / 70'));
  say('...and the Fill the frame choice of the widget reaches it too (taller rows)', node('leaderboard').val.innerHTML.includes('<div class="rrows" data-fill="rows" style="--rtot:146;--rk:0.7;--rw:985">'));
  say('...and the text of its cells is fitted to the cells when it is drawn', ctx.__fits > 0);
  say('leaderboard lists both drivers with the lane colour', node('leaderboard').val.innerHTML.includes('Alex') && node('leaderboard').val.innerHTML.includes('Sam') && node('leaderboard').el.style.background !== undefined);
  key(' '); await until(() => phase() === 'running');
  await wait(60); key('1'); await wait(60); key('1');
  say('session record shows the driver who set it', node('sessionrecord').val.innerHTML.includes('Alex') && !node('sessionrecord').val.innerHTML.includes('Sam'));
  say('a lap faster than the old track record takes over the track record widget', node('trackrecord').val.innerHTML.includes('Alex') && !node('trackrecord').val.innerHTML.includes('4.500'));
  say('last lap list shows the newest laps of lane 1 (up to 3 per column)', (n => n >= 1 && n <= 3)((nodeOf('lastlap', 0).val.innerHTML.match(/class="lli"/g) || []).length || 1));
  key('s');

  // ---------- batch C: 5 start lights, random lights-out wait ----------
  store.layouts = [{ id: 'C1', name: 'C', ratioW: 16, ratioH: 9, widgets: [WB('lights', null), WB('flag', null)] }];
  store.laps = [];
  const lightsOn = () => (node('lights').val.innerHTML.match(/sl on/g) || []).length;
  const lightsAll = () => (node('lights').val.innerHTML.match(/class="sl[ "]/g) || []).length;
  for (const [min, max, rnd, expect] of [[2, 4, 0, 2], [2, 4, 1, 4], [4, 2, 0, 2], ['', '', 0, 1]]) {
    run(`state.rand = () => ${rnd}`);
    await openRace({ name: 'C', sessionType: 'practice', layout: 'C1', lightsMin: min, lightsMax: max }, store.tracks[0], rows(1, 2));
    say(`there are five lights (min ${min || 'default'}, max ${max || 'default'})`, lightsAll() === 5 && lightsOn() === 0);
    key(' ');
    await until(() => lightsOn() === 5);
    say('the lights come on one by one until all five are lit, and the race has not started', phase() === 'countdown' && lightsOn() === 5);
    await until(() => phase() === 'running');
    say(`random wait between the two limits (${expect}s)`, Math.abs(run('live.lastWait') - expect) < 1e-9);
    say('lights out when the race starts', lightsOn() === 0 && phase() === 'running');
    key('s');
  }
  run('state.rand = null');

  // ---------- batch E: fuel and pit stops on the live page ----------
  store.layouts = [{ id: 'F1', name: 'F', ratioW: 16, ratioH: 9, widgets: [WB('fuel', 0, { opt: { mode: 'number' } }), WB('pitstop', 0), WB('name', 0)] }];
  store.laps = [];
  const fuelSetup = o => ({ name: 'F', sessionType: 'practice', layout: 'F1', lightsMin: 0, lightsMax: 0, fuel: 'on', fuelTank: 3, fuelPerLap: 1, fuelRate: 100, fuelEmpty: 'retire', pitHold: 0.05, ...o });
  const eng0 = () => run('live.engine()');
  const nodeL = type => run('live.nodes').find(n => n.w.type === type && n.w.lane === 0);
  els.sim.checked = false; // earlier tests may have left simulated cars switched on
  await openRace(fuelSetup(), store.tracks[0], rows(1, 2));
  say('before the race the fuel widget shows a full tank', nodeL('fuel').val.innerHTML.includes('3 L'));
  say('there is a Pit button per lane', run('live.pitBtns.length') === 2);
  key(' '); await until(() => phase() === 'running');
  await wait(60); key('1'); await wait(60); key('1');
  say('every lap uses fuel (3 L tank, 1 L per lap)', nodeL('fuel').val.innerHTML.includes('1 L'));
  // a pit stop with Shift + number, refuelling at 100 L/s after the hold time
  await wait(60);
  run('live').key({ key: '!', code: 'Digit1', shiftKey: true, target: { matches: () => false }, preventDefault() {} });
  say('Shift + 1 puts lane 1 on the sensor (a crossing is counted)', eng0().cars[0].blockAt !== null && eng0().cars[0].laps.length === 3);
  say('the Pit button now says Leave pit', run('live.pitBtns[0].b.textContent') === 'Leave pit 1');
  await wait(200);
  say('after the hold time the stop starts and the tank fills up', eng0().cars[0].pit !== null && nodeL('fuel').val.innerHTML.includes('3 L'));
  run('live').key({ key: '!', code: 'Digit1', shiftKey: true, target: { matches: () => false }, preventDefault() {} });
  say('pressing again drives off: the stop is recorded with its time', eng0().cars[0].blockAt === null && eng0().cars[0].pits.length === 1 && eng0().cars[0].pits[0].duration >= 150 && eng0().cars[0].pits[0].refuelled > 1.9);
  say('the pitstop widget shows the time of the stop', /^\d+\.\d{3}$/.test(nodeL('pitstop').val.innerHTML));
  await wait(60); key('1'); await wait(60); key('1'); await wait(60); key('1'); await wait(60); key('1');
  say('running dry retires the car (when set to retire)', eng0().cars[0].retired && eng0().cars[0].done && eng0().cars[0].laps.length === 6);
  key('s');
  // simulated cars pit by themselves when low
  await openRace(fuelSetup(), store.tracks[0], rows(1, 2)); els.sim.checked = true;
  key(' '); await until(() => phase() === 'running');
  await until(() => eng0().cars[0].pits.length >= 1 && eng0().cars[1].pits.length >= 1, 8000);
  say('simulated cars make their own pit stops and do not run dry', eng0().cars.every(c => c.pits.length >= 1 && !c.retired));
  key('s'); els.sim.checked = false;
  // stop mode: laps stop counting
  await openRace(fuelSetup({ fuelEmpty: 'stop' }), store.tracks[0], rows(1, 2));
  key(' '); await until(() => phase() === 'running');
  for (let k = 0; k < 6; k++) { await wait(60); key('1'); }
  say('"stop counting laps" keeps the car in the race but stops its laps', eng0().cars[0].laps.length === 3 && !eng0().cars[0].retired && phase() === 'running');
  key('s');

  // ---------- 1.0.0: what a finished race saves for the figures of Results: the lane of every lap, the lap with a pit stop, the pit stops and their time ----------
  { saved.length = 0; els.sim.checked = false;
    await openRace(fuelSetup({ fuelTank: 8 }), store.tracks[0], rows(1, 2));
    const shift1 = () => run('live').key({ key: '!', code: 'Digit1', shiftKey: true, target: { matches: () => false }, preventDefault() {} });
    key(' '); await until(() => phase() === 'running');
    await wait(60); key('1'); await wait(60); key('2'); await wait(60); key('1');
    await wait(60); shift1(); await wait(200); shift1(); // lane 1 goes into the pits and leaves again
    await wait(60); key('1'); await wait(60); key('1'); key('2');
    key('s'); await until(() => phase() === 'finished', 3000); await wait(100);
    const [sess, rowsL] = saved[0] || [{ standings: [] }, []], x1 = sess.standings.find(x => x.driverId === 'd1'), x2 = sess.standings.find(x => x.driverId === 'd2');
    say('the race is saved once', saved.length === 1 && sess.standings.length === 2);
    say('every lap row says which lane it was driven in (lane 1 is the first car, lane 2 the second)', rowsL.length > 0 && rowsL.filter(l => l.driverId === 'd1').every(l => l.lane === 1) && rowsL.filter(l => l.driverId === 'd2').every(l => l.lane === 2));
    say('the standings have the pit stops and the time in the pits (the car that pitted: 1 stop of 150 ms or more; the other: 0)', x1.pits === 1 && x1.pitTime >= 150 && x2.pits === 0 && x2.pitTime === 0);
    const pitRows = rowsL.filter(l => l.pit);
    say('exactly one lap is marked as the lap with a pit stop: the one after the stop, of the car that pitted', pitRows.length === 1 && pitRows[0].driverId === 'd1' && pitRows[0].lapNumber === 4);
    say('...the other laps are not marked', rowsL.filter(l => l.driverId === 'd2').every(l => !l.pit));
  }
  // a race without fuel and without pit stops has no pit figures, and a race with a penalty system has its points (and none for a heat race without a system)
  { saved.length = 0; els.sim.checked = false;
    await openRace({ name: 'P', sessionType: 'practice', layout: 'F1', lightsMin: 0, lightsMax: 0 }, store.tracks[0], rows(1, 2));
    key(' '); await until(() => phase() === 'running'); await wait(60); key('1'); await wait(60); key('1'); key('s'); await until(() => phase() === 'finished', 3000); await wait(100);
    say('without fuel and without a pit stop the standings have no pit figures (older sessions look the same)', saved.length === 1 && saved[0][0].standings.every(x => x.pits === undefined && x.pitTime === undefined && x.penaltyPoints === undefined) && saved[0][1].every(l => l.lane > 0 && !l.pit));
    // ...but a pit stop in a race without fuel (a stop on the sensor, as for a drive-through penalty) is saved
    saved.length = 0;
    await openRace({ name: 'P2', sessionType: 'practice', layout: 'F1', lightsMin: 0, lightsMax: 0, pitHold: 0.05 }, store.tracks[0], rows(1, 2));
    const shiftA = () => run('live').key({ key: '!', code: 'Digit1', shiftKey: true, target: { matches: () => false }, preventDefault() {} });
    key(' '); await until(() => phase() === 'running'); await wait(60); key('1'); await wait(60); key('1');
    shiftA(); await wait(200); shiftA(); await wait(60); key('1'); await wait(60); key('2'); key('s'); await until(() => phase() === 'finished', 3000); await wait(100);
    const xs = saved[0][0].standings;
    say('a stop in a race without fuel is saved too: the car that stopped has 1 pit stop and its time, the other has none', xs.find(x => x.driverId === 'd1').pits === 1 && xs.find(x => x.driverId === 'd1').pitTime >= 150 && xs.find(x => x.driverId === 'd2').pits === undefined && saved[0][1].filter(l => l.pit).length === 1);
  }

  // a heat race adds up what every heat brought: the pit stops (and, with a penalty system, the points) of a driver over all the heats
  { saved.length = 0; store.laps = [];
    await openRace(fuelSetup({ name: 'HeatsPit', sessionType: 'heats', heatBy: 'laps', laps: 4, endRule: 'all', heatPlan: 'roundrobin', resultBy: 'points', points: '10, 8, 6', layout: '' }), store.tracks[0], rows(1, 2, 3));
    els.sim.checked = true; let hn = 0;
    while (phase() !== 'finished' && hn++ < 6) { key(' '); await until(() => ['between', 'finished'].includes(phase()), 20000); }
    els.sim.checked = false; await wait(100);
    const st = (saved[0] || [{ standings: [] }])[0].standings;
    say('3 heats with fuel: one session, three drivers, each of whom raced two heats', hn === 3 && saved.length === 1 && st.length === 3);
    say('...every driver has the pit stops of both heats added up (a 3 L tank and 4 laps of 1 L: at least one stop in each heat) and their time', st.every(x => x.pits >= 2 && x.pitTime > 0));
    say('...the lap rows know their lane, and some are marked as the lap with a pit stop', saved[0][1].every(l => l.lane >= 1 && l.lane <= 2) && saved[0][1].some(l => l.pit) && saved[0][1].filter(l => l.pit).length <= st.reduce((a, x) => a + x.pits, 0));
  }

  { saved.length = 0; store.laps = []; store.penaltysystems = [{ id: 'p1', name: 'Std', timeRule: 'every', everyPoints: 5, everySeconds: 5, dqPoints: 12 }];
    await openRace({ name: 'HeatsPen', sessionType: 'heats', heatBy: 'laps', laps: 2, endRule: 'all', heatPlan: 'roundrobin', resultBy: 'points', points: '10, 8, 6', layout: '', penaltySystem: 'p1' }, store.tracks[0], rows(1, 2, 3));
    els.sim.checked = true; let hn = 0, who = '';
    while (phase() !== 'finished' && hn++ < 6) {
      key(' '); await until(() => phase() === 'running'); if (hn === 1) { who = run('live.engine().cars[0].driverId'); run('live.engine().addPoints(0, 2, 5)'); }
      await until(() => ['between', 'finished', 'review'].includes(phase()), 20000);
      if (phase() === 'review') { run('live.reviewCommand')({ op: 'finalize' }); await until(() => ['between', 'finished'].includes(phase()), 5000); }
    }
    els.sim.checked = false; await wait(100);
    const st = (saved[0] || [{ standings: [] }])[0].standings;
    say('a heat race with a penalty system: the points a driver got in a heat are in the saved standings, added up over the heats', hn === 3 && saved.length === 1 && st.find(x => x.driverId === who).penaltyPoints === 2 && st.filter(x => x.driverId !== who).every(x => x.penaltyPoints === 0));
  }

  // ---------- batch F on the live page ----------
  store.slotcars[0].picture = 'data:image/png;base64,CARPIC'; store.slotcars[0].brand = 'NSR'; store.slotcars[0].manufacturer = 'Ford'; store.slotcars[0].model = 'GT40';
  store.layouts = [{ id: 'G1', name: 'G', ratioW: 16, ratioH: 9, widgets: [WB('carpicture', 0, { opt: { frame: { zoom: 2, x: 1, y: 0 } } }), WB('carname', 0), WB('clock', null),
    WB('bestlap', 0, { titleSpace: true, titleBold: true, valueItalic: true, valueBold: false }), WB('name', 0)] }];
  els.sim.checked = false;
  await openRace({ name: 'G', sessionType: 'practice', layout: 'G1' }, store.tracks[0], rows(1, 2));
  say('slotcar picture on the live page, framed', nodeL('carpicture').val.innerHTML.includes('base64,CARPIC') && nodeL('carpicture').val.innerHTML.includes('translate(50%, 0%) scale(2)'));
  say('slotcar name on the live page', nodeL('carname').val.innerHTML.includes('NSR') && nodeL('carname').val.innerHTML.includes('GT40'));
  say('race clock starts at 00:00.0', run("live.nodes.find(n => n.w.type === 'clock')").val.innerHTML === '00:00.0');
  say('title takes space only when switched on', nodeL('bestlap').el.className.includes('tspace') && !nodeL('name').el.className.includes('tspace'));
  say('title bold and value italic / normal weight are applied', nodeL('bestlap').tit.style.fontWeight === '700' && nodeL('bestlap').val.style.fontStyle === 'italic' && nodeL('bestlap').val.style.fontWeight === '400' && nodeL('name').val.style.fontWeight === '600' && nodeL('name').tit.style.fontWeight === undefined);

  // ---------- batch G on the live page: speed ----------
  store.tracks[0].length = 13; store.tracks[0].scale = '1:32';
  store.layouts = [{ id: 'S1', name: 'S', ratioW: 16, ratioH: 9, widgets: [WB('speed', 0), WB('speed', 1, { opt: { mode: 'real', unit: 'mph' } })] }];
  els.sim.checked = false;
  await openRace({ name: 'S', sessionType: 'practice', layout: 'S1' }, store.tracks[0], rows(1, 2));
  say('speed shows a dash before the first lap', nodeL('speed').val.innerHTML === '–');
  key(' '); await until(() => phase() === 'running');
  await wait(60); key('1'); key('2');
  say('speed from the track length and the lap time, scaled km/h and real mph', /^\d+ km\/h$/.test(nodeL('speed').val.innerHTML) && /^[\d.]+ mph$/.test(run("live.nodes.find(n => n.w.type === 'speed' && n.w.lane === 1)").val.innerHTML));
  key('s');
  store.tracks[0].length = '';
  await openRace({ name: 'S', sessionType: 'practice', layout: 'S1' }, store.tracks[0], rows(1, 2));
  key(' '); await until(() => phase() === 'running'); await wait(60); key('1');
  say('a track without a length shows a dash', nodeL('speed').val.innerHTML === '–');
  key('s');

  // ---------- batch H: the race shared with the Live Race pages ----------
  run("state.settings.clubLogo = 'data:image/png;base64,CLUBLOGO'");
  els.sim.checked = false;
  await openRace({ name: 'Shared', sessionType: 'race', laps: 9, endRule: 'all', layout: '' }, store.tracks[0], rows(1, 2));
  say('the race window shares its static part when it opens', !!sent.stat && sent.stat.title.includes('Shared') && sent.stat.lanes === 2 && sent.stat.cfg.entries.length === 2);
  key(' '); await until(() => phase() === 'running');
  await wait(60); key('1'); await wait(60); key('2'); await wait(60); key('1'); await wait(200);
  say('and the changing part many times', sent.n > 3 && sent.dyn.cars[0].laps.length === 2 && sent.dyn.cars[1].laps.length === 1 && sent.dyn.phase === 'running');
  say('the changing part is small: no pictures or layout in it', JSON.stringify(sent.dyn).length < 2500 && JSON.stringify(sent.last).length < 2500 && !('layout' in sent.dyn) && !('layout' in sent.last));
  // ---- the changing part sends only what changed: new laps, and only when something happened ----
  say('the first message after the static part holds everything of the lists (from 0), and the messages are numbered one after the other', sent.log.length > 1 && sent.log[0].cars.every(c => c.laps.from === 0 && c.bad.from === 0) && sent.log[0].events.from === 0 && sent.log.every((m, i) => i === 0 || m.seq === sent.log[i - 1].seq + 1 || m.raceId !== sent.log[i - 1].raceId));
  say('after that a message holds the new laps only: one, or two that came within the same tenth of a second (a lap list is never sent again, however long)', sent.log.slice(1).every(m => m.cars.every(c => c.laps.tail.length <= 2 && c.bad.tail.length <= 2)) && sent.log.some(m => m.cars.some(c => c.laps.tail.length === 1)));
  say('the app (here: the test stand-in for it) never lost track of the messages of the race window', sent.gaps === 0);
  { const n0 = sent.n; await wait(1500); const dn = sent.n - n0; say('a quiet race sends about one message a second (the clocks of the other screens run by themselves in between)', dn >= 1 && dn <= 3); }
  ctx.__sent = sent;
  const same = run(`(() => { const V = LiveShare.viewer(); V.feedStatic(__sent.stat); V.feedDynamic(__sent.dyn, performance.now()); const S = V.shared(performance.now());
    const bad = []; for (const type of ['name', 'position', 'lap', 'bestlap', 'avglap', 'lastlap', 'gap']) for (const l of [0, 1]) {
      const w = live.nodes.find(n => n.w.type === type && n.w.lane === l); if (!w) continue; const out = Timing.content(w.w, S).html; if (out !== w.val.innerHTML) bad.push(type + l + ': ' + out + ' vs ' + w.val.innerHTML); }
    return bad; })()`);
  say('a viewer rebuilt from the shared data draws the same as the race window', same.length === 0); if (same.length) console.log(same);
  const host = document.createElement('div');
  await run('LiveView.mount')(host, {}); const body = () => E('lv-body');
  say('Live Race landing page: a tile for every page, including the Race Director', /Race timing/.test(body().innerHTML) && /Leaderboard/.test(body().innerHTML) && /Driver stats/.test(body().innerHTML) && /data-go="director"/.test(body().innerHTML) && !/data-go="director" disabled/.test(body().innerHTML));
  run('LiveView.go')('timing');
  say('Live Race timing page builds the layout read-only (no control buttons)', run('LiveView.nodes()').length > 0 && run('LiveView.nodes()').every(n => !n.w.type.match(/^(start|pause|stop|yellow|red)$/)));
  // ---------- the Race timing page of Live Race: only the widgets, as large as the window allows ----------
  { const cls = new Set(), hostC = { innerHTML: '', classList: { add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c) } };
    await run('LiveView.mount')(hostC, {});
    say('the landing page of Live Race keeps its bar and is not the clean page', !cls.has('lv-clean') && E('lv-body').innerHTML.includes('lv-tiles'));
    run('LiveView.go')('timing');
    say('the Race timing page of a running race is the clean page: the widgets in a full window view, no bar (it is a bar over the widgets that shows when the pointer moves)', cls.has('lv-clean') && !cls.has('lv-show') && E('lv-body').innerHTML.includes('class="fullview"') && E('lv-body').innerHTML.includes('id="lv-canvas"') && !E('lv-body').innerHTML.includes('rt-stage'));
    say('...and it is as large as the window allows: no space kept free below the page (the width follows the whole height of the window)', /100vh - 0px/.test(E('lv-canvas').style.width));
    say('...without any button: the control widgets are left out', run('LiveView.nodes()').length > 0 && run('LiveView.nodes()').every(n => !run('Widgets.def')(n.w.type).button));
    hostC.onpointermove(); say('a movement of the pointer shows the bar', cls.has('lv-show'));
    hostC.onpointerdown(); say('so does a touch (a phone has no pointer to move)', cls.has('lv-show'));
    await wait(2700); say('...and it goes away again after a moment', !cls.has('lv-show') && cls.has('lv-clean'));
    run('LiveView.go')('board'); say('the other pages have their bar as before', !cls.has('lv-clean') && !cls.has('lv-show'));
    run('LiveView.go')('timing'); hostC.onpointermove(); say('back on the timing page it is clean again, and the bar can be shown again', cls.has('lv-clean') && cls.has('lv-show'));
    run('LiveView.unmount')(); say('leaving the Live Race pages takes the clean look and the pointer handling away', !cls.has('lv-clean') && !cls.has('lv-show') && hostC.onpointermove === null && hostC.onpointerdown === null);
    await run('LiveView.mount')(document.createElement('div'), {}); // (the page that follows uses its own host)
  }
  run('LiveView.go')('board');
  say('Leaderboard page shows the drivers', E('lv-board').innerHTML.includes('Alex') && E('lv-board').innerHTML.includes('Sam'));
  say('...and the size slider is not offered there (the page has no widget frame to fit)', !body().innerHTML.includes('Size of the rows') && !body().innerHTML.includes('id="lb-scale'));
  say('the shared race carries the picture sets', Array.isArray(sent.stat.imageSets));
  say('the shared race carries the club logo', sent.stat.clubLogo === 'data:image/png;base64,CLUBLOGO');
  say('a viewer draws a Logo widget without a picture with the club logo, and one with a picture of its own with that', run(`(() => { const V = LiveShare.viewer(); V.feedStatic(__sent.stat); V.feedDynamic(__sent.dyn, performance.now()); const S = V.shared(performance.now()); return [Timing.content({ type: 'logo', opt: {} }, S).html, Timing.content({ type: 'logo', opt: { image: 'data:OWN' } }, S).html]; })()`).join('|').match(/CLUBLOGO.*\|.*data:OWN/) && !run(`(() => { const V = LiveShare.viewer(); V.feedStatic(__sent.stat); V.feedDynamic(__sent.dyn, performance.now()); return Timing.content({ type: 'logo', opt: { image: 'data:OWN' } }, V.shared(performance.now())).html; })()`).includes('CLUBLOGO'));
  { const st = run(`LiveShare.packStatic({ eng: { cfg: { type: 'race', laps: 5, rnd: Math.random, entries: [{ lane: 0 }] } }, base: { personal: new Map(), track: Infinity, trackName: '' } })`);
    let cloned = true; try { structuredClone(st); } catch { cloned = false; }
    say('1.9.1: the engine settings sent to the other windows hold no function (a random generator can not travel through Electron: "An object could not be cloned"), the other settings stay', cloned && !('rnd' in st.cfg) && st.cfg.type === 'race' && st.cfg.laps === 5 && st.cfg.entries.length === 1); }
  { // 1.10.0: the damage of a car travels to the other windows (and nothing for a car that never had any)
    const RE = run('RaceEngine'), LS = run('LiveShare'), Dm = run('Damage'), wire = m => JSON.parse(JSON.stringify(m));
    const r = RE.createRace({ type: 'timed', duration: 600, minLap: 800, damage: Dm.clean(Dm.defaults(), 0), entries: [0, 1].map(i => ({ lane: i, driverId: 'd' + i, carId: 'c' + i, driverName: 'D' + i, carName: 'C' + i, damageFactor: i ? 2 : 1 })) }); r.start(0);
    const cx = t => ({ raceId: 'x', eng: r, phase: 'running', calling: false, lights: 5, heat: null, flash: new Map(), bestAll: Infinity, bestAllName: '', bestBy: new Map(), now: t, champ: null });
    const S = LS.sender(), m1 = wire(S.pack(cx(1000), 1000));
    say('a car that never had damage sends no damage figures', m1.cars.every(c => !('dmg' in c) && !('repairs' in c)));
    r.addDamage(0, 3, 2000); r.addDamage(1, 3, 2000);
    const m2 = wire(S.pack(cx(2100), 2100)), a = LS.applyDynamic(null, m2);
    say('...a car that had damage sends its points, level, deadline, repairs and damage factor, and a receiver has them (the factor of the car: 2 gives double)', a.ok && m2.cars[0].dmg === 3 && m2.cars[1].dmg === 6 && a.state.cars[1].dmgLvl === 1 && a.state.cars[1].damageFactor === 2 && a.state.cars[0].repairs.length === 0);
    const st = LS.packStatic({ eng: r, base: { personal: new Map(), track: Infinity, trackName: '' } });
    let cloned = true; try { structuredClone(st); } catch { cloned = false; }
    say('...the rules of the Damage System travel in the settings of the race (no function in them), so a viewer works out the same levels', cloned && st.cfg.damage && st.cfg.damage.levels.length === 4 && st.cfg.damage.levels[0].name === 'Light damage'); }
  say('a race that is shared without a club logo sends none', run(`LiveShare.packStatic({ eng: __sent.stat.cfg && { cfg: __sent.stat.cfg }, base: { personal: new Map(), track: Infinity, trackName: '' } }).clubLogo`) === '');
  { // ---- the sender and the receiver of the changing part, on their own ----
    const RE = run('RaceEngine'), LS = run('LiveShare'), wire = m => JSON.parse(JSON.stringify(m));
    const entries = [0, 1].map(i => ({ lane: i, driverId: 'd' + i, carId: 'c' + i, driverName: 'D' + i, carName: 'C' + i }));
    const mkRace = (laps = 0) => { const r = RE.createRace({ type: 'practice', entries, minLap: 800 }); r.start(0); for (let k = 0; k < laps; k++) { r.cross(0, 5000 + k * 6000 + (k * k % 97) + 0.123456); r.cross(1, 5500 + k * 6100 + 0.7 * (k % 3) + (k * k % 89)); } return r; };
    const cx = (r, t, extra = {}) => ({ raceId: 'x', eng: r, phase: 'running', calling: false, lights: 5, heat: null, flash: new Map(), bestAll: Infinity, bestAllName: '', bestBy: new Map(), now: t, champ: null, ...extra });
    const lapsOf = st => st.cars.map(c => c.laps);
    const r1 = mkRace(30), S1 = LS.sender(), m1 = wire(S1.pack(cx(r1, 200000), 200000)), a1 = LS.applyDynamic(null, m1);
    say('the first message of a sender holds all the laps, and a receiver with nothing builds the state from it', m1.seq === 1 && m1.cars.every(c => c.laps.from === 0 && c.laps.tail.length === 30) && a1.ok && lapsOf(a1.state).every(l => l.length === 30) && a1.state.cars[0].laps[0] === 5000.123 && a1.state.cars[0].laps[1] === LS.cap(r1.cars[0].laps[1]));
    say('...the state is what packDynamic gives (the whole thing in one go)', JSON.stringify(a1.state.cars.map(c => [c.laps, c.bad])) === JSON.stringify(wire(LS.packDynamic(cx(r1, 200000))).cars.map(c => [c.laps, c.bad])));
    say('when nothing changes, nothing is sent (not even once, after the message that told the change)', S1.pack(cx(r1, 200100), 200100) === null && S1.pack(cx(r1, 200200), 200200) === null && S1.pack(cx(r1, 200900), 200900) === null);
    const hb = wire(S1.pack(cx(r1, 201000), 201000));
    say('...but a small message goes out every second, with no laps in it, so that the clocks of the other screens stay right', hb && hb.seq === 2 && hb.sentNow === 201000 && hb.cars.every(c => c.laps.from === 30 && c.laps.tail.length === 0) && JSON.stringify(hb).length < 2500);
    r1.cross(0, 300000); const m3 = wire(S1.pack(cx(r1, 300050), 300050));
    say('a new lap is sent at once, and only that lap', m3 && m3.cars[0].laps.from === 30 && m3.cars[0].laps.tail.length === 1 && m3.cars[1].laps.tail.length === 0 && m3.cars[0].bad.tail.length === 1);
    const long = mkRace(3000), SL = LS.sender(), big = wire(SL.pack(cx(long, 1e7), 1e7)); long.cross(0, 1e7 + 5000); const oneMore = wire(SL.pack(cx(long, 1e7 + 5100), 1e7 + 5100));
    say('however long the race, a new lap makes a small message: 3000 laps a car, and the message is under 2.5 KB (all of it would be over 50 KB)', JSON.stringify(oneMore).length < 2500 && JSON.stringify(wire(LS.packDynamic(cx(long, 1e7)))).length > 50000 && big.cars[0].laps.tail.length === 3000);
    { // many messages in a row: the receiver always ends up with the laps of the race
      const r = mkRace(2), S = LS.sender(); let st = null, all = true, n = 0, t = 20000;
      for (let k = 0; k < 150; k++) { t += 3000 + (k % 7) * 100; r.cross(k % 2, t); if (k % 5 === 0) r.cross((k + 1) % 2, t + 900); const m = S.pack(cx(r, t + 1), t + 1); if (m) { const a = LS.applyDynamic(st, wire(m)); if (!a.ok) all = false; else st = a.state; n++; } }
      say('150 messages one after the other: the receiver has exactly the laps of the race (also the flags of too slow laps), and none was refused', all && n > 100 && JSON.stringify(lapsOf(st)) === JSON.stringify(r.cars.map(c => c.laps.map(LS.cap))) && JSON.stringify(st.cars.map(c => c.bad)) === JSON.stringify(r.cars.map(c => c.bad))); }
    { // a lap removed from the middle (the race gets one lap fewer)
      const r = mkRace(10), S = LS.sender(), a = LS.applyDynamic(null, wire(S.pack(cx(r, 100000), 100000)));
      r.removeLap(0, 3, true); const m = wire(S.pack(cx(r, 100100), 100100)), b = LS.applyDynamic(a.state, m);
      say('a lap taken out of the middle: the message says from where the list is different, and the receiver has the same list again', m.cars[0].laps.from === 3 && m.cars[0].laps.tail.length === 6 && m.cars[1].laps.tail.length === 0 && b.ok && b.state.cars[0].laps.length === 9 && JSON.stringify(lapsOf(b.state)) === JSON.stringify(r.cars.map(c => c.laps.map(LS.cap))));
      r.setInvalid(1, 2, true); const m2 = wire(S.pack(cx(r, 100200), 100200)), c2 = LS.applyDynamic(b.state, m2);
      say('a lap marked invalid is a change too (the list of invalid laps is small and is sent whole)', m2 && c2.ok && JSON.stringify(c2.state.cars[1].invalid) === '[2]'); }
    { // an entry in the race log is a change by itself
      const r = mkRace(3), S = LS.sender(); S.pack(cx(r, 40000), 40000); r.events.push({ type: 'call', car: 0, t: 40100 });
      const m = wire(S.pack(cx(r, 40200), 40200));
      say('a new entry in the race log is a change by itself (no lap, nothing else): it is sent at once, and only that entry', m && m.events.tail.length === 1 && m.events.from === 0 && m.cars.every(c => c.laps.tail.length === 0) && m.seq === 2);
      const m2 = wire(S.pack(cx(r, 40300), 40300)); r.events.push({ type: 'callend', car: 0, t: 40400 }); const m3 = wire(S.pack(cx(r, 40500), 40500));
      say('...and the next entry is sent as an addition to the log, not the whole log again', m2 === null && m3.events.from === 1 && m3.events.tail.length === 1 && m3.events.tail[0].type === 'callend'); }
    { // 1.9.0: an Endurance Race sends the state of the swaps and who is at the wheel for a car that swaps, and nothing extra for a car that does not
      const roster = [{ id: 'a', name: 'Alex' }, { id: 'b', name: 'Bea' }], EN = run('Endurance').clean({ sessionType: 'endurance', swapUnit: 'laps', swapEvery: 2 });
      const r = RE.createRace({ type: 'race', laps: 20, endurance: EN, minLap: 800, entries: [{ lane: 0, driverId: 'a', driverName: 'Alex', carId: 'c0', teamId: 'T', teamName: 'Red', roster }, { lane: 1, driverId: 'z', driverName: 'Zed', carId: 'c1' }] });
      r.start(0); r.cross(0, 5000); r.cross(0, 10000); r.cross(1, 5500); r.tick(10100); r.swap(0, 10200);
      const S = LS.sender(), m = wire(S.pack(cx(r, 10300), 10300)), a = LS.applyDynamic(null, m);
      say('a car that swaps is sent with its swap state and the driver now at the wheel; a car that does not swap has neither', a.ok && a.state.cars[0].en && a.state.cars[0].en.swaps === 1 && a.state.cars[0].driverId === 'b' && a.state.cars[0].driverName === 'Bea' && a.state.cars[1].en === undefined && !('swapLost' in a.state.cars[1]));
      r.cross(0, 15000); r.tick(15100);
      const m2 = wire(S.pack(cx(r, 15200), 15200)), a2 = LS.applyDynamic(a.state, m2);
      say('...a change in the swap state of one car is a change by itself, and the viewer has the same state as the race', m2 && a2.ok && JSON.stringify(a2.state.cars[0].en) === JSON.stringify(r.cars[0].en) && a2.state.cars[0].laps.length === r.cars[0].laps.length);
      say('...the viewer works out the same look at the swaps as the race (the same rules, from the same state)', run('Endurance').look(EN, a2.state.cars[0].en, 15200, 3).state === run('Endurance').look(EN, r.cars[0].en, 15200, 3).state);
      const plain = wire(LS.sender().pack(cx(mkRace(3), 40000), 40000));
      say('a race without swaps does not send the swap keys at all', plain.cars.every(c => !('en' in c) && !('swapLaps' in c))); }
    { // a message that is missed
      const r = mkRace(5), S = LS.sender(), a = LS.applyDynamic(null, wire(S.pack(cx(r, 50000), 50000)));
      r.cross(0, 60000); const lost = wire(S.pack(cx(r, 60001), 60001)); r.cross(1, 61000); const next = wire(S.pack(cx(r, 61001), 61001));
      const bad = LS.applyDynamic(a.state, next);
      say('a message that was missed is noticed (the next one does not fit), instead of being applied to a list that lacks a lap', !bad.ok && bad.state === a.state);
      { // a lost message that removed a lap and added one: the list is as long as before, so only the numbers can tell
        const r2 = mkRace(10), S2 = LS.sender(), a2 = LS.applyDynamic(null, wire(S2.pack(cx(r2, 80000), 80000)));
        r2.removeLap(0, 3, true); r2.cross(0, 90000); const lost2 = wire(S2.pack(cx(r2, 90001), 90001)); r2.cross(1, 91000); const next2 = wire(S2.pack(cx(r2, 91001), 91001));
        say('a lost message is also noticed when the lists are as long as they were (a lap removed and one added): by the numbers of the messages', lost2.cars[0].laps.from === 3 && next2.cars[0].laps.from === 10 && next2.cars[0].laps.tail.length === 0 && !LS.applyDynamic(a2.state, next2).ok && LS.applyDynamic(a2.state, lost2).ok); }
      const odd = wire(next); odd.seq = a.state.seq + 1; odd.cars[0].laps.from = 8; // numbered right, but its list continues a list that is longer than the one the receiver has
      say('...and so is a message that has the right number but a list that continues after entries the receiver does not have', !LS.applyDynamic(a.state, odd).ok);
      const V = LS.viewer(); V.feedStatic(wire(LS.packStatic({ raceId: 'x', title: 'T', eng: { cfg: r.cfg }, setup: {}, layout: {}, track: {}, lanes: 2, base: { personal: new Map(), track: Infinity, trackName: '' } })));
      const ok1 = V.feedDynamic(wire(a.state), 1000), okMiss = V.feedDynamic(next, 2000);
      say('a viewer that misses a message does not draw it, and says it needs the whole state', ok1 && !okMiss && V.needsSync());
      const whole = LS.applyDynamic(null, wire(LS.packDynamic(cx(r, 61001)))), ok3 = V.feedDynamic({ ...wire(whole.state), seq: next.seq }, 3000);
      say('...given the whole state it carries on, and the engine of the viewer has the laps of the race', ok3 && !V.needsSync() && JSON.stringify(V.engine().cars.map(c => c.laps)) === JSON.stringify(r.cars.map(c => c.laps.map(LS.cap))));
      r.cross(0, 70000); const after = wire(S.pack(cx(r, 70001), 70001)); after.seq = next.seq + 1; // the sender is a few messages further than that state, as it would be in the real thing
      const stale = V.feedDynamic(wire(lost), 4000);
      say('a message that is older than the state is ignored (it is in there already)', !stale && !V.needsSync());
      const V2 = LS.viewer(); V2.feedStatic(V.stat());
      say('a window that opens late and is handed one of the small messages (not the whole state) cannot use it, and knows it', !V2.feedDynamic(next, 1) && V2.needsSync() && V2.engine().cars.every(c => c.laps.length === 0)); }
    { // a new race, and a new start of the sender
      const r = mkRace(4), S = LS.sender(); S.pack(cx(r, 10000), 10000); r.cross(0, 20000); S.pack(cx(r, 20001), 20001);
      const n1 = wire(S.pack(cx(r, 20002, { raceId: 'y' }), 20002));
      say('for another race (another id) the first message holds everything again', n1 && n1.raceId === 'y' && n1.cars.every(c => c.laps.from === 0));
      S.reset(); const n2 = wire(S.pack(cx(r, 20003, { raceId: 'y' }), 20003));
      say('...and after reset() as well (the app asked for everything again)', n2 && n2.cars.every(c => c.laps.from === 0) && n2.cars[0].laps.tail.length === r.cars[0].laps.length); }
    { // 3 decimals
      const r = mkRace(0); r.cross(0, 5000); r.cross(0, 5000 + 6713.334441091514); r.cross(1, 5100.123456789); r.cross(1, 11000.7654321);
      const m = wire(LS.sender().pack(cx(r, 12000.123456789), 12000.123456789));
      say('numbers are sent with 3 decimals at most (the lap time 6713.334441091514 as 6713.334)', m.cars[0].laps.tail[1] === 6713.334 && m.cars.every(c => c.laps.tail.every(v => String(v).split('.')[1] === undefined || String(v).split('.')[1].length <= 3)) && m.sentNow === 12000.123);
      let seed = 99, rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296, differs = 0, cut = 0, same = 0;
      for (let i = 0; i < 200000; i++) { const x = i % 4 === 0 ? Math.floor(rnd() * 100000) + 0.5 + (rnd() - 0.5) * 0.002 : rnd() * 300000, c = LS.cap(x); if (RE.fmtTime(c) !== RE.fmtTime(x)) differs++; if (c === x) same++; else cut++; }
      say('cutting a time short never changes what is shown (200,000 times, a quarter of them right on the edge between two thousandths of a second)', differs === 0 && cut > 150000 && same > 0);
      say('...the digits that are compared are the digits of the time display', Array.from({ length: 2000 }, () => rnd() * 400000).every(x => { const t = RE.fmtTime(x), min = Math.floor(x / 60000); return LS.shown(x).split(':')[0] === String(min) && Number(LS.shown(x).split(':')[1]) === Number(t.split(':').pop()); }));
      say('a number that is not a number (nothing yet, infinity) is left as it is', LS.cap(null) === null && LS.cap(Infinity) === Infinity && LS.cap('x') === 'x' && LS.cap(5) === 5); }
  }
  run('delete state.settings.clubLogo');
  say('the shared race carries the row designs and the page offers them', sent.stat.rowDesigns.length === 1 && body().innerHTML.includes('data-lbcell="0"') && body().innerHTML.includes('Wide rows'));
  const viaViewer = run(`(() => { const V = LiveShare.viewer(); V.feedStatic(__sent.stat); V.feedDynamic(__sent.dyn, performance.now()); return Timing.content({ type: 'leaderboard', opt: { design: 'RD1' } }, V.shared(performance.now())).html; })()`);
  say('a viewer draws the leaderboard widget with the row design', viaViewer.includes('rrows') && viaViewer.includes('Alex') && viaViewer.includes('Sam') && !viaViewer.includes('<table'));
  const fits0 = ctx.__fits;
  run("state.settings.liveBoard = { design: 'RD1' }"); run('LiveView.go')('board');
  say('Leaderboard page with a row design chosen shows the rows and hides the column choices', E('lv-board').innerHTML.includes('rrows') && !body().innerHTML.includes('data-lb="colLast"') && body().innerHTML.includes('value="RD1" selected'));
  say('...its text is fitted to the cells, and there is no size slider on that page', ctx.__fits > fits0 && !body().innerHTML.includes('Size of the rows'));
  run("state.settings.liveBoard = {}"); run('LiveView.go')('board');
  const chg = (dataset, value, type) => body().onchange({ target: { dataset, value, type } });
  const clk = dataset => body().onclick({ target: { closest: () => ({ dataset }) } });
  const boards = () => E('lv-board').innerHTML.split('class="lv-board"').slice(1);
  const cnt = (h, re) => (h.match(re) || []).length;
  say('1.11.0: the page offers a grid: 24 squares to pick it (6 by 4), its size in words, and one cell with the classic table', cnt(body().innerHTML, /data-lbgrid=/g) === 24 && body().innerHTML.includes('1 column × 1 row') && body().innerHTML.includes('data-lbcell="0"') && boards().length === 1 && boards()[0].includes('<table class="lb">') && body().innerHTML.includes('data-lb="colLast"'));
  say('...the Customize list is closed when the page opens', body().innerHTML.includes('<details class="lv-opts"><summary>'));
  await clk({ lbgrid: '4,1' }); await wait(20);
  say('picking 4 columns by 1 row gives four cells: the board stays in the first, three are empty', body().innerHTML.includes('4 columns × 1 row') && cnt(body().innerHTML, /data-lbadd=/g) === 3 && boards().length === 1 && run('state.settings.liveGrid.cols') === 4 && run('state.settings.liveGrid.rows') === 1);
  say('...the grid is saved as a grid (the old settings are not touched), and the list stays open while you work in it', run('state.settings.liveGrid.boards.length') === 1 && body().innerHTML.includes('<details class="lv-opts" open>'));
  await chg({ lbadd: '2,1' }, 'RD1'); await wait(20);
  say('a row design for an empty cell makes a board there, next to the first', boards().length === 2 && boards()[0].includes('<table class="lb">') && boards()[1].includes('rrows') && boards()[1].includes('grid-column:2 / span 1') && cnt(body().innerHTML, /data-lbadd=/g) === 2);
  await chg({ lbadd: '3,1' }, '~classic'); await chg({ lbadd: '4,1' }, 'RD1'); await wait(20);
  say('four boards side by side, each in its own column', boards().length === 4 && E('lv-board').innerHTML.includes('grid-template-columns:repeat(4,minmax(0,1fr))') && boards().map(b => b.includes('rrows') ? 'R' : 'C').join('') === 'CRCR' && cnt(body().innerHTML, /data-lbadd=/g) === 0);
  say('...with a cell of its own in the Customize list: the leaderboard of every board is chosen there', cnt(body().innerHTML, /data-lbcell="\d"/g) === 4 && body().innerHTML.includes('aria-label="Leaderboard in column 3, row 1"'));
  // places from .. to, per board
  const names = h => ['Alex', 'Sam'].filter(n => h.includes(n)).join();
  await clk({ lbsel: '0' }); await chg({ lb: 'from' }, '2', 'number'); await wait(20);
  say('board 1 with From place 2 shows the second place only; the other boards still show everybody', run('state.settings.liveGrid.boards[0].opt.from') === '2' && names(boards()[0]) !== '' && names(boards()[0]).split(',').length === 1 && names(boards()[2]).split(',').length === 2 && names(boards()[1]).split(',').length === 2);
  const second = names(boards()[0]);
  await chg({ lb: 'from' }, '', 'number'); await chg({ lb: 'to' }, '1', 'number'); await wait(20);
  say('...and with To place 1 the first place only', names(boards()[0]).split(',').length === 1 && names(boards()[0]) !== second);
  await chg({ lb: 'to' }, '', 'number'); await wait(20);
  say('...both empty: everybody again', names(boards()[0]).split(',').length === 2);
  { // 1.19.0: a board in the order of a value
    const seq = h => ['Alex', 'Sam'].map(n => [n, h.indexOf(n)]).filter(x => x[1] >= 0).sort((a, b) => a[1] - b[1]).map(x => x[0]).join();
    const raceOrder = seq(boards()[2]); // (a board that is not changed)
    say('1.19.0: every board has "Order by" with the race position chosen, and no "Best or worst on top" until a value is chosen', body().innerHTML.includes('id="lb-orderBy"') && body().innerHTML.includes('Race position (as the race runs)') && body().innerHTML.includes('Best lap') && body().innerHTML.includes('Championship points')
      && !body().innerHTML.includes('id="lb-orderDir"') && raceOrder.split(',').length === 2);
    await chg({ lb: 'orderBy' }, 'name'); await wait(20);
    say('...ordering board 1 by the driver name: saved in the settings of that board, the list opens "Best or worst on top", Alex first', run('state.settings.liveGrid.boards[0].opt.orderBy') === 'name' && body().innerHTML.includes('id="lb-orderDir"') && body().innerHTML.includes('value="name" selected') && body().innerHTML.includes('<details class="lv-opts" open>') && seq(boards()[0]) === 'Alex,Sam');
    await chg({ lb: 'orderDir' }, 'worst'); await wait(20);
    say('...Worst first turns it round (Sam first), and the other boards still follow the race', run('state.settings.liveGrid.boards[0].opt.orderDir') === 'worst' && seq(boards()[0]) === 'Sam,Alex' && seq(boards()[2]) === raceOrder);
    await chg({ lb: 'from' }, '2', 'number'); await wait(20);
    say('...and From place counts in that order: place 2 of Sam, Alex is Alex', seq(boards()[0]) === 'Alex');
    await chg({ lb: 'from' }, '', 'number'); await chg({ lb: 'orderBy' }, 'position'); await wait(20);
    say('...back to the race position: the board follows the race again and "Best or worst on top" is gone', seq(boards()[0]) === raceOrder && !body().innerHTML.includes('id="lb-orderDir"') && run('state.settings.liveGrid.boards[0].opt.orderBy') === 'position');
  }
  await clk({ lbsel: '1' }); await wait(20);
  say('the settings of another board are shown on its own button (a row design has no column choices)', body().innerHTML.includes('Board 2 (column 2, row 1)') && !body().innerHTML.includes('data-lb="colLast"') && body().innerHTML.includes('id="lb-from"') && body().innerHTML.includes('id="lb-to"'));
  await clk({ lbsel: '2' }); await wait(20);
  say('...and a classic board has them', body().innerHTML.includes('Board 3 (column 3, row 1)') && body().innerHTML.includes('data-lb="colLast"') && body().innerHTML.includes('id="lb-w"') && body().innerHTML.includes('id="lb-h"'));
  body().onchange({ target: { dataset: { lb: 'colLast' }, checked: true, type: 'checkbox' } }); await wait(20);
  say('...a column choice is for that board only', run('state.settings.liveGrid.boards[2].opt.colLast') === true && !run('state.settings.liveGrid.boards[0].opt.colLast') && boards()[2].includes('lb-last') && !boards()[0].includes('lb-last'));
  // boards that cover more cells
  say('a board that has another board next to it cannot be wider (only 1 is offered)', !/<select id="lb-w"[^>]*><option value="1" selected>1<\/option><option value="2"/.test(body().innerHTML));
  await chg({ lbspan: 'w' }, '2'); await wait(20);
  say('...and asking for it anyway changes nothing', boards().length === 4 && run('state.settings.liveGrid.boards[2].w') === 1);
  await chg({ lbcell: '3' }, ''); await wait(20);
  say('a leaderboard of "(empty)" takes the board out of its cell', boards().length === 3 && cnt(body().innerHTML, /data-lbadd=/g) === 1 && run('state.settings.liveGrid.boards.length') === 3);
  await clk({ lbsel: '2' }); await wait(20);
  say('...now that the cell next to it is free, the board can be wider', /<select id="lb-w"[^>]*><option value="1" selected>1<\/option><option value="2">2<\/option><\/select>/.test(body().innerHTML));
  await chg({ lbspan: 'w' }, '2'); await wait(20);
  say('a board over two columns: drawn once, over both', boards().length === 3 && boards()[2].includes('grid-column:3 / span 2') && cnt(body().innerHTML, /data-lbadd=/g) === 0);
  say('...and in the list of cells it is one cell, as wide as the board', body().innerHTML.includes('grid-column:3 / span 2;grid-row:1 / span 1"><select'));
  await clk({ lbgrid: '4,2' }); await wait(20);
  await chg({ lbspan: 'h' }, '2'); await wait(20);
  say('a taller board in a grid of two rows covers both', run('state.settings.liveGrid.boards[2].h') === 2 && boards()[2].includes('grid-row:1 / span 2') && cnt(body().innerHTML, /data-lbadd=/g) === 2);
  await clk({ lbgrid: '2,1' }); await wait(20);
  say('a smaller grid drops the boards outside it and cuts back what sticks out', boards().length === 2 && run('state.settings.liveGrid.cols') === 2 && run('state.settings.liveGrid.rows') === 1 && boards().every(b => b.includes('span 1;grid-row:1 / span 1')));
  // the old two boards are read as a grid
  run("state.settings.liveGrid = undefined; state.settings.liveBoards = { count: 2, side: true }; state.settings.liveBoard = {}; state.settings.liveBoard2 = { design: 'RD1' }"); run('LiveView.go')('board');
  say('the old settings (two boards side by side) are a grid of 2 columns until a grid is saved', body().innerHTML.includes('2 columns × 1 row') && boards().length === 2 && boards()[0].includes('<table class="lb">') && boards()[1].includes('rrows') && !body().innerHTML.includes('<details class="lv-opts" open>'));
  run("state.settings.liveBoards = { count: 2 }"); run('LiveView.go')('board');
  say('...and two boards one under the other are 1 column and 2 rows', body().innerHTML.includes('1 column × 2 rows') && boards()[1].includes('grid-row:2 / span 1'));
  // a row design that is gone
  run("state.settings.liveBoards = {}; state.settings.liveBoard = { design: 'GONE' }"); run('LiveView.go')('board');
  say('a board with a row design that does not exist any more is the classic table, and says so in its list', boards()[0].includes('<table class="lb">') && /<option value="~classic" selected>/.test(body().innerHTML));
  // no board at all
  run("state.settings.liveBoard = {}; state.settings.liveGrid = { cols: 2, rows: 1, boards: [{ c: 1, r: 1, w: 1, h: 1, opt: {} }] }"); run('LiveView.go')('board');
  await chg({ lbcell: '0' }, ''); await wait(20);
  say('with no board in the grid the page says so, and the list says to pick one', E('lv-board').innerHTML.includes('No leaderboard in the grid yet') && body().innerHTML.includes('Pick a leaderboard for a cell') && cnt(body().innerHTML, /data-lbadd=/g) === 2 && boards().length === 0);
  await chg({ lbadd: '1,1' }, '~classic'); await wait(20);
  say('...and a leaderboard for a cell brings a board back', boards().length === 1 && boards()[0].includes('<table class="lb">'));
  run("state.settings.liveGrid = undefined; state.settings.liveBoards = {}; state.settings.liveBoard2 = undefined; state.settings.liveBoard = {}"); run('LiveView.go')('board');
  say('...and back to the classic table', E('lv-board').innerHTML.includes('<table class="lb">') && body().innerHTML.includes('data-lb="colLast"'));
  { // the places in the widget itself (also for a viewer on a phone)
    const html = o => run(`(() => { const V = LiveShare.viewer(); V.feedStatic(__sent.stat); V.feedDynamic(__sent.dyn, performance.now()); return Timing.content({ type: 'leaderboard', opt: ${JSON.stringify(o)} }, V.shared(performance.now())).html; })()`);
    const who = h => ['Alex', 'Sam'].filter(n => h.includes(n));
    say('the Leaderboard widget with From place and To place shows those places: the classic table', who(html({})).length === 2 && who(html({ from: 2 })).length === 1 && who(html({ to: 1 })).length === 1 && who(html({ from: 2 }))[0] !== who(html({ to: 1 }))[0] && who(html({ from: 3 })).length === 0);
    say('...and a row design', who(html({ design: 'RD1', from: 2 })).length === 1 && who(html({ design: 'RD1', to: 1 })).length === 1 && who(html({ design: 'RD1', from: 2 }))[0] !== who(html({ design: 'RD1', to: 1 }))[0] && who(html({ design: 'RD1' })).length === 2);
  }
  run('LiveView.go')('driver');
  say('Driver stats page shows the picked driver with laps and best lap', E('lv-dstats').innerHTML.includes('Alex') && E('lv-dstats').innerHTML.includes('Best lap') && E('lv-dstats').innerHTML.includes('Laps'));
  // ---------- 1.36.0: the Driver stats grid ----------
  { const dh = () => E('lv-dstats').innerHTML, panel = () => E('lv-dgpanel').innerHTML, cellsIn = h => [...h.matchAll(/data-cell="(\w+)"/g)].map(m => m[1]), nQuiet = h => (h.match(/lv-dg quiet/g) || []).length;
    const dclk = dataset => body().onclick({ target: { closest: () => ({ dataset, disabled: false }) } }), dchg = (dataset, props = {}) => body().onchange({ target: { dataset, value: '', ...props } });
    const mine = () => run('state.settings.driverGrid'), saved = () => JSON.parse(JSON.stringify(run('state.settings.driverGrid') ?? null)), settle = () => wait(40);
    const getWas = api.getSettings; api.getSettings = async () => JSON.parse(JSON.stringify(run('state.settings'))); // (the stand-in keeps nothing: this one hands back what the page saved, as the app does)
    const fresh = async () => { run('state.settings.driverGrid = undefined; state.settings.driverLane = undefined; state.settings.driverRemember = undefined'); run('LiveView.unmount')(); const h = document.createElement('div'); await run('LiveView.mount')(h, {}); run('LiveView.go')('driver'); await settle(); };
    await fresh();
    say('Driver stats: with no grid saved the default is drawn: the position, last lap, best lap, gap, laps to go, flag and the lap list; the cells a plain race has nothing for are not there',
      cellsIn(dh()).join() === 'position,last,bestlap,gap,lapstogo,flag,laplist' && !/data-cell="(swapsignal|swaptimer|fuel|damage)"/.test(dh()));
    say('...the rows nothing is left in are not drawn: the position starts in the first row and the lap list in the fifth; the tyres (the race has no weather) are blank, the flag stays where it was',
      dh().includes('data-cell="position" style="grid-column:1 / span 2;grid-row:1 / span 2') && dh().includes('data-cell="laplist" style="grid-column:1 / span 4;grid-row:5 / span 2') && nQuiet(dh()) === 1 && dh().includes('data-cell="flag" style="grid-column:3 / span 2;grid-row:4 / span 1'));
    say('...every cell has its label above the number, the lap list its list', dh().includes('<span class="muted">Position</span><strong>') && dh().includes('<span class="muted">Last lap</span>') && dh().includes('<span class="muted">Laps to go</span><strong>') && /<span class="muted">Lap list<\/span><div class="lv-laps">/.test(dh()) && dh().includes('Alex'));
    say('...the last lap and the best lap are the times of the car; laps to go is just the number', (() => { const m = /data-cell="last"[^>]*><span[^>]*>Last lap<\/span><strong>([^<]*)</.exec(dh()), b = /data-cell="bestlap"[^>]*><span[^>]*>Best lap<\/span><strong>([^<]*)</.exec(dh()), l = /data-cell="lapstogo"[^>]*><span[^>]*>Laps to go<\/span><strong>([^<]*)</.exec(dh());
      return m && b && l && /^\d+\.\d{3}$/.test(m[1]) && /^\d+\.\d{3}$/.test(b[1]) && /^\d+$/.test(l[1]); })());
    say('...Customize is a list of its own above the stats, closed to begin with; it says this layout is the default for all devices, and has the grid of 4 columns by 8 rows, a button for each of the 32 squares and for each of the 12 cells',
      body().innerHTML.includes('<details class="lv-opts" id="lv-dgtool"><summary>Customize</summary>') && panel().includes('This layout is the default for all devices') && panel().includes('4 columns × 8 rows') && cnt(panel(), /data-dggrid=/g) === 32 && cnt(panel(), /data-dgsel=/g) === 12);
    say('...the cell that is picked first (the swap signal) says when it shows, and the cells are big, small or neither by the room they have', panel().includes('<p class="muted">Shows in a race with driver swaps (Endurance Race).</p>') && dh().includes('lv-dg lv-stat big" data-cell="position"') && dh().includes('lv-dg lv-stat" data-cell="last"') && dh().includes('lv-dg lv-stat big list" data-cell="laplist"'));
    say('...the button to go back to the standard layout is there and cannot be used while nothing of your own is saved; lanes are remembered', panel().includes('data-dgreset="1" disabled>Use the standard layout again') && /data-dgremember="1" checked/.test(panel()));

    // the lane
    await dclk({ lane: '1' }); await settle();
    say('picking a lane shows that driver and is remembered by the device', dh().includes('Sam') && !dh().includes('>Alex<') && run('state.settings.driverLane') === 1 && body().innerHTML.includes('data-lane="1" aria-pressed="true"'));
    run('LiveView.unmount')(); { const h = document.createElement('div'); await run('LiveView.mount')(h, {}); run('LiveView.go')('driver'); await settle(); }
    say('...and when the page is opened again the device is on that lane (not on the first one)', dh().includes('Sam') && body().innerHTML.includes('data-lane="1" aria-pressed="true"') && body().innerHTML.includes('data-lane="0" aria-pressed="false"'));
    await dchg({ dgremember: '1' }, { checked: false }); await settle();
    say('turning "Remember my lane" off forgets it', run('state.settings.driverRemember') === false && run('state.settings.driverLane') === null && !/data-dgremember="1" checked/.test(panel()));
    await dclk({ lane: '0' }); await settle(); await dclk({ lane: '1' }); await settle();
    say('...and the lanes picked after that are not remembered', run('state.settings.driverLane') === null);
    run('LiveView.unmount')(); { const h = document.createElement('div'); await run('LiveView.mount')(h, {}); run('LiveView.go')('driver'); await settle(); }
    say('...so the page opens on the first lane', body().innerHTML.includes('data-lane="0" aria-pressed="true"') && dh().includes('Alex'));
    await dchg({ dgremember: '1' }, { checked: true }); await settle();
    say('...and turning it on again remembers the lane that is on now', run('state.settings.driverRemember') === true && run('state.settings.driverLane') === 0 && /data-dgremember="1" checked/.test(panel()));

    // Customize: the grid
    await fresh();
    await dclk({ dggrid: '2,3' }); await settle();
    say('a square of the picker makes a smaller grid: the cells that no longer fit are gone, the others are cut back, and it is saved as the grid of this device (a computer: of all)',
      saved().cols === 2 && saved().rows === 3 && saved().boards.map(b => `${b.c}.${b.r}:${b.w}x${b.h}=${b.opt.cell}`).join() === '1.1:2x1=swapsignal,1.2:2x2=position' && panel().includes('2 columns × 3 rows') && cellsIn(dh()).join() === 'position');
    say('...the page draws it (the swap signal row is blank, so it is not drawn), the list stays on the page and the reset button can be used now', dh().includes('data-cell="position" style="grid-column:1 / span 2;grid-row:1 / span 2') && body().innerHTML.includes('id="lv-dgtool"') && /data-dgreset="1">Use the standard layout again/.test(panel()));
    await dclk({ dgsel: '1,2' });
    say('a cell of the map is picked: its settings are below, with its number, how many columns and rows it covers and its label', panel().includes('<legend>Position (column 1, row 2)</legend>') && panel().includes('<option value="position" selected>Position</option>') && /data-dgspan="w">.*<option value="2" selected>2<\/option>/.test(panel()) && /data-dglabel="1" checked/.test(panel()) && panel().includes('aria-pressed="true"') );
    await dchg({ dgshow: '1' }, { value: 'avglap' }); await settle();
    say('another number for the cell', saved().boards[1].opt.cell === 'avglap' && cellsIn(dh()).join() === 'avglap' && dh().includes('Average lap') && panel().includes('<legend>Average lap (column 1, row 2)</legend>'));
    await dchg({ dgspan: 'w' }, { value: '1' }); await settle();
    say('...fewer columns for it (and the same rows)', saved().boards[1].w === 1 && saved().boards[1].h === 2 && dh().includes('data-cell="avglap" style="grid-column:1 / span 1;grid-row:1 / span 2'));
    await dchg({ dgspan: 'h' }, { value: '1' }); await settle();
    say('...fewer rows (and the same columns), and a cell of one cell is small', saved().boards[1].w === 1 && saved().boards[1].h === 1 && dh().includes('lv-dg lv-stat small" data-cell="avglap" style="grid-column:1 / span 1;grid-row:1 / span 1'));
    await dchg({ dglabel: '1' }, { checked: false }); await settle();
    say('...without its label', saved().boards[1].opt.label === false && !dh().includes('Average lap') && !/data-dglabel="1" checked/.test(panel()));
    await dclk({ dgsel: '2,2' });
    say('an empty cell asks what it shows, and has no more settings', panel().includes('<legend>Empty cell (column 2, row 2)</legend>') && panel().includes('Pick what this cell shows') && !panel().includes('data-dgspan') && !panel().includes('data-dglabel'));
    await dchg({ dgshow: '1' }, { value: 'gap' }); await settle();
    say('...and a number for it makes a cell there', saved().boards.length === 3 && saved().boards[2].c === 2 && saved().boards[2].r === 2 && saved().boards[2].opt.cell === 'gap' && saved().boards[2].opt.label === true && cellsIn(dh()).join() === 'avglap,gap');
    await dchg({ dgshow: '1' }, { value: '' }); await settle();
    say('...(empty) takes the cell away again', saved().boards.length === 2 && cellsIn(dh()).join() === 'avglap' && panel().includes('<legend>Empty cell (column 2, row 2)</legend>'));
    const was = JSON.stringify(saved()); await dchg({ dgshow: '1' }, { value: '' }); await settle();
    say('...and (empty) for a cell that is empty changes nothing', JSON.stringify(saved()) === was);
    await dchg({ dgshow: '1' }, { value: 'swapsignal' }); await dclk({ dgsel: '1,2' }); await settle();
    say('the list of numbers has every cell, in groups', ['Race', 'Swaps', 'Car', 'Track', 'Other'].every(g => panel().includes(`<optgroup label="${g}">`)) && cnt(panel(), /<option value="[a-z]+"/g) >= 26 && panel().includes('<option value="swapsignal">Swap signal</option>') && panel().includes('<option value="lights">Start lights</option>'));
    await dchg({ dgshow: '1' }, { value: 'nope' }); await settle();
    say('a number that is not one is no change', saved().boards[1].opt.cell === 'avglap');
    await dclk({ dgsel: '1,2' }); run('LiveView.go')('rules'); run('LiveView.go')('driver'); await settle();
    say('leaving the page and coming back closes Customize and picks the first cell again', body().innerHTML.includes('id="lv-dgtool"><summary>') && panel().includes('<legend>Swap signal (column 1, row 1)</legend>'));
    await dclk({ dgreset: '1' }); await settle();
    say('the reset button goes back to the standard layout: the saved grid is dropped, and the page and the list show the default again', run('state.settings.driverGrid') === null && cellsIn(dh()).join() === 'position,last,bestlap,gap,lapstogo,flag,laplist' && panel().includes('4 columns × 8 rows') && panel().includes('data-dgreset="1" disabled'));

    // a grid that is not much
    run('state.settings.driverGrid = 5'); await fresh_(); 
    say('a saved grid that is not a grid is not used: the default is', cellsIn(dh()).join() === 'position,last,bestlap,gap,lapstogo,flag,laplist');
    run('state.settings.driverGrid = { cols: 2, rows: 2, boards: [] }'); await fresh_();
    say('a grid with no cells says so, and says how to put some in', dh().includes('Nothing in the grid yet. Open Customize') && cellsIn(dh()).length === 0 && cnt(panel(), /data-dgsel=/g) === 4 && panel().includes('aria-label="Empty cell, column 1, row 1"'));
    run('state.settings.driverGrid = { cols: 2, rows: 1, boards: [{ c: 1, r: 1, w: 2, h: 1, opt: { cell: "fuel", label: true } }] }'); await fresh_();
    say('a grid that has nothing to show in this race (fuel is off) says so', dh().includes('Nothing in the grid has anything to show in this race.') && nQuiet(dh()) === 0);
    run('state.settings.driverGrid = { cols: 2, rows: 1, boards: [{ c: 1, r: 1, w: 1, h: 1, opt: { cell: "fuel", label: true } }, { c: 2, r: 1, w: 1, h: 1, opt: { cell: "position", label: true } }, { c: 1, r: 2, w: 1, h: 1, opt: { cell: "nope" } }] }'); await fresh_();
    say('a cell that does not exist is left out, a cell the race has nothing for is blank in a row that is drawn', cellsIn(dh()).join() === 'position' && nQuiet(dh()) === 1);

    run('state.settings.driverGrid = { cols: 4, rows: 3, boards: [' + [['position', 1, 1, 1, 3], ...['fuel', 'penalty', 'champpoints', 'damage', 'tyre', 'swapsignal', 'swaptimer', 'nextdriver', 'distance'].map((k, i) => [k, 2 + i % 3, 1 + Math.floor(i / 3), 1, 1])].map(([k, c, r, w, h]) => `{ c: ${c}, r: ${r}, w: ${w}, h: ${h}, opt: { cell: '${k}', label: true } }`).join(',') + '] }'); await fresh_();
    say('in a plain race (no fuel, penalties, championship, damage, weather, swaps or lane lengths) nine cells have nothing to show and are blank, the position is the only one that shows', cellsIn(dh()).join() === 'position' && nQuiet(dh()) === 9);

    // another device
    api.web = true; let ownNow = {}; api.ownSettings = () => ownNow;
    run('state.settings.driverGrid = { cols: 1, rows: 1, boards: [{ c: 1, r: 1, w: 1, h: 1, opt: { cell: "bestlap", label: true } }] }'); run('LiveView.go')('rules'); run('LiveView.go')('driver'); await settle();
    say('a phone that gets a grid from the computer draws it, and says it is the computer\'s (it is not the phone\'s own, so there is nothing to reset yet)', cellsIn(dh()).join() === 'bestlap' && panel().includes("You are using the computer's layout.") && /data-dgreset="1" disabled>Use the computer's layout again/.test(panel()));
    run('state.settings.driverGrid = undefined'); run('LiveView.go')('rules'); run('LiveView.go')('driver'); await settle();
    say('a phone that has no layout of its own says it uses the computer\'s, with a reset button that is not needed yet', panel().includes("You are using the computer's layout.") && panel().includes('data-dgreset="1" disabled>Use the computer&#39;s layout again') === false && /data-dgreset="1" disabled>Use the computer's layout again/.test(panel()));
    await dclk({ dggrid: '3,2' }); ownNow = { driverGrid: mine() }; await settle(); run('LiveView.go')('rules'); run('LiveView.go')('driver'); await settle();
    say('...a layout it keeps itself says "This device only"; the reset button works', panel().includes('This device only.') && !panel().includes('default for all devices') && /data-dgreset="1">Use the computer's layout again/.test(panel()) && saved().cols === 3);
    ownNow = {}; await dclk({ dgreset: '1' }); await settle();
    say('...and "Use the computer\'s layout again" drops it (the phone asks for null, which webapi.js takes out of its own settings)', run('state.settings.driverGrid') === null && cellsIn(dh()).join() === 'position,last,bestlap,gap,lapstogo,flag,laplist');
    api.web = false; delete api.ownSettings;
    api.getSettings = getWas; run('state.settings.driverGrid = undefined; state.settings.driverLane = undefined; state.settings.driverRemember = undefined');
    run('LiveView.unmount')(); { const h = document.createElement('div'); await run('LiveView.mount')(h, {}); } run('LiveView.go')('driver');
    async function fresh_() { run('LiveView.go')('rules'); run('LiveView.go')('driver'); await settle(); }
  }
  run('LiveView.go')('rules');
  say('Racing rules page shows the rules', body().innerHTML.includes('No bumping'));
  // on another device (browser): the Race Director asks for the password first
  let authed = false; api.web = true; api.directorAuthed = () => authed; api.directorInfo = async () => ({ passwordSet: true });
  api.directorLogin = async pw => { if (pw !== 'pw') { const e = new Error('wrong'); e.code = 'wrong'; throw e; } authed = true; };
  run('LiveView.go')('director'); await wait(30);
  say('in a browser the Race Director page asks for the password', body().innerHTML.includes('id="lv-login"') && body().innerHTML.includes('type="password"') && !body().innerHTML.includes('data-cmd="start"'));
  document.getElementById('lv-pass').value = 'nope'; await E('lv-login').onsubmit({ preventDefault() {} }); await wait(20);
  say('a wrong password is explained', E('lv-loginmsg').textContent === 'Wrong password.' && !authed);
  document.getElementById('lv-pass').value = 'pw'; await E('lv-login').onsubmit({ preventDefault() {} }); await wait(20);
  say('the right password opens the Race Director', authed && body().innerHTML.includes('data-cmd="start"'));
  authed = false; api.directorInfo = async () => ({ passwordSet: false }); run('LiveView.go')('director'); await wait(30);
  say('with no password set the page says it is for the main computer only', body().innerHTML.includes('main computer') && !body().innerHTML.includes('type="password"'));
  delete api.web; run('LiveView.go')('rules');
  cbs.dyn.forEach(f => f(plain(sent.dyn))); say('a new message from the race repaints without errors', true);
  key('s'); await wait(100);
  { // the pages still open when the race data cannot be fetched (they used to stay blank and fail)
    const realGet = api.liveGet; api.liveGet = async () => { throw new Error('host not reachable'); };
    let err = null; try { await run('LiveView.mount')(document.createElement('div'), {}); } catch (x) { err = x; }
    say('the Live Race pages open even when the race data cannot be fetched', !err && body().innerHTML.includes('lv-tiles')); api.liveGet = realGet;
  }
  { // the seven tiles draw the pictures of icons.js, the same ones the tabs use, at the size they always had
    const ids = ['timing', 'board', 'driver', 'database', 'rules', 'director', 'tokens'];
    await run('LiveView.mount')(host, {}); const tiles = body().innerHTML;
    const badge = '<span class="lv-badge">Control</span>', control = id => id === 'director' || id === 'tokens';
    say('the Live Race page has seven tiles, each with its own line picture (40 pixels, class lv-ico) in front of the title', (tiles.match(/<button class="lv-tile( special)?"/g) || []).length === 7 && ids.every(id => tiles.includes(`<button class="lv-tile${control(id) ? ' special' : ''}" data-go="${id}">${control(id) ? badge : ''}<svg class="lv-ico" viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${run(`Icons.PATHS.${id}`)}</svg><strong>`)));
    say('the Race Director and Tokens tiles are the special ones: a Control badge and the class special, and no other tile has either', (tiles.match(/lv-tile special/g) || []).length === 2 && (tiles.match(/class="lv-badge"/g) || []).length === 2 && ['director', 'tokens'].every(id => tiles.includes(`<button class="lv-tile special" data-go="${id}">${badge}`)) && ['timing', 'board', 'driver', 'database', 'rules'].every(id => tiles.includes(`<button class="lv-tile" data-go="${id}">`)));
    { const css = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'styles.css'), 'utf8');
      say('...the style sheet tints the special tile and header with the theme accent (so it follows every theme), and draws the badge in the accent colours', /\.lv-tile\.special\{[^}]*border-left:4px solid var\(--accent\)[^}]*color-mix\(in srgb,var\(--accent\)/.test(css) && /\.lv-head\.special\{[^}]*border-left:4px solid var\(--accent\)[^}]*color-mix/.test(css) && /\.lv-badge\{[^}]*background:var\(--accent\);color:var\(--on-accent\)/.test(css)); }
    for (const id of ['director', 'tokens']) { run('LiveView.go')(id); say(`...the ${id} page has a tinted header with the Control badge and a way back`, host.innerHTML.includes('class="lv-head special"') && host.innerHTML.includes(badge) && host.innerHTML.includes('id="lv-back"')); }
    for (const id of ['timing', 'board', 'driver', 'rules']) { run('LiveView.go')(id); say(`...and the ${id} page keeps the plain header`, host.innerHTML.includes('class="lv-head"') && !host.innerHTML.includes('lv-badge')); }
    run('LiveView.go')('tiles');
    say('...and the Database and Racing rules tiles show the same pictures as the Database and Racing Rules tabs', ['database', 'rules'].every(id => tiles.includes(run(`Icons.PATHS.${id}`)) && run(`TAB_ICONS.${id}`) === id));
  }
  sent.stat = null; sent.dyn = null; await run('LiveView.mount')(host, {}); run('LiveView.go')('timing');
  say('with no race running the pages say so', body().innerHTML.includes('No race is running'));
  run('LiveView.unmount')();

  // ---------- batch I: penalty points and the Race Director ----------
  store.penaltysystems = [{ id: 'p1', name: 'Std', timeRule: 'every', everyPoints: 5, everySeconds: 5, dqPoints: 12 }];
  els.sim.checked = false;
  await openRace({ name: 'Pen', sessionType: 'race', laps: 9, endRule: 'all', layout: '', penaltySystem: 'p1' }, store.tracks[0], rows(1, 2));
  say('a Penalties folder on the race screen when the setup has a penalty system (the table with the buttons, in place of the old Penalty buttons in the bar)', !!run('live.penPanel') && run('live.penBtns') === undefined && run('live.engine().penalty.on') === true && E('penpanel').innerHTML.includes('data-cmd="penalty"'));
  key(' '); await until(() => phase() === 'running'); await wait(60);
  const host2 = document.createElement('div'); await run('LiveView.mount')(host2, {}); run('LiveView.go')('director');
  const click = (cmd, lane, n) => E('lv-body').onclick({ target: { closest: () => ({ dataset: { cmd, lane, n }, disabled: false }) } });
  click('penalty', '1', '1'); click('penalty', '1', '1');
  say('Race Director: a penalty point button reaches the race in the main window', run('live.engine().cars[1].points') === 2 && cmds.length === 2);
  click('penalty', '1', '-1'); say('and a point can be taken back', run('live.engine().cars[1].points') === 1);
  for (let k = 0; k < 6; k++) click('penalty', '1', '1');
  await wait(200);
  say('5 points = 5 seconds on the time penalty widget', run(`(() => { const V = LiveShare.viewer(); V.feedStatic(__sent.stat); V.feedDynamic(__sent.dyn, performance.now()); return Timing.content({ ...Widgets.newWidget('penalty', 1, 0, 0), opt: { show: 'both' } }, V.shared(performance.now())).html; })()`) === '7 (+5 s)');
  say('the Director page lists the points and the log', E('lv-dir') !== undefined && E('lv-body').innerHTML.includes('Penalty log'));
  click('yellow'); say('Race Director: flags work', run('live.engine().flag') === 'yellow'); click('yellow');
  for (let k = 0; k < 5; k++) click('penalty', '0', '1');
  click('penalty', '1', '1'); click('penalty', '1', '1'); click('penalty', '1', '1'); click('penalty', '1', '1'); click('penalty', '1', '1');
  say('reaching the disqualify limit (12 points) disqualifies', run('live.engine().cars[1].dq') === true && run('live.engine().standings().find(x => x.index === 1).gap') === 'DQ');
  await wait(60); key('1'); await wait(60); key('1');
  click('pause'); say('Race Director: pause', phase() === 'paused'); click('pause'); say('and resume', phase() === 'running');
  saved.length = 0; click('stop'); await wait(200);
  say('Race Director: stop ends the race and the penalties are saved in the results', phase() === 'finished' && saved.length === 1 && saved[0][0].standings.some(x => x.penaltyPoints === 12 && x.dq === true && x.penalty === 10000 && !x.retired) && saved[0][0].standings.some(x => x.penaltyPoints === 5 && x.penalty === 5000));
  run('LiveView.unmount')();

  // ---------- calls from a lane: the yellow flag goes up and the Race Director decides ----------
  store.penaltysystems = [{ id: 'p1', name: 'Std', timeRule: 'every', everyPoints: 5, everySeconds: 5, dqPoints: 12 }];
  els.sim.checked = false; saved.length = 0;
  await openRace({ name: 'Calls', sessionType: 'race', laps: 9, endRule: 'all', layout: '', penaltySystem: 'p1' }, store.tracks[0], rows(1, 2));
  const ctrlKey = n => run('live').key({ key: String(n), code: 'Digit' + n, ctrlKey: true, target: { matches: () => false }, preventDefault() {} });
  const eng = () => run('live.engine()'), openCalls = () => eng().calls.filter(c => c.open).map(c => c.car).join();
  say('the race screen has a Call button for every lane', run('live.callBtns.length') === 2 && run('live.callBtns.every(x => x.b.textContent.startsWith("Call "))'));
  ctrlKey(1); run('live.callBtns[0].b.onclick')();
  say('before the start a call does nothing: no flag, no call', eng().flag === '' && eng().calls.length === 0 && run('live.callBtns[0].b.disabled') === true && E('calls').hidden === true);
  key(' '); await until(() => phase() === 'running'); await wait(60);
  say('while the race runs the Call buttons work', run('live.callBtns[0].b.disabled') === false && run('live.callBtns[1].b.disabled') === false);
  ctrlKey(1);
  say('Ctrl + 1 is a call from lane 1: yellow flag, one call waiting', eng().flag === 'yellow' && openCalls() === '0' && phase() === 'running');
  say('a strip lists the call, with the lane, the driver and the Race Director\'s choices', E('calls').hidden === false && /Lane 1/.test(E('calls').innerHTML) && E('calls').innerHTML.includes('data-call="dismiss"') && E('calls').innerHTML.includes('data-call="penalty"'));
  ctrlKey(1); say('pressing again while the call waits does not make a second call', eng().calls.length === 1);
  ctrlKey(9); ctrlKey(3); say('Ctrl + a number of a lane that does not exist is nothing (and not a lap)', eng().calls.length === 1 && run('live.engine().cars.every(c => c.laps.length === 0)'));
  run('live.callBtns[1].b.onclick')();
  say('the Call 2 button is a call from lane 2', openCalls() === '0,1' && (E('calls').innerHTML.match(/data-call="dismiss"/g) || []).length === 2);
  const strip = (call, id) => E('calls').onclick({ target: { closest: () => ({ dataset: { call, id: String(id) } }) } });
  key('y'); say('the Race Director can lift the yellow flag with the waiting calls still there', eng().flag === '' && openCalls() === '0,1');
  strip('penalty', 1);
  say('Penalty point in the strip gives the point to the lane that called and closes that call', run('live.engine().cars[0].points') === 1 && openCalls() === '1' && (E('calls').innerHTML.match(/data-call="dismiss"/g) || []).length === 1);
  say('...the yellow flag is not touched by that', eng().flag === '');
  strip('dismiss', 2);
  say('Dismiss closes the call without points, and the strip goes away', openCalls() === '' && eng().cars[1].points === 0 && E('calls').hidden === true && E('calls').innerHTML === '');
  strip('penalty', 2); strip('dismiss', 77); say('a call that is already settled, or unknown, cannot be settled again', eng().cars[1].points === 0 && eng().cars[0].points === 1);

  // from the Race Director page (second screen, or a tablet)
  // The race shares its state at most about ten times a second (a last message follows a moment later), and a page that opens shows what was shared last.
  // So wait until the shared state has caught up with the calls settled above, then open the page: a fixed pause is not enough when the computer is busy.
  const sharedCalls = n => run('__sent.dyn && __sent.dyn.calls.filter(c => c.open).length') === n;
  await until(() => sharedCalls(0), 5000);
  E('dir-calls').innerHTML = ''; delete E('dir-calls').dataset.key; // (the stand-in elements keep their content, and the list's key, from earlier pages; a real page starts empty)
  const host4 = document.createElement('div'); await run('LiveView.mount')(host4, {}); run('LiveView.go')('director'); await until(() => E('lv-body').innerHTML.includes('id="dir-calls"') && E('dir-calls').innerHTML !== '', 5000);
  const clickD = dataset => E('lv-body').onclick({ target: { closest: () => ({ dataset, disabled: false }) } });
  const repaint = async n => { await until(() => sharedCalls(n), 3000); cbs.dyn.forEach(f => f(plain(sent.dyn))); }; // the race shares it, and the pages get the message
  say('the Director page has a Calls panel with a Call button per lane', E('lv-body').innerHTML.includes('id="dir-calls"') && E('lv-body').innerHTML.includes('Call lane 1') && E('lv-body').innerHTML.includes('Call lane 2') && E('dir-calls').innerHTML.includes('No calls waiting'));
  const n0 = cmds.length; clickD({ cmd: 'call', lane: '1' }); await repaint(1);
  say('a Call button on the Director page reaches the race: yellow flag and a call for lane 2', cmds.length === n0 + 1 && cmds[n0].type === 'call' && cmds[n0].lane === 1 && eng().flag === 'yellow' && openCalls() === '1');
  say('...and the call shows up on the Director page, with Dismiss and Penalty point +1', /Lane 2/.test(E('dir-calls').innerHTML) && E('dir-calls').innerHTML.includes('data-how="dismiss"') && E('dir-calls').innerHTML.includes('data-how="penalty"') && E('dir-calls').innerHTML.includes('data-id="3"'));
  const listNow = E('dir-calls').innerHTML; await wait(300); cbs.dyn.forEach(f => f(plain(sent.dyn)));
  say('the list is not rebuilt while the calls stay the same', E('dir-calls').innerHTML === listNow);
  clickD({ cmd: 'callresolve', id: '3', how: 'penalty' }); await repaint(0);
  say('Penalty point +1 on the Director page: the point goes to lane 2, the call is gone from the page', cmds[cmds.length - 1].type === 'callresolve' && cmds[cmds.length - 1].how === 'penalty' && eng().cars[1].points === 1 && openCalls() === '' && E('dir-calls').innerHTML.includes('No calls waiting'));
  ctrlKey(2); await repaint(1); clickD({ cmd: 'callresolve', id: '4', how: 'dismiss' }); await repaint(0);
  say('Dismiss on the Director page closes the call without points', openCalls() === '' && eng().cars[1].points === 1 && E('dir-calls').innerHTML.includes('No calls waiting'));
  // ---------- 1.12.0: the Adjust folder of the Director page: pick a lane, then use the pads (during the race) ----------
  {
    const page = E('lv-body').innerHTML, box = E('dir-adj').innerHTML;
    say('the Director page has an Adjust folder between the Calls and the Penalties', page.indexOf('<h3>Calls</h3>') > 0 && page.indexOf('<h3>Calls</h3>') < page.indexOf('data-dirf="adjust"') && page.indexOf('data-dirf="adjust"') < page.indexOf('data-dirf="penalties"') && page.includes('id="dir-adj"'));
    say('...it has a button for every lane, the five pads in the order penalty points, damage points, time, laps, championship points, and Undo', ['data-adj-lane="0"', 'data-adj-lane="1"'].every(x => box.includes(x)) && ['points', 'damage', 'time', 'laps', 'champ'].map(g => box.indexOf(`data-pad="${g}"`)).every((x, i, a) => x > 0 && (i === 0 || x > a[i - 1])) && box.includes('data-adj-undo') && box.includes('data-adj-layout="h"') && box.includes('pad-h'));
    const mkb = (dataset, extra = {}) => ({ dataset, disabled: false, ...extra });
    const laneB = [0, 1].map(l => mkb({ adjLane: String(l) }, { setAttribute(k, v) { this[k] = v; }, querySelector: () => ({ textContent: '' }) }));
    const padB = id => [mkb({ sign: '1' }), mkb({ sign: '-1' })].map(b => Object.assign(b, { id }));
    const pads = ['points', 'damage', 'time', 'laps', 'champ'].map(id => ({ dataset: { pad: id }, hidden: false, btns: padB(id), querySelectorAll() { return this.btns; } }));
    const undoB = mkb({}), layB = ['h', 'v'].map(v => mkb({ adjLayout: v }, { setAttribute(k, x) { this[k] = x; } }));
    E('dir-adj').querySelectorAll = sel => (sel === '[data-adj-lane]' ? laneB : sel === '.pad' ? pads : sel === '[data-adj-undo]' ? [undoB] : sel === '[data-adj-layout]' ? layB : []);
    const clickA = (sel, dataset, extra = {}) => E('lv-body').onclick({ target: { closest: s => (s === sel ? { dataset, disabled: false, ...extra } : null) } });
    const again = async cond => { await until(cond, 3000); cbs.dyn.forEach(f => f(plain(sent.dyn))); };
    const sentCar = i => run(`__sent.dyn.cars[${i}]`);
    cbs.dyn.forEach(f => f(plain(sent.dyn)));
    say('the Adjust folder has the normal colours of the theme, not the accent (plain)', page.includes('<details class="dbfolder dirfolder dir-plain" data-dirf="adjust"'));
    say('no lane picked yet: the page says so, every pad is switched off, and Undo too', E('adj-who').textContent.includes('Choose a lane') && pads.every(p => p.btns.every(b => b.disabled)) && undoB.disabled === true && E('adj-last').textContent === 'Nothing adjusted yet.');
    say('...the pads that this race can use are shown: penalty points (there is a penalty system), time and laps; no damage points (no damage system) and no championship points (this is no heat race)', pads.map(p => p.hidden).join() === 'false,true,false,false,true');
    const nm = eng().cars[1].driverName, c0 = cmds.length;
    clickA('[data-pad-do]', { padDo: 'time', v: '10', sign: '1' });
    say('a pad pressed before a lane is picked sends nothing', cmds.length === c0 && !eng().cars[1].adjMs);
    clickA('[data-adj-lane]', { adjLane: '1' });
    say('picking lane 2 shows "Lane 2 · driver", marks the button and switches the pads on', E('adj-who').textContent === `Lane 2 · ${nm}` && laneB[1]['aria-pressed'] === 'true' && laneB[0]['aria-pressed'] === 'false' && pads.filter(p => !p.hidden).every(p => p.btns.every(b => !b.disabled || (p.btns.indexOf(b) === 1 && p.id === 'points'))));
    clickA('[data-pad-do]', { padDo: 'time', v: '10', sign: '1' });
    say('+ on the 10 s pad reaches the race: 10 seconds on lane 2, during the race', cmds[cmds.length - 1].type === 'pad' && cmds[cmds.length - 1].group === 'time' && cmds[cmds.length - 1].lane === 1 && cmds[cmds.length - 1].amount === 10 && eng().cars[1].adjMs === 10000 && phase() === 'running');
    await again(() => sentCar(1).adjMs === 10000);
    say('...and the line under the pads says what was done, with Undo ready', E('adj-last').textContent === `Last: +10 s to ${nm}` && undoB.disabled === false);
    say('...the other lane was not touched', !eng().cars[0].adjMs);
    clickA('[data-pad-do]', { padDo: 'laps', v: '2', sign: '1' }); await again(() => sentCar(1).adjLaps === 2);
    say('+ on the 2 laps pad: two laps more for lane 2 (the standings count them)', eng().cars[1].adjLaps === 2 && eng().lapsOf(eng().cars[1]) === eng().cars[1].laps.length + 2 && E('adj-last').textContent === `Last: +2 laps to ${nm}`);
    clickA('[data-adj-undo]', {}); await again(() => sentCar(1).adjLaps === 0);
    say('Undo takes the last pad back with the opposite amount (laps 0 again), and the line says so', cmds[cmds.length - 1].type === 'pad' && cmds[cmds.length - 1].group === 'laps' && cmds[cmds.length - 1].amount === -2 && eng().cars[1].adjLaps === 0 && E('adj-last').textContent === `Undone: +2 laps to ${nm}`);
    clickA('[data-adj-undo]', {}); await again(() => sentCar(1).adjMs === 0);
    say('...and the one before it (the 10 seconds are gone again), then nothing is left to undo', eng().cars[1].adjMs === 0 && undoB.disabled === true && E('adj-last').textContent === `Undone: +10 s to ${nm}`);
    clickA('[data-adj-undo]', {}); say('Undo with nothing to undo sends nothing', cmds[cmds.length - 1].amount === -10);
    clickA('[data-pad-do]', { padDo: 'time', sign: '1', other: '1' }, { closest: () => ({ querySelector: () => ({ value: '2.5' }) }) }); await again(() => sentCar(1).adjMs === 2500);
    say('the field for another amount works the same: 2.5 s', eng().cars[1].adjMs === 2500 && E('adj-last').textContent === `Last: +2.5 s to ${nm}`);
    const c1 = cmds.length; clickA('[data-pad-do]', { padDo: 'time', sign: '1', other: '1' }, { closest: () => ({ querySelector: () => ({ value: '' }) }) }); clickA('[data-pad-do]', { padDo: 'laps', sign: '-1', other: '1' }, { closest: () => ({ querySelector: () => ({ value: '0' }) }) });
    say('...an empty field or a zero sends nothing', cmds.length === c1);
    const p0 = eng().cars[1].points;
    clickA('[data-pad-do]', { padDo: 'points', v: '2', sign: '1' }); await again(() => sentCar(1).points === p0 + 2);
    clickA('[data-pad-do]', { padDo: 'points', v: '5', sign: '-1' }); await again(() => sentCar(1).points === 0);
    say('penalty points: +2, then −5 takes the car to zero, not below it', eng().cars[1].points === 0 && E('adj-last').textContent === `Last: −5 penalty points from ${nm}`);
    clickA('[data-adj-undo]', {}); await again(() => sentCar(1).points === p0 + 2);
    say('Undo gives back what was really taken (the points are back where they were, not 5 more)', cmds[cmds.length - 1].amount === p0 + 2 && eng().cars[1].points === p0 + 2);
    clickA('[data-adj-undo]', {}); await again(() => sentCar(1).points === p0);
    clickA('[data-adj-undo]', {}); await again(() => sentCar(1).adjMs === 0);
    say('...and back to the start: the points, and the 2.5 s', eng().cars[1].points === p0 && eng().cars[1].adjMs === 0 && undoB.disabled === true);
    // paused: the pads still work; after the race: the review has its own
    run('live.actions.pause()'); await again(() => run('__sent.dyn.phase') === 'paused');
    clickA('[data-pad-do]', { padDo: 'laps', v: '1', sign: '1' }); await again(() => sentCar(1).adjLaps === 1);
    say('the pads work while the race is paused', phase() === 'paused' && eng().cars[1].adjLaps === 1 && pads.filter(p => !p.hidden).every(p => p.btns.every(b => !b.disabled || p.id === 'points')));
    clickA('[data-adj-undo]', {}); await again(() => sentCar(1).adjLaps === 0); run('live.actions.pause()'); await again(() => run('__sent.dyn.phase') === 'running');
    // the layout and the values come from the settings
    clickA('[data-adj-layout]', { adjLayout: 'v' }); await wait(60);
    say('Vertical: the layout is saved in the settings (this device) and the pads are drawn again as rows', run('state.settings.padLayout') === 'v' && E('dir-adj').innerHTML.includes('pad-v') && !E('dir-adj').innerHTML.includes('pad-h') && layB[1]['aria-pressed'] === 'true');
    run('state.settings.padSeconds = [2, 4]'); cbs.dyn.forEach(f => f(plain(sent.dyn)));
    say('the values of the time pad follow the settings (2 and 4), the other pads keep the standard values', ['2', '4'].every(v => E('dir-adj').innerHTML.includes(`data-pad-do="time" data-sign="1" data-v="${v}"`)) && !E('dir-adj').innerHTML.includes('data-pad-do="time" data-sign="1" data-v="5"') && E('dir-adj').innerHTML.includes('data-pad-do="laps" data-sign="1" data-v="1"'));
    clickA('[data-adj-layout]', { adjLayout: 'h' }); await wait(60); run('delete state.settings.padSeconds');
    cbs.dyn.forEach(f => f(plain(sent.dyn)));
    say('Horizontal again, with the standard values', E('dir-adj').innerHTML.includes('pad-h') && E('dir-adj').innerHTML.includes('data-pad-do="time" data-sign="1" data-v="30"'));
  }
  const dyn = run('__sent.dyn'); say('the waiting calls are part of what the race shares with other windows', Array.isArray(dyn.calls) && dyn.calls.length === 4 && dyn.calls.every(c => !c.open));
  ctrlKey(1); await repaint(1);
  say('a viewer sees the same open call', run(`(() => { const V = LiveShare.viewer(); V.feedStatic(__sent.stat); V.feedDynamic(__sent.dyn, performance.now()); return V.engine().calls.filter(c => c.open).length; })()`) === 1);

  // a button of one lane on the Trackmate itself (once it is known what those send): the same as the Call button; the one Trackcall button still works as it did
  strip('dismiss', 5); say('(the call from Ctrl + 1 is settled again)', openCalls() === '');
  key('y'); run("Trackmate.link.emit({ type: 'call', lane: 1, at: 0 })");
  say('a call event with a lane from the hardware is a call from that lane', openCalls() === '1' && eng().flag === 'yellow');
  strip('dismiss', 6); key('y');
  run("Trackmate.link.emit({ type: 'call', at: 0 })");
  say('a call event without a lane is still the one Trackcall button: no call is made', openCalls() === '' && eng().calls.length === 6);
  key('y'); key('y');
  key('r'); ctrlKey(1);
  say('under the red flag a call waits and the flag stays red', eng().flag === 'red' && openCalls() === '0' && phase() === 'paused');
  say('...the Call buttons still work while paused', run('live.callBtns[0].b.disabled') === false);
  key('r'); await until(() => phase() === 'running', 12000);
  strip('dismiss', 7); key('y'); if (eng().flag === 'yellow') key('y');
  ctrlKey(2); saved.length = 0; key('s'); await wait(250);
  say('when the race ends nothing waits any more, and the strip is gone', phase() === 'finished' && openCalls() === '' && E('calls').hidden === true);
  ctrlKey(1); say('after the end a call does nothing', eng().calls.filter(c => c.open).length === 0);
  run('LiveView.unmount')();

  // ---------- batch I (second half): special penalties and the race review ----------
  run('state.autoFinalize = false');
  store.penaltysystems = [{ id: 'p2', name: 'Full', timeRule: 'every', everyPoints: 5, everySeconds: 5, types: [
    { name: 'Drivethrough', kind: 'drivethrough', cost: 3, extra: 1, unserved: 10 }, { name: 'Stop-and-Go 5', kind: 'stopgo', seconds: 5, cost: 5, extra: 2, unserved: 8 }] }];
  els.sim.checked = false; saved.length = 0;
  await openRace({ name: 'Rev', sessionType: 'race', laps: 3, endRule: 'all', layout: '', penaltySystem: 'p2', pitHold: 0.05, padLaps: '6, 3, 3', padSeconds: '2.5' }, store.tracks[0], rows(1, 2)); // (1.20.0: this race setup has pad values of its own for the laps and the time)
  key(' '); await until(() => phase() === 'running'); await wait(60);
  const host3 = document.createElement('div'); await run('LiveView.mount')(host3, {}); run('LiveView.go')('director');
  const click2 = (cmd, lane, n, type) => E('lv-body').onclick({ target: { closest: () => ({ dataset: { cmd, lane, n, type }, disabled: false }) } });
  for (let k = 0; k < 4; k++) click2('penalty', '0', '1');
  click2('assign', '0', undefined, '0');
  { const has = (id, g, v) => E(id).innerHTML.includes(`data-pad-do="${g}" data-sign="1" data-v="${v}"`);
    say('1.20.0: the Adjust folder of the Race tab uses the pad values of the race setup (laps 3 and 6, time 2.5), the other pads the values of the settings (penalty points 1, 2, 5)', has('adjpanel', 'laps', 3) && has('adjpanel', 'laps', 6) && !has('adjpanel', 'laps', 1) && !has('adjpanel', 'laps', 2) && has('adjpanel', 'time', 2.5) && !has('adjpanel', 'time', 30) && has('adjpanel', 'points', 5) && has('adjpanel', 'points', 1));
    say('...so does the Adjust folder of the Race Director page (a phone gets the race setup with the race)', has('dir-adj', 'laps', 3) && has('dir-adj', 'laps', 6) && !has('dir-adj', 'laps', 1) && has('dir-adj', 'time', 2.5) && !has('dir-adj', 'time', 30) && has('dir-adj', 'points', 5) && has('dir-adj', 'points', 1)); }
  say('Race Director: a Drivethrough costs 3 points and is pending', run('live.engine().cars[0].points') === 1 && run('live.engine().cars[0].pending.length') === 1);
  click2('assign', '1', undefined, '0'); say('and cannot be given without the points', run('live.engine().cars[1].pending.length') === 0);
  run('live.actions.pit ? 0 : 0'); key('!');
  run('(() => { const e = live.engine(); e.block(0, performance.now()); })()'); await wait(300);
  say('serving it by a pit stop clears it', run('live.engine().cars[0].pending.length') === 0 && run('live.engine().cars[0].served.length') === 1);
  run('live.engine().unblock(0, performance.now())');
  click2('penalty', '1', '1'); click2('penalty', '1', '1'); click2('penalty', '1', '1'); click2('penalty', '1', '1'); click2('penalty', '1', '1');
  click2('assign', '1', undefined, '1'); // Stop-and-Go 5 s, never served
  for (let k = 0; k < 12 && phase() === 'running'; k++) { await wait(60); key('1'); key('2'); }
  await until(() => phase() === 'review');
  say('the race ends in a review: nothing is saved yet', phase() === 'review' && saved.length === 0);
  say('the review panel lists the drivers and the unserved penalty', E('review').innerHTML.includes('Race review') && E('review').innerHTML.includes('Stop-and-Go 5') && E('review').innerHTML.includes('Finalize'));
  say('the review has the winner\'s cup in front of the name of the first driver (once)', (E('review').innerHTML.match(/<svg class="trophy"/g) || []).length === 1 && /<td>1<\/td><td><svg class="trophy"/.test(E('review').innerHTML));
  await until(() => sent.dyn && sent.dyn.phase === 'review'); await wait(150); cbs.dyn.forEach(f => f(plain(sent.dyn)));
  say('the Director page shows the review too', E('dir-review').innerHTML.includes('Race review'));
  const rv = (op, o = {}) => E('review').onclick({ target: { closest: () => ({ dataset: { rv: op, ...o } }) } });
  rv('laps', { car: '1' }); say('laps can be opened', E('review').innerHTML.includes('Mark invalid'));
  rv('deltry', { car: '1', lap: '0' }); say('deleting a lap asks how', E('review').innerHTML.includes('From the records only') && E('review').innerHTML.includes('From the race too'));
  rv('removelap', { car: '1', lap: '0', recalc: '0' }); say('...removed from the records only: still 3 laps in the race', run('live.engine().cars[1].laps.length') === 3 && run('live.engine().cars[1].removed.join()') === '0');
  rv('invalid', { car: '1', lap: '1', on: '1' }); say('a lap can be marked invalid', run('live.engine().cars[1].invalid.join()') === '1');
  const before = run('live.engine().penMs(live.engine().cars[1])');
  E('dir-review').onclick({ target: { closest: () => ({ dataset: { rv: 'forgive', car: '1', k: '0' } }) } });
  say('the Director page can make the same corrections', run('live.engine().cars[1].pending.length') === 0);
  rv('nullify', { car: '1' }); say('points can be cleared', run('live.engine().cars[1].points') === 0 && before >= 0);
  rv('nullify', { car: '0' }); say('...and the clearing has an undo button', E('review').innerHTML.includes('Restore'));
  rv('restorepoints', { car: '0' }); say('undo brings the points back', run('live.engine().cars[0].points') > 0);
  { // 1.2.0: adjust the race time and laps of a driver in the review (the same panel on the Director page)
    const lapsA = run('live.engine().cars[0].laps.length');
    say('the review has an Adjust button for every driver, and no Points column (this race has no championship points)', (E('review').innerHTML.match(/data-rv="adjopen"/g) || []).length === 2 && !E('review').innerHTML.includes('<th>Points</th>'));
    rv('adjopen', { car: '0' }); say('Adjust opens the panel of that driver, with pads for the time and the laps', E('review').innerHTML.includes('Adjust the result of') && E('review').innerHTML.includes('data-pad="time"') && E('review').innerHTML.includes('data-pad="laps"') && E('review').innerHTML.includes('data-rv="adjust" data-car="0"') && !E('review').innerHTML.includes('data-rv="adjust" data-car="1"'));
    say('1.20.0: ...the pads in the review have the values of the race setup too (laps 3 and 6, time 2.5)', ['laps,3', 'laps,6', 'time,2.5'].every(x => E('review').innerHTML.includes(`data-pad-do="${x.split(',')[0]}" data-sign="1" data-v="${x.split(',')[1]}"`)) && !E('review').innerHTML.includes('data-pad-do="laps" data-sign="1" data-v="2"') && !E('review').innerHTML.includes('data-pad-do="time" data-sign="1" data-v="30"'));
    rv('adjust', { car: '0', padDo: 'time', v: '5', sign: '1' }); say('+ on the 5 s pad puts 5 seconds on that driver and the review says so', run('live.engine().cars[0].adjMs') === 5000 && E('review').innerHTML.includes('adjusted: +5 s'));
    E('dir-review').onclick({ target: { closest: () => ({ dataset: { rv: 'adjust', car: '0', padDo: 'laps', v: '1', sign: '-1' } }) } });
    say('the Director page can adjust too: − on the 1 lap pad', run('live.engine().cars[0].adjLaps') === -1 && run('live.engine().lapsOf(live.engine().cars[0])') === lapsA - 1 && E('review').innerHTML.includes('\u22121 lap, +5 s'));
    await wait(150); await until(() => sent.dyn && sent.dyn.cars && sent.dyn.cars[0] && sent.dyn.cars[0].adjLaps === -1, 3000).catch(() => {}); cbs.dyn.forEach(f => f(plain(sent.dyn)));
    say('...and the Director page shows the adjustment too (it travels with the car)', E('dir-review').innerHTML.includes('adjusted: \u22121 lap, +5 s'));
  }
  rv('finalize'); await wait(200);
  say('Finalize saves the session', phase() === 'finished' && saved.length === 1);
  const L = saved[0][1];
  { const row = saved[0][0].standings.find(x => x.driverId === 'd1'), plainRow = saved[0][0].standings.find(x => x.driverId === 'd2');
    say('Finalize saves what was adjusted with the result: the laps that count, and the adjustment next to them', row && row.adjMs === 5000 && row.adjLaps === -1 && row.laps === saved[0][1].filter(l => l.driverId === 'd1').length - 1 && !!plainRow && plainRow.adjMs === undefined && plainRow.adjLaps === undefined); }
  say('saved laps: the one removed from the records is missing, the invalid one is flagged and kept out of records', !L.some(l => l.driverId === 'd2' && l.lapNumber === 1) && L.some(l => l.driverId === 'd2' && l.lapNumber === 2 && l.invalid && l.noTrackRecord && l.noPersonalBest));
  say('and the other laps are saved as normal', L.some(l => l.driverId === 'd1' && l.lapNumber === 1 && !l.invalid && !l.noTrackRecord));
  run('LiveView.unmount')();
  // "Delete all data": nothing is saved
  store.layouts = []; run('state.autoFinalize = false');
  await openRace({ name: 'D', sessionType: 'race', laps: 2, endRule: 'all', layout: '' }, store.tracks[0], rows(1, 2));
  key(' '); await until(() => phase() === 'running');
  for (let k = 0; k < 10 && phase() === 'running'; k++) { await wait(60); key('1'); key('2'); }
  await until(() => phase() === 'review');
  const nSaved = saved.length;
  say('the review offers Delete all data next to Finalize', phase() === 'review' && E('review').innerHTML.includes('data-rv="discard"') && E('review').innerHTML.includes('Delete all data'));
  E('review').onclick({ target: { closest: () => ({ dataset: { rv: 'discard' } }) } }); await wait(200);
  say('Delete all data ends the race and saves nothing', phase() === 'finished' && saved.length === nSaved && E('msg').textContent.includes('Nothing was saved'));
  run('state.autoFinalize = true');

  // ---------- 1.2.0: the review of a heat race decided on points: adjust the championship points ----------
  {
    saved.length = 0; run('state.autoFinalize = false'); els.sim.checked = false;
    await openRace({ name: 'HeatAdj', sessionType: 'heats', heatBy: 'laps', laps: 2, endRule: 'all', heatPlan: 'roundrobin', resultBy: 'points', points: '10, 8, 6', layout: '' }, store.tracks[0], rows(1, 2, 3));
    key(' '); await until(() => phase() === 'running');
    for (let k = 0; k < 14 && phase() === 'running'; k++) { await wait(60); key('1'); key('2'); }
    await until(() => phase() === 'review');
    const rvh = (op, o = {}) => E('review').onclick({ target: { closest: () => ({ dataset: { rv: op, ...o } }) } });
    say('a heat decided on points: the review has a Points column with the points of the places (10 and 8)', phase() === 'review' && E('review').innerHTML.includes('<th class="rv-champ">Points</th>') && /<td class="num rv-champ">10<\/td>/.test(E('review').innerHTML) && /<td class="num rv-champ">8<\/td>/.test(E('review').innerHTML));
    const second = run('live.engine().standings()[1].index'), nm = run(`live.engine().cars[${second}].driverName`);
    rvh('adjopen', { car: String(second) });
    say('...and the panel has a championship points pad (green)', E('review').innerHTML.includes('data-pad="champ"') && E('review').innerHTML.includes(`data-rv="adjust" data-car="${second}"`));
    rvh('adjust', { car: String(second), padDo: 'champ', v: '5', sign: '1' });
    say('Add 5 points to the driver in second place: the review shows 13 and what was adjusted', run(`live.engine().cars[${second}].adjPoints`) === 5 && /<td class="num rv-champ">13<\/td>/.test(E('review').innerHTML) && E('review').innerHTML.includes('adjusted: +5 pts'));
    rvh('adjust', { car: String(second), padDo: 'time', v: '5', sign: '1' });
    say('...and 5 seconds on his time: the review says +5 s', run(`live.engine().cars[${second}].adjMs`) === 5000 && E('review').innerHTML.includes('adjusted: +5 s, +5 pts'));
    const host5 = document.createElement('div'); await run('LiveView.mount')(host5, {}); run('LiveView.go')('director');
    await until(() => sent.dyn && sent.dyn.phase === 'review' && sent.dyn.cars && sent.dyn.cars[second] && sent.dyn.cars[second].adjPoints === 5 && sent.dyn.cars[second].adjMs === 5000, 3000); await wait(100); cbs.dyn.forEach(f => f(plain(sent.dyn)));
    say('the Director page has the same Points column, with the adjusted points (the championship comes with what is shared)', E('dir-review').innerHTML.includes('<th class="rv-champ">Points</th>') && E('dir-review').innerHTML.includes('adjusted: +5 s, +5 pts') && /<td class="num rv-champ">13<\/td>/.test(E('dir-review').innerHTML));
    run('LiveView.unmount')(); run('state.autoFinalize = true'); rvh('finalize'); await until(() => ['between', 'finished'].includes(phase()));
    els.sim.checked = true; let hn = 0;
    while (phase() !== 'finished' && hn++ < 6) { key(' '); await until(() => ['between', 'finished'].includes(phase())); }
    const sess = saved[0] && saved[0][0], row1 = sess && sess.heatResults[0].rows.find(r => r.driverName === nm), tot = sess && sess.standings.find(x => x.driverName === nm);
    say('Finalize of the heat carries it into the heat result: the points of the place plus 5, the time plus 5 s, with the adjustment in the row', !!row1 && row1.adjPoints === 5 && row1.adjMs === 5000 && row1.points === 13 && sess.heatResults[0].rows.filter(r => r.adjPoints !== undefined).length === 1);
    say('...and into the overall result: 5 more points in the total and the adjustment in its row, the sum of all points is 54 + 5', !!tot && tot.adjPoints === 5 && tot.adjMs === 5000 && sess.standings.reduce((t, x) => t + x.points, 0) === 59 && sess.standings.filter(x => x.adjPoints !== undefined).length === 1);
    run('state.autoFinalize = true');
  }

  // ---------- reviewing laps while a race goes on (any session type) ----------
  {
    saved.length = 0; run('state.autoFinalize = false'); els.sim.checked = false;
    await openRace({ name: 'Mid', sessionType: 'race', laps: 3, endRule: 'all', layout: '' }, store.tracks[0], rows(1, 2));
    const E2 = () => run('live.engine()'), lr = (op, o = {}) => E('lapreview').onclick({ target: { closest: () => ({ dataset: { rv: op, ...o } }) } });
    const cmd = c => run('live.reviewCommand')(c), best = id => run(`live.bestBy.get('${id}')`);
    const wanted = c => { const g = c.laps.filter((t, n) => !c.bad[n] && !c.invalid.includes(n) && !c.removed.includes(n)); return g.length ? Math.min(...g) : undefined; };
    say('before the start there is nothing to review: no button, no panel', E('lapsbtn').hidden === true && E('lapreview').hidden === true);
    key(' '); await until(() => phase() === 'running'); await wait(60);
    for (let k = 0; k < 20 && E2().cars[0].laps.length < 2; k++) { await wait(60); key('1'); key('2'); }
    say('(both cars have driven a lap or two)', E2().cars[0].laps.length >= 2 && E2().cars[1].laps.length >= 1);
    say('in a race (not only a Time Token Session) there is a Review laps button while it runs', E('lapsbtn').hidden === false && E('lapreview').hidden === true);
    E('lapsbtn').onclick({});
    say('...it opens the panel: every lane with driver, laps, last and best lap', E('lapreview').hidden === false && E('lapreview').innerHTML.includes('Alex') && E('lapreview').innerHTML.includes('Sam') && (E('lapreview').innerHTML.match(/data-rv="laps"/g) || []).length === 2);
    lr('laps', { car: '0' });
    say('a lane opens to its laps with Mark invalid and Delete…', E('lapreview').innerHTML.includes('Mark invalid') && E('lapreview').innerHTML.includes('Delete…'));
    lr('invalid', { car: '0', lap: '0', on: '1' });
    say('Mark invalid during the race: the lap leaves the best lap and the highlights', E2().cars[0].invalid.join() === '0' && E2().cars[0].best === wanted(E2().cars[0]) && best('d1') === wanted(E2().cars[0]) && E('lapreview').innerHTML.includes('Mark valid'));
    lr('invalid', { car: '0', lap: '0', on: '0' });
    say('...and valid again', E2().cars[0].invalid.length === 0 && best('d1') === wanted(E2().cars[0]));
    lr('deltry', { car: '0', lap: '0' });
    say('Delete… offers both ways while the car is still racing', E('lapreview').innerHTML.includes('From the records only') && E('lapreview').innerHTML.includes('From the race too (recalculate)'));
    const n0 = E2().cars[0].laps.length, t0 = E2().cars[0].total, first = E2().cars[0].laps[0];
    lr('removelap', { car: '0', lap: '0', recalc: '1' });
    say('from the race too: one lap fewer and less time, the car has to drive that lap again', E2().cars[0].laps.length === n0 - 1 && Math.abs(E2().cars[0].total - (t0 - first)) < 1e-6 && E2().cars[0].done === false && best('d1') === wanted(E2().cars[0]));
    // pause: still possible
    key(' '); say('(paused)', phase() === 'paused');
    lr('invalid', { car: '1', lap: '0', on: '1' });
    say('lap corrections work while the race is paused too', E2().cars[1].invalid.join() === '0');
    lr('invalid', { car: '1', lap: '0', on: '0' }); key(' '); await wait(30);
    // car 1 finishes while car 0 is still racing
    for (let k = 0; k < 30 && !E2().cars[1].done; k++) { await wait(60); key('2'); }
    say('(car 2 has finished its laps, car 1 is still racing)', E2().cars[1].done === true && phase() === 'running' && E2().cars[0].done === false);
    lr('laps', { car: '1' });
    say('a car that has finished: Delete… only offers to take the lap out of the records', (() => { lr('deltry', { car: '1', lap: '0' }); return E('lapreview').innerHTML.includes('From the records only') && !E('lapreview').innerHTML.includes('From the race too'); })());
    const nDone = E2().cars[1].laps.length;
    cmd({ op: 'removelap', car: 1, lap: 0, recalc: true });
    say('...and a command to take it out of the race is refused', E2().cars[1].laps.length === nDone && E2().cars[1].done === true);
    cmd({ op: 'removelap', car: 1, lap: 0, recalc: false });
    say('...but it can be taken out of the records', E2().cars[1].removed.join() === '0' && E2().cars[1].laps.length === nDone && best('d2') === wanted(E2().cars[1]));
    cmd({ op: 'invalid', car: 1, lap: 1, on: true });
    const s0 = JSON.stringify(E2().cars.map(c => [c.laps, c.invalid, c.removed, c.points, c.dq, c.extraMs]));
    [{ op: 'nullify', car: 0, lap: 0 }, { op: 'dq', car: 0, lap: 0 }, { op: 'forgive', car: 0, lap: 0, k: 0 }, { op: 'addtime', car: 0, lap: 0, ms: 5000 }, { op: 'restorepoints', car: 0, lap: 0 }, { op: 'finalize' }, { op: 'discard' }, { op: 'invalid', car: '0', lap: 0, on: true }, { op: 'invalid', car: 5, lap: 0, on: true }, { op: 'invalid', car: 0, lap: 50, on: true }, { op: 'removelap', car: 0, lap: -1 }, {}, null, 'x'].forEach(c => cmd(c));
    say('during the race only lap corrections work: penalties, Finalize and Delete all data are for the review after the race', JSON.stringify(E2().cars.map(c => [c.laps, c.invalid, c.removed, c.points, c.dq, c.extraMs])) === s0 && phase() === 'running');
    // the Race Director page
    const host4 = document.createElement('div'); await run('LiveView.mount')(host4, {}); run('LiveView.go')('director'); await wait(150); cbs.dyn.forEach(f => f(plain(sent.dyn)));
    say('the Race Director page has the Review laps box while the race runs', E('dir-lapsbox').hidden === false && E('dir-laps').innerHTML.includes('Review laps') && E('dir-laps').innerHTML.includes('Alex'));
    E('dir-laps').onclick({ target: { closest: () => ({ dataset: { rv: 'laps', car: '0' } }) } });
    say('...a lane opens to its laps', E('dir-laps').innerHTML.includes('Mark invalid') || E('dir-laps').innerHTML.includes('Mark valid'));
    const lapOf0 = E2().cars[0].laps.length - 1; cmds.length = 0;
    E('dir-laps').onclick({ target: { closest: () => ({ dataset: { rv: 'invalid', car: '0', lap: String(lapOf0), on: '1' } }) } }); await wait(100); cbs.dyn.forEach(f => f(plain(sent.dyn)));
    say('...Mark invalid on the page reaches the race, which does it, and the page shows it', cmds.length === 1 && cmds[0].type === 'review' && cmds[0].op === 'invalid' && E2().cars[0].invalid.includes(lapOf0) && E('dir-laps').innerHTML.includes('Mark valid'));
    E('dir-laps').innerHTML = 'MARK'; cbs.dyn.forEach(f => f(plain(sent.dyn)));
    say('...the box is not drawn again while nothing in it changed (a button never changes under a finger)', E('dir-laps').innerHTML === 'MARK');
    run('LiveView.unmount')();
    // the race ends: the review after the race has all of it
    for (let k = 0; k < 40 && phase() === 'running'; k++) { await wait(60); key('1'); }
    await until(() => phase() === 'review');
    say('after the race the panel is gone and the end review has the corrections made during the race', phase() === 'review' && E('lapsbtn').hidden === true && E('lapreview').hidden === true && E('review').innerHTML.includes('Race review'));
    rv2 = (op, o = {}) => E('review').onclick({ target: { closest: () => ({ dataset: { rv: op, ...o } }) } });
    const bestNow = best('d2'); rv2('invalid', { car: '1', lap: '2', on: '1' });
    say('a correction in the review after the race works out the best laps again', E2().cars[1].invalid.includes(2) && best('d2') === wanted(E2().cars[1]) && (best('d2') !== bestNow || E2().cars[1].laps[2] > bestNow));
    rv2('finalize'); await wait(200);
    const L2 = saved[0][1];
    say('what is saved has the corrections: a lap taken out of the records is missing, an invalid one is flagged', saved.length === 1 && !L2.some(l => l.driverId === 'd2' && l.lapNumber === 1) && L2.some(l => l.driverId === 'd2' && l.lapNumber === 2 && l.invalid && l.noTrackRecord && l.noPersonalBest) && L2.some(l => l.driverId === 'd1' && l.invalid && l.noTrackRecord));
  }
  var rv2;

  // the best laps of the earlier heats stay when a lap of a later heat is corrected
  {
    saved.length = 0; run('state.autoFinalize = true'); store.laps = [];
    await openRace({ name: 'HeatsFix', sessionType: 'heats', heatBy: 'laps', laps: 2, endRule: 'all', heatPlan: 'roundrobin', resultBy: 'laps', layout: '' }, store.tracks[0], rows(1, 2, 3));
    const E2 = () => run('live.engine()'), cmd = c => run('live.reviewCommand')(c);
    key(' '); await until(() => phase() === 'running'); await wait(60);
    for (let k = 0; k < 40 && phase() === 'running'; k++) { await wait(60); key('1'); key('2'); }
    await until(() => phase() === 'between');
    const heat1 = { by: new Map(run('[...live.bestBy]')), all: run('live.bestAll') };
    say('after heat 1 the best laps of the heat are kept for the next ones', heat1.by.size === 2 && Number.isFinite(heat1.all) && run('live.priorAll') === heat1.all && run('live.priorBy.size') === 2);
    key(' '); await until(() => phase() === 'running'); await wait(60);
    for (let k = 0; k < 6 && E2().cars[0].laps.length < 1; k++) { await wait(60); key('1'); key('2'); }
    const car0 = E2().cars[0], id0 = car0.driverId, before0 = run(`live.bestBy.get('${id0}')`);
    cmd({ op: 'invalid', car: 0, lap: 0, on: true });
    const prior = heat1.by.get(id0);
    say('a lap of heat 2 marked invalid: the best laps of heat 1 are still there', run(`live.bestBy.get('${id0}')`) === (prior === undefined ? undefined : prior) && run('live.bestAll') <= heat1.all + 1e-9);
    say('...and the lap that was marked is not counted', run(`live.bestBy.get('${id0}')`) !== car0.laps[0] || prior === car0.laps[0]);
    run('live.actions.stop(true)'); await wait(200);
  }
  run('state.autoFinalize = true');

  // ---------- audio: announcements while racing ----------
  const spoken = []; ctx.Sound.state.backend = { speak: (t, o, done) => { spoken.push(t); done(); }, file: (u, o, done) => { spoken.push('file'); done(); }, stop: () => {} };
  store.audiosets = [{ id: 'AU1', name: 'Test', rate: 1, pitch: 1, volume: 1, driverBy: 'name', calls: { prerace: { on: true, lines: [{ text: 'Ready now', file: '' }] }, lightsout: { on: true, lines: [{ text: 'Away we go', file: '' }] }, yellowflag: { on: true, lines: [{ text: 'Yellow out', file: '' }] }, redflag: { on: false, lines: [{ text: 'Red out', file: '' }] } } }];
  run('state.rand = () => 0');
  await openRace({ name: 'AU', sessionType: 'practice', layout: 'C1', lightsMin: 0, lightsMax: 0, audioSet: 'AU1' }, store.tracks[0], rows(1, 2));
  key(' '); await until(() => phase() === 'running'); await wait(50);
  say('the pre-race call comes first, and lights out is announced, from the audio set', spoken[0] === 'Ready now' && spoken.includes('Away we go'));
  key('y'); await wait(50); say('the yellow flag is announced', spoken.includes('Yellow out'));
  key('r'); await wait(50); say('a call that is turned off stays silent', !spoken.includes('Red out'));
  key('r'); key('s'); await wait(100);
  spoken.length = 0; await openRace({ name: 'AU2', sessionType: 'practice', layout: 'C1', lightsMin: 0, lightsMax: 0 }, store.tracks[0], rows(1, 2));
  key(' '); await until(() => phase() === 'running'); await wait(50); say('no audio set: the race is silent', spoken.length === 0); key('s');
  run('state.rand = null');

  // ---------- the pre-race call: said when Start is pressed; the lights wait until it has been said ----------
  {
    const holds = []; ctx.Sound.state.backend = { speak: (t, o, done) => { spoken.push(t); holds.push(done); }, file: (u, o, done) => { spoken.push('file'); holds.push(done); }, stop: () => { holds.length = 0; } };
    const mkSet = (pre, over = {}) => ({ id: 'AU2', name: 'Pre', rate: 1, pitch: 1, volume: 1, driverBy: 'name', calls: { prerace: pre }, ...over });
    const call = { on: true, lines: [{ text: 'Get ready now', file: '' }] };
    const said = () => spoken.filter(t => t.startsWith('Get ready') || t.startsWith('Drivers, get ready')).length; // (the countdown numbers are said too)
    const open = (name, set) => { ctx.Sound.stop(); holds.length = 0; spoken.length = 0; store.audiosets = [set]; return openRace({ name, sessionType: 'practice', layout: 'C1', lightsMin: 0, lightsMax: 0, audioSet: 'AU2' }, store.tracks[0], rows(1, 2)); };
    const keepLayouts = store.layouts; store.layouts = [{ id: 'C1', name: 'C', ratioW: 16, ratioH: 9, widgets: [WB('lights', null), WB('flag', null), WB('start', null)] }]; // (this screen has a Start widget of its own)
    run('state.rand = () => 0');
    await open('PR1', mkSet(call));
    key(' '); await wait(150);
    say('Start says the pre-race call at once, and the start lights wait for it', spoken[0] === 'Get ready now' && phase() === 'ready' && run('live.lights') === 0 && run('live.calling') === true);
    say('...the screen says why, and Start is greyed out for the other windows (the Race Director page, the tablets)', E('msg').textContent.includes('pre-race call') && sent.dyn.calling === true);
    say('...and on this screen the Start widget is greyed out too', node('start').val.disabled === true);
    say('...a viewer rebuilt from what is shared knows it too, and the Start widget is off', run(`(() => { const V = LiveShare.viewer(); V.feedStatic(__sent.stat); V.feedDynamic(__sent.dyn, performance.now()); const S = V.shared(performance.now()); return S.calling === true && Timing.content({ type: 'start' }, S).disabled === true; })()`));
    { const hostD = document.createElement('div'); await run('LiveView.mount')(hostD, {}); run('LiveView.go')('director'); await wait(80);
      const btn = { disabled: false, textContent: '', setAttribute() {} }, keepQ = E('lv-body').querySelectorAll; E('lv-body').querySelectorAll = sel => (sel === '[data-cmd="start"]' ? [btn] : []);
      cbs.dyn.forEach(f => f(plain(sent.dyn))); const whileCalling = btn.disabled; cbs.dyn.forEach(f => f({ ...plain(sent.dyn), calling: false })); const after = btn.disabled; cbs.dyn.forEach(f => f({ ...plain(sent.dyn), calling: true, phase: 'running' })); const running = btn.disabled;
      E('lv-body').querySelectorAll = keepQ;
      say('the Race Director page greys out its Start button while the call is said, and not otherwise', whileCalling === true && after === false && running === true); }
    key(' '); key(' '); await wait(40);
    say('pressing Start again meanwhile does nothing: no second call, the space bar does not pause, no early countdown', said() === 1 && phase() === 'ready' && run('live.lights') === 0 && holds.length === 1);
    holds.shift()();
    say('when it has been said the lights do not start at that moment: there is a pause first', phase() === 'ready' && run('live.calling') === true && run('live.lights') === 0);
    await until(() => phase() === 'countdown' || phase() === 'running');
    say('...then the countdown begins, and the race starts', run('live.calling') === false && ['countdown', 'running'].includes(phase())); await wait(150); say('...and it is shared that the call is over', sent.dyn.calling === false); await until(() => phase() === 'running');
    say('...and the race is running', phase() === 'running' && spoken.includes('Away we go') === false); key('s'); await wait(60);
    // the pause is the one set in the audio set: 4 seconds at the test speed of 40 is 100 milliseconds
    await open('PR2', mkSet(call, { preDelay: 4 })); key(' '); await wait(30); holds.shift()(); await wait(50);
    say('the pause after the call is the one set in the audio set', phase() === 'ready' && run('live.calling') === true); await until(() => phase() !== 'ready', 1000);
    say('...and then the lights start', ['countdown', 'running'].includes(phase()) && run('live.calling') === false); await until(() => phase() === 'running'); key('s'); await wait(60);
    await open('PR3', mkSet(call, { preDelay: 0 })); key(' '); await wait(30); holds.shift()(); await wait(5);
    say('a pause of 0 seconds: the lights start as soon as the call is finished', ['countdown', 'running'].includes(phase()) || (await until(() => phase() !== 'ready', 400), phase() !== 'ready')); await until(() => phase() === 'running'); key('s'); await wait(60);
    // no waiting when there is nothing to say
    await open('PR4', mkSet({ on: false, lines: call.lines })); key(' ');
    say('with the call turned off the lights start at once, the call is not said and nothing is waited for', said() === 0 && run('live.calling') === false && phase() === 'countdown'); await until(() => phase() === 'running'); key('s'); await wait(60);
    await open('PR5', mkSet({ on: true, lines: [{ text: '   ', file: '' }] })); key(' ');
    say('...so does a call without a sentence', said() === 0 && run('live.calling') === false && phase() === 'countdown'); await until(() => phase() === 'running'); key('s'); await wait(60);
    ctx.Sound.stop(); holds.length = 0; spoken.length = 0; await openRace({ name: 'PR6', sessionType: 'practice', layout: 'C1', lightsMin: 0, lightsMax: 0 }, store.tracks[0], rows(1, 2)); key(' ');
    say('a race setup without an audio set starts at once, as before', spoken.length === 0 && phase() === 'countdown' && run('live.calling') === false); await until(() => phase() === 'running'); key('s'); await wait(60);
    // an audio set from before this version has no pre-race call: it says the ready-made one
    await open('PR7', { id: 'AU2', name: 'Old', rate: 1, pitch: 1, volume: 1, driverBy: 'name', calls: { winner: { on: true, lines: [{ text: 'x', file: '' }] } } }); key(' '); await wait(40);
    say('an audio set made before this version says the ready-made sentence too', spoken[0] === 'Drivers, get ready. The race is about to start!' && phase() === 'ready'); holds.shift()(); await until(() => phase() === 'running'); key('s'); await wait(60);
    // leaving the race screen during the call: the call stops and the start does not happen later
    await open('PR8', mkSet(call)); key(' '); await wait(40); const late = holds[0];
    run('live.leave()'); late(); await wait(120);
    say('leaving the race screen while the call is said cancels the start: nothing starts afterwards', run('live.calling') === false && phase() === 'ready' && run('live.lights') === 0);
    // opening the race again during the call: the old call cannot start the new race
    await open('PR9', mkSet(call)); key(' '); await wait(40); const old = holds[0];
    await open('PR10', mkSet(call)); old(); await wait(120);
    say('a race opened again while the call is said is not started by the old call', phase() === 'ready' && run('live.calling') === false && said() === 0);
    // a sound that never says it has finished: the start goes on after a minute (60 s / 40 at the test speed)
    await open('PR11', mkSet(call)); key(' '); await wait(900);
    say('if the sound never reports that it has finished, the lights wait (for a while)', phase() === 'ready' && run('live.calling') === true);
    await until(() => phase() !== 'ready', 3000);
    say('...but the race is not held up for ever: after a minute (here a fraction of it) the start goes on', ['countdown', 'running'].includes(phase()) && run('live.calling') === false); await until(() => phase() === 'running'); key('s'); await wait(60);
    // a sound problem never stops the race
    ctx.Sound.state.backend = { speak: () => { throw new Error('no voice'); }, file: () => { throw new Error('no file'); }, stop: () => {} };
    await open('PR12', mkSet(call)); key(' '); await until(() => phase() === 'running', 3000);
    say('a sound that breaks does not hold up the start', phase() === 'running' && run('live.calling') === false); key('s'); await wait(60);
    ctx.Sound.stop(); ctx.Sound.state.backend = { speak: (t, o, done) => { spoken.push(t); done(); }, file: (u, o, done) => { spoken.push('file'); done(); }, stop: () => {} }; // (as before this block)
    store.audiosets = [{ id: 'AU1', name: 'Test', rate: 1, pitch: 1, volume: 1, driverBy: 'name', calls: { prerace: { on: true, lines: [{ text: 'Ready now', file: '' }] }, lightsout: { on: true, lines: [{ text: 'Away we go', file: '' }] }, yellowflag: { on: true, lines: [{ text: 'Yellow out', file: '' }] }, redflag: { on: false, lines: [{ text: 'Red out', file: '' }] } } }];
    store.layouts = keepLayouts; run('state.rand = null');
  }

  // ---------- 0.87.0: laps to go, and the heat calls, on the race screen ----------
  {
    const mkSet = (calls, over = {}) => ({ id: 'AU3', name: 'New calls', rate: 1, pitch: 1, volume: 1, driverBy: 'name', ...over, calls: Object.fromEntries(Object.entries(calls).map(([id, t]) => [id, { on: true, lines: [{ text: t, file: '' }] }])) });
    const marks = () => spoken.filter(t => t.startsWith('MARK')), keepSets = store.audiosets;
    ctx.Sound.stop(); run('state.rand = () => 0'); spoken.length = 0;
    store.audiosets = [mkSet({ lapstogo: 'MARK {left} to go', lastlap: 'MARK last lap', prerace: 'MARK ready at {track}', lastlapother: 'MARK other last lap' }, { lapsToGo: '3, 2' })];
    await openRace({ name: 'TG', sessionType: 'race', laps: 5, endRule: 'all', layout: '', lightsMin: 0, lightsMax: 0, audioSet: 'AU3' }, store.tracks[0], rows(1, 2));
    E('sim').checked = true; key(' '); await until(() => phase() === 'finished', 30000);
    const m = marks(), tn = store.tracks[0].name;
    say('a race by laps says the laps to go of the audio set (3 and 2), once each, in order, between the pre-race call (with the track) and the last lap', m[0] === `MARK ready at ${tn}` && m.indexOf('MARK 3 laps to go') === 1 && m.indexOf('MARK 2 laps to go') === 2 && m.filter(t => t.includes('to go')).length === 2 && m.indexOf('MARK last lap') > 2, m.join(' | '));
    say('...and the call for another driver on the last lap is a call of its own (it is said when the set has it)', m.filter(t => t === 'MARK other last lap').length <= 1);
    // a set that has no laps to go setting uses 3 (and a minute); an empty one says none
    ctx.Sound.stop(); spoken.length = 0; store.audiosets = [mkSet({ lapstogo: 'MARK {left} to go' })];
    await openRace({ name: 'TG2', sessionType: 'race', laps: 6, endRule: 'all', layout: '', lightsMin: 0, lightsMax: 0, audioSet: 'AU3' }, store.tracks[0], rows(1, 2));
    E('sim').checked = true; key(' '); await until(() => phase() === 'finished', 30000);
    say('a set from before the setting says 3 laps to go (the default)', marks().join() === 'MARK 3 laps to go', marks().join());
    ctx.Sound.stop(); spoken.length = 0; store.audiosets = [mkSet({ lapstogo: 'MARK {left} to go' }, { lapsToGo: '' })];
    await openRace({ name: 'TG3', sessionType: 'race', laps: 6, endRule: 'all', layout: '', lightsMin: 0, lightsMax: 0, audioSet: 'AU3' }, store.tracks[0], rows(1, 2));
    E('sim').checked = true; key(' '); await until(() => phase() === 'finished', 30000);
    say('an empty list says no laps to go at all', marks().length === 0, marks().join());
    // closing in on the car in front: the gap of the audio set is the one used
    ctx.Sound.stop(); spoken.length = 0; store.audiosets = [mkSet({ closing: 'MARK closing {driver}' }, { closeGap: 30 })];
    await openRace({ name: 'CG', sessionType: 'race', laps: 5, endRule: 'all', layout: '', lightsMin: 0, lightsMax: 0, audioSet: 'AU3' }, store.tracks[0], rows(1, 2));
    E('sim').checked = true; key(' '); await until(() => phase() === 'finished', 30000);
    say('a wide gap in the audio set (30 s) has the closing-in call said on the race screen', marks().length >= 1 && marks().every(t => t.startsWith('MARK closing ')), marks().join(' | '));
    // a heat-based race: the heat in the pre-race call, the end of every heat but the last, the next heat while waiting, and the finish at the end
    ctx.Sound.stop(); spoken.length = 0;
    store.audiosets = [mkSet({ prerace: 'MARK heat {heat} of {heats}', nextheat: 'MARK next {heat}', heatend: 'MARK heat {heat} over', finished: 'MARK all over' })];
    await openRace({ name: 'HA', sessionType: 'heats', heatBy: 'laps', laps: 2, endRule: 'all', heatPlan: 'roundrobin', resultBy: 'laps', layout: '', audioSet: 'AU3', lightsMin: 0, lightsMax: 0 }, store.tracks[0], rows(1, 2, 3));
    E('sim').checked = true; let nh = 0;
    while (phase() !== 'finished' && nh++ < 6) { key(' '); await until(() => !['between', 'ready'].includes(phase()), 5000); await until(() => ['between', 'finished'].includes(phase()), 30000); } // (the pre-race call holds the start for a moment)
    say('three heats: each pre-race call names its heat, each heat but the last ends with "heat n over" and then announces the next, and the last one says the race is finished', marks().join(' | ') === 'MARK heat 1 of 3 | MARK heat 1 over | MARK next 2 | MARK heat 2 of 3 | MARK heat 2 over | MARK next 3 | MARK heat 3 of 3 | MARK all over', marks().join(' | '));
    // with finals: the end of the last heat is a heat that ends (the race goes on), then the final B and the final A are announced, and only the end of the last final says the race is finished
    ctx.Sound.stop(); spoken.length = 0;
    store.audiosets = [mkSet({ prerace: 'MARK go {heat}{final}', nextheat: 'MARK next {heat}', nextfinal: 'MARK next final {final}', heatend: 'MARK heat {heat} over', finalend: 'MARK final {final} over', finished: 'MARK all over' })];
    await openRace({ name: 'HF', sessionType: 'heats', heatBy: 'laps', laps: 2, endRule: 'all', heatPlan: 'manual', heats: 2, resultBy: 'laps', layout: '', audioSet: 'AU3', lightsMin: 0, lightsMax: 0, finals: 'ab' }, store.tracks[0], rows(1, 2, 3, 4));
    E('sim').checked = true; nh = 0;
    while (phase() !== 'finished' && nh++ < 8) { if (phase() === 'between') run('live.pickAction')('random'); key(' '); await until(() => !['between', 'ready'].includes(phase()), 5000); await until(() => ['between', 'finished'].includes(phase()), 30000); }
    say('with finals: heat 1 over, next 2, heat 2 over (the race goes on), next final B, final B over, next final A, and only the final A ends the race ("all over"); the pre-race call names the heat or the final', marks().join(' | ') === 'MARK go 1 | MARK heat 1 over | MARK next 2 | MARK go 2 | MARK heat 2 over | MARK next final B | MARK go B | MARK final B over | MARK next final A | MARK go A | MARK all over', marks().join(' | '));
    // 1.7.0: the line-up of the next heat is read after the call that it is ready
    ctx.Sound.stop(); spoken.length = 0;
    store.audiosets = [mkSet({ nextheat: 'MARK next {heat}', lineup: 'MARK lineup {heat}: {lineup}', nextfinal: 'MARK next final {final}' })];
    await openRace({ name: 'LU', sessionType: 'heats', heatBy: 'laps', laps: 2, endRule: 'all', heatPlan: 'roundrobin', resultBy: 'laps', layout: '', audioSet: 'AU3', lightsMin: 0, lightsMax: 0 }, store.tracks[0], rows(1, 2, 3));
    E('sim').checked = true; nh = 0;
    while (phase() !== 'finished' && nh++ < 6) { key(' '); await until(() => !['between', 'ready'].includes(phase()), 5000); await until(() => ['between', 'finished'].includes(phase()), 30000); }
    say('between the heats the next heat is announced and its line-up is read with the lanes (and after the last heat nothing is read)', marks().length === 4 && /^MARK next 2$/.test(marks()[0]) && /^MARK lineup 2: \w+ in lane 1 and \w+ in lane 2$/.test(marks()[1]) && /^MARK next 3$/.test(marks()[2]) && /^MARK lineup 3: \w+ in lane 1 and \w+ in lane 2$/.test(marks()[3]), marks().join(' | '));
    ctx.Sound.stop(); spoken.length = 0; store.audiosets = keepSets; run('state.rand = null'); E('sim').checked = false; // (as before this block)
  }

  // ---------- 0.88.0: records, the call from a lane, no lap for a while and the Trackmate, on the race screen ----------
  {
    const mkSet = (calls, over = {}) => ({ id: 'AU4', name: 'Safety calls', rate: 1, pitch: 1, volume: 1, driverBy: 'name', ...over, calls: Object.fromEntries(Object.entries(calls).map(([id, t]) => [id, { on: true, lines: [{ text: t, file: '' }] }])) });
    const marks = () => spoken.filter(t => t.startsWith('MARK')), keepSets = store.audiosets, keepLaps = store.laps;
    store.laps = [{ id: 'rec1', driverId: 'd2', carId: 'c2', trackId: store.tracks[0].id, time: 1, date: 'x' }]; // (a track record of 1 millisecond: every lap of these races is close to it, or not, by the audio set)
    ctx.Sound.stop(); run('state.rand = () => 0'); spoken.length = 0;
    run('Trackmate.link.setConnected(false)');
    store.audiosets = [mkSet({ nearrecord: 'MARK near {driver} {off}', lanecall: 'MARK call {driver} lane {lane}', trackmatelost: 'MARK tm lost', trackmateback: 'MARK tm back', nolap: 'MARK nolap {driver} {seconds}' }, { nearRecord: 5, noLapSeconds: 5 })];
    await openRace({ name: 'SF', sessionType: 'practice', layout: '', lightsMin: 0, lightsMax: 0, audioSet: 'AU4' }, store.tracks[0], rows(1, 2));
    key(' '); await until(() => phase() === 'running', 3000);
    await wait(60); key('1'); await wait(60); key('1'); await wait(150);
    say('close to the record: a lap within the distance of the audio set (5 seconds) of the track record is announced with the driver and the difference', marks().some(t => /^MARK near Alex \d/.test(t)), marks().join(' | '));
    spoken.length = 0; run('live.engine().call(1, performance.now())'); await wait(150);
    say('a call from a lane is announced with the driver and the lane', marks().join() === 'MARK call Sam lane 2', marks().join());
    spoken.length = 0; run('Trackmate.link.setConnected(true)'); await wait(250);
    say('the Trackmate connecting during a race says it is back', marks().join() === 'MARK tm back', marks().join());
    spoken.length = 0; run('Trackmate.link.setConnected(false)'); await wait(250);
    say('...and losing it says so', marks().join() === 'MARK tm lost', marks().join());
    spoken.length = 0; await wait(150);
    say('...nothing more is said while it stays like that, and no lap is not asked about yet (5 seconds are not over)', marks().length === 0, marks().join());
    await wait(5600);
    say('no lap for a while: said after the seconds of the audio set (5, not the default 30), for the driver of each lane that has not crossed the line', marks().filter(t => t.startsWith('MARK nolap')).sort().join() === 'MARK nolap Alex 5,MARK nolap Sam 5', marks().join(' | '));
    spoken.length = 0; await wait(200); say('...once', marks().length === 0);
    key('s'); await wait(60); ctx.Sound.stop(); spoken.length = 0;
    // a distance smaller than the lap, and a set without these calls
    store.audiosets = [mkSet({ nearrecord: 'MARK near {driver}', nolap: 'MARK nolap' }, { nearRecord: 0.01, noLapSeconds: 600 })];
    await openRace({ name: 'SF2', sessionType: 'practice', layout: '', lightsMin: 0, lightsMax: 0, audioSet: 'AU4' }, store.tracks[0], rows(1, 2));
    key(' '); await until(() => phase() === 'running', 3000);
    await wait(60); key('1'); await wait(60); key('1'); await wait(700);
    say('a lap further from the record than the audio set says (0.01 seconds) is not "close", and 600 seconds without a lap are not over', marks().length === 0, marks().join(' | '));
    key('s'); await wait(60); ctx.Sound.stop(); spoken.length = 0;
    store.audiosets = [mkSet({ prerace: 'MARK ready' })];
    await openRace({ name: 'SF3', sessionType: 'practice', layout: '', lightsMin: 0, lightsMax: 0, audioSet: 'AU4' }, store.tracks[0], rows(1, 2));
    run('live.engine().call(1, performance.now())'); key(' '); await until(() => phase() === 'running', 3000);
    run('live.engine().call(0, performance.now())'); await wait(60); key('1'); await wait(60); key('1'); await wait(150); run('Trackmate.link.setConnected(true)'); await wait(6000);
    say('a set from before these calls says none of them, though it has a flag call (they are off unless the set has them)', marks().join() === 'MARK ready' && spoken.some(t => t.startsWith('Yellow flag')) && spoken.every(t => !/marshal|No lap from|stuck|Trackmate|track record/i.test(t)), spoken.join(' | '));
    key('s'); await wait(60); ctx.Sound.stop(); spoken.length = 0; store.audiosets = keepSets; store.laps = keepLaps; run('state.rand = null'); run('Trackmate.link.setConnected(false)'); E('sim').checked = false; // (as before this block)
  }

  // ---------- 0.89.0: conditions of a sentence and the wait of a call, on the race screen ----------
  {
    const line = (text, only) => (only ? { text, file: '', only } : { text, file: '' });
    const mkSet = (calls) => ({ id: 'AU5', name: 'Conditions', rate: 1, pitch: 1, volume: 1, driverBy: 'name', calls: Object.fromEntries(Object.entries(calls).map(([id, c]) => [id, { on: true, ...c }])) });
    const marks = () => spoken.filter(t => t.startsWith('MARK')), keepSets = store.audiosets;
    const lapRace = async name => { await openRace({ name, sessionType: 'practice', layout: '', lightsMin: 0, lightsMax: 0, audioSet: 'AU5' }, store.tracks[0], rows(1, 2)); key(' '); await until(() => phase() === 'running', 3000); await wait(60); key('1'); await wait(40); key('2'); await wait(200); key('s'); await wait(60); };
    ctx.Sound.stop(); run('state.rand = () => 0'); spoken.length = 0;
    store.audiosets = [mkSet({ firstlap: { lines: [line('MARK for Alex {driver}', { driver: 'd1' })] } })];
    await lapRace('CD1');
    say('a sentence for one driver is said for him and for nobody else (the call has no other sentence)', marks().join() === 'MARK for Alex Alex', marks().join());
    ctx.Sound.stop(); spoken.length = 0; store.audiosets = [mkSet({ firstlap: { lines: [line('MARK plain {driver}'), line('MARK special {driver}', { driver: 'd2' })] } })];
    await lapRace('CD2');
    say('...a sentence for Sam wins over the plain one for him; Alex gets the plain one', marks().sort().join() === 'MARK plain Alex,MARK special Sam', marks().join());
    ctx.Sound.stop(); spoken.length = 0; store.audiosets = [mkSet({ firstlap: { lines: [line('MARK {driver}', { top: 1 })] } })];
    await lapRace('CD3');
    say('only in the top 1: said for the driver in front, not for the one behind (the position is that of the race)', marks().join() === 'MARK Alex', marks().join());
    ctx.Sound.stop(); spoken.length = 0; store.audiosets = [mkSet({ firstlap: { cooldown: 600, lines: [line('MARK {driver}')] } })];
    await lapRace('CD4');
    say('not again within 600 seconds: the first lap of the second driver is held back', marks().join() === 'MARK Alex', marks().join());
    spoken.length = 0; await lapRace('CD5');
    say('...and a new race starts without any wait', marks().join() === 'MARK Alex', marks().join());
    ctx.Sound.stop(); spoken.length = 0; store.audiosets = [mkSet({ firstlap: { cooldown: 600, coolFor: 'driver', lines: [line('MARK {driver}')] } })];
    await lapRace('CD6');
    say('...counted for each driver, both are said', marks().sort().join() === 'MARK Alex,MARK Sam', marks().join());
    ctx.Sound.stop(); spoken.length = 0; store.audiosets = keepSets; run('state.rand = null'); E('sim').checked = false; // (as before this block)
  }

  // ---------- Trackmate: sensors count laps, Trackcall flags the race ----------
  const feed = str => run(`Trackmate.link.feed(Array.from(${JSON.stringify(str)}, c => c.charCodeAt(0)))`);
  const quiet = () => feed('200\n\r200\n\r200\n\r');
  run('Trackmate.link.setConnected(false)');
  await openRace({ name: 'TM', sessionType: 'practice', layout: 'C1', lightsMin: 0, lightsMax: 0 }, store.tracks[0], rows(1, 2));
  say('the race screen says the Trackmate is not connected', E('tmstatus').textContent.includes('Trackmate not connected'));
  run('Trackmate.link.setConnected(true)'); say('...and connected once it is', E('tmstatus').textContent.includes('Trackmate connected'));
  // 1.39.0: one timing hardware at a time. The Trackmate counts laps only when it is the one that was chosen.
  { run('live.leave && live.leave()'); await wait(20);
    for (const other of ['arduino', 'none']) {
      run(`state.settings.timingHw = '${other}'`);
      await openRace({ name: 'TM-' + other, sessionType: 'practice', layout: 'C1', lightsMin: 0, lightsMax: 0 }, store.tracks[0], rows(1, 2));
      key(' '); await until(() => phase() === 'running'); await wait(60);
      feed('150\n\rA'); await wait(40); feed('200\n\r56\n\rA'); await wait(40);
      say(`1.39.0: with ${other === 'none' ? 'no timing hardware' : 'the Arduino box'} chosen a connected Trackmate counts no laps`, run('live.engine().cars[0].laps.length') === 0 && run('live.engine().cars[1].laps.length') === 0);
      feed('W'); say('...and its Trackcall button does nothing', run('live.engine().flag') === '');
      say('...the status line names the hardware that was chosen, not the Trackmate', other === 'none' ? E('tmstatus').textContent.includes('No timing hardware chosen') : E('tmstatus').textContent.includes('Arduino box not connected'), E('tmstatus').textContent);
      run('live.leave && live.leave()'); await wait(20);
    }
    run('delete state.settings.timingHw; Trackmate.link.setConnected(false); Trackmate.link.setConnected(true)'); // (as before this block: nothing chosen is the Trackmate, connected anew so no sensor is held)
    await openRace({ name: 'TM', sessionType: 'practice', layout: 'C1', lightsMin: 0, lightsMax: 0 }, store.tracks[0], rows(1, 2)); }
  key(' '); await until(() => phase() === 'running'); await wait(60);
  feed('150\n\rA'); await wait(40); feed('200\n\r56\n\rA'); feed('200\n\r56\n\rA'); await wait(40);
  say('sensor hits count laps for their lane (a held sensor is one crossing)', run('live.engine().cars[0].laps.length') === 1 && run('live.engine().cars[1].laps.length') === 0);
  quiet(); feed('120\n\rA'); await wait(40); feed('120\n\rB'); await wait(40);
  say('a second pass counts again, and lane 2 is the second car', run('live.engine().cars[0].laps.length') === 2 && run('live.engine().cars[1].laps.length') === 1);
  run("state.settings.tmLaneMap = [1, 0, 2, 3, 4, 5, 6, 7]"); const l0 = run('live.engine().cars[0].laps.length'), l1 = run('live.engine().cars[1].laps.length');
  quiet(); feed('120\n\rA'); await wait(40);
  say('with sensors 1 and 2 swapped, sensor A counts for lane 2', run('live.engine().cars[1].laps.length') === l1 + 1 && run('live.engine().cars[0].laps.length') === l0);
  run("state.settings.tmLaneMap = undefined");
  feed('W'); say('Trackcall once: yellow flag', run('live.engine().flag') === 'yellow');
  feed('W'); say('...a second press at once: red flag, the race is stopped', run('live.engine().flag') === 'red' && phase() === 'paused');
  feed('W'); say('...a press while stopped starts the race again', run('live.engine().flag') === '' && phase() === 'running');
  feed('W'); await wait(120); feed('W'); say('presses further apart than the window are two single presses (yellow on, then off)', run('live.engine().flag') === '');
  run('live.trackcall'); key('s'); await wait(100);
  run('Trackmate.link.setConnected(false)');
  // Trackcall as the track power switch
  const sentTm = []; run('globalThis.__tm = []; hw.writer = { write: async b => { __tm.push(Array.from(b).map(x => String.fromCharCode(x)).join("").trim()); } }; Trackmate.link.setConnected(true)');
  await openRace({ name: 'TM3', sessionType: 'practice', layout: 'C1', lightsMin: 0, lightsMax: 0, trackcall: 'power' }, store.tracks[0], rows(1, 2));
  await wait(450); run('globalThis.__tm.length = 0'); // the setup that is sent when the race opens
  feed('W'); await wait(150); feed('W'); await wait(150); feed('W'); await wait(150);
  say('Trackcall as power switch: off, on, off (normally open relay: E = on, R = off), no flags', run('__tm.join()') === 'R,E,R' && run('live.engine().flag') === '' && E('tmstatus').textContent.includes('track power off'));
  run('state.settings.tmRelayNC = true; globalThis.__tm.length = 0'); run('Trackmate.link.setPower(null)'); feed('W'); await wait(150);
  say('...and with a normally closed relay the commands are the other way round', run('__tm.join()') === 'E');
  run('state.settings.tmRelayNC = undefined'); key('s'); await wait(60);
  // power off at the start, on at lights out
  await openRace({ name: 'TM4', sessionType: 'practice', layout: 'C1', lightsMin: 0, lightsMax: 0, trackcall: 'none', startPower: 'off' }, store.tracks[0], rows(1, 2));
  await wait(450); say('startPower off: the power is switched off when the race screen opens (normally open relay: R = off)', run('__tm.slice(-1)[0]') === 'R');
  key(' '); await until(() => phase() === 'running'); await wait(100);
  say('...and comes on when the lights go out (E = on)', run('__tm.slice(-1)[0]') === 'E' && run('Trackmate.link.power') === true); key('s'); await wait(60);
  // Trackcall choices that cut the power
  for (const [mode, presses, expectFlag, expectCmds] of [['redcut', 1, 'red', 'R'], ['redcut', 2, '', 'R,E'], ['yellowcut', 1, 'yellow', 'R'], ['yellowcut', 2, '', 'R,E'], ['yellowredcut', 1, 'yellow', ''], ['yellowredcut', 2, 'red', 'R']]) {
    await openRace({ name: 'TM5', sessionType: 'practice', layout: 'C1', lightsMin: 0, lightsMax: 0, trackcall: mode }, store.tracks[0], rows(1, 2));
    await wait(450); key(' '); await until(() => phase() === 'running'); await wait(120); run('globalThis.__tm.length = 0');
    for (let n = 0; n < presses; n++) { feed('W'); if (mode !== 'yellowredcut') await wait(120); } await wait(150);
    say(`Trackcall "${mode}", ${presses} press(es): flag "${expectFlag || 'none'}", power commands "${expectCmds || 'none'}"`, run('live.engine().flag') === expectFlag && run('__tm.join()') === expectCmds); key('s'); await wait(100);
  }
  run('Trackmate.link.setConnected(false)');
  for (const [mode, expect] of [['yellow', 'yellow'], ['red', 'red'], ['none', '']]) {
    await openRace({ name: 'TM2', sessionType: 'practice', layout: 'C1', lightsMin: 0, lightsMax: 0, trackcall: mode }, store.tracks[0], rows(1, 2));
    key(' '); await until(() => phase() === 'running'); await wait(40); feed('W');
    say(`Trackcall set to "${mode}" does that`, run('live.engine().flag') === expect); if (mode === 'red') feed('W'); key('s'); await wait(60);
  }

  // ---------- restart after a red flag: the start lights count down again ----------
  await openRace({ name: 'RR', sessionType: 'practice', layout: 'C1', lightsMin: 0, lightsMax: 0, restartAfterRed: 'countdown' }, store.tracks[0], rows(1, 2));
  key(' '); await until(() => phase() === 'running'); await wait(40);
  key('r'); say('red flag: the race is stopped', phase() === 'paused' && run('live.engine().flag') === 'red');
  key('r'); say('lifting the red flag starts the lights again, the race stays stopped', phase() === 'countdown' && run('live.engine().flag') === 'red' && run('live.engine().status') === 'paused');
  key('1'); say('a car crossing during the restart is not counted', run('live.engine().cars[0].laps.length') === 0);
  key('y'); say('a yellow flag during the restart does nothing', run('live.engine().flag') === 'red');
  await until(() => phase() === 'running'); say('at lights out the red flag is gone and the race runs on', phase() === 'running' && run('live.engine().flag') === '' && run('live.engine().status') === 'running' && run('live.lights') === 0);
  key('r'); key('r'); await wait(30); key('r'); say('red again during the restart cancels it: the race stays under the red flag', phase() === 'paused' && run('live.engine().flag') === 'red' && run('live.lights') === 0);
  await wait(400); say('...and nothing starts later', phase() === 'paused');
  key('r'); await until(() => phase() === 'running'); say('...a new restart works', phase() === 'running');
  key('s'); await wait(60);
  spoken.length = 0; run('state.rand = () => 0');
  await openRace({ name: 'RR3', sessionType: 'practice', layout: 'C1', lightsMin: 0, lightsMax: 0, restartAfterRed: 'countdown', audioSet: 'AU1' }, store.tracks[0], rows(1, 2));
  key(' '); await until(() => phase() === 'running'); await wait(50); key('r'); await wait(30); spoken.length = 0; key('r');
  await wait(30); say('during a restart the Race Flag widget keeps showing the red flag, not a countdown', phase() === 'countdown' && flagIs('Red flag'));
  await until(() => phase() === 'running'); await wait(50);
  say('a restart after a red flag is announced with lights out, but not with the pre-race call', !spoken.includes('Ready now') && spoken.includes('Away we go')); key('s'); await wait(60); run('state.rand = null');
  await openRace({ name: 'RR2', sessionType: 'practice', layout: 'C1', lightsMin: 0, lightsMax: 0 }, store.tracks[0], rows(1, 2));
  key(' '); await until(() => phase() === 'running'); key('r'); key('r'); say('with "the race goes on at once" the red flag is lifted straight away', phase() === 'running'); key('s'); await wait(60);

  // ---------- leaving the race screen before the start: the race keys stop working on other pages ----------
  await openRace({ name: 'Leave', sessionType: 'practice', layout: 'C1' }, store.tracks[0], rows(1, 2));
  say('on the race screen the race keys and the F key are active', keyListeners.size === 2 && phase() === 'ready');
  run("state.tab='home'"); await run('render()'); await wait(30);
  say('after leaving the race screen no key handler is left', keyListeners.size === 0 && run('live.offTm') === null && run('live.offCmd') === null);
  await openRace({ name: 'Back', sessionType: 'practice', layout: 'C1' }, store.tracks[0], rows(1, 2));
  say('coming back works again: the two key handlers, race ready', keyListeners.size === 2 && phase() === 'ready'); key('s'); run("state.tab='home'"); await run('render()'); await wait(30);

  // ---------- the fullscreen widget view of the race screen ----------
  await openRace({ name: 'Fullscreen', sessionType: 'practice', layout: '' }, store.tracks[0], rows(1, 2));
  { const emit = (k, o = {}) => [...keyListeners].forEach(f => f({ key: k, target: { matches: () => false }, preventDefault() {}, ...o })), btn = () => E('fsbtn'), clickBtn = () => btn().onclick({ currentTarget: { blur() {} } });
    const k0 = keyListeners.size; say('the race screen listens for two things: the race keys and F (and nothing else)', k0 === 2);
    const opened = () => !!run('live.fsView');
    say('the race screen has a Full screen widgets button in the bar under the page, and the hint says F opens the view and Esc closes it', E('racehost').innerHTML.includes('id="fsbtn"') && E('racehost').innerHTML.includes('>Full screen widgets</button>') && /F shows the widgets full screen \(Esc closes it\)/.test(E('racehost').innerHTML));
    say('the view is closed at the start', !opened() && typeof btn().onclick === 'function');
    clickBtn(); await wait(20);
    say('the button opens the view: the widgets of the layout again, without any button', opened() && run('live.fsView.nodes.length') > 0 && run('live.fsView.nodes').every(n => !run('Widgets.def')(n.w.type).button));
    say('...in a layer over the whole page, with a way out; it lives in the page (document.body)', document.body.appended.includes(run('live.fsView.root')) && run('live.fsView.root.className') === 'fullview');
    say('...and the window goes full screen too', fsCalls.at(-1) === true);
    await wait(250);
    say('the widgets of the view are painted like those of the race screen (here: the names of the drivers)', run("live.fsView.nodes.find(n => n.w.type === 'name' && n.w.lane === 0)").val.innerHTML === 'Alex');
    say('the race screen keeps its own widgets, and the view has its own copies', run('live.fsView.nodes[0].el') !== run('live.nodes[0].el'));
    emit('Escape'); say('Esc closes the view, and the window goes back as it was', !opened() && fsCalls.at(-1) === false);
    say('...the key listeners are the same as before (Esc stops being listened for)', keyListeners.size === k0);
    emit('f'); say('F opens the view', opened()); await wait(10);
    emit('F'); await wait(10); say('F again closes it (capital F too), and the window goes back as it was', !opened() && fsCalls.at(-1) === false);
    clickBtn(); await wait(10); clickBtn(); say('the button also closes it', !opened());
    fsWas = true; clickBtn(); await wait(20); emit('Escape'); await wait(10); say('a window that was full screen already stays full screen when the view closes', !opened() && fsCalls.at(-1) === true); fsWas = false;
    const before = fsCalls.length; run('live.fsKey')({ key: 'f', target: { matches: () => true } }); say('F typed into a text field does nothing', !opened() && fsCalls.length === before);
    emit('f', { ctrlKey: true }); emit('f', { altKey: true }); emit('f', { metaKey: true }); say('Ctrl+F, Alt+F and Cmd+F do nothing', !opened());
    emit('Escape'); say('Esc without the view does nothing', !opened());
    const phaseBefore = phase(); emit('f'); say('the race itself is not touched by opening the view (no flag, no pause, no stop)', opened() && phase() === phaseBefore); emit('Escape');
    emit('f'); run("state.tab='home'"); await run('render()'); await wait(30);
    say('leaving the race screen closes the view, and no key handler is left (F stops being listened for)', !opened() && keyListeners.size === 0);
    emit('f'); say('...F does nothing any more', !run('live.fsView'));
  }

  // ---------- 0.99.0: the yellow flag target lap time, on the race screen ----------
  {
    const mkSet = calls => ({ id: 'AUY', name: 'Yellow', rate: 1, pitch: 1, volume: 1, driverBy: 'name', calls: Object.fromEntries(Object.entries(calls).map(([id, t]) => [id, { on: true, lines: [{ text: t, file: '' }] }])) });
    const marks = () => spoken.filter(t => t.startsWith('MARK')), keepSets = store.audiosets, keepPS = store.penaltysystems, E2 = () => run('live.engine()');
    store.penaltysystems = [{ id: 'py', name: 'Y', timeRule: 'every', everyPoints: 5, everySeconds: 5, dqPoints: 12 }];
    store.audiosets = [mkSet({ yellowflag: 'MARK flag', yellowtarget: 'MARK target {target}', yellowfast: 'MARK fast {driver} {time} {target}', penalty: 'MARK pen {driver} {points}' })];
    ctx.Sound.stop(); run('state.rand = () => 0'); spoken.length = 0;
    await openRace({ name: 'YT', sessionType: 'practice', layout: '', lightsMin: 0, lightsMax: 0, audioSet: 'AUY', penaltySystem: 'py', yellowTarget: 15, yellowPoints: 1 }, store.tracks[0], rows(1, 2));
    key(' '); await until(() => phase() === 'running', 3000); await wait(60);
    say('the race has the target of the setup: 15 seconds and 1 point, in milliseconds', E2().yellow.target === 15000 && E2().yellow.points === 1 && E2().cfg.yellow.target === 15000);
    key('y'); await wait(150);
    say('the yellow flag says the flag and then the target, as the audio set has them', marks().join() === 'MARK flag,MARK target 15 seconds', marks().join());
    spoken.length = 0; key('1'); await wait(150);
    say('a lap that began before the yellow flag is not called out', marks().length === 0 && E2().cars[0].points === 0, marks().join());
    await wait(60); key('1'); await wait(200);
    say('the next lap, a full lap under yellow and much faster than 15 seconds, is called out with the driver, the time and the target, and the penalty point after it', marks().length === 2 && /^MARK fast Alex \d+\.\d\d 15 seconds$/.test(marks()[0]) && marks()[1] === 'MARK pen Alex 1', marks().join(' | '));
    say('...the driver has the point, and the lap is marked in the race', E2().cars[0].points === 1 && E2().cars[0].yellowFast.join() === '1' && E2().cars[1].points === 0);
    E('lapsbtn').onclick({}); E('lapreview').onclick({ target: { closest: () => ({ dataset: { rv: 'laps', car: '0' } }) } });
    say('the lap review shows the mark on that lap, and only on that lap', E('lapreview').innerHTML.split('class="rv-lap').filter(x => x.includes('faster than the yellow flag target')).length === 1);
    key('s'); await wait(60); ctx.Sound.stop(); spoken.length = 0;
    // a race without a target: only the yellow flag call
    await openRace({ name: 'YT0', sessionType: 'practice', layout: '', lightsMin: 0, lightsMax: 0, audioSet: 'AUY', penaltySystem: 'py' }, store.tracks[0], rows(1, 2));
    key(' '); await until(() => phase() === 'running', 3000); await wait(60); key('y'); await wait(60); key('1'); await wait(60); key('1'); await wait(200);
    say('a race without a target: the yellow flag call only, and fast laps are not judged', marks().join() === 'MARK flag' && E2().cars[0].points === 0 && E2().yellow.target === 0, marks().join());
    key('s'); await wait(60); ctx.Sound.stop(); spoken.length = 0;
    // a target, but no penalty system: called out, no point
    await openRace({ name: 'YT1', sessionType: 'practice', layout: '', lightsMin: 0, lightsMax: 0, audioSet: 'AUY', yellowTarget: 15 }, store.tracks[0], rows(1, 2));
    key(' '); await until(() => phase() === 'running', 3000); await wait(60); key('y'); await wait(60); key('1'); await wait(60); key('1'); await wait(200);
    say('a target without a penalty system: the lap is called out, and no point is given or called', marks().filter(t => t.startsWith('MARK fast')).length === 1 && marks().every(t => !t.startsWith('MARK pen')) && E2().cars[0].points === 0 && E2().cars[0].yellowFast.length === 1, marks().join(' | '));
    key('s'); await wait(60); ctx.Sound.stop(); spoken.length = 0;
    store.audiosets = keepSets; store.penaltysystems = keepPS; run('state.rand = null');
  }

  // ---------- 1.1.0: the race keeps running while another tab is shown ----------
  { const parked = [], tabs = () => run("tabsNow().map(t => t[0]).join()"), shown = () => (parked.length ? parked[parked.length - 1][1] === false : null);
    E('racehost').classList = { toggle: (c, on) => parked.push([c, on]), add() {}, remove() {} };
    run('if (live && live.leave) live.leave()'); const k0 = keyListeners.size; // (the keys of the race that was left over from above are taken off first)
    // a race that has not started: it has its tab while it is open, and leaving it closes it as it always did
    await openRace({ name: 'Away0', sessionType: 'practice', layout: '', lightsMin: 0, lightsMax: 0 }, store.tracks[0], rows(1, 2));
    say('the race screen is shown in its own place (the other screens are hidden), and the race has a Race tab, placed before Live Race', shown() === true && E('view').hidden === true && tabs() === 'home,database,setup,custom,settings,rules,race,live' && run('raceKept()') === true && run('raceTabTitle()').includes('not started yet'));
    say('...its page is in the race place and the keys are on', E('racehost').innerHTML.includes('id="canvas"') && keyListeners.size === k0 + 2);
    run("state.tab = 'home'"); await run('render()');
    say('leaving a race that has not started closes it: no race screen, no Race tab, no keys', run('live.alive') === false && E('racehost').innerHTML === '' && tabs() === 'home,database,setup,custom,settings,rules,live' && keyListeners.size === k0 && shown() === false && E('view').hidden === false);
    // a race that is on
    await openRace({ name: 'Away', sessionType: 'practice', layout: '', lightsMin: 0, lightsMax: 0 }, store.tracks[0], rows(1, 2));
    key(' '); await until(() => phase() === 'running', 3000); await wait(60);
    const laps = lane => run(`live.engine().cars[${lane}].laps.length`), canvasHtml = E('racehost').innerHTML;
    say('the Back button is off while the race runs', E('back').disabled === true);
    run("state.tab = 'home'"); await run('render()');
    say('another tab is shown while the race runs: the race goes on, its page is kept and parked, and the Race tab is there', phase() === 'running' && run('live.alive') === true && E('racehost').innerHTML === canvasHtml && shown() === false && E('view').hidden === false && tabs().includes('rules,race,live') && run('raceTabTitle()').includes('running'));
    say('...the keys of the race are off on the other tab (Space does not pause, the lane key does not count a lap)', (key(' '), key('1'), phase() === 'running' && laps(0) === 0));
    [...keyListeners].forEach(f => f({ key: 'f', target: { matches: () => false }, preventDefault() {} }));
    say('...F (full screen view) does nothing on the other tab either', !run('live.fsView'));
    say('...the keys are still listening, so they work again when the race tab is shown', keyListeners.size === k0 + 2);
    await wait(60); run("Trackmate.link.emit({ type: 'hit', lane: 0, at: performance.now() })"); await wait(30);
    say('...the Trackmate still counts laps while another tab is shown', laps(0) === 1 && laps(1) === 0);
    api.liveCommand({ type: 'yellow' }); await wait(30);
    say('...and the Race Director (Live Race window) still controls it', run('live.engine().flag') === 'yellow');
    api.liveCommand({ type: 'yellow' });
    const sentN = sent.n; await wait(1300);
    say('...it keeps sharing the race with the Live Race pages', sent.n > sentN && sent.dyn && sent.dyn.phase === 'running');
    { const was = run('live.raceRef'), keepSetups = store.racesetups; store.racesetups = [{ id: 'k-prac', name: 'Free', sessionType: 'practice', track: 't1', layout: '' }];
      run("state.settings = { ...state.settings, lastSetupId: 'k-prac', assignments: { 'k-prac': [{ driverId: 'd1', carId: 'c1' }, { driverId: 'd2', carId: 'c2' }] } }; state.tab = 'home'"); await run('render()'); const home = E('view').innerHTML;
      say('Home says a race is running and offers the way back, and Start is off while it runs', home.includes('id="raceon"') && home.includes('id="gorace"') && /id="start" disabled/.test(home) && home.includes('Open the Race tab to finish or stop it first'));
      await E('view').onclick({ target: { closest: () => ({ id: 'start', dataset: {} }) } }); await wait(60);
      say('...a click on Start does nothing: the race that runs stays the race (no second race is built)', run('state.tab') === 'home' && run('live.raceRef') === was && phase() === 'running' && run('live.alive') === true);
      await E('view').onclick({ target: { closest: () => ({ id: 'gorace', dataset: {} }) } }); await wait(60);
      say('...Go to the race brings you back to it', run('state.tab') === 'race' && E('racehost').innerHTML === canvasHtml && run('live.raceRef') === was);
      run("state.tab = 'home'"); await run('render()'); store.racesetups = keepSetups; }
    // coming back
    run("live.nodes.find(n => n.w.type === 'lap' && n.w.lane === 0).val.innerHTML = 'STALE'"); // (a widget that shows something old, with nothing to say it changed)
    run("state.tab = 'race'"); await run('render()');
    say('the Race tab shows the same race again: nothing is built a second time, the race page is shown and the other screens are hidden', phase() === 'running' && run('live.alive') === true && E('racehost').innerHTML === canvasHtml && shown() === true && E('view').hidden === true && laps(0) === 1);
    say('...every widget is drawn again as soon as the tab is shown (also one that had not changed)', !run("live.nodes.find(n => n.w.type === 'lap' && n.w.lane === 0).val.innerHTML").includes('STALE'));
    say('...and the keys work again', (key('1'), laps(0) === 2 || laps(0) === 1) && (await wait(60), key('1'), laps(0) >= 2));
    say('...everything is drawn again when it is shown (the widgets show the lap of the race as it is now)', run("live.nodes.find(n => n.w.type === 'lap' && n.w.lane === 0).val.innerHTML").startsWith(String(laps(0) + 1)));
    // the end of the race, away from the screen
    key('s'); await wait(100);
    say('...and on again when the race is over', E('back').disabled === false);
    run("state.tab = 'home'"); await run('render()');
    say('stopping the race and then leaving it closes the race screen (the Race tab is gone)', phase() === 'finished' && run('live.alive') === false && E('racehost').innerHTML === '' && !tabs().includes('race,'));
    key(' '); await wait(30);
    say('...and nothing is listening to the keys any more', keyListeners.size === k0);
    { const keepSetups = store.racesetups; store.racesetups = [{ id: 'k-prac', name: 'Free', sessionType: 'practice', track: 't1', layout: '' }]; run("state.tab = 'home'"); await run('render()'); const home = E('view').innerHTML;
      say('with no race on, Home has no race notice and Start is on', /id="start"/.test(home) && !home.includes('id="raceon"') && !/id="start" disabled/.test(home)); store.racesetups = keepSetups; }
  }

  // 1.39.1: a simulated car that is in the pit when the race is paused drives off again after the resume (the pause stopped its timer)
  { run('state.autoFinalize = false'); store.laps = []; saved.length = 0;
    await openRace({ name: 'Fuel', sessionType: 'practice', layout: '', lightsMin: 0, lightsMax: 0, fuel: 'on', fuelTank: 3, fuelPerLap: 1, fuelRate: 100, fuelEmpty: 'retire', pitHold: 0.05 }, store.tracks[0], rows(1, 2));
    E('sim').checked = true; key(' '); await until(() => phase() === 'running');
    const en = () => run('live.engine()');
    await until(() => en().cars.some(c => c.blockAt !== null), 15000);
    const idx = en().cars.findIndex(c => c.blockAt !== null);
    key(' '); await wait(150); key(' ');
    await until(() => en().cars[idx].blockAt === null, 6000);
    say('a simulated car in the pit during a pause drives off after the resume (it used to stay there and run out of fuel)', idx >= 0 && en().cars[idx].blockAt === null && !en().cars[idx].retired);
    key('s'); await wait(100); E('sim').checked = false; }

  // 1.39.1: the announcer of the next heat knows the laps of the heats that are done (a record of heat 1 is not a record again in heat 2)
  { run('state.autoFinalize = true'); store.laps = []; saved.length = 0;
    await openRace({ name: 'Heats', sessionType: 'heats', heatBy: 'laps', laps: 2, endRule: 'all', heatPlan: 'roundrobin', resultBy: 'points', points: '10, 8, 6', layout: '' }, store.tracks[0], rows(1, 2, 3));
    say('before the first heat the announcer starts from the records of the database only', run('live.annBase().track') === Infinity && run('live.annBase().personal.size') === 0);
    E('sim').checked = true; key(' '); await until(() => ['between', 'finished'].includes(phase()), 20000);
    say('...after heat 1 the base for the next heat holds the best laps of heat 1 (the track record and a best lap per driver)', phase() === 'between' && Number.isFinite(run('live.annBase().track')) && run('live.annBase().track') === run('live.priorAll') && run('live.annBase().personal.size') >= 1);
    let m = 0; while (phase() !== 'finished' && m++ < 6) { key(' '); await until(() => ['between', 'finished'].includes(phase())); } E('sim').checked = false; }

  console.log(fails ? fails + ' LIVE PAGE TESTS FAILED' : 'ALL LIVE PAGE TESTS PASSED'); process.exit(fails ? 1 : 0);
})();
