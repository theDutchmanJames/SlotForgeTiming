// The results wall on the second screen.  Its settings are deliberately small:
// The Results Wall shown on the second screen after a race. The engine and the
// live Heat/Championship state remain the source of truth for every total.
const ResultsView = (() => {
  const Statistics = typeof module !== 'undefined' ? require('./stats.js') : globalThis.Stats;
  const Rows = typeof module !== 'undefined' ? require('./rows.js') : globalThis.Rows;
  const METRICS = [
    ['laps', 'Laps'], ['total', 'Total time driven'], ['gap', 'Gap to leader'],
    ['best', 'Best legal lap'], ['average', 'Average lap'], ['consistency', 'Consistency'],
    ['heatpoints', 'Heat points'], ['champpoints', 'Championship points'],
    ['penalties', 'Penalty points'], ['invalid', 'Invalid laps'], ['pit', 'Pit laps']
  ];
  const COMPARE_METRICS = METRICS.filter(([key]) => key !== 'gap');
  const KEYS = new Set(METRICS.map(x => x[0])), COMPARE_KEYS = new Set(COMPARE_METRICS.map(x => x[0]));
  const escText = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cleanKey = (v, d, keys = KEYS) => keys.has(v) ? v : d;
  const cleanFact = (v, d, optional) => optional && v === 'none' ? 'none' : cleanKey(v, d);
  const clean = v => {
    const x = v && typeof v === 'object' ? v : {}, summary = Array.isArray(x.summary) ? x.summary : [];
    // A finished race always has a podium. Keep old saved `winner` values harmless,
    // but do not let an outdated switch hide the classification's first place.
    return {
      summary: [cleanFact(summary[0], 'laps'), cleanFact(summary[1], 'best', true), cleanFact(summary[2], 'average', true), cleanFact(summary[3], 'consistency', true)],
      comparison: x.comparison === 'none' ? 'none' : cleanKey(x.comparison, 'best', COMPARE_KEYS),
      // Only fields of five or more can replace cards with a reusable row design.
      // Older settings retain the existing card presentation.
      largeField: x.largeField === 'leaderboard' ? 'leaderboard' : 'cards',
      leaderboardDesign: typeof x.leaderboardDesign === 'string' ? x.leaderboardDesign : '',
      winner: true
    };
  };
  const label = k => (METRICS.find(x => x[0] === k) || ['', k])[1];
  const counted = c => c.laps.filter((_, n) => !(c.bad || [])[n] && !(c.invalid || []).includes(n) && !(c.removed || []).includes(n));
  const average = c => { const a = counted(c); return a.length ? a.reduce((n, t) => n + t, 0) / a.length : null; };
  const spread = c => Statistics.consistency(RaceEngine.averageLaps(c));
  const number = v => v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null;
  const shortNumber = v => { const n = number(v); return n === null ? '–' : String(Math.round(n * 100) / 100); };
  const pointsFrom = (source, c, kind) => {
    if (!source || typeof source !== 'object') return null;
    if (kind === 'championship') { const r = (Array.isArray(source.pts) ? source.pts : []).find(x => Array.isArray(x) && Number(x[0]) === Number(c.participant)); return r ? number(r[1]) : null; }
    const list = Array.isArray(source.done) ? source.done : source.done instanceof Map ? [...source.done] : [], id = c.asTeam ? c.teamId : c.driverId, r = list.find(x => Array.isArray(x) && x[0] === id);
    return r ? number(r[1]) : null;
  };
  function value(eng, c, key, ctx = {}, row = null) {
    if(c.resultStats&&Object.prototype.hasOwnProperty.call(c.resultStats,key))return c.resultStats[key];
    if (key === 'laps') return eng.lapsOf(c);
    if (key === 'total') return typeof eng.timeOf === 'function' ? number(eng.timeOf(c)) : number(c.total);
    if (key === 'gap') return row && typeof row.gap === 'string' ? row.gap : null;
    if (key === 'best') return c.best === null || c.best === undefined ? null : c.best;
    if (key === 'average') return average(c);
    if (key === 'consistency') return spread(c);
    if (c.virtualRival && ['heatpoints','champpoints','penalties'].includes(key)) return null;
    if (key === 'heatpoints') return pointsFrom(ctx.heatPoints, c, 'heat');
    if (key === 'champpoints') return pointsFrom(ctx.season, c, 'championship');
    if (key === 'penalties') return c.points || 0;
    if (key === 'invalid') return new Set([...(c.invalid || []), ...(c.removed || [])]).size;
    if (key === 'pit') return (c.pitLaps || []).length;
    return null;
  }
  const timeMetric = key => ['total', 'best', 'average', 'consistency'].includes(key);
  const show = (key, v, row) => key === 'gap' ? (row && row.pos === 1 ? 'Leader' : v || '–') : timeMetric(key) ? (v === null || v === undefined ? '–' : RaceEngine.fmtTime(v)) : shortNumber(v);
  const lowWins = key => ['total', 'best', 'average', 'consistency', 'penalties', 'invalid', 'pit'].includes(key);
  const avatar = c => {
    const own = typeof c.avatar === 'string' ? c.avatar : '', fallback = !own && typeof Avatars !== 'undefined' && Avatars && typeof Avatars.forLane === 'function' ? Avatars.forLane({}, c.lane) : '', src = own || fallback;
    return src ? `<span class="result-avatar"><img src="${escText(src)}" alt=""></span>` : `<span class="result-avatar result-avatar-letter">${escText((c.driverName || '?').trim().charAt(0).toUpperCase() || '?')}</span>`;
  };
  const position = x => `<b class="result-place">${x.car.dq ? 'DQ' : x.pos}</b>`;
  // One zero-inclusive numeric scale for the axis and every bar. Negative
  // competition points extend left of zero instead of disappearing.
  function comparisonScale(values) {
    const nums = values.filter(Number.isFinite), min = Math.min(0, ...nums), max = Math.max(0, ...nums);
    const hi = max === min ? min + 1 : max, span = hi - min;
    return { min, max: hi, zero: -min / span * 100,
      ticks: [min, min + span / 2, hi],
      bar: v => ({ left: (Math.min(0, v) - min) / span * 100, width: Math.abs(v) / span * 100 }) };
  }
  const axisUnit = key => timeMetric(key) ? 'Seconds' : key === 'laps' || key === 'invalid' || key === 'pit' ? 'Laps' : 'Points';
  const axisNumber = (key, value) => String(Number((timeMetric(key) ? value / 1000 : value).toFixed(6)));
  function html(eng, settings, o = {}) {
    const MC=typeof module!=='undefined'?require('./multiclass.js'):typeof MultiClass!=='undefined'?MultiClass:null;
    const eventRows=o.phase==='finished'&&eng.multiclass&&o.heat?.resultRows;
    const opt = clean(settings), st = eventRows?.length?eventRows.map(r=>({...r,car:{...r,laps:[],best:r.resultStats.best}})):eng.displayStandings ? eng.displayStandings() : eng.standings(), phase = o.phase === 'review' ? 'Provisional — director review in progress' : 'Final classification', ctx = { heatPoints: o.heatPoints, season: o.season };
    const rows = st.map(x => ({ ...x, facts: opt.summary.map(k => k === 'none' ? null : { key: k, value: value(eng, x.car, k, ctx, x) }) }));
    const winner = x => Stats.isWinner({ sessionType: eng.type }, { pos: x.pos, dq: x.car.dq, retired: x.car.retired, laps: value(eng,x.car,'laps') }), win = rows.find(winner);
    const card = x => { const c = x.car, lane = (o.layout && o.layout.laneColors && o.layout.laneColors[c.lane]) || {}, colour = /^#[0-9a-f]{3,8}$/i.test(lane.bg || '') ? lane.bg : '#4c9aff', facts = x.facts.filter(Boolean), featured = facts[0] || { key: 'laps', value: value(eng, c, 'laps', ctx, x) };
      return `<article class="result-card${c.dq ? ' dq' : ''}" style="--lane-stripe:${escText(colour)}"><header class="result-cardhead"><span class="result-ident">${avatar(c)}${position(x)}</span><div><strong>${escText(c.driverName)}</strong>${MC?MC.badge(x):''}<span>${escText(c.carName || 'No car selected')} · ${c.aggregate ? 'Heat event' : c.virtualRival ? (c.comparisonOnly ? 'Virtual · comparison' : 'Virtual competitor') : 'Lane '+(c.lane+1)}</span></div></header><div class="result-summary"><div class="result-feature"><span>${escText(label(featured.key))}</span><strong>${escText(show(featured.key, featured.value, x))}</strong></div>${facts.slice(1).map(f => `<div><span>${escText(label(f.key))}</span><strong>${escText(show(f.key, f.value, x))}</strong></div>`).join('')}</div>${c.dq ? '<p class="result-state">Disqualified</p>' : c.retired ? '<p class="result-state">Did not finish</p>' : ''}</article>`;
    };
    const placeWord = n => n === 1 ? 'Winner' : n === 2 ? 'Second place' : 'Third place';
    const podiumTone = n => n === 1 ? 'gold' : n === 2 ? 'silver' : 'bronze';
    const spotlight = (x, n, featured) => { const c = x.car, lane = (o.layout && o.layout.laneColors && o.layout.laneColors[c.lane]) || {}, colour = /^#[0-9a-f]{3,8}$/i.test(lane.bg || '') ? lane.bg : '#4c9aff', facts = x.facts.filter(Boolean), primary = facts[0] || { key: 'laps', value: value(eng, c, 'laps', ctx, x) }, tone = podiumTone(n);
      return `<article class="results-spotlight results-spotlight-${tone}${featured ? ' results-spotlight-featured' : ''}" style="--lane-stripe:${escText(colour)}"><header class="results-spotlight-head"><span class="result-ident">${avatar(c)}${position(x)}</span><div><p>${placeWord(n)}</p><h2>${escText(c.driverName)}</h2>${MC?MC.badge(x):''}<span>${escText(c.carName || 'No car selected')} · ${c.aggregate ? 'Heat event' : c.virtualRival ? (c.comparisonOnly ? 'Virtual · comparison' : 'Virtual competitor') : 'Lane '+(c.lane+1)}</span></div></header><div class="results-spotlight-summary"><div class="result-feature"><span>${escText(label(primary.key))}</span><strong>${escText(show(primary.key, primary.value, x))}</strong></div>${facts.slice(1).map(f => `<div><span>${escText(label(f.key))}</span><strong>${escText(show(f.key, f.value, x))}</strong></div>`).join('')}</div>${c.dq ? '<p class="result-state">Disqualified</p>' : c.retired ? '<p class="result-state">Did not finish</p>' : ''}</article>`;
    };
    const designs = Array.isArray(o.rowDesigns) ? o.rowDesigns : o.shared && Array.isArray(o.shared.rowDesigns) ? o.shared.rowDesigns : [];
    const rowDesign = opt.leaderboardDesign && designs.find(x => x && x.id === opt.leaderboardDesign);
    // A missing/deleted design must never leave a finished race without results.
    const listMode = rows.length > 4 && opt.largeField === 'leaderboard' && !!rowDesign && !!o.shared;
    const podium = listMode ? (win ? [win] : []) : win ? [win, ...rows.filter(x => x !== win && !x.car.comparisonOnly && !x.car.dq && !x.car.retired).slice(0, 2)] : [];
    const podiumHtml = podium.length ? `<section class="results-podium results-podium-${podium.length}">${podium.map((x, i) => spotlight(x, i + 1, i === 0)).join('')}</section>` : '';
    const classification = listMode ? `<section class="results-classification"><header><div><span>Full classification</span><strong>${escText(rowDesign.name || 'Leaderboard rows')}</strong></div><em>All ${rows.length} results</em></header>${Rows.html(rowDesign,eventRows?{...o.shared,season:null,past:null}:o.shared,undefined,{components:o.components,...(eventRows?{countOver:'all'}:{})})}</section>` : '';
    const cards = listMode ? [] : podium.length ? rows.filter(x => !podium.includes(x)) : rows, compare = opt.comparison === 'none' ? [] : rows.map(x => ({ x, value: value(eng, x.car, opt.comparison, ctx, x) })).filter(x => Number.isFinite(x.value)), nums = compare.map(x => x.value), lower = lowWins(opt.comparison), scale = comparisonScale(nums);
    const chart = compare.length ? `<section class="results-chart"><header><div><span>Race comparison</span><strong>${escText(label(opt.comparison))}</strong></div><em>${lower ? 'Lower is better' : 'Higher is better'} · Bars start at zero</em></header><div class="results-chart-axis" aria-label="${escText(axisUnit(opt.comparison))}, ${axisNumber(opt.comparison, scale.min)} to ${axisNumber(opt.comparison, scale.max)}"><span>${axisUnit(opt.comparison)}</span><div class="results-chart-ticks">${scale.ticks.map(n => `<span>${axisNumber(opt.comparison, n)}</span>`).join('')}</div></div><div class="results-chart-bars">${compare.map(({ x, value: v }) => { const lane = (o.layout && o.layout.laneColors && o.layout.laneColors[x.car.lane]) || {}, colour = /^#[0-9a-f]{3,8}$/i.test(lane.bg || '') ? lane.bg : '#4c9aff'; return `<div class="results-chart-row"><span>${escText(x.car.driverName)}</span><i style="--chart-zero:${scale.zero}%"><b style="width:${scale.bar(v).width}%;margin-left:${scale.bar(v).left}%;background:${escText(colour)}"></b></i><strong>${escText(show(opt.comparison, v, x))}</strong></div>`; }).join('')}</div></section>` : '';
    const countClass = cards.length ? ` results-count-${Math.min(cards.length, 8)}` : ' results-count-0', compareNote = opt.comparison === 'none' ? 'Comparison chart off' : `Comparing ${label(opt.comparison).toLowerCase()}`;
    const classRows=o.phase==='finished'&&o.heat?.classRows?.length?o.heat.classRows:eng.classStandings?.()||[];
    return `<section class="results-wall"><header class="results-head"><div><p class="eyebrow">${escText(phase)}</p><h2>Race results</h2><p class="muted">${escText(o.title || '')}</p></div><div class="results-compare-note">${escText(compareNote)}</div></header><div class="results-stage">${podiumHtml}${MC&&eng.classStandings?MC.resultsHtml(classRows,eng.multiclass,true):''}${classification}<div class="results-grid${countClass}">${cards.map(card).join('') || ''}</div>${chart || (rows.length ? '<p class="results-chart-off">Choose a comparison chart in Customization › Race Results.</p>' : '<p class="muted">No results yet.</p>')}</div></section>`;
  }
  const api = { comparisonScale, METRICS, COMPARE_METRICS, clean, label, value, html };
  if (typeof module !== 'undefined') module.exports = api;
  return api;
})();
