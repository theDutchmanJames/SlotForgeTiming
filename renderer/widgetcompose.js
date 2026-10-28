// Read-only widget compositions. No scripts, race commands, or nested custom widgets.
(function (root) {
  const esc = (v) =>
    String(v ?? "").replace(
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
  const num = (v, d, min, max) =>
    Number.isFinite(Number(v)) ? Math.max(min, Math.min(max, Number(v))) : d;
  const widgets = () =>
    typeof module !== "undefined" ? require("./widgets.js") : root.Widgets;
  const Free = typeof module !== "undefined" ? require("./widgetfree.js") : root.WidgetFree;
  const KINDS = [
    ["free", "Free Canvas / Group"],
    ["value", "Value"],
    ["text", "Label / combined text"],
    ["icon", "Icon / status badge"],
    ["image", "Picture"],
    ["bar", "Progress bar"],
    ["ring", "Progress ring"],
    ["gauge", "Gauge"],
    ["component", "Standard widget"],
    ["row", "Row"],
    ["column", "Column"],
    ["grid", "Grid"],
    ["divider", "Divider"],
    ["spacer", "Spacer"],
  ];
  const ICONS = {
    flag: "⚑",
    trophy: "🏆",
    fuel: "⛽",
    tyre: "◉",
    clock: "◷",
    pit: "⚒",
    warning: "⚠",
    check: "✓",
    up: "▲",
    down: "▼",
    car: "🏎",
    rain: "☂",
    sun: "☀",
    none: "",
  };
  const GROUPS = {
    "Driver & car": "#69bcd2",
    "Position & timing": "#82aaf6",
    "Race progress": "#b4bdc9",
    Fuel: "#50be7b",
    Tyres: "#b896ec",
    "Push & Save": "#d46c9c",
    "Pits & penalties": "#e1b65d",
    Weather: "#77b5df",
    "Other systems": "#de966f",
  };
  const EXTRA = [
    ["tyrelife", "Tyre life remaining", "Tyres", "number", "%", 68],
    [
      "tyrelaps",
      "Estimated tyre laps remaining",
      "Tyres",
      "number",
      "laps",
      23,
    ],
    ["pace", "Push & Save state", "Push & Save", "text", "", "Normal"],
    ["pacedelta", "Pace difference", "Push & Save", "number", "%", 0.4],
    [
      "fuelmult",
      "Fuel consumption multiplier",
      "Push & Save",
      "number",
      "×",
      1.22,
    ],
    ["tyremult", "Tyre wear multiplier", "Push & Save", "number", "×", 1.35],
    [
      "service",
      "Service stop status",
      "Pits & penalties",
      "text",
      "",
      "Not in pits",
    ],
    [
      "serviceprogress",
      "Service stop progress",
      "Pits & penalties",
      "number",
      "%",
      40,
    ],
    ["inpit", "In pits", "Pits & penalties", "boolean", "", false],
    ["driverstatus", "Driver status", "Driver & car", "text", "", "On track"],
    [
      "gaplaps",
      "Gap to leader (estimated laps)",
      "Position & timing",
      "text",
      "",
      "+0.2 laps",
    ],
    [
      "total",
      "Total time including penalties",
      "Position & timing",
      "number",
      "s",
      182.315,
    ],
  ];
  const NUMERIC = {
    lane: "",
    position: "",
    lap: "",
    laps: "",
    laptime: "s",
    last: "s",
    best: "s",
    avg: "s",
    median: "s",
    record: "s",
    fuel: "L",
    fuelpct: "%",
    penpoints: "",
    pentime: "s",
    pits: "",
    pit: "s",
    clock: "s",
    timeleft: "s",
    lapsleft: "",
    lapstotal: "",
    champ: "",
    speed: "km/h",
    speedreal: "km/h",
    damage: "",
    repairs: "",
    failures: "",
    lapstogo: "laps",
    sessionrecord: "s",
    trackrecord: "s",
    yellowtarget: "s",
  };
  const group = (k) =>
    /^(name|nickname|callsign|team|car|lane)$/.test(k)
      ? "Driver & car"
      : /^(fuel)/.test(k)
        ? "Fuel"
        : /^(tyre)/.test(k)
          ? "Tyres"
          : /^(pen|pit)/.test(k)
            ? "Pits & penalties"
            : /weather|temp|wind/.test(k)
              ? "Weather"
              : /^(clock|timeleft|lapsleft|lapstotal|racedistance|leader|flag|heat|track|session|type)$/.test(
                    k,
                  )
                ? "Race progress"
                : /^(damage|repair|failure|nextdriver|swap|stint|bop)/.test(k)
                  ? "Other systems"
                  : "Position & timing";
  function catalog(scope = "lane") {
    const W = widgets(),
      rows = [
        ...(scope === "lane" ? W.TEXT_LANE_VARS : []),
        ...W.TEXT_RACE_VARS,
      ];
    return [
      ...rows.map(([key, label]) => ({
        key,
        label,
        group: group(key),
        type: Object.hasOwn(NUMERIC, key) ? "number" : "text",
        unit: NUMERIC[key] || "",
      })),
      ...(scope === "lane"
        ? EXTRA.map(([key, label, group, type, unit, sample]) => ({
            key,
            label,
            group,
            type,
            unit,
            sample,
          }))
        : []),
    ];
  }
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const object = (v) =>
    v !== null && typeof v === "object" && !Array.isArray(v);
  const array = (v) => (Array.isArray(v) ? v : []);
  function clean(raw = {}) {
    raw = object(raw) ? raw : {};
    let count = 0;
    const ids = new Set();
    function walk(n, depth) {
      if (!object(n) || depth > 6 || count >= 80) return null;
      count++;
      let id = String(n.id || "b" + count)
        .replace(/[^\w-]/g, "")
        .slice(0, 48);
      while (ids.has(id)) id += "x";
      ids.add(id);
      const kind = KINDS.some((x) => x[0] === n.kind) ? n.kind : "value";
      return {
        id,
        kind,
        frame: Free.rect(n.frame),
        locked: n.locked === true,
        label: String(n.label || "").slice(0, 120),
        key: String(n.key || "name").slice(0, 60),
        text: String(n.text ?? "").slice(0, 1000),
        role: ["value", "support", "label"].includes(n.role) ? n.role : "value",
        align: ["left", "center", "right"].includes(n.align)
          ? n.align
          : "center",
        size: n.size ? num(n.size, 24, 11, 150) : 0,
        grow: num(n.grow, 1, 0.1, 10),
        height: n.height ? num(n.height, 90, 20, 600) : 0,
        gap: num(n.gap, 10, 0, 60),
        columns: num(n.columns, 2, 1, 6) | 0,
        wrap: n.wrap !== false,
        min: num(n.min, 0, -1000000, 1000000),
        max: num(n.max, 100, -1000000, 1000000),
        decimals:
          n.decimals === "" || n.decimals == null
            ? null
            : num(n.decimals, 1, 0, 3) | 0,
        unit: n.unit !== false,
        icon: Object.hasOwn(ICONS, n.icon) ? n.icon : "flag",
        image: /^data:image\/(png|jpeg|webp|gif);base64,/i.test(n.image || "")
          ? n.image
          : "",
        fit: n.fit === "cover" ? "cover" : "contain",
        component: String(n.component || "bestlap"),
        options: object(n.options) ? clone(n.options) : {},
        rules: Array.isArray(n.rules)
          ? n.rules
              .filter(object)
              .slice(0, 12)
              .map((r) => ({
                match: r.match === "any" ? "any" : "all",
                conditions: array(r.conditions)
                  .filter(object)
                  .slice(0, 8)
                  .map((c) => ({
                    key: String(c.key || ""),
                    op: [
                      "eq",
                      "ne",
                      "lt",
                      "gt",
                      "le",
                      "ge",
                      "missing",
                      "present",
                    ].includes(c.op)
                      ? c.op
                      : "eq",
                    value: String(c.value ?? "").slice(0, 120),
                  })),
                action: ["hide", "text", "icon", "tone"].includes(r.action)
                  ? r.action
                  : "text",
                text: String(r.text || "").slice(0, 200),
                icon: Object.hasOwn(ICONS, r.icon) ? r.icon : "warning",
                tone: ["normal", "good", "warning", "danger"].includes(r.tone)
                  ? r.tone
                  : "warning",
              }))
          : [],
        children: ["row", "column", "grid", "free"].includes(kind)
          ? array(n.children)
              .map((x) => walk(x, depth + 1))
              .filter(Boolean)
          : [],
      };
    }
    return {
      version: 1,
      root: walk(
        object(raw.root)
          ? raw.root
          : {
              kind: "column",
              children: [{ kind: "value", key: "name", label: "Driver" }],
            },
        0,
      ),
    };
  }
  function components(scope) {
    return widgets().REGISTRY.filter(
      (d) =>
        !d.button &&
        !d.hidden &&
        !["leaderboard", "lanecolor"].includes(d.type) &&
        (scope === "lane" || !d.perLane),
    );
  }
  const decode = (v) =>
    String(v ?? "")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
  function test(c, values) {
    const reading = values[c.key],
      a =
        typeof reading === "number" && !Number.isFinite(reading)
          ? null
          : reading;
    if (c.op === "missing") return a == null;
    if (c.op === "present") return a != null;
    if (a == null) return false;
    const b =
      typeof a === "number"
        ? Number(c.value)
        : typeof a === "boolean"
          ? c.value === "true"
          : c.value.toLowerCase();
    if (
      typeof a === "number" &&
      (!String(c.value).trim() || !Number.isFinite(b))
    )
      return false;
    const v = typeof a === "string" ? a.toLowerCase() : a;
    switch (c.op) {
      case "eq":
        return v === b;
      case "ne":
        return v !== b;
      case "lt":
        return typeof a === "number" && a < b;
      case "gt":
        return typeof a === "number" && a > b;
      case "le":
        return typeof a === "number" && a <= b;
      case "ge":
        return typeof a === "number" && a >= b;
      default:
        return false;
    }
  }
  function matched(n, values) {
    return n.rules.find(
      (r) =>
        r.conditions.length &&
        (r.match === "any"
          ? r.conditions.some((c) => test(c, values))
          : r.conditions.every((c) => test(c, values))),
    );
  }
  function format(key, v, n = {}, meta) {
    if (v == null || (typeof v === "number" && !Number.isFinite(v))) return "—";
    if (typeof v === "boolean") return v ? "Yes" : "No";
    if (typeof v !== "number") return String(v);
    const def = meta?.find((x) => x.key === key),
      unit = def?.unit || "",
      digits =
        n.decimals ??
        (unit === "s" ? 3 : unit === "×" ? 2 : unit === "L" ? 1 : 0);
    return (
      v.toFixed(digits) +
      (n.unit === false || !unit ? "" : unit === "%" ? "%" : " " + unit)
    );
  }
  function render(raw, values = {}, o = {}) {
    const doc = clean(raw),
      meta = catalog(o.scope),
      fmt = (k, n) => format(k, values[k], n, meta);
    function draw(n) {
      const rule = matched(n, values);
      if (rule?.action === "hide" && !o.edit) return "";
      const tone = rule?.action === "tone" ? rule.tone : "normal",
        label = n.label
          ? `<small class="wc-label">${esc(n.label)}</small>`
          : "";
      let body = "";
      if (["column", "row", "grid", "free"].includes(n.kind))
        body = n.children.map(draw).join("");
      else if (n.kind === "value")
        body =
          label +
          `<strong class="wc-text">${esc(rule?.action === "text" ? rule.text : fmt(n.key, n))}</strong>`;
      else if (n.kind === "text")
        body = `<span class="wc-text">${esc(rule?.action === "text" ? rule.text : n.text).replace(/\{(\w+)\}/g, (_, k) => esc(fmt(k, n)))}</span>`;
      else if (n.kind === "icon")
        body = `<span class="wc-icon" aria-label="${esc(n.label || n.icon)}">${ICONS[rule?.action === "icon" ? rule.icon : n.icon]}</span>${label}${(rule?.action === "text" ? rule.text : n.text) ? `<span class="wc-text">${esc(rule?.action === "text" ? rule.text : n.text)}</span>` : ""}`;
      else if (n.kind === "image")
        body = n.image
          ? `<img src="${esc(n.image)}" alt="${esc(n.label)}" style="object-fit:${n.fit}">`
          : '<span class="wc-label">Choose a picture</span>';
      else if (n.kind === "component") {
        const d = components(o.scope).find((d) => d.type === n.component);
        const out = d ? o.component?.(n) : null;
        if (out?.render && o.components) o.components.push({id:n.id, render:out.render, state:out.state});
        const html = typeof out === "string" ? out : out?.html || "";
        body = d
          ? `<div class="wc-standard${widgets().clockClassOf({ type: n.component, opt: n.options })}" data-wc-component="${esc(n.id)}" data-standard="${esc(n.component)}" ${root.WidgetView ? root.WidgetView.attributes({ type: n.component, opt: n.options }) : ""} data-clock-style="${esc(n.options.style || "classic")}" style="${out?.color ? `color:${widgets().cssVal(out.color)};` : ""}${out?.bg ? `background:${widgets().cssVal(out.bg)};` : ""}"><span class="lw-val">${html}</span></div>`
          : '<span class="wc-label">Component unavailable in this scope</span>';
      } else if (["bar", "ring", "gauge"].includes(n.kind)) {
        const v = values[n.key],
          p =
            typeof v === "number" && Number.isFinite(v) && n.max > n.min
              ? Math.max(
                  0,
                  Math.min(100, ((v - n.min) / (n.max - n.min)) * 100),
                )
              : null;
        body = label;
        if (p != null) {
          const aria = `role="meter" aria-label="${esc(n.label || n.key)}" aria-valuemin="${n.min}" aria-valuemax="${n.max}" aria-valuenow="${Math.max(n.min, Math.min(n.max, v))}"`;
          body +=
            n.kind === "bar"
              ? `<span class="wc-progress-track" ${aria}><i style="width:${p}%"></i></span>`
              : n.kind === "ring"
                ? `<svg viewBox="0 0 100 100" ${aria}><circle class="wc-track" cx="50" cy="50" r="40"/><circle class="wc-progress" cx="50" cy="50" r="40" pathLength="100" stroke-dasharray="${p} 100" transform="rotate(-90 50 50)"/></svg>`
                : `<svg viewBox="0 0 120 70" ${aria}><path class="wc-track" d="M10 60 A50 50 0 0 1 110 60"/><path class="wc-progress" d="M10 60 A50 50 0 0 1 110 60" pathLength="100" stroke-dasharray="${p} 100"/><path d="M60 60 L${60 - 43 * Math.cos((p / 100) * Math.PI)} ${60 - 43 * Math.sin((p / 100) * Math.PI)}" stroke="currentColor" stroke-width="3"/><circle cx="60" cy="60" r="4" fill="currentColor"/></svg>`;
        }
        body += `<strong class="wc-text">${esc(fmt(n.key, n))}</strong>`;
      }
      return `<div class="wc-block wc-${n.kind} wc-role-${n.role} wc-tone-${tone}${(o.selected === n.id || o.selection?.includes(n.id)) ? " wc-selected" : ""}${rule?.action === "hide" ? " wc-hidden-rule" : ""}" data-wc-id="${n.id}" style="--wc-x:${n.frame.x}%;--wc-y:${n.frame.y}%;--wc-w:${n.frame.w}%;--wc-h:${n.frame.h}%;--wc-gap:${n.gap}px;--wc-cols:${n.columns};flex-grow:${n.grow};text-align:${n.align};align-items:${n.align === "left" ? "flex-start" : n.align === "right" ? "flex-end" : "center"};${n.height ? `height:${n.height}px;flex-basis:${n.height}px;` : ""}${n.size ? `--wc-size:${n.size}px;` : ""}${n.kind === "row" && !n.wrap ? "flex-wrap:nowrap;" : ""}">${body}</div>`;
    }
    return `<div class="wc-root" data-wc-scope="${o.scope || "lane"}">${draw(doc.root)}</div>`;
  }
  function sampleValues(scope,scenario="racing",lane=0) {
    const P=typeof module!=='undefined'?require('./widgetpreview.js'):root.WidgetPreview;
    return P.values(scope,scenario,lane);
  }
  function sample(raw, lane = 0, o = {}) {
    const W = widgets(),
      scope = o.scope || "lane";
    return render(raw, o.values || sampleValues(scope, o.scenario, lane), {
      ...o,
      scope,
      component:
        o.component ||
        ((n) => {
          const w = { ...W.newWidget(n.component, lane, 0, 0), opt: n.options };
          return W.sampleOf(W.def(w.type), lane, {...w,previewScenario:o.scenario});
        }),
    });
  }
  function template(kind = "lane") {
    let id = 0;
    const b = (kind, p = {}) => ({ id: "b" + ++id, kind, ...p });
    const val = (key, label, role = "value") =>
      b("value", { key, label, role });
    let children;
    if (kind === "timing")
      children = [
        b("row", {
          children: [
            val("laptime", "Current lap"),
            val("gap", "Gap to leader"),
            val("best", "Best lap"),
          ],
        }),
      ];
    else if (kind === "strategy")
      children = [
        b("row", {
          children: [
            b("bar", { key: "fuelpct", label: "Fuel" }),
            b("ring", { key: "tyrelife", label: "Tyre life" }),
          ],
        }),
        b("component", { component: "pace", height: 150 }),
        val("service", "Service stop", "support"),
      ];
    else if (kind === "race")
      children = [
        val("session", "Race"),
        b("row", {
          children: [val("clock", "Elapsed"), val("timeleft", "Remaining")],
        }),
        val("flag", "Flag", "support"),
      ];
    else if (kind === "blank")
      children = [b("text", { text: "Your widget", role: "support" })];
    else
      children = [
        b("row", {
          children: [
            b("component", { component: "avatar", height: 64, grow: 0.3 }),
            b("column", {
              children: [val("name", ""), val("car", "", "support")],
              align: "left",
            }),
          ],
        }),
        b("row", {
          children: [
            val("position", "Position"),
            val("laps", "Laps"),
            val("best", "Best lap"),
          ],
        }),
      ];
    return clean({ root: b("column", { children }) });
  }
  function freeTemplate(kind="lane") {
    const value=(id,key,label,frame,role="value")=>({id,kind:"value",key,label,frame,role,unit:false});
    const full={x:0,y:0,w:100,h:100};
    const children=kind==="blank"?[]:kind==="timing"?[
      value("current","laptime","CURRENT",{x:0,y:10,w:32,h:80}),value("best","best","BEST LAP",{x:34,y:10,w:32,h:80}),value("last","last","LAST LAP",{x:68,y:10,w:32,h:80})
    ]:kind==="race"?[
      value("clock","clock","RACE CLOCK",{x:5,y:5,w:60,h:55}),value("leader","leader","LEADER",{x:5,y:65,w:90,h:30}),value("left","timeleft","TIME LEFT",{x:70,y:5,w:25,h:55})
    ]:kind==="strategy"?[
      value("name","name","",{x:5,y:2,w:90,h:20}),value("fuel","fuelpct","FUEL %",{x:3,y:28,w:29,h:65}),value("tyres","tyrelife","TYRES %",{x:35,y:28,w:29,h:65}),value("pace","pace","PUSH & SAVE",{x:67,y:28,w:30,h:65})
    ]:[
      value("name","name","",{x:5,y:4,w:65,h:26}),value("position","position","POSITION",{x:75,y:4,w:20,h:40}),value("car","car","",{x:5,y:32,w:65,h:16},"support"),value("laps","laps","LAPS",{x:5,y:55,w:35,h:40}),value("best","best","BEST LAP",{x:45,y:55,w:50,h:40})
    ];
    return clean({root:{id:"canvas",kind:"free",frame:full,children}});
  }
  function find(doc, id) {
    let hit;
    function walk(n, parent) {
      if (n.id === id) hit = { node: n, parent };
      n.children?.forEach((x) => walk(x, n));
    }
    walk(doc.root, null);
    return hit;
  }
  function fit(el, w = {}) {
    const r = el?.querySelector?.(".wc-root");
    if (!r || !root.getComputedStyle) return;
    const frame = el.closest?.(".lw") || el;
    r.querySelectorAll(".wc-standard").forEach((x) => {
      const v = x.querySelector(".lw-val");
      if (v) v.style.position = "absolute";
      root.WidgetView?.fitCell(x, w);
    }); // Fit ordinary Builder values in their allocated blocks before measuring the tree.
    const F = root.Frame,
      t = F?.typography(w);
    let fits = true;
    if (F && t) {
      const entries = [...r.querySelectorAll(".wc-text,.wc-label,.wc-free .wc-icon:not(.wc-block)")].map(n => {
        n.style.removeProperty("font-size");
        const block = n.parentElement;
        const support = n.matches(".wc-label") || block.matches(".wc-role-support,.wc-role-label");
        const min = support ? 11 : n.matches(".wc-icon") ? 16 : t.minSize;
        const base = parseFloat(root.getComputedStyle(n).fontSize) || min;
        const explicit = block.style.getPropertyValue("--wc-size");
        const max = t.mode === "auto" && !support && !explicit
          ? Math.min(256, Math.max(block.clientWidth, block.clientHeight)) : base;
        return {n, block, min, max, free: !!n.closest(".wc-free")};
      });
      // Reserve every label's minimum first. A value must fit together with its
      // label, rather than pushing that label outside the selected element.
      for (const e of entries) if (e.free) e.n.style.fontSize = e.min + "px";
      for (const {n, block, min, max, free} of entries) {
        const shrink = t.mode === "auto" || t.shrink;
        if (free) {
          if (shrink) F.fitSize(min, max, size => {n.style.fontSize = size + "px";}, () => F.textFits(block, block) && block.scrollWidth <= block.clientWidth + 1 && block.scrollHeight <= block.clientHeight + 1);
          else n.style.fontSize = max + "px";
        } else fits = F.fitText(n, {min, max, box: block, shrink}) && fits;
      }
      for (const {block, free} of entries) if (free) fits = F.textFits(block, block) && fits;
    }
    const tooSmall =
      !fits ||
      r.scrollHeight > r.clientHeight + 3 ||
      r.scrollWidth > r.clientWidth + 3;
    frame.classList.toggle("wc-crowded", tooSmall);
  }
  const api = {
    KINDS,
    ICONS,
    GROUPS,
    NUMERIC,
    EXTRA,
    esc,
    clean,
    catalog,
    components,
    test,
    matched,
    format,
    render,
    sample,
    sampleValues,
    template,
    freeTemplate,
    find,
    decode,
    fit,
  };
  root.WidgetCompose = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
