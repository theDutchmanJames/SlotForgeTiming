'use strict';
// 2.4.0 review: the fixes of the widgets, the layouts and their editors (styles that pinned sizes, Undo of the Simple / Canvas switch, the points of a
// composed widget beside a virtual rival, widgets of another version kept on save, widgets that stay on the page, group resize, keys behind a dialog,
// duplicates beside the originals, the words of a virtual rival, the Theme box, the titles of linked copies, one ResizeObserver per editor).
const test = require('node:test'),
  assert = require('node:assert/strict');
global.Frame = require('../renderer/frame.js');
const W = require('../renderer/widgets.js'),
  WD = require('../renderer/widgetdesign.js'),
  WL = require('../renderer/widgetlinks.js');
const { code, has } = require('./source.cjs');

test('F1: a saved style does not pin a picture size or sizes the widget never set', () => {
  const l = { widgets: [] };
  const s = WD.saveStyle(l, { type: 'bestlap', w: 150, h: 60, textSize: '', opt: {} }, 'x');
  assert.deepEqual(s.style.typography, {});
  const pace = { type: 'pace', w: 300, h: 300, opt: { gaugeScale: 55 } };
  WD.applyStyle(pace, WD.cleanStyles(l.widgetStyles)[0]);
  assert.equal(Frame.typography(pace).iconSize, 165, 'the gauge keeps the size of its own widget');
  assert(!Object.hasOwn(pace.typography || {}, 'iconSize'));
  // a style saved before the fix (with a computed iconSize) does not pin it either; a size the widget set itself stays
  const old = { id: 'o', name: 'old', style: { typography: { mode: 'auto', iconSize: 44 } } };
  const own = { type: 'pace', w: 300, h: 300, opt: {}, typography: { iconSize: 120 } };
  WD.applyStyle(own, WD.cleanStyles([old])[0]);
  assert.equal(own.typography.iconSize, 120);
  assert.equal(own.typography.mode, 'auto');
});

test('F2: the Simple / Canvas switch is a step of Undo, and Undo draws the editor of the kind it goes back to', () => {
  assert(has(code('renderer/widgetworkshop.js'), 'wbEd.history.touch(); wbEd.history.commit();'));
  assert(has(code('renderer/widgetstudio.js'), "draftUndo(ed, 'wc', () => (ed.draft.composition ? edit(box) : renderWidgetBuilder(box)))"));
  assert(
    has(
      code('renderer/widgetbuilder.js'),
      "draftUndo(wbEd, 'wb', () => (wbEd.draft.composition ? renderWidgetBuilder(box) : renderWidgetBuilderEditor(box)))"
    )
  );
});

test('F3: the live championship points of a composed widget count the place without a virtual rival', () => {
  assert(has(code('renderer/timing.js'), 'pts += ch.list[(S0.rowOf(c.real || c).physicalPos || S0.rowOf(c.real || c).pos) - 1] || 0;'));
  const T = require('../renderer/timing.js'),
    c = { driverId: 'd', laps: [1000] };
  const S = {
    eng: { cars: [c] },
    phase: 'running',
    champ: { on: true, done: new Map(), list: [25, 18, 15] },
    rowOf: () => ({ pos: 2, physicalPos: 1 }) // (a rival leads: this car is first of the real cars)
  };
  assert.equal(T.orderValue('champ', { virtual: true, real: c, driverId: 'd', laps: [] }, S, 0), 25);
});

test('F4: widgets this version does not know are kept aside and written back on save', () => {
  const e = code('renderer/editor.js');
  assert(has(e, 'const unknownWidgets = list => (Array.isArray(list) ? list : []).filter(w => w && !Widgets.def(w.type));'));
  assert.equal((e.match(/unknown: unknownWidgets\(draft\.widgets\)/g) || []).length, 2, 'the layout and the row design editor');
  assert(has(e, 'widgets: [...d.widgets, ...(ed.unknown || [])], //'));
  assert(has(e, "kind: 'row', widgets: [...d.widgets, ...(ed.unknown || [])] });"));
});

test('F5, F8: an added widget and the Fuel Strip stay on the page (or in the row)', () => {
  const e = code('renderer/editor.js');
  assert(has(e, 'g.x = Math.max(0, Math.min(g.x, U - g.w)); g.y = Math.max(0, Math.min(g.y, H - g.h)); d.widgets.push(g);'));
  assert(has(e, 'g.w = Math.min(U, Math.max(g.w, 300)); g.x = Math.max(0, Math.min(g.x, U - g.w));'));
});

test('F6: resizing a group with the same scale across and down keeps the bottom edge on the edge of the box', () => {
  const f = [
    { x: 0, y: 0, w: 100, h: 100 },
    { x: 0, y: 100, w: 100, h: 100 }
  ];
  const out = W.scaleGroup(f, W.bbox(f), { x: 0, y: 0, w: 153, h: 306 }, true, 1000, 562);
  assert.equal(out[1].y + out[1].h, 306);
  assert.equal(out[0].x + out[0].w, 153);
});

test('F7: the keys of a dialog do not delete or select the widgets behind it', () => {
  assert(has(code('renderer/editor.js'), "if (dlg.open === true || (e.target && e.target.closest && e.target.closest('dialog'))) return;"));
});

test('F9: a duplicate with no room below goes beside the originals; a row design keeps its lanes', () => {
  const bottom = [{ x: 100, y: 500, w: 200, h: 60, lane: 0 }];
  const [c] = W.duplicateWidgets(bottom, null, 1000, 562);
  assert(c.x !== 100 || c.y !== 500, 'not exactly on the original');
  assert.equal(c.y, 502, 'down only as far as the page allows');
  assert.equal(c.x, 310);
  const [d] = W.duplicateWidgets([{ x: 0, y: 100, w: 100, h: 60, lane: 0 }], null, 1000, 562);
  assert.deepEqual([d.x, d.y], [0, 170], 'with room below: below, as before');
  assert(has(code('renderer/editor.js'), 'if (row) copies.forEach((g, i) => (g.lane = src[i].lane));'));
});

test('F10: a custom text on a virtual rival: the lap it is on, a dash for words it has no value for, the standard text', () => {
  const t = code('renderer/timing.js');
  assert(has(t, "Wd.fillText(opt.text ?? Wd.TEXT_LANE_DEFAULT, { ...Object.fromEntries(Wd.TEXT_LANE_VARS.map(([k]) => [k, '–'])),"));
  assert(has(t, 'lap: c.done ? c.laps.length : c.laps.length + 1,'));
});

test('F11: unticking Theme default uses the colour beside it', () => {
  assert(has(code('renderer/editor.js'), "v = t.checked ? '' : (pick && pick.value) || '';"));
});

test('F12: updating the copies keeps a title the layout gave a copy', () => {
  const toWidget = r => ({ type: r.type, opt: { text: r.text }, textSize: 30, valueBold: true, valueItalic: false, title: r.name });
  const before = { id: 'a', name: 'Old', type: 'textlane', text: 'x' },
    r = { id: 'a', name: 'New', type: 'textlane', text: 'y' };
  const res = WL.updateCopies(
    [
      { src: 'a', type: 'textlane', title: 'Old', opt: {} },
      { src: 'a', type: 'textlane', title: 'My own', opt: {} }
    ],
    r,
    toWidget,
    before
  );
  assert.equal(res.widgets[0].title, 'New', 'the old name follows the new one');
  assert.equal(res.widgets[1].title, 'My own', 'a title of its own stays');
  assert.equal(res.widgets[1].opt.text, 'y');
});

test('F13: one ResizeObserver per editor, the one before disconnected', () => {
  assert(has(code('renderer/widgetbuilder.js'), 'wbPrevRO?.disconnect(); wbPrevRO = null;'));
  assert(has(code('renderer/editor.js'), 'rvObserver?.disconnect(); rvObserver = null;'));
  const ce = code('renderer/charteditor.js');
  assert(has(ce, 'chartListObserver?.disconnect(); chartListObserver = null;'));
  assert(!has(ce, 'new ResizeObserver(fit).observe(el)'));
});
