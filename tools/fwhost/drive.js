// Drives the firmware host (host.cpp) from JavaScript: builds a script, runs the box, and feeds the bytes it sent, with their arrival times, through the app's own parser
// (renderer/arduinobox.js, which needs renderer/hardware.js and renderer/trackmate.js next to it: this folder is meant to live in the app as tools/fwhost/).
const { spawnSync } = require('child_process'), path = require('path'), fs = require('fs'), os = require('os');
const RENDERER = process.env.SFB_RENDERER || path.join(__dirname, '..', '..', 'renderer');
const FIRMWARE = process.env.SFB_FIRMWARE || path.join(__dirname, '..', '..', 'firmware', 'SlotForgeBox');
const AB = require(path.join(RENDERER, 'arduinobox.js'));
const hex = s => Buffer.from(s, 'latin1').toString('hex');

class Scen { // a script for the box; times in microseconds
  constructor() { this.lines = []; }
  adc(t, pin, v) { this.lines.push(`adc ${Math.round(t)} ${pin} ${v}`); return this; }
  rx(t, s) { this.lines.push(`rx ${Math.round(t)} ${hex(s)}`); return this; }          // the PC sends s
  btn(t, p) { this.lines.push(`btn ${Math.round(t)} ${p}`); return this; }             // 2 = Start/Pause, 3 = Track call
  end(t) { this.lines.push(`end ${Math.round(t)}`); return this; }
  pass(t, pin, durUs, base = 800, low = 200) { return this.adc(t, pin, low).adc(t + durUs, pin, base); } // a car over a sensor for durUs
  text() { return this.lines.join('\n') + '\n'; }
}

// compiles the host for a board ('nano' | 'mega') once per run; returns the path of the program, or null when there is no g++
function build(board, outDir) {
  const gpp = spawnSync('g++', ['--version']); if (gpp.error || gpp.status !== 0) return null;
  fs.mkdirSync(outDir, { recursive: true });
  const exe = path.join(outDir, 'host_' + board + (process.platform === 'win32' ? '.exe' : ''));
  const args = ['-std=gnu++11', '-O1', '-w', `-DINO_PATH="${path.join(FIRMWARE, 'SlotForgeBox.ino').replace(/\\/g, '/')}"`].concat(board === 'mega' ? ['-D__AVR_ATmega2560__'] : [], ['-I', path.join(__dirname, 'shim'), '-I', FIRMWARE, '-o', exe, path.join(__dirname, 'host.cpp')]);
  const r = spawnSync('g++', args, { encoding: 'utf8' }); if (r.status !== 0) throw new Error('the firmware did not compile:\n' + r.stderr);
  return exe;
}
function runBox(exe, scen, eepromIn, eepromOut) {
  const args = []; if (eepromIn || eepromOut) args.push(eepromIn || path.join(os.tmpdir(), 'sfb-no-such-eeprom')); if (eepromOut) args.push(eepromOut);
  const r = spawnSync(exe, args, { input: scen.text(), maxBuffer: 1 << 29, encoding: 'utf8' });
  if (r.status !== 0) throw new Error('the host failed: ' + r.status + ' ' + r.stderr);
  const out = { tx: [], pins: [], strips: [], tones: [] };
  r.stdout.split('\n').forEach(l => { const p = l.split(' '); if (p[0] === 'tx') out.tx.push([Number(p[1]), Number(p[2])]); else if (p[0] === 'pin') out.pins.push({ t: Number(p[1]), pin: Number(p[2]), what: p[3], v: Number(p[4]) }); else if (p[0] === 'strip') out.strips.push({ t: Number(p[1]), px: p.slice(2) }); else if (p[0] === 'tone') out.tones.push({ t: Number(p[1]), f: Number(p[2]), d: Number(p[3]) }); });
  return out;
}
// the bytes of a run through a fresh ArduinoBox link; jitterMs = the USB delay (up to this much per read, order kept)
function throughLink(out, { jitterMs = 12, seed = 1 } = {}) {
  let clock = 0, s = seed; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const link = AB.createLink({ now: () => clock }); link.setConnected(true); const events = [], msgs = []; let lastArr = 0;
  link.on(e => events.push({ ...e, pcNow: clock }));
  for (let i = 0; i < out.tx.length;) {
    let j = i; while (j + 1 < out.tx.length && out.tx[j + 1][0] - out.tx[i][0] < 2000) j++; // bytes within 2 ms arrive in one read
    clock = lastArr = Math.max(lastArr, out.tx[j][0] / 1000 + 1 + rnd() * jitterMs);
    link.feed(out.tx.slice(i, j + 1).map(x => x[1])).forEach(m => msgs.push({ ...m, arr: clock })); i = j + 1;
  }
  return { link, events, msgs };
}
module.exports = { Scen, build, runBox, throughLink, AB, FIRMWARE, RENDERER, os, path, fs };
