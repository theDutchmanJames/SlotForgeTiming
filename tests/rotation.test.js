// 1.6.0: rotation setups (rotation.js): a heat plan that is made by hand. What a rotation is, how it is changed (places, groups, heats, locks, shuffles),
// what it means for the race (absent participants, the lanes of the track) and what the editor tells you about it.
const R = require('../renderer/rotation.js'), H = require('../renderer/heats.js'), E = require('../renderer/engine.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const grid = rec => rec.heats.map(h => h.places.map(e => e.p + '@' + e.lane).join(' '));
const order = rec => rec.heats.map(h => h.label || h.places.map(e => e.p).join(''));
// a rotation of 8 participants on 4 lanes with 3 heats, written out: heat 1: 0 1 2 3, heat 2: 4 5 6 7, heat 3: 0 2 4 6
const mk = (extra = {}) => R.clean({ name: 'Club night', participants: 8, lanes: 4, heats: [
  { label: 'A', places: [0, 1, 2, 3].map((p, lane) => ({ p, lane })) }, { label: 'B', places: [4, 5, 6, 7].map((p, lane) => ({ p, lane })) }, { label: 'C', places: [0, 2, 4, 6].map((p, lane) => ({ p, lane })) }], ...extra }, true);
const err = r => (r && r.error) || '';

// ---- the proper form ----
{ const c = R.clean({});
  ok('nothing at all becomes a rotation of 8 participants on 4 lanes, no heats, named Rotation', c.participants === 8 && c.lanes === 4 && c.name === 'Rotation' && c.heats.length === 0 && c.groups.length === 0 && c.names.length === 8 && c.names.every(n => n === '') && c.note === '');
  ok('...whatever is not a rotation (nothing, a number, a list, a word) gives the same', [undefined, null, 5, [], 'x'].every(x => same(R.clean(x), c)));
  const lim = R.clean({ participants: 500, lanes: 99 }), low = R.clean({ participants: 0, lanes: 0 }), junk = R.clean({ participants: 'abc', lanes: 'x' });
  ok('the numbers stay within their limits: 2 to 64 participants, 1 to 8 lanes (a number that is no number is the standard)', lim.participants === 64 && lim.lanes === 8 && low.participants === 2 && low.lanes === 1 && junk.participants === 8 && junk.lanes === 4 && R.clean({ participants: 7.9, lanes: 3.9 }).participants === 7 && R.clean({ participants: 7.9, lanes: 3.9 }).lanes === 3);
  ok('the limits are 64 participants, 8 lanes, 200 heats, 20 groups, a name of 40, a label of 30 and a participant name of 30 characters', R.LIMITS.maxP === 64 && R.LIMITS.maxLanes === 8 && R.LIMITS.maxHeats === 200 && R.LIMITS.maxGroups === 20 && R.LIMITS.name === 40 && R.LIMITS.label === 30 && R.LIMITS.person === 30 && R.LIMITS.minP === 2);
  const texts = R.clean({ name: ' '.repeat(3) + 'x'.repeat(60), note: 'n'.repeat(300), participants: 3, names: [' Piet ', 'y'.repeat(50), null], heats: [{ label: ' l'.repeat(40), places: [] }], groups: [{ name: 'g'.repeat(50), members: [] }] });
  ok('texts are trimmed and cut: the name to 40, the note to 200, a heat label and a group name to 30, a participant name to 30; a missing name is empty', texts.name.length === 40 && texts.name[0] === 'x' && texts.note.length === 200 && texts.names[0] === 'Piet' && texts.names[1].length === 30 && texts.names[2] === '' && texts.heats[0].label.length <= 30 && texts.groups[0].name.length === 30);
  ok('a group without a name is "Group 2" (the second), a rotation without a name is "Rotation"; while it is being edited the empty name stays empty and the spaces stay', R.clean({ groups: [{}, {}] }).groups[1].name === 'Group 2' && R.clean({ name: '' }).name === 'Rotation' && R.clean({ name: '', groups: [{}] }, true).name === '' && R.clean({ name: '', groups: [{}] }, true).groups[0].name === '' && R.clean({ name: 'a b ' }, true).name === 'a b ' && R.clean({ name: 'a b ' }).name === 'a b');
  const bad = R.clean({ participants: 4, lanes: 3, heats: [{ places: [{ p: 0, lane: 0 }, { p: 0, lane: 1 }, { p: 1, lane: 0 }, { p: 9, lane: 1 }, { p: 1, lane: 5 }, { p: -1, lane: 2 }, { p: 1.5, lane: 2 }, null, { p: 3, lane: 2 }] }, null, { places: 'x' }] });
  ok('places that do not exist are thrown away: a participant who is not there, a lane that is not there, a participant twice in a heat (the first counts), a lane twice (the first counts)', same(bad.heats[0].places, [{ p: 0, lane: 0 }, { p: 3, lane: 2 }]) && bad.heats.length === 3 && bad.heats[1].places.length === 0 && bad.heats[2].places.length === 0);
  ok('the places of a heat are in the order of the lanes, and "locked" is only true when it is true', same(R.clean({ heats: [{ places: [{ p: 3, lane: 2 }, { p: 1, lane: 0 }, { p: 2, lane: 1 }], locked: true }, { locked: 1 }, { locked: 'yes' }, {}] }).heats.map(h => [h.places.map(e => e.lane), h.locked]), [[[0, 1, 2], true], [[], false], [[], false], [[], false]]));
  const many = R.clean({ heats: Array.from({ length: 250 }, () => ({})), groups: Array.from({ length: 30 }, () => ({})) });
  ok('at most 200 heats and 20 groups are kept', many.heats.length === 200 && many.groups.length === 20);
  const grp = R.clean({ participants: 5, groups: [{ name: 'Pros', members: [4, 1, 1, 9, -1, 2.5, 'x', 0] }] });
  ok('the members of a group are participants who exist, once each, in the order of their numbers', same(grp.groups[0].members, [0, 1, 4]));
  const again = R.clean(mk()); ok('cleaning a clean rotation changes nothing', same(again, mk()));
  const src = { participants: 3, heats: [{ places: [{ p: 0, lane: 0 }] }] }, keep = JSON.stringify(src); R.clean(src); ok('the rotation that is cleaned is not touched', JSON.stringify(src) === keep); }

// ---- names ----
{ const r = mk({ names: ['Piet', '', 'Kees'] });
  ok('a participant is shown by name, or as "Participant 2" (short: "P2") when it has no name', R.nameOf(r, 0) === 'Piet' && R.nameOf(r, 1) === 'Participant 2' && R.shortOf(r, 0) === 'Piet' && R.shortOf(r, 1) === 'P2' && R.shortOf(r, 7) === 'P8' && R.nameOf(r, 7) === 'Participant 8');
  const ch = R.setName(r, 1, '  Jan'); ok('a name is set (the spaces stay while typing; cleaning for the save trims them)', ch.rec.names[1] === '  Jan' && R.clean(ch.rec).names[1] === 'Jan' && r.names[1] === '');
  ok('a name for a participant that does not exist is refused', err(R.setName(r, 8, 'x')) !== '' && err(R.setName(r, -1, 'x')) !== '' && err(R.setName(r, 1.5, 'x')) !== '');
  ok('a name that is nothing becomes empty', R.setName(r, 0, null).rec.names[0] === '' && R.setName(r, 0, undefined).rec.names[0] === ''); }

// ---- a new rotation ----
{ const b = R.blank(20, 4, 'Club');
  ok('a new rotation lets everybody race once: 20 participants on 4 lanes is 5 heats of 4, in the order of the numbers, lane 1 first', b.name === 'Club' && b.participants === 20 && b.lanes === 4 && b.heats.length === 5 && b.heats.every(h => h.places.length === 4) && b.heats[0].places.map(e => e.p).join() === '0,1,2,3' && b.heats[4].places.map(e => e.p).join() === '16,17,18,19' && b.heats[1].places.map(e => e.lane).join() === '0,1,2,3');
  const odd = R.blank(9, 4); ok('...the heats are as even as can be: 9 participants on 4 lanes are 3 heats of 3, not 4 + 4 + 1', odd.heats.map(h => h.places.length).join() === '3,3,3' && odd.name === 'New rotation');
  ok('...10 on 4 lanes are 4, 3, 3; 3 on 4 lanes are one heat of 3; 2 on 1 lane are 2 heats of 1', R.blank(10, 4).heats.map(h => h.places.length).join() === '4,3,3' && R.blank(3, 4).heats.map(h => h.places.length).join() === '3' && R.blank(2, 1).heats.map(h => h.places.length).join() === '1,1');
  ok('...the numbers are kept within the limits, and every participant is in exactly one heat', R.blank(500, 99).participants === 64 && R.blank(500, 99).lanes === 8 && new Set(R.blank(64, 8).heats.flatMap(h => h.places.map(e => e.p))).size === 64 && R.blank(1, 4).participants === 2); }

// ---- starting from a plan ----
{ const base = mk({ names: ['Piet'], groups: [{ name: 'Pros', members: [0, 1] }] });
  const plans = { manual: { plan: 'manual', heats: 4 }, perdriver: { plan: 'perdriver', each: 3 }, roundrobin: { plan: 'roundrobin' }, rotation: { plan: 'rotation' } };
  for (const [k, o] of Object.entries(plans)) {
    const g = R.generate(base, o, 11), sch = g.rec.heats.map(h => h.places);
    ok(`the plan "${k}" fills the rotation with heats that fit (every heat has cars, no participant or lane twice), and the names and groups stay`, !g.error && sch.length > 0 && H.fits(sch, 8, 4) && g.rec.names[0] === 'Piet' && g.rec.groups[0].name === 'Pros' && g.rec.name === 'Club night' && g.rec.heats.every(h => h.label === '' && h.locked === false));
  }
  ok('...a number of heats that you choose is that number of heats; 3 heats each is 6 heats for 8 participants on 4 lanes; lane rotation is one heat per participant', R.generate(base, plans.manual, 1).rec.heats.length === 4 && R.generate(base, plans.perdriver, 1).rec.heats.length === 6 && R.generate(base, plans.rotation, 1).rec.heats.length === 8);
  ok('...the same seed gives the same heats, another seed other heats', same(R.generate(base, plans.manual, 5).rec.heats, R.generate(base, plans.manual, 5).rec.heats) && !same(R.generate(base, plans.manual, 5).rec.heats, R.generate(base, plans.manual, 6).rec.heats));
  ok('...without a seed it still works, and an unknown plan is the plan "manual"', R.generate(base, plans.manual).rec.heats.length === 4 && R.generate(base, { plan: 'nonsense', heats: 2 }, 1).rec.heats.length === 2 && R.generate(base, undefined, 1).rec.heats.length === 3);
  ok('...the same number of heats for everyone in a round robin is passed on', R.generate(R.clean({ participants: 7, lanes: 4 }), { plan: 'roundrobin', even: true }, 3).rec.heats.length >= R.generate(R.clean({ participants: 7, lanes: 4 }), { plan: 'roundrobin', even: false }, 3).rec.heats.length);
  const locked = mk(); locked.heats[0].locked = true; ok('it replaces all heats, also a locked one', R.generate(locked, plans.manual, 2).rec.heats.every(h => !h.locked));
  const huge = R.clean({ participants: 64, lanes: 2 }); ok('more than 200 heats is refused, in words, and nothing is made', err(R.generate(huge, { plan: 'perdriver', each: 10 }, 1)) === 'That makes 320 heats. The most is 200.');
  ok('the rotation that is started from is not touched', grid(base).join('|') === grid(mk()).join('|')); }

// ---- the size changes ----
{ const r = mk();
  const same2 = R.resize(r, 8, 4); ok('the same size changes nothing and drops nothing', same2.dropped === 0 && same(same2.rec.heats, r.heats));
  const less = R.resize(r, 6, 4); ok('fewer participants take away their places (participants 7 and 8 have 3 places) and say how many went', less.dropped === 3 && less.rec.participants === 6 && less.rec.names.length === 6 && !less.rec.heats.some(h => h.places.some(e => e.p >= 6)));
  const fewerLanes = R.resize(r, 8, 2); ok('fewer lanes take away the places in the lanes that go (2 in each of the 3 heats), and only the first 2 lanes stay', fewerLanes.dropped === 6 && fewerLanes.rec.lanes === 2 && fewerLanes.rec.heats.every(h => h.places.length === 2));
  const more = R.resize(mk({ names: ['Piet'] }), 10, 6); ok('more participants and lanes take nothing away, and the names stay', more.dropped === 0 && more.rec.names.length === 10 && more.rec.names[0] === 'Piet' && more.rec.lanes === 6 && more.rec.participants === 10);
  ok('the numbers are kept within the limits here too', R.resize(r, 1, 0).rec.participants === 2 && R.resize(r, 1, 0).rec.lanes === 1 && R.resize(r, 99, 99).rec.participants === 64);
  const g = mk({ groups: [{ name: 'G', members: [0, 7] }] }); ok('a group loses the participants that go', same(R.resize(g, 5, 4).rec.groups[0].members, [0])); }

// ---- places ----
{ const r = mk();
  const p1 = R.place(r, 1, 1, 0); ok('a participant is put in a place; the one who was there leaves the heat, and the participant is taken out of the lane he was in (heat 2: 0 5 → lane 1, 4 6 7)', same(p1.rec.heats[1].places, [{ p: 4, lane: 0 }, { p: 0, lane: 1 }, { p: 6, lane: 2 }, { p: 7, lane: 3 }]) && same(r.heats[1].places.map(e => e.p), [4, 5, 6, 7]));
  const mv = R.place(r, 0, 3, 0); ok('...a participant who is already in the heat moves: the old lane is empty', same(mv.rec.heats[0].places, [{ p: 1, lane: 1 }, { p: 2, lane: 2 }, { p: 0, lane: 3 }]));
  ok('...into an empty place', same(R.place(R.addHeat(r).rec, 3, 2, 5).rec.heats[3].places, [{ p: 5, lane: 2 }]));
  const e = R.place(r, 0, 2, null); ok('null empties a place', same(e.rec.heats[0].places.map(x => x.p), [0, 1, 3]) && R.place(r, 0, 3, null).rec.heats[0].places.length === 3);
  ok('an empty place that is emptied again is no problem', same(R.place(R.addHeat(r).rec, 3, 0, null).rec.heats[3].places, []));
  ok('a heat or lane that is not there, and a participant who is not there, are refused with a sentence', /not in the rotation/.test(err(R.place(r, 5, 0, 1))) && /not in the rotation/.test(err(R.place(r, -1, 0, 1))) && /not in the rotation/.test(err(R.place(r, 0, 4, 1))) && /not in the rotation/.test(err(R.place(r, 0, -1, 1))) && /not in the rotation/.test(err(R.place(r, 0.5, 1, 1))) && /does not exist/.test(err(R.place(r, 0, 0, 8))) && /does not exist/.test(err(R.place(r, 0, 0, -1))) && /does not exist/.test(err(R.place(r, 0, 0, 1.5))) && /does not exist/.test(err(R.place(r, 0, 0, undefined))));
  const lk = R.setLocked(r, 0, true).rec;
  ok('a locked heat cannot be changed by hand ("Heat 1 is locked...")', err(R.place(lk, 0, 0, 5)) === 'Heat 1 is locked. Unlock it first to change it.' && err(R.place(lk, 0, 0, null)) !== '' && err(R.swap(lk, { heat: 0, lane: 0 }, { heat: 1, lane: 0 })) !== '' && err(R.swap(lk, { heat: 1, lane: 0 }, { heat: 0, lane: 0 })) === 'Heat 1 is locked. Unlock it first to change it.' && /locked/.test(err(R.assignGroup(R.addGroup(lk).rec, 0, 0))));
  ok('...but the other heats can', !R.place(lk, 1, 0, 0).error); }

// ---- swapping two places ----
{ const r = mk();
  const s = R.swap(r, { heat: 0, lane: 0 }, { heat: 1, lane: 3 }); ok('two places swap, also in different heats', same(s.rec.heats[0].places.map(e => e.p), [7, 1, 2, 3]) && same(s.rec.heats[1].places.map(e => e.p), [4, 5, 6, 0]));
  ok('...in the same heat the lanes swap', same(R.swap(r, { heat: 0, lane: 0 }, { heat: 0, lane: 2 }).rec.heats[0].places, [{ p: 2, lane: 0 }, { p: 1, lane: 1 }, { p: 0, lane: 2 }, { p: 3, lane: 3 }]));
  const h = R.addHeat(r).rec; const mvd = R.swap(h, { heat: 0, lane: 1 }, { heat: 3, lane: 0 });
  ok('...a participant moves to an empty place (the place he leaves is empty), in the same heat as well', same(mvd.rec.heats[0].places.map(e => e.p), [0, 2, 3]) && same(mvd.rec.heats[3].places, [{ p: 1, lane: 0 }]) && same(R.swap(R.clean({ participants: 4, lanes: 3, heats: [{ places: [{ p: 0, lane: 0 }] }] }, true), { heat: 0, lane: 0 }, { heat: 0, lane: 2 }).rec.heats[0].places, [{ p: 0, lane: 2 }]));
  ok('...the same place, two empty places, and places that are not there are refused', err(R.swap(r, { heat: 0, lane: 0 }, { heat: 0, lane: 0 })) === 'Those are the same place.' && err(R.swap(h, { heat: 3, lane: 0 }, { heat: 3, lane: 1 })) === 'Both places are empty.' && /not in the rotation/.test(err(R.swap(r, { heat: 0, lane: 0 }, { heat: 9, lane: 0 }))) && /not in the rotation/.test(err(R.swap(r, { heat: 0, lane: 9 }, { heat: 1, lane: 0 }))) && /not in the rotation/.test(err(R.swap(r, null, { heat: 1, lane: 0 }))) && /not in the rotation/.test(err(R.swap(r, { heat: 0, lane: 0 }, undefined))));
  const dup = R.swap(r, { heat: 0, lane: 1 }, { heat: 2, lane: 1 }); ok('...a swap that would put a participant in the same heat twice is refused (1 in heat 1 with 2 in heat 3: heat 1 would hold 2 twice)', /same heat twice/.test(err(dup)) && dup.rec === undefined);
  ok('...a refused swap changes nothing', grid(r).join('|') === grid(mk()).join('|')); }

// ---- groups ----
{ let r = mk({ names: ['Piet'] });
  r = R.addGroup(r).rec; r = R.renameGroup(r, 0, 'Pros').rec; for (const p of [5, 1, 3]) r = R.toggleMember(r, 0, p).rec;
  ok('a group is added with a name of its own, renamed, and participants are ticked in it (kept in the order of their numbers)', r.groups.length === 1 && r.groups[0].name === 'Pros' && same(r.groups[0].members, [1, 3, 5]) && R.addGroup(mk()).rec.groups[0].name === 'Group 1' && R.addGroup(R.addGroup(mk()).rec).rec.groups[1].name === 'Group 2');
  ok('...ticking a participant again takes him out; he can be in several groups', same(R.toggleMember(r, 0, 3).rec.groups[0].members, [1, 5]) && same(R.toggleMember(R.addGroup(r).rec, 1, 3).rec.groups[1].members, [3]));
  const a = R.assignGroup(r, 2, 0); ok('a group goes into a whole heat in one go: the members take lane 1, 2, 3 in the order of their numbers and the rest of the heat is emptied', same(a.rec.heats[2].places, [{ p: 1, lane: 0 }, { p: 3, lane: 1 }, { p: 5, lane: 2 }]) && a.rec.heats[2].label === 'C');
  ok('...the other heats are not touched', same(a.rec.heats[0], r.heats[0]) && same(a.rec.heats[1], r.heats[1]));
  const big = R.toggleMember(R.toggleMember(R.addGroup(mk()).rec, 0, 0).rec, 0, 1).rec; let g5 = big; for (const p of [2, 3, 4]) g5 = R.toggleMember(g5, 0, p).rec;
  ok('a group with more participants than lanes is refused, in words ("has 5 participants, and a heat holds only 4")', err(R.assignGroup(g5, 0, 0)) === 'The group "Group 1" has 5 participants, and a heat holds only 4.');
  ok('...an empty group, a group or a heat that is not there are refused', /no participants/.test(err(R.assignGroup(R.addGroup(mk()).rec, 0, 0))) && /does not exist/.test(err(R.assignGroup(mk(), 0, 0))) && /not in the rotation/.test(err(R.assignGroup(r, 9, 0))) && /does not exist/.test(err(R.assignGroup(r, 0, 3))));
  ok('...an unnamed group is called by its number in the sentence', /"Group 2"/.test(err(R.assignGroup(R.renameGroup(R.addGroup(R.addGroup(mk()).rec).rec, 1, '').rec, 0, 1))));
  ok('a group is removed; one that is not there is refused; so are a rename, a tick for a group that is not there and a tick for a participant who is not there', R.removeGroup(r, 0).rec.groups.length === 0 && err(R.removeGroup(r, 4)) !== '' && err(R.renameGroup(r, 4, 'x')) !== '' && err(R.toggleMember(r, 4, 1)) !== '' && err(R.toggleMember(r, 0, 8)) !== '' && err(R.toggleMember(r, 0, -1)) !== '');
  let many = mk(); for (let i = 0; i < 20; i++) many = R.addGroup(many).rec;
  ok('at most 20 groups', many.groups.length === 20 && /at most 20 groups/.test(err(R.addGroup(many)))); }

// ---- heats ----
{ const r = mk();
  ok('a heat is added at the end, empty, without a label, not locked', R.addHeat(r).rec.heats.length === 4 && same(R.addHeat(r).rec.heats[3], { label: '', locked: false, places: [] }) && r.heats.length === 3);
  let full = r; for (let i = 0; i < 197; i++) full = R.addHeat(full).rec; ok('at most 200 heats (add and duplicate)', full.heats.length === 200 && /at most 200 heats/.test(err(R.addHeat(full))) && /at most 200 heats/.test(err(R.duplicateHeat(full, 0))));
  ok('a heat is removed; one that is not there is refused', same(order(R.removeHeat(r, 1).rec), ['A', 'C']) && /not in the rotation/.test(err(R.removeHeat(r, 3))) && /not in the rotation/.test(err(R.removeHeat(r, -1))));
  const d = R.duplicateHeat(R.setLocked(r, 1, true).rec, 1).rec; ok('a heat is duplicated right after itself, with the same participants and label, and the copy is not locked', d.heats.length === 4 && same(d.heats[2].places, d.heats[1].places) && d.heats[2].label === 'B' && d.heats[1].locked === true && d.heats[2].locked === false && /not in the rotation/.test(err(R.duplicateHeat(r, 7))));
  ok('...a copy is a real copy: a change to it does not change the original', R.place(d, 2, 0, 0).rec.heats[1].places[0].p === 4);
  ok('a heat is emptied, and a heat that is not there is refused', R.clearHeat(r, 0).rec.heats[0].places.length === 0 && R.clearHeat(r, 0).rec.heats[0].label === 'A' && /not in the rotation/.test(err(R.clearHeat(r, 4))));
  ok('a heat gets a label (also an empty one), and a heat that is not there is refused', R.setLabel(r, 0, 'Juniors').rec.heats[0].label === 'Juniors' && R.setLabel(r, 0, '').rec.heats[0].label === '' && R.setLabel(r, 0, null).rec.heats[0].label === '' && /not in the rotation/.test(err(R.setLabel(r, 5, 'x'))));
  ok('a heat is locked and unlocked, and a heat that is not there is refused', R.setLocked(r, 0, true).rec.heats[0].locked === true && R.setLocked(R.setLocked(r, 0, true).rec, 0, false).rec.heats[0].locked === false && R.setLocked(r, 0, 'yes').rec.heats[0].locked === true && /not in the rotation/.test(err(R.setLocked(r, 3, true))));
  ok('a locked heat cannot be removed, emptied or moved; the sentence says which heat', err(R.removeHeat(R.setLocked(r, 1, true).rec, 1)) === 'Heat 2 is locked. Unlock it first to change it.' && /locked/.test(err(R.clearHeat(R.setLocked(r, 1, true).rec, 1))) && /locked/.test(err(R.moveHeat(R.setLocked(r, 1, true).rec, 1, 1))));
  ok('a heat moves up and down', same(order(R.moveHeat(r, 1, -1).rec), ['B', 'A', 'C']) && same(order(R.moveHeat(r, 1, 1).rec), ['A', 'C', 'B']));
  ok('...not past the first or the last heat', err(R.moveHeat(r, 0, -1)) === 'This is the first heat.' && err(R.moveHeat(r, 2, 1)) === 'This is the last heat.' && /not in the rotation/.test(err(R.moveHeat(r, 5, 1))));
  ok('...a heat does not move past a locked heat (heat 1 down: heat 2 is locked), and the locked heat does not move', err(R.moveHeat(R.setLocked(r, 1, true).rec, 0, 1)) === 'Heat 2 is locked. Unlock it first to change it.' && err(R.moveHeat(R.setLocked(r, 0, true).rec, 1, -1)) === 'Heat 1 is locked. Unlock it first to change it.'); }

// ---- shuffling the order ----
{ const big = R.blank(40, 4); big.heats.forEach((h, i) => { h.label = 'h' + i; });
  const names = rec => rec.heats.map(h => h.label).join();
  const a = R.shuffleOrder(big, 7).rec;
  ok('the order of the heats is shuffled: the same heats, in another order', names(a) !== names(big) && [...a.heats.map(h => h.label)].sort().join() === [...big.heats.map(h => h.label)].sort().join() && a.heats.length === 10 && a.heats.every(h => h.places.length === 4));
  ok('...with the same seed the same order, with another seed another', names(R.shuffleOrder(big, 7).rec) === names(a) && names(R.shuffleOrder(big, 8).rec) !== names(a) && R.shuffleOrder(big).rec.heats.length === 10);
  let lk = R.setLocked(R.setLocked(big, 0, true).rec, 5, true).rec; const b = R.shuffleOrder(lk, 3).rec;
  ok('...locked heats stay exactly where they are (heat 1 and heat 6), the others take the free positions', b.heats[0].label === 'h0' && b.heats[5].label === 'h5' && b.heats[0].locked && b.heats[5].locked && names(b) !== names(lk) && b.heats.map(h => h.label).sort().join() === big.heats.map(h => h.label).sort().join());
  ok('...with every heat locked, or one heat, nothing changes', names(R.shuffleOrder(R.clean({ ...big, heats: big.heats.map(h => ({ ...h, locked: true })) }, true), 4).rec) === names(big) && names(R.shuffleOrder(R.blank(4, 4), 1).rec) === names(R.blank(4, 4)));
  ok('reversing turns the order round', names(R.reverseOrder(big).rec) === big.heats.map(h => h.label).reverse().join() && names(R.reverseOrder(R.reverseOrder(big).rec).rec) === names(big));
  const rv = R.reverseOrder(R.setLocked(R.setLocked(big, 0, true).rec, 9, true).rec).rec;
  ok('...locked heats stay where they are when it is reversed: heat 1 and heat 10 stay, heats 2 to 9 are turned', rv.heats[0].label === 'h0' && rv.heats[9].label === 'h9' && rv.heats.slice(1, 9).map(h => h.label).join() === big.heats.slice(1, 9).map(h => h.label).reverse().join()); }

// ---- shuffling the lanes and evening them out ----
{ const r = R.blank(8, 4);
  const s = R.shuffleLanes(r, 9).rec;
  ok('the lanes inside the heats are shuffled: the same participants in every heat, in the same lanes (all four are in use)', s.heats.every((h, i) => same(h.places.map(e => e.p).sort((x, y) => x - y), r.heats[i].places.map(e => e.p)) && same(h.places.map(e => e.lane), [0, 1, 2, 3])) && !same(grid(s), grid(r)));
  ok('...with the same seed the same lanes', same(R.shuffleLanes(r, 9).rec, s) && !same(R.shuffleLanes(r, 10).rec, s));
  const part = R.clean({ participants: 5, lanes: 4, heats: [{ places: [{ p: 0, lane: 0 }, { p: 1, lane: 2 }, { p: 2, lane: 3 }] }, { places: [{ p: 3, lane: 1 }] }] }, true);
  ok('...a heat uses the lanes it used (heat 1: lanes 1, 3 and 4), a heat with one car stays', R.shuffleLanes(part, 3).rec.heats[0].places.map(e => e.lane).join() === '0,2,3' && same(R.shuffleLanes(part, 3).rec.heats[1].places, [{ p: 3, lane: 1 }]));
  const lk = R.setLocked(r, 0, true).rec; ok('...a locked heat is not shuffled', same(R.shuffleLanes(lk, 5).rec.heats[0], lk.heats[0]) && R.shuffleLanes(R.blank(4, 4)).rec.heats.length === 1);
  // 4 participants, 4 heats of the same 4 participants, all in the same lanes: lane 1 for P1 every time
  const unfair = R.clean({ participants: 4, lanes: 4, heats: Array.from({ length: 4 }, () => ({ places: [0, 1, 2, 3].map(p => ({ p, lane: p })) })) }, true);
  const fair = R.evenLanes(unfair, 2).rec;
  ok('evening out the lanes gives every participant every lane once in 4 heats of 4 (the heats keep their participants)', R.perParticipant(fair).every(x => x.lanes.every(n => n === 1)) && fair.heats.every(h => same(h.places.map(e => e.p).sort(), [0, 1, 2, 3])) && R.perParticipant(unfair).every(x => x.lanes.filter(n => n === 4).length === 1));
  ok('...with the same seed the same lanes; the heats and their labels stay', same(R.evenLanes(unfair, 2).rec, fair) && R.evenLanes(mk(), 4).rec.heats.map(h => h.label).join('') === 'ABC');
  const half = R.setLocked(unfair, 0, true).rec, hf = R.evenLanes(half, 1).rec;
  ok('...a locked heat is not changed, and the others are given lanes', same(hf.heats[0], half.heats[0]) && hf.heats.length === 4 && hf.heats.slice(1).every(h => new Set(h.places.map(e => e.lane)).size === 4));
  ok('...with nothing to change it says so', err(R.evenLanes(R.clean({ participants: 4 }, true), 1)) === 'There are no heats to change.' && /no heats to change/.test(err(R.evenLanes(R.setLocked(R.blank(4, 4), 0, true).rec, 1))) && !R.evenLanes(R.blank(4, 4)).error); }

// ---- the rotation in a race ----
{ const r = mk();
  const all = R.scheduleFor(r); ok('the heats for the race: every heat with its places, the label, and the number of the heat in the rotation', all.schedule.length === 3 && same(all.schedule[0], [{ p: 0, lane: 0 }, { p: 1, lane: 1 }, { p: 2, lane: 2 }, { p: 3, lane: 3 }]) && same(all.labels, ['A', 'B', 'C']) && same(all.heatNos, [1, 2, 3]) && same(all.keep, [0, 1, 2, 3, 4, 5, 6, 7]));
  ok('...and it is a plan the race can use', H.fits(all.schedule, 8, 4) && H.stats(all.schedule, 8, 4).heats === 3);
  const away = R.scheduleFor(r, [1, 5]);
  ok('participants who are not here are left out and the others move up in number: 1 and 5 away, heat 1 is 0 2 3 (as 0 1 2), the lanes stay', same(away.keep, [0, 2, 3, 4, 6, 7]) && same(away.schedule[0], [{ p: 0, lane: 0 }, { p: 1, lane: 2 }, { p: 2, lane: 3 }]) && same(away.schedule[1], [{ p: 3, lane: 0 }, { p: 4, lane: 2 }, { p: 5, lane: 3 }]) && H.fits(away.schedule, 6, 4));
  ok('...heat 3 (0 2 4 6) with 1 and 5 away is 0 1 3 4 in the new numbers', same(away.schedule[2].map(e => e.p), [0, 1, 3, 4]));
  const none = R.scheduleFor(r, [4, 5, 6, 7]); ok('...a heat with nobody left is left out, and the labels and the heat numbers follow the heats that stay', none.schedule.length === 2 && same(none.labels, ['A', 'C']) && same(none.heatNos, [1, 3]) && none.keep.length === 4);
  ok('...absent can be anything: nothing, nothing useful, a number twice', R.scheduleFor(r, undefined).schedule.length === 3 && R.scheduleFor(r, ['x', null, 1.5]).keep.length === 8 && same(R.scheduleFor(r, [2, 2]).keep, [0, 1, 3, 4, 5, 6, 7]));
  ok('an empty heat is left out of the race', R.scheduleFor(R.addHeat(r).rec).schedule.length === 3 && same(R.scheduleFor(R.addHeat(r).rec).heatNos, [1, 2, 3]));
  const one = R.scheduleFor(R.clean({ participants: 3, lanes: 2, heats: [{ places: [{ p: 0, lane: 0 }, { p: 1, lane: 1 }] }] }, true), [1]); ok('a heat with one car left stays a heat (it is shown as a warning, not removed)', one.schedule.length === 1 && one.schedule[0].length === 1);
  ok('a rotation can be raced: the race engine takes its heats (3 heats, every heat has its cars), and the results go to the right participant', (() => {
    const people = Array.from({ length: 8 }, (_, i) => ({ driverId: 'd' + i, carId: 'c' + i, driverName: 'D' + i, carName: 'car' + i }));
    const heat = E.createHeatRace({ participants: people, schedule: all.schedule, lanes: 4, resultBy: 'laps' });
    const en = heat.entries(); return heat.count === 3 && en.length === 4 && en.map(x => x.driverName).join() === 'D0,D1,D2,D3' && en.map(x => x.lane).join() === '0,1,2,3';
  })());
  ok('the key of a plan is the same for the same heats and another for other heats, lanes or absent participants', R.signature(r) === R.signature(mk()) && R.signature(r) !== R.signature(R.place(r, 0, 0, 5).rec) && R.signature(r) !== R.signature(r, [1]) && R.signature(r, [3, 1]) === R.signature(r, [1, 3]) && R.signature(r) === R.signature(R.setLabel(r, 0, 'x').rec) && R.signature(r) !== R.signature(R.resize(r, 8, 6).rec));
  ok('the lanes a rotation uses: the highest lane in use', R.lanesUsed(r) === 4 && R.lanesUsed(R.clean({ participants: 4, lanes: 6, heats: [{ places: [{ p: 0, lane: 1 }] }] })) === 2 && R.lanesUsed(R.clean({})) === 0); }

// ---- what stops a race ----
{ const r = mk();
  ok('a rotation that fits has no problems', same(R.problems(r, { rows: 8, trackLanes: 4, here: 8 }), []) && same(R.problems(r, { rows: 8, trackLanes: 6, here: 8 }), []));
  ok('the number of participants must be the number of rows ("has 8 participants and you have 6")', R.problems(r, { rows: 6, trackLanes: 4 })[0] === 'The rotation "Club night" has 8 participants and you have 6.');
  ok('a track with fewer lanes than the rotation uses is refused, with the heats that are in the way', R.problems(r, { rows: 8, trackLanes: 3, here: 8 })[0] === 'The rotation uses lane 4, and this track has 3 lanes (heat 1, 2, 3).');
  ok('...a rotation that has lanes it does not use fits a smaller track', same(R.problems(R.clean({ participants: 4, lanes: 6, heats: [{ places: [{ p: 0, lane: 0 }, { p: 1, lane: 1 }] }, { places: [{ p: 2, lane: 0 }, { p: 3, lane: 1 }] }] }), { rows: 4, trackLanes: 2, here: 4 }), []));
  const long = R.clean({ participants: 8, lanes: 4, heats: Array.from({ length: 8 }, () => ({ places: [{ p: 0, lane: 3 }] })) });
  ok('...many heats in the way are cut short', /heat 1, 2, 3, 4, 5 and more\)/.test(R.problems(long, { rows: 8, trackLanes: 2 })[0]));
  ok('a track without lanes (unknown) is not a problem here', same(R.problems(r, { rows: 8, trackLanes: 0 }), []) && same(R.problems(r, { rows: 8 }), []));
  ok('a rotation without heats is refused', /has no heats/.test(R.problems(R.clean({ name: 'Empty' }), { rows: 8, trackLanes: 4 })[0]) && /has no heats/.test(R.problems(R.addHeat(R.clean({ name: 'E' }, true)).rec, { rows: 8 })[0]));
  ok('fewer than two participants here is refused', R.problems(r, { rows: 8, trackLanes: 4, here: 1 })[0] === 'At least two participants must be here.' && R.problems(r, { rows: 8, trackLanes: 4, here: 0 }).length === 1 && same(R.problems(r, { rows: 8, trackLanes: 4, here: 2 }), [])); }

// ---- the drivers of the names ----
{ const drivers = [{ id: 'a', name: 'Piet', nick: 'Pitty' }, { id: 'b', name: 'Kees' }, { id: 'c', name: 'Jan' }, { id: 'd', name: 'Jan' }];
  const keys = d => [d.name, d.nick];
  const r = mk({ names: ['piet ', 'KEES', 'Jan', 'Henk', '', 'Pitty'] });
  const m = R.matchDrivers(r, drivers, keys);
  ok('a name picks the driver with that name (capitals and spaces do not matter, either of the texts of the driver)', m.picks[0] === 'a' && m.picks[1] === 'b' && m.picks[5] === 'a');
  ok('...a name that two drivers have, a name nobody has and no name are not picked', m.picks[2] === '' && m.picks[3] === '' && m.picks[4] === '' && m.picks[6] === '' && m.picks.length === 8);
  ok('...and they are reported: how many matched, how many have a name, which names have no driver, which have more than one', m.matched === 3 && m.named === 5 && same(m.missing, ['Henk']) && same(m.ambiguous, ['Jan']));
  ok('without names nothing is picked', R.matchDrivers(mk(), drivers, keys).matched === 0 && R.matchDrivers(mk(), drivers, keys).named === 0 && R.matchDrivers(mk(), [], keys).picks.every(x => x === '')); }

// ---- what the editor says ----
{ const text = rec => R.check(rec).map(c => c.text), level = (rec, re) => (R.check(rec).find(c => re.test(c.text)) || {}).level;
  ok('no heats: say so, and nothing else', same(R.check(R.clean({})), [{ level: 'warn', text: 'There are no heats yet. Add a heat, or start from a plan.' }]));
  const base = R.blank(8, 4);
  ok('a plain rotation: everybody races once; the lanes are not mentioned (one heat each)', same(text(base), ['Every participant races 1 heat.']));
  const three = R.generate(R.clean({ participants: 8, lanes: 4 }), { plan: 'perdriver', each: 3 }, 3).rec;
  ok('a fair rotation: every participant races 3 heats; the lanes are shared evenly; everybody meets everybody', text(three).some(t => t === 'Every participant races 3 heats.') && text(three).some(t => t === 'The lanes are shared evenly.') && level(three, /shared evenly/) === 'info');
  const unfair = R.clean({ participants: 4, lanes: 4, heats: Array.from({ length: 4 }, () => ({ places: [0, 1, 2, 3].map(p => ({ p, lane: p })) })) }, true);
  ok('lanes that are not shared evenly are reported, and "Even out the lanes" is the way out', text(unfair).some(t => /not shared evenly.*Even out the lanes/.test(t)) && text(R.evenLanes(unfair, 1).rec).includes('The lanes are shared evenly.'));
  ok('everybody meets everybody is said when it is so (4 in one heat), not when it is not (8 in two heats)', text(unfair).includes('Every participant races against every other participant at least once.') && !text(base).includes('Every participant races against every other participant at least once.'));
  const gap = R.place(base, 1, 3, null).rec, gap2 = R.place(gap, 0, 3, null).rec;
  ok('a participant who races no heat is named ("This participant races no heat: P8"), several are listed', text(gap).includes('This participant races no heat: P8.') && level(gap, /races no heat/) === 'warn' && text(gap2).includes('These participants race no heat: P4, P8.'));
  ok('...by name, when there is one', text(R.setName(gap, 7, 'Kees').rec).includes('This participant races no heat: Kees.'));
  ok('...many are cut short ("and 11 more")', text(R.clean({ participants: 20, lanes: 4, heats: [{ places: [{ p: 0, lane: 0 }] }] })).includes('These participants race no heat: P2, P3, P4, P5, P6, P7, P8, P9 and 11 more.'));
  const withEmpty = R.addHeat(R.addHeat(base).rec).rec; ok('empty heats are reported and will be left out ("Heats 3 and ..." as a list)', text(R.addHeat(base).rec).includes('Heat 3 is empty and will be left out of the race.') && text(withEmpty).includes('Heats 3, 4 are empty and will be left out of the race.') && level(R.addHeat(base).rec, /is empty/) === 'warn');
  ok('a heat with one car only is reported', text(R.place(R.clearHeat(base, 1).rec, 1, 0, 4).rec).includes('Heat 2 has one car only.') && text(R.clean({ participants: 4, lanes: 2, heats: [{ places: [{ p: 0, lane: 0 }] }, { places: [{ p: 1, lane: 0 }] }, { places: [{ p: 2, lane: 0 }] }] }, true)).some(t => t === 'Heats 1, 2, 3 have one car only.'));
  const uneven = R.place(R.place(R.addHeat(base).rec, 2, 0, 0).rec, 2, 1, 1).rec;
  ok('unequal numbers of heats are reported, with the advice about the average (participants 1 and 2 race twice, the others once)', text(uneven).some(t => /^The participants race 1 to 2 heats\..*count the average per heat in the race setup to keep it fair\.$/.test(t)) && level(uneven, /race 1 to 2 heats/) === 'info');
  const small = R.clean({ participants: 6, lanes: 4, heats: [{ places: [0, 1, 2, 3].map(p => ({ p, lane: p })) }, { places: [4, 5].map((p, i) => ({ p, lane: i })) }] }, true);
  ok('heats with fewer cars than lanes are mentioned (not those with one car: that is a warning of its own)', text(small).includes('Heat 2 has fewer cars than the 4 lanes.') && !text(R.place(R.clearHeat(base, 1).rec, 1, 0, 4).rec).some(t => /fewer cars/.test(t)));
  ok('two participants with the same name are reported (capitals do not matter)', text(R.setName(R.setName(base, 0, 'Piet').rec, 3, 'piet').rec).includes('The name "Piet" is used twice.') && text(R.setName(R.setName(R.setName(R.setName(base, 0, 'Piet').rec, 3, 'piet').rec, 1, 'Kees').rec, 2, 'kees').rec).includes('The names "Piet", "Kees" are used twice.'));
  ok('...a name that is used once, or is empty, is no problem', !text(R.setName(base, 0, 'Piet').rec).some(t => /used twice/.test(t)));
  const per = R.perParticipant(three); ok('per participant: the heats and the lanes (3 heats each, 3 lanes in use)', per.length === 8 && per.every(x => x.heats === 3 && x.lanes.reduce((a, b) => a + b, 0) === 3 && x.lanes.length === 4));
  ok('...without heats everybody has 0', R.perParticipant(R.clean({})).every(x => x.heats === 0 && x.lanes.length === 4) && R.perParticipant(R.clean({})).length === 8);
  ok('a rotation in one line', R.describe(base) === '8 participants, 4 lanes, 2 heats' && R.describe(R.clean({ participants: 2, lanes: 1, heats: [{ places: [{ p: 0, lane: 0 }] }] })) === '2 participants, 1 lane, 1 heats' && R.describe(R.addHeat(base).rec) === '8 participants, 4 lanes, 2 heats'); }

// ---- the summary on Home for a rotation (heats.js) ----
{ const r = mk(), st = H.stats(R.scheduleFor(r).schedule, 8, 4), names = Array.from({ length: 8 }, (_, i) => 'P' + (i + 1));
  const lines = H.summary({ stats: st, setup: { sessionType: 'heats', laps: 10, heatPlan: 'manual' }, names, custom: true }), plain = H.summary({ stats: st, setup: { sessionType: 'heats', laps: 10, heatPlan: 'manual' }, names });
  ok('a rotation where some participants race more heats than others does not advise settings that no longer apply (there is no plan to choose)', lines.some(l => /do not race the same number of heats/.test(l)) && !lines.some(l => /To avoid it/.test(l)) && plain.some(l => /To avoid it, choose the plan/.test(l)));
  ok('the key of a plan can carry what else it is made from (a rotation): another extra is another key; without extra the key is the one it always was', H.planKey({ count: 8, lanes: 4, setup: {}, seed: 1, extra: 'a' }) !== H.planKey({ count: 8, lanes: 4, setup: {}, seed: 1, extra: 'b' }) && H.planKey({ count: 8, lanes: 4, setup: {}, seed: 1 }) === H.planKey({ count: 8, lanes: 4, setup: {}, seed: 1, extra: '' }) && H.planKey({ count: 8, lanes: 4, setup: {}, seed: 1 }) !== H.planKey({ count: 8, lanes: 4, setup: {}, seed: 1, extra: 'a' })); }

// ---- the edges (found by breaking the code on purpose and looking for what no test noticed) ----
{ const lanesBad = R.clean({ participants: 4, lanes: 3, heats: [{ places: [{ p: 0, lane: -1 }, { p: 1, lane: 1.5 }, { p: 2, lane: '1' }, { p: 3, lane: 2 }] }] });
  ok('a place in lane -1, in lane 1.5 or in lane "1" (a text) is thrown away', same(lanesBad.heats[0].places, [{ p: 3, lane: 2 }]));
  const typed = R.clean({ name: 'My ', participants: 4, names: ['A ', '', '', ''], groups: [{ name: '', members: [] }], heats: [] }, true), rs = R.resize(typed, 5, 4).rec;
  ok('changing the size while typing keeps the spaces and the empty group name that were typed', rs.name === 'My ' && rs.names[0] === 'A ' && rs.groups[0].name === '' && rs.participants === 5);
  ok('exactly 200 heats can be made, 208 can not', R.generate(R.blank(64, 8), { plan: 'perdriver', each: 25 }).rec.heats.length === 200 && err(R.generate(R.blank(64, 8), { plan: 'perdriver', each: 26 })) === 'That makes 208 heats. The most is 200.');
  const three = R.clean({ participants: 6, lanes: 2, heats: [{ label: 'A', places: [{ p: 0, lane: 0 }, { p: 1, lane: 1 }] }, { label: 'B', places: [{ p: 2, lane: 0 }, { p: 3, lane: 1 }] }, { label: 'C', places: [{ p: 4, lane: 0 }, { p: 5, lane: 1 }] }] }, true);
  const orders = new Set(); for (let sd = 1; sd <= 60; sd++) orders.add(order(R.shuffleOrder(three, sd).rec).join(''));
  ok('shuffling the heat order can give every one of the 6 orders, also the order it was in', orders.size === 6 && orders.has('ABC'));
  const two = R.clean({ participants: 2, lanes: 2, heats: [{ places: [{ p: 0, lane: 0 }, { p: 1, lane: 1 }] }] }, true), seen = new Set();
  for (let sd = 1; sd <= 30; sd++) seen.add(grid(R.shuffleLanes(two, sd).rec)[0]);
  ok('a heat of two participants can swap its lanes when the lanes are shuffled (and stay)', seen.size === 2);
  const g1 = R.addGroup(R.clean({})).rec;
  ok('a group renamed to nothing has an empty name (not the word undefined or null)', R.renameGroup(g1, 0, undefined).rec.groups[0].name === '' && R.renameGroup(g1, 0, null).rec.groups[0].name === '');
  let gm = R.toggleMember(R.addGroup(R.clean({})).rec, 0, 3).rec; gm = R.toggleMember(gm, 0, 5).rec;
  ok('a participant is ticked out of a group again, also the first one of the list', same(R.toggleMember(gm, 0, 3).rec.groups[0].members, [5]) && same(R.toggleMember(gm, 0, 5).rec.groups[0].members, [3]));
  const gx = R.clean({ participants: 8, lanes: 2, groups: [{ name: 'a', members: [] }, { name: 'b', members: [] }, { name: '', members: [0, 1, 2] }], heats: [{ places: [] }] }, true);
  ok('the sentence about a group without a name says "Group 3" for the third group', err(R.assignGroup(gx, 0, 2)) === 'The group "Group 3" has 3 participants, and a heat holds only 2.');
  const wide = n => R.clean({ participants: 2, lanes: 8, heats: Array.from({ length: n }, () => ({ places: [{ p: 0, lane: 5 }, { p: 1, lane: 0 }] })) }, true);
  ok('the heats that need a lane the track has not: 5 are listed, with 6 "and more" follows', R.problems(wide(5), { rows: 2, trackLanes: 4, here: 2 })[0] === 'The rotation uses lane 6, and this track has 4 lanes (heat 1, 2, 3, 4, 5).' && R.problems(wide(6), { rows: 2, trackLanes: 4, here: 2 })[0] === 'The rotation uses lane 6, and this track has 4 lanes (heat 1, 2, 3, 4, 5 and more).');
  const hollow = n => R.clean({ participants: 2, lanes: 2, heats: Array.from({ length: n }, () => ({ places: [] })) }, true);
  ok('a list of 8 empty heats is written out, a list of 9 ends with "and 1 more"; with nothing but empty heats that is the only remark', R.check(hollow(8)).length === 1 && R.check(hollow(8))[0].text === 'Heats 1, 2, 3, 4, 5, 6, 7, 8 are empty and will be left out of the race.' && R.check(hollow(9))[0].text === 'Heats 1, 2, 3, 4, 5, 6, 7, 8 and 1 more are empty and will be left out of the race.');
  const lanesRemark = heats => R.check(R.clean({ participants: 2, lanes: 2, heats }, true)).map(c => c.text).filter(t => /^The lanes /.test(t));
  const A = [{ p: 0, lane: 0 }, { p: 1, lane: 1 }], B = [{ p: 0, lane: 1 }, { p: 1, lane: 0 }];
  ok('the lanes are called uneven when somebody races twice in the same lane (2 heats each, a difference of 2), and even when the lanes alternate', lanesRemark([{ places: A }, { places: A }]).length === 1 && /not shared evenly/.test(lanesRemark([{ places: A }, { places: A }])[0]) && lanesRemark([{ places: A }, { places: B }])[0] === 'The lanes are shared evenly.');
  ok('on one lane there is nothing to say about the lanes', R.check(R.clean({ participants: 2, lanes: 1, heats: [{ places: [{ p: 0, lane: 0 }] }, { places: [{ p: 1, lane: 0 }] }, { places: [{ p: 0, lane: 0 }] }, { places: [{ p: 1, lane: 0 }] }] }, true)).every(c => !/^The lanes /.test(c.text)));
}

// ---- 1.14.0: a heat for the participants who race no heat ----
{ const r = R.clean({ name: 'Ten', participants: 10, lanes: 4, heats: [{ places: [0, 1, 2, 3].map((p, lane) => ({ p, lane })) }, { places: [4, 5, 6, 7].map((p, lane) => ({ p, lane })) }] });
  const idle = R.check(r).find(c => c.fix);
  ok('the warning about participants who race no heat carries a fix with their numbers (P9 and P10 are 8 and 9)', !!idle && idle.fix.kind === 'idle' && same(idle.fix.ps, [8, 9]) && idle.level === 'warn');
  ok('no other remark carries a fix', R.check(r).filter(c => c.fix).length === 1 && R.check(mk()).every(c => !c.fix));
  const a = R.addHeatFor(r, idle.fix.ps);
  ok('addHeatFor puts a new heat at the end with them in lane 1, 2, ...', !a.error && a.rec.heats.length === 3 && same(grid(a.rec)[2], '8@0 9@1') && !a.rec.heats[2].locked && a.rec.heats[2].label === '');
  ok('...it changes nothing else, and the warning is gone', same(grid(a.rec).slice(0, 2), grid(r)) && !R.check(a.rec).some(c => c.fix) && R.check(a.rec).every(c => !/no heat/.test(c.text)));
  const big = R.clean({ name: 'Twelve', participants: 12, lanes: 2, heats: [{ places: [{ p: 0, lane: 0 }, { p: 1, lane: 1 }] }] });
  const more = R.addHeatFor(big, R.check(big).find(c => c.fix).fix.ps);
  ok('only as many as there are lanes go in the new heat, the first ones by number (the others still have to be placed)', !more.error && same(grid(more.rec)[1], '2@0 3@1') && R.check(more.rec).find(c => c.fix).fix.ps.length === 8);
  ok('a list with doubles, strangers or nothing is cleaned up or refused in words', same(grid(R.addHeatFor(r, [9, 9, 8, 77, -1, 'x']).rec)[2], '8@0 9@1') && /nobody/.test(err(R.addHeatFor(r, []))) && /nobody/.test(err(R.addHeatFor(r, [99, 'x']))) && /nobody/.test(err(R.addHeatFor(r))));
  const full = R.clean({ name: 'Full', participants: 2, lanes: 2, heats: Array.from({ length: R.LIMITS.maxHeats }, () => ({ places: [{ p: 0, lane: 0 }] })) });
  ok('a rotation that holds the most heats refuses another one, in words', /at most/.test(err(R.addHeatFor(full, [1]))));
  ok('the saved record is the same shape as before (no new field): the cleaned record has the same keys', same(Object.keys(a.rec).sort(), Object.keys(r).sort())); }

// ---- 1.16.0: a heat moved to another position, and a colour for each participant ----
{ const four = () => R.clean({ name: 'Four', participants: 8, lanes: 4, heats: ['A', 'B', 'C', 'D'].map((label, i) => ({ label, places: [0, 1, 2, 3].map(lane => ({ p: (i + lane) % 8, lane })) })) });
  const labels = rec => rec.heats.map(h => h.label).join('');
  const r = four();
  ok('moveHeatTo: a heat goes to a later position, the heats in between move up', labels(R.moveHeatTo(r, 0, 2).rec) === 'BCAD');
  ok('...to an earlier position, the heats in between move down', labels(R.moveHeatTo(r, 3, 1).rec) === 'ADBC');
  ok('...to the next position it is the same as the arrow button', labels(R.moveHeatTo(r, 1, 2).rec) === labels(R.moveHeat(r, 1, 1).rec) && labels(R.moveHeatTo(r, 2, 1).rec) === labels(R.moveHeat(r, 2, -1).rec));
  ok('...the places and the labels of the heats stay with their heat', same(R.moveHeatTo(r, 0, 3).rec.heats[3], r.heats[0]) && R.moveHeatTo(r, 0, 3).rec.heats.length === 4);
  ok('the old rotation is not touched', labels(r) === 'ABCD' && labels(four()) === 'ABCD');
  const lk = four(); lk.heats[2].locked = true;
  ok('a locked heat does not move, and nothing moves past it or onto it (the same as with the arrow buttons)', /locked/.test(err(R.moveHeatTo(lk, 2, 0))) && /locked/.test(err(R.moveHeatTo(lk, 0, 3))) && /locked/.test(err(R.moveHeatTo(lk, 3, 1))) && /locked/.test(err(R.moveHeatTo(lk, 3, 2))));
  ok('...the heats on one side of a locked heat still move among themselves', labels(R.moveHeatTo(lk, 0, 1).rec) === 'BACD' && labels(R.moveHeatTo(lk, 1, 0).rec) === 'BACD' && R.moveHeatTo(lk, 0, 1).rec.heats[2].locked === true);
  ok('the same position and positions that do not exist are refused in words', /there already/.test(err(R.moveHeatTo(r, 1, 1))) && /not in the rotation/.test(err(R.moveHeatTo(r, 0, 9))) && /not in the rotation/.test(err(R.moveHeatTo(r, -1, 0))) && /not in the rotation/.test(err(R.moveHeatTo(r, 'x', 0))));
  const cols = Array.from({ length: 10 }, (_, p) => R.colorOf(p));
  ok('a colour for each participant: ten colours that are all different, as a hex number', new Set(cols).size === 10 && cols.every(c => /^#[0-9a-f]{6}$/.test(c)) && R.PALETTE.length === 10);
  ok('...it follows the number: the same number gives the same colour', R.colorOf(3) === R.colorOf(3) && R.colorOf(3) === cols[3] && R.colorOf(13) !== R.colorOf(3));
  const lighter = Array.from({ length: 10 }, (_, p) => R.colorOf(10 + p)), darker = Array.from({ length: 10 }, (_, p) => R.colorOf(20 + p));
  const lum = c => [1, 3, 5].reduce((t, i) => t + parseInt(c.slice(i, i + 2), 16), 0);
  ok('...P11 to P20 are the same ten lighter, P21 to P30 darker, so 30 participants look different', cols.every((c, p) => lum(lighter[p]) > lum(c) && lum(darker[p]) < lum(c)) && new Set([...cols, ...lighter, ...darker]).size === 30);
  ok('...a number that is no number gives the first colour, and nothing of it is saved in the rotation', R.colorOf('x') === cols[0] && R.colorOf(-4) === cols[0] && R.colorOf(NaN) === cols[0] && !JSON.stringify(R.clean(r)).includes('#'));
  ok('the first four colours (a heat of four lanes) are easy to tell apart: blue, orange, green, yellow', same(cols.slice(0, 4), ['#4c9aff', '#ff7a3d', '#3ecf8e', '#f2b705'])); }

if (fails) { console.log(fails + ' ROTATION TESTS FAILED'); process.exit(1); }
console.log('ALL ROTATION TESTS PASSED');
