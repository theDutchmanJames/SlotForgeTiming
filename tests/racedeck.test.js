'use strict';
// 2.4.0: the Lane Desk on the race screen (renderer/racedeck.js). Its moves need a real page (checked in the app); here: that it is wired,
// that every tab is a folder of the race screen, that it stays out of the folders setting and of pages without a real DOM, and its styles.
const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('fs'),
  path = require('path');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const race = R('renderer/race.js'),
  css = R('renderer/styles.css'),
  html = R('renderer/index.html');
global.window = global;
const D = require('../renderer/racedeck.js');

test('the desk is loaded after the lane cards and mounted only with the lane cards on', () => {
  assert.ok(html.indexOf('lanecards.js') < html.indexOf('racedeck.js') && html.includes('<script src="racedeck.js"></script>'));
  assert.match(race, /if \(cardsOn && typeof RaceDeck !== 'undefined'\)\s*live\.deck = RaceDeck\.mount\(host,/);
  assert.match(race, /if \(live\.deck\) live\.deck\.update\(\);/);
  assert.ok(race.indexOf('DirFolder.bind(host)') < race.indexOf('live.deck = RaceDeck.mount'), 'after the panels are built');
});

test('every tab of the desk is a folder of the race screen', () => {
  for (const [id] of D.TABS) assert.ok(race.includes(`folderHtml('${id}'`), id);
});

test('without a real page (the screen tests, a stand-in document) the desk does nothing', () => {
  assert.equal(D.mount({ querySelector: () => null }, {}), null);
});

test('the keys stay said in full for screen readers, and are shown as key caps', () => {
  assert.ok(race.includes('<p class="muted rd-keyline">Space starts, pauses and resumes'));
  assert.ok(race.includes('<div class="rd-keys" aria-hidden="true">'));
  assert.ok(css.includes('html .rd-keyline{position:absolute;width:1px;height:1px'));
});

test('the styles: the Race Director box sits in the grid, the lanes follow their number, the tabs show one table', () => {
  assert.ok(css.includes('html .rdeck>#lcpanel,html .rdeck .lc,html .rdeck .lc-main{display:contents}'));
  assert.ok(css.includes('html .rdeck[data-n="4"] .lc-cards{grid-template-columns:repeat(2,minmax(0,1fr))}'));
  assert.ok(css.includes('html .rdeck:is([data-n="7"],[data-n="8"]) .lc-cards{grid-template-columns:repeat(4,minmax(0,1fr))}'));
  assert.ok(css.includes('html .rd-panes>.rd-pane.rd-off,html .rd-panes>.rd-pane[hidden]{display:none}'));
  assert.ok(css.includes('html .rt-folders.rd-on>.dirfolder.rd-gone{display:none}'));
});

test('a racing system says its state in a part of its own (the desk shows a dot), and "needs Fuel" stays', () => {
  const S = require('../renderer/racesystems.js');
  const made = [];
  global.document = {
    createElement: tag => {
      const e = {
        tag,
        children: [],
        dataset: {},
        attrs: {},
        className: '',
        textContent: '',
        classList: { set: new Set(), toggle(c, on) { on ? this.set.add(c) : this.set.delete(c); }, contains(c) { return this.set.has(c); } },
        setAttribute(k, v) { this.attrs[k] = v; },
        appendChild(c) { this.children.push(c); }
      };
      made.push(e);
      return e;
    }
  };
  const grid = { children: [], appendChild(c) { this.children.push(c); } },
    host = { innerHTML: '', querySelector: () => grid, hidden: false };
  let on = true;
  const eng = { status: 'running', systemsOf: () => ({ fuel: { available: true, enabled: true, effective: true }, pushsave: { available: true, enabled: on, effective: false } }), systemEnabled: () => on };
  const p = S.build(host, { eng: () => eng, send() {} });
  const [fuel, ps] = grid.children;
  assert.equal(fuel.textContent, 'Fuel');
  assert.equal(fuel.children[0].className, 'ss-state');
  assert.equal(fuel.children[0].textContent, ' · On');
  assert.equal(ps.children[0].textContent, ' · On (needs Fuel)');
  assert.equal(ps.classList.contains('ss-need'), true);
  const before = made.length;
  p.update();
  assert.equal(made.length, before, 'nothing is made again while the state stays');
  on = false;
  p.update();
  assert.equal(ps.children.at(-1).textContent, ' · Off');
  assert.equal(ps.classList.contains('ss-need'), false);
  delete global.document;
});
