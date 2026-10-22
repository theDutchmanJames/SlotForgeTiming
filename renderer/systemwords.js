// The words of the system forms with a rail (1.73.0): a Penalty system and a Damage system. The form of a system has a header (the picture of the system, its name, a few pills and "Ready to use"),
// a sentence "In plain words" that reads the whole system back, and a rail with a short note and a dot for every section; this file works out those words from the values of the form and nothing
// else (no screen, no storage), so they can be tested on their own. It is the same idea as setupwords.js for a race setup, and the numbers come from the rules of the race itself: the time of a
// penalty from engine.js (penaltyConfig, penaltyMs) and the levels of damage from damage.js (clean), so the words say what the race will do, also for a setting that is empty or wrong.
//   v: the values of the form, by setting (every value may be text), and the lists as the form holds them while they are edited:
//      penaltysystems: types (the special penalties)   damagesystems: levels, incidents, failures (the rows of the three tables)
//   ctx: { lists: { types, levels, incidents, failures: the rows a new system starts with } } (only to see what has been changed from the standard)
//   describe -> { pills: [{ text, tone: 'hi' | '' }], say: [{ t, b }], ready: { ok, text }, notes: { section: { tone, parts } }, strip }
//   rail     -> { section: { rail (the short note), row (the line of a section that is closed), state: 'ok' | 'todo' | 'plain' } }
//   (a dot is green = filled in or changed from the standard, amber = something that is needed is missing, an open ring = nothing changed from the standard; see railform.js)
(function (root) {
  const eng = () => (typeof module !== 'undefined' ? require('./engine.js') : root.RaceEngine);
  const dmg = () => (typeof module !== 'undefined' ? require('./damage.js') : root.Damage);

  const text = v => (typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : ''); // (anything that is not text or a number is nothing)
  const round = n => Math.round(n * 100) / 100;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const secs = n => plural(round(n), 'second', 'seconds');
  const pts = n => plural(n, 'point', 'points');
  const T = t => ({ t: String(t) }), B = t => ({ t: String(t), b: true });
  const num = (v, d) => { const s = text(v).trim().replace(',', '.'); return s !== '' && Number.isFinite(Number(s)) ? Number(s) : d; };
  const names = list => list.map(x => x.name);
  const joinAnd = (list, word) => (list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} ${word} ${list[list.length - 1]}`);
  const entry = (rail, row, state) => ({ rail, row: cap(row), state });
  const READY = { ok: { ok: true, text: 'Ready to use' }, name: { ok: false, text: 'Give it a name' } };

  // what the form holds in its tables, as the form saves it (a row without a name does not count)
  const typesOf = list => (Array.isArray(list) ? list : []).filter(t => t && text(t.name).trim()).map(t => ({ name: text(t.name).trim(), kind: t.kind === 'drivethrough' ? 'drivethrough' : 'stopgo', seconds: num(t.seconds, 0), cost: num(t.cost, 0), extra: num(t.extra, 0), unserved: num(t.unserved, 0) }));
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
    const P = eng().penaltyConfig({ timeRule: v.timeRule, everyPoints: v.everyPoints, everySeconds: v.everySeconds, steps: v.steps, dqPoints: v.dqPoints, fuelPoints: v.fuelPoints, types });
    return { P, types, ms: n => eng().penaltyMs(P, n) };
  }
  // the points of the example "so 12 points are 10 seconds": two full blocks and a part of the next one
  const exampleOf = P => P.every * 2 + (P.every > 1 ? Math.floor(P.every / 2) : 0);

  function describePenalty(v) {
    const { P, ms } = penaltyOf(v), steps = P.mode === 'steps';
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

  const ENTITIES = { penaltysystems: [describePenalty, railPenalty], damagesystems: [describeDamage, railDamage] };
  const has = entity => Object.prototype.hasOwnProperty.call(ENTITIES, entity);
  const describe = (entity, v) => (has(entity) ? ENTITIES[entity][0](v || {}) : { pills: [], say: [], ready: READY.name, notes: {}, strip: null });
  const rail = (entity, v, ctx) => (has(entity) ? ENTITIES[entity][1](v || {}, ctx || {}) : {});

  const api = { has, describe, rail, typesOf, levelsOf, incidentsOf, failuresOf };
  root.SystemWords = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
