// Builds a timing page from a layout and paints it. Used by the live race screen and by the read-only
// Live Race pages (second screen), so both always look the same.
const LiveCanvas = (() => {
  // o.onButton(type): when given, control widgets (start, pause, ...) are made as working buttons;
  // without it they are left out (a read-only page). o.maxH: space kept free below the page, in px.
  function build(canvas, layout, lanes, o = {}) {
    const U = Widgets.U, H = Widgets.heightOf(layout), nodes = [];
    canvas.innerHTML = '';
    canvas.style.aspectRatio = `${layout.ratioW} / ${layout.ratioH}`;
    canvas.style.width = `min(100%, calc((100vh - ${o.maxH ?? 190}px) * ${layout.ratioW / layout.ratioH}))`;
    const back = Backdrop.node(layout); if (back) canvas.appendChild(back); // the page's background picture, behind the widgets (backdrop.js)
    layout.widgets.filter(w => { const d = Widgets.def(w.type); return d && (!d.perLane || w.lane < lanes) && (!d.button || o.onButton); }).forEach(w => {
      const d = Widgets.def(w.type);
      const el = document.createElement('div'), val = document.createElement(d.button ? 'button' : 'span');
      el.className = 'lw live' + (d.button ? ' btnw' : '') + (w.titleSpace ? ' tspace' : '') + Widgets.alignClassOf(w); val.className = 'lw-val';
      if (!d.button) { val.style.fontWeight = w.valueBold === false ? '400' : '600'; val.style.fontStyle = w.valueItalic ? 'italic' : ''; }
      let tit = null;
      if (Widgets.showTitleOf(w)) { // the widget's title (its name, or the one you gave it)
        tit = document.createElement('span'); tit.className = 'lw-title'; tit.textContent = Widgets.titleOf(w); tit.style.fontSize = `${(w.titleSize || 12) / 10}cqw`; if (w.titleBold) tit.style.fontWeight = '700'; el.appendChild(tit);
      }
      Object.assign(el.style, { left: `${w.x / U * 100}%`, top: `${w.y / H * 100}%`, width: `${w.w / U * 100}%`, height: `${w.h / H * 100}%`, fontSize: `${(w.textSize || d.textSize) / 10}cqw`, borderRadius: Frame.corner(w, layout, U) }); // '' = the style sheet's corners
      if (d.button) val.onclick = ev => { if (ev && ev.currentTarget && ev.currentTarget.blur) ev.currentTarget.blur(); o.onButton(w.type); };
      el.appendChild(val); canvas.appendChild(el);
      if (typeof ResizeObserver !== 'undefined' && typeof WxW !== 'undefined' && ['wxforecast', 'tyre'].includes(w.type)) new ResizeObserver(() => WxW.fit(val)).observe(val); // (the widget got its size, or the window changed: fit it again)
      if (typeof ResizeObserver !== 'undefined' && typeof Delta !== 'undefined' && Delta.isDelta(w.type)) new ResizeObserver(() => Delta.fit(val)).observe(val); // (a Delta Timer: the arrow and the number stay inside the badge when the widget or the window changes size)
      nodes.push({ w, el, val, tit, base: Widgets.colorsOf(w, layout), layout, last: null });
    });
    return nodes;
  }
  // S: the shared state the widgets are drawn from (see race.js and liveshare.js)
  function paint(nodes, S) {
    nodes.forEach(n => {
      let out; try { out = Timing.content(n.w, S); } catch (x) { if (!n.failed) { n.failed = true; console.error('A widget could not be drawn (' + (n.w && n.w.type) + '):', x); } return; } // (one widget that fails does not stop the others from being drawn)
      const key = JSON.stringify([out.html, out.color, out.bg, out.disabled]);
      if (key === n.last) return;
      n.last = key; n.val.innerHTML = out.html;
      if (out.html.includes('class="rrows"') && typeof Rows !== 'undefined' && n.val.querySelectorAll) Rows.fitText(n.val); // a leaderboard of row designs: no text wider than its cell
      if (/class="(wxw|wxt)[ "]/.test(out.html) && typeof WxW !== 'undefined') WxW.fit(n.val); // a weather widget: no picture or text outside the widget, whatever the word (Dry, Cloudy, Clearing)
      if (out.html.includes('dlt-badge') && typeof Delta !== 'undefined') Delta.fit(n.val); // a Delta Timer: the arrow and the number inside the badge, however small the widget
      if (out.button) n.val.disabled = !!out.disabled;
      n.el.style.color = out.color || n.base.color || 'var(--ink)'; // own colour > event colour here, then lane colour, then theme
      Object.assign(n.el.style, Frame.style(out.bg || n.base.bg, n.w, 'var(--line)', n.layout, Widgets.U)); // background and border: the widget's own settings (frame.js)
      if (n.el.style.setProperty) n.el.style.setProperty('--wf', String(Frame.solidity(n.w, n.layout))); // how solid it is: the depth of the page (styles.css) fades with it
    });
  }
  // The fullscreen view: only the widgets of the layout, as large as the window allows, without the buttons (the race is run with the keys).
  // A small bar with a way out appears when the pointer moves (or the screen is touched) and goes away again after a moment. Esc closes the view.
  // o.onClose runs once, when the view is closed (by the button, Esc or close()). Returns { nodes, root, close }: paint the nodes like those of build().
  function fullView(layout, lanes, o = {}) {
    const root = document.createElement('div'), canvas = document.createElement('div'), bar = document.createElement('div'), exit = document.createElement('button');
    root.className = 'fullview'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Timing page, full screen');
    canvas.className = 'canvas live'; bar.className = 'fv-bar'; exit.className = 'btn'; exit.type = 'button'; exit.textContent = 'Exit full screen';
    bar.appendChild(exit); root.appendChild(canvas); root.appendChild(bar); document.body.appendChild(root);
    const nodes = build(canvas, Widgets.withoutControls(layout, lanes).layout, lanes, { maxH: 0 });
    let timer = null, closed = false;
    const show = () => { root.classList.add('show'); clearTimeout(timer); timer = setTimeout(() => root.classList.remove('show'), 2500); };
    const onKey = ev => { if (ev.key === 'Escape') close(); };
    function close() {
      if (closed) return; closed = true;
      clearTimeout(timer); document.removeEventListener('keydown', onKey); if (root.parentNode) root.parentNode.removeChild(root);
      if (o.onClose) o.onClose();
    }
    root.onpointermove = show; root.onpointerdown = show; exit.onclick = close;
    document.addEventListener('keydown', onKey); show();
    return { nodes, root, close };
  }
  return { build, paint, fullView };
})();
if (typeof module !== 'undefined') module.exports = LiveCanvas;
