'use strict';
// 2.4.0: Finalize race results as a classification and a lap explorer (renderer/review.js finishHtml). Suspect laps, the filters, several laps at once,
// a lap back in the records, and what the race screen still finds on the page.
const test = require('node:test'),
  assert = require('node:assert/strict');
global.window = global;
global.esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
global.RaceEngine = require('../renderer/engine.js');
global.Stats = require('../renderer/stats.js');
global.Icons = { trophy: () => '<svg class="trophy"></svg>' };
global.AdjustPad = { padsHtml: () => '<div data-pad="time"></div>' };
global.Distance = { sectorLabel: (s, k) => 'S' + k };
const Review = require('../renderer/review.js');

// a race of 3 cars, 40 laps each: car 1 has a crossing missed (a lap of about two), car 2 one counted twice (a very short lap)
function race() {
  const E = [0, 1, 2].map(i => ({ lane: i, driverId: 'd' + i, carId: 'c' + i, driverName: ['Anna', 'Bjorn', 'Chris'][i] }));
  const r = RaceEngine.createRace({ type: 'race', laps: 500, minLap: 500, entries: E });
  r.start(0);
  const t = [0, 0, 0];
  for (let k = 0; k < 40; k++)
    for (let i = 0; i < 3; i++) {
      let lap = 5000 + i * 100 + ((k * 37) % 300);
      if (i === 1 && k === 20) lap *= 2;
      if (i === 2 && k === 30) lap = 1200;
      t[i] += lap;
      r.cross(i, t[i]);
    }
  r.stop(t[2] + 10);
  return r;
}

test('a lap far from the usual one is suspect: about two laps (a crossing missed) or very short (counted twice)', () => {
  const r = race(),
    med = c => Review.median(c.laps);
  const long = Review.lapFacts(r.cars[1], 20, med(r.cars[1]), false),
    short = Review.lapFacts(r.cars[2], 30, med(r.cars[2]), false),
    plain = Review.lapFacts(r.cars[0], 5, med(r.cars[0]), false);
  assert.equal(long.kind, 'sus');
  assert.match(long.tags.map(x => x[1]).join(), /About 2 laps: a crossing missed\?/);
  assert.equal(short.kind, 'sus');
  assert.match(short.tags.map(x => x[1]).join(), /counted twice/);
  assert.equal(plain.kind, 'ok');
  r.setInvalid(0, 5, true);
  assert.equal(Review.lapFacts(r.cars[0], 5, med(r.cars[0]), false).kind, 'bad');
});

test('the classification has a row per driver in its order, with a lap chart, and no lap buttons until a driver is picked', () => {
  Review.reset();
  const r = race(),
    h = Review.finishHtml(r, { settings: {}, color: l => ['#e5484d', '#4c9aff', '#f2b705'][l] });
  assert.equal((h.match(/<article class="rfinish-card/g) || []).length, 3);
  assert.equal((h.match(/class="rf-sparkline"/g) || []).length, 3);
  assert.ok(h.includes('1 suspect'), 'the rows say how many laps are suspect');
  assert.ok(!h.includes('Mark invalid') && h.includes('rx-hint'), 'the explorer waits for a driver');
  assert.ok(h.includes('--c:#4c9aff'), 'the lane colour of a driver');
});

test('the explorer: a chart bar for every lap, the figures, the filters with their counts, and the best lap that is suspect said so', () => {
  Review.reset();
  const r = race();
  Review.ui.open.add(2);
  let h = Review.finishHtml(r, { settings: {} });
  assert.equal((h.match(/data-rv="rxjump" data-car="2"/g) || []).length, 40);
  assert.ok(h.includes('Suspect <em>1</em>'));
  assert.ok(h.includes('suspect: it goes in the records'), 'its fastest lap is the one counted twice');
  assert.equal((h.match(/class="rx-row /g) || []).length, 40);
  Review.ui.filter = 'sus';
  h = Review.finishHtml(r, { settings: {} });
  assert.equal((h.match(/class="rx-row /g) || []).length, 1);
  assert.ok(h.includes('data-rx-lap="30"'));
  Review.reset();
});

test('several laps at once, the filter and a bar of the chart go through the same commands; a lap goes back in the records', async () => {
  Review.reset();
  const r = race(),
    sent = [];
  let draws = 0;
  const root = {};
  Review.bind(
    root,
    c => {
      sent.push(c);
      Review.apply(r, c);
    },
    () => draws++
  );
  const click = dataset => root.onclick({ target: { closest: () => ({ dataset, disabled: false, closest: () => null }) } });
  await click({ rv: 'laps', excl: '1', car: '1' });
  assert.deepEqual([...Review.ui.open], [1]);
  await click({ rv: 'laps', excl: '1', car: '2' });
  assert.deepEqual([...Review.ui.open], [2], 'one driver at a time');
  await click({ rv: 'rxpick', car: '2', lap: '3' });
  await click({ rv: 'rxpickall', car: '2', laps: '4,5' });
  assert.deepEqual([...Review.ui.checked].sort(), [3, 4, 5]);
  await click({ rv: 'rxbulk', car: '2', do: 'invalid' });
  assert.deepEqual(r.cars[2].invalid, [3, 4, 5]);
  assert.equal(Review.ui.checked.size, 0);
  await click({ rv: 'rxpick', car: '2', lap: '7' });
  await click({ rv: 'rxbulk', car: '2', do: 'records' });
  assert.deepEqual(r.cars[2].removed, [7]);
  assert.equal(Review.apply(r, { op: 'restorelap', car: 2, lap: 7 }), true);
  assert.deepEqual(r.cars[2].removed, [], 'back in the records');
  await click({ rv: 'rxjump', car: '2', lap: '12' });
  assert.equal(Review.ui.focus, 12);
  assert.ok(draws > 0);
  Review.reset();
});

test('the page keeps where the lap list was scrolled to', () => {
  const list = { dataset: { rxScroll: '2' }, scrollTop: 480 };
  let after = null;
  const root = {
    innerHTML: '',
    querySelectorAll: () => (after ? [after] : [list]),
    querySelector: () => null
  };
  const fresh = { dataset: { rxScroll: '2' }, scrollTop: 0 };
  Object.defineProperty(root, 'innerHTML', {
    set() {
      after = fresh;
    },
    get: () => ''
  });
  Review.render(root, '<div></div>');
  assert.equal(fresh.scrollTop, 480);
});
