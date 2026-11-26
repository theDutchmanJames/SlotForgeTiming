// Solo (2.5.2): you alone on the track, one driver and one car, on any lane you like. The race setup is of the kind Solo (sessionType 'solo', with
// soloSwitch: 'button' or 'auto'); the race runs and is saved as a Free practice with solo: true, so results, records and statistics treat it as practice.
// Every lane gets an entry with the same driver and car, so each lane keeps its own laps and best lap; the race follows one lane (the lane the car is on),
// and widgets marked follow (Layout Editor: lane "Followed") show that lane. A lap never runs across a switch: the first crossing on another lane starts a lap.
// Pure: no page, no settings store.
(function (root) {
  const on = setup => !!setup && (setup.sessionType === 'solo' || setup.solo === true);
  // the setup as the race runs it: a Free practice that knows it is a solo session
  // (audit 2026-11) no race systems: a Solo setup does not ask for them, and a value left from when it was another kind is not used (one physical car on
  // two lane entries would otherwise get a full tank and fresh tyres at every lane switch)
  const NO_SYSTEMS = {
    fuelRules: '',
    penaltySystem: '',
    damageSystem: '',
    safetyCar: '',
    tyreWear: '',
    weather: '',
    pushSave: '',
    resourceSystem: '',
    multiClass: '',
    bop: '',
    bopSystem: '',
    rotation: ''
  };
  const effective = setup =>
    setup && setup.sessionType === 'solo' ? { ...setup, ...NO_SYSTEMS, sessionType: 'practice', solo: true } : setup;
  const auto = setup => !!setup && setup.soloSwitch === 'auto';
  // the rows of the race: the one row of Home on every lane
  const rows = (row, lanes) => Array.from({ length: Math.max(1, Math.floor(Number(lanes)) || 1) }, () => ({ ...row }));
  const laneOf = (v, lanes) => {
    const n = Math.floor(Number(v));
    return Number.isInteger(n) && n >= 0 && n < lanes ? n : 0;
  };
  const next = (lane, lanes) => (lanes > 0 ? (lane + 1) % lanes : 0);
  // a layout with its followed widgets on the followed lane (a widget keeps its own lane for every other race)
  const layout = (lay, lane) =>
    !lay || !Array.isArray(lay.widgets) || !lay.widgets.some(w => w && w.follow)
      ? lay
      : { ...lay, widgets: lay.widgets.map(w => (w && w.follow ? { ...w, lane } : w)) };

  // how the session went, by lane (and car), from the cars of the race as it ends: { rows: [{ lane (1, 2 ...), carId, carName, laps, best, avg }], all }.
  // A lap that was taken out, is invalid, too slow or a pit lap does not count for the best and the average (as everywhere else); it is a lap driven.
  function table(cars) {
    const sum = a => a.reduce((x, y) => x + y, 0),
      allTimes = [];
    let allLaps = 0;
    const rowsOut = (cars || [])
      .map(c => {
        const gone = new Set(c.removed || []),
          bad = new Set([...(c.invalid || []), ...(c.pitLaps || [])]);
        const kept = (c.laps || []).map((t, n) => ({ t, n })).filter(x => !gone.has(x.n));
        const good = kept.filter(x => !(c.bad || [])[x.n] && !bad.has(x.n) && Number.isFinite(x.t) && x.t > 0).map(x => x.t);
        allLaps += kept.length;
        allTimes.push(...good);
        return {
          lane: (Number(c.lane) || 0) + 1,
          carId: c.carId || '',
          carName: c.carName || '',
          laps: kept.length,
          best: good.length ? Math.min(...good) : null,
          avg: good.length ? Math.round(sum(good) / good.length) : null
        };
      })
      .filter(r => r.laps > 0)
      .sort((x, y) => x.lane - y.lane);
    return {
      rows: rowsOut,
      all: {
        laps: allLaps,
        best: allTimes.length ? Math.min(...allTimes) : null,
        avg: allTimes.length ? Math.round(sum(allTimes) / allTimes.length) : null
      }
    };
  }
  // the same as a table for the results (esc: makes text safe; time: a lap time as text; who: the driver's name for the last row)
  function tableHtml(t, esc, time, who) {
    if (!t || !t.rows.length) return '';
    const tm = v => (Number.isFinite(v) ? esc(time(v)) : '–');
    return (
      '<table class="fields solo-cars"><thead><tr><th>Car</th><th>Lane</th><th>Laps</th><th>Best</th><th>Average</th></tr></thead><tbody>' +
      t.rows
        .map(
          r =>
            `<tr><td>${esc(r.carName || '(no car)')}</td><td>${esc(r.lane)}</td><td>${r.laps}</td><td>${tm(r.best)}</td><td>${tm(r.avg)}</td></tr>`
        )
        .join('') +
      `<tr class="solo-all"><td><b>${esc(who || 'All laps')}</b></td><td></td><td><b>${t.all.laps}</b></td><td><b>${tm(t.all.best)}</b></td><td><b>${tm(t.all.avg)}</b></td></tr></tbody></table>`
    );
  }

  const withoutSystems = setup => (setup ? { ...setup, ...NO_SYSTEMS } : setup); // (audit 2026-11: a Time Token Session asks for no race systems either)
  const api = { on, effective, withoutSystems, auto, rows, laneOf, next, layout, table, tableHtml };
  root.Solo = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
