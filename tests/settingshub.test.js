'use strict';
// 2.4.0: App Settings grouped by task (renderer/app.js, settingsoverview.js, generalpage.js, padui.js, transferui.js, settingsindex.js, help.js,
// SlotForgeRestyle.md "Settings Hub"): an Overview first that says how every part stands, the side list by task (Look and feel, Race night, Your data,
// This computer), General split into the pages of its topics, Database storage on Backups and storage, the Race Director password on the Race Director
// page (Phones and tablets), Paddock and Content Packs pages of their own, and the old pages still found (links, the settings search, Find, Help).
const test = require('node:test'),
  assert = require('node:assert/strict');
const SO = require('../renderer/settingsoverview.js');
const SI = require('../renderer/settingsindex.js');
const { code, has, flat } = require('./source.cjs');

test('the Overview: every page with how it stands, and the band on top', () => {
  const t = SO.tiles(
    { netOn: true, netPort: 8799, netPassword: 'x', appName: 'Club', clubLogo: 'data:' },
    {
      hw: { id: 'trackmate', name: 'Trackmate Interface', device: true },
      backups: { list: [{ date: '2026-11-20T13:43:00Z' }], status: { on: true }, sameDrive: true },
      when: () => 'Today, 14:43',
      storage: 'SQLite',
      library: true,
      plugins: 0,
      packs: 2,
      version: '2.4.0',
      cards: true,
      lib: { uiScale: '100%', depth: 'Soft lift', speed: 'km/h', dist: 'metres' }
    }
  );
  assert.equal(t.display.line, '100% · Soft lift · km/h · metres');
  assert.deepEqual(t.hardware, { line: 'Trackmate Interface · remembered', tone: 'ok' });
  assert.equal(t.director.line, 'Lane cards · phones with a password');
  assert.deepEqual(t.sharing, { line: 'On · port 8799', tone: 'ok' });
  assert.deepEqual(t.transfer, { line: 'Backed up today, 14:43 · SQLite', tone: 'warn', note: 'The backups are on the same drive' });
  assert.equal(t.packs.line, '2 packs installed');
  assert.equal(t.plugins.line, 'None installed');
  assert.equal(t.updates.line, 'Version 2.4.0');
  assert.deepEqual(SO.band(t), { ready: true, look: ['The backups are on the same drive'] });
  const none = SO.tiles({}, { hw: { id: 'none' } });
  assert.equal(none.hardware.tone, 'warn');
  assert.equal(SO.band(none).ready, false);
  const h = SO.html(t);
  assert(h.includes('data-so-go="director"') && h.includes('Ready for race night') && h.includes('1 thing to look at'));
  assert.deepEqual(
    SO.GROUPS.map(g => g[0]),
    ['Look and feel', 'Race night', 'Your data', 'This computer']
  );
});

test('the side list by task, and the old pages open where they are now', () => {
  const app = code('renderer/app.js');
  assert(
    has(
      flat(app),
      "['overview','Overview','home'],['display','Displayandunits','screen'],['theme','AppTheme','paint'],['home','Homeandclub','home'],['hardware','TimingHardware','timing'],['director','RaceDirector','director'],['sharing','Sharetherace','parallel']"
    )
  );
  assert(
    has(
      app,
      "const SETTINGS_GROUPS = { display: 'Look and feel', hardware: 'Race night', transfer: 'Your data', performance: 'This computer', help: 'Help' };"
    )
  );
  assert(has(app, "if (sub === 'general') return 'display';"));
  assert(
    has(
      app,
      "['paddock', 'dealership', 'library'].includes(ct || (typeof connectionsTab !== 'undefined' ? connectionsTab : '')) ? 'paddock' : 'sharing'"
    )
  );
  assert(has(app, 'state.settingsSub = settingsRoute(state.settingsSub);'), 'every way in goes through the route');
  assert(
    has(app, 'return settingsGo({ ...e, s: GENERAL_TOPIC_PAGE[topic.dataset.gtopic] });'),
    'a setting of another topic opens its page'
  );
  assert(
    has(
      code('renderer/mainbar.js'),
      "{ hardware: 'hardware', connections: 'paddock', qr: 'sharing', backup: 'transfer' }[go] || 'overview'"
    )
  );
  assert(has(code('renderer/generalpage.js'), 'function build(box, only) {'));
});

test('what moved: Database storage, the Race Director password, Paddock and Content Packs', () => {
  const app = code('renderer/app.js');
  assert(!app.includes("'data',\n      'Database storage'"), 'General has no Database storage any more');
  assert(has(code('renderer/transferui.js'), "tf('storage', 'Database storage',"));
  assert(has(code('renderer/transferui.js'), "GeneralPage.storageOn(box.querySelector('[data-storage-body]'))"));
  assert(has(code('renderer/padui.js'), "typeof netAccessHtml === 'function' ? netAccessHtml() : ''"));
  assert(has(code('renderer/settingspage.js'), "['phones', 'Phones and tablets', 'Password and pairing a phone', 'parallel']"));
  assert(has(app, "${part === 'sharing' ? '' : `<section data-settings-group=\"access\">"), 'Share the race has no password');
  assert(has(app, "if (state.settingsSub === 'paddock')") && has(app, "if (state.settingsSub === 'packs')"));
});

test('the settings search, Find and Help know the new places', () => {
  assert.equal(SI.ENTRIES.filter(e => e.s === 'general' || e.s === 'network').length, 0);
  assert.equal(SI.search('password race director')[0].where, 'Race Director');
  assert(SI.search('database storage').some(e => e.where === 'Backups and storage'));
  assert(SI.search('club logo').some(e => e.where === 'Home and club'));
  assert(SI.search('paddock').some(e => e.k === 'page' && e.s === 'paddock'));
  const help = code('renderer/help.js');
  ['App Settings → Connections', 'App Settings, General', 'App Settings → General', 'App Settings → Import and Export'].forEach(t =>
    assert(!help.includes(t), t)
  );
  assert(help.includes('App Settings → Share the race') && help.includes('App Settings → Backups and storage → Database storage'));
});
