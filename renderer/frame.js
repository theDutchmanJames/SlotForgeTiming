// The frame of a widget on the timing page: its background and its border.
//  - Border: the theme's own line (the default), none at all, a shade made from the widget's background colour, or a colour of your own (1.46.0).
//    The shade slider runs from 0 (white) over 50 (the background colour itself) to 100 (black), in steps of 0.5.
//  - Border thickness (1.46.0): 0 to 40 layout units (a layout is 1000 units wide), in steps of 0.5, so it grows and shrinks with the page like the text does.
//    Empty is the standard thin line (1 px). It counts for every kind of border, a colour of your own or the theme's.
//  - Transparency (0 = solid, 100 = invisible) fades the background and the border together. The title and the value are not touched.
//    The layout has one setting for all its widgets; a widget can have its own, which wins.
//  - Corners: a layout-wide radius with an override per widget.
// Pure functions that make CSS text, so they can be tested without a screen. The colours are mixed by the browser (color-mix),
// which means a background that is a theme colour (var(--panel)) works too.
(function (root) {
  const safe = v => { const t = String(v ?? '').trim(); return /^[#\w\s.,%()/-]{1,60}$/.test(t) && !/url|expression|import|@/i.test(t) ? t : ''; };
  const number = (v, lo, hi, fallback, step) => {
    const n = typeof v === 'string' && !v.trim() ? NaN : Number(v);
    if (!((typeof v === 'number' || typeof v === 'string') && Number.isFinite(n))) return fallback;
    return Math.round(Math.min(hi, Math.max(lo, n)) / step) * step;
  };

  const MODES = ['', 'shade', 'custom', 'off']; // '' = the theme's own border
  const DEFAULT_SHADE = 37.5; // a quarter white: halfway between the middle (50) and white (0)
  const mode = w => (MODES.includes(w.borderMode) ? w.borderMode : '');
  // a colour of your own: '#rgb' or '#rrggbb' (kept as '#rrggbb'); anything else is the start colour, a quiet grey that shows on a dark and on a light page
  const COLOR_START = '#8f98a3', PAGE_UNITS = 1000;
  const hex = v => { const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(v ?? '').trim()); if (!m) return ''; const h = m[1].toLowerCase(); return '#' + (h.length === 3 ? [...h].map(c => c + c).join('') : h); };
  const colorOf = w => hex(w.borderColor) || COLOR_START;
  // the thickness in layout units, 0 to 40 in half steps; null = nothing set (the standard thin line)
  const widthOf = w => number(w.borderWidth, 0, 40, null, 0.5);
  const shade = w => number(w.borderShade, 0, 100, DEFAULT_SHADE, 0.5);
  // Transparency: the widget's own setting if it has one (also 0, which is solid), otherwise the layout's (widgetTransparency), otherwise solid.
  const ownTransparency = w => number(w.transparency, 0, 100, null, 1); // null = follows the layout
  const layoutTransparency = l => number(l && l.widgetTransparency, 0, 100, 0, 1);
  const transparency = (w, layout) => { const o = ownTransparency(w); return o !== null ? o : layoutTransparency(layout); };

  const pct = n => String(Math.round(n * 10) / 10);
  // the border colour that goes with a background: white (0) ... the background (50) ... black (100)
  const shadeOf = (bg, s) => (s === 50 ? bg : `color-mix(in srgb, ${s < 50 ? 'white' : 'black'} ${pct(Math.abs(50 - s) * 2)}%, ${bg})`);
  const fade = (c, t) => (t ? `color-mix(in srgb, ${c} ${100 - t}%, transparent)` : c);

  // What to set on a widget: { background, borderColor, backgroundClip }. An empty text leaves the style sheet in charge,
  // so a widget that never used these settings looks exactly as before.
  // bg: the colour of the background; classic: the colour of the theme's border.
  // U: the width of the page in layout units (1000), which the thickness of the border is a share of (in cqw, like the corners)
  const widthCss = (w, U) => { const t = widthOf(w); return t === null ? '' : `${Math.round(t / (U > 0 ? U : PAGE_UNITS) * 100000) / 1000}cqw`; }; // (three decimals: a half unit on a page of 1000 is 0.05cqw)
  const style = (bgColor, w, classic, layout, U) => {
    const bg = safe(bgColor) || 'var(--panel)', m = mode(w), t = transparency(w, layout), bw = widthCss(w, U);
    if (!m && !t) return { background: bg, borderColor: '', backgroundClip: '', borderWidth: bw };
    const line = m === 'off' ? 'transparent' : fade(m === 'shade' ? shadeOf(bg, shade(w)) : m === 'custom' ? colorOf(w) : safe(classic) || 'var(--line)', t);
    return { background: fade(bg, t), borderColor: line, backgroundClip: 'padding-box', borderWidth: bw };
  };
  const css = (bgColor, w, classic, layout, U) => { const s = style(bgColor, w, classic, layout, U); return `background:${s.background}${s.borderColor ? `;border-color:${s.borderColor};background-clip:${s.backgroundClip}` : ''}${s.borderWidth ? `;border-width:${s.borderWidth}` : ''}`; };
  // How solid a widget is, 0 to 1 (the depth of the page, see styles.css, fades with the background so a see-through widget stays flat)
  const solidity = (w, layout) => Math.round((100 - transparency(w, layout)) * 10) / 1000;

  // Rounded corners: how round, from 0 (square) to 50 (fully round: a circle on a square widget, a pill on a long one), as a percent of the widget's
  // shorter side, so it looks the same at any size. A widget's own setting wins over the layout's. null = nothing set (the style sheet's own corners).
  const cornerPct = v => number(v, 0, 50, null, 0.5);
  const corner = (w, layout, U) => {
    const own = cornerPct(w.radius), pct = own !== null ? own : cornerPct(layout && layout.radius);
    return pct === null || !(U > 0) ? '' : `${Math.round(pct * Math.min(w.w, w.h) / U * 100) / 100}cqw`;
  };

  // what a layout keeps of the frame settings
  const pickLayout = l => ({ radius: cornerPct(l && l.radius) ?? '', widgetTransparency: layoutTransparency(l) });

  const api = { mode, shade, colorOf, widthOf, hex, solidity, COLOR_START, transparency, ownTransparency, layoutTransparency, pickLayout, shadeOf, style, css, cornerPct, corner, DEFAULT_SHADE, MODES };
  root.Frame = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
