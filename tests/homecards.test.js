// 1.25.0: the cards of Home (homecards.js): the words and the markup of every card, made from figures. The figures themselves are tested in homestats.test.js.
const C = require('../renderer/homecards.js');
const H = require('../renderer/homestats.js');
const G = require('../renderer/homegrid.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const count = (s, re) => (s.match(re) || []).length;

const d = { fmtDate: iso => (iso ? 'D:' + iso.slice(0, 10) : ''), fmtShort: iso => (iso ? 'S:' + iso.slice(5, 10) : ''), fmtDist: m => m + ' m', trackName: 'Living <room>', hasTrack: true, hasSetup: true, setupName: 'Club "night"' };
const board = (card, opt = {}) => ({ c: 1, r: 1, w: 1, h: 1, opt: { card, ...opt } });

// ---- Start a race and the unknown ----
ok('Start a race is not made here (it is the form of the page), and a card that is not known is nothing', C.html('start', d, board('start')) === '' && C.html('nope', d, board('nope')) === '' && C.html('', d, null) === '');
ok('the cards that need races to show anything are the eight with figures from the laps; the rules and the shortcuts do not', C.NEEDS_RACES.join() === 'record,last,glance,recent,fastest,records,top,bests' && !C.NEEDS_RACES.includes('rules') && !C.NEEDS_RACES.includes('shortcuts'));
ok('...with nothing raced a friendly card says what will show up (the card of before)', C.empty().includes('class="card hm-empty"') && C.empty().includes('Your racing shows up here') && C.empty().includes('the record to beat on your track'));

// ---- the three cards of before: the same markup ----
const rec = { record: { text: '4.861', driver: 'Sam <b>', car: 'Ford', date: '2026-10-10T18:00:00.000Z', setupName: 'Club race' }, line: 'Sam is on the grid and holds the record.' };
const r1 = C.html('record', { ...d, rec }, board('record'));
ok('the record to beat: the time, who, the car, the date, the setup, and the line about the grid; every word is made safe', r1.startsWith('<section class="card hm-rec"><h3>Record to beat<span class="hm-tag">Living &lt;room&gt;</span></h3>') && r1.includes('<div class="hm-time">4.861</div>') && r1.includes('<strong>Sam &lt;b&gt;</strong> · Ford') && r1.includes('<small>D:2026-10-10 · Club race</small>') && r1.includes('<p class="hint2">Sam is on the grid and holds the record.</p>') && !r1.includes('<b>'));
ok('...no lap on the track yet says so; no line when there is none; a setup with no track says that', C.html('record', { ...d, rec: { record: null, line: '' } }, board('record')).includes('No lap has been saved on this track yet. The first lap sets the record.') && !C.html('record', { ...d, rec: { record: rec.record, line: '' } }, board('record')).includes('hint2') && C.html('record', { ...d, rec: null }, board('record')).includes('has no track yet'));
const last = { label: 'Last race', date: '2026-10-10T18:00:00.000Z', setupName: 'Club race', trackName: 'Living room', podium: [{ pos: 1, name: 'Sam', detail: '20 laps' }, { pos: 2, name: 'Dutch', detail: '20 laps' }, { pos: 3, name: 'Mila', detail: '19 laps' }], fastest: { text: '4.861', driver: 'Sam' } };
const l1 = C.html('last', { ...d, last }, board('last'));
ok('the last race: the podium with the places, and the race, the track and the fastest lap under it', l1.includes('<h3>Last race<span class="hm-tag">D:2026-10-10</span></h3>') && count(l1, /<li class="p\d">/g) === 3 && l1.includes('<li class="p1"><span class="n">1</span><strong>Sam</strong><small>20 laps</small></li>') && l1.includes('Club race on Living room · Fastest lap: Sam, 4.861'));
ok('...no car finished a lap, no track and no fastest lap are said as they are', C.html('last', { ...d, last: { ...last, podium: [], trackName: '', fastest: null } }, board('last')).includes('No car finished a lap.') && !C.html('last', { ...d, last: { ...last, trackName: '', fastest: null } }, board('last')).includes('Fastest lap') && C.html('last', { ...d, last: null }, board('last')).includes('No race has been saved yet.'));
const gl = { races: 2, laps: 1234, distance: 65, wins: { name: 'Sam', count: 3 } };
const g1 = C.html('glance', { ...d, glance: gl }, board('glance'));
ok('at a glance: four tiles with the races, the laps, the distance and who won most', count(g1, /class="hm-tile"/g) === 4 && g1.includes('<div class="v">2</div><div class="l">races raced</div>') && g1.includes('laps driven') && g1.includes('<div class="v">65 m</div>') && g1.includes('<div class="v">Sam</div><div class="l">most wins (3)</div>'));
ok('...one race and one lap, no distance and no winner are said as they are', C.html('glance', { ...d, glance: { races: 1, laps: 1, distance: null, wins: null } }, board('glance')).includes('race raced') && C.html('glance', { ...d, glance: { races: 1, laps: 1, distance: null, wins: null } }, board('glance')).includes('<div class="v">–</div><div class="l">distance</div>') && C.html('glance', { ...d, glance: { races: 1, laps: 1, distance: null, wins: null } }, board('glance')).includes('<div class="l">most wins</div>') && C.html('glance', { ...d, glance: { races: 1, laps: 1, distance: null, wins: null } }, board('glance')).includes('1</div><div class="l">lap driven'));

// ---- recent races ----
const rows = [{ id: 'a"b', date: '2026-10-11T10:00:00.000Z', name: 'Sunday <heats>', kind: 'Heat-based race', result: 'Alex won' }, { id: 'c', date: '2026-10-09T10:00:00.000Z', name: 'Quick', kind: '', result: '' }];
const rc = C.html('recent', { ...d, recent: rows }, board('recent'));
ok('recent races: a row for each, the date, the name and the result, in a button that carries the session', count(rc, /<button type="button" class="hm-row"/g) === 2 && rc.includes('data-session="a&quot;b"') && rc.includes('<span class="d">S:10-11</span><span class="n">Sunday &lt;heats&gt;</span><span class="r">Alex won</span>') && rc.includes('<h3>Recent races<span class="hm-tag">last 2</span></h3>'));
ok('...no race: it says so, without the tag', C.html('recent', { ...d, recent: [] }, board('recent')).includes('No race has been saved yet.') && !C.html('recent', { ...d, recent: [] }, board('recent')).includes('hm-tag'));

// ---- fastest laps this week ----
const fw = { since: new Date(), tracks: [{ trackId: 't1', trackName: 'Living room', rows: [{ driver: 'Sam', text: '5.100' }, { driver: 'Dutch', text: '5.200' }] }, { trackId: 't2', trackName: 'Garage', rows: [{ driver: 'Mila <i>', text: '8.800' }] }] };
const fa = C.html('fastest', { ...d, fastest: { ...fw, tracks: [fw.tracks[0]] }, fastestScope: 'track' }, board('fastest'));
ok('fastest laps of the week on one track: a ranked list, the track in the tag and no heading', fa.includes('<span class="hm-tag">Living &lt;room&gt;</span>') && count(fa, /<li>/g) === 2 && fa.includes('<li><span class="n">1</span><span class="w">Sam</span><strong>5.100</strong></li>') && !fa.includes('hm-h4'));
const fb = C.html('fastest', { ...d, fastest: fw, fastestScope: 'all' }, board('fastest'));
ok('...all tracks: a heading and a list for every track, "all tracks" in the tag; a name is made safe', fb.includes('<span class="hm-tag">all tracks</span>') && count(fb, /<h4 class="hm-h4">/g) === 2 && fb.includes('<h4 class="hm-h4">Garage</h4>') && fb.includes('Mila &lt;i&gt;') && !fb.includes('<i>'));
ok('...a week with no lap says so, for the track and for all tracks', C.html('fastest', { ...d, fastest: { tracks: [] }, fastestScope: 'track' }, board('fastest')).includes('No lap has been driven on Living &lt;room&gt; this week yet.') && C.html('fastest', { ...d, fastest: { tracks: [] }, fastestScope: 'all' }, board('fastest')).includes('No lap has been driven this week yet.'));

// ---- records on all tracks ----
const rs = [{ trackName: 'Garage', text: '8.000', driver: 'Mila', car: 'Ford', date: '2026-10-05T10:00:00.000Z' }, { trackName: 'Living <room>', text: '5.200', driver: 'Dutch', car: '', date: '' }];
const ra = C.html('records', { ...d, records: rs }, board('records'));
ok('records on all tracks: a row for each track with the time, and who set it, with what car and when', count(ra, /class="hm-recrow2"/g) === 2 && ra.includes('<strong>Garage</strong><small>Mila · Ford · D:2026-10-05</small>') && ra.includes('<strong>Living &lt;room&gt;</strong><small>Dutch</small>') && ra.includes('<b class="hm-time sm">8.000</b>'));
ok('...no lap yet: it says so', C.html('records', { ...d, records: [] }, board('records')).includes('No lap has been saved yet.'));

// ---- top drivers ----
const tp = C.html('top', { ...d, top: [{ name: 'Alex', count: 12 }, { name: 'Sam', count: 6 }, { name: 'Lee', count: 1 }], topPeriod: 'year' }, board('top'));
ok('top drivers: a bar for each, as long as the wins compared to the first, with the number of wins', count(tp, /class="hm-bar"/g) === 3 && tp.includes('<i style="width:100%"></i>') && tp.includes('<i style="width:50%"></i>') && tp.includes('<b>12</b>') && tp.includes('<span class="hm-tag">wins this year</span>'));
ok('...a small number of wins still has a bar you can see; all time says so; nobody has won: it says so for the year and for all time', tp.includes('<i style="width:8%"></i>') && C.html('top', { ...d, top: [{ name: 'Alex', count: 40 }, { name: 'Lee', count: 1 }], topPeriod: 'year' }, board('top')).includes('<i style="width:4%"></i>') && C.html('top', { ...d, top: [{ name: 'Alex', count: 1 }], topPeriod: 'all' }, board('top')).includes('wins, all time') && C.html('top', { ...d, top: [], topPeriod: 'year' }, board('top')).includes('Nobody has won a race this year yet.') && C.html('top', { ...d, top: [], topPeriod: 'all' }, board('top')).includes('Nobody has won a race yet.'));

// ---- personal bests of the drivers on the grid ----
const bs = [{ name: 'Alex', color: '#112233', text: '5.512', time: 5512 }, { name: 'Sam <b>', color: 'red;x', text: '–', time: null }, { name: 'Kim', color: 'hsl(10 50% 50%)', text: '5.943', time: 5943 }];
const bt = C.html('bests', { ...d, bests: bs }, board('bests'));
ok('personal bests of the drivers on the grid: a row for each driver with a dot in the colour of the lane and the time, "–" in grey for a driver with no lap', count(bt, /class="hm-kv"/g) === 3 && bt.includes('<i class="hm-dot" style="--c:#112233"></i>Alex') && bt.includes('<strong>5.512</strong>') && bt.includes('<strong class="muted">–</strong>') && bt.includes('<span class="hm-tag">Living &lt;room&gt;</span>'));
ok('...a colour that is not plain colour text is never used (it goes into a style), and a name is made safe', !bt.includes('red;x') && bt.includes('<i class="hm-dot" style=""></i>Sam &lt;b&gt;') && bt.includes('--c:hsl(10 50% 50%)'));
ok('...a setup with no track, or nobody in the lanes, says so', C.html('bests', { ...d, hasTrack: false, bests: [] }, board('bests')).includes('has no track yet') && C.html('bests', { ...d, bests: [] }, board('bests')).includes('Choose the drivers for the lanes'));

// ---- the rules of this race ----
const ru = C.html('rules', { ...d, rules: [['Race', 'Heat-based race'], ['Length', '3 heats of 6 laps'], ['Weather', 'Rain <b>']] }, board('rules'));
ok('the rules of this race: a line for each rule, with the name of the race setup in the tag', count(ru, /class="hm-kv"/g) === 3 && ru.includes('<span class="muted">Length</span><strong>3 heats of 6 laps</strong>') && ru.includes('<span class="hm-tag">Club &quot;night&quot;</span>') && ru.includes('Rain &lt;b&gt;') && !ru.includes('<b>'));
ok('...no race setup: it says to make one', C.html('rules', { ...d, hasSetup: false, rules: [] }, board('rules')).includes('Create a race setup in the Race Setup tab'));

// ---- shortcuts ----
const sh = C.html('shortcuts', d, board('shortcuts'));
ok('shortcuts: a button for each page that is on, with the page in data-go, in the order of the list', count(sh, /<button type="button" class="btn" data-go=/g) === 6 && sh.indexOf('data-go="results"') < sh.indexOf('data-go="drivers"') && sh.includes('>Results and Records</button>') && sh.includes('data-go="help"') && !sh.includes('data-go="rules"'));
ok('...the pages that are ticked in the card are the ones shown; none: it says so', C.html('shortcuts', d, board('shortcuts', { go_rules: true, go_help: false })).includes('data-go="rules"') && !C.html('shortcuts', d, board('shortcuts', { go_rules: true, go_help: false })).includes('data-go="help"') && C.html('shortcuts', d, board('shortcuts', Object.fromEntries(G.SHORTCUTS.map(s => ['go_' + s.key, false])))).includes('No shortcut is switched on'));

// ---- the cards made from the real figures ----
{ const names = { d1: 'Dutch' }, sess = { id: 's1', setupName: 'Club', sessionType: 'race', date: '2026-10-10T18:00:00.000Z', standings: [{ pos: 1, driverId: 'd1', driverName: 'Dutch', laps: 5, best: 5000 }] };
  const real = C.html('recent', { ...d, recent: H.recent({ sessions: [sess] }) }, board('recent'));
  ok('the card of a recent race made from the real figures says who won', real.includes('data-session="s1"') && real.includes('Dutch won') && names.d1 === 'Dutch'); }

console.log(fails ? fails + ' HOME CARD TESTS FAILED' : 'ALL HOME CARD TESTS PASSED');
process.exit(fails ? 1 : 0);
