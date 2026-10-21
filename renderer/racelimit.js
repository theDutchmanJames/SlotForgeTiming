// What limits a race (1.62.0). A Race is limited by a number of laps, by a distance or by a time (the setting "The race is limited by"; a heat race and an Endurance Race have
// a setting of their own). A race limited by a time is raced, saved and shown as a Timed race: the engine, the history, the statistics and the championships keep the session type
// "timed", exactly as a heat race with heats of a set time already did. Pure: the database, the import, the race screen and the live page use it, and so do the tests.
(function (root) {
  // A race setup from before 1.62.0 with the session type "Timed race" is now a Race limited by a time (the minutes stay in the setting Duration). True when it was changed.
  function upgrade(s) {
    if (!s || typeof s !== 'object' || s.sessionType !== 'timed') return false;
    s.sessionType = 'race'; s.raceBy = 'time';
    return true;
  }
  // Is this setup a race that ends when the time is up (a Race limited by a time, or a Timed race as the race screen works with it)?
  const isTime = s => !!s && ((s.sessionType === 'race' && s.raceBy === 'time') || s.sessionType === 'timed');
  // The setup as the race screen works with it: a Race limited by a time is a Timed race. Any other setup is given back as it is.
  const effective = s => (s && s.sessionType === 'race' && s.raceBy === 'time' ? { ...s, sessionType: 'timed' } : s);
  const api = { upgrade, isTime, effective };
  if (typeof module !== 'undefined') module.exports = api; else root.RaceLimit = api;
})(typeof window !== 'undefined' ? window : globalThis);
