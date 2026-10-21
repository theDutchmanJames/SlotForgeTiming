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
for (const f of ['listnum.js', 'bop.js', 'weather.js', 'tyrewear.js', 'safetycar.js', 'pushsave.js', 'racelimit.js', 'endurance.js', 'failures.js', 'damage.js', 'engine.js', 'heats.js', 'rotation.js', 'championship.js', 'champpoints.js', 'season.js', 'tokens.js', 'speed.js', 'distance.js','stats.js','homestats.js','carstats.js','viewset.js','picture.js','uiscale.js','depth.js','theme.js','banner.js', 'icons.js', 'delta.js','avatars.js', 'picmemo.js', 'weatherwidgets.js', 'tyrewidgets.js', 'pacewidgets.js', 'boardorder.js', 'widgets.js', 'frame.js', 'backdrop.js','announcer.js','sound.js', 'timing.js', 'rows.js', 'richtext.js', 'canvas.js', 'liveshare.js', 'review.js', 'adjustpad.js', 'adjustui.js', 'dirfolder.js', 'penaltyui.js', 'rotationdrag.js','padui.js','livegrid.js', 'homegrid.js', 'drivergrid.js', 'homecards.js', 'liveview.js', 'database.js', 'landing.js', 'race.js', 'undo.js', 'editor.js','tokenui.js', 'bopui.js', 'damageui.js', 'weatherui.js', 'tyreui.js', 'pushsaveui.js', 'rotationui.js', 'championshipui.js', 'audioedit.js','widgetbuilder.js','transferui.js','themeui.js','hardware.js','trackmate.js','hardwareui.js', 'dsui.js', 'app.js']) vm.runInContext(fs.readFileSync(R + 'renderer/' + f, 'utf8'), ctx, { filename: f });
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
  say('...and the sets are made and kept like the fuel systems and penalty systems (the page lists the sets of that kind)', E('setupmgr').innerHTML.includes('Showers') && run('state.schema.weathersystems.plural') === 'Weather systems');

  // ---------- the fields ----------
  { const F = run('state.schema.racesetups.fields'), isShown = run('isShown'), f = F.find(x => x.key === 'weather');
    const shown = type => isShown(f, k => ({ sessionType: type })[k]);
    say('a race setup has a Weather system field in the rules: a choice of the weather systems, "No weather" to begin with, that says what it needs', f && f.group === 'rules' && f.type === 'ref' && f.ref === 'weathersystems' && f.blank === 'No weather' && f.hint.includes('Hindering the cars needs a Fuel system'));
    say('...it is asked for a race (also one limited by a time) and a heat race, and not for practice, qualifying or a Time Token Session', ['race', 'heats'].every(shown) && ['practice', 'qualifying', 'tokens'].every(t => !shown(t)));
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
    say('...and so has a race without a fuel system (the cars are only not hindered)', eng().weather !== null && !!run('live.wxPanel') && eng().fuel.on === false);
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

  // ---------- 1.31.0 / 1.32.0: the Race Director gives a car another tyre (the Tyre Change folder; the dry tyre in a race with weather) ----------
  { const upd = [], keepUpdate = api.update; api.update = async (e, id, p) => { upd.push([e, id, p]); return {}; };
    const own = i => eng().cars[i].tyreOwn, now_ = i => eng().cars[i].tyre, tyres = () => eng().events.filter(e => e.type === 'tyreset');
    say('the cars start on the dry tyre of their Slotcar (lane 1 Soft from its Database entry, lane 2 the standard Medium)', own(0) === 'S' && own(1) === 'M' && now_(0) === 'S' && now_(1) === 'M');
    say('...the Tyre Change folder of this race (it has weather) has Intermediate and Wet greyed out, the dry tyres open', E('typanel').innerHTML.includes('value="INT" disabled') && E('typanel').innerHTML.includes('value="W" disabled') && !E('typanel').innerHTML.includes('value="S" disabled') && E('typanel').innerHTML.includes('pit stops'));
    run("live.tyCount = 0; (function (f) { live.tyPanel.update = function () { live.tyCount++; return f.apply(this, arguments); }; })(live.tyPanel.update)");
    run('live.actions.tyre')(0, 'H');
    say('the Race Director changes the dry tyre of a car on the race screen: lane 1 goes from Soft to Hard, and the car is on it at once (at the time of the race clock)', own(0) === 'H' && now_(0) === 'H' && now_(1) === 'M' && tyres().length === 1 && tyres()[0].by === 'director' && tyres()[0].was === 'S' && tyres()[0].tyre === 'H' && tyres()[0].t > 0);
    say('...and the Tyre Change panel is drawn again at once', run('live.tyCount') > 0);
    await wait(30);
    say('...for this race only: the Database is not asked to change anything', upd.length === 0);
    run('live.actions.tyre')(0, 'H'); run('live.actions.tyre')(0, 'W'); run('live.actions.tyre')(0, 'INT'); run('live.actions.tyre')(0, 'X'); run('live.actions.tyre')(5, 'S'); run('live.actions.tyre')(0, undefined);
    say('...the tyre it already has, a Wet or Intermediate tyre (in a race with weather those come from the pits), a tyre that does not exist, an empty lane and no tyre at all do nothing', own(0) === 'H' && tyres().length === 1 && upd.length === 0);
    run('live.actions.tyre')(1, 'SS', true); await wait(30);
    say('with the tick box the Slotcar in the Database gets it too (one change of the slotcar with the tyre only)', own(1) === 'SS' && upd.length === 1 && same_(upd[0], ['slotcars', 'c2', { tyreCompound: 'SS' }]));
    run('live.actions.tyre')(0, 'M', 'yes'); run('live.actions.tyre')(0, 'S', false); await wait(30);
    say('...only a real true saves it (a word, or false, does not)', own(0) === 'S' && upd.length === 1);
    api.liveCommand({ type: 'tyre', lane: 0, tyre: 'M', save: true }); await wait(30);
    say('the Race Director page can do it too: the command goes to the race window, with the tick box if he wants it', own(0) === 'M' && upd.length === 2 && same_(upd[1], ['slotcars', 'c1', { tyreCompound: 'M' }]));
    api.liveCommand({ type: 'tyre', lane: 1, tyre: 'S' }); api.liveCommand({ type: 'tyre', lane: 1, tyre: 'W' }); api.liveCommand({ type: 'tyre' }); await wait(30);
    say('...a command without the tick box leaves the Database alone, and one with a tyre the race does not give (Wet in this race with weather), or none, is ignored', own(1) === 'S' && upd.length === 2);
    api.liveCommand({ type: 'tyre', lane: 1, tyre: 'M', save: 'yes' }); await wait(30);
    say('...and a save that is not exactly true does not change the Database, also when the command reaches the race window without the server', own(1) === 'M' && upd.length === 2);
    const wasPhase = phase(); run("live.phase = 'review'"); run('live.actions.tyre')(1, 'H'); const kept = own(1); run("live.phase = 'running'");
    say('in the review after the race the tyres are not changed any more', kept === 'M' && wasPhase === 'running');
    api.update = async () => { throw new Error('database is closed'); };
    run('live.actions.tyre')(1, 'H', true); await wait(30);
    say('if the Database cannot be written the race goes on with the new tyre', own(1) === 'H');
    api.update = keepUpdate;
    // the Tyre Change panel
    { const sets = []; const mkSel = lane => ({ dataset: { tyOwn: String(lane) }, value: 'M', disabled: false, blurred: 0, blur() { this.blurred++; } });
      const box = { hidden: true, innerHTML: '', onchange: null, onclick: null, querySelector: () => mk() };
      const P = run('TyrePanel').build(box, { eng: () => eng(), lanes: [0, 1], phase: () => phase(), weather: true, setTyre: (l, c, sv) => sets.push([l, c, sv]) });
      const html = box.innerHTML;
      say('the Tyre Change panel has a Tyre choice column: a choice for each lane with all six tyres, and the tick box for the Database', html.includes('<th>Tyre choice</th>') && html.includes('data-ty-own="0"') && html.includes('data-ty-own="1"') && (html.match(/<option /g) || []).length === 12 && ['H', 'M', 'S', 'SS', 'INT', 'W'].every(c => html.includes(`value="${c}"`)) && html.includes('data-ty-save="1"') && html.includes('Also change the tyre choice of the Slotcar in the Database') && html.includes('this race only'));
      say('...in a race with weather Intermediate and Wet can not be chosen (they come from the pit stops), and the panel says so', (html.match(/ disabled>/g) || []).length === 4 && html.includes('value="INT" disabled') && html.includes('value="W" disabled') && !html.includes('value="S" disabled') && html.includes('Wet and Intermediate tyres come from the pit stops'));
      const free = { hidden: true, innerHTML: '', onchange: null, querySelector: () => mk() }; run('TyrePanel').build(free, { eng: () => eng(), lanes: [0, 1], phase: () => phase(), weather: false, setTyre: () => {} });
      say('...in a race without weather every tyre can be chosen, and there is nothing to say about the pit stops', !free.innerHTML.includes(' disabled>') && !free.innerHTML.includes('pit stops') && (free.innerHTML.match(/<option /g) || []).length === 12);
      const s0 = mkSel(0), s1 = mkSel(1); box.onchange({ target: s0 }); s1.value = 'S'; box.onchange({ target: s1 });
      say('picking a tyre sends the lane and the tyre, not saved to begin with, and lets go of the choice', same_(sets, [[0, 'M', false], [1, 'S', false]]) && s0.blurred === 1 && s1.blurred === 1);
      box.onchange({ target: { dataset: { tySave: '1' }, checked: true } }); s0.value = 'H'; box.onchange({ target: s0 });
      say('with the box ticked the choice is sent as one to save too', same_(sets.at(-1), [0, 'H', true]));
      const box2 = { hidden: true, innerHTML: '', onchange: null, querySelector: () => mk() }; run('TyrePanel').build(box2, { eng: () => eng(), lanes: [0], phase: () => phase(), weather: true, setTyre: (l, c, sv) => sets.push([l, c, sv]) });
      s1.value = 'SS'; box2.onchange({ target: s1 });
      say('...and the box is remembered by the next panel that is built (while the app is open), also ticked on the screen', same_(sets.at(-1), [1, 'SS', true]) && box2.innerHTML.includes('data-ty-save="1" checked>'));
      box.onchange({ target: { dataset: { tySave: '1' }, checked: false } }); const n = sets.length; const dis = mkSel(0); dis.disabled = true; box.onchange({ target: dis }); box.onchange({ target: { dataset: {} } }); box.onchange({ target: null });
      say('a choice that is switched off, and a change of something else, are ignored', sets.length === n);
      const wxBox = { hidden: true, innerHTML: '', onchange: null, querySelector: () => mk() }; run('WeatherPanel').build(wxBox, { eng: () => eng(), lanes: [0, 1], phase: () => phase(), now: () => 0, send: () => {} });
      say('the Weather panel keeps the weather and the tyres the cars are on, and has no tyre choice any more (it moved to Tyre Change)', wxBox.innerHTML.includes('data-wx="tyre"') && !wxBox.innerHTML.includes('Dry tyre') && !wxBox.innerHTML.includes('data-wx-own') && !wxBox.innerHTML.includes('<select'));
      // what update() does with the choices
      const selOf = {}, chip = {}, who = {}; [0, 1, 2].forEach(l => { selOf[l] = { value: '', disabled: false }; chip[l] = { textContent: '', style: {} }; who[l] = { textContent: '' }; });
      const rowOf = l => ({ querySelector: sel => (/data-ty-own/.test(sel) ? selOf[l] : /"tyre"/.test(sel) ? chip[l] : who[l]) }), rows_ = { 0: rowOf(0), 1: rowOf(1), 2: rowOf(2) };
      const box3 = { hidden: true, innerHTML: '', querySelector: sel => { const t = /tr\[data-lane="(\d+)"\]/.exec(sel); return t ? rows_[t[1]] : mk(); } };
      let ph = 'running'; const P3 = run('TyrePanel').build(box3, { eng: () => eng(), lanes: [0, 1, 2], phase: () => ph, weather: true, setTyre: () => {} }); P3.update();
      say('the panel shows the driver, the tyres of each car (with its colour) and its tyre choice, and the choices are on for as long as the race is going', selOf[0].value === own(0) && selOf[1].value === own(1) && selOf[0].disabled === false && selOf[1].disabled === false && who[0].textContent === 'Alex' && chip[0].textContent === `${now_(0)} ${{ H: 'Hard', M: 'Medium', S: 'Soft', SS: 'Supersoft' }[now_(0)]}` && chip[0].style.background !== undefined);
      run('live.actions.tyre')(0, 'SS'); P3.update();
      say('...and follow the race when the tyre is changed from somewhere else (the Race Director page)', selOf[0].value === 'SS' && chip[0].textContent === 'SS Supersoft' && chip[0].style.background === '#9b4dff');
      selOf[1].value = 'S'; const keepActive = document.activeElement; document.activeElement = selOf[1]; P3.update(); const underFinger = selOf[1].value; document.activeElement = keepActive; P3.update();
      say('...but never move under a finger that is choosing (the choice that has the focus keeps what he picked, and is put right once he lets go)', underFinger === 'S' && selOf[1].value === own(1));
      ph = 'finished'; P3.update();
      say('when the race is over the choices are off', selOf[0].disabled === true && selOf[1].disabled === true);
      const none = { hidden: false, innerHTML: '', querySelector: () => mk() }, p2 = run('TyrePanel').build(none, { eng: () => null, lanes: [0], phase: () => 'running', weather: false, setTyre: () => {} }); p2.update();
      say('with no engine (a viewer that has nothing yet) the panel is hidden', none.hidden === true);
    }
    // the Race Director page
    { run("globalThis.__tyUp = 0; TyrePanel.__orig = TyrePanel.build; TyrePanel.build = function (box, o) { const p = TyrePanel.__orig.call(this, box, o); const u = p.update; p.update = function () { globalThis.__tyUp++; return u.apply(this, arguments); }; return p; }");
      const host = document.createElement('div'); await run('LiveView.mount')(host, {}); await wait(50); run('LiveView.go')('director'); await wait(80);
      const ty = E('dir-ty').innerHTML, before = cmds.length;
      { const n0 = run('__tyUp'); await wait(1300);
        say('...the panel of the page is drawn again when the race changes, and has Intermediate and Wet greyed out in this race with weather', n0 > 0 && run('__tyUp') > n0 && ty.includes('value="INT" disabled') && ty.includes('value="W" disabled') && !ty.includes('value="H" disabled')); }
      say('the Race Director page has a Tyre Change folder with the tyre choice for each lane and the tick box (and the Weather folder has none)', ty.includes('<th>Tyre choice</th>') && ty.includes('data-ty-own="0"') && ty.includes('data-ty-own="1"') && ty.includes('data-ty-save="1"') && E('lv-body').innerHTML.includes('data-dirf="tyre"') && !E('dir-wx').innerHTML.includes('data-wx-own'));
      E('dir-ty').onchange({ target: { dataset: { tyOwn: '1' }, value: 'H', disabled: false, blur() {} } }); await wait(60);
      say('a choice there is sent to the race window as a command (without the tick box: no save), and the race window carries it out', cmds.length === before + 1 && same_(cmds.at(-1), { type: 'tyre', lane: 1, tyre: 'H' }) && own(1) === 'H');
      E('dir-ty').onchange({ target: { dataset: { tySave: '1' }, checked: true } }); E('dir-ty').onchange({ target: { dataset: { tyOwn: '0' }, value: 'H', disabled: false, blur() {} } }); await wait(60);
      say('...with the tick box ticked the command asks to save it too', same_(cmds.at(-1), { type: 'tyre', lane: 0, tyre: 'H', save: true }) && own(0) === 'H');
      E('dir-ty').onchange({ target: { dataset: { tySave: '1' }, checked: false } });
      run('TyrePanel.build = TyrePanel.__orig');
      run('LiveView.unmount')(); }
    { // 1.36.0: the Driver stats page of a race with a weather system has the tyre of the car (the default grid has the cell), which a race without weather does not
      const host = document.createElement('div'); await run('LiveView.mount')(host, {}); await wait(50); run('LiveView.go')('driver'); await wait(80);
      const h = E('lv-dstats').innerHTML;
      say('the Driver stats page of a race with weather has the tyre cell, with its label and the tyre drawn (a picture or its name)', /data-cell="tyre" style="[^"]*"[^>]*>(<span[^>]*>Tyres<\/span>)<strong>[^]*?<(svg|img|span)\b/.test(h));
      say('...and the cell is not blank (the race has a weather system)', !/lv-dg quiet" style="grid-column:1 \/ span 2;grid-row:\d \/ span 1"><\/div><div class="lv-dg lv-stat" data-cell="flag"/.test(h));
      run('LiveView.unmount')(); }
    api.update = async (e, id, p) => { upd.push([e, id, p]); return {}; };
    { // the controls of the race screen itself
      const box = E('typanel'), n = upd.length; box.onchange({ target: { dataset: { tySave: '1' }, checked: true } }); box.onchange({ target: { dataset: { tyOwn: '1' }, value: 'S', disabled: false, blur() {} } }); await wait(30);
      say('the Tyre Change folder of the race screen itself does the same: a tyre and the tick box change the car and the slot car in the Database', own(1) === 'S' && upd.length === n + 1 && same_(upd.at(-1), ['slotcars', 'c2', { tyreCompound: 'S' }]));
      box.onchange({ target: { dataset: { tySave: '1' }, checked: false } }); box.onchange({ target: { dataset: { tyOwn: '1' }, value: 'H', disabled: false, blur() {} } }); await wait(30);
      say('...and without the tick box only the car changes', own(1) === 'H' && upd.length === n + 1); }
    key('s'); await until(() => phase() === 'finished', 3000); await wait(100);
    await openRace(setupDir, store.tracks[0], [{ driverId: 'd1', carId: '' }, { driverId: 'd2', carId: 'c2' }]); await wait(50);
    { const n = upd.length; run('live.actions.tyre')(0, 'H', true); run('live.actions.tyre')(1, 'SS', true); await wait(30);
      say('a lane without a slot car can be given a tyre too, but there is no slot car in the Database to change (the other lane is saved)', eng().cars[0].tyreOwn === 'H' && eng().cars[1].tyreOwn === 'SS' && upd.length === n + 1 && same_(upd.at(-1), ['slotcars', 'c2', { tyreCompound: 'SS' }])); }
    key(' '); await until(() => phase() === 'running', 3000);
    key('s'); await until(() => phase() === 'finished', 3000); await wait(100);
    // 1.32.0: a race without a weather system has the Tyre Change folder too
    const setupNo = { ...setupWx, id: 's-nowx', name: 'Dry race', weather: '' };
    await openRace(setupNo, store.tracks[0], rows(1, 2)); await wait(50);
    { const n = upd.length, host = E('racehost').innerHTML;
      say('1.32.0: a race without a weather system has the Tyre Change folder (purple, after the others) and no Weather folder', !eng().weather && host.includes('data-dirf="tyre"') && host.includes('dir-purple') && host.includes('id="typanel"') && !host.includes('data-dirf="weather"') && !host.includes('id="wxpanel"'));
      say('...with the panel built: a choice for each lane with all six tyres, none switched off, nothing about pit stops, and no Weather panel', !!run('live.tyPanel') && !run('live.wxPanel') && E('typanel').innerHTML.includes('data-ty-own="0"') && E('typanel').innerHTML.includes('data-ty-own="1"') && !E('typanel').innerHTML.includes(' disabled>') && !E('typanel').innerHTML.includes('pit stops'));
      run('live.actions.tyre')(0, 'INT'); run('live.actions.tyre')(1, 'W', true); await wait(30);
      say('the Race Director gives a car an Intermediate tyre, and another a Wet one (and the Database of that one is changed too): there is no weather to refuse them', eng().cars[0].tyre === 'INT' && eng().cars[0].tyreOwn === 'INT' && eng().cars[1].tyre === 'W' && upd.length === n + 1 && same_(upd.at(-1), ['slotcars', 'c2', { tyreCompound: 'W' }]));
      key(' '); await until(() => phase() === 'running', 3000); await wait(60);
      run('live.actions.tyre')(0, 'SS'); api.liveCommand({ type: 'tyre', lane: 1, tyre: 'H' }); await wait(60);
      say('...also while the race runs, from the race screen and from the Race Director page', eng().cars[0].tyre === 'SS' && eng().cars[1].tyre === 'H' && eng().events.filter(e => e.type === 'tyreset').length === 4);
      for (let k = 0; k < 2; k++) { key('1'); key('2'); await wait(80); }
      const host2 = document.createElement('div'); await run('LiveView.mount')(host2, {}); await wait(50); run('LiveView.go')('director'); await wait(80);
      say('the Race Director page of that race has the Tyre Change folder with the choices (all six open, there is no weather), and no Weather folder', E('lv-body').innerHTML.includes('data-dirf="tyre"') && E('dir-ty').innerHTML.includes('data-ty-own="1"') && !E('dir-ty').innerHTML.includes(' disabled>') && !(E('lv-body').innerHTML.includes('data-dirf="weather"')) && !E('lv-body').innerHTML.includes('id="dir-wx"'));
      const before = cmds.length; E('dir-ty').onchange({ target: { dataset: { tyOwn: '0' }, value: 'M', disabled: false, blur() {} } }); await wait(60);
      say('...and a choice there reaches the race', cmds.length === before + 1 && same_(cmds.at(-1), { type: 'tyre', lane: 0, tyre: 'M' }) && eng().cars[0].tyre === 'M');
      run('LiveView.unmount')();
      key('s'); await until(() => phase() === 'finished', 3000); await wait(150);
      const sv = saved.at(-1) && saved.at(-1)[0], rowOf = nm => sv.standings.find(x => x.driverName === nm);
      say('the result that is saved says what the Race Director did, in words (before the first lap, or after the lap he did it)', !!sv && rowOf('Alex').tyreNote.startsWith('Intermediate tyres, set by the Race Director before the first lap, Supersoft tyres, set by the Race Director before the first lap, Medium tyres, set by the Race Director after lap ') && /after lap [12]$/.test(rowOf('Alex').tyreNote) && rowOf('Sam').tyreNote === 'Wet tyres, set by the Race Director before the first lap, Hard tyres, set by the Race Director before the first lap');
    }
    // a Time Token Session has no Tyre Change folder (its lanes are sold to guests: there is no car to choose a tyre for)
    run("globalThis.__tyBuilt = 0; TyrePanel.__orig2 = TyrePanel.build; TyrePanel.build = function () { globalThis.__tyBuilt++; return TyrePanel.__orig2.apply(this, arguments); }");
    await openRace({ id: 's-tk', name: 'Tokens', sessionType: 'tokens', layout: '' }, store.tracks[1], rows(1, 2)); await wait(50);
    { const host3 = document.createElement('div'); await run('LiveView.mount')(host3, {}); await wait(50); run('LiveView.go')('director'); await wait(80);
      say('a Time Token Session has no Tyre Change folder, on the race screen and on the Race Director page (which is there, with its Calls)', E('lv-body').innerHTML.includes('id="lv-dir"') && E('racehost').innerHTML.includes('data-dirf="track"') && !E('racehost').innerHTML.includes('data-dirf="tyre"') && !run('live.tyPanel') && !E('lv-body').innerHTML.includes('data-dirf="tyre"') && !E('lv-body').innerHTML.includes('id="dir-ty"') && run('__tyBuilt') === 0);
      run('LiveView.unmount')(); run('TyrePanel.build = TyrePanel.__orig2'); }
    api.update = keepUpdate;
  }
  key('s'); await until(() => phase() === 'finished', 3000); await wait(150);

  // ---------- the Race Director page ----------
  { await openRace(setupDir, store.tracks[0], rows(1, 2)); key(' '); await until(() => phase() === 'running', 3000); await wait(1300);
    run("globalThis.__wxUp = 0; globalThis.__wxOpts = null; WeatherPanel.__orig = WeatherPanel.build; WeatherPanel.build = function (box, o) { const p = WeatherPanel.__orig.call(this, box, o); const u = p.update; globalThis.__wxOpts = o; p.update = function () { globalThis.__wxUp++; return u.apply(this, arguments); }; return p; }");
    const host = document.createElement('div'); await run('LiveView.mount')(host, {}); await wait(50); run('LiveView.go')('director'); await wait(80);
    const html = E('lv-body').innerHTML, wx = E('dir-wx').innerHTML;
    say('the Race Director page has the weather controls in a folder of their own, with the four weather buttons and a row for each lane', html.includes('id="dir-wx"') && wx.includes('data-wx="cloudy"') && wx.includes('data-lane="0"') && wx.includes('data-lane="1"'));
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
  // ---------- 1.11.1: the folders of the Race Director page ----------
  { store.damagesystems = [{ id: 'dm1', name: 'Standard', stop: 'overlap', deslotPoints: 1, latePoints: 1, earlyPoints: 1, levels: [{ name: 'Light damage', from: 3, seconds: 0.2, urgency: 'whenever', within: 0, action: 'repair' }], incidents: [{ name: 'Contact', points: 2 }] }];
    await openRace({ ...setupWx, damageSystem: 'dm1', bop: 'on' }, store.tracks[0], rows(1, 2)); key(' '); await until(() => phase() === 'running', 3000); await wait(1300);
    const host = document.createElement('div'); await run('LiveView.mount')(host, {}); await wait(50);
    const fakes = ['penalties', 'bop', 'damage', 'weather'].map(id => ({ dataset: { dirf: id }, open: true })), body = E('lv-body'), keepQ = body.querySelectorAll;
    body.querySelectorAll = sel => (sel === 'details.dirfolder' ? fakes : []);
    run('LiveView.go')('director'); await wait(80);
    let html = E('lv-body').innerHTML; const at = k => html.indexOf(`data-dirf="${k}"`), part = (k, next) => html.slice(at(k), next ? at(next) : undefined);
    say('the Race Director page: the buttons and the Calls card stay as they were (Calls is not a folder), and come first', html.indexOf('data-cmd="start"') < html.indexOf('<h3>Calls</h3>') && html.includes('<div class="card"><h3>Calls</h3>') && at('calls') === -1 && html.indexOf('<h3>Calls</h3>') < at('penalties'));
    say('...then the folders in this order: Adjust (1.12.0), Penalties, Balance of Power, Damage, Weather, Tyre Change (1.32.0)', at('adjust') > 0 && at('adjust') < at('penalties') && at('penalties') < at('bop') && at('bop') < at('damage') && at('damage') < at('weather') && at('weather') < at('tyre') && (html.match(/<details class="dbfolder dirfolder/g) || []).length === 6);
    say('...each folder has the look of the Help folders (a title and a line beside it) and a colour of its own: Penalties yellow, Balance of Power white, Damage red, Weather blue, Tyre Change purple', html.includes('<details class="dbfolder dirfolder dir-yellow" data-dirf="penalties" open><summary><strong>Penalties</strong> <span class="muted">') && html.includes('class="dbfolder dirfolder dir-white" data-dirf="bop"') && html.includes('class="dbfolder dirfolder dir-red" data-dirf="damage"') && html.includes('class="dbfolder dirfolder dir-blue" data-dirf="weather"') && html.includes('<strong>Balance of Power</strong>') && html.includes('<strong>Damage</strong>') && html.includes('<strong>Weather</strong>') && html.includes('class="dbfolder dirfolder dir-purple" data-dirf="tyre"') && html.includes('<strong>Tyre Change</strong>'));
    say('...with the penalty points and the log in the Penalties folder, and the controls of each panel in its own folder', part('penalties', 'bop').includes('data-cmd="penalty"') && part('penalties', 'bop').includes('Penalty log') && part('bop', 'damage').includes('id="dir-bop"') && part('damage', 'weather').includes('id="dir-dm"') && part('weather').includes('id="dir-wx"') && !html.includes('class="card boppanel"'));
    say('...all open to begin with, as the page was', ['penalties', 'bop', 'damage', 'weather'].every(k => html.includes(`data-dirf="${k}" open>`)));
    fakes[2].open = false; fakes[2].ontoggle(); run('LiveView.go')('director'); await wait(60); html = E('lv-body').innerHTML;
    say('a folder that is closed stays closed when the page is drawn again; the others stay open', html.includes('data-dirf="damage"><summary>') && !html.includes('data-dirf="damage" open') && html.includes('data-dirf="weather" open>') && html.includes('data-dirf="penalties" open>'));
    fakes[2].open = true; fakes[2].ontoggle(); run('LiveView.go')('director'); await wait(60); html = E('lv-body').innerHTML;
    say('...and opening it again is remembered too', html.includes('data-dirf="damage" open>'));
    { const css = require('fs').readFileSync(__dirname + '/../renderer/styles.css', 'utf8');
      say('the colours are in the stylesheet (the folder takes its colour from --fc), white is a grey on a light theme, and the name inside a panel is not repeated under the folder name', /\.dirfolder\{--fc:var\(--accent\);border-left-color:var\(--fc\)\}/.test(css) && /\.dbfolder\.dirfolder>summary\{background:color-mix\(in srgb,var\(--fc\) 16%,var\(--panel\)\)\}/.test(css) && /\.dir-yellow\{--fc:#f2b705\}/.test(css) && /\.dir-white\{--fc:#ffffff\}/.test(css) && /\.dir-red\{--fc:#e5484d\}/.test(css) && /\.dir-blue\{--fc:#4c9aff\}/.test(css) && /\.dir-purple\{--fc:#9b4dff\}/.test(css) && /\[data-theme="light"\] \.dir-white,\[data-theme="ocean"\] \.dir-white\{--fc:#7d8590\}/.test(css) && /\.dirfolder \.bophead>strong\{display:none\}/.test(css)); }
    { // 1.12.1: the Damage points pad of the Adjust folder (this race has a damage system), and the plain colours of the folder
      const mkb = (dataset, extra = {}) => ({ dataset, disabled: false, ...extra });
      const laneB = [0, 1].map(l => mkb({ adjLane: String(l) }, { setAttribute(k, v) { this[k] = v; }, querySelector: () => ({ textContent: '' }) }));
      const pads = ['points', 'damage', 'time', 'laps', 'champ'].map(id => ({ dataset: { pad: id }, hidden: false, btns: [mkb({ sign: '1' }), mkb({ sign: '-1' })], querySelectorAll() { return this.btns; } }));
      const undoB = mkb({});
      E('dir-adj').querySelectorAll = sel => (sel === '[data-adj-lane]' ? laneB : sel === '.pad' ? pads : sel === '[data-adj-undo]' ? [undoB] : []);
      const clickA = (sel, dataset) => E('lv-body').onclick({ target: { closest: s => (s === sel ? { dataset, disabled: false } : null) } });
      const again = async cond => { await until(cond, 3000); cbs.dyn.forEach(f => f(plain(sent.dyn))); };
      cbs.dyn.forEach(f => f(plain(sent.dyn)));
      const adj = E('dir-adj').innerHTML, page = E('lv-body').innerHTML;
      say('the Adjust folder has the normal colours of the theme (plain), not the accent', page.includes('<details class="dbfolder dirfolder dir-plain" data-dirf="adjust"') && /\.dir-plain\{--fc:var\(--muted\)\}/.test(require('fs').readFileSync(__dirname + '/../renderer/styles.css', 'utf8')) && /\.dbfolder\.dirfolder\.dir-plain>summary\{background:var\(--panel\)\}/.test(require('fs').readFileSync(__dirname + '/../renderer/styles.css', 'utf8')));
      say('a race with a damage system has a red Damage points pad after the penalty points, with the standard values 1, 2 and 4', adj.indexOf('data-pad="points"') < adj.indexOf('data-pad="damage"') && adj.indexOf('data-pad="damage"') < adj.indexOf('data-pad="time"') && adj.includes('--pc:#e5484d') && [1, 2, 4].every(v => adj.includes(`data-pad-do="damage" data-sign="1" data-v="${v}"`)) && pads[1].hidden === false);
      say('...with no lane picked the pad is switched off', pads[1].btns.every(b => b.disabled));
      clickA('[data-adj-lane]', { adjLane: '1' });
      say('...with lane 2 picked + is on and − is off (the damage panel allows a hit, and there is no damage to take back yet)', pads[1].btns[0].disabled === false && pads[1].btns[1].disabled === true);
      const c0 = cmds.length; clickA('[data-pad-do]', { padDo: 'damage', v: '2', sign: '1' }); await again(() => sent.dyn && sent.dyn.cars[1].dmg === 2);
      say('+2 gives lane 2 two damage points, through the damage system, and then − is on', cmds.length === c0 + 1 && cmds[c0].type === 'pad' && cmds[c0].group === 'damage' && cmds[c0].lane === 1 && cmds[c0].amount === 2 && eng().cars[1].dmg === 2 && pads[1].btns[1].disabled === false && E('adj-last').textContent === `Last: +2 damage points to ${eng().cars[1].driverName}`);
      say('...the damage log has it as a hit of the Race Director', eng().events.some(e => e.type === 'damage' && e.car === 1 && e.delta === 2 && e.why === 'director'));
      clickA('[data-adj-undo]', {}); await again(() => sent.dyn.cars[1].dmg === 0);
      say('Undo takes the 2 points back', cmds[cmds.length - 1].amount === -2 && eng().cars[1].dmg === 0 && pads[1].btns[1].disabled === true);
      const n = eng().cars[1].dmg; api.liveCommand({ type: 'pad', group: 'damage', lane: 1, amount: 21 }); api.liveCommand({ type: 'pad', group: 'damage', lane: 1, amount: 1.5 }); api.liveCommand({ type: 'pad', group: 'damage', lane: 7, amount: 1 }); await wait(60);
      say('the race window refuses damage points that are not a whole number from -20 to 20, and a lane without a car', eng().cars[1].dmg === n && eng().cars[0].dmg === 0);
    }
    body.querySelectorAll = keepQ;
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

  { store.weathersystems = [dir]; // 1.31.0: the dry tyre the Race Director gives a car in a heat: the next heat starts from the Database again, or from the new tyre when the Slotcar was changed too
    const hd2 = { id: 'hs-tyre', name: 'Heats', sessionType: 'heats', heatBy: 'laps', laps: 2, heatPlan: 'manual', heats: 2, weather: 'w2', fuelRules: 'f1', lightsMin: 0, lightsMax: 0, endRule: 'all', resultBy: 'laps' };
    for (const save of [false, true]) {
      await openRace(hd2, store.tracks[0], rows(1, 2)); await wait(50); key(' '); await until(() => phase() === 'running', 3000); await wait(60);
      const ci = () => eng().cars.findIndex(c => c.carId === 'c1'), first = eng().cars[ci()].tyreOwn;
      run('live.actions.tyre')(eng().cars[ci()].lane, 'H', save); const during = eng().cars[ci()].tyreOwn;
      for (let n = 0; n < 3; n++) { key('1'); key('2'); await wait(80); }
      await until(() => phase() === 'between', 4000); await wait(60);
      say(save ? 'in a heat race the Race Director gives a car Hard; with the tick box the next heat starts on Hard (the Slotcar was changed)' : 'in a heat race the Race Director gives a car Hard; without the tick box the next heat starts from the Slotcar again (Soft)', first === 'S' && during === 'H' && phase() === 'between' && eng().cars[ci()].tyreOwn === (save ? 'H' : 'S') && eng().cars.find(c => c.carId === 'c2').tyreOwn === 'M');
      key('s'); await until(() => phase() === 'finished', 3000); await wait(100);
    } }

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
