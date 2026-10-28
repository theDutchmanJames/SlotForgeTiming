// Main-process owner of the native helper. Only semantic, validated configuration crosses the IPC boundary.
const path = require('path');
const { spawn } = require('child_process');
const { performance } = require('perf_hooks');
const P = require('./renderer/parallel');
const { isDeepStrictEqual } = require('util');
const clock = () => performance.timeOrigin + performance.now();

function createController(options = {}) {
  const root = __dirname.endsWith('app.asar') ? __dirname + '.unpacked' : __dirname;
  const helper = options.helper || path.join(root, 'native', 'parallel', 'SlotForgeParallel.exe');
  const launch = options.spawn || (() => spawn(helper, [], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }));
  const notify = options.onEvent || (() => {}), platform = options.platform || process.platform;
  let child = null, config = null, connected = false, busy = false, offset = 0, sequence = 0, heartbeat = null, arm = false, race = false, testTimer = null, stderr = '', lineBuffer = '', generation = 0, lastSample = null;
  let wants = {}, testPin = null, error = '', request = 0, raceLease = 0, cancellation = 0, leaseActive = false, aliveAt = clock(); const waiters = new Set();
  const state = () => ({ platform, connected, race, armed: arm, testPin, error, config, clockUncertainty: uncertainty, lastSample });
  let uncertainty = null;
  const announce = () => notify({ type: 'state', ...state() });
  const send = text => { if (!child || child.killed || child.stdin.destroyed || !child.stdin.writable) throw Error('The parallel-port helper is not running.'); child.stdin.write(text + '\n'); };
  const waiting = (type, id, timeout = 4000) => new Promise((resolve, reject) => {
    const entry = { type, id, resolve, reject, timer: null };
    entry.timer = setTimeout(() => { waiters.delete(entry); reject(Error('The parallel-port helper did not answer.')); }, timeout); waiters.add(entry);
  });
  function rejectAll(message) { for (const w of waiters) { clearTimeout(w.timer); w.reject(Error(message)); } waiters.clear(); }
  async function ask(type, id, command) {
    const reply = waiting(type, id);
    try { send(command); } catch (x) { rejectAll(x.message); }
    return reply;
  }
  function clearTimers() { clearInterval(heartbeat); heartbeat = null; clearTimeout(testTimer); testTimer = null; arm = false; testPin = null; }
  function terminate(message) {
    error = message; connected = false; leaseActive = false; ++generation; clearTimers(); rejectAll(message);
    const proc = child; child = null;
    if (proc) { try { proc.stdin.end('STOP\n'); } catch { /* EOF also switches assigned outputs off */ } const kill = setTimeout(() => proc.kill(), 700); if (kill.unref) kill.unref(); }
    announce();
  }
  function packet(p) {
    if (!p || typeof p.type !== 'string') throw Error('Malformed parallel-port helper response.');
    if (p.type === 'error') { terminate(String(p.message || 'Parallel-port helper failed.')); return; }
    if (p.type === 'hello' && (p.protocol !== 1 || (p.simulation === true && !options.allowSimulation))) throw Error('Unsupported parallel-port helper.');
    for (const w of waiters) if (p.type === w.type && (w.id === undefined || p.id === w.id)) { clearTimeout(w.timer); waiters.delete(w); w.resolve(p); }
    if (p.type === 'sample') {
      if (!connected) return;
      if (!Number.isInteger(p.seq) || p.seq !== sequence + 1 || !Number.isFinite(p.at) || !Number.isInteger(p.status) || p.status < 0 || p.status > 255 || !Number.isInteger(p.control) || p.control < 0 || p.control > 255 || !Number.isFinite(p.gap) || p.gap < 0 || (lastSample && p.at < lastSample.at)) throw Error('The timing stream lost a sample or contained invalid data. Reconnect before racing.');
      sequence = p.seq; lastSample = p; notify({ ...p, at: p.at + offset });
    }
  }
  async function start() {
    if (platform !== 'win32') throw Error('Parallel-port access is available in the Windows desktop app.');
    error = ''; lineBuffer = stderr = ''; lastSample = null; sequence = 0; const gen = ++generation;
    const hello = waiting('hello');
    try { child = launch(); } catch (x) { rejectAll(x.message); await hello; return; }
    child.stdout.on('data', bytes => {
      if (gen !== generation || !child) return;
      lineBuffer += bytes.toString('utf8');
      try {
        if (lineBuffer.length > 1024 * 1024) throw Error('Parallel-port helper buffer overflow.');
        let end; while ((end = lineBuffer.indexOf('\n')) >= 0) { const line = lineBuffer.slice(0, end).trim(); lineBuffer = lineBuffer.slice(end + 1); if (line) packet(JSON.parse(line)); }
      } catch (x) { terminate(x.message); }
    });
    child.stderr.on('data', bytes => { stderr = (stderr + bytes.toString()).slice(-1500); });
    child.stdin.on('error', x => { if (gen === generation && child) terminate('Parallel-port helper input failed: ' + x.message); });
    child.once('error', x => { if (gen === generation && child) terminate('Cannot run the Windows parallel-port helper: ' + x.message); });
    child.once('exit', code => { if (gen === generation && child) terminate(error || 'Parallel-port helper stopped (' + code + '). ' + stderr); });
    await hello;
  }
  async function stop() {
    ++generation; connected = false; leaseActive = false; clearTimers(); wants = {}; const proc = child; child = null; rejectAll('Parallel-port connection closed.');
    if (proc) {
      await new Promise(resolve => {
        let done = false; const finish = () => { if (done) return; done = true; clearTimeout(timer); resolve(); };
        const timer = setTimeout(() => { proc.kill(); finish(); }, 900); proc.once('exit', finish);
        try { proc.stdin.end('STOP\n'); } catch { finish(); }
      });
    }
    lastSample = null; announce(); return state();
  }
  async function exclusive(fn) { if (busy) throw Error('A parallel-port connection operation is already in progress.'); busy = true; try { return await fn(); } catch (x) { await stop(); error = x.message; announce(); throw x; } finally { busy = false; } }
  function validate(value, connectionOnly = false) { const c = P.config(value), errors = P.validate(c).filter(x => !connectionOnly || x.section === 'connection'); if (errors.length) throw Error(errors[0].text); return c; }
  async function check(value) { if (race) throw Error('The race owns the parallel port.'); const c = validate(value, true); if (connected && P.addressOf(c) !== P.addressOf(config)) throw Error('Disconnect before checking a different port address.'); return exclusive(async () => { if (connected) return { ...state(), accessible: true, readable: true, message: 'Driver accessible. Verify actual sensor changes in the live monitor.' }; await start(); const result = await ask('checked', undefined, 'CHECK ' + P.addressOf(c)); await stop(); return { accessible: true, readable: true, ...result, message: 'Driver accessible; address read completed. Verify the actual sensors in the live monitor.' }; }); }
  async function open(value) {
    if (connected) throw Error(race ? 'The race owns the parallel port.' : 'Disconnect before opening the parallel port again.');
    const c = validate(value);
    if (race && !isDeepStrictEqual(c, config)) throw Error('Reconnect with the race’s saved parallel-port configuration, or leave the race first.');
    return exclusive(async () => {
    const operation = cancellation; await stop(); if (operation !== cancellation) throw Error('Parallel-port connection cancelled.'); config = c; await start();
    let best = Infinity;
    for (let i = 0; i < 7; i++) { const id = ++request, before = clock(); const p = await ask('clock', id, 'Q ' + id), after = clock(); if (!Number.isFinite(p.at)) throw Error('Invalid helper clock.'); const rtt = after - before; if (rtt < best) { best = rtt; offset = (before + after) / 2 - p.at; } }
    uncertainty = best / 2;
    if (operation !== cancellation) throw Error('Parallel-port connection cancelled.');
    const w = P.wiring(c); connected = true; await ask('started', undefined, `START ${P.addressOf(c)} ${c.poll} ${w.dataMask} ${w.controlMask} ${w.dataOff} ${w.controlOff}`);
    aliveAt = clock();
    heartbeat = setInterval(() => { try { if (clock() - aliveAt > 3000) throw Error('Main window stopped responding; parallel-port outputs released.'); send('P'); } catch (x) { terminate(x.message); } }, 400); if (heartbeat.unref) heartbeat.unref();
    error = ''; announce(); return state();
  }); }
  function write() { if (!connected || !config) throw Error('Connect the parallel port first.'); const out = P.outputBytes(config, wants); try { send(`O ${out.data} ${out.control}`); } catch (x) { terminate(x.message); throw x; } }
  function outputs(value, lease) {
    if (!race || !leaseActive || lease !== raceLease) throw Error('This race no longer owns the parallel-port outputs.');
    const roles = P.outputRoles(config.lanes).map(r => r[0]);
    if (!value || typeof value !== 'object' || Object.keys(value).some(k => !roles.includes(k) || typeof value[k] !== 'boolean')) throw Error('Invalid parallel-port output request.');
    wants = { ...value }; write(); return state();
  }
  function armTests(on) { if (race) throw Error('Output tests are unavailable during a race.'); if (on && !connected) throw Error('Connect first.'); clearTimeout(testTimer); arm = on === true; wants = {}; testPin = null; if (connected) write(); announce(); return state(); }
  function test(pin, on) {
    if (!arm || race || !connected || !config.outputsOn) throw Error('Enable output tests while no race is open.');
    const a = P.assignments(config).find(a => a.kind === 'out' && a.pin === pin); if (!a) throw Error('This pin has no assigned output.');
    clearTimeout(testTimer); wants = on ? { [a.role]: true } : {}; testPin = on ? pin : null; write();
    if (on) testTimer = setTimeout(() => { wants = {}; testPin = null; if (connected) { try { write(); announce(); } catch (x) { terminate(x.message); } } }, 1500);
    return { ...state(), testPin };
  }
  function setRace(on, lanes, lease) {
    if (typeof on !== 'boolean') throw Error('Invalid race ownership request.');
    if (!on) {
      if (!race || lease !== raceLease) return state();
      race = false; leaseActive = false; clearTimeout(testTimer); arm = false; testPin = null; wants = {};
      if (connected) write(); announce(); return state();
    }
    if (!connected || !Number.isInteger(lanes) || lanes < 1 || lanes > config.lanes) throw Error('The connected parallel port does not cover all lanes of this race.');
    if (race && (leaseActive || lease !== raceLease)) throw Error('Parallel-port race ownership is already held.');
    clearTimeout(testTimer); arm = false; testPin = null; wants = {};
    try { write(); } catch (x) { terminate(x.message); throw x; }
    race = true; leaseActive = true; raceLease++; announce(); return { ...state(), lease: raceLease };
  }
  return { state, check, open, close: () => { if (race) return Promise.reject(Error('The race owns the parallel port.')); cancellation++; return busy ? stop() : exclusive(stop); }, shutdown: () => { cancellation++; race = false; return stop(); }, alive: () => { aliveAt = clock(); return connected; }, outputs, armTests, test, setRace };
}
module.exports = { createController };
