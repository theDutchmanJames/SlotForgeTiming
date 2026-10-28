// Dragging in the Rotation Editor (1.16.0), on top of the clicks, which still work (keyboard, screen reader, a click on a participant and then on a place).
//   a participant (chip) onto a place        -> the participant stands there (whoever stood there leaves the heat), as with a click
//   a place with a participant onto a place  -> the two swap (onto an empty place: the participant moves there)
//   a place with a participant onto the row of participants -> the place is emptied
//   a heat by its grip (the dots in the first column) onto another heat -> the heat moves there (not past a locked heat)
// plan() says what a drop does (pure, the same rules as the buttons: rotation.js). attach() takes the pointer events (mouse, touch and pen) of the editor's box.
// The page shows what it can: a ghost that follows the pointer, the place under it lit (red-dashed when it cannot be done, e.g. a locked heat) and the places of the same participant marked.
const RotDrag = (() => {
  const THRESHOLD = 6; // pixels: a smaller move is a click
  // from: { kind: 'chip', p } | { kind: 'cell', heat, lane } | { kind: 'heat', heat }; to: { kind: 'cell', heat, lane } | { kind: 'tray' } | { kind: 'heat', heat } | null
  // gives { rec } or { error } (what the buttons give), or null when the drop changes nothing
  function plan(d, from, to) {
    if (!from || !to) return null;
    const at = (heat, lane) => (d.heats[heat] ? d.heats[heat].places.find(e => e.lane === lane) || null : null);
    if (from.kind === 'chip' && to.kind === 'cell') {
      const here = at(to.heat, to.lane); if (here && here.p === from.p) return null;
      return Rot.place(d, to.heat, to.lane, from.p);
    }
    if (from.kind === 'cell' && to.kind === 'cell') {
      if (from.heat === to.heat && from.lane === to.lane) return null;
      return Rot.swap(d, { heat: from.heat, lane: from.lane }, { heat: to.heat, lane: to.lane });
    }
    if (from.kind === 'cell' && to.kind === 'tray') return at(from.heat, from.lane) ? Rot.place(d, from.heat, from.lane, null) : null;
    if (from.kind === 'heat' && to.kind === 'heat') return from.heat === to.heat ? null : Rot.moveHeatTo(d, from.heat, to.heat);
    return null;
  }

  // what is picked up by a pointer that goes down on el (the clicked element): null when it cannot be dragged
  function sourceOf(el) {
    const b = el && el.closest ? el.closest('[data-pp],[data-cell],[data-hh]') : null; if (!b) return null;
    const ds = b.dataset || {};
    if (ds.pp !== undefined) return { el: b, from: { kind: 'chip', p: Number(ds.pp) }, p: Number(ds.pp), text: ds.short || b.textContent, color: ds.color };
    if (ds.cell !== undefined) { // (only a place with a participant, and not in a locked heat)
      if (ds.p === undefined || ds.lk !== undefined) return null;
      const [heat, lane] = String(ds.cell).split(':').map(Number);
      return { el: b, from: { kind: 'cell', heat, lane }, p: Number(ds.p), text: ds.short || b.textContent, color: ds.color };
    }
    if (ds.hh !== undefined) return ds.lk !== undefined ? null : { el: b, from: { kind: 'heat', heat: Number(ds.hh) }, p: null, text: `Heat ${Number(ds.hh) + 1}`, color: '' };
    return null;
  }
  // what is under the pointer, for this kind of drag: { to, el } or null
  function targetOf(from, t) {
    if (!t || !t.closest) return null;
    if (from.kind === 'heat') { const r = t.closest('[data-hrow]'); return r ? { to: { kind: 'heat', heat: Number((r.dataset || {}).hrow) }, el: r } : null; }
    const c = t.closest('[data-cell]');
    if (c) { const [heat, lane] = String((c.dataset || {}).cell).split(':').map(Number); return { to: { kind: 'cell', heat, lane }, el: c }; }
    if (from.kind === 'cell') { const tr = t.closest('#ro-pool'); if (tr) return { to: { kind: 'tray' }, el: tr }; }
    return null;
  }

  // o: { d (the rotation being edited, or a function that gives it), find(x, y) (the element at a point; default: document.elementFromPoint),
  //      drop(from, to) (the page does the drop: it applies plan(); true when something changed), end(changed) (a drag is over: the page draws what it has to) }
  // gives { suppressed() (true just after a drag, so the click that follows is not taken for a click), cancel() }
  function attach(box, o) {
    const find = o.find || ((x, y) => (typeof document !== 'undefined' && document.elementFromPoint ? document.elementFromPoint(x, y) : null));
    const getD = () => (typeof o.d === 'function' ? o.d() : o.d);
    let st = null, quiet = false, timer = null, keyOff = null;
    const cls = (el, name, on) => { if (el && el.classList) el.classList[on ? 'add' : 'remove'](name); };
    // the places of the participant that is dragged are marked (and the others dimmed), as when a participant is picked
    const mark = (p, on) => {
      if (p === null || p === undefined || !box.querySelectorAll) return;
      cls(box.querySelector ? box.querySelector('.rogrid') : null, 'hl', on);
      box.querySelectorAll('[data-cell]').forEach(c => { if (c.dataset && c.dataset.p === String(p)) cls(c, 'mine', on); });
    };
    const light = (target, ok) => { // the place under the pointer: lit, or lit as "not possible"
      if (st.over && st.over.el !== (target && target.el)) { cls(st.over.el, 'dropok', false); cls(st.over.el, 'dropno', false); }
      st.over = target || null;
      if (target) { cls(target.el, 'dropok', ok); cls(target.el, 'dropno', !ok); }
    };
    const look = () => { // after the pointer moved (or the page scrolled under it): the ghost and the place under the pointer
      if (!st || !st.on) return;
      if (st.ghost && st.ghost.style) { st.ghost.style.left = st.x + 'px'; st.ghost.style.top = st.y + 'px'; }
      const target = targetOf(st.from, find(st.x, st.y)), res = target ? plan(getD(), st.from, target.to) : null;
      light(target, !(res && res.error));
    };
    const clean = () => { // what the drag put on the page goes: the ghost, the lights, the marks, the timers
      if (timer) { clearInterval(timer); timer = null; }
      if (keyOff) { keyOff(); keyOff = null; }
      if (st && st.on && !st.cleaned) { st.cleaned = true; light(null, true); mark(st.p, false); cls(st.src, 'dragging', false); if (st.ghost && st.ghost.remove) st.ghost.remove(); }
    };
    const stop = () => {
      clean();
      if (st) { try { if (st.src && st.src.releasePointerCapture && st.id !== undefined) st.src.releasePointerCapture(st.id); } catch (e) { /* (it was released already) */ } }
      st = null;
    };
    const begin = () => {
      st.on = true; cls(st.src, 'dragging', true); mark(st.p, true);
      if (typeof document !== 'undefined' && document.createElement) {
        const g = document.createElement('div'); g.className = 'rodrag'; g.textContent = st.text; if (g.style && g.style.setProperty && st.color) g.style.setProperty('--pc', st.color);
        if (box.appendChild) box.appendChild(g); st.ghost = g;
      }
      // near the top or the bottom of the window the page scrolls, so a place far away can be reached
      timer = setInterval(() => {
        if (!st || typeof window === 'undefined' || !window.scrollBy || typeof window.innerHeight !== 'number') return;
        const edge = 70, y = st.y, h = window.innerHeight;
        if (y < edge) window.scrollBy(0, -Math.ceil((edge - y) / 3)); else if (y > h - edge) window.scrollBy(0, Math.ceil((y - (h - edge)) / 3)); else return;
        look();
      }, 40);
      if (typeof document !== 'undefined' && document.addEventListener) { // Esc lets go of what is dragged: nothing changes
        const f = e => { if (e && e.key === 'Escape' && st && !st.dead) { clean(); st.dead = true; o.end && o.end(false); } };
        document.addEventListener('keydown', f); keyOff = () => document.removeEventListener('keydown', f); }
    };
    box.onpointerdown = ev => {
      if (st || (ev.button !== undefined && ev.button !== 0)) return;
      const s = sourceOf(ev.target); if (!s) return;
      st = { id: ev.pointerId, from: s.from, src: s.el, p: s.p, text: s.text, color: s.color, x0: ev.clientX, y0: ev.clientY, x: ev.clientX, y: ev.clientY, on: false, over: null, ghost: null };
      try { if (s.el.setPointerCapture && ev.pointerId !== undefined) s.el.setPointerCapture(ev.pointerId); } catch (e) { /* (a pointer that is gone: nothing to hold) */ }
    };
    box.onpointermove = ev => {
      if (!st || st.dead || ev.pointerId !== st.id) return;
      st.x = ev.clientX; st.y = ev.clientY;
      if (!st.on) { if (Math.hypot(st.x - st.x0, st.y - st.y0) < THRESHOLD) return; begin(); }
      look();
    };
    const finish = (ev, drop) => {
      if (!st || ev.pointerId !== st.id) return;
      const was = st.on, dead = !!st.dead, from = st.from, target = was && drop && !dead ? targetOf(from, find(ev.clientX, ev.clientY)) : null;
      stop();
      if (!was) return; // (it was a click: the click comes on its own)
      quiet = true; setTimeout(() => { quiet = false; }, 0); // (the click that follows a drag is not a click)
      if (dead) return;
      const done = !!(target && o.drop && o.drop(from, target.to));
      if (o.end) o.end(done);
    };
    box.onpointerup = ev => finish(ev, true);
    box.onpointercancel = ev => finish(ev, false);
    return { suppressed: () => quiet, cancel: () => { stop(); } };
  }
  return { plan, attach, sourceOf, targetOf, THRESHOLD };
})();
