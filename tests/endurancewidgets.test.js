// 1.9.0: the Endurance widgets: Current Driver, Next Driver and Swap Timer, and the custom text variables {nextdriver}, {swap} and {stint}.
const { createRace } = require('../renderer/engine.js'), En = require('../renderer/endurance.js'), Tm = require('../renderer/timing.js'), Wd = require('../renderer/widgets.js');
let fails = 0; const ok = (m, c) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const min = m => m * 60000;
const roster = [{ id: 'd1', name: 'Alex <A>', nickname: 'Speedy', callsign: 'ALX' }, { id: 'd2', name: 'Sam', nickname: '', callsign: 'SAM' }, { id: 'd3', name: 'Kim' }];
const mk = over => { const e = createRace({ type: 'timed', duration: 600, endRule: 'all', endurance: En.clean({ sessionType: 'endurance', swapEvery: 30, swapWarn: 1, swapGrace: 30, ...over }),
  entries: [{ lane: 0, driverId: 'd1', driverName: 'Alex <A>', nickname: 'Speedy', callsign: 'ALX', carId: 'c1', teamId: 'T1', teamName: 'Red', roster }, { lane: 1, driverId: 'd9', driverName: 'Lee', nickname: 'L', callsign: 'LEE', carId: 'c2' }] }); e.start(0); return e; };
const S = (eng, at) => { const st = eng.standings(); return { eng, now: at, phase: 'running', lights: 0, setup: { sessionType: 'timed', duration: 600 }, heat: null, carByLane: l => eng.cars.find(c => c.lane === l) || null, rowOf: c => st.find(r => r.car === c), flashOf: () => null, personalBest: () => Infinity, champ: { on: false, list: [], done: new Map() } }; };
const C = (eng, at, type, lane, opt) => { eng.tick(at); return Tm.content({ type, lane, opt }, S(eng, at)); };

{ const e = mk();
  ok('Current Driver shows the driver at the wheel (written safely), and the Name widget follows a swap too', C(e, min(5), 'currentdriver', 0, {}).html === 'Alex &lt;A&gt;' && C(e, min(5), 'name', 0, {}).html === 'Alex &lt;A&gt;');
  ok('...the nickname or the callsign when the widget says so (the name when the driver has none)', C(e, min(5), 'currentdriver', 0, { show: 'nickname' }).html === 'Speedy' && C(e, min(5), 'currentdriver', 0, { show: 'callsign' }).html === 'ALX');
  ok('...with how long he has been at the wheel when asked', C(e, min(5), 'currentdriver', 0, { stint: true }).html === 'Alex &lt;A&gt; · 5:00' && C(e, min(5), 'currentdriver', 0, { stint: false }).html === 'Alex &lt;A&gt;');
  ok('...a car that does not swap shows its driver, with no time at the wheel', C(e, min(5), 'currentdriver', 1, { stint: true }).html === 'Lee');
  ok('...and nothing for a lane without a car', C(e, min(5), 'currentdriver', 5, {}).html === '');
  ok('Next Driver shows who steps in (in turn: Sam), safely written; nothing when the car does not swap', C(e, min(5), 'nextdriver', 0, {}).html === 'Sam' && C(e, min(5), 'nextdriver', 1, {}).html === '' && C(e, min(5), 'nextdriver', 5, {}).html === '');
  ok('...the nickname (Sam has none: the name) or the callsign, and "Next:" in front when asked', C(e, min(5), 'nextdriver', 0, { show: 'nickname' }).html === 'Sam' && C(e, min(5), 'nextdriver', 0, { show: 'callsign' }).html === 'SAM' && C(e, min(5), 'nextdriver', 0, { prefix: true }).html === 'Next: Sam');
  const t0 = C(e, min(5), 'swaptimer', 0, {});
  ok('Swap Timer counts down to the swap, in words, with no colour while the swap is far off; nothing for a car that does not swap', t0.html === 'Swap in 25:00' && !t0.bg && C(e, min(5), 'swaptimer', 1, {}).html === '' && C(e, min(5), 'swaptimer', 5, {}).html === '');
  ok('...only the clock when the widget says so', C(e, min(5), 'swaptimer', 0, { show: 'clock' }).html === '25:00');
  const soon = C(e, min(29.5), 'swaptimer', 0, {});
  ok('...amber in the warning (the colour is the widget\'s, with text that can be read on it)', soon.html === 'Swap in 0:30' && soon.bg === '#ffb000' && soon.color && C(e, min(29.5), 'swaptimer', 0, { soonColor: '#00ff00' }).bg === '#00ff00');
  const due = C(e, min(30.2), 'swaptimer', 0, {});
  ok('...red when the swap is due, and the clock-only version says NOW', due.html === 'SWAP NOW' && due.bg === '#e03131' && C(e, min(30.2), 'swaptimer', 0, { show: 'clock' }).html === 'NOW' && C(e, min(30.2), 'swaptimer', 0, { dueColor: '#123456' }).bg === '#123456');
  ok('...and says how late the team is when the grace time is over', C(e, min(31), 'swaptimer', 0, {}).html === 'SWAP NOW: 60 s late');
  const w = (type, opt) => ({ type, lane: 0, opt });
  ok('the custom text variables: {nextdriver}, {swap}, {stint} (a dash for a car that does not swap)', Wd.TEXT_LANE_VARS.some(v => v[0] === 'nextdriver') && Wd.TEXT_LANE_VARS.some(v => v[0] === 'swap') && Wd.TEXT_LANE_VARS.some(v => v[0] === 'stint')
    && Tm.content({ type: 'textlane', lane: 0, opt: { text: '{nextdriver}|{swap}|{stint}' } }, S(e, min(31))).html === 'Sam|SWAP NOW: 60 s late|31:00' && Tm.content({ type: 'textlane', lane: 1, opt: { text: '{nextdriver}|{swap}|{stint}' } }, S(e, min(31))).html === '–|–|–'); }

{ const e = mk({ swapMode: 'free', stintMin: 10, stintMax: 0 });
  ok('a free swap: before the shortest stint the timer says from when, then that a swap is allowed, and never turns red', C(e, min(4), 'swaptimer', 0, {}).html === 'Swap from 6:00' && C(e, min(12), 'swaptimer', 0, {}).html === 'Swap when you like' && !C(e, min(12), 'swaptimer', 0, {}).bg && C(e, min(12), 'swaptimer', 0, { show: 'clock' }).html === ''); }
{ const e = mk({ swapUnit: 'laps', swapEvery: 3 });
  ok('swaps counted in laps: the timer counts laps', C(e, 1000, 'swaptimer', 0, {}).html === 'Swap in 3 laps' && C(e, 1000, 'swaptimer', 0, { show: 'clock' }).html === '3 laps'); }
{ const e = mk(); e.cross(0, 60000); e.cross(0, 120000); const lk = C(e, min(5), 'swaptimer', 0, { });
  ok('a car that stands on the sensor for a swap shows how long it has to stand still', (() => { const ee = mk({ swapEvery: 1, swapSeconds: 10 }); ee.tick(min(1.2)); ee.block(0, min(1.2)); return C(ee, min(1.2) + 3000, 'swaptimer', 0, {}).html === 'SWAP NOW · stand still 7 s'; })()); }

const d = k => Wd.def(k);
ok('the three are Team and Swaps widgets, one per lane, with a sample for the layout editor', ['currentdriver', 'nextdriver', 'swaptimer'].every(k => d(k).group === 'Team and Swaps' && d(k).perLane && Wd.sampleOf(d(k), 0, { opt: {} }) !== undefined));
ok('...their settings: which name (and the stint), "Next:", and the words and the two colours', d('currentdriver').options.map(o => o.key).join() === 'show,stint' && d('nextdriver').options.map(o => o.key).join() === 'show,prefix' && d('swaptimer').options.map(o => o.key).join() === 'show,soonColor,dueColor' && d('swaptimer').options.find(o => o.key === 'soonColor').default === '#ffb000' && d('swaptimer').options.find(o => o.key === 'dueColor').default === '#e03131');
console.log(fails ? fails + ' ENDURANCE WIDGET TESTS FAILED' : 'ALL ENDURANCE WIDGET TESTS PASSED'); process.exit(fails ? 1 : 0);
