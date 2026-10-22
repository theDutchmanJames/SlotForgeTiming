// The words of the rotation setup editor with a rail (1.77.0). The editor of a rotation setup has a sentence "In plain words" that reads the whole rotation back, pills under the name, a status
// ("Ready to use") and a rail with a short note and a dot for every section; this file works out those words from the rotation as the editor holds it and nothing else (no screen, no storage),
// so they can be tested on their own. It is the same idea as systemwords.js for the system forms. The facts come from rotation.js (the remarks, the numbers per participant) and heats.js (the
// statistics of a plan), so the words say what the race will do, also for a rotation that is not finished.
//   d: the rotation as the editor holds it: { name, participants, lanes, participantsAre ('drivers' | 'teams'), names, groups: [{ name, members }], heats: [{ label, locked, places: [{ p, lane }] }] }
//   describe(d)      -> { pills: [{ text, tone: 'hi' | '' }], say: [{ t, b }], ready: { ok, text } }
//   rail(d, ctx)     -> { size, plan, names, heats, how, groups: { rail (the short note), row (the line of a section that is closed), state: 'ok' | 'todo' | 'plain' } }
//   ctx (may be left out): { plan: the plan that "Start from a plan" has chosen ('manual' | 'perdriver' | 'roundrobin' | 'rotation'), heats: the number of heats of the plan, each: heats for everybody }
//   (a dot is green = filled in, amber = something needs a look, an open ring = nothing to say yet; see railform.js)
(function (root) {
  const rot = () => (typeof module !== 'undefined' ? require('./rotation.js') : root.Rot);

  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const T = t => ({ t: String(t) }), B = t => ({ t: String(t), b: true });
  const entry = (text, state) => ({ rail: text, row: text, state }); // (the note on the rail and the line of a closed section say the same)
  // a list of words in a sentence: "P7", "P7 and P8", "P5, P6 and P7", "P1, P2, P3, P4 and 3 more"
  const joinAnd = (items, max = 4) => (items.length <= 1 ? items.join('') : items.length <= max ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}` : `${items.slice(0, max).join(', ')} and ${items.length - max} more`);
  const PLAN_NAME = { manual: 'Shuffled', perdriver: 'Same number each', roundrobin: 'Round robin', rotation: 'Lane rotation' };

  // everything the words need to know, in one place
  function facts(d) {
    const R = rot(), heats = d.heats, full = heats.filter(h => h.places.length);
    const per = R.perParticipant(d), counts = per.map(x => x.heats), remarks = R.check(d);
    const teams = R.isTeams(d), n = d.participants, lanes = d.lanes;
    const named = (Array.isArray(d.names) ? d.names.slice(0, n) : []).filter(x => String(x || '').trim()).length;
    const min = counts.length ? Math.min(...counts) : 0, max = counts.length ? Math.max(...counts) : 0;
    const spread = per.reduce((m, x) => (x.heats ? Math.max(m, Math.max(...x.lanes) - Math.min(...x.lanes)) : m), 0);
    return { R, d, n, lanes, teams, who: teams ? 'teams' : 'drivers', heats, full: full.length, cars: full.reduce((m, h) => Math.max(m, h.places.length), 0),
      empty: heats.map((h, i) => (h.places.length ? 0 : i + 1)).filter(Boolean), locked: heats.map((h, i) => (h.locked ? i + 1 : 0)).filter(Boolean),
      idle: per.map((x, p) => (x.heats ? '' : R.shortOf(d, p))).filter(Boolean), min, max, spread, named, remarks, warns: remarks.filter(r => r.level === 'warn'),
      groups: Array.isArray(d.groups) ? d.groups : [] };
  }
  const heatWord = (list, one, many) => (list.length === 1 ? `${one} ${list[0]}` : `${many} ${joinAnd(list.map(String), 8)}`);

  function describe(d) {
    const f = facts(d), { R } = f, pills = [{ text: `${f.n} ${f.who}`, tone: 'hi' }, { text: plural(f.lanes, 'lane', 'lanes'), tone: '' }];
    pills.push({ text: f.full ? plural(f.full, 'heat', 'heats') : 'No heats yet', tone: '' });
    if (f.full && !f.idle.length) pills.push({ text: f.min === f.max ? `${plural(f.max, 'heat', 'heats')} each` : `${f.min} to ${f.max} heats each`, tone: '' });

    const s = []; // the sentences
    if (!f.full) s.push([B(`${f.n} ${f.who}`), T(' on '), B(plural(f.lanes, 'lane', 'lanes')), T(', and '), B('no heats'), T(' yet. Add a heat, or start from a plan.')]);
    else {
      s.push([B(`${f.n} ${f.who}`), T(' race in '), B(plural(f.full, 'heat', 'heats')), T(' on '), B(plural(f.lanes, 'lane', 'lanes')), T(', with up to '), B(plural(f.cars, 'car', 'cars')), T(' in a heat.')]);
      if (f.empty.length) s.push([B(heatWord(f.empty, 'Heat', 'Heats')), T(f.empty.length === 1 ? ' is empty and is left out of the race.' : ' are empty and are left out of the race.')]);
      if (f.idle.length) s.push([B(joinAnd(f.idle, 3)), T(f.idle.length === 1 ? ' races no heat.' : ' race no heat.')]);
      else if (f.min === f.max) s.push([T('Everybody races '), B(plural(f.max, 'heat', 'heats')), T('.')]);
      else s.push([T('The participants race '), B(`${f.min} to ${f.max} heats`), T('.')]);
      if (f.lanes > 1 && f.max >= 2) s.push(f.spread >= 2 ? [T('The lanes are '), B('not shared evenly'), T(': some race one lane more often than another.')] : [T('The lanes are '), B('shared evenly'), T('.')]);
      if (f.locked.length) s.push([B(heatWord(f.locked, 'Heat', 'Heats')), T(f.locked.length === 1 ? ' is locked, so a shuffle leaves it where it is.' : ' are locked, so a shuffle leaves them where they are.')]);
    }
    if (f.groups.length) {
      const one = (g, k) => `${String(g.name || '').trim() || 'Group ' + (k + 1)} (${g.members.length ? joinAnd(g.members.map(p => R.shortOf(d, p))) : 'nobody yet'})`;
      s.push(f.groups.length === 1 ? [B(one(f.groups[0], 0)), T(' can be put in a heat in one go.')] : [T('Groups '), B(joinAnd(f.groups.map(one), 8)), T(' can be put in a heat in one go.')]);
    }
    const say = []; s.forEach((parts, i) => { if (i) say.push(T(' ')); parts.forEach(x => say.push(x)); });

    const ready = !String(d.name || '').trim() ? { ok: false, text: 'Give it a name' } : !f.full ? { ok: false, text: 'Add a heat' }
      : f.warns.length ? { ok: false, text: `${plural(f.warns.length, 'thing', 'things')} to look at` } : { ok: true, text: 'Ready to use' };
    return { pills, say, ready };
  }

  function rail(d, ctx) {
    const f = facts(d), c = ctx || {}, has = k => f.warns.some(w => w.kind === k);
    const plan = PLAN_NAME[c.plan] || PLAN_NAME.manual, count = k => Math.floor(Number(c[k])) || 0;
    const planNote = c.plan === 'perdriver' ? (count('each') > 0 ? `${plan} · ${plural(count('each'), 'heat', 'heats')}` : plan)
      : c.plan === 'roundrobin' || c.plan === 'rotation' ? plan : (count('heats') > 0 ? `${plan} · ${plural(count('heats'), 'heat', 'heats')}` : plan);
    const size = `${f.n} ${f.who} · ${plural(f.lanes, 'lane', 'lanes')}`;
    const names = f.named ? `${f.named} of ${f.n} have a name` : 'No names';
    const heats = f.full ? `${plural(f.full, 'heat', 'heats')}${f.locked.length ? ` · ${f.locked.length} locked` : ''}` : 'No heats yet';
    const how = !f.full ? 'Nothing to count yet' : `${f.min === f.max ? `${f.max} each` : `${f.min} to ${f.max}`}${f.lanes > 1 && f.max >= 2 ? (f.spread >= 2 ? ' · lanes uneven' : ' · lanes even') : ''}`;
    const groups = f.groups.length ? plural(f.groups.length, 'group', 'groups') : 'No groups';
    return {
      size: entry(size, 'ok'),
      plan: entry(planNote, f.full ? 'plain' : 'todo'),
      names: entry(names, has('dup') ? 'todo' : f.named ? 'ok' : 'plain'),
      heats: entry(heats, has('none') || has('empty') || has('idle') || has('lone') ? 'todo' : 'ok'),
      how: entry(how, f.full ? 'ok' : 'plain'),
      groups: entry(groups, f.groups.length ? 'ok' : 'plain')
    };
  }

  const api = { describe, rail, facts, PLAN_NAME, joinAnd };
  root.RotWords = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
