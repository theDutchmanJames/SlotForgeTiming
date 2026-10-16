// The Damage System: damage points that a car collects (a deslot, a hit), the levels they add up to, and the stop in the pits that repairs them.
// This file holds the rules and nothing else (no screen, no clock of its own), so they can be tested on their own. The race engine (engine.js) keeps the damage of every car and calls
// these functions; the forms (database.js) use the defaults and the texts.
//
// A level starts at a number of damage points ("from"). The highest level a car has reached is the one that counts. A level has a time to stand still on the sensor in the pits (a
// repair, which sets the damage back to 0), says whether the driver should pit whenever he can or as fast as he can, can have a deadline in laps, and says what the stop does:
// repair the car, retire it (the result stays) or disqualify it.
(function (root) {
  const num = (v, d) => (v === '' || v === null || v === undefined || !Number.isFinite(Number(v)) ? d : Math.max(0, Number(v)));
  const ACTIONS = ['repair', 'retire', 'dq'];

  // what a new Damage System starts with (the examples of the Help: light, medium, heavy and critical damage)
  const DEFAULT_LEVELS = [
    { name: 'Light damage', from: 3, seconds: 10, urgency: 'whenever', within: 0, action: 'repair' },
    { name: 'Medium damage', from: 6, seconds: 15, urgency: 'whenever', within: 0, action: 'repair' },
    { name: 'Heavy damage', from: 9, seconds: 20, urgency: 'asap', within: 3, action: 'repair' },
    { name: 'Critical damage', from: 10, seconds: 0, urgency: 'asap', within: 1, action: 'retire' }];
  const DEFAULT_INCIDENTS = [{ name: 'Deslot', points: 1 }, { name: 'Contact', points: 2 }, { name: 'Hard crash', points: 4 }];
  const defaults = () => ({ levels: DEFAULT_LEVELS.map(l => ({ ...l })), incidents: DEFAULT_INCIDENTS.map(x => ({ ...x })) });

  // The rules of a Damage System record (and of the track: the time over which a lap is a deslot, in seconds, 0 = none). Gives null when there is no record.
  function clean(s, deslotSeconds) {
    if (!s || typeof s !== 'object') return null;
    const seen = new Set();
    const levels = (Array.isArray(s.levels) ? s.levels : []).map(l => l && ({
      name: String(l.name || '').trim(), from: Math.floor(num(l.from, 0)), seconds: num(l.seconds, 0), urgent: l.urgency === 'asap',
      within: Math.floor(num(l.within, 0)), action: ACTIONS.includes(l.action) ? l.action : 'repair' }))
      .filter(l => l && l.from >= 1).sort((a, b) => a.from - b.from).filter(l => (seen.has(l.from) ? false : (seen.add(l.from), true)))
      .map((l, i) => ({ ...l, name: l.name || 'Level ' + (i + 1), ms: Math.round(l.seconds * 1000) }));
    const incidents = (Array.isArray(s.incidents) ? s.incidents : []).filter(x => x && String(x.name || '').trim() && Math.floor(num(x.points, 0)) >= 1)
      .map(x => ({ name: String(x.name).trim(), points: Math.floor(num(x.points, 0)) }));
    return {
      on: true, stop: s.stop === 'add' ? 'add' : 'overlap', levels, incidents,
      deslotPoints: Math.floor(num(s.deslotPoints, 1)), deslotMs: Math.round(num(deslotSeconds, 0) * 1000),
      latePoints: Math.floor(num(s.latePoints, 1)), earlyPoints: Math.floor(num(s.earlyPoints, 1))
    };
  }

  // the index of the level that damage points have reached (-1: not even the first level)
  function levelAt(cfg, points) {
    let k = -1;
    if (cfg) cfg.levels.forEach((l, i) => { if (points >= l.from) k = i; });
    return k;
  }
  const levelOf = (cfg, points) => { const k = levelAt(cfg, points); return k < 0 ? null : cfg.levels[k]; };

  // the damage points a hit gives to a car: its factor (1 = as the others; a fragile car has more, 0 = a car that takes no damage) makes it more or less; taking points back is never scaled
  const factorOf = v => (v === '' || v === null || v === undefined || !Number.isFinite(Number(v)) ? 1 : Math.max(0, Number(v)));
  function scale(n, factor) {
    if (!Number.isFinite(n) || n === 0) return 0;
    if (n < 0) return Math.round(n);
    const f = factorOf(factor);
    return f === 0 ? 0 : Math.max(1, Math.round(n * f));
  }

  // The lap by which a car should be in the pits. `due` is what it was (a lap number or null), `laps` is how many laps the car has driven, level is the level it has now reached.
  // A higher level with a deadline of its own can only make it sooner, never later; a level without a deadline leaves it as it was.
  function dueLap(due, laps, level) {
    const own = level && level.within > 0 ? laps + level.within : null;
    if (own === null) return due;
    return due === null || due === undefined ? own : Math.min(due, own);
  }

  // The moment (race clock) a repair is done. The car stands on the sensor from blockAt. With "at the same time" the seconds count from there, with "one after the other" from the moment the other work
  // in the stop (the refuelling, a driver swap) is done, which the engine works out (otherDoneAt).
  const doneAt = (cfg, level, blockAt, otherDoneAt) => (cfg && cfg.stop === 'add' ? Math.max(blockAt, otherDoneAt ?? blockAt) : blockAt) + (level ? level.ms : 0);

  // ---- words ----
  const secText = s => `${Math.round(s * 10) / 10} second${Math.round(s * 10) / 10 === 1 ? '' : 's'}`;
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const ACT = { repair: 'repaired', retire: 'retired', dq: 'disqualified' };
  // "Light damage (from 3 points): pit whenever you can and stand still for at least 10 seconds."
  function levelText(l) {
    if (!l) return '';
    const when = l.urgent ? 'as fast as you can' : 'whenever you can', within = l.within > 0 ? `, within ${plural(l.within, 'lap')}` : '';
    const what = l.action === 'repair' ? `stand still for at least ${secText(l.seconds)}, which repairs the damage`
      : `${l.seconds > 0 ? `stand still for at least ${secText(l.seconds)} and ` : ''}the car is ${ACT[l.action]}`;
    return `${l.name} (from ${plural(l.from, 'point')}): pit ${when}${within}; ${what}.`;
  }
  // one line for the Home tab and the Help: the levels in short
  function rulesText(cfg) {
    if (!cfg || !cfg.levels.length) return cfg ? 'Damage points are counted, but no level repairs or ends anything.' : '';
    return cfg.levels.map(l => `${l.from} = ${l.name} (${l.action === 'repair' ? secText(l.seconds) : l.action === 'retire' ? 'retires the car' : 'disqualifies the car'})`).join('; ') + '.';
  }
  // the colour a level gets on a widget: no damage 'ok', a level to pit for whenever you can 'amber', as fast as you can 'red', the end of the car 'out'
  function toneOf(level, points) {
    if (!level) return points > 0 ? 'minor' : 'ok';
    if (level.action !== 'repair') return 'out';
    return level.urgent ? 'red' : 'amber';
  }
  const secClock = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

  // ---- the result: what the damage did to a car in a race, in words ("9 damage points, 2 repairs (30 seconds in the pits), late for the pits once, retired by damage") ----
  const times = n => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);
  function noteOf(car, events, i) {
    if (!car || !(car.dmgTotal > 0 || car.dmgOut)) return '';
    const out = [], fixed = (car.repairs || []).filter(r => !r.out), mine = type => (events || []).filter(e => e.car === i && e.type === type).length;
    if (car.dmgTotal > 0) out.push(plural(car.dmgTotal, 'damage point'));
    if (fixed.length) out.push(`${plural(fixed.length, 'repair')} (${secText(Math.round(fixed.reduce((n, r) => n + r.ms, 0) / 100) / 10)} in the pits)`);
    if (car.dmg > 0 && !car.dmgOut) out.push(`${plural(car.dmg, 'damage point')} not repaired`);
    const late = mine('damagelate'), early = mine('repairearly');
    if (late) out.push(`late for the pits ${times(late)}`);
    if (early) out.push(`left the pits too early ${times(early)}`);
    if (car.dmgOut) out.push(car.dmgOut === 'dq' ? 'disqualified by damage' : 'retired by damage');
    return out.join(', ');
  }

  // ---- what the damage panel shows (race screen and Race Director page) ----
  // eng: the engine (the race window's, or the one a viewer follows); lanes: the lane numbers (0...); t: the clock of the screen (as performance.now()); phase: the phase of the race screen.
  // Gives { on, info, incidents, rows: [{ lane, who, points, chip, kind, note, give, take }] }; kind is the colour: ok, minor, amber, red, out.
  const lapsText = n => `${Math.abs(n)} ${Math.abs(n) === 1 ? 'lap' : 'laps'}`;
  function view(eng, lanes, t, phase) {
    const cfg = eng && eng.damage;
    if (!cfg) return { on: false, info: '', incidents: [], rows: [] };
    const racing = phase === 'running' || phase === 'paused', rows = [];
    (lanes || []).forEach(l => {
      const i = eng.cars.findIndex(c => c.lane === l); if (i < 0) return;
      const c = eng.cars[i], d = eng.damageOf(i, t); if (!d) return;
      const late = d.lapsLeft !== null && d.lapsLeft < 0;
      const chip = d.out === 'dq' ? 'Disqualified' : d.out ? 'Retired' : d.level >= 0 ? d.name : d.points > 0 ? 'Minor damage' : 'No damage';
      let note = '';
      if (d.out) note = 'Put out by damage';
      else if (d.standLeft !== null) note = `Repairing: stand still for ${secClock(d.standLeft)} more`;
      else if (d.level >= 0) {
        const lv = cfg.levels[d.level];
        note = (lv.urgent ? 'Pit as fast as you can' : 'Pit whenever you can') + (lv.action === 'repair' ? `, ${secText(lv.seconds)} in the pits` : lv.action === 'retire' ? ': the car is retired' : ': the car is disqualified')
          + (d.lapsLeft === null ? '' : late ? `, late by ${lapsText(d.lapsLeft)}` : d.lapsLeft === 0 ? ', pit now' : `, ${lapsText(d.lapsLeft)} left`);
      }
      rows.push({ lane: l, who: c.teamName ? `${c.teamName} · ${c.driverName}` : c.driverName || '', points: d.points, chip, kind: late && !d.out ? 'red' : d.tone, note,
        give: racing && !d.out && !c.done, take: racing && d.points > 0 });
    });
    return { on: true, info: rulesText(cfg), incidents: cfg.incidents, rows };
  }

  const api = { noteOf, ACTIONS, DEFAULT_LEVELS, DEFAULT_INCIDENTS, defaults, clean, levelAt, levelOf, factorOf, scale, dueLap, doneAt, secText, levelText, rulesText, toneOf, secClock, view };
  root.Damage = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
