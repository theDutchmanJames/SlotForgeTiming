const { sessionHtml, fileName, lapGroups, rulesHtml, CREDIT } = require('../renderer/report.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const st = [{ pos: 1, driverId: 'd1', carId: 'c1', driverName: 'Alex', carName: 'NSR Ford GT40', laps: 3, best: 5000, total: 16000 },
            { pos: 2, driverId: 'd2', carId: 'c2', driverName: 'Sam <b>', carName: 'Slot.it Porsche', laps: 2, best: 5600, total: 12000 }];
const session = { id: 's1', setupName: 'Friday "Sprint"', sessionType: 'race', trackName: 'Living room', date: '2026-10-11T18:30:00Z', endedBy: 'Every car finished', standings: st };
const lap = (d, c, n, time, heat) => ({ driverId: d, carId: c, lapNumber: n, time, heat });
const laps = [lap('d1', 'c1', 1, 5200), lap('d1', 'c1', 2, 5000), lap('d1', 'c1', 3, 5800), lap('d2', 'c2', 1, 6400), lap('d2', 'c2', 2, 5600)];
let h = sessionHtml({ session, laps });
ok('page 1 has the title, session type, track and date', h.includes('Friday &quot;Sprint&quot;') && h.includes('Race by laps') && h.includes('Living room') && h.includes('11 October 2026'));
ok('standings show position, driver, car, laps, best lap and total time', h.includes('<th>Total time</th>') && h.includes('NSR Ford GT40') && h.includes('5.000') && h.includes('16.000'));
ok('names are escaped (no HTML injection)', h.includes('Sam &lt;b&gt;') && !h.includes('Sam <b>'));
ok('lap times start on a new page', /class="page2"/.test(h) && h.includes('page-break-before: always') && h.indexOf('All lap times') > h.indexOf('Results'));
ok('every lap time is listed', ['5.200', '5.000', '5.800', '6.400', '5.600'].every(t => h.includes(t)));
ok('the fastest lap of each driver is bold', h.includes('<b>5.000</b>') && h.includes('<b>5.600</b>') && !h.includes('<b>5.200</b>'));
ok('lap table header repeats on every page', h.includes('thead { display: table-header-group; }'));
ok('a driver with fewer laps leaves an empty cell', /<tr><td>3<\/td><td>5\.800<\/td><td><\/td><\/tr>/.test(h));
ok('no points column in a normal race', !h.includes('<th>Points</th>'));
ok('file name is safe and readable', fileName(session) === 'Friday -Sprint- 2026-10-11.pdf');
ok('session without laps still makes a report', sessionHtml({ session, laps: [] }).includes('No laps were recorded.'));

// heats with points
const hs = { ...session, setupName: 'Club night', sessionType: 'heats', resultBy: 'points', endedBy: '',
  standings: [{ pos: 1, driverId: 'd1', carId: 'c1', driverName: 'Alex', carName: 'A', laps: 4, points: 20, best: 5000, total: null }, { pos: 2, driverId: 'd2', carId: 'c2', driverName: 'Sam', carName: 'B', laps: 4, points: 14, best: 5100, total: null }],
  heatResults: [{ heat: 1, rows: [{ pos: 1, driverName: 'Alex', laps: 2, points: 10 }, { pos: 2, driverName: 'Sam', laps: 2, points: 8 }] }, { heat: 2, rows: [{ pos: 1, driverName: 'Sam', laps: 2, points: 10 }, { pos: 2, driverName: 'Alex', laps: 2, points: 6 }] }] };
const hl = [lap('d1', 'c1', 1, 5100, 1), lap('d1', 'c1', 2, 5000, 1), lap('d2', 'c2', 1, 5300, 1), lap('d2', 'c2', 2, 5200, 1), lap('d1', 'c1', 1, 5400, 2), lap('d2', 'c2', 1, 5100, 2)];
h = sessionHtml({ session: hs, laps: hl });
ok('heats: points column and heat summary on page 1', h.includes('<th>Points</th>') && h.includes('<b>Heat 1</b>') && h.includes('10 pts') && !h.includes('<th>Total time</th>'));
ok('heats: lap times grouped per heat', lapGroups(hs, hl).length === 2 && h.includes('<h2>Heat 2</h2>'));
ok('heats counted the standard way (a result of before): no Result column, no line about the counting', !h.includes('<th>Result</th>') && !h.includes('Overall result:'));
{ // 0.94.0: a heat race with its own way of counting
  const sc = { countBy: 'average', bestHeats: 2, dropWorst: true, fastestBonus: 2, tieBreak: 'wins' };
  const hs2 = { ...hs, scoring: sc, standings: hs.standings.map((x, i) => ({ ...x, score: [9, 8.3333333][i], counted: 2, heats: [2, 3][i] })),
    heatResults: [{ heat: 1, rows: [{ pos: 1, driverName: 'Alex', laps: 2, points: 12, bonus: 2 }, { pos: 2, driverName: 'Sam', laps: 2, points: 8 }] }] };
  const h2 = sessionHtml({ session: hs2, laps: hl });
  ok('heats with their own counting: a Result column with the number that counts ("9 avg", "8.33 avg (2 of 3 heats)")', h2.includes('<th>Result</th>') && h2.includes('<td>9 avg</td>') && h2.includes('<td>8.33 avg (2 of 3 heats)</td>'));
  ok('...a line under the results says how it was counted, and the bonus is named in the heat', h2.includes('Overall result: the average per heat; the worst heat of every driver is dropped; 2 bonus points for the fastest lap of every heat; a tie is decided by the most heat wins first.') && h2.includes('12 pts incl. 2 for the fastest lap') && h2.includes('8 pts)'));
  const only = sessionHtml({ session: { ...hs, scoring: { countBy: 'total', bestHeats: 2, dropWorst: false, fastestBonus: 1, tieBreak: 'default' } }, laps: hl });
  ok('only a bonus: the line is there, and there is no Result column (the standings have no Result numbers)', only.includes('1 bonus point for the fastest lap of every heat') && !only.includes('<th>Result</th>'));
  const plain = sessionHtml({ session: { ...hs2, sessionType: 'race', standings: hs2.standings }, laps: hl });
  ok('only heat races get the column and the line', !plain.includes('<th>Result</th>') && !plain.includes('Overall result:'));
}
{ // 0.96.0: a heat race with finals
  const fin = mode => ({ ...hs, finals: { finals: 'ab', finalMode: mode },
    standings: [{ ...hs.standings[0], finalName: 'A', finalPos: 1, ...(mode === 'added' ? { score: 28, counted: 2, heats: 2, heatScore: 18, finalPoints: 10, finalLaps: 4 } : {}) }, { ...hs.standings[1], finalName: 'B', finalPos: 2 }],
    ...(mode === 'added' ? { scoring: { countBy: 'total', bestHeats: 2, dropWorst: false, fastestBonus: 0, tieBreak: 'default' } } : {}),
    heatResults: [{ heat: 1, rows: [{ pos: 1, driverName: 'Alex', laps: 2, points: 10 }] }, { heat: 2, final: 'B', rows: [{ pos: 1, driverName: 'Sam', laps: 2, points: 10 }] }, { heat: 3, final: 'A', rows: [{ pos: 1, driverName: 'Alex', laps: 2, points: 10 }] }] });
  const fl = [lap('d1', 'c1', 1, 5100, 1), { ...lap('d2', 'c2', 1, 5300, 2), final: 'B' }, { ...lap('d1', 'c1', 1, 5000, 3), final: 'A' }];
  let hf = sessionHtml({ session: fin('places'), laps: fl });
  ok('finals: a Final column ("Final A: 1st", "Final B: 2nd") and a line that says how they counted', hf.includes('<th>Final</th>') && hf.includes('<td>Final A: 1st</td>') && hf.includes('<td>Final B: 2nd</td>') && hf.includes('The finals decide the final places.'));
  ok('...the heats and finals are named in the summary and for the laps', hf.includes('<h2>Heats and finals</h2>') && hf.includes('<b>Heat 1</b>') && hf.includes('<b>Final B</b>') && hf.includes('<b>Final A</b>') && hf.includes('<h2>Final A</h2>') && hf.includes('<h2>Final B</h2>') && hf.includes('<h2>Heat 1</h2>') && !hf.includes('<h2>Heat 3</h2>'));
  ok('...the laps of the final are in a group of their own, with the right lap times', lapGroups(fin('places'), fl).map(g => g.heat + (g.final || '')).join() === '1,2B,3A');
  hf = sessionHtml({ session: fin('added'), laps: fl });
  ok('...with the final added, the Result column shows the sum, and the line says so', hf.includes('<td>18 + 10 final = 28</td>') && hf.includes('What a driver scores in a final is added to the heat result.'));
  const nofin = sessionHtml({ session: hs, laps: hl });
  ok('...a heat race without finals is as before: heading Heats, no Final column', nofin.includes('<h2>Heats</h2>') && !nofin.includes('Heats and finals') && !nofin.includes('<th>Final</th>'));
  ok('...only heat races have it (a race with a finals field is not changed)', !sessionHtml({ session: { ...fin('places'), sessionType: 'race' }, laps: fl }).includes('<th>Final</th>'));
  const evil = sessionHtml({ session: { ...fin('places'), standings: [{ ...fin('places').standings[0], finalName: '<i>x</i>' }, fin('places').standings[1]] }, laps: fl });
  ok('...a letter that is not a letter is written as text, not as markup', !evil.includes('<i>x</i>') && evil.includes('&lt;i&gt;x&lt;/i&gt;'));
}
// penalties in the results
{
  const ps = { ...session, standings: [{ ...st[0], penaltyPoints: 5, penalty: 5000 }, { ...st[1], penaltyPoints: 12, dq: true, penalty: 10000 }] };
  const hp = sessionHtml({ session: ps, laps });
  ok('results show the time with the penalty included, and the points', hp.includes('21.000') && hp.includes('includes +5.000 penalty, 5 points'));
  ok('a disqualified driver is marked', hp.includes('(disqualified)') && !hp.includes('out of fuel'));
}
{
  const lp = [lap('d1', 'c1', 1, 3000), { ...lap('d1', 'c1', 2, 5000), invalid: true }, lap('d1', 'c1', 3, 5800)];
  lp[0].invalid = true;
  const hi = sessionHtml({ session, laps: lp });
  ok('invalid laps are struck through and never marked as the best lap', hi.includes('<s title="invalid lap">3.000</s>') && hi.includes('<b>5.800</b>'));
}
{ const evil = '<img src=x onerror=alert(1)>';
  const html = sessionHtml({ session: { setupName: 'S', sessionType: 'race', resultBy: 'points', date: '2026-01-01', standings: [{ pos: evil, driverName: 'A', carName: 'c', laps: evil, points: evil, best: 5000, total: 20000, penalty: 2000, penaltyPoints: evil }], heatResults: [{ heat: evil, rows: [{ pos: evil, driverName: 'A', laps: evil, points: evil }] }] }, laps: [] });
  ok('numbers in a session from an imported file cannot add anything to the report page', !html.includes('<img') && html.includes('&lt;img')); }
{ const h = rulesHtml({ title: 'Club <Rules>', html: '<h2>Safety</h2><ul><li><b>No</b> pushing</li></ul><script>x()</script><font color="#ff0000" size="5">Red</font>' });
  ok('the rules page has the title, the formatting and the credit line', h.includes('<title>Club &lt;Rules&gt;</title>') && h.includes('<h2>Safety</h2>') && h.includes('<li><b>No</b> pushing</li>') && h.includes('size="5"') && h.includes('This App has been made by Claude AI and theDutchmanJames.<br>For all Slotcar Enthusiast and special greetings to the SlotForum community!'));
  ok('unsafe things in the rules never reach the printed page', !h.includes('<script'));
  ok('the credit text is exactly as asked', CREDIT.length === 2 && CREDIT[0] === 'This App has been made by Claude AI and theDutchmanJames.' && CREDIT[1] === 'For all Slotcar Enthusiast and special greetings to the SlotForum community!'); }
// ---- 1.0.0: more figures in the results, and the choice of what goes in the PDF ----
{ const tracks = [{ id: 't1', length: 10, lanes: 2, laneModifier: 'none', scale: '1:32' }];
  const s2 = { ...session, trackId: 't1', standings: [{ ...st[0], pits: 1, pitTime: 4000, penaltyPoints: 2 }, st[1]] };
  const l2 = laps.map(l => ({ ...l, trackId: 't1', lane: 1 })); l2[2] = { ...l2[2], pit: true }; // (the third lap of Alex, 5.800, is the one with the pit stop)
  const th = h => (h.match(/<table[^>]*>.*?<\/tr>/s) || [''])[0].match(/<th>(.*?)<\/th>/g).map(x => x.replace(/<\/?th>/g, ''));
  let h2 = sessionHtml({ session: s2, laps: l2, tracks, cars: [] });
  ok('the table has the figures that are on until turned off: average lap, consistency, average speed, pit stops, pit time, penalty points', th(h2).join() === 'Pos,Driver,Car,Laps,Best lap,Total time,Average lap,Consistency,Average speed,Pit stops,Pit time,Penalty points');
  ok('...with the numbers (the pit lap is left out of the average: 5.200 and 5.000 make 5.100; 20 m in 10.2 s is 7.1 km/h)', h2.includes('<td>5.100</td>') && h2.includes('7.1 km/h') && h2.includes('<td>4.000</td>') && h2.includes('<td>2</td>'));
  ok('...a driver without pit stops or points has a dash', /<td>Sam &lt;b&gt;<\/td>.*?<td>–<\/td>/s.test(h2));
  ok('...and a line under the table says how the figures are counted', h2.includes('Lap figures count the valid laps only') && h2.includes('standard deviation'));
  ok('a lap with a pit stop is in italics on the lap page, and the page says so', h2.includes('<i title="pit stop">5.800</i>') && h2.includes('A lap with a pit stop is in italics.'));
  ok('without the track there is no speed (and no empty column), the lap figures stay', !th(sessionHtml({ session: s2, laps: l2 })).includes('Average speed') && th(sessionHtml({ session: s2, laps: l2 })).includes('Average lap'));
  ok('a session saved before 1.0.0 (no pit stops, no points) has no such columns', !th(sessionHtml({ session, laps, tracks })).includes('Pit stops') && !th(sessionHtml({ session, laps, tracks })).includes('Penalty points'));
  h2 = sessionHtml({ session: s2, laps: l2, tracks, options: { columns: ['pos', 'driver', 'median', 'scalespeed', 'distance'] } });
  ok('the columns that were picked are the columns of the table, in the order of the table (also the ones that are off until turned on)', th(h2).join() === 'Pos,Driver,Median lap,Average scale speed,Distance' && h2.includes('<td>5.100</td>') && h2.includes('<td>30 m</td>'));
  ok('a column the session does not have is not added (Points in a race that is not decided on points), a column that does not exist is ignored', th(sessionHtml({ session: s2, laps: l2, options: { columns: ['pos', 'points', 'nonsense', 'driver'] } })).join() === 'Pos,Driver');
  h2 = sessionHtml({ session: s2, laps: l2, tracks, options: { results: false } });
  ok('without the results table there is no Results heading and no table of results, the lap times stay', !h2.includes('<h2>Results</h2>') && !h2.includes('<th>Pos</th>') && h2.includes('All lap times') && h2.includes('5.200'));
  h2 = sessionHtml({ session: s2, laps: l2, tracks, options: { laps: false } });
  ok('without the lap times there is no second page and no lap table', !h2.includes('All lap times') && !h2.includes('class="page2"') && !h2.includes('class="laps"') && h2.includes('<th>Pos</th>') && h2.includes('Made with SlotForge Timing'));
  ok('...nothing but the lap times still makes a page', sessionHtml({ session: s2, laps: l2, options: { results: false, heats: false } }).includes('class="laps"'));
  const hh = sessionHtml({ session: hs, laps: hl, options: { heats: false } });
  ok('the heats and finals can be left out', sessionHtml({ session: hs, laps: hl }).includes('<h2>Heats</h2>') && !hh.includes('<h2>Heats</h2>') && hh.includes('<th>Pos</th>'));
  ok('an old call without options is the same as everything on', sessionHtml({ session: s2, laps: l2, tracks }) === sessionHtml({ session: s2, laps: l2, tracks, options: { results: true, heats: true, laps: true } }));
  ok('a wide table gets a smaller print size (more than 8 columns)', h2.length > 0 && sessionHtml({ session: s2, laps: l2, tracks }).includes('<table class="wide">') && !sessionHtml({ session: s2, laps: l2, options: { columns: ['pos', 'driver'] } }).includes('<table class="wide">'));
  ok('figures cannot carry HTML into the page (a name or a number from an imported file)', !sessionHtml({ session: { ...s2, standings: [{ ...s2.standings[0], pits: '<b>x</b>', penaltyPoints: '<i>y</i>' }] }, laps: l2, tracks }).includes('<b>x</b>'));
}
console.log(fails ? fails + ' REPORT TESTS FAILED' : 'ALL REPORT TESTS PASSED'); process.exit(fails ? 1 : 0);
