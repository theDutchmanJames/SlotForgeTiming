// 1.7.0: the overall result of a heat race by total race time (the lowest time wins), and what happens with a heat a driver did not finish:
// the driver ranks below the finishers (by laps), or the finish time is estimated from the driver's own average lap.
const E = require('../renderer/engine.js'), H_ = require('../renderer/heats.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const people = n => Array.from({ length: n }, (_, i) => ({ driverId: 'd' + i, carId: 'c' + i, driverName: 'D' + i, carName: 'car' + i }));

// ---- the settings ----
{ const s = E.scoringOf;
  ok('by default the result is not by time, and a heat that is not finished ranks below the finishers', s({}).byTime === false && s({}).unfinished === 'below' && s(undefined).byTime === false);
  ok('a result by time is a result by time when the heats are limited by laps (or nothing is said about the heats)', s({ resultBy: 'time' }).byTime === true && s({ resultBy: 'time', heatBy: 'laps' }).byTime === true);
  ok('...but not when the heats are limited by time: everybody drives the same time, so the laps count', s({ resultBy: 'time', heatBy: 'time' }).byTime === false);
  ok('...a result by laps or points is never by time', s({ resultBy: 'laps' }).byTime === false && s({ resultBy: 'points', heatBy: 'laps' }).byTime === false);
  ok('...and the settings of an earlier call are taken over when they say no, too (heats limited by time: the laps count, also when the heat race is made from those settings)', s(s({ resultBy: 'time', heatBy: 'time' })).byTime === false && s({ byTime: false, resultBy: 'time' }).byTime === false);
  ok('the settings of an earlier call are taken over (byTime: true)', s(s({ resultBy: 'time' })).byTime === true && s({ byTime: true, heatBy: 'time' }).byTime === true && s({ byTime: 'yes' }).byTime === false);
  ok('an unfinished heat is estimated only when the setup says so; anything else is the standard', s({ unfinished: 'estimate' }).unfinished === 'estimate' && s({ unfinished: 'below' }).unfinished === 'below' && s({ unfinished: 'x' }).unfinished === 'below' && s({ unfinished: undefined }).unfinished === 'below');
}

// ---- the race itself: the time of a car, whether it finished, and the time it would have needed ----
const car = (i, extra = {}) => ({ lane: i, participant: i, driverId: 'd' + i, carId: 'c' + i, driverName: 'D' + i, carName: 'C' + i, ...extra });
const race = (laps, n, extra = {}) => { const r = E.createRace({ type: 'race', laps, endRule: 'leader', entries: Array.from({ length: n }, (_, i) => car(i)), ...extra }); r.start(0); return r; };
{ const r = race(3, 3);
  [10000, 20000, 30000].forEach(t => r.cross(0, t)); // car 0 finishes: the race ends because the lead car finished
  ok('the lead car finishes its three laps: the race is over', r.status === 'finished' && r.cars[0].done === true && r.endedBy === 'The lead car finished');
  const r2 = race(3, 3);
  [10000, 20000].forEach(t => r2.cross(0, t)); [11000, 22000].forEach(t => r2.cross(1, t)); r2.cross(2, 15000);
  ok('before the race is over nobody has finished, and the limit is known', r2.lapLimit === 3 && r2.cars.every(c => !r2.finishedLaps(c)));
  [30000].forEach(t => r2.cross(0, t));
  ok('a car that drove all its laps has finished; the others have not', r2.finishedLaps(r2.cars[0]) === true && r2.finishedLaps(r2.cars[1]) === false && r2.finishedLaps(r2.cars[2]) === false);
  ok('the time of a car is the time of its last crossing', r2.timeOf(r2.cars[0]) === 30000 && r2.timeOf(r2.cars[1]) === 22000 && r2.timeOf(r2.cars[2]) === 15000);
  ok('a finished car needs no guess: the estimate is its own time', r2.estimateOf(r2.cars[0]) === 30000);
  ok('a car that did not finish: its time, plus the laps it still had to drive at its own average lap (2 laps of 11 s: 22 s + 1 x 11 s; 1 lap of 15 s: 15 s + 2 x 15 s)', r2.estimateOf(r2.cars[1]) === 33000 && r2.estimateOf(r2.cars[2]) === 45000);
  const r3 = race(3, 2); r3.cross(0, 9000);
  ok('a car without a lap has nothing to average: no estimate', r3.estimateOf(r3.cars[1]) === null);
  const r4 = race(3, 2, { penalty: E.penaltyConfig({ dqPoints: 10, mode: 'every', every: 1, seconds: 5 }) }); [10000, 20000, 30000].forEach(t => r4.cross(0, t)); r4.addTime(0, 4000); r4.adjust(0, { ms: 500 });
  ok('time that was added, and what the Race Director adjusted, are part of the time of the car', r4.timeOf(r4.cars[0]) === 34500 && r4.estimateOf(r4.cars[0]) === 34500);
  const r5 = race(3, 3, { endRule: 'all' }); r5.cross(0, 10000); r5.cross(0, 20000); r5.setDq(0, true);
  ok('a disqualified car has not finished and has no estimate', r5.finishedLaps(r5.cars[0]) === false && r5.estimateOf(r5.cars[0]) === null);
  const r6 = E.createRace({ type: 'timed', duration: 5, entries: [car(0)] }); r6.start(0); r6.cross(0, 10000);
  ok('a race that is not limited by laps has no finish and no estimate', r6.lapLimit === 0 && r6.finishedLaps(r6.cars[0]) === false && r6.estimateOf(r6.cars[0]) === null);
  const r7 = race(4, 2, { endRule: 'all' }); r7.cross(0, 10000); r7.cross(0, 20000); r7.cross(0, 31000);
  ok('slow laps and invalid laps are not part of the average lap', (r7.cars[0].bad[1] = true, r7.estimateOf(r7.cars[0]) === 31000 + 1 * 10500));
}

// ---- the rows of a heat ----
// a finished heat, without the real race: { p, laps, fin (finished), time (ms, the race time), estimate (ms or absent), best }
const fake = rows => ({
  standings: () => rows.map((r, i) => ({ pos: i + 1, car: { participant: r.p, laps: Array(r.laps).fill(0), total: r.time ?? null, best: r.best ?? null, fin: !!r.fin, time: r.time ?? null, estimate: r.estimate ?? null } })),
  finishedLaps: c => c.fin, timeOf: c => c.time, estimateOf: c => c.estimate
});
const make = (n, cfg = {}, sched) => E.createHeatRace({ participants: people(n), schedule: sched || [Array.from({ length: n }, (_, i) => ({ p: i, lane: i }))], resultBy: 'time', ...cfg });
{ const h = make(3, { unfinished: 'below' }), res = h.record(fake([{ p: 0, laps: 3, fin: true, time: 30000, best: 9000 }, { p: 1, laps: 2, time: 22000, estimate: 33000 }, { p: 2, laps: 0 }]));
  ok('with "below" a finisher has its time, and a car that did not finish has none (and says it did not finish)', res.rows[0].fin === true && res.rows[0].tm === 30000 && res.rows[1].fin === false && res.rows[1].tm === null && res.rows[2].tm === null && res.rows.every(r => r.est === undefined));
  const h2 = make(3, { unfinished: 'estimate' }), res2 = h2.record(fake([{ p: 0, laps: 3, fin: true, time: 30000 }, { p: 1, laps: 2, time: 22000, estimate: 33000 }, { p: 2, laps: 0 }]));
  ok('with "estimate" a car that did not finish gets the estimated time, marked as an estimate; a car without one still has none', res2.rows[1].tm === 33000 && res2.rows[1].est === true && res2.rows[1].fin === false && res2.rows[2].tm === null && res2.rows[2].est === undefined && res2.rows[0].est === undefined);
  const h3 = make(2, { resultBy: 'laps' }), res3 = h3.record(fake([{ p: 0, laps: 3, fin: true, time: 30000 }, { p: 1, laps: 2 }]));
  ok('a result by laps has none of these figures in its rows (the saved results stay as they were)', res3.rows.every(r => r.fin === undefined && r.tm === undefined && r.est === undefined));
  const h4 = make(2, { resultBy: 'time', heatBy: 'time' }), res4 = h4.record(fake([{ p: 0, laps: 3, fin: true, time: 30000 }, { p: 1, laps: 2 }]));
  ok('heats limited by time count laps, whatever the setup says about the result', res4.rows.every(r => r.tm === undefined) && h4.scoring.byTime === false);
  const bare = { standings: () => [{ pos: 1, car: { participant: 0, laps: [1, 1, 1], total: 30000, best: 1 } }, { pos: 2, car: { participant: 1, laps: [1], total: 9000, best: 1 } }] };
  const h5 = make(2); const r5 = h5.record(bare);
  ok('a stand-in race that cannot tell who finished has nobody finished, and no times (nothing breaks)', r5.rows.every(r => r.fin === false && r.tm === null));
}

// ---- the overall result: the lowest total time wins ----
const order = h => h.overall().map(o => o.participant).join();
// two heats of three drivers; D2 did not finish heat 1
const twoHeats = (cfg, e2 = {}) => {
  const h = make(3, cfg, [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }, { p: 2, lane: 2 }], [{ p: 0, lane: 0 }, { p: 1, lane: 1 }, { p: 2, lane: 2 }]]);
  h.record(fake([{ p: 0, laps: 3, fin: true, time: 30000, best: 9000 }, { p: 1, laps: 3, fin: true, time: 31000, best: 9200 }, { p: 2, laps: 2, time: 22000, estimate: 'estimate' in e2 ? e2.estimate : 29500, best: 9100 }]));
  h.record(fake([{ p: 2, laps: 3, fin: true, time: 28000, best: 9000 }, { p: 0, laps: 3, fin: true, time: 29000, best: 9100 }, { p: 1, laps: 3, fin: true, time: 33000, best: 9300 }]));
  return h;
};
{ const h = twoHeats({ unfinished: 'below' }), o = h.overall();
  ok('"below": the lowest total time wins (D0 59.000, D1 1:04.000); D2 did not finish a heat and ranks below those who did, although D2 was the fastest in heat 2', order(h) === '0,1,2' && o[0].score === 59000 && o[1].score === 64000);
  ok('...D2 has the time of the heat it finished, says one heat was not finished, and is not marked as estimated', o[2].score === 28000 && o[2].incomplete === 1 && o[2].estimated === 0 && o[0].incomplete === 0);
  ok('...the laps still add up for everybody (D2: 2 + 3 = 5 laps)', o[2].laps === 5 && o[0].laps === 6 && o[2].heats === 2);
  const e = twoHeats({ unfinished: 'estimate' }), oe = e.overall();
  ok('"estimate": the estimated time of D2 (29.500 + 28.000 = 57.500) is the lowest, so D2 wins, and the result says the time is estimated', order(e) === '2,0,1' && oe[0].score === 57500 && oe[0].estimated === 1 && oe[0].incomplete === 0 && oe[1].estimated === 0);
  const bad = twoHeats({ unfinished: 'estimate' }, { estimate: null }), ob = bad.overall();
  ok('"estimate" for a car that has no estimate (it drove no lap): that heat counts as not finished, like "below"', order(bad) === '0,1,2' && ob[2].incomplete === 1 && ob[2].estimated === 0);
}
{ // two drivers who did not finish: the one with more laps ranks higher; then fewer heats not finished; then the time
  const h = make(4, { unfinished: 'below' }, [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }, { p: 2, lane: 2 }, { p: 3, lane: 3 }]]);
  h.record(fake([{ p: 0, laps: 3, fin: true, time: 40000 }, { p: 1, laps: 1, time: 9000 }, { p: 2, laps: 2, time: 20000 }, { p: 3, laps: 0 }]));
  ok('only one heat: the finisher wins, and the others follow by laps (2 laps, 1 lap, none)', order(h) === '0,2,1,3');
  const g = make(3, { unfinished: 'below' }, [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }, { p: 2, lane: 2 }], [{ p: 0, lane: 0 }, { p: 1, lane: 1 }, { p: 2, lane: 2 }]]);
  g.record(fake([{ p: 0, laps: 2, time: 20000 }, { p: 1, laps: 2, time: 20000 }, { p: 2, laps: 1, time: 10000 }]));
  g.record(fake([{ p: 0, laps: 3, fin: true, time: 30000 }, { p: 1, laps: 2, time: 21000 }, { p: 2, laps: 2, time: 22000 }]));
  ok('nobody finished everything: more laps in total first (D0 5, D1 4, D2 3); the same laps: fewer heats not finished, then the lower time', order(g) === '0,1,2');
  const t = make(3, { unfinished: 'below' }, [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }, { p: 2, lane: 2 }]]);
  t.record(fake([{ p: 0, laps: 3, fin: true, time: 30000 }, { p: 1, laps: 2, time: 20000 }, { p: 2, laps: 2, time: 19000 }]));
  ok('the same laps, both not finished, in the same number of heats: the lower time of what they drove ranks higher', order(t) === '0,2,1');
  const none = make(3, {}, [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }]]);
  none.record(fake([{ p: 0, laps: 3, fin: true, time: 30000 }, { p: 1, laps: 3, fin: true, time: 31000 }]));
  const o = none.overall();
  ok('a driver who has not raced yet has no time (null, not zero) and ranks last', order(none) === '0,1,2' && o[2].score === null && o[2].heats === 0 && o[0].incomplete === 0);
}
{ // equal times: the tie-break decides, as before
  const mkT = tb => { const h = make(2, { tieBreak: tb }, [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }]]); h.record(fake([{ p: 0, laps: 3, fin: true, time: 30000, best: 9500 }, { p: 1, laps: 3, fin: true, time: 30000, best: 9000 }])); return h; };
  ok('equal times: the standard puts the driver with the fastest lap first', order(mkT('default')) === '1,0' && order(mkT('bestlap')) === '1,0');
  ok('...and the most wins, when that is chosen (the first of the heat, D0, won the heat)', order(mkT('wins')) === '0,1');
}
{ // how the heats add up
  const sched = [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }], [{ p: 0, lane: 0 }, { p: 1, lane: 1 }], [{ p: 0, lane: 0 }]];
  const mk3 = cfg => { const h = make(2, cfg, sched); h.record(fake([{ p: 0, laps: 3, fin: true, time: 30000 }, { p: 1, laps: 3, fin: true, time: 32000 }])); h.record(fake([{ p: 1, laps: 3, fin: true, time: 31000 }, { p: 0, laps: 3, fin: true, time: 45000 }])); h.record(fake([{ p: 0, laps: 3, fin: true, time: 36000 }])); return h; };
  const all = mk3({}), avg = mk3({ countBy: 'average' }), drop = mk3({ dropWorst: 'yes' }), best = mk3({ countBy: 'best', bestHeats: 1 });
  ok('all heats added up: D0 raced three heats (30 + 45 + 36 s = 1:51.000), D1 two (1:03.000); D1 wins', order(all) === '1,0' && all.overall()[1].score === 111000 && all.overall()[0].score === 63000);
  ok('the average per heat is fair: D0 37.000 a heat, D1 31.500; D1 wins by the average', order(avg) === '1,0' && avg.overall()[1].score === 37000 && avg.overall()[0].score === 31500);
  ok('the worst heat dropped: D0 loses the 45 s heat (66.000), D1 loses its 32 s heat (31.000); D1 wins', order(drop) === '1,0' && drop.overall()[1].score === 66000 && drop.overall()[0].score === 31000 && drop.overall()[1].dropped.join() === '2' && drop.overall()[1].counted === 2);
  ok('only the best heat: D0 30.000 against D1 31.000; D0 wins', order(best) === '0,1' && best.overall()[0].score === 30000 && best.overall()[1].score === 31000 && best.overall()[0].counted === 1);
  const mixed = make(2, { unfinished: 'below', dropWorst: 'yes' }, [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }], [{ p: 0, lane: 0 }, { p: 1, lane: 1 }]]);
  mixed.record(fake([{ p: 0, laps: 3, fin: true, time: 30000 }, { p: 1, laps: 1, time: 9000 }])); mixed.record(fake([{ p: 1, laps: 3, fin: true, time: 31000 }, { p: 0, laps: 3, fin: true, time: 32000 }]));
  ok('dropping the worst heat drops a heat that was not finished first: D1 keeps only the finished heat (31.000, nothing left unfinished), D0 drops the slower 32.000 and keeps 30.000; D0 wins', order(mixed) === '0,1' && mixed.overall()[1].incomplete === 0 && mixed.overall()[1].score === 31000 && mixed.overall()[0].score === 30000);
}
{ // finals
  const sch = [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }, { p: 2, lane: 2 }]];
  const mkF = fm => { const h = make(3, { finals: 'a', finalMode: fm, lanes: 2 }, sch); h.record(fake([{ p: 0, laps: 3, fin: true, time: 30000, best: 9000 }, { p: 1, laps: 3, fin: true, time: 31000, best: 9100 }, { p: 2, laps: 3, fin: true, time: 40000, best: 9500 }])); return h; };
  const added = mkF('added');
  ok('the final A is raced by the two best of the heat result (D0, D1)', added.finalPlan[0].name === 'A' && same(added.finalPlan[0].drivers, [0, 1]));
  added.pick(0); added.pick(1); added.record(fake([{ p: 1, laps: 3, fin: true, time: 25000 }, { p: 0, laps: 3, fin: true, time: 26000 }]));
  const oa = added.overall();
  ok('"added": the time of the final is added to the time of the heats (D0 30 + 26 = 56.000, D1 31 + 25 = 56.000... D1 31.000 + 25.000 = 56.000, equal: the fastest lap decides); D2 is not in the final', oa[0].finalName === 'A' && oa[0].score === 56000 && oa[1].score === 56000 && oa[0].participant === 0 && oa[2].participant === 2 && oa[2].score === 40000 && oa[0].finalTime === 26000 && oa[0].heatScore === 30000);
  const places = mkF('places');
  places.pick(0); places.pick(1); places.record(fake([{ p: 1, laps: 3, fin: true, time: 25000 }, { p: 0, laps: 3, fin: true, time: 26000 }]));
  ok('"places": the final decides the places (D1 won it), whatever the heat times were', order(places) === '1,0,2' && places.overall()[0].score === 31000);
  const unf = mkF('added'); unf.pick(0); unf.pick(1); unf.record(fake([{ p: 1, laps: 3, fin: true, time: 25000 }, { p: 0, laps: 1, time: 9000 }]));
  const ou = unf.overall();
  ok('"added" with a final that D0 did not finish: that counts as a heat not finished (it has the time of the heats, 30.000, and 1 not finished), and ranks below D1', ou[0].participant === 1 && ou[1].participant === 0 && ou[1].incomplete === 1 && ou[1].finalTime === null && ou[1].score === 30000);
}

// ---- how it is said ----
{ const sc = E.scoringOf({ resultBy: 'time' }), est = E.scoringOf({ resultBy: 'time', unfinished: 'estimate', countBy: 'average' });
  ok('the overall result says it is by total race time, and what happens with a heat that was not finished', H_.scoringText(sc, false) === 'Overall result: the lowest total race time wins; a driver who did not finish a heat ranks below the drivers who did, by laps.');
  ok('...or that the time is estimated; the other rules follow', H_.scoringText(est, false) === 'Overall result: the lowest total race time wins; the finish time of a driver who did not finish a heat is estimated from their own average lap; the average per heat.');
  ok('...and a result by laps or points says nothing about it', !/race time/.test(H_.scoringText(E.scoringOf({ countBy: 'average' }), false)) && H_.scoringText(E.scoringOf({}), false) === '');
  const row = o => ({ score: 125341, counted: 2, heats: 2, incomplete: 0, estimated: 0, ...o });
  ok('the result is a time', H_.scoreText(row(), sc) === '2:05.341' && H_.scoreText(row({ score: 59000 }), sc) === '59.000');
  ok('...an estimated time says so, and a heat that was not finished is counted', H_.scoreText(row({ estimated: 1 }), sc) === '2:05.341 (estimated)' && H_.scoreText(row({ incomplete: 2 }), sc) === '2:05.341 (2 not finished)' && H_.scoreText(row({ estimated: 1, incomplete: 1 }), sc) === '2:05.341 (estimated) (1 not finished)');
  ok('...the average is marked, the heats that counted are told, and a driver without a time has a dash', H_.scoreText(row(), est) === '2:05.341 avg' && H_.scoreText(row({ counted: 1 }), sc) === '2:05.341 (1 of 2 heats)' && H_.scoreText(row({ score: null, heats: 0, counted: 0 }), sc) === '–');
  ok('...a final that is added: the heats, the final, and the sum', H_.scoreText({ ...row({ score: 56000 }), heatScore: 30000, finalTime: 26000, finalPos: 2 }, sc, { finalMode: 'added' }) === '30.000 + 26.000 final = 56.000' && H_.scoreText({ ...row({ score: 56000 }), heatScore: 30000, finalTime: 26000, finalPos: 2 }, sc, { finalMode: 'places' }) === '56.000');
  const line = H_.summary({ stats: H_.stats([[{ p: 0, lane: 0 }, { p: 1, lane: 1 }]], 2, 2), setup: { sessionType: 'heats', heatBy: 'time', duration: 5, resultBy: 'time', heatPlan: 'manual' }, names: ['A', 'B'] });
  ok('Home says that heats limited by time cannot be counted by time, and that laps count instead', line.some(l => /Total race time needs heats that are limited by laps/.test(l)) && line.every(l => !/lowest total race time wins/.test(l)));
  const line2 = H_.summary({ stats: H_.stats([[{ p: 0, lane: 0 }, { p: 1, lane: 1 }]], 2, 2), setup: { sessionType: 'heats', heatBy: 'laps', laps: 5, resultBy: 'time', heatPlan: 'manual' }, names: ['A', 'B'] });
  ok('...and for heats limited by laps it says how the result is counted', line2.some(l => /lowest total race time wins/.test(l)) && line2.every(l => !/needs heats that are limited by laps/.test(l)));
}

if (fails) { console.log(fails + ' HEAT TIME TESTS FAILED'); process.exit(1); }
console.log('ALL HEAT TIME TESTS PASSED');
