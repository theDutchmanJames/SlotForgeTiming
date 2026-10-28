// One presentation/layout contract for live widgets, previews and embedded cells.
// Adapters own content layout, Frame owns appearance and safe text geometry.
(function (root) {
  const get = (name) => root[name];
  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  function kind(w) {
    return get("Widgets").layoutOfWidget(w);
  }
  function classes(w) {
    const W = get("Widgets"),
      d = W.def(w.type);
    return (
      (d?.button ? " btnw" : "") +
      W.alignClassOf(w) +
      W.clockClassOf(w) +
      (d?.layout === "chart" ? " chart-widget" : "") +
      (d?.layout === "aio" ? " aio-widget" : "")
    );
  }
  function style(w, l, { row = false } = {}) {
    const W = get("Widgets"),
      F = get("Frame"),
      d = W.def(w.type),
      U = W.U,
      H = W.heightOf(l),
      c = W.colorsOf(w, l);
    const stripe = row ? null : F.laneStripe(w, l, W.laneBackgroundOf(w, l), U);
    const radius = row ? "" : F.corner(w,l,U);
    return `left:${(w.x / U) * 100}%;top:${(w.y / H) * 100}%;width:${(w.w / U) * 100}%;height:${(w.h / H) * 100}%;font-size:${(w.textSize || d.textSize) / 10}cqw;color:${W.cssVal(c.color) || "var(--ink)"};${F.css(c.bg, w, "var(--line)", l, U)};--wf:${F.solidity(w, l)};${radius ? "border-radius:" + radius + ";" : ""}${stripe?.css || ""}`;
  }
  function html(
    w,
    l,
    content,
    { row = false, extraClass = "", attributes = "", decoration = "" } = {},
  ) {
    const W = get("Widgets"),
      F = get("Frame"),
      stripe = row ? null : F.laneStripe(w, l, W.laneBackgroundOf(w, l), W.U);
    return `<div class="lw${extraClass}${classes(w)}${stripe?.cls || ""}" ${attributes} style="${style(w, l, { row })}">${!row && W.showTitleOf(w) ? `<span class="lw-title" style="${W.titleStyleOf(w)}">${esc(W.titleOf(w))}</span>` : ""}<span class="lw-val" style="${W.valueStyleOf(w)}">${content}</span>${decoration}</div>`;
  }
  function mount(canvas, w, l, o = {}) {
    const W = get("Widgets"),
      F = get("Frame"),
      d = W.def(w.type),
      el = root.document.createElement("div"),
      val = root.document.createElement(d.button ? "button" : "span");
    el.className = "lw live" + classes(w);
    val.className = "lw-val";
    el.style.cssText = style(w, l);
    if (!d.button) val.style.cssText = W.valueStyleOf(w);
    let tit = null;
    if (W.showTitleOf(w)) {
      tit = root.document.createElement("span");
      tit.className = "lw-title";
      tit.textContent = W.titleOf(w);
      tit.style.cssText = W.titleStyleOf(w);
      el.appendChild(tit);
    }
    const stripe = F.laneStripe(w, l, W.laneBackgroundOf(w, l), W.U);
    if (stripe.cls) {
      el.className += stripe.cls;
      el.style.setProperty("--lane-stripe", stripe.color);
      el.style.setProperty("--lane-size", stripe.size);
    }
    if (d.button)
      val.onclick = (ev) => {
        ev?.currentTarget?.blur?.();
        o.onButton?.(w.type);
      };
    el.appendChild(val);
    canvas.appendChild(el);
    return { w, el, val, tit, layout: l, base: W.colorsOf(w, l), last: null };
  }
  const adapters = {
    text: (n) => get("Frame").fit(n.el, { ...n.w, layoutKind: "text" }),
    list: (n) => get("Frame").fit(n.el, { ...n.w, layoutKind: "list" }),
    stock: (n) => get("Frame").fit(n.el, { ...n.w, layoutKind: "stock" }),
    strategy: (n) => get("Frame").fit(n.el, { ...n.w, layoutKind: "strategy" }),
    pitcontrol: (n) => get("PitWidgets").fit(n),
    gauge: (n) => get("Frame").fit(n.el, { ...n.w, layoutKind: "gauge" }),
    aio: (n) => get("Frame").fit(n.el, { ...n.w, layoutKind: "aio" }),
    composition: (n) =>
      get("Frame").fit(n.el, { ...n.w, layoutKind: "composition" }),
    clock: (n) => get("Widgets").fitClock(n.el, n.w),
    rows: (n) => get("Rows")?.fitText(n.val),
    weather: (n) => {
      // The weather adapter adds an inner shrink factor. Remove the previous
      // factor before fitting the outer text after a resize (fresh DOM has none).
      const inner=n.val.firstElementChild;
      if(/(^|\s)(wxw|wxt)(\s|$)/.test(String(inner?.className||'')))inner.style.fontSize='';
      get("Frame").fit(n.el, {...n.w,layoutKind:"text"});return get("WxW")?.fit(n.val);
    },
    delta: (n, o) => {
      const D = get("Delta");
      if (D?.fitQuick) D.fitQuick(n.val, undefined, o?.note);
      else D?.fit(n.val);
    },
    // Media and SVG charts already size their own content with CSS/viewBox.
    media: () => {},
    chart: () => {},
    flow: (n) => get("Frame").fit(n.el, { ...n.w, layoutKind: "text" }),
  };
  // Embedded charts share the host's paint/fit lifecycle. Weak keys keep state
  // scoped to mounted DOM; removing a composition needs no timer cleanup.
  const componentCells=new WeakMap();
  function paintComponent(cell) {
    const {el,val,descriptor}=cell;
    if(!el.isConnected||!el.clientWidth||!el.clientHeight)return;
    const out=descriptor.render({width:el.clientWidth,height:el.clientHeight});
    if(cell.html!==out.html){val.innerHTML=out.html;cell.html=out.html;cell.chartTrackFrame=null;}
    if(out.chartTrack)get('ChartWidgets')?.updateTrack(cell,out,descriptor.state);
  }
  function updateComponents(n,out={}) {
    if(!out.components?.length)return;
    const descriptors=new Map(out.components.map(d=>[d.id,d]));
    n.val.querySelectorAll('[data-wc-component]').forEach(el=>{
      const descriptor=descriptors.get(el.dataset.wcComponent);if(!descriptor)return;
      const val=el.querySelector(':scope > .lw-val');if(!val)return;
      let cell=componentCells.get(el);
      if(!cell){cell={el,val};componentCells.set(el,cell);}
      cell.descriptor=descriptor;paintComponent(cell);
    });
  }
  function fit(n, out = {}, o = {}) {
    if (!n?.val?.style || !n.el?.classList) return;
    if (!o.cell) get("Frame").present(n.el, n.w, n.layout, out, o.refit);
    if(!o.cell)get("Frame").fitTitle?.(n.el,n.w);
    const result=adapters[kind(n.w)](n, o);
    updateComponents(n,out);
    return result;
  }
  // A row/component only needs fit options, not pictures or a second copy of a
  // composition. These attributes retain its identity through HTML generation.
  function attributes(w) {
    const opt = {};
    for (const key of ["style", "look", "gaugeScale", "pictureScale"])
      if (w.opt?.[key] !== undefined) opt[key] = w.opt[key];
    return `data-wv-type="${esc(w.type)}" data-wv-fit="${esc(JSON.stringify({ opt, composition: !!w.opt?.composition, typography: w.typography }))}"`;
  }
  function fitCell(el, parent = {}) {
    const val = el?.querySelector?.(":scope > .lw-val");
    if (!val || !el.clientWidth) return;
    let saved = {};
    try {
      saved = JSON.parse(el.dataset.wvFit || "{}");
    } catch {
      /* older markup */
    }
    val.style.fontSize = "";
    const size = parseFloat(root.getComputedStyle(val).fontSize) || 20;
    const w = {
      type: el.dataset.wvType || "rowcell",
      w: el.clientWidth,
      opt: saved.opt || {},
      typography: saved.typography ||
        parent.typography || {
          mode: "manual",
          valueSize: size,
          minSize: 11,
          shrink: true,
        },
    };
    if (saved.composition) w.opt.composition = true;
    fit({ el, val, w, layout: {} }, {}, { cell: true });
    const cell=componentCells.get(el);if(cell)paintComponent(cell);
  }
  const api = {
    kind,
    classes,
    style,
    html,
    mount,
    fit,
    fitCell,
    attributes,
    updateComponents,
    adapters,
  };
  root.WidgetView = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
