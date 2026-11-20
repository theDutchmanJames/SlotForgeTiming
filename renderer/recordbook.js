// (2.4.0, SlotForgeRestyle.md "Record Book") Results and Records as a record book: a card for the record of every track and the history of that record,
// the races of the club grouped by month with their winner and podium, filters, a driver's personal bests and form, a driver's race history, a result
// corrected after it was saved, and the list as a CSV file.
// Pure: it makes text and numbers only, so it can be tested without a screen. renderer/database/recordbookview.js draws it and wires the buttons.
(function (root) {
  'use strict';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const lap = ms => {
    if (!(Number(ms) > 0)) return '';
    const s = Number(ms) / 1000;
    return s < 60 ? s.toFixed(3) : `${Math.floor(s / 60)}:${(s % 60).toFixed(3).padStart(6, '0')}`;
  };
  const DAY = 864e5;
  const day = iso => {
    const t = Date.parse(iso);
    return Number.isFinite(t) ? new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
  };
  const daysBetween = (a, b) => Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / DAY));
  const RACING = ['race', 'timed', 'endurance', 'heats'];
  const KIND = {
    race: 'Race',
    timed: 'Timed race',
    heats: 'Heats',
    practice: 'Practice',
    qualifying: 'Qualifying',
    endurance: 'Endurance'
  };
  const sorted = st => (Array.isArray(st) ? st.slice().sort((a, b) => (Number(a.pos) || 99) - (Number(b.pos) || 99)) : []);
  const inChamp = s => !!(s && s.champ && typeof s.champ === 'object' && s.champ.id && !s.champ.off);

  // ---- the records ----
  // the history of the record of a track: each time a race saved a lap faster than the record before it, oldest first. A lap that was taken out of the records
  // (faster than the record of now) is left out; the record of now (from the laps) ends the list.
  function history(sessions, trackId, current) {
    const list = (Array.isArray(sessions) ? sessions : [])
      .filter(s => s && s.trackId === trackId && s.sessionType !== 'tokens')
      .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
    const floor = current && Number(current.time) > 0 ? Number(current.time) : 0;
    const out = [];
    let best = Infinity;
    for (const s of list)
      for (const x of s.standings || []) {
        const t = Number(x && x.best);
        if (!(t > 0) || t >= best || (floor && t < floor)) continue;
        best = t;
        out.push({
          time: t,
          driverId: x.driverId || '',
          name: x.driverName || x.teamName || '',
          car: x.carName || '',
          date: s.date || '',
          race: s.setupName || '',
          sessionId: s.id
        });
      }
    if (floor && (!out.length || out[out.length - 1].time !== floor))
      out.push({
        time: floor,
        driverId: current.driverId || '',
        name: current.driverName || '',
        car: current.carName || '',
        date: current.date || '',
        race: current.sessionName || '',
        sessionId: current.sessionId || ''
      });
    return out;
  }
  // the card of a track record: the track drawn, its name and lanes, the time, the holder with their helmet, set and stood, how often it was beaten
  function recordCard(r, o = {}) {
    const cur = r.history[r.history.length - 1],
      beaten = r.history.length - 1,
      now = o.now || new Date().toISOString(),
      fresh = cur.date && daysBetween(cur.date, now) < 3;
    return `<article class="rb-rec" data-rec="${esc(r.track.id)}" tabindex="0" aria-label="The record of ${esc(r.track.name)}: ${esc(lap(cur.time))} by ${esc(cur.name)}">${fresh ? '<span class="rb-new">New</span>' : ''}<div class="rb-rtop">${o.trackSvg ? o.trackSvg(r.track.lanes) : ''}<div><b>${esc(r.track.name || 'Track')}</b><small>${r.track.lanes ? esc(r.track.lanes) + ' lanes · ' : ''}${r.races} ${r.races === 1 ? 'race' : 'races'}</small></div></div>
<div class="rb-rmid"><div class="rb-time">${esc(lap(cur.time))}</div><div class="rb-who">${o.helmet ? o.helmet(cur.driverId) : ''}<span><b>${esc(cur.name || 'Unknown')}</b><small>${esc(cur.car)}</small></span></div></div>
<div class="rb-rbot"><span${cur.date ? ` title="Stood ${daysBetween(cur.date, now)} days"` : ''}>${cur.date ? `Set ${esc(day(cur.date))}` : ''}</span><button type="button" class="rb-link" data-rec-history="${esc(r.track.id)}">${o.icon || ''}${beaten ? `Beaten ${beaten}×` : 'History'}</button><button type="button" class="btn sm ghost icon rb-more" data-rec-more="${esc(r.track.id)}" aria-haspopup="menu" aria-label="More for the record of ${esc(r.track.name)}" title="More">${o.more || '⋯'}</button></div></article>`;
  }

  // ---- the races ----
  const PERIODS = [
    ['all', 'All time'],
    ['year', 'This year'],
    ['month', 'This month'],
    ['30', 'Last 30 days']
  ];
  const KINDS = [
    ['all', 'All', () => true],
    ['race', 'Races', s => ['race', 'timed', 'endurance'].includes(s.sessionType)],
    ['heats', 'Heats', s => s.sessionType === 'heats'],
    ['practice', 'Practice', s => s.sessionType === 'practice'],
    ['qualifying', 'Qualifying', s => s.sessionType === 'qualifying'],
    ['champ', 'Championship', inChamp]
  ];
  const fold = t =>
    String(t ?? '')
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase();
  // the sessions that the filters let through, newest first: f = { q, track, driver, kind, period }
  function filter(sessions, f = {}, nowIso) {
    const now = new Date(nowIso || Date.now()),
      q = fold(f.q).trim();
    const from =
      f.period === 'year'
        ? new Date(now.getFullYear(), 0, 1).getTime()
        : f.period === 'month'
          ? new Date(now.getFullYear(), now.getMonth(), 1).getTime()
          : f.period === '30'
            ? now.getTime() - 30 * DAY
            : -Infinity;
    const kind = (KINDS.find(k => k[0] === f.kind) || KINDS[0])[2];
    return (Array.isArray(sessions) ? sessions : [])
      .filter(s => s && s.sessionType !== 'tokens')
      .filter(s => !f.track || s.trackId === f.track)
      .filter(s => !f.driver || (s.standings || []).some(x => x && x.driverId === f.driver))
      .filter(s => (Date.parse(s.date) || 0) >= from)
      .filter(kind)
      .filter(s => !q || fold([s.setupName, s.trackName, ...(s.standings || []).map(x => x && x.driverName)].join(' ')).includes(q))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }
  // the kinds with their counts for the chips (after the other filters)
  function kinds(sessions) {
    return KINDS.map(([id, label, test]) => ({ id, label, n: sessions.filter(test).length })).filter(k => k.id === 'all' || k.n > 0);
  }
  // [{ key, label, sessions }] by month, newest first
  function months(sessions) {
    const out = [];
    for (const s of sessions) {
      const t = Date.parse(s.date),
        key = Number.isFinite(t) ? new Date(t).toISOString().slice(0, 7) : 'none';
      let g = out[out.length - 1];
      if (!g || g.key !== key) {
        g = {
          key,
          label: Number.isFinite(t) ? new Date(t).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : 'No date',
          sessions: []
        };
        out.push(g);
      }
      g.sessions.push(s);
    }
    return out;
  }
  // a race as a row: the date, the name with its kind, track and championship round, the winner and the podium (the fastest in practice), the best lap
  function rowHtml(s, o = {}) {
    const st = sorted(s.standings),
      win = RACING.includes(s.sessionType),
      first = st[0],
      fast = st.reduce((m, x) => (Number(x.best) > 0 && (!m || Number(x.best) < Number(m.best)) ? x : m), null),
      t = Date.parse(s.date),
      d = Number.isFinite(t) ? new Date(t) : null;
    const who = !first
      ? '<small>No results</small>'
      : win && Number(first.pos) === 1 && !first.dq
        ? `<span class="w"><span class="rb-pos p1">1</span>${o.helmet ? o.helmet(first.driverId) : ''}<b>${esc(first.driverName || first.teamName)}</b></span><small>${esc(
            st
              .slice(1, 3)
              .map(x => x.driverName || x.teamName)
              .filter(Boolean)
              .join(' · ')
          )}</small>`
        : fast
          ? `<span class="w">${o.helmet ? o.helmet(fast.driverId) : ''}<b>${esc(fast.driverName || fast.teamName)}</b></span><small>fastest</small>`
          : '<small>No laps</small>';
    const round = inChamp(s)
      ? `<span class="rb-tag ch">${esc(o.champName ? o.champName(s.champ) : 'Championship')}${s.champ.round ? ' · R' + esc(s.champ.round) : ''}</span>`
      : '';
    return `<button type="button" class="rb-row" data-open-race="${esc(s.id)}"><span class="rb-date"><b>${d ? d.getDate() : '–'}</b><small>${d ? esc(d.toLocaleDateString('en-GB', { month: 'short' })) : ''}</small></span><span class="rb-what"><b>${esc(s.setupName || 'Race')}</b><small><span class="rb-tag">${esc(KIND[s.sessionType] || s.sessionType || 'Session')}</span>${esc(s.trackName || '')}${round}${s.correction && s.correction.length ? '<span class="rb-tag adj">Corrected</span>' : ''}</small></span><span class="rb-pod">${who}</span><span class="rb-best">${fast ? esc(lap(fast.best)) : '—'}<small>best lap</small></span><span class="rb-chev" aria-hidden="true">›</span></button>`;
  }

  // ---- a driver ----
  // races, wins, podiums, best lap, last raced, and every race (newest first) with the place, the best lap and the points
  function driver(sessions, id) {
    const rows = [];
    for (const s of Array.isArray(sessions) ? sessions : []) {
      if (!s || s.sessionType === 'tokens') continue;
      const x = (s.standings || []).find(r => r && r.driverId === id);
      if (x) rows.push({ s, x });
    }
    rows.sort((a, b) => String(b.s.date || '').localeCompare(String(a.s.date || '')));
    const racing = rows.filter(r => RACING.includes(r.s.sessionType));
    const out = {
      races: rows.length,
      wins: racing.filter(r => Number(r.x.pos) === 1 && !r.x.dq).length,
      podiums: racing.filter(r => Number(r.x.pos) >= 1 && Number(r.x.pos) <= 3 && !r.x.dq).length,
      best: rows.reduce((m, r) => (Number(r.x.best) > 0 && (!m || Number(r.x.best) < m) ? Number(r.x.best) : m), 0),
      last: rows.length ? rows[0].s.date : '',
      rows,
      form: racing.slice(0, 8).map(r => (r.x.dq ? 'DQ' : Number(r.x.pos) || '–'))
    };
    return out;
  }
  // the finishing places of the last races as a line (oldest left): { width, height, path, points: [{ x, y, pos }] }
  function formLine(positions, w = 940, h = 120) {
    const list = positions.filter(p => Number.isFinite(p)).reverse(),
      max = Math.max(4, ...list);
    const pts = list.map((p, i) => ({
      x: Math.round(20 + (i * (w - 40)) / Math.max(1, list.length - 1)),
      y: Math.round(10 + ((p - 1) * (h - 20)) / (max - 1)),
      pos: p
    }));
    return { width: w, height: h, max, points: pts, path: pts.map(p => p.x + ',' + p.y).join(' ') };
  }

  // ---- correct a saved result ----
  // a race, a timed race or an endurance race can be corrected; heats and races scored by points cannot (their order comes from the heats or the points)
  const canCorrect = s =>
    !!s && ['race', 'timed', 'endurance'].includes(s.sessionType) && s.resultBy !== 'points' && !s.heatResults && !s.readOnly;
  const timeOf = x => (typeof x.total === 'number' ? x.total + (x.penalty || 0) + (x.adjMs || 0) : Infinity);
  // the standings after the changes: edits = { [index]: { ms, laps, dq } } (time added in ms, laps taken away, out); a new order, the old place kept as wasPos
  function correct(standings, edits = {}) {
    const rows = (Array.isArray(standings) ? standings : []).map((x, i) => {
      const e = edits[i] || {},
        ms = Math.round(Number(e.ms) || 0),
        lapsOff = Math.max(0, Math.floor(Number(e.laps) || 0)),
        y = { ...x };
      if (ms) y.adjMs = (x.adjMs || 0) + ms;
      if (lapsOff) {
        y.laps = Math.max(0, (Number(x.laps) || 0) - lapsOff);
        y.adjLaps = (x.adjLaps || 0) - lapsOff;
      }
      if (e.dq !== undefined) y.dq = !!e.dq;
      if (!y.dq) delete y.dq;
      y.wasPos = x.pos;
      y.wasIndex = i;
      return y;
    });
    const out = x => !!x.dq;
    const order = rows
      .map((x, i) => ({ x, i }))
      .sort((a, b) => {
        if (out(a.x) !== out(b.x)) return out(a.x) ? 1 : -1;
        if (!!a.x.retired !== !!b.x.retired && (Number(a.x.laps) || 0) === (Number(b.x.laps) || 0)) return a.x.retired ? 1 : -1;
        return (
          (Number(b.x.laps) || 0) - (Number(a.x.laps) || 0) || timeOf(a.x) - timeOf(b.x) || (Number(a.x.pos) || 0) - (Number(b.x.pos) || 0)
        );
      });
    return order.map(({ x }, n) => ({ ...x, pos: n + 1 }));
  }
  // what is saved: the new standings (without wasPos) and a line for the correction list of the session
  function correction(s, edits, reason, whenIso) {
    const next = correct(s.standings, edits);
    const changes = next
      .filter(x => x.pos !== x.wasPos || edits[x.wasIndex])
      .map(x => {
        const e = edits[x.wasIndex] || {};
        return {
          driverId: x.driverId || '',
          name: x.driverName || x.teamName || '',
          from: x.wasPos,
          to: x.pos,
          ...(Number(e.ms) ? { ms: Math.round(Number(e.ms)) } : {}),
          ...(Number(e.laps) ? { laps: -Math.floor(Number(e.laps)) } : {}),
          ...(e.dq ? { dq: true } : {})
        };
      });
    return {
      standings: next.map(x => {
        const y = { ...x };
        delete y.wasPos;
        delete y.wasIndex;
        return y;
      }),
      entry: {
        date: whenIso || new Date().toISOString(),
        reason: String(reason || '')
          .trim()
          .slice(0, 300),
        changes
      }
    };
  }
  const correctionText = s =>
    (Array.isArray(s && s.correction) ? s.correction : [])
      .map(
        c =>
          `Corrected on ${day(c.date)}${c.reason ? ': ' + c.reason : ''}${(c.changes || []).length ? ' (' + c.changes.map(x => `${x.name} ${x.from} → ${x.to}`).join(', ') + ')' : ''}.`
      )
      .join(' ');

  // ---- the list as a CSV file ----
  const cell = v => {
    const t = String(v ?? '');
    return /[",;\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
  };
  function csv(sessions) {
    const head = ['Date', 'Session', 'Kind', 'Track', 'Championship round', 'Winner', 'Second', 'Third', 'Best lap', 'Best lap by'];
    const lines = sessions.map(s => {
      const st = sorted(s.standings),
        fast = st.reduce((m, x) => (Number(x.best) > 0 && (!m || Number(x.best) < Number(m.best)) ? x : m), null),
        win = RACING.includes(s.sessionType);
      return [
        String(s.date || '')
          .slice(0, 16)
          .replace('T', ' '),
        s.setupName || '',
        KIND[s.sessionType] || s.sessionType || '',
        s.trackName || '',
        inChamp(s) && s.champ.round ? s.champ.round : '',
        win && st[0] ? st[0].driverName || st[0].teamName || '' : '',
        win && st[1] ? st[1].driverName || st[1].teamName || '' : '',
        win && st[2] ? st[2].driverName || st[2].teamName || '' : '',
        fast ? lap(fast.best) : '',
        fast ? fast.driverName || '' : ''
      ]
        .map(cell)
        .join(',');
    });
    return [head.join(','), ...lines].join('\r\n') + '\r\n';
  }
  function driverCsv(d, name) {
    const head = ['Date', 'Session', 'Kind', 'Track', 'Place', 'Laps', 'Best lap', 'Points'];
    return (
      [
        head.join(','),
        ...d.rows.map(({ s, x }) =>
          [
            String(s.date || '')
              .slice(0, 16)
              .replace('T', ' '),
            s.setupName || '',
            KIND[s.sessionType] || '',
            s.trackName || '',
            x.dq ? 'DQ' : x.pos,
            x.laps ?? '',
            lap(x.best),
            x.points ?? ''
          ]
            .map(cell)
            .join(',')
        )
      ].join('\r\n') + '\r\n'
    );
  }

  const api = {
    lap,
    day,
    daysBetween,
    KIND,
    PERIODS,
    KINDS,
    inChamp,
    history,
    recordCard,
    filter,
    kinds,
    months,
    rowHtml,
    driver,
    formLine,
    canCorrect,
    correct,
    correction,
    correctionText,
    csv,
    driverCsv
  };
  root.RecordBook = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
