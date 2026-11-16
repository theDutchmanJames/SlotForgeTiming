// 1.13.0: the Adjust panel (renderer/adjustui.js) on its own: the lane that is picked, which pads are shown and usable, Undo, and what happens when the race or the layout changes.
// The panel is the same on the Race Director page and on the Race tab; the screens tests (live, damagescreen, tokenrace) check it in place, this one checks the rules with stand-in buttons.
const vm = require('vm'), fs = require('fs'), path = require('path');
let fails = 0;
const say = (m, c) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const AdjustPad = require('../renderer/adjustpad.js'), Damage = require('../renderer/damage.js');

const els = {};
const state = { settings: {} };
const ctx = vm.createContext({ AdjustPad, Damage, performance, console, state,
  document: { getElementById: id => (els[id] = els[id] || { textContent: '' }) },
  api: { setSettings: async p => Object.assign(state.settings, p) } });
const AdjustPanel = vm.runInContext(fs.readFileSync(path.join(__dirname, '../renderer/adjustui.js'), 'utf8') + '\n;AdjustPanel', ctx);

// stand-in page parts
const mkb = (dataset, extra = {}) => ({ dataset, disabled: false, hidden: false, ...extra });
function page() {
  const laneB = [0, 1, 2].map(l => mkb({ adjLane: String(l) }, { setAttribute(k, v) { this[k] = v; }, querySelector: () => ({ textContent: '' }) }));
  const pads = ['points', 'damage', 'time', 'laps', 'champ'].map(id => ({ dataset: { pad: id }, hidden: false, btns: [mkb({ sign: '1' }), mkb({ sign: '-1' })], querySelectorAll() { return this.btns; } }));
  const undoB = mkb({}), layB = ['h', 'v'].map(v => mkb({ adjLayout: v }, { setAttribute(k, x) { this[k] = x; } }));
  const box = { innerHTML: '', hidden: false, querySelectorAll: sel => (sel === '[data-adj-lane]' ? laneB : sel === '.pad' ? pads : sel === '[data-adj-undo]' ? [undoB] : sel === '[data-adj-layout]' ? layB : []) };
  const click = (sel, dataset, extra = {}) => box.onclick({ target: { closest: s => (s === sel ? { dataset, disabled: false, ...extra } : null) } });
  return { box, laneB, pads, undoB, layB, click };
}
const car = (lane, extra = {}) => ({ lane, driverName: 'D' + (lane + 1), points: 0, dq: false, dmg: 0, adjMs: 0, adjLaps: 0, adjPoints: 0, ...extra });
const hidden = pg => pg.pads.map(p => p.hidden).join();

(async () => {
  // ---- a race with a penalty system, no damage system, no heats ----
  let eng = { type: 'race', cars: [car(0), car(1)] }, phase = 'running', pen = true, champ = false, key = 'r1', sent = [];
  const make = (pg, extra = {}) => AdjustPanel.build(pg.box, { eng: () => eng, lanes: [0, 1, 2], phase: () => phase, now: () => performance.now(), penalty: () => pen, champ: () => champ,
    send: (g, l, a) => { sent.push([g, l, a]); const c = eng.cars.find(x => x.lane === l); if (g === 'time') c.adjMs += a * 1000; if (g === 'laps') c.adjLaps += a; if (g === 'points') c.points = Math.max(0, c.points + a); }, raceKey: () => key, id: 'u', ...extra });
  let pg = page(), panel = make(pg); panel.update();
  say('the panel draws a button for every lane, the five pads, Undo and the layout buttons', ['data-adj-lane="0"', 'data-adj-lane="2"'].every(x => pg.box.innerHTML.includes(x)) && ['points', 'damage', 'time', 'laps', 'champ'].every(g => pg.box.innerHTML.includes(`data-pad="${g}"`)) && pg.box.innerHTML.includes('data-adj-undo') && pg.box.innerHTML.includes('data-adj-layout="v"'));
  const pt = page(); make(pt, { title: 'Adjust' }); say('...a title makes a heading', pt.box.innerHTML.includes('<strong>Adjust</strong>'));
  say('a lane without a car has no button; nothing is picked, so every pad is off and Undo too', pg.laneB.map(b => b.hidden).join() === 'false,false,true' && pg.pads.every(p => p.btns.every(b => b.disabled)) && pg.undoB.disabled === true && els['u-who'].textContent.includes('Choose a lane') && els['u-last'].textContent === 'Nothing adjusted yet.');
  say('the pads of this race: penalty points, time and laps (no damage system, no championship points)', hidden(pg) === 'false,true,false,false,true');
  say('usable: there is something to adjust', panel.usable() === true);
  pg.click('[data-adj-lane]', { adjLane: '1' });
  say('picking a lane names it and switches the pads on (penalty minus stays off at 0 points)', els['u-who'].textContent === 'Lane 2 · D2' && pg.laneB[1]['aria-pressed'] === 'true' && pg.pads[0].btns[0].disabled === false && pg.pads[0].btns[1].disabled === true && pg.pads[2].btns.every(b => !b.disabled));
  pg.click('[data-pad-do]', { padDo: 'time', v: '10', sign: '1' });
  say('a pad press sends group, lane and signed amount, and the line says what was done', sent.length === 1 && sent[0].join() === 'time,1,10' && els['u-last'].textContent === 'Last: +10 s to D2' && pg.undoB.disabled === false);
  pg.click('[data-adj-undo]', {});
  say('Undo sends the opposite amount', sent[1].join() === 'time,1,-10' && els['u-last'].textContent === 'Undone: +10 s to D2' && pg.undoB.disabled === true);
  pg.click('[data-adj-undo]', {});
  say('...and with nothing to undo it sends nothing', sent.length === 2);
  pg.click('[data-adj-lane]', { adjLane: '0' }); pg.click('[data-pad-do]', { padDo: 'laps', v: '1', sign: '1' });
  say('a new race (or heat) starts again: no lane picked, nothing to undo', (key = 'r2', panel.update(), els['u-who'].textContent.includes('Choose a lane') && pg.undoB.disabled === true && els['u-last'].textContent === 'Nothing adjusted yet.'));

  // ---- phases, types, systems ----
  phase = 'ready'; panel.update();
  say('before the start the pads and the lanes are off and the panel says when they work', pg.laneB.every(b => b.disabled) && els['u-who'].textContent.includes('running or paused'));
  phase = 'paused'; panel.update(); pg.click('[data-adj-lane]', { adjLane: '1' });
  say('paused: the lanes can be picked', pg.laneB[1].disabled === false && els['u-who'].textContent === 'Lane 2 · D2');
  eng = { type: 'practice', cars: [car(0), car(1)] }; panel.update();
  say('a practice: only the penalty pad is left (time, laps and championship points are for races)', hidden(pg) === 'false,true,true,true,true' && panel.usable() === true);
  pen = false; panel.update();
  say('...and without a penalty system there is nothing to adjust: usable is false', hidden(pg) === 'true,true,true,true,true' && panel.usable() === false);
  pen = true; eng = { type: 'timed', cars: [car(0), car(1)] }; champ = true; panel.update();
  say('a timed race with championship points shows the green pad too', hidden(pg) === 'false,true,false,false,false');
  eng = { type: 'race', cars: [car(0, { points: 3 }), car(1, { dq: true })] }; phase = 'running'; panel.update();
  say('a disqualified car cannot get penalty points; with 3 points, minus is on for lane 1', (pg.click('[data-adj-lane]', { adjLane: '1' }), pg.pads[0].btns.every(b => b.disabled)) && (pg.click('[data-adj-lane]', { adjLane: '0' }), pg.pads[0].btns[1].disabled === false));

  // ---- the damage system (a real race engine: the panel asks the damage system what it allows) ----
  const RE = require('../renderer/engine.js');
  const R = RE.createRace({ type: 'timed', duration: 600, laps: 0, minLap: 800, penalty: RE.penaltyConfig({ everyPoints: 5, everySeconds: 5, dqPoints: '' }), damage: Damage.clean({ ...Damage.defaults() }, 0),
    entries: [0, 1].map(l => ({ lane: l, driverId: 'd' + l, driverName: 'Driver' + l, carId: 'c' + l })) });
  R.start(0); R.cars.forEach(c => { c.started = true; });
  eng = R; phase = 'running'; champ = false; let dmgOn = true;
  pg = page(); panel = make(pg, { damage: () => dmgOn, now: () => 1000, send: (g, l, a) => R.addDamage(R.cars.findIndex(c => c.lane === l), a, 1000, 'director') });
  panel.update();
  say('with a damage system the damage pad is shown (after the penalty points)', hidden(pg) === 'false,false,false,false,true');
  pg.click('[data-adj-lane]', { adjLane: '0' });
  say('...with no damage points yet: plus is on, minus is off', pg.pads[1].btns[0].disabled === false && pg.pads[1].btns[1].disabled === true);
  pg.click('[data-pad-do]', { padDo: 'damage', v: '2', sign: '1' });
  say('...+2 gives the car two damage points through the damage system, and then minus is on', R.cars[0].dmg === 2 && pg.pads[1].btns[1].disabled === false && els['u-last'].textContent === 'Last: +2 damage points to Driver0');
  pg.click('[data-adj-undo]', {});
  say('...Undo takes them back', R.cars[0].dmg === 0 && els['u-last'].textContent === 'Undone: +2 damage points to Driver0');
  dmgOn = false; panel.update();
  say('when the race has no damage system the damage pad goes', pg.pads[1].hidden === true);

  // ---- the layout, the settings and a page that draws the panel again ----
  pg.click('[data-adj-layout]', { adjLayout: 'v' }); await sleep(20);
  say('the layout button saves padLayout and draws the pads as rows', state.settings.padLayout === 'v' && pg.box.innerHTML.includes('pad-v') && !pg.box.innerHTML.includes('pad-h'));
  state.settings.padSeconds = [2, 4]; panel.update();
  say('new values in the settings are drawn on the next update', pg.box.innerHTML.includes('data-pad-do="time" data-sign="1" data-v="2"') && !pg.box.innerHTML.includes('data-v="30"'));
  const mem = panel.memory; pg.click('[data-adj-lane]', { adjLane: '1' });
  const pg2 = page(), panel2 = make(pg2, { memory: mem }); panel2.update();
  say('a page that builds the panel again can keep the lane (memory)', mem.lane === 1 && els['u-who'].textContent === 'Lane 2 · Driver1');
  const pg3 = page(); make(pg3, { bind: false });
  say('bind: false leaves the clicks to the page (it calls click itself)', pg3.box.onclick === undefined && typeof panel.click === 'function');

  // ---- 1.20.0: the values of the race setup ----
  {
    const app = { padPoints: [1, 2, 5], padSeconds: [5, 10, 30] }; let setup = { padPoints: '3, 1, 10', padLaps: '4' };
    const pgS = page(), pnl = make(pgS, { settings: () => AdjustPad.forSetup(app, setup), id: 'w' }); pnl.update();
    const h = () => pgS.box.innerHTML, has = (g, v) => h().includes(`data-pad-do="${g}" data-sign="1" data-v="${v}"`);
    say('a panel with the settings of a race setup draws its own values: penalty points 1, 3, 10 and laps 4', has('points', 3) && has('points', 10) && !has('points', 5) && has('laps', 4) && !has('laps', 2));
    say('...the pads without a list of their own keep the app-wide values (time 5, 10, 30)', has('time', 5) && has('time', 30));
    pgS.click('[data-adj-lane]', { adjLane: '0' }); pgS.click('[data-pad-do]', { padDo: 'laps', v: '4', sign: '1' });
    say('...a press on one of those values sends that amount', sent[sent.length - 1].join() === 'laps,0,4' && els['w-last'].textContent === `Last: +4 laps to ${eng.cars.find(c => c.lane === 0).driverName}`);
    setup = { padPoints: '2, 7' }; pnl.update();
    say('another race setup (the next race or heat) draws the pads again with its values; the laps are back to the app-wide values', has('points', 7) && !has('points', 10) && has('laps', 2) && !has('laps', 4));
    setup = { name: 'plain' }; pnl.update();
    say('a race setup without lists of its own: the app-wide values of the settings', has('points', 5) && !has('points', 7) && has('laps', 1));
    const before = h(); pnl.update();
    say('nothing is drawn again while the values stay the same', h() === before);
    say('the line under the pads says the values are set in App Settings and per race setup', h().includes('set in App Settings, Race Director, and per race setup'));
  }

  console.log(fails ? fails + ' ADJUST PANEL TESTS FAILED' : 'ALL ADJUST PANEL TESTS PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERROR', e.stack); process.exit(1); });
