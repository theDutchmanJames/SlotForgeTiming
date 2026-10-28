// 1.77.0: the words of the rotation setup editor (renderer/rotationwords.js): the pills, the sentence "In plain words", the status and the notes and dots of the rail.
// Pure functions of the rotation as the editor holds it, so they are tested here without a screen.
const W = require('../renderer/rotationwords.js'), Rot = require('../renderer/rotation.js');
let fails = 0; const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const text = parts => parts.map(p => p.t).join('');
const bold = parts => parts.filter(p => p.b).map(p => p.t);
const grid = rows => rows.map((places, i) => ({ label: '', locked: false, places: places.map((p, lane) => ({ p, lane })) }));
// the rotation of the design board: 8 participants on 4 lanes, 6 heats of 4, everybody races 3 heats, heat 1 is locked, P7 and P8 race one lane twice
const board = (o = {}) => {
  const heats = grid([[0, 1, 2, 3], [4, 5, 6, 7], [1, 0, 5, 4], [2, 3, 6, 7], [3, 2, 7, 6], [5, 4, 1, 0]]); heats[0].locked = true;
  return Rot.clean({ name: 'Thursday club night', participants: 8, lanes: 4, names: ['Jan', 'Eva', 'Tom', 'Sara'], groups: [{ name: 'Juniors', members: [4, 5, 6, 7] }], heats, ...o }, true);
};
const rec = (heats, o = {}) => Rot.clean({ name: 'R', participants: 8, lanes: 4, heats: grid(heats), ...o }, true);

// ---- the design board ----
{ const d = W.describe(board());
  ok('the pills: the size (the first one stands out), the lanes, the heats, and how often everybody races', JSON.stringify(d.pills) === JSON.stringify([{ text: '8 drivers', tone: 'hi' }, { text: '4 lanes', tone: '' }, { text: '6 heats', tone: '' }, { text: '3 heats each', tone: '' }]));
  ok('the sentence reads the rotation back: the size, how often everybody races, the lanes, the locked heat and the group', text(d.say) === '8 drivers race in 6 heats on 4 lanes, with up to 4 cars in a heat. Everybody races 3 heats. The lanes are not shared evenly: some race one lane more often than another. Heat 1 is locked, so a shuffle leaves it where it is. Juniors (P5, P6, P7 and P8) can be put in a heat in one go.');
  ok('...the numbers and the names in it are bold, the rest is not', JSON.stringify(bold(d.say)) === JSON.stringify(['8 drivers', '6 heats', '4 lanes', '4 cars', '3 heats', 'not shared evenly', 'Heat 1', 'Juniors (P5, P6, P7 and P8)']));
  ok('...a rotation with a name and nothing to look at is ready to use', d.ready.ok === true && d.ready.text === 'Ready to use');
  const r = W.rail(board(), { plan: 'manual', heats: 6 });
  ok('the rail: a note for every section, the same words on the row of a closed section', JSON.stringify(Object.keys(r)) === JSON.stringify(['size', 'plan', 'names', 'heats', 'how', 'groups']) && Object.values(r).every(x => x.row === x.rail));
  ok('...size, the plan, the names, the heats, how often and the groups', r.size.rail === '8 drivers · 4 lanes' && r.plan.rail === 'Shuffled · 6 heats' && r.names.rail === '4 of 8 have a name' && r.heats.rail === '6 heats · 1 locked' && r.how.rail === '3 each · lanes uneven' && r.groups.rail === '1 group');
  ok('...the dots: filled in is green, the plan is an open ring (nothing is asked of it once there are heats)', ['size', 'names', 'heats', 'how', 'groups'].every(k => r[k].state === 'ok') && r.plan.state === 'plain'); }

// ---- a rotation with no heats ----
{ const d = W.describe(rec([])), r = W.rail(rec([]));
  ok('no heats: the pills say so, and there is no "heats each"', d.pills.map(p => p.text).join('|') === '8 drivers|4 lanes|No heats yet');
  ok('...the sentence says so and what to do', text(d.say) === '8 drivers on 4 lanes, and no heats yet. Add a heat, or start from a plan.' && JSON.stringify(bold(d.say)) === JSON.stringify(['8 drivers', '4 lanes', 'no heats']));
  ok('...it is not ready: add a heat', d.ready.ok === false && d.ready.text === 'Add a heat');
  ok('...the plan and the heats ask for a look (amber), there is nothing to count yet, no names, no groups', r.plan.state === 'todo' && r.heats.state === 'todo' && r.heats.rail === 'No heats yet' && r.how.rail === 'Nothing to count yet' && r.how.state === 'plain' && r.names.rail === 'No names' && r.names.state === 'plain' && r.groups.rail === 'No groups' && r.groups.state === 'plain');
  ok('...heats that are all empty are the same as none', W.describe(rec([[], []])).ready.text === 'Add a heat' && W.describe(rec([[], []])).pills[2].text === 'No heats yet' && text(W.describe(rec([[], []])).say).startsWith('8 drivers on 4 lanes, and no heats yet.')); }

// ---- the status ----
ok('the name comes first: without a name the status asks for one, also when there are no heats or other things to look at', W.describe(board({ name: '' })).ready.text === 'Give it a name' && W.describe(rec([], { name: '  ' })).ready.text === 'Give it a name' && W.describe(rec([[0, 1]], { name: '' })).ready.ok === false);
ok('a warning counts as a thing to look at: one thing, then two', (() => { const a = W.describe(rec([[0, 1, 2, 3], [4, 5, 6]]).heats && rec([[0, 1, 2, 3], [4, 5, 6]])).ready; return a.ok === false && a.text === '1 thing to look at'; })()
  && W.describe(rec([[0, 1, 2, 3], [4, 5, 6], []])).ready.text === '2 things to look at');
ok('a remark that only informs is not a thing to look at (heats of different sizes, uneven counts)', W.describe(rec([[0, 1, 2, 3], [4, 5, 6, 7], [0, 1]], { participants: 8 })).ready.ok === true);

// ---- who does not race ----
{ const d = W.describe(rec([[0, 1, 2, 3], [4, 5, 6, 0]])), t = text(d.say);
  ok('one participant without a heat is named, and "everybody races" is not said', t.includes(' P8 races no heat.') && !t.includes('Everybody races') && JSON.stringify(bold(d.say)).includes('"P8"'));
  ok('...two are named together, three are listed, and more than three are counted', text(W.describe(rec([[0, 1, 2, 3], [4, 5]])).say).includes(' P7 and P8 race no heat.') && text(W.describe(rec([[0, 1, 2, 3], [4]])).say).includes(' P6, P7 and P8 race no heat.')
    && text(W.describe(rec([[0, 1, 2, 3]])).say).includes(' P5, P6, P7 and 1 more race no heat.'));
  ok('...there is no "heats each" pill while somebody races none, and the status asks for a look', d.pills.map(p => p.text).join('|') === '8 drivers|4 lanes|2 heats' && d.ready.text === '1 thing to look at');
  ok('...the heats ask for a look in the rail, and how often everybody races counts from 0', W.rail(rec([[0, 1, 2, 3], [4, 5, 6, 0]])).heats.state === 'todo' && W.rail(rec([[0, 1, 2, 3], [4, 5, 6, 0]])).how.rail === '0 to 2 · lanes even'); }

// ---- different numbers of heats ----
{ const d = W.describe(rec([[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 2, 3]]));
  ok('when the participants race a different number of heats the sentence gives the range, and the pill too', text(d.say).includes(' The participants race 1 to 2 heats. ') && !text(d.say).includes('Everybody') && d.pills[3].text === '1 to 2 heats each');
  ok('...in the rail it is "1 to 2"', W.rail(rec([[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 2, 3]])).how.rail.startsWith('1 to 2'));
  const one = W.describe(rec([[0, 1, 2, 3], [4, 5, 6, 7]]));
  ok('everybody racing once says "1 heat" (not "1 heats")', text(one.say).includes('Everybody races 1 heat.') && one.pills[3].text === '1 heat each' && W.rail(rec([[0, 1, 2, 3], [4, 5, 6, 7]])).how.rail.startsWith('1 each'));
  ok('one heat is "1 heat" in the sentence, the pill and the rail', text(W.describe(rec([[0, 1, 2, 3]], { participants: 4 })).say).includes('race in 1 heat on 4 lanes') && W.describe(rec([[0, 1, 2, 3]], { participants: 4 })).pills[2].text === '1 heat' && W.rail(rec([[0, 1, 2, 3]], { participants: 4 })).heats.rail === '1 heat'); }

// ---- the cars in a heat ----
ok('the largest heat sets the cars: "up to 3 cars", and "up to 1 car" for a heat of one', text(W.describe(rec([[0, 1, 2], [3, 4], [5, 6, 7]])).say).includes('with up to 3 cars in a heat.') && text(W.describe(rec([[0]], { participants: 2 })).say).includes('with up to 1 car in a heat.'));

// ---- empty heats ----
{ const one = text(W.describe(rec([[0, 1, 2, 3], [], [4, 5, 6, 7]])).say), two = text(W.describe(rec([[], [0, 1, 2, 3], [], [4, 5, 6, 7]])).say), many = text(W.describe(rec([[], [], [], [0, 1, 2, 3], [4, 5, 6, 7]])).say);
  ok('an empty heat is told and is not counted: "Heat 2 is empty and is left out of the race."', one.includes('race in 2 heats on') && one.includes('Heat 2 is empty and is left out of the race.'));
  ok('...two: "Heats 1 and 3 are empty and are left out of the race."', two.includes('Heats 1 and 3 are empty and are left out of the race.'));
  ok('...three are listed with commas', many.includes('Heats 1, 2 and 3 are empty and are left out of the race.'));
  ok('...it asks for a look in the status and in the rail', W.describe(rec([[0, 1, 2, 3], [], [4, 5, 6, 7]])).ready.text === '1 thing to look at' && W.rail(rec([[0, 1, 2, 3], [], [4, 5, 6, 7]])).heats.state === 'todo' && W.rail(rec([[0, 1, 2, 3], [], [4, 5, 6, 7]])).heats.rail === '2 heats'); }

// ---- the lanes ----
ok('on one lane there is nothing to say about the lanes, and "1 lane" is singular', (() => { const d = rec([[0], [1], [0], [1]], { participants: 2, lanes: 1 }); return !text(W.describe(d).say).includes('lanes are') && W.describe(d).pills[1].text === '1 lane' && W.rail(d).size.rail === '2 drivers · 1 lane' && W.rail(d).how.rail === '2 each'; })());
ok('when everybody races once the lanes cannot be uneven, and nothing is said about them', !text(W.describe(rec([[0, 1, 2, 3], [4, 5, 6, 7]])).say).includes('lanes are') && !W.rail(rec([[0, 1, 2, 3], [4, 5, 6, 7]])).how.rail.includes('lanes'));
ok('lanes that are shared evenly say so, and the rail says "lanes even"', (() => { const d = rec([[0, 1, 2, 3], [1, 2, 3, 0], [2, 3, 0, 1], [3, 0, 1, 2]], { participants: 4 }); return text(W.describe(d).say).includes('The lanes are shared evenly.') && JSON.stringify(bold(W.describe(d).say)).includes('"shared evenly"') && W.rail(d).how.rail === '4 each · lanes even'; })());
ok('a difference of one lane is still even; two is not', (() => { const a = rec([[0, 1], [0, 1], [1, 0]], { participants: 2, lanes: 2 }), b = rec([[0, 1], [0, 1], [0, 1]], { participants: 2, lanes: 2 }); return W.rail(a).how.rail.endsWith('lanes even') && W.rail(b).how.rail.endsWith('lanes uneven'); })());

// ---- locked heats ----
{ const h = rec([[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 2, 3], [4, 5, 6, 7]]); h.heats[0].locked = true; h.heats[2].locked = true;
  ok('two locked heats: "Heats 1 and 3 are locked, so a shuffle leaves them where they are."', text(W.describe(h).say).includes('Heats 1 and 3 are locked, so a shuffle leaves them where they are.') && W.rail(h).heats.rail === '4 heats · 2 locked');
  h.heats[3].locked = true; ok('three: "Heats 1, 3 and 4"', text(W.describe(h).say).includes('Heats 1, 3 and 4 are locked'));
  ok('nothing locked: nothing is said, and the rail has no "locked"', !text(W.describe(rec([[0, 1, 2, 3]])).say).includes('locked') && !W.rail(rec([[0, 1, 2, 3]])).heats.rail.includes('locked')); }

// ---- teams ----
{ const d = rec([[0, 1, 2, 3], [4, 5, 6, 7]], { participantsAre: 'teams' });
  ok('teams are called teams: in the pill, the sentence and the rail', W.describe(d).pills[0].text === '8 teams' && text(W.describe(d).say).startsWith('8 teams race in 2 heats') && W.rail(d).size.rail === '8 teams · 4 lanes' && W.describe(rec([], { participantsAre: 'teams' })).say[0].t === '8 teams');
  ok('...a team without a name is T1, T2...', W.describe(rec([[0, 1, 2, 3]], { participantsAre: 'teams', participants: 8 })).say.some(p => p.t.includes('T5')) && text(W.describe(rec([[0, 1, 2, 3]], { participantsAre: 'teams' })).say).includes('T5, T6, T7 and 1 more race no heat')); }

// ---- groups ----
ok('a group without a name is "Group 2" (the second), a group without members is "nobody yet", two groups are told together', (() => {
  const d = rec([[0, 1, 2, 3]], { names: ['Jan', 'Eva'], groups: [{ name: 'Pros', members: [0, 1] }, { name: '', members: [] }] });
  return text(W.describe(d).say).endsWith('Groups Pros (Jan and Eva) and Group 2 (nobody yet) can be put in a heat in one go.') && W.rail(d).groups.rail === '2 groups'; })());
ok('the sentence tells a difference of one lane from a difference of two, as the rail does', (() => { const a = rec([[0, 1], [0, 1], [1, 0]], { participants: 2, lanes: 2 }), b = rec([[0, 1], [0, 1], [0, 1]], { participants: 2, lanes: 2 }); return text(W.describe(a).say).includes('The lanes are shared evenly.') && text(W.describe(b).say).includes('The lanes are not shared evenly: some race one lane more often than another.'); })());
ok('a group whose name is only spaces is told by its number, as one without a name (the editor holds what is typed, not what is saved)', (() => { const d = { ...rec([[0, 1, 2, 3]], { names: ['Jan'] }), groups: [{ name: '   ', members: [0] }] }; return text(W.describe(d).say).endsWith('Group 1 (Jan) can be put in a heat in one go.'); })());
ok('a rotation with nobody in it (the number box is empty for a moment) says no heats and has no "each" pill', (() => { const d = W.describe({ name: 'R', participants: 0, lanes: 2, names: [], groups: [], heats: [] }); return d.pills.map(x => x.text).join('|') === '0 drivers|2 lanes|No heats yet' && d.ready.text === 'Add a heat'; })());
ok('one group with one member: "Pros (Jan) can be put in a heat in one go."; five members are listed with "and 1 more"', text(W.describe(rec([[0, 1, 2, 3]], { names: ['Jan'], groups: [{ name: 'Pros', members: [0] }] })).say).endsWith('Pros (Jan) can be put in a heat in one go.')
  && text(W.describe(rec([[0, 1, 2, 3]], { groups: [{ name: 'Kids', members: [0, 1, 2, 3, 4] }] })).say).includes('Kids (P1, P2, P3, P4 and 1 more)'));
ok('no groups: nothing is said about groups', !text(W.describe(rec([[0, 1, 2, 3]])).say).includes('group'));

// ---- names ----
{ const d = rec([[0, 1, 2, 3], [4, 5, 6, 7]], { names: ['Jan', '  ', '', 'Sam'] }), r = W.rail(d);
  ok('only names with letters count: "2 of 8 have a name"', r.names.rail === '2 of 8 have a name' && r.names.state === 'ok');
  ok('a name used twice (capitals and spaces do not matter) asks for a look, in the rail and in the status', (() => { const x = rec([[0, 1, 2, 3], [4, 5, 6, 7]], { names: ['Jan', ' jan'] }); return W.rail(x).names.state === 'todo' && W.rail(x).names.rail === '2 of 8 have a name' && W.describe(x).ready.text === '1 thing to look at'; })());
  ok('a name that belongs to a participant that is no longer there does not count', W.rail(rec([[0, 1]], { participants: 2, names: ['A', 'B'] })).names.rail === '2 of 2 have a name' && W.rail(Object.assign(rec([[0, 1]], { participants: 2, names: ['A', 'B'] }), { names: ['A', 'B', 'C', 'D'] })).names.rail === '2 of 2 have a name');
  ok('a rotation that has no names says "No names", and its dot is an open ring', W.rail(rec([[0, 1, 2, 3]])).names.rail === 'No names' && W.rail(rec([[0, 1, 2, 3]])).names.state === 'plain'); }

// ---- the plan to start from ----
{ const r = ctx => W.rail(board(), ctx).plan.rail;
  ok('the plan note names the plan: shuffled with its heats, same number each with the heats for everybody, the other two by name', r({ plan: 'manual', heats: 5 }) === 'Shuffled · 5 heats' && r({ plan: 'perdriver', each: 2 }) === 'Same number each · 2 heats' && r({ plan: 'roundrobin', heats: 9, each: 3 }) === 'Round robin' && r({ plan: 'rotation', heats: 9 }) === 'Lane rotation');
  ok('...one heat is "1 heat", and a number that is not a number is left out', r({ plan: 'manual', heats: 1 }) === 'Shuffled · 1 heat' && r({ plan: 'perdriver', each: 1 }) === 'Same number each · 1 heat' && r({ plan: 'manual', heats: 'x' }) === 'Shuffled' && r({ plan: 'perdriver', each: 0 }) === 'Same number each' && r({ plan: 'manual', heats: '4' }) === 'Shuffled · 4 heats' && r({ plan: 'manual', heats: 4.7 }) === 'Shuffled · 4 heats');
  ok('...no choice, or an unknown one, is the shuffled plan', r() === 'Shuffled' && r({}) === 'Shuffled' && r({ plan: 'nope', heats: 3 }) === 'Shuffled · 3 heats');
  ok('...with heats the dot is an open ring, without heats it is amber', W.rail(board()).plan.state === 'plain' && W.rail(rec([])).plan.state === 'todo'); }

// ---- the rail: the heats and how often ----
ok('a heat with one car only is a thing to look at (amber), a heat with fewer cars than lanes is not', W.rail(rec([[0, 1, 2, 3], [4]], { participants: 5 })).heats.state === 'todo' && W.rail(rec([[0, 1, 2, 3], [4, 5]], { participants: 6 })).heats.state === 'ok');
ok('the pills never leave out the size: a rotation with 2 participants on 1 lane', W.describe(rec([[0], [1]], { participants: 2, lanes: 1 })).pills.map(p => p.text).join('|') === '2 drivers|1 lane|2 heats|1 heat each');
ok('the module does not change the rotation it is given', (() => { const d = board(), before = JSON.stringify(d); W.describe(d); W.rail(d, { plan: 'manual', heats: 3 }); return JSON.stringify(d) === before; })());

// ---- joinAnd ----
ok('joinAnd: none, one, two, three, four, and a long list that ends with "and N more"', W.joinAnd([]) === '' && W.joinAnd(['a']) === 'a' && W.joinAnd(['a', 'b']) === 'a and b' && W.joinAnd(['a', 'b', 'c']) === 'a, b and c' && W.joinAnd(['a', 'b', 'c', 'd']) === 'a, b, c and d' && W.joinAnd(['a', 'b', 'c', 'd', 'e']) === 'a, b, c, d and 1 more' && W.joinAnd(['a', 'b', 'c', 'd', 'e', 'f'], 2) === 'a, b and 4 more');

if (fails) { console.log(fails + ' ROTATION WORDS TESTS FAILED'); process.exit(1); } else console.log('ALL ROTATION WORDS TESTS PASSED');
