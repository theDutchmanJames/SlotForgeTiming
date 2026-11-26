'use strict';
// 2.5.0 Swap Seats: a heat race where every lane has its own car and the drivers move from car to car (renderer/heats/swapseats.js, schema.js heatCars,
// renderer/landing.js Lane cars, renderer/race.js seated, renderer/engine/heats.js the lane and car of every heat row, report.js and database/results.js).
const test = require('node:test'),
  assert = require('node:assert/strict');
const SS = require('../renderer/heats/swapseats.js');
const E = require('../renderer/engine.js');
const { code, has } = require('./source.cjs');

test('the setting: heats only, the cars stay on their lane', () => {
  assert.equal(SS.on({ sessionType: 'heats', heatCars: 'lanes' }), true);
  assert.equal(SS.on({ sessionType: 'heats', heatCars: 'driver' }), false);
  assert.equal(SS.on({ sessionType: 'heats' }), false, 'a heat race of before brings its own cars');
  assert.equal(SS.on({ sessionType: 'race', heatCars: 'lanes' }), false);
  const f = require('../schema.js').racesetups.fields.find(x => x.key === 'heatCars');
  assert.equal(f.default, 'driver');
  assert.deepEqual(
    f.options.map(o => o[1]),
    ['Every driver brings a car', 'Swap Seats']
  );
  assert.deepEqual(f.showIf, [{ sessionType: ['heats'] }]);
});

test('the cars of the lanes: one for each lane, gone cars dropped, a lane without a car and a car on two lanes stop the start', () => {
  assert.deepEqual(
    SS.laneIds(['a', 'gone', 'c'], 4, id => id !== 'gone'),
    ['a', '', 'c', '']
  );
  assert.deepEqual(SS.laneIds(null, 2), ['', '']);
  assert.deepEqual(SS.problems(['a', '', 'c', '']), ['Lanes 2, 4 need a car (Swap Seats).']);
  assert.deepEqual(SS.problems(['a', 'a']), ['A car is on two lanes. Every lane needs its own car.']);
  assert.deepEqual(SS.problems(['a', 'b']), []);
});

test('a heat keeps the lane and the car each driver drove, and the saved race tells how every car did', () => {
  const people = [0, 1, 2].map(i => ({ driverId: 'd' + i, driverName: ['Mila', 'James', 'Noor'][i], carId: '' }));
  const sched = [
    [
      { p: 0, lane: 0 },
      { p: 1, lane: 1 }
    ],
    [
      { p: 1, lane: 0 },
      { p: 2, lane: 1 }
    ]
  ];
  const H = E.createHeatRace({ participants: people, schedule: sched, resultBy: 'laps', points: [], lanes: 2, finals: 'none' });
  const laneCars = [
    { carId: 'c1', carName: 'NSR Mosler' },
    { carId: 'c2', carName: 'Slot.it Audi R8' }
  ];
  const seat = e => ({ ...e, ...laneCars[e.lane], seat: true }); // (as race.js seated does)
  const fake = (entries, best) => ({
    standings: () =>
      entries.map((e, i) => ({ pos: i + 1, car: { ...seat(e), laps: [1, 1, 1].slice(i), total: 9000, best: best[i], spentPen: 9000 } }))
  });
  assert.deepEqual(
    H.entries().map(e => seat(e).carName),
    ['NSR Mosler', 'Slot.it Audi R8']
  );
  H.record(fake(H.entries(), [5912, 6010]));
  H.record(fake(H.entries(), [5874, 6100]));
  const row = H.results[1].rows[0];
  assert.deepEqual([row.lane, row.carId, row.carName, row.driverName], [0, 'c1', 'NSR Mosler', 'James']);
  // a heat race of before has no lane car: its rows stay as they were
  const old = E.createHeatRace({ participants: people, schedule: sched, resultBy: 'laps', points: [], lanes: 2, finals: 'none' });
  old.record({ standings: () => old.entries().map((e, i) => ({ pos: i + 1, car: { ...e, laps: [1], total: 1, best: 1 } })) });
  assert.equal('carName' in old.results[0].rows[0], false);

  const session = { laneCars: SS.keep(laneCars), heatResults: H.results };
  assert.deepEqual(session.laneCars[1], { lane: 1, carId: 'c2', carName: 'Slot.it Audi R8' });
  assert.deepEqual(
    SS.cars(session).map(c => [c.carName, c.laps, c.best, c.by, c.drivers]),
    [
      ['NSR Mosler', 6, 5874, 'James', 2],
      ['Slot.it Audi R8', 4, 6010, 'James', 2]
    ]
  );
  assert.equal(SS.drivenText(session, 1), 'All 2 cars');
  assert.equal(SS.drivenText(session, 2), '1 of 2 cars (lane 2)');
  assert.equal(SS.drivenText({ heatResults: H.results }, 1), '', 'no lane cars, no words');
  assert.deepEqual(
    [...SS.carTimes(H.results)],
    [
      ['c1', 18000],
      ['c2', 18000]
    ]
  );
  const t = SS.carsTable(
    session,
    s => String(s).replace(/</g, '&lt;'),
    ms => (ms / 1000).toFixed(3)
  );
  assert(t.includes('<td>NSR Mosler</td><td>6</td><td>5.874 (James)</td><td>2</td>'));
});

test('Home, the race and the results are wired', () => {
  const home = code('renderer/landing.js');
  assert(has(home, "const seats = heats && typeof SwapSeats !== 'undefined' && SwapSeats.on(setup);"));
  assert(has(home, 'issues.push(...SwapSeats.problems(laneCarIds,')); // (audit 2026-11: with the lanes the heat plan uses)
  assert(has(home, 'laneCars: { ...(state.settings.laneCars || {}), [setupId]: next }'), 'the cars of the lanes are kept by race setup');
  assert(has(home, '...(seats ? { laneCars: laneCarIds } : {}),'), 'the race gets them');
  assert(has(home, 'const allowRival = !tokens && !withTeam && !endu && !seats && !solo;'), 'no virtual rivals');
  const race = code('renderer/race.js');
  assert(has(race, 'eng = mk(seated(heat.entries()));'));
  assert(has(race, 'if (laneCars) session.laneCars = SwapSeats.keep(laneCars);'));
  assert(has(race, '...(laneCars ? { laneCars: r.laneCars } : {}),'), 'an interrupted race keeps them');
  assert(
    has(race, 'api.paddockPrepare([...new Set(carRows.filter(x => !isRival(x)).map(x => x.carId))])'),
    'Paddock cars of the lanes are prepared'
  );
  assert(has(code('renderer/report.js'), 'SS.drivenText(session, x.participant)'));
  assert(has(code('renderer/database/results.js'), 'SwapSeats.drivenText(s, x.participant)'));
  const html = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'renderer', 'index.html'), 'utf8');
  assert(html.indexOf('heats/swapseats.js') > 0 && html.indexOf('heats/swapseats.js') < html.indexOf('"landing.js"'));
});
