// The race report as a PDF (2.4.0, SlotForgeRestyle.md "Race Report PDF"): the look of SlotForge on paper. Page one tells the race as a club tells it on a
// forum (the podium, the classification with the gaps, the fastest lap and its lane, the closest fight, the laps per lane, the heats); after it a page for
// every driver, never more than one (the figures as tiles, every lap on the chart of Finalize race results, per lane, through the race, the spread, the lap
// sheet). Colour or Monochrome: the page is white either way, colour is only in thin lines and pale tints; Monochrome uses no colour at all.
// Pure: it only builds HTML. report.js puts its own tables (the classification, the heats, the swaps, the tyres) inside it.
(function (root) {
  const E = typeof module !== 'undefined' ? require('./engine.js') : root.RaceEngine;
  const ST = typeof module !== 'undefined' ? require('./stats.js') : root.Stats;
  const IC = typeof module !== 'undefined' ? require('./icons.js') : root.Icons;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const PALETTE = ['#e5484d', '#3b82f6', '#f5c211', '#3ecf8e', '#a855f7', '#f97316', '#14b8a6', '#ec4899']; // (the lane colours of the app, HomeStats)
  const laneColor = n => PALETTE[(Math.max(1, Math.round(Number(n) || 1)) - 1) % PALETTE.length]; // n: lane 1, 2 ...
  const t = ms => (Number.isFinite(ms) && ms > 0 ? E.fmtTime(ms) : '–');
  const s3 = ms => (Number.isFinite(ms) ? (ms / 1000).toFixed(3) : '–');
  const ico = (name, size = 12) => (IC && IC.svg ? IC.svg(name, { size, stroke: 1.8 }) : '');
  const median = a => {
    if (!a.length) return NaN;
    const b = [...a].sort((x, y) => x - y),
      m = b.length >> 1;
    return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2;
  };
  // (no spread: a race of thousands of laps)
  const minOf = a => a.reduce((m, v) => (v < m ? v : m), Infinity),
    maxOf = a => a.reduce((m, v) => (v > m ? v : m), -Infinity);
  const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
  const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');

  // ---- the figures (pure, tested) ----
  // the laps of one row of the standings, in order; a lap that counts (clean) is valid, not too slow, not late, not a pit lap; an off is a clean lap
  // slower than 1.6 times the median of the clean laps (a deslot or a crash, as Scrutineering marks it)
  function driverLaps(session, x, laps) {
    const mine = (laps || [])
      .filter(
        l =>
          (l.sessionId === undefined || l.sessionId === session.id) &&
          (x.asTeam ? !!x.teamId && l.teamId === x.teamId : l.driverId === x.driverId)
      )
      .sort((a, b) => (a.heat || 0) - (b.heat || 0) || (a.lapNumber || 0) - (b.lapNumber || 0));
    const ok = l => Number(l.time) > 0 && !l.invalid && !l.tooSlow && !l.late;
    const pace = mine.filter(l => ok(l) && !l.pit).map(l => Number(l.time)),
      med = median(pace),
      offAt = Number.isFinite(med) ? med * 1.6 : Infinity;
    const list = mine.map((l, i) => ({
      n: i + 1,
      time: Number(l.time),
      lane: Math.round(Number(l.lane)) || 0,
      heat: l.heat || 0,
      pit: !!l.pit,
      bad: !ok(l),
      off: ok(l) && !l.pit && Number(l.time) > offAt
    }));
    return { list, med };
  }
  // the clean laps (no pit, no off, not bad)
  const clean = list => list.filter(l => !l.bad && !l.pit && !l.off);
  function lanesOf(list) {
    const by = new Map();
    list.forEach(l => {
      if (!l.lane) return;
      const g = by.get(l.lane) || { lane: l.lane, laps: 0, times: [] };
      if (!l.bad) g.laps++;
      if (!l.bad && !l.pit && !l.off) g.times.push(l.time);
      by.set(l.lane, g);
    });
    return [...by.values()]
      .sort((a, b) => a.lane - b.lane)
      .map(g => ({ lane: g.lane, laps: g.laps, best: g.times.length ? minOf(g.times) : NaN, avg: mean(g.times) }));
  }
  // the race in three parts: the average of the clean laps of each part, and how much faster the end was than the start (ms a lap, + = faster)
  function thirds(list) {
    const c = clean(list);
    if (c.length < 6) return null;
    const k = Math.ceil(c.length / 3),
      parts = [c.slice(0, k), c.slice(k, 2 * k), c.slice(2 * k)].map(p => ({
        avg: mean(p.map(l => l.time)),
        best: minOf(p.map(l => l.time))
      }));
    return { parts, gain: parts[0].avg - parts[2].avg };
  }
  // the gap of a row to the winner, in words: "+2 laps", "+4.120 s", "+3 pts"
  function gapText(session, rows, i) {
    if (!i) return '';
    const a = rows[0],
      b = rows[i];
    if (['practice', 'qualifying'].includes(session.sessionType))
      return Number(a.best) > 0 && Number(b.best) > 0 ? `+${s3(b.best - a.best)} s` : '';
    if (session.resultBy === 'points' && Number.isFinite(a.points) && Number.isFinite(b.points))
      return `−${Math.round((a.points - b.points) * 100) / 100} pts`;
    if (Number.isFinite(a.laps) && Number.isFinite(b.laps) && a.laps !== b.laps) {
      const d = a.laps - b.laps;
      return `+${d} ${d === 1 ? 'lap' : 'laps'}`;
    }
    if (Number.isFinite(a.total) && Number.isFinite(b.total) && b.total >= a.total) return `+${s3(b.total - a.total)} s`;
    return '';
  }
  // everything page one says about the race, from the standings and the laps
  function facts(session, laps, figs) {
    const rows = session.standings || [],
      per = rows.map(x => ({ x, ...driverLaps(session, x, laps) }));
    let fastest = null;
    per.forEach(p =>
      clean(p.list).forEach(l => {
        if (!fastest || l.time < fastest.time) fastest = { name: p.x.driverName, time: l.time, lane: l.lane, n: l.n };
      })
    );
    // the closest fight: the two neighbours in the classification with the smallest gap (same laps: the time; else one lap)
    let close = null;
    for (let i = 2; i < rows.length; i++) {
      // (from 2nd and 3rd on: the winner and the second are the winning margin)
      const a = rows[i - 1],
        b = rows[i];
      if (a.laps === b.laps && Number.isFinite(a.total) && Number.isFinite(b.total)) {
        const d = Math.abs(b.total - a.total);
        if (!close || close.laps || d < close.ms) close = { a: a.driverName, b: b.driverName, pos: i, ms: d, laps: 0 };
      } else if (!close && Number.isFinite(a.laps) && Number.isFinite(b.laps) && a.laps - b.laps === 1)
        close = { a: a.driverName, b: b.driverName, pos: i, ms: NaN, laps: 1 };
    }
    // the steadiest: the smallest spread (standard deviation of the valid laps), five laps or more
    let steady = null;
    (figs || []).forEach((f, i) => {
      if (f && f.count >= 5 && Number.isFinite(f.spread) && (!steady || f.spread < steady.spread))
        steady = { name: rows[i].driverName, spread: f.spread };
    });
    // the fastest lane: the lowest median of all clean laps on it (two lanes or more)
    const byLane = new Map();
    per.forEach(p =>
      clean(p.list).forEach(l => {
        if (!l.lane) return;
        const g = byLane.get(l.lane) || { lane: l.lane, times: [], best: null };
        g.times.push(l.time);
        if (!g.best || l.time < g.best.time) g.best = { time: l.time, name: p.x.driverName };
        byLane.set(l.lane, g);
      })
    );
    const lanes = [...byLane.values()]
      .sort((a, b) => a.lane - b.lane)
      .map(g => ({ lane: g.lane, med: median(g.times), best: g.best, laps: g.times.length }));
    const fastLane = lanes.length > 1 ? [...lanes].sort((a, b) => a.med - b.med)[0] : null;
    // the strongest finish: the biggest gain from the first to the last third
    let finish = null;
    per.forEach(p => {
      const th = thirds(p.list);
      if (th && th.gain > 0 && (!finish || th.gain > finish.gain)) finish = { name: p.x.driverName, gain: th.gain };
    });
    const offs = per.map(p => ({ name: p.x.driverName, n: p.list.filter(l => l.off).length })).filter(o => o.n);
    return { per, fastest, close, steady, lanes, fastLane, finish, offs, offTotal: offs.reduce((a, o) => a + o.n, 0) };
  }

  // ---- the race lap by lap: the place of every driver after every lap, and the gap to the leader (a race of laps, without heats) ----
  function story(session, F) {
    if (session.heatResults || !lapRace(session) || F.per.length < 2) return null;
    const cum = F.per.map(p => {
      let sum = 0;
      return p.list.map(l => (sum += l.time));
    });
    const K = maxOf(cum.map(c => c.length));
    if (K < 3) return null;
    const pos = F.per.map(() => []),
      gap = F.per.map(() => []);
    for (let k = 0; k < K; k++) {
      const at = cum
        .map((c, i) => ({ i, t: c[k] }))
        .filter(z => Number.isFinite(z.t))
        .sort((a, b) => a.t - b.t);
      at.forEach((z, r) => {
        pos[z.i][k] = r + 1;
        gap[z.i][k] = z.t - at[0].t;
      });
    }
    return { K, pos, gap, n: F.per.length, led: pos.map(a => a.filter(v => v === 1).length) };
  }
  const DASH = ['', '5 2.5', '1.6 2.2', '7 2.5 1.6 2.5', '3 3', '9 3', '1.6 4', '5 2 5 6'];
  const driverColor = (x, i) => (Math.round(Number(x.lane)) > 0 ? laneColor(x.lane) : PALETTE[i % PALETTE.length]);
  // page one: a line for every driver, the place after every lap (first on top), the name at the end
  function storyChart(S, F, mono) {
    const W = 760,
      rowH = Math.max(13, Math.min(22, 150 / S.n)),
      T = 8,
      B = 18,
      L = 26,
      R = 92,
      H = T + B + rowH * (S.n - 1) + 4;
    const x = k => L + (S.K === 1 ? 0 : (k * (W - L - R)) / (S.K - 1)),
      y = r => T + (r - 1) * rowH;
    const grid = Array.from(
      { length: S.n },
      (_, r) =>
        `<line class="rc-grid" x1="${L}" x2="${W - R}" y1="${y(r + 1)}" y2="${y(r + 1)}"/><text class="rc-yl" x="${L - 5}" y="${y(r + 1) + 3}">P${r + 1}</text>`
    ).join('');
    const step = S.K > 150 ? 25 : S.K > 60 ? 10 : 5;
    const xl = Array.from({ length: S.K }, (_, k) =>
      (k + 1) % step === 0 || k === 0 ? `<text class="rc-xl" x="${x(k).toFixed(1)}" y="${H - 3}">${k + 1}</text>` : ''
    ).join('');
    const lines = S.pos
      .map((a, i) => {
        const pts = a.map((r, k) => (r ? `${x(k).toFixed(1)},${y(r).toFixed(1)}` : '')).filter(Boolean);
        if (!pts.length) return '';
        const c = mono ? '#15181d' : driverColor(F.per[i].x, i),
          last = a.length - 1;
        return `<polyline class="st-line" points="${pts.join(' ')}" style="stroke:${c}${mono && DASH[i % DASH.length] ? ';stroke-dasharray:' + DASH[i % DASH.length] : ''}"/><circle cx="${x(last).toFixed(1)}" cy="${y(a[last]).toFixed(1)}" r="2.6" style="fill:${c}"/><line class="st-tie" x1="${(x(last) + 3).toFixed(1)}" y1="${y(a[last]).toFixed(1)}" x2="${W - R + 4}" y2="${y(i + 1).toFixed(1)}" style="stroke:${c}"/><text class="st-name" x="${W - R + 7}" y="${(y(i + 1) + 3).toFixed(1)}">${i + 1}. ${esc(F.per[i].x.driverName)}</text>`;
      })
      .join('');
    return `<svg class="rp-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="The place of every driver after every lap">${grid}${lines}${xl}</svg>`;
  }
  function storyHtml(session, F, mono) {
    const S = story(session, F);
    if (!S) return '';
    const leaders = F.per
      .map((p, i) => ({ name: p.x.driverName, n: S.led[i] }))
      .filter(z => z.n)
      .sort((a, b) => b.n - a.n);
    return `<section class="rp-section rp-story"><div class="dp-bh"><h2 class="rp-h">The race lap by lap</h2><span class="dp-legend">Led: ${leaders.map(z => `${esc(z.name)} ${z.n} ${z.n === 1 ? 'lap' : 'laps'}`).join(' · ')}</span></div>${storyChart(S, F, mono)}</section>`;
  }
  // a driver page: the place after every lap, and the gap to the leader (seconds), as two small charts
  function miniPlace(S, i, mono) {
    const W = 360,
      H = 92,
      L = 22,
      R = 6,
      T = 6,
      B = 14,
      a = S.pos[i];
    const x = k => L + (S.K === 1 ? 0 : (k * (W - L - R)) / (S.K - 1)),
      y = r => T + ((r - 1) * (H - T - B)) / Math.max(1, S.n - 1);
    const lbl = [1, S.n]
      .map(
        r =>
          `<text class="rc-yl" x="${L - 4}" y="${y(r) + 3}">P${r}</text><line class="rc-grid" x1="${L}" x2="${W - R}" y1="${y(r)}" y2="${y(r)}"/>`
      )
      .join('');
    const pts = a
      .map((r, k) => (r ? `${x(k).toFixed(1)},${y(r).toFixed(1)}` : ''))
      .filter(Boolean)
      .join(' ');
    return `<svg class="rp-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="The place after every lap">${lbl}<polyline class="st-line" points="${pts}" style="stroke:${mono ? '#15181d' : '#3b82f6'}"/></svg>`;
  }
  function miniGap(S, i, mono) {
    const W = 360,
      H = 92,
      L = 30,
      R = 6,
      T = 6,
      B = 14,
      a = S.gap[i].map(v => (Number.isFinite(v) ? v : null)),
      top = Math.max(1, maxOf(a.filter(v => v !== null)));
    const x = k => L + (S.K === 1 ? 0 : (k * (W - L - R)) / (S.K - 1)),
      y = v => T + (v / top) * (H - T - B);
    const pts = a.map((v, k) => (v === null ? '' : `${x(k).toFixed(1)},${y(v).toFixed(1)}`)).filter(Boolean);
    const area = pts.length ? `M${x(0).toFixed(1)},${y(0)} L${pts.join(' L')} L${x(a.length - 1).toFixed(1)},${y(0)} Z` : '';
    const lbl = [0, top]
      .map(
        v =>
          `<text class="rc-yl" x="${L - 4}" y="${y(v) + 3}">${v ? '+' + (v / 1000).toFixed(1) + ' s' : 'lead'}</text><line class="rc-grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/>`
      )
      .join('');
    return `<svg class="rp-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="The gap to the leader after every lap">${lbl}<path class="gp-area" d="${area}" style="fill:${mono ? '#dde1e6' : '#fde2e2'}"/><polyline class="st-line" points="${pts.join(' ')}" style="stroke:${mono ? '#15181d' : '#e5484d'}"/></svg>`;
  }

  // ---- the lap chart (the chart of Scrutineering, on paper) ----
  // every lap left to right; the time on a scale from the fastest to the slow end of the clean laps (an off is drawn on top, a pit lap at the bottom);
  // the best lap a purple dot, the median a dashed line, the lane of every lap as a strip along the bottom
  function chart(list, o = {}) {
    const W = 760,
      H = o.h || 210,
      L = 40,
      R = 8,
      T = 10,
      B = 34;
    if (list.length < 2) return '<p class="rp-none">Not enough laps for a chart.</p>';
    const c = clean(list).map(l => l.time),
      lo = c.length ? minOf(c) : minOf(list.map(l => l.time)),
      sorted = [...(c.length ? c : list.map(l => l.time))].sort((a, b) => a - b),
      hi0 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.97))],
      hi = Math.max(hi0, lo + 50),
      pad = (hi - lo) * 0.08,
      y0 = lo - pad,
      y1 = hi + pad;
    const x = i => L + ((i + 0.5) * (W - L - R)) / list.length,
      y = v => T + ((Math.min(Math.max(v, y0), y1) - y0) / (y1 - y0)) * (H - T - B),
      bw = Math.max(1, (W - L - R) / list.length);
    const best = c.length ? minOf(c) : NaN,
      med = median(c);
    const ticks = [lo, (lo + hi) / 2, hi]
      .map(
        v =>
          `<line class="rc-grid" x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="rc-yl" x="${L - 4}" y="${(y(v) + 3).toFixed(1)}">${s3(v)}</text>`
      )
      .join('');
    const offCols = list
      .map((l, i) =>
        l.off || l.bad
          ? `<rect class="${l.off ? 'rc-off' : 'rc-bad'}" x="${(x(i) - bw / 2).toFixed(1)}" y="${T}" width="${bw.toFixed(1)}" height="${H - T - B}"/>`
          : ''
      )
      .join('');
    const path = list
      .map((l, i) => ({ l, i }))
      .filter(p => !p.l.bad && !p.l.off && !p.l.pit)
      .map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)} ${y(p.l.time).toFixed(1)}`)
      .join('');
    const dots = list
      .map((l, i) =>
        l.bad || l.off
          ? `<path class="rc-x" d="M${(x(i) - 2.6).toFixed(1)} ${T + 3}l5.2 5.2m0 -5.2l-5.2 5.2"/>`
          : l.pit
            ? `<path class="rc-pit" d="M${x(i).toFixed(1)} ${H - B - 7}l3.5 6h-7z"/>`
            : list.length <= 120
              ? `<circle class="rc-dot${l.time === best ? ' rc-best' : ''}" cx="${x(i).toFixed(1)}" cy="${y(l.time).toFixed(1)}" r="${l.time === best ? 3.6 : 1.7}"/>`
              : l.time === best
                ? `<circle class="rc-dot rc-best" cx="${x(i).toFixed(1)}" cy="${y(l.time).toFixed(1)}" r="3.6"/>`
                : ''
      )
      .join('');
    // the lane of every lap, as a strip (segments of the same lane joined), with the lane number where there is room
    const strip = [];
    list.forEach((l, i) => {
      const last = strip[strip.length - 1];
      if (last && last.lane === l.lane) last.to = i;
      else strip.push({ lane: l.lane, from: i, to: i });
    });
    const sy = H - B + 6,
      stripSvg = strip
        .map(s => {
          const x0 = x(s.from) - bw / 2,
            w = x(s.to) - x(s.from) + bw;
          return s.lane
            ? `<rect class="rc-lane ln-${s.lane}${s.lane % 2 ? '' : ' alt'}" style="fill:${laneColor(s.lane)}" x="${x0.toFixed(1)}" y="${sy}" width="${Math.max(0.6, w - 0.6).toFixed(1)}" height="9"/>${w > 16 ? `<text class="rc-ln" x="${(x0 + w / 2).toFixed(1)}" y="${sy + 6.6}">${s.lane}</text>` : ''}`
            : '';
        })
        .join('');
    const step = list.length > 150 ? 25 : list.length > 60 ? 10 : 5;
    const xl = list
      .map((l, i) => ((i + 1) % step === 0 || i === 0 ? `<text class="rc-xl" x="${x(i).toFixed(1)}" y="${H - 2}">${i + 1}</text>` : ''))
      .join('');
    return `<svg class="rp-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Every lap: the time of each lap, the best lap, the offs and the pit stops">${ticks}${offCols}${Number.isFinite(med) ? `<line class="rc-med" x1="${L}" x2="${W - R}" y1="${y(med).toFixed(1)}" y2="${y(med).toFixed(1)}"/>` : ''}<path class="rc-line" d="${path}"/>${dots}${stripSvg}${xl}</svg>`;
  }
  // the spread of the clean laps: how many fell in each slice from the best to the slow end
  function histogram(list) {
    const c = clean(list).map(l => l.time);
    if (c.length < 5) return '<p class="rp-none">Not enough clean laps.</p>';
    const lo = minOf(c),
      hi = maxOf(c),
      n = 10,
      w = (hi - lo) / n || 1,
      bins = Array.from({ length: n }, () => 0);
    c.forEach(v => bins[Math.min(n - 1, Math.floor((v - lo) / w))]++);
    const most = maxOf(bins);
    return `<div class="rp-hist">${bins.map((b, i) => `<i style="height:${Math.max(3, Math.round((b / most) * 100))}%"${i === 0 ? ' class="hb-best"' : ''} title="${b}"></i>`).join('')}</div><div class="rp-histx"><span>${s3(lo)}</span><span>${s3(hi)}</span></div>`;
  }
  // the lap sheet: every lap in columns, the best purple, an off struck, a pit lap in italics; at most 240 laps (more: the best and the slowest ten)
  function lapSheet(list) {
    if (!list.length) return '<p class="rp-none">No laps were recorded.</p>';
    const c = clean(list),
      best = c.length ? minOf(c.map(l => l.time)) : NaN;
    const cell = l =>
      `<span class="ls-c${l.time === best && !l.bad && !l.off && !l.pit ? ' ls-best' : ''}${l.off ? ' ls-off' : ''}${l.bad ? ' ls-bad' : ''}${l.pit ? ' ls-pit' : ''}"><small>${l.n}</small>${l.bad || l.off ? `<s>${s3(l.time)}</s>` : l.pit ? `<i>${s3(l.time)}</i>` : s3(l.time)}</span>`;
    if (list.length <= 240) {
      const cols = list.length <= 40 ? 4 : list.length <= 90 ? 6 : list.length <= 150 ? 8 : 12,
        rows = Math.ceil(list.length / cols);
      return `<div class="ls-grid${list.length > 150 ? ' ls-dense' : ''}" style="grid-template-rows:repeat(${Math.min(rows, list.length)},auto);grid-template-columns:repeat(${cols},minmax(0,74pt))">${list.map(cell).join('')}</div>`;
    }
    const by = [...c].sort((a, b) => a.time - b.time);
    return `<p class="rp-none">${list.length} laps: the ten fastest and the ten slowest clean laps.</p><div class="ls-grid" style="grid-template-rows:repeat(10,auto);grid-template-columns:repeat(2,minmax(0,1fr))">${[...by.slice(0, 10), ...by.slice(-10)].map(cell).join('')}</div>`;
  }

  const lapRace = session => !['practice', 'qualifying'].includes(session.sessionType);
  // ---- the parts of the pages ----
  const disc = (lane, big) => (lane ? `<span class="ln${big ? ' ln-big' : ''}" style="--c:${laneColor(lane)}">${lane}</span>` : '');
  function head({ session, label, dateText, kicker, title, sub, right }) {
    const d = session && session.date ? new Date(session.date) : null;
    return `<header class="rp-head"><div class="rp-ht"><span class="rp-k">${esc(kicker)}</span><h1>${esc(title)}</h1><p class="rp-meta">${sub}</p></div><div class="rp-hr">${right || ''}${
      d && !isNaN(d)
        ? `<span class="rp-date"><b>${d.getDate()}</b><small>${esc(d.toLocaleString('en-GB', { month: 'short' }))} ${d.getFullYear()}</small></span>`
        : ''
    }</div></header><div class="rp-check" aria-hidden="true"></div>`;
  }
  function podium(session, rows, figs) {
    const top = rows.slice(0, 3);
    if (!top.length) return '';
    const card = (x, i) =>
      `<div class="pd pd${i + 1}"><span class="pd-pl">${esc(x.pos ?? i + 1)}</span><div class="pd-w"><small>${i ? (i === 1 ? 'Second' : 'Third') : lapRace(session) ? 'Winner' : 'Fastest'}</small><b>${esc(x.driverName)}</b><span>${esc(x.carName || '')}</span></div><div class="pd-f"><b>${esc(x.laps ?? '–')}<small> laps</small></b><span>${i ? esc(gapText(session, rows, i)) || '&nbsp;' : 'Best ' + esc(t(x.best))}</span></div></div>`;
    return `<section class="rp-podium">${[top[1], top[0], top[2]].map((x, k) => (x ? card(x, [1, 0, 2][k]) : '<div></div>')).join('')}</section>`;
  }
  function notes(F, rows, session) {
    const items = [];
    if (F.fastest)
      items.push([
        'bolt',
        'Fastest lap',
        `${esc(F.fastest.name)} · <b class="rp-best">${esc(t(F.fastest.time))}</b>`,
        `lap ${F.fastest.n}${F.fastest.lane ? ' · lane ' + F.fastest.lane : ''}`
      ]);
    if (rows.length > 1) {
      const g = gapText(session, rows, 1);
      if (g)
        items.push([
          'flag',
          'Winning margin',
          `${esc(rows[0].driverName)} by <b>${esc(g.replace(/^[+−]/, '').replace(/^1 pts$/, '1 pt'))}</b>`,
          `over ${esc(rows[1].driverName)}`
        ]);
    }
    if (F.close && F.close.pos > 1)
      items.push([
        'users',
        'Closest fight',
        `${esc(F.close.a)} and ${esc(F.close.b)}`,
        F.close.laps
          ? `${ordinal(F.close.pos)} and ${ordinal(F.close.pos + 1)}, one lap apart`
          : `${ordinal(F.close.pos)} and ${ordinal(F.close.pos + 1)}, ${s3(F.close.ms)} s apart`
      ]);
    if (F.steady) items.push(['gauge', 'Most consistent', esc(F.steady.name), `spread ${s3(F.steady.spread)} s`]);
    if (F.fastLane)
      items.push([
        'timing',
        'Fastest lane',
        `${disc(F.fastLane.lane)} Lane ${F.fastLane.lane}`,
        `median ${s3(F.fastLane.med)} s · best ${esc(t(F.fastLane.best.time))} ${esc(F.fastLane.best.name)}`
      ]);
    if (F.finish) items.push(['up', 'Strongest finish', esc(F.finish.name), `${s3(F.finish.gain)} s a lap faster at the end`]);
    if (F.offTotal)
      items.push([
        'x',
        'Offs',
        `<b>${F.offTotal}</b> in the race`,
        F.offs
          .sort((a, b) => b.n - a.n)
          .slice(0, 3)
          .map(o => `${esc(o.name)} ${o.n}`)
          .join(' · ')
      ]);
    const out = rows.filter(x => ST.outText(x)).map(x => `${esc(x.driverName)}: ${esc(ST.outText(x))}`);
    if (out.length) items.push(['ban', 'Out of the race', out.join(' · '), '']);
    if (!items.length) return '';
    return `<section class="rp-notes"><h2 class="rp-h">Race notes</h2><div class="rn-grid">${items.map(([i, k, v, s]) => `<div class="rn"><span class="rn-i">${ico(i, 13)}</span><div><small>${esc(k)}</small><b>${v}</b>${s ? `<span>${s}</span>` : ''}</div></div>`).join('')}</div></section>`;
  }
  // laps per lane: a row per driver, a column per lane (laps and the best on it), the fastest on every lane lit
  function lanesGrid(F) {
    const lanes = F.lanes.map(l => l.lane);
    if (lanes.length < 2) return '';
    const rows = F.per.map(p => ({ p, by: new Map(lanesOf(p.list).map(g => [g.lane, g])) }));
    return `<section class="rp-lanes"><h2 class="rp-h">Laps per lane</h2><table class="rp-tbl rp-lt"><thead><tr><th>Driver</th>${lanes.map(l => `<th class="r">${disc(l)} Lane ${l}</th>`).join('')}</tr></thead><tbody>${rows
      .map(
        ({ p, by }) =>
          `<tr><td><b>${esc(p.x.driverName)}</b></td>${lanes
            .map(l => {
              const g = by.get(l),
                lane = F.lanes.find(z => z.lane === l);
              return g
                ? `<td class="r"><b>${g.laps}</b> <span class="${lane && lane.best && lane.best.time === g.best && lane.best.name === p.x.driverName ? 'rp-best' : 'rp-mut'}">${esc(t(g.best))}</span></td>`
                : '<td class="r rp-mut">–</td>';
            })
            .join('')}</tr>`
      )
      .join(
        ''
      )}</tbody><tfoot><tr><td>Lane best</td>${F.lanes.map(l => `<td class="r"><span class="rp-best">${esc(t(l.best && l.best.time))}</span></td>`).join('')}</tr></tfoot></table></section>`;
  }

  function middle(F, rows, session, mono) {
    const lanes = lanesGrid(F),
      wide = F.lanes.length > 4;
    return `<div class="rp-cols${lanes && !wide ? '' : ' rp-one'}">${notes(F, rows, session)}${wide ? '' : lanes}</div>${wide ? lanes : ''}${storyHtml(session, F, mono)}`;
  }
  // ---- a page for one driver ----
  function driverPage({ session, x, i, rows, fig, F, count, raceTitle, mono }) {
    const p = F.per[i],
      list = p.list,
      lanes = lanesOf(list),
      th = thirds(list),
      c = clean(list),
      best3 = [...c].sort((a, b) => a.time - b.time).slice(0, 3),
      offs = list.filter(l => l.off),
      pits = list.filter(l => l.pit),
      bestLap = best3[0],
      mainLane = lanes.length === 1 ? lanes[0].lane : Math.round(Number(x.lane)) || 0,
      S = F.story === undefined ? (F.story = story(session, F)) : F.story;
    const tile = (k, v, s, cls = '') => `<div class="dt${cls}"><small>${esc(k)}</small><b>${v}</b>${s ? `<span>${s}</span>` : ''}</div>`;
    const tiles = [
      tile('Laps', esc(x.laps ?? list.filter(l => !l.bad).length), ST.sectorText(x) ? '+ ' + esc(ST.sectorText(x)) : ''),
      tile(
        'Best lap',
        `<span class="rp-best">${esc(t(x.best || (bestLap && bestLap.time)))}</span>`,
        bestLap ? `lap ${bestLap.n}${bestLap.lane ? ' · lane ' + bestLap.lane : ''}` : ''
      ),
      tile('Average', esc(s3(fig && fig.avg)), 'clean laps'),
      tile('Median', esc(s3(fig && fig.median)), ''),
      tile('Spread', esc(s3(fig && fig.spread)), 'lower is steadier'),
      tile(
        i ? 'Behind the winner' : 'Result',
        i ? esc(gapText(session, rows, i)) || '–' : 'Winner',
        Number.isFinite(x.points) ? `${esc(x.points)} pts` : ''
      )
    ].join('');
    const ahead = i ? rows[i - 1] : null,
      behind = rows[i + 1] || null;
    const noteBits = [
      best3.length ? `Best laps: ${best3.map(l => `<b>${s3(l.time)}</b> (lap ${l.n})`).join(' · ')}` : '',
      offs.length
        ? `${offs.length} ${offs.length === 1 ? 'off' : 'offs'}: lap ${offs
            .map(l => l.n)
            .slice(0, 12)
            .join(', ')}${offs.length > 12 ? '…' : ''}`
        : 'No offs',
      pits.length ? `${pits.length} pit ${pits.length === 1 ? 'stop' : 'stops'}` : '',
      x.penaltyPoints ? `${esc(x.penaltyPoints)} penalty points` : '',
      ST.outText(x) ? esc(ST.outText(x)) : '',
      ahead
        ? `Ahead: ${esc(ahead.driverName)}${gapText(session, [ahead, x], 1) ? ' ' + esc(gapText(session, [ahead, x], 1).replace('+', '')) + ' up' : ''}`
        : '',
      behind
        ? `Behind: ${esc(behind.driverName)}${gapText(session, [x, behind], 1) ? ' ' + esc(gapText(session, [x, behind], 1).replace('+', '')) + ' back' : ''}`
        : ''
    ].filter(Boolean);
    const heats = (session.heatResults || [])
      .map(h => ({ h, r: (h.rows || []).find(r => (x.asTeam ? r.teamId === x.teamId : r.driverId === x.driverId)) }))
      .filter(z => z.r);
    const place = x.pos ?? i + 1;
    return `<section class="rp-dpage">
      <header class="dp-head${place <= 3 ? ' dp-p' + place : ''}"><span class="dp-pos"><small>${place <= 3 ? ['Winner', 'Second', 'Third'][place - 1] : 'Place'}</small><b>${esc(place)}</b></span>
        <div class="dp-who"><span class="rp-k">Driver report · ${i + 1} of ${count}</span><h1>${esc(x.driverName)}</h1><p class="rp-meta">${esc(x.carName || '')}${x.teamName ? ' · ' + esc(x.teamName) : ''}${mainLane ? ` · ${disc(mainLane)} lane ${mainLane}` : lanes.length > 1 ? ` · lanes ${lanes.map(l => disc(l.lane)).join(' ')}` : ''}</p></div>
        <div class="dp-race"><b>${esc(raceTitle)}</b><span>${esc(session.trackName || '')}</span></div></header>
      <div class="dp-tiles">${tiles}</div>
      <section class="dp-box"><div class="dp-bh"><h2 class="rp-h">Every lap</h2><span class="dp-legend"><i class="lg-best"></i>best lap<i class="lg-med"></i>median<i class="lg-off"></i>off<i class="lg-pit"></i>pit stop<i class="lg-lane"></i>lane</span></div>${chart(list, { h: list.length > 150 ? 190 : 210 })}</section>
      <div class="dp-row">
        <section class="dp-box"><h2 class="rp-h">Per lane</h2>${
          lanes.length
            ? `<table class="rp-tbl"><thead><tr><th>Lane</th><th class="r">Laps</th><th class="r">Best</th><th class="r">Average</th></tr></thead><tbody>${lanes
                .map(
                  g =>
                    `<tr><td>${disc(g.lane)}</td><td class="r">${g.laps}</td><td class="r${g.best === minOf(lanes.map(z => z.best)) ? ' rp-best' : ''}">${esc(t(g.best))}</td><td class="r">${esc(s3(g.avg))}</td></tr>`
                )
                .join('')}</tbody></table>`
            : '<p class="rp-none">The laps were saved without their lane.</p>'
        }</section>
        <section class="dp-box"><h2 class="rp-h">Through the race</h2>${
          th
            ? `<div class="dp-thirds">${['Start', 'Middle', 'End'].map((k, j) => `<div><small>${k}</small><b>${s3(th.parts[j].avg)}</b><span>best ${s3(th.parts[j].best)}</span></div>`).join('')}</div><p class="dp-trend ${th.gain >= 0 ? 'up' : 'down'}">${th.gain >= 0 ? '▲' : '▼'} ${s3(Math.abs(th.gain))} s a lap ${th.gain >= 0 ? 'faster' : 'slower'} at the end</p>`
            : '<p class="rp-none">Not enough clean laps.</p>'
        }</section>
        <section class="dp-box"><h2 class="rp-h">Lap spread</h2>${histogram(list)}</section>
      </div>
      ${S ? `<div class="dp-row dp-row2"><section class="dp-box"><div class="dp-bh"><h2 class="rp-h">Place lap by lap</h2><span class="dp-legend">${S.led[i] ? `led ${S.led[i]} ${S.led[i] === 1 ? 'lap' : 'laps'}` : 'never led'}</span></div>${miniPlace(S, i, mono)}</section><section class="dp-box"><div class="dp-bh"><h2 class="rp-h">Gap to the leader</h2><span class="dp-legend">${Number.isFinite(maxOf(S.gap[i].filter(Number.isFinite))) ? 'up to +' + (maxOf(S.gap[i].filter(Number.isFinite)) / 1000).toFixed(1) + ' s' : ''}</span></div>${miniGap(S, i, mono)}</section></div>` : ''}
      ${heats.length ? `<section class="dp-box dp-heats"><h2 class="rp-h">Heats</h2><div class="dh-grid">${heats.map(({ h, r }) => `<div><small>${esc(h.name || (h.final ? 'Final ' + h.final : 'Heat ' + h.heat))}</small><b>${esc(ordinal(Number(r.pos) || 0))}</b><span>${esc(r.laps ?? '')} laps${r.lane ? ' · lane ' + esc(r.lane) : ''}</span></div>`).join('')}</div></section>` : ''}
      <p class="dp-notes">${noteBits.join('<span class="sep">·</span>')}</p>
      <section class="dp-box dp-sheet"><div class="dp-bh"><h2 class="rp-h">Lap sheet</h2><span class="dp-legend"><b class="rp-best">best</b> · <s>off</s> · <i>pit</i></span></div>${lapSheet(list)}</section>
      <footer class="rp-foot"><span>${esc(raceTitle)} · ${esc(x.driverName)}</span><span class="rp-mark"><!--SF-PDF-WORDMARK--></span></footer>
    </section>`;
  }

  // ---- the style sheet: SlotForge on paper. --a the accent, --best purple, --c a lane colour; Monochrome sets them all to black and grey ----
  function css(mono) {
    return `/*SF-PDF-FONTS*/
      @page { size: A4; margin: 10mm 11mm; }
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body { margin: 0; color: #15181d; font: 8.6pt/1.35 "Segoe UI", Arial, Helvetica, sans-serif; --a: #e5484d; --best: #7c3aed; --gold: #d4a400; --silver: #9aa4b2; --bronze: #c9824f; --line: #d9dde3; --soft: #f5f6f8; --mut: #6b7280; }
      ${
        mono
          ? `body { --a: #15181d; --best: #15181d; --gold: #15181d; --silver: #6b7280; --bronze: #9aa4b2; --soft: #fff; }
      body * { --c: #15181d !important; }
      .ln { background: #fff !important; color: #15181d !important; box-shadow: inset 0 0 0 1pt #15181d; }
      .rp-best { text-decoration: underline; text-underline-offset: 1.5pt; }
      .rc-lane { fill: #4b5563 !important; } .rc-lane.alt { fill: #9aa4b2 !important; }
      .rc-off { fill: url(#hatch) #eee; } .rp-check { opacity: .55; } .rp-mark svg * { fill: #15181d !important; }
      .pd-pl, .rp-dpage .dp-pos { background: #fff !important; color: #15181d !important; box-shadow: inset 0 0 0 1.2pt #15181d !important; }
      .rp-dpage .dp-p1 .dp-pos { box-shadow: inset 0 0 0 2.4pt #15181d !important; }`
          : ''
      }
      h1, h2, .rp-k, .pd-pl, .dp-pos b, .dt b, .rp-date b, .rn b { margin: 0; }
      h1 { font: italic 700 25pt/1 "SF Barlow", "Barlow Condensed", "Bahnschrift SemiCondensed", "Arial Narrow", sans-serif; text-transform: uppercase; letter-spacing: -.2pt; }
      h2 { font: 700 7pt/1.2 "Segoe UI", Arial, sans-serif; letter-spacing: 1.4pt; text-transform: uppercase; color: var(--mut); margin: 0 0 5pt; }
      .rp-k { display: block; font: 700 6.8pt/1.2 "Segoe UI", Arial, sans-serif; letter-spacing: 1.6pt; text-transform: uppercase; color: var(--a); margin-bottom: 3pt; }
      .rp-meta { margin: 4pt 0 0; color: #3d434c; font-size: 8.6pt; }
      .mono, .r, td.r, .rp-tbl td, .dt b, .ls-c { font-variant-numeric: tabular-nums; }
      .rp-best { color: var(--best); font-weight: 700; }
      .rp-mut, .rp-none { color: var(--mut); } .rp-none { margin: 2pt 0; font-size: 8pt; }
      .ln { display: inline-grid; place-items: center; width: 11pt; height: 11pt; border-radius: 50%; background: var(--c); color: #fff; font: 700 7pt/1 "Segoe UI", Arial, sans-serif; vertical-align: -1.5pt; }
      .ln-big { width: 15pt; height: 15pt; font-size: 9pt; }
      /* the head of a page */
      .rp-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 14pt; padding: 0 0 7pt; border-top: 3pt solid var(--a); padding-top: 8pt; }
      .rp-hr { display: flex; align-items: center; gap: 10pt; }
      .rp-date { display: grid; place-items: center; width: 40pt; height: 40pt; border: 1pt solid var(--line); border-radius: 6pt; background: var(--soft); line-height: 1; }
      .rp-date b { font: italic 700 18pt/1 "SF Barlow", "Barlow Condensed", "Arial Narrow", sans-serif; } .rp-date small { font-size: 6.5pt; letter-spacing: .8pt; text-transform: uppercase; color: var(--mut); }
      .rp-mark svg { display: block; height: 11pt; width: auto; }
      .rp-head .rp-mark svg { height: 14pt; }
      .rp-check { height: 5pt; margin: 0 0 9pt; background: repeating-conic-gradient(#15181d 0 25%, #fff 0 50%) 0 0 / 5pt 5pt; opacity: .85; }
      /* the podium */
      .rp-podium { display: grid; grid-template-columns: 1fr 1.12fr 1fr; gap: 6pt; align-items: end; margin: 0 0 9pt; }
      .pd { --pc: var(--silver); display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 7pt; padding: 7pt 8pt; border: 1pt solid var(--line); border-top: 3pt solid var(--pc); border-radius: 6pt; background: #fff; }
      .pd1 { --pc: var(--gold); padding: 10pt 9pt; } .pd3 { --pc: var(--bronze); }
      .pd-pl { display: grid; place-items: center; width: 22pt; height: 22pt; border-radius: 5pt; background: var(--pc); color: #15110a; font: italic 700 15pt/1 "SF Barlow", "Barlow Condensed", "Arial Narrow", sans-serif; }
      .pd1 .pd-pl { width: 27pt; height: 27pt; font-size: 19pt; }
      .pd-w { display: flex; flex-direction: column; min-width: 0; } .pd-w small, .dt small, .rn small, .dp-thirds small, .dh-grid small, .dp-pos small { font: 700 6.2pt/1.2 "Segoe UI", Arial, sans-serif; letter-spacing: 1.2pt; text-transform: uppercase; color: var(--mut); }
      .pd-w b { font: italic 700 13pt/1.05 "SF Barlow", "Barlow Condensed", "Arial Narrow", sans-serif; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .pd1 .pd-w b { font-size: 16pt; } .pd-w > span, .pd-f > span { font-size: 7.4pt; color: var(--mut); white-space: nowrap; }
      .pd-f { display: flex; flex-direction: column; align-items: flex-end; } .pd-f b { font: 700 12pt/1 "SF Mono", "Roboto Mono", Consolas, monospace; } .pd-f b small { font: 400 7pt "Segoe UI", Arial, sans-serif; color: var(--mut); }
      /* a Race Sheet: the classification and the other tables */
      .rp-class table, .rp-tbl { width: 100%; border-collapse: collapse; font-size: 8.4pt; }
      .rp-class th, .rp-tbl th { padding: 4pt 6pt; border-bottom: 1pt solid #15181d; text-align: left; font: 700 6.4pt/1.2 "Segoe UI", Arial, sans-serif; letter-spacing: 1pt; text-transform: uppercase; color: var(--mut); white-space: nowrap; }
      .rp-class td, .rp-tbl td { padding: 3.6pt 6pt; border-bottom: .6pt solid var(--line); vertical-align: top; }
      .rp-class tbody tr:nth-child(even) td { background: var(--soft); }
      .rp-class td:first-child { font: italic 700 11pt/1 "SF Barlow", "Barlow Condensed", "Arial Narrow", sans-serif; width: 22pt; box-shadow: inset 2.4pt 0 0 var(--c, transparent); padding-left: 8pt; }
      .rp-class tbody tr:nth-child(1) td:first-child { color: var(--gold); } .rp-class tbody tr:nth-child(2) td:first-child { color: var(--silver); } .rp-class tbody tr:nth-child(3) td:first-child { color: var(--bronze); }
      .rp-class .wide th, .rp-class .wide td { font-size: 7.2pt; padding: 3pt 3.5pt; } .rp-class .wide th { white-space: normal; } .rp-class td:nth-child(2), .rp-class td:nth-child(3) { white-space: nowrap; }
      .rp-class svg.trophy { width: 9pt; height: 9pt; vertical-align: -1pt; }
      .rp-tbl tfoot td { border-bottom: 0; border-top: 1pt solid #15181d; font-size: 7.6pt; color: var(--mut); }
      .r { text-align: right; }
      .sub { margin: 4pt 0 0; color: var(--mut); font-size: 7.4pt; }
      /* race notes */
      .rp-cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10pt; margin-top: 10pt; align-items: start; }
      .rn-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5pt; }
      .rn { display: flex; gap: 6pt; padding: 5pt 6pt; border: .8pt solid var(--line); border-left: 2.4pt solid var(--a); border-radius: 0; background: #fff; break-inside: avoid; }
      .rn-i { flex: none; color: var(--a); padding-top: 1pt; } .rn div { display: flex; flex-direction: column; min-width: 0; }
      .rn b { font-size: 8.6pt; font-weight: 600; } .rn div > span { font-size: 7.2pt; color: var(--mut); }
      .rp-notes, .rp-lanes, .rp-section { break-inside: avoid; }
      .rp-section { margin-top: 10pt; }
      /* heats, swaps and the rest of page one (made by report.js) */
      .rp-heats p { margin: 0; padding: 4pt 6pt; border: .8pt solid var(--line); border-radius: 4pt; font-size: 7.8pt; break-inside: avoid; }
      .rp-heats { display: grid; grid-template-columns: 1fr 1fr; gap: 4pt; }
      .rp-heats > h2 { grid-column: 1 / -1; margin: 0; }
      .rp-extra h2 { margin-top: 10pt; } .rp-extra p { margin: 0 0 3pt; font-size: 8pt; }
      .rp-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 10pt; padding-top: 5pt; border-top: .8pt solid var(--line); font-size: 7pt; color: var(--mut); }
      .foot { color: var(--mut); font-size: 7pt; }
      /* a driver: one page, never more */
      .rp-dpage { break-before: page; page-break-before: always; height: 275mm; overflow: hidden; display: flex; flex-direction: column; gap: 7pt; }
      .rp-dpage > .rp-foot { margin-top: auto; }
      .dp-head { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 10pt; padding-top: 7pt; border-top: 3pt solid var(--a); }
      .dp-pos { --pc: #15181d; display: grid; place-items: center; align-content: center; width: 44pt; height: 44pt; border-radius: 7pt; background: var(--soft); box-shadow: inset 0 0 0 1pt var(--line); }
      .dp-p1 .dp-pos { background: var(--gold); box-shadow: none; } .dp-p2 .dp-pos { background: var(--silver); box-shadow: none; } .dp-p3 .dp-pos { background: var(--bronze); box-shadow: none; }
      .dp-pos b { font: italic 700 24pt/1 "SF Barlow", "Barlow Condensed", "Arial Narrow", sans-serif; } .dp-pos small { font-size: 5.6pt; }
      .dp-p1 .dp-pos small, .dp-p2 .dp-pos small, .dp-p3 .dp-pos small { color: #15110a; }
      .dp-who h1 { font-size: 23pt; }
      .dp-race { display: flex; flex-direction: column; align-items: flex-end; text-align: right; font-size: 7.6pt; color: var(--mut); } .dp-race b { color: #15181d; font-size: 8.4pt; }
      .dp-tiles { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 5pt; }
      .dt { display: flex; flex-direction: column; gap: 1pt; padding: 5pt 7pt; border: .8pt solid var(--line); border-radius: 5pt; background: #fff; }
      .dt b { font: 700 13pt/1.1 "SF Mono", "Roboto Mono", Consolas, monospace; letter-spacing: -.3pt; } .dt > span { font-size: 6.8pt; color: var(--mut); }
      .dp-box { padding: 6pt 8pt; border: .8pt solid var(--line); border-radius: 6pt; background: #fff; break-inside: avoid; }
      .dp-bh { display: flex; justify-content: space-between; align-items: baseline; gap: 10pt; } .dp-bh h2 { margin-bottom: 3pt; }
      .dp-legend { display: flex; align-items: center; gap: 4pt; font-size: 6.6pt; color: var(--mut); white-space: nowrap; }
      .dp-legend i { display: inline-block; width: 8pt; height: 6pt; margin-left: 5pt; }
      .lg-best { border-radius: 50%; width: 6pt !important; background: var(--best); } .lg-med { border-top: 1pt dashed var(--mut); height: 0 !important; } .lg-off { background: #fde2e2; border: .6pt solid #f3a5a7; } .lg-pit { background: #15181d; clip-path: polygon(50% 0, 100% 100%, 0 100%); } .lg-lane { height: 3pt !important; background: linear-gradient(90deg, #e5484d 0 33%, #3b82f6 0 66%, #f5c211 0); }
      ${mono ? '.lg-off { background: #eee; border-color: #999; } .lg-lane { background: linear-gradient(90deg, #15181d 0 50%, #9aa4b2 0); }' : ''}
      .rp-chart { display: block; width: 100%; height: auto; }
      .rc-grid { stroke: var(--line); stroke-width: .6; } .rc-yl, .rc-xl { font: 7.4px "Segoe UI", Arial, sans-serif; fill: var(--mut); } .rc-ln { font: 700 7px "Segoe UI", Arial, sans-serif; fill: #fff; } .rc-yl { text-anchor: end; } .rc-xl, .rc-ln { text-anchor: middle; }
      .rc-off { fill: #fde2e2; } .rc-bad { fill: #eef0f3; } .rc-med { stroke: var(--mut); stroke-width: .8; stroke-dasharray: 3 2.5; }
      .rc-line { fill: none; stroke: ${mono ? '#15181d' : '#3b82f6'}; stroke-width: 1.2; stroke-linejoin: round; } .rc-dot { fill: ${mono ? '#15181d' : '#3b82f6'}; } .rc-best { fill: var(--best); stroke: #fff; stroke-width: 1; }
      .rc-x { stroke: ${mono ? '#15181d' : '#d9363b'}; stroke-width: 1.3; fill: none; } .rc-pit { fill: #15181d; }
      .dp-row { display: grid; grid-template-columns: 1.15fr 1fr 1fr; gap: 6pt; }
      .dp-thirds { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4pt; }
      .dp-thirds div, .dh-grid div { display: flex; flex-direction: column; } .dp-thirds b, .dh-grid b { font: 700 11pt/1.15 "SF Mono", "Roboto Mono", Consolas, monospace; } .dp-thirds div > span, .dh-grid div > span { font-size: 6.8pt; color: var(--mut); }
      .dp-trend { margin: 5pt 0 0; font-size: 7.6pt; font-weight: 600; } .dp-trend.up { color: ${mono ? '#15181d' : '#13834f'}; } .dp-trend.down { color: ${mono ? '#15181d' : '#b4232a'}; }
      .rp-hist { display: flex; align-items: flex-end; gap: 2pt; height: 44pt; padding-top: 2pt; border-bottom: .8pt solid #15181d; }
      .rp-hist i { flex: 1; background: ${mono ? '#9aa4b2' : '#bcd3fb'}; border-radius: 1.5pt 1.5pt 0 0; } .rp-hist i.hb-best { background: var(--best); }
      .rp-histx { display: flex; justify-content: space-between; font-size: 6.6pt; color: var(--mut); margin-top: 1.5pt; }
      .dh-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(70pt, 1fr)); gap: 4pt; }
      .dp-notes { margin: 0; padding: 5pt 8pt; border-left: 2.4pt solid var(--a); background: var(--soft); font-size: 7.8pt; line-height: 1.5; }
      .dp-notes .sep { margin: 0 5pt; color: var(--mut); }
      .dp-sheet { min-height: 0; overflow: hidden; }
      .dp-row2 { grid-template-columns: 1fr 1fr; }
      .rp-one { grid-template-columns: minmax(0, 1fr); }
      .rp-one .rn-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .st-line { fill: none; stroke-width: 1.5; stroke-linejoin: round; stroke-linecap: round; } .st-name { font: 600 7.6px "Segoe UI", Arial, sans-serif; fill: #15181d; } .st-tie { stroke-width: .7; stroke-dasharray: 1.5 1.5; }
      .rp-class td:nth-child(2) { min-width: 64pt; } .rp-class td:nth-child(3) { min-width: 56pt; }
      .ls-grid { display: grid; grid-auto-flow: column; column-gap: 6pt; }
      .ls-c { display: flex; justify-content: space-between; gap: 4pt; padding: .7pt 3pt; border-bottom: .5pt solid #eef0f3; font: 7.4pt/1.25 "SF Mono", "Roboto Mono", Consolas, monospace; }
      .ls-dense .ls-c { padding: .2pt 2pt; font-size: 6.6pt; line-height: 1.18; } .ls-dense { column-gap: 3pt; }
      .ls-c small { font: 6.2pt/1.4 "Segoe UI", Arial, sans-serif; color: var(--mut); }
      .ls-best { color: var(--best); font-weight: 700; background: ${mono ? '#fff' : '#f3ecff'}; } .ls-off s, .ls-bad s { color: ${mono ? '#6b7280' : '#c0262d'}; } .ls-pit i { color: var(--mut); }
      /* every lap time (report.js): the classic lap pages, in the same look */
      .page2 { break-before: page; page-break-before: always; } .page2 > h1 { font-size: 20pt; border-top: 3pt solid var(--a); padding-top: 7pt; }
      table.laps { width: 100%; border-collapse: collapse; font: 7.6pt/1.3 "SF Mono", "Roboto Mono", Consolas, monospace; } table.laps th { font: 700 6.6pt "Segoe UI", Arial, sans-serif; text-transform: uppercase; letter-spacing: .6pt; color: var(--mut); border-bottom: 1pt solid #15181d; padding: 3pt 4pt; text-align: right; } table.laps td { padding: 1.5pt 4pt; border-bottom: .5pt solid #eef0f3; text-align: right; } table.laps td:first-child, table.laps th:first-child { text-align: left; } table.laps b { color: var(--best); }
      thead { display: table-header-group; } tr { page-break-inside: avoid; }`;
  }
  // the hatch of an off in Monochrome (an SVG pattern the charts use)
  const defs = mono =>
    mono
      ? '<svg width="0" height="0" style="position:absolute"><defs><pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" fill="#fff"/><line x1="0" y1="0" x2="0" y2="4" stroke="#999" stroke-width="1.4"/></pattern></defs></svg>'
      : '';

  // ---- the other prints (2.4.0, SlotForgeRestyle.md "Race Report PDF"): the heat list, the standings, the racing rules, the QR code of Live Race ----
  // the same page: the style sheet of the race report, Colour or Monochrome, portrait or landscape, and the print's own rules (extra)
  function printDoc({ title, mono, landscape, body, extra = '' }) {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><style>
      ${css(mono)}
      ${landscape ? '@page { size: A4 landscape; margin: 10mm 12mm; }' : ''}
      ${extra}
    </style></head><body class="${mono ? 'pdf-mono' : 'pdf-colour'}">${defs(mono)}${body}</body></html>`;
  }
  // the lanes in the colour of their disc, for a table whose columns are lanes (first: the number of the column of lane 1)
  const laneHeads = (n, first, scope) =>
    Array.from(
      { length: n },
      (_, l) => `${scope} th:nth-child(${l + first})::before { background: ${laneColor(l + 1)}; content: '${l + 1}'; }`
    ).join('\n');
  const mark = '<span class="rp-mark"><!--SF-PDF-WORDMARK--></span>';
  const today = () => ({ date: new Date().toISOString() });

  const api = {
    printDoc,
    laneHeads,
    mark,
    today,
    story,
    storyHtml,
    middle,
    driverLaps,
    lanesOf,
    thirds,
    gapText,
    facts,
    chart,
    histogram,
    lapSheet,
    head,
    podium,
    notes,
    lanesGrid,
    driverPage,
    css,
    defs,
    laneColor
  };
  root.RaceReport = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
