// 1.10.0: the Damage System in the race engine: damage points (a hit, a deslot, a fragile car), the levels, the repair on the sensor (at the same time as the other work or after it),
// leaving too early, the deadline in laps, a car that damage retires or disqualifies, taking points back, a pause in a stop, and what a screen is told.
const RE = require('../renderer/engine.js'), Dm = require('../renderer/damage.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const SEC = 1000;
const entry = (lane, over) => ({ lane, driverId: 'd' + lane, driverName: 'Driver' + lane, carId: 'car' + lane, ...over });
const rec = over => ({ ...Dm.defaults(), ...over });
const mk = (o = {}) => RE.createRace({ type: o.type || 'timed', duration: 600, laps: o.laps || 0, minLap: 800,
  penalty: o.penalty === false ? undefined : RE.penaltyConfig({ everyPoints: 5, everySeconds: 5, dqPoints: o.dq || '' }),
  damage: o.damage === null ? undefined : Dm.clean(rec(o.rec || {}), o.deslot === undefined ? 0 : o.deslot), fuel: o.fuel, entries: o.entries || [entry(0), entry(1)] });
const types = (R, ty, car) => R.events.filter(e => e.type === ty && (car === undefined || e.car === car));
// the car drives laps of 'lapMs' from 'from' until 'to'
const drive = (R, i, from, to, lapMs = 30 * SEC) => { for (let t = from + lapMs; t <= to; t += lapMs) R.cross(i, t); };
const started = o => { const R = mk(o); R.start(0); R.cars.forEach(c => { c.started = true; }); return R; };

// ---- which races have damage ----
{ ok('a race without a Damage System has none: no rules, no damage points', mk({ damage: null }).damage === null);
  const N = started({ damage: null });
  ok('...and nothing can be added', N.addDamage(0, 3, SEC) === false && N.damageOf(0, SEC) === null);
  ok('a race and a timed race have damage; a practice and a qualifying do not', mk().damage !== null && mk({ type: 'race', laps: 9 }).damage !== null && mk({ type: 'practice' }).damage === null && mk({ type: 'qualifying' }).damage === null);
  ok('a car starts without damage', mk().cars.every(c => c.dmg === 0 && c.dmgLvl === -1 && c.dmgDue === null && c.dmgOut === '' && c.repairs.length === 0 && c.dmgTotal === 0)); }

// ---- damage points ----
{ const R = mk();
  ok('no damage before the start', R.addDamage(0, 3, SEC) === false && R.cars[0].dmg === 0);
  R.start(0);
  ok('damage points are added; below the first level there is no level (and nothing to repair)', R.addDamage(0, 2, SEC, 'hit') === true && R.cars[0].dmg === 2 && R.cars[0].dmgLvl === -1 && types(R, 'damagelevel').length === 0);
  const e = types(R, 'damage')[0];
  ok('...logged with what it added, the total, the level and why', e.delta === 2 && e.points === 2 && e.level === -1 && e.name === '' && e.why === 'hit' && e.car === 0 && e.t === SEC);
  ok('the first level is reached at 3 points: logged once, with what it asks', R.addDamage(0, 1, 2 * SEC) && R.cars[0].dmgLvl === 0 && types(R, 'damagelevel').length === 1 && types(R, 'damagelevel')[0].name === 'Light damage' && types(R, 'damagelevel')[0].seconds === 10 && types(R, 'damagelevel')[0].urgent === false && types(R, 'damagelevel')[0].action === 'repair');
  R.addDamage(0, 1, 3 * SEC);
  ok('...more points in the same level are not a new level', R.cars[0].dmg === 4 && types(R, 'damagelevel').length === 1 && types(R, 'damage').length === 3);
  R.addDamage(0, 2, 4 * SEC);
  ok('the next level at 6 points', R.cars[0].dmgLvl === 1 && types(R, 'damagelevel').length === 2 && types(R, 'damagelevel')[1].name === 'Medium damage');
  ok('the total of a car counts everything it collected', R.cars[0].dmgTotal === 6);
  ok('the other car has none', R.cars[1].dmg === 0 && R.cars[1].dmgLvl === -1);
  ok('nothing (0, not a number) is nothing', R.addDamage(0, 0, SEC) === false && R.addDamage(0, NaN, SEC) === false && R.addDamage(0, Infinity, SEC) === false && R.cars[0].dmg === 6);
  ok('taking points back: not below 0, the level goes down, and a level that is gone has no deadline', R.addDamage(0, -3, 5 * SEC) && R.cars[0].dmg === 3 && R.cars[0].dmgLvl === 0 && R.addDamage(0, -10, 6 * SEC) && R.cars[0].dmg === 0 && R.cars[0].dmgLvl === -1 && R.cars[0].dmgDue === null);
  ok('...taking back nothing that is there changes nothing', R.addDamage(0, -1, 7 * SEC) === false);
  ok('...the total does not go down with it', R.cars[0].dmgTotal === 6);
  R.pause(8 * SEC);
  ok('damage can be given while the race is paused', R.addDamage(1, 3, 9 * SEC) === true && R.cars[1].dmg === 3);
  R.resume(10 * SEC); }
{ const R = started({ entries: [entry(0, { damageFactor: 1.5 }), entry(1, { damageFactor: 0 }), entry(2)] });
  R.addDamage(0, 3, SEC); R.addDamage(1, 3, SEC); R.addDamage(2, 3, SEC);
  ok('a fragile car (1.5) gets more damage from a hit, a car with factor 0 none, an ordinary car what the hit says', R.cars[0].dmg === 5 && R.cars[1].dmg === 0 && R.cars[2].dmg === 3);
  R.addDamage(0, -2, 2 * SEC);
  ok('...points taken back are not made less', R.cars[0].dmg === 3); }
{ const R = started({ type: 'race', laps: 2 });
  drive(R, 0, 0, 60 * SEC);
  ok('a car that has finished takes no more damage', R.cars[0].done === true && R.addDamage(0, 3, 61 * SEC) === false);
  const F = started({ penalty: false }); F.addDamage(0, 3, SEC);
  ok('damage does not need a penalty system', F.cars[0].dmg === 3 && F.cars[0].dmgLvl === 0); }

// ---- the repair on the sensor ----
{ const R = started(); R.addDamage(0, 3, 5 * SEC);
  const d = R.damageOf(0, 6 * SEC);
  ok('what a screen is told: points, level and what it asks (10 seconds, whenever you can)', d.points === 3 && d.level === 0 && d.name === 'Light damage' && d.urgent === false && d.action === 'repair' && d.seconds === 10 && d.tone === 'amber' && d.standLeft === null && d.lapsLeft === null && d.out === '');
  R.block(0, 10 * SEC);
  R.tick(10 * SEC + 1000);
  ok('a car that stands on the sensor is not repaired before the pit stop starts (the pit hold of 2 seconds)', R.cars[0].dmg === 3 && R.cars[0].pit === null);
  R.tick(12 * SEC);
  ok('...the pit stop starts', R.cars[0].pit !== null && R.cars[0].dmg === 3);
  ok('...and a screen is told how long the car still has to stand: 10 seconds from the moment it stopped', R.damageOf(0, 12 * SEC).standLeft === 8 * SEC && R.damageOf(0, 15 * SEC).standLeft === 5 * SEC);
  R.tick(19 * SEC + 900);
  ok('not repaired a moment before the 10 seconds', R.cars[0].dmg === 3 && types(R, 'repaired').length === 0);
  R.tick(20 * SEC);
  const rp = types(R, 'repaired');
  ok('at 10 seconds the car is repaired: the damage is gone, the level too, logged with the level, the points and the time', R.cars[0].dmg === 0 && R.cars[0].dmgLvl === -1 && rp.length === 1 && rp[0].name === 'Light damage' && rp[0].points === 3 && rp[0].ms === 10 * SEC && rp[0].t === 20 * SEC && rp[0].car === 0);
  ok('...the car keeps its repair: when, how long, what was repaired', same(R.cars[0].repairs, [{ at: 10 * SEC, ms: 10 * SEC, name: 'Light damage', points: 3 }]) && R.cars[0].repairMs === 10 * SEC);
  R.tick(25 * SEC); R.unblock(0, 26 * SEC);
  ok('...once for a stop, and leaving after it costs nothing', types(R, 'repaired').length === 1 && types(R, 'repairearly').length === 0 && R.cars[0].points === 0);
  ok('...a screen sees the car without damage and nothing left to stand', R.damageOf(0, 26 * SEC).points === 0 && R.damageOf(0, 26 * SEC).standLeft === null && R.damageOf(0, 26 * SEC).tone === 'ok' && R.damageOf(0, 26 * SEC).repairs === 1); }
{ const R = started(); R.addDamage(0, 6, 5 * SEC); R.block(0, 10 * SEC); R.tick(24 * SEC);
  ok('the level decides the time: medium damage takes 15 seconds', R.cars[0].dmg === 6 && types(R, 'repaired').length === 0);
  R.tick(25 * SEC);
  ok('...and is repaired at 15 seconds', R.cars[0].dmg === 0 && types(R, 'repaired')[0].name === 'Medium damage'); }
{ const R = started(); R.addDamage(0, 3, 5 * SEC); R.block(0, 10 * SEC); R.tick(12 * SEC); R.addDamage(0, 3, 14 * SEC);
  R.tick(24 * SEC);
  ok('damage that is added while the car stands makes the level higher, and the time: now 15 seconds from the moment it stopped', R.cars[0].dmg === 6 && types(R, 'repaired').length === 0);
  R.tick(25 * SEC); ok('...and repaired then', R.cars[0].dmg === 0); }
{ const R = started(); R.addDamage(0, 3, 5 * SEC); R.block(0, 10 * SEC); R.tick(12 * SEC); R.tick(17 * SEC); R.unblock(0, 17 * SEC);
  const e = types(R, 'repairearly');
  ok('leaving before the repair is done: logged, the damage stays, and the car gets the penalty point (1)', e.length === 1 && e[0].name === 'Light damage' && e[0].points === 3 && e[0].extra === 1 && R.cars[0].dmg === 3 && R.cars[0].points === 1 && types(R, 'repaired').length === 0);
  const pen = types(R, 'penalty').filter(x => x.why === 'damage');
  ok('...the point is a penalty point of the penalty system, logged as coming from the damage', pen.length === 1 && pen[0].delta === 1);
  R.block(0, 40 * SEC); R.tick(42 * SEC); R.tick(50 * SEC);
  ok('...and the next stop can still repair it', R.cars[0].dmg === 0 && types(R, 'repaired').length === 1); }
{ const R = started(); R.addDamage(0, 3, 5 * SEC); R.block(0, 10 * SEC); R.unblock(0, 11 * SEC);
  ok('a stop that is shorter than the pit hold is no pit stop: nothing is repaired and nothing is charged', R.cars[0].dmg === 3 && types(R, 'repairearly').length === 0 && R.cars[0].points === 0);
  const Q = started({ rec: { earlyPoints: 0 } }); Q.addDamage(0, 3, 5 * SEC); Q.block(0, 10 * SEC); Q.tick(12 * SEC); Q.unblock(0, 14 * SEC);
  ok('with 0 points for leaving early it is only logged', types(Q, 'repairearly').length === 1 && Q.cars[0].points === 0 && Q.cars[0].dmg === 3);
  const N = started({ penalty: false }); N.addDamage(0, 3, 5 * SEC); N.block(0, 10 * SEC); N.tick(12 * SEC); N.unblock(0, 14 * SEC);
  ok('...and so it is without a penalty system', types(N, 'repairearly').length === 1 && N.cars[0].points === 0);
  const L = started(); L.block(0, 10 * SEC); L.tick(30 * SEC); L.unblock(0, 31 * SEC);
  ok('a car without damage that stops in the pits has nothing repaired and nothing charged', types(L, 'repaired').length === 0 && types(L, 'repairearly').length === 0 && L.cars[0].repairs.length === 0);
  const B = started(); B.addDamage(0, 2, 5 * SEC); B.block(0, 10 * SEC); B.tick(12 * SEC); B.unblock(0, 13 * SEC);
  ok('...and damage below the first level is not repaired by a stop, or charged', B.cars[0].dmg === 2 && types(B, 'repaired').length === 0 && types(B, 'repairearly').length === 0); }
{ const R = started(); R.addDamage(0, 3, 5 * SEC); R.block(0, 10 * SEC); R.tick(12 * SEC); R.pause(14 * SEC); R.resume(34 * SEC);
  R.tick(39 * SEC);
  ok('a pause in the stop does not count: 4 seconds stood before, so 6 more after the pause', R.cars[0].dmg === 3);
  R.tick(40 * SEC);
  ok('...repaired 10 seconds after the car stopped, not counting the pause', R.cars[0].dmg === 0 && types(R, 'repaired').length === 1 && types(R, 'repaired')[0].ms === 10 * SEC);
  R.unblock(0, 41 * SEC); ok('...and leaving after a pause costs nothing', types(R, 'repairearly').length === 0); }

// ---- the repair and the other work in the stop ----
{ const fuel = RE.fuelConfig({ pitHold: 2 }, { tank: 100, perLap: 1, rate: 5, empty: 'warn' });
  const mkF = stop => { const R = mk({ fuel, rec: { stop } }); R.start(0); R.cars.forEach(c => { c.started = true; }); R.cars[0].fuel = 51; R.addDamage(0, 3, 5 * SEC); R.block(0, 10 * SEC); return R; }; // (the stop begins with a crossing of the line, which uses 1 litre: 50 are left)
  const O = mkF('overlap'); O.tick(20 * SEC);
  ok('at the same time as the refuelling (50 litres at 5 a second = 10 seconds), the repair takes the longest of the two: 10 seconds', O.cars[0].dmg === 0);
  const A = mkF('add'); A.tick(20 * SEC);
  ok('one after the other: the repair starts when the tank is full, so not after 10 seconds', A.cars[0].dmg === 3);
  A.tick(31 * SEC); ok('...the pit stop starts at 12 s, the tank is full at 22 s, and the 10 seconds of the repair end at 32 s', A.cars[0].dmg === 3);
  A.tick(32 * SEC); ok('...so at 32 seconds', A.cars[0].dmg === 0 && types(A, 'repaired')[0].ms === 22 * SEC);
  ok('a screen is told the time to stand for the two together', (() => { const X = mkF('add'); X.tick(12 * SEC); return X.damageOf(0, 12 * SEC).standLeft === 20 * SEC; })());
  const Z = mk({ rec: { stop: 'add' } }); Z.start(0); Z.cars.forEach(c => { c.started = true; }); Z.addDamage(0, 3, 5 * SEC); Z.block(0, 10 * SEC); Z.tick(21 * SEC);
  ok('one after the other without fuel: it starts when the pit stop starts (after the pit hold), so 12 + 10 seconds', Z.cars[0].dmg === 3);
  Z.tick(22 * SEC); ok('...done at 22 seconds', Z.cars[0].dmg === 0 && types(Z, 'repaired')[0].ms === 12 * SEC);
  const T = mk({ rec: { stop: 'add' } }); T.start(0); T.cars.forEach(c => { c.started = true; }); T.addDamage(0, 3, 5 * SEC); T.block(0, 10 * SEC);
  ok('a screen is told nothing is left to stand for a car that is not standing, and a count that starts at the pit hold for one that is', T.damageOf(1, 11 * SEC).standLeft === null && T.damageOf(0, 10 * SEC).standLeft === 12 * SEC); }

// ---- the deadline ----
{ const R = started(); drive(R, 0, 0, 5 * 30 * SEC); // 5 laps
  R.addDamage(0, 9, 150 * SEC + 1);
  ok('heavy damage has a deadline of 3 laps: 5 + 3, shown to a screen as the laps that are left', R.cars[0].dmgLvl === 2 && R.cars[0].dmgDue === 8 && R.damageOf(0, 151 * SEC).lapsLeft === 3 && R.damageOf(0, 151 * SEC).urgent === true && R.damageOf(0, 151 * SEC).tone === 'red');
  drive(R, 0, 150 * SEC, 8 * 30 * SEC);
  ok('...nothing is charged while the car is within the 3 laps', R.cars[0].laps.length === 8 && types(R, 'damagelate').length === 0 && R.cars[0].points === 0 && R.damageOf(0, 241 * SEC).lapsLeft === 0);
  R.cross(0, 9 * 30 * SEC);
  ok('...the ninth lap is late: the penalty point (1) and a log with the lap and the deadline', types(R, 'damagelate').length === 1 && types(R, 'damagelate')[0].points === 1 && types(R, 'damagelate')[0].lap === 9 && types(R, 'damagelate')[0].due === 8 && R.cars[0].points === 1 && R.damageOf(0, 271 * SEC).lapsLeft === -1);
  R.cross(0, 10 * 30 * SEC);
  ok('...and for every lap after it', types(R, 'damagelate').length === 2 && R.cars[0].points === 2);
  R.block(0, 10 * 30 * SEC + 1000); R.tick(10 * 30 * SEC + 3000); R.tick(10 * 30 * SEC + 1000 + 20 * SEC);
  ok('the repair ends the deadline: 20 seconds for heavy damage', R.cars[0].dmg === 0 && R.cars[0].dmgDue === null && R.damageOf(0, 400 * SEC).lapsLeft === null);
  R.unblock(0, 330 * SEC); R.cross(0, 360 * SEC);
  ok('...no more late laps after it (the crossing in which the car came into the pits was a late lap too: 3)', types(R, 'damagelate').length === 3 && R.cars[0].points === 3); }
{ const R = started(); drive(R, 0, 0, 2 * 30 * SEC); R.addDamage(0, 3, 61 * SEC); drive(R, 0, 60 * SEC, 10 * 30 * SEC);
  ok('a level without a deadline never makes a car late', R.cars[0].dmgDue === null && types(R, 'damagelate').length === 0 && R.cars[0].points === 0);
  R.addDamage(0, 6, 301 * SEC);
  ok('a higher level with a deadline gives one: 10 laps driven + 3', R.cars[0].dmgLvl === 2 && R.cars[0].dmgDue === 13);
  R.addDamage(0, 1, 302 * SEC);
  ok('the critical level is within 1 lap, which is sooner: 10 + 1', R.cars[0].dmgLvl === 3 && R.cars[0].dmgDue === 11 && R.damageOf(0, 302 * SEC).tone === 'out');
  R.addDamage(0, -1, 303 * SEC);
  ok('and when the points are taken back to the level of before, the deadline stays as it is', R.cars[0].dmgLvl === 2 && R.cars[0].dmgDue === 11); }
{ const R = started({ rec: { latePoints: 0 } }); drive(R, 0, 0, 30 * SEC); R.addDamage(0, 9, 31 * SEC); drive(R, 0, 30 * SEC, 8 * 30 * SEC);
  ok('with 0 points for a late lap it is only logged', types(R, 'damagelate').length >= 1 && types(R, 'damagelate').every(e => e.points === 0) && R.cars[0].points === 0);
  const N = started({ penalty: false }); drive(N, 0, 0, 30 * SEC); N.addDamage(0, 9, 31 * SEC); drive(N, 0, 30 * SEC, 8 * 30 * SEC);
  ok('...and without a penalty system', types(N, 'damagelate').length >= 1 && types(N, 'damagelate').every(e => e.points === 0)); }

// ---- the car that damage puts out ----
{ const R = started(); R.addDamage(0, 10, 5 * SEC); R.block(0, 10 * SEC); R.tick(11 * SEC);
  ok('the critical level retires the car only when it stops in the pits: not before the pit stop starts', R.cars[0].dmgOut === '' && R.cars[0].done === false && R.cars[0].retired === false);
  R.tick(12 * SEC);
  const o = types(R, 'damageout');
  ok('...then the car is retired (it is done, it is not disqualified), and the log says so', R.cars[0].dmgOut === 'retire' && R.cars[0].done === true && R.cars[0].retired === true && R.cars[0].dq === false && o.length === 1 && o[0].how === 'retire' && o[0].name === 'Critical damage' && o[0].points === 10);
  ok('...and it stays out: no more damage, no repair', R.addDamage(0, 1, 13 * SEC) === false && types(R, 'repaired').length === 0 && R.damageOf(0, 13 * SEC).out === 'retire' && R.damageOf(0, 13 * SEC).tone === 'out');
  ok('the other car carries on, and the race with it', R.cars[1].done === false && R.status === 'running');
  R.addPoints(0, 3, 14 * SEC); R.addPoints(0, -3, 15 * SEC);
  ok('taking penalty points back does not bring the car back', R.cars[0].retired === true && R.cars[0].done === true);
  R.unblock(0, 20 * SEC); ok('...leaving the pits after it costs nothing', types(R, 'repairearly').length === 0); }
{ const R = started({ rec: { levels: [{ name: 'Wreck', from: 5, seconds: 3, urgency: 'asap', within: 0, action: 'dq' }] }, dq: 20 }); R.addDamage(0, 5, 5 * SEC); R.block(0, 10 * SEC); R.tick(12 * SEC); R.tick(12 * SEC + 900);
  ok('a level that disqualifies waits for its 3 seconds in the pits, then the car is disqualified', R.cars[0].dq === false); R.tick(13 * SEC);
  ok('...and it is out', R.cars[0].dmgOut === 'dq' && R.cars[0].dq === true && R.cars[0].done === true && R.cars[0].retired === true && types(R, 'damageout')[0].how === 'dq');
  R.addPoints(0, 5, 20 * SEC); R.addPoints(0, -5, 21 * SEC);
  ok('...and penalty points taken back do not reinstate it', R.cars[0].dq === true);
  R.addDamage(0, -3, 22 * SEC);
  ok('taking the damage back below the level does: the car is in the race again, with what it was before', R.cars[0].dmg === 2 && R.cars[0].dq === false && R.cars[0].dmgOut === '' && R.cars[0].done === false && R.cars[0].retired === false && types(R, 'reinstated').length === 1 && types(R, 'reinstated')[0].by === 'damage'); }
{ const R = started({ type: 'race', laps: 50, entries: [entry(0)] }); R.addDamage(0, 10, 5 * SEC); R.block(0, 10 * SEC); R.tick(12 * SEC);
  ok('when the last car is put out, the race is over', R.cars[0].dmgOut === 'retire' && R.status === 'finished'); }
{ const R = started({ type: 'race', laps: 50, entries: [entry(0), entry(1)] }); R.cars[1].retired = true; R.cars[1].done = true; R.addDamage(0, 10, 5 * SEC); R.block(0, 10 * SEC); R.tick(12 * SEC);
  ok('...also when the others were out already', R.status === 'finished'); }

// ---- the deslot ----
{ const R = started({ deslot: 25 }); drive(R, 0, 0, 90 * SEC, 20 * SEC);
  ok('a lap that is not slower than the deslot time gives no damage', R.cars[0].dmg === 0 && R.cars[0].laps.length === 4);
  R.cross(0, 80 * SEC + 25 * SEC);
  ok('exactly the deslot time is not a deslot', R.cars[0].dmg === 0);
  R.cross(0, 80 * SEC + 25 * SEC + 25001);
  ok('a lap slower than the deslot time is a deslot: 1 damage point, logged as one', R.cars[0].dmg === 1 && types(R, 'damage')[0].why === 'deslot' && types(R, 'damage')[0].delta === 1);
  ok('...the lap itself still counts', R.cars[0].laps.length === 6);
  const S = started({ deslot: 25, rec: { deslotPoints: 3 } }); S.cross(0, 40 * SEC);
  ok('the points of a deslot are those of the Damage System (3), and it reaches the first level', S.cars[0].dmg === 3 && S.cars[0].dmgLvl === 0);
  const Z = started({ deslot: 25, rec: { deslotPoints: 0 } }); Z.cross(0, 40 * SEC);
  ok('0 points for a deslot is none', Z.cars[0].dmg === 0);
  const N = started({ deslot: 0 }); N.cross(0, 4000 * SEC);
  ok('a track without a deslot time has no deslots, however slow the lap', N.cars[0].dmg === 0);
  const F = started({ deslot: 25, entries: [entry(0, { damageFactor: 2 })] }); F.cross(0, 40 * SEC);
  ok('a fragile car gets double from a deslot', F.cars[0].dmg === 2); }
{ const R = started({ deslot: 25 }); R.cross(0, 20 * SEC); R.addDamage(0, 3, 21 * SEC); R.block(0, 22 * SEC); R.tick(24 * SEC); R.tick(40 * SEC); R.unblock(0, 41 * SEC);
  R.cross(0, 80 * SEC);
  ok('the lap in which the car stood in the pits is not a deslot, however long it took', R.cars[0].dmg === 0 && types(R, 'damage').filter(e => e.why === 'deslot').length === 0);
  R.cross(0, 80 * SEC + 26 * SEC);
  ok('...the next slow lap is', R.cars[0].dmg === 1);
  const P = started({ deslot: 25 }); P.cross(0, 20 * SEC); P.pause(30 * SEC); P.resume(100 * SEC); P.cross(0, 110 * SEC);
  ok('a lap with a pause in it is not slower than it was (the paused time does not count)', P.cars[0].dmg === 0);
  const D = started({ deslot: 25, rec: { levels: [{ name: 'Out', from: 1, seconds: 0, urgency: 'asap', within: 0, action: 'retire' }] } }); D.cross(0, 20 * SEC); D.cross(0, 80 * SEC);
  ok('a car with damage collects deslots until a stop puts it out', D.cars[0].dmg === 1);
}

// ---- the snapshot of a race that was interrupted keeps the damage ----
{ const R = started({ deslot: 25 }); R.cross(0, 20 * SEC); R.addDamage(0, 9, 21 * SEC); R.cross(0, 40 * SEC);
  const snap = JSON.parse(JSON.stringify(R.snapshot(50 * SEC)));
  const E = mk({ deslot: 25 }); const restored = E.restore(snap);
  ok('a restored race has the damage of the car as it was: points, level, deadline, the totals', restored === true && E.cars[0].dmg === 9 && E.cars[0].dmgLvl === 2 && E.cars[0].dmgDue === R.cars[0].dmgDue && E.cars[0].dmgTotal === 9);
  ok('...and what a screen is told is the same', same(E.damageOf(0, 50 * SEC), R.damageOf(0, 50 * SEC))); }

// ---- the result: what the damage did to a car, in words ----
{ const R = started();
  ok('a car without damage has no note, and neither has a race without a Damage System', R.damageNoteOf(0) === '' && started({ damage: null }).damageNoteOf(0) === '');
  R.addDamage(0, 3, 5 * SEC); R.block(0, 10 * SEC); R.tick(25 * SEC); R.unblock(0, 26 * SEC);
  ok('after a repair: the points, the repair and the time in the pits', R.damageNoteOf(0) === '3 damage points, 1 repair (10 seconds in the pits)');
  R.addDamage(0, 2, 40 * SEC);
  ok('...damage that is still there is told too', R.damageNoteOf(0) === '5 damage points, 1 repair (10 seconds in the pits), 2 damage points not repaired');
  ok('...the other car has none', R.damageNoteOf(1) === '');
  const Q = started(); Q.addDamage(0, 3, 5 * SEC); Q.block(0, 10 * SEC); Q.tick(12 * SEC); Q.unblock(0, 14 * SEC);
  ok('a car that leaves too early: told, and the damage is still there', Q.damageNoteOf(0) === '3 damage points, 3 damage points not repaired, left the pits too early once');
  const X = started(); X.addDamage(0, 10, 5 * SEC); X.block(0, 10 * SEC); X.tick(14 * SEC);
  ok('a car that damage retired: told', X.damageNoteOf(0) === '10 damage points, retired by damage' && X.cars[0].dmgOut === 'retire'); }

console.log(fails ? `\n${fails} FAILED` : '\nALL DAMAGE ENGINE TESTS PASSED');
process.exit(fails ? 1 : 0);
