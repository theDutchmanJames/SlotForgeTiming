// The words of the Penalty and Damage system forms (renderer/systemwords.js, 1.73.0): the pills, the sentence "In plain words", the notes and the dots of the rail, the bar of the levels
const W = require('../renderer/systemwords.js'), Dm = require('../renderer/damage.js'), Eng = require('../renderer/engine.js');
let fails = 0; const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const flat = d => d.say.map(p => p.t).join('');
const bolds = d => d.say.filter(p => p.b).map(p => p.t);
const PT = [{ name: 'Drivethrough', kind: 'drivethrough', seconds: 0, cost: 5, extra: 1, unserved: 10 }, { name: 'Stop-and-Go 5 s', kind: 'stopgo', seconds: 5, cost: 5, extra: 1, unserved: 10 }, { name: 'Stop-and-Go 10 s', kind: 'stopgo', seconds: 10, cost: 10, extra: 1, unserved: 15 }];
const P0 = { name: 'Club penalties', timeRule: 'every', everyPoints: '5', everySeconds: '5', steps: '5=5, 10=12, 15=30', dqPoints: '20', fuelPoints: '2', types: PT };
const pen = (o, c) => W.describe('penaltysystems', { ...P0, ...o }), penRail = (o) => W.rail('penaltysystems', { ...P0, ...o }, { lists: { types: PT } });
const DF = Dm.defaults();
const D0 = { name: 'Club damage', stop: 'overlap', deslotPoints: '1', latePoints: '1', earlyPoints: '1', failuresOn: 'off', failFrom: '10', failTo: '90', failMax: '1', levels: DF.levels, incidents: DF.incidents, failures: DF.failures };
const dam = o => W.describe('damagesystems', { ...D0, ...o }), damRail = o => W.rail('damagesystems', { ...D0, ...o }, { lists: DF, defaults: { latePoints: 1, earlyPoints: 1 } });

console.log('-- the Penalty system');
{
  const d = pen({});
  ok('the sentence of the design: every 5 points add 5 seconds, the special penalties, disqualification and the empty tank', flat(d) === 'Every 5 penalty points add 5 seconds to the race time, so 12 points are 10 seconds. The Race Director can also give a Drivethrough or a Stop-and-Go (3 special penalties). A driver is disqualified at 20 points, and every lap driven on an empty tank gives 2 points.');
  ok('...the numbers and the names are the bold parts', bolds(d).join('|') === '5 penalty points|5 seconds|Drivethrough|Stop-and-Go|disqualified at 20 points|2 points');
  ok('the pills: the rule first (marked), then the special penalties and the disqualification', d.pills.map(p => p.text + (p.tone ? '*' : '')).join('|') === 'Every 5 points add 5 s*|3 special penalties|Disqualified at 20 points');
  ok('a system with a name is ready to use, one without a name is told to get one', d.ready.ok && d.ready.text === 'Ready to use' && !pen({ name: '  ' }).ready.ok && pen({ name: '' }).ready.text === 'Give it a name');
  ok('the note under the time rule says what 12 points are, and that only full blocks count', d.notes.basics.tone === 'info' && d.notes.basics.parts.map(p => p.t).join('') === '12 points are 10 seconds. Only full blocks of 5 points count, so 4 points are no time at all and 5 points are 5 seconds.');
}
{
  // the example in the sentence is the time the race will really give
  let allSame = true;
  for (const every of [1, 2, 3, 4, 5, 6, 7, 10, 12]) for (const seconds of [1, 2, 5, 7.5, 10, 30]) {
    const d = pen({ timeRule: 'every', everyPoints: String(every), everySeconds: String(seconds) }), m = /so (\d+) points? (?:is|are) ([\d.]+) seconds?/.exec(flat(d));
    const P = Eng.penaltyConfig({ timeRule: 'every', everyPoints: every, everySeconds: seconds });
    if (!m || Number(m[2]) * 1000 !== Eng.penaltyMs(P, Number(m[1])) || Number(m[1]) < 1) allSame = false;
  }
  ok('the example "so N points are S seconds" is what the race gives for N points (9 x 6 rules)', allSame);
  ok('one point at a time: "Every penalty point adds 5 seconds", and the pill', flat(pen({ everyPoints: '1' })).startsWith('Every penalty point adds 5 seconds to the race time, so 2 points are 10 seconds.') && pen({ everyPoints: '1' }).pills[0].text === 'Every point adds 5 s');
  ok('an empty or wrong rule is what the race uses: every 5 points, 5 seconds', flat(pen({ everyPoints: '', everySeconds: 'x' })).startsWith('Every 5 penalty points add 5 seconds'));
  ok('0 seconds: no example, and no note', flat(pen({ everySeconds: '0' })).startsWith('Every 5 penalty points add 0 seconds to the race time. ') && !pen({ everySeconds: '0' }).notes.basics);
  ok('a number that the race cannot read is the standard one, also in the words (7,5 is not a number: 5 seconds)', flat(pen({ everySeconds: '7,5' })).includes('add 5 seconds') && pen({ everySeconds: '7,5' }).pills[0].text === 'Every 5 points add 5 s' && flat(pen({ everySeconds: '7.5' })).includes('add 7.5 seconds'));
}
{
  const d = pen({ timeRule: 'steps' });
  ok('steps: "from 5 points it is 5 seconds, from 10 points 12 seconds and from 15 points 30 seconds", the highest step counts', flat(d).startsWith('Penalty points turn into time in steps: from 5 points it is 5 seconds, from 10 points it is 12 seconds and from 15 points it is 30 seconds. The highest step a driver has reached counts.') && d.pills[0].text === 'Time in 3 steps');
  ok('...the note takes a number between the steps and tells what the race gives', d.notes.basics.parts.map(p => p.t).join('') === '12 points are 12 seconds. The highest step reached counts. Below 5 points there is no time at all.' && Eng.penaltyMs(Eng.penaltyConfig({ timeRule: 'steps', steps: P0.steps }), 12) === 12000);
  ok('...one step is said as one step', flat(pen({ timeRule: 'steps', steps: '5=5' })).includes('in steps: from 5 points it is 5 seconds.') && pen({ timeRule: 'steps', steps: '5=5' }).pills[0].text === 'Time in 1 step');
  const many = pen({ timeRule: 'steps', steps: '5=5, 10=12, 15=30, 20=60, 25=90, 40=200' });
  ok('...six steps are told as the first and the last', flat(many).startsWith('Penalty points turn into time in 6 steps: from 5 points it is 5 seconds, and from 40 points it is 200 seconds.'));
  const none = pen({ timeRule: 'steps', steps: 'nonsense' });
  ok('...steps that cannot be read say so (the race gives no time then)', flat(none).startsWith('No steps are entered yet, so penalty points add no time.') && none.pills[0].text === 'No steps yet' && !none.notes.basics && Eng.penaltyMs(Eng.penaltyConfig({ timeRule: 'steps', steps: 'nonsense' }), 30) === 0);
  ok('...steps are put in order of points, as the race does', flat(pen({ timeRule: 'steps', steps: '10=12, 5=5' })).includes('from 5 points it is 5 seconds and from 10 points it is 12 seconds'));
}
{
  ok('no special penalties: no sentence and no pill', !flat(pen({ types: [] })).includes('Race Director') && pen({ types: [] }).pills.map(p => p.text).join('|') === 'Every 5 points add 5 s|Disqualified at 20 points');
  ok('one kind: "a Stop-and-Go (1 special penalty)"; a row without a name does not count', flat(pen({ types: [{ name: 'Long', kind: 'stopgo' }, { name: '  ', kind: 'drivethrough' }] })).includes('can also give a Stop-and-Go (1 special penalty).'));
  ok('no limit: "never disqualified by points", and the empty tank only when it gives points', flat(pen({ dqPoints: '', fuelPoints: '' })).endsWith('A driver is never disqualified by points.') && flat(pen({ dqPoints: '', fuelPoints: '3' })).endsWith('A driver is never disqualified by points. Every lap driven on an empty tank gives 3 points.') && flat(pen({ fuelPoints: '' })).endsWith('A driver is disqualified at 20 points.'));
  ok('...and no pill for the disqualification', !pen({ dqPoints: '' }).pills.some(p => /Disqualified/.test(p.text)));
}
{
  const r = penRail({});
  ok('the rail: Basics says the rule, Special penalties the kinds, the last section the limits (as in the design)', r.basics.rail === 'Every 5 points add 5 s' && r.special.rail === 'Drivethrough · 2 Stop-and-Go' && r.limits.rail === 'Out at 20 points · empty tank 2');
  ok('...a closed section says a little more', r.basics.row === 'Every 5 points add 5 seconds' && r.special.row === '3 special penalties: Drivethrough, Stop-and-Go 5 s, Stop-and-Go 10 s' && r.limits.row === 'Disqualified at 20 points. An empty tank gives 2 points a lap.');
  ok('...the dots: Basics filled in (green), the special penalties as they start (open ring), the limits changed (green)', r.basics.state === 'ok' && r.special.state === 'plain' && r.limits.state === 'ok');
  ok('...a name that is missing makes Basics amber; steps that cannot be read too', penRail({ name: '' }).basics.state === 'todo' && penRail({ timeRule: 'steps', steps: '' }).basics.state === 'todo' && penRail({ timeRule: 'steps', steps: '5=5' }).basics.state === 'ok');
  ok('...special penalties that are not the ones a new system starts with are changed; none at all is an open ring', penRail({ types: [{ name: 'Long', kind: 'stopgo', seconds: 20 }] }).special.state === 'ok' && penRail({ types: [] }).special.state === 'plain' && penRail({ types: [] }).special.rail === 'None');
  ok('...no limits: "Never out", an open ring', penRail({ dqPoints: '', fuelPoints: '' }).limits.rail === 'Never out' && penRail({ dqPoints: '', fuelPoints: '' }).limits.state === 'plain' && penRail({ dqPoints: '', fuelPoints: '' }).limits.row === 'Nobody is disqualified by points. An empty tank gives no points.');
  ok('...steps with no name are amber too (a name is needed whatever the rule is), and steps with a name are green', penRail({ timeRule: 'steps', name: '' }).basics.state === 'todo' && penRail({ timeRule: 'steps', name: 'x' }).basics.state === 'ok');
  ok('...a limit of either kind makes the last section green: only the points that disqualify, only the points for an empty tank, or both', penRail({ dqPoints: '20', fuelPoints: '' }).limits.state === 'ok' && penRail({ dqPoints: '', fuelPoints: '2' }).limits.state === 'ok' && penRail({ dqPoints: '20', fuelPoints: '2' }).limits.state === 'ok');
  ok('...steps in the rail: the number of steps, and the first three in the closed section', penRail({ timeRule: 'steps' }).basics.rail === '3 steps' && penRail({ timeRule: 'steps' }).basics.row === 'In steps: 5 = 5 s, 10 = 12 s, 15 = 30 s');
}

console.log('-- the Damage system');
{
  const d = dam({});
  ok('the sentence of the design: the deslot, the lowest and the highest level, the stop, the car failures', flat(d) === 'A deslot gives a car 1 damage point. From 3 points the car needs a Light damage repair: it stands still on the sensor in the pits for 10 seconds. At 10 points, Critical damage retires the car. The repair and the other work in the stop happen at the same time, so the longest job counts. Car failures are off.');
  ok('...with the numbers and names in bold', bolds(d).join('|') === '1 damage point|3 points|Light damage|10 seconds|10 points|Critical damage|retires|at the same time|off');
  ok('the pills: where the first level starts (marked), the levels, the incidents, the car failures', d.pills.map(p => p.text + (p.tone ? '*' : '')).join('|') === 'Repair from 3 points*|4 levels|3 incidents|Car failures off');
  ok('a system with a name is ready, one without is not', d.ready.ok && !dam({ name: '' }).ready.ok);
  ok('one after the other: the repair starts when the other work is done', flat(dam({ stop: 'add' })).includes('happen one after the other, so the repair starts when the other work is done.'));
  ok('a deslot that gives nothing', flat(dam({ deslotPoints: '0' })).startsWith('A deslot gives a car no damage.'));
  ok('no levels: the pills and the sentence say that nothing repairs or ends', dam({ levels: [] }).pills.map(p => p.text).join('|') === 'No levels|3 incidents|Car failures off' && flat(dam({ levels: [] })).includes('There are no levels yet, so no stop in the pits repairs or ends anything.') && !flat(dam({ levels: [] })).includes('The repair and the other work'));
  ok('one level is told once; a level that retires or disqualifies says so', flat(dam({ levels: [{ name: 'Crash', from: '4', seconds: '0', action: 'dq' }] })).includes('From 4 points, Crash disqualifies the car. The repair') === false && flat(dam({ levels: [{ name: 'Crash', from: '4', seconds: '0', action: 'dq' }] })).includes('From 4 points, Crash disqualifies the car.') && dam({ levels: [{ name: 'Crash', from: '4', action: 'retire' }] }).pills[0].text === 'Retires from 4 points');
  ok('a repair that takes no time: "must stop on the sensor"', flat(dam({ levels: [{ name: 'Tiny', from: '2', seconds: '0', action: 'repair' }] })).includes('From 2 points the car needs a Tiny repair: it must stop on the sensor in the pits.'));
  ok('a level without a name is called Level 1, as the race does', flat(dam({ levels: [{ name: '', from: '2', seconds: '5', action: 'repair' }] })).includes('a Level 1 repair'));
  ok('levels are told in order of damage points, and a row without points or name is left out', flat(dam({ levels: [{ name: 'B', from: '8', seconds: '9', action: 'repair' }, { name: 'A', from: '2', seconds: '3', action: 'repair' }, { name: '', from: '', seconds: '1' }] })).includes('From 2 points the car needs a A repair') && flat(dam({ levels: [{ name: 'B', from: '8', seconds: '9', action: 'repair' }, { name: 'A', from: '2', seconds: '3', action: 'repair' }] })).includes('At 8 points, B needs a repair of 9 seconds.'));
  const on = dam({ failuresOn: 'on', failFrom: '20', failTo: '60', failMax: '2' });
  ok('car failures on: how many, at most how many for a car, between which moments', flat(on).endsWith('Car failures are on: 4 failures can strike a car, at most 2 in a race, somewhere between 20% and 60% of it.') && on.pills[3].text === '4 car failures');
  ok('...on without any failure listed', flat(dam({ failuresOn: 'on', failures: [] })).endsWith('Car failures are on, but no failures are listed yet.') && dam({ failuresOn: 'on', failures: [] }).pills[3].text === 'Car failures on');
  ok('no incidents: the pill says so', dam({ incidents: [] }).pills[2].text === 'No incidents');
}
{
  const r = damRail({});
  ok('the rail (as in the design): Basics the stop and the deslot, Levels, Incidents, Car failures, Penalty points', r.basics.rail === 'At the same time · deslot 1 point' && r.levels.rail === '4 levels from 3 points' && r.incidents.rail === 'Deslot · Contact · Hard crash' && r.failures.rail === 'Off' && r.fines.rail === 'Late 1 · too early 1');
  ok('...the dots as they start: filled in, then four open rings', r.basics.state === 'ok' && ['levels', 'incidents', 'failures', 'fines'].every(k => r[k].state === 'plain'));
  ok('...the closed sections say a little more', r.levels.row === '4 levels, from 3 points up to 10 points' && r.incidents.row === '3 incidents: Deslot, Contact and Hard crash' && r.failures.row === 'Off. Failures that strike a car at random during a race' && r.fines.row.startsWith('1 point for every lap after the deadline of a level, 1 point for leaving'));
  ok('...a level that is changed turns the dot green, and so do an incident, the failures and the fines', damRail({ levels: DF.levels.slice(0, 2) }).levels.state === 'ok' && damRail({ incidents: [{ name: 'Roll', points: 5 }] }).incidents.state === 'ok' && damRail({ failuresOn: 'on' }).failures.state === 'ok' && damRail({ latePoints: '2' }).fines.state === 'ok' && damRail({ earlyPoints: '0' }).fines.state === 'ok');
  ok('...a name that is missing makes Basics amber', damRail({ name: '' }).basics.state === 'todo');
  ok('...no levels, no incidents', damRail({ levels: [] }).levels.rail === 'No levels' && damRail({ incidents: [] }).incidents.rail === 'None' && damRail({ incidents: [] }).incidents.state === 'plain');
  ok('...many incidents: three names and the rest as a number', damRail({ incidents: ['a', 'b', 'c', 'd', 'e'].map(n => ({ name: n, points: 1 })) }).incidents.rail === 'a · b · c · +2');
  ok('...car failures on: how many, and in the closed section when and how many for a car', damRail({ failuresOn: 'on' }).failures.rail === 'On · 4 failures' && damRail({ failuresOn: 'on' }).failures.row === 'On: 4 failures, between 10% and 90% of the race, at most 1 for a car');
  ok('...the stop one after the other, and no damage for a deslot', damRail({ stop: 'add', deslotPoints: '0' }).basics.rail === 'One after the other · no damage for a deslot');
}
{
  const s = dam({}).strip;
  ok('the bar of the levels: a part for the stretch before the first level and one for every level, from 0 to a little past the last', s.parts.map(p => p.name).join('|') === 'No stop|Light damage|Medium damage|Heavy damage|Critical damage' && s.parts[0].left === 0 && s.parts[0].width === 25 && Math.abs(s.parts.reduce((n, p) => n + p.width, 0) - 100) < 0.2);
  ok('...each part starts where the one before ends', s.parts.every((p, i) => i === 0 || Math.abs(p.left - (s.parts[i - 1].left + s.parts[i - 1].width)) < 0.05));
  ok('...the parts know what their level does, for the colour', s.parts.map(p => p.kind).join() === 'none,repair,repair,repair,retire');
  ok('...the numbers under it: the last says what they are, and one that would sit on another is left out', s.ticks[s.ticks.length - 1].label === '10 damage points' && s.ticks[s.ticks.length - 1].show && s.ticks.filter(t => t.show).length < s.ticks.length && s.ticks[0].show);
  ok('...a text for a screen reader says every level', s.text === 'Damage levels from 0 to 10 damage points: No stop from 0, Light damage from 3, Medium damage from 6, Heavy damage from 9, Critical damage from 10.');
  ok('...no levels, no bar', dam({ levels: [] }).strip === null && pen({}).strip === null);
  const one = dam({ levels: [{ name: 'Only', from: '1', seconds: '5' }] }).strip;
  ok('...one level at 1 point is still a bar', one.parts.length === 2 && one.parts[1].left > 0 && one.parts[1].width > 0);
}

{ // the tables are read as the form saves them: an incident gives at least 1 damage point, a row without a name does not count
  ok('an incident gives at least one damage point, whole points only (0, a minus, a word and 2.7 are read as the form saves them: 1, 1, 1 and 2), and a row without a name is not one', W.incidentsOf([{ name: 'a', points: 0 }, { name: 'b', points: -2 }, { name: 'c', points: 'x' }, { name: 'd', points: 2.7 }, { name: ' ', points: 5 }]).map(x => x.points).join() === '1,1,1,2');
}
console.log('-- all values, also wrong ones');
{
  const junk = [undefined, null, '', ' ', 'x', '-5', '1e9', '0', 0, NaN, {}, [], '3,5'];
  let bad = 0;
  const check = d => { const all = d.say.map(p => p.t).join('') + d.pills.map(p => p.text).join('') + Object.values(d.notes).map(n => n.parts.map(p => p.t).join('')).join(''); if (/undefined|NaN|\[object|Infinity|null/.test(all) || !d.say.length || d.pills.some(p => !p.text)) bad++; };
  const checkRail = r => { Object.values(r).forEach(x => { if (/undefined|NaN|\[object|Infinity|null/.test(x.rail + x.row) || !x.rail || !['ok', 'todo', 'plain'].includes(x.state)) bad++; }); };
  for (const a of junk) for (const b of junk) {
    const pv = { name: a, timeRule: b, everyPoints: a, everySeconds: b, steps: a, dqPoints: b, fuelPoints: a, types: [{ name: a, kind: b, seconds: a, cost: b }, null, 5] };
    check(W.describe('penaltysystems', pv)); checkRail(W.rail('penaltysystems', pv, {}));
    const dv = { name: a, stop: b, deslotPoints: a, latePoints: b, earlyPoints: a, failuresOn: b, failFrom: a, failTo: b, failMax: a, levels: [{ name: a, from: b, seconds: a, urgency: b, within: a, action: b }, null, 5], incidents: [{ name: a, points: b }, null], failures: [{ name: a, level: b, chance: a, seconds: b }, 7] };
    check(W.describe('damagesystems', dv)); checkRail(W.rail('damagesystems', dv, {}));
  }
  ok('169 combinations of empty and wrong values for both systems: no "undefined", "NaN" or "null" in any word, a sentence and a note for every section', bad === 0);
  ok('nothing at all (no values, no context) still gives words', W.describe('penaltysystems').say.length > 0 && W.describe('damagesystems', null).say.length > 0 && Object.keys(W.rail('damagesystems')).length === 5 && Object.keys(W.rail('penaltysystems', null, null)).length === 3);
  ok('the words of the values are not changed by asking (the lists are only read)', (() => { const v = JSON.parse(JSON.stringify(D0)), before = JSON.stringify(v); W.describe('damagesystems', v); W.rail('damagesystems', v, {}); return JSON.stringify(v) === before; })());
  ok('other systems have no words here yet (their forms come later): has() says so, describe gives nothing to show', !W.has('fuelrules') && !W.has('constructor') && !W.has('__proto__') && W.has('penaltysystems') && W.has('damagesystems') && W.describe('fuelrules', {}).say.length === 0 && Object.keys(W.rail('fuelrules', {})).length === 0);
}

console.log(fails ? fails + ' SYSTEM WORDS TESTS FAILED' : 'ALL SYSTEM WORDS TESTS PASSED'); process.exit(fails ? 1 : 0);
