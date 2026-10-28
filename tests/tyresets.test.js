// 1.41.0: Tyre Wear release 2 in the race engine: the sets of tyres (per car, or shared by the team), the tyre that the Race Director queues for the next stop, the rain's tyres that come before a queued tyre,
// what happens when a set is gone, the correction of the Race Director, and the snapshot. And the rules on their own (pickFit, cleanSets).
const E = require('../renderer/engine.js'), T = require('../renderer/tyrewear.js'), W = require('../renderer/weather.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const fuel = (x = {}) => ({ on: true, tank: 100, perLap: 2, rate: 10, target: 0, extra: 0, saving: 0, empty: 'retire', pitHold: 2000, ...x });
const pen = { on: true, mode: 'every', every: 5, seconds: 5, steps: [], dq: 0, types: [], fuelPoints: 0 };
const entries = (n, tyres = ['S', 'M', 'H', 'W'], team = null) => Array.from({ length: n }, (_, i) => ({ lane: i, driverId: 'd' + i, carId: 'c' + i, driverName: 'D' + i, carName: 'car' + i, tyre: tyres[i], ...(team ? { teamId: team[i], teamName: 'Team ' + team[i] } : {}) }));
// rec: the record of the Tyre Wear System; o: { cars, tyres, team (a team id per car), weather, type }
const race = (rec, o = {}) => {
  const r = E.createRace({ type: o.type || 'race', laps: 60, duration: 30, endRule: 'all', entries: entries(o.cars || 2, o.tyres, o.team), fuel: fuel(), penalty: pen,
    tyrewear: T.clean(rec, o.ctx), weather: o.weather ? W.clean(o.weather, 1) : undefined });
  r.start(0); return r;
};
const evs = (r, ...types) => r.events.filter(e => types.includes(e.type));
// one stop with no time for the tyres (changeSeconds 0): the car stops on the sensor at tb, the stop starts after the hold, the car leaves 3 s later
const stop = (r, i, tb) => { r.block(i, tb); r.tick(tb + 2500); r.unblock(i, tb + 3000); };
const NOTIME = { changeSeconds: 0 };
const SETS = (n, mode = 'car') => ({ setsMode: mode, sets: { H: 2, M: 2, S: 2, SS: 1, INT: 2, W: 2, ...n } });
const wetWx = { startAt: 1, cloudyFor: 0, rainFor: 9, clearingFor: 0 };

// ---- the rules on their own ----
{ const d = T.defaults();
  ok('a new system has a set per car: 2 Hard, 2 Medium, 2 Soft, 1 Supersoft, 2 Intermediate, 2 Wet', d.setsMode === 'car' && same(d.sets, { H: 2, M: 2, S: 2, SS: 1, US: 1, HS: 1, SH: 2, INT: 2, W: 2 }));
  ok('a record from before 1.41.0 (no sets) has no limit, so the tyres change as in 1.40.0', T.clean({}).sets.mode === 'none' && T.clean({ setsMode: 'nonsense' }).sets.mode === 'none');
  ok('the sets are cleaned: whole numbers 0 to 99, a missing or wrong one is the default', same(T.cleanSets({ H: '3', M: -4, S: 2.6, SS: 'x', INT: 500 }), { H: 3, M: 0, S: 3, SS: 1, US: 1, HS: 1, SH: 2, INT: 99, W: 2 }) && same(T.cleanSets(null), T.DEFAULT_SETS));
  ok('car, team and none are the three ways', same(T.SETS_MODES.map(x => x[0]), ['none', 'car', 'team']) && T.clean({ setsMode: 'team' }).sets.mode === 'team' && T.clean({ setsMode: 'car' }).sets.mode === 'car');
  ok('the sets in words', T.setsText(T.clean({})) === 'no limit on the sets' && T.setsText(T.clean({ setsMode: 'car', sets: { H: 0, M: 3, S: 0, SS: 0, US: 0, HS: 0, SH: 0, INT: 0, W: 1 } })) === 'sets per car: 3 Medium, 1 Wet' && /shared by the team/.test(T.setsText(T.clean({ setsMode: 'team' }))));
  ok('...and in the rules line, only when there is a limit', !/sets/.test(T.rulesText(T.clean({}))) && /sets per car/.test(T.rulesText(T.clean({ setsMode: 'car' }))));
  ok('the total of a box (null without a limit)', T.setsTotal({ H: 1, M: 2, S: 0, SS: 0, INT: 0, W: 4 }) === 7 && T.setsTotal(null) === null); }
{ const box = { H: 0, M: 0, S: 1, SS: 0, INT: 0, W: 0 };
  ok('pickFit: no limit gives what is wanted', same(T.pickFit(null, 'SS', 'M', false, false), { code: 'SS' }));
  ok('...a set of it left: that one', same(T.pickFit(box, 'S', 'M', false, false), { code: 'S' }));
  ok('...none of it left: the tyre the car races on, with what was asked for', same(T.pickFit({ ...box, S: 0, M: 1, H: 1 }, 'S', 'M', false, false), { code: 'M', asked: 'S' }));
  ok('...and when that is gone too: a dry compound in the order Hard, Medium, Soft, Supersoft', same(T.pickFit({ ...box, S: 0, SS: 1, H: 1 }, 'S', 'M', false, false), { code: 'H', asked: 'S' }) && same(T.pickFit({ ...box, S: 0, SS: 1 }, 'M', 'M', false, false), { code: 'SS', asked: 'M' }));
  ok('...Intermediate and Wet only in a race without weather', T.pickFit({ ...box, S: 0, INT: 1 }, 'S', 'M', false, false) === null && same(T.pickFit({ ...box, S: 0, INT: 1 }, 'S', 'M', false, true), { code: 'INT', asked: 'S' }));
  ok('...nothing left at all: no set goes on', T.pickFit({ H: 0, M: 0, S: 0, SS: 0, INT: 0, W: 0 }, 'S', 'M', false, true) === null);
  ok('...the rain\'s tyre has no set: nothing else is fitted (a dry tyre would be the wrong one)', T.pickFit({ ...box, W: 0, H: 2 }, 'W', 'M', true, false) === null && same(T.pickFit({ ...box, W: 1 }, 'W', 'M', true, false), { code: 'W' })); }

// ---- without a limit nothing changes ----
{ const r = race({ ...NOTIME }); ok('no limit: no box, a car shows no sets', r.cars.every(c => !c.twSets) && r.twOf(0, 0).sets === null && same(r.twTeams, {}));
  r.cross(0, 10000); stop(r, 0, 20000); stop(r, 0, 40000); stop(r, 0, 60000);
  ok('...a stop gives a fresh set every time, as in 1.40.0', r.cars[0].twStops === 3 && r.cars[0].twLife === 100 && r.cars[0].tyre === 'S' && !evs(r, 'tyrefresh').some(e => e.asked) && !evs(r, 'tyrenone').length);
  ok('...a tyre can be queued all the same, and goes on at the next stop', r.twQueue(0, 'SS', 70000) && r.cars[0].twNext === 'SS' && (stop(r, 0, 80000), r.cars[0].tyre === 'SS' && r.cars[0].tyreOwn === 'SS' && r.cars[0].twNext === '')); }

// ---- sets per car ----
{ const r = race({ ...NOTIME, ...SETS({}) });
  ok('every car starts on a set of its tyre, and that one is counted: Soft 2 -> 1, Medium 2 -> 1, the rest of the box is full', same(r.cars[0].twSets, { H: 2, M: 2, S: 1, SS: 1, US: 1, HS: 1, SH: 2, INT: 2, W: 2 }) && same(r.cars[1].twSets, { H: 2, M: 1, S: 2, SS: 1, US: 1, HS: 1, SH: 2, INT: 2, W: 2 }));
  ok('what a screen asks for: the box, the tyre it races on, what goes on at the next stop', (() => { const d = r.twOf(0, 0); return same(d.sets, r.cars[0].twSets) && d.own === 'S' && d.next.code === 'S' && d.next.kind === 'same'; })());
  ok('a stop takes one set of the same tyre out of the box (Soft 1 -> 0) and puts new tyres on', (() => { r.cross(0, 10000); stop(r, 0, 20000); return r.cars[0].twSets.S === 0 && r.cars[0].twLife === 100 && r.cars[0].tyre === 'S' && r.cars[0].twStops === 1; })());
  ok('the box of the other car is not touched', r.cars[1].twSets.M === 1 && r.cars[1].twSets.S === 2);
  stop(r, 0, 40000); const e = evs(r, 'tyrefresh');
  ok('the next stop: no Soft set left, so the car gets the first dry tyre that is left (Hard) and the log says what was asked', r.cars[0].tyre === 'H' && r.cars[0].tyreOwn === 'H' && r.cars[0].twSets.H === 1 && e[e.length - 1].tyre === 'H' && e[e.length - 1].asked === 'S' && evs(r, 'tyres').pop().tyre === 'H');
  ok('...and the stop after: Hard has one more', (stop(r, 0, 60000), r.cars[0].tyre === 'H' && r.cars[0].twSets.H === 0));
  ok('...then the Medium (the tyre that is left first in the order), then the Soft', (stop(r, 0, 80000), r.cars[0].tyre === 'M' && r.cars[0].twSets.M === 1) );
  const a = race({ ...NOTIME, ...SETS({ H: 0, M: 0, S: 1, SS: 0, US: 0, HS: 0, SH: 0, INT: 0, W: 0 }) });
  ok('0 sets of a tyre: it is not allowed; the car that started on one still starts (the box does not go below 0)', a.cars[0].twSets.S === 0 && a.cars[1].twSets.M === 0 && a.cars[1].tyre === 'M');
  ok('...and with no set of anything the stop does not change the tyres: they stay worn, the stop is logged and no stop is counted', (() => { a.cross(0, 10000); a.block(0, 20000); const life = a.cars[0].twLife; a.tick(22500); a.unblock(0, 23000);
    return a.cars[0].twLife === life && life < 100 && a.cars[0].twStops === 0 && a.cars[0].tyre === 'S' && evs(a, 'tyrenone').length === 1 && evs(a, 'tyrenone')[0].asked === 'S' && !evs(a, 'tyrefresh').length && !evs(a, 'tyreearly').length; })()); }

// a timed tyre change (4 s) with no set to fit: the stop tries once, however long the car stands
{ const a = race({ changeSeconds: 4, ...SETS({ H: 0, M: 0, S: 1, SS: 0, US: 0, HS: 0, SH: 0, INT: 0, W: 0 }) });
  a.cross(0, 10000); a.block(0, 20000); const life = a.cars[0].twLife; a.tick(22500); a.tick(25000); a.tick(27000); a.tick(28000); a.tick(29000); a.unblock(0, 30000);
  ok('a timed tyre change with no set to fit is tried once: one line in the log, however long the car stands, and the tyres stay as they were', evs(a, 'tyrenone').length === 1 && !evs(a, 'tyrefresh').length && a.cars[0].twLife === life && a.cars[0].twStops === 0 && a.twOf(0, 29000).fitting === null); }

// ---- the queue ----
{ const r = race({ ...NOTIME, ...SETS({}) });
  ok('queue a Supersoft for the next stop: it is kept, logged, and shown as "queued"', r.twQueue(0, 'SS', 5000) && r.cars[0].twNext === 'SS' && r.twOf(0, 5000).next.kind === 'queued' && r.twOf(0, 5000).next.code === 'SS' && evs(r, 'tyrequeue')[0].tyre === 'SS' && r.cars[0].tyre === 'S');
  ok('the tyre on the car does not change before the stop (the life neither)', r.cars[0].tyre === 'S' && r.cars[0].twLife === 100);
  ok('...the same again is no change', r.twQueue(0, 'SS', 6000) === false && evs(r, 'tyrequeue').length === 1);
  r.cross(0, 10000); stop(r, 0, 20000);
  ok('at the stop the queued tyre goes on: the set comes out of the box (Supersoft 1 -> 0), it is the tyre the car races on now, and the queue is empty', r.cars[0].tyre === 'SS' && r.cars[0].tyreOwn === 'SS' && r.cars[0].twSets.SS === 0 && r.cars[0].twNext === '' && r.cars[0].twLife === 100);
  ok('...the log has the new tyres', evs(r, 'tyres').pop().tyre === 'SS' && evs(r, 'tyres').pop().was === 'S');
  ok('a tyre with no set left can not be queued (Supersoft: 0 now)', r.twQueue(0, 'SS', 30000) === false && r.cars[0].twNext === '');
  ok('...a tyre with no set left in the system can not be queued either, when it is not the tyre the car is on (Hard: 0 sets)', (() => { const q = race({ ...NOTIME, ...SETS({ H: 0 }) }); return q.twQueue(0, 'H', 1000) === false && !q.cars[0].twNext && !evs(q, 'tyrequeue').length && q.twQueue(0, 'M', 2000) === true; })());
  ok('queueing the tyre the car is on changes nothing when nothing is queued', r.cars[0].tyreOwn === 'SS' && r.twQueue(0, 'SS', 31000) === false && r.cars[0].twNext === '' && evs(r, 'tyrequeue').length === 1);
  ok('...and it clears what was queued (it is the same as "Same")', r.twQueue(0, 'H', 31500) && r.cars[0].twNext === 'H' && r.twQueue(0, 'SS', 32000) && r.cars[0].twNext === '' && evs(r, 'tyrequeue').pop().tyre === '' && evs(r, 'tyrequeue').pop().was === 'H');
  ok('...clearing is always allowed, even when the tyre it is on has no set left; another tyre can be queued instead', r.twQueue(0, 'M', 33000) && r.cars[0].twNext === 'M' && r.twQueue(0, '', 33500) && r.cars[0].twNext === '');
  ok('a code that is no tyre is refused, a car that is not there too', r.twQueue(0, 'X', 1) === false && r.twQueue(9, 'H', 1) === false);
  ok('a queued tyre that has no set left by the time of the stop (the box was used up in between): the car gets another one', (() => { const q = race({ ...NOTIME, ...SETS({ H: 1 }) }); q.twQueue(0, 'H', 1); q.cars[0].twSets.H = 0; stop(q, 0, 20000); return q.cars[0].tyre === 'S' && evs(q, 'tyrefresh')[0].asked === 'H'; })());
  ok('...and a stop with the queue and the life: the queue is used up even when it was not what went on', (() => { const q = race({ ...NOTIME, ...SETS({ H: 1 }) }); q.twQueue(0, 'H', 1); q.cars[0].twSets.H = 0; stop(q, 0, 20000); return q.cars[0].twNext === ''; })());
  r.stop(40000);
  ok('nothing is queued once the race is over', r.twQueue(0, 'M', 41000) === false); }

// ---- the queue in a race without sets, and a race that has no tyre wear ----
{ const r = E.createRace({ type: 'race', laps: 9, entries: entries(2), fuel: fuel(), penalty: pen }); r.start(0);
  ok('without Tyre Wear there is no queue and no sets', r.twQueue(0, 'H', 1) === false && r.twOf(0, 0) === null); }

// ---- weather ----
{ const r = race({ ...NOTIME, ...SETS({}) }, { weather: wetWx }); r.cross(0, 10000); r.cross(1, 10000);
  ok('with weather only a dry tyre can be queued: Wet and Intermediate come from the weather', r.wxState === 'wet' && r.twQueue(0, 'W', 11000) === false && r.twQueue(0, 'INT', 11000) === false && r.twQueue(0, 'H', 11000));
  ok('the next stop in the rain is the Wet tyre, set by the weather, and the queued tyre waits', (() => { const n = r.twOf(0, 11000).next; return n.code === 'W' && n.kind === 'weather' && r.cars[0].twNext === 'H'; })());
  stop(r, 0, 20000);
  ok('the stop gives Wet (from the Wet sets: 2 -> 1) and the queued Hard is still queued for the stop after', r.cars[0].tyre === 'W' && r.cars[0].twSets.W === 1 && r.cars[0].twNext === 'H' && r.cars[0].tyreOwn === 'S' && r.cars[0].twSets.H === 2);
  ok('...the tyre the car goes back to when the track is dry is still its own', r.cars[0].tyreOwn === 'S');
  ok('a car with no Wet set left keeps the tyres it has in the rain: nothing else is fitted', (() => { const q = race({ ...NOTIME, ...SETS({ W: 0 }) }, { weather: wetWx }); q.cross(0, 10000); q.cross(1, 10000); q.block(0, 20000); const life = q.cars[0].twLife; q.tick(22500); q.unblock(0, 23000);
    return q.cars[0].tyre === 'S' && q.cars[0].twLife === life && life < 100 && evs(q, 'tyrenone').length === 1 && evs(q, 'tyrenone')[0].asked === 'W'; })());
  ok('a car on Wet tyres comes in when it is dry again: the queued tyre goes on, and that is its tyre now', (() => { r.wxSet('dry', 25000, 'director'); stop(r, 0, 30000); return r.cars[0].tyre === 'H' && r.cars[0].tyreOwn === 'H' && r.cars[0].twNext === '' && r.cars[0].twSets.H === 1; })()); }

// ---- the team shares the sets ----
{ const r = race({ ...NOTIME, ...SETS({ S: 3 }, 'team') }, { cars: 3, tyres: ['S', 'S', 'S'], team: ['a', 'a', 'b'] });
  ok('two cars of a team take their start sets from one box (Soft 3 -> 1), the car of the other team has a box of its own (3 -> 2)', r.twTeams.a.S === 1 && r.twTeams.b.S === 2 && !r.cars[0].twSets);
  ok('the cars of a team see the same box', same(r.twOf(0, 0).sets, r.twOf(1, 0).sets) && !same(r.twOf(0, 0).sets, r.twOf(2, 0).sets));
  stop(r, 0, 20000);
  ok('a stop of one car takes the set from the team: the other car\'s stop has none left', r.twTeams.a.S === 0 && r.twTeams.b.S === 2);
  stop(r, 1, 30000);
  ok('...so the second car gets the tyre that is left (Hard)', r.cars[1].tyre === 'H' && evs(r, 'tyrefresh').pop().asked === 'S' && r.twTeams.a.H === 1);
  ok('...and the car of the other team is not touched', r.twTeams.b.S === 2 && r.twTeams.b.H === 2);
  ok('the queue of a car can not use a set that the team-mate used', r.twQueue(0, 'S', 31000) === false);
  const w = race({ ...NOTIME, ...SETS({}, 'team') }, { cars: 2, tyres: ['S', 'M'] });
  ok('cars with no team have a box each, even when the team mode is on', w.cars.every(c => c.twSets) && Object.keys(w.twTeams).length === 0 && w.cars[0].twSets.S === 1 && w.cars[1].twSets.S === 2); }

// ---- the Race Director corrects the tyre ----
{ const r = race({ ...NOTIME, ...SETS({}) });
  ok('a correction (the car really is on Hard) moves a set in the box: the Soft goes back, a Hard comes out, the life stays', (() => { r.cross(0, 10000); const life = r.cars[0].twLife; const ok1 = r.setTyre(0, 'H', 11000); return ok1 && r.cars[0].twSets.S === 2 && r.cars[0].twSets.H === 1 && r.cars[0].twLife === life && r.cars[0].tyre === 'H'; })());
  ok('...and a tyre that was queued and is now on the car is no longer queued', (() => { const q = race({ ...NOTIME, ...SETS({}) }); q.twQueue(0, 'H', 1); q.setTyre(0, 'H', 2); return q.cars[0].twNext === ''; })());
  ok('...the box never goes below 0', (() => { const q = race({ ...NOTIME, ...SETS({ H: 0 }) }); q.setTyre(0, 'H', 2); return q.cars[0].twSets.H === 0 && q.cars[0].twSets.S === 2 && q.cars[0].tyre === 'H'; })()); }

// ---- a time to change the tyres ----
{ const r = race({ changeSeconds: 4, ...SETS({}) }); r.cross(0, 10000); r.twQueue(0, 'SS', 11000);
  r.block(0, 20000); r.tick(22500);
  ok('while the tyres are being changed the folder shows the tyre that goes on: the queued one', (() => { const d = r.twOf(0, 23000); return d.fitting === 'SS' && r.cars[0].tyre === 'S' && r.cars[0].twSets.SS === 1; })());
  r.tick(24100); r.unblock(0, 24500);
  ok('...the set comes out of the box when it is fitted, not before', r.cars[0].tyre === 'SS' && r.cars[0].twSets.SS === 0 && r.cars[0].twStops === 1);
  const e = race({ changeSeconds: 4, ...SETS({}) }); e.cross(0, 10000); e.twQueue(0, 'SS', 11000); e.block(0, 20000); e.tick(22500); e.unblock(0, 22600);
  ok('a car that leaves before the tyres are changed keeps its tyres, its set stays in the box and the queue stays queued', e.cars[0].tyre === 'S' && e.cars[0].twSets.SS === 1 && e.cars[0].twNext === 'SS' && evs(e, 'tyreearly').length === 1); }

// ---- an interrupted race keeps the boxes ----
{ const r = race({ ...NOTIME, ...SETS({ S: 3 }, 'team') }, { cars: 3, tyres: ['S', 'S', 'M'], team: ['a', 'a', 'b'] });
  r.cross(0, 10000); stop(r, 0, 20000); r.twQueue(1, 'H', 25000); r.pause(26000);
  const snap = r.snapshot(26000), q = race({ ...NOTIME, ...SETS({ S: 3 }, 'team') }, { cars: 3, tyres: ['S', 'S', 'M'], team: ['a', 'a', 'b'] });
  ok('the snapshot restores into a new engine', q.restore(snap) === true);
  ok('...the team box, the queue and the tyres are as they were', same(q.twTeams, r.twTeams) && q.cars[1].twNext === 'H' && q.cars[0].tyre === r.cars[0].tyre && q.twTeams.a.S === r.twTeams.a.S);
  const c = race({ ...NOTIME, ...SETS({}) }); c.cross(0, 10000); stop(c, 0, 20000); c.pause(21000);
  const d = race({ ...NOTIME, ...SETS({}) }); d.restore(c.snapshot(21000));
  ok('...and the box of a car', same(d.cars[0].twSets, c.cars[0].twSets) && d.cars[0].twSets.S === 0); }

// ---- what the screens get ----
{ const r = race({ ...NOTIME, ...SETS({}, 'team') }, { cars: 2, tyres: ['S', 'M'], team: ['a', 'a'] }); const v = T.view(r, [0, 1], 0);
  ok('the rows have the box, the total, the next stop, the way the sets are shared and who shares them', v.rows[0].setsMode === 'team' && v.rows[0].setsTotal === T.setsTotal(r.twTeams.a) && v.rows[0].next.kind === 'same' && v.rows[0].teamName === 'Team a' && same(v.rows[0].teamDrivers, ['D0', 'D1']) && v.rows[0].own === 'S');
  const q = race({}); const w = T.view(q, [0], 0);
  ok('...without a limit: no box', w.rows[0].sets === null && w.rows[0].setsTotal === null && w.rows[0].setsMode === 'none' && w.rows[0].teamName === ''); }

console.log(fails ? `${fails} FAILED` : 'ALL OK');
process.exit(fails ? 1 : 0);
