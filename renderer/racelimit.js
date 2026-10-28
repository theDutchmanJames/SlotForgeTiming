// What limits a race (1.62.0). A Race is limited by a number of laps, by a distance or by a time (the setting "The race is over after"; a heat race and an Endurance Race have
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
  // Heats limited by a time have a scoring choice of their own (1.65.0, the setting "The overall winner is", resultByTime): 'lapstime' (the most laps, or the furthest distance when the cars are compared by distance, then the
  // lowest total time), 'laps' (total laps, as it was before) or 'points'. The rest of the program knows the result of a heat race as resultBy ('laps' or 'points'), so the setup the race screen works with carries both.
  const SCORING = ['lapstime', 'laps', 'points'];
  const isTimeHeats = s => !!s && (s.sessionType === 'heats' || (s.sessionType === 'endurance' && s.enduranceBy === 'heats')) && s.heatBy === 'time';
  const legacyScoring = s => (s.resultBy === 'points' ? 'points' : 'laps'); // (before 1.65.0 a heat of a time counted laps or points; "total race time" there counted laps)
  // A setup from before 1.65.0 has no such choice: it keeps what it counted by. True when it was changed.
  function upgradeScoring(s) {
    if (!isTimeHeats(s) || SCORING.includes(s.resultByTime)) return false;
    s.resultByTime = legacyScoring(s);
    return true;
  }
  // The setup as the race screen works with it: for heats limited by a time resultBy follows the choice (points, or laps for the other two). Any other setup is given back as it is.
  function scoring(s) {
    if (!isTimeHeats(s)) return s;
    const by = SCORING.includes(s.resultByTime) ? s.resultByTime : legacyScoring(s);
    return { ...s, resultByTime: by, resultBy: by === 'points' ? 'points' : 'laps' };
  }
  const api = { upgrade, isTime, effective, upgradeScoring, scoring, isTimeHeats, SCORING };
  if (typeof module !== 'undefined') module.exports = api; else root.RaceLimit = api;
})(typeof window !== 'undefined' ? window : globalThis);
