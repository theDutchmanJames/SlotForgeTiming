// 1.35.0: Distance Racing: a race driven for a distance. The sums (distance.js), the race engine (a lane drives the laps its length makes up), the widgets and the setup fields.
const Ds = require('../renderer/distance.js'), E = require('../renderer/engine.js'), Tm = require('../renderer/timing.js'), Wd = require('../renderer/widgets.js'), En = require('../renderer/endurance.js'), Ht = require('../renderer/heats.js'), Hs = require('../renderer/homestats.js');
const schema = require('../schema.js');
let fails = 0; const ok = (m, c) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const near = (a, b) => Math.abs(a - b) < 1e-6;

// ---- which races are limited by a distance ----
ok('a race, heats and an Endurance Race are limited by a distance when they say so (a setup as saved)', Ds.isOn({ sessionType: 'race', raceBy: 'distance' }) && Ds.isOn({ sessionType: 'heats', heatBy: 'distance' })
  && Ds.isOn({ sessionType: 'endurance', enduranceBy: 'distance' }) && Ds.isOn({ sessionType: 'endurance', enduranceBy: 'heats', heatBy: 'distance' }));
ok('...and are not when they count laps or time (a leftover "distance" of another kind of session means nothing)', !Ds.isOn({ sessionType: 'race' }) && !Ds.isOn({ sessionType: 'race', raceBy: 'laps' }) && !Ds.isOn({ sessionType: 'timed', raceBy: 'distance' })
  && !Ds.isOn({ sessionType: 'heats', heatBy: 'laps' }) && !Ds.isOn({ sessionType: 'endurance', enduranceBy: 'time', heatBy: 'distance' }) && !Ds.isOn({ sessionType: 'endurance', enduranceBy: 'laps', raceBy: 'distance' }) && !Ds.isOn(null) && !Ds.isOn(undefined));
ok('the setup the race screen works with: an Endurance Race by distance is a race by distance, and any other Endurance Race is not (a stale raceBy does not make it one)', Ds.isOn(En.effective({ sessionType: 'endurance', enduranceBy: 'distance' }))
  && En.effective({ sessionType: 'endurance', enduranceBy: 'distance' }).sessionType === 'race' && !Ds.isOn(En.effective({ sessionType: 'endurance', enduranceBy: 'laps', raceBy: 'distance' })) && !Ds.isOn(En.effective({ sessionType: 'endurance', enduranceBy: 'time', raceBy: 'distance' }))
  && Ds.isOn(En.effective({ sessionType: 'endurance', enduranceBy: 'heats', heatBy: 'distance' })));

// ---- laps for a distance ----
ok('laps for a distance: at least the distance (100 m on 10 m is 10 laps, on 10.5 m it is 10 laps = 105 m, on 9.9 m it is 11 laps)', Ds.lapsFor(100, 10) === 10 && Ds.lapsFor(100, 10.5) === 10 && Ds.lapsFor(100, 9.9) === 11 && Ds.lapsFor(100, 10, 'up') === 10);
ok('...a whole number of laps is not rounded up by the last decimals of a division (30 m on 3 m, 0.3 m on 0.1 m)', Ds.lapsFor(30, 3) === 10 && Ds.lapsFor(0.3, 0.1) === 3 && Ds.lapsFor(9.9, 3.3) === 3);
ok('...or the nearest lap (9.52 laps is 10, 9.4 laps is 9, half a lap goes up), and never less than one lap', Ds.lapsFor(100, 10.5, 'nearest') === 10 && Ds.lapsFor(94, 10, 'nearest') === 9 && Ds.lapsFor(95, 10, 'nearest') === 10 && Ds.lapsFor(2, 10, 'nearest') === 1 && Ds.lapsFor(2, 10) === 1);
ok('...no laps without a distance or a length', Ds.lapsFor(0, 10) === 0 && Ds.lapsFor(100, 0) === 0 && Ds.lapsFor('', 10) === 0 && Ds.lapsFor(100, null) === 0 && Ds.lapsFor(-5, 10) === 0);

// ---- the distance of every lane ----
const measured = { length: 10.5, lanes: 3, laneModifier: 'measured', laneLengths: '10, 10.25, 10.5' };
const same = Ds.config({ sessionType: 'race', raceBy: 'distance', distance: 100 }, measured, 3);
ok('the same distance: every lane is asked for it, and drives the laps its length makes up (10, 10 and 10 laps for 100 m)', same.mode === 'same' && same.lanes.length === 3 && same.lanes.every(l => l.asked === 100) && same.lanes.map(l => l.laps).join() === '10,10,10'
  && same.lanes.map(l => l.length).join() === '10,10.25,10.5' && near(same.lanes[1].distance, 102.5) && near(same.lanes[2].distance, 105) && same.max === 0 && same.round === 'up' && same.distance === 100);
const longer = Ds.config({ sessionType: 'race', raceBy: 'distance', distance: 130 }, measured, 3);
ok('...a shorter lane can drive more laps than a longer one (130 m on lanes of 10, 10.25 and 10.5 m: 13, 13 and 13 laps; 120 m: 12, 12 and 12; 125 m: 13, 13 and 12)', longer.lanes.map(l => l.laps).join() === '13,13,13' && Ds.config({ sessionType: 'race', raceBy: 'distance', distance: 120 }, measured, 3).lanes.map(l => l.laps).join() === '12,12,12'
  && Ds.config({ sessionType: 'race', raceBy: 'distance', distance: 125 }, measured, 3).lanes.map(l => l.laps).join() === '13,13,12');
const wide = { length: 20, lanes: 2, laneModifier: 'measured', laneLengths: '19, 20' };
ok('...lanes of 19 m and 20 m drive 6 laps (114 m) and 5 laps (100 m) for 100 m', Ds.config({ sessionType: 'race', raceBy: 'distance', distance: 100 }, wide, 2).lanes.map(l => l.laps).join() === '6,5');
const bigger = Ds.config({ sessionType: 'race', raceBy: 'distance', distance: 100 }, { length: 12, lanes: 2, laneModifier: 'measured', laneLengths: '11, 12' }, 2);
ok('...the lanes of 11 m and 12 m drive 10 and 9 laps for 100 m (110 m and 108 m)', bigger.lanes.map(l => l.laps).join() === '10,9' && near(bigger.lanes[0].distance, 110) && near(bigger.lanes[1].distance, 108));
const laps = Ds.config({ sessionType: 'race', raceBy: 'distance', distance: 100, distanceMode: 'laps' }, { length: 12, lanes: 2, laneModifier: 'measured', laneLengths: '11, 12' }, 2);
ok('the same number of laps: the laps the distance takes on the track length (9 laps of 12 m), the same in every lane, so the lanes drive 99 m and 108 m', laps.mode === 'laps' && laps.lanes.map(l => l.laps).join() === '9,9' && near(laps.lanes[0].distance, 99) && near(laps.lanes[1].distance, 108) && near(laps.lanes[0].asked, 99));
ok('...the track length is the outside lane (the one that was entered); a track without one uses its longest lane', Ds.reference({ length: 12, lanes: 2 }, 2) === 12 && Ds.reference({ lanes: 2, laneModifier: 'measured', laneLengths: '11, 12.5' }, 2) === 12.5 && Ds.reference({ lanes: 2 }, 2) === 0 && Ds.reference(null, 2) === 0);
const man = Ds.config({ sessionType: 'race', raceBy: 'distance', distance: 100, distanceMode: 'manual', laneDistances: '90, 120' }, { length: 10, lanes: 3, laneModifier: 'none' }, 3);
ok('a distance for each lane: lane 1 drives 90 m, lane 2 120 m, and a lane without one drives the distance of the race', man.mode === 'manual' && man.lanes.map(l => l.laps).join() === '9,12,10' && man.lanes.map(l => l.asked).join() === '90,120,100');
ok('...a distance list as numbers, and an empty or a nonsense place falls back to the race distance', Ds.config({ sessionType: 'race', raceBy: 'distance', distance: 50, distanceMode: 'manual', laneDistances: [30, null, 'x'] }, { length: 10, lanes: 3, laneModifier: 'none' }, 3).lanes.map(l => l.laps).join() === '3,5,5'
  && Ds.config({ sessionType: 'race', raceBy: 'distance', distance: 50, distanceMode: 'manual', laneDistances: '' }, { length: 10, lanes: 2, laneModifier: 'none' }, 2).lanes.map(l => l.laps).join() === '5,5');
ok('the nearest lap: 105 m on 10 m lanes is 11 laps up and 11 nearest (10.5 goes up), 104 m is 11 and 10; the lanes then drive a little less or more than asked', Ds.config({ sessionType: 'race', raceBy: 'distance', distance: 104, distanceRound: 'nearest' }, { length: 10, lanes: 1, laneModifier: 'none' }, 1).lanes[0].laps === 10
  && Ds.config({ sessionType: 'race', raceBy: 'distance', distance: 104 }, { length: 10, lanes: 1, laneModifier: 'none' }, 1).lanes[0].laps === 11 && Ds.config({ sessionType: 'race', raceBy: 'distance', distance: 104, distanceRound: 'nearest' }, { length: 10, lanes: 1, laneModifier: 'none' }, 1).round === 'nearest'
  && Ds.config({ sessionType: 'race', raceBy: 'distance', distance: 104, distanceRound: 'rubbish' }, { length: 10, lanes: 1, laneModifier: 'none' }, 1).round === 'up');
ok('a lane with no length cannot be worked out: no laps (the race has no limit for it), and the other lanes are fine', (() => { const c = Ds.config({ sessionType: 'race', raceBy: 'distance', distance: 100 }, { lanes: 2, laneModifier: 'measured', laneLengths: ', 10' }, 2); return c.lanes[0].laps === 0 && c.lanes[0].length === 0 && c.lanes[0].distance === 0 && c.lanes[1].laps === 10; })());
ok('the longest time: minutes as asked, 0 without one; nothing for a race that is not by distance', Ds.config({ sessionType: 'race', raceBy: 'distance', distance: 100, distanceMax: 12 }, measured, 3).max === 12 && same.max === 0 && Ds.config({ sessionType: 'race', laps: 10 }, measured, 3) === null);
ok('...a heat race and an Endurance Race are worked out in the same way', Ds.config({ sessionType: 'heats', heatBy: 'distance', distance: 100 }, measured, 3).lanes.length === 3 && Ds.config({ sessionType: 'race', raceBy: 'distance', distance: 100, ofType: 'endurance' }, measured, 3).lanes[0].laps === 10);
ok('laps of a lane: from the config, the nearest lane for a number that is too big, 0 without a config', Ds.lapsOfLane(man, 0) === 9 && Ds.lapsOfLane(man, 1) === 12 && Ds.lapsOfLane(man, 9) === 10 && Ds.lapsOfLane(null, 0) === 0 && Ds.lapsOfLane({}, 0) === 0);

// ---- what stops a distance race ----
const dist = { sessionType: 'race', raceBy: 'distance', distance: 100 };
ok('no problem for a track with lane lengths, nor for a race that is not by distance', Ds.problem(dist, measured, 3) === '' && Ds.problem({ sessionType: 'race', laps: 10 }, { lanes: 2 }, 2) === '' && Ds.problem(dist, null, 2) === '');
ok('a track without a length: the laps cannot be worked out (the same distance, the same laps)', /no length/.test(Ds.problem(dist, { lanes: 2 }, 2)) && /Database/.test(Ds.problem(dist, { lanes: 2 }, 2)) && /no length/.test(Ds.problem({ ...dist, distanceMode: 'laps' }, { lanes: 2 }, 2)));
ok('...a lane without a length is named (lane 1, or lanes 1 and 3)', /^Lane 1 has no length/.test(Ds.problem(dist, { lanes: 2, laneModifier: 'measured', laneLengths: ', 10' }, 2)) && /^Lanes 1, 3 have no length/.test(Ds.problem(dist, { lanes: 3, laneModifier: 'measured', laneLengths: ', 10,' }, 3)));
ok('...no distance: the setup has none', /no distance/.test(Ds.problem({ ...dist, distance: 0 }, measured, 3)) && /no distance/.test(Ds.problem({ ...dist, distance: '' }, measured, 3)) && /no distance/.test(Ds.problem({ sessionType: 'race', raceBy: 'distance' }, null, 3)));

// ---- the distance of a car ----
ok('the lap time to expect: the average of the last three laps that count, else the last lap; nothing without a lap', Ds.expectedLap([6000, 5000, 5200, 4800]) === 5000 && Ds.expectedLap([5000]) === 5000 && Ds.expectedLap([]) === null && Ds.expectedLap(undefined) === null
  && Ds.expectedLap([5000, 9000, 5200], [false, true, false]) === 5100 && Ds.expectedLap([9000], [true]) === 9000);
const lk = Ds.look(10, 4, 10, { lapMs: 5000, sinceMs: 2500 });
ok('exact: the laps times the length (4 laps of 10 m: 40 m); smooth: plus the part of the lap (half a lap: 45 m)', Ds.look(10, 4, 10, null).exact === 40 && Ds.look(10, 4, 10, null).driven === 40 && near(lk.driven, 45) && lk.exact === 40);
ok('...the target is the laps to drive times the length (100 m), what is left to the line, the laps left and how far the race is', lk.target === 100 && near(lk.left, 55) && lk.lapsLeft === 6 && lk.lapsTarget === 10 && near(lk.pct, 45));
ok('...the estimate never passes the next crossing (0.99 of a lap), and nothing is estimated for a car that is slower than expected', near(Ds.look(10, 4, 10, { lapMs: 5000, sinceMs: 99999 }).driven, 49.9) && Ds.look(10, 4, 10, { lapMs: 5000, sinceMs: 0 }).driven === 40 && Ds.look(10, 4, 10, { lapMs: 0, sinceMs: 100 }).driven === 40);
ok('...a car that has driven all its laps is exact (no estimate past the finish), and does not go over 100%', Ds.look(10, 10, 10, { lapMs: 5000, sinceMs: 2500 }).driven === 100 && Ds.look(10, 10, 10, { lapMs: 5000, sinceMs: 2500 }).left === 0 && Ds.look(10, 10, 10, null).pct === 100 && Ds.look(10, 12, 10, null).pct === 100 && Ds.look(10, 12, 10, null).left === 0);
ok('...a race with no limit has no target, nothing left and no percentage, but a distance driven', (() => { const l = Ds.look(10, 4, 0, { lapMs: 5000, sinceMs: 2500 }); return near(l.driven, 45) && l.target === 0 && l.left === null && l.lapsLeft === null && l.pct === null; })());
ok('...a lane with no length has no distance at all, but still the laps left', (() => { const l = Ds.look(0, 4, 10, null); return l.driven === null && l.exact === null && l.left === null && l.pct === null && l.lapsLeft === 6; })());

// ---- written ----
ok('a distance as it is shown: 84 m, one or two decimals, kilometres from 1000 m; feet and miles; a dash for nothing', Ds.text(84.3, 'm') === '84 m' && Ds.text(84.3, 'm', 1) === '84.3 m' && Ds.text(84.27, 'm', 2) === '84.27 m' && Ds.text(1234, 'm') === '1.23 km' && Ds.text(999.4, 'm') === '999 m'
  && Ds.text(30.48, 'ft') === '100 ft' && Ds.text(30.48, 'ft', 1) === '100.0 ft' && Ds.text(1609.344, 'ft') === '1.00 mi' && Ds.text(NaN, 'm') === '–' && Ds.text(undefined, 'm') === '–' && Ds.text(5, 'x') === '5 m' && Ds.text(5, 'm', 9) === '5.00 m');
ok('the length of a race in words, with what is special about it', Ds.lengthText({ distance: 100 }, 'm') === '100 m' && Ds.lengthText({ distance: 100, distanceMode: 'laps' }, 'm') === '100 m, the same laps in every lane' && Ds.lengthText({ distance: 100, distanceMode: 'manual' }, 'm') === '100 m (a distance for each lane)' && Ds.lengthText({ distance: 100 }, 'ft') === '328 ft');
ok('the unit of a widget: its own choice, else the setting of App Settings (feet only when it says so)', Ds.unitOf({ unit: 'ft' }, 'm') === 'ft' && Ds.unitOf({ unit: 'm' }, 'ft') === 'm' && Ds.unitOf({ unit: 'setting' }, 'ft') === 'ft' && Ds.unitOf({}, 'ft') === 'ft' && Ds.unitOf({}, 'm') === 'm' && Ds.unitOf(undefined, undefined) === 'm');
ok('smooth is the default; exact only when the widget says so', Ds.smoothOn({}) && Ds.smoothOn(undefined) && Ds.smoothOn({ update: 'smooth' }) && !Ds.smoothOn({ update: 'exact' }));

// ---- the race engine ----
const people = [0, 1, 2].map(i => ({ lane: i, driverId: 'd' + i, carId: 'c' + i, driverName: ['Alex', 'Sam', 'Kim'][i], nickname: '', carName: 'car' }));
const cfgFor = (setup, track, lanes) => Ds.config({ sessionType: 'race', raceBy: 'distance', ...setup }, track || measured, lanes || 3);
const mk = (setup, over = {}, entries = people) => { const e = E.createRace({ type: 'race', laps: 0, distance: cfgFor(setup), endRule: 'all', entries, ...over }); e.start(0); return e; };
// lane 1: 5 s a lap, lane 2: 5.2 s, lane 3: 5.5 s
const drive = (e, ms, upTo) => { for (let n = 1; n <= upTo; n++) ms.forEach((m, i) => { if (!e.cars[i].done) e.cross(i, Math.round(n * m)); }); };
{
  const e = mk({ distance: 52 }); // lanes of 10, 10.25 and 10.5 m: 6, 6 and 5 laps
  ok('the laps every lane has to drive come from its length (52 m: 6 laps on 10 m, 6 laps on 10.25 m, 5 laps on 10.5 m)', e.limitOf(e.cars[0]) === 6 && e.limitOf(e.cars[1]) === 6 && e.limitOf(e.cars[2]) === 5 && e.lapLimit === 6 && !!e.distance && e.distance.mode === 'same');
  drive(e, [5000, 5200, 5500], 6);
  ok('a car finishes when it has driven its own laps (lane 3 after 5 laps, the others after 6)', e.cars[2].laps.length === 5 && e.cars[0].laps.length === 6 && e.cars[1].laps.length === 6 && e.cars.every(c => c.done));
  ok('...the race is over when every car has finished, and the places go by who crossed first (lane 3 with 5 laps at 27.5 s, lane 1 at 30 s, lane 2 at 31.2 s)', e.status === 'finished' && e.endedBy === 'Every car finished' && e.cars[2].place === 1 && e.cars[0].place === 2 && e.cars[1].place === 3);
  ok('...and the standings are the same, with the gaps in time between the finishes', e.standings().map(r => r.car.driverName).join() === 'Kim,Alex,Sam' && e.standings()[1].gap === '+2.500' && e.standings()[2].gap === '+3.700');
  ok('a car that has driven its laps counts as finished by laps (and its time is the finish time), a car that has not does not', e.finishedLaps(e.cars[0]) && e.finishedLaps(e.cars[2]) && e.timeOf(e.cars[2]) === 27500);
}
{
  const e = mk({ distance: 52, }, { endRule: 'leader' });
  drive(e, [5000, 5200, 5500], 5);
  ok('when the lead car finishes the race ends (the first car to drive its distance): lane 3 after 5 laps', e.status === 'finished' && e.endedBy === 'The lead car finished' && e.cars[2].done && !e.cars[0].done);
  ok('...the cars that did not finish rank by the distance they drove, not by the laps (lane 1: 5 laps of 10 m = 50 m, lane 2: 5 laps of 10.25 m = 51.25 m is ahead of it)', e.standings().map(r => r.car.driverName).join() === 'Kim,Sam,Alex');
}
{
  const e = mk({ distance: 52 });
  [5000, 10000].forEach(t => e.cross(0, t)); [5200, 10400, 15600].forEach(t => e.cross(1, t)); [5500, 11000, 16500].forEach(t => e.cross(2, t));
  ok('while the race runs, the cars rank by the distance driven (lane 1: 2 laps = 20 m, lane 2: 3 laps = 30.75 m, lane 3: 3 laps = 31.5 m)', e.standings().map(r => r.car.driverName).join() === 'Kim,Sam,Alex');
  const g = e.standings().map(r => r.gap);
  // Sam has driven 30.75 m at 15.6 s. Kim drove 30.75 m after 2 laps (21 m) at 11 s and 9.75 m of the third lap (of 10.5 m): 11 + 9.75/10.5 * 5.5 = 16.107 s -> Sam is 0 s behind? no, Kim was there at 16.107, Sam at 15.6
  ok('...a gap is the time at the same distance, between the crossings of the line: Sam was at 30.75 m after 15.6 s, Kim after 16.107 s, so Sam is not behind Kim (0)', g[0] === '' && g[1] === '+0.000');
  // Alex has 2 laps = 20 m at 10 s. Kim was at 20 m after 10.5 m (5.5 s) + 9.5 m of lap 2 (5.5 * 9.5/10.5 = 4.976) = 10.476 s
  ok('...a car that is further behind: Alex drove 20 m in 10 s, Kim in 10.476 s, so Alex is not behind her at that distance either (0)', g[2] === '+0.000');
}
{
  // a leader that is slower per metre than the car behind: the gap is how long after the leader the car was at the same distance
  const e = mk({ distance: 60 }, {}, people.slice(0, 2));
  [6000, 12000].forEach(t => e.cross(0, t)); [5000, 10400, 15500].forEach(t => e.cross(1, t));
  const st = e.standings();
  ok('the car with the most distance leads, and the one behind it has the gap at ITS distance (Alex 2 laps = 20 m at 12 s; Sam was at 20 m after 10.25 + 9.75 m... at 10.4 + part of lap 3)', st[0].car.driverName === 'Sam' && st[1].car.driverName === 'Alex');
  // Sam at 20 m: 1 lap = 10.25 m at 5 s; 2 laps = 20.5 m at 10.4 s; 20 m is in lap 2: 5 + (20 - 10.25) / 10.25 * 5.4 = 5 + 5.1366 = 10.1366
  ok('...Alex is behind by 12 - 10.137 = 1.863 s', st[1].gap === '+1.863');
}
{
  const e = mk({ distance: 30 });
  ok('the gaps before anybody has crossed the line are empty (and nothing breaks)', e.standings().every(r => r.gap === ''));
  e.cross(1, 5000); const st = e.standings();
  ok('a car with a lap leads cars without one, and the others have no gap yet (they have not driven anything)', st[0].car.driverName === 'Sam' && st[1].gap === '' && st[2].gap === '');
}
{
  const e = mk({ distance: 52, distanceMax: 0.5 }); // half a minute at most; lanes of 10, 10.25 and 10.5 m: 6, 6 and 5 laps
  const times = [5000, 6000, 10000], at = []; times.forEach((m, i) => { for (let n = 1; n <= 6; n++) at.push([n * m, i]); }); at.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let timeUpBefore = null;
  at.forEach(([t, i]) => { if (e.status === 'finished' || e.cars[i].done) return; if (t >= 30000 && timeUpBefore === null) { e.tick(29999); timeUpBefore = e.timeUp; } e.cross(i, t); });
  ok('a longest time ends the race like the time of a timed race: the time is not up before, and after it every car finishes on its next crossing', timeUpBefore === false && e.timeUp === true && e.status === 'finished' && e.endedBy === 'Every car finished' && e.cars.every(c => c.done));
  ok('...lane 1 drove its 6 laps (60 m) in time, lane 2 finished on its 5th crossing (51.25 m), lane 3 on its 3rd (31.5 m): laps 6, 5 and 3', e.cars.map(c => c.laps.length).join() === '6,5,3');
  ok('...the car that reached its distance ranks first, and the others by the distance they drove (Sam 51.25 m, Kim 31.5 m)', e.standings().map(r => r.car.driverName).join() === 'Alex,Sam,Kim' && e.finishedLaps(e.cars[0]) && !e.finishedLaps(e.cars[1]) && !e.finishedLaps(e.cars[2]));
}
{
  const e = mk({ distance: 52, distanceMax: 0 });
  e.tick(10 * 3600 * 1000);
  ok('0 is no longest time: the race lasts until the distance is driven', e.timeUp === false && e.status === 'running');
}
{
  const e = mk({ distance: 52 }, {}, people.slice(0, 2));
  e.cross(0, 5000); e.cross(0, 10000); e.cross(1, 5200);
  ok('the estimate of the time a car needs for its laps uses its own laps to drive (lane 1: 6 laps at its average of 5 s)', e.estimateOf(e.cars[0]) === 10000 + 4 * 5000 && e.estimateOf(e.cars[1]) === 5200 + 5 * 5200);
}
{
  const e = mk({ distance: 52 }, { distance: null }, people);
  ok('without the distance settings the laps of the race are the limit of every lane, as they were', e.limitOf(e.cars[0]) === 0 && e.distance === null);
  const f = E.createRace({ type: 'race', laps: 4, distance: null, endRule: 'all', entries: people }); f.start(0);
  ok('...a race by laps: 4 laps for every car, and no distance mode', f.limitOf(f.cars[2]) === 4 && f.lapLimit === 4 && f.distance === null);
  const g = E.createRace({ type: 'timed', duration: 5, distance: cfgFor({ distance: 52 }), entries: people }); g.start(0);
  ok('...and a timed race ignores a distance it is given', g.limitOf(g.cars[0]) === 0 && g.distance === null);
}
{
  const e = mk({ distance: 52 }, {}, people.slice(0, 2));
  e.cross(0, 5000); e.cross(1, 5200); e.cross(0, 10000); e.cross(1, 10400);
  const gi = e.gapInfo();
  ok('the numbers for the spoken calls come from the distance too (Alex 2 laps = 20 m at 10 s; Sam 2 laps = 20.5 m at 10.4 s leads; Alex is behind him)', gi[1].pos === 1 && gi[1].lead === null && gi[0].pos === 2 && gi[0].lead !== null && gi[0].lead >= 0 && gi[0].ahead === gi[0].lead && gi[0].down === 0);
  e.cross(1, 15600); e.cross(1, 20800); e.cross(1, 26000);
  ok('...and how many full laps a car is behind: Sam 5 laps of 10.25 m = 51.25 m, Alex 2 laps of 10 m = 20 m: 3 laps behind', e.gapInfo()[0].down === 3);
}
{
  // a heat race starts a race for every heat with a lane per car; the lane is what decides the laps
  const heatLane = [{ lane: 2, driverId: 'd0', driverName: 'Alex', carName: 'c' }, { lane: 0, driverId: 'd1', driverName: 'Sam', carName: 'c' }];
  const e = mk({ distance: 52 }, {}, heatLane);
  ok('in a heat the lane of the car decides its laps (lane 3: 5 laps, lane 1: 6 laps)', e.limitOf(e.cars[0]) === 5 && e.limitOf(e.cars[1]) === 6);
}

// ---- the widgets ----
const trackM = { length: 10.5, lanes: 3, laneModifier: 'measured', laneLengths: '10, 10.25, 10.5' };
const mkS = (eng, now, over = {}) => { const st = eng.standings(); return { eng, now, phase: 'running', lights: 0, setup: { sessionType: 'race', raceBy: 'distance', distance: 52 }, heat: null, track: trackM, distUnit: 'm',
  carByLane: l => eng.cars.find(c => c.lane === l) || null, rowOf: c => st.find(r => r.car === c), flashOf: () => null, personalBest: () => Infinity, standings: () => st, ...over }; };
const W = (eng, now, type, lane, opt, over) => Tm.content({ type, lane, opt: opt || {} }, mkS(eng, now, over));
{
  const e = mk({ distance: 52 }); e.cross(0, 5000); e.cross(0, 10000); e.cross(0, 15000);
  ok('Distance Driven: the laps times the lane (3 laps of 10 m = 30 m) between the crossings estimated from the lap time (2.5 s into the lap: 35 m), or exact', W(e, 15000, 'distance', 0, { update: 'exact' }).html === '30 m' && W(e, 17500, 'distance', 0, { update: 'exact' }).html === '30 m' && W(e, 17500, 'distance', 0, {}).html === '35 m' && W(e, 17500, 'distance', 0, { update: 'smooth' }).html === '35 m');
  ok('...with decimals when the widget says so', W(e, 17000, 'distance', 0, { decimals: '1' }).html === '34.0 m' && W(e, 17000, 'distance', 0, { decimals: '2' }).html === '34.00 m');
  ok('...with the distance of the race (the laps to drive times the lane: 6 laps of 10 m = 60 m), or as a percentage of it', W(e, 17500, 'distance', 0, { show: 'both' }).html === '35 m of 60 m' && W(e, 17500, 'distance', 0, { show: 'percent' }).html === '58%' && W(e, 15000, 'distance', 0, { show: 'percent' }).html === '50%');
  ok('...in feet when the widget says so, or when App Settings do and the widget follows them', W(e, 15000, 'distance', 0, { unit: 'ft' }).html === '98 ft' && W(e, 15000, 'distance', 0, {}, { distUnit: 'ft' }).html === '98 ft' && W(e, 15000, 'distance', 0, { unit: 'm' }, { distUnit: 'ft' }).html === '30 m' && W(e, 15000, 'distance', 0, { unit: 'setting' }, { distUnit: 'ft' }).html === '98 ft');
  ok('...a lane with no car shows nothing, in all three widgets', W(e, 15000, 'distance', 5).html === '' && W(e, 15000, 'distleft', 5).html === '' && W(e, 15000, 'lapstogo', 5).html === '');
  ok('Distance To Go: what is left to the finish line (60 m - 30 m = 30 m; 25 m 2.5 s later), with "to go" when asked', W(e, 15000, 'distleft', 0, { update: 'exact' }).html === '30 m' && W(e, 17500, 'distleft', 0, {}).html === '25 m' && W(e, 15000, 'distleft', 0, { words: true }).html === '30 m to go' && W(e, 15000, 'distleft', 0, { words: false }).html === '30 m');
  ok('...in feet, with a decimal', W(e, 15000, 'distleft', 0, { unit: 'ft' }).html === '98 ft' && W(e, 15000, 'distleft', 0, { decimals: '1' }).html === '30.0 m');
  ok('Laps To Go: the laps left (3 of 6), in words or as a number; "Last lap" with one lap left; "Finished" when none is', W(e, 15000, 'lapstogo', 0, {}).html === '3 laps to go' && W(e, 15000, 'lapstogo', 0, { show: 'number' }).html === '3'
    && (() => { e.cross(0, 20000); e.cross(0, 25000); return W(e, 25000, 'lapstogo', 0, {}).html === 'Last lap' && W(e, 25000, 'lapstogo', 0, { lastLap: false }).html === '1 lap to go' && W(e, 25000, 'lapstogo', 0, { show: 'number' }).html === '1'; })()
    && (() => { e.cross(0, 30000); return W(e, 30000, 'lapstogo', 0, {}).html === 'Finished' && W(e, 30000, 'lapstogo', 0, { show: 'number' }).html === '0' && W(e, 30000, 'distleft', 0, {}).html === '0 m' && W(e, 33000, 'distance', 0, {}).html === '60 m' && W(e, 33000, 'distance', 0, { show: 'percent' }).html === '100%'; })());
  ok('...every lane has its own laps (lane 3 drives 5)', W(e, 15000, 'lapstogo', 2, { show: 'number' }).html === '5' && W(e, 15000, 'lapstogo', 1, { show: 'number' }).html === '6');
}
{
  const e = mk({ distance: 52 }); e.cross(0, 5000); e.cross(1, 5200);
  ok('Lap of Lap shows the laps of the lane (1/6 and 1/5)', W(e, 5300, 'lap', 0, {}).html === '2/6' && W(e, 5300, 'lap', 2, {}).html === '1/5');
  ok('Race Laps and Race Info follow the leader\'s lane (Sam, 6 laps: lap 2 of 6)', W(e, 5300, 'racelaps', 0, {}).html === '2/6' && W(e, 5300, 'racelaps', 0, { lapCount: 'down' }).html === '5' && W(e, 5300, 'info', 0, {}).html === '5 laps left');
  const t = (text, lane) => Tm.content({ type: 'textlane', lane, opt: { text } }, mkS(e, 7500, {})).html;
  ok('the custom text variables {distance}, {distleft} and {lapstogo} (smoothly: Alex is 2.5 s into lap 2 of 6)', t('{distance}|{distleft}|{lapstogo}', 0) === '15 m|45 m|5' && Wd.TEXT_LANE_VARS.some(v => v[0] === 'distance') && Wd.TEXT_LANE_VARS.some(v => v[0] === 'distleft') && Wd.TEXT_LANE_VARS.some(v => v[0] === 'lapstogo'));
  const r = Tm.content({ type: 'textrace', opt: { text: '{racedistance}|{lapsleft}/{lapstotal}' } }, mkS(e, 7500, {})).html;
  ok('...and {racedistance} for the race (52 m), with the laps of the leader\'s lane', r === '52 m|5/6' && Wd.TEXT_RACE_VARS.some(v => v[0] === 'racedistance'));
}
{
  // a race by laps and a timed race: Distance Driven works with the track, Distance To Go only when there are laps to drive
  const lapsRace = E.createRace({ type: 'race', laps: 6, endRule: 'all', entries: people }); lapsRace.start(0); lapsRace.cross(0, 5000); lapsRace.cross(0, 10000);
  const S = over => ({ ...mkS(lapsRace, 12500, { setup: { sessionType: 'race', laps: 6 } }), ...over });
  ok('in a race by laps the distance works from the laps and the lane length: 2 laps of 10 m, 2.5 s into the third lap = 25 m, 35 m to go of 60 m', Tm.content({ type: 'distance', lane: 0, opt: {} }, S()).html === '25 m' && Tm.content({ type: 'distleft', lane: 0, opt: {} }, S()).html === '35 m' && Tm.content({ type: 'lapstogo', lane: 0, opt: {} }, S()).html === '4 laps to go');
  const timed = E.createRace({ type: 'timed', duration: 5, entries: people }); timed.start(0); timed.cross(0, 5000);
  const S2 = { ...mkS(timed, 5000, { setup: { sessionType: 'timed', duration: 5 } }) };
  ok('in a timed race there is a distance driven, and nothing to go (a dash)', Tm.content({ type: 'distance', lane: 0, opt: {} }, S2).html === '10 m' && Tm.content({ type: 'distleft', lane: 0, opt: {} }, S2).html === '–' && Tm.content({ type: 'lapstogo', lane: 0, opt: {} }, S2).html === '–'
    && Tm.content({ type: 'distance', lane: 0, opt: { show: 'percent' } }, S2).html === '–');
  const noLen = { ...mkS(timed, 5000, { setup: { sessionType: 'timed', duration: 5 }, track: { lanes: 3 } }) };
  ok('a track without lane lengths shows a dash', Tm.content({ type: 'distance', lane: 0, opt: {} }, noLen).html === '–' && Tm.content({ type: 'distleft', lane: 0, opt: {} }, noLen).html === '–');
  const tv = Tm.content({ type: 'textlane', lane: 0, opt: { text: '{distance}|{distleft}|{lapstogo}' } }, noLen).html;
  ok('...and so do the text variables (a dash for the distance, the laps to go too when there is no limit)', tv === '–|–|–');
}
ok('the three widgets are in the folder Position and Progress, one per lane, with settings and a sample for the layout editor', ['distance', 'distleft', 'lapstogo'].every(k => { const d = Wd.REGISTRY.find(x => x.type === k); return d && d.group === 'Position and Progress' && d.perLane && d.options.length && typeof d.sample === 'function'; }));
ok('...their settings: what to show, smooth or exact, decimals and the unit; "to go"; words or number and "Last lap"', Wd.REGISTRY.find(x => x.type === 'distance').options.map(o => o.key).join() === 'show,update,decimals,unit' && Wd.REGISTRY.find(x => x.type === 'distleft').options.map(o => o.key).join() === 'update,decimals,unit,words'
  && Wd.REGISTRY.find(x => x.type === 'lapstogo').options.map(o => o.key).join() === 'show,lastLap');
ok('...and their samples follow the settings (84 m, 84 of 103 m, 81%, 19 m to go, 5 laps to go, 5, Last lap)', (() => { const s = (t, opt, l = 0) => Wd.REGISTRY.find(x => x.type === t).sample(l, { opt }); return s('distance', {}) === '84 m' && s('distance', { show: 'both' }) === '84 m of 103 m' && s('distance', { show: 'percent' }) === '82%' && s('distance', { decimals: '1' }) === '84.3 m'
  && s('distleft', { words: true }) === '19 m to go' && s('distleft', {}) === '19 m' && s('lapstogo', {}) === '5 laps to go' && s('lapstogo', { show: 'number' }) === '5' && s('lapstogo', {}, 4) === 'Last lap' && s('lapstogo', { lastLap: false }, 4) === '1 lap to go' && s('distance', { unit: 'ft' }) === '277 ft'; })());

// ---- the setup fields ----
const raceSchema = schema.racesetups, field = k => raceSchema.fields.find(f => f.key === k);
const shown = (f, vals) => !f.showIf || f.showIf.some(c => Object.entries(c).every(([k, vs]) => vs.includes(vals[k] ?? '')));
const fieldKeys = vals => raceSchema.fields.filter(f => shown(f, vals)).map(f => f.key);
ok('the race setup has the fields for a distance, in the Length and result group, all lengths in metres (typed in feet when App Settings say feet)', ['raceBy', 'distance', 'distanceMode', 'laneDistances', 'distanceRound', 'distanceMax', 'finalDistance'].every(k => field(k) && field(k).group === 'length')
  && field('distance').unit === 'm' && field('distance').labelFt && field('laneDistances').unit === 'm' && field('laneDistances').type === 'numberlist' && field('finalDistance').unit === 'm');
ok('a race: "limited by" is asked; with laps the laps are shown, with a distance the distance fields are', fieldKeys({ sessionType: 'race' }).includes('raceBy') && fieldKeys({ sessionType: 'race', raceBy: 'laps' }).includes('laps') && !fieldKeys({ sessionType: 'race', raceBy: 'laps' }).includes('distance')
  && fieldKeys({ sessionType: 'race' }).includes('laps') && !fieldKeys({ sessionType: 'race', raceBy: 'distance' }).includes('laps') && ['distance', 'distanceMode', 'distanceRound', 'distanceMax', 'endRule'].every(k => fieldKeys({ sessionType: 'race', raceBy: 'distance' }).includes(k)));
ok('...the distance of every lane only when the lanes get one each; the distances of a final only for heats with finals', !fieldKeys({ sessionType: 'race', raceBy: 'distance', distanceMode: 'same' }).includes('laneDistances') && fieldKeys({ sessionType: 'race', raceBy: 'distance', distanceMode: 'manual' }).includes('laneDistances')
  && !fieldKeys({ sessionType: 'race', raceBy: 'distance' }).includes('finalDistance') && fieldKeys({ sessionType: 'heats', heatBy: 'distance', finals: 'a' }).includes('finalDistance') && !fieldKeys({ sessionType: 'heats', heatBy: 'distance', finals: 'none' }).includes('finalDistance')
  && !fieldKeys({ sessionType: 'heats', heatBy: 'laps', finals: 'a' }).includes('finalDistance'));
ok('heats: the distance choice, with no laps and no duration; the other kinds of session have no distance', fieldKeys({ sessionType: 'heats', heatBy: 'distance' }).includes('distance') && !fieldKeys({ sessionType: 'heats', heatBy: 'distance' }).includes('laps') && !fieldKeys({ sessionType: 'heats', heatBy: 'distance' }).includes('duration')
  && field('heatBy').options.some(o => o[0] === 'distance') && ['timed', 'qualifying', 'practice', 'tokens'].every(t => !fieldKeys({ sessionType: t, raceBy: 'distance', heatBy: 'distance' }).includes('distance')));
ok('an Endurance Race: one long race of a set distance, or heat-based with heats by distance; its swap rules stay', field('enduranceBy').options.some(o => o[0] === 'distance') && fieldKeys({ sessionType: 'endurance', enduranceBy: 'distance' }).includes('distance') && !fieldKeys({ sessionType: 'endurance', enduranceBy: 'distance' }).includes('laps')
  && !fieldKeys({ sessionType: 'endurance', enduranceBy: 'distance' }).includes('duration') && fieldKeys({ sessionType: 'endurance', enduranceBy: 'distance', swapMode: 'every' }).includes('swapEvery') && fieldKeys({ sessionType: 'endurance', enduranceBy: 'heats', heatBy: 'distance' }).includes('distance')
  && !fieldKeys({ sessionType: 'endurance', enduranceBy: 'time' }).includes('distance') && fieldKeys({ sessionType: 'endurance', enduranceBy: 'laps' }).includes('laps') && fieldKeys({ sessionType: 'endurance', enduranceBy: 'distance' }).includes('endRule'));
ok('the default distance is 100 m; the kinds of lane distance and rounding', field('distance').default === 100 && field('distanceMode').options.map(o => o[0]).join() === 'same,laps,manual' && field('distanceRound').options.map(o => o[0]).join() === 'up,nearest' && field('distanceMax').default === 0 && field('raceBy').default === 'laps');
ok('the session type is called a race (1.62.0: limited by laps, a distance or a time), and the hint says what Distance does', field('sessionType').options.find(o => o[0] === 'race')[1] === 'Race' && /distance/i.test(field('raceBy').hint));

// ---- the words on Home and in the lists ----
ok('the heat plan says the distance of a heat (and of a final), in metres or feet', (() => { const st = { heats: 2, count: 4, lanes: 2, equal: true, maxHeats: 1, minHeats: 1 }; const line = unit => Ht.summary({ stats: st, setup: { heatBy: 'distance', distance: 100 }, names: [], unit })[0];
  return line('m') === '2 heats, each 100 m.' && line('ft') === '2 heats, each 328 ft.' && Ht.optionsOf({ heatBy: 'distance', distance: 100 }).by === 'distance' && Ht.optionsOf({ heatBy: 'distance', distance: 100 }).distance === 100; })());
ok('...the rules on Home say the length of the race', (() => { const r = s => (Hs.rules(s, { typeLabel: 'Race', distUnit: 'm' }).find(x => x[0] === 'Length') || [])[1];
  return r({ sessionType: 'race', raceBy: 'distance', distance: 100 }) === '100 m' && r({ sessionType: 'race', raceBy: 'distance', distance: 100, distanceMode: 'laps' }) === '100 m, the same laps in every lane' && r({ sessionType: 'race', laps: 12 }) === '12 laps'
    && r({ sessionType: 'heats', heatBy: 'distance', distance: 60, heats: 2 }) === '2 heats of 60 m' && r({ sessionType: 'endurance', enduranceBy: 'distance', distance: 500 }) === '500 m'; })());
ok('...in feet when the unit says feet', (Hs.rules({ sessionType: 'race', raceBy: 'distance', distance: 100 }, { typeLabel: 'Race', distUnit: 'ft' }).find(x => x[0] === 'Length') || [])[1] === '328 ft');

// ---- found by changing the code on purpose (mutation check): the corners ----
const An = require('../renderer/announcer.js');
ok('heats with a time or with nothing said are not limited by a distance (only heats by distance are)', !Ds.isOn({ sessionType: 'heats', heatBy: 'time', distance: 100 }) && !Ds.isOn({ sessionType: 'heats', distance: 100 }) && !Ds.isOn({ sessionType: 'endurance', enduranceBy: 'heats', heatBy: 'time' }));
{
  const odd = { length: 12, lanes: 2, laneModifier: 'measured', laneLengths: '11, 13' };
  ok('the track length is the length of the track when it is given, not the longest lane (12 m with lanes of 11 m and 13 m)', Ds.reference(odd, 2) === 12 && Ds.config({ sessionType: 'race', raceBy: 'distance', distance: 100, distanceMode: 'laps' }, odd, 2).lanes.map(l => l.laps).join() === '9,9');
}
{
  const c = Ds.config({ sessionType: 'race', raceBy: 'distance', distance: 100, distanceMode: 'laps' }, { lanes: 2, laneModifier: 'measured', laneLengths: ', 10' }, 2);
  ok('the same number of laps with a lane that has no length: that lane has no laps or distance of its own (the other lane has 10 laps)', c.lanes[0].length === 0 && c.lanes[0].laps === 0 && c.lanes[0].distance === 0 && c.lanes[0].asked === 0 && c.lanes[1].laps === 10 && c.lanes[1].distance === 100);
}
ok('the same number of laps is no problem on a track with a length, and is one without', Ds.problem({ ...dist, distanceMode: 'laps' }, measured, 3) === '' && /no length/.test(Ds.problem({ ...dist, distanceMode: 'laps' }, { lanes: 2 }, 2)));
ok('the laps left are never below 0, and the laps to drive are whole laps', Ds.look(10, 12, 10, null).lapsLeft === 0 && Ds.look(10, 12, 10, null).left === 0 && Ds.look(10, 1, 2.7, null).lapsTarget === 2 && Ds.look(10, 1, 2.7, null).target === 20);
ok('1000 m is a kilometre and 999 m is not', Ds.text(1000, 'm') === '1.00 km' && Ds.text(999, 'm') === '999 m' && Ds.text(999.4, 'm') === '999 m');
ok('the lap time to expect looks at the last three laps (not two)', near(Ds.expectedLap([6000, 5000, 5300, 4900]), 5066.6666667) && near(Ds.expectedLap([6000, 5300]), 5650));

{
  // a lane without a length: the race drives the laps of the other lanes for it
  const noLen = { lanes: 3, laneModifier: 'measured', laneLengths: '10, , 10.5' };
  const e = E.createRace({ type: 'race', laps: 0, distance: Ds.config({ sessionType: 'race', raceBy: 'distance', distance: 52 }, noLen, 3), endRule: 'all', entries: people }); e.start(0);
  ok('a lane without a length drives as many laps as the longest of the others (6), so the race does not go on for ever', e.limitOf(e.cars[0]) === 6 && e.limitOf(e.cars[1]) === 6 && e.limitOf(e.cars[2]) === 5);
}
{
  // a car that is disqualified does not count as having driven its distance
  const e = mk({ distance: 150, distanceMode: 'manual', laneDistances: '50' }, {}, [people[0], people[2]]); // lane 1: 5 laps (50 m), lane 3: 15 laps (150 m)
  for (let n = 1; n <= 5; n++) e.cross(0, n * 5000);
  for (let n = 1; n <= 12; n++) e.cross(1, n * 5000 + 100);
  const before = e.standings().map(r => r.car.driverName).join();
  e.cars[0].dq = true;
  ok('a car that has driven its distance ranks first; when it is disqualified the car with more distance driven goes ahead of it (Kim 126 m, Alex 50 m)', before === 'Alex,Kim' && e.standings().map(r => r.car.driverName).join() === 'Kim,Alex');
}
{
  // the cars that have reached their distance rank by their time including the penalties and the review
  const e = mk({ distance: 52 }, {}, people.slice(0, 2));
  drive(e, [5000, 5200], 6);
  const first = e.standings().map(r => r.car.driverName).join();
  e.adjust(0, { ms: 5000 });
  ok('finished cars rank by their time with the adjustment of the review: Alex finished first (30 s) but with 5 s added (35 s) Sam (31.2 s) is ahead', first === 'Alex,Sam' && e.standings().map(r => r.car.driverName).join() === 'Sam,Alex');
}
{
  // two finished cars: the gap is the difference of the finish times, also when the car behind drove a shorter distance than the car ahead
  const e = mk({ distance: 52 }, {}, people.slice(0, 2));
  drive(e, [5500, 5200], 6); // lane 1: 6 laps = 60 m at 33 s, lane 2: 6 laps = 61.5 m at 31.2 s
  const st = e.standings();
  ok('both cars finished: the gap is the difference of their finish times (33 - 31.2 = 1.8 s), not a time worked out for the shorter distance', st[0].car.driverName === 'Sam' && st[1].gap === '+1.800');
}
{
  // the gap to the car ahead is not the gap to the leader
  const e = mk({ distance: 90 });
  [7000, 14000, 21000].forEach(t => e.cross(0, t)); [6000, 12000, 18000].forEach(t => e.cross(1, t)); [5000, 10000, 15000].forEach(t => e.cross(2, t));
  const gi = e.gapInfo(), a = gi[0];
  ok('the numbers for the calls: the third car is behind the leader by more than it is behind the car ahead of it', e.standings().map(r => r.car.driverName).join() === 'Kim,Sam,Alex' && a.pos === 3 && a.lead > a.ahead && a.ahead > 0 && gi[1].pos === 2 && gi[1].lead === gi[1].ahead);
}
{
  // the time a car needs for the laps it has left is worked out with its own number of laps
  const e = mk({ distance: 52 });
  e.cross(2, 5500);
  ok('the estimate for the shortest lane (5 laps): 5.5 s a lap for 5 laps in total = 27.5 s', e.estimateOf(e.cars[2]) === 27500);
}
{
  // a race laps count with swaps: the laps taken away
  const e = mk({ distance: 52 }); [5000, 10000, 15000].forEach(t => e.cross(0, t));
  ok('Laps To Go counts the laps that count (a refused swap takes a lap away: 3 laps driven, 1 taken away, 4 to go)', W(e, 15000, 'lapstogo', 0, { show: 'number' }).html === '3' && (e.cars[0].swapLost = 1, W(e, 15000, 'lapstogo', 0, { show: 'number' }).html === '4'));
}
{
  // Race Laps follows the car that leads, whichever lane it is in (lane 3 has 5 laps, the others 6)
  const e = mk({ distance: 52 }); e.cross(2, 5500);
  ok('Race Laps shows the laps of the lane of the leader: lane 3 leads with 5 laps to drive (lap 2 of 5), not the laps of lane 1', W(e, 5600, 'racelaps', 0, {}).html === '2/5' && W(e, 5600, 'racelaps', 0, { lapCount: 'down' }).html === '4');
}
{
  // the spoken calls know the laps of every lane
  const e = mk({ distance: 52 }), a = An.create({ lapLimit: 0 }); a.observe(e, { phase: 'running', now: 0 });
  for (let n = 1; n <= 4; n++) e.cross(2, n * 5500);
  const ev = a.observe(e, { phase: 'running', now: 22000 }), names = ev.map(x => x.call);
  ok('"Last lap" is said for the car that starts its last lap (Kim on lane 3: lap 5 of 5), though the other lanes have 6 laps', names.includes('lastlap') && ev.find(x => x.call === 'lastlap').vars.driver === 'Kim');
  const e2 = mk({ distance: 52 }), a2 = An.create({ lapLimit: 0 }); a2.observe(e2, { phase: 'running', now: 0 });
  for (let n = 1; n <= 4; n++) e2.cross(0, n * 5000);
  ok('...and not for a car that has more laps to drive (Alex on lane 1 has driven 4 of 6)', !a2.observe(e2, { phase: 'running', now: 20000 }).some(x => x.call === 'lastlap'));
}
ok('the choice of how a race is limited is only asked for a race (not for heats, where heats have their own choice)', !fieldKeys({ sessionType: 'heats' }).includes('raceBy') && !fieldKeys({ sessionType: 'endurance', enduranceBy: 'distance' }).includes('raceBy') && fieldKeys({ sessionType: 'race' }).includes('raceBy'));
ok('the plan of the heats says the distance of a final when it has its own, and nothing when it is as long as a heat', (() => {
  const st = { heats: 2, count: 4, lanes: 2, equal: true, maxHeats: 1, minHeats: 1 }, text = f => Ht.summary({ stats: st, setup: { heatBy: 'distance', distance: 100, finals: 'a', finalDistance: f, heatPlan: 'manual' }, names: [], unit: 'm' }).join('|');
  return text(150).includes('A final is 150 m long.') && !text(0).includes('A final is'); })());

console.log(fails ? fails + ' DISTANCE TESTS FAILED' : 'ALL DISTANCE TESTS PASSED'); process.exit(fails ? 1 : 0);
