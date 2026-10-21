// Safety Car System (1.53.0): a few settings bundled in one record, chosen in the Rules and systems folder of a race setup.
// The Safety Car is out while the yellow flag is up (the flag buttons, the Trackcall button and a marshal call all raise it), so there is no button of its own. While it is out:
//   1. the lap times must be slower than a target (a lap that is too fast gets penalty points, and is called out, as under the plain yellow flag of a race setup),
//   2. the work in a pit stop (refuelling, a repair, changing tyres) takes a number of percent less time.
// A system replaces the Yellow flag fields of the race setup (target lap time and penalty points) in the races that choose it. No closing up of the gaps (a later release, if asked).
// Random flags (1.59.0): a system can also put the yellow flag (the Safety Car) up at random moments, as if other cars on the track caused it, whatever the drivers do. A plan is rolled when the race
// starts (how many flags, when, how long), kept in the snapshot, and engine.js raises and lifts the flags by it. The red flag is not part of it (parked).
// This file holds the rules and the words and nothing else (no screen, no clock), so they can be tested on their own; engine.js uses it.
(function (root) {
  const num = (v, d, lo, hi) => { const n = Number(v); return v === '' || v === null || v === undefined || !Number.isFinite(n) ? d : Math.min(hi, Math.max(lo, n)); };
  const MAX_PIT = 90; // a stop is never made shorter than a tenth of its time: 100% would be no stop at all
  // what a new system starts with: laps under 15 seconds are too fast (about twice a normal lap on a small track), 1 penalty point for it, the work in the pits takes half the time
  const DEFAULTS = { target: 15, points: 1, pitPercent: 50 };
  const defaults = () => ({ ...DEFAULTS });
  // ---- Random flags (1.59.0) ----
  const MAX_FLAGS = 20; // the most random flags in one race
  const RND_MODES = [['exact', 'Exactly N flags'], ['range', 'From N to M flags'], ['atleast', 'At least N flags, maybe more']];
  const RND_LENGTHS = [['fixed', 'Always the same time'], ['range', 'Between two times']];
  const RND_ENDS = [['timer', 'By itself when the time is up'], ['director', 'Only when the Race Director lifts it']];
  // what a new system starts with (the form keys are rnd + the name: rndOn, rndChance, rndMode, rndMin, rndMax, rndMore, rndLenMode, rndLen, rndLenMax, rndEnd, rndFrom, rndTo, rndGap, rndFree, rndWarn)
  const RND_DEFAULTS = { on: 'off', chance: 100, mode: 'atleast', min: 2, max: 4, more: 30, lenMode: 'fixed', len: 30, lenMax: 60, end: 'timer', from: 10, to: 90, gap: 30, free: 20, warn: 0 };
  const pick = (v, list, d) => (list.some(x => x[0] === v) ? v : d);
  // The random flags of a record (null: off). Times in milliseconds: lenMin, lenMax (never below lenMin), gap, warn, free (the minutes of a free practice that has no end). from <= to (typed the other way round, they swap).
  function cleanRandom(rec) {
    if (!rec || typeof rec !== 'object' || rec.rndOn !== 'on') return null;
    const D = RND_DEFAULTS, mode = pick(rec.rndMode, RND_MODES, D.mode), min = Math.floor(num(rec.rndMin, D.min, 0, MAX_FLAGS)), max = Math.max(min, Math.floor(num(rec.rndMax, D.max, 0, MAX_FLAGS)));
    const lenMin = Math.round(num(rec.rndLen, D.len, 5, 600) * 1000), lenRange = pick(rec.rndLenMode, RND_LENGTHS, D.lenMode) === 'range';
    const a = num(rec.rndFrom, D.from, 0, 100), b = num(rec.rndTo, D.to, 0, 100);
    return { chance: num(rec.rndChance, D.chance, 0, 100), mode, min, max: mode === 'range' ? max : min, more: mode === 'atleast' ? num(rec.rndMore, D.more, 0, 100) : 0,
      lenMin, lenMax: lenRange ? Math.max(lenMin, Math.round(num(rec.rndLenMax, D.lenMax, 5, 600) * 1000)) : lenMin, end: pick(rec.rndEnd, RND_ENDS, D.end),
      from: Math.min(a, b), to: Math.max(a, b), gap: Math.round(num(rec.rndGap, D.gap, 0, 600) * 1000), free: Math.round(num(rec.rndFree, D.free, 1, 240) * 60000), warn: Math.round(num(rec.rndWarn, D.warn, 0, 60) * 1000) };
  }
  // The same from a config that was cleaned before (possibly sent to another window): the numbers made safe again. null: no random flags.
  function randomFromConfig(x) {
    if (!x || typeof x !== 'object') return null;
    const D = RND_DEFAULTS, mode = pick(x.mode, RND_MODES, D.mode), min = Math.floor(num(x.min, D.min, 0, MAX_FLAGS)), lenMin = Math.round(num(x.lenMin, D.len * 1000, 5000, 600000));
    const a = num(x.from, D.from, 0, 100), b = num(x.to, D.to, 0, 100);
    return { chance: num(x.chance, D.chance, 0, 100), mode, min, max: mode === 'range' ? Math.max(min, Math.floor(num(x.max, D.max, 0, MAX_FLAGS))) : min, more: mode === 'atleast' ? num(x.more, D.more, 0, 100) : 0,
      lenMin, lenMax: Math.max(lenMin, Math.round(num(x.lenMax, lenMin, 5000, 600000))), end: pick(x.end, RND_ENDS, D.end),
      from: Math.min(a, b), to: Math.max(a, b), gap: Math.round(num(x.gap, D.gap * 1000, 0, 600000)), free: Math.round(num(x.free, D.free * 60000, 60000, 14400000)), warn: Math.round(num(x.warn, 0, 0, 60000)) };
  }
  // Which way the moments are measured: by the laps of the leader (a race by laps or distance), else by the clock (a timed race, a qualifying, or a free practice: its length is rn.free).
  const unitOf = span => (span && span.laps > 0 ? 'laps' : 'ms');
  // The plan of one race: { unit, plan: [{ at, len }] } sorted by at. at is a place in the race in laps of the leader (4.37: a part of the fifth lap; never before lap 1, never after the last lap but one) or in
  // milliseconds of the race clock; len is how long it lasts (ms; the Race Director may lift it before). span: { laps, ms } the length of the race (0 for none). rand: a function giving a number from 0 up to 1.
  // The count comes first (a chance that the race has any at all, then exactly N, a number from N to M, or N and more with a chance for every one more), the lengths, and then the places: spread at random
  // over the part of the race between the earliest and the latest moment, at least the gap (in a race by laps: a lap) apart. When they do not fit, there are fewer flags.
  function roll(rn, span, rand) {
    const unit = unitOf(span), none = { unit, plan: [] }, rnd = typeof rand === 'function' ? rand : Math.random;
    if (!rn) return none;
    const total = unit === 'laps' ? span.laps : span && span.ms > 0 ? span.ms : rn.free;
    if (!(total > 0) || !(rnd() * 100 < rn.chance)) return none;
    let n = rn.min;
    if (rn.mode === 'range') n = rn.min + Math.floor(rnd() * (rn.max - rn.min + 1));
    else if (rn.mode === 'atleast') while (n < MAX_FLAGS && rnd() * 100 < rn.more) n++;
    n = Math.min(MAX_FLAGS, n);
    let lo = total * rn.from / 100, hi = total * rn.to / 100;
    if (unit === 'laps') { lo = Math.max(1, lo); hi = Math.min(total - 1, hi); }
    if (n <= 0 || !(hi >= lo)) return none;
    const lens = Array.from({ length: n }, () => (rn.lenMax > rn.lenMin ? Math.round((rn.lenMin + rnd() * (rn.lenMax - rn.lenMin)) / 100) * 100 : rn.lenMin));
    const width = i => (unit === 'laps' ? 1 : lens[i] + rn.gap), need = k => { let w = 0; for (let i = 0; i < k - 1; i++) w += width(i); return w; };
    while (n > 0 && need(n) > hi - lo) n--;
    if (n <= 0) return none;
    const room = hi - lo - need(n), off = Array.from({ length: n }, () => rnd() * room).sort((p, q) => p - q), plan = [];
    let before = 0;
    for (let i = 0; i < n; i++) { const at = lo + off[i] + before; plan.push({ at: unit === 'laps' ? Math.round(at * 100) / 100 : Math.round(at), len: lens[i] }); before += width(i); }
    return { unit, plan };
  }
  // the random flags in one line (the race log, the Help): "random yellow flags: 2 to 4, 30 s each (between 10% and 90% of the race)"
  function randomText(rn) {
    if (!rn) return '';
    const count = rn.mode === 'exact' ? `${rn.min}` : rn.mode === 'range' ? `${rn.min} to ${rn.max}` : `at least ${rn.min}`;
    const len = rn.end === 'director' ? 'until the Race Director lifts them' : rn.lenMax > rn.lenMin ? `${secText(rn.lenMin)} to ${secText(rn.lenMax)} each` : `${secText(rn.lenMin)} each`;
    return `random yellow flags: ${count}${rn.chance < 100 ? ` (${Math.round(rn.chance * 10) / 10}% chance in a race)` : ''}, ${len}`;
  }
  // what the race log says about them: the events 'randomflag' { n, of, len (ms, or null: until the Race Director lifts it) }, 'randomend' { n, by: 'time' | 'hand' } and 'randomsoon' { n }
  function randomEventText(e) {
    if (!e) return '';
    if (e.type === 'randomsoon') return `Random yellow flag ${e.n} is about to come`;
    if (e.type === 'randomend') return `Random yellow flag ${e.n} is over${e.by === 'time' ? ' (the time was up)' : ' (lifted by hand)'}`;
    return `Random yellow flag ${e.n} of ${e.of}${e.len ? ` (${secText(e.len)})` : ' (until the Race Director lifts it)'}`;
  }

  // The settings the engine uses, from a record of the database (null: there is no system). target in milliseconds (0 = no limit on the lap time), points a whole number, pit a whole number of percent from 0 to 90.
  function clean(rec) {
    if (!rec || typeof rec !== 'object') return null;
    const target = Math.round(num(rec.target, DEFAULTS.target, 0, 3600) * 1000);
    const rnd = cleanRandom(rec);
    return { target, points: target > 0 ? Math.floor(num(rec.points, DEFAULTS.points, 0, 100)) : 0, pit: Math.round(num(rec.pitPercent, DEFAULTS.pitPercent, 0, MAX_PIT)), ...(rnd ? { rnd } : {}) };
  }
  // The settings of an engine from a config that was cleaned before (clean(), possibly sent to another window): the same numbers, made safe again. null: no system.
  function fromConfig(x) {
    if (!x || typeof x !== 'object') return null;
    const target = Math.max(0, Math.round(Number(x.target) || 0));
    const rnd = randomFromConfig(x.rnd);
    return { target, points: target > 0 ? Math.max(0, Math.floor(Number(x.points) || 0)) : 0, pit: Math.min(MAX_PIT, Math.max(0, Math.round(Number(x.pit) || 0))), ...(rnd ? { rnd } : {}) };
  }
  // how long the work in a stop takes, as a part of the usual time (1 = as usual): 50% less is 0.5
  const factor = sc => (sc && sc.pit > 0 ? Math.round((100 - Math.min(MAX_PIT, sc.pit)) * 100) / 10000 : 1);
  const secText = ms => `${Math.round(ms / 100) / 10} s`;
  const pointsText = n => `${n} penalty point${n === 1 ? '' : 's'}`;
  // the rules in one line (the Rules of this race card, the race log): "Safety Car: laps slower than 15 s (1 penalty point for a faster lap), pit work 50% shorter"
  function rulesText(sc) {
    if (!sc) return '';
    const parts = [];
    if (sc.target > 0) parts.push(`laps slower than ${secText(sc.target)}${sc.points > 0 ? ` (${pointsText(sc.points)} for a faster lap)` : ''}`);
    if (sc.pit > 0) parts.push(`pit work ${sc.pit}% shorter`);
    return 'Safety Car: ' + (parts.length ? parts.join(', ') : 'no rules, only the flag');
  }
  // what the log says about the Safety Car (the events 'safetycar': { out: true | false, laps: the laps the leader had driven })
  function eventText(e) {
    if (!e) return '';
    const at = e.laps > 0 ? ` (after lap ${e.laps})` : '';
    return (e.out ? 'Safety Car out' : 'Safety Car in') + at;
  }

  const api = { DEFAULTS, MAX_PIT, defaults, clean, fromConfig, factor, rulesText, eventText, secText, MAX_FLAGS, RND_MODES, RND_LENGTHS, RND_ENDS, RND_DEFAULTS, cleanRandom, randomFromConfig, unitOf, roll, randomText, randomEventText };
  root.SafetyCar = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
