'use strict';
// 2.4.0: Help reworked (renderer/helpdesk.js, helpview.js, help.js, SlotForgeRestyle.md "Help Desk"): every page has its article (the "?" beside the
// title and F1 open it in a drawer), every article of a page opens it, the Help home (the first race ticked from your data, read lately, a tile per
// group), the article of a page first in its group with a count, Before / Next, the search marks the words and lists the settings too.
const test = require('node:test'),
  assert = require('node:assert/strict');
const Help = require('../renderer/help.js');
const V = require('../renderer/helpview.js');
const { code, has } = require('./source.cjs');
const ids = new Set(Help.folders().map(f => f.id));

test('every page has an article that is there, and the article opens its page', () => {
  V.PAGE_LIST.forEach(([key, id]) => assert(ids.has(id), key + ': ' + id));
  assert.equal(V.topicOfPage({ tab: 'setup', setupSub: 'fuel' }), 'fuel');
  assert.equal(V.topicOfPage({ tab: 'database', sub: 'drivers' }), 'garage');
  assert.equal(V.topicOfPage({ tab: 'settings', settingsSub: 'hardware' }), 'hardware');
  assert.equal(V.topicOfPage({ tab: 'rules' }), 'racingrules');
  assert.equal(V.topicOfPage({ tab: 'settings', settingsSub: 'help' }), '', 'Help itself has none');
  assert.deepEqual(V.ROUTES.fuel, { tab: 'setup', setupSub: 'fuel' });
  assert.deepEqual(V.ROUTES.garage, { tab: 'database', sub: 'slotcars' }, 'the first page of an article is the one it opens');
  assert.deepEqual(V.ROUTES.pluginrules, { tab: 'setup', setupSub: 'setups' }, 'the routes of before stay');
  // every Database, Race Setup, Customization and App Settings page of the app is in the list
  const app = code('renderer/app.js'),
    editor = code('renderer/editor.js'),
    basics = code('renderer/database/basics.js');
  const subs = (src, name) =>
    [
      ...src
        .slice(src.indexOf(name))
        .split('];')[0]
        .matchAll(/\[\s*'(\w+)',\s*'/g)
    ].map(m => m[1]);
  const keys = new Set(V.PAGE_LIST.map(x => x[0]));
  subs(basics, 'const SUBS = [').forEach(s => assert(keys.has('database/' + s), 'database/' + s));
  subs(editor, 'const CUSTOM_TABS = [').forEach(s => assert(keys.has('custom/' + s), 'custom/' + s));
  subs(app, 'const SETTINGS_TABS = [')
    .filter(s => s !== 'help')
    .forEach(s => assert(keys.has('settings/' + s), 'settings/' + s));
  subs(editor, 'const SETUP_GROUPS = [').forEach(s => assert(keys.has('setup/' + s), 'setup/' + s));
});

test('the Help home: the first race ticked from the figures, read lately, a tile per group', async () => {
  const read = [];
  const v = V.create({ folders: Help.folders, WELCOME: Help.WELCOME, recent: () => ['fuel', 'gone', 'find'], read: id => read.push(id) });
  assert.equal(v.state.topic, 'help-home');
  assert(v.select('home') && v.html().includes('The Home tab'), 'the article of the Home tab is still there');
  v.select('help-home');
  let h = v.html();
  assert(h.includes('Your first race, step by step') && h.includes('class="help-steps"'));
  assert(!h.includes('help-progress'), 'no figures yet: no bar');
  assert(h.includes('data-help-topic="fuel"') && h.includes('data-help-topic="find"'));
  assert.equal((h.match(/class="help-tile"/g) || []).length, 8);
  const box = { innerHTML: '', isConnected: true, querySelectorAll: () => [], querySelector: () => null };
  v.render(box, { progress: Promise.resolve({ tracks: 2, drivers: 3, cars: 0, setups: 1, races: 0 }) });
  await new Promise(r => setTimeout(r, 0));
  h = v.html();
  assert(h.includes('Start here · 2 of 4 done'));
  assert(h.includes('aria-valuenow="2"'));
  assert(
    /<li class="done"><button type="button" data-help-route="step-tracks"><i>✓ Done<\/i><b>Add your track<\/b><small>2 tracks<\/small>/.test(
      h
    )
  );
  assert(/<li class="next"><button type="button" data-help-route="step-drivers"><i>Next<\/i>/.test(h), 'no car yet: the next step');
  assert.deepEqual(V.ROUTES['step-drivers'], { tab: 'database', sub: 'drivers' });
  v.select('fuel');
  assert.deepEqual(read, ['home', 'fuel'], 'an article read is remembered');
});

test('groups: the article of a page first, a count; Before / Next; the search', () => {
  const v = V.create({
    folders: Help.folders,
    WELCOME: Help.WELCOME,
    settings: q => (/logo/.test(q) ? [{ t: 'Club logo', where: 'Home and club' }] : [])
  });
  const systems = v.groups.find(g => g.id === 'systems');
  assert.equal(systems.ids[0], 'fuel');
  assert(systems.ids.indexOf('championships') < systems.ids.indexOf('servicestop'), 'a page article before the ones that go deeper');
  assert(v.groups.find(g => g.id === 'settings').ids.includes('sqlitestorage'), 'the SQLite articles are with the database');
  v.select('fuel');
  const h = v.html();
  assert(h.includes(`<summary>Race Systems<span class="help-count">${systems.ids.length}</span></summary>`));
  assert(h.includes('<small>Next →</small>' + Help.folders().find(f => f.id === systems.ids[1]).title));
  v.select('director');
  assert(v.html().includes('data-help-route="director">Open Race Director ↗'), 'every page article opens its page');
  v.state.query = 'club logo';
  const s = v.html();
  assert(s.includes('<mark>logo</mark>'));
  assert(s.includes('data-help-setting="0"><strong><mark>Club</mark> <mark>logo</mark></strong><small>Home and club</small>'));
  let went = null;
  const box = { innerHTML: '', querySelectorAll: () => [], querySelector: () => null };
  v.render(box, { onSetting: e => (went = e) });
  box.onclick({ target: { closest: () => ({ dataset: { helpSetting: '0' }, hasAttribute: () => false }) } });
  assert.equal(went.t, 'Club logo');
});

test('the drawer: the page you are on, no page buttons over a form', () => {
  const v = V.create({ folders: Help.folders, WELCOME: Help.WELCOME });
  v.state.drawer = true;
  v.state.page = 'fuel';
  v.select('fuel');
  let h = v.html();
  assert(h.includes('help-drawer-in') && h.includes('data-help-close') && h.includes('data-help-full'));
  assert(h.includes('<span class="help-here">About this page</span>'));
  assert(!h.includes('data-help-route="fuel"'), 'on its own page: no Open Fuel Systems');
  v.select('tyrewear');
  assert(v.html().includes('data-help-route="tyrewear"'));
  v.state.locked = true;
  h = v.html();
  assert(!h.includes('data-help-route') && !h.includes('data-help-full'), 'over a form the page stays');
  const desk = code('renderer/helpdesk.js');
  assert(has(desk, "if (ev.key !== 'F1') return;"));
  assert(has(desk, 'if (modal) box.showModal();'));
  assert(has(desk, 'if (view.state.locked) return; // (over a form: the page stays)'));
  assert(has(desk, '<button type="button" class="hlp-q" data-hlp-open="${id}"'));
  assert(has(code('renderer/index.html'), '<script src="helpdesk.js"></script>'));
  assert(has(code('renderer/app.js'), "progress: typeof HelpDesk !== 'undefined' ? HelpDesk.progress() : null,"));
});
