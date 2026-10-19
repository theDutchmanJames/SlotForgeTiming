// 1.43.0: Car Failures, a part of the Damage System. The rules (failures.js): the defaults, cleaning a record, the roll of a car, the words. The race engine: the roll at the start, a failure that starts
// at its lap or time, the stop in the pits that clears it (with the damage, the longest job counts), a failure that retires or disqualifies the car, the deadline, leaving too early, an interrupted race,
// what the other windows are told. The Car Failure widget, the texts {failure} and {failures}, the Failure factor of a slot car, and the fields of the Damage System.
const RE = require('../renderer/engine.js'), Dm = require('../renderer/damage.js'), Fl = require('../renderer/failures.js'), Tm = require('../renderer/timing.js'), Wd = require('../renderer/widgets.js');
const LS = require('../renderer/liveshare.js'), schema = require('../schema.js');
let fails = 0; const ok = (m, c) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const SEC = 1000;

// ---- the rules: defaults ----
{ const d = Fl.defaults();
  ok('the standard failures: Lift and Coast, Slow Puncture, Brakes not working, Engine Failure Box to Retire (no Downshifts)', same(d.list.map(f => f.name), ['Lift and Coast', 'Slow Puncture', 'Brakes not working', 'Engine Failure, Box to Retire']));
  ok('...each borrows the rules of a default level of damage, with a chance and its own seconds', same(d.list.map(f => [f.level, f.chance, f.seconds]), [['Light damage', 10, 5], ['Heavy damage', 5, 10], ['Heavy damage', 4, 15], ['Critical damage', 2, 0]]));
  ok('...and the levels they name are the default levels of the Damage System', d.list.every(f => Dm.DEFAULT_LEVELS.some(l => l.name === f.level)));
  ok('Car Failures are off to begin with, between 10% and 90% of the race, one failure for a car', d.on === false && d.from === 10 && d.to === 90 && d.max === 1);
  ok('defaults() gives copies: changing one does not change the next', (() => { const a = Fl.defaults(), b = Fl.defaults(); a.list[0].name = 'x'; a.list.pop(); return b.list.length === 4 && b.list[0].name === 'Lift and Coast' && Fl.DEFAULT_FAILURES[0].name === 'Lift and Coast'; })());
  ok('a new Damage System starts with the standard failures in its form (a copy of the list)', same(Dm.defaults().failures, Fl.DEFAULT_FAILURES) && Dm.defaults().failures !== Fl.DEFAULT_FAILURES); }

// ---- the rules: cleaning a record ----
const LV = Dm.clean(Dm.defaults(), 0).levels;
{ const raw = o => ({ on: 'on', list: [{ name: 'Slow Puncture', level: 'Heavy damage', chance: 5, seconds: 10 }], ...o });
  ok('off is nothing: no failures, whatever else is in the record', Fl.clean(raw({ on: 'off' }), LV) === null && Fl.clean(raw({ on: undefined }), LV) === null && Fl.clean(null, LV) === null && Fl.clean('x', LV) === null);
  ok('on, but no failures: nothing either', Fl.clean(raw({ list: [] }), LV) === null && Fl.clean(raw({ list: undefined }), LV) === null && Fl.clean(raw({ list: [null, 3, 'x'] }), LV) === null);
  const c = Fl.clean(raw(), LV);
  ok('a failure takes the rules of its level: pit as fast as you can, within 3 laps, a repair', c.on === true && c.list.length === 1 && c.list[0].urgent === true && c.list[0].within === 3 && c.list[0].action === 'repair' && c.list[0].levelFound === true && c.list[0].level === 'Heavy damage');
  ok('...with its own seconds (and the milliseconds the engine uses) and chance', c.list[0].seconds === 10 && c.list[0].ms === 10000 && c.list[0].chance === 5);
  ok('...a level that retires gives a failure that retires', Fl.clean(raw({ list: [{ name: 'E', level: 'Critical damage', chance: 2, seconds: 0 }] }), LV).list[0].action === 'retire');
  ok('the level is found without caring for capitals and spaces around it', Fl.clean(raw({ list: [{ name: 'E', level: '  critical DAMAGE ', chance: 2 }] }), LV).list[0].levelFound === true);
  const lost = Fl.clean(raw({ list: [{ name: 'E', level: 'Gone', chance: 2, seconds: 4 }, { name: 'F', level: '', chance: 3 }] }), LV).list;
  ok('a level that cannot be found asks the least: pit whenever you can, no deadline, a repair (and says it was not found); no level at all is the same', lost[0].levelFound === false && lost[0].urgent === false && lost[0].within === 0 && lost[0].action === 'repair' && lost[0].level === 'Gone' && lost[1].levelFound === false && lost[1].action === 'repair');
  ok('...also when the system has no levels at all', Fl.clean(raw(), []).list[0].action === 'repair' && Fl.clean(raw(), undefined).list[0].urgent === false);
  const w = Fl.clean(raw({ list: [{ name: '  ', chance: 250, seconds: -4 }, { name: 'B', chance: 'x', seconds: 'y' }, { name: 'C', chance: 0.456, seconds: 7.777 }] }), LV).list;
  ok('a failure without a name gets "Failure 1"; the chance is 0 to 100; seconds are never negative; wrong numbers are 0; two decimals', w[0].name === 'Failure 1' && w[0].chance === 100 && w[0].seconds === 0 && w[1].chance === 0 && w[1].seconds === 0 && w[2].chance === 0.46 && w[2].seconds === 7.78);
  const win = o => Fl.clean(raw(o), LV);
  ok('the moment: 10% to 90% and one failure to begin with; own numbers are whole', win({}).from === 10 && win({}).to === 90 && win({}).max === 1 && win({ from: '20', to: '70.9', max: '3.5' }).from === 20 && win({ from: '20', to: '70.9', max: '3.5' }).to === 70 && win({ from: '20', to: '70.9', max: '3.5' }).max === 3);
  ok('...the latest is never before the earliest; nothing goes over 100; a maximum below 1 is 1', win({ from: 80, to: 30 }).to === 80 && win({ from: 150, to: 200 }).from === 100 && win({ from: 150, to: 200 }).to === 100 && win({ max: 0 }).max === 1 && win({ max: 'x' }).max === 1);
  ok('the cleaned system of the Damage System has the failures only when they are on (an old system is as it was)', !('failures' in Dm.clean(Dm.defaults(), 0)) && !('failures' in Dm.clean({ ...Dm.defaults(), failuresOn: 'off' }, 0)) && 'failures' in Dm.clean({ ...Dm.defaults(), failuresOn: 'on' }, 0) && Dm.clean({ ...Dm.defaults(), failuresOn: 'on' }, 0).failures.list.length === 4);
  ok('...a Damage System record from before (no failure fields) has none', !('failures' in Dm.clean({ name: 'Old', levels: [{ name: 'L', from: 3, seconds: 5 }] }, 0)));
  ok('...it takes the failures from the record: the list, and the window and the maximum from failFrom, failTo and failMax', same(Dm.clean({ ...Dm.defaults(), failuresOn: 'on', failFrom: 20, failTo: 60, failMax: 2 }, 0).failures, { on: true, from: 20, to: 60, max: 2, list: Fl.clean({ on: true, list: Fl.DEFAULT_FAILURES }, LV).list })); }

// ---- the rules: the factor of a slot car ----
ok('the Failure factor: 1 when empty or wrong, 0 and more as typed', Fl.factorOf('') === 1 && Fl.factorOf(undefined) === 1 && Fl.factorOf(null) === 1 && Fl.factorOf('x') === 1 && Fl.factorOf(0) === 0 && Fl.factorOf('2') === 2 && Fl.factorOf(0.5) === 0.5 && Fl.factorOf(-3) === 0);

// ---- the rules: the roll ----
const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
const cfgOf = (list, o = {}) => Fl.clean({ on: 'on', list, from: 0, to: 100, max: 1, ...o }, LV);
const F1 = (chance, seconds = 5, level = 'Light damage', name = 'Lift and Coast') => ({ name, level, chance, seconds });
{ let C = cfgOf([F1(50)]);
  ok('a failure is rolled by its own chance: below it the car gets it, above it not', Fl.roll(C, { laps: 10 }, 1, seq(0.49, 0.5)).length === 1 && Fl.roll(C, { laps: 10 }, 1, seq(0.5, 0.5)).length === 0 && Fl.roll(C, { laps: 10 }, 1, seq(0.99, 0.5)).length === 0);
  ok('...100% always comes, 0% never', Fl.roll(cfgOf([F1(100)]), { laps: 10 }, 1, seq(0.999, 0.5)).length === 1 && Fl.roll(cfgOf([F1(0)]), { laps: 10 }, 1, seq(0, 0.5)).length === 0);
  ok('the Failure factor multiplies the chance: 2 turns 30% into 60%, 0 means never, 0.5 halves it', Fl.roll(cfgOf([F1(30)]), { laps: 10 }, 2, seq(0.5, 0.5)).length === 1 && Fl.roll(cfgOf([F1(30)]), { laps: 10 }, 1, seq(0.5, 0.5)).length === 0 && Fl.roll(cfgOf([F1(30)]), { laps: 10 }, 0, seq(0, 0.5)).length === 0 && Fl.roll(cfgOf([F1(30)]), { laps: 10 }, 0.5, seq(0.2, 0.5)).length === 0 && Fl.roll(cfgOf([F1(30)]), { laps: 10 }, 0.5, seq(0.1, 0.5)).length === 1);
  ok('...a chance of more than 100% after the factor is still just a sure thing', Fl.roll(cfgOf([F1(80)]), { laps: 10 }, 5, seq(0.999, 0.5)).length === 1);
  ok('the moment is a lap number between the earliest and the latest part of the race: 30% of 10 laps is lap 3, 0.6 gives lap 6', same(Fl.roll(C = cfgOf([F1(100)]), { laps: 10 }, 1, seq(0, 0.3)), [{ k: 0, at: 3 }]) && same(Fl.roll(C, { laps: 10 }, 1, seq(0, 0.6)), [{ k: 0, at: 6 }]));
  ok('...with a window of 20% to 60% the moment is inside it: 0 gives lap 2 and 1 gives lap 6 (of 10)', same(Fl.roll(cfgOf([F1(100)], { from: 20, to: 60 }), { laps: 10 }, 1, seq(0, 0)), [{ k: 0, at: 2 }]) && same(Fl.roll(cfgOf([F1(100)], { from: 20, to: 60 }), { laps: 10 }, 1, seq(0, 0.999)), [{ k: 0, at: 6 }]));
  ok('a failure never comes in the first lap or on the last one: lap 1 to the lap before the last', same(Fl.roll(C, { laps: 10 }, 1, seq(0, 0)), [{ k: 0, at: 1 }]) && same(Fl.roll(C, { laps: 10 }, 1, seq(0, 0.999)), [{ k: 0, at: 9 }]) && same(Fl.roll(C, { laps: 2 }, 1, seq(0, 0.999)), [{ k: 0, at: 1 }]) && same(Fl.roll(C, { laps: 2 }, 1, seq(0, 0)), [{ k: 0, at: 1 }]));
  ok('a race of one lap has no failures; neither has a race with no limit', Fl.roll(C, { laps: 1 }, 1, seq(0, 0.5)).length === 0 && Fl.roll(C, { laps: 0, ms: 0 }, 1, seq(0, 0.5)).length === 0 && Fl.roll(C, {}, 1, seq(0, 0.5)).length === 0 && Fl.roll(C, undefined, 1, seq(0, 0.5)).length === 0);
  ok('a race with a time gets a time in milliseconds: 25% of 10 minutes is 150 seconds', same(Fl.roll(C, { laps: 0, ms: 600000 }, 1, seq(0, 0.25)), [{ k: 0, at: 150000 }]) && same(Fl.roll(cfgOf([F1(100)], { from: 20, to: 60 }), { ms: 600000 }, 1, seq(0, 0)), [{ k: 0, at: 120000 }]));
  ok('...when there are laps they win over the time', same(Fl.roll(C, { laps: 10, ms: 600000 }, 1, seq(0, 0.3)), [{ k: 0, at: 3 }]));
  ok('nothing to roll with: no rules, no list', same(Fl.roll(null, { laps: 10 }, 1, seq(0)), []) && same(Fl.roll({ list: [] }, { laps: 10 }, 1, seq(0)), []) && same(Fl.roll(undefined, { laps: 10 }, 1, seq(0)), [])); }
{ const L4 = [F1(100, 5, 'Light damage', 'A'), F1(100, 5, 'Light damage', 'B'), F1(100, 5, 'Light damage', 'C'), F1(100, 5, 'Light damage', 'D')];
  ok('when more failures come up than a car may have, only that many stay: 1, 2 or all four', Fl.roll(cfgOf(L4, { max: 1 }), { laps: 10 }, 1, () => 0.5).length === 1 && Fl.roll(cfgOf(L4, { max: 2 }), { laps: 10 }, 1, () => 0.5).length === 2 && Fl.roll(cfgOf(L4, { max: 99 }), { laps: 10 }, 1, () => 0.5).length === 4);
  ok('...which ones is random (the shuffle takes the random numbers), and they come in the order of their moment', (() => {
    const a = Fl.roll(cfgOf(L4, { max: 1 }), { laps: 10 }, 1, seq(0, 0, 0, 0, 0.99, 0.5, 0.5)), b = Fl.roll(cfgOf(L4, { max: 1 }), { laps: 10 }, 1, seq(0, 0, 0, 0, 0.0, 0.5, 0.5)); return a.length === 1 && b.length === 1 && a[0].k !== b[0].k; })()
    && (() => { const r = Fl.roll(cfgOf(L4, { max: 4 }), { laps: 10 }, 1, seq(0, 0, 0, 0, 0.9, 0.5, 0.5, 0.2, 0.7, 0.9, 0.1, 0.3)); return r.length === 4 && r.every((x, i) => i === 0 || r[i - 1].at <= x.at); })());
  ok('the same random numbers give the same failures (a race can be played again)', same(Fl.roll(cfgOf(L4, { max: 2 }), { laps: 10 }, 1, seq(0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8)), Fl.roll(cfgOf(L4, { max: 2 }), { laps: 10 }, 1, seq(0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8)))); }

// ---- the rules: the words ----
{ const C = Fl.clean({ on: 'on', list: Fl.DEFAULT_FAILURES }, LV), [lc, sp, , en] = C.list;
  ok('what a failure asks, in words: urgent with a deadline, a repair', Fl.failureText(sp) === 'Slow Puncture: pit as fast as you can, within 3 laps; stand still for at least 10 seconds, which repairs the car.');
  ok('...whenever you can, with no deadline; one second is not "seconds"', Fl.failureText(lc) === 'Lift and Coast: pit whenever you can; stand still for at least 5 seconds, which repairs the car.' && Fl.failureText({ ...lc, seconds: 1 }).includes('at least 1 second,'));
  ok('...a failure that retires the car (and one that disqualifies it, with seconds)', Fl.failureText(en) === 'Engine Failure, Box to Retire: pit as fast as you can, within 1 lap; the car is retired.' && Fl.failureText({ ...en, seconds: 3, action: 'dq' }).endsWith('stand still for at least 3 seconds and the car is disqualified.') && Fl.failureText(null) === '');
  ok('the failures and their chances in one line', Fl.rulesText(C) === 'Lift and Coast 10%, Slow Puncture 5%, Brakes not working 4%, Engine Failure, Box to Retire 2%.' && Fl.rulesText(null) === '');
  ok('the colour of a failure: amber to pit whenever you can, red as fast as you can or late, out for one that ends the car, ok for none', Fl.toneOf(lc, false) === 'amber' && Fl.toneOf(lc, true) === 'red' && Fl.toneOf(sp, false) === 'red' && Fl.toneOf(en, false) === 'out' && Fl.toneOf(null, false) === 'ok');
  ok('what it asks: whenever / as fast as you can with no deadline, laps left, now, late', Fl.whenText(lc, null) === 'Pit whenever you can' && Fl.whenText(sp, undefined) === 'Pit as fast as you can' && Fl.whenText(sp, 2) === 'Pit in 2 laps' && Fl.whenText(sp, 1) === 'Pit in 1 lap' && Fl.whenText(sp, 0) === 'Pit now' && Fl.whenText(sp, -1) === 'Pit now, 1 lap late' && Fl.whenText(sp, -3) === 'Pit now, 3 laps late'); }

// ---- the engine ----
const entry = (lane, over) => ({ lane, driverId: 'd' + lane, driverName: 'Driver' + lane, carId: 'car' + lane, ...over });
const mk = (o = {}) => RE.createRace({ type: o.type || 'race', laps: o.type === 'timed' ? 0 : (o.laps ?? 10), duration: o.duration || 10, minLap: 800, rnd: o.rnd || seq(0, 0.3),
  penalty: o.penalty === false ? undefined : RE.penaltyConfig({ everyPoints: 5, everySeconds: 5 }),
  damage: o.damage === null ? undefined : Dm.clean({ ...Dm.defaults(), failuresOn: 'on', failFrom: 0, failTo: 100, failures: [F1(100, 8)], ...(o.rec || {}) }, 0), entries: o.entries || [entry(0), entry(1, { failureFactor: 0 })] });
const types = (R, ty, car) => R.events.filter(e => e.type === ty && (car === undefined || e.car === car));
const drive = (R, i, from, to, lapMs = 30 * SEC) => { for (let t = from + lapMs; t <= to; t += lapMs) R.cross(i, t); };
const started = o => { const R = mk(o); R.start(0); R.cars.forEach(c => { c.started = true; }); return R; };
const HEAVY = (seconds = 10) => ({ failures: [F1(100, seconds, 'Heavy damage', 'Slow Puncture')] });
const CRIT = { failures: [F1(100, 0, 'Critical damage', 'Engine Failure, Box to Retire')] };

// which races have failures
{ const N = mk({ rec: { failuresOn: 'off' } });
  ok('a race whose Damage System has Car Failures off has none: no rules, no figures on the cars, nothing to ask', N.failures === null && N.failureOf(0, SEC) === null && N.cars.every(c => !('fail' in c) && !('flPlan' in c) && !('failOut' in c)));
  const O = started({ rec: { failuresOn: 'off' } }); drive(O, 0, 0, 300 * SEC);
  ok('...and nothing happens in it', O.events.every(e => !e.type.startsWith('failure')) && O.cars[0].laps.length === 10);
  ok('a race with no Damage System has none either', mk({ damage: null }).failures === null && mk({ damage: null }).failureOf(0, 0) === null);
  ok('a race and a timed race have failures; a practice and a qualifying do not (they have no damage)', mk().failures !== null && mk({ type: 'timed' }).failures !== null && mk({ type: 'practice' }).failures === null && mk({ type: 'qualifying' }).failures === null);
  { const M = mk(); ok('the failures of the race are the cleaned rules of the system', M.failures.list.length === 1 && M.failures.list[0].name === 'Lift and Coast' && M.failures.on === true && M.damage.failures === M.failures); }
  ok('Car Failures with an empty list (or only chances of 0) are on but never come', mk({ rec: { failures: [] } }).failures === null && started({ rec: { failures: [F1(0)] } }).cars.every(c => c.flPlan.length === 0)); }

// the roll at the start
{ const R = mk();
  ok('before the start nothing is rolled', R.cars.every(c => c.flPlan === null && c.fail === null && c.failN === 0 && c.failures.length === 0 && c.failOut === ''));
  R.start(0);
  ok('at the start every car is rolled: this car gets its failure at lap 3, the car with Failure factor 0 gets none', same(R.cars[0].flPlan, [{ k: 0, at: 3 }]) && same(R.cars[1].flPlan, []));
  R.start(5); ok('...once: a second start does not roll again', same(R.cars[0].flPlan, [{ k: 0, at: 3 }]));
  const T = started({ type: 'timed', duration: 10 });
  ok('a timed race is rolled in time: 0.3 of 10 minutes is 3 minutes', same(T.cars[0].flPlan, [{ k: 0, at: 180000 }]));
  const E = started({ entries: [entry(0), entry(1)], rnd: seq(0, 0.3, 0.9, 0.7) });
  ok('every car is rolled by itself with the numbers that come (car 1 gets a failure too, later: lap 7)', same(E.cars[0].flPlan, [{ k: 0, at: 3 }]) && same(E.cars[1].flPlan, [{ k: 0, at: 7 }]));
  ok('the lap limit of a car is its own (a Distance Race: laps differ per lane): the failure falls inside its laps', (() => { const D = RE.createRace({ type: 'race', laps: 20, minLap: 800, rnd: seq(0, 0.5), distance: { lanes: [{ length: 5, laps: 20 }, { length: 10, laps: 10 }], max: 0 },
      damage: Dm.clean({ ...Dm.defaults(), failuresOn: 'on', failFrom: 0, failTo: 100, failures: [F1(100, 8)] }, 0), entries: [entry(0), entry(1)] }); D.start(0); return same(D.cars[0].flPlan, [{ k: 0, at: 10 }]) && same(D.cars[1].flPlan, [{ k: 0, at: 5 }]); })()); }

// a failure starts at its lap
{ const R = started();
  drive(R, 0, 0, 60 * SEC);
  ok('nothing before the lap', R.cars[0].fail === null && types(R, 'failure').length === 0 && R.failureOf(0, 60 * SEC).active === false && R.failureOf(0, 60 * SEC).count === 0);
  R.cross(0, 90 * SEC);
  const f = types(R, 'failure');
  ok('on the crossing that ends lap 3 the failure starts: logged with its name, level, lap, seconds, what it asks and the action', f.length === 1 && f[0].car === 0 && f[0].t === 90 * SEC && f[0].name === 'Lift and Coast' && f[0].level === 'Light damage' && f[0].lap === 3 && f[0].seconds === 8 && f[0].urgent === false && f[0].within === 0 && f[0].action === 'repair' && f[0].due === null);
  ok('...the car has it, counted once', R.cars[0].fail.name === 'Lift and Coast' && R.cars[0].fail.k === 0 && R.cars[0].failN === 1 && R.cars[0].flPlan.length === 0);
  const d = R.failureOf(0, 91 * SEC);
  ok('what a screen is told: it is active, its name, level, what it asks (whenever you can, 8 seconds), amber, nothing to stand yet', d.active === true && d.name === 'Lift and Coast' && d.level === 'Light damage' && d.urgent === false && d.action === 'repair' && d.seconds === 8 && d.within === 0 && d.lapsLeft === null && d.standLeft === null && d.tone === 'amber' && d.out === '' && d.count === 1 && d.repaired === 0 && d.last === '');
  ok('...it adds no damage points, and the damage of the car is untouched', R.cars[0].dmg === 0 && R.damageOf(0, 91 * SEC).points === 0 && R.damageOf(0, 91 * SEC).level === -1 && types(R, 'damage').length === 0);
  ok('the other car has none', R.cars[1].fail === null && R.failureOf(1, 91 * SEC).active === false);
  drive(R, 0, 90 * SEC, 300 * SEC);
  ok('a failure with no deadline is only there: the car drives on, no penalty points', R.cars[0].fail !== null && R.cars[0].points === 0 && types(R, 'failurelate').length === 0 && types(R, 'failure').length === 1); }

// the deadline
{ const R = started({ rec: HEAVY() });
  drive(R, 0, 0, 90 * SEC);
  const d = R.failureOf(0, 91 * SEC);
  ok('a failure of a level with a deadline: it must be in the pits within 3 laps (lap 6), red, as fast as you can', R.cars[0].fail.due === 6 && d.lapsLeft === 3 && d.urgent === true && d.within === 3 && d.tone === 'red' && types(R, 'failure')[0].due === 6 && types(R, 'failure')[0].urgent === true);
  drive(R, 0, 90 * SEC, 180 * SEC);
  ok('...laps count down, and on the lap of the deadline it is not yet late', R.failureOf(0, 181 * SEC).lapsLeft === 0 && types(R, 'failurelate').length === 0 && R.cars[0].points === 0);
  R.cross(0, 210 * SEC);
  const l = types(R, 'failurelate');
  ok('one lap after the deadline: late, logged, and the penalty point of the system is given', l.length === 1 && l[0].name === 'Slow Puncture' && l[0].points === 1 && l[0].lap === 7 && l[0].due === 6 && R.cars[0].points === 1 && R.failureOf(0, 211 * SEC).lapsLeft === -1);
  R.cross(0, 240 * SEC);
  ok('...and again for every lap after that', types(R, 'failurelate').length === 2 && R.cars[0].points === 2);
  ok('...the penalty points are not damage ones: the log says why', R.events.filter(e => e.type === 'penalty').every(e => e.why === 'failurelate')); }
{ const R = started({ rec: HEAVY(), penalty: false }); drive(R, 0, 0, 240 * SEC);
  ok('without a penalty system a late failure is only logged, with no points', types(R, 'failurelate').length === 2 && types(R, 'failurelate').every(e => e.points === 0) && R.cars[0].points === 0); }
{ const R = started({ rec: { ...HEAVY(), latePoints: 0 } }); drive(R, 0, 0, 240 * SEC);
  ok('late points of 0 in the Damage System: no points either', types(R, 'failurelate').every(e => e.points === 0) && R.cars[0].points === 0); }

// the stop in the pits clears it
{ const R = started(); drive(R, 0, 0, 90 * SEC);
  R.block(0, 100 * SEC);
  R.tick(101 * SEC);
  ok('a car that stands on the sensor is not repaired before the pit stop starts (the pit hold of 2 seconds)', R.cars[0].fail !== null && R.cars[0].pit === null && types(R, 'failurerepaired').length === 0);
  R.tick(102 * SEC);
  ok('...the pit stop starts; the car has to stand 8 seconds from the moment it stopped, and a screen is told how long is left', R.cars[0].pit !== null && R.cars[0].fail !== null && R.failureOf(0, 102 * SEC).standLeft === 6 * SEC && R.failureOf(0, 105 * SEC).standLeft === 3 * SEC);
  ok('...the Repair Timer widget shows it too (the failure is repaired, with no damage in the car)', Tm.content({ type: 'repairtimer', lane: 0, opt: {} }, { ...Sx(R, 105 * SEC) }).html === 'Repairing 0:03');
  R.tick(107 * SEC + 900);
  ok('not repaired a moment before the 8 seconds', R.cars[0].fail !== null && types(R, 'failurerepaired').length === 0);
  R.tick(108 * SEC);
  const r = types(R, 'failurerepaired');
  ok('at 8 seconds the failure is cleared: logged with its name and the time, the car has no failure and no stand time left', R.cars[0].fail === null && r.length === 1 && r[0].name === 'Lift and Coast' && r[0].ms === 8 * SEC && r[0].t === 108 * SEC && R.failureOf(0, 108 * SEC).active === false && R.failureOf(0, 108 * SEC).standLeft === null);
  ok('...the car keeps what happened: when it stopped, how long, which failure and in which lap; and the time in the pits for failures', same(R.cars[0].failures, [{ at: 100 * SEC, ms: 8 * SEC, name: 'Lift and Coast', lap: 3 }]) && R.cars[0].failMs === 8 * SEC && R.failureOf(0, 108 * SEC).repaired === 1 && R.failureOf(0, 108 * SEC).last === 'Lift and Coast' && R.failureOf(0, 108 * SEC).count === 1);
  ok('...a failure is not a repair of damage: the repairs of the car are untouched', R.cars[0].repairs.length === 0 && R.cars[0].repairMs === 0 && types(R, 'repaired').length === 0);
  R.tick(110 * SEC); R.unblock(0, 111 * SEC);
  ok('leaving after it costs nothing, and it is cleared once for a stop', types(R, 'failurerepaired').length === 1 && types(R, 'failureearly').length === 0 && R.cars[0].points === 0); }
function Sx(eng, at) { const st = eng.standings(); return { eng, now: at, phase: 'running', lights: 0, setup: { sessionType: 'race', laps: 10 }, heat: null, carByLane: l => eng.cars.find(c => c.lane === l) || null, rowOf: c => st.find(r => r.car === c), flashOf: () => null, personalBest: () => Infinity, champ: { on: false, list: [], done: new Map() } }; }
{ const R = started(); drive(R, 0, 0, 90 * SEC); R.block(0, 100 * SEC); R.tick(102 * SEC);
  R.pause(104 * SEC);
  ok('a pause in a stop: the countdown waits (as the one of the damage does)', R.failureOf(0, 120 * SEC).standLeft === null && R.cars[0].fail !== null);
  R.resume(130 * SEC); R.tick(134 * SEC - 1);
  ok('...the pause does not count: the failure is cleared 8 seconds of racing after the car stopped (at 134 s)', R.cars[0].fail !== null);
  R.tick(134 * SEC);
  ok('...and then it is cleared', R.cars[0].fail === null && types(R, 'failurerepaired').length === 1); }

// the damage and a failure in one stop: the longest job counts
{ const R = started(); drive(R, 0, 0, 90 * SEC); R.addDamage(0, 6, 91 * SEC); R.block(0, 100 * SEC); R.tick(114 * SEC + 900);
  ok('damage of 15 seconds and a failure of 8: nothing is cleared before the 15 seconds', R.cars[0].dmg === 6 && R.cars[0].fail !== null && R.failureOf(0, 110 * SEC).standLeft === 5 * SEC);
  R.tick(115 * SEC);
  ok('...at 15 seconds both are: the damage is repaired and the failure is cleared, in the same stop', R.cars[0].dmg === 0 && R.cars[0].fail === null && types(R, 'repaired').length === 1 && types(R, 'failurerepaired').length === 1 && R.cars[0].repairs.length === 1 && R.cars[0].failures.length === 1);
  ok('...the time of the stop is on both (15 seconds): the damage repair and the failure', R.cars[0].repairs[0].ms === 15 * SEC && R.cars[0].failures[0].ms === 15 * SEC && types(R, 'failurerepaired')[0].ms === 15 * SEC); }
{ const R = started({ rec: { failures: [F1(100, 20)] } }); drive(R, 0, 0, 90 * SEC); R.addDamage(0, 3, 91 * SEC); R.block(0, 100 * SEC); R.tick(119 * SEC + 900);
  ok('a failure of 20 seconds is longer than damage of 10: the failure decides (20 seconds for both)', R.cars[0].dmg === 3 && R.cars[0].fail !== null);
  R.tick(120 * SEC);
  ok('...both are done at 20 seconds', R.cars[0].dmg === 0 && R.cars[0].fail === null); }
{ const R = started({ rec: { stop: 'add', failures: [F1(100, 8)] } }); drive(R, 0, 0, 90 * SEC); R.block(0, 100 * SEC); R.tick(102 * SEC); R.tick(109 * SEC + 900);
  ok('"one after the other": the failure starts when the other work is done (the pit stop starts at 102 s), so 8 seconds later: not at 108 s', R.cars[0].fail !== null);
  R.tick(110 * SEC);
  ok('...but at 110 s', R.cars[0].fail === null && types(R, 'failurerepaired')[0].ms === 10 * SEC); }
{ const R = started({ rec: { failures: [F1(100, 0)] } }); drive(R, 0, 0, 90 * SEC); R.block(0, 100 * SEC); R.tick(101 * SEC);
  ok('a failure of 0 seconds is cleared as soon as the pit stop has started, and not before', R.cars[0].fail !== null);
  R.tick(102 * SEC);
  ok('...at 102 s', R.cars[0].fail === null && types(R, 'failurerepaired')[0].ms === 0); }

// a failure that retires or disqualifies
{ const R = started({ rec: CRIT, entries: [entry(0)] }); drive(R, 0, 0, 90 * SEC);
  const d = R.failureOf(0, 91 * SEC);
  ok('Engine Failure, Box to Retire: pit as fast as you can, within 1 lap, the car is retired', d.name === 'Engine Failure, Box to Retire' && d.action === 'retire' && d.urgent === true && d.lapsLeft === 1 && d.tone === 'out' && R.cars[0].done === false);
  R.block(0, 100 * SEC); R.tick(101 * SEC);
  ok('...nothing happens before the pit stop has started', R.cars[0].done === false && R.cars[0].failOut === '');
  R.tick(102 * SEC);
  const o = types(R, 'failureout');
  ok('...then the car is out: retired, logged with how, and it is not "repaired"', R.cars[0].failOut === 'retire' && R.cars[0].done === true && R.cars[0].retired === true && R.cars[0].dq === false && o.length === 1 && o[0].how === 'retire' && o[0].name === 'Engine Failure, Box to Retire' && types(R, 'failurerepaired').length === 0);
  ok('...the failure is over, with a note of it in the car, and a screen is told the car is out', R.cars[0].fail === null && same(R.cars[0].failures, [{ at: 100 * SEC, ms: 0, name: 'Engine Failure, Box to Retire', lap: 3, out: 'retire' }]) && R.failureOf(0, 103 * SEC).out === 'retire' && R.failureOf(0, 103 * SEC).active === false && R.failureOf(0, 103 * SEC).last === 'Engine Failure, Box to Retire');
  ok('...the only car is out, so the race is over', R.status === 'finished');
  ok('a car that is out takes no more damage', R.addDamage(0, 3, 105 * SEC) === false); }
{ const R = started({ rec: CRIT }); drive(R, 0, 0, 90 * SEC); R.block(0, 100 * SEC); R.tick(102 * SEC);
  ok('with another car still racing, the race goes on', R.cars[0].failOut === 'retire' && R.status === 'running' && R.cars[1].done === false); }
{ const R = started({ rec: { levels: [{ name: 'Gone', from: 5, seconds: 0, urgency: 'asap', within: 0, action: 'dq' }], failures: [F1(100, 3, 'Gone', 'Fatal')] }, entries: [entry(0), entry(1, { failureFactor: 0 })] }); drive(R, 0, 0, 90 * SEC); R.block(0, 100 * SEC); R.tick(102 * SEC + 900);
  ok('a failure of a level that disqualifies: it asks the seconds first (3)', R.cars[0].failOut === '' && R.cars[0].dq === false);
  R.tick(103 * SEC);
  ok('...and then the car is disqualified', R.cars[0].failOut === 'dq' && R.cars[0].dq === true && R.cars[0].done === true && types(R, 'failureout')[0].how === 'dq'); }
{ const R = started({ rec: { ...CRIT }, entries: [entry(0)] }); drive(R, 0, 0, 90 * SEC); R.addDamage(0, 10, 91 * SEC); R.block(0, 100 * SEC); R.tick(102 * SEC);
  ok('damage that retires the car and a failure that retires it in the same stop: it is out once, by the damage, and the failure ends with it', R.cars[0].dmgOut === 'retire' && R.cars[0].failOut === '' && R.cars[0].fail === null && R.cars[0].failures.length === 1 && R.cars[0].failures[0].out === 'retire' && types(R, 'damageout').length === 1 && types(R, 'failureout').length === 1); }

// leaving too early
{ const R = started({ rec: HEAVY(12) }); drive(R, 0, 0, 90 * SEC); R.block(0, 100 * SEC); R.tick(104 * SEC); R.unblock(0, 105 * SEC);
  const e = types(R, 'failureearly');
  ok('leaving before the failure is cleared: logged, and the penalty point of the system is given', e.length === 1 && e[0].name === 'Slow Puncture' && e[0].extra === 1 && R.cars[0].points === 1);
  ok('...the failure stays', R.cars[0].fail !== null && R.failureOf(0, 106 * SEC).active === true && types(R, 'failurerepaired').length === 0 && R.cars[0].pit === null && R.cars[0].blockAt === null);
  ok('...the points say why (the failure, not damage)', R.events.filter(e2 => e2.type === 'penalty').every(e2 => e2.why === 'failure')); }
{ const R = started({ rec: HEAVY(12) }); drive(R, 0, 0, 90 * SEC); R.block(0, 100 * SEC); R.tick(101 * SEC); R.unblock(0, 101 * SEC + 500);
  ok('a stop that was no pit stop (shorter than the pit hold) is not leaving early', types(R, 'failureearly').length === 0 && R.cars[0].points === 0 && R.cars[0].fail !== null); }
{ const R = started({ rec: HEAVY(12), }); drive(R, 0, 0, 90 * SEC); R.addDamage(0, 6, 91 * SEC); R.block(0, 100 * SEC); R.tick(104 * SEC); R.unblock(0, 105 * SEC);
  ok('leaving with the damage and a failure both left: both are logged, the penalty point is given once', types(R, 'repairearly').length === 1 && types(R, 'repairearly')[0].extra === 1 && types(R, 'failureearly').length === 1 && types(R, 'failureearly')[0].extra === 0 && R.cars[0].points === 1 && R.cars[0].dmg === 6 && R.cars[0].fail !== null); }
{ const R = started({ rec: { ...HEAVY(12), earlyPoints: 0 } }); drive(R, 0, 0, 90 * SEC); R.block(0, 100 * SEC); R.tick(104 * SEC); R.unblock(0, 105 * SEC);
  ok('early points of 0 in the Damage System: logged, no points', types(R, 'failureearly').length === 1 && types(R, 'failureearly')[0].extra === 0 && R.cars[0].points === 0); }
{ const R = started(); R.addDamage(0, 3, 5 * SEC); R.block(0, 10 * SEC); R.tick(12 * SEC); R.unblock(0, 13 * SEC);
  ok('damage alone leaves early as it always did (1.10.0): "repairearly", no failure event', types(R, 'repairearly').length === 1 && types(R, 'failureearly').length === 0 && R.cars[0].points === 1); }

// a failure waits for a car that is in the pits, and for the one before it
{ const R = started({ rec: { failures: [F1(100, 5, 'Light damage', 'First'), F1(100, 5, 'Light damage', 'Second')], failMax: 2 }, entries: [entry(0)], rnd: seq(0, 0, 0.2, 0.3) });
  ok('two failures for one car: at lap 2 and lap 3', same(R.cars[0].flPlan, [{ k: 0, at: 2 }, { k: 1, at: 3 }]));
  drive(R, 0, 0, 60 * SEC);
  ok('the first comes at lap 2', R.cars[0].fail.name === 'First' && R.cars[0].flPlan.length === 1);
  R.cross(0, 90 * SEC);
  ok('...the second is due at lap 3, but a car has one failure at a time: it waits', R.cars[0].fail.name === 'First' && R.cars[0].flPlan.length === 1 && types(R, 'failure').length === 1);
  R.block(0, 100 * SEC); R.tick(106 * SEC);
  ok('...the stop clears the first', R.cars[0].fail === null && types(R, 'failurerepaired').length === 1);
  R.tick(107 * SEC);
  ok('...a car that is still in the pits does not get the next one yet', R.cars[0].fail === null && R.cars[0].flPlan.length === 1);
  R.unblock(0, 108 * SEC); R.tick(109 * SEC);
  ok('...it comes when the car is back on the track', R.cars[0].fail !== null && R.cars[0].fail.name === 'Second' && types(R, 'failure').length === 2 && R.cars[0].failN === 2 && R.cars[0].flPlan.length === 0);
  ok('...and the lap in it is the lap the car is in then (not the lap that was planned)', types(R, 'failure')[1].lap === R.cars[0].laps.length); }

// a timed race: by the clock
{ const R = started({ type: 'timed', duration: 10 });
  R.tick(179 * SEC + 900);
  ok('a failure of a timed race comes by the clock, with no crossing needed: not before 3 minutes', R.cars[0].fail === null);
  R.tick(180 * SEC);
  ok('...at 3 minutes', R.cars[0].fail !== null && R.cars[0].fail.name === 'Lift and Coast' && types(R, 'failure')[0].t === 180 * SEC && R.cars[1].fail === null); }

// a car that is out or done gets none
{ const R = started({ entries: [entry(0)] }); R.cars[0].done = true; drive(R, 0, 0, 90 * SEC); R.tick(100 * SEC);
  ok('a car that has finished gets no failure', R.cars[0].fail === null && types(R, 'failure').length === 0);
  const Q = started({ entries: [entry(0)] }); Q.cars[0].dq = true; Q.tick(100 * SEC); Q.cross(0, 91 * SEC);
  ok('...nor a disqualified one', Q.cars[0].fail === null);
  const P = started({ entries: [entry(0)] }); P.pause(5 * SEC); drive(P, 0, 0, 90 * SEC); P.tick(100 * SEC);
  ok('...nothing starts while the race is paused', P.cars[0].fail === null); }

// the Failure factor reaches the engine from the entry
{ const R = started({ entries: [entry(0, { failureFactor: 3 }), entry(1)], rec: { failures: [F1(40)] }, rnd: seq(0.2, 0.5, 0.5, 0.5) });
  ok('a car with a Failure factor of 3 gets a failure of 40% with a roll of 0.2 (60 < 120); a car with 1 does not get it with 0.5', R.cars[0].flPlan.length === 1 && R.cars[1].flPlan.length === 0 && R.cars[0].failureFactor === 3); }

// an interrupted race
{ const R = started(); drive(R, 0, 0, 90 * SEC); R.block(0, 100 * SEC); R.tick(102 * SEC);
  const snap = R.snapshot(104 * SEC), Q = mk(); Q.start(0);
  ok('the snapshot of an interrupted race holds the failure and the plan', snap.cars[0].fail && snap.cars[0].fail.name === 'Lift and Coast' && Array.isArray(snap.cars[0].flPlan));
  ok('...restoring it brings the failure back, as it was', Q.restore(JSON.parse(JSON.stringify(snap))) && Q.cars[0].fail !== null && Q.cars[0].fail.name === 'Lift and Coast' && Q.cars[0].failN === 1 && Q.status === 'paused');
  Q.resume(150 * SEC); Q.tick(151 * SEC);
  ok('...and the stop goes on: the failure is cleared 8 seconds after the car stopped (the time of the pause does not count)', Q.cars[0].fail !== null);
  Q.tick(150 * SEC + 4 * SEC + 1);
  ok('...4 seconds were left when it stopped (104 s of 108 s): cleared at 154 s', Q.cars[0].fail === null && types(Q, 'failurerepaired').length === 1); }
{ const R = started({ entries: [entry(0)], rec: { failures: [F1(100, 5, 'Light damage', 'First'), F1(100, 5, 'Light damage', 'Second')], failMax: 2 }, rnd: seq(0, 0, 0.5, 0.8) });
  const snap = R.snapshot(10 * SEC), Q = mk({ entries: [entry(0)], rec: { failures: [F1(100, 5, 'Light damage', 'First'), F1(100, 5, 'Light damage', 'Second')], failMax: 2 }, rnd: seq(0.1) }); Q.start(0);
  ok('the plan is kept too (the failures that have not come yet): the restored race does not roll again', Q.restore(JSON.parse(JSON.stringify(snap))) && same(Q.cars[0].flPlan, R.cars[0].flPlan) && Q.cars[0].flPlan.length === 2); }

// what the other windows are told
{ const R = started(); const cx = t => ({ raceId: 'x', eng: R, phase: 'running', calling: false, lights: 5, heat: null, flash: new Map(), bestAll: Infinity, bestAllName: '', bestBy: new Map(), now: t, champ: null }), wire = m => JSON.parse(JSON.stringify(m));
  const Sn = LS.sender(), m1 = wire(Sn.pack(cx(1000), 1000));
  ok('a car that never had a failure sends no failure figures (and not the plan, which nobody may see)', m1.cars.every(c => !('fail' in c) && !('failN' in c) && !('flPlan' in c)));
  drive(R, 0, 0, 90 * SEC);
  const m2 = wire(Sn.pack(cx(91000), 91000)), a = LS.applyDynamic(null, m2);
  ok('a car with a failure sends it, and a receiver has it (the name, the count)', a.ok && m2.cars[0].fail.name === 'Lift and Coast' && m2.cars[0].failN === 1 && a.state.cars[0].fail.name === 'Lift and Coast' && a.state.cars[0].failN === 1 && m2.cars.every(c => !('flPlan' in c)));
  const st = LS.packStatic({ eng: R, base: { personal: new Map(), track: Infinity, trackName: '' } });
  let cloned = true; try { structuredClone(st); } catch { cloned = false; }
  ok('the rules travel in the settings of the race (no function in them), so a viewer knows the failures', cloned && st.cfg.damage.failures && st.cfg.damage.failures.list[0].name === 'Lift and Coast' && !('rnd' in st.cfg));
  R.block(0, 100 * SEC); R.tick(108 * SEC);
  const m3 = wire(Sn.pack(cx(108000), 108000)), b = LS.applyDynamic(a.state, m3);
  ok('...and when it is cleared the receiver hears that, and keeps the list of what was cleared', b.ok && b.state.cars[0].fail === null && b.state.cars[0].failures.length === 1 && b.state.cars[0].failures[0].name === 'Lift and Coast');
  const V = LS.viewer(); V.feedStatic(wire(LS.packStatic({ raceId: 'x', eng: R, base: { personal: new Map(), track: Infinity, trackName: '' } }))); const fed = V.feedDynamic(wire(LS.packDynamic(cx(109000))), 109000);
  ok('a viewer builds an engine that knows the failures and answers for them', fed === true && V.engine().failures !== null && V.engine().failureOf(0, 109000).count === 1 && V.engine().failureOf(0, 109000).repaired === 1 && V.engine().failureOf(0, 109000).active === false); }
{ const R = started({ rec: CRIT, entries: [entry(0), entry(1, { failureFactor: 0 })] }); drive(R, 0, 0, 90 * SEC); R.block(0, 100 * SEC); R.tick(102 * SEC);
  const Sn = LS.sender(), m = JSON.parse(JSON.stringify(Sn.pack({ raceId: 'x', eng: R, phase: 'running', calling: false, lights: 5, heat: null, flash: new Map(), bestAll: Infinity, bestAllName: '', bestBy: new Map(), now: 103000, champ: null }, 103000)));
  ok('a car that a failure retired sends that', m.cars[0].failOut === 'retire' && LS.applyDynamic(null, m).state.cars[0].failOut === 'retire'); }

// ---- the Race Director log ----
{ const vm = require('vm'), fs = require('fs'), path = require('path'), ctx = vm.createContext({ console }),
    PP = vm.runInContext(fs.readFileSync(path.join(__dirname, '../renderer/penaltyui.js'), 'utf8') + '\n;PenaltyPanel', ctx);
  const R = started({ rec: HEAVY(12), entries: [entry(0, { driverName: 'Alex <A>' }), entry(1, { failureFactor: 0 })] }); drive(R, 0, 0, 90 * SEC); drive(R, 0, 90 * SEC, 210 * SEC);
  R.block(0, 220 * SEC); R.tick(224 * SEC); R.unblock(0, 225 * SEC); R.block(0, 240 * SEC); R.tick(252 * SEC);
  const h = PP.logHtml(R);
  ok('the log tells when a car has a failure, that it is late, that it left too early and that it was repaired (names are safe)', h.includes('Alex &lt;A&gt; has a failure: Slow Puncture'));
  ok('...each line in words', h.includes('is late for the pits (Slow Puncture), +1 penalty point') && h.includes('left the pits before the failure was cleared (Slow Puncture), +1 penalty point') && h.includes('repaired: Slow Puncture (12 s in the pits)') && h.includes('Alex &lt;A&gt;'));
  const E = started({ rec: CRIT, entries: [entry(0), entry(1, { failureFactor: 0 })] }); drive(E, 0, 0, 90 * SEC); E.block(0, 100 * SEC); E.tick(102 * SEC);
  ok('...and that a failure retired the car', PP.logHtml(E).includes('is retired by a failure (Engine Failure, Box to Retire)') && PP.logHtml(E).includes('has a failure: Engine Failure, Box to Retire'));
  const Q = started({ rec: { levels: [{ name: 'Gone', from: 5, seconds: 0, urgency: 'asap', within: 0, action: 'dq' }], failures: [F1(100, 0, 'Gone', 'Fatal')] }, entries: [entry(0), entry(1, { failureFactor: 0 })] }); drive(Q, 0, 0, 90 * SEC); Q.block(0, 100 * SEC); Q.tick(102 * SEC);
  ok('...or disqualified it', PP.logHtml(Q).includes('is disqualified by a failure (Fatal)')); }

// ---- the Car Failure widget ----
const C = (eng, at, type, lane, opt) => { eng.tick(at); return Tm.content({ type, lane, opt }, Sx(eng, at)); };
const TXT = (eng, at, lane, text = '{failure}|{failures}') => C(eng, at, 'textlane', lane, { text }).html;
{ const N = mk({ damage: null }); N.start(0);
  ok('without Car Failures the widget shows a dash, and the texts too', C(N, SEC, 'carfailure', 0, {}).html === '–' && TXT(N, SEC, 0) === '–|–' && C(mk({ rec: { failuresOn: 'off' } }), SEC, 'carfailure', 0, {}).html === '–'); }
{ const R = started({ rec: { failures: [F1(100, 8, 'Light damage', 'Lift <b> and Coast')] } });
  ok('a car without a failure: "No failure" (or your own text, or nothing); no colour', C(R, SEC, 'carfailure', 0, {}).html === 'No failure' && !C(R, SEC, 'carfailure', 0, {}).bg && C(R, SEC, 'carfailure', 0, { noneText: 'All good' }).html === 'All good' && C(R, SEC, 'carfailure', 0, { showNone: false }).html === '' && C(R, SEC, 'carfailure', 0, { noneText: '   ' }).html === 'No failure');
  ok('...and nothing for a lane without a car', C(R, SEC, 'carfailure', 5, {}).html === '');
  ok('...the texts: "No failure" and 0', TXT(R, SEC, 0) === 'No failure|0');
  drive(R, 0, 0, 90 * SEC);
  const a = C(R, 91 * SEC, 'carfailure', 0, {});
  ok('a failure to pit for whenever you can: the name and what it asks, amber (the name is safe to show)', a.html === 'Lift &lt;b&gt; and Coast · Pit whenever you can' && a.bg === '#ffb000' && !!a.color);
  ok('...only the name when the widget says so, and the colour is the widget\'s own', C(R, 91 * SEC, 'carfailure', 0, { show: 'name' }).html === 'Lift &lt;b&gt; and Coast' && C(R, 91 * SEC, 'carfailure', 0, { amberColor: '#00aa00' }).bg === '#00aa00');
  ok('...the texts: the name and 1', TXT(R, 91 * SEC, 0) === 'Lift &lt;b&gt; and Coast|1' && TXT(R, 91 * SEC, 1) === 'No failure|0');
  R.block(0, 100 * SEC);
  const s = C(R, 104 * SEC, 'carfailure', 0, {});
  ok('on the sensor in the pits the repair counts down in green', s.html === 'Lift &lt;b&gt; and Coast · Repairing 0:04' && s.bg === '#3ddc84' && C(R, 104 * SEC, 'carfailure', 0, { show: 'name' }).html === 'Lift &lt;b&gt; and Coast' && C(R, 104 * SEC, 'carfailure', 0, { standColor: '#102030' }).bg === '#102030');
  R.tick(108 * SEC);
  ok('when it is cleared, "No failure" again; the texts still count it', C(R, 108 * SEC, 'carfailure', 0, {}).html === 'No failure' && TXT(R, 108 * SEC, 0) === 'No failure|1'); }
{ const R = started({ rec: HEAVY() }); drive(R, 0, 0, 90 * SEC);
  const h = C(R, 91 * SEC, 'carfailure', 0, {});
  ok('a failure to pit for as fast as you can, within 3 laps: red, "Pit in 3 laps"', h.html === 'Slow Puncture · Pit in 3 laps' && h.bg === '#e03131' && C(R, 91 * SEC, 'carfailure', 0, { redColor: '#112233' }).bg === '#112233');
  drive(R, 0, 90 * SEC, 180 * SEC);
  ok('...the last lap says "Pit now"', C(R, 181 * SEC, 'carfailure', 0, {}).html === 'Slow Puncture · Pit now');
  drive(R, 0, 180 * SEC, 210 * SEC);
  ok('...and a car that is late says how late (red)', C(R, 211 * SEC, 'carfailure', 0, {}).html === 'Slow Puncture · Pit now, 1 lap late' && C(R, 211 * SEC, 'carfailure', 0, {}).bg === '#e03131'); }
{ const R = started({ rec: { failures: [F1(100, 4, 'Light damage', 'Soft failure')] } }); drive(R, 0, 0, 90 * SEC);
  ok('a failure with no deadline in a level that is urgent says so: "Pit as fast as you can"', (() => { const U = started({ rec: { levels: [{ name: 'Urgent', from: 3, seconds: 5, urgency: 'asap', within: 0, action: 'repair' }], failures: [F1(100, 4, 'Urgent', 'Hurry')] } }); drive(U, 0, 0, 90 * SEC); const x = C(U, 91 * SEC, 'carfailure', 0, {}); return x.html === 'Hurry · Pit as fast as you can' && x.bg === '#e03131'; })()); }
{ const R = started({ rec: CRIT, entries: [entry(0), entry(1, { failureFactor: 0 })] }); drive(R, 0, 0, 90 * SEC);
  const e = C(R, 91 * SEC, 'carfailure', 0, {});
  ok('a failure that ends the car is red while the car is on the track', e.html === 'Engine Failure, Box to Retire · Pit in 1 lap' && e.bg === '#e03131');
  R.block(0, 100 * SEC);
  const o = C(R, 103 * SEC, 'carfailure', 0, {});
  ok('...a car that it retired says RETIRED in the colour for it', o.html === 'RETIRED' && o.bg === '#555b66' && C(R, 103 * SEC, 'carfailure', 0, { outColor: '#123456' }).bg === '#123456' && TXT(R, 103 * SEC, 0) === 'Retired|1');
  ok('...the other car is not affected', C(R, 103 * SEC, 'carfailure', 1, {}).html === 'No failure'); }
{ const R = started({ rec: { levels: [{ name: 'Gone', from: 5, seconds: 0, urgency: 'asap', within: 0, action: 'dq' }], failures: [F1(100, 0, 'Gone', 'Fatal')] }, entries: [entry(0), entry(1, { failureFactor: 0 })] }); drive(R, 0, 0, 90 * SEC); R.block(0, 100 * SEC);
  const o = C(R, 103 * SEC, 'carfailure', 0, {});
  ok('a disqualified car says DQ in red', o.html === 'DQ' && o.bg === '#d62828' && TXT(R, 103 * SEC, 0) === 'Disqualified|1'); }

// ---- the widget in the register, the texts, the slot car and the Damage System form ----
{ const d = Wd.def('carfailure');
  ok('the Car Failure widget is in the Slotcar folder, one per lane, with settings and a sample for the Layout Editor', d && d.group === 'Slotcar' && d.label === 'Car Failure' && d.perLane === true && d.options.map(o => o.key).join() === 'show,showNone,noneText,amberColor,redColor,standColor,outColor' && [0, 1, 2, 3].every(l => typeof Wd.sampleOf(d, l, { opt: {} }) === 'string'));
  ok('...it shows the title Car failure', Wd.titleOf({ type: 'carfailure', title: '' }) === 'Car failure');
  ok('...the sample follows the settings: only the name, or nothing / your own text when there is no failure', Wd.sampleOf(d, 1, { opt: { show: 'name' } }) === 'Lift and Coast' && Wd.sampleOf(d, 0, { opt: { showNone: false } }) === '' && Wd.sampleOf(d, 0, { opt: { noneText: 'Fine' } }) === 'Fine' && Wd.sampleOf(d, 2, { opt: {} }) === 'Slow Puncture · Pit in 2 laps');
  ok('it sits right after the Repair Timer', Wd.REGISTRY.findIndex(x => x.type === 'repairtimer') + 1 === Wd.REGISTRY.findIndex(x => x.type === 'carfailure'));
  const names = (Wd.TEXT_LANE_VARS || []).map(v => v[0]);
  ok('the text widgets list {failure} and {failures}', names.includes('failure') && names.includes('failures') || JSON.stringify(Wd).length > 0 && Wd.REGISTRY.some(x => x.type === 'textlane' && JSON.stringify(x.options).includes('{failure} ') && JSON.stringify(x.options).includes('{failures} '))); }
{ const f = schema.slotcars.fields.find(x => x.key === 'failureFactor'), g = schema.slotcars.fields.find(x => x.key === 'damageFactor');
  ok('a slot car has a Failure factor, next to the Damage factor: a number from 0, empty = 1, in the technical details', f && f.type === 'number' && f.min === 0 && f.group === 'technical' && f.default === 1 && f.optional === true && schema.slotcars.fields.indexOf(f) === schema.slotcars.fields.indexOf(g) + 1 && /Car Failures/.test(f.label)); }
{ const ds = schema.damagesystems, k = n => ds.fields.find(x => x.key === n);
  ok('the Damage System has a folder Car Failures between Incidents and Penalty points', ds.groups.map(g => g.id).join() === 'basics,levels,incidents,failures,fines' && ds.groups.find(g => g.id === 'failures').title === 'Car Failures');
  ok('...with the switch (off to begin with), the table, the earliest and latest moment, and the most for a car', ds.fields.filter(x => x.group === 'failures').map(x => x.key).join() === 'failuresOn,failures,failFrom,failTo,failMax' && k('failuresOn').default === 'off' && k('failuresOn').options.map(o => o[0]).join() === 'off,on' && k('failures').type === 'carfailures');
  ok('...the table and the numbers are only shown when Car Failures are on', ['failures', 'failFrom', 'failTo', 'failMax'].every(n => JSON.stringify(k(n).showIf) === JSON.stringify([{ failuresOn: ['on'] }])) && !k('failuresOn').showIf);
  ok('...10% to 90% and one failure to begin with', k('failFrom').default === 10 && k('failTo').default === 90 && k('failMax').default === 1 && k('failMax').min === 1 && k('failFrom').max === 100 && k('failTo').max === 100); }

console.log(fails ? `\n${fails} FAILED` : '\nALL CAR FAILURE TESTS PASSED');
process.exit(fails ? 1 : 0);
