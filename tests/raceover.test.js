'use strict';
// 2.4.0: the screens after a race (renderer/raceover.js, SlotForgeRestyle.md "Chequered Flag"): Race over as a broadcast graphic (the winner big with
// the lane's helmet, the highlights, the actions), the classification as a timing tower, the race story with its moments, the title fight of a
// championship as big as the race with the next round under it, the break between two heats, Event over. And how race.js uses them.
const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path');
const RO = require('../renderer/raceover.js');
const { code, has } = require('./source.cjs');

// a race of 3 drivers and 12 laps: Anna leads, Bjorn passes her on lap 3, Anna takes it back on lap 8 and wins; her 4.850 on lap 9 is the fastest lap
function race() {
  const pace = [0, 4990, 5100],
    laps = [];
  ['d0', 'd1', 'd2'].forEach((id, d) =>
    Array.from({ length: 12 }, (_, k) => {
      const time = d ? pace[d] : k < 2 ? 4950 : k < 5 ? 5080 : k === 8 ? 4850 : 4900;
      laps.push({ driverId: id, lapNumber: k + 1, lane: d + 1, time });
    })
  );
  const total = id => laps.filter(l => l.driverId === id).reduce((a, l) => a + l.time, 0),
    best = id => laps.filter(l => l.driverId === id).reduce((m, l) => Math.min(m, l.time), Infinity);
  const standings = [
    { driverId: 'd0', driverName: 'Anna', carName: 'NSR Corvette #7', lane: 0, laps: 12 },
    { driverId: 'd1', driverName: 'Bjorn', carName: 'NSR Mosler', lane: 1, laps: 12 },
    { driverId: 'd2', driverName: 'Chris', carName: 'BRM 917K', lane: 2, laps: 12 }
  ]
    .map(x => ({ ...x, total: total(x.driverId), best: best(x.driverId) }))
    .sort((a, b) => a.total - b.total)
    .map((x, i) => ({ ...x, pos: i + 1 }));
  return { session: { id: 's1', sessionType: 'race', standings }, laps };
}

test('the figures of a race: the rows with their gaps, the fastest lap, the lead changes and the moments, a track record', () => {
  const { session, laps } = race();
  const f = RO.figures(session, laps, { recordBefore: 4950, trackName: 'Club Oval' });
  assert.deepEqual(
    f.rows.map(x => [x.pos, x.name, x.lane]),
    [
      [1, 'Anna', 0],
      [2, 'Bjorn', 1],
      [3, 'Chris', 2]
    ]
  );
  assert.equal(f.rows[0].gap, '', 'the winner has no gap');
  assert.match(f.rows[1].gap, /^\+\d+\.\d{3} s$/);
  assert.deepEqual(f.fastest, { name: 'Anna', time: 4850, lap: 9 });
  assert.deepEqual(f.record, { before: 4950, now: 4850, by: 'Anna' }, 'faster than the record before the race: a new track record');
  assert.equal(f.changes, 2, 'Bjorn takes the lead, Anna takes it back');
  const texts = f.moments.map(m => `${m.lap}: ${m.text}`);
  assert(texts.some(t => /Bjorn passes Anna for the lead/.test(t)) && texts.some(t => /Anna passes Bjorn for the lead/.test(t)));
  assert(texts.some(t => /^\d+: Anna leads the last \d+ laps$/.test(t)));
  assert(texts.includes('9: 4.850: new track record on Club Oval'));
  assert.deepEqual(
    f.moments.map(m => m.lap),
    [...f.moments.map(m => m.lap)].sort((a, b) => a - b),
    'in the order of the race'
  );
  // no record before (the first race on the track) is the first record; a slower race beats nothing; no record known: nothing said
  assert.equal(RO.figures(session, laps, { recordBefore: Infinity }).record.before, null);
  assert.equal(RO.figures(session, laps, { recordBefore: 4800 }).record, null);
  assert.equal(RO.figures(session, laps, {}).record, null);
  // a race led from start to finish says so
  const calm = race();
  calm.laps.forEach(l => l.driverId === 'd1' && (l.time += 200));
  calm.session.standings = calm.session.standings.map(x => (x.driverId === 'd1' ? { ...x, total: x.total + 2400 } : x));
  const g = RO.figures(calm.session, calm.laps, {});
  assert.equal(g.changes, 0);
  assert(g.moments.some(m => m.text === 'Anna leads from start to finish'));
});

test('Race over: the winner big with the helmet of the lane, the highlights, the actions, the timing tower and the race story', () => {
  const { session, laps } = race();
  const f = RO.figures(session, laps, { recordBefore: 4950 });
  const html = RO.overHtml({ f, kicker: 'Chequered flag · Check race', again: true, announce: true, saved: '✓ Saved · 36 laps' });
  assert.match(html, /<h2 class="ro-big">Anna wins<\/h2>/);
  assert.match(html, /<img src="avatars\/Lane1\.png"/, 'the helmet of lane 1');
  assert.match(html, /ro-place p1">1</);
  assert.match(html, /ro-chip fl"><small>Fastest lap<\/small><b>4.850 · Anna/);
  assert.match(html, /ro-chip rec"><small>Track record<\/small><b>4.850 · new/);
  assert.match(html, /Lead changes<\/small><b>2/);
  for (const act of ['home', 'again', 'print', 'results', 'announce']) assert(html.includes(`data-ro="${act}"`), act);
  assert.match(html, /class="btn primary" data-ro="home">Back to Home/, 'Back to Home is the main action');
  assert.equal((html.match(/class="btn primary"/g) || []).length, 1, 'one main action');
  assert.match(html, /<h3>Classification<\/h3>/);
  assert.equal((html.match(/class="ro-row" role="row"/g) || []).length, 3);
  assert.match(html, /ro-best fl" role="cell">4.850/, 'the fastest lap of all in purple');
  assert.match(html, /<h3>Race story<\/h3>/);
  assert.equal((html.match(/<polyline class="ro-ln/g) || []).length, 3, 'a line for every driver');
  assert.match(html, /ro-saved" role="status">✓ Saved · 36 laps/);
  // without audio no Announce; nobody in the standings: Race over with the actions only
  assert(!RO.overHtml({ f, kicker: '', again: true }).includes('data-ro="announce"'));
  const none = RO.overHtml({ f: RO.figures({ standings: [] }, [], {}), kicker: '', again: true });
  assert.match(none, /Race over/);
  assert.match(none, /data-ro="home"/);
});

// the award view of a championship after round 2 of 6 (as ChampPts.awardView gives it): Anna wins, takes the lead from Bjorn
function champView(extra = 0) {
  const drivers = [
    { id: 'd0', name: 'Anna', pos: 1, total: 44 },
    { id: 'd1', name: 'Bjorn', pos: 2, total: 40 },
    { id: 'd2', name: 'Chris', pos: 3, total: 27 },
    ...Array.from({ length: extra }, (_, i) => ({ id: 'x' + i, name: 'Guest ' + i, pos: 4 + i, total: 0 }))
  ];
  return {
    state: 'race',
    name: 'Winter Cup',
    round: 2,
    roundLabel: 'Round 2',
    total: 6,
    notes: [],
    rows: [
      { driverId: 'd0', change: 26, posBefore: 2 },
      { driverId: 'd1', change: 18, posBefore: 1 },
      { driverId: 'd2', change: 12, posBefore: 3 }
    ],
    after: { drivers, cols: [{ ri: 0 }, { ri: 1 }] }
  };
}

test('a race of a championship: the title fight as big as the race, the points awarded with Undo, the next round, Go to round 3', () => {
  const { session, laps } = race();
  const f = RO.figures(session, laps, {});
  const next = {
    label: 'Round 3',
    short: 'round 3',
    track: 'Wizard Oval',
    date: 'Thu 3 Dec',
    lanes: 2,
    sessions: ['Qualifying', 'Race'],
    goLabel: 'Go to round 3'
  };
  const html = RO.overHtml({ f, kicker: 'Check race', again: true, champ: { view: champView(), awarded: true, next, name: 'Winter Cup' } });
  assert.match(html, /<h2 class="ro-big">Anna wins <em>&amp; leads<\/em><\/h2>/, 'the winner who leads the championship after it');
  assert.match(html, /ro-chk">Winter Cup · Round 2 of 6/);
  assert.match(html, /ro-chip ch"><small>Winter Cup<\/small><b>P1 · 44 pts/);
  assert.match(html, /class="ro-main eq"/, 'the race and the championship side by side, as big as each other');
  assert.match(html, /<h3>This race<\/h3>/);
  assert.match(html, /<h3>Title fight<\/h3>/);
  assert.match(html, /class="btn primary" data-ro="champ-next">Go to round 3/, 'the main action goes on to the next round');
  assert(!html.includes('data-ro="again"'), 'no Race again: the championship goes on to its next session');
  assert.match(html, /ro-mv up">▲ 1/);
  assert.match(html, /ro-mv dn">▼ 1/);
  assert.match(html, /ro-plus">\+26/);
  assert.match(html, /data-ro="champ-undo">Undo/);
  assert.match(html, /data-ro="champ-off">Do not count this race/);
  assert.match(html, /ro-nh">Round 3 · Wizard Oval/);
  assert.match(html, /<span>Qualifying<\/span><i aria-hidden="true">→<\/i><span>Race<\/span>/);
  assert.equal((html.match(/ro-trk ch[\s\S]*?<\/ul>/)[0].match(/class="done"/g) || []).length, 2, 'rounds 1 and 2 driven');
  // not awarded (Undo): the points wait, Award these points; no "& leads"; the season complete
  const wait = RO.overHtml({ f, kicker: '', champ: { view: champView(), awarded: false, next: null, name: 'Winter Cup' } });
  assert.match(wait, /These points are not in the standings yet/);
  assert.match(wait, /data-ro="champ-award">Award these points/);
  assert(!wait.includes('&amp; leads'));
  assert.match(wait, /The season is complete/);
  assert.match(wait, /class="btn primary" data-ro="home">Back to Home/);
  // a big roster: the drivers without a point are one line
  const big = RO.champCard(champView(30), { awarded: true });
  assert.equal((big.match(/<tr><td><span class="ro-pos sm/g) || []).length, 3);
  assert.match(big, /30 more drivers without points yet/);
});

test('the break between two heats: the next heat big with its line-up and Start, the heats, the standings with a column per heat', () => {
  const list = [
    { name: 'Heat 1', state: 'done', winner: { name: 'Bjorn' } },
    { name: 'Heat 2', state: 'next' },
    { name: 'Heat 3', state: 'later' },
    { name: 'Final A', state: 'later', final: 'A' }
  ];
  const rows = [
    { pos: 1, name: 'Bjorn', lane: 1, heats: [10, null, null], add: 10, move: 1, total: 10 },
    { pos: 2, name: 'Anna', lane: 0, heats: [8, null, null], add: 8, move: -1, total: 8 }
  ];
  const standings = RO.heatStandings(rows, { heatNames: ['Heat 1', 'Heat 2', 'Heat 3'], byPoints: true, showAdd: true, showMove: true });
  assert.match(standings, /<td class="h top">10<\/td>/, 'the best score of a heat lit');
  assert.match(standings, /<td class="h no">–<\/td>/, 'a heat not driven yet');
  assert.match(standings, /ro-mv up">▲ 1/);
  assert.match(standings, /ro-plus">\+10/);
  assert.match(standings, /<th class="r">This heat<\/th><th class="r">Points<\/th>/);
  const html = RO.breakHtml({
    kicker: 'Break · 1 of 4 done',
    next: {
      name: 'Heat 2',
      line: '5 laps',
      drivers: [
        { name: 'Anna', car: 'NSR Corvette', lane: 1, total: 8 },
        { name: 'Bjorn', car: 'NSR Mosler', lane: null, total: 10 }
      ]
    },
    startable: true,
    track: list,
    standings,
    last: {
      name: 'Heat 1',
      note: '5 laps · Bjorn won',
      rows: [
        { pos: 1, name: 'Bjorn', lane: 1, points: 10, laps: 5 },
        { pos: 2, name: 'Anna', lane: 0, points: 8, gap: '+0.410 s' }
      ],
      fastest: { time: 5130, name: 'Bjorn' }
    },
    byPoints: true,
    picks: true
  });
  assert.match(html, /<h2 class="ro-big">Heat 2 <em>next up<\/em><\/h2>/);
  assert.match(html, /class="btn primary ro-start" data-ro="start">Start heat 2/);
  assert.equal((html.match(/class="btn primary/g) || []).length, 1, 'one Start, not two');
  assert.equal((html.match(/class="ro-lt/g) || []).length, 2, 'a lane tile for every driver of the next heat');
  assert.match(html, /<span class="n">2<\/span><span class="pt">8 pts<\/span><img src="avatars\/Lane2\.png"/);
  assert.match(html, /class="ro-lt nolane"/, 'a final before its lanes are chosen: a grey helmet');
  for (const act of ['screen', 'heatprint', 'endevent']) assert(html.includes(`data-ro="${act}"`), act);
  assert.match(html, /id="ro-picks"/, 'the lane picks of a final come on the break screen');
  assert.match(html, /aria-current="step"><b>Heat 2<\/b><span>next/);
  assert.match(html, /<b>Heat 1<\/b><span>Bjorn won/);
  assert.match(html, /ro-wb"><div class="w"/, 'the heat that was just driven as a result board');
  assert.match(html, /ro-gap">\+0\.410 s/);
  // a final whose lanes are not chosen yet: no Start, what to do instead
  const pick = RO.breakHtml({
    next: { name: 'Final A', drivers: [] },
    startable: false,
    startNote: 'Choose the lanes for Final A first.',
    track: list,
    standings: ''
  });
  assert(!pick.includes('data-ro="start"'));
  assert.match(pick, /Choose the lanes for Final A first\./);
});

test('race.js shows the screens: Race over when the results are saved (the points of a championship awarded at once), the break, Delete goes Home', () => {
  const race = code('renderer/race.js');
  assert(
    has(race, '<section id="raceover" class="ro-host"') && has(race, '<section id="racebreak" class="ro-host"'),
    'a place for each screen'
  );
  assert(has(race, "if (typeof RaceOver !== 'undefined') roStart(session, savedId, laps)"), 'Race over after the results are saved');
  assert(has(race, "ChampPts.awardPatches(D.sessions, s, 'award', new Date().toISOString())"), 'the points awarded at once');
  assert(has(race, "roBreak(true);\n          roShow('break');"), 'the break when a heat is done and another follows');
  assert(has(race, "if (live.phase !== 'between') roShow('');"), 'the break screen goes when the next heat starts');
  assert(has(race, "state.homeMsg = ui('msg').textContent;"), 'Delete all data: Home says what happened');
  assert(!has(race, 'champPanelsFor([cp])'), 'no points panel under the frozen race page any more');
  assert(code('renderer/landing.js').includes('hm-msg'), 'Home shows the message');
  const html = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'index.html'), 'utf8');
  assert(
    html.indexOf('<script src="racereport.js"></script>') < html.indexOf('<script src="raceover.js"></script>'),
    'raceover.js after racereport.js'
  );
  assert(code('renderer/styles.css').includes('2.4.0 Chequered Flag'));
});

test('the second screen: the same screens without buttons on one 16:9 screen, the line along the bottom, the time left of a break', () => {
  const { session, laps } = race();
  const f = RO.figures(session, laps, {});
  const next = { label: 'Round 3', short: 'round 3', track: 'Wizard Oval', date: 'Thu 3 Dec', sessions: ['Race'] };
  const tv = RO.tvHtml('over', {
    f,
    kicker: 'Check race',
    champ: { view: champView(), awarded: true, next, name: 'Winter Cup' },
    foot: { kicker: 'Next in Winter Cup', items: [{ text: 'Round 3 · Wizard Oval', cls: 'ch' }], note: 'Thu 3 Dec' }
  });
  assert.match(tv, /^<div class="ro-host ro-tv">/);
  assert.match(
    tv,
    /<div class="ro-tvfoot"><span class="k">Next in Winter Cup<\/span><b class="ch">Round 3 · Wizard Oval<\/b><span class="n">Thu 3 Dec<\/span><span class="r">SlotForge Timing<\/span><\/div>/
  );
  assert(!tv.includes('class="ro-next'), 'the next round is the line along the bottom, not a band');
  assert(RO.overHtml({ f, kicker: '' }).indexOf('ro-tvfoot') < 0, 'the race window has no line along the bottom');
  const brk = RO.tvHtml('break', {
    next: { name: 'Heat 2', drivers: [{ name: 'Anna', lane: 0 }] },
    startable: true,
    picks: true,
    track: [],
    standings: '',
    foot: { kicker: 'The heats', items: [{ text: 'Heat 1 ✓' }, { text: 'Heat 2 next' }] }
  });
  assert(!brk.includes('data-ro="start"'), 'no Start on the second screen');
  assert.match(
    brk,
    /class="ro-tvcount" data-tv-left hidden><small>Starts in<\/small><b><\/b>/,
    'the time left of the break, filled in by the Live Race window'
  );
  assert(!brk.includes('id="ro-picks"'), 'the lane picks of a final stay on the race window');
  const css = code('renderer/styles.css');
  assert(
    css.includes('html .ro-tv :is(.ro-bar,.ro-aw,.ro-notes,.ro-next,.ro-heats,.ro-more,.ro-picks){display:none}'),
    'no buttons on the second screen'
  );
});

test('the race window sends the screen with the live messages; the Live Race window draws it, unless Race Results keeps the Results Wall', () => {
  const RV = require('../renderer/resultsview.js');
  assert.equal(RV.clean(undefined).after, 'broadcast', 'a new Results Wall: the broadcast');
  assert.equal(RV.clean({ summary: ['laps'] }).after, 'mine', 'a Results Wall saved before 2.4.0 stays');
  assert.equal(RV.clean({ after: 'broadcast', summary: ['laps'] }).after, 'broadcast');
  assert.equal(RV.clean(RV.clean({ after: 'mine' })).after, 'mine');
  const race = code('renderer/race.js'),
    view = code('renderer/liveview.js'),
    share = code('renderer/liveshare.js');
  assert(has(race, 'after: live.afterTv || null,') && has(share, 'after: c.after || null,'), 'with the live messages');
  assert(has(race, "RaceOver.tvHtml('over',") && has(race, "RaceOver.tvHtml('break',"), 'Race over and the break');
  assert(
    has(race, "if (live.afterTv && !['between', 'review', 'finished'].includes(live.phase)) live.afterTv = null;"),
    'gone when the next heat starts'
  );
  assert(has(view, 'if (afterOn(d)) return drawAfter(body, d);'), 'the Live Race window draws it on Race results');
  assert(has(view, "(d.phase === 'between' && afterOn(d))"), 'and goes there in a break, as after a race');
  assert(has(view, 'z = Math.max(0.15, Math.min(w / 1920, h / 1080))'), 'the whole screen is always seen');
  assert(code('renderer/editor.js').includes('data-results-after="1"'), 'the choice in Customization › Race Results');
});
