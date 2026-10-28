// 1.67.0: a leaderboard that counts over all heats ("Count over: All heats so far"): the overall standings with the heat that is racing counted as it stands (H.preview, H.overall(extra)),
// every participant on the board, and the columns that remember the heats before (total time, laps, best lap, average and median lap, points, distance), also on another screen (the live link).
const E = require('../renderer/engine.js'), T = require('../renderer/timing.js'), Wd = require('../renderer/widgets.js'), Rows = require('../renderer/rows.js'), Bo = require('../renderer/boardorder.js'), LS = require('../renderer/liveshare.js');
let fails = 0; const ok = (m, c) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };

const names = ['Alex', 'Sam', 'Kim'];
const people = [0, 1, 2].map(i => ({ driverId: 'd' + i, carId: 'c' + i, driverName: names[i], nickname: 'N' + names[i], callsign: 'C' + i, flag: i === 0 ? 'NL' : '', avatar: i === 1 ? 'data:avatar' : '', carName: 'car' + i, carPicture: '', carScale: '', ...(i === 2 ? { teamId: 't1', teamName: 'Reds', teamPicture: '' } : {}) }));
const sched = [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }], [{ p: 1, lane: 0 }, { p: 2, lane: 1 }], [{ p: 2, lane: 0 }, { p: 0, lane: 1 }]];
const heatRace = (o = {}) => E.createHeatRace({ participants: people, schedule: sched, resultBy: 'laps', points: [], lanes: 2, finals: 'none', ...o });
const heatEngine = H => { const q = E.createRace({ type: 'race', laps: 2, endRule: 'all', entries: H.entries().map(e => ({ ...e })) }); q.start(100000); return q; };
const finish = (q, list) => list.forEach(([i, ...at]) => at.forEach(a => q.cross(i, 100000 + a))); // (the crossings of car i, the race clock in ms after the start)

// what race.js keeps and sends (the same rules, written out here), to build the state of a screen from
const memo = new Map();
const keep = (H, q) => { H.record(q); q.cars.forEach(c => { memo.set(c.participant, E.memoStep(memo.get(c.participant), c, NaN)); }); }; // (the same step the race screen takes)
const priorOf = H => { const raced = new Set(); H.results.forEach(hr => hr.rows.forEach(x => raced.add(x.participant))); return (H.results.length ? H.overall() : []).filter(o => raced.has(o.participant)).map(o => { const m = memo.get(o.participant); return { p: o.participant, laps: o.laps, pts: o.points, best: o.best, ...(m ? { valid: m.laps } : {}) }; }); };
const orderOf = (H, q) => H.overall(q ? H.preview(q) : null).map(o => [o.participant, Number.isFinite(o.score) ? o.score : null]);
const roster = people.map(p => ({ driverId: p.driverId, carId: p.carId, driverName: p.driverName, nickname: p.nickname, callsign: p.callsign, flag: p.flag, avatar: p.avatar, carName: p.carName, carPicture: p.carPicture, carScale: p.carScale, ...(p.teamId ? { teamId: p.teamId, teamName: p.teamName, teamPicture: p.teamPicture } : {}) }));

// ---- the engine: the result of a race that is not over yet ----
{ const H = heatRace(), q = heatEngine(H); finish(q, [[0, 5000, 11000], [1, 6000, 13000]]);
  const pre = H.preview(q), before = H.results.length, idx = H.idx;
  ok('H.preview gives the result of the race that is racing, and keeps nothing: no result is added and the heat is still the first', before === 0 && H.results.length === 0 && H.idx === idx && idx === 0 && pre.heat === 1 && pre.rows.length === 2);
  const rec = H.record(q);
  ok('...and it is exactly what H.record keeps for that race', JSON.stringify(pre) === JSON.stringify(rec) && H.results.length === 1 && H.idx === 1);
  const q2 = heatEngine(H); finish(q2, [[0, 5500]]);
  const live = H.overall(H.preview(q2)), done = H.overall();
  ok('H.overall(extra) counts the race that is racing as if it ended now: Sam (the car in lane 0 of heat 2, one lap done) has the 2 laps of heat 1 and the lap of the heat that runs, Kim (no lap) has none', live.find(o => o.participant === 1).laps === 3 && live.find(o => o.participant === 2).laps === 0 && done.find(o => o.participant === 1).laps === 2);
  ok('...without the extra it is the heats that are done, as before, and asking for it does not change them', JSON.stringify(H.overall()) === JSON.stringify(done) && H.results.length === 1);
  const H2 = heatRace(), a = heatEngine(H2); finish(a, [[0, 5000, 11000], [1, 6000, 13000]]); H2.record(a);
  const b = heatEngine(H2); finish(b, [[0, 5500, 12000], [1, 7000, 14000]]);
  const viaPreview = H2.overall(H2.preview(b)); H2.record(b);
  ok('...and it is the same standing as when that race is really recorded afterwards', JSON.stringify(viaPreview) === JSON.stringify(H2.overall()));
}

// ---- three heats: two are done, the third is racing ----
const H = heatRace();
{ const a = heatEngine(H); finish(a, [[0, 5000, 11000], [1, 6000, 13000]]); keep(H, a); // heat 1: Alex 5.000 + 6.000, Sam 6.000 + 7.000
  const b = heatEngine(H); finish(b, [[0, 5500, 13500], [1, 7000, 14000]]); keep(H, b); } // heat 2: Sam 5.500 + 8.000, Kim 7.000 + 7.000
const heat3 = () => { const q = heatEngine(H); finish(q, [[0, 4000]]); return q; }; // heat 3: Kim (lane 0) has done one lap of 4.000; Alex (lane 1) none yet
const q3 = heat3();
const NOW = 100000 + 9000;
const heatInfo = (more = {}) => ({ idx: H.idx, count: H.count, by: 'laps', order: orderOf(H, q3), ovBy: 'laps', list: [], before: H.spentBy(), ...more });
const mkS = (eng, over = {}) => { const st = eng.standings(); return { eng, now: NOW, phase: 'running', lights: 0, setup: { sessionType: 'heats', laps: 2 }, heat: heatInfo(), roster, prior: priorOf(H), standings: () => st, carByLane: l => eng.cars.find(c => c.lane === l) || null,
  rowOf: c => st.find(r => r.car === c), flashOf: () => null, personalBest: () => Infinity, laneColorsOf: () => ({}), distUnit: 'm', champ: { on: false, list: [], done: new Map() }, ...over }; };
const strip = h => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const show = (S, type, driver, opt) => { const O = T.overallState(S), c = O.standings().find(x => x.car.driverName === driver).car; return T.content({ type, lane: c.lane, opt: opt || {} }, O).html; };

ok('the order everybody stands in: Sam 4 laps, Kim 3 (2 in the heats before and 1 in the heat that runs), Alex 2', JSON.stringify(heatInfo().order.map(x => x[0])) === JSON.stringify([1, 2, 0]));
{ const S = mkS(q3), O = T.overallState(S), rows = O.standings();
  ok('the overall state lists every participant in that order, with the places 1 to 3', rows.map(x => x.car.driverName).join() === 'Sam,Kim,Alex' && rows.map(x => x.pos).join() === '1,2,3');
  ok('...a driver who is racing now is the car on track (lane 0 for Kim), one who is not has a lane of his own beyond the track', O.carByLane(0) === rows[1].car && rows[1].car.real === q3.cars.find(c => c.participant === 2) && rows[0].car.real === null && rows[0].car.lane >= 1000);
  ok('...it is made once for a state and then reused, and the state itself is left as it was', T.overallState(S) === O && S.standings().length === 2 && S.standings()[0].car === q3.standings()[0].car && !Object.keys(S).includes('__over'));
  ok('the gap to the leader is what the result counts (laps here): the leader has none, Kim is a lap down, Alex 2 laps', rows.map(x => x.gap).join('|') === '|+1 lap|+2 laps');
  ok('Name, nickname, callsign and flag of a driver who is not racing now come from the roster', show(S, 'name', 'Sam') === 'Sam' && show(S, 'nickname', 'Sam') === 'NSam' && show(S, 'callsign', 'Sam') === 'C1' && show(S, 'driverflag', 'Alex') === '<span class="fi fi-nl"></span>');
  ok('...so do the car name and the team', show(S, 'carname', 'Sam') === 'car1' && show(S, 'teamname', 'Kim') === 'Reds' && show(S, 'teamname', 'Sam') === '');
  ok('Position in Race is the place in the overall result, Gap to Leader its gap', show(S, 'position', 'Kim') === '2' && show(S, 'gap', 'Alex') === '+2 laps' && show(S, 'gap', 'Sam') === '');
  ok('the laps are all the laps of all heats (Kim 3: 2 in heat 2 and 1 now), also for a driver who is not on track (Sam 4: 2 + 2)', show(S, 'lap', 'Kim') === '3' && show(S, 'lap', 'Sam') === '4' && show(S, 'lap', 'Alex') === '2');
  ok('the best lap is the best of all heats and of the heat that runs (Kim 4.000 now, Sam 5.500 in heat 2, Alex 5.000 in heat 1)', show(S, 'bestlap', 'Kim') === '4.000' && show(S, 'bestlap', 'Sam') === '5.500' && show(S, 'bestlap', 'Alex') === '5.000');
  ok('the average lap is made of all the laps that count: Sam (6.000 7.000 5.500 8.000) 6.625, Kim (7.000 7.000 4.000) 6.000, Alex 5.500', show(S, 'avglap', 'Sam') === '6.625' && show(S, 'avglap', 'Kim') === '6.000' && show(S, 'avglap', 'Alex') === '5.500');
  ok('...the median lap too: Sam 6.500, Kim 7.000', show(S, 'medlap', 'Sam') === '6.500' && show(S, 'medlap', 'Kim') === '7.000');
  ok('the total time adds up the heats that are done and the one that is racing: Kim 14.000 + 9.000 s on track, Alex 11.000 + 9.000, Sam 26.500 (not racing: only the heats before)', show(S, 'totaltime', 'Kim') === '23.000' && show(S, 'totaltime', 'Alex') === '20.000' && show(S, 'totaltime', 'Sam') === '26.500');
  ok('...a Total Time widget that is set to "this race or heat" counts all the heats here (a board that counts over all heats has totals), and "both" shows both', show(S, 'totaltime', 'Kim', { scope: 'heat' }) === '23.000' && show(S, 'totaltime', 'Kim', { scope: 'both' }) === '9.000<small class="rn">23.000 in all</small>' && show(S, 'totaltime', 'Sam', { scope: 'both' }) === '–<small class="rn">26.500 in all</small>');
  ok('...without penalties it leaves the penalties out', show(S, 'totaltime', 'Sam', { penalties: 'without' }) === '26.500');
  ok('what cannot be added up is the car on track: the lap that runs for Kim (9 s since the start of the heat, no lap in the lap clock of a car that has crossed once)', show(S, 'laptime', 'Kim') === T.content({ type: 'laptime', lane: 0, opt: {} }, S).html);
  ok('...and a dash for a driver who is not racing', show(S, 'laptime', 'Sam') === '–' && show(S, 'fuel', 'Sam') === '–' && show(S, 'penalty', 'Sam') === '–');
  ok('Personal Best Lap of a driver who is not racing is his own (the best is from the database, not from the heats)', show(mkS(q3, { personalBest: id => (id === 'd1' ? 5300 : Infinity) }), 'recordlap', 'Sam') === '5.300');
  ok('without points in the race (the heats are counted by laps) Championship Points is a dash', show(S, 'champpoints', 'Sam') === '–');
  ok('a state that is not a heat race, or has no roster, no prior list or no order, has no overall view (the board shows the race as it was)', T.overallState(mkS(q3, { heat: null })) === null && T.overallState(mkS(q3, { roster: null })) === null && T.overallState(mkS(q3, { heat: heatInfo({ order: [] }) })) === null && T.overallState(mkS(q3, { heat: heatInfo({ order: undefined }) })) === null);
  ok('...a missing prior list is the same as no heat done: the drivers have the laps of the heat that runs only', (() => { const O2 = T.overallState(mkS(q3, { prior: undefined })), c = O2.standings().find(x => x.car.driverName === 'Sam').car; return c.lapsAll === 0 && c.best === null; })());
}

// ---- the leaderboard widget ----
{ const S = mkS(q3), lb = opt => T.content({ type: 'leaderboard', opt }, S).html;
  const classic = lb({ countOver: 'all' }), heatOnly = lb({}), heat2 = lb({ countOver: 'heat' });
  ok('the classic leaderboard that counts over all heats lists the three drivers, the leader first, with their laps in all heats', /Sam.*Kim.*Alex/.test(strip(classic)) && strip(classic).includes('Sam 4') && strip(classic).includes('Kim 3') && strip(classic).includes('Alex 2'));
  ok('...the best lap and the gap are the overall ones', strip(classic).includes('5.500') && strip(classic).includes('+1 lap') && strip(classic).includes('+2 laps'));
  ok('...and the one that is not set to count over all heats is as it was: the two cars on track', !strip(heatOnly).includes('Sam') && strip(heatOnly).includes('Kim') && strip(heatOnly).includes('Alex') && heatOnly === heat2);
  const fallback = T.content({ type: 'leaderboard', opt: { countOver: 'all' } }, mkS(q3, { heat: null })).html;
  ok('...in a race without heats (or when there is nothing to count over) the setting does nothing', fallback === T.content({ type: 'leaderboard', opt: {} }, mkS(q3, { heat: null })).html);
  const D = Rows.defaultDesign(); const mkRow = (...types) => ({ ...D, widgets: types.map((t, i) => { const w = Wd.newWidget(t, 0, 10 + i * 100, 5); w.w = 95; w.h = 60; w.showTitle = false; return w; }) });
  const design = mkRow('position', 'name', 'lap', 'bestlap', 'avglap', 'totaltime', 'gap');
  const S2 = mkS(q3, { rowDesigns: [{ id: 'rd', ...design }] }), board = opt => strip(T.content({ type: 'leaderboard', opt: { design: 'rd', ...opt } }, S2).html);
  ok('a row design is drawn the same way: every driver, in the overall order, with the columns that remember (laps, best, average, total time, gap)', board({ countOver: 'all' }) === '1 Sam 4 5.500 6.625 26.500 2 Kim 3 4.000 6.000 23.000 +1 lap 3 Alex 2 5.000 5.500 20.000 +2 laps');
  ok('...and without the setting only the two cars that are racing, with this heat only (Kim is on lap 2 of 2 with 4.000, 9 s in the heat)', board({}) === '1 Kim 2/2 4.000 4.000 9.000 2 Alex 1/2 – – 9.000');
  ok('From place and To place count the places of the overall result (places 2 to 3)', board({ countOver: 'all', from: 2, to: 3 }) === '2 Kim 3 4.000 6.000 23.000 +1 lap 3 Alex 2 5.000 5.500 20.000 +2 laps');
  ok('Order by best lap (best first) orders the overall board by the best lap of all heats: Kim 4.000, Alex 5.000, Sam 5.500; the places count the rows of the board, the gap stays the one of the race', board({ countOver: 'all', orderBy: 'best' }) === '1 Kim 3 4.000 6.000 23.000 +1 lap 2 Alex 2 5.000 5.500 20.000 +2 laps 3 Sam 4 5.500 6.625 26.500');
  ok('...by the average lap: Alex 5.500, Kim 6.000, Sam 6.625', board({ countOver: 'all', orderBy: 'avg' }) === '1 Alex 2 5.000 5.500 20.000 +2 laps 2 Kim 3 4.000 6.000 23.000 +1 lap 3 Sam 4 5.500 6.625 26.500');
  ok('...by the laps (most first) and worst first reverses it', board({ countOver: 'all', orderBy: 'laps' }) === board({ countOver: 'all' }) && board({ countOver: 'all', orderBy: 'laps', orderDir: 'worst' }) === '1 Alex 2 5.000 5.500 20.000 +2 laps 2 Kim 3 4.000 6.000 23.000 +1 lap 3 Sam 4 5.500 6.625 26.500');
  ok('...by the total time of all heats: Sam, who is not on track, has his heats (26.500) and is first; the cars that are still racing have none yet and stay below him in the order of the race', board({ countOver: 'all', orderBy: 'totaltimeall' }) === '1 Sam 4 5.500 6.625 26.500 2 Kim 3 4.000 6.000 23.000 +1 lap 3 Alex 2 5.000 5.500 20.000 +2 laps');
  ok('Order by name (A to Z) works too', board({ countOver: 'all', orderBy: 'name' }) === '1 Alex 2 5.000 5.500 20.000 +2 laps 2 Kim 3 4.000 6.000 23.000 +1 lap 3 Sam 4 5.500 6.625 26.500');
}

// ---- the times of the drivers who are not racing, and the order values ----
{ const S = mkS(q3), O = T.overallState(S), v = (key, driver) => T.orderValue(key, O.standings().find(x => x.car.driverName === driver).car, O, NOW);
  ok('the values a board is ordered by: laps (all heats), best lap, average and median lap', v('laps', 'Sam') === 4 && v('best', 'Kim') === 4000 && v('avg', 'Sam') === 6625 && v('median', 'Sam') === 6500);
  ok('...total time of all heats: a driver who is not racing has his heats (Sam 26.5 s), a car that is still racing has none yet (Kim, Alex), so it stays below', v('totaltimeall', 'Sam') === 26500 && v('totaltimeall', 'Kim') === null && v('totaltimeall', 'Alex') === null && v('totaltime', 'Sam') === 26500);
  ok('...a value that only the car on track has is its own (the lane), and nothing for a driver who is not on track', v('lane', 'Kim') === 0 && v('lane', 'Sam') === null && v('pits', 'Sam') === null && v('penpoints', 'Sam') === null);
  ok('...the name', v('name', 'Sam') === 'Sam');
  const qf = heat3(); qf.cross(0, 100000 + 8000); // Kim finishes her second lap in the heat: she has finished the heat and has a total
  const S3 = mkS(qf, { heat: heatInfo({ order: orderOf(H, qf) }) }), O3 = T.overallState(S3), kim = O3.standings().find(x => x.car.driverName === 'Kim').car;
  ok('a car that has finished its heat has its total time: the heats before and this one (14.000 + 8.000 = 22.000)', T.orderValue('totaltimeall', kim, O3, NOW) === 22000 && T.content({ type: 'totaltime', lane: kim.lane, opt: {} }, O3).html === '22.000');
}

// ---- points, time and distance: the gap says what the result counts ----
{ const P = heatRace({ resultBy: 'points', points: [10, 6, 3] }), a = heatEngine(P); finish(a, [[0, 5000, 11000], [1, 6000, 13000]]); P.record(a);
  const b = heatEngine(P); finish(b, [[0, 5500, 12000], [1, 7000, 14000]]);
  const info = { idx: P.idx, count: P.count, by: 'points', ovBy: 'points', order: orderOf(P, b), before: P.spentBy(), list: [] };
  const champ = { on: true, list: [10, 6, 3], done: new Map(P.overall().map(o => [o.driverId, o.points])) };
  const mem = people.map((p, i) => ({ p: i, laps: P.overall().find(o => o.participant === i).laps, pts: P.overall().find(o => o.participant === i).points, best: P.overall().find(o => o.participant === i).best })).filter(x => x.laps > 0);
  const S = mkS(b, { heat: info, prior: mem, champ, phase: 'running' }), O = T.overallState(S);
  ok('heats counted by points: the order follows the points as they stand (Sam 16, Alex 10, Kim 6)', O.standings().map(x => x.car.driverName).join() === 'Sam,Alex,Kim');
  ok('...Championship Points is the sum: the points of the heats that are done and what the place in the heat that runs is worth (Sam 6 + 10 for the first place = 16; Alex, who is not on track, has his 10)', show(S, 'champpoints', 'Sam') === '16' && show(S, 'champpoints', 'Alex') === '10');
  ok('...a driver whose first heat is the one that runs has the points of his place (Kim, second: 6), and with the points of the place now switched off only the heats that are done count (Sam 6, Kim 0)', show(S, 'champpoints', 'Kim') === '6' && show(S, 'champpoints', 'Sam', { live: false }) === '6' && show(S, 'champpoints', 'Kim', { live: false }) === '0');
  ok('...the gap is in points (the leader has none; the others are behind by what the leader has more: Alex 6, Kim 10)', O.standings().map(x => x.gap).join('|') === '|\u22126|\u221210');
  ok('Order by championship points has the same sum as its value', (() => { const v = k => T.orderValue('champ', O.standings().find(x => x.car.driverName === k).car, O, NOW); return v('Sam') === 16 && v('Alex') === 10 && v('Kim') === 6; })());
  const t = mkS(b, { heat: { ...info, ovBy: 'time', order: [[1, 20000], [0, 30000], [2, null]] } }), Ot = T.overallState(t);
  ok('heats counted by time: the gap is a time (+10.000)', Ot.standings().map(x => x.gap).join('|') === '|+10.000|');
  const m = mkS(b, { heat: { ...info, ovBy: 'distance', order: [[1, 60], [0, 41.5], [2, 0]] } }), Om = T.overallState(m);
  ok('heats counted by distance: the gap is a distance in the unit of the app (18.5 m behind is +19 m)', Om.standings()[1].gap === '+19 m');
  ok('...in feet (+61 ft)', T.overallState(mkS(b, { distUnit: 'ft', heat: { ...info, ovBy: 'distance', order: [[1, 60], [0, 41.5]] } })).standings()[1].gap === '+61 ft');
  const dm = mkS(b, { track: { id: 't', lanes: 2, length: 10, laneModifier: 'measured', laneLengths: '10, 10' }, heat: { ...info, ovBy: 'laps', order: [[1, 4], [0, 2], [2, 1]] }, prior: mem.map(x => ({ ...x, dist: x.laps * 10 })) });
  ok('Distance Driven adds up the metres of the heats that are done and the heat that runs (lanes of 10 m): Sam 20 m before + 20 m now = 40 m, Kim 0 + 20 m = 20 m, Alex (not on track) 20 m', (() => { const dist = (k, S) => T.content({ type: 'distance', lane: T.overallState(S).standings().find(x => x.car.driverName === k).car.lane, opt: { update: 'exact' } }, T.overallState(S)).html; return dist('Sam', dm) === '40 m' && dist('Kim', dm) === '20 m' && dist('Alex', dm) === '20 m'; })());
  const dn = mkS(b, { track: { id: 't', lanes: 2, length: 10, laneModifier: 'measured', laneLengths: '10, 10' }, heat: { ...info, ovBy: 'laps', order: [[1, 4], [0, 2], [2, 1]] }, prior: mem }), On = T.overallState(dn);
  ok('...a heat without metres: the total cannot be added up, so the cell is a dash (not a wrong sum)', T.content({ type: 'distance', lane: On.standings()[0].car.lane, opt: { update: 'exact' } }, On).html === '\u2013');
}

// ---- another screen: the same board from what the live link carries ----
{ const S = mkS(q3);
  const stat = LS.packStatic({ raceId: 'r1', title: 'x', eng: q3, setup: { sessionType: 'heats', laps: 2 }, layout: { id: 'L', widgets: [] }, track: { id: 't', lanes: 2 }, lanes: 2, base: { personal: new Map(), track: Infinity, trackName: '' }, roster, prior: priorOf(H) });
  ok('the static part of the live link carries the roster and what the heats before left behind (once per heat)', stat.roster.length === 3 && stat.roster[1].driverName === 'Sam' && stat.prior.length === 3 && stat.prior.find(x => x.p === 1).valid.length === 4);
  ok('...and nothing for a race without heats', LS.packStatic({ raceId: 'r2', title: 'x', eng: q3, setup: {}, layout: { widgets: [] }, track: {}, lanes: 2, base: { personal: new Map(), track: Infinity, trackName: '' } }).roster === null);
  const dyn = LS.packDynamic({ eng: q3, raceId: 'r1', phase: 'running', calling: false, lights: 0, heat: heatInfo(), flash: new Map(), bestAll: Infinity, bestAllName: '', bestBy: new Map(), champ: null, now: NOW });
  const V = LS.viewer(); V.feedStatic(JSON.parse(JSON.stringify(stat))); V.feedDynamic(JSON.parse(JSON.stringify(dyn)), NOW);
  const SV = V.shared(NOW);
  ok('the screen that receives it can draw the overall view: the same order, the same gaps', (() => { const O = T.overallState(SV); return !!O && O.standings().map(x => x.car.driverName + x.gap).join() === 'Sam,Kim+1 lap,Alex+2 laps'; })());
  const lbOf = (s, opt) => T.content({ type: 'leaderboard', opt }, s).html;
  ok('...and the board on that screen reads the same as in the race window (classic and a row design)', lbOf(SV, { countOver: 'all' }) === lbOf(S, { countOver: 'all' }));
  const D = Rows.defaultDesign(), design = { ...D, id: 'rd', widgets: ['position', 'name', 'lap', 'bestlap', 'avglap', 'totaltime'].map((t, i) => { const w = Wd.newWidget(t, 0, 10 + i * 100, 5); w.w = 95; w.h = 60; w.showTitle = false; return w; }) };
  ok('...the row design too (laps, best, average and total time of all heats)', lbOf({ ...SV, rowDesigns: [design] }, { design: 'rd', countOver: 'all' }) === lbOf({ ...S, rowDesigns: [design] }, { design: 'rd', countOver: 'all' }) && strip(lbOf({ ...SV, rowDesigns: [design] }, { design: 'rd', countOver: 'all' })).includes('1 Sam 4 5.500 6.625 26.500'));
}

// ---- the setting ----
{ const d = Wd.def('leaderboard'), o = d.options.find(x => x.key === 'countOver');
  ok('the Leaderboard widget has "Count over": this race or heat (the standard, so a layout from before looks as it did) or all heats and rounds so far', !!o && o.type === 'select' && o.default === 'heat' && o.choices.map(c => c[0]).join() === 'heat,all' && o.choices[0][1] === 'This race or heat' && o.choices[1][1] === 'All heats and rounds so far');
  ok('...with a hint that says what it remembers and what it does not', o.hint.includes('total time') && o.hint.includes('best lap') && o.hint.includes('average') && o.hint.includes('points') && o.hint.includes('dash'));
  ok('...it is not a setting of the classic table only: it shows for a row design and for the classic table alike', !o.classic && !o.rowsOnly);
  ok('...and the widget starts with it at the standard', Wd.newWidget('leaderboard', null, 0, 0).opt === undefined || (Wd.newWidget('leaderboard', null, 0, 0).opt || {}).countOver === undefined);
}

// ---- more corners: what the first checks did not pin down ----
{ const Sx = mkS(q3), O = T.overallState(Sx), carOf = (O_, n) => O_.standings().find(x => x.car.driverName === n).car;
  // the laps that do not count in the heat that runs sit behind the laps of the heats before: Kim has 7.000 and 7.000 from heat 2, then 4.000 and 5.000
  const avgKim = fn => { const q = heatEngine(H); finish(q, [[0, 4000, 9000]]); fn(q.cars[0]); return show(mkS(q), 'avglap', 'Kim'); };
  ok('a lap that does not count (removed, invalid, a pit lap or a bad lap) of the heat that runs is left out at its own place, behind the laps of the heats before: 7.000 7.000 4.000 = 6.000, not 5.750', avgKim(() => {}) === '5.750' && avgKim(c => { c.removed = [1]; }) === '6.000');
  ok('...the same for an invalid lap, a pit lap and a bad lap', avgKim(c => { c.invalid = [1]; }) === '6.000' && avgKim(c => { c.pitLaps = [1]; }) === '6.000' && avgKim(c => { c.bad = [false, true]; }) === '6.000');
  ok('the last lap of a driver who is not racing now is the last lap of the heats before him (Sam 8.000)', /8\.000/.test(show(Sx, 'lastlap', 'Sam')));
  // laps that do not count in the average are laps all the same
  const pri2 = priorOf(H).map(x => (x.p === 1 ? { ...x, valid: x.valid.slice(0, 3) } : x)), S3 = mkS(q3, { prior: pri2 }), O3 = T.overallState(S3);
  ok('the laps of a driver are the laps he drove, also when some of them do not count in the average (Sam drove 4 laps in the heats before, 3 of them count)', show(S3, 'lap', 'Sam') === '4' && T.orderValue('laps', carOf(O3, 'Sam'), O3, NOW) === 4 && strip(T.content({ type: 'leaderboard', opt: { countOver: 'all' } }, S3).html).includes('Sam 4'));
  // time with and without penalties of a driver who is not racing: what the heats before kept
  const S4 = mkS(q3, { heat: heatInfo({ before: [[0, 20500, 20000], [1, 27000, 26500], [2, 14000, 14000]] }) }), O4 = T.overallState(S4);
  ok('the total time of a driver who is not racing is what the heats before kept, with the penalties or without them as the widget says', show(S4, 'totaltime', 'Sam') === '27.000' && show(S4, 'totaltime', 'Sam', { penalties: 'without' }) === '26.500');
  ok('...ordering by total time counts the penalties (both choices of the order), for a driver who is not racing and for the car that finished', T.orderValue('totaltime', carOf(O4, 'Sam'), O4, NOW) === 27000 && T.orderValue('totaltimeall', carOf(O4, 'Sam'), O4, NOW) === 27000);
  const qf = heat3(); qf.cars.find(c => c.participant === 2).done = true; const Sf = mkS(qf), Of = T.overallState(Sf);
  ok('...a car on track is ordered by its total time only when it has finished, and not when it is also out', Number.isFinite(T.orderValue('totaltime', carOf(Of, 'Kim'), Of, NOW)) && (() => { qf.cars.find(c => c.participant === 2).retired = true; return T.orderValue('totaltime', carOf(Of, 'Kim'), Of, NOW) === null; })());
  // championship points
  const champ = { on: true, list: [10, 6, 3], done: new Map([['d0', 3], ['d1', 8], ['d2', 10], ['t1', 5]]) };
  const pts = (over, who, opt) => show(mkS(q3, { champ, ...over }), 'champpoints', who, opt);
  ok('Championship Points: the points of the heats that are done, and what the place in the heat that runs is worth now (Kim leads: 10 + 10, Alex second: 3 + 6; Sam is not racing: 8)', pts({}, 'Kim') === '20' && pts({}, 'Alex') === '9' && pts({}, 'Sam') === '8');
  ok('...the heat in its pause or its review counts as well, a heat that is over does not, and neither does "live" switched off', pts({ phase: 'review' }, 'Kim') === '20' && pts({ phase: 'paused' }, 'Kim') === '20' && pts({ phase: 'between' }, 'Kim') === '10' && pts({ phase: 'finished' }, 'Kim') === '10' && pts({}, 'Kim', { live: false }) === '10');
  ok('...a heat where nobody has driven a lap has no points yet', show(mkS(heatEngine(H), { champ }), 'champpoints', 'Kim') === '10');
  ok('...a driver who races as a team has the points of the team', pts({ roster: roster.map(r => (r.driverId === 'd2' ? { ...r, asTeam: true } : r)) }, 'Kim') === '15');
  const Op = T.overallState(mkS(q3, { champ }));
  ok('...and the board can be ordered by them (Order by points: Kim 20, Sam 8)', T.orderValue('champ', carOf(Op, 'Kim'), Op, NOW) === 20 && T.orderValue('champ', carOf(Op, 'Sam'), Op, NOW) === 8);
  // the gap
  const gapOf = more => T.overallState(mkS(q3, { heat: heatInfo(more) })).standings().map(x => x.gap).join('|');
  ok('the gap of a result in points is rounded (2.5 and 2.2: 0.3)', gapOf({ order: [[1, 2.5], [2, 2.2], [0, 0]], ovBy: 'points' }) === '|−0.3|−2.5');
  ok('...and a heat that does not say what the result counts counts laps', gapOf({ ovBy: undefined }) === '|+1 lap|+2 laps');
  // the colour of a row follows the state of the car on track (a driver who is not racing has none, and the leader is the leader of the overall result)
  const D2 = Rows.defaultDesign(), dS = { id: 'rs', ...D2, widgets: ['position', 'name'].map((t, i) => { const w = Wd.newWidget(t, 0, 10 + i * 100, 5); w.w = 95; w.h = 60; w.showTitle = false; return w; }) };
  const cls = fn => { const q = heat3(); fn(q); return (T.content({ type: 'leaderboard', opt: { design: 'rs', countOver: 'all' } }, mkS(q, { rowDesigns: [dS] })).html.match(/rrow-(?!bg)[a-z]+/g) || []).join(); };
  const kim = q => q.cars.find(c => c.participant === 2), alex = q => q.cars.find(c => c.participant === 0);
  ok('the rows are coloured by state: the leader of the overall result (Sam, who is not racing), and nothing for the others', cls(() => {}) === 'rrow-leader,rrow-plain,rrow-plain');
  ok('...a car that is out (retired, disqualified, out of fuel) is out, one in the pits is in the pits, one with a penalty to serve has the penalty colour', cls(q => { kim(q).retired = true; }) === 'rrow-leader,rrow-out,rrow-plain' && cls(q => { kim(q).dq = true; }) === 'rrow-leader,rrow-out,rrow-plain' && cls(q => { kim(q).outOfFuel = true; }) === 'rrow-leader,rrow-out,rrow-plain'
    && cls(q => { alex(q).blockAt = 3; }) === 'rrow-leader,rrow-plain,rrow-pit' && cls(q => { alex(q).pending = [{ kind: 'drivethrough' }]; }) === 'rrow-leader,rrow-plain,rrow-pen');
  // a row design in a race that is not a race of heats
  const dR = { id: 'rd2', ...D2, widgets: dS.widgets }, Snh = mkS(q3, { heat: null, rowDesigns: [dR] });
  ok('a row design that is set to count over all heats, in a race without heats, is the board as it was', T.content({ type: 'leaderboard', opt: { design: 'rd2', countOver: 'all' } }, Snh).html === T.content({ type: 'leaderboard', opt: { design: 'rd2' } }, Snh).html && strip(T.content({ type: 'leaderboard', opt: { design: 'rd2', countOver: 'all' } }, Snh).html).includes('Kim'));
  // the classic table: what a car on track has and a driver who is not on track has not
  const table = (S_, opt) => strip(T.content({ type: 'leaderboard', opt: { countOver: 'all', ...opt } }, S_).html);
  const fq = (() => { const q = E.createRace({ type: 'race', laps: 2, endRule: 'all', fuel: E.fuelConfig({ pitHold: 0 }, { tank: 10, perLap: 3, rate: 5, empty: 'retire' }), entries: H.entries().map(e => ({ ...e })) }); q.start(100000); finish(q, [[0, 4000]]); return q; })();
  const tf = table(mkS(fq), { colFuel: true, colCurrent: true, colLast: true });
  ok('the classic table with fuel, current lap and last lap: the car on track has them, a driver who is not on track has dashes', /Sam 4 5\.500 8\.000 – – /.test(tf) && /Kim 3 4\.000 4\.000 [\d.]+ [\d.]+ L/.test(tf));
  // Distance: the metres of the heats before, added to the metres of the car on track
  const dprior = f => priorOf(H).map(x => (x.p === 1 ? f(x) : x));
  ok('Distance of a driver who is not on track: a dash when he has not raced, a dash when his heats had no metres, the total when they had', show(mkS(q3, { prior: priorOf(H).filter(x => x.p !== 1) }), 'distance', 'Sam') === '–' && show(mkS(q3), 'distance', 'Sam') === '–' && /^25(\.0+)? m$/.test(show(mkS(q3, { prior: dprior(x => ({ ...x, dist: 25 })) }), 'distance', 'Sam')));
  // 1.68.0: what the rounds of a championship left behind (past) is added to what the heats left behind
  const pastS = { p: 1, laps: 5, best: 5000, valid: [5000, 5100], t0: 10500, t1: 10100, dist: 40 }, { dist: _d, ...pastNoDist } = pastS, noBefore = heatInfo({ before: H.spentBy().filter(x => x[0] !== 1) });
  ok('Total time of a driver who is not on track: the heats before and the rounds (26.500 + 10.500 with the penalties and the extra time of the rounds, 26.500 + 10.100 without), the heats alone when he took part in no round', show(mkS(q3, { past: [pastS] }), 'totaltime', 'Sam') === '37.000' && show(mkS(q3, { past: [pastS] }), 'totaltime', 'Sam', { penalties: 'without' }) === '36.600' && show(mkS(q3, { past: [] }), 'totaltime', 'Sam') === '26.500');
  ok('...a driver who raced in no heat yet but in the rounds has the time of the rounds, one who raced in neither has a dash', show(mkS(q3, { past: [pastS], heat: noBefore }), 'totaltime', 'Sam') === '10.500' && show(mkS(q3, { heat: noBefore }), 'totaltime', 'Sam') === '–');
  ok('Distance of a driver who is not on track adds up the heats and the rounds (25 m + 40 m), the rounds alone when he raced in no heat; a dash when the heats or the rounds have no metres', /^65(\.0+)? m$/.test(show(mkS(q3, { prior: dprior(x => ({ ...x, dist: 25 })), past: [pastS] }), 'distance', 'Sam')) && /^40(\.0+)? m$/.test(show(mkS(q3, { prior: priorOf(H).filter(x => x.p !== 1), past: [pastS] }), 'distance', 'Sam'))
    && show(mkS(q3, { prior: dprior(x => ({ ...x, dist: 25 })), past: [pastNoDist] }), 'distance', 'Sam') === '–' && show(mkS(q3, { prior: dprior(x => ({ ...x })), past: [pastS] }), 'distance', 'Sam') === '–');
  // the Tyre life column of the classic table: the car on track has its tyres, a driver who is not on track has a dash
  const TW = require('../renderer/tyrewear.js');
  const qt = (() => { const q = E.createRace({ type: 'race', laps: 2, endRule: 'all', tyrewear: TW.clean({}), entries: H.entries().map(e => ({ ...e, tyre: 'S' })) }); q.start(100000); finish(q, [[0, 4000]]); return q; })();
  const lbt = T.content({ type: 'leaderboard', opt: { countOver: 'all', colTyres: true } }, mkS(qt)).html;
  ok('the classic table with the Tyre life column: the two cars on track have their tyres, the driver who is not on track a dash (and nothing breaks)', (lbt.match(/class="lb-tyres"><span class="twcell/g) || []).length === 2 && (lbt.match(/class="lb-tyres">–</g) || []).length === 1);
}
// ---- the heat that runs, in a race that is compared by distance ----
{ const sc = { heatBy: 'time', resultByTime: 'lapstime', resultBy: 'laps', compareBy: 'distance' }, Hd = E.createHeatRace({ participants: people, schedule: sched, points: [], lanes: 2, finals: 'none', ...E.scoringOf(sc), resultBy: 'laps' });
  const q = E.createRace({ type: 'timed', duration: 1, entries: Hd.entries().map(e => ({ ...e })), compare: { by: 'distance', lanes: [{ lane: 0, length: 10 }, { lane: 1, length: 14 }] } }); q.start(0);
  [5000, 10000, 15000, 20000].forEach(t => q.cross(0, t)); [5000, 10000, 15000].forEach(t => q.cross(1, t)); // Alex: 4 laps of 10 m = 40 m; Sam: 3 laps of 14 m = 42 m
  const o = Hd.overall(Hd.preview(q));
  ok('in the first heat, while it runs, a race that is compared by distance puts the furthest driver first (Sam 42 m, 3 laps, before Alex 40 m, 4 laps)', o[0].driverName === 'Sam' && o[0].measure === 'distance' && o[1].driverName === 'Alex' && Hd.overall().every(x => x.measure === undefined)); }
// ---- what the engine tells the race screen: what is remembered, what the result counts, and when the order has to be made again ----
{ const car = { laps: [1234.5678, 2000.4, 3000], bad: [], invalid: [], pitLaps: [1], removed: [] }, a = E.memoStep(undefined, car, 12.5), snap = JSON.stringify(a), b = E.memoStep(a, { ...car, laps: [4000] }, NaN), c = E.memoStep(b, { ...car, laps: [5000] }, 7.5);
  ok('memoStep: a heat adds the lap times that count (not the pit lap), rounded to 3 decimals, and its metres', JSON.stringify(a) === JSON.stringify({ laps: [1234.568, 3000], dist: 12.5, dn: 1, n: 1 }));
  ok('...the next heat is added behind them, the previous step is not changed, and a heat without metres adds none and is counted as a heat', JSON.stringify(b) === JSON.stringify({ laps: [1234.568, 3000, 4000], dist: 12.5, dn: 1, n: 2 }) && JSON.stringify(a) === snap);
  ok('...a total of metres is only complete when every heat had metres (dn is n), a heat with metres adds them', c.dist === 20 && c.dn === 2 && c.n === 3 && a.dn === a.n && b.dn !== b.n); }
{ const mk = o => E.createHeatRace({ participants: people, schedule: sched, points: [10, 8], lanes: 2, finals: 'none', ...o });
  ok('what the overall result counts (H.kind): laps by default, points for heats scored by points, time for heats scored by time', mk({ resultBy: 'laps' }).kind([]) === 'laps' && mk({ resultBy: 'points' }).kind([]) === 'points' && mk({ resultBy: 'time', heatBy: 'laps' }).kind([]) === 'time');
  ok('...time goes before points, and metres only when the rows of the result are counted in metres', mk({ resultBy: 'time', heatBy: 'laps' }).kind([{ measure: 'distance' }]) === 'time' && mk({ resultBy: 'points' }).kind([{ measure: 'distance' }]) === 'points' && mk({ resultBy: 'laps' }).kind([{ measure: 'distance' }, {}]) === 'distance' && mk({ resultBy: 'laps' }).kind([{}, {}]) === 'laps' && mk({ resultBy: 'laps' }).kind() === 'laps'); }
{ const Ht = E.createHeatRace({ participants: people, schedule: sched, resultBy: 'time', heatBy: 'laps', points: [], lanes: 2, finals: 'none' }), q = heatEngine(Ht); finish(q, [[0, 5000, 11000], [1, 6000]]);
  const o = Ht.overall(Ht.preview(q));
  ok('heats scored by time: a car of the heat that runs counts when it has finished (Alex 11.000), not when it is still on its way (Sam has one lap and no time yet)', o.find(x => x.participant === 0).score === 11000 && o.find(x => x.participant === 1).laps === 0 && o.find(x => x.participant === 1).score === null);
  Ht.record(q);
  ok('...once the heat is recorded the car that did not finish counts with its laps as before (the rule is for the heat that runs only)', Ht.overall().find(x => x.participant === 1).laps === 1); }
{ const Hs = heatRace(), q = () => heatEngine(Hs), base = Hs.stamp(q());
  const changes = (name, fn) => { const x = q(); fn(x.cars[0]); return Hs.stamp(x) !== base; };
  ok('the stamp of a race that is racing changes with a lap, a finish, a time, a disqualification, a retirement and a penalty', changes('lap', c => c.laps.push(5000)) && changes('done', c => { c.done = true; }) && changes('total', c => { c.total = 5000; }) && changes('dq', c => { c.dq = true; }) && changes('retired', c => { c.retired = true; }) && changes('points', c => { c.points = 3; }));
  ok('...with what the Race Director corrects in the review (time, laps, points, removed and invalid laps, extra time)', changes('adjMs', c => { c.adjMs = 500; }) && changes('adjLaps', c => { c.adjLaps = 1; }) && changes('adjPoints', c => { c.adjPoints = 2; }) && changes('removed', c => { c.removed.push(0); }) && changes('invalid', c => { c.invalid.push(0); }) && changes('extraMs', c => { c.extraMs = 100; }));
  ok('...with the sector of a car and its order in the sector, and with the best lap', changes('sector', c => { c.sector = 2; }) && changes('secOrder', c => { c.secOrder = 1; }) && changes('best', c => { c.best = 1234; }));
  ok('...a car that is not changed has the same stamp, a race that is not racing has a stamp of its own, and a heat that is recorded changes it', Hs.stamp(q()) === base && Hs.stamp(null) === '0:-' && (() => { const x = q(); finish(x, [[0, 5000, 11000], [1, 6000, 13000]]); Hs.record(x); return Hs.stamp(null) === '1:-' && Hs.stamp(q()) !== base; })()); }

console.log(fails ? fails + ' BOARD ALL HEATS TESTS FAILED' : 'ALL BOARD ALL HEATS TESTS PASSED'); process.exit(fails ? 1 : 0);
