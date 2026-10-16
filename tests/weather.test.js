// 1.4.0: Weather. The pure part (weather.js): settings, the forecast, the tyres, the hindrance table, the words, what the Race Director's controls show;
// and what the engine does with it: the four states, the tyre change in a pit stop, the penalty points, the hindrance (on top of Balance of Power), the race log.
const W = require('../renderer/weather.js'), E = require('../renderer/engine.js'), B = require('../renderer/bop.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const near = (a, b, d = 1e-6) => Math.abs(a - b) < d;

// ---- the tyres ----
ok('six tyres with the colours of Formula 1: hard white, medium yellow, soft red, supersoft purple, intermediate green, wet blue', same(W.TYRES.map(t => t.code), ['H', 'M', 'S', 'SS', 'INT', 'W']) && same(W.TYRES.map(t => t.name), ['Hard', 'Medium', 'Soft', 'Supersoft', 'Intermediate', 'Wet'])
  && same(W.TYRES.map(t => t.color), ['#f4f4f4', '#ffd12e', '#e8002d', '#9b4dff', '#43b02a', '#0067ff']));
ok('...four dry compounds, one intermediate, one wet', same(W.TYRES.map(t => t.cls), ['dry', 'dry', 'dry', 'dry', 'inter', 'wet']) && same(W.CLASSES, ['dry', 'inter', 'wet']));
ok('a tyre is found by its code, in any case; nothing or nonsense is a Medium', W.tyreOf('ss').name === 'Supersoft' && W.tyreOf('x') === null && W.cleanTyre('s') === 'S' && W.cleanTyre('') === 'M' && W.cleanTyre(undefined) === 'M' && W.cleanTyre('dance') === 'M' && W.cleanTyre('INT') === 'INT');
ok('the class and the name of a tyre (an unknown tyre counts as a Medium)', W.classOf('H') === 'dry' && W.classOf('INT') === 'inter' && W.classOf('W') === 'wet' && W.classOf('x') === 'dry' && W.tyreName('W') === 'Wet' && W.tyreName('x') === 'Medium');
ok('the four weather states, in order, with names', same(W.STATES, [['dry', 'Dry'], ['cloudy', 'Cloudy'], ['wet', 'Wet'], ['clearing', 'Clearing']]) && W.stateName('clearing') === 'Clearing' && W.stateName('x') === 'Dry');

// ---- the settings ----
{ const D = W.clean({});
  ok('the standard settings: laps, rain at lap 8 for 6 laps, 2 laps of clouds before and 2 of clearing after, 2 laps to react, 2 points each, wet tyres when pitting in Cloudy, own tyres in Clearing', D.unit === 'laps' && D.start.mode === 'point' && D.start.at === 8 && D.rain.mode === 'fixed' && D.rain.for === 6 && D.cloudy === 2 && D.clearing === 2
    && D.react === 2 && D.wetPoints === 2 && D.dryPoints === 2 && D.repeat === 'once' && D.cloudyTyre === 'wet' && D.clearingTyre === 'dry' && D.same === true);
  ok('...it hinders (fuel use and refuelling on, tank off) with the table: dry 0/10/20, cloudy 0/5/10, wet 25/10/0, clearing 10/0/10 (on dry / intermediate / wet tyres)', D.hinder === true && same(D.levers, { use: true, rate: true, tank: false })
    && same(D.table, { dry: { dry: 0, inter: 10, wet: 20 }, cloudy: { dry: 0, inter: 5, wet: 10 }, wet: { dry: 25, inter: 10, wet: 0 }, clearing: { dry: 10, inter: 0, wet: 10 } }));
  ok('nothing, or not an object, gives the standard settings', same(W.clean(), D) && same(W.clean(null), D) && same(W.clean(undefined, 0), D));
  ok('the seed is a whole number', W.clean({}, 12.7).seed === 12 && W.clean({}, 'x').seed === 0 && W.clean({}, -3).seed === -3);
  const t = W.clean({ unit: 'time', startAt: '2,5', rainFor: 1.5, cloudyFor: 0.5, clearingFor: '1' });
  ok('in time everything is minutes, kept to a whole second (2,5 is 2.5; with a decimal comma)', t.unit === 'time' && t.start.at === 2.5 && t.rain.for === 1.5 && t.cloudy === 0.5 && t.clearing === 1 && W.clean({ unit: 'time', startAt: 1.001 }).start.at === 1);
  ok('in laps everything is whole laps (2.6 laps is 3; the rain lasts at least 1 lap, in time at least 0.1 minute)', W.clean({ startAt: 2.6 }).start.at === 3 && W.clean({ rainFor: 0 }).rain.for === 1 && W.clean({ unit: 'time', rainFor: 0 }).rain.for === 0.1 && W.clean({ cloudyFor: 0 }).cloudy === 0 && W.clean({ clearingFor: -4 }).clearing === 0);
  ok('a range with the ends the wrong way round is turned round (rain from lap 12 to 5 is 5 to 12), for the start and for the length', W.clean({ startFrom: 12, startTo: 5 }).start.from === 5 && W.clean({ startFrom: 12, startTo: 5 }).start.to === 12 && W.clean({ rainMin: 9, rainMax: 3 }).rain.min === 3 && W.clean({ rainMin: 9, rainMax: 3 }).rain.max === 9);
  ok('something that is not one of the choices becomes the standard choice', W.clean({ unit: 'x', startMode: 'x', rainMode: 5, cloudyTyre: 'x', clearingTyre: {}, repeat: null, sameInHeats: 'x' }).unit === 'laps' && W.clean({ startMode: 'x' }).start.mode === 'point' && W.clean({ rainMode: 5 }).rain.mode === 'fixed' && W.clean({ cloudyTyre: 'x' }).cloudyTyre === 'wet' && W.clean({ clearingTyre: {} }).clearingTyre === 'dry' && W.clean({ repeat: null }).repeat === 'once');
  ok('the choices that are there are kept', W.clean({ startMode: 'random' }).start.mode === 'random' && W.clean({ startMode: 'director' }).start.mode === 'director' && W.clean({ rainMode: 'random' }).rain.mode === 'random' && W.clean({ cloudyTyre: 'inter' }).cloudyTyre === 'inter' && W.clean({ clearingTyre: 'inter' }).clearingTyre === 'inter' && W.clean({ repeat: 'every' }).repeat === 'every' && W.clean({ sameInHeats: 'new' }).same === false);
  ok('the reaction time is 0 to 20 laps and the points 0 to 100, whole numbers', W.clean({ react: 50 }).react === 20 && W.clean({ react: -1 }).react === 0 && W.clean({ react: 1.6 }).react === 2 && W.clean({ wetPoints: 500 }).wetPoints === 100 && W.clean({ dryPoints: -2 }).dryPoints === 0 && W.clean({ wetPoints: 'x' }).wetPoints === 2);
  ok('hindering can be switched off, and so can each lever; the tank only when it is switched on', W.clean({ hinder: 'off' }).hinder === false && W.clean({ hUse: 'off' }).levers.use === false && W.clean({ hRate: 'off' }).levers.rate === false && W.clean({ hTank: 'on' }).levers.tank === true && W.clean({ hTank: 'x' }).levers.tank === false);
  ok('every number of the table is a whole percentage from 0 to 90', W.clean({ wetOnDry: 95 }).table.wet.dry === 90 && W.clean({ wetOnDry: -5 }).table.wet.dry === 0 && W.clean({ wetOnDry: 12.6 }).table.wet.dry === 13 && W.clean({ cloudyOnWet: '7,4' }).table.cloudy.wet === 7 && W.clean({ clearingOnInter: 'x' }).table.clearing.inter === 0 && Object.keys(W.HKEYS).length === 12); }

// ---- the forecast ----
{ const P = (rec, seed = 1) => W.plan(W.clean(rec, seed), seed), st = p => p.stages.map(s => s.state + '@' + s.at).join(' ');
  ok('rain at lap 8: Cloudy two laps before, Wet at 8, Clearing after the 6 laps of rain, Dry two laps later', st(P({})) === 'cloudy@6 wet@8 clearing@14 dry@16');
  ok('...with no warning there is no Cloudy, with no clearing no Clearing', st(P({ cloudyFor: 0 })) === 'wet@8 clearing@14 dry@16' && st(P({ clearingFor: 0 })) === 'cloudy@6 wet@8 dry@14' && st(P({ cloudyFor: 0, clearingFor: 0 })) === 'wet@8 dry@14');
  ok('...a warning longer than the time before the rain starts at the start (rain at lap 1 with 5 laps of clouds: clouds from 0), rain at 0 has no clouds', st(P({ startAt: 1, cloudyFor: 5 })) === 'cloudy@0 wet@1 clearing@7 dry@9' && st(P({ startAt: 0, cloudyFor: 5 })) === 'wet@0 clearing@6 dry@8');
  ok('in time the stages are in milliseconds (rain at 2.5 minutes for 1.5, clouds 0.5 before and 1 clearing)', st(P({ unit: 'time', startAt: 2.5, rainFor: 1.5, cloudyFor: 0.5, clearingFor: 1 })) === 'cloudy@120000 wet@150000 clearing@240000 dry@300000');
  ok('the Race Director deciding means no stages at all, and it says so', same(P({ startMode: 'director' }), { unit: 'laps', director: true, stages: [] }) && W.plan(null) === null && W.plan(undefined) === null);
  const R = seed => P({ startMode: 'random', startFrom: 5, startTo: 12, rainMode: 'random', rainMin: 3, rainMax: 8, cloudyFor: 1, clearingFor: 1 }, seed);
  const many = Array.from({ length: 300 }, (_, i) => R(i)), wets = many.map(p => p.stages.find(s => s.state === 'wet').at), lens = many.map(p => p.stages.find(s => s.state === 'clearing').at - p.stages.find(s => s.state === 'wet').at);
  ok('random: the same seed gives the same forecast, another seed (mostly) another', same(R(7), R(7)) && same(R(8), R(8)) && many.some(p => !same(p, R(7))));
  ok('...rain starts at a whole lap from 5 to 12 and every one of those happens; it lasts from 3 to 8 laps and every one of those happens', wets.every(n => Number.isInteger(n) && n >= 5 && n <= 12) && lens.every(n => Number.isInteger(n) && n >= 3 && n <= 8)
    && [5, 6, 7, 8, 9, 10, 11, 12].every(n => wets.includes(n)) && [3, 4, 5, 6, 7, 8].every(n => lens.includes(n)));
  const T = seed => P({ unit: 'time', startMode: 'random', startFrom: 2, startTo: 4, rainMode: 'random', rainMin: 1, rainMax: 2, cloudyFor: 0, clearingFor: 0 }, seed), tm = Array.from({ length: 200 }, (_, i) => T(i)), tw = tm.map(p => p.stages[0].at);
  ok('random in time: a whole second between 2 and 4 minutes, rain for 1 to 2 minutes', tw.every(n => n % 1000 === 0 && n >= 120000 && n <= 240000) && tw.some(n => n > 150000) && tw.some(n => n < 210000) && tm.every(p => p.stages[1].at - p.stages[0].at >= 60000 && p.stages[1].at - p.stages[0].at <= 120000));
  ok('a rain with the plan made from the settings alone uses the seed of the settings', same(W.plan(W.clean({ startMode: 'random' }, 9)), W.plan(W.clean({ startMode: 'random' }, 9), 9)) && !same(W.plan(W.clean({ startMode: 'random' }, 9)), W.plan(W.clean({ startMode: 'random' }, 10))));
  const p = P({});
  ok('what is left until the next state, in laps and in time', same(W.nextStage(p, 0, 3, 0), { state: 'cloudy', left: 3 }) && same(W.nextStage(p, 1, 7, 0), { state: 'wet', left: 1 }) && W.nextStage(p, 4, 20, 0) === null && W.nextStage(p, 0, 9, 0).left === 0
    && same(W.nextStage(P({ unit: 'time', startAt: 2, cloudyFor: 0 }), 0, 0, 30000), { state: 'wet', left: 90000 }) && W.nextStage(P({ startMode: 'director' }), 0, 1, 1) === null && W.nextStage(null, 0, 1, 1) === null);
  ok('...in words: 3 laps, 1 lap, 2 minutes 10 seconds, 1 minute, 30 seconds, 1 second', W.span('laps', 3) === '3 laps' && W.span('laps', 1) === '1 lap' && W.span('laps', 0) === '0 laps' && W.span('time', 130000) === '2 minutes 10 seconds' && W.span('time', 60000) === '1 minute' && W.span('time', 30000) === '30 seconds' && W.span('time', 1000) === '1 second' && W.span('time', 0) === '0 seconds' && W.span('laps', NaN) === '');
  ok('the start of a state is found in the plan', W.stageOf(p, 'wet').at === 8 && W.stageOf(p, 'dry').at === 16 && W.stageOf(p, 'x') === null && W.stageOf(null, 'wet') === null); }

// ---- the tyres a car gets, and when it has to change ----
{ const C = W.clean({}), I = W.clean({ cloudyTyre: 'inter', clearingTyre: 'inter' });
  ok('a pit stop in the dry, or in Clearing, gives the car its own tyres; in Cloudy and Wet it gives Wet', ['dry', 'clearing'].every(s => W.tyreFor(C, s, 'S') === 'S') && ['cloudy', 'wet'].every(s => W.tyreFor(C, s, 'S') === 'W'));
  ok('...with Intermediate switched on for Cloudy and Clearing those two give Intermediate, Wet still gives Wet and the dry its own', W.tyreFor(I, 'cloudy', 'S') === 'INT' && W.tyreFor(I, 'clearing', 'S') === 'INT' && W.tyreFor(I, 'wet', 'S') === 'W' && W.tyreFor(I, 'dry', 'S') === 'S');
  ok('...the two choices are separate', W.tyreFor(W.clean({ cloudyTyre: 'inter' }), 'clearing', 'H') === 'H' && W.tyreFor(W.clean({ clearingTyre: 'inter' }), 'cloudy', 'H') === 'W');
  ok('...a car with no tyre choice has a Medium, and with no weather system a stop gives the own tyres', W.tyreFor(C, 'dry', undefined) === 'M' && W.tyreFor(C, 'clearing', 'x') === 'M' && W.tyreFor(null, 'wet', 'S') === 'S' && W.tyreFor(null, 'wet', undefined) === 'M');
  ok('in the rain a car on a dry compound has to change (to Wet); a car on Intermediate or Wet does not', W.need('wet', 'S', 'S') === 'wet' && W.need('wet', 'H', 'H') === 'wet' && W.need('wet', 'INT', 'S') === '' && W.need('wet', 'W', 'S') === '');
  ok('when it is dry again a car that is not on its own tyres has to change back; a car on its own tyres does not', W.need('dry', 'W', 'S') === 'dry' && W.need('dry', 'INT', 'S') === 'dry' && W.need('dry', 'S', 'S') === '' && W.need('dry', 'M', 'H') === 'dry' && W.need('dry', 'W', 'W') === '');
  ok('in Cloudy and Clearing nothing has to be changed (that is the time to choose)', ['S', 'W', 'INT'].every(t => W.need('cloudy', t, 'S') === '' && W.need('clearing', t, 'S') === ''));
  ok('a missing own tyre is a Medium', W.need('dry', 'M', undefined) === '' && W.need('dry', 'S', undefined) === 'dry'); }

// ---- the hindrance table ----
{ const C = W.clean({});
  ok('how much a car on a kind of tyre is hindered in a state, from the table', W.hinderOf(C, 'wet', 'S') === 25 && W.hinderOf(C, 'wet', 'INT') === 10 && W.hinderOf(C, 'wet', 'W') === 0 && W.hinderOf(C, 'dry', 'W') === 20 && W.hinderOf(C, 'dry', 'INT') === 10 && W.hinderOf(C, 'dry', 'M') === 0
    && W.hinderOf(C, 'cloudy', 'W') === 10 && W.hinderOf(C, 'cloudy', 'INT') === 5 && W.hinderOf(C, 'cloudy', 'H') === 0 && W.hinderOf(C, 'clearing', 'S') === 10 && W.hinderOf(C, 'clearing', 'INT') === 0 && W.hinderOf(C, 'clearing', 'W') === 10);
  ok('...nothing when the system does not hinder, for a state that is not one, or with no system', W.hinderOf(W.clean({ hinder: 'off' }), 'wet', 'S') === 0 && W.hinderOf(C, 'weird', 'S') === 0 && W.hinderOf(null, 'wet', 'S') === 0 && W.hinderOf(undefined, 'wet', 'S') === 0);
  ok('...the table can be changed, 0 switches one off', W.hinderOf(W.clean({ wetOnDry: 40 }), 'wet', 'S') === 40 && W.hinderOf(W.clean({ wetOnDry: 0 }), 'wet', 'S') === 0); }

// ---- the words ----
{ const ev = [{ type: 'weather', car: -1, state: 'cloudy', was: 'dry', lap: 7, at: 70000 }, { type: 'weather', car: -1, state: 'wet', was: 'cloudy', lap: 9, at: 90000 }, { type: 'weather', car: -1, state: 'clearing', was: 'wet', lap: 15, at: 150000 }, { type: 'weather', car: -1, state: 'dry', was: 'clearing', lap: 17, at: 170000 }];
  ok('what the weather did, in words, by laps', W.forecastNote(ev, 'laps') === 'Cloudy from lap 8, rain from lap 10, clearing from lap 16, dry from lap 18');
  ok('...and by time (minutes and seconds from the start)', W.forecastNote(ev, 'time') === 'Cloudy from 1:10, rain from 1:30, clearing from 2:30, dry from 2:50');
  ok('...nothing when nothing happened; only the weather events count; a Dry that is the start is left out', W.forecastNote([], 'laps') === '' && W.forecastNote(undefined, 'laps') === '' && W.forecastNote([{ type: 'pitstart', car: 0 }, { type: 'weather', state: 'dry' }], 'laps') === '' && W.forecastNote([{ type: 'weather', state: 'wet', was: 'dry', lap: 0 }], 'laps') === 'Rain from lap 1');
  const tv = [{ type: 'tyres', car: 0, tyre: 'W', lap: 9 }, { type: 'tyredue', car: 0, points: 2, lap: 11 }, { type: 'tyres', car: 1, tyre: 'W', lap: 10 }, { type: 'tyres', car: 0, tyre: 'S', lap: 18 }, { type: 'tyredue', car: 1, points: 0, lap: 12 }, { type: 'tyredue', car: 1, points: 1, lap: 13 }];
  ok('what the tyres did to a car, in words: the tyres it got and the penalty points, in the order they happened', W.noteOf(tv, 0) === 'Wet tyres after lap 9, 2 penalty points for the tyres after lap 11, Soft tyres after lap 18' && W.noteOf(tv, 1) === 'Wet tyres after lap 10, 1 penalty point for the tyres after lap 13');
  ok('...nothing for a car that had nothing (a due without points is not a penalty)', W.noteOf(tv, 2) === '' && W.noteOf([{ type: 'tyredue', car: 3, points: 0 }], 3) === '' && W.noteOf(undefined, 0) === '' && W.noteOf([null], 0) === ''); }

// ---- the engine ----
const fuel = (x = {}) => ({ on: true, tank: 100, perLap: 2, rate: 10, target: 0, extra: 0, saving: 0, empty: 'retire', pitHold: 2000, ...x });
const TYRES = ['S', 'M', 'H', 'W'];
const entries = n => Array.from({ length: n }, (_, i) => ({ lane: i, driverId: 'd' + i, carId: 'c' + i, driverName: 'D' + i, carName: 'car' + i, tyre: TYRES[i] }));
const pen = { on: true, mode: 'every', every: 5, seconds: 5, steps: [], dq: 0, types: [], fuelPoints: 0 };
const race = (rec, o = {}) => { const r = E.createRace({ type: o.type || 'race', laps: 60, duration: 30, endRule: 'all', entries: entries(o.cars || 2), fuel: o.noFuel ? undefined : fuel(o.fuel), penalty: o.noPenalty ? undefined : pen,
  weather: rec === null ? undefined : W.clean(rec, o.seed || 1), bop: o.bop, ...(o.cfg || {}) }); r.start(0); return r; };
const clocks = new WeakMap(), clock = r => { if (!clocks.has(r)) { const t = r.cars.map(() => 0); clocks.set(r, (i, ms) => { t[i] += ms; return r.cross(i, t[i]); }); } return clocks.get(r); };
const drive = (r, laps, ms = 10000) => { const go = clock(r); for (let n = 0; n < laps; n++) r.cars.forEach((_, i) => go(i, ms)); };

const REC = { startAt: 3, rainFor: 3, cloudyFor: 1, clearingFor: 2 }; // cloudy@2 wet@3 clearing@6 dry@8
const at = (r, i, t) => r.cross(i, t), pit = (r, i, tb, held = 2500) => { r.block(i, tb); r.tick(tb + held); }; // (a car blocked for 2.5 s is in a pit stop: the stop starts after 2 s)
const evs = (r, ...types) => r.events.filter(e => types.includes(e.type));

// no weather
{ const r = race(null);
  ok('without a weather system nothing is there: no settings, no state changes, the tyres stay what the Slotcars have', r.weather === null && r.wxPlan === null && r.wxSet('wet', 0) === false && r.wxState === 'dry' && r.cars[0].tyre === 'S' && r.cars[1].tyre === 'M' && r.cars.every(c => c.wx === 0 && c.wxDue === null));
  drive(r, 5); pit(r, 0, 60000);
  ok('...a pit stop changes no tyres and nothing is logged; the note is empty', r.cars[0].tyre === 'S' && evs(r, 'weather', 'tyres', 'tyredue').length === 0 && r.weatherNote() === '' && r.tyreNoteOf(0) === '' && same(r.wxOf(0), { tyre: 'S', own: 'S', need: '', hinder: 0 }) && r.wxOf(9) === null);
  ok('a car has its own tyre: the compound of the Slotcar, a Medium when it has none or something else', (() => { const q = E.createRace({ type: 'race', laps: 5, entries: [{ lane: 0, tyre: 'SS' }, { lane: 1 }, { lane: 2, tyre: 'x' }, { lane: 3, tyre: 'int' }] }); return same(q.cars.map(c => [c.tyreOwn, c.tyre]), [['SS', 'SS'], ['M', 'M'], ['M', 'M'], ['INT', 'INT']]); })());
  ok('the weather is for a race and a timed race, not for practice or qualifying', ['practice', 'qualifying'].every(type => E.createRace({ type, duration: 10, entries: entries(2), weather: W.clean({}) }).weather === null) && ['race', 'timed'].every(type => E.createRace({ type, laps: 5, duration: 10, entries: entries(2), weather: W.clean({}) }).weather !== null)); }

// the forecast, by laps
{ const r = race(REC), go = clock(r), seen = [];
  for (let n = 1; n <= 9; n++) { go(0, 10000); go(1, 10000); seen.push(r.wxState); }
  ok('the states follow the laps of the leader: dry, cloudy at 2, wet at 3, clearing at 6, dry at 8', same(seen, ['dry', 'cloudy', 'wet', 'wet', 'wet', 'clearing', 'clearing', 'dry', 'dry']));
  ok('every change is in the race log (not the car, the leader\'s laps, the time, what it was and that the forecast did it)', same(evs(r, 'weather').map(e => [e.state, e.was, e.lap, e.at, e.by, e.car]), [['cloudy', 'dry', 2, 20000, 'forecast', -1], ['wet', 'cloudy', 3, 30000, 'forecast', -1], ['clearing', 'wet', 6, 60000, 'forecast', -1], ['dry', 'clearing', 8, 80000, 'forecast', -1]]));
  ok('...and in words: when each state began', r.weatherNote() === 'Cloudy from lap 3, rain from lap 4, clearing from lap 7, dry from lap 9' && r.wxStage === 4 && r.wxPlan.stages.length === 4); }
{ const r = race({ ...REC, startAt: 1, cloudyFor: 0, clearingFor: 0, rainFor: 2 }), go = clock(r), seen = [];
  for (let n = 1; n <= 4; n++) { go(0, 10000); seen.push(r.wxState); }
  ok('with no Cloudy and no Clearing it goes straight from dry to wet and back to dry', same(seen, ['wet', 'wet', 'dry', 'dry']) && same(evs(r, 'weather').map(e => e.state), ['wet', 'dry'])); }
{ const r = race({ ...REC, startAt: 0, cloudyFor: 3 });
  ok('rain at 0 is there from the start: no Cloudy, the first state is wet at once, and the cars have the reaction time from the start', r.wxState === 'wet' && same(evs(r, 'weather').map(e => [e.state, e.at, e.lap]), [['wet', 0, 0]]) && r.cars.every(c => c.wxDue && c.wxDue.lap === 2)); }
{ const r = race({ ...REC, startAt: 1, cloudyFor: 4 });
  ok('clouds longer than the time before the rain are there from the start', r.wxState === 'cloudy' && r.wxStage === 1); }

// the forecast, by time
{ const T = { unit: 'time', startAt: 1, rainFor: 1, cloudyFor: 0.5, clearingFor: 0.5 }; // cloudy@30 s wet@60 s clearing@120 s dry@150 s
  const r = race(T), seen = t => { r.tick(t); return r.wxState; };
  ok('by time the states follow the clock of the race: dry until 30 s, cloudy, wet at 60 s, clearing at 2 minutes, dry at 2:30', seen(29999) === 'dry' && seen(30000) === 'cloudy' && seen(59999) === 'cloudy' && seen(60000) === 'wet' && seen(119999) === 'wet' && seen(120000) === 'clearing' && seen(150000) === 'dry');
  ok('...in the log and in words, with the time', r.weatherNote() === 'Cloudy from 0:30, rain from 1:00, clearing from 2:00, dry from 2:30' && same(evs(r, 'weather').map(e => e.at), [30000, 60000, 120000, 150000]));
  const q = race(T); q.tick(35000); q.pause(35000); q.tick(200000);
  ok('a paused race does not go on (the time of the pause does not count)', q.wxState === 'cloudy'); q.resume(95000); q.tick(100000); q.tick(119999);
  ok('...after the pause it goes on from where it was (35 s + 60 s paused: 60 s of racing is at 2:00)', q.wxState === 'cloudy'); q.tick(120000);
  ok('...and the rain starts when 60 s have been raced', q.wxState === 'wet');
  const z = race(T); z.tick(400000);
  ok('a late look goes through the states in order (nothing is skipped), and only once', same(evs(z, 'weather').map(e => e.state), ['cloudy', 'wet', 'clearing', 'dry']) && (z.tick(500000), evs(z, 'weather').length === 4)); }
{ const r = race(REC, { type: 'timed' }), go = clock(r); drive(r, 3);
  ok('a timed race has the weather too (by the laps of the leader)', r.wxState === 'wet'); }

// the Race Director decides
{ const r = race({ startMode: 'director' });
  drive(r, 20);
  ok('nothing happens by itself when the Race Director decides', r.wxState === 'dry' && evs(r, 'weather').length === 0 && r.wxPlan.director === true && r.cars.every(c => c.tyre === c.tyreOwn));
  ok('he sets a state: it is logged as his (with the leader\'s laps); the same state again, and a state that is not one, do nothing', r.wxSet('cloudy', 250000) === true && r.wxState === 'cloudy' && r.wxSet('cloudy', 251000) === false && r.wxSet('rain', 252000) === false && r.wxSet(undefined, 252000) === false
    && same(evs(r, 'weather').map(e => [e.state, e.was, e.lap, e.by]), [['cloudy', 'dry', 20, 'director']]));
  ok('...any state to any state, also back from rain to dry (and the stage counter is left alone)', r.wxSet('wet', 260000, 'director') && r.wxSet('dry', 270000) && r.wxSet('clearing', 280000) && r.wxState === 'clearing' && r.wxStage === 0);
  r.stop(300000);
  ok('...but not when the race is over', r.wxSet('wet', 310000) === false && r.wxState === 'clearing'); }
{ const r = E.createRace({ type: 'race', laps: 10, endRule: 'all', entries: entries(2), fuel: fuel(), weather: W.clean({ startMode: 'director' }) });
  ok('before the start he can set it too (the race starts with that weather, at time 0)', r.wxSet('cloudy', 0) === true && same(evs(r, 'weather').map(e => [e.state, e.at]), [['cloudy', 0]]) && (r.start(5000), r.wxState === 'cloudy')); }

// the tyres in a pit stop
{ const r = race(REC);
  at(r, 0, 10000); at(r, 1, 10000); at(r, 0, 20000); pit(r, 1, 20500); // car 1 (Medium) stops while it is Cloudy
  ok('a stop in Cloudy gives Wet tyres, when the stop starts; it is logged with what it was, the weather and the laps', r.wxState === 'cloudy' && r.cars[1].tyre === 'W' && r.cars[0].tyre === 'S' && same(evs(r, 'tyres').map(e => [e.car, e.tyre, e.was, e.state, e.lap, e.t]), [[1, 'W', 'M', 'cloudy', 2, 22500]]));
  ok('...the car that did not stop keeps its own tyre; in Cloudy nobody has to change yet, and wet tyres on the dry track cost 10% (the table)', r.cars[0].wxDue === null && r.cars[1].wxDue === null && r.cars[0].wx === 0 && r.cars[1].wx === -10 && same(r.wxOf(1), { tyre: 'W', own: 'M', need: '', hinder: 10 }));
  r.unblock(1, 23000); at(r, 0, 30000);
  ok('the rain starts: the car on dry tyres has to stop and has 2 laps to do it; the car on wet tyres is fine and is not hindered any more; the car on dry tyres is, by 25%', r.wxState === 'wet' && r.cars[0].wxDue && r.cars[0].wxDue.kind === 'wet' && r.cars[0].wxDue.lap === 5 && r.cars[1].wxDue === null && r.cars[0].wx === -25 && r.cars[1].wx === 0 && r.wxOf(0).need === 'wet');
  at(r, 1, 33000); at(r, 0, 40000);
  ok('a lap before the reaction time has run out nothing happens', r.cars[0].points === 0 && evs(r, 'tyredue').length === 0);
  at(r, 0, 50000);
  ok('after 2 laps a car that is still on dry tyres gets the 2 penalty points, as the penalty system says (and the log says why)', r.cars[0].points === 2 && same(evs(r, 'tyredue').map(e => [e.car, e.kind, e.points, e.lap, e.tyre]), [[0, 'wet', 2, 5, 'S']]) && evs(r, 'penalty').length === 1 && evs(r, 'penalty')[0].why === 'tyres' && r.cars[0].wxDue === null);
  at(r, 0, 60000); at(r, 0, 70000);
  ok('...once (not for every lap, the standard)', r.cars[0].points === 2 && evs(r, 'tyredue').length === 1);
  ok('the note of the car: the tyres it got and the points; the car that never changed has only the points', r.tyreNoteOf(1) === 'Wet tyres after lap 2' && r.tyreNoteOf(0) === '2 penalty points for the tyres after lap 5'); }
{ const r = race({ ...REC, repeat: 'every', rainFor: 6 }); // wet from lap 3 to 9
  drive(r, 3); const o = []; for (let n = 4; n <= 10; n++) { at(r, 0, n * 10000); o.push(r.cars[0].points); }
  ok('penalty for every lap: from the lap it falls due the points come every lap (laps 5 to 8 here; it clears from lap 9 and nobody has to change any more)', same(o, [0, 2, 4, 6, 8, 8, 8]) && evs(r, 'tyredue').length === 4 && evs(r, 'tyredue').map(e => e.lap).join() === '5,6,7,8'); }
{ const r = race({ ...REC, repeat: 'every' }); drive(r, 4); at(r, 0, 50000); pit(r, 0, 50500);
  const was = r.cars[0].points; at(r, 0, 70000); at(r, 0, 80000);
  ok('a stop puts an end to it: the tyre is Wet, the points stop', was === 2 && r.cars[0].tyre === 'W' && r.cars[0].points === 2 && r.cars[0].wxDue === null); }
{ const r = race(REC); drive(r, 3); at(r, 0, 40000); pit(r, 0, 40500);
  at(r, 0, 55000); at(r, 0, 65000); at(r, 0, 75000);
  ok('a car that stops in the rain before its time is up gets no points at all (the other car did not come by again, so it was not called to account)', r.cars[0].tyre === 'W' && r.cars[0].points === 0 && r.cars[0].wxDue === null && evs(r, 'tyredue').length === 0 && r.cars[1].points === 0 && r.cars[1].wxDue === null); } // (the rain is over by the time the other car would have been called to account)
{ const r = race(REC); drive(r, 2); r.block(0, 20500); r.unblock(0, 21500);
  ok('a stop shorter than the time the sensor must be blocked is no pit stop: the tyres stay', r.cars[0].tyre === 'S' && r.cars[0].pit === null && evs(r, 'tyres').length === 0); }
{ const r = race(REC); drive(r, 3); pit(r, 0, 40000); at(r, 1, 40000);
  ok('a stop in the rain gives Wet to a car on dry tyres, and a stop again keeps them Wet', r.cars[0].tyre === 'W' && (r.unblock(0, 43000), at(r, 0, 50000), pit(r, 0, 50500), r.cars[0].tyre === 'W') && evs(r, 'tyres').filter(e => e.car === 0).length === 1); }

// switching back
{ const r = race(REC); drive(r, 3); pit(r, 0, 40000); r.unblock(0, 43000);
  drive(r, 5); // up to lap 8: dry
  ok('when it is dry again a car that is still on wet tyres has to change back, and has the reaction time', r.wxState === 'dry' && r.cars[0].tyre === 'W' && r.cars[0].wxDue && r.cars[0].wxDue.kind === 'dry' && r.wxOf(0).need === 'dry' && r.cars[1].wxDue === null);
  ok('...wet tyres on a dry track are slower: 20% (the table), as long as it lasts', r.cars[0].wx === -20 && r.cars[1].wx === 0);
  const p0 = r.cars[0].points; drive(r, 1);
  ok('...and one lap before the time is up no points yet', r.cars[0].points === p0);
  drive(r, 1);
  ok('...after the reaction time it costs the 2 points for switching back (its own number)', r.cars[0].points === p0 + 2 && evs(r, 'tyredue').filter(e => e.kind === 'dry').length === 1 && evs(r, 'tyredue').filter(e => e.kind === 'dry')[0].car === 0); }
{ const r = race({ ...REC, dryPoints: 5, wetPoints: 1 }); drive(r, 8);
  ok('the two kinds of points are their own numbers (1 for not switching to wet, 5 for not switching back)', evs(r, 'tyredue').every(e => e.kind === 'wet' && e.points === 1) && r.cars[0].points === 1); }
{ const r = race(REC); drive(r, 3); pit(r, 0, 40000); r.unblock(0, 43000); drive(r, 3); // clearing
  ok('in Clearing nothing has to be changed (the track is still damp), wet tyres cost 10%, dry tyres 10%', r.wxState === 'clearing' && r.cars[0].wxDue === null && r.cars[1].wxDue === null && r.cars[0].wx === -10 && r.cars[1].wx === -10);
  pit(r, 0, 70000);
  ok('a stop in Clearing gives the car its own tyres back, and then it has nothing to change when it is dry (no points)', r.cars[0].tyre === 'S' && r.cars[0].wx === -10 && (drive(r, 6), r.wxState === 'dry' && r.cars[0].wx === 0 && r.cars[0].wxDue === null && evs(r, 'tyredue').filter(e => e.car === 0 && e.kind === 'dry').length === 0)); }

// Intermediate for Cloudy and Clearing
{ const r = race({ ...REC, cloudyTyre: 'inter', clearingTyre: 'inter' });
  at(r, 0, 10000); at(r, 1, 10000); at(r, 0, 20000); pit(r, 1, 20500); r.unblock(1, 23000);
  ok('with Intermediate for Cloudy a stop in Cloudy gives Intermediate; on the dry track it costs 5%', r.cars[1].tyre === 'INT' && r.cars[1].wx === -5 && evs(r, 'tyres')[0].tyre === 'INT');
  at(r, 0, 30000);
  ok('...in the rain Intermediate is enough: no stop is needed and no points, but it is slower than Wet (10%, the table)', r.wxState === 'wet' && r.cars[1].wxDue === null && r.cars[1].wx === -10 && r.wxOf(1).need === '');
  at(r, 1, 33000); pit(r, 1, 40000); r.unblock(1, 43000);
  ok('...a stop in the rain makes it Wet', r.cars[1].tyre === 'W' && r.cars[1].wx === 0 && evs(r, 'tyres').map(e => e.tyre).join() === 'INT,W');
  at(r, 0, 40000); at(r, 0, 50000); at(r, 0, 60000); // the leader has 6 laps: clearing
  pit(r, 1, 65000); r.unblock(1, 68000);
  ok('a stop in Clearing gives Intermediate (the table says 0%: it is the right tyre for a drying track)', r.wxState === 'clearing' && r.cars[1].tyre === 'INT' && r.cars[1].wx === 0);
  at(r, 0, 70000); at(r, 1, 75000); at(r, 0, 80000); at(r, 1, 85000); // the leader has 8 laps: dry
  ok('...and when it is dry a car on Intermediate has to change back to its own tyres (the same points as for Wet)', r.wxState === 'dry' && r.cars[1].wxDue && r.cars[1].wxDue.kind === 'dry' && r.cars[1].wx === -10); }

// no penalty system, no points
{ const r = race(REC, { noPenalty: true }); drive(r, 5);
  ok('without a penalty system the car has no points, but the reaction time still runs out and it is logged (with 0 points)', r.cars[0].points === 0 && same(evs(r, 'tyredue').filter(e => e.car === 0).map(e => [e.kind, e.points]), [['wet', 0]]) && evs(r, 'penalty').length === 0 && r.tyreNoteOf(0) === ''); }
{ const r = race({ ...REC, wetPoints: 0 }); drive(r, 5);
  ok('...and with 0 points the same', r.cars[0].points === 0 && evs(r, 'tyredue').length === 2 && evs(r, 'tyredue').every(e => e.points === 0)); }
{ const r = race({ ...REC, react: 0 }); drive(r, 3);
  ok('0 laps to react: the car is called to account at its next line crossing', r.cars[0].wxDue === null && evs(r, 'tyredue').length >= 1 && r.cars[0].points === 2); }
{ const r = race({ ...REC, wetPoints: 99 }, { cfg: { penalty: { ...pen, dq: 5 } } }); drive(r, 5);
  ok('enough points disqualify a car as any other points do', r.cars[0].dq === true && r.cars[1].dq === true); }

// hindrance: more fuel per lap, slower refuelling, (a smaller tank), for the wrong tyres, as long as it lasts
const RAIN = { startAt: 1, cloudyFor: 0, rainFor: 5, clearingFor: 0 }; // wet from the first lap of the leader to lap 6
const lit = (r, i) => Math.round(r.fuelOf(i, 1e9) * 1e6) / 1e6;
{ const r = race(RAIN);
  at(r, 0, 10000); at(r, 1, 10000);
  ok('on the wrong tyres the car uses 25% more fuel a lap (the table: dry tyres in the rain); the leader\'s lap that starts the rain is still used the old way, the car after it already the new', r.cars[0].wx === -25 && r.cars[1].wx === -25 && lit(r, 0) === 98 && lit(r, 1) === 97.5);
  at(r, 0, 20000); at(r, 1, 20000);
  ok('...a lap later: 2.5 litres a lap', lit(r, 0) === 95.5 && lit(r, 1) === 95);
  pit(r, 1, 21000); r.unblock(1, 24000);
  ok('...and wet tyres are the right tyres: no hindrance, the normal use again', r.cars[1].tyre === 'W' && r.cars[1].wx === 0 && lit(r, 1) === 100 && (at(r, 1, 30000), lit(r, 1) === 98)); }
{ const r = race(REC); at(r, 0, 10000); at(r, 1, 10000); at(r, 0, 20000); pit(r, 1, 20500);
  ok('a pit stop of a car that is hindered fills the tank slower: Wet tyres in Cloudy cost 10% (the table), so 9 litres a second instead of 10', r.cars[1].tyre === 'W' && r.cars[1].pit && r.cars[1].pit.rate === 9 && r.cars[1].pit.tank === 100);
  const q = race({ ...REC, hRate: 'off' }); at(q, 0, 10000); at(q, 1, 10000); at(q, 0, 20000); pit(q, 1, 20500);
  ok('...with the refuelling lever off the stop is as fast as ever', q.cars[1].pit && q.cars[1].pit.rate === 10 && q.cars[1].wx === -10);
  const z = race({ ...REC, hTank: 'on' }); at(z, 0, 10000); at(z, 1, 10000); at(z, 0, 20000); pit(z, 1, 20500);
  ok('...with the tank lever on it fills a tank 10% smaller (90 litres)', z.cars[1].pit && z.cars[1].pit.tank === 90); }
{ const r = race({ ...RAIN, hTank: 'on' }); at(r, 0, 10000);
  ok('with the tank on, the tank of a hindered car is 25% smaller and what does not fit is gone (100 litres in 98: 75)', r.cars[0].wx === -25 && lit(r, 0) === 75); }
{ const r = race({ ...RAIN, hUse: 'off' }); at(r, 0, 10000); at(r, 1, 10000); at(r, 0, 20000); at(r, 1, 20000);
  ok('every lever can be off: no more fuel use (the car is still hindered in its refuelling, the weather says so)', r.cars[0].wx === -25 && lit(r, 0) === 96 && lit(r, 1) === 96); }
{ const r = race({ ...RAIN, hinder: 'off' }); at(r, 0, 10000); at(r, 1, 10000); at(r, 1, 20000);
  ok('with the hindrance off the cars are not hindered, only the points can come (and the tyres change)', r.cars.every(c => c.wx === 0) && lit(r, 0) === 98 && lit(r, 1) === 96 && r.cars[0].wxDue && r.cars[0].wxDue.kind === 'wet' && r.wxOf(0).hinder === 0); }
{ const r = race(RAIN, { noFuel: true }); at(r, 0, 10000); at(r, 1, 10000); drive(r, 0);
  ok('without a Fuel Setup there is no hindrance (nothing to hinder) but the tyres and the penalty points work as they always do', r.cars.every(c => c.wx === 0) && r.fuelOf(0, 1e9) === null && r.cars[0].wxDue && r.cars[0].wxDue.kind === 'wet' && (pit(r, 1, 20000), r.cars[1].tyre === 'W')); }
{ const r = race(RAIN, { cars: 3 }); [0, 1, 2].forEach(i => at(r, i, 10000));
  ok('the cars on the tyres the weather asks for are not hindered: the Wet car (4th tyre H, W only at index 3), S/M/H are all dry class', r.cars.map(c => c.wx).join() === '-25,-25,-25'); }
{ const r = E.createRace({ type: 'race', laps: 60, endRule: 'all', entries: [{ lane: 0, tyre: 'W' }, { lane: 1, tyre: 'S' }], fuel: fuel(), weather: W.clean(RAIN, 1) }); r.start(0);
  at(r, 0, 10000); at(r, 1, 10000);
  ok('a car whose own tyre is Wet is not hindered in the rain and not asked to change; on the dry track the table says 20% (it is still the tyre of the car: it has nothing to change)', r.cars[0].wx === 0 && r.cars[0].wxDue === null && r.cars[1].wxDue && r.cars[1].wx === -25 && (r.wxSet('dry', 15000, 'director'), r.cars[0].wx === -20 && r.cars[0].wxDue === null && r.cars[1].wx === 0 && r.cars[1].wxDue === null)); }

// stacked on Balance of Power
{ const r = race(RAIN, { bop: { mode: 'manual' } }); r.bopSet(0, -10, 0); at(r, 0, 10000); at(r, 0, 20000);
  ok('Balance of Power and the weather add up: 10% hindered by Balance of Power and 25% by the weather is 35% more fuel per lap (2.7 litres)', r.cars[0].bop === -10 && r.cars[0].wx === -25 && lit(r, 0) === 100 - 2.2 - 2.7);
  r.bopSet(0, 15, 25000);
  ok('...a helped car is helped by what it is hindered (+15 and -25: 10% more)', lit(r, 0) === 95.1 && (at(r, 0, 30000), Math.abs(lit(r, 0) - (95.1 - 2.2)) < 1e-6)); }
{ const r = race(RAIN, { bop: { mode: 'manual' } }); r.bopSet(0, -80, 0); at(r, 0, 10000); at(r, 0, 20000);
  ok('...and together never more than the limit of 90% (80 + 25 is 90: 1.9 times the fuel)', Math.abs(lit(r, 0) - (100 - 3.6 - 3.8)) < 1e-6); }
{ const r = race(RAIN, { bop: { mode: 'manual' } }); r.bopSet(0, -10, 0); at(r, 0, 10000); pit(r, 0, 11000); r.unblock(0, 14000); const f0 = lit(r, 0);
  at(r, 0, 20000);
  ok('after the stop the weather does nothing any more, and Balance of Power goes on as it was (only its 10%)', r.cars[0].tyre === 'W' && r.cars[0].wx === 0 && r.cars[0].bop === -10 && f0 === 100 && Math.abs(f0 - lit(r, 0) - 2.2) < 1e-6); }
{ const r = race(RAIN, { bop: { mode: 'manual', use: false, rate: true } }); r.bopSet(0, -10, 0); at(r, 0, 10000); at(r, 0, 20000);
  ok('each lever has its own mix (Balance of Power with the fuel use off: only the weather\'s 25% counts for the use)', lit(r, 0) === 98 - 2.5); }
{ const r = race(RAIN); const k = r.wxOf(0); at(r, 0, 10000); at(r, 1, 10000);
  ok('the screens ask the engine: the tyre, the tyre of the car itself, what it should do, how many percent', same(k, { tyre: 'S', own: 'S', need: '', hinder: 0 }) && same(r.wxOf(0), { tyre: 'S', own: 'S', need: 'wet', hinder: 25 }) && same(r.wxOf(1), { tyre: 'M', own: 'M', need: 'wet', hinder: 25 })); }

// the result of a heat
{ const people = [0, 1].map(i => ({ driverId: 'd' + i, carId: 'c' + i, driverName: 'D' + i, carName: 'car' + i }));
  const H = E.createHeatRace({ participants: people, schedule: [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }]], resultBy: 'laps', points: [] });
  const r = E.createRace({ type: 'race', laps: 4, endRule: 'all', entries: H.entries(), fuel: fuel(), penalty: pen, weather: W.clean({ startAt: 0, cloudyFor: 0, rainFor: 9, clearingFor: 0 }, 1) }); r.start(0);
  at(r, 0, 10000); at(r, 1, 10000); pit(r, 1, 11000); r.unblock(1, 14000); at(r, 0, 20000); at(r, 1, 20000); at(r, 0, 30000); at(r, 1, 30000);
  const rec = H.record(r), rows = rec.rows;
  ok('the result of a heat says what the weather did in the heat, in words', rec.weatherNote === r.weatherNote() && rec.weatherNote === 'Rain from lap 1');
  ok('the row of a heat says what the tyres did to the car (the penalty points, the change), and has nothing for a car that had nothing', rows.find(x => x.participant === 0).tyreNote === '2 penalty points for the tyres after lap 2' && rows.find(x => x.participant === 1).tyreNote === 'Wet tyres after lap 2'); }
ok('a stand-in race (no notes) gives rows with no tyre note', (() => { const people = [0].map(i => ({ driverId: 'd', carId: 'c', driverName: 'D', carName: 'car' })); const H = E.createHeatRace({ participants: people, schedule: [[{ p: 0, lane: 0 }]], resultBy: 'laps', points: [] }); return !('tyreNote' in H.record({ standings: () => [{ pos: 1, car: { participant: 0, laps: [1], total: 1, best: 1 } }] }).rows[0]); })());

// coming into the pits on the lap the time is up
{ const r = race({ ...REC, react: 1 }); drive(r, 3); // wet from lap 3, due on lap 4
  r.block(0, 40000); r.tick(42500);
  ok('a car that stops on the sensor on the lap it is due is judged by its stop, not by the crossing that brought it in (no points, Wet tyres)', r.cars[0].wxDue === null && r.cars[0].points === 0 && r.cars[0].tyre === 'W' && evs(r, 'tyredue').filter(e => e.car === 0).length === 0); }
{ const r = race({ ...REC, react: 1 }); drive(r, 3);
  r.block(0, 40000); r.unblock(0, 41000); // (too short to be a stop)
  ok('...a short block is no stop: the car is still due, and is judged at its next crossing', r.cars[0].wxDue && r.cars[0].points === 0 && r.cars[0].tyre === 'S'); at(r, 0, 50000);
  ok('...and gets the points then', r.cars[0].points === 2 && evs(r, 'tyredue').filter(e => e.car === 0).length === 1); }

// what the controls of the Race Director show
{ const r = race(REC), v0 = W.view(r, 'running', 0);
  ok('without a weather system the controls are not there', same(W.view(null, 'running', 0), { on: false, mode: '', state: '', name: '', info: '', rows: [], buttons: [] }) && W.view(race(null), 'running', 0).on === false && W.view({}, 'running', 0).on === false);
  ok('with a forecast the controls say what the weather is and what comes next, and the buttons are there but can not be pressed (nothing to decide)', v0.on && v0.mode === 'point' && v0.state === 'dry' && v0.info === 'Dry. Next: clouds build up in 2 laps.' && same(v0.buttons.map(b => [b.state, b.on, b.disabled]), [['dry', true, true], ['cloudy', false, true], ['wet', false, true], ['clearing', false, true]]) && v0.buttons.map(b => b.text).join() === 'Dry,Cloudy,Wet,Clearing');
  ok('the cars are listed with their tyre (and its colour), their own tyre, what they have to do and how much they are hindered', same(v0.rows.map(x => [x.lane, x.who, x.code, x.tyre, x.color, x.own, x.todo, x.hinder, x.hinderText]), [[0, 'D0', 'S', 'Soft', '#e8002d', 'Soft', '', 0, ''], [1, 'D1', 'M', 'Medium', '#ffd12e', 'Medium', '', 0, '']]));
  at(r, 0, 10000); at(r, 1, 10000); at(r, 0, 20000);
  ok('...it follows the forecast ("Next: rain starts in 1 lap")', W.view(r, 'running', 20000).info === 'Cloudy. Next: rain starts in 1 lap.');
  at(r, 0, 30000);
  const v = W.view(r, 'running', 30000, [1]);
  ok('...a car on the wrong tyres is told so, with the percentage; the lanes asked for are listed, the others are not', v.state === 'wet' && v.info === 'Wet. Next: the rain stops, the track clears in 3 laps.' && v.rows.length === 1 && v.rows[0].lane === 1 && v.rows[0].todo === 'Has to switch to Wet' && v.rows[0].hinder === 25 && v.rows[0].hinderText === 'Hindered 25%');
  pit(r, 1, 31000); r.unblock(1, 34000);
  ok('...and not any more after the stop (the Wet tyres are blue)', (x => x.code === 'W' && x.tyre === 'Wet' && x.color === '#0067ff' && x.todo === '' && x.hinderText === '' && x.own === 'Medium')(W.view(r, 'running', 34000).rows[1]));
  r.wxSet('dry', 40000, 'director');
  ok('...a car that is still on Wet tyres when it is dry is told to switch back to its own tyres', W.view(r, 'running', 40000).rows[1].todo === 'Has to switch back to Medium'); }
{ const r = race({ startMode: 'director' }), v = W.view(r, 'running', 0);
  ok('when the Race Director decides the buttons can be pressed (also before the start, in a pause and between two heats), and say what is on', v.mode === 'director' && v.info === 'Dry. The Race Director decides: press a state.' && v.buttons.every(b => !b.disabled) && v.buttons[0].on && !v.buttons[1].on && ['ready', 'countdown', 'paused', 'between'].every(ph => W.view(r, ph, 0).buttons.every(b => !b.disabled)));
  ok('...but not when the race is over (finished or in review, or the engine says so)', ['finished', 'review', 'stopped'].every(ph => W.view(r, ph, 0).buttons.every(b => b.disabled)) && (r.stop(10000), W.view(r, 'running', 10000).buttons.every(b => b.disabled))); }
{ const r = race({ unit: 'time', startAt: 1, cloudyFor: 0.5 });
  ok('by time the controls say it in time', W.view(r, 'running', 5000).info === 'Dry. Next: clouds build up in 25 seconds.'); }

// the audio calls
const A = require('../renderer/announcer.js');
{ const names = id => (A.CALLS.find(c => c.id === id) || {}), ids = ['weathercloudy', 'weatherwet', 'weatherclearing', 'weatherdry', 'weatherconditions', 'tyrechange', 'wrongtyres', 'tyrepenalty'];
  ok('there are eight calls in a Weather folder (the weather in four, the conditions on the track, a tyre change, the wrong tyres, the penalty for them), each with sentences', ids.every(id => names(id).group === 'Weather' && names(id).lines.length >= 2) && A.CALLS.filter(c => c.group === 'Weather').length === 8);
  ok('...the sentences use only the words the call has (driver, tyre, weather, points, the conditions)', ids.every(id => names(id).lines.every(l => (l.match(/\{(\w+)\}/g) || []).every(w => names(id).vars.includes(w.slice(1, -1))))) && names('tyrechange').vars.join() === 'driver,tyre,weather' && names('tyrepenalty').vars.join() === 'driver,points,tyre,weather' && names('weatherwet').vars.join() === 'weather,tracktemp,airtemp,windspeed,winddir' && names('weatherconditions').vars.join() === 'weather,tracktemp,airtemp,windspeed,winddir');
  ok('...and the words are explained for the editor, with a sample', ids.every(id => names(id).vars.every(v => A.VARS[v] && A.SAMPLE[v] !== undefined)) && A.VARS.tyre.includes('Wet') && A.VARS.weather.includes('clearing') && /temperature/.test(A.VARS.tracktemp) && /temperature/.test(A.VARS.airtemp) && /wind/i.test(A.VARS.windspeed) && /wind/i.test(A.VARS.winddir)); }
{ const a = A.create({}), said = [], look = (r, phase = 'running') => a.observe(r, { phase, now: 0 }).forEach(x => said.push(x));
  const r = race(REC), calls = () => said.map(x => x.call).filter(c => !['firstlap', 'weatherconditions'].includes(c));
  look(r); at(r, 0, 10000); at(r, 1, 10000); look(r); at(r, 0, 20000); look(r);
  ok('the weather is said when it changes (and not before: the weather the race starts with is not said)', same(calls(), ['weathercloudy']) && said.find(x => x.call === 'weathercloudy').vars.weather === 'cloudy' && said.find(x => x.call === 'weathercloudy').facts.driverId === '');
  pit(r, 1, 20500); look(r);
  ok('a pit stop says the pit and then the tyres (the tyre as a word, the weather)', same(calls().slice(1), ['pitin', 'tyrechange']) && (x => x.vars.driver === 'D1' && x.vars.tyre === 'Wet' && x.vars.weather === 'cloudy')(said.find(x => x.call === 'tyrechange')));
  r.unblock(1, 23000); look(r); at(r, 0, 30000); look(r);
  ok('...rain is said once', calls().filter(c => c === 'weatherwet').length === 1 && said.find(x => x.call === 'weatherwet').vars.weather === 'wet');
  at(r, 0, 40000); at(r, 0, 50000); look(r);
  const tp = said.find(x => x.call === 'tyrepenalty');
  ok('a car that stays on the wrong tyres is told so with its own call, with the points and the tyres, and the general penalty call is not said as well', tp && tp.vars.driver === 'D0' && tp.vars.points === 2 && tp.vars.tyre === 'Soft' && tp.vars.weather === 'wet' && !calls().includes('penalty'));
  at(r, 0, 60000); look(r); at(r, 0, 70000); at(r, 0, 80000); look(r);
  ok('...clearing and dry are said too, in order', same(calls().filter(c => c.startsWith('weather')), ['weathercloudy', 'weatherwet', 'weatherclearing', 'weatherdry']));
  r.addPoints(0, 1, 90000); look(r);
  ok('...and a penalty point of the Race Director is still a penalty call', calls().includes('penalty')); }
{ const a = A.create({}), said = [], look = (r, phase = 'running') => a.observe(r, { phase, now: 0 }).forEach(x => said.push(x.call));
  const r = race(REC, { noPenalty: true }); look(r); drive(r, 5); look(r);
  ok('without a penalty system the car is told it is on the wrong tyres (no points to say)', said.includes('wrongtyres') && !said.includes('tyrepenalty') && !said.includes('penalty')); }
{ const a = A.create({}), said = [], look = (r, phase) => a.observe(r, { phase, now: 0 }).forEach(x => said.push(x.call));
  const r = race(REC); look(r, 'running'); drive(r, 3); look(r, 'review');
  ok('what happens after the race (in the review) is not said', !said.some(c => c.startsWith('weather') || c === 'tyrepenalty')); }
{ const a = A.create({}), said = [], r = race(null); a.observe(r, { phase: 'running', now: 0 }); drive(r, 3); a.observe(r, { phase: 'running', now: 0 }).forEach(x => said.push(x.call));
  ok('a race without a weather system says nothing of it', !said.some(c => c.startsWith('weather') || c.startsWith('tyre') || c === 'wrongtyres')); }

// ---- 1.5.0: the conditions on the track (per weather state: track and air temperature, wind speed and direction) ----
{ const D = W.clean({}).cond;
  ok('the standard conditions per weather state, in metric: dry 30/24 degrees, 10 km/h from 225; cloudy 25/20, 16, 250; wet 17/15, 22, 270; clearing 21/17, 14, 295', D.units === 'metric'
    && same(D.dry, { track: 30, air: 24, wind: 10, dir: 225 }) && same(D.cloudy, { track: 25, air: 20, wind: 16, dir: 250 }) && same(D.wet, { track: 17, air: 15, wind: 22, dir: 270 }) && same(D.clearing, { track: 21, air: 17, wind: 14, dir: 295 }));
  ok('...DEFAULTS (what the Weather Systems page starts from) has all 16 numbers and the units, under the names the page uses', W.DEFAULTS.units === 'metric' && W.DEFAULTS.trackTempDry === 30 && W.DEFAULTS.airTempCloudy === 20 && W.DEFAULTS.windSpeedWet === 22 && W.DEFAULTS.windDirClearing === 295 && Object.keys(W.CKEYS).length === 16
    && W.CKEYS['wet/dir'] === 'windDirWet' && W.CKEYS['dry/track'] === 'trackTempDry' && W.CKEYS['clearing/wind'] === 'windSpeedClearing' && W.CKEYS['cloudy/air'] === 'airTempCloudy');
  const c = W.clean({ units: 'imperial', trackTempWet: '61,4', airTempDry: 80, windSpeedCloudy: 12, windDirClearing: 90 }).cond;
  ok('the conditions of a record are kept (a decimal comma too; whole numbers) with the units of the record', c.units === 'imperial' && c.wet.track === 61 && c.dry.air === 80 && c.cloudy.wind === 12 && c.clearing.dir === 90 && c.dry.track === 30);
  ok('...the units are metric unless they say imperial', W.clean({ units: 'x' }).cond.units === 'metric' && W.clean({ units: 5 }).cond.units === 'metric' && W.clean({ units: 'metric' }).cond.units === 'metric');
  ok('...a temperature is kept from -60 to 150, a wind speed from 0 to 400; nonsense is the standard number', W.clean({ trackTempDry: -100 }).cond.dry.track === -60 && W.clean({ trackTempDry: 200 }).cond.dry.track === 150 && W.clean({ airTempWet: -60 }).cond.wet.air === -60 && W.clean({ airTempWet: 150 }).cond.wet.air === 150
    && W.clean({ windSpeedDry: -5 }).cond.dry.wind === 0 && W.clean({ windSpeedDry: 500 }).cond.dry.wind === 400 && W.clean({ windSpeedDry: 400 }).cond.dry.wind === 400 && W.clean({ trackTempDry: 'x' }).cond.dry.track === 30 && W.clean({ windSpeedWet: null }).cond.wet.wind === 22);
  ok('...a direction is turned into 0 to 359 degrees (400 is 40, -90 is 270, 360 is 0), not cut off', W.clean({ windDirDry: 400 }).cond.dry.dir === 40 && W.clean({ windDirDry: -90 }).cond.dry.dir === 270 && W.clean({ windDirDry: 360 }).cond.dry.dir === 0 && W.clean({ windDirDry: 359.6 }).cond.dry.dir === 0 && W.clean({ windDirDry: 1080 }).cond.dry.dir === 0 && W.clean({ windDirDry: -1 }).cond.dry.dir === 359); }
{ const cfg = W.clean({}), imp = W.clean({ units: 'imperial', trackTempDry: 86, airTempDry: 75, windSpeedDry: 6, windDirDry: 90 });
  ok('the units to show: the choice of the widget, else the units of the weather system, else metric', W.unitsOf(cfg, 'imperial') === 'imperial' && W.unitsOf(imp, 'metric') === 'metric' && W.unitsOf(imp, 'system') === 'imperial' && W.unitsOf(imp, '') === 'imperial' && W.unitsOf(cfg, undefined) === 'metric' && W.unitsOf(null, 'x') === 'metric' && W.unitsOf(null, 'imperial') === 'imperial' && W.unitsOf({}, '') === 'metric');
  ok('a temperature in other units: 30 C is 86 F, 86 F is 30 C, -40 is -40 either way, 0 C is 32 F; a speed: 100 km/h is 62 mph and back; a direction is not changed; nothing to change is not changed', W.toUnits('track', 30, 'metric', 'imperial') === 86 && W.toUnits('air', 86, 'imperial', 'metric') === 30 && W.toUnits('track', -40, 'metric', 'imperial') === -40 && W.toUnits('air', 0, 'metric', 'imperial') === 32
    && near(W.toUnits('wind', 100, 'metric', 'imperial'), 62.1371) && near(W.toUnits('wind', 62.1371, 'imperial', 'metric'), 100, 1e-4) && W.toUnits('dir', 225, 'metric', 'imperial') === 225 && W.toUnits('track', 30, 'metric', 'metric') === 30 && Number.isNaN(W.toUnits('track', NaN, 'metric', 'imperial')));
  const d = W.conditionsFor(cfg, 'dry', null, ''), w = W.conditionsFor(cfg, 'wet', null, '');
  ok('the conditions of a weather state, for a screen: whole numbers, with the units and the state', same(d, { units: 'metric', state: 'dry', track: 30, air: 24, wind: 10, dir: 225 }) && same(w, { units: 'metric', state: 'wet', track: 17, air: 15, wind: 22, dir: 270 }) && W.conditionsFor(cfg, 'clearing', null, '').dir === 295 && W.conditionsFor(cfg, 'cloudy', null, '').wind === 16);
  ok('...a state that is not one is Dry; no weather system is nothing', W.conditionsFor(cfg, 'x', null, '').state === 'dry' && W.conditionsFor(cfg, undefined, null, '').track === 30 && W.conditionsFor(null, 'dry', null, '') === null && W.conditionsFor(undefined, 'dry', null, '') === null && W.conditionsFor({}, 'dry', null, '') === null);
  const im = W.conditionsFor(cfg, 'dry', null, 'imperial');
  ok('...in the other units of the widget: 30/24 degrees and 10 km/h are 86/75 degrees and 6 mph; the direction stays; and back (a system in imperial, shown in metric)', same(im, { units: 'imperial', state: 'dry', track: 86, air: 75, wind: 6, dir: 225 }) && same(W.conditionsFor(imp, 'dry', null, 'metric'), { units: 'metric', state: 'dry', track: 30, air: 24, wind: 10, dir: 90 }) && same(W.conditionsFor(imp, 'dry', null, 'system'), { units: 'imperial', state: 'dry', track: 86, air: 75, wind: 6, dir: 90 }));
  const own = { dry: { track: 10, air: 5, wind: 20, dir: 400 }, wet: { track: 100, air: 50, wind: 100, dir: -45 } };
  ok('values of the widget itself beat the ones of the weather system, and are taken to be in the units to show (so they are not converted), the direction as 0 to 359', same(W.conditionsFor(cfg, 'dry', own, 'imperial'), { units: 'imperial', state: 'dry', track: 10, air: 5, wind: 20, dir: 40 }) && same(W.conditionsFor(null, 'wet', own, ''), { units: 'metric', state: 'wet', track: 100, air: 50, wind: 100, dir: 315 })
    && W.conditionsFor(cfg, 'cloudy', own, '') === null && W.conditionsFor(cfg, 'wet', { wet: { track: 'x' } }, '').track === 0);
  ok('the compass: 16 points of 22.5 degrees (0 N, 90 E, 180 S, 225 SW, 270 W, 337 NNW, 348.75 and 360 N, -90 W, nonsense N), and the same in words for the audio', W.compass(0) === 'N' && W.compass(90) === 'E' && W.compass(180) === 'S' && W.compass(225) === 'SW' && W.compass(270) === 'W' && W.compass(337) === 'NNW' && W.compass(349) === 'N' && W.compass(360) === 'N' && W.compass(-90) === 'W' && W.compass('x') === 'N' && W.compass(11) === 'N' && W.compass(12) === 'NNE' && W.COMPASS.length === 16
    && W.compassWord(225) === 'south west' && W.compassWord(0) === 'north' && W.compassWord(22) === 'north north east' && W.compassWord(300) === 'west north west' && W.compassWord(-90) === 'west'); }
{ const d = W.condText(W.conditionsFor(W.clean({}), 'dry', null, '')), i = W.condText(W.conditionsFor(W.clean({}), 'dry', null, 'imperial')), n = W.condText(W.conditionsFor(W.clean({ trackTempDry: -5 }), 'dry', null, ''));
  ok('the conditions as they are printed: 30 °C, 24 °C, 10 km/h, SW and 225°; in imperial °F and mph; a minus stays', same(d, { track: '30 °C', air: '24 °C', wind: '10 km/h', dir: 'SW', degrees: '225°' }) && i.track === '86 °F' && i.air === '75 °F' && i.wind === '6 mph' && n.track === '-5 °C');
  ok('...nothing to show prints dashes', same(W.condText(null), { track: '–', air: '–', wind: '–', dir: '–', degrees: '–' }) && same(W.condText(undefined), W.condText(null)));
  const s = W.condSpeech(W.conditionsFor(W.clean({}), 'dry', null, '')), si = W.condSpeech(W.conditionsFor(W.clean({}), 'dry', null, 'imperial'));
  ok('the conditions as they are spoken: 30 degrees, 24 degrees, 10 kilometres per hour, south west; in imperial miles per hour', same(s, { tracktemp: '30 degrees', airtemp: '24 degrees', windspeed: '10 kilometres per hour', winddir: 'south west' }) && si.windspeed === '6 miles per hour' && si.tracktemp === '86 degrees');
  const one = W.condSpeech({ units: 'metric', track: 1, air: -1, wind: 1, dir: 0 }), neg = W.condSpeech({ units: 'imperial', track: -5, air: 0, wind: 1, dir: 180 });
  ok('...one degree and one kilometre or mile (not "1 degrees"), minus for the cold (minus 5 degrees, minus 1 degree), nought is 0 degrees', one.tracktemp === '1 degree' && one.airtemp === 'minus 1 degree' && one.windspeed === '1 kilometre per hour' && one.winddir === 'north' && neg.tracktemp === 'minus 5 degrees' && neg.airtemp === '0 degrees' && neg.windspeed === '1 mile per hour' && neg.winddir === 'south');
  ok('...nothing to say is nothing (empty words)', same(W.condSpeech(null), { tracktemp: '', airtemp: '', windspeed: '', winddir: '' })); }

// ---- 1.5.0: what the Weather Forecast widget shows (the weather now, and the next change) ----
{ const cfg = W.clean(REC), plan = W.plan(cfg, 1), eng = (o = {}) => ({ weather: cfg, wxPlan: plan, wxStage: 0, wxState: 'dry', cars: [{ laps: [] }, { laps: [] }], status: 'running', elapsed: () => 0, ...o });
  ok('the leader decides how many laps there are; before the start there is no time', same(W.progressOf(eng({ cars: [{ laps: [1, 2, 3] }, { laps: [1] }] })), { laps: 3, ms: 0 }) && W.progressOf(eng({ cars: [] })).laps === 0 && W.progressOf(eng({ elapsed: t => t * 2 }), 5000).ms === 10000 && W.progressOf(eng({ status: 'ready', elapsed: () => 99 }), 1).ms === 0 && W.progressOf({ cars: [{ laps: [1] }] }).ms === 0);
  const o0 = W.outlook(eng(), 0);
  ok('the outlook before the rain (cloudy at lap 2, rain at 3): Dry now, and "Cloudy in 2 laps" next', o0.state === 'dry' && o0.name === 'Dry' && o0.director === false && o0.next.state === 'cloudy' && o0.next.left === 2 && o0.next.text === 'Cloudy in 2 laps');
  const o1 = W.outlook(eng({ wxState: 'cloudy', wxStage: 1, cars: [{ laps: [1, 2] }] }), 0), o2 = W.outlook(eng({ wxState: 'wet', wxStage: 2, cars: [{ laps: [1, 2, 3, 4, 5] }] }), 0), o3 = W.outlook(eng({ wxState: 'dry', wxStage: 4, cars: [{ laps: [1, 2, 3, 4, 5, 6, 7, 8, 9] }] }), 0);
  ok('...Cloudy: "Rain in 1 lap"; Wet: "Clearing in 1 lap"; at the end of the forecast there is nothing next', o1.name === 'Cloudy' && o1.next.text === 'Rain in 1 lap' && o2.name === 'Wet' && o2.next.text === 'Clearing in 1 lap' && o3.next === null && o3.state === 'dry');
  ok('...a change that is due now says "now"', W.outlook(eng({ cars: [{ laps: [1, 2, 3] }] }), 0).next.text === 'Cloudy now' && W.outlook(eng({ cars: [{ laps: [1, 2, 3] }] }), 0).next.left === 0);
  ok('...the state of the engine is Dry unless it says otherwise', W.outlook(eng({ wxState: undefined }), 0).state === 'dry' && W.outlook(eng({ wxStage: undefined }), 0).next.state === 'cloudy');
  const dir = W.clean({ startMode: 'director' }), od = W.outlook({ weather: dir, wxPlan: W.plan(dir, 1), wxState: 'wet', cars: [], status: 'running' }, 0);
  ok('when the Race Director decides there is no next change, and the outlook says so (the plan, or only the settings, say so)', od.director === true && od.next === null && od.name === 'Wet' && W.outlook({ weather: dir, wxState: 'dry', cars: [], status: 'running' }, 0).director === true);
  ok('a race without weather has no outlook', W.outlook({ cars: [] }, 0) === null && W.outlook(null, 0) === null && W.outlook(undefined, 0) === null);
  const tm = W.clean({ unit: 'time', startAt: 2, cloudyFor: 0, rainFor: 1 }), ot = W.outlook({ weather: tm, wxPlan: W.plan(tm, 1), wxStage: 0, wxState: 'dry', cars: [{ laps: [1, 2, 3, 4] }], status: 'running', elapsed: () => 30000 }, 0);
  ok('in time: "Rain in 1 minute 30 seconds" (the laps do not count)', ot.next.state === 'wet' && ot.next.text === 'Rain in 1 minute 30 seconds' && ot.next.left === 90000); }

// ---- 1.5.0: the conditions on the track in the audio ----
{ const a = A.create({}), said = [], look = (r, phase) => a.observe(r, { phase, now: 0 }).forEach(x => said.push(x));
  const r = race(REC); look(r, 'countdown'); look(r, 'running');
  const cs = said.filter(x => x.call === 'weatherconditions');
  ok('the conditions are said at lights out, right after the lights call, with the weather and the words for the numbers (dry: 30 and 24 degrees, 10 kilometres per hour, from the south west)', same(said.slice(0, 2).map(x => x.call), ['lightsout', 'weatherconditions']) && cs.length === 1 && same(cs[0].vars, { ...cs[0].vars, weather: 'dry', tracktemp: '30 degrees', airtemp: '24 degrees', windspeed: '10 kilometres per hour', winddir: 'south west' }) && cs[0].facts.driverId === '');
  ok('...the sentence of the call is filled with them', A.fill(A.CALLS.find(c => c.id === 'weatherconditions').lines[0], cs[0].vars) === 'Track temperature 30 degrees, air temperature 24 degrees, wind 10 kilometres per hour from the south west');
  look(r, 'paused'); look(r, 'running');
  ok('...once in a race: not again when the race is paused and goes on', said.filter(x => x.call === 'weatherconditions').length === 1);
  at(r, 0, 10000); at(r, 1, 10000); look(r, 'running'); at(r, 0, 20000); look(r, 'running');
  const w = said.filter(x => ['weathercloudy', 'weatherconditions'].includes(x.call)).slice(1);
  ok('when the weather changes the new weather is said and then its conditions (cloudy: 25 and 20 degrees, 16 kilometres per hour from the west south west), and the weather call has the words too', same(w.map(x => x.call), ['weathercloudy', 'weatherconditions']) && w.every(x => x.vars.weather === 'cloudy' && x.vars.tracktemp === '25 degrees' && x.vars.airtemp === '20 degrees' && x.vars.windspeed === '16 kilometres per hour' && x.vars.winddir === 'west south west'));
  at(r, 0, 30000); look(r, 'running'); at(r, 0, 40000); at(r, 0, 50000); look(r, 'running'); at(r, 0, 60000); look(r, 'running'); at(r, 0, 70000); at(r, 0, 80000); look(r, 'running');
  const seq = said.filter(x => x.call.startsWith('weather')).map(x => x.call + ':' + x.vars.weather + ':' + x.vars.tracktemp);
  ok('...every change of the weather does so, with the numbers of that weather (wet 17, clearing 21, dry 30 degrees)', same(seq, ['weatherconditions:dry:30 degrees', 'weathercloudy:cloudy:25 degrees', 'weatherconditions:cloudy:25 degrees', 'weatherwet:wet:17 degrees', 'weatherconditions:wet:17 degrees', 'weatherclearing:clearing:21 degrees', 'weatherconditions:clearing:21 degrees', 'weatherdry:dry:30 degrees', 'weatherconditions:dry:30 degrees'])); }
{ const a = A.create({}), said = [], look = (r, phase) => a.observe(r, { phase, now: 0 }).forEach(x => said.push(x.call));
  const r1 = race(REC), r2 = race(REC); look(r1, 'countdown'); look(r1, 'running'); look(r1, 'countdown'); look(r1, 'running');
  ok('...a restart of the same race does not say them again', said.filter(c => c === 'weatherconditions').length === 1);
  look(r2, 'countdown'); look(r2, 'running');
  ok('...but the next race (or heat) does', said.filter(c => c === 'weatherconditions').length === 2); }
{ const a = A.create({}), said = [], look = (r, phase) => a.observe(r, { phase, now: 0 }).forEach(x => said.push(x));
  const r = race({ ...REC, units: 'imperial', trackTempDry: 86, airTempDry: 75, windSpeedDry: 6, windDirDry: 90 }); look(r, 'countdown'); look(r, 'running');
  const c = said.find(x => x.call === 'weatherconditions');
  ok('a weather system in imperial says Fahrenheit-numbers and miles per hour (86 degrees, 6 miles per hour from the east)', c.vars.tracktemp === '86 degrees' && c.vars.windspeed === '6 miles per hour' && c.vars.winddir === 'east'); }
{ const a = A.create({}), said = [], look = (r, phase) => a.observe(r, { phase, now: 0 }).forEach(x => said.push(x.call));
  const r = race(null); look(r, 'countdown'); look(r, 'running'); drive(r, 3); look(r, 'running');
  ok('a race without a weather system does not say the conditions (the lights are still said)', !said.includes('weatherconditions') && said.includes('lightsout')); }
{ const a = A.create({}), said = [], look = (r, phase) => a.observe(r, { phase, now: 0 }).forEach(x => said.push(x.call));
  const r = race(REC); look(r, 'countdown'); look(r, 'running'); look(r, 'review'); const n = said.filter(c => c === 'weatherconditions').length; drive(r, 9); look(r, 'review');
  ok('the conditions call is on in the standard audio set (it can be switched off there), and what happens to the weather after the race is over (in the review) is not said', A.CALLS.find(c => c.id === 'weatherconditions').defaultOn !== false && n === 1 && said.filter(c => c === 'weatherconditions').length === 1); }


// ---- 1.5.0: what the mutation check asked for (the code was broken on purpose; these are the changes the tests above did not notice) ----
{ const c = W.clean({ airTempDry: '80,6', windSpeedCloudy: 12.4, trackTempWet: 60.6, windSpeedWet: 399.6, airTempClearing: -59.6 }).cond;
  ok('the numbers of a record are whole numbers, each of them: the air temperature (80.6 is 81), the wind speed (12.4 is 12; 399.6 is 400), the track temperature (60.6 is 61), the cold (-59.6 is -60)', c.dry.air === 81 && c.cloudy.wind === 12 && c.wet.track === 61 && c.wet.wind === 400 && c.clearing.air === -60 && Number.isInteger(c.dry.track) && Number.isInteger(c.dry.dir)); }
ok('the compass in words and letters goes all the way round (350 degrees and 360 are north; 11.6 degrees is 12, so NNE; a direction of 224.6 is shown as 225)', W.compassWord(350) === 'north' && W.compassWord(360) === 'north' && W.compassWord(359) === 'north' && W.compassWord(337) === 'north north west' && W.compass(11.6) === 'NNE' && W.compass(348) === 'NNW' && W.conditionsFor(W.clean({}), 'dry', { dry: { track: 1, air: 1, wind: 1, dir: 224.6 } }, '').dir === 225 && W.conditionsFor(W.clean({}), 'dry', { dry: { track: 1, air: 1, wind: 1, dir: 224.4 } }, '').dir === 224);
{ const cfg = W.clean(REC), plan = W.plan(cfg, 1), eng = laps => ({ weather: cfg, wxPlan: plan, wxStage: 3, wxState: 'clearing', cars: [{ laps: Array(laps).fill(1) }], status: 'running', elapsed: () => 0 });
  ok('when the rain is clearing the next change is "Dry in 2 laps" (the dry weather is named too)', W.outlook(eng(6), 0).next.text === 'Dry in 2 laps' && W.outlook(eng(7), 0).next.text === 'Dry in 1 lap' && W.outlook(eng(8), 0).next.text === 'Dry now'); }
{ const schema = require('../schema.js'), F = schema.weathersystems.fields, f = k => F.find(x => x.key === k);
  ok('the Weather Systems page: the units and the 16 numbers are in the group Track conditions, the units first, then Dry, Cloudy, Wet and Clearing with the track, the air, the wind speed and the direction', f('units').group === 'conditions' && F.filter(x => x.group === 'conditions').length === 17 && F.filter(x => x.group === 'conditions')[0].key === 'units' && F.filter(x => x.group === 'conditions').map(x => x.key).join() === 'units,' + ['Dry', 'Cloudy', 'Wet', 'Clearing'].flatMap(s => ['trackTemp', 'airTemp', 'windSpeed', 'windDir'].map(b => b + s)).join());
  ok('...the units are metric to start with, a choice of two', f('units').default === 'metric' && f('units').options.map(o => o[0]).join() === 'metric,imperial');
  ok('...every number starts at the standard of its own weather (Dry 30, 24, 10, 225; Wet 17, 15, 22, 270), a wind speed is 0 or more, a direction is 0 to 359, a temperature has no limits on the page', f('trackTempDry').default === 30 && f('airTempDry').default === 24 && f('windSpeedDry').default === 10 && f('windDirDry').default === 225 && f('trackTempWet').default === 17 && f('airTempWet').default === 15 && f('windSpeedWet').default === 22 && f('windDirWet').default === 270 && f('windDirClearing').default === 295
    && ['Dry', 'Cloudy', 'Wet', 'Clearing'].every(s => f('windSpeed' + s).min === 0 && f('windDir' + s).min === 0 && f('windDir' + s).max === 359 && f('windSpeed' + s).max === undefined && f('trackTemp' + s).min === undefined && f('airTemp' + s).type === 'number'));
  ok('...each number is named with its weather (Wet: wind speed; Clearing: wind direction (degrees, where the wind comes from))', f('windSpeedWet').label === 'Wet: wind speed' && f('windDirClearing').label === 'Clearing: wind direction (degrees, where the wind comes from)' && f('trackTempDry').label === 'Dry: track temperature' && f('airTempCloudy').label === 'Cloudy: air temperature');
  const g = schema.weathersystems.groups.find(x => x.id === 'conditions');
  ok('...the group has its title and note, and is closed to start with', g.title === 'Track conditions' && /Track and air temperature, wind speed and direction/.test(g.note) && !g.open && schema.weathersystems.groups[schema.weathersystems.groups.length - 1].id === 'conditions'); }
{ const a = A.create({}), said = [], look = (r, phase) => a.observe(r, { phase, now: 0 }).forEach(x => said.push(x));
  const r = race(REC), seq = () => said.filter(x => x.call === 'weatherconditions').map(x => x.vars.weather + ':' + x.vars.tracktemp);
  look(r, 'countdown'); look(r, 'running'); drive(r, 3); look(r, 'running');
  ok('when two changes of the weather happen between two looks (a slow screen), each is said with the numbers of its own weather', same(seq(), ['dry:30 degrees', 'cloudy:25 degrees', 'wet:17 degrees']) && same(said.filter(x => x.call === 'weathercloudy' || x.call === 'weatherwet').map(x => x.vars.tracktemp), ['25 degrees', '17 degrees'])); }
{ const a = A.create({}), said = [], look = (r, phase) => a.observe(r, { phase, now: 0 }).forEach(x => said.push(x));
  const r = race({ startMode: 'director' }); r.wxSet('cloudy', 0, 'director'); look(r, 'countdown'); look(r, 'running');
  const c = said.find(x => x.call === 'weatherconditions');
  ok('weather that the Race Director sets before the start is not said as a change, but the conditions at lights out are the ones of that weather (cloudy: 25 degrees)', c && c.vars.weather === 'cloudy' && c.vars.tracktemp === '25 degrees' && c.vars.airtemp === '20 degrees' && !said.some(x => x.call === 'weathercloudy') && said.filter(x => x.call === 'weatherconditions').length === 1); }
{ const ids = ['weathercloudy', 'weatherwet', 'weatherclearing', 'weatherdry', 'weatherconditions'], vars = id => A.CALLS.find(c => c.id === id).vars.join();
  ok('all five weather calls have the weather and the four conditions as words for the sentences', ids.every(id => vars(id) === 'weather,tracktemp,airtemp,windspeed,winddir')); }


// ---- what the mutation check asked for (1.4.0: the code was broken on purpose; these are the changes the tests above did not notice) ----
{ const D = W.clean({});
  ok('the standard settings, all of them: random start from lap 5 to 12, random length 4 to 10 laps, a fixed rain of 6 laps from lap 8, new rain not asked for (the same in every heat)', D.start.from === 5 && D.start.to === 12 && D.rain.min === 4 && D.rain.max === 10 && D.rain.for === 6 && D.start.at === 8 && D.cloudy === 2 && D.clearing === 2 && D.seed === 0 && D.same === true);
  ok('...and DEFAULTS (what the Weather Systems page starts from) says: the same in every heat, hindering on with the use and the refuelling, the tank off', W.DEFAULTS.sameInHeats === 'same' && W.DEFAULTS.hinder === 'on' && W.DEFAULTS.hUse === 'on' && W.DEFAULTS.hRate === 'on' && W.DEFAULTS.hTank === 'off' && same(W.clean(W.DEFAULTS), D));
  ok('big numbers: up to 999 laps, up to 1000 minutes (more is cut off); the points for both kinds of tyres up to 100', W.clean({ startAt: 150 }).start.at === 150 && W.clean({ startAt: 5000 }).start.at === 999 && W.clean({ unit: 'time', startAt: 500 }).start.at === 500 && W.clean({ unit: 'time', startAt: 5000 }).start.at === 1000
    && W.clean({ dryPoints: 80 }).dryPoints === 80 && W.clean({ dryPoints: 500 }).dryPoints === 100 && W.clean({ wetPoints: 80 }).wetPoints === 80); }
{ const c9 = W.clean({ startMode: 'random' }, 9), c10 = W.clean({ startMode: 'random' }, 10);
  ok('a seed that is given to the forecast beats the seed of the settings (the heats of a race use one set of settings and one seed each)', !same(W.plan(c9, 10), W.plan(c9, 9)) && same(W.plan(c9, 10), W.plan(c10, 10)) && same(W.plan(c9), W.plan(c9, 9)));
  ok('a rain that lasts less than a lap (or a second) is made one lap (a second long) whatever the settings say', st2(W.plan({ ...W.clean({ cloudyFor: 0, clearingFor: 1 }), rain: { mode: 'fixed', for: 0 } })) === 'wet@8 clearing@9 dry@10' && st2(W.plan({ ...W.clean({ unit: 'time', cloudyFor: 0, clearingFor: 0 }), rain: { mode: 'fixed', for: 0 } })) === 'wet@480000 dry@481000'); }
function st2(p) { return p.stages.map(s => s.state + '@' + s.at).join(' '); }
{ const cfg = { hinder: true, table: { wet: { dry: 95, inter: -5, wet: NaN }, dry: { dry: 'x' } } };
  ok('a number of the table is kept from 0 to 90, even when a table is made by hand (95 is 90, -5 and nonsense are 0)', W.hinderOf(cfg, 'wet', 'S') === 90 && W.hinderOf(cfg, 'wet', 'INT') === 0 && W.hinderOf(cfg, 'wet', 'W') === 0 && W.hinderOf(cfg, 'dry', 'S') === 0 && W.hinderOf({ hinder: true, table: { wet: { dry: 60 } } }, 'wet', 'S') === 60); }
{ const v = W.view({ weather: W.clean({ startMode: 'director' }), cars: [], status: 'running', wxState: 'dry' }, 'running', 0);
  ok('an engine that does not have the forecast (a screen that only follows the race) still knows from the settings that the Race Director decides: the buttons can be pressed', v.mode === 'director' && v.info.includes('The Race Director decides') && v.buttons.every(b => !b.disabled)); }
ok('the mix of the levers: use and refuelling are on unless a lever says false, the tank only when it says true; each part is kept within 90 before they are added up', near(B.mix([[10, {}]]).use, 0.9) && near(B.mix([[10, {}]]).rate, 1.1) && B.mix([[10, {}]]).tank === 1 && near(B.mix([[10, { tank: true }]]).tank, 1.1)
  && near(B.mix([[95, { use: true }], [-10, { use: true }]]).use, 0.2) && near(B.mix([[-95, { rate: true }], [10, { rate: true }]]).rate, 1 - 0.8));
{ const r = E.createRace({ type: 'race', laps: 60, endRule: 'all', entries: entries(2), fuel: fuel(), weather: W.clean({ startMode: 'director' }, 1) });
  ok('the Race Director can set the weather before the start: it is logged at time 0 of the race, whatever the clock says', r.status === 'ready' && r.wxSet('cloudy', 5000, 'director') && same(evs(r, 'weather').map(e => [e.state, e.at, e.by]), [['cloudy', 0, 'director']])); }
{ const r = race({ startMode: 'director', hTank: 'on' }); at(r, 0, 10000); pit(r, 0, 11000); const f0 = r.cars[0].fuel; r.wxSet('wet', 14000, 'director');
  ok('a car that is in the pits when the rain comes keeps the fuel it has (its tank was settled when the stop began); the new tank counts after the stop', r.cars[0].pit && r.cars[0].wx === -25 && r.cars[0].fuel === f0 && f0 > 90); }
{ const r = race(RAIN); at(r, 0, 10000); at(r, 1, 10000); const f = r.factorsOf(0);
  ok('the engine says what the fuel rules do to a car: 25% hindered by the weather is 25% more fuel and 25% slower refuelling; an unhindered car and a car that is not there are as always', near(f.use, 1.25) && near(f.rate, 0.75) && f.tank === 1 && same(race(null).factorsOf(0), { use: 1, rate: 1, tank: 1 }) && same(r.factorsOf(9), { use: 1, rate: 1, tank: 1 })); }

// 1.31.0: the Race Director sets the dry tyre of a car (R.setTyre)
ok('the tyres are Hard, Medium, Soft and Supersoft (dry compounds), Intermediate and Wet', same(W.TYRES.map(t => t.code + ':' + t.cls), ['H:dry', 'M:dry', 'S:dry', 'SS:dry', 'INT:inter', 'W:wet']));
{ const r = race({ startMode: 'director' }, { cars: 4 }); drive(r, 2);
  ok('he gives a car another dry tyre: it is on it now, it is its own tyre, and it is logged as his (tyre, the one it had, the lap, the weather)', r.setTyre(0, 'H', 25000) === true && r.cars[0].tyre === 'H' && r.cars[0].tyreOwn === 'H' && r.cars[0].wxDue === null
    && same(evs(r, 'tyreset').map(e => [e.car, e.tyre, e.was, e.lap, e.state, e.onOwn, e.by, e.t]), [[0, 'H', 'S', 2, 'dry', true, 'director', 25000]]));
  ok('...the other cars keep theirs, and the screens see it (wxOf: tyre and own tyre)', r.cars.map(c => c.tyre).join() === 'H,M,H,W' && r.cars.map(c => c.tyreOwn).join() === 'H,M,H,W' && same(r.wxOf(0), { tyre: 'H', own: 'H', need: '', hinder: 0 }));
  ok('...the same tyre again, a tyre that is not a dry one (Wet, Intermediate, nothing, rubbish) and a car that is not there change nothing and log nothing', r.setTyre(0, 'H', 26000) === false && ['W', 'INT', 'x', '', undefined, null].every(c => r.setTyre(1, c, 26000) === false) && r.setTyre(9, 'S', 26000) === false && r.setTyre(-1, 'S', 26000) === false
    && r.cars[1].tyre === 'M' && evs(r, 'tyreset').length === 1);
  ok('...the code is not case sensitive (it is the same code in a different case)', r.setTyre(1, 's', 27000) === true && r.cars[1].tyre === 'S' && r.cars[1].tyreOwn === 'S');
  ok('the note of the car says what he did: "Hard tyres, set by the Race Director after lap 2"', r.tyreNoteOf(0) === 'Hard tyres, set by the Race Director after lap 2' && r.tyreNoteOf(2) === '');
  ok('without a time the event gets 0 (a lap is the way he sees it)', r.setTyre(2, 'SS') === true && evs(r, 'tyreset').at(-1).t === 0);
  r.stop(300000);
  ok('...but not when the race is over', r.setTyre(0, 'M', 310000) === false && r.cars[0].tyre === 'H'); }
{ const r = race({ startMode: 'director' }, { cars: 3 }); drive(r, 1); r.wxSet('wet', 15000, 'director');
  ok('in the rain a car on dry tyres still has to change to Wet (a dry tyre of another kind does not make it ready)', r.cars[0].wxDue !== null && r.setTyre(0, 'M', 16000) === true && r.cars[0].tyre === 'M' && r.cars[0].wxDue !== null && r.cars[0].wxDue.kind === 'wet');
  pit(r, 0, 17000);
  ok('...the stop gives it Wet', r.cars[0].tyre === 'W' && r.cars[0].tyreOwn === 'M' && r.cars[0].wxDue === null); r.unblock(0, 20000);
  ok('a car that is on Wet tyres gets a new own tyre without changing the tyres it is on (it stays on Wet until it changes)', r.setTyre(0, 'H', 30000) === true && r.cars[0].tyre === 'W' && r.cars[0].tyreOwn === 'H' && evs(r, 'tyreset').at(-1).onOwn === false && evs(r, 'tyreset').at(-1).was === 'M');
  r.wxSet('dry', 31000, 'director');
  ok('...when the track is dry again it has to change back to the new tyre (Hard), and the pit stop gives it', r.cars[0].wxDue !== null && r.cars[0].wxDue.kind === 'dry' && W.view(r, 'running', 31000).rows[0].todo === 'Has to switch back to Hard' && (pit(r, 0, 40000), r.cars[0].tyre === 'H') && r.cars[0].wxDue === null);
  const q = race({ startMode: 'director' }, { cars: 2 }); drive(q, 1); q.wxSet('wet', 15000, 'director'); pit(q, 1, 17000); q.wxSet('dry', 18000, 'director');
  ok('a car on Wet tyres that gets another own tyre is still asked to switch back (to the new one) when the track is dry, and stays on Wet until it stops', q.cars[1].tyre === 'W' && q.cars[1].wxDue !== null && q.setTyre(1, 'SS', 19000) === true && q.cars[1].wxDue !== null && q.cars[1].wxDue.kind === 'dry' && q.cars[1].tyre === 'W'); }
{ const r = race({ startMode: 'director' }, { cars: 4 }); drive(r, 1); r.wxSet('wet', 15000, 'director');
  ok('a car whose own tyre is a Wet one (lane 4) is fine in the rain: nothing to do, not hindered, and the view names its own tyre', r.cars[3].tyre === 'W' && r.cars[3].wxDue === null && r.cars[3].wx === 0 && W.tyreView(r, 'running').rows[3].ownCode === 'W' && r.wxOf(3).need === '');
  ok('...when the Race Director gives it a dry tyre in the rain it is on the wrong tyres: told to change to Wet (with the reaction time of the other cars), and hindered like them', r.setTyre(3, 'S', 16000) === true && r.cars[3].tyre === 'S' && r.cars[3].wxDue !== null && r.cars[3].wxDue.kind === 'wet' && r.cars[3].wxDue.lap === r.cars[0].wxDue.lap && r.cars[3].wx === r.cars[0].wx && r.cars[0].wx < 0 && r.wxOf(3).need === 'wet');
  const due = r.cars[3].wxDue.lap; clock(r)(3, 10000); r.setTyre(3, 'M', 21000);
  ok('...another dry tyre keeps the reaction time it had (the clock does not start again, also when a lap has passed)', r.cars[3].wxDue.lap === due && r.cars[3].laps.length === 2 && r.cars[3].tyre === 'M');
  pit(r, 3, 23000);
  ok('...and the stop gives it Wet, with the dry tyre it was given as its own (it goes back to that one) in the view', r.cars[3].tyre === 'W' && r.cars[3].tyreOwn === 'M' && r.cars[3].wxDue === null && W.tyreView(r, 'running').rows[3].ownCode === 'M' && W.tyreView(r, 'running').rows[3].ownName === 'Medium' && W.tyreView(r, 'running').rows[3].code === 'W' && W.tyreView(r, 'running').rows[3].tyre === 'Wet'); }
{ const r = race({ startMode: 'director' }, { cars: 2, noFuel: true }); drive(r, 1);
  ok('it works without fuel rules too (the tyres and the penalty points need no fuel)', r.setTyre(1, 'SS', 15000) === true && r.cars[1].tyre === 'SS'); }
{ const mk = () => E.createRace({ type: 'race', laps: 60, endRule: 'all', entries: entries(2), fuel: fuel(), weather: W.clean({ startMode: 'director' }) }), r = mk(); r.start(0); drive(r, 2); r.setTyre(1, 'H', 25000);
  const snap = r.snapshot(26000), q = mk(); q.start(0);
  ok('a race that is continued after a crash has the tyres the Race Director gave (and the note of it)', q.restore(snap) === true && q.cars[1].tyre === 'H' && q.cars[1].tyreOwn === 'H' && q.cars[0].tyreOwn === 'S' && q.tyreNoteOf(1) === 'Hard tyres, set by the Race Director after lap 2'); }
{ const r = race({ startMode: 'director' }, { cars: 2 }), v = ph => W.tyreView(r, ph);
  ok('the Tyre Change rows: every row says the tyres the car is on (code, name, colour) and its own tyre (the code, not its name), so a selection can show it', same(v('running').rows.map(x => x.ownCode), ['S', 'M']) && (r.setTyre(0, 'SS', 1000), v('running').rows[0].ownCode === 'SS') && v('running').rows[0].ownName === 'Supersoft' && v('running').rows[0].code === 'SS' && v('running').rows[0].color === '#9b4dff' && v('running').rows[0].who === 'D0');
  ok('...a car with no tyre choice is on the Medium, and a lane without a driver is named by its number', (x => x.rows[0].ownCode === 'M' && x.rows[0].code === 'M' && x.rows[0].who === 'Lane 1')(W.tyreView(E.createRace({ type: 'race', laps: 5, entries: [{ lane: 0 }] }), 'running')));
  ok('...the tyre can be changed while the race is open (before the start, running, paused, between heats) and not when it is over or in the review', ['ready', 'countdown', 'running', 'paused', 'between'].every(p => v(p).open === true) && ['finished', 'review', 'setup', ''].every(p => v(p).open === false));
  ok('...also when the forecast decides (the weather buttons are off, the tyre choice is not), and the view says the race has weather', (q => { const x = W.tyreView(q, 'running'); return x.open === true && x.weather === true && x.on === true && W.view(q, 'running', 0).buttons.every(b => b.disabled); })(race(REC)));
  ok('...a race without weather has the rows too, and the view says so (all six tyres can be chosen there)', (q => { const x = W.tyreView(q, 'running'); return x.on === true && x.weather === false && x.open === true && x.rows.length === 3; })(race(null, { cars: 3 })));
  ok('...only the lanes that are asked for are listed; with no engine, or one without cars, there is nothing', same(W.tyreView(race(null, { cars: 4 }), 'running', [1, 3]).rows.map(x => x.lane), [1, 3]) && W.tyreView(null, 'running').on === false && W.tyreView({}, 'running').on === false && W.tyreView(undefined, 'running').rows.length === 0);
  r.stop(5000); ok('...and not in a race that has finished', W.tyreView(r, 'running').open === false && W.tyreView(r, 'running').on === true); }
// 1.32.0: a race without weather: the Race Director can give a car another tyre there too (and every tyre can be chosen)
{ const r = race(null, { cars: 4 }); drive(r, 2);
  ok('in a race without weather he gives a car another tyre: it is on it now, it is its own tyre, and it is logged as his', r.setTyre(0, 'H', 25000) === true && r.cars[0].tyre === 'H' && r.cars[0].tyreOwn === 'H' && r.cars[0].wxDue === null && r.cars[0].wx === 0
    && same(evs(r, 'tyreset').map(e => [e.car, e.tyre, e.was, e.lap, e.onOwn, e.by, e.t]), [[0, 'H', 'S', 2, true, 'director', 25000]]));
  ok('...the same tyre again, a tyre that does not exist and a car that is not there change nothing and log nothing', r.setTyre(0, 'H', 26000) === false && ['x', '', undefined, null, 5].every(c => r.setTyre(1, c, 26000) === false) && r.setTyre(9, 'S', 26000) === false && r.setTyre(-1, 'S', 26000) === false && r.cars[1].tyre === 'M' && evs(r, 'tyreset').length === 1);
  ok('...there is no weather to decide: Intermediate and Wet can be given as well (the cars are on them, no penalty, no hindrance)', r.setTyre(1, 'INT', 27000) === true && r.cars[1].tyre === 'INT' && r.setTyre(2, 'W', 27500) === true && r.cars[2].tyre === 'W' && r.setTyre(2, 'w', 28000) === false && r.cars.every(c => c.wxDue === null && c.wx === 0) && r.wxOf(2).need === '');
  ok('...the note of the car says what he did, in order', r.tyreNoteOf(0) === 'Hard tyres, set by the Race Director after lap 2' && r.tyreNoteOf(1) === 'Intermediate tyres, set by the Race Director after lap 2' && r.tyreNoteOf(3) === '');
  const snap = r.snapshot(29000), q = race(null, { cars: 4 });
  ok('a race that is continued after a crash has the tyres the Race Director gave', q.restore(snap) === true && q.cars.map(c => c.tyre).join() === 'H,INT,W,W' && q.cars.map(c => c.tyreOwn).join() === 'H,INT,W,W' && q.tyreNoteOf(0) === 'Hard tyres, set by the Race Director after lap 2');
  r.stop(300000);
  ok('...but not when the race is over', r.setTyre(3, 'S', 310000) === false && r.cars[3].tyre === 'W'); }
{ const r = race(null, { cars: 2, noFuel: true, noPenalty: true }); drive(r, 1);
  ok('it works without fuel and penalty rules too, in a practice and a timed race', r.setTyre(1, 'SS', 15000) === true && r.cars[1].tyre === 'SS' && race(null, { cars: 2, type: 'practice' }).setTyre(0, 'S', 1) === false && race(null, { cars: 2, type: 'practice' }).setTyre(0, 'SS', 1) === true && race(null, { cars: 2, type: 'timed' }).setTyre(1, 'S', 1) === true); }
ok('the words for the tyre the Race Director set, and the other things the tyres did, in the order they happened', W.noteOf([{ type: 'tyres', car: 0, tyre: 'W', lap: 9 }, { type: 'tyreset', car: 0, tyre: 'SS', lap: 12 }, { type: 'tyreset', car: 1, tyre: 'H', lap: 3 }, { type: 'tyredue', car: 0, points: 2, lap: 14 }], 0) === 'Wet tyres after lap 9, Supersoft tyres, set by the Race Director after lap 12, 2 penalty points for the tyres after lap 14');
ok('...a tyre given before the car has driven a lap says so (not "after lap 0")', W.noteOf([{ type: 'tyreset', car: 0, tyre: 'H', lap: 0 }], 0) === 'Hard tyres, set by the Race Director before the first lap' && W.noteOf([{ type: 'tyreset', car: 0, tyre: 'H' }], 0) === 'Hard tyres, set by the Race Director before the first lap');

{ const people = [0, 1].map(i => ({ driverId: 'd' + i, carId: 'c' + i, driverName: 'D' + i, carName: 'car', tyre: 'S' })); // a heat race builds the cars of every heat from the participants: a tyre saved on the participant is the tyre of the next heat
  const H = E.createHeatRace({ participants: people, schedule: [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }], [{ p: 0, lane: 0 }, { p: 1, lane: 1 }]], resultBy: 'laps', points: [] });
  const first = H.entries().map(e => e.tyre).join(); people[0].tyre = 'H';
  ok('the cars of the next heat start from the tyre that was kept on the participant (the Race Director also changed the Database)', first === 'S,S' && H.entries().map(e => e.tyre).join() === 'H,S'); }

if (fails) { console.log(fails + ' FAILED'); process.exit(1); }
console.log('ALL WEATHER TESTS PASSED');
