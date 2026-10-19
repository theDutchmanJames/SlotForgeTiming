// Championships (1.55.0): a series of rounds, driven in sessions (practice, qualifying, race), with a roster of drivers. Pure rules, no screen in here
// (the page is in championshipui.js, the card on Home is in landing.js). The record is
//   { name, rounds: [{ id, name, track, date, sessions: [{ id, setup, share }] }], roster: [{ driver, team, from }], guestRule }
// - a round has a name (empty: "Round 3"), a track (empty: the track of the race setup of the session), a date as typed, and the sessions in the order they are driven;
// - a session is driven with one of your race setups (setup = its id). Its kind (Practice, Qualifying or Race) comes from that race setup, and for a race the share says how
//   much of the points it counts for: 100 (a full race), 50 (a sprint) or 0 (none). The points themselves come with the next release; this file only knows the shares;
// - the roster is the drivers of the championship: the team they drive for in it, and the round they join in (1 = from the start);
// - guestRule: a driver who is not in the roster is a guest (no points, the drivers behind him move up). Kept now, used when points are awarded.
// A session that was driven carries a tag (see tagOf) which is saved with it: { id, name, round, roundId, roundName, session, sessionId, kind, share }.
// Every change gives a new championship and leaves the old one alone.
(function (root) {
  const LIMITS = { name: 60, roundName: 40, date: 24, rounds: 40, sessions: 8, roster: 60 };
  const SHARES = [100, 50, 0];
  const KINDS = ['practice', 'qualifying', 'race'], KIND_LABEL = { practice: 'Practice', qualifying: 'Qualifying', race: 'Race' };
  const int = (v, d, lo, hi) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
  const str = (v, max) => (typeof v === 'string' ? v.replace(/[\r\n\t]+/g, ' ').trim().slice(0, max) : '');
  const id = (v) => (typeof v === 'string' && v.length <= 80 ? v : '');
  const clone = x => JSON.parse(JSON.stringify(x));
  let counter = 0;
  const newId = p => p + Date.now().toString(36) + (++counter).toString(36) + Math.floor(Math.random() * 1296).toString(36);

  // The kind of a session from its race setup: a race, a timed race, heats and an Endurance Race are races; a Time Token Session (or anything else) is none of them.
  function kindOf(setup) {
    const t = setup && (setup.ofType || setup.sessionType);
    return t === 'practice' ? 'practice' : t === 'qualifying' ? 'qualifying' : ['race', 'timed', 'heats', 'endurance'].includes(t) ? 'race' : '';
  }
  const shareOf = v => (SHARES.includes(Number(v)) ? Number(v) : 100);

  const cleanSession = s => ({ id: id(s && s.id) || newId('s'), setup: id(s && s.setup), share: shareOf(s && s.share) });
  const cleanRound = r => ({ id: id(r && r.id) || newId('r'), name: str(r && r.name, LIMITS.roundName), track: id(r && r.track), date: str(r && r.date, LIMITS.date),
    sessions: (r && Array.isArray(r.sessions) ? r.sessions : []).slice(0, LIMITS.sessions).map(cleanSession) });
  // Any record (from the file, a mistake, an import) made into one that holds together: limits kept, every id there and unique, a driver once in the roster.
  function clean(rec, keepId) {
    const r = rec && typeof rec === 'object' ? rec : {}, seen = new Set(), unique = (x, p) => { while (!x.id || seen.has(x.id)) x.id = newId(p); seen.add(x.id); return x; };
    const rounds = (Array.isArray(r.rounds) ? r.rounds : []).slice(0, LIMITS.rounds).map(cleanRound).map(x => { unique(x, 'r'); x.sessions.forEach(s => unique(s, 's')); return x; });
    const taken = new Set(), roster = [];
    (Array.isArray(r.roster) ? r.roster : []).forEach(x => { const d = id(x && x.driver); if (!d || taken.has(d) || roster.length >= LIMITS.roster) return; taken.add(d); roster.push({ driver: d, team: id(x.team), from: int(x.from, 1, 1, LIMITS.rounds) }); });
    const out = { name: str(r.name, LIMITS.name), rounds, roster, guestRule: r.guestRule !== false };
    if (keepId && typeof r.id === 'string') out.id = r.id;
    return out;
  }
  const blank = () => clean({ name: 'New championship', rounds: [{ name: '', sessions: [] }], roster: [] });

  const roundLabel = (c, i) => { const r = c.rounds[i]; return r ? (r.name ? `Round ${i + 1} · ${r.name}` : `Round ${i + 1}`) : ''; };
  const describe = c => {
    const n = c.rounds.length, s = c.rounds.reduce((a, r) => a + r.sessions.length, 0), d = c.roster.length, many = (k, one, more) => `${k} ${k === 1 ? one : more}`;
    return `${many(n, 'round', 'rounds')} · ${many(s, 'session', 'sessions')} · ${many(d, 'driver', 'drivers')}`;
  };

  // ---- changes to the rounds and the sessions ----
  const copySessions = list => list.map(s => ({ id: newId('s'), setup: s.setup, share: s.share }));
  // a new round: it begins with the sessions of the round before it (the same race setups), the way a championship usually goes
  function addRound(c) {
    if (c.rounds.length >= LIMITS.rounds) return { error: `A championship holds at most ${LIMITS.rounds} rounds.` };
    const out = clone(c), last = out.rounds[out.rounds.length - 1];
    out.rounds.push({ id: newId('r'), name: '', track: '', date: '', sessions: last ? copySessions(last.sessions) : [] });
    return { rec: out };
  }
  function removeRound(c, i) { if (!c.rounds[i]) return { error: 'There is no such round.' }; const out = clone(c); out.rounds.splice(i, 1); return { rec: out }; }
  function moveRound(c, i, by) {
    const j = i + by; if (!c.rounds[i] || j < 0 || j >= c.rounds.length) return { error: 'It can not move further.' };
    const out = clone(c); [out.rounds[i], out.rounds[j]] = [out.rounds[j], out.rounds[i]]; return { rec: out };
  }
  function setRound(c, i, patch) {
    if (!c.rounds[i]) return { error: 'There is no such round.' };
    const out = clone(c), r = out.rounds[i];
    if (patch.name !== undefined) r.name = str(patch.name, LIMITS.roundName);
    if (patch.track !== undefined) r.track = id(patch.track);
    if (patch.date !== undefined) r.date = str(patch.date, LIMITS.date);
    return { rec: out };
  }
  function addSession(c, i, setup) {
    const r = c.rounds[i]; if (!r) return { error: 'There is no such round.' };
    if (r.sessions.length >= LIMITS.sessions) return { error: `A round holds at most ${LIMITS.sessions} sessions.` };
    const out = clone(c); out.rounds[i].sessions.push({ id: newId('s'), setup: id(setup), share: 100 }); return { rec: out };
  }
  function removeSession(c, i, k) { if (!c.rounds[i] || !c.rounds[i].sessions[k]) return { error: 'There is no such session.' }; const out = clone(c); out.rounds[i].sessions.splice(k, 1); return { rec: out }; }
  function moveSession(c, i, k, by) {
    const r = c.rounds[i], j = k + by; if (!r || !r.sessions[k] || j < 0 || j >= r.sessions.length) return { error: 'It can not move further.' };
    const out = clone(c), s = out.rounds[i].sessions; [s[k], s[j]] = [s[j], s[k]]; return { rec: out };
  }
  function setSession(c, i, k, patch) {
    if (!c.rounds[i] || !c.rounds[i].sessions[k]) return { error: 'There is no such session.' };
    const out = clone(c), s = out.rounds[i].sessions[k];
    if (patch.setup !== undefined) s.setup = id(patch.setup);
    if (patch.share !== undefined) s.share = shareOf(patch.share);
    return { rec: out };
  }
  // the sessions of round 1 (the same race setups and shares) for every other round; what was driven before is not touched: the tags of driven sessions keep their own ids
  function copyFirstToAll(c) {
    const first = c.rounds[0]; if (!first || c.rounds.length < 2) return { error: 'There is no other round to copy to.' };
    const out = clone(c); out.rounds.forEach((r, i) => { if (i) r.sessions = copySessions(first.sessions); }); return { rec: out };
  }

  // ---- the roster ----
  function addDriver(c, driver, team) {
    const d = id(driver); if (!d) return { error: 'Choose a driver.' };
    if (c.roster.some(x => x.driver === d)) return { error: 'That driver is in the roster already.' };
    if (c.roster.length >= LIMITS.roster) return { error: `A roster holds at most ${LIMITS.roster} drivers.` };
    const out = clone(c); out.roster.push({ driver: d, team: id(team), from: 1 }); return { rec: out };
  }
  // all the drivers of a team that are not in the roster yet (the team record has .drivers: [ids]; only drivers that exist are added)
  function addTeam(c, team, drivers) {
    const t = team && team.id ? team : null; if (!t) return { error: 'Choose a team.' };
    const have = new Set(c.roster.map(x => x.driver)), known = new Set((drivers || []).map(d => d.id)), out = clone(c);
    let n = 0;
    (Array.isArray(t.drivers) ? t.drivers : []).forEach(d => { if (!known.has(d) || have.has(d) || out.roster.length >= LIMITS.roster) return; have.add(d); out.roster.push({ driver: d, team: t.id, from: 1 }); n++; });
    return n ? { rec: out, added: n } : { error: 'Every driver of that team is in the roster already, or the team has no drivers.' };
  }
  function removeDriver(c, driver) { if (!c.roster.some(x => x.driver === driver)) return { error: 'That driver is not in the roster.' }; const out = clone(c); out.roster = out.roster.filter(x => x.driver !== driver); return { rec: out }; }
  function setRoster(c, driver, patch) {
    if (!c.roster.some(x => x.driver === driver)) return { error: 'That driver is not in the roster.' };
    const out = clone(c), x = out.roster.find(y => y.driver === driver);
    if (patch.team !== undefined) x.team = id(patch.team);
    if (patch.from !== undefined) x.from = int(patch.from, 1, 1, LIMITS.rounds);
    return { rec: out };
  }
  // the team a driver is in (the first team that lists the driver), to start the roster row with
  const teamOfDriver = (teams, driver) => { const t = (teams || []).find(x => Array.isArray(x.drivers) && x.drivers.includes(driver)); return t ? t.id : ''; };
  // The drivers of the roster that race in a round (round number, from 1): the ones who have joined by then. And the other drivers, who would drive as guests.
  function rosterFirst(drivers, c, round) {
    const list = Array.isArray(drivers) ? drivers : [], inRound = (c.roster || []).filter(x => x.from <= (round || 1)).map(x => x.driver);
    const roster = inRound.map(d => list.find(x => x.id === d)).filter(Boolean), ids = new Set(roster.map(x => x.id));
    return { roster, others: list.filter(x => !ids.has(x.id)) };
  }

  // ---- what was driven, and what comes next ----
  const keyOf = (roundId, sessionId) => roundId + ':' + sessionId;
  // The saved sessions of this championship, by round and session: { key -> the latest saved session }. A session that was driven again is the latest one.
  function driven(c, sessions) {
    const out = new Map();
    (Array.isArray(sessions) ? sessions : []).forEach(s => {
      const t = s && s.champ; if (!t || t.id !== c.id) return;
      const k = keyOf(t.roundId, t.sessionId), old = out.get(k);
      if (!old || String(s.date || '') >= String(old.date || '')) out.set(k, s);
    });
    return out;
  }
  // The state of every round and the next session: { rounds: [{ state: 'done' | 'next' | 'todo' | 'empty', driven, total }], next: { round, session } | null, driven, total, complete }
  function progress(c, sessions) {
    const done = driven(c, sessions);
    const rounds = c.rounds.map(r => ({ state: '', driven: r.sessions.filter(s => done.has(keyOf(r.id, s.id))).length, total: r.sessions.length }));
    let next = null;
    c.rounds.forEach((r, i) => {
      const p = rounds[i];
      if (!p.total) { p.state = 'empty'; return; }
      if (p.driven >= p.total) { p.state = 'done'; return; }
      if (!next) { p.state = 'next'; next = { round: i, session: r.sessions.findIndex(s => !done.has(keyOf(r.id, s.id))) }; } else p.state = 'todo';
    });
    const total = rounds.reduce((a, p) => a + p.total, 0), n = rounds.reduce((a, p) => a + p.driven, 0);
    return { rounds, next, driven: n, total, complete: total > 0 && n >= total, done };
  }

  // ---- loading a session on Home, and the tag it carries ----
  // The track of a session: the track of its round, else the track of its race setup (a track that was deleted is none).
  const trackFor = (round, setup, tracks) => { const has = t => t && (tracks || []).some(x => x.id === t); return has(round && round.track) ? round.track : has(setup && setup.track) ? setup.track : ''; };
  // what stops a session from being raced: [] when it can be loaded
  function sessionProblems(c, ri, si, ctx) {
    const r = c.rounds[ri], s = r && r.sessions[si], out = [];
    if (!s) return ['There is no such session.'];
    const setup = (ctx.setups || []).find(x => x.id === s.setup), who = `Round ${ri + 1}, session ${si + 1}`;
    if (!s.setup) out.push(`${who} has no race setup. Choose one in Race Setup > Championships.`);
    else if (!setup) out.push(`${who}: its race setup was deleted. Choose another in Race Setup > Championships.`);
    else if (!kindOf(setup)) out.push(`${who}: "${setup.name || '(unnamed)'}" is a Time Token Session, which can not be part of a championship.`);
    else if (!trackFor(r, setup, ctx.tracks)) out.push(`${who} has no track. Choose a track for the round, or in the race setup.`);
    return out;
  }
  // all the problems of a championship, for the list: { level, text }
  function problems(c, ctx) {
    const out = [];
    if (!c.rounds.length) out.push('It has no rounds yet.');
    c.rounds.forEach((r, i) => {
      if (!r.sessions.length) out.push(`Round ${i + 1} has no sessions.`);
      r.sessions.forEach((s, k) => sessionProblems(c, i, k, ctx).forEach(t => out.push(t)));
      if (r.track && !(ctx.tracks || []).some(t => t.id === r.track)) out.push(`Round ${i + 1}: its track was deleted, so the track of the race setup is used.`);
    });
    return out;
  }
  // The tag of a session: what is saved with it, and shown on Home, on the race screen and in the results. The setup is where to load it from.
  function tagOf(c, ri, si, ctx) {
    const r = c.rounds[ri], s = r && r.sessions[si]; if (!s) return null;
    const setup = (ctx && ctx.setups || []).find(x => x.id === s.setup), kind = kindOf(setup); if (!kind) return null;
    return { id: c.id, name: c.name, round: ri + 1, roundId: r.id, roundName: r.name, session: si + 1, sessionId: s.id, kind, share: kind === 'race' ? s.share : 100 };
  }
  // "Club Cup 2026 · Round 6 · Qualifying" (a sprint says its share: "Race at 50%")
  const roundKindText = t => (t ? `Round ${t.round} · ${KIND_LABEL[t.kind] || ''}${t.kind === 'race' && t.share !== 100 ? (t.share ? ` at ${t.share}%` : ' (no points)') : ''}` : '');
  const tagText = t => (t ? `${t.name || 'Championship'} · ${roundKindText(t)}` : '');
  // Where a tag is now in the championship: { ri, si } while the round and the session are still there, else null. (rounds and sessions are found by id, so moving them does not lose a tag)
  function find(c, tag) {
    if (!c || !tag || tag.id !== c.id) return null;
    const ri = c.rounds.findIndex(r => r.id === tag.roundId); if (ri < 0) return null;
    const si = c.rounds[ri].sessions.findIndex(s => s.id === tag.sessionId); return si < 0 ? null : { ri, si };
  }
  // the tag that is on Home (settings.champTag = { champId, roundId, sessionId, setupId }) against the championships and the race setup that is chosen:
  // gives { c, ri, si, tag, setup, track } while it holds (the race setup is still the one of the session), else null: a normal race
  function active(raw, champs, setups, tracks, setupId) {
    if (!raw || typeof raw !== 'object' || raw.setupId !== setupId) return null;
    const c = (champs || []).find(x => x.id === raw.champId), at = c && find(c, { id: c.id, roundId: raw.roundId, sessionId: raw.sessionId }); if (!at) return null;
    const s = c.rounds[at.ri].sessions[at.si]; if (s.setup !== setupId) return null;
    const setup = (setups || []).find(x => x.id === setupId), tag = tagOf(c, at.ri, at.si, { setups }); if (!tag) return null;
    return { c, ri: at.ri, si: at.si, tag, setup, track: trackFor(c.rounds[at.ri], setup, tracks) };
  }

  const api = { LIMITS, SHARES, KINDS, KIND_LABEL, kindOf, shareOf, clean, blank, describe, roundLabel, addRound, removeRound, moveRound, setRound, addSession, removeSession, moveSession, setSession, copyFirstToAll,
    addDriver, addTeam, removeDriver, setRoster, teamOfDriver, rosterFirst, keyOf, driven, progress, trackFor, sessionProblems, problems, tagOf, tagText, roundKindText, find, active };
  root.Champ = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
