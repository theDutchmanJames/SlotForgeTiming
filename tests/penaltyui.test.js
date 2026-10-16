// 1.15.0: the penalty panel (renderer/penaltyui.js) on its own: the table of points and penalties for each lane, what the buttons do and when they are off, the log, and what happens when the drivers change.
// The panel is the same on the Race Director page and on the Race tab; the screen tests (live, racefolders) check it in place, this one checks the rules with stand-in rows.
const vm = require('vm'), fs = require('fs'), path = require('path');
let fails = 0;
const say = (m, c) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const ctx = vm.createContext({ console });
const PenaltyPanel = vm.runInContext(fs.readFileSync(path.join(__dirname, '../renderer/penaltyui.js'), 'utf8') + '\n;PenaltyPanel', ctx);

// a stand-in for the page: when the html is set, a row with its cells and buttons is made for every data-row in it
function page() {
  const pg = { rows: {}, log: { innerHTML: '' }, sets: 0, sent: [] };
  let html = '';
  pg.box = {
    get innerHTML() { return html; },
    set innerHTML(h) {
      html = h; pg.sets++; pg.rows = {};
      const parts = h.split('data-row="').slice(1);
      parts.forEach(chunk => {
        const lane = Number(chunk.slice(0, chunk.indexOf('"'))), r = { pts: { textContent: '' }, sec: { textContent: '' }, pend: { textContent: '' }, plus: { disabled: false }, minus: { disabled: false }, assigns: [] };
        const n = (chunk.split('</tr>')[0].match(/data-cmd="assign"/g) || []).length; for (let i = 0; i < n; i++) r.assigns.push({ disabled: false, dataset: { type: String(i) } });
        r.querySelector = sel => (sel === '.dir-pts' ? r.pts : sel === '.dir-sec' ? r.sec : sel === '.dir-pend' ? r.pend : sel === '[data-n="1"]' ? r.plus : sel === '[data-n="-1"]' ? r.minus : null);
        r.querySelectorAll = sel => (sel === '[data-cmd="assign"]' ? r.assigns : []);
        pg.rows[lane] = r;
      });
    },
    querySelector: sel => (sel === '#dir-log' ? pg.log : (/^\[data-row="(\d+)"\]$/.exec(sel) ? pg.rows[Number(/(\d+)/.exec(sel)[1])] || null : null)),
  };
  pg.click = (cmd, lane, extra = {}, disabled = false) => pg.box.onclick({ target: { closest: s => (s === '[data-cmd]' ? { dataset: { cmd, lane: String(lane), ...extra }, disabled } : null) } });
  return pg;
}
const car = (lane, over = {}) => ({ lane, driverName: 'D' + (lane + 1), points: 0, dq: false, pending: [], ...over });
const mkEng = (cars, events = []) => ({ cars, events, penMs: c => c.points * 1000 });
const types = [{ name: 'Drivethrough', cost: 2 }, { name: 'Stop-and-Go', cost: 4 }];
const cfg = { on: true, types };

// ---- the table ----
const entries = [{ lane: 0, driverName: 'Alex' }, { lane: 1, driverName: '<b>Sam</b>' }];
const th = PenaltyPanel.tableHtml(entries, types);
say('the table has a row for each lane, with the lane, the driver and the cells for points, time penalty and what is not served yet', (th.match(/data-row="/g) || []).length === 2 && th.includes('<td>1</td><td>Alex</td>') && th.includes('dir-pts') && th.includes('dir-sec') && th.includes('dir-pend'));
say('...the buttons of a row: −1, Penalty point +1 and one for each special penalty of the system, with what it costs', th.includes('data-n="-1"') && th.includes('Penalty point +1') && th.includes('Drivethrough (−2)') && th.includes('Stop-and-Go (−4)') && th.includes('data-type="1"'));
say('...a name is written safely, and the log is below the table', th.includes('&lt;b&gt;Sam&lt;/b&gt;') && !th.includes('<b>Sam') && th.includes('id="dir-log"') && th.includes('Penalty log'));
say('without special penalties the row has the two point buttons only', !PenaltyPanel.tableHtml(entries, []).includes('data-cmd="assign"'));

// ---- a race without a penalty system ----
{
  const pg = page(), eng = mkEng([car(0)]);
  const p = PenaltyPanel.build(pg.box, { eng: () => eng, entries, cfg: () => ({ on: false, types: [] }), phase: () => 'running', send: x => pg.sent.push(x) });
  p.update();
  say('no penalty system: the panel says so and does nothing else', pg.box.innerHTML === PenaltyPanel.NONE && pg.box.innerHTML.includes('no penalty system') && pg.sent.length === 0);
}

// ---- the numbers and which buttons are on ----
{
  const pg = page(), cars = [car(0, { points: 3, pending: [{ name: 'Drivethrough' }] }), car(1, { points: 0 }), car(2, { points: 12, dq: true })];
  let phase = 'running'; const eng = mkEng(cars);
  const es = [0, 1, 2].map(l => ({ lane: l, driverName: 'D' + (l + 1) }));
  const p = PenaltyPanel.build(pg.box, { eng: () => eng, entries: es, cfg: () => cfg, phase: () => phase, send: x => pg.sent.push(x) });
  say('points, the time penalty and what is not served yet are shown for each lane', pg.rows[0].pts.textContent === '3' && pg.rows[0].sec.textContent === '+3 s' && pg.rows[0].pend.textContent === 'Drivethrough' && pg.rows[1].pts.textContent === '0' && pg.rows[1].sec.textContent === '–' && pg.rows[1].pend.textContent === '–');
  say('a disqualified car shows DQ', pg.rows[2].pts.textContent === 'DQ');
  say('while the race runs: +1 is on, −1 only with points to take back, a special penalty only when the points pay for it', pg.rows[0].plus.disabled === false && pg.rows[0].minus.disabled === false && pg.rows[1].plus.disabled === false && pg.rows[1].minus.disabled === true
    && pg.rows[0].assigns[0].disabled === false && pg.rows[0].assigns[1].disabled === true && pg.rows[1].assigns.every(b => b.disabled === true));
  say('a disqualified car can be given nothing', pg.rows[2].plus.disabled === true && pg.rows[2].assigns.every(b => b.disabled === true));
  phase = 'paused'; p.update();
  say('paused: the same as while it runs', pg.rows[0].plus.disabled === false && pg.rows[0].assigns[0].disabled === false);
  phase = 'ready'; p.update();
  say('before the start and after the end every button is off', [0, 1, 2].every(l => pg.rows[l].plus.disabled && pg.rows[l].minus.disabled && pg.rows[l].assigns.every(b => b.disabled)));
  phase = 'running'; cars[1].points = 2.5; cars[1].pending = [{ name: 'A' }, { name: 'B' }]; p.update();
  say('...and they follow the race: more points, more waiting penalties', pg.rows[1].pts.textContent === '2.5' && pg.rows[1].sec.textContent === '+2.5 s' && pg.rows[1].pend.textContent === 'A, B' && pg.rows[1].minus.disabled === false && pg.rows[1].assigns[0].disabled === false);

  // ---- the clicks ----
  pg.click('penalty', 1, { n: '1' }); pg.click('penalty', 1, { n: '-1' }); pg.click('assign', 0, { type: '1' });
  say('a click is sent as a command: the lane, and how many points or which special penalty', JSON.stringify(pg.sent) === JSON.stringify([{ type: 'penalty', lane: 1, n: 1 }, { type: 'penalty', lane: 1, n: -1 }, { type: 'assign', lane: 0, typeIndex: 1 }]));
  pg.sent.length = 0; pg.click('penalty', 0, { n: '1' }, true); pg.box.onclick({ target: { closest: () => null } }); pg.box.onclick({ target: {} });
  say('a button that is off, and a click somewhere else, send nothing', pg.sent.length === 0);

  // ---- the log ----
  const events = Array.from({ length: 14 }, (_, i) => ({ type: 'penalty', car: 0, delta: 1, points: i + 1, ms: 0 }));
  events.push({ type: 'assigned', car: 1, name: 'Stop & Go' }, { type: 'served', car: 1, name: 'Stop & Go' }, { type: 'disqualified', car: 2 }, { type: 'lap', car: 0 });
  eng.events = events; p.update();
  const lines = pg.log.innerHTML.match(/<li>/g) || [];
  say('the log shows the last twelve events about penalties and damage, the newest first (other events are not in it)', lines.length === 12 && pg.log.innerHTML.indexOf('is disqualified') < pg.log.innerHTML.indexOf('served: Stop &amp; Go') && !pg.log.innerHTML.includes('lap'));
  say('...in words, with the name written safely', pg.log.innerHTML.includes('D2 must serve: Stop &amp; Go') && pg.log.innerHTML.includes('D2 served: Stop &amp; Go') && pg.log.innerHTML.includes('D3 is disqualified'));
  eng.events = [{ type: 'penalty', car: 0, delta: 2, points: 5, ms: 5000 }, { type: 'penalty', car: 1, delta: -1, points: 0, ms: 0 }, { type: 'reinstated', car: 2 }, { type: 'leftearly', car: 0, name: 'Drivethrough', extra: 1 }, { type: 'timeadded', car: 1, ms: 3000 }, { type: 'damage', car: 0, delta: 2, points: 2, name: 'Contact' }]; p.update();
  say('...every kind of line reads well', pg.log.innerHTML.includes('D1: +2 points (now 5, +5 s)') && pg.log.innerHTML.includes('D2: -1 point (now 0)') && pg.log.innerHTML.includes('D3 is back in the race') && pg.log.innerHTML.includes('D1 left too early (Drivethrough), +1 point')
    && pg.log.innerHTML.includes('D2: +3 s added') && pg.log.innerHTML.includes('D1: +2 damage points (now 2, Contact)'));
  eng.events = []; p.update();
  say('no events: the log says there are no penalties yet', pg.log.innerHTML === '<li class="muted">No penalties yet.</li>');

  // ---- the log is made by the same function on the Race Director page ----
  say('the Race Director page makes its table and its log with the same functions', /PenaltyPanel\.tableHtml\(/.test(fs.readFileSync(path.join(__dirname, '../renderer/liveview.js'), 'utf8')) && /PenaltyPanel\.logHtml\(eng\)/.test(fs.readFileSync(path.join(__dirname, '../renderer/liveview.js'), 'utf8')) && PenaltyPanel.logHtml(eng) === '<li class="muted">No penalties yet.</li>');
}

// ---- other drivers (the next heat): the table is made again, and only then ----
{
  const pg = page(), cars = [car(0), car(1)]; let names = ['Alex', 'Sam'];
  const eng = mkEng(cars);
  const p = PenaltyPanel.build(pg.box, { eng: () => eng, entries: () => names.map((n, l) => ({ lane: l, driverName: n })), cfg: () => cfg, phase: () => 'running', send: () => {} });
  const n0 = pg.sets; p.update(); p.update();
  say('the table is not drawn again while the drivers stay (a button never changes under a finger)', pg.sets === n0 && pg.box.innerHTML.includes('Alex'));
  names = ['Kim', 'Lee']; p.update();
  say('...but it is when the drivers change', pg.sets === n0 + 1 && pg.box.innerHTML.includes('Kim') && !pg.box.innerHTML.includes('Alex') && pg.rows[0].pts.textContent === '0');
  names = ['Kim']; p.update();
  say('...and when a lane has no car', pg.sets === n0 + 2 && !pg.rows[1]);
}

// ---- without taking the clicks (the page does it) ----
{
  const pg = page(), p = PenaltyPanel.build(pg.box, { eng: () => mkEng([car(0)]), entries: [{ lane: 0, driverName: 'A' }], cfg: () => cfg, phase: () => 'running', send: x => pg.sent.push(x), bind: false });
  say('with bind false the panel does not take the clicks, and click() still works', pg.box.onclick === undefined && (p.click({ closest: () => ({ dataset: { cmd: 'penalty', lane: '0', n: '1' }, disabled: false }) }), pg.sent.length === 1));
}

console.log(fails ? fails + ' PENALTY PANEL TESTS FAILED' : 'ALL PENALTY PANEL TESTS PASSED'); process.exit(fails ? 1 : 0);
