// Delta Timers: a widget that shows a time (as the ordinary widget does) and, beside it (or, since 1.18.0 when you choose so, below it), how far a lane is from something to compare with:
// a green badge (▼ −0.045) when it is faster, a red one (▲ +0.321) when it is slower. A negative difference is a faster one.
// This file works the numbers out and makes the markup; it reads the shared race state (see liveshare.js) and draws nothing by itself.
(function (root) {
  const E = typeof module !== 'undefined' ? require('./engine.js') : root.RaceEngine;
  const MAX_LANES = 8;
  const esc = x => String(x ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const median = a => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  // black or white text, whichever reads better on a colour (#rrggbb)
  const onColor = hex => { const n = parseInt(String(hex).slice(1), 16) || 0; return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 150 ? '#000' : '#fff'; };
  const DEFAULTS = { fasterColor: '#2ee57f', slowerColor: '#d62828', equalColor: '#6b7380' };
  // only a plain #rrggbb gets into a style: a damaged or imported file can never add anything else to the page
  const colorOf = (opt, key) => (opt && /^#[0-9a-fA-F]{6}$/.test(String(opt[key] ?? '')) ? opt[key] : DEFAULTS[key]);
  const fin = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);

  // ---- what a car's number is ----
  const lastLap = c => (c && c.laps.length ? fin(c.laps[c.laps.length - 1]) : null);
  const lapBefore = c => (c && c.laps.length > 1 ? fin(c.laps[c.laps.length - 2]) : null); // (the lap before the last one: 1.29.0, Lap to Lap Delta)
  const STAT = {
    laptime: c => lastLap(c), // (the lap time widget runs a clock: what is compared is the lap that was completed last)
    avglap: c => { const g = E.averageLaps(c); return g.length ? mean(g) : null; },
    medlap: c => { const g = E.averageLaps(c); return g.length ? median(g) : null; },
    bestlap: c => fin(c.best),
    recordlap: (c, S) => fin(S.personalBest(c.driverId)),
    pitstop: (c, S, t) => { const p = S.eng.pitTime(S.eng.cars.indexOf(c), t); return p ? fin(p.ms) : null; }
  };
  const recordTime = (which, S) => { const r = which === 'session' ? (S.sessionRecord && S.sessionRecord()) : (S.trackRecord && S.trackRecord()); return r ? fin(r.time) : null; };

  // ---- the eight widgets ----
  // base: the ordinary widget that is drawn on the left. stat: the number that is compared. own: the number of the lane itself for "against its own" (default: stat).
  // measures: what is compared, in order (the first is the default):
  //   static  this lane's number against the number of the lane it is compared with
  //   live    this lane's last lap against that number of the other lane (it changes with every lap)
  //   self    this lane's last lap against this lane's own number (no other lane needed)
  //   previous  this lane's last lap against the lap before it (1.29.0, Lap to Lap Delta: no other lane, no choice to make; "steady": the left side keeps showing the last lap, it is no running clock)
  // targets: what it can be compared with. record: a record widget; it is always compared with that record.
  const KINDS = {
    dlaptime: { base: 'laptime', label: 'Laptime Delta', title: 'Laptime delta', stat: 'laptime', own: 'bestlap', ownWords: 'its own best lap', measures: ['static', 'self'], targets: ['lane', 'leader', 'fastest', 'track', 'session'],
      words: { static: "This lane's last lap against theirs", self: "This lane's last lap against its own best lap" } },
    dlaplap: { base: 'laptime', label: 'Lap to Lap Delta', title: 'Lap to lap delta', stat: 'laptime', measures: ['previous'], targets: [], steady: true,
      words: { previous: "This lane's last lap against the lap before it" } },
    davglap: { base: 'avglap', label: 'Average Lap Delta', title: 'Average lap delta', stat: 'avglap', ownWords: 'its own average lap', measures: ['static', 'live', 'self'], targets: ['lane', 'leader', 'fastest', 'track', 'session'],
      words: { static: "This lane's average lap against theirs", live: "This lane's last lap against their average lap", self: "This lane's last lap against its own average lap" } },
    dmedlap: { base: 'medlap', label: 'Median Lap Delta', title: 'Median lap delta', stat: 'medlap', ownWords: 'its own median lap', measures: ['static', 'live', 'self'], targets: ['lane', 'leader', 'fastest', 'track', 'session'],
      words: { static: "This lane's median lap against theirs", live: "This lane's last lap against their median lap", self: "This lane's last lap against its own median lap" } },
    dbestlap: { base: 'bestlap', label: 'Best Lap Delta', title: 'Best lap delta', stat: 'bestlap', ownWords: 'its own best lap', measures: ['static', 'live', 'self'], targets: ['lane', 'leader', 'fastest', 'track', 'session'],
      words: { static: "This lane's best lap against theirs", live: "This lane's last lap against their best lap", self: "This lane's last lap against its own best lap" } },
    drecordlap: { base: 'recordlap', label: 'Personal Best Delta', title: 'Personal best delta', stat: 'recordlap', ownWords: 'its own personal best', measures: ['static', 'live', 'self'], targets: ['lane', 'leader', 'fastest', 'track', 'session'],
      words: { static: "This lane's personal best against theirs", live: "This lane's last lap against their personal best", self: "This lane's last lap against its own personal best" } },
    dpitstop: { base: 'pitstop', label: 'Pitstop Time Delta', title: 'Pitstop delta', stat: 'pitstop', ownWords: 'its own pit stop', measures: ['static'], targets: ['lane', 'leader', 'fastest'],
      words: { static: "This lane's pit stop time against theirs" } },
    dsessionrecord: { base: 'sessionrecord', label: 'Session Record Delta', title: 'Session record delta', record: 'session', measures: ['static', 'live'], targets: [],
      words: { static: "This lane's best lap against the session record", live: "This lane's last lap against the session record" } },
    dtrackrecord: { base: 'trackrecord', label: 'Track Record Delta', title: 'Track record delta', record: 'track', measures: ['static', 'live'], targets: [],
      words: { static: "This lane's personal best against the track record", live: "This lane's last lap against the track record" } }
  };
  const isDelta = type => Object.prototype.hasOwnProperty.call(KINDS, type);
  const baseOf = type => (isDelta(type) ? KINDS[type].base : null);
  const TARGET_WORDS = { lane: 'A chosen lane', leader: 'The leader', fastest: 'The fastest in this race', track: 'The track record', session: 'The session record' };

  const measureOf = (k, opt) => (opt && k.measures.includes(opt.measure) ? opt.measure : k.measures[0]);
  const compareOf = (k, opt) => (opt && k.targets.includes(opt.compare) ? opt.compare : 'lane');

  // the number of the car itself
  const mineOf = (k, measure, car, S, t) => {
    if (measure !== 'static') return lastLap(car);
    if (k.record === 'session') return fin(car.best);
    if (k.record === 'track') return STAT.recordlap(car, S);
    return STAT[k.stat](car, S, t);
  };
  // what it is compared with: { time, who } or { why }
  function referenceOf(k, measure, opt, car, S, t) {
    if (k.record) { const r = recordTime(k.record, S); return r === null ? { why: 'ref' } : { time: r, who: `the ${k.record} record`, record: k.record }; }
    if (measure === 'previous') { const r = lapBefore(car); return r === null ? { why: 'before' } : { time: r, who: 'the lap before it' }; }
    if (measure === 'self') { const r = STAT[k.own || k.stat](car, S, t); return r === null ? { why: 'ref' } : { time: r, who: k.ownWords, own: true }; }
    const mode = compareOf(k, opt);
    if (mode === 'track' || mode === 'session') { const r = recordTime(mode, S); return r === null ? { why: 'ref' } : { time: r, who: `the ${mode} record`, record: mode }; }
    let other = null, who = '';
    if (mode === 'lane') {
      const lanes = S.eng.cars.map(c => c.lane).sort((a, b) => a - b);
      const own = opt && opt.targetLane !== undefined && opt.targetLane !== '' ? Number(opt.targetLane) - 1 : lanes[(lanes.indexOf(car.lane) + 1) % lanes.length]; // (no lane chosen: the next one, and the last lane with the first)
      other = S.carByLane(own); if (!other) return { why: 'nolane' };
      who = `lane ${other.lane + 1}`;
    } else if (mode === 'leader') {
      const first = S.standings()[0]; other = first && first.car; if (!other) return { why: 'ref' };
      who = 'the leader';
    } else { // the fastest: the lowest number of all the cars (the first lane wins a tie)
      let low = null;
      for (const c of S.eng.cars) { const v = STAT[k.stat](c, S, t); if (v !== null && (low === null || v < low)) { low = v; other = c; } }
      if (!other) return { why: 'ref' };
      who = k.stat === 'pitstop' ? 'the fastest pit stop' : 'the fastest';
    }
    if (other === car) return { why: 'self' };
    const r = STAT[k.stat](other, S, t);
    return r === null ? { why: 'ref' } : { time: r, who: `${who} (${other.driverName || 'Guest'})`, car: other };
  }

  // type: a delta widget; opt: its settings; car: the lane's car; S: the shared race state; t: the race time.
  // Gives { ms } (this lane's number minus the other: negative is faster) and who it was compared with, or { ms: null, why } when there is nothing to show.
  function compute(type, opt, car, S, t) {
    const k = KINDS[type]; if (!k || !car) return { ms: null, why: 'mine' };
    const measure = measureOf(k, opt), mine = mineOf(k, measure, car, S, t), ref = referenceOf(k, measure, opt, car, S, t);
    if (mine === null) return { ms: null, why: 'mine', ref };
    if (ref.why) return { ms: null, why: ref.why, ref };
    return { ms: mine - ref.time, who: ref.who, ref };
  }

  // What the left side shows. "own" (the standard): this lane's own value, as the ordinary widget shows it. "ref": the value it is compared with: the other lane's (or the
  // leader's, or the fastest's), a record, or for "its last lap against its own best" that own number. The badge says the same in both cases: how far this lane is from it.
  const leftShowsOf = opt => (opt && opt.leftShows === 'ref' ? 'ref' : 'own');
  // res: what compute gave. null: show the lane's own value as usual. { blank: true }: there is nothing to show yet.
  // Otherwise { type, car, who, record }: draw the ordinary widget "type" for that car (a record widget needs no car); who is what the value belongs to.
  function leftOf(type, opt, car, res) {
    const k = KINDS[type];
    if (!k || k.record || k.steady || leftShowsOf(opt) === 'own' || !res || !res.ref) return null; // (the record widgets already show their record on the left)
    const r = res.ref;
    if (r.why === 'self') return null; // it is the compared lane itself: its own value is what there is
    if (r.why) return { blank: true };
    if (r.car) return { type: k.base, car: r.car, who: r.who };
    if (r.own) return { type: k.own || k.stat, car, who: r.who };
    if (r.record) return { type: r.record === 'session' ? 'sessionrecord' : 'trackrecord', car: null, who: r.who, record: true };
    return null;
  }

  // ---- how it looks ----
  const decimalsOf = opt => { const n = Math.round(Number(opt && opt.decimals)); return Number.isFinite(n) ? Math.max(1, Math.min(3, n)) : 3; };
  // the size of a difference as text with the chosen number of decimals ("0.456", "1:02.30"); equal when it rounds to nothing
  function format(ms, decimals) {
    const d = decimalsOf({ decimals }), unit = Math.pow(10, 3 - d), r = Math.round(Math.abs(ms) / unit) * unit;
    const m = Math.floor(r / 60000), s = ((r % 60000) / 1000).toFixed(d);
    return { dir: r === 0 ? 'equal' : ms < 0 ? 'fast' : 'slow', text: m ? m + ':' + s.padStart(d + 3, '0') : s };
  }
  const WHY = { mine: 'No time for this lane yet.', before: 'Needs two laps: there is no lap before this one yet.', ref: 'Nothing to compare with yet.', self: 'This is the lane it is compared with.', nolane: 'There is no car in the chosen lane.' };
  const SIGN = { fast: '−', slow: '+', equal: '' };
  // the arrow: "up" (the standard) points up for a faster time, as in "you are 0.045 up on the pace"; "down" the other way round; "none" has no arrow
  const ARROWS = { up: { fast: '▲', slow: '▼' }, down: { fast: '▼', slow: '▲' } };
  const arrowOf = opt => { const a = opt && opt.arrow; return a === 'down' ? 'down' : (a === 'none' || a === false) ? 'none' : 'up'; }; // (a widget from 0.91.0 has true or false here)
  // how the value and the badge sit (1.18.0): "row" (the standard) has the value on the left and the badge on the right, "column" has the value on top and the badge below it
  const layoutOf = opt => (opt && opt.direction === 'column' ? 'column' : 'row');
  // the look: "filled" (the standard) is a solid block, "outlined" has only the outline and the text in the colour
  const styleOf = opt => (opt && opt.style === 'outlined' ? 'outlined' : 'filled');
  // The size and the text of the badge (settings of the widget). Scale: the whole badge, in percent (100 is the standard). Outline: the thickness of the line around it,
  // in hundredths of the text size; the standard is a line for the outlined look and none for the filled one. Bold is on until it is switched off; italic is off until it is switched on.
  const scaleOf = opt => { const n = Number(opt && opt.badgeScale); return Number.isFinite(n) && opt.badgeScale !== '' ? Math.max(30, Math.min(200, Math.round(n))) : 100; };
  const outlineDefault = opt => (styleOf(opt) === 'outlined' ? 14 : 0);
  const outlineOf = opt => { const n = Number(opt && opt.badgeOutline); return opt && opt.badgeOutline !== undefined && opt.badgeOutline !== '' && Number.isFinite(n) ? Math.max(0, Math.min(40, n)) : outlineDefault(opt); };
  const boldOf = opt => !(opt && opt.badgeBold === false);
  const italicOf = opt => !!(opt && opt.badgeItalic);
  // the style="" pieces for the size and the text; nothing for a standard badge, so a widget that has none of these settings looks exactly as before
  function sizeStyle(opt) {
    const k = scaleOf(opt) / 100, out = [];
    if (k !== 1) out.push(`font-size:calc(.95em*${k})`, 'align-self:center', layoutOf(opt) === 'column' ? `width:min(100%,calc((100% - .32em)*${k}))` : `height:min(100%,calc((100% - .32em)*${k}))`, 'margin:0'); // (the standard badge fills the height of the widget, or its width when the badge is below the value; a scaled one is a share of it)
    if (!boldOf(opt)) out.push('font-weight:400');
    if (italicOf(opt)) out.push('font-style:italic');
    return out;
  }
  function badge(res, opt) {
    const size = sizeStyle(opt);
    if (!res || res.ms === null || res.ms === undefined) return `<span class="dlt-badge dlt-none" title="${esc(WHY[res && res.why] || WHY.ref)}"${size.length ? ` style="${size.join(';')}"` : ''}>–</span>`;
    const f = format(res.ms, opt && opt.decimals), col = colorOf(opt, f.dir === 'fast' ? 'fasterColor' : f.dir === 'slow' ? 'slowerColor' : 'equalColor'), kind = arrowOf(opt), outlined = styleOf(opt) === 'outlined';
    const arrow = f.dir !== 'equal' && kind !== 'none' ? `<span class="dlt-arrow">${ARROWS[kind][f.dir]}</span>` : '';
    const title = f.dir === 'equal' ? `The same as ${res.who || 'the other'}` : `${f.text} s ${f.dir === 'fast' ? 'faster' : 'slower'} than ${res.who || 'the other'}`;
    const look = outlined ? `background:transparent;color:${col};border-color:${col}` : `background:${col};color:${onColor(col)}`;
    const line = outlineOf(opt), custom = opt && opt.badgeOutline !== undefined && opt.badgeOutline !== ''; // (the line of the outlined look is in the style sheet; a chosen thickness is put in the style)
    const edge = custom || !outlined ? (line > 0 ? [`border:${line / 100}em solid ${outlined ? col : onColor(col)}`, 'box-sizing:border-box', ...(outlined ? [] : ['box-shadow:none'])] : outlined ? ['border:0', 'box-shadow:none'] : []) : [];
    return `<span class="dlt-badge dlt-${f.dir}${outlined ? ' dlt-outlined' : ''}" style="${[look, ...edge, ...size].join(';')}" title="${esc(title)}">${arrow}${SIGN[f.dir]}${f.text}</span>`;
  }
  // the widget: the ordinary widget's content on the left, the badge on the right (or the content on top and the badge below it)
  // from: whose value the left side shows when it is not the lane's own (a tooltip)
  const wrap = (baseHtml, res, opt, from) => `<span class="dlt${layoutOf(opt) === 'column' ? ' dlt-col' : ''}"><span class="dlt-val"${from ? ` title="${esc('Shows ' + from)}"` : ''}>${baseHtml}</span>${badge(res, opt)}</span>`;
  // the palette and the editor: lane 1 is faster, lane 2 slower, and so on
  const SAMPLE_MS = [-45, 321, -12, 87, 0, -230, 1204, -8];
  const sample = (baseHtml, lane, opt) => wrap(baseHtml, { ms: SAMPLE_MS[(lane || 0) % SAMPLE_MS.length], who: 'what it is compared with' }, opt);

  // ---- the arrow and the number fit the badge (1.18.1) ----
  // The text of the badge (the arrow and the difference, "▲ −0.045" or "▼ +1:02.345") is made smaller, just enough to stay inside the badge, so nothing sticks out of the green or red
  // block however the widget is resized: a narrow widget with the badge below the value, a long difference, a short widget with big text. A badge that already fits is left as it is.
  // Works in the browser only: it measures the page. measure(badge) -> { boxW, boxH, w, h, em } can be replaced, to test: the room in the badge, the room its text needs (both with
  // the padding), and the size of its text in em of the widget.
  const FIT_MIN = 0.2; // (never smaller than a fifth: a widget this small has no room for a badge)
  // by how much the text has to shrink: 1 when it fits, else the share (in hundredths, rounded down) that makes it fit
  function fitFactor(m) {
    if (!m || !(m.boxW > 0) || !(m.boxH > 0) || !(m.w > 0) || !(m.h > 0)) return 1; // (not on the screen yet: nothing to measure)
    if (m.w <= m.boxW + 0.5 && m.h <= m.boxH + 0.5) return 1;
    return Math.max(FIT_MIN, Math.floor(Math.min(m.boxW / m.w, m.boxH / m.h) * 100) / 100);
  }
  const measureBadge = b => {
    const r = document.createRange(); r.selectNodeContents(b);
    const t = r.getBoundingClientRect(), cs = getComputedStyle(b), px = k => parseFloat(cs[k]) || 0, up = b.parentNode ? parseFloat(getComputedStyle(b.parentNode).fontSize) || 0 : 0;
    return { boxW: b.clientWidth, boxH: b.clientHeight, w: t.width + px('paddingLeft') + px('paddingRight'), h: px('fontSize') * 1.1 + px('paddingTop') + px('paddingBottom'), em: up > 0 ? px('fontSize') / up : 0 };
  };
  // the badge's own size from the markup (the size setting) is kept in data-fit and put back before every fit, so a widget that gets bigger again gets its full text back
  function fitBadge(b, measure) {
    if (!b || !b.style || !b.dataset) return;
    if (b.dataset.fit === undefined) b.dataset.fit = b.style.getPropertyValue('font-size');
    if (b.dataset.fit) b.style.setProperty('font-size', b.dataset.fit); else b.style.removeProperty('font-size');
    let all = 1;
    for (let i = 0; i < 3 && all > FIT_MIN; i++) { // (more than once: the size of the badge itself follows its text a little)
      const m = (measure || measureBadge)(b), f = fitFactor(m);
      if (f >= 1 || !(m.em > 0)) break;
      all *= f; b.style.setProperty('font-size', `${(m.em * f).toFixed(4)}em`, 'important');
    }
  }
  // every badge in root (a value box, a canvas, a leaderboard)
  function fit(root, measure) {
    if (!root || !root.querySelectorAll) return;
    Array.from(root.querySelectorAll('.dlt-badge')).forEach(b => fitBadge(b, measure));
  }

  // ---- the settings of a widget in the layout editor ----
  // show(opt): the setting only appears when it is of use; rerender: changing it redraws the settings
  function optionsFor(type) {
    const k = KINDS[type], out = [], ownMode = o => measureOf(k, o) === 'self';
    if (k.measures.length > 1) out.push({ key: 'measure', label: 'What is compared', type: 'select', default: k.measures[0], choices: k.measures.map(m => [m, k.words[m]]), rerender: true, hintOf: v => k.words[k.measures.includes(v) ? v : k.measures[0]] + '.' });
    else if (!k.record) out.push({ key: 'measurenote', type: 'note', label: k.words[k.measures[0]] + '.' });
    if (k.targets.length) {
      out.push({ key: 'compare', label: 'Compare with', type: 'select', default: 'lane', rerender: true, show: o => !ownMode(o),
        choices: k.targets.map(m => [m, m === 'fastest' && k.stat === 'pitstop' ? 'The fastest pit stop' : TARGET_WORDS[m]]) });
      out.push({ key: 'targetLane', label: 'Which lane', type: 'select', default: '', show: o => !ownMode(o) && compareOf(k, o) === 'lane',
        choices: [['', 'The next lane (the last lane with lane 1)'], ...Array.from({ length: MAX_LANES }, (_, i) => [String(i + 1), 'Lane ' + (i + 1)])],
        hint: 'A copy of the widget on the next lane keeps this choice: change it there if it should compare with another lane.' });
    }
    if (!k.record && !k.steady) out.push({ key: 'leftShows', label: 'Left (or top) value shows', type: 'select', default: 'own', choices: [['own', "This lane's own value"], ['ref', 'The value it is compared with']],
      hintOf: v => (v === 'ref' ? 'The left side shows the lane (or the leader, the fastest, the record, its own best) it is compared with, for example lane 2\'s time. The badge still says how far this lane is from it.'
        : "The left side shows this lane's own value. The badge says how far it is from what it is compared with.") });
    out.push({ key: 'direction', label: 'Value and badge', type: 'select', default: 'row', rerender: true, choices: [['row', 'Left and right: the value on the left, the badge on the right'], ['column', 'Top and bottom: the value on top, the badge below']],
      hintOf: v => (v === 'column' ? 'The value and the badge share the height of the widget, so give it room: make the widget taller, or the text smaller. The badge is as wide as the widget; "Size of the badge" makes it narrower. The arrow and the number shrink when the badge is too small for them.' : 'The badge fills the height of the widget, beside the value. The arrow and the number shrink when the badge is too small for them.') });
    out.push({ key: 'decimals', label: 'Decimals of the difference', type: 'select', default: '3', choices: [['3', '3 (0.456)'], ['2', '2 (0.46)'], ['1', '1 (0.5)']] });
    out.push({ key: 'style', label: 'Look of the badge', type: 'select', default: 'filled', rerender: true, choices: [['filled', 'Filled (a solid block)'], ['outlined', 'Outlined (only the outline and the text)']],
      hintOf: v => (v === 'outlined' ? 'Only the outline and the text have the colour, the inside is empty.' : 'The whole block has the colour; the text turns black or white to be readable on it.') });
    out.push({ key: 'badgeScale', label: 'Size of the badge', type: 'range', default: 100, min: 30, max: 200, step: 5, unit: '%', hint: '100% is the standard: the badge fills the height of the widget (its width when the badge is below the value). A smaller or larger badge scales its text, outline and padding with it.' });
    out.push({ key: 'badgeOutline', label: 'Outline thickness', type: 'range', default: 0, defaultOf: outlineDefault, min: 0, max: 40, step: 1, unit: '%', hint: 'The line around the badge, as a share of its text size. The outlined look has a line as standard; on the filled look the line has the colour of the text.' });
    out.push({ key: 'badgeBold', label: 'Badge text in bold', type: 'checkbox', default: true });
    out.push({ key: 'badgeItalic', label: 'Badge text in italic', type: 'checkbox', default: false });
    out.push({ key: 'arrow', label: 'Arrow in the badge', type: 'select', default: 'up', choices: [['up', '▲ faster, ▼ slower'], ['down', '▼ faster, ▲ slower'], ['none', 'No arrow']] });
    out.push({ key: 'fasterColor', label: 'Colour when faster', type: 'color', default: DEFAULTS.fasterColor });
    out.push({ key: 'slowerColor', label: 'Colour when slower', type: 'color', default: DEFAULTS.slowerColor });
    out.push({ key: 'equalColor', label: 'Colour when equal', type: 'color', default: DEFAULTS.equalColor });
    return out;
  }

  const api = { KINDS, TARGET_WORDS, DEFAULTS, STAT, WHY, isDelta, baseOf, compute, leftOf, leftShowsOf, format, badge, wrap, sample, optionsFor, onColor, colorOf, decimalsOf, measureOf, compareOf, arrowOf, styleOf, layoutOf, scaleOf, outlineOf, boldOf, italicOf, sizeStyle, fitFactor, fit, ARROWS };
  root.Delta = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
