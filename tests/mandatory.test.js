// 1.52.0: mandatory stops in the Tyre Wear System: stops for tyres and two different dry tyres, judged when a car finishes, and what a car gets that did not keep the rule.
const E = require('../renderer/engine.js'), T = require('../renderer/tyrewear.js'), S = require('../schema.js'), LS = require('../renderer/liveshare.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const fuel = (x = {}) => ({ on: true, tank: 100, perLap: 0.5, rate: 10, target: 0, extra: 0, saving: 0, empty: 'retire', pitHold: 2000, ...x });
const PEN = { on: true, mode: 'every', every: 5, seconds: 5, steps: [], dq: 0, types: [], fuelPoints: 0 };
const entries = (n, tyres = ['S', 'M', 'H', 'W']) => Array.from({ length: n }, (_, i) => ({ lane: i, driverId: 'd' + i, carId: 'c' + i, driverName: 'D' + i, carName: 'car' + i, tyre: tyres[i] }));
// rec: the record of the Tyre Wear System (no time for the tyres, no sets limit unless it says otherwise); o: { cars, tyres, laps, type, penalty (false: none), cfg }
const race = (rec = {}, o = {}) => {
  const r = E.createRace({ type: o.type || 'race', laps: o.laps || 6, duration: 30, endRule: 'all', entries: entries(o.cars || 2, o.tyres), fuel: fuel(), penalty: o.penalty === false ? undefined : PEN,
    tyrewear: T.clean({ changeSeconds: 0, setsMode: 'none', ...rec }), ...(o.cfg || {}) });
  r.__t = {}; r.start(0); return r;
};
const evs = (r, ...types) => r.events.filter(e => types.includes(e.type));
// one more lap of car i (10 seconds each)
const lap = (r, i) => { r.__t[i] = (r.__t[i] || 0) + 10000; return r.cross(i, r.__t[i]); };
const drive = (r, i, n) => { for (let k = 0; k < n; k++) lap(r, i); };
// a stop with no time for the tyres: the car stops on the sensor, the stop starts after the hold, the car leaves 3 s later
const stop = (r, i) => { const tb = (r.__t[i] || 0) + 1000; r.block(i, tb); r.tick(tb + 2500); r.unblock(i, tb + 3000); r.__t[i] = tb + 3000; };

// ---- the record ----
ok('a new system and a record from before 1.52.0 ask for nothing', T.clean({}).mand === null && T.clean({ name: 'old', changeSeconds: 4 }).mand === null && T.defaults().mandStops === 0 && T.defaults().mandTwo === 'off');
ok('a number of stops asks for them (whole numbers, 0 to 20) with the standard penalty of 30 seconds', same(T.clean({ mandStops: 1 }).mand, { stops: 1, two: false, penalty: 'time', seconds: 30, points: 3 }) && T.clean({ mandStops: '2' }).mand.stops === 2 && T.clean({ mandStops: 2.6 }).mand.stops === 3 && T.clean({ mandStops: 99 }).mand.stops === 20 && T.clean({ mandStops: -4 }).mand === null && T.clean({ mandStops: 'x' }).mand === null);
ok('two different dry tyres is a rule on its own', same(T.clean({ mandTwo: 'on' }).mand, { stops: 0, two: true, penalty: 'time', seconds: 30, points: 3 }) && T.clean({ mandTwo: 'off' }).mand === null && T.clean({ mandTwo: 'yes' }).mand === null);
ok('the penalty is none, time, points or the car is out; anything else is the standard (seconds)', ['none', 'time', 'points', 'dq'].every(k => T.clean({ mandStops: 1, mandPenalty: k }).mand.penalty === k) && T.clean({ mandStops: 1, mandPenalty: 'x' }).mand.penalty === 'time' && same(T.MAND_PENALTIES.map(z => z[0]), ['none', 'time', 'points', 'dq']));
ok('the seconds (to an hour, one decimal) and the points (whole, to 100) are cleaned', T.clean({ mandStops: 1, mandSeconds: '12,5' }).mand.seconds === 12.5 && T.clean({ mandStops: 1, mandSeconds: 99999 }).mand.seconds === 3600 && T.clean({ mandStops: 1, mandSeconds: -3 }).mand.seconds === 0 && T.clean({ mandStops: 1, mandPoints: 2.4 }).mand.points === 2 && T.clean({ mandStops: 1, mandPoints: 500 }).mand.points === 100 && T.clean({ mandStops: 1, mandSeconds: 'x', mandPoints: 'y' }).mand.seconds === 30);

// ---- the rule for one car ----
{ const m = T.clean({ mandStops: 1, mandTwo: 'on' }).mand;
  ok('a stop and two dry tyres keep it', T.mandCheck(m, 1, ['S', 'H']).ok === true && T.mandCheck(m, 3, ['S', 'H', 'M']).ok === true);
  ok('no stop is missed (and only that)', same(T.mandCheck(m, 0, ['S', 'H']).missed, ['stops']) && T.mandCheck(m, 0, ['S', 'H']).tyresOk === true);
  ok('the same tyre twice is one tyre, so the tyres are missed (and only they)', same(T.mandCheck(m, 1, ['S', 'S']).missed, ['tyres']) && same(T.mandCheck(m, 1, ['M']).missed, ['tyres']) && same(T.mandCheck(m, 1, []).missed, ['tyres']));
  ok('both missed are both told, in the order stops, tyres', same(T.mandCheck(m, 0, ['S']).missed, ['stops', 'tyres']));
  ok('a car that raced on Intermediate or Wet tyres has kept the two tyres rule (a wet race), but not the stops', T.mandCheck(m, 1, ['S', 'W']).ok === true && T.mandCheck(m, 1, ['INT']).ok === true && same(T.mandCheck(m, 0, ['W']).missed, ['stops']));
  ok('two different dry tyres: Hard, Medium, Soft and Supersoft are four kinds', T.mandCheck(T.clean({ mandTwo: 'on' }).mand, 0, ['H', 'M']).ok && T.mandCheck(T.clean({ mandTwo: 'on' }).mand, 0, ['S', 'SS']).ok && !T.mandCheck(T.clean({ mandTwo: 'on' }).mand, 0, ['SS', 'SS']).ok);
  ok('without a rule everything is kept', T.mandCheck(null, 0, []).ok === true); }
ok('the rule in words', T.mandText(T.clean({ mandStops: 1 }).mand) === 'Mandatory: at least 1 stop for tyres (30 s added to the race time if not)' && T.mandText(T.clean({ mandStops: 2, mandTwo: 'on', mandPenalty: 'points', mandPoints: 1 }).mand) === 'Mandatory: at least 2 stops for tyres and two different dry tyres (1 penalty point if not)'
  && T.mandText(T.clean({ mandTwo: 'on', mandPenalty: 'dq' }).mand) === 'Mandatory: two different dry tyres (the car is disqualified if not)' && T.mandText(T.clean({ mandStops: 1, mandPenalty: 'none' }).mand) === 'Mandatory: at least 1 stop for tyres (only noted in the results if not)' && T.mandText(null) === ''
  && /mandatory: at least 1 stop for tyres/.test(T.rulesText(T.clean({ mandStops: 1 }))) && !/mandatory/.test(T.rulesText(T.clean({}))));
ok('what a car is told, from the events (nothing when it kept the rule)', T.mandNote([{ type: 'mandatory', car: 0, ok: false, stops: 0, need: 1, missed: ['stops'], how: 'time', ms: 30000 }], 0) === '0 of 1 mandatory stop made, 30 s added'
  && T.mandNote([{ type: 'mandatory', car: 0, ok: false, stops: 1, need: 2, missed: ['stops', 'tyres'], how: 'points', points: 3 }], 0) === '1 of 2 mandatory stops made and two different dry tyres not used, 3 penalty points'
  && T.mandNote([{ type: 'mandatory', car: 1, ok: false, stops: 1, need: 1, missed: ['tyres'], how: 'dq' }], 1) === 'two different dry tyres not used, disqualified'
  && T.mandNote([{ type: 'mandatory', car: 1, ok: false, stops: 0, need: 1, missed: ['stops'], how: 'none' }], 1) === '0 of 1 mandatory stop made'
  && T.mandNote([{ type: 'mandatory', car: 0, ok: true }], 0) === '' && T.mandNote([{ type: 'mandatory', car: 1, ok: false, missed: ['stops'] }], 0) === '' && T.mandNote(undefined, 0) === '' && T.mandNote([null], 0) === ''
  && T.mandNote([{ type: 'mandatory', car: 0, ok: true }, { type: 'mandatory', car: 0, ok: false, stops: 0, need: 1, missed: ['stops'], how: 'none' }], 0) === '0 of 1 mandatory stop made'
  && T.mandNote([{ type: 'mandatory', car: 0, ok: false, stops: 0, need: 1, missed: ['stops'], how: 'time' }, { type: 'mandatory', car: 0, ok: false, stops: 0, need: 1, missed: ['stops'], how: 'points', points: 0 }], 0) === '0 of 1 mandatory stop made, 0 of 1 mandatory stop made');

// ---- the form ----
{ const t = S.tyrewearsystems, f = k => t.fields.find(x => x.key === k), g = t.groups.map(x => x.id);
  ok('the form has a folder Mandatory stops after Pit stops and right before Sets of tyres (1.75.0: Wear in the weather sits between Pit stops and Mandatory stops, as in the rail)', g.indexOf('mand') === g.indexOf('weather') + 1 && g.indexOf('weather') === g.indexOf('pit') + 1 && g.indexOf('sets') === g.indexOf('mand') + 1 && t.groups.find(x => x.id === 'mand').title === 'Mandatory stops');
  ok('...with the stops (0 to 20, none to begin with), the two tyres choice (no to begin with) and what a car gets that did not keep it', f('mandStops').group === 'mand' && f('mandStops').type === 'number' && f('mandStops').min === 0 && f('mandStops').max === 20 && f('mandStops').default === 0 && f('mandTwo').default === 'off' && f('mandTwo').options.length === 2 && same(f('mandPenalty').options.map(o => o[0]), ['none', 'time', 'points', 'dq']) && f('mandPenalty').default === 'time');
  ok('...the seconds only show when the penalty is seconds, the points only when it is points', same(f('mandSeconds').showIf, [{ mandPenalty: ['time'] }]) && same(f('mandPoints').showIf, [{ mandPenalty: ['points'] }]) && f('mandSeconds').default === 30 && f('mandPoints').default === 3);
  ok('...the hints say when a car is judged, that a stop needs tyres fitted, and what is not judged', /tyres were fitted/.test(f('mandStops').hint) && /finishes/.test(f('mandStops').hint) && /stopped by the Race Director is not judged/.test(f('mandStops').hint) && /Intermediate or Wet/.test(f('mandTwo').hint) && /penalty system/.test(f('mandPenalty').hint));
  ok('...the new system has them (the defaults of the form are the defaults of the rules)', same(Object.keys(T.defaults()).filter(k => /^mand/.test(k)).sort(), ['mandPenalty', 'mandPoints', 'mandSeconds', 'mandStops', 'mandTwo'])); }

// ---- a race: judged when a car finishes ----
{ const r = race({ mandStops: 1 }); drive(r, 0, 5);
  ok('a car is not judged before it finishes', evs(r, 'mandatory').length === 0 && r.cars[0].done === false && r.mandOf(0).ok === false && r.mandOf(0).judged === false && r.mandOf(0).need === 1 && r.mandOf(0).stops === 0);
  lap(r, 0);
  const e = evs(r, 'mandatory');
  ok('a car that finishes without the stop is judged on its last lap, and the event says what was missed', r.cars[0].done === true && e.length === 1 && e[0].car === 0 && e[0].ok === false && same(e[0].missed, ['stops']) && e[0].stops === 0 && e[0].need === 1 && e[0].how === 'time' && e[0].t === r.__t[0]);
  ok('...it gets 30 seconds on its race time (and no penalty points)', e[0].ms === 30000 && r.cars[0].extraMs === 30000 && r.penMs(r.cars[0]) === 30000 && r.cars[0].points === 0);
  ok('...and it is told in the note of the tyres', r.tyreNoteOf(0) === '0 of 1 mandatory stop made, 30 s added' && r.tyreNoteOf(1) === '');
  ok('...once (more laps or the end of the race do not judge it again)', (r.cross(0, r.__t[0] + 10000), r.stop(r.__t[0] + 20000), evs(r, 'mandatory').length === 1 && r.cars[0].extraMs === 30000)); }
{ const r = race({ mandStops: 1 }); drive(r, 0, 2); stop(r, 0); drive(r, 0, 4);
  ok('a car that made the stop keeps the rule: the event says so and nothing is given', r.cars[0].done === true && evs(r, 'mandatory').length === 1 && evs(r, 'mandatory')[0].ok === true && evs(r, 'mandatory')[0].how === '' && r.cars[0].extraMs === 0 && r.tyreNoteOf(0) === '' && r.mandOf(0).ok === true && r.mandOf(0).judged === true && r.cars[0].twStops === 1); }
{ const r = race({ mandStops: 2 }); drive(r, 0, 1); stop(r, 0); drive(r, 0, 5);
  ok('two stops are asked for: one is missed', evs(r, 'mandatory')[0].ok === false && evs(r, 'mandatory')[0].stops === 1 && evs(r, 'mandatory')[0].need === 2 && r.tyreNoteOf(0) === '1 of 2 mandatory stops made, 30 s added'); }
{ const r = race({ mandStops: 1, changeSeconds: 4 }); drive(r, 0, 2); const tb = r.__t[0] + 1000; r.block(0, tb); r.tick(tb + 2500); r.unblock(0, tb + 3000); r.__t[0] = tb + 3000; drive(r, 0, 4);
  ok('a stop where the car leaves before the tyres are changed is not a stop (the old tyres stay on)', r.cars[0].twStops === 0 && evs(r, 'mandatory')[0].ok === false && evs(r, 'tyreearly').length === 1); }
{ const r = race({ mandStops: 1, changeSeconds: 4 }); drive(r, 0, 2); const tb = r.__t[0] + 1000; r.block(0, tb); r.tick(tb + 4500); r.unblock(0, tb + 5000); r.__t[0] = tb + 5000; drive(r, 0, 4);
  ok('...and one where the tyres were changed is', r.cars[0].twStops === 1 && evs(r, 'mandatory')[0].ok === true); }

// ---- two different dry tyres ----
{ const r = race({ mandTwo: 'on' }); drive(r, 0, 2); stop(r, 0); drive(r, 0, 4); // the stop gives a fresh set of the same tyre (Soft)
  ok('a stop that gives the same tyre is not a second tyre', evs(r, 'mandatory')[0].ok === false && same(evs(r, 'mandatory')[0].missed, ['tyres']) && r.cars[0].extraMs === 30000 && r.tyreNoteOf(0) === 'two different dry tyres not used, 30 s added'); }
{ const r = race({ mandTwo: 'on' }); drive(r, 0, 2); r.twQueue(0, 'H', r.__t[0]); stop(r, 0); drive(r, 0, 4);
  ok('a stop for another dry tyre (queued by the Race Director) keeps it', evs(r, 'mandatory')[0].ok === true && r.cars[0].tyre === 'H' && r.cars[0].msUsed.join() === 'S,H'); }
{ const r = race({ mandTwo: 'on' }, { cfg: { endRule: 'leader' } }); drive(r, 0, 3); r.twQueue(0, 'H', r.__t[0]); stop(r, 0); drive(r, 1, 6); // (the car is in the pits with the new tyres on when the lead car finishes)
  ok('a tyre that is fitted but never driven on is not used (the car has to drive laps on it)', r.cars[0].twStops === 1 && r.cars[0].tyre === 'H' && r.status === 'finished' && evs(r, 'mandatory').find(e => e.car === 0).ok === false && r.cars[0].msUsed.join() === 'S'); }
{ const r = race({ mandTwo: 'on' }, { tyres: ['W', 'M'] }); drive(r, 0, 6); drive(r, 1, 6);
  ok('a car that raced on Wet tyres keeps the rule, a car on Medium only does not', evs(r, 'mandatory').find(e => e.car === 0).ok === true && evs(r, 'mandatory').find(e => e.car === 1).ok === false); }
{ const r = race({ mandTwo: 'on' }, { tyres: ['S', 'M'] }); drive(r, 0, 2); r.setTyre(0, 'H', 15000); drive(r, 0, 4);
  ok('a tyre the Race Director corrected the car to counts as a tyre that was used (but it is no stop)', r.cars[0].twStops === 0 && evs(r, 'mandatory')[0].ok === true); }

// ---- what a car gets ----
{ const r = race({ mandStops: 1, mandPenalty: 'points', mandPoints: 4 }); drive(r, 0, 6);
  ok('penalty points: given once, with the reason, and the event says how many', r.cars[0].points === 4 && evs(r, 'mandatory')[0].points === 4 && evs(r, 'penalty').length === 1 && evs(r, 'penalty')[0].why === 'mandatory' && evs(r, 'penalty')[0].delta === 4 && r.cars[0].extraMs === 0 && r.tyreNoteOf(0) === '0 of 1 mandatory stop made, 4 penalty points'); }
{ const r = race({ mandStops: 1, mandPenalty: 'points', mandPoints: 4 }, { penalty: false }); drive(r, 0, 6);
  ok('penalty points need a penalty system: without one nothing is given, and the event says so', r.cars[0].points === 0 && evs(r, 'mandatory')[0].noSystem === true && !evs(r, 'mandatory')[0].points && evs(r, 'penalty').length === 0); }
{ const r = race({ mandStops: 1, mandPenalty: 'time', mandSeconds: 12.5 }, { penalty: false }); drive(r, 0, 6);
  ok('seconds work without a penalty system', r.cars[0].extraMs === 12500 && evs(r, 'mandatory')[0].ms === 12500 && r.penMs(r.cars[0]) === 12500 && r.tyreNoteOf(0) === '0 of 1 mandatory stop made, 12.5 s added'); }
{ const r = race({ mandStops: 1, mandPenalty: 'none' }); drive(r, 0, 6);
  ok('nothing: only noted', evs(r, 'mandatory')[0].ok === false && evs(r, 'mandatory')[0].how === 'none' && r.cars[0].extraMs === 0 && r.cars[0].points === 0 && r.cars[0].dq === false && r.tyreNoteOf(0) === '0 of 1 mandatory stop made'); }
{ const r = race({ mandStops: 1, mandPenalty: 'time', mandSeconds: 0 }); drive(r, 0, 6);
  ok('0 seconds is nothing to add', evs(r, 'mandatory')[0].ok === false && !evs(r, 'mandatory')[0].ms && r.cars[0].extraMs === 0); }
{ const r = race({ mandStops: 1, mandPenalty: 'dq' }); drive(r, 0, 6);
  ok('the car is disqualified: it is out of the race, with the event and the log', r.cars[0].dq === true && r.cars[0].retired === true && evs(r, 'disqualified').length === 1 && evs(r, 'disqualified')[0].car === 0 && r.tyreNoteOf(0) === '0 of 1 mandatory stop made, disqualified'); }
{ const r = race({ mandStops: 1, mandPenalty: 'dq' }, { cars: 2 }); drive(r, 0, 6); drive(r, 1, 1); stop(r, 1); drive(r, 1, 5);
  ok('...the other car, that made its stop, finishes and the race ends (a disqualified car does not hold it up)', r.cars[1].done === true && r.cars[1].dq === false && r.status === 'finished'); }

// ---- who is judged, and when ----
{ const r = race({ mandStops: 1 }); drive(r, 0, 3); r.stop(r.__t[0] + 1000);
  ok('a race that the Race Director stops by hand is not judged (the cars had no time left to stop)', r.status === 'finished' && r.endedBy === 'Stopped' && evs(r, 'mandatory').length === 0 && r.cars[0].extraMs === 0); }
{ const r = race({ mandStops: 1 }, { cfg: { endRule: 'leader' } }); drive(r, 1, 3); drive(r, 0, 6);
  ok('when the lead car finishes and the race ends, the cars still driving are judged (as they are classified)', r.status === 'finished' && r.endedBy === 'The lead car finished' && evs(r, 'mandatory').map(e => e.car).sort().join() === '0,1' && r.cars[1].extraMs === 30000); }
{ const r = race({ mandStops: 1 }, { cfg: { endRule: 'leader' } }); drive(r, 0, 6);
  ok('...a car that drove no lap is not judged', evs(r, 'mandatory').map(e => e.car).join() === '0' && r.cars[1].extraMs === 0); }
{ const r = race({ mandStops: 1 }); drive(r, 0, 2); r.cars[0].retired = true; r.cars[0].done = true; drive(r, 1, 6); // (the first car retired: it is out)
  ok('a car that retired is not judged', evs(r, 'mandatory').every(e => e.car !== 0)); }
{ const r = race({ mandStops: 1 }, { type: 'timed', laps: 0, cfg: { duration: 1 } }); drive(r, 0, 3); r.tick(60001); lap(r, 0); lap(r, 1);
  ok('a timed race: a car is judged on its crossing after the time is up', r.cars[0].done === true && evs(r, 'mandatory').length >= 1 && evs(r, 'mandatory')[0].car === 0 && evs(r, 'mandatory')[0].ok === false); }
{ const rec = { mandStops: 1, practice: 'on', qualifying: 'on' }, p = race(rec, { type: 'practice' }), q = race(rec, { type: 'qualifying', cfg: { duration: 1 } });
  drive(p, 0, 8); drive(q, 0, 3); q.tick(60001); lap(q, 0); lap(q, 1); p.stop(100000);
  ok('there is no rule in practice or qualifying, even when the system has tyre wear there (the tyres do wear)', p.tyrewear && q.tyrewear && p.cars[0].twLife < 100 && p.mandOf(0) === null && q.mandOf(0) === null && q.status === 'finished' && evs(p, 'mandatory').length === 0 && evs(q, 'mandatory').length === 0 && q.cars[0].extraMs === 0); }
{ const r = race({}); drive(r, 0, 6);
  ok('a system without a rule judges nothing and has no view', r.mandOf(0) === null && evs(r, 'mandatory').length === 0 && r.tyreNoteOf(0) === ''); }
{ const r = E.createRace({ type: 'race', laps: 6, entries: entries(2), fuel: fuel(), penalty: PEN }); r.__t = {}; r.start(0); drive(r, 0, 6);
  ok('a race without tyre wear is as before (no view, no event)', r.mandOf(0) === null && evs(r, 'mandatory').length === 0 && r.cars[0].done === true); }

// ---- the view of a car ----
{ const r = race({ mandStops: 1, mandTwo: 'on' }); drive(r, 0, 2);
  const v = r.mandOf(0);
  ok('the view says what is asked, what the car has done and whether it is all right now', v.need === 1 && v.two === true && v.stops === 0 && v.dry === 1 && v.stopsOk === false && v.tyresOk === false && v.ok === false && v.judged === false && /^Mandatory: at least 1 stop/.test(v.rule));
  r.twQueue(0, 'H', r.__t[0]); stop(r, 0); drive(r, 0, 1);
  ok('...it follows the race: a stop and a second tyre', r.mandOf(0).stops === 1 && r.mandOf(0).dry === 2 && r.mandOf(0).ok === true && r.mandOf(0).stopsOk && r.mandOf(0).tyresOk); }

// ---- snapshot, resume and sharing ----
{ const r = race({ mandStops: 1 }); drive(r, 0, 2); stop(r, 0); const snap = r.snapshot(r.__t[0] + 1000);
  const r2 = race({ mandStops: 1 }); ok('a race that is carried on after a restart keeps what the car has done', r2.restore(snap) && r2.cars[0].twStops === 1 && r2.cars[0].msUsed.join() === 'S' && r2.mandOf(0).stops === 1);
  const done = race({ mandStops: 1 }); drive(done, 0, 6); const s2 = done.snapshot(done.__t[0] + 1000), r3 = race({ mandStops: 1 });
  ok('...and that it was judged (a finished car is not judged again)', r3.restore(s2) && r3.cars[0].msDone === true && r3.cars[0].extraMs === 30000 && (r3.resume(r3.__t[0] || 0, 100000), true) && r3.cars[0].extraMs === 30000); }
{ const r = race({ mandStops: 1, mandTwo: 'on' }); drive(r, 0, 2); stop(r, 0); drive(r, 0, 1);
  const wire = m => JSON.parse(JSON.stringify(m)), base = { personal: new Map(), track: Infinity, trackName: '' };
  const cx = t => ({ raceId: 'x', eng: r, phase: 'running', calling: false, lights: 5, heat: null, flash: new Map(), bestAll: Infinity, bestAllName: '', bestBy: new Map(), now: t, champ: null });
  const V = LS.viewer(); V.feedStatic(wire(LS.packStatic({ raceId: 'x', eng: r, base }))); const fed = V.feedDynamic(wire(LS.packDynamic(cx(60000))), 60000);
  ok('a viewer (a phone, the Race Director page) builds an engine that knows the rule and what the car has done', fed === true && V.engine().mandOf(0) !== null && V.engine().mandOf(0).need === 1 && V.engine().mandOf(0).stops === 1 && V.engine().mandOf(0).dry === 1 && V.engine().mandOf(0).tyresOk === false && V.engine().mandOf(1).stops === 0);
  drive(r, 0, 3); drive(r, 1, 6); const fed2 = V.feedDynamic(wire(LS.packDynamic(cx(90000))), 90000);
  ok('...and whether a car was judged', fed2 === true && V.engine().mandOf(1).judged === true && V.engine().mandOf(0).judged === true && V.engine().cars[1].extraMs === 30000); }

console.log(fails ? `\n${fails} FAILED` : '\nALL MANDATORY STOP TESTS PASSED');
process.exit(fails ? 1 : 0);
