// 1.58.0: the Start a race card on the Home tab (Option A of the redesign): the name of the race setup as the title with its facts as pills (the kind, laps or minutes, the track, the lanes),
// the lanes as dark rows in the colour of the lane with a number, the choices and a tick, what a row still needs said inside that row (and not again in the list under the rows),
// and one pill that says whether the race can start, against a stand-in for the app window.
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
for (const f of ['listnum.js', 'bop.js', 'weather.js', 'tyrewear.js', 'safetycar.js', 'pushsave.js', 'racelimit.js', 'endurance.js', 'failures.js', 'damage.js', 'engine.js', 'heats.js', 'rotation.js', 'championship.js', 'champpoints.js', 'season.js', 'tokens.js', 'speed.js', 'distance.js','stats.js','homestats.js','carstats.js','viewset.js','picture.js','uiscale.js','depth.js','theme.js','banner.js', 'icons.js', 'delta.js','avatars.js', 'picmemo.js', 'weatherwidgets.js', 'tyrewidgets.js', 'pacewidgets.js', 'boardorder.js', 'widgets.js', 'frame.js', 'backdrop.js','announcer.js','sound.js', 'timing.js', 'rows.js', 'richtext.js', 'report.js', 'canvas.js', 'liveshare.js', 'review.js', 'adjustpad.js', 'adjustui.js', 'dirfolder.js', 'penaltyui.js', 'rotationdrag.js','padui.js','livegrid.js', 'homegrid.js', 'drivergrid.js', 'homecards.js', 'liveview.js', 'setupwords.js', 'database.js', 'landing.js', 'race.js', 'undo.js', 'editor.js','tokenui.js', 'bopui.js', 'enduranceui.js', 'weatherui.js', 'tyreui.js', 'pushsaveui.js', 'rotationui.js', 'championshipui.js', 'audioedit.js','widgetbuilder.js','transferui.js','themeui.js','hardware.js','trackmate.js','hardwareui.js', 'dsui.js', 'app.js']) vm.runInContext(fs.readFileSync(R + 'renderer/' + f, 'utf8'), ctx, { filename: f });

const run = s => vm.runInContext(s, ctx), E = id => document.getElementById(id);
const say = (m, c) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const count = (h, s) => h.split(s).length - 1;

(async () => {
  await wait(50);
  store.tracks = [{ id: 't1', name: 'Living room', lanes: 2 }, { id: 't4', name: 'Big track', lanes: 4 }, { id: 't5', name: 'Oval', lanes: 1 }];
  store.drivers = ['Alex', 'Sam', 'Kim', 'Lee'].map((n, i) => ({ id: 'd' + (i + 1), name: n }));
  store.slotcars = [1, 2, 3, 4].map(i => ({ id: 'c' + i, brand: 'Car' + i }));
  store.teams = [{ id: 'T1', name: 'Red Bulls', drivers: ['d1', 'd2'] }, { id: 'T2', name: 'Blue Moons', drivers: ['d3', 'd4'] }];
  const rsetup = over => ({ id: 'rs1', name: 'GP Sprint', sessionType: 'race', raceBy: 'laps', laps: 20, track: 't1', ...over });
  const two = [{ driverId: 'd1', carId: 'c1' }, { driverId: 'd2', carId: 'c2' }];
  const home = async (over = {}, asg = two, rec = null) => {
    store.racesetups = over === null ? [] : [rsetup(over)]; store.rotationsetups = rec ? [rec] : [];
    run("state.settings.lastSetupId = 'rs1'; state.settings.assignments = " + JSON.stringify({ rs1: asg }) + "; state.settings.heatEdits = {}; state.settings.heatSeeds = { rs1: 5 }; state.tab = 'home'; state.race = null; state.rotMsg = null; live = null");
    await run('render()'); await wait(30); return E('view').innerHTML.replace(/&quot;/g, '"');
  };
  const rowsOf = h => h.split('data-row="').slice(1);
  const chipsOf = h => { const m = /<div class="hs-chips">(.*?)<\/div><\/div><\/div>/.exec(h.replace(/\n\s*/g, '')); return m ? m[1] : ''; };

  // ---------- the title and the pills ----------
  let h = await home();
  const card = h.slice(h.indexOf('id="hmc-start"'));
  say('the card starts with the name of the race setup as its title: the words "Start a race" label the choice, which is a select with a name for screen readers', card.includes('<label class="hs-label" for="setup">Start a race</label>') && card.includes('<select id="setup" aria-label="Race setup">') && !card.includes('<h3>Start a race</h3>') && !card.includes('<label for="setup">Race setup</label>'));
  say('...the pills under it: the kind of session (in bold: "Race by laps or distance" is just "Race" here), how long, the track and the number of lanes', chipsOf(h) === '<span class="hs-chip hs-type"><b>Race</b></span><span class="hs-chip">20 laps</span><span class="hs-chip">' + run("Icons.svg('pin', { size: 14 })") + 'Living room</span><span class="hs-chip">2 lanes</span>');
  h = await home({ laps: 1 });
  say('...one lap is "1 lap", not "1 laps"', chipsOf(h).includes('<span class="hs-chip">1 lap</span>') && !chipsOf(h).includes('1 laps'));
  h = await home({ sessionType: 'timed', duration: 15 });
  say('...a timed session says its minutes, a qualifying too', chipsOf(h).includes('<span class="hs-chip">15 min</span>') && !/ laps?</.test(chipsOf(h)) && (await home({ sessionType: 'qualifying', duration: 8 })).includes('<span class="hs-chip">8 min</span>'));
  say('...a timed session with no minutes has no length pill (not "0 min")', !/<span class="hs-chip">\d+ (laps?|min)<\/span>/.test(chipsOf(await home({ sessionType: 'timed', duration: 0 }))));
  h = await home({ raceBy: 'time', laps: 20, duration: 12 });
  say('...a race limited by a time says its minutes, not the laps (1.62.0)', chipsOf(h).includes('<span class="hs-chip">12 min</span>') && !/ laps?</.test(chipsOf(h)) && chipsOf(h).includes('<b>Race</b>'));
  say('...a race that is limited by a distance says no length (it is not one number), and a race with no laps has no length pill', !/<span class="hs-chip">\d+ (laps?|min)<\/span>/.test(chipsOf(await home({ raceBy: 'distance', laps: 20, distance: 100 }))) && !/<span class="hs-chip">\d+ (laps?|min)<\/span>/.test(await home({ laps: 0 })));
  h = await home({ track: 't5' }, [two[0]]);
  say('...one lane is "1 lane"', chipsOf(h).includes('Oval</span><span class="hs-chip">1 lane</span>') && !chipsOf(h).includes('1 lanes'));
  h = await home({ track: '' });
  say('...a setup with no track has no track pill and no lanes pill, and says so under the rows', !chipsOf(h).includes('pin') && !chipsOf(h).includes('lane</span>') && !chipsOf(h).includes('lanes</span>') && h.includes('This race setup has no track. Choose one in Race Setup.'));

  // ---------- the rows ----------
  h = await home();
  const rs = rowsOf(h);
  say('every lane is a row in the colour of its lane (the first two: red and blue) with its number in a circle that tells screen readers "Lane 1"', rs.length === 2 && rs[0].startsWith('0" style="--c:#e5484d"') && rs[1].startsWith('1" style="--c:#3b82f6"') && rs[0].includes('<strong class="hs-num"') && rs[0].includes('title="Lane 1"') && rs[0].includes('<span class="hs-vh">Lane 1</span><span aria-hidden="true">1</span>') && rs[1].includes('<span class="hs-vh">Lane 2</span><span aria-hidden="true">2</span>'));
  say('...the number is written in the colour that reads best on the lane (the same choice as on the buttons of the race screen): white on red, dark on yellow', rs[0].includes('style="--on:' + run("AdjustPad.textOn('#e5484d')") + '"') && rs[1].includes('style="--on:' + run("AdjustPad.textOn('#3b82f6')") + '"') && run("AdjustPad.textOn('#f5c211')") === '#111418');
  h = await home({ track: 't4' }, [...two, { driverId: 'd3', carId: 'c3' }, { driverId: 'd4', carId: 'c4' }]);
  say('...the third lane (yellow) has a dark number, the fourth (green) the colour that AdjustPad gives it', rowsOf(h)[2].includes('<strong class="hs-num" style="--on:#111418"') && rowsOf(h)[3].includes('<strong class="hs-num" style="--on:' + run("AdjustPad.textOn('#3ecf8e')") + '"'));
  h = await home();
  say('...the driver and the car each sit in a box with a little picture in front (a helmet, a car) and an arrow behind', count(rowsOf(h)[0], '<div class="hs-sel">') === 2 && rowsOf(h)[0].includes('class="hs-sico"') && rowsOf(h)[0].includes(run("Icons.svg('driver', { size: 17 })")) && rowsOf(h)[0].includes(run("Icons.svg('car', { size: 22 })")) && count(rowsOf(h)[0], 'class="hs-chev"') === 2);
  say('...the choices keep their names and what they say for the screen: the driver and the car of the row, with the value that was assigned', /<select data-k="driverId" aria-label="Driver for row 1">.*?<option value="d1" selected>Alex<\/option>/.test(rowsOf(h)[0].replace(/\n\s*/g, '')) && /<select data-k="carId" aria-label="Car for row 2">.*?<option value="c2" selected>Car2<\/option>/.test(rowsOf(h)[1].replace(/\n\s*/g, '')));
  say('...the line under the title says what to do: pick who drives what', h.includes('<span class="hs-label hs-muted">Lanes</span><span class="muted">Pick who drives what.</span>'));

  // ---------- ready, or not ----------
  say('when every lane is filled in each row has a green tick that says "Ready", nothing is marked as needed, and there is no list of problems', count(h, 'hs-tick ok') === 2 && count(h, 'aria-label="Ready"') === 2 && !h.includes('hs-tick warn') && !/class="lane[^"]*\bneed\b/.test(h) && !h.includes('<ul class="issues">') && !h.includes('hs-why'));
  say('...the pill under the rows says so in the green way, with a lamp in the colour of each lane, and the race can start', h.includes('<div class="hs-status ok" role="status">') && h.includes('<span class="hm-ready">All 2 lanes are ready.</span>') && count(h, '<i class="on" style="--c:#') === 2 && !/id="start" disabled/.test(h) && h.includes('<span>Start race</span>'));
  h = await home({}, [two[0], { driverId: '', carId: 'c2' }]);
  const rm = rowsOf(h);
  say('a lane with no driver: that row is marked as needed with an amber tick that says "Not ready yet", and it says what it needs inside the row', /^1" class=|^1"/.test(rm[1]) && /<div class="lane need" data-row="1"/.test(h) && rm[1].includes('hs-tick warn') && rm[1].includes('aria-label="Not ready yet"') && rm[1].includes('<span class="hs-why">Lane 2 needs a driver and a car.</span>') && !rm[0].includes('hs-why') && rm[0].includes('hs-tick ok'));
  say('...the tick of a lane that is ready is a check mark and the one of a lane that is not is an exclamation mark (not told by colour alone)', rm[0].includes(run("Icons.svg('check', { size: 13, stroke: 2.6 })")) && rm[1].includes(run("Icons.svg('alert', { size: 13, stroke: 2.6 })")) && !rm[1].includes(run("Icons.svg('check', { size: 13, stroke: 2.6 })")));
  say('...the same sentence is not said again in the list under the rows (there is no list), yet Start is off', count(h, 'Lane 2 needs a driver and a car.') === 1 && !h.includes('<ul class="issues">') && /id="start" disabled/.test(h));
  say('...the pill is in the amber way and counts: "1 of 2 lanes is ready." with the lamp of the first lane lit and the one of the second lane out', h.includes('<div class="hs-status warn" role="status">') && h.includes('<span class="hm-ready">1 of 2 lanes is ready.</span>') && count(h, '<i class="on" style="--c:#') === 1 && h.includes('<i style="--c:#3b82f6"></i>'));
  h = await home({}, [{ driverId: 'd1', carId: 'c1' }, { driverId: 'd1', carId: 'c2' }]);
  say('a problem that is not about one row (a driver on two lanes) stays in the list under the rows; both rows are filled in, so both have a tick, and nothing is marked as needed', h.includes('<ul class="issues"><li>A driver is used more than once.</li></ul>') && count(h, 'hs-tick ok') === 2 && !/class="lane[^"]*\bneed\b/.test(h) && !h.includes('hs-why'));
  say('...and the pill does not say "ready" (the race can not start): the lanes are "filled in", the pill is amber, Start is off', h.includes('<div class="hs-status warn" role="status">') && h.includes('<span class="hm-ready">All 2 lanes are filled in.</span>') && /id="start" disabled/.test(h));
  h = await home({ track: 't4' }, [{ driverId: 'd1', carId: 'c1' }, { driverId: 'd1', carId: 'c2' }, { driverId: '', carId: 'c3' }, { driverId: 'd4', carId: 'c4' }]);
  say('a lane that needs something and a problem of the whole grid together: the lane says its own, the list has the other one only', h.includes('<span class="hs-why">Lane 3 needs a driver and a car.</span>') && h.includes('<ul class="issues"><li>A driver is used more than once.</li></ul>') && count(h, 'Lane 3 needs a driver and a car.') === 1);
  say('...three of the four lanes are filled in', h.includes('<span class="hm-ready">3 of 4 lanes are ready.</span>') && count(h, 'hs-tick ok') === 3 && count(h, 'hs-tick warn') === 1);

  // ---------- teams, a rotation, a Time Token Session, no setup ----------
  h = await home({ sessionType: 'endurance', enduranceBy: 'laps', laps: 6, endRule: 'all', swapUnit: 'laps', swapMode: 'every', swapEvery: 2 }, [{ teamId: 'T1', carId: 'c1', driverId: '' }, { teamId: '', carId: 'c2', driverId: '' }]);
  say('an Endurance Race: its lanes are teams, so the row needs a team, and says so inside the row; the line under the title says every lane is a team; the pills say its kind and its 6 laps', h.includes('<span class="hs-why">Lane 2 needs a team and a car.</span>') && !h.includes('<ul class="issues">') && h.includes('Every lane is a team with its starting driver.') && chipsOf(h).includes('<b>Endurance Race</b>') && chipsOf(h).includes('<span class="hs-chip">6 laps</span>'));
  const rec = { id: 'r1', name: 'Club night', participants: 4, lanes: 2, note: '', names: ['Alex', 'Sam'], groups: [], heats: [{ label: 'A', locked: false, places: [{ p: 0, lane: 0 }, { p: 1, lane: 1 }] }, { label: 'B', locked: false, places: [{ p: 2, lane: 0 }, { p: 3, lane: 1 }] }] };
  const four = [1, 2, 3, 4].map(i => ({ driverId: 'd' + i, carId: 'c' + i }));
  h = await home({ sessionType: 'heats', heatBy: 'laps', laps: 4, heatPlan: 'manual', heats: 2, resultBy: 'laps', rotation: 'r1' }, four, rec);
  say('a rotation: the rows are participants with their names, the name is in the row, and each row has its Not here today tick', rowsOf(h).length === 4 && rowsOf(h)[0].includes('<span class="hs-vh">Participant 1 · Alex</span>') && rowsOf(h)[0].includes('<span class="muted hs-rname">Alex</span>') && count(h, 'data-absent="') === 4 && h.includes('<span class="hs-label hs-muted">Participants</span>') && h.includes('4 participants race on 2 lanes. Pick who takes part.'));
  say('...a participant who is here has a tick; one that is not here today is marked as away, has an empty tick and is not counted: "3 of 3"', count(h, 'hs-tick ok') === 4 && h.includes('<span class="hm-ready">All 4 participants are ready.</span>'));
  await E('view').onchange({ target: { dataset: { absent: '1' }, checked: true, closest: () => null } }); await wait(30);
  h = E('view').innerHTML.replace(/&quot;/g, '"');
  say('...Sam away: his row is "lane rot away" with a tick that is only a ring (hs-tick off), no message and no "need"; the others are counted without him', /class="lane rot away" data-row="1"/.test(h) && rowsOf(h)[1].includes('<span class="hs-tick off" aria-hidden="true"></span>') && !rowsOf(h)[1].includes('hs-why') && count(h, 'hs-tick ok') === 3 && h.includes('<span class="hm-ready">All 3 participants are ready.</span>') && /data-absent="1" checked/.test(h));
  h = await home({ sessionType: 'heats', heatBy: 'laps', laps: 4, heatPlan: 'manual', heats: 2, resultBy: 'laps', participants: 'teams', track: 't4' }, [{ teamId: 'T1', carId: 'c1' }, { teamId: 'T2', carId: 'c2' }]);
  say('a heat race of teams: the rows are teams, the line under the title says "2 teams race on 4 lanes", a team box has no picture in front, and the Drivers of the team are named in the row', rowsOf(h).length === 2 && h.includes('<span class="hs-label hs-muted">Teams</span><span class="muted">2 teams race on 4 lanes. Pick who takes part.</span>') && rowsOf(h)[0].includes('<span class="hs-vh">Team 1</span>') && count(rowsOf(h)[0], 'hs-noico') === 1 && count(rowsOf(h)[0], 'class="hs-sel"') === 1 && h.includes('Drivers: Alex, Sam') && h.includes('<span class="hm-ready">All 2 teams are ready.</span>'));
  say('...the rows can be removed again when there are more than two (here two: no Remove), and a team can be added', !h.includes('data-remove=') && h.includes('id="addrow">Add team</button>'));
  h = await home({ sessionType: 'heats', heatBy: 'laps', laps: 4, heatPlan: 'manual', heats: 2, resultBy: 'laps', rotation: 'r1' }, four.map(x => ({ ...x, absent: true })), rec);
  say('a rotation where nobody comes: no row has a tick to show, no lane is counted, the pill is not green and Start is off', count(h, 'hs-tick off') === 4 && count(h, 'hs-tick ok') === 0 && h.includes('<div class="hs-status warn" role="status">') && /id="start" disabled/.test(h));
  say('with no championship there is no row for it', !h.includes('hs-champ') && !h.includes('id="champsel"'));
  store.championships = [{ id: 'ch1', name: 'Club Cup', rounds: [{ id: 'r1', name: 'Opener', track: 't1', date: '', sessions: [{ id: 'a1', setup: 'rs1' }] }], roster: [] }];
  h = await home();
  say('with a championship there is a quiet row under the title: a cup in a tile, the word Championship that labels the choice, and the choice, which starts at None (a normal race)', h.includes('<div class="hs-champ"><span class="hs-ctile" aria-hidden="true">') && h.includes('<label class="hs-clabel" for="champsel">Championship</label>') && h.includes('<select id="champsel"><option value="">None: a normal race</option><option value="ch1">Club Cup</option>') && h.indexOf('id="setup"') < h.indexOf('id="champsel"') && h.indexOf('id="champsel"') < h.indexOf('class="hs-sub"') && !h.includes('id="champband"'));
  store.championships = [];
  h = await home({ sessionType: 'tokens', track: 't1' }, [{ driverId: '', carId: '' }, { driverId: '', carId: '' }]);
  say('a Time Token Session: lanes need nothing, the line under the title says so, and the button opens the session instead of starting a race', h.includes('A lane can have no driver (a Guest) and no car.') && h.includes('<span>Open the session</span>') && !h.includes('<span>Start race</span>') && count(h, 'hs-tick ok') === 2 && !h.includes('hs-why'));
  h = await home(null);
  const fb = E('view').innerHTML.slice(E('view').innerHTML.indexOf('id="hmc-start"'));
  say('with no race setup at all the card keeps its plain title and the words that say where to make one (there is nothing to choose)', fb.includes('<h3>Start a race</h3><p class="muted">Create a race setup in the Race Setup tab to get started.</p>') && !fb.includes('hs-head') && !fb.includes('id="setup"'));

  // ---------- the style ----------
  const css = fs.readFileSync(R + 'renderer/styles.css', 'utf8'), rule = sel => { const i = css.indexOf('\n' + sel + '{'); return i < 0 ? '' : css.slice(i + 1, css.indexOf('}', i) + 1); };
  say('the colours of ready and of "needs something" are green and amber, and the light themes take darker ones that can be read on a light card', /--hs-ok:#3ecf8e;--hs-warn:#ffb84d/.test(rule('.hm-start')) && /\[data-theme="light"\] \.hm-start[^{]*\{--hs-ok:#1e8a4c;--hs-warn:#9a6a00\}/.test(css));
  say('...a tick is green or amber by its state, a row that needs something has an amber edge, the pill has an edge of the same two colours', rule('.hs-tick.ok').includes('var(--hs-ok)') && rule('.hs-tick.warn').includes('var(--hs-warn)') && /border-color:color-mix\(in srgb,var\(--hs-warn\)/.test(rule('.hm-start .lane.need')) && rule('.hs-status.ok').includes('var(--hs-ok)') && rule('.hs-status.warn').includes('var(--hs-warn)') && rule('.hs-why').includes('var(--hs-warn)'));
  say('...the words for screen readers are there but not seen (the number in the circle is only a picture of it), and the card has the 3px edge of the accent colour', /position:absolute/.test(rule('.hs-vh')) && rule('.hs-vh').includes('clip:rect(0 0 0 0)') && rule('.hm-start').includes('border-top:3px solid var(--accent)'));
  say('1.58.1: the title is a select with no background of its own, so the list that opens under it would be white with the light text of the theme (Windows, 20 Oct screenshot): the options of the title and of the other choices of the card carry the colours of the card', rule('.hs-title select option,.hs-title select optgroup,.hs-sel select option,.hs-sel select optgroup').includes('background:var(--panel);color:var(--ink)'));
  say('...Start sits at the bottom of the card whatever the height of the grid, and is dim when it is off', rule('.hm-start>.hm-go').includes('margin-top:auto') && /\.hm-start #start\[disabled\]\{opacity:\.4;cursor:not-allowed/.test(css));
  say('...a narrow card: the choices of a row with more in it go on, the Start button takes the whole width, and the number, the choices and the tick stay on one line', /@container \(max-width:560px\)\{[^@]*\.hm-go #start\{width:100%;justify-content:center\}/.test(css) && /@container \(max-width:560px\)\{[^@]*grid-template-areas:"n f t" "\. m m" "\. w w"/.test(css));

  reachedEnd = true;
  console.log(fails ? fails + ' START CARD TESTS FAILED' : 'ALL START CARD TESTS PASSED'); process.exit(fails ? 1 : 0);
})();
