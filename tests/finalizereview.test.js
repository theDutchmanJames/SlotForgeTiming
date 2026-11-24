'use strict';
// 2.4.0: the Finalize review reworked (renderer/review.js, race.js, raceover.js, stats.js, database/results.js, SlotForgeRestyle.md "Finalize Review"):
// the heat named in the review, the changes made in it with what they did to the place, Undo the last change, Run this heat again, Delete the whole race
// with the races already finalized, and the changes kept with the result (the break, Race Over, the Record Book and the Race Report).
const test = require('node:test'),
  assert = require('node:assert/strict');
global.window = global;
global.esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
global.RaceEngine = require('../renderer/engine.js');
global.Stats = require('../renderer/stats.js');
global.Icons = { trophy: () => '<svg class="trophy"></svg>' };
global.AdjustPad = { padsHtml: () => '<div data-pad="time"></div>' };
global.Distance = { sectorLabel: (s, k) => 'S' + k };
const Review = require('../renderer/review.js');
const RaceOver = require('../renderer/raceover.js');
const { code, has } = require('./source.cjs');

// two cars, 5 laps each: Anna a little faster than Bjorn
function race() {
  const E = [0, 1].map(i => ({ lane: i, driverId: 'd' + i, carId: 'c' + i, driverName: ['Anna', 'Bjorn'][i] }));
  const r = RaceEngine.createRace({ type: 'race', laps: 5, minLap: 500, entries: E });
  r.start(0);
  const t = [0, 0];
  for (let k = 0; k < 5; k++)
    for (let i = 0; i < 2; i++) {
      t[i] += 5000 + i * 200;
      r.cross(i, t[i]);
    }
  r.stop(t[1] + 10);
  return r;
}

test('a change is listed with its words and the place before and after; the last one can be undone', () => {
  const r = race(),
    log = [];
  assert.equal(Review.record(r, { op: 'adjust', car: 0, ms: 5000 }, log), true);
  assert.deepEqual(
    log.map(x => [x.kind, x.name, x.text, x.from, x.to]),
    [['Time', 'Anna', '+5 s', 1, 2]]
  );
  Review.record(r, { op: 'invalid', car: 1, lap: 1, on: true }, log);
  assert.equal(log[1].text, 'lap 2 marked invalid (5.200)');
  assert.equal(Review.undo(r, log), true);
  assert.deepEqual(r.cars[1].invalid, [], 'the lap counts again');
  assert.equal(Review.undo(r, log), true);
  assert.equal(r.cars[0].adjMs || 0, 0, 'the time is taken off again');
  assert.equal(r.standings()[0].car.driverName, 'Anna');
  assert.equal(Review.undo(r, log), false, 'nothing left');
});

test('time added for a penalty and the penalty settled is one change, with no way back; nothing that did not change is listed', () => {
  const r = race(),
    log = [];
  r.cars[1].pending.push({ name: 'Jump start', unserved: 5 });
  Review.record(r, { op: 'addtime', car: 1, ms: 5000 }, log);
  Review.record(r, { op: 'forgive', car: 1, k: 0 }, log);
  assert.equal(log.length, 1);
  assert.equal(log[0].text, '+5 s penalty for Jump start');
  assert.equal(log[0].undo, null);
  assert.equal(Review.undo(r, log), false);
  Review.record(r, { op: 'undq', car: 0 }, log);
  assert.equal(log.length, 1, 'reinstating a driver that is not disqualified changes nothing');
  assert.deepEqual(Object.keys(Review.keepChanges(log)[0]).sort(), ['from', 'kind', 'name', 'text', 'to'], 'no commands are kept');
});

test('the review of a heat: its name, what comes next, Run again, Delete the whole race; the phone has no Delete', () => {
  const r = race(),
    h = Review.finishHtml(r, { heat: { name: 'Heat 1', no: 1, total: 2, next: 'Heat 2', done: 0, rerun: 1 }, changes: [] });
  assert(h.includes("DIRECTOR'S FINAL CHECK · HEAT 1 OF 2"));
  assert(h.includes('<h2>Finalize heat 1</h2>'));
  assert(h.includes('This is run 2 of it: the first was set aside.'));
  assert(h.includes('Heat 2 is next'));
  assert(h.includes('data-rv="rerun" data-name="heat 1">Run heat 1 again'));
  assert(h.includes('data-heats="0">Delete the whole race…'));
  const phone = Review.finishHtml(r, { heat: { name: 'Heat 2', no: 2, total: 2, next: null, done: 1 }, local: false });
  assert(!phone.includes('data-rv="discard"'));
  assert(phone.includes('Then the result of the event is saved'));
  const single = Review.finishHtml(r, {});
  assert(single.includes('Finalize results') && single.includes('Delete all data') && !single.includes('data-rv="rerun"'), 'a single race as before');
});

test('the changes card: a change that moved the place, Undo only when it has a way back', () => {
  const card = Review.changesHtml([
    { kind: 'Time', name: 'Bjorn', text: '+5 s', from: 1, to: 2, undo: { op: 'adjust' } },
    { kind: 'Result', name: 'Anna', text: 'disqualified', from: 2, to: null, undo: null }
  ]);
  assert(card.includes('Your changes · 2'));
  assert(card.includes('rf-mv dn">1st → 2nd'));
  assert(card.includes('2nd → DQ'));
  assert(!card.includes('data-rv="undo"'), 'the last change has no way back');
  assert.equal(Review.changesHtml([]), '');
});

test('the changes are kept with the result and said in words', () => {
  const s = {
    heatResults: [
      { heat: 1, checked: { reruns: 1, changes: [] }, rows: [] },
      { heat: 2, checked: { changes: [{ name: 'Bjorn', text: '+1 s', from: 1, to: 2 }] }, rows: [] },
      { heat: 3, rows: [] }
    ]
  };
  assert.deepEqual(Stats.checkedLines(s), ['Heat 1: run again once; only the run that was finalized counts.', 'Heat 2: Bjorn +1 s, 1st → 2nd.']);
  assert.equal(Stats.checkedText({ checked: { changes: [{ name: 'Anna', text: 'lap 2 valid again', from: 1, to: 1 }] } }), 'Changed before saving: Anna lap 2 valid again.');
  assert.equal(Stats.checkedText({}), '');
});

test('Race Over and the break: the result checked, a race run again, the tags on the heat track', () => {
  const block = RaceOver.checkedHtml({ reruns: 1, changes: [{ name: 'Anna', text: 'lap 2 taken out of the records', from: 2, to: 2 }] });
  assert(block.includes('Result checked · 1 change') && block.includes('Run again once') && !block.includes('→'));
  assert.equal(RaceOver.checkedHtml(null), '');
  const trk = RaceOver.heatTrack([
    { name: 'Heat 1', state: 'done', winner: { name: 'Bjorn' }, reruns: 1, changes: 2 },
    { name: 'Heat 2', state: 'next', again: true }
  ]);
  assert(trk.includes('Run twice') && trk.includes('2 changes') && trk.includes('run again'));
  const brk = RaceOver.breakHtml({ again: true, startable: true, next: { name: 'Heat 1', drivers: [] }, aside: { name: 'Heat 1', runs: [{ result: 'Anna won · Bjorn +0.820 s' }] } });
  assert(brk.includes('Heat 1 <em>run again</em>') && brk.includes('<s>Anna won · Bjorn +0.820 s</s>'));
});

test('the race: Run again sets the run aside and waits for it; Finalize keeps the changes; the phone cannot delete', () => {
  const race = code('renderer/race.js');
  assert(has(race, "if (c.op === 'rerun') return heats ? rerunHeat() : undefined;"));
  assert(has(race, 'else Review.record(eng, c, live.rvChanges);'));
  assert(has(race, 'function rerunHeat()'));
  assert(has(race, 'eng = mk(seated(heat.entries()));'));
  assert(!/function rerunHeat\(\)[\s\S]{0,1600}heat\.record\(/.test(race), 'a run that is set aside is not recorded');
  assert(has(race, 'res.checked = {'));
  assert(has(race, "...(h.checked ? { checked: h.checked } : {}),"));
  assert(has(race, "cmd.type === 'review' && cmd.op !== 'discard'"));
  assert(has(race, 'reruns: live.reruns,') && has(race, 'live.rerunAt = Number.isInteger(hs.rerunAt) ? hs.rerunAt : -1;'), 'kept in the recovery file');
  assert(has(code('renderer/database/results.js'), "Changed before saving · director's final check"));
  assert(has(code('renderer/report.js'), 'ST.checkedText(session)'));
  assert(has(code('renderer/liveview.js'), 'local: false'));
});
