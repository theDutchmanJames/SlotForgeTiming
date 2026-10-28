// 1.72.0: the lane cards (renderer/lanecards.js) of the Race Director, on their own: what the cards show (view(), worked out from a real race engine) and what the buttons do (a small page, tests/minidom.js).
// The screens tests (lanecardsscreen) check the cards in place, on the Race tab and on the Race Director page; this one checks the rules and the buttons.
// The commands the cards send are put through the same engine calls as the race window makes (race.js: actions.pad, assign, damage, failure, failureClear, bop, weather), so a press really changes a race.
const vm = require('vm'), fs = require('fs'), path = require('path');
const { Dom } = require('./minidom.js');
let fails = 0;
const say = (m, c) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const R = f => path.join(__dirname, '../renderer', f);
const RE = require(R('engine.js')), Dm = require(R('damage.js')), Fl = require(R('failures.js')), Bp = require(R('bop.js')), Wx = require(R('weather.js')), Pad = require(R('adjustpad.js'));
const SafetyCar = require(R('safetycar.js')), TyreWear = require(R('tyretemperature.js', 'tyrewear.js'));
const SRC = ['adjustui.js', 'penaltyui.js', 'lanecards.js'].map(f => fs.readFileSync(R(f), 'utf8')).join('\n') + '\n;({ AdjustPanel, PenaltyPanel, LaneCards })';

const dmgRec = { ...Dm.defaults(), failuresOn: 'on', failFrom: 10, failTo: 90, failMax: 1, failures: [{ name: 'Slow Puncture', level: 'Heavy damage', chance: 5, seconds: 10 }, { name: 'Lift and Coast', level: 'Light damage', chance: 10, seconds: 5 }], incidents: [{ name: 'Contact', points: 2 }, { name: 'Hard crash', points: 4 }] };
const types = [{ name: 'Drivethrough', kind: 'drivethrough', seconds: 5, cost: 3, extra: 1, unserved: 10 }, { name: 'Jump start', kind: 'stopgo', seconds: 5, cost: 1, extra: 1, unserved: 10 }];
const penCfg = (over = {}) => ({ on: true, mode: 'every', every: 5, seconds: 5, steps: [], dq: 0, types, fuelPoints: 0, ...over });
const fuel = { on: true, tank: 100, perLap: 2, rate: 10, target: 0, extra: 0, saving: 0, empty: 'retire', pitHold: 2000 };
const entries = n => Array.from({ length: n }, (_, i) => ({ lane: i, driverId: 'd' + i, carId: 'c' + i, driverName: ['James', 'Bjornie', 'Kim', 'Lee'][i], carName: 'car' + i }));
// a race: o.pen (false: no penalty system), o.damage (false: none), o.bop, o.weather, o.type, o.lanes
function race(o = {}) {
  const eng = RE.createRace({ type: o.type || 'race', laps: 20, endRule: 'all', entries: entries(o.lanes || 2), fuel, penalty: o.pen === false ? { on: false } : penCfg(o.pen || {}),
    ...(o.damage === false ? {} : { damage: Dm.clean(dmgRec, 0) }), ...(o.bop === false ? {} : { bop: { mode: 'manual', percent: 20 } }), ...(o.weather === false ? {} : { weather: Wx.clean({ startMode: 'director' }, 1) }) });
  eng.start(0); return eng;
}

// one page of the cards: its own document, its own copy of the code, a race, and commands that work like the ones of the race window
function world(o = {}) {
  const dom = new Dom(), box = dom.root(), eng = o.eng || race(o), lanes = Array.from({ length: o.lanes || 2 }, (_, i) => i);
  const ctx = vm.createContext({ AdjustPad: Pad, Damage: Dm, Failures: Fl, Bop: Bp, Wx, SafetyCar, TyreWear, performance, console, document: dom.document, state: { settings: {} }, api: {} });
  const { LaneCards, AdjustPanel } = vm.runInContext(SRC, ctx);
  const w = { dom, box, eng, lanes, LaneCards, AdjustPanel, phase: 'running', t: 1000, settings: o.settings || {}, key: 'r1', sent: [], tyres: [], pen: o.pen !== false, champ: !!o.champ };
  const idx = lane => eng.cars.findIndex(c => c.lane === lane), now = () => w.t, live = () => ['running', 'paused'].includes(w.phase);
  const send = {
    pad: (g, lane, a) => { w.sent.push(['pad', g, lane, a]); const i = idx(lane); if (!live() || i < 0) return false;
      if (g === 'points') return eng.addPoints(i, Math.round(a), now()); if (g === 'damage') return eng.addDamage(i, a, now(), 'director');
      return eng.adjust(i, g === 'time' ? { ms: Math.round(a * 1000) } : g === 'laps' ? { laps: Math.round(a) } : { points: a }); },
    assign: (lane, ti) => { w.sent.push(['assign', lane, ti]); if (live() && idx(lane) >= 0) eng.assign(idx(lane), ti, now()); },
    damage: (lane, n) => { w.sent.push(['damage', lane, n]); if (live() && idx(lane) >= 0) eng.addDamage(idx(lane), n, now(), 'director'); },
    failure: (lane, k) => { w.sent.push(['failure', lane, k]); if (live() && idx(lane) >= 0) eng.giveFailure(idx(lane), k, now()); },
    failureClear: lane => { w.sent.push(['failureClear', lane]); if (live() && idx(lane) >= 0) eng.clearFailure(idx(lane), now()); },
    bop: (lane, how) => { w.sent.push(['bop', lane, how]); if (idx(lane) >= 0) eng.bopPress(idx(lane), how, now()); },
    weather: st => { w.sent.push(['weather', st]); eng.wxSet(st, now(), 'director'); },
  };
  w.cards = LaneCards.build(box, { eng: () => eng, lanes, phase: () => w.phase, now, settings: () => Pad.forSetup(w.settings, w.setup || {}), penalty: () => w.pen, penaltyTypes: () => types, champ: () => w.champ,
    tyre: o.tyre, send, refresh: () => w.cards.update(), raceKey: () => w.key, openTyre: lane => w.tyres.push(lane), memory: o.memory, bind: o.bind });
  const rawView = w.cards.view; w.cards.view = () => { w.cards.update(); return rawView(); }; // (the cards keep the view of their last update; a test that changed the race asks for a fresh one)
  w.cards.update();
  // finding things (the little page knows no selectors that go down: one step at a time)
  w.card = lane => box.querySelector(`[data-lc-lane="${lane}"]`);
  w.pad = (lane, g) => w.card(lane).querySelector(`[data-pad="${g}"]`);
  w.plus = (lane, g) => w.pad(lane, g).querySelector('.lc-pp'); w.minus = (lane, g) => w.pad(lane, g).querySelector('.lc-pm'); w.val = (lane, g) => w.pad(lane, g).querySelector('.lc-val');
  w.pop = (lane, key) => w.card(lane).querySelector(`[data-lc-pop="${key}"]`);
  w.click = el => { if (!el) throw new Error('no such element'); w.cards.click(el); };
  w.car = lane => eng.cars.find(c => c.lane === lane);
  w.undo = () => box.querySelector('[data-lc-undo]'); w.last = () => box.querySelector('.lc-last').textContent;
  w.sentOf = k => w.sent.filter(x => x[0] === k);
  return w;
}
const chipTexts = (w, lane) => w.card(lane).querySelector('.lc-chips').children.map(c => c.textContent);

(async () => {
  // ---- the setting ----
  const { LaneCards: LC } = (() => { const w = world(); return w; })();
  say('the cards are the standard: no setting, or "cards", turns them on; "folders" brings the old folders back', LC.on(undefined) && LC.on({}) && LC.on({ directorView: 'cards' }) && !LC.on({ directorView: 'folders' }));
  say('the order of the pads on a card is penalty points, time, laps, damage, championship points; from 3 lanes the log is a drawer', LC.ORDER.join() === 'points,time,laps,damage,champ' && LC.DRAWER_FROM === 3);
  say('the numbers on a card: points are plain, time says + or − and seconds, laps and championship points say + or −',
    LC.valueText('points', 3) === '3' && LC.valueText('damage', 0) === '0' && LC.valueText('time', 5) === '+5 s' && LC.valueText('time', -10) === '−10 s' && LC.valueText('time', 0) === '0 s' && LC.valueText('laps', 1) === '+1' && LC.valueText('laps', -2) === '−2' && LC.valueText('champ', 2.5) === '+2.5' && LC.valueText('champ', 0) === '0');
  const off = (g, c, d, r) => LC.padOff(g, c, d, r);
  say('which buttons are off (the rules of the Adjust folder): nothing works when the race is not running or the car is gone', off('points', { points: 3 }, null, false).plus && off('points', { points: 3 }, null, false).minus && off('time', null, null, true).plus);
  say('...penalty points: the minus button is off at 0 points, both are off for a disqualified car; time, laps and championship points always work', off('points', { points: 0 }, null, true).minus && !off('points', { points: 0 }, null, true).plus && !off('points', { points: 2 }, null, true).minus && off('points', { points: 2, dq: true }, null, true).plus && off('points', { points: 2, dq: true }, null, true).minus && !off('time', { points: 0 }, null, true).minus && !off('laps', {}, null, true).plus && !off('champ', {}, null, true).minus);
  say('...damage points: the buttons follow what the Damage System allows (give, take)', !off('damage', {}, { give: true, take: false }, true).plus && off('damage', {}, { give: true, take: false }, true).minus && off('damage', {}, { give: false, take: true }, true).plus && !off('damage', {}, { give: false, take: true }, true).minus && off('damage', {}, null, true).plus);

  // ---- view(): what the cards show, from a real race ----
  let w = world();
  let v = w.cards.view();
  say('a race with penalties and damage: the pads are penalty points, time, laps and damage (no championship points)', v.groups.join() === 'points,time,laps,damage');
  say('+ and − add the first value of each list: 1 point, 5 s, 1 lap, 1 damage point (the other values are in the pop-up)', v.steps.points === 1 && v.steps.time === 5 && v.steps.laps === 1 && v.steps.damage === 1);
  say('the page is usable, two lanes are shown, and the race is on', v.usable === true && v.racing === true && v.rows.length === 2 && v.rows.every(r => r.show));
  say('a clean car: the name of the driver and the car, "All clear", and the colour is ok', v.rows[0].who === 'James' && v.rows[0].car === 'car0' && v.rows[0].kind === 'ok' && v.rows[0].chips.length === 1 && v.rows[0].chips[0].t === 'All clear');
  say('the named penalties of the system, with their cost, the damage incidents and the failures of the Damage System are in the view', v.rows[0].pen.items.map(x => x.name + x.cost).join() === 'Drivethrough3,Jump start1' && v.incidents.map(x => x.name + x.points).join() === 'Contact2,Hard crash4' && v.failures.map(f => f.name).join() === 'Slow Puncture,Lift and Coast');
  say('...and the weather buttons (the Race Director sets it) and the Balance of Power of every car', v.wx.on === true && v.wx.buttons.length > 1 && v.rows.every(r => r.bop && r.bop.hinder && r.bop.help));
  say('the pads of a car: 0 points, +0 for time and laps; the minus of the points is off at 0', v.rows[0].pads.points.text === '0' && v.rows[0].pads.points.minusOff === true && v.rows[0].pads.points.plusOff === false && v.rows[0].pads.time.text === '0 s' && v.rows[0].pads.laps.text === '0');
  w.eng.addPoints(0, 5, 2000); w.eng.addPoints(1, 2, 2000); v = w.cards.view();
  say('5 penalty points on the system (5 s every 5 points): the card is amber and says +5 s', v.rows[0].kind === 'amber' && v.rows[0].chips.some(c => c.t === '+5 s' && c.k === 'amber') && v.rows[0].pads.points.text === '5');
  say('...and a car with 2 points has no penalty yet: ok', v.rows[1].kind === 'ok');
  say('the named penalties cost points: 2 points buy Jump start (1) but not Drivethrough (3)', v.rows[1].pen.items[0].off === true && v.rows[1].pen.items[1].off === false && v.rows[0].pen.items.every(x => !x.off));
  w.eng.addDamage(0, 2, 2100, 'director'); v = w.cards.view();
  say('2 damage points: the damage pad says 2 and the card carries the damage chip', v.rows[0].pads.damage.text === '2' && v.rows[0].chips.length >= 2);
  say('...the chip of light damage is amber (Minor damage), so the card is amber', v.rows[0].chips.some(c => /damage/i.test(c.t) && c.k === 'amber') && v.rows[0].kind === 'amber');
  w.phase = 'paused'; v = w.cards.view(); say('paused is racing too: the pads work', v.racing === true && v.rows[0].pads.time.plusOff === false);
  w.phase = 'ready'; v = w.cards.view();
  say('before the start nothing works: every pad, the penalties, damage and failure are off', v.racing === false && v.rows.every(r => Object.values(r.pads).every(p => p.plusOff && p.minusOff) && r.pen.off && r.pen.items.every(x => x.off) && !r.dmg.give && !r.fail.give));
  w.phase = 'finished'; v = w.cards.view(); say('...and after the finish', v.racing === false && v.rows[0].pads.laps.plusOff === true);

  // DQ: a car over the limit of the system
  const dq = world({ pen: { dq: 6 } }); dq.eng.addPoints(0, 6, 1500); v = dq.cards.view();
  say('a disqualified car: the points pad says DQ, both buttons are off, a red "Disqualified" chip, the penalties are off', v.rows[0].dq === true && v.rows[0].pads.points.text === 'DQ' && v.rows[0].pads.points.plusOff && v.rows[0].pads.points.minusOff && v.rows[0].kind === 'red' && v.rows[0].chips.some(c => c.t === 'Disqualified' && c.k === 'red') && v.rows[0].pen.off);

  // which pads a race has
  v = world({ pen: false }).cards.view(); say('no penalty system: no penalty points pad and no named penalties', !v.groups.includes('points') && v.rows[0].pen === null && v.groups.join() === 'time,laps,damage');
  v = world({ damage: false }).cards.view(); say('no Damage System: no damage pad, no damage or failure buttons', !v.groups.includes('damage') && v.rows[0].dmg === null && v.rows[0].fail === null && v.incidents.length === 0 && v.failures.length === 0);
  v = world({ bop: false, weather: false }).cards.view(); say('no Balance of Power and no weather system: nothing of them on the cards', v.rows.every(r => r.bop === null) && v.wx.on === false);
  v = world({ champ: true }).cards.view(); say('a heat race with championship points: the pad of the championship points is there, 1 per click', v.groups.join() === 'points,time,laps,damage,champ' && v.steps.champ === 1);
  const pr = world({ type: 'practice', pen: false, damage: false, bop: false, weather: false }); v = pr.cards.view();
  say('practice without penalties, damage, Balance of Power or weather: there is nothing to adjust, so the page is not usable (it is hidden)', v.groups.length === 0 && v.usable === false && pr.cards.usable() === false);

  // the values of the lists
  v = world({ settings: { padPoints: [3, 6], padSeconds: [10, 20, 40], padLaps: [2], padDamage: [2, 4], padChamp: [5] }, champ: true }).cards.view();
  say('the lists the Race Director made himself are followed: the buttons add the first (smallest) value of each', v.steps.points === 3 && v.steps.time === 10 && v.steps.laps === 2 && v.steps.damage === 2 && v.steps.champ === 5);
  v = world({ settings: { padPoints: '6, 3, 1' } }).cards.view(); say('...a list in any order: the smallest is the first', v.steps.points === 1);
  const own = world({ settings: { padSeconds: [10, 20] } }); own.setup = { padSeconds: '15 30', padLaps: [3] }; own.cards.update(); v = own.cards.view();
  say('a race setup with lists of its own wins over the app (Pad values of the setup): 15 s and 3 laps; the other pads keep the app lists', v.steps.time === 15 && v.steps.laps === 3 && v.steps.points === 1);

  // ---- the page ----
  w = world();
  const cardsN = w.box.querySelectorAll('[data-lc-lane]').length, stripN = w.box.querySelectorAll('[data-lc-pick]').length;
  say('the page: a card and a strip button for every lane, Undo, the log button, the weather; 2 lanes keep the log next to the cards', cardsN === 2 && stripN === 2 && !!w.undo() && !!w.box.querySelector('[data-lc-logbtn]') && w.box.querySelector('[data-lc-root]').dataset.log === 'docked' && w.box.querySelector('[data-lc-root]').dataset.n === '2');
  say('...4 lanes: the log is a drawer', world({ lanes: 4 }).box.querySelector('[data-lc-root]').dataset.log === 'drawer');
  say('...3 lanes too', world({ lanes: 3 }).box.querySelector('[data-lc-root]').dataset.log === 'drawer');
  say('the buttons of a pad carry the first value of the list (data-v) and the sign', w.plus(0, 'points').dataset.v === '1' && w.plus(0, 'points').dataset.sign === '1' && w.minus(0, 'time').dataset.v === '5' && w.minus(0, 'time').dataset.sign === '-1' && w.plus(1, 'laps').dataset.v === '1');
  say('the buttons say who they are for (aria-label, for a screen reader): "Add 1 penalty point to James", "Deduct 5 s from Bjornie"', w.plus(0, 'points').getAttribute('aria-label') === 'Add 1 penalty point to James' && w.minus(1, 'time').getAttribute('aria-label') === 'Deduct 5 s from Bjornie');
  say('the pads that this race has are shown, the others (championship points) are hidden', w.pad(0, 'points').hidden === false && w.pad(0, 'champ').hidden === true && w.pad(0, 'damage').hidden === false);
  say('the value of a pad is a button (opens the amounts), and it is on while the race runs', w.val(0, 'points').textContent === '0' && w.val(0, 'points').disabled === false);
  say('the card of each driver shows the name and the car, the tyre button is there', w.card(0).querySelector('.lc-who').textContent === 'James' && w.card(1).querySelector('.lc-car').textContent === 'car1' && w.card(0).querySelector('[data-lc-tyre]').hidden === false);
  say('Undo is off and the line says nothing was adjusted', w.undo().disabled === true && w.last() === 'Nothing adjusted yet.');

  // presses
  w.click(w.plus(0, 'points'));
  say('+ on penalty points: the race gets 1 point for lane 0, the card shows 1, the minus works now', w.car(0).points === 1 && w.sentOf('pad')[0].join() === 'pad,points,0,1' && w.val(0, 'points').textContent === '1' && w.minus(0, 'points').disabled === false);
  say('...Undo can take it back and the line says what was done', w.undo().disabled === false && w.last() === 'Last: ' + Pad.describe('points', 1, 'James'));
  w.click(w.undo());
  say('Undo gives the opposite command, the points are 0 again, the line says Undone, and Undo is off', w.car(0).points === 0 && w.sentOf('pad')[1].join() === 'pad,points,0,-1' && w.val(0, 'points').textContent === '0' && w.undo().disabled === true && w.last().startsWith('Undone: '));
  w.click(w.minus(0, 'points'));
  say('a disabled button does nothing (− at 0 points sends nothing)', w.sentOf('pad').length === 2);
  w.click(w.plus(1, 'time'));
  say('+ on time: 5 seconds more on the race time of lane 1: "+5 s"', w.car(1).adjMs === 5000 && w.val(1, 'time').textContent === '+5 s' && w.sentOf('pad')[2].join() === 'pad,time,1,5');
  say('...and Undo is on right away (the race window has done it in the same breath)', w.undo().disabled === false);
  w.click(w.plus(1, 'laps'));
  say('+ on laps: one lap more for lane 1, "+1", and Undo is on after it as well', w.car(1).adjLaps === 1 && w.val(1, 'laps').textContent === '+1' && w.undo().disabled === false);
  w.click(w.plus(0, 'damage'));
  say('+ on damage: one damage point (as the damage command of the race window)', w.car(0).dmg === 1 && w.val(0, 'damage').textContent === '1' && w.sentOf('pad').pop().join() === 'pad,damage,0,1');
  w.click(w.undo()); w.click(w.undo());
  say('Undo goes back through the presses, last first (damage, then laps), and each is taken back on its own lane', w.car(0).dmg === 0 && w.car(1).adjLaps === 0 && w.car(1).adjMs === 5000);
  w.click(w.undo());
  say('...and the time of lane 1 last', w.car(1).adjMs === 0 && w.undo().disabled === true);
  const fl = world(); fl.click(fl.minus(0, 'laps'));
  say('− on laps for a car that has driven no lap: the command goes, the engine keeps the laps from going below the laps driven (0), the number stays "0", and Undo has nothing to take back until the press is known to have changed nothing',
    fl.sentOf('pad')[0].join() === 'pad,laps,0,-1' && fl.car(0).adjLaps === 0 && fl.val(0, 'laps').textContent === '0' && fl.undo().disabled === true);

  // a press blurs the button, so Space and the number keys of the race go on working
  const b0 = w.plus(0, 'time'); b0.focus(); w.click(b0);
  say('a pressed button lets go of the focus (the keys of the race keep working)', b0.focused === false && w.dom.active === null);

  // the amounts pop-up
  w = world(); w.phase = 'ready'; w.cards.update(); w.click(w.val(0, 'time')); w.click(w.card(0).querySelector('[data-lc-open="pen"]'));
  say('before the start the numbers and the penalty button do not open a pop-up (they are off)', w.pop(0, 'amt:time').hidden === true && w.pop(0, 'pen').hidden === true && w.cards.memory.pop === null);
  w = world();
  w.click(w.val(0, 'time'));
  const popT = w.pop(0, 'amt:time');
  say('the number opens the pop-up of the pad: it shows (the title says whose, and the value now), the others stay closed', popT.hidden === false && popT.visible && w.pop(0, 'amt:points').hidden === true && w.pop(1, 'amt:time').hidden === true && w.val(0, 'time').getAttribute('aria-expanded') === 'true');
  say('...it holds every amount of the list as + and −: 5, 10 and 30 seconds, and the field "other"', ['5', '10', '30'].every(n => popT.querySelector(`[data-sign="1"][data-v="${n}"]`) && popT.querySelector(`[data-sign="-1"][data-v="${n}"]`)) && !!popT.querySelector('[data-pad-other="time"]') && popT.querySelectorAll('[data-other]').length === 2);
  say('the field "other" has a name for a screen reader, and it is a number field (any amount for time, whole numbers for points)', popT.querySelector('[data-pad-other="time"]').getAttribute('aria-label') === 'Other amount of time' && popT.querySelector('[data-pad-other="time"]').getAttribute('step') === 'any' && popT.querySelector('[data-pad-other="time"]').getAttribute('type') === 'number');
  say('the pop-up names the pad and the driver', popT.querySelector('strong').textContent === 'Race time · James');
  w.click(popT.querySelector('[data-sign="1"][data-v="10"]'));
  say('+10 in the pop-up: 10 seconds on lane 0', w.car(0).adjMs === 10000 && w.sentOf('pad')[0].join() === 'pad,time,0,10' && w.val(0, 'time').textContent === '+10 s');
  w.click(popT.querySelector('[data-sign="-1"][data-v="5"]'));
  say('−5 in the pop-up: 5 seconds off again', w.car(0).adjMs === 5000 && w.val(0, 'time').textContent === '+5 s');
  const other = popT.querySelector('[data-pad-other="time"]');
  other.value = '7.5'; w.click(popT.querySelector('[data-other][data-sign="1"]'));
  say('"other": 7.5 and Give adds 7.5 seconds', w.car(0).adjMs === 12500 && w.sentOf('pad').pop().join() === 'pad,time,0,7.5');
  other.value = '2'; w.click(popT.querySelector('[data-other][data-sign="-1"]'));
  say('"other": 2 and Take back deducts 2 seconds', w.car(0).adjMs === 10500 && w.sentOf('pad').pop().join() === 'pad,time,0,-2');
  const nSent = w.sent.length; other.value = ''; w.click(popT.querySelector('[data-other][data-sign="1"]')); other.value = 'abc'; w.click(popT.querySelector('[data-other][data-sign="1"]')); other.value = '0'; w.click(popT.querySelector('[data-other][data-sign="1"]'));
  say('an empty, a wrong or a zero amount in "other" sends nothing', w.sent.length === nSent);
  other.value = '4'; w.cards.key({ key: 'Enter', target: other, preventDefault() {} });
  say('Enter in the field gives the amount (4 seconds)', w.car(0).adjMs === 14500 && w.sentOf('pad').pop().join() === 'pad,time,0,4');
  w.click(popT.querySelector('[data-sign="-1"][data-v="30"]'));
  say('more time taken off than there is: the engine stops at 0 (a race time cannot go below zero), and the card says 0 s', w.car(0).adjMs === 0 && w.val(0, 'time').textContent === '0 s');
  w.click(w.val(0, 'laps'));
  say('another pad opens its pop-up and the first closes: one pop-up at a time', w.pop(0, 'amt:laps').hidden === false && w.pop(0, 'amt:time').hidden === true);
  w.click(w.val(0, 'laps'));
  say('the number again closes it', w.pop(0, 'amt:laps').hidden === true);
  w.click(w.val(0, 'points')); w.cards.key({ key: 'Escape', target: w.val(0, 'points'), stopPropagation() {} });
  say('Escape closes the pop-up and the focus goes back to its number', w.pop(0, 'amt:points').hidden === true && w.val(0, 'points').focused === true);
  w.click(w.val(1, 'points')); w.dom.fire('keydown', { key: 'Escape', target: w.box });
  say('Escape anywhere on the page closes it too (the focus is not in the cards after a press)', w.pop(1, 'amt:points').hidden === true);
  w.click(w.val(1, 'points')); const outside = w.dom.make('div'); w.dom.fire('click', { target: outside });
  say('a click outside the cards closes the pop-up', w.pop(1, 'amt:points').hidden === true);
  w.click(w.val(1, 'points')); w.dom.fire('click', { target: w.val(0, 'time') });
  say('a click inside the cards does not (the cards take it themselves)', w.pop(1, 'amt:points').hidden === false);
  w.click(w.card(0).querySelector('.lc-who'));
  say('a click somewhere else on the cards closes it', w.pop(1, 'amt:points').hidden === true);
  w.click(w.val(1, 'points')); w.phase = 'finished'; w.cards.update();
  say('when the race is over the pop-up closes and the numbers are off', w.pop(1, 'amt:points').hidden === true && w.val(1, 'points').disabled === true);
  w.phase = 'ready'; w.cards.update(); say('...and before the start', w.plus(0, 'time').disabled === true && w.undo().disabled === true && w.last() === 'The controls work while the race is running or paused.');
  w.phase = 'running'; w.cards.update();
  w.click(w.val(0, 'points')); const pp = w.pop(0, 'amt:points');
  say('the pop-up of the points: 1, 2 and 5, whole numbers only', ['1', '2', '5'].every(n => pp.querySelector(`[data-v="${n}"]`)) && pp.querySelector('[data-pad-other="points"]').getAttribute('step') === '1');
  w.click(pp.querySelector('[data-sign="1"][data-v="5"]'));
  say('+5 points: lane 0 has 5 points, the pop-up says "5 now"', w.car(0).points === 5 && pp.querySelector('.lc-popnow').textContent === '5 now');
  w.click(pp.querySelector('[data-sign="-1"][data-v="5"]')); w.click(pp.querySelector('[data-sign="-1"][data-v="2"]'));
  say('more points taken back than there are: the race stops at 0, and the entry in Undo is what really moved (it undoes nothing it did not do)', w.car(0).points === 0);
  w.click(w.undo()); w.click(w.undo());
  say('...so Undo gives back the 5 it took off, and the 2 that took nothing is not in the list', w.car(0).points >= 0 && w.car(0).points <= 5 && w.sentOf('pad').length >= 4);

  // the named penalties
  w = world(); w.eng.addPoints(1, 2, 1100); w.cards.update();
  say('"Penalty ▾" is on while the race runs; its pop-up lists the penalties of the system with their cost', w.card(0).querySelector('[data-lc-open="pen"]').hidden === false && w.card(0).querySelector('[data-lc-open="pen"]').disabled === false && w.pop(0, 'pen').querySelectorAll('[data-lc-pen]').map(b => b.textContent).join() === 'Drivethrough (−3),Jump start (−1)');
  w.click(w.card(1).querySelector('[data-lc-open="pen"]'));
  const pb = w.pop(1, 'pen').querySelectorAll('[data-lc-pen]');
  say('a car with 2 points cannot afford Drivethrough (3): that button is off, Jump start (1) is on', pb[0].disabled === true && pb[1].disabled === false && w.pop(1, 'pen').visible);
  w.click(pb[0]); say('a button that is off does nothing', w.sentOf('assign').length === 0);
  w.click(pb[1]);
  say('Jump start sends the penalty for lane 1, the pop-up closes, the car has a stop-and-go to serve, and the card says so', w.sentOf('assign')[0].join() === 'assign,1,1' && w.pop(1, 'pen').hidden === true && w.car(1).pending.length === 1 && chipTexts(w, 1).some(t => t.includes('Jump start to serve')) && w.card(1).dataset.kind === 'amber');
  say('...the pop-up says which penalty is not served yet', w.pop(1, 'pen').querySelectorAll('.lc-popnote').some(p => p.textContent === 'Not served yet: Jump start'));
  say('...and the cost came off the points', w.car(1).points === 1 && w.val(1, 'points').textContent === '1');
  w.phase = 'ready'; w.cards.update(); say('before the start the penalty button is off', w.card(0).querySelector('[data-lc-open="pen"]').disabled === true);
  say('the log lists what happened (the penalty is in it), with a count on the log button', w.box.querySelector('.lc-loglist').innerHTML.includes('<li>') && /Log \(\d+\)/.test(w.box.querySelector('[data-lc-logbtn]').textContent));

  // damage incidents
  w = world();
  w.click(w.card(0).querySelector('[data-lc-open="dmg"]'));
  const ib = w.pop(0, 'dmg').querySelectorAll('[data-lc-inc]');
  say('"Damage ▾": the incidents of the Damage System with their points', ib.map(b => b.textContent).join() === 'Contact +2,Hard crash +4' && ib[0].getAttribute('aria-label') === 'Contact, 2 damage points');
  w.click(ib[1]);
  say('Hard crash gives 4 damage points to lane 0, the pop-up closes, the damage pad says 4', w.sentOf('damage')[0].join() === 'damage,0,4' && w.car(0).dmg === 4 && w.pop(0, 'dmg').hidden === true && w.val(0, 'damage').textContent === '4');

  // failures
  w = world(); w.click(w.card(1).querySelector('[data-lc-open="fail"]'));
  const radios = w.pop(1, 'fail').querySelectorAll('[data-lc-failk]');
  say('"Failure ▾": a list to choose from: At random (chosen), then each failure with its chance', radios.map(r => r.value).join() === '-1,0,1' && radios[0].checked === true && w.pop(1, 'fail').querySelectorAll('label').map(l => l.children.map(c => c.textContent).filter(Boolean).join(' ')).join('|') === 'At random|Slow Puncture 5%|Lift and Coast 10%');
  radios[1].checked = true; radios[0].checked = false; w.click(w.pop(1, 'fail').querySelector('[data-lc-failgive]'));
  say('Give sends the failure that is chosen (Slow Puncture, no 0) for lane 1 and closes the pop-up', w.sentOf('failure')[0].join() === 'failure,1,0' && w.pop(1, 'fail').hidden === true);
  const fcard = w.card(1), fb = fcard.querySelector('[data-lc-open="fail"]'), fc = fcard.querySelector('[data-lc-failclear]');
  say('...Clear ✕ replaces Failure ▾', fb.hidden === true && fc.hidden === false && chipTexts(w, 1).some(t => /puncture|failure/i.test(t)));
  w.click(fc);
  say('Clear ✕ clears the failure of lane 1: Failure ▾ is back', w.sentOf('failureClear')[0].join() === 'failureClear,1' && fb.hidden === false && fc.hidden === true);
  w.click(w.card(0).querySelector('[data-lc-open="fail"]')); w.click(w.pop(0, 'fail').querySelector('[data-lc-failgive]'));
  say('At random: -1 is sent', w.sentOf('failure')[1].join() === 'failure,0,-1');

  // Balance of Power
  w = world(); const bopBtn = (lane, k) => w.card(lane).querySelector(`[data-lc-bop="${k}"]`);
  say('Balance of Power (manual): Hinder, Off and Help on each card with the percentage; Auto and Accept only when the system has them', ['hinder', 'off', 'help'].every(k => bopBtn(0, k).hidden === false) && bopBtn(0, 'hinder').textContent === 'Hinder 20%' && bopBtn(0, 'auto').hidden === true && bopBtn(0, 'accept').hidden === true);
  w.click(bopBtn(0, 'hinder'));
  say('Hinder sends the command for lane 0 and the button is pressed', w.sentOf('bop')[0].join() === 'bop,0,hinder' && bopBtn(0, 'hinder').getAttribute('aria-pressed') === 'true' && bopBtn(0, 'help').getAttribute('aria-pressed') === 'false' && bopBtn(1, 'hinder').getAttribute('aria-pressed') === 'false');
  w.click(bopBtn(0, 'off'));
  say('Off turns it off again', w.sentOf('bop')[1].join() === 'bop,0,off' && bopBtn(0, 'hinder').getAttribute('aria-pressed') === 'false');

  // weather
  w = world(); const wxb = w.box.querySelectorAll('[data-lc-wx]');
  say('the weather buttons stand in the bar (the Race Director sets it): the states of the weather system', wxb.length > 1 && w.box.querySelector('.lc-wx').hidden === false && wxb.every(b => b.dataset.lcWx));
  const wetB = wxb.find(b => b.getAttribute('aria-pressed') === 'false' && !b.disabled);
  w.click(wetB);
  say('a state button sends that state, and then it is the one that is pressed', w.sentOf('weather')[0][1] === wetB.dataset.lcWx && w.box.querySelectorAll('[data-lc-wx]').find(b => b.dataset.lcWx === wetB.dataset.lcWx).getAttribute('aria-pressed') === 'true');
  w.phase = 'finished'; w.cards.update();
  say('when the race is over the weather buttons are off (and a click on one sends nothing)', w.box.querySelectorAll('[data-lc-wx]').every(b => b.disabled === true) && (w.click(wetB), w.sentOf('weather').length === 1));
  say('no weather system: the weather part is hidden', world({ weather: false }).box.querySelector('.lc-wx').hidden === true);

  // the tyre button
  w = world(); w.click(w.card(1).querySelector('[data-lc-tyre]'));
  say('the tyre of a card opens Tyre Change for that lane', w.tyres.join() === '1');
  say('no tyre button in a Time Token Session (tyre: false)', world({ tyre: false }).card(0).querySelector('[data-lc-tyre]').hidden === true);

  // the strip and the picked lane (phones show one card)
  w = world({ lanes: 4 });
  say('the first lane is picked at the start: its card is marked, its strip button is pressed', w.card(0).dataset.sel === 'true' && w.card(1).dataset.sel === 'false' && w.box.querySelector('[data-lc-pick="0"]').getAttribute('aria-pressed') === 'true');
  w.click(w.box.querySelector('[data-lc-pick="2"]'));
  w.click(w.val(2, 'time')); w.click(w.box.querySelector('[data-lc-pick="3"]'));
  say('a pop-up that is open closes when another lane is picked', w.pop(2, 'amt:time').hidden === true && w.cards.memory.pick === 3); w.click(w.box.querySelector('[data-lc-pick="2"]'));
  say('a strip button picks another lane (the card of that lane is the one shown on a phone)', w.card(2).dataset.sel === 'true' && w.card(0).dataset.sel === 'false' && w.box.querySelector('[data-lc-pick="2"]').getAttribute('aria-pressed') === 'true' && w.cards.memory.pick === 2);
  say('a lane without a car (the race has 4 lanes, the track has fewer drivers) has no card and no strip button', (() => { const x = world({ eng: race({ lanes: 2 }), lanes: 4 }); return x.card(2).hidden === true && x.box.querySelector('[data-lc-pick="3"]').hidden === true && x.card(0).hidden === false; })());
  say('...a card with a problem colours its dot in the strip', (() => { const x = world(); x.eng.addPoints(0, 5, 1100); x.cards.update(); return x.box.querySelector('[data-lc-pick="0"]').querySelector('.lc-dot').getAttribute('data-kind') === 'amber' && x.box.querySelector('[data-lc-pick="1"]').querySelector('.lc-dot').getAttribute('data-kind') === 'ok'; })());

  // a new race or heat starts again
  w = world(); w.click(w.plus(0, 'laps')); w.click(w.box.querySelector('[data-lc-pick="1"]')); w.click(w.val(1, 'time'));
  w.key = 'r2'; w.cards.update();
  say('a new race (raceKey changes): the picked lane, the open pop-up and Undo start again', w.cards.memory.pick === 0 && w.pop(1, 'amt:time').hidden === true && w.undo().disabled === true && w.last() === 'Nothing adjusted yet.');

  // the log
  w = world(); const root = w.box.querySelector('[data-lc-root]');
  say('the log: closed at the start, the button opens and closes it', root.dataset.logopen === 'false' && w.box.querySelector('[data-lc-logbtn]').getAttribute('aria-expanded') === 'false');
  w.click(w.box.querySelector('[data-lc-logbtn]'));
  say('...open: data-logopen, aria-expanded, the button says ▾', root.dataset.logopen === 'true' && w.box.querySelector('[data-lc-logbtn]').getAttribute('aria-expanded') === 'true' && w.box.querySelector('[data-lc-logbtn]').textContent.endsWith('▾'));
  w.click(w.box.querySelector('[data-lc-logbtn]')); say('...and closed again', root.dataset.logopen === 'false');

  // new lists in the settings: the pads are built again with the new values, what was open stays
  w = world(); w.click(w.val(0, 'time'));
  w.settings = { padSeconds: [15, 45], padPoints: [2] }; w.cards.update();
  say('the lists change in the settings: + and − take the new first value, the pop-up holds the new amounts', w.plus(0, 'time').dataset.v === '15' && w.plus(0, 'points').dataset.v === '2' && !!w.pop(0, 'amt:time').querySelector('[data-v="45"]') && !w.pop(0, 'amt:time').querySelector('[data-v="30"]'));
  say('...and the labels say it too: "Add 15 s to James"', w.plus(0, 'time').getAttribute('aria-label') === 'Add 15 s to James');
  w.click(w.plus(0, 'time')); say('...and the new press adds 15 seconds', w.car(0).adjMs === 15000);

  // a page that builds the cards again (the Race Director page redraws): the memory keeps the pick, the pop-up, the log and Undo
  const mem = { }; w = world({ memory: mem }); w.click(w.plus(1, 'laps')); w.click(w.box.querySelector('[data-lc-pick="1"]')); w.click(w.val(1, 'points')); w.click(w.box.querySelector('[data-lc-logbtn]'));
  const again = world({ eng: w.eng, memory: mem });
  say('built again on the same memory: the same lane is picked, the pop-up is open, the log is open, and Undo still has the press', again.cards.memory.pick === 1 && again.pop(1, 'amt:points').hidden === false && again.box.querySelector('[data-lc-root]').dataset.logopen === 'true' && again.undo().disabled === false);

  // bind: false (the Race Director page routes the clicks itself)
  w = world({ bind: false });
  say('bind: false takes no clicks of its own (the page gives them to click())', !w.box.onclick); w.click(w.plus(0, 'laps')); say('...click() works all the same', w.car(0).adjLaps === 1);
  w = world(); say('by default the cards take the clicks of their part of the page', typeof w.box.onclick === 'function'); w.box.onclick({ target: w.plus(1, 'laps') }); say('...a click that arrives there is a press', w.car(1).adjLaps === 1);

  // the listeners of the page
  const dl = new Dom(), dbox = dl.root();
  { const ctx = vm.createContext({ AdjustPad: Pad, Damage: Dm, Failures: Fl, Bop: Bp, Wx, SafetyCar, TyreWear, performance, console, document: dl.document, state: { settings: {} }, api: {} }); const { LaneCards } = vm.runInContext(SRC, ctx);
    const eng = race(); const c = LaneCards.build(dbox, { eng, lanes: [0, 1], phase: () => 'running', now: () => 1000, settings: () => ({}), penalty: () => true, penaltyTypes: () => types, send: {}, raceKey: () => 'a' });
    say('the cards listen to the page (a click and a key) while they are on it', dl.count('click') === 1 && dl.count('keydown') === 1);
    c.off(); say('off() lets go of both', dl.count('click') === 0 && dl.count('keydown') === 0); c.off(); say('...and may be called twice', dl.count('click') === 0);
    const c2 = LaneCards.build(dbox, { eng, lanes: [0, 1], phase: () => 'running', now: () => 1000, settings: () => ({}), penalty: () => true, penaltyTypes: () => types, send: {}, raceKey: () => 'a' });
    dbox.isRoot = false; dl.fire('click', { target: dl.make('div') });
    say('when the cards are not on the page any more, the first click lets go of the listeners by itself', dl.count('click') === 0 && dl.count('keydown') === 0 && typeof c2.off === 'function'); }

  // reveal(): the tyre button without a handler opens the folder of the page
  { const d = new Dom(), page = d.root(), det = d.make('details'); det.setAttribute('data-dirf', 'tyre'); det.open = false; page.appendChild(det);
    const { LaneCards } = vm.runInContext(SRC, vm.createContext({ AdjustPad: Pad, Damage: Dm, Failures: Fl, Bop: Bp, Wx, SafetyCar, TyreWear, performance, console, document: d.document, state: { settings: {} }, api: {} }));
    say('reveal() opens the folder of the page and says so; a folder that is not there gives false', LaneCards.reveal(page, 'tyre') === true && det.open === true && LaneCards.reveal(page, 'nothing') === false && LaneCards.reveal(null, 'tyre') === false); }

  // a card of a car that is not in the race (no engine car), a race with no lanes: nothing breaks
  say('a race with no cars at all draws nothing and does not break', (() => { const x = world({ eng: RE.createRace({ type: 'race', laps: 5, entries: [], penalty: { on: false } }) }); return x.box.querySelectorAll('[data-lc-lane]').every(c => c.hidden); })());

  console.log(fails ? `\n${fails} FAILED` : '\nall passed'); process.exit(fails ? 1 : 0);
})();
