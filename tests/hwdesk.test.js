'use strict';
// 2.4.0: App Settings › Timing Hardware as a Timing Desk (renderer/hwdesk.js, hwdeskview.js, SlotForgeRestyle.md "Timing Desk"): the overview with the big card and
// the live lanes, the interfaces as cards with Connect & use, the sections of an interface as tabs, Diagnostics behind a switch, the lane order found by driving
// a car over each lane, the Forgotten devices, the DS serial settings remembered.
const test = require('node:test'),
  assert = require('node:assert/strict');
const D = require('../renderer/hwdesk.js');
const { code, has } = require('./source.cjs');

test('how an interface stands, and its card', () => {
  const ctx = { chosen: 'trackmate', connected: { trackmate: true, arduino: false }, remembered: { arduino: 'remembered device' } };
  assert.deepEqual(D.standing('trackmate', ctx), { tone: 'use', text: 'In use · connected' });
  assert.deepEqual(D.standing('trackmate', { ...ctx, connected: {} }), { tone: 'warn', text: 'In use · not connected' });
  assert.deepEqual(D.standing('arduino', ctx), { tone: 'ready', text: 'Ready · remembered device' });
  assert.deepEqual(D.standing('ds', { ...ctx, connected: { ds: true } }), { tone: 'ready', text: 'Connected · not counting laps' });
  assert.deepEqual(D.standing('parallel', ctx), { tone: 'off', text: 'Not set up' });
  const tm = D.cardHtml(D.deviceOf('trackmate'), D.standing('trackmate', ctx));
  assert.match(tm, /class="hd-card use"/);
  assert.doesNotMatch(tm, /data-hd-use/, 'the one in use has no Connect & use');
  const ard = D.cardHtml(D.deviceOf('arduino'), D.standing('arduino', ctx), { primary: true });
  assert.match(ard, /<button type="button" class="btn sm primary" data-hd-use="arduino">Connect &amp; use<\/button>/);
  assert.match(D.soonCard(), /oXigen Digital.*Coming later/s);
  assert.deepEqual(
    D.DEVICES.map(d => d.id),
    ['trackmate', 'arduino', 'parallel', 'ds', 'plugin'],
    'no Other page, no oXigen page'
  );
  assert.deepEqual(D.deviceOf('ds').diag, ['guide', 'monitor', 'check'], 'the DS capture tools are Diagnostics');
});

test('the big card and the live lanes', () => {
  const h = D.heroHtml({
    id: 'none',
    kicker: 'Timing hardware',
    name: 'Nothing counts laps yet',
    tone: 'none',
    state: 'Laps are only counted by hand',
    actions: [{ id: 'find', label: 'Find my interface', primary: true }]
  });
  assert.match(h, /<section class="hd-hero warn"/);
  assert.match(h, /<h1>Nothing counts laps yet<\/h1>/);
  assert.match(h, /data-hd-act="find"/);
  const T = { hits: [3, 0], last: [9500, null], lap: [5214, null] };
  const lanes = D.laneCardsHtml(T, { now: 10000, sensors: [0, 2] });
  assert.match(lanes, /<b>Lane 1<\/b><span class="hd-led hit"/);
  assert.match(lanes, /<div class="t">5\.214<\/div><small>last lap · just now<\/small><div class="sensor">sensor A · 3 crossings<\/div>/);
  assert.match(lanes, /sensor C · 0 crossings/);
});

test('finding the lane order: one car over each lane in turn; what changes; a lane done again', () => {
  const W = D.orderStart(4, [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(D.orderHit(W, 0), true);
  assert.equal(D.orderHit(W, 2), true);
  assert.equal(D.orderHit(W, 2), false, 'a sensor already taken');
  D.orderHit(W, 1);
  let r = D.orderResult(W);
  assert.equal(r.done, false);
  D.orderHit(W, 3);
  r = D.orderResult(W);
  assert.equal(r.done, true);
  assert.deepEqual(r.map.slice(0, 4), [0, 2, 1, 3], 'sensor B is lane 3, sensor C is lane 2');
  assert.equal(new Set(r.map).size, 8, 'every lane once');
  assert.deepEqual(r.changes.map(D.changeText), [
    'Lane 2 is sensor C. It was set to sensor B.',
    'Lane 3 is sensor B. It was set to sensor C.'
  ]);
  D.orderRedo(W, 1);
  assert.deepEqual([W.step, W.sensors], [1, [0]]);
  assert.match(D.orderStepsHtml(W), /class="hd-step done"[^]*sensor A[^]*class="hd-step now"/);
});

test('forgotten devices, and the page: the desk in App Settings, section tabs, Diagnostics, DS serial remembered, retired drivers', () => {
  assert.match(D.forgottenHtml([]), /No forgotten devices/);
  assert.match(
    D.forgottenHtml(['2341:0043'], () => 'Arduino Uno'),
    /<b>Arduino Uno<\/b><small>USB 2341:0043[^]*data-hd-unforget="2341:0043">Ask again/
  );
  const app = code('renderer/app.js'),
    view = code('renderer/hwdeskview.js'),
    rail = code('renderer/generalpage.js'),
    ds = code('renderer/dsui.js');
  assert(has(app, 'return renderTimingDesk(box);'));
  assert(!app.includes("['other', 'Other']") && !app.includes('id="hw-use"'), 'no dropdown, no Other page');
  assert(
    has(view, 'if ((await setTimingHw(id)) === false) return;') && has(view, 'await DESK_CONNECT[id]();'),
    'Connect & use: in use, then connect'
  );
  assert(
    has(
      view,
      'state.settings = await api.setSettings({ hwIgnored: (state.settings.hwIgnored || []).filter(k => k !== b.dataset.hdUnforget) });'
    )
  );
  assert(has(view, 'state.settings = await api.setSettings({ [dev.map]: r.map });'), 'the lane order is saved as the lane map');
  assert(has(rail, "secTabs: '#hwhero',") && has(rail, "bar.className = 'sr-sectabs';"), 'the sections of an interface as tabs');
  assert(has(rail, 'dev.diag.includes(id)'), 'Diagnostics sections only when switched on');
  assert(has(ds, 'api.setSettings({ dsSerial: dsc.cfg })') && has(ds, 'state.settings.dsSerial'), 'the DS serial settings are remembered');
  const html = code('renderer/index.html');
  assert(html.includes('hwdesk.js') && html.includes('hwdeskview.js'));
});
