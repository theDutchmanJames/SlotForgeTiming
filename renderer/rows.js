// Leaderboard row designs: one row built from the per-driver widgets, repeated for every driver in race order.
// Pure: it only builds html text from a design and the shared race state (see timing.js, liveshare.js).
(function (root) {
  const Wd = typeof module !== 'undefined' ? require('./widgets.js') : root.Widgets;
  const frameModule = () => typeof module !== 'undefined' ? require('./frame.js') : root.Frame;
  const U = 1000;
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const num = (v, d, lo, hi) => { const n = Number(v); return Number.isFinite(n) && v !== '' && v !== null ? Math.max(lo, Math.min(hi, n)) : d; };

  // colours a row can take on, strongest first
  const STATES = [['out', 'Out of the race (retired, disqualified, out of fuel)', '#4a4a4a', '#bbbbbb'], ['pit', 'In the pits', '#1e5fa8', '#ffffff'],
    ['pen', 'Has a penalty to serve', '#a33a00', '#ffffff'], ['leader', 'Leader', '#b8860b', '#ffffff']];

  // The settings of a design, with defaults for anything missing. rowH = the row's height in the 1000-wide row.
  function settings(d) {
    const s = {
      rowH: num(d && d.ratioH, 70, 20, 400), gap: num(d && d.gap, 6, 0, 100), header: !!(d && d.header), headerH: num(d && d.headerH, 40, 15, 200),
      headerBg: (d && d.headerBg) || '', headerText: (d && d.headerText) || '', rowBg: (d && d.rowBg) || '', rowText: (d && d.rowText) || '', altBg: (d && d.altBg) || '',
      radius: num(d && d.radius, 25, 0, 50), states: !d || d.states !== false
    };
    STATES.forEach(([k, , bg, tx]) => { s[k + 'Bg'] = d && d[k + 'Bg'] !== undefined && d[k + 'Bg'] !== '' ? d[k + 'Bg'] : bg; s[k + 'Text'] = d && d[k + 'Text'] !== undefined && d[k + 'Text'] !== '' ? d[k + 'Text'] : tx; });
    return s;
  }

  // A new design starts with these cells: position, flag, name, laps, best lap, gap.
  function defaultDesign() {
    const D = { name: 'New row design', note: '', ratioW: U, ratioH: 70, gap: 6, header: false, widgets: [] };
    const add = (type, x, w) => { const g = Wd.newWidget(type, 0, x, 5); g.w = w; g.h = 60; g.textSize = 30; g.showTitle = false; D.widgets.push(g); };
    add('position', 5, 70); add('driverflag', 80, 70); add('name', 155, 300); add('lap', 460, 110); add('bestlap', 575, 180); add('gap', 760, 220);
    return D;
  }

  // The height of all the rows together, in the units of the 1000-wide row: the header, every row and the gaps between them (the first row has no gap above it).
  function totalH(d, n) {
    const s = settings(d), rows = Math.max(0, Math.floor(Number(n)) || 0);
    return Math.max(1, (s.header ? s.headerH : 0) + rows * s.rowH + Math.max(0, rows - (s.header ? 0 : 1)) * s.gap);
  }
  // "Size of the rows" in percent (20 to 100): 100 is as large as fits in the widget's frame, less is smaller
  const scaleOf = v => num(v, 100, 20, 100) / 100;
  // "Space between the columns" in percent (0 to 100): 100 keeps the design as it is, less closes up the blank space between its columns
  const gapsOf = v => num(v, 100, 0, 100) / 100;
  // "Fill the frame": '' (off: the rows keep the shape of the design), 'rows' (the rows grow taller until the board fills the frame) or 'gaps' (the free height goes between the rows)
  const fillOf = v => (v === 'rows' || v === 'gaps' ? v : '');
  const fillAttr = o => { const f = fillOf(o && o.fill); return f ? ` data-fill="${f}"` : ''; };
  const r2 = n => Math.round(n * 100) / 100;
  // The blank space that is kept when the columns are closed up completely: between two columns, and at the left and right edge of the row (in row units)
  const KEEP_BETWEEN = 10, KEEP_EDGE = 5;

  // Where the cells sit when the blank space between the columns is closed up. The columns are the stretches of the row that have cells in them (cells that
  // are above each other, or touch, share one); what is between them is blank space. Each stretch of blank space shrinks to the least that is kept
  // (KEEP_BETWEEN, KEEP_EDGE) plus the share of the rest that o.gaps says (100 = all of it, 0 = none). The columns themselves keep their width and their
  // places in relation to each other. Returns { W, k, map }: the width of the row in row units (1000 = as designed), k = 1000 / W (how much bigger the text
  // is, in relation to the row), and map(x) = where a point of the design is now.
  function layoutOf(d, o) {
    const keep = gapsOf(o && o.gaps), cols = ((d && d.widgets) || []).filter(w => Wd.def(w.type) && Wd.def(w.type).perLane && Number(w.w) > 0)
      .map(w => [Number(w.x) || 0, (Number(w.x) || 0) + Number(w.w)]).sort((a, b) => a[0] - b[0]);
    const identity = { W: U, k: 1, map: x => x };
    if (!cols.length || keep >= 1) return identity;
    // the pieces of the row, in order: [from, to, minimum kept] for blank space, [from, to, null] for a column
    const pieces = [];
    let at = 0;
    cols.forEach((c, i) => { // (a cell that starts inside the one before it, or where it ends, leaves no blank space: it just goes on)
      if (c[0] > at) pieces.push([at, c[0], i === 0 ? KEEP_EDGE : KEEP_BETWEEN]);
      if (c[1] > Math.max(at, c[0])) { pieces.push([Math.max(at, c[0]), c[1], null]); at = c[1]; }
    });
    if (at < U) pieces.push([at, U, KEEP_EDGE]);
    let x2 = 0; const knots = pieces.map(([from, to, least]) => {
      const len = to - from, now = least === null ? len : Math.min(len, least) + Math.max(0, len - least) * keep, k = [from, to, x2, x2 + now];
      x2 += now; return k;
    });
    const W = Math.max(1, r2(x2));
    if (W >= U) return identity;
    // a point inside a stretch of blank space moves in proportion; one outside the row moves with its nearest edge
    const map = x => {
      const first = knots[0], last = knots[knots.length - 1];
      if (x <= first[0]) return first[2] + (x - first[0]);
      if (x >= last[1]) return last[3] + (x - last[1]);
      const kn = knots.find(k => x <= k[1]);
      return kn[1] === kn[0] ? kn[2] : kn[2] + (x - kn[0]) * (kn[3] - kn[2]) / (kn[1] - kn[0]);
    };
    return { W, k: U / W, map };
  }

  // What the style sheet needs to fit the rows into the frame of a widget (the rule is in styles.css, `.lw-val > .rrows`): their height in row units, the size choice
  // and, when the columns are closed up, the width of the row. The rows keep their proportions and shrink as a whole, so the text of every cell shrinks with its row and is never cut.
  const fitStyle = (d, n, o) => { const L = layoutOf(d, o); return `--rtot:${r2(totalH(d, n))};--rk:${scaleOf(o && o.scale)}${L.W !== U ? `;--rw:${L.W}` : ''}`; };

  // The text of a cell that is wider than its cell is made smaller, just enough to fit, so nothing is cut off (a long name, a header title in a narrow column).
  // Works in the browser only: it measures the page. measure(el) -> { box, text } (the width of the cell, the width its text needs) can be replaced, to test.
  const measureCell = el => { const r = document.createRange(); r.selectNodeContents(el); return { box: el.clientWidth, text: r.getBoundingClientRect().width }; };
  function fitText(container, measure) {
    const m = measure || measureCell, cells = Array.from(container.querySelectorAll('.rrow .rcell > .lw-val')).filter(v=>{
      const el=v.parentElement;
      if(!measure&&root.WidgetView&&el?.clientWidth&&globalThis.getComputedStyle){
        root.WidgetView.fitCell(el);return false;
      }
      if(v.querySelector?.('.wc-root')){if(typeof WidgetCompose!=='undefined')WidgetCompose.fit(v);return false;}return true;
    });
    cells.forEach(v => { v.style.fontSize = ''; });
    const sizes = cells.map(v => m(v)); // (all measured first, then all set: one layout of the page, not one per cell)
    cells.forEach((v, i) => { const { box, text } = sizes[i]; if (box > 0 && text > box + 0.5) v.style.fontSize = `${Math.max(20, Math.floor(box / text * 100))}%`; });
  }

  // which colour state a car is in: out, pit, pen, leader or '' (none)
  function stateOf(car, pos) {
    if (car.dq || car.retired || car.outOfFuel) return 'out';
    if (car.blockAt !== null && car.blockAt !== undefined) return 'pit';
    if (car.pending && car.pending.length) return 'pen';
    if (pos === 1 && car.laps && car.laps.length) return 'leader';
    return '';
  }

  const fontModule=()=>root.WidgetFonts||(typeof require!=="undefined"?require("./widgetfonts.js"):null);
  const fontStyle=(w,d,header=false)=>fontModule()?.rowStyle(w,d,header)||"";
  let fontFitPending=false;
  const fontFit=()=>{if(fontFitPending)return;fontFitPending=true;const run=()=>{fontFitPending=false;fitText(root.document);};if(root.requestAnimationFrame)root.requestAnimationFrame(run);else run();};
  if(root.addEventListener){root.addEventListener("widget-fonts-ready",fontFit);root.document?.fonts?.addEventListener("loadingdone",fontFit);}
  const cellStyle = (w, s, L) => `left:${L.map(w.x) / L.W * 100}%;top:${w.y / s.rowH * 100}%;width:${w.w / L.W * 100}%;height:${w.h / s.rowH * 100}%;font-size:${(w.textSize || Wd.def(w.type).textSize) / 10 * L.k}cqw`;
  const colourStyle = (color, bg) => `${Wd.cssVal(color) ? 'color:' + Wd.cssVal(color) + ';' : ''}${Wd.cssVal(bg) ? 'background:' + Wd.cssVal(bg) : ''}`;
  // the colour sits on a layer behind the cells so its corners can be rounded (radius = % of the row height; cqw is the row's own width)
  const rowWrap = (s, cls, color, bg, inner, L, stripe, lane) => `<div class="rrow ${cls}"${Number.isInteger(lane)?` data-lap-lane="${lane}"`:''} style="aspect-ratio:${L.W} / ${s.rowH};margin-top:${s.gap / L.W * 100}%;${Wd.cssVal(color) ? 'color:' + Wd.cssVal(color) : ''}"><i class="rrow-bg${stripe?.cls || ''}" style="background:${Wd.cssVal(bg) || 'var(--panel)'};border-radius:${Math.round(s.radius * s.rowH * L.k / 10) / 100}cqw${stripe?.css ? ';' + stripe.css : ''}"></i>${inner}</div>`;
  const rowStripe = (lane, layout, s, o) => { const F = frameModule(); return F ? F.laneStripe({ lane, laneColorStyle: o && o.laneColorStyle, transparency: o && o.laneTransparency, w: 1000, h: s.rowH }, layout, (layout?.laneColors || [])[lane]?.bg || '') : null; };

  function headerHtml(d, s, L) {
    const hs = { ...s, rowH: s.headerH };
    return rowWrap(hs, 'rrow-head', s.headerText, s.headerBg, d.widgets.filter(w => Wd.def(w.type)).map(w => {
      const t = Wd.titleOf(w);
      return `<div class="lw live rcell${Wd.alignClassOf(w)}" ${root.WidgetView?root.WidgetView.attributes({type:'rowcell'}):''}${fontModule()?.attributes(w,d,true)||""} style="left:${L.map(w.x) / L.W * 100}%;top:0;width:${w.w / L.W * 100}%;height:100%;font-size:${(w.titleSize || 12) * 1.4 / 10 * L.k}cqw${fontStyle(w,d,true)}"><span class="lw-val" style="font-weight:var(--wf-title-weight,600)">${esc(t)}</span></div>`;
    }).join(''), L);
  }

  // Only the places from .. to of a ranking (1.11.0, for a leaderboard that shows part of the field, such as places 5 to 8). o.from: the first place (empty or 1 = from the first),
  // o.to: the last place (empty or 0 = to the last). A "to" before "from" shows nobody.
  function range(list, o) {
    const from = Math.floor(Number(o && o.from)) || 1, to = Math.floor(Number(o && o.to)) || 0;
    return from <= 1 && to <= 0 ? list : list.slice(Math.max(0, from - 1), to > 0 ? to : undefined);
  }

  // The rows of a leaderboard. S = shared race state (needs standings() and what Timing.content reads). rows can be limited with max.
  // o.scale: the "Size of the rows" setting of the widget, o.gaps: its "Space between the columns", o.fill: its "Fill the frame".
  function html(d, S0, max, o) {
    const T = typeof module !== 'undefined' ? require('./timing.js') : root.Timing, s = settings(d), L = layoutOf(d, o);
    const S = o && o.countOver === 'all' && T.overallState ? T.overallState(S0) || S0 : S0; // (1.67.0: "Count over: All heats so far" lists every participant of a heat race, from the heats that are done and the one that is racing)
    const MC=typeof module!=='undefined'?require('./multiclass.js'):root.MultiClass, mode=o?.classView||d.classView||S.eng?.multiclass?.display||'overall',id=o?.classId||d.classId||'';
    const list = range(MC?MC.view(T.ordered((S.standings() || []), o, S),mode,id):T.ordered((S.standings() || []), o, S), o).slice(0, max || 99); // (a board that is ordered by a value: that order, then the places from .. to)
    const rows = list.map((x, i) => {
      const car = x.car, st = s.states ? stateOf(car, x.pos) : '';
      const base = st ? { color: s[st + 'Text'], bg: s[st + 'Bg'] } : { color: s.rowText, bg: i % 2 && s.altBg ? s.altBg : s.rowBg };
      const cells = d.widgets.filter(w => Wd.def(w.type) && Wd.def(w.type).perLane).map((w,cellIndex) => {
        const out = x.byOrder && w.type === 'position' ? { html: String(x.pos) } : T.content({ ...w, lane: car.lane, ...(o?.laneColorStyle && o.laneColorStyle !== 'full' && !w.laneColorStyle ? { laneColorStyle: o.laneColorStyle } : {}) }, S); // (in an ordered board the Position cell counts the rows of the board)
        // Repeated component IDs belong to a particular row and cell.
        if(out.components?.length){
          const prefix=`row-${i}-cell-${cellIndex}-`;
          out.html=out.html.replace(/data-wc-component="([^"]*)"/g,(_,id)=>`data-wc-component="${prefix}${id}"`);
          o?.components?.push(...out.components.map(c=>({...c,id:prefix+c.id})));
        }
        const color = w.textColor || out.color || '', bg = w.bgColor || out.bg || '';
        return `<div class="lw live rcell${Wd.alignClassOf(w)}" ${root.WidgetView?root.WidgetView.attributes(w):''}${fontModule()?.attributes(w,d)||""} style="${cellStyle(w, s, L)}${fontStyle(w,d)};${colourStyle(color, bg)}"><span class="lw-val"${Wd.valueStyleOf ? ` style="${Wd.valueStyleOf(w)}"` : ''}>${out.html}</span></div>`;
      }).join('');
      return (mode==='grouped'&&(!i||list[i-1].className!==x.className)?`<div class="mc-group-heading">${esc(x.className||'Comparisons')}</div>`:'')+rowWrap(s, 'rrow-' + (st || 'plain'), base.color, base.bg, cells, L, rowStripe(car.lane, S.layout, s, o), car.virtual ? car.real?.lane : car.lane);
    }).join('');
    return `<div class="rrows"${fillAttr(o)} style="${fitStyle(d, list.length + (mode==='grouped'?new Set(list.map(x=>x.className)).size:0), o)}">${s.header ? headerHtml(d, s, L) : ''}${rows}</div>`;
  }

  // The row designer uses the same ordering, ranges, states and cell formatter
  // as a leaderboard on track. Its fixtures are isolated from live races.
  function sampleHtml(d,count,sets,o={}) {
    const P=typeof module!=='undefined'?require('./widgetpreview.js'):root.WidgetPreview;
    return html(d,P.state({type:'leaderboard'}, {layout:o.layout||{},imageSets:sets||[],chartDesigns:o.chartDesigns||[]}),Math.max(1,Math.min(8,Math.floor(Number(count))||5)),o);
  }

  const api = { STATES, settings, defaultDesign, stateOf, range, html, sampleHtml, totalH, scaleOf, gapsOf, fillOf, layoutOf, fitStyle, fitText };
  root.Rows = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
