// 1.3.0: Balance of Power. The pure part (bop.js): settings, the factors, the pace of a car, who gets how much, the words;
// and what the engine does with it: fuel use per lap, refuelling speed and tank size per car, the three modes, the Race Director's buttons, the race log.
const B = require('../renderer/bop.js'), E = require('../renderer/engine.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const near = (a, b, d = 1e-6) => Math.abs(a - b) < d;

// ---- the settings ----
{ const D = B.settingsOf({});
  ok('the standard settings: manual, fastest and slowest, 20%, median of the last 5 laps, from 0.3 s, fuel use and refuelling on, tank off', same(D, { mode: 'manual', who: 'both', grade: 'extremes', percent: 20, scale: 'fixed', full: 1, measure: 'median', window: 5, minLaps: 3, apply: 0.3, remove: 0.15, lanes: true, use: true, rate: true, tank: false }));
  ok('nothing, or not an object, gives the standard settings', same(B.settingsOf(), D) && same(B.settingsOf(null), D) && same(B.clean(), D) && same(B.clean(undefined), D));
  ok('the settings of the page have their own keys (bopMode, bopWho...) and travel as they are', same(B.settingsOf({ bopMode: 'auto', bopWho: 'hinder', bopGrade: 'graded', bopPercent: 35, bopScale: 'scaled', bopFull: 2, bopMeasure: 'average', bopWindow: 8, bopMinLaps: 4, bopApply: 0.5, bopRemove: 0.1, bopLanes: false, bopUse: false, bopRate: false, bopTank: true }),
    { mode: 'auto', who: 'hinder', grade: 'graded', percent: 35, scale: 'scaled', full: 2, measure: 'average', window: 8, minLaps: 4, apply: 0.5, remove: 0.1, lanes: false, use: false, rate: false, tank: true }));
  ok('every setting has a key on the page, and the standard settings are written with those keys', same(Object.keys(B.KEYS).sort(), Object.keys(D).sort()) && same(B.settingsOf(B.standardSettings()), D) && Object.values(B.KEYS).every(k => /^bop[A-Z]/.test(k)));
  ok('something that is not one of the choices becomes the standard choice', B.settingsOf({ bopMode: 'x', bopWho: 5, bopGrade: null, bopScale: {}, bopMeasure: 'mean' }).mode === 'manual' && B.settingsOf({ bopWho: 5 }).who === 'both' && B.settingsOf({ bopGrade: null }).grade === 'extremes' && B.settingsOf({ bopScale: {} }).scale === 'fixed' && B.settingsOf({ bopMeasure: 'mean' }).measure === 'median');
  ok('the percentage is a whole number from 1 to 90 (the most a car can get)', B.settingsOf({ bopPercent: 0 }).percent === 1 && B.settingsOf({ bopPercent: 95 }).percent === 90 && B.settingsOf({ bopPercent: 12.6 }).percent === 13 && B.settingsOf({ bopPercent: -5 }).percent === 1 && B.MAXP === 90);
  ok('...text from a field is understood (also with a decimal comma), nonsense is the standard', B.settingsOf({ bopPercent: '35' }).percent === 35 && B.settingsOf({ bopApply: '0,4' }).apply === 0.4 && B.settingsOf({ bopPercent: 'many' }).percent === 20 && B.settingsOf({ bopPercent: '' }).percent === 20 && B.settingsOf({ bopPercent: NaN }).percent === 20 && B.settingsOf({ bopPercent: Infinity }).percent === 20);
  ok('the difference that switches it on is 0.01 to 600 seconds, the full strength comes at 0.1 to 600', B.settingsOf({ bopApply: 0 }).apply === 0.01 && B.settingsOf({ bopApply: 9999 }).apply === 600 && B.settingsOf({ bopFull: 0 }).full === 0.1 && B.settingsOf({ bopFull: 9999 }).full === 600);
  ok('the window is 3 to 50 laps, and the laps it waits for are 1 to the window (never more laps than there are in the window)', B.settingsOf({ bopWindow: 1 }).window === 3 && B.settingsOf({ bopWindow: 99 }).window === 50 && B.settingsOf({ bopWindow: 4.4 }).window === 4 && B.settingsOf({ bopMinLaps: 0 }).minLaps === 1 && B.settingsOf({ bopWindow: 4, bopMinLaps: 20 }).minLaps === 4 && B.settingsOf({ bopMinLaps: 9 }).minLaps === 5);
  ok('it goes off at half of the difference that switches it on, unless it is set; it can never be more than that difference', B.settingsOf({ bopApply: 1 }).remove === 0.5 && B.settingsOf({ bopApply: 1, bopRemove: '' }).remove === 0.5 && B.settingsOf({ bopApply: 1, bopRemove: 0.2 }).remove === 0.2 && B.settingsOf({ bopApply: 1, bopRemove: 5 }).remove === 1 && B.settingsOf({ bopApply: 1, bopRemove: -1 }).remove === 0 && B.settingsOf({ bopApply: 1, bopRemove: 0 }).remove === 0 && B.settingsOf({ bopApply: 1, bopRemove: null }).remove === 0.5);
  ok('the switches (lanes, fuel use, refuelling, tank) are true or false; text and numbers 1 and 0 are understood, anything else is the standard', B.settingsOf({ bopUse: 'false' }).use === false && B.settingsOf({ bopUse: 0 }).use === false && B.settingsOf({ bopTank: 'true' }).tank === true && B.settingsOf({ bopTank: 1 }).tank === true && B.settingsOf({ bopRate: 'maybe' }).rate === true && B.settingsOf({ bopTank: 'maybe' }).tank === false && B.settingsOf({ bopLanes: undefined }).lanes === true);
  ok('lane factors are kept when they are numbers above zero (anything else counts as 1)', same(B.clean({ laneFactors: [1.1, 0, 'x', -2, 0.9, Infinity] }).laneFactors, [1.1, 1, 1, 1, 0.9, 1]) && B.clean({ laneFactors: 'x' }).laneFactors === undefined && B.clean({}).laneFactors === undefined);
  ok('the lists of choices are there for the page (each has a standard)', [B.MODES, B.WHO, B.GRADE, B.SCALE, B.MEASURE].every(l => l.length >= 2 && l.every(x => x.length === 2)) && B.MODES[0][0] === 'manual' && B.WHO[0][0] === 'both' && B.GRADE[0][0] === 'extremes' && B.SCALE[0][0] === 'fixed' && B.MEASURE[0][0] === 'median'); }

// ---- the lengths of the lanes ----
{ const c = B.engineConfig({}, [10, 12, 14]);
  ok('lane factors: the length of every lane compared with the average (10, 12, 14 m: 0.833, 1, 1.167)', c.laneFactors.length === 3 && near(c.laneFactors[0], 10 / 12, 1e-5) && near(c.laneFactors[1], 1, 1e-5) && near(c.laneFactors[2], 14 / 12, 1e-5));
  ok('...none when the lanes are not to be corrected for, when there are no lengths, or when one is missing or wrong', B.engineConfig({ bopLanes: false }, [10, 12]).laneFactors === undefined && B.engineConfig({}, []).laneFactors === undefined && B.engineConfig({}).laneFactors === undefined && B.engineConfig({}, [10, 0]).laneFactors === undefined && B.engineConfig({}, [10]).laneFactors === undefined && B.engineConfig({}, [10, 'x']).laneFactors === undefined && B.engineConfig({}, 'x').laneFactors === undefined);
  ok('...and the rest of the settings are the settings', B.engineConfig({ bopPercent: 40 }, [10, 12]).percent === 40 && B.engineConfig({ bopMode: 'auto' }).mode === 'auto'); }

// ---- the fuel factors ----
{ const f = (p, c) => B.factors(p, c), S = B.settingsOf({});
  ok('hindered by 20%: 20% more fuel per lap, 20% slower refuelling, the tank stays (the tank is off)', same(f(-20, S), { use: 1.2, rate: 0.8, tank: 1 }));
  ok('helped by 20%: 20% less fuel per lap, 20% faster refuelling', near(f(20, S).use, 0.8) && near(f(20, S).rate, 1.2) && f(20, S).tank === 1);
  ok('with the tank switched on a hindered car has a smaller tank and a helped car a bigger one', near(f(-30, { ...S, tank: true }).tank, 0.7) && near(f(30, { ...S, tank: true }).tank, 1.3));
  ok('every one of the three can be switched off', f(-20, { ...S, use: false }).use === 1 && f(-20, { ...S, rate: false }).rate === 1 && f(-20, { ...S, use: false }).rate === 0.8 && f(20, { ...S, use: false, rate: false, tank: false }).use === 1 && f(20, { ...S, tank: true, rate: false }).tank === 1.2);
  ok('0, nothing and nonsense change nothing', same(f(0, S), { use: 1, rate: 1, tank: 1 }) && same(f(undefined, S), { use: 1, rate: 1, tank: 1 }) && same(f(NaN, S), { use: 1, rate: 1, tank: 1 }) && same(f('x', S), { use: 1, rate: 1, tank: 1 }));
  ok('a car never gets more than 90%, in either direction', near(f(-500, S).use, 1.9) && near(f(-500, S).rate, 0.1) && near(f(500, S).use, 0.1) && near(f(500, S).rate, 1.9) && f(-500, S).use === f(-90, S).use);
  ok('a text percentage is understood, and settings that are missing mean the standard (use and rate on, tank off)', near(f('-20', S).use, 1.2) && near(f(-20).use, 1.2) && near(f(-20).rate, 0.8) && f(-20).tank === 1 && f(-20, {}).tank === 1 && f(-20, null).use === 1.2); }

// ---- the pace of a car ----
{ const S = B.settingsOf({}), car = (laps, x = {}) => ({ laps, bad: [], invalid: [], removed: [], pitLaps: [], ...x });
  ok('the median of the last 5 laps: 10.0 10.2 10.1 9.9 10.4 is 10.1', B.paceOf(car([10000, 10200, 10100, 9900, 10400]), S) === 10100);
  ok('...with an even number of laps (window 4) it is the middle of the two in the middle', B.paceOf(car([10000, 10200, 10100, 9900]), { ...S, window: 4 }) === 10050);
  ok('...the average, when that is chosen', B.paceOf(car([10000, 10200, 10100, 9900, 10400]), { ...S, measure: 'average' }) === 10120);
  ok('one slow lap hardly counts in the median, and counts in the average (10, 10, 10, 10, 20)', B.paceOf(car([10000, 10000, 10000, 10000, 20000]), S) === 10000 && B.paceOf(car([10000, 10000, 10000, 10000, 20000]), { ...S, measure: 'average' }) === 12000);
  ok('only the last laps of the window count (7 laps, window 3: the last 3)', B.paceOf(car([30000, 30000, 30000, 30000, 10000, 10000, 10000]), { ...S, window: 3 }) === 10000 && B.paceOf(car([30000, 30000, 10000, 10000, 10000]), { ...S, window: 3 }) === 10000 && B.paceOf(car([20000, 10000, 10000, 10000]), { ...S, window: 3, measure: 'average' }) === 10000);
  ok('fewer laps than it waits for: no pace yet (2 of 3, none)', B.paceOf(car([10000, 10000]), S) === null && B.paceOf(car([]), S) === null && B.paceOf(car([10000, 10000, 10000]), S) === 10000 && B.paceOf(car([10000, 10000, 10000]), { ...S, minLaps: 4 }) === null);
  ok('a lap that is too slow, invalid, taken out or with a pit stop does not count (it is skipped, the laps before it count)', B.paceOf(car([10000, 10000, 99000, 10000, 10000], { bad: [false, false, true] }), S) === 10000 && B.paceOf(car([10000, 10000, 99000, 10000, 10000], { invalid: [2] }), S) === 10000 && B.paceOf(car([10000, 10000, 99000, 10000, 10000], { removed: [2] }), S) === 10000 && B.paceOf(car([10000, 10000, 99000, 10000, 10000], { pitLaps: [2] }), S) === 10000);
  ok('...and they are not counted as laps that are missing: 4 good laps and one bad with minimum 5 is no pace, with minimum 4 it is', B.paceOf(car([10000, 10000, 99000, 10000, 10000], { invalid: [2] }), { ...S, minLaps: 5 }) === null && B.paceOf(car([10000, 10000, 99000, 10000, 10000], { invalid: [2] }), { ...S, minLaps: 4 }) === 10000);
  ok('a lap that is not a number is skipped', B.paceOf(car([10000, NaN, 10000, 10000, null]), { ...S, minLaps: 3 }) === 10000 && B.paceOf(car([10000, NaN, 10000, null]), S) === null);
  ok('a car of a longer lane is compared with the others by its lane: 11 s on a lane 10% longer is 10 s', near(B.paceOf(car([11000, 11000, 11000]), S, 1.1), 10000) && B.paceOf(car([10000, 10000, 10000]), S, 1) === 10000 && B.paceOf(car([10000, 10000, 10000]), S, 0) === 10000 && B.paceOf(car([10000, 10000, 10000]), S, undefined) === 10000 && B.paceOf(car([10000, 10000, 10000]), S, -2) === 10000);
  ok('a car without the lists (a car of an older message) has no laps and no pace', B.paceOf({}, S) === null && B.paceOf(null, S) === null && B.paceOf({ laps: [10000, 10000, 10000] }, S) === 10000); }

// ---- who gets how much ----
{ const S = B.settingsOf({}), pl = (p, c = {}, w = false) => B.plan(p, { ...S, ...c }, w);
  ok('with fewer than two cars with a pace there is nobody to compare: nothing', same(pl([10000]).pct, [0]) && pl([10000]).active === false && pl([null, 10000, null]).active === false && same(pl([]).pct, []) && pl([null, null]).spread === 0);
  ok('two cars: the fast one is hindered by the percentage (negative), the slow one helped (positive)', same(pl([10000, 14500]).pct, [-20, 20]) && pl([10000, 14500]).active === true && pl([10000, 14500]).spread === 4.5 && pl([10000, 14500]).percent === 20);
  ok('...whichever lane is the fast one', same(pl([14500, 10000]).pct, [20, -20]));
  ok('below the difference that switches it on nothing happens; at it, it does (0.3 s)', same(pl([10000, 10299]).pct, [0, 0]) && pl([10000, 10299]).active === false && same(pl([10000, 10300]).pct, [-20, 20]) && pl([10000, 10300]).active === true);
  ok('it stays on until the difference is below the lower value: 0.2 s with it on stays on, with it off it does not come on; 0.1 s goes off', pl([10000, 10200], {}, true).active === true && pl([10000, 10200], {}, false).active === false && pl([10000, 10150], {}, true).active === true && pl([10000, 10149], {}, true).active === false && same(pl([10000, 10100], {}, true).pct, [0, 0]));
  ok('with "off at" as high as "on at" it is the same limit both ways', pl([10000, 10200], { apply: 0.3, remove: 0.3 }, true).active === false && pl([10000, 10300], { apply: 0.3, remove: 0.3 }, true).active === true);
  ok('the same pace is no difference, even when it should go off at 0', pl([10000, 10000], { apply: 0.01, remove: 0 }, true).active === false && same(pl([10000, 10000], { apply: 0.01, remove: 0 }, true).pct, [0, 0]) && pl([10000, 10000], { apply: 0.01, remove: 0 }, true).spread === 0);
  ok('only the fastest and the slowest car get it, the cars in between nothing (extremes)', same(pl([10000, 12000, 14000, 12500]).pct, [-20, 0, 20, 0]));
  ok('cars with no pace take no part: a null in the middle is skipped, and does not count as the fastest', same(pl([10000, null, 14000]).pct, [-20, 0, 20]) && same(pl([null, 12000, 14000, null]).pct, [0, -20, 20, 0]));
  ok('two cars that are as fast as each other and the fastest are both hindered', same(pl([10000, 10000, 14000]).pct, [-20, -20, 20]) && same(pl([10000, 14000, 14000]).pct, [-20, 20, 20]));
  ok('only hinder: the slowest gets nothing; only help: the fastest gets nothing', same(pl([10000, 14000], { who: 'hinder' }).pct, [-20, 0]) && same(pl([10000, 14000], { who: 'help' }).pct, [0, 20]) && same(pl([10000, 12000, 14000], { who: 'hinder', grade: 'graded' }).pct, [-20, 0, 0]) && same(pl([10000, 12000, 14000], { who: 'help', grade: 'graded' }).pct, [0, 0, 20]));
  ok('every car, by how far from the middle: 10 12 14 is -P 0 +P, and 10 11 14 gives the 11 car half of the hindrance (the middle is 12)', same(pl([10000, 12000, 14000], { grade: 'graded' }).pct, [-20, 0, 20]) && same(pl([10000, 11000, 14000], { grade: 'graded' }).pct, [-20, -10, 20]) && same(pl([10000, 13000, 14000], { grade: 'graded' }).pct, [-20, 10, 20]));
  ok('...graded with two cars is the same as the extremes', same(pl([10000, 14500], { grade: 'graded' }).pct, [-20, 20]) && same(pl([14500, 10000], { grade: 'graded' }).pct, [20, -20]));
  ok('...a car with no pace has no place in the middle: 10, null, 14 and 12 (the middle stays 12)', same(pl([10000, null, 14000, 12000], { grade: 'graded' }).pct, [-20, 0, 20, 0]));
  ok('the percentage is the one that is set: 35', same(pl([10000, 14000], { percent: 35 }).pct, [-35, 35]) && pl([10000, 14000], { percent: 35 }).percent === 35);
  ok('scaled: the strength grows with the difference up to the full strength at "full" (1 s): 0.5 s gives half, 1 s and more give all', same(pl([10000, 10500], { scale: 'scaled' }).pct, [-10, 10]) && pl([10000, 10500], { scale: 'scaled' }).percent === 10 && same(pl([10000, 11000], { scale: 'scaled' }).pct, [-20, 20]) && same(pl([10000, 15000], { scale: 'scaled' }).pct, [-20, 20]) && same(pl([10000, 10500], { scale: 'scaled', full: 2 }).pct, [-5, 5]));
  ok('...a strength that rounds to nothing is nothing, but it is still on (the cars are looked at again after the next lap)', same(pl([10000, 10300], { scale: 'scaled', full: 100 }).pct, [0, 0]) && pl([10000, 10300], { scale: 'scaled', full: 100 }).active === true);
  ok('percentages are whole numbers and never -0', same(pl([10000, 10400], { scale: 'scaled', percent: 33 }).pct, [-13, 13]) && pl([10000, 14000], { who: 'help' }).pct.every(v => !Object.is(v, -0)) && pl([10000, 14000], { who: 'hinder' }).pct.every(v => !Object.is(v, -0)) && pl([10000, 12000, 14000], { grade: 'graded' }).pct.every(v => !Object.is(v, -0)));
  ok('the plan does not change what it is given', (() => { const p = [10000, 14000, null]; B.plan(p, S, false); return same(p, [10000, 14000, null]); })()); }

// ---- the words ----
ok('signed percentages with a real minus sign', B.signed(-20) === '−20%' && B.signed(10) === '+10%' && B.signed(0) === '0%' && B.signed(undefined) === '0%' && B.signed('-5') === '−5%');
ok('hindered, helped or off', B.kindOf(-1) === 'hindered' && B.kindOf(1) === 'helped' && B.kindOf(0) === 'off' && B.kindOf(null) === 'off' && B.kindOf('-3') === 'hindered');
ok('the short text for a widget: an arrow down for hindered, up for helped', B.shortText(-20) === 'BoP ▼ −20%' && B.shortText(10) === 'BoP ▲ +10%' && B.shortText(0) === 'BoP off' && B.shortText(undefined) === 'BoP off');
{ const ev = [{ type: 'bopon', car: 0, pct: -20, lap: 0 }, { type: 'bopchange', car: 1, pct: 5, lap: 2 }, { type: 'bopoff', car: 0, lap: 12 }, { type: 'bopon', car: 0, pct: 10, lap: 13 }, { type: 'pitstart', car: 0, lap: 5 }, { type: 'bopchange', car: 0, pct: 15, lap: 20 }, null, { type: 'bopon', car: 0, pct: 0, lap: 30 }];
  ok('the periods of a car: from the lap after the event, until the lap it was taken off (a change ends one period and starts the next; the other cars and other events do not count)',
    same(B.periodsOf(ev, 0), [{ pct: -20, from: 1, to: 12 }, { pct: 10, from: 14, to: 20 }, { pct: 15, from: 21, to: 30 }]) && same(B.periodsOf(ev, 1), [{ pct: 5, from: 3, to: null }]) && same(B.periodsOf(ev, 2), []) && same(B.periodsOf(null, 0), []));
  ok('a period that ended before the first lap it applied to is dropped (on and off with no lap in between)', same(B.periodsOf([{ type: 'bopon', car: 0, pct: -20, lap: 4 }, { type: 'bopoff', car: 0, lap: 4 }], 0), []) && same(B.periodsOf([{ type: 'bopon', car: 0, pct: -20, lap: 4 }, { type: 'bopoff', car: 0, lap: 5 }], 0), [{ pct: -20, from: 5, to: 5 }]));
  ok('a bopon without a percentage starts nothing', same(B.periodsOf([{ type: 'bopon', car: 0, lap: 1 }], 0), []));
  ok('in words: from the start, laps from and to, one lap, still on', B.noteOf(B.periodsOf(ev, 0)) === 'hindered 20% (from the start to lap 12), helped 10% (laps 14 to 20), helped 15% (laps 21 to 30)' && B.noteOf([{ pct: 10, from: 7, to: null }]) === 'helped 10% (from lap 7)' && B.noteOf([{ pct: -5, from: 1, to: null }]) === 'hindered 5% (from the start)' && B.noteOf([{ pct: -5, from: 7, to: 7 }]) === 'hindered 5% (lap 7)' && B.noteOf([]) === '' && B.noteOf(undefined) === ''); }

// ---- the engine ----
const fuel = (x = {}) => ({ on: true, tank: 100, perLap: 2, rate: 10, target: 0, extra: 0, saving: 0, empty: 'retire', pitHold: 2000, ...x });
const entries = n => Array.from({ length: n }, (_, i) => ({ lane: i, driverId: 'd' + i, carId: 'c' + i, driverName: 'D' + i, carName: 'car' + i }));
const race = (bop, o = {}) => { const r = E.createRace({ type: 'race', laps: 40, endRule: 'all', entries: entries(o.cars || 2), fuel: fuel(o.fuel), bop: bop === null ? undefined : { mode: 'manual', ...(bop || {}) }, ...(o.cfg || {}) }); r.start(0); return r; };
const clocks = new WeakMap(), clock = r => { if (!clocks.has(r)) { const t = r.cars.map(() => 0); clocks.set(r, (i, ms) => { t[i] += ms; return r.cross(i, t[i]); }); } return clocks.get(r); }; // (one clock for each car of a race, which goes on where it was)

ok('without Balance of Power in the setup nothing is there: no settings, no changes, no tank change', (() => { const r = race(null); return r.bop === null && r.bopSet(0, -20, 0) === false && r.cars[0].bop === 0 && r.tankOf(0) === 100 && r.bopPress(0, 'hinder', 0) === false; })());
ok('...it needs fuel (the percentages work through the fuel rules)', (() => { const r = race({}, { fuel: { on: false } }); return r.bop === null && r.bopSet(0, -20, 0) === false; })());
ok('...and a race or a timed race (not practice or qualifying)', ['practice', 'qualifying'].every(type => E.createRace({ type, duration: 10, entries: entries(2), fuel: fuel(), bop: { mode: 'auto' } }).bop === null) && ['race', 'timed'].every(type => E.createRace({ type, laps: 5, duration: 10, entries: entries(2), fuel: fuel(), bop: { mode: 'auto' } }).bop !== null));
ok('...the settings it was given are cleaned (nonsense becomes the standard)', (() => { const r = race({ mode: 'x', percent: 500, apply: 'no' }); return r.bop.mode === 'manual' && r.bop.percent === 90 && r.bop.apply === 0.3; })());
ok('cars start with no Balance of Power, no hold, no suggestion', (() => { const r = race({}); return r.cars.every(c => c.bop === 0 && c.bopHold === false && c.bopTo === null) && r.bopActive === false && r.bopSpread === 0; })());

// fuel use per lap
{ const r = race({}), go = clock(r);
  ok('hindered by 20%: a lap uses 2.4 litres instead of 2 (the car next to it still uses 2)', r.bopSet(0, -20, 0, 'director') === true && (go(0, 10000), go(1, 10000), true) && near(r.cars[0].fuel, 97.6) && near(r.cars[1].fuel, 98));
  ok('helped by 25%: a lap uses 1.5 litres', r.bopSet(1, 25, 0) === true && (go(1, 10000), true) && near(r.cars[1].fuel, 96.5));
  ok('the use per lap that changes with the lap time (target time) is changed by the same percentage', (() => { const q = race({}, { fuel: { target: 10000, extra: 0.25, saving: 0.3 } }), g = clock(q); q.bopSet(0, -20, 0); g(0, 8000); g(1, 8000); return near(q.cars[0].fuel, 100 - 2.5 * 1.2) && near(q.cars[1].fuel, 100 - 2.5); })());
  ok('with fuel use switched off for Balance of Power a lap costs what it always did', (() => { const q = race({ use: false }), g = clock(q); q.bopSet(0, -20, 0); g(0, 10000); return near(q.cars[0].fuel, 98); })());
  ok('a car that is hindered runs out of fuel sooner: 2.4 litres a lap on a 100 litre tank is 41 laps, not 50', (() => { const q = race({}, { fuel: { tank: 100 }, cfg: { laps: 200 } }), g = clock(q); q.bopSet(0, -20, 0); let n = 0; while (q.cars[0].fuel >= 2.4 - 1e-9 && n < 100) { g(0, 5000); n++; } return n === 41 && !q.cars[0].outOfFuel; })()); }

// a car that has it before the start
{ const r = E.createRace({ type: 'race', laps: 5, endRule: 'all', entries: entries(2), fuel: fuel(), bop: { mode: 'manual', tank: true } });
  r.bopSet(0, -20, 0); r.bopSet(1, 25, 0); r.start(1000);
  ok('a car that had Balance of Power before the start begins with a full tank of its own size (80 and 125 litres; a car with none 100)', r.cars[0].fuel === 80 && r.cars[1].fuel === 125 && race({ tank: true }).cars[0].fuel === 100 && E.createRace({ type: 'race', laps: 5, endRule: 'all', entries: entries(1), fuel: fuel() }).cars[0].fuel === 100); }

// refuelling speed and tank
{ const r = race({ tank: true }, { fuel: { tank: 100, rate: 10 } }), go = clock(r);
  r.bopSet(0, -20, 0);
  ok('the tank is smaller with the tank switched on (80 litres), and a car that is full keeps only what fits', r.tankOf(0) === 80 && r.tankOf(1) === 100 && r.cars[0].fuel === 80 && r.cars[1].fuel === 100 && r.tankOf(7) === 100);
  go(0, 10000);
  r.block(0, 20000); r.tick(22000);
  ok('a pit stop of a hindered car refuels slower (8 litres a second) and up to the smaller tank, fixed when the stop starts', r.cars[0].pit.rate === 8 && r.cars[0].pit.tank === 80 && r.cars[0].pit.fuel0 === r.cars[0].fuel);
  const f0 = r.cars[0].fuel; r.bopSet(0, 50, 22500); // a change during the stop does not change this stop
  ok('...and a change of the percentage during the stop does not change that stop', r.cars[0].pit.rate === 8 && near(r.fuelOf(0, 24000), Math.min(80, f0 + 8 * 2)));
  r.unblock(0, 40000);
  ok('...the stop ends with the fuel of this stop, no more than the smaller tank held (80)', r.cars[0].fuel === 80 && r.cars[0].lastPit.refuelled > 0 && near(r.cars[0].lastPit.refuelled, 80 - f0));
  ok('a helped car refuels faster and has a bigger tank', (() => { const q = race({ tank: true }), g = clock(q); q.bopSet(1, 25, 0); g(1, 10000); q.block(1, 20000); q.tick(22000); return q.tankOf(1) === 125 && q.cars[1].pit.rate === 12.5 && q.cars[1].pit.tank === 125; })());
  ok('a car with no percentage has a stop with no extra fields (as before)', (() => { const q = race({}), g = clock(q); g(0, 10000); q.block(0, 20000); q.tick(22000); return q.cars[0].pit && !('rate' in q.cars[0].pit) && !('tank' in q.cars[0].pit); })());
  ok('the refuelling speed alone: a stop of a hindered car with only the speed switched on has the normal tank (100)', (() => { const q = race({}), g = clock(q); q.bopSet(0, -20, 0); g(0, 10000); q.block(0, 20000); q.tick(22000); return q.cars[0].pit.rate === 8 && q.cars[0].pit.tank === 100 && q.tankOf(0) === 100; })());
  ok('the refuelling speed switched off: the stop has the normal speed', (() => { const q = race({ rate: false }), g = clock(q); q.bopSet(0, -20, 0); g(0, 10000); q.block(0, 20000); q.tick(22000); return q.cars[0].pit.rate === 10; })());
  ok('a car that was out of fuel runs again after a stop that gives it enough for a lap of its own use (a helped car needs less)', (() => { const q = race({}, { fuel: { tank: 3, perLap: 2, empty: 'stop' } }), g = clock(q); q.bopSet(0, 50, 0); for (let n = 0; n < 4; n++) g(0, 10000); const out = q.cars[0].outOfFuel, laps = q.cars[0].laps.length; q.block(0, 50000); q.tick(52000); q.unblock(0, 53000); return out === true && laps === 3 && q.cars[0].outOfFuel === false && q.cars[0].fuel === 3; })()); }

// setting a percentage
{ const r = race({ tank: true }), ev = () => r.events.filter(e => e.type.startsWith('bop'));
  ok('a percentage is rounded to a whole number and kept between -90 and 90; the same percentage again changes nothing (and logs nothing)', r.bopSet(0, -20.4, 0) && r.cars[0].bop === -20 && r.bopSet(0, -20, 0) === false && r.bopSet(0, -500, 0) && r.cars[0].bop === -90 && r.bopSet(0, 500, 0) && r.cars[0].bop === 90 && r.bopSet(0, 0, 0) && r.cars[0].bop === 0 && Object.is(r.cars[0].bop, 0));
  ok('nonsense is nothing: a car that is not there, text, nothing', r.bopSet(9, -20, 0) === false && r.bopSet(-1, 5, 0) === false && r.bopSet(0, 'x', 0) === false && r.bopSet(0, undefined, 0) === false && r.cars[0].bop === 0);
  ok('every change is in the race log: on, change, off; with the percentage, the laps done, who did it and what it was', (() => {
    const q = race({}), g = clock(q); g(0, 10000); g(0, 10000); q.bopSet(0, -20, 5000, 'director'); q.bopSet(0, 15, 6000, 'auto'); q.bopSet(0, 0, 7000, 'accepted'); const e = q.events.filter(x => x.type.startsWith('bop'));
    return e.length === 3 && same(e[0], { type: 'bopon', car: 0, t: 5000, pct: -20, lap: 2, by: 'director' }) && same(e[1], { type: 'bopchange', car: 0, t: 6000, pct: 15, lap: 2, by: 'auto', was: -20 }) && same(e[2], { type: 'bopoff', car: 0, t: 7000, pct: 0, lap: 2, by: 'accepted' }); })());
  ok('before the start the time of the event is 0, and it is from the director when nobody says', (() => { const q = E.createRace({ type: 'race', laps: 5, entries: entries(2), fuel: fuel(), bop: {} }); q.bopSet(1, 10); const e = q.events[0]; return e.t === 0 && e.by === 'director' && e.lap === 0 && e.car === 1; })());
  ok('a finished race can not be changed any more', (() => { const q = race({}); q.stop(1000); return q.bopSet(0, -20, 1000) === false && q.cars[0].bop === 0; })());
  ok('in the race log the notes in words: what BoP did to the car', (() => { const q = race({}), g = clock(q); q.bopSet(0, -20, 0); g(0, 10000); g(0, 10000); q.bopSet(0, 0, 0); return q.bopNoteOf(0) === 'hindered 20% (from the start to lap 2)' && q.bopNoteOf(1) === '' && q.bopNoteOf(5) === ''; })()); }

// the Race Director's buttons
{ const r = race({ percent: 30 });
  ok('Hinder and Help give the percentage of the settings, Off takes it away', r.bopPress(0, 'hinder', 0) && r.cars[0].bop === -30 && r.bopPress(0, 'help', 0) && r.cars[0].bop === 30 && r.bopPress(0, 'off', 0) && r.cars[0].bop === 0);
  ok('...pressing the same thing again changes nothing (false)', r.bopPress(0, 'off', 0) === false && r.bopPress(0, 'hinder', 0) === true && r.bopPress(0, 'hinder', 0) === false);
  ok('what the Race Director presses is kept (hold) until he says Auto', r.cars[0].bopHold === true && r.bopPress(0, 'auto', 0) === false && r.cars[0].bopHold === false);
  ok('Accept and Auto with nothing to take over do nothing; a lane that is not there, or something else, does nothing', r.bopPress(1, 'accept', 0) === false && r.bopPress(1, 'auto', 0) === false && r.bopPress(9, 'hinder', 0) === false && r.bopPress(0, 'dance', 0) === false && r.bopPress(0, undefined, 0) === false && r.cars[1].bop === 0); }

// the measure, the three modes
const drive = (r, pace, laps) => { const go = clock(r); for (let n = 0; n < laps; n++) pace.forEach((ms, i) => go(i, ms)); };
{ const r = race({ mode: 'manual' }); drive(r, [10000, 14500], 6);
  ok('manual: the cars are never looked at (no suggestion, no percentage, nothing active)', r.cars.every(c => c.bop === 0 && c.bopTo === null) && r.bopActive === false && r.bopSpread === 0); }
{ const r = race({ mode: 'suggest' }); drive(r, [10000, 14500], 2);
  ok('suggest: with fewer laps than it waits for nobody is looked at', r.cars.every(c => c.bopTo === null) && r.bopActive === false);
  drive(r, [10000, 14500], 1);
  ok('...from the third lap of both cars: a suggestion of -20% for the fast car and +20% for the slow car, and the spread (4.5 s) is known', r.cars[0].bopTo === -20 && r.cars[1].bopTo === 20 && r.bopActive === true && r.bopSpread === 4.5);
  ok('...nothing is applied: the suggestions wait for the Race Director', r.cars.every(c => c.bop === 0) && !r.events.some(e => e.type.startsWith('bop')));
  ok('Accept applies the suggestion of that lane, and only that lane (logged as accepted)', r.bopPress(0, 'accept', 5000) && r.cars[0].bop === -20 && r.cars[1].bop === 0 && r.events.some(e => e.type === 'bopon' && e.by === 'accepted' && e.car === 0));
  ok('...and the suggestion is still looked at after each lap, without applying it', (() => { drive(r, [10000, 14500], 1); return r.cars[1].bopTo === 20 && r.cars[1].bop === 0 && r.cars[0].bop === -20; })()); }
{ const r = race({ mode: 'auto' }), go = clock(r);
  drive(r, [10000, 14500], 2);
  ok('automatic: nothing before enough laps', r.cars.every(c => c.bop === 0) && r.events.every(e => !e.type.startsWith('bop')));
  drive(r, [10000, 14500], 1);
  ok('...then it applies: the fast car is hindered, the slow car helped (logged as auto, after lap 3)', r.cars[0].bop === -20 && r.cars[1].bop === 20 && r.events.filter(e => e.type === 'bopon').length === 2 && r.events.every(e => !e.type.startsWith('bop') || (e.by === 'auto' && e.lap === 3)));
  drive(r, [10000, 14500], 2);
  ok('...and it stays as it is while the difference stays (no new log entries)', r.cars[0].bop === -20 && r.events.filter(e => e.type.startsWith('bop')).length === 2);
  ok('it uses the fuel rules of the car: the fast car pays 2.4 litres for its next lap', (() => { const f = r.cars[0].fuel; go(0, 10000); return near(f - r.cars[0].fuel, 2.4); })());
  r.bopPress(0, 'off', 90000);
  ok('the Race Director takes one lane off: it is off and stays off, though the system would still say -20 (the other lane goes on)', r.cars[0].bop === 0 && r.cars[0].bopHold === true && (drive(r, [10000, 14500], 2), r.cars[0].bop === 0 && r.cars[0].bopTo === -20 && r.cars[1].bop === 20));
  ok('Auto gives the lane back to the system, which applies at once', r.bopPress(0, 'auto', 99000) && r.cars[0].bop === -20 && r.cars[0].bopHold === false && r.events.some(e => e.type === 'bopon' && e.by === 'auto' && e.car === 0 && e.t === 99000));
  ok('when the cars come close it goes off by itself, once the difference is below the lower limit (0.14 s)', (() => { drive(r, [10000, 10100], 6); return r.cars[0].bop === 0 && r.cars[1].bop === 0 && r.bopActive === false && r.events.some(e => e.type === 'bopoff' && e.by === 'auto'); })()); }
{ const r = race({ mode: 'auto', percent: 30, who: 'hinder' }); drive(r, [10000, 14500], 4);
  ok('only hinder: only the fast car has it', r.cars[0].bop === -30 && r.cars[1].bop === 0); }
{ const r = race({ mode: 'auto', grade: 'graded' }, { cars: 3 }); drive(r, [10000, 11000, 14000], 4);
  ok('graded with three cars: every car by how far it is from the middle (12 s): -20, -10, +20', r.cars[0].bop === -20 && r.cars[1].bop === -10 && r.cars[2].bop === 20); }
{ const r = race({ mode: 'auto', grade: 'extremes' }, { cars: 3 }); drive(r, [10000, 11000, 14000], 4);
  ok('extremes with three cars: the car in the middle has nothing', r.cars[0].bop === -20 && r.cars[1].bop === 0 && r.cars[2].bop === 20); }
{ const r = race({ mode: 'auto', measure: 'average', window: 3 }); drive(r, [10000, 14500], 3);
  ok('the measure and the window of the settings are the ones used (the average of 3 laps)', r.cars[0].bop === -20); }
{ const r = race({ mode: 'auto', apply: 5 }); drive(r, [10000, 14500], 5);
  ok('a difference of 4.5 s is not enough when it switches on at 5 s', r.cars.every(c => c.bop === 0) && r.bopActive === false && r.bopSpread === 4.5); }
{ const r = race({ mode: 'auto', laneFactors: [1, 1.2] }); drive(r, [10000, 12000], 4);
  ok('lanes of different length are compared by their length: 12 s on a lane that is 20% longer is as fast as 10 s (no difference, nothing happens)', r.cars.every(c => c.bop === 0) && r.bopActive === false && near(r.bopSpread, 0, 1e-9)); }
{ const r = race({ mode: 'auto', laneFactors: [1, 1.2] }); drive(r, [10000, 14400], 4);
  ok('...and 14.4 s there is 12 s: the difference is 2 s', r.cars[0].bop === -20 && r.cars[1].bop === 20 && near(r.bopSpread, 2)); }
{ const r = race({ mode: 'auto', scale: 'scaled', full: 2 }); drive(r, [10000, 11000], 4);
  ok('scaled: a difference of 1 s with the full strength at 2 s is half the percentage (10)', r.cars[0].bop === -10 && r.cars[1].bop === 10); }

// not under a flag, not for cars that are finished or out
{ const r = race({ mode: 'auto' }); drive(r, [10000, 14500], 2); r.setFlag('yellow', 30000); drive(r, [10000, 14500], 1);
  ok('under the yellow flag nobody is looked at (a lap under yellow says nothing about the pace)', r.cars.every(c => c.bop === 0) && r.bopActive === false);
  r.setFlag('yellow', 40000); drive(r, [10000, 14500], 1);
  ok('...and with the flag away the next lap is looked at again', r.cars[0].bop === -20 && r.cars[1].bop === 20); }
{ const r = E.createRace({ type: 'race', laps: 4, endRule: 'all', entries: entries(3), fuel: fuel(), bop: { mode: 'auto', grade: 'graded' } }); r.start(0); drive(r, [10000, 11000, 14000], 4);
  ok('a car that has finished is not part of it any more (and has no suggestion): the race is over, the others were looked at before', r.cars.every(c => c.done) && r.cars.every(c => c.bopTo === null)); }
{ const r = E.createRace({ type: 'race', laps: 6, endRule: 'all', entries: entries(3), fuel: fuel(), bop: { mode: 'auto', grade: 'graded', minLaps: 3 } }); r.start(0); const go = clock(r);
  for (let n = 0; n < 6; n++) { go(0, 8000); if (n < 5) { go(1, 12000); go(2, 16000); } }
  ok('the car that finished first (6 laps) is out of it: the last two cars are compared with each other (12 and 16 s: -20 and +20)', r.cars[0].done === true && r.cars[1].bop === -20 && r.cars[2].bop === 20); }
{ const r = race({ mode: 'auto' }); const go = clock(r); go(0, 10000); go(1, 14500); go(0, 10000); go(1, 14500); r.cars[0].pitLaps.push(2); go(0, 40000); go(1, 14500);
  ok('a lap with a pit stop is not counted in the pace (the 40 s lap of car 1 is left out: 2 laps are left, it waits for 3)', r.cars[0].bop === 0 && r.cars[0].bopTo === null); }
{ const r = race({ mode: 'auto' }), go = clock(r); drive(r, [10000, 14500], 3);
  ok('a retired car is left out of the comparison and gets nothing new; the car that is left has nobody to be compared with, so its Balance of Power goes off', (() => { r.cars[0].retired = true; const was = r.cars[0].bop, had = r.cars[1].bop; go(1, 14500); return was === -20 && had === 20 && r.cars[0].bop === was && r.cars[0].bopTo === null && r.cars[1].bopTo === 0 && r.cars[1].bop === 0 && r.bopActive === false; })()); }

// the heat result and the viewers
{ const people = [0, 1].map(i => ({ driverId: 'd' + i, carId: 'c' + i, driverName: 'D' + i, carName: 'car' + i }));
  const H = E.createHeatRace({ participants: people, schedule: [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }]], resultBy: 'laps', points: [] });
  const r = E.createRace({ type: 'race', laps: 3, endRule: 'all', entries: H.entries(), fuel: fuel(), bop: { mode: 'manual' } }); r.start(0); r.bopSet(0, -20, 0); drive(r, [10000, 11000], 3);
  const rows = H.record(r).rows;
  ok('the row of a heat says what Balance of Power did to the car (and has nothing for the car that had none)', rows.find(x => x.participant === 0).bopNote === 'hindered 20% (from the start)' && !('bopNote' in rows.find(x => x.participant === 1))); }
ok('a stand-in race of a test (no cars list, no notes) gives rows with no note', (() => { const people = [0].map(i => ({ driverId: 'd', carId: 'c', driverName: 'D', carName: 'car' })); const H = E.createHeatRace({ participants: people, schedule: [[{ p: 0, lane: 0 }]], resultBy: 'laps', points: [] }); return !('bopNote' in H.record({ standings: () => [{ pos: 1, car: { participant: 0, laps: [1], total: 1, best: 1 } }] }).rows[0]); })());

// the fuel rules of a car of the live page: an engine built from the same settings and the car fields that are sent
{ const r = race({ tank: true }), go = clock(r); r.bopSet(0, -20, 0); go(0, 10000);
  const copy = E.createRace(JSON.parse(JSON.stringify(r.cfg))); copy.cars.forEach((c, i) => { c.bop = r.cars[i].bop; c.fuel = r.cars[i].fuel; });
  ok('an engine built from the same settings (as a viewer does) has the same tank and the same settings', copy.bop && copy.bop.tank === true && copy.tankOf(0) === 80 && copy.tankOf(1) === 100 && same(copy.bop, r.bop)); }

// ---- 1.3.0: in words, and what the lane controls show ----
ok('what a percentage does, in words: hindered, helped, only what is switched on, nothing', B.effectText(-20, {}) === 'uses 20% more fuel per lap and refuels 20% slower' && B.effectText(15, { tank: true }) === 'uses 15% less fuel per lap, refuels 15% faster and has a 15% bigger tank'
  && B.effectText(-10, { use: false, rate: false, tank: true }) === 'has a 10% smaller tank' && B.effectText(10, { use: false, rate: false }) === '' && B.effectText(0, {}) === '' && B.effectText(500, {}).startsWith('uses 90%'));
{ const none = B.view(null, [0, 1], 'running');
  ok('a race without Balance of Power has no controls', none.on === false && none.rows.length === 0 && B.view({ cars: [] }, [0], 'running').on === false);
  const r = race({ mode: 'manual', percent: 25 }), v = B.view(r, [0, 1, 2], 'running');
  ok('manual: a row for every lane that has a car (the lane without one is not shown), the buttons say the percentage, nothing is pressed', v.on && v.mode === 'manual' && v.rows.length === 3 && v.rows[0].show && v.rows[1].show && !v.rows[2].show && v.rows[0].hinder.text === 'Hinder 25%' && v.rows[0].help.text === 'Help 25%' && v.rows[0].off.text === 'Off'
    && v.rows[0].now === 'BoP off' && v.rows[0].kind === 'off' && !v.rows[0].hinder.on && !v.rows[0].help.on && !v.rows[0].off.on && v.rows[0].who === 'D0');
  ok('...manual has no Auto and no Accept button, and no proposal', v.rows[0].auto.show === false && v.rows[0].accept.show === false && v.rows[0].to === '' && v.info === 'Manual: press Hinder or Help for a lane.');
  r.bopPress(0, 'hinder', 0); r.bopPress(1, 'help', 0); const v2 = B.view(r, [0, 1], 'running');
  ok('after Hinder and Help the rows say so, with the sign and the arrow, and the button that is on is marked', v2.rows[0].now === 'BoP ▼ −25%' && v2.rows[0].kind === 'hindered' && v2.rows[0].hinder.on && !v2.rows[0].help.on && v2.rows[1].now === 'BoP ▲ +25%' && v2.rows[1].kind === 'helped' && v2.rows[1].help.on);
  r.bopPress(0, 'off', 0); const v3 = B.view(r, [0], 'running');
  ok('Off marks the lane as held at nothing (it is the button that is on)', v3.rows[0].off.on && v3.rows[0].now === 'BoP off' && !v3.rows[0].hinder.on);
  ok('the buttons only work while the race can be changed (ready, countdown, running, paused, between), not after it', ['ready', 'countdown', 'running', 'paused', 'between'].every(ph => !B.view(r, [0], ph).rows[0].hinder.disabled) && ['review', 'finished', 'weird'].every(ph => B.view(r, [0], ph).rows[0].hinder.disabled && B.view(r, [0], ph).rows[0].off.disabled));
  r.cars[1].retired = true; const v4 = B.view(r, [0, 1], 'running');
  ok('a car that is out or finished has its buttons off', v4.rows[1].hinder.disabled && v4.rows[1].help.disabled && v4.rows[1].off.disabled && !v4.rows[0].hinder.disabled); }
{ const r = race({ mode: 'suggest' }); drive(r, [10000, 14500], 3); const v = B.view(r, [0, 1], 'running');
  ok('suggest: the proposal is shown ("−20%" and "+20%"), the Accept buttons are there and work, Auto is not there', v.mode === 'suggest' && v.rows[0].to === '−20%' && v.rows[1].to === '+20%' && v.rows[0].accept.show && !v.rows[0].accept.disabled && v.rows[0].auto.show === false && v.rows[0].now === 'BoP off');
  ok('...the information line says how far apart the cars are and that it applies', v.info === 'Suggest: the fastest and slowest car are 4.50 s apart, so it applies (from 0.30 s).');
  r.bopPress(0, 'accept', 40000); const w = B.view(r, [0, 1], 'running');
  ok('...after Accept the lane has it and there is nothing left to accept on it (the other lane still has)', w.rows[0].now === 'BoP ▼ −20%' && w.rows[0].to === '' && w.rows[0].accept.disabled && !w.rows[1].accept.disabled);
  ok('a proposal to take it off says "off" (and a lane that has nothing and would get nothing shows no proposal)', (() => { const q = race({ mode: 'suggest' }); drive(q, [10000, 14500], 3); q.bopPress(0, 'accept', 1); drive(q, [10000, 10000], 8); const vv = B.view(q, [0, 1], 'running'); return vv.rows[0].to === 'off' && vv.rows[1].to === ''; })()); }
{ const r = race({ mode: 'auto' }); drive(r, [10000, 14500], 3); const v = B.view(r, [0, 1], 'running');
  ok('automatic: it is on (−20% / +20%), Auto is there but waits until a lane is held, there is no Accept', v.mode === 'auto' && v.rows[0].now === 'BoP ▼ −20%' && v.rows[0].auto.show && v.rows[0].auto.disabled && v.rows[0].accept.show === false && v.rows[0].held === false && v.info.startsWith('Automatic: the fastest and slowest car are 4.50 s apart, so it applies'));
  r.bopPress(1, 'off', 99999); const w = B.view(r, [0, 1], 'running');
  ok('...a lane that was pressed is held, and its Auto button works', w.rows[1].held === true && w.rows[1].auto.disabled === false && w.rows[0].held === false);
  const q = race({ mode: 'auto' }); drive(q, [10000, 10100], 3);
  ok('...a small difference says it is below the limit and nothing applies; before any laps it says it is waiting', B.view(q, [0], 'running').info === 'Automatic: the fastest and slowest car are 0.10 s apart, below 0.30 s: nothing applies.' && B.view(race({ mode: 'auto' }), [0], 'running').info === 'Automatic: waiting for laps from at least two cars.'); }

// ---- 1.3.0: the audio calls ----
{ const A = require('../renderer/announcer.js'), r = race({ mode: 'manual' }), an = A.create({}), names = ev => ev.map(x => x.call).join(), say = x => an.observe(r, { phase: 'running', now: 0, ...x });
  say({}); r.bopSet(0, -20, 100, 'director'); let ev = say({});
  ok('Balance of Power coming on says "bopon" for that driver with the percentage and what it does', names(ev) === 'bopon' && ev[0].vars.driver === 'D0' && ev[0].vars.bop === 20 && ev[0].vars.effect === 'hindered');
  r.bopSet(0, -30, 200); ev = say({}); ok('a change of the strength in the same direction says nothing', names(ev) === '');
  r.bopSet(0, 25, 300); ev = say({}); ok('...but from hindered to helped it is said again, now as helped', names(ev) === 'bopon' && ev[0].vars.effect === 'helped' && ev[0].vars.bop === 25);
  r.bopSet(0, 0, 400); ev = say({}); ok('taking it off says "bopoff"', names(ev) === 'bopoff' && ev[0].vars.driver === 'D0');
  ok('the calls exist in a folder of their own, with the sentences of the idea, and are on in a new audio set (a race without Balance of Power never says them)', (() => { const on = A.CALLS.find(c => c.id === 'bopon'), off = A.CALLS.find(c => c.id === 'bopoff'), set = require('../renderer/sound.js').defaultSet ? null : null;
    return on.group === 'Balance of Power' && off.group === 'Balance of Power' && on.lines[0] === 'Balance of Power for {driver}' && off.lines[0] === 'Balance of Power for {driver} removed!' && on.defaultOn !== false && off.defaultOn !== false; })());
  ok('...and the sentence is filled in', A.fill('Balance of Power for {driver} removed!', { driver: 'Alex' }) === 'Balance of Power for Alex removed!' && A.fill('{bop} percent {effect}', A.SAMPLE) === '20 percent hindered');
  ok('the half-tank and low-fuel calls use the size of the tank of the car (a hindered car with a smaller tank is half empty sooner)', (() => { const q = race({ tank: true }, { fuel: { tank: 100, perLap: 2 } }), a2 = A.create({}); q.bopSet(0, -50, 0); a2.observe(q, { phase: 'running', now: 0 }); const go = clock(q); const seen = []; for (let n = 0; n < 12; n++) { go(0, 10000); seen.push(...a2.observe(q, { phase: 'running', now: 1000 * n }).map(x => x.call + ':' + x.vars.driver)); } return seen.includes('fuelhalf:D0'); })()); }

// ---- 1.3.0: the other screens ----
{ const LS = require('../renderer/liveshare.js'), r = race({ mode: 'auto' }); drive(r, [10000, 14500], 3); r.bopPress(1, 'off', 99999);
  const send = LS.sender({ heartbeat: 0 }), viewer = LS.viewer(), base = { personal: new Map(), track: Infinity, trackName: '' };
  const c = { raceId: 'x', title: 't', eng: r, setup: {}, layout: {}, track: {}, lanes: 2, base, phase: 'running', calling: false, lights: 0, heat: null, flash: new Map(), bestAll: Infinity, bestAllName: '', bestBy: new Map(), now: 50000 };
  viewer.feedStatic(JSON.parse(JSON.stringify(LS.packStatic(c)))); viewer.feedDynamic(JSON.parse(JSON.stringify(send.pack(c, 50000))), 50000);
  const ve = viewer.engine();
  ok('the other screens get the settings (the engine is built from them), what every car has and the state of the comparison', ve.bop && ve.bop.mode === 'auto' && ve.cars[0].bop === -20 && ve.cars[0].bopHold === false && ve.cars[1].bop === 0 && ve.cars[1].bopHold === true && ve.bopActive === true && near(ve.bopSpread, r.bopSpread));
  ok('...so the controls look the same there as on the main computer', same(B.view(ve, [0, 1], 'running'), B.view(r, [0, 1], 'running')));
  ok('...and the race log is there, so the review can say what it did', ve.bopNoteOf(0) === r.bopNoteOf(0) && ve.bopNoteOf(0) !== ''); }
{ const S = require('../server.js');
  ok('the commands of the Race Director page: a lane from 0 to 15 and one of the five buttons', ['hinder', 'help', 'off', 'auto', 'accept'].every(how => S.bopCommand({ type: 'bop', lane: 3, how })) && S.bopCommand({ type: 'bop', lane: 0, how: 'off' }) && S.bopCommand({ type: 'bop', lane: 15, how: 'off' }));
  ok('...nothing else gets through (a lane that is not a whole number or out of range, a missing lane, another word, a number, no word); other commands are not its business', [{ lane: -1 }, { lane: 16 }, { lane: 1.5 }, { lane: '1' }, { lane: null }, { lane: undefined }, { how: 'x' }, { how: 5 }, { how: undefined }, { how: null }].every(x => S.bopCommand({ type: 'bop', lane: 1, how: 'off', ...x }) === false)
    && S.bopCommand({ type: 'start' }) === true && S.bopCommand({ type: 'penalty', lane: 99 }) === true); }
{ const St = require('../renderer/stats.js');
  ok('a result row says what Balance of Power did, or nothing', St.bopText({ bopNote: 'hindered 20% (from the start to lap 12)' }) === 'Balance of Power: hindered 20% (from the start to lap 12)' && St.bopText({}) === '' && St.bopText(null) === '' && St.bopText({ bopNote: '' }) === ''); }

// ---- 1.3.0: found by the mutation check ----
{ const S = B.settingsOf({}), car = (laps, x = {}) => ({ laps, bad: [], invalid: [], removed: [], pitLaps: [], ...x }), S5 = { ...S, minLaps: 5 }, laps = [10000, 10000, 50000, 10000, 10000];
  ok('one lane length that is no good means no correction at all (not a correction with the lanes that are left)', B.engineConfig({}, [10, 0, 12]).laneFactors === undefined && B.engineConfig({}, [10, 'x', 12]).laneFactors === undefined && B.engineConfig({}, [10, 12, 14]).laneFactors !== undefined);
  ok('the lane factors are rounded to six decimals (10, 11, 12 m: 0.909091, 1, 1.090909)', same(B.engineConfig({}, [10, 11, 12]).laneFactors, [0.909091, 1, 1.090909]));
  ok('each kind of lap that does not count is left out on its own: too slow, invalid, taken out, with a pit stop (5 laps, one of them 50 s, a pace needs 5)',
    B.paceOf(car(laps), S5) === 10000 && B.paceOf(car(laps, { bad: [false, false, true, false, false] }), S5) === null && B.paceOf(car(laps, { invalid: [2] }), S5) === null
    && B.paceOf(car(laps, { removed: [2] }), S5) === null && B.paceOf(car(laps, { pitLaps: [2] }), S5) === null && B.paceOf(car(laps, { bad: [false, false, true, false, false] }), S) === 10000);
  const pl = (p, c = {}, w = false) => B.plan(p, { ...S, ...c }, w), sc = pl([10000, 11000], { scale: 'scaled', full: 3, percent: 20 });
  ok('a scaled percentage is a whole number too (20% at a third of the full difference is 7%, for the cars and for the strength)', sc.percent === 7 && same(sc.pct, [-7, 7]) && Number.isInteger(sc.percent));
  // what the controls show, with an engine that is made up
  const fake = (cars, x = {}) => ({ bop: { mode: 'auto', percent: 20, apply: 0.3 }, bopActive: true, bopSpread: 4.537, status: 'running', cars, ...x }), row = (c, mode = 'auto') => B.view(fake([{ lane: 0, bop: 0, ...c }], { bop: { mode, percent: 20, apply: 0.3 } }), [0], 'running').rows[0];
  ok('the seconds in the information line are rounded to hundredths (4.537 s apart is 4.54 s)', B.view(fake([{ lane: 0 }]), [0], 'running').info === 'Automatic: the fastest and slowest car are 4.54 s apart, so it applies (from 0.30 s).');
  ok('once the race is over (status finished) the buttons are off, whatever the screen says', B.view(fake([{ lane: 0, bop: 0 }], { status: 'finished' }), [0], 'running').rows[0].hinder.disabled === true && row({}).hinder.disabled === false);
  ok('a car that has finished (done) or is disqualified has its buttons off', row({ done: true }).hinder.disabled && row({ dq: true }).hinder.disabled && row({ retired: true }).off.disabled && !row({}).off.disabled);
  ok('manual has no proposals even when a car has one; with a car that has none yet (nothing, or null) no proposal is shown in the other modes', row({ bopTo: -20 }, 'manual').to === '' && row({ bopTo: -20 }, 'suggest').to === '−20%' && row({}, 'auto').to === '' && row({ bopTo: null }, 'suggest').to === '' && row({ bopTo: undefined }, 'auto').to === '');
  ok('"held" is only said in automatic mode (in the other modes a pressed lane stays as it is anyway)', row({ bopHold: true }, 'auto').held === true && row({ bopHold: true }, 'manual').held === false && row({ bopHold: true }, 'suggest').held === false);
  ok('a car without a driver is called Guest', row({}).who === 'Guest' && row({ driverName: 'Sam' }).who === 'Sam'); }

// the engine: the size of the tank, the speed of a stop, the fuel a stop must give, the buttons without a proposal, the cars that are out
ok('the tank of a helped car is exactly 110 litres, not 110.00000000000001', (() => { const q = race({ tank: true }); q.bopSet(0, 10, 0); return q.tankOf(0) === 110 && q.cars[0].pit === null; })());
{ const q = race({}, { fuel: { tank: 100, perLap: 40, rate: 10 } }), g = clock(q); q.bopSet(0, -20, 0); g(0, 10000); g(1, 10000); q.block(0, 20000); q.block(1, 20000); q.tick(22000);
  ok('during a stop the fuel grows at the speed of the car: 8 litres a second for a hindered car, 10 for the one next to it (4 and 20 litres left when the stop starts: 20 and 40 litres two seconds later)', near(q.fuelOf(0, 24000), 4 + 16) && near(q.fuelOf(1, 24000), 20 + 20)); }
{ const q = race({}, { fuel: { tank: 4, perLap: 2, rate: 10, empty: 'stop' } }), g = clock(q); q.bopSet(0, -50, 0); g(0, 10000); g(0, 10000);
  const out = q.cars[0].outOfFuel; q.block(0, 50000); q.tick(52000); q.unblock(0, 52300);
  ok('a hindered car that left the pits with 2.5 litres, which is enough for a lap of an ordinary car (2) but not for a lap of its own (3), is still out of fuel', out === true && near(q.cars[0].fuel, 2.5) && q.cars[0].outOfFuel === true); }
{ const q = race({ mode: 'suggest' }); q.bopPress(0, 'hinder', 0); q.cars[0].bopTo = 20;
  ok('Auto in suggest mode does not take over the proposal (only automatic mode does)', q.bopPress(0, 'auto', 1) === false && q.cars[0].bop === -20 && q.cars[0].bopHold === false); }
{ const a = race({ mode: 'auto' }), s = race({ mode: 'suggest' }); a.bopPress(0, 'hinder', 0); s.bopPress(0, 'hinder', 0);
  ok('Auto and Accept without a proposal do not take the percentage off (a car that has not been looked at yet has none)', a.cars[0].bopTo === null && a.bopPress(0, 'auto', 1) === false && a.cars[0].bop === -20 && s.bopPress(0, 'accept', 1) === false && s.cars[0].bop === -20); }
{ const r = race({ mode: 'auto' }, { cars: 3 }), go = clock(r); drive(r, [10000, 12000, 14000], 3);
  ok('before one of them is disqualified the slowest car is helped (and the car in the middle gets nothing)', r.cars[2].bop === 20 && r.cars[1].bop === 0);
  r.cars[2].dq = true; go(0, 10000); go(1, 12000);
  ok('a disqualified car is left out of the comparison: the car in the middle is now the slowest and is helped, and the disqualified one gets no proposal', r.cars[1].bop === 20 && r.cars[2].bopTo === null && r.cars[0].bop === -20); }
{ const r = race({ mode: 'auto' }); drive(r, [10000, 14500], 3);
  ok('before the difference drops: both cars have it, it is on', r.bopActive === true && r.cars[0].bop === -20 && r.cars[1].bop === 20);
  drive(r, [10000, 10200], 5);
  ok('a difference between the "off" and "on" limits (0.2 s, between 0.15 and 0.3) keeps it on, as it was (the engine remembers that it was on)', r.bopActive === true && near(r.bopSpread, 0.2) && r.cars[0].bop === -20 && r.cars[1].bop === 20);
  drive(r, [10000, 10100], 5);
  ok('...and below the "off" limit (0.1 s) it goes off', r.bopActive === false && r.cars[0].bop === 0 && r.cars[1].bop === 0); }

if (fails) { console.log(fails + ' FAILED'); process.exit(1); }
console.log('ALL BOP TESTS PASSED');
