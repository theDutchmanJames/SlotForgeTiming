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
  assert.ok(css.includes('html .rdeck>:is(#lcpanel,#dir-cards),html .rdeck .lc,html .rdeck .lc-main{display:contents}'));
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
        classList: {
          set: new Set(),
          toggle(c, on) {
            on ? this.set.add(c) : this.set.delete(c);
          },
          contains(c) {
            return this.set.has(c);
          }
        },
        setAttribute(k, v) {
          this.attrs[k] = v;
        },
        appendChild(c) {
          this.children.push(c);
        }
      };
      made.push(e);
      return e;
    }
  };
  const grid = {
      children: [],
      appendChild(c) {
        this.children.push(c);
      }
    },
    host = { innerHTML: '', querySelector: () => grid, hidden: false };
  let on = true;
  const eng = {
    status: 'running',
    systemsOf: () => ({
      fuel: { available: true, enabled: true, effective: true },
      pushsave: { available: true, enabled: on, effective: false }
    }),
    systemEnabled: () => on
  };
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

test('the Race Director page of Live Race has the same desk, with its own commands', () => {
  const lv = R('renderer/liveview.js');
  assert.match(lv, /useCards && typeof RaceDeck !== 'undefined'\s*\? RaceDeck\.mount\(body, \{\s*page: 'director'/);
  assert.match(lv, /tyreNext: \(lane, code\) => send\(\{ type: 'tyrenext', lane, tyre: code \}\)/);
  assert.match(lv, /if \(deck\) deck\.update\(\);/);
  assert.ok(css.includes('html #lv-dir>.lv-ctl.rd-strip{'));
  assert.ok(
    /@media \(max-width:760px\)\{\s*html \.rdeck>:is\(#lcpanel,#dir-cards\)\{display:block/.test(css),
    'a phone keeps the one-lane view of the cards'
  );
});

test('the tables of the race and the results after the race have their own styles (Race Sheet, Scrutineering)', () => {
  assert.ok(css.includes('html .rd-sheet table.fields th{'));
  assert.ok(css.includes('html .race-finish .rv-lap{display:flex;flex-wrap:nowrap'));
  assert.ok(css.includes('html .race-finish .rv-pads .pad-plus{'));
});

test('a heat race: the heat that is next as a card with its drivers by lane and Start; the heat list as cards; the lanes of a final in the lane colours', () => {
  assert.ok(race.includes('<section id="heatnext" class="hn" aria-label="The heat that is next" hidden></section>'));
  assert.match(race, /const drawHeatNext = \(\) => \{/);
  assert.match(race, /data-hn="start"/);
  assert.match(race, /if \(b && \(live\.phase === 'ready' \|\| live\.phase === 'between'\)\) actions\.start\(\);/);
  assert.ok(race.includes('<span class="hl-lane"'), 'the words of a lane stay "Lane 1: Alex"');
  assert.ok(race.includes('class="btn fp-lane"'));
  assert.ok(css.includes('html #heatlist table.hl>tbody{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:8px}'));
  assert.ok(css.includes('html #raceactive>.hn{display:grid'));
});
