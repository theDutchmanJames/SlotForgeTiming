'use strict';
// 2.4.0: the design pass checked again (docs/REMAKE-INVENTORY.md "Checked again"): the fixes that change no design. The Deslot field shows what the
// race uses, the track length is not "(optional)" beside "Missing", chart designs and picture sets say which layouts use them, a Widget Builder card
// says when its text has a word it does not know (with better suggestions), and the cut-off texts.
const test = require('node:test'),
  assert = require('node:assert/strict');
const C = require('../renderer/layoutcheck.js');
const { code, has } = require('./source.cjs');

test('a value never saved shows what the race uses; no "(optional)" beside "Missing"', () => {
  const db = code('renderer/database.js');
  assert(
    has(
      db,
      "e === 'damagesystems' && f.type === 'number' && (item[f.key] === undefined || item[f.key] === '') && typeof Damage !== 'undefined'"
    )
  );
  assert.equal(require('../renderer/damage.js').clean({}).deslotPoints, 1, 'the race uses 1 point for a deslot when none is saved');
  const schema = require('../schema.js'),
    s = schema.tracks || (schema.SCHEMA || {}).tracks || (typeof schema === 'function' ? null : null);
  const tracks = s || Object.values(schema).find(x => x && Array.isArray(x.fields) && x.fields.some(f => f.key === 'laneModifier'));
  const len = tracks.fields.find(f => f.key === 'length');
  assert.equal(len.optional, true, 'it can still be left empty');
  assert.equal(len.optionalMark, false);
  assert(
    has(code('renderer/database/fields.js'), "f.optional && f.optionalMark !== false ? ' <span class=\"muted\">(optional)</span>' : ''")
  );
  assert(has(code('renderer/formui.js'), "f.optional && f.optionalMark !== false ? ' <span class=\"muted\">(optional)</span>' : ''"));
});

test('which layouts use a chart design or a picture set', () => {
  const layouts = [
    { name: 'QA layout', widgets: [{ type: 'racechart', opt: { chartDesign: 'ch1' } }] },
    {
      name: 'Club night TV',
      widgets: [
        { type: 'fuel', opt: { imageSet: 'img1' } },
        { type: 'racechart', opt: { chartDesign: 'ch1' } }
      ]
    }
  ];
  const rows = [{ name: 'Big names', widgets: [{ type: 'avatar', opt: { imageSet: 'img1' } }] }];
  assert.deepEqual(C.layoutsUsing('ch1', [layouts, rows]), ['QA layout', 'Club night TV']);
  assert.deepEqual(C.layoutsUsing('img1', [layouts, rows]), ['Club night TV', 'Big names']);
  assert.deepEqual(C.layoutsUsing('ch', [layouts]), [], 'a whole id, not a part of one');
  assert.equal(C.usesLine(['QA layout']), 'Used in <b>1 layout</b> · QA layout');
  assert.equal(C.usesLine([]), '<span class="lt-none">Not in a layout yet</span>');
  assert(has(code('renderer/charteditor.js'), '<div class="lt-usedline" data-lt-uses="${esc(r.id)}"></div>'));
  assert(has(code('renderer/editor.js'), '<div class="lt-usedline" data-lt-uses="${esc(r.id)}"></div>'));
});

test('the suggestions for a word a text does not know', () => {
  const sug = (type, text) => C.unknownWords({ type, opt: { text } }).map(u => [u.word, u.suggest]);
  assert.deepEqual(sug('textrace', '{racename} {racedist}'), [
    ['racename', 'session'],
    ['racedist', 'racedistance']
  ]);
  assert.deepEqual(sug('textlane', '{lapsleft} {nmae} {bestlap} {xyz}'), [
    ['lapsleft', 'lapstogo'],
    ['nmae', 'name'],
    ['bestlap', 'best'],
    ['xyz', '']
  ]);
  assert(has(code('renderer/widgetworkshop.js'), '<small class="wk-warn" role="note">⚠ ${esc(LayoutCheck.advice(unknown[0], w.type))}'));
});

test('the texts that were cut off', () => {
  assert(has(code('renderer/race.js'), "if (e.setAttribute) e.setAttribute('title', e.textContent);"));
  const css = code('renderer/styles.css');
  assert(has(css, 'html .rc-bar #tmstatus{max-width:260px;'));
  assert(has(css, '@media (max-width:1500px){html .gx-sort>span{display:none}}'));
  assert(has(code('renderer/database/recordbookview.js'), 'placeholder="Race or driver"'));
});
