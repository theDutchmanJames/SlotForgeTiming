// Turns the byte stream of the Trackmate into race events. Pure (no screen, no port), so it can be tested.
// Messages from the device: "digits LF CR" = milliseconds since the previous message (the device's own clock, sent every 200 ms and also
// just before a sensor letter), A..H = the sensor of lane 1..8 sees a car (repeated while it is there), W = the Trackcall button.
// A lap crossing is the FIRST letter of a lane after it has been quiet for 500 ms; its time is the device's clock, so it does not depend on USB delays.
// 1.51.1: a sensor that stays covered is a car that stands on it: once the letters have kept coming for the pit hold time (the race setup says how long: "Pit stop: the sensor must be
// blocked this long"), the link says { type: 'block', lane, at } (at = the first letter, when the car arrived), and when the letters stop { type: 'free', lane, at } (the car has left).
(function (root) {
  const H = typeof module !== 'undefined' ? require('./hardware.js') : root.Hardware;
  const QUIET = 500; // ms without a letter before the sensor counts as free again
  const LEAVE = 128; // a held sensor sends a letter about every 256 ms: the car left somewhere between its last letter and the one that did not come, so halfway
  const MIN_HOLD = 500; // a pass of a car over the sensor can send letters for about half a second: a hold shorter than this is never a stop

  function createLink(o = {}) {
    const clock = o.now || (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
    const L = { connected: false, power: null, ticks: 0, lastTick: 0, hits: 0, holdMs: 2000 }, subs = new Set(), statusSubs = new Set();
    let parser = H.trackmateParser(), hwMs = 0, recent = [], offset = null; const active = Array(8).fill(false), lastHit = Array(8).fill(0), firstHit = Array(8).fill(0), firstAt = Array(8).fill(0), held = Array(8).fill(false);
    const emit = e => subs.forEach(f => { try { f(e); } catch (x) { /* a listener problem never stops the stream */ } });
    // the device clock in the PC's clock: the smallest (arrival - device clock) of the last 25 messages is the one with the least USB delay
    const toPc = h => (offset === null ? clock() : h + offset);
    L.on = f => { subs.add(f); return () => subs.delete(f); };
    const sensors = new Set(), sensor = (lane, on, at) => sensors.forEach(f => { try { f({ lane, on, at }); } catch (_) {} });
    L.onSensor = f => { sensors.add(f); return () => sensors.delete(f); };
    L.sensorLevels = () => active.map((on, lane) => ({ lane, on }));
    L.emit = emit; // lets other code hand in an event as if the device had sent it (the tests do)
    L.onStatus = f => { statusSubs.add(f); return () => statusSubs.delete(f); };
    L.setConnected = on => { on = !!on; if (on === L.connected) return; L.connected = on; if (!on) L.reset(); statusSubs.forEach(f => f(on)); };
    L.setPower = on => { L.power = on; statusSubs.forEach(f => f(L.connected)); }; // the track power as last switched (unknown = null)
    L.reset = () => { L.power = null; parser = H.trackmateParser(); hwMs = 0; recent = []; offset = null; active.fill(false); lastHit.fill(0); firstHit.fill(0); firstAt.fill(0); held.fill(false); L.ticks = 0; L.lastTick = 0; };
    // how long a sensor must stay covered before it is a car in the pits (milliseconds; the race sets it from its setup, never below half a second)
    L.setHold = ms => { const n = Number(ms); L.holdMs = Number.isFinite(n) && n >= 0 ? Math.max(MIN_HOLD, Math.round(n)) : 2000; };
    // bytes from the port; returns the whole messages (for the monitor screen)
    L.feed = bytes => {
      const arrival = clock(), msgs = parser.feed(bytes);
      msgs.forEach(m => {
        if (m.type === 'tick') {
          hwMs += m.ms; L.ticks++; L.lastTick = m.ms;
          recent.push(arrival - hwMs); if (recent.length > 25) recent.shift(); offset = Math.min(...recent);
          for (let i = 0; i < 8; i++) if (active[i] && hwMs - lastHit[i] > QUIET) {
            active[i] = false;
            sensor(i, false, toPc(lastHit[i] + LEAVE));
            if (held[i]) { held[i] = false; emit({ type: 'free', lane: i, at: toPc(lastHit[i] + LEAVE) }); } // the car stood on the sensor and has gone
          }
        } else if (m.type === 'lane') {
          const i = m.lane - 1;
          if (!active[i]) { active[i] = true; held[i] = false; firstHit[i] = hwMs; firstAt[i] = toPc(hwMs); sensor(i, true, firstAt[i]); L.hits++; emit({ type: 'hit', lane: i, at: firstAt[i] }); }
          else if (!held[i] && hwMs - firstHit[i] >= L.holdMs) { held[i] = true; emit({ type: 'block', lane: i, at: firstAt[i] }); } // a letter after the hold time: the car is still there
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
