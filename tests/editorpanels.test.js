'use strict';
// 2.4.0, SlotForgeRestyle.md "Editor Panels": the panels of the Layout Editor and the Leaderboard Editor in the new look. The widget list is a rail
// (Barlow folders with a count, quiet rows), the settings have a head with the lane as eight buttons, the arrange tools are pictures, and the
// explanations fold to one line with More.
const test = require('node:test'),
  assert = require('node:assert/strict');
const { code, has } = require('./source.cjs');
const E = code('renderer/editor.js'),
  S = code('renderer/styles.css');

test('the widget list: a folder says how many widgets it holds, the widgets are quiet rows', () => {
  assert.ok(has(E, '<summary><span class="pal-t">${esc(name)}</span><span class="pal-n">'));
  assert.ok(has(E, '`<button class="pal-it" data-add="${x.type}">${esc(x.label)}</button>'));
  assert.ok(has(E, '<div class="pal-cap">Widgets</div>'));
  assert.ok(/\.ed-pal \.pal-it:hover::after,html \.ed-pal \.pal-it:focus-visible::after\{opacity:1\}/.test(S), 'the + under the pointer');
});

test('the head of the settings: the lane as eight buttons that set the hidden Lane list', () => {
  assert.ok(has(E, '<header class="ed-insp"><span class="insp-k">${kindLine}</span>'));
  assert.ok(has(E, 'data-lanebtn="${l}" aria-pressed="${l === lane}"'));
  assert.ok(has(E, '<div class="field insp-lanefield" hidden><label for="s-lane">Lane</label><select id="s-lane">'));
  assert.ok(has(E, 'pick.value = b.dataset.lanebtn;'));
  assert.ok(has(E, 'side.onchange({ target: pick });'));
  assert.ok(has(E, "row ? 'Row cell'"), 'the Leaderboard Editor names a row cell');
});

test('the arrange tools are pictures with their words as the tooltip, and explanations fold', () => {
  for (const k of ['align-left', 'align-bottom', 'layer-front', 'layer-back', 'dist-x']) assert.ok(has(E, `'${k}': ARR_SVG(`), k);
  assert.ok(has(E, 'class="arr-i" data-arr="${k}" title="${esc(tip || t)}" aria-label="${esc(t)}"'));
  assert.ok(has(E, 'function foldSideHints(root) {'));
  assert.ok(/html #side \.hint\{[^}]*-webkit-line-clamp:1/.test(S));
});

test('no :has() in the new panel styles (it makes every change to the page restyle more of it)', () => {
  const block = S.slice(S.indexOf('/* (2.4.0, SlotForgeRestyle.md "Editor Panels")'));
  assert.ok(block.length > 100);
  assert.ok(!block.includes(':has('));
});
