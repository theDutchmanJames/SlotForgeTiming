// 1.9.0: the Endurance Race in the race engine: the cars that swap drivers, the swap that is due (the call, the penalty, the laps that stop counting), the swap by the sensor
// and by the button, who steps in, the driver at the wheel, the stints, the end of the race (the shortest total), and what a screen is told.
const RE = require('../renderer/engine.js'), En = require('../renderer/endurance.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const MIN = 60000;
const roster = [{ id: 'a', name: 'Alex', nickname: 'Speedy', callsign: 'Alpha', flag: 'NL', avatar: 'av-a' }, { id: 'b', name: 'Bea' }, { id: 'c', name: 'Cy', flag: 'DE' }];
const entry = (lane, over) => ({ lane, driverId: 'a', driverName: 'Alex', carId: 'car' + lane, teamId: 'T1', teamName: 'Red Bulls', roster, ...over });
const mk = (setup, o = {}) => RE.createRace({ type: o.type || 'timed', duration: o.duration === undefined ? 600 : o.duration, laps: o.laps || 0, endurance: setup === null ? undefined : En.clean({ sessionType: 'endurance', ...setup }),
  penalty: o.penalty === false ? undefined : RE.penaltyConfig({ everyPoints: 5, everySeconds: 5 }), entries: o.entries || [entry(0)], rnd: o.rnd, minLap: 800 });
// the car drives laps of 'lapMs' from 'from' until 'to' (a crossing at every multiple of the lap time that lies in between)
const drive = (R, i, from, to, lapMs = 30000) => { for (let t = from + lapMs; t <= to; t += lapMs) R.cross(i, t); };
const types = (R, ty) => R.events.filter(e => e.type === ty);

// ---- which cars swap ----
{ const R = mk({}, { entries: [entry(0), entry(1, { roster: [roster[0]] }), entry(2, { roster: undefined })] });
  ok('a car with a roster of two drivers or more swaps; a car with one driver, or without a roster, does not', R.cars[0].en !== null && R.cars[1].en === null && R.cars[2].en === null && R.endurance && R.endurance.on === true);
  ok('...the state of a car that swaps starts with the driver of the entry in a stint from the start', R.cars[0].en.d === 'a' && R.cars[0].en.stints.length === 1 && R.cars[0].swapLost === 0 && same(R.cars[0].swapLaps, []));
  ok('a race without Endurance rules has no swaps, even with a roster', mk(null).cars[0].en === null && mk(null).endurance === null);
  ok('...and a practice or a qualifying has none either', mk({}, { type: 'practice' }).cars[0].en === null && mk({}, { type: 'qualifying' }).endurance === null);
  ok('a race by laps swaps too', mk({}, { type: 'race', laps: 50 }).cars[0].en !== null);
  const other = mk({}, { entries: [entry(0, { driverId: 'zz' })] });
  const none = mk({}, { entries: [entry(0, { driverId: '', driverName: '' })] });
  ok('an entry whose driver is not in the roster, or has none, starts with the first of the roster: in the state and at the wheel of the car, with his name and details', other.cars[0].en.d === 'a' && other.cars[0].driverId === 'a' && other.cars[0].driverName === 'Alex' && other.cars[0].nickname === 'Speedy' && none.cars[0].driverId === 'a' && none.cars[0].driverName === 'Alex' && none.cars[0].en.stints[0].d === 'a');
  const rec = mk({}, { entries: [entry(0, { driverId: 'b', driverName: 'Bea' })] });
  ok('...an entry whose driver is in the roster keeps that driver (he starts, and the order of the team goes on after him)', rec.cars[0].driverId === 'b' && rec.cars[0].en.d === 'b' && rec.cars[0].driverName === 'Bea'); }

// ---- the swap that is due ----
{ const R = mk({ swapEvery: 30, swapWarn: 2, swapGrace: 30, swapPenalty: 2 }); R.start(0);
  drive(R, 0, 0, 27 * MIN); R.tick(27 * MIN);
  ok('nothing happens before the warning', types(R, 'swapsoon').length === 0 && types(R, 'swapdue').length === 0);
  R.tick(28 * MIN + 100);
  ok('two minutes before: "swap soon", once, with who is at the wheel and who is next (in turn)', types(R, 'swapsoon').length === 1 && types(R, 'swapsoon')[0].driver === 'a' && types(R, 'swapsoon')[0].driverName === 'Alex' && types(R, 'swapsoon')[0].next === 'b' && types(R, 'swapsoon')[0].nextName === 'Bea');
  R.tick(28 * MIN + 5000);
  ok('...not again', types(R, 'swapsoon').length === 1);
  R.tick(30 * MIN + 1000);
  const due = types(R, 'swapdue');
  ok('at 30 minutes the swap is due: logged once, with what makes it due', due.length === 1 && due[0].why === 'interval' && due[0].driverName === 'Alex' && due[0].nextName === 'Bea' && due[0].car === 0);
  ok('...the look says so, with the time since', R.enLook(0, 30 * MIN + 1000).state === 'due' && R.enLook(0, 30 * MIN + 1000).due === true);
  R.tick(30 * MIN + 20000);
  ok('...within the grace time (30 seconds) there is no penalty', types(R, 'swaplate').length === 0 && R.cars[0].points === 0);
  R.tick(30 * MIN + 31000);
  const late = types(R, 'swaplate');
  ok('after the grace time the swap that is not made costs the penalty points (2), once, and it is logged', late.length === 1 && late[0].n === 1 && late[0].points === 2 && R.cars[0].points === 2 && R.events.some(e => e.type === 'penalty' && e.car === 0 && e.why === 'swaplate' && e.delta === 2));
  R.tick(40 * MIN);
  ok('...and the laps keep counting (the standard)', types(R, 'swaplate').length === 1 && R.cars[0].swapLost === 0 && R.lapsOf ? R.lapsOf(R.cars[0]) === R.cars[0].laps.length : true); }
{ const R = mk({ swapEvery: 30, swapGrace: 0, swapPenalty: 1, swapRepeat: 60 }); R.start(0);
  R.tick(30 * MIN); R.tick(31 * MIN + 500); R.tick(33 * MIN);
  ok('a penalty that repeats every 60 seconds: at the moment it is due, after a minute and after three minutes: 1 + 1 + 2 more points', types(R, 'swaplate').length === 3 && R.cars[0].points === 4 && types(R, 'swaplate').map(e => e.total).join() === '1,2,4'); }
{ const R = mk({ swapEvery: 30, swapGrace: 10, swapPenalty: 0 }, { penalty: false }); R.start(0);
  R.tick(30 * MIN); R.tick(30 * MIN + 11000);
  ok('without penalty points (or without a penalty system) the swap that is refused is still logged, with no points', types(R, 'swaplate').length === 1 && types(R, 'swaplate')[0].points === 0 && R.cars[0].points === 0);
  const P = mk({ swapEvery: 30, swapGrace: 10, swapPenalty: 3 }, { penalty: false }); P.start(0); P.tick(30 * MIN); P.tick(30 * MIN + 11000);
  ok('...a penalty without a penalty system cannot be given: no points', types(P, 'swaplate')[0].points === 0 && P.cars[0].points === 0); }

// ---- the laps that stop counting ----
{ const R = mk({ swapEvery: 10, swapGrace: 45, swapLate: 'stop' }, { type: 'race', laps: 50, duration: 0 }); R.start(0);
  drive(R, 0, 0, 10 * MIN); // 20 laps by 10:00 (a lap every 30 s)
  const before = R.cars[0].laps.length;
  R.cross(0, 10 * MIN + 30000);
  ok('stop counting laps: the laps still count within the grace time (the swap is due since 10:00, the grace time is 45 seconds)', before === 20 && R.cars[0].swapLost === 0 && R.lapsOf(R.cars[0]) === 21 && R.cars[0].en.lost === false);
  R.cross(0, 10 * MIN + 60000); R.cross(0, 10 * MIN + 90000);
  ok('...but not once the swap is overdue: the laps are driven, they stay in the list, they do not count', R.cars[0].swapLost === 2 && R.cars[0].laps.length === 23 && R.cars[0].en.lost === true);
  ok('...the standings count the laps that count; the laps that do not are known by their number', R.lapsOf(R.cars[0]) === 21 && same(R.cars[0].swapLaps, [21, 22]));
  const swapped = R.swap(0, 10 * MIN + 95000);
  ok('...the swap is made late: from then on the laps count again (the laps lost stay lost)', swapped && swapped.ok && R.cars[0].en.lost === false && R.cars[0].swapLost === 2);
  R.cross(0, 10 * MIN + 120000);
  ok('...the next lap counts', R.cars[0].swapLost === 2 && R.lapsOf(R.cars[0]) === 22 && R.cars[0].laps.length === 24); }
{ const R = mk({ swapEvery: 2, swapGrace: 0, swapLate: 'stop' }, { type: 'race', laps: 5, duration: 0 }); R.start(0);
  drive(R, 0, 0, 5 * 30000, 30000); // 5 laps by 2:30; from 2:00 on the swap is due and refused, so laps 4 and 5 do not count
  ok('a race by laps: the finish is at the laps that count (5 laps driven, 3 count)', R.cars[0].swapLost === 2 && R.cars[0].done === false && R.cars[0].laps.length === 5 && R.lapsOf(R.cars[0]) === 3 && !R.finishedLaps(R.cars[0]));
  R.swap(0, 5 * 30000 + 100); R.cross(0, 6 * 30000); R.cross(0, 7 * 30000);
  ok('...after the swap two more laps count: the car finishes when it has the laps that count', R.cars[0].done === true && R.cars[0].laps.length === 7 && R.lapsOf(R.cars[0]) === 5 && R.finishedLaps(R.cars[0]) && R.cars[0].place === 1); }

// ---- the swap by the button ----
{ const R = mk({ swapEvery: 30 }); R.start(0);
  drive(R, 0, 0, 20 * MIN); R.tick(20 * MIN);
  const laps = R.cars[0].laps.length, res = R.swap(0, 20 * MIN + 500);
  ok('Swap done: the next driver in turn is at the wheel of the car (name, nickname, callsign, flag and avatar are his)', res && res.ok && R.cars[0].driverId === 'b' && R.cars[0].driverName === 'Bea' && R.cars[0].nickname === '' && R.cars[0].callsign === '' && R.cars[0].flag === '' && R.cars[0].avatar === '');
  const ev = types(R, 'swapdone')[0];
  ok('...it is logged: who left and who stepped in, how, and how long the stint was (an early swap, because nothing was due)', ev && ev.from === 'a' && ev.fromName === 'Alex' && ev.to === 'b' && ev.toName === 'Bea' && ev.by === 'button' && ev.early === false && ev.stintMs === 20 * MIN + 500 && ev.stintLaps === laps && ev.lap === laps);
  ok('...the stint of the first driver is closed and the second one begins at the same moment and lap', R.cars[0].en.stints.length === 2 && R.cars[0].en.stints[0].ms1 === 20 * MIN + 500 && R.cars[0].en.stints[1].ms0 === 20 * MIN + 500 && R.cars[0].en.stints[1].l0 === laps && R.cars[0].en.swaps === 1);
  ok('...the next swap is due 30 minutes after this one (a stint is counted from its start)', R.enLook(0, 49 * MIN).state !== 'due' && R.enLook(0, 50 * MIN + 500).state === 'due');
  const back = R.cars[0].driverId; R.swap(0, 21 * MIN); R.swap(0, 22 * MIN);
  ok('...and it goes round: b, c, a', back === 'b' && R.cars[0].driverId === 'a'); }
{ const R = mk({ swapEvery: 30 });
  ok('a swap in a race that has not started is not made, and not one in a finished race', R.swap(0, 0) === null && (R.start(0), R.stop(1000), R.swap(0, 2000)) === null); }
{ const R = mk({ swapEvery: 30 }); R.start(0); R.cars[0].done = true;
  ok('a car that has finished does not swap', R.swap(0, 5000) === null); }
{ const R = mk({ swapEvery: 30 }, { entries: [entry(0), entry(1, { driverId: 'b', roster })] }); R.start(0);
  ok('a driver who is at the wheel of another car does not step in (car 2 has b: car 1 gets c instead)', R.swap(0, 1000).to === 'c' && R.cars[0].driverId === 'c' && R.cars[1].driverId === 'b');
  const T = mk({ swapEvery: 30 }, { entries: [entry(0), entry(1, { driverId: 'b', roster })] }); T.start(0); T.cars[1].done = true;
  ok('...and when he has finished that race he can (car 2 is done: car 1 gets b)', T.swap(0, 1000).to === 'b'); }
{ const R = mk({ swapEvery: 30 }); R.start(0); R.pause(5000);
  const res = R.swap(0, 9000);
  ok('a swap under a red flag (paused) is made, at the time of the pause', res && res.ok && R.cars[0].en.stints[0].ms1 === 5000 && types(R, 'swapdone').length === 1);
  R.resume(20000);
  ok('...the race clock carries on after the pause: the new stint has driven nothing yet', R.enLook(0, 20000).stintMs === 0 && R.enLook(0, 20000 + 60000).stintMs === 60000); }
{ const R = mk({ swapEvery: 30, stintMin: 10, swapEarly: 'penalty', swapPenalty: 3 }); R.start(0);
  const res = R.swap(0, 5 * MIN);
  ok('an early swap (before the shortest stint) is logged as early, and costs the penalty points when the setup says so', res.early === true && types(R, 'swapdone')[0].early === true && R.cars[0].points === 3);
  const R2 = mk({ swapEvery: 30, stintMin: 10, swapEarly: 'allow', swapPenalty: 3 }); R2.start(0); R2.swap(0, 5 * MIN);
  ok('...and nothing when early swaps are allowed', types(R2, 'swapdone')[0].early === true && R2.cars[0].points === 0);
  const R3 = mk({ swapEvery: 30, stintMin: 10, swapEarly: 'penalty', swapPenalty: 3 }); R3.start(0); R3.tick(30 * MIN); R3.swap(0, 30 * MIN + 100);
  ok('...a swap that is due is never early', types(R3, 'swapdone')[0].early === false && R3.cars[0].points === 0); }

// ---- who steps in ----
{ const R = mk({ swapEvery: 30, swapNext: 'chosen' }); R.start(0);
  ok('chosen: the driver in turn is suggested as next, and the Race Director can pick another', R.enLook(0, 0).next === 'b' || (R.tick(100), R.enLook(0, 100).next === 'b'));
  ok('...picking c: c is next (logged), and a stranger or the driver at the wheel can not be picked', R.swapNext(0, 'c') === true && R.cars[0].en.nextId === 'c' && types(R, 'swappick')[0].to === 'c' && R.swapNext(0, 'zz') === false && R.swapNext(0, 'a') === false && R.cars[0].en.nextId === 'c');
  R.tick(200);
  ok('...the pick stays (the suggestion does not take it back)', R.cars[0].en.nextId === 'c');
  const res = R.swap(0, 1000);
  ok('...and he steps in', res.to === 'c' && R.cars[0].driverName === 'Cy' && R.cars[0].flag === 'DE');
  R.tick(1100);
  ok('...after the swap the driver in turn is suggested again (a is next after c)', R.cars[0].en.nextId === 'a');
  const R2 = mk({ swapEvery: 30, swapNext: 'chosen' }); R2.start(0);
  ok('the button can name the driver too (Swap done with b chosen... c named)', R2.swap(0, 500, 'c').to === 'c'); }
{ const R = mk({ swapEvery: 30, swapNext: 'order' }); R.start(0);
  ok('in turn: the Race Director cannot pick (the order of the team is fixed), and a name given to the button is ignored', R.swapNext(0, 'c') === false && R.swap(0, 500, 'c').to === 'b'); }
{ let n = 0; const R = mk({ swapEvery: 30, swapNext: 'random' }, { rnd: () => { n++; return 0.99; } }); R.start(0);
  R.tick(100);
  ok('by lot: nobody is drawn before the swap is due', R.cars[0].en.nextId === '' && n === 0 && R.swapNext(0, 'b') === false);
  R.tick(30 * MIN + 100);
  ok('...when it is due one is drawn (c with the lot 0.99), shown as next in the call, and the draw stays', R.cars[0].en.nextId === 'c' && types(R, 'swapdue')[0].next === 'c' && types(R, 'swapdue')[0].nextName === 'Cy' && (R.tick(30 * MIN + 500), R.cars[0].en.nextId === 'c'));
  ok('...and he steps in', R.swap(0, 30 * MIN + 600).to === 'c'); }
{ const R = mk({ swapEvery: 30, totalMax: 20 }); R.start(0);
  R.swap(0, 20 * MIN); R.swap(0, 21 * MIN); // a drove 20 minutes (the longest total), b 1 minute, c at the wheel
  ok('a driver who has driven the longest total does not step in again (after c it would be a: b steps in)', R.cars[0].driverId === 'c' && R.swap(0, 22 * MIN).to === 'b'); }

// ---- the sensor ----
{ const R = mk({ swapEvery: 30, swapSeconds: 10 }); R.start(0);
  drive(R, 0, 0, 29 * MIN); R.block(0, 29 * MIN + 1000); R.tick(29 * MIN + 12000);
  ok('a stop on the sensor when no swap is due is only a stop: nobody swaps', R.cars[0].driverId === 'a' && types(R, 'swapdone').length === 0);
  R.unblock(0, 29 * MIN + 15000);
  R.tick(30 * MIN + 100); R.cross(0, 30 * MIN + 500);
  R.block(0, 30 * MIN + 2000); R.tick(30 * MIN + 11000);
  ok('...when the swap is due, the car must stand still for the swap time (10 seconds): not yet after 9 seconds', R.cars[0].driverId === 'a' && R.enLook(0, 30 * MIN + 11000).standLeft === 1000);
  R.tick(30 * MIN + 12000);
  ok('...and then the swap is made, by the sensor, while the car is still standing', R.cars[0].driverId === 'b' && types(R, 'swapdone').length === 1 && types(R, 'swapdone')[0].by === 'sensor' && R.cars[0].en.swaps === 1);
  R.tick(30 * MIN + 30000); R.unblock(0, 30 * MIN + 40000);
  ok('...once in a stop: no second swap while the car stands or when it leaves', types(R, 'swapdone').length === 1 && R.cars[0].driverId === 'b'); }
{ const R = mk({ swapEvery: 30, swapSeconds: 10 }); R.start(0);
  R.tick(30 * MIN); R.cross(0, 30 * MIN + 500); R.block(0, 30 * MIN + 2000); R.unblock(0, 30 * MIN + 12500);
  ok('the swap is also made when the car leaves, if the ticks did not come in between', R.cars[0].driverId === 'b' && types(R, 'swapdone')[0].by === 'sensor');
  const S = mk({ swapEvery: 30, swapSeconds: 10 }); S.start(0); S.tick(30 * MIN); S.cross(0, 30 * MIN + 500); S.block(0, 30 * MIN + 2000); S.unblock(0, 30 * MIN + 9000);
  ok('...a stop that is too short does not swap (9 seconds of 10)', S.cars[0].driverId === 'a' && types(S, 'swapdone').length === 0);
  S.cross(0, 30 * MIN + 40000); S.block(0, 30 * MIN + 70000); S.tick(30 * MIN + 80500);
  ok('...a later stop does (the swap is still due)', S.cars[0].driverId === 'b'); }
{ const R = mk({ swapEvery: 30, swapSeconds: 10, swapConfirm: 'button' }); R.start(0);
  R.tick(30 * MIN); R.cross(0, 30 * MIN + 500); R.block(0, 30 * MIN + 2000); R.tick(30 * MIN + 20000);
  ok('confirm by the button only: standing on the sensor swaps nobody; the button does', R.cars[0].driverId === 'a' && R.swap(0, 30 * MIN + 21000).ok === true && R.cars[0].driverId === 'b'); }
{ const R = mk({ swapEvery: 30, swapSeconds: 10, swapConfirm: 'sensor' }); R.start(0);
  ok('confirm by the sensor only: the button does nothing', R.swap(0, 1000) === null && R.cars[0].driverId === 'a');
  R.tick(30 * MIN); R.cross(0, 30 * MIN + 500); R.block(0, 30 * MIN + 2000); R.tick(30 * MIN + 12500);
  ok('...the sensor does', R.cars[0].driverId === 'b'); }
{ const R = mk({ swapMode: 'free', stintMin: 5, swapSeconds: 10 }); R.start(0);
  R.cross(0, 2 * MIN); R.block(0, 3 * MIN); R.tick(3 * MIN + 12000); R.unblock(0, 3 * MIN + 13000);
  ok('a free swap: a stop before the shortest stint (5 minutes) does not swap', R.cars[0].driverId === 'a');
  R.cross(0, 6 * MIN); R.block(0, 6 * MIN + 1000); R.tick(6 * MIN + 12000);
  ok('...a stop after it does (nothing has to be due)', R.cars[0].driverId === 'b' && types(R, 'swapdone')[0].early === false); }
{ const R = mk({ swapMode: 'free', stintMin: 0, swapSeconds: 10 }); R.start(0);
  R.cross(0, 2 * MIN); R.block(0, 3 * MIN); R.tick(3 * MIN + 11000); R.tick(3 * MIN + 30000); R.tick(3 * MIN + 60000);
  ok('...with no shortest stint a long stop swaps once, not again and again while the car stands', types(R, 'swapdone').length === 1); }
{ const R = mk({ swapEvery: 30, swapSeconds: 0 }); R.start(0);
  R.tick(30 * MIN); R.cross(0, 30 * MIN + 500); R.block(0, 30 * MIN + 2000); R.tick(30 * MIN + 2000);
  ok('a swap time of 0 seconds: the swap is made as soon as the car stands on the sensor', R.cars[0].driverId === 'b'); }
{ const R = mk({ swapEvery: 30, swapSeconds: 10 }); R.start(0); R.tick(30 * MIN);
  R.cross(0, 30 * MIN + 500); R.block(0, 30 * MIN + 2000); R.pause(30 * MIN + 5000); R.resume(30 * MIN + 100000); R.tick(30 * MIN + 100000 + 3000);
  ok('a pause while the car stands does not count as standing time (3 seconds before the pause, 3 after: not 10)', R.cars[0].driverId === 'a');
  R.tick(30 * MIN + 100000 + 6000);
  ok('...nor after 9 seconds of standing', R.cars[0].driverId === 'a');
  R.tick(30 * MIN + 100000 + 7000);
  ok('...the swap comes when the standing time is over (3 + 7 seconds)', R.cars[0].driverId === 'b'); }

// ---- what the car shows ----
{ const R = mk({ swapEvery: 30, swapUnit: 'minutes', totalMax: 200 }, { entries: [entry(0), entry(1, { roster: [roster[0]] })] }); R.start(0);
  const l = R.enLook(0, 10 * MIN);
  ok('the look at a car: the state, the time left, who is at the wheel and who is next, the totals and the stints', l.state === 'ok' && Math.abs(l.left - 20) < 1e-6 && l.driver === 'a' && l.swaps === 0 && l.totals.length === 3 && l.stints.length === 1 && l.stints[0].now === true && l.lost === false && l.lostLaps === 0 && l.standLeft === null);
  ok('...who can step in, with the reasons', same(l.choices.map(c => c.ok), [false, true, true]) && l.choices[0].why === 'is at the wheel');
  ok('...a car that does not swap (one driver) has no look; neither has a car that does not exist', R.enLook(1, 0) === null && R.enLook(5, 0) === null && mk(null).enLook(0, 0) === null);
  R.pause(10 * MIN);
  ok('...a paused race shows the time of the pause', Math.abs(R.enLook(0, 99 * MIN).left - 20) < 1e-6);
  const ready = mk({ swapEvery: 30 });
  ok('...a race that has not started shows the start', ready.enLook(0, 999999).stints[0].ms === 0 && ready.enLook(0, 999999).state === 'ok'); }

// ---- the end of the race ----
{ const R = mk({ swapEvery: 30 }, { duration: 60 }); R.start(0);
  drive(R, 0, 0, 20 * MIN); R.swap(0, 20 * MIN + 100); drive(R, 0, 20 * MIN, 61 * MIN);
  const c = R.cars[0];
  ok('at the end of the race the stint at the wheel ends where the car finished, and every driver has his total', R.status === 'finished' && c.done && c.en.stints.length === 2 && c.en.stints[1].ms1 === c.total && c.en.stints[1].l1 === c.laps.length && c.en.stints[1].by === 'end');
  const tot = En.totals(c.en, roster, R.endAt - R.t0, c.laps.length);
  ok('...the totals add up to the race: a 20:00.1 and b the rest (both driven laps add up to the laps of the car)', tot[0].ms + tot[1].ms === c.total && tot[0].laps + tot[1].laps === c.laps.length && tot[2].ms === 0);
  ok('...the laps are of the driver who drove them', En.driverAtLap(c.en, 0) === 'a' && En.driverAtLap(c.en, c.en.stints[1].l0 - 1) === 'a' && En.driverAtLap(c.en, c.en.stints[1].l0) === 'b' && En.driverAtLap(c.en, c.laps.length - 1) === 'b'); }
{ const R = mk({ swapEvery: 30, totalMin: 20, minPenalty: 2 }, { duration: 60 }); R.start(0);
  drive(R, 0, 0, 20 * MIN); R.swap(0, 50 * MIN); drive(R, 0, 20 * MIN, 61 * MIN);
  const short = types(R, 'swapshort');
  ok('the shortest total: at the end the drivers who drove less than 20 minutes are told (b drove 10 minutes, c none), and each costs the penalty points', short.length === 2 && short[0].driver === 'b' && short[0].driverName === 'Bea' && short[1].driver === 'c' && short[0].points === 2 && R.cars[0].points === 4);
  const S = mk({ swapEvery: 30, totalMin: 20, minPenalty: 2 }, { duration: 60 }); S.start(0); drive(S, 0, 0, 10 * MIN); S.stop(10 * MIN);
  ok('...a race that was stopped early has nobody short', types(S, 'swapshort').length === 0 && S.cars[0].points === 0 && S.cars[0].en.stints[0].ms1 === 10 * MIN); }

// ---- the review: laps removed or adjusted still follow the stints ----
{ const R = mk({ swapEvery: 30 }, { duration: 0, type: 'race', laps: 100 }); R.start(0);
  drive(R, 0, 0, 5 * MIN); R.swap(0, 5 * MIN + 100); drive(R, 0, 5 * MIN, 8 * MIN);
  ok('the laps that are driven are in the list of the car (the stints give the driver of every lap)', R.cars[0].laps.length === 16 && En.driverAtLap(R.cars[0].en, 9) === 'a' && En.driverAtLap(R.cars[0].en, 10) === 'b'); }

// ---- two cars ----
{ const R = mk({ swapEvery: 30 }, { entries: [entry(0), entry(1, { driverId: 'c', driverName: 'Cy', teamId: 'T2', teamName: 'Blue Moons', roster: [{ id: 'c', name: 'Cy' }, { id: 'd', name: 'Dee' }] })] }); R.start(0);
  R.tick(30 * MIN + 100);
  ok('every car has its own swap: both are due at 30 minutes, each logged for its own car', types(R, 'swapdue').map(e => e.car).join() === '0,1' && types(R, 'swapdue')[1].driverName === 'Cy' && types(R, 'swapdue')[1].nextName === 'Dee');
  ok('...a driver who is in both teams (c) can not step in while he is at the wheel of the other car: car 1 swaps (c to d) and car 0 then gets b, then c', R.swap(0, 30 * MIN + 200).to === 'b' && R.swap(1, 30 * MIN + 300).to === 'd' && R.swap(0, 31 * MIN).to === 'c'); }

// ---- edges ----
{ const R = mk({ swapEvery: 30, swapSeconds: 10 }); R.start(0); R.tick(30 * MIN); R.cross(0, 30 * MIN + 500); R.block(0, 30 * MIN + 2000);
  R.tick(30 * MIN + 11999);
  ok('the standing time is exactly the swap time: 9.999 seconds is not enough', R.cars[0].driverId === 'a' && R.enLook(0, 30 * MIN + 11999).standLeft === 1);
  R.tick(30 * MIN + 12000);
  ok('...10 seconds is', R.cars[0].driverId === 'b'); }
{ const R = mk({ swapEvery: 30, swapSeconds: 5, swapGrace: 0, swapPenalty: 1 }, { duration: 10, entries: [entry(0), entry(1, { driverId: 'c', driverName: 'Cy', roster: [{ id: 'c', name: 'Cy' }, { id: 'd', name: 'Dee' }] })] }); R.start(0);
  drive(R, 0, 0, 11 * MIN); // the time is up at 10 minutes; car 0 finishes at its next crossing, car 1 is still going
  ok('a car that has finished is no longer swapped or told (car 0 is done, the race goes on for car 1)', R.cars[0].done === true && R.status === 'running');
  const n = R.events.length; R.tick(35 * MIN); R.tick(36 * MIN);
  ok('...the swap that would be due for it at 30 minutes is not called, nor penalised', R.events.slice(n).filter(e => e.car === 0).length === 0 && R.cars[0].points === 0 && types(R, 'swapdue').filter(e => e.car === 0).length === 0);
  ok('...(the car that is still racing is told)', types(R, 'swapdue').filter(e => e.car === 1).length === 1);
  R.block(0, 37 * MIN); R.tick(37 * MIN + 20000);
  ok('...and a finished car that stands on the sensor does not swap', R.cars[0].driverId === 'a' && types(R, 'swapdone').length === 0); }
{ const R = mk({ swapEvery: 30, swapNext: 'chosen' }, { duration: 1 }); R.start(0);
  ok('swapNext for a car that does not exist is nothing, and so is a swap', R.swapNext(5, 'b') === false && R.swap(5, 1000) === null && R.swapNext(-1, 'b') === false);
  R.cars[0].done = true;
  ok('...a car that has finished can not pick or swap', R.swapNext(0, 'b') === false && R.swap(0, 1000) === null);
  const F = mk({ swapEvery: 30, swapNext: 'chosen' }); F.start(0); F.stop(1000);
  ok('...nor in a race that is over', F.swapNext(0, 'b') === false);
  const P = mk({ swapEvery: 30, swapNext: 'chosen' }, { entries: [entry(0), entry(1, { driverId: 'b', driverName: 'Bea' })] }); P.start(0);
  ok('...a driver who is at the wheel of another car can not be picked', P.swapNext(0, 'b') === false && P.swapNext(0, 'c') === true); }
{ const two = [roster[0], roster[1]], R = mk({ swapEvery: 30 }, { entries: [entry(0, { roster: two }), entry(1, { driverId: 'b', driverName: 'Bea', roster: [roster[1], roster[2]] })] }); R.start(0);
  ok('when nobody can step in (the only other driver is at the wheel of another car) the swap is not made: no change, nothing logged', R.swap(0, 1000) === null && R.cars[0].driverId === 'a' && types(R, 'swapdone').length === 0 && R.cars[0].en.swaps === 0 && R.cars[0].en.stints.length === 1); }
{ const R = mk({ swapEvery: 30 }, { entries: [entry(0), entry(1, { driverId: 'b', driverName: 'Bea' })] }); R.start(0);
  const l = R.enLook(0, 0);
  ok('the look says why a driver can not step in: b is at the wheel of the other car', l.choices[1].ok === false && l.choices[1].why === 'drives for another team now' && l.choices[2].ok === true); }
{ const R = mk({ swapEvery: 30, swapGrace: 10, swapLate: 'stop', swapPenalty: 1 }); R.start(0); R.tick(30 * MIN); R.tick(30 * MIN + 11000);
  const R2 = mk({ swapEvery: 30, swapGrace: 10, swapLate: 'count', swapPenalty: 1 }); R2.start(0); R2.tick(30 * MIN); R2.tick(30 * MIN + 11000);
  ok('the log of a swap that was refused says whether the laps stop counting', types(R, 'swaplate')[0].stop === true && types(R2, 'swaplate')[0].stop === false); }
{ const R = mk({ swapEvery: 30 }, { duration: 10, entries: [entry(0), entry(1, { roster: [roster[0]] })] }); R.start(0);
  drive(R, 0, 0, 11 * MIN); drive(R, 1, 0, 11 * MIN);
  ok('a race in which one car does not swap (one driver) ends as always', R.status === 'finished' && R.cars[1].en === null && R.cars[0].en.stints[0].ms1 > 0); }
{ const R = mk({ swapEvery: 30, totalMin: 20, minPenalty: 2 }, { duration: 60 }); R.start(0);
  drive(R, 0, 0, 10 * MIN); R.stop(10 * MIN + 20000);
  ok('a race that is stopped: the stint ends when the race was stopped, not at the last lap', R.cars[0].en.stints[0].ms1 === 10 * MIN + 20000); }
{ const R = mk({ swapEvery: 30, totalMin: 20, minPenalty: 2 }, { duration: 60, penalty: false }); R.start(0);
  drive(R, 0, 0, 61 * MIN);
  ok('the shortest total without a penalty system: the drivers who are short are told, with no points', types(R, 'swapshort').length === 2 && types(R, 'swapshort').every(e => e.points === 0) && R.cars[0].points === 0); }

if (fails) { console.log(fails + ' FAILED'); process.exit(1); }
console.log('ALL ENDURANCE ENGINE TESTS PASSED');
