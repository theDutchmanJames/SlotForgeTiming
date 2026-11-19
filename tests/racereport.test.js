'use strict';
// 2.4.0: the race report as a PDF (renderer/racereport.js, put together by report.js sessionHtml): page one as a club tells the race (the podium, the
// race notes, the laps per lane, the race lap by lap), a page for every driver (one page, never more), Colour or Monochrome.
const test = require('node:test'),
  assert = require('node:assert/strict');
const RR = require('../renderer/racereport.js'),
  Report = require('../renderer/report.js');

// a race of 3 drivers, 30 laps, the lanes rotated every 10 laps; Chris has an off on lap 12 and a pit stop on lap 20, Bjorn an invalid lap
function race() {
  const names = ['Anna', 'Bjorn', 'Chris'],
    laps = [];
  names.forEach((n, d) => {
    for (let k = 1; k <= 30; k++) {
      let time = 5000 + d * 60 + ((k * 37) % 120) - (k > 20 ? 40 : 0);
      const lap = { sessionId: 's1', driverId: 'd' + d, lapNumber: k, lane: ((d + Math.floor((k - 1) / 10)) % 3) + 1, time };
      if (d === 2 && k === 12) lap.time = 11000;
      if (d === 2 && k === 20) {
        lap.pit = true;
        lap.time = 9000;
      }
      if (d === 1 && k === 5) lap.invalid = true;
      laps.push(lap);
    }
  });
  const total = id => laps.filter(l => l.driverId === id).reduce((a, l) => a + l.time, 0);
  const standings = names
    .map((n, d) => ({ driverId: 'd' + d, driverName: n, carName: 'Car ' + n, lane: d + 1, laps: 30, total: total('d' + d), best: Math.min(...laps.filter(l => l.driverId === 'd' + d && !l.invalid && !l.pit).map(l => l.time)) }))
    .sort((a, b) => a.total - b.total)
    .map((x, i) => ({ ...x, pos: i + 1 }));
  return { session: { id: 's1', setupName: 'Club <night>', sessionType: 'race', trackName: 'Oval', date: '2026-11-19T19:00:00Z', endedBy: 'laps', standings }, laps };
}

test('the figures of a driver: the laps in order, an off (slower than 1.6 times the median), a pit lap and a lap that does not count', () => {
  const { session, laps } = race(),
    chris = session.standings.find(x => x.driverName === 'Chris'),
    { list } = RR.driverLaps(session, chris, laps);
  assert.equal(list.length, 30);
  assert.equal(list[11].off, true, 'lap 12 is an off');
  assert.equal(list[19].pit, true, 'lap 20 is a pit stop');
  assert.equal(list.filter(l => l.off).length, 1);
  const bjorn = RR.driverLaps(session, session.standings.find(x => x.driverName === 'Bjorn'), laps).list;
  assert.equal(bjorn[4].bad, true, 'an invalid lap does not count');
  const lanes = RR.lanesOf(list);
  assert.deepEqual(lanes.map(g => [g.lane, g.laps]), [[1, 10], [2, 10], [3, 10]], 'ten laps on every lane');
  const th = RR.thirds(list);
  assert.ok(th && th.gain > 0, 'faster at the end (the last ten laps are 40 ms quicker)');
});

test('the gap to the winner, in words: laps, seconds, points; and the best lap for a practice', () => {
  const rows = [{ laps: 30, total: 100000, best: 5000 }, { laps: 30, total: 104120 }, { laps: 28, total: 99000 }];
  assert.equal(RR.gapText({ sessionType: 'race' }, rows, 0), '');
  assert.equal(RR.gapText({ sessionType: 'race' }, rows, 1), '+4.120 s');
  assert.equal(RR.gapText({ sessionType: 'race' }, rows, 2), '+2 laps');
  assert.equal(RR.gapText({ sessionType: 'race', resultBy: 'points' }, [{ points: 25 }, { points: 18 }], 1), '−7 pts');
  assert.equal(RR.gapText({ sessionType: 'practice' }, [{ best: 5000 }, { best: 5123 }], 1), '+0.123 s');
});

test('page one: the race notes say the fastest lap with its lap and lane, the most consistent, the fastest lane and the offs', () => {
  const { session, laps } = race(),
    F = RR.facts(session, laps, null);
  assert.ok(F.fastest && F.fastest.name === 'Anna', 'Anna has the fastest lap');
  assert.ok(F.fastest.lane >= 1 && F.fastest.n >= 1);
  assert.equal(F.offTotal, 1);
  assert.equal(F.lanes.length, 3);
  const html = Report.sessionHtml({ session, laps, options: { laps: false } });
  assert.ok(html.includes('class="rp-head"') && html.includes('Club &lt;night&gt;') && !html.includes('Club <night>'), 'the head, safe');
  assert.ok(html.includes('class="rp-podium"') && html.includes('<small>Winner</small><b>Anna</b>'), 'the podium');
  assert.ok(html.includes('<h2 class="rp-h">Race notes</h2>') && html.includes('<small>Fastest lap</small>') && html.includes('<small>Offs</small>'), 'the race notes');
  assert.ok(html.includes('<h2 class="rp-h">Laps per lane</h2>'), 'the laps per lane');
  assert.ok(html.includes('<h2 class="rp-h">The race lap by lap</h2>') && html.includes('aria-label="The place of every driver after every lap"'), 'the race lap by lap');
  assert.ok(html.includes('<tr style="--c:#e5484d">'), 'a row of the classification has the colour of its lane');
});

test('a page for every driver: one page at most, the tiles, every lap on the chart, per lane, through the race, the lap sheet', () => {
  const { session, laps } = race(),
    html = Report.sessionHtml({ session, laps, options: { laps: false } });
  assert.equal((html.match(/<section class="rp-dpage">/g) || []).length, 3, 'three drivers, three pages');
  assert.ok(/\.rp-dpage \{ break-before: page; page-break-before: always; height: 275mm; overflow: hidden;/.test(html), 'a driver page is one page and never more');
  assert.ok(html.includes('Driver report · 1 of 3') && html.includes('<h2 class="rp-h">Every lap</h2>') && html.includes('<h2 class="rp-h">Per lane</h2>') && html.includes('<h2 class="rp-h">Through the race</h2>') && html.includes('<h2 class="rp-h">Lap sheet</h2>'));
  assert.ok(html.includes('class="rc-off"') && html.includes('class="rc-pit"') && html.includes('rc-best'), 'the chart marks the off, the pit stop and the best lap');
  assert.ok(html.includes('<h2 class="rp-h">Place lap by lap</h2>') && html.includes('<h2 class="rp-h">Gap to the leader</h2>'));
  assert.equal((html.match(/class="ls-c/g) || []).length, 90, 'the lap sheet has every lap of every driver');
  const off = Report.sessionHtml({ session, laps, options: { laps: false, drivers: false } });
  assert.ok(!off.includes('rp-dpage">'), 'without the driver pages there are none');
});

test('Colour or Monochrome: Monochrome has no colour in its styles, the lanes as outlined numbers', () => {
  const { session, laps } = race(),
    mono = Report.sessionHtml({ session, laps, options: { mode: 'mono', laps: false } }),
    colour = Report.sessionHtml({ session, laps, options: { laps: false } });
  assert.ok(mono.includes('<body class="pdf-mono">') && colour.includes('<body class="pdf-colour">'));
  assert.ok(mono.includes('body * { --c: #15181d !important; }') && mono.includes('--best: #15181d'), 'every lane colour and the purple of the best lap are black');
  assert.ok(colour.includes('--best: #7c3aed') && !colour.includes('body * { --c: #15181d'), 'Colour keeps them');
  assert.ok(mono.includes('<pattern id="hatch"'), 'an off is hatched in Monochrome');
  assert.ok(mono.includes('/*SF-PDF-FONTS*/') && mono.includes('<!--SF-PDF-WORDMARK-->'), 'the places for the fonts and the wordmark of SlotForge (main.js fills them in)');
});

test('a long race (500 laps) stays on one page: the lap sheet shows the ten fastest and slowest laps; no spread overflow', () => {
  const list = Array.from({ length: 500 }, (_, i) => ({ n: i + 1, time: 5000 + ((i * 53) % 400), lane: (i % 4) + 1, heat: 0, pit: false, bad: false, off: false }));
  assert.ok(RR.lapSheet(list).includes('500 laps: the ten fastest and the ten slowest clean laps.'));
  assert.equal((RR.lapSheet(list).match(/class="ls-c/g) || []).length, 20);
  assert.ok(RR.chart(list).startsWith('<svg class="rp-chart"'));
  const big = Array.from({ length: 200000 }, (_, i) => ({ n: i + 1, time: 5000 + (i % 300), lane: 1, heat: 0, pit: false, bad: false, off: false }));
  assert.doesNotThrow(() => RR.histogram(big));
});

test('the other prints have the same look: the heat list, the standings, the racing rules and the QR code, in Colour or Monochrome', () => {
  const list = [{ name: 'Heat 1', label: '', drivers: [{ lane: 0, name: 'Anna' }, { lane: 1, name: 'Bjorn' }], rows: [] }];
  const heat = Report.heatSheetHtml({ title: 'Club', subtitle: 'Oval', list, lanes: 2 }),
    heatMono = Report.heatSheetHtml({ title: 'Club', subtitle: 'Oval', list, lanes: 2, mono: true });
  assert.ok(heat.includes('<span class="rp-k">Heat list</span>') && heat.includes('class="rp-check"') && heat.includes('@page { size: A4 landscape') && heat.includes('<!--SF-PDF-WORDMARK-->'), 'the heat list: the head of the race report, landscape, the wordmark');
  assert.ok(heat.includes("table.hs th:nth-child(2)::before { background: #e5484d; content: '1'; }") && heat.includes("table.hs th:nth-child(3)::before { background: #3b82f6; content: '2'; }"), 'every lane heads its column with its disc');
  assert.ok(heatMono.includes('<body class="pdf-mono">') && heatMono.includes('table.hs th::before { background: #fff !important;'), 'in Monochrome the discs are rings');
  const table = { title: 'Drivers', columns: [{ label: 'Pos' }, { label: 'Driver' }, { label: 'Points', r: true }], rows: [{ lead: true, cells: [{ t: '1' }, { t: 'Anna', b: true }, { t: '25', b: true, big: true }] }, { cells: [{ t: '2' }, { t: 'Bjorn', b: true }, { t: '18', b: true, big: true }] }], legend: [] };
  const st = Report.standingsHtml({ championship: 'Cup', table, lead: 'Anna leads by 7' });
  assert.ok(st.includes('<span class="rp-k">Championship standings</span>') && st.includes('class="rp-podium"') && st.includes('<small>Leader</small><b>Anna</b>') && st.includes('<b>25<small> pts</small></b>'), 'the standings: the head and the first ones as podium cards');
  const rules = Report.rulesHtml({ title: 'Rules', html: '<h2>Safety</h2>' });
  assert.ok(rules.includes('<span class="rp-k">Racing rules</span>') && rules.includes('.body h2 {') && !rules.includes('SF-PDF-WORDMARK'), 'the rules are the club page: the head without the wordmark');
  const qr = Report.qrHtml({ title: 'Live', url: 'http://x', svg: '<svg></svg>', mono: true });
  assert.ok(qr.includes('<span class="rp-k">Live race</span>') && qr.includes('class="qr-card"') && qr.includes('class="qr-steps"') && qr.includes('<body class="pdf-mono">'), 'the QR page: the code in a card, three steps, Monochrome');
});
