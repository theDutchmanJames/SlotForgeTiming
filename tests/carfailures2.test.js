// 1.44.0: Car Failures, release 2. The Race Director gives a car a failure or clears it (the engine: who can, which one, what it does to the car, a car that a failure put out comes back), the
// words of the result (a car, the heats and the overall result), the audio calls (the folder Car Failures, the words, no second penalty call), the panel (Failures.view) and the commands of the server.
const RE = require('../renderer/engine.js'), Dm = require('../renderer/damage.js'), Fl = require('../renderer/failures.js'), St = require('../renderer/stats.js'), A = require('../renderer/announcer.js');
let fails = 0; const ok = (m, c) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const SEC = 1000;
const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
const F1 = (chance, seconds = 5, level = 'Light damage', name = 'Lift and Coast') => ({ name, level, chance, seconds });
const entry = (lane, over) => ({ lane, driverId: 'd' + lane, driverName: 'Driver' + lane, carId: 'car' + lane, ...over });
// a list of three that nothing rolls (chance 0), so a failure only comes when the Race Director gives it: 0 Slow Puncture (Heavy damage, 8 s), 1 Engine Failure (Critical damage, retires), 2 Lift and Coast (Light damage, 5 s)
const LIST = (ch = [0, 0, 0]) => [F1(ch[0], 8, 'Heavy damage', 'Slow Puncture'), F1(ch[1], 0, 'Critical damage', 'Engine Failure, Box to Retire'), F1(ch[2], 5, 'Light damage', 'Lift and Coast')];
const mk = (o = {}) => RE.createRace({ type: 'race', laps: o.laps ?? 10, minLap: 800, rnd: o.rnd || seq(0.99),
  penalty: o.penalty === false ? undefined : RE.penaltyConfig({ everyPoints: 5, everySeconds: 5, ...(o.penaltyOver || {}) }),
  damage: o.damage === null ? undefined : Dm.clean({ ...Dm.defaults(), failuresOn: 'on', failFrom: 0, failTo: 100, failures: LIST(), ...(o.rec || {}) }, 0), entries: o.entries || [entry(0), entry(1)] });
const started = o => { const R = mk(o); R.start(0); R.cars.forEach(c => { c.started = true; }); return R; };
const types = (R, ty, car) => R.events.filter(e => e.type === ty && (car === undefined || e.car === car));
const drive = (R, i, from, to, lapMs = 30 * SEC) => { for (let t = from + lapMs; t <= to; t += lapMs) R.cross(i, t); };

// ---- who can be given a failure, and who can have one cleared ----
{ const N = mk(); const R = started();
  ok('before the start nobody can be given a failure (the race is not running)', same(N.failureCan(0), { give: false, clear: false }) && N.giveFailure(0, 0, SEC) === false);
  ok('a racing car with no failure: it can be given one, there is nothing to clear', same(R.failureCan(0), { give: true, clear: false }));
  const O = started({ rec: { failuresOn: 'off' } });
  ok('a race without Car Failures: nothing can be given or cleared, and nothing is logged', same(O.failureCan(0), { give: false, clear: false }) && O.giveFailure(0, 0, SEC) === false && O.clearFailure(0, SEC) === false && !O.events.some(e => /^failure/.test(e.type)));
  ok('...nor a car that is not in the race', same(R.failureCan(7), { give: false, clear: false }) && R.giveFailure(7, 0, SEC) === false && R.clearFailure(7, SEC) === false);
  R.pause(5 * SEC);
  ok('a race that is paused: the Race Director can still give a failure (like damage)', R.failureCan(0).give === true && R.giveFailure(0, 0, 6 * SEC) === true); }

// ---- giving a failure ----
{ const R = started(); drive(R, 0, 0, 40 * SEC);
  ok('give failure 0 (Slow Puncture) to lane 1: true, the car has it, it counts as a failure of the car', R.giveFailure(0, 0, 41 * SEC) === true && R.cars[0].fail.name === 'Slow Puncture' && R.cars[0].fail.k === 0 && R.cars[0].failN === 1);
  const e = types(R, 'failure');
  ok('...logged as a failure that the Race Director gave (and the rules of its level: 8 s, as fast as you can, a repair, 3 laps)', e.length === 1 && e[0].by === 'director' && e[0].name === 'Slow Puncture' && e[0].seconds === 8 && e[0].urgent === true && e[0].action === 'repair' && e[0].within === 3 && e[0].car === 0);
  const f = R.failureOf(0, 42 * SEC);
  ok('...a screen is told: active, what it asks, 3 laps left (it starts with the lap the car is in)', f.active === true && f.name === 'Slow Puncture' && f.lapsLeft === 3 && f.tone === 'red');
  ok('...no damage points come with it, and the other car is not touched', R.cars[0].dmg === 0 && R.cars[1].fail === null && R.failureOf(1, 42 * SEC).active === false);
  ok('a car that has a failure cannot be given another (clear it first), nor one that is not in the list', same(R.failureCan(0), { give: false, clear: true }) && R.giveFailure(0, 2, 43 * SEC) === false && R.cars[0].failN === 1 && R.giveFailure(1, 9, 43 * SEC) === false && R.cars[1].failN === 0);
  ok('a car whose slot car has a Failure factor of 0 can still be given one (the factor is for the roll of the race only)', (() => { const Q = started({ entries: [entry(0, { failureFactor: 0 }), entry(1)] }); return Q.giveFailure(0, 2, SEC) === true && Q.cars[0].fail.name === 'Lift and Coast'; })()); }
{ const R = started({ rec: { failures: LIST([10, 20, 70]) }, entries: [entry(0), entry(1, { failureFactor: 0 })], rnd: seq(0.99, 0.99, 0.99, 0.5, 0.05, 0.95) }); // (the second car is not rolled: its Failure factor is 0)
  ok('nothing was rolled at the start (the random numbers were all high)', R.cars.every(c => c.flPlan.length === 0));
  ok('"at random" (-1, or no number) takes one by the chances of the list: 50 of 100 falls in the third (70%)', R.giveFailure(0, -1, 5 * SEC) === true && R.cars[0].fail.k === 2);
  ok('...the next one: 5 of 100 is the first (10%), 95 of 100 the last', R.giveFailure(1, undefined, 6 * SEC) === true && R.cars[1].fail.k === 0 && (() => { R.clearFailure(1, 7 * SEC); R.clearFailure(0, 7 * SEC); return R.giveFailure(0, -1, 8 * SEC) && R.cars[0].fail.k === 2; })()); }
{ const R = started({ rec: { failures: LIST([0, 0, 0]) }, rnd: seq(0.5) });
  ok('with no chance anywhere, "at random" is any of the failures, all alike (0.5 of 3 is the second)', R.giveFailure(0, -1, 5 * SEC) === true && R.cars[0].fail.k === 1); }

// ---- a car that cannot be given a failure ----
{ const R = started({ laps: 2 }); R.cross(0, 30 * SEC); R.cross(0, 60 * SEC);
  ok('a car that has finished its laps is done: no failure', R.cars[0].done === true && R.failureCan(0).give === false && R.giveFailure(0, 0, 61 * SEC) === false);
  const S = started(); S.block(1, 10 * SEC);
  ok('a car that stands on the pit sensor: not now (a stop that has begun would take the failure as part of it)', S.failureCan(1).give === false && S.giveFailure(1, 0, 11 * SEC) === false);
  const D = started(); D.addDamage(0, 10, 5 * SEC); D.block(0, 10 * SEC); D.tick(12 * SEC);
  ok('a car that damage put out: no failure', D.cars[0].dmgOut === 'retire' && D.failureCan(0).give === false && D.giveFailure(0, 0, 13 * SEC) === false);
  const Q = started({ penaltyOver: { dqPoints: 3 } }); Q.addPoints(0, 3, 5 * SEC);
  ok('a car that is disqualified: no failure', Q.cars[0].dq === true && Q.failureCan(0).give === false && Q.giveFailure(0, 0, 6 * SEC) === false);
  const F = started({ laps: 2 }); F.cross(1, 30 * SEC); F.cross(1, 60 * SEC); F.cross(0, 31 * SEC); F.cross(0, 61 * SEC);
  ok('...and when the race is over nobody can be given one', F.status === 'finished' && F.giveFailure(0, 0, 70 * SEC) === false); }

// ---- the failure the Race Director gave is cleared in the pits like any other ----
{ const R = started(); drive(R, 0, 0, 40 * SEC); R.giveFailure(0, 0, 41 * SEC);
  R.block(0, 50 * SEC); R.tick(57 * SEC);
  ok('the stop: not done before the seconds of the failure (8 s)', R.cars[0].fail !== null);
  R.tick(58 * SEC + 100);
  ok('...then it is repaired, the time is counted, and the car can be given another', R.cars[0].fail === null && R.cars[0].failMs === 8 * SEC && types(R, 'failurerepaired').length === 1 && R.cars[0].failures.length === 1 && !R.cars[0].failures[0].cleared
    && (R.unblock(0, 59 * SEC), R.failureCan(0).give === true)); }
// ... and a failure that is in the plan waits for the one the Race Director gave
{ const R = started({ rec: { failures: [F1(100, 8, 'Heavy damage', 'Slow Puncture')] }, rnd: seq(0, 0.3) });
  ok('a car with a failure in its plan (lap 3) ...', same(R.cars[0].flPlan, [{ k: 0, at: 3 }]));
  R.giveFailure(0, 0, 5 * SEC); drive(R, 0, 0, 100 * SEC);
  ok('...does not get it while it has the failure that was given: one failure, no second', R.cars[0].failN === 1 && R.cars[0].flPlan.length === 1);
  R.block(0, 101 * SEC); R.tick(110 * SEC); R.unblock(0, 111 * SEC); R.cross(0, 130 * SEC);
  ok('...the planned one starts when the car has cleared the first', R.cars[0].failN === 2 && R.cars[0].flPlan.length === 0 && R.cars[0].fail !== null && types(R, 'failure').map(e => !!e.by).join() === 'true,false'); }

// ---- clearing a failure ----
{ const R = started(); drive(R, 0, 0, 40 * SEC);
  ok('nothing to clear: false, nothing logged', R.clearFailure(0, 41 * SEC) === false && types(R, 'failurecleared').length === 0);
  R.giveFailure(0, 0, 42 * SEC);
  ok('clear the failure: true, the car has none', R.clearFailure(0, 43 * SEC) === true && R.cars[0].fail === null && R.failureOf(0, 44 * SEC).active === false);
  const c = types(R, 'failurecleared');
  ok('...logged as cleared by the Race Director, with the name', c.length === 1 && c[0].by === 'director' && c[0].name === 'Slow Puncture' && c[0].car === 0 && !c[0].out);
  ok('...kept in the history of the car as cleared (no time in the pits, not a repair), and it still counts as a failure the car had', same(R.cars[0].failures, [{ at: 43 * SEC, ms: 0, name: 'Slow Puncture', lap: 1, cleared: true }]) && R.cars[0].failN === 1 && R.cars[0].failMs === 0 && Fl.repairsOf(R.cars[0]) === 0);
  ok('...no penalty points, and a stop afterwards costs nothing (there is no failure to leave unrepaired)', R.cars[0].points === 0 && (R.block(0, 50 * SEC), R.tick(51 * SEC), R.unblock(0, 52 * SEC), R.cars[0].points === 0 && types(R, 'failureearly').length === 0 && types(R, 'failurerepaired').length === 0));
  ok('...and it can be given another one', R.giveFailure(0, 2, 60 * SEC) === true); }
// a failure cleared with damage on the car: the damage stays
{ const R = started(); drive(R, 0, 0, 40 * SEC); R.addDamage(0, 3, 41 * SEC); R.giveFailure(0, 0, 42 * SEC); R.clearFailure(0, 43 * SEC);
  ok('clearing the failure does not touch the damage of the car', R.cars[0].dmg === 3 && R.cars[0].fail === null && R.failureCan(0).clear === false); }

// ---- a car that a failure put out is back in the race ----
const ENG = { rec: { failures: LIST() } };
const outRace = (how = 'retire', o = {}) => {
  const R = started({ ...o, rec: how === 'dq' ? { levels: [{ name: 'Gone', from: 5, seconds: 0, urgency: 'asap', within: 0, action: 'dq' }], failures: [F1(0, 3, 'Gone', 'Fatal')] } : ENG.rec });
  drive(R, 0, 0, 90 * SEC); R.giveFailure(0, how === 'dq' ? 0 : 1, 91 * SEC); R.block(0, 100 * SEC); R.tick(104 * SEC); return R; };
{ const R = outRace();
  ok('a car that a failure retired: out, nothing to give, something to clear', R.cars[0].failOut === 'retire' && R.cars[0].done === true && R.cars[0].retired === true && same(R.failureCan(0), { give: false, clear: true }) && R.status === 'running');
  ok('clear it: the car is back in the race (not done, not retired, no failure out), logged as cleared and as reinstated', R.clearFailure(0, 105 * SEC) === true && R.cars[0].failOut === '' && R.cars[0].done === false && R.cars[0].retired === false && R.cars[0].dq === false
    && types(R, 'failurecleared')[0].out === true && types(R, 'reinstated')[0].by === 'failure' && R.failureOf(0, 106 * SEC).out === '');
  ok('...its history says cleared instead of "out", and it counts laps again', R.cars[0].failures.length === 1 && R.cars[0].failures[0].cleared === true && !('out' in R.cars[0].failures[0]) && (() => { const n = R.cars[0].laps.length; R.unblock(0, 107 * SEC); R.cross(0, 130 * SEC); return R.cars[0].laps.length === n + 1; })());
  ok('...and it can be given a failure again', R.failureCan(0).give === true); }
{ const R = outRace('dq');
  ok('a car that a failure disqualified: out as disqualified', R.cars[0].failOut === 'dq' && R.cars[0].dq === true && R.cars[0].done === true);
  ok('clear it: not disqualified any more, back in the race', R.clearFailure(0, 105 * SEC) === true && R.cars[0].dq === false && R.cars[0].done === false && R.cars[0].failOut === ''); }
{ const R = outRace('retire', { penaltyOver: { dqPoints: 3 } }); R.addPoints(0, 3, 105 * SEC);
  ok('a car that also has too many penalty points stays out when the failure is cleared (it is out for that reason)', R.cars[0].dq === true && R.clearFailure(0, 106 * SEC) === true && R.cars[0].failOut === '' && R.cars[0].dq === true && R.cars[0].done === true && types(R, 'reinstated').length === 0); }
{ const R = started({ rec: { failures: LIST() }, entries: [entry(0)] }); drive(R, 0, 0, 90 * SEC); R.giveFailure(0, 1, 91 * SEC); R.block(0, 100 * SEC); R.tick(104 * SEC);
  ok('when the only car is out the race is over, and then the failure cannot be cleared any more', R.status === 'finished' && R.failureCan(0).clear === false && R.clearFailure(0, 105 * SEC) === false && R.cars[0].failOut === 'retire'); }

// ---- the result in words: a car ----
{ const R = started();
  ok('a car with no failure, and a race with none: nothing', R.failureNoteOf(0) === '' && started({ damage: null }).failureNoteOf(0) === '' && Fl.noteOf(null, [], 0) === '');
  drive(R, 0, 0, 40 * SEC); R.giveFailure(0, 0, 41 * SEC); R.block(0, 50 * SEC); R.tick(59 * SEC); R.unblock(0, 60 * SEC);
  ok('a failure that was repaired: the name, "repaired", and the time in the pits', R.failureNoteOf(0) === 'Slow Puncture (repaired, 8 seconds in the pits)');
  R.giveFailure(0, 2, 70 * SEC);
  ok('...a failure that is still there: "not repaired"', R.failureNoteOf(0) === 'Slow Puncture (repaired, 8 seconds in the pits), Lift and Coast (not repaired)');
  R.clearFailure(0, 71 * SEC);
  ok('...one that the Race Director cleared', R.failureNoteOf(0) === 'Slow Puncture (repaired, 8 seconds in the pits), Lift and Coast (cleared by the Race Director)');
  ok('...the other car has none', R.failureNoteOf(1) === ''); }
{ const R = started(); drive(R, 0, 0, 40 * SEC); R.giveFailure(0, 0, 41 * SEC); R.block(0, 50 * SEC); R.tick(54 * SEC); R.unblock(0, 55 * SEC);
  ok('a car that leaves too early: told, with what is left of the failure', R.failureNoteOf(0) === 'Slow Puncture (not repaired), left the pits too early once');
  drive(R, 0, 55 * SEC, 190 * SEC);
  ok('...and late for the pits (a lap after the deadline), once for every lap, each with a penalty point', R.failureNoteOf(0) === 'Slow Puncture (not repaired), late for the pits twice, left the pits too early once' && R.cars[0].points === 3); }
{ const R = outRace();
  ok('a car that a failure retired: "retired"', R.failureNoteOf(0) === 'Engine Failure, Box to Retire (retired)');
  const Q = outRace('dq'); ok('...disqualified (with the seconds it stood in the pits)', Q.failureNoteOf(0) === 'Fatal (disqualified, 3 seconds in the pits)'); }

// ---- the result in words: the rows, the words behind a name, the heats ----
{ const out = { retired: true, failureOut: 'retire' }, dq = { dq: true, failureOut: 'dq' };
  ok('the result says why a car is out: by a failure (and still by damage or fuel as before)', St.outText(out) === 'retired by a failure' && St.outText(dq) === 'disqualified by a failure' && St.outText({ retired: true, damageOut: 'retire' }) === 'retired, too much damage'
    && St.outText({ retired: true }) === 'retired, out of fuel' && St.outText({ dq: true }) === 'disqualified' && St.outText({ dq: true, damageOut: 'dq' }) === 'disqualified, too much damage');
  ok('"Failures:" with the note, after the damage in the notes behind a name', St.failureText({ failureNote: 'Slow Puncture (repaired)' }) === 'Failures: Slow Puncture (repaired)' && St.failureText({}) === '' && St.notesText({ bopNote: 'a', tyreNote: 'b', damageNote: 'c', failureNote: 'd' }) === 'Balance of Power: a; Tyres: b; Damage: c; Failures: d' && St.notesText({ failureNote: 'd' }) === 'Failures: d'); }
{ ok('only a repair counts as a repair: not a failure that put the car out, and not one that the Race Director cleared', Fl.repairsOf({ failures: [{ out: 'retire' }, { cleared: true }, {}, {}] }) === 2 && Fl.repairsOf(null) === 0 && Fl.repairsOf({}) === 0); }
{ const rows = [{ failures: 2, failureRepairs: 2, failureMs: 25000 }, { failures: 1, failureRepairs: 0, failureMs: 0, failureOut: 'retire' }, {}];
  ok('heats added up: how many failures in how many heats, the repairs with the time, and in how many heats the car was put out', Fl.totalNote(rows, null) === '3 failures in 2 heats, 2 repaired (25 seconds in the pits), retired by a failure in 1 heat');
  ok('...with the final: "and the final"; only in the final: "in the final"; one heat: "in 1 heat"; disqualified', Fl.totalNote(rows.slice(0, 1), { failures: 1, failureRepairs: 1, failureMs: 5000 }) === '3 failures in 1 heat and the final, 3 repaired (30 seconds in the pits)'
    && Fl.totalNote([{}], { failures: 1, failureRepairs: 1, failureMs: 5000 }) === '1 failure in the final, 1 repaired (5 seconds in the pits)' && Fl.totalNote([{ failures: 1, failureOut: 'dq' }], null) === '1 failure in 1 heat, disqualified by a failure in 1 heat');
  ok('...a driver with none has nothing', Fl.totalNote([{}, {}], null) === '' && Fl.totalNote([], null) === '' && Fl.totalNote(undefined, undefined) === ''); }
// the real thing: a heat race
{ const people = [0, 1].map(i => ({ driverId: 'd' + i, carId: 'c' + i, driverName: 'D' + i, carName: 'car' + i }));
  const H = RE.createHeatRace({ participants: people, schedule: [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }], [{ p: 0, lane: 0 }, { p: 1, lane: 1 }]], resultBy: 'laps', points: [] });
  const heat = () => { const R = RE.createRace({ type: 'race', laps: 2, endRule: 'all', minLap: 800, rnd: seq(0.99), damage: Dm.clean({ ...Dm.defaults(), failuresOn: 'on', failFrom: 0, failTo: 100, failures: LIST() }, 0), entries: H.entries() }); R.start(0); R.cars.forEach(c => { c.started = true; }); return R; };
  const R1 = heat(); R1.giveFailure(0, 0, 5 * SEC); R1.block(0, 10 * SEC); R1.tick(20 * SEC); R1.unblock(0, 21 * SEC); R1.giveFailure(0, 2, 30 * SEC);
  R1.cross(0, 40 * SEC); R1.cross(0, 80 * SEC); R1.cross(1, 30 * SEC); R1.cross(1, 60 * SEC);
  const a = H.record(R1).rows, a0 = a.find(x => x.participant === 0), a1 = a.find(x => x.participant === 1);
  ok('the row of a heat says what the failures did to the car: the note and the figures', a0.failureNote === 'Slow Puncture (repaired, 8 seconds in the pits), Lift and Coast (not repaired)' && a0.failures === 2 && a0.failureRepairs === 1 && a0.failureMs === 8 * SEC && !('failureOut' in a0));
  ok('...a car without a failure has nothing', !('failureNote' in a1) && !('failures' in a1) && !('failureMs' in a1));
  const R2 = heat(); R2.giveFailure(0, 1, 5 * SEC); R2.block(0, 10 * SEC); R2.tick(14 * SEC); R2.cross(1, 30 * SEC); R2.cross(1, 60 * SEC);
  const b0 = H.record(R2).rows.find(x => x.participant === 0);
  ok('...a car that a failure put out says so (every heat starts with no failures)', b0.failureNote === 'Engine Failure, Box to Retire (retired)' && b0.failures === 1 && b0.failureOut === 'retire' && b0.failureRepairs === 0);
  const ov = H.overall(), o0 = ov.find(x => x.participant === 0), o1 = ov.find(x => x.participant === 1);
  ok('the overall result adds them up: failures, repairs, time in the pits, and in how many heats the car was put out', o0.failureNote === '3 failures in 2 heats, 1 repaired (8 seconds in the pits), retired by a failure in 1 heat' && o0.failures === 3 && o0.failureRepairs === 1 && o0.failureMs === 8 * SEC);
  ok('...a driver without a failure has nothing in the overall result', !('failureNote' in o1) && !('failures' in o1)); }

// ---- the audio calls ----
{ const set = require('../renderer/sound.js').defaultSet('x');
  const calls = A.CALLS.filter(c => c.group === 'Car Failures');
  ok('seven calls in the folder Car Failures, right after Damage; all on in a new audio set', calls.map(c => c.id).join() === 'failure,failurecritical,failurelate,failureearly,failurerepaired,failureout,failuredq' && A.CALLS.findIndex(c => c.group === 'Car Failures') === A.CALLS.findIndex(c => c.id === 'damagedq') + 1
    && calls.every(c => set.calls[c.id] && set.calls[c.id].lines.length >= 2 && set.calls[c.id].on !== false));
  ok('the new word {failure} is explained and has a sample; every word of a sentence is a word of its call', A.VARS.failure && A.SAMPLE.failure === 'Slow Puncture' && calls.every(c => c.vars.includes('driver') && c.lines.every(l => [...l.matchAll(/\{(\w+)\}/g)].every(m => c.vars.includes(m[1]) || m[1] === 'team')) && c.vars.every(v => A.VARS[v] && A.SAMPLE[v] !== undefined)));
  const mkA = o => { const r = RE.createRace({ type: 'timed', duration: 600, minLap: 800, rnd: seq(0.99), penalty: RE.penaltyConfig({ everyPoints: 5, everySeconds: 5 }),
    damage: Dm.clean({ ...Dm.defaults(), failuresOn: 'on', failFrom: 0, failTo: 100, failures: LIST(), ...(o || {}) }, 0), entries: [{ lane: 0, driverId: 'a', driverName: 'Alex', nickname: 'Speedy', callsign: 'ALX', carId: 'c1' }] }); r.start(0); r.cars[0].started = true; return r; };
  const obs = (eng, an, t) => { eng.tick(t); return an.observe(eng, { phase: 'running', now: t }); };
  const fnames = ev => ev.filter(e => /^failure|^penalty$|^disqualified$/.test(e.call)).map(e => e.call).join();
  const eng = mkA(), an = A.create({ driverBy: 'name' }); obs(eng, an, 0);
  let out = (eng.giveFailure(0, 0, 1 * SEC), obs(eng, an, 1 * SEC)); const f = out.find(x => x.call === 'failure');
  ok('a failure that asks for a stop: "failure" with its name, how soon and for how long', !!f && f.vars.failure === 'Slow Puncture' && f.vars.when === 'as fast as you can' && f.vars.repair === '8 seconds' && f.vars.driver === 'Alex' && fnames(out) === 'failure');
  out = (eng.clearFailure(0, 2 * SEC), eng.giveFailure(0, 2, 3 * SEC), obs(eng, an, 3 * SEC)); const g = out.find(x => x.call === 'failure');
  ok('...a light one says "whenever you can" and its own seconds', !!g && g.vars.failure === 'Lift and Coast' && g.vars.when === 'whenever you can' && g.vars.repair === '5 seconds');
  eng.block(0, 10 * SEC); obs(eng, an, 12 * SEC); out = obs(eng, an, 15 * SEC + 100);
  ok('the stop is done: "failure repaired" with the name and how long it took', fnames(out) === 'failurerepaired' && out.find(x => x.call === 'failurerepaired').vars.failure === 'Lift and Coast' && out.find(x => x.call === 'failurerepaired').vars.repair === '5 seconds');
  const e2 = mkA(), a2 = A.create({}); obs(e2, a2, 0); e2.giveFailure(0, 1, 1 * SEC); out = obs(e2, a2, 1 * SEC);
  ok('a failure that ends the car: "failure critical" and not the call to pit for a repair', fnames(out) === 'failurecritical' && out[0] && out.find(x => x.call === 'failurecritical').vars.failure === 'Engine Failure, Box to Retire');
  e2.block(0, 5 * SEC); out = obs(e2, a2, 8 * SEC);
  ok('...at the stop the car is retired: "failure out" (and nothing else)', fnames(out) === 'failureout' && out.find(x => x.call === 'failureout').vars.failure === 'Engine Failure, Box to Retire');
  const e3 = mkA({ levels: [{ name: 'Gone', from: 5, seconds: 0, urgency: 'asap', within: 0, action: 'dq' }], failures: [F1(0, 0, 'Gone', 'Fatal')] }), a3 = A.create({}); obs(e3, a3, 0); e3.giveFailure(0, 0, 1 * SEC); obs(e3, a3, 1 * SEC); e3.block(0, 5 * SEC); out = obs(e3, a3, 8 * SEC);
  ok('a failure that disqualifies: "failure disqualified" instead of "failure out" (and no second "disqualified")', fnames(out) === 'failuredq' && !out.some(x => x.call === 'disqualified'));
  const e4 = mkA(), a4 = A.create({}); obs(e4, a4, 0); e4.giveFailure(0, 2, 1 * SEC); obs(e4, a4, 1 * SEC); e4.block(0, 5 * SEC); obs(e4, a4, 8 * SEC); e4.unblock(0, 9 * SEC); out = obs(e4, a4, 9 * SEC);
  ok('a car that leaves before the stop is done: "failure early", the penalty point is part of that call and is not said a second time', fnames(out) === 'failureearly' && out.find(x => x.call === 'failureearly').vars.points === 1 && e4.cars[0].points === 1 && out.find(x => x.call === 'failureearly').vars.failure === 'Lift and Coast');
  const e5 = mkA(), a5 = A.create({}); obs(e5, a5, 0); e5.giveFailure(0, 0, 1 * SEC); obs(e5, a5, 1 * SEC);
  for (let n = 1; n <= 4; n++) e5.cross(0, 1 * SEC + n * 30 * SEC);
  out = obs(e5, a5, 1 * SEC + 4 * 30 * SEC);
  ok('late for the pits (Slow Puncture within 3 laps): "failure late", the penalty point is part of that call', fnames(out) === 'failurelate' && out.find(x => x.call === 'failurelate').vars.points === 1 && e5.cars[0].points === 1 && out.find(x => x.call === 'failurelate').vars.failure === 'Slow Puncture');
  const e6 = mkA(), a6 = A.create({}); obs(e6, a6, 0); e6.giveFailure(0, 0, 1 * SEC); obs(e6, a6, 1 * SEC); out = (e6.clearFailure(0, 2 * SEC), obs(e6, a6, 2 * SEC));
  ok('a failure the Race Director clears is not said (nothing happened to the car)', fnames(out) === '');
  const plain = mkA({ failuresOn: 'off' }), ap = A.create({}); plain.start(0); ap.observe(plain, { phase: 'running' });
  ok('a race without Car Failures says nothing about failures', !fnames(obs(plain, ap, 99 * SEC))); }

// ---- the panel: what is shown for every lane ----
{ const R = started({ rec: { failures: LIST() }, entries: [entry(0, { teamName: 'Red Bulls' }), entry(1)] }); drive(R, 0, 0, 40 * SEC);
  const v0 = Fl.view(R, [0, 1], 41 * SEC, 'running');
  ok('the panel is on in a race with Car Failures; it names the failures and their chances; a row for every lane', v0.on === true && v0.rows.length === 2 && v0.info === 'Slow Puncture 0%, Engine Failure, Box to Retire 0%, Lift and Coast 0%.' && same(v0.failures.map(f => f.k + f.name), ['0Slow Puncture', '1Engine Failure, Box to Retire', '2Lift and Coast']));
  ok('...cars with no failure: "No failure", can be given one, nothing to clear; the name has the team', v0.rows.every(r => r.chip === 'No failure' && r.kind === 'ok' && r.give === true && r.clear === false) && v0.rows[0].who === 'Red Bulls · Driver0' && v0.rows[1].who === 'Driver1');
  R.giveFailure(0, 0, 42 * SEC); R.giveFailure(1, 1, 42 * SEC);
  const v1 = Fl.view(R, [0, 1], 43 * SEC, 'running');
  ok('a failure: its name, the colour, what it asks (the laps left, the seconds in the pits); it can be cleared, not given another', v1.rows[0].chip === 'Slow Puncture' && v1.rows[0].kind === 'red' && v1.rows[0].note === 'Pit in 3 laps, 8 seconds in the pits' && v1.rows[0].give === false && v1.rows[0].clear === true);
  ok('...a failure that ends the car says so', v1.rows[1].chip === 'Engine Failure, Box to Retire' && v1.rows[1].kind === 'out' && /the car is retired$/.test(v1.rows[1].note));
  drive(R, 0, 43 * SEC, 190 * SEC);
  ok('...a car that is late: red, and says how late', Fl.view(R, [0], 191 * SEC, 'running').rows[0].kind === 'red' && /late/.test(Fl.view(R, [0], 191 * SEC, 'running').rows[0].note));
  R.block(1, 200 * SEC); R.tick(202 * SEC);
  ok('on the sensor in the pits: "Repairing" with the clock; no buttons that would do nothing', (() => { R.block(0, 200 * SEC); R.tick(203 * SEC); const r = Fl.view(R, [0], 204 * SEC, 'running').rows[0]; return /^Repairing: stand still for 0:0\d more$/.test(r.note) && r.give === false; })());
  const v2 = Fl.view(R, [0, 1], 205 * SEC, 'running');
  ok('a car that a failure retired: "Retired", it can be cleared (it comes back)', v2.rows[1].chip === 'Retired' && v2.rows[1].kind === 'out' && v2.rows[1].note === 'Put out by a failure' && v2.rows[1].give === false && v2.rows[1].clear === true);
  ok('before the race starts and when it is over, no button works (the phase of the screen decides, like the damage panel)', Fl.view(R, [0, 1], 205 * SEC, 'ready').rows.every(r => !r.give && !r.clear) && Fl.view(R, [0], 205 * SEC, 'finished').rows.every(r => !r.give && !r.clear));
  ok('a lane without a car has no row; a race without Car Failures has no panel', Fl.view(R, [0, 5], 205 * SEC, 'running').rows.length === 1 && Fl.view(started({ rec: { failuresOn: 'off' } }), [0], SEC, 'running').on === false && Fl.view(null, [0], SEC, 'running').on === false);
  const done = started({ rec: { failures: LIST() } }); drive(done, 0, 0, 40 * SEC); done.giveFailure(0, 0, 41 * SEC); R.clearFailure(1, 206 * SEC);
  ok('a car that has had failures says how many so far when it has none now', (() => { const Q = started(); drive(Q, 0, 0, 40 * SEC); Q.giveFailure(0, 0, 41 * SEC); Q.clearFailure(0, 42 * SEC); const r = Fl.view(Q, [0], 43 * SEC, 'running').rows[0]; return r.chip === 'No failure' && r.note === '1 failure so far'; })()); }

// ---- the commands of the server ----
{ const S = require('../server.js');
  ok('the commands: give a failure (lane 0 to 15, a number of the list 0 to 99 or -1 for one at random) and clear one (a lane)', S.failureCommand({ type: 'failure', lane: 0, k: 2 }) && S.failureCommand({ type: 'failure', lane: 15, k: -1 }) && S.failureCommand({ type: 'failure', lane: 3, k: 99 }) && S.failureCommand({ type: 'failureclear', lane: 7 }));
  ok('...a lane that is not a whole number from 0 to 15, a number that is not in range, or no number: refused', ![{ type: 'failure', lane: 16, k: 0 }, { type: 'failure', lane: -1, k: 0 }, { type: 'failure', lane: 1.5, k: 0 }, { type: 'failure', lane: '1', k: 0 }, { type: 'failure', lane: 1, k: -2 }, { type: 'failure', lane: 1, k: 100 }, { type: 'failure', lane: 1, k: 1.5 }, { type: 'failure', lane: 1 }, { type: 'failure', k: 1 },
    { type: 'failureclear' }, { type: 'failureclear', lane: 16 }, { type: 'failureclear', lane: 'x' }].some(c => S.failureCommand(c)));
  ok('...other commands pass this check (the other checks are theirs)', S.failureCommand({ type: 'damage', lane: 99 }) === true && S.failureCommand({ type: 'start' }) === true);
  ok('both are commands the Race Director page may send', /const COMMANDS = \[[^\]]*'failure', 'failureclear'/.test(require('fs').readFileSync(__dirname + '/../server.js', 'utf8'))); }

console.log(fails ? fails + ' CAR FAILURE (RELEASE 2) TESTS FAILED' : 'ALL CAR FAILURE (RELEASE 2) TESTS PASSED'); process.exit(fails ? 1 : 0);
