// Delta Timers: a widget that shows a time (as the ordinary widget does) and, beside it, how far a lane is from something to compare with:
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
  const STAT = {
    laptime: c => lastLap(c), // (the lap time widget runs a clock: what is compared is the lap that was completed last)
    avglap: c => { const g = E.goodLaps(c); return g.length ? mean(g) : null; },
    medlap: c => { const g = E.goodLaps(c); return g.length ? median(g) : null; },
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
  // targets: what it can be compared with. record: a record widget; it is always compared with that record.
  const KINDS = {
    dlaptime: { base: 'laptime', label: 'Laptime Delta', title: 'Laptime delta', stat: 'laptime', own: 'bestlap', ownWords: 'its own best lap', measures: ['static', 'self'], targets: ['lane', 'leader', 'fastest', 'track', 'session'],
      words: { static: "This lane's last lap against theirs", self: "This lane's last lap against its own best lap" } },
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
    if (!k || k.record || leftShowsOf(opt) === 'own' || !res || !res.ref) return null; // (the record widgets already show their record on the left)
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
  const WHY = { mine: 'No time for this lane yet.', ref: 'Nothing to compare with yet.', self: 'This is the lane it is compared with.', nolane: 'There is no car in the chosen lane.' };
  const SIGN = { fast: '−', slow: '+', equal: '' };
  // the arrow: "up" (the standard) points up for a faster time, as in "you are 0.045 up on the pace"; "down" the other way round; "none" has no arrow
  const ARROWS = { up: { fast: '▲', slow: '▼' }, down: { fast: '▼', slow: '▲' } };
  const arrowOf = opt => { const a = opt && opt.arrow; return a === 'down' ? 'down' : (a === 'none' || a === false) ? 'none' : 'up'; }; // (a widget from 0.91.0 has true or false here)
  // the look: "filled" (the standard) is a solid block, "outlined" has only the outline and the text in the colour
  const styleOf = opt => (opt && opt.style === 'outlined' ? 'outlined' : 'filled');
  function badge(res, opt) {
    if (!res || res.ms === null || res.ms === undefined) return `<span class="dlt-badge dlt-none" title="${esc(WHY[res && res.why] || WHY.ref)}">–</span>`;
    const f = format(res.ms, opt && opt.decimals), col = colorOf(opt, f.dir === 'fast' ? 'fasterColor' : f.dir === 'slow' ? 'slowerColor' : 'equalColor'), kind = arrowOf(opt), outlined = styleOf(opt) === 'outlined';
    const arrow = f.dir !== 'equal' && kind !== 'none' ? `<span class="dlt-arrow">${ARROWS[kind][f.dir]}</span>` : '';
    const title = f.dir === 'equal' ? `The same as ${res.who || 'the other'}` : `${f.text} s ${f.dir === 'fast' ? 'faster' : 'slower'} than ${res.who || 'the other'}`;
    const look = outlined ? `background:transparent;color:${col};border-color:${col}` : `background:${col};color:${onColor(col)}`;
    return `<span class="dlt-badge dlt-${f.dir}${outlined ? ' dlt-outlined' : ''}" style="${look}" title="${esc(title)}">${arrow}${SIGN[f.dir]}${f.text}</span>`;
  }
  // the widget: the ordinary widget's content on the left, the badge on the right
  // from: whose value the left side shows when it is not the lane's own (a tooltip)
  const wrap = (baseHtml, res, opt, from) => `<span class="dlt"><span class="dlt-val"${from ? ` title="${esc('Shows ' + from)}"` : ''}>${baseHtml}</span>${badge(res, opt)}</span>`;
  // the palette and the editor: lane 1 is faster, lane 2 slower, and so on
  const SAMPLE_MS = [-45, 321, -12, 87, 0, -230, 1204, -8];
  const sample = (baseHtml, lane, opt) => wrap(baseHtml, { ms: SAMPLE_MS[(lane || 0) % SAMPLE_MS.length], who: 'what it is compared with' }, opt);

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
    if (!k.record) out.push({ key: 'leftShows', label: 'Left value shows', type: 'select', default: 'own', choices: [['own', "This lane's own value"], ['ref', 'The value it is compared with']],
      hintOf: v => (v === 'ref' ? 'The left side shows the lane (or the leader, the fastest, the record, its own best) it is compared with, for example lane 2\'s time. The badge still says how far this lane is from it.'
        : "The left side shows this lane's own value. The badge says how far it is from what it is compared with.") });
    out.push({ key: 'decimals', label: 'Decimals of the difference', type: 'select', default: '3', choices: [['3', '3 (0.456)'], ['2', '2 (0.46)'], ['1', '1 (0.5)']] });
    out.push({ key: 'style', label: 'Look of the badge', type: 'select', default: 'filled', choices: [['filled', 'Filled (a solid block)'], ['outlined', 'Outlined (only the outline and the text)']],
      hintOf: v => (v === 'outlined' ? 'Only the outline and the text have the colour, the inside is empty.' : 'The whole block has the colour; the text turns black or white to be readable on it.') });
    out.push({ key: 'arrow', label: 'Arrow in the badge', type: 'select', default: 'up', choices: [['up', '▲ faster, ▼ slower'], ['down', '▼ faster, ▲ slower'], ['none', 'No arrow']] });
    out.push({ key: 'fasterColor', label: 'Colour when faster', type: 'color', default: DEFAULTS.fasterColor });
    out.push({ key: 'slowerColor', label: 'Colour when slower', type: 'color', default: DEFAULTS.slowerColor });
    out.push({ key: 'equalColor', label: 'Colour when equal', type: 'color', default: DEFAULTS.equalColor });
    return out;
  }

  const api = { KINDS, TARGET_WORDS, DEFAULTS, STAT, WHY, isDelta, baseOf, compute, leftOf, leftShowsOf, format, badge, wrap, sample, optionsFor, onColor, colorOf, decimalsOf, measureOf, compareOf, arrowOf, styleOf, ARROWS };
  root.Delta = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
