// A race setup in words (1.69.0). The Race Setups page and the form of a race setup say what a setup does in plain words: the pills of the header (kind, format, limit, track), the sentence
// "In plain words" (what it is, how it ends, who wins) and the two lines of a card (Ends, Wins). This file holds the sentences and nothing else (no screen, no storage), so they can be tested on their own.
// It reads a setup as the database keeps it, or as the form holds it (every value may be text) and changes nothing of it. The words follow the rules of the engine:
// a lap race is won by the first car to finish its laps, a time race by the most laps (or the furthest distance, when the cars are compared by distance) and then the lowest total time,
// a distance race by the first car to drive the distance, and heats by the overall result that the setup chooses (points, laps or time).
(function (root) {
  const KINDS = [['practice', 'Free practice'], ['qualifying', 'Qualifying'], ['race', 'Race'], ['heats', 'Heat-based race'], ['endurance', 'Endurance Race'], ['tokens', 'Time Token Session']];
  const num = v => { const t = String(v === undefined || v === null ? '' : v).trim().replace(',', '.'); const n = Number(t); return t !== '' && Number.isFinite(n) ? n : null; };
  const pos = v => { const n = num(v); return n !== null && n > 0 ? n : null; };
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const inOr = (v, list, d) => (list.includes(v) ? v : d);
  const cap = x => x.charAt(0).toUpperCase() + x.slice(1);

  // the name of the kind of session for the eyebrow of a card and the first pill: a heat-based race and an Endurance Race are races
  function kindOf(s) {
    const t = s && s.sessionType;
    if (t === 'practice') return 'Free practice';
    if (t === 'qualifying') return 'Qualifying';
    if (t === 'tokens') return 'Time tokens';
    return 'Race';
  }
  // how a race is limited, in words: '10 laps', '5 minutes', '100 m'; '' when the number is not typed (yet). dist(n) says a distance in the unit of the person (metres or feet).
  function lim(by, s, ctx, fields) {
    const f = fields || { laps: 'laps', duration: 'duration', distance: 'distance' };
    if (by === 'time') { const m = pos(s[f.duration]); return m === null ? '' : plural(m, 'minute', 'minutes'); }
    if (by === 'distance') { const d = pos(s[f.distance]); return d === null ? '' : ctx.dist(d); }
    const l = pos(s[f.laps]); return l === null ? '' : plural(l, 'lap', 'laps');
  }
  // what limits a heat of this setup ('laps', 'time' or 'distance'), and what limits a one-race session (a Race: raceBy, an Endurance Race: enduranceBy)
  const heatLimitBy = s => inOr(s.heatBy, ['laps', 'time', 'distance'], 'laps');
  const raceLimitBy = s => (s.sessionType === 'endurance' ? inOr(s.enduranceBy, ['time', 'laps', 'distance', 'heats'], 'time') : inOr(s.raceBy, ['laps', 'time', 'distance'], 'laps'));

  // the points of a heat for the card and the sentence: '10, 8, 6' (the first four at most)
  const pointsText = s => String(s.points === undefined || s.points === null || String(s.points).trim() === '' ? '10, 8, 6, 5, 4, 3, 2, 1' : s.points).split(',').map(x => x.trim()).filter(Boolean).slice(0, 4).join(', ');

  // the sentences about a race or a heat that ends by itself: say = a sentence of the plain words, card = the end of the line "Ends" of a card (it comes after "After 10 laps")
  function endsOne(by, s) {
    const leader = s.endRule === 'leader';
    if (by === 'time') return { card: '. Every car finishes on its next crossing of the line.', say: 'When the time is up, every car finishes on its next crossing of the line (that lap counts).' };
    if (by === 'distance') {
      const m = inOr(s.distanceMode, ['same', 'laps', 'manual'], 'same'), mx = pos(s.distanceMax);
      const how = m === 'laps' ? 'Every lane drives the same number of laps.' : m === 'manual' ? 'Every lane drives the distance you set for it.' : 'Every car drives the same distance, so a car in a shorter lane drives more laps.';
      const cardHow = m === 'laps' ? 'Every lane drives the same number of laps.' : m === 'manual' ? 'Every lane drives its own distance.' : 'Every car drives the same distance.';
      return { card: '. ' + cardHow + (leader ? ' It ends when the leader has finished.' : ''), say: how + ' ' + (leader ? 'It ends when the leader has finished.' : 'It ends when every car has finished.') + (mx ? ` It lasts ${plural(mx, 'minute', 'minutes')} at most.` : '') };
    }
    return { card: leader ? ', when the leader has finished.' : ', when every car has finished.', say: leader ? 'It ends when the leader has finished.' : 'It ends when every car has finished.' };
  }
  // who wins a race (one race, not heats)
  function winsOne(by, s, laps) {
    if (by === 'time') return s.compareBy === 'distance' ? 'The car that drove the furthest wins (laps times the length of its lane); with equal distance, the shortest total time.' : 'The car with the most laps wins; with equal laps, the shortest total time.';
    if (by === 'distance') return 'The first car to drive the distance wins.';
    return `The first car to finish ${laps || 'the laps'} wins.`;
  }
  // who wins the heats: the overall result the setup chooses
  function winsHeats(s, hb, nn) {
    const r = hb === 'time' ? inOr(s.resultByTime, ['lapstime', 'laps', 'points'], 'lapstime') : inOr(s.resultBy, ['laps', 'points', 'time'], 'laps');
    const final = s.finals === 'a' ? ' The best drivers then race a final.' : s.finals === 'ab' ? ' The best drivers then race an A final, and the next ones a B final.' : '';
    let w;
    const who = nn ? nn[0] : 'driver';
    if (r === 'points') w = `The ${who} with the most points over the heats wins.`;
    else if (r === 'time') w = `The ${who} with the lowest total time over the heats wins.`;
    else if (r === 'lapstime') w = `The ${who} with the most laps${s.compareBy === 'distance' ? ' (the furthest distance)' : ''} over the heats wins; with equal laps, the lowest total time.`;
    else w = `The ${who} with the most laps over the heats wins.`;
    return { result: r, text: w + final };
  }
  // how the heats are planned, in a sentence
  function planText(s, nn) {
    const one = nn ? nn[0] : 'driver', many = nn ? nn[1] : 'drivers';
    if (s.rotation) return null; // (the rotation setup plans them: the caller names it)
    const p = inOr(s.heatPlan, ['manual', 'perdriver', 'roundrobin', 'rotation'], 'manual'), n = pos(s.heats), e = pos(s.heatsEach);
    if (p === 'perdriver') return e ? `Every ${one} races ${plural(e, 'heat', 'heats')}.` : `Every ${one} races the same number of heats.`;
    if (p === 'roundrobin') return `Every ${one} meets every other ${one} (round robin).` + (s.heatEven === 'yes' ? ` Heats are added until everyone has raced as many as the busiest ${one}.` : '');
    if (p === 'rotation') return `Every ${one} races once in every lane.`;
    return n ? `There are ${plural(n, 'heat', 'heats')} and the ${many} are spread over them.` : `The ${many} are spread over a number of heats you choose.`;
  }
  const seedText = (s, nn) => (s.rotation || !['manual', 'perdriver'].includes(inOr(s.heatPlan, ['manual', 'perdriver', 'roundrobin', 'rotation'], 'manual')) ? '' : s.heatSeeding === 'mixed' ? `${cap((nn || ['driver', 'drivers'])[1])} are mixed fast and slow by the latest qualifying.` : s.heatSeeding === 'speed' ? `The fastest ${(nn || ['driver', 'drivers'])[1]} race together, the best heat last.` : `The ${(nn || ['driver', 'drivers'])[1]} are shuffled.`);
  const countText = (s, nn) => {
    const c = inOr(s.countBy, ['total', 'average', 'best'], 'total'), b = pos(s.bestHeats);
    return (c === 'average' ? 'The average per heat counts.' : c === 'best' ? `Only the best ${b ? plural(b, 'heat', 'heats') : 'heats'} of every ${nn ? nn[0] : 'driver'} count.` : 'All heats are added up.') + (s.dropWorst === 'yes' ? ` The worst heat of every ${nn ? nn[0] : 'driver'} is dropped.` : '');
  };
  // how the drivers of a team swap in the pits (an Endurance Race)
  function swapText(s, ctx) {
    const u = inOr(s.swapUnit, ['minutes', 'laps', 'distance'], 'minutes'), m = inOr(s.swapMode, ['every', 'moments', 'free'], 'every');
    if (m === 'moments') return 'The drivers of a team swap in the pits at fixed moments of the race.';
    if (m === 'free') return 'The drivers of a team swap in the pits when the team chooses.';
    if (u === 'distance') { const d = pos(s.swapEveryDist); return d ? `The drivers of a team swap in the pits every ${ctx.dist(d)}.` : 'The drivers of a team swap in the pits every so often.'; }
    const n = pos(s.swapEvery); return n ? `The drivers of a team swap in the pits every ${u === 'laps' ? plural(n, 'lap', 'laps') : plural(n, 'minute', 'minutes')}.` : 'The drivers of a team swap in the pits every so often.';
  }

  // The words for a setup. s: the setup (or the values of the form); ctx: { track: { name, lanes } | null, rotation: the name of the chosen rotation setup, dist: n => text of a distance }.
  // -> { kind, format, limit, place, pills: [{ text, tone }], cardPills: [{ text, tone }], say: [{ t, b }], ends, wins, ready: { ok, text } }
  function describe(s, ctx) {
    s = s || {}; ctx = ctx || {};
    const c = { track: ctx.track || null, rotation: ctx.rotation || '', dist: typeof ctx.dist === 'function' ? ctx.dist : n => `${n} m` };
    const t = inOr(s.sessionType, KINDS.map(k => k[0]), 'race');
    const tn = c.track && String(c.track.name || '').trim(), lanes = c.track ? pos(c.track.lanes) : null;
    const say = [], add = (x, b) => { if (x) say.push({ t: x, b: !!b }); };
    const heated = t === 'heats' || (t === 'endurance' && raceLimitBy(s) === 'heats');
    const swaps = t === 'endurance';
    const by = heated ? heatLimitBy(s) : raceLimitBy(s);
    const limit = t === 'practice' || t === 'tokens' ? '' : t === 'qualifying' ? lim('time', s, c) : lim(by, s, c);
    // the pills: kind, format, limit, track, lanes
    const format = t === 'race' ? 'One race' : t === 'heats' ? 'Heats' : t === 'endurance' ? (heated ? 'Heats with driver swaps' : 'Driver swaps') : '';
    let limitPill = limit;
    if (heated && limit) { const n = !s.rotation && inOr(s.heatPlan, ['manual', 'perdriver', 'roundrobin', 'rotation'], 'manual') === 'manual' ? pos(s.heats) : null; limitPill = n ? `${plural(n, 'heat', 'heats')} of ${limit}` : `${limit} per heat`; }
    const pills = [{ text: kindOf(s), tone: 'red' }, ...(format ? [{ text: format, tone: 'red' }] : []), ...(limitPill ? [{ text: limitPill, tone: '' }] : []), ...(tn ? [{ text: tn, tone: '' }] : []), ...(lanes ? [{ text: plural(lanes, 'lane', 'lanes'), tone: '' }] : [])];
    const place = tn ? (lanes ? `${tn}, ${plural(lanes, 'lane', 'lanes')}` : tn) : '';
    // the pills of a card: the kind is its eyebrow, so they start at the format, and the track and its lanes are one pill
    const cardPills = [...(format ? [{ text: format, tone: 'red' }] : []), ...(limitPill ? [{ text: limitPill, tone: '' }] : []), ...(place ? [{ text: place, tone: '' }] : [])];
    const onTrack = tn ? [' on ', tn] : null;
    const onPlace = () => { if (onTrack) { add(onTrack[0]); add(onTrack[1], true); } };
    let ends = '', wins = '';

    if (t === 'tokens') {
      add('A '); add('time token session', true); onPlace(); add('. It is not a race: each lane is switched on with paid time and turns red when the time is up.');
      ends = 'Runs until you stop it.'; wins = 'No winner: this is not a race.';
    } else if (t === 'practice') {
      add('A '); add('free practice', true); add(' session'); onPlace(); add('. Everyone drives and the cars are ranked by their fastest lap. It runs until you stop it.');
      ends = 'Runs until you stop it.'; wins = 'Ranked by the fastest lap.';
    } else if (t === 'qualifying') {
      add('A '); add('qualifying', true); add(' session'); if (limit) { add(' of '); add(limit, true); } onPlace(); add('. The cars are ranked by their fastest lap.');
      ends = limit ? `After ${limit}.` : 'After a time you set.'; wins = 'Ranked by the fastest lap.';
    } else if (!heated) { // one race (a race, or an Endurance Race of a time, laps or distance)
      const e = endsOne(by, s), ln = pos(s.laps), lapsText = by === 'laps' ? (ln === 1 ? 'the lap' : ln ? `the ${ln} laps` : 'the laps') : '';
      add(swaps ? 'An ' : 'A '); add(swaps ? 'endurance race' : 'race', true); if (limit) { add(' of '); add(limit, true); } onPlace(); add('. ');
      if (swaps) add(swapText(s, c) + ' ');
      add(e.say + ' ' + winsOne(by, s, lapsText));
      wins = winsOne(by, s, lapsText); ends = limit ? `After ${limit}${e.card}` : e.card.replace(/^[.,] ?/, '').replace(/^./, x => x.toUpperCase());
    } else { // heats (a heat-based race, or an Endurance Race of heats)
      const nn = swaps || s.participants === 'teams' ? ['team', 'teams'] : ['driver', 'drivers'], w = winsHeats(s, by, nn), plan = planText(s, nn), seed = seedText(s, nn), br = pos(s.breakSeconds);
      add('A '); add(swaps ? 'race in heats with driver swaps' : 'race in heats', true); onPlace(); add('. ');
      if (s.rotation) { add('The heats follow the rotation setup '); add(c.rotation || 'you chose', !!c.rotation); add('. '); } else if (plan) add(plan + ' ');
      if (!s.rotation && t === 'heats' && s.participants === 'teams') add('The teams race, and the drivers of a team take turns. ');
      if (seed) add(seed + ' ');
      if (swaps) add(swapText(s, c) + ' ');
      add('Each heat is over after '); add(limit || (by === 'laps' ? 'a number of laps' : by === 'time' ? 'a time' : 'a distance'), !!limit); add('. ');
      if (w.result === 'points') add(`A heat scores points by position (${pointsText(s)}).${pos(s.fastestBonus) ? ` The fastest lap of a heat gets ${plural(pos(s.fastestBonus), 'extra point', 'extra points')}.` : ''} `);
      add(countText(s, nn) + ' ' + w.text);
      if (br) add(` There is a break of ${plural(br, 'second', 'seconds')} between heats${s.breakAuto === 'yes' ? ', and then the start lights begin by themselves' : ''}.`);
      const heatsN = !s.rotation && inOr(s.heatPlan, ['manual', 'perdriver', 'roundrobin', 'rotation'], 'manual') === 'manual' ? pos(s.heats) : null;
      ends = `Each heat is over after ${limit || 'a set limit'}.${heatsN ? ` ${plural(heatsN, 'heat', 'heats')} in all.` : ''}`;
      wins = w.text;
    }
    const ok = !!tn;
    return { kind: kindOf(s), format, limit, place, pills, cardPills, say, ends, wins, ready: { ok, text: ok ? 'Ready to race' : 'Choose a track' } };
  }
  const plain = parts => parts.map(p => p.t).join('');

  // ---- the picker (1.70.0): three questions instead of the Session type dropdown ----
  // The dropdown answered three questions at once: what kind of session it is, one race or heats, and do the teams swap drivers. The form now asks them one by one. Nothing new is stored:
  // the answers are read from, and written as, the same two settings as before, so every setup opens as it was.
  //   Kind: Free practice (practice), Qualifying (qualifying), Time tokens (tokens), or Race (race, heats or endurance)
  //   Format (a Race only): One race, or Heats        Swaps (a Race only): off, or the drivers of a team swap in the pits
  //   One race, no swaps: sessionType race      Heats, no swaps: sessionType heats
  //   One race with swaps: sessionType endurance, enduranceBy time, laps or distance      Heats with swaps: sessionType endurance, enduranceBy heats
  const PICKER = {
    kinds: [['practice', 'Free practice', 'Everyone drives. Ranked by fastest lap.'], ['qualifying', 'Qualifying', 'Ranked by fastest lap. The result can seed the heats.'],
      ['race', 'Race', 'Laps and time decide the winner.'], ['tokens', 'Time tokens', 'Not a race. You sell track time per lane.']],
    formats: [['one', 'One race', 'All cars start together and there is one result.'], ['heats', 'Heats', 'A series of races. Drivers take turns and the heats are added up.']],
    swaps: ['Teams swap drivers in the pits', 'An endurance race: the drivers of a team take turns in the same car.'],
    icons: { practice: 'car', qualifying: 'timing', race: 'racesetups', tokens: 'tokens', one: 'arrow', heats: 'layers' }
  };
  const UNITS = ['laps', 'time', 'distance'];
  // the three answers of a setup (or of the values of the form): { kind, format, swaps }; format is '' and swaps false for a kind that is not a race
  function parts(s) {
    s = s || {};
    const t = inOr(s.sessionType, KINDS.map(k => k[0]), 'race');
    if (t === 'practice' || t === 'qualifying' || t === 'tokens') return { kind: t, format: '', swaps: false };
    return { kind: 'race', format: t === 'heats' || (t === 'endurance' && s.enduranceBy === 'heats') ? 'heats' : 'one', swaps: t === 'endurance' };
  }
  // the setting that says what a race, or a heat, is over after: a race raceBy, a race with swaps enduranceBy, heats (with or without swaps) heatBy
  const limitKey = p => (p.format === 'heats' ? 'heatBy' : p.swaps ? 'enduranceBy' : 'raceBy');
  // What to store when an answer changes: the settings that change, as { sessionType, enduranceBy?, raceBy?, heatBy? }. s: the values now. change: { kind } or { format } or { swaps }.
  // memory: what the race was before another kind was chosen ({ format, swaps }), so Race comes back as it was. "Over after" (laps, time or distance) goes along with the answer: it is the
  // same question for a race, a race with swaps and a heat, but each has its own setting, so the one that is used from now on gets the answer of the one that was used.
  function pick(s, change, memory) {
    s = s || {}; change = change || {};
    const now = parts(s);
    let p = { ...now, ...change };
    if (change.kind === 'race' && now.kind !== 'race') { const m = memory || {}; p = { kind: 'race', format: m.format === 'heats' ? 'heats' : 'one', swaps: !!m.swaps }; }
    if (p.kind !== 'race') return { sessionType: p.kind };
    const out = { sessionType: p.swaps ? 'endurance' : p.format === 'heats' ? 'heats' : 'race' };
    if (p.swaps && p.format === 'heats') out.enduranceBy = 'heats';
    if (now.kind === 'race') {
      const from = limitKey(now), to = limitKey(p), unit = s[from];
      if (from !== to && UNITS.includes(unit)) out[to] = unit;
    }
    if (p.swaps && p.format === 'one' && !UNITS.includes(out.enduranceBy !== undefined ? out.enduranceBy : s.enduranceBy)) out.enduranceBy = 'time'; // (it must not stay "heats": that would make it heats again)
    return out;
  }

  // ---- the rail (1.71.0): a short note and a dot for every section of the form ----
  // The form has a rail on the left with a row for every section: its name, a short note of what it holds now, and a dot. The same note, a little longer, is on the row of a section that is closed.
  // The dot: green = filled in (Session, Heats and Ends and winner: what they need is there) or changed from the standard (all the others); an amber dot = something that is needed is missing;
  // an open ring = nothing changed from the standard. This file works out the notes and the dots from the values of the form and nothing else, so they can be tested on their own.
  //   s: the values of the form, by setting (every value may be text)
  //   ctx: { track, rotation, dist (see describe), defaults: { setting: its standard value }, shown: setting => is it shown now? (a setting that is hidden counts for nothing) }
  //   -> { id: { rail, row, state: 'ok' | 'todo' | 'plain' } } for the sections session, heats, length, endurance, rules, service, screens and advanced
  const SYSTEMS = [['fuelRules', 'Fuel', 'fuel system', 'fuel'], ['penaltySystem', 'Penalty', 'penalty system', 'penalty'], ['damageSystem', 'Damage', 'damage system', 'damage'],
    ['safetyCar', 'Safety car', 'safety car system', 'safetycar'], ['tyreWear', 'Tyre wear', 'tyre wear system', 'tyrewear'], ['weather', 'Weather', 'weather system', 'weather'], ['pushSave', 'Push & Save', 'push and save system', 'pushsave']];
  const ADVANCED = [['trackmate', 'Timing hardware', 'timing hardware', ['startPower']], ['box', 'Box', 'SlotForge box', ['boxPit', 'boxLanePower', 'boxBeeps', 'boxLaneLights']]];
  const text = v => (v === undefined || v === null ? '' : String(v));
  const cleanParts = list => list.filter(Boolean);
  function rail(s, ctx) {
    s = s || {}; ctx = ctx || {};
    const c = { dist: typeof ctx.dist === 'function' ? ctx.dist : n => `${n} m`, track: ctx.track || null, rotation: ctx.rotation || '' };
    const shown = typeof ctx.shown === 'function' ? ctx.shown : () => true, defs = ctx.defaults || {};
    // changed from the standard: shown, typed, and not the standard value (an empty field uses the standard, so it is not a change)
    const changed = keys => keys.filter(k => shown(k) && text(s[k]).trim() !== '' && text(s[k]).trim() !== text(defs[k]).trim());
    const t = inOr(s.sessionType, KINDS.map(k => k[0]), 'race'), p = parts(s);
    const heated = p.kind === 'race' && p.format === 'heats', swaps = p.swaps;
    const out = {};
    const make = (rail, row, state) => ({ rail: rail.join(' · '), row: cap(row.join(', ')), state });
    // Session: the kind, the format and the swaps (a race), and the track
    const kindName = { practice: 'Free practice', qualifying: 'Qualifying', tokens: 'Time tokens', race: 'Race' }[p.kind];
    const tn = c.track && text(c.track.name).trim(), named = text(s.name).trim() !== '';
    out.session = make(p.kind === 'race' ? ['Race', heated ? 'heats' : 'one race', ...(swaps ? ['driver swaps'] : [])] : [kindName],
      p.kind === 'race' ? ['Race', heated ? 'heats' : 'one race', swaps ? 'driver swaps' : 'no driver swaps', tn ? `on ${tn}` : 'no track chosen'] : [kindName, tn ? `on ${tn}` : 'no track chosen'], named && tn ? 'ok' : 'todo');
    // Heats: how they are planned and who races together
    {
      const plan = inOr(s.heatPlan, ['manual', 'perdriver', 'roundrobin', 'rotation'], 'manual'), n = pos(s.heats), e = pos(s.heatsEach), br = pos(s.breakSeconds), own = !s.rotation;
      const planRail = !own ? `Rotation: ${c.rotation || 'chosen'}` : plan === 'perdriver' ? (e ? `${e} each` : 'Same for every driver') : plan === 'roundrobin' ? 'Round robin' : plan === 'rotation' ? 'Every lane once' : (n ? plural(n, 'heat', 'heats') : 'Number of heats');
      const planRow = !own ? `rotation ${c.rotation || 'chosen'}` : plan === 'perdriver' ? (e ? `${plural(e, 'heat', 'heats')} for every driver` : 'the same for every driver') : plan === 'roundrobin' ? 'everyone meets everyone' : plan === 'rotation' ? 'every lane once' : (n ? plural(n, 'heat', 'heats') : 'a number of heats');
      const seeded = own && (plan === 'manual' || plan === 'perdriver'), sd = inOr(s.heatSeeding, ['random', 'mixed', 'speed'], 'random');
      const seedRail = seeded ? { random: 'shuffled', mixed: 'mixed by qualifying', speed: 'fastest together' }[sd] : '', seedRow = seeded ? { random: 'shuffled', mixed: 'mixed fast and slow', speed: 'fastest together, best heat last' }[sd] : '';
      out.heats = heated ? make(cleanParts([planRail, seedRail]), cleanParts([planRow, seedRow, br ? `a break of ${plural(br, 'second', 'seconds')}` : '']), own && ((plan === 'manual' && !n) || (plan === 'perdriver' && !e)) ? 'todo' : 'ok') : make([], [], 'plain');
    }
    // Race Settings: how long it lasts, who wins, and the start / pit / Track Call rules.
    {
      const by = heated ? heatLimitBy(s) : raceLimitBy(s), limit = p.kind === 'qualifying' ? lim('time', s, c) : p.kind === 'race' ? lim(by, s, c) : '';
      if (p.kind === 'race' && !heated) {
        const win = by === 'time' ? (s.compareBy === 'distance' ? 'furthest wins' : 'most laps wins') : by === 'distance' ? 'first to drive it wins' : 'first to finish wins';
        const lo = pos(s.lightsMin), hi = pos(s.lightsMax), span = lo && hi ? (lo === hi ? `${lo}` : `${lo}–${hi}`) : lo || hi || '';
        out.length = make(cleanParts([limit || (by === 'laps' ? 'Set the laps' : by === 'time' ? 'Set the time' : 'Set the distance'), win, span ? `lights ${span} s` : '']), cleanParts([limit || 'no limit set yet', win, span ? `lights out after ${span} seconds` : '']), limit ? 'ok' : 'todo');
      } else if (heated) {
        const r = by === 'time' ? inOr(s.resultByTime, ['lapstime', 'laps', 'points'], 'lapstime') : inOr(s.resultBy, ['laps', 'points', 'time'], 'laps');
        const res = r === 'points' ? 'Most points' : r === 'time' ? 'Lowest total time' : s.compareBy === 'distance' && by === 'time' ? 'Furthest distance' : 'Most laps';
        const cb = inOr(s.countBy, ['total', 'average', 'best'], 'total'), b = pos(s.bestHeats);
        const count = cb === 'best' ? `best ${b || 'few'} count` : cb === 'average' ? 'average counts' : '', drop = s.dropWorst === 'yes' ? 'worst heat dropped' : '';
        out.length = make(cleanParts([res, count, drop]), cleanParts([limit ? `${limit} per heat` : 'no heat limit set yet', res.toLowerCase(), count, drop]), limit ? 'ok' : 'todo');
      } else if (p.kind === 'qualifying') out.length = make([limit || 'Set the time', 'fastest lap'], [limit || 'no time set yet', 'ranked by the fastest lap'], limit ? 'ok' : 'todo');
      else out.length = make(['No limit'], ['no limit, runs until you stop it'], 'plain');
    }
    // Driver swaps (an Endurance Race): when the drivers of a team swap
    {
      const u = inOr(s.swapUnit, ['minutes', 'laps', 'distance'], 'minutes'), m = inOr(s.swapMode, ['every', 'moments', 'free'], 'every');
      let w, ok = true;
      if (m === 'moments') w = 'at fixed moments'; else if (m === 'free') w = 'when the team chooses';
      else if (u === 'distance') { const d = pos(s.swapEveryDist); ok = !!d; w = d ? `every ${c.dist(d)}` : 'every so often'; } else { const n = pos(s.swapEvery); ok = !!n; w = n ? `every ${u === 'laps' ? plural(n, 'lap', 'laps') : plural(n, 'minute', 'minutes')}` : 'every so often'; }
      out.endurance = swaps ? make([`Swap ${w}`], [`teams swap ${w}`], ok ? 'ok' : 'todo') : make([], [], 'plain');
    }
    // Rules and systems: selected systems stay visible when their saved default is Off.
    {
      const off = new Set(String(s.disabledSystems || '').split(',').map(x => x.trim()));
      const on = SYSTEMS.filter(x => shown(x[0]) && text(s[x[0]]) !== '').map(x => [off.has(x[3]) ? `${x[1]} off` : x[1], off.has(x[3]) ? `${x[2]} off by default` : x[2]]);
      if(shown('resourceSystem')&&text(s.resourceSystem))on.push(['Resources','resource allocation']);
      if (shown('bop') && s.bop === 'on') on.push([off.has('bop') ? 'Balance of Power off' : 'Balance of Power', off.has('bop') ? 'Balance of Power off by default' : 'Balance of Power']);
      out.rules = on.length ? make(on.map(x => x[0]), on.map(x => x[1]), 'ok') : make(['No systems'], ['no systems chosen'], 'plain');
    }
    out.service = s.serviceStop === 'on' && t !== 'tokens' ? make([`${pos(s.pitHoldSeconds) || 30} s`, s.pitHoldMode === 'manual' ? 'manual release' : 'automatic release'], ['fixed service stop, penalties add time'], 'ok') : make(['Off', 'follow sensor'], ['service stop off; normal pit rules'], changed(['pitHold']).length ? 'ok' : 'plain');
    // Screens and sound: the layouts and the audio set that are chosen
    {
      const on = [['layout', 'Main screen', 'main screen layout'], ['layout2', 'Second screen', 'second screen layout'], ['audioSet', 'Audio', 'audio set']].filter(x => shown(x[0]) && text(s[x[0]]) !== '');
      out.screens = on.length ? make(on.map(x => x[1]), on.map(x => x[2]), 'ok') : make(['Default layout', 'no audio'], ['default layout', 'no audio'], 'plain');
    }
    // Advanced: yellow flag, the Adjust pads, Trackmate and the SlotForge box (only the ones that have something to show now)
    {
      const here = ADVANCED.filter(a => a[3].some(shown)), did = here.filter(a => changed(a[3]).length);
      out.advanced = { rail: (did.length ? did : here).map(a => a[1]).join(' · '), row: cap(here.map(a => a[2]).join(', ') + '. ' + (did.length ? `Changed: ${did.map(a => a[2]).join(', ')}.` : 'Nothing changed.')), state: did.length ? 'ok' : 'plain' };
    }
    return out;
  }

  const api = { KINDS, PICKER, kindOf, describe, plain, parts, pick, rail };
  root.SetupWords = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
