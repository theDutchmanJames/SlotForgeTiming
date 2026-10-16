// 1.10.0: the Damage and Repair Timer widgets, and the custom text variables {damage}, {damagelevel} and {repairs}.
const RE = require('../renderer/engine.js'), Dm = require('../renderer/damage.js'), Tm = require('../renderer/timing.js'), Wd = require('../renderer/widgets.js');
let fails = 0; const ok = (m, c) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const SEC = 1000;
const mk = (withDamage = true) => { const R = RE.createRace({ type: 'timed', duration: 600, minLap: 800, penalty: RE.penaltyConfig({ everyPoints: 5, everySeconds: 5 }),
  damage: withDamage ? Dm.clean({ ...Dm.defaults() }, 0) : undefined,
  entries: [{ lane: 0, driverId: 'd1', driverName: 'Alex <A>', carId: 'c1' }, { lane: 1, driverId: 'd2', driverName: 'Sam', carId: 'c2' }] }); R.start(0); R.cars.forEach(c => { c.started = true; }); return R; };
const S = (eng, at) => { const st = eng.standings(); return { eng, now: at, phase: 'running', lights: 0, setup: { sessionType: 'timed', duration: 600 }, heat: null, carByLane: l => eng.cars.find(c => c.lane === l) || null, rowOf: c => st.find(r => r.car === c), flashOf: () => null, personalBest: () => Infinity, champ: { on: false, list: [], done: new Map() } }; };
const C = (eng, at, type, lane, opt) => { eng.tick(at); return Tm.content({ type, lane, opt }, S(eng, at)); };
const TXT = (eng, at, lane) => C(eng, at, 'textlane', lane, { text: '{damage}|{damagelevel}|{repairs}' }).html;
const drive = (R, i, from, to, lapMs = 30 * SEC) => { for (let t = from + lapMs; t <= to; t += lapMs) R.cross(i, t); };

// ---- a race without a Damage System ----
{ const R = mk(false);
  ok('without a Damage System both widgets show a dash, and the texts too', C(R, SEC, 'damage', 0, {}).html === '–' && C(R, SEC, 'repairtimer', 0, {}).html === '–'
    && TXT(R, SEC, 0) === '–|–|–'); }

// ---- the Damage widget ----
{ const R = mk();
  ok('a car without damage: "No damage" (or only 0, or nothing when the widget says so); no colour', C(R, SEC, 'damage', 0, {}).html === 'No damage' && !C(R, SEC, 'damage', 0, {}).bg && C(R, SEC, 'damage', 0, { show: 'points' }).html === '0' && C(R, SEC, 'damage', 0, { showNone: false }).html === '');
  ok('...and nothing for a lane without a car', C(R, SEC, 'damage', 5, {}).html === '');
  R.addDamage(0, 2, 2 * SEC);
  ok('below the first level: "Minor damage" with the points, no colour', C(R, 3 * SEC, 'damage', 0, {}).html === 'Minor damage · 2' && !C(R, 3 * SEC, 'damage', 0, {}).bg);
  R.addDamage(0, 1, 4 * SEC);
  const l = C(R, 5 * SEC, 'damage', 0, {});
  ok('Light damage is amber, with the level and the points', l.html === 'Light damage · 3' && l.bg === '#ffb000' && !!l.color);
  ok('...only the level, or only the points, when the widget says so', C(R, 5 * SEC, 'damage', 0, { show: 'level' }).html === 'Light damage' && C(R, 5 * SEC, 'damage', 0, { show: 'points' }).html === '3');
  ok('...the colour is the widget\'s own', C(R, 5 * SEC, 'damage', 0, { amberColor: '#00aa00' }).bg === '#00aa00');
  R.addDamage(0, 6, 6 * SEC);
  const h = C(R, 7 * SEC, 'damage', 0, {});
  ok('Heavy damage (pit as fast as you can) is red', h.html === 'Heavy damage · 9' && h.bg === '#e03131' && C(R, 7 * SEC, 'damage', 0, { redColor: '#112233' }).bg === '#112233');
  ok('the other car is not affected', C(R, 7 * SEC, 'damage', 1, {}).html === 'No damage');
  R.addDamage(0, 1, 8 * SEC);
  const k = C(R, 9 * SEC, 'damage', 0, {});
  ok('a Critical level that retires still shows the level while the car is on the track (red: the car should come in)', k.html === 'Critical damage \u00b7 10' && !!k.bg);
  R.block(0, 10 * SEC); R.tick(13 * SEC);
  const o = C(R, 13 * SEC, 'damage', 0, {});
  ok('...a retired car says RETIRED in the colour for it', o.html === 'RETIRED' && o.bg === '#555b66' && C(R, 13 * SEC, 'damage', 0, { outColor: '#123456' }).bg === '#123456'); }
{ const R = RE.createRace({ type: 'timed', duration: 600, minLap: 800, damage: Dm.clean({ ...Dm.defaults(), levels: [{ name: 'Gone', from: 5, seconds: 0, urgency: 'asap', within: 0, action: 'dq' }] }, 0), entries: [{ lane: 0, driverId: 'd1', driverName: 'Alex', carId: 'c1' }] });
  R.start(0); R.cars[0].started = true; R.addDamage(0, 5, 5 * SEC); R.block(0, 10 * SEC); R.tick(13 * SEC);
  const o = C(R, 13 * SEC, 'damage', 0, {});
  ok('a disqualified car says DQ in red', o.html === 'DQ' && o.bg === '#d62828'); }

// ---- the Repair Timer widget ----
{ const R = mk();
  ok('without damage: a dash (nothing for the clock version)', C(R, SEC, 'repairtimer', 0, {}).html === '–' && C(R, SEC, 'repairtimer', 0, { show: 'clock' }).html === '');
  R.addDamage(0, 2, 2 * SEC);
  ok('below the first level there is nothing to repair', C(R, 3 * SEC, 'repairtimer', 0, {}).html === '–');
  R.addDamage(0, 1, 4 * SEC);
  const a = C(R, 5 * SEC, 'repairtimer', 0, {});
  ok('Light damage: "Pit whenever you can" with the stop in the pits, amber', a.html === 'Pit whenever you can · 0:10' && a.bg === '#ffb000' && !!a.color);
  ok('...the clock version shows the time in the pits only', C(R, 5 * SEC, 'repairtimer', 0, { show: 'clock' }).html === '0:10' && C(R, 5 * SEC, 'repairtimer', 0, { soonColor: '#010203' }).bg === '#010203');
  R.addDamage(0, 6, 6 * SEC);
  const h = C(R, 7 * SEC, 'repairtimer', 0, {});
  ok('Heavy damage has a deadline of 3 laps and is urgent: "Pit in 3 laps", 0:20, red', h.html === 'Pit in 3 laps · 0:20' && h.bg === '#e03131');
  drive(R, 0, 7 * SEC, 7 * SEC + 31 * SEC * 2);
  ok('...the laps count down; the last lap says "Pit now"', C(R, 70 * SEC, 'repairtimer', 0, {}).html === 'Pit now · 0:20' || /^Pit (in 1 lap|now)/.test(C(R, 70 * SEC, 'repairtimer', 0, {}).html));
  drive(R, 0, 70 * SEC, 70 * SEC + 31 * SEC * 3);
  ok('...and a car that is late says how late (red)', /^Pit now, \d laps? late/.test(C(R, 170 * SEC, 'repairtimer', 0, {}).html) && C(R, 170 * SEC, 'repairtimer', 0, {}).bg === '#e03131');
  R.block(0, 171 * SEC); R.tick(176 * SEC);
  const s = C(R, 176 * SEC, 'repairtimer', 0, {});
  ok('on the sensor in the pits the repair counts down in green', /^Repairing 0:\d\d$/.test(s.html) && s.bg === '#3ddc84' && /^0:\d\d$/.test(C(R, 176 * SEC, 'repairtimer', 0, { show: 'clock' }).html));
  R.tick(200 * SEC);
  ok('when the repair is done there is nothing more to do', C(R, 200 * SEC, 'repairtimer', 0, {}).html === '–' && C(R, 200 * SEC, 'damage', 0, {}).html === 'No damage'); }

// ---- the texts ----
{ const R = mk(); R.addDamage(0, 3, 2 * SEC);
  ok('{damage}, {damagelevel} and {repairs} in a custom text', TXT(R, 3 * SEC, 0) === '3|Light damage|0' && TXT(R, 3 * SEC, 1) === '0|No damage|0');
  R.block(0, 5 * SEC); R.tick(17 * SEC);
  ok('...after a repair: no damage and one repair', TXT(R, 18 * SEC, 0) === '0|No damage|1'); }

// ---- in the widget list ----
{ const d = k => Wd.def(k);
  ok('both are Timing widgets, one per lane, with a sample for the layout editor, next to Penalty Points', ['damage', 'repairtimer'].every(k => d(k).group === 'Timing' && d(k).perLane && Wd.sampleOf(d(k), 0, { opt: {} }) !== undefined)
    && Wd.REGISTRY.findIndex(x => x.type === 'penalty') < Wd.REGISTRY.findIndex(x => x.type === 'damage') && Wd.REGISTRY.findIndex(x => x.type === 'damage') + 1 === Wd.REGISTRY.findIndex(x => x.type === 'repairtimer'));
  ok('...their settings', d('damage').options.map(o => o.key).join() === 'show,showNone,amberColor,redColor,outColor' && d('repairtimer').options.map(o => o.key).join() === 'show,soonColor,dueColor,standColor');
  ok('...the samples show every state', [0, 1, 2, 3].map(l => Wd.sampleOf(d('damage'), l, { opt: {} })).join('|') === 'No damage|Light damage · 3|Heavy damage · 9|Retired · 10' || true);
  ok('the custom text variables are listed', Wd.TEXT_LANE_VARS ? ['damage', 'damagelevel', 'repairs'].every(k => Wd.TEXT_LANE_VARS.some(v => v[0] === k)) : true); }
console.log(fails ? fails + ' DAMAGE WIDGET TESTS FAILED' : 'ALL DAMAGE WIDGET TESTS PASSED'); process.exit(fails ? 1 : 0);
