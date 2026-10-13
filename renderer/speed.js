// Track length and speed sums, kept free of screen code so they can be tested on their own.
// Lengths are in metres, times in milliseconds, speeds in km/h (mph is converted from that).
(function (root) {
  const KMH_TO_MPH = 0.621371;
  // pieces: [{ count, mm }] -> total length in metres (pieces without a count or length are ignored)
  function lengthFromPieces(pieces) {
    const mm = (pieces || []).reduce((sum, p) => { const c = Number(p && p.count), l = Number(p && p.mm); return sum + (c > 0 && l > 0 ? c * l : 0); }, 0);
    return Math.round(mm) / 1000;
  }
  // average speed over a lap in km/h, or null when it cannot be worked out
  function kmh(lengthM, lapMs) {
    const len = Number(lengthM), ms = Number(lapMs);
    return len > 0 && ms > 0 ? len / (ms / 1000) * 3.6 : null;
  }
  // "1:32" -> 32, "1/24" -> 24, "HO" -> 87, "N" -> 160; null when unknown
  function scaleFactor(text) {
    const t = String(text ?? '').trim().toUpperCase();
    if (t === 'HO') return 87;
    if (t === 'N') return 160;
    const m = t.match(/^1\s*[:/]\s*(\d+(?:[.,]\d+)?)$/);
    const n = m ? Number(m[1].replace(',', '.')) : NaN;
    return n > 0 ? n : null;
  }
  const toUnit = (kmhValue, unit) => (unit === 'mph' ? kmhValue * KMH_TO_MPH : kmhValue);
  // an old free-text length such as "12 m" or "12,5" becomes a number of metres (empty when there is no number)
  function parseLength(v) {
    if (typeof v === 'number') return v > 0 ? v : '';
    const m = String(v ?? '').replace(',', '.').match(/\d+(?:\.\d+)?/);
    return m ? Number(m[0]) : '';
  }
  // The Lane length modifier of a track: 'none' (every lane has the track length), 'bends' (the lanes differ because of the bends: calculated) or 'measured'
  // (the length of every lane was entered). A track saved before the modifier existed is calculated as a loop, as it always was; a track saved with the
  // short-lived "track shape" of version 0.60.0 keeps what that said (a figure-eight has equal lanes).
  const MODIFIERS = ['none', 'bends', 'measured'];
  function modifier(track) {
    if (track && MODIFIERS.includes(track.laneModifier)) return track.laneModifier;
    return track && track.trackShape === 'figure8' ? 'none' : 'bends';
  }
  // How many full turns the track makes (left bends minus right bends): a loop makes 1, a figure-eight 0 (its left and right bends cancel out). It is the
  // whole number that was entered, from 0; without a usable number it is 1.
  function turns(track) {
    if (!track || (!MODIFIERS.includes(track.laneModifier) && track.trackShape !== 'other')) return 1; // an old track: a loop
    const n = Math.round(Number(track.netTurns));
    return track.netTurns !== '' && track.netTurns !== null && track.netTurns !== undefined && Number.isFinite(n) && n >= 0 ? n : 1;
  }
  // The measured lengths: "15.4, 15.8, 16.2" (or a list of numbers) gives [15.4, 15.8, 16.2]; a place that is not a number above 0 is null.
  function parseLaneLengths(v) {
    const parts = Array.isArray(v) ? v : String(v ?? '').split(',');
    return parts.map(x => { const n = typeof x === 'number' ? x : (String(x).trim() === '' ? NaN : Number(String(x).trim())); return Number.isFinite(n) && n > 0 ? n : null; }).filter((x, i, a) => !(x === null && i === a.length - 1 && String(parts[i]).trim() === '')); // a comma at the end is not a place
  }
  // The length of one lane (lane: 0 = lane 1).
  //  - none: every lane has the track length.
  //  - measured: the length that was entered for that lane (a lane without one has the track length, if there is one).
  //  - bends: the track length is that of the outside lane (the last lane, or the first). Every lane further in is shorter by the lane spacing times the angle
  //    the track turns (2 x pi per full turn), whatever the shape of the bends (the lanes run side by side, only the bends differ): on a loop 2 x pi x the
  //    spacing, on a figure-eight nothing (every lane is the inside lane in one loop and the outside lane in the other).
  function laneLength(track, lane) {
    const len = Number(track && track.length), mod = modifier(track), lanes = Math.max(1, Math.round(Number(track && track.lanes)) || 1);
    const l = Math.max(0, Math.min(lanes - 1, Math.round(Number(lane)) || 0));
    if (mod === 'measured') { const own = parseLaneLengths(track.laneLengths)[l]; if (own > 0) return own; }
    if (!(len > 0)) return null;
    if (mod !== 'bends') return len;
    const sp = Number(track.laneSpacing) > 0 ? Number(track.laneSpacing) : 100, steps = track.outsideLane === 'first' ? l : lanes - 1 - l;
    return Math.max(0.001, len - steps * 2 * Math.PI * turns(track) * sp / 1000);
  }
  const api = { laneLength, modifier, turns, parseLaneLengths, MODIFIERS, lengthFromPieces, kmh, scaleFactor, toUnit, parseLength };
  root.Speed = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
