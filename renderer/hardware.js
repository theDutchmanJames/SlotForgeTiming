// Timing hardware connection (used by the Trackmate and the DS Electronics page): it connects to a USB device and shows exactly what the device sends,
// so the data format can be worked out. Works with a COM port (Web Serial) or a USB HID device (WebHID); Electron provides both.
(function (root) {
  const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join(' ');
  const ascii = bytes => Array.from(bytes, b => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.')).join('');
  const hex4 = n => (n === undefined || n === null ? '----' : Number(n).toString(16).padStart(4, '0').toUpperCase());
  // one line of the log: seconds since the connection, direction, byte count, hex and text
  const line = (ms, dir, bytes, note) => `${(ms / 1000).toFixed(3).padStart(9)}  ${dir}  ${String(bytes.length).padStart(3)} B  ${hex(bytes)}${note ? '  ' + note : ''}  |${ascii(bytes)}|`;
  // "A5 0d 10" or "a50d10" or "0xA5, 0x0D" -> bytes; null when it is not hex
  function parseHex(text) {
    const t = String(text || '').replace(/0x/gi, ' ').replace(/[,;]/g, ' ').trim(); if (!t) return null;
    const parts = /\s/.test(t) ? t.split(/\s+/) : (t.length % 2 ? null : t.match(/../g)); if (!parts) return null;
    if (!parts.every(p => /^[0-9a-f]{1,2}$/i.test(p))) return null;
    return Uint8Array.from(parts.map(p => parseInt(p, 16)));
  }
  const describe = (kind, info) => kind === 'serial'
    ? `COM port${info && info.usbVendorId !== undefined ? ` (USB ${hex4(info.usbVendorId)}:${hex4(info.usbProductId)})` : ''}`
    : `USB HID ${info && info.productName ? info.productName + ' ' : ''}(${hex4(info && info.vendorId)}:${hex4(info && info.productId)})`;
  // ---- what is known of the Trackmate serial protocol (9600 baud, 8N1; every command ends with a line feed) ----
  // From the device: A..H = a car is over the sensor of lane 1..8 (repeated while it is there), W = the Trackcall button, digits + CR = a time, LF = a tick.
  // To the device: A<n> number of lanes, C<0|1> sensors normally open/closed, D<n> debounce, I0, then S = start; R / E = track power on / off.
  const cmd = text => Uint8Array.from(Array.from(text + '\n', c => c.charCodeAt(0)));
  function trackmateInit({ lanes, closed, debounce }) {
    const n = Math.max(1, Math.min(8, Math.round(Number(lanes)) || 2)), d = Math.max(0, Math.min(9, Math.round(Number(debounce)) || 0));
    return [cmd('A' + n), cmd('C' + (closed ? 1 : 0)), cmd('D' + d), cmd('I0'), cmd('S')];
  }
  // relayClosed: the relay is wired "normally closed" (R = power on); otherwise normally open (E = power on)
  const trackmatePower = (on, relayClosed) => cmd(relayClosed ? (on ? 'R' : 'E') : (on ? 'E' : 'R'));
  // a short explanation of received bytes for the log
  function trackmateNote(bytes) {
    const out = [];
    Array.from(bytes).forEach(b => {
      if (b >= 65 && b <= 72) out.push(`lane ${b - 64} sensor`); else if (b === 87) out.push('Trackcall button'); else if (b === 10) out.push('LF'); else if (b === 13) out.push('CR');
      else if (b >= 48 && b <= 57) out.push('digit ' + (b - 48));
    });
    return out.length ? '[' + out.join(', ') + ']' : '';
  }
  // Reads the byte stream of the Trackmate (which can arrive in any pieces) and gives whole messages:
  // { type: 'lane', lane } for A..H, { type: 'call' } for W, { type: 'tick', ms } for "digits LF CR" (the device sends one every 200 ms), { type: 'other' }. Each has raw: the bytes of that message.
  function trackmateParser() {
    let cur = [];
    return {
      feed(bytes) {
        const out = [];
        Array.from(bytes).forEach(b => {
          if (b >= 65 && b <= 72) out.push({ type: 'lane', lane: b - 64, raw: [b] });
          else if (b === 87) out.push({ type: 'call', raw: [b] });
          else if ((b >= 48 && b <= 57) || b === 10) { cur.push(b); if (cur.length > 8) { out.push({ type: 'other', raw: cur }); cur = []; } }
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
  // ---- DS Electronics lap counters ----
  // DS200/300 protocol research is kept outside the app. This page remains capture-only
  // until decoding, device lifecycle and race integration have been validated together.
  // The models are those of Race Coordinator's DS setup screen.
  const DS_TYPES = [['ds030', 'DS-030'], ['ds200', 'DS-200'], ['ds200b', 'DS-200b'], ['ds300', 'DS-300'], ['ds300rc', 'DS-300 RC'], ['ds0045', 'DS-0045']];
  const dsTypeName = id => (DS_TYPES.find(t => t[0] === id) || ['', ''])[1];
  const BAUDS = [300, 1200, 2400, 4800, 9600, 19200, 38400, 56000, 57600, 115200];
  // Reference suggestions, not autodetection or proof of hardware compatibility.
  // PC Lap Counter's DS documentation specifies 4800 for DS-030 and 4800/56000
  // for some DS-200/300 units. Its installed DS-300 v5.0.0 UI confirms 56000.
  // https://www.pclapcounter.be/body_ds_racing_ds-030_ds-300_ds-200.html
  // DS-0045 hints come only from installed PCLC_MSCOMM_DS045.ocx strings;
  // do not promote them to an automatic preset or a verified decoder.
  const dsGuidance = type => {
    if (type === 'ds030') return { baud: 4800, text: 'PC Lap Counter documents 4800 baud for DS-030. Match your unit when capturing.' };
    // TicTacSlot 5.08.0008 Help, Configuración Inicial: usual speeds are
    // DS300 56000, other DS counters 4800. PCLC documents exceptions.
    if (type === 'ds200') return { baud: 4800, text: 'Start with 4800 baud for DS-200, following TicTacSlot’s setup guidance. PC Lap Counter also documents units that use 56000. Match a known working setting. After connecting, press Start/Stop on the DS box or pass a car over a sensor to produce initial data.' };
    if (type === 'ds300') return { baud: 56000, text: 'Start with 56000 baud for DS-300; some units use 4800. Match the working setting of your unit; 56000 and 57600 are different speeds. After connecting, press Start/Stop on the DS box or pass a car over a sensor to produce initial data.' };
    if (type === 'ds0045') return { baud: null, text: 'DS-0045 uses a separate interface in PC Lap Counter. Its serial component contains a 57600 baud setting, but that alone does not verify your unit. Match a known working configuration. Passive listening may produce no data if the unit needs initialization commands; Timing does not send those commands.' };
    return { baud: null, text: 'No model-specific serial setting has been verified for this variant. Match the settings of a working connection rather than assuming another DS model uses the same protocol.' };
  };
  // Offline integrity check for our own text captures. Serial reads are chunks, not packets.
  // Preserve every byte, including zeroes; never interpret these as race events.
  function dsInspectCapture(text) {
    if (typeof text !== 'string' || text.length > 8 * 1024 * 1024) throw Error('Choose a SlotForge capture smaller than 8 MB.');
    const rows = text.replace(/^\uFEFF/, '').split(/\r?\n/);
    if (!/^SlotForge Timing(?: [\d.]+)? - DS Electronics capture$/.test(rows[0])) throw Error('This is not a SlotForge DS capture. PC Lap Counter logs use a different format.');
    let bytes = 0, chunks = 0, sessions = 0, omitted = 0;
    rows.forEach((row, i) => {
      if (/^\s*-- connected to /.test(row)) sessions++;
      if (row.startsWith('Omitted log lines:')) {
        const count = /^Omitted log lines: (\d+)$/.exec(row);
        if (!count || !Number.isSafeInteger(Number(count[1]))) throw Error(`Invalid omitted-line count on line ${i + 1}.`);
        omitted = Number(count[1]);
      }
      // Classify by the line prefix, never by words inside the received payload.
      if (!/^\s*\S+\s+<-/.test(row)) return;
      const m = /^\s*(\d+\.\d+)\s+<-\s+(\d+) B\s+([^|]+)\|[^\r\n]*\|$/i.exec(row);
      if (!m) throw Error(`Invalid receive data on line ${i + 1}.`);
      const pairs = m[3].trim().split(/\s+/);
      if (!pairs.every(p => p.length % 2 === 0 && /^[\da-f]+$/i.test(p))) throw Error(`Invalid receive data on line ${i + 1}.`);
      const length = pairs.reduce((n, p) => n + p.length / 2, 0);
      if (length !== Number(m[2])) throw Error(`Byte count mismatch on line ${i + 1}.`);
      bytes += length; chunks++;
    });
    return { bytes, chunks, sessions, omitted };
  }
  // The serial settings of a connection. Anything that is not one of the usual choices becomes 9600 baud, 8 data bits, no parity, 1 stop bit, and DTR and RTS are on unless switched off.
  const serialConfig = o => {
    o = o || {}; const pick = (v, list, d) => (list.includes(v) ? v : d);
    return { baud: pick(Number(o.baud), BAUDS, 9600), data: pick(Number(o.data), [7, 8], 8), parity: pick(o.parity, ['none', 'even', 'odd'], 'none'), stop: pick(Number(o.stop), [1, 2], 1), dtr: o.dtr !== false, rts: o.rts !== false };
  };
  const two = n => String(n).padStart(2, '0');
  const stamp = d => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
  // the top of a saved capture: what it was made with, so the person reading it needs to be told nothing else
  const dsHeader = o => {
    o = o || {};
    return [`SlotForge Timing${o.version ? ' ' + o.version : ''} - DS Electronics capture`, `Saved: ${o.when instanceof Date && !isNaN(o.when) ? stamp(o.when) : '?'} (the time on this computer)`,
      `Unit: ${dsTypeName(o.type) || 'not chosen'}`, `Port: ${o.info ? describe('serial', o.info) : 'no port chosen'}`,
      'Each line: seconds since connecting, <- for data from the unit, the number of bytes, the bytes in hex, then the same bytes as text between | |.',
      'LINES = the state of the control lines (CTS, DSR, DCD, RI) when it changed. NOTE = a remark typed by the person making the capture. "-- connected ... --" lines say which serial settings were used.'].join('\r\n');
  };
  // the version of this app, from the user agent of the window (Electron puts the name and version of the app in it); '' when it is not there
  const appVersion = ua => { const m = /slotforge[-\s]?timing\/(\d+\.\d+\.\d+)/i.exec(String(ua || '')); return m ? m[1] : ''; };
  const dsCapture = (o, lines) => {
    const c = o?.cfg && serialConfig(o.cfg);
    return dsHeader(o) + (c ? `\r\nMost recent connection opened at: ${c.baud} baud, ${c.data} data bits, ${c.parity} parity, ${c.stop} stop bit(s), DTR ${c.dtr ? 'on' : 'off'}, RTS ${c.rts ? 'on' : 'off'}` : '') + `\r\nOmitted log lines: ${Math.max(0, Number(o?.omitted) || 0)}\r\nHeader identifies the most recent connection; each connection line identifies its model and serial settings. Receive chunks are not protocol packets.\r\n\r\n` + (lines || []).join('\r\n') + '\r\n';
  };
  const dsFileName = id => `ds-electronics-${DS_TYPES.some(t => t[0] === id) ? id : 'unit'}-log.txt`;

  // ---- which timing hardware the app uses: one at a time ----
  // The setting timingHw is the choice. Before anything was chosen it follows what was set up: before the Arduino Sketch existed the only hardware was the Trackmate, so that stays the answer,
  // except when the virtual box is ticked, or a box is remembered and no Trackmate is.
  const TIMING = [['none', 'None (keys or simulated cars)'], ['trackmate', 'Trackmate Interface'], ['arduino', 'Arduino Sketch'], ['parallel', 'Parallel Port'], ['phidget', 'Phidget Interface'], ['plugin', 'Plugin interface']];
  const timingChosen = s => {
    s = s || {};
    if (TIMING.some(t => t[0] === s.timingHw)) return s.timingHw;
    return s.abVirtual === true || (s.abDevice && !s.tmDevice) ? 'arduino' : 'trackmate';
  };

  const api = { TIMING, timingChosen, trackmateParser, cmd, trackmateInit, trackmatePower, trackmateNote, hex, ascii, hex4, line, parseHex, describe, DS_TYPES, dsTypeName, dsGuidance, dsInspectCapture, BAUDS, serialConfig, appVersion, dsHeader, dsCapture, dsFileName };
  root.Hardware = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
