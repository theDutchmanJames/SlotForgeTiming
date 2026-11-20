// (2.4.0, SlotForgeRestyle.md "Widget Workshop") a saved widget and the layouts that use it: a layout keeps its own copy, but the copy knows where it came
// from (src: the id of the saved widget), so the builder can say where a widget is used, update those copies when it is saved, and add it to a layout.
// Also: a simple text widget turned into canvas blocks (and back), and the rules of a simple picture with more than one condition.
// Pure: it works on plain objects, so it can be tested without a screen. widgetbuilder.js and widgetstudio.js use it.
(function (root) {
  'use strict';
  const clone = v => JSON.parse(JSON.stringify(v ?? null));
  const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  // what a copy in a layout takes from the saved widget (its place, size, lane and look in the layout stay)
  function contentOf(r, toWidget) {
    const w = toWidget(r, 0);
    return { type: w.type, opt: clone(w.opt), textSize: w.textSize, valueBold: w.valueBold, valueItalic: w.valueItalic, title: w.title };
  }
  // is this widget of a layout a copy of the saved widget r? Linked by src, or (a copy from before 2.4.0) the same kind with the same content
  function isCopy(w, r, toWidget) {
    if (!w || !r) return false;
    if (w.src) return w.src === r.id;
    const c = contentOf(r, toWidget);
    return w.type === c.type && same(w.opt, c.opt) && (w.title || '') === (c.title || '');
  }
  // where a saved widget is used: [{ id, name, kind ('layouts' | 'rowdesigns'), count }]
  function usage(r, lists, toWidget) {
    const out = [];
    for (const [kind, list] of Object.entries(lists || {}))
      for (const l of Array.isArray(list) ? list : []) {
        const n = (Array.isArray(l.widgets) ? l.widgets : []).filter(w => isCopy(w, r, toWidget)).length;
        if (n) out.push({ id: l.id, name: l.name || (kind === 'rowdesigns' ? 'Leaderboard row' : 'Layout'), kind, count: n });
      }
    return out;
  }
  const usedText = u =>
    !u.length ? 'Not in a layout yet' : `Used in ${u.length} ${u.length === 1 ? 'layout' : 'layouts'} · ${u.map(x => x.name).join(', ')}`;
  // the widgets of a layout with its copies of r brought up to date (place, size, lane and look stay) and linked; { widgets, changed }
  // before: the widget as it was saved until now (an unlinked copy is found by that content)
  function updateCopies(widgets, r, toWidget, before) {
    const c = contentOf(r, toWidget);
    let changed = 0;
    const next = (Array.isArray(widgets) ? widgets : []).map(w => {
      if (!(w && (w.src ? w.src === r.id : isCopy(w, { ...(before || r), id: r.id }, toWidget)))) return w;
      const n = {
        ...w,
        opt: clone(c.opt),
        textSize: c.textSize,
        valueBold: c.valueBold,
        valueItalic: c.valueItalic,
        title: c.title,
        src: r.id
      };
      if (!same(n, w)) changed++;
      return n;
    });
    return { widgets: next, changed };
  }
  // the widget r added to a layout: at the top left (the Layout Editor moves it), lane 1 for a per-driver widget (the next free lane when it is there already)
  function addTo(widgets, r, toWidget, o = {}) {
    const list = Array.isArray(widgets) ? widgets : [],
      mine = list.filter(w => isCopy(w, r, toWidget)),
      per = !!o.perLane,
      lane = per ? Math.min((o.lanes || 8) - 1, mine.length) : null;
    const w = toWidget(r, lane === null ? 0 : lane);
    w.x = 20;
    w.y = 20;
    w.w = Math.min(Number(w.w) || 300, o.width || 1000);
    w.h = Math.min(Number(w.h) || 60, o.height || 562);
    w.lane = lane;
    w.src = r.id;
    if (!w.id) w.id = 'w' + Math.random().toString(36).slice(2, 10);
    return [...list, w];
  }

  // ---- Simple and Canvas: one widget, two ways to make it ----
  // a simple text widget as canvas blocks: one text block that fills the canvas, with the same words and size
  function toCanvas(r) {
    if (!r || r.composition) return r;
    if (r.type === 'imagelane' || r.type === 'imagerace') {
      if ((r.rules || []).length) return null; // (a picture with rules has no canvas equal)
      const img = /^data:image\/(png|jpeg|webp|gif);base64,/i.test(r.image || '') ? r.image : '';
      return {
        ...simpleRest(r),
        type: r.type === 'imagerace' ? 'textrace' : 'textlane',
        composition: frame([
          { id: 'pic', kind: 'image', image: img, fit: r.fit === 'cover' ? 'cover' : 'contain', frame: { x: 0, y: 0, w: 100, h: 100 } }
        ])
      };
    }
    return {
      ...simpleRest(r),
      composition: frame([
        {
          id: 'txt',
          kind: 'text',
          text: String(r.text || ''),
          size: Number(r.textSize) || 0,
          align: 'center',
          frame: { x: 0, y: 0, w: 100, h: 100 }
        }
      ])
    };
  }
  const simpleRest = r => ({ name: r.name, type: r.type, w: r.w, h: r.h });
  const frame = children => ({ version: 1, root: { id: 'canvas', kind: 'free', frame: { x: 0, y: 0, w: 100, h: 100 }, children } });
  // a canvas that is one text block (without rules) is a simple text widget again; anything more stays canvas (null)
  function toSimple(r) {
    if (!r || !r.composition) return r;
    const kids = (r.composition.root && r.composition.root.children) || [];
    if (kids.length !== 1 || kids[0].kind !== 'text' || (kids[0].rules || []).length) return null;
    return {
      name: r.name,
      type: r.type === 'textrace' ? 'textrace' : 'textlane',
      text: kids[0].text || '',
      w: r.w,
      h: r.h,
      textSize: Number(kids[0].size) || 30,
      valueBold: true,
      valueItalic: false
    };
  }

  // ---- the rules of a simple picture: the first condition, and more that must all hold ("and") ----
  const conditionsOf = rule =>
    [{ var: rule.var, op: rule.op || '=', value: rule.value }, ...(Array.isArray(rule.and) ? rule.and : [])].filter(c => c && c.var);

  const api = { contentOf, isCopy, usage, usedText, updateCopies, addTo, toCanvas, toSimple, conditionsOf };
  root.WidgetLinks = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
