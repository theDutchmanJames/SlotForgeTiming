// Slotcar statistics (1.30.0): the numbers in the Statistics folder of a slotcar in the Database.
//  - Service Interval: the number of laps after which the car needs servicing (a setting of the car; empty = no interval).
//  - Laps Driven: every lap saved with the car (counted by the database, as before).
//  - Laps Since Last Interval: the laps saved since the car was last serviced (also counted by the database; Reset in the form starts again at 0 and notes the date).
//  - Mileage: the distance the car has driven, worked out as the Car Mileage card of Home does (the laps that count, times the length of the lane of every lap).
// 1.33.0: Services Done (kept: a count of the Resets), and worked out from the laps, the sessions and the tracks each time (not kept, so they always match your races): Mileage Since Last Service, Last Driven,
// Sessions Driven, Wins, Deslots, Fastest Lap Ever and the laps, best lap and average lap per track (see details()).
// Pure: it only works out numbers and text, so it can be tested without a screen. The database (db.js) and the form (database.js) both use it.
(function (root) {
  const whole = v => { const n = Math.floor(Number(v)); return v === '' || v === null || v === undefined || !Number.isFinite(n) ? null : n; };
  const lapsDriven = car => Math.max(0, whole(car && car.lapsDriven) || 0);
  // the laps since the last service; a car that was never counted that way (from before 1.30.0) has had no service yet, so that is every lap it has driven
  const sinceOf = car => { const n = whole(car && car.lapsSinceService); return n === null ? lapsDriven(car) : Math.max(0, n); };
  // the service interval in laps, 0 for none (empty, zero, negative or not a number)
  const intervalOf = car => { const n = whole(car && car.serviceInterval); return n !== null && n > 0 ? n : 0; };
  // { interval, since, left (laps to go, a negative number when it is overdue; null without an interval), due }
  const status = (car, sinceOverride) => {
    const interval = intervalOf(car), since = sinceOverride === undefined ? sinceOf(car) : Math.max(0, whole(sinceOverride) || 0);
    return { interval, since, left: interval ? interval - since : null, due: interval > 0 && since >= interval };
  };
  const plural = (n, one, many) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
  // what the form says about it, in words
  const note = st => !st.interval ? 'No service interval is set.'
    : st.due ? `Service due: ${plural(st.since, 'lap', 'laps')} since the last service, the interval is ${plural(st.interval, 'lap', 'laps')}${st.left < 0 ? ` (${plural(-st.left, 'lap', 'laps')} over)` : ''}.`
    : `${plural(st.left, 'lap', 'laps')} to go until the next service (the interval is ${plural(st.interval, 'lap', 'laps')}).`;
  // Does a lap count for the laps since the last service? A lap of a session that was saved after the car was serviced does (a car that was never serviced counts every lap).
  // A lap without a date counts too: it is not known to be older.
  const afterService = (car, lap, fallbackDate) => {
    const at = Date.parse(car && car.serviceDate); if (!Number.isFinite(at)) return true;
    return !(Date.parse((lap && lap.date) || fallbackDate) <= at);
  };
  const libs = () => (typeof module !== 'undefined' ? { S: require('./stats.js'), H: require('./homestats.js') } : { S: root.Stats, H: root.HomeStats });
  // how many times the car was serviced: the count that is kept (Services Done), and for a car that was serviced before the count existed, the one service its date tells of
  const servicesOf = car => { const n = whole(car && car.servicesDone); return n !== null ? Math.max(0, n) : Number.isFinite(Date.parse(car && car.serviceDate)) ? 1 : 0; };
  // { laps, distance (metres, or null when no track of a lap has a length) } of a list of laps of one car (the laps that count, as the Car Mileage card of Home does)
  const mileageOf = (list, tracks) => {
    const m = list.length ? libs().H.mileage({ laps: list, tracks: tracks || [], carName: () => 'car' }) : [];
    return m.length ? { laps: m[0].laps, distance: m[0].distance } : { laps: 0, distance: 0 };
  };
  const mileage = (laps, tracks, carId) => mileageOf(carId ? (laps || []).filter(l => l && l.carId === carId) : [], tracks);
  // Everything the Statistics folder works out from the database for one car (1.33.0). laps, sessions and tracks are the lists of the database.
  // A Time Token Session is a pool of its own (laps with a token flag; its session is no race, so it has no winner) and never counts, as on the Home cards.
  // -> { mileage: { laps, distance }, mileageSince (the same since the last service; all of it for a car that was never serviced), lastDriven (an ISO date, or ''), sessions, wins, deslots,
  //      fastest: { time, trackId, trackName } or null, tracks: [{ trackId, name, laps, best, avg }] (the tracks with a valid lap, the most laps first) }
  // A valid lap is one that counts for records and averages: not invalid, not too slow, not late, no pit stop. A deslot is a lap (without a pit stop) slower than the deslot time of its track (Tracks, Lap time limits).
  function details(car, laps, sessions, tracks) {
    const { S } = libs(), id = car && car.id, sess = new Map((sessions || []).filter(Boolean).map(x => [x.id, x]));
    const mine = id ? (laps || []).filter(l => l && l.carId === id && !l.token) : [], trackOf = tid => (tracks || []).find(t => t.id === tid) || {};
    const dateOf = l => (l.date) || (sess.get(l.sessionId) || {}).date;
    const after = mine.filter(l => afterService(car, l, (sess.get(l.sessionId) || {}).date));
    let last = NaN; mine.forEach(l => { const t = Date.parse(dateOf(l)); if (Number.isFinite(t) && (!Number.isFinite(last) || t > last)) last = t; });
    const timed = mine.filter(l => Number(l.time) > 0), valid = timed.filter(l => !(l.invalid || l.tooSlow || l.late) && !l.pit);
    const byTrack = new Map(); valid.forEach(l => { if (!byTrack.has(l.trackId)) byTrack.set(l.trackId, []); byTrack.get(l.trackId).push(l); });
    const rows = [...byTrack].map(([trackId, list]) => ({ trackId, name: trackOf(trackId).name || '', laps: list.length, best: Math.min(...list.map(l => Number(l.time))), avg: S.figures(list, trackOf(trackId), '').avg }))
      .sort((a, b) => b.laps - a.laps || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    const fast = rows.length ? rows.reduce((a, b) => (b.best < a.best ? b : a)) : null;
    return {
      mileage: mileageOf(mine, tracks), mileageSince: mileageOf(after, tracks),
      lastDriven: Number.isFinite(last) ? new Date(last).toISOString() : '',
      sessions: new Set(mine.map(l => l.sessionId).filter(Boolean)).size,
      wins: id ? (sessions || []).filter(x => x && (x.standings || []).some(r => r && r.carId === id && S.isWinner(x, r))).length : 0,
      deslots: timed.filter(l => { const d = Number(trackOf(l.trackId).deslotTime); return !l.pit && d > 0 && Number(l.time) > d * 1000; }).length,
      fastest: fast ? { time: fast.best, trackId: fast.trackId, trackName: fast.name } : null,
      tracks: rows
    };
  }
  const api = { lapsDriven, sinceOf, intervalOf, status, note, afterService, servicesOf, mileage, details };
  if (typeof module !== 'undefined') module.exports = api; else root.CarStats = api;
})(typeof window !== 'undefined' ? window : globalThis);
