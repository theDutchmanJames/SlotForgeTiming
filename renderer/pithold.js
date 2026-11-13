// Held pit stops use elapsed race time, so pauses keep the same countdown.
(function (root) {
  const clean = v => { const c = v || {}, n = Number(c.seconds); return { mode: ['auto', 'manual', 'driver'].includes(c.mode) ? c.mode : 'follow', seconds: Number.isFinite(n) && n > 0 ? Math.min(86400, Math.max(1, n)) : 30, work: ['add', 'overlap'].includes(c.work) ? c.work : 'systems' }; };
  const raceConfig = s => { const c = clean({ mode: ['manual', 'driver'].includes(s.pitHoldMode) ? s.pitHoldMode : 'auto', seconds: s.pitHoldSeconds, work: s.pitServiceWork }); return s.serviceStop !== 'on' || s.sessionType === 'tokens' ? {} : { pitControl: c }; };
  const begin = (start, covered) => ({ start, covered: typeof covered === 'boolean' ? covered : null, removed: covered === false, returned: false, departureAt: null, observedAt: start, extraMs: 0 });
  const due = (h, c) => h.start + c.seconds * 1000 + (h.extraMs || 0);
  // Actual job completion offsets, independent of the release timer. null means
  // unreachable (for example sequential work behind refuelling at a zero rate).
  function servicePlan(j) {
    const fuel = Math.max(0, j.fuel || 0), repair = (j.repairAdd ? fuel : 0) + Math.max(0, j.repair || 0), tyres = (j.tyreAdd ? Math.max(fuel, repair) : 0) + Math.max(0, j.tyres || 0);
    return Object.fromEntries(Object.entries({ fuel, repair, tyres }).map(([k, n]) => [k, Number.isFinite(n) ? n : null]));
  }
  function advance(h, c, at) {
    const end = c.mode === 'auto' ? due(h, c) : c.mode === 'driver' ? h.departureAt : null;
    return end != null && at >= end ? Math.max(end, h.releaseNotBefore || 0) : null;
  }
  function resetSensor(h, on = null) {
    h.covered = on; h.removed = on === false; h.returned = false; h.departureAt = null;
  }
  function observe(h, c, at, on) {
    if (at < h.observedAt) return;
    const previous = h.covered;
    h.observedAt = at; h.covered = on;
    if (on === false) {
      if (previous === true && h.returned) h.departureAt = at;
      h.removed = true;
    } else if (on === true && previous === false && h.removed) h.returned = true;
  }
  function view(h, c, at) {
    if (!h) return null;
    const remaining = Math.max(0, due(h, c) - at);
    const text = c.mode === 'driver' ? h.covered === null ? 'Waiting for sensor — director can release' : h.returned ? 'Drive off sensor to end pit stop' : h.removed ? 'Return car to sensor, then drive off' : 'Remove car, return it, then drive off'
      : c.mode === 'manual' ? 'Waiting for Race Director — release at any time'
      : remaining ? (at >= h.start + c.seconds * 1000 ? 'Serving penalty' : 'Timer ends pit stop') : 'Timer complete';
    return { remaining, ready: remaining === 0, canRelease: true, mode: c.mode, covered: h.covered, returned: h.returned, text };
  }
  const api = { clean, raceConfig, begin, due, advance, observe, resetSensor, view, servicePlan };
  root.PitHold = api; if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
