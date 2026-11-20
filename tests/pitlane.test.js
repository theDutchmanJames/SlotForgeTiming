'use strict';
// 2.4.0: App Settings › Connections › Paddock as the Paddock Pit Lane (renderer/pitlane.js, pitlaneview.js, paddock-keep.js, SlotForgeRestyle.md "Paddock Pit
// Lane"): one page for the shared library, the Dealership and the results; a headline that says how things stand; Fix it; results in plain words;
// Dealerships found on the network as cards; the connection check step by step; the password remembered (encrypted) and reconnecting by itself.
const test = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const P = require('../renderer/pitlane.js');
const { PaddockKeep, reconnect } = require('../paddock-keep.js');
const { code, has } = require('./source.cjs');

const D = '6583e8e1-d09e-459b-a2b3-6a321f4397b0';
const sent = (id, transport = 'engine', at = '2026-11-18T20:54:50.441Z') => ({
  sessionId: id,
  name: 'Check race',
  status: 'sent',
  transport,
  receivedAt: at,
  receiptCheckedAt: at
});
const sessions = [
  { id: 's1', setupName: 'Club night', trackName: 'Club Oval', date: '2026-11-20T20:36:00Z' },
  { id: 's2', setupName: 'Club night', trackName: 'Club Oval', date: '2026-11-20T21:10:00Z' },
  { id: 's3', setupName: 'Club night', trackName: 'Club Oval', date: '2026-11-20T21:42:00Z' },
  { id: 's4', setupName: 'Time Tokens', date: '2026-11-18T19:00:00Z' }
];

test('the reasons in plain words', () => {
  assert.equal(
    P.reason('A lap lacks its captured driver boundary.'),
    'A lap has no driver change recorded, so Paddock cannot share this race.'
  );
  assert.equal(
    P.reason("Error invoking remote method 'paddock:connect': Error: connect ECONNREFUSED 192.168.1.20:51234"),
    'The Dealership could not be reached on the network.'
  );
  assert.equal(P.reason('Wrong Dealership password.'), 'The Dealership did not accept the password.');
  assert.equal(P.reason('Something new'), 'Something new', 'an unknown reason as it is');
  assert.equal(P.reason(''), '');
});

test('the results: newest first, one row per race, the state that needs you most', () => {
  const rows = P.rows(
    [
      sent('s1', 'engine'),
      sent('s1', 'dealership'),
      { sessionId: 's2', name: 'Check race', status: 'pending', transport: 'dealership' },
      sent('s2', 'engine'),
      {
        sessionId: 's3',
        name: 'Check race',
        status: 'attention',
        transport: 'engine',
        error: 'A lap lacks its captured driver boundary.',
        neverShared: true,
        convertFailed: true
      },
      { sessionId: 's4', name: 'Time Tokens', status: 'attention', transport: 'engine', error: 'Time Token sessions are not uploaded.' }
    ],
    sessions,
    { dealershipOn: false }
  );
  assert.deepEqual(
    rows.map(r => [r.id, r.kind, r.label]),
    [
      ['s3', 'att', 'NEEDS A LOOK'],
      ['s2', 'wait', 'WAITING'],
      ['s1', 'ok', 'DELIVERED'],
      ['s4', 'stay', 'STAYS HERE']
    ]
  );
  assert.equal(rows[0].name, 'Club night · Club Oval');
  assert.match(rows[0].why, /no driver change recorded/);
  assert.equal(rows[0].removable, true, 'a race never shared can be left out');
  assert.equal(rows[0].canSend, true, 'a race that could not be converted can be tried again');
  assert.match(rows[1].why, /Dealership \(it is offline\)/);
  assert.equal(rows[2].why, 'Sent to the shared library and the Dealership');
  assert.match(rows[0].when, /^20 Nov · \d\d:42$/);
});

test('the headline and Fix it: what is wrong, and the steps that put it right in order', () => {
  const status = {
    connection: { address: 'http://192.168.1.20:51234', databaseId: D, name: 'CLUB-PC' },
    connected: false,
    hasCode: false,
    deliveries: [
      { sessionId: 's2', status: 'pending', transport: 'dealership' },
      { sessionId: 's3', status: 'attention', transport: 'engine', error: 'A lap lacks its captured driver boundary.' },
      sent('s1')
    ]
  };
  const S = P.summary({ status, library: { available: true }, sessions, cars: 48, remembered: true });
  assert.equal(S.tone, 'fix');
  assert.equal(S.headline, '2 results need you');
  assert.match(S.line, /^One race cannot be shared until you look at it, one is waiting to be sent, the Dealership CLUB-PC is offline\./);
  assert.deepEqual(
    S.fix.map(f => f.act),
    ['reconnect', 'send', 'open']
  );
  assert.deepEqual(
    S.pills.map(p => p.text),
    ['THIS COMPUTER · ON', 'DEALERSHIP · OFFLINE']
  );
  assert.equal(S.cards.dealer.state, 'OFFLINE · CLUB-PC 192.168.1.20');
  assert.deepEqual([S.counts.all, S.counts.open, S.counts.sent], [3, 2, 1]);

  const ok = P.summary({
    status: { connection: status.connection, connected: true, hasCode: true, deliveries: [sent('s1')] },
    library: { available: true },
    sessions,
    cars: 48,
    remembered: true
  });
  assert.equal(ok.tone, 'ok');
  assert.equal(ok.headline, 'All results are in Paddock');
  assert.match(ok.line, /^48 cars from Paddock are ready to race\. Every finished race has been delivered/);
  assert.equal(ok.cards.dealer.line, 'Password remembered on this computer. Reconnects by itself.');
  assert.deepEqual(ok.fix, []);

  const off = P.summary({ status: { connection: null, deliveries: [] }, library: { available: false }, sessions: [] });
  assert.equal(off.tone, 'off');
  assert.equal(off.headline, 'Paddock is not connected');
});

test('the connection check, step by step', () => {
  const st = e => P.connectSteps({ name: 'CLUB-PC', error: e }).map(s => s.state);
  assert.deepEqual(st('connect ECONNREFUSED'), ['bad', 'todo', 'todo']);
  assert.deepEqual(st('UNAUTHENTICATED'), ['ok', 'bad', 'todo']);
  assert.deepEqual(st('This is a different Paddock database.'), ['ok', 'ok', 'bad']);
  assert.deepEqual(
    P.connectSteps({ name: 'CLUB-PC', ok: true }).map(s => s.text),
    ['Found CLUB-PC on the network', 'Password accepted', 'It is the same Paddock database']
  );
  assert.equal(P.connectSteps({ busy: true })[0].state, 'busy');
});

test('the Dealerships found: one card per Paddock, on its home-network address', () => {
  const H = P.hosts([
    { id: D, name: 'CLUB-PC', address: 'http://172.21.208.1:51234' },
    { id: D, name: 'CLUB-PC', address: 'http://192.168.1.13:51234' },
    { id: D, name: 'CLUB-PC', address: 'http://127.0.0.1:51234' },
    { id: 'other', name: 'GARAGE', address: 'http://10.0.0.4:50410' }
  ]);
  assert.deepEqual(
    H.map(h => h.address),
    ['http://192.168.1.13:51234', 'http://10.0.0.4:50410']
  );
});

// the remembered password: encrypted (a stand-in for Windows encryption here), for one Paddock database
const fakeCrypt = (available = true) => ({
  available: () => available,
  encrypt: t => Buffer.from('ENC:' + Buffer.from(t).toString('base64')),
  decrypt: b => Buffer.from(String(b).slice(4), 'base64').toString()
});
const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sf-keep-')), 'paddock-dealership.json');

test('the password remembered on this computer: kept encrypted, for its own Paddock only', () => {
  const file = tmp(),
    k = new PaddockKeep(file, fakeCrypt());
  assert.equal(k.remember({ databaseId: D, name: 'CLUB-PC' }, 'club night 7'), true);
  assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /club night 7/, 'never written as it is');
  assert.equal(k.code(D), 'club night 7');
  assert.equal(k.code('another'), '', 'not for another Paddock database');
  assert.equal(k.has(D), true);
  k.forget();
  assert.equal(k.has(), false);
  const no = new PaddockKeep(tmp(), fakeCrypt(false));
  assert.equal(no.remember({ databaseId: D }, 'pw12'), false, 'without Windows encryption nothing is written');
  assert.equal(no.has(), false);
});

// a stand-in Paddock: connect works on one address with one password
function fakePaddock(o) {
  const p = {
    connection: { address: o.saved, databaseId: D, name: 'CLUB-PC' },
    connected: !!o.connected,
    code: o.connected ? 'pw12' : '',
    calls: [],
    async status() {
      return { connection: this.connection, connected: this.connected, hasCode: !!this.code };
    },
    async ping() {
      this.connected = o.alive !== false;
      return this.connected;
    },
    async connect({ address, code }) {
      this.calls.push(address);
      if (address !== o.live) throw Object.assign(Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
      if (code !== o.password) throw Object.assign(Error('Wrong Dealership password.'), { code: 'UNAUTHENTICATED' });
      this.connection = { ...this.connection, address };
      this.connected = true;
      this.code = code;
    }
  };
  return p;
}

test('reconnecting by itself: the saved address, then the Dealership found again on its new port', async () => {
  const k = new PaddockKeep(tmp(), fakeCrypt());
  k.remember({ databaseId: D }, 'pw12');
  const found = async () => [
    { id: D, name: 'CLUB-PC', address: 'http://172.21.208.1:51300' },
    { id: D, name: 'CLUB-PC', address: 'http://192.168.1.13:51300' }
  ];
  const same = fakePaddock({ saved: 'http://192.168.1.13:51234', live: 'http://192.168.1.13:51234', password: 'pw12' });
  assert.deepEqual(await reconnect(same, k, found), { tried: true, ok: true, how: 'saved' });
  const moved = fakePaddock({ saved: 'http://192.168.1.13:51234', live: 'http://192.168.1.13:51300', password: 'pw12' });
  const r = await reconnect(moved, k, found);
  assert.equal(r.how, 'found');
  assert.equal(moved.connection.address, 'http://192.168.1.13:51300', 'the home-network address');
  const alive = fakePaddock({ saved: 'x', live: 'x', password: 'pw12', connected: true });
  assert.equal((await reconnect(alive, k, found)).reason, 'connected');
  const gone = fakePaddock({
    saved: 'http://192.168.1.13:51234',
    live: 'http://192.168.1.13:51300',
    password: 'pw12',
    connected: true,
    alive: false
  });
  assert.equal((await reconnect(gone, k, found)).how, 'found', 'connected but gone: found again');
  const wrong = fakePaddock({ saved: 'http://192.168.1.13:51234', live: 'http://192.168.1.13:51234', password: 'changed' });
  assert.equal((await reconnect(wrong, k, found)).reason, 'password');
  assert.equal(k.has(), false, 'a password that no longer works is forgotten');
  assert.equal((await reconnect(fakePaddock({ saved: 'a', live: 'a', password: 'pw12' }), k, found)).reason, 'no-password');
});

test('the page is wired: one Paddock tab, Fix it, the remembered password, the menu light', () => {
  const app = code('renderer/app.js'),
    view = code('renderer/pitlaneview.js'),
    main = code('main.js');
  assert(has(app, "['paddock', 'Paddock']"));
  assert(has(app, "if (['dealership', 'library'].includes(connectionsTab)) connectionsTab = 'paddock';"));
  assert(has(app, "return typeof renderPitLane === 'function' ? renderPitLane(body) : PaddockUI.mount(api, body);"));
  assert(has(view, 'data-pl="fix"'));
  assert(has(view, 'PaddockUI.mount(api, host)'), 'the full tools of before, under Older connections and repair');
  assert(has(view, 'homeLibraryWaiting = S.counts.open;'));
  assert(has(main, "ipcMain.handle('paddock:keep'"));
  assert(has(main, 'safeStorage.encryptString(text)'));
  assert(has(code('preload.js'), "paddockKeep: action => call('paddock:keep', action),"));
  assert(has(code('renderer/mainbar.js'), "connectionsTab = 'paddock';"));
  assert(has(code('paddock.js'), 'async ping() {'));
});
