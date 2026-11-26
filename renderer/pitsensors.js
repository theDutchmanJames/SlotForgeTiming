// A second, presence-only subscription. Normal hardware hits and hardware monitors are unchanged.
(function (root) {
  function bind(o) {
    const offs = [],
      link = o.link;
    let lastEngine = null,
      lastStatus = '';
    const relevant = e =>
      !o.disabled &&
      (!['parallel', 'plugin'].includes(o.hardware) ||
        (link.config.pitMode === 'shared' ? e.kind === 'lap' : link.config.pitMode === 'separate' && e.kind === 'pit'));
    const observe = e => {
      const r = o.eng(),
        lane = o.hardware === 'trackmate' ? o.map()[e.lane] : e.lane;
      const i = r.cars.findIndex(c => c.lane === lane);
      if (i >= 0 && relevant(e)) r.pitSensor(i, e.on, Math.min(Number.isFinite(e.at) ? e.at : o.now(), o.now()));
    };
    const levels = () => {
      if (!link.connected || o.disabled) return o.eng().cars.map(c => ({ lane: c.lane, on: null, direct: true }));
      // (audit 2026-11) sensor n is the lane chosen for it in Lane Check (link.pitMap), the same lane the stop itself uses (arduinorace.js)
      if (o.hardware === 'arduino')
        return (link.pitCovered || []).map((on, pit) => ({
          lane: Number.isInteger((link.pitMap || [])[pit]) ? link.pitMap[pit] : pit,
          on
        }));
      return link.sensorLevels ? link.sensorLevels() : [];
    };
    const seed = () =>
      levels().forEach(e => {
        if (e.direct) {
          const r = o.eng(),
            i = r.cars.findIndex(c => c.lane === e.lane);
          r.pitSensor(i, null, o.now());
        } else observe(e);
      });
    if (o.hardware === 'arduino')
      offs.push(
        link.on(e => {
          if (e.type === 'pit') observe({ lane: Number.isInteger(e.lane) ? e.lane : e.pit, on: e.in, at: e.at });
        })
      );
    else if (link.onSensor) offs.push(link.onSensor(observe));
    if (link.onStatus) offs.push(link.onStatus(seed));
    return {
      sync() {
        const r = o.eng();
        if (r !== lastEngine || (r.status !== lastStatus && lastStatus !== 'running' && lastStatus !== 'paused')) seed();
        lastEngine = r;
        lastStatus = r.status;
      },
      off() {
        offs.forEach(f => f());
      }
    };
  }
  const api = { bind };
  root.PitSensors = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
