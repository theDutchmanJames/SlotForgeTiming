// App Settings > Calculations: safe Push & Save benchmark choices and their use by a race.
const Ps = require('../renderer/pushsave.js');
const RaceEngine = require('../renderer/engine.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const near = (a, b) => Math.abs(a - b) < 1e-9;

ok('the calculation page offers every named, safe pace benchmark', Ps.BENCHMARKS.map(x => x[0]).join(',') === 'median,average,last,best,track'
  && Ps.benchmarkOf('not-a-method') === 'median');
ok('median, average, previous valid lap, best lap and a saved track target each produce their stated reference',
  Ps.benchmark('median', [10000, 10100, 20000, 10200]) === 10150
  && near(Ps.benchmark('average', [10000, 10100, 20000, 10200]), 12575)
  && Ps.benchmark('last', [10000, 10100]) === 10100
  && Ps.benchmark('best', [10000, 10100]) === 10000
  && Ps.benchmark('track', [], 7500) === 7500);
ok('rolling methods wait for three clean laps; last and best are available after one',
  Ps.benchmark('median', [10000, 10100]) === 0 && Ps.benchmark('average', [10000, 10100]) === 0
  && Ps.benchmark('last', [10000]) === 10000 && Ps.benchmark('best', [10000]) === 10000);

const config = benchmark => ({ type: 'race', laps: 20, endRule: 'all', entries: [{ lane: 0, driverName: 'Alex' }], pushsave: { ...Ps.clean({ mode: 'median' }), benchmark } });
const averageRace = RaceEngine.createRace(config('average'));
averageRace.start(0); averageRace.cars[0].started = true;
[10000, 20100, 30400].forEach(t => averageRace.cross(0, t));
ok('the race engine uses the chosen app calculation, not a hard-coded median', near(averageRace.psRef(averageRace.cars[0]).ms, 10133.333333333334) && averageRace.psRef(averageRace.cars[0]).src === 'average');
const trackRace = RaceEngine.createRace({ ...config('track'), pushsave: { ...config('track').pushsave, trackTarget: 7500 } });
ok('a track-target choice is saved with the race and works before any laps are driven', trackRace.psRef(trackRace.cars[0]).ms === 7500 && trackRace.psRef(trackRace.cars[0]).src === 'track');

const Tw = require('../renderer/tyrewear');
ok('history window excludes old outliers and minimum samples gates the reference',
  Ps.benchmark('average', [50000, 10000, 12000], 0, { window: 2, minimum: 2 }) === 11000
  && Ps.benchmark('last', [10000], 0, { minimum: 2 }) === 0
  && Ps.benchmark('best', [8000, 11000, 12000], 0, { window: 2, minimum: 1 }) === 11000
  && Ps.benchmark('track', [], 7500, { minimum: 20 }) === 7500);
ok('non-finite samples do not contaminate a rolling reference', Ps.benchmark('average', [NaN, Infinity, 0, -1, 10000, 12000], 0, { minimum: 2 }) === 11000 && Ps.benchmark('track', [], Infinity) === 0 && Ps.pacePolicy(null).window === 0);
ok('cleaning and the shared config reader retain history policies',
  Ps.fromConfig(Ps.clean({ mode: 'median', pacePolicy: { window: 6, minimum: 4 } })).pacePolicy.minimum === 4);
const tyreCfg = Tw.clean({ paceWear: 'on', effect: 'off' }, { pace: { benchmark: 'average', pacePolicy: { window: 2, minimum: 2 } } });
ok('tyre wear uses its independent selected policy and the actual production multiplier',
  Tw.paceReference(tyreCfg, [30000, 10000, 12000]) === 11000
  && near(Tw.paceMultiplier(tyreCfg, [30000, 10000, 12000], 10000).multiplier, 1.1));
const trackTyres = Tw.clean({ paceWear: 'on' }, { pace: { benchmark: 'track', trackTarget: 10000 } });
ok('track-based tyre wear needs no sample history and missing track target stays neutral',
  Tw.paceMultiplier(trackTyres, [], 8000).multiplier === 1.25
  && Tw.paceMultiplier({ ...trackTyres, pace: { ...trackTyres.pace, trackTarget: 0 } }, [8000, 8000, 8000], 8000).multiplier === 1);
const combinedCfg = { ...config('last'), fuel: { on: true, tank: 100, perLap: 1, rate: 5 },
  pushsave: { ...Ps.clean({ ...Ps.defaults(), from: 1 }), benchmark: 'last', pacePolicy: { window: 2, minimum: 1 } },
  tyrewear: tyreCfg };
const combined = RaceEngine.createRace(combinedCfg); combined.start(0); combined.cars[0].started = true;
[10000, 22000].forEach(t => combined.cross(0, t));
const car = combined.cars[0], fuel = car.fuel, life = car.twLife;
combined.cross(0, 32000);
const baseWear = Tw.wearPerLap(tyreCfg, car.tyre, 'dry', 0);
ok('one lap combines independent tyre pace, Push & Save tyres and fuel without changing measured time',
  car.laps[2] === 10000 && near(fuel - car.fuel, 1.25)
  && Math.abs(life - car.twLife - baseWear * 1.1 * 1.4) < .00001);
combined.setInvalid(0, 1, true);
ok('invalidating a lap rebuilds eligible rolling history before the next reference',
  combined.psRef(car).ms === 10000 && Tw.paceReference(tyreCfg, car.twPace) === 10000);
const snapshot = combined.snapshot(32000), restored = RaceEngine.createRace(combinedCfg);
ok('checkpoint and starting rules retain both independent policies', restored.restore(snapshot)
  && restored.rulesSnapshot().config.pushsave.pacePolicy.window === 2
  && restored.rulesSnapshot().config.tyrewear.pace.benchmark === 'average'
  && restored.psRef(restored.cars[0]).ms === combined.psRef(car).ms);
global.RaceEngine = RaceEngine; global.Stats = require('../renderer/stats');
const LS = require('../renderer/liveshare'), viewer = LS.viewer(), ctx = { raceId: 'calculation-policies', eng: combined, now: 32000, lanes: 1, setup: { sessionType: 'race' }, track: {}, layout: { widgets: [] }, phase: 'running', base: { personal: new Map(), track: Infinity }, flash: new Map(), bestBy: new Map(), bestAll: Infinity };
viewer.feedStatic(JSON.parse(JSON.stringify(LS.packStatic(ctx)))); viewer.feedDynamic(JSON.parse(JSON.stringify(LS.sender().pack(ctx, ctx.now))), ctx.now);
ok('shared viewers receive policy configuration and the authoritative current reference',
  viewer.engine().cfg.tyrewear.pace.benchmark === 'average'
  && viewer.engine().psRef(viewer.engine().cars[0]).ms === combined.psRef(car).ms);

console.log(fails ? `${fails} CALCULATION TESTS FAILED` : 'ALL CALCULATION TESTS PASSED');
process.exit(fails ? 1 : 0);
