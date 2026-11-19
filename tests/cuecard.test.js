'use strict';
// 2.4.0: a call of an audio set as a Cue Card (renderer/audiostudio.js). Its moves need a real page (checked in the app); here: what the card is made of,
// and what "Sounds like" says under a line.
const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('fs'),
  path = require('path');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const studio = R('renderer/audiostudio.js'),
  css = R('renderer/styles.css');

test('the card: Plays when, What it says with every line, ▶ and ⋯ (how it plays, delete), race values as chips, one more line', () => {
  for (const s of [
    "'Plays when'",
    "'What it says'",
    "'Say it'",
    "'Play a sound file'",
    "'Sound file, then say it'",
    "'Delete this line'",
    "'+ Add another line'",
    'data-audio-insert="${key}:${k}"',
    "'Only when…'"
  ])
    assert.ok(studio.includes(s), s);
  assert.ok(!studio.includes("choice.textContent = ambient ? 'Recording' : 'Variation'"), 'no Variation list any more');
  assert.ok(!studio.includes("'Variation actions'") && !studio.includes("'Insert a race value'"), 'no folders around a line');
  assert.ok(
    css.includes('html .audio-editor .cue-line:focus-within .cue-vars{display:flex}'),
    'the values show under the line you type in'
  );
});

test('"Sounds like" only when a line has a race value, and what is wrong when it can not be said', () => {
  global.window = global;
  global.esc = s => String(s);
  global.Sound = { defaultSet: () => ({}) };
  global.Announcer = {
    CALLS: [{ id: 'newleader', vars: ['driver'] }],
    SAMPLE: { driver: 'Alex' },
    fill: (t, s) => t.replace('{driver}', s.driver)
  };
  global.AudioCalls = {
    variablesFor: c => c.vars,
    inspect: (t, c) => ({ unknown: (t.match(/\{(\w+)\}/g) || []).map(x => x.slice(1, -1)).filter(k => !c.vars.includes(k)), missing: [] })
  };
  const src = studio.slice(0, studio.indexOf('function audioFolder('));
  new Function(src + '\nglobal.__preview = audioPreview;')();
  const say = line => {
    const el = { dataset: { messagePreview: 'newleader:0' }, classList: { toggle() {} }, textContent: '', hidden: false };
    global.__preview({ nodeType: 1, querySelectorAll: () => [el] }, { calls: { newleader: { lines: [line] } } });
    return el;
  };
  assert.equal(say({ text: '{driver} takes the lead' }).textContent, 'Sounds like: “Alex takes the lead”');
  const plain = say({ text: 'A new leader!' });
  assert.equal(plain.textContent, '');
  assert.equal(plain.hidden, true, 'a line without values needs no example');
  assert.match(say({ text: '{gap} ahead' }).textContent, /does not know \{gap\}/);
  assert.equal(say({ text: '', mode: 'file' }).textContent, 'Choose a sound file to hear this line.');
  assert.equal(say({ text: '', mode: 'file', file: 'data:audio/wav;base64,AA' }).textContent, '');
});
