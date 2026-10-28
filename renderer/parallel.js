// Parallel-port configuration, physical-pin decoding and edge detection. No OS or screen access.
// The Windows helper timestamps samples before IPC; feed() never replaces that time with arrival time.
(function (root) {
  const STATUS = [10, 11, 12, 13, 15], CONTROL = [1, 14, 16, 17], DATA = [2, 3, 4, 5, 6, 7, 8, 9], INPUTS = [...STATUS, ...CONTROL];
  const RC = [10, 11, 12, 13, 15, 1, 14, 16], SLOTTRAK = [15, 13, 12, 10, 11, 1, 14, 16];
  const defaults = () => ({ name: 'Parallel 1', port: 'lpt1', address: '378', autoConnect: false, lanes: 4, preset: 'rc', map: RC.slice(), signal: Array(8).fill('high'), pitMode: 'shared', pitPins: Array(8).fill(0), pitSignal: Array(8).fill('high'), pitAsLap: false, trackcall: false, callPin: 15, callSignal: 'high', outputsOn: false, extraOutputs: false, controlInputs: false, outputs: {}, outputSignal: {}, poll: 1, filter: 0, rearm: 0, calibration: null });
  const clone = x => JSON.parse(JSON.stringify(x));
  function config(value) {
    const d = defaults(), v = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    for (const k of Object.keys(d)) if (Object.prototype.hasOwnProperty.call(v, k)) d[k] = clone(v[k] === undefined ? d[k] : v[k]);
    return d;
  }
  const addressOf = c => ({ lpt1: 0x378, lpt2: 0x278, lpt3: 0x3bc }[c.port] ?? (/^(?:0x)?[0-9a-f]{1,4}$/i.test(String(c.address).trim()) ? parseInt(String(c.address).trim().replace(/^0x/i, ''), 16) : NaN));
  function outputRoles(lanes) { return [['none', 'Unused'], ['master', 'Master track power'], ...Array.from({ length: lanes }, (_, i) => ['relay' + (i + 1), 'Lane ' + (i + 1) + ' power']), ...Array.from({ length: 5 }, (_, i) => ['start' + (i + 1), 'Start light ' + (i + 1)]), ['go', 'GO light'], ['yellow', 'Yellow flag light'], ['red', 'Red flag light'], ['power', 'Power-on indicator'], ['buzzer', 'Buzzer']]; }
  function assignments(c) {
    const out = [], lanes = Number.isInteger(c.lanes) ? Math.max(0, Math.min(8, c.lanes)) : 0;
    if (Array.isArray(c.map)) c.map.slice(0, lanes).forEach((pin, lane) => { if (pin) out.push({ pin, kind: 'lap', lane, label: 'Lane ' + (lane + 1) + ' sensor', section: 'sensors' }); });
    if (c.pitMode === 'separate' && Array.isArray(c.pitPins)) c.pitPins.slice(0, lanes).forEach((pin, lane) => { if (pin) out.push({ pin, kind: 'pit', lane, label: 'Lane ' + (lane + 1) + ' pit', section: 'pits' }); });
    if (c.trackcall && c.callPin) out.push({ pin: c.callPin, kind: 'call', label: 'Track-call button', section: 'pits' });
    if (c.outputsOn && c.outputs && typeof c.outputs === 'object') Object.entries(c.outputs).forEach(([pin, role]) => { if (role && role !== 'none' && (DATA.includes(+pin) || (c.extraOutputs && CONTROL.includes(+pin)))) out.push({ pin: +pin, kind: 'out', role, label: outputRoles(lanes).find(r => r[0] === role)?.[1] || role, section: 'outputs' }); });
    return out;
  }
  function validate(c) {
    const errors = [], add = (text, section, pin) => errors.push({ text, section, pin });
    if (!c || typeof c !== 'object') return [{ text: 'The parallel-port settings are missing.', section: 'connection' }];
    if (typeof c.name !== 'string' || !c.name.trim() || c.name.length > 40) add('Give this connection a name of up to 40 characters.', 'connection');
    if (!['lpt1', 'lpt2', 'lpt3', 'manual'].includes(c.port) || !Number.isInteger(addressOf(c)) || addressOf(c) < 1 || addressOf(c) > 65533) add('Enter a hexadecimal base address from 1 to FFFD, for example 378 or D010.', 'connection');
    if (!Number.isInteger(c.lanes) || c.lanes < 1 || c.lanes > 8) add('Choose between one and eight lanes.', 'sensors');
    for (const [key, section, allowed] of [['map', 'sensors', [0, ...INPUTS]], ['signal', 'sensors', ['high', 'low']], ['pitPins', 'pits', [0, ...INPUTS]], ['pitSignal', 'pits', ['high', 'low']]]) if (!Array.isArray(c[key]) || c[key].length !== 8 || !c[key].every(v => allowed.includes(v))) add('Check the saved ' + key + ' settings.', section);
    if (!['none', 'shared', 'separate'].includes(c.pitMode)) add('Choose how pit stops are detected.', 'pits');
    if (!['rc', 'slottrak', 'custom'].includes(c.preset)) add('Choose a wiring layout.', 'sensors');
    if (!['high', 'low'].includes(c.callSignal) || ![0, ...INPUTS].includes(c.callPin)) add('Choose a valid track-call input and signal.', 'pits');
    for (const k of ['autoConnect', 'pitAsLap', 'trackcall', 'outputsOn', 'extraOutputs', 'controlInputs']) if (typeof c[k] !== 'boolean') add('Check the ' + k + ' option.', k === 'outputsOn' || k === 'extraOutputs' ? 'outputs' : 'connection');
    if (!c.outputs || typeof c.outputs !== 'object' || Array.isArray(c.outputs) || !c.outputSignal || typeof c.outputSignal !== 'object' || Array.isArray(c.outputSignal)) add('Check the output assignments.', 'outputs');
    else {
      const roles = outputRoles(c.lanes >= 1 && c.lanes <= 8 ? c.lanes : 8).map(r => r[0]);
      for (const [pin, role] of Object.entries(c.outputs)) if (![...DATA, ...CONTROL].includes(+pin) || !roles.includes(role)) add('Check the function assigned to output pin ' + pin + '.', 'outputs', +pin);
      for (const [pin, signal] of Object.entries(c.outputSignal)) if (![...DATA, ...CONTROL].includes(+pin) || !['high', 'low'].includes(signal)) add('Check the active signal for output pin ' + pin + '.', 'outputs', +pin);
    }
    if (!Number.isInteger(c.poll) || ![1, 2, 5, 10].includes(c.poll) || !Number.isFinite(c.filter) || c.filter < 0 || c.filter > 20 || !Number.isFinite(c.rearm) || c.rearm < 0 || c.rearm > 1000) add('Use a supported polling interval and filter values within the shown limits.', 'timing');
    const uses = assignments(c), pins = new Map(), roles = new Set();
    for (const a of uses) {
      if (pins.has(a.pin)) add(`Pin ${a.pin} is assigned to ${pins.get(a.pin).label} and ${a.label}. Choose different pins.`, a.section, a.pin); else pins.set(a.pin, a);
      if (a.kind !== 'out' && CONTROL.includes(a.pin) && !c.controlInputs) add(`${a.label}: pin ${a.pin} needs control-pin inputs enabled and checked with your hardware.`, a.section, a.pin);
      if (a.kind === 'out') { if (roles.has(a.role)) add(a.label + ' is assigned to more than one output.', 'outputs', a.pin); roles.add(a.role); }
    }
    if (Array.isArray(c.map)) c.map.slice(0, c.lanes).forEach((pin, i) => { if (!pin) add('Choose a sensor pin for lane ' + (i + 1) + '.', 'sensors'); });
    if (c.pitMode === 'separate' && Array.isArray(c.pitPins)) c.pitPins.slice(0, c.lanes).forEach((pin, i) => { if (!pin) add('Choose a pit sensor pin for lane ' + (i + 1) + ', or choose another pit mode.', 'pits'); });
    if (c.trackcall && !c.callPin) add('Choose a pin for the track-call button.', 'pits');
    return errors;
  }
  // Actual voltage levels: pin 11 and control pins 1, 14, 17 are inverted by the PC registers.
  function decode(status, control) {
    const out = {};
    for (const [pin, bit] of [[15, 3], [13, 4], [12, 5], [10, 6], [11, 7]]) out[pin] = !!((status ^ 0x80) & (1 << bit));
    CONTROL.forEach((pin, i) => { out[pin] = !!((control ^ 0x0b) & (1 << i)); });
    return out;
  }
  function wiring(c) {
    let dataMask = 0, controlMask = 0, dataOff = 0, controlOff = 0;
    for (const a of assignments(c)) {
      if (a.kind === 'out') {
        const data = DATA.includes(a.pin), bit = 1 << (data ? a.pin - 2 : CONTROL.indexOf(a.pin)), high = (c.outputSignal[a.pin] || 'high') === 'low';
        if (data) { dataMask |= bit; if (high) dataOff |= bit; }
        else { controlMask |= bit; if (high !== !!(0x0b & bit)) controlOff |= bit; }
      } else if (CONTROL.includes(a.pin)) { const bit = 1 << CONTROL.indexOf(a.pin); controlMask |= bit; if (!(0x0b & bit)) controlOff |= bit; }
    }
    // Clear the bidirectional data-input flag only when using data outputs; keep IRQ and other bits.
    if (dataMask) controlMask |= 0x20;
    return { dataMask, controlMask, dataOff, controlOff };
  }
  function outputBytes(c, wants = {}) {
    const w = wiring(c); let data = w.dataOff, control = w.controlOff;
    for (const a of assignments(c).filter(x => x.kind === 'out')) {
      const isData = DATA.includes(a.pin), bit = 1 << (isData ? a.pin - 2 : CONTROL.indexOf(a.pin));
      if (wants[a.role] === true) { if (isData) data ^= bit; else control ^= bit; }
    }
    return { data, control };
  }
  function createLink(o = {}) {
    const listeners = new Set(), statuses = new Set(), emit = e => listeners.forEach(f => { try { f(e); } catch (x) { if (o.onError) o.onError(x); else if (typeof console !== 'undefined') console.error('Parallel-port event listener failed:', x); } });
    let c = config(o.config), sensors = new Map(), lastAt = -Infinity, holdMs = 2000;
    const L = { connected: false, power: null, pins: {}, counts: Array(8).fill(0), total: 0, maxGap: 0, samples: 0, lastAt: null, error: '', config: c };
    const status = () => statuses.forEach(f => f(L.connected));
    L.on = f => { listeners.add(f); return () => listeners.delete(f); };
    const observations = new Set();
    L.onSensor = f => { observations.add(f); return () => observations.delete(f); };
    L.sensorLevels = () => assignments(c).filter(a => a.kind === 'lap' || a.kind === 'pit').map(a => ({ lane: a.lane, kind: a.kind, on: sensors.has(a.pin) ? sensors.get(a.pin).observed : null }));
    L.onStatus = f => { statuses.add(f); return () => statuses.delete(f); };
    L.configure = v => { c = config(v); L.config = c; sensors.clear(); lastAt = -Infinity; L.pins = {}; };
    L.setHold = ms => { holdMs = Number.isFinite(ms) ? Math.max(0, ms) : 2000; };
    L.setPower = on => { L.power = !!on; status(); };
    L.setConnected = on => { on = !!on; if (on === L.connected) return; L.connected = on; L.power = null; sensors.clear(); lastAt = -Infinity; L.pins = {}; status(); };
    L.clearMonitor = () => { L.counts.fill(0); L.total = 0; L.maxGap = 0; L.samples = 0; };
    // At race bind a held lap sensor must clear before another hit. Pit presence remains observable.
    L.rearm = (options = {}) => {
      const keep = new Set(options.keepBlocked || []);
      for (const a of assignments(c)) {
        const st = sensors.get(a.pin); if (!st) continue;
        if (keep.has(a.lane) && st.raw && st.blocked) continue;
        st.armed = !st.raw; st.accepted = false; st.blocked = false;
      }
    };
    L.feed = sample => {
      if (!L.connected || !sample || !Number.isFinite(sample.at) || !Number.isInteger(sample.status) || sample.status < 0 || sample.status > 255 || !Number.isInteger(sample.control) || sample.control < 0 || sample.control > 255 || sample.at < lastAt) return false;
      const at = sample.at, first = lastAt === -Infinity; if (!first) L.maxGap = Math.max(L.maxGap, Number.isFinite(sample.gap) ? sample.gap : at - lastAt); lastAt = at; L.lastAt = at; L.samples++; L.pins = decode(sample.status, sample.control);
      const input = assignments(c).filter(a => a.kind !== 'out');
      for (const a of input) {
        const signal = a.kind === 'lap' ? c.signal[a.lane] : a.kind === 'pit' ? c.pitSignal[a.lane] : c.callSignal, active = L.pins[a.pin] === (signal === 'high');
        let st = sensors.get(a.pin);
        const presence = (on, when) => { st.observed = on; observations.forEach(f => { try { f({ lane: a.lane, kind: a.kind, on, at: when }); } catch (x) { if (o.onError) o.onError(x); } }); };
        if (!st) { st = { raw: active, observed: active, start: at, clearAt: active ? null : at, armed: !active, accepted: false, blocked: false }; sensors.set(a.pin, st); presence(active, at); }
        const accept = endAt => {
          if (st.raw && !st.observed && endAt - st.start >= c.filter) presence(true, st.start + c.filter);
          if (st.raw && st.armed && !st.accepted && endAt - st.start >= c.filter) {
            st.accepted = true; st.armed = false;
            if (a.kind === 'lap') { L.counts[a.lane]++; L.total++; emit({ type: 'hit', lane: a.lane, at: st.start, shared: c.pitMode === 'shared' }); }
            else if (a.kind === 'pit') { if (c.pitAsLap) { L.counts[a.lane]++; L.total++; emit({ type: 'hit', lane: a.lane, at: st.start, shared: false }); } st.blocked = true; emit({ type: 'pit', lane: a.lane, in: true, at: st.start }); }
            else emit({ type: 'call', at: st.start });
          }
          if (a.kind === 'lap' && c.pitMode === 'shared' && st.raw && st.accepted && !st.blocked && endAt - st.start >= holdMs) { st.blocked = true; emit({ type: 'block', lane: a.lane, at: st.start }); }
        };
        accept(at); // A pulse can finish between heartbeat samples: assess its duration before its falling edge.
        if (active !== st.raw) {
          if (active) { st.armed = st.clearAt !== null && at - st.clearAt >= c.rearm; st.raw = true; st.start = at; st.clearAt = null; st.accepted = false; st.blocked = false; }
          else { if (st.blocked) emit({ type: a.kind === 'pit' ? 'pit' : 'free', lane: a.lane, in: false, at }); st.raw = false; st.clearAt = at; st.accepted = false; st.blocked = false; if (!c.rearm) st.armed = true; }
        }
        if (!st.raw && at - st.clearAt >= c.rearm) st.armed = true;
        if (!st.raw && st.observed && at - st.clearAt >= c.rearm) presence(false, st.clearAt + c.rearm);
        accept(at);
      }
      return true;
    };
    return L;
  }
  const api = { STATUS, CONTROL, DATA, INPUTS, RC, SLOTTRAK, defaults, config, addressOf, outputRoles, assignments, validate, decode, wiring, outputBytes, createLink, link: createLink() };
  root.ParallelPort = api; if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
