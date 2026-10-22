// The words of the championship editor with a rail (1.78.0). The editor of a championship has a sentence "In plain words" that reads the whole championship back, pills under the name, a status
// ("Ready to use") and a rail with a short note and a dot for every section; this file works out those words from the championship as the editor holds it and nothing else (no screen, no storage),
// so they can be tested on their own. It is the same idea as rotationwords.js and systemwords.js. The facts come from championship.js (the rules, the remarks, what was driven).
//   d:   the championship as the editor holds it (see championship.js)
//   ctx: what the page knows besides it (may be left out): { setups, tracks (for the remarks and the kind of a session), sessions (the saved sessions: what was driven), id (of the saved championship; none for a new one), saved: false for one that is not saved yet }
//   describe(d, ctx)  -> { pills: [{ text, tone: 'hi' | '' }], say: [{ t, b }], ready: { ok, text }, driven: { head, note, pct, state: 'none' | 'busy' | 'done' } }
//   rail(d, ctx)      -> { rounds, points, roster, bonus, drops, teams: { rail (the short note), row (the line of a section that is closed), state: 'ok' | 'todo' | 'plain' } }
//   remarks(d, ctx)   -> [text]    what the list of championships says too (championship.js, problems)
//   looks(d, ctx)     -> [bool]    for every round: it needs a look
//   roundPill(state, look) -> { text, tone } | null    the pill of a round: Done, Next, To do, or Needs a look
//   dropSaid(d, ctx)  -> "Best 4 of 5 rounds count."
//   (a dot is green = filled in, amber = something needs a look, an open ring = nothing to say yet or nothing changed from the standard; see railform.js)
(function (root) {
  const champ = () => (typeof module !== 'undefined' ? require('./championship.js') : root.Champ);

  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const T = t => ({ t: String(t) }), B = t => ({ t: String(t), b: true });
  const entry = (text, state) => ({ rail: text, row: text, state }); // (the note on the rail and the line of a closed section say the same)
  // a list of words in a sentence: "25", "25 and 18", "25, 18 and 15", "25, 18, 15, 12 and 3 more"
  const joinAnd = (items, max = 4) => (items.length <= 1 ? items.join('') : items.length <= max ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}` : `${items.slice(0, max).join(', ')} and ${items.length - max} more`);
  const pts = v => String(v);
  const unit = v => (Number(v) === 1 ? 'point' : 'points');
  const points = v => `${pts(v)} ${unit(v)}`;

  const context = ctx => { const c = ctx || {}; return { setups: c.setups || [], tracks: c.tracks || [], sessions: c.sessions || [], id: c.id, saved: c.saved !== false }; };
  const setupOf = (c, id) => c.setups.find(s => s.id === id) || null;

  // the rounds that have a race in them that counts for points (a share above 0): they are what "the best 4 of 5 rounds" counts
  function raceRounds(d, setups) {
    const Champ = champ(), list = setups || [];
    return d.rounds.filter(r => r.sessions.some(s => s.share > 0 && Champ.kindOf(list.find(x => x.id === s.setup)) === 'race')).length;
  }
  function dropParts(d, ctx) {
    const n = raceRounds(d, context(ctx).setups);
    if (!d.drops) return [T('Every round counts.')];
    return n ? [B(`Best ${Math.max(1, n - d.drops)} of ${n} rounds`), T(' count.')] : [T('The best results count (there is no race in the rounds yet).')];
  }
  const dropSaid = (d, ctx) => dropParts(d, ctx).map(p => p.t).join('');

  // what the page shows as problems: the same remarks as the list of championships
  const remarks = (d, ctx) => { const c = context(ctx); return champ().problems(d, { setups: c.setups, tracks: c.tracks }); };
  // a round needs a look when it has no session, or one of its sessions can not be raced, or its track is gone (the same checks as championship.js, round by round)
  function looks(d, ctx) {
    const Champ = champ(), c = context(ctx);
    return d.rounds.map((r, i) => !r.sessions.length || r.sessions.some((_, k) => Champ.sessionProblems(d, i, k, { setups: c.setups, tracks: c.tracks }).length > 0) || !!(r.track && !c.tracks.some(t => t.id === r.track)));
  }
  // the pill of a round: Needs a look wins over where the round stands
  function roundPill(state, look) {
    if (look) return { text: 'Needs a look', tone: 'warn' };
    return state === 'done' ? { text: 'Done', tone: 'done' } : state === 'next' ? { text: 'Next', tone: 'next' } : state === 'todo' ? { text: 'To do', tone: 'todo' } : null;
  }

  // everything the words need to know, in one place
  function facts(d, ctx) {
    const Champ = champ(), c = context(ctx), prog = Champ.progress({ ...d, id: c.id }, c.sessions);
    const sessions = d.rounds.reduce((a, r) => a + r.sessions.length, 0), teams = new Set(d.roster.map(x => x.team).filter(Boolean)).size;
    const sprint = d.rounds.some(r => r.sessions.some(s => s.share === 50 && Champ.kindOf(setupOf(c, s.setup)) === 'race'));
    return { Champ, c, prog, rounds: d.rounds.length, sessions, drivers: d.roster.length, teams, sprint, remarks: remarks(d, ctx), looks: looks(d, ctx), next: prog.next, races: raceRounds(d, c.setups) };
  }

  const TIE_SAY = { wins: 'A tie goes to the driver with the most wins.', last: 'A tie goes to the driver with the best result of the last round.', qual: 'A tie goes to the driver with the best qualifying results.' };
  const SPRINT_SAY = { nearest: 'rounded to the nearest', up: 'rounded up', down: 'rounded down', none: 'not rounded' };

  function describe(d, ctx) {
    const f = facts(d, ctx), Champ = f.Champ, name = String(d.name || '').trim() || 'This championship';
    const pills = [];
    if (f.next) pills.push({ text: `Round ${f.next.round + 1} is next`, tone: '' }); else if (f.prog.complete) pills.push({ text: 'Finished', tone: '' });
    pills.push({ text: plural(f.rounds, 'round', 'rounds'), tone: '' }, { text: plural(f.sessions, 'session', 'sessions'), tone: '' }, { text: f.drivers ? plural(f.drivers, 'driver', 'drivers') : 'No drivers yet', tone: '' });
    if (d.drops && f.races) pills.push({ text: `Best ${Math.max(1, f.races - d.drops)} of ${f.races} count`, tone: '' });
    pills[0].tone = 'hi'; // (the first pill stands out: the round that is next, that it is finished, or else the number of rounds)

    const s = []; // the sentences
    if (!f.rounds) s.push([B(name), T(' has '), B('no rounds'), T(' yet. Add a round.')]);
    else s.push([B(name), T(' has '), B(plural(f.rounds, 'round', 'rounds')), T(' with '), B(plural(f.sessions, 'session', 'sessions')),
      ...(f.drivers ? [T(', and '), B(plural(f.drivers, 'driver', 'drivers')), T(' in the roster.')] : [T(', and no drivers in the roster yet.')])]);
    if (f.prog.total) {
      if (f.prog.complete) s.push([T('All '), B(String(f.prog.total)), T(' sessions are driven.')]);
      else if (f.prog.driven) s.push([B(String(f.prog.driven)), T(f.prog.driven === 1 ? ' session is driven; ' : ' sessions are driven; '), B(`round ${f.next.round + 1}`), T(' is next.')]);
    }
    // the points
    const n = d.points.length;
    if (d.pointsMode === 'beaten') s.push([T('Only a race gives points: '), B('one point for every car'), T(' that finished behind a driver.')]);
    else s.push([T('Only a race gives points: '), B(joinAnd(d.points.map(pts), 10)), T(n === 1 ? ' for the winner.' : ` for the first ${n}.`)]);
    if (d.pointsMode === 'table' && d.pointsRest > 0) s.push([T('Every other finisher gets '), B(points(d.pointsRest)), T('.')]);
    if (d.bonusFast > 0) s.push([T('The fastest lap of a driver who finishes in the first '), B(String(d.bonusFastTop)), T(' gives '), B(pts(d.bonusFast)), T(` more ${unit(d.bonusFast)}.`)]);
    if (d.bonusPole > 0) s.push([T('The pole position gives '), B(pts(d.bonusPole)), T(` more ${unit(d.bonusPole)}.`)]);
    if (d.bonusStart > 0) s.push([T('Starting the race gives every driver '), B(pts(d.bonusStart)), T(` more ${unit(d.bonusStart)}.`)]);
    s.push(dropParts(d, ctx));
    if (f.sprint) s.push([T('A sprint gives half the points, '), B(SPRINT_SAY[d.sprintRound] || SPRINT_SAY.nearest), T('.')]);
    // the teams
    if (d.teamMode === 'none') s.push([T('There are '), B('no team standings'), T('.')]);
    else if (d.teamMode === 'all') s.push([T('All the drivers of a team add points to the team.')]);
    else if (d.teamBest !== Champ.RULE_DEFAULTS.teamBest) s.push([T('The best '), B(plural(d.teamBest, 'driver', 'drivers')), T(' of a team count.')]);
    s.push([T(TIE_SAY[d.tie] || TIE_SAY.wins)]);
    if (!d.guestRule) s.push([T('A driver who is not in the roster is '), B('not a guest'), T(': nobody moves up.')]);
    const say = []; s.forEach((parts, i) => { if (i) say.push(T(' ')); parts.forEach(x => say.push(x)); });

    const ready = !String(d.name || '').trim() ? { ok: false, text: 'Give it a name' } : !f.rounds ? { ok: false, text: 'Add a round' }
      : f.remarks.length ? { ok: false, text: `${plural(f.remarks.length, 'thing', 'things')} to look at` } : { ok: true, text: 'Ready to use' };

    // the box under the rail: how far the championship has been driven
    const total = f.prog.total, done = f.prog.driven, pct = total ? Math.round(1000 * done / total) / 10 : 0;
    const driven = !total ? { head: 'No sessions yet', note: 'Add a session to a round.', pct: 0, state: 'none' }
      : f.prog.complete ? { head: `All ${total} sessions driven`, note: 'The championship is finished.', pct: 100, state: 'done' }
        : { head: `${done} of ${total} sessions`, note: f.next ? `Round ${f.next.round + 1} is next. ${f.c.saved ? 'It shows on the Home tab.' : 'Save the championship and it shows on the Home tab.'}` : '', pct, state: 'busy' };
    return { pills, say, ready, driven };
  }

  // the table of points in a few characters: "25-18-15-12-10-8-6-4-2-1" (a long one is cut off: "30-18-17.56-12-10-8-6-4-...")
  function tableText(d) {
    if (d.pointsMode === 'beaten') return 'One point per car beaten';
    const list = d.points.map(pts);
    return list.length <= 10 ? list.join('-') : `${list.slice(0, 8).join('-')}-... (${list.length} places)`;
  }
  // the bonus points in a few words: "Fastest lap +1 · Pole +2 · Start +0.5"
  function bonusBits(d) {
    const out = [];
    if (d.bonusFast > 0) out.push(`Fastest lap +${pts(d.bonusFast)}`);
    if (d.bonusPole > 0) out.push(`Pole +${pts(d.bonusPole)}`);
    if (d.bonusStart > 0) out.push(`Start +${pts(d.bonusStart)}`);
    return out;
  }
  // what is not the standard in the section of the teams, the ties and the sprint
  function teamBits(d) {
    const D = champ().RULE_DEFAULTS, out = [];
    if (d.teamMode === 'all') out.push('All drivers count'); else if (d.teamMode === 'none') out.push('No team standings'); else if (d.teamBest !== D.teamBest) out.push(`Best ${d.teamBest} count`);
    if (d.teamRace === 'split') out.push('Shared by laps'); else if (d.teamRace === 'team') out.push('Team only');
    if (d.teamRace !== 'team' && d.teamMin > 0) out.push(`At least ${d.teamMin}% of laps`);
    if (d.tie === 'last') out.push('Tie: last round'); else if (d.tie === 'qual') out.push('Tie: qualifying');
    if (d.sprintRound === 'up') out.push('Sprint rounded up'); else if (d.sprintRound === 'down') out.push('Sprint rounded down'); else if (d.sprintRound === 'none') out.push('Sprint not rounded');
    return out;
  }

  function rail(d, ctx) {
    const f = facts(d, ctx), bonus = bonusBits(d), teams = teamBits(d);
    const drop = !d.drops ? 'Every round counts' : f.races ? `Best ${Math.max(1, f.races - d.drops)} of ${f.races} count` : `${d.drops} worst ${d.drops === 1 ? 'result' : 'results'} dropped`;
    return {
      rounds: entry(f.rounds ? `${plural(f.rounds, 'round', 'rounds')} · ${plural(f.sessions, 'session', 'sessions')}` : 'No rounds yet', !f.rounds || f.looks.some(Boolean) ? 'todo' : 'ok'),
      points: entry(tableText(d), 'ok'),
      roster: entry(f.drivers ? `${plural(f.drivers, 'driver', 'drivers')}${f.teams ? ` · ${plural(f.teams, 'team', 'teams')}` : ''}` : 'No drivers yet', f.drivers ? 'ok' : 'plain'),
      bonus: entry(bonus.length ? bonus.join(' · ') : 'No bonus points', bonus.length ? 'ok' : 'plain'),
      drops: entry(drop, d.drops ? 'ok' : 'plain'),
      teams: entry(teams.length ? teams.slice(0, 2).join(' · ') + (teams.length > 2 ? ` · +${teams.length - 2} more` : '') : 'Standard', teams.length ? 'ok' : 'plain')
    };
  }

  const api = { describe, rail, remarks, looks, roundPill, dropSaid, raceRounds, tableText, bonusBits, teamBits, facts, joinAnd };
  root.ChampWords = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
