// The widget register, the layout geometry (moving, resizing, snapping) and the built-in default layout.
// The layout editor and the live timing page both read their widget list from REGISTRY.
(function (root) {
  const U = 1000;   // a layout is always 1000 units wide; its height follows the proportions
  const GRID = 5;   // grid size in units
  const LANES = 8;  // most lanes a layout can use
  const MAG = 8;    // how close (in units) another widget's edge pulls a moving widget
  const MIN = 40;   // smallest widget size

  const Av = typeof module !== 'undefined' ? require('./avatars.js') : root.Avatars; // the standard avatars of the lanes
  const Dl = typeof module !== 'undefined' ? require('./delta.js') : root.Delta; // the Delta Timers (what is compared, and the badge)
  const Bo = typeof module !== 'undefined' ? require('./boardorder.js') : root.BoardOrder; // the order of a leaderboard (Order by)
  const Ww = typeof module !== 'undefined' ? require('./weatherwidgets.js') : root.WxW; // the weather widgets: Tyres, Weather Forecast, Track Conditions (the options, the samples)
  const NAMES = ['Alex', 'Sam', 'Kim', 'Lee', 'Max', 'Zoe'];
  const NICKS = ['Speedy', 'Sammy', 'Kimbo', 'Leeroy', 'Maxi', 'Zo'];
  const FLAGS = ['nl', 'de', 'gb', 'us', 'jp', 'fr'];
  const T = (type, label, group, o) => ({ type, label, group, perLane: false, w: 150, h: 60, textSize: 30, options: [], button: false, ...o });
  const TIME_OPTIONS = [
    { key: 'holdSeconds', label: 'Show finished lap for (seconds)', type: 'number', default: 3 },
    { key: 'pbColor', label: 'Personal best colour', type: 'color', default: '#a45cff' },
    { key: 'recordColor', label: 'Track record colour', type: 'color', default: '#ffc400' }
  ];

  const esc = x => String(x ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // A colour that is put into a style: only plain colour text (#fa0, rgb(1,2,3), var(--accent), a name) gets through, so a damaged or imported file can never add anything else to the page.
  const cssVal = v => { const t = String(v ?? '').trim(); return /^[#\w\s.,%()-]{1,60}$/.test(t) && !/url|expression|import|@/i.test(t) ? t : ''; };
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
    ['damage', 'Damage points (Damage System)'], ['damagelevel', 'Damage level (Light damage, Heavy damage...)'], ['repairs', 'Repairs made (Damage System)'],
    ['nextdriver', 'Next driver of the team (Endurance Race)'], ['swap', 'Time to the next driver swap (Endurance Race)'], ['stint', 'How long the driver has been at the wheel (Endurance Race)']];
  const TEXT_RACE_VARS = [['clock', 'Race clock (counting up)'], ['timeleft', 'Time left'], ['lapsleft', 'Laps left'], ['lapstotal', 'Lap limit'], ['leader', 'Leader'], ['flag', 'Flag / race state'], ['heat', 'Heat'],
    ['track', 'Track name'], ['session', 'Race setup name'], ['type', 'Session type'], ['sessionrecord', 'Session record lap'], ['sessionrecordby', 'Session record driver'], ['trackrecord', 'Track record lap'], ['trackrecordby', 'Track record driver'], ['yellowtarget', 'Yellow flag target lap time (empty when there is none)'],
    ['weather', 'Weather now (Dry, Cloudy, Wet, Clearing; a dash without a weather system)'], ['nextweather', 'The next change of the weather and when (Rain in 3 laps; empty when there is none)'], ['tracktemp', 'Track temperature (30 \u00B0C)'], ['airtemp', 'Air temperature (24 \u00B0C)'], ['windspeed', 'Wind speed (10 km/h)'], ['winddir', 'Wind direction (SW)']];
  const TEXT_LANE_DEFAULT = '{position}. {name}  {best}', TEXT_RACE_DEFAULT = '{timeleft} left';
  const fillText = (text, vars) => esc(String(text ?? '')).replace(/\{(\w+)\}/g, (m, k) => (Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k] ?? '') : m));
  const textOpts = (vars, dflt) => [{ key: 'text', label: 'Text, with {variables}', type: 'text', default: dflt }, { key: 'vars', label: 'Variables: ' + vars.map(v => '{' + v[0] + '} ' + v[1]).join(', '), type: 'note' }];

  // The start lights: five circles drawn as one picture that scales to the widget, so they stay round at any size or shape.
  // pics: { on, off } pictures from a picture set (a light without a picture is drawn as a plain circle)
  // pics: { on, off } (one lit and one unlit picture for all five lights), or { pick(i, lit) } that gives the picture of light i (0 to 4), as the picture grid of a set does
  const lightsHtml = (on, pics, color) => `<svg class="slsvg" viewBox="0 0 500 100" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Start lights">${[0, 1, 2, 3, 4].map(i => {
    const lit = i < on, src = pics && (typeof pics.pick === 'function' ? pics.pick(i, lit) : (lit ? pics.on : pics.off)), cls = 'sl' + (lit ? ' on' : '');
    return src ? `<image class="${cls}" href="${esc(src)}" x="${i * 100 + 4}" y="4" width="92" height="92" preserveAspectRatio="xMidYMid meet"/>` : `<circle class="${cls}" cx="${50 + i * 100}" cy="50" r="42"${lit && cssVal(color) ? ` style="fill:${cssVal(color)}"` : ''}/>`;
  }).join('')}</svg>`;
  // The Race flag widget's pictures, drawn like the pictures on the Live Race tiles (24 x 24, a rounded line in the text colour) with the colour of the
  // flag filled in: a waving flag on a pole (it can be mirrored, for a flag on the right of the page) or a round LED. One picture that scales to the widget
  // (the lights do the same). The chequered flag of the end of a heat or race is cut from the same curve as the cloth, so the squares bend with it.
  const FLAG_COLORS = { ready: '#4c9aff', running: '#2ecc40', paused: '#8a93a0', yellow: '#ffd400', red: '#d62828' };
  const FLAG_NAMES = { ready: 'Pre-Race', running: 'Racing (green flag)', paused: 'Paused', between: 'Heat finished (chequered flag)', finished: 'Finished (chequered flag)', yellow: 'Yellow flag', red: 'Red flag' };
  const FLAG_STYLES = [['flags', 'Flags'], ['leds', 'LEDs'], ['text', 'Text (the background turns yellow or red)'], ['images', 'Image set (made under Customization > Image Settings)']];
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
  const numOf = x => { const t = String(x ?? '').trim(); return /^[-+]?\d+([.,]\d+)?\s*(%|L)?$/.test(t) ? parseFloat(t.replace(',', '.')) : NaN; };
  function ruleHolds(r, vars) {
    if (!r || !r.var || !Object.prototype.hasOwnProperty.call(vars, r.var)) return false;
    const a = String(vars[r.var] ?? '').trim(), b = String(r.value ?? '').trim(), na = numOf(a), nb = numOf(b), num = Number.isFinite(na) && Number.isFinite(nb);
    const eq = num ? na === nb : a.toLowerCase() === b.toLowerCase();
    switch (r.op) { case '!=': return !eq; case '<': return num && na < nb; case '>': return num && na > nb; case '<=': return num && na <= nb; case '>=': return num && na >= nb; default: return eq; }
  }
  const pickImage = (opt, vars) => { const hit = ((opt && opt.rules) || []).find(r => r.image && ruleHolds(r, vars)); return hit ? hit.image : (opt && opt.image) || ''; };
  // a picture of the Race flag widget (a picture set): mirror flips it left to right
  const flagImgHtml = (src, alt, mirror) => `<img class="flagimg" src="${esc(src)}" alt="${esc(alt || '')}"${mirror ? ' style="transform:scaleX(-1)"' : ''}>`;
  const imageHtml = (src, fit) => (src ? `<img class="flagimg" src="${esc(src)}" alt=""${fit === 'cover' ? ' style="width:100%;height:100%;object-fit:cover"' : ''}>` : '');
  const imgSample = (l, w) => { const o = (w && w.opt) || {}, src = o.image || ((o.rules || []).find(r => r.image) || {}).image; return src ? imageHtml(src, o.fit) : '<span class="muted">Image</span>'; };

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
  const LIGHTS_OPTIONS = [SET_OPTION('lights'), { key: 'lightsnote', type: 'note', label: 'While the race counts down the lights come on one by one. For every other state of the race you can choose how many of the five lights are on, and their colour (a colour is used for round lights; a picture set shows the pictures it has for that state of the race, see Customization > Image Settings). A choice here wins over the Race Setup setting \"Start lights after the race has started\", which lights all five for green, yellow and red when set to follow the race flag.' },
    ...LIGHT_STATES.flatMap(([k, label]) => [
      { key: 'lights_' + k, label: `${label}: lights on`, type: 'select', default: '0', choices: [['0', 'None'], ['1', '1 light'], ['2', '2 lights'], ['3', '3 lights'], ['4', '4 lights'], ['5', 'All 5 lights']] },
      { key: 'lightcol_' + k, label: `${label}: colour`, type: 'color', default: LIGHT_COLORS[k] }])];
  const CLOCK_OPTIONS = [{ key: 'countdown', label: 'Count down the time left in a race with a time limit', type: 'checkbox', default: true }, { key: 'flagColour', label: 'Change colour with the flag (yellow, red)', type: 'checkbox', default: true }];
  const RECORD_OPTIONS = [{ key: 'showName', label: 'Show who set it', type: 'checkbox', default: true }];
  const LEADER_OPTIONS = [
    { key: 'design', label: 'Row design', type: 'rowdesign', default: '' },
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
    { key: 'colFuel', classic: true, label: 'Fuel left', type: 'checkbox', default: false }
  ];
  const optOf = (o, key) => { const d = LEADER_OPTIONS.find(x => x.key === key); return o && o[key] !== undefined ? o[key] : d.default; };
  // rows: [{ pos, flag, name, nickname, callsign, laps, best, last, current, gap, color, bg }] (already formatted text)
  function leaderHtml(rows, opt) {
    const on = k => optOf(opt, k), by = on('driverBy');
    const cols = [['Pos', 'pos', true], ['', 'flag', on('colFlag')], ['Driver', by, true], ['Callsign', 'callsign', on('colCallsign') && by !== 'callsign'],
      ['Nickname', 'nickname', on('colNickname') && by !== 'nickname'], ['Laps', 'laps', on('colLaps')], ['Best', 'best', on('colBest')],
      ['Last', 'last', on('colLast')], ['Current', 'current', on('colCurrent')], ['Fuel', 'fuel', on('colFuel')], ['Gap', 'gap', on('colGap')]].filter(c => c[2]);
    const cell = (r, k) => k === 'flag' ? (r.flag ? `<span class="fi fi-${esc(String(r.flag).toLowerCase())}"></span>` : '') : esc(r[k]);
    return `<table class="lb">${rows.map(r => `<tr${cssVal(r.bg) || cssVal(r.color) ? ` style="${cssVal(r.bg) ? 'background:' + cssVal(r.bg) + ';' : ''}${cssVal(r.color) ? 'color:' + cssVal(r.color) : ''}"` : ''}>${cols.map(c => `<td class="lb-${c[1]}">${cell(r, c[1])}</td>`).join('')}</tr>`).join('')}</table>`;
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
  const timeText = ms => { const m = Math.floor(ms / 60000), x = (ms % 60000) / 1000; return m ? m + ':' + x.toFixed(3).padStart(6, '0') : x.toFixed(3); }; // (as RaceEngine.fmtTime)
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
  const HEATLIST_SAMPLE = { idx: 1, by: 'points', list: [
    { name: 'Heat 1', drivers: [{ lane: 0, name: 'Alex' }, { lane: 1, name: 'Sam' }, { lane: 2, name: 'Kim' }], rows: [{ pos: 1, name: 'Sam', points: 10, laps: 10 }, { pos: 2, name: 'Alex', points: 8, laps: 10 }, { pos: 3, name: 'Kim', points: 6, laps: 9 }] },
    { name: 'Heat 2', drivers: [{ lane: 0, name: 'Kim' }, { lane: 1, name: 'Alex' }, { lane: 2, name: 'Sam' }], rows: [] },
    { name: 'Heat 3', drivers: [{ lane: 0, name: 'Sam' }, { lane: 1, name: 'Kim' }, { lane: 2, name: 'Alex' }], rows: [] }] };

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
    if (w.type === 'wxforecast' && set.kind === 'weather') return { ...o, stateImages: set.images || {} };
    if (w.type === 'wxconditions' && set.kind === 'conditions') return { ...o, condImages: set.images || {} };
    if (w.type === 'flag' && set.kind === 'flag') { const r = { ...o }; FLAG_STATES.forEach(([k]) => { r['img_' + k] = (set.images || {})[k] || ''; }); return r; }
    return o;
  }
  // an avatar or a slotcar picture in its round (or square) frame, with the position and zoom of the widget; mirror flips the picture left to right inside the frame
  const avatarHtml = (src, opt) => `<span class="avframe"><img class="avimg" src="${esc(src)}" alt="" style="transform:${frameTransform(opt && opt.frame)}${opt && opt.avatarMirror ? ' scaleX(-1)' : ''}"></span>`;
  // The Avatar widget: the driver's picture, or when the driver has none the avatar of the lane (the standard ones, or a picture set of the kind Avatars)
  // Team Name and Team Picture (1.8.0): the team of the lane (a team chosen on Home), or one team from Database > Teams that the widget always shows
  const TEAM_OPTION = { key: 'team', label: 'Team to show', type: 'team', default: '' };
  // Endurance Race: the driver at the wheel, the driver who is next, and the time to the swap
  const DRIVER_SHOW = { key: 'show', label: 'Show', type: 'select', default: 'name', choices: [['name', 'The name'], ['nickname', 'The nickname'], ['callsign', 'The callsign']] };
  const CURDRIVER_OPTIONS = [DRIVER_SHOW, { key: 'stint', label: 'Add how long he has been at the wheel', type: 'checkbox', default: false }];
  const NEXTDRIVER_OPTIONS = [DRIVER_SHOW, { key: 'prefix', label: 'Put "Next:" in front', type: 'checkbox', default: false }];
  const SWAPTIMER_OPTIONS = [
    { key: 'show', label: 'Show', type: 'select', default: 'words', choices: [['words', 'Words ("Swap in 12:30")'], ['clock', 'Only the clock (12:30)']] },
    { key: 'soonColor', label: 'Colour when the swap is near (the warning of the race setup)', type: 'color', default: '#ffb000' },
    { key: 'dueColor', label: 'Colour when the swap is due', type: 'color', default: '#e03131' }];
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
  const TEAMPIC_OPTIONS = [TEAM_OPTION, { key: 'frame', label: 'Picture position and zoom', type: 'frame', from: 'team' }];
  const TEAM_SAMPLES = ['Red Racers', 'Blue Bandits', 'Green Giants', 'Gold Gang', 'Night Owls', 'Pit Crew'];
  const AVATAR_OPTIONS = [{ ...SET_OPTION('avatars'), label: 'Avatars for a driver without a picture (sets are made under Customization > Image Settings)' },
    { key: 'avatarMirror', label: 'Mirror the pictures (flip them left to right)', type: 'checkbox', default: false },
    { key: 'frame', label: 'Picture position and zoom', type: 'frame', from: 'avatar' }];
  const CARPIC_OPTIONS = [{ key: 'carMirror', label: 'Mirror the picture (flip it left to right)', type: 'checkbox', default: false }, // (1.30.1: as the Avatar widget has)
    { key: 'frame', label: 'Picture position and zoom', type: 'frame', from: 'car' }];

  // Fuel widget: a number, a bar, both, or one of your own pictures from full to empty.
  const FUEL_OPTIONS = [
    SET_OPTION('fuel'),
    { key: 'mode', label: 'Show fuel as', type: 'select', default: 'both', choices: [['number', 'Number'], ['bar', 'Bar'], ['both', 'Bar and number'], ['images', 'Pictures from the picture set']] },
    { key: 'lowAt', label: 'Warning colour below (% of tank)', type: 'number', default: 25, min: 0, max: 100, step: 1 },
    { key: 'lowColor', label: 'Warning colour', type: 'color', default: '#ffd400' },
    { key: 'critAt', label: 'Critical colour below (% of tank)', type: 'number', default: 10, min: 0, max: 100, step: 1 },
    { key: 'critColor', label: 'Critical colour', type: 'color', default: '#d62828' }
  ]; // pictures come from a picture set (Customization > Image Settings)
  const fuelOpt = (o, k) => (o && o[k] !== undefined ? o[k] : FUEL_OPTIONS.find(x => x.key === k).default);
  // which of n pictures (0 = full ... n-1 = empty) belongs to a fraction of the tank
  const fuelStep = (frac, n) => Math.max(0, Math.min(n - 1, n - Math.ceil(Math.max(0, Math.min(1, frac)) * n - 1e-9)));
  function fuelHtml(litres, tank, opt) {
    if (litres === null || litres === undefined || !(tank > 0)) return '–';
    const frac = Math.max(0, Math.min(1, litres / tank)), pct = frac * 100;
    const col = cssVal(pct < fuelOpt(opt, 'critAt') ? fuelOpt(opt, 'critColor') : pct < fuelOpt(opt, 'lowAt') ? fuelOpt(opt, 'lowColor') : '');
    const txt = `${(Math.floor(litres * 10 + 1e-9) / 10).toFixed(1).replace(/\.0$/, '')} L`, mode = fuelOpt(opt, 'mode');
    if (mode === 'images') {
      const n = clampInt(opt && opt.steps !== undefined ? opt.steps : 10, 2, 20, 10), img = ((opt && opt.stepImages) || [])[fuelStep(frac, n)];
      if (img) return `<img class="fuelimg" src="${esc(img)}" alt="${esc(txt)}">`;
    }
    const num = `<span class="fnum"${col ? ` style="color:${col}"` : ''}>${txt}</span>`;
    if (mode === 'number' || mode === 'images') return num;
    return `<span class="fbar"><span class="ffill" style="width:${Math.round(pct * 10) / 10}%;background:${col || 'var(--accent)'}"></span>${mode === 'both' ? `<span class="ftxt">${txt}</span>` : ''}</span>`;
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

  // Championship points of a heat or round robin race (needs "Overall result counted by: Points")
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

  const REGISTRY = [
    T('nickname', 'Nickname', 'Driver', { perLane: true, w: 170, sample: l => NICKS[l] }),
    T('name', 'Name', 'Driver', { perLane: true, w: 200, sample: l => NAMES[l] }),
    T('callsign', 'Callsign', 'Driver', { perLane: true, w: 100, sample: l => ['ALX', 'SAM', 'KIM', 'LEE', 'MAX', 'ZOE', 'JAN', 'TIM'][l] }),
    T('lanecolor', 'Lane Colour', 'Driver', { title: 'Lane colour', perLane: true, w: 60, sample: l => `<span class="lcsample">${l + 1}</span>` }),
    T('avatar', 'Avatar', 'Driver', { perLane: true, w: 80, h: 80, options: AVATAR_OPTIONS, sample: (l, w) => { const o = (w && w.opt) || {}, pic = Av.forLane(o, l); return pic ? avatarHtml(pic, o) : `<span class="av">${NAMES[l % NAMES.length][0]}</span>`; } }),
    T('driverflag', 'Driver Flag', 'Driver', { title: 'Driver flag', perLane: true, w: 90, sample: l => `<span class="fi fi-${FLAGS[l]}"></span>` }),
    T('teamname', 'Team Name', 'Team', { title: 'Team', perLane: true, w: 220, options: [TEAM_OPTION], sample: l => TEAM_SAMPLES[l % TEAM_SAMPLES.length] }),
    T('teampicture', 'Team Picture', 'Team', { title: 'Team picture', perLane: true, w: 100, h: 100, options: TEAMPIC_OPTIONS, sample: l => `<span class="av">${TEAM_SAMPLES[l % TEAM_SAMPLES.length][0]}</span>` }),
    T('currentdriver', 'Current Driver', 'Team', { title: 'Current driver', perLane: true, w: 260, options: CURDRIVER_OPTIONS, sample: l => NAMES[l % NAMES.length] }),
    T('nextdriver', 'Next Driver', 'Team', { title: 'Next driver', perLane: true, w: 260, options: NEXTDRIVER_OPTIONS, sample: l => NAMES[(l + 1) % NAMES.length] }),
    T('swaptimer', 'Swap Timer', 'Team', { title: 'Swap timer', perLane: true, w: 230, options: SWAPTIMER_OPTIONS, sample: l => ['Swap in 12:30', 'Swap in 0:45', 'SWAP NOW'][l % 3] }),
    T('carpicture', 'Slotcar Picture', 'Slotcar', { title: 'Slotcar picture', perLane: true, w: 160, h: 100, options: CARPIC_OPTIONS, sample: l => '<span class="carph">Car picture</span>' }),
    T('carname', 'Slotcar Description', 'Slotcar', { title: 'Slotcar', perLane: true, w: 260, sample: l => ['NSR Ford GT40', 'Slot.it Porsche 962', 'Scalextric Audi R8', 'Fly Ferrari 512', 'Ninco Mazda 787', 'SCX BMW M3', 'Carrera Corvette', 'Avant Slot Lola'][l] }),
    T('position', 'Position in Race', 'Timing', { title: 'Position', perLane: true, w: 70, sample: l => String(l + 1) }),
    T('lap', 'Lap of Lap', 'Timing', { title: 'Lap', perLane: true, w: 100, sample: l => `${4 - (l % 3)}/10` }),
    T('laptime', 'Laptime', 'Timing', { title: 'Lap time', perLane: true, w: 150, sample: l => `3.${42 + l}1`, options: TIME_OPTIONS }),
    T('lastlap', 'Last lap', 'Timing', { perLane: true, options: LAST_OPTIONS, sample: (l, w) => { const o = (w && w.opt) || {}; return lapListHtml(Array.from({ length: 90 }, (_, i) => ({ n: 90 - i, t: `5.${20 + l * 7 + (i % 9)}3` })), o.lapsPerColumn, o.columns, o.lapNumbers !== false); } }),
    T('avglap', 'Average Lap', 'Timing', { title: 'Average lap', perLane: true, sample: l => `5.${40 + l * 5}8` }),
    T('medlap', 'Median Lap', 'Timing', { title: 'Median lap', perLane: true, sample: l => `5.${35 + l * 5}2` }),
    T('bestlap', 'Best Lap (this session)', 'Timing', { title: 'Best lap', perLane: true, sample: l => `5.${10 + l * 6}4` }),
    T('gap', 'Gap to Leader', 'Timing', { title: 'Gap to leader', perLane: true, w: 130, sample: l => (l ? `+${l}.${l * 3}20` : '') }),
    T('recordlap', 'Record Lap Time', 'Timing Records', { title: 'Record lap time', perLane: true, sample: l => `4.${80 + l}7` }),
    T('sessionrecord', 'Session Record Lap', 'Timing Records', { title: 'Session record lap', w: 220, options: RECORD_OPTIONS, sample: (l, w) => `4.912${(!w || !w.opt || w.opt.showName !== false) ? '<small class="rn">Sam</small>' : ''}` }),
    T('trackrecord', 'Track Record', 'Timing Records', { title: 'Track record (ever set)', w: 220, options: RECORD_OPTIONS, sample: (l, w) => `4.587${(!w || !w.opt || w.opt.showName !== false) ? '<small class="rn">Alex</small>' : ''}` }),
    T('fuel', 'Fuel Level', 'Timing', { title: 'Fuel', perLane: true, w: 200, options: FUEL_OPTIONS, sample: (l, w) => fuelHtml(87.5 - l * 20, 120, (w && w.opt) || {}) }),
    T('bop', 'Balance of Power', 'Timing', { title: 'Balance of Power', perLane: true, w: 170, options: BOP_OPTIONS, sample: l => ['BoP \u25BC \u221220%', 'BoP off', 'BoP \u25B2 +15%'][l % 3] }),
    T('speed', 'Slotcar Speed', 'Timing', { title: 'Speed', perLane: true, w: 190, options: SPEED_OPTIONS, sample: (l, w) => { const o = (w && w.opt) || {}, k = (o.unit === 'mph' ? 0.621371 : 1) * (o.mode === 'real' ? 1 : 32), v = (11.7 + l * 0.4) * k; return `${v.toFixed(o.mode === 'real' ? 1 : 0)}${o.showUnit === false ? '' : o.unit === 'mph' ? ' mph' : ' km/h'}`; } }),
    T('penalty', 'Penalty Points', 'Timing', { title: 'Penalty', perLane: true, w: 150, options: PENALTY_OPTIONS, sample: (l, w) => { const o = (w && w.opt) || {}, p = [0, 2, 5, 1, 0, 3][l], s = [0, 0, 5, 0, 0, 0][l]; return o.show === 'time' ? `+${s} s` : o.show === 'both' ? `${p} (+${s} s)` : String(p); } }),
    T('damage', 'Damage', 'Timing', { title: 'Damage', perLane: true, w: 230, options: DAMAGE_OPTIONS, sample: (l, w) => { const o = (w && w.opt) || {}, k = l % 4, lv = ['No damage', 'Light damage', 'Heavy damage', 'Retired'][k], pts = [0, 3, 9, 10][k]; return o.show === 'points' ? String(pts) : o.show === 'level' || !pts ? lv : `${lv} \u00b7 ${pts}`; } }),
    T('repairtimer', 'Repair Timer', 'Timing', { title: 'Repair timer', perLane: true, w: 260, options: REPAIRTIMER_OPTIONS, sample: (l, w) => { const o = (w && w.opt) || {}, k = l % 4, words = ['\u2013', 'Pit whenever you can \u00b7 0:10', 'Pit in 2 laps \u00b7 0:20', 'Repairing 0:07'][k], clock = ['', '0:10', '0:20', '0:07'][k]; return o.show === 'clock' ? clock : words; } }),
    T('champpoints', 'Championship Points', 'Timing', { title: 'Points', perLane: true, w: 150, options: CHAMP_OPTIONS, sample: l => String([10, 8, 6, 5, 4, 3][l] + (l === 0 ? 8 : 0)) }),
    T('pitstop', 'Pitstop Time', 'Timing', { title: 'Pitstop time', perLane: true, w: 150, sample: l => `7.${40 + l}2` }),
    // Delta Timers: the ordinary widget's time on the left and, on the right, a green (faster) or red (slower) badge with the difference (see delta.js)
    ...Object.keys(Dl.KINDS).map(type => { const k = Dl.KINDS[type];
      return T(type, k.label, 'Delta Timers', { title: k.title, perLane: true, w: k.record ? 340 : 290, options: [...Dl.optionsFor(type), ...(type === 'dlaptime' || k.steady ? TIME_OPTIONS : k.record ? RECORD_OPTIONS : [])],
        sample: (l, w) => Dl.sample(sampleOf(def(k.base), (!k.record && Dl.leftShowsOf(w && w.opt) === 'ref') ? l + 1 : l, w), l, (w && w.opt) || {}) }); }),
    T('textlane', 'Custom text (per lane)', 'Custom', { hidden: true, perLane: true, w: 300, noTitle: true, options: textOpts(TEXT_LANE_VARS, TEXT_LANE_DEFAULT), sample: (l, w) => fillText(((w && w.opt) || {}).text ?? TEXT_LANE_DEFAULT, { name: NAMES[l % 6], nickname: NICKS[l % 6], callsign: NAMES[l % 6].toUpperCase(), car: 'Porsche 917', lane: l + 1, position: l + 1, lap: 4, laps: 3, laptime: `2.${l}41`, last: `5.${20 + l}3`, best: `5.${10 + l * 6}4`, avg: `5.${30 + l}0`, median: `5.${28 + l}1`, record: `4.${90 + l}2`, gap: l ? `+${l}.${l * 3}20` : '', fuel: `${(87.5 - l * 20) / 100 * 12}`.slice(0, 4) + ' L', fuelpct: Math.round(87.5 - l * 20) + '%', penpoints: l, pentime: `+${l * 2} s`, champ: 10 - l * 2, pits: 1, pit: `7.${40 + l}2`, speed: 180 - l * 5, speedreal: 5.6 - l * 0.2 }) }),
    T('textrace', 'Custom text (race)', 'Custom', { hidden: true, w: 300, noTitle: true, options: textOpts(TEXT_RACE_VARS, TEXT_RACE_DEFAULT), sample: (l, w) => fillText(((w && w.opt) || {}).text ?? TEXT_RACE_DEFAULT, { clock: '01:23.4', timeleft: '3:37', lapsleft: 4, lapstotal: 10, leader: 'Alex', flag: 'Racing', heat: 'Heat 2 of 3', track: 'Monza', session: 'Club race', type: 'Race', sessionrecord: '4.912', sessionrecordby: 'Sam', trackrecord: '4.587', trackrecordby: 'Alex', yellowtarget: '15.000' }) }),
    T('imagelane', 'Custom image (per lane)', 'Custom', { hidden: true, perLane: true, w: 150, h: 150, noTitle: true, sample: imgSample }),
    T('imagerace', 'Custom image (race)', 'Custom', { hidden: true, w: 150, h: 150, noTitle: true, sample: imgSample }),
    T('clock', 'Race Clock', 'Race', { title: 'Race clock', w: 200, options: CLOCK_OPTIONS, sample: '01:23.4' }),
    T('racelaps', 'Race Laps', 'Race', { title: 'Race laps', w: 140, options: RACELAPS_OPTIONS, sample: (l, w) => { const o = (w && w.opt) || {}; return lapCountOf(o) === 'down' ? '13' : lapTotalOn(o) ? '7/20' : '7'; } }),
    T('tokenclock', 'Token Clock', 'Time Tokens', { title: 'Token clock', perLane: true, w: 200, options: TOKENCLOCK_OPTIONS, sample: l => ['25:00', '12:34', '00:45', '1:05:00', '07:20', '04:59'][l % 6] }),
    // the weather (Race Setup > Weather Systems): the tyre of a lane's car, the weather now and next, and the conditions on the track (see weatherwidgets.js)
    T('tyre', 'Tyres', 'Weather', { title: 'Tyres', perLane: true, w: 140, h: 80, textSize: 22, options: Ww.TYRE_OPTIONS, sample: (l, w) => Ww.tyreSample(l, (w && w.opt) || {}) }),
    T('wxforecast', 'Weather Forecast', 'Weather', { title: 'Weather', w: 240, h: 80, options: Ww.FORECAST_OPTIONS, sample: (l, w) => Ww.forecastSample((w && w.opt) || {}) }),
    T('wxconditions', 'Track Conditions', 'Weather', { title: 'Track conditions', w: 500, h: 60, textSize: 20, options: Ww.COND_OPTIONS, sample: (l, w) => Ww.conditionsSample((w && w.opt) || {}) }),
    T('lights', 'Start Lights', 'Race', { title: 'Start lights', w: 180, options: LIGHTS_OPTIONS, sample: lightsHtml(3) }),
    T('info', 'Race Info', 'Race', { title: 'Race info', w: 300, sample: 'Heat 2 of 3 · 4 laps left' }),
    T('flag', 'Race Flag', 'Race', { title: 'Race flag', w: 180, optsLabel: 'Flag style', options: FLAG_OPTIONS, sample: (l, w) => { const o = (w && w.opt) || {}, st = flagStyleOf(o), i = o.img_running;
      return st === 'images' && i ? flagImgHtml(i, '', !!o.imageMirror) : st === 'flags' ? flagHtml('running', { mirror: !!o.flagMirror }) : st === 'leds' ? ledHtml('running') : 'Racing'; } }),
    T('leaderboard', 'Leaderboard', 'Race', { w: 420, h: 220, textSize: 18, options: LEADER_OPTIONS, sample: (l, w) => leaderHtml(NAMES.slice(0, 4).map((n, i) => ({ pos: i + 1, flag: FLAGS[i], name: n, nickname: NICKS[i], callsign: n.slice(0, 3).toUpperCase(), laps: String(5 - (i > 2 ? 1 : 0)), best: `5.${10 + i * 6}4`, last: `5.${30 + i}2`, current: `2.${i}40`, fuel: `${90 - i * 20} L`, gap: i ? `+${i}.${i * 3}20` : '' })), (w && w.opt) || {}) }),
    T('heatlist', 'Heat List', 'Race', { title: 'Heat list', w: 460, h: 200, textSize: 18, options: HEATLIST_OPTIONS, sample: (l, w) => heatListHtml(HEATLIST_SAMPLE, 'running', (w && w.opt) || {}) }),
    T('logo', 'Logo', 'Race', { w: 200, h: 100, noTitle: true, options: [{ key: 'image', label: 'Logo picture', type: 'image', fallback: 'clubLogo' }, { key: 'fit', label: 'Fit', type: 'select', choices: [['contain', 'Show the whole logo'], ['cover', 'Fill the widget (may crop)']], default: 'contain' }], sample: imgSample }),
    T('start', 'Start', 'Controls', { w: 140, button: true, sample: 'Start' }),
    T('pause', 'Pause / Resume', 'Controls', { w: 170, button: true, sample: 'Pause' }),
    T('stop', 'Stop', 'Controls', { w: 120, button: true, sample: 'Stop' }),
    T('yellow', 'Yellow flag', 'Controls', { w: 170, button: true, sample: 'Yellow flag' }),
    T('red', 'Red flag', 'Controls', { w: 150, button: true, sample: 'Red flag' })
  ];
  const def = type => REGISTRY.find(d => d.type === type);
  const sampleOf = (d, lane, widget) => (typeof d.sample === 'function' ? d.sample(lane || 0, widget) : d.sample || '');
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
  function snapMove(pos, size, targets, snap) {
    if (!snap) return Math.round(pos);
    let best = null;
    for (const t of targets) for (const d of [t - pos, t - (pos + size)]) if (Math.abs(d) <= MAG && (best === null || Math.abs(d) < Math.abs(best))) best = d;
    return best === null ? Math.round(pos / GRID) * GRID : pos + best;
  }
  function snapEdge(v, targets, snap) {
    if (!snap) return Math.round(v);
    let best = null;
    for (const t of targets) { const d = t - v; if (Math.abs(d) <= MAG && (best === null || Math.abs(d) < Math.abs(best))) best = d; }
    return best === null ? Math.round(v / GRID) * GRID : v + best;
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

  const newWidget = (type, lane, x, y) => {
    const d = def(type);
    return { id: uid(), type, lane: d.perLane ? lane || 0 : null, x, y, w: d.w, h: d.h, textSize: '', textColor: '', bgColor: '', title: '', showTitle: !d.noTitle, titleSize: '', titleBold: false, titleSpace: false, valueBold: true, valueItalic: false, opt: {} };
  };

  // ---- groups, titles, colours, guidelines, duplicating ----
  const bbox = list => {
    const l = Math.min(...list.map(g => g.x)), t = Math.min(...list.map(g => g.y));
    return { x: l, y: t, w: Math.max(...list.map(g => g.x + g.w)) - l, h: Math.max(...list.map(g => g.y + g.h)) - t };
  };
  // A widget's own colour wins, then its lane's colour, then the theme (an empty string means "theme").
  const colorsOf = (w, layout) => {
    const lc = (layout && layout.laneColors && w.lane !== null && w.lane !== undefined && layout.laneColors[w.lane]) || {};
    return { color: w.textColor || lc.text || '', bg: w.bgColor || lc.bg || '' };
  };
  // Text styling shared by the editor and the live page. Old layouts without these settings look as before (bold value), except
  // that the title no longer pushes the value down unless "title takes space" is on.
  const valueStyleOf = w => `font-weight:${w.valueBold === false ? 400 : 600};${w.valueItalic ? 'font-style:italic;' : ''}`;
  const titleStyleOf = w => `font-size:${(w.titleSize || 12) / 10}cqw;${w.titleBold ? 'font-weight:700;' : ''}`;
  // Alignment of the title and of the text (the value) in a widget: left, center or right. The standard is what the widgets always did: title left, value centered.
  // The Leaderboard has no text alignment (its columns come from the layout you make); a Leaderboard still has a title. A header cell of a row design follows its column.
  const ALIGNS = [['left', 'Left'], ['center', 'Center'], ['right', 'Right']];
  const alignOf = (v, standard) => (ALIGNS.some(a => a[0] === v) ? v : standard);
  const titleAlignOf = w => alignOf(w && w.titleAlign, 'left'), valueAlignOf = w => (w && w.type === 'leaderboard' ? 'center' : alignOf(w && w.valueAlign, 'center'));
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

  const api = { heatListHtml, HEATLIST_OPTIONS, tokenLayout, cssVal, lightsHtml, flagHtml, ledHtml, flagStyleOf, FLAG_STYLES, FLAG_COLORS, lightColor, lightCount, LIGHT_ROWS, LIGHT_COLS, lightKey, lightKeys, lightPic, lightBehind, IMG_OPS, ruleHolds, pickImage, imageHtml, flagImgHtml, avatarHtml, fillText, TEXT_LANE_VARS, TEXT_RACE_VARS, TEXT_LANE_DEFAULT, TEXT_RACE_DEFAULT, U, GRID, MIN, LANES, bbox, colorsOf, titleOf, showTitleOf, guidesFor, duplicateWidgets, stepFrom, REGISTRY, def, valueStyleOf, titleStyleOf, ALIGNS, titleAlignOf, valueAlignOf, alignClassOf, lapCountOf, lapTotalOn, sampleOf, fuelHtml, frameOf, frameTransform, panFrame, zoomFrame, lapListHtml, leaderHtml, clampInt, FLAG_STATES, resolveOpt, heightOf, withoutControls, moveWidget, resizeWidget, newWidget, defaultLayout };
  root.Widgets = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
