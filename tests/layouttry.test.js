'use strict';
// 2.4.0: the Layout Editor reworked (renderer/layouttry.js, layoutcheck.js, widgetpreview.js, editor.js, SlotForgeRestyle.md "Try It"): a sample race
// that moves on the canvas, the race setups that use a layout, the words a custom text does not know, Delete that names the setups and asks what they
// use instead, and the libraries (Audio sets, Picture sets) named as libraries.
const test = require('node:test'),
  assert = require('node:assert/strict');
const P = require('../renderer/widgetpreview.js');
const C = require('../renderer/layoutcheck.js');
const { code, has } = require('./source.cjs');

test('the sample race moves, at every moment, with the lanes asked for', () => {
  const at = t => P.play({ lanes: 4, t, moment: 'racing' });
  const a = at(30000),
    b = at(65000);
  assert.equal(a.shared.eng.cars.length, 4);
  assert(b.lap > a.lap, 'later: more laps');
  assert.equal(b.clock, '01:05');
  assert.notEqual(
    P.content({ type: 'clock' }, { play: a.shared }).html,
    P.content({ type: 'clock' }, { play: b.shared }).html,
    'the clock widget moves'
  );
  const lights = P.play({ lanes: 2, t: 2500, moment: 'lights' });
  assert.equal(lights.shared.phase, 'countdown');
  assert.equal(lights.lap, 0, 'nobody has a lap while the lights count');
  assert.equal(lights.shared.lights, 4);
  assert.equal(P.play({ t: 60000, moment: 'yellow' }).shared.eng.flag, 'yellow');
  const red = P.play({ t: 60000, moment: 'red' }).shared;
  assert.equal(red.phase, 'paused');
  assert.equal(red.eng.flag, 'red');
  assert.equal(P.play({ t: 60000, moment: 'finished' }).shared.phase, 'finished');
  assert.equal(P.play({ lanes: 8 }).shared.track.lanes, 8);
  // through the editor's preview context, as the canvas asks for it
  assert.equal(
    P.content({ type: 'racelaps', previewContext: { play: b.shared } }).html,
    P.content({ type: 'racelaps' }, { play: b.shared }).html
  );
  assert.equal(P.content({ type: 'clock' }).html, P.content({ type: 'clock' }).html, 'without a play the still sample of before');
});

test('the words a custom text does not know, and what to use', () => {
  const w = { type: 'textlane', lane: 0, title: 'Lap counter', opt: { text: 'LAP {laps} / {lapsleft} {nmae} {xyz} {name}' } };
  assert.deepEqual(
    C.unknownWords(w).map(x => [x.word, x.other, x.suggest]),
    [
      ['lapsleft', 'race', 'lapstogo'],
      ['nmae', '', 'name'],
      ['xyz', '', '']
    ]
  );
  assert.equal(
    C.advice(C.unknownWords(w)[0], 'textlane'),
    '{lapsleft} is a word of the whole race, not of a lane. On a lane use {lapstogo}, or put it in a race text widget.'
  );
  assert.equal(C.advice(C.unknownWords(w)[1], 'textlane'), '{nmae} is not a word of a lane. Did you mean {name}? It shows as typed.');
  assert.deepEqual(
    C.unknownWords({ type: 'textrace', opt: { text: '{best}' } }).map(x => x.other),
    ['lane']
  );
  assert.deepEqual(
    C.unknownWords({ type: 'textlane', opt: { text: '{lapsleft}', composition: { root: {} } } }),
    [],
    'a composed text is left alone'
  );
  assert.deepEqual(C.unknownWords({ type: 'clock' }), []);
  assert.deepEqual(C.unknownWords({ type: 'textlane' }), [], 'the default text is fine');
  const pr = C.problems({ widgets: [{ type: 'clock' }, w] });
  assert.deepEqual(
    pr.map(p => [p.index, p.title, p.lane, p.words.length]),
    [[1, 'Lap counter', 1, 3]]
  );
});

test('who uses a layout, and what deleting it changes', () => {
  const setups = [
    { id: 'a', name: 'QA heats', layout: 'L' },
    { id: 'b', name: 'Token night', layout2: 'L' },
    { id: 'c', name: 'Both', layout: 'L', layout2: 'L' },
    { id: 'd', name: 'Other', layout: 'X' }
  ];
  assert.deepEqual(
    C.usedBy(setups, 'L').map(u => [u.name, u.screen]),
    [
      ['QA heats', 'main'],
      ['Token night', 'second'],
      ['Both', 'main'],
      ['Both', 'second']
    ]
  );
  assert.deepEqual(C.deletePlan(setups, 'L', 'M'), [
    { id: 'a', patch: { layout: 'M' } },
    { id: 'b', patch: { layout2: 'M' } },
    { id: 'c', patch: { layout: 'M', layout2: 'M' } }
  ]);
  assert.deepEqual(C.deletePlan(setups, 'L', ''), [
    { id: 'a', patch: { layout: '' } },
    { id: 'b', patch: { layout2: '' } },
    { id: 'c', patch: { layout: '', layout2: '' } }
  ]);
  assert.deepEqual(C.deletePlan(setups, 'L', 'L')[0].patch, { layout: '' }, 'never the layout that goes');
  assert.deepEqual(C.usedBy(setups, 'none'), []);
});

test('the editor, the list and the libraries', () => {
  const ed = code('renderer/editor.js'),
    lt = code('renderer/layouttry.js');
  assert(has(ed, "play: typeof LayoutTry !== 'undefined' ? LayoutTry.shared(ed) : null"));
  assert(has(ed, "(tried && LayoutTry.off(state.editing, w) ? ' lt-off' : '') +"));
  assert(has(ed, '<div class="lt-bar" id="e-try" role="region" aria-label="Try it with a sample race"></div>'));
  assert(has(ed, '<button class="btn" data-try="${esc(l.id)}" title="Open it and play a sample race">Try it</button>'));
  assert(has(ed, 'if ((await LayoutTry.remove(l, layouts)) && box.isConnected !== false && !state.editing) renderLayoutList(box);'));
  assert(has(lt, "const r = await api.backupMake({ kind: 'safety', note: `Before deleting the layout ${l.name}` })"));
  assert(has(lt, "for (const p of plan) await api.update('racesetups', p.id, p.patch);"));
  assert(
    has(lt, "if (changed.length && typeof fitEditorWidgets === 'function') fitEditorWidgets(changed);"),
    'a frame fits only what changed'
  );
  assert(has(ed, "['audio', 'Audio sets', 'say', 'Libraries'],"));
  assert(has(ed, "['images', 'Picture sets', 'paint'],"));
  const html = code('renderer/index.html');
  assert(has(html, '<script src="layoutcheck.js"></script>') && has(html, '<script src="layouttry.js"></script>'));
});
