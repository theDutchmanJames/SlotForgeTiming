// 1.53.0: the Safety Car System: the rules and words (safetycar.js), the record and the race setup field (schema.js), and the race engine (engine.js):
// the Safety Car is out while the yellow flag is up, a lap must be slower than the limit, the work in a pit stop takes less time.
const fs = require('fs'), os = require('os'), path = require('path');
const E = require('../renderer/engine.js'), Sc = require('../renderer/safetycar.js'), T = require('../renderer/tyrewear.js'), Dm = require('../renderer/damage.js'), S = require('../schema.js'), LS = require('../renderer/liveshare.js');
const Database = require('../db.js'), Tr = require('../transfer.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---- the rules and the words ----
ok('a new system starts with laps slower than 15 seconds, 1 penalty point for a faster lap and half the time for the work in the pits', same(Sc.DEFAULTS, { target: 15, points: 1, pitPercent: 50 }) && same(Sc.defaults(), Sc.DEFAULTS) && Sc.defaults() !== Sc.DEFAULTS && Sc.MAX_PIT === 90);
ok('no record, no system (and a record that is not a record is none either)', Sc.clean(null) === null && Sc.clean(undefined) === null && Sc.clean('x') === null && Sc.clean(5) === null);
ok('an empty record gets the standard numbers, with the target in milliseconds', same(Sc.clean({}), { target: 15000, points: 1, pit: 50 }) && same(Sc.clean({ name: 'GP', target: '', points: '', pitPercent: '' }), { target: 15000, points: 1, pit: 50 }));
ok('the numbers of a record are kept: seconds (one decimal and more), whole penalty points, whole percent', same(Sc.clean({ target: 20, points: 3, pitPercent: 25 }), { target: 20000, points: 3, pit: 25 }) && Sc.clean({ target: 12.5 }).target === 12500 && Sc.clean({ points: 2.9 }).points === 2 && Sc.clean({ pitPercent: 33.4 }).pit === 33);
ok('...within their limits: the limit on the lap time to an hour, the points 0 to 100, the percent 0 to 90 (a stop is never shorter than a tenth)', Sc.clean({ target: 99999 }).target === 3600000 && Sc.clean({ target: -4 }).target === 0 && Sc.clean({ points: 500 }).points === 100 && Sc.clean({ points: -3 }).points === 0 && Sc.clean({ pitPercent: 100 }).pit === 90 && Sc.clean({ pitPercent: -5 }).pit === 0 && Sc.clean({ pitPercent: 0 }).pit === 0);
ok('...no limit on the lap time (0) means no penalty points either, and a text that is no number is the standard', same(Sc.clean({ target: 0, points: 4 }), { target: 0, points: 0, pit: 50 }) && Sc.clean({ target: 'abc' }).target === 15000 && Sc.clean({ pitPercent: 'abc' }).pit === 50);
ok('a config that was cleaned before (and sent to another window) is made safe again, and is the same when it was safe already', Sc.fromConfig(null) === null && Sc.fromConfig('x') === null && same(Sc.fromConfig(Sc.clean({ target: 20, points: 3, pitPercent: 25 })), Sc.clean({ target: 20, points: 3, pitPercent: 25 })) && same(Sc.fromConfig({ target: -5, points: 3, pit: 200 }), { target: 0, points: 0, pit: 90 }) && same(Sc.fromConfig({ target: 15000.4, points: 2.9, pit: -1 }), { target: 15000, points: 2, pit: 0 }) && same(Sc.fromConfig({}), { target: 0, points: 0, pit: 0 }));
ok('the work in a stop takes this part of the usual time: 50% less is half, 25% less three quarters, nothing less (or no system) is the usual time, and never less than a tenth', Sc.factor({ pit: 50 }) === 0.5 && Sc.factor({ pit: 25 }) === 0.75 && Sc.factor({ pit: 90 }) === 0.1 && Sc.factor({ pit: 0 }) === 1 && Sc.factor(null) === 1 && Sc.factor(undefined) === 1 && Sc.factor({ pit: 200 }) === 0.1 && Sc.factor({ pit: 33 }) === 0.67);
ok('the rules in one line: the limit on the lap time with its points, and the pit work', Sc.rulesText(Sc.clean({})) === 'Safety Car: laps slower than 15 s (1 penalty point for a faster lap), pit work 50% shorter' && Sc.rulesText(Sc.clean({ points: 2, target: 12.5 })) === 'Safety Car: laps slower than 12.5 s (2 penalty points for a faster lap), pit work 50% shorter');
ok('...only what applies: no points, no pit work, or neither (only the flag); no system says nothing', Sc.rulesText(Sc.clean({ points: 0 })) === 'Safety Car: laps slower than 15 s, pit work 50% shorter' && Sc.rulesText(Sc.clean({ target: 0, pitPercent: 40 })) === 'Safety Car: pit work 40% shorter' && Sc.rulesText(Sc.clean({ pitPercent: 0 })) === 'Safety Car: laps slower than 15 s (1 penalty point for a faster lap)' && Sc.rulesText(Sc.clean({ target: 0, pitPercent: 0 })) === 'Safety Car: no rules, only the flag' && Sc.rulesText(null) === '');
ok('the log says when it came out and went in, and after which lap', Sc.eventText({ type: 'safetycar', out: true, laps: 3 }) === 'Safety Car out (after lap 3)' && Sc.eventText({ type: 'safetycar', out: false, laps: 12 }) === 'Safety Car in (after lap 12)' && Sc.eventText({ out: true, laps: 0 }) === 'Safety Car out' && Sc.eventText({ out: false }) === 'Safety Car in' && Sc.eventText(null) === '');
ok('seconds in words (one decimal)', Sc.secText(15000) === '15 s' && Sc.secText(12500) === '12.5 s' && Sc.secText(7550) === '7.6 s');

// ---- the record (the form) and the field of the race setup ----
{ const sys = S.safetycarsystems, f = k => sys.fields.find(x => x.key === k), setup = k => S.racesetups.fields.find(x => x.key === k), g = sys.groups.map(x => x.id);
  const shown = (fld, rec) => !fld.showIf || fld.showIf.some(c => Object.entries(c).every(([k, vs]) => vs.includes(rec[k] ?? '')));
  ok('the safety car systems are a table of the database, with a name and cards that show the limit and the pit work', sys && sys.label === 'Safety car system' && sys.plural === 'Safety car systems' && same(sys.title, ['name']) && same(sys.list, ['name', 'target', 'pitPercent']) && same(sys.card, ['target', 'pitPercent']) && sys.extra === false);
  ok('...the form has the group Behind the Safety Car (1.76.0: Basics, Lap times and Pit stops are one, as in the design) and the random flags (1.59.0), which are three groups in one section that starts closed', same(g, ['behind', 'random', 'when', 'ends']) && sys.groups.every(x => x.title && x.note) && sys.groups.find(x => x.id === 'random').open === false && sys.groups.find(x => x.id === 'behind').title === 'Behind the Safety Car' && same(sys.rail.map(x => x.id), ['behind', 'flags']) && sys.rail.find(x => x.id === 'flags').groups.join() === 'random,when,ends' && !sys.rail.find(x => x.id === 'flags').open);
  ok('...the limit on the lap time (seconds, 0 to an hour), the penalty points (0 to 100) and the percent of the pit work (0 to 90) with the standard numbers as the starting values, in the folder that fits', f('target').group === 'behind' && f('target').min === 0 && f('target').max === 3600 && f('target').default === 15 && f('points').group === 'behind' && f('points').min === 0 && f('points').max === 100 && f('points').default === 1 && f('pitPercent').group === 'behind' && f('pitPercent').min === 0 && f('pitPercent').max === 90 && f('pitPercent').default === 50 && ['target', 'points', 'pitPercent'].every(k => f(k).type === 'number'));
  ok('...the hints say what a lap that is too fast is, that a lap that began before the Safety Car does not count, that a penalty system is needed for points, and what is not made shorter', /too fast/.test(f('target').hint) && /partly before the Safety Car came out does not count/.test(f('target').hint) && /penalty system/.test(f('points').hint) && /Driver swaps/.test(f('pitPercent').hint) && /Fixed when a car comes in/.test(f('pitPercent').hint));
  ok('a race setup has a Safety car system field in the rules, a choice of the systems, "No safety car" to begin with, for the sessions that race', setup('safetyCar') && setup('safetyCar').group === 'rules' && setup('safetyCar').type === 'ref' && setup('safetyCar').ref === 'safetycarsystems' && setup('safetyCar').blank === 'No safety car' && same(setup('safetyCar').showIf, setup('tyreWear').showIf));
  ok('...it sits with the other systems and its hint says it replaces the Yellow flag settings', setup('safetyCar').group === 'rules' && /replaces the Yellow flag settings/.test(setup('safetyCar').hint));
  const race = { sessionType: 'race' }, ses = k => ({ sessionType: k });
  ok('the retired Yellow flag fields are no longer separately configured: a Safety Car rule now applies to every yellow flag', !setup('yellowTarget') && !setup('yellowPoints') && !S.racesetups.groups.some(x => x.id === 'yellow') && !shown(setup('safetyCar'), ses('rotation')) && shown(setup('safetyCar'), race));
  ok('the form includes its pace and pit toggles, the optional Track reference and every setting that clean() reads', same(sys.fields.filter(x => x.type !== 'sctimeline').map(x => x.key).sort(), ['name', 'safetyTrack', 'targetOn', 'target', 'pointsOn', 'points', 'pitOn', 'pitPercent', 'rndOn', 'rndPitExit', 'rndNote', 'rndChance', 'rndMode', 'rndMin', 'rndMax', 'rndMore', 'rndEnd', 'rndLenMode', 'rndLen', 'rndLenMax', 'rndFrom', 'rndTo', 'rndGap', 'rndFree', 'rndWarn'].sort()) && sys.fields.filter(x => x.type === 'sctimeline').length === 1); }

// ---- the race engine ----
const fuel = (x = {}) => ({ on: true, tank: 100, perLap: 0.5, rate: 10, target: 0, extra: 0, saving: 0, empty: 'retire', pitHold: 2000, ...x });
const PEN = { on: true, mode: 'every', every: 5, seconds: 5, steps: [], dq: 0, types: [{ name: 'SG10', kind: 'stopgo', seconds: 10, cost: 0, extra: 0, unserved: 0 }], fuelPoints: 0 };
const entries = n => Array.from({ length: n }, (_, i) => ({ lane: i, driverId: 'd' + i, carId: 'c' + i, driverName: 'D' + i, carName: 'car' + i }));
// rec: the record of the Safety Car System (null: none); o: { cars, laps, type, fuel (false: none), penalty (false: none), cfg }
const race = (rec, o = {}) => {
  const r = E.createRace({ type: o.type || 'race', laps: o.laps || 20, duration: 30, endRule: 'all', entries: entries(o.cars || 2), fuel: o.fuel === false ? undefined : fuel(), penalty: o.penalty === false ? undefined : PEN,
    safetycar: rec === null ? undefined : Sc.clean(rec), ...(o.cfg || {}) });
  r.start(0); r.cars.forEach(c => { c.started = true; }); return r;
};
const evs = (r, ...types) => r.events.filter(e => types.includes(e.type));
const sc = r => evs(r, 'safetycar').map(e => [e.out, e.laps]);

// no system: nothing changes
{ const r = race(null, { cfg: { yellow: { target: 12000, points: 1 } } });
  ok('a race without a Safety Car System has none, and the yellow flag is a flag as it was (nothing in the log)', r.safetyCar === null && r.scOut() === false && (r.setFlag('yellow', 1000), r.scOut() === false) && r.flag === 'yellow' && sc(r).length === 0 && (r.setFlag('yellow', 2000), sc(r).length === 0));
  const q = race(null, { cfg: { yellow: { target: 12000, points: 1 } } }); q.setFlag('yellow', 0); q.cross(0, 5000); q.cross(0, 9000); q.cross(0, 25000);
  ok('...the yellow flag target of the race setup works as before: laps faster than 12 s are called out, the points are given', evs(q, 'yellowfast').length === 2 && evs(q, 'yellowfast')[0].target === 12000 && q.cars[0].points === 2);
  const p = race(null, { cfg: { yellow: { target: 12000, points: 1 }, safetycar: 'nonsense' } });
  ok('...also when the setting that came with the race is not a setting (it is no system)', p.safetyCar === null && (p.setFlag('yellow', 0), p.scOut() === false)); }

// the flag
{ const r = race({});
  ok('a race with a system keeps its cleaned settings, and the Safety Car is not out before the yellow flag goes up', same(r.safetyCar, { target: 15000, points: 1, pit: 50 }) && r.scOut() === false && sc(r).length === 0);
  r.cross(0, 9000); r.cross(0, 19000); r.cross(1, 11000);
  r.setFlag('yellow', 20000);
  ok('the yellow flag puts the Safety Car out: one line in the log, after the laps of the leader', r.scOut() === true && same(sc(r), [[true, 2]]) && evs(r, 'safetycar')[0].t === 20000 && evs(r, 'safetycar')[0].car === -1);
  r.setFlag('yellow', 30000);
  ok('...the same flag again brings it in: a second line', r.scOut() === false && r.flag === '' && same(sc(r), [[true, 2], [false, 2]]));
  r.setFlag('yellow', 31000); r.setFlag('red', 32000);
  ok('a red flag over the Safety Car brings it in (the race stops: the cars do not drive behind it), and it stays in when the red flag goes', r.flag === 'red' && r.scOut() === false && same(sc(r), [[true, 2], [false, 2], [true, 2], [false, 2]]) && (r.setFlag('red', 40000), r.flag === '' && r.scOut() === false && sc(r).length === 4));
  r.setFlag('red', 41000); r.setFlag('yellow', 42000);
  ok('...a yellow flag while the red flag is up does nothing', r.flag === 'red' && r.scOut() === false && sc(r).length === 4); }
{ const r = race({}); r.cross(0, 9000);
  const c = r.call(1, 12000);
  ok('a marshal call from a lane raises the yellow flag, and with it the Safety Car', c && r.flag === 'yellow' && r.scOut() === true && same(sc(r), [[true, 1]]));
  ok('...a second call while it is out changes nothing (no second line), and a call never brings it in', r.call(0, 13000) && sc(r).length === 1 && r.scOut() === true && (r.setFlag('yellow', 14000), r.scOut() === false) && sc(r).length === 2);
  const q = race({}); q.setFlag('red', 1000); q.call(0, 2000);
  ok('...and a call while the red flag is up raises nothing', q.flag === 'red' && sc(q).length === 0 && q.scOut() === false);
  const n = race(null); n.call(0, 2000);
  ok('...without a system the call raises the yellow flag as before, and says nothing about a Safety Car', n.flag === 'yellow' && n.scOut() === false && sc(n).length === 0); }
{ const r = race({}, { laps: 2 }); r.cross(0, 9000); r.setFlag('yellow', 10000); r.cross(0, 25000); r.cross(1, 20000); r.cross(1, 40000);
  ok('when the race ends with the Safety Car out, it goes in (the flag is cleared at the end: one last line, so the log is true)', r.status === 'finished' && r.flag === '' && r.scOut() === false && same(sc(r), [[true, 1], [false, 2]]) && evs(r, 'safetycar')[1].t === r.endAt);
  const q = race({}, { laps: 2 }); q.cross(0, 9000); q.cross(0, 18000); q.cross(1, 19000); q.cross(1, 29000);
  ok('...a race that ended without it has no line', q.status === 'finished' && sc(q).length === 0); }

// the lap that is too fast
const fast = (rec, o = {}) => {
  const r = race(rec, o); r.setFlag('yellow', 0);
  r.cross(0, 8000); r.cross(0, 16000); r.cross(0, 31000); r.cross(0, 46000); return r;
};
{ const r = fast({ target: 15, points: 2 });
  ok('under the Safety Car a lap faster than the limit is called out (the lap, its time, the limit) and gets the penalty points: laps of 8 s and 8 s are too fast, 15 s is not (exactly the limit is allowed), neither is 15 s again', same(evs(r, 'yellowfast').map(e => [e.lap, e.ms, e.target, e.points]), [[1, 8000, 15000, 2], [2, 8000, 15000, 2]]) && r.cars[0].points === 4 && same(r.cars[0].yellowFast, [0, 1]));
  ok('...the call-out comes before the penalty (the order in the log)', r.events.findIndex(e => e.type === 'yellowfast') < r.events.findIndex(e => e.type === 'penalty' || e.type === 'points'));
  const s = fast({ target: 15, points: 0 });
  ok('0 penalty points: the lap is called out and marked, nobody gets a point', evs(s, 'yellowfast').length === 2 && evs(s, 'yellowfast').every(e => e.points === 0) && s.cars[0].points === 0 && s.cars[0].yellowFast.length === 2);
  const n = fast({ target: 15, points: 2 }, { penalty: false });
  ok('...also without a penalty system (only called out and marked: the points need that system)', evs(n, 'yellowfast').length === 2 && evs(n, 'yellowfast').every(e => e.points === 0) && n.cars[0].points === 0);
  const z = fast({ target: 0, points: 2 });
  ok('no limit (0 seconds): no lap is too fast, whatever the points say', evs(z, 'yellowfast').length === 0 && z.cars[0].points === 0 && z.scOut() === true);
  const o = race({ target: 15, points: 1 }); o.cross(0, 8000); o.cross(1, 7000); o.setFlag('yellow', 9000); o.cross(0, 16000); o.cross(1, 15000);
  ok('a lap that began before the Safety Car came out does not count, even if it is fast; the next one does', evs(o, 'yellowfast').length === 0 && (o.cross(0, 24000), o.cross(1, 23000), evs(o, 'yellowfast').map(e => e.car).join() === '0,1'));
  const g = race({ target: 15, points: 1 }); g.setFlag('yellow', 0); g.cross(0, 8000); g.setFlag('yellow', 9000); g.cross(0, 16000);
  ok('...a lap that ended after the Safety Car went in does not count either (it was partly green)', evs(g, 'yellowfast').length === 1 && evs(g, 'yellowfast')[0].lap === 1 && g.scOut() === false);
  const w = race({ target: 15, points: 1 }, { cfg: { yellow: { target: 5000, points: 9 } } }); w.setFlag('yellow', 0); w.cross(0, 8000); w.cross(1, 4000);
  ok('a system replaces the Yellow flag fields of the race setup: the limit of the system counts (8 s is too fast for it, not for the 5 s of the setup) and so do its points', evs(w, 'yellowfast').length === 2 && w.cars[0].points === 1 && w.cars[1].points === 1 && evs(w, 'yellowfast').every(e => e.target === 15000));
  const k = race({ target: 15, points: 1 }); k.setFlag('yellow', 0); k.cross(0, 8000); k.setFlag('yellow', 9000); k.setFlag('yellow', 10000); k.cross(0, 16000); k.cross(0, 40000); k.cross(0, 48000);
  ok('...it is the Safety Car that is out that counts: a new one starts again with a new start of the laps (the lap that ends at 48 s began at 40 s, after the second one went out at 10 s: too fast)', evs(k, 'yellowfast').map(e => e.lap).join() === '1,4' && k.cars[0].points === 2); }

// the work in a stop
const stopTyres = (rec, scOut) => {
  const r = race(rec, { fuel: false, cfg: { tyrewear: T.clean({ changeSeconds: 10, setsMode: 'none' }) } }); r.cross(0, 10000); if (scOut) r.setFlag('yellow', 11000);
  r.block(0, 12000); r.tick(14100); return r;
};
{ const a = stopTyres({ pitPercent: 50 }, true), b = stopTyres({ pitPercent: 50 }, false), c = stopTyres(null, false), d = stopTyres({ pitPercent: 0 }, true);
  ok('changing tyres takes 50% less time when the car comes in under the Safety Car: 10 s is 5 s from the moment the car stops on the sensor', a.cars[0].scf === 0.5 && a.twOf(0, 12000).fitLeft === 5000 && a.twOf(0, 15000).fitLeft === 2000 && a.twOf(0, 17000).fitLeft === 0);
  ok('...a car that comes in with the Safety Car in, and a race without one, take the 10 s (the factor is 1)', b.cars[0].scf === 1 && b.twOf(0, 12000).fitLeft === 10000 && c.cars[0].scf === 1 && c.twOf(0, 12000).fitLeft === 10000);
  ok('...0% shorter changes nothing', d.cars[0].scf === 1 && d.twOf(0, 12000).fitLeft === 10000);
  const e = stopTyres({ pitPercent: 50 }, true); e.setFlag('yellow', 13000);
  ok('...it is fixed when the car comes in: the Safety Car that goes in during the stop does not make it longer', e.scOut() === false && e.cars[0].scf === 0.5 && e.twOf(0, 12000).fitLeft === 5000);
  const f = stopTyres({ pitPercent: 50 }, false); f.setFlag('yellow', 13000);
  ok('...and one that comes out during the stop does not make it shorter', f.scOut() === true && f.cars[0].scf === 1 && f.twOf(0, 12000).fitLeft === 10000);
  ok('...the factor is made at each arrival: the next stop of the car with the Safety Car in is the usual one, the one after that, with it out again, is short again', (a.unblock(0, 20000), a.setFlag('yellow', 21000), a.cross(0, 30000), a.block(0, 32000), a.cars[0].scf === 1 && (a.unblock(0, 40000), a.setFlag('yellow', 41000), a.cross(0, 50000), a.block(0, 52000), a.cars[0].scf === 0.5))); }
const stopFuel = (rec, scOut) => {
  const r = race(rec); r.cross(0, 10000); r.cars[0].fuel = 50; if (scOut) r.setFlag('yellow', 11000);
  r.block(0, 12000); r.tick(14010); return r;
};
{ const a = stopFuel({ pitPercent: 50 }, true), b = stopFuel({ pitPercent: 50 }, false), d = stopFuel({ pitPercent: 0 }, true), z = stopFuel({ pitPercent: 90 }, true);
  ok('refuelling goes twice as fast under the Safety Car with 50% (the tank fills at twice the rate: 50 litres take 2.5 s, not 5 s)', a.cars[0].scf === 0.5 && a.cars[0].pit.rate === 20 && a.fuelOf(0, 14000 + 2500) > 99 && b.fuelOf(0, 14000 + 2500) < 76 && b.fuelOf(0, 14000 + 5000) > 99 && a.fuelOf(0, 14000 + 5000) === 100);
  ok('...a stop with the Safety Car in is as it was, and so is 0% shorter', b.cars[0].scf === 1 && b.cars[0].pit.rate === undefined && d.cars[0].scf === 1 && d.cars[0].pit.rate === undefined && d.fuelOf(0, 14000 + 2500) < 76);
  ok('...90% shorter is ten times as fast', z.cars[0].scf === 0.1 && z.cars[0].pit.rate === 100 && z.fuelOf(0, 14000 + 600) > 99); }
const stopRepair = (rec, scOut, ex = {}) => {
  const r = race(rec, { fuel: false, cfg: { damage: Dm.clean({ ...Dm.defaults() }, 0), ...ex } }); r.cross(0, 10000); r.addDamage(0, 3, 10500, 'hit'); if (scOut) r.setFlag('yellow', 11000);
  r.block(0, 12000); r.tick(14100); [4000, 5000, 9000, 10000, 11000].forEach(d => r.tick(12000 + d)); return r;
};
{ const a = stopRepair({ pitPercent: 50 }, true), b = stopRepair({ pitPercent: 50 }, false);
  ok('a repair takes 50% less time under the Safety Car: light damage (10 s) is repaired in 5 s, and the repair is logged with its time', same(a.cars[0].repairs.map(x => x.ms), [5000]) && a.cars[0].repairMs === 5000 && a.cars[0].dmg === 0 && same(b.cars[0].repairs.map(x => x.ms), [10000]));
  const c = stopRepair({ pitPercent: 25 }, true); const d = stopRepair({ pitPercent: 0 }, true);
  ok('...25% less is 7.5 s, 0% less is the usual time', same(c.cars[0].repairs.map(x => x.ms), [7500]) && same(d.cars[0].repairs.map(x => x.ms), [10000])); }
{ const r = race({ pitPercent: 50 }, { fuel: false }); r.cross(0, 10000); r.assign(0, 0, 10500); r.setFlag('yellow', 11000); r.block(0, 12000); r.tick(14100); r.tick(12000 + 6000);
  const early = evs(r, 'served').length; r.tick(12000 + 10000);
  ok('a penalty that is served in the pits (a stop and go of 10 s) is not made shorter', early === 0 && evs(r, 'served').length === 1 && r.cars[0].scf === 0.5);
  const q = race({ pitPercent: 50 }); q.cross(0, 10000); q.cars[0].fuel = 50; q.setFlag('yellow', 11000); q.block(0, 12000); q.tick(12000 + 1500);
  ok('...and the time that the sensor must be blocked before a stop starts is not made shorter either (the hold time of the fuel rules: 2 s)', q.cars[0].pit === null && (q.tick(12000 + 2010), q.cars[0].pit !== null && q.cars[0].pit.start === 14000)); }
{ const r = race({ pitPercent: 50 }, { fuel: false, cfg: { tyrewear: T.clean({ changeSeconds: 10, setsMode: 'none' }) } }); r.setFlag('yellow', 5000); r.block(0, 6000);
  ok('the factor is the one of the moment the car came in, also for a car that came in the lap the Safety Car went out', r.cars[0].scf === 0.5);
  const n = race(null, { fuel: false }); n.setFlag('yellow', 5000); n.block(0, 6000);
  ok('...a race without a system has a factor of 1 under the yellow flag', n.cars[0].scf === 1); }

// carrying on after an interruption, and what a phone is told
{ const r = race({ target: 15, points: 2 }); r.cross(0, 9000); r.setFlag('yellow', 10000); r.cross(0, 25000);
  const snap = r.snapshot(26000), r2 = race({ target: 15, points: 2 });
  ok('a race that was interrupted with the Safety Car out carries on with it out, and without a second line in the log', r2.restore(snap) && r2.scOut() === true && same(sc(r2), [[true, 1]]) && r2.flag === 'yellow');
  r2.resume(26000); r2.setFlag('yellow', 52000);
  ok('...and when the yellow flag goes down the line "in" is written once', r2.scOut() === false && same(sc(r2), [[true, 1], [false, 2]]));
  const r3 = race({ target: 15, points: 2 }); r3.restore(JSON.parse(JSON.stringify(snap))); r3.resume(50000); r3.cross(0, 54000);
  ok('...the limit on the lap time still counts after it (a lap that began after the Safety Car went out and is too fast)', evs(r3, 'yellowfast').length === 1 && r3.cars[0].points === 2);
  const quiet = race({}); quiet.cross(0, 9000); const r4 = race({}); r4.restore(quiet.snapshot(10000)); r4.setFlag('yellow', 20000);
  ok('...a race that was interrupted without it has it come out as usual', same(sc(r4), [[true, 1]]));
  const st = race({ pitPercent: 50 }, { fuel: false, cfg: { tyrewear: T.clean({ changeSeconds: 10, setsMode: 'none' }) } }); st.cross(0, 10000); st.setFlag('yellow', 11000); st.block(0, 12000); st.tick(14100);
  const st2 = race({ pitPercent: 50 }, { fuel: false, cfg: { tyrewear: T.clean({ changeSeconds: 10, setsMode: 'none' }) } }); st2.restore(st.snapshot(15000));
  ok('...a car that was in the pits keeps the short stop that it came in with', st2.cars[0].scf === 0.5 && st2.twOf(0, 15000).fitLeft === 2000); }
{ const r = race({ target: 15, points: 2, pitPercent: 40 }); r.cross(0, 9000); r.setFlag('yellow', 10000); r.block(0, 12000); r.tick(14100);
  const wire = m => JSON.parse(JSON.stringify(m)), base = { personal: new Map(), track: Infinity, trackName: '' };
  const cx = t => ({ raceId: 'x', eng: r, phase: 'running', calling: false, lights: 5, heat: null, flash: new Map(), bestAll: Infinity, bestAllName: '', bestBy: new Map(), now: t, champ: null });
  const V = LS.viewer(); V.feedStatic(wire(LS.packStatic({ raceId: 'x', eng: r, base }))); const fed = V.feedDynamic(wire(LS.packDynamic(cx(15000))), 15000);
  ok('a viewer (a phone, the Race Director page) builds an engine that has the same Safety Car System, with it out, and the short stop of the car in the pits', fed === true && same(V.engine().safetyCar, r.safetyCar) && V.engine().scOut() === true && V.engine().cars[0].scf === 0.6 && V.engine().cars[1].scf === undefined);
  r.setFlag('yellow', 16000); const fed2 = V.feedDynamic(wire(LS.packDynamic(cx(16000))), 16000);
  ok('...and when it goes in it is in there too', fed2 === true && V.engine().scOut() === false); }

// ---- the database, the export and the web server ----
{ const w = new Database(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'slt-')), 'db.json'));
  const sys = w.add('safetycarsystems', { name: 'GP', target: 20, points: 2, pitPercent: 30 }), setup = w.add('racesetups', { name: 'GP race', safetyCar: sys.id, weather: 'w1' }), other = w.add('racesetups', { name: 'Plain' });
  ok('safety car systems can be added', w.list('safetycarsystems').length === 1 && w.list('safetycarsystems')[0].pitPercent === 30);
  w.remove('safetycarsystems', sys.id);
  ok('deleting a safety car system clears it from the setups (and leaves the other settings and setups alone)', w.list('safetycarsystems').length === 0 && w.list('racesetups').find(r => r.id === setup.id).safetyCar === '' && w.list('racesetups').find(r => r.id === setup.id).weather === 'w1' && w.list('racesetups').find(r => r.id === other.id).safetyCar === undefined); }
{ const tmp = () => new Database(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'slt-')), 'db.json'));
  const x = tmp(), sy = x.add('safetycarsystems', { name: 'GP', target: 20, points: 2, pitPercent: 30 }), st = x.add('racesetups', { name: 'GP race', safetyCar: sy.id });
  const out = Tr.collect(x.data, { racesetups: [st.id] }, true), dp = Tr.dependencies(x.data, { racesetups: [st.id] });
  ok('a race setup brings its safety car system when it is exported, and the dependencies list it', (out.items.safetycarsystems || []).length === 1 && out.items.safetycarsystems[0].name === 'GP' && dp.safetycarsystems && dp.safetycarsystems.length === 1 && dp.safetycarsystems[0].required === false);
  const y = tmp(); y.add('safetycarsystems', { name: 'GP' }); Tr.apply(y, JSON.parse(JSON.stringify(out)));
  const imp = y.data.safetycarsystems.find(q => q.name === 'GP (imported)'), ns = y.data.racesetups[0];
  ok('...an import keeps the link (to the imported copy, with a new id), the numbers, and marks the clash of names', y.data.safetycarsystems.length === 2 && imp && imp.target === 20 && imp.pitPercent === 30 && ns.safetyCar === imp.id && imp.id !== sy.id);
  ok('...a safety car system can also be exported on its own', (Tr.collect(x.data, { safetycarsystems: [sy.id] }, false).items.safetycarsystems || []).length === 1); }
{ const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8'), html = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'index.html'), 'utf8'), tw = html.indexOf('src="tyrewear.js"'), sc2 = html.indexOf('src="safetycar.js"'), eng = html.indexOf('src="engine.js"');
  ok('a phone that runs a race can read the safety car systems from the web server', /const READABLE = \[[^\]]*'safetycarsystems'/.test(server));
  ok('the page loads the rules before the screens that use them (after the tyre wear rules, and before the race screen)', tw > 0 && sc2 > tw && sc2 < html.indexOf('src="race.js"') && eng > 0); }

console.log(fails ? `\n${fails} FAILED` : '\nALL SAFETY CAR TESTS PASSED');
process.exit(fails ? 1 : 0);
