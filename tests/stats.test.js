const S = require('../renderer/stats.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
const lap = (time, extra) => ({ driverId: 'd1', carId: 'c1', trackId: 't1', time, ...extra });
const track = { id: 't1', name: 'Living room', length: 10, lanes: 2, scale: '1:32', laneModifier: 'none' };

// ---- the columns ----
const keys = list => list.map(c => c.key);
ok('every list of columns has unique keys and a label', [S.SESSION_COLUMNS, S.STINT_COLUMNS, S.RECORD_COLUMNS].every(l => new Set(keys(l)).size === l.length && l.every(c => c.label && typeof c.on === 'boolean')));
ok('the worked-out columns are all in the session table', S.FIGURE_KEYS.every(k => keys(S.SESSION_COLUMNS).includes(k)));
ok('the old columns come first, in their old order (the Team column of 1.8.0 is next to the Driver)', keys(S.SESSION_COLUMNS).filter(k => k !== 'team').slice(0, 9).join() === 'pos,driver,car,laps,points,result,final,best,total' && keys(S.SESSION_COLUMNS)[2] === 'team');
ok('the stint table keeps its old columns first', keys(S.STINT_COLUMNS).slice(0, 8).join() === 'driver,car,lane,bought,laps,late,best,total');
ok('the record table keeps its old columns (track, driver, lap time, car) and the date', keys(S.RECORD_COLUMNS).slice(0, 4).join() === 'track,driver,time,car' && keys(S.RECORD_COLUMNS).includes('date'));

// ---- the figures of the laps ----
let f = S.figures([lap(5000), lap(5200), lap(5800)], track, '');
ok('average, median and count of three laps', f.count === 3 && near(f.avg, 5333.3333333) && f.median === 5200);
ok('median of an even number of laps is the middle of the two', S.figures([lap(4000), lap(6000), lap(5000), lap(9000)], track).median === 5500);
ok('consistency is the standard deviation of the lap times (sample)', near(S.figures([lap(5000), lap(5200), lap(5800)], track).spread, Math.sqrt((333.33333 ** 2 + 133.33333 ** 2 + 466.66667 ** 2) / 2), 1e-3));
ok('a driver who drove steadily has no spread', S.figures([lap(5000), lap(5000), lap(5000)], track).spread === 0);
ok('one lap has no consistency, no laps have nothing at all', S.figures([lap(5000)], track).spread === null && S.figures([], track).avg === null && S.figures([], track).speed === null && S.figures(undefined, track).count === 0);
f = S.figures([lap(5000), lap(5200, { invalid: true }), lap(9000, { tooSlow: true }), lap(7000, { late: true }), lap(6000, { pit: true }), lap(5400)], track);
ok('invalid, too slow, late and pit laps are left out of the lap figures', f.count === 2 && f.avg === 5200 && f.median === 5200);
ok('...the distance counts the pit lap too (the car drove it), but not an invalid, too slow or late lap', near(f.distance, 30));
ok('speed is the distance of the valid laps over their time: 20 m in 10.4 s', near(f.speed, 20 / 10.4 * 3.6));
ok('laps without a time are ignored', S.figures([lap(5000), lap(0), lap(null), lap('x')], track).count === 1);
// lanes
const bends = { id: 't1', length: 10, lanes: 2, laneModifier: 'bends', laneSpacing: 100, scale: '1:32' }; // lane 2 is the outside lane, lane 1 is shorter
const inner = S.figures([lap(5000, { lane: 1 })], bends), outer = S.figures([lap(5000, { lane: 2 })], bends), unknown = S.figures([lap(5000)], bends);
ok('a lap in a lane is measured on the length of that lane', near(inner.distance, 10 - 2 * Math.PI * 0.1) && near(outer.distance, 10));
ok('a lap saved without its lane (older sessions) is measured on the track length', near(unknown.distance, 10));
ok('so the inside lane is slower for the same lap time', inner.speed < outer.speed);
ok('measured lane lengths are used', near(S.figures([lap(4000, { lane: 2 })], { ...track, laneModifier: 'measured', laneLengths: '9.5, 10.5' }).distance, 10.5));
ok('no track length: no distance and no speed, the lap figures still work', (g => g.distance === null && g.speed === null && g.avg === 5000)(S.figures([lap(5000)], { id: 't1' })) && S.figures([lap(5000)], undefined).avg === 5000);
// scale
ok('scale speed: speed times the scale of the track', near(S.figures([lap(4000)], track).scalespeed, 10 / 4 * 3.6 * 32));
ok('...the scale of the car comes first', near(S.figures([lap(4000)], track, '1:24').scalespeed, 10 / 4 * 3.6 * 24));
ok('...no scale at all: no scale speed (the real speed stays)', (g => g.scalespeed === null && g.speed > 0)(S.figures([lap(4000)], { ...track, scale: '' }, '')));

// ---- a session ----
const session = { id: 's1', trackId: 't1', sessionType: 'race', standings: [
  { pos: 1, driverId: 'd1', carId: 'c1', driverName: 'Alex', carName: 'A', laps: 3, best: 5000, total: 16000, pits: 1, pitTime: 4000, penaltyPoints: 2 },
  { pos: 2, driverId: 'd2', carId: 'c2', driverName: 'Sam', carName: 'B', laps: 2, best: 5600, total: 12000 }] };
const laps = [lap(5000, { sessionId: 's1' }), lap(5200, { sessionId: 's1' }), { driverId: 'd2', carId: 'c2', trackId: 't1', time: 5600, sessionId: 's1' }, lap(5000, { sessionId: 'other' })];
const cars = [{ id: 'c1', scale: '1:24' }, { id: 'c2' }];
const figs = S.forSession(session, laps, [track], cars);
ok('one row of figures for every row of the standings', figs.length === 2);
ok('...each from the laps of that driver in that session only', figs[0].count === 2 && figs[1].count === 1 && figs[0].avg === 5100);
ok('...the pit stops, pit time and penalty points are the ones saved with the session', figs[0].pits === 1 && figs[0].pitTime === 4000 && figs[0].penalty === 2 && figs[1].pits === undefined && figs[1].penalty === undefined);
ok('...the car decides the scale of the scale speed (car c1 is 1:24, c2 has none so the track\'s 1:32 counts)', near(figs[0].scalespeed / figs[0].speed, 24) && near(figs[1].scalespeed / figs[1].speed, 32));
ok('a session whose track was deleted still has its lap figures', (g => g[0].avg === 5100 && g[0].speed === null)(S.forSession(session, laps, [], cars)));

// ---- text ----
ok('lap times as lap times', S.text('avg', { avg: 5333.333 }) === '5.333' && S.text('median', { median: 65432 }) === '1:05.432');
ok('consistency as plus-minus seconds', S.text('spread', { spread: 141.4 }) === '±0.141 s');
ok('speeds: one decimal for the real speed, whole numbers for the scale speed', S.text('speed', { speed: 34.567 }) === '34.6 km/h' && S.text('scalespeed', { scalespeed: 1106.2 }) === '1106 km/h');
ok('distance in metres, and in kilometres from 1000 m', S.text('distance', { distance: 845.4 }) === '845 m' && S.text('distance', { distance: 1234 }) === '1.23 km');
ok('pit stops, pit time and penalty points', S.text('pits', { pits: 2 }) === '2' && S.text('pittime', { pits: 2, pitTime: 8500 }) === '8.500' && S.text('penalty', { penalty: 3 }) === '3');
ok('...no pit stop means no pit time to show, but 0 stops and 0 points are shown', S.text('pittime', { pits: 0, pitTime: 0 }) === '–' && S.text('pits', { pits: 0 }) === '0' && S.text('penalty', { penalty: 0 }) === '0');
ok('nothing to show is a dash', ['avg', 'median', 'spread', 'speed', 'scalespeed', 'distance', 'pits', 'pittime', 'penalty'].every(k => S.text(k, {}) === '–' && S.text(k, null) === '–' && S.text(k, { [k]: null }) === '–'));
ok('a column that has nothing in any row is "not there"; with one value it is', !S.hasAny('pits', figs.slice(1)) && S.hasAny('pits', figs) && !S.hasAny('speed', [{ speed: null }]) && S.hasAny('pittime', [{ pits: 0 }]));

// ---- which columns a session has ----
const names = (sess, fg) => keys(S.sessionColumns(sess, fg)).join();
ok('a race has the old columns, and the figures that have something', names(session, figs) === 'pos,driver,car,laps,best,total,avg,median,spread,speed,scalespeed,distance,pits,pittime,penalty');
ok('...a figure without anything in any row is left out (no pit stops saved, no penalty system)', names(session, S.forSession({ ...session, standings: [{ ...session.standings[1] }] }, laps, [track], cars)) === 'pos,driver,car,laps,best,total,avg,median,speed,scalespeed,distance'); // (one lap: no consistency either)
ok('...in a race decided on points there is a Points column', names({ ...session, resultBy: 'points' }, figs).startsWith('pos,driver,car,laps,points,best'));
ok('...a heat race has no Total time, and Result and Final only when it has them', names({ ...session, sessionType: 'heats', scoring: {}, finals: {}, standings: session.standings.map(x => ({ ...x, score: 1 })) }, figs).startsWith('pos,driver,car,laps,result,final,best,avg') && !names({ ...session, sessionType: 'heats' }, figs).includes('total') && !names({ ...session, sessionType: 'heats' }, figs).includes('result'));

// ---- the notes under a table ----
ok('notes explain the lap figures and consistency, only when they are in the table', S.notes(['avg']).length === 1 && S.notes(['spread']).length === 2 && S.notes(['pos', 'driver']).length === 0);
ok('...and the speeds', S.notes(['speed']).some(n => n.includes('length of the lane')) && S.notes(['scalespeed']).some(n => n.includes('full size')) && !S.notes(['speed']).some(n => n.includes('full size')));

// ---- one lap (a record) ----
const cars2 = [{ id: 'c1', scale: '1:24' }];
let sp = S.lapSpeed({ trackId: 't1', carId: 'c1', time: 4000, lane: 2 }, [bends], cars2);
ok('the speed of a record lap: its lane length over its time, and at scale', near(sp.speed, 10 / 4 * 3.6) && near(sp.scalespeed, 10 / 4 * 3.6 * 24));
sp = S.lapSpeed({ trackId: 'gone', carId: 'x', time: 4000 }, [track], []);
ok('...a deleted track or car gives nothing instead of an error', sp.speed === null && sp.scalespeed === null);
// 1.2.0: who gets the winner's cup
{ const win = (type, row) => S.isWinner({ sessionType: type }, row);
  ok('the first of a race, a timed race or a heat race is the winner', win('race', { pos: 1, laps: 10 }) && win('timed', { pos: 1, laps: 3 }) && win('heats', { pos: '1', laps: 20 }));
  ok('the others are not (second, last, a string that is not a position)', !win('race', { pos: 2, laps: 10 }) && !win('race', { pos: 0, laps: 10 }) && !win('race', { pos: 'x', laps: 10 }) && !win('race', {}));
  ok('practice, qualifying and a Time Token Session have fastest laps, not winners', !win('practice', { pos: 1, laps: 10 }) && !win('qualifying', { pos: 1, laps: 10 }) && !win('tokens', { pos: 1, laps: 10 }) && !win(undefined, { pos: 1, laps: 10 }));
  ok('a car that was disqualified or out, or that drove no lap, is not the winner', !win('race', { pos: 1, laps: 10, dq: true }) && !win('race', { pos: 1, laps: 10, retired: true }) && !win('race', { pos: 1, laps: 0 }) && !win('race', { pos: 1 }));
  ok('nothing at all is nobody', !S.isWinner(null, { pos: 1, laps: 1 }) && !S.isWinner({ sessionType: 'race' }, null) && !S.isHeatWinner(undefined, undefined));
  ok('the first of a heat in the summary of the heats (those rows do not say dq or retired) only in a heat race', S.isHeatWinner({ sessionType: 'heats' }, { pos: 1, laps: 5 }) && !S.isHeatWinner({ sessionType: 'heats' }, { pos: 2, laps: 5 }) && !S.isHeatWinner({ sessionType: 'race' }, { pos: 1, laps: 5 }) && !S.isHeatWinner({ sessionType: 'heats' }, { pos: 1, laps: 0 })); }
// ---- 1.4.0: what the weather and the tyres did ----
ok('a result row says what the tyres did, in words, and nothing when it did nothing', S.tyreText({ tyreNote: 'Wet tyres after lap 9' }) === 'Tyres: Wet tyres after lap 9' && S.tyreText({}) === '' && S.tyreText(null) === '' && S.tyreText({ tyreNote: '' }) === '');
ok('...everything done to a car is said together: Balance of Power first, then the tyres', S.notesText({ bopNote: 'hindered 20% (from the start)', tyreNote: 'Wet tyres after lap 9' }) === 'Balance of Power: hindered 20% (from the start); Tyres: Wet tyres after lap 9' && S.notesText({ bopNote: 'helped 10% (from lap 3)' }) === 'Balance of Power: helped 10% (from lap 3)' && S.notesText({ tyreNote: 'x' }) === 'Tyres: x' && S.notesText({}) === '' && S.notesText(undefined) === '');
ok('what the weather did in a race or heat, in words', S.weatherText({ weatherNote: 'Cloudy from lap 8, rain from lap 10' }) === 'Weather: Cloudy from lap 8, rain from lap 10' && S.weatherText({}) === '' && S.weatherText(null) === '');
// ---- 1.9.0: an Endurance Race ----
{ const row = { pos: 1, asTeam: true, laps: 5, drivers: [{ driverName: 'Alex', laps: 4, ms: 20000 }, { driverName: 'Sam', laps: 1, ms: 3700000 }], swaps: 1, swapLost: 2, short: [{ driverName: 'Ben', laps: 0, ms: 0 }] };
  ok('an Endurance Race has a winner (not when disqualified, retired or without laps), like a race', S.WINNER_TYPES.includes('endurance') && S.isWinner({ sessionType: 'endurance' }, row) && !S.isWinner({ sessionType: 'endurance' }, { ...row, dq: true }) && !S.isWinner({ sessionType: 'endurance' }, { ...row, laps: 0 }));
  ok('a session is raced in heats when it is a heat-based race, or an Endurance Race with heats (not a plain one)', S.heated({ sessionType: 'heats' }) && S.heated({ sessionType: 'endurance', heatResults: [] }) && !S.heated({ sessionType: 'endurance' }) && !S.heated({ sessionType: 'race', heatResults: [] }) && !S.heated(null));
  ok('the drivers of a team row have their time at the wheel when it is known (and nothing extra when it is not)', S.driversText(row) === 'Alex (4 laps, 0:20), Sam (1 lap, 1:01:40)' && S.driversText({ asTeam: true, drivers: [{ driverName: 'Kim', laps: 2 }] }) === 'Kim (2 laps)');
  ok('what an Endurance Race adds to a team: the swaps, the laps lost, and the drivers who drove too little', S.enduranceText(row) === '1 swap; 2 laps not counted for swaps that were not made; drove too little: Ben (0 laps, 0:00)' && S.enduranceText({ asTeam: true }) === '' && S.enduranceText({ swaps: 3 }) === '' && S.enduranceText({ asTeam: true, swaps: 4 }) === '4 swaps');
  ok('the clock of the race: m:ss, and h:mm:ss from an hour', S.clockOf(0) === '0:00' && S.clockOf(59400) === '0:59' && S.clockOf(60000) === '1:00' && S.clockOf(3600000) === '1:00:00' && S.clockOf(7384000) === '2:03:04' && S.clockOf(-5) === '0:00');
  const lines = S.stintLines({ standings: [{ asTeam: true, teamName: 'Red', stints: [{ driverName: 'Alex', laps: 1, ms: 5000, from: 0, to: 5000 }, { driverName: 'Sam', laps: 2, ms: 6000, heat: 2 }, { driverName: 'Kim', laps: 3, ms: 7000, heat: 3, final: 'B' }] }, { asTeam: true, teamName: 'None' }, { driverName: 'Plain' }] });
  ok('the stints per team: the race clock, or the heat or the final; teams and drivers with no stints are left out', lines.length === 1 && lines[0].team === 'Red' && lines[0].stints.map(q => q.text).join(' | ') === 'Alex, 0:00 to 0:05, 1 lap (0:05) | Heat 2, Sam, 2 laps (0:06) | Final B, Kim, 3 laps (0:07)' && lines[0].stints.map(q => q.n).join() === '1,2,3');
  ok('a race that was interrupted and carried on says so (once, or how often), and a race that was not says nothing', S.resumeText({ resumed: 1 }) === 'This race was interrupted and carried on. The first lap of every car after it is not counted for records.' && S.resumeText({ resumed: 3 }).startsWith('This race was interrupted and carried on 3 times.') && S.resumeText({}) === '' && S.resumeText({ resumed: 0 }) === '' && S.resumeText(null) === '');
  ok('nothing is added to a team row when there is nothing to say: no swaps (0 or not a number), no lost laps, nobody short, and only a team row says anything', S.enduranceText({ asTeam: true, swaps: 0, swapLost: 0, short: [] }) === '' && S.enduranceText({ asTeam: true, swaps: 'x', swapLost: null }) === '' && S.enduranceText({ asTeam: false, swaps: 3, swapLost: 2, short: [{ driverName: 'A', laps: 1, ms: 1 }] }) === '' && S.enduranceText({ asTeam: true, swaps: 1 }) === '1 swap' && S.enduranceText({ asTeam: true, swapLost: 1 }) === '1 lap not counted for swaps that were not made');
  ok('the drivers of a row are only a team row\'s, and a driver without a name is a question mark', S.driversText({ asTeam: false, drivers: [{ driverName: 'A', laps: 1 }] }) === '' && S.driversText({ asTeam: true, drivers: [{ laps: 2 }] }) === '? (2 laps)' && S.driversText({ asTeam: true, drivers: [] }) === '' && S.driversText({ asTeam: true }) === '' && S.driversText(null) === '' && S.driversText({ asTeam: true, drivers: [{ driverName: 'A', laps: 1, ms: 0 }] }) === 'A (1 lap)');
  { const l = S.stintLines({ standings: [{ asTeam: true, driverName: 'Only name', stints: [{ driverName: 'A', laps: 1, ms: 1000, from: 0 }] }, { asTeam: true, teamName: 'Team', driverName: 'Both', stints: [{ laps: 2, ms: 2000, to: 5000 }] }, { asTeam: true, stints: [] }, { asTeam: false, stints: [{ laps: 1, ms: 1 }] }] });
    ok('a team without a team name is named by its row; a stint has the clock only when it has both a start and an end; a driver without a name is a question mark; a row that is not a team has no stints', l.length === 2 && l[0].team === 'Only name' && l[1].team === 'Team' && l[0].stints[0].text === 'A, 1 lap (0:01)' && l[1].stints[0].text === '?, 2 laps (0:02)'); }
  ok('the columns of a heat-based Endurance Race are those of heats (the Result column, no total time)', S.sessionColumns({ sessionType: 'endurance', heatResults: [], scoring: { x: 1 }, standings: [{ pos: 1, score: 3 }] }, []).some(c => c.key === 'result') && !S.sessionColumns({ sessionType: 'endurance', heatResults: [], standings: [] }, []).some(c => c.key === 'total') && S.sessionColumns({ sessionType: 'endurance', standings: [] }, []).some(c => c.key === 'total'));
}
console.log(fails ? fails + ' STATS TESTS FAILED' : 'ALL STATS TESTS PASSED'); process.exit(fails ? 1 : 0);
