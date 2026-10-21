// The order of a leaderboard (1.19.0): which values a board can be ordered by, and how the rows are put in order (boardorder.js). Pure: no race, no screen.
const B = require('../renderer/boardorder.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };

// four rows in race order: place 1 to 4; the value of a row comes from a table
const rows = () => ['A', 'B', 'C', 'D'].map((n, i) => ({ pos: i + 1, car: { n }, gap: i ? '+' + i : '' }));
const names = l => l.map(x => x.car.n).join('');
const by = (vals, opt) => B.order(rows(), opt, x => vals[x.car.n]);

// ---- the values ----
ok('the list starts with the race position (the standard) and has the values of the race: laps, lap times, points, penalty, damage, fuel, pits, speed, lane, name',
  B.KEYS[0].key === 'position' && ['best', 'last', 'avg', 'median', 'record', 'laps', 'totaltime', 'totaltimeall', 'speed', 'champ', 'penpoints', 'pentime', 'damage', 'pits', 'fuel', 'lane', 'name'].every(k => B.KEYS.some(x => x.key === k)) && B.KEYS.length === 18);
ok('every value has a label and a hint line for what comes on top, and a key is used once', B.KEYS.every(k => k.label && k.top) && new Set(B.KEYS.map(k => k.key)).size === B.KEYS.length && B.CHOICES.length === B.KEYS.length && B.CHOICES.every(c => c.length === 2));
ok('the choice for the end on top is Best first (the standard) or Worst first', B.DIRECTIONS.map(d => d[0]).join() === 'best,worst' && B.DIRECTIONS.map(d => d[1]).join() === 'Best first,Worst first');
ok('a setting that is not one of the values is the race position, and any direction but "worst" is "best" (a damaged or imported file never breaks a board)',
  ['', 'bogus', 7, null, undefined, 'BEST', {}, ['best']].every(v => B.keyOf({ orderBy: v }) === 'position' && !B.isOrdered({ orderBy: v })) && B.keyOf(null) === 'position' && B.keyOf(undefined) === 'position' && B.keyOf({}) === 'position'
  && B.keyOf({ orderBy: 'best' }) === 'best' && B.isOrdered({ orderBy: 'laps' }) && ['', 'x', null, 1, 'WORST'].every(v => B.dirOf({ orderDir: v }) === 'best') && B.dirOf({ orderDir: 'worst' }) === 'worst' && B.dirOf(null) === 'best');
ok('the hint says what stands on top, and for the race position that the rows follow the race', B.hintOf('best').includes('the fastest lap') && B.hintOf('laps').includes('the most laps') && B.hintOf('penpoints').includes('the fewest penalty points') && B.hintOf('position').includes('follow the race')
  && B.hintOf('best').includes('Position column') && B.hintOf('nonsense') === B.hintOf('position'));

// ---- the order ----
{ const l = rows();
  ok('the race position leaves the list as it is: the very same list comes back', B.order(l, {}, () => 1) === l && B.order(l, { orderBy: 'position' }, () => 1) === l && B.order(l, { orderBy: 'nonsense', orderDir: 'worst' }, () => 1) === l); }
ok('a time: the fastest first (Best first is the standard)', names(by({ A: 9000, B: 7000, C: 8000, D: 6000 }, { orderBy: 'best' })) === 'DBCA');
ok('...and Worst first turns it round', names(by({ A: 9000, B: 7000, C: 8000, D: 6000 }, { orderBy: 'best', orderDir: 'worst' })) === 'ACBD');
ok('laps and points: the most first (Best first), the fewest first with Worst first', names(by({ A: 3, B: 5, C: 4, D: 1 }, { orderBy: 'laps' })) === 'BCAD' && names(by({ A: 3, B: 5, C: 4, D: 1 }, { orderBy: 'laps', orderDir: 'worst' })) === 'DACB'
  && names(by({ A: 10, B: 25, C: 18, D: 0 }, { orderBy: 'champ' })) === 'BCAD');
ok('penalty and damage points: the fewest first (Best first), the most first with Worst first (a board of who needs a talking-to)', names(by({ A: 3, B: 0, C: 8, D: 1 }, { orderBy: 'penpoints' })) === 'BDAC' && names(by({ A: 3, B: 0, C: 8, D: 1 }, { orderBy: 'penpoints', orderDir: 'worst' })) === 'CADB'
  && names(by({ A: 2, B: 2, C: 0, D: 5 }, { orderBy: 'damage' })) === 'CABD');
ok('a disqualified car (infinity points) is the worst there is: last with Best first, first with Worst first', names(by({ A: Infinity, B: 0, C: 4, D: 1 }, { orderBy: 'penpoints' })) === 'BDCA' && names(by({ A: Infinity, B: 0, C: 4, D: 1 }, { orderBy: 'penpoints', orderDir: 'worst' })) === 'ACDB');
ok('cars with the same value keep their race order (a tie is never shuffled)', names(by({ A: 5, B: 5, C: 5, D: 5 }, { orderBy: 'laps' })) === 'ABCD' && names(by({ A: 5, B: 9, C: 5, D: 9 }, { orderBy: 'laps' })) === 'BDAC' && names(by({ A: 5, B: 9, C: 5, D: 9 }, { orderBy: 'laps', orderDir: 'worst' })) === 'ACBD');
ok('...the race order is the place in the race (pos), not where the row happens to stand in the list', names(B.order(rows().reverse(), { orderBy: 'laps' }, () => 5)) === 'ABCD' && names(B.order(rows().reverse(), { orderBy: 'laps' }, x => (x.car.n === 'C' ? 9 : 5))) === 'CABD');
ok('a car without a value (no lap yet, or the race has no such rule) stays at the bottom, whichever end is on top, and those stay in race order', names(by({ A: null, B: 7000, C: undefined, D: 6000 }, { orderBy: 'best' })) === 'DBAC'
  && names(by({ A: null, B: 7000, C: undefined, D: 6000 }, { orderBy: 'best', orderDir: 'worst' })) === 'BDAC' && names(by({ A: NaN, B: '', C: 3, D: null }, { orderBy: 'laps' })) === 'CABD' && names(by({}, { orderBy: 'best' })) === 'ABCD');
ok('a zero is a value, not a missing one (a car with no penalty points is the cleanest, not the unknown)', names(by({ A: 3, B: 0, C: null, D: 2 }, { orderBy: 'penpoints' })) === 'BDAC');
ok('names go in alphabetical order (not case sensitive, numbers in a name as numbers), A to Z first with Best first', names(by({ A: 'kim', B: 'Alex', C: 'sam 10', D: 'Sam 9' }, { orderBy: 'name' })) === 'BADC' && names(by({ A: 'kim', B: 'Alex', C: 'sam 10', D: 'Sam 9' }, { orderBy: 'name', orderDir: 'worst' })) === 'CDAB');
ok('the lane: lane 1 first', names(by({ A: 3, B: 0, C: 2, D: 1 }, { orderBy: 'lane' })) === 'BDCA');
ok('the rows come out as copies: the place in this board, the place in the race, and a mark that says the board is ordered; the list that went in is not changed', (() => {
  const l = rows(), before = JSON.stringify(l), out = B.order(l, { orderBy: 'laps' }, x => ({ A: 1, B: 2, C: 3, D: 4 })[x.car.n]);
  return JSON.stringify(l) === before && names(out) === 'DCBA' && out.map(x => x.pos).join() === '1,2,3,4' && out.map(x => x.racePos).join() === '4,3,2,1' && out.every(x => x.byOrder === true) && out[0].car === l[3].car && out[0].gap === l[3].gap && l.every(x => !('byOrder' in x));
})());
ok('...and the rows of the race list are never marked', rows().every(x => !x.byOrder));
ok('it is sorted once for every row: the value is asked once per row', (() => { let n = 0; B.order(rows(), { orderBy: 'best' }, x => { n++; return 1; }); return n === 4; })());
ok('nothing breaks on strange input: no list, an empty list, rows without a place, no value function', B.order(null, { orderBy: 'best' }, () => 1) === null && B.order([], { orderBy: 'best' }, () => 1).length === 0
  && names(B.order([{ car: { n: 'X' } }, { car: { n: 'Y' } }], { orderBy: 'best' }, x => (x.car.n === 'Y' ? 1 : 2))) === 'YX' && names(B.order(rows(), { orderBy: 'best' })) === 'ABCD');
ok('a list of 50 rows is put in order the same way (a big field)', (() => { const l = Array.from({ length: 50 }, (_, i) => ({ pos: i + 1, car: { n: i } })), o = B.order(l, { orderBy: 'best' }, x => (x.car.n * 7) % 50); return o.map(x => (x.car.n * 7) % 50).every((v, i, a) => !i || a[i - 1] <= v) && o[0].pos === 1 && o[49].pos === 50; })());

console.log(fails ? `\n${fails} BOARD ORDER TESTS FAILED` : '\nboardorder: all PASSED');
process.exit(fails ? 1 : 0);
