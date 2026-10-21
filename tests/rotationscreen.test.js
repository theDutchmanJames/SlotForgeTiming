// 1.6.0: Rotation Setups on screen: the Rotation Setups tab and its editor (places, groups, locking, order, lanes, plans, size, undo, saving), the Rotation setup choice in the race setup form,
// and the Home tab with a rotation (the plan, the names, the participants who are not here, what stops a race), against a stand-in for the app window.
const vm = require('vm'), fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..') + '/';
const schema = require(R + 'schema.js');
let fails = 0, reachedEnd = false;
process.on('exit', code => { if (code === 0 && !reachedEnd) { console.log('FAIL the test stopped before its end (something waited for ever)'); process.exitCode = 1; } });
process.on('unhandledRejection', e => { console.log('UNHANDLED:', e.stack || e.message); process.exit(1); });
// (the stand-in does not read html: when the whole editor is drawn again, the parts inside it are given the html that the real page would have, as the real page does)
const parts = ['ro-pool', 'ro-hold', 'ro-grid', 'ro-remarks', 'ro-names', 'ro-groups', 'ro-how', 'ro-plans', 'ro-genopts', 'ro-msg'];
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
  drivers: [{ id: 'd1', name: 'Alex', nickname: 'Speedy', flag: 'NL' }, { id: 'd2', name: 'Sam' }, { id: 'd3', name: 'Kim' }, { id: 'd4', name: 'Lee' }],
  slotcars: [1, 2, 3, 4].map(i => ({ id: 'c' + i, brand: 'Car' + i, ...(i === 1 ? { tyreCompound: 'S' } : {}) })), racesetups: [], rotationsetups: [], weathersystems: [], fuelrules: [{ id: 'f1', name: 'Standard', tank: 100, perLap: 2, rate: 10, empty: 'retire' }], layouts: [], rowdesigns: [], sessions: [], laps: []
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
for (const f of ['listnum.js', 'bop.js', 'weather.js', 'tyrewear.js', 'safetycar.js', 'pushsave.js', 'racelimit.js', 'endurance.js', 'failures.js', 'damage.js', 'engine.js', 'heats.js', 'rotation.js', 'championship.js', 'champpoints.js', 'season.js', 'tokens.js', 'speed.js', 'distance.js','stats.js','homestats.js','carstats.js','viewset.js','picture.js','uiscale.js','depth.js','theme.js','banner.js', 'icons.js', 'delta.js','avatars.js', 'picmemo.js', 'weatherwidgets.js', 'tyrewidgets.js', 'pacewidgets.js', 'boardorder.js', 'widgets.js', 'frame.js', 'backdrop.js','announcer.js','sound.js', 'timing.js', 'rows.js', 'richtext.js', 'report.js', 'canvas.js', 'liveshare.js', 'review.js', 'adjustpad.js', 'adjustui.js', 'dirfolder.js', 'penaltyui.js', 'rotationdrag.js','padui.js','livegrid.js', 'homegrid.js', 'drivergrid.js', 'homecards.js', 'liveview.js', 'setupwords.js', 'formui.js', 'database.js', 'landing.js', 'race.js', 'undo.js', 'editor.js','tokenui.js', 'bopui.js', 'weatherui.js', 'tyreui.js', 'pushsaveui.js', 'rotationui.js', 'championshipui.js', 'audioedit.js','widgetbuilder.js','transferui.js','themeui.js','hardware.js','trackmate.js','hardwareui.js', 'dsui.js', 'app.js']) vm.runInContext(fs.readFileSync(R + 'renderer/' + f, 'utf8'), ctx, { filename: f });
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

const Rot = require(R + 'renderer/rotation.js');
(async () => {
  await wait(50); ctx.__sent = sent;
  const rotRec = () => ({ id: 'r1', name: 'Club night', participants: 8, lanes: 4, note: '', names: ['Alex', 'Sam'], groups: [{ name: 'Pros', members: [0, 1] }], heats: [
    { label: 'A', locked: false, places: [0, 1, 2, 3].map((p, lane) => ({ p, lane })) }, { label: 'B', locked: false, places: [4, 5, 6, 7].map((p, lane) => ({ p, lane })) }, { label: 'C', locked: false, places: [0, 2, 4, 6].map((p, lane) => ({ p, lane })) }] });
  store.rotationsetups = [];
  store.drivers = ['Alex', 'Sam', 'Kim', 'Lee', 'Max', 'Zoe', 'Jan', 'Tim'].map((n, i) => ({ id: 'd' + (i + 1), name: n }));
  store.slotcars = Array.from({ length: 8 }, (_, i) => ({ id: 'c' + (i + 1), brand: 'Car' + (i + 1) }));

  const box = () => E('setupmgr'), html = () => box().innerHTML;
  const press = b => box().onclick({ target: { closest: () => ({ dataset: {}, disabled: false, ...b }) } });
  const planBtn = k => press({ dataset: { plan: k } });
  const cell = (i, l) => press({ dataset: { cell: `${i}:${l}` } }), chip = p => press({ dataset: { pp: String(p) } }), btn = id => press({ id });
  const draft = () => JSON.parse(run('JSON.stringify(rotEd.draft)')), hist = () => run('rotEd.history.stats()');
  const msg = () => E('ro-msg').textContent;
  const places = (rec, i) => rec.heats[i].places.map(e => e.p + '@' + e.lane).join(' ');
  const labels = () => draft().heats.map(h => h.label).join('');
  const cellsHtml = () => (html().match(/data-cell="/g) || []).length;
  const keyOf = (k, o = {}) => { ctx.__k = { key: k, target: { matches: () => false }, preventDefault() {}, ...o }; run('draftKeyHandler(__k)'); };
  const typing = (el, v) => el.oninput({ target: { value: v } });
  const setSize = (n, l) => { E('ro-n').value = String(n); E('ro-lanes').value = String(l); };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const edit = async id => { await run('render()'); await wait(20); await press({ dataset: { edit: id } }); };
  run("state.settings = { theme: 'dark' }; rotEd = null; state.tab = 'setup'; state.setupSub = 'rotation'"); await run('render()'); await wait(50);

  // ---------- the tab and the list ----------
  const tabs = E('setuptabs').innerHTML;
  say('Race Setup has a Rotation Setups tab, in the Setups group and after the Systems (the last of them is Push and Save Systems)', tabs.includes('Rotation Setups') && tabs.indexOf('Race Setups') < tabs.indexOf('Rotation Setups') && tabs.indexOf('Push and Save Systems') < tabs.indexOf('Rotation Setups'));
  say('the strip of the Race Setup tab (1.45.0) has the Rotation Setups button selected, twelve tabs in all, and the page under it carries the brown of that sub-tab (its buttons use it)', /class="sstab ss-rot" role="tab" aria-selected="true" data-id="rotation"/.test(tabs) && (tabs.match(/role="tab"/g) || []).length === 12 && (tabs.match(/aria-selected="true"/g) || []).length === 1 && run('view.innerHTML').includes('class="setuppage ss-rot"'));
  say('...with a note that says what a rotation setup is, and that a race setup chooses one', E('setupnote').textContent.includes('A rotation setup is a heat plan that you make yourself') && E('setupnote').textContent.includes('Choose one in a race setup'));
  say('the list is empty to begin with, with a button for a new one and a line that says the participants are numbers', html().includes('id="newrot"') && html().includes('No rotation setups yet.') && html().includes('participants are numbers'));

  // ---------- a new rotation: filling and swapping places ----------
  await btn('newrot');
  say('a new rotation is 8 participants on 4 lanes, everybody racing once (2 heats of 4), named New rotation, not saved yet', draft().name === 'New rotation' && draft().participants === 8 && draft().lanes === 4 && draft().heats.length === 2 && cellsHtml() === 8 && html().includes('value="New rotation"') && run('rotEd.dirty') === true && run('rotEd.id') === null);
  say('...the grid has a row per heat and a column per lane, and the participants are P1 to P8 with the number of heats they race', html().includes('<th>Lane 1</th>') && html().includes('<th>Lane 4</th>') && !html().includes('<th>Lane 5</th>') && (html().match(/data-pp="/g) || []).length === 8 && html().includes('>P1 <small>1</small>') && html().includes('>P8 <small>1</small>'));
  say('...it says that everybody races 1 heat, and how to fill a place', html().includes('Every participant races 1 heat.') && html().includes('To fill a place: drag a participant onto it, or click a participant and then a place.'));
  say('...Undo and Redo are there and both off', html().includes('id="ro-undo"') && html().includes('id="ro-redo"') && E('ro-undo').disabled === true && E('ro-redo').disabled === true);
  say('...the plan options are shut when there are heats', html().includes('<details class="hplanes" id="ro-genbox">') && !html().includes('id="ro-genbox" open'));
  await chip(0);
  say('a participant is picked: the page says so and the chip is pressed', E('ro-hold').innerHTML.includes('Participant 1 is picked. Click a place to put them there') && /data-pp="0" aria-pressed="true"/.test(E('ro-pool').innerHTML) && /class="rochip sel/.test(E('ro-pool').innerHTML));
  await chip(0); say('...picking the same participant again lets go', !E('ro-hold').innerHTML.includes('is picked') && run('rotEd.hold') === null);
  await chip(0); await cell(1, 3);
  say('a participant picked and a place clicked: P1 stands there (heat 2, lane 4) and P8, who was there, leaves that heat; one step to undo', places(draft(), 1) === '4@0 5@1 6@2 0@3' && run('rotEd.hold') === null && hist().undo === 1);
  say('...the counts follow: P1 races 2 heats and P8 none, and the page warns about P8', E('ro-pool').innerHTML.includes('>P1 <small>2</small>') && E('ro-pool').innerHTML.includes('>P8 <small>0</small>') && /class="rochip none"/.test(E('ro-pool').innerHTML) && E('ro-remarks').innerHTML.includes('This participant races no heat: P8.') && E('ro-remarks').innerHTML.includes('hpwarn'));
  await cell(0, 0);
  say('a place is picked: the page names the place and who is in it', E('ro-hold').innerHTML.includes('Heat 1, lane 1 (Participant 1) is picked') && E('ro-hold').innerHTML.includes('id="ro-empty">') && /data-cell="0:0"[^>]* aria-pressed="true"/.test(E('ro-grid').innerHTML));
  await cell(0, 0); say('...clicking it again lets go, and that is no step', run('rotEd.hold') === null && hist().undo === 1);
  await cell(0, 1); await cell(1, 0);
  say('two places clicked swap (heat 1 lane 2 with heat 2 lane 1): P2 and P5 change heats; the pick is gone; one more step', places(draft(), 0) === '0@0 4@1 2@2 3@3' && places(draft(), 1) === '1@0 5@1 6@2 0@3' && run('rotEd.hold') === null && hist().undo === 2);
  await cell(0, 0); await cell(1, 1);
  say('a swap that would put a participant in a heat twice is refused, in words, and nothing changes', msg() === 'That would put a participant in the same heat twice.' && places(draft(), 0) === '0@0 4@1 2@2 3@3' && hist().undo === 2);
  say('...the first place stays picked, so another click can try again', run('rotEd.hold.kind') === 'cell' && E('ro-hold').innerHTML.includes('Heat 1, lane 1'));
  await btn('ro-drop'); say('Let go drops the pick', run('rotEd.hold') === null && !E('ro-hold').innerHTML.includes('is picked'));
  await cell(1, 3); await btn('ro-empty');
  say('Empty this place takes the participant out of the picked place (P1 leaves heat 2)', places(draft(), 1) === '1@0 5@1 6@2' && hist().undo === 3 && run('rotEd.hold') === null);
  await cell(1, 3);
  say('an empty place that is picked says so, and the Empty button is off', E('ro-hold').innerHTML.includes('Heat 2, lane 4 (empty) is picked') && E('ro-hold').innerHTML.includes('id="ro-empty" disabled'));
  await cell(1, 0); say('...a click on the place of a participant moves that participant there (P2 from lane 1 to lane 4)', places(draft(), 1) === '5@1 6@2 1@3' && hist().undo === 4);
  await btn('ro-empty'); say('Empty this place with nothing picked does nothing', hist().undo === 4 && places(draft(), 1) === '5@1 6@2 1@3');

  // ---------- Undo and redo ----------
  E('ro-undo').onclick(); say('Undo takes the last change back, and says so', places(draft(), 1) === '1@0 5@1 6@2' && msg() === 'Undone.' && E('ro-redo').disabled === false && cellsHtml() === 8);
  E('ro-redo').onclick(); say('Redo brings it back', places(draft(), 1) === '5@1 6@2 1@3' && msg() === 'Redone.');
  keyOf('z', { ctrlKey: true }); say('Ctrl+Z is Undo', places(draft(), 1) === '1@0 5@1 6@2');
  keyOf('y', { ctrlKey: true }); say('Ctrl+Y is Redo', places(draft(), 1) === '5@1 6@2 1@3');
  keyOf('z', { ctrlKey: true, target: { matches: s => s.includes('input'), type: 'text' } }); say('Ctrl+Z inside a text box is left to the text box', places(draft(), 1) === '5@1 6@2 1@3');

  // ---------- the size ----------
  ctx.confirm = () => false; setSize(6, 4); E('ro-n').onchange(); await wait(20);
  say('fewer participants take places away and ask first; No leaves the rotation as it was (drawn again)', draft().participants === 8 && html().includes('value="8"') && cellsHtml() === 8 && (html().match(/data-pp="/g) || []).length === 8);
  let asked = ''; ctx.confirm = t => { asked = t; return true; }; setSize(6, 4); E('ro-n').onchange(); await wait(20);
  say('...Yes takes them away: 6 participants, the place of P7 is gone (P8 has none), and the question said how many ("1 place")', draft().participants === 6 && !draft().heats.some(h => h.places.some(e => e.p >= 6)) && asked.includes('takes away 1 place that no longer fit. Undo brings it back.') && (html().match(/data-pp="/g) || []).length === 6 && html().includes('value="6"'));
  E('ro-undo').onclick(); say('...and Undo gives the 8 participants and their places back', draft().participants === 8 && places(draft(), 1) === '5@1 6@2 1@3' && (html().match(/data-pp="/g) || []).length === 8);
  asked = ''; setSize(10, 4); E('ro-n').onchange(); await wait(20); say('more participants ask nothing and add chips', asked === '' && draft().participants === 10 && (html().match(/data-pp="/g) || []).length === 10);
  setSize(10, 6); E('ro-lanes').onchange(); await wait(20); say('more lanes add a column to every heat', draft().lanes === 6 && html().includes('<th>Lane 6</th>') && cellsHtml() === 12);
  setSize(10, 3); E('ro-lanes').onchange(); await wait(20); say('fewer lanes take away the places in the lanes that go, and ask first (the places of lane 4 and higher; several places: "places" and "them")', draft().lanes === 3 && !html().includes('<th>Lane 4</th>') && /takes away [2-9] places that no longer fit\. Undo brings them back\./.test(asked) && draft().heats.every(h => h.places.every(e => e.lane < 3)));
  while (hist().undo > 0) E('ro-undo').onclick();
  say('...everything is undone step by step to the rotation as it was made', draft().participants === 8 && draft().lanes === 4 && places(draft(), 0) === '0 1 2 3'.split(' ').map((p, l) => p + '@' + l).join(' '));

  // ---------- adding and taking out participants (1.45.0) ----------
  { // (a rotation with two named participants and a group, to see that names and groups move up with the numbers)
    box().oninput({ target: { dataset: { name: '0' }, value: 'Alex' } }); box().oninput({ target: { dataset: { name: '1' }, value: 'Sam' } });
    btn('ro-addgrp'); await wait(10); press({ dataset: { gm: '0:0' } }); press({ dataset: { gm: '0:1' } });
    const before = draft(), n0 = before.participants, u0 = hist().undo, delBtns = () => (html().match(/data-delp="/g) || []).length;
    say('(set-up: Alex and Sam are named and in the group "Group 1")', draft().names[1] === 'Sam' && draft().groups.length === 1 && draft().groups[0].members.join() === '0,1');
    say('the participants have an Add button above the pool and an × for each one in the list of names; the list is open to begin with', html().includes('data-addp="1"') && delBtns() === n0 && html().includes('id="ro-namesbox" open') && html().includes('aria-label="Take participant 3 out"'));
    say('the × of participant 3 is the one with number 2 (the numbers in the page start at 0), and it says so for a screen reader', html().includes('data-delp="2" aria-label="Take participant 3 out"') && html().includes(`data-delp="${n0 - 1}" aria-label="Take participant ${n0} out"`) && !html().includes(`data-delp="${n0}"`));
    let focused = ''; box().querySelector = sel => ({ focus() { focused = sel; } });
    press({ dataset: { addp: '1' } }); await wait(20); delete box().querySelector;
    say('Add a participant puts the cursor in the name of the new participant', focused === `[data-name="${n0}"]`);
    say('Add a participant adds P9 at the end: in no heat, with no name, the others as they were, one step to undo', draft().participants === n0 + 1 && same(draft().names.slice(0, n0), before.names) && draft().names[n0] === '' && same(draft().heats, before.heats) && (html().match(/data-pp="/g) || []).length === n0 + 1 && hist().undo === u0 + 1);
    E('ro-undo').onclick(); say('...and Undo takes P9 away again', draft().participants === n0 && (html().match(/data-pp="/g) || []).length === n0);
    E('ro-redo').onclick(); say('...Redo brings it back', draft().participants === n0 + 1);
    // taking one out: Sam is P2, in heat A only; the participants after Sam move up one number
    let q = ''; ctx.confirm = t => { q = t; return false; };
    press({ dataset: { delp: '1' } }); await wait(20);
    say('taking out a participant who is in a heat asks first, and says who and in how many heats', q.includes('Sam is in 1 heat. Taking them out removes them from that heat, and everybody after them moves up one number. Undo brings them back.') && q.includes('Continue?'));
    say('...No leaves the rotation as it was', draft().participants === n0 + 1 && places(draft(), 0) === '0@0 1@1 2@2 3@3' && hist().undo === u0 + 1);
    ctx.confirm = t => { q = t; return true; };
    press({ dataset: { delp: '1' } }); await wait(20);
    say('...Yes takes Sam out: 8 participants again; heat A has P1, and P3 and P4 as P2 and P3, in the lanes they had', draft().participants === n0 && places(draft(), 0) === '0@0 1@2 2@3' && delBtns() === n0);
    say('...the name goes with the participant, the names after it move up, and Sam leaves the group', draft().names[0] === 'Alex' && !draft().names.includes('Sam') && draft().names.length === n0 && draft().groups[0].members.join() === '0');
    say('...in heat B (P5, P6, P7, P8) the numbers moved up by one: P4, P5, P6, P7, in the same lanes', places(draft(), 1) === '3@0 4@1 5@2 6@3');
    E('ro-undo').onclick(); say('...Undo gives Sam back with everything: places, name and group', draft().participants === n0 + 1 && places(draft(), 0) === '0@0 1@1 2@2 3@3' && draft().names[1] === 'Sam' && draft().groups[0].members.join() === '0,1');
    q = ''; press({ dataset: { delp: String(n0) } }); await wait(20);
    say('a participant who is in no heat (the new P9) is taken out without a question', q === '' && draft().participants === n0 && same(draft().heats, before.heats));
    // the column of buttons follows the limits: the least is 2, the most is 64
    ctx.confirm = () => true; setSize(2, 4); E('ro-n').onchange(); await wait(20);
    say('with 2 participants every × is disabled (a rotation needs two), and a click on one does nothing', draft().participants === 2 && (html().match(/data-delp="\d+"[^>]*disabled/g) || []).length === 2);
    press({ dataset: { delp: '0' }, disabled: true }); say('...clicked anyway: nothing changes', draft().participants === 2);
    ctx.__minus = Rot.removeParticipant(draft(), 0); say('...and the function says so in words', ctx.__minus.error === 'A rotation needs at least 2 participants.');
    setSize(64, 4); E('ro-n').onchange(); await wait(20);
    say('with 64 participants the Add button is disabled and says why', draft().participants === 64 && /data-addp="1" disabled title="A rotation holds at most 64"/.test(html()));
    press({ dataset: { addp: '1' } }); say('...clicked anyway: the page says the most is 64 and nothing changes', draft().participants === 64 && msg() === 'A rotation holds at most 64 participants.');
    while (hist().undo > u0) E('ro-undo').onclick();
    // the list of names remembers that it was closed
    E('ro-namesbox').open = false; E('ro-namesbox').ontoggle();
    press({ dataset: { addp: '1' } }); await wait(20);
    say('a list of names that was closed stays closed when a participant is added', draft().participants === n0 + 1 && !html().includes('id="ro-namesbox" open'));
    E('ro-namesbox').open = true; E('ro-namesbox').ontoggle(); E('ro-undo').onclick();
    say('...and the start is as it was: 8 participants, the heats, names and group of the start', draft().participants === n0 && same(draft().heats, before.heats) && same(draft().names, before.names) && same(draft().groups, before.groups));
    while (hist().undo > 0) E('ro-undo').onclick(); // (the next checks start from the rotation as it was made)
  }

  // ---------- 1.8.0: the participants are drivers or teams ----------
  say('the editor asks what the participants are: Drivers (chosen), or Teams', html().includes('id="ro-kind"') && html().includes('Participants are') && html().includes('<option value="drivers" selected>Drivers</option>') && html().includes('<option value="teams">Teams</option>') && !('participantsAre' in draft()));
  E('ro-kind').onchange({ target: { value: 'teams' } }); await wait(20);
  say('Teams changes the words (Team 1, 8 teams...), the names box and the pick-by-name help, and is one step to undo', draft().participantsAre === 'teams' && html().includes('<option value="teams" selected>Teams</option>') && html().includes('title="Team 1: races') && html().includes('placeholder="Team 1"') && html().includes('picks the teams that have these names') && !html().includes('picks the drivers who have these names') && hist().undo === 1);
  say('...the places in the heats are not touched', places(draft(), 0) === '0@0 1@1 2@2 3@3' && cellsHtml() === 8);
  E('ro-undo').onclick(); await wait(20);
  say('Undo makes the participants drivers again', !('participantsAre' in draft()) && html().includes('<option value="drivers" selected>Drivers</option>') && html().includes('title="Participant 1: races') && html().includes('placeholder="Participant 1"'));
  E('ro-kind').onchange({ target: { value: 'teams' } }); await wait(20); E('ro-save').onclick(); await wait(30);
  say('Save keeps the choice in the rotation setup', writes.filter(w => w[1] === 'rotationsetups').pop()[2].participantsAre === 'teams');
  E('ro-back').onclick(); await wait(30);
  say('...and the list tells it in words (8 teams)', html().includes('8 teams, 4 lanes, 2 heats'));
  await edit(store.rotationsetups[store.rotationsetups.length - 1].id);
  while (hist().undo > 0) E('ro-undo').onclick(); await wait(20);

  // ---------- starting from a plan ----------
  ctx.confirm = () => true;
  await planBtn('perdriver');
  say('the plan options change with the plan: the same number of heats asks for the heats for everybody', E('ro-genopts').innerHTML.includes('id="ro-geach"') && !E('ro-genopts').innerHTML.includes('id="ro-gheats"'));
  await planBtn('roundrobin'); say('...a round robin asks whether everybody races the same number of heats', E('ro-genopts').innerHTML.includes('id="ro-geven"') && !E('ro-genopts').innerHTML.includes('id="ro-geach"'));
  await planBtn('rotation'); say('...a lane rotation asks nothing more', E('ro-genopts').innerHTML === '');
  await planBtn('manual'); say('...shuffled asks for the number of heats', E('ro-genopts').innerHTML.includes('id="ro-gheats"'));
  await planBtn('perdriver'); box().oninput({ target: { id: 'ro-geach', value: '2', dataset: {} } });
  ctx.confirm = () => false; const before = JSON.stringify(draft().heats); await btn('ro-gen');
  say('Make the heats asks first when there are heats, and No changes nothing', JSON.stringify(draft().heats) === before);
  asked = ''; ctx.confirm = t => { asked = t; return true; }; await btn('ro-gen');
  say('...Yes replaces them: 2 heats for everybody is 4 heats of 4, nothing is empty, nobody races none or more than twice, and the question says that locked heats go too', draft().heats.length === 4 && draft().heats.every(h => h.places.length === 4) && cellsHtml() === 16 && asked.includes('Locked heats are replaced too') && E('ro-remarks').innerHTML.includes('Every participant races 2 heats.') && msg() === '');
  E('ro-undo').onclick(); say('...and Undo brings the old heats back', JSON.stringify(draft().heats) === before);
  await planBtn('manual'); box().oninput({ target: { id: 'ro-gheats', value: '3', dataset: {} } }); await btn('ro-gen');
  say('"Shuffled over a number of heats": 3 heats (8 participants over 3 heats of 4 lanes: 12 places)', draft().heats.length === 3 && draft().heats.every(h => h.places.length === 4));
  await planBtn('roundrobin'); box().oninput({ target: { id: 'ro-geven', checked: true, dataset: {} } }); await btn('ro-gen');
  say('a round robin with the same number of heats for everybody: every participant races the same', Rot.check(draft()).some(c => /^Every participant races \d+ heats\.$/.test(c.text)));
  await planBtn('rotation'); await btn('ro-gen');
  say('a lane rotation: 8 heats, everybody races once in every lane... (4 heats each: all four lanes once)', draft().heats.length === 8 && html().includes('Every participant races 4 heats.') && E('ro-remarks').innerHTML.includes('The lanes are shared evenly.'));

  // ---------- an existing rotation: groups, locking, order, lanes ----------
  store.rotationsetups = [rotRec()]; store.racesetups = [{ id: 'hs1', name: 'Club heats', sessionType: 'heats', track: 't4', laps: 6, rotation: 'r1' }];
  ctx.confirm = () => true; await E('ro-back').onclick(); await wait(30);
  say('Back goes to the list, which shows the rotation with its size and the race setups that use it', html().includes('Club night') && html().includes('8 participants, 4 lanes, 3 heats') && html().includes('Club heats') && run('rotEd') === null);
  await press({ dataset: { edit: 'r1' } });
  say('Edit opens the saved rotation: the heats and labels as saved, the names on the chips, the group in the heat rows, saved (nothing to save yet)', labels() === 'ABC' && html().includes('value="A"') && html().includes('value="C"') && E('ro-pool').innerHTML.includes('>Alex <small>2</small>') && E('ro-pool').innerHTML.includes('>Sam <small>1</small>') && E('ro-pool').innerHTML.includes('>P3 <small>2</small>') && html().includes('Pros (2)') && run('rotEd.dirty') === false && run('rotEd.id') === 'r1');
  say('...the names are in the list of names (open, because there are names) and the group is shown with its participants ticked', html().includes('<details class="hplanes" id="ro-namesbox" open>') && html().includes('value="Alex"') && html().includes('placeholder="Participant 3"') && html().includes('<details class="hplanes" id="ro-groupsbox" open>') && /data-gm="0:0" aria-pressed="true"/.test(html()) && /data-gm="0:2" aria-pressed="false"/.test(html()));
  say('...the remarks say that the participants race 1 to 2 heats, with the advice about the average', E('ro-remarks').innerHTML.includes('The participants race 1 to 2 heats.') && E('ro-remarks').innerHTML.includes('count the average per heat'));
  say('...and a table says how often everybody races and in which lane (Alex: 2 heats, lane 1 twice)', /<td><i class="rodot" style="--pc:#[0-9a-f]{6}"><\/i>Alex<\/td><td class="num">2<\/td><td class="num">2<\/td>/.test(html()));
  { const g0 = E('ro-grid').innerHTML, pl = E('ro-pool').innerHTML;
    say('the grid has a column for every lane (1 to 4), then the group choice and the buttons; the heats are numbered from 1', g0.includes('<th>Heat</th><th>Label</th><th>Lane 1</th><th>Lane 2</th><th>Lane 3</th><th>Lane 4</th><th>Group</th><th>This heat</th>') && /<\/span>1<\/td>/.test(g0) && /<\/span>3<\/td>/.test(g0) && !/<\/span>0<\/td>/.test(g0) && !/<\/span>4<\/td>/.test(g0));
    say('...the places, the labels, the group choices and the buttons are named for a screen reader, counting from 1', g0.includes('aria-label="Heat 1, lane 1: Alex"') && g0.includes('aria-label="Heat 3, lane 4: Participant 7"') && g0.includes('aria-label="Label of heat 1"') && g0.includes('aria-label="Label of heat 3"') && g0.includes('aria-label="Put a group in heat 1"') && g0.includes('aria-label="Put a group in heat 3"') && g0.includes('aria-label="Move heat 1 up"') && g0.includes('aria-label="Move heat 3 down"') && !g0.includes('heat 0') && !g0.includes('lane 0') && !g0.includes('heat 4'));
    say('...the first heat can not move up, the last can not move down, and the others can', /data-up="0"[^>]*disabled/.test(g0) && !/data-up="1"[^>]*disabled/.test(g0) && !/data-up="2"[^>]*disabled/.test(g0) && !/data-down="0"[^>]*disabled/.test(g0) && !/data-down="1"[^>]*disabled/.test(g0) && /data-down="2"[^>]*disabled/.test(g0));
    say('...a heat that is not locked is not marked as locked, and the group choice is on', !g0.includes('rolocked') && !g0.includes('🔒') && !/data-grp="\d"[^>]* disabled/.test(g0));
    say('the chips say how many heats every participant races (1 heat, 2 heats) for a screen reader', pl.includes('title="Alex: races 2 heats"') && pl.includes('title="Sam: races 1 heat"') && pl.includes('title="Participant 3: races 2 heats"'));
    say('the names are labelled P1 to P8, and a name box says which participant it is for (placeholder and screen reader)', E('ro-names').innerHTML.includes('placeholder="Participant 1"') && E('ro-names').innerHTML.includes('aria-label="Name of participant 8"') && !E('ro-names').innerHTML.includes('participant 0') && !E('ro-names').innerHTML.includes('Participant 9') && E('ro-names').innerHTML.includes('</i>P1 ') && E('ro-names').innerHTML.includes('</i>P8 ') && !E('ro-names').innerHTML.includes('</i>P0 ') && !E('ro-names').innerHTML.includes('</i>P9 '));
    say('...the group is named for a screen reader (group 1 by number, its members by its name)', E('ro-groups').innerHTML.includes('aria-label="Name of group 1"') && E('ro-groups').innerHTML.includes('aria-label="Participants in Pros"'));
    say('...the table of how often everybody races has a column for every lane', html().includes('<th>Participant</th><th>Heats</th><th>Lane 1</th><th>Lane 2</th><th>Lane 3</th><th>Lane 4</th></tr>'));
    say('...a remark that only informs is not drawn as a warning, and a warning is', /<p class="hint2">The participants race 1 to 2 heats/.test(E('ro-remarks').innerHTML) && !/hpwarn">The participants race/.test(E('ro-remarks').innerHTML));
    say('...the plan to start from is the first one, the shuffled plan (a button for each of the four plans, with a line that says what it makes); the plans are closed because there are heats', /data-plan="manual" aria-pressed="true"/.test(html()) && /data-plan="perdriver" aria-pressed="false"/.test(html()) && (html().match(/data-plan="/g) || []).length === 4 && html().includes('Everybody races once in every lane.') && html().includes('<details class="hplanes" id="ro-genbox">'));
    box().onclick({ target: { closest: () => null } }); await press({ disabled: true, dataset: { cell: '0:0' } });
    say('a click on nothing, or on a button that is off, does nothing', run('rotEd.hold') === null && hist().undo === 0);
  }
  box().onchange({ target: { dataset: { grp: '2' }, value: '0' } });
  say('a group goes into a heat with its choice: heat C is Alex and Sam in lanes 1 and 2, the other places empty; the choice goes back to "Put a group here"', places(draft(), 2) === '0@0 1@1' && cellsHtml() === 12 && E('ro-grid').innerHTML.includes('<option value="">Put a group here</option>') && hist().undo === 1);
  box().onchange({ target: { dataset: { grp: '0' }, value: '' } }); say('...choosing nothing does nothing', hist().undo === 1);
  await btn('ro-addgrp'); say('Add a group adds Group 2 (empty)', draft().groups.length === 2 && draft().groups[1].name === 'Group 2' && E('ro-groups').innerHTML.includes('value="Group 2"'));
  box().onchange({ target: { dataset: { grp: '2' }, value: '1' } }); say('an empty group cannot go in a heat: the page says so', msg() === 'The group "Group 2" has no participants yet.' && places(draft(), 2) === '0@0 1@1');
  for (const p of [0, 1, 2, 3, 4]) await press({ dataset: { gm: '1:' + p } });
  say('participants are ticked into a group (a participant can be in two groups)', same(draft().groups[1].members, [0, 1, 2, 3, 4]) && /data-gm="1:4" aria-pressed="true"/.test(E('ro-groups').innerHTML));
  box().onchange({ target: { dataset: { grp: '2' }, value: '1' } }); say('a group with more participants than lanes is refused in words', msg() === 'The group "Group 2" has 5 participants, and a heat holds only 4.');
  await press({ dataset: { gm: '1:4' } }); box().onchange({ target: { dataset: { grp: '1' }, value: '1' } }); say('with 4 it fits (heat B is P1 to P4)', places(draft(), 1) === '0@0 1@1 2@2 3@3');
  box().oninput({ target: { dataset: { gname: '1' }, value: 'Kids' } });
  say('a group is renamed by typing (the heat rows show the new name; the box where you type is not drawn again)', draft().groups[1].name === 'Kids' && E('ro-grid').innerHTML.includes('Kids (4)'));
  box().oninput({ target: { dataset: { gname: '1' }, value: '' } }); await press({ dataset: { gm: '1:5' } });
  say('a group without a name is called Group 2 (the second) in the heat rows and "group 2" for a screen reader', E('ro-grid').innerHTML.includes('Group 2 (5)') && E('ro-groups').innerHTML.includes('aria-label="Participants in group 2"'));
  say('Add a group opens the list of groups', (await btn('ro-addgrp'), E('ro-groupsbox').open === true) && draft().groups.length === 3); await press({ dataset: { gdel: '2' } });
  await press({ dataset: { gdel: '1' } }); say('a group is removed, and it is gone from the heat rows too', draft().groups.length === 1 && !E('ro-groups').innerHTML.includes('Group 2') && !E('ro-grid').innerHTML.includes('Group 2 (5)') && E('ro-grid').innerHTML.includes('Pros (2)'));
  while (hist().undo > 0) E('ro-undo').onclick();
  say('(everything undone: back to the rotation as it was saved)', labels() === 'ABC' && places(draft(), 2) === '0@0 2@1 4@2 6@3' && draft().groups.length === 1 && run('rotEd.dirty') === false);

  await press({ dataset: { lock: '1' } });
  say('a heat is locked: the row says so, the button becomes Unlock', draft().heats[1].locked === true && /data-lock="1" aria-pressed="true"[^>]*>Unlock</.test(E('ro-grid').innerHTML) && E('ro-grid').innerHTML.includes('aria-hidden="true">🔒') && E('ro-grid').innerHTML.includes('class="rolocked"') && /data-grp="1"[^>]* disabled/.test(E('ro-grid').innerHTML));
  await cell(1, 0); await cell(0, 0); say('a place in a locked heat cannot be swapped: the page says which heat is locked', msg() === 'Heat 2 is locked. Unlock it first to change it.' && places(draft(), 0) === '0@0 1@1 2@2 3@3'); await btn('ro-drop');
  await press({ dataset: { del: '1' } }); say('...nor can the heat be deleted', msg() === 'Heat 2 is locked. Unlock it first to change it.' && draft().heats.length === 3);
  await btn('ro-rev'); say('reversing the order turns the heats round, and the locked heat stays where it is (A B C becomes C B A)', labels() === 'CBA' && draft().heats[1].locked === true);
  await btn('ro-rev'); say('...and again', labels() === 'ABC');
  await btn('ro-shufo'); say('shuffling the order keeps the locked heat in place, and all the heats', draft().heats[1].label === 'B' && labels().split('').sort().join('') === 'ABC');
  const orig = Object.fromEntries(rotRec().heats.map(h => [h.label, h.places.map(e => e.p).sort().join()]));
  await btn('ro-shufl'); say('shuffling the lanes keeps the participants of every heat (and the locked heat exactly as it is)', draft().heats.every(h => h.places.map(e => e.p).sort().join() === orig[h.label]) && places(draft(), 1) === '4@0 5@1 6@2 7@3');
  await btn('ro-even'); say('Even out the lanes gives the lanes out again: every heat keeps its participants', draft().heats.every(h => new Set(h.places.map(e => e.lane)).size === h.places.length) && same(draft().heats.map(h => h.places.length), [4, 4, 4]));
  await press({ dataset: { lock: '1' } }); say('Unlock unlocks', draft().heats[1].locked === false);
  while (hist().undo > 0) E('ro-undo').onclick();
  await press({ dataset: { up: '2' } }); say('Up moves heat C above heat B', labels() === 'ACB');
  await press({ dataset: { down: '0' } }); say('Down moves heat A below the next one', labels() === 'CAB');
  await press({ dataset: { clear: '0' } }); say('Empty takes everybody out of heat C; the remarks say it will be left out', draft().heats[0].places.length === 0 && E('ro-remarks').innerHTML.includes('Heat 1 is empty and will be left out of the race.'));
  await press({ dataset: { dup: '1' } }); say('Copy puts a copy of heat A below it', labels() === 'CAAB' && places(draft(), 1) === places(draft(), 2));
  await press({ dataset: { del: '0' } }); say('Delete takes a heat away', labels() === 'AAB' && cellsHtml() === 12);
  while (hist().undo > 0) E('ro-undo').onclick();
  box().oninput({ target: { dataset: { label: '0' }, value: 'Juniors' } }); say('a label is typed into the draft; the row is not drawn again while typing', draft().heats[0].label === 'Juniors' && run('rotEd.dirty') === true);
  box().oninput({ target: { dataset: { name: '3' }, value: 'Lee' } }); say('a name is typed: the chip and the cells show it at once', E('ro-pool').innerHTML.includes('>Lee <small>1</small>') && E('ro-grid').innerHTML.includes('>Lee</button>') && draft().names[3] === 'Lee');
  box().oninput({ target: { dataset: { name: '4' }, value: ' alex' } }); say('two participants with the same name are reported, capitals and spaces do not matter', E('ro-remarks').innerHTML.includes('The name &quot;Alex&quot; is used twice.'));
  typing(E('ro-name'), 'Friday'); typing(E('ro-note'), 'For the club night'); say('the name and the note are typed into the draft', draft().name === 'Friday' && draft().note === 'For the club night');

  // ---------- saving ----------
  typing(E('ro-name'), '   '); writes.length = 0; await E('ro-save').onclick();
  say('a rotation without a name is not saved, and the page asks for a name', msg() === 'Please give the rotation setup a name.' && writes.length === 0);
  typing(E('ro-name'), '  Friday night  '); await E('ro-save').onclick();
  const upd = writes.find(w => w[0] === 'update');
  say('saving writes the rotation with a trimmed name, the heats, the names and the groups (an update of the saved one)', !!upd && upd[1] === 'rotationsetups' && upd[2] === 'r1' && upd[3].name === 'Friday night' && upd[3].heats.length === 3 && upd[3].heats[0].label === 'Juniors' && upd[3].names[3] === 'Lee' && upd[3].groups[0].name === 'Pros' && upd[3].participants === 8 && upd[3].id === undefined);
  say('...and says so; the rotation is not unsaved any more', msg() === 'Saved.' && run('rotEd.dirty') === false);
  box().oninput({ target: { dataset: { label: '1' }, value: 'Seniors' } });
  ctx.confirm = () => false; await E('ro-back').onclick(); say('Back with unsaved changes asks; No stays in the editor', run('rotEd') !== null);
  ctx.confirm = () => true; await E('ro-back').onclick(); await wait(20); say('...Yes goes back to the list, without saving', run('rotEd') === null && html().includes('Friday night') && !JSON.stringify(store.rotationsetups).includes('Seniors'));
  await press({ dataset: { edit: 'r1' } }); box().oninput({ target: { dataset: { label: '1' }, value: 'X' } });
  ctx.confirm = () => false; await E('setuptabs').onclick({ target: { closest: () => ({ dataset: { id: 'fuel' } }) } });
  say('another Race Setup tab asks first when there are unsaved changes; No stays', run('rotEd') !== null && run('state.setupSub') === 'rotation');
  ctx.confirm = () => true; await E('setuptabs').onclick({ target: { closest: () => ({ dataset: { id: 'fuel' } }) } }); await wait(30);
  say('...Yes leaves, and the editor is closed', run('rotEd') === null && run('state.setupSub') === 'fuel');
  run("state.setupSub = 'rotation'"); await run('render()'); await wait(30);
  await press({ dataset: { edit: 'r1' } }); { let q2 = 0; ctx.confirm = () => { q2++; return false; }; await E('setuptabs').onclick({ target: { closest: () => ({ dataset: { id: 'fuel' } }) } }); await wait(30);
    say('a rotation without unsaved changes is left without a question (the strip does not ask when there is nothing to lose)', q2 === 0 && run('rotEd') === null && run('state.setupSub') === 'fuel'); }
  run("state.setupSub = 'rotation'"); await run('render()'); await wait(30);
  writes.length = 0; await press({ dataset: { dup: 'r1' } }); await wait(20);
  say('Duplicate saves a copy with "(copy)" in its name', writes.some(w => w[0] === 'add' && w[1] === 'rotationsetups' && w[2].name === 'Friday night (copy)' && w[2].heats.length === 3));
  ctx.confirm = t => { asked = t; return false; }; writes.length = 0; await press({ dataset: { del: 'r1' } });
  say('Delete asks first, and says what happens to the race setups that use it; No deletes nothing', asked.includes('Delete the rotation setup "Friday night"') && asked.includes('plan their heats from their own settings again') && !writes.some(w => w[0] === 'remove'));
  ctx.confirm = () => true; await press({ dataset: { del: 'r1' } }); await wait(20); say('...Yes deletes it', writes.some(w => w[0] === 'remove' && w[2] === 'r1') && !store.rotationsetups.some(r => r.id === 'r1'));

  // ---------- a rotation without heats, and the plan to start from ----------
  store.rotationsetups = [{ id: 'r9', name: 'Twenty', note: '', participants: 20, lanes: 4, names: [], groups: [], heats: [] }];
  await edit('r9');
  say('a rotation without heats says so, and its plan options are open', html().includes('No heats yet. Add a heat, or start from a plan.') && html().includes('<details class="hplanes" id="ro-genbox" open>') && !html().includes('<th>Lane 1</th><th>Lane 2</th><th>Lane 3</th><th>Lane 4</th><th>Group</th>'));
  say('...the plan starts as a shuffle over 5 heats (20 participants on 4 lanes), 2 heats for everybody, and not "the same number of heats" for a round robin', E('ro-genopts').innerHTML.includes('id="ro-gheats"') && E('ro-genopts').innerHTML.includes('value="5"') && run('rotEd.gen.each') === 2 && run('rotEd.gen.even') === false);
  await planBtn('roundrobin'); say('...the round robin box is not ticked', E('ro-genopts').innerHTML.includes('id="ro-geven"') && !E('ro-genopts').innerHTML.includes(' checked'));
  await planBtn('manual');
  await btn('ro-add'); setSize(20, 3); E('ro-lanes').onchange(); await wait(20);
  say('with a heat the plan options are closed, until somebody opens them (and that is remembered when the editor is drawn again)', html().includes('<details class="hplanes" id="ro-genbox">') && !html().includes('id="ro-genbox" open'));
  E('ro-genbox').open = true; E('ro-genbox').ontoggle(); say('...opening them is noted', run('rotEd.genOpen') === true);
  setSize(20, 4); E('ro-lanes').onchange(); await wait(20); say('...and they stay open', html().includes('id="ro-genbox" open'));
  E('ro-genbox').open = false; E('ro-genbox').ontoggle(); say('...closing them is noted too', run('rotEd.genOpen') === false);
  ctx.confirm = () => true; await E('ro-back').onclick(); await wait(20);

  // ---------- 1.14.0: the Rotation Editor made clearer ----------
  store.rotationsetups = []; await run('render()'); await wait(20); await btn('newrot');
  say('1.14.0: a page in order: name and buttons, the size, the plans, the participants, the heats with their tools, the remarks, then names, groups and the table', (() => { const h = html(); const at = x => h.indexOf(x); return at('id="ro-name"') < at('class="ed-bar ro-size"') && at('class="ed-bar ro-size"') < at('id="ro-genbox"') && at('id="ro-genbox"') < at('id="ro-pool"') && at('id="ro-pool"') < at('id="ro-add"') && at('id="ro-add"') < at('id="ro-grid"') && at('id="ro-grid"') < at('id="ro-remarks"') && at('id="ro-remarks"') < at('id="ro-namesbox"') && at('id="ro-namesbox"') < at('id="ro-groupsbox"'); })() && html().includes('Drag one to a place, or click it to pick it up') && html().includes('click a place to fill it or to swap it with another place'));
  say('...the places are drawn as places: an empty one says "empty" (and is marked), a filled one has the participant', !html().includes('hpcell empty') && html().includes('class="hpcell" data-cell="0:0"'));
  setSize(10, 4); E('ro-n').onchange(); await wait(20);
  say('the number of heats of the plan follows the size until you choose one: 10 participants on 4 lanes is 3 heats (it was 2 for 8)', run('rotEd.gen.heats') === 3 && E('ro-genopts').innerHTML.includes('value="3"'));
  say('...the page warns about the two who race no heat, with a button that adds a heat for them', E('ro-remarks').innerHTML.includes('These participants race no heat: P9, P10.') && E('ro-remarks').innerHTML.includes('data-fix="idle"') && E('ro-remarks').innerHTML.includes('Add a heat for them'));
  { const n0 = hist().undo, h0 = draft().heats.length; await press({ dataset: { fix: 'idle' } });
    say('the button puts a new heat at the end with P9 in lane 1 and P10 in lane 2, in one step to undo; the warning is gone', draft().heats.length === h0 + 1 && places(draft(), h0) === '8@0 9@1' && hist().undo === n0 + 1 && !E('ro-remarks').innerHTML.includes('no heat') && !E('ro-remarks').innerHTML.includes('data-fix'));
    E('ro-undo').onclick(); say('...Undo takes the heat away again', draft().heats.length === h0 && E('ro-remarks').innerHTML.includes('data-fix="idle"')); }
  await planBtn('manual'); box().oninput({ target: { id: 'ro-gheats', value: '4', dataset: {} } }); setSize(10, 4); E('ro-n').onchange(); await wait(20);
  say('...a number of heats that you typed stays', run('rotEd.gen.heats') === '4' && E('ro-genopts').innerHTML.includes('value="4"'));
  await btn('ro-gen'); say('Make the heats with 4 heats for 10 participants: everybody races, nothing to warn about', draft().heats.length === 4 && !E('ro-remarks').innerHTML.includes('no heat'));
  { const D = { ...draft(), participants: 14, lanes: 4, heats: [{ label: '', locked: false, places: [0, 1, 2, 3].map((p, lane) => ({ p, lane })) }] };
    run(`rotEd.draft = Rot.clean(${JSON.stringify(D)}, true)`); await btn('ro-drop');
    E('ro-n').value = '14'; E('ro-n').onchange(); await wait(20);
    say('with more participants than lanes without a heat, the button says how many it can take: "Add a heat for the first 4"', E('ro-remarks').innerHTML.includes('Add a heat for the first 4'));
    await press({ dataset: { fix: 'idle' } }); say('...and a second press adds the next heat (P5 to P8 first)', draft().heats.length === 2 && places(draft(), 1) === '4@0 5@1 6@2 7@3'); }
  // naming a participant on the picked chip
  await btn('ro-drop'); await chip(2);
  say('a picked participant can be named right there: a name field in the line that says who is picked', E('ro-hold').innerHTML.includes('id="ro-pname"') && E('ro-hold').innerHTML.includes('placeholder="Participant 3"') && E('ro-hold').innerHTML.includes('aria-label="Name of participant 3"'));
  { const holdBefore = E('ro-hold').innerHTML; box().oninput({ target: { id: 'ro-pname', value: 'Sam', dataset: { pname: '2' } } });
    say('typing the name changes the chip, the heat grid, the names box and the draft; the field itself is not drawn again', draft().names[2] === 'Sam' && E('ro-pool').innerHTML.includes('>Sam <small>') && E('ro-grid').innerHTML.includes('aria-label="Heat 1, lane 3: Sam"') && E('ro-names').innerHTML.includes('value="Sam"') && E('ro-hold').innerHTML === holdBefore);
    box().oninput({ target: { id: '', value: 'Kim', dataset: { name: '2' } } });
    say('...the names box does the same, and does not draw itself again while you type there', draft().names[2] === 'Kim' && E('ro-pool').innerHTML.includes('>Kim <small>') && E('ro-grid').innerHTML.includes('aria-label="Heat 1, lane 3: Kim"')); }
  await btn('ro-drop');
  // the menus
  say('every heat row has Lock and a "⋯" menu with Copy, Empty and Delete, and the row has no other buttons than the two arrows', (() => { const g = E('ro-grid').innerHTML; return (g.match(/class="romenu romenu-row"/g) || []).length === draft().heats.length && g.includes('aria-label="More for heat 1"') && g.includes('Copy this heat') && g.includes('Empty this heat') && g.includes('Delete this heat') && g.includes('data-lock="0"') && g.includes('data-up="0"') && g.includes('data-down="0"'); })());
  say('the tools are in a menu next to "Add a heat", each with a line that says what it does', ['ro-shufo', 'ro-rev', 'ro-shufl', 'ro-even'].every(id => html().includes(`id="${id}"`)) && html().includes('id="ro-tools"') && html().indexOf('id="ro-add"') < html().indexOf('id="ro-tools"') && html().includes('Locked heats stay where they are.') && html().includes('about equally often'));
  E('ro-tools').open = true; await btn('ro-rev'); say('using a tool closes the menu, and it works (the order is reversed)', E('ro-tools').open === false);
  say('the plans are buttons with a line each (there is no plan select any more)', !html().includes('id="ro-plan"') && html().includes('data-plan="roundrobin"') && html().includes('Everybody meets everybody.') && html().includes('Mixes everybody over a number of heats that you choose.'));
  await planBtn('perdriver'); say('a plan button is pressed when it is the plan, and shows its options', /data-plan="perdriver" aria-pressed="true"/.test(E('ro-plans').innerHTML) && /data-plan="manual" aria-pressed="false"/.test(E('ro-plans').innerHTML) && E('ro-genopts').innerHTML.includes('id="ro-geach"'));
  ctx.confirm = () => true; await E('ro-back').onclick(); await wait(20);

  // ---------- 1.16.0: drag and drop, and a colour for every participant ----------
  store.rotationsetups = []; await run('render()'); await wait(20); await btn('newrot');
  { const col = p => Rot.colorOf(p);
    say('1.16.0: every participant has a colour by number: on the chip, on its places in the heats and on its name in the list of names (nothing of it is saved with the rotation)',
      E('ro-pool').innerHTML.includes(`data-pp="0"`) && E('ro-pool').innerHTML.includes(`--pc:${col(0)}`) && E('ro-pool').innerHTML.includes(`--pc:${col(7)}`) && E('ro-grid').innerHTML.includes(`data-p="0" data-color="${col(0)}"`)
      && E('ro-names').innerHTML.includes(`<i class="rodot" style="--pc:${col(1)}"></i>P2`) && col(0) !== col(1) && !JSON.stringify(draft()).includes('#') && !JSON.stringify(draft()).includes('color'));
    say('...a place without a participant has no colour', !/data-cell="[^"]*"[^>]*empty/.test(html()) || !E('ro-grid').innerHTML.includes('empty" data-cell="0:0" data-p'));
    // picking a participant marks its places
    say('nothing is picked: no places are marked', !/rogrid hl/.test(E('ro-grid').innerHTML) && !/hpcell mine/.test(E('ro-grid').innerHTML));
    await chip(0);
    say('a picked participant: the grid is in "highlight" mode, and its places (and only those) are marked', /rogrid hl/.test(E('ro-grid').innerHTML) && /hpcell mine" data-cell="0:0"/.test(E('ro-grid').innerHTML) && (E('ro-grid').innerHTML.match(/hpcell mine/g) || []).length === 1);
    await btn('ro-drop'); say('...letting go takes the marks away', !/rogrid hl/.test(E('ro-grid').innerHTML) && !/hpcell mine/.test(E('ro-grid').innerHTML));
    await cell(1, 2); say('a picked place marks the places of its participant (P7 stands in one)', /rogrid hl/.test(E('ro-grid').innerHTML) && /hpcell sel mine" data-cell="1:2"/.test(E('ro-grid').innerHTML)); await btn('ro-drop'); }

  // the pointer, with stand-ins for the elements (they know the data they carry and what closest() finds)
  { const isIn = (sel, e) => sel.split(',').some(s => { s = s.trim(); return s.startsWith('#') ? e.id === s.slice(1) : s.startsWith('[data-') ? e.dataset[s.slice(6, -1)] !== undefined : false; });
    const thing = (ds, id = '') => { const e = { dataset: ds, id, cls: new Set(), pid: null, textContent: ds.short || '', classList: { add: c => e.cls.add(c), remove: c => e.cls.delete(c) }, setPointerCapture: x => { e.pid = x; }, releasePointerCapture: () => { e.pid = null; }, closest: sel => (isIn(sel, e) ? e : null) }; return e; };
    const chipEl = p => thing({ pp: String(p), short: 'P' + (p + 1), color: Rot.colorOf(p) }), cellEl = (h, l, p) => thing(p === undefined ? { cell: `${h}:${l}` } : { cell: `${h}:${l}`, p: String(p), short: 'P' + (p + 1), color: Rot.colorOf(p) }), gripEl = h => thing({ hh: String(h), }), rowEl = h => thing({ hrow: String(h) }), trayEl = () => thing({}, 'ro-pool');
    let under = null; document.elementFromPoint = () => under;
    const ev = (x, y, o = {}) => ({ pointerId: 1, button: 0, clientX: x, clientY: y, target: null, ...o });
    const downOn = (t, x = 50, y = 50, o = {}) => box().onpointerdown(ev(x, y, { target: t, ...o })), moveTo = (x, y, o = {}) => box().onpointermove(ev(x, y, o)), upAt = (x, y, o = {}) => box().onpointerup(ev(x, y, o));
    const drag = async (src, over, x = 200, y = 120) => { downOn(src); under = over; moveTo(x, y); upAt(x, y); under = null; };
    say('the editor takes the pointer: the box has a handler for the pointer going down, moving, going up and being cancelled', ['onpointerdown', 'onpointermove', 'onpointerup', 'onpointercancel'].every(k => typeof box()[k] === 'function'));

    // a participant onto a place
    store.rotationsetups = []; await run('render()'); await wait(20); await btn('newrot'); // (8 participants on 4 lanes: A = P1..P4, B = P5..P8)
    let n0 = hist().undo; const before = JSON.stringify(draft());
    await drag(chipEl(7), cellEl(0, 1, 1)); await wait(5);
    say('a participant dragged onto a place: P8 stands in heat 1, lane 2 (P2 leaves that heat; P8 still races heat 2), the same change as the clicks make; one step to undo', places(draft(), 0) === '0@0 7@1 2@2 3@3' && places(draft(), 1) === '4@0 5@1 6@2 7@3' && hist().undo === n0 + 1 && run('rotEd.hold') === null);
    say('...the page shows the change straight away, and the counts follow (P8 races 2 heats, P2 none)', E('ro-grid').innerHTML.includes('aria-label="Heat 1, lane 2: Participant 8"') && E('ro-pool').innerHTML.includes('>P8 <small>2</small>') && E('ro-pool').innerHTML.includes('>P2 <small>0</small>') && !/rogrid hl/.test(E('ro-grid').innerHTML));
    E('ro-undo').onclick(); say('...Undo takes it back', JSON.stringify(draft()) === before);

    // a click is still a click (a small move is no drag)
    n0 = hist().undo; downOn(chipEl(3), 50, 50); moveTo(52, 53); upAt(52, 53); await chip(3);
    say('a pointer that hardly moves is a click: the participant is picked as before, nothing is dragged', run('rotEd.hold.kind') === 'p' && run('rotEd.hold.p') === 3 && hist().undo === n0);
    await cell(1, 3); say('...and the click on a place puts the participant there (the click method works as before)', places(draft(), 1) === '4@0 5@1 6@2 3@3'); E('ro-undo').onclick();

    // a place onto a place: they swap
    n0 = hist().undo; await drag(cellEl(0, 0, 0), cellEl(1, 1, 5)); await wait(5);
    say('a place dragged onto another place: the two swap (P1 and P6 change heats); one step', places(draft(), 0) === '5@0 1@1 2@2 3@3' && places(draft(), 1) === '4@0 0@1 6@2 7@3' && hist().undo === n0 + 1);
    E('ro-undo').onclick();
    // ...and the click that comes straight after a drag is not a click
    await drag(cellEl(0, 0, 0), cellEl(1, 1, 5)); await cell(0, 0);
    say('the click that comes straight after a drag does nothing (no place is picked)', run('rotEd.hold') === null);
    await wait(10); await cell(0, 0); say('...and the next click is a click again', run('rotEd.hold.kind') === 'cell'); await btn('ro-drop'); E('ro-undo').onclick();

    // a place onto the participants: it is emptied
    n0 = hist().undo; await drag(cellEl(0, 2, 2), trayEl()); await wait(5);
    say('a place dragged back onto the participants is emptied (P3 leaves heat 1); one step', places(draft(), 0) === '0@0 1@1 3@3' && hist().undo === n0 + 1 && E('ro-pool').innerHTML.includes('>P3 <small>0</small>'));
    E('ro-undo').onclick();

    // a heat by its grip
    n0 = hist().undo; const lab = labels(); await drag(gripEl(0), rowEl(1)); await wait(5);
    say('a heat dragged by its grip onto another heat moves there, with its places and its label; one step', labels() === lab.split('').reverse().join('') && places(draft(), 0) === '4@0 5@1 6@2 7@3' && places(draft(), 1) === '0@0 1@1 2@2 3@3' && hist().undo === n0 + 1);
    E('ro-undo').onclick(); say('...Undo puts it back', labels() === lab && places(draft(), 0) === '0@0 1@1 2@2 3@3');

    // what cannot be done is said, and nothing changes
    await press({ dataset: { lock: '1' } }); n0 = hist().undo;
    say('(heat 2 is locked)', draft().heats[1].locked === true && E('ro-grid').innerHTML.includes('data-lk="1"'));
    await drag(chipEl(0), cellEl(1, 0, 4)); await wait(5);
    say('a participant dragged onto a place of a locked heat: the page says the heat is locked, nothing changes, no step', /locked/.test(msg()) && places(draft(), 1) === '4@0 5@1 6@2 7@3' && hist().undo === n0);
    await drag(cellEl(1, 1, 5), cellEl(0, 0, 0)); await wait(5);
    say('a place of a locked heat cannot be picked up at all (no drag, no message, no change)', places(draft(), 1) === '4@0 5@1 6@2 7@3' && places(draft(), 0) === '0@0 1@1 2@2 3@3' && hist().undo === n0);
    await drag(gripEl(1), rowEl(0)); await wait(5);
    say('...nor can a locked heat be moved by its grip', labels() === lab && hist().undo === n0);
    await drag(gripEl(0), rowEl(1)); await wait(5);
    say('...and a heat cannot be dropped onto a locked heat', /locked/.test(msg()) && labels() === lab && hist().undo === n0);
    await press({ dataset: { lock: '1' } });

    // dropped on nothing; Esc; a cancelled pointer; the right button
    n0 = hist().undo; await drag(chipEl(7), thing({})); await wait(5);
    say('a drop on something that is no place changes nothing', JSON.stringify(draft()) === before && hist().undo === n0 && run('rotEd.hold') === null);
    downOn(chipEl(7)); under = cellEl(0, 1, 1); moveTo(200, 120); [...keyListeners].forEach(f => f({ key: 'Escape', target: { matches: () => false }, preventDefault() {} })); upAt(200, 120); under = null; await wait(5);
    say('Esc during a drag lets go: nothing changes', JSON.stringify(draft()) === before && hist().undo === n0);
    downOn(chipEl(7)); under = cellEl(0, 1, 1); moveTo(200, 120); box().onpointercancel(ev(200, 120)); under = null; await wait(5);
    say('a pointer that is taken away by the system drops nowhere', JSON.stringify(draft()) === before && hist().undo === n0);
    downOn(chipEl(7), 50, 50, { button: 2 }); under = cellEl(0, 1, 1); moveTo(200, 120); upAt(200, 120); under = null; await wait(5);
    say('the right button does not drag', JSON.stringify(draft()) === before && hist().undo === n0);
    downOn(cellEl(0, 1), 50, 50); under = cellEl(1, 1, 5); moveTo(200, 120); upAt(200, 120); under = null; await wait(5);
    say('an empty place cannot be picked up', JSON.stringify(draft()) === before && hist().undo === n0);

    // the colours are not saved, the groups are as before
    typing(E('ro-name'), 'Sunday cup'); writes.length = 0; await E('ro-save').onclick();
    const add = writes.find(w => w[0] === 'add' && w[1] === 'rotationsetups');
    say('saving writes the rotation as before: no colours in it', !!add && !JSON.stringify(add[2]).includes('#') && !/colou?r/i.test(JSON.stringify(add[2])) && add[2].heats.length === 2);
    say('Groups are still there, as they were: a box for them under the names and the choice in every heat row', html().includes('id="ro-groupsbox"') && !html().includes('rogroupstrip'));
    ctx.confirm = () => true; await E('ro-back').onclick(); await wait(20);
    say('back on the list the editor\'s pointer handlers are gone', box().onpointerdown === null && box().onpointermove === null && box().onpointerup === null && box().onpointercancel === null);
    delete document.elementFromPoint; }

  // ---------- the race setup form ----------
  store.rotationsetups = [rotRec()];
  run("state.refs.rotationsetups = " + JSON.stringify(store.rotationsetups) + "; openForm('racesetups', null)"); await wait(30);
  const form = E('dlg').innerHTML;
    say('the race setup form has a Rotation setup choice, with the rotations and the explanation, in the Heats group (1.69.0: it was in Length and result), first, before how the heats are planned', form.includes('id="f-rotation"') && form.includes('None: plan the heats from the settings below') && form.includes('>Club night</option>') && form.includes('Race Setup &gt; Rotation Setups') && form.indexOf('data-fg="heats"') < form.indexOf('id="f-rotation"') && form.indexOf('id="f-rotation"') < form.indexOf('id="f-heatPlan"') && form.indexOf('id="f-heatPlan"') < form.indexOf('data-fg="length"'));
  const F = run('state.schema.racesetups.fields'), isShown = run('isShown');
  const shown = (type, extra = {}) => F.filter(f => isShown(f, k => ({ sessionType: type, heatBy: 'laps', heatPlan: 'manual', resultBy: 'laps', rotation: '', ...extra })[k])).map(f => f.key);
  const plan = ['heatPlan', 'heats', 'heatsEach', 'heatEven', 'heatSeeding'], keep = ['heatBy', 'rotation', 'laps', 'resultBy', 'countBy', 'dropWorst', 'tieBreak', 'finals', 'breakSeconds'];
  say('without a rotation the settings that plan the heats are asked, as before', shown('heats', { heatPlan: 'manual' }).includes('heats') && shown('heats', { heatPlan: 'perdriver' }).includes('heatsEach') && shown('heats', { heatPlan: 'roundrobin' }).includes('heatEven') && shown('heats').includes('heatPlan') && shown('heats').includes('heatSeeding') && shown('heats', { rotation: undefined }).includes('heatPlan'));
  say('with a rotation they are not asked, and everything about the length and the result still is', plan.every(k => !shown('heats', { rotation: 'r1' }).includes(k)) && plan.every(k => !shown('heats', { rotation: 'r1', heatPlan: 'perdriver' }).includes(k)) && keep.every(k => shown('heats', { rotation: 'r1' }).includes(k)));
  say('the choice is only for a heat-based race', shown('heats').includes('rotation') && !['race', 'timed', 'practice', 'qualifying', 'tokens'].some(t => shown(t).includes('rotation')));

  // ---------- the Home tab ----------
  const keepAll = { racesetups: store.racesetups, tracks: store.tracks, last: run('state.settings.lastSetupId'), asg: run('state.settings.assignments') };
  store.tracks = [{ id: 't1', name: 'Living room', lanes: 2 }, { id: 't4', name: 'Big track', lanes: 4 }];
  const homeSetup = over => ({ id: 'hs1', name: 'Club heats', sessionType: 'heats', track: 't4', heatBy: 'laps', laps: 6, heatPlan: 'manual', heats: 2, resultBy: 'laps', rotation: 'r1', ...over });
  const asg = (n, extra = {}) => Array.from({ length: n }, (_, i) => ({ driverId: 'd' + (i + 1), carId: 'c' + (i + 1), ...(extra[i] || {}) }));
  const home = async (over = {}, n = 8, extra, rec, edits) => {
    store.racesetups = [homeSetup(over)]; store.rotationsetups = rec === null ? [] : [rec || rotRec()];
    run("state.settings.lastSetupId = 'hs1'; state.settings.assignments = " + JSON.stringify({ hs1: asg(n, extra) }) + "; state.settings.heatEdits = " + JSON.stringify(edits || {}) + "; state.settings.heatSeeds = { hs1: 5 }; state.tab = 'home'; state.race = null; state.rotMsg = null; live = null");
    await run('render()'); await wait(30); return E('view').innerHTML.replace(/&quot;/g, '"');
  };
  const tick = async (i, on) => { await E('view').onchange({ target: { dataset: { absent: String(i) }, checked: on, closest: () => null } }); await wait(30); return E('view').innerHTML.replace(/&quot;/g, '"'); };
  const clickHome = async b => { await E('view').onclick({ target: { closest: sel => (sel === 'button' ? { dataset: {}, ...b } : null) } }); await wait(30); return E('view').innerHTML.replace(/&quot;/g, '"'); };
  const hp = h => (h.match(/class="hpcell/g) || []).length, assignments = () => run('state.settings.assignments.hs1');

  let h = await home();
  say('a race setup with a rotation: the Home tab plans the heats from it: 3 heats of 4 places, with their labels', h.includes('<h4>Heat plan</h4>') && hp(h) === 12 && h.includes('<span class="muted">A</span>') && h.includes('<span class="muted">C</span>') && h.includes('Rotation setup "Club night": 8 participants, 4 lanes, 3 heats.'));
  say('...the participants are told apart by number and by the name the rotation gives them, and each has a Not here today tick', h.includes('Participant 1</span>') === false && h.includes('Participant 1 · Alex') && h.includes('Participant 2 · Sam') && h.includes('Participant 3</span>') && (h.match(/data-absent="/g) || []).length === 8 && h.includes('Not here today'));
  say('...it does not shuffle (no "Shuffle again"), does not add participants (no "Add participant"), and has no Remove buttons', !h.includes('id="reshuffle"') && !h.includes('id="addrow"') && !h.includes('data-remove='));
  say('...it says what the rotation means (Alex and the others race 2 heats, the rest 1: no advice about settings that are not used) and nothing is wrong', h.includes('do not race the same number of heats') && !h.includes('To avoid it') && !h.includes('<ul class="issues">'));
  say('...a button picks the drivers by the names of the rotation, because it has names', h.includes('id="rotnames"') && h.includes('Pick the drivers by name'));
  say('...the Start button is on', !/id="start"[^>]*disabled/.test(h));
  say('...with everybody here nothing is ticked, nothing is left out, and every tick is named for a screen reader from 1', (h.match(/data-absent="\d+"[^>]* checked/g) || []).length === 0 && !h.includes('left out') && h.includes('aria-label="Participant 1 is not here today"') && h.includes('aria-label="Participant 8 is not here today"') && !h.includes('Participant 0 is not here') && !h.includes('Participant 9 is not here'));
  h = await home({}, 8, { 2: { carId: '' }, 4: { driverId: '' } });
  say('who is here needs a driver and a car: a driver without a car, or a car without a driver, is told as well', h.includes('Participant 3 needs a driver and a car.') && h.includes('Participant 5 needs a driver and a car.') && /id="start"[^>]*disabled/.test(h));
  await E('view').onchange({ target: { dataset: { k: 'driverId' }, value: 'd4', closest: () => ({ dataset: { row: '2' } }) } }); await E('view').onchange({ target: { dataset: { k: 'carId' }, value: 'c3', closest: () => ({ dataset: { row: '2' } }) } }); await wait(30);
  say('a driver and a car are chosen for a participant in the usual way (the choice is saved with the row)', assignments()[2].driverId === 'd4' && assignments()[2].carId === 'c3');
  h = await home(); h = await tick(0, true);
  say('the first participant can be away too: the plan has no Alex, and the tick shows', /data-absent="0" checked/.test(h) && !/class="hpcell[^"]*"[^>]*>Alex</.test(h) && (h.match(/data-absent="\d+"[^>]* checked/g) || []).length === 1);
  await clickHome({ id: 'start' }); const r0 = JSON.parse(run('JSON.stringify(state.race)'));
  say('...and the race starts without them (7 participants, no Alex, the heats as planned with the new numbers)', r0.rows.length === 7 && r0.rows.every(r => r.driverId !== 'd1') && same(r0.schedule, Rot.scheduleFor(rotRec(), [0]).schedule));
  run('state.race = null; live = null');
  h = await home({ rotation: '' }, 2); say('a heat race that plans itself keeps two rows at least: with two rows there is no Remove button', !h.includes('data-remove='));
  h = await home({ rotation: '' }, 3); say('...with three each row can be removed', (h.match(/data-remove="/g) || []).length === 3);
  h = await home({}, 8, undefined, { ...rotRec(), names: [] });
  say('a rotation without names has no button to pick drivers by name', !h.includes('id="rotnames"') && h.includes('Participant 1</span>'));

  // not here today
  h = await home(); h = await tick(1, true);
  say('Not here today for Sam: saved with the participant, the row looks away and its choices are off', assignments()[1].absent === true && assignments()[0].absent === undefined && /class="lane rot away" data-row="1"/.test(h) && /data-k="driverId" aria-label="Driver for row 2" disabled/.test(h) && /data-absent="1" checked/.test(h));
  say('...the plan leaves Sam out: heat A has 3 cars, and the lane that was his stays free (one empty place); the other heats are as they were; all 3 heats stay', hp(h) === 12 && !/class="hpcell[^"]*"[^>]*>Sam</.test(h) && (h.match(/<span class="muted">–<\/span>/g) || []).length === 1 && /data-hp="0:1"[^>]*><span class="muted">–/.test(h) && h.includes('Kim') && h.includes('Lee') && (h.match(/<td>\d <span class="muted">[ABC]<\/span>/g) || []).length === 3);
  say('...nothing is wrong: Sam needs no driver and no car, and the others are enough', !h.includes('<ul class="issues">'));
  h = await tick(1, false); say('unticking brings Sam back (the saved flag is gone)', assignments()[1].absent === undefined && hp(h) === 12 && (h.match(/<span class="muted">–<\/span>/g) || []).length === 0);
  h = await home({}, 8, { 4: { driverId: '', carId: '' } }); h = await tick(4, true);
  say('a participant who is not here needs no driver and no car (P5 has none and is ticked: no problem)', !h.includes('Participant 5 needs a driver and a car.') && !h.includes('<ul class="issues">'));
  h = await tick(4, false); say('...but who is here needs both', h.includes('Participant 5 needs a driver and a car.') && /id="start"[^>]*disabled/.test(h));
  h = await home({}, 8, { 0: { absent: true }, 1: { absent: true }, 2: { absent: true }, 3: { absent: true }, 4: { absent: true }, 5: { absent: true }, 6: { absent: true } });
  say('with fewer than two participants here the race cannot start ("At least two participants must be here")', h.includes('At least two participants must be here.') && !h.includes('<h4>Heat plan</h4>') && /id="start"[^>]*disabled/.test(h));
  h = await home({}, 8, { 4: { absent: true }, 5: { absent: true }, 6: { absent: true }, 7: { absent: true } });
  say('a heat nobody is here for is left out, and the page says so (heat B: 4 5 6 7 are away; heat C keeps Alex, Kim)', h.includes('One heat is left out, because nobody who is here races in it.') && hp(h) === 8);
  h = await home({}, 8, { 1: { absent: true }, 2: { absent: true }, 3: { absent: true } });
  say('a heat with one car left is mentioned', h.includes('Heat 1 has one car only, because the others are not here.'));
  h = await home({}, 8, { 1: { absent: true } }); await clickHome({ id: 'start' });
  const race = JSON.parse(run('JSON.stringify(state.race)')), exp = Rot.scheduleFor(rotRec(), [1]);
  say('Start with Sam away: the race gets 7 participants (without Sam), the heats as planned with the new numbers, and the labels', race.rows.length === 7 && race.rows.every(r => r.driverId !== 'd2') && same(race.schedule, exp.schedule) && same(race.labels, ['A', 'B', 'C']) && race.setup.rotation === 'r1' && run('state.tab') === 'race');
  await wait(60); const rh = E('racehost').innerHTML;
  const hl = E('heatlist').innerHTML;
  say('...and the race screen lists the heats with their labels and the drivers by lane (the heat list)', rh.includes('Heat list (3 heats)') && hl.includes('<span class="muted">A</span>') && hl.includes('Lane 1: Alex') && !hl.includes('Sam') && hl.includes('Lane 4: Lee') && hl.includes('hl-next') && (hl.match(/<tr class="hl-/g) || []).length === 3);
  run('state.race = null; live = null');

  // 1.7.0: the heat list as a sheet to print (Home)
  { const pdfs = []; api.exportPdf = async (html, name) => { pdfs.push([html, name]); return pdfs.length === 1 ? { saved: true, path: 'C:\\Sheets\\x.pdf' } : pdfs.length === 2 ? { saved: false } : Promise.reject(new Error('disk full')); };
    h = await home();
    say('the heat plan has a Print the heat list button and a place for its message', h.includes('id="heatsheet"') && h.includes('Print the heat list') && h.includes('id="heatsheetmsg"'));
    await clickHome({ id: 'heatsheet' });
    const [html, name] = pdfs[0] || ['', ''];
    say('the button makes a PDF of the plan: the title with the name of the setup, a column for every lane, the drivers in their places', pdfs.length === 1 && html.includes('heat list</h1>') && html.includes('<th>Lane 4</th>') && html.includes('<td class="h">Heat 1<br>') && html.includes('<td>Alex</td>') && name.endsWith(' heat list.pdf'));
    say('...with the names of the heats of the rotation, and the message says where it was saved', html.includes('>A</span>') && E('heatsheetmsg').textContent === 'Saved to C:\\Sheets\\x.pdf');
    await clickHome({ id: 'heatsheet' }); say('...a cancelled export says so', E('heatsheetmsg').textContent === 'Export cancelled.');
    await clickHome({ id: 'heatsheet' }); say('...and a PDF that could not be made says why', E('heatsheetmsg').textContent === 'Could not make the PDF: disk full');
    say('a file name never has a character a file cannot have', !/[\\/:*?"<>|]/.test(name));
  }

  // a plan changed by hand
  h = await home(); h = await clickHome({ dataset: { hp: '0:0' } }); h = await clickHome({ dataset: { hp: '1:0' } });
  say('a plan from a rotation can be changed by hand on Home as well (two places swap), and says so', h.includes('You changed this plan by hand. "Reset my changes" brings back the rotation.') && h.includes('id="resetplan"') && Object.keys(run('state.settings.heatEdits')).length === 1);
  const sw = run('state.settings.heatEdits.hs1.schedule');
  say('...Alex (P1) and Max (P5) changed heats, in the same lanes', sw[0][0].p === 4 && sw[1][0].p === 0 && sw[0][1].p === 1);
  h = await clickHome({ id: 'resetplan' }); say('Reset my changes brings the rotation back', !h.includes('You changed this plan by hand') && Object.keys(run('state.settings.heatEdits')).length === 0);
  h = await home({}, 8, undefined, undefined, { hs1: { key: 'old', schedule: sw } });
  say('a change that was made to another plan is not used (the key is not the key of this plan)', !h.includes('You changed this plan by hand'));
  const keyNow = (await (async () => { h = await clickHome({ dataset: { hp: '0:0' } }); h = await clickHome({ dataset: { hp: '1:0' } }); return run('state.settings.heatEdits.hs1.key'); })());
  h = await tick(7, true); say('...and a change is thrown away when somebody is ticked away (the plan is another plan)', !h.includes('You changed this plan by hand') && keyNow !== undefined);

  // what stops a race
  h = await home({}, 10);
  say('more rows than the rotation has participants: it says so, nobody is removed by itself, and the rows can be removed', h.includes('The rotation "Club night" has 8 participants and you have 10.') && (h.match(/data-row="/g) || []).length === 10 && (h.match(/data-remove="/g) || []).length === 10 && !h.includes('<h4>Heat plan</h4>') && /id="start"[^>]*disabled/.test(h));
  h = await home({}, 6);
  say('fewer rows than participants: the rows are added (8 rows), and the new ones need a driver and a car', (h.match(/data-row="/g) || []).length === 8 && h.includes('Participant 7 needs a driver and a car.') && h.includes('Participant 8 needs a driver and a car.') && !h.includes('The rotation "Club night" has 8 participants and you have'));
  h = await home({ track: 't1' });
  say('a track with fewer lanes than the rotation uses: it says so and there is no plan', h.includes('The rotation uses lane 4, and this track has 2 lanes (heat 1, 2, 3).') && !h.includes('<h4>Heat plan</h4>') && /id="start"[^>]*disabled/.test(h));
  h = await home({}, 8, undefined, { ...rotRec(), lanes: 6 });
  say('a rotation made for 6 lanes that only uses 4 fits a track with 4', !h.includes('this track has') && h.includes('<h4>Heat plan</h4>') && hp(h) === 12);
  { const two = { ...rotRec(), participants: 4, lanes: 2, names: [], groups: [], heats: [{ label: 'A', locked: false, places: [{ p: 0, lane: 0 }, { p: 1, lane: 1 }] }, { label: 'B', locked: false, places: [{ p: 2, lane: 0 }, { p: 3, lane: 1 }] }] };
    h = await home({}, 4, undefined, two);
    say('a track with more lanes than the rotation uses is fine: the plan has a column for every lane of the track, and the lanes the rotation does not use stay empty', !h.includes('this track has') && !h.includes('<ul class="issues">') && hp(h) === 8 && (h.match(/<span class="muted">–<\/span>/g) || []).length === 4 && h.includes('<th>Lane 4</th>') && !/id="start"[^>]*disabled/.test(h));
    await clickHome({ id: 'start' }); const r2 = JSON.parse(run('JSON.stringify(state.race)'));
    say('...and the race is started with the heats as drawn, in lanes 1 and 2', r2.rows.length === 4 && same(r2.schedule, [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }], [{ p: 2, lane: 0 }, { p: 3, lane: 1 }]]) && same(r2.labels, ['A', 'B']));
    run('state.race = null; live = null'); }
  h = await home({}, 8, undefined, { ...rotRec(), heats: [] });
  say('a rotation without heats cannot be raced', h.includes('has no heats with participants.') && !h.includes('<h4>Heat plan</h4>'));

  // the names of the participants
  h = await home({}, 5, undefined, { ...rotRec(), names: ['Alex', 'Sam', 'Kim', 'Lee', 'Max', 'Zoe', 'Jan', 'Nobody'] });
  say('(5 participants have a driver, 3 have none yet)', (h.match(/Participant \d needs a driver and a car\./g) || []).length === 3);
  h = await clickHome({ id: 'rotnames' });
  say('the button picks the drivers whose names are the names of the participants who have none yet: Zoe and Jan; "Nobody" has no driver; the message says so', assignments()[5].driverId === 'd6' && assignments()[6].driverId === 'd7' && assignments()[7].driverId === '' && h.includes('Picked 2 drivers by name.') && h.includes('No driver is called Nobody.'));
  say('...the participants who had a driver keep it', assignments().slice(0, 5).every((r, i) => r.driverId === 'd' + (i + 1)));
  h = await tick(0, true); say('...and the message goes when something else is changed', !h.includes('Picked 2 drivers by name.'));

  // no rotation: as before
  h = await home({ rotation: '' });
  say('a race setup without a rotation plans its heats as before (a plan with a Shuffle again button, an Add participant button, no ticks)', h.includes('id="reshuffle"') && h.includes('id="addrow"') && !h.includes('data-absent=') && !h.includes('Rotation setup') && h.includes('<h4>Heat plan</h4>') && h.includes('2 heats, each 6 laps.'));
  h = await home({}, 8, undefined, null);
  say('a rotation that has been deleted is no rotation: the plan comes from the settings again', h.includes('id="reshuffle"') && !h.includes('data-absent=') && h.includes('2 heats, each 6 laps.'));
  h = await home({ sessionType: 'race' });
  say('a race that is not a heat race ignores a rotation in its setup', !h.includes('data-absent=') && !h.includes('Rotation setup') && !h.includes('Heat plan'));

  Object.assign(store, { racesetups: keepAll.racesetups, tracks: keepAll.tracks }); run('state.race = null; live = null');
  reachedEnd = true; console.log(fails ? fails + ' ROTATION SCREEN TESTS FAILED' : 'ALL ROTATION SCREEN TESTS PASSED'); process.exit(fails ? 1 : 0);
})();
