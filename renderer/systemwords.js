// The words of the system forms with a rail (1.73.0): a Penalty system and a Damage system, and (1.74.0) a Weather system, and (1.75.0) a Tyre wear system, and (1.76.0) a Safety car system, a Push and save system and a Fuel system. The form of a system has a header (the picture of the system, its name, a few pills and "Ready to use"),
// a sentence "In plain words" that reads the whole system back, and a rail with a short note and a dot for every section; this file works out those words from the values of the form and nothing
// else (no screen, no storage), so they can be tested on their own. It is the same idea as setupwords.js for a race setup, and the numbers come from the rules of the race itself: the time of a
// penalty from engine.js (penaltyConfig, penaltyMs) and the levels of damage from damage.js (clean), so the words say what the race will do, also for a setting that is empty or wrong.
//   v: the values of the form, by setting (every value may be text), and the lists as the form holds them while they are edited:
//      penaltysystems: types (the special penalties)   damagesystems: levels, incidents, failures (the rows of the three tables)   weathersystems: no lists (its tables are plain numbers: the 12 of the hindrance table and the 16 conditions)
//      tyrewearsystems: tyres, mult, sets (the three tables as the form holds them while they are edited) and disp ('m' or 'ft': the distance unit of the app)
//      safetycarsystems, pushsavesystems, fuelrules (1.76.0): no lists, only the settings of the form
//   ctx: { lists: { types, levels, incidents, failures: the rows a new system starts with } } (only to see what has been changed from the standard)
//   describe -> { pills: [{ text, tone: 'hi' | '' }], say: [{ t, b }], ready: { ok, text }, notes: { section: { tone, parts } }, strip }
//   rail     -> { section: { rail (the short note), row (the line of a section that is closed), state: 'ok' | 'todo' | 'plain' } }
//   (a dot is green = filled in or changed from the standard, amber = something that is needed is missing, an open ring = nothing changed from the standard; see railform.js)
(function (root) {
  const eng = () => (typeof module !== 'undefined' ? require('./engine.js') : root.RaceEngine);
  const dmg = () => (typeof module !== 'undefined' ? require('./damage.js') : root.Damage);
  const wx = () => (typeof module !== 'undefined' ? require('./weather.js') : root.Wx);

  const text = v => (typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : ''); // (anything that is not text or a number is nothing)
  const round = n => Math.round(n * 100) / 100;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const secs = n => plural(round(n), 'second', 'seconds');
  const pts = n => plural(n, 'point', 'points');
  const ppts = n => plural(n, 'penalty point', 'penalty points');
  const T = t => ({ t: String(t) }), B = t => ({ t: String(t), b: true });
  const num = (v, d) => { const s = text(v).trim().replace(',', '.'); return s !== '' && Number.isFinite(Number(s)) ? Number(s) : d; };
  const names = list => list.map(x => x.name);
  const joinAnd = (list, word) => (list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} ${word} ${list[list.length - 1]}`);
  const entry = (rail, row, state) => ({ rail, row: cap(row), state });
  const READY = { ok: { ok: true, text: 'Ready to use' }, name: { ok: false, text: 'Give it a name' }, levels: { ok: false, text: 'Red must be at or below amber' }, pace: { ok: false, text: 'Saving pace must be above normal' } };

  // what the form holds in its tables, as the form saves it (a row without a name does not count)
  const typesOf = list => (Array.isArray(list) ? list : []).filter(t => t && text(t.name).trim()).map(t => t.effect === undefined ? ({ name: text(t.name).trim(), kind: t.kind === 'drivethrough' ? 'drivethrough' : 'stopgo', seconds: num(t.seconds, 0), cost: num(t.cost, 0), extra: num(t.extra, 0), unserved: num(t.unserved, 0) }) : ({ name: text(t.name).trim(), points: Math.max(0, Math.floor(num(t.points, 0))), effect: ['time', 'laps', 'pit'].includes(t.effect) ? t.effect : 'none', amount: Math.max(0, num(t.amount, 0)) }));
  const levelsOf = list => (Array.isArray(list) ? list : []).filter(l => l && (text(l.name).trim() || num(l.from, 0) > 0)).map(l => ({ name: text(l.name).trim(), from: Math.floor(num(l.from, 0)), seconds: num(l.seconds, 0), urgency: l.urgency === 'asap' ? 'asap' : 'whenever', within: Math.floor(num(l.within, 0)), action: ['retire', 'dq'].includes(l.action) ? l.action : 'repair' }));
  const incidentsOf = list => (Array.isArray(list) ? list : []).filter(x => x && text(x.name).trim()).map(x => ({ name: text(x.name).trim(), points: Math.max(1, Math.floor(num(x.points, 1))) }));
  const failuresOf = list => (Array.isArray(list) ? list : []).filter(x => x && text(x.name).trim()).map(x => ({ name: text(x.name).trim(), level: text(x.level).trim(), chance: num(x.chance, 0), seconds: num(x.seconds, 0) }));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  // a table that is not empty and not the one a new system starts with counts as changed
  const changedList = (rows, start) => rows.length > 0 && !same(rows, start);

  // ---------------------------------------------------------------- Penalty system
  const KIND_NAME = { drivethrough: 'Drivethrough', stopgo: 'Stop-and-Go' };
  const stepsText = P => P.steps.map(([p, s]) => `${p} = ${round(s)} s`);
  function penaltyOf(v) {
    const types = typesOf(v.types);
    const P = eng().penaltyConfig({ timeRule: v.timeRule, everyPoints: v.everyPoints, everySeconds: v.everySeconds, steps: v.steps, rules: v.rules, ruleMode: v.ruleMode, dqOn: v.dqOn, dqPoints: v.dqPoints, dqUnserved: v.dqUnserved, fuelPoints: v.fuelPoints, types });
    return { P, types, ms: n => eng().penaltyMs(P, n) };
  }
  // the points of the example "so 12 points are 10 seconds": two full blocks and a part of the next one
  const exampleOf = P => P.every * 2 + (P.every > 1 ? Math.floor(P.every / 2) : 0);

  function describePenalty(v) {
    const { P, ms } = penaltyOf(v), steps = P.mode === 'steps';
    if (Array.isArray(P.rules)) {
      const rows = P.rules, kinds = rows.reduce((a, r) => a + (r.time > 0 ? 1 : 0) + (r.laps > 0 ? 1 : 0) + (r.pit > 0 ? 1 : 0), 0);
      const pills = [{ text: rows.length ? `${plural(rows.length, 'point level', 'point levels')}` : 'No consequences yet', tone: 'hi' }];
      if (P.types.length) pills.push({ text: plural(P.types.length, 'special penalty', 'special penalties'), tone: '' });
      if (P.dq > 0) pills.push({ text: `Disqualified at ${pts(P.dq)}`, tone: '' });
      const say = rows.length ? [T('Every penalty adds '), B('one point'), T('. The highest point level reached is the total consequence: '), B(`${plural(rows.length, 'level', 'levels')}`), T(kinds ? ' can add time, deduct scoring laps or require a pit stop.' : ' are entered, but none changes the result yet.')] : [T('Every penalty adds '), B('one point'), T(', but no point consequence has been entered yet.')];
      if (P.types.length) say.push(T(' The Race Director also has '), B(plural(P.types.length, 'named special penalty', 'named special penalties')), T('.'));
      if (P.dq > 0) say.push(T(' A driver is '), B(`disqualified at ${pts(P.dq)}`), T('.'));
      if (P.dqUnserved) say.push(T(' An unserved mandatory penalty stop at the finish is '), B('a disqualification'), T('.'));
      if (P.fuelPoints > 0) say.push(T(' Every lap driven on an empty tank gives '), B(pts(P.fuelPoints)), T('.'));
      const note = rows.length ? { tone: 'info', parts: [B(`At ${pts(rows[0].from)}, the total is set by that row.`), T(' A later row replaces the earlier total, which makes escalating penalties predictable.')] } : null;
      return { pills, say, ready: text(v.name).trim() ? READY.ok : READY.name, notes: note ? { basics: note } : {}, strip: null };
    }
    const pills = [{ text: steps ? (P.steps.length ? `Time in ${plural(P.steps.length, 'step', 'steps')}` : 'No steps yet') : (P.every === 1 ? `Every point adds ${round(P.seconds)} s` : `Every ${P.every} points add ${round(P.seconds)} s`), tone: 'hi' }];
    if (P.types.length) pills.push({ text: plural(P.types.length, 'special penalty', 'special penalties'), tone: '' });
    if (P.dq > 0) pills.push({ text: `Disqualified at ${pts(P.dq)}`, tone: '' });
    const say = [];
    if (steps) {
      if (!P.steps.length) say.push(T('No steps are entered yet, so penalty points add '), B('no time'), T('.'));
      else if (P.steps.length <= 4) {
        const bits = P.steps.map(([p, s]) => [T('from '), B(pts(p)), T(' it is '), B(secs(s))]);
        say.push(T('Penalty points turn into time in steps: '));
        bits.forEach((b, i) => { say.push(...b); if (i < bits.length - 2) say.push(T(', ')); else if (i === bits.length - 2) say.push(T(' and ')); });
        say.push(T('. The highest step a driver has reached counts.'));
      } else {
        const a = P.steps[0], z = P.steps[P.steps.length - 1];
        say.push(T('Penalty points turn into time in '), B(`${P.steps.length} steps`), T(': from '), B(pts(a[0])), T(' it is '), B(secs(a[1])), T(', and from '), B(pts(z[0])), T(' it is '), B(secs(z[1])), T('. The highest step a driver has reached counts.'));
      }
    } else {
      say.push(T('Every '), B(P.every === 1 ? 'penalty point' : `${P.every} penalty points`), T(P.every === 1 ? ' adds ' : ' add '), B(secs(P.seconds)), T(' to the race time'));
      if (P.seconds > 0) { const ex = exampleOf(P); say.push(T(`, so ${pts(ex)} ${ex === 1 ? 'is' : 'are'} ${secs(ms(ex) / 1000)}`)); }
      say.push(T('.'));
    }
    if (P.types.length) {
      const kinds = ['drivethrough', 'stopgo'].filter(k => P.types.some(t => t.kind === k));
      say.push(T(' The Race Director can also give a '));
      kinds.forEach((k, i) => { if (i) say.push(T(' or a ')); say.push(B(KIND_NAME[k])); });
      say.push(T(` (${plural(P.types.length, 'special penalty', 'special penalties')}).`));
    }
    if (P.dq > 0) say.push(T(' A driver is '), B(`disqualified at ${pts(P.dq)}`), T(P.fuelPoints > 0 ? ', and every lap driven on an empty tank gives ' : '.'));
    else say.push(T(' A driver is '), B('never disqualified'), T(P.fuelPoints > 0 ? ' by points. Every lap driven on an empty tank gives ' : ' by points.'));
    if (P.fuelPoints > 0) say.push(B(pts(P.fuelPoints)), T('.'));
    // the note under the time rule
    let note = null;
    if (steps && P.steps.length) {
      const ex = (P.steps[1] || P.steps[0])[0] + 2;
      note = { tone: 'info', parts: [B(`${pts(ex)} ${ex === 1 ? 'is' : 'are'} ${secs(ms(ex) / 1000)}.`), T(` The highest step reached counts. Below ${pts(P.steps[0][0])} there is no time at all.`)] };
    } else if (!steps && P.seconds > 0) {
      const ex = exampleOf(P), left = P.every - 1;
      note = { tone: 'info', parts: [B(`${pts(ex)} ${ex === 1 ? 'is' : 'are'} ${secs(ms(ex) / 1000)}.`), T(P.every === 1 ? ' Every point adds the same time.' : ` Only full blocks of ${P.every} points count, so ${pts(left)} ${left === 1 ? 'is' : 'are'} no time at all and ${pts(P.every)} ${P.every === 1 ? 'is' : 'are'} ${secs(P.seconds)}.`)] };
    }
    return { pills, say, ready: text(v.name).trim() ? READY.ok : READY.name, notes: note ? { basics: note } : {}, strip: null };
  }

  function railPenalty(v, ctx) {
    const { P, types } = penaltyOf(v), start = typesOf((ctx.lists || {}).types), steps = P.mode === 'steps', named = text(v.name).trim() !== '', out = {};
    if (Array.isArray(P.rules)) {
      const r = P.rules, first = r[0], last = r[r.length - 1];
      out.basics = r.length ? entry(plural(r.length, 'point level', 'point levels'), `from ${first.from} point${first.from === 1 ? '' : 's'}${last !== first ? ` to ${last.from}` : ''}`, named ? 'ok' : 'todo') : entry('No consequence yet', 'penalty points are recorded only', 'plain');
      const list = types.slice(0, 3).map(t => t.name).join(', ') + (types.length > 3 ? ` and ${types.length - 3} more` : '');
      out.special = types.length ? entry(plural(types.length, 'special penalty', 'special penalties'), list, changedList(types, start) ? 'ok' : 'plain') : entry('None', 'no named special penalties', 'plain');
      const bits = [P.dq > 0 ? `Out at ${P.dq} points` : 'No point DQ', ...(P.dqUnserved ? ['unserved stop DQ'] : []), ...(P.fuelPoints > 0 ? [`empty tank ${P.fuelPoints}`] : [])];
      out.limits = entry(bits.join(' · '), `${P.dq > 0 ? `disqualified at ${pts(P.dq)}` : 'no point disqualification'}. ${P.fuelPoints > 0 ? `An empty tank gives ${pts(P.fuelPoints)} a lap` : 'An empty tank gives no points'}.`, P.dq > 0 || P.dqUnserved || P.fuelPoints > 0 ? 'ok' : 'plain');
      return out;
    }
    // Basics: how the points turn into time
    {
      const rail = P.every === 1 ? `Every point adds ${round(P.seconds)} s` : `Every ${P.every} points add ${round(P.seconds)} s`;
      const row = P.every === 1 ? `every point adds ${secs(P.seconds)}` : `every ${P.every} points add ${secs(P.seconds)}`;
      const short = P.steps.slice(0, 3).map(([p, s]) => `${p} = ${round(s)} s`).join(', ') + (P.steps.length > 3 ? ` and ${P.steps.length - 3} more` : '');
      out.basics = steps ? entry(P.steps.length ? plural(P.steps.length, 'step', 'steps') : 'No steps yet', P.steps.length ? `in steps: ${short}` : 'no steps entered yet', named && P.steps.length ? 'ok' : 'todo')
        : entry(rail, row, named ? 'ok' : 'todo');
    }
    // Special penalties: how many of each kind
    {
      const count = k => types.filter(t => t.kind === k).length, bits = ['drivethrough', 'stopgo'].filter(count).map(k => (count(k) === 1 ? KIND_NAME[k] : `${count(k)} ${KIND_NAME[k]}`));
      const list = types.slice(0, 3).map(t => t.name).join(', ') + (types.length > 3 ? ` and ${types.length - 3} more` : '');
      out.special = types.length ? entry(bits.join(' · '), `${plural(types.length, 'special penalty', 'special penalties')}: ${list}`, changedList(types, start) ? 'ok' : 'plain') : entry('None', 'no special penalties', 'plain');
    }
    // Disqualification and fuel
    {
      const rail = [P.dq > 0 ? `Out at ${P.dq} points` : 'Never out', ...(P.fuelPoints > 0 ? [`empty tank ${P.fuelPoints}`] : [])];
      out.limits = entry(rail.join(' · '), `${P.dq > 0 ? `disqualified at ${pts(P.dq)}` : 'nobody is disqualified by points'}. ${P.fuelPoints > 0 ? `An empty tank gives ${pts(P.fuelPoints)} a lap` : 'An empty tank gives no points'}.`, P.dq > 0 || P.fuelPoints > 0 ? 'ok' : 'plain');
    }
    return out;
  }

  // ---------------------------------------------------------------- Damage system
  const VERB = { repair: 'Repair', retire: 'Retires', dq: 'Disqualifies' };
  function damageOf(v) {
    const levels = levelsOf(v.levels), incidents = incidentsOf(v.incidents), failures = failuresOf(v.failures);
    const D = dmg().clean({ stop: v.stop, deslotPoints: v.deslotPoints, latePoints: v.latePoints, earlyPoints: v.earlyPoints, failuresOn: v.failuresOn, failFrom: v.failFrom, failTo: v.failTo, failMax: v.failMax, levels, incidents, failures }, 0);
    return { D, levels, incidents, failures, on: v.failuresOn === 'on' };
  }
  // one sentence about a level; the first level of the system and the last one are told
  function levelSay(l, first) {
    const act = l.action === 'retire' ? 'retires' : 'disqualifies';
    if (l.action !== 'repair') return first ? [T('From '), B(pts(l.from)), T(', '), B(l.name), T(' '), B(act), T(' the car.')] : [T('At '), B(pts(l.from)), T(', '), B(l.name), T(' '), B(act), T(' the car.')];
    if (!first) return [T('At '), B(pts(l.from)), T(', '), B(l.name), T(l.seconds > 0 ? ' needs a repair of ' : ' needs a repair'), ...(l.seconds > 0 ? [B(secs(l.seconds))] : []), T('.')];
    return [T('From '), B(pts(l.from)), T(' the car needs a '), B(l.name), T(' repair: it '), ...(l.seconds > 0 ? [T('stands still on the sensor in the pits for '), B(secs(l.seconds))] : [T('must stop on the sensor in the pits')]), T('.')];
  }
  // the bar of the levels: from 0 damage points to a little past the last level, a part for every level and the stretch before the first one; ticks at the starts
  function stripOf(L) {
    if (!L.length) return null;
    const last = L[L.length - 1].from, total = last + Math.max(1, Math.round(last / 6));
    const marks = [{ name: 'No stop', from: 0, kind: 'none' }, ...L.map(l => ({ name: l.name, from: l.from, kind: l.action }))];
    const parts = marks.map((m, i) => ({ name: m.name, from: m.from, kind: m.kind, left: round(m.from / total * 100), width: round(((i < marks.length - 1 ? marks[i + 1].from : total) - m.from) / total * 100), step: i, of: marks.length }));
    // the numbers under it; one that would sit on the one before it is left out, and the last one says what the numbers are
    const ticks = parts.map(p => ({ at: p.left, label: String(p.from), show: true }));
    ticks[ticks.length - 1].label = `${last} damage points`;
    let shown = -100;
    ticks.forEach((t, i) => { const need = i === ticks.length - 1 ? 14 : 4; if (t.at - shown >= need) shown = t.at; else if (i === ticks.length - 1) { const prev = ticks.slice(0, i).reverse().find(x => x.show); if (prev) prev.show = false; } else t.show = false; });
    return { parts, ticks, text: `Damage levels from 0 to ${last} damage points: ${parts.map(p => `${p.name} from ${p.from}`).join(', ')}.` };
  }

  function describeDamage(v) {
    const { D, levels, incidents, failures, on } = damageOf(v), L = D.levels, nFail = failures.length;
    const pills = [{ text: L.length ? `${VERB[L[0].action]} from ${pts(L[0].from)}` : 'No levels', tone: 'hi' }];
    if (L.length) pills.push({ text: plural(L.length, 'level', 'levels'), tone: '' });
    pills.push({ text: incidents.length ? plural(incidents.length, 'incident', 'incidents') : 'No incidents', tone: '' });
    pills.push({ text: on ? (nFail ? plural(nFail, 'car failure', 'car failures') : 'Car failures on') : 'Car failures off', tone: '' });
    const say = [];
    if (D.deslotPoints > 0) say.push(T('A deslot gives a car '), B(plural(D.deslotPoints, 'damage point', 'damage points')), T('.'));
    else say.push(T('A deslot gives a car '), B('no damage'), T('.'));
    if (L.length) {
      say.push(T(' '), ...levelSay(L[0], true));
      if (L.length > 1) say.push(T(' '), ...levelSay(L[L.length - 1], false));
      if (L.some(l => l.action === 'repair')) say.push(T(' The repair and the other work in the stop happen '), B(D.stop === 'add' ? 'one after the other' : 'at the same time'), T(D.stop === 'add' ? ', so the repair starts when the other work is done.' : ', so the longest job counts.'));
    } else say.push(T(' There are no levels yet, so no stop in the pits repairs or ends anything.'));
    if (!on) say.push(T(' Car failures are '), B('off'), T('.'));
    else if (D.failures) say.push(T(' Car failures are '), B('on'), T(': '), B(plural(nFail, 'failure', 'failures')), T(' can strike a car, at most '), B(String(D.failures.max)), T(' in a race, somewhere between '), B(`${D.failures.from}%`), T(' and '), B(`${D.failures.to}%`), T(' of it.'));
    else say.push(T(' Car failures are '), B('on'), T(', but no failures are listed yet.'));
    return { pills, say, ready: text(v.name).trim() ? READY.ok : READY.name, notes: {}, strip: stripOf(L) };
  }

  function railDamage(v, ctx) {
    const { D, levels, incidents, failures, on } = damageOf(v), lists = ctx.lists || {}, L = D.levels, out = {}, named = text(v.name).trim() !== '';
    const defs = ctx.defaults || {}, late0 = num(defs.latePoints, 1), early0 = num(defs.earlyPoints, 1);
    // Basics: the stop and the deslot
    {
      const stop = D.stop === 'add' ? 'One after the other' : 'At the same time', deslot = D.deslotPoints > 0 ? `deslot ${pts(D.deslotPoints)}` : 'no damage for a deslot';
      out.basics = entry(`${stop} · ${deslot}`, `${stop.toLowerCase()}, ${deslot}`, named ? 'ok' : 'todo');
    }
    // Levels
    out.levels = L.length ? entry(`${plural(L.length, 'level', 'levels')} from ${pts(L[0].from)}`, L.length === 1 ? `1 level, from ${pts(L[0].from)}` : `${L.length} levels, from ${pts(L[0].from)} up to ${pts(L[L.length - 1].from)}`, changedList(levels, levelsOf(lists.levels)) ? 'ok' : 'plain')
      : entry('No levels', 'no levels yet: damage points are counted, but no stop repairs or ends anything', 'plain');
    // Incidents
    {
      const n = names(incidents);
      out.incidents = n.length ? entry(n.slice(0, 3).join(' · ') + (n.length > 3 ? ` · +${n.length - 3}` : ''), `${plural(n.length, 'incident', 'incidents')}: ${joinAnd(n.slice(0, 4), 'and')}${n.length > 4 ? ` and ${n.length - 4} more` : ''}`, changedList(incidents, incidentsOf(lists.incidents)) ? 'ok' : 'plain')
        : entry('None', 'no incidents: the Race Director has only the plus and minus buttons', 'plain');
    }
    // Car failures
    out.failures = on ? entry(failures.length ? `On · ${plural(failures.length, 'failure', 'failures')}` : 'On · none listed', D.failures ? `on: ${plural(failures.length, 'failure', 'failures')}, between ${D.failures.from}% and ${D.failures.to}% of the race, at most ${D.failures.max} for a car` : 'on, but no failures are listed yet', 'ok')
      : entry('Off', 'off. Failures that strike a car at random during a race', 'plain');
    // Penalty points
    out.fines = entry(`Late ${D.latePoints} · too early ${D.earlyPoints}`, `${pts(D.latePoints)} for every lap after the deadline of a level, ${pts(D.earlyPoints)} for leaving before the repair is done`, D.latePoints !== late0 || D.earlyPoints !== early0 ? 'ok' : 'plain');
    return out;
  }

  // ---------------------------------------------------------------- Weather system (1.74.0)
  // The numbers are the ones the race uses (weather.js, clean), so the words say what the race will do, also for a setting that is empty or wrong.
  const UNITS = { laps: ['lap', 'laps'], time: ['minute', 'minutes'] };
  function weatherOf(v) {
    const W = wx().clean(v, 0), u = UNITS[W.unit], laps = W.unit === 'laps';
    const amount = n => plural(round(n), u[0], u[1]); // 8 laps, 1 lap, 1.5 minutes
    const span = (a, b) => (a === b ? amount(a) : `${round(a)}–${amount(b)}`); // 5–12 laps
    const between = (a, b) => (a === b ? amount(a) : `${round(a)} and ${amount(b)}`); // 5 and 12 laps
    // a range with the same number at both ends is not random (the race draws that number every time)
    const rs = W.start.mode === 'random' && W.start.from !== W.start.to, rr = W.rain.mode === 'random' && W.rain.min !== W.rain.max, director = W.start.mode === 'director';
    return { W, laps, amount, span, between, random: rs || rr, rs, rr, director };
  }
  // the bar of the weather over the race: Dry, Cloudy, Wet, Clearing, Dry, as long as the numbers say (a random moment or length is drawn in the middle)
  function stripWeather(o) {
    const { W, laps, random } = o;
    if (o.director) return { parts: [], ticks: [], message: 'No forecast: the Race Director sets the weather with the buttons.', text: 'The Race Director sets the weather.' };
    const S = W.start, R = W.rain, mid = (a, b) => (a + b) / 2;
    const plan = wx().plan({ ...W, start: { mode: 'point', at: S.mode === 'random' ? mid(S.from, S.to) : S.at }, rain: { mode: 'fixed', for: R.mode === 'random' ? mid(R.min, R.max) : R.for } }, 0);
    const inUnit = a => (laps ? a : Math.round(a / 600) / 100); // (the minutes of a plan are milliseconds)
    const stages = plan.stages.map(s => ({ state: s.state, from: inUnit(s.at) }));
    if (stages[0].from > 0) stages.unshift({ state: 'dry', from: 0 });
    const lastAt = stages[stages.length - 1].from, tail = laps ? Math.max(1, Math.round(lastAt / 4)) : Math.max(0.5, round(lastAt / 4)), total = lastAt + tail;
    const parts = stages.map((s, i) => ({ name: wx().stateName(s.state), kind: s.state, from: s.from, left: round(s.from / total * 100), width: round(((i < stages.length - 1 ? stages[i + 1].from : total) - s.from) / total * 100) }));
    const ticks = parts.map(p => ({ at: p.left, label: String(round(p.from)), show: true }));
    let shown = -100; ticks.forEach(t => { if (t.at - shown >= 5) shown = t.at; else t.show = false; });
    return { parts, ticks, tone: 'weather', center: true, unit: laps ? 'laps of the leader' : 'minutes of racing', note: random ? 'A random moment or length is drawn in the middle here. Every race draws its own.' : '',
      text: `The weather over the race, in ${laps ? 'laps of the leader' : 'minutes of racing'}: ${parts.map(p => `${p.name} from ${round(p.from)}`).join(', ')}.` };
  }

  function describeWeather(v) {
    const o = weatherOf(v), { W, laps, amount, span, between, random, rs, rr, director } = o, S = W.start, R = W.rain;
    const pills = [{ text: director ? 'The Race Director decides' : S.mode === 'random' ? `Rain after ${span(S.from, S.to)}` : S.at > 0 ? `Rain after ${amount(S.at)}` : 'Rain from the start', tone: 'hi' }];
    if (!director) pills.push({ text: R.mode === 'random' ? `Lasts ${span(R.min, R.max)}` : `Lasts ${amount(R.for)}`, tone: '' });
    if (!director) pills.push({ text: `Counted in ${laps ? 'laps' : 'minutes'}`, tone: '' });
    if (!director) pills.push({ text: random && !W.same ? 'New weather in every heat' : 'Same in every heat', tone: '' });
    const say = [];
    if (director) say.push(T('The weather changes '), B('only when the Race Director says so'), T(': he sets Dry, Cloudy, Wet or Clearing with the buttons on the Director page, so the numbers for a forecast are not used.'));
    else {
      say.push(T('The weather is counted in '), B(laps ? 'laps' : 'minutes'), T(laps ? ' of the leader. ' : ' of racing. '));
      if (rs) say.push(T('The rain starts at a random moment between '), B(between(S.from, S.to)));
      else if (S.mode === 'random') say.push(T('The rain starts after '), B(amount(S.from)));
      else if (S.at > 0) say.push(T('The rain starts after '), B(amount(S.at)));
      else say.push(T('The rain starts '), B('at the start of the race'));
      if (rr) say.push(T(' and lasts a random time between '), B(between(R.min, R.max)));
      else say.push(T(' and lasts '), B(amount(R.mode === 'random' ? R.min : R.for)));
      if (W.cloudy > 0 && W.clearing > 0) say.push(T(', with '), B(amount(W.cloudy)), T(' of cloud before it and '), B(amount(W.clearing)), T(' of clearing after it.'));
      else if (W.cloudy > 0) say.push(T(', with '), B(amount(W.cloudy)), T(' of cloud before it and no clearing after it.'));
      else if (W.clearing > 0) say.push(T(', with no cloud before it and '), B(amount(W.clearing)), T(' of clearing after it.'));
      else say.push(T(', with no cloud before it and no clearing after it.'));
      say.push(T(' Every heat '), ...(random && !W.same ? [T('gets '), B('new random weather')] : [T('has '), B('the same weather')]), T('.'));
    }
    // the tyres: how long a car has to change, and what staying on the wrong ones costs
    say.push(T(W.react === 0 ? ' A car has to change tyres ' : ' A car has '), B(W.react === 0 ? 'at once' : plural(W.react, 'lap', 'laps')), T(W.react === 0 ? ' when the weather asks for it' : ' to change tyres when the weather asks for it'));
    const rep = W.repeat === 'every' ? 'every lap' : 'once', wp = W.wetPoints, dp = W.dryPoints, onDry = ' for staying on dry tyres in the rain', onWet = ' for staying on wet tyres when the track is dry again';
    if (wp === 0 && dp === 0) say.push(T(', but staying on the wrong ones costs '), B('no points'), T('.'));
    else if (wp === dp) say.push(T(', and gets '), B(ppts(wp)), T(', '), B(rep), T(', for staying on the wrong ones.'));
    else if (wp > 0 && dp > 0) say.push(T(', and gets '), B(ppts(wp)), T(onDry + ' and '), B(ppts(dp)), T(onWet + ', '), B(rep), T('.'));
    else say.push(T(', and gets '), B(ppts(wp > 0 ? wp : dp)), T(wp > 0 ? onDry : onWet), T(', '), B(rep), T(' (the other costs no points).'));
    // the hindrance
    if (!W.hinder) say.push(T(' The wrong tyres '), B('do not hinder'), T(' the cars.'));
    else {
      const lv = [W.levers.use && 'use more fuel', W.levers.rate && 'refuel slower', W.levers.tank && 'have a smaller tank'].filter(Boolean);
      if (!lv.length) say.push(T(' The wrong tyres hinder '), B('nothing'), T(' (all three ways are off).'));
      else { say.push(T(' The wrong tyres also make a car ')); lv.forEach((x, i) => { if (i) say.push(T(i === lv.length - 1 ? ' and ' : ', ')); say.push(B(x)); }); say.push(T('.')); }
    }
    return { pills, say, ready: text(v.name).trim() ? READY.ok : READY.name, notes: {}, strip: stripWeather(o) };
  }

  function railWeather(v, ctx) {
    const o = weatherOf(v), { W, laps, amount, span, director } = o, S = W.start, R = W.rain, out = {}, named = text(v.name).trim() !== '';
    const d = ctx.defaults || wx().DEFAULTS, X = wx();
    // a setting that is typed and is not the standard one (an empty box counts as the standard, as the race does)
    const changed = keys => keys.some(k => { const a = text(v[k]).trim(), b = text(d[k]).trim(); return a !== '' && num(a, a) !== num(b, b); });
    // Basics
    out.basics = entry(`Counted in ${laps ? 'laps' : 'minutes'}`, `counted in ${laps ? 'laps of the leader' : 'minutes of racing'}`, named ? 'ok' : 'todo');
    // The rain
    {
      const first = director ? '' : S.mode === 'random' ? `after ${span(S.from, S.to)}` : S.at > 0 ? `after ${amount(S.at)}` : 'from the start';
      const len = director ? '' : R.mode === 'random' ? `lasts ${span(R.min, R.max)}` : `lasts ${amount(R.for)}`;
      out.forecast = entry(director ? 'Race Director decides' : `${cap(first)} · ${len}`, director ? 'the Race Director sets the weather with the buttons' : `${first === 'from the start' ? 'the rain is there from the start' : `the rain starts ${first}`} and ${len}, ${W.cloudy > 0 ? amount(W.cloudy) : 'no'} of cloud before and ${W.clearing > 0 ? amount(W.clearing) : 'no'} of clearing after`,
        changed(['startMode', 'startAt', 'startFrom', 'startTo', 'rainMode', 'rainFor', 'rainMin', 'rainMax', 'cloudyFor', 'clearingFor', 'sameInHeats']) ? 'ok' : 'plain');
    }
    // Tyres and penalties
    {
      const tyreOf = k => (k === 'inter' ? 'Intermediate' : 'Wet'), pen = W.wetPoints === W.dryPoints ? (W.wetPoints > 0 ? `${ppts(W.wetPoints)}, ${W.repeat === 'every' ? 'every lap' : 'once'}` : 'no penalty points') : `${ppts(W.wetPoints)} for Wet, ${ppts(W.dryPoints)} for dry, ${W.repeat === 'every' ? 'every lap' : 'once'}`;
      const rail = W.wetPoints === W.dryPoints ? (W.wetPoints > 0 ? `Wet ${pts(W.wetPoints)} · dry ${pts(W.dryPoints)}` : 'No penalty points') : `Wet ${pts(W.wetPoints)} · dry ${pts(W.dryPoints)}`;
      out.tyres = entry(rail, `${W.cloudyTyre === 'inter' && W.clearingTyre === 'inter' ? 'a pit stop in Cloudy or Clearing gives Intermediate tyres' : `a pit stop in Cloudy gives ${tyreOf(W.cloudyTyre)} tyres, in Clearing ${W.clearingTyre === 'inter' ? 'Intermediate tyres' : 'the dry tyres'}`}. ${W.react === 0 ? 'Change at once' : `${plural(W.react, 'lap', 'laps')} to change`}. ${cap(pen)}.`,
        changed(['cloudyTyre', 'clearingTyre', 'react', 'wetPoints', 'dryPoints', 'repeat']) ? 'ok' : 'plain');
    }
    // Hindering the cars
    {
      const table = Object.values(X.HKEYS), lv = [W.levers.use && 'use more fuel', W.levers.rate && 'refuel slower', W.levers.tank && 'have a smaller tank'].filter(Boolean);
      const worst = Math.max(0, ...X.STATES.map(([s]) => Math.max(...X.CLASSES.map(c => W.table[s][c]))));
      out.hinder = entry(W.hinder ? 'Wrong tyres hinder: yes' : 'Wrong tyres hinder: no', W.hinder ? (lv.length ? `the wrong tyres make a car ${joinAnd(lv, 'and')} (up to ${worst}% hindered)` : 'switched on, but all three ways are off') : 'the wrong tyres do not hinder a car',
        changed(['hinder', 'hUse', 'hRate', 'hTank', ...table]) ? 'ok' : 'plain');
    }
    // Track conditions
    {
      const imp = W.cond.units === 'imperial', c = W.cond.dry;
      out.conditions = entry(imp ? 'Fahrenheit · mph' : 'Celsius · km/h', `${imp ? 'degrees Fahrenheit and miles per hour' : 'degrees Celsius and km/h'}. Dry: track ${c.track}°, air ${c.air}°, wind ${c.wind} ${imp ? 'mph' : 'km/h'}`,
        changed(['units', ...Object.values(X.CKEYS)]) ? 'ok' : 'plain');
    }
    return out;
  }

  // ---------------------------------------------------------------- Tyre wear system (1.75.0)
  // The numbers are the ones the race uses (tyrewear.js, clean), so the words say what the race will do, also for a box that is empty or wrong. v holds the settings of the form and the three tables as the form
  // holds them while they are edited (tyres, mult, sets), and disp: 'm' or 'ft' (the distance unit of the app, which a system that counts per distance speaks in).
  const tw = () => (typeof module !== 'undefined' ? require('./tyrewear.js') : root.TyreWear);
  const SLICKS = ['H', 'S', 'SS']; // (the tyres that the sentence names: Hard, Soft and Supersoft; the others are in the table)
  function tyreWearOf(v) {
    const TW = tw().withTyres(v.tyres), X = wx().withTyres(v.tyres), disp = v.disp === 'ft' ? 'ft' : 'm', C = TW.clean(v, { disp }), dist = C.unit === 'distance';
    const allowed = TW.CODES.filter(c => C.sets.mode === 'none' || C.sets.n[c] > 0), nameOf = c => X.tyreOf(c).name;
    const named = SLICKS.filter(c => allowed.includes(c)), shown = named.length ? named : allowed.slice(0, 3);
    const lasts = c => (C.tyres[c].wear > 0 ? TW.lastsText(C.unit, disp, C.tyres[c].wear) : ''); // ('' = this tyre does not wear)
    const calls = C.calls, where = C.practice && C.qualifying ? 'races, practice and qualifying' : C.practice ? 'races and practice' : C.qualifying ? 'races and qualifying' : 'races only';
    return { TW, X, C, disp, dist, allowed, shown, nameOf, lasts, calls, where, per: dist ? `per 100 ${disp}` : 'per lap' };
  }
    // bold words in a list: a, b and c
  const boldList = (list, word) => { const out = []; list.forEach((x, i) => { if (i) out.push(T(i === list.length - 1 ? ` ${word || 'and'} ` : ', ')); out.push(B(x)); }); return out; };
  const zeroPill = C => (C.zero === 'points' ? (C.zeroPoints > 0 ? `At 0%: ${plural(C.zeroPoints, 'point', 'points')} a lap` : 'At 0%: no points') : C.zero === 'lap' ? 'At 0%: lap does not count' : C.zero === 'retire' ? 'At 0%: car retires' : 'At 0%: nothing happens');

  function describeTyreWear(v) {
    const o = tyreWearOf(v), { TW, C, allowed, shown, nameOf, lasts } = o, m = C.mand;
    const pills = [{ text: `Wear ${o.per}`, tone: 'hi' }, { text: plural(allowed.length, 'tyre', 'tyres'), tone: '' }, { text: C.changeMs > 0 ? `Change takes ${round(C.changeMs / 1000)} s` : 'Change takes no time', tone: '' }, { text: zeroPill(C), tone: '' }];
    if (m) pills.push({ text: [m.stops > 0 && plural(m.stops, 'mandatory stop', 'mandatory stops'), m.two && 'Two dry tyres'].filter(Boolean).join(' · '), tone: '' });
    const say = [T('Wear is counted '), B(o.per), T(`, in ${o.where}.`)];
    if(C.temperature)say.push(T(' Simulated tyre temperature adds wear outside each compound’s working range.'));
    // what a new set lasts, for the tyres that are named
    if (shown.length) {
      shown.forEach((c, i) => {
        const l = lasts(c);
        if (i === 0) say.push(T(' A new '), B(nameOf(c)), T(l ? ' tyre lasts about ' : ' tyre '), B(l || 'does not wear'));
        else say.push(T(i === shown.length - 1 ? ' and a ' : ', a '), B(nameOf(c)), T(l ? ' about ' : ' '), B(l || 'does not wear'));
      });
      say.push(T('.'));
    }
    if (C.pace && C.pace.on) say.push(T(' The Tyre Wear calculation selected in App Settings supplies the '), B('pace benchmark'), T(': a faster lap wears more, a slower lap wears less. The effect is '), B(C.pace.strength), T('.'));
    else say.push(T(' Tyres wear the same amount on every valid lap; '), B('pace-sensitive wear is off'), T('.'));
    // what worn tyres do: the fuel levers, and what happens at 0%
    const lv = [C.levers.use && 'the fuel use', C.levers.rate && 'the refuelling speed', C.levers.tank && 'the size of the tank'].filter(Boolean);
    const zero = C.zero === 'points' ? (C.zeroPoints > 0 ? [T('a car gets '), B(ppts(C.zeroPoints)), T(' every lap')] : [T('a car gets '), B('no penalty points')])
      : C.zero === 'lap' ? [T('the lap '), B('does not count'), T(' until the car has been in the pits for new tyres')] : C.zero === 'retire' ? [T('the car '), B('retires')] : [B('nothing'), T(' happens, the tyres are only shown as worn out')];
    if (!C.effect) say.push(T(' Worn tyres '), B('do not change'), T(' the car, and at '), B('0%'), T(' '), ...zero, T('.'));
    else if (!lv.length) say.push(T(' Worn tyres hinder '), B('nothing'), T(' (all three ways are off), and at '), B('0%'), T(' '), ...zero, T('.'));
    else say.push(T(' Worn tyres hinder the car through '), ...boldList(lv), T(', and at '), B('0%'), T(' '), ...zero, T('.'));
    // the pit stop
    if (C.changeMs > 0) say.push(T(' Changing tyres takes '), B(secs(C.changeMs / 1000)), T(', '), B(C.stop === 'add' ? 'one after the other' : 'at the same time'), T(C.stop === 'add' ? ' with the other work in the stop.' : ' as the other work in the stop.'));
    else say.push(T(' Changing tyres takes '), B('no time'), T(': the new set is on when the stop starts.'));
    // the mandatory stops, when there are any
    if (m) {
      const what = [m.stops > 0 && plural(m.stops, 'stop', 'stops') + ' for tyres', m.two && 'two different dry tyres'].filter(Boolean);
      const pen = m.penalty === 'time' ? [T('gets '), B(secs(m.seconds)), T(' added to its race time')] : m.penalty === 'points' ? [T('gets '), B(ppts(m.points))] : m.penalty === 'dq' ? [T('is '), B('disqualified')] : [T('is '), B('only noted'), T(' in the results')];
      say.push(T(' Every car must make '), ...boldList(what), T(' by the finish; one that does not '), ...pen, T('.'));
    }
    // the sets, when they are not the standard ones (as in the design, a system with the standard sets does not say so: the rail says it)
    if (C.sets.mode === 'none') say.push(T(' The sets are '), B('not limited'), T(': every stop gives a fresh set of the same tyre.'));
    else if (!(C.sets.mode === 'car' && same(C.sets.n, TW.DEFAULT_SETS))) {
      const have = allowed.map(c => `${C.sets.n[c]} ${nameOf(c)}`), out = TW.CODES.filter(c => !allowed.includes(c)).map(nameOf);
      say.push(T(C.sets.mode === 'team' ? ' The team shares its sets of tyres: ' : ' Each car has its own sets of tyres: '), ...(have.length ? boldList(have) : [B('none')]), T(out.length ? `. ${joinAnd(out, 'and')} ${out.length === 1 ? 'is' : 'are'} not allowed in the race.` : '.'));
    }
    // the warnings
    say.push(T(' The widgets turn amber at '), B(`${C.warn}%`), T(' life left and red at '), B(`${C.crit}%`), T('.'));
    const notes = { basics: { tone: 'info', parts: [T('A race, a timed race, heats and an Endurance Race always have tyre wear when the race setup has this system. A Time Token Session never does.')] } };
    if (C.crit > C.warn) notes.warn = { tone: 'warn', parts: [T('The critical (red) level, '), B(`${C.crit}%`), T(', is higher than the warning (amber) level, '), B(`${C.warn}%`), T('. Red has to be at or below amber, or the system cannot be saved.')] };
    return { pills, say, ready: !text(v.name).trim() ? READY.name : C.crit > C.warn ? READY.levels : READY.ok, notes, strip: null }; // (the form does not save a red level above the amber one)
  }

  function railTyreWear(v, ctx) {
    const o = tyreWearOf(v), { TW, C, allowed, shown, nameOf, lasts } = o, out = {}, named = text(v.name).trim() !== '';
    const d = ctx.defaults || {}, d0 = TW.DEFAULTS;
    // a setting that is typed and is not the standard one (an empty box counts as the standard, as the race does)
    const changed = keys => keys.some(k => { const a = text(v[k]).trim(), b = text(d[k] !== undefined ? d[k] : d0[k]).trim(); return a !== '' && num(a, a) !== num(b, b); });
    // Basics
    out.basics = entry(`${o.dist ? 'Per distance' : 'Per lap'} · ${C.practice || C.qualifying ? (C.practice && C.qualifying ? 'race, practice, qualifying' : C.practice ? 'race and practice' : 'race and qualifying') : 'race only'}`,
      `wear is counted ${o.per}, in ${o.where}`, named ? 'ok' : 'todo');
    // The tyres
    {
      const pk = TW.presetOf(v.tyres), nm = pk ? TW.PRESETS[pk].name : 'Own numbers', bits = shown.map(c => (lasts(c) ? `${nameOf(c)} lasts about ${lasts(c)}` : `${nameOf(c)} does not wear`));
      out.tyres = entry(`${nm} · ${plural(allowed.length, 'tyre', 'tyres')}`, `${pk ? `${nm} numbers` : 'your own numbers'} for ${plural(allowed.length, 'tyre', 'tyres')}${bits.length ? ': ' + bits.join(', ') : ''}`, pk === 'standard' ? 'plain' : 'ok');
    }
    out.temperature = entry(C.temperature ? 'Simulated temperature on' : 'Off', 'Cold or hot tyres add wear; pits and neutralisations cool tyres.', C.temperature ? 'ok' : 'plain');
    out.pace = entry(C.pace && C.pace.on ? `Pace benchmark · ${cap(C.pace.strength)}` : 'Fixed wear', C.pace && C.pace.on ? `after the configured sample requirement, faster than the selected benchmark wears more and slower wears less (${C.pace.strength})` : 'every valid lap uses the same wear', changed(['paceWear', 'paceStrength']) ? 'ok' : 'plain');
    // What worn tyres do
    {
      const lv = [C.levers.use && 'fuel use', C.levers.rate && 'refuelling', C.levers.tank && 'tank'].filter(Boolean), z = C.zero === 'points' ? (C.zeroPoints > 0 ? plural(C.zeroPoints, 'point', 'points') : 'no points') : C.zero === 'lap' ? 'lap lost' : C.zero === 'retire' ? 'retires' : 'nothing';
      out.effect = entry(`${C.effect ? 'Fuel rules' : 'No fuel rules'} · 0%: ${z}`, `${C.effect ? (lv.length ? `worn tyres hinder the car through ${joinAnd(lv, 'and')}` : 'switched on, but all three ways are off') : 'worn tyres do not change the car'}. At 0%: ${C.zero === 'points' ? (C.zeroPoints > 0 ? `${ppts(C.zeroPoints)} every lap` : 'no penalty points') : C.zero === 'lap' ? 'the lap does not count until the car pits' : C.zero === 'retire' ? 'the car retires' : 'nothing happens'}`,
        changed(['effect', 'eUse', 'eRate', 'eTank', 'zero', 'zeroPoints']) ? 'ok' : 'plain');
    }
    // Pit stops
    out.pit = entry(C.changeMs > 0 ? `${round(C.changeMs / 1000)} s · ${C.stop === 'add' ? 'one after the other' : 'with other work'}` : 'No time to change', C.changeMs > 0 ? `changing tyres takes ${secs(C.changeMs / 1000)}, ${C.stop === 'add' ? 'one after the other with' : 'at the same time as'} the other work in the stop` : 'changing tyres takes no time',
      changed(['changeSeconds', 'stop']) ? 'ok' : 'plain');
    // Wear in the weather
    {
      const std = same(TW.cleanMult(v.mult), TW.cleanMult(TW.MULT));
      out.weather = entry(std ? 'Standard numbers' : 'Own numbers', `${std ? 'the standard numbers' : 'your own numbers'} for how much faster or slower a tyre wears in dry, cloudy, wet and clearing weather (only used in a race with a weather system)`, std ? 'plain' : 'ok');
    }
    // Mandatory stops
    {
      const m = C.mand, what = m ? [m.stops > 0 && plural(m.stops, 'stop', 'stops'), m.two && 'two tyres'].filter(Boolean).join(' · ') : '';
      out.mand = entry(m ? what : 'None', m ? TW.mandText(m).replace(/^Mandatory: /, '') : 'none: no stop for tyres is needed to finish', m ? 'ok' : 'plain');
    }
    // Sets of tyres
    {
      const mode = C.sets.mode, std = mode === d0.setsMode && same(TW.cleanSets(v.sets), TW.DEFAULT_SETS);
      out.sets = entry(mode === 'car' ? 'Each car has its own' : mode === 'team' ? 'The team shares them' : 'No limit', mode === 'none' ? 'no limit: every stop gives a fresh set of the same tyre' : `${mode === 'team' ? 'the team shares' : 'each car has its own'} sets of tyres (${allowed.map(c => `${C.sets.n[c]} ${nameOf(c)}`).join(', ') || 'none'})`, std ? 'plain' : 'ok');
    }
    // Warnings
    {
      const std = C.warn === d0.warn && C.crit === d0.crit && same(C.calls, TW.cleanCalls(null)), cl = C.calls.map(n => `${n}%`);
      out.warn = entry(`Amber ${C.warn}% · red ${C.crit}%`, `amber at ${C.warn}% life left, red at ${C.crit}%. ${cl.length ? `The audio set speaks at ${joinAnd(cl, 'and')}` : 'The audio set says nothing about the tyres'}`, C.crit > C.warn ? 'todo' : std ? 'plain' : 'ok');
    }
    return out;
  }

  // ---------------------------------------------------------------- Safety car system (1.76.0)
  // The numbers are the ones the race uses (safetycar.js, clean), so the words say what the race will do, also for a box that is empty or wrong.
  const scar = () => (typeof module !== 'undefined' ? require('./safetycar.js') : root.SafetyCar);
  const flagsNone = rn => (rn.mode === 'range' ? rn.max === 0 : rn.min === 0 && !(rn.mode === 'atleast' && rn.more > 0)); // (the chance is there, but no flag is drawn)
  const FLAG_COUNT = rn => (rn.mode === 'range' ? [B(`${rn.min} to ${rn.max} flags`)] : rn.mode === 'atleast' && rn.more > 0 ? [B(`at least ${plural(rn.min, 'flag', 'flags')}`)] : [T('exactly '), B(plural(rn.min, 'flag', 'flags'))]); // (no flag at all is told before this, by flagsNone)
  // the bar "Where in the race a flag can come": a part without flags, the part with them, a part without flags (the ticks are left out where they would run into each other)
  function stripSafetyCar(rn) {
    if (!rn) return null;
    const a = round(rn.from), b = round(rn.to);
    if (rn.chance <= 0 || flagsNone(rn)) return { parts: [], ticks: [], text: 'No race gets a flag', message: 'No race gets a flag.' }; // (on, but the chance or the number is 0)
    if (!(b > a)) return { parts: [], ticks: [], text: `A flag can only come at ${a}% of the race`, message: `A flag can only come at ${a}% of the race.` };
    const parts = [];
    if (a > 0) parts.push({ name: 'No flags', left: 0, width: a, kind: 'none', step: 1, of: 2 });
    parts.push({ name: 'Random flags can come here', left: a, width: round(b - a), kind: 'flags', step: 2, of: 2 });
    if (b < 100) parts.push({ name: 'No flags', left: b, width: round(100 - b), kind: 'none', step: 1, of: 2 });
    const want = [0, 100, a, b].filter((x, i, l) => l.indexOf(x) === i), keep = [];
    want.forEach(at => { if (keep.every(k => Math.abs(k - at) >= 8)) keep.push(at); }); // (a number that would run into another one is left out)
    return { parts, ticks: [0, a, b, 100].filter((x, i, l) => l.indexOf(x) === i).map(at => ({ at, label: `${at}%`, show: keep.includes(at), end: at === 100 })), text: `Random flags can come between ${a}% and ${b}% of the race` };
  }
  function describeSafetyCar(v, ctx) {
    const SC = scar(), C = SC.clean(v), rn = C.rnd, track = ctx && ctx.track;
    const pills = [{ text: C.target > 0 ? `Laps slower than ${SC.secText(C.target)}` : 'No limit on lap times', tone: 'hi' }, { text: C.pit > 0 ? `Pit work ${C.pit}% shorter` : 'Pit work as usual', tone: '' }];
    if (rn) pills.push({ text: 'Random flags on', tone: '' });
    const say = [T('The Safety Car is out while the yellow flag is up, including a yellow Track Call.')];
    if (C.target > 0) say.push(T(' Cars must drive laps '), B(`slower than ${secs(C.target / 1000)}`), T(C.points > 0 ? ', and a lap that is too fast gives ' : ', and a lap that is too fast is '), B(C.points > 0 ? ppts(C.points) : 'only called out'), T('.'));
    else say.push(T(' There is '), B('no limit'), T(' on the lap time.'));
    say.push(T(' The work in a pit stop takes '), B(C.pit > 0 ? `${C.pit}% less time` : 'as long as usual'), T('.'));
    if (track && text(track.name).trim()) say.push(T(' The reference Track is '), B(text(track.name).trim()), T(Number(track.targetLap) > 0 ? ` (${secs(Number(track.targetLap))})` : ', which has no reference lap time yet'), T('.'));
    if (rn && (rn.chance <= 0 || flagsNone(rn))) say.push(T(' Random yellow flags are '), B('on'), T(rn.chance <= 0 ? ', but the chance is ' : ', but the number of flags is '), B(rn.chance <= 0 ? '0%' : '0'), T(', so no race gets any.'));
    else if (rn) {
      const most = rn.mode === 'range' ? rn.max : rn.min, several = most > 1 || (rn.mode === 'atleast' && rn.more > 0);
      say.push(T(' Random yellow flags are '), B('on'), T(rn.chance < 100 ? ': ' : ': every race gets '));
      if (rn.chance < 100) say.push(B(`${round(rn.chance)}%`), T(' of the races get '));
      say.push(...FLAG_COUNT(rn));
      if (rn.from === rn.to) say.push(T(', at '), B(pctN(rn.from)), T(' of the race'));
      else say.push(T(', somewhere between '), B(pctN(rn.from)), T(' and '), B(pctN(rn.to)), T(' of the race'));
      if (several && rn.gap > 0) say.push(T(' and at least '), B(secs(rn.gap / 1000)), T(' apart'));
      say.push(T('.'));
      if (rn.mode === 'atleast' && rn.more > 0) say.push(T(' After that each further flag has a '), B(`${round(rn.more)}% chance`), T(', one after the other.'));
      if (rn.end === 'director') say.push(T(' A flag stays up '), B('until the Race Director lifts it'), T('.'));
      else say.push(T(' Each flag lasts '), B(rn.lenMax > rn.lenMin ? `between ${round(rn.lenMin / 1000)} and ${secs(rn.lenMax / 1000)}` : secs(rn.lenMin / 1000)), T(' and '), B('ends by itself'), T('.'));
      if (rn.warn > 0) say.push(T(' A warning comes '), B(secs(rn.warn / 1000)), T(' before a flag.'));
      if (rn.pitExit) say.push(T(' Cars in the pits are '), B('held at pit exit'), T(' until that Random Flag ends.'));
      if (rn.note) say.push(T(' The Race Director instruction is '), B(rn.note), T('.'));
    }
    const parts = [T('The Safety Car is out while the yellow flag is up. Work in the pits goes faster behind it.')];
    if (C.target <= 0) parts.push(T(' With no limit on the lap time no lap is too fast, so no penalty points are given.'));
    else if (C.points > 0) parts.push(T(' Penalty points need a penalty system in the race setup.'));
    return { pills, say, ready: text(v.name).trim() ? READY.ok : READY.name, notes: { behind: { tone: 'info', parts } }, strip: stripSafetyCar(rn) };
  }
  const pctN = n => `${round(n)}%`;

  function railSafetyCar(v, ctx) {
    const SC = scar(), C = SC.clean(v), rn = C.rnd, out = {}, named = text(v.name).trim() !== '', track = ctx && ctx.track;
    const d = ctx.defaults || {}, d0 = SC.DEFAULTS;
    // a setting that is typed and is not the standard one (an empty box counts as the standard, as the race does)
    const changed = keys => keys.some(k => { const a = text(v[k]).trim(), b = text(d[k] !== undefined ? d[k] : d0[k]).trim(); return a !== '' && num(a, a) !== num(b, b); });
    out.behind = entry(C.target > 0 ? `Slower than ${SC.secText(C.target)}${C.points > 0 ? ` · ${pts(C.points)}` : ''}` : 'No lap limit',
      `${C.target > 0 ? `laps slower than ${SC.secText(C.target)}${C.points > 0 ? ` (${ppts(C.points)} for a faster lap)` : ''}` : 'no limit on the lap time'}, ${C.pit > 0 ? `pit work ${C.pit}% shorter` : 'pit work as usual'}${track && text(track.name).trim() ? `; reference ${text(track.name).trim()}` : ''}`, !named ? 'todo' : changed(['target', 'points', 'pitPercent']) ? 'ok' : 'plain');
    if (!rn) out.flags = entry('Off', 'random yellow flags are off', 'plain');
    else if (rn.chance <= 0 || flagsNone(rn)) out.flags = entry('On · no flag will come', `random yellow flags are on, but ${rn.chance <= 0 ? 'the chance is 0%' : 'the number of flags is 0'}, so no race gets any`, 'ok');
    else {
      const count = rn.mode === 'range' ? `${rn.min} to ${rn.max} flags` : rn.mode === 'atleast' && rn.more > 0 ? `At least ${rn.min}` : plural(rn.min, 'flag', 'flags');
      const len = rn.end === 'director' ? 'until the Race Director lifts them' : rn.lenMax > rn.lenMin ? `${SC.secText(rn.lenMin)} to ${SC.secText(rn.lenMax)} each` : `${SC.secText(rn.lenMin)} each`;
      out.flags = entry(`${count} · ${rn.from === rn.to ? `at ${pctN(rn.from)}` : `${pctN(rn.from)} to ${pctN(rn.to)}`}`, `random yellow flags: ${count.charAt(0).toLowerCase() + count.slice(1)}${rn.chance < 100 ? ` (${round(rn.chance)}% chance in a race)` : ''}, ${len}, ${rn.from === rn.to ? `at ${pctN(rn.from)}` : `between ${pctN(rn.from)} and ${pctN(rn.to)}`} of the race${rn.pitExit ? '; hold at pit exit' : ''}${rn.note ? `; Director: ${rn.note}` : ''}`, 'ok');
    }
    return out;
  }

  // ---------------------------------------------------------------- Push and save system (1.76.0)
  // The numbers are the ones the race uses (pushsave.js, clean). A saving pace that is not more than the normal pace is refused by the form when it is saved (the race would make it 1 more).
  const psv = () => (typeof module !== 'undefined' ? require('./pushsave.js') : root.PushSave);
  const sign = n => `${round(n)}%`;
  function pushSaveOf(v) {
    const PS = psv(), C = PS.clean(v), a = text(v.normal).trim(), b = text(v.saveAt).trim();
    const bad = a !== '' && b !== '' && Number.isFinite(num(a, NaN)) && Number.isFinite(num(b, NaN)) && num(b, NaN) <= num(a, NaN); // (what the form refuses when it is saved)
    return { PS, C, bad, key: PS.presetOf(v) };
  }
  // the bar "The pace of a lap": from the best lap (flat out) to the normal pace (the usual wear), to the most saving pace and beyond (the wear stays as low as it gets)
  function stripPushSave(C) {
    const max = Math.max(C.saveAt * 1.35, C.saveAt + 2), at = n => round(n / max * 100), a = at(C.normal), b = at(C.saveAt);
    const parts = [];
    if (a > 0) parts.push({ name: 'Pushing', left: 0, width: a, kind: 'push', step: 1, of: 4 });
    parts.push({ name: 'Saving more and more', left: a, width: round(b - a), kind: 'save', step: 2, of: 4 }, { name: 'Most saving', left: b, width: round(100 - b), kind: 'most', step: 3, of: 4 }); // (of is the number of coloured parts plus 1, as in the bar of the damage levels: the colour of the last part is the strongest, never more)
    return { parts, ticks: [{ at: 0, label: 'Flat out · the best lap', show: true }, { at: a, label: `Normal · +${sign(C.normal)}`, show: a >= 24 && a <= 60 }, { at: b, label: `Most saving · +${sign(C.saveAt)}`, show: b >= 30 && (!(a >= 24 && a <= 60) || b - a >= 30) }], text: `Flat out is the best lap, normal pace is the best lap plus ${sign(C.normal)} and the most saving pace is the best lap plus ${sign(C.saveAt)}` };
  }
  function describePushSave(v) {
    const { PS, C, bad } = pushSaveOf(v), t = C.tyres, f = C.fuel;
    if (C.mode === 'median') {
      const pills = [{ text: 'Driver pace benchmark', tone: 'hi' }, { text: `Full push: ${sign(C.pushAt)} faster`, tone: '' }, { text: `Full save: ${sign(C.saveAt)} slower`, tone: '' }];
      const say = [T('The '), B('driver pace benchmark'), T(' selected in App Settings > Calculations is normal use. A faster lap uses more and a slower lap uses less, smoothly up to '), B(`${sign(C.pushAt)} faster`), T(' for full push and '), B(`${sign(C.saveAt)} slower`), T(' for full save.')];
      if (t.on) say.push(T(' Full push wears tyres '), B(`${sign(t.extra)} more`), T(' and full save wears them '), B(`${sign(t.save)} less`), T('.'));
      if (f.on) say.push(T(' Full push uses '), B(`${sign(f.extra)} more fuel`), T(' and full save uses '), B(`${sign(f.save)} less`), T('.'));
      if (!t.on && !f.on) say.push(T(' Both tyre and fuel effects are '), B('off'), T('.'));
      say.push(T(' Pit laps, yellow-flag laps, red-flag interruptions and very slow laps are ignored.'));
      const strip = { parts: [{ name: 'Full push', left: 0, width: 42, kind: 'push', step: 1, of: 3 }, { name: 'Benchmark', left: 42, width: 16, kind: 'normal', step: 2, of: 3 }, { name: 'Full save', left: 58, width: 42, kind: 'save', step: 3, of: 3 }], ticks: [{ at: 42, label: `Push · ${sign(C.pushAt)} faster`, show: true }, { at: 50, label: 'Benchmark · normal use', show: true }, { at: 58, label: `Save · ${sign(C.saveAt)} slower`, show: true }], text: `The selected pace benchmark is normal. Full push is ${sign(C.pushAt)} faster and full save is ${sign(C.saveAt)} slower.` };
      return { pills, say, ready: !text(v.name).trim() ? READY.name : READY.ok, notes: {}, strip };
    }
    const pills = [{ text: `Normal: best lap + ${sign(C.normal)}`, tone: 'hi' }, { text: `Most saving: best lap + ${sign(C.saveAt)}`, tone: '' }, { text: t.on && f.on ? 'Tyres and fuel' : t.on ? 'Tyres only' : f.on ? 'Fuel only' : 'No wear changed', tone: '' }];
    const say = [T('A car at its best lap is flat out, '), B(sign(C.normal)), T(' over it is '), B('normal pace'), T(' and '), B(sign(C.saveAt)), T(' over it is the '), B('most saving pace'), T('.')];
    if (t.on && f.on) say.push(T(' Flat out wears the tyres '), B(`${sign(t.extra)} more`), T(' and uses '), B(`${sign(f.extra)} more fuel`), T('. The most saving pace wears them '), B(`${sign(t.save)} less`), T(' and uses '), B(`${sign(f.save)} less`), T('.'));
    else if (t.on) say.push(T(' Flat out wears the tyres '), B(`${sign(t.extra)} more`), T(' and the most saving pace '), B(`${sign(t.save)} less`), T('. The fuel is used '), B('as usual'), T('.'));
    else if (f.on) say.push(T(' Flat out uses '), B(`${sign(f.extra)} more fuel`), T(' and the most saving pace '), B(`${sign(f.save)} less`), T('. The tyres wear '), B('as usual'), T('.'));
    else say.push(T(' The pace changes '), B('nothing'), T(': the tyres wear and the fuel is used as usual.'));
    say.push(T(' The effect starts at lap '), B(String(C.from)), T(', and a lap under the yellow flag or the Safety Car '), B(C.yellowSave ? 'counts as saving' : 'counts like any other lap'), T('. A lap slower than '), B(sign(C.slow)), T(' of the best lap is no pace and wears as usual.'));
    const notes = {};
    if (bad) notes.pace = { tone: 'warn', parts: [T('The most saving pace, '), B(sign(num(v.saveAt, 0))), T(', has to be more than the normal pace, '), B(sign(C.normal)), T(', or the system cannot be saved.')] };
    return { pills, say, ready: !text(v.name).trim() ? READY.name : bad ? READY.pace : READY.ok, notes, strip: stripPushSave(C) };
  }
  function railPushSave(v, ctx) {
    const { PS, C, bad, key } = pushSaveOf(v), out = {}, t = C.tyres, f = C.fuel, named = text(v.name).trim() !== '';
    const d = ctx.defaults || {}, d0 = PS.DEFAULTS;
    const changed = keys => keys.some(k => { const a = text(v[k]).trim(), b = text(d[k] !== undefined ? d[k] : d0[k]).trim(); return a !== '' && num(a, a) !== num(b, b); });
    out.basics = entry(key ? PS.PRESETS[key].name : 'Own numbers', key ? `the ${PS.PRESETS[key].name} numbers for the wear` : 'your own numbers for the wear', !named ? 'todo' : key === 'standard' ? 'plain' : 'ok');
    out.pace = C.mode === 'median' ? entry(`Benchmark · push ${sign(C.pushAt)} · save ${sign(C.saveAt)}`, `App Settings chooses the driver pace benchmark; faster laps push and slower laps save`, changed(['mode', 'pushAt', 'saveAt']) ? 'ok' : 'plain') : entry(`Normal +${sign(C.normal)} · saving +${sign(C.saveAt)}`, `normal pace is the best lap plus ${sign(C.normal)}, the most saving pace the best lap plus ${sign(C.saveAt)}`, bad ? 'todo' : changed(['normal', 'saveAt']) ? 'ok' : 'plain');
    const side = (name, s) => (s.on ? `${name} +${sign(s.extra)} / −${sign(s.save)}` : `${name} off`);
    out.wear = entry(`${side('Tyres', t)} · ${side('fuel', f)}`, `${t.on ? `flat out wears the tyres ${sign(t.extra)} more, the most saving pace ${sign(t.save)} less` : 'the tyres wear as usual'}; ${f.on ? `the fuel use is ${sign(f.extra)} more and ${sign(f.save)} less` : 'the fuel is used as usual'}`,
      changed(['tyres', 'tyreExtra', 'tyreSave', 'fuel', 'fuelExtra', 'fuelSave']) ? 'ok' : 'plain');
    out.laps = entry(`From lap ${C.from} · yellow is ${C.yellowSave ? 'saving' : 'a normal lap'}`, `the effect starts at lap ${C.from}; a lap slower than ${sign(C.slow)} of the best lap is no pace; a lap under the yellow flag or the Safety Car ${C.yellowSave ? 'counts as saving' : 'counts like any other lap'}`, changed(['from', 'slow', 'yellowSave']) ? 'ok' : 'plain');
    return out;
  }

  // ---------------------------------------------------------------- Fuel system
  // The numbers are the ones the race uses (engine.js, fuelConfig), so the words say what the race will do, also for a box that is empty or wrong.
  const litres = n => plural(round(n), 'litre', 'litres');
  const EMPTY_SHORT = { retire: 'Retires', stop: 'Laps stop', warn: 'Carries on' };
  function fuelOf(v, ctx) {
    const F = eng().fuelConfig({}, v, ctx && ctx.track), laps = F.perLap > 0 ? F.tank / F.perLap : null, fill = F.rate > 0 ? F.tank / F.rate : null;
    return { F, laps, fill, track: ctx && ctx.track };
  }
  const rounded = n => Number.isInteger(n) ? String(n) : String(round(n * 10) / 10);
  const paceName = (F, track) => F.paceSource === 'track' ? (track && text(track.name).trim() ? text(track.name).trim() : 'the selected track') : F.paceSource === 'manual' ? 'the manual target' : '';
  function describeFuel(v, ctx) {
    const { F, laps, fill, track } = fuelOf(v, ctx);
    const pills = [{ text: `${round(F.tank)} litre tank`, tone: 'hi' }, { text: F.perLap > 0 ? `${litres(F.perLap)} a lap` : 'No fuel used', tone: '' }, { text: F.rate > 0 ? `${litres(F.rate)} a second` : 'No refuelling', tone: '' }];
    const say = [T('The tank holds '), B(litres(F.tank))];
    if (F.perLap > 0) {
      say.push(T(' and every lap uses '), B(litres(F.perLap)), T(', so a full tank lasts about '), B(`${rounded(laps)} ${laps === 1 ? 'lap' : 'laps'}`), T('.'));
      if (F.empty === 'retire') say.push(T(' When the fuel runs out, '), B('the car retires from the race'), T('.'));
      else if (F.empty === 'stop') say.push(T(' When the fuel runs out, '), B('laps stop counting'), T(' until the car has refuelled.'));
      else say.push(T(' When the fuel runs out, '), B('the car carries on'), T('; a penalty system can add points for it.'));
    } else say.push(T(', but a lap uses '), B('no fuel'), T(', so the tank never runs empty.'));
    if (F.rate > 0) say.push(T(' Refuelling in the pits runs at '), B(`${litres(F.rate)} a second`), T(', so an empty tank fills in about '), B(`${rounded(fill)} ${fill === 1 ? 'second' : 'seconds'}`), T('.'));
    else say.push(T(' The pump does '), B('not run'), T(' (the speed is 0), so a stop adds no fuel.'));
    if (F.legacyPace) say.push(T(' This existing Fuel System keeps its earlier '), B('fast and slow lap fuel behaviour'), T('.'));
    else if (F.paceSource === 'constant') say.push(T(' Fuel use stays the same every lap. '), B('Push & Save falls back to each driver\'s best lap'), T(' when it is on.'));
    else if (F.paceTarget > 0) say.push(T(' Push & Save uses '), B(`${paceName(F, track)} at ${secs(F.paceTarget / 1000)}`), T(' as its pace reference.'));
    else say.push(T(' The selected '), B(paceName(F, track)), T(' has no reference time yet, so Push & Save falls back to each driver\'s best lap.'));
    const notes = {};
    if (F.perLap <= 0) notes.basics = { tone: 'info', parts: [T('A lap uses no fuel, so the tank never runs empty.')] };
    else if (laps < 1) notes.basics = { tone: 'warn', parts: [T('A full tank ('), B(litres(F.tank)), T(') holds less than one lap of fuel ('), B(litres(F.perLap)), T(').')] };
    else notes.basics = { tone: 'good', parts: [B(`A full tank lasts about ${rounded(laps)} ${laps === 1 ? 'lap' : 'laps'}`), T(fill === null ? '; the pump is off.' : `; empty to full is about ${rounded(fill)} ${fill === 1 ? 'second' : 'seconds'}.`)] };
    if (F.legacyPace) notes.pace = { tone: 'info', parts: [T('This saved Fuel System keeps its original pace-based fuel behaviour.')] };
    else if (F.paceSource === 'track' && F.paceTarget <= 0) notes.pace = { tone: 'warn', parts: [T('Set a Fuel reference lap time on the selected Track.')] };
    else if (F.paceSource === 'manual' && F.paceTarget <= 0) notes.pace = { tone: 'warn', parts: [T('Enter a manual reference lap time.')] };
    else notes.pace = { tone: F.paceSource === 'constant' ? 'plain' : 'good', parts: [T(F.paceSource === 'constant' ? 'Fuel use is fixed per lap; Push & Save uses each driver\'s best lap.' : `Push & Save uses ${paceName(F, track)} at ${secs(F.paceTarget / 1000)}.`)] };
    return { pills, say, ready: text(v.name).trim() ? READY.ok : READY.name, notes, strip: null };
  }
  const FUEL_STANDARD = { tank: 120, perLap: 2, rate: 10, paceSource: 'constant', paceTrack: '', paceManual: '', empty: 'retire' };
  function railFuel(v, ctx) {
    const { F, track } = fuelOf(v, ctx), out = {}, named = text(v.name).trim() !== '';
    const d = { ...FUEL_STANDARD, ...(ctx.defaults || {}) }; // (the standard fuel system, when the form does not say)
    const changed = keys => keys.some(k => { const a = text(v[k]).trim(), b = text(d[k]).trim(); return a !== '' && num(a, a) !== num(b, b); });
    out.basics = entry(`${round(F.tank)} L · ${round(F.perLap)} L a lap · ${round(F.rate)} L/s`, `a tank of ${litres(F.tank)}, ${litres(F.perLap)} a lap and refuelling at ${litres(F.rate)} a second`, named ? 'ok' : 'todo');
    const pace = F.legacyPace ? `Legacy pace · ${secs(F.paceTarget / 1000)}` : F.paceSource === 'track' ? (F.paceTarget > 0 ? `${track && text(track.name).trim() ? text(track.name).trim() : 'Track'} · ${secs(F.paceTarget / 1000)}` : 'Track needs a reference') : F.paceSource === 'manual' ? (F.paceTarget > 0 ? `Manual · ${secs(F.paceTarget / 1000)}` : 'Manual time needed') : 'Same every lap';
    out.pace = entry(pace, F.legacyPace ? 'this existing Fuel System keeps its original pace-based fuel behaviour' : F.paceSource === 'constant' ? 'fuel use stays the same each lap; Push & Save uses each driver\'s best lap' : F.paceTarget > 0 ? `Push & Save uses ${paceName(F, track)} at ${secs(F.paceTarget / 1000)}` : `set a reference lap time on ${paceName(F, track)}`, F.legacyPace ? 'ok' : F.paceSource === 'constant' ? 'plain' : F.paceTarget > 0 ? 'ok' : 'todo');
    out.empty = entry(EMPTY_SHORT[F.empty], `when the fuel runs out ${F.empty === 'retire' ? 'the car retires' : F.empty === 'stop' ? 'laps stop counting until it has refuelled' : 'the car carries on'}`, changed(['empty']) ? 'ok' : 'plain');
    return out;
  }

  const ENTITIES = { penaltysystems: [describePenalty, railPenalty], damagesystems: [describeDamage, railDamage], weathersystems: [describeWeather, railWeather], tyrewearsystems: [describeTyreWear, railTyreWear], safetycarsystems: [describeSafetyCar, railSafetyCar], pushsavesystems: [describePushSave, railPushSave], fuelrules: [describeFuel, railFuel] };
  const has = entity => Object.prototype.hasOwnProperty.call(ENTITIES, entity);
  const describe = (entity, v, ctx) => (has(entity) ? ENTITIES[entity][0](v || {}, ctx || {}) : { pills: [], say: [], ready: READY.name, notes: {}, strip: null });
  const rail = (entity, v, ctx) => (has(entity) ? ENTITIES[entity][1](v || {}, ctx || {}) : {});

  const api = { has, describe, rail, typesOf, levelsOf, incidentsOf, failuresOf };
  root.SystemWords = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
