// Car Failures (1.43.0): a part of the Damage System. A failure is something that happens to a car at random during a race (a slow puncture, no brakes, an engine that gives up), not through a hit.
// This file holds the rules and nothing else (no screen, no clock of its own), so they can be tested on their own. The race engine (engine.js) rolls the failures of every car when the race starts,
// starts them at their moment and lets the stop in the pits clear them; the forms (database.js) use the defaults and the texts; the Car Failure widget (timing.js) shows the state.
//
// A failure has a name, a damage level it borrows its rules from (pit whenever you can or as fast as you can, a deadline in laps, and what the stop does: repair, retire or disqualify the car),
// a chance (the chance in percent that a car gets this failure at some point in the race) and its own seconds to stand still on the sensor in the pits. The failure does not add damage points.
(function (root) {
  const num = (v, d) => (v === '' || v === null || v === undefined || !Number.isFinite(Number(v)) ? d : Math.max(0, Number(v)));
  const round2 = x => Math.round(x * 100) / 100;

  // what a new Damage System starts with (they borrow the rules of the default levels of damage.js: Light, Heavy and Critical damage)
  const DEFAULT_FAILURES = [
    { name: 'Lift and Coast', level: 'Light damage', chance: 10, seconds: 5 },
    { name: 'Slow Puncture', level: 'Heavy damage', chance: 5, seconds: 10 },
    { name: 'Brakes not working', level: 'Heavy damage', chance: 4, seconds: 15 },
    { name: 'Engine Failure, Box to Retire', level: 'Critical damage', chance: 2, seconds: 0 }];
  const DEFAULTS = { on: false, from: 10, to: 90, max: 1 };
  const defaults = () => ({ ...DEFAULTS, list: DEFAULT_FAILURES.map(f => ({ ...f })) });

  // The failures of a Damage System record, as the engine wants them. raw: { on, list: [{ name, level, chance, seconds }], from, to, max }; levels: the cleaned levels of the same system
  // (damage.js clean). Gives null when the failures are switched off or there are none. A failure whose level cannot be found asks the least: pit whenever you can, no deadline, a repair.
  function clean(raw, levels) {
    if (!raw || typeof raw !== 'object' || !(raw.on === true || raw.on === 'on')) return null;
    const find = name => { const n = String(name || '').trim().toLowerCase(); return n ? (levels || []).find(l => String(l.name || '').trim().toLowerCase() === n) : null; };
    const list = (Array.isArray(raw.list) ? raw.list : []).filter(f => f && typeof f === 'object').map((f, i) => {
      const lv = find(f.level), seconds = round2(num(f.seconds, 0));
      return { name: String(f.name || '').trim() || 'Failure ' + (i + 1), level: String(f.level || '').trim(), levelFound: !!lv, chance: Math.min(100, round2(num(f.chance, 0))), seconds, ms: Math.round(seconds * 1000),
        urgent: !!(lv && lv.urgent), within: lv ? Math.max(0, Math.floor(Number(lv.within) || 0)) : 0, action: lv && lv.action ? lv.action : 'repair' };
    });
    if (!list.length) return null;
    const from = Math.min(100, Math.floor(num(raw.from, DEFAULTS.from))), to = Math.max(from, Math.min(100, Math.floor(num(raw.to, DEFAULTS.to)))), max = Math.floor(num(raw.max, DEFAULTS.max)) >= 1 ? Math.floor(num(raw.max, DEFAULTS.max)) : DEFAULTS.max;
    return { on: true, from, to, max, list };
  }

  // the Failure factor of a slot car: 1 = like the others, 2 = twice the chance, 0 = it never has a failure
  const factorOf = v => (v === '' || v === null || v === undefined || !Number.isFinite(Number(v)) ? 1 : Math.max(0, Number(v)));

  // The failures a car will get in this race, rolled once at the start. cfg: the cleaned failures; o: { laps: the laps the car has to drive (0 = no limit), ms: the time of the race (0 = none) };
  // factor: the Failure factor of the car; rnd: a function that gives a number from 0 up to 1. Every failure is rolled by itself: its chance (times the factor) is the chance that this car gets it.
  // When more come up than the system allows for one car, a random few are kept. The moment is random between `from` and `to` percent of the race: a lap number (a race with laps) or a time in
  // milliseconds (a race with a time). A failure never comes in the first lap or on the last one. Gives [{ k: index in the list, at }] in the order they come.
  function roll(cfg, o, factor, rnd) {
    if (!cfg || !Array.isArray(cfg.list) || !cfg.list.length) return [];
    const laps = Math.floor(num(o && o.laps, 0)), ms = Math.floor(num(o && o.ms, 0));
    if (laps === 1 || (laps < 1 && ms < 1)) return [];
    const f = factorOf(factor), hits = [];
    cfg.list.forEach((x, k) => { const p = Math.min(100, x.chance * f); if (p > 0 && rnd() * 100 < p) hits.push(k); });
    if (hits.length > cfg.max) for (let i = hits.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [hits[i], hits[j]] = [hits[j], hits[i]]; }
    return hits.slice(0, cfg.max).map(k => {
      const p = (cfg.from + rnd() * (cfg.to - cfg.from)) / 100;
      return { k, at: laps > 0 ? Math.max(1, Math.min(laps - 1, Math.round(p * laps))) : Math.round(p * ms) };
    }).sort((a, b) => a.at - b.at || a.k - b.k);
  }

  // ---- words ----
  const secText = s => `${Math.round(s * 10) / 10} second${Math.round(s * 10) / 10 === 1 ? '' : 's'}`;
  const lapsWord = n => `${n} lap${n === 1 ? '' : 's'}`;
  const ACT = { repair: 'repaired', retire: 'retired', dq: 'disqualified' };
  // "Slow Puncture: pit as fast as you can, within 3 laps; stand still for at least 10 seconds, which repairs the car."
  function failureText(f) {
    if (!f) return '';
    const when = f.urgent ? 'as fast as you can' : 'whenever you can', within = f.within > 0 ? `, within ${lapsWord(f.within)}` : '';
    const what = f.action === 'repair' ? `stand still for at least ${secText(f.seconds)}, which repairs the car` : `${f.seconds > 0 ? `stand still for at least ${secText(f.seconds)} and ` : ''}the car is ${ACT[f.action]}`;
    return `${f.name}: pit ${when}${within}; ${what}.`;
  }
  // one line for the Home tab and the Help: the failures and their chances in short
  const rulesText = cfg => (cfg && cfg.list.length ? cfg.list.map(f => `${f.name} ${f.chance}%`).join(', ') + '.' : '');
  // the colour a failure gets on a widget: 'amber' to pit for whenever you can, 'red' as fast as you can (or late), 'out' when it ends the car
  const toneOf = (f, late) => (!f ? 'ok' : f.action !== 'repair' ? 'out' : late || f.urgent ? 'red' : 'amber');
  // what a failure asks, short, for the Car Failure widget and the texts: "Pit whenever you can", "Pit in 2 laps", "Pit now", "Pit now, 1 lap late"
  const whenText = (f, lapsLeft) => (lapsLeft === null || lapsLeft === undefined ? (f && f.urgent ? 'Pit as fast as you can' : 'Pit whenever you can') : lapsLeft < 0 ? `Pit now, ${lapsWord(-lapsLeft)} late` : lapsLeft === 0 ? 'Pit now' : `Pit in ${lapsWord(lapsLeft)}`);

  const api = { DEFAULT_FAILURES, DEFAULTS, defaults, clean, factorOf, roll, failureText, rulesText, toneOf, whenText, secText };
  root.Failures = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
