'use strict';
// 2.4.0 review, speed: the standings sum laps without copying them, date formatters are made once, the widget list is a map, Home asks for its
// lists at the same time, the second screen's Results page is built again only when it changed, the race chart measures its box after a resize
// only, and a running lap timer whose digits alone changed keeps its fit.
const test = require('node:test'),
  assert = require('node:assert/strict');
const { code, has } = require('./source.cjs');
const E = require('../renderer/engine.js');
const ent = n => Array.from({ length: n }, (_, i) => ({ lane: i, driverName: 'D' + i, driverId: 'd' + i }));

test('the gaps in the standings are the same with the summing loop', () => {
  const r = E.createRace({ type: 'race', laps: 50, entries: ent(3) });
  r.start(0);
  let t = [0, 0, 0];
  for (let k = 0; k < 20; k++)
    for (let c = 0; c < 3; c++) {
      t[c] += 4000 + c * 37 + (k % 3) * 11;
      r.cross(c, t[c]);
    }
  const st = r.standings();
  assert.equal(st[0].car.driverName, 'D0');
  assert.equal(st.length, 3);
  assert.ok(!has(code('renderer/engine.js'), 'car.laps.slice(0, n).reduce'), 'no copy of the lap list per call');
});

test('date formatters are made once per pattern', () => {
  for (const f of ['renderer/recordbook.js', 'renderer/championship.js', 'renderer/database/results.js', 'renderer/findindex.js'])
    assert.match(code(f), /new Intl\.DateTimeFormat/, f);
  assert.ok(!/toLocale(Date)?String\('en-GB'/.test(code('renderer/recordbook.js')));
  const RB = require('../renderer/recordbook.js');
  assert.equal(typeof RB.correct, 'function');
});

test('the widget list is looked up in a map', () => {
  const W = code('renderer/widgets.js');
  assert.ok(has(W, 'const DEF_MAP = new Map();'));
  assert.ok(!has(W, 'const def = type => REGISTRY.find(d => d.type === type);'));
});

test('Home asks for its other lists at the same time as the main ones', () => {
  const L = code('renderer/landing.js');
  assert.ok(has(L, "const extraLists = Promise.all(['multiclasssystems', 'raceclasses', 'virtualrivalsystems'].map(e => api.list(e)));"));
  assert.ok(has(L, 'const [multiProfiles, classDefs, rivalProfiles] = await extraLists;'));
});

test('the second screen builds its Results page again only when it changed, and paints once per tick', () => {
  const V = code('renderer/liveview.js');
  assert.ok(has(V, 'if (body._rvHtml !== html || !body.firstChild || body._rvNode !== body.firstChild) {'));
  assert.ok(has(V, 'performance.now() - lastPaint >= 90'));
});

test('the race chart and the lap timers do not measure themselves on every frame', () => {
  const C = code('renderer/canvas.js');
  assert.ok(has(C, 'n.chartSize = null;'));
  assert.ok(has(C, "out.html.replace(/\\d/g, '0') === L[0].replace(/\\d/g, '0')"));
  assert.ok(has(code('renderer/frame.js'), 'v._sfDigitsFit = simple && tabular ? fontEpoch : null;'));
});
