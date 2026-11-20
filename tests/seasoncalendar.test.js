'use strict';
// 2.4.0: Championships reworked (renderer/championship.js, champpoints.js, championshipui.js, report.js, SlotForgeRestyle.md "Season Calendar"):
// the round date is a real date (picked, filled, read from the text of before), the season as a strip and as a calendar file, adjustments (points
// given or taken by hand with a reason) that count in the standings and show in the table and the PDF, and the drivers who have not raced folded away.
const test = require('node:test'),
  assert = require('node:assert/strict');
const C = require('../renderer/championship.js');
const P = require('../renderer/champpoints.js');
const { code, has } = require('./source.cjs');

test('a round date: read from the text of before, kept as YYYY-MM-DD, said in words', () => {
  assert.equal(C.dateOf('Thu 5 Nov 2026'), '2026-11-05');
  assert.equal(C.dateOf('5/11/2026'), '2026-11-05', 'day first');
  assert.equal(C.dateOf('Nov 5, 2026'), '2026-11-05');
  assert.equal(C.dateOf('5th November 2026'), '2026-11-05');
  assert.equal(C.dateOf('Sat 3 Oct'), '', 'no year: not read');
  assert.equal(C.dateOf('31/2/2026'), '', 'no such day');
  assert.equal(C.dateText('2026-11-05'), 'Thu 5 Nov 2026');
  assert.equal(C.dateText('2026-11-05', { short: true }), 'Thu 5 Nov');
  assert.equal(C.dateText('Sat 3 Oct'), 'Sat 3 Oct', 'a date that can not be read stays as it was typed');
  const c = C.clean({ rounds: [{ date: 'Thu 5 Nov 2026' }, { date: 'Sat 3 Oct' }] });
  assert.deepEqual(
    c.rounds.map(r => r.date),
    ['2026-11-05', 'Sat 3 Oct']
  );
  assert.equal(C.setRound(c, 1, { date: '2026-10-03' }).rec.rounds[1].date, '2026-10-03');
});

test('fill the dates: one step after the round before; the calendar file', () => {
  const c = C.clean({
    name: 'Winter Cup',
    rounds: [{ date: '2026-11-05', track: 't1', sessions: [{ setup: 's1' }] }, {}, { date: '2027-01-28' }, {}]
  });
  assert.deepEqual(
    C.fillDates(c, '2026-11-05', '2weeks').rec.rounds.map(r => r.date),
    ['2026-11-05', '2026-11-19', '2027-01-28', '2027-02-11']
  );
  assert.deepEqual(
    C.fillDates(C.clean({ rounds: [{}, {}] }), '2027-01-31', 'month').rec.rounds.map(r => r.date),
    ['2027-01-31', '2027-02-28'],
    'the 31st in February: its last day'
  );
  assert.equal(C.fillDates(c, 'soon', 'week').error, 'Choose the date of the first round.');
  assert.equal(C.fillDates(C.fillDates(c, '2026-11-05', 'week').rec, '2026-11-05', 'week').error, 'Every round has a date already.');
  const cal = C.calendar(c, {
    tracks: [{ id: 't1', name: 'Club Oval' }],
    setups: [{ id: 's1', name: 'Club race' }],
    now: Date.UTC(2026, 10, 20)
  });
  assert.equal(cal.events, 2);
  const lines = cal.text.split('\r\n');
  assert(lines.includes('DTSTART;VALUE=DATE:20261105') && lines.includes('DTEND;VALUE=DATE:20261106'));
  assert(lines.includes('SUMMARY:Winter Cup · Round 1') && lines.includes('LOCATION:Club Oval') && lines.includes('DESCRIPTION:Club race'));
  assert.equal(lines[0], 'BEGIN:VCALENDAR');
  assert(has(code('main.js'), "ics: ['Calendar', 'ics']"), 'a calendar file can be saved');
});

test('adjustments: a driver of the roster, points and a reason; they count in the standings and the table', () => {
  const c = C.clean({
    name: 'Cup',
    rounds: [{ id: 'r1', sessions: [] }],
    roster: [{ driver: 'a' }, { driver: 'b' }, { driver: 'z' }]
  });
  assert.equal(C.addAdjustment(c, { driver: 'x', points: 3, reason: 'r' }).error, 'Choose a driver of the roster.');
  assert.equal(C.addAdjustment(c, { driver: 'a', points: 0, reason: 'r' }).error, 'Give or take at least one point.');
  assert.equal(C.addAdjustment(c, { driver: 'a', points: 3, reason: ' ' }).error, 'Say why: the reason shows in the standings.');
  let r = C.addAdjustment(c, { driver: 'b', points: 5, reason: 'Correction: lap count', round: 'r1', date: '2026-11-20' });
  r = C.addAdjustment(r.rec, { driver: 'a', points: -2, reason: 'Jump start', round: 'gone' });
  assert.equal(r.rec.adjustments[1].round, '', 'a round that is not there: the whole season');
  assert.equal(C.clean(r.rec, true).adjustments.length, 2, 'kept by clean');
  assert.equal('adjustments' in C.clean({ roster: [{ driver: 'a' }] }), false, 'none: no list, as before');
  const st = P.standings(r.rec, [], {
    drivers: [
      { id: 'a', name: 'Anna' },
      { id: 'b', name: 'Bjorn' },
      { id: 'z', name: 'Zed' }
    ]
  });
  assert.deepEqual(
    st.drivers.map(d => [d.name, d.total, d.adj]),
    [
      ['Bjorn', 5, 5],
      ['Zed', 0, 0],
      ['Anna', -2, -2]
    ]
  );
  assert.equal(st.adjustments[0].roundLabel, 'Round 1');
  const t = P.tableOf(r.rec, st, 'drivers');
  const adjAt = t.columns.findIndex(x => x.label === 'Adj.');
  assert(adjAt > 0 && t.columns[adjAt + 1].label === 'Points');
  assert.deepEqual(t.rows[0].cells[adjAt], { t: '+5', cls: 'pos', title: '+5: Correction: lap count' });
  assert.equal(t.rows[1].raced, false, 'a driver with no points and no adjustment has not raced');
  assert.deepEqual(t.adjustments[1], { name: 'Anna', points: '−2', reason: 'Jump start', round: '' });
  const Report = require('../renderer/report.js');
  const pdf = Report.standingsHtml({ championship: 'Cup', table: t, lead: '' });
  assert(pdf.includes('<h3>Adjustments</h3>') && pdf.includes('Correction: lap count'));
  const gone = C.removeAdjustment(r.rec, r.rec.adjustments[0].id);
  assert.equal(gone.rec.adjustments.length, 1);
});

test('the editor and the standings page', () => {
  const ui = code('renderer/championshipui.js');
  assert(has(ui, '<input type="date" id="ch-rd-${i}" data-rf="${i}:date" value="${esc(Champ.dateOf(r.date))}">'));
  assert(has(ui, 'Written before as “${esc(r.date)}”: choose the date.'));
  assert(has(ui, '<div id="ch-season" class="pl">${seasonHtml()}</div><div id="ch-fillbox" class="pl">${fillHtml()}</div>'));
  assert(has(ui, "apply(Champ.fillDates(d, $('ch-fillfrom').value, $('ch-fillevery').value))"));
  assert(has(ui, "await api.update('championships', c.id, { adjustments: rec.adjustments || [] });"));
  assert(has(ui, 'not raced yet'));
  assert(has(code('renderer/race.js'), "date: round.date ? Champ.dateText(round.date) : '',"), 'Race Over says the next round in words');
  assert(has(code('renderer/landing.js'), 'Champ.dateOf(r.date) || r.date'), 'Home reads the date');
});
