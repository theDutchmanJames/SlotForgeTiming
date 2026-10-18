// The SlotForge box (an Arduino running firmware/SlotForgeBox): the stream it sends and the link that turns it into race events. Pure (no screen, no port), so it can be tested.
// The box speaks the Trackmate protocol (letters A..H while a lane sensor is covered, W for the Track call button, a tick "digits LF CR" with the box clock) plus,
// once the app has sent V, events in square brackets. See firmware/SlotForgeBox/protocol.h for the whole list; this file is its mirror image.
//
// Events of the link (the same shape as Trackmate.link, so a race listens the same way, plus the box's extras):
//   { type: 'hit', lane, at }                 a crossing on lane (0-based, after the sensor-to-lane map); at = PC clock, from the box clock
//   { type: 'call', at }                      the Track call / Start button of the box (W)
//   { type: 'pit', pit, in, at }              pit sensor `pit` (0-based) covered or freed
//   { type: 'button', lane, at }              the call button of a lane (the ladder), lane 0-based
//   { type: 'trap', lane, ms, at }            the car covered lane's sensor for ms (the speed trap)
//   { type: 'reading', pin, raw }             a live reading of an analog pin (when the readings stream is on)
//   { type: 'calibrated', pin, base, arm, trig }
//   { type: 'version', version, board, pins } the answer to V (the box is now in SlotForge mode)
//   { type: 'safe', on }                      the box entered (on) or left its safe state (no keep-alive for 3 s)
//   { type: 'option', key, values }           a setting of the box (the answer to ?)
//   { type: 'message', text }                 a line for the log
//   { type: 'ack' }                           the answer to a keep-alive (when they stop while the ticks go on, the box has rebooted into Trackmate mode: send V again)
// Buffered crossings ([B lane ms], laps counted while the PC was away) come out as ordinary hits with their box time.
(function (root) {
  const H = typeof module !== 'undefined' ? require('./hardware.js') : root.Hardware;
  const TM = typeof module !== 'undefined' ? require('./trackmate.js') : root.Trackmate;
  const QUIET = 250;        // ms without a letter before a lane sensor counts as free. The Trackmate link uses 500; the box ends a pass itself and repeats letters every 50 ms, and its blackout is 300 ms, so two real cars are never closer than that: 250 lets two cars 0.3-0.5 s apart count as two laps
  const KEEPALIVE_MS = 1000; // how often the page sends "!"
  const ROLES = [['N', 'Not used'], ['L', 'Lane sensor'], ['P', 'Pit sensor'], ['K', 'Call buttons (ladder)']];
  const KINDS = [[0, 'Light sensor'], [1, 'Contact (reed, dead strip)']];
  const LIGHTS = [[0, 'No lights'], [1, 'LED strip (WS2812) on D6'], [2, 'Plain LEDs on D7..D13']];
  const cmd = text => H.cmd(text); // text + LF, as the Trackmate commands are sent

  // Reads the byte stream (any pieces) and gives whole messages: { type: 'lane', lane 1..8 } for a letter, { type: 'call' } for W,
  // { type: 'tick', ms } for "digits LF CR", { type: 'ext', text } for "[...]", { type: 'other' }. Each has raw: the bytes of that message.
  function parser() {
    let cur = [], ext = null;
    return {
      feed(bytes) {
        const out = [];
        Array.from(bytes).forEach(b => {
          if (ext !== null) { if (b === 93) { out.push({ type: 'ext', text: String.fromCharCode(...ext), raw: [91].concat(ext, 93) }); ext = null; } else if (ext.length < 120) ext.push(b); else ext = null; return; }
          if (b === 91) { ext = []; return; }
          if (b >= 65 && b <= 72) out.push({ type: 'lane', lane: b - 64, raw: [b] });
          else if (b === 87) out.push({ type: 'call', raw: [b] });
          else if ((b >= 48 && b <= 57) || b === 10) { cur.push(b); if (cur.length > 12) { out.push({ type: 'other', raw: cur }); cur = []; } }
          else if (b === 13) {
            const digits = cur.filter(x => x !== 10);
            if (digits.length && digits.length === cur.filter(x => x >= 48 && x <= 57).length) out.push({ type: 'tick', ms: Number(String.fromCharCode(...digits)), raw: cur.concat(13) });
            else out.push({ type: 'other', raw: cur.concat(13) });
            cur = [];
          } else out.push({ type: 'other', raw: [b] });
        });
        return out;
      }
    };
  }
  // "[P2+]" -> { tag: 'P', n: 2, sign: '+' }; "[T1 123]" -> { tag: 'T', n: 1, args: [123] }; "[V 1.0.0 nano 8]" -> { tag: 'V', args: ['1.0.0','nano','8'] }
  function parseExt(text) {
    const m = /^([A-Z!])(\d*)([+-]?)\s*(.*)$/.exec(text); if (!m) return null;
    return { tag: m[1], n: m[2] === '' ? null : Number(m[2]), sign: m[3] || '', args: m[4] ? m[4].split(/\s+/) : [] };
  }
  const note = m => m.type === 'lane' ? `lane ${m.lane} sensor` : m.type === 'call' ? 'Track call button' : m.type === 'tick' ? `tick ${m.ms} ms` : m.type === 'ext' ? describeExt(m.text) : '';
  function describeExt(text) {
    const e = parseExt(text); if (!e) return text;
    return { V: `box firmware ${e.args.join(' ')}`, P: `pit sensor ${e.n} ${e.sign === '+' ? 'covered' : 'free'}`, K: `call button lane ${e.n}`, T: `lane ${e.n} covered for ${e.args[0]} ms`, Z: `pin ${e.n} reads ${e.args[0]}`,
      C: `pin ${e.n} calibrated: base ${e.args[0]}, arm ${e.args[1]}, trigger ${e.args[2]}`, S: e.sign === '+' ? 'SAFE STATE: no keep-alive' : 'back from the safe state', B: `buffered lap, lane ${e.n} at ${e.args[0]} ms`, O: `setting ${e.args.join(' ')}`, E: e.args.join(' ') }[e.tag] || text;
  }

  // ---- commands to the box (each a line) ----
  const C = {
    version: () => cmd('V'), keepalive: () => cmd('!'), trackmateMode: () => cmd('G'),
    lights: c => cmd('L' + c),                                  // '0'..'5', 'G', 'S', 'Y'
    beep: n => cmd('B' + Math.max(1, Math.min(3, n | 0))),
    mainPower: on => cmd('M' + (on ? 1 : 0)),
    lanePower: (lane0, on) => cmd('Q' + (lane0 + 1) + (on ? 1 : 0)),
    lanePixel: (lane0, hex) => cmd('N' + (lane0 + 1) + ' ' + String(hex).replace('#', '')),
    calibrate: () => cmd('X'),
    thresholds: (pin, arm, trig) => cmd(`H${pin} ${arm | 0} ${trig | 0}`),
    pinRole: (pin, role, index, kind) => cmd(`P${pin} ${role === 'L' || role === 'P' ? role + index : role} ${kind | 0}`), // role: 'L' | 'P' | 'K' | 'N'
    option: (key, value) => cmd(`O ${key} ${value}`),
    save: () => cmd('W'), list: () => cmd('?'), readings: on => cmd('Z' + (on ? 1 : 0)),
    trackmateInit: o => H.trackmateInit(o)                       // the Trackmate setup the box also understands
  };

  // ---- the link ----
  function createLink(o = {}) {
    const clock = o.now || (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
    const L = { connected: false, slotforge: false, version: null, safe: false, ticks: 0, hits: 0, power: null, lastAck: 0, readings: {}, pins: {}, options: {}, covered: Array(8).fill(false), lit: Array(8).fill(null), pitCovered: Array(8).fill(false), map: TM.laneMap(null) };
    const subs = new Set(), statusSubs = new Set(); let P = parser(), hwMs = 0, recent = [], offset = null, sender = null; const lastHit = Array(8).fill(0);
    const emit = e => subs.forEach(f => { try { f(e); } catch (x) { /* a listener problem never stops the stream */ } });
    const toPc = h => (offset === null ? clock() : h + offset);
    const relativeB = () => { const v = L.version && String(L.version.version).split('.').map(Number); return !v || v.length < 3 || v[0] > 1 || v[1] > 0 || v[2] >= 5; }; // (firmware 1.0.5 and later send a buffered lap as "ms ago"; an unknown version is taken as current)
    L.on = f => { subs.add(f); return () => subs.delete(f); };
    L.emit = emit;
    L.onStatus = f => { statusSubs.add(f); return () => statusSubs.delete(f); };
    L.setConnected = on => { on = !!on; if (on === L.connected) return; L.connected = on; if (!on) L.reset(); statusSubs.forEach(f => f(on)); };
    L.setPower = on => { L.power = on; statusSubs.forEach(f => f(L.connected)); };
    L.setMap = saved => { L.map = TM.laneMap(saved); };
    L.reset = () => { P = parser(); hwMs = 0; L.lastAck = 0; recent = []; offset = null; L.covered.fill(false); L.lit.fill(null); L.pitCovered.fill(false); lastHit.fill(0); L.ticks = 0; L.slotforge = false; L.version = null; L.safe = false; L.readings = {}; L.pins = {}; L.options = {}; L.power = null; };
    // the page installs how bytes reach the box; the race glue and the page send through here
    L.setSender = f => { sender = f; };
    L.send = bytes => { if (sender && L.connected) { try { sender(bytes); } catch (x) { /* the page reports it */ } } };
    L.feed = bytes => {
      const arrival = clock(), msgs = P.feed(bytes);
      msgs.forEach(m => {
        if (m.type === 'tick') {
          hwMs += m.ms; L.ticks++; recent.push(arrival - hwMs); if (recent.length > 25) recent.shift(); offset = Math.min(...recent);
          for (let i = 0; i < 8; i++) if (L.covered[i] && hwMs - lastHit[i] > QUIET) L.covered[i] = false;
        } else if (m.type === 'lane') {
          const s = m.lane - 1, lane = L.map[s]; L.lit[s] = arrival;
          if (!L.covered[s]) { L.covered[s] = true; L.hits++; emit({ type: 'hit', lane, at: toPc(hwMs) }); }
          lastHit[s] = hwMs;
        } else if (m.type === 'call') emit({ type: 'call', at: toPc(hwMs) });
        else if (m.type === 'ext') {
          const e = parseExt(m.text); if (!e) return;
          if (e.tag === 'V') { L.slotforge = true; L.version = { version: e.args[0], board: e.args[1], pins: Number(e.args[2]) || 8 }; emit({ type: 'version', ...L.version }); }
          else if (e.tag === 'P' && e.n) { const pit = e.n - 1, on = e.sign === '+'; if (L.pitCovered[pit] !== on) { L.pitCovered[pit] = on; emit({ type: 'pit', pit, in: on, at: toPc(hwMs) }); } }
          else if (e.tag === 'K' && e.n) emit({ type: 'button', lane: L.map[e.n - 1], at: toPc(hwMs) });
          else if (e.tag === 'T' && e.n) emit({ type: 'trap', lane: L.map[e.n - 1], ms: Number(e.args[0]) || 0, at: toPc(hwMs) });
          else if (e.tag === 'Z' && e.n !== null) { L.readings[e.n] = Number(e.args[0]); emit({ type: 'reading', pin: e.n, raw: Number(e.args[0]) }); }
          else if (e.tag === 'C' && e.n !== null) { const r = { pin: e.n, base: Number(e.args[0]), arm: Number(e.args[1]), trig: Number(e.args[2]) }; L.pins[e.n] = { ...(L.pins[e.n] || {}), arm: r.arm, trig: r.trig }; emit({ type: 'calibrated', ...r }); }
          else if (e.tag === 'S') { L.safe = e.sign === '+'; emit({ type: 'safe', on: L.safe }); }
          else if (e.tag === 'B' && e.n) { const v = Number(e.args[0]); L.hits++; emit({ type: 'hit', lane: L.map[e.n - 1], at: toPc(relativeB() ? hwMs - v : v), buffered: true }); } // (1.0.5: ms before the tick that came with it; 1.0.4 and before: the absolute box time, right only when the box clock started at the connection)
          else if (e.tag === 'O') {
            if (e.args[0] === 'pin') { const [, pin, role, index, kind, arm, trig] = e.args.map(Number); L.pins[pin] = { role: ['N', 'L', 'P', 'K'][role] || 'N', index, kind, arm, trig }; }
            else L.options[e.args[0]] = e.args.slice(1).map(Number);
            emit({ type: 'option', key: e.args[0], values: e.args.slice(1) });
          } else if (e.tag === 'E') emit({ type: 'message', text: e.args.join(' ') });
          else if (e.tag === '!') { L.lastAck = arrival; emit({ type: 'ack' }); }
        }
      });
      return msgs;
    };
    return L;
  }
  // the check lights beside the sensors, as on the Trackmate page
  const ledsOn = (litAt, now, hold = 1000, count = 8) => TM.ledsOn(litAt, now, hold, count);

  const api = { parser, parseExt, note, describeExt, C, cmd, createLink, ledsOn, ROLES, KINDS, LIGHTS, KEEPALIVE_MS, QUIET, laneMap: TM.laneMap, swapLane: TM.swapLane, link: createLink() };
  root.ArduinoBox = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
