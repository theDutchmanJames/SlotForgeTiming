const fs = require('fs'), vm = require('vm'), assert = require('assert/strict'), P = require('../renderer/parallel'), H = require('../renderer/hardware');
function fixture(settings = {}) {
  let receive, opens = 0, closes = 0, failing = false;
  const link = P.createLink(), state = { settings: { timingHw: 'parallel', ...settings } };
  const api = { onParallel: f => { receive = f; }, parallelOpen: async c => { opens++; if (failing) throw Error('Driver unavailable'); receive({ type: 'sample', seq: 1, at: 100100, status: 128, control: 11, gap: 1 }); return { connected: true, config: c, clockUncertainty: 0.01 }; }, parallelClose: async () => { closes++; await new Promise(r => setImmediate(r)); receive({ type: 'state', connected: false }); } };
  const context = vm.createContext({ ParallelPort: { ...P, link }, Hardware: H, state, api, performance: { now: () => 100, timeOrigin: 100000 }, console });
  vm.runInContext(fs.readFileSync(require('path').join(__dirname, '../renderer/parallelclient.js'), 'utf8'), context);
  return { run: code => vm.runInContext(code, context), state, link, emit: e => receive(e), opens: () => opens, closes: () => closes, fail: () => { failing = true; } };
}
(async () => {
  const f = fixture(); await f.run('ppConnect()'); assert(f.link.connected); assert.equal(f.link.samples, 1);
  f.emit({ type: 'sample', seq: 2, at: 100200, status: 192, control: 11, gap: 1.2 }); assert.equal(f.link.total, 1); assert.equal(f.link.lastAt, 200);
  f.emit({ type: 'state', connected: true, race: true }); f.emit({ type: 'sample', seq: 3, at: 100300, status: 192, control: 11, gap: 1.3 }); assert.equal(f.link.total, 1);
  const a = f.run('ppClose()'), b = f.run('ppClose()'); await Promise.all([a, b]); assert.equal(f.closes(), 1); assert(!f.link.connected);
  console.log('ok  initial samples are buffered, timestamp origins converted, state updates do not reset sensors, close is coalesced');
  f.fail(); await assert.rejects(f.run('ppConnect()'), /Driver unavailable/); assert(!f.link.connected); assert.equal(f.run('pp.busy'), false); assert.equal(f.run('pp.opening'), false);
  console.log('ok  failed driver access leaves a recoverable disconnected client');
  const off = fixture({ parallelPort: { ...P.defaults(), autoConnect: true }, timingHw: 'trackmate' }); assert.equal(await off.run('ppAutoConnect()'), false); assert.equal(off.opens(), 0);
  const manual = fixture(); assert.equal(await manual.run('ppAutoConnect()'), false); assert.equal(manual.opens(), 0);
  const on = fixture({ parallelPort: { ...P.defaults(), autoConnect: true } }); assert.equal(await on.run('ppAutoConnect()'), true); assert.equal(on.opens(), 1); await on.run('ppAutoConnect()'); assert.equal(on.opens(), 1);
  console.log('ok  startup connects only when explicitly enabled and selected, never twice');
})().catch(x => { console.error(x); process.exitCode = 1; });
