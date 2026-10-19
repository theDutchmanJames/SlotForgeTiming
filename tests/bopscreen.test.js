// 1.3.0: Balance of Power on screen: the settings page, the race setup field, the race window (lane controls, the engine it builds, what is saved),
// the Race Director page and the other screens, against a stand-in for the app window.
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
  slotcars: [1, 2, 3, 4].map(i => ({ id: 'c' + i, brand: 'Car' + i })), racesetups: [], fuelrules: [{ id: 'f1', name: 'Standard', tank: 100, perLap: 2, rate: 10, empty: 'retire' }], layouts: [], rowdesigns: [], sessions: [], laps: []
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
for (const f of ['listnum.js', 'bop.js', 'weather.js', 'tyrewear.js', 'endurance.js', 'failures.js', 'damage.js', 'engine.js', 'heats.js', 'rotation.js', 'tokens.js', 'speed.js', 'distance.js','stats.js','homestats.js','carstats.js','viewset.js','picture.js','uiscale.js','theme.js','banner.js', 'icons.js', 'delta.js','avatars.js', 'weatherwidgets.js', 'tyrewidgets.js', 'boardorder.js', 'widgets.js', 'frame.js', 'backdrop.js','announcer.js','sound.js', 'timing.js', 'rows.js', 'richtext.js', 'canvas.js', 'liveshare.js', 'review.js', 'adjustpad.js', 'adjustui.js', 'dirfolder.js', 'penaltyui.js', 'rotationdrag.js','padui.js','livegrid.js', 'homegrid.js', 'drivergrid.js', 'homecards.js', 'liveview.js', 'database.js', 'landing.js', 'race.js', 'undo.js', 'editor.js','tokenui.js', 'bopui.js', 'weatherui.js', 'tyreui.js', 'rotationui.js', 'audioedit.js','widgetbuilder.js','transferui.js','themeui.js','hardware.js','trackmate.js','hardwareui.js', 'dsui.js', 'app.js']) vm.runInContext(fs.readFileSync(R + 'renderer/' + f, 'utf8'), ctx, { filename: f });
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
const Bop_ = () => vm.runInContext('Bop', ctx), same_ = (a, b) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
  await wait(50); run('state.autoFinalize = true'); ctx.__sent = sent;
  const eng = () => run('live.engine()'), settings = () => run('state.settings');
  const setupOn = { id: 's-bop', name: 'Fair race', sessionType: 'race', laps: 10, layout: '', lightsMin: 0, lightsMax: 0, fuelRules: 'f1', bop: 'on', endRule: 'all' };

  // ---------- the settings page ----------
  run("state.settings = { theme: 'dark' }; state.tab = 'setup'; state.setupSub = 'bop'"); await run('render()'); await wait(50);
  const tabs = E('setuptabs').innerHTML;
  say('Race Setup has a Balance of Power tab, after Penalty Systems and before Time Tokens', tabs.includes('Balance of Power') && tabs.indexOf('Penalty Systems') < tabs.indexOf('Balance of Power') && tabs.indexOf('Balance of Power') < tabs.indexOf('Time Tokens') && tabs.indexOf('Fuel Setups') < tabs.indexOf('Penalty Systems'));
  say('...with a note that says what it does', E('setupnote').textContent.includes('Balance of Power evens out a race') && E('setupnote').textContent.includes('fuel use, refuelling speed and tank'));
  { const page = E('setupmgr').innerHTML;
    say('the page starts with the standard settings: manual, both, extremes, 20%, fixed, median, 5 and 3 laps, 0.3 and 0.15 seconds', page.includes('<option value="manual" selected>') && page.includes('<option value="both" selected>') && page.includes('<option value="extremes" selected>') && page.includes('<option value="fixed" selected>') && page.includes('<option value="median" selected>')
      && page.includes('id="bop-percent" min="1" max="90" step="1" value="20"') && page.includes('id="bop-window" type="number" min="3" max="50" step="1" value="5"') && page.includes('id="bop-minlaps" type="number" min="1" max="5" step="1" value="3"') && page.includes('id="bop-apply" type="number" min="0.01" max="600" step="0.05" value="0.3"') && page.includes('id="bop-remove" type="number" min="0" max="0.3" step="0.05" value="0.15"'));
    say('...fuel use, refuelling and the lane correction are on, the tank is off, and the slider has its number', page.includes('id="bop-use" checked') && page.includes('id="bop-rate" checked') && page.includes('id="bop-lanes" checked') && !page.includes('id="bop-tank" checked') && page.includes('<strong id="bop-percent-n">20%</strong>'));
    say('...every choice names what it does, and the three modes are there', ['Manual: the Race Director decides', 'Suggest: the app proposes, the Race Director accepts', 'Automatic: the app applies and removes it', 'Hinder the fastest car and help the slowest car', 'Only hinder the fastest car', 'Only help the slowest car', 'Only the fastest and the slowest car', 'Every car, by how far it is from the middle of the field', 'Median lap', 'Average lap'].every(t => page.includes(t)));
    say('...it says it needs a fuel setup and is for fine-tuning, and has a way back to the standard settings', page.includes('It needs a Fuel Setup') && page.includes('fine-tunes') && page.includes('id="bop-reset"'));
    say('...with nothing about the full percentage while the strength is fixed; the example says what 20% does', !page.includes('id="bop-full"') && E('bop-example').textContent === 'At 20%, a hindered car uses 20% more fuel per lap and refuels 20% slower. A helped car gets the opposite.'); }
  const set = async (id, value, extra = {}) => { E(id).onchange({ target: { value, ...extra } }); await wait(30); };
  await set('bop-mode', 'auto'); say('a mode is kept, and the page is drawn again with it', settings().bopMode === 'auto' && E('setupmgr').innerHTML.includes('<option value="auto" selected>') && !E('setupmgr').innerHTML.includes('(not used in Manual mode)'));
  await set('bop-mode', 'nonsense'); say('...a mode that is not one is the standard (manual) when it is used', Bop_().settingsOf(settings()).mode === 'manual');
  await set('bop-mode', 'suggest'); await set('bop-who', 'hinder'); await set('bop-grade', 'graded'); await set('bop-measure', 'average');
  say('who, how many cars and the measure are kept', settings().bopMode === 'suggest' && settings().bopWho === 'hinder' && settings().bopGrade === 'graded' && settings().bopMeasure === 'average');
  { let focused = 0; run("document.activeElement = { id: 'bop-window' }"); E('bop-window').focus = () => { focused++; };
    await set('bop-window', '7'); run('document.activeElement = null');
    say('the field you were in keeps the focus when the page is drawn again (so the arrow keys keep working on the slider)', settings().bopWindow === 7 && focused === 1); }
  await set('bop-percent', '35'); say('the percentage is kept', settings().bopPercent === 35);
  await set('bop-percent', '500'); say('...never more than 90', settings().bopPercent === 90);
  await set('bop-percent', 'abc'); say('...and what is not a number is the standard', settings().bopPercent === 20);
  E('bop-percent').oninput({ target: { value: '45' } });
  say('moving the slider shows the number and the example as it moves, before anything is saved', E('bop-percent-n').textContent === '45%' && E('bop-example').textContent.startsWith('At 45%, a hindered car uses 45% more fuel per lap') && settings().bopPercent === 20);
  await set('bop-scale', 'scaled'); say('a strength that grows with the difference asks for the difference where it is full', settings().bopScale === 'scaled' && E('setupmgr').innerHTML.includes('id="bop-full"') && E('setupmgr').innerHTML.includes('value="1"'));
  await set('bop-full', '2,5'); say('...a decimal comma is fine', settings().bopFull === 2.5);
  await set('bop-full', '0'); say('...and it is never below 0.1 second', settings().bopFull === 0.1);
  await set('bop-scale', 'fixed'); say('...a fixed strength hides it again', !E('setupmgr').innerHTML.includes('id="bop-full"'));
  E('bop-tank').onchange({ target: { checked: true } }); await wait(30); E('bop-use').onchange({ target: { checked: false } }); await wait(30);
  say('the three effects can be switched on and off on their own', settings().bopTank === true && settings().bopUse === false && Bop_().settingsOf(settings()).rate === true && E('bop-example').textContent === 'At 20%, a hindered car refuels 20% slower and has a 20% smaller tank. A helped car gets the opposite.');
  E('bop-rate').onchange({ target: { checked: false } }); await wait(30); E('bop-tank').onchange({ target: { checked: false } }); await wait(30);
  say('...with every effect off the page says nothing would change on a car', settings().bopUse === false && settings().bopRate === false && settings().bopTank === false && E('bop-example').textContent === 'Every effect is switched off, so nothing would change on a car.');
  E('bop-use').onchange({ target: { checked: true } }); await wait(30); E('bop-rate').onchange({ target: { checked: true } }); await wait(30);
  await set('bop-window', '8'); await set('bop-minlaps', '20');
  say('the laps that count are kept (3 to 50), and the laps needed can not be more than that (8)', settings().bopWindow === 8 && settings().bopMinLaps === 8);
  await set('bop-window', '1'); say('...a window below 3 laps is 3', settings().bopWindow === 3);
  await set('bop-window', '5'); await set('bop-minlaps', '3');
  await set('bop-apply', '1');
  say('the difference where it comes on is kept; the one where it goes off was half of it, so it stays half of it', settings().bopApply === 1 && settings().bopRemove === 0.5);
  await set('bop-remove', '0.2'); await set('bop-apply', '2');
  say('...but a lower number that was typed stays as it was typed', settings().bopApply === 2 && settings().bopRemove === 0.2);
  await set('bop-remove', '9'); say('...and it can not be more than the difference where it comes on', settings().bopRemove === 2);
  await set('bop-remove', ''); say('...an empty field is half of it again', settings().bopRemove === 1);
  await set('bop-apply', '0'); say('...a difference of nothing is the smallest there is (0.01 second)', settings().bopApply === 0.01);
  E('bop-lanes').onchange({ target: { checked: false } }); await wait(30); say('the correction for the length of the lanes can be switched off', settings().bopLanes === false);
  E('bop-reset').onclick(); await wait(60);
  say('back to the standard settings: everything as it was at the start', same_(Bop_().settingsOf(settings()), Bop_().settingsOf({})) && settings().bopMode === 'manual' && settings().bopPercent === 20 && settings().bopRemove === 0.15 && settings().bopLanes === true && settings().bopTank === false && E('bop-msg').textContent === 'Back to the standard settings.');

  // ---------- the field in the race setup ----------
  { const F = run('state.schema.racesetups.fields'), isShown = run('isShown'), f = F.find(x => x.key === 'bop');
    const shown = type => isShown(f, k => ({ sessionType: type })[k]);
    say('a race setup has a Balance of Power field in the rules, off to start with, that says what it needs', f && f.group === 'rules' && f.default === 'off' && f.options.map(o => o[0]).join() === 'off,on' && f.hint.includes('needs a Fuel setup') && f.type === 'select');
    say('...it is asked for a race, a timed race and a heat race, and not for practice, qualifying or a Time Token Session', ['race', 'timed', 'heats'].every(shown) && ['practice', 'qualifying', 'tokens'].every(t => !shown(t)));
    const keys = F.map(x => x.key); say('...it comes after the fuel setup', keys.indexOf('bop') === keys.indexOf('fuelRules') + 1); }

  // ---------- the race window ----------
  run("state.settings = { theme: 'dark', bopMode: 'manual', bopPercent: 25, bopTank: true }");
  store.racesetups = [setupOn];
  await openRace(setupOn, store.tracks[0], rows(1, 2)); await wait(50);
  say('a race with Balance of Power on, a fuel setup and a race gets it from the settings of the page', eng().bop && eng().bop.mode === 'manual' && eng().bop.percent === 25 && eng().bop.tank === true && eng().bop.use === true && !eng().bop.laneFactors && eng().fuel.on === true);
  say('...and its lane controls are on the page, with a row for each lane', !!run('live.bopPanel') && E('boppanel').hidden === false && /Balance of Power/.test(E('boppanel').innerHTML) && E('boppanel').innerHTML.includes('data-lane="0"') && E('boppanel').innerHTML.includes('data-lane="1"') && E('boppanel').innerHTML.includes('aria-label="Hinder lane 1"'));
  { const off = { ...setupOn, bop: 'off' }; await openRace(off, store.tracks[0], rows(1, 2)); await wait(30);
    say('a race setup with Balance of Power off has none: no settings in the engine, no controls', eng().bop === null && !run('live.bopPanel'));
    const nofuel = { ...setupOn, fuelRules: '' }; await openRace(nofuel, store.tracks[0], rows(1, 2)); await wait(30);
    say('...and so has a race without a fuel setup (it works through the fuel rules)', eng().bop === null && !run('live.bopPanel'));
    const prac = { ...setupOn, sessionType: 'practice' }; await openRace(prac, store.tracks[0], rows(1, 2)); await wait(30);
    say('...and so has practice', eng().bop === null && !run('live.bopPanel'));
    const timed = { ...setupOn, sessionType: 'timed', duration: 5 }; await openRace(timed, store.tracks[0], rows(1, 2)); await wait(30);
    say('...a timed race has it', eng().bop !== null && !!run('live.bopPanel')); }
  { const tr = { ...store.tracks[0], length: 10, laneModifier: 'measured', laneLengths: '9, 11' }; await openRace(setupOn, tr, rows(1, 2)); await wait(30);
    say('the length of the lanes of the track is given to the engine, to compare the cars fairly (9 and 11 metres: 0.9 and 1.1)', JSON.stringify(eng().bop.laneFactors) === '[0.9,1.1]');
    run("state.settings.bopLanes = false"); await openRace(setupOn, tr, rows(1, 2)); await wait(30);
    say('...unless that is switched off', !eng().bop.laneFactors); run("state.settings.bopLanes = true"); }
  await openRace(setupOn, store.tracks[0], rows(1, 2)); await wait(50);
  const car = i => eng().cars[i], lap = async () => { key('1'); key('2'); await wait(80); key('1'); key('2'); await wait(80); }; // two laps for each car
  say('before the start nothing has been given to anybody, and the buttons of the controls can be pressed (a hinder can be set before the start)', car(0).bop === 0 && car(1).bop === 0 && phase() === 'ready');
  run('live.actions.bop')(0, 'hinder');
  say('a press on Hinder gives the car on that lane the percentage of the settings (25%) and holds it', car(0).bop === -25 && car(0).bopHold === true && car(1).bop === 0 && eng().tankOf(0) === 75);
  key(' '); await until(() => phase() === 'running', 3000); await wait(60);
  run('live.actions.bop')(1, 'help'); run('live.actions.bop')(7, 'help'); run('live.actions.bop')(0, 'dance'); run('live.actions.bop')(0, undefined);
  say('Help gives the car +25%; a lane with no car, and a button that is not one, do nothing', car(1).bop === 25 && eng().tankOf(1) === 125 && car(0).bop === -25 && eng().events.filter(e => e.type.startsWith('bop')).length === 2);
  api.liveCommand({ type: 'bop', lane: 0, how: 'off' }); await wait(30);
  say('the Race Director page can press them too (the command goes to the race window): Off takes it off and holds the lane', car(0).bop === 0 && car(0).bopHold === true && eng().tankOf(0) === 100);
  api.liveCommand({ type: 'bop', lane: 0, how: 'hinder' }); await wait(30);
  say('...and Hinder gives it again', car(0).bop === -25);
  api.liveCommand({ type: 'bop', lane: '1', how: 'off' }); await wait(30);
  say('...a lane that comes as text ("1") is understood as a number', car(1).bop === 0);
  run('live.actions.bop')(1, 'help');
  run("live.bopCount = 0; (function (f) { live.bopPanel.update = function () { live.bopCount++; return f.apply(this, arguments); }; })(live.bopPanel.update)");
  run('live.actions.bop')(1, 'off');
  say('a press redraws the lane controls at once (not only at the next tick of the clock), and a press that changes nothing does not need to', run('live.bopCount') > 0 && car(1).bop === 0 && (() => { const n = run('live.bopCount'); run('live.actions.bop')(1, 'off'); return run('live.bopCount') === n; })());
  run('live.actions.bop')(1, 'help');
  api.liveCommand({ type: 'bop', lane: 1, how: 'dance' }); api.liveCommand({ type: 'bop', lane: 99, how: 'off' }); api.liveCommand({ type: 'bop', how: 'off' }); await wait(30);
  say('...a command with a button that is not one, or with no lane, is ignored', car(1).bop === 25);
  await lap();
  say('laps go on as before, with the fuel of the car that has it: the hindered car started with the 75 litres of its smaller tank and uses 2.5 litres a lap, the helped car 1.5 (it was helped after the start, so it still has the 100 litres it started with)', car(0).laps.length === 2 && car(1).laps.length === 2 && Math.abs(car(0).fuel - 70) < 1e-6 && Math.abs(car(1).fuel - 97) < 1e-6);
  { // pressing the buttons of the controls (the panel is one built with the real code; the page's own box is a stand-in that does not keep its parts)
    const calls = []; const box = { hidden: true, innerHTML: '', onclick: null, querySelector: () => mk() }, P = run('BopPanel').build(box, { eng: () => eng(), lanes: [0, 1], phase: () => phase(), send: (l, h) => calls.push([l, h]) });
    const press = (lane, how, disabled = false) => box.onclick({ target: { closest: () => ({ disabled, dataset: { bop: how }, blur() {}, closest: () => ({ dataset: { lane: String(lane) } }) }) } });
    press(1, 'hinder'); press(0, 'off'); press(0, 'accept', true); box.onclick({ target: { closest: () => null } }); box.onclick({ target: {} });
    say('a press on a button of the controls says which lane and which button; a button that is off, and a click on something else, do nothing', same_(calls, [[1, 'hinder'], [0, 'off']]) && box.hidden === false); }
  key('s'); await until(() => phase() === 'finished', 3000); await wait(150);
  { const s = saved.at(-1) && saved.at(-1)[0], rowOf = n => s.standings.find(x => x.driverName === n);
    say('the result that is saved says what Balance of Power did to each car: the helped one from the start, the one that was hindered and then freed', s && rowOf('Sam').bopNote === 'helped 25% (from the start)' && rowOf('Alex').bopNote === 'hindered 25% (from the start)');
    say('...the review had the same words (the log of the race)', eng().bopNoteOf(1) === 'helped 25% (from the start)'); }

  // ---------- the review ----------
  { await openRace(setupOn, store.tracks[0], rows(1, 2)); key(' '); await until(() => phase() === 'running', 3000); await wait(60);
    run('live.actions.bop')(0, 'hinder'); await lap(); run('live.actions.bop')(0, 'off');
    const h = run('Review.html')(eng(), {});
    say('the review says what Balance of Power did next to the name (here: from the start to lap 2), and nothing for a car that had none', h.includes('Balance of Power: hindered 25% (from the start to lap 2)') && !h.includes('Balance of Power: helped') && (h.match(/Balance of Power:/g) || []).length === 1);
    key('s'); await until(() => phase() === 'finished', 3000); await wait(100); }

  // ---------- the Race Director page and the other screens ----------
  { await openRace(setupOn, store.tracks[0], rows(1, 2)); key(' '); await until(() => phase() === 'running', 3000); await wait(1300);
    run("globalThis.__bp = []; (function (b) { BopPanel.build = function (box, o) { const p = b(box, o), rec = { lanes: o.lanes, n: 0 }; globalThis.__bp.push(rec); return { update() { rec.n++; return p.update(); } }; }; })(BopPanel.build)");
    const host = document.createElement('div'); await run('LiveView.mount')(host, {}); await wait(50); run('LiveView.go')('director'); await wait(80);
    const html = E('lv-body').innerHTML, bop = E('dir-bop').innerHTML;
    say('the Race Director page has the Balance of Power controls in a folder of their own, with the buttons of each lane', html.includes('id="dir-bop"') && bop.includes('Balance of Power') && bop.includes('data-lane="0"') && bop.includes('aria-label="Off lane 2"') && bop.includes('aria-label="Accept lane 1"'));
    const before = cmds.length, press = (lane, how) => E('dir-bop').onclick({ target: { closest: () => ({ disabled: false, dataset: { bop: how }, blur() {}, closest: () => ({ dataset: { lane: String(lane) } }) }) } });
    press(1, 'hinder'); await wait(60);
    say('a press there is sent to the race window as a command with the lane and the button, and the race window carries it out', cmds.length === before + 1 && same_(cmds.at(-1), { type: 'bop', lane: 1, how: 'hinder' }) && car(1).bop === -25);
    await wait(1300);
    say('...and the page follows: the change is sent with the race to the other screens', sent.dyn.cars[1].bop === -25 && sent.dyn.cars[1].bopHold === true && sent.dyn.bopActive === false && sent.stat.cfg.bop.percent === 25);
    say('...the controls on the Race Director page are drawn again as the race goes on (with a row for each lane)', run('__bp').at(-1).n > 1 && JSON.stringify(run('__bp').at(-1).lanes) === '[0,1]');
    run('LiveView.unmount')();
    key('s'); await until(() => phase() === 'finished', 3000); await wait(100); }
  { await openRace({ ...setupOn, bop: 'off' }, store.tracks[0], rows(1, 2)); key(' '); await until(() => phase() === 'running', 3000); await wait(1300);
    await run('LiveView.mount')(document.createElement('div'), {}); await wait(50); run('LiveView.go')('director'); await wait(80);
    say('a race without Balance of Power has no such card on the Race Director page', !E('lv-body').innerHTML.includes('id="dir-bop"'));
    run('LiveView.unmount')(); key('s'); await until(() => phase() === 'finished', 3000); await wait(100); }

  // ---------- the lane controls: what they show ----------
  const fakeBop = () => { const part = k => ({ dataset: { bop: k }, hidden: false, disabled: false, textContent: '', className: '', attrs: {}, getAttribute(n) { return this.attrs[n]; }, setAttribute(n, v) { this.attrs[n] = v; } });
    const rowsOf = {}; [0, 1, 2].forEach(l => { const r = { hidden: l === 2 ? false : true, parts: {} }; ['who', 'now', 'held', 'to', 'hinder', 'help', 'off', 'auto', 'accept'].forEach(k => { r.parts[k] = part(k); }); r.querySelector = sel => r.parts[/data-bop="(\w+)"/.exec(sel)[1]]; rowsOf[l] = r; });
    const info = part('info'), box = { hidden: true, innerHTML: '', querySelector: sel => (/tr\[data-lane="(\d+)"\]/.test(sel) ? rowsOf[/"(\d+)"/.exec(sel)[1]] : info) };
    return { rowsOf, info, box }; };
  { const { rowsOf, info, box } = fakeBop(); let ph = 'running';
    const E2 = ctx.RaceEngine.createRace({ type: 'race', laps: 20, endRule: 'all', entries: [0, 1].map(i => ({ lane: i, driverId: 'd' + i, carId: 'c' + i, driverName: ['Alex', 'Sam'][i], carName: 'car' })), fuel: { on: true, tank: 100, perLap: 2, rate: 10, target: 0, extra: 0, saving: 0, empty: 'retire', pitHold: 2000 }, bop: { mode: 'suggest', percent: 20 } }); E2.start(0);
    const panel = run('BopPanel').build(box, { eng: () => E2, lanes: [0, 1, 2], phase: () => ph, send: () => {} });
    panel.update();
    say('the controls show a row for each lane that has a car, with the driver, the state and the buttons; the lane with no car is hidden', box.hidden === false && rowsOf[0].hidden === false && rowsOf[1].hidden === false && rowsOf[2].hidden === true && rowsOf[0].parts.who.textContent === 'Alex' && rowsOf[1].parts.who.textContent === 'Sam' && rowsOf[0].parts.now.textContent === 'BoP off' && rowsOf[0].parts.now.className === 'bopchip bop-off');
    say('...the buttons say the percentage of the settings, and Accept (suggest mode) is there but waits for a proposal; there is no Auto', rowsOf[0].parts.hinder.textContent === 'Hinder 20%' && rowsOf[0].parts.help.textContent === 'Help 20%' && rowsOf[0].parts.accept.hidden === false && rowsOf[0].parts.accept.disabled === true && rowsOf[0].parts.auto.hidden === true && info.textContent.startsWith('Suggest:'));
    E2.cars[0].bopTo = -20; E2.cars[1].bopTo = 20; E2.bopSpread = 4.5; E2.bopActive = true; panel.update();
    say('a proposal shows up in its column and Accept can be pressed', rowsOf[0].parts.to.textContent === '−20%' && rowsOf[1].parts.to.textContent === '+20%' && rowsOf[0].parts.accept.disabled === false);
    E2.bopPress(0, 'hinder', 0); panel.update();
    say('after a press the lane shows it (arrow, percentage, colour class), the button that is on is marked, and nothing is left to accept', rowsOf[0].parts.now.textContent === 'BoP ▼ −20%' && rowsOf[0].parts.now.className === 'bopchip bop-hindered' && rowsOf[0].parts.hinder.attrs['aria-pressed'] === 'true' && rowsOf[0].parts.help.attrs['aria-pressed'] === 'false' && rowsOf[0].parts.to.textContent === '');
    ph = 'finished'; panel.update();
    say('when the race is over the buttons are off', ['hinder', 'help', 'off', 'accept'].every(b => rowsOf[0].parts[b].disabled === true));
    ph = 'running'; E2.bop.mode = 'auto'; E2.cars[0].bopHold = false; E2.cars[1].bopHold = true; panel.update();
    say('in automatic mode Auto is there, and works on a lane that is held; the lane says it is held', rowsOf[0].parts.auto.hidden === false && rowsOf[0].parts.accept.hidden === true && rowsOf[1].parts.auto.disabled === false && rowsOf[0].parts.auto.disabled === true && rowsOf[1].parts.held.textContent === 'held' && rowsOf[0].parts.held.textContent === '');
    const none = { hidden: false, innerHTML: '', querySelector: () => mk() }, p2 = run('BopPanel').build(none, { eng: () => null, lanes: [0], phase: () => 'running', send: () => {} }); p2.update();
    say('with no engine, or one without Balance of Power, the controls are hidden', none.hidden === true); }

  console.log(fails ? fails + ' BALANCE OF POWER SCREEN TESTS FAILED' : 'ALL BALANCE OF POWER SCREEN TESTS PASSED'); process.exit(fails ? 1 : 0);
})();
