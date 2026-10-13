// Turns the byte stream of the Trackmate into race events. Pure (no screen, no port), so it can be tested.
// Messages from the device: "digits LF CR" = milliseconds since the previous message (the device's own clock, sent every 200 ms and also
// just before a sensor letter), A..H = the sensor of lane 1..8 sees a car (repeated while it is there), W = the Trackcall button.
// A lap crossing is the FIRST letter of a lane after it has been quiet for 500 ms; its time is the device's clock, so it does not depend on USB delays.
(function (root) {
  const H = typeof module !== 'undefined' ? require('./hardware.js') : root.Hardware;
  const QUIET = 500; // ms without a letter before the sensor counts as free again

  function createLink(o = {}) {
    const clock = o.now || (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
    const L = { connected: false, power: null, ticks: 0, lastTick: 0, hits: 0 }, subs = new Set(), statusSubs = new Set();
    let parser = H.trackmateParser(), hwMs = 0, recent = [], offset = null; const active = Array(8).fill(false), lastHit = Array(8).fill(0);
    const emit = e => subs.forEach(f => { try { f(e); } catch (x) { /* a listener problem never stops the stream */ } });
    // the device clock in the PC's clock: the smallest (arrival - device clock) of the last 25 messages is the one with the least USB delay
    const toPc = h => (offset === null ? clock() : h + offset);
    L.on = f => { subs.add(f); return () => subs.delete(f); };
    L.emit = emit; // lets other code hand in an event as if the device had sent it (the tests do)
    L.onStatus = f => { statusSubs.add(f); return () => statusSubs.delete(f); };
    L.setConnected = on => { on = !!on; if (on === L.connected) return; L.connected = on; if (!on) L.reset(); statusSubs.forEach(f => f(on)); };
    L.setPower = on => { L.power = on; statusSubs.forEach(f => f(L.connected)); }; // the track power as last switched (unknown = null)
    L.reset = () => { L.power = null; parser = H.trackmateParser(); hwMs = 0; recent = []; offset = null; active.fill(false); lastHit.fill(0); L.ticks = 0; L.lastTick = 0; };
    // bytes from the port; returns the whole messages (for the monitor screen)
    L.feed = bytes => {
      const arrival = clock(), msgs = parser.feed(bytes);
      msgs.forEach(m => {
        if (m.type === 'tick') {
          hwMs += m.ms; L.ticks++; L.lastTick = m.ms;
          recent.push(arrival - hwMs); if (recent.length > 25) recent.shift(); offset = Math.min(...recent);
          for (let i = 0; i < 8; i++) if (active[i] && hwMs - lastHit[i] > QUIET) active[i] = false;
        } else if (m.type === 'lane') {
          const i = m.lane - 1;
          if (!active[i]) { active[i] = true; L.hits++; emit({ type: 'hit', lane: i, at: toPc(hwMs) }); }
          lastHit[i] = hwMs;
        } else if (m.type === 'call') emit({ type: 'call', at: toPc(hwMs) });
      });
      return msgs;
    };
    return L;
  }
  // Which lane each sensor (A, B...) counts for: a list where item n is the lane (0-based) of sensor n. Anything missing or wrong falls back to "sensor n = lane n".
  function laneMap(saved, count = 8) {
    const out = Array.from({ length: count }, (_, i) => i), seen = new Set();
    if (Array.isArray(saved) && saved.length) {
      const ok = saved.slice(0, count).every(v => Number.isInteger(v) && v >= 0 && v < count) && new Set(saved.slice(0, count)).size === Math.min(saved.length, count);
      if (ok) saved.slice(0, count).forEach((v, i) => { out[i] = v; });
    }
    out.forEach(v => seen.add(v)); if (seen.size !== count) return Array.from({ length: count }, (_, i) => i);
    return out;
  }
  // give sensor `sensor` the lane `lane`; the sensor that had that lane gets the lane this one had (so no lane is ever used twice)
  function swapLane(map, sensor, lane) {
    const m = map.slice(), other = m.indexOf(lane); if (other >= 0 && other !== sensor) m[other] = m[sensor]; m[sensor] = lane; return m;
  }
  // The check lights beside the sensors: litAt[i] is when sensor i last sent a letter (a time in ms, or null/undefined for never). A light is on while that was
  // less than `hold` ms ago (a car over a sensor sends letters all the time, so the light stays on while it is there and a little after).
  const ledsOn = (litAt, now, hold = 1000, count = 8) => Array.from({ length: count }, (_, i) => { const t = litAt && litAt[i]; return typeof t === 'number' && Number.isFinite(t) && now - t >= 0 && now - t < hold; });
  const api = { laneMap, swapLane, ledsOn, createLink, link: createLink() };
  root.Trackmate = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
