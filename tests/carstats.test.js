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

// ---- 1.33.0: Services Done
ok('Services Done is the count that is kept (a whole number, never below 0)', C.servicesOf({ servicesDone: 3 }) === 3 && C.servicesOf({ servicesDone: '4' }) === 4 && C.servicesOf({ servicesDone: 2.9 }) === 2 && C.servicesOf({ servicesDone: -2 }) === 0 && C.servicesOf({ servicesDone: 0, serviceDate: '2026-03-01T12:00:00.000Z' }) === 0);
ok('...a car that was serviced before the count existed has had one service (its date tells), and a car never serviced none', C.servicesOf({ serviceDate: '2026-03-01T12:00:00.000Z' }) === 1 && C.servicesOf({ serviceDate: '2026-03-01T12:00:00.000Z', servicesDone: '' }) === 1 && C.servicesOf({}) === 0 && C.servicesOf({ serviceDate: '' }) === 0 && C.servicesOf({ serviceDate: 'nonsense' }) === 0 && C.servicesOf(null) === 0 && C.servicesOf(undefined) === 0);

// ---- 1.33.0: everything the Statistics folder works out from the laps, the sessions and the tracks
{ const T = [{ id: 't1', name: 'Oval', length: 20, lanes: 2, deslotTime: 3 }, { id: 't2', name: 'Bare', lanes: 2 }, { id: 't3', name: 'Short', length: 5, lanes: 1, deslotTime: 1.5 }];
  const S = [
    { id: 's1', sessionType: 'race', date: '2026-01-01T10:00:00Z', standings: [{ carId: 'c1', pos: 1, laps: 5 }, { carId: 'c2', pos: 2, laps: 5 }] },
    { id: 's2', sessionType: 'qualifying', date: '2026-01-02T10:00:00Z', standings: [{ carId: 'c1', pos: 1, laps: 3 }] },
    { id: 's3', sessionType: 'race', date: '2026-01-03T10:00:00Z', standings: [{ carId: 'c1', pos: 1, laps: 4, dq: true }] },
    { id: 's4', sessionType: 'race', date: '2026-01-04T10:00:00Z', standings: [{ carId: 'c1', pos: 2, laps: 4 }] },
    { id: 's5', sessionType: 'race', date: '2026-04-01T10:00:00Z', standings: [{ carId: 'c1', pos: 1, laps: 2 }] },
    { id: 's6', sessionType: 'tokens', date: '2026-04-02T10:00:00Z', standings: [{ carId: 'c1', pos: 1, laps: 2 }] }];
  const D = (carId, trackId, time, sessionId, extra) => ({ carId, trackId, time, sessionId, date: (S.find(x => x.id === sessionId) || {}).date, ...extra });
  const LL = [D('c1', 't1', 3000, 's1'), D('c1', 't1', 3500, 's1'), D('c1', 't1', 1000, 's1', { invalid: true }), D('c1', 't1', 9000, 's1', { pit: true }), D('c1', 't1', 4000, 's1'), D('c1', 't3', 2000, 's5'), D('c1', 't3', 1400, 's5'), D('c1', 't2', 6000, 's2'), D('c1', 't1', 0, 's1'), D('c1', 't1', 100, 's6', { token: true }), D('c2', 't1', 2500, 's1')];
  const serviced = { id: 'c1', serviceDate: '2026-03-01T12:00:00.000Z' }, d = C.details(serviced, LL, S, T);
  ok('the mileage of the car in the details is its mileage (4 laps of 20 m, 2 of 5 m and 1 on a track without a length: 7 laps, 90 m; the invalid, the zero-time and the token lap and the laps of another car left out)', d.mileage.laps === 7 && d.mileage.distance === 90 && d.mileage.distance === C.mileage(LL, T, 'c1').distance);
  ok('...the mileage since the last service counts the laps of the sessions after that day only (2 laps of 5 m: 10 m)', d.mileageSince.laps === 2 && d.mileageSince.distance === 10);
  ok('...a car that was never serviced has driven all of its mileage since the last service', (() => { const m = C.details({ id: 'c1' }, LL, S, T).mileageSince; return m.laps === 7 && m.distance === 90; })() && C.details({ id: 'c1', serviceDate: '' }, LL, S, T).mileageSince.laps === 7);
  ok('...a lap without a date takes the date of its session for that (before the service: left out; after it: counted)', (() => { const nd = LL.map(l => ({ ...l, date: undefined })); return C.details(serviced, nd, S, T).mileageSince.laps === 2 && C.details({ id: 'c1', serviceDate: '2026-04-01T10:00:00Z' }, nd, S, T).mileageSince.laps === 0 && C.details({ id: 'c1', serviceDate: '2026-02-01T10:00:00Z' }, nd, S, T).mileageSince.laps === 2; })());
  ok('Last Driven is the day of the latest lap of the car (a Time Token Session lap and the laps of another car do not count)', d.lastDriven === '2026-04-01T10:00:00.000Z' && C.details({ id: 'c2' }, LL, S, T).lastDriven === '2026-01-01T10:00:00.000Z');
  ok('...a lap without a date uses the date of its session, and a car without a lap has no day', C.details({ id: 'c1' }, LL.map(l => ({ ...l, date: undefined })), S, T).lastDriven === '2026-04-01T10:00:00.000Z' && C.details({ id: 'c9' }, LL, S, T).lastDriven === '' && C.details({ id: 'c1' }, [D('c1', 't1', 3000, 'x', { date: 'nonsense' })], S, T).lastDriven === '');
  ok('Sessions Driven are the different sessions the car has laps in (3: the race, the qualifying and the second race; the Time Token Session is not counted, nor a second lap in the same session)', d.sessions === 3 && C.details({ id: 'c2' }, LL, S, T).sessions === 1);
  ok('Wins are the races where the car came first (2: not the qualifying, the disqualified one, second place or the Time Token Session)', d.wins === 2 && C.details({ id: 'c2' }, LL, S, T).wins === 0);
  ok('...a retired car, a car with no laps and a practice or a qualifying do not win; a timed race, a heat race and an endurance race do', (() => { const w = type => C.details({ id: 'c1' }, [], [{ id: 'z', sessionType: type, standings: [{ carId: 'c1', pos: 1, laps: 3 }] }], T).wins; return w('timed') === 1 && w('heats') === 1 && w('endurance') === 1 && w('race') === 1 && w('practice') === 0 && w('qualifying') === 0 && C.details({ id: 'c1' }, [], [{ id: 'z', sessionType: 'race', standings: [{ carId: 'c1', pos: 1, laps: 3, retired: true }] }], T).wins === 0 && C.details({ id: 'c1' }, [], [{ id: 'z', sessionType: 'race', standings: [{ carId: 'c1', pos: 1, laps: 0 }] }], T).wins === 0; })());
  ok('Deslots are the laps slower than the deslot time of their track (3 here: 3.5 s and 4 s on the 3 s track and 2 s on the 1.5 s track; a lap exactly on the time, a pit stop lap and a track without a deslot time are not)', d.deslots === 3);
  ok('...a lap exactly as long as the deslot time is not a deslot, one millisecond more is', C.details({ id: 'c1' }, [D('c1', 't1', 3000, 's1')], S, T).deslots === 0 && C.details({ id: 'c1' }, [D('c1', 't1', 3001, 's1')], S, T).deslots === 1);
  ok('...a lap of another car or a Time Token Session is not a deslot of this car', C.details({ id: 'c2' }, LL, S, T).deslots === 0 && C.details({ id: 'c1' }, [D('c1', 't1', 99000, 's6', { token: true })], S, T).deslots === 0);
  ok('Fastest Lap Ever is the best valid lap on any track, with the track (1.400 s on Short; the 1.000 s lap is invalid and the 0.100 s lap is a token lap)', d.fastest.time === 1400 && d.fastest.trackId === 't3' && d.fastest.trackName === 'Short');
  ok('...a car with no valid lap has none', C.details({ id: 'c1' }, [D('c1', 't1', 1000, 's1', { invalid: true }), D('c1', 't1', 900, 's1', { pit: true })], S, T).fastest === null && C.details({ id: 'c9' }, LL, S, T).fastest === null);
  ok('...a lap that is too slow or late does not count for it', (() => { const r = C.details({ id: 'c1' }, [D('c1', 't1', 1000, 's1', { tooSlow: true }), D('c1', 't1', 1100, 's1', { late: true }), D('c1', 't1', 5000, 's1')], S, T); return r.fastest.time === 5000 && r.tracks[0].laps === 1; })());
  ok('The laps per track list the tracks with a valid lap, the track with the most laps first (Oval 3, Short 2, Bare 1)', d.tracks.map(t => t.name + ':' + t.laps).join() === 'Oval:3,Short:2,Bare:1');
  ok('...with the best lap and the average of the valid laps of each (Oval 3.000 and 3.500: the pit stop lap and the invalid lap are left out)', d.tracks[0].best === 3000 && d.tracks[0].avg === 3500 && d.tracks[1].best === 1400 && d.tracks[1].avg === 1700 && d.tracks[2].best === 6000 && d.tracks[2].avg === 6000 && d.tracks[0].trackId === 't1');
  ok('...tracks with as many laps are in the order of their names', C.details({ id: 'c1' }, [D('c1', 't3', 1000, 's5'), D('c1', 't1', 1000, 's5'), D('c1', 't2', 1000, 's5')], S, T).tracks.map(t => t.name).join() === 'Bare,Oval,Short');
  ok('...a track that is not in the database any more has no name but is still listed', (() => { const r = C.details({ id: 'c1' }, [D('c1', 'gone', 7000, 's1')], S, T); return r.tracks.length === 1 && r.tracks[0].name === '' && r.fastest.trackName === '' && r.fastest.time === 7000; })());
  ok('A lap that was saved without a session is not a session of its own (no session, so 0 sessions)', C.details({ id: 'c1' }, [D('c1', 't1', 3000, undefined), D('c1', 't1', 3100, '')], S, T).sessions === 0 && C.details({ id: 'c1' }, [D('c1', 't1', 3000, undefined), D('c1', 't1', 3100, 's1')], S, T).sessions === 1);
  ok('A new car, a car that is not known and lists that are missing have nothing: zeros, no day and no fastest lap', [C.details({}, [], [], []), C.details(undefined, undefined, undefined, undefined), C.details({ id: 'c9' }, LL, S, T)].every(r => r.mileage.laps === 0 && r.mileage.distance === 0 && r.mileageSince.laps === 0 && r.lastDriven === '' && r.sessions === 0 && r.wins === 0 && r.deslots === 0 && r.fastest === null && r.tracks.length === 0));
  ok('...a car without an id does not take the laps that have no car either', C.details({}, [D('', 't1', 3000, 's1'), D(undefined, 't1', 3000, 's1')], S, T).tracks.length === 0 && C.details({}, [D('', 't1', 3000, 's1')], S, T).sessions === 0);
}

// ---- 1.34.0: the cars for the Service Due card of Home
{ const cars = [{ id: 'a', brand: 'Audi', serviceInterval: 200, lapsSinceService: 200 }, { id: 'p', brand: 'Porsche', serviceInterval: 300, lapsSinceService: 342, picture: 'data:image/png;base64,P' }, { id: 'l', brand: 'Lola', serviceInterval: 300, lapsSinceService: 278 },
    { id: 'n', brand: 'Ninco', serviceInterval: 300, lapsSinceService: 270 }, { id: 'f', brand: 'Fresh', serviceInterval: 300, lapsSinceService: 100 }, { id: 'x', brand: 'NoInterval', lapsSinceService: 900 }, { id: 'z', serviceInterval: 100, lapsSinceService: 500 }, { id: 'b', brand: 'Bmw', serviceInterval: 300, lapsSinceService: 342 }, null];
  const name = c => c.brand || '', pic = c => c.picture || '', list = soon => C.dueList({ cars, name, picture: pic, soon });
  ok('the cars that are due first, the one with the most laps over first (Bmw and Porsche with 42 over, by name; then Audi, due now), then the cars coming up, the fewest laps to go first (Lola 22, Ninco 30)', list(10).map(r => r.name).join() === 'Bmw,Porsche,Audi,Lola,Ninco');
  ok('...with 10% of the interval: 22 laps to go of 300 is coming up, 30 to go is exactly 10% and is too, 100 to go is not', list(10).map(r => r.name).join() === 'Bmw,Porsche,Audi,Lola,Ninco' && !list(10).some(r => r.name === 'Fresh'));
  ok('...with 5% only the cars that are due (15 laps is the most to go): Lola with 22 to go is not coming up', list(5).map(r => r.name).join() === 'Bmw,Porsche,Audi');
  ok('...with 0 (Due only) the cars that are due, and nothing else; text, nothing or a negative percent is 0', list(0).map(r => r.name).join() === 'Bmw,Porsche,Audi' && list(undefined).length === 3 && list('abc').length === 3 && list(-20).length === 3 && C.dueList({ cars, name, picture: pic }).length === 3);
  ok('...a bigger percent lets more cars in (25%: 75 laps to go of 300; Fresh has 200 to go, so not yet; 70% lets it in)', list(25).length === 5 && list(70).map(r => r.name).join() === 'Bmw,Porsche,Audi,Lola,Ninco,Fresh');
  const r = Object.fromEntries(list(10).map(x => [x.name, x]));
  ok('...each car has its id, name, picture, interval, laps since, laps to go, laps over and whether it is due (a car coming up has 0 over)', r.Porsche.carId === 'p' && r.Porsche.picture === 'data:image/png;base64,P' && r.Porsche.interval === 300 && r.Porsche.since === 342 && r.Porsche.left === -42 && r.Porsche.over === 42 && r.Porsche.due === true
    && r.Audi.over === 0 && r.Audi.left === 0 && r.Audi.due === true && r.Lola.carId === 'l' && r.Lola.left === 22 && r.Lola.over === 0 && r.Lola.due === false && r.Lola.since === 278 && r.Lola.picture === '');
  ok('...a car without a service interval is never in it (900 laps and no interval), nor a car without a name, nor an empty place in the list', !list(100).some(x => x.carId === 'x' || x.carId === 'z') && list(100).length === 6);
  ok('...nothing at all, no cars or no way to name them: an empty list, not a crash', C.dueList().length === 0 && C.dueList({}).length === 0 && C.dueList({ cars: [] }).length === 0 && C.dueList({ cars, soon: 10 }).length === 0 && C.dueList({ cars: [{ id: 'a', serviceInterval: 5, lapsSinceService: 9 }], name: () => '' }).length === 0);
  ok('...a car that was never counted since a service has all its laps driven since it', C.dueList({ cars: [{ id: 'o', brand: 'Old', serviceInterval: 50, lapsDriven: 80 }], name }).map(x => x.since + ':' + x.over).join() === '80:30');
  ok('...a tie goes by name, a car that is due always before one that is coming up', C.dueList({ cars: [{ id: '1', brand: 'Zed', serviceInterval: 10, lapsSinceService: 10 }, { id: '2', brand: 'Abe', serviceInterval: 10, lapsSinceService: 10 }, { id: '3', brand: 'Mid', serviceInterval: 100, lapsSinceService: 99 }], name, soon: 10 }).map(x => x.name).join() === 'Abe,Zed,Mid');
}

console.log(fails ? fails + ' CAR STATISTICS TESTS FAILED' : 'ALL CAR STATISTICS TESTS PASSED'); process.exit(fails ? 1 : 0);
