'use strict';
// Driver progress (2.3.0): how a driver gets faster and steadier over time, per track and per month, from the laps of the races driven on this computer.
// Pure: it is given the laps of one driver (JSON storage reads them from its list, SQLite from its lap index) and works out the figures.
//   best: the fastest clean lap of the month; average and median: of the clean laps that are no slower than 130% of that best (a crash or a deslot
//   is not "pace"); consistency: 100% minus the spread of those laps (their standard deviation as a share of the average), so steadier = higher.
// A clean lap: a real time, not invalid, not too slow, not after the paid time (tokens), not with a pit stop, not a Time Token lap.
const PACE = 1.3;
const monthOf = iso => {
  const t = Date.parse(iso || '');
  if (!Number.isFinite(t)) return '';
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
function figures(times) {
  const best = Math.min(...times),
    pace = times.filter(t => t <= best * PACE).sort((a, b) => a - b),
    n = pace.length,
    avg = pace.reduce((s, t) => s + t, 0) / n,
    median = n % 2 ? pace[n >> 1] : (pace[n / 2 - 1] + pace[n / 2]) / 2,
    sd = n > 1 ? Math.sqrt(pace.reduce((s, t) => s + (t - avg) ** 2, 0) / (n - 1)) : 0;
  return {
    laps: times.length,
    best,
    avg: Math.round(avg),
    median: Math.round(median),
    consistency: n > 2 ? Math.max(0, Math.round(1000 - (sd / avg) * 1000) / 10) : null // (a percentage, one decimal; too few laps: none)
  };
}
// laps: [{ trackId, time, date?, sessionId, invalid, tooSlow, late, pit, token }]; o: { dateOf(sessionId) -> iso, trackName(trackId) -> name }
function progress(laps, o = {}) {
  const tracks = new Map(),
    sessions = new Set();
  let first = '',
    last = '';
  for (const l of laps || []) {
    if (!l || l.token || l.invalid || l.tooSlow || l.late || l.pit) continue;
    const time = Number(l.time);
    if (!Number.isFinite(time) || time <= 0) continue;
    const date = l.date || (o.dateOf ? o.dateOf(l.sessionId) : '') || '',
      month = monthOf(date);
    if (!month) continue;
    if (l.sessionId) sessions.add(l.sessionId);
    if (!first || date < first) first = date;
    if (!last || date > last) last = date;
    const key = l.trackId || '';
    if (!tracks.has(key)) tracks.set(key, new Map());
    const months = tracks.get(key);
    if (!months.has(month)) months.set(month, []);
    months.get(month).push(time);
  }
  const out = [...tracks.entries()].map(([trackId, months]) => {
    const rows = [...months.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([month, times]) => ({ month, ...figures(times) }));
    const all = [].concat(...months.values());
    const a = rows[0],
      z = rows[rows.length - 1];
    return {
      trackId,
      name: (o.trackName && o.trackName(trackId)) || '',
      laps: all.length,
      best: Math.min(...all),
      months: rows,
      // from the first month to the last: how much faster the best and the average lap got (positive = faster), and the steadiness
      change:
        rows.length > 1
          ? {
              best: a.best - z.best,
              avg: a.avg - z.avg,
              consistency: a.consistency !== null && z.consistency !== null ? Math.round((z.consistency - a.consistency) * 10) / 10 : null
            }
          : null
    };
  });
  out.sort((x, y) => y.laps - x.laps || String(x.name).localeCompare(String(y.name)));
  return { laps: out.reduce((s, t) => s + t.laps, 0), sessions: sessions.size, first, last, tracks: out };
}
// ---- the readers of the two storages ----
function jsonDriver(db, id) {
  if (!db.data.drivers.some(d => d.id === id)) return null;
  const dates = new Map(db.data.sessions.map(s => [s.id, s.date])),
    names = new Map(db.data.tracks.map(t => [t.id, t.name]));
  return progress(
    db.data.laps.filter(l => l && l.driverId === id),
    { dateOf: sid => dates.get(sid), trackName: tid => names.get(tid) }
  );
}
// s: the SQLite working session (sqlite-working.js); the lap index history_laps has the driver of every lap, the fields table the lap itself
function sqliteDriver(s, id) {
  return s.transaction(() => {
    if (typeof id !== 'string' || !s.statement("SELECT 1 FROM records WHERE entity='drivers' AND id=?").get(id)) return null;
    const laps = s
      .statement(
        "SELECT f.json FROM history_laps h JOIN fields f ON f.entity='laps' AND f.id=h.id AND f.path='[]' WHERE h.driverId=? AND h.token=0"
      )
      .all(id)
      .map(r => JSON.parse(r.json));
    const H = require('./sqlite-history'),
      dates = new Map(),
      names = new Map();
    const dateOf = sid => {
      if (!dates.has(sid)) dates.set(sid, (sid && H.selected(s, 'sessions', sid, ['date'])?.date) || '');
      return dates.get(sid);
    };
    const trackName = tid => {
      if (!names.has(tid)) names.set(tid, (tid && H.selected(s, 'tracks', tid, ['name'])?.name) || '');
      return names.get(tid);
    };
    return progress(laps, { dateOf, trackName });
  });
}
module.exports = { progress, figures, monthOf, jsonDriver, sqliteDriver, PACE };
