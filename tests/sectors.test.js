// 1.66.0: Sectors. A track can have sectors (sector 1 starts at the timing line, in driving order). In the review before Finalize every car that did not finish gets "last seen in sector":
// of two cars with the same laps (the same distance in a race by distance) the later sector ranks higher, never above a car with more laps; two cars in the same sector can be put in order with arrows;
// with no sector the order is how it was (who crossed the line first). The sector is kept in the saved result.
global.RaceEngine = require('../renderer/engine.js');
global.Stats = require('../renderer/stats.js');
global.Icons = require('../renderer/icons.js');
global.esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
global.AdjustPad = require('../renderer/adjustpad.js');
global.Distance = require('../renderer/distance.js');
const E = RaceEngine, Ds = Distance, Review = require('../renderer/review.js'), LS = require('../renderer/liveshare.js'), schema = require('../schema.js');
let fails = 0; const ok = (m, c) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const NAMES = ['Alex', 'Sam', 'Kim', 'Lee', 'Max'];
const entries = (n = 5) => Array.from({ length: n }, (_, i) => ({ lane: i, driverId: 'd' + i, carId: 'c' + i, driverName: NAMES[i], carName: 'car' + i }));
const SEC = { count: 4, names: ['Start', 'Hairpin', '', 'Back'] };
const order = r => r.standings().map(x => r.cars[x.index].driverName).join();
const feed = (r, plan) => { const ev = []; plan.forEach(([i, n, base]) => { for (let k = 1; k <= n; k++) ev.push([k * base, i]); }); ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]).forEach(([t, i]) => r.cross(i, t)); };
// 5 laps, the race ends when the lead car finishes: Alex 5 laps; Kim, Lee and Sam 4 laps (Kim crossed first, then Lee, then Sam); Max 3 laps
const leader = (over = {}) => { const r = E.createRace({ type: 'race', laps: 5, endRule: 'leader', entries: entries(), sectors: SEC, ...over }); r.start(0); feed(r, [[0, 5, 10000], [2, 4, 10100], [3, 4, 10200], [1, 4, 10300], [4, 3, 10400]]); return r; };

// ---- what the track says ----
{ const none = [undefined, null, {}, { sectors: '' }, { sectors: 0 }, { sectors: 1 }, { sectors: 'x' }, { sectors: -3 }, { sectors: NaN }];
  ok('a track with no sectors, or with one, has none (empty, 0, 1, text, a negative number)', none.every(t => Ds.sectors(t) === null));
  ok('...2 or more are sectors: the number, whole, at most 12', Ds.sectors({ sectors: 2 }).count === 2 && Ds.sectors({ sectors: '4' }).count === 4 && Ds.sectors({ sectors: 2.9 }).count === 2 && Ds.sectors({ sectors: 20 }).count === 12 && Ds.MAX_SECTORS === 12);
  ok('...the names are optional and in driving order, trimmed, one for every sector (empty for a sector without one), and names beyond the count are dropped', JSON.stringify(Ds.sectors({ sectors: 4 }).names) === '["","","",""]'
    && JSON.stringify(Ds.sectors({ sectors: 3, sectorNames: ' Start , Hairpin ,Back, Extra ' }).names) === '["Start","Hairpin","Back"]' && JSON.stringify(Ds.sectors({ sectors: 4, sectorNames: 'Start,,Back' }).names) === '["Start","","Back",""]');
  ok('a sector is called "Sector 2", with its name behind it when it has one', Ds.sectorLabel(SEC, 2) === 'Sector 2 · Hairpin' && Ds.sectorLabel(SEC, 3) === 'Sector 3' && Ds.sectorLabel(null, 1) === 'Sector 1' && Ds.sectorLabel({ count: 2 }, 2) === 'Sector 2');
  const t = schema.tracks, f = k => t.fields.find(x => x.key === k);
  ok('the Track form has a group Sectors between the lanes and the lap time limits, with the number of sectors and the names', t.groups.map(g => g.id).join() === 'basics,length,sectors,laps,extras' && f('sectors').group === 'sectors' && f('sectorNames').group === 'sectors'
    && t.fields.map(x => x.key).join().includes('laneLengths,sectors,sectorNames,minLap'));
  ok('...the number is a whole number from 0 to 12 that may stay empty, the names are text that may stay empty, and both say how it works', f('sectors').type === 'number' && f('sectors').min === 0 && f('sectors').max === 12 && f('sectors').step === 1 && f('sectors').optional === true && f('sectorNames').type === 'text' && f('sectorNames').optional === true
    && /Sector 1 starts at the timing line/.test(f('sectors').hint) && /later sector ranks higher/.test(f('sectors').hint) && /separated by commas/.test(f('sectorNames').hint)); }

// ---- the engine: only races have sectors ----
{ ok('a race without sectors has none, and nothing can be set', E.createRace({ type: 'race', laps: 5, endRule: 'leader', entries: entries() }).sectors === null && (() => { const r = leader({ sectors: null }); return r.sectors === null && r.setSector(1, 2) === false && r.moveSector(1, -1) === false && r.sectorGroup(1).length === 0; })());
  ok('...one sector is no sectors, and so is a count that is not a number', E.createRace({ type: 'race', laps: 5, entries: entries(), sectors: { count: 1 } }).sectors === null && E.createRace({ type: 'race', laps: 5, entries: entries(), sectors: { count: 'x' } }).sectors === null && E.createRace({ type: 'race', laps: 5, entries: entries(), sectors: {} }).sectors === null);
  ok('...a race, a heat of a time and a race by distance have them; practice and qualifying do not', ['race', 'timed'].every(type => E.createRace({ type, laps: 5, duration: 1, entries: entries(), sectors: SEC }).sectors.count === 4) && ['practice', 'qualifying'].every(type => E.createRace({ type, duration: 1, entries: entries(), sectors: SEC }).sectors === null));
  const r = E.createRace({ type: 'race', laps: 5, entries: entries(), sectors: { count: 20, names: [' A ', 7, null] } });
  ok('...at most 12 sectors, the names trimmed and made into text, and the name of a sector that has none is empty', r.sectors.count === 12 && r.sectors.names.slice(0, 3).join() === 'A,7,' && r.sectorName(1) === 'A' && r.sectorName(2) === '7' && r.sectorName(3) === '' && r.sectorName(13) === '' && r.sectorName(0) === '' && E.createRace({ type: 'race', laps: 5, entries: entries() }).sectorName(1) === ''); }

// ---- the order of the cars that did not finish ----
{ const r = leader();
  ok('before anything is set the order is how it was: the car that finished, then the cars with 4 laps in the order they crossed the line (Kim, Lee, Sam), then Max with 3 laps', r.status === 'finished' && r.cars[0].done && !r.cars[1].done && order(r) === 'Alex,Kim,Lee,Sam,Max');
  ok('a car that did not finish has no sector yet, and the cars start with none', r.cars.every(c => c.sector === null) && r.cars.every(c => c.secOrder === null));
  ok('Sam in sector 3 goes ahead of Kim and Lee, who have the same laps and no sector', r.setSector(1, 3) === true && r.cars[1].sector === 3 && order(r) === 'Alex,Sam,Kim,Lee,Max');
  ok('...Kim in sector 2 stays ahead of Lee, who has none: a car without a sector ranks behind the cars with one', r.setSector(2, 2) && order(r) === 'Alex,Sam,Kim,Lee,Max');
  ok('...Lee in sector 2 as well: the same sector, so how they were (Kim crossed first)', r.setSector(3, 2) && order(r) === 'Alex,Sam,Kim,Lee,Max');
  ok('...Lee in sector 4 is ahead of Sam (sector 3) and Kim (sector 2)', r.setSector(3, 4) && order(r) === 'Alex,Lee,Sam,Kim,Max');
  ok('...Max in sector 4 stays behind: a sector never puts a car above a car with more laps', r.setSector(4, 4) && order(r) === 'Alex,Lee,Sam,Kim,Max');
  ok('...the car that finished is first whatever the others have', r.cars[0].done && r.standings()[0].index === 0);
  ok('...setting the sector back to the same one, or to nothing again, says so: nothing changed when it was the same', r.setSector(3, 4) === false && r.setSector(3, null) === true && r.cars[3].sector === null && order(r) === 'Alex,Sam,Kim,Lee,Max' && r.setSector(3, null) === false);
  ok('an empty choice is nothing (empty text, 0, null, undefined), a sector that does not exist is refused, a whole number is made of 2.7', r.setSector(1, '') === true && r.cars[1].sector === null && r.setSector(1, 2.7) === true && r.cars[1].sector === 2 && r.setSector(1, 0) === true && r.cars[1].sector === null && r.setSector(1, 5) === false && r.setSector(1, -1) === false && r.setSector(1, 'x') === false
    && r.setSector(1, NaN) === false && r.setSector(1, Infinity) === false && r.cars[1].sector === null && r.setSector(1, undefined) === false);
  ok('a car that finished cannot be given a sector, and neither can a car that does not exist', r.setSector(0, 2) === false && r.cars[0].sector === null && r.setSector(9, 2) === false && r.setSector(-1, 2) === false && r.setSector(0.5, 2) === false); }
{ const r = leader();
  r.setSector(1, 2); r.setSector(2, 2); r.setSector(3, 2);
  ok('three cars in the same sector with the same laps are in the order they crossed the line (Kim, Lee, Sam), and each knows its group', order(r) === 'Alex,Kim,Lee,Sam,Max' && r.sectorGroup(2).join() === '2,3,1' && r.sectorGroup(1).join() === '2,3,1' && r.sectorGroup(0).length === 0 && r.sectorGroup(4).length === 0);
  ok('the arrows: Sam one place up goes ahead of Lee', r.moveSector(1, -1) === true && order(r) === 'Alex,Kim,Sam,Lee,Max');
  ok('...up again: ahead of Kim, and then it cannot go further up', r.moveSector(1, -1) === true && order(r) === 'Alex,Sam,Kim,Lee,Max' && r.moveSector(1, -1) === false && order(r) === 'Alex,Sam,Kim,Lee,Max');
  ok('...Sam one place down: behind Kim again, and the last of the group cannot go further down', r.moveSector(1, 1) === true && order(r) === 'Alex,Kim,Sam,Lee,Max' && r.moveSector(3, 1) === false && r.moveSector(3, 2) === false && r.moveSector(3, 0) === false);
  ok('...the order the Race Director gave stays when the standings are asked again, and every car of the group has a place in it', order(r) === order(r) && r.cars[2].secOrder === 1 && r.cars[1].secOrder === 2 && r.cars[3].secOrder === 3);
  ok('a car with no sector has no group and cannot be moved, nor can a car that finished or a car that does not exist', r.setSector(4, null) === false && r.moveSector(4, -1) === false && r.moveSector(0, -1) === false && r.moveSector(9, -1) === false && r.moveSector(-1, -1) === false);
  r.setSector(0, 2);
  ok('a car joins the group at the end: Max to sector 2 has fewer laps, so it is no part of the group; Sam leaving it keeps the order of the others', r.setSector(4, 2) && r.sectorGroup(2).join() === '2,1,3' && r.setSector(1, 4) && order(r) === 'Alex,Sam,Kim,Lee,Max' && r.sectorGroup(2).join() === '2,3');
  ok('...a car that joins a group with an order is behind the cars that have one: Sam back in sector 2 is last', r.setSector(1, 2) && order(r) === 'Alex,Kim,Lee,Sam,Max');
  r.setSector(4, null);
  ok('...changing the laps in the review (a lap taken off Kim) takes it out of the group, and the order of the group is no longer used', r.adjust(2, { laps: -1 }) && order(r) === 'Alex,Lee,Sam,Kim,Max' && r.sectorGroup(2).length === 1);
  ok('...and the lap back puts it in the group again, with the order that was given (Kim, Lee, Sam)', r.adjust(2, { laps: 1 }) && order(r) === 'Alex,Kim,Lee,Sam,Max'); }
{ // an order the Race Director gave only counts while the laps and the sector are the ones it was given for
  const r = leader(); r.setSector(2, 2); r.setSector(4, 2); r.setSector(3, 2); r.moveSector(3, -1); // Kim, Lee and Max (3 laps) in sector 2: Lee (4 laps) was put ahead of Kim
  ok('Lee is put ahead of Kim (both 4 laps, sector 2), Max has 3 laps and is behind them', order(r) === 'Alex,Lee,Kim,Sam,Max' && r.cars[3].secOrder === 1);
  r.adjust(3, { laps: -1 });
  ok('...a lap taken off Lee puts him in the group of Max (3 laps, sector 2): the order he was given for the other group is not used, so the car that crossed the line first at 3 laps is first (Max)', order(r) === 'Alex,Kim,Sam,Max,Lee');
  r.adjust(3, { laps: 1 });
  ok('...the lap back, and the order he was given counts again', order(r) === 'Alex,Lee,Kim,Sam,Max'); }
{ // a car that did finish keeps its place above a car that did not, also when the laps are the same (a lap added in the review)
  const r = leader(); r.adjust(2, { laps: 1 }); // Kim: 5 laps counted, like Alex, who finished
  ok('Kim has 5 laps counted, the same as Alex, who finished: Alex stays first', r.lapsOf(r.cars[2]) === 5 && order(r).startsWith('Alex,Kim'));
  r.setSector(2, 3);
  ok('...a sector for Kim does not put her above the car that finished', order(r).startsWith('Alex,Kim') && r.cars[0].done); }
{ // a car that is disqualified after it was given a sector is out of its group
  const r = leader(); r.setSector(1, 3); r.setSector(2, 3);
  ok('Sam and Kim in sector 3 are a group of two', r.sectorGroup(1).length === 2 && r.sectorGroup(2).length === 2);
  r.setDq(2, true);
  ok('...Kim is disqualified: she has no group and cannot be moved, and Sam is alone', r.sectorGroup(2).length === 0 && r.moveSector(2, -1) === false && r.sectorGroup(1).join() === '1' && r.moveSector(1, -1) === false && r.cars[2].dq);
  r.setDq(2, false);
  ok('...and when she is let back in they are a group again', r.sectorGroup(1).length === 2); }

{ // the race is not over: nothing can be set, and when a car retires or is disqualified
  const r = E.createRace({ type: 'race', laps: 5, endRule: 'leader', entries: entries(3), sectors: SEC }); r.start(0);
  ok('while the race is running nothing can be set', r.setSector(1, 2) === false && r.moveSector(1, 1) === false);
  feed(r, [[0, 5, 10000], [1, 4, 10100], [2, 4, 10200]]);
  ok('...when it is over a car that did not finish can', r.status === 'finished' && r.setSector(1, 2) === true);
  r.setDq(2, true);
  ok('...a disqualified car cannot, and it ranks behind the rest as before', r.setSector(2, 3) === false && order(r) === 'Alex,Sam,Kim' && r.cars[2].sector === null);
  r.setDq(2, false);
  ok('...and when it is let back in it can', r.setSector(2, 3) === true && order(r) === 'Alex,Kim,Sam'); }
{ // a race that the Race Director stops
  const r = E.createRace({ type: 'race', laps: 20, endRule: 'all', entries: entries(4), sectors: SEC }); r.start(0);
  feed(r, [[0, 6, 10000], [1, 6, 10100], [2, 5, 10200], [3, 6, 10300]]); r.stop(70000);
  ok('a race that is stopped has no car that finished: the cars with 6 laps are in the order they crossed the line, and a sector decides between them (Lee in sector 2 goes ahead of Sam)', r.status === 'finished' && r.endedBy === 'Stopped' && r.cars.every(c => !c.done) && order(r) === 'Alex,Sam,Lee,Kim'
    && r.setSector(3, 2) && order(r) === 'Lee,Alex,Sam,Kim');
  ok('...a car with a sector is ahead of cars with none, a later sector ahead of an earlier one (Sam 3, Lee 2, Alex 1), the laps are the same', r.setSector(0, 1) && order(r) === 'Lee,Alex,Sam,Kim' && r.setSector(1, 3) && order(r) === 'Sam,Lee,Alex,Kim'); }
{ // a race of a set time (the cars finish after the time; stopped before the time is up, nobody has finished)
  const r = E.createRace({ type: 'timed', duration: 1, entries: entries(3), sectors: SEC }); r.start(0);
  feed(r, [[0, 4, 10000], [1, 4, 10100], [2, 4, 10200]]); r.stop(45000);
  ok('a race of a set time that is stopped: the cars with the same laps by sector', r.status === 'finished' && order(r) === 'Alex,Sam,Kim' && r.setSector(2, 3) && order(r) === 'Kim,Alex,Sam'); }
{ // a race of a set time where some cars finished after the time and one did not
  const r = E.createRace({ type: 'timed', duration: 0.5, entries: entries(3), sectors: SEC }); r.start(0);
  feed(r, [[0, 3, 10000], [1, 3, 10100]]); r.cross(0, 40000); r.cross(1, 40100); r.stop(41000);
  r.cross && null;
  const done = r.cars.map(c => c.done).join();
  ok('a race of a set time where two cars finished and one did not: only the car that did not finish gets a sector, the order of the others stays', done === 'true,true,false' && order(r) === 'Alex,Sam,Kim' && r.setSector(0, 2) === false && r.setSector(2, 3) === true && order(r) === 'Alex,Sam,Kim'); }

// ---- a race by distance: the same distance, not the same laps ----
{ const track = { lanes: 2, length: 10, laneModifier: 'measured', laneLengths: '10, 8' };
  const cfg = Ds.config({ sessionType: 'race', raceBy: 'distance', distance: 50 }, track, 2);
  const people = [0, 1, 2].map(i => ({ lane: i % 2, driverId: 'd' + i, carId: 'c' + i, driverName: NAMES[i], carName: 'car' }));
  const r = E.createRace({ type: 'race', laps: 0, distance: cfg, endRule: 'leader', entries: people, sectors: SEC }); r.start(0);
  // Alex (lane 1, 10 m) 5 laps = 50 m at 50 s. Sam (lane 2, 8 m) 5 laps = 40 m crossed first; Kim (lane 1, 10 m) 4 laps = 40 m crossed after Sam
  feed(r, [[0, 5, 10000], [1, 5, 8000], [2, 4, 10500]]);
  ok('a race by distance: Sam (5 laps of 8 m) and Kim (4 laps of 10 m) are both at 40 m, and Sam was there first', r.status === 'finished' && r.cars[0].done && order(r) === 'Alex,Sam,Kim');
  ok('...a sector decides between the same distance (Kim in sector 3 is ahead of Sam in sector 1), whatever the laps', r.setSector(2, 3) && r.setSector(1, 1) && order(r) === 'Alex,Kim,Sam' && r.sectorGroup(2).join() === '2' && r.sectorGroup(1).join() === '1');
  ok('...and in the same sector they are put in order with the arrows', r.setSector(1, 3) && order(r) === 'Alex,Sam,Kim' && r.sectorGroup(1).join() === '1,2' && r.moveSector(2, -1) && order(r) === 'Alex,Kim,Sam');
  const q = E.createRace({ type: 'race', laps: 0, distance: cfg, endRule: 'leader', entries: people, sectors: SEC }); q.start(0);
  feed(q, [[0, 5, 10000], [1, 4, 9000], [2, 4, 10500]]);
  ok('...a car with more distance is never put behind by a sector (Sam 4 laps of 8 m = 32 m is behind Kim, 40 m, in sector 4)', order(q) === 'Alex,Kim,Sam' && q.setSector(1, 4) && order(q) === 'Alex,Kim,Sam'); }

// ---- a total order, whatever is set ----
{ // random races: the cars that did not finish are in groups of the same laps; in each group the later sector is first, nobody changes group, and the order is the same every time it is asked
  let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  let bad = 0;
  for (let n = 0; n < 60; n++) {
    const cars = 3 + Math.floor(rnd() * 4), r = E.createRace({ type: 'race', laps: 8, endRule: 'leader', entries: entries(cars).map((e, i) => ({ ...e, driverName: 'C' + i })), sectors: SEC }); r.start(0);
    const plan = [[0, 8, 10000]]; for (let i = 1; i < cars; i++) plan.push([i, 4 + Math.floor(rnd() * 3), 10000 + Math.floor(rnd() * 900)]); feed(r, plan);
    const before = r.standings().map(x => x.index);
    r.cars.forEach((c, i) => { if (!c.done) { const s = Math.floor(rnd() * 5); r.setSector(i, s === 0 ? null : s); } });
    for (let m = 0; m < 6; m++) { const i = Math.floor(rnd() * cars); r.moveSector(i, rnd() < 0.5 ? -1 : 1); }
    const after = r.standings().map(x => x.index);
    const lapsOf = i => r.lapsOf(r.cars[i]);
    // the laps never get out of order, the finished car is first, and the same list again
    const sorted = after.every((i, p) => p === 0 || lapsOf(after[p - 1]) >= lapsOf(i)), same = JSON.stringify(after) === JSON.stringify(r.standings().map(x => x.index));
    const perm = [...after].sort((a, b) => a - b).join() === [...before].sort((a, b) => a - b).join();
    const inGroups = after.every((i, p) => p === 0 || lapsOf(after[p - 1]) !== lapsOf(i) || r.cars[i].done || r.cars[after[p - 1]].done || (r.cars[after[p - 1]].sector || 0) >= (r.cars[i].sector || 0));
    if (!(sorted && same && perm && inGroups && after[0] === 0)) bad++;
  }
  ok('60 random races: the laps never get out of order, the car that finished is first, all cars are there once, in a group of the same laps the later sector is first, and the order is the same every time', bad === 0); }

// ---- the heat race ----
{ const people = [0, 1, 2].map(i => ({ driverId: 'd' + i, carId: 'c' + i, driverName: NAMES[i], nickname: '', carName: 'car' }));
  const H = E.createHeatRace({ participants: people, schedule: [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }, { p: 2, lane: 2 }]], points: [10, 8, 6], lanes: 3, finals: 'none', resultBy: 'points' }), ent = H.entries().map(e => ({ ...e }));
  const q = E.createRace({ type: 'race', laps: 5, endRule: 'leader', entries: ent, sectors: SEC }); q.start(0);
  feed(q, [[0, 5, 10000], [1, 4, 10100], [2, 4, 10200]]);
  const byDriver = id => q.cars.findIndex(c => c.driverId === id);
  q.setSector(byDriver('d2'), 2); q.setSector(byDriver('d1'), 1);
  H.record(q); const rows = H.results[0].rows;
  ok('a heat holds the sector of a car that did not finish in its row, with the name of the sector, and the places follow it (Kim in sector 2 ahead of Sam in sector 1)', rows.map(r => r.participant + ':' + r.pos).join() === '0:1,2:2,1:3'
    && rows.find(r => r.participant === 2).sector === 2 && rows.find(r => r.participant === 2).sectorName === 'Hairpin' && rows.find(r => r.participant === 1).sector === 1 && rows.find(r => r.participant === 1).sectorName === 'Start');
  ok('...a car with a sector without a name has none in the row, and a car with no sector has neither', (() => { const r2 = E.createRace({ type: 'race', laps: 5, endRule: 'leader', entries: ent, sectors: SEC }); r2.start(0); feed(r2, [[0, 5, 10000], [1, 4, 10100], [2, 4, 10200]]); r2.setSector(1, 3);
    const H2 = E.createHeatRace({ participants: people, schedule: [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }, { p: 2, lane: 2 }]], points: [10, 8, 6], lanes: 3, finals: 'none', resultBy: 'points' }); H2.record(r2);
    const w = H2.results[0].rows; return w.find(x => x.participant === r2.cars[1].participant).sector === 3 && !('sectorName' in w.find(x => x.participant === r2.cars[1].participant)) && w.filter(x => !('sector' in x)).length === 2; })());
  ok('a race without sectors adds nothing to the rows', (() => { const H3 = E.createHeatRace({ participants: people, schedule: [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }]], points: [10, 8], lanes: 2, finals: 'none', resultBy: 'points' });
    const r3 = E.createRace({ type: 'race', laps: 2, endRule: 'all', entries: H3.entries().map(e => ({ ...e })) }); r3.start(0); feed(r3, [[0, 2, 10000], [1, 2, 10100]]); H3.record(r3); return H3.results[0].rows.every(x => !('sector' in x) && !('sectorName' in x)); })()); }

// ---- an interrupted race comes back with the sectors ----
{ const r = leader(); r.setSector(1, 2); r.setSector(2, 2); r.moveSector(1, -1);
  const snap = r.snapshot(60000), q = E.createRace({ type: 'race', laps: 5, endRule: 'leader', entries: entries(), sectors: SEC });
  ok('a snapshot of the race in its review keeps the sectors and the order of the Race Director, and a race made again from it has them', q.restore(snap) && q.cars.map(c => c.sector).join() === r.cars.map(c => c.sector).join() && order(q) === order(r) && q.cars.map(c => c.secOrder).join() === r.cars.map(c => c.secOrder).join()); }

// ---- the other windows ----
{ const r = leader(); r.setSector(1, 3); r.setSector(2, 2); r.setSector(3, 2); r.moveSector(3, -1);
  const cx = { raceId: 'x', eng: r, phase: 'review', calling: false, lights: 5, heat: null, flash: new Map(), bestAll: Infinity, bestAllName: '', bestBy: new Map(), now: 70000, champ: null };
  const wire = m => JSON.parse(JSON.stringify(m)), got = LS.applyDynamic(null, wire(LS.packDynamic(cx)));
  ok('the sectors and their order are sent to the other windows with the race, so the review there shows the same', got.ok && got.state.cars.map(c => c.sector).join() === r.cars.map(c => c.sector).join() && got.state.cars.map(c => c.secOrder).join() === r.cars.map(c => c.secOrder).join() && got.state.cars.map(c => c.secAt).join() === r.cars.map(c => c.secAt).join());
  const st = LS.packStatic({ eng: r, base: { personal: new Map(), track: Infinity, trackName: '' } });
  let cloned = true; try { structuredClone(st); } catch { cloned = false; }
  ok('...and the sectors of the track travel in the settings of the race, so the other window works out the same order', cloned && st.cfg.sectors.count === 4 && st.cfg.sectors.names.join() === 'Start,Hairpin,,Back'
    && (() => { const v = E.createRace({ ...st.cfg, entries: st.cfg.entries.map(e => ({ ...e })) }); v.cars.forEach((c, i) => Object.assign(c, wire(got.state.cars[i]))); return order(v) === order(r) && v.sectors.count === 4; })()); }

// ---- the review ----
{ const r = leader(); const html = () => Review.html(r, {});
  let h = html();
  ok('the review has a line for every car that did not finish, with the sector it was last seen in (none yet), and none for the car that finished', !h.includes('data-rvs="0"') && [1, 2, 3, 4].every(i => h.includes(`data-rvs="${i}"`)) && (h.match(/data-rvs=/g) || []).length === 4);
  ok('...the choice has the sectors with their names, and "not set" for nothing', (h.match(/<option value="2">Sector 2 · Hairpin<\/option>/g) || []).length === 4 && (h.match(/<option value="3">Sector 3<\/option>/g) || []).length === 4 && (h.match(/<option value="">not set/g) || []).length === 4 && !h.includes('selected'));
  ok('...a line above the table says how it works, and the line of a car says who it is for', h.includes('class="muted rv-secnote"') && /later sector ranks higher/.test(h) && h.includes('aria-label="Sector where Sam was last seen"') && h.includes('Last seen in'));
  ok('...no arrows yet: no two cars share a sector', !h.includes('data-rv="sectormove"'));
  r.setSector(1, 3); r.setSector(2, 3); r.setSector(3, 2); h = html();
  ok('a car with a sector has it selected', /<option value="3" selected>/.test(h.split('data-rvs="1"')[1].split('</tr>')[0]) && /<option value="2" selected>/.test(h.split('data-rvs="3"')[1].split('</tr>')[0]) && !/ selected>/.test(h.split('data-rvs="4"')[1].split('</tr>')[0]));
  const rowOf = i => h.split(`data-rvs="${i}"`)[1].split('</tr>')[0];
  ok('...two cars in the same sector with the same laps get arrows (Sam and Kim, in sector 3), a car alone in its sector does not', (rowOf(1).match(/data-rv="sectormove"/g) || []).length === 2 && (rowOf(2).match(/data-rv="sectormove"/g) || []).length === 2);
  const first = order(r).split(',').indexOf('Sam') < order(r).split(',').indexOf('Kim') ? 1 : 2, second = first === 1 ? 2 : 1;
  ok('...the first of the pair cannot go up, the second cannot go down, and the labels say what the arrows do', new RegExp(`data-car="${first}" data-dir="-1"[^>]*disabled`).test(rowOf(first)) && !new RegExp(`data-car="${first}" data-dir="1"[^>]*disabled`).test(rowOf(first)) && new RegExp(`data-car="${second}" data-dir="1"[^>]*disabled`).test(rowOf(second)) && !new RegExp(`data-car="${second}" data-dir="-1"[^>]*disabled`).test(rowOf(second))
    && rowOf(first).includes(`aria-label="Put ${NAMES[first]} behind ${NAMES[second]}"`) && rowOf(second).includes(`aria-label="Put ${NAMES[second]} ahead of ${NAMES[first]}"`) && rowOf(first).includes('2 cars in this sector with 4 laps'));
  ok('...Lee, alone in sector 2, has no arrows', !rowOf(3).includes('sectormove'));
  ok('...the arrow up is a triangle that points up, the arrow down one that points down', /data-dir="-1"[^>]*>\u25b2</.test(rowOf(1)) && /data-dir="1"[^>]*>\u25bc</.test(rowOf(1)) && /data-dir="-1"[^>]*>\u25b2</.test(rowOf(2)) && /data-dir="1"[^>]*>\u25bc</.test(rowOf(2)));
  r.setDq(2, true); h = html();
  ok('a disqualified car has no line, and a car that finished has none', !h.includes('data-rvs="2"') && !h.includes('data-rvs="0"'));
  r.setDq(2, false); r.cars[4].retired = true; r.cars[4].done = true; h = html();
  ok('...nor has a car that is out of the race', !h.includes('data-rvs="4"') && h.includes('data-rvs="3"'));
  const quiet = E.createRace({ type: 'race', laps: 2, endRule: 'all', entries: entries(3), sectors: SEC }); quiet.start(0); feed(quiet, [[0, 2, 10000], [1, 2, 10100], [2, 2, 10200]]);
  ok('when every car finished there is no line and no note', quiet.status === 'finished' && !Review.html(quiet, {}).includes('data-rvs') && !Review.html(quiet, {}).includes('rv-secnote'));
  const none = leader({ sectors: null });
  ok('a race without sectors has none of it in the review', !Review.html(none, {}).includes('data-rvs') && !Review.html(none, {}).includes('rv-secnote') && !Review.html(none, {}).includes('sectormove')); }
{ const r = leader();
  ok('the review carries out the choice and the arrows (the same operations for the Race Director\'s window and the others)', Review.apply(r, { op: 'sector', car: 1, sector: 3 }) === true && r.cars[1].sector === 3 && Review.apply(r, { op: 'sector', car: 2, sector: 3 }) && Review.apply(r, { op: 'sectormove', car: 1, dir: -1 }) === true && order(r) === 'Alex,Sam,Kim,Lee,Max'
    && Review.apply(r, { op: 'sector', car: 1, sector: null }) === true && r.cars[1].sector === null);
  ok('...a car that is not a whole number, or a wrong arrow, does nothing', Review.apply(r, { op: 'sector', car: 'x', sector: 2 }) === false && Review.apply(r, { op: 'sector', car: 1.5, sector: 2 }) === false && Review.apply(r, { op: 'sectormove', car: 'x', dir: 1 }) === false && Review.apply(r, { op: 'sectormove', car: 2, dir: 5 }) === false && Review.apply(r, { op: 'sectormove', car: 2 }) === false);
  const sent = [], root = {}; Review.bind(root, c => sent.push(c), () => {});
  root.onchange({ target: { closest: () => ({ dataset: { rvs: '2' }, value: '3' }) } }); root.onchange({ target: { closest: () => ({ dataset: { rvs: '3' }, value: '' }) } }); root.onchange({ target: { closest: () => null } }); root.onchange({ target: {} });
  ok('choosing a sector in the dropdown sends the car and the sector (nothing: null), and a change of something else sends nothing', sent.length === 2 && sent[0].op === 'sector' && sent[0].car === 2 && sent[0].sector === 3 && sent[1].op === 'sector' && sent[1].car === 3 && sent[1].sector === null);
  root.onclick({ target: { closest: () => ({ dataset: { rv: 'sectormove', car: '2', dir: '-1' } }) } }); root.onclick({ target: { closest: () => ({ dataset: { rv: 'sectormove', car: '3', dir: '1' } }) } });
  ok('the arrows send the car and the direction', sent.length === 4 && sent[2].op === 'sectormove' && sent[2].car === 2 && sent[2].dir === -1 && sent[3].dir === 1 && sent[3].car === 3);
  root.onclick({ target: { closest: () => ({ dataset: { rv: 'invalid', car: '1', lap: '2', on: '1' } }) } });
  ok('...and the other buttons send what they sent before (no direction)', sent[4].op === 'invalid' && sent[4].car === 1 && sent[4].lap === 2 && sent[4].on === true && !('dir' in sent[4])); }

// ---- the words ----
{ const S = Stats;
  ok('the sector of a car in the results: "sector 3", with the name of the sector behind it when it has one, and nothing for no sector', S.sectorText({ sector: 3 }) === 'sector 3' && S.sectorText({ sector: 2, sectorName: 'Hairpin' }) === 'sector 2 (Hairpin)' && S.sectorText({}) === '' && S.sectorText(null) === '' && S.sectorText({ sector: 0 }) === '' && S.sectorText({ sector: null, sectorName: 'x' }) === ''); }

console.log(fails ? `${fails} SECTORS TESTS FAILED` : 'ALL SECTORS TESTS PASSED'); process.exit(fails ? 1 : 0);
