const vm = require('vm'), fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..') + '/';
const schema = require(R + 'schema.js');
let fails = 0, reachedEnd = false;
process.on('exit', code => { if (code === 0 && !reachedEnd) { console.log('FAIL the test stopped before its end (something waited for ever)'); process.exitCode = 1; } });
process.on('unhandledRejection', e => { console.log('UNHANDLED:', e.stack || e.message); process.exit(1); });
// (the stand-in does not read html: when the whole editor is drawn again, the parts inside it are given the html that the real page would have, as the real page does)
const parts = ['ro-pool', 'ro-hold', 'ro-grid', 'ro-remarks', 'ro-names', 'ro-groups', 'ro-how', 'ro-genopts', 'ro-msg'];
const syncParts = html => parts.forEach(id => {
  const open = html.indexOf(`id="${id}"`); if (open < 0) return;
  const start = html.indexOf('>', open) + 1, tag = /<(\w+)/.exec(html.slice(html.lastIndexOf('<', open)))[1], re = new RegExp(`<(/?)${tag}\\b`, 'g'); re.lastIndex = start;
  let depth = 1, m, end = html.length; while ((m = re.exec(html))) { depth += m[1] ? -1 : 1; if (depth === 0) { end = m.index; break; } }
  const el = els[id] || (els[id] = mk()); el.innerHTML = html.slice(start, end); if (id === 'ro-msg') el.textContent = '';
});
const mk = id => new Proxy({ innerHTML: '', style: {}, dataset: {}, hidden: false, value: '', checked: false, disabled: false, classList: { add() {}, remove() {}, toggle() {} } },
  { get: (t, k) => (k in t ? t[k] : () => mk()), set: (t, k, v) => { t[k] = v; if (id === 'setupmgr' && k === 'innerHTML') syncParts(String(v)); return true; } });
const els = {};
const keyListeners = new Set(); const document = { addEventListener(t, f) { if (t === 'keydown') keyListeners.add(f); }, removeEventListener(t, f) { if (t === 'keydown') keyListeners.delete(f); }, querySelector: () => mk(), querySelectorAll: () => [mk(), mk(), mk()],
  getElementById: id => els[id] || (els[id] = mk(id)), documentElement: { dataset: {}, style: { setProperty() {} } }, body: { contains: () => true }, createElement: () => mk() };
const store = {
  tracks: [{ id: 't1', name: 'Living room', lanes: 2 }, { id: 't4', name: 'Big track', lanes: 4 }],
  drivers: [{ id: 'd1', name: 'Alex', nickname: 'Speedy', callsign: 'Alpha', flag: 'NL', avatar: 'av1' }, { id: 'd2', name: 'Sam' }, { id: 'd3', name: 'Kim' }, { id: 'd4', name: 'Lee' }],
  slotcars: [1, 2, 3, 4].map(i => ({ id: 'c' + i, brand: 'Car' + i, ...(i === 1 ? { tyreCompound: 'S' } : {}) })), racesetups: [], rotationsetups: [], teams: [], weathersystems: [], fuelrules: [{ id: 'f1', name: 'Standard', tank: 100, perLap: 2, rate: 10, empty: 'retire' }], layouts: [], rowdesigns: [], sessions: [], laps: []
};
const saved = [], writes = [];
const sent = { stat: null, dyn: null, n: 0, last: null, log: [], gaps: 0 }, cbs = { stat: [], dyn: [], cmd: [] }, cmds = []; // what the race window shares with other windows (as plain text, like the real link)
// like the app does: the messages of the race window are put together into the whole state (sent.dyn), which a window that opens late is given; sent.last is the last message as it was sent
const merge = (state, m) => vm.runInContext('LiveShare', ctx).applyDynamic(state, m);
const plain = d => { const x = { ...d }; delete x.seq; return x; }; // a whole state without a message number (what an older race window sends): always accepted
const api = { liveStatic: s => { sent.stat = JSON.parse(JSON.stringify(s)); sent.dyn = null; sent.last = null; }, livePush: d => { const m = JSON.parse(JSON.stringify(d)); sent.last = m; sent.log.push(m); sent.n++; const r = merge(sent.dyn, m); if (r.ok) { if (!r.stale) sent.dyn = r.state; } else { sent.dyn = null; sent.gaps++; } },
  liveGet: async () => JSON.parse(JSON.stringify({ stat: sent.stat, dyn: sent.dyn })), onLive: f => { cbs.dyn.push(f); return () => {}; }, onLiveStatic: f => { cbs.stat.push(f); return () => {}; }, liveOpen: async () => ({ second: true }), liveCommand: c => { cmds.push(c); cbs.cmd.forEach(f => f(JSON.parse(JSON.stringify(c)))); }, onCommand: f => { cbs.cmd.push(f); return () => { cbs.cmd = cbs.cmd.filter(x => x !== f); }; },
  schema: async () => schema, getSettings: async () => ({ theme: 'dark', rules: 'Be kind. No bumping.' }), setSettings: async p => ({ ...(ctx.__ready ? vm.runInContext('state.settings', ctx) : {}), ...p }), dbPath: async () => 'x',
  list: async e => JSON.parse(JSON.stringify(store[e] || [])), customFields: async () => [], linkedLaps: async () => 0,
  saveSession: async (s, l) => { saved.push([s, l]); },
  add: async (e, item) => { const row = { ...item, id: 'N' + (store[e].length + 1) }; store[e].push(row); writes.push(['add', e, JSON.parse(JSON.stringify(item))]); return row; },
  update: async (e, id, p) => { writes.push(['update', e, id, JSON.parse(JSON.stringify(p))]); const r = store[e].find(x => x.id === id); Object.assign(r, p); return r; },
  remove: async (e, id) => { writes.push(['remove', e, id]); store[e] = store[e].filter(x => x.id !== id); } };
// the file that keeps a race that is running (the main program writes it next to the database)
const kept = { snap: null, saves: 0, clears: 0 };
api.saveResume = async snap => { kept.snap = JSON.parse(JSON.stringify(snap)); kept.saves++; return true; }; api.getResume = async () => (kept.snap ? JSON.parse(JSON.stringify(kept.snap)) : null); api.clearResume = async () => { kept.snap = null; kept.clears++; return true; };
// the app reports a screen that could not be drawn with console.error: that is a failed test (unless the test expects it)
const appConsole = { ...console, expected: false, seen: 0, error: (...a) => { if (appConsole.expected) { appConsole.seen++; return; } console.log('FAIL the app reported an error: ' + a.map(x => (x && x.stack) || x).join(' ').slice(0, 300)); fails++; } };
// the real app passes everything through Electron's structured clone, which refuses a function ("An object could not be cloned"): every call of the app interface is checked the same way here
for (const k of Object.keys(api)) { const f = api[k]; if (typeof f === 'function') api[k] = (...x) => { x.forEach(v => { if (typeof v !== 'function') structuredClone(v); }); return f(...x); }; }
const timers = new Set(); // (every timer of the app: a race that is dropped by the test, without finishing, would keep its timer)
const ctx = vm.createContext({ document, api, console: appConsole, Intl, URL, Image: function () {}, confirm: () => true, alert() {}, setTimeout, clearTimeout, setInterval: (f, ms) => { const t = setInterval(f, ms); timers.add(t); return t; }, clearInterval, performance });
ctx.__ready = true; ctx.window = ctx; ctx.addEventListener = () => {}; ctx.removeEventListener = () => {};
for (const f of ['listnum.js', 'bop.js', 'weather.js', 'tyrewear.js', 'safetycar.js', 'pushsave.js', 'racelimit.js', 'endurance.js', 'failures.js', 'damage.js', 'engine.js', 'heats.js', 'rotation.js', 'championship.js', 'champpoints.js', 'season.js', 'tokens.js', 'speed.js', 'distance.js','stats.js','homestats.js','carstats.js','viewset.js','picture.js','uiscale.js','depth.js','theme.js','banner.js', 'icons.js', 'delta.js','avatars.js', 'picmemo.js', 'weatherwidgets.js', 'tyrewidgets.js', 'pacewidgets.js', 'boardorder.js', 'widgets.js', 'frame.js', 'backdrop.js','announcer.js','sound.js', 'timing.js', 'rows.js', 'richtext.js', 'report.js', 'canvas.js', 'liveshare.js', 'review.js', 'adjustpad.js', 'adjustui.js', 'dirfolder.js', 'penaltyui.js', 'rotationdrag.js','padui.js','livegrid.js', 'homegrid.js', 'drivergrid.js', 'homecards.js', 'liveview.js', 'setupwords.js', 'database.js', 'landing.js', 'race.js', 'undo.js', 'editor.js','tokenui.js', 'bopui.js', 'enduranceui.js', 'damageui.js', 'weatherui.js', 'tyreui.js', 'pushsaveui.js', 'rotationui.js', 'championshipui.js', 'audioedit.js','widgetbuilder.js','transferui.js','themeui.js','hardware.js','trackmate.js','hardwareui.js', 'dsui.js', 'app.js']) vm.runInContext(fs.readFileSync(R + 'renderer/' + f, 'utf8'), ctx, { filename: f });
const run = s => vm.runInContext(s, ctx), E = id => document.getElementById(id);
const say = (m, c) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (cond, ms = 8000) => { for (let t = 0; t < ms && !cond(); t += 25) await wait(25); };
const key = k => run('live').key({ key: k, target: { matches: () => false }, preventDefault() {} });
const phase = () => run('live.phase');
const node = type => run('live.nodes').find(n => n.w.type === type);
const flagIs = name => { const h = node('flag').val.innerHTML; return h.includes('class="flagsvg"') && h.includes('aria-label="' + name + '"'); }; // the Race Flag widget draws a flag; its label names the state
const rows = (...ids) => ids.map(i => ({ driverId: 'd' + i, carId: 'c' + i }));
const openRace = async (setup, track, r, extra = {}) => { setup = { restartAfterRed: 'resume', ...setup }; run(`state.speed=40; state.autoFinalize = true; state.race=${JSON.stringify({ setup, track, rows: r, ...extra })}; state.tab='race'`); await run('render()'); await wait(30); };
const eng = () => run('live.engine()'), same_ = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const nowMs = () => run('performance.now()');

const events = type => eng().events.filter(e => e.type === type);
const give = (lane, n) => E('dmpanel').onclick({ target: { closest: () => ({ disabled: false, dataset: { n: String(n) }, blur() {}, closest: () => ({ dataset: { lane: String(lane) } }) }) } });
const car = i => eng().cars[i];
const lookOf0 = i => eng().enLook(i, nowMs());
const view = () => run('Damage.view(live.engine(), [0, 1], performance.now(), live.phase)');



(async () => {
  await wait(50); ctx.__sent = sent;
  const ctrack = { id: 'ct', name: 'Cup track', lanes: 4, length: 10, laneModifier: 'measured', laneLengths: '10, 12, 11, 9' };
  store.tracks = [ctrack];
  const Dz = JSON.parse(run('JSON.stringify(Rows.defaultDesign())'));
  const rdw = (types, opts = {}) => types.map((t, i) => { const w = JSON.parse(run(`JSON.stringify(Widgets.newWidget('${t}', 0, ${10 + i * 100}, 5))`)); w.w = 95; w.h = 60; w.showTitle = false; if (opts[t]) w.opt = opts[t]; return w; });
  store.rowdesigns = [{ ...Dz, id: 'rd', name: 'Season row', widgets: rdw(['position', 'name', 'lap', 'bestlap', 'avglap', 'totaltime', 'champpoints', 'gap']) },
    { ...Dz, id: 'rdd', name: 'Season distance', widgets: rdw(['name', 'distance'], { distance: { update: 'exact', decimals: '0' } }) },
    { ...Dz, id: 'rdp', name: 'Season points before', widgets: rdw(['name', 'champpoints'], { champpoints: { live: false } }) }];
  const lb = (id, opt) => ({ ...JSON.parse(run("JSON.stringify(Widgets.newWidget('leaderboard', null, 10, 10))")), id, opt });
  const layout = { ...JSON.parse(run('JSON.stringify(Widgets.defaultLayout())')), id: 'CL', name: 'Season boards' };
  layout.widgets = [lb('lbAll', { countOver: 'all' }), lb('lbRow', { countOver: 'all', design: 'rd' }), lb('lbThis', {}), lb('lbRowThis', { design: 'rd' }), lb('lbDist', { countOver: 'all', design: 'rdd' }), lb('lbWas', { countOver: 'all', design: 'rdp' })];
  store.layouts = [layout];
  const SRACE = { id: 'sr', name: 'Cup race', sessionType: 'race', track: 'ct', laps: 2, layout: 'CL', endRule: 'all' };
  const SHEAT = { id: 'sh', name: 'Cup heats', sessionType: 'heats', heatBy: 'laps', laps: 2, heatPlan: 'manual', heats: 2, resultBy: 'laps', layout: 'CL' };
  store.racesetups = [SRACE, SHEAT];
  const CH = { id: 'ch1', name: 'Cup', rounds: [{ id: 'r1', name: 'One', track: 'ct', date: '', sessions: [{ id: 'a1', setup: 'sr', share: 100 }] }, { id: 'r2', name: 'Two', track: 'ct', date: '', sessions: [{ id: 'b1', setup: 'sr', share: 100 }] }, { id: 'r3', name: 'Three', track: 'ct', date: '', sessions: [{ id: 'c1', setup: 'sr', share: 100 }] }],
    roster: [{ driver: 'd1' }, { driver: 'd2' }, { driver: 'd3' }] };
  store.championships = [CH];
  const tag = (ri, kind) => ({ id: 'ch1', name: 'Cup', round: ri + 1, roundId: ['r1', 'r2', 'r3'][ri], session: 1, sessionId: ['a1', 'b1', 'c1'][ri], kind: kind || 'race', share: 100 });
  const srow = (pos, d, name, laps, best) => ({ pos, driverId: d, driverName: name, carId: 'c' + d.slice(1), laps, best, total: laps * 5500 });
  const slap = (sid, d, lane, times) => times.map((time, i) => ({ sessionId: sid, driverId: d, trackId: 'ct', lane, lapNumber: i + 1, time }));
  // round 1: Sam wins, Alex second, Kim third; round 2: Alex wins, Kim second, Sam third (both awarded: Sam 40, Alex 43, Kim 33); a race of round 3 that is not awarded (S3), and an earlier run of this very race that is awarded (S4)
  store.sessions = [
    { id: 'S1', date: '2026-10-01T12:00:00Z', trackId: 'ct', champ: { ...tag(0), awarded: '2026-10-01T13:00:00Z' }, standings: [srow(1, 'd2', 'Sam', 3, 5000), srow(2, 'd1', 'Alex', 3, 5200), srow(3, 'd3', 'Kim', 2, 5400)] },
    { id: 'S2', date: '2026-10-08T12:00:00Z', trackId: 'ct', champ: { ...tag(1), awarded: '2026-10-08T13:00:00Z' }, standings: [srow(1, 'd1', 'Alex', 3, 4900), srow(2, 'd3', 'Kim', 3, 5100), srow(3, 'd2', 'Sam', 2, 5300)] },
    { id: 'S3', date: '2026-10-15T12:00:00Z', trackId: 'ct', champ: { ...tag(2) }, standings: [srow(1, 'd3', 'Kim', 3, 5000)] },
    { id: 'S4', date: '2026-10-15T09:00:00Z', trackId: 'ct', champ: { ...tag(2), awarded: '2026-10-15T10:00:00Z' }, standings: [srow(1, 'd3', 'Kim', 3, 5000), srow(2, 'd1', 'Alex', 3, 5100)] }];
  store.laps = [...slap('S1', 'd2', 2, [5000, 5500, 5500]), ...slap('S1', 'd1', 1, [5200, 5300, 5400]), ...slap('S1', 'd3', 3, [5400, 5600]),
    ...slap('S2', 'd1', 1, [4900, 5000, 5100]), ...slap('S2', 'd3', 3, [5100, 5200, 5300]), ...slap('S2', 'd2', 2, [5300, 5400]), ...slap('S4', 'd3', 3, [5000, 5100, 5200])];
  const board = id => run('live.nodes').find(n => n.w.id === id).val.innerHTML;
  const text = h => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const lapOn = async lane => { key(String(lane + 1)); await wait(60); };
  const click = (rv, dataset) => E('review').onclick({ target: { closest: () => ({ disabled: false, dataset: { rv, ...dataset } }) } });
  const viewerBoard = (opt, rd) => run(`(() => { const v = LiveShare.viewer(); v.feedStatic(${JSON.stringify(sent.stat)}); v.feedDynamic(${JSON.stringify(sent.dyn)}, performance.now()); const S = v.shared(performance.now()); return Timing.content({ type: 'leaderboard', opt: ${JSON.stringify(opt)} }, { ...S, rowDesigns: ${JSON.stringify(store.rowdesigns)} }).html; })()`);
  // the total time of a car that is on track runs on with the clock, so two screens drawn a moment apart can differ in that column only
  const noTotal = t => t.replace(/(\d+ \S+ \d+ [\d.]+ [\d.]+) [\d.]+/g, '$1 T');
  const fmt = ms => run(`RaceEngine.fmtTime(${ms})`);
  const dump = m => console.log('DUMP', m, '|', ['lbAll', 'lbRow', 'lbThis', 'lbDist', 'lbWas'].map(i => text(board(i))).join(' | '));

  // ---------- a race of round 3 of the championship ----------
  run('window.__sn = 0; { const o = Season.now; Season.now = (...a) => { window.__sn++; return o(...a); }; }'); // (how often the standings are worked out)
  await openRace(SRACE, ctrack, rows(1, 2, 3), { champ: tag(2) });
  run('state.autoFinalize = false');
  say('before the start the board lists the drivers in the order of the championship (Alex 43, Sam 40, Kim 33: rounds 1 and 2 count, the race of round 3 that was not awarded and the earlier run of this race do not), with the laps, the best lap and the gap in points', /^1 Alex 6 4\.900 2 Sam 5 5\.000 −3 3 Kim 5 5\.100 −10$/.test(text(board('lbAll'))));
  say('...the same in a row design: the laps and the best lap of the rounds, the average lap of all of them (5.150 is the average of Alex\'s 6 laps), their total time and the points of the championship', /^1 Alex 6 4\.900 5\.150 30\.900 43 2 Sam 5 5\.000 5\.340 26\.700 40 −3 3 Kim 5 5\.100 5\.320 26\.600 33 −10$/.test(text(board('lbRow'))));
  say('...a board that does not count over the rounds shows the cars of this race only: all three, in their lanes, with nothing driven yet', /^1 Alex 0 – 2 Sam 0 – 3 Kim 0 –$/.test(text(board('lbThis'))));
  say('...a board with the distance has the metres of the rounds (Alex 6 laps of 10 m, Sam 5 laps of 12 m, Kim 5 laps of 11 m = 60, 60 and 55)', /^Alex 60 m Sam 60 m Kim 55 m$/.test(text(board('lbDist'))));
  say('...and the points widget set to "without the race that is racing" shows the same before the race', /^Alex 43 Sam 40 Kim 33$/.test(text(board('lbWas'))));
  say('the static part of the live link carries who is who and what the rounds left behind (laps 6, 5 and 5; best laps; the lap times that count; the time; the metres)', sent.stat.roster.length === 3 && Array.isArray(sent.stat.past) && same_(sent.stat.past.map(x => [x.p, x.laps, x.best, x.valid.length, x.t1, x.dist]), [[0, 6, 4900, 6, 30900, 60], [1, 5, 5000, 5, 26700, 60], [2, 5, 5100, 5, 26600, 55]]));
  say('...and the dynamic part says where everybody stands (the order, the points now and before: the race has not started, so they are the same)', same_(sent.dyn.season, { order: [[0, 43], [1, 40], [2, 33]], pts: [[0, 43, 43], [1, 40, 40], [2, 33, 33]], ovBy: 'points' }));
  const n0 = run('window.__sn');
  await wait(400);
  say('the standings are worked out again only when something in the result changes (nothing happens for a while: no new work)', run('window.__sn') === n0 && n0 >= 1);
  key(' '); await until(() => phase() === 'running', 5000); await wait(60);
  await lapOn(1); await lapOn(0); await lapOn(1);
  const sn1 = run('window.__sn');
  say('Sam has done 2 laps, Alex one, Kim none: the race as it stands is worth 25, 18 and 15 points, so the board is Sam 65, Alex 61, Kim 48 (Sam goes past Alex, and the gap is in points)', /^1 Sam 7 [\d.]+ 2 Alex 7 [\d.]+ −4 3 Kim 5 5\.100 −17$/.test(text(board('lbAll'))) && /^1 Sam 7 [\d.]+ [\d.]+ [\d.]+ 65 2 Alex 7 [\d.]+ [\d.]+ [\d.]+ 61 −4 3 Kim 5 5\.100 5\.320 [\d.]+ 48 −17$/.test(text(board('lbRow'))));
  say('...the laps of the race are added to those of the rounds (7, 7 and 5), the best lap is the best of all of them (a lap of this race: well under a second), the points widget without the race shows the points before it, in the order now', (() => { const sam = run('live.engine().cars[1].best'), t = text(board('lbAll')); return t.includes(' ' + fmt(sam) + ' ') && /^Sam 40 Alex 43 Kim 33$/.test(text(board('lbWas'))); })());
  say('...the average lap is that of all the laps that count: the 6 of Alex\'s rounds and his lap of this race', (() => { const mine = JSON.parse(run('JSON.stringify(RaceEngine.averageLaps(live.engine().cars[0]))')), all = [5200, 5300, 5400, 4900, 5000, 5100, ...mine]; return mine.length === 1 && text(board('lbRow')).includes(' ' + fmt(all.reduce((a, b) => a + b, 0) / all.length) + ' '); })());
  say('...the board of this race alone is unchanged by all that (Sam 2 laps, Alex 1, Kim none, the gap in time)', /^1 Sam 2 [\d.]+ 2 Alex 1 [\d.]+ \+[\d.]+ 3 Kim 0 –$/.test(text(board('lbThis'))));
  say('...a board with the distance adds the metres of this race to those of the rounds (Sam 60 + 2 laps of 12 m, Alex 60 + 1 lap of 10 m, Kim 55)', /^Sam 84 m Alex 70 m Kim 55 m$/.test(text(board('lbDist'))));
  say('...the dynamic part has the new order and points (now and before)', same_(sent.dyn.season, { order: [[1, 65], [0, 61], [2, 48]], pts: [[0, 61, 43], [1, 65, 40], [2, 48, 33]], ovBy: 'points' }));
  say('...the standings were worked out again for the laps (three of them) and not for every update', run('window.__sn') - n0 >= 3 && run('window.__sn') - n0 <= 6);
  await wait(250); // (the race window sends at most about ten messages a second: the other screen has the last lap a moment later)
  say('another screen (the live link) draws the same boards: the order, the laps, the best and average lap, the points, the metres', noTotal(text(viewerBoard({ countOver: 'all', design: 'rd' }))) === noTotal(text(board('lbRow'))) && text(viewerBoard({ countOver: 'all' })) === text(board('lbAll')) && text(viewerBoard({ countOver: 'all', design: 'rdd' })) === text(board('lbDist')) && text(viewerBoard({ countOver: 'all', design: 'rdp' })) === text(board('lbWas')));
  const sn2 = run('window.__sn'); await wait(300);
  say('...and a screen that was opened late is given the same (the static part with what the rounds left behind, and the whole dynamic state)', run('window.__sn') === sn2 && !!sent.stat.past && !!sent.dyn.season);
  await lapOn(0); await lapOn(2); await lapOn(2); await until(() => phase() === 'review', 6000); await wait(100);
  say('the race is over and waits in the review: Sam won it, then Alex, then Kim, so the board is still Sam 65, Alex 61, Kim 48, with 7, 8 and 7 laps', /^1 Sam 7 [\d.]+ 2 Alex 8 [\d.]+ −4 3 Kim 7 [\d.]+ −17$/.test(text(board('lbAll'))) && /65 .* 61 .* 48/.test(text(board('lbRow'))));
  eng().adjust(0, { laps: 1 }); // (the Race Director gives Alex a lap in the review: 3 laps count, and first place is his: 25 points)
  click('finalize', {}); await until(() => saved.length > 0, 8000); await wait(150);
  const sv = saved[0][0];
  say('the race is saved as a race of the championship (round 3), and what is saved has the result of this race only', same_(sv.champ, tag(2)) && sv.standings.length === 3 && sv.standings.map(x => x.laps).sort().join() === '2,2,3' && sv.standings[0].driverName === 'Alex');
  await wait(250);
  say('...and another screen draws the same boards after the race has finished', noTotal(text(viewerBoard({ countOver: 'all', design: 'rd' }))) === noTotal(text(board('lbRow'))) && text(viewerBoard({ countOver: 'all' })) === text(board('lbAll')));
  say('...after the race has finished the board has the result as it was saved, with the lap of the Race Director: Alex 68 (9 laps), Sam 58, Kim 48, the gap in points', /^1 Alex 9 [\d.]+ 2 Sam 7 [\d.]+ \u221210 3 Kim 7 [\d.]+ \u221220$/.test(text(board('lbAll'))) && /68 .* 58 .* 48/.test(text(board('lbRow'))));
  run('state.race = null; live = null'); timers.forEach(clearInterval);

  // ---------- a heat race in the championship ----------
  saved.length = 0; kept.snap = null;
  await openRace(SHEAT, ctrack, rows(1, 2, 3), { champ: tag(2) });
  run('state.autoFinalize = false');
  const ci = p => eng().cars.findIndex(c => c.participant === p), laneOf = p => eng().cars[ci(p)].lane;
  say('a heat race of the championship starts like any race of it: the standings of the rounds (Alex 43, Sam 40, Kim 33), nothing of earlier heats yet', /^1 Alex 6 4\.900 5\.150 30\.900 43 2 Sam 5 5\.000 5\.340 26\.700 40 −3 3 Kim 5 5\.100 5\.320 26\.600 33 −10$/.test(text(board('lbRow'))) && sent.stat.prior.length === 0 && sent.stat.past.length === 3);
  key(' '); await until(() => phase() === 'running', 5000); await wait(100);
  say('...the heat has started and nobody has done a lap: nothing is worth anything yet, the points now are the points before and the order is that of the rounds', same_(sent.dyn.season.pts, [[0, 43, 43], [1, 40, 40], [2, 33, 33]]) && same_(sent.dyn.season.order, [[0, 43], [1, 40], [2, 33]]));
  const lens = [10, 12, 11, 9], m1 = [2 * lens[laneOf(0)], 4 * lens[laneOf(1)], 3 * lens[laneOf(2)]]; // (the metres of heat 1 with the laps that are added: the plan of the heat is drawn by chance, so the lanes are read from the cars)
  for (const p of [0, 1, 2]) { await lapOn(laneOf(p)); await lapOn(laneOf(p)); }
  await until(() => phase() === 'review', 6000); await wait(250);
  eng().adjust(ci(1), { laps: 2 }); eng().adjust(ci(2), { laps: 1 }); // (the Race Director adds laps in the review: Sam 4 laps, Kim 3, Alex 2)
  click('finalize', {}); await until(() => phase() === 'between', 5000); await wait(350);
  say('heat 1 is done (Sam 4 laps, Kim 3, Alex 2: places 1, 2 and 3 are worth 25, 18 and 15 points): the board has the championship with that heat counted: Sam 65, Alex 58, Kim 51', /^1 Sam 9 [\d.]+ 2 Alex 8 [\d.]+ −7 3 Kim 8 [\d.]+ −14$/.test(text(board('lbAll'))) && /65 .* 58 .* 51/.test(text(board('lbRow'))));
  say('...the laps of the heat are added to those of the rounds (5 + 4, 6 + 2, 5 + 3) and the metres too (the laps of the heat times the length of the lane each car drove in, on top of 60, 60 and 55 of the rounds)', new RegExp('^Sam ' + (60 + m1[1]) + ' m Alex ' + (60 + m1[0]) + ' m Kim ' + (55 + m1[2]) + ' m$').test(text(board('lbDist'))));
  say('...the live link has what the heat left behind (prior: 2 valid laps each and the metres of the heat) and what the rounds left behind (past: unchanged)', sent.stat.prior.length === 3 && sent.stat.prior.every(x => x.valid.length === 2) && same_(sent.stat.prior.map(x => [x.p, x.laps, x.dist]).sort(), [[0, 2, m1[0]], [1, 4, m1[1]], [2, 3, m1[2]]]) && same_(sent.stat.past.map(x => [x.p, x.laps]), [[0, 6], [1, 5], [2, 5]]));
  say('...and the average lap is made of the laps of the rounds and of the heat (Alex: his 6 laps and the 2 of heat 1)', (() => { const alex = sent.stat.prior.find(x => x.p === 0).valid, all = [5200, 5300, 5400, 4900, 5000, 5100, ...alex]; return alex.length === 2 && text(board('lbRow')).includes(' ' + fmt(all.reduce((a, b) => a + b, 0) / all.length) + ' '); })());
  say('...the total time is the time of the rounds and of the heat (Alex: 30.900 and the time he raced in heat 1), and the same on another screen', (() => { const alexT = sent.dyn.heat.before.find(x => x[0] === 0)[2]; return alexT > 0 && text(board('lbRow')).includes(' ' + fmt(30900 + alexT) + ' ') && noTotal(text(viewerBoard({ countOver: 'all', design: 'rd' }))) === noTotal(text(board('lbRow'))); })());
  say('...the heat that is kept for a restart still knows the championship of the race', !!kept.snap && !!kept.snap.race && same_(kept.snap.race.champ, tag(2)));
  key(' '); await until(() => phase() === 'running', 8000); await wait(100);
  for (const p of [0, 1, 2]) { await lapOn(laneOf(p)); await lapOn(laneOf(p)); }
  await until(() => phase() === 'review', 6000); await wait(250);
  eng().adjust(ci(0), { laps: 3 }); // (Alex 5 laps in heat 2: 7 laps in all, Sam 4 + 2 = 6, Kim 3 + 2 = 5)
  click('finalize', {}); await until(() => saved.length > 0, 8000); await wait(250);
  say('after the last heat the standings of the championship follow the overall result of the heats: Alex first (7 laps: 25 points, 68), Sam second (6 laps: 58), Kim third (5 laps: 48)', /^1 Alex 13 [\d.]+ 2 Sam 11 [\d.]+ −10 3 Kim 10 [\d.]+ −20$/.test(text(board('lbAll'))) && /68 .* 58 .* 48/.test(text(board('lbRow'))));
  say('...the same on another screen after the last heat (the heats are told to it again, so the last one is not counted twice there either)', noTotal(text(viewerBoard({ countOver: 'all', design: 'rd' }))) === noTotal(text(board('lbRow'))) && text(viewerBoard({ countOver: 'all' })) === text(board('lbAll')) && text(viewerBoard({ countOver: 'all', design: 'rdd' })) === text(board('lbDist')));
  say('...and the race is saved as a race of the championship', same_(saved[0][0].champ, tag(2)) && saved[0][0].heatResults.length === 2);
  run('state.race = null; live = null'); timers.forEach(clearInterval);

  // ---------- a car that is put out of a race of the championship ----------
  store.penaltysystems = [{ id: 'p1', name: 'Points', everyPoints: 5, everySeconds: 5, dqPoints: 3 }];
  store.racesetups = [SRACE, SHEAT, { ...SRACE, id: 'sp', name: 'Cup race with penalties', penaltySystem: 'p1' }];
  saved.length = 0;
  await openRace({ ...SRACE, id: 'sp', penaltySystem: 'p1' }, ctrack, rows(1, 2, 3), { champ: tag(2) });
  key(' '); await until(() => phase() === 'running', 5000); await wait(100);
  { const lane = d => eng().cars.find(c => c.driverId === 'd' + d).lane, idx = d => eng().cars.findIndex(c => c.driverId === 'd' + d);
    await lapOn(lane(2)); await lapOn(lane(1)); await wait(250);
    say('Sam has crossed first and Alex second: the race as it stands is Sam 65, Alex 61, Kim 48', same_(sent.dyn.season.pts, [[0, 61, 43], [1, 65, 40], [2, 48, 33]]));
    eng().addPoints(idx(2), 3, nowMs()); await lapOn(lane(3)); await wait(250); // (Sam reaches the 3 points that disqualify; Kim does her first lap, which lets the app look at the race again)
    say('...Sam is disqualified: nothing for his place, the places behind him move up (Alex 25: 68, Kim 18: 51), and he keeps the points he had before the race (40)', eng().cars[idx(2)].dq === true && same_(sent.dyn.season.pts, [[0, 68, 43], [1, 40, 40], [2, 51, 33]]) && same_(sent.dyn.season.order, [[0, 68], [2, 51], [1, 40]]));
    say('...and so is the board on this screen (Alex, Kim, Sam) and on another screen', /^1 Alex .* 2 Kim .* 3 Sam /.test(text(board('lbAll'))) && text(viewerBoard({ countOver: 'all' })) === text(board('lbAll'))); }
  run('state.race = null; live = null'); timers.forEach(clearInterval);

  // a car that runs out of fuel and retires (a tank for 1 lap)
  store.fuelrules = [{ id: 'f2', name: 'Tiny tank', tank: 3, perLap: 2, rate: 10, empty: 'retire' }];
  await openRace({ ...SRACE, id: 'sp', fuelRules: 'f2' }, ctrack, rows(1, 2, 3), { champ: tag(2) });
  key(' '); await until(() => phase() === 'running', 5000); await wait(100);
  { const lane = d => eng().cars.find(c => c.driverId === 'd' + d).lane;
    await lapOn(lane(2)); await lapOn(lane(1)); await lapOn(lane(3)); await wait(250);
    say('everybody has done one lap (Sam first, Alex second, Kim third): the race as it stands is Sam 65, Alex 61, Kim 48', same_(sent.dyn.season.pts, [[0, 61, 43], [1, 65, 40], [2, 48, 33]]));
    await lapOn(lane(2)); await wait(250); // (Sam's tank does not hold a second lap)
    say('...Sam runs out of fuel and retires: nothing for his place, Alex 25 (68) and Kim 18 (51) move up, and he keeps the 40 he had', eng().cars.find(c => c.driverId === 'd2').retired === true && same_(sent.dyn.season.pts, [[0, 68, 43], [1, 40, 40], [2, 51, 33]]) && same_(sent.dyn.season.order, [[0, 68], [2, 51], [1, 40]])); }
  run('state.race = null; live = null'); timers.forEach(clearInterval);

  // ---------- a heat race of teams in a championship ----------
  store.teams = [{ id: 'T1', name: 'Red Bulls', drivers: ['d1', 'd2'] }, { id: 'T2', name: 'Blue Moons', drivers: ['d3', 'd4'] }];
  store.championships = [CH, { id: 'ch2', name: 'Team Cup', rounds: [{ id: 'r1', name: 'One', track: 'ct', date: '', sessions: [{ id: 'a1', setup: 'sh', share: 100 }] }], roster: [{ driver: 'd1', team: 'T1' }, { driver: 'd2', team: 'T1' }, { driver: 'd3', team: 'T2' }] }];
  saved.length = 0;
  { const tagT = { id: 'ch2', name: 'Team Cup', round: 1, roundId: 'r1', session: 1, sessionId: 'a1', kind: 'race', share: 100 };
    await openRace({ ...SHEAT, heats: 1, teamDriver: 'order' }, ctrack, [{ teamId: 'T1', carId: 'c1' }, { teamId: 'T2', carId: 'c2' }], { champ: tagT, byTeam: true, schedule: [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }]] });
    run('state.autoFinalize = false');
    say('a heat race of teams in a championship starts with both teams on 0 points, as the teams of the championship', sent.stat.roster.length === 2 && sent.stat.roster.every(x => x.asTeam === true) && same_(sent.dyn.season.pts, [[0, 0, 0], [1, 0, 0]]));
    key(' '); await until(() => phase() === 'running', 5000); await wait(100);
    const laneOfT = p => eng().cars.find(c => c.participant === p).lane;
    await lapOn(laneOfT(1)); await lapOn(laneOfT(1)); await lapOn(laneOfT(0)); await wait(250);
    say('Blue Moons are ahead with two laps, Red Bulls have one: the race as it stands is worth 25 points to the Blue Moons and 18 to the Red Bulls, and the board follows (the name is that of the driver who drives for the team: Kim for the Blue Moons, Alex for the Red Bulls)', same_(sent.dyn.season.pts, [[0, 18, 0], [1, 25, 0]]) && same_(sent.dyn.season.order, [[1, 25], [0, 18]]) && /^1 Kim .* 2 Alex /.test(text(board('lbAll'))) && text(viewerBoard({ countOver: 'all' })) === text(board('lbAll')));
  }
  run('state.race = null; live = null'); timers.forEach(clearInterval);
  // an Endurance Race of teams in the same championship: the team is the row
  { const tagT = { id: 'ch2', name: 'Team Cup', round: 1, roundId: 'r1', session: 1, sessionId: 'a1', kind: 'race', share: 100 };
    await openRace({ name: 'Day race', sessionType: 'endurance', enduranceBy: 'laps', laps: 6, endRule: 'all', swapUnit: 'laps', swapMode: 'every', swapEvery: 2, swapWarn: 1, swapConfirm: 'both', swapSeconds: 0.2, swapNext: 'order', swapGrace: 30, swapLate: 'count', layout: 'CL' }, ctrack, [{ teamId: 'T1', driverId: 'd1', carId: 'c1' }, { teamId: 'T2', driverId: 'd3', carId: 'c2' }], { champ: tagT });
    key(' '); await until(() => phase() === 'running', 5000); await wait(100);
    const laneOfT = i => eng().cars[i].lane;
    await lapOn(laneOfT(1)); await lapOn(laneOfT(1)); await lapOn(laneOfT(0)); await wait(250);
    say('an Endurance Race of two teams: the teams are the participants, the one with two laps (the Blue Moons) is worth 25 points as it stands and the Red Bulls 18', sent.stat.roster.length === 2 && sent.stat.roster.every(x => x.asTeam === true) && same_(sent.dyn.season.pts, [[0, 18, 0], [1, 25, 0]]) && same_(sent.dyn.season.order, [[1, 25], [0, 18]])); }
  run('state.race = null; live = null'); timers.forEach(clearInterval);
  store.championships = [CH];

  // ---------- the last heat of a heat race that is not in a championship (1.67.0 counted it twice once it was recorded) ----------
  saved.length = 0;
  await openRace(SHEAT, ctrack, rows(1, 2, 3));
  run('state.autoFinalize = false');
  for (const heatNo of [1, 2]) {
    key(' '); await until(() => phase() === 'running', 8000); await wait(100);
    for (const c of [0, 1, 2]) { const ln = eng().cars[c].lane; await lapOn(ln); await lapOn(ln); }
    await until(() => phase() === 'review', 6000); await wait(200);
    click('finalize', {}); await until(() => (heatNo === 1 ? phase() === 'between' : saved.length > 0), 8000); await wait(300);
  }
  const overOf = () => JSON.parse(run(`(() => { const v = LiveShare.viewer(); v.feedStatic(${JSON.stringify(sent.stat)}); v.feedDynamic(${JSON.stringify(sent.dyn)}, performance.now()); const O = Timing.overallState(v.shared(performance.now())); return JSON.stringify(O.standings().map(x => [x.car.lapsAll, x.car.laps.length, x.car.recorded])); })()`));
  say('after the last heat is recorded the board has every heat once: 4 laps for everybody (2 + 2), the lap times that count are 4 too (not 6), the metres are those of the two heats', /^1 \S+ 4 .* 2 \S+ 4 .* 3 \S+ 4 /.test(text(board('lbAll'))) && same_(overOf(), [[4, 4, true], [4, 4, true], [4, 4, true]]));
  say('...and the same on the board that shows the metres: the laps of both heats times the length of the lane they were driven in, once', (() => { const m = text(board('lbDist')).match(/\d+ m/g) || []; return m.length === 3 && m.every(x => { const v = parseInt(x, 10); return v >= 4 * 9 && v <= 4 * 12; }); })());
  run('state.race = null; live = null'); timers.forEach(clearInterval);

  // ---------- a driver who is not in the championship, and races that do not count over the rounds ----------
  saved.length = 0;
  await openRace(SRACE, ctrack, rows(1, 2, 3, 4), { champ: tag(2) });
  run('state.autoFinalize = false');
  say('a driver who is not in the championship (Lee, a guest) is on the board, after everybody who is, with no points and no gap', /^1 Alex 6 4\.900 5\.150 30\.900 43 2 Sam 5 5\.000 5\.340 26\.700 40 −3 3 Kim 5 5\.100 5\.320 26\.600 33 −10 4 Lee 0 – – – – –$/.test(text(board('lbRow'))) || /^1 Alex .* 3 Kim .* 4 Lee 0 /.test(text(board('lbRow'))));
  say('...he has no entry for the rounds in the live link (he took part in none)', sent.stat.past.length === 3 && sent.stat.roster.length === 4 && sent.dyn.season.pts.length === 4 && sent.dyn.season.pts[3][1] === null && sent.dyn.season.order[3][0] === 3);
  key(' '); await until(() => phase() === 'running', 5000); await wait(60);
  await lapOn(3); await lapOn(3); await wait(60);
  say('...if he wins the race he gets no points, and the places behind him move up (Sam 1st: 25 again, as the table says for the first finisher: here the first of the drivers of the championship)', /^1 .* 4 Lee /.test(text(board('lbRow'))) && sent.dyn.season.pts[3][1] === null);
  run('state.race = null; live = null'); timers.forEach(clearInterval);

  const plainStat = async (champ, label) => {
    await openRace(SRACE, ctrack, rows(1, 2, 3), champ ? { champ } : {});
    run('state.autoFinalize = false');
    say(label + ': no earlier rounds are in the live link, and the boards that count over all heats are the boards of the race', sent.stat.past === null && sent.stat.roster === null && sent.dyn.season === null && text(board('lbAll')) === text(board('lbThis')) && /^1 Alex 0 – 2 Sam 0 – 3 Kim 0 –$/.test(text(board('lbAll'))));
    run('state.race = null; live = null'); timers.forEach(clearInterval);
  };
  await plainStat(null, 'a race that is not in a championship');
  await plainStat(tag(2, 'qualifying'), 'a qualifying of the championship');
  await plainStat(tag(2, 'practice'), 'a practice of the championship');
  await plainStat({ ...tag(2), roundId: 'gone' }, 'a race of a round that was deleted from the championship');
  await plainStat({ ...tag(2), id: 'other' }, 'a race of a championship that is not there');
  { store.championships = [{ ...CH, rounds: CH.rounds.map((r, i) => (i === 2 ? { ...r, sessions: [{ ...r.sessions[0], share: 0 }] } : r)) }]; await plainStat(tag(2), 'a race that gives no points');
    store.championships = [CH]; }
  { const was = store.championships; store.championships = []; await plainStat(tag(2), 'a championship that was deleted'); store.championships = was; }

  reachedEnd = true;
  console.log(fails ? fails + ' SEASON SCREEN TESTS FAILED' : 'ALL SEASON SCREEN TESTS PASSED'); process.exit(fails ? 1 : 0);
})();
