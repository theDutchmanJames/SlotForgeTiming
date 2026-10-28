// 1.57.0: championship points for a race of teams (an Endurance Race, a heat race for teams): the team gets the points of its place once (Teams standings), the drivers who drove for it get
// points in the Drivers standings by the rule teamRace ('every' | 'split' | 'team') and teamMin (a minimum share of the laps of the team), the bonuses go to the team and to the driver who earned them.
const C = require('../renderer/championship.js'), P = require('../renderer/champpoints.js');
let fails = 0; const ok = (n, c) => { if (c) console.log('ok  ', n); else { console.log('FAIL', n); fails++; } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const setups = [{ id: 'sp', name: 'Practice', sessionType: 'practice' }, { id: 'sq', name: 'Qualifying', sessionType: 'qualifying' }, { id: 'sr', name: 'Race', sessionType: 'race' }, { id: 'se', name: 'Day race', sessionType: 'endurance' }];
const ctx = { setups, tracks: [{ id: 't1', name: 'Brands Hatch' }] };

// five drivers: a and c in team T1, b and d in team T2, e in team T3; two rounds of qualifying (session 0) + an Endurance Race (session 1)
const champ = (over, n, share) => C.clean({ name: 'Cup', rounds: Array.from({ length: n || 2 }, (_, i) => ({ name: 'Round ' + (i + 1), track: 't1', sessions: [{ setup: 'sq' }, { setup: 'se', share: share === undefined ? 100 : share }] })),
  roster: [{ driver: 'a', team: 'T1' }, { driver: 'b', team: 'T2' }, { driver: 'c', team: 'T1' }, { driver: 'd', team: 'T2' }, { driver: 'e', team: 'T3' }], ...(over || {}), id: 'c1' }, true);
const withRule = (c, key, v) => C.setRule(c, key, v).rec;
const R = (pos, id, best, extra) => ({ pos, driverId: id, driverName: id.toUpperCase(), carId: 'car' + id, laps: 10, best: best === undefined ? 9000 + pos : best, total: 100000 + pos, ...(extra || {}) });
const D = (id, laps, ms) => ({ driverId: id, driverName: id.toUpperCase(), laps, ...(ms !== undefined ? { ms } : {}) });
// a team row as it is saved: the team is the row, with the drivers who drove for it; bestBy = the driver who set the best lap of the team
const T = (pos, tid, ds, extra) => ({ pos, driverId: '', driverName: 'Team ' + tid, asTeam: true, teamId: tid, teamName: 'Team ' + tid, carId: 'car' + tid, laps: ds.reduce((a, d) => a + d.laps, 0), best: 9000 + pos, total: null, bestBy: ds.length ? ds[0].driverId : '', drivers: ds, ...(extra || {}) });
let sid = 0;
const S = (c, ri, si, rows, o) => { o = o || {}; const n = ++sid, tag = C.tagOf(c, ri, si, ctx);
  return { id: 's' + n, date: o.date || `2026-10-${String(10 + n).padStart(2, '0')}T12:00:00.000Z`, standings: rows, champ: { ...tag, ...(o.awarded === false ? {} : { awarded: '2026-10-20T10:00:00.000Z' }), ...(o.off ? { off: true } : {}) } }; };
const trace = (c, ri, rows, o) => S(c, ri, 1, rows, o);
const quali = (c, ri, ids) => S(c, ri, 0, ids.map((id, i) => R(i + 1, id, 8000 + i * 100)));
const rowsOf = [() => [T(1, 'T1', [D('a', 30), D('c', 20)]), T(2, 'T2', [D('b', 25), D('d', 25)]), T(3, 'T3', [D('e', 40)])]][0];
const pts = res => res.rows.map(x => x.pts).join();
const mem = (res, i) => res.rows[i].members.map(m => m.driverId + ':' + m.pts).join();
const contrib = res => [...res.contrib.entries()].map(([k, v]) => k + ':' + v.pts).sort().join();
const pl = a => Array.from(a, v => v || 0); // (a list of places has holes: no 1st place, say)
const dtot = (st, id) => st.drivers.find(d => d.id === id).total;
const ttot = (st, id) => st.teams.find(t => t.id === id).total;

// ---------- the rules in the record ----------
{ const b = C.blank();
  ok('a new championship: a race of teams gives every driver who drove the points of the place, with no minimum share of the laps', b.teamRace === 'every' && b.teamMin === 0 && C.RULE_DEFAULTS.teamRace === 'every' && C.RULE_DEFAULTS.teamMin === 0 && same(C.TEAM_RACES, ['every', 'split', 'team']));
  ok('...an old record (without the rules) gets the defaults, cleaning a clean record changes nothing', C.clean({ name: 'Old', rounds: [], roster: [] }).teamRace === 'every' && C.clean({ name: 'Old' }).teamMin === 0 && same(C.clean(b, true), { ...b }));
  ok('clean: teamRace is one of the three kinds, teamMin is a whole number from 0 to 100', C.clean({ teamRace: 'split' }).teamRace === 'split' && C.clean({ teamRace: 'team' }).teamRace === 'team' && C.clean({ teamRace: 'zzz' }).teamRace === 'every'
    && C.clean({ teamMin: 25 }).teamMin === 25 && C.clean({ teamMin: 250 }).teamMin === 100 && C.clean({ teamMin: -4 }).teamMin === 0 && C.clean({ teamMin: 33.9 }).teamMin === 33 && C.clean({ teamMin: 'x' }).teamMin === 0);
  ok('setRule: the two new rules are rules (a number that is not one and a kind that is not one are refused), the old record is left alone', C.setRule(b, 'teamRace', 'split').rec.teamRace === 'split' && C.setRule(b, 'teamRace', 'zzz').error && C.setRule(b, 'teamMin', '40').rec.teamMin === 40
    && C.setRule(b, 'teamMin', 'x').error && C.setRule(b, 'teamMin', 500).rec.teamMin === 100 && C.setRule({ ...b, id: 'k1' }, 'teamMin', 5).rec.id === 'k1' && b.teamRace === 'every' && b.teamMin === 0);
  ok('...they are told in words', /every driver who drove/.test(P.teamRaceText(b)) && /share these points by their laps/.test(P.teamRaceText(withRule(b, 'teamRace', 'split'))) && /get no points/.test(P.teamRaceText(withRule(b, 'teamRace', 'team')))
    && !/less than/.test(P.teamRaceText(b)) && /less than 40% of the laps of his team gets nothing/.test(P.teamRaceText(withRule(b, 'teamMin', 40))) && !/less than/.test(P.teamRaceText(withRule(b, 'teamMin', 40), true)) && !/less than/.test(P.teamRaceText(withRule(withRule(b, 'teamMin', 40), 'teamRace', 'team')))); }

// ---------- what a race of teams gives ----------
{ const c = champ(), s = trace(c, 0, rowsOf()), r = P.sessionResult(c, s, null);
  ok('a race of teams is a race result: the teams are the entrants, in the order of the result, with the points of the table', r.ok && r.rows.length === 3 && r.rows.map(x => x.kind).join() === 'team,team,team' && r.rows.map(x => x.name).join() === 'Team T1,Team T2,Team T3' && pts(r) === '25,18,15' && r.rows.map(x => x.place).join() === '1,2,3');
  ok('...every driver who drove for a team gets the points of its place (rule "every")', mem(r, 0) === 'a:25,c:25' && mem(r, 1) === 'b:18,d:18' && mem(r, 2) === 'e:15' && contrib(r) === 'a:25,b:18,c:25,d:18,e:15');
  ok('...the members are the drivers of the row, with the laps they drove', r.rows[0].members.map(m => m.laps).join() === '30,20' && r.rows[0].members.map(m => m.name).join() === 'A,C' && r.rows[0].teamId === 'T1' && r.rows[0].driverId === '');
  ok('...the places count for the tie rule: both drivers of the winning team have a win', same(r.contrib.get('a').places, [1]) && same(r.contrib.get('c').places, [1]) && same(r.contrib.get('e').places, [3]));
  const st = P.standings(c, [s], ctx);
  ok('the Drivers standings have the points of every driver who drove (the order of the roster decides between level drivers: A, C, B, D)', st.drivers.map(d => d.id + ':' + d.total).join() === 'a:25,c:25,b:18,d:18,e:15');
  ok('...the Teams standings have the points of the place once (not the sum of the drivers)', st.teams.map(t => t.id + ':' + t.total).join() === 'T1:25,T2:18,T3:15' && st.teamRaces === 1);
  ok('...the team places are counted once (a win of the team is one win, not one for every driver); the places of the drivers are their own', same(st.teams[0].places, [1]) && same(st.drivers.find(d => d.id === 'a').places, [1]) && st.drivers.find(d => d.id === 'a').wins === 1 && st.teams.find(t => t.id === 'T3').places[2] === 1);
  ok('...the winner of the round is the team', st.board[0].winner === 'Team T1' && st.board[0].winnerTeam === true && st.board[0].winnerId === 'T1' && st.board[0].decided && !st.board[1].decided);
  const beaten = C.applyPreset(c, 'beaten').rec;
  ok('one point per car beaten counts the teams that were beaten: the winner of three teams gets 2', pts(P.sessionResult(beaten, trace(beaten, 0, rowsOf()), null)) === '2,1,0'); }

// ---------- how the drivers share ----------
{ const c0 = champ(), split = withRule(c0, 'teamRace', 'split'), only = withRule(c0, 'teamRace', 'team');
  const rs = P.sessionResult(split, trace(split, 0, rowsOf()), null);
  ok('"split": the drivers who drove share the points of the place by their laps (A 30 of 50 laps gets 15, C gets 10), the team gets all 25', pts(rs) === '25,18,15' && mem(rs, 0) === 'a:15,c:10' && mem(rs, 1) === 'b:9,d:9' && mem(rs, 2) === 'e:15');
  ok('...the standings: the drivers have their share, the team has the whole', dtot(P.standings(split, [trace(split, 0, rowsOf())], ctx), 'a') === 15 && ttot(P.standings(split, [trace(split, 0, rowsOf())], ctx), 'T1') === 25);
  const ro = P.sessionResult(only, trace(only, 0, rowsOf()), null), sto = P.standings(only, [trace(only, 0, rowsOf())], ctx);
  ok('"team": only the team gets points; the drivers who drove are in the row and get none', pts(ro) === '25,18,15' && mem(ro, 0) === 'a:0,c:0' && ro.rows[0].members.every(m => m.noPoints === true) && ro.contrib.size === 0);
  ok('...the Drivers standings have nothing from it, the Teams standings have the points', sto.drivers.every(d => d.total === 0) && sto.teams.map(t => t.total).join() === '25,18,15');
  ok('...no driver has a win from a race of teams that gives the drivers nothing', sto.drivers.every(d => d.wins === 0 && d.places.length === 0) && same(sto.teams[0].places, [1]));
  // a minimum share of the laps of the team
  const min = withRule(c0, 'teamMin', 50), rm = P.sessionResult(min, trace(min, 0, rowsOf()), null);
  ok('a minimum share of the laps: C drove 40% of the laps of Team T1 and gets nothing under 50%; A (60%) and B and D (exactly 50%) get the points', mem(rm, 0) === 'a:25,c:0' && mem(rm, 1) === 'b:18,d:18' && rm.rows[0].members[1].short === true && rm.rows[0].members[0].short === false && pts(rm) === '25,18,15');
  ok('...the team still gets all of its points, and the driver who did not drive enough has nothing in the standings', ttot(P.standings(min, [trace(min, 0, rowsOf())], ctx), 'T1') === 25 && dtot(P.standings(min, [trace(min, 0, rowsOf())], ctx), 'c') === 0 && !rm.contrib.has('c'));
  const ms = withRule(withRule(c0, 'teamMin', 50), 'teamRace', 'split'), rms = P.sessionResult(ms, trace(ms, 0, rowsOf()), null);
  ok('...with "split" the ones who drove enough share the points (A is the only one, so A gets all 25)', mem(rms, 0) === 'a:25,c:0' && mem(rms, 1) === 'b:9,d:9');
  ok('...a minimum of 0 asks nothing, a minimum of 100 asks for all the laps of the team', mem(P.sessionResult(withRule(c0, 'teamMin', 0), trace(c0, 0, rowsOf()), null), 0) === 'a:25,c:25' && mem(P.sessionResult(withRule(c0, 'teamMin', 100), trace(c0, 0, rowsOf()), null), 0) === 'a:0,c:0'
    && mem(P.sessionResult(withRule(c0, 'teamMin', 100), trace(c0, 0, [T(1, 'T1', [D('a', 30)])]), null), 0) === 'a:25');
  // who drove: laps, or time at the wheel
  const drove = trace(c0, 0, [T(1, 'T1', [D('a', 30), D('c', 0, 4000), D('x', 0)])]), rd = P.sessionResult(c0, drove, null);
  ok('a driver who has time at the wheel but no lap drove (he is in the row); a driver with neither did not', rd.rows[0].members.map(m => m.driverId).join() === 'a,c' && mem(rd, 0) === 'a:25,c:25');
  const rds = P.sessionResult(split, trace(split, 0, [T(1, 'T1', [D('a', 30), D('c', 0, 4000)])]), null);
  ok('...with "split" he shares by laps, so a driver with no lap gets no share', mem(rds, 0) === 'a:25,c:0');
  ok('a row of a team that has no drivers (an old save) gives the team its points and nobody else', mem(P.sessionResult(c0, trace(c0, 0, [{ ...T(1, 'T1', []), drivers: undefined }]), null), 0) === '' && pts(P.sessionResult(c0, trace(c0, 0, [{ ...T(1, 'T1', []), drivers: undefined }]), null)) === '25'); }

// ---------- the bonuses ----------
{ const c = withRule(withRule(withRule(champ(), 'bonusFast', 2), 'bonusPole', 3), 'bonusStart', 1);
  // qualifying: C is on pole (team T1); the race: T2 has the fastest lap, set by D
  const q = quali(c, 0, ['c', 'a', 'b', 'd', 'e']), rows = [T(1, 'T1', [D('a', 30), D('c', 20)], { best: 9001, bestBy: 'a' }), T(2, 'T2', [D('b', 25), D('d', 25)], { best: 8500, bestBy: 'd' }), T(3, 'T3', [D('e', 40)], { best: 9003, bestBy: 'e' })];
  const r = P.sessionResult(c, trace(c, 0, rows), q);
  ok('the pole bonus goes to the team of the pole sitter and to him (C), not to his team mate; the start bonus to every team and every driver who drove', r.rows[0].pole === 3 && r.rows[0].start === 1 && mem(r, 0) === 'a:26,c:29' && r.rows[0].members.map(m => m.pole).join() === '0,3' && r.rows[1].pole === 0 && r.rows[2].start === 1);
  ok('...the fastest lap bonus goes to the team that set the fastest lap and to the driver who set it (D), not to his team mate', r.rows[1].fastest === 2 && mem(r, 1) === 'b:19,d:21' && r.rows[1].members.map(m => m.fastest).join() === '0,2' && pts(r) === '29,21,16');
  ok('...the summaries: the fastest lap by D for Team T2, the pole by C for Team T1', r.fastest.driverId === 'd' && r.fastest.name === 'D' && r.fastest.team === 'Team T2' && r.fastest.got === true && r.fastest.shown === 2 && r.fastest.ms === 8500 && r.pole.driverId === 'c' && r.pole.team === 'Team T1' && r.pole.got === true);
  const st = P.standings(c, [q, trace(c, 0, rows)], ctx);
  ok('...the standings: the bonuses are in the points of the team and of the drivers who earned them; the fastest lap shows in the cell of D', ttot(st, 'T1') === 29 && ttot(st, 'T2') === 21 && dtot(st, 'd') === 21 && dtot(st, 'b') === 19 && st.drivers.find(d => d.id === 'd').cells[0].fast === true && st.drivers.find(d => d.id === 'b').cells[0].fast === false);
  const top1 = withRule(c, 'bonusFastTop', 1), rt = P.sessionResult(top1, trace(top1, 0, rows), q);
  ok('the fastest lap of a team outside the first places gives no bonus to anybody (the summary says so)', rt.rows[1].fastest === 0 && mem(rt, 1) === 'b:19,d:19' && rt.fastest.got === false && rt.fastest.team === 'Team T2');
  const old = P.sessionResult(c, trace(c, 0, rows.map(x => { const y = { ...x }; delete y.bestBy; return y; })), q);
  ok('a team row that does not say who set the best lap (an older save): the team gets the fastest lap bonus, no driver does', old.rows[1].fastest === 2 && old.rows[1].pts === 21 && mem(old, 1) === 'b:19,d:19' && old.fastest.driverId === '' && old.fastest.name === 'Team T2');
  const away = P.sessionResult(c, trace(c, 0, [rows[1], rows[2]].map((x, i) => ({ ...x, pos: i + 1 })), { awarded: true }), q);
  ok('a pole sitter whose team does not start the race: nobody gets the pole bonus', away.pole.got === false && away.rows.every(x => x.pole === 0) && away.rows[0].members.concat(away.rows[1].members).every(m => m.pole === 0));
  const few = P.sessionResult(c, trace(c, 0, [T(1, 'T1', [D('a', 30)], { best: 9001, bestBy: 'a' }), rows[1]]), q);
  ok('a pole sitter who did not drive in the race of his team: the team gets the pole bonus, he does not (nobody else gets it either)', few.rows[0].pole === 3 && few.rows[0].members.map(m => m.driverId + ':' + m.pole).join() === 'a:0');
  const dqRow = P.sessionResult(c, trace(c, 0, [T(1, 'T1', [D('a', 30), D('c', 20)], { dq: true }), rows[1], rows[2]]), q);
  ok('a team that was disqualified gets no points for its place, no start bonus and no pole bonus', dqRow.rows[0].pts === 0 && dqRow.rows[0].start === 0 && dqRow.rows[0].pole === 0 && dqRow.rows[0].out === true && dqRow.rows[0].outText === 'DQ' && dqRow.rows[1].place === 1 && dqRow.rows[1].base === 25 && mem(dqRow, 0) === 'a:0,c:0'); }

// ---------- a team that is out, guests ----------
{ const c = withRule(champ(), 'bonusStart', 1), rows = [T(1, 'T1', [D('a', 30), D('c', 20)]), T(2, 'T2', [D('b', 25), D('d', 25)], { retired: true }), T(3, 'T3', [D('e', 40)])];
  const r = P.sessionResult(c, trace(c, 0, rows), null);
  ok('a team that is out (retired) gets no points for its place and still the start bonus; the team behind it moves up a place', pts(r) === '26,1,19' && r.rows[1].place === 0 && r.rows[1].out === true && r.rows[1].outText === 'Out' && r.rows[2].place === 2 && mem(r, 1) === 'b:1,d:1');
  const g = [T(1, 'T1', [D('a', 30), D('c', 20)]), T(2, 'T9', [D('z', 10)]), T(3, 'T2', [D('b', 25), D('d', 25)])], cg = champ(), rg = P.sessionResult(cg, trace(cg, 0, g), null);
  ok('a team that is not in the championship is a guest: with the guest rule on it is not in the list and the team behind it moves up', rg.rows.map(x => x.name).join() === 'Team T1,Team T2' && pts(rg) === '25,18' && rg.guests.join() === 'Team T9');
  const co = withRule(cg, 'guestRule', false), ro = P.sessionResult(co, trace(co, 0, g), null);
  ok('...with the guest rule off it keeps its place and gets no points, nobody moves up (and nor do its drivers get points)', ro.rows.map(x => x.name).join() === 'Team T1,Team T9,Team T2' && pts(ro) === '25,0,15' && ro.rows[1].guest === true && mem(ro, 1) === 'z:0' && ro.rows[2].place === 3);
  const sg = P.standings(co, [trace(co, 0, g)], ctx);
  ok('...a guest team is not in the standings', sg.teams.map(t => t.id).join() === 'T1,T2,T3' && sg.drivers.every(d => d.id !== 'z') && ttot(sg, 'T2') === 15);
  const gd = P.sessionResult(cg, trace(cg, 0, [T(1, 'T1', [D('a', 30), D('z', 20)])]), null);
  ok('a guest who drove for a team of the championship gets no points; the team has its points, and his team mate his', pts(gd) === '25' && mem(gd, 0) === 'a:25,z:0' && gd.rows[0].members[1].guest === true && !gd.contrib.has('z'));
  const gs = P.sessionResult(withRule(cg, 'teamRace', 'split'), trace(cg, 0, [T(1, 'T1', [D('a', 30), D('z', 20)])]), null);
  ok('...with "split" his share is not given to anybody', mem(gs, 0) === 'a:15,z:0');
  const late = champ({ roster: [{ driver: 'a', team: 'T1' }, { driver: 'b', team: 'T2', from: 2 }] }), rl = P.sessionResult(late, trace(late, 0, [T(1, 'T2', [D('b', 10)]), T(2, 'T1', [D('a', 10)])]), null);
  ok('a team of which every driver joins in a later round is a guest until then', rl.rows.map(x => x.name).join() === 'Team T1' && rl.guests.join() === 'Team T2'); }

// ---------- edge cases ----------
{ const c = withRule(champ({ roster: [{ driver: 'a', team: 'T1' }, { driver: 'c', team: 'T1' }, { driver: 'b', team: 'T2' }, { driver: 'f', team: '' }] }), 'bonusPole', 3);
  // the pole sitter F has no team in the roster: the team of the qualifying row (T1) gets the pole bonus, and F did not drive
  const q = S(c, 0, 0, [R(1, 'f', 7000, { teamId: 'T1' }), R(2, 'a', 7100)]), r = P.sessionResult(c, trace(c, 0, [T(1, 'T1', [D('a', 10)]), T(2, 'T2', [D('b', 10)])]), q);
  ok('a pole sitter who has no team in the roster: the team that his qualifying row names gets the pole bonus (he did not drive for it, so he gets nothing)', r.rows[0].pole === 3 && r.rows[0].members[0].pole === 0 && r.pole.team === 'Team T1' && r.pole.got === true);
  const cg0 = withRule(c, 'guestRule', false), q2 = S(cg0, 0, 0, [R(1, 'f', 7000)]), r2 = P.sessionResult(cg0, trace(cg0, 0, [T(1, 'T1', [D('a', 10)]), { ...T(2, '', [D('b', 10)]), teamName: 'Nobody' }]), q2);
  ok('...a pole sitter with no team at all: no team gets the bonus (a team row without a team does not match him)', r2.rows.every(x => x.pole === 0) && r2.pole.team === '' && r2.pole.got === false);
  // the drivers of a team who only have time at the wheel: "split" has no laps to share by, so they share equally
  const split = withRule(champ(), 'teamRace', 'split'), ms = P.sessionResult(split, trace(split, 0, [T(1, 'T1', [D('a', 0, 4000), D('c', 0, 3000)])]), null);
  ok('"split" with drivers who have no laps (only time at the wheel): they share the points equally', mem(ms, 0) === 'a:12.5,c:12.5');
  const minMs = withRule(champ(), 'teamMin', 50), rmm = P.sessionResult(minMs, trace(minMs, 0, [T(1, 'T1', [D('a', 0, 4000), D('c', 0, 3000)])]), null);
  ok('a minimum share of the laps when the team has no lap at all: there is no share to ask for, everyone who drove gets the points', mem(rmm, 0) === 'a:25,c:25' && rmm.rows[0].members.every(m => !m.short));
  // a roster driver in a team that is a guest is a guest in that row
  const gt = withRule(champ(), 'guestRule', false), rg = P.sessionResult(gt, trace(gt, 0, [T(1, 'T9', [D('a', 10)]), T(2, 'T1', [D('c', 10)])]), null);
  ok('a driver of the roster who drove for a team that is not in the championship gets nothing, and is shown as a guest in that row', rg.rows[0].guest === true && rg.rows[0].members[0].guest === true && rg.rows[0].members[0].pts === 0 && !rg.contrib.has('a') && rg.rows[1].base === 18 && rg.rows[1].place === 2);
  // a late joiner: his place in a round before he joins does not count (no win)
  const late = champ({ roster: [{ driver: 'a', team: 'T1' }, { driver: 'b', team: 'T2', from: 2 }, { driver: 'c', team: 'T1' }] }), lg = withRule(late, 'guestRule', false);
  const sl = P.standings(lg, [trace(lg, 0, [T(1, 'T2', [D('b', 10)]), T(2, 'T1', [D('a', 10)])])], ctx), sl2 = P.standings(lg, [trace(lg, 0, [R(1, 'b'), R(2, 'a')])], ctx);
  ok('a driver who joins in round 2 and drove for a team in round 1 (a guest then): no points, and no win or place for the tie rule', sl.drivers.find(d => d.id === 'b').wins === 0 && sl.drivers.find(d => d.id === 'b').places.length === 0 && dtot(sl, 'b') === 0 && ttot(sl, 'T2') === 0 && sl.teams.find(t => t.id === 'T2').places.length === 0);
  ok('...also when he raced alone in round 1: his place does not count for the tie rule', sl2.drivers.find(d => d.id === 'b').wins === 0 && sl2.drivers.find(d => d.id === 'b').places.length === 0 && dtot(sl2, 'a') === 18);
  // a team with a team row and a single driver in the same race: both count
  const mix = trace(c, 0, [T(1, 'T1', [D('a', 10)]), R(2, 'c'), R(3, 'b')]), sm = P.standings(c, [mix], ctx);
  ok('a team with a row of its own and a driver of the same team racing alone in the same race: the points of the team row and of the driver add up (25 and 18)', ttot(sm, 'T1') === 43 && dtot(sm, 'a') === 25 && dtot(sm, 'c') === 18);
  const two = P.sessionResult(split, trace(split, 0, [T(1, 'T1', [D('a', 10), D('c', 10)], { dq: true })]), null);
  ok('a team that is disqualified: its drivers get nothing either, whatever the rule', two.rows[0].pts === 0 && mem(two, 0) === 'a:0,c:0' && [...two.contrib.values()].every(v => v.pts === 0 && v.places.length === 0)); }

// ---------- sprints, mixed races, heats ----------
{ const c = champ({}, 2, 50), r = P.sessionResult(c, trace(c, 0, rowsOf()), null);
  ok('a sprint (50%) gives the team and the drivers half of the points, rounded like any sprint (12.5 becomes 13)', r.share === 50 && pts(r) === '13,9,8' && mem(r, 0) === 'a:13,c:13' && contrib(r) === 'a:13,b:9,c:13,d:9,e:8');
  const cn = withRule(c, 'sprintRound', 'down'); ok('...down', pts(P.sessionResult(cn, trace(cn, 0, rowsOf()), null)) === '12,9,7');
  const sp = withRule(withRule(c, 'teamRace', 'split'), 'sprintRound', 'none'), rsp = P.sessionResult(sp, trace(sp, 0, rowsOf()), null);
  ok('...split drivers: the share is worked out first, the sprint halves it (A: 15 of 25 becomes 7.5)', mem(rsp, 0) === 'a:7.5,c:5');
  const c1 = champ(), mix = trace(c1, 0, [T(1, 'T1', [D('a', 30), D('c', 20)]), R(2, 'b'), R(3, 'd')]), rm = P.sessionResult(c1, mix, null);
  ok('a race with teams and single drivers: all of them are entrants in the order of the result', rm.rows.map(x => x.kind + ':' + (x.kind === 'team' ? x.teamId : x.driverId)).join() === 'team:T1,driver:b,driver:d' && pts(rm) === '25,18,15' && contrib(rm) === 'a:25,b:18,c:25,d:15');
  const sm = P.standings(c1, [mix], ctx);
  ok('...the team of single drivers has the best two of them (33), the team that raced as a team its points once (25)', ttot(sm, 'T2') === 33 && ttot(sm, 'T1') === 25 && sm.teams.map(t => t.id).join() === 'T2,T1,T3');
  ok('...the places of the teams: the team of the drivers has a 2nd and a 3rd, the team that raced as a team a win', same(pl(sm.teams.find(t => t.id === 'T2').places), [0, 1, 1]) && same(pl(sm.teams.find(t => t.id === 'T1').places), [1]));
  // the heats of a race of teams: a driver can drive for two teams
  const heats = trace(c1, 0, [T(1, 'T1', [D('a', 10)]), T(2, 'T2', [D('a', 5), D('b', 10)])]), rh = P.sessionResult(c1, heats, null), sh = P.standings(c1, [heats], ctx);
  ok('a driver who drove for two teams gets the points of both (A: 25 and 18)', rh.contrib.get('a').pts === 43 && same(rh.contrib.get('a').places, [1, 2]) && dtot(sh, 'a') === 43 && dtot(sh, 'b') === 18 && ttot(sh, 'T1') === 25 && ttot(sh, 'T2') === 18);
  ok('...and the cell of the round holds both', sh.drivers.find(d => d.id === 'a').cells[0].pts === 43 && sh.drivers.find(d => d.id === 'a').wins === 1); }

// ---------- the standings over rounds ----------
{ const c = withRule(champ({}, 3), 'drops', 1);
  const s1 = trace(c, 0, rowsOf()), s2 = trace(c, 1, [T(1, 'T2', [D('b', 25), D('d', 25)]), T(2, 'T1', [D('a', 30), D('c', 20)]), T(3, 'T3', [D('e', 40)])]), s3 = trace(c, 2, [T(1, 'T3', [D('e', 50)]), T(2, 'T1', [D('a', 25), D('c', 25)]), T(3, 'T2', [D('b', 25), D('d', 25)])]);
  const st = P.standings(c, [s1, s2, s3], ctx);
  ok('three rounds of teams: the points of the teams, with the worst result of each team dropped', st.teams.map(t => t.id + ':' + t.total).join() === 'T1:43,T2:43,T3:40' && st.teams.find(t => t.id === 'T1').cells.filter(x => x.dropped).length === 1);
  ok('...the drivers drop their own worst result', st.drivers.find(d => d.id === 'e').total === 40 && st.drivers.find(d => d.id === 'a').total === 43);
  ok('...the winners of the rounds are the teams', st.board.map(b => b.winner).join() === 'Team T1,Team T2,Team T3');
  const tn = withRule(c, 'teamMode', 'none'), sn = P.standings(tn, [s1, s2, s3], ctx);
  ok('with no team standings the drivers still have their points and there are no teams', sn.teams === null && sn.drivers.find(d => d.id === 'a').total === 43);
  // level on points: the team with the win comes first, although Team T2 is first in the roster
  const tc = C.clean({ ...champ(), points: [10, 7.5, 5], roster: [{ driver: 'b', team: 'T2' }, { driver: 'a', team: 'T1' }, { driver: 'e', team: 'T3' }] }, true);
  const tt1 = trace(tc, 0, [T(1, 'T1', [D('a', 10)]), T(2, 'T2', [D('b', 10)]), T(3, 'T3', [D('e', 10)])]), tt2 = trace(tc, 1, [T(1, 'T3', [D('e', 10)]), T(2, 'T2', [D('b', 10)]), T(3, 'T1', [D('a', 10)])]);
  const stT = P.standings(tc, [tt1, tt2], ctx);
  ok('three teams level on 15 points: the teams with a win come first (T1 and T3), T2 last although it is first in the roster; T1 and T3 are level on places too, so the roster decides', stT.teams.map(t => t.id + ':' + t.total).join() === 'T1:15,T3:15,T2:15');
  ok('...the drivers are level the same way (A and E have a win, B has none)', stT.drivers.map(d => d.id).join() === 'a,e,b'); }

// ---------- the panel after a race ----------
{ const c = champ(), s = trace(c, 0, rowsOf(), { awarded: false }), v = P.awardView(c, s, [s], ctx);
  ok('the panel of a race of teams is a race panel (it was "teams: not scored" before 1.57.0)', v.state === 'race' && v.awarded === '' && v.rows.length === 3 && v.rows[0].kind === 'team' && v.rows[0].name === 'Team T1');
  ok('...the team row has the figures of the Teams standings after the award (round 25, total 25, first), and the drivers under it theirs', v.rows[0].round === 25 && v.rows[0].total === 25 && v.rows[0].pos === 1 && v.rows[0].change === 25 && v.rows[0].posBefore === 1
    && v.rows[0].members.map(m => m.driverId + ':' + m.pts + ':' + m.total + ':' + m.pos).join() === 'a:25:25:1,c:25:25:2' && v.rows[2].total === 15 && v.rows[2].pos === 3);
  ok('...the teams of the round, the lead and the number of rounds driven', v.teams.map(t => t.name + ' ' + t.pts).join() === 'Team T1 25,Team T2 18,Team T3 15' && v.decided === 1 && v.total === 2 && v.lead === 'A and C are level');
  ok('...a note says what a race of teams gives', v.notes.some(n => n === P.teamRaceText(c, true)) && !v.notes.some(n => /less than/.test(n)));
  const sa = trace(c, 0, rowsOf()), aw = P.awardView(c, sa, [sa], ctx);
  ok('an awarded race of teams has the same rows (the standings do not count it twice)', aw.rows[0].total === 25 && aw.rows[0].change === 25 && aw.awarded !== '' && aw.rows[0].members[0].total === 25);
  const tn = withRule(c, 'teamMode', 'none'), vn = P.awardView(tn, trace(tn, 0, rowsOf(), { awarded: false }), [], ctx);
  ok('with no team standings the team row has its points but no total, and a note says so; the drivers have theirs', vn.rows[0].pts === 25 && vn.rows[0].total === null && vn.rows[0].pos === 0 && vn.rows[0].members[0].total === 25 && vn.notes.some(n => /no team standings/.test(n)));
  const mn = withRule(c, 'teamMin', 50), vm = P.awardView(mn, trace(mn, 0, rowsOf(), { awarded: false }), [], ctx);
  ok('a driver who drove too little is named in a note and has no points in the row', vm.notes.some(n => /^C drove less than 50% of the laps of the team and get no points\.$/.test(n)) && vm.rows[0].members[1].short === true && vm.rows[0].members[1].pts === 0);
  const gm = withRule(c, 'teamMin', 50), vgm = P.awardView(gm, trace(gm, 0, [T(1, 'T1', [D('a', 30), D('z', 5)])], { awarded: false }), [], ctx);
  ok('a guest who drove too little is a guest only (the note about the minimum share does not name him)', vgm.notes.some(n => /^Z is a guest and drove for a team/.test(n)) && !vgm.notes.some(n => /drove less than/.test(n)));
  const gr = champ(), vg = P.awardView(gr, trace(gr, 0, [T(1, 'T1', [D('a', 30), D('z', 20)]), T(2, 'T9', [D('y', 5)])], { awarded: false }), [], ctx);
  ok('guests: a guest team and a guest driver are told in notes', vg.notes.some(n => /^Team T9 is a guest: no points, and the drivers behind move up\.$/.test(n)) && vg.notes.some(n => /^Z is a guest and drove for a team: the team gets its points, he gets none\.$/.test(n)));
  const only = withRule(c, 'teamRace', 'team'), vo = P.awardView(only, trace(only, 0, rowsOf(), { awarded: false }), [], ctx);
  ok('"team": the drivers are named in the row without points, the standings of the drivers have nothing', vo.rows[0].members.length === 2 && vo.rows[0].members.every(m => m.noPoints) && vo.after.drivers.every(d => d.total === 0) && vo.notes.some(n => /The drivers get no points from it/.test(n)));
  const dr = withRule(champ({}, 3), 'drops', 1), d1 = trace(dr, 0, rowsOf()), d2 = trace(dr, 1, [T(1, 'T2', [D('b', 25)]), T(2, 'T1', [D('a', 30)])], { awarded: false }), vd = P.awardView(dr, d2, [d1, d2], ctx);
  ok('a result of a team that is dropped: the row says so and the total does not grow; a note tells it', vd.rows.find(x => x.teamId === 'T1').roundDropped === true && vd.rows.find(x => x.teamId === 'T1').change === 0 && vd.notes.some(n => /^With dropped results/.test(n)));
  const gOff = withRule(c, 'guestRule', false), vgo = P.awardView(gOff, trace(gOff, 0, [T(1, 'T1', [D('a', 30)]), T(2, 'T9', [D('y', 5)])], { awarded: false }), [], ctx);
  ok('a guest team that keeps its place (guest rule off) has no figures in the standings', vgo.rows[1].guest === true && vgo.rows[1].total === null && vgo.rows[1].members[0].total === null && vgo.rows[1].members[0].pts === 0); }

// ---------- pending, the tables ----------
{ const c = champ(), s = trace(c, 0, rowsOf(), { awarded: false });
  ok('a race of teams that is saved and not awarded is waiting to be awarded', P.pendingOf(c, [s]).length === 1 && P.pendingOf(c, [trace(c, 0, rowsOf())]).length === 0);
  const st = P.standings(c, [trace(c, 0, rowsOf())], ctx), td = P.tableOf(c, st, 'drivers'), tt = P.tableOf(c, st, 'teams');
  ok('the tables say what a race of teams gave: a note under the Drivers and the Teams tables', td.note === P.teamRaceText(c) && tt.note === P.teamRaceText(c));
  ok('...the Teams table has the teams with their points; the Drivers table the drivers', tt.rows.map(r => r.cells[1].t + ':' + r.cells[r.cells.length - 2].t).join() === 'Team T1:25,Team T2:18,Team T3:15' && td.rows.map(r => r.cells[1].t).join() === 'A,C,B,D,E');
  const dr = P.tableOf(withRule(c, 'drops', 1), P.standings(withRule(c, 'drops', 1), [trace(withRule(c, 'drops', 1), 0, rowsOf())], ctx), 'drivers'), mn = withRule(c, 'teamMin', 30);
  ok('...with dropped results the note holds both; with a minimum share it says so', /^Best 1 of 2 rounds count\. A race of teams gives/.test(dr.note) && /less than 30% of the laps of his team gets nothing/.test(P.tableOf(mn, P.standings(mn, [trace(mn, 0, rowsOf())], ctx), 'drivers').note));
  const plain = P.standings(c, [S(c, 0, 1, [R(1, 'a'), R(2, 'b')])], ctx);
  ok('a championship with no race of teams has the notes it had (nothing about teams)', plain.teamRaces === 0 && P.tableOf(c, plain, 'drivers').note === '' && P.tableOf(c, plain, 'teams').note === '');
  const rd = P.tableOf(c, st, 'rounds');
  ok('...the rounds table names the team that won', rd.rows[0].cells[1].t === 'Team T1' && rd.rows[0].cells[1].b === true);
  const gone = P.standings(c, [trace(c, 0, rowsOf())], { ...ctx, teams: [{ id: 'T1', name: 'Red Bulls' }], drivers: [{ id: 'a', name: 'Alex' }] });
  ok('the names come from the lists of drivers and teams (the name in the result when the team was deleted)', gone.teams.find(t => t.id === 'T1').name === 'Red Bulls' && gone.teams.find(t => t.id === 'T2').name === 'Team T2' && gone.drivers.find(d => d.id === 'a').name === 'Alex' && gone.drivers.find(d => d.id === 'b').name === 'B'); }

console.log(fails ? `${fails} TEAM RACE TESTS FAILED` : 'ALL TEAM RACE TESTS PASSED');
process.exit(fails ? 1 : 0);
