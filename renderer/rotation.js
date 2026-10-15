// Rotation setups (1.6.0): a heat plan that you make yourself. Which participant races in which heat and in which lane is not generated from the
// race setup but drawn by hand in Race Setup > Rotation Setups, saved, and chosen in a race setup. Pure: no screen in here (the editor is in editor.js).
// A rotation is built on participant NUMBERS (participant 1, 2, 3...), the same ones the Home tab shows, because the drivers are chosen on Home just
// before the race. A participant can have a name (a hint for you; Home can pick the drivers with those names).
//   { name, note, participants, lanes, names: [text per participant], groups: [{ name, members: [participant numbers] }],
//     heats: [{ label, locked, places: [{ p, lane }] }] }       (p and lane are counted from 0)
// Every change gives { rec } (a new rotation; the old one is not touched) or { error } (a sentence for the person).
(function (root) {
  const Heats = typeof module !== 'undefined' ? require('./heats.js') : root.Heats;

  const LIMITS = { minP: 2, maxP: 64, maxLanes: 8, maxHeats: 200, maxGroups: 20, name: 40, label: 30, person: 30, note: 200 };
  const int = (v, d, lo, hi) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
  const clone = x => JSON.parse(JSON.stringify(x));
  const shuffled = (list, rnd) => { const x = [...list]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };

  // A rotation in its proper form: numbers kept inside their limits, places that do not exist thrown away, a participant and a lane used once per heat.
  // edit: the rotation is being edited, so a text keeps the spaces typed so far and may be empty.
  function clean(src, edit) {
    const s = src && typeof src === 'object' ? src : {};
    const t = (v, max, d) => { const x = String(v === undefined || v === null ? '' : v); return (edit ? x : x.trim()).slice(0, max) || d; };
    const n = int(s.participants, 8, LIMITS.minP, LIMITS.maxP), lanes = int(s.lanes, 4, 1, LIMITS.maxLanes);
    const validP = p => Number.isInteger(p) && p >= 0 && p < n;
    const names = Array.from({ length: n }, (_, i) => t(Array.isArray(s.names) ? s.names[i] : '', LIMITS.person, ''));
    const heats = (Array.isArray(s.heats) ? s.heats : []).slice(0, LIMITS.maxHeats).map(h => {
      const seenP = new Set(), seenL = new Set(), places = [];
      for (const e of (h && Array.isArray(h.places) ? h.places : [])) {
        if (!e || !validP(e.p) || !Number.isInteger(e.lane) || e.lane < 0 || e.lane >= lanes || seenP.has(e.p) || seenL.has(e.lane)) continue;
        seenP.add(e.p); seenL.add(e.lane); places.push({ p: e.p, lane: e.lane });
      }
      places.sort((a, b) => a.lane - b.lane);
      return { label: t(h && h.label, LIMITS.label, ''), locked: !!h && h.locked === true, places };
    });
    const groups = (Array.isArray(s.groups) ? s.groups : []).slice(0, LIMITS.maxGroups).map((g, i) => {
      const seen = new Set(), members = [];
      for (const p of (g && Array.isArray(g.members) ? g.members : [])) if (validP(p) && !seen.has(p)) { seen.add(p); members.push(p); }
      return { name: t(g && g.name, LIMITS.label, edit ? '' : 'Group ' + (i + 1)), members: members.sort((a, b) => a - b) };
    });
    return { name: t(s.name, LIMITS.name, edit ? '' : 'Rotation'), note: t(s.note, LIMITS.note, ''), participants: n, lanes, names, groups, heats, ...(s.participantsAre === 'teams' ? { participantsAre: 'teams' } : {}) };
  }
  const done = r => ({ rec: clean(r, true) });

  // The text for a participant: the name when it has one, otherwise "Participant 3" (short: "P3").
  // (1.8.0: the participants of a rotation are drivers, or teams: the numbers are the same, only the words change)
  const isTeams = rec => !!rec && rec.participantsAre === 'teams';
  const own = (rec, p) => String((rec.names && rec.names[p]) || '').trim();
  const nameOf = (rec, p) => own(rec, p) || (isTeams(rec) ? 'Team ' : 'Participant ') + (p + 1);
  const shortOf = (rec, p) => own(rec, p) || (isTeams(rec) ? 'T' : 'P') + (p + 1);

  // ---- making one ----
  // A new rotation: everybody races once, in heats that are as even as can be (9 participants on 4 lanes: 3 heats of 3).
  function blank(n, lanes, name) {
    n = int(n, 8, LIMITS.minP, LIMITS.maxP); lanes = int(lanes, 4, 1, LIMITS.maxLanes);
    const count = Math.ceil(n / lanes), base = Math.floor(n / count), extra = n % count, heats = []; let next = 0;
    for (let h = 0; h < count; h++) {
      const size = base + (h < extra ? 1 : 0);
      heats.push({ label: '', locked: false, places: Array.from({ length: size }, (_, k) => ({ p: next++, lane: k })) });
    }
    return clean({ name: name || 'New rotation', participants: n, lanes, heats }, true);
  }
  // Start from one of the plans the race setup can make (shuffled, the same number of heats for everyone, round robin, lane rotation). Replaces all heats (also locked ones).
  // opts: { plan, heats, each, even }
  function generate(rec, opts, seed) {
    const o = opts || {}, plan = Heats.PLANS.includes(o.plan) ? o.plan : 'manual';
    const sched = Heats.plan({ count: rec.participants, lanes: rec.lanes, setup: { heatPlan: plan, heats: o.heats, heatsEach: o.each, heatEven: o.even ? 'yes' : 'no', heatSeeding: 'random' }, seed: seed || Heats.newSeed() });
    if (!sched.length) return { error: 'No heats could be made.' };
    if (sched.length > LIMITS.maxHeats) return { error: `That makes ${sched.length} heats. The most is ${LIMITS.maxHeats}.` };
    return done({ ...rec, heats: sched.map(h => ({ label: '', locked: false, places: h.map(e => ({ p: e.p, lane: e.lane })) })) });
  }
  // The number of participants or lanes changes: places that no longer exist go. dropped: how many places went (the screen asks first when it is more than none).
  function resize(rec, participants, lanes) {
    const next = clean({ ...rec, participants, lanes }, true), count = r => r.heats.reduce((t, h) => t + h.places.length, 0);
    return { rec: next, dropped: count(rec) - count(next) };
  }

  // ---- changing places ----
  const heatAt = (rec, i) => (Number.isInteger(i) && i >= 0 && i < rec.heats.length ? rec.heats[i] : null);
  const laneOk = (rec, l) => Number.isInteger(l) && l >= 0 && l < rec.lanes;
  const locked = i => ({ error: `Heat ${i + 1} is locked. Unlock it first to change it.` });

  // Puts participant p in a place (and takes p out of any other lane of that heat). p = null empties the place.
  function place(rec, heat, lane, p) {
    const h = heatAt(rec, heat);
    if (!h || !laneOk(rec, lane)) return { error: 'That place is not in the rotation.' };
    if (h.locked) return locked(heat);
    if (p !== null && !(Number.isInteger(p) && p >= 0 && p < rec.participants)) return { error: 'That participant does not exist.' };
    const next = clone(rec), x = next.heats[heat];
    x.places = x.places.filter(e => e.lane !== lane && e.p !== p);
    if (p !== null) x.places.push({ p, lane });
    return done(next);
  }
  // Two places swap (a and b are { heat, lane }); a place can be empty, then the participant of the other place moves there.
  function swap(rec, a, b) {
    const ha = a && heatAt(rec, a.heat), hb = b && heatAt(rec, b.heat);
    if (!ha || !hb || !laneOk(rec, a.lane) || !laneOk(rec, b.lane)) return { error: 'That place is not in the rotation.' };
    if (a.heat === b.heat && a.lane === b.lane) return { error: 'Those are the same place.' };
    if (ha.locked) return locked(a.heat);
    if (hb.locked) return locked(b.heat);
    const at = (h, l) => h.places.find(e => e.lane === l) || null, ea = at(ha, a.lane), eb = at(hb, b.lane);
    if (!ea && !eb) return { error: 'Both places are empty.' };
    const next = clone(rec), xa = next.heats[a.heat], xb = next.heats[b.heat];
    xa.places = xa.places.filter(e => e.lane !== a.lane);
    xb.places = xb.places.filter(e => e.lane !== b.lane);
    if (ea) xb.places.push({ p: ea.p, lane: b.lane });
    if (eb) xa.places.push({ p: eb.p, lane: a.lane });
    for (const x of new Set([xa, xb])) if (new Set(x.places.map(e => e.p)).size !== x.places.length) return { error: 'That would put a participant in the same heat twice.' };
    return done(next);
  }
  // A whole group in one heat: the members take lane 1, 2, 3... in the order of their numbers, and the other places of the heat are emptied.
  function assignGroup(rec, heat, group) {
    const h = heatAt(rec, heat), g = rec.groups[group];
    if (!h) return { error: 'That heat is not in the rotation.' };
    if (!g) return { error: 'That group does not exist.' };
    if (h.locked) return locked(heat);
    if (!g.members.length) return { error: `The group "${g.name || 'Group ' + (group + 1)}" has no participants yet.` };
    if (g.members.length > rec.lanes) return { error: `The group "${g.name || 'Group ' + (group + 1)}" has ${g.members.length} participants, and a heat holds only ${rec.lanes}.` };
    const next = clone(rec);
    next.heats[heat].places = g.members.map((p, k) => ({ p, lane: k }));
    return done(next);
  }

  // ---- changing heats ----
  const mapHeats = (rec, f) => { const next = clone(rec); next.heats = f(next.heats); return done(next); };
  function addHeat(rec) {
    if (rec.heats.length >= LIMITS.maxHeats) return { error: `A rotation holds at most ${LIMITS.maxHeats} heats.` };
    return mapHeats(rec, hs => [...hs, { label: '', locked: false, places: [] }]);
  }
  function removeHeat(rec, i) {
    const h = heatAt(rec, i); if (!h) return { error: 'That heat is not in the rotation.' };
    if (h.locked) return locked(i);
    return mapHeats(rec, hs => hs.filter((_, n) => n !== i));
  }
  // A copy of a heat straight after it (not locked).
  function duplicateHeat(rec, i) {
    const h = heatAt(rec, i); if (!h) return { error: 'That heat is not in the rotation.' };
    if (rec.heats.length >= LIMITS.maxHeats) return { error: `A rotation holds at most ${LIMITS.maxHeats} heats.` };
    return mapHeats(rec, hs => { const copy = clone(hs[i]); copy.locked = false; hs.splice(i + 1, 0, copy); return hs; });
  }
  function clearHeat(rec, i) {
    const h = heatAt(rec, i); if (!h) return { error: 'That heat is not in the rotation.' };
    if (h.locked) return locked(i);
    return mapHeats(rec, hs => { hs[i].places = []; return hs; });
  }
  // A heat moves one place up (dir -1) or down (dir 1). A locked heat stays where it is, and a heat does not move past a locked heat.
  function moveHeat(rec, i, dir) {
    const h = heatAt(rec, i), j = i + (dir < 0 ? -1 : 1), o = heatAt(rec, j);
    if (!h) return { error: 'That heat is not in the rotation.' };
    if (!o) return { error: dir < 0 ? 'This is the first heat.' : 'This is the last heat.' };
    if (h.locked) return locked(i);
    if (o.locked) return locked(j);
    return mapHeats(rec, hs => { [hs[i], hs[j]] = [hs[j], hs[i]]; return hs; });
  }
  function setLabel(rec, i, label) {
    if (!heatAt(rec, i)) return { error: 'That heat is not in the rotation.' };
    return mapHeats(rec, hs => { hs[i].label = String(label === undefined || label === null ? '' : label); return hs; });
  }
  function setLocked(rec, i, on) {
    if (!heatAt(rec, i)) return { error: 'That heat is not in the rotation.' };
    return mapHeats(rec, hs => { hs[i].locked = !!on; return hs; });
  }
  // The heats that are not locked take the free positions in another order; locked heats stay where they are.
  const reorder = (rec, f) => mapHeats(rec, hs => {
    const free = hs.map((h, i) => (h.locked ? -1 : i)).filter(i => i >= 0), order = f(free.map(i => hs[i]));
    free.forEach((i, n) => { hs[i] = order[n]; });
    return hs;
  });
  const shuffleOrder = (rec, seed) => reorder(rec, list => shuffled(list, Heats.makeRng(seed || Heats.newSeed())));
  const reverseOrder = rec => reorder(rec, list => list.slice().reverse());
  // Inside every heat that is not locked, the participants stand in other lanes (of the lanes that heat uses).
  function shuffleLanes(rec, seed) {
    const rnd = Heats.makeRng(seed || Heats.newSeed());
    return mapHeats(rec, hs => {
      hs.forEach(h => { if (h.locked || h.places.length < 2) return; const lanes = h.places.map(e => e.lane), mix = shuffled(h.places.map(e => e.p), rnd); h.places = lanes.map((l, n) => ({ p: mix[n], lane: l })); });
      return hs;
    });
  }
  // The lanes of the heats that are not locked are given out again, so that every participant drives in every lane about equally often (who races in which heat stays as it is).
  function evenLanes(rec, seed) {
    const idx = rec.heats.map((h, i) => (h.locked || !h.places.length ? -1 : i)).filter(i => i >= 0);
    if (!idx.length) return { error: 'There are no heats to change.' };
    const groups = idx.map(i => rec.heats[i].places.map(e => e.p)), out = Heats.assignLanes(groups, rec.lanes, Heats.makeRng(seed || Heats.newSeed()));
    return mapHeats(rec, hs => { idx.forEach((i, n) => { hs[i].places = out[n].map(e => ({ p: e.p, lane: e.lane })); }); return hs; });
  }

  // ---- names and groups ----
  // The participants are drivers (chosen on Home) or teams (a team and a car are chosen on Home; the drivers of the team take turns in the heats).
  function setParticipantsAre(rec, kind) {
    if (kind !== 'drivers' && kind !== 'teams') return { error: 'The participants are drivers or teams.' };
    const next = clone(rec); if (kind === 'teams') next.participantsAre = 'teams'; else delete next.participantsAre; return done(next);
  }
  function setName(rec, p, name) {
    if (!(Number.isInteger(p) && p >= 0 && p < rec.participants)) return { error: 'That participant does not exist.' };
    const next = clone(rec); next.names[p] = String(name === undefined || name === null ? '' : name); return done(next);
  }
  function addGroup(rec) {
    if (rec.groups.length >= LIMITS.maxGroups) return { error: `A rotation holds at most ${LIMITS.maxGroups} groups.` };
    const next = clone(rec); next.groups.push({ name: 'Group ' + (rec.groups.length + 1), members: [] }); return done(next);
  }
  function removeGroup(rec, i) {
    if (!rec.groups[i]) return { error: 'That group does not exist.' };
    const next = clone(rec); next.groups.splice(i, 1); return done(next);
  }
  function renameGroup(rec, i, name) {
    if (!rec.groups[i]) return { error: 'That group does not exist.' };
    const next = clone(rec); next.groups[i].name = String(name === undefined || name === null ? '' : name); return done(next);
  }
  // A participant is in the group or not (a participant can be in several groups).
  function toggleMember(rec, i, p) {
    if (!rec.groups[i]) return { error: 'That group does not exist.' };
    if (!(Number.isInteger(p) && p >= 0 && p < rec.participants)) return { error: 'That participant does not exist.' };
    const next = clone(rec), m = next.groups[i].members, at = m.indexOf(p);
    if (at >= 0) m.splice(at, 1); else m.push(p);
    return done(next);
  }

  // ---- using one ----
  // The heats as the race needs them. absent: participants who are not here today (their places stay empty and the participants after them move up in number);
  // a heat with nobody left is left out. Gives { schedule: [[{ p, lane }]], keep: the participants who are here (old numbers, in order), labels, heatNos: the heat number in the rotation }.
  function scheduleFor(rec, absent) {
    const gone = new Set((absent || []).filter(Number.isInteger)), keep = [];
    for (let p = 0; p < rec.participants; p++) if (!gone.has(p)) keep.push(p);
    const at = new Map(keep.map((p, i) => [p, i])), schedule = [], labels = [], heatNos = [];
    rec.heats.forEach((h, i) => {
      const places = h.places.filter(e => at.has(e.p)).map(e => ({ p: at.get(e.p), lane: e.lane }));
      if (places.length) { schedule.push(places); labels.push(h.label || ''); heatNos.push(i + 1); }
    });
    return { schedule, keep, labels, heatNos };
  }
  const lanesUsed = rec => rec.heats.reduce((m, h) => h.places.reduce((n, e) => Math.max(n, e.lane + 1), m), 0);
  // A key for the plan: the same key means the same heats (the Home tab keeps the changes you made by hand only for the same key).
  const signature = (rec, absent) => JSON.stringify([rec.participants, rec.lanes, rec.heats.map(h => h.places.map(e => e.p + ':' + e.lane).join(',')), (absent || []).slice().sort((a, b) => a - b)]);

  // What stops this rotation from being raced here? rows: the number of participants on Home; trackLanes: the lanes of the track; here: how many are here today.
  function problems(rec, { rows, trackLanes, here }) {
    const out = [];
    if (rows !== rec.participants) out.push(`The rotation "${rec.name}" has ${rec.participants} participants and you have ${rows}.`);
    const used = lanesUsed(rec);
    if (trackLanes && used > trackLanes) {
      const hs = rec.heats.map((h, i) => (h.places.some(e => e.lane >= trackLanes) ? i + 1 : 0)).filter(Boolean);
      out.push(`The rotation uses lane ${used}, and this track has ${trackLanes} lanes (heat ${hs.slice(0, 5).join(', ')}${hs.length > 5 ? ' and more' : ''}).`);
    }
    if (!rec.heats.some(h => h.places.length)) out.push(`The rotation "${rec.name}" has no heats with participants.`);
    else if (here !== undefined && here < 2) out.push('At least two participants must be here.');
    return out;
  }

  // Participants whose name is the name of one driver: the driver ids per participant ('' when there is no match), and what was left over.
  // keysOf(driver): the texts that may match (the name as shown, the plain name).
  function matchDrivers(rec, drivers, keysOf) {
    const norm = x => String(x || '').trim().toLowerCase(), picks = [], missing = [], ambiguous = [];
    for (let p = 0; p < rec.participants; p++) {
      const nm = norm(rec.names[p]);
      if (!nm) { picks.push(''); continue; }
      const hit = drivers.filter(d => keysOf(d).some(k => norm(k) === nm));
      if (hit.length === 1) picks.push(hit[0].id);
      else { picks.push(''); (hit.length ? ambiguous : missing).push(rec.names[p].trim()); }
    }
    return { picks, matched: picks.filter(Boolean).length, named: rec.names.filter(x => String(x || '').trim()).length, missing, ambiguous };
  }

  // ---- what a rotation means ----
  const list = (items, max = 8) => (items.length <= max ? items.join(', ') : items.slice(0, max).join(', ') + ` and ${items.length - max} more`);
  // Remarks for the editor: [{ level: 'warn' | 'info', text }]
  function check(rec) {
    const out = [], sched = rec.heats.filter(h => h.places.length).map(h => h.places);
    if (!rec.heats.length) return [{ level: 'warn', text: 'There are no heats yet. Add a heat, or start from a plan.' }];
    const empty = rec.heats.map((h, i) => (h.places.length ? 0 : i + 1)).filter(Boolean);
    if (empty.length) out.push({ level: 'warn', text: `${empty.length === 1 ? 'Heat ' : 'Heats '}${list(empty)} ${empty.length === 1 ? 'is' : 'are'} empty and will be left out of the race.` });
    if (!sched.length) return out;
    const st = Heats.stats(sched, rec.participants, rec.lanes), idle = st.per.map((x, p) => (x.heats ? '' : shortOf(rec, p))).filter(Boolean);
    if (idle.length) out.push({ level: 'warn', text: `${idle.length === 1 ? 'This participant races' : 'These participants race'} no heat: ${list(idle)}.` });
    const lone = rec.heats.map((h, i) => (h.places.length === 1 ? i + 1 : 0)).filter(Boolean);
    if (lone.length) out.push({ level: 'warn', text: `${lone.length === 1 ? 'Heat ' : 'Heats '}${list(lone)} ${lone.length === 1 ? 'has' : 'have'} one car only.` });
    const first = new Set(); rec.names.forEach((nm, p) => { const k = nm.trim().toLowerCase(), at = rec.names.findIndex(x => x.trim().toLowerCase() === k); if (k && at !== p) first.add(at); }); // (the first one who has a name that is used again)
    const dup = [...first].sort((a, b) => a - b).map(i => rec.names[i].trim());
    if (dup.length) out.push({ level: 'warn', text: `${dup.length === 1 ? 'The name' : 'The names'} ${list(dup.map(x => `"${x}"`))} ${dup.length === 1 ? 'is' : 'are'} used twice.` });
    const raced = st.per.filter(x => x.heats > 0);
    if (raced.length && st.minHeats !== st.maxHeats && !idle.length) out.push({ level: 'info', text: `The participants race ${st.minHeats} to ${st.maxHeats} heats. If the overall result adds the heats up, that favours those with more heats: count the average per heat in the race setup to keep it fair.` });
    else if (raced.length && st.equal) out.push({ level: 'info', text: `Every participant races ${st.maxHeats === 1 ? '1 heat' : st.maxHeats + ' heats'}.` });
    const small = rec.heats.map((h, i) => (h.places.length > 1 && h.places.length < rec.lanes ? i + 1 : 0)).filter(Boolean);
    if (small.length) out.push({ level: 'info', text: `${small.length === 1 ? 'Heat ' : 'Heats '}${list(small)} ${small.length === 1 ? 'has' : 'have'} fewer cars than the ${rec.lanes} lanes.` });
    if (st.maxHeats >= 2 && rec.lanes > 1) out.push({ level: 'info', text: st.laneSpread >= 2 ? 'The lanes are not shared evenly: some participants race more often in one lane than in another. "Even out the lanes" fixes that.' : 'The lanes are shared evenly.' });
    if (st.missingPairs === 0 && rec.participants > 1) out.push({ level: 'info', text: 'Every participant races against every other participant at least once.' });
    return out;
  }
  // The numbers per participant for the editor: how many heats each races and in which lanes.
  function perParticipant(rec) {
    const sched = rec.heats.filter(h => h.places.length).map(h => h.places);
    return sched.length ? Heats.stats(sched, rec.participants, rec.lanes).per : Array.from({ length: rec.participants }, () => ({ heats: 0, lanes: Array(rec.lanes).fill(0), meets: 0 }));
  }
  const describe = rec => `${rec.participants} ${isTeams(rec) ? (rec.participants === 1 ? 'team' : 'teams') : 'participants'}, ${rec.lanes} ${rec.lanes === 1 ? 'lane' : 'lanes'}, ${rec.heats.filter(h => h.places.length).length} heats`;

  const api = { LIMITS, clean, nameOf, shortOf, blank, generate, resize, place, swap, assignGroup, addHeat, removeHeat, duplicateHeat, clearHeat, moveHeat, setLabel, setLocked,
    shuffleOrder, reverseOrder, shuffleLanes, evenLanes, setParticipantsAre, isTeams, setName, addGroup, removeGroup, renameGroup, toggleMember, scheduleFor, lanesUsed, signature, problems, matchDrivers, check, perParticipant, describe };
  root.Rot = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
