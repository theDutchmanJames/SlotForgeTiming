// The weather widgets: Tyres (the tyre a lane's car is on), Weather Forecast (the weather now and what comes next) and Track Conditions (track and air
// temperature, wind speed and direction). Pure: what they show is worked out from the race and the settings, and drawn as small pictures (SVG) when there is
// no picture set (Customization > Image Settings: Tyres, Weather and Conditions sets). The register of the widgets (widgets.js) takes the options and the
// samples from here, the page that draws the widgets (timing.js) takes the content.
(function (root) {
  const Wx = typeof module !== 'undefined' ? require('./weather.js') : root.Wx;
  const esc = x => String(x ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const PM = typeof module !== 'undefined' ? require('./picmemo.js') : root.PicMemo; // the text of a picture is built once (1.60.2)
  const SITE_PIC = PM.site();
  const cap = s => s[0].toUpperCase() + s.slice(1);
  // black or white text, whichever reads better on a colour like #e8002d
  const onColor = hex => { const m = /^#([0-9a-f]{6})$/i.exec(String(hex || '')); if (!m) return '#fff'; const n = parseInt(m[1], 16), l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; return l > 0.6 ? '#000' : '#fff'; };
  const SET_OPTION = (kind, none) => ({ key: 'imageSet', label: 'Picture set (made under Customization > Image Settings)', type: 'imageset', kind, noneLabel: none, default: '' });

  // ---- the pictures that are drawn when there is no picture set ----
  const svg = (label, cls, view, inner, style) => `<svg class="${cls}" viewBox="${view}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(label)}"${style ? ` style="${style}"` : ''}>${inner}</svg>`;
  // a tyre: the black rubber with its tread, the ring in the colour of the compound (the colours of Formula 1) and the letter in the middle
  function tyreSvg(code, cls) {
    const t = Wx.tyreOf(code) || Wx.tyreOf(Wx.DEFAULT_TYRE), letter = t.code === 'INT' ? 'I' : t.code;
    const tread = Array.from({ length: 16 }, (_, i) => { const a = i * Math.PI / 8, x1 = 50 + 40 * Math.cos(a), y1 = 50 + 40 * Math.sin(a), x2 = 50 + 47 * Math.cos(a), y2 = 50 + 47 * Math.sin(a); return `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`; }).join('');
    return svg(`${t.name} tyres`, cls, '0 0 100 100',
      `<circle cx="50" cy="50" r="47" fill="#1b1d22" stroke="#000" stroke-width="2"/><path d="${tread}" stroke="#3b3f47" stroke-width="3.5" fill="none"/>`
      + `<circle cx="50" cy="50" r="31" fill="#2a2d34"/><circle cx="50" cy="50" r="31" fill="none" stroke="${t.color}" stroke-width="8"/>`
      + `<text x="50" y="51" text-anchor="middle" dominant-baseline="central" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${letter.length > 1 ? 24 : 30}" fill="${t.color}">${esc(letter)}</text>`);
  }
  const CLOUD = 'M14 36h20a8 8 0 0 0 1.2-15.9A11 11 0 0 0 13.9 23 7 7 0 0 0 14 36z';
  const rays = (cx, cy, r1, r2, color, w) => `<g stroke="${color}" stroke-width="${w}" stroke-linecap="round">${Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4, f = n => n.toFixed(1); return `<line x1="${f(cx + r1 * Math.cos(a))}" y1="${f(cy + r1 * Math.sin(a))}" x2="${f(cx + r2 * Math.cos(a))}" y2="${f(cy + r2 * Math.sin(a))}"/>`; }).join('')}</g>`;
  const cloud = (extra, transform) => `<path d="${CLOUD}" fill="#cdd5e0" stroke="#8691a3" stroke-width="1.6" stroke-linejoin="round"${transform ? ` transform="${transform}"` : ''}${extra || ''}/>`;
  // the weather: the sun (Dry), a cloud (Cloudy), a cloud with rain (Wet), the sun coming out from behind a cloud (Clearing)
  function stateSvg(state, cls) {
    const name = Wx.stateName(state);
    if (state === 'cloudy') return svg(name, cls, '0 0 48 48', cloud('', 'translate(0 -2)'));
    if (state === 'wet') return svg(name, cls, '0 0 48 48', `${cloud('', 'translate(0 -5)')}<g stroke="#3b82f6" stroke-width="3" stroke-linecap="round"><path d="M17 36l-2 6M25 36l-2 6M33 36l-2 6"/></g>`);
    if (state === 'clearing') return svg(name, cls, '0 0 48 48', `<circle cx="17" cy="17" r="7" fill="#ffc400"/>${rays(17, 17, 11, 15, '#ffc400', 2.6)}${cloud('', 'translate(8 6) scale(.8)')}`);
    return svg(name, cls, '0 0 48 48', `<circle cx="24" cy="24" r="9" fill="#ffc400"/>${rays(24, 24, 14, 19, '#ffc400', 3)}`);
  }
  const THERMO = (x, y, k) => `<g transform="translate(${x} ${y}) scale(${k})"><path d="M20 6a4 4 0 0 1 8 0v20.5a8 8 0 1 1-8 0z" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/><circle cx="24" cy="35" r="4.2" fill="#e8002d"/><rect x="22.6" y="14" width="2.8" height="21" fill="#e8002d"/></g>`;
  // the conditions: track temperature (a thermometer by a road), air temperature (a thermometer), wind speed (three curls of wind), wind direction (an arrow that points the way the wind blows)
  function condSvg(kind, dir, cls) {
    const label = { tracktemp: 'Track temperature', airtemp: 'Air temperature', windspeed: 'Wind speed', winddir: 'Wind direction' }[kind] || kind;
    if (kind === 'tracktemp') return svg(label, cls, '0 0 48 48', `<path d="M4 44h28L27 12H9z" fill="#6b7280"/><path d="M18 44V12" stroke="#fff" stroke-width="2" stroke-dasharray="5 4"/>${THERMO(20, 0, 0.95)}`);
    if (kind === 'airtemp') return svg(label, cls, '0 0 48 48', THERMO(0, 0, 1));
    if (kind === 'windspeed') return svg(label, cls, '0 0 48 48', '<g transform="translate(4 6) scale(1.7)" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9.6 4.6A2 2 0 1 1 11 8H2m10.6 11.4A2 2 0 1 0 14 16H2m15.7-8.3A2.5 2.5 0 1 1 19.5 12H2"/></g>');
    return svg(label, cls, '0 0 48 48', '<path d="M24 5l12 33-12-8-12 8z" fill="currentColor"/>', `transform:rotate(${rotationOf(dir)}deg)`);
  }
  // the arrow points the way the wind blows: the opposite of where it comes from (a wind from the north, 0 degrees, blows to the south)
  const rotationOf = dir => (((Math.round(Number(dir)) || 0) + 180) % 360 + 360) % 360;
  const pic = (src, alt, cls, style) => PM.once(SITE_PIC, [src, alt, cls, style || ''], () => `<img class="${cls}" src="${esc(src)}" alt="${esc(alt)}"${style ? ` style="${style}"` : ''}>`);
  // an icon from a picture set when it has the picture, else the drawn one. solo: one picture that fills the widget (the flag widget does the same); else a small icon in a line of text.
  const icon = (kind, key, images, dir, solo) => {
    const src = images && images[key], cls = solo ? (src ? 'flagimg' : 'flagsvg') : 'wxic', rot = kind === 'cond' && key === 'winddir' ? `transform:rotate(${rotationOf(dir)}deg)` : '';
    const alt = kind === 'tyre' ? `${Wx.tyreName(key)} tyres` : kind === 'state' ? Wx.stateName(key) : ({ tracktemp: 'Track temperature', airtemp: 'Air temperature', windspeed: 'Wind speed', winddir: 'Wind direction' }[key] || '');
    if (src) return pic(src, alt, cls, rot);
    return kind === 'tyre' ? tyreSvg(key, cls) : kind === 'state' ? stateSvg(key, cls) : condSvg(key, dir, cls);
  };
  // the standard picture of a slot of a picture set (the set editor shows it dimmed where there is no picture of your own)
  const slotIcon = (kind, key) => icon(kind === 'tyres' ? 'tyre' : kind === 'weather' ? 'state' : 'cond', key, null, 0, false);

  // ---- the settings of the widgets ----
  const TYRE_OPTIONS = [SET_OPTION('tyres', 'None (the tyres are drawn)'),
    { key: 'tyreShow', label: 'Show the tyres as', type: 'select', default: 'icon', choices: [['icon', 'A picture of the tyre'], ['name', 'Its name (Soft), in the colour of the tyre'], ['both', 'A picture and its name']] },
    { key: 'tyreWarn', label: 'When the car has to change tyres, say so and turn amber', type: 'checkbox', default: true }];
  const FORECAST_OPTIONS = [SET_OPTION('weather', 'None (the weather is drawn)'),
    { key: 'show', label: 'Show the weather as', type: 'select', default: 'both', choices: [['icon', 'A picture'], ['text', 'Text'], ['both', 'A picture and text']] },
    { key: 'showNext', label: 'Show what comes next and when ("Rain in 3 laps"; nothing when the Race Director decides)', type: 'checkbox', default: true }];
  const OWN_ITEMS = [['track', 'Track temperature'], ['air', 'Air temperature'], ['wind', 'Wind speed'], ['dir', 'Wind direction (degrees)']];
  const ownKey = (state, item) => 'own' + cap(state) + cap(item);
  // the numbers of the widget itself, when it does not use the weather system: they are in the units that are shown; the standard is the standard of the weather system, in those units
  const ownDefault = (state, item, opt) => Math.round(Wx.toUnits(item, Wx.COND[state][item], 'metric', Wx.unitsOf(null, opt && opt.units)));
  const ownOf = (opt, units) => {
    const out = {}; Wx.STATES.forEach(([s]) => { out[s] = {}; OWN_ITEMS.forEach(([item]) => { const v = opt && opt[ownKey(s, item)]; out[s][item] = v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : Math.round(Wx.toUnits(item, Wx.COND[s][item], 'metric', units)); }); });
    return out;
  };
  const COND_OPTIONS = [SET_OPTION('conditions', 'None (the icons are drawn)'),
    { key: 'values', label: 'The values come from', type: 'select', default: 'system', rerender: true, choices: [['system', 'The weather system of the race'], ['own', 'My own values (below)']] },
    { key: 'units', label: 'Units', type: 'select', default: 'system', rerender: true, choices: [['system', 'As the weather system says'], ['metric', 'Celsius and km/h'], ['imperial', 'Fahrenheit and mph']], hint: 'Without a weather system: Celsius and km/h.' },
    { key: 'showTrack', label: 'Show the track temperature', type: 'checkbox', default: true },
    { key: 'showAir', label: 'Show the air temperature', type: 'checkbox', default: true },
    { key: 'showWind', label: 'Show the wind speed', type: 'checkbox', default: true },
    { key: 'showDir', label: 'Show the wind direction', type: 'checkbox', default: true },
    { key: 'showDegrees', label: 'Show the wind direction in degrees too (SW 225°)', type: 'checkbox', default: false },
    { key: 'layout', label: 'Put them', type: 'select', default: 'row', choices: [['row', 'In a row'], ['column', 'In a column'], ['grid', 'Two by two']] },
    { key: 'ownnote', type: 'note', label: 'Your own values, for every state of the weather. They are in the units chosen above. The wind direction is where the wind comes from: 0 north, 90 east, 180 south, 270 west.', show: o => o.values === 'own' },
    ...Wx.STATES.flatMap(([s, sn]) => OWN_ITEMS.map(([item, name]) => ({ key: ownKey(s, item), label: `${sn}: ${name.toLowerCase()}`, type: 'number', min: item === 'wind' || item === 'dir' ? 0 : -60, ...(item === 'dir' ? { max: 359 } : {}), step: 1, default: ownDefault(s, item, null), defaultOf: o => ownDefault(s, item, o), show: o => o.values === 'own' })))];

  // ---- what the widgets show ----
  const tyreInner = (code, opt, solo) => icon('tyre', Wx.cleanTyre(code), opt && opt.tyreImages, 0, solo);
  // the Tyres widget: the tyre of the car of the lane (the tyre of its Slotcar until a pit stop changes it); amber, with a word, when the car has to change
  function tyreContent(opt, c, S) {
    opt = opt || {}; const eng = S.eng, code = Wx.cleanTyre(c.tyre), t = Wx.tyreOf(code), show = ['icon', 'name', 'both'].includes(opt.tyreShow) ? opt.tyreShow : 'icon';
    const todo = eng.weather && opt.tyreWarn !== false ? Wx.need(eng.wxState || 'dry', c.tyre, c.tyreOwn) : '';
    const warn = todo ? { bg: '#ffb300', color: '#000' } : null, word = todo ? `<small>Change tyres</small>` : '';
    if (show === 'name') return { html: todo ? `<span class="wxt ctr">${esc(t.name)}${word}</span>` : esc(t.name), ...(warn || { bg: t.color, color: onColor(t.color) }) };
    if (show === 'both') return { html: `<span class="wxw">${tyreInner(code, opt, false)}<span class="wxt">${esc(t.name)}${word}</span></span>`, ...(warn || {}) };
    return { html: todo ? `<span class="wxw">${tyreInner(code, opt, false)}<span class="wxt">Change<small>tyres</small></span></span>` : tyreInner(code, opt, true), ...(warn || {}) };
  }
  // the Weather Forecast widget: the weather now, and (when the forecast decides) the next change and when it comes
  function forecastContent(opt, S, t) {
    opt = opt || {}; const o = Wx.outlook(S.eng, t) || { state: 'dry', name: Wx.stateName('dry'), next: null }, show = ['icon', 'text', 'both'].includes(opt.show) ? opt.show : 'both';
    const next = opt.showNext !== false && o.next ? o.next.text : '';
    if (show === 'icon') return { html: icon('state', o.state, opt.stateImages, 0, true) };
    const text = `<span class="wxt">${esc(o.name)}${next ? `<small>${esc(next)}</small>` : ''}</span>`;
    return { html: show === 'text' ? text : `<span class="wxw">${icon('state', o.state, opt.stateImages, 0, false)}${text}</span>` };
  }
  // the conditions that belong to the widget now: { units, state, track, air, wind, dir } or null
  function conditionsOf(opt, eng) {
    opt = opt || {}; const cfg = eng.weather || null, state = eng.wxState || 'dry', want = opt.units;
    return opt.values === 'own' ? Wx.conditionsFor(cfg, state, ownOf(opt, Wx.unitsOf(cfg, want)), want) : Wx.conditionsFor(cfg, state, null, want);
  }
  // the Track Conditions widget: icons with the track temperature, the air temperature, the wind speed and the direction of the wind
  function conditionsContent(opt, S) {
    opt = opt || {}; const c = conditionsOf(opt, S.eng); if (!c) return { html: '–' };
    return { html: conditionsHtml(c, opt) };
  }
  function conditionsHtml(c, opt) {
    const tx = Wx.condText(c), imgs = opt && opt.condImages, layout = ['row', 'column', 'grid'].includes(opt && opt.layout) ? opt.layout : 'row', on = k => !(opt && opt[k] === false);
    const items = [];
    if (on('showTrack')) items.push(['tracktemp', tx.track]);
    if (on('showAir')) items.push(['airtemp', tx.air]);
    if (on('showWind')) items.push(['windspeed', tx.wind]);
    if (on('showDir')) items.push(['winddir', opt && opt.showDegrees ? `${tx.dir} ${tx.degrees}` : tx.dir]);
    if (!items.length) return '–';
    return `<span class="cdw cd-${layout}">${items.map(([k, t]) => `<span class="cdi">${icon('cond', k, imgs, c.dir, false)}<span class="cdt">${esc(t)}</span></span>`).join('')}</span>`;
  }
  // the {variables} of the custom text widgets and the rules of the custom image widgets (a dash when there is nothing)
  function laneVars(c) { return { tyre: c ? Wx.tyreName(c.tyre) : '–' }; }
  function raceVars(eng, t) {
    const o = eng.weather ? Wx.outlook(eng, t) : null, tx = Wx.condText(eng.weather ? Wx.conditionsFor(eng.weather, eng.wxState || 'dry', null, '') : null);
    return { weather: o ? o.name : '–', nextweather: o && o.next ? o.next.text : '', tracktemp: tx.track, airtemp: tx.air, windspeed: tx.wind, winddir: tx.dir };
  }
  // what the layout editor shows (the made-up values of a lane or of a race)
  const SAMPLE_TYRES = ['S', 'M', 'H', 'SS', 'INT', 'W'];
  function tyreSample(l, opt) {
    const code = SAMPLE_TYRES[l % SAMPLE_TYRES.length], t = Wx.tyreOf(code), show = ['icon', 'name', 'both'].includes(opt && opt.tyreShow) ? opt.tyreShow : 'icon';
    if (show === 'name') return `<span class="tyrechip" style="background:${t.color};color:${onColor(t.color)}">${esc(t.name)}</span>`;
    return show === 'both' ? `<span class="wxw">${tyreInner(code, opt, false)}<span class="wxt">${esc(t.name)}</span></span>` : tyreInner(code, opt, true);
  }
  function forecastSample(opt) {
    opt = opt || {}; const show = ['icon', 'text', 'both'].includes(opt.show) ? opt.show : 'both', next = opt.showNext !== false ? '<small>Clearing in 3 laps</small>' : '';
    if (show === 'icon') return icon('state', 'wet', opt.stateImages, 0, true);
    const text = `<span class="wxt">Wet${next}</span>`;
    return show === 'text' ? text : `<span class="wxw">${icon('state', 'wet', opt.stateImages, 0, false)}${text}</span>`;
  }
  function conditionsSample(opt) {
    opt = opt || {}; const own = opt.values === 'own', want = opt.units, cfg = null;
    const c = own ? Wx.conditionsFor(cfg, 'dry', ownOf(opt, Wx.unitsOf(cfg, want)), want) : Wx.conditionsFor({ cond: Wx.clean({}).cond }, 'dry', null, want);
    return conditionsHtml(c, opt);
  }

  // A weather widget whose picture and text are bigger than the widget (a small widget, a longer word such as "Cloudy" or "Clearing", "Rain in 3 laps" under it) is made smaller,
  // just enough to fit, so nothing is pushed out of the widget (1.16.1). It scales with the font size, so the picture and the small line shrink with the text. Works in the browser only:
  // it measures the page. measure(el, val) -> { boxW, boxH, w, h } (the room in the widget, the room the content needs) can be replaced, to test.
  const FIT_CLASS = /(^|\s)(wxw|wxt)(\s|$)/; // (the picture and text of the Forecast and Tyres widgets; the Track Conditions row wraps by itself)
  const measureFit = (el, val) => {
    const r = document.createRange(); r.selectNodeContents(el); const b = r.getBoundingClientRect(), cs = typeof getComputedStyle === 'function' ? getComputedStyle(val) : null, px = k => (cs ? parseFloat(cs[k]) || 0 : 0);
    return { boxW: val.clientWidth - px('paddingLeft') - px('paddingRight'), boxH: val.clientHeight - px('paddingTop') - px('paddingBottom'), w: b.width, h: b.height };
  };
  function fit(val, measure) {
    const el = val && val.firstElementChild; if (!el || !FIT_CLASS.test(String(el.className || ''))) return;
    el.style.fontSize = '';
    const m = (measure || measureFit)(el, val);
    if (m.boxW > 0 && m.boxH > 0 && (m.w > m.boxW + 0.5 || m.h > m.boxH + 0.5)) el.style.fontSize = `${Math.max(20, Math.floor(Math.min(m.boxW / m.w, m.boxH / m.h) * 100))}%`;
  }
  // every value box in root that holds a weather widget
  function fitAll(root, measure) {
    if (!root || !root.querySelectorAll) return;
    Array.from(root.querySelectorAll('.lw-val')).forEach(v => fit(v, measure));
  }

  const api = { picSite: SITE_PIC, TYRE_OPTIONS, FORECAST_OPTIONS, COND_OPTIONS, OWN_ITEMS, ownKey, ownOf, tyreSvg, stateSvg, condSvg, rotationOf, icon, slotIcon, tyreContent, forecastContent, conditionsContent, conditionsOf, conditionsHtml, laneVars, raceVars, tyreSample, forecastSample, conditionsSample, onColor, fit, fitAll };
  root.WxW = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
