// 1.30.0: the statistics of a slotcar (carstats.js): the service interval, the laps since the last service, which laps count for it, the words, and the mileage of one car.
const C = require('../renderer/carstats.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };

// ---- Laps Driven and Laps Since Last Interval
ok('Laps Driven is the whole number the database keeps (nothing, text, a negative number or a fraction is tidied)', C.lapsDriven({ lapsDriven: 12 }) === 12 && C.lapsDriven({}) === 0 && C.lapsDriven(null) === 0 && C.lapsDriven({ lapsDriven: 'x' }) === 0 && C.lapsDriven({ lapsDriven: -4 }) === 0 && C.lapsDriven({ lapsDriven: 7.9 }) === 7);
ok('Laps Since Last Interval is what the database keeps', C.sinceOf({ lapsDriven: 50, lapsSinceService: 12 }) === 12 && C.sinceOf({ lapsDriven: 50, lapsSinceService: 0 }) === 0);
ok('...a car from before it was counted has had no service: every lap it has driven', C.sinceOf({ lapsDriven: 50 }) === 50 && C.sinceOf({ lapsDriven: 50, lapsSinceService: '' }) === 50 && C.sinceOf({ lapsDriven: 50, lapsSinceService: null }) === 50 && C.sinceOf({ lapsDriven: 50, lapsSinceService: 'x' }) === 50 && C.sinceOf({}) === 0 && C.sinceOf(null) === 0);
ok('...never below 0', C.sinceOf({ lapsDriven: 50, lapsSinceService: -3 }) === 0);

// ---- the service interval
ok('the service interval is a number of laps; empty, 0, a negative number or text means none', C.intervalOf({ serviceInterval: 300 }) === 300 && C.intervalOf({ serviceInterval: '250' }) === 250 && C.intervalOf({ serviceInterval: 99.9 }) === 99
  && [{}, null, { serviceInterval: '' }, { serviceInterval: 0 }, { serviceInterval: -5 }, { serviceInterval: 'abc' }, { serviceInterval: null }, { serviceInterval: 0.5 }].every(c => C.intervalOf(c) === 0));
{ const s = C.status({ serviceInterval: 300, lapsSinceService: 120 });
  ok('the status: the interval, the laps since, the laps to go, and not due yet', s.interval === 300 && s.since === 120 && s.left === 180 && s.due === false); }
{ const s = C.status({ serviceInterval: 300, lapsSinceService: 300 });
  ok('...due when the laps since the last service reach the interval (exactly 300 of 300 is due)', s.due === true && s.left === 0); }
{ const s = C.status({ serviceInterval: 300, lapsSinceService: 299 }); ok('...299 of 300 is not due yet', s.due === false && s.left === 1); }
{ const s = C.status({ serviceInterval: 300, lapsSinceService: 312 }); ok('...past it: due, and the laps to go are negative', s.due === true && s.left === -12); }
{ const s = C.status({ lapsSinceService: 5000 }); ok('without an interval nothing is ever due, and there are no laps to go', s.interval === 0 && s.due === false && s.left === null && s.since === 5000); }
{ const s = C.status({ serviceInterval: 300, lapsSinceService: 312 }, 0); ok('the laps since can be given by hand (the form after Reset says 0)', s.since === 0 && s.due === false && s.left === 300); }
{ const s = C.status({ serviceInterval: '40' }, '7'); ok('...as text from the form too, and a value that is not a number is 0', s.since === 7 && s.left === 33 && C.status({ serviceInterval: 5 }, 'x').since === 0 && C.status({ serviceInterval: 5 }, -3).since === 0); }
{ const s = C.status({ serviceInterval: 300, lapsDriven: 80 }); ok('a car that was never counted since a service: all its laps count', s.since === 80 && s.left === 220); }

// ---- the words
ok('the words: no interval', C.note(C.status({ lapsDriven: 5 })) === 'No service interval is set.');
ok('...laps to go', C.note(C.status({ serviceInterval: 300, lapsSinceService: 120 })) === '180 laps to go until the next service (the interval is 300 laps).');
ok('...one lap to go and an interval of one lap say lap, not laps', C.note(C.status({ serviceInterval: 1, lapsSinceService: 0 })) === '1 lap to go until the next service (the interval is 1 lap).');
ok('...due, exactly', C.note(C.status({ serviceInterval: 300, lapsSinceService: 300 })) === 'Service due: 300 laps since the last service, the interval is 300 laps.');
ok('...due and over', C.note(C.status({ serviceInterval: 300, lapsSinceService: 312 })) === 'Service due: 312 laps since the last service, the interval is 300 laps (12 laps over).');
ok('...one lap over', C.note(C.status({ serviceInterval: 300, lapsSinceService: 301 })).endsWith('(1 lap over).'));
ok('...big numbers have a thousands separator', C.note(C.status({ serviceInterval: 12000, lapsSinceService: 1000 })) === '11,000 laps to go until the next service (the interval is 12,000 laps).');

// ---- which laps count since the last service
const car = { serviceDate: '2026-03-01T12:00:00.000Z' };
ok('a car that was never serviced counts every lap', C.afterService({}, { date: '2020-01-01T00:00:00Z' }) === true && C.afterService({ serviceDate: '' }, { date: '2020-01-01T00:00:00Z' }) === true && C.afterService(null, {}) === true && C.afterService({ serviceDate: 'nonsense' }, { date: '2020-01-01T00:00:00Z' }) === true);
ok('a lap of a session saved after the service counts', C.afterService(car, { date: '2026-03-01T12:00:00.001Z' }) === true && C.afterService(car, { date: '2026-04-01T00:00:00Z' }) === true);
ok('a lap from before the service does not, and neither does one from that very moment', C.afterService(car, { date: '2026-02-28T23:59:59Z' }) === false && C.afterService(car, { date: '2026-03-01T12:00:00.000Z' }) === false);
ok('a lap without a date is not known to be older, so it counts, unless the session has a date to use', C.afterService(car, {}) === true && C.afterService(car, {}, '2026-01-01T00:00:00Z') === false && C.afterService(car, {}, '2026-05-01T00:00:00Z') === true && C.afterService(car, { date: '2026-05-01T00:00:00Z' }, '2020-01-01T00:00:00Z') === true && C.afterService(car, { date: '2020-01-01T00:00:00Z' }, '2026-05-01T00:00:00Z') === false);

// ---- the mileage, as the Car Mileage card of Home works it out
const tracks = [{ id: 't1', length: 20, lanes: 2 }, { id: 't2', lanes: 2 }, { id: 't3', length: 5, lanes: 1 }];
const L = (carId, trackId, extra) => ({ carId, trackId, time: 10, date: '2026-01-01T10:00:00Z', ...extra });
const laps = [L('c1', 't1'), L('c1', 't1'), L('c2', 't1'), L('c1', 't2'), L('c1', 't3'), L('c1', 't1', { invalid: true }), L('c1', 't1', { tooSlow: true }), L('c1', 't1', { late: true }), L('c1', 't1', { token: true }), L('c1', 't1', { time: 0 }), L('', 't1'), null];
{ const m = C.mileage(laps, tracks, 'c1');
  ok('the mileage of a car: its laps that count times the track length (2 laps of 20 m and 1 of 5 m: 45 m), the laps of other cars, a track without a length and the laps that do not count left out', m.distance === 45 && m.laps === 4); }
ok('...a car with no lap that counts has driven 0', C.mileage(laps, tracks, 'c9').distance === 0 && C.mileage(laps, tracks, 'c9').laps === 0 && C.mileage([], tracks, 'c1').distance === 0 && C.mileage(undefined, undefined, 'c1').distance === 0 && C.mileage(laps, tracks, '').distance === 0 && C.mileage(laps, tracks, undefined).distance === 0);
ok('...laps on tracks without any length: the distance is not known (null)', C.mileage([L('c1', 't2')], tracks, 'c1').distance === null && C.mileage([L('c1', 't2')], tracks, 'c1').laps === 1 && C.mileage([L('c1', 't1')], [], 'c1').distance === null);
ok('...it works from the lane of a lap too (the outside lane is longer when the track says so)', (() => { const t = [{ id: 'x', length: 20, lanes: 2, laneModifier: 'measured', laneLengths: '19, 21' }]; return C.mileage([L('c1', 'x', { lane: 1 }), L('c1', 'x', { lane: 2 })], t, 'c1').distance === 40; })());
ok('...the same as the Car Mileage card gives for that car', (() => { const H = require('../renderer/homestats.js'); const card = H.mileage({ laps, tracks, carName: () => 'x' }); const row = card.find(r => r.carId === 'c1'); const mine = C.mileage(laps, tracks, 'c1'); return row.distance === mine.distance && row.laps === mine.laps; })());

console.log(fails ? fails + ' CAR STATISTICS TESTS FAILED' : 'ALL CAR STATISTICS TESTS PASSED'); process.exit(fails ? 1 : 0);
