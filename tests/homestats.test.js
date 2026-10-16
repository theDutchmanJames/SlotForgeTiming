const H = require('../renderer/homestats.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };

const track = { id: 't1', name: 'Living room', length: 10, lanes: 2, scale: '1:32', laneModifier: 'none' };
const track2 = { id: 't2', name: 'Garage', length: 25, lanes: 2, scale: '1:32', laneModifier: 'none' };
const lap = (time, extra) => ({ id: 'l' + Math.random(), driverId: 'd1', carId: 'c1', trackId: 't1', sessionId: 's1', lane: 1, time, date: '2026-10-01T10:00:00.000Z', ...extra });
const names = { d1: 'Dutch', d2: 'Sam', d3: 'Mila' }, cars = { c1: 'Porsche 917', c2: 'Ford GT40' };
const driverName = id => names[id] || '', carName = id => cars[id] || '';

// ---- lane colours ----
ok('a lane takes the colour the layout gives it on the race screen', H.laneColor({ laneColors: [{ bg: '#112233' }, { bg: 'rgb(1, 2, 3)' }, { bg: 'hsl(10 50% 50%)' }] }, 0) === '#112233' && H.laneColor({ laneColors: [{ bg: '#112233' }, { bg: 'rgb(1, 2, 3)' }] }, 1) === 'rgb(1, 2, 3)');
ok('...without a layout, or a colour for that lane, it is one of the eight colours', H.laneColor(null, 0) === H.PALETTE[0] && H.laneColor({ laneColors: [] }, 2) === H.PALETTE[2] && H.laneColor({ laneColors: [{ bg: '' }] }, 0) === H.PALETTE[0] && H.PALETTE.length === 8);
ok('...the eight colours repeat for a ninth lane (a heat race can have more participants than lanes)', H.laneColor(null, 8) === H.PALETTE[0] && H.laneColor(null, 11) === H.PALETTE[3]);
ok('...text that is not a plain colour is never used (it goes into a style)', H.laneColor({ laneColors: [{ bg: 'red;background:url(x)' }, { bg: 'url(http://x)' }, { bg: '#fff"onclick="x' }, { bg: 5 }] }, 0) === H.PALETTE[0] && H.laneColor({ laneColors: [{}, { bg: 'url(http://x)' }] }, 1) === H.PALETTE[1] && H.laneColor({ laneColors: [{}, {}, { bg: '#fff"onclick="x' }] }, 2) === H.PALETTE[2] && H.laneColor({ laneColors: [{}, {}, {}, { bg: 5 }] }, 3) === H.PALETTE[3]);
ok('...a number that is not a lane is lane 1', H.laneColor(null, NaN) === H.PALETTE[0] && H.laneColor(null, undefined) === H.PALETTE[0]);

// ---- the record to beat ----
const laps = [lap(5200), lap(4812, { driverId: 'd2', carId: 'c2', sessionId: 's2', date: '2026-09-12T10:00:00.000Z' }), lap(4700, { driverId: 'd3', noTrackRecord: true, noPersonalBest: true, invalid: true }), lap(4000, { token: true, driverId: 'd3' }), lap(4100, { trackId: 't2' }), lap(0, { driverId: 'd3' }), lap(NaN, { driverId: 'd3' })];
const sessions = [{ id: 's1', setupName: 'Club race', sessionType: 'race', date: '2026-10-01T10:00:00.000Z', trackId: 't1' }, { id: 's2', setupName: 'Practice night', sessionType: 'practice', date: '2026-09-12T10:00:00.000Z', trackId: 't1' }];
ok('the track record is the fastest lap on the track: not a lap that was taken out of the records, a token lap, a lap of another track or a lap without a time', H.trackRecord(laps, 't1').time === 4812);
ok('...no laps, no track, or a track without laps: no record', H.trackRecord([], 't1') === null && H.trackRecord(laps, '') === null && H.trackRecord(laps, 't9') === null && H.trackRecord(null, 't1') === null);
ok('...a lap that was removed from the track records but not from the personal bests is not the record', H.trackRecord([lap(4000, { noTrackRecord: true }), lap(5000)], 't1').time === 5000);
ok('the quickest personal best on the grid: only the drivers on it, and not a lap that left the personal bests', H.bestOnGrid(laps, 't1', ['d1', 'd3']).time === 5200 && H.bestOnGrid(laps, 't1', ['d2']).time === 4812 && H.bestOnGrid(laps, 't1', ['d3']) === null && H.bestOnGrid(laps, 't1', []) === null && H.bestOnGrid(laps, '', ['d1']) === null);
let rc = H.recordCard({ laps, sessions, trackId: 't1', driverIds: ['d1', ''], driverName, carName });
ok('the record card says time, driver, car, date and race of the record', rc.record.text === '4.812' && rc.record.time === 4812 && rc.record.driver === 'Sam' && rc.record.car === 'Ford GT40' && rc.record.date === '2026-09-12T10:00:00.000Z' && rc.record.setupName === 'Practice night');
ok('...and who on the grid is closest, with the gap', rc.line === 'Closest on the grid: Dutch, 5.200 (+0.388).');
ok('...the holder of the record on the grid is told so', H.recordCard({ laps, sessions, trackId: 't1', driverIds: ['d2', 'd1'], driverName, carName }).line === 'Sam is on the grid and holds the record.');
ok('...a driver who is as quick as the record (the record lap was removed from the records) counts as the holder', H.recordCard({ laps: [lap(5000, { noTrackRecord: true }), lap(5200, { driverId: 'd2' })], sessions, trackId: 't1', driverIds: ['d1'], driverName, carName }).line === 'Dutch is on the grid and holds the record.');
ok('...nobody on the grid has a lap here', H.recordCard({ laps, sessions, trackId: 't1', driverIds: ['d3'], driverName, carName }).line === 'Nobody on the grid has a lap on this track yet.');
ok('...no drivers on the grid (a Time Token lane, a team race): the record only', H.recordCard({ laps, sessions, trackId: 't1', driverIds: [], driverName, carName }).line === '' && H.recordCard({ laps, sessions, trackId: 't1', driverName, carName }).record.text === '4.812');
ok('...a track without a lap has no record yet, and a setup without a track has no card', JSON.stringify(H.recordCard({ laps: [], sessions, trackId: 't1', driverName, carName })) === '{"record":null,"line":""}' && H.recordCard({ laps, sessions, trackId: '', driverName, carName }) === null);
ok('...a driver or a car that was deleted is said so (a Guest has no driver at all)', (() => { const r = H.recordCard({ laps: [lap(4000, { driverId: 'gone', carId: 'gone' })], sessions: [], trackId: 't1', driverName, carName }).record; return r.driver === '(deleted)' && r.car === '' && r.setupName === ''; })() && H.recordCard({ laps: [lap(4000, { driverId: '' })], sessions: [], trackId: 't1', driverName, carName }).record.driver === 'Guest');

// ---- the last race ----
const std = (pos, driverId, laps, extra) => ({ pos, driverId, driverName: names[driverId], carId: 'c1', laps, best: 5000 + pos * 100, ...extra });
const race = { id: 's1', setupName: 'Club race', sessionType: 'race', trackName: 'Living room', date: '2026-10-10T18:00:00.000Z', standings: [std(2, 'd1', 20), std(1, 'd2', 20), std(3, 'd3', 19), std(4, 'd4', 3)] };
const older = { id: 's0', setupName: 'Old', sessionType: 'race', date: '2026-09-01T18:00:00.000Z', standings: [std(1, 'd1', 10)] };
const tok = { id: 'st', setupName: 'Tokens', sessionType: 'tokens', date: '2026-10-15T18:00:00.000Z', standings: [std(1, 'd1', 5)] };
ok('the last race is the newest one, never a Time Token Session', H.lastSession([older, race, tok]) === race && H.lastSession([race, older]) === race && H.lastSession([tok]) === null && H.lastSession([]) === null && H.lastSession(null) === null);
ok('...two on the same moment: the one saved later', H.lastSession([{ id: 'a', date: 'x' }, { id: 'b', date: 'x' }]).id === 'b');
ok('the podium has the first three, in the order of their position, with their laps', JSON.stringify(H.podium(race)) === JSON.stringify([{ pos: 1, name: 'Sam', detail: '20 laps' }, { pos: 2, name: 'Dutch', detail: '20 laps' }, { pos: 3, name: 'Mila', detail: '19 laps' }]));
ok('...one lap is "1 lap"; a car without a lap is not on it; a disqualified car is not on it', H.podium({ sessionType: 'race', standings: [std(1, 'd1', 1), std(2, 'd2', 0), std(3, 'd3', 5, { dq: true })] }).length === 1 && H.podium({ sessionType: 'race', standings: [std(1, 'd1', 1)] })[0].detail === '1 lap');
ok('...a race on points says the points', H.podium({ sessionType: 'heats', resultBy: 'points', standings: [std(1, 'd1', 30, { points: 25 }), std(2, 'd2', 30, { points: 18 })] }).map(x => x.detail).join() === '25 pts,18 pts');
ok('...a team that raced as a team is shown by the name of the team', H.podium({ sessionType: 'endurance', standings: [{ pos: 1, asTeam: true, driverId: '', driverName: 'Fallback', teamName: 'Red Bulls', laps: 90 }] })[0].name === 'Red Bulls');
ok('...qualifying and practice say the best lap and leave out a car that had none', JSON.stringify(H.podium({ sessionType: 'qualifying', standings: [std(1, 'd1', 4), std(2, 'd2', 3, { best: null })] })) === JSON.stringify([{ pos: 1, name: 'Dutch', detail: '5.100' }]));
const lr = H.lastRace({ sessions: [older, race, tok], laps: [lap(4861, { driverId: 'd2' }), lap(4500, { driverId: 'd1', invalid: true }), lap(4600, { driverId: 'd1', late: true }), lap(4700, { driverId: 'd3', tooSlow: true }), lap(4000, { driverId: 'd1', sessionId: 's0' }), lap(3000, { token: true })], driverName });
ok('the last race card: label, the race, the date, the podium and the fastest valid lap of that race', lr.label === 'Last race' && lr.setupName === 'Club race' && lr.trackName === 'Living room' && lr.date === race.date && lr.podium.length === 3 && lr.fastest.text === '4.861' && lr.fastest.driver === 'Sam');
ok('...a race without laps in the list has no fastest lap; nothing raced: no card', H.lastRace({ sessions: [race], laps: [], driverName }).fastest === null && H.lastRace({ sessions: [], laps: [], driverName }) === null && H.lastRace({ sessions: [tok], laps: [], driverName }) === null);
ok('...the label follows the kind of session', H.lastRace({ sessions: [{ ...race, sessionType: 'qualifying' }], laps: [] }).label === 'Last qualifying' && H.lastRace({ sessions: [{ ...race, sessionType: 'practice' }], laps: [] }).label === 'Last free practice' && H.lastRace({ sessions: [{ ...race, sessionType: 'timed' }], laps: [] }).label === 'Last race' && H.lastRace({ sessions: [{ ...race, sessionType: 'odd' }], laps: [] }).label === 'Last session');

// ---- at a glance ----
const gl = H.glance({ sessions: [race, older, tok, { id: 'sq', sessionType: 'qualifying', date: '2026-10-02', standings: [std(1, 'd3', 4)] }], tracks: [track, track2], driverName,
  laps: [lap(5000), lap(5000), lap(5000, { pit: true }), lap(5000, { invalid: true }), lap(5000, { tooSlow: true }), lap(5000, { late: true }), lap(5000, { trackId: 't2' }), lap(5000, { token: true })] });
ok('at a glance counts the races (not qualifying, practice or token sessions)', gl.races === 2);
ok('...the laps that are valid (not invalid, too slow or late, not token laps)', gl.laps === 4);
ok('...the distance: every lap that counts (also a pit lap) times the length of the track, over all the tracks', gl.distance === 10 * 3 + 25);
ok('...who won most: one win each here, so the one who won last', gl.wins.name === 'Sam' && gl.wins.count === 1);
ok('...a driver with two wins beats a driver with one', H.glance({ sessions: [race, { ...older, standings: [std(1, 'd2', 5)] }, { ...older, id: 'x', standings: [std(1, 'd1', 5)] }], laps: [], tracks: [], driverName }).wins.name === 'Sam' && H.glance({ sessions: [race, { ...older, standings: [std(1, 'd2', 5)] }], laps: [], tracks: [], driverName }).wins.count === 2);
ok('...a tie goes to the one who won last', H.glance({ sessions: [older, race], laps: [], tracks: [], driverName }).wins.name === 'Sam');
ok('...a win in qualifying or practice, a disqualified or lapless winner and a Guest are not wins', H.glance({ sessions: [{ id: 'q', sessionType: 'qualifying', date: 'a', standings: [std(1, 'd1', 4)] }, { id: 'r', sessionType: 'race', date: 'b', standings: [std(1, 'd1', 4, { dq: true }), std(2, 'd2', 0), std(3, '', 9, { driverName: 'Guest' })] }], laps: [], tracks: [], driverName }).wins === null);
ok('...a team that raced as a team can win; it is counted under the name of the team', H.glance({ sessions: [{ id: 'e', sessionType: 'endurance', date: 'a', standings: [{ pos: 1, asTeam: true, teamId: 'tm1', teamName: 'Red Bulls', driverName: 'Red Bulls', laps: 50 }] }, { id: 'e2', sessionType: 'endurance', date: 'b', standings: [{ pos: 1, asTeam: true, teamId: 'tm1', teamName: 'Red Bulls', driverName: 'Red Bulls', laps: 50 }] }], laps: [], tracks: [], driverName }).wins.count === 2);
ok('...a track without a length has no distance; nothing raced has nothing', H.glance({ sessions: [], laps: [lap(5000)], tracks: [{ id: 't1', lanes: 2 }], driverName }).distance === null && JSON.stringify(H.glance({ sessions: [], laps: [], tracks: [], driverName })) === '{"races":0,"laps":0,"distance":null,"wins":null}' && JSON.stringify(H.glance({})) === '{"races":0,"laps":0,"distance":null,"wins":null}');

// ---- the chips ----
const names2 = list => list.map(c => c.key + ':' + c.state).join();
ok('the chips: Trackmate, network, audio of the setup and the counts', names2(H.chips({ trackmate: true, netOn: true, hasSetup: true, audioName: 'Club', drivers: 4, cars: 6, tracks: 1 })) === 'tm:on,net:on,audio:on,count:');
ok('...the words', H.chips({ trackmate: true, netOn: true, hasSetup: true, audioName: 'Club', drivers: 4, cars: 6, tracks: 1 }).map(c => c.text).join(' | ') === 'Trackmate connected | Shared on the network | Audio: Club | 4 drivers · 6 slotcars · 1 track');
ok('...not connected, not shared, no audio', H.chips({ trackmate: false, netOn: false, hasSetup: true, audioName: '', drivers: 1, cars: 1, tracks: 0 }).map(c => c.text + '/' + c.state).join(' | ') === 'Trackmate not connected/off | Not shared on the network/off | No audio/off | 1 driver · 1 slotcar · 0 tracks/');
ok('...a network that could not start is a warning; no setup: no audio chip', H.chips({ netOn: false, netError: 'Port in use', hasSetup: false })[1].state === 'warn' && !H.chips({ hasSetup: false }).some(c => c.key === 'audio'));

// ---- the start lights ----
ok('a row is ready with a driver and a car; a team row with a team and a car; a token lane always', H.rowReady({ driverId: 'd', carId: 'c' }) && !H.rowReady({ driverId: 'd' }) && !H.rowReady({ carId: 'c' }) && !H.rowReady({ teamId: 't', carId: 'c' }) && H.rowReady({ teamId: 't', carId: 'c' }, { byTeam: true }) && !H.rowReady({ teamId: 't' }, { byTeam: true }) && H.rowReady({ teamId: 't', carId: 'c' }, { enduSingle: true }) && H.rowReady({}, { tokens: true }) && !H.rowReady(null));
const L = H.lights([{ driverId: 'a', carId: 'b' }, { driverId: 'a', carId: 'b' }, { driverId: 'a', carId: 'b' }, { driverId: '', carId: '' }]);
ok('the lights: one for every lane, lit when the lane is ready, with the words', L.total === 4 && L.ready === 3 && L.ok.join() === 'true,true,true,false' && L.text === '3 of 4 lanes are ready.');
ok('...all ready, one ready, one lane, nothing at all', H.lights([{ driverId: 'a', carId: 'b' }, { driverId: 'a', carId: 'b' }]).text === 'All 2 lanes are ready.' && H.lights([{ driverId: 'a', carId: 'b' }, {}]).text === '1 of 2 lanes is ready.' && H.lights([{ driverId: 'a', carId: 'b' }]).text === 'The lane is ready.' && H.lights([]).text === '' && H.lights(null).total === 0);
ok('...when something else still stops the race (blocked) a full grid is filled in, not ready; a grid that is not full says ready as before', H.lights([{ driverId: 'a', carId: 'b' }, { driverId: 'c', carId: 'b' }], null, 'lane', true).text === 'All 2 lanes are filled in.' && H.lights([{ driverId: 'a', carId: 'b' }], null, 'lane', true).text === 'The lane is filled in.' && H.lights([{ driverId: 'a', carId: 'b' }, {}], null, 'lane', true).text === '1 of 2 lanes is ready.');
ok('...a participant who is not here today is not counted; the word follows the race', H.lights([{ driverId: 'a', carId: 'b' }, { absent: true }], null, 'participant').text === 'The participant is ready.' && H.lights([{ teamId: 't', carId: 'c' }, {}], { byTeam: true }, 'team').text === '1 of 2 teams is ready.');

console.log(fails ? fails + ' HOME TESTS FAILED' : 'ALL HOME TESTS PASSED'); process.exit(fails ? 1 : 0);
