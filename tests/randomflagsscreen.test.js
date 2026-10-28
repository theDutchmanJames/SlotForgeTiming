// 1.59.0: Random flags on screen: the folder in the form of a Safety car system (closed, the settings of the folder appear when it is switched on, saving keeps the numbers), a race whose system has random
// flags (the plan in the engine, the warning on the Race Flag widget and in the audio, the flag itself, the race log), against a stand-in for the app window.
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
for (const f of ['listnum.js', 'bop.js', 'weather.js', 'tyretemperature.js', 'tyrewear.js', 'safetycar.js', 'pushsave.js', 'racelimit.js', 'endurance.js', 'failures.js', 'damage.js', 'multiclass.js', 'virtualrival.js', 'engine.js', 'heats.js', 'rotation.js', 'championship.js', 'champpoints.js', 'season.js', 'tokens.js', 'speed.js', 'distance.js','stats.js','homestats.js','carstats.js','viewset.js','picture.js','uiscale.js','depth.js','theme.js','banner.js', 'icons.js', 'delta.js','avatars.js', 'picmemo.js', 'weatherwidgets.js', 'tyrewidgets.js', 'pacewidgets.js', 'boardorder.js', 'strategywidgets.js', 'pitwidgets.js', 'allinone.js', 'chartextras.js', 'chartwidgets.js', 'widgets.js', 'frame.js', 'widgetview.js', 'backdrop.js','audiocalls.js','announcer.js','sound.js', 'timing.js', 'rows.js', 'richtext.js', 'canvas.js', 'liveshare.js','widgetpreview.js', 'review.js', 'adjustpad.js', 'adjustui.js', 'dirfolder.js', 'penaltyui.js', 'rotationwords.js', 'championshipwords.js', 'rotationdrag.js','padui.js','livegrid.js', 'homegrid.js', 'drivergrid.js', 'homecards.js', 'liveview.js', 'setupwords.js', 'systemwords.js', 'formui.js', 'railform.js', 'temperatureeditor.js', 'database.js', 'landing.js', 'race.js', 'undo.js', 'editor.js', 'charteditor.js','tokenui.js', 'bopui.js', 'damageui.js', 'weatherui.js', 'tyreui.js', 'pushsaveui.js', 'virtualrivalui.js', 'rotationui.js', 'championshipui.js', 'audiostudio.js','audioedit.js','widgetbuilder.js','transferui.js','themeui.js','hardware.js','trackmate.js','hardwareui.js', 'dsui.js', 'app.js']) vm.runInContext(fs.readFileSync(R + 'renderer/' + f, 'utf8'), ctx, { filename: f });
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
  const eng = () => run('live.engine()'), flagHtml = () => node('flag').val.innerHTML, SC = () => vm.runInContext('SafetyCar', ctx), same_ = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const rec = { id: 'sc1', name: 'GP', target: 15, points: 2, pitPercent: 50 };
  const rf = { id: 'sc2', name: 'Random GP', target: 15, points: 2, pitPercent: 50, rndOn: 'on', rndChance: 100, rndMode: 'exact', rndMin: 1, rndEnd: 'timer', rndLenMode: 'fixed', rndLen: 5, rndFrom: 2, rndTo: 90, rndGap: 5, rndWarn: 60 };
  store.safetycarsystems = [rec, rf];
  store.penaltysystems = [{ id: 'p1', name: 'Points', timeRule: 'every', everyPoints: 5, everySeconds: 5 }];
  store.layouts = [{ id: 'SCL', name: 'Flags', ratioW: 16, ratioH: 9, widgets: [
    { id: 'a', type: 'textrace', lane: null, x: 0, y: 0, w: 300, h: 80, textSize: '', textColor: '', bgColor: '', opt: { text: 'Flag: {flag}' } },
    { id: 'b', type: 'flag', lane: null, x: 0, y: 100, w: 300, h: 80, textSize: '', textColor: '', bgColor: '', opt: { flagStyle: 'text' } },
    { id: 'c', type: 'yellow', lane: null, x: 0, y: 200, w: 300, h: 80, textSize: '', textColor: '', bgColor: '', opt: {} }] }];
  const setupSc = { id: 's-sc', name: 'Safety race', sessionType: 'race', laps: 100, layout: 'SCL', lightsMin: 0, lightsMax: 0, fuelRules: 'f1', penaltySystem: 'p1', safetyCar: 'sc1', endRule: 'all', pitHold: 0.1 };

  // ---------- the form ----------
  run("state.settings = { theme: 'dark' }; state.tab = 'setup'; state.setupSub = 'safetycar'"); await run('render()'); await wait(50);
  say('the page of the Safety Car Systems tells that the folder Random Flags can put the yellow flag up at random moments', E('setupnote').textContent.includes('The folder Random Flags can also put the yellow flag up at random moments.'));
  run("openForm('safetycarsystems', null)"); await wait(30);
  { const h = E('dlg').innerHTML, fg = h.slice(h.indexOf('<details class="fgroup rssec" data-fg="flags"'));
    say('the form of a new system has the section Random Flags after Behind the Safety Car (1.76.0: Basics, Lap times and Pit stops are one section), and it is closed to begin with (no "open" on it)', ['Behind the Safety Car', 'Random Flags'].every(x => h.includes(x)) && h.indexOf('Behind the Safety Car') < h.indexOf('Random Flags') && /^<details class="fgroup rssec" data-fg="flags"><summary>/.test(fg));
    say('...with the question of the section (and the note of the switch)', fg.includes('Should Safety Car periods come at random moments?') && fg.includes('comes at random moments as if another car caused it'));
    say('...and its 17 settings, each with a hint (the switch Off to begin with, the rest as the standard says)', (fg.match(/data-key="rnd(?!Line)/g) || []).length === 17 && /<select id="f-rndOn" hidden[^>]*><option value="off" selected>/.test(fg) && /id="f-rndChance"[^>]*value="100"/.test(fg) && /id="f-rndMin"[^>]*value="2"/.test(fg) && /id="f-rndLen"[^>]*value="30"/.test(fg) && /id="f-rndFrom"[^>]*value="10"/.test(fg) && /id="f-rndTo"[^>]*value="90"/.test(fg) && /id="f-rndGap"[^>]*value="30"/.test(fg) && /id="f-rndWarn"[^>]*value="0"/.test(fg) && (fg.match(/class="muted hint"/g) || []).length === 17); }
  { const set = (k, v) => { E('f-' + k).value = v; };
    set('name', 'Club GP'); set('rndOn', 'on'); set('rndChance', '70'); set('rndMode', 'range'); set('rndMin', '2'); set('rndMax', '4'); set('rndEnd', 'timer'); set('rndLenMode', 'range'); set('rndLen', '20'); set('rndLenMax', '45'); set('rndFrom', '15'); set('rndTo', '85'); set('rndGap', '12'); set('rndWarn', '8');
    await E('frm').onsubmit({ preventDefault() {} }); await wait(20);
    const r = (added[0] || [])[1] || {};
    say('saving keeps the numbers of the folder as numbers and the choices as they are', added.length === 1 && r.rndOn === 'on' && r.rndChance === 70 && r.rndMode === 'range' && r.rndMin === 2 && r.rndMax === 4 && r.rndLenMode === 'range' && r.rndLen === 20 && r.rndLenMax === 45 && r.rndFrom === 15 && r.rndTo === 85 && r.rndGap === 12 && r.rndWarn === 8);
    say('...and the race reads them back as the same rules (seconds in milliseconds)', same_(SC().clean(r).rnd, { chance: 70, mode: 'range', min: 2, max: 4, more: 0, lenMin: 20000, lenMax: 45000, end: 'timer', from: 15, to: 85, gap: 12000, free: 1200000, warn: 8000 })); }
  { added.length = 0; run("openForm('safetycarsystems', null)"); await wait(30); E('f-name').value = 'Plain'; E('f-rndOn').value = 'off'; await E('frm').onsubmit({ preventDefault() {} }); await wait(20);
    const r = (added[0] || [])[1] || {};
    say('a system saved with the switch Off has no random flags for the race, whatever the other numbers of the folder say (they stay in the record)', r.rndOn === 'off' && r.rndChance === 70 && SC().clean(r).rnd === undefined && SC().cleanRandom(r) === null); }

  // ---------- a race with random flags ----------
  const spoken = []; ctx.Sound.state.backend = { speak: (t, o, done) => { spoken.push(t); done(); }, file: (u, o, done) => { spoken.push('file'); done(); }, stop: () => {} };
  store.audiosets = [{ id: 'AUS', name: 'Safety', rate: 1, pitch: 1, volume: 1, driverBy: 'name', calls: Object.fromEntries(Object.entries({ yellowflag: 'MARK flag', yellowsoon: 'MARK soon', yellowtarget: 'MARK target {target}', greenflag: 'MARK green' }).map(([id, t]) => [id, { on: true, lines: [{ text: t, file: '' }] }])) }];
  ctx.Sound.stop(); run('state.rand = () => 0'); spoken.length = 0;
  const setupRf = { ...setupSc, id: 's-rf', safetyCar: 'sc2', audioSet: 'AUS' }, of = ty => eng().events.filter(e => e.type === ty), textNow = () => node('textrace').val.innerHTML;
  store.racesetups = [setupRf];
  await openRace(setupRf, store.tracks[0], rows(1, 2)); await wait(50);
  say('a race whose system has random flags gets the settings in the engine (seconds in milliseconds), and no plan before the start', eng().randomFlags && eng().randomFlags.min === 1 && eng().randomFlags.lenMin === 5000 && eng().randomFlags.warn === 60000 && eng().cfg.safetycar.rnd.gap === 5000 && eng().rndInfo() === null);
  key(' '); await until(() => phase() === 'running', 3000); await wait(60);
  say('...the plan is drawn when the race starts (here, with the rolls of the test, one flag after 2 laps of the leader, 5 seconds)', same_(eng().rndInfo().plan, [{ at: 2, len: 5000 }]) && eng().rndInfo().unit === 'laps');
  say('...the flag widget says Racing, nothing is said, nothing is in the log', textNow().includes('Flag: Racing') && !flagHtml().includes('SOON') && eng().rndSoon === false && eng().events.every(e => !/^random/.test(e.type)) && spoken.filter(t => t.startsWith('MARK')).length === 0);
  key('1'); await wait(200);
  say('the leader completes lap 1: the flag is about to come, so the warning is on: the Race Flag widget says SAFETY CAR SOON (the system has the Safety Car) in yellow', eng().cars[0].laps.length === 1 && eng().rndSoon === true && flagHtml().includes('SAFETY CAR SOON'));
  say('...the audio says it once (the call Yellow flag soon), and the log has the line', spoken.filter(t => t === 'MARK soon').length === 1 && of('randomsoon').length === 1 && of('randomsoon')[0].n === 1 && eng().flag === '');
  say('...the race is not touched: the green flag still, the Safety Car is not out', eng().scOut() === false && textNow().includes('Flag: Racing'));
  await wait(300); say('...and the call is not said again while the warning lasts', spoken.filter(t => t === 'MARK soon').length === 1);
  key('1'); await wait(250);
  say('the leader completes lap 2: the yellow flag goes up by itself (the Safety Car is out), with nobody pressing anything', eng().flag === 'yellow' && eng().scOut() === true && of('randomflag').length === 1 && same_(of('randomflag')[0].n + '/' + of('randomflag')[0].of + '/' + of('randomflag')[0].len, '1/1/5000'));
  say('...the warning is over, the widgets say Safety Car (not Soon), the flag text too, and the log has the Safety Car line', eng().rndSoon === false && flagHtml().includes('SAFETY CAR') && !flagHtml().includes('SOON') && textNow().includes('Flag: Safety Car') && of('safetycar').length === 1 && of('safetycar')[0].out === true);
  say('...the audio says the yellow flag and the limit of the system, as it does for any other yellow flag', spoken.filter(t => t.startsWith('MARK')).join() === 'MARK soon,MARK flag,MARK target 15 seconds', spoken.join());
  say('...the other windows are told: the flag, and (one message before) the warning; a window that follows rebuilds the same random flags', sent.dyn && sent.dyn.flag === 'yellow' && sent.log.some(m => m.rndSoon === true) && sent.log[sent.log.length - 1].rndSoon === false && same_(vm.runInContext('RaceEngine', ctx).createRace({ ...sent.stat.cfg, entries: sent.stat.cfg.entries.map(e => ({ ...e })) }).randomFlags, eng().randomFlags));
  await until(() => eng().flag === '', 9000); await wait(150);
  say('5 seconds of the race later the flag comes down by itself: the Safety Car goes in, the widgets say Racing again, the audio says the green flag', eng().flag === '' && eng().scOut() === false && textNow().includes('Flag: Racing') && !flagHtml().includes('SAFETY CAR') && spoken.includes('MARK green') && of('safetycar').length === 2 && of('safetycar')[1].out === false);
  say('...the log says it was the time that lifted it, and there are no more flags in this race', of('randomend').length === 1 && of('randomend')[0].by === 'time' && of('randomflag').length === 1);
  say('the log of the race has them in order: the warning, the flag, the Safety Car out, the Safety Car in, the end of the flag', eng().events.filter(e => /^(random|safetycar)/.test(e.type)).map(e => e.type + (e.out === undefined ? '' : e.out ? ':out' : ':in')).join() === 'randomsoon,safetycar:out,randomflag,safetycar:in,randomend');
  key('s'); await until(() => phase() === 'finished', 3000); await wait(60); ctx.Sound.stop(); spoken.length = 0;

  // a race of a system without random flags: nothing of it
  store.racesetups = [setupSc]; await openRace({ ...setupSc, audioSet: 'AUS' }, store.tracks[0], rows(1, 2)); await wait(50);
  key(' '); await until(() => phase() === 'running', 3000); await wait(60); key('1'); await wait(150); key('1'); await wait(200);
  say('a race whose system has no random flags: no plan, no warning, no flag by itself (the engine does nothing the old way did not do)', eng().randomFlags === null && eng().rndInfo() === null && eng().rndSoon === false && eng().flag === '' && of('randomflag').length === 0 && of('randomsoon').length === 0 && spoken.filter(t => t.startsWith('MARK')).length === 0);
  key('s'); await until(() => phase() === 'finished', 3000); await wait(60); ctx.Sound.stop(); spoken.length = 0; run('state.rand = null');

  console.log(fails ? fails + ' RANDOM FLAGS SCREEN TESTS FAILED' : 'ALL RANDOM FLAGS SCREEN TESTS PASSED'); process.exit(fails ? 1 : 0);
})();
