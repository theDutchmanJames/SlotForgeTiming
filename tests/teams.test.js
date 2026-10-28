// 1.8.0: Teams in the Database: a name, a picture and the drivers of the team in order. A driver can be in several teams. Deleting a driver takes the driver out of its teams,
// and teams can be exported and imported with their drivers.
const fs = require('fs'), os = require('os'), path = require('path');
const Database = require('../db.js'), T = require('../transfer.js'), schema = require('../schema.js');
let fails = 0; const ok = (n, c) => { console.log((c ? 'ok   ' : 'FAIL ') + n); if (!c) fails++; };
const tmp = () => new Database(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'slt-')), 'db.json'));

// ---- the schema ----
{ const s = schema.teams, f = k => s.fields.find(x => x.key === k);
  ok('Teams is a database item with a name as its title and a picture', s && s.label === 'Team' && s.plural === 'Teams' && s.title.join() === 'name' && s.image === 'picture' && f('picture').type === 'image');
  ok('...with a list of drivers, in order, that links to the Drivers', f('drivers').type === 'members' && f('drivers').ref === 'drivers' && /order/.test(f('drivers').hint) && /more than one team/.test(f('drivers').hint));
  ok('...and the form has two folders: Basics (open) and Picture', s.groups.map(g => g.id).join() === 'basics,picture' && s.groups[0].open === true && !s.groups[1].open && f('name').group === 'basics' && f('drivers').group === 'basics' && f('picture').group === 'picture');
  ok('...the card shows the drivers', s.card.join() === 'drivers');
  ok('a new database has a Teams list, and the phone page may read it', tmp().list('teams').length === 0 && /'teams'/.test(fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8')));
}

// ---- the database ----
{ const db = tmp(), a = db.add('drivers', { name: 'Alex' }), s = db.add('drivers', { name: 'Sam' }), k = db.add('drivers', { name: 'Kim' });
  const red = db.add('teams', { name: 'Red', drivers: [a.id, s.id], picture: 'data:x' }), blue = db.add('teams', { name: 'Blue', drivers: [s.id, k.id, a.id] });
  ok('a team keeps its drivers in the order they were given, and a driver can be in several teams', db.list('teams')[0].drivers.join() === [a.id, s.id].join() && db.list('teams')[1].drivers.join() === [s.id, k.id, a.id].join());
  db.remove('drivers', s.id);
  ok('deleting a driver takes the driver out of every team (the order of the others stays)', db.list('teams').find(t => t.id === red.id).drivers.join() === a.id && db.list('teams').find(t => t.id === blue.id).drivers.join() === [k.id, a.id].join());
  db.remove('teams', red.id);
  ok('deleting a team does not touch its drivers', db.list('teams').length === 1 && db.list('drivers').length === 2);
  db.add('teams', { name: 'Old team, no list' }); db.remove('drivers', a.id);
  ok('a team without a list of drivers does not break the deleting of a driver', db.list('teams').find(t => t.name === 'Old team, no list') && db.list('teams').find(t => t.id === blue.id).drivers.join() === k.id);
}

// ---- export and import ----
{ const a = tmp(), d1 = a.add('drivers', { name: 'Alex' }), d2 = a.add('drivers', { name: 'Sam' }), d3 = a.add('drivers', { name: 'Kim' });
  const team = a.add('teams', { name: 'Red', drivers: [d2.id, d1.id], picture: 'data:y' }), other = a.add('teams', { name: 'Blue', drivers: [d3.id] });
  const withDeps = T.collect(a.data, { teams: [team.id] }, true), without = T.collect(a.data, { teams: [team.id] }, false);
  ok('a team brings its drivers (only its own)', withDeps.items.teams.length === 1 && withDeps.items.drivers.map(d => d.name).sort().join() === 'Alex,Sam' && Object.keys(without.items).join() === 'teams');
  ok('what a team uses is listed as a dependency, not required', (dp => dp.drivers.length === 2 && dp.drivers.every(x => x.required === false) && !dp.teams)(T.dependencies(a.data, { teams: [team.id] })));
  ok('teams are checked, described and ordered after the drivers', T.check(withDeps).ok && T.check(withDeps).summary.teams.names[0] === 'Red' && Object.keys(withDeps.items).join() === 'drivers,teams');
  const b = tmp(); const counts = T.apply(b, JSON.parse(JSON.stringify(withDeps)));
  const names = ids => ids.map(id => b.list('drivers').find(d => d.id === id).name).join();
  ok('imported, the team has copies of its drivers, in the same order', counts.teams === 1 && counts.drivers === 2 && b.list('teams')[0].name === 'Red' && names(b.list('teams')[0].drivers) === 'Sam,Alex' && b.list('teams')[0].picture === 'data:y');
  const c = tmp(); c.add('teams', { name: 'Red', drivers: [] }); T.apply(c, JSON.parse(JSON.stringify(withDeps)));
  ok('a team with a name that is there already gets "(imported)"', c.list('teams').map(t => t.name).sort().join() === 'Red,Red (imported)');
  const partial = JSON.parse(JSON.stringify(withDeps)); delete partial.items.drivers; const e = tmp(); T.apply(e, partial);
  ok('a driver that did not come along is left out of the team, nothing empty stays in the list', e.list('teams')[0].drivers.length === 0 && Array.isArray(e.list('teams')[0].drivers));
  const half = JSON.parse(JSON.stringify(withDeps)); half.items.drivers = half.items.drivers.filter(d => d.name === 'Alex'); const f = tmp(); T.apply(f, half);
  ok('...with one driver of two missing the other stays', f.list('teams')[0].drivers.length === 1 && f.list('drivers')[0].name === 'Alex' && f.list('teams')[0].drivers[0] === f.list('drivers')[0].id);
  // a session with a team
  const sid = a.saveSession({ setupName: 'Friday', trackId: '', date: '2026-10-01', standings: [{ driverId: d1.id, teamId: team.id, teamName: 'Red', carId: '' }] }, []);
  const sb = T.collect(a.data, { sessions: [sid] }, false);
  ok('a session brings the team of its standings, with the drivers of the team', sb.items.teams && sb.items.teams.length === 1 && sb.items.teams[0].name === 'Red' && sb.items.drivers.length === 2);
  const g = tmp(); T.apply(g, JSON.parse(JSON.stringify(sb)));
  ok('...and the copy of the session points at the copy of the team', g.list('sessions')[0].standings[0].teamId === g.list('teams')[0].id && g.list('sessions')[0].standings[0].teamName === 'Red');
}

// ---- who drives a heat (Heats.driversForHeat) ----
{ const H = require('../renderer/heats.js');
  const one = (o, p) => H.driversForHeat(o).picks[p];
  const rost = { 0: ['a', 'b', 'c'], 1: ['x', 'y'], 2: ['b', 'x'] };
  ok('in turn: the drivers of a team take turns in the order of the roster, one per heat the team races', [[], ['a'], ['a', 'b'], ['a', 'b', 'c'], ['a', 'b', 'c', 'a']].map(history => one({ rosters: rost, heat: [0], rule: 'order', history: { 0: history } }, 0)).join() === 'a,b,c,a,b');
  ok('...the turn goes on after the driver who drove last (also when the Race Director chose him), and from the first driver again after the last one', one({ rosters: rost, heat: [0], rule: 'order', history: { 0: ['b'] } }, 0) === 'c' && one({ rosters: rost, heat: [0], rule: 'order', history: { 0: ['a', 'c'] } }, 0) === 'a' && one({ rosters: rost, heat: [0], rule: 'order', history: { 0: ['c', 'c'] } }, 0) === 'a');
  ok('...a driver who is not in the roster any more (a stand-in) does not stop it: the turn is that of the number of heats the team has raced', one({ rosters: rost, heat: [0], rule: 'order', history: { 0: ['zzz'] } }, 0) === 'b');
  ok('...a team that has not raced yet starts with its first driver, even when other teams have raced', one({ rosters: rost, heat: [1], rule: 'order', history: { 0: ['a', 'b'] } }, 1) === 'x');
  ok('...and with the rule left out it is in turn', one({ rosters: rost, heat: [0], history: { 0: ['a'] } }, 0) === 'b');
  let r = H.driversForHeat({ rosters: rost, heat: [0, 2], rule: 'order', history: { 0: ['a'], 2: [] } });
  ok('a driver who is in two teams drives for one team only in a heat: the second team takes its next free driver', r.picks[0] === 'b' && r.picks[2] === 'x' && !r.clash.length);
  r = H.driversForHeat({ rosters: { 0: ['a'], 1: ['a'] }, heat: [0, 1], rule: 'order' });
  ok('two teams with the same only driver: the first team has him and the second one is told there is no free driver (his first driver drives anyway)', r.picks[0] === 'a' && r.picks[1] === 'a' && r.clash.join() === '1' && r.empty.length === 0);
  r = H.driversForHeat({ rosters: { 0: [], 1: ['x'] }, heat: [0, 1], rule: 'order' });
  ok('a team without drivers: nobody drives and it is told', r.picks[0] === '' && r.picks[1] === 'x' && r.empty.join() === '0');
  ok('a roster with the same driver twice counts him once', one({ rosters: { 0: ['a', 'a', 'b'] }, heat: [0], rule: 'order', history: { 0: ['a'] } }, 0) === 'b');
  const seq = rnd => { let hist = []; for (let i = 0; i < 6; i++) hist.push(one({ rosters: rost, heat: [0], rule: 'random', history: { 0: hist }, rnd }, 0)); return hist; };
  const runs = seq(() => 0.99), runs2 = seq(() => 0);
  ok('by lot: the driver who has driven the fewest heats goes first, so after 6 heats everybody drove 2 (whatever the lot says)', [runs, runs2].every(l => ['a', 'b', 'c'].every(d => l.filter(x => x === d).length === 2)));
  ok('...and never the same driver twice in a row when the team has a choice', [runs, runs2].every(l => l.every((d, i) => i === 0 || d !== l[i - 1])));
  ok('...a lot of 0 takes the first of those who qualify, a lot just below 1 the last', one({ rosters: rost, heat: [0], rule: 'random', history: { 0: [] }, rnd: () => 0 }, 0) === 'a' && one({ rosters: rost, heat: [0], rule: 'random', history: { 0: [] }, rnd: () => 0.999999 }, 0) === 'c');
  ok('...a lot of exactly 1 (a bad random number) still gives a driver of the team', rost[0].includes(one({ rosters: rost, heat: [0], rule: 'random', history: { 0: [] }, rnd: () => 1 }, 0)));
  // (everybody drove equally often: the one who drove last is left out of the lot; a lot just below 1 would otherwise pick him)
  ok('...when everybody drove equally often, the driver who drove last is not drawn again', one({ rosters: rost, heat: [0], rule: 'random', history: { 0: ['a', 'b', 'c', 'a', 'b', 'c'] }, rnd: () => 0.99 }, 0) === 'b' && one({ rosters: rost, heat: [0], rule: 'random', history: { 0: ['a', 'b', 'c', 'a', 'b', 'c'] }, rnd: () => 0 }, 0) === 'a');
  // (the driver who drove last is also the only one with the fewest heats: he is the only choice and drives)
  ok('...and when the driver who drove last is the only one who drove the fewest heats, he drives (a team has to have a driver)', one({ rosters: { 0: ['a', 'b'] }, heat: [0], rule: 'random', history: { 0: ['a', 'a', 'b'] }, rnd: () => 0 }, 0) === 'b');
  r = H.driversForHeat({ rosters: rost, heat: [0, 2], rule: 'random', history: { 0: [], 2: [] }, rnd: () => 0 });
  ok('...a driver of two teams is given to one of them only',r.picks[0] === 'a' && r.picks[2] === 'b' && !r.clash.length);
  r = H.driversForHeat({ rosters: rost, heat: [0, 2], rule: 'chosen', history: { 0: [], 2: [] }, chosen: { 0: 'b' } });
  ok('chosen: what the Race Director chose is used, the other teams are in turn and skip a driver who was chosen', r.picks[0] === 'b' && r.picks[2] === 'x');
  r = H.driversForHeat({ rosters: rost, heat: [0, 2], rule: 'chosen', history: {}, chosen: { 0: 'zzz', 2: 'x' } });
  ok('...a choice of a driver who is not in the team is ignored', r.picks[0] === 'a' && r.picks[2] === 'x');
  r = H.driversForHeat({ rosters: rost, heat: [0, 2], rule: 'chosen', history: {}, chosen: { 0: 'b', 2: 'b' } });
  ok('...the same driver chosen for two teams: the first team has him and the other one is in turn', r.picks[0] === 'b' && r.picks[2] === 'x');
  ok('...a rule that is not one of the three is in turn, and a heat without teams gives nothing', one({ rosters: rost, heat: [0], rule: 'dance', history: { 0: ['a'] } }, 0) === 'b' && Object.keys(H.driversForHeat({ rosters: rost, heat: [] }).picks).length === 0);
  ok('the schedule can be asked for a participant who is not in the rosters at all (no drivers)', H.driversForHeat({ rosters: {}, heat: [5], rule: 'order' }).empty.join() === '5');
}

// ---- a rotation whose participants are teams ----
{ const Rot = require('../renderer/rotation.js');
  const base = Rot.blank ? Rot.blank(4, 2) : null;
  const rec = Rot.clean({ name: 'Endurance', participants: 4, lanes: 2, heats: [{ places: [{ p: 0, lane: 0 }, { p: 1, lane: 1 }] }, { places: [{ p: 2, lane: 0 }, { p: 3, lane: 1 }] }] });
  ok('a rotation has drivers as its participants unless it says teams; the record stays as it was', !('participantsAre' in rec) && !Rot.isTeams(rec) && Rot.nameOf(rec, 0) === 'Participant 1' && Rot.shortOf(rec, 0) === 'P1' && Rot.describe(rec) === '4 participants, 2 lanes, 2 heats');
  let res = Rot.setParticipantsAre(rec, 'teams');
  ok('"Participants are Teams" changes the words (Team 1, T1, 4 teams) and nothing else', res.rec.participantsAre === 'teams' && Rot.isTeams(res.rec) && Rot.nameOf(res.rec, 0) === 'Team 1' && Rot.shortOf(res.rec, 3) === 'T4' && Rot.describe(res.rec) === '4 teams, 2 lanes, 2 heats' && JSON.stringify(res.rec.heats) === JSON.stringify(rec.heats));
  ok('...the rotation that was changed is not touched (a new record is made), and a name is still the name', !('participantsAre' in rec) && Rot.nameOf(Rot.setName(res.rec, 1, 'Red').rec, 1) === 'Red');
  ok('...back to drivers takes the mark away again', !('participantsAre' in Rot.setParticipantsAre(res.rec, 'drivers').rec) && JSON.stringify(Rot.setParticipantsAre(res.rec, 'drivers').rec) === JSON.stringify(rec));
  ok('...it stays when the rotation is resized, cleaned or the places change', Rot.resize(res.rec, 6, 2).rec.participantsAre === 'teams' && Rot.clean(res.rec).participantsAre === 'teams' && Rot.shuffleLanes(res.rec, 3).rec.participantsAre === 'teams');
  ok('...and anything but drivers or teams is refused', Rot.setParticipantsAre(rec, 'cars').error === 'The participants are drivers or teams.' && Rot.clean({ ...rec, participantsAre: 'drivers' }).participantsAre === undefined && Rot.clean({ ...rec, participantsAre: 'x' }).participantsAre === undefined);
  const teamsList = [{ id: 'T1', name: 'Red' }, { id: 'T2', name: 'Blue' }, { id: 'T3', name: 'blue ' }];
  const named = Rot.setName(Rot.setName(Rot.setName(res.rec, 0, 'red').rec, 1, 'Blue').rec, 2, 'Green').rec;
  const m = Rot.matchDrivers(named, teamsList, t => [t.name]);
  ok('the names of the participants can be matched with teams, just as with drivers (a name used by two teams is told as unclear)', m.picks[0] === 'T1' && m.picks[1] === '' && m.ambiguous.join() === 'Blue' && m.missing.join() === 'Green' && m.named === 3);
}

// ---- the Team Name and Team Picture widgets, and the team in a custom text ----
{ const { createRace } = require('../renderer/engine.js'), Tm = require('../renderer/timing.js'), Wd = require('../renderer/widgets.js');
  const people = [{ lane: 0, driverId: 'd1', carId: 'c1', driverName: 'Alex', carName: 'Car1', teamId: 'T1', teamName: 'Red <Bulls>', teamPicture: 'data:image/png;base64,RED' }, { lane: 1, driverId: 'd2', carId: 'c2', driverName: 'Sam', carName: 'Car2' }];
  const eng = createRace({ type: 'race', laps: 5, endRule: 'all', entries: people }); eng.start(0); eng.cross(0, 5000);
  const S = (over = {}) => { const st = eng.standings(); return { eng, now: 6000, phase: 'running', lights: 0, setup: { sessionType: 'race', laps: 5 }, heat: null, carByLane: l => eng.cars.find(c => c.lane === l) || null, rowOf: c => st.find(r => r.car === c), flashOf: () => null, personalBest: () => Infinity, champ: { on: false, list: [], done: new Map() }, ...over }; };
  const C = (type, lane, opt, over) => Tm.content({ type, lane, opt }, S(over));
  ok('Team Name shows the team of the lane (written safely), and nothing for a lane without a team', C('teamname', 0, {}).html === 'Red &lt;Bulls&gt;' && C('teamname', 1, {}).html === '');
  ok('Team Picture shows the picture of the team of the lane in its frame, and nothing for a lane without a team', C('teampicture', 0, {}).html.includes('src="data:image/png;base64,RED"') && C('teampicture', 0, {}).html.includes('class="avframe"') && C('teampicture', 1, {}).html === '');
  ok('...the position and zoom of the picture are the settings of the widget', C('teampicture', 0, { frame: { x: 10, y: 20, zoom: 1.5 } }).html.includes('transform:') && C('teampicture', 0, { frame: { x: 10, y: 20, zoom: 1.5 } }).html !== C('teampicture', 0, {}).html);
  const teams = [{ id: 'T9', name: 'Gold Gang', picture: 'data:image/png;base64,GOLD' }, { id: 'T8', name: 'No Picture' }];
  ok('a team chosen in the widget is always shown, whatever team the lane has', C('teamname', 0, { team: 'T9' }, { teams }).html === 'Gold Gang' && C('teampicture', 1, { team: 'T9' }, { teams }).html.includes('data:image/png;base64,GOLD'));
  ok('...even on a lane where no car races (the widget needs no car)', C('teamname', 5, { team: 'T9' }, { teams }).html === 'Gold Gang' && C('teampicture', 5, { team: 'T9' }, { teams }).html.includes('GOLD') && C('teamname', 5, {}, { teams }).html === '');
  ok('...a team without a picture shows no picture, a team that is gone shows nothing', C('teampicture', 0, { team: 'T8' }, { teams }).html === '' && C('teamname', 0, { team: 'T8' }, { teams }).html === 'No Picture' && C('teamname', 0, { team: 'gone' }, { teams }).html === '' && C('teamname', 0, { team: 'T9' }, {}).html === '');
  const d = k => Wd.def(k);
  ok('both are Team and Swaps widgets, one per lane, and each has the choice of the team (the picture also has its frame)', d('teamname').group === 'Team and Swaps' && d('teampicture').group === 'Team and Swaps' && d('teamname').perLane && d('teampicture').perLane && d('teamname').options.map(o => o.key).join() === 'team' && d('teampicture').options.map(o => o.key).join() === 'team,frame' && d('teamname').options[0].type === 'team' && d('teampicture').options[1].from === 'team');
  ok('the preview shows the team name, and an unset team picture stays empty like live timing', Wd.sampleOf(d('teamname'), 0, { opt: {} }) !== undefined && Wd.sampleOf(d('teampicture'), 1, { opt: {} }) === '');
  ok('a custom text can use {team}: it is listed with the other variables, and filled in (and written safely)', Wd.TEXT_LANE_VARS.some(v => v[0] === 'team') && C('textlane', 0, { text: 'Go {team}!' }).html === 'Go Red &lt;Bulls&gt;!' && C('textlane', 1, { text: 'Go {team}!' }).html === 'Go !');
  const ch = { on: true, list: [10, 8], done: new Map([['d1', 4], ['T1', 20]]) };
  ok('the championship points of a car are those of its driver; of a team that races as a team they are those of the team', C('champpoints', 0, { live: false }, { champ: ch }).html === '4' && (() => { const e2 = createRace({ type: 'race', laps: 5, endRule: 'all', entries: [{ ...people[0], asTeam: true }, people[1]] }); e2.start(0); return Tm.content({ type: 'champpoints', lane: 0, opt: { live: false } }, { ...S({ champ: ch }), eng: e2, carByLane: l => e2.cars.find(c => c.lane === l) || null, rowOf: c => e2.standings().find(r => r.car === c) }).html === '20'; })());
}

// ---- the Team column and the drivers who drove, in the results and the PDF ----
{ const St = require('../renderer/stats.js'), Rp = require('../renderer/report.js');
  const session = { id: 's1', setupName: 'Endurance', sessionType: 'heats', trackId: 't1', trackName: 'Living room', date: '2026-10-16T10:00:00.000Z', resultBy: 'laps', endedBy: '',
    standings: [{ pos: 1, asTeam: true, driverId: '', driverName: 'Red Bulls', teamId: 'T1', teamName: 'Red Bulls', carId: 'c1', carName: 'Car1', laps: 11, points: 0, best: 4800, total: null, drivers: [{ driverId: 'd1', driverName: 'Alex', laps: 6 }, { driverId: 'd2', driverName: 'Sam', laps: 5 }] },
      { pos: 2, driverId: 'd3', driverName: 'Kim', teamId: 'T2', teamName: 'Blue Moons', carId: 'c2', carName: 'Car2', laps: 9, points: 0, best: 5000, total: null }],
    heatResults: [{ heat: 1, rows: [{ participant: 0, pos: 1, laps: 6, driverName: 'Red Bulls (Alex)', by: 'Alex', teamId: 'T1', points: 0, best: 4800 }] }] };
  const laps = [{ sessionId: 's1', driverId: 'd1', teamId: 'T1', heat: 1, lapNumber: 1, time: 4800, carId: 'c1' }, { sessionId: 's1', driverId: 'd2', teamId: 'T1', heat: 2, lapNumber: 1, time: 5200, carId: 'c1' }, { sessionId: 's1', driverId: 'd3', teamId: 'T2', heat: 1, lapNumber: 1, time: 5000, carId: 'c2' }, { sessionId: 's1', driverId: 'd1', heat: 3, lapNumber: 1, time: 4900, carId: 'c9' }];
  ok('the laps of a team that raced as a team are the laps of all its drivers; the laps of a driver are his own', St.ownLaps(session.standings[0], laps).length === 2 && St.ownLaps(session.standings[1], laps).length === 1 && St.ownLaps({ asTeam: true, driverId: '', teamId: '' }, laps).length === 0 && St.ownLaps({ driverId: 'd1' }, laps).length === 2);
  ok('...and they are the laps with the id of the team, not the laps of other teams or of a driver who raced alone', St.ownLaps(session.standings[0], laps).map(l => l.driverId).sort().join() === 'd1,d2' && St.ownLaps(session.standings[0], laps).every(l => l.teamId === 'T1'));
  ok('the figures of a team row come from the laps of the team', (() => { const f = St.forSession(session, laps, [{ id: 't1', lanes: 2 }], []); return f.length === 2 && f[0].count === 2 && f[1].count === 1; })());
  ok('the Team column is in the table next to the driver, and only when a row has a team that is not the row itself', St.SESSION_COLUMNS.map(c => c.key).slice(0, 3).join() === 'pos,driver,team' && St.sessionColumns(session, []).some(c => c.key === 'team') && !St.sessionColumns({ ...session, standings: [session.standings[0]] }, []).some(c => c.key === 'team') && !St.sessionColumns({ ...session, standings: [{ pos: 1, driverName: 'Alex' }] }, []).some(c => c.key === 'team'));
  ok('the drivers of a team row in words: each with his laps', St.driversText(session.standings[0]) === 'Alex (6 laps), Sam (5 laps)' && St.driversText(session.standings[1]) === '' && St.driversText({ asTeam: true, drivers: [{ driverName: 'Alex', laps: 1 }] }) === 'Alex (1 lap)' && St.driversText(null) === '');
  const html = Rp.sessionHtml({ session, laps, tracks: [{ id: 't1', name: 'Living room', lanes: 2 }], cars: [], options: {} });
  ok('the PDF has the Team column, the drivers who drove for the team, and the lap times of the team together', html.includes('<th>Team</th>') && html.includes('Blue Moons') && html.includes('(drivers: Alex (6 laps), Sam (5 laps))') && html.includes('Red Bulls (Alex)'));
  const none = Rp.sessionHtml({ session: { ...session, standings: [{ pos: 1, driverId: 'd1', driverName: 'Alex', carName: 'Car1', laps: 3, points: 0 }], heatResults: undefined }, laps: [], tracks: [], cars: [], options: {} });
  ok('a race without teams has no Team column in the PDF', !none.includes('<th>Team</th>') && !none.includes('drivers:'));
}

// ---- the team in the audio calls and on the other screens ----
{ const An = require('../renderer/announcer.js'), Ls = require('../renderer/liveshare.js');
  ok('{team} is a variable of every call about a driver, with a sample and an explanation', An.EVERY_DRIVER.includes('team') && An.SAMPLE.team === 'Red Racers' && /team/i.test(An.VARS.team) && An.fill('{team} needs a driver', { team: 'Red Racers' }) === 'Red Racers needs a driver' && An.fill('Go {team}!', {}) === 'Go!');
  const teams = [{ id: 'T1', name: 'Red', picture: 'P1' }, { id: 'T2', name: 'Blue', picture: 'P2' }, { id: 'T3', name: 'Green', picture: 'P3' }];
  const layout = { widgets: [{ type: 'teamname', lane: 0, opt: { team: 'T2' } }, { type: 'name', lane: 0 }] };
  ok('only the teams that a widget shows are sent to the other screens (with their pictures), not all of them', JSON.stringify(Ls.teamsUsed(teams, layout, [])) === JSON.stringify([{ id: 'T2', name: 'Blue', picture: 'P2' }]) && Ls.teamsUsed(teams, { widgets: [] }).length === 0 && Ls.teamsUsed(undefined, layout).length === 0);
  ok('...a row design counts too', Ls.teamsUsed(teams, { widgets: [] }, [{ widgets: [{ type: 'teampicture', opt: { team: 'T3' } }] }]).map(t => t.id).join() === 'T3');
  ok('...they are part of the static message and of the state a window is given', Ls.packStatic({ raceId: 'r', title: 't', eng: { cfg: {} }, setup: {}, layout: {}, track: {}, lanes: 2, base: { personal: new Map(), track: Infinity, trackName: '' }, teams: [{ id: 'T2', name: 'Blue', picture: 'P2' }] }).teams[0].name === 'Blue' && Ls.packStatic({ raceId: 'r', title: 't', eng: { cfg: {} }, setup: {}, layout: {}, track: {}, lanes: 2, base: { personal: new Map(), track: Infinity, trackName: '' } }).teams.length === 0);
}

console.log(fails ? fails + ' TEAMS TESTS FAILED' : 'ALL TEAMS TESTS PASSED');
process.exit(fails ? 1 : 0);
