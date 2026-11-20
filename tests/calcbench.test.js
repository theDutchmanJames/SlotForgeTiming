'use strict';
// 2.4.0: App Settings › Calculations as an Engineer's Bench (renderer/calcbench.js, calculationsui.js, SlotForgeRestyle.md "Engineer's Bench"): each topic as a
// question, Try it (nothing is saved) beside Your rules with one save bar and Undo, the formulas with your numbers, the laps of a real race, compare with
// another system, where a system is used, find a calculation, and the formula sheet.
const test = require('node:test'),
  assert = require('node:assert/strict');
const B = require('../renderer/calcbench.js');
const { code, has } = require('./source.cjs');

test('every topic is a question with one line', () => {
  for (const id of ['pace', 'fuel', 'effects', 'resources', 'pits', 'estimates', 'results']) {
    const [q, line] = B.head(id);
    assert.match(q, /\?$/, id);
    assert(line.length > 20, id);
  }
  assert.equal(B.head('pace')[0], 'How fast is normal?');
});

test('where a saved system is used: the race setups that point to it', () => {
  const fields = [
    { key: 'pushSave', ref: 'pushsavesystems' },
    { key: 'fuelRules', ref: 'fuelrules' }
  ];
  const setups = [
    { name: 'Club night', pushSave: 'p1' },
    { name: 'Endurance', pushSave: 'p2' },
    { name: 'Test race', pushSave: 'p1', fuelRules: 'f1' }
  ];
  assert.deepEqual(B.usedBy(setups, fields, 'pushsavesystems', 'p1'), ['Club night', 'Test race']);
  assert.deepEqual(B.usedBy(setups, fields, 'fuelrules', 'f1'), ['Test race']);
  assert.deepEqual(B.usedBy(setups, fields, 'weathersystems', 'w1'), [], 'a kind no setup field points to');
  assert.equal(B.usedText(['A', 'B', 'C', 'D', 'E']), 'Used by A · B · C +2');
  assert.equal(B.usedText([]), 'Not used by a race setup yet');
});

test('find a calculation: every word must be in it, the title counts double', () => {
  const idx = B.index([
    {
      id: 'estimates',
      title: 'Estimates & timing',
      formulas: [{ title: 'Fuel Range widget', equation: 'laps left = remaining fuel ÷ use', text: 'samples recent laps' }]
    },
    {
      id: 'fuel',
      title: 'Fuel & tyres',
      formulas: [
        { title: 'Fuel consumption', equation: 'litres used = base × factors', text: 'per lap' },
        { title: 'Tyre life used', equation: 'wear = …', text: 'fuel is not part of it' }
      ]
    }
  ]);
  assert.deepEqual(
    B.find(idx, 'fuel').map(f => f.title),
    ['Fuel consumption', 'Fuel Range widget', 'Tyre life used']
  );
  assert.deepEqual(
    B.find(idx, 'fuel range').map(f => [f.title, f.topic]),
    [['Fuel Range widget', 'estimates']]
  );
  assert.deepEqual(B.find(idx, ''), []);
  assert.deepEqual(B.find(idx, 'nothing here'), []);
});

test('the laps as bars: the benchmark line, the new lap and the laps left out', () => {
  const b = B.lapBars([10, 10.2, 9.8, 12], 10.1, 9.5, [false, false, false, true]);
  assert.equal(b.bars.length, 4);
  assert.equal(b.bars[3].out, true);
  assert(b.bars[3].pct > b.bars[0].pct, 'a slower lap is a taller bar');
  assert(b.lap.pct < b.ref.pct, 'the faster new lap is under the benchmark line');
  assert(b.bars.every(x => x.pct > 0 && x.pct <= 100));
  assert.equal(B.lapBars([], 0, 0), null);
});

test('the verdict of a lap: how much faster or slower, and push or save', () => {
  assert.equal(B.verdict(-5.94, { tyres: 1.4, full: true }).head, '5.9% faster · full push');
  assert.equal(B.verdict(-1.5, { tyres: 1.2 }).head, '1.5% faster · pushing');
  assert.equal(B.verdict(4, { tyres: 0.85 }).state, 'save');
  assert.equal(B.verdict(0.5, { tyres: 1 }).head, '0.5% slower · normal');
  assert.equal(B.verdict(null).head, 'No benchmark yet');
  assert.equal(B.pctOf(1.4), '+40%');
  assert.equal(B.pctOf(0.75), '−25%');
});

test('the formula sheet: every topic and formula on one page, escaped', () => {
  const html = B.sheetHtml(
    [
      {
        id: 'pace',
        title: 'Pace benchmarks',
        formulas: [{ title: 'Pace <difference>', equation: '(lap ÷ ref − 1) × 100%', text: 'Negative is faster.', worked: '9.5 vs 10' }]
      }
    ],
    { title: 'Race calculations' }
  );
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<h2>Pace benchmarks<\/h2>/);
  assert.match(html, /How fast is normal\?/);
  assert.match(html, /<h3>Pace &lt;difference&gt;<\/h3>/);
  assert.match(html, /<pre>\(lap ÷ ref − 1\) × 100%<\/pre>/);
  assert.match(html, /@media print/);
});

test('the bench is wired: Try it, Your rules with one save bar, the formulas with your numbers', () => {
  const ui = code('renderer/calculationsui.js');
  assert(has(ui, '<span class="cb-tag">Preview · nothing is saved</span>'));
  assert(has(ui, 'data-cb-saveall'), 'one save bar');
  assert(has(ui, 'data-cb-undo'));
  assert(has(ui, 'await f._submit?.({ preventDefault() {} });'), 'Save submits each changed form');
  assert(has(ui, 'drafts[e] = patchOf();'), 'Try it follows unsaved values');
  assert(has(ui, 'data-cb-compare'), 'compare with another system');
  assert(
    has(ui, "api.historySession('racing', lapSource.race, { revision: lapSource.revision, exportAll: true })"),
    'the laps of a real race'
  );
  assert(has(ui, 'CalcBench.usedBy(refs.racesetups, fields, e, row.id)'));
  assert(has(ui, 'CalcBench.find(findIndex, find.value)'));
  assert(has(ui, "'Race calculations.html'"), 'the formula sheet');
  assert(has(ui, 'data-cb-reset'));
  assert(has(ui, "'Pace difference': 'pace'"), 'the formulas that follow Try it');
  assert(has(code('renderer/generalpage.js'), '.cb-on'), 'the page is drawn as it is');
  const html = code('renderer/index.html');
  assert(html.indexOf('calcbench.js') > 0 && html.indexOf('calcbench.js') < html.indexOf('calculationsui.js'));
});
