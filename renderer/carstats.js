// Slotcar statistics (1.30.0): the numbers in the Statistics folder of a slotcar in the Database.
//  - Service Interval: the number of laps after which the car needs servicing (a setting of the car; empty = no interval).
//  - Laps Driven: every lap saved with the car (counted by the database, as before).
//  - Laps Since Last Interval: the laps saved since the car was last serviced (also counted by the database; Reset in the form starts again at 0 and notes the date).
//  - Mileage: the distance the car has driven, worked out as the Car Mileage card of Home does (the laps that count, times the length of the lane of every lap).
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
  // { laps, distance (metres, or null when no track of a lap has a length) } of one car, from the laps and the tracks of the database
  const mileage = (laps, tracks, carId) => {
    const H = typeof module !== 'undefined' ? require('./homestats.js') : root.HomeStats;
    const m = carId ? H.mileage({ laps: (laps || []).filter(l => l && l.carId === carId), tracks: tracks || [], carName: () => 'car' }) : [];
    return m.length ? { laps: m[0].laps, distance: m[0].distance } : { laps: 0, distance: 0 };
  };
  const api = { lapsDriven, sinceOf, intervalOf, status, note, afterService, mileage };
  if (typeof module !== 'undefined') module.exports = api; else root.CarStats = api;
})(typeof window !== 'undefined' ? window : globalThis);
