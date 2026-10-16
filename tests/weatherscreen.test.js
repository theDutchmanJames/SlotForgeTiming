// 1.4.0: Weather on screen: the Weather Systems page, the race setup field, the Slotcar tyre choice, the race window (the weather controls, the engine it builds, tyres in the pits, what is saved),
// the Race Director page and the audio, against a stand-in for the app window.
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
  slotcars: [1, 2, 3, 4].map(i => ({ id: 'c' + i, brand: 'Car' + i, ...(i === 1 ? { tyreCompound: 'S' } : {}) })), racesetups: [], weathersystems: [], fuelrules: [{ id: 'f1', name: 'Standard', tank: 100, perLap: 2, rate: 10, empty: 'retire' }], layouts: [], rowdesigns: [], sessions: [], laps: []
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
for (const f of ['bop.js', 'weather.js', 'endurance.js', 'damage.js', 'engine.js', 'heats.js', 'rotation.js', 'tokens.js', 'speed.js','stats.js','viewset.js','picture.js','uiscale.js','theme.js','banner.js', 'icons.js', 'delta.js','avatars.js', 'weatherwidgets.js', 'widgets.js', 'frame.js', 'backdrop.js','announcer.js','sound.js', 'timing.js', 'rows.js', 'richtext.js', 'canvas.js', 'liveshare.js', 'review.js', 'liveview.js', 'database.js', 'landing.js', 'race.js', 'undo.js', 'editor.js','tokenui.js', 'bopui.js', 'weatherui.js', 'rotationui.js', 'audioedit.js','widgetbuilder.js','transferui.js','themeui.js','hardware.js','trackmate.js','hardwareui.js', 'dsui.js', 'app.js']) vm.runInContext(fs.readFileSync(R + 'renderer/' + f, 'utf8'), ctx, { filename: f });
const run = s => vm.runInContext(s, ctx), E = id => document.getElementById(id);
const say = (m, c) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (cond, ms = 8000) => { for (let t = 0; t < ms && !cond(); t += 25) await wait(25); };
const key = k => run('live').key({ key: k, target: { matches: () => false }, preventDefault() {} });
const phase = () => run('live.phase');
const node = type => run('live.nodes').find(n => n.w.type === type);
const flagIs = name => { const h = node('flag').val.innerHTML; return h.includes('class="flagsvg"') && h.includes('aria-label="' + name + '"'); }; // the Race Flag widget draws a flag; its label names the state
const rows = (...ids) => ids.map(i => ({ driverId: 'd' + i, carId: 'c' + i }));
const openRace = async (setup, track, r) => { setup = { restartAfterRed: 'resume', ...setup }; run(`state.speed=40; state.race=${JSON.stringify({ setup, track, rows: r })}; state.tab='race'`); await run('render()'); };const Wx_ = () => vm.runInContext('Wx', ctx), same_ = (a, b) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
  await wait(50); run('state.autoFinalize = true'); ctx.__sent = sent;
  const eng = () => run('live.engine()'), settings = () => run('state.settings');
  // showers: cloudy from lap 1, rain from lap 2 for 3 laps, clearing for 1 lap; the stop starts at once (0.1 second)
  const sys = { id: 'w1', name: 'Showers', unit: 'laps', startMode: 'point', startAt: 2, rainMode: 'fixed', rainFor: 3, cloudyFor: 1, clearingFor: 1, react: 2, wetPoints: 2, dryPoints: 2 };
  store.weathersystems = [sys];
  store.penaltysystems = [{ id: 'p1', name: 'Points', timeRule: 'every', everyPoints: 5, everySeconds: 5 }];
  const setupWx = { id: 's-wx', name: 'Showers race', sessionType: 'race', laps: 12, layout: '', lightsMin: 0, lightsMax: 0, fuelRules: 'f1', penaltySystem: 'p1', weather: 'w1', endRule: 'all', pitHold: 0.1 };

  // ---------- the Weather Systems page ----------
  run("state.settings = { theme: 'dark' }; state.tab = 'setup'; state.setupSub = 'weather'"); await run('render()'); await wait(50);
  const tabs = E('setuptabs').innerHTML;
  say('Race Setup has a Weather Systems tab, after Penalty Systems and before Balance of Power', tabs.includes('Weather Systems') && tabs.indexOf('Penalty Systems') < tabs.indexOf('Weather Systems') && tabs.indexOf('Weather Systems') < tabs.indexOf('Balance of Power') && tabs.indexOf('Balance of Power') < tabs.indexOf('Time Tokens'));
  say('...with a note that says what a weather system is, and that a race setup chooses one', E('setupnote').textContent.includes('A weather system is a spell of rain') && E('setupnote').textContent.includes('Choose one in a race setup'));
  say('...and the sets are made and kept like the fuel setups and penalty systems (the page lists the sets of that kind)', E('setupmgr').innerHTML.includes('Showers') && run('state.schema.weathersystems.plural') === 'Weather systems');

  // ---------- the fields ----------
  { const F = run('state.schema.racesetups.fields'), isShown = run('isShown'), f = F.find(x => x.key === 'weather');
    const shown = type => isShown(f, k => ({ sessionType: type })[k]);
    say('a race setup has a Weather system field in the rules: a choice of the weather systems, "No weather" to begin with, that says what it needs', f && f.group === 'rules' && f.type === 'ref' && f.ref === 'weathersystems' && f.blank === 'No weather' && f.hint.includes('Hindering the cars needs a Fuel setup'));
    say('...it is asked for a race, a timed race and a heat race, and not for practice, qualifying or a Time Token Session', ['race', 'timed', 'heats'].every(shown) && ['practice', 'qualifying', 'tokens'].every(t => !shown(t)));
    const keys = F.map(x => x.key); say('...it comes after Balance of Power', keys.indexOf('weather') === keys.indexOf('bop') + 1); }
  { const f = run('state.schema.slotcars.fields').find(x => x.key === 'tyreCompound');
    say('a slot car has a tyre choice: Hard, Medium, Soft, Supersoft, Intermediate or Wet, a Medium to begin with', f && f.type === 'select' && f.default === 'M' && f.options.map(o => o[0]).join() === 'H,M,S,SS,INT,W' && f.options[3][1] === 'Supersoft (SS)'); }
  { const fs = run('state.schema.weathersystems.fields'), by = k => fs.find(x => x.key === k), D = Wx_().DEFAULTS;
    say('the weather system has the standard settings of the code as its defaults (so a record and the engine mean the same)', fs.filter(x => x.key !== 'name').every(x => x.default === D[x.key]) && by('startMode').default === 'point' && by('react').default === 2);
    const shown = (key, rec) => run('isShown')(by(key), k => rec[k]);
    say('...a set moment asks for one number, a random moment for two, and the Race Director for none', shown('startAt', { startMode: 'point' }) && !shown('startFrom', { startMode: 'point' }) && shown('startFrom', { startMode: 'random' }) && shown('startTo', { startMode: 'random' }) && !shown('startAt', { startMode: 'random' }) && !['startAt', 'startFrom', 'rainFor', 'cloudyFor', 'clearingFor', 'rainMode'].some(k => shown(k, { startMode: 'director' })));
    say('...the rain lasts a set time or a time between two limits; "every heat" is asked only when something is random', shown('rainFor', { startMode: 'point', rainMode: 'fixed' }) && !shown('rainMin', { startMode: 'point', rainMode: 'fixed' }) && shown('rainMin', { startMode: 'point', rainMode: 'random' }) && shown('rainMax', { startMode: 'random', rainMode: 'random' }) && !shown('sameInHeats', { startMode: 'point', rainMode: 'fixed' }) && shown('sameInHeats', { startMode: 'random', rainMode: 'fixed' }) && shown('sameInHeats', { startMode: 'point', rainMode: 'random' }) && !shown('sameInHeats', { startMode: 'director', rainMode: 'random' }));
    say('...a fixed length is not asked when the length is random, and the other way round', !shown('rainFor', { startMode: 'point', rainMode: 'random' }) && !shown('rainFor', { startMode: 'random', rainMode: 'random' }) && shown('rainFor', { startMode: 'random', rainMode: 'fixed' }) && !shown('rainMax', { startMode: 'random', rainMode: 'fixed' }) && !shown('rainFor', { startMode: 'director', rainMode: 'fixed' }));
    say('...the hindrance table (12 numbers) and the levers are asked only when hindering is on', fs.filter(x => /^(dry|cloudy|wet|clearing)On(Dry|Inter|Wet)$/.test(x.key)).length === 12 && shown('wetOnDry', { hinder: 'on' }) && !shown('wetOnDry', { hinder: 'off' }) && shown('hTank', { hinder: 'on' }) && !shown('hUse', { hinder: 'off' }) && by('wetOnDry').default === 25 && by('clearingOnWet').default === 10 && by('dryOnDry').default === 0); }

  // ---------- the race window ----------
  store.racesetups = [setupWx];
  await openRace(setupWx, store.tracks[0], rows(1, 2)); await wait(50);
  say('a race with a weather system gets its settings in the engine, with a seed (the same system and seed give the same weather)', eng().weather && eng().weather.unit === 'laps' && eng().weather.start.at === 2 && eng().weather.rain.for === 3 && eng().weather.cloudy === 1 && eng().weather.clearing === 1 && eng().weather.seed > 0 && same_(eng().wxPlan.stages, [{ state: 'cloudy', at: 1 }, { state: 'wet', at: 2 }, { state: 'clearing', at: 5 }, { state: 'dry', at: 6 }]));
  say('...the cars start on the tyre choice of their slot car (a Soft, and a Medium for the one that has none)', eng().cars[0].tyre === 'S' && eng().cars[0].tyreOwn === 'S' && eng().cars[1].tyre === 'M');
  say('...the weather controls are on the page: the four weather buttons, and a row for each lane; nothing can be pressed while the forecast decides', !!run('live.wxPanel') && E('wxpanel').hidden === false && /Weather/.test(E('wxpanel').innerHTML) && E('wxpanel').innerHTML.includes('data-wx="clearing"') && E('wxpanel').innerHTML.includes('data-lane="1"'));
  { const off = { ...setupWx, weather: '' }; await openRace(off, store.tracks[0], rows(1, 2)); await wait(30);
    say('a race setup with no weather has none: no settings in the engine, no controls, the cars have their own tyres', eng().weather === null && !run('live.wxPanel') && eng().cars[0].tyre === 'S');
    const prac = { ...setupWx, sessionType: 'practice' }; await openRace(prac, store.tracks[0], rows(1, 2)); await wait(30);
    say('...practice has none either', eng().weather === null && !run('live.wxPanel'));
    const timed = { ...setupWx, sessionType: 'timed', duration: 5 }; await openRace(timed, store.tracks[0], rows(1, 2)); await wait(30);
    say('...a timed race has it', eng().weather !== null && !!run('live.wxPanel'));
    const nofuel = { ...setupWx, fuelRules: '' }; await openRace(nofuel, store.tracks[0], rows(1, 2)); await wait(30);
    say('...and so has a race without a fuel setup (the cars are only not hindered)', eng().weather !== null && !!run('live.wxPanel') && eng().fuel.on === false);
    const gone = { ...setupWx, weather: 'w-deleted' }; await openRace(gone, store.tracks[0], rows(1, 2)); await wait(30);
    say('...and a race setup whose weather system is gone has none', eng().weather === null); }
  await openRace(setupWx, store.tracks[0], rows(1, 2)); await wait(50);
  const car = i => eng().cars[i], lap = async () => { key('1'); key('2'); await wait(80); }, state_ = () => eng().wxState;
  key(' '); await until(() => phase() === 'running', 3000); await wait(60);
  await lap();
  say('the forecast follows the laps of the leader: after one lap it is cloudy', state_() === 'cloudy' && eng().events.filter(e => e.type === 'weather').length === 1);
  await lap();
  say('...after two laps it rains: the cars on dry tyres have to stop within 2 laps, and are hindered by 25% (more fuel a lap)', state_() === 'wet' && car(0).wxDue && car(0).wxDue.kind === 'wet' && car(0).wx === -25 && car(1).wx === -25);
  run('live.actions.weather')('dry'); await wait(30);
  say('the forecast is not changed by hand (the buttons are for a weather system that leaves it to the Race Director)', state_() === 'wet');
  run('live.pitBtns')[0].b.onclick(); await wait(400);
  say('a pit stop of a car changes its tyres to Wet when the stop starts, and takes the hindrance off', car(0).tyre === 'W' && car(0).pit !== null && car(0).wx === 0 && car(0).wxDue === null && eng().events.some(e => e.type === 'tyres' && e.car === 0 && e.tyre === 'W' && e.was === 'S'));
  run('live.pitBtns')[0].b.onclick(); await wait(60);
  await lap(); await lap();
  say('the car that did not stop has the penalty points of the penalty system after its time (2 laps) is up, and the points are in the log with their reason', car(1).points === 2 && eng().events.some(e => e.type === 'tyredue' && e.car === 1 && e.points === 2) && eng().events.some(e => e.type === 'penalty' && e.car === 1 && e.why === 'tyres'));
  say('...and the weather has moved on: clearing, then dry (the car that went through the rain on Wet tyres has to switch back)', ['clearing', 'dry'].includes(state_()));
  { const h = E('wxpanel').innerHTML; say('the controls name the lanes with their tyres', h.includes('data-wx="tyre"') && h.includes('data-wx="todo"')); }
  key('s'); await until(() => phase() === 'finished', 3000); await wait(150);
  { const s = saved.at(-1) && saved.at(-1)[0], rowOf = n => s.standings.find(x => x.driverName === n);
    say('the result that is saved says what the weather did, and what the tyres did to each car', s && s.weatherNote === 'Cloudy from lap 2, rain from lap 3, clearing from lap 6' && rowOf('Alex').tyreNote === 'Wet tyres after lap 3' && rowOf('Sam').tyreNote === '2 penalty points for the tyres after lap 3');
    say('...the review had the same words (the log of the race)', eng().tyreNoteOf(0) === rowOf('Alex').tyreNote && eng().weatherNote() === s.weatherNote); }

  // ---------- 1.5.0: the weather widgets on the timing page ----------
  { const Wg = (type, lane, x, y, opt = {}) => ({ id: type + lane + x, type, lane, x, y, w: 200, h: 80, textSize: '', textColor: '', bgColor: '', opt });
    store.layouts = [{ id: 'LW', name: 'Weather', ratioW: 16, ratioH: 9, widgets: [Wg('tyre', 0, 0, 0), Wg('tyre', 1, 200, 0), Wg('wxforecast', null, 0, 100), Wg('wxconditions', null, 0, 200), Wg('wxforecast', null, 400, 0, { show: 'text', showNext: false }), Wg('tyre', 0, 400, 100, { imageSet: 'IT1' }), Wg('textrace', null, 400, 200, { text: '{weather}|{nextweather}|{tracktemp}|{windspeed}|{winddir}' })] }];
    store.imagesets = [{ id: 'IT1', name: 'Rubber', kind: 'tyres', images: { S: 'data:SOFTPIC', W: 'data:WETPIC' } }];
    store.weathersystems = [{ ...sys, trackTempWet: 12, windDirWet: 90 }];
    await openRace({ ...setupWx, id: 's-wl', layout: 'LW' }, store.tracks[0], rows(1, 2)); await wait(60);
    const node = (type, lane, i = 0) => run(`live.nodes.filter(n=>n.w.type==='${type}'&&n.w.lane===${lane === null ? 'null' : lane})[${i}]`), html = (type, lane, i) => node(type, lane, i).val.innerHTML;
    say('the weather widgets are drawn on the timing page: before the start the Soft car (lane 1) and the Medium car (lane 2) on their drawn tyres, the weather Dry with "Cloudy in 1 lap", the conditions of the dry weather', html('tyre', 0, 0).includes('aria-label="Soft tyres"') && html('tyre', 1, 0).includes('aria-label="Medium tyres"') && html('wxforecast', null, 0).includes('Cloudy in 1 lap') && html('wxforecast', null, 0).includes('aria-label="Dry"') && html('wxconditions', null, 0).includes('30 °C')); 
    say('...a Tyres widget with a picture set shows the picture of the set where the set has one (the Soft), the other tyres are drawn', html('tyre', 0, 1).includes('src="data:SOFTPIC"'));
    say('...and the custom text says the weather in words', html('textrace', null, 0) === 'Dry|Cloudy in 1 lap|30 °C|10 km/h|SW');
    key(' '); await until(() => phase() === 'running', 3000); await wait(60);
    await lap(); await until(() => html('wxforecast', null, 0).includes('aria-label="Cloudy"'), 3000);
    say('after a lap it is cloudy: the forecast widget shows the cloud and "Rain in 1 lap", the conditions follow (25 °C, 16 km/h, WSW), the text widget too', html('wxforecast', null, 0).includes('Rain in 1 lap') && html('wxconditions', null, 0).includes('25 °C') && html('wxconditions', null, 0).includes('16 km/h') && html('wxforecast', null, 1) === '<span class="wxt">Cloudy</span>' && html('textrace', null, 0).startsWith('Cloudy|Rain in 1 lap|25 °C|16 km/h|'));
    say('...the Soft car does not have to change in the clouds', !html('tyre', 0, 0).includes('Change') && node('tyre', 0, 0).el.style.background !== '#ffb300');
    await lap(); await until(() => html('wxforecast', null, 0).includes('aria-label="Wet"'), 3000); await wait(60);
    say('after two laps it rains: the weather widget shows the rain cloud, the conditions the Weather System has for rain (track 12 °C, air 15 °C, wind 22 km/h from the east), the Soft car has to change and the Medium car too, as the widget says', html('wxforecast', null, 0).includes('Clearing in 3 laps') && html('wxconditions', null, 0).includes('12 °C') && html('wxconditions', null, 0).includes('15 °C') && html('wxconditions', null, 0).includes('22 km/h') && html('wxconditions', null, 0).includes('>E<') && html('tyre', 0, 0).includes('Change<small>tyres</small>') && html('tyre', 1, 0).includes('Change<small>tyres</small>'));
    say('...the Tyres widget with a picture set is amber too and keeps its picture', html('tyre', 0, 1).includes('src="data:SOFTPIC"') && html('tyre', 0, 1).includes('Change'));
    ctx.__sent = sent; await wait(1300);
    const same = run(`(() => { const V = LiveShare.viewer(); V.feedStatic(__sent.stat); V.feedDynamic(__sent.dyn, performance.now()); const S = V.shared(performance.now()); const bad = [];
      live.nodes.filter(n => ['tyre', 'wxforecast', 'wxconditions', 'textrace'].includes(n.w.type)).forEach(n => { const out = Timing.content(n.w, S).html; if (out !== n.val.innerHTML) bad.push(n.w.type + n.w.lane + ': ' + out + ' vs ' + n.val.innerHTML); }); return bad; })()`);
    say('a viewer rebuilt from the shared data (the live page on another screen) draws the same weather widgets as the race window', same.length === 0);
    if (same.length) console.log(same);
    run('live.pitBtns')[0].b.onclick(); await wait(400); run('live.pitBtns')[0].b.onclick(); await wait(60);
    await until(() => html('tyre', 0, 0).includes('aria-label="Wet tyres"'), 3000);
    say('after the pit stop the car is on Wet tyres: the widget shows them (not amber), also with the picture set (Wet has its picture)', html('tyre', 0, 0).includes('aria-label="Wet tyres"') && !html('tyre', 0, 0).includes('Change') && html('tyre', 0, 1).includes('src="data:WETPIC"') && html('tyre', 1, 0).includes('Change'));
    key('s'); await until(() => phase() === 'finished', 3000); await wait(150);
    store.layouts = []; store.imagesets = []; store.weathersystems = [sys]; }

  // ---------- the Race Director decides ----------
  const dir = { ...sys, id: 'w2', name: 'By hand', startMode: 'director' };
  store.weathersystems = [sys, dir];
  const setupDir = { ...setupWx, id: 's-dir', weather: 'w2' };
  await openRace(setupDir, store.tracks[0], rows(1, 2)); await wait(50);
  say('a weather system that leaves it to the Race Director has a forecast with nothing in it, and the weather buttons can be pressed', eng().wxPlan.director === true && eng().wxPlan.stages.length === 0 && eng().wxState === 'dry');
  run('live.actions.weather')('cloudy');
  say('a press before the start sets it (the cars are on the track from the start in the weather he chose)', state_() === 'cloudy' && eng().events.at(-1).by === 'director');
  key(' '); await until(() => phase() === 'running', 3000); await wait(60);
  run('live.actions.weather')('wet'); run('live.actions.weather')('rain'); run('live.actions.weather')(undefined); run('live.actions.weather')('wet');
  say('...in the race too; a state that is not one, and the state it already is, do nothing', state_() === 'wet' && eng().events.filter(e => e.type === 'weather').length === 2);
  api.liveCommand({ type: 'weather', state: 'clearing' }); await wait(30);
  say('the Race Director page can press them too (the command goes to the race window)', state_() === 'clearing');
  api.liveCommand({ type: 'weather', state: 'sunny' }); api.liveCommand({ type: 'weather' }); await wait(30);
  say('...a command with a state that is not one is ignored', state_() === 'clearing');
  run("live.phase = 'review'"); run('live.actions.weather')('dry'); { const kept = state_(); run("live.phase = 'running'"); say('...and in the review after the race the weather is not changed any more', kept === 'clearing'); }
  run("live.wxCount = 0; (function (f) { live.wxPanel.update = function () { live.wxCount++; return f.apply(this, arguments); }; })(live.wxPanel.update)");
  run('live.actions.weather')('dry');
  say('a press redraws the controls at once', run('live.wxCount') > 0 && state_() === 'dry');
  { const calls = []; const box = { hidden: true, innerHTML: '', onclick: null, querySelector: () => mk() }, P = run('WeatherPanel').build(box, { eng: () => eng(), lanes: [0, 1], phase: () => phase(), now: () => 0, send: s => calls.push(s) });
    const press = (state, disabled = false) => box.onclick({ target: { closest: () => ({ disabled, dataset: { wx: state }, blur() {} }) } });
    press('wet'); press('dry', true); box.onclick({ target: { closest: () => null } }); box.onclick({ target: {} });
    say('a press on a button of the controls says which weather; a button that is off, and a click on something else, do nothing', same_(calls, ['wet']) && box.hidden === false); }
  key('s'); await until(() => phase() === 'finished', 3000); await wait(150);

  // ---------- the Race Director page ----------
  { await openRace(setupDir, store.tracks[0], rows(1, 2)); key(' '); await until(() => phase() === 'running', 3000); await wait(1300);
    run("globalThis.__wxUp = 0; globalThis.__wxOpts = null; WeatherPanel.__orig = WeatherPanel.build; WeatherPanel.build = function (box, o) { const p = WeatherPanel.__orig.call(this, box, o); const u = p.update; globalThis.__wxOpts = o; p.update = function () { globalThis.__wxUp++; return u.apply(this, arguments); }; return p; }");
    const host = document.createElement('div'); await run('LiveView.mount')(host, {}); await wait(50); run('LiveView.go')('director'); await wait(80);
    const html = E('lv-body').innerHTML, wx = E('dir-wx').innerHTML;
    say('the Race Director page has the weather controls in a card of their own, with the four weather buttons and a row for each lane', html.includes('id="dir-wx"') && wx.includes('data-wx="cloudy"') && wx.includes('data-lane="0"') && wx.includes('data-lane="1"'));
    const before = cmds.length;
    E('dir-wx').onclick({ target: { closest: () => ({ disabled: false, dataset: { wx: 'wet' }, blur() {} }) } }); await wait(60);
    say('a press there is sent to the race window as a command with the weather, and the race window carries it out', cmds.length === before + 1 && same_(cmds.at(-1), { type: 'weather', state: 'wet' }) && state_() === 'wet');
    await wait(1300);
    say('...and the page follows: the weather and the tyres are sent with the race to the other screens', sent.dyn.wxState === 'wet' && sent.dyn.cars[0].tyre === 'S' && sent.dyn.cars[0].wx === -25 && sent.stat.cfg.weather.start.mode === 'director');
    { const n0 = run('__wxUp'); await wait(1300); const o = run('__wxOpts');
      say('...the controls of the page are drawn again when the race changes (not only when the page opens), with the clock of the race and with the lanes and the phase of the race', n0 > 0 && run('__wxUp') > n0 && typeof o.now() === 'number' && o.now() !== 0 && same_(o.lanes, [0, 1]) && o.phase() === 'running' && o.eng().weather.start.mode === 'director'); }
    run('WeatherPanel.build = WeatherPanel.__orig');
    run('LiveView.unmount')();
    key('s'); await until(() => phase() === 'finished', 3000); await wait(100); }
  { await openRace({ ...setupWx, weather: '' }, store.tracks[0], rows(1, 2)); key(' '); await until(() => phase() === 'running', 3000); await wait(1300);
    await run('LiveView.mount')(document.createElement('div'), {}); await wait(50); run('LiveView.go')('director'); await wait(80);
    say('a race without a weather system has no such card on the Race Director page', !E('lv-body').innerHTML.includes('id="dir-wx"'));
    run('LiveView.unmount')(); key('s'); await until(() => phase() === 'finished', 3000); await wait(100); }

  // ---------- heats ----------
  { const rnd = { ...sys, id: 'w4', name: 'Random', startMode: 'random', startFrom: 1, startTo: 9, sameInHeats: 'new' }, same = { ...rnd, id: 'w5', name: 'Same', sameInHeats: 'same' };
    store.weathersystems = [rnd, same];
    for (const [id, alike] of [['w5', true], ['w4', false]]) {
      const hs = { id: 'hs-' + id, name: 'Heats', sessionType: 'heats', heatBy: 'laps', laps: 2, heatPlan: 'manual', heats: 2, weather: id, fuelRules: 'f1', lightsMin: 0, lightsMax: 0, endRule: 'all', resultBy: 'laps' };
      let seeds = [];
      await openRace(hs, store.tracks[0], rows(1, 2)); await wait(50); seeds.push(eng().weather.seed);
      key(' '); await until(() => phase() === 'running', 3000); await wait(60);
      for (let n = 0; n < 3; n++) { key('1'); key('2'); await wait(80); }
      await until(() => phase() === 'between', 4000); await wait(60);
      seeds.push(eng().weather && eng().weather.seed);
      say(alike ? 'a heat race with "the same weather in every heat" gets the same seed in every heat (the same rain, so the heats are fair)' : 'a heat race with "new random weather in every heat" gets a new seed for every heat', phase() === 'between' && seeds.length === 2 && seeds.every(x => x > 0) && (seeds[0] === seeds[1]) === alike);
      key('s'); await until(() => phase() === 'finished', 3000); await wait(100);
    }
    const hs = { id: 'hs-n', name: 'Heats', sessionType: 'heats', heatBy: 'laps', laps: 2, heatPlan: 'manual', heats: 2, weather: 'w1', fuelRules: 'f1', lightsMin: 0, lightsMax: 0, endRule: 'all', resultBy: 'laps' };
    store.weathersystems = [sys];
    await openRace(hs, store.tracks[0], rows(1, 2)); await wait(50); key(' '); await until(() => phase() === 'running', 3000); await wait(60);
    for (let n = 0; n < 3; n++) { key('1'); key('2'); await wait(80); }
    await until(() => phase() === 'between', 4000); await wait(100);
    key('s'); await until(() => phase() === 'finished', 3000); await wait(150);
    { const s = saved.at(-1) && saved.at(-1)[0];
      say('the heats are saved with the weather: said once when it was the same in every heat', s && s.sessionType === 'heats' && typeof s.weatherNote === 'string' && s.weatherNote.startsWith('Cloudy from lap 2') && s.heatResults.every(h => !('weatherNote' in h))); } }

  { store.weathersystems = [dir];
    const hd = { id: 'hs-dir', name: 'Heats', sessionType: 'heats', heatBy: 'laps', laps: 2, heatPlan: 'manual', heats: 2, weather: 'w2', fuelRules: 'f1', lightsMin: 0, lightsMax: 0, endRule: 'all', resultBy: 'laps' };
    await openRace(hd, store.tracks[0], rows(1, 2)); await wait(50); key(' '); await until(() => phase() === 'running', 3000); await wait(60);
    run('live.actions.weather')('wet');
    for (let n = 0; n < 3; n++) { key('1'); key('2'); await wait(80); }
    await until(() => phase() === 'between', 4000); await wait(100);
    key(' '); await until(() => phase() === 'running', 4000); await wait(60);
    run('live.actions.weather')('cloudy');
    for (let n = 0; n < 3; n++) { key('1'); key('2'); await wait(80); }
    await until(() => phase() === 'finished', 4000); await wait(150);
    { const s = saved.at(-1) && saved.at(-1)[0], hr = (s && s.heatResults) || [];
      say('heats with other weather in each heat are saved with the weather of each heat (and none for the whole session)', s && s.sessionType === 'heats' && hr.length === 2 && hr[0].weatherNote === 'Rain from lap 1' && hr[1].weatherNote === 'Cloudy from lap 1' && !('weatherNote' in s)); } }

  // ---------- simulated cars ----------
  { const sim = { ...sys, id: 'w3', name: 'Long rain', startAt: 1, rainFor: 8, cloudyFor: 0, clearingFor: 0 };
    store.weathersystems = [sim];
    await openRace({ ...setupWx, weather: 'w3', laps: 40 }, store.tracks[0], rows(1, 2)); await wait(30);
    E('sim').checked = true; key(' '); await until(() => phase() === 'running', 3000);
    await until(() => eng().events.filter(e => e.type === 'tyres').length >= 2, 12000);
    say('simulated cars change their tyres in the pits when the weather asks for it (both cars did, without any button)', eng().events.filter(e => e.type === 'tyres' && e.tyre === 'W').map(e => e.car).sort().join() === '0,1' && eng().cars.every(c => c.tyre === 'W'));
    E('sim').checked = false; key('s'); await until(() => phase() === 'finished', 3000); await wait(100); }

  // ---------- the controls: what they show ----------
  const fakeWx = () => { const part = k => ({ dataset: { wx: k }, hidden: false, disabled: false, textContent: '', className: '', style: {}, attrs: {}, getAttribute(n) { return this.attrs[n]; }, setAttribute(n, v) { this.attrs[n] = v; } });
    const rowsOf = {}; [0, 1, 2].forEach(l => { const r = { parts: {} }; ['who', 'tyre', 'todo', 'hinder'].forEach(k => { r.parts[k] = part(k); }); r.querySelector = sel => r.parts[/data-wx="(\w+)"/.exec(sel)[1]]; rowsOf[l] = r; });
    const btns = {}; ['dry', 'cloudy', 'wet', 'clearing'].forEach(k => { btns[k] = part(k); });
    const info = part('info'), box = { hidden: true, innerHTML: '', querySelector: sel => { const t = /tr\[data-lane="(\d+)"\]/.exec(sel), b = /button\[data-wx="(\w+)"\]/.exec(sel); return t ? rowsOf[t[1]] : b ? btns[b[1]] : info; } };
    return { rowsOf, btns, info, box }; };
  { const { rowsOf, btns, info, box } = fakeWx(); let ph = 'running';
    const E2 = ctx.RaceEngine.createRace({ type: 'race', laps: 20, endRule: 'all', entries: [0, 1].map(i => ({ lane: i, driverId: 'd' + i, carId: 'c' + i, driverName: ['Alex', 'Sam'][i], carName: 'car', tyre: ['S', 'W'][i] })), fuel: { on: true, tank: 100, perLap: 2, rate: 10, target: 0, extra: 0, saving: 0, empty: 'retire', pitHold: 2000 }, weather: Wx_().clean({ startMode: 'director' }, 1) });
    E2.start(0);
    const panel = run('WeatherPanel').build(box, { eng: () => E2, lanes: [0, 1, 2], phase: () => ph, now: () => 0, send: () => {} });
    panel.update();
    say('the controls show the weather and what decides it, a pressed look for the weather that is on, and a row for each lane that has a car', box.hidden === false && info.textContent === 'Dry. The Race Director decides: press a state.' && btns.dry.attrs['aria-pressed'] === 'true' && btns.wet.attrs['aria-pressed'] === 'false' && btns.wet.disabled === false && rowsOf[0].parts.who.textContent === 'Alex' && rowsOf[1].parts.who.textContent === 'Sam');
    say('...the tyre of every car with its colour (a Soft is red, a Wet blue)', rowsOf[0].parts.tyre.textContent === 'S Soft' && rowsOf[0].parts.tyre.style.background === '#e8002d' && rowsOf[1].parts.tyre.textContent === 'W Wet' && rowsOf[1].parts.tyre.style.background === '#0067ff');
    E2.wxSet('wet', 1000); panel.update();
    say('...when it rains the Soft car is told to switch and how much it is hindered; the Wet car has nothing to do', rowsOf[0].parts.todo.textContent === 'Has to switch to Wet' && rowsOf[0].parts.hinder.textContent === 'Hindered 25%' && rowsOf[1].parts.todo.textContent === '' && rowsOf[1].parts.hinder.textContent === '' && btns.wet.attrs['aria-pressed'] === 'true' && btns.dry.attrs['aria-pressed'] === 'false');
    ph = 'finished'; panel.update();
    say('when the race is over the buttons are off', Object.values(btns).every(b => b.disabled === true));
    const none = { hidden: false, innerHTML: '', querySelector: () => mk() }, p2 = run('WeatherPanel').build(none, { eng: () => null, lanes: [0], phase: () => 'running', send: () => {} }); p2.update();
    say('with no engine, or one without weather, the controls are hidden', none.hidden === true); }

  console.log(fails ? fails + ' WEATHER SCREEN TESTS FAILED' : 'ALL WEATHER SCREEN TESTS PASSED'); process.exit(fails ? 1 : 0);
})();
