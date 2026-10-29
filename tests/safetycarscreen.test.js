// 1.53.0: the Safety Car System on screen: its page (a sub-tab of Race Setup after Weather Systems) and form, the race setup field (and the Yellow flag fields it replaces), the engine the race window builds,
// the flag and the Yellow flag button that say Safety Car, the race log and the lap review, the Rules card of the Home tab, and what is shared with the other windows, against a stand-in for the app window.
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
for (const f of ['listnum.js', 'bop.js', 'weather.js', 'tyretemperature.js', 'tyrewear.js', 'safetycar.js', 'pushsave.js', 'racelimit.js', 'endurance.js', 'failures.js', 'damage.js', 'multiclass.js', 'virtualrival.js', 'engine.js', 'heats.js', 'rotation.js', 'championship.js', 'champpoints.js', 'season.js', 'tokens.js', 'speed.js', 'distance.js','stats.js','homestats.js','carstats.js','viewset.js','picture.js','uiscale.js','depth.js','theme.js','banner.js', 'icons.js', 'delta.js','avatars.js', 'picmemo.js', 'weatherwidgets.js', 'tyrewidgets.js', 'pacewidgets.js', 'boardorder.js', 'strategywidgets.js', 'pitwidgets.js', 'allinone.js', 'chartextras.js', 'chartwidgets.js', 'widgets.js', 'frame.js', 'laphighlights.js', 'widgetview.js', 'backdrop.js','audiocalls.js','announcer.js','sound.js', 'timing.js', 'rows.js', 'richtext.js', 'canvas.js', 'liveshare.js','widgetpreview.js', 'review.js', 'adjustpad.js', 'adjustui.js', 'dirfolder.js', 'penaltyui.js', 'rotationwords.js', 'championshipwords.js', 'rotationdrag.js','padui.js','livegrid.js', 'homegrid.js', 'drivergrid.js', 'homecards.js', 'liveview.js', 'setupwords.js', 'systemwords.js', 'formui.js', 'railform.js', 'temperatureeditor.js', 'database.js', 'landing.js', 'race.js', 'undo.js', 'editor.js', 'charteditor.js','tokenui.js', 'bopui.js', 'damageui.js', 'weatherui.js', 'tyreui.js', 'pushsaveui.js', 'virtualrivalui.js', 'rotationui.js', 'championshipui.js', 'audiostudio.js','audioedit.js','widgetbuilder.js','transferui.js','themeui.js','hardware.js','trackmate.js','hardwareui.js', 'dsui.js', 'app.js']) vm.runInContext(fs.readFileSync(R + 'renderer/' + f, 'utf8'), ctx, { filename: f });
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
  const eng = () => run('live.engine()'), flagText = () => node('textrace').val.innerHTML, SC = () => vm.runInContext('SafetyCar', ctx), same_ = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const rec = { id: 'sc1', name: 'GP', target: 15, points: 2, pitPercent: 50 };
  store.safetycarsystems = [rec];
  store.penaltysystems = [{ id: 'p1', name: 'Points', timeRule: 'every', everyPoints: 5, everySeconds: 5 }];
  store.layouts = [{ id: 'SCL', name: 'Flags', ratioW: 16, ratioH: 9, widgets: [
    { id: 'a', type: 'textrace', lane: null, x: 0, y: 0, w: 300, h: 80, textSize: '', textColor: '', bgColor: '', opt: { text: 'Flag: {flag}' } },
    { id: 'b', type: 'flag', lane: null, x: 0, y: 100, w: 300, h: 80, textSize: '', textColor: '', bgColor: '', opt: { flagStyle: 'text' } },
    { id: 'c', type: 'yellow', lane: null, x: 0, y: 200, w: 300, h: 80, textSize: '', textColor: '', bgColor: '', opt: {} }] }];
  const setupSc = { id: 's-sc', name: 'Safety race', sessionType: 'race', laps: 12, layout: 'SCL', lightsMin: 0, lightsMax: 0, fuelRules: 'f1', penaltySystem: 'p1', safetyCar: 'sc1', endRule: 'all', pitHold: 0.1 };

  // ---------- the Safety Car Systems page ----------
  run("state.settings = { theme: 'dark' }; state.tab = 'setup'; state.setupSub = 'safetycar'"); await run('render()'); await wait(50);
  const tabs = E('setuptabs').innerHTML;
  say('Safety Car Systems stays in the Race Systems menu between Damage and Weather', tabs.indexOf('class="ssgroups"') < tabs.indexOf('data-id="safetycar"') && tabs.indexOf('data-id="damage"') < tabs.indexOf('data-id="safetycar"') && tabs.indexOf('data-id="safetycar"') < tabs.indexOf('data-id="weather"') && /data-id="safetycar"/.test(tabs));
  say('...it is the open one now, in its own colour (the class of the chip is ss-sc)', /class="sstab ss-sc" role="tab" aria-selected="true" data-id="safetycar"/.test(tabs));
  say('...it is not in the Database tab', !run('state.schema').safetycarsystems.database && !(run("typeof DB_TABS !== 'undefined' ? JSON.stringify(DB_TABS) : ''") || '').includes('safetycar'));
  say('...with a note that says what a safety car system is, and that a race setup chooses one', E('setupnote').textContent.includes('A safety car system is the Safety Car that comes out with the yellow flag') && E('setupnote').textContent.includes('Choose one in a race setup (Rules and Systems)') && E('setupnote').textContent.includes('yellow Track Call'));
  say('...the sets are listed and kept like the other rule sets (the page lists the sets of that kind)', E('setupmgr').innerHTML.includes('GP') && run('state.schema.safetycarsystems.plural') === 'Safety car systems');

  // ---------- the fields ----------
  { const F = run('state.schema.racesetups.fields'), isShown = run('isShown'), f = F.find(x => x.key === 'safetyCar'), by = k => F.find(x => x.key === k), shown = (fld, o) => isShown(fld, k => o[k]);
    say('a race setup has a Safety car system field in the rules: a choice of the systems, "No safety car" to begin with', f && f.group === 'rules' && f.type === 'ref' && f.ref === 'safetycarsystems' && f.blank === 'No safety car' && f.hint.includes('It replaces the Yellow flag settings'));
    say('...it is asked for every kind of racing and not for a Time Token Session', ['race', 'heats', 'endurance', 'practice', 'qualifying'].every(t => shown(f, { sessionType: t })) && !shown(f, { sessionType: 'tokens' }));
    const keys = F.map(x => x.key);
    say('the Safety Car selector precedes Tyre Wear, while the pit sensor is in Race Settings', keys.indexOf('safetyCar') + 1 === keys.indexOf('tyreWear') && by('pitHold').group === 'length');
    say('the retired Yellow flag fields are absent; Race Settings owns the Track Call', !by('yellowTarget') && !by('yellowPoints') && by('trackCallAction').group === 'length');
    say('Safety Car stays in Rules and Systems; there is no retired Yellow flag group', run('state.schema.racesetups.groups').some(g => g.id === 'rules' && g.title === 'Rules and Systems') && !run('state.schema.racesetups.groups').some(g => g.id === 'yellow')); }

  // ---------- the form ----------
  run("openForm('safetycarsystems', null)"); await wait(30);
  { const h = E('dlg').innerHTML;
    say('the form of a new system has the name and the three numbers, starting at 15 seconds, 1 point and 50 percent', ['f-name', 'f-target', 'f-points', 'f-pitPercent'].every(id => h.includes(`id="${id}"`)) && /id="f-target"[^>]*value="15"/.test(h) && /id="f-points"[^>]*value="1"/.test(h) && /id="f-pitPercent"[^>]*value="50"/.test(h));
    say('...in one section, Behind the Safety Car (1.76.0: it was three folders, Basics, Lap times and Pit stops), with the labels that say what the numbers do and the unit next to the box', h.includes('Behind the Safety Car') && !h.includes('<strong>Lap times</strong>') && !h.includes('<strong>Pit stops</strong>') && h.includes('Target lap time') && h.includes('Penalty points for failing target lap time') && h.includes('Service work reduction') && /id="f-target"[^>]*>\s*<span[^>]*>seconds<\/span>/.test(h) && /id="f-pitPercent"[^>]*>\s*<span[^>]*>percent<\/span>/.test(h)); }
  { const set = (k, v) => { E('f-' + k).value = v; };
    set('name', 'Club GP'); set('target', '20'); set('points', '3'); set('pitPercent', '30');
    await E('frm').onsubmit({ preventDefault() {} }); await wait(20);
    const r = (added[0] || [])[1] || {};
    say('saving keeps the name and the three numbers as numbers', added.length === 1 && added[0][0] === 'safetycarsystems' && r.name === 'Club GP' && r.target === 20 && r.points === 3 && r.pitPercent === 30);
    say('...and the race reads them back as the same rules (seconds in milliseconds)', same_(SC().clean(r), { target: 20000, points: 3, pit: 30 })); }

  // ---------- the Home tab: the Rules of this race card ----------
  { store.racesetups = [{ ...setupSc, track: 't1' }];
    const g = JSON.parse(run('JSON.stringify(HomeGrid.gridOf({}))')); g.rows = 5; g.boards.push({ c: 1, r: 4, w: 2, h: 2, opt: { card: 'rules' } });
    run('state.settings.homeGrid = ' + JSON.stringify(g)); run("state.tab = 'home'"); await run('render()'); await wait(150);
    const card = E('hmc-rules').innerHTML;
    say('the Rules of this race card names the safety car system of the setup, as the last line', card.includes('<span class="muted">Tyre wear</span><strong>Off</strong></div><div class="hm-kv"><span class="muted">Safety car</span><strong>GP</strong></div></section>'));
    store.racesetups = [{ ...setupSc, track: 't1', safetyCar: '' }]; await run('render()'); await wait(150);
    say('...a setup with none has no line about it', E('hmc-rules').innerHTML.includes('Tyre wear') && !E('hmc-rules').innerHTML.includes('Safety car'));
    run('delete state.settings.homeGrid'); }

  // ---------- the race window ----------
  store.racesetups = [setupSc];
  await openRace(setupSc, store.tracks[0], rows(1, 2)); await wait(50);
  say('a race with a safety car system gets its rules in the engine (seconds in milliseconds)', same_(eng().safetyCar, { target: 15000, points: 2, pit: 50 }) && eng().scOut() === false && eng().cfg.safetycar.target === 15000);
  say('...they replace the Yellow flag fields of the setup (the engine judges the laps by the system)', same_({ t: eng().yellow.target, p: eng().yellow.points }, { t: 15000, p: 2 }));
  say('...the Yellow flag button of the race screen says Safety Car (for the whole race, before the flag goes up too)', (node('yellow').val.innerHTML + node('yellow').val.textContent).includes('Safety Car') && !(node('yellow').val.innerHTML + node('yellow').val.textContent).includes('Yellow flag'));
  { const other = { ...setupSc, yellowTarget: 5, yellowPoints: 9 }; await openRace(other, store.tracks[0], rows(1, 2)); await wait(30);
    say('a setup that has Yellow flag settings from before and a safety car system uses the system only', eng().yellow.target === 15000 && eng().yellow.points === 2);
    const off = { ...setupSc, safetyCar: '', yellowTarget: 5, yellowPoints: 3 }; await openRace(off, store.tracks[0], rows(1, 2)); await wait(30);
    say('a race setup with no safety car system has none: nothing in the engine, retired Yellow flag settings are ignored, the button says Yellow flag', eng().safetyCar === null && eng().yellow.target === 0 && eng().yellow.points === 0 && (node('yellow').val.innerHTML + node('yellow').val.textContent).includes('Yellow flag') && !(node('yellow').val.innerHTML + node('yellow').val.textContent).includes('Safety Car'));
    for (const t of ['practice', 'qualifying', 'timed', 'heats']) { await openRace({ ...setupSc, sessionType: t, duration: 5, heats: 2 }, store.tracks[0], rows(1, 2)); await wait(20);
      say(`...a ${t} has the safety car system when the setup says so`, eng() && eng().safetyCar !== null && eng().safetyCar.target === 15000); }
    const gone = { ...setupSc, safetyCar: 'sc-deleted' }; await openRace(gone, store.tracks[0], rows(1, 2)); await wait(30);
    say('...a race setup whose system is gone has none', eng().safetyCar === null);
    const tok = { ...setupSc, sessionType: 'tokens' }; await openRace(tok, store.tracks[0], rows(1, 2)); await wait(30);
    say('...a Time Token Session never has it', eng().safetyCar === null); }

  // ---------- a race: the flag, the laps, the pit stop, the log ----------
  const spoken = []; ctx.Sound.state.backend = { speak: (t, o, done) => { spoken.push(t); done(); }, file: (u, o, done) => { spoken.push('file'); done(); }, stop: () => {} };
  store.audiosets = [{ id: 'AUS', name: 'Safety', rate: 1, pitch: 1, volume: 1, driverBy: 'name', calls: Object.fromEntries(Object.entries({ yellowflag: 'MARK flag', yellowtarget: 'MARK target {target}', yellowfast: 'MARK fast {driver} {time} {target}', penalty: 'MARK pen {driver} {points}' }).map(([id, t]) => [id, { on: true, lines: [{ text: t, file: '' }] }])) }];
  ctx.Sound.stop(); run('state.rand = () => 0'); spoken.length = 0;
  const raceSc = { ...setupSc, audioSet: 'AUS' };
  await openRace(raceSc, store.tracks[0], rows(1, 2)); await wait(50);
  key(' '); await until(() => phase() === 'running', 3000); await wait(60);
  say('the green flag: the flag text says Racing, the widget says the flag, nothing about the Safety Car yet', flagText().includes('Flag: Racing') && eng().scOut() === false && eng().events.every(e => e.type !== 'safetycar'));
  key('y'); await wait(150);
  say('Y: the Safety Car is out: the flag text, the flag widget and the button say Safety Car (not Yellow flag), the log has the line', eng().scOut() === true && eng().flag === 'yellow' && flagText().includes('Flag: Safety Car') && node('flag').val.innerHTML.includes('SAFETY CAR') && !node('flag').val.innerHTML.includes('YELLOW FLAG') && node('yellow').val.innerHTML.includes('Safety Car') && eng().events.filter(e => e.type === 'safetycar').length === 1 && eng().events.find(e => e.type === 'safetycar').out === true);
  say('...the audio says the yellow flag and then the limit of the system, as it does for the target of a race setup', spoken.filter(t => t.startsWith('MARK')).join() === 'MARK flag,MARK target 15 seconds', spoken.join());
  spoken.length = 0; key('1'); await wait(150);
  say('a lap that began before the Safety Car came out is not called out', spoken.filter(t => t.startsWith('MARK')).length === 0 && eng().cars[0].points === 0);
  await wait(60); key('1'); await wait(200);
  say('the next lap, a full lap behind the Safety Car and much faster than 15 seconds, is called out, and has the 2 points of the system after it', /^MARK fast Alex \d+\.\d\d 15 seconds$/.test(spoken.filter(t => t.startsWith('MARK'))[0] || '') && spoken.filter(t => t.startsWith('MARK'))[1] === 'MARK pen Alex 2' && eng().cars[0].points === 2 && eng().cars[0].yellowFast.join() === '1', spoken.join(' | '));
  E('lapsbtn').onclick({}); E('lapreview').onclick({ target: { closest: () => ({ dataset: { rv: 'laps', car: '0' } }) } });
  say('the lap review marks that lap as faster than the Safety Car limit (and not as faster than the yellow flag target)', E('lapreview').innerHTML.split('class="rv-lap').filter(x => x.includes('faster than the Safety Car limit')).length === 1 && !E('lapreview').innerHTML.includes('faster than the yellow flag target'));
  { const yb = { disabled: true, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, textContent: '' };
    const host = document.createElement('div'); await run('LiveView.mount')(host, {}); run('LiveView.go')('director'); await wait(150);
    E('lv-body').querySelectorAll = sel => (sel === '[data-cmd="yellow"]' ? [yb] : []); cbs.dyn.forEach(f => f(plain(sent.dyn))); await wait(100);
    say('the Race Director page names the flag button Safety Car, and it is pressed while the Safety Car is out', yb.textContent === 'Safety Car' && yb.attrs['aria-pressed'] === 'true' && yb.disabled === false);
    }
  await wait(300);
  say('what is shared with the other windows: the system (so a phone and the Race Director page name it too), and with the flag up the Safety Car is out for them', !!sent.stat.cfg.safetycar && sent.stat.cfg.safetycar.pit === 50 && sent.dyn && sent.dyn.flag === 'yellow');
  { const viewer = vm.runInContext('RaceEngine', ctx).createRace({ ...sent.stat.cfg, entries: sent.stat.cfg.entries.map(e => ({ ...e })) });
    say('...a window that follows rebuilds the same system and says Safety Car for the flag', same_(viewer.safetyCar, eng().safetyCar) && (viewer.flag = 'yellow', viewer.scOut() === true)); }
  key('y'); await wait(100);
  say('Y again: the Safety Car goes in, the flag text is Racing again, the log has the second line (with the laps the leader had driven)', eng().scOut() === false && flagText().includes('Flag: Racing') && same_(eng().events.filter(e => e.type === 'safetycar').map(x => [x.out, x.laps]), [[true, 0], [false, 2]]));
  run('state.autoFinalize = false');
  key('s'); await until(() => phase() === 'review', 3000); await wait(60);
  say('Stop opens the review after the race', phase() === 'review' && E('review').hidden === false);
  if (!E('review').innerHTML.includes('rv-laps')) { await E('review').onclick({ target: { closest: () => ({ dataset: { rv: 'laps', car: '0' } }) } }); await wait(100); } // (the lap list of a lane stays open from the lap review during the race)
  say('the lap list of the review marks the lap that was too fast as faster than the Safety Car limit (once)', E('review').innerHTML.split('class="rv-lap').filter(x => x.includes('faster than the Safety Car limit')).length === 1 && !E('review').innerHTML.includes('faster than the yellow flag target'));
  run('state.autoFinalize = true'); await E('review').onclick({ target: { closest: () => ({ dataset: { rv: 'finalize' } }) } }); await until(() => phase() === 'finished', 3000); await wait(100); ctx.Sound.stop(); spoken.length = 0;

  // a race with the plain yellow flag says Yellow flag in all those places
  await openRace({ ...setupSc, safetyCar: '', yellowTarget: 15, yellowPoints: 1, audioSet: 'AUS' }, store.tracks[0], rows(1, 2)); await wait(50);
  key(' '); await until(() => phase() === 'running', 3000); await wait(60); key('y'); await wait(150);
  say('a race without a safety car system: the flag text says Yellow flag, the widget YELLOW FLAG, no Safety Car line in the log, and a lap too fast is "faster than the yellow flag target" in the review', flagText().includes('Flag: Yellow flag') && node('flag').val.innerHTML.includes('YELLOW FLAG') && eng().events.every(e => e.type !== 'safetycar') && eng().scOut() === false);
  await wait(60); key('1'); await wait(60); key('1'); await wait(150);
  E('lapsbtn').onclick({}); E('lapreview').onclick({ target: { closest: () => ({ dataset: { rv: 'laps', car: '0' } }) } });
  say('retired standalone yellow-flag targets do not mark a lap or create Safety Car events', !E('lapreview').innerHTML.includes('faster than the yellow flag target') && !E('lapreview').innerHTML.includes('faster than the Safety Car'));
  key('s'); await until(() => phase() === 'finished', 3000); await wait(60); ctx.Sound.stop(); spoken.length = 0; run('state.rand = null');

  console.log(fails ? fails + ' SAFETY CAR SCREEN TESTS FAILED' : 'ALL SAFETY CAR SCREEN TESTS PASSED'); process.exit(fails ? 1 : 0);
})();
