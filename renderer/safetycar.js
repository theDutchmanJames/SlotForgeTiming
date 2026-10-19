// Safety Car System (1.53.0): a few settings bundled in one record, chosen in the Racing Systems folder of a race setup.
// The Safety Car is out while the yellow flag is up (the flag buttons, the Trackcall button and a marshal call all raise it), so there is no button of its own. While it is out:
//   1. the lap times must be slower than a target (a lap that is too fast gets penalty points, and is called out, as under the plain yellow flag of a race setup),
//   2. the work in a pit stop (refuelling, a repair, changing tyres) takes a number of percent less time.
// A system replaces the Yellow flag fields of the race setup (target lap time and penalty points) in the races that choose it. No closing up of the gaps (a later release, if asked).
// This file holds the rules and the words and nothing else (no screen, no clock), so they can be tested on their own; engine.js uses it.
(function (root) {
  const num = (v, d, lo, hi) => { const n = Number(v); return v === '' || v === null || v === undefined || !Number.isFinite(n) ? d : Math.min(hi, Math.max(lo, n)); };
  const MAX_PIT = 90; // a stop is never made shorter than a tenth of its time: 100% would be no stop at all
  // what a new system starts with: laps under 15 seconds are too fast (about twice a normal lap on a small track), 1 penalty point for it, the work in the pits takes half the time
  const DEFAULTS = { target: 15, points: 1, pitPercent: 50 };
  const defaults = () => ({ ...DEFAULTS });
  // The settings the engine uses, from a record of the database (null: there is no system). target in milliseconds (0 = no limit on the lap time), points a whole number, pit a whole number of percent from 0 to 90.
  function clean(rec) {
    if (!rec || typeof rec !== 'object') return null;
    const target = Math.round(num(rec.target, DEFAULTS.target, 0, 3600) * 1000);
    return { target, points: target > 0 ? Math.floor(num(rec.points, DEFAULTS.points, 0, 100)) : 0, pit: Math.round(num(rec.pitPercent, DEFAULTS.pitPercent, 0, MAX_PIT)) };
  }
  // The settings of an engine from a config that was cleaned before (clean(), possibly sent to another window): the same numbers, made safe again. null: no system.
  function fromConfig(x) {
    if (!x || typeof x !== 'object') return null;
    const target = Math.max(0, Math.round(Number(x.target) || 0));
    return { target, points: target > 0 ? Math.max(0, Math.floor(Number(x.points) || 0)) : 0, pit: Math.min(MAX_PIT, Math.max(0, Math.round(Number(x.pit) || 0))) };
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

  const api = { DEFAULTS, MAX_PIT, defaults, clean, fromConfig, factor, rulesText, eventText, secText };
  root.SafetyCar = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
