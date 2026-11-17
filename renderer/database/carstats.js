// database: slotcar statistics and the shared car editor
// (part of renderer/database.js: loaded just before it by index.html; the parts share the page's global scope)
// Derived statistics from the repository. SQLite maintains rebuildable summaries;
// the legacy JSON backend calculates the same figures when requested.
const CAR_STATS = [
  {
    key: '_mileage',
    label: 'Mileage',
    hint: 'The distance this car has driven, worked out as the Car Mileage card on Home does: every lap that counts, times the length of its lane. Laps on a track without a length are left out.'
  },
  {
    key: '_mileageSince',
    label: 'Mileage Since Last Service',
    hint: 'The same distance, counted from the day of the last Reset (all of it until the car is serviced for the first time).'
  },
  { key: '_lastDriven', label: 'Last Driven', hint: 'The day of the last lap saved with this car (Never until it has driven).' },
  {
    key: '_sessions',
    label: 'Sessions Driven',
    hint: 'The sessions this car has laps in: races, qualifyings and practices. Time Token Sessions are counted apart and not here.'
  },
  {
    key: '_wins',
    label: 'Wins',
    hint: 'The races this car won: first place, not retired or disqualified. A practice or a qualifying has no winner.'
  },
  {
    key: '_deslots',
    label: 'Deslots',
    hint: 'The laps slower than the deslot time of their track (Tracks, Lap time limits), laps with a pit stop left out. A track without a deslot time has none.'
  },
  {
    key: '_fastest',
    label: 'Fastest Lap Ever',
    hint: 'The fastest valid lap of this car on any track, and the track. A lap that is invalid, too slow, late or with a pit stop does not count.'
  }
].map(f => ({ ...f, id: f.key, group: 'stats', type: 'carstat', custom: false }));
const CAR_TRACKS = {
  key: '_byTrack',
  id: '_byTrack',
  group: 'stats',
  label: 'Best Lap per Track',
  type: 'cartracks',
  custom: false,
  hint: 'The valid laps of this car on each track: how many, the best lap and the average.'
};
// what the statistics say, in words: [id of the field] = text; the table of the tracks; and the loader (the laps, the sessions and the tracks of the database)
const carStatTexts = d => ({
  _mileage: Stats.fmtDist(d.mileage.distance, dUnit()),
  _mileageSince: Stats.fmtDist(d.mileageSince.distance, dUnit()),
  _lastDriven: d.lastDriven ? plainDate(d.lastDriven) : 'Never',
  _sessions: String(d.sessions),
  _wins: String(d.wins),
  _deslots: d.deslots === null ? 'Not available' : String(d.deslots),
  _fastest: d.fastest ? `${Stats.fmtMs(d.fastest.time)}${d.fastest.trackName ? ' on ' + d.fastest.trackName : ''}` : '–'
});
const carTracksHtml = d =>
  !d.tracks.length
    ? '<span class="muted">No valid laps yet.</span>'
    : `<table class="fields svc-tracks"><thead><tr><th>Track</th><th>Laps</th><th>Best</th><th>Average</th></tr></thead><tbody>${d.tracks.map(t => `<tr><td>${esc(t.name || '–')}</td><td>${t.laps}</td><td>${esc(Stats.fmtMs(t.best))}</td><td>${esc(Stats.fmtMs(t.avg))}</td></tr>`).join('')}</tbody></table>`;
const loadCarStats = item =>
  api.carStatistics
    ? api.carStatistics(item.id)
    : Promise.all([api.list('laps'), api.list('sessions'), api.list('tracks')]).then(([laps, sessions, tracks]) =>
        CarStats.details(item, laps, sessions, tracks)
      );
// a mark for the list and the cards of the slotcars that need servicing
const rowMark = (e, i) =>
  (e === 'slotcars' && i.paddock
    ? `<span class="badge paddock-source" title="Details managed in SlotForge Paddock">Paddock${i.paddock.archived ? ' · unavailable' : ''}</span>`
    : '') +
  (e === 'slotcars' && CarStats.status(i).due
    ? '<span class="svc-due" title="The laps since the last service have reached the service interval">Service due</span>'
    : '');
function libraryEditorApi() {
  return {
    ...api,
    paddockSharedCar: api.libraryCar,
    paddockSharedSave: api.librarySave,
    paddockSharedSaves: api.librarySaves,
    paddockSharedRetry: api.libraryRetry,
    paddockSharedResolve: api.libraryResolve
  };
}
