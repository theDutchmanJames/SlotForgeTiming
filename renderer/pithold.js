// Held pit stops use elapsed race time, so pauses and restored races keep the same countdown.
(function (root) {
  const clean = v => { const c = v || {}, n = Number(c.seconds); return { mode: ['auto', 'manual'].includes(c.mode) ? c.mode : 'follow', seconds: Number.isFinite(n) && n > 0 ? Math.min(86400, Math.max(1, n)) : 30, waitReturn: c.waitReturn !== false && c.waitReturn !== 'no', work: ['add', 'overlap'].includes(c.work) ? c.work : 'systems' }; };
  const raceConfig = s => { const c = clean({ mode: s.pitHoldMode === 'manual' ? 'manual' : 'auto', seconds: s.pitHoldSeconds, waitReturn: s.pitHoldReturn, work: s.pitServiceWork }); return s.serviceStop !== 'on' || s.sessionType === 'tokens' ? {} : { pitControl: c }; };
  const begin = (start, covered) => ({ start, covered: typeof covered === 'boolean' ? covered : null, clearAt: null, returned: false, observedAt: start, extraMs: 0 });
  const due = (h, c) => h.start + c.seconds * 1000 + (h.extraMs || 0);
  // Preserve the sequence/overlap chosen in the systems, then fit the service schedule into one fixed window.
  function servicePlan(j, duration) {
    const fuel = Math.max(0, j.fuel || 0), repair = (j.repairAdd ? fuel : 0) + Math.max(0, j.repair || 0), tyres = (j.tyreAdd ? Math.max(fuel, repair) : 0) + Math.max(0, j.tyres || 0);
    const total = Math.max(fuel, repair, tyres), scale = total > 0 ? duration / total : 0;
    const fit = n => n === total && total > 0 ? duration : Math.min(duration, n * scale);
    return { fuel: fit(fuel), repair: fit(repair), tyres: fit(tyres) };
  }
  function advance(h, c, at) {
    const end = due(h, c);
    if (at < end) return null;
    if (h.covered === true) h.returned = true;
    if (c.mode !== 'auto' || h.covered !== false || (c.waitReturn && !h.returned)) return null;
    return Math.max(end, h.clearAt === null ? at : h.clearAt);
  }
  function observe(h, c, at, on) {
    if (at < h.observedAt) return;
    advance(h, c, at);
    h.observedAt = at; h.covered = on;
    if (!on) { h.clearAt = at; if (at < due(h, c)) h.returned = false; }
    else if (at >= due(h, c)) h.returned = true;
  }
  function view(h, c, at) {
    if (!h) return null;
    const remaining = Math.max(0, due(h, c) - at);
    return { remaining, ready: remaining === 0, mode: c.mode, covered: h.covered,
      text: remaining ? (at >= h.start + c.seconds * 1000 ? 'Serving penalty' : 'Service in progress') : c.mode === 'manual' ? 'Ready to release' : h.covered === null ? 'Waiting for sensor' : c.waitReturn && !h.returned && !h.covered ? 'Return car to sensor' : h.covered ? 'Ready — drive off sensor' : 'Ready to release' };
  }
  const api = { clean, raceConfig, begin, due, advance, observe, view, servicePlan };
  root.PitHold = api; if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
