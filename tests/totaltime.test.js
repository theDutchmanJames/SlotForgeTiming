// 1.63.0: the Total Time widget (how long a driver has been racing, in this race or heat and over the heats, with or without penalties) and "Total time" in the Order by of a leaderboard.
const E = require('../renderer/engine.js'), T = require('../renderer/timing.js'), Wd = require('../renderer/widgets.js'), Bo = require('../renderer/boardorder.js');
let fails = 0; const ok = (m, c) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };

const names = ['Alex', 'Sam', 'Kim'];
const people = [0, 1, 2].map(i => ({ driverId: 'd' + i, carId: 'c' + i, driverName: names[i], nickname: '', flag: '', avatar: '', carName: 'car' + i }));
const entries = (list = [0, 1, 2]) => list.map((p, lane) => ({ ...people[p], lane, participant: p }));
const race = (o = {}) => { const r = E.createRace({ type: 'race', laps: 2, endRule: 'all', entries: entries(), ...o }); r.start(0); return r; };

// ---- the engine: the time a car has been racing ----
{ const r = race();
  ok('before the start nothing has been raced', (() => { const q = E.createRace({ type: 'race', laps: 2, endRule: 'all', entries: entries() }); return q.spentOf(q.cars[0], 5000, false) === 0 && q.spentOf(q.cars[0], 5000, true) === 0; })());
  ok('a car that is racing has been racing as long as the race clock says, and it counts up', r.spentOf(r.cars[0], 4000, false) === 4000 && r.spentOf(r.cars[0], 9500, false) === 9500);
  r.cross(0, 5000); r.cross(0, 11000); r.cross(1, 6000); r.cross(1, 13000); r.cross(2, 7000);
  ok('a car that has finished its laps stops counting: the time of its last crossing, whatever the clock says now', r.cars[0].done && r.spentOf(r.cars[0], 11001, false) === 11000 && r.spentOf(r.cars[0], 99999, false) === 11000 && r.spentOf(r.cars[1], 99999, false) === 13000);
  ok('...a car that has not finished keeps counting', !r.cars[2].done && r.spentOf(r.cars[2], 20000, false) === 20000);
  ok('without penalties and with them are the same while there is nothing to add', r.spentOf(r.cars[0], 20000, true) === 11000 && r.spentOf(r.cars[2], 20000, true) === 20000);
  r.addTime(0, 3000); r.adjust(1, { ms: -1000 });
  ok('time added by the Race Director counts with penalties (14 s for 11 s and 3 s), and not without', r.spentOf(r.cars[0], 20000, true) === 14000 && r.spentOf(r.cars[0], 20000, false) === 11000);
  ok('...so does a correction of the review, taken off (13 s less 1 s), and the time on the clock stays', r.spentOf(r.cars[1], 20000, true) === 12000 && r.spentOf(r.cars[1], 20000, false) === 13000);
  ok('...a car that is still racing has its penalty on top of the clock', (r.addTime(2, 2000), r.spentOf(r.cars[2], 20000, true) === 22000 && r.spentOf(r.cars[2], 20000, false) === 20000));
  r.pause(15000);
  ok('a paused race does not count the pause: the car that is racing has the time of the moment it stopped', r.spentOf(r.cars[2], 99000, false) === 15000);
  r.resume(25000);
  ok('...and goes on from there when the race goes on (10 s of pause are not racing time)', r.spentOf(r.cars[2], 30000, false) === 20000);
  r.stop(36000);
  ok('a car that is still racing when the race is stopped has the time the race lasted (26 s: the pause is not in it), and does not count on', r.cars[2].spentFixed === undefined && r.spentOf(r.cars[2], 36000, false) === 26000 && r.spentOf(r.cars[2], 90000, false) === 26000);
  ok('...a car that had finished keeps its own time', r.spentOf(r.cars[0], 90000, false) === 11000);
}
{ const r = race();
  r.cross(1, 5000); r.setDq(1, true);
  ok('a car that is disqualified keeps the time of its last crossing (5 s), whatever the clock says', r.cars[1].done && r.cars[1].dq && r.spentOf(r.cars[1], 20000, false) === 5000 && r.spentOf(r.cars[1], 90000, false) === 5000);
  ok('...and when it is let back in it counts on with the race clock', (r.setDq(1, false), !r.cars[1].done && r.spentOf(r.cars[1], 20000, false) === 20000));
  r.cars[0].done = true; r.cars[0].retired = true; r.cars[0].total = 7000;
  ok('...a car that retired (out of fuel...) keeps the time of its last crossing too', r.spentOf(r.cars[0], 30000, false) === 7000);
}
{ const r = race({ endRule: 'leader' }); // the lead car finishes: the race is over for the others, who are 1 lap down
  r.cross(0, 4000); r.cross(0, 9000); r.cross(1, 5000);
  ok('the race is over when the lead car finishes: the car that is a lap down has the time the race lasted, and the leader his own time', r.status === 'finished' && r.spentOf(r.cars[0], 50000, false) === 9000 && r.spentOf(r.cars[1], 50000, false) === 9000 && r.spentOf(r.cars[1], 5000, false) === 9000);
}
{ const r = race({ type: 'timed', duration: 0.1 }); // a timed race (6 s): after the time is up a car finishes on its next crossing, and that is where its clock stops
  r.cross(0, 3000); r.cross(1, 4000); r.tick && r.tick(6500); r.cross(0, 7000); r.cross(1, 8500);
  ok('a race by time: a car counts on after the time is up until it crosses the line, then stops at that crossing (the lap counts)', r.cars[0].done && r.spentOf(r.cars[0], 30000, false) === 7000 && r.cars[1].done && r.spentOf(r.cars[1], 30000, false) === 8500 && !r.cars[2].done);
}

// ---- the heat race: the time of every driver in the heats that are done ----
const sched = [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }], [{ p: 1, lane: 0 }, { p: 2, lane: 1 }], [{ p: 2, lane: 0 }, { p: 0, lane: 1 }]];
const heatRace = () => E.createHeatRace({ participants: people, schedule: sched, resultBy: 'laps', points: [], lanes: 2, finals: 'none' });
const heatEngine = H => { const q = E.createRace({ type: 'race', laps: 2, endRule: 'all', entries: H.entries().map(e => ({ ...e })) }); q.start(100000); return q; };
const finish = (q, times) => times.forEach(([i, a, b]) => { q.cross(i, 100000 + a); q.cross(i, 100000 + b); }); // (two laps: the finish times are b)
const H = heatRace();
let q1 = heatEngine(H); finish(q1, [[0, 5000, 11000], [1, 6000, 13000]]); q1.addTime(1, 2000);
const rec1 = H.record(q1);
ok('a heat that is done holds, for every car, the time it raced without and with penalties', rec1.rows.length === 2 && rec1.rows[0].participant === 0 && rec1.rows[0].spent === 11000 && rec1.rows[0].spentPen === 11000 && rec1.rows[1].participant === 1 && rec1.rows[1].spent === 13000 && rec1.rows[1].spentPen === 15000);
ok('...and the time of the heats so far, per participant: [participant, with penalties, without]', JSON.stringify(H.spentBy()) === JSON.stringify([[0, 11000, 11000], [1, 15000, 13000]]));
let q2 = heatEngine(H); finish(q2, [[0, 5500, 12000], [1, 7000, 14000]]);
H.record(q2);
ok('the next heat adds up: a participant who raced twice has both (the lanes do not matter, the participant does)', JSON.stringify(H.spentBy()) === JSON.stringify([[0, 11000, 11000], [1, 27000, 25000], [2, 14000, 14000]]));
// (a fresh heat race with two heats done, for the tests that record more)
const twoDone = () => { const h = heatRace(), a = heatEngine(h); finish(a, [[0, 5000, 11000], [1, 6000, 13000]]); a.addTime(1, 2000); h.record(a); const b = heatEngine(h); finish(b, [[0, 5500, 12000], [1, 7000, 14000]]); h.record(b); return h; };
ok('...in the order the participants first raced', H.spentBy().map(x => x[0]).join() === '0,1,2');
ok('a heat race that has not raced yet has nothing', heatRace().spentBy().length === 0);
{ const n = race(); n.cars[0].done = true; n.cars[0].total = NaN; n.cars[1].done = true; n.cars[1].total = 9000; n.stop(12000);
  const H0 = heatRace(), rec = H0.record(n);
  ok('a time that is not a number is not put in the result: the row has no figures, and the heat race leaves it out of the sum', !('spent' in rec.rows.find(x => x.participant === 0)) && rec.rows.find(x => x.participant === 1).spent === 9000 && JSON.stringify(H0.spentBy().sort((a, b) => a[0] - b[0])) === JSON.stringify([[1, 9000, 9000], [2, 12000, 12000]]));
}
{ const A = heatRace(); // results of before 1.63.0 (a heat race that was interrupted and carried on) have no such figures: the race time counts, the correction of the review is taken off for the time on the clock
  A.restore({ v: 1, schedule: sched, idx: 1, results: [{ heat: 1, rows: [{ participant: 0, pos: 1, laps: 2, total: 12000, adjMs: 1000, best: 5000, points: 0 }, { participant: 1, pos: 2, laps: 2, total: 13000, best: 5000, points: 0 }] }], finalPlan: null, picks: {} });
  ok('...a result from before has its race time for "with penalties", and the race time less the correction for "without"', JSON.stringify(A.spentBy()) === JSON.stringify([[0, 12000, 11000], [1, 13000, 13000]]));
  const B = heatRace(); B.restore({ v: 1, schedule: sched, idx: 1, results: [{ heat: 1, rows: [{ participant: 0, pos: 1, laps: 0, total: null, best: null, points: 0 }, { participant: 1, pos: 2, laps: 2, total: 9000, spent: null, spentPen: 'x', best: 5000, points: 0 }] }], finalPlan: null, picks: {} });
  ok('...a row without a time is left out (no NaN), and a row with something else than numbers falls back on the race time', JSON.stringify(B.spentBy()) === JSON.stringify([[1, 9000, 9000]]));
  const D = heatRace(); D.restore({ v: 1, schedule: sched, idx: 1, results: [{ heat: 1, rows: [{ participant: 0, pos: 1, laps: 2, total: null, spentPen: 5000, best: null, points: 0 }, { participant: 1, pos: 2, laps: 2, total: 8000, spent: 7000, spentPen: null, best: null, points: 0 }, { participant: 2, pos: 3, laps: 2, total: 6000, spent: 5000, spentPen: 6000, best: null, points: 0 }] }], finalPlan: null, picks: {} });
  ok('...a row whose time on the clock cannot be made is left out whole (never a half sum), a row without the figure with penalties falls back on its race time, and a row with both is counted', JSON.stringify(D.spentBy()) === JSON.stringify([[1, 8000, 7000], [2, 6000, 5000]]));
  const fake = (a, b) => ({ standings: () => [{ pos: 1, car: { participant: a, laps: [1, 1], total: 2, best: 1 } }, { pos: 2, car: { participant: b, laps: [1], total: 3, best: 1 } }] });
  const C = heatRace(); C.record(fake(0, 1));
  ok('a race that has no such figure (a stand-in) gives rows without them, and the race time counts', !('spent' in C.results[0].rows[0]) && JSON.stringify(C.spentBy()) === JSON.stringify([[0, 2, 2], [1, 3, 3]]));
}

// ---- the widget ----
const mkS = (eng, over = {}) => {
  const st = eng.standings();
  return { eng, now: 100000 + 20000, phase: 'running', lights: 0, setup: { sessionType: 'heats', laps: 2 }, heat: null, carByLane: l => eng.cars.find(c => c.lane === l) || null, rowOf: c => st.find(r => r.car === c),
    flashOf: () => null, personalBest: () => Infinity, ...over };
};
const heatInfo = (h, more = {}) => ({ idx: h.idx, count: h.count, by: 'laps', list: [], ...(h.results.length ? { before: h.spentBy() } : {}), ...more });
const show = (type, lane, S, opt) => T.content({ type, lane, opt: opt || {} }, S).html;
{ // heat 3: participant 2 on lane 0 and participant 0 on lane 1; heats 1 and 2 are done (above)
  const q3 = heatEngine(H), S = (o = {}, now = 105000) => mkS(q3, { now, phase: 'running', heat: heatInfo(H), ...o });
  ok('the widget is in the folder Lap Times and Records, for one driver (a lane), with the settings for the time of and the penalties', (() => { const d = Wd.def('totaltime'); return !!d && d.label === 'Total Time' && d.group === 'Lap Times and Records' && d.perLane === true && d.options.map(o => o.key).join() === 'scope,penalties'; })());
  ok('...next to the Current Lap Time widget', (() => { const l = Wd.REGISTRY.filter(x => x.group === 'Lap Times and Records').map(x => x.type); return l.indexOf('totaltime') === l.indexOf('laptime') + 1; })());
  ok('in this heat it shows the time the driver has been racing in this heat (5 s after the start)', show('totaltime', 0, S()) === '5.000' && show('totaltime', 1, S()) === '5.000');
  ok('...as a lap time is written (minutes, seconds, thousandths), and it counts up', show('totaltime', 0, S({}, 100000 + 83456)) === '1:23.456' && show('totaltime', 0, S({}, 100000 + 600123)) === '10:00.123');
  ok('all heats so far adds up the heats that are done and the one that is racing (participant 2: 14 s + 5 s; participant 0: 11 s + 5 s)', show('totaltime', 0, S(), { scope: 'all' }) === '19.000' && show('totaltime', 1, S(), { scope: 'all' }) === '16.000');
  ok('...the heats are those of the participant, whatever lane he raced in before (participant 0 was in lane 0 in heat 1 and is in lane 1 now)', show('totaltime', 1, S({}, 100000 + 1000), { scope: 'all' }) === '12.000');
  ok('both: this heat, with the heats so far beside it', show('totaltime', 0, S(), { scope: 'both' }) === '5.000<small class="rn">19.000 in all</small>');
  ok('with penalties is what it shows when nothing is set, and without penalties leaves the penalties out (participant 1 had 2 s in heat 1)', (() => {
    const q = heatEngine(H); q.cross(0, 100000 + 3000); // (lane 0 = participant 2, lane 1 = participant 0)
    const S2 = mkS(q, { now: 100000 + 5000, heat: heatInfo(H) }); q.addTime(0, 4000);
    return show('totaltime', 0, S2) === '9.000' && show('totaltime', 0, S2, { penalties: 'with' }) === '9.000' && show('totaltime', 0, S2, { penalties: 'without' }) === '5.000' && show('totaltime', 0, S2, { scope: 'all', penalties: 'without' }) === '19.000' && show('totaltime', 0, S2, { scope: 'all' }) === '23.000'; })());
  ok('...also for the time of the heats before: the penalty of heat 1 is in the time of participant 1 with penalties (15 s) and not without (13 s)', (() => {
    const q = E.createRace({ type: 'race', laps: 2, endRule: 'all', entries: entries([1, 2]) }); q.start(0); const S3 = mkS(q, { now: 2000, heat: heatInfo(H) });
    return show('totaltime', 0, S3, { scope: 'all' }) === '29.000' && show('totaltime', 0, S3, { scope: 'all', penalties: 'without' }) === '27.000'; })());
  ok('a driver who has not raced before has only this heat, and a participant the list does not know too', show('totaltime', 0, S({ heat: { ...heatInfo(H), before: [[7, 1, 1]] } }), { scope: 'all' }) === '5.000' && show('totaltime', 0, S({ heat: { ...heatInfo(H), before: undefined } }), { scope: 'all' }) === '5.000');
  ok('before the start the time is 0 (the heat has not begun), and with the heats before it the sum of those', (() => { const q = E.createRace({ type: 'race', laps: 2, endRule: 'all', entries: entries([2, 0]) }); const S4 = mkS(q, { now: 123456, phase: 'between', heat: heatInfo(H) });
    return show('totaltime', 0, S4) === '0.000' && show('totaltime', 0, S4, { scope: 'all' }) === '14.000' && show('totaltime', 1, S4, { scope: 'all' }) === '11.000'; })());
  ok('a driver who has finished his heat stops counting: the time of his last crossing, for this heat and in the sum', (() => { const q = heatEngine(H); finish(q, [[0, 4000, 9000]]);
    const S5 = (now) => mkS(q, { now, heat: heatInfo(H) });
    return show('totaltime', 0, S5(100000 + 20000)) === '9.000' && show('totaltime', 0, S5(100000 + 50000)) === '9.000' && show('totaltime', 0, S5(100000 + 50000), { scope: 'all' }) === '23.000' && show('totaltime', 1, S5(100000 + 50000)) === '50.000'; })());
  ok('a race that is stopped has the time the race lasted, for the drivers who did not finish (the clock stops with the race)', (() => { const q = heatEngine(H); finish(q, [[0, 4000, 9000]]); q.stop(100000 + 15000);
    return show('totaltime', 1, mkS(q, { now: 100000 + 70000, phase: 'review', heat: heatInfo(H) })) === '15.000' && show('totaltime', 0, mkS(q, { now: 100000 + 70000, phase: 'review', heat: heatInfo(H) })) === '9.000'; })());
  ok('while the heat is checked after the finish (review) it is not recorded yet: its time is added to the heats before it', (() => { const q = heatEngine(H); finish(q, [[0, 4000, 9000], [1, 5000, 10000]]);
    return show('totaltime', 0, mkS(q, { now: 100000 + 70000, phase: 'review', heat: heatInfo(H) }), { scope: 'all' }) === '23.000'; })());
  ok('the last heat is recorded: the screen still shows its cars, and their time is in the heats so far already (it is not added a second time)', (() => {
    const Hx = twoDone(), q = heatEngine(Hx); finish(q, [[0, 4000, 9000], [1, 6000, 13000]]); Hx.record(q);
    const S6 = mkS(q, { now: 100000 + 70000, phase: 'finished', heat: heatInfo(Hx) });
    const out = [show('totaltime', 0, S6, { scope: 'all' }), show('totaltime', 1, S6, { scope: 'all' }), show('totaltime', 0, S6)];
    return out.join() === '23.000,24.000,9.000' && Hx.idx === 3 && !Hx.hasNext(); })());
  ok('...also when the event was stopped after a heat (the heat is recorded and there are heats left)', (() => {
    const H2 = heatRace(); const a = heatEngine(H2); finish(a, [[0, 4000, 9000], [1, 5000, 10000]]); H2.record(a);
    return show('totaltime', 0, mkS(a, { now: 200000, phase: 'finished', heat: heatInfo(H2) }), { scope: 'all' }) === '9.000' && H2.idx < H2.total; })());
  ok('a race that is no heat race: all heats is this race (nothing before it)', show('totaltime', 0, mkS(q3, { now: 105000, heat: null }), { scope: 'all' }) === '5.000' && show('totaltime', 0, mkS(q3, { now: 105000, heat: null }), { scope: 'both' }) === '5.000<small class="rn">5.000 in all</small>');
  ok('a list of the heats before with something else than numbers counts as nothing (no NaN)', show('totaltime', 0, S({ heat: { ...heatInfo(H), before: [[2, null, null]] } }), { scope: 'all' }) === '5.000' && show('totaltime', 0, S({ heat: { ...heatInfo(H), before: [[2, 'x', undefined]] } }), { scope: 'all' }) === '5.000');
  ok('the heats are in the sum once the data says all of them are recorded, whatever the phase (the race window and a far window get the same message)', show('totaltime', 0, S({ phase: 'review', heat: { ...heatInfo(H), idx: 3, count: 3 } }), { scope: 'all' }) === '14.000' && show('totaltime', 0, S({ phase: 'review', heat: heatInfo(H) }), { scope: 'all' }) === '19.000');
  ok('...a final is a race after the heats: with a final to come the heats are not all recorded when the last heat is (heat 3 of 3 is done, the final races now)', show('totaltime', 0, S({ phase: 'running', heat: { ...heatInfo(H), idx: 3, count: 3, total: 4 } }), { scope: 'all' }) === '19.000' && show('totaltime', 0, S({ phase: 'running', heat: { ...heatInfo(H), idx: 4, count: 3, total: 4 } }), { scope: 'all' }) === '14.000');
  ok('a driver who is not in the list of the heats before, after the last heat, has this heat alone (never nothing)', show('totaltime', 0, S({ phase: 'finished', heat: { ...heatInfo(H), before: [[7, 1000, 1000]] } }), { scope: 'all' }) === '5.000');
  ok('an engine that cannot tell the time shows a dash and has no value to order by (no 0:00.0, no NaN)', (() => { const stand = Object.create(q3); stand.spentOf = undefined; const s = mkS(stand, { now: 105000, heat: heatInfo(H) }); return show('totaltime', 0, s) === '–' && show('totaltime', 0, s, { scope: 'all' }) === '–' && (() => { const q = heatEngine(H); finish(q, [[0, 4000, 9000]]); const st = Object.create(q); st.spentOf = undefined; return T.orderValue('totaltime', q.cars[0], mkS(st, { now: 105000, heat: null }), 105000) === null && T.orderValue('totaltimeall', q.cars[0], mkS(st, { now: 105000, heat: null }), 105000) === null; })(); })());
  ok('the settings start as the widget works when nothing is set: this heat, with penalties', (() => { const o = Wd.def('totaltime').options, sc = o.find(x => x.key === 'scope'), pe = o.find(x => x.key === 'penalties');
    return sc.default === 'heat' && pe.default === 'with' && Wd.ttScope({ scope: sc.default }) === 'heat' && Wd.ttPenalties({ penalties: pe.default }) === true && sc.choices.map(c => c[0]).join() === 'heat,all,both' && pe.choices.map(c => c[0]).join() === 'with,without'; })());
  ok('a lane without a car shows nothing, and a setting that is not one of the choices is the default (this heat, with penalties)', show('totaltime', 5, S()) === '' && show('totaltime', 0, S(), { scope: 'x', penalties: 'y' }) === '5.000');
  ok('a time that is not a number is a dash', Wd.totalTimeHtml({ heat: NaN, all: Infinity }, { scope: 'both' }) === '–<small class="rn">– in all</small>' && Wd.totalTimeHtml(null, {}) === '–' && Wd.totalTimeHtml({ heat: 5000 }, { scope: 'all' }) === '–');
  ok('the sample on the layout page uses elapsed race time for each active lane and adds prior heats when selected', (() => { const d = Wd.def('totaltime'), a = d.sample(0, { opt: {} }), b = d.sample(0, { opt: { scope: 'all' } }), c = d.sample(0, { opt: { scope: 'both' } }), e = d.sample(1, { opt: {} });
    return /^\d+:\d\d\.\d{3}$/.test(a) && /^\d+:\d\d\.\d{3}$/.test(b) && a !== b && c.startsWith(a) && c.includes(b) && e === a; })());
}

// ---- Order by: Total time ----
{ const r = race();
  r.cross(0, 4000); r.cross(0, 12000); r.cross(1, 5000); r.cross(1, 9000); // lane 1 finishes first, lane 0 second, lane 2 is still racing
  const list = r.standings(), S = mkS(r, { now: 100000, heat: null }), by = (key, dir) => T.ordered(list, { orderBy: key, orderDir: dir }, S).map(x => x.car.driverName).join();
  ok('"Total time" is in the Order by list, twice: for this race or heat and for all heats so far, the shortest time is the best', Bo.KEYS.length === 18 && ['totaltime', 'totaltimeall'].every(k => Bo.info(k).best === 'low' && Bo.CHOICES.some(c => c[0] === k)) && Bo.info('totaltime').label === 'Total time (this race or heat)' && Bo.info('totaltimeall').label === 'Total time (all heats so far)');
  ok('...with a hint that says only a car that has finished has a time', /Only a car that has finished/.test(Bo.hintOf('totaltime')) && /Only a car that has finished/.test(Bo.hintOf('totaltimeall')) && !/Only a car/.test(Bo.hintOf('best')));
  ok('the shortest total time comes first; the car that is still racing stays below the cars that finished', by('totaltime') === 'Sam,Alex,Kim');
  ok('...Worst first turns the finished cars round, and the car that is still racing is still last', by('totaltime', 'worst') === 'Alex,Sam,Kim');
  ok('...the Position column counts the rows of the board (1, 2, 3) and the rows know their race place', (() => { const o = T.ordered(list, { orderBy: 'totaltime' }, S); return o.map(x => x.pos).join() === '1,2,3' && o.every(x => x.byOrder) && o[0].racePos === 1 && T.ordered(list, { orderBy: 'totaltime', orderDir: 'worst' }, S)[0].racePos === 2; })());
  ok('a time penalty counts: 5 s for the car that finished first puts it behind the other', (() => { r.addTime(1, 5000); const b = by('totaltime'); r.cars[1].extraMs = 0; return b === 'Alex,Sam,Kim'; })());
  ok('a correction of the review counts too', (() => { r.adjust(0, { ms: -4000 }); const b = by('totaltime'); r.adjust(0, { ms: 4000 }); return b === 'Alex,Sam,Kim'; })());
  ok('nobody has finished yet: nobody has a value and the board follows the race', (() => { const n = race(); n.cross(0, 4000); n.cross(1, 5000); const L = n.standings(); return T.ordered(L, { orderBy: 'totaltime' }, mkS(n, { heat: null })).map(x => x.car.driverName).join() === L.map(x => x.car.driverName).join(); })());
  ok('a car that is out of the race (retired, disqualified) has no total time, and stays below', (() => { const n = race(); n.cross(0, 4000); n.cross(0, 12000); n.cross(1, 5000); n.cross(1, 9000); n.setDq(1, true); const L = n.standings(); return T.ordered(L, { orderBy: 'totaltime' }, mkS(n, { heat: null })).map(x => x.car.driverName)[0] === 'Alex'
    && T.orderValue('totaltime', n.cars[1], mkS(n, { heat: null }), 20000) === null && T.orderValue('totaltime', n.cars[0], mkS(n, { heat: null }), 20000) === 12000 && (n.cars[2].retired = true, T.orderValue('totaltime', n.cars[2], mkS(n, { heat: null }), 20000) === null); })());
  ok('a car that retired, and a car that is disqualified, each have no total time even when the other flag is not set', (() => { const n = race(); n.cross(0, 4000); n.cross(0, 12000); n.cross(1, 5000); n.cross(1, 9000); const s = mkS(n, { heat: null });
    const base = T.orderValue('totaltime', n.cars[0], s, 20000); n.cars[0].retired = true; const r = T.orderValue('totaltime', n.cars[0], s, 20000); n.cars[0].retired = false; n.cars[0].dq = true; const d = T.orderValue('totaltime', n.cars[0], s, 20000);
    return base === 12000 && r === null && d === null; })());
  ok('the value of a car is in milliseconds, with penalties (12 s and 2 s makes 14 s), and nothing for a car that is racing', (() => { const n = race(); n.cross(0, 4000); n.cross(0, 12000); n.addTime(0, 2000); const s = mkS(n, { heat: null });
    return T.orderValue('totaltime', n.cars[0], s, 20000) === 14000 && T.orderValue('totaltime', n.cars[1], s, 20000) === null && T.orderValue('totaltimeall', n.cars[0], s, 20000) === 14000; })());
  // over the heats: the sum of the heats, ordered
  const Hy = twoDone(), q3 = heatEngine(Hy); finish(q3, [[0, 4000, 7000], [1, 6000, 8000]]); // lane 0 = participant 2 (14 s before), lane 1 = participant 0 (11 s before): this heat 7 s and 8 s, in all 21 s and 19 s
  const L3 = q3.standings(), S3 = mkS(q3, { now: 100000 + 50000, phase: 'review', heat: heatInfo(Hy) });
  ok('the value of this heat and of all heats so far are different things (7 s and 8 s in this heat, 21 s and 19 s in all)', T.orderValue('totaltime', q3.cars[0], S3, 150000) === 7000 && T.orderValue('totaltime', q3.cars[1], S3, 150000) === 8000 && T.orderValue('totaltimeall', q3.cars[0], S3, 150000) === 21000 && T.orderValue('totaltimeall', q3.cars[1], S3, 150000) === 19000);
  ok('...the board of this heat has the driver who was quicker in this heat first (participant 2), the board of all heats the driver with the shortest sum (participant 0)', T.ordered(L3, { orderBy: 'totaltime' }, S3).map(x => x.car.participant).join() === '2,0' && T.ordered(L3, { orderBy: 'totaltimeall' }, S3).map(x => x.car.participant).join() === '0,2');
  ok('...and Worst first turns that round', T.ordered(L3, { orderBy: 'totaltimeall', orderDir: 'worst' }, S3).map(x => x.car.participant).join() === '2,0');
  ok('a car that is still racing in a later heat has no value in either list', (() => { const q = heatEngine(Hy); finish(q, [[1, 4000, 9000]]); const s = mkS(q, { now: 100000 + 12000, heat: heatInfo(Hy) }); return T.orderValue('totaltimeall', q.cars[0], s, 112000) === null && T.orderValue('totaltimeall', q.cars[1], s, 112000) === 20000; })());
}

console.log(fails ? fails + ' TOTAL TIME TESTS FAILED' : 'ALL TOTAL TIME TESTS PASSED'); process.exit(fails ? 1 : 0);
