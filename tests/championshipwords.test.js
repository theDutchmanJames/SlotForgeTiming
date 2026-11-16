// 1.78.0: the words of the championship editor (renderer/championshipwords.js): the pills, the sentence "In plain words", the status, the notes and dots of the rail and the box "Driven so far".
// Pure functions of the championship as the editor holds it, so they are tested here without a screen.
const W = require('../renderer/championshipwords.js'), C = require('../renderer/championship.js');
let fails = 0; const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const text = parts => parts.map(p => p.t).join('');
const bold = parts => parts.filter(p => p.b).map(p => p.t);
const S = (id, setup, share) => ({ id, setup, share: share === undefined ? 100 : share });
// the championship of the design board: 5 rounds and 16 sessions (round 3 has a sprint), 8 drivers in 3 teams, the fastest lap gives 1 point, the worst result of 5 rounds does not count
const SETUPS = [{ id: 'prac', name: 'Practice 10 minutes', sessionType: 'practice' }, { id: 'qual', name: 'Qualifying 5 minutes', sessionType: 'qualifying' }, { id: 'spr', name: 'Sprint 8 laps', sessionType: 'race' },
  { id: 'feat', name: 'Feature race 20 laps', sessionType: 'race' }, { id: 'tok', name: 'Club night tokens', sessionType: 'tokens' }];
const TRACKS = [{ id: 't1', name: 'Zandvoort' }, { id: 't2', name: 'Spa' }];
const three = r => [S(r + 'a', 'prac'), S(r + 'b', 'qual'), S(r + 'c', 'feat')];
const board = (o = {}) => C.clean({ id: 'c1', name: 'Thursday Cup 2026', rounds: [
  { id: 'r1', name: 'Season opener', track: 't1', sessions: three('1') }, { id: 'r2', name: 'Night race', track: 't1', sessions: three('2') },
  { id: 'r3', name: 'Sprint night', track: 't2', sessions: [S('3a', 'prac'), S('3b', 'qual'), S('3c', 'spr', 50), S('3d', 'feat')] },
  { id: 'r4', name: 'Mountain loop', track: 't2', sessions: three('4') }, { id: 'r5', name: 'Final', track: 't1', sessions: three('5') }],
  roster: [['d1', 'tm1'], ['d2', 'tm1'], ['d3', 'tm2'], ['d4', 'tm2'], ['d5', 'tm3'], ['d6', 'tm3'], ['d7', ''], ['d8', 'tm3']].map(([driver, team]) => ({ driver, team, from: 1 })),
  bonusFast: 1, drops: 1, ...o }, true);
// the saved sessions: the first n sessions of the championship in the order of the rounds
const drivenFirst = (c, n) => c.rounds.flatMap(r => r.sessions.map(s => ({ id: 'x' + r.id + s.id, date: '2026-09-01', champ: { id: c.id, roundId: r.id, sessionId: s.id } }))).slice(0, n);
const ctx = (c, n, o = {}) => ({ setups: SETUPS, tracks: TRACKS, sessions: drivenFirst(c, n || 0), id: c.id, ...o });

// ---- the design board ----
{ const c = board(), x = ctx(c, 6), d = W.describe(c, x);
  ok('the pills: the round that is next stands out, then the rounds, the sessions, the drivers and what the dropped results leave', JSON.stringify(d.pills) === JSON.stringify([{ text: 'Round 3 is next', tone: 'hi' }, { text: '5 rounds', tone: '' }, { text: '16 sessions', tone: '' }, { text: '8 drivers', tone: '' }, { text: 'Best 4 of 5 count', tone: '' }]));
  ok('the sentence reads the championship back: the size, what was driven, the points, the bonus, the dropped results, the sprint and the tie',
    text(d.say) === 'Thursday Cup 2026 has 5 rounds with 16 sessions, and 8 drivers in the roster. 6 sessions are driven; round 3 is next. Only a race gives points: 25, 18, 15, 12, 10, 8, 6, 4, 2 and 1 for the first 10. The fastest lap of a driver who finishes in the first 10 gives 1 more point. Best 4 of 5 rounds count. A sprint gives half the points, rounded to the nearest. A tie goes to the driver with the most wins.');
  ok('...the numbers and the names in it are bold, the rest is not', JSON.stringify(bold(d.say)) === JSON.stringify(['Thursday Cup 2026', '5 rounds', '16 sessions', '8 drivers', '6', 'round 3', '25, 18, 15, 12, 10, 8, 6, 4, 2 and 1', '10', '1', 'Best 4 of 5 rounds', 'rounded to the nearest']));
  ok('...a championship with a name and nothing to look at is ready to use', d.ready.ok === true && d.ready.text === 'Ready to use');
  ok('the box under the rail: 6 of 16 sessions, the round that is next, and the bar (37.5 percent)', JSON.stringify(d.driven) === JSON.stringify({ head: '6 of 16 sessions', note: 'Round 3 is next. It shows on the Home tab.', pct: 37.5, state: 'busy' }));
  const r = W.rail(c, x);
  ok('the rail: a note for every section, the same words on the row of a closed section', JSON.stringify(Object.keys(r)) === JSON.stringify(['rounds', 'points', 'roster', 'bonus', 'drops', 'teams']) && Object.values(r).every(v => v.row === v.rail));
  ok('...rounds and sessions, the table, the roster, the bonus, the dropped results and the teams', r.rounds.rail === '5 rounds · 16 sessions' && r.points.rail === '25-18-15-12-10-8-6-4-2-1' && r.roster.rail === '8 drivers · 3 teams' && r.bonus.rail === 'Fastest lap +1' && r.drops.rail === 'Best 4 of 5 count' && r.teams.rail === 'Standard');
  ok('...the dots: filled in is green, the standard teams are an open ring', ['rounds', 'points', 'roster', 'bonus', 'drops'].every(k => r[k].state === 'ok') && r.teams.state === 'plain'); }

// ---- the name, the rounds and what is not right ----
{ const c = board();
  ok('without a name the status says so, and a name of spaces is no name', W.describe({ ...c, name: '' }, ctx(c)).ready.text === 'Give it a name' && W.describe({ ...c, name: '   ' }, ctx(c)).ready.text === 'Give it a name' && W.describe({ ...c, name: '' }, ctx(c)).ready.ok === false);
  ok('...and the sentence calls it "This championship"', text(W.describe({ ...c, name: '' }, ctx(c)).say).startsWith('This championship has 5 rounds'));
  const none = { ...c, rounds: [], roster: [] };
  ok('without rounds: "Add a round", no rounds in the pills and a sentence that asks for one', W.describe(none, ctx(c)).ready.text === 'Add a round' && W.describe(none, ctx(c)).pills[0].text === '0 rounds' && text(W.describe(none, ctx(c)).say).startsWith('Thursday Cup 2026 has no rounds yet. Add a round. Only a race gives points'));
  const bad = C.clean({ ...c, rounds: [...c.rounds.slice(0, 4), { id: 'r5', name: 'Final', sessions: [] }] }, true);
  ok('a round with no sessions is a thing to look at: the status counts it, the round needs a look, the dot of Rounds is amber', W.describe(bad, ctx(bad)).ready.text === '1 thing to look at' && W.describe(bad, ctx(bad)).ready.ok === false && JSON.stringify(W.looks(bad, ctx(bad))) === '[false,false,false,false,true]' && W.rail(bad, ctx(bad)).rounds.state === 'todo');
  ok('...and the remarks are the ones of the list of championships', JSON.stringify(W.remarks(bad, ctx(bad))) === JSON.stringify(C.problems(bad, { setups: SETUPS, tracks: TRACKS })) && W.remarks(bad, ctx(bad))[0] === 'Round 5 has no sessions.');
  const many = C.clean({ ...c, rounds: [{ id: 'r1', sessions: [S('a', ''), S('b', 'tok'), S('c', 'gone')] }, { id: 'r2', track: 'lost', sessions: [S('d', 'feat')] }] }, true);
  ok('a session with no race setup, a Time Token Session, a race setup that is gone, a session with no track and a track that is gone each need a look; the status counts the remarks', W.remarks(many, ctx(many)).length === 5 && W.describe(many, ctx(many)).ready.text === '5 things to look at' && JSON.stringify(W.looks(many, ctx(many))) === '[true,true]');
  const mixed = n => C.clean({ ...c, rounds: [{ id: 'r1', track: 't1', sessions: n === 'first' ? [S('a', 'tok'), S('b', 'feat')] : n === 'second' ? [S('a', 'feat'), S('b', 'tok')] : [S('a', 'feat'), S('b', 'qual')] }] }, true);
  ok('a round with one good session and one that is not right needs a look, whichever of the two it is; two good sessions do not', JSON.stringify(['first', 'second', 'good'].map(n => W.looks(mixed(n), ctx(mixed(n))))) === '[[true],[true],[false]]');
  ok('a round needs a look exactly when the list of championships has something to say about it', [board(), bad, many, C.clean({ ...c, rounds: [{ id: 'r1', sessions: [S('a', 'tok')] }] }, true)].every(x => W.looks(x, ctx(x)).some(Boolean) === (C.problems(x, { setups: SETUPS, tracks: TRACKS }).length > 0)));
  ok('the dot of Rounds is amber for a championship without rounds', W.rail(none, ctx(c)).rounds.state === 'todo' && W.rail(none, ctx(c)).rounds.rail === 'No rounds yet');
  ok('the pill of a round: Done, Next, To do; a round that needs a look says so, whatever its state', JSON.stringify([W.roundPill('done', false), W.roundPill('next', false), W.roundPill('todo', false), W.roundPill('empty', false), W.roundPill('done', true), W.roundPill('empty', true)])
    === JSON.stringify([{ text: 'Done', tone: 'done' }, { text: 'Next', tone: 'next' }, { text: 'To do', tone: 'todo' }, null, { text: 'Needs a look', tone: 'warn' }, { text: 'Needs a look', tone: 'warn' }])); }

// ---- what was driven ----
{ const c = board();
  ok('nothing driven: the first round is next, and the box says 0 of 16', W.describe(c, ctx(c, 0)).pills[0].text === 'Round 1 is next' && W.describe(c, ctx(c, 0)).driven.head === '0 of 16 sessions' && W.describe(c, ctx(c, 0)).driven.pct === 0 && !/driven;/.test(text(W.describe(c, ctx(c, 0)).say)));
  ok('one session driven: "1 session is driven"', /\b1 session is driven; round 1 is next\./.test(text(W.describe(c, ctx(c, 1)).say)));
  ok('everything driven: Finished, "All 16 sessions are driven" and a full bar', W.describe(c, ctx(c, 16)).pills[0].text === 'Finished' && W.describe(c, ctx(c, 16)).pills[0].tone === 'hi' && text(W.describe(c, ctx(c, 16)).say).includes('All 16 sessions are driven.') && JSON.stringify(W.describe(c, ctx(c, 16)).driven) === JSON.stringify({ head: 'All 16 sessions driven', note: 'The championship is finished.', pct: 100, state: 'done' }));
  ok('the editor draft has no id of its own (the saved id comes in with the lists): what was driven is still found', W.describe({ ...c, id: undefined }, ctx(c, 6)).driven.head === '6 of 16 sessions' && W.describe({ ...c, id: undefined }, ctx(c, 6)).pills[0].text === 'Round 3 is next');
  ok('a championship that is not saved yet says that it shows on Home once it is', W.describe(c, ctx(c, 0, { saved: false })).driven.note === 'Round 1 is next. Save the championship and it shows on the Home tab.');
  ok('no sessions at all: "No sessions yet", the first pill is the rounds, and the sentence has no driven part', JSON.stringify(W.describe(C.blank(), ctx(c)).driven) === JSON.stringify({ head: 'No sessions yet', note: 'Add a session to a round.', pct: 0, state: 'none' }) && W.describe(C.blank(), ctx(c)).pills[0].text === '1 round' && W.describe(C.blank(), ctx(c)).pills[0].tone === 'hi');
  ok('sessions of another championship, or set to "do not count", are not driven', W.describe(c, { ...ctx(c, 3), id: 'other' }).driven.head === '0 of 16 sessions' && W.describe(c, { ...ctx(c, 3), sessions: drivenFirst(c, 3).map(s => ({ ...s, champ: { ...s.champ, off: true } })) }).driven.head === '0 of 16 sessions'); }

// ---- the points ----
{ const c = board({ bonusFast: 0, drops: 0 }), words = o => text(W.describe({ ...c, ...o }, ctx(c)).say), rail = o => W.rail({ ...c, ...o }, ctx(c));
  ok('a table of eight places, one place, and a table of twelve (the first ten and "2 more")', words({ points: [10, 8, 6, 5, 4, 3, 2, 1] }).includes('10, 8, 6, 5, 4, 3, 2 and 1 for the first 8.') && words({ points: [5] }).includes('Only a race gives points: 5 for the winner.') && words({ points: [20, 18, 16, 14, 12, 10, 8, 6, 4, 2, 1, 1] }).includes('20, 18, 16, 14, 12, 10, 8, 6, 4, 2 and 2 more for the first 12.'));
  ok('one point per car beaten', words({ pointsMode: 'beaten' }).includes('Only a race gives points: one point for every car that finished behind a driver.') && rail({ pointsMode: 'beaten' }).points.rail === 'One point per car beaten');
  ok('points for the rest: "Every other finisher gets 1 point" (2 points), and not for one point per car beaten', words({ pointsRest: 1 }).includes('Every other finisher gets 1 point.') && words({ pointsRest: 2 }).includes('Every other finisher gets 2 points.') && !words({ pointsMode: 'beaten', pointsRest: 2 }).includes('Every other finisher'));
  ok('the table on the rail: a short one in full, one of your own the same, a long one cut off', rail({ points: [10, 8, 6, 5, 4, 3, 2, 1] }).points.rail === '10-8-6-5-4-3-2-1' && rail({ points: [30, 18, 17.56] }).points.rail === '30-18-17.56'
    && rail({ points: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }).points.rail === '1-2-3-4-5-6-7-8-... (12 places)' && W.tableText(c) === '25-18-15-12-10-8-6-4-2-1');
  ok('the bonus points: each has a sentence with its number, "1 more point" and "2 more points"; nothing for 0', words({ bonusFast: 1, bonusFastTop: 3 }).includes('The fastest lap of a driver who finishes in the first 3 gives 1 more point.') && words({ bonusPole: 2 }).includes('The pole position gives 2 more points.') && words({ bonusStart: 0.5 }).includes('Starting the race gives every driver 0.5 more points.') && words({ bonusStart: 1, bonusPole: 2 }).includes('Starting the race gives every driver 1 more point.')
    && !/more point/.test(words({})));
  ok('...and on the rail: Fastest lap +1 · Pole +2 · Start +0.5, or "No bonus points" (an open ring)', rail({ bonusFast: 1, bonusPole: 2, bonusStart: 0.5 }).bonus.rail === 'Fastest lap +1 · Pole +2 · Start +0.5' && rail({ bonusFast: 1 }).bonus.state === 'ok' && rail({}).bonus.rail === 'No bonus points' && rail({}).bonus.state === 'plain' && JSON.stringify(W.bonusBits({ bonusFast: 0, bonusPole: 0, bonusStart: 0 })) === '[]'); }

// ---- the dropped results ----
{ const c = board({ drops: 0 }), races = o => ({ ...c, ...o });
  ok('every round counts with no dropped results (the sentence says so, the rail has an open ring, there is no pill)', W.dropSaid(c, ctx(c)) === 'Every round counts.' && text(W.describe(c, ctx(c)).say).includes('Every round counts.') && W.rail(c, ctx(c)).drops.rail === 'Every round counts' && W.rail(c, ctx(c)).drops.state === 'plain' && !W.describe(c, ctx(c)).pills.some(p => /count$/.test(p.text)));
  ok('the best 4 of 5 rounds count with one dropped result; 3 of 5 with two', W.dropSaid(races({ drops: 1 }), ctx(c)) === 'Best 4 of 5 rounds count.' && W.dropSaid(races({ drops: 2 }), ctx(c)) === 'Best 3 of 5 rounds count.' && W.rail(races({ drops: 2 }), ctx(c)).drops.rail === 'Best 3 of 5 count' && W.rail(races({ drops: 2 }), ctx(c)).drops.state === 'ok');
  ok('at least one round always counts (ten dropped of 5): in the sentence, in the pill and on the rail', W.dropSaid(races({ drops: 10 }), ctx(c)) === 'Best 1 of 5 rounds count.' && W.describe(races({ drops: 10 }), ctx(c)).pills.some(p => p.text === 'Best 1 of 5 count') && W.rail(races({ drops: 10 }), ctx(c)).drops.rail === 'Best 1 of 5 count');
  ok('only a round with a race that counts for points is counted (a round of practice and qualifying is not, nor a race that counts for nothing)', (() => { const x = races({ drops: 1, rounds: [{ id: 'a', sessions: [S('1', 'prac'), S('2', 'qual')] }, { id: 'b', sessions: [S('3', 'feat', 0)] }, { id: 'c', sessions: [S('4', 'feat')] }, { id: 'd', sessions: [S('5', 'spr', 50)] }] }); return W.raceRounds(x, SETUPS) === 2 && W.dropSaid(x, ctx(c)) === 'Best 1 of 2 rounds count.'; })());
  ok('with no race in the rounds yet there is nothing to count: the sentence says so, the rail says how many are dropped', (() => { const x = races({ drops: 1, rounds: [{ id: 'a', sessions: [S('1', 'prac')] }] }); return W.dropSaid(x, ctx(c)) === 'The best results count (there is no race in the rounds yet).' && W.rail(x, ctx(c)).drops.rail === '1 worst result dropped' && W.rail(races({ drops: 2, rounds: [] }), ctx(c)).drops.rail === '2 worst results dropped' && !W.describe(x, ctx(c)).pills.some(p => /^Best/.test(p.text)); })());
  ok('the setups are not known (nothing passed in): no race is found, and nothing breaks', W.raceRounds(races({}), undefined) === 0 && W.dropSaid(races({ drops: 1 })) === 'The best results count (there is no race in the rounds yet).' && typeof W.describe(races({})).say[0].t === 'string'); }

// ---- the teams, the ties and the sprint ----
{ const c = board({ drops: 0, bonusFast: 0 }), words = o => text(W.describe({ ...c, ...o }, ctx(c)).say), rail = o => W.rail({ ...c, ...o }, ctx(c));
  ok('the standard says nothing about the teams, and the tie goes to the most wins', !/team/i.test(words({}).replace('Thursday Cup', '')) && words({}).endsWith('A tie goes to the driver with the most wins.'));
  ok('team points: all the drivers, no team standings, or another number of drivers that count', words({ teamMode: 'all' }).includes('All the drivers of a team add points to the team.') && words({ teamMode: 'none' }).includes('There are no team standings.') && words({ teamBest: 3 }).includes('The best 3 drivers of a team count.') && words({ teamBest: 1 }).includes('The best 1 driver of a team count.') && !words({ teamBest: 2 }).includes('of a team count'));
  ok('...the number that counts only matters when the best drivers count', !words({ teamMode: 'all', teamBest: 3 }).includes('The best 3') && !words({ teamMode: 'none', teamBest: 3 }).includes('The best 3'));
  ok('the tie: the best result of the last round, or the best qualifying results', words({ tie: 'last' }).includes('A tie goes to the driver with the best result of the last round.') && words({ tie: 'qual' }).includes('A tie goes to the driver with the best qualifying results.') && words({ tie: 'zzz' }).includes('the most wins'));
  ok('the sprint: a sentence only when a race is a sprint, with the way it is rounded', words({}).includes('A sprint gives half the points, rounded to the nearest.') && words({ sprintRound: 'up' }).includes('rounded up.') && words({ sprintRound: 'down' }).includes('rounded down.') && words({ sprintRound: 'none' }).includes('not rounded.'));
  const noSprint = { rounds: board().rounds.map(r => ({ ...r, sessions: r.sessions.map(s => ({ ...s, share: 100 })) })) };
  ok('...with no sprint in the rounds there is no sentence about it, and a sprint of a practice does not count', !words(noSprint).includes('A sprint') && !words({ rounds: [{ id: 'a', sessions: [S('1', 'prac', 50)] }] }).includes('A sprint'));
  ok('a rounding that is not one of the four is said as the nearest (it can not happen after clean, but the words do not break)', words({ sprintRound: 'zzz' }).includes('A sprint gives half the points, rounded to the nearest.'));
  ok('a driver who is not in the roster is no guest when the rule is off', words({ guestRule: false }).includes('A driver who is not in the roster is not a guest: nobody moves up.') && !words({}).includes('not a guest'));
  ok('on the rail: nothing changed is "Standard" (an open ring); what is changed is said, the first two and "+1 more"', rail({}).teams.rail === 'Standard' && rail({ teamMode: 'all' }).teams.rail === 'All drivers count' && rail({ teamMode: 'all' }).teams.state === 'ok' && rail({ teamMode: 'none', tie: 'last' }).teams.rail === 'No team standings · Tie: last round'
    && rail({ teamMode: 'all', tie: 'qual', sprintRound: 'down' }).teams.rail === 'All drivers count · Tie: qualifying · +1 more');
  ok('...each rule that is not the standard is in the list, in the order of the page', JSON.stringify(W.teamBits({ ...c, teamMode: 'best', teamBest: 3, teamRace: 'split', teamMin: 30, tie: 'last', sprintRound: 'up' })) === JSON.stringify(['Best 3 count', 'Shared by laps', 'At least 30% of laps', 'Tie: last round', 'Sprint rounded up'])
    && JSON.stringify(W.teamBits({ ...c, teamRace: 'team', teamMin: 30, sprintRound: 'none' })) === JSON.stringify(['Team only', 'Sprint not rounded']) && JSON.stringify(W.teamBits({ ...c, teamBest: 3, teamMode: 'all' })) === JSON.stringify(['All drivers count'])); }

// ---- the roster ----
{ const c = board(), rail = o => W.rail({ ...c, ...o }, ctx(c));
  ok('the roster: drivers and teams, one driver and no team, and nobody (an open ring, and the pill says so)', rail({}).roster.rail === '8 drivers · 3 teams' && rail({ roster: [{ driver: 'd1', team: '', from: 1 }] }).roster.rail === '1 driver' && rail({ roster: [{ driver: 'd1', team: 'tm1', from: 1 }] }).roster.rail === '1 driver · 1 team'
    && rail({ roster: [] }).roster.rail === 'No drivers yet' && rail({ roster: [] }).roster.state === 'plain' && W.describe({ ...c, roster: [] }, ctx(c)).pills[3].text === 'No drivers yet' && text(W.describe({ ...c, roster: [] }, ctx(c)).say).includes('with 16 sessions, and no drivers in the roster yet.'));
  ok('a team is counted once, and a driver with no team is in no team', rail({ roster: [{ driver: 'd1', team: 'tm1', from: 1 }, { driver: 'd2', team: 'tm1', from: 1 }, { driver: 'd3', team: '', from: 1 }] }).roster.rail === '3 drivers · 1 team'); }

// ---- it only reads ----
{ const c = board(), before = JSON.stringify(c), x = ctx(c, 6), xb = JSON.stringify(x);
  W.describe(c, x); W.rail(c, x); W.remarks(c, x); W.looks(c, x); W.dropSaid(c, x); W.teamBits(c); W.bonusBits(c); W.tableText(c);
  ok('the words do not change the championship or what they are given', JSON.stringify(c) === before && JSON.stringify(x) === xb);
  ok('a championship without anything in it still has words (no names, no lists, no number)', (() => { const e = C.blank(); const d = W.describe(e), r = W.rail(e); return d.say.length > 0 && d.pills.length === 3 && r.rounds.rail === '1 round · 0 sessions' && typeof d.ready.text === 'string'; })());
  ok('joinAnd: one, two, three, many', W.joinAnd(['a']) === 'a' && W.joinAnd(['a', 'b']) === 'a and b' && W.joinAnd(['a', 'b', 'c']) === 'a, b and c' && W.joinAnd(['a', 'b', 'c', 'd', 'e'], 3) === 'a, b, c and 2 more'); }

if (fails) { console.log(fails + ' CHAMPIONSHIP WORDS TESTS FAILED'); process.exit(1); } else console.log('ALL CHAMPIONSHIP WORDS TESTS PASSED');
