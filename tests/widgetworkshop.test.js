'use strict';
// 2.4.0: the Widget Builder as a Widget Workshop (renderer/widgetlinks.js, widgetworkshop.js, widgetbuilder.js, SlotForgeRestyle.md "Widget Workshop"): where a
// widget is used, the layouts that follow it when it is saved, Add to a layout…, one editor with a Simple / Canvas switch, eight lanes and Play a race in the
// preview, rules with more than one condition, and the Fuel Strip.
const test = require('node:test'),
  assert = require('node:assert/strict');
const L = require('../renderer/widgetlinks.js');
const W = require('../renderer/widgets.js');
const { code, has } = require('./source.cjs');

// as wbToWidget in widgetbuilder.js: a saved widget -> a widget for a layout
const toWidget = (r, lane) => {
  const g = { id: 'n', type: r.type, lane, x: 0, y: 0, w: 300, h: 60, opt: {} };
  g.opt = /^image/.test(r.type) ? { image: r.image || '', fit: r.fit || 'contain', rules: r.rules || [] } : { text: r.text };
  g.w = Number(r.w) || g.w;
  g.h = Number(r.h) || g.h;
  g.textSize = r.textSize ?? 30;
  g.valueBold = r.valueBold !== false;
  g.valueItalic = !!r.valueItalic;
  g.title = r.name || '';
  if (r.composition) g.opt = { composition: r.composition };
  return g;
};
const lap = { id: 'cw1', name: 'Lap counter', type: 'textlane', text: 'LAP {laps}', w: 260, h: 70, textSize: 30 };

test('where a widget is used: copies linked by src, and copies from before 2.4.0 found by their content', () => {
  const linked = { ...toWidget(lap, 2), id: 'a', x: 500, src: 'cw1' };
  const old = { ...toWidget(lap, 0), id: 'b' }; // (no src: the same kind and content)
  const other = { ...toWidget({ ...lap, text: 'Something else' }, 0), id: 'c' };
  const lists = {
    layouts: [
      { id: 'l1', name: 'TV', widgets: [linked, old, other] },
      { id: 'l2', name: 'Empty', widgets: [] }
    ],
    rowdesigns: [{ id: 'r1', name: '', widgets: [{ ...old, id: 'd' }] }]
  };
  const u = L.usage(lap, lists, toWidget);
  assert.deepEqual(u, [
    { id: 'l1', name: 'TV', kind: 'layouts', count: 2 },
    { id: 'r1', name: 'Leaderboard row', kind: 'rowdesigns', count: 1 }
  ]);
  assert.equal(L.usedText(u), 'Used in 2 layouts · TV, Leaderboard row');
  assert.equal(L.usedText([]), 'Not in a layout yet');
  assert.equal(L.isCopy({ ...old, src: 'cw9' }, lap, toWidget), false, 'a copy linked to another widget is not this one');
});

test('saving a widget updates its copies: the content follows, the place, size and lane stay, and the copy is linked', () => {
  const before = { ...lap };
  const now = { ...lap, text: 'LAP {laps} of {total}', textSize: 34 };
  const widgets = [
    { ...toWidget(before, 3), id: 'a', x: 400, y: 200, w: 180, h: 50 },
    { ...toWidget({ ...lap, text: 'Other' }, 0), id: 'b' }
  ];
  const res = L.updateCopies(widgets, now, toWidget, before);
  assert.equal(res.changed, 1);
  assert.deepEqual(res.widgets[0].opt, { text: 'LAP {laps} of {total}' });
  assert.equal(res.widgets[0].textSize, 34);
  assert.deepEqual([res.widgets[0].x, res.widgets[0].y, res.widgets[0].w, res.widgets[0].h, res.widgets[0].lane], [400, 200, 180, 50, 3]);
  assert.equal(res.widgets[0].src, 'cw1');
  assert.equal(res.widgets[1], widgets[1], 'another widget is left alone');
  assert.equal(L.updateCopies(res.widgets, now, toWidget).changed, 0, 'nothing more to change');
});

test('Add to a layout: at the top left, linked, a per-driver widget on the next lane', () => {
  let ws = L.addTo([], lap, toWidget, { perLane: true, lanes: 8, width: 1000, height: 562 });
  ws = L.addTo(ws, lap, toWidget, { perLane: true, lanes: 8, width: 1000, height: 562 });
  assert.deepEqual(
    ws.map(w => [w.x, w.y, w.lane, w.src]),
    [
      [20, 20, 0, 'cw1'],
      [20, 20, 1, 'cw1']
    ]
  );
  const race = L.addTo([], { ...lap, id: 'cw2', type: 'textrace', w: 2000 }, toWidget, { perLane: false, width: 1000, height: 562 });
  assert.equal(race[0].lane, null);
  assert.equal(race[0].w, 1000, 'never wider than the layout');
});

test('Simple and Canvas: a text widget becomes one text block and back; more than that stays canvas', () => {
  const c = L.toCanvas(lap);
  assert.equal(c.composition.root.kind, 'free');
  assert.deepEqual(
    c.composition.root.children.map(k => [k.kind, k.text, k.size]),
    [['text', 'LAP {laps}', 30]]
  );
  const s = L.toSimple(c);
  assert.deepEqual([s.type, s.text, s.textSize, s.w, s.h], ['textlane', 'LAP {laps}', 30, 260, 70]);
  const two = {
    ...c,
    composition: {
      ...c.composition,
      root: { ...c.composition.root, children: [...c.composition.root.children, { kind: 'text', text: 'x' }] }
    }
  };
  assert.equal(L.toSimple(two), null);
  assert.equal(
    L.toCanvas({ ...lap, type: 'imagelane', rules: [{ var: 'position', op: '=', value: '1', image: 'x' }] }),
    null,
    'a picture with rules has no canvas equal'
  );
  assert.equal(L.toCanvas({ ...lap, type: 'imagerace', image: 'data:image/png;base64,AA' }).composition.root.children[0].kind, 'image');
});

test('the rules of a simple picture: "and" conditions must all hold', () => {
  const r = { var: 'position', op: '=', value: '1', and: [{ var: 'laps', op: '>', value: '5' }] };
  assert.equal(W.ruleHolds(r, { position: 1, laps: 6 }), true);
  assert.equal(W.ruleHolds(r, { position: 1, laps: 3 }), false);
  assert.equal(W.ruleHolds(r, { position: 2, laps: 9 }), false);
  assert.equal(W.ruleHolds({ var: 'position', op: '=', value: '1' }, { position: 1 }), true, 'a rule without "and" as before');
  assert.equal(L.conditionsOf(r).length, 2);
});

test('the Fuel Strip: the Fuel widget as a slim strip with FUEL, a bar and the value', () => {
  const html = W.fuelHtml(60, 100, { barStyle: 'strip', mode: 'both' });
  assert.match(html, /<span class="fstrip"/);
  assert.match(html, /<small>FUEL<\/small>/);
  assert.match(html, /class="fsfill" style="width:60%/);
  assert.match(html, /<b>60%<\/b>/);
  assert.doesNotMatch(W.fuelHtml(60, 100, { barStyle: 'strip', mode: 'bar' }), /<b>/, 'the bar alone: no figures');
  assert(has(code('renderer/widgets.js'), "['strip', 'Fuel Strip']"), 'a choice of the Fuel Bar style');
  assert(has(code('renderer/editor.js'), 'data-preset="fuelstrip"'), 'its own pick in the Layout Editor');
  assert(has(code('renderer/styles.css'), '.fstrip{'));
});

test('the workshop is wired: the list, the save hook, the switch, eight lanes and Play a race', () => {
  const wb = code('renderer/widgetbuilder.js'),
    ws = code('renderer/widgetworkshop.js'),
    st = code('renderer/widgetstudio.js'),
    html = code('renderer/index.html');
  assert(has(wb, 'return wwRenderList(box, list);'));
  assert(has(wb, 'await wwAfterSave({ ...data, id: wbEd.id }, wbEd.saved, msg);'));
  assert(has(st, 'wwAfterSave'));
  assert(has(wb, 'Array.from({ length: 8 }'), 'eight sample lanes');
  assert(has(wb, 'data-wbplay'));
  assert(has(wb, 'function wbPlayRace(st, k)'));
  assert(has(ws, 'data-ww-mode="canvas"'));
  assert(has(ws, 'Update ${used.length}'));
  assert(has(code('renderer/editor.js'), 'src: r.id'), 'a widget added from My widgets is linked');
  assert(
    html.indexOf('widgetlinks.js') < html.indexOf('widgetbuilder.js') &&
      html.indexOf('widgetbuilder.js') < html.indexOf('widgetworkshop.js')
  );
});
