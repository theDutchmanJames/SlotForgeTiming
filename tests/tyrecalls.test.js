// 1.42.0: Tyre Wear release 3: the audio calls of the group "Tyre wear" (the wear levels, worn out, new tyres, the last set, queued, left too early), the tyre stints of every car, and how the results and the PDF show them.
const E = require('../renderer/engine.js'), T = require('../renderer/tyrewear.js'), W = require('../renderer/weather.js'), A = require('../renderer/announcer.js'), So = require('../renderer/sound.js'), ST = require('../renderer/stats.js'), R = require('../renderer/report.js'), S = require('../schema.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const fuel = (x = {}) => ({ on: true, tank: 100, perLap: 0.5, rate: 10, target: 0, extra: 0, saving: 0, empty: 'retire', pitHold: 2000, ...x });
const entries = (n, tyres = ['S', 'M', 'H', 'W']) => Array.from({ length: n }, (_, i) => ({ lane: i, driverId: 'd' + i, carId: 'c' + i, driverName: 'D' + i, carName: 'car' + i, tyre: tyres[i] }));
// rec: the record of the Tyre Wear System (changeSeconds 0 unless it says otherwise); o: { cars, tyres, ctx (laneLen, disp), type }
const race = (rec = {}, o = {}) => {
  const r = E.createRace({ type: o.type || 'race', laps: 80, duration: 30, endRule: 'all', entries: entries(o.cars || 2, o.tyres), fuel: fuel(), tyrewear: T.clean({ changeSeconds: 0, setsMode: 'none', ...rec }, o.ctx) });
  r.__t = 0; r.start(0); return r;
};
const evs = (r, ...types) => r.events.filter(e => types.includes(e.type));
// n laps of car i (10 seconds each)
const drive = (r, i, n) => { for (let k = 0; k < n; k++) { r.__t += 10000; r.cross(i, r.__t); } };
// one stop with no time for the tyres: the car stops on the sensor, the stop starts after the hold, the car leaves 3 s later
const stop = (r, i) => { const tb = r.__t + 1000; r.block(i, tb); r.tick(tb + 2500); r.unblock(i, tb + 3000); r.__t = tb + 3000; };
const SETS = (n, mode = 'car') => ({ setsMode: mode, sets: { H: 2, M: 2, S: 2, SS: 1, INT: 2, W: 2, ...n } });

// ---- the levels of the Tyre Wear System ----
ok('a new system calls at 50, 25 and 10 percent of life left', same(T.clean({}).calls, [50, 25, 10]) && T.defaults().call1 === 50 && T.defaults().call2 === 25 && T.defaults().call3 === 10);
ok('a record from before 1.42.0 (no levels in it) has the same three levels', same(T.cleanCalls({ name: 'old', warn: 25, crit: 10 }), [50, 25, 10]));
ok('a box that is left empty is no call at that level', same(T.clean({ call1: '', call2: 30, call3: '' }).calls, [30]) && same(T.clean({ call1: '', call2: '', call3: '' }).calls, []) && same(T.clean({ call1: null, call2: '  ', call3: 5 }).calls, [5]));
ok('the levels are whole numbers from 1 to 99, highest first, and the same level is only called once', same(T.clean({ call1: 10, call2: 50, call3: 25 }).calls, [50, 25, 10]) && same(T.clean({ call1: 25, call2: 25.4, call3: '25' }).calls, [25]) && same(T.clean({ call1: 0, call2: 100, call3: 99 }).calls, [99]) && same(T.clean({ call1: -5, call2: 'x', call3: 150 }).calls, []));
{ const t = S.tyrewearsystems, g = t.groups.find(x => x.id === 'warn'), f = k => t.fields.find(x => x.key === k);
  ok('the form has the three levels in the folder Warnings (the colours and the audio), each from 1 to 99, with the standard levels', g.title === 'Warnings' && /audio/.test(g.note) && ['call1', 'call2', 'call3'].every(k => f(k) && f(k).group === 'warn' && f(k).type === 'number' && f(k).min === 1 && f(k).max === 99) && f('call1').default === 50 && f('call2').default === 25 && f('call3').default === 10);
  ok('...and the first one says what the calls are and that an empty box is no call', /once for every set/.test(f('call1').hint) && /Empty = no call/.test(f('call1').hint)); }

// ---- the calls of the group Tyre wear ----
{ const g = A.CALLS.filter(c => c.group === 'Tyre wear');
  ok('the group Tyre wear has six calls, in the order of the design', same(g.map(c => c.id), ['tyrelevel', 'tyreworn', 'tyrenew', 'tyrelast', 'tyrequeued', 'tyreearly']));
  ok('...each is on in a new set and has two sentences that take turns', g.every(c => c.defaultOn !== false && c.lines.length === 2) && So.defaultSet().calls.tyrelevel.on === true && So.defaultSet().calls.tyreearly.lines.length === 2);
  ok('...every sentence only uses words the call has (or the words every call about a driver has)', g.every(c => c.lines.every(l => (l.match(/\{(\w+)\}/g) || []).every(m => c.vars.includes(m.slice(1, -1)) || A.EVERY_DRIVER.includes(m.slice(1, -1)) || A.EVERY_CALL.includes(m.slice(1, -1))))));
  ok('...the words: the wear level call has the percent and what is left, the new tyres call has the sets', g[0].vars.includes('percent') && g[0].vars.includes('left') && g[2].vars.includes('sets') && g[5].vars.includes('percent') && 'sets' in A.VARS && A.SAMPLE.sets === '1' && /tyre wear/.test(A.VARS.percent) && /tyre/.test(A.VARS.left));
  ok('...the group comes after Weather in the audio editor', A.CALLS.findIndex(c => c.group === 'Tyre wear') === A.CALLS.findIndex(c => c.id === 'tyrepenalty') + 1); }

// ---- the wear levels in the engine ----
{ const r = race({ call1: 50, call2: 25, call3: 10 });
  drive(r, 0, 30); // a Soft wears 4.5% a lap: 46% after 12 laps, 24% after 18, 10% after 20 (life 10 exactly is at the level), worn out after 23
  const lv = evs(r, 'tyrelevel');
  ok('every level is called once, as the life goes down to it', same(lv.map(e => e.level), [50, 25, 10]) && lv.every(e => e.tyre === 'S' && e.life <= e.level && e.life > e.level - 5));
  ok('...with the laps that are left at the pace of wear now', lv[0].laps === Math.ceil(lv[0].life / 4.5 - 1e-9) && lv[2].laps === Math.ceil(lv[2].life / 4.5 - 1e-9) && lv.every(e => e.dist === null || typeof e.dist === 'number'));
  ok('...a set that is worn out has its own event, and no level call with it', evs(r, 'tyreworn').length === 1 && !lv.some(e => e.life <= 0) && r.events.findIndex(e => e.type === 'tyreworn') > r.events.findIndex(e => e.type === 'tyrelevel' && e.level === 10));
  drive(r, 0, 5);
  ok('...and nothing more is called while the car drives on worn out tyres', evs(r, 'tyrelevel').length === 3 && evs(r, 'tyreworn').length === 1);
  stop(r, 0); drive(r, 0, 13);
  ok('new tyres: the levels are called again for the new set (50 after 12 laps, 25 after 17)', same(evs(r, 'tyrelevel').slice(3).map(e => e.level), [50]) && (drive(r, 0, 4), same(evs(r, 'tyrelevel').slice(3).map(e => e.level), [50, 25])));
  ok('...a car that did not stop has its own set: the other car has its own levels', evs(r, 'tyrelevel').every(e => e.car === 0)); }
{ const r = race({ call1: 50, call2: 25, call3: 10, tyres: { ...T.defaults().tyres, S: { ...T.defaults().tyres.S, wear: 30 } } });
  drive(r, 0, 5);
  ok('a life that falls past two levels at once says the lowest (100, 70, 40: 50; then 10: 25 and 10 together: 10)', same(evs(r, 'tyrelevel').map(e => e.level), [50, 10]) && evs(r, 'tyreworn').length === 1); }
{ const r = race({ call1: 50, call2: 25, call3: 10, tyres: { ...T.defaults().tyres, S: { ...T.defaults().tyres.S, wear: 60 } } }); drive(r, 0, 3);
  ok('a set that goes from 40% to worn out in one lap says that it is worn out, and no wear level at 0%', same(evs(r, 'tyrelevel').map(e => e.level), [50]) && evs(r, 'tyreworn').length === 1 && !evs(r, 'tyrelevel').some(e => e.life <= 0)); }
{ const r = race({ call1: '', call2: '', call3: '' }); drive(r, 0, 25);
  ok('all three boxes empty: no wear level is called, the worn out tyres still are', !evs(r, 'tyrelevel').length && evs(r, 'tyreworn').length === 1); }
{ const r = race({ call1: '', call2: 30, call3: '' }); drive(r, 0, 25);
  ok('a single level of 30', same(evs(r, 'tyrelevel').map(e => e.level), [30])); }
{ const r = E.createRace({ type: 'race', laps: 80, entries: entries(1), fuel: fuel(), tyrewear: (() => { const c = T.clean({ changeSeconds: 0 }); delete c.calls; return c; })() }); r.__t = 0; r.start(0); drive(r, 0, 25);
  ok('a race that was interrupted before 1.42.0 (its settings have no levels) goes on without level calls', !evs(r, 'tyrelevel').length && evs(r, 'tyreworn').length === 1); }
{ const m = race({ unit: 'distance', tyres: { ...T.defaults().tyres, S: { ...T.defaults().tyres.S, wear: 30 } } }, { ctx: { laneLen: [20, 20], disp: 'm' } }), f = race({ unit: 'distance', tyres: { ...T.defaults().tyres, S: { ...T.defaults().tyres.S, wear: 30 } } }, { ctx: { laneLen: [20, 20], disp: 'ft' } });
  drive(m, 0, 9); drive(f, 0, 9);
  const a = evs(m, 'tyrelevel')[0], b = evs(f, 'tyrelevel')[0];
  ok('a system that counts per distance: the level call says what is left in metres (the lane is 20 m, a Soft wears 30% per 100 m: 6% a lap, so 46% is 153 m, 8 laps)', a && a.level === 50 && a.life === 46 && a.dist === 153 && a.laps === 8);
  ok('...and in feet when the app counts in feet (30% per 100 ft is 19.7% a lap: 40.9% is left after 3 laps, 136 ft)', b && b.life === 41 && b.laps === 3 && Math.abs(b.dist - 136.5) <= 1); }
{ const r = E.createRace({ type: 'race', laps: 20, entries: entries(2), fuel: fuel() }); r.start(0); for (let k = 1; k <= 25; k++) r.cross(0, k * 10000);
  ok('a race without a tyre wear system has no wear events and no stints', !r.events.some(e => /^tyre(level|worn|last)$/.test(e.type)) && r.twStintsOf(0) === null); }

// ---- the last set of a tyre ----
{ const r = race({ ...SETS({ H: 1, M: 2 }) }); r.twQueue(0, 'H', 1000); drive(r, 0, 2); stop(r, 0);
  ok('a car that fits the last set of a tyre: the event says which, and the new tyres say how many sets are left (0)', same(evs(r, 'tyrelast').map(e => e.tyre), ['H']) && evs(r, 'tyrefresh')[0].sets === 0 && r.cars[0].tyre === 'H');
  const q = race({ ...SETS({ M: 3 }) }); q.twQueue(0, 'M', 1000); drive(q, 0, 2); stop(q, 0);
  ok('...a set that is not the last one is not called (the Medium: 3 sets, the second car started on one, so 2 are left, then 1)', !evs(q, 'tyrelast').length && evs(q, 'tyrefresh')[0].sets === 2); }
{ const r = race({}); r.twQueue(0, 'SS', 1000); drive(r, 0, 2); stop(r, 0);
  ok('with no limit on the sets there is no last set, and the new tyres do not say how many are left', !evs(r, 'tyrelast').length && evs(r, 'tyrefresh')[0].sets === undefined && r.cars[0].tyre === 'SS'); }
{ const t = E.createRace({ type: 'race', laps: 80, entries: [{ lane: 0, driverId: 'a', carId: 'a', driverName: 'A', carName: 'a', tyre: 'S', teamId: 't1', teamName: 'Red' }, { lane: 1, driverId: 'b', carId: 'b', driverName: 'B', carName: 'b', tyre: 'M', teamId: 't1', teamName: 'Red' }], fuel: fuel(), tyrewear: T.clean({ changeSeconds: 0, ...SETS({ S: 2, M: 1 }, 'team') }) });
  t.__t = 0; t.start(0); t.twQueue(1, 'S', 100); drive(t, 1, 2); stop(t, 1);
  ok('a team box: the car that takes the last Soft of the team says so (event of that car)', same(evs(t, 'tyrelast').map(e => [e.car, e.tyre]), [[1, 'S']]) && t.twTeams.t1.S === 0); }

// ---- the tyre stints of a car ----
{ const r = race({ changeSeconds: 0 }, { ctx: { laneLen: [10, 12], disp: 'm' } }); drive(r, 0, 3);
  const a = r.twStintsOf(0);
  ok('after three laps one stint: the tyre, the laps, the metres of lane that were driven (the lane is 10 m), the life that is left, and no stop yet', a.stints.length === 1 && a.stints[0].tyre === 'S' && a.stints[0].laps === 3 && a.stints[0].m === 30 && a.stints[0].life === T.shownLife(100 - 3 * 4.5) && a.stops === 0 && a.ms === 0 && a.worn === 0 && a.last === 'S' && a.unit === 'lap');
  ok('...with the warning levels of the system (for the colours of the results)', a.warn === 25 && a.crit === 10);
  stop(r, 0); drive(r, 0, 4);
  const b = r.twStintsOf(0);
  ok('a stop makes a second stint with the laps since, on fresh tyres (the lap of the stop is on the first)', b.stints.length === 2 && b.stints[0].laps === 4 && b.stints[1].laps === 4 && b.stints[0].m === 40 && b.stints[1].m === 40 && b.stints[1].tyre === 'S' && b.stints[0].life === T.shownLife(100 - 4 * 4.5) && b.stints[1].life === T.shownLife(100 - 4 * 4.5) && b.stops === 1);
  ok('...the other car has none of that (no laps: no stints)', r.twStintsOf(1) === null && r.twStintsOf(7) === null); }
{ const r = race({ changeSeconds: 4 }); drive(r, 0, 4); const tb = r.__t + 1000; r.block(0, tb); r.tick(tb + 2500); r.tick(tb + 5200); r.unblock(0, tb + 5300); r.__t = tb + 5300; drive(r, 0, 2);
  const a = r.twStintsOf(0);
  ok('the time the tyres took in the pits is counted (4 seconds), and the stop', a.stops === 1 && a.ms === 4000 && a.stints.length === 2); }
{ const r = race({ zero: 'none' }); drive(r, 0, 26);
  const a = r.twStintsOf(0);
  ok('laps on worn out tyres are counted (the Soft is worn out after 23 laps, and 26 are driven: 3 laps, the one that wore it out is not one of them)', a.worn === 3 && a.stints[0].worn === 3 && a.stints[0].life === 0 && a.stints[0].laps === 26);
  stop(r, 0); drive(r, 0, 2);
  ok('...the fresh set starts again from none', r.twStintsOf(0).stints[1].worn === 0 && r.twStintsOf(0).worn === 4); }
{ const r = race({}); drive(r, 0, 5); r.setTyre(0, 'M', r.__t + 1); drive(r, 0, 3);
  const a = r.twStintsOf(0);
  ok('a correction of the Race Director puts another tyre on the car: a new stint, the life goes on (it was 77.5%, and the Medium wears 3.5% a lap)', a.stints.length === 2 && a.stints[0].tyre === 'S' && a.stints[0].laps === 5 && a.stints[1].tyre === 'M' && a.stints[1].laps === 3 && a.stops === 0);
  const q = race({}); q.setTyre(0, 'H', 5); drive(q, 0, 2);
  ok('...a correction before the first lap only renames the tyre (the car started on it)', q.twStintsOf(0).stints.length === 1 && q.twStintsOf(0).stints[0].tyre === 'H' && q.twStintsOf(0).stints[0].laps === 2); }
{ const r = race({}); drive(r, 0, 3); r.setTyre(0, 'M', r.__t + 1);
  ok('a correction after the last lap leaves no stint of 0 laps (the tyre at the flag is the one that is on the car now)', r.twStintsOf(0).stints.length === 1 && r.twStintsOf(0).stints[0].laps === 3 && r.twStintsOf(0).last === 'M'); }
{ const r = race({}); drive(r, 0, 3); r.setTyre(0, 'M', r.__t + 1); r.setTyre(0, 'H', r.__t + 2); drive(r, 0, 2);
  ok('two corrections with no lap between them make one stint (a stint of 0 laps is not kept)', r.twStintsOf(0).stints.length === 2 && r.twStintsOf(0).stints[1].tyre === 'H' && r.twStintsOf(0).stints[1].laps === 2 && r.twStintsOf(0).stints[0].laps === 3); }
{ const r = race({}); stop(r, 0); drive(r, 0, 3);
  ok('a stop in the first lap: the lap of the stop is on the first set, the laps since on the fresh one', r.twStintsOf(0).stints.length === 2 && r.twStintsOf(0).stints[0].laps === 1 && r.twStintsOf(0).stints[1].laps === 3 && r.twStintsOf(0).stops === 1); }
{ const r = race({ ...SETS({}) }); r.twQueue(0, 'H', 1); drive(r, 0, 4); stop(r, 0); drive(r, 0, 2);
  ok('the tyre at the flag is the tyre that is on the car now', r.twStintsOf(0).last === 'H' && r.twStintsOf(0).stints[1].tyre === 'H');
  const q = race({}); q.restore(r.snapshot(r.__t));
  ok('the stints come back with an interrupted race', same(q.twStintsOf(0), r.twStintsOf(0)) && q.twStintsOf(0).stints.length === 2); }

// ---- what the announcer says ----
{ const r = race({ call1: 50, call2: 25, call3: 10, ...SETS({ H: 1 }) }, { ctx: { laneLen: [], disp: 'm' } }), an = A.create({ driverBy: 'name' }), say = () => an.observe(r, { phase: 'running' });
  say(); // (what is in the log before the race is looked at is not said)
  drive(r, 0, 12); let c = say().filter(x => x.call === 'tyrelevel');
  ok('the wear level call: the driver, the tyre as a word, the life that is left, and what is left in laps', c.length === 1 && c[0].vars.driver === 'D0' && c[0].vars.tyre === 'Soft' && c[0].vars.percent === 46 && /^\d+ laps?$/.test(c[0].vars.left) && c[0].vars.left === `${evs(r, 'tyrelevel')[0].laps} laps`);
  drive(r, 0, 7); c = say().filter(x => x.call === 'tyrelevel');
  ok('...the next level is said when it is reached, not before', c.length === 1 && c[0].vars.percent === 24);
  drive(r, 0, 2); c = say();
  ok('...the third level says the laps that are left (10 percent is 3 laps of a Soft)', c.filter(x => x.call === 'tyrelevel').length === 1 && c.find(x => x.call === 'tyrelevel').vars.percent === 10 && c.find(x => x.call === 'tyrelevel').vars.left === '3 laps');
  drive(r, 0, 3); c = say();
  ok('...the worn out tyres have their call, once, and the level calls stop', c.filter(x => x.call === 'tyreworn').length === 1 && c.find(x => x.call === 'tyreworn').vars.tyre === 'Soft' && c.find(x => x.call === 'tyreworn').vars.driver === 'D0' && !c.some(x => x.call === 'tyrelevel'));
  r.twQueue(0, 'H', r.__t); c = say();
  ok('the Race Director queues a tyre: said with the tyre as a word', c.length === 1 && c[0].call === 'tyrequeued' && c[0].vars.tyre === 'Hard' && c[0].vars.driver === 'D0');
  r.twQueue(0, '', r.__t + 1); c = say();
  ok('...a queue that is cleared says nothing', c.length === 0);
  r.twQueue(0, 'H', r.__t + 2); say(); stop(r, 0); c = say();
  ok('the stop is done: new tyres (with the sets that are left of that tyre), and it was the last set of the Hard', c.filter(x => x.call === 'tyrenew').length === 1 && c.find(x => x.call === 'tyrenew').vars.tyre === 'Hard' && c.find(x => x.call === 'tyrenew').vars.sets === 0 && c.filter(x => x.call === 'tyrelast').length === 1 && c.find(x => x.call === 'tyrelast').vars.tyre === 'Hard');
  ok('...the new tyres are said before the last set', c.findIndex(x => x.call === 'tyrenew') < c.findIndex(x => x.call === 'tyrelast'));
  const early = c.filter(x => x.call === 'tyreearly'); ok('...and nobody left early', early.length === 0); }
{ const r = race({ changeSeconds: 4 }), an = A.create({}), say = () => an.observe(r, { phase: 'running' }); say(); drive(r, 0, 3);
  const tb = r.__t + 1000; r.block(0, tb); r.tick(tb + 2500); r.unblock(0, tb + 3200); r.__t = tb + 3200; const c = say();
  ok('a car that leaves before the tyres are changed: said with the life it still has', c.filter(x => x.call === 'tyreearly').length === 1 && c.find(x => x.call === 'tyreearly').vars.percent === T.shownLife(100 - 4 * 4.5) && c.find(x => x.call === 'tyreearly').vars.tyre === 'Soft' && !c.some(x => x.call === 'tyrenew')); }
{ const r = race({ call1: 4, call2: '', call3: '' }), an = A.create({}); an.observe(r, { phase: 'running' }); drive(r, 0, 22); const c = an.observe(r, { phase: 'running' }).find(x => x.call === 'tyrelevel');
  ok('the last lap of tyre says "1 lap" (singular)', c && c.vars.percent === 1 && c.vars.left === '1 lap'); }
{ const mk = disp => { const r = race({ unit: 'distance', call1: 50, call2: '', call3: '', tyres: { ...T.defaults().tyres, S: { ...T.defaults().tyres.S, wear: 30 } } }, { ctx: { laneLen: [20, 20], disp } }), an = A.create({}); an.observe(r, { phase: 'running' }); drive(r, 0, 9); return an.observe(r, { phase: 'running' }).find(x => x.call === 'tyrelevel'); };
  const m = mk('m'), f = mk('ft');
  ok('in a Distance Race the level call says metres ("40 metres" of tyre left), or feet when the app counts in feet', m && /^\d+ metres$/.test(m.vars.left) && f && /^\d+ feet$/.test(f.vars.left)); }
{ const r = race({ call1: 50, call2: '', call3: '' }), an = A.create({}); an.observe(r, { phase: 'running' }); drive(r, 0, 13);
  ok('only while the race is on: no tyre call is said in the review after the race', !an.observe(r, { phase: 'review' }).some(x => /^tyre/.test(x.call)));
  const r2 = race({ call1: 50, call2: '', call3: '' }), a2 = A.create({}); a2.observe(r2, { phase: 'running' }); drive(r2, 0, 13);
  ok('...and the same events are said when the race is on', a2.observe(r2, { phase: 'running' }).some(x => x.call === 'tyrelevel')); }
{ const set = So.defaultSet(), say = (id, vars) => So.choose(set, id, vars, () => 0);
  ok('the words of the calls are filled in', say('tyrelevel', { driver: 'Alex', percent: 24, left: '5 laps', tyre: 'Soft' }).text === 'Alex, tyres at 24 percent' && say('tyreworn', { driver: 'Alex' }).text === 'Alex\'s tyres are gone, box box' && say('tyrenew', { driver: 'Alex', tyre: 'Hard' }).text === 'Alex, fresh Hard tyres fitted' && say('tyrelast', { driver: 'Alex', tyre: 'Hard' }).text === 'Alex is on the last set of Hard' && say('tyrequeued', { driver: 'Alex', tyre: 'Hard' }).text === 'Alex, Hard tyres for the next stop' && say('tyreearly', { driver: 'Alex' }).text === 'Alex left too early, still on the old tyres');
  ok('...the second sentence of each call too', So.choose(set, 'tyrelevel', { driver: 'Alex', left: '5 laps' }, () => 0.99).text === 'Alex has 5 laps of tyre left');
  const old = { name: 'old', calls: { newleader: { on: true, lines: [{ text: 'x', file: '' }] } } };
  ok('an audio set from before 1.42.0 (it has none of these calls) says them with the ready-made sentences', So.choose(old, 'tyreworn', { driver: 'Sam' }, () => 0).text === 'Sam\'s tyres are gone, box box');
  const off = So.defaultSet(); off.calls.tyrelast.on = false;
  ok('...a call that is switched off is not said', So.choose(off, 'tyrelast', { driver: 'Sam', tyre: 'Soft' }, () => 0) === null); }

// ---- the results: the Tyres column and the stints ----
const row = (name, tyres, extra = {}) => ({ pos: 1, driverName: name, carName: 'c', laps: 24, best: 5000, total: 120000, ...(tyres ? { tyres } : {}), ...extra });
const ty = (stints, o = {}) => ({ unit: 'lap', warn: 25, crit: 10, stops: stints.length - 1, ms: (stints.length - 1) * 4000, worn: stints.reduce((n, q) => n + (q.worn || 0), 0), last: stints[stints.length - 1].tyre, stints, ...o });
const sess = { setupName: 'Sunday', sessionType: 'race', trackName: 'Living room', date: '2026-10-19T10:00:00Z', standings: [
  row('Dutch', ty([{ tyre: 'S', laps: 9, m: 0, life: 18, worn: 0 }, { tyre: 'M', laps: 15, m: 0, life: 31, worn: 0 }])),
  row('Maria', ty([{ tyre: 'M', laps: 12, m: 0, life: 3, worn: 0 }, { tyre: 'H', laps: 12, m: 0, life: 52, worn: 0 }])),
  row('Sam', ty([{ tyre: 'SS', laps: 7, m: 0, life: 0, worn: 1 }, { tyre: 'INT', laps: 9, m: 0, life: 22, worn: 0 }, { tyre: 'M', laps: 8, m: 0, life: 40, worn: 0 }])),
  row('Eli', ty([{ tyre: 'S', laps: 8, m: 0, life: 24, worn: 0 }, { tyre: 'INT', laps: 11, m: 0, life: 19, worn: 0 }, { tyre: 'H', laps: 5, m: 0, life: 88, worn: 0 }])),
  row('Plain', null)] };
{ const cols = ST.SESSION_COLUMNS.find(c => c.key === 'tyres'), figs = ST.forSession(sess, [], [], []);
  ok('the Tyres column is in the list of columns, on by default, and says it is for races with tyre wear', cols && cols.on === true && cols.label === 'Tyres' && /tyre wear/.test(cols.note) && ST.FIGURE_KEYS.includes('tyres'));
  ok('...it shows the tyre at the flag as a word, a dash for a car that has none', ST.text('tyres', figs[0]) === 'Medium' && ST.text('tyres', figs[2]) === 'Medium' && ST.text('tyres', figs[3]) === 'Hard' && ST.text('tyres', figs[4]) === '–' && ST.text('tyres', { tyres: 'INT' }) === 'Intermediate');
  ok('...a session whose cars have no tyre data has no such column, and one with data has it', ST.sessionColumns(sess, figs).some(c => c.key === 'tyres') && !ST.sessionColumns({ ...sess, standings: [row('Plain', null)] }, ST.forSession({ standings: [row('Plain', null)] }, [], [], [])).some(c => c.key === 'tyres')); }
{ const L = ST.tyreStints(sess, 'm');
  ok('the stints of a session: a line for every car that has them (four of five)', L.length === 4 && L.map(x => x.who).join() === 'Dutch,Maria,Sam,Eli');
  const d = L[0].groups[0];
  ok('a bar for every set: the tyre and its laps ("S · 9 laps"), a short form for a narrow bar, the width is the laps', d.stints.map(q => q.label).join('|') === 'S · 9 laps|M · 15 laps' && d.stints.map(q => q.short).join('|') === 'S · 9|M · 15' && d.stints.map(q => q.size).join() === '9,15' && d.total === 24);
  ok('...the Intermediate is an I, the colours are the colours of the tyres', L[2].groups[0].stints[1].label === 'I · 9 laps' && L[2].groups[0].stints[0].color === W.tyreOf('SS').color && L[0].groups[0].stints[1].color === W.tyreOf('M').color && ST.tyreLetter('INT') === 'I' && ST.tyreLetter('H') === 'H');
  ok('...under a bar the life that was left: "off" when the set came off, "flag" for the one at the end', d.stints[0].end === 'off' && d.stints[1].end === 'flag' && d.stints[0].life === 18 && d.stints[1].life === 31);
  ok('...coloured by the levels of the system: 18% is amber, 3% and 0% are red, 31% is green (24 and 19 are amber, 22 amber; the levels of the system are 25 and 10)', d.stints[0].cls === 'warn' && d.stints[1].cls === 'ok' && L[1].groups[0].stints[0].cls === 'crit' && L[2].groups[0].stints[0].cls === 'crit' && L[3].groups[0].stints[0].cls === 'warn' && L[3].groups[0].stints[1].cls === 'warn');
  const custom = ST.tyreStints({ standings: [row('X', ty([{ tyre: 'S', laps: 5, m: 0, life: 40, worn: 0 }], { warn: 50, crit: 45 }))] }, 'm');
  ok('...and by the levels of that system when they are not the standard ones (warn 50, crit 45: 40% is red)', custom[0].groups[0].stints[0].cls === 'crit');
  ok('...the figures at the end of the line: the stops, the tyre time (4.0 s, a dash when it took no time) and the laps on worn out tyres', L[0].stops === 1 && L[0].msText === '4.0 s' && L[2].stops === 2 && L[2].msText === '8.0 s' && L[2].worn === 1 && L[0].worn === 0 && ST.tyreStints({ standings: [row('Z', ty([{ tyre: 'S', laps: 3, m: 0, life: 80, worn: 0 }]))] }, 'm')[0].msText === '–'); }
{ const at = life => ST.tyreStints({ standings: [row('X', ty([{ tyre: 'S', laps: 5, m: 0, life, worn: 0 }]))] }, 'm')[0].groups[0].stints[0].cls;
  ok('the colours change at the level of the system and at the level itself (10% is red, 11% and 25% amber, 26% green, 0% red)', at(10) === 'crit' && at(11) === 'warn' && at(25) === 'warn' && at(26) === 'ok' && at(0) === 'crit'); }
{ const dist = { standings: [row('Dist', ty([{ tyre: 'S', laps: 8, m: 120, life: 40, worn: 0 }, { tyre: 'H', laps: 5, m: 80, life: 70, worn: 0 }], { unit: 'distance' }))] };
  const m = ST.tyreStints(dist, 'm')[0].groups[0], f = ST.tyreStints(dist, 'ft')[0].groups[0];
  ok('a Distance Race counts the stints in metres ("S · 120 m"), in feet when the app does, and the width is the distance', m.stints[0].label === 'S · 120 m' && m.stints[1].label === 'H · 80 m' && m.stints.map(q => q.size).join() === '120,80' && f.stints[0].label === 'S · 394 ft' && /metres|distance/.test(ST.tyreStintsNote(dist))); }
{ const heats = { standings: [row('Heat driver', ty([{ tyre: 'S', laps: 6, m: 0, life: 30, worn: 0, heat: 1 }, { tyre: 'M', laps: 6, m: 0, life: 50, worn: 0, heat: 1 }, { tyre: 'H', laps: 12, m: 0, life: 40, worn: 0, heat: 2 }, { tyre: 'S', laps: 10, m: 0, life: 35, worn: 0, heat: 3, final: 'A' }]))] };
  const g = ST.tyreStints(heats, 'm')[0].groups;
  ok('a heat race: a strip for every heat (and final), each heat starts on fresh tyres, and the last bar of a heat is "flag"', g.map(x => x.label).join() === 'Heat 1,Heat 2,Final A' && g[0].stints.map(q => q.end).join() === 'off,flag' && g[1].stints[0].end === 'flag' && g[2].stints[0].end === 'flag'); }
{ const h = ST.tyreStintsHtml(sess, { distUnit: 'm' }), strips = [...h.matchAll(/class="tys-strip" style="width:([\d.]+)%"/g)].map(x => Number(x[1]));
  ok('the bars are on one scale: the strips of cars that drove the same laps are as long as the longest, a car that stopped early is shorter', strips.length === 4 && strips.every(w => w === 100) && ST.tyreStintsHtml({ standings: [sess.standings[0], row('Early', ty([{ tyre: 'S', laps: 6, m: 0, life: 50, worn: 0 }]))] }, {}).match(/width:([\d.]+)%/g).join().includes('25.00%'));
  ok('...every bar says the tyre and has the whole story as its tooltip', h.includes('S · 9 laps') && h.includes('title="Soft, 9 laps, 18% life left when it came off"') && h.includes('title="Medium, 15 laps, 31% life left at the flag"'));
  ok('...under it "off: 18%" and "flag: 31%", and the names, the stops, the tyre time and the laps at 0%', h.includes('off: <b class="tys-warn">18%</b>') && h.includes('flag: <b class="tys-ok">31%</b>') && h.includes('<span class="tys-nm">Dutch</span>') && h.includes('<span>4.0 s</span>') && h.includes('<span>8.0 s</span>') && h.includes('Laps at 0%'));
  ok('...the laps at 0% are red when there are some, not when there are none', /<span class="tys-bad">1<\/span>/.test(h) && !/<span class="tys-bad">0<\/span>/.test(h));
  ok('...a narrow bar shows the short form (the Hard of 5 laps in a strip of 24: "H · 5")', h.includes('<span>H · 5</span>') && h.includes('<span>S · 8 laps</span>'));
  ok('...the laps on worn out tyres end the bar in red, only when it is asked for', !h.includes('tys-worn') && ST.tyreStintsHtml(sess, { worn: true }).includes('<i class="tys-worn" style="width:14.3%"></i>') && (ST.tyreStintsHtml(sess, { worn: true }).match(/tys-worn/g) || []).length === 1);
  ok('...nothing at all for a session without tyre stints, and names are escaped', ST.tyreStintsHtml({ standings: [row('Plain', null)] }, {}) === '' && ST.tyreStintsHtml({ standings: [row('<b>x</b>', ty([{ tyre: 'S', laps: 3, m: 0, life: 80, worn: 0 }]))] }, {}).includes('&lt;b&gt;x&lt;/b&gt;')); }
{ const a = R.sessionHtml({ session: sess, laps: [], tracks: [], cars: [], unit: 'kmh', distUnit: 'm' });
  ok('the PDF: the tyre stints after the results, with the bars, and the Tyres column in the table', a.includes('<h2>Tyre stints</h2>') && a.includes('tys-strip') && a.includes('<th>Tyres</th>') && a.indexOf('<h2>Results</h2>') < a.indexOf('<h2>Tyre stints</h2>') && a.includes('<td>Medium</td>'));
  ok('...it can be left out (the box "Tyre stints" of the dialog), and then the page has no bars', !R.sessionHtml({ session: sess, laps: [], tracks: [], cars: [], options: { tyres: false } }).includes('Tyre stints'));
  ok('...the laps on worn out tyres in red only with the switch', !a.includes('<i class="tys-worn"') && R.sessionHtml({ session: sess, laps: [], tracks: [], cars: [], options: { tyreWorn: true } }).includes('<i class="tys-worn"'));
  ok('...colours are printed (a PDF does not drop the background of a bar)', /print-color-adjust: exact/.test(a));
  const plain = R.sessionHtml({ session: { ...sess, standings: [row('Plain', null)] }, laps: [], tracks: [], cars: [] });
  ok('a race without tyre wear: the PDF is as it was (no stints, no Tyres column)', !plain.includes('Tyre stints') && !plain.includes('<th>Tyres</th>')); }

console.log(fails ? `${fails} FAILED` : 'ALL OK');
process.exit(fails ? 1 : 0);
