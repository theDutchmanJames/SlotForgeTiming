// 1.9.0: the Endurance Race on screen: the Home tab (a team, a car and the driver who starts), the race itself (swaps by the Swap done button, by the pit sensor and by the Race Director page,
// the laps saved for the driver who drove them), the swap panel, and what is saved, against a stand-in for the app window.
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
const ctx = vm.createContext({ document, api, console: appConsole, Intl, URL, Image: function () {}, confirm: () => true, alert() {}, setTimeout, clearTimeout, setInterval, clearInterval, performance });
ctx.__ready = true; ctx.window = ctx; ctx.addEventListener = () => {}; ctx.removeEventListener = () => {};
for (const f of ['listnum.js', 'bop.js', 'weather.js', 'tyrewear.js', 'safetycar.js', 'endurance.js', 'failures.js', 'damage.js', 'engine.js', 'heats.js', 'rotation.js', 'tokens.js', 'speed.js', 'distance.js','stats.js','homestats.js','carstats.js','viewset.js','picture.js','uiscale.js','depth.js','theme.js','banner.js', 'icons.js', 'delta.js','avatars.js', 'weatherwidgets.js', 'tyrewidgets.js', 'boardorder.js', 'widgets.js', 'frame.js', 'backdrop.js','announcer.js','sound.js', 'timing.js', 'rows.js', 'richtext.js', 'report.js', 'canvas.js', 'liveshare.js', 'review.js', 'adjustpad.js', 'adjustui.js', 'dirfolder.js', 'penaltyui.js', 'rotationdrag.js','padui.js','livegrid.js', 'homegrid.js', 'drivergrid.js', 'homecards.js', 'liveview.js', 'database.js', 'landing.js', 'race.js', 'undo.js', 'editor.js','tokenui.js', 'bopui.js', 'enduranceui.js', 'weatherui.js', 'tyreui.js', 'rotationui.js', 'audioedit.js','widgetbuilder.js','transferui.js','themeui.js','hardware.js','trackmate.js','hardwareui.js', 'dsui.js', 'app.js']) vm.runInContext(fs.readFileSync(R + 'renderer/' + f, 'utf8'), ctx, { filename: f });
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
const lookOf = i => eng().enLook(i, nowMs());
const events = type => eng().events.filter(e => e.type === type);
const pressSwap = (lane, over = {}) => E('enpanel').onclick({ target: { closest: () => ({ disabled: false, dataset: { en: 'swap' }, blur() {}, closest: () => ({ dataset: { lane: String(lane) }, querySelector: () => ({ hidden: true, value: '' }), ...over }) }) } });

(async () => {
  await wait(50); ctx.__sent = sent;
  store.teams = [{ id: 'T1', name: 'Red Bulls', drivers: ['d1', 'd2'], picture: 'data:image/jpeg;base64,RED' }, { id: 'T2', name: 'Blue Moons', drivers: ['d3', 'd4'] }, { id: 'T3', name: 'Solo', drivers: ['d1'] }, { id: 'T4', name: 'Trio', drivers: ['d2', 'd3', 'd4'] }];
  const esetup = over => ({ name: 'Day race', sessionType: 'endurance', enduranceBy: 'laps', laps: 6, endRule: 'all', swapUnit: 'laps', swapMode: 'every', swapEvery: 2, swapWarn: 1, swapConfirm: 'both', swapSeconds: 0.2, swapNext: 'order', swapGrace: 30, swapLate: 'count', layout: '', ...over });
  const eRows = [{ teamId: 'T1', carId: 'c1', driverId: 'd1' }, { teamId: 'T2', carId: 'c2', driverId: 'd3' }];
  const lapOn = async lane => { key(String(lane + 1)); await wait(80); };

  // ---------- the Home tab: a team, a car and the driver who starts ----------
  {
    const homeSetup = over => ({ id: 'es1', ...esetup(), track: 't1', ...over });
    const home = async (over = {}, asg = []) => {
      store.racesetups = [homeSetup(over)]; store.rotationsetups = [];
      run("state.settings.lastSetupId = 'es1'; state.settings.assignments = " + JSON.stringify({ es1: asg }) + "; state.settings.heatEdits = {}; state.settings.heatSeeds = { es1: 5 }; state.tab = 'home'; state.race = null; state.rotMsg = null; live = null");
      await run('render()'); await wait(30); return E('view').innerHTML.replace(/&quot;/g, '"');
    };
    const change = async (row, k, value) => { await E('view').onchange({ target: { dataset: { k }, value, closest: () => ({ dataset: { row: String(row) } }) } }); await wait(30); return E('view').innerHTML.replace(/&quot;/g, '"'); };
    const clickHome = async b => { await E('view').onclick({ target: { closest: sel => (sel === 'button' ? { dataset: {}, ...b } : null) } }); await wait(30); return E('view').innerHTML.replace(/&quot;/g, '"'); };
    const assignments = () => run('state.settings.assignments.es1');
    const rowsOf = h => h.split('data-row="').slice(1);
    const options = (rowHtml, k) => { const m = new RegExp('<select data-k="' + k + '"[^>]*>(.*?)</select>').exec(rowHtml); return m ? [...m[1].matchAll(/<option value="([^"]*)"( selected)?>([^<]*)</g)].map(x => ({ v: x[1], sel: !!x[2], t: x[3] })) : null; };
    let hh = await home({}, [{ driverId: '', carId: '' }, { driverId: '', carId: '' }]);
    say('the Home tab says what the setup is: an Endurance Race', hh.includes('Endurance Race on Living room'));
    say('every lane has a team (it has to be chosen), a starting driver and a car', rowsOf(hh).length === 2 && rowsOf(hh).every(r => options(r, 'teamId')[0].t === '(choose a team)' && options(r, 'driverId') && options(r, 'carId')));
    say('...a lane without a team has no starting driver to choose from, and says what the blank means (the first of the team)', options(rowsOf(hh)[0], 'driverId').length === 1 && options(rowsOf(hh)[0], 'driverId')[0].t === '(starting driver: the first of the team)');
    say('...and the race can not start: every lane needs a team and a car', hh.includes('Lane 1 needs a team and a car.') && hh.includes('Lane 2 needs a team and a car.') && /id="start" disabled/.test(hh));
    hh = await change(0, 'teamId', 'T1');
    say('a team for a lane: the drivers of that team are the choice for the starting driver, and none is chosen yet (the rule decides)', assignments()[0].teamId === 'T1' && assignments()[0].driverId === '' && options(rowsOf(hh)[0], 'driverId').filter(o => o.v).map(o => o.t).join() === 'Alex,Sam' && !options(rowsOf(hh)[0], 'driverId').some(o => o.sel && o.v));
    hh = await change(0, 'driverId', 'd2');
    say('...a starting driver can be chosen', assignments()[0].driverId === 'd2' && options(rowsOf(hh)[0], 'driverId').find(o => o.sel).t === 'Sam');
    hh = await change(0, 'teamId', 'T2');
    say('another team takes the starting driver away when he is not in it', assignments()[0].teamId === 'T2' && assignments()[0].driverId === '');
    hh = await change(0, 'teamId', 'T1'); hh = await change(1, 'teamId', 'T3'); hh = await change(0, 'carId', 'c1'); hh = await change(1, 'carId', 'c2');
    say('a team with one driver can not swap: Home says so, with the way out', hh.includes('The team Solo has one driver only: an Endurance Race needs a team of two drivers or more. Add drivers in Database &gt; Teams.') || hh.includes('The team Solo has one driver only: an Endurance Race needs a team of two drivers or more. Add drivers in Database > Teams.'));
    hh = await change(1, 'teamId', 'T1');
    say('the same team on two lanes is refused', hh.includes('A team is used more than once.'));
    hh = await change(1, 'teamId', 'T4'); hh = await change(0, 'driverId', 'd2'); hh = await change(1, 'driverId', 'd2');
    say('a driver who starts for two teams is refused (Sam is in both)', hh.includes('A driver starts for two teams. Choose another starting driver.') && /id="start" disabled/.test(hh));
    hh = await change(1, 'driverId', '');
    say('with a team and a car on every lane, and the starting drivers apart, the race can start', !/id="start" disabled/.test(hh) && !hh.includes('class="issues"'));
    await clickHome({ id: 'start' }); const st = JSON.parse(run('JSON.stringify(state.race)'));
    say('the race gets the setup as it is in the database (an Endurance Race), and the starting driver of every team: the chosen one, else the first of the team who does not start for another team', st.setup.sessionType === 'endurance' && st.rows.length === 2 && st.rows[0].teamId === 'T1' && st.rows[0].driverId === 'd2' && st.rows[1].teamId === 'T4' && st.rows[1].driverId === 'd3' && !st.byTeam);
    // by lot
    run('state.rand = () => 0.999');
    hh = await home({ swapNext: 'random' }, [{ driverId: '', carId: 'c1', teamId: 'T4' }, { driverId: '', carId: 'c2', teamId: 'T2' }]);
    say('when the driver who steps in is picked by lot, the blank starting driver says that too', options(rowsOf(hh)[0], 'driverId')[0].t === '(starting driver: by lot)');
    await clickHome({ id: 'start' }); const lot = JSON.parse(run('JSON.stringify(state.race)'));
    say('...and the driver who starts is picked by lot (a lot just below 1 takes the last driver)', lot.rows[0].driverId === 'd4' && lot.rows[1].driverId === 'd4' ? false : lot.rows[0].driverId === 'd4' && lot.rows[1].driverId === 'd3');
    run('state.rand = null'); run('state.race = null; live = null');
    // heat-based: the teams are the participants, as in a heat race with teams
    hh = await home({ enduranceBy: 'heats', heatBy: 'laps', heatPlan: 'manual', heats: 2 }, [{ driverId: '', carId: 'c1', teamId: 'T1' }, { driverId: '', carId: 'c2', teamId: 'T2' }]);
    say('heat-based: the participants are teams without any further setting (a team and a car each; no starting driver, the heats choose)', hh.includes('Team 1') && hh.includes('Heat plan') && options(rowsOf(hh)[0], 'teamId') && !hh.includes('data-k="driverId"') && !hh.includes('needs a team and a car'));
    hh = await change(0, 'teamId', 'T3');
    say('...a team with one driver is refused there too', hh.includes('The team Solo has one driver only'));
    run('state.race = null; live = null');
    store.racesetups = []; store.teams.length = 0; store.teams.push({ id: 'T1', name: 'Red Bulls', drivers: ['d1', 'd2'], picture: 'data:image/jpeg;base64,RED' }, { id: 'T2', name: 'Blue Moons', drivers: ['d3', 'd4'] }, { id: 'T3', name: 'Solo', drivers: ['d1'] }, { id: 'T4', name: 'Trio', drivers: ['d2', 'd3', 'd4'] });
  }

  // ---------- the race: swapping with the button ----------
  saved.length = 0;
  await openRace(esetup(), store.tracks[0], eRows);
  say('the race screen names the race and how it swaps', E('racehost').innerHTML.includes('Endurance Race on Living room') && E('racehost').innerHTML.includes('6 laps, a swap every 2 laps'));
  say('each team is one car with the driver who starts, the roster of its drivers, and the team (name, picture) in the car', eng().cars.length === 2 && eng().cars[0].driverName === 'Alex' && eng().cars[0].teamName === 'Red Bulls' && eng().cars[0].roster.map(r => r.id).join() === 'd1,d2' && eng().cars[1].driverName === 'Kim' && eng().cars[0].teamPicture === 'data:image/jpeg;base64,RED' && eng().cars[0].asTeam === true);
  say('...the rules are in the race: swaps counted in laps, every 2 laps', eng().endurance.unit === 'laps' && eng().endurance.every === 2 && eng().cars.every(c => c.en));
  say('...the swap panel is there (the Race Director sees who is at the wheel)', E('enpanel').hidden === false);
  say('...the nickname and flag of the starting driver are in the car (the widgets use them)', eng().cars[0].nickname === 'Speedy' && eng().cars[0].flag === 'NL' && eng().cars[0].avatar === 'av1');
  key(' '); await until(() => phase() === 'running', 5000); await wait(60);
  await lapOn(0);
  say('after 1 lap of a 2-lap stint the swap comes soon (the warning is 1 lap)', lookOf(0).state === 'soon' && lookOf(1).state === 'ok');
  await lapOn(0); await wait(60);
  say('after 2 laps the swap is due, for that team only', lookOf(0).state === 'due' && lookOf(1).state === 'ok' && events('swapdue').length === 1 && events('swapdue')[0].car === 0);
  say('...the lap counting goes on (the setup counts), nobody has been swapped yet', eng().cars[0].driverName === 'Alex' && eng().cars[0].laps.length === 2);
  await pressSwap(0); await wait(30);
  say('Swap done: the other driver of the team is at the wheel, in the same car (Sam), with his own details', eng().cars[0].driverId === 'd2' && eng().cars[0].driverName === 'Sam' && eng().cars[0].nickname === '' && eng().cars[0].carId === 'c1' && eng().cars[0].laps.length === 2 && events('swapdone').length === 1 && events('swapdone')[0].toName === 'Sam' && events('swapdone')[0].fromName === 'Alex' && events('swapdone')[0].by === 'button');
  say('...the stint of the next driver starts: the swap is not due again, and the next driver is Alex', lookOf(0).state === 'ok' && lookOf(0).next === 'd1' && eng().cars[0].en.swaps === 1);
  await lapOn(0); await lapOn(0); await wait(60);
  say('the next stint is due after 2 more laps, and a second Swap done brings Alex back', lookOf(0).state === 'due');
  await pressSwap(0); await wait(30);
  say('...Alex again', eng().cars[0].driverName === 'Alex' && eng().cars[0].en.swaps === 2);
  // the other car swaps by the pit sensor: it stands on the sensor long enough once the swap is due
  await lapOn(1); await lapOn(1); await wait(60);
  say('the other team is due too', lookOf(1).state === 'due');
  run('live.pitBtns[1].b.onclick()'); await wait(80);
  say('standing on the sensor for a short time is not enough yet (the setup wants 0.2 seconds)', eng().cars[1].driverName === 'Kim');
  await wait(300);
  say('...standing long enough swaps the driver (by the sensor), once for the stop', eng().cars[1].driverName === 'Lee' && events('swapdone').filter(e => e.car === 1).length === 1 && events('swapdone').filter(e => e.car === 1)[0].by === 'sensor');
  run('live.pitBtns[1].b.onclick()'); await wait(40);
  // finish: 6 laps each
  for (let n = 0; n < 10 && eng().cars[0].laps.length < 6; n++) await lapOn(0);
  for (let n = 0; n < 10 && eng().cars[1].laps.length < 6; n++) await lapOn(1);
  await wait(100);
  await until(() => phase() === 'finished', 5000); await wait(150);
  const s1 = saved[0] && saved[0][0], l1 = saved[0] && saved[0][1];
  say('the race is saved once, as an Endurance Race', saved.length === 1 && s1.sessionType === 'endurance' && s1.setupName === 'Day race');
  const red = s1.standings.find(x => x.teamId === 'T1'), blue = s1.standings.find(x => x.teamId === 'T2');
  say('...a row per team (the team is the row, with no driver of its own), with the laps of the team', s1.standings.length === 2 && red.asTeam === true && red.driverId === '' && red.driverName === 'Red Bulls' && red.laps === 6 && blue.laps === 6);
  say('...Red Bulls: Alex drove laps 1-2 and 5-6 (4 laps), Sam laps 3-4 (2 laps), with the time at the wheel', red.drivers.map(d => d.driverId + ':' + d.laps).join() === 'd1:4,d2:2' && red.drivers.every(d => d.ms > 0 && d.driverName) && red.swaps === 2);
  say('...the stints: Alex, Sam, Alex, with their laps and the time they drove', red.stints.map(q => q.driverId + ':' + q.laps).join() === 'd1:2,d2:2,d1:2' && red.stints.every(q => q.ms >= 0 && q.to >= q.from) && red.stints[2].by === 'end' && red.stints[1].by === 'button');
  say('...Blue Moons: Kim then Lee, the swap was made at the sensor', blue.stints.map(q => q.driverId).join() === 'd3,d4' && blue.stints[0].by === 'sensor');
  say('...every lap is saved for the driver who drove it, and with the team', l1.filter(l => l.teamId === 'T1').sort((a, b) => a.lapNumber - b.lapNumber).map(l => l.driverId).join() === 'd1,d1,d2,d2,d1,d1' && l1.every(l => l.teamId && l.driverId));
  say('...the standings keep the usual figures', s1.standings.map(x => x.pos).join() === '1,2' && s1.standings.every(x => x.carId && Number.isFinite(x.best)));
  run('state.race = null; live = null'); saved.length = 0;

  // ---------- the Race Director page and the other screens ----------
  await openRace(esetup({ swapEvery: 1, laps: 4 }), store.tracks[0], eRows);
  say('the other screens are told the rules and the roster of every team', sent.stat && sent.stat.cfg.endurance && sent.stat.cfg.endurance.every === 1 && sent.stat.cfg.entries[0].roster.length === 2 && sent.stat.cfg.entries[0].roster[1].name === 'Sam');
  key(' '); await until(() => phase() === 'running', 5000); await wait(60);
  await lapOn(0); await wait(250);
  say('...and told the state of the swaps and who is at the wheel in every message', sent.dyn && sent.dyn.cars[0].en && sent.dyn.cars[0].en.due && sent.dyn.cars[0].driverName === 'Alex' && sent.dyn.cars[1].driverName === 'Kim');
  { // 1.36.0: the Driver stats page of a car that has to swap: the swap signal flashes across the top, the swap timer says now, and the drivers can be cells too
    const host = document.createElement('div'); await run('LiveView.mount')(host, {}); await wait(50); run('LiveView.go')('driver'); await wait(80);
    const h = () => E('lv-dstats').innerHTML, cell = k => new RegExp(`<div class="lv-dg lv-stat[^"]*" data-cell="${k}" style="([^"]*)">(.*?)</div>`).exec(h());
    const sig = cell('swapsignal'), tim = cell('swaptimer');
    say('the default grid of a car that is due to swap has the swap signal across the top, in the colour of the signal (and no label), with who comes out and who steps in', !!sig && sig[1].startsWith('grid-column:1 / span 4;grid-row:1 / span 1;background:') && /<strong><span class="swsig"><b>SWAP<\/b><small>Alex \u2192 Sam<\/small>/.test(sig[2]) && !sig[2].includes('muted'));
    say('...and the swap timer says NOW, red, with its label (the swap rows are drawn because the car swaps: the signal is the first row, the timer the fifth)', !!tim && /background:#e03131/.test(tim[1]) && tim[2].includes('Swap timer') && tim[2].includes('<strong>NOW</strong>') && /grid-row:5 \/ span 1/.test(tim[1]) && /grid-row:1 \/ span 1/.test(sig[1]));
    run("state.settings.driverGrid = { cols: 2, rows: 1, boards: [{ c: 1, r: 1, w: 1, h: 1, opt: { cell: 'currentdriver', label: true } }, { c: 2, r: 1, w: 1, h: 1, opt: { cell: 'nextdriver', label: true } }] }"); run('LiveView.go')('rules'); run('LiveView.go')('driver'); await wait(80);
    const cd = cell('currentdriver'), nd = cell('nextdriver');
    say('the current driver and the next driver are cells too', !!cd && cd[2].includes('Current driver') && cd[2].includes('<strong>Alex</strong>') && !!nd && nd[2].includes('Next driver') && nd[2].includes('<strong>Sam</strong>'));
    run('state.settings.driverGrid = undefined'); run('LiveView.unmount')();
  }
  api.liveCommand({ type: 'swap', lane: 0 }); await wait(60);
  say('the Race Director page can press Swap done (the command swap with a lane)', eng().cars[0].driverName === 'Sam');
  await wait(250);
  say('...and the other screens are told who is at the wheel now', sent.dyn.cars[0].driverName === 'Sam' && sent.dyn.cars[0].driverId === 'd2' && sent.dyn.cars[0].en.swaps === 1);
  api.liveCommand({ type: 'swap', lane: 7 }); api.liveCommand({ type: 'swap', lane: -1 }); api.liveCommand({ type: 'swap' }); api.liveCommand({ type: 'swapnext', lane: 0, id: 'd2' }); await wait(60);
  say('a swap command for a lane without a car, or without a lane, does nothing; the next driver can not be chosen when the setup does not let the Race Director choose', eng().cars[0].driverName === 'Sam' && eng().cars[0].en.swaps === 1 && eng().cars[0].en.picked === false);
  { // 1.12.1: the Endurance folder of the Race Director page is brown, and comes last
    const host = document.createElement('div'); await run('LiveView.mount')(host, {}); run('LiveView.go')('director'); await wait(80);
    const html = E('lv-body').innerHTML, at = k => html.indexOf(`data-dirf="${k}"`), css = fs.readFileSync(path.join(R, 'renderer', 'styles.css'), 'utf8');
    say('the Race Director page of an Endurance Race has an Endurance folder, brown, after the Adjust and Penalties folders (it is the last folder)', at('endurance') > at('penalties') && at('penalties') > at('adjust') && html.includes('<details class="dbfolder dirfolder dir-brown" data-dirf="endurance" open><summary><strong>Endurance</strong>') && html.lastIndexOf('<details class="dbfolder dirfolder') === html.indexOf('<details class="dbfolder dirfolder dir-brown"'));
    say('...and the style sheet has the brown', /\.dir-brown\{--fc:#a8693a\}/.test(css));
    run('LiveView.unmount')();
  }
  key('s'); await wait(30);
  run('LiveView.unmount') && run('LiveView.unmount')();
  await until(() => phase() === 'finished', 5000); await wait(100);
  run('state.race = null; live = null'); saved.length = 0;

  // ---------- the Race Director chooses who steps in ----------
  await openRace(esetup({ swapNext: 'chosen', swapEvery: 1, laps: 3 }), store.tracks[0], [{ teamId: 'T4', carId: 'c1', driverId: 'd2' }, { teamId: 'T2', carId: 'c2', driverId: 'd3' }]);
  say('a team of three starts with the driver that was chosen on Home (Sam)', eng().cars[0].driverName === 'Sam' && eng().cars[0].roster.length === 3);
  key(' '); await until(() => phase() === 'running', 5000); await wait(60);
  await lapOn(0); await wait(60);
  say('the swap is due (every lap); the next in order would be Kim, but she drives the other car, so Lee is suggested', lookOf(0).state === 'due' && lookOf(0).next === 'd4' && lookOf(0).choices.find(x => x.id === 'd3').why === 'drives for another team now');
  api.liveCommand({ type: 'swapnext', lane: 0, id: 'd3' }); await wait(60);
  say('Kim drives the other car now, so she can not be picked', lookOf(0).next === 'd4' && lookOf(0).picked === false);
  api.liveCommand({ type: 'swapnext', lane: 0, id: 'd2' }); await wait(60);
  say('the driver at the wheel can not be picked either', lookOf(0).next === 'd4');
  api.liveCommand({ type: 'swap', lane: 0, to: 'd4' }); await wait(60);
  say('Swap done with the driver who steps in: Lee drives', eng().cars[0].driverName === 'Lee' && eng().cars[0].en.swaps === 1);
  key('s'); await until(() => phase() === 'finished', 5000); await wait(100);
  run('state.race = null; live = null'); saved.length = 0;

  // ---------- the confirmation: only the sensor, or only the button ----------
  await openRace(esetup({ swapConfirm: 'sensor', swapEvery: 1, laps: 3 }), store.tracks[0], eRows);
  key(' '); await until(() => phase() === 'running', 5000); await wait(60);
  await lapOn(0); await wait(60);
  await pressSwap(0); api.liveCommand({ type: 'swap', lane: 0 }); await wait(60);
  say('when only the sensor swaps, the button does nothing', eng().cars[0].driverName === 'Alex');
  key('s'); await until(() => phase() === 'finished', 5000); await wait(100);
  run('state.race = null; live = null'); saved.length = 0;
  await openRace(esetup({ swapConfirm: 'button', swapEvery: 1, laps: 3 }), store.tracks[0], eRows);
  key(' '); await until(() => phase() === 'running', 5000); await wait(60);
  await lapOn(0); await wait(60);
  run('live.pitBtns[0].b.onclick()'); await wait(400);
  say('when only the button swaps, standing on the sensor does nothing', eng().cars[0].driverName === 'Alex' && lookOf(0).state === 'due');
  run('live.pitBtns[0].b.onclick()');
  key('s'); await until(() => phase() === 'finished', 5000); await wait(100);
  run('state.race = null; live = null'); saved.length = 0;

  // ---------- a race that is not an Endurance Race is as it was ----------
  await openRace({ name: 'Plain', sessionType: 'race', laps: 2, endRule: 'all', layout: '' }, store.tracks[0], [{ driverId: 'd1', carId: 'c1' }, { driverId: 'd2', carId: 'c2' }]);
  say('a plain race has no swap panel', run('live.enPanel') === undefined);
  say('...and the cars have no swap state', eng().endurance === null && eng().cars.every(c => !c.en));
  key('s'); await until(() => phase() === 'finished', 5000); await wait(100);
  run('state.race = null; live = null'); saved.length = 0;

  // ---------- heat-based: every heat is an endurance race of its own ----------
  const hsetup = over => esetup({ enduranceBy: 'heats', heatBy: 'laps', laps: 4, heatPlan: 'manual', heats: 2, resultBy: 'laps', teamDriver: 'order', ...over });
  const plan2 = [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }], [{ p: 0, lane: 0 }, { p: 1, lane: 1 }]];
  const hdrivers = () => eng().cars.map(c => c.lane + ':' + c.teamName + ':' + c.driverName).join();
  const toLaps = async (lane, n) => { for (let k = 0; k < 12 && eng().cars[lane].laps.length < n; k++) await lapOn(lane); };
  const oldSnap = { v: 1, sentinel: true }; kept.snap = oldSnap; kept.saves = 0; kept.clears = 0; // (a race that was interrupted earlier and is still kept)
  await openRace(hsetup(), store.tracks[0], [{ teamId: 'T1', carId: 'c1' }, { teamId: 'T2', carId: 'c2' }], { byTeam: true, schedule: plan2 });
  say('a heat-based Endurance Race: the heat races the teams, each with the first driver of its roster, the roster in the car and the rules of the swaps', hdrivers() === '0:Red Bulls:Alex,1:Blue Moons:Kim' && eng().cars.every(c => c.en && c.roster.length === 2) && eng().endurance.every === 2 && E('enpanel').hidden === false);
  say('...the race screen says so', E('racehost').innerHTML.includes('Endurance Race on Living room') && E('racehost').innerHTML.includes('2 heats, each 4 laps, a swap every 2 laps'));
  key(' '); await until(() => phase() === 'running', 5000); await wait(60);
  await toLaps(0, 2); await wait(60);
  say('heat 1: the swap is due after 2 laps', lookOf(0).state === 'due');
  await pressSwap(0); await wait(30);
  await toLaps(0, 4); await toLaps(1, 4);
  await until(() => phase() === 'between', 6000);
  say('...the heat ends and the next one waits; the turn goes on from the driver who drove last (Red Bulls: after Sam it is Alex; Blue Moons: after Kim it is Lee)', phase() === 'between' && hdrivers() === '0:Red Bulls:Alex,1:Blue Moons:Lee');
  say('...the cars of the next heat are new ones with the roster and the rules again', eng().cars.every(c => c.en && c.en.stints.length === 1 && c.roster.length === 2));
  key(' '); await until(() => phase() === 'running', 5000); await wait(60);
  await toLaps(0, 4); await toLaps(1, 4);
  await until(() => phase() === 'finished', 6000); await wait(150);
  const hs = saved[0] && saved[0][0], hl = saved[0] && saved[0][1];
  say('the heat race is saved as an Endurance Race with its heats', saved.length === 1 && hs.sessionType === 'endurance' && hs.heatResults && hs.heatResults.length === 2);
  const hred = hs.standings.find(x => x.teamId === 'T1');
  say('...the first heat of Red Bulls says who drove (the team with the drivers in brackets) and their stints', hs.heatResults[0].rows.some(x => x.driverName === 'Red Bulls (Alex, Sam)' && x.by === 'Alex, Sam' && x.driverId === '' && x.stints.map(q => q.driverId).join() === 'd1,d2'));
  say('...the team is one row in the result, with every driver who drove for it (laps and time), and the stints of both heats', hred.asTeam === true && hred.laps === 8 && hred.drivers.map(d => d.driverId + ':' + d.laps).join() === 'd1:6,d2:2' && hred.drivers.every(d => d.ms >= 0) && hred.stints.map(q => q.heat + ':' + q.driverId).join() === '1:d1,1:d2,2:d1');
  say('...every lap is for the driver who drove it', hl.filter(l => l.teamId === 'T1' && l.heat === 1).sort((a, b) => a.lapNumber - b.lapNumber).map(l => l.driverId).join() === 'd1,d1,d2,d2' && hl.filter(l => l.teamId === 'T1' && l.heat === 2).every(l => l.driverId === 'd1' || l.driverId === 'd2'));
  say('a heat race keeps its state in the file too (1.24.0), takes the place of the race that was kept from an earlier interruption, and deletes the file when the heats are saved', kept.saves > 0 && kept.snap === null && kept.clears >= 1 && kept.snap !== oldSnap);
  kept.snap = null;
  run('state.race = null; live = null'); saved.length = 0;

  // ---------- the swap panel: what it shows ----------
  {
    const part = k => ({ dataset: { en: k }, hidden: false, disabled: false, textContent: '', className: '', innerHTML: '', value: '', closest: () => null });
    const fake = () => {
      const rowsOf = {}, rows2 = {};
      [0, 1, 2].forEach(l => { const r = { hidden: false, dataset: { lane: String(l) }, parts: {} }; ['team', 'driver', 'stint', 'chip', 'why', 'next', 'nextname', 'swap'].forEach(k => { r.parts[k] = part(k); r.parts[k].closest = () => r; }); r.querySelector = sel => r.parts[/data-en="(\w+)"/.exec(sel)[1]]; rowsOf[l] = r;
        const r2 = { hidden: false, parts: { totals: part('totals') } }; r2.querySelector = () => r2.parts.totals; rows2[l] = r2; });
      const info = part('info');
      const box = { hidden: true, innerHTML: '', querySelector: sel => (/tr\[data-lane="(\d+)"\]/.test(sel) ? rowsOf[/"(\d+)"/.exec(sel)[1]] : /tr\[data-lane2="(\d+)"\]/.test(sel) ? rows2[/"(\d+)"/.exec(sel)[1]] : info) };
      return { rowsOf, rows2, info, box };
    };
    const En = ctx.Endurance, mkEng = (over = {}, rost = true) => { const e = ctx.RaceEngine.createRace({ type: 'timed', duration: 600, endRule: 'all', endurance: En.clean({ sessionType: 'endurance', swapEvery: 30, swapWarn: 1, swapGrace: 30, ...over }),
      entries: [{ lane: 0, driverId: 'd1', driverName: 'Alex', teamName: 'Red Bulls', carId: 'c1', ...(rost ? { roster: [{ id: 'd1', name: 'Alex' }, { id: 'd2', name: 'Sam' }, { id: 'd3', name: 'Kim' }] } : {}) }, { lane: 1, driverId: 'd4', driverName: 'Lee', carId: 'c2' }] }); e.start(0); return e; };
    const min = m => m * 60000;
    { const { rowsOf, rows2, info, box } = fake(); let ph = 'running'; const E2 = mkEng(), sends = [];
      const panel = run('EndurancePanel').build(box, { eng: () => E2, lanes: [0, 1, 2], phase: () => ph, now: () => min(clock), send: (l, what, id) => sends.push([l, what, id]) });
      var clock = 5; E2.tick(min(5)); panel.update();
      say('the panel shows a row for the team that swaps, with its driver and how long he has been at the wheel; a lane with a car that does not swap, and a lane with no car, are hidden', box.hidden === false && rowsOf[0].hidden === false && rowsOf[1].hidden === true && rowsOf[2].hidden === true && rows2[1].hidden === true && rowsOf[0].parts.team.textContent === 'Red Bulls' && rowsOf[0].parts.driver.textContent === 'Alex' && rowsOf[0].parts.stint.textContent === '5:00 · 0 laps');
      say('...it says the rules, and how long it is to the swap (green), and who is next (in turn: no list to choose from)', info.textContent === 'a swap every 30 minutes' && rowsOf[0].parts.chip.textContent === 'Swap in 25:00' && rowsOf[0].parts.chip.className === 'enchip en-ok' && rowsOf[0].parts.nextname.textContent === 'Sam' && rowsOf[0].parts.next.hidden === true && rowsOf[0].parts.nextname.hidden === false);
      say('...the Swap done button is there, and says it is too early when the shortest stint is not over (none is set here, so not)', rowsOf[0].parts.swap.hidden === false && rowsOf[0].parts.swap.disabled === false && rowsOf[0].parts.swap.textContent === 'Swap done');
      say('...under the row: what every driver has driven so far', rows2[0].parts.totals.textContent === 'Driven: Alex 5:00 (now) · Sam 0:00 · Kim 0:00');
      clock = 29.5; E2.tick(min(29.5)); panel.update();
      say('half a minute before the swap the chip is amber and counts down', rowsOf[0].parts.chip.textContent === 'Swap in 0:30' && rowsOf[0].parts.chip.className === 'enchip en-soon');
      clock = 30.2; E2.tick(min(30.2)); panel.update();
      say('when the swap is due the chip says so in red, and why', rowsOf[0].parts.chip.textContent === 'SWAP NOW' && rowsOf[0].parts.chip.className === 'enchip en-due' && rowsOf[0].parts.why.textContent === 'the stint is over');
      clock = 31; E2.tick(min(31)); panel.update();
      say('when the team does not swap within the grace time it is late, and the chip says by how many seconds', rowsOf[0].parts.chip.textContent === 'SWAP NOW: 60 s late' && rowsOf[0].parts.chip.className === 'enchip en-overdue');
      rowsOf[0].parts.swap.disabled = false;
      box.onclick({ target: { closest: () => ({ disabled: false, dataset: { en: 'swap' }, blur() {}, closest: () => rowsOf[0] }) } });
      box.onclick({ target: { closest: () => ({ disabled: true, dataset: { en: 'swap' }, blur() {}, closest: () => rowsOf[0] }) } }); box.onclick({ target: { closest: () => null } }); box.onclick({ target: {} });
      say('a press on Swap done says which lane (a button that is off, and a click on something else, do nothing); with no list to choose from, no driver is named', same_(sends, [[0, 'swap', undefined]]));
      ph = 'finished'; panel.update();
      say('when the race is over the button is off', rowsOf[0].parts.swap.disabled === true);
    }
    { const { rowsOf, box } = fake(), sends = []; var clock2 = 31; const E2 = mkEng({ swapNext: 'chosen', stintMin: 10, swapMode: 'free', stintMax: 40, totalMax: 0 }); E2.tick(min(5));
      const panel = run('EndurancePanel').build(box, { eng: () => E2, lanes: [0, 1], phase: () => 'running', now: () => min(5), send: (l, what, id) => sends.push([l, what, id]) }); panel.update();
      say('free swapping: before the shortest stint the chip says from when, and the button says the swap is too early', rowsOf[0].parts.chip.textContent === 'Swap from 5:00' && rowsOf[0].parts.swap.textContent === 'Swap done (too early)');
      say('...the Race Director chooses: a list with the drivers of the team (the one at the wheel can not be chosen), the one in turn selected', rowsOf[0].parts.next.hidden === false && rowsOf[0].parts.nextname.hidden === true && rowsOf[0].parts.next.innerHTML.includes('<option value="d2">Sam</option>') && rowsOf[0].parts.next.innerHTML.includes('<option value="d1" disabled>Alex (is at the wheel)</option>') && rowsOf[0].parts.next.value === 'd2');
      rowsOf[0].parts.next.value = 'd3';
      box.onchange({ target: { dataset: { en: 'next' }, value: 'd3', closest: () => rowsOf[0] } }); box.onchange({ target: { dataset: { en: 'swap' }, value: 'x', closest: () => rowsOf[0] } }); box.onchange({ target: {} });
      rowsOf[0].parts.swap.hidden = false;
      box.onclick({ target: { closest: () => ({ disabled: false, dataset: { en: 'swap' }, blur() {}, closest: () => rowsOf[0] }) } });
      say('choosing a driver in the list tells the race who is next (only that list), and Swap done names the driver in the list', same_(sends, [[0, 'next', 'd3'], [0, 'swap', 'd3']]));
    }
    { const { rowsOf, box } = fake(); const E2 = mkEng({ swapConfirm: 'sensor' }); E2.tick(min(5));
      const panel = run('EndurancePanel').build(box, { eng: () => E2, lanes: [0, 1], phase: () => 'running', now: () => min(5), send: () => {} }); panel.update();
      say('when only the sensor swaps, there is no Swap done button', rowsOf[0].parts.swap.hidden === true); }
    { const { box } = fake(); const panel = run('EndurancePanel').build(box, { eng: () => null, lanes: [0], phase: () => 'running', now: () => 0, send: () => {} }); panel.update();
      say('with no engine, or a race without swaps, the panel is hidden', box.hidden === true);
      const none = fake(); const plain = ctx.RaceEngine.createRace({ type: 'race', laps: 5, entries: [{ lane: 0, driverId: 'd1', driverName: 'Alex', carId: 'c1' }] }); plain.start(0);
      run('EndurancePanel').build(none.box, { eng: () => plain, lanes: [0], phase: () => 'running', now: () => 0, send: () => {} }).update();
      say('...and so is it with an engine that has no rules', none.box.hidden === true); }
  }

  // ---------- a race that was interrupted (a crash, a power cut) ----------
  { saved.length = 0; kept.snap = null; kept.saves = 0; kept.clears = 0;
    const setupR = esetup({ swapEvery: 2, laps: 6 });
    await openRace(setupR, store.tracks[0], eRows);
    say('nothing is kept before the race starts', kept.saves === 0 && kept.snap === null);
    key(' '); await until(() => phase() === 'running', 5000); await wait(60);
    await lapOn(0); await lapOn(0); await lapOn(1); await wait(60);
    await pressSwap(0); await wait(30); await lapOn(0); await wait(120);
    { const n0 = kept.saves; await wait(1000); const n = kept.saves - n0;
      say('...it is written every now and then (not at every tick of the clock): a few times a second at the test speed, when nothing happens', n >= 3 && n <= 12); }
    { run('live.alive = false'); const n0 = kept.saves; await wait(300);
      say('...and not any more once the race screen is left (the race is not alive)', kept.saves === n0); run('live.alive = true'); }
    const snap = kept.snap;
    say('while the race runs, a snapshot of it is kept: the race setup, the track, the lanes, the clock and the engine', kept.saves > 2 && snap && snap.v === 1 && snap.name === 'Day race' && snap.kind === 'Endurance Race' && snap.trackName === 'Living room' && snap.race.setup.name === 'Day race' && snap.race.track.id === 't1' && same_(snap.race.rows, eRows) && snap.elapsed > 0 && snap.phase === 'running' && typeof snap.savedAt === 'string');
    say('...it has the laps, and who is at the wheel (Sam, after the swap) and the swap state', snap.eng.cars[0].laps.length === 3 && snap.eng.cars[1].laps.length === 1 && snap.eng.cars[0].driverId === 'd2' && snap.eng.cars[0].en.swaps === 1 && snap.eng.status === 'running');
    say('...it is plain text, small, and has no pictures in it (a team picture or a track picture is not written again every few seconds)', JSON.stringify(snap).length < 20000 && !JSON.stringify(snap).includes('base64'));
    const before = eng().cars.map(c => c.laps.slice()), elapsed0 = eng().elapsed(nowMs());
    // the app is gone (what is running stops with it) and starts again later
    run('clearInterval(live.timers); live.sim.forEach(clearTimeout); live.alive = false; state.race = null; live = null'); await wait(30);
    await wait(150);
    await openRace(setupR, store.tracks[0], eRows, { resume: snap });
    say('the race is back, paused', phase() === 'paused' && eng().status === 'paused' && run('live.cpOff') !== true);
    say('...the laps, the driver at the wheel (Sam) and the swaps are back', same_(eng().cars.map(c => c.laps), before) && eng().cars[0].driverName === 'Sam' && eng().cars[0].driverId === 'd2' && eng().cars[0].en.swaps === 1 && eng().cars[1].driverName === 'Kim');
    say('...the race clock stands where it was at the last snapshot, and does not run while it waits', Math.abs(eng().elapsed(nowMs()) - snap.elapsed) < 1 && eng().elapsed(nowMs() + 5000) === eng().elapsed(nowMs()) && Math.abs(snap.elapsed - elapsed0) < 5000);
    say('...the swap panel and the widgets show the race (the swap state is there)', E('enpanel').hidden === false && lookOf(0).driver === 'd2' && lookOf(0).state === 'soon');
    say('...the other screens are told (the race window shares it again)', sent.stat && sent.stat.cfg.endurance && sent.dyn && sent.dyn.cars[0].driverName === 'Sam');
    key(' '); await wait(60);
    say('Space carries on', phase() === 'running' && eng().status === 'running');
    const n0 = eng().cars[0].laps.length; await wait(300); await lapOn(0);
    say('the first lap after the restart counts, but it is not counted for records (too slow), and the driver is the one at the wheel', eng().cars[0].laps.length === n0 + 1 && eng().cars[0].bad[n0] === true && eng().cars[0].driverId === 'd2');
    await wait(200); await lapOn(0);
    say('...the next lap is a normal lap', eng().cars[0].bad[n0 + 1] === false && eng().cars[0].best !== null);
    for (let n = 0; n < 10 && eng().cars[0].laps.length < 6; n++) await lapOn(0);
    for (let n = 0; n < 10 && eng().cars[1].laps.length < 6; n++) await lapOn(1);
    await until(() => phase() === 'finished', 5000); await wait(150);
    const s2 = saved[0] && saved[0][0], l2 = saved[0] && saved[0][1];
    say('the finished race is saved once, with the laps from before and after the interruption', saved.length === 1 && s2.sessionType === 'endurance' && l2.filter(l => l.teamId === 'T1').length === 6 && l2.filter(l => l.teamId === 'T2').length === 6);
    say('...it says that it was continued once, and the lap after the restart is not a record lap', s2.resumed === 1 && l2.filter(l => l.tooSlow && l.noTrackRecord).length === 2);
    say('...the stints of the team go on over the interruption (Alex, Sam, ...), Sam drove the laps from before and after it', s2.standings.find(x => x.teamId === 'T1').stints.slice(0, 2).map(q => q.driverId).join() === 'd1,d2' && l2.filter(l => l.teamId === 'T1' && l.lapNumber > 2 && l.lapNumber <= 4).every(l => l.driverId === 'd2'));
    say('...and the snapshot is deleted once the result is saved (and not written again)', kept.snap === null && kept.clears >= 1);
    const saves = kept.saves; await wait(200); say('...nothing is written after that', kept.saves === saves && kept.snap === null);
    run('state.race = null; live = null'); saved.length = 0;

    // "Save what was recorded": the race comes back as finished, for the review
    await openRace(setupR, store.tracks[0], eRows, { resume: { ...snap, stopNow: true } });
    await until(() => saved.length === 1, 3000); await wait(100);
    say('"Save what was recorded" ends the race where it was (Stopped) and saves what it recorded', saved.length === 1 && saved[0][0].endedBy === 'Stopped' && saved[0][0].resumed === 1 && saved[0][1].filter(l => l.teamId === 'T1').length === 3 && saved[0][1].filter(l => l.teamId === 'T2').length === 1);
    say('...the snapshot is gone', kept.snap === null);
    run('state.race = null; live = null'); saved.length = 0;

    // a snapshot of a race that does not fit the setup
    await openRace(setupR, store.tracks[0], eRows.slice(0, 1), { resume: snap });
    say('a snapshot that does not fit the race (other lanes) starts nothing, and nothing is kept for it', phase() === 'ready' && eng().cars.length === 1 && run('live.cpOff') === true);
    run('state.race = null; live = null'); saved.length = 0;

    // pictures are not written again and again
    kept.snap = null;
    await openRace({ ...setupR, picture: 'data:image/png;base64,' + 'A'.repeat(3000), exact: 'x'.repeat(2000), over: 'y'.repeat(2001), small: 'ok' }, { ...store.tracks[0], picture: 'z'.repeat(5000) }, eRows);
    key(' '); await until(() => phase() === 'running', 5000); await wait(250);
    say('the snapshot has no pictures: a text of more than 2000 characters in the setup or the track is left out; a text of exactly 2000 and the short ones stay', kept.snap && kept.snap.race.setup.small === 'ok' && kept.snap.race.setup.exact.length === 2000 && !('over' in kept.snap.race.setup) && !('picture' in kept.snap.race.setup) && !('picture' in kept.snap.race.track) && kept.snap.race.track.name === 'Living room' && kept.snap.race.setup.name === 'Day race');
    run('clearInterval(live.timers); live.sim.forEach(clearTimeout); live.alive = false; state.race = null; live = null'); await wait(100);
    // an app window without the file calls (it never had them) races as before
    { const sv = api.saveResume, cl = api.clearResume, gt = api.getResume; delete api.saveResume; delete api.clearResume; delete api.getResume; saved.length = 0; kept.snap = null; kept.saves = 0;
      await openRace(setupR, store.tracks[0], eRows);
      key(' '); await until(() => phase() === 'running', 5000); await wait(60);
      for (let n = 0; n < 12 && eng().cars[0].laps.length < 6; n++) await lapOn(0);
      for (let n = 0; n < 12 && eng().cars[1].laps.length < 6; n++) await lapOn(1);
      await until(() => phase() === 'finished', 5000); await wait(150);
      say('without the calls of the file the race goes on as before: it runs, it is saved, and nothing is written', saved.length === 1 && saved[0][0].resumed === undefined && kept.snap === null && kept.saves === 0);
      run("state.tab = 'home'; state.race = null; live = null"); await run('render()'); await wait(40);
      say('...and the Home tab has no note about an interrupted race (and no error)', !E('view').innerHTML.includes('A race was interrupted'));
      api.saveResume = sv; api.clearResume = cl; api.getResume = gt; saved.length = 0; }
    // a snapshot that can not be sent (the file call throws at once, like "An object could not be cloned") never stops the race
    { const sv = api.saveResume; let calls = 0; api.saveResume = () => { calls++; throw new DOMException('An object could not be cloned.', 'DataCloneError'); }; saved.length = 0; kept.snap = null; kept.saves = 0;
      await openRace(setupR, store.tracks[0], eRows);
      key(' '); await until(() => phase() === 'running', 5000); await wait(60);
      for (let n = 0; n < 12 && eng().cars[0].laps.length < 6; n++) await lapOn(0);
      for (let n = 0; n < 12 && eng().cars[1].laps.length < 6; n++) await lapOn(1);
      await until(() => phase() === 'finished', 5000); await wait(150);
      say('when the snapshot can not be sent, the race still runs to the end and is saved (the failure is not an error of the race screen)', calls > 0 && saved.length === 1);
      api.saveResume = sv; saved.length = 0; kept.snap = null; }
    // the Home tab
    const homeView = async () => { run("state.tab = 'home'; state.race = null; live = null"); await run('render()'); await wait(40); return E('view').innerHTML.replace(/&quot;/g, '"'); };
    const click = async b => { await E('view').onclick({ target: { closest: sel => (sel === 'button' ? { dataset: {}, ...b } : null) } }); await wait(40); };
    store.racesetups = [{ id: 'es1', ...setupR, track: 't1' }];
    kept.snap = null; let hv = await homeView();
    say('with nothing kept, the Home tab has no note about an interrupted race', !hv.includes('A race was interrupted') && !hv.includes('resumego'));
    kept.snap = snap; hv = await homeView();
    say('with a race kept, the Home tab says so: the name, the kind of race, the track, how far it was, and three buttons', hv.includes('A race was interrupted') && hv.includes('<strong>Day race</strong> · Endurance Race on Living room') && hv.includes('into the race when it was saved') && ['resumego', 'resumesave', 'resumedrop'].every(id => hv.includes('id="' + id + '"')) && hv.includes('Resume the race') && hv.includes('Save what was recorded') && hv.includes('Delete it'));
    say('...it is above the Start a race card', hv.indexOf('A race was interrupted') < hv.indexOf('Start a race'));
    { const bare = { ...snap }; delete bare.kind; delete bare.trackName; kept.snap = bare; hv = await homeView();
      say('a race kept without a kind or a track is told with its name only (no dangling "on")', hv.includes('<strong>Day race</strong>.') && !hv.includes('<strong>Day race</strong> ·') && !hv.includes('</strong> on '));
      kept.snap = snap; hv = await homeView();
      run("state.race = null; live = { phase: 'running' }"); await click({ id: 'resumego' });
      say('while another race is running, Resume the race does nothing (one race at a time)', run('state.race') === null && run('state.tab') === 'home');
      await click({ id: 'resumesave' });
      say('...and neither does Save what was recorded', run('state.race') === null && run('state.tab') === 'home');
      run('live = null'); }
    await click({ id: 'resumego' });
    const st = JSON.parse(run('JSON.stringify(state.race)'));
    say('Resume the race opens the Race tab with the saved race (setup, track, lanes) and the snapshot', run('state.tab') === 'race' && st.setup.name === 'Day race' && st.track.id === 't1' && same_(st.rows, eRows) && st.resume.eng.cars[0].laps.length === 3 && !st.resume.stopNow);
    await wait(100); say('...and the race is there, paused', phase() === 'paused' && eng().cars[0].laps.length === 3);
    run('clearInterval(live.timers); live.alive = false; state.race = null; live = null'); await wait(50);
    kept.snap = snap; hv = await homeView(); saved.length = 0; run('state.autoFinalize = true');
    await click({ id: 'resumesave' });
    say('Save what was recorded opens the race to be closed and checked', JSON.parse(run('JSON.stringify(state.race)')).resume.stopNow === true);
    await until(() => saved.length === 1, 3000); await wait(100);
    run('state.race = null; live = null'); saved.length = 0;
    kept.snap = snap; kept.clears = 0; hv = await homeView(); await click({ id: 'resumedrop' }); hv = E('view').innerHTML;
    say('Delete it asks, deletes the snapshot and takes the note away', kept.snap === null && kept.clears === 1 && !hv.includes('A race was interrupted'));
    kept.snap = snap; ctx.confirm = () => false; hv = await homeView(); await click({ id: 'resumedrop' }); ctx.confirm = () => true;
    say('...when the answer is no, the snapshot stays', kept.snap !== null && E('view').innerHTML.includes('A race was interrupted'));
    kept.snap = null;
    run('state.race = null; live = null'); saved.length = 0;
  }

  // ---------- the results of an Endurance Race ----------
  { const sub = async x => { run(`state.settings = { theme: 'dark' }; state.tab = 'database'; state.sub = '${x}'`); await run('render()'); await wait(30); };
    store.tracks = [{ id: 't1', name: 'Living room', lanes: 2 }];
    const standings = [{ pos: 1, asTeam: true, driverId: '', driverName: 'Red Bulls', teamId: 'T1', teamName: 'Red Bulls', carId: 'c1', carName: 'Car1', laps: 6, points: 0, best: 4800, total: 31000, swaps: 2, swapLost: 1, short: [{ driverId: 'd2', driverName: 'Sam', laps: 1, ms: 5000 }],
      drivers: [{ driverId: 'd1', driverName: 'Alex', laps: 4, ms: 20000 }, { driverId: 'd2', driverName: 'Sam', laps: 1, ms: 5000 }],
      stints: [{ driverId: 'd1', driverName: 'Alex', laps: 2, ms: 10000, from: 0, to: 10000, by: 'sensor' }, { driverId: 'd2', driverName: 'Sam', laps: 1, ms: 5000, from: 10000, to: 15000, by: 'button' }, { driverId: 'd1', driverName: 'Alex', laps: 2, ms: 10000, from: 15000, to: 25000, by: 'sensor' }] },
      { pos: 2, asTeam: true, driverId: '', driverName: 'Blue Moons', teamId: 'T2', teamName: 'Blue Moons', carId: 'c2', carName: 'Car2', laps: 5, points: 0, best: 5000, total: 33000, swaps: 1, drivers: [{ driverId: 'd3', driverName: 'Kim', laps: 3, ms: 3700000 }], stints: [{ driverId: 'd3', driverName: 'Kim', laps: 3, ms: 3700000, from: 0, to: 3700000 }] }];
    store.sessions = [{ id: 'S1', setupName: 'Day race', sessionType: 'endurance', trackId: 't1', trackName: 'Living room', date: '2026-10-16T10:00:00.000Z', endedBy: 'Time up', resumed: 1, standings },
      { id: 'S2', setupName: 'Day heats', sessionType: 'endurance', trackId: 't1', trackName: 'Living room', date: '2026-10-16T11:00:00.000Z', resultBy: 'laps', endedBy: '',
        standings: [{ pos: 1, asTeam: true, driverId: '', driverName: 'Red Bulls', teamId: 'T1', teamName: 'Red Bulls', carId: 'c1', carName: 'Car1', laps: 8, points: 0, best: 4800, total: null, drivers: [{ driverId: 'd1', driverName: 'Alex', laps: 5, ms: 30000 }, { driverId: 'd2', driverName: 'Sam', laps: 3, ms: 20000 }], stints: [{ driverId: 'd1', driverName: 'Alex', laps: 5, ms: 30000, heat: 1 }, { driverId: 'd2', driverName: 'Sam', laps: 3, ms: 20000, heat: 2 }] }],
        heatResults: [{ heat: 1, rows: [{ participant: 0, pos: 1, laps: 5, driverName: 'Red Bulls (Alex)', by: 'Alex', teamId: 'T1', points: 0, best: 4800 }] }, { heat: 2, rows: [{ participant: 0, pos: 1, laps: 3, driverName: 'Red Bulls (Sam)', by: 'Sam', teamId: 'T1', points: 0, best: 5000 }] }] }];
    store.laps = [{ id: 'l1', sessionId: 'S1', driverId: 'd1', teamId: 'T1', carId: 'c1', trackId: 't1', lapNumber: 1, time: 4800 }, { id: 'l2', sessionId: 'S1', driverId: 'd2', teamId: 'T1', carId: 'c1', trackId: 't1', lapNumber: 2, time: 5200 }, { id: 'l3', sessionId: 'S1', driverId: 'd3', teamId: 'T2', carId: 'c2', trackId: 't1', lapNumber: 1, time: 5000 }];
    await sub('results'); await wait(40);
    const html = E('resbody').innerHTML;
    say('the Results page of an Endurance Race: the session type is named, and the first team has the cup (an Endurance Race has a winner)', html.includes('Endurance Race') && /Winner: [^<]*<svg[^>]*>[\s\S]*?<\/svg> Red Bulls/.test(html));
    say('...every driver of a team has the laps and the time at the wheel (Alex 4 laps, 0:20; Kim 3 laps, 1:01:40)', html.includes('Alex (4 laps, 0:20), Sam (1 lap, 0:05)') && html.includes('Kim (3 laps, 1:01:40)'));
    say('...the row says the swaps, the lap that did not count, and who drove too little', html.includes('2 swaps; 1 lap not counted for swaps that were not made; drove too little: Sam (1 lap, 0:05)') && html.includes('(1 swap)'));
    say('...a race that was carried on after an interruption says so under its result', html.includes('<p class="muted">This race was interrupted and carried on. The first lap of every car after it is not counted for records.</p>') && (html.match(/was interrupted and carried on/g) || []).length === 1);
    say('...a part Driver swaps lists the stints of every team in order, with the race clock', html.includes('<h4>Driver swaps</h4>') && html.includes('1. Alex, 0:00 to 0:10, 2 laps (0:10) · 2. Sam, 0:10 to 0:15, 1 lap (0:05) · 3. Alex, 0:15 to 0:25, 2 laps (0:10)'));
    say('...a heat-based Endurance Race is read as heats: the heats are listed, and its stints say the heat', html.includes('<h4>Heats</h4>') && html.includes('Heat 1, Alex, 5 laps (0:30)') && html.includes('Heat 2, Sam, 3 laps (0:20)') && html.includes('Red Bulls (Alex) (5 laps'));
    say('...each of the two sessions has its own part Driver swaps, and nothing else does', (html.match(/Driver swaps<\/h4>/g) || []).length === 2);
  }

  reachedEnd = true;
  console.log(fails ? fails + ' ENDURANCE SCREEN TESTS FAILED' : 'ALL ENDURANCE SCREEN TESTS PASSED'); process.exit(fails ? 1 : 0);
})();
