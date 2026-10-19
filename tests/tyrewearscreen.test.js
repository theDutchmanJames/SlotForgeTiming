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
for (const f of ['listnum.js', 'bop.js', 'weather.js', 'tyrewear.js', 'safetycar.js', 'pushsave.js', 'endurance.js', 'failures.js', 'damage.js', 'engine.js', 'heats.js', 'rotation.js', 'championship.js', 'tokens.js', 'speed.js', 'distance.js','stats.js','homestats.js','carstats.js','viewset.js','picture.js','uiscale.js','depth.js','theme.js','banner.js', 'icons.js', 'delta.js','avatars.js', 'weatherwidgets.js', 'tyrewidgets.js', 'pacewidgets.js', 'boardorder.js', 'widgets.js', 'frame.js', 'backdrop.js','announcer.js','sound.js', 'timing.js', 'rows.js', 'richtext.js', 'canvas.js', 'liveshare.js', 'review.js', 'adjustpad.js', 'adjustui.js', 'dirfolder.js', 'penaltyui.js', 'rotationdrag.js','padui.js','livegrid.js', 'homegrid.js', 'drivergrid.js', 'homecards.js', 'liveview.js', 'database.js', 'landing.js', 'race.js', 'undo.js', 'editor.js','tokenui.js', 'bopui.js', 'damageui.js', 'weatherui.js', 'tyreui.js', 'pushsaveui.js', 'rotationui.js', 'championshipui.js', 'audioedit.js','widgetbuilder.js','transferui.js','themeui.js','hardware.js','trackmate.js','hardwareui.js', 'dsui.js', 'app.js']) vm.runInContext(fs.readFileSync(R + 'renderer/' + f, 'utf8'), ctx, { filename: f });
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
    say('...the groups: basics, the tyres, the weather, what worn tyres do, pit stops, mandatory stops, the sets of tyres, where it applies, warning colours', run('state.schema.tyrewearsystems.groups').map(g => g.id).join() === 'basics,tyres,weather,effect,pit,mand,sets,where,warn' && fs.every(x => run('state.schema.tyrewearsystems.groups').some(g => g.id === x.group)));
    say('...the choices are those of the code (zero rules, the ways to count)', same_(by('zero').options, TW().ZERO) && by('unit').options.map(o => o[0]).join() === 'lap,distance' && by('stop').options.map(o => o[0]).join() === 'overlap,add'); }

  { const fs = run('state.schema.tyrewearsystems.fields'), by = k => fs.find(x => x.key === k), shown = (key, r) => run('isShown')(by(key), k => r[k]);
    say('1.41.0: the sets of tyres: a choice of who owns the sets (no limit, each car, the team) and a row of six numbers', by('setsMode').group === 'sets' && same_(by('setsMode').options, TW().SETS_MODES) && by('setsMode').default === 'car' && by('sets').type === 'tyresets' && by('sets').group === 'sets');
    say('...the numbers are asked only when there is a limit (each car, or the team)', shown('sets', { setsMode: 'car' }) && shown('sets', { setsMode: 'team' }) && !shown('sets', { setsMode: 'none' }));
    say('...and the hint says what happens when a set is gone', by('sets').hint.includes('can not be fitted or queued') && by('sets').hint.includes('0 means that tyre is not allowed')); }

  // ---------- the form ----------
  run("openForm('tyrewearsystems', null)"); await wait(30);
  { const h = E('dlg').innerHTML;
    say('the form of a new system has the table of tyres with the six tyres, the four numbers each, and "Lasts about"', h.includes('id="tw-table"') && ['Hard', 'Medium', 'Soft', 'Supersoft', 'Intermediate', 'Wet'].every(n => h.includes(n)) && ['Wear per lap (%)', 'Fresh bonus (%)', 'Grip drops from (% life left)', 'Hindrance at 0% (%)', 'Lasts about'].every(n => h.includes(n)) && (h.match(/data-twk="wear"/g) || []).length === 6 && (h.match(/data-twk="hind"/g) || []).length === 6);
    say('...it starts as the Standard system: a Soft wears 4.5% and lasts about 22 laps, a Hard wears 2% and lasts 50', /data-tw="S" data-twk="wear"[^>]*value="4.5"/.test(h) && />22 laps</.test(h) && />50 laps</.test(h) && /data-tw="SS" data-twk="bonus"[^>]*value="8"/.test(h));
    say('...ready-made systems to start from: Standard, Sprint and Endurance', ['standard', 'sprint', 'endurance'].every(k => h.includes(`data-twpreset="${k}"`)));
    say('...the grip curve of one tyre (the Soft) with what the numbers do', h.includes('id="tw-curve"') && h.includes('<svg viewBox="0 0 440 235"') && h.includes('+5% new') && h.includes('cliff at 30%') && h.includes('−30% at 0%') && h.includes('<strong>Soft.</strong>'));
    say('...the weather table: four weathers by dry, Intermediate and Wet tyres (12 numbers), as in the system', (h.match(/data-twm="/g) || []).length === 12 && /data-twm="wet" data-twmc="dry"[^>]*value="2.5"/.test(h) && /data-twm="wet" data-twmc="wet"[^>]*value="0.5"/.test(h));
    say('...the other fields are there too: the unit, the effect, the rule at 0%, the time to change tyres, the warning levels', ['f-unit', 'f-effect', 'f-zero', 'f-changeSeconds', 'f-warn', 'f-crit', 'f-practice', 'f-qualifying', 'f-stop'].every(id => h.includes(`id="${id}"`)));
    say('1.41.0: the sets: a row of six numbers, one per tyre, 2 2 2 1 2 2 to begin with (a set per car)', h.includes('id="tw-sets"') && (h.match(/data-tws="/g) || []).length === 6 && /data-tws="H"[^>]*value="2"/.test(h) && /data-tws="SS"[^>]*value="1"/.test(h) && /data-tws="W"[^>]*value="2"/.test(h) && /<option value="car" selected>/.test(h));
    say('...with the choice of who owns them: no limit, each car, the team', ['none', 'car', 'team'].every(k => h.includes(`<option value="${k}"`)) && h.includes('Each car has its own sets') && h.includes('The team shares its sets')); }
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
    run('dlg').oninput({ target: { dataset: { tws: 'SS' }, value: '3' } }); run('dlg').oninput({ target: { dataset: { tws: 'W' }, value: '0' } });
    const set = (k, v) => { E('f-' + k).value = v; };
    set('setsMode', 'team'); set('name', 'My tyres'); set('unit', 'lap'); set('effect', 'on'); set('eUse', 'on'); set('eRate', 'on'); set('eTank', 'off'); set('zero', 'points'); set('zeroPoints', '3'); set('changeSeconds', '5'); set('stop', 'add'); set('practice', 'on'); set('qualifying', 'off'); set('warn', '20'); set('crit', '30');
    await E('frm').onsubmit({ preventDefault() {} });
    say('a red level above the amber level is refused, and nothing is saved', E('err').textContent.includes('critical (red) level must be at or below') && added.length === 0);
    set('crit', '8'); await E('frm').onsubmit({ preventDefault() {} }); await wait(20);
    const r = (added[0] || [])[1] || {};
    say('saving keeps the table (cleaned: every number a number), the weather table, and the settings', added.length === 1 && added[0][0] === 'tyrewearsystems' && r.name === 'My tyres' && r.tyres.S.wear === 10 && r.tyres.S.bonus === 12 && r.tyres.H.wear === 1 && r.mult.wet.dry === 4 && r.mult.wet.wet === 0.5 && r.unit === 'lap' && r.zero === 'points' && r.zeroPoints === 3 && r.changeSeconds === 5 && r.stop === 'add' && r.practice === 'on' && r.warn === 20 && r.crit === 8);
    say('1.41.0: ...and the sets: the way they are shared and the number of every tyre (cleaned)', r.setsMode === 'team' && same_(r.sets, { H: 2, M: 2, S: 2, SS: 3, INT: 2, W: 0 }) && TW().clean(r).sets.mode === 'team' && TW().clean(r).sets.n.SS === 3 && TW().clean(r).sets.n.W === 0);
    say('...and the engine reads it back as the same numbers (record, clean, engine)', (() => { const c = TW().clean(r, { laneLen: [15], disp: 'm' }); return c.tyres.S.wear === 10 && c.changeMs === 5000 && c.stop === 'add' && c.practice === true && c.qualifying === false && c.warn === 20 && c.crit === 8 && c.mult.wet.dry === 4; })()); }
  { run("openForm('tyrewearsystems', " + JSON.stringify({ id: 'x1', name: 'Old', unit: 'distance', tyres: { S: { wear: 30, bonus: 0, cliff: 30, hind: 30 } } }) + ")"); await wait(30);
    const h = E('dlg').innerHTML;
    say('1.41.0: a system from before the sets (nothing about sets in the record) opens as "No limit": what it does', /<select id="f-setsMode">/.test(h) && !/<option value="(car|team)" selected>/.test(h) && !/<option value="none" selected>/.test(h));
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
  // ---------- 1.41.0: the sets, the next stop, the correction ----------
  { key('s'); await until(() => phase() === 'finished', 3000);
    store.tyrewearsystems = [{ ...rec, setsMode: 'car', sets: { H: 2, M: 2, S: 2, SS: 1, INT: 2, W: 2 } }];
    await openRace(setupTw, store.tracks[0], rows(1, 2)); await wait(50);
    say('a race with a system that has sets gives the engine the way they are shared and the numbers', eng().tyrewear.sets.mode === 'car' && eng().tyrewear.sets.n.SS === 1 && eng().tyrewear.sets.n.H === 2);
    say('...every car starts on a set of its tyre: car 1 (Soft) has 1 Soft left, car 2 (Medium) has 1 Medium left', same_(eng().cars[0].twSets, { H: 2, M: 2, S: 1, SS: 1, INT: 2, W: 2 }) && same_(eng().cars[1].twSets, { H: 2, M: 1, S: 2, SS: 1, INT: 2, W: 2 }));
    { const h = E('typanel').innerHTML;
      say('the Tyre Change folder has the next stop, the sets left of every car and the correction of the Race Director', ['<th>Next stop</th>', '<th>Sets left</th>', '<th>Tyres now</th>', 'data-ty-next="0"', 'data-ty-next="1"', 'Correct the tyres now', 'data-ty-fix="1"', 'data-ty-fixlane', 'data-ty-fixtyre', 'data-sc="SS"'].every(x => h.includes(x)));
      say('...the list of the next stop starts with "Same" and has the six tyres; the correction does too', /<select data-ty-next="0"[^>]*><option value="">Same<\/option><option value="H">Hard<\/option>/.test(h) && h.includes('<option value="W">Wet</option>'));
      say('...it is not the "Tyre choice" list any more (that is the correction below the table)', !h.includes('<th>Tyre choice</th>') && !h.includes('data-ty-own')); }
    key(' '); await until(() => phase() === 'running', 3000); await wait(60);
    api.liveCommand({ type: 'tyrenext', lane: 0, tyre: 'SS' }); await wait(30);
    say('the Race Director page queues a tyre for the next stop of a lane: the race window keeps it', eng().cars[0].twNext === 'SS' && eng().twOf(0, 0).queued === 'SS' && eng().twOf(0, 0).next.kind === 'queued');
    api.liveCommand({ type: 'tyrenext', lane: 0, tyre: '' }); await wait(30);
    say('...an empty tyre is "the same tyre" and clears it', eng().cars[0].twNext === '');
    api.liveCommand({ type: 'tyrenext', lane: 0, tyre: 'SS' }); api.liveCommand({ type: 'tyrenext', lane: 0, tyre: 'XX' }); api.liveCommand({ type: 'tyrenext', lane: 7, tyre: 'H' }); api.liveCommand({ type: 'tyrenext' }); await wait(30);
    say('...a tyre that is no tyre, a lane that is not there, or no tyre at all is ignored', eng().cars[0].twNext === 'SS' && eng().cars[1].twNext !== 'XX' && eng().cars.length === 2);
    { const wasPhase = phase(); run("live.phase = 'review'"); run('live.actions.tyreNext')(1, 'H'); const kept = eng().cars[1].twNext || ''; run("live.phase = 'running'");
      say('in the review after the race nothing can be queued any more', kept === '' && wasPhase === 'running'); }
    say('...a race without weather can queue every tyre, Intermediate and Wet too', (run('live.actions.tyreNext')(1, 'W'), eng().cars[1].twNext === 'W') && (run('live.actions.tyreNext')(1, ''), eng().cars[1].twNext === ''));
    { const q = eng().cars[1]; q.twSets.H = 0; run('live.actions.tyreNext')(1, 'H'); say('...a tyre with no sets left can not be queued', !q.twNext); q.twSets.H = 2; }
    await wait(400); // (the race window shares its state at most about ten times a second: wait for the message that has the queue)
    say('what is shared with the other windows: the box of every car and what is queued', sent.dyn && sent.dyn.cars.every(c => c.twSets && typeof c.twSets.S === 'number') && sent.dyn.cars[0].twNext === 'SS' && 'twTeams' in sent.dyn);
    { const viewer = vm.runInContext('RaceEngine', ctx).createRace({ ...sent.stat.cfg, entries: sent.stat.cfg.entries.map(e => ({ ...e })) });
      say('...a window that follows rebuilds the sets from the settings', !!viewer.tyrewear && viewer.tyrewear.sets.mode === 'car' && !!viewer.twOf(0, 0).sets); }
    { // the folder's table with sets, drawn from the live engine (a stand-in for the page)
      const queued = [], fixed = []; const part = () => ({ textContent: '', style: {}, dataset: {}, className: '', classList: { add() {}, remove() {} } });
      const parts = {}, chips = {}, nx = {}, trs = {};
      [0, 1].forEach(l => { parts[l] = {}; ['who', 'tyre', 'life', 'bar', 'left', 'effect', 'state', 'nnote'].forEach(k => { parts[l][k] = part(); });
        chips[l] = {}; ['H', 'M', 'S', 'SS', 'INT', 'W'].forEach(c => { const n = part(); chips[l][c] = { classes: new Set(), classList: { toggle(k, on) { if (on) chips[l][c].classes.add(k); else chips[l][c].classes.delete(k); } }, querySelector: () => n, n }; });
        nx[l] = { value: '', disabled: false, options: ['', 'H', 'M', 'S', 'SS', 'INT', 'W'].map(v => ({ value: v, textContent: '', disabled: false, hidden: false })) };
        trs[l] = { dataset: {}, classList: { add() {}, remove() {} }, querySelector: sel => { const m = /data-ty="(\w+)"/.exec(sel), c = /data-sc="(\w+)"/.exec(sel); return m ? parts[l][m[1]] : c ? chips[l][c[1]] : /data-ty-next/.test(sel) ? nx[l] : null; } }; });
      const wxn = part(), mnn = part(), fix = { disabled: false }, laneSel = { value: '1' }, tyreSel = { value: 'H' };
      const box = { hidden: true, innerHTML: '', querySelector: sel => { const t = /tr\[data-lane="(\d+)"\]/.exec(sel); return t ? trs[t[1]] : /wxnote/.test(sel) ? wxn : /mandnote/.test(sel) ? mnn : /data-ty-fix\]/.test(sel) ? fix : /fixlane/.test(sel) ? laneSel : /fixtyre/.test(sel) ? tyreSel : null; } };
      const p = run('TyrePanel').build(box, { eng: () => eng(), lanes: [0, 1], phase: () => 'running', now: () => performance.now(), wear: true, sets: true, weather: false, setTyre: (l, c, sv) => fixed.push([l, c, sv]), queue: (l, c) => queued.push([l, c]) }); p.update();
      say('the table shows the sets that are left of every tyre (dim at 0), and the tyre that is queued', chips[0].S.n.textContent === '1' && chips[0].H.n.textContent === '2' && chips[1].M.n.textContent === '1' && nx[0].value === 'SS' && nx[1].value === '');
      say('...the choices of the next stop say how many sets there are, hide the tyre the car is on, and the note says who decided', nx[0].options[0].textContent === 'Same (Soft · 1 set)' && nx[0].options[4].textContent === 'Supersoft (1 set)' && nx[0].options[3].hidden === true && nx[1].options[2].hidden === true && parts[0].nnote.textContent === 'Queued by the Race Director' && parts[1].nnote.textContent === 'Nothing queued');
      eng().cars[0].twSets.SS = 0; eng().cars[0].twSets.INT = 0; p.update();
      say('...a tyre with no sets left is dim and can not be picked (and the queued tyre stays in the list)', chips[0].SS.classes.has('zero') && chips[0].INT.classes.has('zero') && !chips[0].H.classes.has('zero') && nx[0].options[5].disabled === true && nx[0].options[4].disabled === false && nx[1].options[4].disabled === false);
      eng().cars[0].twSets.SS = 1; eng().cars[0].twSets.INT = 2;
      box.onchange({ target: { dataset: { tyNext: '1' }, value: 'H', disabled: false, blur() {} } });
      say('picking a tyre in the next stop list sends the lane and the tyre', same_(queued, [[1, 'H']]));
      box.onchange({ target: { dataset: { tyNext: '1' }, value: '', disabled: false, blur() {} } });
      box.onchange({ target: { dataset: { tyNext: '1' }, value: 'S', disabled: true, blur() {} } });
      say('...the list that is shut (disabled) sends nothing, and "Same" sends an empty tyre', same_(queued, [[1, 'H'], [1, '']]));
      box.onclick({ target: { closest: s => (/data-ty-fix/.test(s) ? { disabled: false } : null) } });
      box.onclick({ target: { closest: () => null } });
      say('the correction: Change sends the lane and the tyre that are chosen below the table, with the tick box; a click elsewhere does nothing', same_(fixed, [[1, 'H', false]]));
      eng().cars[0].blockAt = null; run("live.phase = 'review'"); const q = run('TyrePanel').build(box, { eng: () => eng(), lanes: [0, 1], phase: () => 'review', now: () => performance.now(), wear: true, sets: true, weather: false, setTyre() {}, queue() {} }); q.update(); run("live.phase = 'running'");
      say('...after the race the next stop lists and the Change button are shut', nx[0].disabled === true && fix.disabled === true);
      const fitting = eng().twOf; eng().twOf = (i, t) => ({ ...fitting(i, t), fitting: 'SS', fitLeft: 1500 }); p.update(); eng().twOf = fitting;
      say('...a car whose tyres are being changed has its list shut and says so', nx[0].disabled === true && parts[0].nnote.textContent === 'The tyres are being changed now' && /^Fitting Supersoft/.test(parts[0].state.textContent));
      p.update();
      say('...and it opens again when the tyres are on', nx[0].disabled === false && parts[0].nnote.textContent === 'Queued by the Race Director');
      say('1.52.0: a race with no mandatory stops has no line for them in the folder', mnn.hidden === true && mnn.textContent === '');
      const mandOf = eng().mandOf; eng().mandOf = i => ({ stops: i, need: 1, two: false, dry: 1, wet: false, stopsOk: i >= 1, tyresOk: true, ok: i >= 1, judged: false, rule: 'Mandatory: at least 1 stop for tyres (30 s added to the race time if not)' }); p.update();
      say('...with them the folder says the rule and where each lane stands (lane numbers from 1)', mnn.hidden === false && mnn.textContent.startsWith('Mandatory: at least 1 stop for tyres (30 s added to the race time if not). Lane 1: ') && mnn.textContent.includes(' · Lane 2: ') && mnn.textContent.includes('stops 0 of 1') && mnn.textContent.includes('done'));
      eng().mandOf = mandOf; p.update();
      say('...and the line goes away again when the rule does', mnn.hidden === true); }
  }

  // ---------- 1.42.0: the tyre stints go with the result ----------
  { key('s'); await until(() => phase() === 'finished', 3000);
    saved.length = 0; store.tyrewearsystems = [{ ...rec }];
    await openRace({ ...setupTw, laps: 4 }, store.tracks[0], rows(1, 2)); await wait(50);
    key(' '); await until(() => phase() === 'running', 3000); await wait(60);
    for (let n = 0; n < 8 && phase() !== 'finished'; n++) await lap();
    await until(() => saved.length > 0, 4000); await wait(100);
    const st = saved[0] && saved[0][0], rowsOf = st ? st.standings : [], soft = rowsOf.find(x => x.tyres && x.tyres.last === 'S'), med = rowsOf.find(x => x.tyres && x.tyres.last === 'M');
    say('the race is saved with the tyre stints of every car: the stints, the stops, the tyre at the flag', saved.length === 1 && rowsOf.length === 2 && !!soft && !!med && soft.tyres.stints.length === 1 && med.tyres.stints.length === 1 && soft.tyres.stops === 0 && soft.tyres.ms === 0);
    say('...a Soft that drove 4 laps has 82% left, a Medium 88%, counted in laps, with the levels of the system', !!soft && soft.tyres.stints[0].laps === 4 && soft.tyres.stints[0].life === 82 && med.tyres.stints[0].laps === 4 && med.tyres.stints[0].life === 88 && soft.tyres.unit === 'lap' && soft.tyres.warn === 25 && soft.tyres.crit === 10);
    say('...the lap times and the results are what was measured (the wear is not in them)', rowsOf.every(x => x.laps === 4 && Number.isFinite(x.best)) && !JSON.stringify(rowsOf).includes('twLife'));
    saved.length = 0;
    await openRace({ ...setupTw, laps: 3, tyreWear: '' }, store.tracks[0], rows(1, 2)); await wait(50);
    key(' '); await until(() => phase() === 'running', 3000); await wait(60);
    for (let n = 0; n < 6 && phase() !== 'finished'; n++) await lap();
    await until(() => saved.length > 0, 4000); await wait(100);
    say('a race with no tyre wear system saves rows as before (no tyres in them)', saved.length === 1 && saved[0][0].standings.length === 2 && saved[0][0].standings.every(x => !('tyres' in x))); }
    // a heat race: every heat starts on fresh tyres, the stints of the heats are added up for the result (the Soft wears out in 3 laps here, and its car stops once in every heat)
    saved.length = 0; store.tyrewearsystems = [{ ...rec, changeSeconds: 0.2, tyres: { S: { wear: 40 } } }];
    let resume = null; api.saveResume = async snap => { resume = JSON.parse(JSON.stringify(snap)); return true; };
    const heatSetup = { id: 'hr-tw', name: 'Heat night', sessionType: 'heats', heatBy: 'laps', laps: 5, heatPlan: 'manual', heats: 2, resultBy: 'laps', fuelRules: 'f1', lightsMin: 0, lightsMax: 0, endRule: 'all', layout: '', tyreWear: 'tw1', pitHold: 0.1 };
    const plan2 = [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }], [{ p: 1, lane: 0 }, { p: 0, lane: 1 }]];
    const lapOn = async lane => { key(String(lane + 1)); await wait(60); };
    await openRace(heatSetup, store.tracks[0], rows(1, 2), { schedule: plan2 }); await wait(50);
    let after1 = null;
    for (let h = 1; h <= 2; h++) {
      key(' '); await until(() => phase() === 'running', 5000); await wait(60);
      const sl = eng().cars.findIndex(c => c.tyre === 'S'), ol = 1 - sl; // (the lane of the Soft car in this heat: the cars swap lanes in heat 2)
      for (let n = 0; n < 3; n++) { await lapOn(sl); await lapOn(ol); }
      const e = eng(); e.block(sl, run('performance.now()')); await wait(500); e.unblock(sl, run('performance.now()')); await wait(60); // (the Soft car stops: its 4th lap, on worn out tyres, then a fresh set)
      await lapOn(ol); await lapOn(sl); await lapOn(ol);
      if (h === 1) { await until(() => phase() === 'between', 6000); await wait(250); after1 = JSON.parse(JSON.stringify([...run('live.tyreBy').values()]));
        say('after heat 1 the stints of the heat are kept for the result (one list for each driver)', after1.length === 2 && after1.every(x => x.stints.length >= 1 && x.stints.every(q => q.heat === 1)));
        say('...the Soft car: two stints (4 laps with the last one on worn out tyres, then 1 lap on the fresh set), one stop that took time', after1.some(x => x.stints.length === 2 && x.stints[0].laps === 4 && x.stints[0].worn === 1 && x.stints[1].laps === 1 && x.stops === 1 && x.ms > 0 && x.worn === 1));
        say('...and the snapshot that is kept for a race that is interrupted has them too (a resumed race has the result of the heats that are done)', !!resume && resume.heat && Array.isArray(resume.heat.tyreBy) && resume.heat.tyreBy.length === 2 && resume.heat.tyreBy.every(([, v]) => v.stints.length >= 1)); }
    }
    await until(() => saved.length > 0, 8000); await wait(150);
    const hs = saved[0] && saved[0][0], hr = hs ? hs.standings : [], soft = hr.find(x => x.tyres && x.tyres.stints.some(q => q.worn > 0)), other = hr.find(x => x !== soft);
    say('the heat race is saved with the stints of both heats for every driver, tagged with their heat', saved.length === 1 && hr.length === 2 && !!soft && soft.tyres.stints.length === 4 && [1, 1, 2, 2].every((h, k) => soft.tyres.stints[k].heat === h) && other.tyres.stints.every(q => q.heat === 1 || q.heat === 2) && other.tyres.stints.length === 2);
    say('...the stops, the time the tyres took and the laps on worn out tyres of the heats are added up (2 stops, 2 worn laps, twice the time of one heat)', soft.tyres.stops === 2 && soft.tyres.worn === 2 && soft.tyres.ms > after1.find(x => x.stops === 1).ms * 1.5 && other.tyres.stops === 0 && other.tyres.worn === 0);
    say('...the Soft car ends on the fresh set of the last heat (the tyre at the flag), each heat on a new set of tyres', soft.tyres.last === 'S' && soft.tyres.stints.map(q => q.life).join() !== '' && soft.tyres.stints[0].life === 0 && soft.tyres.stints[1].life === 60 && soft.tyres.stints[2].life === 0 && soft.tyres.stints[3].life === 60);

  key('s'); await until(() => phase() === 'finished', 3000); await wait(100);

  console.log(fails ?  fails + ' TYRE WEAR SCREEN TESTS FAILED' : 'ALL TYRE WEAR SCREEN TESTS PASSED'); process.exit(fails ? 1 : 0);
})();
