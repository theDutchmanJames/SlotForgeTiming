// App Settings > Calculations: safe Push & Save benchmark choices and their use by a race.
const Ps = require('../renderer/pushsave.js');
const RaceEngine = require('../renderer/engine.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const near = (a, b) => Math.abs(a - b) < 1e-9;

ok('the calculation page offers every named, safe pace benchmark', Ps.BENCHMARKS.map(x => x[0]).join(',') === 'median,average,weighted,trimmed,last,best,track'
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

ok('weighted average weights newest laps most; rolling history resets the weights',
  near(Ps.benchmark('weighted',[10000,20000,30000]),140000/6)
  && near(Ps.benchmark('weighted',[99000,10000,20000,30000],0,{window:3}),140000/6));
ok('trimmed average drops ten percent at each end, never trims a tiny sample',
  Ps.benchmark('trimmed',[1000,...Array(8).fill(10000),99000])===10000
  && Ps.benchmark('trimmed',[9000,10000,14000])===11000
  && Ps.benchmark('weighted',[10000,12000])===0);
ok('response and estimate choices clean invalid imported numbers and retain defaults',
  Ps.responsePolicy({strength:Infinity,minimum:-5,maximum:500,combine:'other'}).strength===1
  && Ps.responsePolicy({minimum:-5,maximum:500}).minimum===.1
  && Ps.responsePolicy({maximum:500}).maximum===3
  && Ps.estimatePolicy({gapMethod:'other',fuelWindow:999}).fuelWindow===20
  && Ps.estimatePolicy({fuelWindow:1}).fuelWindow===3
  && Ps.calculationSettings().response.combine==='both');
const Sc = require('../renderer/safetycar'), Strategy = require('../renderer/strategywidgets'), Timing = require('../renderer/timing');
function responseRace(combine='both', custom=false) {
  const response=Ps.responsePolicy({combine,custom,strength:2,minimum:.75,maximum:1.3});
  const cfg={type:'race',laps:100,entries:[{lane:0,driverName:'A'}],fuel:{on:true,tank:100,perLap:2,rate:5},
    pushsave:{...Ps.clean({...Ps.defaults(),from:1}),benchmark:'track',trackTarget:10000},
    tyrewear:Tw.clean({paceWear:'on',effect:'off',zero:'none',setsMode:'none'},{pace:{benchmark:'track',trackTarget:10000,response}})};
  const e=RaceEngine.createRace(cfg);e.start(0);e.cars[0].started=true;return e;
}
for(const [mode,factor]of [['both',1.25*1.4],['tyres',1.25],['pushsave',1.4]]){
  const e=responseRace(mode),c=e.cars[0],base=Tw.wearPerLap(e.cfg.tyrewear,c.tyre,'dry',0);e.cross(0,8000);
  ok(`actual wear uses ${mode} contributors; fuel remains independent`,Math.abs(100-c.twLife-base*factor)<.00001&&near(100-c.fuel,2.5));
  ok(`${mode} is retained in saved race rules`,e.snapshot(8000).rulesSnapshot.config.tyrewear.pace.response.combine===mode);
}
{const e=responseRace('both',true),c=e.cars[0],base=Tw.wearPerLap(e.cfg.tyrewear,c.tyre,'dry',0);e.cross(0,8000);
 ok('custom strength is clamped before multiplying Push & Save',Math.abs(100-c.twLife-base*1.3*1.4)<.00001);}
for(const enabled of [true,false]){
 const e=responseRace();e.cfg.pushsave.yellowSave=enabled;const r=RaceEngine.createRace(e.cfg);r.start(0);r.cars[0].started=true;r.setFlag('yellow',0);r.cross(0,20000);const c=r.cars[0];
 ok(`full-yellow saving ${enabled?'on':'off'} changes consumption but never pace history`,near(100-c.fuel,enabled?1.6:2)&&c.psPace.length===0&&c.twPace.length===0&&c.psNow.t===(enabled?.7:1));
}
{const cfg=Ps.clean({...Ps.defaults(),from:1});
 ok('yellow saving works without learned history; disabled side, red and pit exceptions remain neutral',
  Ps.lapEffect(cfg,{yellow:true,lapNo:2}).fuel===.8
  && Ps.lapEffect({...cfg,fuel:{...cfg.fuel,on:false}},{yellow:true,lapNo:2}).fuel===1
  && Ps.lapEffect(cfg,{yellow:true,red:true,lapNo:2}).fuel===1
  && Ps.lapEffect(cfg,{yellow:true,pit:true,lapNo:2}).tyres===1);}
{const e=responseRace(),c=e.cars[0];c.laps=[10000,11000,12000,13000];c.fuel=30;c.fuelSamples=[1,2,3,10].map((used,lap)=>({used,lap}));
 e.cfg.calculations={estimates:{fuelMethod:'median',fuelWindow:3}};
 ok('Fuel Range uses the saved median and history override',Strategy.read('fuelrange',c,{eng:e,now:0},{sampleLaps:20}).value==='≈ 10.0 laps');
 c.invalid=[3];ok('invalidated consumption samples are excluded',Strategy.read('fuelrange',c,{eng:e,now:0}).value==='≈ 15.0 laps');}
{const leader={laps:[10000,10000,40000],lane:0},car={laps:[],lane:1};const rows=[{car:leader,pos:1},{car,pos:2,gapMs:10000}];
 const s={setup:{sessionType:'race'},eng:{cars:[leader,car],cfg:{calculations:{estimates:{gapMethod:'average'}}},gapInfo:()=>[]},standings:()=>rows,rowOf:c=>rows.find(r=>r.car===c)};
 ok('fractional gap uses chosen average without altering the authoritative time gap',Timing.gapLaps(s,car)==='+0.5 laps'&&rows[1].gapMs===10000);
 s.eng.cfg.calculations.estimates={gapMethod:'median'};ok('default median gap remains available',Timing.gapLaps(s,car)==='+1.0 lap');}
{
 const e=responseRace('tyres',true);e.cfg.calculations={response:e.cfg.tyrewear.pace.response,estimates:Ps.estimatePolicy({fuelMethod:'median',fuelWindow:3,gapMethod:'average',gapWindow:4})};
 for(const at of [10000,21000,33000])e.cross(0,at);
 const before=e.snapshot(33000),r=RaceEngine.createRace(e.cfg);ok('recovery preserves custom calculations and does not charge consumption again',r.restore(before)&&r.cars[0].fuel===e.cars[0].fuel&&r.cars[0].twLife===e.cars[0].twLife);
 const s={...ctx,raceId:'expanded-calculations',eng:e,now:33000},v=LS.viewer();v.feedStatic(JSON.parse(JSON.stringify(LS.packStatic(s))));v.feedDynamic(JSON.parse(JSON.stringify(LS.sender().pack(s,s.now))),s.now);
 ok('shared display receives custom response, contributor choice and estimate preferences',v.engine().cfg.tyrewear.pace.response.combine==='tyres'&&v.engine().cfg.tyrewear.pace.response.maximum===1.3&&v.engine().cfg.calculations.estimates.gapWindow===4);
 ok('Fuel Range matches on authoritative, recovered and shared engines',Strategy.read('fuelrange',e.cars[0],{eng:e,now:33000}).value===Strategy.read('fuelrange',r.cars[0],{eng:r,now:33000}).value&&Strategy.read('fuelrange',v.engine().cars[0],{eng:v.engine(),now:33000}).value===Strategy.read('fuelrange',e.cars[0],{eng:e,now:33000}).value);
}
console.log(fails ? `${fails} CALCULATION TESTS FAILED` : 'ALL CALCULATION TESTS PASSED');
process.exit(fails ? 1 : 0);
