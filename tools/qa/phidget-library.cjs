// Optional official SDK smoke test. Does not install a driver or open real devices.
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createInterface } = require('node:readline');
const dll = process.argv[2];
if (!dll || !path.isAbsolute(dll)) throw Error('Supply an absolute path to the official x64 phidget22.dll.');
const child = spawn(path.join(__dirname, '../../native/phidget/SlotForgePhidget.exe'), ['--library', dll], { windowsHide: true });
const pending = new Map(); let serial = 0;
createInterface({ input: child.stdout }).on('line', line => {
  const p = JSON.parse(line), w = pending.get(p.id);
  if (w) { pending.delete(p.id); clearTimeout(w.timer); w.resolve(p); }
});
child.stderr.on('data', d => process.stderr.write(d));
function command(cmd, data = {}) {
  return new Promise((resolve, reject) => {
    const id = ++serial, timer = setTimeout(() => reject(Error('Library smoke test timed out')), 7000);
    pending.set(id, { resolve, timer });
    child.stdin.write(JSON.stringify({ id, cmd, ...data }) + '\n');
  });
}
(async () => {
  try {
    const scan = await command('scan'); assert.equal(scan.type, 'reply'); assert(Array.isArray(scan.devices));
    console.log('Official x64 library loaded; native manager scan returned ' + scan.devices.length + ' channels.');
    for (const type of ['digital', 'voltage', 'ratio', 'output']) {
      const address = { serial: 2147483647, channel: 0, type, hubPort: -1, hubDevice: false };
      const reply = await command('open', { channels: [{ key: type, address, off: 0, initial: 0 }] });
      assert.equal(reply.type, 'error'); assert.match(reply.message, /timeout|timed out/i);
      console.log(type + ': native creation, local addressing, handler registration and missing-device timeout passed.');
    }
  } finally { child.stdin.end(); }
})().catch(e => { console.error(e); child.kill(); process.exitCode = 1; });
