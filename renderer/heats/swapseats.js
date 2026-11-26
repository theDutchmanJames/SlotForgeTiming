// Swap Seats (2.5.0): a heat race where every lane has its own car, and the drivers move from lane to lane, so they drive every car. The car is no excuse.
// The race setup says so (heatCars: 'lanes', Race Setup > Heats > The cars); Home asks for the car of every lane (the setting laneCars, by race setup) and no
// car for the drivers; the race gives the driver of a heat the car of the lane (race.js, seated); every heat result row keeps the lane and its car
// (engine/heats.js), and the saved race the cars of the lanes (session.laneCars). Pure: no page, no settings store.
(function (root) {
  // (audit 2026-11) a heat race of its own kind only: an Endurance Race of heats keeps a hidden 'lanes' left from when it was heats (its effective setup
  // says heats too, with ofType 'endurance'), and teams there bring their own car
  const on = setup => !!setup && setup.sessionType === 'heats' && !setup.ofType && setup.heatCars === 'lanes';

  // the car of every lane, as saved for a race setup: one id for each lane ('' = none chosen), cleaned of cars that are gone (known: id => whether the car is still there)
  const laneIds = (list, lanes, known) =>
    Array.from({ length: Math.max(0, Math.floor(Number(lanes)) || 0) }, (_, l) => {
      const id = Array.isArray(list) && typeof list[l] === 'string' ? list[l] : '';
      return id && (!known || known(id)) ? id : '';
    });

  // what stops a race from starting: a lane without a car, a car on two lanes
  // (audit 2026-11) used: the lanes the heat plan races on (a Set), when known: a lane no heat uses needs no car
  const problems = (ids, used) => {
    const out = [];
    const empty = ids.map((id, l) => (id || (used && !used.has(l)) ? -1 : l)).filter(l => l >= 0);
    if (empty.length)
      out.push(
        `${empty.length === 1 ? 'Lane' : 'Lanes'} ${empty.map(l => l + 1).join(', ')} ${empty.length === 1 ? 'needs a car' : 'need a car'} (Swap Seats).`
      );
    const picked = ids.filter(Boolean);
    if (picked.length !== new Set(picked).size) out.push('A car is on two lanes. Every lane needs its own car.');
    return out;
  };

  // the cars of the lanes as the saved race keeps them
  const keep = laneCars => (laneCars || []).map((c, lane) => ({ lane, carId: (c && c.carId) || '', carName: (c && c.carName) || '' }));

  // the time every lane car raced over all heats, with penalties (for Paddock's car journal): carId => ms
  function carTimes(results) {
    const by = new Map();
    for (const hr of results || [])
      for (const r of hr.rows || []) {
        if (!r.carId) continue;
        const ms = Number.isFinite(r.spentPen) ? r.spentPen : r.total;
        if (Number.isFinite(ms)) by.set(r.carId, (by.get(r.carId) || 0) + ms);
      }
    return by;
  }

  // how every lane car did in a saved race: its laps over all heats, its best lap and who drove it. [{ lane, carId, carName, laps, best, by, drivers }]
  function cars(session) {
    if (!session || !Array.isArray(session.laneCars) || !session.laneCars.length) return [];
    const out = session.laneCars.map(c => ({ lane: c.lane, carId: c.carId, carName: c.carName, laps: 0, best: null, by: '', drivers: 0 })),
      seen = out.map(() => new Set());
    for (const hr of session.heatResults || [])
      for (const r of hr.rows || []) {
        const i = out.findIndex(c => c.lane === r.lane);
        if (i < 0) continue;
        const c = out[i];
        c.laps += Number(r.laps) || 0;
        seen[i].add(r.participant);
        if (Number.isFinite(r.best) && r.best > 0 && (c.best === null || r.best < c.best)) {
          c.best = r.best;
          c.by = r.driverName || '';
        }
      }
    out.forEach((c, i) => (c.drivers = seen[i].size));
    return out;
  }

  // the lanes (so the cars) every participant drove: participant => [lanes], in lane order
  function driven(session) {
    const by = new Map();
    for (const hr of (session && session.heatResults) || [])
      for (const r of hr.rows || []) {
        if (!Number.isInteger(r.lane)) continue;
        const s = by.get(r.participant) || new Set();
        s.add(r.lane);
        by.set(r.participant, s);
      }
    return new Map([...by].map(([p, s]) => [p, [...s].sort((a, b) => a - b)]));
  }

  // the cars a participant drove, in words, for the Car column of a saved race: "All 4 cars", "3 of 4 cars (lanes 1, 2, 4)"; '' when the race is no Swap Seats race
  function drivenText(session, participant) {
    if (!session || !Array.isArray(session.laneCars) || !session.laneCars.length || !Number.isInteger(participant)) return '';
    const mine = driven(session).get(participant) || [],
      n = session.laneCars.length;
    if (!mine.length) return '';
    return mine.length === n
      ? `All ${n} cars`
      : `${mine.length} of ${n} ${n === 1 ? 'car' : 'cars'} (${mine.length === 1 ? 'lane' : 'lanes'} ${mine.map(l => l + 1).join(', ')})`;
  }

  // the lane cars of a saved race as a table (esc: makes text safe; time: a lap time as text). '' when the race is no Swap Seats race
  function carsTable(session, esc, time) {
    const list = cars(session);
    if (!list.length) return '';
    return (
      '<table class="ss-cars"><thead><tr><th>Lane</th><th>Car</th><th>Laps</th><th>Best lap</th><th>Drivers</th></tr></thead><tbody>' +
      list
        .map(
          c =>
            `<tr><td>${c.lane + 1}</td><td>${esc(c.carName || '(no car)')}</td><td>${c.laps}</td><td>${c.best ? esc(time(c.best)) + (c.by ? ' (' + esc(c.by) + ')' : '') : '–'}</td><td>${c.drivers}</td></tr>`
        )
        .join('') +
      '</tbody></table>'
    );
  }

  const api = { on, laneIds, problems, keep, carTimes, cars, driven, drivenText, carsTable };
  root.SwapSeats = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
