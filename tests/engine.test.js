const { createRace, fmtTime, fuelConfig, fuelUse, penaltyConfig } = require('../renderer/engine.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const E = n => Array.from({ length: n }, (_, i) => ({ lane: i, driverId: 'd' + i, carId: 'c' + i }));
const lap = (R, i, times) => times.forEach(t => R.cross(i, t));

// calls from a lane: the yellow flag goes up and the Race Director decides
{
  const mk = o => { const r = createRace({ type: 'race', laps: 50, entries: E(3), ...o }); return r; };
  const pen = { penalty: penaltyConfig({ dqPoints: 3 }) };
  let r = mk({}); r.start(0);
  const c1 = r.call(1, 1000);
  ok('a call raises the yellow flag and waits for the Race Director', r.flag === 'yellow' && c1 && c1.id === 1 && c1.car === 1 && c1.open === true && r.calls.length === 1 && r.calls[0] === c1);
  ok('the call is logged', r.events.some(e => e.type === 'call' && e.car === 1 && e.id === 1 && e.t === 1000));
  ok('the race carries on under yellow (timing is not stopped)', r.status === 'running');
  ok('a second call from the same lane while it waits is not a second call', r.call(1, 2000) === c1 && r.calls.length === 1);
  ok('...but another lane makes its own call', r.call(2, 2500).id === 2 && r.calls.length === 2 && r.flag === 'yellow');
  r.setFlag('yellow', 3000);
  ok('the Race Director can lift the yellow flag while calls wait', r.flag === '' && r.calls.every(c => c.open));
  r.call(1, 3500);
  ok('a new press puts the yellow flag back, still one call for that lane', r.flag === 'yellow' && r.calls.length === 2);
  ok('a call never switches a yellow flag off', (r.call(0, 4000), r.flag === 'yellow'));
  ok('a call from a car that does not exist is nothing', r.call(7, 4000) === null && r.call(-1, 4000) === null && r.call(undefined, 4000) === null);
  ok('dismiss closes the call', r.resolveCall(1, 'dismiss', 5000) === true && r.calls[0].open === false && r.calls[0].how === 'dismiss' && r.events.some(e => e.type === 'callend' && e.id === 1 && e.how === 'dismiss'));
  ok('a closed call cannot be settled again', r.resolveCall(1, 'dismiss', 5100) === false && r.resolveCall(99, 'dismiss', 5100) === false);
  ok('dismiss does not touch the flag or any points', r.flag === 'yellow' && r.cars.every(c => c.points === 0));
  ok('without a penalty system a penalty point cannot be given: the call keeps waiting', r.resolveCall(2, 'penalty', 5200) === false && r.calls[1].open === true && r.cars[2].points === 0);
  ok('an unknown decision is refused', r.resolveCall(2, 'cancel', 5200) === false && r.resolveCall(2, undefined, 5200) === false && r.calls[1].open === true);

  r = mk(pen); r.start(0); r.call(2, 1000);
  ok('with a penalty system a penalty point goes to the car that called', r.resolveCall(1, 'penalty', 2000) === true && r.cars[2].points === 1 && r.cars[0].points === 0 && r.calls[0].open === false && r.calls[0].how === 'penalty');
  ok('...and is logged as a penalty and as the end of the call', r.events.some(e => e.type === 'penalty' && e.car === 2 && e.delta === 1) && r.events.some(e => e.type === 'callend' && e.how === 'penalty'));
  ok('the flag is left to the Race Director', r.flag === 'yellow');
  r.call(2, 3000); r.addPoints(2, 2, 3100); // 3 points = disqualified
  ok('a call from a disqualified car can still be dismissed', r.cars[2].dq && r.calls[1].open && r.resolveCall(2, 'dismiss', 3200) === true && !r.calls[1].open);

  r = mk({}); r.start(0); r.pause(1000); const cp = r.call(0, 1500);
  ok('a call while paused is taken too', cp && cp.open && r.flag === 'yellow' && r.status === 'paused');
  r = mk({}); r.start(0); r.setFlag('red', 500); r.call(0, 600);
  ok('under a red flag the call waits and the flag stays red', r.flag === 'red' && r.calls.length === 1 && r.calls[0].open);
  r = mk({});
  ok('before the start there is no call', r.call(0, 0) === null && r.calls.length === 0 && r.flag === '');
  r = mk({ laps: 1 }); r.start(0); r.call(0, 100); r.call(1, 200); r.resolveCall(2, 'dismiss', 300); r.stop(400); // call 1 is the car 0's, call 2 the car 1's
  ok('when the race is over nothing waits any more, and no call can be made', r.calls.every(c => !c.open) && r.call(0, 500) === null && r.calls.length === 2 && r.flag === '');
  ok('...a call that was settled keeps how it ended', r.calls[0].how === '' && r.calls[1].how === 'dismiss');
}

// track minimum / maximum lap time
{
  const mk = o => { const r = createRace({ type: 'race', laps: 50, minLap: 3000, ...o, entries: E(1) }); r.start(0); return r; };
  let r = mk({}); lap(r, 0, [5000, 6500, 11000]); // 6500 is 1.5 s after the last crossing: faulty, ignored
  ok('min lap: a crossing sooner than the minimum is ignored and the lap carries on', r.cars[0].laps.join() === '5000,6000');
  r = mk({ maxLap: 8000 }); lap(r, 0, [5000, 20000, 25000]); // the second lap took 15 s
  ok('max lap: a slow lap still counts as a lap', r.cars[0].laps.join() === '5000,15000,5000' && r.cars[0].laps.length === 3);
  ok('max lap: a slow lap is flagged and left out of the best lap', r.cars[0].bad.join() === 'false,true,false' && r.cars[0].best === 5000);
  r = mk({ maxLap: 8000 }); lap(r, 0, [20000]);
  ok('max lap: a slow first lap gives no best lap', r.cars[0].best === null && R0Good(r) === 0);
  r = mk({ maxLap: 8000 }); lap(r, 0, [5000, 25000, 30000]);
  ok('max lap: goodLaps skips the slow lap (for averages)', r.goodLaps(r.cars[0]).join() === '5000,5000');
  r = mk({}); lap(r, 0, [5000, 40000]);
  ok('no max lap set: every lap counts', r.cars[0].best === 5000 && r.cars[0].bad.join() === 'false,false');
}
function R0Good(r) { return r.goodLaps(r.cars[0]).length; }

// the first crossing only starts the timing (the car starts just behind the line)
{
  const r = createRace({ type: 'race', laps: 3, minLap: 800, skipFirst: true, entries: E(1) }); r.start(0);
  ok('skip first: a crossing soon after the start counts no lap', r.cross(0, 300) === false && r.cars[0].laps.length === 0);
  ok('...the next crossing is lap 1, timed from the first crossing', r.cross(0, 5300) === true && r.cars[0].laps.join() === '5000' && r.cars[0].best === 5000);
  const q = createRace({ type: 'race', laps: 3, minLap: 800, entries: E(1) }); q.start(0);
  ok('without it the first crossing counts as before', q.cross(0, 5000) === true && q.cars[0].laps.join() === '5000');
}

// penalty points and time penalties
{
  const { penaltyConfig, penaltyMs } = require('../renderer/engine.js');
  const P = penaltyConfig({ timeRule: 'every', everyPoints: 5, everySeconds: 5, dqPoints: 20 });
  ok('every X points add Y seconds: 4 pts = 0 s, 5 = 5 s, 12 = 10 s, 15 = 15 s', penaltyMs(P, 4) === 0 && penaltyMs(P, 5) === 5000 && penaltyMs(P, 12) === 10000 && penaltyMs(P, 15) === 15000);
  const T = penaltyConfig({ timeRule: 'steps', steps: '10=12, 5=5, 15=30, x=1' });
  ok('steps table: the highest step reached counts (and is not added up)', penaltyMs(T, 4) === 0 && penaltyMs(T, 5) === 5000 && penaltyMs(T, 9) === 5000 && penaltyMs(T, 10) === 12000 && penaltyMs(T, 99) === 30000);
  ok('no penalty system: no time penalties and no points', penaltyMs(penaltyConfig(null), 50) === 0 && penaltyConfig(null).on === false);
  const mk = o => { const r = createRace({ type: 'race', laps: 3, endRule: 'all', minLap: 100, penalty: P, ...o, entries: E(2) }); r.start(0); return r; };
  let r = mk({});
  ok('a point is added and logged', r.addPoints(0, 1, 1000) && r.cars[0].points === 1 && r.events.some(e => e.type === 'penalty' && e.car === 0 && e.points === 1));
  r.addPoints(0, -3, 1100); ok('points never go below zero', r.cars[0].points === 0);
  r = mk({}); lap(r, 0, [5000, 10000, 15000]); lap(r, 1, [6000, 12000, 18000]);
  ok('without penalties the first to finish wins', r.standings()[0].index === 0);
  r = mk({}); r.addPoints(0, 5, 100); lap(r, 0, [5000, 10000, 15000]); lap(r, 1, [6000, 12000, 18000]); // +5 s: 20 s against 18 s
  ok('a time penalty can change the final order', r.standings()[0].index === 1 && r.standings()[1].gap === '+2.000');
  r = mk({}); r.addPoints(0, 5, 100); lap(r, 0, [5000, 10000]); lap(r, 1, [6000, 12000]);
  ok('the gap includes the penalty while racing', r.standings()[1].index === 0 || r.standings()[0].index === 0);
  r = mk({}); r.addPoints(1, 20, 500);
  ok('reaching the disqualify limit puts the car out', r.cars[1].dq && r.cars[1].retired && r.cars[1].done && r.standings()[1].gap === 'DQ' && r.events.some(e => e.type === 'disqualified'));
  r.addPoints(1, -1, 600); ok('a mistaken point can be taken back: the car is reinstated', !r.cars[1].dq && !r.cars[1].retired && !r.cars[1].done);
  r = mk({ penalty: penaltyConfig(null) }); ok('with no penalty system nothing is added', r.addPoints(0, 1, 100) === false && r.cars[0].points === 0);
  r = mk({}); r.stop(2000); ok('points cannot be given before the race starts', createRace({ type: 'race', laps: 3, penalty: P, entries: E(1) }).addPoints(0, 1, 0) === false);
}

// special penalties: assigned, served in the pits, left early, unserved; and the end-of-race review
{
  const { penaltyConfig } = require('../renderer/engine.js');
  const sys = { timeRule: 'every', everyPoints: 5, everySeconds: 5, dqPoints: 30, types: [
    { name: 'Drivethrough', kind: 'drivethrough', cost: 3, extra: 1, unserved: 10 }, { name: 'Stop-and-Go 5', kind: 'stopgo', seconds: 5, cost: 5, extra: 2, unserved: 8 }, { name: '', kind: 'stopgo' }] };
  const P = penaltyConfig(sys);
  ok('penalty types are read (blank names dropped)', P.types.length === 2 && P.types[1].seconds === 5 && P.types[0].kind === 'drivethrough');
  const mk = o => { const r = createRace({ type: 'race', laps: 5, endRule: 'all', minLap: 100, penalty: P, fuel: { pitHold: 2000 }, ...o, entries: E(2) }); r.start(0); return r; };
  let r = mk({});
  ok('a special penalty needs enough points', r.assign(0, 0, 100) === false && r.cars[0].pending.length === 0);
  r.addPoints(0, 4, 200);
  ok('assigning takes the points off and queues the penalty', r.assign(0, 0, 300) && r.cars[0].points === 1 && r.cars[0].pending.length === 1 && r.events.some(e => e.type === 'assigned'));
  r.block(0, 1000); r.tick(2500); ok('a Drivethrough is not served before the pit hold time', r.cars[0].pending.length === 1);
  r.tick(3100); ok('...and is served once the pit stop starts', r.cars[0].pending.length === 0 && r.cars[0].served.length === 1);
  r.unblock(0, 3500); ok('leaving after serving costs nothing', r.cars[0].points === 1);
  r = mk({}); r.addPoints(0, 6, 200); r.assign(0, 1, 300);
  r.block(0, 1000); r.unblock(0, 3000);
  ok('leaving a Stop-and-Go early adds the extra points and it stays pending', r.cars[0].pending.length === 1 && r.cars[0].points === 1 + 2 && r.events.some(e => e.type === 'leftearly'));
  r.block(0, 4000); r.tick(9100); ok('standing still long enough serves the Stop-and-Go', r.cars[0].pending.length === 0);
  r = mk({}); r.addPoints(0, 6, 200); r.assign(0, 1, 300); lap(r, 1, [5000, 10000, 15000, 20000, 25000]); lap(r, 0, [6000, 12000, 18000, 24000, 30000]);
  ok('an unserved penalty is still pending when the race ends', r.status === 'finished' && r.cars[0].pending.length === 1);
  const t0 = r.cars[0].total;
  ok('review: add time to the driver', r.addTime(0, 8000) && r.standings()[1].index === 0 && r.penMs(r.cars[0]) === r.cars[0].extraMs + 0 && r.cars[0].total === t0);
  ok('review: forgive the unserved penalty', r.forgive(0, 0) && r.cars[0].pending.length === 0);
  ok('review: clear the points', r.nullify(0) && r.cars[0].points === 0);
  ok('review: disqualify and reinstate', r.setDq(0, true) && r.cars[0].dq && r.standings()[1].gap === 'DQ' && r.setDq(0, false) && !r.cars[0].dq && r.cars[0].done);
  r = mk({}); r.addPoints(0, 7, 100); lap(r, 0, [5000]); r.nullify(0); ok('review: clearing points can be undone', r.cars[0].points === 0 && r.restorePoints(0) && r.cars[0].points === 7 && !r.restorePoints(0));
  r = mk({}); lap(r, 0, [5000, 9000, 15000]);
  ok('review: an invalid lap leaves the best lap and averages', r.setInvalid(0, 1, true) && r.cars[0].best === 5000 && r.goodLaps(r.cars[0]).join() === '5000,6000' && r.setInvalid(0, 1, false) && r.cars[0].best === 4000);
  ok('review: removing a lap from the records only keeps the race as driven', r.removeLap(0, 0, false) && r.cars[0].laps.length === 3 && r.cars[0].removed.join() === '0' && r.cars[0].total === 15000);
  ok('review: removing a lap and recalculating takes it out of the race', r.removeLap(0, 1, true) && r.cars[0].laps.join() === '5000,6000' && r.cars[0].total === 11000 && r.cars[0].best === 5000 && r.cars[0].removed.join() === '0');
}

// fuel rules: use follows the lap time, within limits
{
  const rule = { tank: 20, perLap: 2, targetLap: 7.3, maxExtra: 25, maxSaving: 30, empty: 'retire', rate: 10 };
  const F = fuelConfig({ pitHold: 2 }, rule);
  ok('fuel rule: read from the rule, pit hold from the setup', F.on && F.tank === 20 && F.perLap === 2 && F.target === 7300 && F.extra === 0.25 && F.saving === 0.3 && F.pitHold === 2000);
  ok('a lap at the target time uses the normal amount', fuelUse(F, 7300) === 2);
  ok('a quicker lap uses more (target / lap time)', Math.abs(fuelUse(F, 7000) - 2 * 7300 / 7000) < 1e-5);
  ok('...but never more than the limit above', fuelUse(F, 3000) === 2.5);
  ok('a slower lap uses less', Math.abs(fuelUse(F, 8000) - 2 * 7300 / 8000) < 1e-5);
  ok('...but never less than the limit below, however slow', fuelUse(F, 60000) === 1.4);
  ok('without a target lap time every lap uses the same', fuelUse(fuelConfig({}, { ...rule, targetLap: '' }), 3000) === 2);
  ok('the limits are the percentages the user types', fuelUse(fuelConfig({}, { ...rule, maxExtra: 50, maxSaving: 10 }), 1000) === 3 && fuelUse(fuelConfig({}, { ...rule, maxExtra: 50, maxSaving: 10 }), 99000) === 1.8);
  const r = createRace({ type: 'race', laps: 9, minLap: 100, fuel: F, entries: E(1) }); r.start(0);
  r.cross(0, 7300); r.cross(0, 14300); // 7.3 s then 7.0 s
  ok('in the race each lap takes the fuel of its own lap time', Math.abs(r.cars[0].fuel - (20 - 2 - 2 * 7300 / 7000)) < 1e-5);
  const r2 = createRace({ type: 'race', laps: 9, minLap: 100, fuel: fuelConfig({}, { ...rule, tank: 2.2, empty: 'retire' }), entries: E(1) }); r2.start(0);
  r2.cross(0, 9000); // a slow lap needs only about 1.62 litres: 2.2 is enough, 0.58 left
  ok('a slow lap leaves fuel in the tank that a fast lap would have used', Math.abs(r2.cars[0].fuel - (2.2 - 2 * 7300 / 9000)) < 1e-5 && !r2.cars[0].outOfFuel);
  r2.cross(0, 15000); // 6 s needs 2.5 litres, only 0.58 left
  ok('a lap that needs more than is left runs the tank dry', r2.cars[0].outOfFuel && r2.cars[0].retired);
}

// race by laps, end when every car has finished
let R = createRace({ type: 'race', laps: 3, endRule: 'all', entries: E(2) }); R.start(0);
lap(R, 0, [5000, 10000, 15000]);
ok('leader done after 3 laps', R.cars[0].done && R.cars[0].place === 1);
ok('race not over while the other car runs', R.status === 'running');
lap(R, 1, [6000, 12000]); ok('still running with the slow car on 2 laps', R.status === 'running');
R.cross(1, 18000); ok('race ends when the last car finishes', R.status === 'finished' && R.endedBy === 'Every car finished');
ok('standings: finish order', R.standings()[0].index === 0 && R.standings()[1].gap === '+3.000');

// race by laps, end when lead car finishes
R = createRace({ type: 'race', laps: 2, endRule: 'leader', entries: E(2) }); R.start(0);
R.cross(1, 6000); lap(R, 0, [5000, 10000]);
ok('ends the moment the leader finishes', R.status === 'finished' && R.endedBy === 'The lead car finished');
ok('trailing car ranked by laps', R.standings()[1].index === 1 && R.standings()[1].car.laps.length === 1 && R.standings()[1].gap === '+1.000');
ok('a lapped car\'s gap is a time (never "+1 lap"): compared with the leader at the same lap count', (() => { const X = createRace({ type: 'race', laps: 9, endRule: 'all', minLap: 100, entries: E(2) }); X.start(0); lap(X, 0, [5000, 10000, 15000, 20000]); lap(X, 1, [7000, 14500]); const g = X.standings()[1].gap; return g === '+4.500' && !/lap/.test(g); })());
ok('leader and cars without laps have no gap', (() => { const X = createRace({ type: 'race', laps: 9, minLap: 100, entries: E(3) }); X.start(0); lap(X, 0, [5000]); lap(X, 1, [6000]); const st = X.standings(); return st[0].gap === '' && st[1].gap === '+1.000' && st[2].gap === ''; })());

// double trigger ignored
R = createRace({ type: 'race', laps: 5, entries: E(1) }); R.start(0);
R.cross(0, 5000); ok('double trigger ignored', R.cross(0, 5300) === false && R.cars[0].laps.length === 1);

// timed race: cars finish on the crossing after time is up, that lap counts
R = createRace({ type: 'timed', duration: 0.1, entries: E(2) }); R.start(0); // 6 s
lap(R, 0, [2500, 5000]); R.tick(6100);
ok('time up does not end the race by itself', R.status === 'running' && R.timeUp);
R.cross(0, 7500); ok('car finishes on next crossing, lap counted', R.cars[0].done && R.cars[0].laps.length === 3);
lap(R, 1, [3000]); R.cross(1, 9000);
ok('timed race ends when every car has crossed', R.status === 'finished');
ok('timed winner has most laps', R.standings()[0].index === 0);

// pause does not count
R = createRace({ type: 'race', laps: 2, entries: E(1) }); R.start(0); R.cross(0, 5000);
R.pause(6000); ok('elapsed frozen while paused', R.elapsed(20000) === 6000);
R.resume(16000); R.cross(0, 21000);
ok('pause time excluded from lap time', R.cars[0].laps[1] === 6000 && R.cars[0].total === 11000 && R.status === 'finished');

// practice and qualifying rank by best lap
R = createRace({ type: 'practice', entries: E(2) }); R.start(0);
lap(R, 0, [5000, 10000]); lap(R, 1, [4500, 11000]);
ok('practice ranks by best lap', R.standings()[0].index === 1 && R.standings()[1].gap === '+0.500');
R.stop(12000); ok('practice only ends when stopped', R.status === 'finished' && R.endedBy === 'Stopped');
R = createRace({ type: 'qualifying', duration: 0.05, entries: E(1) }); R.start(0); R.cross(0, 2000); R.tick(3100); R.cross(0, 5000);
ok('qualifying ends when all cars have crossed after time up', R.status === 'finished');

// flags
R = createRace({ type: 'race', laps: 5, entries: E(1) }); R.start(0); R.cross(0, 5000);
R.setFlag('yellow', 6000);
ok('yellow flag shows and timing carries on', R.flag === 'yellow' && R.status === 'running' && R.cross(0, 10000) && R.cars[0].laps.length === 2);
R.setFlag('yellow', 11000); ok('pressing yellow again clears it', R.flag === '' && R.status === 'running');
R.setFlag('red', 12000);
ok('red flag pauses the race and the clock', R.flag === 'red' && R.status === 'paused' && R.elapsed(99000) === 12000);
ok('crossings are ignored while red-flagged', R.cross(0, 15000) === false);
R.setFlag('yellow', 13000); ok('yellow cannot replace a red flag', R.flag === 'red');
R.setFlag('red', 30000); ok('pressing red again clears it and resumes', R.flag === '' && R.status === 'running' && R.elapsed(35000) === 17000);
R.setFlag('red', 31000); R.resume(40000); ok('resuming also clears the red flag', R.flag === '' && R.status === 'running');
ok('live lap time counts from the last crossing', R.lapElapsed(0, 45000) === 45000 - R.cars[0].last);
R.pause(46000); ok('live lap time stops while paused', R.lapElapsed(0, 99999) === 46000 - R.cars[0].last);
R.stop(47000); ok('flags clear when the race ends', R.flag === '' && R.status === 'finished');
ok('no flags before the start', (() => { const X = createRace({ type: 'race', laps: 2, entries: E(1) }); X.setFlag('red', 0); return X.flag === '' && X.status === 'ready'; })());
ok('time format', fmtTime(5231) === '5.231' && fmtTime(65231) === '1:05.231' && fmtTime(null) === '–');
// ---- fuel and pit stops ----
const fcfg = (o = {}) => fuelConfig({ fuel: 'on', fuelTank: 3, fuelPerLap: 1, fuelRate: 1, fuelEmpty: 'retire', pitHold: 2, ...o });
const fr = (o, laps = 50) => { const r = createRace({ type: 'race', laps, endRule: 'all', minLap: 100, fuel: fcfg(o), entries: E(2) }); r.start(0); return r; };
ok('fuel settings: defaults when empty', (c => c.on === false && c.tank === 120 && c.perLap === 1 && c.rate === 10 && c.empty === 'retire' && c.pitHold === 2000)(fuelConfig({})));
ok('fuel settings: from the setup', (c => c.on && c.tank === 50 && c.perLap === 0.5 && c.rate === 4 && c.empty === 'stop' && c.pitHold === 3000)(fuelConfig({ fuel: 'on', fuelTank: 50, fuelPerLap: 0.5, fuelRate: 4, fuelEmpty: 'stop', pitHold: 3 })));
R = fr();
ok('the tank starts full and every lap uses fuel', R.cars[0].fuel === 3 && (R.cross(0, 1000), R.cars[0].fuel === 2) && R.fuelOf(0, 1000) === 2);
R.cross(0, 2000); R.cross(0, 3000);
ok('a car with an empty tank cannot complete another lap: it retires', R.cross(0, 4000) === false && R.cars[0].retired && R.cars[0].done && R.cars[0].laps.length === 3 && R.cars[0].outOfFuel);
ok('...and the events say so', R.events.map(e => e.type).join() === 'outoffuel,retired');
R.cross(1, 1500);
const st = R.standings();
ok('retired cars rank behind the others, with gap "Out"', st[0].index === 1 && st[1].index === 0 && st[1].gap === 'Out');
let RS = fr({ fuelEmpty: 'stop' }); lap(RS, 0, [1000, 2000, 3000]);
ok('stop mode: laps no longer count, but the car is not out', RS.cross(0, 4000) === false && RS.cross(0, 5000) === false && RS.cars[0].laps.length === 3 && !RS.cars[0].retired && !RS.cars[0].done && RS.cars[0].outOfFuel);
let RW = fr({ fuelEmpty: 'warn' }); lap(RW, 0, [1000, 2000, 3000, 4000, 5000]);
ok('warning mode: laps keep counting with an empty tank', RW.cars[0].laps.length === 5 && RW.cars[0].fuel === 0 && RW.cars[0].outOfFuel && !RW.cars[0].retired);
const PS = { name: 'P', timeRule: 'every', everyPoints: 5, everySeconds: 5, fuelPoints: 2 };
const frp = (o, pen = PS) => { const r = createRace({ type: 'race', laps: 50, endRule: 'all', minLap: 100, fuel: fcfg(o), penalty: pen ? penaltyConfig(pen) : undefined, entries: E(2) }); r.start(0); return r; };
ok('fuel penalty: the penalty system reads the points (none by default)', penaltyConfig({ fuelPoints: 3 }).fuelPoints === 3 && penaltyConfig({}).fuelPoints === 0 && penaltyConfig(null).fuelPoints === 0);
let RP = frp({ fuelEmpty: 'warn' }); lap(RP, 0, [1000, 2000, 3000]);
ok('fuel penalty: laps with fuel give no points', RP.cars[0].points === 0 && !RP.cars[0].outOfFuel);
lap(RP, 0, [4000, 5000]);
ok('fuel penalty: the car carries on, every lap on empty adds the points', RP.cars[0].laps.length === 5 && !RP.cars[0].retired && RP.cars[0].points === 4 && RP.cars[1].points === 0);
ok('...and the events say so', RP.events.filter(e => e.type === 'penalty').length === 2 && RP.events.some(e => e.type === 'outoffuel'));
ok('...the points turn into time through the penalty system (4 points = none yet, 5 = 5 s)', RP.penMs(RP.cars[0]) === 0 && (lap(RP, 0, [6000]), RP.cars[0].points === 6 && RP.penMs(RP.cars[0]) === 5000));
{ const mk = endRule => { const r = createRace({ type: 'race', laps: 4, endRule, minLap: 100, fuel: fcfg({ fuelEmpty: 'warn' }), penalty: penaltyConfig({ timeRule: 'every', everyPoints: 5, everySeconds: 5, dqPoints: 1, fuelPoints: 1 }), entries: E(2) }); r.start(0); lap(r, 0, [1000, 2000, 3000, 4000]); return r; };
  const rl = mk('leader'), ra = mk('all');
  ok('a car disqualified by fuel points on its last lap has not finished: no place, and the race does not end as "lead car finished"', rl.cars[0].dq && rl.cars[0].place === 0 && rl.finished === 0 && rl.status === 'running' && ra.cars[0].place === 0 && ra.finished === 0 && rl.cars[0].laps.length === 4); }
let RN = frp({ fuelEmpty: 'warn' }, null); lap(RN, 0, [1000, 2000, 3000, 4000, 5000]);
ok('fuel penalty without a penalty system: laps count, no points, no error', RN.cars[0].laps.length === 5 && RN.cars[0].points === 0);
let RQ = frp({ fuelEmpty: 'warn' }, { ...PS, fuelPoints: 0 }); lap(RQ, 0, [1000, 2000, 3000, 4000, 5000]);
ok('a penalty system with no fuel points gives none', RQ.cars[0].points === 0);
let RZ = frp({ fuelEmpty: 'stop' }); lap(RZ, 0, [1000, 2000, 3000, 4000, 5000]);
ok('fuel points only apply when the car carries on (not when laps stop counting)', RZ.cars[0].points === 0 && RZ.cars[0].laps.length === 3);
let RE = createRace({ type: 'race', laps: 9, endRule: 'all', minLap: 100, fuel: fcfg({ fuelTank: 2 }), entries: E(2) }); RE.start(0);
lap(RE, 0, [1000, 2000, 3000]); lap(RE, 1, [1000, 2000, 3000, 4000]);
ok('retired cars count as done, so the race ends when every car is finished or retired', RE.cars[0].retired && RE.cars[1].retired && RE.status === 'finished');
let R0 = createRace({ type: 'race', laps: 50, minLap: 100, entries: E(1) }); R0.start(0); lap(R0, 0, [1000, 2000, 3000, 4000, 5000]);
ok('fuel off: nothing changes', R0.cars[0].laps.length === 5 && !R0.cars[0].retired && R0.fuelOf(0, 5000) === null);

// pit stops
R = fr({ fuelEmpty: 'stop' }); lap(R, 0, [1000, 2000, 3000]);
ok('stopping on the sensor counts as a crossing (here ignored: no fuel)', R.block(0, 5000) === true && R.cars[0].blockAt === 5000 && R.cars[0].laps.length === 3);
R.tick(6000); ok('no pit stop before the sensor was blocked long enough', R.cars[0].pit === null);
R.tick(7000); ok('the pit stop starts after the hold time (2 s)', R.cars[0].pit && R.cars[0].pit.start === 7000 && R.events.some(e => e.type === 'pitstart'));
ok('refuelling runs at the set speed from the start of the stop (1 L/s)', R.fuelOf(0, 8000) === 1 && R.fuelOf(0, 8500) === 1.5);
ok('...and stops when the tank is full', R.fuelOf(0, 20000) === 3);
ok('the pit time is live while stopped', (p => p.live && p.ms === 3000)(R.pitTime(0, 8000)));
R.unblock(0, 9000);
ok('driving off ends the stop: refuelled amount, duration measured from blocking the sensor', (l => l.duration === 4000 && l.refuelled === 2 && l.at === 5000)(R.cars[0].lastPit) && R.cars[0].fuel === 2 && R.cars[0].pits.length === 1 && R.cars[0].outlap);
ok('...the car counts laps again and the outlap ends', R.cross(0, 10000) === true && R.cars[0].fuel === 1 && !R.cars[0].outlap && R.cars[0].laps.length === 4 && !R.cars[0].outOfFuel);
ok('the last stop stays available as the pit time', (p => !p.live && p.ms === 4000)(R.pitTime(0, 12000)));
R = fr(); lap(R, 0, [1000]); R.block(0, 2000); R.unblock(0, 3000);
ok('a block shorter than the hold time is no pit stop', R.cars[0].pits.length === 0 && R.cars[0].blockAt === null && R.cars[0].fuel === 1 && R.pitTime(0, 3000) === null);
R = fr(); lap(R, 0, [1000]); R.block(0, 2000); R.tick(4000);
R.pause(5000); R.resume(9000); R.tick(9100);
ok('a paused race does not count pit time or refuelling', R.cars[0].blockAt === 6000 && R.cars[0].pit.start === 8000 && Math.abs(R.fuelOf(0, 9100) - 2.1) < 1e-9);
R = fr(); lap(R, 0, [1000]); R.block(0, 2000); R.tick(4000); R.stop(5000);
ok('ending the race closes a pit stop in progress', R.cars[0].blockAt === null && R.cars[0].pits.length === 1 && R.cars[0].pits[0].duration === 3000);
ok('pit stops only happen while racing', (() => { const r = createRace({ type: 'race', laps: 5, fuel: fcfg(), entries: E(1) }); return r.block(0, 100) === false; })());
R0 = createRace({ type: 'race', laps: 50, minLap: 100, entries: E(1) }); R0.start(0); R0.block(0, 1000); R0.tick(3500); R0.unblock(0, 4000);
ok('pit stops are timed even with fuel off (for drive-through penalties later)', R0.cars[0].pits.length === 1 && R0.cars[0].pits[0].duration === 3000 && R0.cars[0].pits[0].refuelled === 0);
// ---- the lap with a pit stop is marked (1.0.0): the figures of Results leave it out ----
{ R = fr({ fuelEmpty: 'stop' }); lap(R, 0, [1000, 2000, 3000]);
  ok('a car that never pitted has no pit laps', R.cars[0].pitLaps.length === 0 && R.cars[1].pitLaps.length === 0);
  R.block(0, 5000); R.tick(7000); R.unblock(0, 9000);
  ok('the lap in which the car stood in the pits is marked when the car crosses the line (the 4th lap, number 3 from 0)', R.cross(0, 10000) === true && R.cars[0].pitLaps.length === 1 && R.cars[0].pitLaps[0] === 3);
  ok('...and the lap after it is a normal lap again', R.cross(0, 11000) === true && R.cars[0].pitLaps.length === 1 && R.cars[0].laps.length === 5);
  R.removeLap(0, 1, true);
  ok('removing an earlier lap from the race moves the mark with its lap', R.cars[0].pitLaps.length === 1 && R.cars[0].pitLaps[0] === 2);
  R.removeLap(0, 2, true);
  ok('removing the pit lap itself takes the mark away', R.cars[0].pitLaps.length === 0);
  { const r = createRace({ type: 'race', laps: 50, minLap: 100, entries: E(1) }); r.start(0); r.block(0, 1000); r.tick(3500); r.unblock(0, 4000); r.cross(0, 5000);
    const had = r.cars[0].pitLaps.length; r.restartCar(0, 6000);
    ok('a new stint on the lane (time tokens) starts without marks (and the stop was marked before, even with fuel off)', had === 1 && r.cars[0].pitLaps.length === 0); }
}
// ---- the yellow flag target lap time (0.99.0) ----
{
  const { yellowConfig } = require('../renderer/engine.js');
  ok('the setup gives the target in ms and the points: 15 seconds and the standard 1 point, nothing without a target', (c => c.target === 15000 && c.points === 1)(yellowConfig({ yellowTarget: 15 })) && (c => c.target === 0 && c.points === 0)(yellowConfig({})) && (c => c.target === 0 && c.points === 0)(yellowConfig({ yellowTarget: 0, yellowPoints: 3 })) && (c => c.target === 7500 && c.points === 2)(yellowConfig({ yellowTarget: '7.5', yellowPoints: '2' })));
  ok('...a blank number of points is the standard 1, 0 is no points, a fraction is cut, a damaged value or no setup at all gives nothing', yellowConfig({ yellowTarget: 10, yellowPoints: '' }).points === 1 && yellowConfig({ yellowTarget: 10, yellowPoints: 0 }).points === 0 && yellowConfig({ yellowTarget: 10, yellowPoints: 2.9 }).points === 2 && yellowConfig({ yellowTarget: 'x' }).target === 0 && yellowConfig(undefined).target === 0 && yellowConfig({ yellowTarget: -5 }).target === 0);
  const P = penaltyConfig({ dqPoints: 3 });
  const mk = (o = {}) => { const r = createRace({ type: 'race', laps: 50, minLap: 100, penalty: P, yellow: { target: 15000, points: 1 }, entries: E(2), ...o }); r.start(0); return r; };
  const fast = r => r.events.filter(e => e.type === 'yellowfast');
  let r = mk(); lap(r, 0, [5000, 10000]); r.setFlag('yellow', 11000); lap(r, 0, [16000]);
  ok('a lap that began before the yellow flag went up is not a lap under yellow (it was partly green): no mark, no point', fast(r).length === 0 && r.cars[0].points === 0 && r.cars[0].yellowFast.length === 0 && r.yellowAt === 11000);
  lap(r, 0, [23000]);
  ok('the next lap (7.000, a full lap under yellow, faster than 15.000) is too fast: it is marked, logged with the lap number, the time and the target, and gets the point', fast(r).length === 1 && fast(r)[0].lap === 4 && fast(r)[0].ms === 7000 && fast(r)[0].target === 15000 && fast(r)[0].points === 1 && fast(r)[0].car === 0 && r.cars[0].yellowFast.join() === '3' && r.cars[0].points === 1);
  ok('...the event is logged before the penalty (the call comes first), and there is a penalty event with it', (i => i >= 0 && r.events[i + 1].type === 'penalty' && r.events[i + 1].delta === 1)(r.events.findIndex(e => e.type === 'yellowfast')));
  lap(r, 0, [38000, 54000]);
  ok('15.000 exactly is fast enough, and 16.000 is too: only laps that are faster than the target count', fast(r).length === 1 && r.cars[0].points === 1);
  lap(r, 0, [60000]);
  ok('every lap that is too fast is marked and penalised again (a lap of 6.000: the second one, lap 7)', fast(r).length === 2 && r.cars[0].points === 2 && r.cars[0].yellowFast.join() === '3,6');
  lap(r, 1, [3000, 6000]);
  ok('another car is judged on its own laps: its laps of 3.000 each began before the yellow flag (11.000) and are free', fast(r).length === 2 && r.cars[1].points === 0);
  lap(r, 1, [20000]); lap(r, 1, [26000]);
  ok('...its first full lap under yellow (6.000, from 20.000) is too fast, and it is another driver\'s point', fast(r).length === 3 && fast(r)[2].car === 1 && r.cars[1].points === 1 && r.cars[0].points === 2);
  r.setFlag('yellow', 61000); lap(r, 0, [66000]);
  ok('after the yellow flag is over (it is switched off) laps are free again', r.flag === '' && r.yellowAt === null && fast(r).length === 3);
  r.setFlag('yellow', 70000); lap(r, 0, [76000]); lap(r, 0, [82000]);
  ok('a second yellow flag starts a new period: the lap that began before it is free, the next one is not (6.000)', r.yellowAt === 70000 && fast(r).length === 4 && fast(r)[3].lap === r.cars[0].laps.length && fast(r)[3].car === 0);
  // a yellow flag raised by a call from a lane
  r = mk(); lap(r, 0, [5000]); r.call(1, 6000); lap(r, 0, [12000, 18000]);
  ok('a yellow flag that a lane\'s call raises counts the same', r.flag === 'yellow' && r.yellowAt === 6000 && fast(r).length === 1 && fast(r)[0].lap === 3);
  // a red flag takes the yellow away: nothing is judged under red
  r = mk(); r.setFlag('yellow', 1000); r.setFlag('red', 2000);
  ok('a red flag replaces the yellow flag: no yellow period is left over', r.flag === 'red' && r.yellowAt === null);
  r.setFlag('red', 3000); lap(r, 0, [4000, 8000, 12000]);
  ok('...and when the race goes on (green) laps are not judged', r.flag === '' && fast(r).length === 0 && r.cars[0].points === 0);
  // pausing: the paused time does not count, also not for the moment the yellow flag went up
  r = mk(); lap(r, 0, [5000]); r.setFlag('yellow', 6000); r.pause(7000); r.resume(10000); lap(r, 0, [14000]);
  ok('a pause with the yellow flag up moves the moment it went up with the race (6.000 became 9.000): the lap that began before it is free', r.yellowAt === 9000 && fast(r).length === 0);
  lap(r, 0, [20000]);
  ok('...and the next lap is judged, 6.000', fast(r).length === 1 && fast(r)[0].ms === 6000);
  // no target or no points
  r = mk({ yellow: { target: 0, points: 1 } }); r.setFlag('yellow', 1000); lap(r, 0, [2000, 4000, 6000]);
  ok('without a target nothing is judged, whatever the flag', fast(r).length === 0 && r.cars[0].points === 0);
  r = mk({ yellow: undefined }); r.setFlag('yellow', 1000); lap(r, 0, [2000, 4000, 6000]);
  ok('a race made without any yellow setting (an old one) judges nothing', fast(r).length === 0 && r.yellow.target === 0 && r.yellow.points === 0);
  r = mk({ yellow: { target: 15000, points: 0 } }); r.setFlag('yellow', 1000); lap(r, 0, [2000, 4000, 6000]);
  ok('with 0 points the lap is marked and logged, but no point is given', fast(r).length === 2 && fast(r).every(e => e.points === 0) && r.cars[0].points === 0 && r.cars[0].yellowFast.length === 2 && !r.events.some(e => e.type === 'penalty'));
  r = mk({ penalty: undefined }); r.setFlag('yellow', 1000); lap(r, 0, [2000, 4000, 6000]);
  ok('without a penalty system the lap is marked and logged, and the points cannot be given (the event says 0)', fast(r).length === 2 && fast(r).every(e => e.points === 0) && r.cars[0].points === 0);
  // a lap that is too slow to count, and the disqualify limit
  r = mk({ maxLap: 3000 }); r.setFlag('yellow', 1000); lap(r, 0, [2000, 12000]);
  ok('a lap that is longer than the track\'s longest lap time (10.000 against 3.000: too slow for the records) is still faster than the target and is judged', r.cars[0].bad[1] === true && fast(r).length === 1 && fast(r)[0].ms === 10000);
  r = mk({ penalty: penaltyConfig({ dqPoints: 2 }) }); r.setFlag('yellow', 1000); lap(r, 0, [2000, 4000, 6000]);
  ok('enough points disqualify, as every penalty point does (2 points: disqualified, and no third judgement)', r.cars[0].dq === true && r.cars[0].points === 2 && fast(r).length === 2);
  // removing a lap from the race moves the marks
  r = mk(); r.setFlag('yellow', 1000); lap(r, 0, [2000, 4000, 6000, 8000]);
  ok('the laps that are too fast are marked: laps 2, 3 and 4 (lap 1 began at the start, before the yellow flag at 1.000, so it is free)', r.cars[0].yellowFast.join() === '1,2,3');
  r.removeLap(0, 1, true);
  ok('taking a lap out of the race moves the marks (the mark of the lap that went is gone, the later ones move up)', r.cars[0].yellowFast.join() === '1,2' && r.cars[0].laps.length === 3);
  // the new stint on a lane starts clean
  r = mk(); r.setFlag('yellow', 1000); lap(r, 0, [2000, 4000]); r.restartCar(0, 5000);
  ok('a new stint on a lane (time tokens) starts without marks', r.cars[0].yellowFast.length === 0);
  // the race ends: the yellow period is over
  r = mk(); r.setFlag('yellow', 1000); r.stop(2000);
  ok('the end of the race clears the flag and the yellow period', r.flag === '' && r.yellowAt === null);
  ok('the setup is in the race: its target and points are read from the config', mk().yellow.target === 15000 && mk().yellow.points === 1);
}

console.log(fails ? fails + ' FAILED' : 'ALL ENGINE TESTS PASSED');

// gap numbers for the spoken calls (gapInfo): gap to the leader and to the car in front, and full laps behind
{
  const mk = o => createRace({ type: 'race', laps: 50, minLap: 1000, entries: E(3), ...o });
  const r = mk({}); r.start(0);
  lap(r, 0, [4000, 8000, 12000, 16000]); lap(r, 1, [4400, 8800, 13500]); lap(r, 2, [9000, 17000]);
  const g = r.gapInfo();
  ok('gapInfo: one entry per car, the leader has no gap', g.length === 3 && g[0].pos === 1 && g[0].lead === null && g[0].ahead === null && g[0].down === 0);
  ok('...the second car is behind the leader by the difference at its own lap count (3 laps: 13500 against 12000)', g[1].pos === 2 && g[1].lead === 1500 && g[1].ahead === 1500 && g[1].down === 0);
  ok('...the third car is a lap down after its 2nd lap (17000: the leader did lap 3 at 12000 and lap 4 at 16000), the gap to the car in front is worked out at its own laps', g[2].pos === 3 && g[2].down === 2 && g[2].lead === 17000 - 8000 && g[2].ahead === 17000 - 8800);
  const r2 = mk({}); r2.start(0); lap(r2, 0, [4000]); lap(r2, 1, [4500]);
  ok('a car in front that is one lap more ahead: the gap is taken at the laps of the car behind', r2.gapInfo()[1].lead === 500 && r2.gapInfo()[1].down === 0);
  const r3 = mk({}); r3.start(0); lap(r3, 0, [4000, 8000]); lap(r3, 1, [5000, 10000]); r3.cars[1].dq = true;
  ok('a disqualified car has no numbers, and the others are counted without it', r3.gapInfo()[1] === null && r3.gapInfo()[0].pos === 1);
  const r4 = mk({}); r4.start(0); lap(r4, 0, [4000, 8000]); lap(r4, 1, [5000, 10000]); r4.cars[1].retired = true;
  ok('a retired car has none either', r4.gapInfo()[1] === null);
  const r5 = mk({}); r5.start(0);
  ok('before any lap everything is empty but the order, and nothing breaks', r5.gapInfo().length === 3 && r5.gapInfo().every(x => x === null || (x.lead === null && x.ahead === null)));
  const p = createRace({ type: 'practice', minLap: 1000, entries: E(3) }); p.start(0);
  lap(p, 0, [5000, 9000]); lap(p, 1, [5200, 10000]); lap(p, 2, [6000]);
  const gp = p.gapInfo();
  ok('practice compares best laps (4000 against 4800 and 6000), and nobody is a lap down', gp[0].lead === null && gp[1].lead === 800 && gp[1].ahead === 800 && gp[2].lead === 2000 && gp[2].ahead === 1200 && gp.every(x => x.down === 0));
  const q = createRace({ type: 'qualifying', duration: 5, minLap: 1000, entries: E(2) }); q.start(0); lap(q, 0, [5000]);
  ok('a car without a best lap has no gap in qualifying', q.gapInfo()[1] === null || q.gapInfo()[1].lead === null);
}
// ================= heat-based races =================
{
  const { buildSchedule, createHeatRace, createRace } = require('../renderer/engine.js');
  let fails2 = 0;
  const ok2 = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails2++; };
  const seeded = seed => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const pairs = sched => { const s = new Set(); sched.forEach(h => { for (let a = 0; a < h.length; a++) for (let b = a + 1; b < h.length; b++) s.add(Math.min(h[a].p, h[b].p) + '-' + Math.max(h[a].p, h[b].p)); }); return s; };
  const n = (c) => c * (c - 1) / 2;

  // round robin, 6 drivers, 2 lanes: everyone meets everyone, exactly 15 heats
  let s = buildSchedule({ count: 6, lanes: 2, plan: 'roundrobin', rnd: seeded(1) });
  ok2('round robin 6 drivers on 2 lanes = 15 heats', s.length === 15);
  ok2('every pair meets', pairs(s).size === n(6));
  const drives = Array(6).fill(0); s.forEach(h => h.forEach(e => drives[e.p]++));
  ok2('everyone drives 5 heats', drives.every(d => d === 5));
  ok2('lanes used by each heat are different', s.every(h => new Set(h.map(e => e.lane)).size === h.length));
  // lane balance: each driver should split their 5 heats across the 2 lanes about evenly
  const laneUse = Array.from({ length: 6 }, () => [0, 0]); s.forEach(h => h.forEach(e => laneUse[e.p][e.lane]++));
  ok2('lanes shared fairly (3/2 split at worst)', laneUse.every(u => Math.abs(u[0] - u[1]) <= 1));

  // more lanes need fewer heats, and still cover every pair
  s = buildSchedule({ count: 6, lanes: 4, plan: 'roundrobin', rnd: seeded(2) });
  ok2('6 drivers on 4 lanes: all pairs covered in few heats (' + s.length + ')', pairs(s).size === n(6) && s.length <= 5);
  s = buildSchedule({ count: 8, lanes: 4, plan: 'roundrobin', rnd: seeded(3) });
  ok2('8 drivers on 4 lanes: all pairs covered (' + s.length + ' heats)', pairs(s).size === n(8));
  s = buildSchedule({ count: 3, lanes: 4, plan: 'roundrobin', rnd: seeded(4) });
  ok2('fewer drivers than lanes: one heat with everyone', s.length === 1 && s[0].length === 3);

  // a track with one lane: nobody meets anybody. This used to loop forever, so it runs in a separate process that is stopped after 5 seconds
  {
    const run1 = (count, lanes) => require('child_process').spawnSync(process.execPath, ['-e', `const {buildSchedule}=require(${JSON.stringify(require.resolve('../renderer/engine.js'))});console.log(JSON.stringify(buildSchedule({count:${count},lanes:${JSON.stringify(lanes)},plan:'roundrobin'})))`], { timeout: 5000, encoding: 'utf8' });
    const one = run1(4, 1), got = one.status === 0 ? JSON.parse(one.stdout) : [];
    ok2('round robin on a 1-lane track ends, with one heat per driver', one.status === 0 && got.length === 4 && got.every(h => h.length === 1 && h[0].lane === 0) && new Set(got.map(h => h[0].p)).size === 4);
    ok2('a track saved with 0, negative or fractional lanes still gives a schedule', [[3, 0], [3, -2], [3, 'x'], [4, 2.5]].every(([c, l]) => { const r = run1(c, l); return r.status === 0 && JSON.parse(r.stdout).length > 0; }));
    s = buildSchedule({ count: 4, lanes: 2.9, plan: 'manual', heats: 2, rnd: seeded(8) });
    ok2('fractional lanes are rounded down (2.9 = 2 lanes)', s.length === 2 && s.every(h => h.length === 2 && h.every(e => e.lane < 2)));
  }

  // manual: 6 drivers on 2 lanes, 3 heats -> everybody drives exactly once
  s = buildSchedule({ count: 6, lanes: 2, plan: 'manual', heats: 3, rnd: seeded(5) });
  const once = Array(6).fill(0); s.forEach(h => h.forEach(e => once[e.p]++));
  ok2('manual: 3 heats on 2 lanes, everyone once', s.length === 3 && once.every(c => c === 1));
  s = buildSchedule({ count: 5, lanes: 2, plan: 'manual', heats: 5, rnd: seeded(6) });
  const cnt = Array(5).fill(0); s.forEach(h => h.forEach(e => cnt[e.p]++));
  ok2('manual: heats shared out evenly (max difference 1)', Math.max(...cnt) - Math.min(...cnt) <= 1 && s.every(h => new Set(h.map(e => e.p)).size === 2));
  s = buildSchedule({ count: 3, lanes: 3, plan: 'manual', heats: 3, rnd: seeded(7) });
  const lu = Array.from({ length: 3 }, () => [0, 0, 0]); s.forEach(h => h.forEach(e => lu[e.p][e.lane]++));
  ok2('manual: lanes rotate so each driver uses every lane once', lu.every(u => u.every(x => x === 1)));

  // running heats and totalling the result
  const people = ['A', 'B', 'C'].map((x, i) => ({ driverId: 'd' + i, carId: 'c' + i, driverName: x, carName: 'car' + x }));
  const plan = [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }], [{ p: 2, lane: 0 }, { p: 0, lane: 1 }]];
  const H = createHeatRace({ participants: people, schedule: plan, resultBy: 'points', points: [10, 8, 6] });
  const runHeat = (finishOrder) => { // finishOrder: car index that wins; 2 laps each, winner faster
    const R = createRace({ type: 'race', laps: 2, endRule: 'all', entries: H.entries() }); R.start(0);
    const [w, l] = finishOrder === 0 ? [0, 1] : [1, 0];
    R.cross(w, 5000); R.cross(w, 10000); R.cross(l, 6000); R.cross(l, 12000);
    return R;
  };
  let R1 = runHeat(0); const hr1 = H.record(R1);
  ok2('heat 1 points: winner 10, second 8', hr1.rows[0].points === 10 && hr1.rows[1].points === 8 && hr1.rows[0].participant === 0);
  ok2('there is a next heat', H.hasNext() && H.entries()[0].participant === 2);
  let R2 = runHeat(1); H.record(R2); // in heat 2 the second entry (participant 0) wins
  ok2('no more heats', !H.hasNext());
  const ov = H.overall();
  ok2('overall by points: A 20, B 8, C 8', ov[0].driverName === 'A' && ov[0].points === 20 && ov[0].laps === 4 && ov[0].heats === 2);
  const H2 = createHeatRace({ participants: people, schedule: plan, resultBy: 'laps', points: [] });
  H2.record(createRace({ type: 'race', laps: 1, entries: H2.entries() }));
  ok2('overall by total laps with no laps driven yet sorts without errors', H2.overall().length === 3);
  console.log(fails2 ? fails2 + ' HEAT TESTS FAILED' : 'ALL HEAT TESTS PASSED');
  process.exit(fails || fails2 ? 1 : 0);
}
