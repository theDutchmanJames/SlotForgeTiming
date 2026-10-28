const assert = require('assert/strict'), E = require('../renderer/engine'), PS = require('../renderer/pitsensors'), TM = require('../renderer/trackmate'), PP = require('../renderer/parallel'), AB = require('../renderer/arduinobox'), AR = require('../renderer/arduinorace'), PR = require('../renderer/parallelrace');
const mk = () => { const r = E.createRace({ type: 'race', laps: 50, entries: [{ lane: 0 }, { lane: 1 }], fuel: { pitHold: 1000 }, pitControl: { mode: 'auto', seconds: 3, waitReturn: true } }); r.start(0); return r; };
let groups = 0;
const test = async (name, fn) => { await fn(); groups++; console.log('ok   ' + name); };
const tick = () => new Promise(r => setImmediate(r));
(async () => {
  await test('real Trackmate parser keeps raw hits live while engine holds one stop and one arrival lap', () => {
    let at = 0; const link = TM.createLink({ now: () => at }), r = mk(); link.setConnected(true); link.setHold(1000);
    const sensor = PS.bind({ eng: () => r, now: () => at, hardware: 'trackmate', link, map: () => [0, 1, 2, 3, 4, 5, 6, 7] }); sensor.sync();
    link.on(e => { if (e.type === 'hit') r.cross(e.lane, e.at); if (e.type === 'block') r.block(e.lane, e.at, true); if (e.type === 'free') r.unblock(e.lane, e.at); });
    const feed = (ms, letters = '') => { at += ms; link.feed(Buffer.from(ms + '\n\r' + letters)); r.tick(at); };
    feed(1000, 'A'); feed(500, 'A'); feed(500, 'A'); assert.ok(r.cars[0].pitHold);
    feed(800); assert.ok(r.cars[0].pitHold); feed(3200); assert.ok(r.cars[0].pitHold);
    feed(100, 'A'); assert.equal(r.cars[0].laps.length, 1); feed(800);
    assert.equal(r.cars[0].pits.length, 1); assert.equal(link.hits, 2); sensor.off();
  });
  for (const separate of [false, true]) await test(`real Parallel Port link and race binding: ${separate ? 'separate' : 'shared'} pits, remove/return and disconnect`, async () => {
    let at = 0; const link = PP.createLink({ config: { lanes: 2, map: [10, 11], pitMode: separate ? 'separate' : 'shared', pitPins: [12, 13] } }), r = mk(); link.setConnected(true);
    const sensor = PS.bind({ eng: () => r, now: () => at, hardware: 'parallel', link }); sensor.sync();
    const binding = PR.bind({ link, pitMs: 1000, setup: {}, cars: () => r.cars, phase: () => r.status, lights: () => 0, flag: () => '', enabled: () => true,
      crossCar: (i, t) => r.cross(i, t), holdCar: (i, t) => r.block(i, t, true), blockCar: (i, t) => r.block(i, t, true), unblockCar: (i, t) => r.unblock(i, t), trackcall() {}, acquire: async () => ({ lease: 1 }), release: async () => {}, outputs: async () => {} });
    await tick();
    const feed = (time, high = []) => { at = time; let status = 0x80; for (const [pin, bit] of [[10, 6], [11, 7], [12, 5], [13, 4]]) if (high.includes(pin)) status ^= 1 << bit; link.feed({ at, status, control: 0x0b }); r.tick(at); };
    const pin = separate ? 12 : 10;
    feed(0); feed(1000, [pin]); feed(2000, [pin]); assert.ok(r.cars[0].pitHold);
    feed(2500); assert.ok(r.cars[0].pitHold); feed(5500); assert.ok(r.cars[0].pitHold);
    feed(6000, [pin]); feed(6500); assert.equal(r.cars[0].pits.length, 1); assert.equal(r.cars[0].laps.length, separate ? 0 : 1);
    feed(8000, [pin]); feed(9000, [pin]); link.setConnected(false); r.tick(20000); assert.ok(r.cars[0].pitHold); assert.equal(r.cars[0].pitSensor, null);
    binding.off(); sensor.off();
  });
  await test('parallel presence respects configured trigger filter and clear rearm duration', () => {
    const link = PP.createLink({ config: { lanes: 1, map: [10], filter: 20, rearm: 50 } }), seen = []; link.setConnected(true); link.onSensor(e => { if (e.lane === 0) seen.push(e); });
    const sample = (at, on) => link.feed({ at, status: on ? 0xc0 : 0x80, control: 0x0b });
    sample(0, false); sample(100, true); sample(110, false); sample(200, true); sample(220, true); sample(230, false); sample(260, false); sample(280, false);
    assert.deepEqual(seen.map(e => [e.on, e.at]), [[false, 0], [true, 220], [false, 280]]);
  });
  await test('Arduino pit messages and normal race binding share the hold, with lap triggers suppressed', () => {
    let at = 0; const link = AB.createLink({ now: () => at }), r = mk(); link.setConnected(true);
    const sensor = PS.bind({ eng: () => r, now: () => at, hardware: 'arduino', link }); sensor.sync();
    const binding = AR.bind({ link, setup: { boxPit: 'both' }, keepalive: false, cars: () => r.cars, phase: () => r.status, flag: () => '', lights: () => 0,
      crossCar: (i, t) => r.cross(i, t), blockCar: i => r.block(i, at), unblockCar: i => r.unblock(i, at), trackcall() {} });
    const feed = (ms, text = '') => { at += ms; link.feed(Buffer.from(ms + '\n\r' + text)); r.tick(at); };
    feed(1000, '[P1+]'); feed(1000); assert.ok(r.cars[0].pitHold); feed(500, '[P1-]'); assert.ok(r.cars[0].pitHold);
    feed(3000, '[P1+]A'); feed(500, '[P1-]'); assert.equal(r.cars[0].pits.length, 1); assert.equal(r.cars[0].laps.length, 1);
    binding.off(); sensor.off();
  });
  await test('authenticated release commands validate lane bounds and require director password', async () => {
    const { createServer } = require('../server'), http = require('http'), path = require('path'), commands = [];
    const srv = createServer({ root: path.join(__dirname, '../renderer'), appRoot: path.join(__dirname, '..'), schema: {}, getSettings: () => ({ netPassword: 'pit-test' }), list: () => [], customFields: () => [], getLive: () => ({}), onCommand: c => commands.push(c), failDelay: 1 });
    const port = await srv.listen(0, '127.0.0.1');
    const post = (url, data) => new Promise((resolve, reject) => { const req = http.request({ host: '127.0.0.1', port, path: url, method: 'POST', headers: { 'Content-Type': 'application/json' } }, res => { let text = ''; res.on('data', x => text += x); res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(text) })); }); req.on('error', reject); req.end(JSON.stringify(data)); });
    try {
      assert.equal((await post('/api/command', { cmd: { type: 'pitrelease', lane: 0 } })).status, 401);
      const token = (await post('/api/auth', { password: 'pit-test' })).body.token;
      for (const type of ['pitrelease', 'pitreleaseearly']) { assert.equal((await post('/api/command', { token, cmd: { type, lane: 0 } })).status, 200); for (const lane of [-1, 16, 0.5, '0', null]) assert.equal((await post('/api/command', { token, cmd: { type, lane } })).status, 400); }
      assert.equal(commands.length, 2);
    } finally { await srv.close(); }
  });
  console.log(`PIT SENSOR TESTS PASSED (${groups} groups)`);
})().catch(e => { console.error(e); process.exit(1); });
