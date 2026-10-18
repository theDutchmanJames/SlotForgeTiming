// 1.40.0: Tyre Wear on screen: the Tyre Wear Systems page (a sub-tab of Race Setup between Damage Systems and Weather Systems) and its form (the tyre table, the weather table, the grip curve),
// the race setup field, the engine the race window builds, the Tyre Change folder (life, grip effect, what is left, the state) and what is shared with the other windows, against a stand-in for the app window.
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
for (const f of ['listnum.js', 'bop.js', 'weather.js', 'tyrewear.js', 'endurance.js', 'damage.js', 'engine.js', 'heats.js', 'rotation.js', 'tokens.js', 'speed.js', 'distance.js','stats.js','homestats.js','carstats.js','viewset.js','picture.js','uiscale.js','theme.js','banner.js', 'icons.js', 'delta.js','avatars.js', 'weatherwidgets.js', 'tyrewidgets.js', 'boardorder.js', 'widgets.js', 'frame.js', 'backdrop.js','announcer.js','sound.js', 'timing.js', 'rows.js', 'richtext.js', 'canvas.js', 'liveshare.js', 'review.js', 'adjustpad.js', 'adjustui.js', 'dirfolder.js', 'penaltyui.js', 'rotationdrag.js','padui.js','livegrid.js', 'homegrid.js', 'drivergrid.js', 'homecards.js', 'liveview.js', 'database.js', 'landing.js', 'race.js', 'undo.js', 'editor.js','tokenui.js', 'bopui.js', 'damageui.js', 'weatherui.js', 'tyreui.js', 'rotationui.js', 'audioedit.js','widgetbuilder.js','transferui.js','themeui.js','hardware.js','trackmate.js','hardwareui.js', 'dsui.js', 'app.js']) vm.runInContext(fs.readFileSync(R + 'renderer/' + f, 'utf8'), ctx, { filename: f });
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
  const eng = () => run('live.engine()'), TW = () => vm.runInContext('TyreWear', ctx), same_ = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const rec = { id: 'tw1', name: 'Club tyres', unit: 'lap', zero: 'points', zeroPoints: 2, changeSeconds: 0, effect: 'on', eUse: 'on', eRate: 'on', eTank: 'off' };
  store.tyrewearsystems = [rec];
  store.penaltysystems = [{ id: 'p1', name: 'Points', timeRule: 'every', everyPoints: 5, everySeconds: 5 }];
  const setupTw = { id: 's-tw', name: 'Tyre race', sessionType: 'race', laps: 12, layout: '', lightsMin: 0, lightsMax: 0, fuelRules: 'f1', penaltySystem: 'p1', tyreWear: 'tw1', endRule: 'all', pitHold: 0.1 };

  // ---------- the Tyre Wear Systems page ----------
  run("state.settings = { theme: 'dark' }; state.tab = 'setup'; state.setupSub = 'tyrewear'"); await run('render()'); await wait(50);
  const tabs = E('setuptabs').innerHTML;
  say('Race Setup has a Tyre Wear Systems tab, after Damage Systems and before Weather Systems', tabs.includes('Tyre Wear Systems') && tabs.indexOf('Damage Systems') < tabs.indexOf('Tyre Wear Systems') && tabs.indexOf('Tyre Wear Systems') < tabs.indexOf('Weather Systems'));
  say('...it is not in the Database tab', !run('state.schema').tyrewearsystems.database && !(run("typeof DB_TABS !== 'undefined' ? JSON.stringify(DB_TABS) : ''") || '').includes('tyrewear'));
  say('...with a note that says what a tyre wear system is, and that a race setup chooses one', E('setupnote').textContent.includes('A tyre wear system makes the tyres lose life') && E('setupnote').textContent.includes('Choose one in a race setup'));
  say('...the sets are listed and kept like the other rule sets (the page lists the sets of that kind)', E('setupmgr').innerHTML.includes('Club tyres') && run('state.schema.tyrewearsystems.plural') === 'Tyre wear systems');

  // ---------- the fields ----------
  { const F = run('state.schema.racesetups.fields'), isShown = run('isShown'), f = F.find(x => x.key === 'tyreWear'), shown = type => isShown(f, k => ({ sessionType: type })[k]);
    say('a race setup has a Tyre wear system field in the rules: a choice of the systems, "No tyre wear" to begin with', f && f.group === 'rules' && f.type === 'ref' && f.ref === 'tyrewearsystems' && f.blank === 'No tyre wear' && f.hint.includes('Every heat starts on fresh tyres'));
    say('...it is asked for every kind of racing and not for a Time Token Session', ['race', 'timed', 'heats', 'endurance', 'practice', 'qualifying'].every(shown) && !shown('tokens'));
    const keys = F.map(x => x.key); say('...it comes after the Weather system', keys.indexOf('tyreWear') === keys.indexOf('weather') + 1); }
  { const fs = run('state.schema.tyrewearsystems.fields'), by = k => fs.find(x => x.key === k), D = TW().DEFAULTS, shown = (key, r) => run('isShown')(by(key), k => r[k]);
    say('the tyre wear system has the standard settings of the code as its defaults (so a record and the engine mean the same)', fs.filter(x => x.default !== undefined).every(x => x.default === D[x.key]) && by('unit').default === 'lap' && by('changeSeconds').default === 4 && by('warn').default === 25 && by('crit').default === 10);
    say('...two special fields: the tyre table and the weather table', by('tyres').type === 'tyretable' && by('mult').type === 'wxmult');
    say('...the levers are asked only when the effect is on, the penalty points only for that rule at 0%', shown('eUse', { effect: 'on' }) && !shown('eUse', { effect: 'off' }) && shown('eTank', { effect: 'on' }) && shown('zeroPoints', { zero: 'points' }) && !shown('zeroPoints', { zero: 'retire' }) && !shown('zeroPoints', { zero: 'lap' }) && !shown('zeroPoints', { zero: 'none' }));
    say('...the groups: basics, the tyres, the weather, what worn tyres do, pit stops, where it applies, warning colours', run('state.schema.tyrewearsystems.groups').map(g => g.id).join() === 'basics,tyres,weather,effect,pit,where,warn' && fs.every(x => run('state.schema.tyrewearsystems.groups').some(g => g.id === x.group)));
    say('...the choices are those of the code (zero rules, the ways to count)', same_(by('zero').options, TW().ZERO) && by('unit').options.map(o => o[0]).join() === 'lap,distance' && by('stop').options.map(o => o[0]).join() === 'overlap,add'); }

  // ---------- the form ----------
  run("openForm('tyrewearsystems', null)"); await wait(30);
  { const h = E('dlg').innerHTML;
    say('the form of a new system has the table of tyres with the six tyres, the four numbers each, and "Lasts about"', h.includes('id="tw-table"') && ['Hard', 'Medium', 'Soft', 'Supersoft', 'Intermediate', 'Wet'].every(n => h.includes(n)) && ['Wear per lap (%)', 'Fresh bonus (%)', 'Grip drops from (% life left)', 'Hindrance at 0% (%)', 'Lasts about'].every(n => h.includes(n)) && (h.match(/data-twk="wear"/g) || []).length === 6 && (h.match(/data-twk="hind"/g) || []).length === 6);
    say('...it starts as the Standard system: a Soft wears 4.5% and lasts about 22 laps, a Hard wears 2% and lasts 50', /data-tw="S" data-twk="wear"[^>]*value="4.5"/.test(h) && />22 laps</.test(h) && />50 laps</.test(h) && /data-tw="SS" data-twk="bonus"[^>]*value="8"/.test(h));
    say('...ready-made systems to start from: Standard, Sprint and Endurance', ['standard', 'sprint', 'endurance'].every(k => h.includes(`data-twpreset="${k}"`)));
    say('...the grip curve of one tyre (the Soft) with what the numbers do', h.includes('id="tw-curve"') && h.includes('<svg viewBox="0 0 440 235"') && h.includes('+5% new') && h.includes('cliff at 30%') && h.includes('−30% at 0%') && h.includes('<strong>Soft.</strong>'));
    say('...the weather table: four weathers by dry, Intermediate and Wet tyres (12 numbers), as in the system', (h.match(/data-twm="/g) || []).length === 12 && /data-twm="wet" data-twmc="dry"[^>]*value="2.5"/.test(h) && /data-twm="wet" data-twmc="wet"[^>]*value="0.5"/.test(h));
    say('...the other fields are there too: the unit, the effect, the rule at 0%, the time to change tyres, the warning levels', ['f-unit', 'f-effect', 'f-zero', 'f-changeSeconds', 'f-warn', 'f-crit', 'f-practice', 'f-qualifying', 'f-stop'].every(id => h.includes(`id="${id}"`))); }
  { const click = d => run('dlg').onclick({ target: { dataset: d, closest: () => ({ dataset: d }), tagName: 'BUTTON' } });
    run('dlg').onclick && click({ twpreset: 'sprint' });
    say('the Sprint button fills the table with the Sprint numbers (a Soft wears 8% and lasts 13 laps)', /data-tw="S" data-twk="wear"[^>]*value="8"/.test(E('tw-box').innerHTML) && E('tw-box').innerHTML.includes('>13 laps<'));
    click({ twpreset: 'endurance' });
    say('...Endurance wears slowly (a Soft 2.2%: 45 laps)', /data-tw="S" data-twk="wear"[^>]*value="2.2"/.test(E('tw-box').innerHTML) && E('tw-box').innerHTML.includes('>45 laps<'));
    click({ twsel: 'SS' });
    say('a tyre can be picked to see its grip curve: the Supersoft has +8% when new, its cliff at 35% and -35% at 0%', E('tw-curve').innerHTML.includes('+8% new') && E('tw-curve').innerHTML.includes('cliff at 35%') && E('tw-curve').innerHTML.includes('−35% at 0%') && E('tw-curve').innerHTML.includes('<strong>Supersoft.</strong>'));
    const lastsCell = { textContent: '' }; run('dlg').querySelector = sel => (/data-twlast="S"/.test(sel) ? lastsCell : mk());
    run('dlg').oninput({ target: { dataset: { tw: 'S', twk: 'wear' }, value: '10' } });
    say('typing a number in the table changes what the tyre lasts (10% a lap: 10 laps) and shows the curve of that tyre', lastsCell.textContent === '10 laps' && E('tw-curve').innerHTML.includes('<strong>Soft.</strong>'));
    run('dlg').oninput({ target: { dataset: { tw: 'S', twk: 'bonus' }, value: '12' } });
    say('...a bigger fresh bonus is in the curve at once', E('tw-curve').innerHTML.includes('+12% new'));
    // per distance: the heading and the lasts about change
    run('dlg').onchange({ target: { id: 'f-unit', value: 'distance', dataset: {}, tagName: 'SELECT' } }); await wait(10);
    say('counting per distance changes the heading (per 100 m) and what a tyre lasts (metres: 10% per 100 m is 1000 m)', E('tw-box').innerHTML.includes('Wear per 100 m (%)') && /data-twlast="S">1000 m</.test(E('tw-box').innerHTML) && /data-twlast="H">10000 m</.test(E('tw-box').innerHTML));
    run('dlg').onchange({ target: { id: 'f-unit', value: 'lap', dataset: {}, tagName: 'SELECT' } }); await wait(10);
    say('...and back to laps', E('tw-box').innerHTML.includes('Wear per lap (%)') && /data-twlast="S">10 laps</.test(E('tw-box').innerHTML) && /data-twlast="H">100 laps</.test(E('tw-box').innerHTML)); }
  { run('dlg').oninput({ target: { dataset: { twm: 'wet', twmc: 'dry' }, value: '4' } });
    const set = (k, v) => { E('f-' + k).value = v; };
    set('name', 'My tyres'); set('unit', 'lap'); set('effect', 'on'); set('eUse', 'on'); set('eRate', 'on'); set('eTank', 'off'); set('zero', 'points'); set('zeroPoints', '3'); set('changeSeconds', '5'); set('stop', 'add'); set('practice', 'on'); set('qualifying', 'off'); set('warn', '20'); set('crit', '30');
    await E('frm').onsubmit({ preventDefault() {} });
    say('a red level above the amber level is refused, and nothing is saved', E('err').textContent.includes('critical (red) level must be at or below') && added.length === 0);
    set('crit', '8'); await E('frm').onsubmit({ preventDefault() {} }); await wait(20);
    const r = (added[0] || [])[1] || {};
    say('saving keeps the table (cleaned: every number a number), the weather table, and the settings', added.length === 1 && added[0][0] === 'tyrewearsystems' && r.name === 'My tyres' && r.tyres.S.wear === 10 && r.tyres.S.bonus === 12 && r.tyres.H.wear === 1 && r.mult.wet.dry === 4 && r.mult.wet.wet === 0.5 && r.unit === 'lap' && r.zero === 'points' && r.zeroPoints === 3 && r.changeSeconds === 5 && r.stop === 'add' && r.practice === 'on' && r.warn === 20 && r.crit === 8);
    say('...and the engine reads it back as the same numbers (record, clean, engine)', (() => { const c = TW().clean(r, { laneLen: [15], disp: 'm' }); return c.tyres.S.wear === 10 && c.changeMs === 5000 && c.stop === 'add' && c.practice === true && c.qualifying === false && c.warn === 20 && c.crit === 8 && c.mult.wet.dry === 4; })()); }
  { run("openForm('tyrewearsystems', " + JSON.stringify({ id: 'x1', name: 'Old', unit: 'distance', tyres: { S: { wear: 30, bonus: 0, cliff: 30, hind: 30 } } }) + ")"); await wait(30);
    const h = E('dlg').innerHTML;
    say('editing a system shows its numbers (a Soft at 30% per 100 m lasts 333 m), and a tyre it does not have a number for has the Standard one', h.includes('Wear per 100 m (%)') && h.includes('>333 m<') && /data-tw="H" data-twk="wear"[^>]*value="2"/.test(h) && /data-tw="S" data-twk="wear"[^>]*value="30"/.test(h)); }

  // ---------- the race window ----------
  store.racesetups = [setupTw];
  await openRace(setupTw, store.tracks[0], rows(1, 2)); await wait(50);
  say('a race with a tyre wear system gets its settings in the engine', !!eng().tyrewear && eng().tyrewear.unit === 'lap' && eng().tyrewear.zero === 'points' && eng().tyrewear.zeroPoints === 2 && eng().tyrewear.changeMs === 0 && eng().tyrewear.tyres.S.wear === 4.5 && eng().cars.every(c => c.twLife === 100));
  say('...the lane lengths and the distance unit of the app go with it (for a system that counts per distance)', Array.isArray(eng().tyrewear.laneLen) && eng().tyrewear.laneLen.length === 2 && eng().tyrewear.disp === 'm');
  say('...the Tyre Change folder shows the life, what is left, the grip effect and the state', E('typanel').hidden === false && ['<th>Life</th>', '<th>Left</th>', '<th>Grip effect</th>', '<th>State</th>'].every(x => E('typanel').innerHTML.includes(x)) && E('typanel').innerHTML.includes('data-ty="bar"'));
  { const off = { ...setupTw, tyreWear: '' }; await openRace(off, store.tracks[0], rows(1, 2)); await wait(30);
    say('a race setup with no tyre wear has none: nothing in the engine, the folder is as it was (no life columns)', eng().tyrewear === null && !E('typanel').innerHTML.includes('<th>Life</th>') && eng().cars.every(c => c.tw === 0));
    const prac = { ...setupTw, sessionType: 'practice' }; await openRace(prac, store.tracks[0], rows(1, 2)); await wait(30);
    say('...practice has none, unless the system says so', eng().tyrewear === null);
    store.tyrewearsystems = [{ ...rec, practice: 'on' }]; await openRace(prac, store.tracks[0], rows(1, 2)); await wait(30);
    say('...a system with Practice on makes the practice wear the tyres', eng().tyrewear !== null && eng().tyrewear.practice === true);
    const qual = { ...setupTw, sessionType: 'qualifying', duration: 5 }; await openRace(qual, store.tracks[0], rows(1, 2)); await wait(30);
    say('...and qualifying stays without when only Practice is on', eng().tyrewear === null);
    store.tyrewearsystems = [rec];
    const timed = { ...setupTw, sessionType: 'timed', duration: 5 }; await openRace(timed, store.tracks[0], rows(1, 2)); await wait(30);
    say('...a timed race has it', eng().tyrewear !== null);
    const nofuel = { ...setupTw, fuelRules: '' }; await openRace(nofuel, store.tracks[0], rows(1, 2)); await wait(30);
    say('...a race without a fuel setup has it too (the 0% rule and the display need no fuel; the grip effect is off)', eng().tyrewear !== null && eng().fuel.on === false && eng().cars.every(c => c.tw === 0));
    const gone = { ...setupTw, tyreWear: 'tw-deleted' }; await openRace(gone, store.tracks[0], rows(1, 2)); await wait(30);
    say('...a race setup whose system is gone has none', eng().tyrewear === null);
    const tok = { ...setupTw, sessionType: 'tokens' }; await openRace(tok, store.tracks[0], rows(1, 2)); await wait(30);
    say('...a Time Token Session never has it', eng().tyrewear === null);
    const dist = { ...setupTw, id: 's-d' }; store.tyrewearsystems = [{ ...rec, unit: 'distance' }]; store.tracks[0].laneLengths = '12, 15'; store.tracks[0].laneModifier = 'measured'; store.tracks[0].length = 12;
    await openRace(dist, store.tracks[0], rows(1, 2)); await wait(30);
    say('...a system that counts per distance gets the length of every lane of the track', eng().tyrewear.unit === 'distance' && eng().tyrewear.laneLen.join() === '12,15');
    store.tyrewearsystems = [rec]; delete store.tracks[0].laneLengths; delete store.tracks[0].laneModifier; delete store.tracks[0].length; }

  // ---------- a race: laps wear the tyres, the folder follows, the other windows get it ----------
  await openRace(setupTw, store.tracks[0], rows(1, 2)); await wait(50);
  const car = i => eng().cars[i], lap = async () => { key('1'); key('2'); await wait(80); };
  key(' '); await until(() => phase() === 'running', 3000); await wait(60);
  await lap(); await lap();
  say('two laps wear a Soft by 9% (91% left) and a Medium by 6% (94%); the lap times are what was measured', Math.abs(car(0).twLife - 91) < 1e-6 && Math.abs(car(1).twLife - 94) < 1e-6 && car(0).laps.length === 2);
  say('...the grip curve works through the fuel levers: a Soft that is new gives +5% (fading), so the car is helped', car(0).tw >= 3 && car(0).tw <= 5 && car(1).tw >= 1);
  await wait(300);
  say('...what is shared with the other windows: the settings, and the life, the effect and the stops of every car', !!sent.stat.cfg.tyrewear && sent.stat.cfg.tyrewear.tyres.S.wear === 4.5 && sent.dyn && sent.dyn.cars.every(c => typeof c.twLife === 'number' && c.twStops === 0 && c.twDoneAt !== undefined) && Math.abs(sent.dyn.cars[0].twLife - 91) < 1e-6);
  { const viewer = vm.runInContext('RaceEngine', ctx).createRace({ ...sent.stat.cfg, entries: sent.stat.cfg.entries.map(e => ({ ...e })) });
    say('...a window that follows rebuilds the same tyre wear from them', !!viewer.tyrewear && viewer.twOf(0, 0) !== null); }
  { // the folder's table, drawn from the live engine (a stand-in for the page)
    const parts = {}; const part = () => ({ textContent: '', style: {}, dataset: {}, className: '', classList: { add() {}, remove() {} } });
    const trs = {}; [0, 1].forEach(l => { parts[l] = {}; ['who', 'tyre', 'life', 'bar', 'left', 'effect', 'state'].forEach(k => { parts[l][k] = part(); }); parts[l].own = { value: 'M', disabled: false };
      trs[l] = { dataset: {}, classList: { add() {}, remove() {} }, querySelector: sel => { const m = /data-ty="(\w+)"/.exec(sel); return m ? parts[l][m[1]] : /select/.test(sel) ? parts[l].own : null; } }; });
    const box = { hidden: true, innerHTML: '', querySelector: sel => { const t = /tr\[data-lane="(\d+)"\]/.exec(sel); return t ? trs[t[1]] : mk(); } };
    const p = run('TyrePanel').build(box, { eng: () => eng(), lanes: [0, 1], phase: () => 'running', now: () => performance.now(), wear: true, weather: false, setTyre: () => {} }); p.update();
    say('the Tyre Change folder shows a Soft at 91% with the bar at 91%, what is left, the grip effect and that it is driving', parts[0].life.textContent === '91%' && parts[0].bar.style.width === '91%' && /^\d+ laps$/.test(parts[0].left.textContent) && /^\+\d+%$/.test(parts[0].effect.textContent) && parts[0].state.textContent === 'Driving' && parts[0].tyre.textContent === 'S Soft' && parts[1].life.textContent === '94%');
    say('...the amber level is amber, the red level red, and a worn out set says Box now', (() => { car(0).twLife = 20; p.update(); const a = parts[0].state.textContent; car(0).twLife = 6; p.update(); const b = parts[0].state.textContent; car(0).twLife = 0; p.update(); const c = parts[0].state.textContent; car(0).twLife = 91; p.update(); return a === 'Driving' && b === 'Box soon' && c === 'Box now' && parts[0].life.textContent === '91%'; })());
    const plain = { hidden: false, innerHTML: '', querySelector: () => mk() }; const q = run('TyrePanel').build(plain, { eng: () => eng(), lanes: [0], phase: () => 'running', wear: false, weather: false, setTyre: () => {} });
    say('a race without tyre wear builds the folder as before', !plain.innerHTML.includes('<th>Life</th>') && plain.innerHTML.includes('<th>Tyre choice</th>') && !!q); }
  key('s'); await until(() => phase() === 'finished', 3000); await wait(100);

  console.log(fails ? fails + ' TYRE WEAR SCREEN TESTS FAILED' : 'ALL TYRE WEAR SCREEN TESTS PASSED'); process.exit(fails ? 1 : 0);
})();
