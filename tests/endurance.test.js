// 1.9.0: the Endurance Race. The pure rules (endurance.js): the settings, when a swap is due (every N minutes or laps, at fixed moments, free within the shortest and longest stint,
// the totals of a driver), the grace time and the penalty, who steps in (in turn, picked, by lot), the stints and the totals.
const En = require('../renderer/endurance.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const near = (a, b, d = 1e-6) => Math.abs(a - b) < d;
const MIN = 60000;
const roster = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
const setup = over => ({ sessionType: 'endurance', ...over });
const car = (over, start) => { const cfg = En.clean(setup(over)); return { cfg, st: En.newCar(cfg, roster, start) }; };

// ---- the settings ----
ok('only an Endurance Race setup has the rules (any other session type gives nothing)', En.clean({ sessionType: 'race' }) === null && En.clean({ sessionType: 'heats' }) === null && En.clean(null) === null && En.clean(undefined) === null && En.clean({}) === null);
{ const c = En.clean(setup({}));
  ok('the standards: a swap every 30 minutes, either the sensor or the button, the next in turn, 30 seconds to swap, no penalty, laps keep counting, an early swap is allowed',
    c.on && c.unit === 'minutes' && c.mode === 'every' && c.every === 30 && c.moments.length === 0 && c.confirm === 'both' && c.seconds === 10 && c.next === 'order' && c.grace === 30 && c.penalty === 0 && c.repeat === 0 && c.late === 'count' && c.early === 'allow' && c.minPenalty === 0);
  ok('...no shortest or longest stint and no limits per driver, and a warning one unit before', c.stintMin === 0 && c.stintMax === 0 && c.totalMin === 0 && c.totalMax === 0 && c.warn === 1); }
{ const c = En.clean(setup({ swapUnit: 'laps', swapMode: 'moments', swapEvery: '', swapMoments: '50, 120', stintMin: '5', stintMax: '60', totalMin: 100, totalMax: '300', swapWarn: 2, swapConfirm: 'sensor', swapSeconds: 8, swapNext: 'random', swapGrace: 45, swapPenalty: 2.7, swapRepeat: 60, swapLate: 'stop', swapEarly: 'penalty', minPenalty: 3 }));
  ok('the settings of a race setup are taken over (the laps unit, fixed moments, limits, the sensor, a draw, the penalty, stop counting, an early swap penalised)', c.unit === 'laps' && c.mode === 'moments' && same(c.moments, [50, 120]) && c.stintMin === 5 && c.stintMax === 60 && c.totalMin === 100 && c.totalMax === 300 && c.warn === 2 && c.confirm === 'sensor' && c.seconds === 8 && c.next === 'random' && c.grace === 45 && c.repeat === 60 && c.late === 'stop' && c.early === 'penalty' && c.minPenalty === 3);
  ok('...the penalty is a whole number of points, and an empty interval is the standard of the unit (20 laps)', c.penalty === 2 && c.every === 20); }
{ const c = En.clean(setup({ swapUnit: 'sideways', swapMode: 'x', swapNext: 'y', swapConfirm: 'z', swapLate: 'q', swapEarly: 'w', swapEvery: -4, stintMax: -1, swapGrace: 'abc', swapSeconds: '' }));
  ok('nonsense falls back to the standards, a negative number is zero or the standard', c.unit === 'minutes' && c.mode === 'every' && c.next === 'order' && c.confirm === 'both' && c.late === 'count' && c.early === 'allow' && c.every === 30 && c.stintMax === 0 && c.grace === 30 && c.seconds === 10);
  ok('an interval of 0 is the standard too (a swap every 0 minutes would be due all the time)', En.clean(setup({ swapEvery: 0 })).every === 30 && En.clean(setup({ swapUnit: 'laps', swapEvery: 0 })).every === 20); }

// ---- fixed moments ----
ok('moments: a number is minutes, m:ss is minutes and seconds, h:mm:ss is hours, minutes and seconds; sorted, once each, and nonsense left out', same(En.parseMoments('30, 1:30:00; 2:00:00 45:00 x 0 -5 30', 'minutes'), [30, 45, 90, 120]) && same(En.parseMoments('2.5', 'minutes'), [2.5]) && same(En.parseMoments('2,5', 'minutes'), [2, 5]));
ok('...30:30 is 30 minutes and 30 seconds, and 0:30 is half a minute', near(En.parseMoments('30:30', 'minutes')[0], 30.5) && near(En.parseMoments('0:30', 'minutes')[0], 0.5) && En.parseMoments('1:75', 'minutes').length === 0);
ok('...for laps only whole numbers count', same(En.parseMoments('20 40 abc 40.5 1:30', 'laps'), [20, 40]));
ok('...no text, or none that makes sense, gives none', same(En.parseMoments('', 'minutes'), []) && same(En.parseMoments(undefined, 'minutes'), []) && same(En.parseMoments(null, 'laps'), []) && same(En.parseMoments('  ;, ', 'minutes'), []));

// ---- a new car ----
{ const { cfg, st } = car({}, 'b');
  ok('the car starts with the driver who starts (the first of the roster when that one is not in it), in a stint that began at the start', st.d === 'b' && st.stints.length === 1 && st.stints[0].d === 'b' && st.stints[0].ms0 === 0 && st.stints[0].l0 === 0 && En.newCar(cfg, roster, 'zz').d === 'a' && En.newCar(cfg, roster, undefined).d === 'a' && En.newCar(cfg, [], 'a').d === '');
  ok('...nothing is due, nothing is owed, nobody has driven a total yet', !st.due && st.pen === 0 && !st.lost && st.swaps === 0 && same(st.tot, {}) && st.mi === 0); }

// ---- every N minutes ----
{ const { cfg, st } = car({ swapEvery: 30, swapWarn: 2 });
  let l = En.look(cfg, st, 10 * MIN, 5);
  ok('every 30 minutes: after 10 minutes all is well, 20 minutes are left, and a swap is allowed', l.state === 'ok' && near(l.left, 20) && l.due === false && l.why === 'interval' && l.allowed === true && l.stintMs === 10 * MIN && l.stintLaps === 5);
  l = En.look(cfg, st, 28 * MIN, 5);
  ok('...two minutes before it is due the state is "soon"', l.state === 'soon' && l.soon && near(l.left, 2));
  l = En.look(cfg, st, 27.9 * MIN, 5);
  ok('...a little earlier it is not soon yet', l.state === 'ok');
  l = En.look(cfg, st, 30 * MIN, 5);
  ok('...at 30 minutes the swap is due (and not overdue: the grace time of 30 seconds has not gone)', l.state === 'due' && l.due && !l.overdue && near(l.left, 0));
  l = En.look(cfg, st, 30 * MIN + 29000, 5);
  ok('...29 seconds after: still due', l.state === 'due' && near(l.over, 29));
  l = En.look(cfg, st, 30 * MIN + 30000, 5);
  ok('...30 seconds after: overdue (the grace time is over), counted from the moment it was due', l.state === 'overdue' && l.overdue && near(l.over, 30)); }
{ const { cfg, st } = car({ swapEvery: 30 });
  const a = En.step(cfg, st, 29.5 * MIN, 10), b = En.step(cfg, st, 29.6 * MIN, 10), c = En.step(cfg, st, 30.1 * MIN, 11), d = En.step(cfg, st, 30.2 * MIN, 11);
  ok('step: the warning is given once ("soon"), the swap that is due once ("due") with what makes it due', same(a.events, [{ type: 'soon' }]) && b.events.length === 0 && same(c.events, [{ type: 'due', why: 'interval' }]) && d.events.length === 0);
  ok('...the moment that it was due is exact (30:00), although the look came a little later', st.due && near(st.due.ms, 30 * MIN) && st.due.why === 'interval' && st.due.laps === 11);
  const e = En.step(cfg, st, 30.6 * MIN, 12);
  ok('...a swap that is not made within the grace time is owed a penalty, once', same(e.events, [{ type: 'late', n: 1, total: 1 }]) && st.pen === 1 && En.step(cfg, st, 31 * MIN, 12).events.length === 0 && En.step(cfg, st, 40 * MIN, 12).events.length === 0);
  ok('...and the laps keep counting (the standard)', st.lost === false); }
{ const { cfg, st } = car({ swapEvery: 30, swapGrace: 0 });
  const e = En.step(cfg, st, 30 * MIN, 12);
  ok('a grace time of 0: the swap is overdue the moment it is due, with the "due" call and the penalty together', same(e.events.map(x => x.type), ['due', 'late']) && e.look.state === 'overdue'); }
{ const { cfg, st } = car({ swapEvery: 30, swapGrace: 10, swapRepeat: 20 });
  En.step(cfg, st, 30 * MIN, 12); // due
  const a = En.step(cfg, st, 30 * MIN + 10000, 12), b = En.step(cfg, st, 30 * MIN + 29000, 12), c = En.step(cfg, st, 30 * MIN + 30000, 12), d = En.step(cfg, st, 30 * MIN + 90000, 12);
  ok('a penalty that repeats every 20 seconds after the grace time of 10: the first at 10 seconds, the next at 30, and at 90 seconds three more at once (a long tick)',
    same(a.events, [{ type: 'late', n: 1, total: 1 }]) && b.events.length === 0 && same(c.events, [{ type: 'late', n: 1, total: 2 }]) && same(d.events, [{ type: 'late', n: 3, total: 5 }]) && st.pen === 5); }
{ const { cfg, st } = car({ swapEvery: 30, swapLate: 'stop' });
  En.step(cfg, st, 30 * MIN, 12);
  ok('stop counting laps: not before the swap is overdue', st.lost === false);
  En.step(cfg, st, 30 * MIN + 31000, 12);
  ok('...from the moment it is overdue the laps are not counted', st.lost === true); }
{ const { cfg, st } = car({ swapEvery: 30, swapUnit: 'laps', swapWarn: 2 });
  ok('by laps: every 30 laps (a 20 laps stint is not due, the minutes mean nothing)', En.look(cfg, st, 500 * MIN, 20).state === 'ok' && near(En.look(cfg, st, 500 * MIN, 20).left, 10) && En.look(cfg, st, 500 * MIN, 28).state === 'soon' && En.look(cfg, st, 1 * MIN, 30).state === 'due');
  ok('...the grace time is still in seconds', En.look(cfg, st, 500 * MIN, 30).state === 'due' && !En.step(cfg, st, 500 * MIN, 30).look.overdue && En.look(cfg, st, 500 * MIN + 31000, 30).state === 'overdue'); }

// ---- fixed moments, free swaps and limits ----
{ const { cfg, st } = car({ swapMode: 'moments', swapMoments: '30, 2:00:00' });
  ok('fixed moments: due at 30 minutes of the race (not of the stint), and the next moment is 2 hours', En.look(cfg, st, 28 * MIN, 5).state === 'ok' && near(En.look(cfg, st, 28 * MIN, 5).left, 2) && En.look(cfg, st, 30 * MIN, 5).state === 'due' && En.look(cfg, st, 30 * MIN, 5).why === 'moment');
  En.step(cfg, st, 30 * MIN, 5);
  const r = En.swap(cfg, st, { el: 31 * MIN, laps: 6, by: 'button', roster });
  ok('...a swap after the moment uses it up: the next moment is at 2 hours (a stint of 90 minutes later)', r.ok && st.mi === 1 && En.look(cfg, st, 90 * MIN, 50).state === 'ok' && near(En.look(cfg, st, 90 * MIN, 50).left, 30) && En.look(cfg, st, 120 * MIN, 50).state === 'due');
  const f = car({ swapMode: 'moments', swapMoments: '30' });
  En.swap(f.cfg, f.st, { el: 10 * MIN, laps: 3, by: 'button', roster });
  ok('...a swap before the moment does not use it up: the swap is still needed at 30 minutes', f.st.mi === 0 && En.look(f.cfg, f.st, 30 * MIN, 9).state === 'due');
  const g = car({ swapMode: 'moments', swapMoments: '30' }); En.swap(g.cfg, g.st, { el: 31 * MIN, laps: 3, by: 'button', roster });
  ok('...after the last moment nothing makes a swap due (the left time is nothing)', En.look(g.cfg, g.st, 500 * MIN, 9).left === null && En.look(g.cfg, g.st, 500 * MIN, 9).state === 'ok'); }
{ const { cfg, st } = car({ swapMode: 'moments', swapMoments: '20, 40', swapUnit: 'laps' });
  ok('fixed moments in laps: the laps of the car, not the minutes', En.look(cfg, st, 900 * MIN, 18).state === 'ok' && En.look(cfg, st, 900 * MIN, 19).state === 'soon' && En.look(cfg, st, 1 * MIN, 20).state === 'due');
  En.swap(cfg, st, { el: 5 * MIN, laps: 25, by: 'button', roster });
  ok('...the moment at 20 laps is used up by a swap at lap 25, the next is at lap 40', st.mi === 1 && En.look(cfg, st, 5 * MIN, 39).state !== 'due' && En.look(cfg, st, 5 * MIN, 40).state === 'due'); }
{ const { cfg, st } = car({ swapMode: 'free', stintMin: 20, stintMax: 45 });
  ok('a free swap: nothing is due before the longest stint; before the shortest stint (20 minutes) a swap is not allowed, after it it is', En.look(cfg, st, 10 * MIN, 5).state === 'ok' && En.look(cfg, st, 10 * MIN, 5).allowed === false && En.look(cfg, st, 20 * MIN, 5).allowed === true && En.look(cfg, st, 44 * MIN, 5).due === false);
  ok('...at 45 minutes the longest stint makes the swap due', En.look(cfg, st, 45 * MIN, 5).state === 'due' && En.look(cfg, st, 45 * MIN, 5).why === 'max' && near(En.look(cfg, st, 30 * MIN, 5).left, 15) && En.look(cfg, st, 30 * MIN, 5).why === 'max'); }
{ const { cfg, st } = car({ swapMode: 'free' });
  ok('a free swap without a longest stint is never due, and has no time left to show', En.look(cfg, st, 600 * MIN, 99).state === 'ok' && En.look(cfg, st, 600 * MIN, 99).left === null && En.look(cfg, st, 0, 0).allowed === true); }
{ const { cfg, st } = car({ swapEvery: 60, stintMax: 40 });
  ok('the longest stint also limits an interval: a swap every 60 minutes with at most 40 minutes at the wheel is due at 40 minutes', En.look(cfg, st, 40 * MIN, 5).state === 'due' && En.look(cfg, st, 40 * MIN, 5).why === 'max' && En.look(cfg, st, 39 * MIN, 5).why === 'max'); }
{ const { cfg, st } = car({ swapMode: 'free', totalMax: 50 }, 'a');
  ok('the longest total of a driver makes the swap due when he reaches it (50 minutes)', En.look(cfg, st, 49 * MIN, 5).state === 'soon' && En.look(cfg, st, 50 * MIN, 5).state === 'due' && En.look(cfg, st, 50 * MIN, 5).why === 'total');
  En.swap(cfg, st, { el: 30 * MIN, laps: 15, by: 'button', roster }); // a drives 30 minutes, b steps in
  En.swap(cfg, st, { el: 60 * MIN, laps: 30, by: 'button', roster }); // b drives 30, c steps in? (in turn: c)
  ok('...the total counts the stints of earlier turns: a (30 minutes) comes back and has 20 minutes left of 50', st.d === 'c' && near(En.look(cfg, st, 60 * MIN, 30).total, 0));
  En.swap(cfg, st, { el: 80 * MIN, laps: 40, by: 'button', roster }); // c 20 minutes -> a
  ok('...a is at the wheel again with his 30 earlier minutes: 20 minutes left', st.d === 'a' && near(En.look(cfg, st, 80 * MIN, 40).left, 20) && near(En.look(cfg, st, 80 * MIN, 40).total, 30)); }

// ---- the swap ----
{ const { cfg, st } = car({ swapEvery: 30 }, 'a');
  En.step(cfg, st, 30 * MIN + 40000, 15);
  const r = En.swap(cfg, st, { el: 31 * MIN, laps: 15, by: 'sensor', roster });
  ok('a swap: the driver in turn steps in, the stint that was over is closed with its time and laps, and it says how it was made', r.ok && r.from === 'a' && r.to === 'b' && r.stintMs === 31 * MIN && r.stintLaps === 15 && r.due === true && r.early === false && st.d === 'b' && st.stints.length === 2 && st.stints[0].ms1 === 31 * MIN && st.stints[0].l1 === 15 && st.stints[0].by === 'sensor' && st.stints[1].d === 'b' && st.stints[1].ms0 === 31 * MIN && st.stints[1].l0 === 15);
  ok('...what was due or owed is over: no due moment, no penalties, no lost laps, no warning given, and a swap is counted', st.due === null && st.pen === 0 && st.lost === false && st.warned === false && st.swaps === 1 && st.nextId === '');
  ok('...the driver has his total (31 minutes, 15 laps) and the new stint starts counting from zero', same(st.tot.a, { ms: 31 * MIN, laps: 15 }) && En.look(cfg, st, 36 * MIN, 17).stintMs === 5 * MIN && En.look(cfg, st, 36 * MIN, 17).stintLaps === 2 && En.look(cfg, st, 36 * MIN, 17).state === 'ok');
  const r2 = En.swap(cfg, st, { el: 62 * MIN, laps: 30, by: 'button', roster }), r3 = En.swap(cfg, st, { el: 93 * MIN, laps: 45, by: 'button', roster });
  ok('...in turn: a, b, c, a (round the roster)', r2.to === 'c' && r3.to === 'a' && st.swaps === 3 && st.stints.map(s => s.d).join('') === 'abca'); }
{ const { cfg, st } = car({ swapEvery: 30 }, 'a');
  ok('a swap that nobody can make (a team with one driver) is refused', En.swap(cfg, st, { el: 31 * MIN, laps: 15, by: 'button', roster: [{ id: 'a' }] }).ok === false && En.swap(cfg, st, { el: 31 * MIN, laps: 15, by: 'button', roster: [] }).error === 'nobody to step in' && st.d === 'a' && st.stints.length === 1); }
{ const { cfg, st } = car({ swapEvery: 30 }, 'a');
  const r = En.swap(cfg, st, { el: 31 * MIN, laps: 15, by: 'button', roster, to: 'c' });
  ok('the Race Director can name who steps in (c instead of b)', r.ok && r.to === 'c' && st.d === 'c');
  const s2 = car({ swapEvery: 30 }, 'a'); s2.st.nextId = 'c'; s2.st.picked = true;
  ok('...a picked driver steps in', En.swap(s2.cfg, s2.st, { el: 31 * MIN, laps: 15, by: 'button', roster }).to === 'c');
  const s3 = car({ swapEvery: 30 }, 'a');
  ok('...a driver who is not in the team, or who is at the wheel, is not taken: the driver in turn steps in', En.swap(s3.cfg, s3.st, { el: 31 * MIN, laps: 15, by: 'button', roster, to: 'zz' }).to === 'b' && En.swap(s3.cfg, s3.st, { el: 61 * MIN, laps: 30, by: 'button', roster, to: 'b' }).to === 'c'); }
{ const { cfg, st } = car({ swapEvery: 30 }, 'a');
  const r = En.swap(cfg, st, { el: 31 * MIN, laps: 15, by: 'button', roster, busy: new Set(['b']) });
  ok('a driver who is at the wheel of another car does not step in: the next one does', r.to === 'c');
  const s2 = car({ swapEvery: 30 }, 'a');
  ok('...also when he was named', En.swap(s2.cfg, s2.st, { el: 31 * MIN, laps: 15, by: 'button', roster, busy: ['b', 'c'], to: 'b' }).ok === false);
  const s3 = car({ swapEvery: 30 }, 'a');
  ok('...a list of ids works as well as a Set', En.swap(s3.cfg, s3.st, { el: 31 * MIN, laps: 15, by: 'button', roster, busy: ['b'] }).to === 'c'); }
{ const { cfg, st } = car({ swapEvery: 30, stintMin: 10 }, 'a');
  ok('a swap before the shortest stint is early (and not due)', En.swap(cfg, st, { el: 5 * MIN, laps: 2, by: 'button', roster }).early === true);
  En.step(cfg, st, 36 * MIN, 17);
  const r = En.swap(cfg, st, { el: 36 * MIN, laps: 17, by: 'button', roster });
  ok('...a swap after it is not, and a swap that is due is never early (also with a long shortest stint)', r.early === false && r.stintMs === 31 * MIN);
  const s2 = car({ swapEvery: 5, stintMin: 10 }, 'a'); En.step(s2.cfg, s2.st, 6 * MIN, 2);
  ok('...(due at 5 minutes with a shortest stint of 10: the swap at 6 minutes is not early)', En.swap(s2.cfg, s2.st, { el: 6 * MIN, laps: 2, by: 'button', roster }).early === false); }

// ---- who steps in ----
{ const { cfg, st } = car({ swapNext: 'order', totalMax: 20 }, 'a');
  st.tot.b = { ms: 25 * MIN, laps: 10 };
  const k = En.choices(cfg, st, roster, new Set(['c']), 5 * MIN, 2);
  ok('the choices say who can step in and why not: a is at the wheel, b has driven the longest total, c is driving for another team', same(k, [{ id: 'a', ok: false, why: 'is at the wheel' }, { id: 'b', ok: false, why: 'has driven the longest total' }, { id: 'c', ok: false, why: 'drives for another team now' }]));
  ok('...when nobody can: the driver who is free steps in anyway (b is past his total, but c is busy)', En.suggest(cfg, st, roster, new Set(['c']), 5 * MIN, 2) === 'b');
  ok('...and when nobody is free at all, nobody is suggested', En.suggest(cfg, st, roster, new Set(['b', 'c']), 5 * MIN, 2) === ''); }
{ const { cfg, st } = car({ swapNext: 'order' }, 'b');
  ok('in turn: after b it is c, after c it is a; a driver who cannot is skipped', En.suggest(cfg, st, roster, [], 0, 0) === 'c' && En.suggest(cfg, st, roster, ['c'], 0, 0) === 'a');
  const t = car({ swapNext: 'order', totalMax: 10 }, 'a'); t.st.tot.b = { ms: 11 * MIN, laps: 4 };
  ok('...b is past his longest total: c steps in after a', En.suggest(t.cfg, t.st, roster, [], 0, 0) === 'c'); }
{ const { cfg, st } = car({ swapNext: 'random' }, 'a'); let n = 0;
  const lo = En.suggest(cfg, st, roster, [], 0, 0, () => 0), hi = En.suggest(cfg, st, roster, [], 0, 0, () => 0.999999), one = En.suggest(cfg, st, roster, [], 0, 0, () => 1);
  ok('by lot: a lot of 0 takes the first who can (not the driver at the wheel), just below 1 the last; a lot of exactly 1 still gives a driver', lo === 'b' && hi === 'c' && roster.slice(1).some(r => r.id === one));
  ok('...a driver who cannot is not drawn', En.suggest(cfg, st, roster, ['b'], 0, 0, () => 0) === 'c' && En.suggest(cfg, st, roster, ['c'], 0, 0, () => 0.9) === 'b');
  const seen = new Set(); for (let i = 0; i < 40; i++) seen.add(En.suggest(cfg, st, roster, [], 0, 0)); n = seen.size;
  ok('...with the real random numbers both b and c come up, and a never', n === 2 && !seen.has('a')); }
{ const { cfg, st } = car({ swapNext: 'chosen' }, 'a');
  ok('picked: a driver of the roster who is not at the wheel and not busy can be picked', En.pick(cfg, st, roster, 'c', []) === true && st.nextId === 'c' && st.picked === true);
  ok('...not a stranger, not the driver at the wheel, not a driver who is driving for another team', En.pick(cfg, st, roster, 'zz', []) === false && En.pick(cfg, st, roster, 'a', []) === false && En.pick(cfg, st, roster, 'b', ['b']) === false && st.nextId === 'c'); }
{ const { cfg, st } = car({ swapNext: 'chosen' }, 'a');
  ok('plan: the driver in turn is suggested until one is picked, and the pick stays', En.plan(cfg, st, roster, [], 0, 0) === 'b' && st.picked === false && (En.pick(cfg, st, roster, 'c', []), En.plan(cfg, st, roster, [], 0, 0)) === 'c' && st.picked === true);
  ok('...when the picked driver is no longer possible (he is driving for another team now), the driver in turn is suggested again', En.plan(cfg, st, roster, ['c'], 0, 0) === 'b' && st.picked === false); }
{ const { cfg, st } = car({ swapNext: 'order' }, 'a');
  ok('plan in turn: follows the driver who can (b is busy, so c)', En.plan(cfg, st, roster, [], 0, 0) === 'b' && En.plan(cfg, st, roster, ['b'], 0, 0) === 'c'); }
{ const { cfg, st } = car({ swapNext: 'random', swapEvery: 30 }, 'a'); let calls = 0; const rnd = () => { calls++; return 0.9; };
  ok('plan by lot: nobody is drawn before the swap is due (nothing is shown as the next driver)', En.plan(cfg, st, roster, [], 10 * MIN, 5, rnd) === '' && calls === 0);
  En.step(cfg, st, 30 * MIN, 15);
  ok('...once it is due, one is drawn, and the draw stays (the random number is used once)', En.plan(cfg, st, roster, [], 30 * MIN, 15, rnd) === 'c' && En.plan(cfg, st, roster, [], 31 * MIN, 15, rnd) === 'c' && calls === 1);
  ok('...a driver who becomes busy is replaced by another draw', En.plan(cfg, st, roster, ['c'], 31 * MIN, 15, rnd) === 'b'); }

// ---- the stints and the totals ----
{ const { cfg, st } = car({ swapEvery: 30 }, 'a');
  En.swap(cfg, st, { el: 31 * MIN, laps: 15, by: 'sensor', roster });
  En.swap(cfg, st, { el: 65 * MIN, laps: 33, by: 'button', roster });
  const list = En.stints(st, 70 * MIN, 36);
  ok('the stints so far: who, from when to when, the time and the laps, how the swap was made, and which one goes on', list.length === 3 && same(list.map(s => s.d), ['a', 'b', 'c']) && list[0].ms === 31 * MIN && list[0].laps === 15 && list[0].by === 'sensor' && list[1].ms === 34 * MIN && list[1].laps === 18 && list[1].by === 'button' && list[2].now === true && list[2].ms === 5 * MIN && list[2].laps === 3 && list[2].ms1 === 70 * MIN && list[0].now === false);
  const tot = En.totals(st, roster, 70 * MIN, 36);
  ok('the totals: per driver of the roster, in order, the stint that goes on included, and who is at the wheel', same(tot.map(x => x.id), ['a', 'b', 'c']) && tot[0].ms === 31 * MIN && tot[1].laps === 18 && tot[2].ms === 5 * MIN && tot[2].now === true && tot[0].now === false);
  ok('...a driver who is not in the roster any more, but did drive, is in the totals after the others', same(En.totals(st, [{ id: 'a' }, { id: 'b' }], 70 * MIN, 36).map(x => x.id), ['a', 'b', 'c']));
  ok('the driver of a lap: the laps before a swap are the driver who left (laps 0 to 14 are a, 15 to 32 b, 33 on c)', En.driverAtLap(st, 0) === 'a' && En.driverAtLap(st, 14) === 'a' && En.driverAtLap(st, 15) === 'b' && En.driverAtLap(st, 32) === 'b' && En.driverAtLap(st, 33) === 'c' && En.driverAtLap(st, 500) === 'c' && En.driverAtLap(st, -1) === 'a'); }
{ const { cfg, st } = car({ swapEvery: 30, totalMin: 40 }, 'a');
  En.swap(cfg, st, { el: 31 * MIN, laps: 15, by: 'button', roster });
  const s = En.short(cfg, st, roster, 70 * MIN, 36);
  ok('the shortest total: at the end the drivers who drove less than 40 minutes (a 31, b 39, c did not drive: all three)', same(s.map(x => x.id), ['a', 'b', 'c']) && s[1].ms === 39 * MIN);
  ok('...nobody is short when everybody drove enough, or when there is no shortest total', En.short(cfg, st, roster, 200 * MIN, 36).length === 2 && En.short(En.clean(setup({})), st, roster, 70 * MIN, 36).length === 0);
  const l = car({ swapUnit: 'laps', totalMin: 10 }, 'a'); En.swap(l.cfg, l.st, { el: 5 * MIN, laps: 12, by: 'button', roster });
  ok('...by laps it counts laps (a drove 12 laps, b 3 laps so far)', same(En.short(l.cfg, l.st, roster, 9 * MIN, 15).map(x => x.id), ['b', 'c'])); }

// ---- boundaries and details ----
{ const { cfg, st } = car({ swapEvery: 30 }, 'a');
  ok('a new car has nobody picked yet', st.picked === false);
  En.swap(cfg, st, { el: 31 * MIN, laps: 15, by: 'button', roster });
  ok('...and after a swap nobody is picked either (the next swap has its own next driver)', st.picked === false);
  const two = car({ swapEvery: 30 }, 'a'), r = En.swap(two.cfg, two.st, { el: 31 * MIN, laps: 15, by: 'button', roster: [{ id: 'a' }, { id: 'b' }] });
  ok('a team of two swaps (a to b), and back again (b to a)', r.ok && r.to === 'b' && En.swap(two.cfg, two.st, { el: 61 * MIN, laps: 30, by: 'button', roster: [{ id: 'a' }, { id: 'b' }] }).to === 'a');
  ok('a team of one cannot swap, and nobody can step in when the others are busy', En.swap(two.cfg, two.st, { el: 70 * MIN, laps: 35, by: 'button', roster: [{ id: 'a' }, { id: 'b' }], busy: ['b'] }).ok === false); }
{ const { cfg, st } = car({ swapEvery: 30, stintMax: 30 });
  ok('when two reasons make a swap due at the same moment, the first one in the list is named (the interval)', En.look(cfg, st, 30 * MIN, 5).why === 'interval'); }
{ const { cfg, st } = car({ swapMode: 'moments', swapMoments: '30, 60' }, 'a');
  En.swap(cfg, st, { el: 30 * MIN, laps: 15, by: 'button', roster });
  ok('a swap exactly at the moment uses the moment up', st.mi === 1 && En.look(cfg, st, 59 * MIN, 30).left > 0); }
{ const { cfg, st } = car({ swapEvery: 30, totalMax: 20 }, 'a');
  st.tot.b = { ms: 20 * MIN, laps: 9 };
  ok('a driver who has driven exactly the longest total (20 minutes) cannot step in; one minute less and he can', En.choices(cfg, st, roster, [], 5 * MIN, 2)[1].ok === false && (st.tot.b.ms = 19 * MIN, En.choices(cfg, st, roster, [], 5 * MIN, 2)[1].ok) === true);
  st.tot.b = { ms: 25 * MIN, laps: 9 };
  const over = En.swap(cfg, st, { el: 5 * MIN, laps: 2, by: 'button', roster, to: 'b' });
  ok('the Race Director may name a driver who is past the longest total: it says so ("over")', over.ok && over.to === 'b' && over.over === true);
  const s2 = car({ swapEvery: 30, totalMax: 20 }, 'a');
  ok('...a driver who is not past it is not "over"', En.swap(s2.cfg, s2.st, { el: 5 * MIN, laps: 2, by: 'button', roster, to: 'b' }).over === false); }
{ const { cfg, st } = car({ swapEvery: 30, swapUnit: 'laps' }, 'a');
  ok('by laps the moment that a swap became due is the time of the look (not a time worked out from laps)', En.look(cfg, st, 500 * MIN, 30).dueMs === 500 * MIN && En.look(cfg, st, 500 * MIN, 29).dueMs === null); }
{ const { cfg, st } = car({ swapEvery: 30, totalMin: 40 }, 'a');
  En.swap(cfg, st, { el: 40 * MIN, laps: 20, by: 'button', roster });
  const s = En.short(cfg, st, roster, 70 * MIN, 35);
  ok('the shortest total is a total of exactly 40 minutes or more: a drove exactly 40, he is not short', !s.some(x => x.id === 'a') && s.some(x => x.id === 'b') && s.some(x => x.id === 'c'));
  const st2 = En.newCar(cfg, roster, 'a'); En.swap(cfg, st2, { el: 10 * MIN, laps: 5, by: 'button', roster: [{ id: 'a' }, { id: 'b' }, { id: 'x' }], to: 'x' });
  ok('...a driver who is not in the roster is not short, however little he drove', !En.short(cfg, st2, [{ id: 'a' }, { id: 'b' }], 20 * MIN, 8).some(x => x.id === 'x') && En.short(cfg, st2, [{ id: 'a' }, { id: 'b' }], 20 * MIN, 8).length === 2); }
{ const { cfg, st } = car({ swapEvery: 30 }, 'a');
  En.swap(cfg, st, { el: 31 * MIN, laps: 15, by: 'button', roster });
  ok('close: at the end of the race the stint at the wheel ends too, and its time is in the total of the driver', En.close(cfg, st, 60 * MIN, 30) === true && st.stints[1].ms1 === 60 * MIN && st.stints[1].l1 === 30 && st.stints[1].by === 'end' && same(st.tot.b, { ms: 29 * MIN, laps: 15 }));
  ok('...closing again changes nothing, and the totals are not counted twice', En.close(cfg, st, 90 * MIN, 45) === false && same(st.tot.b, { ms: 29 * MIN, laps: 15 }) && En.totals(st, roster, 90 * MIN, 45).find(x => x.id === 'b').ms === 29 * MIN);
  const list = En.stints(st, 90 * MIN, 45);
  ok('...the stints after the end: the last one is not "now" any more, and ends where the race ended', list[1].now === false && list[1].ms1 === 60 * MIN && list[1].ms === 29 * MIN && list[0].now === false && En.totals(st, roster, 90 * MIN, 45).every(x => x.now === false) === false); }
{ const { cfg, st } = car({ swapNext: 'random', swapEvery: 30 }, 'a');
  ok('plan by lot with a picked driver: the pick stays, also before the swap is due', (En.pick(cfg, st, roster, 'c', []), En.plan(cfg, st, roster, [], 10 * MIN, 5, () => 0)) === 'c' && st.picked === true);
  ok('...and when he cannot (busy), the pick goes: nobody is drawn before the swap is due', En.plan(cfg, st, roster, ['c'], 10 * MIN, 5, () => 0) === '' && st.picked === false); }
{ const { cfg, st } = car({ swapNext: 'chosen', swapEvery: 30 }, 'b');
  ok('plan in turn for the driver b: c is next (the pick of a is not in the way)', En.plan(cfg, st, roster, [], 0, 0) === 'c' && En.plan(cfg, st, roster, ['c'], 0, 0) === 'a'); }

{ const { cfg, st } = car({ swapEvery: 30, swapUnit: 'laps' }, 'a');
  ok('by laps, a swap that has been due for a lap is due since this look (31 laps for an interval of 30: not a minute earlier)', En.look(cfg, st, 500 * MIN, 31).dueMs === 500 * MIN);
  const t = car({ swapEvery: 30, totalMax: 20 }, 'a'); t.st.tot.c = { ms: 25 * MIN, laps: 11 };
  const r = En.swap(t.cfg, t.st, { el: 5 * MIN, laps: 2, by: 'button', roster, to: 'b', busy: ['b'] });
  ok('when the driver who was named is busy, the driver who steps in instead is checked for the longest total (c is past it: "over")', r.ok && r.to === 'c' && r.over === true); }

{ const { cfg, st } = car({ swapEvery: 30, swapNext: 'order' }, 'a');
  st.nextId = 'c'; // (planned a moment ago, when b was busy)
  ok('in turn the driver is worked out at the swap: b steps in, not the driver who was planned when b was busy and is not picked', En.swap(cfg, st, { el: 31 * MIN, laps: 15, by: 'button', roster }).to === 'b');
  const r = car({ swapEvery: 30, swapNext: 'random' }, 'a'); r.st.nextId = 'c';
  ok('by lot the driver who was drawn steps in (he can)', En.swap(r.cfg, r.st, { el: 31 * MIN, laps: 15, by: 'button', roster }).to === 'c');
  const q = car({ swapEvery: 30, swapNext: 'random' }, 'a'); q.st.nextId = 'c';
  ok('...and when he can not (he is driving another car now) the lot is drawn again', En.swap(q.cfg, q.st, { el: 31 * MIN, laps: 15, by: 'button', roster, busy: ['c'], rnd: () => 0 }).to === 'b'); }

// ---- the words ----
{ const m = En.clean(setup({})), l = En.clean(setup({ swapUnit: 'laps' }));
  ok('a time as the clock shows it: 3:05, 1:02:03', En.clock(185000) === '3:05' && En.clock(3723000) === '1:02:03' && En.clock(0) === '0:00' && En.clock(-5) === '0:00');
  ok('how much is left: minutes as a clock, laps as a number (rounded up)', En.leftText(m, 12.5) === '12:30' && En.leftText(m, -3) === '0:00' && En.leftText(l, 2.2) === '3 laps' && En.leftText(l, 1) === '1 lap' && En.leftText(l, -4) === '0 laps' && En.leftText(m, null) === '');
  ok('a span said aloud', En.spanText(m, 30) === '30 minutes' && En.spanText(m, 1) === '1 minute' && En.spanText(l, 1) === '1 lap' && En.spanText(l, 20) === '20 laps' && En.spanText(m, 2.5) === '2.5 minutes');
  ok('why a swap is due, in words', En.whyText('interval') === 'the stint is over' && En.whyText('moment') === 'it is time for the swap' && En.whyText('max') === 'the longest stint is over' && En.whyText('total') === 'the longest total of the driver is reached' && En.whyText('x') === ''); }

if (fails) { console.log(fails + ' FAILED'); process.exit(1); }
console.log('ALL ENDURANCE TESTS PASSED');
