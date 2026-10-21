// 1.65.0: the scoring choices of heats follow the limit. Heats limited by a time count the most laps (or the furthest distance), then the lowest total time; heats limited by laps or a distance
// count the lowest total time, then laps (as before); Points stays everywhere. The setup, the old setups, the engine, the words and the choices in the form.
const fs = require('fs'), os = require('os'), path = require('path');
const RL = require('../renderer/racelimit.js'), En = require('../renderer/endurance.js'), E = require('../renderer/engine.js'), Ht = require('../renderer/heats.js');
const Database = require('../db.js'), T = require('../transfer.js'), schema = require('../schema.js');
let fails = 0; const ok = (m, c) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };

// ---- which heats have the choice of their own ----
ok('heats limited by a time (also the heats of an Endurance Race) have their own scoring choice, the other heats and races do not',
  RL.isTimeHeats({ sessionType: 'heats', heatBy: 'time' }) && RL.isTimeHeats({ sessionType: 'endurance', enduranceBy: 'heats', heatBy: 'time' }) && !RL.isTimeHeats({ sessionType: 'heats', heatBy: 'laps' }) && !RL.isTimeHeats({ sessionType: 'heats', heatBy: 'distance' })
  && !RL.isTimeHeats({ sessionType: 'heats' }) && !RL.isTimeHeats({ sessionType: 'race', raceBy: 'time' }) && !RL.isTimeHeats({ sessionType: 'endurance', enduranceBy: 'time', heatBy: 'time' }) && !RL.isTimeHeats(null) && !RL.isTimeHeats(undefined));
{ const a = { sessionType: 'heats', heatBy: 'time', resultBy: 'points' }, b = { sessionType: 'heats', heatBy: 'time', resultBy: 'laps' }, c = { sessionType: 'heats', heatBy: 'time', resultBy: 'time' }, d = { sessionType: 'heats', heatBy: 'time' };
  ok('a setup from before 1.65.0 keeps what it counted by: points stay points, total laps (also "total race time", which counted laps in heats of a time) stay total laps', RL.upgradeScoring(a) === true && a.resultByTime === 'points' && RL.upgradeScoring(b) === true && b.resultByTime === 'laps'
    && RL.upgradeScoring(c) === true && c.resultByTime === 'laps' && RL.upgradeScoring(d) === true && d.resultByTime === 'laps');
  ok('...doing it twice changes nothing more, a choice that was made stays, and an unknown value is made again', RL.upgradeScoring(a) === false && a.resultByTime === 'points' && (() => { const x = { sessionType: 'heats', heatBy: 'time', resultByTime: 'lapstime' }; return RL.upgradeScoring(x) === false && x.resultByTime === 'lapstime'; })()
    && (() => { const x = { sessionType: 'heats', heatBy: 'time', resultByTime: 'rubbish', resultBy: 'points' }; return RL.upgradeScoring(x) === true && x.resultByTime === 'points'; })()
    && RL.upgradeScoring(b) === false && RL.upgradeScoring(c) === false && RL.upgradeScoring(d) === false && b.resultByTime === 'laps' && c.resultByTime === 'laps' && d.resultByTime === 'laps');
  ok('...other setups are left alone (heats of laps or a distance, a race, nothing at all)', [{ sessionType: 'heats', heatBy: 'laps' }, { sessionType: 'heats', heatBy: 'distance', resultBy: 'time' }, { sessionType: 'race', raceBy: 'time' }, null, undefined].every(s => RL.upgradeScoring(s) === false)
    && !('resultByTime' in { sessionType: 'heats', heatBy: 'laps' })); }
{ const s = { sessionType: 'heats', heatBy: 'time', resultByTime: 'lapstime', resultBy: 'time', compareBy: 'distance' }, e = RL.scoring(s);
  ok('the setup the race screen works with: heats of a time that count laps first are a result by laps (the rest of the program knows laps or points), and the setup itself is not changed', e.resultBy === 'laps' && e.resultByTime === 'lapstime' && e.compareBy === 'distance' && s.resultBy === 'time');
  ok('...points are points, total laps are laps, and a setup without the choice is what it counted by', RL.scoring({ sessionType: 'heats', heatBy: 'time', resultByTime: 'points', resultBy: 'laps' }).resultBy === 'points' && RL.scoring({ sessionType: 'heats', heatBy: 'time', resultByTime: 'laps', resultBy: 'points' }).resultBy === 'laps'
    && RL.scoring({ sessionType: 'heats', heatBy: 'time', resultBy: 'points' }).resultBy === 'points' && RL.scoring({ sessionType: 'heats', heatBy: 'time', resultBy: 'points' }).resultByTime === 'points' && RL.scoring({ sessionType: 'heats', heatBy: 'time' }).resultByTime === 'laps');
  ok('...a value that is no choice is the old way: what it counted by', RL.scoring({ sessionType: 'heats', heatBy: 'time', resultByTime: 'rubbish', resultBy: 'points' }).resultByTime === 'points' && RL.scoring({ sessionType: 'heats', heatBy: 'time', resultByTime: 'rubbish', resultBy: 'points' }).resultBy === 'points'
    && RL.scoring({ sessionType: 'heats', heatBy: 'time', resultByTime: 'rubbish' }).resultByTime === 'laps' && RL.scoring({ sessionType: 'heats', heatBy: 'time', resultByTime: 'rubbish' }).resultBy === 'laps');
  const keep = { sessionType: 'heats', heatBy: 'laps', resultBy: 'time' };
  ok('...any other setup is given back as it is', RL.scoring(keep) === keep && RL.scoring(null) === null && RL.scoring(undefined) === undefined); }
{ const raw = { sessionType: 'endurance', enduranceBy: 'heats', heatBy: 'time', resultByTime: 'points', resultBy: 'laps' }, e = En.effective(raw);
  ok('the setup as the race screen and Home work with it: heats of a time, also those of an Endurance Race, and not the others', e.sessionType === 'heats' && e.ofType === 'endurance' && e.resultBy === 'points'
    && En.effective({ sessionType: 'heats', heatBy: 'time', resultByTime: 'points', resultBy: 'laps' }).resultBy === 'points' && En.effective({ sessionType: 'heats', heatBy: 'time', resultByTime: 'lapstime', resultBy: 'points' }).resultBy === 'laps'
    && En.effective({ sessionType: 'heats', heatBy: 'laps', resultBy: 'time' }).resultBy === 'time' && En.effective({ sessionType: 'race', raceBy: 'time', resultBy: 'points' }).resultBy === 'points'); }

// ---- the settings of the engine ----
{ const sc = E.scoringOf({ heatBy: 'time', resultByTime: 'lapstime', resultBy: 'laps' }), sd = E.scoringOf({ heatBy: 'time', resultByTime: 'lapstime', resultBy: 'laps', compareBy: 'distance' });
  ok('the engine counts laps first for heats of a time with that choice (by distance when the cars are compared by distance), and not otherwise', sc.lapsFirst === true && sc.byDistance === false && sd.lapsFirst === true && sd.byDistance === true && sc.byTime === false
    && E.scoringOf({ heatBy: 'time', resultByTime: 'laps' }).lapsFirst === false && E.scoringOf({ heatBy: 'time', resultByTime: 'points' }).lapsFirst === false && E.scoringOf({ heatBy: 'laps', resultByTime: 'lapstime' }).lapsFirst === false
    && E.scoringOf({ heatBy: 'distance', resultByTime: 'lapstime', compareBy: 'distance' }).byDistance === false && E.scoringOf({}).lapsFirst === false && E.scoringOf(undefined).byDistance === false
    && E.scoringOf({ heatBy: 'time', resultByTime: 'lapstime', resultBy: 'points' }).lapsFirst === false);
  ok('...points never count by metres or laps first, and the distance only counts when the cars are compared by distance', E.scoringOf({ heatBy: 'time', resultByTime: 'lapstime', resultBy: 'points', compareBy: 'distance' }).byDistance === false
    && E.scoringOf({ heatBy: 'time', resultByTime: 'lapstime', resultBy: 'laps', compareBy: 'laps' }).byDistance === false && E.scoringOf({ heatBy: 'time', resultByTime: 'lapstime', resultBy: 'laps' }).byDistance === false && E.scoringOf({ heatBy: 'time', resultByTime: 'lapstime', resultBy: 'laps', compareBy: 'distance' }).byDistance === true);
  ok('...a settled answer is kept (the heat race is made from the answer of the setup)', E.scoringOf({ ...sd }).lapsFirst === true && E.scoringOf(E.scoringOf({ heatBy: 'time', resultByTime: 'lapstime', compareBy: 'distance' })).byDistance === true && E.scoringOf({ lapsFirst: false, heatBy: 'time', resultByTime: 'lapstime' }).lapsFirst === false
    && E.scoringOf({ lapsFirst: true }).lapsFirst === true && E.scoringOf({ lapsFirst: true, byDistance: false, heatBy: 'time', resultByTime: 'lapstime', compareBy: 'distance' }).byDistance === false); }

// ---- the heats ----
const people = [0, 1, 2].map(i => ({ driverId: 'd' + i, carId: 'c' + i, driverName: ['Alex', 'Sam', 'Kim'][i], nickname: '', carName: 'car' }));
const cmp = lens => ({ by: 'distance', lanes: lens.map((length, lane) => ({ lane, length })) });
const sched3 = [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }], [{ p: 2, lane: 0 }, { p: 1, lane: 1 }], [{ p: 2, lane: 0 }, { p: 0, lane: 1 }]];
const settings = (over = {}) => ({ heatBy: 'time', resultByTime: 'lapstime', resultBy: 'laps', ...over });
const heatRace = (over = {}, sched = sched3, extra = {}) => E.createHeatRace({ participants: people, schedule: sched, points: [], lanes: 2, finals: 'none', ...E.scoringOf(settings(over)), resultBy: over.resultBy || 'laps', ...E.finalsOf(over), ...extra });
const runHeat = (H, laps, compare) => { // laps: per entry (in the order of H.entries()) the times of the crossings
  const q = E.createRace({ type: 'timed', duration: 1, entries: H.entries().map(e => ({ ...e })), compare }); q.start(0);
  laps.forEach((times, i) => times.forEach(t => q.cross(i, t))); return H.record(q); };
const ev = n => Array.from({ length: n }, (_, i) => (i + 1) * 5000); // n laps of 5.0 s
const names = H => H.overall().map(o => o.driverName).join();
// Alex: heat 1 on lane 1 (10 m): 5 laps in 25.0 s with one fast lap (4.0 s); heat 3 on lane 2 (12 m): 4 laps in 21.0 s.  Sam: heat 1 on lane 2: 5 laps in 24.0 s; heat 2 on lane 2: 4 laps in 20.0 s.  Kim: heat 2 on lane 1: 6 laps; heat 3 on lane 1: 5 laps
const play = (over = {}, compare = null, extra = {}) => { const H = heatRace(over, sched3, extra);
  runHeat(H, [[4000, 9000, 14000, 19000, 25000], [4800, 9600, 14400, 19200, 24000]], compare);
  runHeat(H, [[5000, 10000, 15000, 20000, 25000, 30000], [5000, 10000, 15000, 20000]], compare);
  runHeat(H, [[5000, 10000, 15000, 20000, 24500], [5250, 10500, 15750, 21000]], compare);
  return H; };
{ const H = play();
  const o = H.overall();
  ok('heats of a time, the most laps then the lowest total time: Kim has 11 laps, Alex and Sam both 9, and Sam is faster (44.0 s against 46.0 s), although Alex has the best lap', names(H) === 'Kim,Sam,Alex' && o.map(x => x.laps).join() === '11,9,9' && o[1].best > o[2].best);
  ok('...the result is the laps (Kim 11, Sam 9, Alex 9) and the total time of the heats, in milliseconds', o.map(x => x.score).join() === '11,9,9' && o[1].timeAll === 44000 && o[2].timeAll === 46000 && o[0].timeAll === 54500 && o.every(x => x.measure === undefined));
  ok('...it is the same whatever the tie-break setting is (the time comes before the tie-break)', ['default', 'bestlap', 'wins', 'time'].every(t => names(play({ tieBreak: t })) === 'Kim,Sam,Alex')); }
{ const H = play({ resultByTime: 'laps' });
  ok('total laps (as it was): the same laps are decided by the tie-break setting, here the best lap, so Alex is ahead of Sam', names(H) === 'Kim,Alex,Sam' && H.overall().every(x => x.timeAll === undefined && x.measure === undefined));
  ok('...or by the lowest total time when the tie-break says so', names(play({ resultByTime: 'laps', tieBreak: 'time' })) === 'Kim,Sam,Alex');
  ok('...and a setup that never knew the choice counts as total laps', names(heatRace({ resultByTime: undefined })) !== undefined && names(play({ resultByTime: undefined })) === 'Kim,Alex,Sam'); }
{ const H = play({ resultByTime: 'points', resultBy: 'points' }, null, { points: [10, 8, 6] });
  ok('points are points: the heat positions score, and nothing is counted by laps first', E.scoringOf(settings({ resultByTime: 'points', resultBy: 'points' })).lapsFirst === false && H.overall().every(x => x.timeAll === undefined) && H.overall().reduce((n, x) => n + x.points, 0) === 6 * 3 + 8 * 3 + 6 * 0 - 8 * 0 + 0 || H.overall().reduce((n, x) => n + x.points, 0) > 0); }

// the distance: lane 1 is 10 m, lane 2 is 12 m
const lanes = cmp([10, 12]);
{ // Alex: heat 1 lane 1: 7 laps (70 m), heat 3 lane 2: 4 laps (48 m) = 11 laps, 118 m.  Sam: heat 1 lane 2: 5 laps (60 m), heat 2 lane 2: 5 laps (60 m) = 10 laps, 120 m.  Kim: heat 2 lane 1: 4 laps (40 m), heat 3 lane 1: 4 laps (40 m) = 8 laps, 80 m
  const run = (over, compare) => { const H = heatRace(over);
    runHeat(H, [ev(7), ev(5)], compare); runHeat(H, [ev(4), ev(5)], compare); runHeat(H, [ev(4), ev(4)], compare); return H; };
  const L = run({}, null), D = run({ compareBy: 'distance' }, lanes), W = run({ compareBy: 'laps' }, null), V = run({ compareBy: 'laps' }, lanes);
  ok('counted by laps: Alex has 11 laps and is ahead of Sam (10 laps), although Sam drove further', names(L) === 'Alex,Sam,Kim' && L.overall().map(x => x.score).join() === '11,10,8');
  ok('counted by distance (the cars are compared by distance): Sam drove 120 m against 118 m for Alex, so Sam is ahead, and the result is the metres', names(D) === 'Sam,Alex,Kim' && D.overall().map(x => x.score).join() === '120,118,80' && D.overall().every(x => x.measure === 'distance') && D.overall().map(x => x.laps).join() === '10,11,8');
  ok('...when the cars are compared by laps the heats hold no metres, and the laps count (also when the heats do hold them, the setting decides)', names(W) === 'Alex,Sam,Kim' && W.overall().every(x => x.measure === undefined) && W.results.every(h => h.rows.every(r => !('dist' in r)))
    && names(V) === 'Alex,Sam,Kim' && V.overall().every(x => x.measure === undefined) && V.results.every(h => h.rows.every(r => Number.isFinite(r.dist))));
  ok('...when only some of the heats hold the metres the laps count (a missing length never counts as 0 m)', (() => { const H = heatRace({ compareBy: 'distance' }); runHeat(H, [ev(7), ev(5)], lanes); runHeat(H, [ev(4), ev(5)], null); runHeat(H, [ev(4), ev(4)], lanes); return names(H) === 'Alex,Sam,Kim' && H.overall().every(x => x.measure === undefined); })());
  ok('...the same distance is decided by the lowest total time', (() => { const H = heatRace({ compareBy: 'distance' }, [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }]]);
    const q = E.createRace({ type: 'timed', duration: 1, entries: H.entries().map(e => ({ ...e })), compare: lanes }); q.start(0); const at = []; for (let n = 1; n <= 12; n++) at.push([n * 5000, 0]); for (let n = 1; n <= 10; n++) at.push([n * 5500, 1]); at.sort((x, y) => x[0] - y[0]).forEach(([t, i]) => q.cross(i, t)); H.record(q);
    return names(H) === 'Sam,Alex,Kim' && H.overall().map(x => x.score).join() === '120,120,0'; })());
  ok('...the time is the total time of the heats that count (Sam 25.0 s + 25.0 s, Alex 35.0 s + 20.0 s)', D.overall().find(x => x.driverName === 'Sam').timeAll === 50000 && D.overall().find(x => x.driverName === 'Alex').timeAll === 55000); }

// ---- the heats that count ----
{ // a worse heat is the one with fewer laps (and with the same laps the slower one); average and best heats work with laps first, then time
  const run = over => { const H = heatRace(over, [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }], [{ p: 0, lane: 0 }, { p: 1, lane: 1 }], [{ p: 0, lane: 0 }, { p: 1, lane: 1 }]]);
    runHeat(H, [ev(6), ev(5)]); runHeat(H, [ev(2), ev(5)]); runHeat(H, [ev(6).map(t => t + 100), ev(5)]); return H; };
  const drop = run({ dropWorst: 'yes' }), best = run({ countBy: 'best', bestHeats: 1 }), avg = run({ countBy: 'average' });
  const alex = H => H.overall().find(x => x.driverName === 'Alex'), sam = H => H.overall().find(x => x.driverName === 'Sam');
  ok('the worst heat is dropped (Alex: the heat with 2 laps), and with two equal heats the slower one is the worse: the time of Alex is that of the 6 laps of heat 1 and 3, 61 s less the dropped one', alex(drop).score === 12 && alex(drop).counted === 2 && alex(drop).dropped.join() === '2' && alex(drop).timeAll === 30000 + 30100);
  ok('...only the best heat counts: Alex has 6 laps in 30.0 s (heat 1)', alex(best).score === 6 && alex(best).counted === 1 && alex(best).timeAll === 30000 && alex(best).dropped.join() === '2,3');
  ok('...the average per heat: laps and time are averages (Alex: 14 laps in 3 heats, 70.1 s)', Math.abs(alex(avg).score - 14 / 3) < 1e-9 && Math.abs(alex(avg).timeAll - (30000 + 10000 + 30100) / 3) < 1e-6);
  ok('...and the order follows: Alex 12 laps against Sam 10 laps when the worst heat is dropped', names(drop).startsWith('Alex,Sam') && sam(drop).score === 10); }

// ---- a final that is added ----
{ const H = E.createHeatRace({ participants: people, schedule: sched3, points: [], lanes: 2, ...E.scoringOf(settings({ compareBy: 'distance' })), resultBy: 'laps', ...E.finalsOf({ finals: 'a', finalMode: 'added' }) });
  runHeat(H, [ev(7), ev(5)], lanes); runHeat(H, [ev(4), ev(5)], lanes); runHeat(H, [ev(4), ev(4)], lanes);
  const fin = H.entries().map(e => e.participant);
  ok('the final A is raced by the two best of the heats (Sam and Alex)', fin.length === 2 && fin.includes(0) && fin.includes(1));
  runHeat(H, fin.map((p, i) => (p === 0 ? ev(2) : ev(6))), lanes);
  const o = H.overall(), alex = o.find(x => x.driverName === 'Alex'), sam = o.find(x => x.driverName === 'Sam');
  ok('the result of a final that is added comes on top of the heats, in metres: the heats and the final of Sam and Alex', alex.measure === 'distance' && Number.isFinite(alex.finalDist) && sam.finalDist !== alex.finalDist && Math.abs(alex.score - (118 + alex.finalDist)) < 1e-9 && Math.abs(sam.score - (120 + sam.finalDist)) < 1e-9 && alex.heatScore === 118);
  ok('...and the final decides between the heats: the heat result is 118 + the metres of the final', o.length === 3 && o.filter(x => x.finalName === 'A').length === 2); }

// the heat that is dropped is the worst one in the measure that counts: Alex has 7 laps (70 m), 6 laps (72 m) and 10 laps (100 m); by laps heat 2 is the worst, by distance heat 1
{ const sched = [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }], [{ p: 0, lane: 1 }, { p: 1, lane: 0 }], [{ p: 0, lane: 0 }, { p: 1, lane: 1 }]];
  const run = (over, compare) => { const H = E.createHeatRace({ participants: people, schedule: sched, points: [], lanes: 2, finals: 'none', ...E.scoringOf(settings({ dropWorst: 'yes', ...over })), resultBy: 'laps' });
    runHeat(H, [ev(7), ev(5)], compare); runHeat(H, [ev(6), ev(4)], compare); runHeat(H, [ev(10), ev(5)], compare); return H; };
  const L = run({}, null).overall().find(x => x.driverName === 'Alex'), D = run({ compareBy: 'distance' }, lanes).overall().find(x => x.driverName === 'Alex');
  ok('the worst heat is the worst in the measure that counts: by laps the heat of 6 laps (72 m) is dropped, by distance the heat of 7 laps (70 m)', L.dropped.join() === '2' && L.score === 17 && D.dropped.join() === '1' && D.score === 172 && D.measure === 'distance'); }
// points govern, whatever else is asked for (also when the engine is given laps first and points together)
{ const H = E.createHeatRace({ participants: people, schedule: sched3, points: [10, 8, 6], lanes: 2, finals: 'none', heatBy: 'time', lapsFirst: true, byDistance: true, resultBy: 'points' });
  runHeat(H, [ev(7), ev(5)], lanes); runHeat(H, [ev(4), ev(5)], lanes); runHeat(H, [ev(4), ev(4)], lanes);
  const o = H.overall();
  ok('laps first and points together: the points count, the result is points (not metres or laps) and there is no total time', o.length === 3 && o.every(x => x.timeAll === undefined && x.measure === undefined) && o.reduce((n, x) => n + x.score, 0) === 10 + 8 + 10 + 8 + 10 + 8 && o[0].score >= o[1].score && o[1].score >= o[2].score); }
{ const o = heatRace({ compareBy: 'distance' }).overall();
  ok('before the first heat is raced nobody has metres yet, and the time is not known', o.length === 3 && o.every(x => x.measure === undefined && x.score === 0 && x.timeAll === null)); }

// the corners: a missing time, missing metres, a final that is not added, a worse heat that is faster
{ const mk = () => { const H = heatRace({ compareBy: 'distance' }); runHeat(H, [ev(7), ev(5)], lanes); runHeat(H, [ev(4), ev(5)], lanes); runHeat(H, [ev(4), ev(4)], lanes); return H; };
  const a = mk(); a.results[0].rows.find(r => r.participant === 0).total = null; const oa = a.overall().find(x => x.driverName === 'Alex');
  ok('a heat without a time makes the total time of the driver unknown (null), the distance still counts, and the Result column leaves the time out', oa.timeAll === null && oa.score === 118 && Ht.scoreText(oa, E.scoringOf(settings({ compareBy: 'distance' })), { unit: 'm' }) === '118.0 m');
  const b = mk(); delete b.results[1].rows[0].dist; const ob = b.overall();
  ok('...when one driver of one heat has no metres, no heat counts the metres: the laps count (Alex 11, Sam 10, Kim 8)', ob.every(x => x.measure === undefined) && ob.map(x => x.score).join() === '11,10,8');
  const c = mk().overall();
  ok('...with the metres the result is in metres and the time is the total of the heats (Alex 35.0 s + 20.0 s)', c.every(x => x.measure === 'distance') && c.find(x => x.driverName === 'Alex').timeAll === 55000); }
{ const H = E.createHeatRace({ participants: people, schedule: sched3, points: [], lanes: 2, ...E.scoringOf(settings({ compareBy: 'distance' })), resultBy: 'laps', ...E.finalsOf({ finals: 'a', finalMode: 'places' }) });
  runHeat(H, [ev(7), ev(5)], lanes); runHeat(H, [ev(4), ev(5)], lanes); runHeat(H, [ev(4), ev(4)], lanes);
  const fin = H.entries().map(e => e.participant); runHeat(H, fin.map(p => (p === 0 ? ev(2) : ev(6))), lanes);
  const o = H.overall();
  ok('a final that decides the places does not add its metres: the finalists keep the metres of the heats (Sam 120 m, Alex 118 m), and the final decides the order', o.map(x => x.driverName + ':' + x.score + ':' + x.finalName).join() === 'Sam:120:A,Alex:118:A,Kim:80:null'); }
{ const sched = [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }], [{ p: 0, lane: 0 }, { p: 1, lane: 1 }], [{ p: 0, lane: 0 }, { p: 1, lane: 1 }]];
  const H = E.createHeatRace({ participants: people, schedule: sched, points: [], lanes: 2, finals: 'none', ...E.scoringOf(settings({ countBy: 'best', bestHeats: 1 })), resultBy: 'laps' });
  runHeat(H, [ev(6).map(t => t + 100), ev(5)]); runHeat(H, [ev(2), ev(5)]); runHeat(H, [ev(6), ev(5)]);
  const alex = H.overall().find(x => x.driverName === 'Alex');
  ok('with the same laps the faster heat is the better one, also when it was raced later: only the best heat counts, and it is heat 3 (30.0 s) and not heat 1 (30.1 s)', alex.score === 6 && alex.timeAll === 30000 && alex.dropped.join() === '1,2'); }
{ const lapsHeat = E.createHeatRace({ participants: people, schedule: sched3, points: [], lanes: 2, finals: 'none', heatBy: 'laps', lapsFirst: true, resultBy: 'time' });
  const q = H => { const e = E.createRace({ type: 'race', laps: 3, endRule: 'all', entries: H.entries().map(x => ({ ...x })) }); e.start(0); return e; };
  [[[5000, 10000, 15000], [4000, 8000, 12000]], [[5000, 10000, 15000], [6000, 12000, 18000]], [[3000, 6000, 9000], [4000, 8000, 12000]]].forEach(times => { const e = q(lapsHeat); times.forEach((t, i) => t.forEach(x => e.cross(i, x))); lapsHeat.record(e); });
  const o = lapsHeat.overall();
  ok('a result by total time is no result by laps first, whatever else is asked for: the total time rules and nothing is said of laps and time', o.every(x => x.timeAll === undefined && x.measure === undefined && x.timeScore !== undefined) && o[0].driverName === 'Kim'); }

// ---- laps or a distance in the heats: time first, as before ----
{ const lapsHeat = over => E.createHeatRace({ participants: people, schedule: sched3, points: [], lanes: 2, finals: 'none', ...E.scoringOf({ heatBy: 'laps', resultBy: 'time', ...over }), resultBy: 'time' });
  const q = H => { const e = E.createRace({ type: 'race', laps: 3, endRule: 'all', entries: H.entries().map(x => ({ ...x })) }); e.start(0); return e; };
  const H = lapsHeat({});
  [[[5000, 10000, 15000], [4000, 8000, 12000]], [[5000, 10000, 15000], [6000, 12000, 18000]], [[3000, 6000, 9000], [4000, 8000, 12000]]].forEach(times => { const e = q(H); times.forEach((t, i) => t.forEach(x => e.cross(i, x))); H.record(e); });
  ok('heats of laps count the lowest total time first, as before (Kim 9.0 s + 12.0 s, Sam 12.0 + 18.0 s, Alex 15.0 + 12.0 s)', E.scoringOf({ heatBy: 'laps', resultBy: 'time' }).byTime === true && E.scoringOf({ heatBy: 'laps', resultBy: 'time' }).lapsFirst === false && H.scoring.byTime === true && H.overall().map(o => o.driverName).join() === 'Kim,Alex,Sam' && H.overall().every(o => o.timeAll === undefined));
  ok('...and the same setting in heats of a time is no result by time (everybody drives the same time): the laps count', E.scoringOf({ heatBy: 'time', resultBy: 'time' }).byTime === false); }

// ---- the words ----
{ const lapsText = Ht.scoringText(E.scoringOf(settings()), false), distText = Ht.scoringText(E.scoringOf(settings({ compareBy: 'distance' })), false);
  ok('Home and the race screen say how the heats of a time are counted: the most laps, with the same laps the lowest total time', /the most laps wins; with the same laps the lowest total time wins/.test(lapsText) && /^Overall result: /.test(lapsText));
  ok('...or the furthest distance', /the furthest total distance wins; with the same distance the lowest total time wins/.test(distText));
  ok('...nothing for the standard count (total laps) and not for points', Ht.scoringText(E.scoringOf(settings({ resultByTime: 'laps' })), false) === '' && !/most laps/.test(Ht.scoringText(E.scoringOf(settings()), true)) && Ht.scoringText(E.scoringOf({ heatBy: 'laps', resultBy: 'time' }), false).includes('the lowest total race time wins'));
  const o = play().overall(), d = play({ compareBy: 'distance' }, lanes).overall();
  ok('the Result column says the laps and the total time (Kim 11 laps · 54.500)', Ht.scoreText(o[0], E.scoringOf(settings()), {}) === '11 laps · ' + E.fmtTime(54500) && Ht.scoreText(o[1], E.scoringOf(settings()), {}) === '9 laps · ' + E.fmtTime(44000));
  ok('...or the distance in the unit of the app (metres or feet), with one decimal', /^\d+(\.\d)? m · /.test(Ht.scoreText(d[0], E.scoringOf(settings({ compareBy: 'distance' })), { unit: 'm' })) && / ft · /.test(Ht.scoreText(d[0], E.scoringOf(settings({ compareBy: 'distance' })), { unit: 'ft' })));
  ok('...a heat that counts fewer than all says so, and total laps (the old way) shows the number only', Ht.scoreText({ ...o[0], counted: 2, heats: 3 }, E.scoringOf(settings()), {}).includes('(2 of 3 heats)') && Ht.scoreText({ score: 9, counted: 3, heats: 3 }, E.scoringOf(settings({ resultByTime: 'laps' })), {}) === '9');
  const dsc = E.scoringOf(settings({ compareBy: 'distance' })), drow = { score: 30, counted: 1, heats: 1, measure: 'distance', timeAll: 3026 };
  ok('the distance is written with one decimal in the unit of the app (30.0 m, 98.4 ft)', Ht.scoreText(drow, dsc, { unit: 'm' }) === '30.0 m · ' + E.fmtTime(3026) && Ht.scoreText(drow, dsc, { unit: 'ft' }) === '98.4 ft · ' + E.fmtTime(3026));
  ok('...a result that has no total time (a standing of before, or a heat without a time) says the number only, and the laps and time are only said when the heats count that way', Ht.scoreText({ score: 9, counted: 3, heats: 3 }, E.scoringOf(settings()), {}) === '9' && Ht.scoreText({ score: 9, counted: 3, heats: 3, timeAll: null }, E.scoringOf(settings()), {}) === '9 laps'
    && Ht.scoreText({ score: 9, counted: 3, heats: 3, timeAll: 44000 }, E.scoringOf(settings({ resultByTime: 'laps' })), {}) === '9');
  const sm = Ht.summary({ stats: Ht.stats(sched3, 3, 2), setup: { heatBy: 'time', duration: 4, resultByTime: 'lapstime', resultBy: 'laps' }, names: ['A', 'B', 'C'] });
  ok('the plan on Home says it too', sm.some(l => /the most laps wins; with the same laps the lowest total time wins/.test(l))); }

// ---- the form ----
const F = schema.racesetups, field = k => F.fields.find(f => f.key === k);
const shown = (f, vals) => !f.showIf || f.showIf.some(c => Object.entries(c).every(([k, vs]) => vs.includes(vals[k] ?? '')));
const keys = vals => F.fields.filter(f => shown(f, vals)).map(f => f.key);
{ const rt = field('resultByTime'), rb = field('resultBy');
  ok('heats of a time have their own choice: most laps (or the furthest distance), then the lowest total time first (the standard), total laps, points', !!rt && rt.type === 'select' && rt.default === 'lapstime' && rt.options.map(o => o[0]).join() === 'lapstime,laps,points' && rt.group === 'length' && /then total time/.test(rt.options[0][1]) && /with equal laps, the lowest total time/.test(rt.options[0][2]) && rt.ui === 'cards' && rt.offer.join() === 'points,lapstime,laps'); // (1.70.0: cards, with the longer words in a line under the name)
  ok('...it is shown for heats of a time, also those of an Endurance Race, and for no other race', shown(rt, { sessionType: 'heats', heatBy: 'time' }) && shown(rt, { sessionType: 'endurance', enduranceBy: 'heats', heatBy: 'time' }) && !shown(rt, { sessionType: 'heats', heatBy: 'laps' }) && !shown(rt, { sessionType: 'heats', heatBy: 'distance' })
    && !shown(rt, { sessionType: 'race', raceBy: 'time' }) && !shown(rt, { sessionType: 'practice' }) && !shown(rt, { sessionType: 'endurance', enduranceBy: 'time' }));
  ok('heats of laps or a distance keep their own: total time then laps, points, and total laps for the setups that have it; and they do not get the choice of a time', shown(rb, { sessionType: 'heats', heatBy: 'laps' }) && shown(rb, { sessionType: 'heats', heatBy: 'distance' }) && shown(rb, { sessionType: 'heats' })
    && shown(rb, { sessionType: 'endurance', enduranceBy: 'heats', heatBy: 'laps' }) && !shown(rb, { sessionType: 'heats', heatBy: 'time' }) && !shown(rb, { sessionType: 'race', raceBy: 'laps' }) && rb.options.map(o => o[0]).join() === 'laps,points,time' && rb.default === 'laps');
  ok('...its words: the lowest total time (1.69.0: it was "Total time, then laps"), and the hint says that a heat that is not finished ranks below the finished ones, by laps', /^Lowest total time/.test(rb.options.find(o => o[0] === 'time')[1]) && /Lowest total time/.test(rb.hint) && /by laps/.test(rb.hint) && !/heats limited by laps or distance/.test(rb.options.find(o => o[0] === 'time')[1]));
  ok('Points stay everywhere: the points per position and the fastest lap bonus show in heats of a time when they count points, in heats of laps or a distance when they count points, and for no other choice',
    ['points', 'fastestBonus'].every(k => shown(field(k), { sessionType: 'heats', heatBy: 'time', resultByTime: 'points' }) && shown(field(k), { sessionType: 'heats', heatBy: 'laps', resultBy: 'points' }) && shown(field(k), { sessionType: 'heats', heatBy: 'distance', resultBy: 'points' })
      && shown(field(k), { sessionType: 'endurance', enduranceBy: 'heats', heatBy: 'time', resultByTime: 'points' }) && shown(field(k), { sessionType: 'heats', resultBy: 'points' }) && !shown(field(k), { sessionType: 'heats', heatBy: 'time', resultByTime: 'lapstime', resultBy: 'points' })
      && !shown(field(k), { sessionType: 'heats', heatBy: 'time', resultByTime: 'laps' }) && !shown(field(k), { sessionType: 'heats', heatBy: 'laps', resultBy: 'time' }) && !shown(field(k), { sessionType: 'heats', heatBy: 'laps', resultBy: 'laps' }) && !shown(field(k), { sessionType: 'race' })));
  ok('the choice that matches the limit is the only one in the form: heats of a time show "Overall result counted by" once (the new one), heats of laps show it once (the old one)', keys({ sessionType: 'heats', heatBy: 'time' }).filter(k => /^resultBy/.test(k)).join() === 'resultByTime' && keys({ sessionType: 'heats', heatBy: 'laps' }).filter(k => /^resultBy/.test(k)).join() === 'resultBy'
    && keys({ sessionType: 'race', raceBy: 'time' }).filter(k => /^resultBy/.test(k)).length === 0);
  ok('...a heat of laps that is counted by time asks what to do with a heat that is not finished, a heat of a time never does', keys({ sessionType: 'heats', heatBy: 'laps', resultBy: 'time' }).includes('unfinished') && !keys({ sessionType: 'heats', heatBy: 'time', resultByTime: 'lapstime' }).includes('unfinished') && !keys({ sessionType: 'heats', heatBy: 'laps', resultBy: 'laps' }).includes('unfinished'));
  ok('...the hint of the new choice says how it counts (laps, the lowest total time, the furthest distance, points)', /most laps/.test(rt.hint) && /lowest total time/.test(rt.hint) && /distance/.test(rt.hint) && /points/i.test(rt.hint)); }

// ---- old data ----
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hs-'));
{ const f = path.join(tmpDir, 'old.json');
  fs.writeFileSync(f, JSON.stringify({ version: '1.64.0', racesetups: [{ id: 'a', name: 'Points night', sessionType: 'heats', heatBy: 'time', duration: 3, resultBy: 'points' }, { id: 'b', name: 'Laps night', sessionType: 'heats', heatBy: 'time', duration: 3, resultBy: 'laps' },
    { id: 'c', name: 'Lap heats', sessionType: 'heats', heatBy: 'laps', laps: 5, resultBy: 'time' }, { id: 'd', name: 'Race', sessionType: 'race', raceBy: 'laps', laps: 10 }, { id: 'e', name: 'Endu', sessionType: 'endurance', enduranceBy: 'heats', heatBy: 'time', resultBy: 'points' }] }));
  const d = new Database(f), by = id => d.data.racesetups.find(r => r.id === id);
  ok('a database from before 1.65.0: heats of a time keep what they counted by (points, or total laps)', by('a').resultByTime === 'points' && by('b').resultByTime === 'laps' && by('e').resultByTime === 'points');
  ok('...the other setups are the same as they were (no new choice)', !('resultByTime' in by('c')) && by('c').resultBy === 'time' && !('resultByTime' in by('d')) && by('a').resultBy === 'points');
  d.add('racesetups', { name: 'New', sessionType: 'heats', heatBy: 'time', resultByTime: 'lapstime' }); d.saveNow();
  const d2 = new Database(f);
  ok('...saved and read again nothing changes, and a choice that was made stays', d2.data.racesetups.find(r => r.id === 'a').resultByTime === 'points' && d2.data.racesetups.find(r => r.name === 'New').resultByTime === 'lapstime'); }
{ // an export file of an older version
  const mk = () => new Database(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'hs-')), 'db.json')), a = mk(), b = mk();
  const s1 = a.add('racesetups', { name: 'Old points', sessionType: 'heats', heatBy: 'time', resultBy: 'points' }), s2 = a.add('racesetups', { name: 'Fresh', sessionType: 'heats', heatBy: 'time', resultByTime: 'lapstime', resultBy: 'laps' }), s3 = a.add('racesetups', { name: 'Race', sessionType: 'race', raceBy: 'laps', laps: 5 });
  const bundle = T.collect(a.data, { racesetups: [s1.id, s2.id, s3.id] }, false); delete bundle.items.racesetups.find(r => r.name === 'Old points').resultByTime;
  T.apply(b, bundle);
  const g = n => b.data.racesetups.find(r => r.name === n);
  ok('an export file of an older version: heats of a time come in with what they counted by, a file that has the choice keeps it, other setups get nothing', g('Old points').resultByTime === 'points' && g('Fresh').resultByTime === 'lapstime' && !('resultByTime' in g('Race'))); }
fs.rmSync(tmpDir, { recursive: true, force: true });

console.log(fails ? `${fails} HEAT SCORING TESTS FAILED` : 'ALL HEAT SCORING TESTS PASSED'); process.exit(fails ? 1 : 0);
