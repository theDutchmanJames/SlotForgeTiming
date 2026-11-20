// (2.4.0 review) The main process stamps the parallel port's and the timing plugin's inputs with its own clock (its performance.timeOrigin plus
// performance.now()). This window has a clock of its own, started at another moment: each timeOrigin is a reading of the wall clock when its process
// started, so a clock correction by Windows in between (soon after a start-up) put the crossings and pit times off by that correction.
// sync() measures the difference once, by asking the main process for its clock a few times and keeping the quickest round trip; toLocal() turns
// a main-process time into this window's performance.now() time. Before a sync (or without the main process, as in a browser) it does what it did
// before: subtract this window's timeOrigin.
(function (root) {
  const perf = () => root.performance || (typeof performance !== 'undefined' ? performance : null);
  let offset = null,
    pending = null;
  async function measure(api, tries) {
    const p = perf();
    let best = null;
    for (let i = 0; i < tries; i++) {
      const t0 = p.now(),
        m = Number(await api.mainClock()),
        t1 = p.now();
      if (!Number.isFinite(m)) return null;
      if (!best || t1 - t0 < best.rtt) best = { rtt: t1 - t0, off: m - (t0 + t1) / 2 };
    }
    return best;
  }
  // -> the offset (main clock minus this window's performance.now()), or null when it can not be measured
  function sync(api, tries = 5) {
    if (!api || typeof api.mainClock !== 'function' || !perf()) return Promise.resolve(offset);
    if (!pending)
      pending = measure(api, tries)
        .then(best => {
          if (best) offset = best.off;
          return offset;
        })
        .catch(() => offset)
        .finally(() => {
          pending = null;
        });
    return pending;
  }
  const toLocal = at => at - (offset !== null ? offset : perf().timeOrigin);
  const api = { sync, toLocal, offset: () => offset, reset: () => (offset = null) };
  root.MainClock = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
