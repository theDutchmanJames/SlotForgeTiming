// The Pace meter widget (1.54.0): how hard the car is driven now, and what it costs in tyres and fuel (Push and Save System).
// Pure: what it shows is worked out from the race (engine.js psInfo of the car, and the settings of the system) and the options of the widget. The register of the widgets (widgets.js) takes the options and the sample from here,
// the page that draws the widgets (timing.js) takes the content, and the Driver stats grid and the Leaderboard take the cells (looks 'cell' and 'wear').
// Looks: a badge (PUSH, NORMAL or SAVE with the percentage over the best lap), a gauge (a half circle with a needle), a bar (a marker on a strip) and the wear only (tyres x1.35, fuel x1.22).
(function (root) {
  const Ps = typeof module !== 'undefined' ? require('./pushsave.js') : root.PushSave;
  const esc = x => String(x ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const COLOR = /^(#[0-9a-f]{3,8}|rgba?\([0-9 ,.%]+\)|hsla?\([0-9 ,.%]+\)|var\(--[a-z-]+\)|[a-z]+)$/i;
  const cssVal = v => (typeof v === 'string' && COLOR.test(v.trim()) ? v.trim() : '');

  const LOOKS = [['badge', 'A badge (PUSH, NORMAL or SAVE)'], ['gauge', 'A gauge with a needle'], ['bar', 'A bar with a marker'], ['wear', 'The wear only (tyres ×1.35, fuel ×1.22)']];
  const OPTIONS = [
    { key: 'look', label: 'Show the pace as', type: 'select', default: 'badge', rerender: true, choices: LOOKS },
    { key: 'showPct', label: 'Show how far over the best lap (+0.4%)', type: 'checkbox', default: true },
    { key: 'showWear', label: 'Show what the pace does to the tyres and the fuel (tyres ×1.35 · fuel ×1.22)', type: 'checkbox', default: true },
    { key: 'showRef', label: 'Show the reference lap (7.412 s, record)', type: 'checkbox', default: false },
    { key: 'pushColor', label: 'Colour of PUSH', type: 'color', default: '#ff6b6f' },
    { key: 'normalColor', label: 'Colour of NORMAL', type: 'color', default: '#c9ced6' },
    { key: 'saveColor', label: 'Colour of SAVE', type: 'color', default: '#3ecf8e' }
  ];
  const DEFAULTS = Object.fromEntries(OPTIONS.map(o => [o.key, o.default]));
  const optOf = (opt, k) => (opt && opt[k] !== undefined ? opt[k] : DEFAULTS[k]);
  const look = opt => { const l = optOf(opt, 'look'); return l === 'cell' || LOOKS.some(x => x[0] === l) ? l : 'badge'; }; // ('cell' is the look of the Pace cell of the grids, not one to choose)
  const colorOf = (opt, kind) => { const k = kind === 'push' ? 'pushColor' : kind === 'save' ? 'saveColor' : 'normalColor'; return cssVal(optOf(opt, k)) || DEFAULTS[k]; };
  const secText = ms => (ms > 0 ? `${(Math.round(ms) / 1000).toFixed(3)} s` : '');

  // the words under the pace: how far over the best lap, or why the lap wears as usual
  const paceLine = (info, opt) => (info.p !== null && info.p !== undefined ? (optOf(opt, 'showPct') !== false ? Ps.pctText(info.p) : '') : Ps.whyText(info.why));
  // tyres ×1.35 · fuel ×1.22 (only for what the system changes)
  function wearLine(info, cfg) {
    const parts = [];
    if (cfg.tyres.on) parts.push(`tyres ${Ps.multText(info.tyres)}`);
    if (cfg.fuel.on) parts.push(`fuel ${Ps.multText(info.fuel)}`);
    return parts.join(' · ');
  }
  const refLine = info => (info.ref > 0 ? `${secText(info.ref)}${info.src ? ', ' + Ps.sourceText(info.src) : ''}` : 'no reference lap yet');

  // one of the zones of the pace scale, as a share of the scale (0 to 1): PUSH from 0, NORMAL around normal pace, SAVE after that; the scale ends a quarter after the most saving pace
  function scale(cfg) {
    const band = Math.min(Ps.BAND, cfg.normal / 2), max = cfg.saveAt * 1.25;
    return { max, a: Math.max(0, cfg.normal - band) / max, b: Math.min(max, cfg.normal + band) / max };
  }
  const share = (cfg, p) => { const sc = scale(cfg); return Math.max(0, Math.min(1, (p || 0) / sc.max)); };

  // the gauge: a half circle (the pace from 0 on the left to the end of the scale on the right), the three zones as arcs and a needle
  function gaugeSvg(info, cfg, opt) {
    const sc = scale(cfg), cx = 50, cy = 50, r = 40, pt = (f, rr) => { const a = Math.PI * (1 - f); return [Math.round((cx + rr * Math.cos(a)) * 100) / 100, Math.round((cy - rr * Math.sin(a)) * 100) / 100]; };
    const arc = (f0, f1, col) => { if (f1 - f0 <= 0.0005) return ''; const [x0, y0] = pt(f0, r), [x1, y1] = pt(f1, r); return `<path d="M${x0} ${y0}A${r} ${r} 0 0 1 ${x1} ${y1}" fill="none" stroke="${col}" stroke-width="9" stroke-opacity=".85"/>`; };
    const has = info.p !== null && info.p !== undefined, [nx, ny] = pt(has ? share(cfg, info.p) : 0.5, r - 6);
    return `<svg class="psgauge" viewBox="0 0 100 56" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${arc(0, sc.a, colorOf(opt, 'push'))}${arc(sc.a, sc.b, colorOf(opt, 'normal'))}${arc(sc.b, 1, colorOf(opt, 'save'))}`
      + (has ? `<path d="M${cx} ${cy}L${nx} ${ny}" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="3" fill="currentColor"/>` : '') + '</svg>';
  }
  // the bar: a strip with the three zones and a marker at the pace
  function barHtml(info, cfg, opt) {
    const sc = scale(cfg), has = info.p !== null && info.p !== undefined, pct = n => Math.round(n * 1000) / 10;
    const bg = `linear-gradient(90deg,${colorOf(opt, 'push')} 0 ${pct(sc.a)}%,${colorOf(opt, 'normal')} ${pct(sc.a)}% ${pct(sc.b)}%,${colorOf(opt, 'save')} ${pct(sc.b)}% 100%)`;
    return `<span class="psbar" style="background:${bg}">${has ? `<i class="psmark" style="left:${pct(share(cfg, info.p))}%"></i>` : ''}</span>`;
  }
  const pill = (info, opt) => { const k = info.p !== null && info.p !== undefined ? info.kind : 'normal', col = colorOf(opt, k); return `<b class="pspill psk-${k}" style="background:${col}">${Ps.kindText(k)}</b>`; };

  // the content of the widget for the pace info of one car: { html }
  function rowHtml(info, cfg, opt) {
    if (!info || !cfg) return { html: '–' };
    const lk = look(opt), line = paceLine(info, opt), wear = optOf(opt, 'showWear') !== false ? wearLine(info, cfg) : '', ref = optOf(opt, 'showRef') === true ? refLine(info) : '';
    if (lk === 'cell') return { html: `<span class="pscell">${pill(info, opt)}${line ? `<span class="psp">${esc(line)}</span>` : ''}</span>` };
    if (lk === 'wear') return { html: `<span class="pswear">${cfg.tyres.on ? `<span class="psw"><small>Tyres</small><b>${esc(Ps.multText(info.tyres))}</b></span>` : ''}${cfg.fuel.on ? `<span class="psw"><small>Fuel</small><b>${esc(Ps.multText(info.fuel))}</b></span>` : ''}${!cfg.tyres.on && !cfg.fuel.on ? '–' : ''}</span>` };
    const small = [wear, ref].filter(Boolean).map(t => `<small>${esc(t)}</small>`).join('');
    const top = `${pill(info, opt)}${line ? `<span class="psp">${esc(line)}</span>` : ''}`;
    if (lk === 'gauge') return { html: `<span class="psbox">${gaugeSvg(info, cfg, opt)}<span class="psl">${top}</span>${small}</span>` };
    if (lk === 'bar') return { html: `<span class="psbox psbox-bar">${barHtml(info, cfg, opt)}<span class="psl">${top}</span>${small}</span>` };
    return { html: `<span class="psbox"><span class="psl">${top}</span>${small}</span>` };
  }

  // the content for the car of a lane: c is the car of the race, S the race the widgets are drawn from (S.eng)
  function content(opt, c, S) {
    const eng = S && S.eng; if (!eng || !eng.pushSave || !c || !eng.psInfo) return { html: '–' };
    return rowHtml(eng.psInfo(c), eng.pushSave, opt);
  }
  // text for a list or the audio (no markup): "PUSH +0.4%, tyres ×1.35 · fuel ×1.22"
  function cellText(info, cfg) {
    if (!info || !cfg) return '';
    const head = info.p !== null && info.p !== undefined ? `${Ps.kindText(info.kind)} ${Ps.pctText(info.p)}` : Ps.whyText(info.why) || Ps.kindText('normal');
    return [head, wearLine(info, cfg)].filter(Boolean).join(', ');
  }

  // ---- the made-up values of the layout editor ----
  const SAMPLE_CFG = Ps.clean({}), SAMPLE_P = [0.4, 3, 7.1, 1.3, 5];
  function sampleInfo(l) {
    const p = SAMPLE_P[l % SAMPLE_P.length], e = Ps.lapEffect(SAMPLE_CFG, { lapMs: 10000 * (1 + p / 100), ref: 10000, lapNo: 5 });
    return { kind: e.kind, p: e.p, why: e.why, tyres: e.tyres, fuel: e.fuel, ref: 10000, src: 'record' };
  }
  const sample = (l, w) => rowHtml(sampleInfo(l), SAMPLE_CFG, (w && w.opt) || {}).html;

  const api = { LOOKS, OPTIONS, DEFAULTS, look, rowHtml, content, cellText, sample, sampleInfo, gaugeSvg, barHtml, scale, share, paceLine, wearLine, refLine, secText };
  root.PaceW = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
