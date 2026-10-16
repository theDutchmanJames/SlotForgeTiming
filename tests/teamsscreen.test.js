// 1.8.0: Teams on screen: the Teams page of the Database (list, cards, the form with the drivers in order, the view card), a team in a lane on the Home tab, the Team Name and Team Picture widgets,
// and the heat races whose participants are teams, against a stand-in for the app window.
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
const api = { liveStatic: s => { sent.stat = JSON.parse(JSON.stringify(structuredClone(s))); sent.dyn = null; sent.last = null; }, livePush: d => { const m = JSON.parse(JSON.stringify(structuredClone(d))); sent.last = m; sent.log.push(m); sent.n++; const r = merge(sent.dyn, m); if (r.ok) { if (!r.stale) sent.dyn = r.state; } else { sent.dyn = null; sent.gaps++; } },
  liveGet: async () => JSON.parse(JSON.stringify({ stat: sent.stat, dyn: sent.dyn })), onLive: f => { cbs.dyn.push(f); return () => {}; }, onLiveStatic: f => { cbs.stat.push(f); return () => {}; }, liveOpen: async () => ({ second: true }), liveCommand: c => { cmds.push(c); cbs.cmd.forEach(f => f(JSON.parse(JSON.stringify(c)))); }, onCommand: f => { cbs.cmd.push(f); return () => { cbs.cmd = cbs.cmd.filter(x => x !== f); }; },
  schema: async () => schema, getSettings: async () => ({ theme: 'dark', rules: 'Be kind. No bumping.' }), setSettings: async p => ({ ...(ctx.__ready ? vm.runInContext('state.settings', ctx) : {}), ...p }), dbPath: async () => 'x',
  list: async e => JSON.parse(JSON.stringify(store[e] || [])), customFields: async () => [], linkedLaps: async () => 0,
  saveSession: async (s, l) => { saved.push([s, l]); },
  add: async (e, item) => { const row = { ...item, id: 'N' + (store[e].length + 1) }; store[e].push(row); writes.push(['add', e, JSON.parse(JSON.stringify(item))]); return row; },
  update: async (e, id, p) => { writes.push(['update', e, id, JSON.parse(JSON.stringify(p))]); const r = store[e].find(x => x.id === id); Object.assign(r, p); return r; },
  remove: async (e, id) => { writes.push(['remove', e, id]); store[e] = store[e].filter(x => x.id !== id); } };
// the app reports a screen that could not be drawn with console.error: that is a failed test (unless the test expects it)
const appConsole = { ...console, expected: false, seen: 0, error: (...a) => { if (appConsole.expected) { appConsole.seen++; return; } console.log('FAIL the app reported an error: ' + a.map(x => (x && x.stack) || x).join(' ').slice(0, 300)); fails++; } };
// the real app passes everything through Electron's structured clone, which refuses a function ("An object could not be cloned"): every call of the app interface is checked the same way here
for (const k of Object.keys(api)) { const f = api[k]; if (typeof f === 'function') api[k] = (...x) => { x.forEach(v => { if (typeof v !== 'function') structuredClone(v); }); return f(...x); }; }
const ctx = vm.createContext({ document, api, console: appConsole, Intl, URL, Image: function () {}, confirm: () => true, alert() {}, setTimeout, clearTimeout, setInterval, clearInterval, performance });
ctx.__ready = true; ctx.window = ctx; ctx.addEventListener = () => {}; ctx.removeEventListener = () => {};
for (const f of ['bop.js', 'weather.js', 'endurance.js', 'damage.js', 'engine.js', 'heats.js', 'rotation.js', 'tokens.js', 'speed.js','stats.js','viewset.js','picture.js','uiscale.js','theme.js','banner.js', 'icons.js', 'delta.js','avatars.js', 'weatherwidgets.js', 'widgets.js', 'frame.js', 'backdrop.js','announcer.js','sound.js', 'timing.js', 'rows.js', 'richtext.js', 'report.js', 'canvas.js', 'liveshare.js', 'review.js', 'liveview.js', 'database.js', 'landing.js', 'race.js', 'undo.js', 'editor.js','tokenui.js', 'bopui.js', 'enduranceui.js', 'weatherui.js', 'rotationui.js', 'audioedit.js','widgetbuilder.js','transferui.js','themeui.js','hardware.js','trackmate.js','hardwareui.js', 'dsui.js', 'app.js']) vm.runInContext(fs.readFileSync(R + 'renderer/' + f, 'utf8'), ctx, { filename: f });
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
  await wait(50); ctx.__sent = sent;
  const sub = async s => { run(`state.settings = { theme: 'dark' }; state.tab = 'database'; state.sub = '${s}'`); await run('render()'); await wait(30); };
  const form = () => E('dlg').innerHTML.replace(/&quot;/g, '"');
  const click = async (d, over = {}) => { await E('dlg').onclick({ target: { closest: () => ({ dataset: d, ...over }) } }); await wait(10); };

  // ---------- the Teams page ----------
  await sub('teams');
  let h = E('subview').innerHTML;
  say('the Database has a Teams page, after Drivers, with an Add button and no teams yet', run('SUBS.map(x => x[0]).join()') === 'tracks,drivers,teams,slotcars,results' && run("SUBS.find(x => x[0] === 'teams')[1]") === 'Teams' && h.includes('id="add"') && h.includes('Add team'));
  store.teams.push({ id: 'T1', name: 'Red Bulls', drivers: ['d2', 'd1', 'gone'], picture: 'data:image/jpeg;base64,TTT' }, { id: 'T2', name: 'Blue Moons', drivers: ['d1', 'd3', 'd4'] }, { id: 'T3', name: 'Empty' });
  await sub('teams'); h = E('subview').innerHTML;
  say('the list shows a row per team with the drivers in their order; a driver that is gone shows as deleted', (h.match(/class="row"|<tr/g) || []).length > 0 && h.includes('Red Bulls') && h.includes('Sam, Alex, <span class="muted">(deleted)</span>') && h.includes('Alex, Kim, Lee') && h.includes('Empty'));
  say('...the list has the picture as a thumbnail', h.includes('src="data:image/jpeg;base64,TTT"'));
  await E('subview').onclick({ target: { closest: () => ({ id: 'vgrid', dataset: {} }) } }); await wait(20);
  h = E('subview').innerHTML;
  say('the grid has a card per team: the picture, or a coloured initial, and the drivers', (h.match(/class="gcard( |")/g) || []).length === 3 && h.includes('src="data:image/jpeg;base64,TTT"') && h.includes('class="ph"') && h.includes('Sam, Alex') && h.includes('Alex, Kim, Lee'));
  await E('subview').onclick({ target: { closest: () => ({ id: 'vlist', dataset: {} }) } }); await wait(20);

  // ---------- the form ----------
  run("openForm('teams', null)"); await wait(10);
  let f = form();
  say('a new team: the folders Basics (open) and Picture, the name, the list of drivers and the picture', f.includes('Add team') && f.includes('data-fg="basics" open') && f.includes('data-fg="picture"') && !f.includes('data-fg="picture" open') && f.includes('id="f-name"') && f.includes('id="mem-box"') && f.includes('id="f-picture"') && f.includes('Team name'));
  say('...the list starts empty, and every driver can be added', f.includes('No drivers in this team yet.') && ['Alex', 'Sam', 'Kim', 'Lee'].every(n => f.includes(`>${n}</option>`)) && f.includes('Choose a driver'));
  E('mem-pick').value = 'd3'; await click({ memadd: '1' });
  E('mem-pick').value = 'd1'; await click({ memadd: '1' });
  E('mem-pick').value = 'd4'; await click({ memadd: '1' });
  let box = () => E('mem-box').innerHTML.replace(/&quot;/g, '"');
  const order = () => [...box().matchAll(/class="memname">([^<]*)</g)].map(m => m[1]).join();
  say('drivers are added at the end, in the order they were added; a driver in the list is not offered again', order() === 'Kim,Alex,Lee' && !box().includes('value="d3"') && !box().includes('value="d1"') && box().includes('value="d2"'));
  E('mem-pick').value = 'd1'; await click({ memadd: '1' });
  say('adding a driver who is in the team already does nothing', order() === 'Kim,Alex,Lee');
  E('mem-pick').value = ''; await click({ memadd: '1' });
  say('...nor does adding nobody', order() === 'Kim,Alex,Lee');
  await click({ memup: '2' }); say('up moves a driver one place', order() === 'Kim,Lee,Alex');
  await click({ memup: '0' }); say('...up on the first one does nothing', order() === 'Kim,Lee,Alex');
  await click({ memdown: '0' }); say('down moves a driver one place down', order() === 'Lee,Kim,Alex');
  await click({ memdown: '2' }); say('...down on the last one does nothing', order() === 'Lee,Kim,Alex');
  await click({ memdel: '1' }); say('Remove takes a driver out of the list, the others stay in order', order() === 'Lee,Alex' && box().includes('value="d3"'));
  say('the first driver has no Up button, the last has no Down button', /data-memup="0" aria-label="Move up" disabled/.test(box()) && /data-memdown="1" aria-label="Move down" disabled/.test(box()) && !/data-memup="1"[^>]*disabled/.test(box()));
  E('f-name').value = '  Green Hornets '; E('f-picture').value = '';
  await E('frm').onsubmit({ preventDefault() {} }); await wait(30);
  const added = writes.filter(w => w[0] === 'add' && w[1] === 'teams').pop();
  say('Save adds the team: the name is trimmed, the drivers are in the order of the list, and it has a picture field', added && added[2].name === 'Green Hornets' && added[2].drivers.join() === 'd4,d1' && 'picture' in added[2]);
  run("openForm('teams', null)"); await wait(10);
  E('f-name').value = '   '; await E('frm').onsubmit({ preventDefault() {} }); await wait(30);
  say('a team needs a name', E('err').textContent === 'Please fill in Team name.' && writes.filter(w => w[0] === 'add' && w[1] === 'teams').length === 1);
  run('dlg.close()');

  // ---------- editing, the view card ----------
  await sub('teams');
  run("openForm('teams', state.refs && null)"); // (a form for an item that is not there is an add form; the edit below uses a real one)
  run('dlg.close()');
  await E('subview').onclick({ target: { closest: () => ({ dataset: { edit: 'T1' } }) } }); await wait(30);
  f = form();
  say('editing a team shows its name and its drivers in order; a driver that is gone shows as deleted (and is dropped when saved)', f.includes('Edit team') && f.includes('value="Red Bulls"') && [...f.matchAll(/class="memname">([^<]*)</g)].map(m => m[1]).join() === 'Sam,Alex,(deleted)');
  await click({ memdown: '0' }); E('f-name').value = 'Red Bulls';
  await E('frm').onsubmit({ preventDefault() {} }); await wait(30);
  const upd = writes.filter(w => w[0] === 'update' && w[1] === 'teams').pop();
  say('Save updates the team: the new order, the driver that is gone left out, the picture kept', upd && upd[2] === 'T1' && upd[3].drivers.join() === 'd1,d2' && upd[3].picture === 'data:image/jpeg;base64,TTT');
  run('dlg.close()');
  await sub('teams');
  await E('subview').onclick({ target: { closest: s => (s === '[data-view]' ? { dataset: { view: 'T2' } } : null) } }); await wait(30);
  say('a click on a team opens the view card: the name, the drivers in order, and the picture place', form().includes('Blue Moons') && form().includes('Alex, Kim, Lee') && form().includes('Drivers of the team'));
  run('dlg.close()');

  // ---------- the Home tab: a team in a lane ----------
  store.teams = [{ id: 'T1', name: 'Red Bulls', drivers: ['d1', 'd2'], picture: 'data:image/jpeg;base64,RED' }, { id: 'T2', name: 'Blue Moons', drivers: ['d3', 'd4'] }, { id: 'T3', name: 'Shared', drivers: ['d2', 'd3'] }, { id: 'T4', name: 'Empty', drivers: [] }];
  store.tracks = [{ id: 't1', name: 'Living room', lanes: 2 }, { id: 't4', name: 'Big track', lanes: 4 }];
  const homeSetup = over => ({ id: 'hs1', name: 'Club race', sessionType: 'race', track: 't1', laps: 5, endRule: 'all', ...over });
  const home = async (over = {}, asg = [], rec) => {
    store.racesetups = [homeSetup(over)]; store.rotationsetups = rec ? [rec] : [];
    run("state.settings.lastSetupId = 'hs1'; state.settings.assignments = " + JSON.stringify({ hs1: asg }) + "; state.settings.heatEdits = {}; state.settings.heatSeeds = { hs1: 5 }; state.tab = 'home'; state.race = null; state.rotMsg = null; live = null");
    await run('render()'); await wait(30); return E('view').innerHTML.replace(/&quot;/g, '"');
  };
  const change = async (row, k, value) => { await E('view').onchange({ target: { dataset: { k }, value, closest: () => ({ dataset: { row: String(row) } }) } }); await wait(30); return E('view').innerHTML.replace(/&quot;/g, '"'); };
  const clickHome = async b => { await E('view').onclick({ target: { closest: sel => (sel === 'button' ? { dataset: {}, ...b } : null) } }); await wait(30); return E('view').innerHTML.replace(/&quot;/g, '"'); };
  const assignments = () => run('state.settings.assignments.hs1');
  const rowsOf = h => h.split('data-row="').slice(1);
  const options = (rowHtml, k) => { const m = new RegExp('<select data-k="' + k + '"[^>]*>(.*?)</select>').exec(rowHtml); return m ? [...m[1].matchAll(/<option value="([^"]*)"( selected)?>([^<]*)</g)].map(x => ({ v: x[1], sel: !!x[2], t: x[3] })) : null; };

  // 1.10.1: the Team choice is only there in a session that has teams (an Endurance Race in one go, or heats whose participants are teams)
  const enduSetup = { sessionType: 'endurance', enduranceBy: 'laps', laps: 10 };
  const lanes3 = h => (h.match(/class="lane[^"]*threesel[^"]*" data-row/g) || []).length;
  let hh = await home({}, [{ driverId: 'd1', carId: 'c1' }, { driverId: '', carId: '' }]);
  let r0 = rowsOf(hh)[0], r1 = rowsOf(hh)[1];
  say('a normal race has no Team choice, even with teams in the database: a driver and a car on every lane, every driver offered', !hh.includes('data-k="teamId"') && r0.includes('data-k="driverId"') && r0.includes('data-k="carId"') && options(r0, 'driverId').length === 5 && options(r0, 'driverId').some(o => o.t === 'Lee') && rowsOf(hh).length === 2);
  say('...and the row keeps the two flexible columns (driver and car side by side, no third column)', lanes3(hh) === 0 && hh.includes('class="lane" data-row="0"'));
  hh = await home({}, [{ driverId: 'd1', carId: 'c1', teamId: 'T1' }, { driverId: 'd3', carId: 'c2', teamId: 'T1' }]);
  say('a team that an earlier session left on a lane is not shown in a session without teams: no Team choice, the driver stays, and the lane does not complain', !hh.includes('data-k="teamId"') && options(rowsOf(hh)[0], 'driverId').find(o => o.sel).t === 'Alex' && options(rowsOf(hh)[1], 'driverId').find(o => o.sel).t === 'Kim' && options(rowsOf(hh)[1], 'driverId').length === 5 && !hh.includes('<ul class="issues">'));
  await clickHome({ id: 'start' }); const started = JSON.parse(run('JSON.stringify(state.race)'));
  say('...and Start gives the race lanes without a team', started.rows.length === 2 && started.rows.every(x => !('teamId' in x)) && !started.byTeam && started.rows[1].driverId === 'd3');
  run('state.race = null; live = null');
  hh = await home({ sessionType: 'heats', track: 't4', heatBy: 'laps', laps: 3, heatPlan: 'manual', heats: 2, resultBy: 'laps', participants: 'drivers' }, [{ driverId: 'd1', carId: 'c1', teamId: 'T1' }, { driverId: 'd2', carId: 'c2' }, { driverId: 'd3', carId: 'c3' }]);
  say('heats with drivers as the participants have no Team choice either', !hh.includes('data-k="teamId"') && rowsOf(hh).every(r => r.includes('data-k="driverId"')) && lanes3(hh) === 0);
  hh = await home(enduSetup, [{ driverId: '', carId: 'c1' }, { driverId: '', carId: '' }]);
  r0 = rowsOf(hh)[0];
  say('an Endurance Race in one go has a Team choice on every lane, before the starting driver and the car, with nothing chosen to begin with', rowsOf(hh).every(r => options(r, 'teamId') && r.indexOf('data-k="teamId"') < r.indexOf('data-k="driverId"') && r.indexOf('data-k="driverId"') < r.indexOf('data-k="carId"')) && options(r0, 'teamId').map(o => o.t).join() === '(choose a team),Red Bulls,Blue Moons,Shared,Empty' && options(r0, 'teamId').filter(o => o.sel).map(o => o.v).join() === '');
  say('...and its rows have three equal columns, so Team, Driver and Slotcar sit side by side (the class threesel)', lanes3(hh) === 2);
  { const css = require('fs').readFileSync(__dirname + '/../renderer/styles.css', 'utf8'), plain = (css.match(/\.lane\{[^}]*\}/) || [''])[0], three = (css.match(/\.lane\.threesel\{[^}]*\}/) || [''])[0];
    say('...in the stylesheet: a plain lane is a label and two flexible columns, a lane with a Team choice a label and three (so none of the three is pushed into the narrow last column)', /grid-template-columns:110px 1fr 1fr auto/.test(plain) && /grid-template-columns:110px 1fr 1fr 1fr auto/.test(three) && css.indexOf('.lane.threesel') > css.indexOf('.lane{')); }
  hh = await change(0, 'teamId', 'T1');
  say('a team for the lane: it is saved with the row, and the starting driver is one of the team (none chosen yet)', assignments()[0].teamId === 'T1' && assignments()[0].driverId === '' && options(rowsOf(hh)[0], 'driverId').filter(o => o.v).map(o => o.t).join() === 'Alex,Sam' && options(rowsOf(hh)[0], 'teamId').find(o => o.sel).t === 'Red Bulls');
  hh = await change(0, 'driverId', 'd2'); hh = await change(0, 'teamId', 'T3');
  say('a team that has the starting driver keeps him (Sam is in Shared too)', assignments()[0].driverId === 'd2' && assignments()[0].teamId === 'T3');
  hh = await change(0, 'teamId', 'T2');
  say('a team that does not have the starting driver clears him', assignments()[0].driverId === '' && assignments()[0].teamId === 'T2');
  hh = await change(0, 'teamId', '');
  say('no team again: the team is taken off the row (not left empty in it)', !('teamId' in assignments()[0]));
  hh = await home(enduSetup, [{ driverId: 'd1', carId: 'c1', teamId: 'T1' }, { driverId: '', carId: 'c2', teamId: 'T2' }]);
  say('an Endurance Race with a team and a car on every lane has nothing in the way of starting it', !hh.includes('<ul class="issues">'));
  await clickHome({ id: 'start' }); const startedE = JSON.parse(run('JSON.stringify(state.race)'));
  say('Start gives the race the team of every lane', startedE.rows.map(x => x.teamId).join() === 'T1,T2' && startedE.rows[0].driverId === 'd1');
  run('state.race = null; live = null');
  hh = await home({}, [{ driverId: 'd1', carId: 'c1', teamId: 'T9' }, { driverId: 'd2', carId: 'c2', teamId: 'T1' }]);
  say('a team that was deleted since is taken off the row; the driver stays', !hh.includes('data-k="teamId"') && options(rowsOf(hh)[0], 'driverId').find(o => o.sel).t === 'Alex');
  hh = await home(enduSetup, [{ driverId: 'd1', carId: 'c1', teamId: 'T9' }, { driverId: '', carId: 'c2', teamId: 'T1' }]);
  say('...also in an Endurance Race: the lane has no team any more and says it needs one (the other lane keeps its team)', !options(rowsOf(hh)[0], 'teamId').some(o => o.sel && o.v) && options(rowsOf(hh)[1], 'teamId').find(o => o.sel).t === 'Red Bulls' && hh.includes('Lane 1 needs a team and a car.'));

  // ---------- the Home tab: teams as the participants of a heat race ----------
  const heatsSetup = over => ({ sessionType: 'heats', track: 't4', heatBy: 'laps', laps: 3, heatPlan: 'manual', heats: 2, resultBy: 'laps', participants: 'teams', teamDriver: 'order', ...over });
  hh = await home(heatsSetup(), [{ driverId: 'd1', carId: 'c1', teamId: 'T1' }, { driverId: '', carId: 'c2' }, { driverId: '', carId: '' }]);
  say('a heat race with teams as participants: a team and a car per row (no driver), the drivers of the team in words, and Add team', rowsOf(hh).length === 3 && rowsOf(hh).every(r => !r.includes('data-k="driverId"') && r.includes('data-k="teamId"') && r.includes('data-k="carId"')) && rowsOf(hh)[0].includes('Team 1</strong>') && rowsOf(hh)[0].includes('Drivers: Alex, Sam') && hh.includes('id="addrow">Add team<'));
  say('...it says what every team lacks: a team and a car', hh.includes('Team 2 needs a team and a car.') && hh.includes('Team 3 needs a team and a car.') && !hh.includes('Team 1 needs') && /id="start"[^>]*disabled/.test(hh));
  hh = await change(1, 'teamId', 'T2'); hh = await change(2, 'teamId', 'T4'); hh = await change(2, 'carId', 'c3');
  say('choosing a team does not put a driver on the row (the driver comes from the team in every heat)', assignments()[1].teamId === 'T2' && assignments()[1].driverId === '' && assignments()[2].teamId === 'T4');
  say('...a team without drivers is told (it cannot race), a team is used once, and the plan names the teams', hh.includes('The team Empty has no drivers. Add them in Database &gt; Teams.') && /id="start"[^>]*disabled/.test(hh) && hh.includes('Red Bulls') && hh.includes('<h4>Heat plan</h4>'));
  hh = await change(2, 'teamId', 'T1');
  say('a team on two rows is told, as a driver would be', hh.includes('A team is used more than once.') && !hh.includes('A driver is used more than once.'));
  hh = await change(2, 'teamId', 'T3');
  say('with three different teams and a car each there is nothing wrong, and a driver who is in two teams (Sam, Kim) is no problem here', !hh.includes('<ul class="issues">') && !/id="start"[^>]*disabled/.test(hh) && (hh.match(/class="hpcell/g) || []).length > 0 && /class="hpcell[^"]*"[^>]*>(Red Bulls|Blue Moons|Shared)</.test(hh));
  await clickHome({ id: 'start' }); const rt = JSON.parse(run('JSON.stringify(state.race)'));
  say('Start gives the race the teams: byTeam, the team and the car of every row, and the plan as shown', rt.byTeam === true && rt.rows.map(r => r.teamId).join() === 'T1,T2,T3' && rt.rows.map(r => r.carId).join() === 'c1,c2,c3' && Array.isArray(rt.schedule) && rt.schedule.length === 2);
  run('state.race = null; live = null');
  hh = await home(heatsSetup({ participants: 'drivers' }), [{ driverId: 'd1', carId: 'c1', teamId: 'T1' }, { driverId: 'd2', carId: 'c2' }, { driverId: 'd3', carId: 'c3' }]);
  say('with drivers as the participants the rows are the rows of drivers (with the optional team), as before', rowsOf(hh).every(r => r.includes('data-k="driverId"')) && hh.includes('id="addrow">Add participant<') && rowsOf(hh)[0].includes('Participant 1</strong>'));
  hh = await home(heatsSetup(), [{ driverId: 'd1', carId: 'c1', teamId: 'T1' }, { driverId: 'd2', carId: 'c2', teamId: 'T2' }, { driverId: 'd3', carId: 'c3', teamId: 'T3' }]);
  await clickHome({ id: 'start' }); const rt2 = JSON.parse(run('JSON.stringify(state.race)'));
  say('the driver that was on a row is not used when the participants are teams', rt2.byTeam === true && hh.includes('Red Bulls'));
  run('state.race = null; live = null');
  hh = await home(heatsSetup({ participants: 'teams' }), [{ driverId: 'd1', carId: 'c1', teamId: 'T1' }, { driverId: 'd2', carId: 'c2', teamId: 'T2' }, { driverId: 'd3', carId: 'c3', teamId: 'T3' }]);
  say('the stored driver of the rows is kept for when the setup goes back to drivers', assignments().every(r => r.driverId));

  // a rotation whose participants are teams
  const rotRec = over => ({ id: 'r1', name: 'Club night', participants: 4, lanes: 2, names: ['Red Bulls', 'Blue Moons', 'Green', ''], groups: [], heats: [{ label: 'A', locked: false, places: [{ p: 0, lane: 0 }, { p: 1, lane: 1 }] }, { label: 'B', locked: false, places: [{ p: 2, lane: 0 }, { p: 3, lane: 1 }] }, { label: 'C', locked: false, places: [{ p: 0, lane: 0 }, { p: 2, lane: 1 }] }], ...over });
  hh = await home(heatsSetup({ rotation: 'r1', participants: 'drivers' }), [{ driverId: '', carId: 'c1' }, { driverId: '', carId: 'c2' }, { driverId: '', carId: 'c3' }, { driverId: '', carId: 'c4' }], rotRec({ participantsAre: 'teams' }));
  say('a rotation that says Teams makes the rows rows of teams (the race setup does not matter), and says so in words', rowsOf(hh).length === 4 && rowsOf(hh).every(r => !r.includes('data-k="driverId"') && r.includes('data-k="teamId"')) && hh.includes('4 teams, 2 lanes, 3 heats') && rowsOf(hh)[0].includes('Team 1 · Red Bulls') && hh.includes('Tick "Not here today" for every team that does not come'));
  say('...it has a button that picks the teams by the names of the rotation (not the drivers)', hh.includes('id="rotnames"') && hh.includes('Pick the teams by name') && !hh.includes('Pick the drivers by name') && hh.includes('aria-label="Team 1 is not here today"'));
  hh = await clickHome({ id: 'rotnames' });
  say('...and it picks Red Bulls and Blue Moons, tells that no team is called Green, and leaves the team without a name alone', assignments().map(r => r.teamId || '').join() === 'T1,T2,,' && hh.includes('Picked 2 teams by name.') && hh.includes('No team is called Green.'));
  hh = await home(heatsSetup({ rotation: 'r1', participants: 'teams' }), [{ driverId: 'd1', carId: 'c1' }, { driverId: 'd2', carId: 'c2' }, { driverId: 'd3', carId: 'c3' }, { driverId: 'd4', carId: 'c4' }], rotRec());
  say('a rotation of drivers wins over a race setup that says Teams: the rows are rows of drivers', rowsOf(hh).every(r => r.includes('data-k="driverId"')) && hh.includes('4 participants, 2 lanes, 3 heats') && hh.includes('Pick the drivers by name'));
  run('state.race = null; live = null');

  // ---------- a heat race whose participants are teams ----------
  store.teams = [{ id: 'T1', name: 'Red Bulls', drivers: ['d1', 'd2'], picture: 'data:image/jpeg;base64,RED' }, { id: 'T2', name: 'Blue Moons', drivers: ['d3', 'd4'] }, { id: 'T3', name: 'Shared', drivers: ['d2', 'd3'] }, { id: 'T5', name: 'Solo', drivers: ['d1'] }];
  const teamRows = (...ids) => ids.map((t, i) => ({ teamId: t, carId: 'c' + (i + 1) }));
  const tsetup = over => ({ name: 'Team race', sessionType: 'heats', heatBy: 'laps', laps: 2, endRule: 'all', heatPlan: 'manual', heats: 3, resultBy: 'laps', teamDriver: 'order', layout: '', restartAfterRed: 'resume', ...over });
  const teamRace = async (over, rowsIn, schedule) => { run(`state.speed=40; state.autoFinalize = true; state.race=${JSON.stringify({ setup: tsetup(over), track: store.tracks[0], rows: rowsIn, byTeam: true, schedule })}; state.tab='race'`); await run('render()'); await wait(30); };
  const cars = () => run("live.engine().cars.map(c => c.lane + ':' + c.teamName + ':' + c.driverName).join()");
  const sched3 = [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }], [{ p: 0, lane: 0 }, { p: 2, lane: 1 }], [{ p: 1, lane: 0 }, { p: 2, lane: 1 }]];
  const playOn = async (seen, limit = 8) => { let n = 0; while (phase() !== 'finished' && n++ < limit) { if (['ready', 'between'].includes(phase())) key(' '); await until(() => ['between', 'finished'].includes(phase()), 15000); if (phase() === 'between') seen.push(cars()); } };
  saved.length = 0;
  await teamRace({}, teamRows('T1', 'T2', 'T3'), sched3);
  say('the first heat: every team has its first driver, and the cars know their team (name, picture) next to the driver', cars() === '0:Red Bulls:Alex,1:Blue Moons:Kim' && run("live.engine().cars[0].teamId") === 'T1' && run("live.engine().cars[0].teamPicture") === 'data:image/jpeg;base64,RED' && run("live.engine().cars[0].driverId") === 'd1' && run("live.engine().cars[0].asTeam") === true);
  say('...and the driver brings his nickname, callsign, flag and avatar into the car (the voice and the widgets use them)', run("live.engine().cars[0].nickname") === 'Speedy' && run("live.engine().cars[0].callsign") === 'Alpha' && run("live.engine().cars[0].flag") === 'NL' && run("live.engine().cars[0].avatar") === 'av1');
  say('...the overall result is by team (not by driver)', E('overall').innerHTML.includes('<td>Red Bulls</td>') && E('overall').innerHTML.includes('<td>Shared</td>') && !E('overall').innerHTML.includes('<td>Alex</td>'));
  say('...nobody has to choose: no panel for the drivers', E('teampick').hidden === true);
  say('...the other screens are told the team and the driver of every car', sent.stat.cfg.entries ? sent.stat.cfg.entries.some(e => e.teamName === 'Red Bulls' && e.driverName === 'Alex') : JSON.stringify(sent.stat.cfg).includes('Red Bulls'));
  E('sim').checked = true; const seen = [cars()];
  await playOn(seen);
  say('the drivers of a team take turns: Red Bulls Alex, then Sam; Blue Moons Kim, then Lee; Shared (Sam and Kim) takes the driver who is not driving for another team in that heat (Kim in heat 2, because Sam is in the Red Bulls car; Sam in heat 3)', seen.join(' | ') === '0:Red Bulls:Alex,1:Blue Moons:Kim | 0:Red Bulls:Sam,1:Shared:Kim | 0:Blue Moons:Lee,1:Shared:Sam' && phase() === 'finished');
  const sess = saved[0] && saved[0][0], lapsOut = saved[0] && saved[0][1];
  say('the race is saved once, with a row per team: the team is the row (no driver of its own), with the drivers who drove for it and their laps', saved.length === 1 && sess.standings.length === 3 && sess.standings.every(x => x.asTeam === true && x.driverId === '' && x.teamId && x.teamName === x.driverName && Array.isArray(x.drivers) && x.drivers.length >= 1));
  const red = sess.standings.find(x => x.teamId === 'T1'), blue = sess.standings.find(x => x.teamId === 'T2'), shared = sess.standings.find(x => x.teamId === 'T3');
  say('...Red Bulls: Alex and Sam, laps adding up to the laps of the team; Blue Moons: Kim and Lee; Shared: Kim and Sam', red.drivers.map(d => d.driverId).join() === 'd1,d2' && blue.drivers.map(d => d.driverId).join() === 'd3,d4' && shared.drivers.map(d => d.driverId).join() === 'd3,d2' && red.drivers.reduce((t, d) => t + d.laps, 0) === red.laps && red.drivers.every(d => d.driverName));
  say('...every lap is saved for the driver who drove it (so the personal bests and records of the drivers are right), and with the team', lapsOut.length > 0 && lapsOut.every(l => l.driverId && l.teamId) && lapsOut.filter(l => l.teamId === 'T1' && l.heat === 1).every(l => l.driverId === 'd1') && lapsOut.filter(l => l.teamId === 'T1' && l.heat === 2).every(l => l.driverId === 'd2') && lapsOut.filter(l => l.teamId === 'T2' && l.heat === 3).every(l => l.driverId === 'd4'));
  say('...the heats say who drove: the row has the team with the driver in brackets, and the driver apart', sess.heatResults.length === 3 && sess.heatResults[0].rows.some(x => x.driverName === 'Red Bulls (Alex)' && x.by === 'Alex' && x.driverId === 'd1' && x.teamId === 'T1') && sess.heatResults[2].rows.some(x => x.driverName === 'Blue Moons (Lee)' && x.by === 'Lee'));
  say('...the standings keep the usual figures (position, laps, best lap)', sess.standings.map(x => x.pos).join() === '1,2,3' && sess.standings.every(x => x.laps > 0 && Number.isFinite(x.best) && x.carId));
  run('state.race = null; live = null'); saved.length = 0;

  // the Race Director chooses
  await teamRace({ teamDriver: 'chosen' }, teamRows('T1', 'T2', 'T3'), [[{ p: 0, lane: 0 }, { p: 2, lane: 1 }], [{ p: 0, lane: 0 }, { p: 1, lane: 1 }], [{ p: 1, lane: 0 }, { p: 2, lane: 1 }]]);
  const pick = () => E('teampick').innerHTML.replace(/&quot;/g, '"');
  say('before the first heat the panel asks who drives, for every team of the heat, with the driver who is in turn already selected', E('teampick').hidden === false && pick().includes('Heat 1: who drives?') && (pick().match(/data-tp="/g) || []).length === 2 && /data-tp="0"[^>]*>.*?<option value="d1" selected>Alex/.test(pick()) && /data-tp="2"[^>]*>.*?<option value="d2" selected>Sam/.test(pick()));
  say('...it names the lane of every team', pick().includes('Lane 1 · Red Bulls') && pick().includes('Lane 2 · Shared'));
  say('...a driver who is driving for the other team is not offered (Sam is Shared\'s, so Red Bulls cannot take him)', /<option value="d2"[^>]* disabled>Sam \(drives for another team\)/.test(pick()));
  await E('teampick').onchange({ target: { dataset: { tp: '0' }, value: 'd1' } });
  await E('teampick').onchange({ target: { dataset: { tp: '2' }, value: 'd3' } }); await wait(20);
  say('choosing a driver for a team puts him in the car at once (the cars are made again), and the list keeps the choice', cars() === '0:Red Bulls:Alex,1:Shared:Kim' && /data-tp="2"[^>]*>.*?<option value="d3" selected>Kim/.test(pick()));
  await E('teampick').onchange({ target: { dataset: { tp: '0' }, value: 'd2' } }); await wait(20);
  say('...the other team then moves away from the driver who was taken (a driver is in one car only)', cars() === '0:Red Bulls:Sam,1:Shared:Kim');
  say('...and a driver without a nickname, callsign, flag or avatar leaves them empty (Sam does not keep those of Alex)', ['nickname', 'callsign', 'flag', 'avatar'].every(k => run(`live.engine().cars[0].${k}`) === ''));
  await E('teampick').onchange({ target: { dataset: { tp: '0' }, value: 'zzz' } }); await wait(20);
  say('...a choice of a driver who is not in the team is ignored', cars() === '0:Red Bulls:Sam,1:Shared:Kim');
  E('sim').checked = true; key(' '); await until(() => phase() === 'running'); 
  say('during the heat there is no panel to change the drivers', E('teampick').hidden === true);
  await until(() => phase() === 'between');
  say('after the heat the panel asks again, for the next heat, and suggests the next in turn (the turn goes on after Sam, so Alex)', E('teampick').hidden === false && pick().includes('Heat 2: who drives?') && cars() === '0:Red Bulls:Alex,1:Blue Moons:Kim' && /data-tp="0"[^>]*>.*?<option value="d1" selected>Alex/.test(pick()));
  await E('teampick').onchange({ target: { dataset: { tp: '1' }, value: 'd4' } }); await wait(20);
  say('...and a driver can be chosen between the heats', cars() === '0:Red Bulls:Alex,1:Blue Moons:Lee');
  key(' '); await until(() => phase() === 'running'); await until(() => phase() === 'between');
  say('the choices are for one heat only: heat 3 is in turn again (Blue Moons: Kim, after Lee; Shared: after Kim it is Sam)', cars() === '0:Blue Moons:Kim,1:Shared:Sam');
  key(' '); await until(() => phase() === 'finished', 15000);
  say('the race is saved with the drivers that were chosen', saved.length === 1 && saved[0][0].standings.find(x => x.teamId === 'T1').drivers.map(d => d.driverId).join() === 'd2,d1' && saved[0][0].standings.find(x => x.teamId === 'T2').drivers.map(d => d.driverId).join() === 'd4,d3');
  run('state.race = null; live = null'); saved.length = 0;

  // by lot with a fixed random number: the same lot every time (a lot just below 1 takes the last driver who qualifies)
  run('state.rand = () => 0.999');
  for (let k = 0; k < 4; k++) { await teamRace({ teamDriver: 'random', heats: 2 }, teamRows('T1', 'T2'), [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }], [{ p: 0, lane: 0 }, { p: 1, lane: 1 }]]); if (cars() !== '0:Red Bulls:Sam,1:Blue Moons:Lee') { say('by lot with a fixed random number the first heat is always the same (Sam and Lee), but it was ' + cars(), false); break; } if (k === 3) say('by lot uses the random number of the race (a fixed number gives the same drivers in four races)', true); await wait(150); run('state.race = null; live = null'); }
  run('state.rand = null');
  // by lot
  await teamRace({ teamDriver: 'random', heats: 2 }, teamRows('T1', 'T2'), [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }], [{ p: 0, lane: 0 }, { p: 1, lane: 1 }]]);
  const first = cars(); E('sim').checked = true; const seen2 = [first]; await playOn(seen2);
  say('by lot: every team has a driver of its own roster in each heat, and a team with two drivers uses both in two heats (the one who drove the fewest goes first)', seen2.length === 2 && seen2.every(c => /^0:Red Bulls:(Alex|Sam),1:Blue Moons:(Kim|Lee)$/.test(c)) && saved.length === 1 && saved[0][0].standings.every(x => x.drivers.length === 2));
  say('...and there is no panel when the Race Director does not choose', E('teampick').hidden === true);
  run('state.race = null; live = null'); saved.length = 0;

  // two teams with the same only driver
  await teamRace({ heats: 1 }, teamRows('T1', 'T5'), [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }]]);
  say('two teams that need the same driver (Red Bulls takes Alex first, Solo has only Alex): the panel warns that Solo has no driver who is free, and Alex drives for both (the Race Director can decide)', E('teampick').hidden === false && pick().includes('Solo has no driver who is free') && pick().includes('role="alert"') && cars() === '0:Red Bulls:Alex,1:Solo:Alex');
  run('state.race = null; live = null'); saved.length = 0;

  // a team that races as a team with a championship (points)
  await teamRace({ resultBy: 'points', points: '10, 8', heats: 1 }, teamRows('T1', 'T2'), [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }]]);
  E('sim').checked = true; key(' '); await until(() => phase() === 'finished', 15000);
  say('a heat race on points with teams: the points are the points of the teams', saved.length === 1 && saved[0][0].resultBy === 'points' && saved[0][0].standings.map(x => x.points).sort((a, b) => b - a).join() === '10,8');
  run('state.race = null; live = null'); saved.length = 0;

  // an ordinary race with a team on the lane
  run(`state.speed=40; state.autoFinalize = true; state.race=${JSON.stringify({ setup: { name: 'Plain', sessionType: 'race', laps: 2, endRule: 'all', layout: '', restartAfterRed: 'resume' }, track: store.tracks[0], rows: [{ driverId: 'd1', carId: 'c1', teamId: 'T1' }, { driverId: 'd3', carId: 'c2' }] })}; state.tab='race'`); await run('render()'); await wait(30);
  say('an ordinary race with a team on a lane: the car has the team next to the driver; the lane without a team has none', run("live.engine().cars[0].teamName") === 'Red Bulls' && run("live.engine().cars[0].driverName") === 'Alex' && run("live.engine().cars[1].teamName") === undefined && run("live.engine().cars[0].asTeam") === undefined);
  E('sim').checked = true; key(' '); await until(() => phase() === 'finished', 15000);
  const plain = saved[0] && saved[0][0];
  say('...the result keeps the driver as the row, and tells the team (a Team column in the results)', plain && plain.standings.find(x => x.driverId === 'd1').teamName === 'Red Bulls' && plain.standings.find(x => x.driverId === 'd1').teamId === 'T1' && !('teamId' in plain.standings.find(x => x.driverId === 'd3')) && !plain.standings.some(x => x.asTeam) && saved[0][1].filter(l => l.driverId === 'd1').every(l => l.teamId === 'T1') && saved[0][1].filter(l => l.driverId === 'd3').every(l => !('teamId' in l)));
  run('state.race = null; live = null'); saved.length = 0;

  // ---------- the team widgets on a layout, and the other screens ----------
  { const Wt = (type, lane, x, y, opt = {}) => ({ id: type + lane + x, type, lane, x, y, w: 200, h: 80, textSize: '', textColor: '', bgColor: '', opt });
    store.layouts = [{ id: 'TW', name: 'Teams', ratioW: 16, ratioH: 9, widgets: [Wt('teamname', 0, 0, 0), Wt('teamname', 1, 200, 0), Wt('teamname', 3, 400, 0, { team: 'T2' }), Wt('teampicture', 0, 0, 100), Wt('teampicture', 1, 200, 100, { team: 'T1' }), Wt('textlane', 0, 400, 100, { text: '{team} / {name}' })] }];
    run(`state.speed=40; state.autoFinalize = true; state.race=${JSON.stringify({ setup: { name: 'Plain', sessionType: 'race', laps: 2, endRule: 'all', layout: 'TW', restartAfterRed: 'resume' }, track: store.tracks[1], rows: [{ driverId: 'd1', carId: 'c1', teamId: 'T3' }, { driverId: 'd3', carId: 'c2' }] })}; state.tab='race'`); await run('render()'); await wait(30);
    const val = (type, lane) => run('live.nodes').find(n => n.w.type === type && n.w.lane === lane).val.innerHTML;
    say('the Team Name widget shows the team of its lane, and nothing on a lane that has no team', val('teamname', 0) === 'Shared' && val('teamname', 1) === '');
    say('...a widget with a team chosen in it shows that team whatever the lane has: Blue Moons on lane 4, where no car races, and the picture of Red Bulls on lane 2', val('teamname', 3) === 'Blue Moons' && val('teampicture', 1).includes('src="data:image/jpeg;base64,RED"'));
    say('...the team picture of a lane without a team is empty, and a custom text can use {team}', val('teampicture', 0) === '' && val('textlane', 0) === 'Shared / Alex');
    say('the other screens are given the teams that the layout shows (Red Bulls with its picture, Blue Moons), not the others', JSON.stringify((sent.stat.teams || []).map(t => t.id).sort()) === JSON.stringify(['T1', 'T2']) && sent.stat.teams.find(t => t.id === 'T1').picture === 'data:image/jpeg;base64,RED' && sent.stat.teams.find(t => t.id === 'T1').name === 'Red Bulls');
    say('...and a window that opens late gets the car with its team', JSON.stringify(sent.stat).includes('"teamName":"Shared"'));
    await wait(150); run('state.race = null; live = null'); saved.length = 0; store.layouts = [];
  }

  // ---------- the results ----------
  { store.tracks = [{ id: 't1', name: 'Living room', lanes: 2 }];
    const standings = [{ pos: 1, asTeam: true, driverId: '', driverName: 'Red Bulls', teamId: 'T1', teamName: 'Red Bulls', carId: 'c1', carName: 'Car1', laps: 6, points: 0, best: 4800, total: null, drivers: [{ driverId: 'd1', driverName: 'Alex', laps: 4 }, { driverId: 'd2', driverName: 'Sam', laps: 2 }] }, { pos: 2, asTeam: true, driverId: '', driverName: 'Blue Moons', teamId: 'T2', teamName: 'Blue Moons', carId: 'c2', carName: 'Car2', laps: 5, points: 0, best: 5000, total: null, drivers: [{ driverId: 'd3', driverName: 'Kim', laps: 5 }] }];
    store.sessions = [{ id: 'S1', setupName: 'Team race', sessionType: 'heats', trackId: 't1', trackName: 'Living room', date: '2026-10-16T10:00:00.000Z', resultBy: 'laps', endedBy: '', standings,
      heatResults: [{ heat: 1, rows: [{ participant: 0, pos: 1, laps: 6, driverName: 'Red Bulls (Alex)', by: 'Alex', teamId: 'T1', points: 0, best: 4800 }, { participant: 1, pos: 2, laps: 5, driverName: 'Blue Moons (Kim)', by: 'Kim', teamId: 'T2', points: 0, best: 5000 }] }] },
      { id: 'S2', setupName: 'Plain race', sessionType: 'race', trackId: 't1', trackName: 'Living room', date: '2026-10-15T10:00:00.000Z', endedBy: '', standings: [{ pos: 1, driverId: 'd1', driverName: 'Alex', teamId: 'T1', teamName: 'Red Bulls', carId: 'c1', carName: 'Car1', laps: 3, best: 4800, total: 15000 }, { pos: 2, driverId: 'd3', driverName: 'Kim', carId: 'c2', carName: 'Car2', laps: 3, best: 5000, total: 16000 }] }];
    store.laps = [{ id: 'l1', sessionId: 'S1', driverId: 'd1', teamId: 'T1', carId: 'c1', trackId: 't1', heat: 1, lapNumber: 1, time: 4800 }, { id: 'l2', sessionId: 'S1', driverId: 'd2', teamId: 'T1', carId: 'c1', trackId: 't1', heat: 2, lapNumber: 1, time: 5200 }, { id: 'l3', sessionId: 'S1', driverId: 'd3', teamId: 'T2', carId: 'c2', trackId: 't1', heat: 1, lapNumber: 1, time: 5000 }];
    await sub('results'); await wait(40);
    const html = E('resbody').innerHTML;
    say('the Results page of a team race: the team is the row with the drivers who drove next to it, in brackets, with their laps', html.includes('Red Bulls <span class="muted">(drivers: Alex (4 laps), Sam (2 laps))</span>') && html.includes('Blue Moons <span class="muted">(drivers: Kim (5 laps))</span>'));
    say('...the Team column is there for the race with a team on a lane (Red Bulls), and not the ones without teams in the standings', html.includes('<th>Team</th>') && html.includes('<td>Red Bulls</td>') && (html.match(/<th>Team<\/th>/g) || []).length === 1);
    say('...every heat says who drove (the driver in brackets behind the team)', html.includes('Red Bulls (Alex) (6 laps') && html.includes('Blue Moons (Kim) (5 laps'));
    say('...the lap times of a team are those of all its drivers, with the heat they were driven in (H1 4.800 and H2 5.200)', html.includes('H1 1: 4.800') && html.includes('H2 1: 5.200'));
  }

  // ---------- the view settings of the page ----------
  say('the Teams page has View settings (columns of the list)', run("VIEW_ENTITIES.includes('teams')"));

  reachedEnd = true; console.log(fails ? fails + ' TEAMS SCREEN TESTS FAILED' : 'ALL TEAMS SCREEN TESTS PASSED'); process.exit(fails ? 1 : 0);
})();
