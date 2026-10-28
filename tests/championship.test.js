// 1.55.0: championships (championship.js): the record and its limits, the changes to rounds, sessions and roster, what was driven and what is next, the tag a session carries,
// and how a championship lives in the database (cleaning up after a deleted driver, team or track) and in an export file.
const fs = require('fs'), os = require('os'), path = require('path');
const C = require('../renderer/championship.js'), Database = require('../db.js'), T = require('../transfer.js');
let fails = 0; const ok = (n, c) => { if (c) console.log('ok  ', n); else { console.log('FAIL', n); fails++; } };
const tmp = () => new Database(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'slt-')), 'db.json'));
const json = x => JSON.parse(JSON.stringify(x)), same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// the race setups and tracks the examples use
const setups = [{ id: 'sp', name: 'Practice 5 min', sessionType: 'practice', track: 't1' }, { id: 'sq', name: 'Qualifying 5 min', sessionType: 'qualifying', track: 't1' }, { id: 'sr', name: 'Club Night heat', sessionType: 'race', track: 't1' },
  { id: 'sh', name: 'Heats', sessionType: 'heats' }, { id: 'st', name: 'Timed', sessionType: 'timed' }, { id: 'se', name: 'Day race', sessionType: 'endurance' }, { id: 'sk', name: 'Tokens', sessionType: 'tokens' }];
const tracks = [{ id: 't1', name: 'Brands Hatch', lanes: 4 }, { id: 't2', name: 'Kidney Bean', lanes: 2 }];
const ctx = { setups, tracks };

// ---------- the kind of a session ----------
ok('a practice is Practice, a qualifying is Qualifying, a race, a timed race, heats and an Endurance Race are Race', C.kindOf(setups[0]) === 'practice' && C.kindOf(setups[1]) === 'qualifying' && ['sr', 'sh', 'st', 'se'].every(id => C.kindOf(setups.find(s => s.id === id)) === 'race'));
ok('...a Time Token Session, a setup that is none, or no setup is none of them', C.kindOf(setups[6]) === '' && C.kindOf({ sessionType: 'nonsense' }) === '' && C.kindOf(null) === '' && C.kindOf(undefined) === '');
ok('...a setup as the race window sees it (an Endurance Race has ofType) is judged by what it really is', C.kindOf({ sessionType: 'heats', ofType: 'endurance' }) === 'race' && C.kindOf({ sessionType: 'race', ofType: 'practice' }) === 'practice');
ok('the labels: Practice, Qualifying, Race', C.KIND_LABEL.practice === 'Practice' && C.KIND_LABEL.qualifying === 'Qualifying' && C.KIND_LABEL.race === 'Race' && C.KINDS.join() === 'practice,qualifying,race');
ok('the share of a race is 100, 50 or 0; anything else is 100', C.shareOf(50) === 50 && C.shareOf('50') === 50 && C.shareOf(0) === 0 && C.shareOf(75) === 100 && C.shareOf(25) === 100 && C.shareOf(33) === 100 && C.shareOf('x') === 100 && C.shareOf(undefined) === 100);

// ---------- cleaning ----------
const full = () => C.clean({ name: '  Club Cup 2026 ', rounds: [
  { name: 'Season opener', track: 't1', date: 'Sat 3 Oct', sessions: [{ setup: 'sp' }, { setup: 'sq' }, { setup: 'sr', share: 100 }] },
  { name: '', track: '', date: '', sessions: [{ setup: 'sp' }, { setup: 'sq' }, { setup: 'sr', share: 50 }] }], roster: [{ driver: 'd1', team: 'tm1', from: 1 }, { driver: 'd2', team: '', from: 2 }] });
{ const c = full();
  ok('clean: the name is trimmed, every round and session gets an id, and the shares and the roster are kept', c.name === 'Club Cup 2026' && c.rounds.length === 2 && c.rounds.every(r => r.id && r.sessions.every(s => s.id)) && c.rounds[1].sessions[2].share === 50 && c.roster.length === 2 && c.roster[1].from === 2);
  const ids = [...c.rounds.map(r => r.id), ...c.rounds.flatMap(r => r.sessions.map(s => s.id))];
  ok('...all the ids are different', new Set(ids).size === ids.length && ids.length === 8);
  ok('...a guest rule is on unless it is switched off', c.guestRule === true && C.clean({ guestRule: false }).guestRule === false && C.clean({}).guestRule === true);
  ok('...cleaning a clean record changes nothing (the ids stay)', same(C.clean(c), c));
  ok('...the id of the championship itself is kept only when asked for (and only a text is an id)', C.clean({ ...c, id: 'x1' }).id === undefined && C.clean({ ...c, id: 'x1' }, true).id === 'x1' && !('id' in C.clean({ ...c, id: 5 }, true)) && !('id' in C.clean({ name: 'x' }, true))); }
{ const c = C.clean({ rounds: [{ id: 'r1', sessions: [{ id: 's1' }, { id: 's1' }] }, { id: 'r1', sessions: [] }] });
  ok('clean: an id that is used twice is made new (a round, a session)', c.rounds[0].id === 'r1' && c.rounds[1].id !== 'r1' && c.rounds[0].sessions[0].id === 's1' && c.rounds[0].sessions[1].id !== 's1'); }
ok('clean: a driver is once in the roster, a round to join in is a whole number from 1, a record that is not a record is an empty championship',
  C.clean({ roster: [{ driver: 'd1' }, { driver: 'd1', from: 5 }, { driver: '' }, { team: 'x' }, { driver: 'd2', from: 'x' }, { driver: 'd3', from: 0 }, { driver: 'd4', from: 999 }] }).roster.map(x => x.driver + x.from).join() === 'd11,d21,d31,d440'
  && same(C.clean(null).rounds, []) && C.clean('x').name === '' && C.clean([]).roster.length === 0);
ok('clean: the limits (60 characters of name, 40 of round name, 24 of date, 40 rounds, 8 sessions, 60 drivers) hold, and a line break is a space',
  C.clean({ name: 'n'.repeat(99) }).name.length === 60 && C.clean({ rounds: [{ name: 'a\nb\t' + 'x'.repeat(99), date: 'd'.repeat(99) }] }).rounds[0].name.startsWith('a b x') && C.clean({ rounds: [{ name: 'x'.repeat(99), date: 'd'.repeat(99) }] }).rounds[0].name.length === 40
  && C.clean({ rounds: [{ date: 'd'.repeat(99) }] }).rounds[0].date.length === 24 && C.clean({ rounds: Array.from({ length: 50 }, () => ({})) }).rounds.length === 40 && C.clean({ rounds: [{ sessions: Array.from({ length: 20 }, () => ({})) }] }).rounds[0].sessions.length === 8
  && C.clean({ roster: Array.from({ length: 90 }, (_, i) => ({ driver: 'd' + i })) }).roster.length === 60);
ok('clean: a share that is not 100, 50 or 0 becomes 100', C.clean({ rounds: [{ sessions: [{ share: 33 }, { share: '0' }, { share: 50 }] }] }).rounds[0].sessions.map(s => s.share).join() === '100,0,50');
ok('a new championship has one round and no sessions, and a name to start with', (b => b.rounds.length === 1 && b.rounds[0].sessions.length === 0 && b.roster.length === 0 && b.name === 'New championship')(C.blank()));
ok('describe says how big it is, and says "1 round" for one', C.describe(full()) === '2 rounds · 6 sessions · 2 drivers' && C.describe(C.blank()) === '1 round · 0 sessions · 0 drivers' && C.describe(C.clean({ rounds: [{ sessions: [{}] }], roster: [{ driver: 'a' }] })) === '1 round · 1 session · 1 driver');
ok('roundLabel is "Round 2" or "Round 1 · Season opener"', C.roundLabel(full(), 0) === 'Round 1 · Season opener' && C.roundLabel(full(), 1) === 'Round 2' && C.roundLabel(full(), 5) === '');

// ---------- the rounds and the sessions ----------
{ const c = full(), n = C.addRound(c);
  ok('a new round begins with the sessions of the round before it: the same race setups and shares, with ids of their own', n.rec.rounds.length === 3 && n.rec.rounds[2].sessions.map(s => s.setup + s.share).join() === 'sp100,sq100,sr50' && n.rec.rounds[2].sessions.every(s => !c.rounds[1].sessions.some(o => o.id === s.id)) && n.rec.rounds[2].id !== c.rounds[1].id);
  ok('...the old championship is not touched, and a new round has no name, track or date', c.rounds.length === 2 && n.rec.rounds[2].name === '' && n.rec.rounds[2].track === '' && n.rec.rounds[2].date === '');
  ok('...the first round of a championship with none starts empty', C.addRound(C.clean({})).rec.rounds[0].sessions.length === 0);
  const full40 = C.clean({ rounds: Array.from({ length: 40 }, () => ({})) });
  ok('...at 40 rounds there is an error, not a round', /at most 40 rounds/.test(C.addRound(full40).error));
  const r = C.removeRound(c, 0);
  ok('a round is removed (the others stay in order); a round that is not there is an error', r.rec.rounds.length === 1 && r.rec.rounds[0].id === c.rounds[1].id && !!C.removeRound(c, 7).error);
  const m = C.moveRound(c, 0, 1);
  ok('a round moves down and up; at the end it can not move', m.rec.rounds[0].id === c.rounds[1].id && m.rec.rounds[1].id === c.rounds[0].id && C.moveRound(m.rec, 1, -1).rec.rounds[0].id === c.rounds[0].id && !!C.moveRound(c, 0, -1).error && !!C.moveRound(c, 1, 1).error && !!C.moveRound(c, 9, 1).error);
  const s1 = C.setRound(c, 1, { name: 'Night race', track: 't2', date: 'Sat 10 Oct' });
  ok('a round gets a name, a track and a date, within the limits', s1.rec.rounds[1].name === 'Night race' && s1.rec.rounds[1].track === 't2' && s1.rec.rounds[1].date === 'Sat 10 Oct' && C.setRound(c, 1, { name: 'x'.repeat(99) }).rec.rounds[1].name.length === 40 && C.setRound(c, 1, { date: 'd'.repeat(99) }).rec.rounds[1].date.length === 24 && !!C.setRound(c, 5, {}).error);
  ok('...a patch with one key changes that key only', (x => x.rounds[1].track === '' && x.rounds[1].date === '' && x.rounds[1].name === 'Only')(C.setRound(c, 1, { name: 'Only' }).rec));
  const a = C.addSession(c, 0, 'sr');
  ok('a session is added to the end of a round, with a race setup and a full share', a.rec.rounds[0].sessions.length === 4 && a.rec.rounds[0].sessions[3].setup === 'sr' && a.rec.rounds[0].sessions[3].share === 100 && !!a.rec.rounds[0].sessions[3].id && !!C.addSession(c, 9, 'sr').error);
  ok('...at 8 sessions there is an error', !!C.addSession(C.clean({ rounds: [{ sessions: Array.from({ length: 8 }, () => ({})) }] }), 0, '').error);
  const rs = C.removeSession(c, 0, 1), ms = C.moveSession(c, 0, 0, 1);
  ok('a session is removed, moved down and up, and can not move out of the round', rs.rec.rounds[0].sessions.map(s => s.setup).join() === 'sp,sr' && ms.rec.rounds[0].sessions.map(s => s.setup).join() === 'sq,sp,sr' && C.moveSession(ms.rec, 0, 1, -1).rec.rounds[0].sessions[0].setup === 'sp'
    && !!C.moveSession(c, 0, 0, -1).error && !!C.moveSession(c, 0, 2, 1).error && !!C.removeSession(c, 0, 9).error);
  const ss = C.setSession(c, 0, 2, { setup: 'sh', share: 0 });
  ok('a session gets another race setup and another share', ss.rec.rounds[0].sessions[2].setup === 'sh' && ss.rec.rounds[0].sessions[2].share === 0 && C.setSession(c, 0, 2, { share: 77 }).rec.rounds[0].sessions[2].share === 100 && !!C.setSession(c, 0, 9, {}).error && !!C.setSession(c, 9, 0, {}).error);
  const cp = C.copyFirstToAll(c);
  ok('"Copy the sessions of round 1 to all rounds" gives the other rounds those race setups and shares, with new ids; round 1 is the same', cp.rec.rounds[1].sessions.map(s => s.setup + s.share).join() === 'sp100,sq100,sr100' && cp.rec.rounds[1].sessions.every(s => !c.rounds[1].sessions.some(o => o.id === s.id)) && same(cp.rec.rounds[0], c.rounds[0]));
  ok('...with one round there is nothing to copy to', !!C.copyFirstToAll(C.blank()).error); }

// ---------- the roster ----------
{ const c = C.clean({ roster: [] }), a = C.addDriver(c, 'd1', 'tm1');
  ok('a driver is added to the roster with a team, joining in round 1; the same driver twice, or none, is an error', a.rec.roster.length === 1 && a.rec.roster[0].team === 'tm1' && a.rec.roster[0].from === 1 && !!C.addDriver(a.rec, 'd1', '').error && !!C.addDriver(c, '', '').error);
  ok('...a roster holds 60 drivers', !!C.addDriver(C.clean({ roster: Array.from({ length: 60 }, (_, i) => ({ driver: 'd' + i })) }), 'x', '').error);
  const drivers = [{ id: 'd1' }, { id: 'd2' }, { id: 'd3' }], team = { id: 'tm1', drivers: ['d1', 'd2', 'gone'] };
  const t = C.addTeam(a.rec, team, drivers);
  ok('all the drivers of a team are added (those who are there already, or no longer exist, are left out)', t.rec.roster.map(x => x.driver).join() === 'd1,d2' && t.added === 1 && t.rec.roster[1].team === 'tm1');
  ok('...a team whose drivers are all in the roster is an error, and so is no team', !!C.addTeam(t.rec, team, drivers).error && !!C.addTeam(a.rec, null, drivers).error && !!C.addTeam(a.rec, { id: 'tm2', drivers: [] }, drivers).error);
  ok('...a team is added only as far as the roster has room (60 drivers)', (x => x.rec.roster.length === 60 && x.added === 1)(C.addTeam(C.clean({ roster: Array.from({ length: 59 }, (_, i) => ({ driver: 'z' + i })) }), team, drivers)));
  const r = C.removeDriver(t.rec, 'd1');
  ok('a driver is taken out; one who is not in it is an error', r.rec.roster.map(x => x.driver).join() === 'd2' && !!C.removeDriver(t.rec, 'zz').error);
  const s = C.setRoster(t.rec, 'd2', { team: 'tm9', from: '3' });
  ok('the team and the round of joining are changed (a whole number from 1)', s.rec.roster[1].team === 'tm9' && s.rec.roster[1].from === 3 && C.setRoster(t.rec, 'd2', { from: 0 }).rec.roster[1].from === 1 && !!C.setRoster(t.rec, 'zz', {}).error);
  ok('the team of a driver is the first team that has him', C.teamOfDriver([{ id: 'a', drivers: ['d9'] }, { id: 'b', drivers: ['d1', 'd2'] }, { id: 'c', drivers: ['d1'] }], 'd1') === 'b' && C.teamOfDriver([], 'd1') === '' && C.teamOfDriver(undefined, 'd1') === ''); }
{ const c = C.clean({ roster: [{ driver: 'd3', from: 1 }, { driver: 'd1', from: 3 }, { driver: 'd9', from: 1 }] }), all = [{ id: 'd1' }, { id: 'd2' }, { id: 'd3' }, { id: 'd4' }];
  const r1 = C.rosterFirst(all, c, 1), r3 = C.rosterFirst(all, c, 3);
  ok('the roster comes first, in the order of the roster; the others (the guests) after, in their own order; a driver of the roster who is gone is skipped', r1.roster.map(x => x.id).join() === 'd3' && r1.others.map(x => x.id).join() === 'd1,d2,d4' && r3.roster.map(x => x.id).join() === 'd3,d1' && r3.others.map(x => x.id).join() === 'd2,d4');
  ok('...a driver who joins in round 3 is a guest in rounds 1 and 2, and in the roster from round 3', C.rosterFirst(all, c, 2).roster.length === 1 && C.rosterFirst(all, c, 3).roster.length === 2 && C.rosterFirst(all, c).roster.length === 1 && C.rosterFirst(undefined, c, 1).roster.length === 0); }

// ---------- what was driven, and what is next ----------
const champ = C.clean({ id: 'c1', name: 'Club Cup 2026', rounds: [
  { id: 'r1', sessions: [{ id: 'a1', setup: 'sp' }, { id: 'a2', setup: 'sq' }, { id: 'a3', setup: 'sr' }] }, { id: 'r2', sessions: [{ id: 'b1', setup: 'sp' }, { id: 'b2', setup: 'sq' }, { id: 'b3', setup: 'sr', share: 50 }] },
  { id: 'r3', sessions: [] }, { id: 'r4', sessions: [{ id: 'd1', setup: 'sr' }] }] }, true);
const drove = (round, sess, date, id = 'c1') => ({ id: 'x' + round + sess + date, date, champ: { id, roundId: round, sessionId: sess } });
{ const p0 = C.progress(champ, []);
  ok('nothing driven: round 1 is next, at its first session; the empty round is "empty"; the others are to do', p0.next.round === 0 && p0.next.session === 0 && p0.rounds.map(r => r.state).join() === 'next,todo,empty,todo' && p0.driven === 0 && p0.total === 7 && !p0.complete);
  const p1 = C.progress(champ, [drove('r1', 'a1', '2026-10-01'), drove('r1', 'a2', '2026-10-01')]);
  ok('two sessions driven: the next session is the third of round 1', p1.next.round === 0 && p1.next.session === 2 && p1.rounds[0].driven === 2 && p1.rounds[0].state === 'next' && p1.driven === 2);
  const p2 = C.progress(champ, [drove('r1', 'a1', 'd'), drove('r1', 'a2', 'd'), drove('r1', 'a3', 'd')]);
  ok('round 1 done: round 2 is next at its first session', p2.rounds[0].state === 'done' && p2.rounds[1].state === 'next' && p2.next.round === 1 && p2.next.session === 0);
  const p3 = C.progress(champ, [drove('r1', 'a1', 'd'), drove('r1', 'a3', 'd')]);
  ok('a session can be driven out of order: the first one that is not driven is next', p3.next.round === 0 && p3.next.session === 1);
  const all = ['a1', 'a2', 'a3'].map(s => drove('r1', s, 'd')).concat(['b1', 'b2', 'b3'].map(s => drove('r2', s, 'd')), [drove('r4', 'd1', 'd')]), p4 = C.progress(champ, all);
  ok('everything driven: no next session, finished', p4.next === null && p4.complete && p4.driven === 7 && p4.rounds.map(r => r.state).join() === 'done,done,empty,done');
  ok('a race of another championship, a race with no tag, and junk do not count', C.progress(champ, [drove('r1', 'a1', 'd', 'other'), { id: 'z', date: 'd' }, null, 'x', { champ: 'x' }, { champ: null }]).driven === 0 && C.progress(champ, undefined).driven === 0);
  ok('a session driven twice counts once (the later one is the one that counts)', (m => m.size === 1 && m.get('r1:a1').id === 'late')(C.driven(champ, [{ id: 'late', date: '2026-10-09', champ: { id: 'c1', roundId: 'r1', sessionId: 'a1' } }, { id: 'early', date: '2026-10-01', champ: { id: 'c1', roundId: 'r1', sessionId: 'a1' } }])));
  ok('a championship with no sessions at all has nothing next and is not finished', (p => p.next === null && !p.complete && p.total === 0)(C.progress(C.blank(), []))); }

// ---------- loading a session ----------
ok('the track of a session is the track of the round, else the track of the race setup; a track that is gone is none', C.trackFor({ track: 't2' }, setups[0], tracks) === 't2' && C.trackFor({ track: '' }, setups[0], tracks) === 't1' && C.trackFor({ track: 'gone' }, setups[0], tracks) === 't1' && C.trackFor({ track: '' }, setups[3], tracks) === '' && C.trackFor(null, null, tracks) === '');
ok('a session that can be raced has no problems', C.sessionProblems(champ, 0, 0, ctx).length === 0);
ok('...no race setup, a race setup that was deleted, a Time Token Session and no track each say so', /Round 1, session 1 has no race setup/.test(C.sessionProblems(C.clean({ rounds: [{ sessions: [{}] }] }), 0, 0, ctx)[0])
  && /its race setup was deleted/.test(C.sessionProblems(C.clean({ rounds: [{ sessions: [{ setup: 'gone' }] }] }), 0, 0, ctx)[0]) && /Time Token Session, which can not be part of a championship/.test(C.sessionProblems(C.clean({ rounds: [{ sessions: [{ setup: 'sk' }] }] }), 0, 0, ctx)[0])
  && /Round 1, session 1 has no track/.test(C.sessionProblems(C.clean({ rounds: [{ sessions: [{ setup: 'sh' }] }] }), 0, 0, ctx)[0]) && C.sessionProblems(C.clean({ rounds: [{ track: 't2', sessions: [{ setup: 'sh' }] }] }), 0, 0, ctx).length === 0 && C.sessionProblems(champ, 5, 0, ctx).length === 1);
{ const bad = C.problems(champ, ctx);
  ok('the list of problems: an empty round is one, and a round with a deleted track says it falls back on the race setup', bad.length === 1 && /Round 3 has no sessions/.test(bad[0]) && C.problems(C.clean({ rounds: [{ track: 'gone', sessions: [{ setup: 'sr' }] }] }), ctx).some(t => /its track was deleted/.test(t)) && C.problems(C.clean({}), ctx)[0] === 'It has no rounds yet.'); }

// ---------- the tag ----------
{ const tag = C.tagOf(champ, 1, 2, ctx);
  ok('the tag of a session has the championship, the round and the session (by number and by id), the kind and the share of a race', tag && tag.id === 'c1' && tag.name === 'Club Cup 2026' && tag.round === 2 && tag.roundId === 'r2' && tag.session === 3 && tag.sessionId === 'b3' && tag.kind === 'race' && tag.share === 50);
  ok('...a practice and a qualifying always say 100 (the share is for races), and a session without a kind has no tag', C.tagOf(champ, 0, 0, ctx).kind === 'practice' && C.tagOf(champ, 0, 1, ctx).share === 100 && C.tagOf(C.clean({ rounds: [{ sessions: [{ setup: 'sk' }] }] }), 0, 0, ctx) === null && C.tagOf(champ, 0, 9, ctx) === null && C.tagOf(champ, 9, 0, ctx) === null);
  ok('...also for a session that was given a share before its race setup changed to a practice (the share is for races only)', C.tagOf(C.setSession(champ, 0, 0, { share: 50 }).rec, 0, 0, ctx).share === 100 && C.tagOf(C.setSession(champ, 0, 1, { share: 0 }).rec, 0, 1, ctx).share === 100);
  ok('the tag is plain data (it goes into a saved session as it is)', same(json(tag), tag));
  ok('the words: "Club Cup 2026 · Round 2 · Race at 50%"; a full race, a qualifying and a race that gives no points', C.tagText(tag) === 'Club Cup 2026 · Round 2 · Race at 50%' && C.tagText(C.tagOf(champ, 0, 2, ctx)) === 'Club Cup 2026 · Round 1 · Race' && C.tagText(C.tagOf(champ, 0, 1, ctx)) === 'Club Cup 2026 · Round 1 · Qualifying'
    && C.tagText({ name: 'X', round: 4, kind: 'race', share: 0 }) === 'X · Round 4 · Race (no points)' && C.roundKindText(tag) === 'Round 2 · Race at 50%' && C.tagText(null) === '' && C.tagText({ round: 1, kind: 'practice' }) === 'Championship · Round 1 · Practice');
  const moved = C.moveRound(champ, 0, 1).rec;
  ok('a tag finds its round and session again by id, also after the rounds were moved; a round or a session that is gone, or another championship, is none', same(C.find(champ, tag), { ri: 1, si: 2 }) && same(C.find(moved, tag), { ri: 0, si: 2 }) && C.find(C.removeRound(champ, 1).rec, tag) === null && C.find(C.removeSession(champ, 1, 2).rec, tag) === null && C.find(champ, { ...tag, id: 'zz' }) === null && C.find(champ, null) === null && C.find(null, tag) === null); }
{ const raw = { champId: 'c1', roundId: 'r2', sessionId: 'b3', setupId: 'sr' }, act = C.active(raw, [champ], setups, tracks, 'sr');
  ok('the session on Home: while its race setup is the one that is chosen it counts (the track of the round, else the race setup; the tag of the session)', act && act.ri === 1 && act.si === 2 && act.tag.share === 50 && act.track === 't1' && act.setup.id === 'sr' && act.c.id === 'c1');
  ok('...the track of the round wins over the track of the race setup', C.active(raw, [C.setRound(champ, 1, { track: 't2' }).rec], setups, tracks, 'sr').track === 't2');
  ok('...another race setup is chosen: a normal race', C.active(raw, [champ], setups, tracks, 'sp') === null && C.active(raw, [champ], setups, tracks, '') === null);
  ok('...a session that was loaded for another race setup than the one that is chosen now does not count, also when the session now has this race setup', C.active({ ...raw, setupId: 'sr' }, [C.setSession(champ, 1, 2, { setup: 'sp' }).rec], setups, tracks, 'sp') === null);
  ok('...nothing loaded, a championship that is gone, a session that is gone, a session that was given another race setup, a Time Token Session, junk: a normal race', C.active(null, [champ], setups, tracks, 'sr') === null && C.active(raw, [], setups, tracks, 'sr') === null && C.active({ ...raw, sessionId: 'zz' }, [champ], setups, tracks, 'sr') === null && C.active({ ...raw, roundId: 'zz' }, [champ], setups, tracks, 'sr') === null
    && C.active(raw, [C.setSession(champ, 1, 2, { setup: 'sp' }).rec], setups, tracks, 'sr') === null && C.active({ champId: 'c1', roundId: 'r4', sessionId: 'd1', setupId: 'sk' }, [C.setSession(champ, 3, 0, { setup: 'sk' }).rec], setups, tracks, 'sk') === null && C.active('x', [champ], setups, tracks, 'sr') === null && C.active(raw, undefined, setups, tracks, 'sr') === null); }

// ---------- in the database ----------
{ const db = tmp(), tr = db.add('tracks', { name: 'Ring', lanes: 2 }), d1 = db.add('drivers', { name: 'Anna' }), d2 = db.add('drivers', { name: 'Ben' }), tm = db.add('teams', { name: 'Foxes', drivers: [d1.id, d2.id] }), su = db.add('racesetups', { name: 'Race', sessionType: 'race', track: tr.id });
  const ch = db.add('championships', C.clean({ name: 'Cup', rounds: [{ track: tr.id, sessions: [{ setup: su.id }] }], roster: [{ driver: d1.id, team: tm.id }, { driver: d2.id, team: tm.id }] }));
  ok('a championship is a table of the database like the others (it can be added, read and updated)', db.list('championships').length === 1 && db.update('championships', ch.id, { name: 'Cup 2' }).name === 'Cup 2' && Array.isArray(db.data.championships));
  const db2 = tmp(); db2.data = json(db.data);
  db.remove('drivers', d1.id);
  ok('a driver that is deleted leaves the roster', db.data.championships[0].roster.map(x => x.driver).join() === d2.id);
  db.remove('teams', tm.id);
  ok('...a team that is deleted leaves the drivers without a team', db.data.championships[0].roster[0].team === '');
  db.remove('tracks', tr.id);
  ok('...a track that is deleted leaves the round without a track (it uses the track of the race setup)', db.data.championships[0].rounds[0].track === '' && db.data.championships[0].rounds[0].sessions.length === 1);
  const sid = db.saveSession({ setupName: 'Race', sessionType: 'race', trackId: 'x', date: '2026-10-01', champ: C.tagOf(C.clean(db.data.championships[0], true), 0, 0, { setups: db.data.racesetups }), standings: [{ driverId: d2.id, carId: '' }] }, []);
  ok('a session that was driven for the championship keeps its tag (and is found again as driven)', db.data.sessions.length === 1 && db.data.sessions[0].champ.round === 1 && C.progress(C.clean(db.data.championships[0], true), db.data.sessions).driven === 1 && !!sid);
  db.remove('championships', ch.id);
  ok('a championship that is deleted leaves its races alone', db.data.championships.length === 0 && db.data.sessions.length === 1); }

// ---------- export and import ----------
{ const a = tmp(), tr = a.add('tracks', { name: 'Ring', lanes: 2 }), d1 = a.add('drivers', { name: 'Anna' }), d2 = a.add('drivers', { name: 'Ben' }), tm = a.add('teams', { name: 'Foxes', drivers: [d1.id, d2.id] }), su = a.add('racesetups', { name: 'Race', sessionType: 'race', track: tr.id });
  const ch = a.add('championships', C.clean({ name: 'Cup', rounds: [{ name: 'One', track: tr.id, sessions: [{ setup: su.id, share: 50 }] }], roster: [{ driver: d1.id, team: tm.id, from: 2 }, { driver: d2.id, team: '' }] }));
  const out = T.collect(a.data, { championships: [ch.id] }, true);
  ok('a championship brings what it uses: the track, the race setup, the drivers and the team', ['tracks', 'racesetups', 'drivers', 'teams'].every(e => (out.items[e] || []).length >= 1) && out.items.drivers.length === 2 && out.items.championships.length === 1);
  ok('...without its dependencies it comes alone, and it is checked in the file', !T.collect(a.data, { championships: [ch.id] }, false).items.drivers && T.check(JSON.parse(JSON.stringify(out))).ok && T.check(json(out)).summary.championships.count === 1);
  ok('...the dependencies list it too (the track, the race setup, the drivers, the team)', (dp => ['tracks', 'racesetups', 'drivers', 'teams'].every(e => dp[e] && dp[e].length))(T.dependencies(a.data, { championships: [ch.id] })));
  const b = tmp(); b.add('championships', { name: 'Cup' }); const counts = T.apply(b, json(out)), imp = b.data.championships.find(x => x.name === 'Cup (imported)');
  ok('an import adds a copy with new ids, the clash of names is marked, and the links go to the imported copies', counts.championships === 1 && imp && imp.id !== ch.id && imp.rounds[0].track === b.data.tracks[0].id && imp.rounds[0].sessions[0].setup === b.data.racesetups[0].id && imp.rounds[0].sessions[0].share === 50
    && imp.roster.map(x => x.driver).join() === b.data.drivers.map(x => x.id).join() && imp.roster[0].team === b.data.teams[0].id && imp.roster[0].from === 2 && imp.rounds[0].id === ch.rounds[0].id);
  const c2 = tmp(); T.apply(c2, json({ ...out, items: { championships: out.items.championships } }));
  const lone = c2.data.championships[0];
  ok('...a championship imported without the rest has no track, no race setup and an empty roster (a driver that did not come along is not in it)', lone.rounds[0].track === '' && lone.rounds[0].sessions[0].setup === '' && lone.roster.length === 0);
  const d = tmp(); a.saveSession({ setupName: 'Race', sessionType: 'race', trackId: tr.id, date: '2026-10-02', champ: C.tagOf(C.clean(ch, true), 0, 0, { setups: a.data.racesetups }), standings: [{ driverId: d1.id, carId: '' }] }, []);
  const withS = T.collect(a.data, { sessions: [a.data.sessions[0].id], championships: [ch.id] }, true), without = T.collect(a.data, { sessions: [a.data.sessions[0].id] }, true);
  ok('a race that counted for a championship does not bring the championship along on its own', !without.items.championships);
  const e = tmp(); T.apply(e, json(withS));
  ok('...imported with it, the race counts for the copy of the championship (its new id)', e.data.sessions[0].champ && e.data.sessions[0].champ.id === e.data.championships[0].id && e.data.sessions[0].champ.id !== ch.id && e.data.sessions[0].champ.roundId === ch.rounds[0].id);
  const f = tmp(); T.apply(f, json(without));
  ok('...imported without it, the race is a normal race (no tag)', f.data.sessions.length === 1 && f.data.sessions[0].champ === undefined); }
// 1.56.0: the points rules travel with the championship, and a race keeps its award (or "not counted") mark when it is imported with the championship
{ const a = tmp(), tr = a.add('tracks', { name: 'Ring', lanes: 2 }), d1 = a.add('drivers', { name: 'Anna' }), su = a.add('racesetups', { name: 'Race', sessionType: 'race', track: tr.id });
  const rules = { points: [10, 8, 6.5], pointsMode: 'table', pointsRest: 1, bonusFast: 1, bonusFastTop: 3, bonusPole: 2, bonusStart: 0.5, drops: 1, teamMode: 'all', teamBest: 3, tie: 'qual', sprintRound: 'down', guestRule: false };
  const ch = a.add('championships', C.clean({ name: 'Cup', rounds: [{ name: 'One', track: tr.id, sessions: [{ setup: su.id }] }, { name: 'Two', track: tr.id, sessions: [{ setup: su.id }] }], roster: [{ driver: d1.id, team: '' }], ...rules }));
  const cc = C.clean(ch, true), tag = (ri, extra) => ({ ...C.tagOf(cc, ri, 0, { setups: a.data.racesetups }), ...extra });
  a.saveSession({ setupName: 'Race', sessionType: 'race', trackId: tr.id, date: '2026-10-02', champ: tag(0, { awarded: '2026-10-02T20:00:00.000Z' }), standings: [{ driverId: d1.id, carId: '' }] }, []);
  a.saveSession({ setupName: 'Race', sessionType: 'race', trackId: tr.id, date: '2026-10-09', champ: tag(1, { off: true }), standings: [{ driverId: d1.id, carId: '' }] }, []);
  const out = T.collect(a.data, { sessions: a.data.sessions.map(x => x.id), championships: [ch.id] }, true), b = tmp(); T.apply(b, json(out));
  const imp = b.data.championships[0];
  ok('the points rules come along with the championship (table, bonuses, drops, teams, tie, sprint, guest rule)', same(imp.points, [10, 8, 6.5]) && imp.pointsRest === 1 && imp.bonusFast === 1 && imp.bonusFastTop === 3 && imp.bonusPole === 2 && imp.bonusStart === 0.5 && imp.drops === 1 && imp.teamMode === 'all' && imp.teamBest === 3 && imp.tie === 'qual' && imp.sprintRound === 'down' && imp.guestRule === false);
  const s1 = b.data.sessions.find(x => x.date === '2026-10-02'), s2 = b.data.sessions.find(x => x.date === '2026-10-09');
  ok('...a race that was awarded is still awarded on the copy, one that was set to "do not count" still is, and both count for the copy of the championship', s1.champ.awarded === '2026-10-02T20:00:00.000Z' && !s1.champ.off && s2.champ.off === true && !s2.champ.awarded && s1.champ.id === imp.id && s2.champ.id === imp.id);
  ok('...and the copy is found: the awarded race is driven, the one that is not counted is not', C.driven(C.clean(imp, true), b.data.sessions).size === 1); }

console.log(fails ? fails + ' CHAMPIONSHIP TESTS FAILED' : 'ALL CHAMPIONSHIP TESTS PASSED');
process.exit(fails ? 1 : 0);
