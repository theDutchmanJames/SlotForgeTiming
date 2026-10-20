// 1.56.0: the points of a championship on screen: the Points section of the editor, the panel after a race (on the race screen and in Results and Records: award, undo, do not count),
// the Championships page of Results and Records (standings, teams, rounds, PDF) and the standings on the Home card, against a stand-in for the app window.
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
  drivers: [{ id: 'd1', name: 'Alex' }, { id: 'd2', name: 'Sam' }, { id: 'd3', name: 'Kim' }, { id: 'd4', name: 'Lee' }],
  slotcars: [1, 2, 3, 4].map(i => ({ id: 'c' + i, brand: 'Car' + i })), racesetups: [], weathersystems: [], fuelrules: [], layouts: [], rowdesigns: [], sessions: [], laps: []
};
const saved = [], added = [], updated = [], pdfs = [];
const sent = { stat: null, dyn: null, n: 0, last: null, log: [], gaps: 0 }, cbs = { stat: [], dyn: [], cmd: [] }, cmds = []; // what the race window shares with other windows (as plain text, like the real link)
// like the app does: the messages of the race window are put together into the whole state (sent.dyn), which a window that opens late is given; sent.last is the last message as it was sent
const merge = (state, m) => vm.runInContext('LiveShare', ctx).applyDynamic(state, m);
const plain = d => { const x = { ...d }; delete x.seq; return x; }; // a whole state without a message number (what an older race window sends): always accepted
const api = { liveStatic: s => { sent.stat = JSON.parse(JSON.stringify(structuredClone(s))); sent.dyn = null; sent.last = null; }, livePush: d => { const m = JSON.parse(JSON.stringify(structuredClone(d))); sent.last = m; sent.log.push(m); sent.n++; const r = merge(sent.dyn, m); if (r.ok) { if (!r.stale) sent.dyn = r.state; } else { sent.dyn = null; sent.gaps++; } },
  liveGet: async () => JSON.parse(JSON.stringify({ stat: sent.stat, dyn: sent.dyn })), onLive: f => { cbs.dyn.push(f); return () => {}; }, onLiveStatic: f => { cbs.stat.push(f); return () => {}; }, liveOpen: async () => ({ second: true }), liveCommand: c => { cmds.push(c); cbs.cmd.forEach(f => f(JSON.parse(JSON.stringify(c)))); }, onCommand: f => { cbs.cmd.push(f); return () => { cbs.cmd = cbs.cmd.filter(x => x !== f); }; },
  schema: async () => schema, getSettings: async () => ({ theme: 'dark', rules: 'Be kind. No bumping.' }), setSettings: async p => ({ ...(ctx.__ready ? vm.runInContext('state.settings', ctx) : {}), ...p }), dbPath: async () => 'x',
  list: async e => JSON.parse(JSON.stringify(store[e] || [])), customFields: async () => [], linkedLaps: async () => 0,
  saveSession: async (s, l) => { saved.push([s, l]); const row = { ...JSON.parse(JSON.stringify(s)), id: 'S' + (store.sessions.length + 1) }; store.sessions.push(row); return row.id; }, exportPdf: async (html, name) => { pdfs.push([html, name]); return { saved: true, path: '/docs/' + name }; }, add: async (e, rec) => { added.push([e, rec]); return {}; }, update: async (e, id, rec) => { updated.push([e, id, rec]); return {}; }, remove: async () => {} };
// the app reports a screen that could not be drawn with console.error: that is a failed test (unless the test expects it)
const appConsole = { ...console, expected: false, seen: 0, error: (...a) => { if (appConsole.expected) { appConsole.seen++; return; } console.log('FAIL the app reported an error: ' + a.map(x => (x && x.stack) || x).join(' ').slice(0, 300)); fails++; } };
// the real app passes everything through Electron's structured clone, which refuses a function ("An object could not be cloned"): every call of the app interface is checked the same way here
for (const k of Object.keys(api)) { const f = api[k]; if (typeof f === 'function') api[k] = (...x) => { x.forEach(v => { if (typeof v !== 'function') structuredClone(v); }); return f(...x); }; }
const ctx = vm.createContext({ document, api, console: appConsole, Intl, URL, Image: function () {}, confirm: () => true, alert() {}, setTimeout, clearTimeout, setInterval, clearInterval, performance });
ctx.__ready = true; ctx.window = ctx; ctx.addEventListener = () => {}; ctx.removeEventListener = () => {};
for (const f of ['listnum.js', 'bop.js', 'weather.js', 'tyrewear.js', 'safetycar.js', 'pushsave.js', 'endurance.js', 'failures.js', 'damage.js', 'engine.js', 'heats.js', 'rotation.js', 'championship.js', 'champpoints.js', 'tokens.js', 'speed.js', 'distance.js','stats.js','homestats.js','carstats.js','viewset.js','picture.js','uiscale.js','depth.js','theme.js','banner.js', 'icons.js', 'delta.js','avatars.js', 'weatherwidgets.js', 'tyrewidgets.js', 'pacewidgets.js', 'boardorder.js', 'widgets.js', 'frame.js', 'backdrop.js','announcer.js','sound.js', 'timing.js', 'rows.js', 'richtext.js', 'report.js', 'canvas.js', 'liveshare.js', 'review.js', 'adjustpad.js', 'adjustui.js', 'dirfolder.js', 'penaltyui.js', 'rotationdrag.js','padui.js','livegrid.js', 'homegrid.js', 'drivergrid.js', 'homecards.js', 'liveview.js', 'database.js', 'landing.js', 'race.js', 'undo.js', 'editor.js','tokenui.js', 'bopui.js', 'damageui.js', 'weatherui.js', 'tyreui.js', 'pushsaveui.js', 'rotationui.js', 'championshipui.js', 'audioedit.js','widgetbuilder.js','transferui.js','themeui.js','hardware.js','trackmate.js','hardwareui.js', 'dsui.js', 'app.js']) vm.runInContext(fs.readFileSync(R + 'renderer/' + f, 'utf8'), ctx, { filename: f });
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
const C = require(R + 'renderer/championship.js');
const resumes = [], removed = [];
store.teams = [{ id: 'tm1', name: 'Foxes', drivers: ['d1', 'd2'] }, { id: 'tm2', name: 'Arrows', drivers: ['d3'] }];
store.layouts = [{ id: 'L1', name: 'Plain', ratioW: 16, ratioH: 9, widgets: [] }];
store.championships = [];
const SPR = { id: 's-prac', name: 'Practice 5 min', sessionType: 'practice', track: 't1', duration: 5, layout: 'L1' }, SQU = { id: 's-qual', name: 'Qualifying 5 min', sessionType: 'qualifying', track: 't1', duration: 5, layout: 'L1' };
const SRA = { id: 's-race', name: 'Club Night heat', sessionType: 'race', track: 't1', laps: 2, layout: 'L1', lightsMin: 0, lightsMax: 0, endRule: 'all', pitHold: 0.1 }, STO = { id: 's-tok', name: 'Pay and race', sessionType: 'tokens', track: 't1' };
store.racesetups = [SPR, SQU, SRA, STO];
// a store that remembers what is added, changed and deleted (the stand-in of the other tests only notes it down)
const nid = (() => { let n = 0; return e => e + '-' + (++n); })();
const real = { add: async (e, rec) => { const row = { ...JSON.parse(JSON.stringify(rec)), id: nid(e) }; (store[e] = store[e] || []).push(row); added.push([e, rec]); return row; },
  update: async (e, id, rec) => { const row = store[e].find(r => r.id === id); Object.assign(row, JSON.parse(JSON.stringify(rec)), { id }); updated.push([e, id, rec]); return row; },
  remove: async (e, id) => { store[e] = store[e].filter(r => r.id !== id); removed.push([e, id]); } };
for (const k of Object.keys(real)) api[k] = (...x) => { x.forEach(v => structuredClone(v)); return real[k](...x); };
api.saveResume = async s => { resumes.push(JSON.parse(JSON.stringify(s))); }; api.clearResume = async () => {}; api.getResume = async () => (ctx.__resume ? JSON.parse(JSON.stringify(ctx.__resume)) : null);
const mgr = () => E('setupmgr'), view = () => E('view');
const btn = d => ({ target: { id: d.id || '', dataset: d, closest: sel => (sel === 'button' ? { id: d.id || '', dataset: d } : null) } });
const click = d => mgr().onclick(btn(d)), change = (d, value, id = '') => mgr().onchange({ target: { dataset: d, value, id } });
const homeClick = d => view().onclick(btn(d)), homeChange = (id, value, d = {}) => view().onchange({ target: { id, value, dataset: d } });
const home = async () => { run("state.tab = 'home'"); await run('render()'); await wait(150); return view().innerHTML; };
const champPanelsFor = (...x) => run('champPanelsFor')(...x);
const setup = async () => { run("state.tab = 'setup'; state.setupSub = 'championships'"); await run('render()'); await wait(80); };


(async () => {
  await wait(50); run('state.autoFinalize = true');
  const CHX = over => C.clean({ id: 'ch1', name: 'Club Cup 2026', rounds: [
    { id: 'r1', name: 'Opener', track: 't4', date: 'Sat 3 Oct', sessions: [{ id: 'a1', setup: 's-prac' }, { id: 'a2', setup: 's-qual' }, { id: 'a3', setup: 's-race' }] },
    { id: 'r2', name: 'Final', track: '', date: 'Sat 10 Oct', sessions: [{ id: 'b1', setup: 's-prac' }, { id: 'b2', setup: 's-race' }] }],
    roster: [{ driver: 'd1', team: 'tm1' }, { driver: 'd2', team: 'tm1' }, { driver: 'd3', team: 'tm2' }, { driver: 'd4', team: 'tm2' }], ...(over || {}) }, true);
  const put = over => { store.championships = [JSON.parse(JSON.stringify(CHX(over)))]; };
  const rw = (pos, d, name, best, ex) => ({ pos, driverId: d, carId: 'c' + d.slice(1), driverName: name, carName: 'Car', laps: 2, best, total: 11000, ...(ex || {}) });
  const NAMES = { d1: 'Alex', d2: 'Sam', d3: 'Kim', d4: 'Lee' };
  const field = (...ids) => ids.map((d, i) => rw(i + 1, d, NAMES[d], 5000 + 100 * i));
  const sess = (id, date, ri, si, rows, o) => { o = o || {}; const base = CHX(o.champ);
    return { id, date, setupName: 'x', sessionType: o.type || 'race', trackId: 't4', trackName: 'Big track', endedBy: 'laps', standings: rows, champ: { ...C.tagOf(base, ri, si, { setups: store.racesetups }), ...(o.awarded ? { awarded: '2026-10-03T21:00:00.000Z' } : {}), ...(o.off ? { off: true } : {}) } }; };
  const R1 = awarded => sess('R1', '2026-10-03T12:00:00.000Z', 0, 2, field('d1', 'd2', 'd3', 'd4'), { awarded });
  const R2 = awarded => sess('R2', '2026-10-10T12:00:00.000Z', 1, 1, field('d1', 'd3', 'd2', 'd4'), { awarded });
  const tabClick = (el, id) => el.onclick({ target: { closest: () => ({ dataset: { id } }) } });
  const cp = (box, act, sid) => box.onclick({ target: { closest: () => ({ dataset: { cp: act, sid } }) } });

  // ---------- the Points section of the editor ----------
  put(); store.sessions = []; await setup(); await click({ edit: 'ch1' });
  { const h = mgr().innerHTML;
    say('the editor has a Points section between the rounds and the roster, with the ready-made tables (the 25-18-15 one is on), the places with their numbers, and the points for the rest', h.includes('id="ch-points"') && h.indexOf('id="ch-rounds"') < h.indexOf('id="ch-points"') && h.indexOf('id="ch-points"') < h.indexOf('id="ch-roster"')
      && h.includes('25-18-15-12-10-8-6-4-2-1') && h.includes('10-8-6-5-4-3-2-1') && h.includes('One point per car beaten') && h.includes('My own') && /class="btn on" data-preset="f1"/.test(h) && h.includes('data-pf="place:9"') && !h.includes('data-pf="place:10"') && /id="ch-pl-0"[^>]*value="25"/.test(h) && h.includes('Every finisher after 10th gets (points)'));
    say('...the bonuses, the dropped results, the teams, the ties, the sprint and the guest rule', h.includes('Fastest lap of the race (points)') && h.includes('Only when the driver finishes in the first (places)') && h.includes('Pole position, fastest in qualifying (points)') && h.includes('Starting the race (points for every driver)')
      && h.includes('The worst round results that do not count') && h.includes('Every round counts.') && h.includes('Team points in a race') && h.includes('A tie in the standings is decided by') && h.includes('A race at 50% (a sprint) gives half of the points, rounded') && /id="ch-guest" data-pf="rule:guestRule" checked/.test(h)
      && /<option value="best" selected>/.test(h) && /<option value="wins" selected>/.test(h) && /<option value="nearest" selected>/.test(h));
    say('...and what a race of teams gives the drivers (every driver who drove, no minimum share of the laps), with the sentence about the bonuses of a team (1.57.0)', h.includes('A race of teams (an Endurance Race, a heat race for teams) gives the drivers who drove for a team') && /<option value="every" selected>/.test(h) && h.includes('The points of the team: every driver who drove gets them')
      && h.includes('A share of the points, by the laps each one drove') && h.includes('Nothing: only the team gets points') && /id="ch-p-teamMin"[^>]*value="0"/.test(h) && !/id="ch-p-teamMin"[^>]*disabled/.test(h) && h.includes('at least this share of the laps of his team') && h.includes('A team that races as a team always gets the points of its place once, in the Teams standings.') && h.includes('Fastest lap: the team and the driver who set the lap. Pole: the team of the pole sitter')); }
  await click({ preset: 'ten' });
  say('a ready-made table puts its numbers in the places (here 8 places, 10 to 1)', run('chEd.draft.points.join()') === '10,8,6,5,4,3,2,1' && mgr().innerHTML.includes('data-pf="place:7"') && !mgr().innerHTML.includes('data-pf="place:8"') && mgr().innerHTML.includes('Every finisher after 8th gets') && /class="btn on" data-preset="ten"/.test(mgr().innerHTML));
  await click({ preset: 'beaten' });
  say('"One point per car beaten" takes the places away and says how it counts', run('chEd.draft.pointsMode') === 'beaten' && !mgr().innerHTML.includes('data-pf="place:0"') && mgr().innerHTML.includes('one point for every car that finished behind him') && /class="btn on" data-preset="beaten"/.test(mgr().innerHTML));
  await click({ preset: 'f1' });
  say('...the 25-18-15 table brings the places back', run('chEd.draft.pointsMode') === 'table' && run('chEd.draft.points.length') === 10 && run('chEd.draft.points[0]') === 25);
  await change({ pf: 'place:0' }, '30');
  say('a place gets another number as soon as it is typed; the table is then "My own"', run('chEd.draft.points[0]') === 30 && run('Champ.presetOf(chEd.draft)') === 'own');
  { const t = { dataset: { pf: 'place:1' }, value: 'abc', id: '' }; mgr().onchange({ target: t });
    say('...a text that is not a number is refused, and the place keeps its number (the box shows it again)', E('ch-msg').textContent === 'Please type a number of points.' && run('chEd.draft.points[1]') === 18 && t.value === 18); }
  { const t = { dataset: { pf: 'place:2' }, value: '17.556', id: '' }; mgr().onchange({ target: t });
    say('...a number with many decimals is kept with two (and the box shows what was kept)', run('chEd.draft.points[2]') === 17.56 && t.value === 17.56); }
  await click({ padd: '1' }); await click({ padd: '1' });
  say('"Add a place" adds a place of 0 points (up to 20); "Remove the last place" takes it off (down to 1)', run('chEd.draft.points.length') === 12 && run('chEd.draft.points[11]') === 0 && /Every finisher after 12th gets/.test(mgr().innerHTML) && (await click({ prem: '1' }), run('chEd.draft.points.length') === 11));
  await change({ pf: 'rule:pointsRest' }, '1');
  for (const [k, v] of [['bonusFast', '1'], ['bonusFastTop', '3'], ['bonusPole', '2'], ['bonusStart', '0.5']]) await change({ pf: 'rule:' + k }, v);
  say('the bonuses and the points for the rest are kept as typed (fastest lap 1 in the first 3 places, pole 2, start 0.5)', run('chEd.draft.pointsRest') === 1 && run('chEd.draft.bonusFast') === 1 && run('chEd.draft.bonusFastTop') === 3 && run('chEd.draft.bonusPole') === 2 && run('chEd.draft.bonusStart') === 0.5);
  await change({ pf: 'rule:drops' }, '1');
  say('dropped results: the note says how many rounds count ("Best 1 of 2 rounds count."), and it follows a change to the sessions', run('chEd.draft.drops') === 1 && E('ch-dropsaid').textContent === 'Best 1 of 2 rounds count.');
  await change({ pf: 'rule:drops' }, '0');
  say('...with no dropped results every round counts', E('ch-dropsaid').textContent === 'Every round counts.');
  await change({ pf: 'rule:teamMode' }, 'all');
  say('team points: all the drivers of the team count (the box for how many is off)', run('chEd.draft.teamMode') === 'all' && E('ch-p-teamBest').disabled === true);
  await change({ pf: 'rule:teamMode' }, 'best'); await change({ pf: 'rule:teamBest' }, '1'); await change({ pf: 'rule:tie' }, 'last'); await change({ pf: 'rule:sprintRound' }, 'down');
  say('...the best 1 driver of a team, the tie by the last round and a sprint rounded down are kept (and the box for how many is on again)', run('chEd.draft.teamMode') === 'best' && run('chEd.draft.teamBest') === 1 && run('chEd.draft.tie') === 'last' && run('chEd.draft.sprintRound') === 'down' && E('ch-p-teamBest').disabled === false);
  await change({ pf: 'rule:teamRace' }, 'team');
  say('a race of teams that gives the drivers nothing: the box for the minimum share of the laps is off', run('chEd.draft.teamRace') === 'team' && E('ch-p-teamMin').disabled === true);
  await change({ pf: 'rule:teamRace' }, 'split'); await change({ pf: 'rule:teamMin' }, '30');
  say('...the drivers share by their laps with a minimum of 30% (and the box is on again)', run('chEd.draft.teamRace') === 'split' && run('chEd.draft.teamMin') === 30 && E('ch-p-teamMin').disabled === false);
  await change({ pf: 'rule:teamRace' }, 'zzz'); await change({ pf: 'rule:teamMin' }, 'x');
  say('...a kind that is not one, or a minimum that is not a number, is refused', run('chEd.draft.teamRace') === 'split' && run('chEd.draft.teamMin') === 30 && E('ch-msg').textContent === 'Please type a number.');
  await change({ pf: 'rule:teamMin' }, '250');
  say('...a minimum above 100 is kept at 100', run('chEd.draft.teamMin') === 100); await change({ pf: 'rule:teamMin' }, '30');
  await change({ pf: 'rule:teamMode' }, 'zzz'); await change({ pf: 'rule:bonusFast' }, 'x');
  say('a rule that is not one of the choices, or a number that is not a number, is refused and changes nothing', run('chEd.draft.teamMode') === 'best' && run('chEd.draft.bonusFast') === 1 && E('ch-msg').textContent === 'Please type a number.');
  mgr().onchange({ target: { dataset: { pf: 'rule:guestRule' }, type: 'checkbox', checked: false, id: 'ch-guest' } });
  say('the guest rule is switched off with its check box', run('chEd.draft.guestRule') === false);
  E('ch-undo').onclick(); await wait(10);
  say('Undo takes the last change back (the guest rule is on again)', run('chEd.draft.guestRule') === true);
  updated.length = 0; await E('ch-save').onclick();
  { const rec = (updated[0] || [])[2] || {};
    say('Save writes the points with the championship (the table, the bonuses, the drops, the teams, what a race of teams gives, the tie, the sprint)', updated.length === 1 && rec.points.length === 11 && rec.points[0] === 30 && rec.pointsRest === 1 && rec.bonusFast === 1 && rec.bonusFastTop === 3 && rec.bonusPole === 2 && rec.bonusStart === 0.5 && rec.drops === 0 && rec.teamBest === 1 && rec.tie === 'last' && rec.sprintRound === 'down' && rec.guestRule === true && rec.pointsMode === 'table' && rec.teamRace === 'split' && rec.teamMin === 30); }
  await E('ch-back').onclick(); await wait(50);
  put({ teamRace: 'team' }); await setup(); await click({ edit: 'ch1' });
  say('an editor that opens on a championship where only the team gets the points of a race of teams: that is the choice, and the minimum share of the laps is off from the start', /<option value="team" selected>/.test(mgr().innerHTML) && /id="ch-p-teamMin"[^>]*disabled/.test(mgr().innerHTML));
  put(); await E('ch-back').onclick(); await wait(50);

  // ---------- the panel after a race ----------
  put(); const box = { dataset: { cpbox: 'R1' }, innerHTML: '', hidden: true };
  store.sessions = [R1(false)]; await champPanelsFor([box]);
  { const h = box.innerHTML;
    say('a race of a championship that is not awarded: the panel has the title, "Not awarded yet", the drivers with their places and points, and the buttons', h.includes('Championship points: Club Cup 2026, Round 1') && h.includes('Not awarded yet') && h.includes('Award these points') && h.includes('Do not count this race') && box.hidden === false
      && ['Alex', 'Sam', 'Kim', 'Lee'].every((n, i) => h.indexOf(n) > 0 && (i === 0 || h.indexOf(n) > h.indexOf(['Alex', 'Sam', 'Kim', 'Lee'][i - 1]))) && h.includes('<th class="r">This round</th>') && h.includes('<th class="r">Total now</th>') && h.includes('<th class="r">Change</th>'));
    say('...25, 18, 15 and 12 points for the four places, and the same as the total now (nothing is awarded before)', /<b>Alex<\/b><\/td>\s*<td class="r">25<\/td>/.test(h) && /<b>Lee<\/b><\/td>\s*<td class="r">12<\/td>/.test(h) && h.includes('+25') && h.includes('You can still change penalties in the lap review first'));
    say('...no columns for bonuses that the championship does not have', !h.includes('Fastest lap</th>') && !h.includes('Pole</th>') && !h.includes('Start</th>')); }
  { const z = { dataset: { cpbox: 'Z1' }, innerHTML: '', hidden: true }, keep = store.sessions;
    store.sessions = [sess('Z1', '2026-10-03T12:00:00.000Z', 0, 2, [rw(1, 'd1', 'Alex', 5000), rw(2, 'd2', 'Sam', 5100), rw(3, 'd3', 'Kim', 5200), rw(4, 'd4', 'Lee', 9000, { retired: true })], {})];
    await champPanelsFor([z]); const zc = z.innerHTML.replace(/>\s+</g, '><');
    say('a driver who is out has "Out" for a place and 0 points, and his change is 0 in grey (the others are green)', /<tr class="chout"><td>Out<\/td><td><b>Lee<\/b><\/td><td class="r">0<\/td>.*?<td class="r muted">0<\/td><\/tr>/.test(zc) && /<td class="r pos">\+25<\/td>/.test(zc));
    store.sessions = keep; }
  updated.length = 0; await cp(box, 'award', 'R1'); await wait(30);
  { const aw = store.sessions[0].champ;
    say('Award these points marks the race as awarded (the tag of the saved race carries the time) and the panel changes', updated.length === 1 && updated[0][0] === 'sessions' && updated[0][1] === 'R1' && typeof aw.awarded === 'string' && aw.awarded.length > 10 && aw.id === 'ch1' && aw.roundId === 'r1' && !('off' in aw));
    const h = box.innerHTML;
    say('...it says "Points awarded", how much of the championship is driven, who leads, and has Open standings and Undo', h.includes('Points awarded') && h.includes('Club Cup 2026 now has 1 of 2 rounds driven. Alex leads by 7.') && h.includes('Open standings') && h.includes('>Undo<') && !h.includes('Award these points')); }
  { await cp(box, 'open', 'R1'); await wait(150);
    say('Open standings goes to Results and Records, Championships, at this championship (Drivers)', run('state.resultsSub') === 'champs' && run('state.tab') === 'database' && run('state.sub') === 'results' && run('champView.id') === 'ch1' && run('champView.which') === 'drivers'); }
  await cp(box, 'undo', 'R1'); await wait(30);
  say('Undo takes the points out again (no time in the tag) and the panel offers to award them', !('awarded' in store.sessions[0].champ) && box.innerHTML.includes('Award these points') && box.innerHTML.includes('Not awarded yet'));
  { const asked = []; ctx.confirm = m => { asked.push(m); return false; };
    await cp(box, 'off', 'R1'); await wait(30);
    say('Do not count this race asks first; "Cancel" changes nothing', asked.length === 1 && asked[0].includes('stays in the results') && !('off' in store.sessions[0].champ)); ctx.confirm = () => true; }
  await cp(box, 'off', 'R1'); await wait(30);
  say('...after OK the tag says off, the panel says it is not counted and offers to count it again', store.sessions[0].champ.off === true && !('awarded' in store.sessions[0].champ) && box.innerHTML.includes('Not counted') && box.innerHTML.includes('Count it again'));
  { const prog = await (async () => { store.championships = [JSON.parse(JSON.stringify(CHX()))]; return run(`Champ.progress(Champ.clean(${JSON.stringify(store.championships[0])}, true), ${JSON.stringify(store.sessions)}).driven`); })();
    say('...a race that is not counted is not a driven session: the Home card offers the session again', prog === 0); }
  await cp(box, 'on', 'R1'); await wait(30);
  say('Count it again brings the race back, not awarded', !('off' in store.sessions[0].champ) && !('awarded' in store.sessions[0].champ) && box.innerHTML.includes('Award these points'));
  // a race that is driven again replaces the first one when it is awarded
  store.sessions = [{ ...R1(true), id: 'R1' }, { ...sess('R1b', '2026-10-04T12:00:00.000Z', 0, 2, field('d4', 'd3', 'd2', 'd1'), {}), id: 'R1b' }];
  { const box2 = { dataset: { cpbox: 'R1b' }, innerHTML: '', hidden: true }; await champPanelsFor([box2]);
    say('a second run of the same race that is not awarded yet: its panel shows the points it would give (Lee first)', /<b>Lee<\/b><\/td>\s*<td class="r">25<\/td>/.test(box2.innerHTML));
    await cp(box2, 'award', 'R1b'); await wait(30);
    say('Award for the second run takes the award away from the first one: a race counts once', typeof store.sessions[1].champ.awarded === 'string' && !('awarded' in store.sessions[0].champ));
    updated.length = 0; await cp(box2, 'undo', 'R1b'); await wait(30);
    say('...Undo of the second does not give the first one back (it must be awarded again on purpose)', updated.length === 1 && !('awarded' in store.sessions[0].champ) && !('awarded' in store.sessions[1].champ)); }
  // other kinds of session
  { const p = { dataset: { cpbox: 'P1' }, innerHTML: '', hidden: true }, q = { dataset: { cpbox: 'Q1' }, innerHTML: '', hidden: true };
    store.sessions = [sess('P1', '2026-10-03T10:00:00.000Z', 0, 0, field('d1'), { type: 'practice' }), sess('Q1', '2026-10-03T11:00:00.000Z', 0, 1, field('d3', 'd1'), { type: 'qualifying' })];
    await champPanelsFor([p, q]);
    say('a practice says there is nothing to award; a qualifying says it is the grid, and that this championship has no pole bonus', p.innerHTML.includes('Practice: nothing to award') && !p.innerHTML.includes('data-cp="award"') && q.innerHTML.includes('Qualifying: the grid for the race of this round.') && q.innerHTML.includes('no bonus for pole position'));
    put({ bonusPole: 2 }); await champPanelsFor([q]);
    say('...with a pole bonus the qualifying says who is on pole and what it is worth', q.innerHTML.includes('Pole position: Kim. 2 bonus points if he starts the race.')); }
  { const sp = { dataset: { cpbox: 'R2' }, innerHTML: '', hidden: true }; put({ rounds: CHX().rounds.map((r, i) => (i ? { ...r, sessions: r.sessions.map(s => (s.id === 'b2' ? { ...s, share: 50 } : s)) } : r)) });
    store.sessions = [sess('R2', '2026-10-10T12:00:00.000Z', 1, 1, field('d1', 'd3', 'd2', 'd4'), { champ: { rounds: JSON.parse(JSON.stringify(store.championships[0].rounds)) } })];
    await champPanelsFor([sp]);
    say('a sprint (a race at 50%) shows its points halved (25 becomes 13), and says how the points are rounded', sp.innerHTML.includes('Race points (at 50%)') && /<b>Alex<\/b><\/td>\s*<td class="r">13<\/td>/.test(sp.innerHTML) && sp.innerHTML.includes('This race counts at 50%') && sp.innerHTML.includes('rounded to the nearest point'));
    const no = { dataset: { cpbox: 'R2' }, innerHTML: '', hidden: true }; put({ rounds: CHX().rounds.map((r, i) => (i ? { ...r, sessions: r.sessions.map(s => (s.id === 'b2' ? { ...s, share: 0 } : s)) } : r)) }); await champPanelsFor([no]);
    say('a race that counts for nothing (0%) says so and has nothing to award', no.innerHTML.includes('counts for no points') && !no.innerHTML.includes('data-cp="award"')); }
  { put(); const gone = { dataset: { cpbox: 'X1' }, innerHTML: 'old', hidden: false };
    store.sessions = [{ ...R1(false), id: 'X1', champ: { ...R1(false).champ, roundId: 'nope' } }]; await champPanelsFor([gone]);
    say('a race whose round was taken out of the championship says so, with no buttons', gone.innerHTML.includes('not part of the championship any more') && !gone.innerHTML.includes('data-cp='));
    store.sessions = [{ ...R1(false), id: 'X2', champ: { ...R1(false).champ, id: 'deleted-championship' } }]; const none = { dataset: { cpbox: 'X2' }, innerHTML: 'old', hidden: false }; await champPanelsFor([none]);
    say('a race of a championship that was deleted has no panel at all (the box is empty and hidden)', none.innerHTML === '' && none.hidden === true); }
  { put({ bonusFast: 1, bonusStart: 1, bonusPole: 3, drops: 1 }); const bx = { dataset: { cpbox: 'R1' }, innerHTML: '', hidden: true };
    const qual = sess('Q1', '2026-10-03T11:00:00.000Z', 0, 1, [rw(1, 'd3', 'Kim', 4000), rw(2, 'd1', 'Alex', 4100)], { type: 'qualifying' });
    store.sessions = [qual, sess('R1', '2026-10-03T12:00:00.000Z', 0, 2, [rw(1, 'd1', 'Alex', 4300), rw(2, 'd2', 'Sam', 4200), rw(3, 'd3', 'Kim', 4500), rw(4, 'd4', 'Lee', 9000, { retired: true })], {})];
    await champPanelsFor([bx]); const h = bx.innerHTML;
    const c = h.replace(/>\s+</g, '><'), row = n => (c.match(new RegExp('<b>' + n + '</b></td>(.*?)</tr>')) || [])[1] || '';
    say('with bonuses the panel has their columns: the fastest lap, the pole and the start (a race of drivers: the first column is "Driver")', h.includes('<th>Driver</th>') && !h.includes('Driver or team') && h.includes('Fastest lap</th>') && h.includes('Pole</th>') && h.includes('Start</th>'));
    say('...Sam has the fastest lap (18 + 1 + 1 for the start = 20 this round, the lap time beside the bonus), Kim is on pole (15 + 3 + 1 = 19), Alex 25 + 1 = 26', row('Sam').includes('<b class="fl">+1</b><span class="muted">4.200</span>') && /<b>20<\/b>/.test(row('Sam')) && row('Kim').includes('<b class="fl">+3</b>') && /<b>19<\/b>/.test(row('Kim')) && /<b>26<\/b>/.test(row('Alex')));
    say('...Lee retired: no place ("Out"), no race points, only the point for starting', c.includes('<tr class="chout"><td>Out</td><td><b>Lee</b>') && /<td class="r">0<\/td>/.test(row('Lee')) && /<b>1<\/b>/.test(row('Lee')) && row('Lee').includes('+1'));
    say('...and the teams of this round, with the bonuses in them (Foxes 26 + 20, Arrows 19 + 1)', h.includes('Teams, this round: Foxes 46, Arrows 20.'));
    { const race1 = store.sessions[1], nq = { dataset: { cpbox: 'R1' }, innerHTML: '', hidden: true }; store.sessions = [race1]; await champPanelsFor([nq]);
      say('...with no qualifying driven in the round a note says that nobody gets the pole bonus', nq.innerHTML.includes('No qualifying session was driven in this round (or nobody set a lap), so nobody gets the pole bonus.'));
      const dq = { dataset: { cpbox: 'R1' }, innerHTML: '', hidden: true };
      store.sessions = [qual, sess('R1', '2026-10-03T12:00:00.000Z', 0, 2, [rw(1, 'd1', 'Alex', 4300), rw(2, 'd3', 'Kim', 4500, { dq: true })], {})]; await champPanelsFor([dq]);
      say('...when the pole sitter is disqualified the note names him and says why the bonus is not given', dq.innerHTML.includes('The pole bonus (Kim) is not given: he did not start the race, was disqualified, or is a guest.') && !/<b class="fl">\+3<\/b>/.test(dq.innerHTML)); } }

  // ---------- a race of teams (1.57.0) ----------
  { put({ bonusFast: 1, bonusStart: 1 }); const tb = { dataset: { cpbox: 'T1' }, innerHTML: '', hidden: true };
    const trow = (pos, tid, name, ds, ex) => ({ pos, driverId: '', carId: 'x', driverName: name, asTeam: true, teamId: tid, teamName: name, laps: ds.reduce((a, d) => a + d[1], 0), best: 4000 + pos, total: null, bestBy: ds[0][0], drivers: ds.map(([id, laps]) => ({ driverId: id, driverName: NAMES[id], laps })), ...(ex || {}) });
    const teamRace = o => sess('T1', '2026-10-03T12:00:00.000Z', 0, 2, [trow(1, 'tm1', 'Foxes', [['d1', 6], ['d2', 4]]), trow(2, 'tm2', 'Arrows', [['d3', 5], ['d4', 5]], { best: 3900, bestBy: 'd4' })], o || {});
    store.sessions = [teamRace()]; await champPanelsFor([tb]); const h = tb.innerHTML, c = h.replace(/>\s+</g, '><'), row = n => (c.match(new RegExp('<b>' + n + '</b>(?:<span class="muted">team</span>)?</td>(.*?)</tr>')) || [])[1] || '', mrow = n => (c.match(new RegExp('<span class="chmem">' + n + '</span>(.*?)</tr>')) || [])[1] || '';
    say('a race of teams has a panel (it said "driven by teams, no points" before 1.57.0): the teams in the table, the drivers who drove under their team', !h.includes('driven by teams') && h.includes('Not awarded yet') && c.includes('<th>Driver or team</th>') && c.includes('<tr class="chteam"><td>1</td><td><b>Foxes</b><span class="muted">team</span></td>') && (c.match(/<tr class="chmember">/g) || []).length === 4 && c.includes('<tr class="chmember"><td></td><td><span class="chmem">Alex</span>'));
    say('...the drivers show their laps: Alex 6 laps, Sam 4 laps, and the points of the team: Foxes 25 + 1 for starting = 26, and so does every driver who drove for it', mrow('Alex').includes('6 laps') && mrow('Sam').includes('4 laps') && /<b>26<\/b>/.test(row('Foxes')) && /<b>26<\/b>/.test(mrow('Alex')) && /<b>26<\/b>/.test(mrow('Sam')));
    say('...the fastest lap is the one of Arrows, set by Lee: the bonus is in the row of the team and in the row of Lee, not in the row of Kim (Arrows 18 + 1 + 1 = 20, Kim 19, Lee 20)', row('Arrows').includes('<b class="fl">+1</b>') && mrow('Lee').includes('<b class="fl">+1</b>') && !mrow('Kim').includes('class="fl"') && /<b>20<\/b>/.test(row('Arrows')) && /<b>19<\/b>/.test(mrow('Kim')) && /<b>20<\/b>/.test(mrow('Lee')));
    say('...the notes: what a race of teams gives, and the teams of this round', h.includes('A race of teams gives the team the points of its place (in the Teams standings, once) and every driver who drove for it the same points') && h.includes('Teams, this round: Foxes 26, Arrows 20.') && h.includes('Award these points'));
    await cp(tb, 'award', 'T1'); await wait(40);
    say('Award these points awards the race of teams like any race (the tag of the session says when), and the panel says so', !!store.sessions[0].champ.awarded && tb.innerHTML.includes('Points awarded') && tb.innerHTML.includes('Undo'));
    await cp(tb, 'undo', 'T1'); await wait(40);
    say('...Undo takes it out again', !store.sessions[0].champ.awarded && tb.innerHTML.includes('Award these points'));
    put({ teamMode: 'none', teamRace: 'team' }); store.sessions = [teamRace()]; const tn = { dataset: { cpbox: 'T1' }, innerHTML: '', hidden: true }; await champPanelsFor([tn]);
    { const cn = tn.innerHTML.replace(/>\s+</g, '><');
      say('with no team standings, and drivers who get nothing from a race of teams: the team has its points and no total, the drivers are named without points, and the notes say so', cn.includes('This championship has no team standings') && cn.includes('The drivers get no points from it') && (cn.match(/<tr class="chmember">/g) || []).length === 4 && !/<tr class="chteam">.*?<b>25<\/b><\/td><td class="r"><b>25<\/b>/.test(cn)
        && /<span class="chmem">Alex<\/span>.*?<\/tr>/.exec(cn)[0].includes('<td class="r"><span class="muted">–</span></td>') && (/<span class="chmem">Alex<\/span>.*?<\/tr>/.exec(cn)[0].match(/<b>–<\/b>/g) || []).length === 2 && !/<span class="chmem">Alex<\/span>.*?<\/tr>/.exec(cn)[0].includes('+')); }
    put({ drops: 0 }); store.sessions = [teamRace({ awarded: true })]; run('champView.id = "ch1"; champView.which = "teams"'); run("state.tab = 'database'; state.sub = 'results'; state.resultsSub = 'champs'"); await run('render()'); await wait(120);
    { const t = E('resbody').innerHTML;
      say('the Teams standings have the team that raced as a team (Foxes 25 once, not 50), and say what a race of teams gives', t.indexOf('Foxes') < t.indexOf('Arrows') && /<b class="big">25<\/b>/.test(t) && /<b class="big">18<\/b>/.test(t) && !/<b class="big">50<\/b>/.test(t) && t.includes('A race of teams gives the team the points of its place')); }
    run('champView.which = "drivers"'); await run('render()'); await wait(100);
    { const t = E('resbody').innerHTML;
      say('...the Drivers standings have both drivers of the team (Alex and Sam 25, Kim and Lee 18) with the same note', t.indexOf('Alex') < t.indexOf('Kim') && (t.match(/<b class="big">25<\/b>/g) || []).length === 2 && (t.match(/<b class="big">18<\/b>/g) || []).length === 2 && t.includes('A race of teams gives the team the points of its place')); }
    run('champView.which = "rounds"'); await run('render()'); await wait(100);
    say('...and the winner of the round is the team', E('resbody').innerHTML.includes('<b>Foxes</b>'));
    store.sessions = [teamRace()]; run('champView.which = "drivers"'); await run('render()'); await wait(100);
    say('a race of teams that is saved and not awarded is waiting, like any race (the page says so)', E('resbody').innerHTML.includes('1 race of this championship is saved but not awarded yet')); }
  { const trow = (pos, tid, name, ds, ex) => ({ pos, driverId: '', carId: 'x', driverName: name, asTeam: true, teamId: tid, teamName: name, laps: ds.reduce((a, d) => a + d[1], 0), best: 4000 + pos, total: null, bestBy: ds[0][0], drivers: ds.map(([id, laps]) => ({ driverId: id, driverName: NAMES[id], laps })), ...(ex || {}) });
    const rows2 = [trow(1, 'tm1', 'Foxes', [['d1', 6], ['d2', 4]]), trow(2, 'tm2', 'Arrows', [['d3', 5], ['d4', 5]], { best: 3900, bestBy: 'd4' })];
    put({ bonusFast: 1, bonusFastTop: 1 }); store.sessions = [sess('T2', '2026-10-03T12:00:00.000Z', 0, 2, rows2, {})]; const nb = { dataset: { cpbox: 'T2' }, innerHTML: '', hidden: true }; await champPanelsFor([nb]);
    { const c = nb.innerHTML.replace(/>\s+</g, '><'), arrows = (c.match(/<b>Arrows<\/b>(?:<span class="muted">team<\/span>)?<\/td>(.*?)<\/tr>/) || [])[1] || '';
      say('a fastest lap of a team outside the places that get the bonus: the lap time is shown in the row of the team (grey), nobody gets the bonus, and a note names the driver and his team', arrows.includes('<span class="muted">3.900</span>') && !c.includes('class="fl"') && c.includes('The fastest lap (Lee of Arrows) gives no bonus')); }
    put({ teamMin: 50 }); store.sessions = [sess('T3', '2026-10-03T12:00:00.000Z', 0, 2, [trow(1, 'tm1', 'Foxes', [['d1', 6], ['d2', 4]])], {})]; const sb = { dataset: { cpbox: 'T3' }, innerHTML: '', hidden: true }; await champPanelsFor([sb]);
    { const c = sb.innerHTML.replace(/>\s+</g, '><'), sam = (c.match(/<span class="chmem">Sam<\/span>(.*?)<\/tr>/) || [])[1] || '', alex = (c.match(/<span class="chmem">Alex<\/span>(.*?)<\/tr>/) || [])[1] || '';
      say('a driver who drove less than the minimum share of the laps: "too few" beside his laps, 0 points and no total; the driver who drove enough has his', sam.includes('4 laps, too few') && /<td class="r">0<\/td>/.test(sam) && !/<b>25<\/b>/.test(sam) && sam.includes('<b>–</b>') && /<b>25<\/b>/.test(alex) && c.includes('Sam drove less than 50% of the laps of the team and get no points.')); }
    put({ bonusPole: 3 }); { const qs = sess('Q9', '2026-10-03T11:00:00.000Z', 0, 1, [rw(1, 'd1', 'Alex', 4000), rw(2, 'd3', 'Kim', 4100)], { type: 'qualifying' });
      store.sessions = [qs, sess('T4', '2026-10-03T12:00:00.000Z', 0, 2, [trow(1, 'tm1', 'Foxes', [['d1', 6], ['d2', 4]], { dq: true }), trow(2, 'tm2', 'Arrows', [['d3', 5], ['d4', 5]])], {})]; const pb = { dataset: { cpbox: 'T4' }, innerHTML: '', hidden: true }; await champPanelsFor([pb]);
      const c = pb.innerHTML.replace(/>\s+</g, '><');
      say('the pole sitter\'s team was disqualified: the note names him and his team and says why nobody gets the pole bonus', c.includes('The pole bonus (Alex of Foxes) is not given: the team was disqualified or is a guest.') && !c.includes('class="fl">+3<') && c.includes('<td>DQ</td>')); }
    const css = fs.readFileSync(R + 'renderer/styles.css', 'utf8');
    say('1.57.0: the drivers under a team are indented and smaller, a team has a line above it, a guest driver is grey', /\.chpt tr\.chteam td\{border-top:1px solid var\(--line\)\}/.test(css) && /\.chpt tr\.chmember td\{font-size:\.92em/.test(css) && /\.chpt tr\.chmember \.chmem\{display:inline-block;padding-left:1\.2em;color:var\(--ink\)\}/.test(css) && /\.chpt tr\.chmember\.chguest \.chmem\{color:var\(--muted\)\}/.test(css)); }

  // ---------- Results and Records: Championships ----------
  { put(); store.sessions = [R1(true), R2(true)];
    run("state.tab = 'database'; state.sub = 'results'; state.resultsSub = 'champs'"); await run('render()'); await wait(150);
    const tabs = E('respool').innerHTML, h = E('resbody').innerHTML;
    say('Results and Records has a Championships tab next to Racing Records and Token Records, and it is the open one', tabs.includes('Racing Records') && tabs.includes('Token Records') && /aria-selected="true" data-id="champs">Championships/.test(tabs));
    say('the page has the choice of the championship, Drivers / Teams / Rounds, and Export to PDF', h.includes('id="chs-pick"') && h.includes('Club Cup 2026') && h.includes('id="chs-pdf"') && h.includes('Export to PDF') && E('chs-which').innerHTML.includes('Drivers') && E('chs-which').innerHTML.includes('Teams') && E('chs-which').innerHTML.includes('Rounds'));
    say('the drivers: after round 2 of 2, in order of points (Alex 50, Sam 33, Kim 33, Lee 24), with the rounds and the points behind', h.includes('Drivers: after round 2 of 2') && h.indexOf('Alex') < h.indexOf('Sam') && h.indexOf('Sam') < h.indexOf('Kim') && h.indexOf('Kim') < h.indexOf('Lee') && /<b class="big">50<\/b>/.test(h) && /<b class="big">24<\/b>/.test(h) && h.includes('>R1<') && h.includes('>R2<') && h.includes('−17') && h.includes('Foxes'));
    say('...who leads and what is left: "Alex leads by 17." and "Alex is the champion."', h.includes('Alex leads by 17.') && h.includes('Alex is the champion.'));
    await tabClick(E('chs-which'), 'teams'); await wait(80);
    { const t = E('resbody').innerHTML;
      say('Teams: the best 2 drivers of a team count in a race; Foxes 83, Arrows 57, with the drivers of the team', t.includes('Teams: the 2 best drivers of a team count in a race') && t.indexOf('Foxes') < t.indexOf('Arrows') && /<b class="big">83<\/b>/.test(t) && /<b class="big">57<\/b>/.test(t) && t.includes('Alex, Sam') && t.includes('Kim, Lee')); }
    await tabClick(E('chs-which'), 'rounds'); await wait(80);
    { const t = E('resbody').innerHTML;
      say('Rounds: the winner of each race (Alex in both)', t.includes('Winner of each race') && (t.match(/class="chrc"/g) || []).length === 2 && t.includes('Round 1 · Opener') && t.includes('Round 2 · Final') && (t.match(/<b>Alex<\/b>/g) || []).length === 2); }
    await tabClick(E('chs-which'), 'drivers'); await wait(80);
    await E('chs-pdf').onclick(); await wait(30);
    { const [html, name] = pdfs[pdfs.length - 1] || [];
      say('Export to PDF makes a page with the name of the championship, the table and the legend, and asks for a file name', pdfs.length === 1 && name === 'Club Cup 2026 drivers standings.pdf' && html.includes('<h1>Club Cup 2026</h1>') && html.includes('Drivers: after round 2 of 2') && html.includes('Alex') && html.includes('Alex leads by 17') && html.includes('A4 landscape') && E('chs-msg').textContent === 'Saved to /docs/Club Cup 2026 drivers standings.pdf'); } }
  { // the same page when one race is not awarded yet, with a second championship
    put(); store.championships.push({ ...JSON.parse(JSON.stringify(store.championships[0])), id: 'ch2', name: 'Winter Series' });
    store.sessions = [R1(true), R2(false)]; run("state.settings.champId = null"); run('champView.id = "ch1"; champView.which = "drivers"'); await run('render()'); await wait(150);
    const h = E('resbody').innerHTML;
    say('a race that is saved but not awarded is not in the standings, and the page says so', h.includes('Drivers: after round 1 of 2') && h.includes('1 race of this championship is saved but not awarded yet') && h.includes('Alex leads by 7.') && h.includes('One round is left: it gives up to 25 points a driver, so Sam, Kim and Lee can still pass Alex.'));
    say('...a round that is not driven is a dash, and the other championship is in the choice', h.includes('>–<') && /<option value="ch2">Winter Series/.test(h));
    await E('chs-pick').onchange({ target: { value: 'ch2' } }); await wait(80);
    say('choosing another championship shows that one (no race awarded: everybody at 0, and it says so)', run('champView.id') === 'ch2' && E('resbody').innerHTML.includes('no race is awarded yet') && !E('resbody').innerHTML.includes('leads by')); }
  { store.championships = []; run("state.resultsSub = 'champs'"); await run('render()'); await wait(100);
    say('with no championship the page says how to make one', E('resbody').innerHTML.includes('No championships yet.') && E('resbody').innerHTML.includes('Race Setup > Championships')); put(); }
  { store.championships = [JSON.parse(JSON.stringify(CHX({ teamMode: 'none' })))]; store.sessions = [R1(true)]; run('champView.id = "ch1"; champView.which = "teams"'); await run('render()'); await wait(100);
    say('a championship without team standings has no Teams tab (and a choice of Teams that was left over shows the drivers)', !E('chs-which').innerHTML.includes('Teams') && E('resbody').innerHTML.includes('Drivers: after round 1 of 2')); put(); }

  // ---------- Results and Records: the races ----------
  { put(); store.sessions = [R1(true), R2(false), { ...sess('N1', '2026-10-01T12:00:00.000Z', 0, 2, field('d1'), {}), champ: undefined }]; delete store.sessions[2].champ; store.laps = [];
    run("state.tab = 'database'; state.sub = 'results'; state.resultsSub = 'racing'"); await run('render()'); await wait(150);
    const h = E('resbody').innerHTML;
    say('the card of a race of a championship has a place for its panel, and its line says what became of the points: "points awarded" or "not awarded yet"; a normal race has neither', (h.match(/data-cpbox=/g) || []).length === 2 && h.includes('data-cpbox="R1"') && h.includes('data-cpbox="R2"') && h.includes('class="chaward done">points awarded') && h.includes('class="chaward">not awarded yet') && !h.includes('data-cpbox="N1"'));
    store.sessions = [{ ...R1(true), champ: { ...R1(true).champ, off: true } }]; await run('render()'); await wait(100);
    say('...a race that is not counted says "not counted"', E('resbody').innerHTML.includes('class="chaward">not counted')); }
  say('the words for the line: nothing for a practice, a qualifying or a race that counts for nothing', C.awardText({ kind: 'practice' }) === '' && C.awardText({ kind: 'qualifying' }) === '' && C.awardText({ kind: 'race', share: 0 }) === '' && C.awardText({ kind: 'race', share: 100 }) === 'not awarded yet' && C.awardText({ kind: 'race', share: 50, awarded: 'x' }) === 'points awarded' && C.awardText({ kind: 'race', awarded: 'x', off: true }) === 'not counted' && C.awardText(null) === '');

  // ---------- Home ----------
  put(); store.sessions = [R1(true)]; run("state.settings = { theme: 'dark', lastSetupId: 's-race' }");
  { const h = await home();
    say('Home: nothing of the standings is shown until the championship is chosen in Start a race', !h.includes('id="chstand"') && !h.includes('chlead') && h.includes('id="champsel"')); }
  await homeChange('champsel', 'ch1'); await wait(150);
  { const h = view().innerHTML;
    say('Home: the card of the championship says who leads ("Alex leads by 7") next to how much is driven', h.includes('class="chtag chlead">Alex leads by 7<') && h.includes('chtags'));
    say('...and shows the top of the standings: Standings after round 1, the first five with their points, Drivers and Teams, what is left, and All standings', h.includes('id="chstand"') && h.includes('Standings after round 1') && h.includes('data-chst="drivers"') && h.includes('data-chst="teams"') && /<b>Alex<\/b><\/td><td class="r"><b>25<\/b>/.test(h) && h.includes('One round is left: it gives up to 25 points a driver, so Sam, Kim and Lee can still pass Alex.') && h.includes('data-chall="ch1"')); }
  await homeClick({ chst: 'teams' }); await wait(150);
  say('the Teams button shows the teams (Foxes 43, Arrows 27)', view().innerHTML.includes('<b>Foxes</b>') && view().innerHTML.includes('<b>43</b>') && view().innerHTML.includes('<b>Arrows</b>') && run('state.champHomeWhich') === 'teams');
  await homeClick({ chall: 'ch1' }); await wait(100);
  say('All standings opens Results and Records at the Championships tab, at this championship and at Teams', run('state.resultsSub') === 'champs' && run('state.tab') === 'database' && run('state.sub') === 'results' && run('champView.id') === 'ch1' && run('champView.which') === 'teams');
  { store.sessions = []; run("state.tab = 'home'; state.champHomeWhich = 'drivers'"); const h = await home();
    say('while no race is awarded there is no standings block and no leader on the card', !h.includes('id="chstand"') && !h.includes('chlead')); }
  { run("state.champHomeWhich = 'teams'"); put({ teamMode: 'none' }); store.sessions = [R1(true)]; const h = await home();
    say('a championship without team standings has no Drivers/Teams buttons on Home, and a choice of Teams that was left over shows the drivers', h.includes('id="chstand"') && !h.includes('data-chst=') && /<tr><td class="muted">1<\/td><td><b>Alex<\/b>/.test(h)); run("state.champHomeWhich = 'drivers'"); put(); }
  { const more = [5, 6, 7]; store.drivers.push(...more.map(n => ({ id: 'd' + n, name: 'Pat' + n }))); const ids = [1, 2, 3, 4, 5, 6, 7], nm = n => (n < 5 ? NAMES['d' + n] : 'Pat' + n);
    put({ roster: ids.map(n => ({ driver: 'd' + n, team: n < 5 ? 'tm1' : 'tm2' })) }); store.sessions = [sess('H1', '2026-10-03T12:00:00.000Z', 0, 2, ids.map(n => rw(n, 'd' + n, nm(n), 5000 + 100 * n)), { awarded: true })];
    const all = await home(), h = all.slice(all.indexOf('id="chstand"'), all.indexOf('class="hs-sub"'));
    say('the top of the standings on Home has five drivers (of seven), the first five in order', (h.match(/<tr><td class="muted">\d+<\/td>/g) || []).length === 5 && h.includes('Pat5') && !h.includes('Pat6') && h.indexOf('Alex') < h.indexOf('Sam') && h.indexOf('Lee') < h.indexOf('Pat5'));
    store.drivers.length = 4; put(); }

  // ---------- a race that counts, on the race screen ----------
  run("state.settings = { theme: 'dark', lastSetupId: 's-race', champId: 'ch1', assignments: { 's-race': [1, 2, 3, 4].map(i => ({ driverId: 'd' + i, carId: 'c' + i })) } }"); store.sessions = []; saved.length = 0; await home();
  await homeClick({ id: 'champload', load: '0:0' }); await wait(120);
  await homeChange('champpick', '0:2'); await wait(150);
  run('state.speed = 40'); await homeClick({ id: 'start' }); await wait(150);
  await run('render()'); await wait(150);
  say('the race screen has a place for the points, which is hidden while the race goes on', /id="champpanel" class="card chpanelbox" hidden>/.test(E('racehost').innerHTML) && !E('champpanel').dataset.cpbox);
  key(' '); await until(() => phase() === 'running', 5000); await wait(60);
  for (let n = 0; n < 3; n++) for (const k of ['1', '2', '3', '4']) { key(k); await wait(60); }
  await until(() => phase() !== 'running', 6000); await until(() => saved.length > 0, 6000); await wait(250);
  { const el = E('champpanel'), h = el.innerHTML;
    say('when the race is saved, the panel shows the points of this race: the title, "Not awarded yet", the four drivers and the buttons', saved.length === 1 && el.dataset.cpbox === store.sessions[0].id && el.hidden === false && h.includes('Championship points: Club Cup 2026, Round 1') && h.includes('Not awarded yet') && h.includes('Award these points') && h.includes('Do not count this race') && ['Alex', 'Sam', 'Kim', 'Lee'].every(n => h.includes(n)));
    say('...the places follow the result of the race and the points follow the places (the four of them add up to 25 + 18 + 15 + 12 = 70)', (h.match(/<td class="r">(25|18|15|12)<\/td>/g) || []).length === 4);
    await cp(el, 'award', store.sessions[0].id); await wait(40);
    say('Award these points on the race screen marks the saved race, and the panel says so', typeof store.sessions[0].champ.awarded === 'string' && E('champpanel').innerHTML.includes('Points awarded') && E('champpanel').innerHTML.includes('1 of 2 rounds driven')); }
  { saved.length = 0; E('champpanel').dataset.cpbox = ''; E('champpanel').innerHTML = ''; run("state.settings.champTag = null; state.race = null");
    await openRace({ ...SRA }, store.tracks[0], rows(1, 2)); key(' '); await until(() => phase() === 'running', 5000); await wait(60);
    for (let n = 0; n < 3; n++) { key('1'); await wait(80); key('2'); await wait(80); }
    await until(() => saved.length > 0, 8000); await wait(200);
    say('a race that does not count for a championship has no panel', saved.length === 1 && !('champ' in saved[0][0]) && !E('champpanel').dataset.cpbox && E('champpanel').innerHTML === ''); }

  console.log(fails ? fails + ' CHAMPIONSHIP POINTS SCREEN TESTS FAILED' : 'ALL CHAMPIONSHIP POINTS SCREEN TESTS PASSED');
  process.exit(fails ? 1 : 0);
})();
