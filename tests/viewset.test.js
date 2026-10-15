const V = require('../renderer/viewset.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const cols = [{ key: 'a', on: true }, { key: 'b', on: true }, { key: 'c', on: false }];
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);

ok('without a choice the defaults are shown, in the order of the columns', same(V.keys(cols, undefined), ['a', 'b']) && same(V.keys(cols, {}), ['a', 'b']) && same(V.keys(cols, null), ['a', 'b']));
ok('a choice turns a column off or on', same(V.keys(cols, { a: false }), ['b']) && same(V.keys(cols, { c: true }), ['a', 'b', 'c']));
ok('a column that is not in the choice (a new extra field) has its default', same(V.keys([...cols, { key: 'd', on: true }, { key: 'e', on: false }], { a: false }), ['b', 'd']));
ok('something that is not true or false in the saved choice is ignored', same(V.keys(cols, { a: 'no', b: 0, c: 1 }), ['a', 'b']));
ok('a choice about a column that is gone does no harm', same(V.keys(cols, { zzz: false }), ['a', 'b']));
ok('never nothing: when every column is off the defaults are shown', same(V.keys(cols, { a: false, b: false }), ['a', 'b']) && same(V.keys([{ key: 'z', on: false }], {}), ['z']));

let s = V.set({}, cols, 'a', false);
ok('turning a column off keeps that as a choice', same(s, { a: false }));
s = V.set(s, cols, 'a', true);
ok('...and turning it on again takes the choice away (it says what the default says)', same(s, {}));
ok('turning a column on that is off by default keeps that', same(V.set({}, cols, 'c', true), { c: true }) && same(V.set({ c: true }, cols, 'c', false), {}));
s = V.set(V.set({}, cols, 'a', false), cols, 'b', false);
ok('the last column that is shown cannot be turned off', same(V.keys(cols, s), ['b']) && same(s, { a: false }));
ok('...but another one can be turned on first, and then it can', same(V.keys(cols, V.set(V.set(s, cols, 'c', true), cols, 'b', false)), ['c']));
ok('a column that does not exist changes nothing', same(V.set({ a: false }, cols, 'nope', true), { a: false }));
const before = { a: false };
V.set(before, cols, 'b', false);
ok('the saved choice itself is never changed (a copy comes back)', same(before, { a: false }));

const all = { tracks: { list: { a: false } } };
ok('get reads along a path, and gives {} when a step is missing', same(V.get(all, ['tracks', 'list']), { a: false }) && same(V.get(all, ['drivers', 'list']), {}) && same(V.get(undefined, ['x']), {}) && same(V.get({ x: 5 }, ['x', 'y']), {}));
const next = V.put(all, ['tracks', 'grid'], { q: true });
ok('put gives a copy with the new value; the rest is kept and the original is not touched', same(next, { tracks: { list: { a: false }, grid: { q: true } } }) && same(all, { tracks: { list: { a: false } } }));
ok('put makes the steps on the way, also on nothing', same(V.put(undefined, ['results', 'records'], { x: false }), { results: { records: { x: false } } }));
ok('put on a step that is not an object replaces it', same(V.put({ results: 5 }, ['results', 'records'], {}), { results: { records: {} } }));
console.log(fails ? fails + ' VIEWSET TESTS FAILED' : 'ALL VIEWSET TESTS PASSED'); process.exit(fails ? 1 : 0);
