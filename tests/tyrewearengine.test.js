// 1.40.0: Tyre Wear in the race engine (engine.js): the life of the tyres goes down with every lap that counts, the grip curve works through the fuel levers (with Balance of Power and the weather),
// the rule at 0%, a pit stop that gives a fresh set (with a time to change, at the same time as the other work or after it), the pause and the snapshot, and: lap times are never touched.
const E = require('../renderer/engine.js'), T = require('../renderer/tyrewear.js'), W = require('../renderer/weather.js'), Bp = require('../renderer/bop.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const near = (a, b, d = 1e-6) => Math.abs(a - b) < d;

const fuel = (x = {}) => ({ on: true, tank: 100, perLap: 2, rate: 10, target: 0, extra: 0, saving: 0, empty: 'retire', pitHold: 2000, ...x });
const pen = { on: true, mode: 'every', every: 5, seconds: 5, steps: [], dq: 0, types: [], fuelPoints: 0 };
const entries = (n, tyres = ['S', 'M', 'H', 'W']) => Array.from({ length: n }, (_, i) => ({ lane: i, driverId: 'd' + i, carId: 'c' + i, driverName: 'D' + i, carName: 'car' + i, tyre: tyres[i] }));
// rec: the record of the Tyre Wear System; o: { type, cars, tyres, noFuel, noPenalty, ctx (lane lengths...), weather (a weather record), bop, fuel }
const race = (rec, o = {}) => {
  const r = E.createRace({ type: o.type || 'race', laps: 60, duration: 30, endRule: 'all', entries: entries(o.cars || 2, o.tyres), fuel: o.noFuel ? undefined : fuel(o.fuel), penalty: o.noPenalty ? undefined : pen,
    tyrewear: rec === null ? undefined : T.clean(rec, o.ctx), weather: o.weather ? W.clean(o.weather, 1) : undefined, bop: o.bop, ...(o.cfg || {}) });
  r.start(0); return r;
};
const at = (r, i, t) => r.cross(i, t), pit = (r, i, tb, held = 2500) => { r.block(i, tb); r.tick(tb + held); };
const evs = (r, ...types) => r.events.filter(e => types.includes(e.type));
const lit = (r, i) => Math.round(r.fuelOf(i, 1e9) * 1e6) / 1e6;
const clocks = new WeakMap(), clock = r => { if (!clocks.has(r)) { const t = r.cars.map(() => 0); clocks.set(r, (i, ms) => { t[i] += ms; return r.cross(i, t[i]); }); } return clocks.get(r); };
const drive = (r, laps, ms = 10000) => { const go = clock(r); for (let n = 0; n < laps; n++) r.cars.forEach((_, i) => go(i, ms)); };
const FAST = { tyres: { S: { wear: 50 }, M: { wear: 50 }, H: { wear: 50 }, W: { wear: 50 } } }; // two laps to nothing (only the tyres that a test drives are given)

// ---- when it is there ----
{ const rec = {};
  ok('Tyre Wear is for a race and a timed race (heats are those two); practice and qualifying only when the system says so; a system that is off is no system',
    ['race', 'timed'].every(type => E.createRace({ type, laps: 5, duration: 10, entries: entries(2), tyrewear: T.clean(rec) }).tyrewear !== null)
    && ['practice', 'qualifying'].every(type => E.createRace({ type, duration: 10, entries: entries(2), tyrewear: T.clean(rec) }).tyrewear === null)
    && ['practice', 'qualifying'].every(type => E.createRace({ type, duration: 10, entries: entries(2), tyrewear: T.clean({ practice: 'on', qualifying: 'on' }) }).tyrewear !== null)
    && E.createRace({ type: 'practice', duration: 10, entries: entries(2), tyrewear: T.clean({ practice: 'on' }) }).tyrewear !== null && E.createRace({ type: 'qualifying', duration: 10, entries: entries(2), tyrewear: T.clean({ practice: 'on' }) }).tyrewear === null);
  ok('a race without it has nothing: no settings, no life shown, nothing changes', (() => { const r = race(null); drive(r, 3); return r.tyrewear === null && r.twOf(0, 0) === null && r.cars.every(c => c.tw === 0 && c.twLife === 100) && !evs(r, 'tyrefresh', 'tyreworn').length; })());
  ok('every car starts on a fresh set: 100%, no stops', (() => { const r = race(rec); return r.cars.every(c => c.twLife === 100 && c.twStops === 0 && c.tw !== undefined); })()); }

// ---- the wear of a lap ----
{ const r = race({}); at(r, 0, 10000); at(r, 1, 10000);
  ok('a lap that counts wears the tyre: a Soft loses 4.5%, a Medium 3% (my defaults, dry weather)', near(r.cars[0].twLife, 95.5) && near(r.cars[1].twLife, 97));
  at(r, 0, 20000); at(r, 1, 20000);
  ok('...every lap again: 91 and 94', near(r.cars[0].twLife, 91) && near(r.cars[1].twLife, 94));
  ok('the measured lap times are exactly what they were: the wear never touches them', same(r.cars[0].laps, [10000, 10000]) && r.cars[0].best === 10000 && r.cars[0].total === 20000);
  const q = race(null); at(q, 0, 10000); at(q, 0, 20000);
  ok('...the same as a race without Tyre Wear (laps, best, total, standings)', same(q.cars[0].laps, r.cars[0].laps) && q.cars[0].best === r.cars[0].best && same(q.standings().map(x => x.index), r.standings().map(x => x.index)));
  ok('what a screen asks for: the tyre, the life, the level, what is left, the stops', (() => { const d = r.twOf(0, 20000); return d.tyre === 'S' && near(d.life, 91) && d.level === 'ok' && Math.ceil(d.left.laps) === 21 && d.stops === 0 && d.fitting === null && d.fitLeft === null; })()); }
{ const r = race({ ...FAST }); at(r, 0, 10000); at(r, 0, 20000); at(r, 0, 30000);
  ok('the life stops at 0% (it is never negative) and the event is logged once, with the lap and the rule', r.cars[0].twLife === 0 && evs(r, 'tyreworn').length === 1 && evs(r, 'tyreworn')[0].car === 0 && evs(r, 'tyreworn')[0].lap === 2 && evs(r, 'tyreworn')[0].tyre === 'S' && evs(r, 'tyreworn')[0].rule === 'points'); }
{ const r = race({ tyres: { S: { wear: 10 } } }, { weather: { startAt: 1, cloudyFor: 0, rainFor: 9, clearingFor: 0 } }); at(r, 0, 10000); at(r, 1, 10000); at(r, 0, 20000);
  ok('the weather changes the wear: once the leader has a lap the rain has begun, and a Soft wears x2.5 in the wet (10% -> 25%)', r.wxState === 'wet' && near(r.cars[0].twLife, 100 - 10 - 25)); }
{ const r = race({}, { type: 'practice', cfg: { }, cars: 1 }); at(r, 0, 10000);
  ok('practice, with the system off for it: no wear', r.cars[0].twLife === 100); }
{ const r = race({ practice: 'on' }, { type: 'practice', cars: 1 }); at(r, 0, 10000);
  ok('...and on: the tyres wear in practice too', near(r.cars[0].twLife, 95.5)); }

// ---- per distance ----
{ const r = race({ unit: 'distance' }, { ctx: { laneLen: [15.4, 20] } }); at(r, 0, 10000); at(r, 1, 10000);
  ok('per distance the wear is per 100 m: a Soft on a lane of 15.4 m loses 0.693% a lap, a Medium on a lane of 20 m 0.6%', near(r.cars[0].twLife, 100 - 4.5 * 0.154) && near(r.cars[1].twLife, 100 - 3 * 0.2));
  const s = race({ unit: 'distance' }, { ctx: { laneLen: [15.4, 15.4] }, tyres: ['S', 'S'] }); const q = race({ unit: 'distance' }, { ctx: { laneLen: [15.4, 30.8] }, tyres: ['S', 'S'] }); at(q, 0, 10000); at(q, 1, 10000);
  ok('a lane twice as long wears the same tyre twice as fast per lap', near(100 - q.cars[1].twLife, 2 * (100 - q.cars[0].twLife)));
  const n = race({ unit: 'distance' }, { tyres: ['S', 'S'] }); at(n, 0, 10000);
  ok('without lane lengths the lap is the distance (the numbers count per lap)', near(n.cars[0].twLife, 95.5)); }

// ---- the grip curve through the fuel levers ----
{ const r = race({}, { tyres: ['S', 'H'] });
  ok('new tyres help: a Soft +5%, a Hard 0%; the car gets the percentage before the first lap (and a full tank of its own size)', r.cars[0].tw === 5 && r.cars[1].tw === 0 && r.factorsOf(0).use === 0.95 && r.factorsOf(1).use === 1);
  at(r, 0, 10000); at(r, 1, 10000);
  ok('a Soft that helps by 5% uses 1.9 litres a lap instead of 2 (the Hard car uses 2)', lit(r, 0) === 98.1 && lit(r, 1) === 98); }
{ const r = race({ tyres: { S: { wear: 35, bonus: 5, cliff: 30, hind: 30 } } }, { tyres: ['S', 'S'] });
  at(r, 0, 10000); // life 65: half of the bonus left
  ok('the bonus fades as the tyre wears: at 65% life it is +3% (2.5 rounded)', near(r.cars[0].twLife, 65) && r.cars[0].tw === 3);
  at(r, 0, 20000); // life 30: the cliff
  ok('...nothing at the cliff (30%)', near(r.cars[0].twLife, 30) && r.cars[0].tw === 0 && r.factorsOf(0).use === 1);
  at(r, 0, 30000); // life 0
  ok('...and at 0% the car is hindered by the whole hindrance: -30%, it uses 30% more fuel (2.6 litres)', r.cars[0].twLife === 0 && r.cars[0].tw === -30 && Math.abs(r.factorsOf(0).use - 1.3) < 1e-9 && Math.abs(r.factorsOf(0).rate - 0.7) < 1e-9); }
{ const r = race({ eRate: 'off' }, { tyres: ['S', 'S'], cfg: {} });
  ok('every lever can be switched off: with the refuelling lever off a Soft that helps does not refuel faster', r.cars[0].tw === 5 && r.factorsOf(0).use === 0.95 && r.factorsOf(0).rate === 1);
  const z = race({ eUse: 'off', eRate: 'off', eTank: 'on' });
  ok('...the tank lever makes the tank 5% bigger for a car that is helped (105 litres: the car starts with a full tank of its own size)', z.cars[0].tw === 5 && z.tankOf(0) === 105 && lit(z, 0) === 105 && z.factorsOf(0).use === 1); }
{ const r = race({ effect: 'off' }); at(r, 0, 10000);
  ok('with the grip effect off the tyres wear and the rule works, but the fuel rules are left alone', r.cars[0].tw === 0 && lit(r, 0) === 98 && r.twOf(0, 0).effect === null && near(r.cars[0].twLife, 95.5)); }
{ const r = race({}, { noFuel: true }); at(r, 0, 10000);
  ok('without a Fuel setup there is nothing to hinder: the tyres still wear and are shown, there is just no effect', r.cars[0].tw === 0 && near(r.cars[0].twLife, 95.5) && r.twOf(0, 0).effect === null && r.fuelOf(0, 1e9) === null); }
{ const bop = Bp.engineConfig({}, [15, 15]);
  const r = race({}, { tyres: ['S', 'S'], bop }); r.bopSet(0, -20, 0, 'director'); at(r, 0, 10000);
  ok('Balance of Power and the tyres add up lever by lever: BoP -20% and a Soft +5% is -15% (the car uses 15% more fuel)', r.cars[0].bop === -20 && r.cars[0].tw === 5 && Math.abs(r.factorsOf(0).use - 1.15) < 1e-9);
  const w = race({ tyres: { S: { bonus: 90, wear: 1 } } }, { tyres: ['S', 'S'], bop }); w.bopSet(0, 90, 0, 'director');
  ok('...never more than 90% (a bonus of 90 and a BoP of +90 gives 90, not 180)', w.cars[0].tw === 90 && Math.abs(w.factorsOf(0).use - 0.1) < 1e-9); }
{ const r = race({ tyres: { S: { wear: 4.5, bonus: 5, cliff: 30, hind: 30 } } }, { tyres: ['S', 'S'], weather: { startAt: 1, cloudyFor: 0, rainFor: 9, clearingFor: 0 } }); at(r, 0, 10000); at(r, 1, 10000);
  ok('the weather and the tyres add up: dry tyres in the rain are hindered 25% by the weather; with the Soft bonus (+5%) the car has -20%', r.wxState === 'wet' && r.cars[0].wx === -25 && r.cars[0].tw >= 4 && r.cars[0].tw <= 5 && Math.abs(r.factorsOf(0).use - (1 + (25 - r.cars[0].tw) / 100)) < 1e-9); }

// ---- the rule at 0% ----
{ const r = race({ ...FAST, zero: 'points', zeroPoints: 2 }); [10000, 20000, 30000, 40000].forEach(t => at(r, 0, t));
  ok('penalty points every lap at 0%: the lap that wears the tyres out is free, then 2 points for every lap on worn out tyres', r.cars[0].twLife === 0 && r.cars[0].laps.length === 4 && r.cars[0].points === 4 && evs(r, 'penalty').filter(e => e.why === 'tyres').length === 2); }
{ const r = race({ ...FAST, zero: 'points' }, { noPenalty: true }); [10000, 20000, 30000, 40000].forEach(t => at(r, 0, t));
  ok('...without a penalty system there are no points, the race goes on', r.cars[0].points === 0 && r.cars[0].laps.length === 4); }
{ const r = race({ ...FAST, zero: 'none' }); [10000, 20000, 30000, 40000].forEach(t => at(r, 0, t));
  ok('nothing at 0%: the tyres are shown as worn out, and the car races on', r.cars[0].points === 0 && r.cars[0].laps.length === 4 && r.cars[0].twLife === 0 && r.twOf(0, 0).level === 'out'); }
{ const r = race({ ...FAST, zero: 'lap' }); at(r, 0, 10000); at(r, 0, 20000);
  ok('the lap does not count until the car pits: with 0% life the crossing is not a lap', r.cars[0].twLife === 0 && at(r, 0, 30000) === false && r.cars[0].laps.length === 2 && at(r, 0, 40000) === false && r.cars[0].laps.length === 2);
  pit(r, 0, 41000); r.unblock(0, 45000);
  ok('...a pit stop gives new tyres, and then the lap counts again (as long as it took)', r.cars[0].twLife === 100 && at(r, 0, 50000) === true && r.cars[0].laps.length === 3 && r.cars[0].laps[2] === 30000);
  ok('...the time of that lap is what was measured', r.cars[0].laps[2] === 50000 - 20000); }
{ const r = race({ ...FAST, zero: 'retire' }); at(r, 0, 10000); at(r, 0, 20000);
  ok('the car retires at 0%: on the next crossing it is out, with the reason in the log, and the race goes on for the others', at(r, 0, 30000) === false && r.cars[0].retired && r.cars[0].done && r.cars[0].laps.length === 2 && evs(r, 'retired').length === 1 && evs(r, 'retired')[0].why === 'tyres' && !r.cars[1].retired); }

// ---- a pit stop gives a fresh set ----
// (a car that stops on the sensor has crossed the line: that lap counts, so a stop after two laps is the third lap, and the car comes in with 86.5% on a Soft)
{ const r = race({ changeSeconds: 0 }); at(r, 0, 10000); at(r, 0, 20000); pit(r, 0, 30000);
  ok('without a time to change tyres the new set is on from the start of the stop: 100%, one stop', r.cars[0].twLife === 100 && r.cars[0].twStops === 1 && r.cars[0].twDoneAt === 30000 && evs(r, 'tyrefresh').length === 1 && evs(r, 'tyrefresh')[0].tyre === 'S' && evs(r, 'tyrefresh')[0].ms === 0);
  ok('...the log has the stop, then the new tyres', evs(r, 'pitstart', 'tyrefresh').map(e => e.type).join() === 'pitstart,tyrefresh' && r.twOf(0, 33500).fitting === null); }
{ const r = race({ changeSeconds: 4 }); at(r, 0, 10000); at(r, 0, 20000); r.block(0, 30000); r.tick(32500);
  ok('with 4 seconds to change tyres the car is still on its old tyres when the stop has started (2 s): 86.5%, the stop is on, the new set is coming', r.cars[0].pit && near(r.cars[0].twLife, 86.5) && r.cars[0].twStops === 0 && !evs(r, 'tyrefresh').length);
  const d = r.twOf(0, 32500);
  ok('...a screen sees that the tyres are being changed, and how long it takes', d.fitting === 'S' && d.fitLeft === 1500 && near(d.life, 86.5));
  r.tick(33999); ok('...1 ms before the time is up it is not done', near(r.cars[0].twLife, 86.5) && r.cars[0].twStops === 0);
  r.tick(34000);
  ok('...at 4 s after the car stopped on the sensor (the seconds count from the moment it stopped): fresh tyres, the stop is counted', r.cars[0].twLife === 100 && r.cars[0].twStops === 1 && evs(r, 'tyrefresh')[0].ms === 4000 && evs(r, 'tyrefresh')[0].t === 34000);
  r.unblock(0, 36000);
  ok('...and leaving after that changes nothing more, nothing is logged as too early', r.cars[0].twLife === 100 && evs(r, 'tyreearly').length === 0); }
{ const r = race({ changeSeconds: 4 }); at(r, 0, 10000); at(r, 0, 20000); r.block(0, 30000); r.tick(32500); r.unblock(0, 33000);
  ok('a car that leaves before the change is done keeps its worn tyres (and it is logged)', near(r.cars[0].twLife, 86.5) && r.cars[0].twStops === 0 && evs(r, 'tyrefresh').length === 0 && evs(r, 'tyreearly').length === 1 && evs(r, 'tyreearly')[0].life === 87);
  ok('...a stop that was no pit stop (the sensor was blocked for less than the pit hold time) is not a stop at all', (() => { const q = race({ changeSeconds: 4 }); at(q, 0, 10000); q.block(0, 20000); q.unblock(0, 20500); return evs(q, 'tyreearly').length === 0 && q.cars[0].twStops === 0 && near(q.cars[0].twLife, 91); })()); }
// the tyres are Hard (no bonus, so the car refuels at the normal 10 litres a second); the car has 80 litres, comes in on its second lap with 76 and has 24 litres to take: 2.4 seconds
{ const r = race({ changeSeconds: 3, stop: 'overlap' }, { tyres: ['H', 'H'] }); r.cars[0].fuel = 80; at(r, 0, 10000); r.block(0, 20000); r.tick(23100);
  ok('at the same time as refuelling: the stop starts at 22 s, refuelling is done at 24.4 s, and the tyres (3 s from the moment the car stopped) are on at 23 s', r.cars[0].twLife === 100 && evs(r, 'tyrefresh')[0].t === 23000 && r.cars[0].pit.fuel0 === 76);
  const q = race({ changeSeconds: 3, stop: 'add' }, { tyres: ['H', 'H'] }); q.cars[0].fuel = 80; at(q, 0, 10000); q.block(0, 20000); q.tick(23100);
  ok('one after the other: the tyres wait for the tank (refuelling is done at 24.4 s) so they are not on at 23 s...', near(q.cars[0].twLife, 96) && q.cars[0].twStops === 0);
  q.tick(27399); ok('...nor 1 ms before 27.4 s (the end of the refuelling plus the 3 seconds)', q.cars[0].twStops === 0);
  q.tick(27400);
  ok('...but at 27.4 s', q.cars[0].twStops === 1 && q.cars[0].twLife === 100 && evs(q, 'tyrefresh')[0].t === 27400); }
{ const r = race({ changeSeconds: 4 }); at(r, 0, 10000); r.block(0, 20000); r.tick(22500); r.pause(23000); r.resume(123000);
  ok('a pause does not count for the change of tyres: the stop moves with the clock (it began 3 s before the pause, 1 s is left)', r.cars[0].blockAt === 120000 && r.cars[0].twStops === 0 && r.twOf(0, 123000).fitLeft === 1000);
  r.tick(123999); ok('...1 ms before the time is up it is not done', r.cars[0].twStops === 0);
  r.tick(124000); ok('...and then it is', r.cars[0].twStops === 1 && r.cars[0].twLife === 100 && evs(r, 'tyrefresh')[0].t === 124000); }

// ---- the weather and the tyres in a stop ----
{ const r = race({ changeSeconds: 3 }, { tyres: ['S', 'S'], weather: { startAt: 1, cloudyFor: 0, rainFor: 9, clearingFor: 0 } });
  at(r, 0, 10000); at(r, 1, 10000); at(r, 0, 20000);
  r.block(0, 21000); r.tick(23500);
  ok('the weather asks for Wet tyres, and they go on when the change is done, not before (a car on Soft is still on Soft after 2.5 s)', r.wxState === 'wet' && r.cars[0].tyre === 'S' && r.twOf(0, 23500).fitting === 'W');
  r.tick(24000);
  ok('...at the time: Wet tyres, a fresh set, and the log says both', r.cars[0].tyre === 'W' && r.cars[0].twLife === 100 && evs(r, 'tyres').length === 1 && evs(r, 'tyres')[0].tyre === 'W' && evs(r, 'tyrefresh')[0].tyre === 'W' && r.cars[0].wxDue === null);
  const q = race({ changeSeconds: 3 }, { tyres: ['S', 'S'], weather: { startAt: 1, cloudyFor: 0, rainFor: 9, clearingFor: 0 } });
  at(q, 0, 10000); at(q, 1, 10000); at(q, 0, 20000); q.block(0, 21000); q.tick(23500); q.unblock(0, 23600);
  ok('...a car that leaves early stays on the wrong tyres: still Soft, still due to change', q.cars[0].tyre === 'S' && q.cars[0].wxDue && q.cars[0].wxDue.kind === 'wet'); }
{ const r = race({ changeSeconds: 0 }, { tyres: ['S', 'S'], weather: { startAt: 1, cloudyFor: 0, rainFor: 9, clearingFor: 0 } });
  at(r, 0, 10000); at(r, 1, 10000); at(r, 0, 20000); pit(r, 0, 21000);
  ok('no time to change: the weather\'s Wet tyres and the fresh life are on at the start of the stop, as the weather alone has always done', r.cars[0].tyre === 'W' && r.cars[0].twLife === 100 && evs(r, 'tyres', 'tyrefresh').map(e => e.type).join() === 'tyres,tyrefresh'); }
{ const r = race({ changeSeconds: 0 }); at(r, 0, 10000); at(r, 0, 20000); r.setTyre(0, 'H', 20500);
  ok('the Race Director\'s instant tyre change is a correction: the life stays as it is, the grip follows the other tyre (a Hard has no bonus)', near(r.cars[0].twLife, 91) && r.cars[0].tyre === 'H' && r.cars[0].tw === 0 && evs(r, 'tyrefresh').length === 0); }

// ---- the snapshot ----
{ const r = race({ changeSeconds: 4 }); at(r, 0, 10000); at(r, 0, 20000); r.block(0, 30000); r.tick(32500);
  const snap = r.snapshot(32500), q = race({ changeSeconds: 4 }); q.restore(snap);
  ok('a race that was interrupted keeps the life of the tyres and the stop it was in', near(q.cars[0].twLife, 86.5) && q.cars[0].twStops === 0 && q.cars[0].twDoneAt === null && q.cars[0].blockAt === 30000);
  const p = race({ changeSeconds: 0 }); at(p, 0, 10000); pit(p, 0, 20000); const s2 = p.snapshot(24000), p2 = race({ changeSeconds: 0 }); p2.restore(s2);
  ok('...and what was done (a set that was fitted)', p2.cars[0].twStops === 1 && p2.cars[0].twLife === 100 && p2.cars[0].twDoneAt === 20000); }
{ const r = race({ changeSeconds: 0 }); at(r, 0, 10000); pit(r, 0, 20000); r.pause(24000); r.resume(30000);
  ok('a fresh set that was fitted before a pause is still marked as done for that stop afterwards (no second set)', r.cars[0].twStops === 1 && r.cars[0].twDoneAt === r.cars[0].blockAt && (r.tick(31000), r.cars[0].twStops === 1)); }

console.log(fails ? `${fails} FAILED` : 'ALL OK');
process.exit(fails ? 1 : 0);
