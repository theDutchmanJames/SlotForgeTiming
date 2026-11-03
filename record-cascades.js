'use strict';
// Shared domain deletion rules; each backend supplies its transaction and lap/counter removal.
const PaddockRecords = require('./paddockrecords');
const schema = require('./schema');
function dependencies(entity) {
  const special = { tracks:['sessions','fuelrules','championships'], drivers:['sessions','teams','championships','multiclasssystems'], slotcars:['sessions'], laps:['sessions'], teams:['championships'], raceclasses:['multiclasssystems'] };
  return [...new Set([entity,...(special[entity]||[]),...Object.entries(schema).filter(([,s])=>(s.fields||[]).some(f=>f.type==='ref'&&f.ref===entity)).map(([name])=>name)])];
}
function remove(d, entity, id, removeLapsWhere) {

    if(['tracks','drivers','slotcars','laps'].includes(entity))for(const s of d.sessions){
      const key=entity==='drivers'?'driverId':'carId';
      const affected=entity==='tracks'?(s.trackId===id||d.laps.some(l=>l.sessionId===s.id&&l.trackId===id)):d.laps.some(l=>l.sessionId===s.id&&(entity==='laps'?l.id===id:l[key]===id))||(entity!=='laps'&&((s.standings||[]).some(row=>row[key]===id)||(s.paddockJournal?.heats||[]).some(h=>(h.entries||[]).some(e=>e[key]===id||(entity==='drivers'&&(e.changes||[]).some(change=>change.driverId===id))))));
      if(affected)PaddockRecords.withdraw(d,s,'Timing records were removed from this session.');
    }
    if (entity === 'raceclasses') {
      // Remove current catalogue links, never frozen race/heat/championship history.
      for (const table of ['slotcars', 'drivers', 'teams'])
        d[table].forEach(row => { if (row.raceClass === id) row.raceClass = ''; });
      d.multiclasssystems.forEach(p => {
        p.classes = (p.classes || []).filter(c => c.id !== id);
        p.driverClasses = (p.driverClasses || []).filter(a => a.classId !== id);
      });
    }
    if (entity === 'tracks') {
      const removedSessions = new Set(d.sessions.filter(s => s.trackId === id).map(s => s.id));
      removeLapsWhere(l => l.trackId === id || removedSessions.has(l.sessionId));
      d.sessions = d.sessions.filter(s => s.trackId !== id);
      d.racesetups.forEach(r => { if (r.track === id) r.track = ''; });
      d.fuelrules.forEach(f => { if (f.paceTrack === id) { f.paceTrack = ''; f.paceSource = 'constant'; } });
    }
    if (entity === 'tracks') d.championships.forEach(c => (c.rounds || []).forEach(r => { if (r.track === id) r.track = ''; })); // (a round with no track uses the track of its race setup)
    if (entity === 'teams') d.championships.forEach(c => (c.roster || []).forEach(x => { if (x.team === id) x.team = ''; }));
    if (entity === 'drivers') d.championships.forEach(c => { if (Array.isArray(c.roster)) c.roster = c.roster.filter(x => x.driver !== id); });
    if (entity === 'drivers') {
      d.multiclasssystems.forEach(p => { if (Array.isArray(p.driverClasses)) p.driverClasses = p.driverClasses.filter(a => a.driverId !== id); });
      d.teams.forEach(t => { if (Array.isArray(t.drivers)) t.drivers = t.drivers.filter(x => x !== id); });
      removeLapsWhere(l => l.driverId === id);
      d.sessions.forEach(s => { if (Array.isArray(s.standings)) s.standings = s.standings.filter(x => x.driverId !== id); });
    }
    if (entity === 'slotcars') {
      removeLapsWhere(l => l.carId === id);
      d.sessions.forEach(s => { if (Array.isArray(s.standings)) s.standings = s.standings.filter(x => x.carId !== id); });
    }
    if (entity === 'laps') removeLapsWhere(l => l.id === id);
    for (const [table, definition] of Object.entries(schema)) for (const field of definition.fields || [])
      if (field.type === 'ref' && field.ref === entity) for (const row of d[table] || []) if (row[field.key] === id) row[field.key] = '';
    d[entity] = d[entity].filter(r => r.id !== id);
}
module.exports = { remove, dependencies };
