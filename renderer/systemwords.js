// The words of the system forms with a rail (1.73.0): a Penalty system and a Damage system, and (1.74.0) a Weather system. The form of a system has a header (the picture of the system, its name, a few pills and "Ready to use"),
// a sentence "In plain words" that reads the whole system back, and a rail with a short note and a dot for every section; this file works out those words from the values of the form and nothing
// else (no screen, no storage), so they can be tested on their own. It is the same idea as setupwords.js for a race setup, and the numbers come from the rules of the race itself: the time of a
// penalty from engine.js (penaltyConfig, penaltyMs) and the levels of damage from damage.js (clean), so the words say what the race will do, also for a setting that is empty or wrong.
//   v: the values of the form, by setting (every value may be text), and the lists as the form holds them while they are edited:
//      penaltysystems: types (the special penalties)   damagesystems: levels, incidents, failures (the rows of the three tables)   weathersystems: no lists (its tables are plain numbers: the 12 of the hindrance table and the 16 conditions)
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

  const ENTITIES = { penaltysystems: [describePenalty, railPenalty], damagesystems: [describeDamage, railDamage], weathersystems: [describeWeather, railWeather] };
  const has = entity => Object.prototype.hasOwnProperty.call(ENTITIES, entity);
  const describe = (entity, v) => (has(entity) ? ENTITIES[entity][0](v || {}) : { pills: [], say: [], ready: READY.name, notes: {}, strip: null });
  const rail = (entity, v, ctx) => (has(entity) ? ENTITIES[entity][1](v || {}, ctx || {}) : {});

  const api = { has, describe, rail, typesOf, levelsOf, incidentsOf, failuresOf };
  root.SystemWords = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
