// The real compiled helper runs with in-memory ports. These checks never open a hardware driver.
const assert = require('assert/strict'), path = require('path'), fs = require('fs'), { spawn } = require('child_process');
const { createController } = require('../parallelport'), P = require('../renderer/parallel');
const wait = ms => new Promise(r => setTimeout(r, ms));
const binary = path.join(__dirname, '../native/parallel/SlotForgeParallel.exe');
assert(fs.existsSync(binary), 'The native helper must be included in the release.');
// Run the actual IPC registration block with stand-ins: native access stays in the main top-level window.
{
  const main = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8'), start = main.indexOf('  const parallelOwner ='), end = main.indexOf('  // the race save', start), handlers = {}, called = [];
  const frame = {}, contents = { mainFrame: frame }, mainWin = { webContents: contents, isDestroyed: () => false }, owner = { sender: contents, senderFrame: frame };
  const methods = ['state', 'check', 'open', 'close', 'armTests', 'test', 'setRace', 'outputs'], port = Object.fromEntries(methods.map(name => [name, (...args) => { called.push([name, ...args]); return {}; }]));
  let choice = 'parallel'; new Function('ipcMain', 'mainWin', 'parallel', 'db', main.slice(start, end))({ handle: (name, fn) => { handlers[name] = fn; } }, mainWin, port, { getSettings: () => ({ timingHw: choice }) });
  for (const fn of Object.values(handlers)) { assert.throws(() => fn({ sender: {}, senderFrame: frame }), /main app window/); assert.throws(() => fn({ sender: contents, senderFrame: {} }), /main app window/); }
  assert.equal(called.length, 0); handlers['parallel:check'](owner, P.defaults()); assert.equal(called[0][0], 'check'); choice = 'arduino'; assert.throws(() => handlers['parallel:race'](owner, true, 4), /not the timing hardware/); assert.throws(() => handlers['parallel:outputs'](owner, {}), /not the timing hardware/);
  console.log('ok  production IPC refuses other windows, subframes and output writes for another timing source');
}
(async () => {
  const unsupported = createController({ platform: 'linux' }); await assert.rejects(unsupported.open(P.defaults()), /Windows/);
  if (process.platform !== 'win32') { console.log('ok  Windows helper packaged; execution checks require Windows'); return; }
  let proc; const events = [], launch = () => (proc = spawn(binary, ['--simulate'], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }));
  const c = createController({ spawn: launch, allowSimulation: true, onEvent: e => events.push(e) });
  try {
    const check = await c.check(P.defaults()); assert(check.accessible); assert(!c.state().connected);
    const config = P.config({ outputsOn: true, outputs: { 2: 'master', 3: 'go' }, outputSignal: { 3: 'low' } });
    const result = await c.open(config); assert(result.connected); assert(Number.isFinite(result.clockUncertainty));
    await wait(30); assert(events.some(e => e.type === 'sample')); const first = events.find(e => e.type === 'sample'); assert(Math.abs(first.at - Date.now()) < 1000);
    proc.stdin.write('S 192 11\n'); await wait(35); assert(events.some(e => e.type === 'sample' && e.status === 192));
    assert.throws(() => c.test(2, true), /Enable output tests/); c.armTests(true); c.test(2, true); assert.equal(c.state().testPin, 2); await wait(1550); assert.equal(c.state().testPin, null);
    const race = c.setRace(true, 4); assert.equal(c.state().armed, false); assert.throws(() => c.test(2, true), /Enable output tests/); await assert.rejects(c.close(), /race owns/); await assert.rejects(c.check(config), /race owns/); await assert.rejects(c.open(config), /race owns/);
    assert.throws(() => c.outputs({ master: true }, race.lease - 1), /no longer owns/); c.outputs({ master: true, go: true }, race.lease);
    c.setRace(false, 4, race.lease - 1); assert(c.state().race); c.setRace(false, 4, race.lease); assert(!c.state().race);
    await c.close(); assert(!c.state().connected);
    const opening = c.open(config), cancelled = assert.rejects(opening, /cancelled|closed/); await c.close(); await cancelled; await wait(30); assert(!c.state().connected);
    console.log('ok  native helper, clock alignment, stream, test timeout, race leases, gating, cancellation and clean close');
    await assert.rejects(c.open(P.config({ map: Array(8).fill(10) })), /assigned/);
    const wrong = createController({ spawn: launch }); await assert.rejects(wrong.open(P.defaults()), /Unsupported/); await wrong.shutdown();
    console.log('ok  invalid configuration and accidental simulation are refused');
    await c.open(P.defaults()); proc.stdin.write('NOT-A-COMMAND\n'); await wait(80); assert(!c.state().connected); assert.match(c.state().error, /Unknown helper command/);
    console.log('ok  native protocol failure disconnects rather than continuing with missing timing data');
  } finally { await c.shutdown(); }
  // Explicit shutdown, masked writes and watchdog are exercised on the compiled helper directly.
  const raw = launch(), lines = []; let buffer = '';
  raw.stdout.on('data', b => { buffer += b; let i; while ((i = buffer.indexOf('\n')) >= 0) { const s = buffer.slice(0, i).trim(); buffer = buffer.slice(i + 1); if (s) lines.push(JSON.parse(s)); } });
  const until = async predicate => { for (let i = 0; i < 150 && !predicate(); i++) await wait(20); assert(predicate(), 'Native helper response timed out: ' + JSON.stringify(lines.slice(-3))); };
  try {
    await until(() => lines.some(e => e.type === 'hello')); raw.stdin.write('START 888 1 3 32 2 0\nO 1 0\nSNAP\n'); await until(() => lines.some(e => e.type === 'snapshot')); assert.equal(lines.find(e => e.type === 'snapshot').data, 1);
    raw.stdin.write('STOP\nSNAP\n'); await until(() => lines.filter(e => e.type === 'snapshot').length === 2); assert.equal(lines.filter(e => e.type === 'snapshot')[1].data, 2);
    raw.stdin.write('START 888 1 3 32 2 0\n'); await until(() => lines.some(e => e.type === 'error')); assert.match(lines.find(e => e.type === 'error').message, /heartbeat/);
    console.log('ok  compiled helper masks output writes, returns to inactive polarity and stops on heartbeat loss');
  } finally { raw.stdin.end(); await wait(60); raw.kill(); }
})().catch(x => { console.error(x); process.exitCode = 1; });
