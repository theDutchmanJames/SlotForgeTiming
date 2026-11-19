'use strict';
// Shared domain deletion rules; each backend supplies its transaction and lap/counter removal.
const PaddockRecords = require('./paddockrecords');
const schema = require('./schema');
function dependencies(entity) {
  const special = {
    tracks: ['sessions', 'fuelrules', 'championships', 'virtualrivalsystems'],
    drivers: ['sessions', 'teams', 'championships', 'multiclasssystems'],
    slotcars: ['sessions'],
    laps: ['sessions'],
    teams: ['championships'],
    raceclasses: ['multiclasssystems']
  };
  return [
    ...new Set([
      entity,
      ...(special[entity] || []),
      ...Object.entries(schema)
        .filter(([, s]) => (s.fields || []).some(f => f.type === 'ref' && f.ref === entity))
        .map(([name]) => name)
    ])
  ];
}
function remove(d, entity, id, removeLapsWhere) {
  if (['tracks', 'drivers', 'slotcars', 'laps'].includes(entity))
    for (const s of d.sessions) {
      const key = entity === 'drivers' ? 'driverId' : 'carId';
      const affected =
        entity === 'tracks'
          ? s.trackId === id || d.laps.some(l => l.sessionId === s.id && l.trackId === id)
          : d.laps.some(l => l.sessionId === s.id && (entity === 'laps' ? l.id === id : l[key] === id)) ||
            (entity !== 'laps' &&
              ((s.standings || []).some(row => row[key] === id) ||
                (s.paddockJournal?.heats || []).some(h =>
                  (h.entries || []).some(
                    e => e[key] === id || (entity === 'drivers' && (e.changes || []).some(change => change.driverId === id))
                  )
                )));
      if (affected) PaddockRecords.withdraw(d, s, 'Timing records were removed from this session.');
    }
  if (entity === 'raceclasses') {
    // Remove current catalogue links, never frozen race/heat/championship history.
    for (const table of ['slotcars', 'drivers', 'teams'])
      d[table].forEach(row => {
        if (row.raceClass === id) row.raceClass = '';
      });
    d.multiclasssystems.forEach(p => {
      p.classes = (p.classes || []).filter(c => c.id !== id);
      p.driverClasses = (p.driverClasses || []).filter(a => a.classId !== id);
    });
  }
  if (entity === 'tracks') {
    const removedSessions = new Set(d.sessions.filter(s => s.trackId === id).map(s => s.id));
    removeLapsWhere(l => l.trackId === id || removedSessions.has(l.sessionId));
    d.sessions = d.sessions.filter(s => s.trackId !== id);
    d.racesetups.forEach(r => {
      if (r.track === id) r.track = '';
    });
    d.fuelrules.forEach(f => {
      if (f.paceTrack === id) {
        f.paceTrack = '';
        f.paceSource = 'constant';
      }
    });
    d.virtualrivalsystems.forEach(v => {
      if (v.trackId === id) v.trackId = '';
    }); // (the replay keeps its laps; the editor asks for a recording with a track again)
  }
  if (entity === 'tracks')
    d.championships.forEach(c =>
      (c.rounds || []).forEach(r => {
        if (r.track === id) r.track = '';
      })
    ); // (a round with no track uses the track of its race setup)
  if (entity === 'teams')
    d.championships.forEach(c =>
      (c.roster || []).forEach(x => {
        if (x.team === id) x.team = '';
      })
    );
  if (entity === 'drivers')
    d.championships.forEach(c => {
      if (Array.isArray(c.roster)) c.roster = c.roster.filter(x => x.driver !== id);
    });
  if (entity === 'drivers') {
    d.multiclasssystems.forEach(p => {
      if (Array.isArray(p.driverClasses)) p.driverClasses = p.driverClasses.filter(a => a.driverId !== id);
    });
    d.teams.forEach(t => {
      if (Array.isArray(t.drivers)) t.drivers = t.drivers.filter(x => x !== id);
    });
    removeLapsWhere(l => l.driverId === id);
    d.sessions.forEach(s => {
      if (Array.isArray(s.standings)) s.standings = s.standings.filter(x => x.driverId !== id);
    });
  }
  if (entity === 'slotcars') {
    removeLapsWhere(l => l.carId === id);
    d.sessions.forEach(s => {
      if (Array.isArray(s.standings)) s.standings = s.standings.filter(x => x.carId !== id);
    });
  }
  if (entity === 'laps') removeLapsWhere(l => l.id === id);
  for (const [table, definition] of Object.entries(schema))
    for (const field of definition.fields || [])
      if (field.type === 'ref' && field.ref === entity) for (const row of d[table] || []) if (row[field.key] === id) row[field.key] = '';
  d[entity] = d[entity].filter(r => r.id !== id);
}
// (2.4) One driver merged into another: the kept driver takes over every lap, result, team place, roster place and class of the duplicate,
// then the duplicate is removed. relabelLapsWhere(pred, patch) lets the backend change the laps so its own caches stay right.
function merge(d, fromId, intoId, relabelLapsWhere) {
  if (typeof fromId !== 'string' || !fromId || typeof intoId !== 'string' || !intoId) throw new Error('Choose two drivers to merge.');
  if (fromId === intoId) throw new Error('A driver cannot be merged into itself.');
  const from = (d.drivers || []).find(r => r.id === fromId),
    into = (d.drivers || []).find(r => r.id === intoId);
  if (!from) throw new Error('The driver to merge was not found.');
  if (!into) throw new Error('The driver to keep was not found.');
  const name = into.name;
  // (a session row is put back field by field when a merge fails: its standings and journal get new objects, never changed in place)
  const relabel = row => {
    if (!row || row.driverId !== fromId) return row;
    const next = { ...row, driverId: intoId };
    if (Object.hasOwn(row, 'driverName') && name !== undefined) next.driverName = name;
    return next;
  };
  const named = e => e.driverId === fromId || (e.changes || []).some(change => change.driverId === fromId);
  for (const s of d.sessions || []) {
    const affected =
      (d.laps || []).some(l => l.sessionId === s.id && l.driverId === fromId) ||
      (s.standings || []).some(row => row.driverId === fromId) ||
      (s.paddockJournal?.heats || []).some(h => (h.entries || []).some(named));
    if (affected) PaddockRecords.withdraw(d, s, 'Timing records were changed in this session.');
  }
  relabelLapsWhere(l => l.driverId === fromId, Object.assign({ driverId: intoId }, name !== undefined ? { driverName: name } : {}));
  for (const s of d.sessions || []) {
    if (Array.isArray(s.standings) && s.standings.some(row => row.driverId === fromId)) s.standings = s.standings.map(relabel);
    const heats = s.paddockJournal?.heats;
    if (Array.isArray(heats) && heats.some(h => (h.entries || []).some(named)))
      s.paddockJournal = {
        ...s.paddockJournal,
        heats: heats.map(h =>
          Array.isArray(h.entries)
            ? {
                ...h,
                entries: h.entries.map(e => {
                  const next = relabel(e);
                  return Array.isArray(e.changes) ? { ...next, changes: e.changes.map(relabel) } : next;
                })
              }
            : h
        )
      };
  }
  (d.teams || []).forEach(t => {
    if (!Array.isArray(t.drivers) || !t.drivers.includes(fromId)) return;
    const out = [];
    for (const x of t.drivers.map(x => (x === fromId ? intoId : x))) if (x !== intoId || !out.includes(x)) out.push(x);
    t.drivers = out;
  });
  (d.championships || []).forEach(c => {
    if (!Array.isArray(c.roster) || !c.roster.some(x => x.driver === fromId)) return;
    const kept = c.roster.some(x => x.driver === intoId);
    c.roster = kept ? c.roster.filter(x => x.driver !== fromId) : c.roster;
    c.roster.forEach(x => {
      if (x.driver === fromId) x.driver = intoId;
    });
  });
  (d.multiclasssystems || []).forEach(p => {
    if (!Array.isArray(p.driverClasses) || !p.driverClasses.some(a => a.driverId === fromId)) return;
    const kept = p.driverClasses.some(a => a.driverId === intoId);
    p.driverClasses = kept ? p.driverClasses.filter(a => a.driverId !== fromId) : p.driverClasses;
    p.driverClasses.forEach(a => {
      if (a.driverId === fromId) a.driverId = intoId;
    });
  });
  for (const [table, definition] of Object.entries(schema))
    for (const field of definition.fields || [])
      if (field.type === 'ref' && field.ref === 'drivers')
        for (const row of d[table] || []) if (row[field.key] === fromId) row[field.key] = intoId;
  d.drivers = d.drivers.filter(r => r.id !== fromId);
}
module.exports = { remove, merge, dependencies };
