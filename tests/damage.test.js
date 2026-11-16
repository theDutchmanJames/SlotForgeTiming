// 1.10.0: the Damage System. The pure rules (damage.js): the levels of a Damage System, the level damage points have reached, the damage points a hit gives (a fragile car),
// the lap by which a car should be in the pits, the moment a repair is done and the words.
const D = require('../renderer/damage.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---- the record ----
ok('no record: no rules', D.clean(null) === null && D.clean(undefined) === null && D.clean('x') === null);
{ const c = D.clean({ ...D.defaults(), stop: 'overlap' }, 25);
  ok('the defaults are the four examples: 3 light (10 s), 6 medium (15 s), 9 heavy (20 s, as fast as you can), 10 critical (retire)',
    same(c.levels.map(l => [l.name, l.from, l.seconds, l.urgent, l.action]), [['Light damage', 3, 10, false, 'repair'], ['Medium damage', 6, 15, false, 'repair'], ['Heavy damage', 9, 20, true, 'repair'], ['Critical damage', 10, 0, true, 'retire']]));
  ok('...a level has its time in milliseconds', same(c.levels.map(l => l.ms), [10000, 15000, 20000, 0]));
  ok('...heavy damage must be in the pits within 3 laps, critical within 1', same(c.levels.map(l => l.within), [0, 0, 3, 1]));
  ok('...and the incidents are Deslot 1, Contact 2 and Hard crash 4', same(c.incidents, [{ name: 'Deslot', points: 1 }, { name: 'Contact', points: 2 }, { name: 'Hard crash', points: 4 }]));
  ok('the deslot time of the track (seconds) is kept in milliseconds', c.deslotMs === 25000 && D.clean({}, 0).deslotMs === 0 && D.clean({}, '').deslotMs === 0 && D.clean({}, -3).deslotMs === 0);
  ok('...the standard settings of a record: at the same time, 1 point for a deslot, 1 for every late lap, 1 for leaving early', c.stop === 'overlap' && c.deslotPoints === 1 && c.latePoints === 1 && c.earlyPoints === 1 && c.on === true); }
{ const c = D.clean({ stop: 'add', deslotPoints: 3, latePoints: 2, earlyPoints: 0 });
  ok('one after the other, and the points a record sets', c.stop === 'add' && c.deslotPoints === 3 && c.latePoints === 2 && c.earlyPoints === 0 && c.levels.length === 0 && c.incidents.length === 0);
  ok('a record without a deslot setting gives 1 point; 0 means none', D.clean({}).deslotPoints === 1 && D.clean({ deslotPoints: 0 }).deslotPoints === 0 && D.clean({ deslotPoints: '' }).deslotPoints === 1);
  ok('anything but "add" is at the same time', D.clean({ stop: 'x' }).stop === 'overlap' && D.clean({ stop: 'overlap' }).stop === 'overlap'); }
{ const c = D.clean({ levels: [{ name: ' B ', from: 6, seconds: '15', urgency: 'asap', within: '2.7', action: 'dq' }, { name: 'A', from: 3.9, seconds: 5, urgency: 'whenever', within: 0, action: 'weird' }, { name: 'dup', from: 6, seconds: 1 }, { name: 'zero', from: 0 }, { name: 'neg', from: -2 }, null, { name: '', from: 9 }] });
  ok('levels are sorted by their points, a level that starts at 0 or below is left out, and so is a second level with the same points', same(c.levels.map(l => l.from), [3, 6, 9]));
  ok('...points are whole numbers (3.9 is 3), a name is trimmed, a missing name is "Level N" by its place', c.levels[0].name === 'A' && c.levels[1].name === 'B' && c.levels[2].name === 'Level 3');
  ok('...an unknown action is a repair; dq and retire stay', c.levels[0].action === 'repair' && c.levels[1].action === 'dq');
  ok('...the seconds and the deadline (laps, a whole number) are read', c.levels[1].seconds === 15 && c.levels[1].ms === 15000 && c.levels[1].within === 2 && c.levels[1].urgent === true && c.levels[0].urgent === false);
  const e = D.clean({ incidents: [{ name: ' Hit ', points: '2.6' }, { name: '', points: 3 }, { name: 'None', points: 0 }, { name: 'Neg', points: -1 }, null, { name: 'Ok', points: 1 }] });
  ok('incidents need a name and at least 1 point (whole numbers)', same(e.incidents, [{ name: 'Hit', points: 2 }, { name: 'Ok', points: 1 }])); }

// ---- the level ----
{ const c = D.clean(D.defaults());
  ok('below the first level there is none', D.levelAt(c, 0) === -1 && D.levelAt(c, 2) === -1 && D.levelOf(c, 2) === null);
  ok('a level starts at its points and lasts until the next one', [3, 5, 6, 8, 9, 10, 99].map(p => D.levelAt(c, p)).join() === '0,0,1,1,2,3,3');
  ok('levelOf gives the level itself', D.levelOf(c, 7).name === 'Medium damage');
  ok('no rules: no level', D.levelAt(null, 5) === -1 && D.levelOf(null, 5) === null && D.levelAt(D.clean({}), 5) === -1); }

// ---- the damage a hit gives ----
ok('a hit gives its points; 1 is the standard factor', D.scale(3, 1) === 3 && D.scale(3) === 3 && D.scale(3, '') === 3 && D.scale(3, 'x') === 3);
ok('a fragile car (1.5) has more, a sturdy one (0.5) less, never less than 1 point for a hit', D.scale(3, 1.5) === 5 && D.scale(1, 0.4) === 1 && D.scale(4, 0.5) === 2 && D.scale(2, 2) === 4);
ok('a factor of 0 is a car that takes no damage', D.scale(4, 0) === 0 && D.factorOf(0) === 0 && D.factorOf(2) === 2 && D.factorOf(-1) === 0 && D.factorOf(null) === 1);
ok('taking points back is not scaled; nothing is nothing', D.scale(-2, 3) === -2 && D.scale(-1.4, 0) === -1 && D.scale(0, 3) === 0 && D.scale(NaN, 1) === 0);

// ---- the lap by which the car should be in the pits ----
{ const light = { within: 0 }, heavy = { within: 3 }, crit = { within: 1 };
  ok('a level without a deadline leaves it as it was (none, or the deadline of the lower level)', D.dueLap(null, 5, light) === null && D.dueLap(9, 5, light) === 9 && D.dueLap(null, 5, null) === null && D.dueLap(7, 5, null) === 7);
  ok('a level with a deadline gives the lap: the laps driven plus the laps it allows', D.dueLap(null, 5, heavy) === 8 && D.dueLap(undefined, 5, heavy) === 8);
  ok('a higher level can only make it sooner', D.dueLap(10, 5, heavy) === 8 && D.dueLap(6, 5, heavy) === 6 && D.dueLap(8, 5, crit) === 6); }

// ---- the repair is done ----
{ const c = D.clean({ stop: 'overlap' }), a = D.clean({ stop: 'add' }), lv = { ms: 10000 };
  ok('at the same time, the seconds count from the moment the car stands still', D.doneAt(c, lv, 5000, 9000) === 15000 && D.doneAt(c, lv, 5000) === 15000);
  ok('one after the other, they count from the moment the other work is done', D.doneAt(a, lv, 5000, 9000) === 19000 && D.doneAt(a, lv, 5000, 5000) === 15000);
  ok('...and never from before the car stood still', D.doneAt(a, lv, 5000, 1000) === 15000 && D.doneAt(a, lv, 5000) === 15000);
  ok('a repair of 0 seconds is done at once', D.doneAt(c, { ms: 0 }, 5000) === 5000 && D.doneAt(c, null, 5000) === 5000); }

// ---- the words ----
{ const c = D.clean(D.defaults());
  ok('a level in words: when to pit, how long to stand still, what it does', D.levelText(c.levels[0]) === 'Light damage (from 3 points): pit whenever you can; stand still for at least 10 seconds, which repairs the damage.');
  ok('...as fast as you can, with a deadline', D.levelText(c.levels[2]) === 'Heavy damage (from 9 points): pit as fast as you can, within 3 laps; stand still for at least 20 seconds, which repairs the damage.');
  ok('...a level that ends the car', D.levelText(c.levels[3]) === 'Critical damage (from 10 points): pit as fast as you can, within 1 lap; the car is retired.'
    && D.levelText({ ...c.levels[3], action: 'dq', seconds: 5 }) === 'Critical damage (from 10 points): pit as fast as you can, within 1 lap; stand still for at least 5 seconds and the car is disqualified.');
  ok('...one second is "1 second", one point "1 point"', D.levelText({ name: 'X', from: 1, seconds: 1, within: 0, urgent: false, action: 'repair' }).includes('(from 1 point)') && D.levelText({ name: 'X', from: 1, seconds: 1, within: 0, urgent: false, action: 'repair' }).includes('at least 1 second,') && D.levelText(null) === '');
  ok('the rules in one line', D.rulesText(c) === '3 = Light damage (10 seconds); 6 = Medium damage (15 seconds); 9 = Heavy damage (20 seconds); 10 = Critical damage (retires the car).');
  ok('...with no levels, and with no system', D.rulesText(D.clean({})).includes('no level') && D.rulesText(null) === '' && D.rulesText({ levels: [{ name: 'X', from: 2, seconds: 0, action: 'dq' }] }).includes('disqualifies the car'));
  ok('the colour of a level: none ok, below the first level minor, whenever amber, as fast as you can red, the end of the car out',
    D.toneOf(null, 0) === 'ok' && D.toneOf(null, 2) === 'minor' && D.toneOf(c.levels[0], 3) === 'amber' && D.toneOf(c.levels[2], 9) === 'red' && D.toneOf(c.levels[3], 10) === 'out' && D.toneOf({ ...c.levels[0], action: 'dq' }, 5) === 'out');
  ok('seconds as a clock, rounded up', D.secClock(0) === '0:00' && D.secClock(1) === '0:01' && D.secClock(9100) === '0:10' && D.secClock(65000) === '1:05' && D.secClock(-5) === '0:00'); }

// ---- noteOf: the result in words ----
{ const car = o => ({ dmg: 0, dmgTotal: 0, dmgOut: '', repairs: [], ...o });
  ok('nothing happened: no note', D.noteOf(car({}), [], 0) === '' && D.noteOf(null, [], 0) === '');
  ok('points only, one point is singular', D.noteOf(car({ dmgTotal: 1, dmg: 1 }), [], 0) === '1 damage point, 1 damage point not repaired');
  ok('repairs with the time in the pits', D.noteOf(car({ dmgTotal: 9, repairs: [{ ms: 10000 }, { ms: 15500 }] }), [], 0) === '9 damage points, 2 repairs (25.5 seconds in the pits)');
  ok('late and early, of this car only', D.noteOf(car({ dmgTotal: 3, dmg: 3 }), [{ car: 0, type: 'damagelate' }, { car: 0, type: 'damagelate' }, { car: 1, type: 'damagelate' }, { car: 0, type: 'repairearly' }], 0) === '3 damage points, 3 damage points not repaired, late for the pits twice, left the pits too early once');
  ok('a car that damage put out; the stop that did it is no repair', D.noteOf(car({ dmgTotal: 10, dmg: 10, dmgOut: 'retire', repairs: [{ ms: 0, out: 'retire' }] }), [], 0) === '10 damage points, retired by damage' && D.noteOf(car({ dmgTotal: 10, dmgOut: 'dq' }), [], 0) === '10 damage points, disqualified by damage'); }

// ---- 1.23.0: the damage of a driver in a heat race, added up over its heats and its final ----
{ const row = o => ({ damagePoints: 0, repairs: 0, repairMs: 0, ...o });
  ok('no damage in any heat: no note (and rows that are not there are no trouble)', D.totalNote([], null) === '' && D.totalNote([row({}), {}], null) === '' && D.totalNote(null, undefined) === '' && D.totalNote([row({})], row({})) === '');
  ok('points in one heat', D.totalNote([row({ damagePoints: 1 })], null) === '1 damage point in 1 heat');
  ok('points in several heats (a heat without damage is not counted), a repair with its time in the pits', D.totalNote([row({ damagePoints: 4, repairs: 1, repairMs: 10000 }), row({}), row({ damagePoints: 2 })], null) === '6 damage points in 2 heats, 1 repair (10 seconds in the pits)');
  ok('...repairs are plural, the time has one decimal', D.totalNote([row({ damagePoints: 3, repairs: 2, repairMs: 25500 })], null) === '3 damage points in 1 heat, 2 repairs (25.5 seconds in the pits)');
  ok('...the final is told too: after the heats, or alone', D.totalNote([row({ damagePoints: 3 })], row({ damagePoints: 2 })) === '5 damage points in 1 heat and the final' && D.totalNote([row({})], row({ damagePoints: 2 })) === '2 damage points in the final');
  ok('...retired or disqualified by damage, and in which: the heats, the final', D.totalNote([row({ damagePoints: 10, damageOut: 'retire' }), row({ damagePoints: 10, damageOut: 'retire' })], row({ damagePoints: 10, damageOut: 'dq' })) === '30 damage points in 2 heats and the final, retired by damage in 2 heats, disqualified by damage in the final');
  ok('...a heat that put the car out without points left (taken back later) still says so', D.totalNote([row({ damageOut: 'retire' })], null) === 'retired by damage in 1 heat'); }

console.log(fails ? `\n${fails} FAILED` : '\nALL DAMAGE TESTS PASSED');
process.exit(fails ? 1 : 0);
