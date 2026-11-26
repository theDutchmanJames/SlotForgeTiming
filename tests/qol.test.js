'use strict';
// The small quality-of-life batch of 2.5.2 (docs/qol-2026-11-26.md: A1–A6, B1–B3, C1, C2, D1).
const test = require('node:test'),
  assert = require('node:assert/strict'),
  vm = require('node:vm');
const { code, has } = require('./source.cjs');

test('A1: the computer stays awake while a race is on, and is let go when the race is left', () => {
  const main = code('main.js'),
    race = code('renderer/race.js');
  assert(has(main, "awakeId = powerSaveBlocker.start('prevent-display-sleep');"));
  assert(has(main, 'if (awakeId !== null && powerSaveBlocker.isStarted(awakeId)) powerSaveBlocker.stop(awakeId);'));
  assert(has(main, "wc.on('render-process-gone', off);") && has(main, "wc.on('did-start-navigation', nav);"), 'a reload or a crash of the window lets go too');
  assert(has(code('preload.js'), "raceAwake: on => call('race:awake', !!on),"));
  assert(has(race, "const awake = ['countdown', 'running', 'paused', 'between', 'review'].includes(live.phase) || !!live.saving || !!live.rescue;"), 'also while the results are saved, or wait for Retry');
  assert(has(race, 'if (live.awake && api.raceAwake) api.raceAwake(false).catch(() => {});'), 'leaving the race lets the computer sleep again');
});

test('A2: a lap counted by hand can be taken back with Ctrl + Shift + the lane number, and the next lap is timed from the crossing before', () => {
  const E = require('../renderer/engine.js'),
    r = E.createRace({ type: 'race', laps: 30, entries: [{ lane: 0 }] });
  r.start(0);
  r.cross(0, 100);
  r.cross(0, 5100); // a real lap of 5 s
  r.cross(0, 6000); // a lap counted by hand by mistake
  const c = r.cars[0],
    gone = c.laps[1];
  assert.equal(r.removeLap(0, 1, true), true);
  c.last -= gone; // (what undoHandLap does)
  r.cross(0, 10100);
  assert.equal(c.laps.length, 2);
  assert.equal(Math.round(c.laps[1]), 5000, 'the next real lap is a whole lap, not the part after the mistake');
  const race = code('renderer/race.js');
  assert(has(race, '(ev.shiftKey ? undoHandLap : actions.call)(l);'));
  assert(has(race, 'function raceButtonsAndKeys({ actions, crossLane, lanes, layout, togglePit, ui, update, undoHandLap }) {') && has(race, 'raceButtonsAndKeys({ actions, crossLane, lanes, layout, togglePit, ui, update, undoHandLap });'), 'the key handler gets it (it lives in another function)');
  assert(has(race, 'if (!c || c.done || h.n !== c.laps.length - 1) {'), 'only the latest lap of a car that is still racing');
});

test('A3: Undo DNF in the review classifies the car by its laps again, and can be done again', () => {
  const E = require('../renderer/engine.js'),
    Review = require('../renderer/review.js');
  const r = E.createRace({ type: 'race', laps: 3, endRule: 'all', entries: [{ lane: 0 }, { lane: 1 }] });
  r.start(0);
  r.cross(0, 100);
  r.cross(1, 100);
  r.cross(1, 5000);
  r.cross(1, 9000);
  r.retire(1, 9500);
  r.cross(0, 10000);
  r.cross(0, 14000);
  r.cross(0, 18000);
  assert.equal(r.status, 'finished');
  assert.equal(r.standings().find(x => x.car.lane === 1).pos, 2, 'the DNF car is behind');
  const changes = [];
  Review.record(r, { op: 'undnf', car: 1 }, changes);
  assert.equal(r.cars[1].retired, false);
  assert.equal(r.cars[1].retiredBy, '');
  assert.equal(changes.length, 1);
  Review.undo(r, changes);
  assert.equal(r.cars[1].retiredBy, 'director', 'Undo gives the DNF back');
  assert.equal(r.setDnf(0, false), false, 'a car that was not retired by the Race Director is left alone');
  assert.equal(r.setDnf(0, true), false, 'and a DNF is not made in the check for a car that raced on (a phone cannot either)');
  assert.equal(r.cars[1].retiredAt !== null, true, 'the time of the DNF is back with it');
  assert.equal(require('../server.js').cleanCommand({ type: 'review', op: 'undnf', car: 1 }).op, 'undnf', 'the phone may send it');
});

test('A4–A6: the race in the phone header, a quick reconnect, Saving the results…', () => {
  const view = code('renderer/liveview.js'),
    web = code('renderer/webapi.js');
  assert(has(view, 'function controlTitle(d) {'));
  assert(has(view, "isControl(page) ? controlTitle(d) : V.stat().title,"));
  assert(has(web, 'liveReconnect: () => reconnectNow(true),'));
  assert(has(web, "window.addEventListener('online', () => {"));
  assert(has(view, 'el.onclick = () => api.liveReconnect();'));
  assert(has(code('renderer/race.js'), "ui('msg').textContent = 'Saving the results…';"));
});

test('B1–B3, C1: greyed-out drivers and cars, Draw lanes and Clear all, a deleted layout or system in the race check', () => {
  const L = code('renderer/landing.js');
  // optionsOf, run on its own: a car on another lane is grey and cannot be picked twice
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'renderer', 'landing.js'), 'utf8'),
    start = src.indexOf('const optionsOf = '),
    end = src.indexOf('\n\n', start);
  const ctx = { esc: x => String(x), titleOf: (e, i) => i.name };
  vm.createContext(ctx);
  vm.runInContext(src.slice(start, end) + ';this.o=optionsOf;', ctx);
  const html = ctx.o('slotcars', [{ id: 'a', name: 'Audi' }, { id: 'b', name: 'BMW' }], 'a', '(choose)', new Map([['b', 'on lane 2']]));
  assert(/value="b" disabled>BMW · on lane 2</.test(html), html);
  assert(/value="a" selected>Audi</.test(html), 'the row\'s own choice stays');
  assert(has(L, "if (display || (key === 'driverId' && withTeam) || (key === 'carId' && seats)) return null;"), 'team races and Swap Seats keep their rules, the second screen draws no lists');
  assert(has(L, "if (b.id === 'drawlanes') {") && has(L, "if (b.id === 'drawundo' && state.homeDraw && state.homeDraw.setupId === setupId) {") && has(L, "if (b.id === 'clearlanes') {"));
  const RC = require('../renderer/racecheck.js');
  const items = RC.build({ hasSetup: true, entries: 2, lanes: 2, missing: ['Its Fuel system was deleted: the race runs without it.'] }).sections.find(x => x.key === 'race').items;
  const warn = items.find(x => x.title === 'About the race setup');
  assert(warn && warn.level === 'warn' && /Fuel system was deleted/.test(warn.sub));
  assert(has(L, "missing.push('Its layout has no Followed widgets"), 'C1');
});

test('C2: in a choice dialog the arrow keys move the choice and Enter answers', () => {
  const D = code('renderer/dialogs.js');
  assert(has(D, "const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[ev.key];"));
  assert(has(D, "} else if (ev.key === 'Enter') {"));
});

test('D1: the Record Book says when it read its data, and Refresh reads it again', () => {
  const R = code('renderer/database/recordbookview.js');
  assert(has(R, 'Data as of ${esc(rbAsOf())}'));
  assert(has(R, 'rbCache = null; // (2.5.2: read again now)'));
});
