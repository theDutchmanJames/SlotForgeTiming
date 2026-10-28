// 1.35.1: driver swaps counted in distance (Endurance Race): the rules (endurance.js), the car's distance in the race engine (at the line, or anywhere between two crossings),
// the Swap Timer and the Swap Signal widgets, the setup fields, the check on Home and the words in the results.
const En = require('../renderer/endurance.js'), E = require('../renderer/engine.js'), Ds = require('../renderer/distance.js'), Tm = require('../renderer/timing.js'), Wd = require('../renderer/widgets.js'),
  St = require('../renderer/stats.js'), Hs = require('../renderer/homestats.js'), An = require('../renderer/announcer.js');
const schema = require('../schema.js'), Dm = require('../renderer/damage.js');
let fails = 0; const ok = (m, c) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const near = (a, b) => Math.abs(a - b) < 1e-6;
const roster = [{ id: 'a', name: 'Alex', nickname: 'Speedy', callsign: 'Alpha' }, { id: 'b', name: 'Sam', nickname: 'Sammy' }, { id: 'c', name: 'Kim' }];
const base = { sessionType: 'endurance', swapUnit: 'distance', swapMode: 'every', swapEveryDist: 50, swapWarnDist: 10 };

// ---- the rules ----
{
  const c = En.clean({ ...base, swapMomentsDist: '100, 200.5, x, -3', stintMinDist: 20, stintMaxDist: 80, totalMinDist: 100, totalMaxDist: 150, swapWhere: 'anywhere', swapEvery: 7, stintMin: 3, swapWarn: 9 });
  ok('a count in distance: every length comes from the fields in metres (swapEveryDist, stintMinDist...), not from the fields of minutes and laps', c.unit === 'distance' && c.every === 50 && c.warn === 10 && c.stintMin === 20 && c.stintMax === 80 && c.totalMin === 100 && c.totalMax === 150);
  ok('...the moments are distances (a number with decimals, nothing else), sorted, and where a swap is due is anywhere', c.moments.join() === '100,200.5' && c.where === 'anywhere' && c.disp === 'm');
  const d = En.clean(base);
  ok('...at the line is the standard, and the defaults are 50 m and a warning at 10 m', d.where === 'line' && d.every === 50 && En.clean({ sessionType: 'endurance', swapUnit: 'distance' }).every === 50 && En.clean({ sessionType: 'endurance', swapUnit: 'distance' }).warn === 10 && En.clean({ ...base, swapWhere: 'rubbish' }).where === 'line');
  ok('...a count in minutes or laps ignores the fields of the distance, and has no place or unit to show', ['minutes', 'laps', undefined].every(u => { const m = En.clean({ sessionType: 'endurance', swapUnit: u, swapEveryDist: 5, stintMaxDist: 9, swapWarnDist: 3, swapWhere: 'anywhere', swapEvery: 12 }); return m.every === 12 && m.stintMax === 0 && m.warn === 1 && m.where === undefined && m.disp === undefined; }));
  ok('moments in distance: whole and decimal numbers, a comma is a separator', En.parseMoments('50, 100.5 200', 'distance').join() === '50,100.5,200' && En.parseMoments('1:30, abc, 0', 'distance').length === 0 && En.parseMoments('1,5', 'distance').join() === '1,5');
}
{
  const cfg = En.clean({ ...base, stintMinDist: 20, stintMaxDist: 80, totalMinDist: 100, totalMaxDist: 60, swapWhere: 'anywhere' });
  const st = En.newCar(cfg, roster, 'a');
  const L = (m, el = 30000, laps = 3) => En.look(cfg, st, el, laps, m);
  ok('the look at a stint: the distance of the stint against the swap interval (35 m of 50: 15 m left, 42 m: 8 m left, in the warning, 50 m: due)', L(35).left === 15 && L(35).state === 'ok' && L(42).left === 8 && L(42).state === 'soon' && L(50).state === 'due' && L(50).why === 'interval' && L(35).stintM === 35 && L(35).meas === 35);
  ok('...a swap before the shortest stint (20 m) is too early', !L(15).allowed && L(20).allowed && L(15).state === 'ok');
  ok('...the minutes and the laps do not matter when the swaps are counted in distance', En.look(cfg, st, 5000, 1, 35).left === 15 && En.look(cfg, st, 9999999, 999, 35).left === 15);
  const r1 = En.swap(cfg, st, { el: 40000, laps: 5, m: 61, roster, busy: [], rnd: () => 0 });
  ok('a swap ends the stint: the distance of the stint is kept (61 m), the driver has it in his total, and the next stint starts from the distance of the swap', r1.ok && r1.to === 'b' && r1.stintM === 61 && st.tot.a.m === 61 && st.stints[0].m1 === 61 && st.stints[1].m0 === 61 && near(En.look(cfg, st, 50000, 7, 70).meas, 9) && En.look(cfg, st, 50000, 7, 70).left === 41);
  ok('...a driver who has driven the most he may (60 m) is not chosen again, the others are', En.choices(cfg, st, roster, [], 50000, 7, 70).find(x => x.id === 'a').why === 'has driven the longest total' && En.choices(cfg, st, roster, [], 50000, 7, 70).find(x => x.id === 'c').ok === true);
  ok('...the totals of the drivers in distance, the stint at the wheel counting up (Sam 9 m in his stint)', En.totals(st, roster, 50000, 7, 70).map(x => x.id + ':' + x.m).join() === 'a:61,b:9,c:0' && En.stints(st, 50000, 7, 70).map(s => s.m).join() === '61,9');
  const r2 = En.swap(cfg, st, { el: 60000, laps: 9, m: 90, roster, busy: [], rnd: () => 0 });
  const z = En.close(cfg, st, 90000, 12, 120);
  ok('the end of the race closes the stint with the distance driven: Sam 29 m + 30 m = 59 m, Kim 0 m, Alex 61 m (a stint of 90 to 120 m)', z === true && En.totals(st, roster, 90000, 12, 120).map(x => x.id + ':' + x.m).join() === 'a:61,b:29,c:' + (r2.to === 'c' ? 30 : 0) && st.stints[2].m1 === 120);
  ok('...the drivers who drove less than the least (100 m) are named, with what they drove', En.short(cfg, st, roster, 90000, 12, 120).map(x => x.id + ':' + x.m).join() === 'a:61,b:29,c:30'.replace('c:30', r2.to === 'c' ? 'c:30' : 'c:0'));
}
{
  const cfg = En.clean({ ...base, swapMode: 'moments', swapMomentsDist: '100, 250' });
  const st = En.newCar(cfg, roster, 'a');
  ok('moments are distances of the race: 100 m, then 250 m (the driver in the car drove the same distance as the car)', En.look(cfg, st, 1000, 1, 70).left === 30 && En.look(cfg, st, 1000, 1, 100).state === 'due' && En.look(cfg, st, 1000, 1, 100).why === 'moment');
  En.swap(cfg, st, { el: 2000, laps: 11, m: 110, roster, busy: [], rnd: () => 0 });
  ok('...after a swap the next moment is the next one in the list', st.mi === 1 && En.look(cfg, st, 3000, 15, 150).left === 100);
}

{
  const r2 = roster.slice(0, 2), cfg = En.clean({ ...base, swapEveryDist: 1000, totalMaxDist: 60, swapWarnDist: 10 }), st = En.newCar(cfg, r2, 'a');
  const L = m => En.look(cfg, st, 9000, 9, m), sw = (m, el) => En.swap(cfg, st, { el, laps: m / 10, m, roster: r2, busy: [], rnd: () => 0 });
  ok('the most a driver drives in all (60 m) makes a swap due: 55 m driven, 5 m left for that (not for the interval of 1000 m), in the warning, and due at 60 m', L(55).left === 5 && L(55).why === 'total' && L(55).state === 'soon' && L(60).state === 'due' && L(60).why === 'total' && L(40).state === 'ok');
  sw(40, 4000); sw(70, 7000);
  ok('...a driver who is at the wheel again counts what he drove before: 40 m + 15 m = 55 m', L(85).total === 55 && L(85).left === 5 && L(85).why === 'total' && L(85).state === 'soon');
  sw(100, 10000);
  ok('...his total grows with every stint: 40 m + 30 m = 70 m; the other driver has 30 m', En.totals(st, r2, 10000, 10, 100).map(x => x.id + ':' + x.m).join() === 'a:70,b:30' && st.tot.a.m === 70 && st.tot.b.m === 30);
}
{
  const cfg = En.clean({ ...base, totalMinDist: 50 }), st = En.newCar(cfg, roster, 'a');
  En.swap(cfg, st, { el: 6000, laps: 6, m: 61, roster, busy: [], rnd: () => 0 }); En.close(cfg, st, 9000, 9, 90);
  ok('at the end the drivers who drove less than the least (50 m) are the ones named: Sam (29 m) and Kim (0 m), not Alex (61 m)', En.short(cfg, st, roster, 9000, 9, 90).map(x => x.id + ':' + x.m).join() === 'b:29,c:0');
}

// ---- the words ----
{
  const m = En.clean({ ...base }), ft = { ...m, disp: 'ft' };
  ok('a distance as the setup says it: whole numbers without decimals, a decimal under 100, kilometres from 1000 m', En.leftText(m, 12) === '12 m' && En.leftText(m, 7.5) === '7.5 m' && En.leftText(m, 12.4) === '12.4 m' && En.leftText(m, 123.4) === '123 m' && En.leftText(m, 0) === '0 m' && En.leftText(m, -3) === '0 m' && En.leftText(m, 1500) === '1.50 km');
  ok('...in feet when App Settings say so (15.24 m is 50 ft)', En.leftText(ft, 15.24) === '50 ft' && En.spanText(ft, 15.24) === '50 ft' && En.spanText(m, 10) === '10 m' && En.spentText(ft, 0, 0, 15.24) === '50 ft');
  ok('the rules in words: every 50 m at the line, or anywhere on the track; fixed distances; the team chooses', En.rulesText(m) === 'a swap every 50 m at the line' && En.rulesText({ ...m, where: 'anywhere' }) === 'a swap every 50 m anywhere on the track'
    && En.rulesText({ ...m, mode: 'moments', moments: [100, 250] }) === 'swaps after 100 m, 250 m at the line' && En.rulesText({ ...m, mode: 'free', stintMin: 20, stintMax: 80 }) === 'a swap when the team chooses (stints of 20 to 80 m) at the line');
  ok('...a swap by minutes or laps says nothing about a line', En.rulesText(En.clean({ sessionType: 'endurance', swapEvery: 30 })) === 'a swap every 30 minutes' && En.rulesText(En.clean({ sessionType: 'endurance', swapUnit: 'laps', swapEvery: 20 })) === 'a swap every 20 laps');
  ok('the chip of the stint: Swap in 8 m (in the warning), SWAP NOW when it is due, Swap from 12 m before the shortest stint is over, and in the free mode the time to the longest stint', (() => { const c = En.clean({ ...base, swapMode: 'free', stintMinDist: 20, stintMaxDist: 80 }), s = En.newCar(c, roster, 'a'); return En.chipOf(c, En.look(c, s, 1000, 1, 8)).text === 'Swap from 12 m' && En.chipOf(c, En.look(c, s, 1000, 1, 30)).text === 'Swap in 50 m' && En.chipOf(c, En.look(c, s, 1000, 1, 85)).text === 'SWAP NOW'; })()
    && (() => { const s = En.newCar(m, roster, 'a'); return En.chipOf(m, En.look(m, s, 1000, 1, 42)).text === 'Swap in 8 m' && En.chipOf(m, En.look(m, s, 1000, 1, 12)).text === 'Swap in 38 m'; })());
}

// ---- the race engine: the distance of a car ----
const track = { length: 10.5, lanes: 2, laneModifier: 'measured', laneLengths: '10, 10.5' };
const mk = (over = {}, entries) => {
  const setup = { sessionType: 'endurance', enduranceBy: 'distance', distance: 100, swapUnit: 'distance', swapMode: 'every', swapEveryDist: 25, swapWarnDist: 5, swapConfirm: 'button', ...over }, eff = En.effective(setup);
  const e = E.createRace({ type: 'race', laps: 0, distance: Ds.config(eff, track, 2), endurance: { ...eff.endurance, disp: 'm' }, laneLengths: [10, 10.5], endRule: 'all', entries: entries || [{ lane: 0, driverId: 'a', carId: 'c1', driverName: 'Alex', roster, teamName: 'Red', teamId: 'T1' }] });
  e.start(0); return e;
};
// the car crosses the line every 5 s; the race is looked at every half second
const run = (e, to, from = 500) => { e.rec = e.rec || {}; for (let t = from; t <= to; t += 500) { if (t % 5000 === 0) e.cross(0, t); e.tick(t); e.rec[t] = e.enLook(0, t); } };
const at = (e, t) => e.enLook(0, t), was = (e, t) => e.rec[t];
{
  const e = mk({ swapWhere: 'line' }); run(e, 20000);
  const ev = e.events.filter(x => /^swap/.test(x.type)).map(x => x.type + '@' + x.t).join();
  ok('swapping at the line: the distance is the laps times the lane (10 m a lap): the warning at the crossing with 20 m (5 m to go), the swap is due at the crossing with 30 m', ev === 'swapsoon@10000,swapdue@15000' && was(e, 12000).dist === 20 && was(e, 12000).state === 'soon' && was(e, 12000).left === 5 && was(e, 15000).dist === 30 && was(e, 15000).state === 'due');
  const f = mk({ swapWhere: 'line' }); run(f, 14500);
  ok('...between two crossings nothing changes (exact: 20 m, 5 m to go, until the next crossing)', at(f, 14500).dist === 20 && at(f, 14500).left === 5 && at(f, 14500).state === 'soon');
}
{
  const e = mk({ swapWhere: 'anywhere' }); run(e, 20000);
  const ev = e.events.filter(x => /^swap/.test(x.type)).map(x => x.type + '@' + x.t).join();
  ok('swapping anywhere: the distance goes on between the crossings (the lap time to expect is 5 s): 25 m is reached 2.5 s after the crossing with 20 m, at 12.5 s', ev === 'swapsoon@10000,swapdue@12500' && was(e, 8000).dist === 16 && near(was(e, 9000).dist, 18) && was(e, 12000).state === 'soon' && was(e, 12500).state === 'due' && was(e, 13000).dist === 26 && was(e, 13000).left === -1);
  ok('...the estimate does not pass the next crossing (0.99 of a lap), and the first lap has no estimate yet', (() => { const f = mk({ swapWhere: 'anywhere' }); run(f, 3000); const a = at(f, 3000).dist; f.cross(0, 5000); f.tick(5000); f.cross(0, 10000); f.tick(10000); return a === 0 && near(f.enOdo(f.cars[0], 14999), 29.9) && f.enOdo(f.cars[0], 99999) < 30; })());
}
{
  const e = mk({ swapWhere: 'line' }); run(e, 15500);
  const res = e.swap(0, 16000);
  ok('a swap made by the button: the stint of Alex is 30 m, Sam is at the wheel, and the next swap is due 25 m later (55 m: 25 m to go)', res.ok && res.from === 'a' && res.to === 'b' && res.stintM === 30 && e.cars[0].driverId === 'b' && at(e, 16000).dist === 30 && at(e, 16000).left === 25 && at(e, 16000).state === 'ok' && e.events.find(x => x.type === 'swapdone').stintM === 30 && e.events.find(x => x.type === 'swapdone').m === 30);
  run(e, 50000, 16500);
  ok('the race ends at the crossing with 100 m (10 laps): the stints are closed there with the exact distance: Alex 30 m, Sam 70 m', e.status === 'finished' && at(e, 50000).stints.map(s => s.m).join() === '30,70' && at(e, 50000).stints[1].m1 === 100 && at(e, 50000).totals.map(x => x.id + ':' + x.m).join() === 'a:30,b:70,c:0');
}
{
  const e = mk({ swapWhere: 'anywhere' }); run(e, 13000);
  const res = e.swap(0, 13000);
  ok('swapping anywhere: the swap is made at the distance of that moment (26 m), and the next one is due 25 m after it', res.ok && res.stintM === 26 && at(e, 13000).left === 25 && e.events.find(x => x.type === 'swapdone').m === 26);
}
{
  const e = mk({ swapMode: 'moments', swapMomentsDist: '25, 60', swapWhere: 'line' }); run(e, 15500);
  e.swap(0, 16000);
  ok('fixed distances in a race: the first is due at the crossing with 30 m (past 25 m), the second is 30 m after that swap (the race is at 60 m)', e.events.some(x => x.type === 'swapdue' && x.t === 15000) && at(e, 16000).left === 30);
}
{
  // a car on a lane with no known length has driven no distance: no swap is due, whatever the laps
  const entries = [{ lane: 0, driverId: 'a', carId: 'c1', driverName: 'Alex', roster, teamName: 'Red', teamId: 'T1' }];
  const setup = En.effective({ sessionType: 'endurance', enduranceBy: 'laps', laps: 20, swapUnit: 'distance', swapMode: 'every', swapEveryDist: 25, swapConfirm: 'button' });
  const e = E.createRace({ type: 'race', laps: 20, endurance: { ...setup.endurance, disp: 'm' }, laneLengths: [0, 0], endRule: 'all', entries }); e.start(0); run(e, 60000);
  ok('without a lane length no distance is driven, and no swap is due', at(e, 60000).dist === 0 && at(e, 60000).state === 'ok' && !e.events.some(x => x.type === 'swapdue'));
  const f = E.createRace({ type: 'race', laps: 20, endurance: { ...setup.endurance, disp: 'm' }, laneLengths: [10, 10], endRule: 'all', entries }); f.start(0); run(f, 30000);
  ok('a Endurance Race by laps can count its swaps in distance too (the lane lengths come with the race): 60 m after 6 laps, and the swap was due at 30 m', at(f, 30000).dist === 60 && f.events.some(x => x.type === 'swapdue' && x.t === 15000));
}
{
  // minutes and laps work as before
  const setup = En.effective({ sessionType: 'endurance', enduranceBy: 'laps', laps: 20, swapUnit: 'laps', swapEvery: 3, swapConfirm: 'button' });
  const e = E.createRace({ type: 'race', laps: 20, endurance: setup.endurance, laneLengths: [10, 10], endRule: 'all', entries: [{ lane: 0, driverId: 'a', carId: 'c1', driverName: 'Alex', roster, teamName: 'Red', teamId: 'T1' }] }); e.start(0); run(e, 20000);
  ok('swaps counted in laps do not need a lane length and have no distance', e.events.some(x => x.type === 'swapdue' && x.t === 15000) && at(e, 20000).dist === 0 && e.enOdo(e.cars[0], 1000) === 0);
}

{
  const e = mk({ swapWhere: 'line', swapConfirm: 'sensor', swapSeconds: 1 }); run(e, 15500);
  e.block(0, 16000); e.tick(16500); e.tick(17500);
  ok('a swap by the pit sensor counts the distance too: the car stands on the sensor once the swap is due (it crosses the line as it stops: 4 laps, 40 m), and after its second the driver is changed, with the 40 m of the stint', e.cars[0].driverId === 'b' && e.events.filter(x => x.type === 'swapdone').map(x => x.by + ':' + x.stintM).join() === 'sensor:40');
  const g = mk({ swapMode: 'free', stintMinDist: 25, swapWhere: 'line', swapConfirm: 'sensor', swapSeconds: 1 }); run(g, 10500);
  g.block(0, 11000); g.tick(12500);
  ok('a free swap by the sensor is made once the shortest stint (25 m) is driven: 30 m at the stop, so it is', g.cars[0].driverId === 'b' && g.events.filter(x => x.type === 'swapdone').map(x => x.by + ':' + x.stintM).join() === 'sensor:30');
  const h = mk({ swapMode: 'free', stintMinDist: 25, swapWhere: 'line', swapConfirm: 'sensor', swapSeconds: 1 }); run(h, 5500);
  h.block(0, 6000); h.tick(7500);
  ok('...and not before: 20 m at the stop, the shortest stint is 25 m', h.cars[0].driverId === 'a' && !h.events.some(x => x.type === 'swapdone'));
  const f = mk({ swapWhere: 'line', swapConfirm: 'sensor', swapSeconds: 1 }); run(f, 5500);
  f.block(0, 6000); f.tick(6500); f.tick(8000);
  ok('...and not before: standing on the sensor at 20 m, when the swap is not due (25 m), swaps nobody', f.cars[0].driverId === 'a' && !f.events.some(x => x.type === 'swapdone'));
}
{
  const e = mk({ swapWhere: 'line', totalMinDist: 40, minPenalty: 0 }); run(e, 15500); e.swap(0, 16000); run(e, 60000, 16500);
  const ev = e.events.filter(x => x.type === 'swapshort').map(x => x.driver + ':' + x.m).join();
  ok('the drivers who drove less than the least (40 m) are told at the end with what they drove: Alex 30 m, Kim 0 m; Sam drove 70 m', e.status === 'finished' && ev === 'a:30,c:0');
}
{
  // a repair that is done after the other work in the pits waits for a swap by the sensor that is allowed by distance (the shortest stint of 25 m is driven)
  const eff = En.effective({ sessionType: 'endurance', enduranceBy: 'distance', distance: 200, swapUnit: 'distance', swapMode: 'free', stintMinDist: 25, swapConfirm: 'sensor', swapSeconds: 20, swapWhere: 'line' });
  const e = E.createRace({ type: 'race', laps: 0, distance: Ds.config(eff, track, 2), endurance: { ...eff.endurance, disp: 'm' }, laneLengths: [10, 10.5], endRule: 'all', damage: Dm.clean({ ...Dm.defaults(), stop: 'add' }, 0),
    entries: [{ lane: 0, driverId: 'a', carId: 'c1', driverName: 'Alex', roster, teamName: 'Red', teamId: 'T1' }] }); e.start(0); run(e, 15500); e.addDamage(0, 3, 15600, 'hit'); e.block(0, 16000);
  for (let t = 16500; t <= 50000 && e.cars[0].dmg > 0; t += 500) e.tick(t);
  ok('the repair "one after the other" waits for the swap by the sensor (20 s, allowed from 25 m, 40 m driven), then takes its 10 seconds: the swap is done at 36 s and the repair at 46 s', e.events.filter(x => x.type === 'swapdone').map(x => x.t).join() === '36000' && e.events.filter(x => x.type === 'repaired').map(x => x.t).join() === '46000');
}
{
  // a distance race that is not given the lane lengths for the swaps uses the lanes of the race
  const eff = En.effective({ sessionType: 'endurance', enduranceBy: 'distance', distance: 100, swapUnit: 'distance', swapMode: 'every', swapEveryDist: 25, swapConfirm: 'button' });
  const e = E.createRace({ type: 'race', laps: 0, distance: Ds.config(eff, track, 2), endurance: { ...eff.endurance, disp: 'm' }, endRule: 'all', entries: [{ lane: 0, driverId: 'a', carId: 'c1', driverName: 'Alex', roster, teamName: 'Red', teamId: 'T1' }] }); e.start(0); run(e, 10500);
  ok('without lane lengths of its own the swaps use the lanes of the distance race (10 m a lap on lane 1)', at(e, 10500).dist === 20 && e.enOdo(e.cars[0], 10500) === 20);
}
{
  // a car that has finished has driven its distance, whatever the clock does while the other cars race on
  const eff = En.effective({ sessionType: 'endurance', enduranceBy: 'distance', distance: 100, swapUnit: 'distance', swapMode: 'every', swapEveryDist: 400, swapWhere: 'anywhere', swapConfirm: 'button' });
  const e = E.createRace({ type: 'race', laps: 0, distance: Ds.config(eff, track, 2), endurance: { ...eff.endurance, disp: 'm' }, laneLengths: [10, 10.5], endRule: 'all',
    entries: [0, 1].map(l => ({ lane: l, driverId: 'a' + l, carId: 'c' + l, driverName: 'D' + l, roster, teamName: 'T' + l, teamId: 'T' + l })) }); e.start(0);
  for (let t = 500; t <= 60000; t += 500) { if (t % 5000 === 0) e.cross(0, t); if (t % 6000 === 0) e.cross(1, t); e.tick(t); }
  ok('a car that has finished (lane 1: 10 laps at 5 s, at 50 s) has driven 100 m at 55 s, while lane 2 (10 laps at 6 s) races on', e.cars[0].done && e.status === 'finished' && e.enLook(0, 55000).dist === 100 && e.enLook(1, 60000).dist === 105);
  const f = mk({ swapWhere: 'anywhere' }); run(f, 20000);
  ok('...the estimate does not go back in time (a look before the last crossing: the exact distance)', f.enOdo(f.cars[0], 100) === 40 && f.enOdo(f.cars[0], 20000) === 40);
}

{
  const e = mk({ swapWhere: 'line' }); run(e, 10500);
  const v = En.view(e, [0], 10500, 'running');
  ok('the swap panel row says the stint with the distance: "0:11 · 2 laps · 20 m" and the swap in 5 m', v.on && v.rows.length === 1 && v.rows[0].stint === '0:11 \u00b7 2 laps \u00b7 20 m' && v.rows[0].chip === 'Swap in 5 m');
  const m = mk({ swapUnit: 'minutes', swapEvery: 1 }); run(m, 10500);
  ok('...a count in minutes says nothing of a distance', !En.view(m, [0], 10500, 'running').rows[0].stint.includes(' m') && En.view(m, [0], 10500, 'running').rows[0].stint === '0:11 \u00b7 2 laps');
}

// ---- the widgets ----
{
  const e = mk({ swapWhere: 'line' });
  const mkS = (now, over = {}) => { const st = e.standings(); return { eng: e, now, phase: 'running', lights: 0, setup: { sessionType: 'race', raceBy: 'distance', distance: 100 }, heat: null, track, distUnit: 'm',
    carByLane: l => e.cars.find(c => c.lane === l) || null, rowOf: c => st.find(r => r.car === c), flashOf: () => null, personalBest: () => Infinity, standings: () => st, ...over }; };
  const W = (type, opt, now, lane = 0) => Tm.content({ type, lane, opt: opt || {} }, mkS(now));
  run(e, 5500);
  ok('Swap Timer: Swap in 15 m (10 m driven of the 25 m), or only the distance', W('swaptimer', {}, 5500).html === 'Swap in 15 m' && W('swaptimer', { show: 'clock' }, 5500).html === '15 m');
  run(e, 10500, 6000);
  ok('...amber in the warning (5 m to go)', W('swaptimer', {}, 10500).html === 'Swap in 5 m' && W('swaptimer', {}, 10500).bg === '#ffb000');
  ok('Swap Signal: nothing while the swap is not near, and in the warning only when the widget says so (in the warning colour, with the words of the timer)', (() => { const e2 = mk({ swapWhere: 'line' }); run(e2, 5500); const S2 = { ...mkS(5500), eng: e2 }; return Tm.content({ type: 'swapsignal', lane: 0, opt: {} }, S2).html === ''; })()
    && W('swapsignal', {}, 10500).html === '' && W('swapsignal', { when: 'soon' }, 10500).html.includes('Swap in 5 m') && W('swapsignal', { when: 'soon' }, 10500).bg === '#ffb000' && W('swapsignal', { when: 'soon', soonColor: '#445566' }, 10500).bg === '#445566');
  run(e, 15500, 11000);
  const d0 = W('swapsignal', {}, 15000), d1 = W('swapsignal', {}, 15500);
  ok('...when the swap is due: the word, with who comes out and who steps in, red', d0.html === '<span class="swsig"><b>SWAP</b><small>Alex → Sam</small></span>' && d0.bg === '#e03131');
  ok('...it flashes (every half second the colour changes), or does not when the widget says so', d1.bg === '#6b1414' && W('swapsignal', {}, 16000).bg === '#e03131' && W('swapsignal', { flash: false }, 15500).bg === '#e03131' && W('swapsignal', { dueColor: '#00aa00', offColor: '#003300' }, 15500).bg === '#003300');
  ok('...its colours: the colour when the swap is due (while it is on), the dark one, and the colour of the warning', W('swapsignal', { dueColor: '#00aa00' }, 15000).bg === '#00aa00' && W('swapsignal', { dueColor: '#00aa00', offColor: '#112233' }, 15500).bg === '#112233'); 
  ok('...its words, the drivers by nickname or without names', W('swapsignal', { text: 'BOX!' }, 15000).html.includes('<b>BOX!</b>') && W('swapsignal', { text: '  ' }, 15000).html.includes('<b>SWAP</b>') && W('swapsignal', { show: 'nickname' }, 15000).html.includes('Speedy → Sammy') && W('swapsignal', { show: 'callsign' }, 15000).html.includes('Alpha → Sam')
    && !W('swapsignal', { names: false }, 15000).html.includes('<small>'));
  ok('...it stays while the swap is not made, and says how late the team is', W('swapsignal', {}, 20000).html.includes('SWAP') && !W('swapsignal', {}, 20000).html.includes('s late') && (() => { const l = e.enLook(0, 50000); return l.state === 'overdue' && W('swapsignal', {}, 50000).html.includes(Math.round(l.over) + ' s late'); })());
  e.swap(0, 51000);
  ok('...and goes when the swap is made', W('swapsignal', {}, 51500).html === '' && W('swapsignal', { when: 'soon' }, 51500).html === '');
  ok('...a car without drivers to swap shows nothing, and so does a lane with no car', (() => { const f = E.createRace({ type: 'race', laps: 5, entries: [{ lane: 0, driverId: 'a', carId: 'c', driverName: 'Alex' }] }); f.start(0); const st = f.standings(); const S = { eng: f, now: 1000, phase: 'running', lights: 0, setup: { sessionType: 'race', laps: 5 }, heat: null, track, distUnit: 'm', carByLane: l => f.cars.find(c => c.lane === l) || null, rowOf: c => st.find(r => r.car === c), flashOf: () => null, personalBest: () => Infinity, standings: () => st };
    return Tm.content({ type: 'swapsignal', lane: 0, opt: {} }, S).html === '' && Tm.content({ type: 'swapsignal', lane: 3, opt: {} }, S).html === ''; })());
  ok('the custom text variable {swap} says the distance too', Tm.content({ type: 'textlane', lane: 0, opt: { text: '{swap}' } }, mkS(51500)).html === 'Swap in 25 m'.replace('25', String(Math.round(e.enLook(0, 51500).left))));
}
ok('the Swap Signal is a widget of the folder Team and Swaps, one for each lane, with settings and a sample for the layout editor', (() => { const d = Wd.REGISTRY.find(x => x.type === 'swapsignal'); return d && d.group === 'Team and Swaps' && d.perLane && d.options.map(o => o.key).join() === 'when,text,names,show,flash,soonColor,dueColor,offColor' && typeof d.sample === 'function'; })());
ok('...its settings start as: show it when the swap is due, the word SWAP, the names on, flashing on, the colours amber, red and dark red', (() => { const o = k => Wd.REGISTRY.find(x => x.type === 'swapsignal').options.find(x => x.key === k).default; return o('when') === 'due' && o('text') === 'SWAP' && o('names') === true && o('flash') === true && o('soonColor') === '#ffb000' && o('dueColor') === '#e03131' && o('offColor') === '#6b1414'; })());
ok('...its sample shows the word and the drivers, follows the settings', (() => { const d = Wd.REGISTRY.find(x => x.type === 'swapsignal'); return d.sample(0, { opt: {} }) === '<span class="swsig"><b>SWAP</b><small>James → Bjornie</small></span>' && d.sample(1, { opt: { text: 'BOX', names: false } }) === '<span class="swsig"><b>BOX</b></span>'; })());

// ---- the setup fields ----
const raceSchema = schema.racesetups, field = k => raceSchema.fields.find(f => f.key === k);
const shown = (f, vals) => !f.showIf || f.showIf.some(c => Object.entries(c).every(([k, vs]) => vs.includes(vals[k] ?? '')));
const keys = vals => raceSchema.fields.filter(f => shown(f, vals)).map(f => f.key);
{
  const dist = keys({ sessionType: 'endurance', swapUnit: 'distance', swapMode: 'every' }), time = keys({ sessionType: 'endurance', swapUnit: 'minutes', swapMode: 'every' }), none = keys({ sessionType: 'endurance', swapMode: 'every' });
  ok('the swap rules have a choice of Distance (metres or feet)', field('swapUnit').options.map(o => o[0]).join() === 'minutes,laps,distance' && field('swapWhere').options.map(o => o[0]).join() === 'line,anywhere' && field('swapWhere').default === 'line');
  ok('counted in distance: the fields in metres are shown, those of minutes and laps are not', ['swapWhere', 'swapEveryDist', 'stintMinDist', 'stintMaxDist', 'totalMinDist', 'totalMaxDist', 'swapWarnDist'].every(k => dist.includes(k)) && ['swapEvery', 'stintMin', 'stintMax', 'totalMin', 'totalMax', 'swapWarn'].every(k => !dist.includes(k)) && !dist.includes('swapMomentsDist'));
  ok('...counted in minutes or laps (or when nothing is chosen yet) it is the other way round, and there is no place of a swap', ['minutes', 'laps', ''].every(u => { const f = keys({ sessionType: 'endurance', swapUnit: u, swapMode: 'every' }); return ['swapEvery', 'stintMin', 'stintMax', 'totalMin', 'totalMax', 'swapWarn'].every(k => f.includes(k)) && ['swapWhere', 'swapEveryDist', 'stintMinDist', 'swapWarnDist'].every(k => !f.includes(k)); }) && time.length === none.length);
  ok('...the distances of a race only in the mode with fixed moments, the interval only in the mode every', keys({ sessionType: 'endurance', swapUnit: 'distance', swapMode: 'moments' }).includes('swapMomentsDist') && !keys({ sessionType: 'endurance', swapUnit: 'distance', swapMode: 'moments' }).includes('swapEveryDist') && !keys({ sessionType: 'endurance', swapUnit: 'distance', swapMode: 'free' }).includes('swapEveryDist') && !keys({ sessionType: 'endurance', swapUnit: 'distance', swapMode: 'free' }).includes('swapMomentsDist'));
  ok('...they are kept in metres and typed in feet when App Settings say feet', ['swapEveryDist', 'swapMomentsDist', 'stintMinDist', 'stintMaxDist', 'totalMinDist', 'totalMaxDist', 'swapWarnDist'].every(k => field(k).unit === 'm' && field(k).labelFt && field(k).group === 'endurance') && field('swapMomentsDist').type === 'numberlist' && field('swapEveryDist').default === 50 && field('swapWarnDist').default === 10);
  ok('...and there are no distance fields for another kind of session', ['race', 'timed', 'heats', 'practice'].every(t => !keys({ sessionType: t, swapUnit: 'distance', swapMode: 'every' }).some(k => /Dist$|swapWhere/.test(k) && k !== 'finalDistance')));
}

// ---- Home, the lists and the results ----
{
  const s = { ...base, sessionType: 'endurance' };
  ok('Home warns about a lane with no length when the swaps are counted in distance (and about nothing else)', Ds.swapProblem(s, { lanes: 2, laneModifier: 'measured', laneLengths: ', 10' }, 2) === 'The driver swaps are counted in distance, so the lane lengths are needed. Lane 1 has no length. Add the lane lengths in the Database.'
    && Ds.swapProblem(s, { lanes: 3, laneModifier: 'measured', laneLengths: ', 10, ' }, 3).includes('Lanes 1, 3 have no length') && Ds.swapProblem(s, { lanes: 2 }, 2).includes('The track has no length. Add the track length in the Database.')
    && Ds.swapProblem(En.effective({ ...s, enduranceBy: 'laps', laps: 8 }), { lanes: 2 }, 2).includes('The track has no length') && Ds.swapProblem({ ...En.effective(s), swapUnit: 'laps' }, { lanes: 2 }, 2) === '' && Ds.swapProblem(s, track, 2) === '' && Ds.swapProblem({ ...s, swapUnit: 'laps' }, { lanes: 2 }, 2) === '' && Ds.swapProblem({ sessionType: 'race' }, { lanes: 2 }, 2) === '' && Ds.swapProblem(s, null, 2) === '' && Ds.swapProblem(null, track, 2) === '');
  const rule = (setup, unit) => (Hs.rules(setup, { typeLabel: 'Endurance Race', distUnit: unit }).find(x => x[0] === 'Driver swaps') || [])[1];
  ok('the rules on Home say the swaps: every 50 m at the line, anywhere, fixed distances, free; in feet when the unit says feet', rule(s, 'm') === 'Every 50 m, at the line' && rule({ ...s, swapWhere: 'anywhere' }, 'm') === 'Every 50 m, anywhere on the track' && rule({ ...s, swapMode: 'moments', swapMomentsDist: '100, 250' }, 'm') === 'At 100 m, 250 m, at the line'
    && rule({ ...s, swapMode: 'free' }, 'm') === 'When the team chooses, at the line' && rule({ ...s, swapEveryDist: 15.24 }, 'ft') === 'Every 50 ft, at the line' && rule({ sessionType: 'endurance', swapEvery: 20, swapUnit: 'laps' }, 'm') === 'Every 20 laps');
  ok('...with nothing set the swaps are every 50 m, or at 100 m, 200 m', rule({ sessionType: 'endurance', swapUnit: 'distance' }, 'm') === 'Every 50 m, at the line' && rule({ sessionType: 'endurance', swapUnit: 'distance', swapMode: 'moments' }, 'm') === 'At 100 m, 200 m, at the line' && rule({ ...s, swapEveryDist: 12.5 }, 'm') === 'Every 12.5 m, at the line');
  const row = { asTeam: true, teamName: 'Red', driverName: 'Red', drivers: [{ driverName: 'Alex', laps: 3, ms: 90000, meters: 30 }, { driverName: 'Sam', laps: 7, ms: 210000, meters: 70.4 }, { driverName: 'Kim', laps: 0, ms: 0 }],
    stints: [{ driverName: 'Alex', laps: 3, ms: 90000, from: 0, to: 90000, meters: 30 }, { driverName: 'Sam', laps: 7, ms: 210000, from: 90000, to: 300000, meters: 70.4 }] };
  ok('the results name the distance every driver drove: "Alex (3 laps, 1:30, 30 m)", in feet when asked, and nothing for a race in minutes or laps', St.driversText(row, 'm') === 'Alex (3 laps, 1:30, 30 m), Sam (7 laps, 3:30, 70 m), Kim (0 laps)' && St.driversText(row, 'ft') === 'Alex (3 laps, 1:30, 98 ft), Sam (7 laps, 3:30, 231 ft), Kim (0 laps)'
    && St.driversText({ ...row, drivers: [{ driverName: 'Alex', laps: 3, ms: 90000 }] }, 'm') === 'Alex (3 laps, 1:30)');
  ok('...and the stints: "Alex, 0:00 to 1:30, 3 laps (1:30, 30 m)"', St.stintLines({ standings: [row] }, 'm')[0].stints.map(q => q.text).join(' | ') === 'Alex, 0:00 to 1:30, 3 laps (1:30, 30 m) | Sam, 1:30 to 5:00, 7 laps (3:30, 70 m)' && St.stintLines({ standings: [{ ...row, stints: [{ driverName: 'Alex', laps: 3, ms: 90000, from: 0, to: 90000 }] }] }, 'm')[0].stints[0].text === 'Alex, 0:00 to 1:30, 3 laps (1:30)');
  ok('...a driver who drove too little: with his distance', St.enduranceText({ asTeam: true, short: [{ driverName: 'Kim', laps: 2, ms: 60000, meters: 20 }] }, 'm') === 'drove too little: Kim (2 laps, 1:00, 20 m)' && St.enduranceText({ asTeam: true, short: [{ driverName: 'Kim', laps: 2, ms: 60000 }] }, 'm') === 'drove too little: Kim (2 laps, 1:00)');
}
{
  // the audio call before a swap says the distance
  const e = mk({ swapWhere: 'line' }), a = An.create({ lapLimit: 0 }); a.observe(e, { phase: 'running', now: 0 }); run(e, 9500);
  e.cross(0, 10000); e.tick(10000);
  const ev = a.observe(e, { phase: 'running', now: 10000 });
  const soon = ev.find(x => x.call === 'swapsoon');
  ok('the call "swap soon" says how far away the swap is: in metres (the warning is 5 metres)', soon && soon.vars.swapin === '5 metres' && soon.vars.nextdriver === 'Sam');
  ok('...said aloud: 1 metre, 5 metres, 16.4 feet, 1 foot, 1.50 kilometres; minutes and laps as before', (() => { const c = En.clean({ ...base }), f = { ...c, disp: 'ft' }; return En.spokenSpan(c, 1) === '1 metre' && En.spokenSpan(c, 5) === '5 metres' && En.spokenSpan(c, 2.5) === '2.5 metres' && En.spokenSpan(f, 5) === '16.4 feet' && En.spokenSpan(f, 0.3048) === '1 foot' && En.spokenSpan(c, 1500) === '1.50 kilometres' && En.spokenSpan(En.clean({ sessionType: 'endurance', swapEvery: 30 }), 1) === '1 minute' && En.spokenSpan(En.clean({ sessionType: 'endurance', swapUnit: 'laps' }), 2) === '2 laps'; })());
  run(e, 15000, 10500); const ev2 = a.observe(e, { phase: 'running', now: 15000 });
  ok('...and the call "swap now" is said when it is due', ev2.some(x => x.call === 'swapdue'));
}

console.log(fails ? fails + ' DISTANCE SWAP TESTS FAILED' : 'ALL DISTANCE SWAP TESTS PASSED'); process.exit(fails ? 1 : 0);
