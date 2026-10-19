// Runs Time Token Sessions through the live timing page against a stand-in for the app window.
const vm = require('vm'), fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..') + '/';
const schema = require(R + 'schema.js');
let fails = 0;
process.on('unhandledRejection', e => { console.log('UNHANDLED:', e.stack || e.message); process.exit(1); });
const mk = () => new Proxy({ innerHTML: '', style: {}, dataset: {}, hidden: false, value: '', checked: false, disabled: false, classList: { add() {}, remove() {}, toggle() {} } },
  { get: (t, k) => (k in t ? t[k] : () => mk()), set: (t, k, v) => { t[k] = v; return true; } });
const els = {};
const keyListeners = new Set(); const document = { addEventListener(t, f) { if (t === 'keydown') keyListeners.add(f); }, removeEventListener(t, f) { if (t === 'keydown') keyListeners.delete(f); }, querySelector: () => mk(), querySelectorAll: () => [mk(), mk(), mk()],
  getElementById: id => els[id] || (els[id] = mk()), documentElement: { dataset: {}, style: { setProperty() {} } }, body: { contains: () => true }, createElement: () => mk() };
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
  liveGet: async () => JSON.parse(JSON.stringify({ stat: sent.stat, dyn: sent.dyn })), onLive: f => { cbs.dyn.push(f); return () => {}; }, onLiveStatic: f => { cbs.stat.push(f); return () => {}; }, liveOpen: async () => ({ second: true }), liveCommand: c => { cmds.push(c); cbs.cmd.forEach(f => f(JSON.parse(JSON.stringify(c)))); }, onCommand: f => { cbs.cmd.push(f); return () => { cbs.cmd = cbs.cmd.filter(x => x !== f); }; },
  schema: async () => schema, getSettings: async () => ({ theme: 'dark', rules: 'Be kind. No bumping.' }), setSettings: async p => ({ ...(ctx.__ready ? vm.runInContext('state.settings', ctx) : {}), ...p }), dbPath: async () => 'x',
  list: async e => JSON.parse(JSON.stringify(store[e] || [])), customFields: async () => [], linkedLaps: async () => 0,
  saveSession: async (s, l) => { saved.push([s, l]); }, add: async () => ({}), update: async () => ({}), remove: async () => {} };
// the app reports a screen that could not be drawn with console.error: that is a failed test (unless the test expects it)
const appConsole = { ...console, expected: false, seen: 0, error: (...a) => { if (appConsole.expected) { appConsole.seen++; return; } console.log('FAIL the app reported an error: ' + a.map(x => (x && x.stack) || x).join(' ').slice(0, 300)); fails++; } };
// the real app passes everything through Electron's structured clone, which refuses a function ("An object could not be cloned"): every call of the app interface is checked the same way here
for (const k of Object.keys(api)) { const f = api[k]; if (typeof f === 'function') api[k] = (...x) => { x.forEach(v => { if (typeof v !== 'function') structuredClone(v); }); return f(...x); }; }
const ctx = vm.createContext({ document, api, console: appConsole, Intl, URL, Image: function () {}, confirm: () => true, alert() {}, setTimeout, clearTimeout, setInterval, clearInterval, performance });
ctx.__ready = true; ctx.window = ctx; ctx.addEventListener = () => {}; ctx.removeEventListener = () => {};
for (const f of ['listnum.js', 'bop.js', 'weather.js', 'tyrewear.js', 'safetycar.js', 'pushsave.js', 'endurance.js', 'failures.js', 'damage.js', 'engine.js', 'heats.js', 'rotation.js', 'championship.js', 'champpoints.js', 'tokens.js', 'speed.js', 'distance.js','stats.js','homestats.js','carstats.js','viewset.js','picture.js','uiscale.js','depth.js','theme.js','banner.js', 'icons.js', 'delta.js','avatars.js', 'weatherwidgets.js', 'tyrewidgets.js', 'pacewidgets.js', 'boardorder.js', 'widgets.js', 'frame.js', 'backdrop.js','announcer.js','sound.js', 'timing.js', 'rows.js', 'richtext.js', 'canvas.js', 'liveshare.js', 'review.js', 'adjustpad.js', 'adjustui.js', 'dirfolder.js', 'penaltyui.js', 'rotationdrag.js','padui.js','livegrid.js', 'homegrid.js', 'drivergrid.js', 'homecards.js', 'liveview.js', 'database.js', 'landing.js', 'race.js', 'undo.js', 'editor.js','tokenui.js', 'bopui.js', 'weatherui.js', 'tyreui.js', 'pushsaveui.js', 'rotationui.js', 'championshipui.js', 'audioedit.js','widgetbuilder.js','transferui.js','themeui.js','hardware.js','trackmate.js','hardwareui.js', 'dsui.js', 'app.js']) vm.runInContext(fs.readFileSync(R + 'renderer/' + f, 'utf8'), ctx, { filename: f });
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
  await wait(50); run('state.autoFinalize = true'); ctx.__sent = sent;
  const setupTok = { id: 's-tok', name: 'Club night', sessionType: 'tokens', layout: '' };
  const tk = lane => run(`live.nodes.find(n=>n.w.type==='tokenclock'&&n.w.lane===${lane})`);
  const clockOf = lane => tk(lane).val.innerHTML;
  const lastOf = (type, lane) => JSON.parse(run(`live.nodes.find(n=>n.w.type==='${type}'&&n.w.lane===${lane}).last`)); // [html, colour, background, disabled] as it was painted
  const bgOf = (type, lane) => lastOf(type, lane)[2], colorOf = (type, lane) => lastOf(type, lane)[1];
  const ops = () => run('live.tokenOps');
  const eng = () => run('live.engine()');
  const tokens = () => run('live.tokens');
  const tokSessions = () => saved.filter(([s]) => s.sessionType === 'tokens');
  const kept = () => (run('state.settings').tokenSessions || {})[setupTok.id];
  run("state.settings = { theme: 'dark', tokenWarnSeconds: 0.6, tokenWarnColor: '#ffb300', tokenOutColor: '#d62828' }");

  // ---------- opening the session ----------
  await openRace(setupTok, store.tracks[1], rows(1, 2)); // 4 lanes, only two have a driver
  say('a token session runs on the free practice engine, with a car for every lane of the track', eng().type === 'practice' && eng().cars.length === 4);
  say('lanes without a driver are Guests, the others have theirs', eng().cars.map(c => c.driverName).join() === 'Alex,Sam,Guest,Guest');
  say('the default token layout is used: a Token Clock for each of the 4 lanes', run("live.nodes.filter(n=>n.w.type==='tokenclock').length") === 4 && run('live.nodes.every(n => n.w.lane === null || n.w.lane < 4)'));
  say('nothing is sold yet: every lane is idle and dimmed, nothing is red', [0, 1, 2, 3].every(l => clockOf(l) === '00:00' && colorOf('tokenclock', l) === 'var(--muted)' && !bgOf('name', l)));
  say('the lane controls are on the page; there are no pit buttons', !!run('live.tkPanel') && run('live.pitBtns.length') === 0);
  key(' ');
  say('no start lights: Space opens the session at once', phase() === 'running');
  say('a Time Token Session has no Adjust panel (the pads are for races): no folder, no panel', !run('live.adjPanel') && !E('racehost').innerHTML.includes('data-dirf="adjust"') && !E('racehost').innerHTML.includes('id="adjpanel"'));
  key('1'); key('1');
  say('a crossing on a lane without time is ignored', eng().cars[0].laps.length === 0 && eng().cars[0].started === false);

  // ---------- selling time ----------
  say('adding time switches the lane on', ops().add(0, 0.02) === true && clockOf(0) === '00:02' && !bgOf('tokenclock', 0) && colorOf('tokenclock', 0) !== 'var(--muted)');
  say('...only that lane', clockOf(1) === '00:00' && colorOf('tokenclock', 1) === 'var(--muted)');
  say('nothing is added for no amount or for a lane the track does not have', ops().add(0, 0) === false && ops().add(9, 5) === false && ops().add(0, -1) === false);
  await wait(60); key('1'); await wait(60); key('1');
  say('on a lane with time the first crossing starts the timing, the next one is a lap', eng().cars[0].laps.length === 1 && tokens().stintOf(0).laps.length === 1 && tokens().stintOf(0).laps[0].late === false);
  say('the first stint is not saved while it is going on', tokSessions().length === 0);
  await until(() => lastOf('tokenclock', 0)[2] === '#ffb300', 3000);
  say('almost out of time: the Token Clock turns amber, nothing else on the lane does', bgOf('tokenclock', 0) === '#ffb300' && colorOf('tokenclock', 0) === '#000' && !bgOf('name', 0));
  await until(() => bgOf('name', 0) === '#d62828', 3000);
  say('time is up: every widget of the lane turns red, with white text', ['tokenclock', 'name', 'bestlap', 'lastlap', 'textlane'].every(t => bgOf(t, 0) === '#d62828' && colorOf(t, 0) === '#fff'));
  say('...the other lanes stay as they were', !bgOf('name', 1) && !bgOf('tokenclock', 1) && !bgOf('name', 2));
  say('...and the clock reads 00:00', clockOf(0) === '00:00');
  await wait(60); key('1');
  say('a lap after the time is up is recorded, marked late and kept out of the best lap', eng().cars[0].laps.length === 2 && eng().cars[0].invalid.join() === '1' && tokens().stintOf(0).laps[1].late === true && eng().cars[0].best === eng().cars[0].laps[0]);
  say('...it does not light up as a record or a personal best', !run('live.flash.has(live.engine().cars[0])') || run('live.flash.get(live.engine().cars[0]).time') === eng().cars[0].laps[0]);

  // ---------- buying more time on a lane that is out: a new stint ----------
  say('adding time to a lane that is out starts again from now', ops().add(0, 0.02) === true && clockOf(0) === '00:02' && !bgOf('name', 0) && eng().cars[0].laps.length === 0 && eng().cars[0].best === null);
  await wait(150);
  const h1 = tokens().closedList()[0];
  say('the stint that ended is held for the review at the end: it is not saved yet', tokSessions().length === 0 && tokens().closedList().length === 1 && h1.who.driverName === 'Alex' && h1.closedBy === 'expired');
  say('...with its time bought, laps and late laps', h1.bought === 1200 && h1.lane === 0 && h1.laps.length === 2 && h1.laps[0].late === false && h1.laps[1].late === true && h1.best === h1.laps[0].t);
  say('...and it is kept for a restart with the rest of the session', !!kept() && kept().data.closed.length === 1);

  // ---------- pausing ----------
  ops().add(1, 0.2); // a longer time for lane 2
  const before = tokens().left(1, run('live.engine().elapsed(performance.now())'));
  key(' ');
  say('Pause all: the session is paused', phase() === 'paused');
  const pausedAt = run('live.engine().elapsed(performance.now())');
  await wait(400);
  say('...and the clocks stand still', run('live.engine().elapsed(performance.now())') === pausedAt && clockOf(1) === '00:12');
  key('1'); say('...a crossing is ignored while paused', eng().cars[0].laps.length === 0);
  say('...time can still be added while paused', ops().add(1, 0.1) === true);
  key(' '); say('Resume all: the clocks go on', phase() === 'running');
  await wait(150);

  // ---------- another driver ----------
  const stintsBefore = tokSessions().length;
  say('another driver on a lane that is running: the lane keeps its time', ops().who(1, 'd3') === true && eng().cars[1].driverName === 'Kim' && eng().cars[1].driverId === 'd3' && tokens().stintOf(1).who.driverName === 'Kim');
  say('...the name widget shows the new driver', run("live.nodes.find(n=>n.w.type==='name'&&n.w.lane===1).val.innerHTML") === 'Kim');
  say('...the time that was left comes along', tokens().stintOf(1).carried > 5000 && clockOf(1) !== '00:00');
  await until(() => false, 100);
  say('choosing the same driver again does nothing', ops().who(1, 'd3') === false);
  say('a Guest on a lane', ops().who(2, '') === false && eng().cars[2].driverName === 'Guest'); // (it was a Guest already)

  // ---------- undo, end now, clear ----------
  say('undo takes back the last time added', ops().add(3, 0.1) === true && tokens().left(3, run('live.engine().elapsed(performance.now())')) > 5000 && ops().undo(3) === true && clockOf(3) === '00:00' && tokens().stateOf(3, 0) === 'idle');
  ops().add(3, 0.1);
  say('End time now: the lane is red at once', ops().end(3) === true && bgOf('name', 3) === '#d62828' && clockOf(3) === '00:00');
  say('...and undo brings the time back', ops().undo(3) === true && !bgOf('name', 3) && clockOf(3) !== '00:00');
  ops().end(3);
  say('Clear switches the lane off again (neutral, not red)', ops().clear(3) === true && !bgOf('name', 3) && colorOf('tokenclock', 3) === 'var(--muted)');
  say('nothing to undo or end on an idle lane', ops().undo(3) === false && ops().end(3) === false && ops().clear(3) === false);

  // ---------- taking time off ----------
  { const Tn = () => run('live.engine().elapsed(performance.now())');
    say('nothing can be taken off a lane that is off, or off a lane the track does not have', ops().reduce(3, 1) === false && ops().reduce(9, 1) === false && tokens().stateOf(3, Tn()) === 'idle');
    ops().add(3, 10);
    say('time taken off a lane that is on: the clock goes down by that time and the lane stays on', ops().reduce(3, 1) === true && Math.abs(tokens().left(3, Tn()) - 9 * 60000) < 1500 && ['09:00', '08:59'].includes(clockOf(3)) && tokens().stateOf(3, Tn()) === 'running' && !bgOf('name', 3));
    say('...an amount that makes no sense is refused', [0, -1, NaN, 'x', undefined].every(v => ops().reduce(3, v) === false) && Math.abs(tokens().left(3, Tn()) - 9 * 60000) < 1500);
    say('Undo gives the time back', ops().undo(3) === true && Math.abs(tokens().left(3, Tn()) - 10 * 60000) < 1500 && tokens().stintOf(3).bought === 600000);
    say('more than what is left: the lane is out at once and turns red', ops().reduce(3, 15) === true && tokens().stateOf(3, Tn()) === 'out' && bgOf('name', 3) === '#d62828' && clockOf(3) === '00:00');
    say('...and that can be taken back too', ops().undo(3) === true && tokens().stateOf(3, Tn()) === 'running' && !bgOf('name', 3));
    ops().reduce(3, 3); await wait(60); key('4'); await wait(60); key('4'); await wait(60);
    ops().clear(3); await wait(60);
    const sold = tokens().closedList().filter(x => x.lane === 3).pop();
    say('the stint is held with the time that was really sold (10 minutes minus 3)', !!sold && sold.bought === 7 * 60000 && sold.laps.length === 1 && tokSessions().length === 0); }

  // ---------- kept across a restart ----------
  await wait(100);
  say('the session is kept in the settings', !!kept() && kept().data.v === 1 && kept().data.lanes.length === 4 && kept().setupId === 's-tok');
  say('...with the time left on the running lanes', kept().data.lanes[1].stint && kept().data.lanes[1].stint.left > 0 && kept().data.lanes[3].stint === null);

  // ---------- what other screens get ----------
  await wait(150);
  const T0 = run('live.engine().elapsed(performance.now())');
  say('the live data holds the token clocks: one number per lane', Array.isArray(sent.dyn.tokens && sent.dyn.tokens.ends) && sent.dyn.tokens.ends.length === 4 && sent.dyn.tokens.ends[3] === null && sent.dyn.tokens.warnColor === '#ffb300' && sent.dyn.tokens.outColor === '#d62828');
  say('a screen that follows the race shows the same clocks and states', run(`(() => { const V = LiveShare.viewer(); V.feedStatic(__sent.stat); V.feedDynamic(__sent.dyn, performance.now()); const S = V.shared(performance.now()), T = S.eng.elapsed(S.now), K = live.tokens;
    return [0, 1, 2, 3].every(l => S.tokens.stateOf(l, T) === K.stateOf(l, T) && Math.abs(S.tokens.left(l, T) - K.left(l, T)) < 1) && !!S.tokens; })()`));
  // a lane that is out, as another screen draws it
  ops().add(2, 0.05); ops().end(2); await wait(150);
  say('a screen that follows the race paints the lane that is out in the time\'s-up colour, with readable text (also for the rows of a leaderboard)', run(`(() => { const V = LiveShare.viewer(); V.feedStatic(__sent.stat); V.feedDynamic(__sent.dyn, performance.now()); const S = V.shared(performance.now());
    const lc = S.laneColorsOf(2), other = S.laneColorsOf(0); return lc.bg === '#d62828' && lc.color === '#fff' && other.bg !== '#d62828'; })()`));
  say('...and a widget of that lane on such a screen is red too', run(`(() => { const V = LiveShare.viewer(); V.feedStatic(__sent.stat); V.feedDynamic(__sent.dyn, performance.now()); const S = V.shared(performance.now());
    const o = Timing.content({ type: 'name', lane: 2, opt: {} }, S), p = Timing.content({ type: 'name', lane: 0, opt: {} }, S); return o.bg === '#d62828' && o.color === '#fff' && !p.bg; })()`));
  ops().clear(2);

  // ---------- the lane controls on the page ----------
  const panelHtml = E('tokenpanel').innerHTML;
  say('the controls list every lane with the buttons of the settings, a driver choice with Guest, and Pause all', (panelHtml.match(/data-lane="/g) || []).length === 4 && ['+1 min', '+5 min', '+10 min', '+15 min', '+30 min', '+60 min', '\u22121 min', '\u22125 min', '\u221210 min'].every(t => panelHtml.includes(t)) && panelHtml.includes('>Guest<') && panelHtml.includes('>Kim<') && panelHtml.includes('End time now') && panelHtml.includes('Undo') && panelHtml.includes('Pause all'));

  // ---------- ending the session ----------
  ops().add(1, 0.3); await wait(60); key('2'); await wait(60); key('2');
  const totalBefore = tokSessions().length;
  key('s'); await until(() => phase() === 'finished', 3000); await wait(150);
  say('Stop (the key S) asks, then ends the session (the tests finalize at once; the review has its own tests below)', phase() === 'finished' && !run("live.reviewShown"));
  const fin = tokSessions().slice(totalBefore);
  say('every stint that had laps is saved when the session is finalized', fin.length >= 1 && fin.some(([ss]) => ss.standings[0].driverName === 'Kim' && ss.endedBy === 'The session ended'));
  say('...stints without laps are not saved', tokSessions().every(([ss, ll]) => ll.length > 0));
  say('...the session is no longer kept for a restart', !kept());
  say('...and the message says what was saved', /session ended/i.test(E('msg').textContent) && /saved/i.test(E('msg').textContent));
  const s1 = tokSessions().find(([ss]) => ss.token.stint === 1);
  say('a stint is saved as a result of its own', !!s1 && s1[0].setupName === 'Club night' && s1[0].trackId === 't4' && s1[0].standings.length === 1 && s1[0].standings[0].driverName === 'Alex' && s1[0].standings[0].driverId === 'd1' && s1[0].endedBy === 'The time ran out');
  say('...with its time bought, laps and late laps', s1[0].token.bought === 1200 && s1[0].token.lane === 1 && s1[0].standings[0].laps === 1 && s1[0].standings[0].lateLaps === 1 && s1[0].standings[0].best === s1[1][0].time);
  say('...its laps are marked as token laps; the late one is kept out of the records', s1[1].length === 2 && s1[1].every(l => l.token === true && l.trackId === 't4' && l.driverId === 'd1' && l.lane === 1) && !s1[1][0].noTrackRecord && s1[1][1].late === true && s1[1][1].noTrackRecord === true && s1[1][1].noPersonalBest === true && s1[1][1].invalid === true);
  say('...with a stint number', s1[1].every(l => l.stint === 1) && s1[0].token.stint === 1);
  say('...the stint with the time that was sold is saved with that time', tokSessions().some(([ss]) => ss.token.lane === 4 && ss.token.bought === 7 * 60000));

  // ---------- a session that was not ended: carry on, or save what it recorded ----------
  run("state.settings = { theme: 'dark', tokenWarnSeconds: 0.6 }"); saved.length = 0;
  await openRace(setupTok, store.tracks[1], rows(1, 2)); key(' ');
  ops().add(0, 0.3); await wait(60); key('1'); await wait(60); key('1'); await wait(60); key('1'); ops().add(2, 0.3);
  await wait(100);
  const leftBefore = tokens().left(0, run('live.engine().elapsed(performance.now())')); // (the session is kept a moment later, when the window closes: the time left may be a little less, never more, and not by much even on a slow or busy computer)
  say('(a session is running and kept)', !!kept() && kept().data.lanes[0].stint.laps.length === 2 && kept().data.lanes[2].stint.left > 0);
  await openRace(setupTok, store.tracks[1], rows(1, 2)); // (the window was closed without ending: the session is opened again)
  say('opened again: the session is back, with the time that was left, ready to start', phase() === 'ready' && tokens().stateOf(0, 0) === 'running' && tokens().left(0, 0) > 0 && tokens().left(0, 0) <= leftBefore && tokens().left(0, 0) >= leftBefore - 250 && clockOf(0) !== '00:00' && tokens().stateOf(2, 0) === 'running' && tokens().stateOf(1, 0) === 'idle');
  say('...with the laps of the stint on the lane', eng().cars[0].laps.length === 2 && eng().cars[0].best !== null && tokens().stintOf(0).laps.length === 2);
  const waiting = clockOf(0); await wait(250);
  say('...and the clocks stand still until Start is pressed', clockOf(0) === waiting && phase() === 'ready');
  key(' '); await wait(1100);
  say('...then they run on', phase() === 'running' && clockOf(0) !== waiting);
  ops().add(1, 0.5); await wait(60); key('2'); await wait(60); key('2'); await wait(60);
  ctx.confirm = () => false;
  await openRace(setupTok, store.tracks[1], rows(1, 2)); // opened again, and this time the person does not want to carry on
  await wait(200);
  say('not carrying on: what the earlier session recorded is saved, and every lane is neutral', tokSessions().length >= 2 && tokSessions().some(([ss]) => ss.token.lane === 1 && ss.standings[0].laps === 2) && tokSessions().some(([ss]) => ss.token.lane === 2 && ss.standings[0].laps === 1) && [0, 1, 2, 3].every(l => tokens().stateOf(l, 0) === 'idle') && phase() === 'ready');
  say('...and it is not offered again', !kept());
  ctx.confirm = () => true;

  // ---------- a session of another track that was not ended is saved with that track (1.39.1) ----------
  { saved.length = 0; run("state.settings = { theme: 'dark', tokenWarnSeconds: 0.6 }"); ctx.confirm = () => true;
    await openRace(setupTok, store.tracks[0], rows(1, 2)); key(' '); // (the Living room)
    ops().add(0, 0.3); await wait(60); key('1'); await wait(60); key('1'); await wait(60); key('1'); await wait(60);
    run('live.flushTokens()');
    say('(a session on the Living room was not ended)', !!kept() && kept().trackId === 't1' && kept().data.lanes[0].stint.laps.length === 2);
    await openRace(setupTok, store.tracks[1], rows(1, 2)); await wait(250); // the same setup, now on the Big track
    say('the same setup on another track does not carry the laps over: this is a new session, nothing on the lanes', phase() === 'ready' && eng().cars[0].laps.length === 0 && [0, 1, 2, 3].every(l => tokens().stateOf(l, 0) === 'idle'));
    say('...the laps of the earlier session are saved with the track they were driven on', tokSessions().length === 1 && tokSessions()[0][0].trackId === 't1' && tokSessions()[0][0].trackName === 'Living room' && tokSessions()[0][1].length === 2 && tokSessions()[0][1].every(l => l.trackId === 't1'));
    say('...and it is not offered again', !kept()); }

  // ---------- the keys of the race screen (1.39.1) ----------
  { saved.length = 0; run("state.settings = { theme: 'dark' }");
    const kx = o => run('live').key({ target: { matches: () => false }, preventDefault() {}, ...o });
    await openRace(setupTok, store.tracks[1], rows(1, 2)); key(' ');
    ops().add(0, 5); await wait(60); key('1'); await wait(60); // (the first crossing only starts the car)
    const laps0 = () => eng().cars[0].laps.length;
    kx({ key: '1', metaKey: true }); await wait(60); kx({ key: '1', altKey: true }); await wait(60); kx({ key: '1', repeat: true }); await wait(60); kx({ key: '1', ctrlKey: true, code: 'Numpad1' }); await wait(60);
    say('Cmd+1, Alt+1, a key that is held down and Ctrl+Numpad 1 do not count a lap', laps0() === 0);
    kx({ key: 'r', ctrlKey: true }); kx({ key: 's', ctrlKey: true }); await wait(30);
    say('Ctrl+R and Ctrl+S (reload, save) are not the red flag and stop: the race goes on', phase() === 'running');
    kx({ key: '&', code: 'Digit1' }); await wait(60);
    say('a keyboard whose number row types other characters (AZERTY) counts the lap of the key that is pressed', laps0() === 1);
    kx({ key: '1', code: 'Numpad1' }); await wait(60);
    say('...and so does the number pad', laps0() === 2);
    kx({ key: '!', code: 'Digit1', shiftKey: true }); await wait(30); kx({ key: '!', code: 'Digit1', shiftKey: true }); await wait(30);
    say('in a Time Token Session Shift + number (the pit) does nothing: the engine gets no lap the stint does not have', laps0() === 2 && tokens().stintOf(0).laps.length === 2 && eng().cars[0].blockAt === null);
    key('s'); await until(() => phase() === 'finished', 3000); await wait(100); }

  // ---------- stints that could not be saved stay in the review ----------
  { saved.length = 0; run("state.settings = { theme: 'dark' }");
    await openRace(setupTok, store.tracks[1], rows(1, 2)); key(' ');
    ops().add(0, 0.3); await wait(60); key('1'); await wait(60); key('1'); await wait(60); key('1'); await wait(60);
    const realSave = api.saveSession; api.saveSession = async () => { throw new Error('disk full'); };
    key('s'); await until(() => /could not be saved/.test(E('msg').textContent), 3000); await wait(50);
    say('stints that cannot be saved are reported, nothing is lost and the review stays open', phase() === 'review' && /could not be saved/.test(E('msg').textContent) && tokSessions().length === 0 && tokens().hasPending() === true && E('review').innerHTML.includes('Press Finalize to try again'));
    say('...and the session is still kept, as waiting for the review', !!kept() && kept().review === true && kept().data.closed.length === 1);
    api.saveSession = realSave; run('live.reviewCommand')({ op: 'finalize' }); await until(() => phase() === 'finished', 2000); await wait(50);
    say('...Finalize tries again: the stint is saved with all of its laps', tokSessions().length === 1 && tokSessions()[0][1].length === 2 && tokSessions()[0][0].token.lane === 1 && tokens().hasPending() === false && !kept()); }

  // ---------- laps are kept without anything being pressed ----------
  { run("state.settings = { theme: 'dark' }");
    await openRace(setupTok, store.tracks[1], rows(1, 2)); key(' ');
    ops().add(0, 5); await wait(60); key('1'); await wait(60); key('1');
    say('(a lap was driven; the session was last kept when the time was added)', tokens().stintOf(0).laps.length === 1 && kept().data.lanes[0].stint.laps.length === 0);
    await until(() => kept().data.lanes[0].stint.laps.length === 1, 7500);
    say('a lap is kept within a few seconds by itself, so a crash loses at most the last seconds', kept().data.lanes[0].stint.laps.length === 1);
    key('s'); await until(() => phase() === 'finished', 3000); await wait(100); }

  // ---------- a Token Clock can stay without the warning colour ----------
  { run("state.settings = { theme: 'dark', tokenWarnSeconds: 0.6, tokenWarnColor: '#ffb300', tokenOutColor: '#d62828' }");
    await openRace(setupTok, store.tracks[1], rows(1, 2)); key(' ');
    run("(() => { const n = live.nodes.find(n => n.w.type === 'tokenclock' && n.w.lane === 0); n.w.opt = { ...(n.w.opt || {}), warnColour: false }; })()");
    ops().add(0, 0.02); ops().add(1, 0.02);
    await until(() => lastOf('tokenclock', 1)[2] === '#ffb300', 3000);
    say('the option "Turn amber when the time is almost up" off: that clock keeps its colour in the warning, another clock turns amber', bgOf('tokenclock', 1) === '#ffb300' && !bgOf('tokenclock', 0) && clockOf(0) !== '00:00' && clockOf(0) !== '00:02');
    await until(() => bgOf('name', 0) === '#d62828', 3000);
    say('...and when the time is up it goes red like the rest', bgOf('tokenclock', 0) === '#d62828' && bgOf('name', 0) === '#d62828');
    key('s'); await until(() => phase() === 'finished', 3000); await wait(100); }

  // ---------- the lane controls: which buttons can be pressed ----------
  const fakePanel = () => { const part = k => ({ dataset: { tk: k }, disabled: false, textContent: '', className: '', style: {}, value: '' });
    const rowsOf = {}; [0, 1].forEach(l => { const r = { className: '', dataset: { lane: String(l) }, parts: {}, adds: [5, 10].map(m => ({ ...part('add'), dataset: { tk: 'add', min: String(m) } })), subs: [1, 5].map(m => ({ ...part('sub'), dataset: { tk: 'sub', min: String(m) } })) };
      ['clock', 'state', 'undo', 'end', 'clear', 'who'].forEach(k => { r.parts[k] = part(k); });
      r.querySelector = sel => r.parts[/data-tk="(\w+)"/.exec(sel)[1]]; r.querySelectorAll = sel => (/"sub"/.test(sel) ? r.subs : r.adds); rowsOf[l] = r; });
    const pause = part('pause'), box = { hidden: true, innerHTML: '', querySelector: sel => (/tr\[data-lane="(\d+)"\]/.test(sel) ? rowsOf[/"(\d+)"/.exec(sel)[1]] : pause) };
    return { rowsOf, pause, box }; };
  { const { rowsOf, pause, box } = fakePanel();
    const K = ctx.Tokens.create({ lanes: 2, warnSeconds: 60, warnColor: '#ffb300', outColor: '#d62828' }); let T = 0, ph = 'running';
    const panel = run('TokenPanel').build(box, { tokens: K, lanes: [0, 1], drivers: [], increments: [5, 10], decrements: [1, 5], T: () => T, phase: () => ph, ops: {}, label: () => '' });
    const on = (l, ...k) => k.map(x => !(x === 'add' ? rowsOf[l].adds.every(a => a.disabled) : x === 'sub' ? rowsOf[l].subs.every(a => a.disabled) : rowsOf[l].parts[x].disabled)).join();
    panel.update();
    say('a lane with no time: time can be added, and there is nothing to take off, undo, end or clear', on(0, 'add', 'sub', 'undo', 'end', 'clear') === 'true,false,false,false,false' && rowsOf[0].parts.state.textContent === 'No time' && rowsOf[0].parts.clock.textContent === '00:00' && rowsOf[0].className === 'tk-idle');
    K.add(0, 10 * 60000, T); panel.update();
    say('a lane with time: everything can be pressed, the other lane is unchanged', on(0, 'add', 'sub', 'undo', 'end', 'clear') === 'true,true,true,true,true' && rowsOf[0].parts.state.textContent === 'Running' && rowsOf[0].parts.clock.textContent === '10:00' && on(1, 'sub', 'undo', 'end', 'clear') === 'false,false,false,false');
    T = 9.5 * 60000; panel.update();
    say('in the warning the state says so in the warning colour', rowsOf[0].parts.state.textContent === 'Almost up' && rowsOf[0].parts.state.style.background === '#ffb300' && rowsOf[0].className === 'tk-warning');
    T = 11 * 60000; panel.update();
    say('time up: red, nothing to undo or end any more, but the lane can be cleared and new time bought', rowsOf[0].parts.state.textContent === "Time's up" && rowsOf[0].parts.state.style.background === '#d62828' && on(0, 'add', 'sub', 'undo', 'end', 'clear') === 'true,false,false,false,true');
    ph = 'finished'; panel.update();
    say('when the session is over nothing can be pressed', on(0, 'add', 'sub', 'undo', 'end', 'clear') === 'false,false,false,false,false' && on(1, 'add') === 'false' && pause.disabled === true);
    ph = 'paused'; panel.update();
    T = 9.5 * 60000; K.add(1, 10 * 60000, T); panel.update();
    say('while the session is paused time can still be taken off a lane that is on, and not off one that is off', on(1, 'sub') === 'true' && (K.clear(1, T), panel.update(), on(1, 'sub') === 'false'));
    say('Pause all becomes Resume all while paused', pause.textContent === 'Resume all' && pause.disabled === false);
    ph = 'running'; panel.update();
    say('...and back', pause.textContent === 'Pause all' && pause.disabled === false);
    ph = 'ready'; panel.update();
    say('before the start time can be added, but there is nothing to pause yet', on(1, 'add') === 'true' && pause.disabled === true);
    // a screen that follows the race gets a new view with every message: the panel asks for the current one each time
    { const f = fakePanel(); let view = ctx.Tokens.view({ warnMs: 60000, warnColor: '#ffb300', outColor: '#d62828', ends: [null, null], lastOp: [null, null] }), Tn = 0;
      const p2 = run('TokenPanel').build(f.box, { tokens: () => view, lanes: [0, 1], drivers: [], increments: [5], T: () => Tn, phase: () => 'running', ops: {}, label: () => '' });
      p2.update();
      say('a panel fed by a function shows the view it is given: nothing bought', f.rowsOf[0].parts.state.textContent === 'No time' && f.rowsOf[0].parts.undo.disabled === true);
      view = ctx.Tokens.view({ warnMs: 60000, warnColor: '#ffb300', outColor: '#d62828', ends: [600000, null], lastOp: ['add', null] }); p2.update();
      say('...and the next one with the next update: 10:00 left, Undo possible, the other lane unchanged', f.rowsOf[0].parts.clock.textContent === '10:00' && f.rowsOf[0].parts.undo.disabled === false && f.rowsOf[1].parts.undo.disabled === true);
      Tn = 700000; p2.update();
      say('...and once the time is up Undo is no longer possible', f.rowsOf[0].parts.state.textContent === "Time's up" && f.rowsOf[0].parts.undo.disabled === true);
      view = null; p2.update(); say('...a view that is not there yet changes nothing and does not break', f.rowsOf[0].parts.state.textContent === "Time's up"); }
    // two presses on the time buttons of a lane within half a second count once; a press on another lane, or a moment later, counts
    { const f = fakePanel(), got = []; let clockMs = 1000;
      run('TokenPanel').build(f.box, { tokens: K, lanes: [0, 1], drivers: [], increments: [5, 10], T: () => 0, phase: () => 'running', now: () => clockMs, ops: { add: (l, m) => got.push(l + ':' + m) }, label: () => '' });
      const tap = (lane, min) => f.box.onclick({ target: { closest: () => ({ dataset: { tk: 'add', min: String(min) }, disabled: false, blur() {}, closest: () => ({ dataset: { lane: String(lane) } }) }) } });
      tap(0, 5); clockMs += 100; tap(0, 10); clockMs += 100; tap(1, 5); clockMs += 450; tap(0, 10); clockMs += 100; tap(0, 5);
      say('the double tap guard: 0:5 counts, 0:10 and 0:5 straight after it do not, lane 1 is separate, and 0:10 more than 600 ms after the first counts', got.join() === '0:5,1:5,0:10'); }
  }

  // ---------- a session that is carried on keeps its drivers, also on the other screens ----------
  { run("state.settings = { theme: 'dark' }"); saved.length = 0;
    await openRace(setupTok, store.tracks[1], rows(1, 2)); key(' ');
    ops().add(1, 5); ops().who(1, 'd3'); await wait(100);
    say('(a session with Kim on lane 2 is running and kept)', eng().cars[1].driverName === 'Kim' && !!kept() && kept().data.lanes[1].who.driverName === 'Kim');
    await openRace(setupTok, store.tracks[1], rows(1, 2)); await wait(150); // (the window was closed without ending, and is opened again: carry on)
    say('carried on: Kim is on lane 2 again, in the race window', phase() === 'ready' && eng().cars[1].driverName === 'Kim' && eng().cars[1].driverId === 'd3' && eng().cars[0].driverName === 'Alex');
    say('...and the other screens are given Kim too', sent.stat.cfg.entries[1].driverName === 'Kim' && sent.stat.cfg.entries[1].driverId === 'd3' && sent.stat.cfg.entries[0].driverName === 'Alex');
    key(' '); await wait(50); key('s'); await until(() => phase() === 'finished', 3000); await wait(100); }

  // ---------- Racing Records and Token Records are separate pools ----------
  store.laps = [{ id: 'x1', trackId: 't4', driverId: 'd1', time: 1234, token: true }, { id: 'x2', trackId: 't4', driverId: 'd2', time: 2222 }];
  await openRace(setupTok, store.tracks[1], rows(1, 2));
  say('a token session compares with token laps only', run('live.base.track') === 1234 && run('live.base.personal.get("d1")') === 1234 && run('live.base.personal.has("d2")') === false);
  await openRace({ name: 'Free', sessionType: 'practice', layout: '' }, store.tracks[1], rows(1, 2));
  say('a normal session compares with the racing laps only', run('live.base.track') === 2222 && run('live.base.personal.has("d1")') === false && run('live.base.personal.get("d2")') === 2222);
  store.laps = [];

  // ---------- a Guest holds the track record of the Token Records: the next session has to open (it did not) ----------
  { store.laps = [{ id: 'g1', trackId: 't4', driverId: '', time: 1000, token: true }, { id: 'g2', trackId: 't4', driverId: 'd1', time: 3000, token: true }, { id: 'g3', trackId: 't4', driverId: 'd2', time: 500, token: true, noTrackRecord: true, noPersonalBest: true }];
    store.racesetups = [{ id: 'k-tok', name: 'Club night', sessionType: 'tokens', track: 't4', layout: '' }, { id: 'k-prac', name: 'Free', sessionType: 'practice', track: 't1', layout: '' }];
    const openFromHome = async id => { run(`state.settings = { theme: 'dark', lastSetupId: '${id}', assignments: { 'k-prac': [{ driverId: 'd1', carId: 'c1' }, { driverId: 'd2', carId: 'c2' }] } }; state.race = null; state.tab = 'home'`); await run('render()');
      E('view').onclick({ target: { closest: () => ({ id: 'start', dataset: {} }) } }); await wait(200); };
    await openFromHome('k-tok');
    say('a Guest holds the track record of the Token Records: the Time Token Session still opens from the Home tab', run('state.tab') === 'race' && phase() === 'ready' && !E('view').innerHTML.includes('screenerror') && !!run('live.tkPanel'));
    say('...the record is shown under the name Guest, a Guest has no personal best, and a lap removed from the records does not count', run('live.base.track') === 1000 && run('live.base.trackName') === 'Guest' && run('live.base.personal.has("")') === false && run('live.base.personal.get("d1")') === 3000 && run('live.base.personal.has("d2")') === false);
    key('s'); await until(() => phase() === 'finished', 3000);
    store.laps.push({ id: 'g4', trackId: 't4', driverId: 'dGone', time: 800, token: true });
    await openFromHome('k-tok');
    say('a record of a driver who was deleted since is shown as (deleted), and the session opens', phase() === 'ready' && run('live.base.track') === 800 && run('live.base.trackName') === '(deleted)');
    key('s'); await until(() => phase() === 'finished', 3000);
    await openFromHome('k-prac');
    say('a race of another type opens from the Home tab too, and its records are the racing ones (token laps are not in them)', run('state.tab') === 'race' && phase() === 'ready' && run('live.base.track') === Infinity && run('live.base.personal.size') === 0);
    key('s'); await until(() => phase() === 'finished' || phase() === 'review', 3000);
    // a screen that cannot be drawn must not leave a page with dead buttons
    run("state.tab = 'home'; state.race = null"); await run('render()');
    appConsole.expected = true; appConsole.seen = 0;
    run("state.race = { setup: { id: 'x', name: 'Broken', sessionType: 'practice', layout: '' }, track: null, rows: [] }; state.tab = 'race'"); await run('render()');
    say('a screen that cannot be drawn says so and offers the way back, instead of leaving the old page with its buttons switched off', appConsole.seen === 1 && E('view').innerHTML.includes('id="screenerror"') && E('view').innerHTML.includes('This screen could not be opened') && E('view').innerHTML.includes('id="errhome"') && run('state.race') === null);
    appConsole.expected = false;
    E('view').onclick({ target: { closest: sel => (sel === '#errhome' ? { id: 'errhome' } : null) } }); await wait(100);
    say('...Back to Home works and the Home page answers its buttons again', run('state.tab') === 'home' && E('view').innerHTML.includes('id="start"') && typeof E('view').onclick === 'function');
    await openFromHome('k-tok');
    say('...and a session can be opened', run('state.tab') === 'race' && phase() === 'ready');
    key('s'); await until(() => phase() === 'finished', 3000); await wait(100);
    store.laps = []; store.racesetups = []; }

  // ---------- spoken calls ----------
  { const spoken = []; ctx.Sound.stop(); ctx.Sound.state.backend = { speak: (t, o, done) => { spoken.push(t); done(); }, file: (u, o, done) => { spoken.push('file'); done(); }, stop: () => {} };
    store.audiosets = [{ id: 'AU9', name: 'Club', rate: 1, pitch: 1, volume: 1, driverBy: 'name', calls: { tokenwarning: { on: true, lines: [{ text: '{driver}, lane {lane}: {seconds} seconds left', file: '' }] }, tokenout: { on: true, lines: [{ text: 'Out on lane {lane}', file: '' }] } } }];
    run("state.settings = { theme: 'dark', tokenWarnSeconds: 0.6 }");
    await openRace({ ...setupTok, audioSet: 'AU9' }, store.tracks[1], rows(1, 2)); key(' ');
    ops().add(0, 0.03); ops().add(2, 5); await wait(150);
    say('nothing is said while the time runs', spoken.length === 0);
    await until(() => spoken.length >= 1, 3000);
    say('the warning is said once, with the driver, lane and seconds', spoken.length === 1 && spoken[0] === 'Alex, lane 1: 1 seconds left');
    await until(() => spoken.length >= 2, 3000);
    say('then "time is up", once', spoken.length === 2 && spoken[1] === 'Out on lane 1');
    await wait(400);
    say('...and not again while the lane stays out, and never for a lane with plenty of time or none', spoken.length === 2);
    ops().add(0, 0.03); await until(() => spoken.length >= 3, 3000);
    say('a new period of time gets its own warning', spoken[2] === 'Alex, lane 1: 1 seconds left');
    ops().end(2); await wait(150);
    say('End time now says "time is up" for that lane', spoken.includes('Out on lane 3'));
    key('s'); await until(() => phase() === 'finished', 3000);
    await wait(100); ctx.Sound.stop(); store.audiosets = []; }

  // ---------- spoken calls: time added, and a lane that is freed ----------
  { const spoken = []; ctx.Sound.stop(); ctx.Sound.state.backend = { speak: (t, o, done) => { spoken.push(t); done(); }, file: (u, o, done) => { spoken.push('file'); done(); }, stop: () => {} };
    const mine = () => spoken.filter(t => /^(Added|Free) /.test(t));
    store.audiosets = [{ id: 'AU8', name: 'Club', rate: 1, pitch: 1, volume: 1, driverBy: 'nickname', calls: { tokenadded: { on: true, lines: [{ text: 'Added {added} to lane {lane}: {seconds} seconds for {driver}', file: '' }] }, tokenfree: { on: true, lines: [{ text: 'Free {lane} {driver}', file: '' }] } } }];
    run("state.settings = { theme: 'dark', tokenWarnSeconds: 0.6 }");
    await openRace({ ...setupTok, audioSet: 'AU8' }, store.tracks[1], rows(1, 2)); await wait(150);
    say('opening the session says nothing about the lanes', mine().length === 0);
    key(' '); await wait(100);
    ops().add(0, 5); await wait(150);
    say('buying time for a lane that has none says how much, for which lane, and for whom (by nickname here)', mine().join() === 'Added 5 minutes to lane 1: 300 seconds for Speedy', mine().join());
    spoken.length = 0; ops().add(0, 2); await wait(150);
    say('adding more to a lane that is running says the amount that was added', mine().join() === 'Added 2 minutes to lane 1: 120 seconds for Speedy', mine().join());
    spoken.length = 0; ops().add(0, 0.5); await wait(150);
    say('...in seconds when it is less than a minute', mine().join() === 'Added 30 seconds to lane 1: 30 seconds for Speedy', mine().join());
    spoken.length = 0; ops().add(1, 1.5); await wait(150);
    say('...and for another lane, minutes and seconds', mine().join() === 'Added 1 minute 30 seconds to lane 2: 90 seconds for Sam', mine().join());
    spoken.length = 0; ops().undo(0); await wait(100); ops().reduce(0, 1); await wait(100);
    say('taking time back says nothing', mine().length === 0, mine().join());
    ops().end(0); await wait(150); spoken.length = 0; ops().add(0, 1); await wait(150);
    say('time bought for a lane that is out starts a new period, and says so', mine().join() === 'Added 1 minute to lane 1: 60 seconds for Speedy', mine().join());
    spoken.length = 0; ops().clear(0); await wait(150);
    say('clearing a lane (the operator frees it) says that the lane is free', mine().join() === 'Free 1 Speedy', mine().join());
    spoken.length = 0; ops().clear(0); await wait(100);
    say('...a lane that is free already says nothing', mine().length === 0 && ops().clear(0) === false);
    spoken.length = 0; ops().clear(1); await wait(150);
    say('...and it is the number of that lane (lane 2, for Sam)', mine().join() === 'Free 2 Sam', mine().join());
    key(' '); await wait(100); spoken.length = 0; ops().add(0, 2); await wait(150);
    say('time bought while the session is paused is announced too', phase() === 'paused' && mine().join() === 'Added 2 minutes to lane 1: 120 seconds for Speedy', mine().join());
    key(' '); await wait(100);
    run("state.settings = { theme: 'dark', tokenWarnSeconds: 0.3 }");
    spoken.length = 0; ops().add(0, 0.03); await wait(100); spoken.length = 0; await wait(2200); ops().add(0, 3); await wait(150);
    say('a period that ran out and is replaced by new time is not "freed"; it says the time that was bought', mine().join() === 'Added 3 minutes to lane 1: 180 seconds for Speedy', mine().join());
    spoken.length = 0; ops().add(1, 5); ops().add(1, 5); await wait(150);
    say('two purchases in the same moment are both said', mine().length === 2, mine().join());
    key('s'); await until(() => phase() === 'finished', 3000);
    await wait(100); ctx.Sound.stop(); store.audiosets = []; }

  // ---------- spoken calls: conditions of a sentence and the wait, for the lanes of a Time Token Session ----------
  { const spoken = []; ctx.Sound.stop(); ctx.Sound.state.backend = { speak: (t, o, done) => { spoken.push(t); done(); }, file: (u, o, done) => { spoken.push('file'); done(); }, stop: () => {} };
    const mine = () => spoken.filter(t => /^(Plain|Alex only|Gone|Free) /.test(t));
    store.audiosets = [{ id: 'AU6', name: 'Club', rate: 1, pitch: 1, volume: 1, driverBy: 'name', calls: {
      tokenadded: { on: true, lines: [{ text: 'Plain added {lane}', file: '' }, { text: 'Alex only added {lane}', file: '', only: { driver: 'd1' } }] },
      tokenfree: { on: true, cooldown: 600, coolFor: 'driver', lines: [{ text: 'Free {lane} {driver}', file: '' }, { text: 'Gone Alex {lane}', file: '', only: { driver: 'd1' } }] } } }];
    run("state.settings = { theme: 'dark', tokenWarnSeconds: 0.6 }");
    await openRace({ ...setupTok, audioSet: 'AU6' }, store.tracks[1], rows(1, 2)); key(' '); await wait(100);
    ops().add(0, 5); ops().add(1, 5); await wait(150);
    say('a sentence for one driver is said for the lane of that driver, the plain one for the other lane', mine().sort().join() === 'Alex only added 1,Plain added 2', mine().join());
    spoken.length = 0; ops().clear(0); await wait(150);
    say('a lane that is freed: the sentence for its driver (Alex) is said instead of the plain one', mine().join() === 'Gone Alex 1', mine().join());
    spoken.length = 0; ops().add(0, 1); await wait(100); spoken.length = 0; ops().clear(0); await wait(150);
    say('the wait of a call counts for each driver: the same lane freed again straight away is held back', mine().length === 0, mine().join());
    spoken.length = 0; ops().clear(1); await wait(150);
    say('...and the other driver is not held back', mine().join() === 'Free 2 Sam', mine().join());
    key('s'); await until(() => phase() === 'finished', 3000);
    await wait(100); ctx.Sound.stop(); store.audiosets = []; }

  // ---------- spoken calls: no lap for a while, only for lanes that have paid time ----------
  { const spoken = []; ctx.Sound.stop(); ctx.Sound.state.backend = { speak: (t, o, done) => { spoken.push(t); done(); }, file: (u, o, done) => { spoken.push('file'); done(); }, stop: () => {} };
    const mine = () => spoken.filter(t => t.startsWith('Stuck '));
    store.audiosets = [{ id: 'AU7', name: 'Club', rate: 1, pitch: 1, volume: 1, driverBy: 'name', noLapSeconds: 5, calls: { nolap: { on: true, lines: [{ text: 'Stuck {driver} lane {lane}', file: '' }] } } }];
    run("state.settings = { theme: 'dark', tokenWarnSeconds: 0.6 }");
    await openRace({ ...setupTok, audioSet: 'AU7' }, store.tracks[1], rows(1, 2)); key(' '); await wait(100);
    ops().add(0, 5); ops().add(1, 0.03); await wait(5800);
    say('no lap for a while is only asked about a lane with paid time (not the idle lanes, nor a lane whose time is up)', mine().join() === 'Stuck Alex lane 1', mine().join());
    key('s'); await until(() => phase() === 'finished', 3000);
    await wait(100); ctx.Sound.stop(); store.audiosets = []; }

  // ---------- reviewing laps while the session goes on ----------
  { run("state.settings = { theme: 'dark', tokenWarnSeconds: 0.6 }"); saved.length = 0; cmds.length = 0;
    await openRace(setupTok, store.tracks[1], rows(1, 2));
    const T = () => run('live.engine().elapsed(performance.now())');
    const lr = (op, o = {}) => E('lapreview').onclick({ target: { closest: () => ({ dataset: { rv: op, ...o } }) } });
    const cmd = c => run('live.reviewCommand')(c);
    const flags = lane => { const st = tokens().stintOf(lane), c = eng().cars[lane]; return st.laps.every((l, n) => c.invalid.includes(n) === !!(l.invalid || l.late) && c.removed.includes(n) === !!l.removed) && c.laps.length === st.laps.length && c.laps.every((t, n) => t === st.laps[n].t); };
    const bestWanted = lane => { const c = eng().cars[lane], g = c.laps.filter((t, n) => !c.bad[n] && !c.invalid.includes(n) && !c.removed.includes(n)); return g.length ? Math.min(...g) : Infinity; };
    say('before the session is opened there is nothing to review: no button', E('lapsbtn').hidden === true && E('lapreview').hidden === true);
    key(' '); ops().add(0, 5); ops().add(1, 5);
    await wait(60); key('1'); for (let i = 0; i < 4; i++) { await wait(60); key('1'); }
    await wait(60); key('2'); await wait(60); key('2');
    say('(lane 1 has four laps, lane 2 has one)', eng().cars[0].laps.length === 4 && eng().cars[1].laps.length === 1);
    say('while the session runs there is a Review laps button, and the panel is closed', E('lapsbtn').hidden === false && E('lapreview').hidden === true && E('lapsbtn').textContent === 'Review laps');
    E('lapsbtn').onclick({});
    say('...it opens a panel with every lane: driver, laps, last and best lap', E('lapreview').hidden === false && E('lapsbtn').textContent === 'Hide lap review' && E('lapreview').innerHTML.includes('Review laps') && E('lapreview').innerHTML.includes('Alex') && E('lapreview').innerHTML.includes('Sam') && (E('lapreview').innerHTML.match(/data-rv="laps"/g) || []).length === 4);
    lr('laps', { car: '0' });
    const h0 = E('lapreview').innerHTML;
    say('a lane opens to its laps, the newest on top, each with Mark invalid and Delete', h0.includes('Mark invalid') && h0.includes('Delete…') && h0.indexOf('<span class="num">4</span>') < h0.indexOf('<span class="num">1</span>') && (h0.match(/data-rv="invalid"/g) || []).length === 4);
    lr('invalid', { car: '0', lap: '1', on: '1' }); await wait(30);
    say('marking a lap invalid: the race and the stint agree, the best lap and the highlights leave it out', eng().cars[0].invalid.join() === '1' && tokens().stintOf(0).laps[1].invalid === true && flags(0) && eng().cars[0].best === bestWanted(0) && run("live.bestBy.get('d1')") === bestWanted(0) && E('lapreview').innerHTML.includes('Mark valid') && E('lapreview').innerHTML.includes('>invalid<'));
    lr('invalid', { car: '0', lap: '1', on: '0' }); await wait(30);
    say('...and it can be made valid again', eng().cars[0].invalid.length === 0 && tokens().stintOf(0).laps[1].invalid === false && flags(0) && run("live.bestBy.get('d1')") === bestWanted(0) && eng().cars[0].best === bestWanted(0));
    // a stint that has ended is held for the review: its laps still count for the best laps that are shown
    ops().add(3, 5); await wait(60); key('4'); await wait(60); key('4'); await wait(60); key('4'); ops().clear(3); await wait(30);
    const heldG = tokens().closedList().filter(x => x.lane === 3).pop();
    lr('invalid', { car: '0', lap: '1', on: '1' }); lr('invalid', { car: '0', lap: '1', on: '0' }); await wait(30);
    say('the laps of a stint that has ended still count for the best laps that are shown', !!heldG && heldG.laps.length === 2 && run('live.bestAll') <= Math.min(...heldG.laps.map(l => l.t)));
    say('...a Guest has no personal best: the Guests are not pooled as one driver (1.39.1)', run('live.engine().cars[3].driverId') === '' && run("live.bestBy.has('')") === false);
    lr('invalid', { car: '0', lap: '3', on: '1' }); await wait(30);
    lr('deltry', { car: '0', lap: '2' });
    say('Delete… asks how: from the records only, or from the race too', E('lapreview').innerHTML.includes('Remove lap 3') && E('lapreview').innerHTML.includes('From the records only') && E('lapreview').innerHTML.includes('From the race too (recalculate)'));
    lr('removelap', { car: '0', lap: '2', recalc: '0' }); await wait(30);
    say('from the records only: the lap stays in the race (still four laps) and in the stint, but is no record', eng().cars[0].laps.length === 4 && eng().cars[0].removed.join() === '2' && tokens().stintOf(0).laps.length === 4 && tokens().stintOf(0).laps[2].removed === true && flags(0) && run("live.bestBy.get('d1')") === bestWanted(0) && E('lapreview').innerHTML.includes('not in the records'));
    const lapsBefore = eng().cars[0].laps.slice(), totalBefore = eng().cars[0].total;
    lr('removelap', { car: '0', lap: '0', recalc: '1' }); await wait(30);
    say('from the race too: one lap fewer in the race and in the stint, the corrections of the later laps move up', eng().cars[0].laps.join() === lapsBefore.slice(1).join() && tokens().stintOf(0).laps.length === 3 && eng().cars[0].removed.join() === '1' && eng().cars[0].invalid.join() === '2' && flags(0) && Math.abs(eng().cars[0].total - (totalBefore - lapsBefore[0])) < 1e-6); // (1.39.1: the time of the lap leaves the total; whatever came before the first crossing stays in it)
    // wrong or foreign commands do nothing during the session
    const snap = () => JSON.stringify([eng().cars.map(c => [c.laps, c.invalid, c.removed, c.points, c.dq, c.extraMs]), tokens().snapshot().lates, phase()]);
    const s0 = snap();
    [{ op: 'invalid', car: '0', lap: 0, on: true }, { op: 'invalid', car: 0, lap: '0', on: true }, { op: 'invalid', car: 9, lap: 0, on: true }, { op: 'invalid', car: -1, lap: 0, on: true }, { op: 'invalid', car: 0, lap: 99, on: true }, { op: 'invalid', car: 0, lap: -1, on: true }, { op: 'invalid', car: 0, lap: 1.5, on: true }, { op: 'removelap', car: 0, lap: 99 }, { op: 'removelap', car: 2, lap: 0 },
      { op: 'nullify', car: 0, lap: 0 }, { op: 'dq', car: 0, lap: 0 }, { op: 'addtime', car: 0, lap: 0, ms: 5000 }, { op: 'forgive', car: 0, lap: 0, k: 0 }, { op: 'finalize' }, { op: 'discard' }, { op: 'tkinvalid', sid: 1, lap: 0 }, { op: 'tkremove', sid: 1, lap: 0 }, { op: 'laps', car: 0 }, {}, null, 'x', 7].forEach(c => cmd(c));
    say('during the session only lap corrections are accepted: wrong cars, wrong laps, penalty operations, Finalize and Delete all data do nothing', snap() === s0 && phase() === 'running');
    E('lapreview').innerHTML = 'MARK'; E('lapsbtn').onclick({}); E('lapsbtn').onclick({}); // (hidden and shown again: drawn afresh)
    say('the panel is drawn afresh when it is opened again', E('lapreview').innerHTML !== 'MARK' && E('lapreview').innerHTML.includes('Review laps'));
    E('lapreview').innerHTML = 'MARK'; await wait(350); // (the clocks go on: the screen is updated every tenth of a second, nothing in the panel changes)
    say('a panel that has not changed is not drawn again, so a button never changes under a finger', E('lapreview').innerHTML === 'MARK');
    key('2'); await wait(60);
    say('...a new lap does draw it again', E('lapreview').innerHTML !== 'MARK' && E('lapreview').innerHTML.includes('Review laps'));
    // a lap after the paid time is up stays invalid
    ops().add(2, 0.03); key('3'); await wait(60); key('3'); await until(() => tokens().stateOf(2, T()) === 'out', 4000); await wait(60); key('3'); await wait(60);
    const late = tokens().stintOf(2).laps.findIndex(l => l.late);
    say('(lane 3: a lap on time and one after the time ran out)', tokens().stintOf(2).laps.length === 2 && late === 1 && eng().cars[2].invalid.join() === '1');
    lr('laps', { car: '2' });
    say('a lap after the time ran out says so and has no Mark valid button; the one on time has', E('lapreview').innerHTML.includes('after the time ran out') && (E('lapreview').innerHTML.match(/data-rv="invalid" data-car="2"/g) || []).length === 1);
    cmd({ op: 'invalid', car: 2, lap: 1, on: false });
    say('...and a command to make it valid is refused', eng().cars[2].invalid.join() === '1' && tokens().stintOf(2).laps[1].late === true && !tokens().stintOf(2).laps[1].invalid);
    cmd({ op: 'removelap', car: 2, lap: 1, recalc: false }); await wait(30);
    say('...but it can be taken out of the records', eng().cars[2].removed.join() === '1' && tokens().stintOf(2).laps[1].removed === true && flags(2));
    // kept across a restart with the corrections
    live_flush: { run('live.flushTokens()'); await wait(30); }
    say('the corrections are kept with the session', kept().data.lanes[0].stint.laps.map(l => (l.invalid ? 'i' : '') + (l.removed ? 'r' : '')).join() === ',r,i' && kept().data.lanes[2].stint.laps[1].removed === true);
    const before = JSON.stringify(eng().cars[0].laps);
    await openRace(setupTok, store.tracks[1], rows(1, 2));
    say('opened again: the laps come back with their corrections', phase() === 'ready' && JSON.stringify(eng().cars[0].laps) === before && eng().cars[0].removed.join() === '1' && eng().cars[0].invalid.join() === '2' && eng().cars[0].best === Math.min(...eng().cars[0].laps.filter((t, n) => n !== 2)) && flags(0) && eng().cars[2].invalid.join() === '1' && eng().cars[2].removed.join() === '1');
    // the Race Director page
    const host = document.createElement('div'); await run('LiveView.mount')(host, {}); run('LiveView.go')('director'); await wait(50);
    const fresh = () => { cbs.dyn.forEach(f => f(plain(sent.dyn))); };
    say('(before the session is opened the page has no lap review)', E('dir-lapsbox').hidden === true);
    key(' '); await wait(200); fresh();
    say('the Race Director page has a Review laps box while the session runs', E('dir-lapsbox').hidden === false && E('dir-laps').innerHTML.includes('Review laps') && E('dir-laps').innerHTML.includes('Alex'));
    E('dir-laps').onclick({ target: { closest: () => ({ dataset: { rv: 'laps', car: '0' } }) } });
    say('...a lane opens to its laps', E('dir-laps').innerHTML.includes('Mark invalid') || E('dir-laps').innerHTML.includes('Mark valid'));
    cmds.length = 0; E('dir-laps').onclick({ target: { closest: () => ({ dataset: { rv: 'invalid', car: '0', lap: '0', on: '1' } }) } }); await wait(100); fresh();
    say('...Mark invalid is sent to the race, which does it, and the page shows it', cmds.length === 1 && cmds[0].type === 'review' && cmds[0].op === 'invalid' && eng().cars[0].invalid.join() === '0,2' && flags(0) && E('dir-laps').innerHTML.includes('Mark valid'));
    E('dir-laps').onclick({ target: { closest: () => ({ dataset: { rv: 'laps', car: '2' } }) } });
    say('...a lap after the time ran out says so on the page too, and has no Mark valid button', E('dir-laps').innerHTML.includes('after the time ran out') && (E('dir-laps').innerHTML.match(/data-rv="invalid" data-car="2" data-lap="1"/g) || []).length === 0 && (E('dir-laps').innerHTML.match(/data-rv="invalid" data-car="2" data-lap="0"/g) || []).length === 1);
    E('dir-laps').innerHTML = 'MARK'; fresh();
    say('...the box is not drawn again while nothing in it changed', E('dir-laps').innerHTML === 'MARK');
    run('LiveView.unmount')();
    key('s'); await until(() => phase() === 'finished', 3000); await wait(100);
    const lane1 = tokSessions().find(([ss]) => ss.token.lane === 1);
    say('what is saved: laps taken out are not saved, invalid laps are kept out of the records', !!lane1 && lane1[1].map(l => l.lapNumber).join() === '1,3' && lane1[1].every(l => l.invalid === true && l.noTrackRecord === true && l.noPersonalBest === true));
    say('...a lap that is valid is saved as a normal lap', tokSessions().find(([ss]) => ss.token.lane === 2)[1].every(l => !l.invalid && l.noTrackRecord === undefined));
    const lane3 = tokSessions().find(([ss]) => ss.token.lane === 3);
    say('...a lap taken out of the records that was also late is not saved', !!lane3 && lane3[1].length === 1 && lane3[0].standings[0].lateLaps === 1);
  }

  // ---------- the review at the end of a Time Token Session ----------
  { run("state.settings = { theme: 'dark', tokenWarnSeconds: 0.6 }"); saved.length = 0; run('state.autoFinalize = false');
    run("Review.ui.open.add(0); Review.ui.openStints.add(1); Review.ui.del = '0:0'");
    await openRace(setupTok, store.tracks[1], rows(1, 2));
    say('a new session starts with nothing unfolded in the reviews', run('Review.ui.open.size') === 0 && run('Review.ui.openStints.size') === 0 && run('Review.ui.del') === null);
    const T = () => run('live.engine().elapsed(performance.now())');
    const rv = (op, o = {}) => E('review').onclick({ target: { closest: () => ({ dataset: { rv: op, ...o } }) } });
    const held = () => tokens().closedList();
    const stintOf = lane => held().find(x => x.lane === lane);
    say('a session in which no lap was driven has nothing to review', await (async () => { key(' '); ops().add(0, 5); await wait(60); key('s'); await until(() => phase() === 'finished', 3000); await wait(60);
      return !run('live.reviewShown') && E('review').hidden !== false && /No laps were driven/.test(E('msg').textContent) && tokSessions().length === 0 && !kept(); })());
    await openRace(setupTok, store.tracks[1], rows(1, 2)); key(' ');
    ops().add(0, 5); ops().add(1, 5); ops().add(2, 0.03);
    await wait(60); key('1'); for (let i = 0; i < 4; i++) { await wait(60); key('1'); }
    await wait(60); key('2'); await wait(60); key('2'); await wait(60); key('2');
    ops().who(1, 'd3'); await wait(60); key('2'); await wait(60); key('2');
    key('3'); await wait(60); key('3'); await until(() => tokens().stateOf(2, T()) === 'out', 4000); await wait(60); key('3'); await wait(60);
    key('s'); await until(() => phase() === 'review', 3000); await wait(60);
    say('Stop ends the session and opens the review: nothing is saved yet', phase() === 'review' && tokSessions().length === 0 && E('review').hidden === false && run('live.reviewShown') === true && /Check the stints/.test(E('msg').textContent));
    say('...every lane is switched off', [0, 1, 2, 3].every(l => tokens().stateOf(l, T()) === 'idle') && held().length === 4);
    const html = () => E('review').innerHTML;
    say('...the review lists every stint with a laps button, and has Finalize and Delete all data', html().includes('Session review') && (html().match(/data-rv="laps"/g) || []).length === 4 && html().includes('data-rv="finalize"') && html().includes('data-rv="discard"') && html().includes('Alex') && html().includes('Sam') && html().includes('Kim') && html().includes('Guest') && html().includes('5 min'));
    say('...Back to Home is off until the review is done, and the lane controls do nothing', E('back').disabled === true && ops().add(0, 5) === false && ops().clear(0) === false && E('stopbtn').disabled === true);
    say('...the session is kept as waiting for the review', kept().review === true && kept().data.closed.length === 4);
    const a = stintOf(0), sam = stintOf(1), g = stintOf(2);
    say('(Alex has four laps, Sam two, and the stint of lane 3 has a lap after the time)', a.laps.length === 4 && held().filter(x => x.lane === 1).length === 2 && g.laps.length === 2 && g.laps[1].late === true);
    rv('laps', { sid: String(a.id) });
    say('a stint opens to its laps', html().includes('Mark invalid') && (html().match(/data-rv="tkinvalid"/g) || []).length === 4);
    const bestA = Math.min(...a.laps.map(l => l.t));
    rv('tkinvalid', { sid: String(a.id), lap: String(a.laps.findIndex(l => l.t === bestA)), on: '1' });
    say('Mark invalid: the lap leaves the best lap of the stint', stintOf(0).laps.filter(l => l.invalid).length === 1 && stintOf(0).best === Math.min(...stintOf(0).laps.filter(l => !l.invalid).map(l => l.t)) && html().includes('Mark valid'));
    rv('tkinvalid', { sid: String(a.id), lap: String(a.laps.findIndex(l => l.t === bestA)), on: '0' });
    say('...and Mark valid brings it back', stintOf(0).best === bestA && !stintOf(0).laps.some(l => l.invalid));
    rv('deltry', { sid: String(a.id), lap: '3' });
    say('Delete… asks how: from the records only, or from the stint too', html().includes('Remove lap 4') && html().includes('From the records only') && html().includes('From the stint too'));
    rv('tkremove', { sid: String(a.id), lap: '3', recalc: '0' });
    say('from the records only: the lap stays in the stint, and the question is gone', stintOf(0).laps.length === 4 && stintOf(0).laps[3].removed === true && html().includes('not in the records') && !html().includes('Remove lap'));
    rv('tkremove', { sid: String(a.id), lap: '0', recalc: '1' });
    say('from the stint too: one lap fewer', stintOf(0).laps.length === 3 && stintOf(0).laps[2].removed === true);
    const kim = held().find(x => x.lane === 1 && x.who.driverName === 'Kim');
    rv('tkremove', { sid: String(kim.id), lap: '0', recalc: '0' });
    say('(Kim\'s stint has only one lap, taken out of the records)', held().find(x => x.id === kim.id).laps.length === 1 && held().find(x => x.id === kim.id).laps[0].removed === true && held().find(x => x.id === kim.id).best === null);
    const gs = String(g.id); rv('laps', { sid: gs });
    say('a lap after the time ran out has no Mark valid button', html().includes('after the time ran out') && (html().match(/data-rv="tkinvalid" data-sid="\d+" data-lap="[01]"/g) || []).length >= 1 && !new RegExp('data-rv="tkinvalid" data-sid="' + gs + '" data-lap="1"').test(html()));
    rv('tkinvalid', { sid: gs, lap: '1', on: '0' });
    say('...and a command to make it valid is refused', !stintOf(2).laps[1].invalid && stintOf(2).laps[1].late === true);
    const before = JSON.stringify(held());
    ['nullify', 'forgive', 'dq', 'invalid', 'removelap', 'addtime'].forEach(op => run('live.reviewCommand')({ op, car: 0, lap: 0, on: true, k: 0, ms: 1000 }));
    [{ op: 'tkinvalid', sid: 'x', lap: 0 }, { op: 'tkinvalid', sid: 9999, lap: 0, on: true }, { op: 'tkremove', sid: a.id, lap: 99 }, { op: 'tkremove', sid: a.id, lap: 1.5 }, { op: 'tkremove', lap: 0 }].forEach(c => run('live.reviewCommand')(c));
    say('race operations and wrong stints or laps do nothing in this review', JSON.stringify(held()) === before && phase() === 'review');
    say('...the corrections are kept too', JSON.stringify(kept().data.closed.find(x => x.id === a.id).laps) === JSON.stringify(stintOf(0).laps));
    // the app is closed during the review: it opens again in the review
    await openRace(setupTok, store.tracks[1], rows(1, 2));
    say('opened again: the session is back in the review, with the corrected stints', phase() === 'review' && held().length === 4 && stintOf(0).laps.length === 3 && stintOf(0).laps[2].removed === true && E('review').innerHTML.includes('Session review') && /had ended/.test(E('msg').textContent) && tokSessions().length === 0);
    // ---- Finalize
    rv('finalize'); await until(() => phase() === 'finished', 3000); await wait(60);
    const one = tokSessions().find(([ss]) => ss.token.stint === a.id);
    say('Finalize saves the stints with their corrections and ends the session', phase() === 'finished' && tokSessions().length === 3 && !!one && one[1].length === 2 && one[1].map(l => l.lapNumber).join() === '1,2' && E('review').hidden === true && !run('live.reviewShown') && !kept() && /3 stints were saved/.test(E('msg').textContent));
    say('...a stint of which every lap was taken out is not saved at all', !tokSessions().some(([ss]) => ss.token.stint === kim.id));
    say('...a lap that was taken out is not saved; the others are', one[1].every(l => l.time > 0) && tokSessions().find(([ss]) => ss.token.stint === g.id)[1].find(l => l.late).invalid === true);
    // ---- Delete all data
    saved.length = 0;
    await openRace(setupTok, store.tracks[1], rows(1, 2)); key(' '); ops().add(0, 5); await wait(60); key('1'); await wait(60); key('1'); await wait(60); key('1');
    key('s'); await until(() => phase() === 'review', 3000); await wait(60);
    rv('discard', { what: 'session' }); await wait(100);
    say('Delete all data: nothing is saved, the session is over and not kept', phase() === 'finished' && saved.length === 0 && !kept() && /deleted/i.test(E('msg').textContent) && E('review').hidden === true && tokens().hasPending() === false);
    // ---- the review is not drawn again while nothing in it changed, and not while the stints are being saved
    saved.length = 0;
    await openRace(setupTok, store.tracks[1], rows(1, 2)); key(' '); ops().add(0, 5); await wait(60); key('1'); await wait(60); key('1'); await wait(60); key('1');
    key('s'); await until(() => phase() === 'review', 3000); await wait(60);
    E('review').innerHTML = 'MARK'; run('live.reviewCommand')({ op: 'tkinvalid', sid: 9999, lap: 0, on: true });
    say('the review is not drawn again while nothing in it changed (a button never changes under a finger)', E('review').innerHTML === 'MARK');
    { const realSave2 = api.saveSession; api.saveSession = async (a, b) => { await wait(250); return realSave2(a, b); };
      rv('finalize'); await wait(80); rv('laps', { sid: '1' }); // (unfolding is only on screen: it draws the review again)
      say('...nor while the stints are being saved (the list would be empty then)', E('review').innerHTML === 'MARK' && phase() === 'review' && /Saving/.test(E('msg').textContent));
      rv('finalize'); rv('discard', { what: 'session' }); // (pressed again while saving: nothing happens twice)
      await until(() => phase() === 'finished', 3000); await wait(60); api.saveSession = realSave2;
      say('...a second press while saving does nothing: the stint is saved once, and Delete all data does not undo it', tokSessions().length === 1 && phase() === 'finished'); }
    // ---- the Race Director page does not show the race review for a token session
    await openRace(setupTok, store.tracks[1], rows(1, 2)); key(' '); ops().add(0, 5); await wait(60); key('1'); await wait(60); key('1');
    const host = document.createElement('div'); await run('LiveView.mount')(host, {}); run('LiveView.go')('director'); await wait(50);
    key('s'); await until(() => phase() === 'review', 3000); await wait(200); cbs.dyn.forEach(f => f(plain(sent.dyn))); await wait(30);
    say('the Race Director page says a Time Token Session is checked on the main computer', E('dir-review').hidden === false && E('dir-review').innerHTML.includes('main computer') && !E('dir-review').innerHTML.includes('data-rv=') && E('dir-lapsbox').hidden === true);
    run('LiveView.unmount')();
    rv('finalize'); await until(() => phase() === 'finished', 3000); await wait(60);
    run('state.autoFinalize = true'); }

  // ---------- the Tokens page of the Live Race pages ----------
  { run("state.settings = { theme: 'dark', tokenWarnSeconds: 0.6, tokenIncrements: '5, 30', tokenWarnColor: '#ffb300', tokenOutColor: '#d62828' }"); cmds.length = 0; saved.length = 0;
    await openRace(setupTok, store.tracks[1], rows(1, 2));
    const host = document.createElement('div'); await run('LiveView.mount')(host, {});
    const T = () => run('live.engine().elapsed(performance.now())'), fresh = () => { cbs.dyn.forEach(f => f(plain(sent.dyn))); };
    say('the Live Race page has a Tokens tile, with its own picture', E('lv-body').innerHTML.includes('data-go="tokens"') && E('lv-body').innerHTML.includes('Add time to the lanes') && E('lv-body').innerHTML.includes(run('Icons.PATHS.tokens')));
    run('LiveView.go')('tokens'); await wait(50);
    const html = () => E('lv-tokens').innerHTML;
    say('the page lists the 4 lanes of the track, the time buttons of this session, and the drivers (and Guest) to choose from', (html().match(/<tr data-lane="/g) || []).length === 4 && html().includes('+5 min') && html().includes('+30 min') && !html().includes('+10 min') && !html().includes('+60 min') && html().includes('\u22121 min') && html().includes('\u221210 min') && ['Alex', 'Sam', 'Kim', 'Lee', 'Guest'].every(n => html().includes('>' + n + '<')) && html().includes('Pause all') && html().includes('End time now') && html().includes('Undo'));
    say('...a session that has not been opened yet offers to open it', E('lv-tkopen').hidden === false && phase() === 'ready');
    E('lv-body').onclick({ target: { closest: sel => (sel === '#lv-tkopen [data-cmd]' ? { dataset: { cmd: 'start' }, disabled: false } : null) } });
    say('Open the session on the page opens it in the race window', cmds.length === 1 && cmds[0].type === 'start' && phase() === 'running');
    await wait(150); fresh();
    say('...and the button goes away', E('lv-tkopen').hidden === true);
    const press = (k, lane, min) => E('lv-tokens').onclick({ target: { closest: sel => (sel === 'button[data-tk]' ? { dataset: { tk: k, min: String(min === undefined ? '' : min) }, disabled: false, blur() {}, closest: () => (lane === undefined ? null : { dataset: { lane: String(lane) } }) } : null) } });
    const last = () => cmds[cmds.length - 1], ends = () => JSON.stringify(tokens().snapshot().ends);
    press('add', 1, 5);
    say('+5 min on the page reaches the race window: lane 2 is on for 5 minutes, the others are not', last().type === 'addtime' && last().lane === 1 && last().minutes === 5 && tokens().stateOf(1, T()) === 'running' && Math.abs(tokens().left(1, T()) - 300000) < 2000 && tokens().stateOf(0, T()) === 'idle');
    const n0 = cmds.length; press('add', 1, 30);
    say('a second press on the same lane straight after the first is taken for a slip and ignored', cmds.length === n0 && tokens().left(1, T()) < 301000);
    press('add', 0, 5);
    say('...another lane is not held back', cmds.length === n0 + 1 && tokens().stateOf(0, T()) === 'running');
    await wait(700); press('add', 1, 30);
    say('...and a press a moment later counts: 5 + 30 minutes', cmds.length === n0 + 2 && Math.abs(tokens().left(1, T()) - 35 * 60000) < 3000);
    press('sub', 1, 5);
    say('a minus button on the page reaches the race window: five minutes come off lane 2', last().type === 'reducetime' && last().lane === 1 && last().minutes === 5 && Math.abs(tokens().left(1, T()) - 30 * 60000) < 3000);
    const n1 = cmds.length; press('sub', 1, 1);
    say('...a second press on the minus buttons of that lane straight after the first is a slip too, another lane is not held back', cmds.length === n1 && (press('sub', 0, 1), cmds.length === n1 + 1));
    await wait(700); press('add', 1, 5);
    say('...the minus guard does not hold back a plus (they are counted apart), and a minus later counts', last().type === 'addtime' && (press('sub', 1, 1), last().type === 'reducetime' && last().minutes === 1));
    press('undo', 1); press('undo', 1); press('undo', 1); // (the minus 1, the plus 5 and the minus 5 are taken back: lane 2 has its 35 minutes again)
    press('undo', 1);
    say('Undo on the page takes back the last time added', last().type === 'undotime' && Math.abs(tokens().left(1, T()) - 300000) < 6000);
    press('end', 0);
    say('End time now on the page: the lane is out', last().type === 'endtime' && tokens().stateOf(0, T()) === 'out');
    press('clear', 0);
    say('Clear on the page: the lane is neutral again', last().type === 'cleartime' && tokens().stateOf(0, T()) === 'idle');
    E('lv-tokens').onchange({ target: { dataset: { tk: 'who' }, value: 'd3', closest: () => ({ dataset: { lane: '1' } }) } }); await wait(250);
    say('choosing a driver on the page changes the driver of the lane, which keeps its time', last().type === 'setdriver' && last().driverId === 'd3' && eng().cars[1].driverName === 'Kim' && tokens().stateOf(1, T()) === 'running');
    say('...and the other screens are told: they now show Kim on that lane', sent.stat.cfg.entries[1].driverName === 'Kim' && sent.stat.cfg.entries[1].driverId === 'd3' && sent.stat.cfg.entries[0].driverName === 'Alex' && !!sent.dyn
      && run(`(() => { const V = LiveShare.viewer(); V.feedStatic(__sent.stat); V.feedDynamic(__sent.dyn, performance.now()); const S = V.shared(performance.now()); return Timing.content({ type: 'name', lane: 1, opt: {} }, S).html + '/' + Timing.content({ type: 'name', lane: 0, opt: {} }, S).html; })()`) === 'Kim/Alex');
    cbs.stat.forEach(f => f(sent.stat)); fresh(); await wait(50);
    say('...the Tokens page of a screen that follows the race builds itself again and still lists the lanes', (html().match(/<tr data-lane="/g) || []).length === 4);
    E('lv-tokens').onchange({ target: { dataset: { tk: 'who' }, value: '', closest: () => ({ dataset: { lane: '1' } }) } }); await wait(250);
    say('a Guest can be chosen too', last().driverId === '' && eng().cars[1].driverName === 'Guest' && sent.stat.cfg.entries[1].driverName === 'Guest');
    press('pause'); await wait(100);
    say('Pause all on the page pauses the session, and again resumes it', last().type === 'pause' && phase() === 'paused');
    press('pause'); await wait(100); say('...', phase() === 'running');
    ops().who(1, 'd3'); await wait(250); // (a real driver on lane 2: an unknown or missing driver must not turn it into a Guest)
    const sets = ends(), who0 = eng().cars.map(c => c.driverName).join();
    [{ type: 'addtime', lane: 1, minutes: -5 }, { type: 'addtime', lane: 1, minutes: 99999 }, { type: 'addtime', lane: 1, minutes: '10' }, { type: 'addtime', lane: 1, minutes: NaN }, { type: 'addtime', lane: 9, minutes: 5 }, { type: 'addtime', lane: '1', minutes: 5 }, { type: 'addtime', lane: 1.5, minutes: 5 }, { type: 'addtime', minutes: 5 },
      { type: 'undotime', lane: 'x' }, { type: 'endtime' }, { type: 'cleartime', lane: -1 }, { type: 'setdriver', lane: 1, driverId: 'nobody' }, { type: 'setdriver', lane: 1, driverId: 7 }, { type: 'setdriver', lane: 1 }, { type: 'setdriver', lane: 1, driverId: null }, { type: 'setdriver', lane: 1, driverId: {} }, { type: 'setdriver', lane: 99, driverId: 'd2' }].forEach(c => cbs.cmd.forEach(f => f(c)));
    say('the race window checks the commands again: a wrong lane or number does nothing, and an unknown or missing driver does not turn a lane into a Guest', ends() === sets && eng().cars.map(c => c.driverName).join() === who0 && who0.split(',')[1] === 'Kim');
    press('add', 3, 5);
    say('lane 4 of the 4-lane track can be sold from the page too', last().lane === 3 && tokens().stateOf(3, T()) === 'running');
    // in a browser on another device: the same login as the Race Director, once
    let authed = false; api.web = true; api.directorAuthed = () => authed; api.directorInfo = async () => ({ passwordSet: true });
    api.directorLogin = async pw => { if (pw !== 'pw') { const e = new Error('wrong'); e.code = 'wrong'; throw e; } authed = true; };
    run('LiveView.go')('tokens'); await wait(30);
    say('in a browser the Tokens page asks for the password first, and shows no lane controls', E('lv-body').innerHTML.includes('id="lv-login"') && E('lv-body').innerHTML.includes('Password for the Tokens page') && E('lv-body').innerHTML.includes('type="password"') && !E('lv-body').innerHTML.includes('lv-tokens') && !E('lv-body').innerHTML.includes('data-tk='));
    document.getElementById('lv-pass').value = 'nope'; await E('lv-login').onsubmit({ preventDefault() {} }); await wait(20);
    say('a wrong password is explained', E('lv-loginmsg').textContent === 'Wrong password.' && !authed);
    document.getElementById('lv-pass').value = 'pw'; await E('lv-login').onsubmit({ preventDefault() {} }); await wait(50);
    say('the right password opens the Tokens page', authed && E('lv-body').innerHTML.includes('id="lv-tokens"'));
    run('LiveView.go')('director'); await wait(30);
    say('...and the same login is enough for the Race Director page', E('lv-body').innerHTML.includes('data-cmd="start"') && !E('lv-body').innerHTML.includes('id="lv-login"'));
    authed = false; api.directorInfo = async () => ({ passwordSet: false }); run('LiveView.go')('tokens'); await wait(30);
    say('with no password set the page says it is for the main computer only', E('lv-body').innerHTML.includes('The Tokens page can only be used on the main computer') && !E('lv-body').innerHTML.includes('type="password"'));
    delete api.web;
    run('LiveView.unmount')();
    key('s'); await until(() => phase() === 'finished', 3000); await wait(100);
    // a race that is not a Time Token Session
    await openRace({ name: 'Free', sessionType: 'practice', layout: '' }, store.tracks[1], rows(1, 2)); key(' '); await wait(100);
    await run('LiveView.mount')(document.createElement('div'), {}); run('LiveView.go')('tokens'); await wait(30);
    say('the Tokens page of a race that is not a Time Token Session says so', E('lv-body').innerHTML.includes('No Time Token Session is running') && !E('lv-body').innerHTML.includes('lv-tokens'));
    run('LiveView.unmount')(); key('s'); await until(() => phase() === 'finished', 3000); await wait(100); }

  say('a button of the lane controls that cannot be pressed looks dimmed, on every screen the controls are on', /\.tkpanel \.btn:disabled\{[^}]*opacity:\.4[^}]*cursor:not-allowed/.test(fs.readFileSync(R + 'renderer/styles.css', 'utf8')) && fs.readFileSync(R + 'renderer/race.js', 'utf8').includes('id="tokenpanel" class="tkpanel"') && fs.readFileSync(R + 'renderer/liveview.js', 'utf8').includes('class="card tkpanel"'));

  // ---------- the settings page ----------
  run("state.settings = { theme: 'dark' }; state.tab = 'setup'; state.setupSub = 'tokens'"); await run('render()'); await wait(50);
  const page = E('setupmgr').innerHTML;
  say('Race Setup has a Time Tokens page with the buttons, the warning and the colours', page.includes('value="1, 5, 10, 15, 30, 60"') && page.includes('id="tk-dec" value="1, 5, 10"') && page.includes('\u22121 min') && page.includes('id="tk-warn"') && page.includes('value="60"') && page.includes('#ffb300') && page.includes('#d62828') && page.includes('+60 min'));
  say('...and a way back to the standard settings', page.includes('id="tk-reset"'));
  E('tk-inc').onchange({ target: { value: '5, x, 20, 20, -3, 7.5' } }); await wait(30);
  say('other buttons: what is not a number of minutes is left out, the rest is kept', run('state.settings.tokenIncrements') === '5, 20, 7.5');
  E('tk-dec').onchange({ target: { value: '2, x, 2, 15' } }); await wait(30);
  say('the minus buttons are set in their own field: what is not a number of minutes is left out', run('state.settings.tokenDecrements') === '2, 15' && E('setupmgr').innerHTML.includes('id="tk-dec" value="2, 15"') && E('setupmgr').innerHTML.includes('\u22122 min'));
  E('tk-dec').onchange({ target: { value: '' } }); await wait(30);
  say('...an empty field means no minus buttons at all', run('state.settings.tokenDecrements') === '' && E('setupmgr').innerHTML.includes('No minus buttons') && run('Tokens.settingsOf(state.settings).decrements.length') === 0);
  E('tk-dec').onchange({ target: { value: '1, 5, 10' } }); await wait(30);
  E('tk-warn').onchange({ target: { value: '90' } }); await wait(30);
  say('a longer warning', run('state.settings.tokenWarnSeconds') === 90);
  E('tk-warn').onchange({ target: { value: 'abc' } }); await wait(30);
  say('a warning that is not a number goes back to the standard', run('state.settings.tokenWarnSeconds') === 60);
  E('tk-outcolor').onchange({ target: { value: '#112233' } }); await wait(30); E('tk-warncolor').onchange({ target: { value: '#445566' } }); await wait(30);
  say('the colours can be changed', run('state.settings.tokenOutColor') === '#112233' && run('state.settings.tokenWarnColor') === '#445566');
  E('tk-reset').onclick(); await wait(60);
  say('back to the standard settings', run('state.settings.tokenIncrements') === '1, 5, 10, 15, 30, 60' && run('state.settings.tokenDecrements') === '1, 5, 10' && run('state.settings.tokenWarnSeconds') === 60 && run('state.settings.tokenOutColor') === '#d62828' && run('state.settings.tokenWarnColor') === '#ffb300');
  say('a race with other buttons and colours uses them', await (async () => {
    run("state.settings = { theme: 'dark', tokenIncrements: '2, 45', tokenOutColor: '#0000aa' }");
    await openRace(setupTok, store.tracks[1], rows(1, 2)); key(' '); ops().add(0, 0.01); ops().end(0); await wait(100);
    const html = E('tokenpanel').innerHTML;
    return html.includes('+2 min') && html.includes('+45 min') && !html.includes('+60 min') && bgOf('name', 0) === '#0000aa' && colorOf('name', 0) === '#fff';
  })());

  console.log(fails ? fails + ' TOKEN RACE TESTS FAILED' : 'ALL TOKEN RACE TESTS PASSED'); process.exit(fails ? 1 : 0);
})();
