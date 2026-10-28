// The composer edits content only. The Layout Editor still owns placed appearance.
const WidgetStudio = (() => {
  const C = WidgetCompose,
    E = C.esc,
    copy = (v) => JSON.parse(JSON.stringify(v));
  const containers = ["row", "column", "grid", "free"];
  const choice = (attr, list, value) =>
    `<select ${attr}>${list.map(([v, t]) => `<option value="${E(v)}"${String(v) === String(value) ? " selected" : ""}>${E(t)}</option>`).join("")}</select>`;
  const control = (label, body, hint = "") =>
    `<label class="ws-control"><span>${label}</span>${body}${hint ? `<small>${hint}</small>` : ""}</label>`;
  const folder = (name, body, tone, open = true) =>
    `<details class="wc-folder" style="--wc-tint:${tone}"${open ? " open" : ""}><summary>${name}</summary><div>${body}</div></details>`;
  // Preview races are isolated in memory and never sent to hardware or saved.
  function previewShared(ed, ui) {
    return WidgetPreview.state({}, {scenario:ui.scenario,
      offset:ui.play?(Date.now()-ui.started)%6000:0,
      chartDesigns:ed.charts||[],imageSets:ed.images||[],teams:ed.teams||[],clubLogo:state.settings?.clubLogo||''});
  }

  function previewComponent(node, ed, ui, d) {
    if (ui.scenario === "missing")
      return { html: '<span class="wc-label">No data</span>' };
    const s = previewShared(ed, ui),
      w = {
        ...Widgets.newWidget(node.component, ui.lane, 0, 0),
        opt: node.options,
      };
    return node.component==='racechart'
      ? {html:'',state:s,render:size=>Timing.content({...w,chartSize:size},s)}
      : Timing.content(w, s);
  }
  const depthOf = (node, id, level = 0) =>
    node.id === id
      ? level
      : Math.max(-1, ...node.children.map((x) => depthOf(x, id, level + 1)));
  const heightOf = (node) => 1 + Math.max(0, ...node.children.map(heightOf));
  function edit(box) {
    wbEd?.composerUI?.freeDispose?.();
    if(wbEd?.composerUI)wbEd.composerUI.freeDispose=null;
    const openFolders = new Map(
      [...box.querySelectorAll(".wc-folder,.wc-variable-group")].map((x) => [
        x.querySelector("summary")?.textContent,
        x.open,
      ]),
    );
    const ed = wbEd,
      d = ed.draft;
    d.composition = C.clean(d.composition);
    if (!containers.includes(d.composition.root.kind)) {
      d.composition = C.clean({
        root: { id: "root", kind: "column", children: [d.composition.root] },
      });
    }
    const scope = d.type === "textrace" ? "race" : "lane";
    const ui =
      ed.composerUI ||
      (ed.composerUI = {
        selected: d.composition.root.id,
        scenario: "racing",
        lane: 0,
        previewWidth: d.w || 420,
        search: "",
        play: false,
      });
    const selected = C.find(d.composition, ui.selected) || {
      node: d.composition.root,
      parent: null,
    };
    ui.selected = selected.node.id;
    ui.multi=(ui.multi||[ui.selected]).filter(id=>C.find(d.composition,id));
    if(!ui.multi.includes(ui.selected))ui.multi=[ui.selected];
    const n = selected.node,
      meta = C.catalog(scope),
      components = C.components(scope);
    const opts = meta.map((v) => [
      v.key,
      v.label + (v.unit ? " (" + v.unit + ")" : ""),
    ]);
    const vselect = (key, attr = 'data-cw="key"') => choice(attr, opts, key);
    const field = (key, label, type = "text", hint = "") =>
      control(
        label,
        `<input data-cw="${key}" type="${type}" value="${E(n[key] ?? "")}"${type === "number" ? ' step="any"' : ""}>`,
        hint,
      );
    const toggle = (key, label) =>
      control(
        label,
        `<input data-cw="${key}" type="checkbox"${n[key] ? " checked" : ""}>`,
      );
    let content = "";
    if (["value", "bar", "ring", "gauge"].includes(n.kind))
      content =
        control("Value to display", vselect(n.key)) +
        field("label", "Label") +
        control(
          "Decimal places",
          choice(
            'data-cw="decimals"',
            [
              ["", "Automatic"],
              [0, "0"],
              [1, "1"],
              [2, "2"],
              [3, "3"],
            ],
            n.decimals ?? "",
          ),
        ) +
        toggle("unit", "Show unit");
    if (n.kind === "text")
      content = control(
        "Text",
        `<textarea data-cw="text" rows="3">${E(n.text)}</textarea>`,
        "Use Insert beside a value in the library to add it to your text.",
      );
    if (n.kind === "icon")
      content =
        control(
          "Default icon",
          choice(
            'data-cw="icon"',
            Object.keys(C.ICONS).map((k) => [k, C.ICONS[k] + " " + k]),
            n.icon,
          ),
        ) +
        field("label", "Accessible label") +
        field("text", "Supporting text");
    if (n.kind === "image")
      content =
        control(
          "Picture",
          `<input id="wc-image" type="file" accept="image/png,image/jpeg,image/webp,image/gif">`,
        ) +
        field("label", "Picture description") +
        control(
          "Fit",
          choice(
            'data-cw="fit"',
            [
              ["contain", "Show whole picture"],
              ["cover", "Fill and crop"],
            ],
            n.fit,
          ),
        ) +
        (n.image
          ? '<button class="btn" data-action="clear-image">Remove picture</button>'
          : "");
    if (n.kind === "component") {
      const def = components.find((x) => x.type === n.component);
      content = control(
        "Standard widget",
        choice(
          'data-cw="component"',
          components.map((x) => [x.type, x.group + " · " + x.label]),
          n.component,
        ),
      );
      content += (def?.options || [])
        .filter((o) => !o.show || o.show(n.options))
        .filter(
          (o) => !o.when || o.when.includes(Widgets.flagStyleOf(n.options)),
        )
        .map((o) => {
          const value =
            n.options[o.key] ??
            (o.defaultOf ? o.defaultOf(n.options) : o.default);
          if (o.type === "note") return `<p class="muted">${E(o.label)}</p>`;
          const attr = `data-component-option="${E(o.key)}"`;
          if (o.type === "checkbox")
            return control(
              E(o.label),
              `<input type="checkbox" ${attr}${value ? " checked" : ""}>`,
            );
          if (o.type === "select")
            return control(E(o.label), choice(attr, o.choices || [], value));
          if (o.type === "imageset" || o.type === "team") {
            const rows =
              o.type === "team"
                ? ed.teams || []
                : (ed.images || []).filter((r) => r.kind === o.kind);
            const empty =
              o.type === "team"
                ? "Team of this lane"
                : n.component === "avatar"
                  ? "Standard avatars"
                  : "Standard appearance";
            const choices = [
              ["", empty],
              ...(n.component === "avatar"
                ? [["none", "No avatar (initial only)"]]
                : []),
              ...rows.map((r) => [r.id, r.name]),
            ];
            if (value && !choices.some((x) => x[0] === value))
              choices.push([value, "Missing selection — choose another"]);
            return control(E(o.label), choice(attr, choices, value));
          }
          if (o.type === "range")
            return control(
              E(o.label) + ` · ${E(value)}${E(o.unit || "")}`,
              `<input ${attr} type="range" min="${o.min ?? 0}" max="${o.max ?? 100}" step="${o.step ?? 1}" value="${E(value)}">`,
              E(o.hint || ""),
            );
          if (o.type === "image")
            return control(
              E(o.label),
              `<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-component-image="${E(o.key)}">${value ? `<button class="btn" data-clear-component-image="${E(o.key)}">Remove picture</button>` : ""}`,
            );
          if (o.type === "frame") {
            const f = Widgets.frameOf(value);
            return ["zoom", "x", "y"]
              .map((k) =>
                control(
                  k === "zoom"
                    ? "Picture zoom"
                    : k === "x"
                      ? "Picture horizontal position"
                      : "Picture vertical position",
                  `<input type="range" data-component-frame="${E(o.key)}" data-frame-part="${k}" min="${k === "zoom" ? 1 : -1}" max="${k === "zoom" ? 4 : 1}" step="0.05" value="${f[k]}">`,
                ),
              )
              .join("");
          }
          if (["chartdesign", "rowdesign"].includes(o.type)) {
            const rows = ed[o.type === "chartdesign" ? "charts" : "rows"] || [];
            return control(
              E(o.label),
              choice(
                attr,
                [
                  ["", "Choose a saved design"],
                  ...(value && !rows.some((r) => r.id === value)
                    ? [[value, "Missing design — choose another"]]
                    : []),
                  ...rows.map((r) => [r.id, r.name]),
                ],
                value,
              ),
            );
          }
          if (["number", "text", "color"].includes(o.type))
            return control(
              E(o.label),
              `<input ${attr} type="${o.type}" value="${E(value ?? "")}"${o.type === "number" ? ` min="${o.min ?? 0}" ${o.max != null ? `max="${o.max}"` : ""} step="${o.step ?? "any"}"` : ""}>`,
            );
          return `<p class="muted">${E(o.label)} uses the standard widget default.</p>`;
        })
        .join("");
    }
    if (["bar", "ring", "gauge"].includes(n.kind))
      content +=
        field("min", "Minimum", "number") + field("max", "Maximum", "number");
    if (n.kind === "free") content=field("label","Canvas / group name");
    else if (containers.includes(n.kind))
      content =
        field("gap", "Space between blocks (px)", "number") +
        (n.kind === "grid" ? field("columns", "Columns", "number") : "") +
        (n.kind === "row"
          ? toggle("wrap", "Wrap into another row when needed")
          : "");
    const text =
      control(
        "Text role",
        choice(
          'data-cw="role"',
          [
            ["value", "Main value"],
            ["support", "Supporting value"],
            ["label", "Label"],
          ],
          n.role,
        ),
      ) +
      control(
        "Alignment",
        choice(
          'data-cw="align"',
          [
            ["left", "Left"],
            ["center", "Centre"],
            ["right", "Right"],
          ],
          n.align,
        ),
      ) +
      field(
        "size",
        "Text size override (px)",
        "number",
        "0 inherits the shared widget typography.",
      );
    const structure = [];
    function tree(x, depth = 0) {
      structure.push(
        `<button class="wc-tree${ui.multi.includes(x.id) ? " active" : ""}" draggable="true" data-select="${x.id}" style="padding-left:${12 + depth * 14}px">${x.locked?"🔒 ":""}${E((C.KINDS.find((k) => k[0] === x.kind) || [])[1])} <small>${E(x.label || x.text || meta.find((v) => v.key === x.key)?.label || "")}</small></button>`,
      );
      x.children.forEach((y) => tree(y, depth + 1));
    }
    tree(d.composition.root);
    const ruleHTML = n.rules
      .map(
        (r, i) =>
          `<div class="wc-rule"><div class="row"><strong>Rule ${i + 1}</strong><button class="btn" data-rule-up="${i}"${i === 0 ? " disabled" : ""}>Move up</button><button class="btn" data-rule-del="${i}">Remove</button></div>${control(
            "Match",
            choice(
              `data-rule="${i}" data-rkey="match"`,
              [
                ["all", "All conditions"],
                ["any", "Any condition"],
              ],
              r.match,
            ),
          )}${r.conditions
            .map(
              (c, j) =>
                `<div class="wc-condition">${vselect(c.key, `data-condition="${i}:${j}" data-ckey="key"`)}${choice(
                  `data-condition="${i}:${j}" data-ckey="op"`,
                  [
                    ["eq", "Is"],
                    ["ne", "Is not"],
                    ["lt", "Less than"],
                    ["gt", "Greater than"],
                    ["le", "At most"],
                    ["ge", "At least"],
                    ["missing", "Unavailable"],
                    ["present", "Available"],
                  ],
                  c.op,
                )}${!["missing", "present"].includes(c.op) ? `<input aria-label="Compare with" data-condition="${i}:${j}" data-ckey="value" value="${E(c.value)}" placeholder="Value; true/false for In pits">` : ""}<button class="btn" data-cond-del="${i}:${j}">Remove condition</button></div>`,
            )
            .join(
              "",
            )}<button class="btn" data-cond-add="${i}">Add condition</button>${control("Then", choice(`data-rule="${i}" data-rkey="action"`, [["hide", "Hide block"], ...(["value", "text", "icon"].includes(n.kind) ? [["text", "Replace text"]] : []), ...(n.kind === "icon" ? [["icon", "Change icon"]] : []), ["tone", "Change emphasis"]], r.action))}${
            r.action === "text"
              ? control(
                  "Replacement text",
                  `<input data-rule="${i}" data-rkey="text" value="${E(r.text)}">`,
                )
              : r.action === "icon"
                ? choice(
                    `data-rule="${i}" data-rkey="icon"`,
                    Object.keys(C.ICONS).map((k) => [k, C.ICONS[k] + " " + k]),
                    r.icon,
                  )
                : r.action === "tone"
                  ? choice(
                      `data-rule="${i}" data-rkey="tone"`,
                      [
                        ["normal", "Normal"],
                        ["good", "Good"],
                        ["warning", "Warning"],
                        ["danger", "Urgent"],
                      ],
                      r.tone,
                    )
                  : ""
          }</div>`,
      )
      .join("");
    const freeSelection=WidgetFree.selected(d.composition,ui,C),freeChild=selected.parent?.kind==="free";
    const positionControls=freeChild?`<div class="wc-position-grid">${["x","y","w","h"].map(k=>control(({x:"Left",y:"Top",w:"Width",h:"Height"})[k]+" (%)",`<input type="number" data-free-frame="${k}" min="${k==='w'||k==='h'?1:0}" max="100" step="0.1" value="${n.frame[k]}"${n.locked?' disabled':''}>`)).join("")}</div><p class="muted">Positions scale with the parent canvas. Resize the box to control how much space its text can use.</p><div class="wc-align-tools">${["left","center","right","top","middle","bottom"].map(a=>`<button class="btn" data-free-align="${a}"${n.locked?' disabled':''}>${a[0].toUpperCase()+a.slice(1)}</button>`).join("")}</div><div class="wc-align-tools"><button class="btn" data-free-action="back"${n.locked?' disabled':''}>Send to back</button><button class="btn" data-free-action="front"${n.locked?' disabled':''}>Bring to front</button><button class="btn" data-free-action="lock">${n.locked?'Unlock':'Lock'} position</button></div>`:n.kind==="free"?'<p class="muted">Drag blocks on this canvas. Shift-click blocks to select several, then Group them to move and resize them together.</p>':field("grow","Share of available space","number")+field("height","Preferred height (px)","number");
    box.innerHTML = `<div class="wc-editor"><div class="wc-header"><div><small>MAKE IT YOUR OWN</small><h2>Widget Builder</h2><p class="muted">Build the contents here. Style each placed widget with the normal Layout Editor options.</p></div><div class="row">${undoButtons("wc")}<button class="btn primary" id="wc-save">Save widget</button><button class="btn" id="wc-back">Back</button></div></div><div class="wc-basics">${control("Name", `<input id="wc-name" maxlength="60" value="${E(d.name)}">`)}${control(
      "Shows",
      choice(
        'id="wc-scope"',
        [
          ["textlane", "One driver / lane"],
          ["textrace", "The whole race"],
        ],
        d.type,
      ),
    )}${control("Starting point", choice('id="wc-template"', [["", "Choose a template…"], ["lane", "Driver Card"], ["timing", "Timing Bar"], ["strategy", "Pit & Strategy"], ["race", "Race Overview"], ["blank", "Blank"], ...components.map((x) => ["standard:" + x.type, "Standard · " + x.label])], ""))}</div><p class="wc-status" id="wc-status" role="status"></p>
    <div class="wc-workspace"><aside class="wc-library">${folder("Add a block", `<div class="wc-add">${C.KINDS.map(([k, t]) => `<button class="btn" data-add-block="${k}">${t}</button>`).join("")}</div>`, "#82aaf6")}${folder("Widget structure", structure.join(""), "#b896ec")}${folder("Available values", `<input id="wc-search" placeholder="Find a value…" aria-label="Find a value" value="${E(ui.search)}"><div id="wc-values"></div>`, "#50be7b", false)}</aside>
    <section class="wc-stage"><div class="wc-preview-tools"><strong>Live preview</strong>${choice(
      'id="wc-scenario"',
      [
        ["racing", "Racing"],
        ["pit", "In pits"],
        ["warning", "Low fuel / tyres"],
        ["red", "Red flag"],
        ["finished", "Finished"],
        ["missing", "Missing data"],
        ["long", "Long names"],
      ],
      ui.scenario,
    )}${choice(
      'id="wc-lane"',
      Array.from({ length: 8 }, (_, i) => [i, "Lane " + (i + 1)]),
      ui.lane,
    )}${choice(
      'id="wc-theme"',
      [
        ["", "App theme"],
        ["dark", "Dark"],
        ["light", "Light"],
        ["ocean", "Ocean"],
        ["midnight", "Midnight"],
      ],
      ui.theme || "",
    )}<button class="btn" id="wc-play">${ui.play ? "Pause" : "Play"} samples</button></div><div class="wc-preview-tools">${control("Preview width", `<input id="wc-width" type="number" min="160" max="1000" value="${d.w}">`)}${control("Height", `<input id="wc-height" type="number" min="60" max="1000" value="${d.h}">`)}<button class="btn" data-preview-size="240:280">Compact</button><button class="btn" data-preview-size="620:200">Wide</button><button class="btn" data-preview-size="360:420">Tall</button></div><div class="wc-canvas-tools"><strong>Free Canvas</strong><label><input id="wc-snap" type="checkbox"${ui.snap!==false?' checked':''}> Snap</label>${choice('id="wc-grid"',[[0,'Guides only'],[1,'1% grid'],[2,'2% grid'],[5,'5% grid']],ui.grid??2)}<button class="btn" data-free-action="group"${freeSelection.nodes.length<2?' disabled':''}>Group selection</button><button class="btn" data-free-action="ungroup"${!freeChild||n.kind!=='free'?' disabled':''}>Ungroup</button><span>${freeSelection.nodes.length} selected</span></div><div class="wc-preview-scroll"><div id="wc-preview" class="lw live"></div></div><p class="muted">Drag to move · handles to resize · Shift-click to select several · Alt disables snapping or selects inside a group · arrows nudge 1 px, Shift + arrows 10 px. Appearance is inherited from the placed widget.</p><p id="wc-rule-result" class="wc-feedback"></p><p id="wc-fit-warning" class="wc-feedback"></p><details class="wc-folder"><summary>Preview values · change a value to test rules</summary><div class="wc-demo-values">${meta
      .filter((v) =>
        [
          "name",
          "car",
          "position",
          "fuelpct",
          "tyrelife",
          "pace",
          "service",
          "inpit",
          "flag",
          "laptime",
        ].includes(v.key),
      )
      .map((v) =>
        control(
          E(v.label),
          `<input data-demo="${v.key}" placeholder="${E(C.sampleValues(scope, ui.scenario, ui.lane)[v.key])}" value="${E(ui.overrides?.[v.key] ?? "")}">`,
        ),
      )
      .join("")}</div></details></section>
    <aside class="wc-inspector"><h3>${E(C.KINDS.find((x) => x[0] === n.kind)?.[1])} settings</h3><div class="row"><button class="btn" data-action="up"${!selected.parent ? " disabled" : ""}>${freeChild?"Backward":"Move up"}</button><button class="btn" data-action="down"${!selected.parent ? " disabled" : ""}>${freeChild?"Forward":"Move down"}</button><button class="btn" data-action="duplicate"${!selected.parent ? " disabled" : ""}>Duplicate</button><button class="btn danger" data-action="delete"${!selected.parent ? " disabled" : ""}>Delete</button></div>${content ? folder("Content", content, "#82aaf6") : ""}${!containers.includes(n.kind) ? folder("Text & alignment", text, "#b896ec") : ""}${folder("Position & size",positionControls,"#de966f",true)}${folder("States & rules", `<p class="muted">First matching rule wins. Otherwise the normal content appears. Hidden blocks remain outlined while editing.</p>${ruleHTML}<button class="btn" id="wc-add-rule">Add rule</button>`, "#e1b65d", false)}</aside></div></div>`;
    box.querySelectorAll(".wc-folder").forEach((x) => {
      const key = x.querySelector("summary")?.textContent;
      if (openFolders.has(key)) x.open = openFolders.get(key);
    });
    const $ = (id) => document.getElementById(id),
      U = draftUndo(ed, "wc", () => edit(box));
    const message = (s) => {
      $("wc-status").textContent = s;
    };
    const changed = (redraw = false, typing = false) => {
      ed.dirty = true;
      (typing ? U.mark : U.step)();
      if (redraw) edit(box);
      else preview();
    };
    function values() {
      const shared = previewShared(ed, ui),
        m = Timing.composeValues(
          shared,
          scope === "lane" ? shared.carByLane(ui.lane) : null,
          shared.now,
        );
      if (ui.scenario === "missing") meta.forEach((v) => (m[v.key] = null));
      for (const [k, v] of Object.entries(ui.overrides || {})) {
        const f = meta.find((x) => x.key === k);
        m[k] =
          v === ""
            ? m[k]
            : f?.type === "number"
              ? Number.isFinite(Number(v))
                ? Number(v)
                : null
              : f?.type === "boolean"
                ? v === "true"
                : v;
      }
      return m;
    }
    function preview() {
      const target = $("wc-preview");
      if (!target || ui.dragging) return;
      ui.freeDispose?.();ui.freeDispose=null;
      const w = wbToWidget(d, ui.lane),
        layout = { laneColors: Widgets.LANES, radius: 14 };
      w.appearance = {
        source: "theme",
        accent: "lane",
        edge: "left",
        radiusPixels: 14,
        spacing: "comfortable",
      };
      w.typography = { mode: "auto", textSource: "theme" };
      target.className = "lw live wc-preview-widget";
      if (ui.theme) target.dataset.theme = ui.theme;
      else delete target.dataset.theme;
      Object.assign(target.style, {
        position: "relative",
        left: "auto",
        top: "auto",
        width: d.w + "px",
        height: d.h + "px",
        fontSize: "32px",
      });
      const components=[];
      target.innerHTML = `<span class="lw-val">${C.sample(d.composition, ui.lane, { scope, components, values: values(), selected: ui.selected, selection: ui.multi, edit: true, component: (node) => previewComponent(node, ed, ui, d) })}</span>`;
      WidgetView.fit({
        el: target,
        val: target.querySelector(".lw-val"),
        w,
        layout,
      },{components});
      const redrawCanvas=()=>{const focused=document.activeElement===target;edit(box);if(focused)$("wc-preview")?.focus({preventScroll:true});};
      ui.freeDispose=WidgetFree.attach(target,d.composition,ui,C,()=>{ed.dirty=true;U.step();redrawCanvas();},redrawCanvas,()=>C.fit(target,w));
      const hit = C.matched(n, values());
      $("wc-rule-result").textContent = hit
        ? "Preview: rule " +
          (n.rules.indexOf(hit) + 1) +
          " matches → " +
          {
            hide: "hidden during racing",
            text: "replacement text",
            icon: "different icon",
            tone: "changed emphasis",
          }[hit.action]
        : "Preview: normal content (no rule matches).";
      requestAnimationFrame(() => {
        if ($("wc-fit-warning"))
          $("wc-fit-warning").textContent =
            target.classList.contains("wc-crowded") || target.scrollWidth > target.clientWidth + 2 ||
            target.querySelector(".wc-root")?.scrollHeight >
              target.clientHeight - 12
              ? "A box is too small for its content. Enlarge the element, allow wrapping, or use fewer fields."
              : "";
      });
    }
    function library() {
      const search = ui.search.toLowerCase();
      $("wc-values").innerHTML = Object.entries(C.GROUPS)
        .map(([g, color]) => {
          const rows = meta.filter(
            (v) =>
              v.group === g &&
              (!search ||
                (v.key + " " + v.label).toLowerCase().includes(search)),
          );
          return rows.length
            ? `<details class="wc-variable-group" style="--wc-tint:${color}"${search ? " open" : ""}><summary>${g} <small>${rows.length}</small></summary>${rows.map((v) => `<button data-insert="${v.key}" title="${E(v.label)} · ${v.type}${v.unit ? " · " + v.unit : ""}"><strong>${E(v.label)}</strong><small>${E(C.format(v.key, values()[v.key], {}, meta))} · ${v.type}</small></button>`).join("")}</details>`
            : "";
        })
        .join("");
    }
    $("wc-search").oninput = (e) => {
      ui.search = e.target.value;
      library();
    };
    library();
    preview();
    $("wc-snap").onchange=e=>{ui.snap=e.target.checked;};
    $("wc-grid").onchange=e=>{ui.grid=Number(e.target.value);};
    $("wc-name").oninput = (e) => {
      d.name = e.target.value;
      changed(false, true);
    };
    $("wc-scope").onchange = (e) => {
      d.type = e.target.value;
      ui.overrides = {};
      changed(true);
    };
    $("wc-template").onchange = (e) => {
      if (!e.target.value) return;
      if (
        !confirm(
          "Replace the current contents with this template? You can Undo this change.",
        )
      )
        return;
      e.target.value === "race" && (d.type = "textrace");
      e.target.value !== "race" && (d.type = "textlane");
      d.composition = e.target.value.startsWith("standard:")
        ? C.clean({
            root: {
              kind: "free",
              children: [
                {
                  kind: "component",
                  component: e.target.value.slice(9),
                  frame: {x:0,y:0,w:100,h:100},
                  height: 160,
                },
              ],
            },
          })
        : C.freeTemplate(e.target.value);
      if (e.target.value.startsWith("standard:"))
        d.type = Widgets.def(e.target.value.slice(9)).perLane
          ? "textlane"
          : "textrace";
      ui.selected = d.composition.root.id;ui.multi=[ui.selected];
      changed(true);
    };
    $("wc-theme").onchange = (e) => {
      ui.theme = e.target.value;
      preview();
    };
    $("wc-scenario").onchange = (e) => {
      ui.scenario = e.target.value;
      ui.overrides = {};
      edit(box);
    };
    $("wc-lane").onchange = (e) => {
      ui.lane = Number(e.target.value);
      preview();
    };
    const dimensions = () => {
      d.w = Math.max(160, Math.min(1000, Number($("wc-width").value) || 420));
      d.h = Math.max(60, Math.min(1000, Number($("wc-height").value) || 240));
      changed();
    };
    $("wc-width").onchange = $("wc-height").onchange = dimensions;
    $("wc-play").onclick = () => {
      ui.play = !ui.play;
      ui.started = Date.now();
      $("wc-play").textContent = (ui.play ? "Pause" : "Play") + " samples";
      if (ui.play) tick();
    };
    function tick() {
      if (!ui.play || wbEd !== ed || !box.contains($("wc-preview"))) return;
      preview();
      ui.timer = setTimeout(tick, 180);
    }
    if (ui.timer) clearTimeout(ui.timer);
    if (ui.play) tick();
    box.ondragstart = (e) => {
      const node = e.target.closest("[data-select]");
      if (node) e.dataTransfer.setData("text/plain", node.dataset.select);
    };
    box.ondragover = (e) => {
      if (e.target.closest("[data-select]")) e.preventDefault();
    };
    box.ondrop = (e) => {
      const target = e.target.closest("[data-select]");
      if (!target) return;
      e.preventDefault();
      const moving = C.find(
          d.composition,
          e.dataTransfer.getData("text/plain"),
        ),
        dest = C.find(d.composition, target.dataset.select);
      if (
        !moving?.parent || moving.node.locked ||
        !dest ||
        C.find({ root: moving.node }, dest.node.id)
      )
        return;
      const parent = dest.parent || dest.node;
      if (depthOf(d.composition.root, parent.id) + heightOf(moving.node) > 6)
        return message("Use no more than six nested layout levels.");
      moving.parent.children = moving.parent.children.filter(
        (x) => x !== moving.node,
      );
      const index = dest.parent
        ? parent.children.indexOf(dest.node)
        : parent.children.length;
      parent.children.splice(index, 0, moving.node);
      ui.selected = moving.node.id;
      changed(true);
    };
    box.oninput = (e) => {
      const el = e.target;
      if (el.dataset.demo) {
        ui.overrides ||= {};
        ui.overrides[el.dataset.demo] = el.value;
        preview();
      }
      if (el.dataset.cw && ["text", "label"].includes(el.dataset.cw)) {
        n[el.dataset.cw] = el.value;
        changed(false, true);
      }
    };
    box.onchange = async (e) => {
      if(e.target.dataset.freeFrame){if(n.locked)return;const k=e.target.dataset.freeFrame,value=Number(e.target.value);if(!e.target.checkValidity()||!Number.isFinite(value)){e.target.reportValidity();return;}n.frame=WidgetFree.rect({...n.frame,[k]:value});changed(true);return;}
      const el = e.target,
        k = el.dataset.cw;
      if (k) {
        n[k] =
          el.type === "checkbox"
            ? el.checked
            : el.type === "number"
              ? Number(el.value) || 0
              : k === "decimals"
                ? el.value === ""
                  ? null
                  : Number(el.value)
                : el.value;
        if (k === "component") n.options = {};
        changed(["component", "key"].includes(k));
      }
      if (el.dataset.componentOption) {
        const option = Widgets.def(n.component).options.find(
          (o) => o.key === el.dataset.componentOption,
        );
        n.options[el.dataset.componentOption] =
          el.type === "checkbox"
            ? el.checked
            : ["number", "range"].includes(el.type)
              ? Math.max(
                  option.min ?? -Infinity,
                  Math.min(option.max ?? Infinity, Number(el.value)),
                )
              : el.value;
        changed(true);
      }
      if (el.dataset.componentFrame) {
        n.options[el.dataset.componentFrame] = Widgets.frameOf({
          ...Widgets.frameOf(n.options[el.dataset.componentFrame]),
          [el.dataset.framePart]: Number(el.value),
        });
        changed();
      }
      if (el.dataset.componentImage && el.files?.[0]) {
        try {
          n.options[el.dataset.componentImage] = await resizeImage(
            el.files[0],
            1024,
            true,
          );
          changed(true);
        } catch (err) {
          message("Could not read picture: " + err.message);
        }
      }
      if (el.dataset.rule !== undefined) {
        const r = n.rules[Number(el.dataset.rule)];
        r[el.dataset.rkey] = el.value;
        changed(["action"].includes(el.dataset.rkey));
      }
      if (el.dataset.condition) {
        const [i, j] = el.dataset.condition.split(":").map(Number);
        n.rules[i].conditions[j][el.dataset.ckey] = el.value;
        changed(el.dataset.ckey === "op");
      }
      if (el.id === "wc-image" && el.files?.[0]) {
        try {
          n.image = await resizeImage(el.files[0], 1024, true);
          changed(true);
        } catch (err) {
          message("Could not read picture: " + err.message);
        }
      }
    };
    box.onclick = (e) => {
      const select = e.target.closest("[data-select],[data-wc-id]");
      if (select) {
        const id=select.dataset.select||select.dataset.wcId,hit=C.find(d.composition,id);
        if((e.shiftKey||e.ctrlKey||e.metaKey)&&hit?.parent?.kind==='free'){
          const old=WidgetFree.selected(d.composition,ui,C),ids=old.parent===hit.parent?old.nodes.map(n=>n.id):[];
          ui.multi=ids.includes(id)?ids.filter(x=>x!==id):[...ids,id];ui.selected=ui.multi.at(-1)||hit.parent.id;
        }else{ui.selected=id;ui.multi=[id];}
        edit(box);
        return;
      }
      const b = e.target.closest("button");
      if (!b) return;
      if(b.dataset.freeAlign){const selection=WidgetFree.selected(d.composition,ui,C);WidgetFree.align(selection.nodes,b.dataset.freeAlign);changed(true);return;}
      if(b.dataset.freeAction){
        const action=b.dataset.freeAction,{nodes,parent}=WidgetFree.selected(d.composition,ui,C);
        if(!parent||!nodes.length)return;
        if(action==='group'){
          if(allNodes(d.composition.root).length>=80)return message('This widget has reached the 80-block limit.');
          if(nodes.some(n=>n.locked))return message('Unlock the selected blocks before grouping.');
          if(nodes.some(n=>depthOf(d.composition.root,n.id)+heightOf(n)>6))return message('Use no more than six nested layout levels.');
          const group=WidgetFree.group(parent,nodes.map(n=>n.id),'group'+Date.now());if(!group)return;ui.selected=group.id;ui.multi=[group.id];
        }else if(action==='ungroup'){const kids=WidgetFree.ungroup(parent,n);if(!kids)return message('Unlock the group and its children before ungrouping.');ui.multi=kids.map(n=>n.id);ui.selected=ui.multi.at(-1)||parent.id;
        }else if(action==='lock'){const lock=!nodes.every(n=>n.locked);nodes.forEach(n=>n.locked=lock);
        }else if(['front','back'].includes(action)){if(nodes.some(n=>n.locked))return;const rest=parent.children.filter(n=>!nodes.includes(n));parent.children=action==='front'?[...rest,...nodes]:[...nodes,...rest];}
        changed(true);return;
      }
      if (b.dataset.addBlock) {
        if (allNodes(d.composition.root).length >= 80)
          return message("This widget has reached the 80-block limit.");
        const parent = containers.includes(n.kind)
          ? n
          : selected.parent || d.composition.root;
        if (depthOf(d.composition.root, parent.id) >= 6)
          return message("Use no more than six nested layout levels.");
        const node = C.clean({
          root: {
            kind: b.dataset.addBlock,
            id: "b" + Date.now(),
            key: ["bar", "ring", "gauge"].includes(b.dataset.addBlock)
              ? scope === "lane"
                ? "fuelpct"
                : "lapsleft"
              : scope === "lane"
                ? "name"
                : "clock",
            text: "Your text",
            component: scope === "lane" ? "bestlap" : "clock",
            height: b.dataset.addBlock === "component" ? 120 : 0,
          },
        }).root;
        if(parent.kind==='free'){const offset=5+(parent.children.length%6)*4;node.frame={x:offset,y:offset,w:45,h:node.kind==='component'?45:25};}
        parent.children.push(node);
        ui.selected = node.id;ui.multi=[node.id];
        changed(true);
      }
      if (b.dataset.insert) {
        if(n.kind==='free'){
          if(allNodes(d.composition.root).length>=80||depthOf(d.composition.root,n.id)>=6)return message('This canvas has reached its block or nesting limit.');
          const node=C.clean({root:{id:'value'+Date.now(),kind:'value',key:b.dataset.insert,label:meta.find(x=>x.key===b.dataset.insert)?.label||'',frame:{x:5+(n.children.length%6)*4,y:5+(n.children.length%6)*4,w:45,h:25}}}).root;
          n.children.push(node);ui.selected=node.id;ui.multi=[node.id];changed(true);return;
        }
        if (!["text", "value", "bar", "ring", "gauge"].includes(n.kind))
          return message(
            "Select a value, text or meter block before inserting a value.",
          );
        if (n.kind === "text") {
          const input = box.querySelector('[data-cw="text"]'),
            a = input?.selectionStart ?? n.text.length,
            z = input?.selectionEnd ?? a;
          n.text =
            n.text.slice(0, a) + "{" + b.dataset.insert + "}" + n.text.slice(z);
        } else n.key = b.dataset.insert;
        changed(true);
      }
      if (b.dataset.previewSize) {
        [d.w, d.h] = b.dataset.previewSize.split(":").map(Number);
        changed(true);
      }
      if (b.dataset.clearComponentImage) {
        delete n.options[b.dataset.clearComponentImage];
        changed(true);
      }
      const action = b.dataset.action;
      if (action) {
        if(n.locked&&['delete','up','down'].includes(action))return message('Unlock this block before changing its position or deleting it.');
        const p = selected.parent,
          index = p?.children.indexOf(n);
        if (action === "clear-image") n.image = "";
        if (p) {
          if (action === "delete") {
            p.children.splice(index, 1);
            ui.selected = p.id;
          }
          if (action === "duplicate") {
            if (allNodes(d.composition.root).length + allNodes(n).length > 80)
              return message("This widget has reached the 80-block limit.");
            const dup = copy(n);
            allNodes(dup).forEach(
              (x, i) => (x.id = "d" + Date.now() + "_" + i),
            );
            if(p.kind==='free')dup.frame=WidgetFree.rect({...dup.frame,x:dup.frame.x+3,y:dup.frame.y+3});
            p.children.splice(index + 1, 0, dup);
            ui.selected = dup.id;
          }
          if (action === "up" && index > 0)
            [p.children[index - 1], p.children[index]] = [
              n,
              p.children[index - 1],
            ];
          if (action === "down" && index < p.children.length - 1)
            [p.children[index + 1], p.children[index]] = [
              n,
              p.children[index + 1],
            ];
        }
        changed(true);
      }
      if (b.id === "wc-add-rule") {
        if (n.rules.length >= 12)
          return message(
            "A block can have up to 12 rules. Edit or remove an existing rule first.",
          );
        n.rules.push({
          match: "all",
          conditions: [
            {
              key: scope === "lane" ? "fuelpct" : "flag",
              op: "eq",
              value: scope === "lane" ? "20" : "Red flag",
            },
          ],
          action: "hide",
          text: "",
          icon: "warning",
          tone: "warning",
        });
        changed(true);
      }
      if (b.dataset.ruleDel !== undefined) {
        n.rules.splice(Number(b.dataset.ruleDel), 1);
        changed(true);
      }
      if (b.dataset.ruleUp !== undefined) {
        const i = Number(b.dataset.ruleUp);
        if (i > 0) [n.rules[i - 1], n.rules[i]] = [n.rules[i], n.rules[i - 1]];
        changed(true);
      }
      if (b.dataset.condAdd !== undefined) {
        if (n.rules[Number(b.dataset.condAdd)].conditions.length >= 8)
          return message(
            "A rule can have up to eight conditions. Edit or remove an existing condition first.",
          );
        n.rules[Number(b.dataset.condAdd)].conditions.push({
          key: opts[0][0],
          op: "eq",
          value: "",
        });
        changed(true);
      }
      if (b.dataset.condDel) {
        const [i, j] = b.dataset.condDel.split(":").map(Number);
        n.rules[i].conditions.splice(j, 1);
        changed(true);
      }
    };
    $("wc-back").onclick = () => {
      if (ed.dirty && !confirm("Discard your unsaved changes to this widget?"))
        return;
      ui.play = false;
      ui.freeDispose?.();ui.freeDispose=null;
      clearTimeout(ui.timer);
      draftUndoEnd(ed);
      wbEd = null;
      renderWidgetBuilder(box);
    };
    $("wc-save").onclick = async () => {
      if (ed.saving) return;
      if (!String(d.name).trim()) return message("Give the widget a name.");
      const issues = validate(d);
      if (issues.length) return message("Please fix: " + issues.join("; "));
      ed.saving = true;
      try {
        const token = U.hist.commit(),
          data = copy({
            ...d,
            name: d.name.trim(),
            composition: C.clean(d.composition),
          });
        if (ed.id) await api.update("customwidgets", ed.id, data);
        else ed.id = (await api.add("customwidgets", data)).id;
        U.hist.markSaved(token);
        ed.dirty = !U.hist.isClean();
        message(
          "Saved. Add it from My widgets in the Layout Editor" +
            (scope === "lane" ? " or Leaderboard Editor." : "."),
        );
      } catch (err) {
        message("Could not save: " + err.message);
      } finally {
        ed.saving = false;
      }
    };
    if (!ed.loaded) {
      ed.loaded = true;
      Promise.all([
        api.list("chartdesigns"),
        api.list("rowdesigns"),
        api.list("imagesets"),
        api.list("teams"),
      ])
        .then(([charts, rows, images, teams]) => {
          ed.charts = charts;
          ed.rows = rows;
          ed.images = images;
          ed.teams = teams;
          if (wbEd === ed) edit(box);
        })
        .catch((err) =>
          message("Could not load saved designs: " + err.message),
        );
    }
  }
  function allNodes(n) {
    return [n, ...(n.children || []).flatMap(allNodes)];
  }
  const allContainers = (n) =>
    allNodes(n).filter((x) => containers.includes(x.kind));
  function validate(d) {
    const scope = d.type === "textrace" ? "race" : "lane",
      keys = new Set(C.catalog(scope).map((x) => x.key)),
      errors = [];
    for (const n of allNodes(d.composition.root)) {
      if (
        ["value", "bar", "ring", "gauge"].includes(n.kind) &&
        !keys.has(n.key)
      )
        errors.push("choose a value available for " + scope);
      if (
        ["bar", "ring", "gauge"].includes(n.kind) &&
        C.catalog(scope).find((x) => x.key === n.key)?.type !== "number"
      )
        errors.push("meters require a numeric value");
      if (["bar", "ring", "gauge"].includes(n.kind) && n.max <= n.min)
        errors.push("meter maximum must exceed minimum");
      if (
        n.kind === "component" &&
        !C.components(scope).some((x) => x.type === n.component)
      )
        errors.push("choose a component available for " + scope);
      for (const m of n.text.matchAll(/\{(\w+)\}/g))
        if (!keys.has(m[1])) errors.push("unknown value " + m[1]);
      for (const r of n.rules) {
        if (!r.conditions.length) errors.push("each rule needs a condition");
        if (r.action === "text" && n.kind === "text")
          for (const m of r.text.matchAll(/\{(\w+)\}/g))
            if (!keys.has(m[1])) errors.push("unknown value " + m[1]);
      }
      for (const r of n.rules)
        for (const c of r.conditions) {
          const f = C.catalog(scope).find((x) => x.key === c.key);
          if (!f) errors.push("rule uses unavailable value " + c.key);
          else if (!["missing", "present"].includes(c.op)) {
            if (
              f.type === "number" &&
              (!c.value.trim() || !Number.isFinite(Number(c.value)))
            )
              errors.push("numeric rule needs a number");
            if (f.type !== "number" && ["lt", "gt", "le", "ge"].includes(c.op))
              errors.push("ordered comparisons need a numeric value");
            if (f.type === "boolean" && !["true", "false"].includes(c.value))
              errors.push("boolean rule needs true or false");
          }
        }
    }
    return [...new Set(errors)];
  }
  return { edit, validate, allNodes };
})();
