// The widget register, the layout geometry (moving, resizing, snapping) and the built-in default layout.
// The layout editor and the live timing page both read their widget list from REGISTRY.
(function (root) {
  const U = 1000;   // a layout is always 1000 units wide; its height follows the proportions
  const GRID = 5;   // grid size in units
  const LANES = 8;  // most lanes a layout can use
  const MAG = 3;    // how close (in units) another widget's edge pulls a moving widget (it was 8 before 1.46.1, wider than one grid step)
  const MIN = 5;    // smallest widget size (one grid step: 0.5% of the width; it was 40 before 1.34.1)

  const PM = typeof module !== 'undefined' ? require('./picmemo.js') : root.PicMemo; // the text of a picture is built once (1.60.2)
  const link = src => (PM && typeof PM.link === 'function' ? PM.link(src) : src); // a big picture as a short link, once the app has switched that on (1.60.6, picmemo.js): the page is not given the picture itself
  const SITE_AV = PM.site(), SITE_IMG = PM.site(), SITE_FLAG = PM.site(), SITE_FUEL = PM.site(), SITE_LIGHTS = PM.site();
  const Dl = typeof module !== 'undefined' ? require('./delta.js') : root.Delta; // the Delta Timers (what is compared, and the badge)
  const Bo = typeof module !== 'undefined' ? require('./boardorder.js') : root.BoardOrder; // the order of a leaderboard (Order by)
  const Ww = typeof module !== 'undefined' ? require('./weatherwidgets.js') : root.WxW; // Weather widget options
  const Tyw = typeof module !== 'undefined' ? require('./tyrewidgets.js') : root.TyreWidgets; // Tyre Wear widget options
  const Pw = typeof module !== 'undefined' ? require('./pacewidgets.js') : root.PaceW; // Push & Save widget options
  const Re = typeof module !== 'undefined' ? require('./engine.js') : root.RaceEngine; // the one way a time is written
  const Ds = typeof module !== 'undefined' ? require('./distance.js') : root.Distance; // Distance Racing: the distance widgets (the options, the words)
  const Aio = typeof module !== 'undefined' ? require('./allinone.js') : root.AllInOne;
  const Stw = typeof module !== 'undefined' ? require('./strategywidgets.js') : root.StrategyWidgets;
  const Pcw = typeof module !== 'undefined' ? require('./pitwidgets.js') : root.PitWidgets;
  const T = (type, label, group, o) => ({ type, label, group, perLane: false, w: 150, h: 60, textSize: 30, options: [], button: false, ...o, ...(o.button ? {} : {sample:runtimeSample(type)}) });
  const TIME_OPTIONS = [
    { key: 'holdSeconds', label: 'Show finished lap for (seconds)', type: 'number', default: 3 }
  ];

  const esc = x => String(x ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // A colour that is put into a style: only plain colour text (#fa0, rgb(1,2,3), var(--accent), a name) gets through, so a damaged or imported file can never add anything else to the page.
  const cssVal = v => { const t = String(v ?? '').trim(); return /^[#\w\s.,%()-]{1,60}$/.test(t) && !/url|expression|import|@/i.test(t) ? t : ''; };
  const frameModule = () => typeof module !== 'undefined' ? require('./frame.js') : root.Frame;
  const clampInt = (v, lo, hi, dflt) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt; };

  // Last lap: newest first, top-left; fills a column from the top, then continues in the next column.
  const LAST_OPTIONS = [
    { key: 'lapsPerColumn', label: 'Laps per column', type: 'number', default: 1, min: 1, max: 30, step: 1 },
    { key: 'columns', label: 'Columns (1 to 3)', type: 'number', default: 1, min: 1, max: 3, step: 1 },
    { key: 'lapNumbers', label: 'Show lap numbers (when more than one lap is shown)', type: 'checkbox', default: true }
  ];
  // items: lap times as text, or { n: lap number, t: text }
  function lapListHtml(items, perColumn, columns, numbers = true) {
    const per = clampInt(perColumn, 1, 30, 1), cols = clampInt(columns, 1, 3, 1), shown = items.slice(0, per * cols);
    if (!shown.length) return '–';
    if (per * cols === 1) return esc(shown[0] && shown[0].t !== undefined ? shown[0].t : shown[0]); // one lap: plain text
    const rows = Math.min(per, shown.length);
    return `<span class="ll" style="grid-template-rows:repeat(${rows},auto);grid-template-columns:repeat(${Math.ceil(shown.length / rows)},auto)">${shown.map(it => `<span class="lli">${numbers && it.n !== undefined ? `<span class="lln">${esc(it.n)}</span>` : ''}${esc(it.t !== undefined ? it.t : it)}</span>`).join('')}</span>`;
  }

  // Custom text widgets: a line of text with {variables}. Unknown {words} stay as typed so a typo is easy to see.
  const TEXT_LANE_VARS = [['name', 'Driver name'], ['nickname', 'Nickname'], ['callsign', 'Callsign'], ['team', 'Team name'], ['car', 'Slotcar'], ['lane', 'Lane number'], ['position', 'Position'], ['lap', 'Current lap'], ['laps', 'Laps completed'],
    ['laptime', 'Current lap time'], ['last', 'Last lap'], ['best', 'Best lap'], ['avg', 'Average lap'], ['median', 'Median lap'], ['record', 'Personal record lap'], ['gap', 'Gap to leader'],
    ['fuel', 'Fuel left (litres)'], ['fuelpct', 'Fuel left (%)'], ['bop', 'Balance of Power (\u221220% hindered, +10% helped, a dash when it is off)'], ['penpoints', 'Penalty points'], ['pentime', 'Penalty time'], ['champ', 'Championship points'], ['pits', 'Pit stops made'], ['tyre', 'Tyres of the car (Soft, Wet...)'], ['pit', 'Last pit stop time'], ['speed', 'Speed (scaled km/h)'], ['speedreal', 'Speed (real km/h)'],
    ['damage', 'Damage points (Damage System)'], ['damagelevel', 'Damage level (Light damage, Heavy damage...)'], ['repairs', 'Repairs made (Damage System)'], ['failure', 'Car failure now (Slow Puncture; No failure; a dash in a race without Car Failures)'], ['failures', 'Failures the car has had (Car Failures)'],
    ['distance', 'Distance driven (84 m), or the lane has no length: a dash'], ['distleft', 'Distance to go to the finish (19 m; a dash in a race with no laps or distance)'], ['lapstogo', 'Laps to go (a dash in a race with no laps or distance)'],
    ['nextdriver', 'Next driver of the team (Endurance Race)'], ['swap', 'Time to the next driver swap (Endurance Race)'], ['stint', 'How long the driver has been at the wheel (Endurance Race)']];
  const TEXT_RACE_VARS = [['clock', 'Race clock (counting up)'], ['timeleft', 'Time left'], ['lapsleft', 'Laps left'], ['lapstotal', 'Lap limit'], ['racedistance', 'Distance of the race (a dash when the race is not set to a distance)'], ['leader', 'Leader'], ['flag', 'Flag / race state'], ['heat', 'Heat'],
    ['track', 'Track name'], ['session', 'Race setup name'], ['type', 'Session type'], ['sessionrecord', 'Session record lap'], ['sessionrecordby', 'Session record driver'], ['trackrecord', 'Track record lap'], ['trackrecordby', 'Track record driver'], ['yellowtarget', 'Yellow flag target lap time (empty when there is none)'],
    ['weather', 'Weather now (Dry, Cloudy, Wet, Clearing; a dash without a weather system)'], ['nextweather', 'The next change of the weather and when (Rain in 3 laps; empty when there is none)'], ['tracktemp', 'Track temperature (30 \u00B0C)'], ['airtemp', 'Air temperature (24 \u00B0C)'], ['windspeed', 'Wind speed (10 km/h)'], ['winddir', 'Wind direction (SW)']];
  const TEXT_LANE_DEFAULT = '{position}. {name}  {best}', TEXT_RACE_DEFAULT = '{timeleft} left';
  const fillText = (text, vars) => esc(String(text ?? '')).replace(/\{(\w+)\}/g, (m, k) => (Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k] ?? '') : m));
  const textOpts = (vars, dflt) => [{ key: 'text', label: 'Text, with {variables}', type: 'text', default: dflt }, { key: 'vars', label: 'Variables: ' + vars.map(v => '{' + v[0] + '} ' + v[1]).join(', '), type: 'note' }];

  // The start lights: five circles drawn as one picture that scales to the widget, so they stay round at any size or shape.
  // pics: { on, off } pictures from a picture set (a light without a picture is drawn as a plain circle)
  // pics: { on, off } (one lit and one unlit picture for all five lights), or { pick(i, lit) } that gives the picture of light i (0 to 4), as the picture grid of a set does
  const lightsHtml = (on, pics, color) => {
    const lit = i => i < on, srcs = [0, 1, 2, 3, 4].map(i => (pics ? (typeof pics.pick === 'function' ? pics.pick(i, lit(i)) : (lit(i) ? pics.on : pics.off)) : undefined)); // (what picture each light has, looked at before the text is made: 1.60.2)
    return PM.once(SITE_LIGHTS, [on, cssVal(color), ...srcs.map(x => x || '')], () => `<svg class="slsvg" viewBox="0 0 500 100" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Start lights">${[0, 1, 2, 3, 4].map(i => {
      const src = srcs[i], cls = 'sl' + (lit(i) ? ' on' : '');
      return src ? `<image class="${cls}" href="${esc(link(src))}" x="${i * 100 + 4}" y="4" width="92" height="92" preserveAspectRatio="xMidYMid meet"/>` : `<circle class="${cls}" cx="${50 + i * 100}" cy="50" r="42"${lit(i) && cssVal(color) ? ` style="fill:${cssVal(color)}"` : ''}/>`;
    }).join('')}</svg>`);
  };
  // The Race flag widget's pictures, drawn like the pictures on the Live Race tiles (24 x 24, a rounded line in the text colour) with the colour of the
  // flag filled in: a waving flag on a pole (it can be mirrored, for a flag on the right of the page) or a round LED. One picture that scales to the widget
  // (the lights do the same). The chequered flag of the end of a heat or race is cut from the same curve as the cloth, so the squares bend with it.
  const FLAG_COLORS = { ready: '#4c9aff', running: '#2ecc40', paused: '#8a93a0', yellow: '#ffd400', red: '#d62828' };
  const FLAG_NAMES = { ready: 'Pre-Race', running: 'Racing (green flag)', paused: 'Paused', between: 'Heat finished (chequered flag)', finished: 'Finished (chequered flag)', yellow: 'Yellow flag', red: 'Red flag' };
  const FLAG_STYLES = [['flags', 'Flags'], ['leds', 'LEDs'], ['text', 'Text (uses Race-state colours)'], ['images', 'Image set (made under Customization > Image Settings)']];
  // What the widget shows. A widget made before there was a choice: a picture set or pictures of its own mean "images", the old "text" choice stays text, the rest is flags.
  const flagStyleOf = o => {
    o = o || {}; if (FLAG_STYLES.some(x => x[0] === o.flagStyle)) return o.flagStyle;
    return o.imageSet || ['ready', 'running', 'paused', 'between', 'finished', 'yellow', 'red'].some(k => o['img_' + k]) ? 'images' : o.flagShow === 'text' ? 'text' : 'flags';
  };
  const r2 = n => Math.round(n * 100) / 100;
  const chequeredStates = ['between', 'finished'], isChequered = st => chequeredStates.includes(st), fillOf = st => (isChequered(st) ? '#fff' : FLAG_COLORS[st] || FLAG_COLORS.ready);
  const svg = (label, inner) => `<svg class="flagsvg" viewBox="2.5 2 17 21" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(label)}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  const flagGeometry = (() => {
    const X0 = 5.5, X1 = 18.5, Y0 = 4.5, H = 9, wave = x => -1.3 * Math.sin(2 * Math.PI * (x - X0) / (X1 - X0));
    const pt = (x, y) => `${r2(x)} ${r2(y + wave(x))}`, edge = (xa, xb, y, n) => Array.from({ length: n + 1 }, (_, i) => pt(xa + (xb - xa) * i / n, y)).join('L');
    const cell = (i, j, cols, rows) => {
      const xa = X0 + (X1 - X0) * i / cols, xb = X0 + (X1 - X0) * (i + 1) / cols, ya = Y0 + H * j / rows, yb = Y0 + H * (j + 1) / rows;
      return `M${edge(xa, xb, ya, 6)}L${edge(xb, xa, yb, 6)}Z`;
    };
    let dark = ''; for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) if ((i + j) % 2 === 0) dark += cell(i, j, 4, 3);
    return { cloth: `M${edge(X0, X1, Y0, 26)}L${edge(X1, X0, Y0 + H, 26)}Z`, dark };
  })();
  // o.mirror: the pole on the right and the flag flying to the left (mirrored around the middle of the picture)
  const flagHtml = (state, o) => {
    const chequered = isChequered(state), inner = `<path d="M5.5 21.5V3"/><path d="M3.5 21.5h4"/><path d="${flagGeometry.cloth}" fill="${fillOf(state)}"/>`
      + (chequered ? `<path d="${flagGeometry.dark}" fill="#111" stroke="none"/><path d="${flagGeometry.cloth}"/>` : '')
      + (state === 'paused' ? '<path d="M10.8 7.6v4.6M13.8 8.2v4.6" stroke="#fff" stroke-width="1.8"/>' : '');
    return svg(FLAG_NAMES[state] || state, o && o.mirror ? `<g transform="matrix(-1 0 0 1 22 0)">${inner}</g>` : inner);
  };
  // The LED: a round lens in the colour of the flag, a glow around it and a base. The chequered state is a chequered lens (squares cut by the circle).
  const ledGeometry = (() => {
    const CX = 11, CY = 10.4, R = 5.6, N = 64, circle = Array.from({ length: N }, (_, i) => [CX + R * Math.cos(2 * Math.PI * i / N), CY + R * Math.sin(2 * Math.PI * i / N)]);
    const cross = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    const clip = subject => { // Sutherland-Hodgman: the part of a polygon inside the (convex, counter-clockwise) circle
      let out = subject;
      for (let i = 0; i < circle.length && out.length; i++) {
        const a = circle[i], b = circle[(i + 1) % circle.length], input = out; out = [];
        input.forEach((p, k) => { const q = input[(k + 1) % input.length], pin = cross(a, b, p) >= 0, qin = cross(a, b, q) >= 0;
          if (pin) out.push(p);
          if (pin !== qin) { const t = cross(a, b, p) / (cross(a, b, p) - cross(a, b, q)); out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]); } });
      }
      return out;
    };
    const poly = pts => (pts.length ? `M${pts.map(p => `${r2(p[0])} ${r2(p[1])}`).join('L')}Z` : '');
    let dark = ''; const n = 4, step = 2 * R / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if ((i + j) % 2 === 0) { const x = CX - R + i * step, y = CY - R + j * step; dark += poly(clip([[x, y], [x + step, y], [x + step, y + step], [x, y + step]])); }
    return { CX, CY, R, dark };
  })();
  const ledHtml = state => {
    const g = ledGeometry, chequered = isChequered(state), colour = fillOf(state);
    return svg(FLAG_NAMES[state] || state,
      (chequered ? '' : `<circle cx="${g.CX}" cy="${g.CY}" r="7.5" stroke="${colour}" stroke-width="1.2" opacity=".45"/>`)
      + `<path d="M7.6 18.2h6.8v3.3H7.6z"/><path d="M8.6 16.2v2M13.4 16.2v2"/>`
      + `<circle cx="${g.CX}" cy="${g.CY}" r="${g.R}" fill="${colour}"/>`
      + (chequered ? `<path d="${g.dark}" fill="#111" stroke="none"/><circle cx="${g.CX}" cy="${g.CY}" r="${g.R}"/>` : '')
      + (state === 'paused' ? '<path d="M9.6 7.8v5.2M12.6 7.8v5.2" stroke="#fff" stroke-width="1.8"/>' : chequered ? '' : `<path d="M8.4 8.6a3.4 3.4 0 0 1 2.2-2" stroke="#fff" stroke-width="1.3" opacity=".7"/>`));
  };
  // Custom image widgets: a fixed picture, or the first rule that matches picks another one. A rule compares a {variable} with a value.
  const IMG_OPS = [['=', 'is'], ['!=', 'is not'], ['<', 'is less than'], ['>', 'is more than'], ['<=', 'is at most'], ['>=', 'is at least']];
  // a number in the text of a variable: "30", "30 °C", "10 km/h", "84 m", "+2 s", "50%", "1:05.123" (a time is worth its seconds); anything else is not a number
  const numOf = x => {
    const t = String(x ?? '').trim();
    let m = /^([-+]?)(\d+):(\d{1,2}(?:[.,]\d+)?)$/.exec(t);
    if (m) return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + parseFloat(m[3].replace(',', '.')));
    m = /^[-+]?\d+(?:[.,]\d+)?(?=\s*(?:%|°\s?[A-Za-z]?|[A-Za-z]{1,6}(?:\/[A-Za-z]{1,4})?)?$)/.exec(t);
    return m ? parseFloat(m[0].replace(',', '.')) : NaN;
  };
  const pureNum = t => /^[-+]?\d+(?:[.,]\d+)?$/.test(t);
  const unesc = t => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&'); // (the values of the variables are made safe for the page: a name with an & is compared as typed)
  function ruleHolds(r, vars) {
    if (!r || !r.var || !Object.prototype.hasOwnProperty.call(vars, r.var)) return false;
    const a = unesc(String(vars[r.var] ?? '').trim()), b = String(r.value ?? '').trim(), na = numOf(a), nb = numOf(b), num = Number.isFinite(na) && Number.isFinite(nb);
    const eq = num && (pureNum(a) || pureNum(b)) ? na === nb : a.toLowerCase() === b.toLowerCase(); // ("2 Fast" is not "2 Furious": two texts with a number in them are compared as texts)
    switch (r.op) { case '!=': return !eq; case '<': return num && na < nb; case '>': return num && na > nb; case '<=': return num && na <= nb; case '>=': return num && na >= nb; default: return eq; }
  }
  const pickImage = (opt, vars) => { const hit = ((opt && opt.rules) || []).find(r => r.image && ruleHolds(r, vars)); return hit ? hit.image : (opt && opt.image) || ''; };
  // a picture of the Race flag widget (a picture set): mirror flips it left to right
  const flagImgHtml = (src, alt, mirror) => PM.once(SITE_FLAG, [src, alt || '', !!mirror], () => `<img class="flagimg" src="${esc(link(src))}" alt="${esc(alt || '')}"${mirror ? ' style="transform:scaleX(-1)"' : ''}>`);
  const imageHtml = (src, fit) => (src ? PM.once(SITE_IMG, [src, fit === 'cover'], () => `<img class="flagimg" src="${esc(link(src))}" alt=""${fit === 'cover' ? ' style="width:100%;height:100%;object-fit:cover"' : ''}>`) : '');

  // Race flag: one optional picture per state; a state without a picture shows its name instead.
  const FLAG_STATES = [['ready', 'Pre-Race'], ['running', 'Racing (green flag)'], ['paused', 'Paused'],
    ['between', 'Heat finished'], ['finished', 'Finished (chequered flag)'], ['yellow', 'Yellow flag'], ['red', 'Red flag']];
  const SET_OPTION = kind => ({ key: 'imageSet', label: 'Picture set (made under Customization > Image Settings)', type: 'imageset', kind, default: '' });
  // Flag style: flags, LEDs, text or the pictures of a picture set (Customization > Image Settings). `when` says for which styles an option shows.
  const FLAG_OPTIONS = [{ key: 'flagStyle', label: 'Show the race state as', type: 'select', default: 'flags', choices: FLAG_STYLES },
    { key: 'flagMirror', label: 'Mirror the flag (the pole on the right, the flag flies to the left)', type: 'checkbox', default: false, when: ['flags'] },
    { ...SET_OPTION('flag'), when: ['images'] },
    { key: 'imageMirror', label: 'Mirror the pictures (flip them left to right)', type: 'checkbox', default: false, when: ['images'] }];
  // Start lights follow the race state too: for each state (the countdown lights them one by one) how many of the five lights are on, and in what colour
  const LIGHT_STATES = FLAG_STATES;
  // The picture grid of a Start lights set. A picture is stored under a key: `row` for all five lights, or `row_n` for light n (1 to 5).
  // The rows are Lights off, Countdown (the row that used to be called Light on) and one per race state (the same states as the Race flag widget). A set made before the grid (only `on` and `off`) is a grid with two rows filled in.
  const LIGHT_ROWS = [['off', 'Lights off'], ['on', 'Countdown'], ...FLAG_STATES];
  const LIGHT_COLS = [['', 'All lights'], ...[1, 2, 3, 4, 5].map(n => [String(n), 'Light ' + n])];
  const lightKey = (row, n) => (n ? row + '_' + n : row);
  // The keys to look at, best first, for light i (0 to 4) of the Start lights in race state `state`: lit or not.
  // A lit light in a race state looks for that state's picture of the light, then of all lights, and nowhere else: every row stands on its own, so a Countdown picture is only used for the countdown (1.28.1; before, a state with no picture borrowed the Countdown one).
  // The countdown (and a state with no row of its own) uses Countdown. A light that is not lit uses Lights off.
  const lightKeys = (state, i, lit) => {
    const n = i + 1;
    if (!lit) return ['off_' + n, 'off'];
    return LIGHT_STATES.some(([k]) => k === state) ? [state + '_' + n, state] : ['on_' + n, 'on'];
  };
  const lightPic = (images, state, i, lit) => { const im = images || {}; for (const k of lightKeys(state, i, lit)) if (im[k]) return im[k]; return ''; };
  // Which key would a cell of the grid use if it had no picture of its own (so the editor can show it dimmed)? '' when nothing is behind it.
  // A cell of one light uses the picture of all lights of its own row (every row stands on its own, 1.28.1); a cell of all lights has nothing behind it.
  const lightBehind = (images, key) => {
    const im = images || {}, m = /^([a-z]+)(?:_([1-5]))?$/.exec(key); if (!m) return '';
    return m[2] && im[m[1]] ? m[1] : '';
  };
  const LIGHT_COLORS = { ready: '#4c9aff', running: '#2ecc40', paused: '#ffd400', between: '#4c9aff', finished: '#ffffff', yellow: '#ffd400', red: '#d62828' };
  const lightColor = (opt, st) => (opt && opt['lightcol_' + st]) || LIGHT_COLORS[st] || '#4c9aff';
  const lightCount = (opt, st) => clampInt(opt && opt['lights_' + st], 0, 5, 0);
  const LIGHTS_OPTIONS = [SET_OPTION('lights'), { key: 'lightsnote', type: 'note', label: 'While the race counts down the lights come on one by one. For every other state of the race you can choose how many of the five lights are on, and their colour (a colour is used for round lights; a picture set shows the pictures it has for that state of the race, see Customization > Image Settings). Unset states follow the racing flags. These widget choices override the display of individual states.' },
    ...LIGHT_STATES.flatMap(([k, label]) => [
      { key: 'lights_' + k, label: `${label}: lights on`, type: 'select', default: '0', choices: [['0', 'None'], ['1', '1 light'], ['2', '2 lights'], ['3', '3 lights'], ['4', '4 lights'], ['5', 'All 5 lights']] },
      { key: 'lightcol_' + k, label: `${label}: colour`, type: 'color', default: LIGHT_COLORS[k] }])];
  const CLOCK_STYLES = [['classic', 'Original'], ['digital', 'Digital'], ['pitwall', 'Pit Wall']];
  // Resolve old choices without rewriting saved layouts: plain clocks remain plain.
  const clockStyleOf = w => { const s=w?.type==='clock'?w.opt?.style:'';return s==='timing'?'pitwall':CLOCK_STYLES.some(x=>x[0]===s)?s:'classic'; };
  const clockClassOf = w => clockStyleOf(w) === 'classic' ? '' : ` clock-${clockStyleOf(w)}`;
  const CLOCK_OPTIONS = [{ key: 'style', label: 'Clock style', type: 'select', default: 'classic', choices: CLOCK_STYLES, hint: 'Original uses your normal text settings. Digital uses seven-segment digits. Pit Wall separates seconds and tenths with a race-status label.' }, { key: 'countdown', label: 'Count down when the race has a time limit', type: 'checkbox', default: true }, { key: 'flagColour', label: 'Follow flags — green, yellow and red text', type: 'checkbox', default: true }];
  const CLOCK_SEGMENTS=['abcdef','bc','abged','abgcd','fgbc','afgcd','afgecd','abc','abcdefg','abfgcd'];
  const CLOCK_STATES={running:['RACING','GREEN FLAG'],yellow:['CAUTION','YELLOW FLAG'],red:['STOPPED','RED FLAG'],paused:['PAUSED','PAUSED'],ready:['READY','READY'],countdown:['STARTING','STARTING'],finished:['FINISHED','CHEQUERED FLAG'],between:['FINISHED','CHEQUERED FLAG']};
  function clockHtml(w,time,state='running',remaining=false){
    const style=clockStyleOf(w);if(style==='classic')return esc(time);
    const label=CLOCK_STATES[state]||CLOCK_STATES.ready;
    if(style==='digital')return `<span class="rc-digital" role="img" aria-label="${esc(time+' · '+label[0])}">${[...time].map(c=>/\d/.test(c)?`<span class="rc-digit" aria-hidden="true">${[...'abcdefg'].map(s=>`<i class="rc-seg-${s}${CLOCK_SEGMENTS[Number(c)].includes(s)?' on':''}"></i>`).join('')}</span>`:`<span aria-hidden="true" class="rc-punct ${c===':'?'rc-colon':'rc-dot'}"></span>`).join('')}</span>`;
    const [whole,tenth]=time.split('.');return `<span class="rc-pitwall"><span class="rc-pw-head"><b>${label[0]}</b></span><span class="rc-pw-display"><span class="rc-pw-whole"><strong>${esc(whole)}</strong><small>MINUTES : SECONDS</small></span><span class="rc-pw-fraction"><strong>.${esc(tenth||'0')}</strong><small>TENTHS</small></span></span><span class="rc-pw-foot"><span>${remaining?'REMAINING':'ELAPSED'}</span><span>${label[1]}</span></span></span>`;
  }
  function fitClock(el,w){
    if(w?.type!=='clock'||clockStyleOf(w)==='classic'||!el?.querySelector)return;
    const v=el.querySelector('.lw-val');if(!v)return;
    v.style.transform='';if(!el.hasAttribute?.('data-wd-padding')){v.style.top='0px';v.style.bottom='0px';}
    const padding=root.getComputedStyle?.(v),p=k=>parseFloat(padding?.[k])||0;
    const width=v.clientWidth-p('paddingLeft')-p('paddingRight'),height=v.clientHeight-p('paddingTop')-p('paddingBottom');if(width<=0||height<=0)return;
    const F=frameModule(),manual=w.typography?.mode==='manual'||(!w.typography?.mode&&!!w.textSize),requested=F?.typography(w).valueSize*(el.clientWidth/(w.w||1000));
    if(clockStyleOf(w)==='digital'){
      const count=v.querySelectorAll('.rc-digit').length,punct=v.querySelectorAll('.rc-punct').length;
      const available=Math.min(height*.82,(width-16)/(count*.66+punct*.23));
      el.style.setProperty('--rc-digit-height',Math.max(1,Math.min(available,manual?requested*1.4:available))+'px');
    }else{
      const compact=height<125||width<260;el.classList.toggle('rc-compact',compact);
      const digits=v.querySelector('.rc-pw-whole strong')?.textContent.length||5;
      const available=Math.min(height*(compact?.72:.40),(width-32)/(digits*.62+1.6));
      el.style.setProperty('--rc-number',Math.max(1,Math.min(available,manual?requested:available))+'px');
    }
  }
  const GAP_OPTIONS = [{ key: 'display', label: 'Display', type: 'select', default: 'time', choices: [['time', 'Time gap'], ['laps', 'Estimated gap in laps'], ['both', 'Time and estimated laps']], hint: 'The lap estimate converts the adjusted timing gap using the leader’s median valid lap. It stays as a time gap until there is enough lap data.' }];
  const RECORD_OPTIONS = [{ key: 'showName', label: 'Show who set it', type: 'checkbox', default: true }];
  const LEADER_OPTIONS = [
    { key: 'design', label: 'Row design', type: 'rowdesign', default: '' },
    { key: 'countOver', label: 'Count over', type: 'select', default: 'heat', choices: [['heat', 'This race or heat'], ['all', 'All heats and rounds so far']], hint: 'In a race of heats, or a race of a championship that gives points, "All heats and rounds so far" lists every driver of the race, with the race that is racing counted as it stands, and every column remembers what came before: the total time and the laps add up, the best lap is the best of all, the average and the median lap are those of all laps, the points add up. A race of a championship is in the order of the standings of the championship, and its points are the points of the championship. Columns that cannot add up (the lap that is running, fuel, tyres, penalties) show the car that is on track now and a dash for a driver who is not racing. In any other race this setting does nothing.' },
    { key: 'from', label: 'From place', type: 'number', default: 1, min: 1, max: 99, step: 1, hint: 'The first place the leaderboard shows. 1 shows from the leader.' },
    { key: 'to', label: 'To place', type: 'number', default: 0, min: 0, max: 99, step: 1, hint: 'The last place the leaderboard shows. 0 shows to the last place. With From place 5 and To place 8 it shows places 5 to 8.' },
    { key: 'orderBy', label: 'Order by', type: 'select', default: 'position', rerender: true, choices: Bo.CHOICES, hintOf: v => Bo.hintOf(v) },
    { key: 'orderDir', label: 'Best or worst on top', type: 'select', default: 'best', show: o => Bo.isOrdered(o), choices: Bo.DIRECTIONS },
    { key: 'scale', rowsOnly: true, label: 'Size of the rows', type: 'range', default: 100, min: 20, max: 100, step: 1, unit: '%', hint: '100% is as large as fits in the widget frame: with many drivers the rows shrink as a whole (text with them) so all of them stay inside. Less makes them smaller.' },
    { key: 'gaps', rowsOnly: true, label: 'Space between the columns', type: 'range', default: 100, min: 0, max: 100, step: 1, unit: '%', hint: '100% keeps the columns where the design has put them. Less closes up the blank space between them: the rows get narrower, so they can be drawn larger and the text gets bigger. Good for a tall, narrow widget.' },
    { key: 'fill', rowsOnly: true, label: 'Fill the frame', type: 'select', default: 'off', choices: [['off', 'Off: the rows keep the shape of the design'], ['rows', 'Taller rows'], ['gaps', 'More space between the rows']], hint: 'In a tall frame the rows keep the shape of the design and the empty space is under the last row. Taller rows: the rows grow taller until they fill the frame (the text keeps its size). More space between the rows: they keep their shape and the empty space goes between them. A frame that the rows already fill (for example a wide frame with many drivers) does not change. Size of the rows still applies: at 50% the board fills half the frame.' },
    { key: 'driverBy', classic: true, label: 'Driver column shows', type: 'select', default: 'name', choices: [['name', 'Name'], ['nickname', 'Nickname'], ['callsign', 'Callsign']] },
    { key: 'colFlag', classic: true, label: 'Driver flag', type: 'checkbox', default: true },
    { key: 'colLaps', classic: true, label: 'Laps', type: 'checkbox', default: true },
    { key: 'colBest', classic: true, label: 'Best lap', type: 'checkbox', default: true },
    { key: 'colGap', classic: true, label: 'Gap to leader', type: 'checkbox', default: true },
    { key: 'colCallsign', classic: true, label: 'Callsign column', type: 'checkbox', default: false },
    { key: 'colNickname', classic: true, label: 'Nickname column', type: 'checkbox', default: false },
    { key: 'colLast', classic: true, label: 'Last lap', type: 'checkbox', default: false },
    { key: 'colCurrent', classic: true, label: 'Current lap time', type: 'checkbox', default: false },
    { key: 'colFuel', classic: true, label: 'Fuel left', type: 'checkbox', default: false },
    { key: 'colTyres', classic: true, label: 'Tyre life (a race with a Tyre Wear System)', type: 'checkbox', default: false },
    { key: 'colPace', classic: true, label: 'Pace: PUSH, NORMAL or SAVE (a race with a Push and Save System)', type: 'checkbox', default: false }
  ];
  const optOf = (o, key) => { const d = LEADER_OPTIONS.find(x => x.key === key); return o && o[key] !== undefined ? o[key] : d.default; };
  // rows: [{ pos, flag, name, nickname, callsign, laps, best, last, current, gap, color, bg }] (already formatted text)
  function leaderHtml(rows, opt) {
    const on = k => optOf(opt, k), by = on('driverBy');
    const cols = [['Pos', 'pos', true], ['', 'flag', on('colFlag')], ['Driver', by, true], ['Callsign', 'callsign', on('colCallsign') && by !== 'callsign'],
      ['Nickname', 'nickname', on('colNickname') && by !== 'nickname'], ['Laps', 'laps', on('colLaps')], ['Best', 'best', on('colBest')],
      ['Last', 'last', on('colLast')], ['Current', 'current', on('colCurrent')], ['Fuel', 'fuel', on('colFuel')], ['Tyres', 'tyres', on('colTyres')], ['Pace', 'pace', on('colPace')], ['Gap', 'gap', on('colGap')]].filter(c => c[2]);
    const cell = (r, k) => k === 'flag' ? (r.flag ? `<span class="fi fi-${esc(String(r.flag).toLowerCase())}"></span>` : '') : k === 'tyres' ? (r.tyres || '–') : k === 'pace' ? (r.pace || '–') : esc(r[k]); // (tyres and pace: the cells that tyrewidgets.js and pacewidgets.js made, already safe)
    return `<table class="lb">${rows.map(r => {
      const F = frameModule(), stripe = F ? F.laneStripe({ laneColorStyle: r.laneColorStyle, w: 1000, h: 70, transparency: r.laneTransparency }, null, cssVal(r.laneBg)) : { cls: '', css: '' }, style = `${cssVal(r.bg) ? 'background:' + cssVal(r.bg) + ';' : ''}${cssVal(r.color) ? 'color:' + cssVal(r.color) + ';' : ''}${stripe.css}`;
      // Keep the classic markup byte-for-byte when no stripe was requested.
      if (!stripe.cls) return `<tr${Number.isInteger(r.lane)?` data-lap-lane="${r.lane}"`:''}${cssVal(r.bg) || cssVal(r.color) ? ` style="${cssVal(r.bg) ? 'background:' + cssVal(r.bg) + ';' : ''}${cssVal(r.color) ? 'color:' + cssVal(r.color) : ''}"` : ''}>${cols.map(c => `<td class="lb-${c[1]}">${cell(r, c[1])}</td>`).join('')}</tr>`;
      return `<tr${Number.isInteger(r.lane)?` data-lap-lane="${r.lane}"`:''} class="${stripe.cls.trim()}" style="${style}">${cols.map(c => `<td class="lb-${c[1]}">${cell(r, c[1])}</td>`).join('')}</tr>`;
    }).join('')}</table>`;
  }

  // The Heat List: every heat of a heat-based race with its drivers, and who won it. heat: the heat info of the race (idx: the heat that is racing or is next, by: what the heats
  // are counted by, list: [{ name, label, drivers: [{lane, name}], rows: [{pos, name, points, laps, tm, fin}] }]); phase: the state of the race.
  const HEATLIST_OPTIONS = [
    { key: 'show', label: 'Heats shown', type: 'select', default: 'all', choices: [['all', 'All heats'], ['upcoming', 'From the heat that is racing'], ['near', 'The heat that is racing and the two after it']], hint: 'The heat that is racing (or is next) is marked.' },
    { key: 'detail', label: 'Result of a finished heat', type: 'select', default: 'winner', choices: [['winner', 'The winner'], ['all', 'Every place'], ['none', 'Nothing']] },
    { key: 'lanes', label: 'Lane numbers in front of the drivers', type: 'checkbox', default: true },
    { key: 'figures', label: 'Points, laps or time next to the names of the result', type: 'checkbox', default: true }
  ];
  const hlOn = (o, k) => { const d = HEATLIST_OPTIONS.find(x => x.key === k); return o && o[k] !== undefined ? o[k] : d.default; };
  const timeText = ms => Re.fmtTime(ms);
  const hlFigure = (r, by) => by === 'points' ? String(r.points || 0) : by === 'time' ? (r.tm !== undefined && r.tm !== null ? timeText(r.tm) + (r.fin === 0 ? '*' : '') : r.fin === 0 ? 'DNF' : '') : `${r.laps}`;
  function heatListHtml(heat, phase, opt) {
    const all = (heat && heat.list) || [];
    if (!all.length) return '\u2013';
    const racing = ['countdown', 'running', 'paused', 'review'].includes(phase), idx = Math.max(0, heat.idx || 0), by = heat.by || 'laps';
    const items = all.map((x, i) => ({ ...x, state: i < idx ? 'done' : i === idx ? (racing ? 'current' : 'next') : 'later' }));
    const show = hlOn(opt, 'show'), start = show === 'all' ? 0 : Math.max(0, Math.min(idx, items.length - (show === 'near' ? 3 : 1)));
    const shown = show === 'all' ? items : show === 'near' ? items.slice(start, start + 3) : items.slice(start);
    const detail = hlOn(opt, 'detail'), withNums = hlOn(opt, 'lanes') !== false, figs = hlOn(opt, 'figures') !== false;
    const cellOf = x => {
      if (detail === 'none' || !x.rows || !x.rows.length) return '';
      const rows = detail === 'all' ? x.rows : x.rows.filter(r => r.pos === 1);
      return rows.map(r => `${detail === 'all' ? esc(r.pos) + ' ' : '\u2605 '}${esc(r.name)}${figs && hlFigure(r, by) ? ' ' + esc(hlFigure(r, by)) : ''}`).join(' \u00b7 ');
    };
    return `<table class="hlw">${shown.map(x => `<tr class="hlw-${x.state}"><td class="hlw-n">${esc(x.name)}</td><td class="hlw-d">${(x.drivers || []).map(d => `${withNums && d.lane >= 0 ? (d.lane + 1) + ': ' : ''}${esc(d.name)}`).join(' \u00b7 ')}</td><td class="hlw-win">${cellOf(x)}</td></tr>`).join('')}</table>`;
  }
  // The Next Heat widget (1.62.0): the drivers of the heat that comes next, with their lanes. heat and phase are those of the Heat List. The heat at heat.idx is the one that is racing
  // (countdown, running, paused) or has just finished and waits for the check (review), so the next one is the heat after it; before the start and between two heats it is the heat at heat.idx.
  const NEXTHEAT_OPTIONS = [
    { key: 'howmany', label: 'Heats shown', type: 'select', default: '1', choices: [['1', 'The next heat'], ['2', 'The next two heats'], ['3', 'The next three heats']] },
    { key: 'title', label: 'Name of the heat above the drivers', type: 'checkbox', default: true },
    { key: 'lanes', label: 'Lane numbers in front of the drivers', type: 'checkbox', default: true },
    { key: 'layout', label: 'The drivers are shown', type: 'select', default: 'list', choices: [['list', 'One under the other'], ['line', 'On one line']] },
    { key: 'countdown', label: 'Countdown of the break between two heats', type: 'checkbox', default: true, hint: 'Shown with the next heat while the race counts down to its start (a break set in the Race Setup).' }
  ];
  const nhOn = (o, k) => { const d = NEXTHEAT_OPTIONS.find(x => x.key === k); return o && o[k] !== undefined ? o[k] : d.default; };
  const clockSecs = s => { const n = Math.max(0, Math.round(Number(s) || 0)), h = Math.floor(n / 3600), m = Math.floor(n % 3600 / 60), x = String(n % 60).padStart(2, '0'); return h ? `${h}:${String(m).padStart(2, '0')}:${x}` : `${m}:${x}`; };
  function nextHeatHtml(heat, phase, opt) {
    const all = (heat && heat.list) || [];
    if (!all.length) return '–';
    const racing = ['countdown', 'running', 'paused', 'review'].includes(phase), idx = Math.max(0, heat.idx || 0), first = racing ? idx + 1 : idx;
    if (first >= all.length) return `<span class="nhw-none">${racing ? 'This is the last heat' : 'Race finished'}</span>`;
    const many = Math.max(1, Math.min(3, Math.floor(Number(nhOn(opt, 'howmany'))) || 1)), withNums = nhOn(opt, 'lanes') !== false, line = nhOn(opt, 'layout') === 'line';
    const count = Number(heat.count) || 0, left = Number(heat.breakLeft) || 0;
    const blocks = all.slice(first, first + many).map((x, k) => {
      const i = first + k, ds = (x.drivers || []).slice().sort((a, b) => (a.lane < 0 ? 1e6 : a.lane) - (b.lane < 0 ? 1e6 : b.lane) || 0);
      const name = esc(x.name) + (count && i < count ? ` of ${count}` : ''), head = nhOn(opt, 'title') === false ? '' : `<div class="nhw-t">${k === 0 ? 'Next: ' : ''}${name}</div>`;
      const who = ds.map(d => `${withNums && d.lane >= 0 ? (d.lane + 1) + ': ' : ''}${esc(d.name)}`);
      const body = line ? `<div class="nhw-d">${who.join(' · ')}</div>` : `<div class="nhw-d nhw-list">${who.map(w => `<div>${w}</div>`).join('')}</div>`;
      const note = k === 0 && heat.picking && i === idx ? '<div class="nhw-c">The lanes are picked before the start</div>' : '';
      const clock = k === 0 && phase === 'between' && left > 0 && nhOn(opt, 'countdown') !== false ? `<div class="nhw-c">Starts in ${clockSecs(left)}</div>` : '';
      return `<div class="nhw-b">${head}${body}${clock}${note}</div>`;
    });
    return `<div class="nhw">${blocks.join('')}</div>`;
  }
  // The Total Time widget (1.63.0): how long a driver has been racing. It counts up from the start and stops when the car has finished (all its laps or its distance driven, or the time is up and
  // it has crossed the line). Over the heats of a heat race it can add up the heats that are done and the one that is racing. scope: this race or heat / all heats so far / both. penalties: with
  // the time penalties and the corrections of the review (the time the results count) or without them (the time on the clock).
  const TOTALTIME_OPTIONS = [
    { key: 'scope', label: 'Time of', type: 'select', default: 'heat', choices: [['heat', 'This race or heat'], ['all', 'All heats so far (the heats that are done, plus this one)'], ['both', 'Both: this heat, with all heats so far beside it']] },
    { key: 'penalties', label: 'Penalties', type: 'select', default: 'with', choices: [['with', 'With penalties: the time the results count'], ['without', 'Without penalties: the time on the clock']] }
  ];
  const ttScope = o => (o && (o.scope === 'all' || o.scope === 'both') ? o.scope : 'heat'), ttPenalties = o => !(o && o.penalties === 'without');
  // v: { heat, all } in milliseconds (a missing or not finite one is a dash)
  function totalTimeHtml(v, opt) {
    const sc = ttScope(opt), text = x => Re.fmtTime(x); // (a time that is not a number is a dash)
    return sc === 'all' ? text(v && v.all) : sc === 'both' ? `${text(v && v.heat)}<small class="rn">${text(v && v.all)} in all</small>` : text(v && v.heat);
  }
  // Picture framing: zoom (1 to 4) and where the picture sits. x and y run from -1 to 1 (0 = centred); the picture can
  // never be moved so far that the frame shows an empty edge.
  const frameOf = f => ({ zoom: Math.max(1, Math.min(4, Number(f && f.zoom) || 1)), x: Math.max(-1, Math.min(1, Number(f && f.x) || 0)), y: Math.max(-1, Math.min(1, Number(f && f.y) || 0)) });
  const frameTransform = f => {
    const g = frameOf(f), k = (g.zoom - 1) / 2 * 100, r = v => Math.round(v * 100) / 100;
    return `translate(${r(g.x * k)}%, ${r(g.y * k)}%) scale(${r(g.zoom)})`;
  };
  // dx, dy: how far the pointer moved, as a fraction of the frame's width / height
  const panFrame = (f, dx, dy) => {
    const g = frameOf(f), k = (g.zoom - 1) / 2;
    return k <= 0 ? g : frameOf({ zoom: g.zoom, x: g.x + dx / k, y: g.y + dy / k });
  };
  const zoomFrame = (f, zoom) => frameOf({ ...frameOf(f), zoom });
  // A picture set chosen in a widget stands in for the pictures that were uploaded in the widget itself. A set that no longer exists is ignored.
  // A Logo widget without a picture of its own shows the club logo from App Settings (`clubLogo`); a picture of its own wins.
  function resolveOpt(w, sets, clubLogo) {
    const o = (w && w.opt) || {};
    if (w && w.type === 'logo' && !o.image && clubLogo) return { ...o, image: clubLogo };
    if (!o.imageSet) return o;
    const set = (sets || []).find(x => x.id === o.imageSet); if (!set) return o;
    if (w.type === 'fuel' && set.kind === 'fuel') return { ...o, mode: 'images', steps: set.steps, stepImages: set.images || [] };
    if (w.type === 'lights' && set.kind === 'lights') return { ...o, lightOn: (set.images || {}).on || '', lightOff: (set.images || {}).off || '', lightImages: set.images || {} };
    if (w.type === 'avatar' && set.kind === 'avatars') return { ...o, laneAvatars: set.images || {} };
    if (w.type === 'tyre' && set.kind === 'tyres') return { ...o, tyreImages: set.images || {} };
    if ((w.type === 'tyrelife' || w.type === 'tyresets') && set.kind === 'tyres') return { ...o, tyreImages: set.images || {} };
    if (w.type === 'wxforecast' && set.kind === 'weather') return { ...o, stateImages: set.images || {} };
    if (w.type === 'wxconditions' && set.kind === 'conditions') return { ...o, condImages: set.images || {} };
    if (w.type === 'flag' && set.kind === 'flag') { const r = { ...o }; FLAG_STATES.forEach(([k]) => { r['img_' + k] = (set.images || {})[k] || ''; }); return r; }
    return o;
  }
  // 1.60.8: the pictures of the Start lights widgets of a layout, in the order they are needed (the countdown first: each light off, then on; then the rest of the set), so they can be made ready
  // before the race (PicMemo.prepare). sets: the picture sets as the race has them. A widget with pictures of its own (lightImages) counts too.
  const lightSetPictures = images => {
    const im = images || {}, out = [], seen = new Set(), add = x => { if (typeof x === 'string' && x && !seen.has(x)) { seen.add(x); out.push(x); } };
    for (let i = 0; i < 5; i++) { add(lightPic(im, 'countdown', i, false)); add(lightPic(im, 'countdown', i, true)); }
    Object.keys(im).forEach(k => add(im[k]));
    return out;
  };
  const lightPictures = (layout, sets) => {
    const out = [], seen = new Set();
    ((layout && layout.widgets) || []).forEach(w => {
      if (!w || w.type !== 'lights') return;
      lightSetPictures(resolveOpt(w, sets).lightImages).forEach(x => { if (!seen.has(x)) { seen.add(x); out.push(x); } });
    });
    return out;
  };
  const prepareLights = (layout, sets) => { try { return PM && typeof PM.prepare === 'function' ? PM.prepare(lightPictures(layout, sets)) : 0; } catch (x) { return 0; } }; // (making pictures ready is never worth a failure of the race screen)
  // an avatar or a slotcar picture in its round (or square) frame, with the position and zoom of the widget; mirror flips the picture left to right inside the frame
  const avatarHtml = (src, opt) => { const ft = frameTransform(opt && opt.frame), mirror = !!(opt && opt.avatarMirror); return PM.once(SITE_AV, [src, ft, mirror], () => `<span class="avframe"><img class="avimg" src="${esc(link(src))}" alt="" style="transform:${ft}${mirror ? ' scaleX(-1)' : ''}"></span>`); };
  // The Avatar widget: the driver's picture, or when the driver has none the avatar of the lane (the standard ones, or a picture set of the kind Avatars)
  // Team Name and Team Picture (1.8.0): the team of the lane (a team chosen on Home), or one team from Database > Teams that the widget always shows
  const TEAM_OPTION = { key: 'team', label: 'Team to show', type: 'team', default: '' };
  // Endurance Race: the driver at the wheel, the driver who is next, and the time to the swap
  const DRIVER_SHOW = { key: 'show', label: 'Show', type: 'select', default: 'name', choices: [['name', 'The name'], ['nickname', 'The nickname'], ['callsign', 'The callsign']] };
  const CURDRIVER_OPTIONS = [DRIVER_SHOW, { key: 'stint', label: 'Add how long he has been at the wheel', type: 'checkbox', default: false }];
  const NEXTDRIVER_OPTIONS = [DRIVER_SHOW, { key: 'prefix', label: 'Put "Next:" in front', type: 'checkbox', default: false }];
  const SWAPTIMER_OPTIONS = [
    { key: 'show', label: 'Show', type: 'select', default: 'words', choices: [['words', 'Words ("Swap in 12:30", or "Swap in 12 m" when the swaps are counted in distance)'], ['clock', 'Only the time or distance (12:30, 12 m)']] },
    { key: 'soonColor', label: 'Colour when the swap is near (the warning of the race setup)', type: 'color', default: '#ffb000' },
    { key: 'dueColor', label: 'Colour when the swap is due', type: 'color', default: '#e03131' }];
  // 1.35.1: the Swap Signal: big, flashing, and there until the swap is made. Who comes out and who steps in is under the word.
  const SWAPSIGNAL_OPTIONS = [
    { key: 'when', label: 'Show it', type: 'select', default: 'due', choices: [['due', 'When the swap is due (it stays until the swap is made)'], ['soon', 'Also in the warning before the swap (in the warning colour)']] },
    { key: 'text', label: 'The word', type: 'text', default: 'SWAP' },
    { key: 'names', label: 'Show who comes out and who steps in ("Alex \u2192 Sam")', type: 'checkbox', default: true },
    { ...DRIVER_SHOW, label: 'Show the drivers by' },
    { key: 'flash', label: 'Flash while the swap is due', type: 'checkbox', default: true },
    { key: 'soonColor', label: 'Colour of the warning', type: 'color', default: '#ffb000' },
    { key: 'dueColor', label: 'Colour when the swap is due', type: 'color', default: '#e03131' },
    { key: 'offColor', label: 'Colour of the dark flash', type: 'color', default: '#6b1414' }];
  // Damage System: the damage of the car and the repair it needs (see damage.js)
  const DAMAGE_OPTIONS = [
    { key: 'show', label: 'Show', type: 'select', default: 'both', choices: [['both', 'The level and the points ("Medium damage \u00b7 6")'], ['level', 'Only the level'], ['points', 'Only the points']] },
    { key: 'showNone', label: 'Show "No damage" when the car has none (turn off to show nothing)', type: 'checkbox', default: true },
    { key: 'amberColor', label: 'Colour of a level to pit for whenever you can', type: 'color', default: '#ffb000' },
    { key: 'redColor', label: 'Colour of a level to pit for as fast as you can, of a level that ends the car, and of a car that is late', type: 'color', default: '#e03131' },
    { key: 'outColor', label: 'Colour of a car that is retired by damage', type: 'color', default: '#555b66' }];
  const REPAIRTIMER_OPTIONS = [
    { key: 'show', label: 'Show', type: 'select', default: 'words', choices: [['words', 'Words ("Pit in 2 laps \u00b7 0:15", "Repairing 0:07")'], ['clock', 'Only the clock (the time in the pits)']] },
    { key: 'soonColor', label: 'Colour when the car should pit whenever it can', type: 'color', default: '#ffb000' },
    { key: 'dueColor', label: 'Colour when the car should pit as fast as it can, or is late', type: 'color', default: '#e03131' },
    { key: 'standColor', label: 'Colour while the car is being repaired', type: 'color', default: '#3ddc84' }];
  // Car Failures (1.43.0): the failure the car has now (see failures.js)
  const CARFAILURE_OPTIONS = [
    { key: 'show', label: 'Show', type: 'select', default: 'words', choices: [['words', 'The name and what it asks ("Slow Puncture \u00b7 Pit in 2 laps")'], ['name', 'Only the name']] },
    { key: 'showNone', label: 'Show a text when the car has no failure (turn off to show nothing)', type: 'checkbox', default: true },
    { key: 'noneText', label: 'The text when the car has no failure', type: 'text', default: 'No failure' },
    { key: 'amberColor', label: 'Colour of a failure to pit for whenever you can', type: 'color', default: '#ffb000' },
    { key: 'redColor', label: 'Colour of a failure to pit for as fast as you can, of a failure that ends the car, and of a car that is late', type: 'color', default: '#e03131' },
    { key: 'standColor', label: 'Colour while the car is being repaired', type: 'color', default: '#3ddc84' },
    { key: 'outColor', label: 'Colour of a car that is retired by a failure', type: 'color', default: '#555b66' }];
  const TEAMPIC_OPTIONS = [TEAM_OPTION, { key: 'frame', label: 'Picture position and zoom', type: 'frame', from: 'team' }];
  const AVATAR_OPTIONS = [{ ...SET_OPTION('avatars'), label: 'Avatars for a driver without a picture (sets are made under Customization > Image Settings)' },
    { key: 'avatarMirror', label: 'Mirror the pictures (flip them left to right)', type: 'checkbox', default: false },
    { key: 'frame', label: 'Picture position and zoom', type: 'frame', from: 'avatar' }];
  const CARPIC_OPTIONS = [{ key: 'carMirror', label: 'Mirror the picture (flip it left to right)', type: 'checkbox', default: false }, // (1.30.1: as the Avatar widget has)
    { key: 'frame', label: 'Picture position and zoom', type: 'frame', from: 'car' }];

  // Fuel widget: a number, a bar, both, or one of your own pictures from full to empty.
  const FUEL_OPTIONS = [
    SET_OPTION('fuel'),
    { key: 'mode', label: 'Show fuel as', type: 'select', default: 'both', rerender: true, choices: [['number', 'Number'], ['bar', 'Bar'], ['both', 'Bar and number'], ['images', 'Pictures from the picture set']] },
    { key: 'barStyle', label: 'Fuel Bar style', type: 'select', default: 'original', rerender: true, choices: [['original', 'Original'], ['digital', 'Digital Segments'], ['scale', 'Reserve Scale']], show: o => fuelIsBar(o) },
    { key: 'dir', label: 'Bar direction', type: 'select', default: 'horizontal', choices: [['horizontal', 'Horizontal (empties to the left)'], ['vertical', 'Vertical (empties downwards)']], show: o => fuelIsBar(o) }, // (1.39.3)
    { key: 'thick', label: 'Bar thickness (% of the widget)', type: 'number', default: 60, min: 10, max: 100, step: 5, show: o => fuelIsBar(o) },
    { key: 'segments', label: 'Digital segments', type: 'number', default: 12, min: 8, max: 20, step: 1, show: o => fuelIsBar(o) && fuelOpt(o, 'barStyle') === 'digital' },
    { key: 'glow', label: 'Soft digital glow (no animation)', type: 'checkbox', default: true, show: o => fuelIsBar(o) && fuelOpt(o, 'barStyle') === 'digital' },
    { key: 'barValues', label: 'Fuel values', type: 'select', default: 'auto', choices: [['auto', 'Style default'], ['litres', 'Litres'], ['percent', 'Percentage'], ['both', 'Percentage and litres / capacity']], show: o => fuelOpt(o, 'mode') === 'both', hint: 'Original defaults to litres; Digital Segments and Reserve Scale show percentage and litres / capacity. Choose Bar instead of Bar and number to hide values.' },
    { key: 'warningText', label: 'Low / critical warning text', type: 'select', default: 'auto', choices: [['auto', 'Style default'], ['show', 'Show'], ['hide', 'Hide']], show: o => fuelIsBar(o), hint: 'Shown by default on Digital Segments and Reserve Scale. Original keeps its existing display. Warnings use the thresholds below; Reserve Scale marks the warning threshold.' },
    { key: 'lowAt', label: 'Warning colour below (% of tank)', type: 'number', default: 25, min: 0, max: 100, step: 1 },
    { key: 'lowColor', label: 'Warning colour', type: 'color', default: '#ffd400' },
    { key: 'critAt', label: 'Critical colour below (% of tank)', type: 'number', default: 10, min: 0, max: 100, step: 1 },
    { key: 'critColor', label: 'Critical colour', type: 'color', default: '#d62828' }
  ]; // pictures come from a picture set (Customization > Image Settings)
  const fuelOpt = (o, k) => (o && o[k] !== undefined ? o[k] : FUEL_OPTIONS.find(x => x.key === k).default);
  function fuelIsBar(o) { const m = fuelOpt(o, 'mode'); return m === 'bar' || m === 'both'; } // (the direction and the thickness only matter for a bar)
  // which of n pictures (0 = full ... n-1 = empty) belongs to a fraction of the tank
  const fuelStep = (frac, n) => Math.max(0, Math.min(n - 1, n - Math.ceil(Math.max(0, Math.min(1, frac)) * n - 1e-9)));
  // Fuel is a quantity, not a theme accent: blend full -> warning -> critical.
  // Keep saved warning colours/thresholds; number and picture modes retain theirs.
  function fuelBarColour(pct, opt) {
    const threshold = (key, fallback) => {
      const n = Number(fuelOpt(opt, key));
      return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : fallback;
    };
    const critical = threshold('critAt', 10), warning = Math.max(critical, threshold('lowAt', 25));
    const green = '#2fb86a', yellow = cssVal(fuelOpt(opt, 'lowColor')) || '#ffd400', red = cssVal(fuelOpt(opt, 'critColor')) || '#d62828';
    const blend = (from, to, amount) => {
      if (amount <= 0) return from;
      if (amount >= 1) return to;
      const rgb = colour => {
        const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(colour);
        if (!hex) return null;
        const full = hex[1].length === 3 ? hex[1].split('').map(c => c + c).join('') : hex[1];
        return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16));
      };
      const a = rgb(from), b = rgb(to);
      if (a && b) return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * amount).toString(16).padStart(2, '0')).join('');
      // Imported layouts may contain named/rgb colours rather than colour-picker hex.
      return `color-mix(in srgb, ${from} ${(1 - amount) * 100}%, ${to})`;
    };
    if (pct >= 100) return green;
    if (pct <= critical) return red;
    if (pct >= warning) return blend(yellow, green, (pct - warning) / (100 - warning));
    return blend(red, yellow, (pct - critical) / (warning - critical));
  }
  function fuelHtml(litres, tank, opt) {
    if (!Number.isFinite(litres) || !Number.isFinite(tank) || !(tank > 0)) return '–';
    const frac = Math.max(0, Math.min(1, litres / tank)), pct = frac * 100;
    const col = cssVal(pct < fuelOpt(opt, 'critAt') ? fuelOpt(opt, 'critColor') : pct < fuelOpt(opt, 'lowAt') ? fuelOpt(opt, 'lowColor') : '');
    const txt = `${(Math.floor(litres * 10 + 1e-9) / 10).toFixed(1).replace(/\.0$/, '')} L`, mode = fuelOpt(opt, 'mode');
    if (mode === 'images') {
      const n = clampInt(opt && opt.steps !== undefined ? opt.steps : 10, 2, 20, 10), step = fuelStep(frac, n), img = ((opt && opt.stepImages) || [])[step];
      // (1.60.2: the words of the picture follow the picture, not the litres: with the litres in them the text changed with every tenth of a litre, so the whole picture was put in the page again at every update while a car filled up)
      if (img) { const alt = `Fuel about ${Math.round(100 * (n - 1 - step) / (n - 1))}%`; return PM.once(SITE_FUEL, [img, alt], () => `<img class="fuelimg" src="${esc(link(img))}" alt="${alt}">`); }
    }
    const num = `<span class="fnum"${col ? ` style="color:${col}"` : ''}>${txt}</span>`;
    if (mode === 'number' || mode === 'images') return num;
    // 1.39.3: the bar can stand up (it empties downwards) and its thickness is a share of the widget (the style sheet sizes it with the widget: `.fbar` in styles.css)
    const vert = fuelOpt(opt, 'dir') === 'vertical', th = clampInt(fuelOpt(opt, 'thick'), 10, 100, 60), size = Math.round(pct * 10) / 10;
    const style = ['digital', 'scale'].includes(fuelOpt(opt, 'barStyle')) ? fuelOpt(opt, 'barStyle') : 'original';
    const chosen = fuelOpt(opt, 'barValues'), format = ['litres', 'percent', 'both'].includes(chosen) ? chosen : style === 'original' ? 'litres' : 'both';
    const capacity = `${Math.floor(tank * 10 + 1e-9) / 10} L`, percent = `${size}%`;
    const main = format === 'litres' ? txt : percent, detail = format === 'both' ? `${Math.floor(litres * 10 + 1e-9) / 10} / ${capacity}` : '';
    const limit = (k, d) => { const n = Number(fuelOpt(opt, k)); return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : d; };
    const critical = limit('critAt', 10), warning = Math.max(critical, limit('lowAt', 25));
    const warnings = fuelOpt(opt, 'warningText') === 'show' || (fuelOpt(opt, 'warningText') !== 'hide' && style !== 'original');
    const message = warnings ? pct <= 0 ? 'EMPTY' : pct <= critical ? 'CRITICAL' : pct <= warning ? 'LOW FUEL' : '' : '';
    const colour = fuelBarColour(pct, opt);
    // Preserve the original markup and dimensions for existing layouts.
    if (style === 'original' && !warnings && format !== 'both') return `<span class="fbar${vert ? ' fv' : ''}" style="--th:${th}"><span class="ffill" style="${vert ? 'height' : 'width'}:${size}%;background:${colour}"></span>${mode === 'both' ? `<span class="ftxt">${main}</span>` : ''}</span>`;
    return quantityBarHtml({style,vert,th,size,colour,warning,message,main:mode==='both'?main:'',detail:mode==='both'?detail:'',segments:fuelOpt(opt,'segments'),glow:fuelOpt(opt,'glow'),label:`Fuel ${percent}${message?', '+message:''}`});
  }
  // Shared quantity geometry; callers supply their own units, colours and race state.
  function quantityBarHtml({style='original',vert=false,th=60,size=0,colour,warning=25,message='',main='',detail='',segments=12,glow=false,label='',header='',tyre=false,scaleLabels=['E','½','F'],reserve=true}) {
    // A selected supporting fact becomes the primary fact when it is the only content.
    if (!main && detail) { main=detail; detail=''; }
    let meter;
    if (style === 'digital') {
      const count = clampInt(segments, 8, 20, 12);
      meter = `<span class="fg-meter fg-digital${glow === true ? ' fg-glow' : ''}">${Array.from({length:count}, (_, i) => {
        const lit = Math.round(Math.max(0, Math.min(100, size * count - i * 100)) * 1000) / 1000;
        return `<i class="fg-segment${lit > 0 ? ' fg-lit' : ''}">${lit > 0 ? `<b style="--lit:${lit}%"></b>` : ''}</i>`;
      }).join('')}</span>`;
    } else meter = `<span class="fg-meter fg-solid"><i class="fg-fill"></i>${style === 'scale' ? '<span class="fg-ticks"><i></i><i></i><i></i></span>'+(reserve?'<i class="fg-reserve"></i>':'') : ''}</span>`;
    return `<span class="${tyre?'tyre-gauge ':''}fuel-gauge fg-${style}${vert ? ' fg-vertical' : ''}" style="--th:${th};--fuel:${colour};--amount:${size}%;--reserve:${warning}%" role="img" aria-label="${esc(label)}">${header}${message ? `<span class="fg-warning">${message}</span>` : ''}<span class="fg-meter-space">${meter}${style === 'scale' ? `<span class="fg-scale-labels">${scaleLabels.map(x=>`<span>${esc(x)}</span>`).join('')}</span>` : ''}</span>${main ? `<span class="fg-values${detail?'':' fg-single'}"><strong class="fg-value">${main}</strong>${detail ? `<span class="fg-detail">${detail}</span>` : ''}</span>` : ''}</span>`;
  }

  // Speed: average speed over a lap from the track length. Real = the car's actual speed; scaled = as if the car were full size (1:1).
  const SPEED_OPTIONS = [
    { key: 'mode', label: 'Show', type: 'select', default: 'scaled', choices: [['scaled', 'Scaled speed (as a real car)'], ['real', 'Real speed (the slotcar itself)']] },
    { key: 'unit', label: 'Unit', type: 'select', default: 'kmh', choices: [['kmh', 'Kilometres per hour'], ['mph', 'Miles per hour']] },
    { key: 'source', label: 'Based on', type: 'select', default: 'last', choices: [['last', 'Last lap'], ['best', 'Best lap'], ['average', 'Average lap']] },
    { key: 'showUnit', label: 'Show the unit (km/h or mph)', type: 'checkbox', default: true }
  ];

  // Penalty points of a driver, and the time penalty they have turned into
  const PENALTY_OPTIONS = [
    { key: 'show', label: 'Show', type: 'select', default: 'points', choices: [['points', 'Penalty points'], ['time', 'Time penalty (seconds)'], ['both', 'Both']] }
  ];

  // Championship points of a heat or round robin race (needs "The overall winner is: Points")
  const CHAMP_OPTIONS = [
    { key: 'live', label: 'Count the current heat as if it ended now (turn off to count finished heats only)', type: 'checkbox', default: true }
  ];

  // Token Clock (Time Token Sessions): the paid time that is left on a lane
  // Race Laps: the laps of the race as a whole (the leader's lap, not the lap of one driver), counting up (7/20) or down (13 laps left)
  const RACELAPS_OPTIONS = [
    { key: 'lapCount', label: 'Count', type: 'select', default: 'up', rerender: true, choices: [['up', 'Up: the lap the leader is on (7/20)'], ['down', 'Down: the laps left (13)']] },
    { key: 'lapTotal', label: 'Show the number of laps of the race when counting up (7/20)', type: 'checkbox', default: true, show: o => !o || o.lapCount !== 'down' }];
  const lapCountOf = o => (o && o.lapCount === 'down' ? 'down' : 'up'), lapTotalOn = o => !(o && o.lapTotal === false);
  // Balance of Power: shows whether the car is hindered or helped (Race Setup > Balance of Power)
  const BOP_OPTIONS = [
    { key: 'showPercent', label: 'Show the percentage', type: 'checkbox', default: true },
    { key: 'showOff', label: 'Show "BoP off" when it is not applied (turn off to show nothing)', type: 'checkbox', default: true },
    { key: 'hinderColor', label: 'Colour when the car is hindered', type: 'color', default: '#ff8c00' },
    { key: 'helpColor', label: 'Colour when the car is helped', type: 'color', default: '#3ddc84' }];
  const TOKENCLOCK_OPTIONS = [{ key: 'warnColour', label: 'Turn amber when the time is almost up (the colour and the number of seconds are set in Race Setup > Time Tokens)', type: 'checkbox', default: true }];

  const runtimeSample = type => (lane, widget) => {
    const preview=typeof module!=='undefined'?require('./widgetpreview.js'):root.WidgetPreview;
    return preview.content({...widget,type,lane:lane||0}).html;
  };
  const REGISTRY = [
    // ---- Race ----
    T('clock', 'Race Clock', 'Race', { title: 'Race clock', w: 200, options: CLOCK_OPTIONS }),
    T('racelaps', 'Race Lap Counter', 'Race', { title: 'Race laps', w: 140, options: RACELAPS_OPTIONS }),
    T('tokenclock', 'Token Clock', 'Race', { title: 'Token clock', perLane: true, w: 200, options: TOKENCLOCK_OPTIONS }),
    T('lights', 'Start Lights', 'Race', { title: 'Start lights', w: 180, options: LIGHTS_OPTIONS }),
    T('flag', 'Race Flag', 'Race', { title: 'Race flag', w: 180, optsLabel: 'Flag style', options: FLAG_OPTIONS }),
    T('info', 'Race Info', 'Race', { title: 'Race info', w: 300 }),
    T('leaderboard', 'Leaderboard', 'Race', { w: 420, h: 220, textSize: 18, options: LEADER_OPTIONS }),
    T('heatlist', 'Heat List', 'Race', { title: 'Heat list', w: 460, h: 200, textSize: 18, options: HEATLIST_OPTIONS }),
    T('nextheat', 'Next Heat', 'Race', { title: 'Next heat', w: 300, h: 160, textSize: 22, options: NEXTHEAT_OPTIONS }),
    T('logo', 'Logo', 'Race', { w: 200, h: 100, noTitle: true, options: [{ key: 'image', label: 'Logo picture', type: 'image', fallback: 'clubLogo' }, { key: 'fit', label: 'Fit', type: 'select', choices: [['contain', 'Show the whole logo'], ['cover', 'Fill the widget (may crop)']], default: 'contain' }] }),
    // ---- Driver ----
    T('name', 'Driver Name', 'Driver', { title: 'Name', perLane: true, w: 200 }),
    T('nickname', 'Driver Nickname', 'Driver', { title: 'Nickname', perLane: true, w: 170 }),
    T('callsign', 'Driver Callsign', 'Driver', { title: 'Callsign', perLane: true, w: 100 }),
    T('avatar', 'Driver Avatar', 'Driver', { title: 'Avatar', perLane: true, w: 80, h: 80, options: AVATAR_OPTIONS }),
    T('driverflag', 'Driver Flag', 'Driver', { title: 'Driver flag', perLane: true, w: 90 }),
    T('lanecolor', 'Lane Colour', 'Driver', { title: 'Lane colour', perLane: true, w: 60 }),
    // ---- Slotcar ----
    T('carpicture', 'Slotcar Picture', 'Slotcar', { title: 'Slotcar picture', perLane: true, w: 160, h: 100, options: CARPIC_OPTIONS }),
    T('carname', 'Slotcar Name', 'Slotcar', { title: 'Slotcar', perLane: true, w: 260 }),
    T('fuel', 'Fuel Level', 'Slotcar', { title: 'Fuel', perLane: true, w: 200, options: FUEL_OPTIONS }),
    T('damage', 'Damage', 'Slotcar', { title: 'Damage', perLane: true, w: 230, options: DAMAGE_OPTIONS }),
    T('repairtimer', 'Repair Timer', 'Slotcar', { title: 'Repair timer', perLane: true, w: 260, options: REPAIRTIMER_OPTIONS }),
    T('carfailure', 'Car Failure', 'Slotcar', { title: 'Car failure', perLane: true, w: 300, options: CARFAILURE_OPTIONS }),
    T('penalty', 'Penalty Points', 'Slotcar', { title: 'Penalty', perLane: true, w: 150, options: PENALTY_OPTIONS }),
    T('bop', 'Balance of Power', 'Slotcar', { title: 'Balance of Power', perLane: true, w: 170, options: BOP_OPTIONS }),
    T('speed', 'Slotcar Speed', 'Slotcar', { title: 'Speed', perLane: true, w: 190, options: SPEED_OPTIONS }),
    // ---- Team and Swaps ----
    T('teamname', 'Team Name', 'Team and Swaps', { title: 'Team', perLane: true, w: 220, options: [TEAM_OPTION] }),
    T('teampicture', 'Team Picture', 'Team and Swaps', { title: 'Team picture', perLane: true, w: 100, h: 100, options: TEAMPIC_OPTIONS }),
    T('currentdriver', 'Current Driver', 'Team and Swaps', { title: 'Current driver', perLane: true, w: 260, options: CURDRIVER_OPTIONS }),
    T('nextdriver', 'Next Driver', 'Team and Swaps', { title: 'Next driver', perLane: true, w: 260, options: NEXTDRIVER_OPTIONS }),
    T('swaptimer', 'Driver Swap Timer', 'Team and Swaps', { title: 'Swap timer', perLane: true, w: 230, options: SWAPTIMER_OPTIONS }),
    T('swapsignal', 'Driver Swap Signal', 'Team and Swaps', { title: 'Swap signal', perLane: true, w: 260, h: 110, options: SWAPSIGNAL_OPTIONS }),
    // ---- Position and Progress ----
    T('position', 'Position in Race', 'Position and Progress', { title: 'Position', perLane: true, w: 70 }),
    T('gap', 'Gap to Leader', 'Position and Progress', { title: 'Gap to leader', perLane: true, w: 130, options: GAP_OPTIONS }),
    T('lap', 'Lap Number', 'Position and Progress', { title: 'Lap', perLane: true, w: 100 }),
    T('lapstogo', 'Laps To Go', 'Position and Progress', { title: 'Laps to go', perLane: true, w: 170, options: Ds.LAPSTOGO_OPTIONS }),
    T('distance', 'Distance Driven', 'Position and Progress', { title: 'Distance driven', perLane: true, w: 200, options: Ds.DISTANCE_OPTIONS }),
    T('distleft', 'Distance To Go', 'Position and Progress', { title: 'Distance to go', perLane: true, w: 200, options: Ds.DISTLEFT_OPTIONS }),
    T('champpoints', 'Championship Points', 'Position and Progress', { title: 'Points', perLane: true, w: 150, options: CHAMP_OPTIONS }),
    // ---- Lap Times and Records ----
    T('laptime', 'Current Lap Time', 'Lap Times and Records', { title: 'Lap time', perLane: true, w: 150, options: TIME_OPTIONS }),
    T('totaltime', 'Total Time', 'Lap Times and Records', { title: 'Total time', perLane: true, w: 200, options: TOTALTIME_OPTIONS }), // (1.63.0: how long the driver has been racing, see totalTimeHtml)
    T('lastlap', 'Lap Times List', 'Lap Times and Records', { title: 'Last lap', perLane: true, options: LAST_OPTIONS }),
    T('bestlap', 'Best Lap (this session)', 'Lap Times and Records', { title: 'Best lap', perLane: true }),
    T('avglap', 'Average Lap', 'Lap Times and Records', { title: 'Average lap', perLane: true }),
    T('medlap', 'Median Lap', 'Lap Times and Records', { title: 'Median lap', perLane: true }),
    T('pitstop', 'Pitstop Time', 'Lap Times and Records', { title: 'Pitstop time', perLane: true, w: 150 }),
    T('recordlap', 'Personal Best Lap', 'Lap Times and Records', { title: 'Record lap time', perLane: true }),
    T('sessionrecord', 'Session Record Lap', 'Lap Times and Records', { title: 'Session record lap', w: 220, options: RECORD_OPTIONS }),
    T('trackrecord', 'Track Record', 'Lap Times and Records', { title: 'Track record (ever set)', w: 220, options: RECORD_OPTIONS }),
    // ---- Delta Timers ----
    // Delta Timers: the ordinary widget's time on the left and, on the right, a green (faster) or red (slower) badge with the difference (see delta.js)
    ...Object.keys(Dl.KINDS).map(type => { const k = Dl.KINDS[type];
      return T(type, k.label, 'Delta Timers', { title: k.title, perLane: true, w: k.record ? 340 : 290, options: [...Dl.optionsFor(type), ...(type === 'dlaptime' ? TIME_OPTIONS : k.record ? RECORD_OPTIONS : [])],
      }); }),
    // ---- Tyres ----
    T('tyre', 'Current Tyres', 'Tyres', { title: 'Tyres', perLane: true, w: 140, h: 80, textSize: 22, options: Ww.TYRE_OPTIONS }),
    T('tyrelife', 'Tyre Wear', 'Tyres', { title: 'Tyres', perLane: true, w: 160, h: 170, textSize: 22, options: Tyw.OPTIONS }), // (1.40.0: how much life the tyres of the car have left, see tyrewidgets.js)
    T('tyresets', 'Available Tyres', 'Tyres', { title: 'Available tyres', perLane: true, w: 360, h: 90, textSize: 20, options: Tyw.SETS_OPTIONS }), // (1.41.0: the sets that are left of every tyre, see tyrewidgets.js)
    T('pace', 'Push & Save', 'Push & Save', { title: 'Pace', perLane: true, w: 170, h: 100, textSize: 22, options: Pw.OPTIONS }), // (1.54.0: how hard the car is driven and what it does to the tyres and the fuel, see pacewidgets.js)
    // ---- Weather ----
    T('wxforecast', 'Weather Forecast', 'Weather', { title: 'Weather', w: 240, h: 80, options: Ww.FORECAST_OPTIONS }),
    T('wxconditions', 'Track Conditions', 'Weather', { title: 'Track conditions', w: 500, h: 60, textSize: 20, options: Ww.COND_OPTIONS }),
    T('racechart', 'Race Chart', 'Charts', { w: 480, h: 300, textSize: 16, options: [{ key: 'chartDesign', label: 'Saved chart design', type: 'chartdesign', default: '' }] }),
    // ---- Custom ----
    T('textlane', 'Custom text (per lane)', 'Custom', { hidden: true, perLane: true, w: 300, noTitle: true, options: textOpts(TEXT_LANE_VARS, TEXT_LANE_DEFAULT) }),
    T('textrace', 'Custom text (race)', 'Custom', { hidden: true, w: 300, noTitle: true, options: textOpts(TEXT_RACE_VARS, TEXT_RACE_DEFAULT) }),
    T('imagelane', 'Custom image (per lane)', 'Custom', { hidden: true, perLane: true, w: 150, h: 150, noTitle: true }),
    T('imagerace', 'Custom image (race)', 'Custom', { hidden: true, w: 150, h: 150, noTitle: true }),
    // ---- Controls ----
    T('start', 'Start Button', 'Controls', { w: 140, title: 'Start', button: true, sample: 'Start' }),
    T('pause', 'Pause / Resume Button', 'Controls', { w: 170, title: 'Pause / Resume', button: true, sample: 'Pause' }),
    T('stop', 'Stop Button', 'Controls', { w: 120, title: 'Stop', button: true, sample: 'Stop' }),
    T('yellow', 'Yellow Flag Button', 'Controls', { w: 170, title: 'Yellow flag', button: true, sample: 'Yellow flag' }),
    T('red', 'Red Flag Button', 'Controls', { w: 150, title: 'Red flag', button: true, sample: 'Red flag' })
  ];
  // Insert each addition beside its existing folder, keeping palette and row-editor order stable.
  Stw.DEFINITIONS.forEach(([type, label, group, options]) => {
    const def = T(type, label, group, { perLane: true, w: 240, h: 130, textSize: 30, options });
    const last = REGISTRY.map(x => x.group).lastIndexOf(group);
    REGISTRY.splice(last < 0 ? REGISTRY.findIndex(x => x.group === 'Delta Timers') : last + 1, 0, def);
  });
  REGISTRY.splice(REGISTRY.map(x=>x.group).lastIndexOf('Position and Progress')+1,0,...[['classname','Class'],['classposition','Class position'],['classgap','Gap to class leader'],['classpoints','Class points'],['classbest','Class best lap']].map(([type,label])=>T(type,label,'Multi-Class',{perLane:true,w:180,h:85,textSize:32})));
  REGISTRY.unshift(...Aio.DEFINITIONS.map(([type,label,w,h]) => T(type,label,'All-in-One',{perLane:type!=='aiorace',layoutOnly:true,w,h,noTitle:true,textSize:30,options:Aio.options(type)})));
  REGISTRY.splice(REGISTRY.map(x=>x.group).lastIndexOf('Pit Stops')+1,0,...[['needsattention','Needs Attention'],['recentevents','Recent Events']].map(([type,label])=>T(type,label,'Pit Stops',{w:460,h:360,textSize:22,options:Pcw.options(type),layoutOnly:true})));
  const def = type => REGISTRY.find(d => d.type === type);
  // All content previews use the same formatter as the live race. Controls keep
  // their static labels; they have no simulated hardware action.
  const sampleOf = (d, lane, widget) => {
    if(!d)return '';
    if(d.button)return d.sample || d.label;
    return runtimeSample(d.type)(lane,widget);
  };
  const uid = () => Math.random().toString(36).slice(2, 10);
  const heightOf = layout => Math.round(U * layout.ratioH / layout.ratioW);
  // A layout as a page without buttons shows it (the Live Race pages, the fullscreen view): the control widgets (Start, Pause, Stop, the flags) are left out,
  // and widgets of lanes the track does not have too. When the controls sat at the bottom, the empty strip they leave is cut off, with the same margin below the
  // widgets as there is above them, so the widgets fill the page. { layout, cut }: the layout to build (the proportions changed when something was cut) and how many units were cut.
  const withoutControls = (layout, lanes) => {
    const H = heightOf(layout), has = w => { const d = def(w.type); return d && (!d.perLane || w.lane < lanes); };
    const shown = layout.widgets.filter(w => has(w) && !def(w.type).button), gone = layout.widgets.some(w => has(w) && def(w.type).button);
    if (!gone || !shown.length) return { layout, cut: 0 };
    const top = Math.max(0, Math.min(...shown.map(w => w.y))), h = Math.min(H, Math.max(1, Math.round(Math.max(...shown.map(w => w.y + w.h)) + top)));
    if (h >= H) return { layout, cut: 0 };
    return { layout: { ...layout, ratioH: layout.ratioW * h / U }, cut: H - h };
  };

  // ---- geometry ----
  // Snap a position (or a moving edge): pull to a nearby edge of another widget, otherwise to the grid.
  // snap: false = free (whole units), true = the grid and the magnets, 'grid' = the grid only (hold Ctrl while dragging).
  function snapMove(pos, size, targets, snap) {
    if (!snap) return Math.round(pos);
    if (snap === 'grid') return Math.round(pos / GRID) * GRID;
    let best = null;
    for (const t of targets) for (const d of [t - pos, t - (pos + size)]) if (Math.abs(d) <= MAG && (best === null || Math.abs(d) < Math.abs(best))) best = d;
    return best === null ? Math.round(pos / GRID) * GRID : Math.round((pos + best) * 100) / 100; // (a hundredth of a unit: no 96.99999999999999 in a saved layout)
  }
  function snapEdge(v, targets, snap) {
    if (!snap) return Math.round(v);
    if (snap === 'grid') return Math.round(v / GRID) * GRID;
    let best = null;
    for (const t of targets) { const d = t - v; if (Math.abs(d) <= MAG && (best === null || Math.abs(d) < Math.abs(best))) best = d; }
    return best === null ? Math.round(v / GRID) * GRID : v + best; // (v + (t - v) is exactly t, so no rounding is needed here)
  }
  const edgesX = (others, W, g) => [0, W, ...((g && g.v) || []), ...others.flatMap(o => [o.x, o.x + o.w])];
  const edgesY = (others, H, g) => [0, H, ...((g && g.h) || []), ...others.flatMap(o => [o.y, o.y + o.h])];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function moveWidget(w, dx, dy, others, W, H, snap, guides) {
    const x = snapMove(w.x + dx, w.w, edgesX(others, W, guides), snap), y = snapMove(w.y + dy, w.h, edgesY(others, H, guides), snap);
    return { x: clamp(x, 0, W - w.w), y: clamp(y, 0, H - w.h) };
  }
  // handle: 'nw' | 'ne' | 'sw' | 'se' (the corner being dragged)
  function resizeWidget(w, handle, dx, dy, others, W, H, snap, guides) {
    let l = w.x, r = w.x + w.w, t = w.y, b = w.y + w.h;
    if (handle.includes('w')) l = snapEdge(l + dx, edgesX(others, W, guides), snap);
    if (handle.includes('e')) r = snapEdge(r + dx, edgesX(others, W, guides), snap);
    if (handle.includes('n')) t = snapEdge(t + dy, edgesY(others, H, guides), snap);
    if (handle.includes('s')) b = snapEdge(b + dy, edgesY(others, H, guides), snap);
    l = clamp(l, 0, W); r = clamp(r, 0, W); t = clamp(t, 0, H); b = clamp(b, 0, H);
    if (r - l < MIN) { if (handle.includes('e')) r = Math.min(W, l + MIN); else l = r - MIN; }
    if (b - t < MIN) { if (handle.includes('s')) b = Math.min(H, t + MIN); else t = b - MIN; }
    return { x: l, y: t, w: r - l, h: b - t };
  }

  // The lines to draw while dragging: where an edge of the box lines up exactly with an edge of another widget or a guideline
  // (the page's own edges are left out). { v: [x...], h: [y...] }
  function snapLines(box, others, W, H, guides) {
    const near = (a, b) => Math.abs(a - b) < 0.01, hit = (edges, mine) => [...new Set(mine.filter(m => edges.some(e => near(e, m))).map(m => Math.round(m * 100) / 100))];
    const ex = edgesX(others, W, guides).filter(e => e > 0 && e < W), ey = edgesY(others, H, guides).filter(e => e > 0 && e < H);
    return { v: hit(ex, [box.x, box.x + box.w]), h: hit(ey, [box.y, box.y + box.h]) };
  }
  // Tidy to the grid: every edge goes to the nearest grid line (or the page's edge when that is closer), so widgets that touched still touch.
  // Returns the new { x, y, w, h } for each widget in the list, in the same order.
  function tidy(list, W, H) {
    const edge = (v, max) => { const g = clamp(Math.round(v / GRID) * GRID, 0, max); return Math.abs(max - v) < Math.abs(g - v) ? max : g; };
    return list.map(w => {
      let l = edge(w.x, W), r = edge(w.x + w.w, W), t = edge(w.y, H), b = edge(w.y + w.h, H);
      if (r - l < MIN) { if (l + MIN <= W) r = l + MIN; else l = r - MIN; }
      if (b - t < MIN) { if (t + MIN <= H) b = t + MIN; else t = b - MIN; }
      return { x: l, y: t, w: r - l, h: b - t };
    });
  }

  // ---- arranging several widgets (1.47.0) ----
  // Each of these takes the widgets (anything with x, y, w, h) and gives back the new { x, y, w, h } for each one, in the same order. Nothing is changed in place.
  // where: 'left' | 'center' | 'right' (across) or 'top' | 'middle' | 'bottom' (down); to: the box they line up with ({ x, y, w, h }: the selection's box, or the page for one widget)
  function alignRects(list, where, to) {
    return list.map(g => {
      const q = { x: g.x, y: g.y, w: g.w, h: g.h };
      if (where === 'left') q.x = to.x; else if (where === 'right') q.x = to.x + to.w - g.w; else if (where === 'center') q.x = r2(to.x + (to.w - g.w) / 2);
      else if (where === 'top') q.y = to.y; else if (where === 'bottom') q.y = to.y + to.h - g.h; else if (where === 'middle') q.y = r2(to.y + (to.h - g.h) / 2);
      return q;
    });
  }
  // The same gap between neighbours: the first and the last (by place) stay, the ones between spread out. axis: 'x' (across) or 'y' (down).
  // Gives null when the widgets are wider together than the room between the outer ones (there would be no gap).
  function distributeRects(list, axis) {
    const pos = axis === 'x' ? 'x' : 'y', size = axis === 'x' ? 'w' : 'h';
    const order = list.map((g, i) => i).sort((a, b) => list[a][pos] - list[b][pos] || a - b);
    if (order.length < 3) return list.map(g => ({ x: g.x, y: g.y, w: g.w, h: g.h }));
    const first = list[order[0]], last = list[order[order.length - 1]];
    const span = last[pos] + last[size] - first[pos], used = order.reduce((n, i) => n + list[i][size], 0), gap = (span - used) / (order.length - 1);
    if (gap < 0) return null;
    const out = list.map(g => ({ x: g.x, y: g.y, w: g.w, h: g.h }));
    let at = first[pos];
    order.forEach(i => { out[i][pos] = r2(at); at += list[i][size] + gap; });
    return out;
  }
  // Mirrored places. kind: 'sel-x' left to right inside the box of the list, 'page-x' around the middle of the page, 'sel-y' top to bottom inside the box of the list
  function mirrorRects(list, kind, W, H) {
    const b = bbox(list);
    return list.map(g => {
      const q = { x: g.x, y: g.y, w: g.w, h: g.h };
      if (kind === 'sel-x') q.x = r2(2 * b.x + b.w - g.x - g.w); else if (kind === 'page-x') q.x = r2(W - g.x - g.w); else if (kind === 'sel-y') q.y = r2(2 * b.y + b.h - g.y - g.h);
      return q;
    });
  }
  // A widget mirrored left to right also swaps its left and right text alignment (center stays) and flips its pictures when it has a Mirror setting.
  // Gives only what changes: { titleAlign, valueAlign, opt } (opt is a complete new copy of the widget's settings).
  const MIRROR_KEYS = ['carMirror', 'avatarMirror', 'flagMirror', 'imageMirror'];
  function mirrorSettings(w) {
    const d = def(w.type), out = {}, swap = a => (a === 'left' ? 'right' : a === 'right' ? 'left' : a);
    if (!d.button) {
      const t = titleAlignOf(w); if (t !== 'center') out.titleAlign = swap(t);
      { const v = valueAlignOf(w); if (v !== 'center') out.valueAlign = swap(v); } // (a Leaderboard has no text alignment: valueAlignOf says center)
    }
    const keys = MIRROR_KEYS.filter(k => (d.options || []).some(o => o.key === k));
    if (keys.length) { out.opt = { ...(w.opt || {}) }; keys.forEach(k => { out.opt[k] = !out.opt[k]; }); }
    return out;
  }
  // Resizing several widgets at once: the box that held them (box0) became nb; every widget keeps its place in it (its edges scale with the box).
  // An edge that was the edge of the box goes exactly where the box's edge went (so a magnet or a guideline stays exact); the others go to the grid when snapping (snap is true or 'grid') or to whole units.
  function scaleGroup(from, box0, nb, snap, W, H) {
    const sx = box0.w > 0 ? nb.w / box0.w : 1, sy = box0.h > 0 ? nb.h / box0.h : 1;
    const edge = (v, lo, newLo, scale) => {
      if (v === lo) return newLo;
      if (v === lo + (scale === sx ? box0.w : box0.h)) return newLo + (scale === sx ? nb.w : nb.h);
      if (scale === 1) return newLo + (v - lo); // (this way is not resized: the widgets are not moved to the grid)
      const at = newLo + (v - lo) * scale;
      return snap ? Math.round(at / GRID) * GRID : Math.round(at);
    };
    return from.map(g => {
      let l = edge(g.x, box0.x, nb.x, sx), r = edge(g.x + g.w, box0.x, nb.x, sx), t = edge(g.y, box0.y, nb.y, sy), b = edge(g.y + g.h, box0.y, nb.y, sy);
      l = clamp(l, 0, W); r = clamp(r, 0, W); t = clamp(t, 0, H); b = clamp(b, 0, H);
      if (r - l < MIN) { if (l + MIN <= W) r = l + MIN; else l = r - MIN; }
      if (b - t < MIN) { if (t + MIN <= H) b = t + MIN; else t = b - MIN; }
      return { x: r2(l), y: r2(t), w: r2(r - l), h: r2(b - t) };
    });
  }

  // Explicit presentation adapters. Saved layouts retain only their existing type.
  const LAYOUT_GROUPS = {
    list:['lastlap'], stock:['tyresets'], gauge:['tyrelife','pace','fuel'],
    rows:['leaderboard'], weather:['tyre','wxforecast','wxconditions'],
    delta:['dlaptime','dlaplap','davglap','dmedlap','dbestlap','drecordlap','dpitstop','dsessionrecord','dtrackrecord'],
    media:['lights','flag','logo','avatar','driverflag','lanecolor','carpicture','teampicture','imagelane','imagerace'],
    chart:['racechart'], flow:['heatlist','nextheat','sessionrecord','trackrecord','classname'], pitcontrol:['needsattention','recentevents']
  };
  for (const d of REGISTRY) {
    d.layout = Object.entries(LAYOUT_GROUPS).find(([,types])=>types.includes(d.type))?.[0]
      || (Aio.TYPES.has(d.type)?'aio':Stw.TYPES?.has(d.type)?'strategy':'text');
    d.updates = ['name','nickname','callsign','carname'].includes(d.type)?'identity':'frame';
  }
  function layoutOfWidget(w) {
    if(w.opt?.composition)return 'composition';
    if(w.type==='clock'&&['digital','pitwall','timing'].includes(w.opt?.style))return 'clock';
    return def(w.type)?.layout||'text';
  }

  const newWidget = (type, lane, x, y) => {
    const d = def(type);
    return { id: uid(), type, lane: d.perLane ? lane || 0 : null, x, y, w: d.w, h: d.h, textSize: '', textColor: '', bgColor: '', title: '', showTitle: !d.noTitle, titleSize: '', titleBold: false, valueBold: true, valueItalic: false, opt: type==='tyrelife'?{barStyle:'original'}:{} };
  };

  // ---- groups, titles, colours, guidelines, duplicating ----
  const bbox = list => {
    const l = Math.min(...list.map(g => g.x)), t = Math.min(...list.map(g => g.y));
    return { x: l, y: t, w: Math.max(...list.map(g => g.x + g.w)) - l, h: Math.max(...list.map(g => g.y + g.h)) - t };
  };
  // A widget's own colour wins, then its lane's colour, then the theme (an empty string means "theme").
  const colorsOf = (w, layout) => {
    const lc = (layout && layout.laneColors && w.lane !== null && w.lane !== undefined && layout.laneColors[w.lane]) || {};
    const F = frameModule(), mode = F ? F.laneStyle(w, layout) : 'full';
    if(w.type==='clock'&&w.opt?.flagColour!==false)return {color:'var(--clock-green)',bg:F?.modern(w,layout)?F.baseColour(w,layout):w.bgColor||''};
    if (F?.modern(w, layout)) return {color:w.textColor||'',bg:F.baseColour(w,layout)};
    if (mode !== 'full' && def(w.type)?.perLane) return { color: w.textColor || (w.bgColor ? (F.hex(w.bgColor) ? Dl.onColor(w.bgColor) : lc.text || '') : ''), bg: w.bgColor || '' };
    return { color: w.textColor || lc.text || '', bg: w.bgColor || lc.bg || '' };
  };
  const laneBackgroundOf = (w, layout) => def(w.type)?.perLane && Number.isInteger(w.lane) && w.lane >= 0 && w.lane < LANES ? cssVal(layout && layout.laneColors && layout.laneColors[w.lane]?.bg) : '';
  // Text styling shared by the editor and the live page. Old layouts without these
  // settings look as before (bold value). Titles are overlays, so they never move
  // the displayed value away from the mathematical centre of its widget.
  const valueStyleOf = w => {
    const a = valueAlignOf(w), justify = a === 'left' ? 'flex-start' : a === 'right' ? 'flex-end' : 'center';
    return `font-weight:${w.valueBold === false ? 400 : 600};${w.valueItalic ? 'font-style:italic;' : ''}justify-content:${justify};text-align:${a};`;
  };
  const titleStyleOf = w => {
    const a = titleAlignOf(w);
    // A title is always an overlay: the changing value owns the complete frame's
    // centre.  Kept titleSpace data from older layouts is deliberately ignored.
    const pos = `left:12px;right:12px;top:6px;text-align:${a};`;
    return `font-size:${(w.titleSize || 12) / 10}cqw;${w.type==='clock'?'color:var(--muted);':''}${w.titleBold ? 'font-weight:700;' : ''}${pos}`;
  };
  // Alignment of the title and of the text (the value) in a widget: left, center or right. The standard is what the widgets always did: title left, value centered.
  // The Leaderboard has no text alignment (its columns come from the layout you make); a Leaderboard still has a title. A header cell of a row design follows its column.
  const ALIGNS = [['left', 'Left'], ['center', 'Center'], ['right', 'Right']];
  const alignOf = (v, standard) => (ALIGNS.some(a => a[0] === v) ? v : standard);
  const titleAlignOf = w => alignOf(w && w.titleAlign, 'left'), valueAlignOf = w => (w && w.type === 'leaderboard' ? 'center' : alignOf(w && w.valueAlign, Pcw.TYPES.has(w?.type)?'left':'center'));
  const alignClassOf = w => (titleAlignOf(w) === 'left' ? '' : titleAlignOf(w) === 'center' ? ' ta-c' : ' ta-r') + (valueAlignOf(w) === 'center' ? '' : valueAlignOf(w) === 'left' ? ' va-l' : ' va-r');
  const titleOf = w => ((w.title && w.title.trim()) || def(w.type).title || def(w.type).label);
  const showTitleOf = w => w.showTitle !== false && !def(w.type).button;
  // dir: 'vertical' | 'horizontal' | 'both'; count lanes give count - 1 evenly spaced lines
  function guidesFor(count, dir, W, H) {
    const at = (len, i) => Math.round(len * i / count * 100) / 100, v = [], h = [];
    for (let i = 1; i < count; i++) { if (dir !== 'horizontal') v.push(at(W, i)); if (dir !== 'vertical') h.push(at(H, i)); }
    return { v, h };
  }
  // Copies of the selection for the next lane, one step away (default: just below the group).
  function duplicateWidgets(sel, step, W, H) {
    const box = bbox(sel), s = step || { x: 0, y: box.h + 2 * GRID };
    const dx = clamp(s.x, -box.x, W - box.x - box.w), dy = clamp(s.y, -box.y, H - box.y - box.h);
    return sel.map(g => ({ ...JSON.parse(JSON.stringify(g)), id: uid(), x: g.x + dx, y: g.y + dy, lane: g.lane === null || g.lane === undefined ? g.lane : Math.min(LANES - 1, g.lane + 1) }));
  }
  // The saved order is the paint order: later widgets appear in front of earlier
  // ones, including their shadows. Move a selection by one neighbouring layer or
  // all the way to either edge without changing its internal order.
  function stackWidgets(list, selected, where) {
    const all = Array.isArray(list) ? [...list] : [], pick = new Set(selected || []);
    if (!pick.size || !['front', 'forward', 'backward', 'back'].includes(where)) return all;
    if (where === 'front') return [...all.filter(w => !pick.has(w)), ...all.filter(w => pick.has(w))];
    if (where === 'back') return [...all.filter(w => pick.has(w)), ...all.filter(w => !pick.has(w))];
    if (where === 'forward') for (let i = all.length - 2; i >= 0; i--) if (pick.has(all[i]) && !pick.has(all[i + 1])) [all[i], all[i + 1]] = [all[i + 1], all[i]];
    if (where === 'backward') for (let i = 1; i < all.length; i++) if (pick.has(all[i]) && !pick.has(all[i - 1])) [all[i], all[i - 1]] = [all[i - 1], all[i]];
    return all;
  }
  const stepFrom = (srcBox, copies) => { const b = bbox(copies); return { x: b.x - srcBox.x, y: b.y - srcBox.y }; };

  // The built-in layout: a header, one row per lane (up to six), and the race controls.
  function defaultLayout() {
    const L = { id: 'default', name: 'Default layout', ratioW: 16, ratioH: 9, widgets: [], guides: { v: [], h: [] }, laneColors: [] };
    const add = (type, x, y, w, h, lane) => { const g = newWidget(type, lane, x, y); g.w = w; g.h = h; L.widgets.push(g); };
    add('clock', 10, 10, 200, 60); add('info', 220, 10, 330, 60); add('flag', 560, 10, 200, 60); add('lights', 770, 10, 220, 60);
    for (let lane = 0; lane < 6; lane++) {
      const y = 90 + lane * 65, h = 58;
      add('position', 10, y, 60, h, lane); add('driverflag', 75, y, 60, h, lane); add('name', 140, y, 210, h, lane);
      add('lap', 355, y, 95, h, lane); add('laptime', 455, y, 135, h, lane); add('lastlap', 595, y, 135, h, lane);
      add('bestlap', 735, y, 135, h, lane); add('gap', 875, y, 115, h, lane);
    }
    add('start', 10, 490, 150, 62); add('pause', 170, 490, 170, 62); add('stop', 350, 490, 120, 62);
    add('yellow', 480, 490, 170, 62); add('red', 660, 490, 150, 62);
    return L;
  }

  // The built-in layout for a Time Token Session: a header, then one row per lane (up to eight): lane, driver, Token Clock, last lap, best lap; and the controls.
  function tokenLayout() {
    const L = { id: 'default-tokens', name: 'Default token layout', ratioW: 16, ratioH: 9, widgets: [], guides: { v: [], h: [] }, laneColors: [] };
    const add = (type, x, y, w, h, lane, opt) => { const g = newWidget(type, lane, x, y); g.w = w; g.h = h; if (opt) g.opt = opt; L.widgets.push(g); };
    add('info', 10, 10, 330, 60); add('flag', 350, 10, 200, 60);
    for (let lane = 0; lane < LANES; lane++) {
      const y = 80 + lane * 52, h = 46;
      add('textlane', 10, y, 110, h, lane, { text: 'Lane {lane}' }); add('name', 125, y, 250, h, lane); add('tokenclock', 380, y, 200, h, lane);
      add('lastlap', 585, y, 190, h, lane); add('bestlap', 780, y, 210, h, lane);
    }
    add('start', 10, 500, 150, 52); add('pause', 170, 500, 170, 52); add('stop', 350, 500, 120, 52);
    return L;
  }

  const picSites = { av: SITE_AV, img: SITE_IMG, flag: SITE_FLAG, fuel: SITE_FUEL, lights: SITE_LIGHTS }; // (where the text of the pictures is kept: for the tests)
  const api = { layoutOfWidget, clockHtml, fitClock, lightPictures, lightSetPictures, prepareLights, picSites, heatListHtml, HEATLIST_OPTIONS, nextHeatHtml, NEXTHEAT_OPTIONS, totalTimeHtml, TOTALTIME_OPTIONS, ttScope, ttPenalties, tokenLayout, cssVal, lightsHtml, flagHtml, ledHtml, flagStyleOf, FLAG_STYLES, FLAG_COLORS, lightColor, lightCount, LIGHT_ROWS, LIGHT_COLS, lightKey, lightKeys, lightPic, lightBehind, IMG_OPS, ruleHolds, pickImage, imageHtml, flagImgHtml, avatarHtml, fillText, TEXT_LANE_VARS, TEXT_RACE_VARS, TEXT_LANE_DEFAULT, TEXT_RACE_DEFAULT, U, GRID, MIN, MAG, LANES, bbox, colorsOf, laneBackgroundOf, titleOf, showTitleOf, guidesFor, duplicateWidgets, stackWidgets, stepFrom, REGISTRY, def, valueStyleOf, titleStyleOf, ALIGNS, titleAlignOf, valueAlignOf, alignClassOf, lapCountOf, lapTotalOn, sampleOf, fuelHtml, frameOf, frameTransform, panFrame, zoomFrame, lapListHtml, leaderHtml, clampInt, FLAG_STATES, CLOCK_STYLES, clockStyleOf, clockClassOf, GAP_OPTIONS, resolveOpt, quantityBarHtml, heightOf, withoutControls, moveWidget, resizeWidget, snapLines, tidy, alignRects, distributeRects, mirrorRects, mirrorSettings, MIRROR_KEYS, scaleGroup, newWidget, defaultLayout };
  root.Widgets = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
