// 1.64.0: a race (or heat) limited by a time can compare its cars by the distance they drove (laps times the length of the lane) instead of by laps.
// The sums (distance.js), the race engine (a timed race whose cars are compared by distance), the heat rows, the setup field, the Home warning and the note under a saved result.
const Ds = require('../renderer/distance.js'), E = require('../renderer/engine.js'), En = require('../renderer/endurance.js'), St = require('../renderer/stats.js');
const schema = require('../schema.js');
let fails = 0; const ok = (m, c) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };

// ---- which races are compared by distance ----
const by = { compareBy: 'distance' };
ok('a race limited by a time, heats of a time and an Endurance Race of a time (or heat-based by a time) can be compared by distance (a setup as saved)',
  Ds.compareOn({ sessionType: 'race', raceBy: 'time', ...by }) && Ds.compareOn({ sessionType: 'heats', heatBy: 'time', ...by }) && Ds.compareOn({ sessionType: 'endurance', enduranceBy: 'time', ...by })
  && Ds.compareOn({ sessionType: 'endurance', enduranceBy: 'heats', heatBy: 'time', ...by }));
ok('...and so can the setup the race screen works with (a Timed race, also from a Race limited by a time and from an Endurance Race by time)',
  Ds.compareOn({ sessionType: 'timed', ...by }) && Ds.compareOn(En.effective({ sessionType: 'race', raceBy: 'time', ...by })) && Ds.compareOn(En.effective({ sessionType: 'endurance', enduranceBy: 'time', ...by }))
  && Ds.compareOn(En.effective({ sessionType: 'heats', heatBy: 'time', ...by })) && Ds.compareOn(En.effective({ sessionType: 'endurance', enduranceBy: 'heats', heatBy: 'time', ...by })));
ok('...not a race by laps or by a distance, heats by laps or a distance, qualifying, practice, or an Endurance Race by laps (a leftover choice means nothing)',
  !Ds.compareOn({ sessionType: 'race', raceBy: 'laps', ...by }) && !Ds.compareOn({ sessionType: 'race', ...by }) && !Ds.compareOn({ sessionType: 'race', raceBy: 'distance', ...by }) && !Ds.compareOn({ sessionType: 'heats', heatBy: 'laps', ...by })
  && !Ds.compareOn({ sessionType: 'heats', heatBy: 'distance', ...by }) && !Ds.compareOn({ sessionType: 'qualifying', ...by }) && !Ds.compareOn({ sessionType: 'practice', ...by }) && !Ds.compareOn({ sessionType: 'tokens', ...by })
  && !Ds.compareOn({ sessionType: 'endurance', enduranceBy: 'laps', ...by }) && !Ds.compareOn(En.effective({ sessionType: 'endurance', enduranceBy: 'laps', ...by })) && !Ds.compareOn(En.effective({ sessionType: 'endurance', enduranceBy: 'distance', ...by })));
ok('...and only when the setup says "distance" (laps, nothing, or something else is the way it was)', !Ds.compareOn({ sessionType: 'race', raceBy: 'time' }) && !Ds.compareOn({ sessionType: 'race', raceBy: 'time', compareBy: 'laps' })
  && !Ds.compareOn({ sessionType: 'race', raceBy: 'time', compareBy: 'rubbish' }) && !Ds.compareOn({ sessionType: 'timed' }) && !Ds.compareOn(null) && !Ds.compareOn(undefined) && !Ds.compareOn({}));
ok('a race by a distance is no time race: it has its own sums', !Ds.isOn({ sessionType: 'race', raceBy: 'time', ...by }) && Ds.timeLimited({ sessionType: 'race', raceBy: 'time' }) && !Ds.timeLimited({ sessionType: 'race', raceBy: 'laps' }) && !Ds.timeLimited(null));

// ---- the length of every lane ----
const track = { length: 12, lanes: 3, laneModifier: 'measured', laneLengths: '10, 12, 8' };
const tsetup = { sessionType: 'race', raceBy: 'time', duration: 0.5, ...by };
{ const c = Ds.compare(tsetup, track, 3);
  ok('the lanes of a race compared by distance: the length of every lane in metres, lane 1 first', c && c.by === 'distance' && c.lanes.length === 3 && c.lanes.map(l => l.length).join() === '10,12,8' && c.lanes.map(l => l.lane).join() === '0,1,2');
  ok('...nothing for a race compared by laps, and nothing for a race that is not limited by a time', Ds.compare({ ...tsetup, compareBy: 'laps' }, track, 3) === null && Ds.compare({ sessionType: 'race', raceBy: 'laps', ...by }, track, 3) === null && Ds.compare(null, track, 3) === null);
  ok('...a lane with no length has length 0 (the engine then compares by laps), also without a track; the lanes are at least one', Ds.compare(tsetup, { lanes: 2 }, 2).lanes.every(l => l.length === 0) && Ds.compare(tsetup, null, 2).lanes.length === 2 && Ds.compare(tsetup, track, 0).lanes.length === 1
    && Ds.compare(tsetup, { lanes: 3, laneModifier: 'measured', laneLengths: ', 12, 8' }, 3).lanes.map(l => l.length).join() === '0,12,8'); }

// ---- what stops a race compared by distance ----
ok('no problem for a track with the lane lengths, nor for a time race compared by laps, nor for any other race', Ds.problem(tsetup, track, 3) === '' && Ds.problem({ ...tsetup, compareBy: 'laps' }, { lanes: 2 }, 2) === '' && Ds.problem({ sessionType: 'race', raceBy: 'time' }, { lanes: 2 }, 2) === ''
  && Ds.problem({ sessionType: 'race', raceBy: 'laps', laps: 5 }, { lanes: 2 }, 2) === '');
ok('a track without a length: the distance cannot be worked out, and the sentence says "no length" (Home does not add the swap sentence to it), and where to add it', /no length/.test(Ds.problem(tsetup, { lanes: 2 }, 2)) && /track length in the Database/.test(Ds.problem(tsetup, { lanes: 2 }, 2)) && /compared by distance/.test(Ds.problem(tsetup, { lanes: 2 }, 2)));
ok('...a lane without a length is named (lane 1, or lanes 1 and 3)', /^The cars are compared by distance, so the lane lengths are needed\. Lane 1 has no length/.test(Ds.problem(tsetup, { lanes: 2, laneModifier: 'measured', laneLengths: ', 10' }, 2))
  && /Lanes 1, 3 have no length/.test(Ds.problem(tsetup, { lanes: 3, laneModifier: 'measured', laneLengths: ', 10' }, 3)) && /lane lengths in the Database/.test(Ds.problem(tsetup, { lanes: 2, laneModifier: 'measured', laneLengths: ', 10' }, 2)));
ok('...no track chosen yet: no sentence about the lanes (Home says the track is missing)', Ds.problem(tsetup, null, 2) === '' && Ds.compareProblem(tsetup, undefined, 2) === '');
ok('...a race by a distance keeps its own sentences', /no distance/.test(Ds.problem({ sessionType: 'race', raceBy: 'distance', distance: 0 }, track, 3)) && /no length/.test(Ds.problem({ sessionType: 'race', raceBy: 'distance', distance: 100 }, { lanes: 2 }, 2)));

// ---- the race engine ----
const people = [0, 1, 2].map(i => ({ lane: i, driverId: 'd' + i, carId: 'c' + i, driverName: ['Alex', 'Sam', 'Kim'][i], nickname: '', carName: 'car' }));
const cmp = lens => ({ by: 'distance', lanes: lens.map((length, lane) => ({ lane, length })) });
const mk = (over = {}, entries = people) => { const e = E.createRace({ type: 'timed', duration: 1, endRule: 'all', entries, ...over }); e.start(0); return e; };
const names = e => e.standings().map(r => r.car.driverName).join();
// laps a car drives: 5 s a lap for Alex (lane 1, 10 m), 4 s for Sam (lane 2, 12 m), 6 s for Kim (lane 3, 8 m); the minute is over at 60 s
const driveTo = (e, per, upTo) => { per.forEach((ms, i) => { for (let t = ms; t <= upTo; t += ms) e.cross(i, t); }); };
{ const lap = mk(), dis = mk({ compare: cmp([10, 12, 8]) });
  driveTo(lap, [5000, 6000, 4000], 30000); driveTo(dis, [5000, 6000, 4000], 30000);
  // 30 s: Alex 6 laps (60 m), Sam 5 laps (60 m), Kim 7 laps (56 m)
  ok('compared by laps (as before): the most laps first (Kim 7, Alex 6, Sam 5), and the engine says it does not compare by distance', names(lap) === 'Kim,Alex,Sam' && lap.compare === null && lap.distOf(lap.cars[0]) === null);
  ok('compared by distance: Kim in the short lane has the most laps but the shortest distance (56 m); Alex and Sam both drove 60 m in 30.0 s, so they are equal and go by lane order (Alex, Sam, Kim)', names(dis) === 'Alex,Sam,Kim');
  ok('...the distances are the laps times the length of the lane (60 m, 60 m, 56 m)', dis.distOf(dis.cars[0]) === 60 && dis.distOf(dis.cars[1]) === 60 && Math.abs(dis.distOf(dis.cars[2]) - 56) < 1e-9 && dis.compare.by === 'distance'); }
{ // the same distance: the shortest time decides (Alex 12 laps of 10 m = 120 m in 60.0 s, Sam 10 laps of 12 m = 120 m in 50.0 s)
  const e = mk({ compare: cmp([10, 12, 8]) }, people.slice(0, 2));
  for (let n = 1; n <= 12; n++) e.cross(0, n * 5000 - 100); for (let n = 1; n <= 10; n++) e.cross(1, n * 5000);
  ok('the same distance: the car with the shortest time wins (Sam 120 m in 50.0 s, Alex 120 m in 59.9 s)', names(e) === 'Sam,Alex' && e.distOf(e.cars[0]) === 120 && e.distOf(e.cars[1]) === 120 && e.standings()[1].gap.startsWith('+'));
  const f = mk({ compare: cmp([10, 12, 8]) }, people.slice(0, 2));
  for (let n = 1; n <= 12; n++) f.cross(0, n * 4000); for (let n = 1; n <= 10; n++) f.cross(1, n * 5000);
  ok('...and when the faster car is in the other lane it wins in the same way (Alex 120 m in 48 s, Sam 120 m in 50 s)', names(f) === 'Alex,Sam'); }
{ // the same distance with lengths that do not add up exactly: 5 laps of 8.2 m and 4 laps of 10.25 m are both 41 m
  const e = mk({ compare: cmp([8.2, 10.25, 8]) }, people.slice(0, 2));
  for (let n = 1; n <= 5; n++) e.cross(0, n * 6000); for (let n = 1; n <= 4; n++) e.cross(1, n * 5000);
  ok('the same distance to the millionth of a metre counts as the same (41 m in 30 s beats 41 m in 20 s, the time decides, not the last decimal)', e.distOf(e.cars[0]) === e.distOf(e.cars[1]) && names(e) === 'Sam,Alex'); }
{ // 3 laps of 8.7 m are 26.099999999999998 in floating point and 1 lap of 26.1 m is 26.1: the same distance
  const e = mk({ compare: cmp([8.7, 26.1, 8]) }, people.slice(0, 2));
  e.cross(0, 1000); e.cross(0, 2000); e.cross(0, 3000); e.cross(1, 5000);
  ok('...the last decimals of a multiplication do not decide (3 laps of 8.7 m and 1 lap of 26.1 m are the same 26.1 m: the car that was there first wins)', 8.7 * 3 !== 26.1 && e.distOf(e.cars[0]) === e.distOf(e.cars[1]) && names(e) === 'Alex,Sam'); }
{ // a lap more is a longer distance in the same lane
  const e = mk({ compare: cmp([10, 12, 8]) });
  e.cross(0, 5000); e.cross(1, 6000); e.cross(2, 4000); e.cross(2, 8000); e.cross(2, 12000);
  ok('in a lane of 8 m three laps (24 m) are more than one lap of 12 m (12 m) and one lap of 10 m', names(e) === 'Kim,Sam,Alex');
  e.cross(1, 12001); e.cross(0, 10000);
  ok('...a lap more moves a car up: Sam with 2 laps (24 m) equals Kim (24 m), and Kim was there 1 ms first; Alex has 20 m', names(e) === 'Kim,Sam,Alex');
  e.cross(1, 18000);
  ok('...and Sam with a third lap (36 m) passes Kim', names(e) === 'Sam,Kim,Alex'); }
{ // a car that is out ranks last, a disqualified car too
  const e = mk({ compare: cmp([10, 12, 8]) });
  driveTo(e, [5000, 6000, 4000], 20000);
  ok('before: Alex 4 laps (40 m) and Kim 5 laps (40 m) drove the same in the same time, Sam 3 laps (36 m)', names(e) === 'Alex,Kim,Sam');
  e.cars[0].retired = true; e.cars[0].done = true;
  ok('a car that retires goes to the back, whatever its distance', names(e) === 'Kim,Sam,Alex' && e.standings()[2].gap === 'Out');
  const q = mk({ compare: cmp([10, 12, 8]) }); driveTo(q, [5000, 6000, 4000], 20000); q.cars[0].dq = true; q.cars[0].retired = true; q.cars[0].done = true;
  ok('...a disqualified car too', names(q) === 'Kim,Sam,Alex' && q.standings()[2].gap === 'DQ'); }
{ // adjustments in the review: laps added to a car count with the length of its lane
  const e = mk({ compare: cmp([10, 12, 8]) }, people.slice(0, 2));
  e.cross(0, 5000); e.cross(0, 10000); e.cross(1, 6000);
  ok('before the adjustment: Alex 2 laps (20 m), Sam 1 lap (12 m)', names(e) === 'Alex,Sam');
  e.cars[1].adjLaps = 2;
  ok('two laps added to Sam in the review: 3 laps in a lane of 12 m (36 m) are in front of Alex (20 m), and the distance follows', names(e) === 'Sam,Alex' && e.distOf(e.cars[1]) === 36 && e.distOf(e.cars[0]) === 20); }
{ // a lane without a length: the cars are compared by laps, as before
  const e = mk({ compare: cmp([10, 0, 8]) });
  driveTo(e, [5000, 6000, 4000], 30000);
  ok('when one lane has no length the engine compares by laps (and says so: no compare), so a missing length never ranks a car at 0 m', e.compare === null && names(e) === 'Kim,Alex,Sam' && e.distOf(e.cars[0]) === null);
  const g = mk({ compare: { by: 'distance', lanes: [] } }), h = mk({ compare: { by: 'laps', lanes: [{ lane: 0, length: 10 }] } }), k = mk({ compare: { by: 'distance' } }), n = mk({ compare: null });
  ok('...nor does a compare without lanes, of another kind, or without anything', g.compare === null && h.compare === null && k.compare === null && n.compare === null); }
{ // only a timed race compares by distance
  const r = E.createRace({ type: 'race', laps: 5, endRule: 'all', compare: cmp([10, 12, 8]), entries: people }); r.start(0);
  const q = E.createRace({ type: 'qualifying', duration: 1, compare: cmp([10, 12, 8]), entries: people }); q.start(0);
  const p = E.createRace({ type: 'practice', compare: cmp([10, 12, 8]), entries: people }); p.start(0);
  ok('a race by laps, qualifying and practice ignore it (they have their own ways to rank)', r.compare === null && q.compare === null && p.compare === null && r.distOf(r.cars[0]) === null);
  const d = E.createRace({ type: 'race', laps: 0, endRule: 'all', distance: Ds.config({ sessionType: 'race', raceBy: 'distance', distance: 52 }, track, 3), compare: cmp([10, 12, 8]), entries: people }); d.start(0);
  ok('...a race by a distance has its own sums, so the other setting leaves it alone (its engine says it is a distance race, not a compared one)', d.distance !== null && d.compare === null); }
{ // the time still ends the race the way it did: every car finishes on its next crossing, and that lap counts
  const e = mk({ compare: cmp([10, 12, 8]), duration: 0.5 });
  driveTo(e, [5000, 4000, 6000], 25000);
  ok('before the time is up nobody is done', !e.timeUp && e.cars.every(c => !c.done));
  e.tick(30000);
  ok('when the time is up the race goes on until every car crosses the line (that lap counts)', e.timeUp === true && e.status === 'running');
  e.cross(0, 30000); e.cross(1, 32000); e.cross(2, 30000);
  ok('...and the race is over when the last car has crossed; the order is by distance (Sam 7 laps, 84 m; Alex 6 laps, 60 m; Kim 5 laps, 40 m)', e.status === 'finished' && names(e) === 'Sam,Alex,Kim' && e.cars.every(c => c.done) && e.distOf(e.cars[1]) === 84); }
{ // the gap to the leader is a time, worked out at the same distance
  const e = mk({ compare: cmp([10, 12, 8]) }, people.slice(0, 2));
  driveTo(e, [5000, 4000], 20000);
  const st = e.standings();
  // Sam leads with 5 laps (60 m); Alex has 4 laps (40 m) in 20.0 s, and Sam was at 40 m after 13.3 s: Alex is 6.7 s behind
  ok('the gap of the car behind is the time between the two at the same distance (Alex at 40 m after 20.0 s, Sam after 13.3 s: +6.7 s), and the leader has none', names(e) === 'Sam,Alex' && st[0].gap === '' && st[1].gap === '+' + E.fmtTime(20000 - 40000 / 3) && Math.abs(e.gapInfo()[st[1].index].lead - (20000 - 40000 / 3)) < 1); }

// ---- the heat rows ----
const heatOf = () => E.createHeatRace({ participants: people.map(p => ({ ...p })), schedule: [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }, { p: 2, lane: 2 }]], resultBy: 'laps', points: [], lanes: 3, finals: 'none' });
{ const H = heatOf();
  const e = mk({ compare: cmp([10, 12, 8]) }, H.entries().map(x => ({ ...x }))); driveTo(e, [5000, 6000, 4000], 30000);
  const res = H.record(e);
  ok('a heat compared by distance has the metres of every car in its row (Alex and Sam 60 m, Kim 56 m), in the order of the heat', res.rows.map(r => r.dist).join() === '60,60,56' && res.rows.every(r => Number.isFinite(r.dist)) && res.rows[2].participant === 2);
  const H2 = heatOf();
  const l = mk({}, H2.entries().map(x => ({ ...x }))); driveTo(l, [5000, 6000, 4000], 30000);
  ok('...a heat compared by laps has no distance in its rows', H2.record(l).rows.every(r => !('dist' in r))); }

// ---- the setup form ----
const F = schema.racesetups, field = k => F.fields.find(f => f.key === k);
const shown = (f, vals) => !f.showIf || f.showIf.some(c => Object.entries(c).every(([k, vs]) => vs.includes(vals[k] ?? '')));
const f = field('compareBy');
ok('the setting "Cars are compared by": laps (the standard) or distance, in the length folder', !!f && f.type === 'select' && f.default === 'laps' && f.group === 'length' && f.options.map(o => o[0]).join() === 'laps,distance' && f.label === 'Cars are compared by');
ok('...shown for a race limited by a time, heats of a time and an Endurance Race of a time (or heat-based by a time)', shown(f, { sessionType: 'race', raceBy: 'time' }) && shown(f, { sessionType: 'heats', heatBy: 'time' }) && shown(f, { sessionType: 'endurance', enduranceBy: 'time' })
  && shown(f, { sessionType: 'endurance', enduranceBy: 'heats', heatBy: 'time' }));
ok('...not for a race by laps or a distance, heats by laps or a distance, qualifying, practice, tokens, or an Endurance Race by laps', !shown(f, { sessionType: 'race', raceBy: 'laps' }) && !shown(f, { sessionType: 'race', raceBy: 'distance' }) && !shown(f, { sessionType: 'heats', heatBy: 'laps' })
  && !shown(f, { sessionType: 'heats', heatBy: 'distance' }) && !shown(f, { sessionType: 'qualifying' }) && !shown(f, { sessionType: 'practice' }) && !shown(f, { sessionType: 'tokens' }) && !shown(f, { sessionType: 'endurance', enduranceBy: 'laps' }));
{ const keys = F.fields.map(x => x.key);
  ok('...it follows the duration (the time first, then how the cars are compared), and comes before "The race ends"', keys.indexOf('compareBy') === keys.indexOf('duration') + 1 && keys.indexOf('compareBy') < keys.indexOf('endRule'));
  ok('the hint says how it works: the laps times the length of the lane, the lane lengths in the Database, and the time for the same distance', /length of the lane/.test(f.hint) && /Database/.test(f.hint) && /shortest time/.test(f.hint)); }

// ---- the note under a saved result ----
ok('a saved result compared by distance says so under its table (the furthest wins; the same distance: the shortest time); any other result says nothing', /furthest/.test(St.compareText({ compareBy: 'distance' })) && /shortest time/.test(St.compareText({ compareBy: 'distance' }))
  && St.compareText({ compareBy: 'laps' }) === '' && St.compareText({}) === '' && St.compareText(null) === '' && St.compareText(undefined) === '');

console.log(fails ? `${fails} COMPARE-BY-DISTANCE TESTS FAILED` : 'ALL COMPARE-BY-DISTANCE TESTS PASSED'); process.exit(fails ? 1 : 0);
