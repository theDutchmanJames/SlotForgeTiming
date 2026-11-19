'use strict';
// 2.4.0: the last screens in the new look: the startup window (start lights), Circuit design (the file as a drop card, no ring around the body), the
// record tables (a note wraps), an empty Results and Records (a card), the race folders with the Lane Desk off.
const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('fs'),
  path = require('path');
const R = path.join(__dirname, '..', 'renderer');
const read = f => fs.readFileSync(path.join(R, f), 'utf8');

test('the startup window: the checkered strip, five start lights instead of the bar, the font of the app allowed, the lights held when motion is reduced', () => {
  const html = read('startup.html'),
    css = read('startup.css');
  assert.match(html, /font-src 'self'/);
  assert.equal((html.match(/<div class="lights" aria-hidden="true">((?:<i><\/i>){5})<\/div>/) || [])[1]?.length, 35, 'five lights');
  assert.ok(html.includes('<div class="check" aria-hidden="true"></div>'));
  assert.ok(!html.includes('class="progress"'));
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{\.lights i\{animation:none\}/);
  assert.match(css, /BarlowCondensed-BoldItalic\.ttf/);
});

test('Circuit design: the Circuit file is a drop card with the real file input over it; the body draws no focus ring', () => {
  const ui = read('trackdesignui.js'),
    css = read('styles.css');
  assert.ok(ui.includes('<span class="td-drop">') && ui.includes('<input type="file" accept=".json,.slotforge.json" data-file></span></label>'));
  assert.ok(css.includes('html .track-design-dialog .td-body:focus{outline:none}'));
  assert.ok(css.includes('html .track-design-dialog .td-drop>input[type=file]{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}'));
});

test('Results and Records: a note in the record tables wraps; an empty page is a card; the race folders with the Lane Desk off', () => {
  const css = read('styles.css'),
    res = fs.readFileSync(path.join(R, 'database', 'results.js'), 'utf8');
  assert.ok(css.includes('td.actions{white-space:normal;min-width:84px;max-width:150px}'));
  assert.match(res, /card\(\s*'tokens',\s*'No stints yet',\s*'No token results yet\./);
  assert.match(res, /card\(\s*'flag',\s*'No races yet',\s*'No results yet\./);
  assert.ok(css.includes('html .rt-folders:not(.rd-on)>.dbfolder.dirfolder{margin:0;border:1px solid var(--line);border-left:3px solid var(--fc)'));
  assert.ok(css.includes('html .rt-folders:not(.rd-on) table.boptable th{'));
});
