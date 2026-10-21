// 1.54.0: the Push and Save System on screen: its page (a sub-tab of Race Setup after Safety Car Systems) and form (the ready-made systems), the race setup field, the engine the race window builds (with the records of the drivers),
// the Push and Save folder, the Pace meter widget, the lap review, the Home Rules card, and what is shared with the other windows, against a stand-in for the app window.
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
const saved = [], added = [], updated = [];
const sent = { stat: null, dyn: null, n: 0, last: null, log: [], gaps: 0 }, cbs = { stat: [], dyn: [], cmd: [] }, cmds = []; // what the race window shares with other windows (as plain text, like the real link)
// like the app does: the messages of the race window are put together into the whole state (sent.dyn), which a window that opens late is given; sent.last is the last message as it was sent
const merge = (state, m) => vm.runInContext('LiveShare', ctx).applyDynamic(state, m);
const plain = d => { const x = { ...d }; delete x.seq; return x; }; // a whole state without a message number (what an older race window sends): always accepted
const api = { liveStatic: s => { sent.stat = JSON.parse(JSON.stringify(structuredClone(s))); sent.dyn = null; sent.last = null; }, livePush: d => { const m = JSON.parse(JSON.stringify(structuredClone(d))); sent.last = m; sent.log.push(m); sent.n++; const r = merge(sent.dyn, m); if (r.ok) { if (!r.stale) sent.dyn = r.state; } else { sent.dyn = null; sent.gaps++; } },
  liveGet: async () => JSON.parse(JSON.stringify({ stat: sent.stat, dyn: sent.dyn })), onLive: f => { cbs.dyn.push(f); return () => {}; }, onLiveStatic: f => { cbs.stat.push(f); return () => {}; }, liveOpen: async () => ({ second: true }), liveCommand: c => { cmds.push(c); cbs.cmd.forEach(f => f(JSON.parse(JSON.stringify(c)))); }, onCommand: f => { cbs.cmd.push(f); return () => { cbs.cmd = cbs.cmd.filter(x => x !== f); }; },
  schema: async () => schema, getSettings: async () => ({ theme: 'dark', rules: 'Be kind. No bumping.' }), setSettings: async p => ({ ...(ctx.__ready ? vm.runInContext('state.settings', ctx) : {}), ...p }), dbPath: async () => 'x',
  list: async e => JSON.parse(JSON.stringify(store[e] || [])), customFields: async () => [], linkedLaps: async () => 0,
  saveSession: async (s, l) => { saved.push([s, l]); }, add: async (e, rec) => { added.push([e, rec]); return {}; }, update: async (e, id, rec) => { updated.push([e, id, rec]); return {}; }, remove: async () => {} };
// the app reports a screen that could not be drawn with console.error: that is a failed test (unless the test expects it)
const appConsole = { ...console, expected: false, seen: 0, error: (...a) => { if (appConsole.expected) { appConsole.seen++; return; } console.log('FAIL the app reported an error: ' + a.map(x => (x && x.stack) || x).join(' ').slice(0, 300)); fails++; } };
// the real app passes everything through Electron's structured clone, which refuses a function ("An object could not be cloned"): every call of the app interface is checked the same way here
for (const k of Object.keys(api)) { const f = api[k]; if (typeof f === 'function') api[k] = (...x) => { x.forEach(v => { if (typeof v !== 'function') structuredClone(v); }); return f(...x); }; }
const ctx = vm.createContext({ document, api, console: appConsole, Intl, URL, Image: function () {}, confirm: () => true, alert() {}, setTimeout, clearTimeout, setInterval, clearInterval, performance });
ctx.__ready = true; ctx.window = ctx; ctx.addEventListener = () => {}; ctx.removeEventListener = () => {};
for (const f of ['listnum.js', 'bop.js', 'weather.js', 'tyrewear.js', 'safetycar.js', 'pushsave.js', 'racelimit.js', 'endurance.js', 'failures.js', 'damage.js', 'engine.js', 'heats.js', 'rotation.js', 'championship.js', 'champpoints.js', 'season.js', 'tokens.js', 'speed.js', 'distance.js','stats.js','homestats.js','carstats.js','viewset.js','picture.js','uiscale.js','depth.js','theme.js','banner.js', 'icons.js', 'delta.js','avatars.js', 'picmemo.js', 'weatherwidgets.js', 'tyrewidgets.js', 'pacewidgets.js', 'boardorder.js', 'widgets.js', 'frame.js', 'backdrop.js','announcer.js','sound.js', 'timing.js', 'rows.js', 'richtext.js', 'canvas.js', 'liveshare.js', 'review.js', 'adjustpad.js', 'adjustui.js', 'dirfolder.js', 'penaltyui.js', 'rotationdrag.js','padui.js','livegrid.js', 'homegrid.js', 'drivergrid.js', 'homecards.js', 'liveview.js', 'setupwords.js', 'formui.js', 'railform.js', 'database.js', 'landing.js', 'race.js', 'undo.js', 'editor.js','tokenui.js', 'bopui.js', 'damageui.js', 'weatherui.js', 'tyreui.js', 'pushsaveui.js', 'rotationui.js', 'championshipui.js', 'audioedit.js','widgetbuilder.js','transferui.js','themeui.js','hardware.js','trackmate.js','hardwareui.js', 'dsui.js', 'app.js']) vm.runInContext(fs.readFileSync(R + 'renderer/' + f, 'utf8'), ctx, { filename: f });
const run = s => vm.runInContext(s, ctx), E = id => document.getElementById(id);
const say = (m, c) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (cond, ms = 8000) => { for (let t = 0; t < ms && !cond(); t += 25) await wait(25); };
const key = k => run('live').key({ key: k, target: { matches: () => false }, preventDefault() {} });
const phase = () => run('live.phase');
const node = type => run('live.nodes').find(n => n.w.type === type);
const flagIs = name => { const h = node('flag').val.innerHTML; return h.includes('class="flagsvg"') && h.includes('aria-label="' + name + '"'); }; // the Race Flag widget draws a flag; its label names the state
const rows = (...ids) => ids.map(i => ({ driverId: 'd' + i, carId: 'c' + i }));
const openRace = async (setup, track, r, extra = {}) => { setup = { restartAfterRed: 'resume', ...setup }; run(`state.speed=40; state.race=${JSON.stringify({ setup, track, rows: r, ...extra })}; state.tab='race'`); await run('render()'); };const Wx_ = () => vm.runInContext('Wx', ctx), same_ = (a, b) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
  await wait(50); run('state.autoFinalize = true'); ctx.__sent = sent;
  const eng = () => run('live.engine()'), PS = () => vm.runInContext('PushSave', ctx), same_ = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const rec = { id: 'ps1', name: 'Club pace', normal: 3, saveAt: 8, tyreExtra: 40, tyreSave: 30, fuelExtra: 25, fuelSave: 20 };
  store.pushsavesystems = [rec];
  store.tyrewearsystems = [{ id: 'tw1', name: 'Club tyres' }];
  store.laps = [{ id: 'l1', trackId: 't1', driverId: 'd1', time: 7412, sessionId: 's' }, { id: 'l2', trackId: 't1', driverId: 'd1', time: 7600, sessionId: 's' }, { id: 'l3', trackId: 't1', driverId: 'd2', time: 7800, noPersonalBest: true, sessionId: 's' }, { id: 'l4', trackId: 't4', driverId: 'd2', time: 5000, sessionId: 's' }, { id: 'l5', trackId: 't1', driverId: 'd3', time: 7000, token: true, sessionId: 's' }];
  store.layouts = [{ id: 'PSL', name: 'Pace', ratioW: 16, ratioH: 9, widgets: [
    ...['badge', 'gauge', 'bar', 'wear'].map((look, k) => ({ id: 'p' + k, type: 'pace', lane: 0, x: 0, y: k * 90, w: 300, h: 80, textSize: '', textColor: '', bgColor: '', opt: { look } })),
    { id: 'q', type: 'pace', lane: 1, x: 320, y: 0, w: 300, h: 80, textSize: '', textColor: '', bgColor: '', opt: { look: 'badge', showRef: true } }] }];
  const setupPs = { id: 's-ps', name: 'Pace race', sessionType: 'race', laps: 12, layout: 'PSL', lightsMin: 0, lightsMax: 0, fuelRules: 'f1', tyreWear: 'tw1', pushSave: 'ps1', endRule: 'all', pitHold: 0.1 };
  const nodes = type => run('live.nodes').filter(n => n.w.type === type);

  // ---------- the Push and Save Systems page ----------
  run("state.settings = { theme: 'dark' }; state.tab = 'setup'; state.setupSub = 'pushsave'"); await run('render()'); await wait(50);
  const tabs = E('setuptabs').innerHTML;
  say('Race Setup has a Push and Save Systems tab, after Safety Car Systems and before the group of the Setups (in the group of the systems)', tabs.includes('Push and Save Systems') && tabs.indexOf('Safety Car Systems') < tabs.indexOf('Push and Save Systems') && tabs.indexOf('Push and Save Systems') < tabs.indexOf('Rotation Setups') && /data-id="pushsave"/.test(tabs));
  say('...it is the open one now, in its own colour (the class of the chip is ss-ps)', /class="sstab ss-ps" role="tab" aria-selected="true" data-id="pushsave"/.test(tabs));
  say('...it is not in the Database tab', !run('state.schema').pushsavesystems.database && !(run("typeof DB_TABS !== 'undefined' ? JSON.stringify(DB_TABS) : ''") || '').includes('pushsave'));
  say('...with a note that says what a push and save system is, and that a race setup chooses one', E('setupnote').textContent.includes('A push and save system makes the way a driver drives count') && E('setupnote').textContent.includes('Choose one in a race setup (Rules and systems)') && E('setupnote').textContent.includes('target lap time is then not used'));
  say('...the sets are listed and kept like the other rule sets', E('setupmgr').innerHTML.includes('Club pace') && run('state.schema.pushsavesystems.plural') === 'Push and save systems');

  { run("state.settings.dbView = 'grid'; state.settings.setupView = 'grid'"); await run('render()');
    say('...a card without a picture has the icon of the system (the pace meter) on a tile in the colour of the sub-tab, the same as the button of the strip', E('setupmgr').innerHTML.includes('<span class="ph phicon ss-ps">') && E('setupmgr').innerHTML.includes(run("Icons.PATHS['pushsave']")) && run("SETUP_LOOK['pushsavesystems']").join() === 'pushsave,ps' && run("[SETUP_HERO, ...SETUP_GROUPS.flatMap(g => g[1])].find(t => t[0] === 'pushsave')").slice(2, 4).join() === 'pushsave,ps');
    run("delete state.settings.setupView; delete state.settings.dbView"); }

  // ---------- the field of the race setup ----------
  { const F = run('state.schema.racesetups.fields'), isShown = run('isShown'), f = F.find(x => x.key === 'pushSave'), shown = (fld, o) => isShown(fld, k => o[k]), keys = F.map(x => x.key);
    say('a race setup has a Push and save system field in the rules: a choice of the systems, "No push and save" to begin with', f && f.group === 'rules' && f.type === 'ref' && f.ref === 'pushsavesystems' && f.blank === 'No push and save' && f.hint.includes('Fuel system'));
    say('...it is asked for every kind of racing and not for a Time Token Session', ['race', 'heats', 'endurance', 'practice', 'qualifying'].every(t => shown(f, { sessionType: t })) && !shown(f, { sessionType: 'tokens' }));
    say('...it comes after the Safety car system and before the pit stop sensor time', keys.indexOf('pushSave') === keys.indexOf('safetyCar') + 1 && keys.indexOf('pushSave') < keys.indexOf('pitHold')); }

  // ---------- the form ----------
  run("openForm('pushsavesystems', null)"); await wait(30);
  { const h = E('dlg').innerHTML;
    say('the form of a new system has the name, the two paces, the switches and four wear numbers, the lap rules, starting as the Standard system', ['f-name', 'f-normal', 'f-saveAt', 'f-tyres', 'f-tyreExtra', 'f-tyreSave', 'f-fuel', 'f-fuelExtra', 'f-fuelSave', 'f-from', 'f-slow', 'f-yellowSave'].every(id => h.includes(`id="${id}"`))
      && /id="f-normal"[^>]*value="3"/.test(h) && /id="f-saveAt"[^>]*value="8"/.test(h) && /id="f-tyreExtra"[^>]*value="40"/.test(h) && /id="f-tyreSave"[^>]*value="30"/.test(h) && /id="f-fuelExtra"[^>]*value="25"/.test(h) && /id="f-fuelSave"[^>]*value="20"/.test(h) && /id="f-from"[^>]*value="3"/.test(h) && /id="f-slow"[^>]*value="150"/.test(h));
    say('...the window carries the colour of the sub-tab (class setupform ss-ps)', h.includes('<form id="frm" class="setupform ss-ps">'));
    say('...in four folders: Basics, Pace, Wear and Which laps count, with the labels that say what the numbers do', ['Basics', 'Pace', 'Wear', 'Which laps count'].every(x => h.includes(x)) && h.includes('Normal pace: the best lap plus (%)') && h.includes('Most saving pace: the best lap plus (%)') && h.includes('Tyres: wear when flat out is more by (%)') && h.includes('Fuel: use at the most saving pace is less by (%)'));
    say('...ready-made systems to start from: Standard, Gentle and Strong (buttons), and no input of their own', ['standard', 'gentle', 'strong'].every(k => h.includes(`data-pspreset="${k}"`)) && !h.includes('id="f-presets"')); }
  { const click = d => run('dlg').onclick({ target: { dataset: d, closest: () => ({ dataset: d }), tagName: 'BUTTON' } });
    click({ pspreset: 'strong' });
    say('the Strong button fills the four wear numbers (80, 50, 50, 35) and leaves the rest alone', ['tyreExtra', 'tyreSave', 'fuelExtra', 'fuelSave'].map(k => Number(E('f-' + k).value)).join() === '80,50,50,35' && E('f-normal').value !== '99');
    click({ pspreset: 'gentle' });
    say('...Gentle changes the wear a little (20, 15, 12, 10)', ['tyreExtra', 'tyreSave', 'fuelExtra', 'fuelSave'].map(k => Number(E('f-' + k).value)).join() === '20,15,12,10');
    click({ pspreset: 'nonsense' });
    say('...a button that is not a system does nothing', ['tyreExtra', 'tyreSave', 'fuelExtra', 'fuelSave'].map(k => Number(E('f-' + k).value)).join() === '20,15,12,10'); }
  { const set = (k, v) => { E('f-' + k).value = v; };
    set('name', 'Club pace 2'); set('normal', '5'); set('saveAt', '4'); set('tyres', 'on'); set('fuel', 'on'); set('from', '3'); set('slow', '150'); set('yellowSave', 'on'); set('tyreExtra', '80'); set('tyreSave', '50'); set('fuelExtra', '50'); set('fuelSave', '35');
    await E('frm').onsubmit({ preventDefault() {} }); await wait(20);
    say('saving a system whose most saving pace is not more than normal pace is refused with a message (nothing is added)', added.length === 0 && /most saving pace must be more than the normal pace/.test(E('err').textContent));
    set('saveAt', '5'); E('err').textContent = '';
    await E('frm').onsubmit({ preventDefault() {} }); await wait(20);
    say('...and so is one where it is the same as normal pace', added.length === 0 && /most saving pace must be more than the normal pace/.test(E('err').textContent));
    set('saveAt', '9');
    await E('frm').onsubmit({ preventDefault() {} }); await wait(20);
    const r = (added[0] || [])[1] || {};
    say('...with a larger number it is saved: the name and the numbers as numbers', added.length === 1 && added[0][0] === 'pushsavesystems' && r.name === 'Club pace 2' && r.normal === 5 && r.saveAt === 9 && r.tyreExtra === 80 && r.tyreSave === 50 && r.fuelExtra === 50 && r.fuelSave === 35 && r.from === 3 && r.slow === 150 && r.tyres === 'on' && r.yellowSave === 'on' && !('presets' in r));
    say('...and the race reads them back as the same rules', same_(PS().clean(r), { normal: 5, saveAt: 9, from: 3, slow: 150, yellowSave: true, tyres: { on: true, extra: 80, save: 50 }, fuel: { on: true, extra: 50, save: 35 } })); }

  // ---------- the Home tab: the Rules of this race card ----------
  { store.racesetups = [{ ...setupPs, track: 't1' }];
    const g = JSON.parse(run('JSON.stringify(HomeGrid.gridOf({}))')); g.rows = 5; g.boards.push({ c: 1, r: 4, w: 2, h: 2, opt: { card: 'rules' } });
    run('state.settings.homeGrid = ' + JSON.stringify(g)); run("state.tab = 'home'"); await run('render()'); await wait(150);
    say('the Rules of this race card names the push and save system of the setup, as the last line', E('hmc-rules').innerHTML.includes('<div class="hm-kv"><span class="muted">Push and save</span><strong>Club pace</strong></div></section>'));
    store.racesetups = [{ ...setupPs, track: 't1', pushSave: '' }]; await run('render()'); await wait(150);
    say('...a setup with none has no line about it', E('hmc-rules').innerHTML.includes('Tyre wear') && !E('hmc-rules').innerHTML.includes('Push and save'));
    run('delete state.settings.homeGrid'); }

  // ---------- the race window ----------
  store.racesetups = [setupPs];
  await openRace(setupPs, store.tracks[0], rows(1, 2)); await wait(50);
  say('a race with a push and save system gets its rules in the engine', same_(eng().pushSave, PS().clean(rec)) && eng().cfg.pushsave.normal === 3 && eng().psInfo(eng().cars[0]) !== null);
  say('...every driver brings his best lap on this track from the records (Alex 7.412, not the lap of another track or a token session; Sam 7.800 is out of the records: no reference)',
    Math.abs(eng().cars[0].psRec - 7412 / 40) < 1e-6 && eng().psRef(eng().cars[0]).src === 'record' && !eng().cars[1].psRec && eng().psRef(eng().cars[1]).src === '');
  say('...the Push and Save folder is there, with its table and the lap by lap list', E('pspanel').hidden === false && ['<th>Pace</th>', '<th>Reference lap</th>', '<th>Tyres now</th>', '<th>Fuel now</th>', '<th>Lasts at this pace</th>', 'data-ps-lane', '<th>Over the reference</th>'].every(x => E('pspanel').innerHTML.includes(x)) && !!run('live.psPanel'));
  say('...it is a lime folder on the race screen (the colour of the Push and Save Systems page), with what it is about', /class="dbfolder dirfolder dir-lime"[^>]*data-dirf="pushsave"/.test(E('racehost').innerHTML) && E('racehost').innerHTML.includes('id="fd-pushsave"') && E('racehost').innerHTML.includes('How hard each driver drives'));
  { await openRace(setupPs, store.tracks[0], rows(3, 1)); await wait(30);
    say('...a driver whose only lap on this track is from a time token session has no record (that lap is not a record), and the other driver still has his', !eng().cars[0].psRec && eng().psRef(eng().cars[0]).src === '' && eng().cars[1].psRec > 0); }
  { const off = { ...setupPs, pushSave: '' }; await openRace(off, store.tracks[0], rows(1, 2)); await wait(30);
    say('a race setup with no push and save system has none: nothing in the engine, no records brought in, no folder panel', eng().pushSave === null && eng().cars.every(c => !c.psRec) && !run('live.psPanel'));
    for (const t of ['practice', 'qualifying', 'timed', 'heats']) { await openRace({ ...setupPs, sessionType: t, duration: 5, heats: 2 }, store.tracks[0], rows(1, 2)); await wait(20);
      say(`...a ${t} has the system when the setup says so`, eng() && eng().pushSave !== null && eng().pushSave.normal === 3); }
    await openRace({ ...setupPs, pushSave: 'ps-deleted' }, store.tracks[0], rows(1, 2)); await wait(30);
    say('...a race setup whose system is gone has none', eng().pushSave === null);
    await openRace({ ...setupPs, sessionType: 'tokens' }, store.tracks[0], rows(1, 2)); await wait(30);
    say('...a Time Token Session never has it', eng().pushSave === null && !run('live.psPanel')); }

  // ---------- the texts of the folder, drawn from an engine that has driven ----------
  { const E_ = vm.runInContext('RaceEngine', ctx), T_ = vm.runInContext('TyreWear', ctx), P = vm.runInContext('PushSavePanel', ctx);
    const entries = [0, 1].map(i => ({ lane: i, driverId: 'd' + i, carId: 'c' + i, driverName: 'Alex' + i, carName: 'x', tyre: 'S', psRec: 10000 }));
    const r = E_.createRace({ type: 'race', laps: 60, duration: 30, endRule: 'all', entries, fuel: { on: true, tank: 100, perLap: 2, rate: 10, target: 0, extra: 0, saving: 0, empty: 'retire', pitHold: 2000 }, tyrewear: T_.clean({}), pushsave: PS().clean({}) });
    r.start(0); r.cars.forEach(c => { c.started = true; }); let t = 0; [10000, 10000, 10040].forEach(ms => { t += ms; r.cross(0, t); });
    const x = P.rowTexts(r, r.cars[0], r.pushSave), z = P.rowTexts(r, r.cars[1], r.pushSave);
    say('the row of a driver who pushes: PUSH, +0.4% over the reference, the last lap, the reference lap (record), the numbers and the litres a lap now and usually, and how long it lasts', x.pill === 'PUSH' && x.kind === 'push' && x.pct === '+0.4% over the reference' && x.last === '10.040' && x.ref === '10.000 (record)' && x.tmult === '×1.35' && x.fmult === '×1.22'
      && /^6\.1% a lap \(usual 4\.5%\)$/.test(x.tnow) && /^2\.\d L a lap \(usual 1\.9 L\)$/.test(x.fnow) && /^Tyres 1\d laps? · Fuel \d+ laps$/.test(x.tlaps) && x.who === 'Alex0');
    say('...a driver who has not driven: NORMAL, the reason why, no last lap, no numbers of his own (x1.00), and the laps he lasts at the usual pace', z.pill === 'NORMAL' && z.pct === 'the effect has not started yet' && z.last === '–' && z.tmult === '×1.00' && z.fmult === '×1.00' && z.ref === '10.000 (record)' && /^Tyres 22 laps · Fuel \d+ laps$/.test(z.tlaps));
    { const off = P.rowTexts(r, r.cars[0], PS().clean({ tyres: 'off', fuel: 'off' }));
      say('...with the tyres and the fuel switched off in the system the row shows dashes, and says nothing about them', off.tmult === '–' && off.fmult === '–' && off.tnow === '' && off.fnow === '' && off.tlaps === '–'); }
    { const fake = { psInfo: () => ({ p: 0.4, kind: 'push', why: '', tyres: 1.35, fuel: 1.22, ref: 10000, src: 'record', tyreUsual: 4.5, tyreNow: 6, fuelUsual: 2, fuelNow: 2.4, tyreLaps: 1.5, fuelLaps: 1.9 }) };
      say('...one lap left is "1 lap", not "1 laps"', P.rowTexts(fake, { driverName: 'A', laps: [] }, PS().clean({})).tlaps === 'Tyres 1 lap · Fuel 1 lap'); }
    const lh = P.lapsHtml(r.cars[0], r.pushSave);
    say('the lap by lap list: a row for every lap with the time, the pace, the pill and the numbers; laps that wore as usual say why', (lh.match(/<tr>/g) || []).length === 3 && lh.includes('<td>3</td><td>10.040</td><td>+0.4%</td><td><span class="pspill psk-push">PUSH</span></td><td>×1.35</td><td>×1.22</td>') && lh.includes('the effect has not started yet') && P.lapsHtml(r.cars[1], r.pushSave).includes('No laps yet.'));
    say('...only the last ten laps are listed', (() => { const q = E_.createRace({ type: 'race', laps: 60, duration: 30, endRule: 'all', entries, pushsave: PS().clean({}) }); q.start(0); q.cars.forEach(c => { c.started = true; }); let u = 0; for (let n = 0; n < 15; n++) { u += 10000; q.cross(0, u); } const h = P.lapsHtml(q.cars[0], q.pushSave); return (h.match(/<tr>/g) || []).length === 10 && h.includes('<td>15</td>') && !h.includes('<td>5</td>'); })());
    say('the rules line above the table', P.rulesLine(r.pushSave) === 'Push and Save: normal pace is the best lap +3%; tyres ×1.40 to ×0.70, fuel ×1.25 to ×0.80. The pace counts from lap 3.');
    // the panel itself, against a stand-in for the page
    const parts = {}; const part = () => ({ textContent: '', style: {}, dataset: {}, className: '', classList: { add() {}, remove() {} } });
    const trs = {}; [0, 1].forEach(l => { parts[l] = {}; ['who', 'pill', 'pct', 'last', 'ref', 'tmult', 'fmult', 'tnow', 'fnow', 'tlaps'].forEach(k => { parts[l][k] = part(); }); trs[l] = { querySelector: sel => { const m = /data-ps="(\w+)"/.exec(sel); return m ? parts[l][m[1]] : null; } }; });
    const rules = part(), body = part(), sel = { value: '0' };
    const box = { hidden: true, innerHTML: '', querySelector: s => (/tr\[data-lane="(\d+)"\]/.test(s) ? trs[/(\d+)/.exec(s)[1]] : /data-ps="rules"/.test(s) ? rules : /data-ps="laps"/.test(s) ? body : /data-ps-lane/.test(s) ? sel : mk()) };
    const pnl = P.build(box, { eng: () => r, lanes: [0, 1], phase: () => 'running' }); pnl.update();
    say('the folder is drawn from the engine: the pills, the numbers and the laps of the lane that is picked, and it shows (not hidden)', box.hidden === false && parts[0].pill.textContent === 'PUSH' && parts[0].pill.className === 'pspill psk-push' && parts[0].tmult.textContent === '×1.35' && parts[1].pill.textContent === 'NORMAL' && rules.textContent.startsWith('Push and Save: normal pace') && body.innerHTML.includes('+0.4%'));
    sel.value = '1'; pnl.update();
    say('...the lap by lap list follows the lane that is picked', body.innerHTML.includes('No laps yet.'));
    const none = E_.createRace({ type: 'race', laps: 5, duration: 5, entries, pushsave: undefined }); const hidden = { hidden: false, innerHTML: '', querySelector: () => mk() }; P.build(hidden, { eng: () => none, lanes: [0, 1], phase: () => 'running' }).update();
    say('...a race without a system hides the folder', hidden.hidden === true); }

  // ---------- a race: the widget, the lap review, what is shared ----------
  await openRace(setupPs, store.tracks[0], rows(1, 2)); await wait(50);
  key(' '); await until(() => phase() === 'running', 3000); await wait(60);
  for (let n = 0; n < 5; n++) { key('1'); await wait(70); }
  { run("live.psPanel.update = (f => function () { live.psUpdates = (live.psUpdates || 0) + 1; return f.apply(this, arguments); })(live.psPanel.update)"); await wait(300);
    say('the folder of the race window is brought up to date while the race runs', run('live.psUpdates') > 0); }
  { const html = k => nodes('pace')[k].val.innerHTML;
    say('the Pace meter widget of a lane shows the kind of pace of its car in every look: a badge, a gauge, a bar, the wear only', /PUSH|NORMAL|SAVE/.test(html(0)) && html(0).includes('pspill') && html(1).includes('psgauge') && /PUSH|NORMAL|SAVE/.test(html(1)) && html(2).includes('psbar') && html(2).includes('psmark') && html(3).includes('pswear') && html(3).includes('×'));
    say('...a lane that has not driven shows NORMAL and the reason, and with "show the reference lap" that it has none yet (Sam has no record)', /NORMAL/.test(html(4)) && html(4).includes('the effect has not started yet') && html(4).includes('no reference lap yet')); }
  say('the laps that were driven have their pace in the engine', eng().cars[0].ps.length === eng().cars[0].laps.length && eng().cars[0].laps.length >= 4 && eng().cars[0].ps[0].w === 'early');
  E('lapsbtn').onclick({}); E('lapreview').onclick({ target: { closest: () => ({ dataset: { rv: 'laps', car: '0' } }) } });
  say('the lap review tags every lap with its pace: the first laps wore as usual (and say why), the later ones are PUSH, NORMAL or SAVE with the numbers', E('lapreview').innerHTML.includes('usual wear: the effect has not started yet') && /(PUSH|NORMAL|SAVE) \+\d+\.\d%/.test(E('lapreview').innerHTML) && /(PUSH|SAVE) \+\d+\.\d%, tyres ×\d\.\d\d/.test(E('lapreview').innerHTML));
  await wait(300);
  say('what is shared with the other windows: the system (so a phone and the Race Director page have it too)', !!sent.stat.cfg.pushsave && sent.stat.cfg.pushsave.normal === 3 && sent.stat.cfg.entries[0].psRec > 0 && sent.dyn && sent.dyn.cars[0].ps && sent.dyn.cars[0].ps.length >= 4);
  { const viewer = vm.runInContext('RaceEngine', ctx).createRace({ ...sent.stat.cfg, entries: sent.stat.cfg.entries.map(e => ({ ...e })) });
    say('...a window that follows rebuilds the same system and the reference lap of the driver', same_(viewer.pushSave, eng().pushSave) && viewer.psRef(viewer.cars[0]).src === 'record' && viewer.cars[0].psRec === eng().cars[0].psRec); }
  { const PP = vm.runInContext('PushSavePanel', ctx), orig = PP.build; let built = 0, updates = 0;
    PP.build = (box, o) => { built++; const q = orig(box, o), u = q.update; return { ...q, update: () => { updates++; return u(); } }; };
    const host = document.createElement('div'); await run('LiveView.mount')(host, {}); run('LiveView.go')('director'); await wait(250);
    say('the Race Director page has the Push and Save folder (not in a race without the system)', E('lv-body').innerHTML.includes('id="dir-ps"') && E('lv-body').innerHTML.includes('How hard each driver drives'));
    say('...with a lime folder, a panel that is built once and kept up to date (the page follows the race of the other window)', /dir-lime/.test(E('lv-body').innerHTML) && E('dir-ps').innerHTML.includes('data-ps="rules"') && built === 1 && updates > 0);
    PP.build = orig;
    run("state.settings.driverGrid = { cols: 2, rows: 1, boards: [{ c: 1, r: 1, w: 1, h: 1, opt: { cell: 'pace', label: true } }, { c: 2, r: 1, w: 1, h: 1, opt: { cell: 'wearnow', label: true } }] }");
    run('LiveView.go')('rules'); run('LiveView.go')('driver'); await wait(150);
    const dh = E('lv-dstats').innerHTML, cellOf = k => (new RegExp(`<div class="lv-dg lv-stat[^"]*" data-cell="${k}" style="([^"]*)">(.*?)</div>`).exec(dh) || [])[2] || '';
    say('the Driver stats page of a race with a push and save system has the Pace and Wear now cells (the first as a pill, the second as the numbers of the wear)', /pspill/.test(cellOf('pace')) && /(PUSH|NORMAL|SAVE)/.test(cellOf('pace')) && /pswear/.test(cellOf('wearnow')) && cellOf('wearnow').includes('Tyres') && cellOf('wearnow').includes('Fuel'));
    run('state.settings.driverGrid = undefined'); run('LiveView.unmount')(); }
  key('s'); await until(() => phase() === 'finished', 3000); await wait(60);

  // the grid cells and the Leaderboard column
  { const DG = vm.runInContext('DriverGrid', ctx), Wd = vm.runInContext('Widgets', ctx);
    say('the Driver stats grid has the cells Pace and Wear now, only in a race with a push and save system', DG.applies('pace', { pushsave: true }) && DG.applies('wearnow', { pushsave: true }) && !DG.applies('pace', {}) && !DG.applies('wearnow', { tyrewear: true }) && DG.cellOf('pace').type === 'pace' && DG.cellOf('wearnow').opt.look === 'wear' && DG.NEEDS.pushsave.includes('Push and Save'));
    say('the Leaderboard has a Pace column (off to begin with), that shows what the cell made', Wd.def('leaderboard').options.find(o => o.key === 'colPace').default === false && Wd.leaderHtml([{ pos: 1, name: 'Alex', pace: '<span class="pscell">X</span>', flag: '', color: '', bg: '' }], { colPace: true }).includes('<td class="lb-pace"><span class="pscell">X</span></td>') && !Wd.leaderHtml([{ pos: 1, name: 'Alex', pace: 'X' }], {}).includes('lb-pace')); }

  console.log(fails ? fails + ' PUSH AND SAVE SCREEN TESTS FAILED' : 'ALL PUSH AND SAVE SCREEN TESTS PASSED'); process.exit(fails ? 1 : 0);
})();
