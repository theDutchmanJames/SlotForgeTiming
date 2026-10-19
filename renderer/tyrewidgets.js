// The Tyre Degradation widget (1.40.0): how much life the tyres of a lane's car have left. Pure: what it shows is worked out from the race (tyrewear.js view rows) and the settings of the widget, and drawn as small pictures (SVG)
// or as the bar of the Fuel widget. The register of the widgets (widgets.js) takes the options and the sample from here, the page that draws the widgets (timing.js) takes the content, and the Driver stats grid and the
// Leaderboard take cellHtml. Looks: the tyre wears away (the tread gets shorter), your own tyre picture with a ring that empties, a bar (horizontal or vertical, the one of the Fuel widget), or a number.
// 1.41.0: the Available Tyres widget (setsRowHtml, SETS_OPTIONS): how many sets of every tyre are left in the box of the car (or the team), with a ring on the tyre that is on the car and NEXT on the tyre that goes on at the next stop.
(function (root) {
  const Wx = typeof module !== 'undefined' ? require('./weather.js') : root.Wx;
  const Tw = typeof module !== 'undefined' ? require('./tyrewear.js') : root.TyreWear;
  const Ww = typeof module !== 'undefined' ? require('./weatherwidgets.js') : root.WxW;
  const esc = x => String(x ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const COLOR = /^(#[0-9a-f]{3,8}|rgba?\([0-9 ,.%]+\)|hsla?\([0-9 ,.%]+\)|var\(--[a-z-]+\)|[a-z]+)$/i;
  const cssVal = v => (typeof v === 'string' && COLOR.test(v.trim()) ? v.trim() : '');
  const clampInt = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
  const MINUS = '−';

  const LOOKS = [['wear', 'The tyre wears away (the tread gets shorter)'], ['ring', 'The tyre picture with a ring that empties'], ['bar', 'A bar'], ['number', 'A number only']];
  const isBar = o => (o && o.look) === 'bar';
  const OPTIONS = [
    { key: 'imageSet', label: 'Picture set (made under Customization > Image Settings)', type: 'imageset', kind: 'tyres', noneLabel: 'None (the tyres are drawn)', default: '' },
    { key: 'look', label: 'Show the tyre life as', type: 'select', default: 'wear', rerender: true, choices: LOOKS },
    { key: 'dir', label: 'Bar direction', type: 'select', default: 'horizontal', choices: [['horizontal', 'Horizontal (empties to the left)'], ['vertical', 'Vertical (empties downwards)']], show: isBar },
    { key: 'thick', label: 'Bar thickness (% of the widget)', type: 'number', default: 60, min: 10, max: 100, step: 5, show: isBar },
    { key: 'showPct', label: 'Show the percentage (62%)', type: 'checkbox', default: true },
    { key: 'showLeft', label: 'Show the laps left (14 laps left), in a Distance Race the metres or feet left', type: 'checkbox', default: true },
    { key: 'showGrip', label: 'Show the grip effect now (+2%)', type: 'checkbox', default: true },
    { key: 'showName', label: 'Show the name of the tyre (Soft)', type: 'checkbox', default: false },
    { key: 'showBox', label: 'Say BOX NOW when the tyres are worn out', type: 'checkbox', default: true },
    { key: 'okColor', label: 'Colour of the life', type: 'color', default: '#3ecf8e' },
    { key: 'warnColor', label: 'Warning colour (at the warning level of the Tyre Wear System, 25% to begin with)', type: 'color', default: '#ffb84d' },
    { key: 'critColor', label: 'Critical colour (at the critical level, 10% to begin with, and at 0%)', type: 'color', default: '#e5484d' }
  ];
  const DEFAULTS = Object.fromEntries(OPTIONS.map(o => [o.key, o.default]));
  const optOf = (opt, k) => (opt && opt[k] !== undefined ? opt[k] : DEFAULTS[k]);
  const look = opt => { const l = optOf(opt, 'look'); return l === 'cell' || LOOKS.some(x => x[0] === l) ? l : 'wear'; }; // ('cell' is the look of the Tyres cell of the grids, not one to choose)
  const colorOf = (opt, level) => cssVal(optOf(opt, level === 'ok' ? 'okColor' : level === 'warn' ? 'warnColor' : 'critColor')) || DEFAULTS[level === 'ok' ? 'okColor' : level === 'warn' ? 'warnColor' : 'critColor'];
  const letterOf = code => (code === 'INT' ? 'I' : code);

  // ---- the pictures ----
  // the tyre that wears away: black rubber with a tread of blocks that gets shorter as the life goes down (the whole tread is gone at 0%), the ring in the colour of the compound and the letter
  function wearSvg(code, life, cls) {
    const t = Wx.tyreOf(code) || Wx.tyreOf(Wx.DEFAULT_TYRE), L = Math.max(0, Math.min(1, (Number(life) || 0) / 100)), letter = letterOf(t.code);
    const tread = L > 0.01 ? `<circle cx="50" cy="50" r="${(47 - 6 * L).toFixed(2)}" fill="none" stroke="#5b616c" stroke-width="${(12 * L).toFixed(2)}" pathLength="16" stroke-dasharray="0.45 0.55"/>` : '';
    return `<svg class="${cls || 'twpic'}" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(t.name)} tyres, ${Math.round(L * 100)}% life"><circle cx="50" cy="50" r="47" fill="#1b1d22" stroke="#000" stroke-width="2"/>${tread}`
      + `<circle cx="50" cy="50" r="31" fill="#2a2d34"/><circle cx="50" cy="50" r="31" fill="none" stroke="${t.color}" stroke-width="8"/>`
      + `<text x="50" y="51" text-anchor="middle" dominant-baseline="central" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${letter.length > 1 ? 24 : 30}" fill="${t.color}">${esc(letter)}</text></svg>`;
  }
  // a life ring round something: the ring empties clockwise from the top as the life goes down (r=46 and pathLength=100, so the dash is the life in %)
  function ringSvg(life, color) {
    const L = Math.max(0, Math.min(100, Number(life) || 0));
    return `<svg class="twring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" fill="none" stroke="#343b47" stroke-width="5"/>`
      + (L > 0 ? `<circle cx="50" cy="50" r="46" fill="none" stroke="${color}" stroke-width="5" pathLength="100" stroke-dasharray="${L.toFixed(2)} 100" transform="rotate(-90 50 50)"/>` : '') + '</svg>';
  }
  // the tyre picture inside the ring: a picture of your own (picture set) or the drawn tyre
  const inner = (code, opt) => (opt && opt.tyreImages && opt.tyreImages[code] ? Ww.icon('tyre', code, opt.tyreImages, 0, false) : wearSvg(code, 100, 'twin'));

  // ---- the words under the picture ----
  // r: a row of TyreWear.view (shown, level, code, tyre, leftText, effect, effectText, fitting, fitLeft)
  function lines(r, opt, withPct) {
    const out = [], st = Tw.stateOf(r), colour = colorOf(opt, r.level === 'out' ? 'crit' : r.level);
    if (withPct && optOf(opt, 'showPct') !== false) out.push(`<b class="twpct" style="color:${colour}">${r.shown}%</b>`);
    if (optOf(opt, 'showName') === true) out.push(`<span class="twnm">${esc(r.tyre)}</span>`);
    if (r.fitting) out.push(`<span class="twlf twfit">${esc(st.text)}</span>`);
    else if (r.level === 'out' && optOf(opt, 'showBox') !== false) out.push('<b class="twbox">BOX NOW</b>');
    else if (optOf(opt, 'showLeft') !== false) out.push(`<span class="twlf">${esc(r.leftText)}${r.leftText === 'no wear' ? '' : ' left'}</span>`);
    if (optOf(opt, 'showGrip') !== false && r.effect !== null && r.effect !== undefined) out.push(`<span class="twgr ${r.effect > 0 ? 'up' : r.effect < 0 ? 'down' : ''}">grip ${esc(r.effectText)}</span>`);
    return out.length ? `<span class="twl">${out.join('')}</span>` : '';
  }

  // the content of the widget for one row: { html, bg?, color? }
  function rowHtml(r, opt) {
    if (!r) return { html: '–' };
    const lk = look(opt), colour = colorOf(opt, r.level === 'out' ? 'crit' : r.level), out = r.level === 'out' && !r.fitting ? { bg: '#4a1f22' } : {}; // (worn out: the widget turns dark red)
    if (lk === 'cell') return { html: cellHtml(r), ...out };
    if (lk === 'number') { // one line: the percentage and what is left (and BOX when it is worn out)
      const parts = [];
      if (optOf(opt, 'showPct') !== false) parts.push(`${r.shown}%`);
      if (optOf(opt, 'showLeft') !== false && !(r.level === 'out' && optOf(opt, 'showBox') !== false)) parts.push(r.leftText);
      if (r.level === 'out' && optOf(opt, 'showBox') !== false) parts.push('BOX');
      if (!parts.length) parts.push(`${r.shown}%`);
      const sub = [optOf(opt, 'showName') === true ? esc(r.tyre) : '', optOf(opt, 'showGrip') !== false && r.effect !== null && r.effect !== undefined ? `grip ${esc(r.effectText)}` : ''].filter(Boolean).join(' · ');
      return { html: `<span class="twn" style="color:${colour}">${esc(parts.join(' · '))}${sub ? `<small>${sub}</small>` : ''}</span>`, ...out };
    }
    if (lk === 'bar') {
      const vert = optOf(opt, 'dir') === 'vertical', th = clampInt(optOf(opt, 'thick'), 10, 100, 60), size = Math.round(Math.max(0, Math.min(100, r.life)) * 10) / 10;
      const box = r.level === 'out' && optOf(opt, 'showBox') !== false, pct = optOf(opt, 'showPct') !== false ? `${r.shown}%` : '', left = optOf(opt, 'showLeft') !== false && !box ? r.leftText : '';
      // a bar that stands up is narrow: one short thing in it (BOX, the percentage, or what is left); a lying bar has room for all of them
      const txt = vert ? (box ? 'BOX' : pct || left) : [pct, left, box ? 'BOX' : ''].filter(Boolean).join(' · ');
      const bar = `<span class="fbar${vert ? ' fv' : ''}" style="--th:${th}"><span class="ffill" style="${vert ? 'height' : 'width'}:${size}%;background:${colour}"></span>${txt ? `<span class="ftxt">${esc(txt)}</span>` : ''}</span>`;
      return { html: vert ? bar : `<span class="twbarw"><span class="twchip2" style="border-color:${r.color};color:${r.color}">${esc(letterOf(r.code))}</span>${bar}</span>`, ...out };
    }
    const pic = lk === 'ring' ? `<span class="twringw">${ringSvg(r.life, colour)}<span class="twinner">${inner(r.code, opt)}</span></span>` : wearSvg(r.code, r.life, 'twpic');
    return { html: `<span class="twbox2">${pic}${lines(r, opt, true)}</span>`, ...out };
  }

  // the content for the car of a lane: c is the car of the race, S the race the widgets are drawn from (S.eng), t the clock
  function content(opt, c, S, t) {
    const eng = S && S.eng; if (!eng || !eng.tyrewear || !c) return { html: '–' };
    const v = Tw.view(eng, [c.lane], t);
    return rowHtml(v.rows[0], opt);
  }

  // ---- the made-up values of the layout editor ----
  const SAMPLE_LIFE = [100, 62, 35, 12, 0], SAMPLE_TYRES = ['S', 'M', 'H', 'SS', 'S'];
  function sampleRow(l) {
    const k = l % SAMPLE_LIFE.length, life = SAMPLE_LIFE[k], code = SAMPLE_TYRES[k], ty = Wx.tyreOf(code), cfg = { warn: 25, crit: 10 }, eff = [5, 2, 0, -9, -30][k];
    return { lane: l, code, tyre: ty.name, color: ty.color, life, shown: Tw.shownLife(life), level: Tw.levelOf(cfg, life), effect: eff, effectText: Tw.effectText(eff), leftText: `${Math.ceil(life / 4.5)} laps`, lapsLeft: life / 4.5, fitting: null, fitLeft: null, stops: 0 };
  }
  const sample = (l, w) => rowHtml(sampleRow(l), (w && w.opt) || {}).html;

  // ---- the Available Tyres widget (1.41.0): the sets that are left of every tyre ----
  const SET_LOOKS = [['tyres', 'Tyres with a number'], ['dots', 'Tyres with a dot for each set (full = still in the box)'], ['list', 'A list'], ['number', 'A number only (7 sets left)']];
  const setLook = o => (o && o.look) || 'tyres';
  const hasTyres = o => ['tyres', 'dots'].includes(setLook(o));
  const SETS_OPTIONS = [
    { key: 'imageSet', label: 'Picture set (made under Customization > Image Settings)', type: 'imageset', kind: 'tyres', noneLabel: 'None (the tyres are drawn)', default: '' },
    { key: 'look', label: 'Show the sets as', type: 'select', default: 'tyres', rerender: true, choices: SET_LOOKS },
    { key: 'showRing', label: 'Ring on the tyre that is on the car', type: 'checkbox', default: true, show: hasTyres },
    { key: 'showNext', label: 'NEXT on the tyre that goes on at the next stop (the one the Race Director queued, or the one the weather asks for)', type: 'checkbox', default: true, show: hasTyres },
    { key: 'dim', label: 'Dim a tyre with no sets left', type: 'checkbox', default: true },
    { key: 'hideNo', label: 'Hide the tyres this race does not allow (0 sets)', type: 'checkbox', default: false },
    { key: 'showTeam', label: 'Show the team name when the sets are shared', type: 'checkbox', default: true }
  ];
  const SETS_DEFAULTS = Object.fromEntries(SETS_OPTIONS.map(o => [o.key, o.default]));
  const sopt = (opt, k) => (opt && opt[k] !== undefined ? opt[k] : SETS_DEFAULTS[k]);
  const andList = list => (list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}` : list[0] || '');
  // r: a row of TyreWear.view with sets (the sets left of every tyre, setsStart: how many there were), own (the tyre it races on), code (the tyre on the car), next ({ code, kind }), setsTotal, setsMode, teamName, teamDrivers
  function setsRowHtml(r, opt) {
    if (!r) return { html: '–' };
    if (!r.sets) return { html: '<span class="twavn">No limit on the sets</span>' };
    const lk = SET_LOOKS.some(x => x[0] === setLook(opt)) ? setLook(opt) : 'tyres', start = r.setsStart || {};
    const dim = sopt(opt, 'dim') !== false, next = sopt(opt, 'showNext') !== false && r.next && r.next.kind !== 'same' ? r.next.code : '', ring = sopt(opt, 'showRing') !== false;
    const team = sopt(opt, 'showTeam') !== false && r.setsMode === 'team' && r.teamName ? `<span class="twav-team"><small>Shared by</small><b>${esc(r.teamName)}</b>${r.teamDrivers && r.teamDrivers.length ? `<small>${esc(andList(r.teamDrivers))}</small>` : ''}</span>` : '';
    const tyres = Wx.TYRES.filter(t => !(sopt(opt, 'hideNo') === true && Number(start[t.code]) === 0)), zero = t => !(r.sets[t.code] > 0);
    const pic = t => `<span class="twav-c${ring && t.code === r.code && lk !== 'list' ? ' on' : ''}" style="--tc:${t.color}">${Ww.icon('tyre', t.code, opt && opt.tyreImages, 0, false)}</span>`;
    let body;
    if (lk === 'number') {
      const n = r.setsTotal, cnt = Math.max(0, Number(n) || 0);
      body = `<span class="twav-big"><b>${cnt}</b><span>${cnt === 1 ? 'set' : 'sets'} left</span></span>`;
    } else if (lk === 'list') {
      body = `<span class="twav-list">${tyres.map(t => `<span class="twav-row${dim && zero(t) ? ' zero' : ''}">${pic(t)}<span class="twav-nm">${esc(t.name)}</span><b>${r.sets[t.code]}</b></span>`).join('')}</span>`;
    } else {
      body = `<span class="twav-row2">${tyres.map(t => {
        const n = Math.max(0, Number(r.sets[t.code]) || 0), tot = Math.max(n, Number(start[t.code]) || 0);
        const under = lk === 'dots' ? `<span class="twav-dots">${Array.from({ length: Math.min(tot, 8) }, (_, i) => `<i class="${i < n ? 'f' : ''}"></i>`).join('')}</span>` : `<b class="twav-n">${n}</b>`;
        return `<span class="twav-t${dim && zero(t) ? ' zero' : ''}" data-tyre="${t.code}">${next === t.code ? '<em class="twav-next">NEXT</em>' : ''}${pic(t)}${under}</span>`;
      }).join('')}</span>`;
    }
    return { html: `<span class="twav${team ? ' withteam' : ''}">${team}${body}</span>` };
  }
  // the content for the car of a lane: the sets of its box (the box of the team when the sets are shared)
  function setsContent(opt, c, S, t) {
    const eng = S && S.eng; if (!eng || !eng.tyrewear || !c) return { html: '–' };
    return setsRowHtml(Tw.view(eng, [c.lane], t).rows[0], opt);
  }
  // made-up values of the layout editor: a Soft on the car, a Supersoft queued, no Wet sets left
  function setsSampleRow(l) {
    const sets = { H: 2, M: 1, S: 1, SS: 1, INT: 2, W: 0 }, start = { H: 2, M: 2, S: 2, SS: 1, INT: 2, W: 2 }, k = l % 2;
    return { lane: l, code: 'S', own: 'S', sets, setsStart: start, setsTotal: Tw.setsTotal(sets), setsMode: k ? 'team' : 'car', teamName: k ? 'Team Red' : '', teamDrivers: k ? ['Dutch', 'Maria'] : [], next: { code: 'SS', kind: 'queued' }, queued: 'SS', fitting: null };
  }
  const setsSample = (l, w) => setsRowHtml(setsSampleRow(l), (w && w.opt) || {}).html;

  // ---- one cell in a table: the Driver stats grid and the Leaderboard (a small tyre chip, the life, a mini bar; amber and red follow the warning levels) ----
  function cellHtml(r) {
    if (!r) return '–';
    const col = colorOf(null, r.level === 'out' ? 'crit' : r.level);
    return `<span class="twcell tw-${esc(r.level)}"><span class="twchip2" style="border-color:${r.color};color:${r.color}">${esc(letterOf(r.code))}</span><b style="color:${col}">${r.shown}%</b><span class="twmini"><i style="width:${Math.max(0, Math.min(100, r.life)).toFixed(1)}%;background:${col}"></i></span></span>`;
  }
  // the text of the cell for a place that wants plain text (a PDF, a text widget): "S 62%", "–" when the race has no tyre wear
  const cellText = r => (r ? `${letterOf(r.code)} ${r.shown}%` : '–');

  const api = { SETS_OPTIONS, SET_LOOKS, SETS_DEFAULTS, setsRowHtml, setsContent, setsSampleRow, setsSample, OPTIONS, LOOKS, DEFAULTS, wearSvg, ringSvg, lines, rowHtml, content, sampleRow, sample, cellHtml, cellText, look };
  root.TyreWidgets = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
