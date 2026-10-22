// 1.59.0: Random flags in the Safety Car System: the yellow flag (the Safety Car) goes up at random moments, as if other cars on the track caused it. The rules and the words (safetycar.js), the folder of the
// form (schema.js), the plan that is rolled when the race starts and the flags it raises and lifts (engine.js), the warning beforehand, the race log, and the snapshot of a race that is carried on.
const E = require('../renderer/engine.js'), Sc = require('../renderer/safetycar.js'), S = require('../schema.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const on = (o = {}) => ({ rndOn: 'on', ...o });
const cycle = arr => { let k = 0; return () => arr[k++ % arr.length]; }; // a "random" number that is not random: the same few over and over
const seq = (...v) => { let k = 0; return () => v[Math.min(k++, v.length - 1)]; }; // ...or these in turn, and then the last one for ever (the first roll is always the chance, the second the count when it is rolled)

// ---- the rules: what a record says ----
ok('a new system has the random flags off: a record without them (or with "off", or not a record) has none', Sc.cleanRandom({}) === null && Sc.cleanRandom({ rndOn: 'off', rndMin: 5 }) === null && Sc.cleanRandom(null) === null && Sc.cleanRandom('x') === null && !('rnd' in Sc.clean({})));
ok('...the standard numbers: always (100%), at least 2 flags and 30% for one more, 30 seconds each, by itself, between 10% and 90% of the race, 30 seconds apart, no warning', same(Sc.RND_DEFAULTS, { on: 'off', chance: 100, mode: 'atleast', min: 2, max: 4, more: 30, lenMode: 'fixed', len: 30, lenMax: 60, end: 'timer', from: 10, to: 90, gap: 30, free: 20, warn: 0 }));
ok('...switched on with nothing else, a record gets those numbers (times in milliseconds)', same(Sc.cleanRandom(on()), { chance: 100, mode: 'atleast', min: 2, max: 2, more: 30, lenMin: 30000, lenMax: 30000, end: 'timer', from: 10, to: 90, gap: 30000, free: 1200000, warn: 0 }));
ok('clean() keeps them with the other rules, only when they are on', same(Sc.clean(on()).rnd, Sc.cleanRandom(on())) && Sc.clean(on()).target === 15000 && Sc.clean(on()).pit === 50 && Object.keys(Sc.clean({ rndOn: 'off' })).join() === 'target,points,pit');
{ const c = Sc.cleanRandom(on({ rndChance: 40, rndMode: 'exact', rndMin: 3, rndLen: 45, rndFrom: 20, rndTo: 70, rndGap: 12, rndWarn: 8 }));
  ok('the numbers of a record are kept: a chance in percent, the count, seconds for the length, the gap and the warning', c.chance === 40 && c.mode === 'exact' && c.min === 3 && c.max === 3 && c.lenMin === 45000 && c.lenMax === 45000 && c.from === 20 && c.to === 70 && c.gap === 12000 && c.warn === 8000); }
ok('...the three ways to say how many: exactly N (M is not used), from N to M (never below N), at least N with a chance for one more (the chance is not used by the others)', same([Sc.cleanRandom(on({ rndMode: 'exact', rndMin: 3, rndMax: 9, rndMore: 50 })).max, Sc.cleanRandom(on({ rndMode: 'exact', rndMin: 3, rndMore: 50 })).more], [3, 0])
  && Sc.cleanRandom(on({ rndMode: 'range', rndMin: 3, rndMax: 6, rndMore: 50 })).max === 6 && Sc.cleanRandom(on({ rndMode: 'range', rndMin: 3, rndMax: 6 })).more === 0 && Sc.cleanRandom(on({ rndMode: 'range', rndMin: 5, rndMax: 2 })).max === 5
  && Sc.cleanRandom(on({ rndMode: 'atleast', rndMin: 3, rndMax: 9, rndMore: 50 })).max === 3 && Sc.cleanRandom(on({ rndMode: 'atleast', rndMin: 3, rndMore: 50 })).more === 50);
ok('...the length: always the same time, or between two times (the longest never below the shortest)', Sc.cleanRandom(on({ rndLenMode: 'fixed', rndLen: 20, rndLenMax: 90 })).lenMax === 20000 && Sc.cleanRandom(on({ rndLenMode: 'range', rndLen: 20, rndLenMax: 90 })).lenMax === 90000 && Sc.cleanRandom(on({ rndLenMode: 'range', rndLen: 40, rndLenMax: 10 })).lenMax === 40000);
ok('...the earliest and the latest moment: typed the other way round, they swap', same([Sc.cleanRandom(on({ rndFrom: 80, rndTo: 30 })).from, Sc.cleanRandom(on({ rndFrom: 80, rndTo: 30 })).to], [30, 80]));
ok('...within their limits: the chance 0 to 100, the count 0 to 20, the length 5 to 600 seconds, the moments 0 to 100, the gap 0 to 600 seconds, the warning 0 to 60 seconds, the free practice 1 to 240 minutes',
  Sc.cleanRandom(on({ rndChance: 250 })).chance === 100 && Sc.cleanRandom(on({ rndChance: -5 })).chance === 0 && Sc.cleanRandom(on({ rndMin: 99 })).min === 20 && Sc.cleanRandom(on({ rndMin: -3 })).min === 0 && Sc.cleanRandom(on({ rndMin: 2.9 })).min === 2
  && Sc.cleanRandom(on({ rndLen: 1 })).lenMin === 5000 && Sc.cleanRandom(on({ rndLen: 9999 })).lenMin === 600000 && Sc.cleanRandom(on({ rndFrom: -4, rndTo: 400 })).to === 100 && Sc.cleanRandom(on({ rndFrom: -4, rndTo: 400 })).from === 0
  && Sc.cleanRandom(on({ rndGap: 9999 })).gap === 600000 && Sc.cleanRandom(on({ rndWarn: 500 })).warn === 60000 && Sc.cleanRandom(on({ rndFree: 0 })).free === 60000 && Sc.cleanRandom(on({ rndFree: 9999 })).free === 14400000);
ok('...a text that is no number (or a choice that does not exist) is the standard', same(Sc.cleanRandom(on({ rndChance: 'abc', rndMode: 'always', rndEnd: 'never', rndLen: '' })), Sc.cleanRandom(on())));
ok('a config that was cleaned before (and sent to another window) is made safe again, and is the same when it was safe already', same(Sc.fromConfig(Sc.clean(on({ rndMode: 'range', rndMin: 1, rndMax: 3, rndLenMode: 'range', rndWarn: 5 }))), Sc.clean(on({ rndMode: 'range', rndMin: 1, rndMax: 3, rndLenMode: 'range', rndWarn: 5 })))
  && Sc.randomFromConfig(null) === null && Sc.randomFromConfig('x') === null && Sc.fromConfig({ target: 0, rnd: 7 }).rnd === undefined && Sc.randomFromConfig({ chance: 900, min: 99, lenMin: 1, gap: -4, warn: 1e9 }).chance === 100 && Sc.randomFromConfig({ chance: 900, min: 99, lenMin: 1, gap: -4, warn: 1e9 }).min === 20
  && Sc.randomFromConfig({ chance: 900, min: 99, lenMin: 1, gap: -4, warn: 1e9 }).lenMin === 5000 && Sc.randomFromConfig({ chance: 900, gap: -4 }).gap === 0 && Sc.randomFromConfig({ gap: 9e9 }).gap === 600000 && Sc.randomFromConfig({ warn: 1e9 }).warn === 60000);

// ---- the plan: how many, when, how long ----
const span = { laps: 20, ms: 0 };
const roll = (o, sp, rand) => Sc.roll(Sc.cleanRandom(on(o)), sp || span, rand || cycle([0.5]));
ok('no settings (or no length of the race at all) is no plan; a race by laps measures in laps, any other race in milliseconds', same(Sc.roll(null, span, cycle([0])), { unit: 'laps', plan: [] }) && Sc.unitOf({ laps: 20, ms: 0 }) === 'laps' && Sc.unitOf({ laps: 0, ms: 600000 }) === 'ms' && Sc.unitOf(null) === 'ms' && Sc.unitOf({ laps: 0, ms: 0 }) === 'ms');
ok('a chance of 0% is never a flag, of 100% always (the chance is that the race has any flags at all)', roll({ rndChance: 0, rndMode: 'exact', rndMin: 3 }, span, cycle([0])).plan.length === 0 && roll({ rndChance: 100, rndMode: 'exact', rndMin: 3 }, span, cycle([0.999])).plan.length === 3);
ok('...in between it is a roll against the percent: 40% and a roll of 0.39 gives flags, 0.40 and above none', roll({ rndChance: 40, rndMode: 'exact', rndMin: 2 }, span, cycle([0.39, 0.5])).plan.length === 2 && roll({ rndChance: 40, rndMode: 'exact', rndMin: 2 }, span, cycle([0.4, 0.5])).plan.length === 0);
ok('exactly N flags is N, whatever the rolls are', [0, 0.3, 0.99].every(v => roll({ rndMode: 'exact', rndMin: 3 }, span, cycle([v])).plan.length === 3));
ok('from N to M flags: the lowest roll gives N, the highest gives M, and every number between can come', roll({ rndMode: 'range', rndMin: 2, rndMax: 5 }, span, seq(0)).plan.length === 2 && roll({ rndMode: 'range', rndMin: 2, rndMax: 5 }, span, seq(0, 0.999, 0.5)).plan.length === 5
  && same([0, 0.26, 0.51, 0.76].map(v => roll({ rndMode: 'range', rndMin: 2, rndMax: 5 }, span, seq(0, v, 0.5)).plan.length), [2, 3, 4, 5]));
ok('at least N flags: N and for every one more a roll against the chance ("more": 100% gives the most there can be, 0% gives N)', roll({ rndMode: 'atleast', rndMin: 3, rndMore: 0 }, span, cycle([0])).plan.length === 3 && roll({ rndMode: 'atleast', rndMin: 3, rndMore: 100 }, { laps: 100, ms: 0 }, cycle([0.5])).plan.length === Sc.MAX_FLAGS
  && roll({ rndMode: 'atleast', rndMin: 2, rndMore: 50 }, span, cycle([0.1, 0.9, 0.5])).plan.length >= 2);
ok('...one more at a time: 50% with the rolls 0.1, 0.2 and then 0.9 after the chance roll gives N + 2, and a first roll over the chance gives N', roll({ rndMode: 'atleast', rndMin: 2, rndMore: 50 }, { laps: 100, ms: 0 }, seq(0, 0.1, 0.2, 0.9, 0.5)).plan.length === 4 && roll({ rndMode: 'atleast', rndMin: 2, rndMore: 50 }, { laps: 100, ms: 0 }, seq(0, 0.9, 0.5)).plan.length === 2);
ok('never more than 20 flags, however much is asked', roll({ rndMode: 'exact', rndMin: 20 }, { laps: 500, ms: 0 }, cycle([0.5])).plan.length === 20 && Sc.cleanRandom(on({ rndMin: 25 })).min === 20);
ok('0 flags is no flags', roll({ rndMode: 'exact', rndMin: 0 }, span, cycle([0.5])).plan.length === 0);
{ const p = roll({ rndMode: 'exact', rndMin: 4, rndFrom: 20, rndTo: 80 }, { laps: 50, ms: 0 }, cycle([0.2, 0.9, 0.5, 0.1, 0.7, 0.3, 0.6, 0.8, 0.4])).plan;
  ok('in a race by laps the places are laps of the leader: between the earliest and the latest moment, sorted, at least a lap apart', p.length === 4 && p.every(x => x.at >= 10 && x.at <= 40) && p.every((x, i) => i === 0 || x.at - p[i - 1].at >= 1) && p.every((x, i) => i === 0 || x.at >= p[i - 1].at));
  ok('...the same rolls give the same plan (nothing but the rolls decides)', same(roll({ rndMode: 'exact', rndMin: 4, rndFrom: 20, rndTo: 80 }, { laps: 50, ms: 0 }, cycle([0.2, 0.9, 0.5, 0.1, 0.7, 0.3, 0.6, 0.8, 0.4])).plan, p) && !same(roll({ rndMode: 'exact', rndMin: 4, rndFrom: 20, rndTo: 80 }, { laps: 50, ms: 0 }, cycle([0.9, 0.1, 0.4])).plan, p)); }
ok('...never before lap 1 and never after the last lap but one, whatever the moments say', roll({ rndMode: 'exact', rndMin: 1, rndFrom: 0, rndTo: 100 }, span, cycle([0])).plan[0].at === 1 && roll({ rndMode: 'exact', rndMin: 1, rndFrom: 0, rndTo: 100 }, span, cycle([0.999])).plan[0].at <= 19 && roll({ rndMode: 'exact', rndMin: 1, rndFrom: 0, rndTo: 100 }, span, cycle([0.999])).plan[0].at > 18);
ok('...no room at all (a race of one lap, or moments that are before lap 1): no flags; a race of two laps has room for one, at lap 1', roll({ rndMode: 'exact', rndMin: 2 }, { laps: 1, ms: 0 }, cycle([0.5])).plan.length === 0 && roll({ rndMode: 'exact', rndMin: 2, rndFrom: 0, rndTo: 2 }, span, cycle([0.5])).plan.length === 0 && same(roll({ rndMode: 'exact', rndMin: 2 }, { laps: 2, ms: 0 }, cycle([0.5])).plan.map(x => x.at), [1]));
ok('...too many for the room: fewer flags, one lap apart (3 flags where laps 2 to 4 are free)', (() => { const p = roll({ rndMode: 'exact', rndMin: 9, rndFrom: 10, rndTo: 20 }, span, cycle([0.5])).plan; return p.length === 3 && p.every((x, i) => i === 0 || x.at - p[i - 1].at >= 1) && p[0].at >= 2 && p[2].at <= 4; })());
{ const q = roll({ rndMode: 'exact', rndMin: 3, rndLen: 20, rndGap: 10, rndFrom: 10, rndTo: 90 }, { laps: 0, ms: 600000 }, cycle([0.3, 0.8, 0.1, 0.6])).plan;
  ok('in a timed race, a qualifying or a practice the places are milliseconds of the race clock, a flag and its gap apart (the length of one flag + the gap)', q.length === 3 && q.every(x => x.at >= 60000 && x.at <= 540000 && x.len === 20000) && q.every((x, i) => i === 0 || x.at - q[i - 1].at >= 30000));
  ok('...the moments are those at which a flag goes up, so the last one may begin at the latest moment', q[2].at <= 540000); }
ok('...too many for the time: fewer flags (in a minute, with 20 s flags and a gap of 10 s, the places are 30 s apart: three at most)', roll({ rndMode: 'exact', rndMin: 5, rndLen: 20, rndGap: 10, rndFrom: 0, rndTo: 100 }, { laps: 0, ms: 60000 }, cycle([0.5])).plan.length === 3 && roll({ rndMode: 'exact', rndMin: 5, rndLen: 20, rndGap: 10, rndFrom: 20, rndTo: 80 }, { laps: 0, ms: 60000 }, cycle([0.5])).plan.length === 2);
ok('...a free practice has no end: the minutes of the setting are its length', roll({ rndMode: 'exact', rndMin: 1, rndFree: 10, rndFrom: 50, rndTo: 50 }, { laps: 0, ms: 0 }, cycle([0.5])).plan[0].at === 300000);
ok('the length: always the same, or a time between the two (rounded to a tenth of a second)', roll({ rndMode: 'exact', rndMin: 2, rndLen: 25 }, span, cycle([0.7])).plan.every(x => x.len === 25000)
  && roll({ rndMode: 'exact', rndMin: 1, rndLenMode: 'range', rndLen: 20, rndLenMax: 60 }, span, seq(0, 0, 0.5)).plan[0].len === 20000 && roll({ rndMode: 'exact', rndMin: 1, rndLenMode: 'range', rndLen: 20, rndLenMax: 60 }, span, seq(0, 0.5, 0.5)).plan[0].len === 40000
  && roll({ rndMode: 'exact', rndMin: 1, rndLenMode: 'range', rndLen: 20, rndLenMax: 60 }, span, seq(0, 0.9999, 0.5)).plan[0].len === 60000 && roll({ rndMode: 'exact', rndMin: 1, rndLenMode: 'range', rndLen: 20, rndLenMax: 60 }, span, seq(0, 0.5013, 0.5)).plan[0].len === 40100);

// ---- the words ----
ok('the settings in one line: the count, the chance when it is not 100%, and the length', Sc.randomText(null) === '' && Sc.randomText(Sc.cleanRandom(on({ rndMode: 'exact', rndMin: 3, rndLen: 20 }))) === 'random yellow flags: 3, 20 s each'
  && Sc.randomText(Sc.cleanRandom(on({ rndMode: 'range', rndMin: 2, rndMax: 4, rndLenMode: 'range', rndLen: 20, rndLenMax: 40, rndChance: 60 }))) === 'random yellow flags: 2 to 4 (60% chance in a race), 20 s to 40 s each'
  && Sc.randomText(Sc.cleanRandom(on({ rndMode: 'atleast', rndMin: 2, rndEnd: 'director' }))) === 'random yellow flags: at least 2, until the Race Director lifts them');
ok('the log says which flag it is, how long it lasts, when it is about to come, and how it ended', Sc.randomEventText({ type: 'randomflag', n: 1, of: 3, len: 30000 }) === 'Random yellow flag 1 of 3 (30 s)' && Sc.randomEventText({ type: 'randomflag', n: 2, of: 3, len: null }) === 'Random yellow flag 2 of 3 (until the Race Director lifts it)'
  && Sc.randomEventText({ type: 'randomsoon', n: 2 }) === 'Random yellow flag 2 is about to come' && Sc.randomEventText({ type: 'randomend', n: 1, by: 'time' }) === 'Random yellow flag 1 is over (the time was up)' && Sc.randomEventText({ type: 'randomend', n: 1, by: 'hand' }) === 'Random yellow flag 1 is over (lifted by hand)' && Sc.randomEventText(null) === '');

// ---- the form: the folder Random flags ----
{ const sys = S.safetycarsystems, f = k => sys.fields.find(x => x.key === k), grp = sys.groups.find(x => x.id === 'random'), inRnd = sys.fields.filter(x => ['random', 'when', 'ends'].includes(x.group) && x.type !== 'sctimeline'); // (1.76.0: the flags are three groups of one section, and the bar of the flags is drawn, not a setting)
  const shown = (fld, rec) => !fld.showIf || fld.showIf.some(c => Object.entries(c).every(([k, vs]) => vs.includes(rec[k] ?? '')));
  const visible = rec => inRnd.filter(x => shown(x, rec)).map(x => x.key);
  ok('the folder Random flags is a folder of the Safety car system, after Behind the Safety Car, closed to begin with, with a note (1.76.0: with When and How long it is the section Random flags of the rail)', grp && grp.title === 'Random flags' && /random moments/.test(grp.note) && grp.open === false && sys.groups.map(x => x.id).join() === 'behind,random,when,ends' && sys.rail.find(x => x.id === 'flags').groups.join() === 'random,when,ends');
  ok('...with 15 settings: all of them can be changed by the user', inRnd.length === 15 && inRnd.every(x => x.label && x.hint) && same(inRnd.map(x => x.key), ['rndOn', 'rndMode', 'rndMin', 'rndMax', 'rndMore', 'rndChance', 'rndFrom', 'rndTo', 'rndGap', 'rndFree', 'rndEnd', 'rndLenMode', 'rndLen', 'rndLenMax', 'rndWarn']));
  ok('...it is off to begin with, and with it off nothing else of the folder shows', f('rndOn').default === 'off' && same(visible({}), ['rndOn']) && same(visible({ rndOn: 'off' }), ['rndOn']) && same(sys.fields.filter(x => x.group === 'random' && x.type === 'sctimeline').map(x => x.key), ['rndLine']) && !shown(f('rndLine'), {}) && shown(f('rndLine'), { rndOn: 'on' }));
  ok('...switched on: the chance, the way to count, N, the way it ends, the earliest and latest moment, the gap, the free practice minutes and the warning show; M and "more" wait for their way to count; the lengths wait for "by itself"', same(visible({ rndOn: 'on', rndMode: 'exact', rndEnd: 'director' }), ['rndOn', 'rndMode', 'rndMin', 'rndChance', 'rndFrom', 'rndTo', 'rndGap', 'rndFree', 'rndEnd', 'rndWarn']));
  ok('...from N to M shows M, at least N shows the chance for one more', visible({ rndOn: 'on', rndMode: 'range', rndEnd: 'director' }).includes('rndMax') && !visible({ rndOn: 'on', rndMode: 'range', rndEnd: 'director' }).includes('rndMore') && visible({ rndOn: 'on', rndMode: 'atleast', rndEnd: 'director' }).includes('rndMore') && !visible({ rndOn: 'on', rndMode: 'atleast', rndEnd: 'director' }).includes('rndMax'));
  ok('...by itself shows the length (and "between two times" shows the longest), only the Race Director does not', visible({ rndOn: 'on', rndEnd: 'timer' }).includes('rndLenMode') && visible({ rndOn: 'on', rndEnd: 'timer' }).includes('rndLen') && !visible({ rndOn: 'on', rndEnd: 'timer' }).includes('rndLenMax') && visible({ rndOn: 'on', rndEnd: 'timer', rndLenMode: 'range' }).includes('rndLenMax') && !visible({ rndOn: 'on', rndEnd: 'director' }).includes('rndLen'));
  ok('...the choices are those of the rules, and the standard numbers are the starting values', same(f('rndMode').options.map(o => o[0] || o.value), Sc.RND_MODES.map(x => x[0])) && same(f('rndEnd').options.map(o => o[0] || o.value), Sc.RND_ENDS.map(x => x[0])) && f('rndMode').default === 'atleast' && f('rndChance').default === 100 && f('rndMin').default === 2 && f('rndLen').default === 30 && f('rndFrom').default === 10 && f('rndTo').default === 90 && f('rndGap').default === 30 && f('rndFree').default === 20 && f('rndWarn').default === 0);
  ok('...the limits of the fields are those of the rules (the chance 0 to 100, the count 0 to 20, the length 5 to 600 seconds, the warning 0 to 60 seconds)', f('rndChance').min === 0 && f('rndChance').max === 100 && f('rndMin').max === Sc.MAX_FLAGS && f('rndLen').min === 5 && f('rndLen').max === 600 && f('rndWarn').max === 60 && f('rndFree').min === 1 && f('rndFree').max === 240 && f('rndGap').max === 600); }

// ---- the race engine ----
const entries = n => Array.from({ length: n }, (_, i) => ({ lane: i, driverId: 'd' + i, carId: 'c' + i, driverName: 'D' + i, carName: 'car' + i }));
const mk = (rec, o = {}) => E.createRace({ type: o.type || 'race', laps: o.laps === undefined ? 20 : o.laps, duration: o.duration || 30, endRule: 'all', entries: entries(2), safetycar: o.sc === null ? undefined : Sc.clean({ target: 15, ...rec }), rnd: o.rnd || (() => 0) });
const started = (rec, o) => { const R = mk(rec, o); R.start(0); R.cars.forEach(c => { c.started = true; }); return R; };
const of = (R, ty) => R.events.filter(e => e.type === ty);
// the leader drives laps of 7 seconds; the clock ticks every 100 ms. Returns the time at the end.
const drive = (R, from, to, lapMs = 7000, car = 0) => { let t = from; while (t < to) { t += 100; R.tick(t); if (t % lapMs === 0) R.cross(car, t); } return t; };
const two = { rndOn: 'on', rndMode: 'exact', rndMin: 2, rndLen: 20, rndGap: 5, rndFrom: 10, rndTo: 90 }; // two flags at laps 2 and 3 (with rolls of 0), 20 s each

{ const N = started({}), M = started({ rndOn: 'off' }), X = started({}, { sc: null });
  ok('a race without random flags has none: no settings, no plan, no warning', N.randomFlags === null && N.rndInfo() === null && N.rndSoon === false && M.randomFlags === null && X.randomFlags === null && X.rndInfo() === null);
  drive(N, 0, 70000); ok('...and no flag ever comes by itself', N.flag === '' && of(N, 'randomflag').length === 0 && of(N, 'safetycar').length === 0); }
{ const R = mk(two);
  ok('a race with random flags has its settings, and no plan before the start', R.randomFlags && R.randomFlags.min === 2 && R.rndInfo() === null);
  R.start(0);
  ok('the plan is rolled when the race starts: two flags at laps 2 and 3, 20 seconds each, none raised yet', same(R.rndInfo(), { unit: 'laps', plan: [{ at: 2, len: 20000 }, { at: 3, len: 20000 }], next: 0, up: null }));
  R.cars.forEach(c => { c.started = true; });
  const plan = R.rndInfo().plan; R.tick(500); ok('...it is rolled once (a later tick or start does not roll again)', same(R.rndInfo().plan, plan)); }
{ const R = started(two);
  let t = drive(R, 0, 14000); ok('no flag before its lap: nothing at the end of lap 2 while the leader has not crossed', R.flag === '' && of(R, 'randomflag').length === 0);
  t = drive(R, t, 14100); ok('the first flag goes up just after the leader has completed lap 2', R.flag === 'yellow' && R.yellowAt === 14100 && R.rndInfo().up && R.rndInfo().next === 1);
  ok('...the Safety Car is out with it (the same flag as any other), and the log says so', R.scOut() === true && of(R, 'safetycar').length === 1 && of(R, 'safetycar')[0].out === true && of(R, 'safetycar')[0].laps === 2 && of(R, 'safetycar')[0].t === 14100);
  ok('...the log says which flag it is, of how many, and how long it lasts', same(of(R, 'randomflag'), [{ type: 'randomflag', car: -1, t: 14100, n: 1, of: 2, len: 20000 }]));
  t = drive(R, t, 34000); ok('...it stays up for its time (20 seconds), also over the next place (lap 3 comes while it is up)', R.flag === 'yellow' && R.cars[0].laps.length >= 4);
  t = drive(R, t, 34100); ok('...and the flag comes down by itself when the time is up, and the Safety Car goes in', R.flag === '' && R.yellowAt === null && R.scOut() === false && of(R, 'safetycar').length === 2 && of(R, 'safetycar')[1].out === false);
  ok('...logged as the end of flag 1 by the time', same(of(R, 'randomend'), [{ type: 'randomend', car: -1, t: 34100, n: 1, by: 'time' }]));
  t = drive(R, t, 39000); ok('the next flag waits for the gap since the last one (5 seconds), although its lap has long gone', R.flag === '' && of(R, 'randomflag').length === 1);
  t = drive(R, t, 39100); ok('...and goes up when the gap is over', R.flag === 'yellow' && of(R, 'randomflag').length === 2 && of(R, 'randomflag')[1].n === 2 && R.rndInfo().next === 2);
  t = drive(R, t, 59100); ok('...and comes down after its time; there are no more flags in this race', R.flag === '' && of(R, 'randomend').length === 2);
  drive(R, t, 140000); ok('...never again, whatever the race does after that', of(R, 'randomflag').length === 2 && R.flag === '' && R.rndSoon === false); }

// ---- the other flags and the Race Director ----
{ const R = started({ ...two, rndEnd: 'director' });
  let t = drive(R, 0, 14100);
  ok('"Only when the Race Director lifts it": the flag goes up and the log says there is no time (until the Race Director lifts it)', R.flag === 'yellow' && of(R, 'randomflag')[0].len === null);
  t = drive(R, t, 120000); ok('...it stays up as long as he wants, the second flag waits for it', R.flag === 'yellow' && of(R, 'randomflag').length === 1 && of(R, 'randomend').length === 0);
  R.setFlag('yellow', t); R.tick(t + 100);
  ok('...he lifts it with the flag button: the Safety Car goes in, and the log says it was lifted by hand', R.flag === '' && R.scOut() === false && of(R, 'randomend').length === 1 && of(R, 'randomend')[0].by === 'hand' && of(R, 'randomend')[0].n === 1);
  t = drive(R, t + 100, t + 4000); ok('...the gap counts from there: the second flag does not come at once', R.flag === '' && of(R, 'randomflag').length === 1);
  t = drive(R, t, t + 2000); ok('...but when the gap is over', R.flag === 'yellow' && of(R, 'randomflag').length === 2); }
{ const R = started({ ...two, rndMin: 1 });
  let t = drive(R, 0, 16000); R.setFlag('yellow', t); R.setFlag('yellow', t); const t4 = drive(R, t, t + 40000);
  ok('a Race Director who lifts the random flag and raises a yellow flag of his own at once (before the clock ticks) has a flag of his own: the random flag is logged as lifted by hand, and the time of the plan does not lift his flag later', R.flag === 'yellow' && R.yellowAt === 16000 && of(R, 'randomend').length === 1 && of(R, 'randomend')[0].by === 'hand' && of(R, 'randomflag').length === 1 && t4 > 50000); }
{ const R = started({ ...two, rndMin: 1 });
  let t = drive(R, 0, 20000); R.setFlag('yellow', t); R.tick(t + 100);
  ok('a timed flag that is lifted by hand before its time is over: logged as lifted by hand (once), and the time does not lift anything later', R.flag === '' && of(R, 'randomend').length === 1 && of(R, 'randomend')[0].by === 'hand' && of(R, 'randomend')[0].t === 20100);
  const t2 = drive(R, t + 100, 26000); R.setFlag('yellow', t2); const t3 = drive(R, t2, t2 + 60000);
  ok('...a flag that the Race Director raises by hand later is his: the plan has no more flags and does not lift it', R.flag === 'yellow' && R.yellowAt === t2 && of(R, 'randomflag').length === 1 && of(R, 'randomend').length === 1 && t3 > 80000); }
{ const R = started(two);
  R.setFlag('yellow', 100); let t = drive(R, 100, 40000);
  ok('a flag that is up already (the Race Director, a marshal call) holds the random flag back: it waits, and comes when the flag is lifted', R.flag === 'yellow' && of(R, 'randomflag').length === 0);
  ok('...a flag that waits is not a flag that is about to come: with no warning set (0 seconds) nothing is announced meanwhile', R.rndSoon === false && of(R, 'randomsoon').length === 0);
  R.setFlag('yellow', t); t = drive(R, t, t + 200);
  ok('...at once, as the gap since the last flag was never started', R.flag === 'yellow' && of(R, 'randomflag').length === 1 && of(R, 'randomflag')[0].n === 1); }
{ const R = started(two);
  drive(R, 0, 14000); R.call(1, 14050); const t = drive(R, 14000, 14200);
  ok('a marshal call makes the same yellow flag; the random flag waits behind it and does not take it over', R.flag === 'yellow' && of(R, 'randomflag').length === 0 && R.calls.length === 1); }
{ const R = started(two);
  let t = drive(R, 0, 14100); R.setFlag('red', t + 50);
  ok('a red flag pauses the race: the plan stands still (the clock stops, nothing is lifted by the time)', R.flag === 'red' && R.status === 'paused');
  R.tick(t + 60000); ok('...also with the time long over', R.status === 'paused' && of(R, 'randomend').length === 0);
  R.setFlag('red', t + 61000); R.tick(t + 61100); ok('...clearing the red flag resumes the race; the random flag that was up has gone with it, and the plan counts it as over (lifted by hand)', R.status === 'running' && R.flag === '' && of(R, 'randomend').length === 1 && of(R, 'randomend')[0].by === 'hand'); }

// ---- qualifying, practice, a timed race: the clock ----
{ const Q = started({ rndOn: 'on', rndMode: 'exact', rndMin: 1, rndFrom: 50, rndTo: 100, rndLen: 20, rndGap: 5 }, { type: 'qualifying', duration: 1 });
  ok('a qualifying measures in milliseconds of the race clock: the plan has its place on the clock', Q.rndInfo().unit === 'ms' && same(Q.rndInfo().plan, [{ at: 30000, len: 20000 }]));
  Q.tick(29900); ok('...nothing before it', Q.flag === ''); Q.tick(30000); ok('...the flag goes up on the clock', Q.flag === 'yellow' && of(Q, 'randomflag')[0].t === 30000);
  Q.tick(49900); ok('...it stays up for 20 seconds', Q.flag === 'yellow'); Q.tick(50000); ok('...and comes down on the clock, logged with the time', Q.flag === '' && of(Q, 'randomend')[0].by === 'time' && of(Q, 'randomend')[0].t === 50000); }
{ const P = started({ rndOn: 'on', rndMode: 'exact', rndMin: 1, rndFree: 2, rndLen: 20, rndFrom: 50, rndTo: 50 }, { type: 'practice' });
  ok('a free practice has no end: the minutes of the setting are its length for the plan (here 2 minutes, half-way)', P.rndInfo().unit === 'ms' && P.rndInfo().plan[0].at === 60000); }
{ const T = started({ rndOn: 'on', rndMode: 'exact', rndMin: 1, rndFrom: 100, rndTo: 100, rndLen: 20 }, { type: 'timed', duration: 1 });
  T.tick(59900); ok('a flag that is due at the very end of a timed race does not come when the time is up', T.flag === ''); T.tick(60000); T.tick(61000); ok('...(nor after it)', T.flag === '' && of(T, 'randomflag').length === 0 && T.rndSoon === false); }
{ const R = started({ rndOn: 'on', rndMode: 'exact', rndMin: 1, rndFrom: 10, rndTo: 10, rndLen: 20 }, { laps: 10 }); // at lap 1
  const L = R.cars[0]; drive(R, 0, 7000); L.done = true; drive(R, 7000, 14000);
  ok('once a car has finished, no flag comes any more', of(R, 'randomflag').length === 0 && R.flag === ''); }

// ---- the chance, and a race without flags ----
{ const R = started({ ...two, rndChance: 50 }, { rnd: cycle([0.7]) });
  ok('a roll above the chance (here 70 against 50%) is a race without random flags: an empty plan, and nothing happens', R.rndInfo() && R.rndInfo().plan.length === 0 && drive(R, 0, 60000) && R.flag === '' && of(R, 'randomflag').length === 0);
  const Q = started({ ...two, rndChance: 50 }, { rnd: cycle([0.2]) }); ok('...under it: the flags are in', Q.rndInfo().plan.length === 2); }
{ const R = started({ ...two, rndChance: 0 }); ok('0% is never any flags', R.rndInfo().plan.length === 0); }

// ---- the warning ----
{ const R = started({ ...two, rndWarn: 5 });
  let t = drive(R, 0, 8000); ok('the warning: not yet when the flag is still far away (more than 5 seconds)', R.rndSoon === false && of(R, 'randomsoon').length === 0);
  t = drive(R, t, 10000); ok('...but it is on from 5 seconds before the flag (the leader is in his second lap, 5 seconds from its end: 2 laps are 14 s)', R.rndSoon === true && of(R, 'randomsoon').length === 1 && of(R, 'randomsoon')[0].n === 1);
  t = drive(R, t, 12000); ok('...logged once, however long it lasts', of(R, 'randomsoon').length === 1 && R.rndSoon === true);
  t = drive(R, t, 14100); ok('...and over when the flag is up', R.flag === 'yellow' && R.rndSoon === false);
  t = drive(R, t, 34100); ok('...the flag comes down, and the next one is warned for too (in its own time: lap 3, the warning for flag 2)', R.flag === '' && of(R, 'randomsoon').length >= 1);
  t = drive(R, t, 40000); ok('...once for every flag', of(R, 'randomsoon').map(e => e.n).join() === '1,2' || of(R, 'randomsoon').length === 2); }
{ const R = started(two); drive(R, 0, 13000); ok('without a warning (0 seconds, the standard) nothing is announced', R.rndSoon === false && of(R, 'randomsoon').length === 0); }
{ const R = started({ rndOn: 'on', rndMode: 'exact', rndMin: 1, rndFrom: 50, rndTo: 50, rndLen: 20, rndWarn: 10 }, { type: 'qualifying', duration: 2 }); // at 60 s
  R.tick(49000); ok('the warning by the clock (a qualifying): not at 11 seconds', R.rndSoon === false); R.tick(50000); ok('...yes at 10 seconds', R.rndSoon === true && of(R, 'randomsoon').length === 1);
  R.pause(50500); R.tick(51000); ok('...the warning stays on while the race is paused (the flag is as close as before)', R.rndSoon === true && R.status === 'paused'); R.resume(60000); R.tick(69400); ok('...the time that it was paused does not count: 60 s on the race clock are 9.5 seconds after the resume', R.status === 'running' && R.flag === '' && R.rndSoon === true); R.tick(69500); ok('...and the flag goes up then, with only one warning in the log', R.flag === 'yellow' && R.rndSoon === false && of(R, 'randomsoon').length === 1); }

// ---- the snapshot of a race that is carried on ----
{ const A = started({ ...two, rndWarn: 5 }), through = R => JSON.parse(JSON.stringify(R.snapshot(R.status === 'running' ? 20000 : 0)));
  drive(A, 0, 20000);
  const file = through(A);
  ok('the snapshot has the plan, how far it has come and the flag that is up (plain data)', file.rn && file.rn.plan.length === 2 && file.rn.i === 1 && file.rn.up && file.rn.up.n === 1 && file.rn.unit === 'laps' && same(JSON.parse(JSON.stringify(file.rn)), file.rn));
  const B = mk({ ...two, rndWarn: 5 }, { rnd: cycle([0.9]) }); // (another engine, rolled differently: the plan of the snapshot wins)
  ok('...it is put into an engine made with the same settings', B.restore(file) === true);
  ok('...the race comes back with the same plan (also when the new engine would roll another), the same place in it, and the flag still up', same(B.rndInfo().plan, A.rndInfo().plan) && B.rndInfo().next === 1 && B.rndInfo().up && B.flag === 'yellow' && B.scOut() === true && B.status === 'paused');
  B.resume(100000); B.tick(100000 + 100);
  ok('...no new line "Safety Car out" in the log, and the flag is lifted by its time as before (the time of the paused hours did not count)', of(B, 'safetycar').length === 1 && B.flag === 'yellow');
  B.tick(100000 + 14100); ok('...(14 seconds later at the clock of the race it is down)', B.flag === '' && of(B, 'randomend').length === 1 && of(B, 'randomend')[0].by === 'time');
  const C = mk(two); ok('a snapshot without a plan (a race from before this release) leaves the plan to the start', C.restore({ ...file, rn: undefined }) === true && C.rndInfo() === null);
  const D = mk(two); ok('a snapshot with a broken plan is cleaned: no numbers, no flags (and no crash)', D.restore({ ...file, rn: { plan: [{ at: 'x', len: 5 }, null, { at: 3, len: 20000 }], unit: 'weird', i: 99, up: { yEl: 'x' }, lastEnd: 'y', warnedFor: null, soon: 1 } }) === true && same(D.rndInfo().plan, [{ at: 3, len: 20000 }]) && D.rndInfo().unit === 'ms' && D.rndInfo().next === 1 && D.rndInfo().up === null && D.rndSoon === true);
  const F = mk({ rndOn: 'off' }); ok('a race without random flags ignores a plan in a snapshot', F.restore(file) === true && F.rndInfo() === null && F.rndSoon === false); }

// ---- what it does not touch ----
{ const R = started({ ...two, rndMode: 'exact', rndMin: 1 });
  ok('the Safety Car rules go on as they are: the fast-lap limit and the pit work, with a random flag, the same as with any other flag', R.safetyCar.target === 15000 && R.safetyCar.pit === 50 && R.safetyCar.rnd.min === 1);
  drive(R, 0, 14100);
  ok('...a lap that is too fast under a random flag is a lap under the Safety Car', R.scOut() === true && R.flag === 'yellow'); }
{ const R = started({ ...two, target: 0 }); drive(R, 0, 14100); ok('a system without a limit on the lap time still has its random flags (only the flag)', R.flag === 'yellow' && of(R, 'randomflag').length === 1); }

console.log(fails ? `\n${fails} FAILED` : '\nALL RANDOM FLAGS TESTS PASSED');
process.exit(fails ? 1 : 0);
