// 1.55.0: championships on screen: the Championships page in Race Setup (list, editor with rounds, sessions and roster, undo, save), the card with the next session on Home and loading it,
// the tag on the race screen, in the saved race, in the snapshot of a race that comes back and in the results, against a stand-in for the app window.
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
for (const f of ['listnum.js', 'bop.js', 'weather.js', 'tyrewear.js', 'safetycar.js', 'pushsave.js', 'racelimit.js', 'endurance.js', 'failures.js', 'damage.js', 'engine.js', 'heats.js', 'rotation.js', 'championship.js', 'champpoints.js', 'season.js', 'tokens.js', 'speed.js', 'distance.js','stats.js','homestats.js','carstats.js','viewset.js','picture.js','uiscale.js','depth.js','theme.js','banner.js', 'icons.js', 'delta.js','avatars.js', 'picmemo.js', 'weatherwidgets.js', 'tyrewidgets.js', 'pacewidgets.js', 'boardorder.js', 'widgets.js', 'frame.js', 'backdrop.js','announcer.js','sound.js', 'timing.js', 'rows.js', 'richtext.js', 'canvas.js', 'liveshare.js', 'review.js', 'adjustpad.js', 'adjustui.js', 'dirfolder.js', 'penaltyui.js', 'rotationdrag.js','padui.js','livegrid.js', 'homegrid.js', 'drivergrid.js', 'homecards.js', 'liveview.js', 'setupwords.js', 'formui.js', 'railform.js', 'database.js', 'landing.js', 'race.js', 'undo.js', 'editor.js','tokenui.js', 'bopui.js', 'damageui.js', 'weatherui.js', 'tyreui.js', 'pushsaveui.js', 'rotationui.js', 'championshipui.js', 'audioedit.js','widgetbuilder.js','transferui.js','themeui.js','hardware.js','trackmate.js','hardwareui.js', 'dsui.js', 'app.js']) vm.runInContext(fs.readFileSync(R + 'renderer/' + f, 'utf8'), ctx, { filename: f });
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
const setup = async () => { run("state.tab = 'setup'; state.setupSub = 'championships'"); await run('render()'); await wait(80); };

(async () => {
  await wait(50); run('state.autoFinalize = true');

  // ---------- the page: a sub-tab of Race Setup ----------
  run("state.settings = { theme: 'dark' }"); await setup();
  const tabs = E('setuptabs').innerHTML;
  say('Race Setup has a Championships tab in the group of the Setups, after Rotation Setups and before the Extras', tabs.includes('Championships') && tabs.indexOf('Rotation Setups') < tabs.indexOf('Championships') && tabs.indexOf('Championships') < tabs.indexOf('Balance of Power'));
  say('...it is the open one, in its own colour (the class of the chip is ss-ch) with its own picture', /class="sstab ss-ch" role="tab" aria-selected="true" data-id="championships"/.test(tabs) && tabs.includes(run("Icons.PATHS['championship']")) && E('setuppage') !== undefined);
  say('...a note says what a championship is', E('setupnote').textContent.includes('A championship is a series of rounds') && E('setupnote').textContent.includes('one click loads it'));
  say('...there are none yet: the page says so and has the New championship button', mgr().innerHTML.includes('No championships yet.') && mgr().innerHTML.includes('id="newch"'));
  { const h = await home(); say('...the Home tab shows no card for a championship while there is none, and Start a race has no choice of a championship either', !h.includes('id="champband"') && !h.includes('id="champsel"')); }

  // ---------- making one ----------
  await setup(); await click({ id: 'newch' });
  { const h = mgr().innerHTML;
    say('New championship opens the editor: the name, Undo and Redo, Save and Back, one round that is open, the roster and a note on the race setups', h.includes('id="ch-name"') && /id="ch-name" value="New championship"/.test(h) && h.includes('id="ch-undo"') && h.includes('id="ch-save"') && h.includes('id="ch-back"') && h.includes('Round 1') && /<details class="chround( next)?" data-round="0" open>/.test(h) && h.includes('The roster is empty') && h.includes('A Time Token Session can not be part of a championship'));
    say('...a round has its name, its track (with "the track of the race setup" to begin with) and its date; no sessions yet', h.includes('id="ch-rn-0"') && h.includes('(the track of the race setup)') && h.includes('id="ch-rd-0"') && h.includes('No sessions yet.'));
  }
  await click({ sadd: '0' }); await click({ sadd: '0' }); await click({ sadd: '0' });
  { const h = mgr().innerHTML;
    say('"Add a session" three times gives three sessions with no race setup yet', (h.match(/class="chses"/g) || []).length === 3 && (h.match(/\(choose a race setup\)/g) || []).length >= 3 && h.includes('3 sessions'));
    const opts = h.slice(h.indexOf('data-sf="0:0:setup"'), h.indexOf('</select>', h.indexOf('data-sf="0:0:setup"')));
    say('...the choice has the race setups, but not the Time Token Session', opts.includes('Practice 5 min') && opts.includes('Qualifying 5 min') && opts.includes('Club Night heat') && !opts.includes('Pay and race')); }
  await change({ sf: '0:0:setup' }, 's-prac'); await change({ sf: '0:1:setup' }, 's-qual'); await change({ sf: '0:2:setup' }, 's-race');
  { const h = mgr().innerHTML;
    say('choosing the race setups gives every session its kind: Practice, Qualifying, Race (it comes from the race setup)', /chkind k-practice">Practice/.test(h) && /chkind k-qualifying">Qualifying/.test(h) && /chkind k-race">Race/.test(h));
    say('...only a race has the choice of the points it counts for (100% / 50% sprint / None), a qualifying says it sets the grid, a practice that it never gives points', h.includes('data-sf="0:2:share"') && !h.includes('data-sf="0:0:share"') && !h.includes('data-sf="0:1:share"') && h.includes('50% (a sprint)') && h.includes('sets the grid of the race') && h.includes('never gives points'));
    say('...a control that was chosen keeps the cursor when the page is drawn again, and the open round stays open', /<details class="chround( next)?" data-round="0" open>/.test(h)); }
  await click({ sadd: '0' }); await click({ sdel: '0:3' });
  say('a session that was added is taken out again with its cross', (mgr().innerHTML.match(/class="chses"/g) || []).length === 3);
  await click({ sdown: '0:0' }); await click({ sup: '0:1' });
  say('a session moves down and up with its arrows (the first and last can not move: the arrow is off)', /data-sup="0:0"[^>]*disabled/.test(mgr().innerHTML) && /data-sdown="0:2"[^>]*disabled/.test(mgr().innerHTML) && !/data-sdown="0:0"[^>]*disabled/.test(mgr().innerHTML));
  { const kinds = [...mgr().innerHTML.matchAll(/chkind k-(\w+)">/g)].map(m => m[1]).join();
    say('...and the order is kept (it was Practice, Qualifying, Race; moving the first down and then the second up gives the same order again)', kinds === 'practice,qualifying,race'); }
  await change({ sf: '0:2:share' }, '50');
  say('the points of a race are changed to 50% (a sprint), and to 100% again', run('chEd.draft.rounds[0].sessions[2].share') === 50 && (await change({ sf: '0:2:share' }, '100'), run('chEd.draft.rounds[0].sessions[2].share') === 100));
  const spy = { sel: '', node: {} }; mgr().querySelector = sel => { spy.sel = sel; return spy.node; };
  await change({ rf: '0:track' }, 't4'); mgr().oninput({ target: { dataset: { rf: '0:name' }, value: 'Opener' } }); mgr().oninput({ target: { dataset: { rf: '0:date' }, value: 'Sat 3 Oct' } }); await change({ rf: '0:name' }, 'Opener');
  say('a round gets a track, a name and a date', run('chEd.draft.rounds[0].track') === 't4' && run('chEd.draft.rounds[0].name') === 'Opener' && run('chEd.draft.rounds[0].date') === 'Sat 3 Oct');
  say('...the name shows in the line of the round at once (the page is not drawn again, so typing keeps its place)', spy.sel === '[data-round="0"] .chrname' && spy.node.textContent === 'Opener');
  E('ch-addround').onclick();
  { const h = mgr().innerHTML;
    say('"Add a round" gives round 2 with the sessions of round 1 (the same race setups), and the new round is open', h.includes('Round 2') && (h.match(/class="chses"/g) || []).length === 6 && run('chEd.draft.rounds[1].sessions.map(s => s.setup).join()') === 's-prac,s-qual,s-race' && /<details class="chround( next)?" data-round="1" open>/.test(h));
    say('...the sessions have ids of their own, and the round starts without a name and a track', run('chEd.draft.rounds[1].sessions.every(s => !chEd.draft.rounds[0].sessions.some(o => o.id === s.id))') && run('chEd.draft.rounds[1].track') === ''); }
  await click({ sdel: '1:0' }); await click({ sdel: '1:0' });
  E('ch-copyfirst').onclick();
  say('"Copy the sessions of round 1 to all rounds" gives round 2 the three sessions of round 1 again (after asking, because it replaces what it had)', run('chEd.draft.rounds[1].sessions.length') === 3 && run('chEd.draft.rounds[1].sessions.map(s => s.setup).join()') === 's-prac,s-qual,s-race');
  await click({ rdown: '0' });
  say('a round moves down with "Move this round down" (round 1 is now the second)', run('chEd.draft.rounds[1].name') === 'Opener'); await click({ rup: '1' });
  say('...and up again', run('chEd.draft.rounds[0].name') === 'Opener');

  // ---------- the roster ----------
  change({}, 'd1', 'ch-adddriver'); await wait(10); change({}, 'd2', 'ch-adddriver'); await wait(10); change({}, 'd4', 'ch-adddriver'); await wait(10);
  { const h = mgr().innerHTML;
    say('a driver is added from the choice: the roster has a row with the driver, the team (the first team that has him), the round he joins in, and a cross', run('chEd.draft.roster.map(x => x.driver).join()') === 'd1,d2,d4' && h.includes('data-xdel="d1"') && h.includes('Joins in round') && run("chEd.draft.roster[0].team") === 'tm1' && run("chEd.draft.roster[2].team") === '');
    say('...a driver who is in it is not offered again', !/id="ch-adddriver"[\s\S]*?<option value="d1">/.test(h.slice(h.indexOf('id="ch-adddriver"'), h.indexOf('id="ch-addteam"')))); }
  await change({}, 'tm2', 'ch-addteam');
  say('"Add all drivers of a team" adds the drivers of the team who are not in the roster yet (here Kim, in her team), and says how many', run('chEd.draft.roster.map(x => x.driver).join()') === 'd1,d2,d4,d3' && run("chEd.draft.roster[3].team") === 'tm2' && E('ch-msg').textContent === 'Added 1 driver.');
  await change({}, 'tm1', 'ch-addteam');
  say('...a team whose drivers are all in already is said so, and nothing changes', E('ch-msg').textContent.includes('Every driver of that team is in the roster already') && run('chEd.draft.roster.length') === 4);
  await change({ xf: 'd3:team' }, 'tm1'); await change({ xf: 'd3:from' }, '2');
  say('the team and the round of joining of a driver are changed', run('chEd.draft.roster[3].team') === 'tm1' && run('chEd.draft.roster[3].from') === 2);
  await click({ xdel: 'd4' });
  say('a driver is taken out of the roster', run('chEd.draft.roster.map(x => x.driver).join()') === 'd1,d2,d3');

  // ---------- undo, save, back ----------
  { const before = run('chEd.draft.roster.length'); E('ch-undo').onclick(); await wait(10);
    say('Undo takes the last change back (the driver is in the roster again)', run('chEd.draft.roster.length') === before + 1); E('ch-redo').onclick(); await wait(10);
    say('...and Redo does it again', run('chEd.draft.roster.length') === before); }
  E('ch-name').oninput({ target: { value: '   ' } }); added.length = 0;
  await E('ch-save').onclick();
  say('a championship with no name is not saved; the page says why', added.length === 0 && E('ch-msg').textContent === 'Please give the championship a name.');
  E('ch-name').oninput({ target: { value: '  Club Cup 2026  ' } });
  await E('ch-save').onclick();
  { const rec = (added[0] || [])[1] || {};
    say('Save adds the championship to the database: the name, the rounds with their sessions (race setup and share), the roster', added.length === 1 && added[0][0] === 'championships' && rec.name === 'Club Cup 2026' && rec.rounds.length === 2 && rec.rounds[0].name === 'Opener' && rec.rounds[0].track === 't4' && rec.rounds[0].sessions.map(s => s.setup).join() === 's-prac,s-qual,s-race' && rec.roster.length === 3 && rec.roster[2].from === 2);
    say('...it says "Saved." and the second save is an update of the same championship, not another one', E('ch-msg').textContent === 'Saved.' && (await E('ch-save').onclick(), added.length === 1 && updated.length === 1 && updated[0][0] === 'championships'));
    say('...nothing about the screen is saved with it (no id inside, no draft state), the name without the spaces around it, also when it is an update', !('id' in rec) && !('id' in updated[0][2]) && updated[0][2].name === 'Club Cup 2026' && Object.keys(rec).sort().join() === 'bonusFast,bonusFastTop,bonusPole,bonusStart,drops,guestRule,name,points,pointsMode,pointsRest,roster,rounds,sprintRound,teamBest,teamMin,teamMode,teamRace,tie'); }
  await E('ch-back').onclick(); await wait(30);
  { const h = mgr().innerHTML;
    say('Back is the list: the championship with its size and how much is driven, and Edit, Duplicate and Delete', h.includes('Club Cup 2026') && h.includes('2 rounds · 6 sessions · 3 drivers') && h.includes('0 of 6 sessions driven') && h.includes('data-edit=') && h.includes('data-dup=') && h.includes('data-del=')); }
  const CH = store.championships[0];

  // ---------- editing, copying, deleting ----------
  await click({ edit: CH.id });
  say('Edit opens the championship as it was saved, with the round that is next open', run('chEd.id') === CH.id && /<details class="chround next" data-round="0" open>/.test(mgr().innerHTML) && /id="ch-name" value="Club Cup 2026"/.test(mgr().innerHTML) && mgr().innerHTML.includes('chpill next">Next'));
  { const asked = []; ctx.confirm = m => { asked.push(m); return true; }; await E('ch-back').onclick(); await wait(50); ctx.confirm = () => true;
    say('Back with nothing changed does not ask, and is the list again', asked.length === 0 && run('chEd') === null && mgr().innerHTML.includes('id="newch"')); }
  await click({ dup: CH.id }); await wait(30);
  { const cp = store.championships[1];
    say('Duplicate makes a copy: "(copy)" after the name, and new ids for the rounds and the sessions (so races of the first one never count for the copy)', store.championships.length === 2 && cp.name === 'Club Cup 2026 (copy)' && cp.rounds.length === 2 && cp.rounds[0].id !== CH.rounds[0].id && cp.rounds[0].sessions.every(s => !CH.rounds[0].sessions.some(o => o.id === s.id)) && cp.roster.length === 3); }
  { const asked = []; ctx.confirm = m => { asked.push(m); return false; };
    await click({ del: store.championships[1].id }); say('Delete asks first, and "Cancel" keeps the championship', store.championships.length === 2 && asked.length === 1 && asked[0].includes('stay in Results and Records'));
    ctx.confirm = () => true; await click({ del: store.championships[1].id }); await wait(30);
    say('...after OK it is gone, and the list is drawn again', store.championships.length === 1 && mgr().innerHTML.includes('Club Cup 2026') && !mgr().innerHTML.includes('(copy)')); }
  { const asked = []; ctx.confirm = m => { asked.push(m); return false; };
    await click({ edit: CH.id }); await click({ sdel: '0:0' });
    say('removing a session of a round that was not driven does not ask', run('chEd.draft.rounds[0].sessions.length') === 2 && asked.length === 0); E('ch-undo').onclick(); await wait(10);
    say('...Undo puts it back', run('chEd.draft.rounds[0].sessions.length') === 3);
    run('chEd.lists.sessions = ' + JSON.stringify([{ id: 'old1', setupName: 'x', sessionType: 'practice', trackId: 't4', date: '2026-10-03T10:00:00Z', standings: [], champ: C.tagOf(C.clean(CH, true), 0, 0, { setups: store.racesetups }) }]));
    await click({ sdel: '0:0' });
    say('removing a session that was driven asks first, and says that the race stays in the results', asked.length === 1 && asked[0].includes('was driven') && asked[0].includes('stays in the results') && run('chEd.draft.rounds[0].sessions.length') === 3);
    await click({ rdel: '0' });
    say('...so does deleting a round with a session that was driven (and "Cancel" keeps it)', asked.length === 2 && asked[1].includes('Round 1 has 1 session that was driven') && run('chEd.draft.rounds.length') === 2);
    ctx.confirm = () => true; await click({ rdel: '1' });
    say('...a round without driven sessions is deleted after OK or without asking', run('chEd.draft.rounds.length') === 1);
    ctx.confirm = m => { asked.push(m); return false; }; asked.length = 0; await E('ch-back').onclick(); await wait(30);
    say('Back with changes that are not saved asks first; "Cancel" stays in the editor', asked.length === 1 && asked[0].includes('Discard your unsaved changes to this championship?') && run('chEd') !== null);
    ctx.confirm = () => true; await E('ch-back').onclick(); await wait(50);
    say('...OK leaves the editor and shows the list', run('chEd') === null && mgr().innerHTML.includes('id="newch"')); }
  { await setup(); await click({ edit: CH.id }); await click({ sadd: '0' }); const asked = []; ctx.confirm = m => { asked.push(m); return false; };
    const strip = id => E('setuptabs').onclick({ target: { closest: () => ({ dataset: { id } }) } });
    strip('fuel');
    say('another tab of Race Setup asks first while the championship has changes that are not saved; "Cancel" stays on the page', asked.length === 1 && asked[0].includes('Discard your unsaved changes to this championship?') && run('state.setupSub') === 'championships' && run('chEd') !== null);
    ctx.confirm = () => true; strip('fuel'); await wait(80);
    say('...OK leaves the editor (the changes are dropped) and opens the other tab', run('chEd') === null && run('state.setupSub') === 'fuel');
    await setup(); say('...and the Championships tab shows the list again, with the saved championship as it was', mgr().innerHTML.includes('id="newch"') && mgr().innerHTML.includes('2 rounds · 6 sessions · 3 drivers')); }
  // the list and the editor follow what was driven
  { const cl = C.clean(CH, true), dr = (r, s, k) => ({ id: 'p' + r + s, date: '2026-10-0' + (1 + k) + 'T10:00:00Z', standings: [], champ: C.tagOf(cl, r, s, { setups: store.racesetups }) });
    store.sessions = [dr(0, 0, 0), dr(0, 1, 1)]; await setup();
    say('the list says how much is driven: "2 of 6 sessions driven"', mgr().innerHTML.includes('2 of 6 sessions driven') && !mgr().innerHTML.includes('finished'));
    store.sessions = [0, 1, 2].map(k => dr(0, k, k)); await setup(); await click({ edit: CH.id });
    { const h = mgr().innerHTML;
      say('Edit opens only the round that is next: round 1 is done and closed, round 2 is next and open', /<details class="chround" data-round="0">/.test(h) && /<details class="chround next" data-round="1" open>/.test(h) && h.includes('chpill done">Done') && h.includes('chpill next">Next')); }
    await E('ch-back').onclick(); await wait(50);
    store.sessions = [0, 1, 2].map(k => dr(0, k, k)).concat([0, 1, 2].map(k => dr(1, k, 3 + k))); await setup();
    say('...a championship with every session driven says "6 of 6 sessions driven · finished"', mgr().innerHTML.includes('6 of 6 sessions driven · finished'));
    // a round with one session that was driven: only that session asks before it goes
    store.sessions = [dr(0, 0, 0)]; await setup(); await click({ edit: CH.id });
    const asked = []; ctx.confirm = m => { asked.push(m); return false; };
    await click({ sdel: '0:1' });
    say('removing a session that was not driven does not ask, even when another session of its round was driven', asked.length === 0 && run('chEd.draft.rounds[0].sessions.length') === 2);
    await click({ sdel: '0:0' });
    say('...the one that was driven does, and "Cancel" keeps it', asked.length === 1 && run('chEd.draft.rounds[0].sessions.length') === 2);
    await click({ sdel: '1:0' });
    E('ch-copyfirst').onclick();
    say('"Copy the sessions of round 1 to all rounds" asks first while the other rounds have sessions; "Cancel" keeps what they have', asked.length === 2 && asked[1].includes('Give every other round the sessions of round 1?') && run('chEd.draft.rounds[1].sessions.map(s => s.setup).join()') === 's-qual,s-race');
    await click({ sdel: '1:0' }); await click({ sdel: '1:0' });
    E('ch-copyfirst').onclick();
    say('...when the other rounds have no sessions it just copies, without asking', asked.length === 2 && run('chEd.draft.rounds[1].sessions.map(s => s.setup).join()') === 's-prac,s-race');
    await click({ xdel: 'd2' }); const hh = mgr().innerHTML;
    say('a driver who is taken out of the roster is gone from the page at once, and is offered again in "Add a driver"', run('chEd.draft.roster.map(x => x.driver).join()') === 'd1,d3' && !hh.includes('data-xrow="d2"') && /id="ch-adddriver"[\s\S]*?<option value="d2">/.test(hh));
    ctx.confirm = () => true; await E('ch-back').onclick(); await wait(50); store.sessions = []; }
  run('chEd = null'); ctx.confirm = () => true;

  // ---------- Home: the card with the next session ----------
  store.championships = [JSON.parse(JSON.stringify(C.clean({ id: 'ch1', name: 'Club Cup 2026', rounds: [
    { id: 'r1', name: 'Opener', track: 't4', date: 'Sat 3 Oct', sessions: [{ id: 'a1', setup: 's-prac' }, { id: 'a2', setup: 's-qual' }, { id: 'a3', setup: 's-race' }] },
    { id: 'r2', name: 'Final', track: '', date: '', sessions: [{ id: 'b1', setup: 's-prac' }, { id: 'b2', setup: 's-race', share: 50 }] }],
    roster: [{ driver: 'd2', team: 'tm1', from: 1 }, { driver: 'd1', team: 'tm1', from: 1 }, { driver: 'd3', team: 'tm2', from: 2 }] }, true)))];
  run("state.settings = { theme: 'dark', lastSetupId: 's-race' }");
  { const h = await home();
    say('Home shows no card of a championship until one is chosen: Start a race has a choice Championship (None, a normal race, and the championship), and nothing of the championship is on Home', h.includes('id="champsel"') && h.includes('<option value="">None: a normal race</option>') && /<option value="ch1">Club Cup 2026<\/option>/.test(h) && !h.includes('id="champband"') && !h.includes('id="champload"') && !h.includes('Round 1 of 2'));
    say('...the choice is in the Start a race card, under the title (the Race setup box, 1.58.0)', h.indexOf('id="hmc-start"') < h.indexOf('id="setup"') && h.indexOf('id="setup"') < h.indexOf('id="champsel"')); }
  await homeChange('champsel', 'ch1'); await wait(150);
  { const h = view().innerHTML;
    say('choosing the championship makes its card appear inside Start a race, under the choice (the Race setup box is the title above them, 1.58.0): the round, its name and track, and how many sessions are driven; the choice is remembered', h.includes('id="champband"') && h.indexOf('id="hmc-start"') < h.indexOf('id="champsel"') && h.indexOf('id="setup"') < h.indexOf('id="champsel"') && h.indexOf('id="champsel"') < h.indexOf('id="champband"') && /<option value="ch1" selected>Club Cup 2026/.test(h) && h.includes('Round 1 of 2 · Opener · Big track · Sat 3 Oct') && h.includes('0 of 5 sessions driven') && run('state.settings.champId') === 'ch1');
    say('...the sessions of the round as steps (the next one is marked), and a button to load the next one: "Load Practice"', (h.match(/class="chstep[ "]/g) || []).length === 3 && /class="chstep next"/.test(h) && h.includes('Practice: Practice 5 min') && h.includes('Qualifying: Qualifying 5 min') && h.includes('points: 100%') && />Load Practice</.test(h) && h.includes('data-load="0:0"'));
    say('...and a choice of another session (every session of every round), with the words that say that nothing starts', h.includes('id="champpick"') && h.includes('Round 2 · Final') && h.includes('Another session...') && h.includes('Fills the race setup and the lanes below; nothing starts until you press Start race.'));
    say('...the name of the championship is in the choice only, not in the card again', !h.includes('class="chname"') && !h.includes('class="chlabel"'));
    say('...the card of the race is a normal race until a session is loaded: no "Counts for" line', !h.includes('id="chcounts"') && !h.includes('Counts for')); }
  await homeClick({ id: 'champload', load: '0:0' }); await wait(150);
  { const h = view().innerHTML, s = run('state.settings');
    say('"Load Practice" puts its race setup on Home, remembers the session, and the card says "Counts for Club Cup 2026 · Round 1 · Practice"', s.lastSetupId === 's-prac' && s.champTag && s.champTag.champId === 'ch1' && s.champTag.roundId === 'r1' && s.champTag.sessionId === 'a1' && s.champTag.setupId === 's-prac' && h.includes('id="chcounts"') && h.includes('Counts for Club Cup 2026') && h.includes('Round 1 · Practice') && h.includes('(change the race setup and it is a normal race again)'));
    say('...the track is the track of the round (Big track, 4 lanes), not that of the race setup (Living room)', /Big track<\/span><span class="hs-chip">4 lanes<\/span>/.test(h) && !h.includes('Living room</span><span class="hs-chip">') && (h.match(/class="lane/g) || []).length === 4);
    say('...the drivers of the roster come first in the driver boxes (in the order of the roster, Sam before Alex; Kim joins in round 2 and is a guest in round 1), the others after them as guests', (hh => hh.includes('<optgroup label="Club Cup 2026: the roster">') && hh.includes('<optgroup label="Other drivers (they drive as guests)">'))(h)
      && (() => { const o = h.slice(h.indexOf('<optgroup label="Club Cup 2026: the roster">'), h.indexOf('</optgroup>', h.indexOf('<optgroup label="Club Cup 2026: the roster">'))); return o.indexOf('>Sam<') > 0 && o.indexOf('>Sam<') < o.indexOf('>Alex') && !o.includes('Kim'); })());
    say('...the button says it is loaded', h.includes('Loaded: Practice')); }
  { await homeChange('champsel', ''); await wait(120);
    const h = view().innerHTML, s = run('state.settings');
    say('None makes it a normal race again: the card is gone, the choice and the loaded session are let go, and the race setup stays as it was', !h.includes('id="champband"') && !h.includes('id="chcounts"') && !h.includes('Counts for') && !h.includes('<optgroup label="Club Cup 2026: the roster">') && s.champTag === null && !s.champId && s.lastSetupId === 's-prac' && !/<option value="ch1" selected>/.test(h) && h.includes('<option value="">None: a normal race</option>'));
    await homeChange('champsel', 'ch1'); await wait(120);
    say('...choosing it again shows the card again with the next session, and nothing is loaded', view().innerHTML.includes('id="champband"') && !view().innerHTML.includes('Counts for') && !run('state.settings.champTag') && run('state.settings.champId') === 'ch1');
    await homeClick({ id: 'champload', load: '0:0' }); await wait(150); }
  { run("state.settings.champId = 'ch1'"); await homeChange('setup', 's-qual'); await wait(100);
    const h = view().innerHTML;
    say('another race setup in the Race setup box makes it a normal race again: the tag is cleared and the line is gone', run('state.settings.champTag') === null && !h.includes('id="chcounts"') && !h.includes('<optgroup label="Club Cup 2026: the roster">') && h.includes('Living room</span><span class="hs-chip">')); }
  await homeChange('champpick', '0:2'); await wait(150);
  { const h = view().innerHTML;
    say('"Another session" loads the session that was chosen (here the race of round 1) the same way', run('state.settings.lastSetupId') === 's-race' && run('state.settings.champTag.sessionId') === 'a3' && h.includes('Round 1 · Race') && h.includes('Counts for Club Cup 2026'));
    say('...the button of the next session (the practice) still says "Load Practice": it says "Loaded" only for the session that is loaded', />Load Practice</.test(h) && !h.includes('Loaded:')); }
  await homeChange('champpick', '1:1'); await wait(150);
  say('...a sprint says so: "Race at 50%", and a round with no track of its own uses the track of the race setup', view().innerHTML.includes('Round 2 · Race at 50%') && view().innerHTML.includes('Living room</span><span class="hs-chip">') && run('state.settings.champTag.roundId') === 'r2');
  say('...Kim joins in round 2: here she is in the roster part of the driver boxes', (hh => { const a = hh.indexOf('<optgroup label="Club Cup 2026: the roster">'); return a > 0 && hh.slice(a, hh.indexOf('</optgroup>', a)).includes('>Kim<'); })(view().innerHTML));
  { // a session whose race setup is gone cannot be loaded; the card says why
    const keep = store.racesetups; store.racesetups = keep.filter(s => s.id !== 's-prac'); run("state.settings.champTag = null; state.settings.lastSetupId = 's-race'");
    const h = await home();
    say('a session whose race setup was deleted: the card says so and the button is off (nothing can be loaded)', h.includes('Round 1, session 1: its race setup was deleted') && /id="champload"[^>]*disabled/.test(h) && h.includes('(deleted race setup)'));
    store.racesetups = keep; }
  // the round that is next follows what was driven
  { store.sessions = [{ id: 'z1', date: '2026-10-03T10:00:00Z', setupName: 'Practice 5 min', sessionType: 'practice', trackId: 't4', standings: [], champ: { id: 'ch1', name: 'Club Cup 2026', round: 1, roundId: 'r1', session: 1, sessionId: 'a1', kind: 'practice', share: 100 } },
      { id: 'z2', date: '2026-10-03T10:20:00Z', setupName: 'Qualifying 5 min', sessionType: 'qualifying', trackId: 't4', standings: [], champ: { id: 'ch1', name: 'Club Cup 2026', round: 1, roundId: 'r1', session: 2, sessionId: 'a2', kind: 'qualifying', share: 100 } }];
    run("state.settings.champTag = null; state.settings.lastSetupId = 's-race'");
    const h = await home();
    say('after the practice and the qualifying were driven, the race of round 1 is next: two steps are done (a tick), the race is next, and the button says "Load Race"', (h.match(/class="chstep done"/g) || []).length === 2 && /class="chstep next"/.test(h) && />Load Race</.test(h) && h.includes('2 of 5 sessions driven') && h.includes('data-load="0:2"') && h.includes('&#10003;'));
    store.sessions = [];
    const all = ['a1', 'a2', 'a3'].map((id, k) => ({ id: 'y' + k, date: '2026-10-03T1' + k, standings: [], champ: { id: 'ch1', roundId: 'r1', sessionId: id } })).concat(['b1', 'b2'].map((id, k) => ({ id: 'w' + k, date: '2026-10-10T1' + k, standings: [], champ: { id: 'ch1', roundId: 'r2', sessionId: id } })));
    store.sessions = all; const f = await home();
    say('when every session is driven the card says the championship is finished, has no Load button, and still lets you drive a session again', f.includes('Finished: all 5 sessions are driven.') && !f.includes('id="champload"') && f.includes('Drive a session again...') && f.includes('5 of 5 sessions driven') && !f.includes('class="chsteps"'));
    store.sessions = []; }
  { const two = store.championships[0]; store.championships = [two, { ...JSON.parse(JSON.stringify(two)), id: 'ch2', name: 'Winter Series' }]; run("state.settings.champId = 'ch2'");
    const h = await home();
    say('with two championships the choice lists both and None, at the one that was chosen last', h.includes('id="champsel"') && (h.slice(h.indexOf('id="champsel"'), h.indexOf('</select>', h.indexOf('id="champsel"'))).match(/<option /g) || []).length === 3 && /<option value="ch2" selected>Winter Series/.test(h) && h.includes('<option value="">None: a normal race</option>'));
    await homeChange('champsel', 'ch1'); await wait(100);
    say('...choosing the other one shows that one (and remembers it)', run('state.settings.champId') === 'ch1' && /<option value="ch1" selected>Club Cup 2026/.test(view().innerHTML));
    run("state.settings.champId = 'ch1'; state.settings.lastSetupId = 's-prac'; state.settings.champTag = { champId: 'ch1', roundId: 'r1', sessionId: 'a1', setupId: 's-prac' }"); await home();
    await homeChange('champsel', 'ch2'); await wait(100);
    say('choosing another championship lets go of a session that was loaded for the first one: the race is a normal race again', run('state.settings.champId') === 'ch2' && run('state.settings.champTag') === null && !view().innerHTML.includes('Counts for'));
    await homeChange('champsel', 'ch1'); await wait(100); run("state.settings.champId = 'ch2'; state.settings.champTag = { champId: 'ch1', roundId: 'r1', sessionId: 'a1', setupId: 's-prac' }");
    const t = await home();
    say('a session that is loaded belongs to its championship: the card shows that one, even when another one was chosen last', /<option value="ch1" selected>/.test(t) && !/<option value="ch2" selected>/.test(t) && t.includes('Counts for Club Cup 2026'));
    run("state.settings.champTag = null; state.settings.lastSetupId = 's-race'; state.settings.champId = 'ch1'");
    store.championships = [two]; }
  { // a Time Token Session in a round: nothing can be loaded from it
    const odd = JSON.parse(JSON.stringify(store.championships[0])); odd.rounds[0].sessions[0].setup = 's-tok'; store.championships = [odd]; run("state.settings.champTag = null; state.settings.champId = 'ch1'");
    const h = await home();
    say('a session with a Time Token Session says that it can not be part of a championship, and the Load button is off', h.includes('is a Time Token Session, which can not be part of a championship') && /id="champload"[^>]*disabled/.test(h));
    await homeChange('champpick', '0:0'); await wait(100);
    say('...picking it from the choice does not load it: the card says why, and the race stays a normal race', view().innerHTML.includes('role="alert"') && run('state.settings.champTag') === null);
    store.championships = [JSON.parse(JSON.stringify(C.clean({ ...odd, rounds: odd.rounds.map((r, i) => (i ? r : { ...r, sessions: [{ id: 'a1', setup: 's-prac' }, ...r.sessions.slice(1)] })) }, true)))]; }
  { const keep = store.championships, z = JSON.parse(JSON.stringify(keep[0])); z.rounds[0].sessions = [{ id: 'a1', setup: 's-prac' }, { id: 'a3', setup: 's-race', share: 0 }, { id: 'a4', setup: 's-race', share: 50 }];
    store.championships = [JSON.parse(JSON.stringify(C.clean(z, true)))]; run("state.settings.champTag = null; state.settings.lastSetupId = 's-race'");
    const h = await home();
    say('a race that gives no points says "points: none" on the card, a sprint says 50%', h.includes('points: none') && h.includes('points: 50%'));
    store.championships = keep; }

  // ---------- a race that counts ----------
  run("state.settings = { theme: 'dark', lastSetupId: 's-race', champId: 'ch1', assignments: { 's-race': [1, 2, 3, 4].map(i => ({ driverId: 'd' + i, carId: 'c' + i })) } }"); store.sessions = []; await home();
  await homeClick({ id: 'champload', load: '0:0' }); await wait(120);
  await homeChange('champpick', '0:2'); await wait(150);
  say('before the start: the race of round 1 is loaded for the four lanes', run('state.settings.champTag.sessionId') === 'a3' && view().innerHTML.includes('Counts for Club Cup 2026') && /id="start"(?![^>]*disabled)/.test(view().innerHTML));
  run('state.speed = 40'); await homeClick({ id: 'start' }); await wait(150);
  { const r = run('state.race');
    say('Start race takes the tag along: the race that is started counts for the championship (round 1, session 3, a race at 100%)', r && r.champ && r.champ.id === 'ch1' && r.champ.round === 1 && r.champ.roundId === 'r1' && r.champ.sessionId === 'a3' && r.champ.session === 3 && r.champ.kind === 'race' && r.champ.share === 100 && r.champ.name === 'Club Cup 2026');
    say('...on the track of the round (Big track)', r.track.id === 't4' && r.setup.id === 's-race');
    await run('render()'); await wait(150);
    const host = E('racehost').innerHTML;
    say('the race screen shows the tag next to the name of the race: "Club Cup 2026 · Round 1 · Race"', host.includes('id="chtag"') && host.includes('Club Cup 2026 · Round 1 · Race') && host.includes('Club Night heat')); }
  saved.length = 0; resumes.length = 0;
  key(' '); await until(() => phase() === 'running', 5000); await wait(60);
  say('while the race goes on, the snapshot for a resume carries the tag too', await (async () => { await wait(300); key('1'); await wait(100); await until(() => resumes.length > 0, 4000); return resumes.length > 0 && resumes[resumes.length - 1].race.champ && resumes[resumes.length - 1].race.champ.sessionId === 'a3'; })());
  for (let n = 0; n < 3; n++) for (const k of ['1', '2', '3', '4']) { key(k); await wait(60); }
  await until(() => phase() !== 'running', 6000); await until(() => saved.length > 0, 6000); await wait(100);
  { const s = saved[0] && saved[0][0];
    say('the race is saved once, with the tag in the session (the championship, the round, the session, the kind and the share)', saved.length === 1 && s.champ && s.champ.id === 'ch1' && s.champ.roundId === 'r1' && s.champ.sessionId === 'a3' && s.champ.kind === 'race' && s.champ.share === 100 && s.sessionType === 'race');
    say('...the message says that it is part of the championship', E('msg').textContent.includes('It is part of Club Cup 2026.') && E('msg').textContent.includes('See Database > Results and Records.'));
    say('...and Home does not keep the tag: the next race is a normal race until a session is loaded again', run('state.settings.champTag') === null); }
  // a race that does not count is saved as before
  saved.length = 0; run("state.settings.champTag = null; state.race = null");
  await openRace({ ...SRA }, store.tracks[0], rows(1, 2)); key(' '); await until(() => phase() === 'running', 5000); await wait(60);
  for (let n = 0; n < 3; n++) { key('1'); await wait(80); key('2'); await wait(80); }
  await until(() => saved.length > 0, 8000); await wait(60);
  say('a race without a tag is saved without one, and the message is the old one', saved.length === 1 && !('champ' in saved[0][0]) && E('msg').textContent === `Saved ${saved[0][1].length} laps. See Database > Results and Records.` && !E('racehost').innerHTML.includes('id="chtag"'));

  // ---------- coming back after a crash, and the results ----------
  { const tag = C.tagOf(C.clean(store.championships[0], true), 0, 0, { setups: store.racesetups });
    ctx.__resume = { v: 1, savedAt: '2026-10-19T12:00:00Z', name: 'Practice 5 min', kind: 'Practice', trackName: 'Big track', elapsed: 60000, phase: 'running', race: { setup: SPR, track: store.tracks[1], rows: rows(1, 2, 3, 4), champ: tag }, eng: null };
    run("state.race = null; state.tab = 'home'"); const h = await home();
    await homeClick({ id: 'resumego' }); await wait(100);
    say('a race that was interrupted and comes back keeps its tag (the snapshot had it)', h.includes('A race was interrupted') && run('state.race') && run('state.race.champ') && run('state.race.champ.sessionId') === 'a1');
    ctx.__resume = null; run('state.race = null'); }
  { store.sessions = [{ id: 'q1', date: '2026-10-03T10:00:00Z', setupName: 'Club Night heat', sessionType: 'race', trackId: 't4', trackName: 'Big track', endedBy: 'laps', standings: [{ pos: 1, driverId: 'd1', carId: 'c1', driverName: 'Alex', carName: 'Car1', laps: 2, best: 5000, total: 11000 }],
      champ: { id: 'ch1', name: 'Club Cup 2026', round: 1, roundId: 'r1', session: 3, sessionId: 'a3', kind: 'race', share: 50 } }, { id: 'q2', date: '2026-10-02T10:00:00Z', setupName: 'Club Night heat', sessionType: 'race', trackId: 't4', trackName: 'Big track', endedBy: 'laps', standings: [{ pos: 1, driverId: 'd1', carId: 'c1', driverName: 'Alex', carName: 'Car1', laps: 2, best: 5000, total: 11000 }] }];
    store.laps = []; run("state.tab = 'database'; state.sub = 'results'; state.resultsSub = 'racing'"); await run('render()'); await wait(150);
    const h = E('resbody').innerHTML;
    say('in Results and Records a race of a championship has its tag in the line of the race: "Club Cup 2026 · Round 1 · Race at 50%"; a normal race has none', h.includes('class="chtag"') && h.includes('Club Cup 2026 · Round 1 · Race at 50%') && (h.match(/class="chtag"/g) || []).length === 1); }
  { const css = fs.readFileSync(R + 'renderer/styles.css', 'utf8'), land = fs.readFileSync(R + 'renderer/landing.js', 'utf8');
    say('1.56.1: the card of the championship has its own look inside the Start a race card (a tinted box with the pink edge), and it is no longer drawn above the grid', /\.hm-start \.champband\{background:color-mix\(in srgb,var\(--c-ch\) 7%,var\(--bg\)\);[^}]*border-top:3px solid var\(--c-ch\)/.test(css) && !/\$\{resumeHtml\}\s*\$\{champHtml\}/.test(land) && /\$\{champPickHtml\}\$\{champHtml\}/.test(land)); }
  console.log(fails ? fails + ' CHAMPIONSHIP SCREEN TESTS FAILED' : 'ALL CHAMPIONSHIP SCREEN TESTS PASSED');
  process.exit(fails ? 1 : 0);
})();
