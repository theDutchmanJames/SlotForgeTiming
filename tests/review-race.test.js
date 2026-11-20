'use strict';
// 2.4.0 review: the race screen, after the race and the live views (R1-R9 of the bug review).
const test = require('node:test'),
  assert = require('node:assert/strict');
const { code, has } = require('./source.cjs');
const race = () => code('renderer/race.js'),
  lv = () => code('renderer/liveview.js');

test('R1: a race that is stopped while the pre-race call is said does not start its lights', () => {
  const c = race();
  assert(has(c, "function startCountdown() { if (!['ready', 'between'].includes(live.phase)) return;"));
  assert(has(c, 'function endCall() { live.callRun = -1; live.calling = false; clearTimeout(live.callTimer); }'));
  assert(has(c, 'async function finishAll() { if (mc && heats) live.classResultRows'), 'finishAll is still there');
  assert(has(c, "if (live.calling || live.phase === 'between') Sound.stop();"));
  assert(has(c, "endCall(); live.phase = 'finished';"), 'finishAll, discardAll and endTokens end the call');
  assert.equal((c.match(/endCall\(\);/g) || []).length >= 3, true);
});

test('R2: the race keys wait while a dialog is open', () => {
  const c = race();
  assert(has(c, 'const dialogOpen = ev => {'));
  assert(has(c, "isDlg(document.querySelector('dialog[open]'))"));
  assert(has(c, 'const isDlg = el => el instanceof HTMLDialogElement;'));
  assert.equal((c.match(/if \(dialogOpen\(ev\)\) return;/g) || []).length, 2, 'the race keys and the full screen key');
});

test('R3: nothing starts a token session while the question about the earlier one is open', () => {
  const c = race();
  assert(has(c, 'live.restoring = true;'));
  assert(has(c, 'live.restoring = false; if (carryOn)'));
  assert(has(c, 'start() { if (live.restoring) return;'));
  assert(has(c, 'if (!live || live.actions !== actions || !cmd || live.restoring) return;'));
});

test('R4: Run again takes the laps of the run that was set aside out of the bests', () => {
  const c = race(),
    rerun = c.slice(c.indexOf('function rerunHeat()'), c.indexOf('async function discardAll()'));
  assert(has(rerun, "live.phase = 'between'; eng = mk(heat.entries()); recomputeBests();"));
});

test('R5: the notes of the title fight are text, never markup', () => {
  global.RaceEngine = require('../renderer/engine.js');
  const RaceOver = require('../renderer/raceover.js');
  const view = {
    state: 'race',
    round: 1,
    total: 3,
    name: 'Club cup',
    after: { drivers: [{ id: 'a', pos: 1, name: 'Sam', total: 10 }], cols: [] },
    rows: [],
    notes: ['<img src=x onerror=alert(1)> is a guest: no points.']
  };
  const h = RaceOver.champCard(view, { awarded: true });
  assert(!h.includes('<img src=x'), 'the name is not a picture');
  assert(h.includes('&lt;img src=x onerror=alert(1)&gt; is a guest'));
});

test('R6: the second screen goes back to its page when the next heat starts', () => {
  const c = lv();
  assert(has(c, "if (followedFrom !== null && page === 'results' && ['countdown', 'running'].includes(d.phase)) {"));
  assert(
    has(c, "const from = followedFrom !== null ? followedFrom : page; go('results'); followedFrom = from === 'results' ? null : from;")
  );
  assert(has(c, 'page = p; followedFrom = null;'), 'a page that is picked by hand is kept');
});

test('R7: the lane picks of a final come back to the race page when the race screen is shown in a break', () => {
  assert(has(race(), "live.roShown = which || ''; if (which !== 'break') roPark();"));
});

test('R8: ending an event in a break stops the paddock loop', () => {
  assert(has(race(), "if (live.calling || live.phase === 'between') Sound.stop();"));
});

test('R9: a Live Race mount that waits ends when it was unmounted meanwhile', () => {
  const c = lv();
  assert(has(c, 'function unmount() { mountN++;'));
  assert(has(c, 'unmount(); const my = mountN;'));
  assert.equal((c.match(/if \(my !== mountN\) return;/g) || []).length, 3);
  assert(has(c, 'const mine = V;'));
  assert(has(c, 'if (V && V === mine && g && g.stat) {'));
});
