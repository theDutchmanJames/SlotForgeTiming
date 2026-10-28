// The order of a leaderboard (1.19.0). A board follows the race order (the place in the race) unless it is told to order its rows by a value: the best lap, the laps,
// the championship points, the penalty or damage points, the fuel left... "Order by" says which value, "Best first" or "Worst first" says which end is on top. Pure: it knows the
// list of values and how to put rows in order, but not where a value comes from (timing.js gives it, orderValue), so it can be tested without a race.
(function (root) {
  // best: which end of the numbers is the best one ('low' = the smallest, a fast lap; 'high' = the biggest, many laps). text: the values are words (A to Z).
  // top: what stands on top with "Best first" (for the hint in the settings). note: one more sentence for the hint.
  const KEYS = [
    { key: 'position', label: 'Race position (as the race runs)', top: 'the leader of the race' },
    { key: 'best', label: 'Best lap', best: 'low', top: 'the fastest lap' },
    { key: 'last', label: 'Last lap', best: 'low', top: 'the fastest last lap' },
    { key: 'avg', label: 'Average lap', best: 'low', top: 'the fastest average lap' },
    { key: 'median', label: 'Median lap', best: 'low', top: 'the fastest median lap' },
    { key: 'record', label: 'Personal best on this track', best: 'low', top: 'the fastest personal best' },
    { key: 'laps', label: 'Laps', best: 'high', top: 'the most laps' },
    { key: 'totaltime', label: 'Total time (this race or heat)', best: 'low', top: 'the shortest total time', note: 'Only a car that has finished has a total time: the cars that are still racing, or are out, stay below it. The time counts the penalties.' },
    { key: 'totaltimeall', label: 'Total time (all heats so far)', best: 'low', top: 'the shortest total time over all heats so far', note: 'Only a car that has finished its heat has a total time: the cars that are still racing, or are out, stay below it. The time counts the penalties.' },
    { key: 'speed', label: 'Speed (last lap)', best: 'high', top: 'the highest speed' },
    { key: 'champ', label: 'Championship points', best: 'high', top: 'the most points' },
    { key: 'penpoints', label: 'Penalty points', best: 'low', top: 'the fewest penalty points (a disqualified car last)' },
    { key: 'pentime', label: 'Penalty time', best: 'low', top: 'the least penalty time' },
    { key: 'damage', label: 'Damage points', best: 'low', top: 'the least damage' },
    { key: 'pits', label: 'Pit stops', best: 'low', top: 'the fewest pit stops' },
    { key: 'fuel', label: 'Fuel left', best: 'high', top: 'the most fuel' },
    { key: 'lane', label: 'Lane', best: 'low', top: 'lane 1' },
    { key: 'name', label: 'Driver name (A to Z)', best: 'low', text: true, top: 'the name that comes first in the alphabet' }
  ];
  const CHOICES = KEYS.map(k => [k.key, k.label]);
  const DIRECTIONS = [['best', 'Best first'], ['worst', 'Worst first']];

  const info = key => KEYS.find(k => k.key === key) || KEYS[0];
  // the value a setting asks for; anything that is not one of the values (a damaged or imported file) is the race position
  const keyOf = opt => { const k = opt && opt.orderBy; return typeof k === 'string' && KEYS.some(x => x.key === k) ? k : 'position'; };
  const dirOf = opt => (opt && opt.orderDir === 'worst' ? 'worst' : 'best');
  const isOrdered = opt => keyOf(opt) !== 'position';
  // the words for the settings: what stands on top for the value that is chosen
  const hintOf = key => { const k = info(key); return k.key === 'position' ? 'The rows follow the race: the leader on top.' : `Best first puts ${k.top} on top, Worst first turns it round. A car without a value yet (no lap, or the race has no such rule) stays at the bottom, and cars with the same value keep their race order. The Position column then counts the rows of this board (1, 2, 3...) and the first row gets the leader look.${k.note ? ' ' + k.note : ''}`; };

  const missing = v => v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) || v === '';
  // list: the standings, [{ pos, car, gap }] in race order. valueOf(x) gives the number (or the text) of a row, or null when there is none.
  // Without an order the list itself comes back (so a board that is not ordered is drawn exactly as before). With one: a new list in that order, every row a copy
  // with pos = its place in this board and byOrder: true, racePos = its place in the race.
  function order(list, opt, valueOf) {
    const key = keyOf(opt);
    if (key === 'position' || !Array.isArray(list)) return list;
    const k = info(key), sign = (k.best === 'high' ? -1 : 1) * (dirOf(opt) === 'worst' ? -1 : 1);
    const rows = list.map((x, i) => { const v = valueOf ? valueOf(x) : null; return { x, i, v, none: missing(v), pos: Number.isFinite(Number(x && x.pos)) ? Number(x.pos) : i + 1 }; });
    rows.sort((a, b) => {
      if (a.none !== b.none) return a.none ? 1 : -1; // (no value: at the bottom, whichever end is on top)
      if (!a.none) {
        const c = k.text ? String(a.v).localeCompare(String(b.v), undefined, { sensitivity: 'base', numeric: true }) : a.v === b.v ? 0 : a.v < b.v ? -1 : 1;
        if (c) return c * sign;
      }
      return a.pos - b.pos || a.i - b.i; // (the same value: the race order)
    });
    return rows.map((r, n) => ({ ...r.x, pos: n + 1, racePos: r.x && r.x.pos, byOrder: true }));
  }

  const api = { KEYS, CHOICES, DIRECTIONS, info, keyOf, dirOf, isOrdered, hintOf, order };
  root.BoardOrder = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
