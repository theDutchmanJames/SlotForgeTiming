// App Settings > Timing Hardware > Arduino: the SlotForge box (firmware/SlotForgeBox on a Nano or Mega). The connection (kept while the app runs, used by the race),
// the pins (what each analog pin is, its live reading and thresholds), the lights, the power relays, the buttons, the monitor, and the download of the sketch.
// Modelled on hardwareui.js (the Trackmate page); the virtual box (arduinosim.js) is opened through its asPort(), so everything here works on both.
// Settings kept in the app: abAuto (connect by itself), abDevice ({ vid, pid } of the remembered box), abVirtual (use the virtual box), abLaneMap (sensor letter -> lane).
// The readings stream is on only while this page is shown and no race is bound to the box (see abWatchPage).
// Settings kept in the BOX (sent with P/H/O and saved with W): the pin roles, thresholds, blackout, lights, relays, buzzer, safe state, ladder. "Save to the box" writes them to its EEPROM.
let ab = { dev: null, info: {}, open: false, lines: [], t0: 0, keep: null, hide: true, gen: 0, pins: {}, lit: Array(8).fill(null), ledTimers: [], calib: null, pick: null };

const abSettings = () => { const s = (typeof state !== 'undefined' && state.settings) || {}; return { auto: s.abAuto !== false, device: s.abDevice || null, virtual: s.abVirtual === true, laneMap: ArduinoBox.laneMap(s.abLaneMap) }; };
const AB_LED_HOLD = 1000;
const abLog = (dir, bytes, note) => { ab.lines.push(Hardware.line(performance.now() - (ab.t0 || 0), dir, bytes, note)); if (ab.lines.length > 3000) ab.lines.splice(0, 500); abShow(); };
const abNote = text => { ab.lines.push('          ' + text); abShow(); };
const abShow = () => { const l = document.getElementById('ab-log'); if (l) { l.textContent = ab.lines.join('\n'); l.scrollTop = l.scrollHeight; } };
const abMsg = t => { const m = document.getElementById('ab-msg'); if (m) m.textContent = t; };
const abRedraw = () => { const b = document.getElementById('hwbox'); if (b && document.getElementById('ab-log') && typeof renderArduinoSettings === 'function') renderArduinoSettings(b); };
const abConnected = () => !!(ab.open && ArduinoBox.link.connected);
// The readings stream ([Z..] lines) runs only while the Arduino page is on screen: it costs serial time on the box (a Mega has 16 pins), so never during a race.
// The app has no "page closed" hook, so a watcher looks every half second whether the page is still there and switches the stream accordingly.
const abShown = () => !!document.getElementById('ab-log');
let abStreamOn = false, abWatch = null;
async function abStream(on) { if (!ab.open || on === abStreamOn) return; abStreamOn = on; await abSend(ArduinoBox.C.readings(on), on ? 'readings on (page shown)' : 'readings off'); }
function abWatchPage() { clearInterval(abWatch); abWatch = setInterval(() => { if (!ab.open) { clearInterval(abWatch); abWatch = null; abStreamOn = false; return; } abStream(abShown() && !(typeof live !== 'undefined' && live && live.box)); }, 500); }
const abLeds = () => { const on = ArduinoBox.ledsOn(ab.lit, performance.now(), AB_LED_HOLD); on.forEach((v, i) => { const el = document.getElementById('ab-led-' + i); if (el) el.classList.toggle('on', v); }); };
const abLed = i => { ab.lit[i] = performance.now(); abLeds(); clearTimeout(ab.ledTimers[i]); ab.ledTimers[i] = setTimeout(abLeds, AB_LED_HOLD + 30); };

async function abSend(bytes, note) {
  if (!ab.open || !ab.writer) return false;
  try { await ab.writer.write(bytes); if (ab.hide === false || note) abLog('->', bytes, note || ''); return true; } catch (x) { abMsg('Could not send: ' + x.message); return false; }
}
// bytes from the port -> whole messages for the monitor, and race events through ArduinoBox.link
function abReceive(bytes) {
  const L = ArduinoBox.link;
  L.feed(bytes).forEach(m => {
    if (m.type === 'lane') { abLed(m.lane - 1); if (ab.hide !== false) return; }
    if (m.type === 'tick' && ab.hide !== false) { const t = document.getElementById('ab-ticks'); if (t) t.textContent = `ticks: ${L.ticks} (last ${m.ms} ms)`; return; }
    if (m.type === 'ext') { const e = ArduinoBox.parseExt(m.text); if (e && (e.tag === 'Z' || e.tag === 'O') && ab.hide !== false) { abPinsRefresh(); return; } if (e && (e.tag === 'C' || e.tag === 'V' || e.tag === 'S')) setTimeout(abRedraw, 50); }
    abLog('<-', m.raw, ArduinoBox.note(m));
  });
}
async function abOpen() {
  const L = ArduinoBox.link; L.setMap(abSettings().laneMap);
  try {
    ab.t0 = performance.now();
    await ab.dev.open({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' });
    ab.open = true; abNote(ab.dev.virtual ? '-- connected to the virtual box --' : '-- connected to the box at 9600 baud --');
    try { await ab.dev.setSignals({ dataTerminalReady: true, requestToSend: true }); } catch (x) { /* not every port can */ }
    ab.writer = ab.dev.writable ? ab.dev.writable.getWriter() : null;
    L.setSender(b => { ab.writer.write(b).catch(() => {}); });
    L.setConnected(true);
    const gen = ++ab.gen;
    (async () => {
      while (ab.open && ab.gen === gen && ab.dev.readable) {
        ab.reader = ab.dev.readable.getReader();
        try { for (;;) { const { value, done } = await ab.reader.read(); if (done) break; if (value && value.length) abReceive(value); } }
        catch (x) { ab.lines.push(`${((performance.now() - ab.t0) / 1000).toFixed(3).padStart(9)}  ERROR  ${x.message}`); abShow(); } finally { try { ab.reader.releaseLock(); } catch (e) { /* gone */ } }
      }
      if (ab.open && ab.gen === gen) { ab.open = false; clearInterval(ab.keep); L.setConnected(false); abNote('-- the box went away --'); abRedraw(); }
    })();
    // an Arduino resets when the port opens: give it a moment, then ask for SlotForge mode, the settings and the readings (the page is open)
    setTimeout(async () => { if (!ab.open) return; await abSend(ArduinoBox.C.version(), 'SlotForge mode'); await abSend(ArduinoBox.C.list()); abStreamOn = false; abWatchPage(); }, 2500); // (an Arduino resets when the port opens and takes up to 2 s to boot; the readings follow the page from here)
    clearInterval(ab.keep); ab.keep = setInterval(async () => {
      await abSend(ArduinoBox.C.keepalive());
      // the box answers every keep-alive with [!]; three missed answers while it was in SlotForge mode = it rebooted (a brown-out when a relay switched, say): set it up again
      if (L.slotforge && L.lastAck && performance.now() - L.lastAck > 3 * ArduinoBox.KEEPALIVE_MS + 500) { L.slotforge = false; L.lastAck = 0; abNote('-- no answer from the box: it may have rebooted; setting it up again --'); await abSend(ArduinoBox.C.version(), 'SlotForge mode'); await abSend(ArduinoBox.C.list()); abStreamOn = false; }
    }, ArduinoBox.KEEPALIVE_MS);
    abRedraw();
    return true;
  } catch (x) { ab.open = false; L.setConnected(false); abMsg('Could not connect: ' + x.message + ' (is another program using this port?)'); return false; }
}
async function abClose() {
  ab.open = false; ab.gen++; clearInterval(ab.keep); ab.keep = null;
  clearInterval(abWatch); abWatch = null; abStreamOn = false;
  try { if (ab.writer) { await abSend(ArduinoBox.C.readings(false)); await abSend(ArduinoBox.C.trackmateMode()); } } catch (x) { /* going anyway */ }
  ArduinoBox.link.setConnected(false);
  try { if (ab.reader) await ab.reader.cancel().catch(() => {}); if (ab.writer) { ab.writer.releaseLock(); ab.writer = null; } await ab.dev.close(); } catch (x) { /* already closed */ }
  abNote('-- disconnected --');
}
async function abAutoConnect() {
  try {
    const t = abSettings(); if (!t.auto || ab.open) return false;
    if (t.virtual) { ab.dev = ArduinoSim.createSim().asPort(); ab.info = ab.dev.getInfo(); return await abOpen(); }
    if (!t.device || typeof navigator === 'undefined' || !navigator.serial) return false;
    const ports = await navigator.serial.getPorts();
    const port = ports.find(p => { const i = p.getInfo ? p.getInfo() : {}; return i.usbVendorId === t.device.vid && i.usbProductId === t.device.pid; });
    if (!port) return false;
    ab.dev = port; ab.info = port.getInfo(); return await abOpen();
  } catch (x) { return false; }
}
// the zip of the sketch, handed out by the browser's download (the app's log save works the same way)
function abDownloadSketch() {
  const files = Object.keys(ArduinoSketch.files).map(name => ({ name, text: ArduinoSketch.files[name] }));
  files.push({ name: 'SlotForgeBox/README.txt', text: `SlotForge box firmware ${ArduinoSketch.version}\r\n\r\n1. Install the Arduino IDE (arduino.cc) and, for the LED strip lights, the library "Adafruit NeoPixel" (Sketch > Include Library > Manage Libraries).\r\n2. Unzip this file and open SlotForgeBox/SlotForgeBox.ino in the IDE.\r\n3. Tools > Board: Arduino Nano (Processor: ATmega328P, or "Old Bootloader" for most clones) or Arduino Mega 2560. Tools > Port: the board.\r\n4. Upload. The box starts in Trackmate mode; SlotForge switches it to its own mode when it connects.\r\n5. In SlotForge: App Settings > Timing Hardware > Arduino > Find the box, Connect. Set what each analog pin is, then Calibrate with the track empty, then Save to the box.\r\n\r\nWiring: see the Help in SlotForge (Timing Hardware > Arduino) and the pin maps at the top of settings.h.\r\n` });
  const bytes = ZipFile.make(files), a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' })); a.download = `SlotForgeBox-${ArduinoSketch.version}.zip`; document.body.appendChild(a); a.click(); a.remove();
  abMsg(`Sketch ${ArduinoSketch.version} saved as SlotForgeBox-${ArduinoSketch.version}.zip (in your Downloads folder).`);
}
// the pins table: redrawn in place (readings move, selects do not jump)
function abPinsRefresh() {
  const L = ArduinoBox.link, n = (L.version && L.version.pins) || 8;
  for (let i = 0; i < n; i++) {
    const p = L.pins[i] || {}, raw = L.readings[i], bar = document.getElementById('ab-bar-' + i), txt = document.getElementById('ab-raw-' + i); if (!bar) continue;
    const pct = v => Math.max(0, Math.min(100, Math.round((v || 0) / 1023 * 100)));
    bar.querySelector('.ab-fill').style.width = raw === undefined ? '0%' : pct(raw) + '%'; bar.querySelector('.ab-arm').style.left = pct(p.arm) + '%'; bar.querySelector('.ab-trig').style.left = pct(p.trig) + '%';
    bar.classList.toggle('covered', raw !== undefined && p.trig !== undefined && raw < p.trig);
    if (txt) txt.textContent = raw === undefined ? '–' : String(raw);
  }
}

// Choosing the COM port: in the app the main process lists the ports it found and asks the page to show them (the Trackmate and DS Electronics pages do the same on their pages).
// The list is kept in ab.pick, so a redraw of the page while it is open does not lose it.
function abDrawPick() {
  const el = document.getElementById('ab-pick'); if (!el) return;
  const p = ab.pick;
  if (!p) { el.innerHTML = ''; el.onclick = null; return; }
  el.innerHTML = `<div class="card"><strong>Choose a port</strong>${p.list.length ? p.list.map((d, i) => `<div class="row"><button class="btn" data-pick="${i}">${esc(d.displayName || d.name || d.portName || 'Port')} <span class="muted">${esc(d.portName || '')} ${d.vendorId !== undefined ? '(' + Hardware.hex4(d.vendorId) + ':' + Hardware.hex4(d.productId) + ')' : ''}</span></button></div>`).join('') : '<p class="muted">No ports found. Check the cable.</p>'}<button class="btn" data-pick="-1">Cancel</button></div>`;
  el.onclick = ev => { const b = ev.target.closest('[data-pick]'); if (!b) return; const i = Number(b.dataset.pick), q = ab.pick; ab.pick = null; abDrawPick(); if (q) q.res(i >= 0 && q.list[i] ? q.list[i].portId || q.list[i].deviceId : ''); };
}
const abChoose = list => new Promise(res => {
  if (ab.pick) ab.pick.res(''); // (an older question is dropped)
  if (!document.getElementById('ab-pick')) { ab.pick = null; return res(''); } // (this page is not on screen: nobody can choose)
  ab.pick = { list, res }; abDrawPick();
});
function renderArduinoSettings(box) {
  const t = abSettings(), can = typeof navigator !== 'undefined' && !!navigator.serial, L = ArduinoBox.link, v = L.version, n = (v && v.pins) || 8, opt = L.options;
  const sel = (id, list, cur, attrs = '') => `<select id="${id}" ${attrs}>${list.map(([val, label]) => `<option value="${val}"${String(cur) === String(val) ? ' selected' : ''}>${esc(label)}</option>`).join('')}</select>`;
  const pinRows = Array.from({ length: n }, (_, i) => {
    const p = L.pins[i] || { role: 'N', index: 0, kind: 0, arm: 0, trig: 0 }, idx = p.role === 'L' || p.role === 'P' ? `<select data-pinindex="${i}" aria-label="Number">${Array.from({ length: 8 }, (_, k) => `<option value="${k + 1}"${p.index === k + 1 ? ' selected' : ''}>${k + 1}</option>`).join('')}</select>` : '';
    return `<tr><td>A${i}</td><td>${sel('', ArduinoBox.ROLES, p.role, `data-pinrole="${i}" aria-label="Use of pin A${i}"`)} ${idx}</td><td>${p.role === 'L' || p.role === 'P' ? sel('', ArduinoBox.KINDS, p.kind, `data-pinkind="${i}"`) : ''}</td>
      <td class="ab-barcell"><div class="ab-bar${p.role === 'L' || p.role === 'P' ? '' : ' off'}" id="ab-bar-${i}" title="The reading of the pin: the car must bring it below the trigger line"><div class="ab-fill"></div><div class="ab-arm" title="Arm threshold"></div><div class="ab-trig" title="Trigger threshold"></div></div></td>
      <td class="num" id="ab-raw-${i}">–</td><td><input type="number" data-arm="${i}" value="${esc(p.arm)}" min="0" max="1023" style="width:5em" aria-label="Arm threshold"> <input type="number" data-trig="${i}" value="${esc(p.trig)}" min="0" max="1023" style="width:5em" aria-label="Trigger threshold"></td></tr>`;
  }).join('');
  const laneMap = t.laneMap, sensors = Array.from({ length: 8 }, (_, i) => `<div class="sens"><span class="led" id="ab-led-${i}" role="img" aria-label="Lane sensor ${i + 1}"></span><span class="sensname">Letter ${String.fromCharCode(65 + i)}</span><select data-sensor="${i}" aria-label="Lane of letter ${String.fromCharCode(65 + i)}">${Array.from({ length: 8 }, (_, l) => `<option value="${l}"${laneMap[i] === l ? ' selected' : ''}>Lane ${l + 1}</option>`).join('')}</select></div>`).join('');
  const lights = opt.lights || [1, 8, 64, 0], relay = opt.relay || [0, 0, 0];
  box.innerHTML = `<p class="muted">The SlotForge box: an Arduino Nano or Mega with the SlotForge sketch, lane sensors, start lights, track power relays and buttons. Plug it in, press <em>Find the box</em>, choose it, then <em>Connect</em>. It also works as a Trackmate on the Trackmate page, but this page knows all it can do.</p>
    <div class="row"><button class="btn primary" id="ab-find" ${can ? '' : 'disabled'}>Find the box (COM port)</button><button class="btn primary" id="ab-conn" ${ab.dev ? '' : 'disabled'}>${ab.open ? 'Disconnect' : 'Connect'}</button>
      <span class="muted">${ab.dev ? (ab.dev.virtual ? 'Virtual box' : esc(Hardware.describe('serial', ab.info))) + (ab.open ? ' is connected' : '') : 'No box chosen.'}${v ? ` · firmware ${esc(v.version)} on a ${esc(v.board)}${v.version !== ArduinoSketch.version ? ` (the app ships ${esc(ArduinoSketch.version)}: download it below and flash the box)` : ''}` : ''}${L.safe ? ' · SAFE STATE (no keep-alive)' : ''}</span>
      <span id="ab-msg" class="muted" role="status"></span></div>
    <div id="ab-pick"></div>
    <div class="row"><label class="inline"><input type="checkbox" id="ab-auto" ${t.auto ? 'checked' : ''}> Remember this box and connect automatically when the app starts</label>
      <label class="inline"><input type="checkbox" id="ab-virtual" ${t.virtual ? 'checked' : ''}> Use the virtual box (four imaginary cars, for trying the app without an Arduino)</label></div>
    <div class="row"><strong>The sketch</strong><button class="btn" id="ab-download">Download the Arduino sketch (${esc(ArduinoSketch.version)})</button><span class="muted">A zip with the sketch and a README: open it in the Arduino IDE, pick your board and upload. Needs the "Adafruit NeoPixel" library for LED strip lights.</span></div>
    <div class="row"><strong>Pins</strong><button class="btn" id="ab-calib" ${ab.open ? '' : 'disabled'}>Calibrate (track empty, 2 s)</button><label>Blackout (ms) <input type="number" id="ab-blackout" value="${esc((opt.blackout || [300])[0])}" min="0" max="5000" style="width:5em" ${ab.open ? '' : 'disabled'}></label><span id="ab-ticks" class="muted"></span></div>
    <div class="wrap"><table class="fields"><thead><tr><th>Pin</th><th>Use</th><th>Sensor</th><th>Reading</th><th></th><th>Arm / trigger</th></tr></thead><tbody>${pinRows}</tbody></table></div>
    <p class="muted">A lane sensor counts laps, a pit sensor starts pit stops (pit sensor 1 belongs to lane 1), the call-button ladder is the pin with the drivers' buttons. The bar is the live reading; a car must bring it below the trigger line (the right mark) and the pass ends when it rises above the arm line again. <em>Calibrate</em> sets both from the empty track.</p>
    <div class="row"><strong>Lanes</strong></div><div class="sensgrid">${sensors}</div>
    <p class="muted">Which lane each sensor letter counts for (swap two here instead of rewiring). The light turns green while a car is over the sensor.</p>
    <div class="row"><strong>Lights</strong>${sel('ab-lights', ArduinoBox.LIGHTS, lights[0], ab.open ? '' : 'disabled')}<label>Pixels <input type="number" id="ab-pixels" value="${esc(lights[1])}" min="7" max="60" style="width:4em" ${ab.open ? '' : 'disabled'}></label><label>Brightness <input type="number" id="ab-bright" value="${esc(lights[2])}" min="1" max="255" style="width:4em" ${ab.open ? '' : 'disabled'}></label>
      <label class="inline"><input type="checkbox" id="ab-lanepix" ${lights[3] ? 'checked' : ''} ${ab.open ? '' : 'disabled'}> A status pixel per lane</label><button class="btn" id="ab-lighttest" ${ab.open ? '' : 'disabled'}>Test the lights</button></div>
    <div class="row"><strong>Power</strong><label>Main relay ${sel('ab-relaync', [[0, 'normally open'], [1, 'normally closed']], relay[0], ab.open ? '' : 'disabled')}</label><label>Lane relays <input type="number" id="ab-lanerelays" value="${esc(relay[1])}" min="0" max="8" style="width:4em" ${ab.open ? '' : 'disabled'}></label>${sel('ab-lanerelaysnc', [[0, 'normally open'], [1, 'normally closed']], relay[2], ab.open ? '' : 'disabled')}
      <label>When the PC goes away ${sel('ab-safeoff', [[1, 'cut the track power'], [0, 'leave the power as it is']], (opt.safeoff || [1])[0], ab.open ? '' : 'disabled')}</label><button class="btn" id="ab-pon" ${ab.open ? '' : 'disabled'}>Power on</button><button class="btn" id="ab-poff" ${ab.open ? '' : 'disabled'}>Power off</button></div>
    <div class="row"><strong>Buttons and buzzer</strong><label class="inline"><input type="checkbox" id="ab-buzzer" ${(opt.buzzer || [1])[0] ? 'checked' : ''} ${ab.open ? '' : 'disabled'}> Buzzer present</label><label class="inline"><input type="checkbox" id="ab-ladder" ${(opt.ladder || [0])[0] ? 'checked' : ''} ${ab.open ? '' : 'disabled'}> Call-button ladder present</label><button class="btn" id="ab-beep" ${ab.open ? '' : 'disabled'}>Beep</button>
      <span class="muted">The Start/Pause and Track call buttons of the box do what the race setup says the Trackcall button does.</span></div>
    <div class="row"><button class="btn primary" id="ab-save" ${ab.open ? '' : 'disabled'}>Save to the box</button><span class="muted">Writes the pins, thresholds, lights, relays and buttons into the box, so it keeps them when it is powered on without the app.</span></div>
    <details><summary>Monitor</summary><div class="row"><label class="inline"><input type="checkbox" id="ab-hide" ${ab.hide === false ? '' : 'checked'}> Hide the steady ticks, letters and readings</label><button class="btn" id="ab-copy">Copy log</button><button class="btn" id="ab-save-log">Save log</button><button class="btn" id="ab-clear">Clear</button></div></details>
    <pre id="ab-log" class="hwlog" tabindex="0" aria-label="Data exchanged with the box" style="max-height:40vh;overflow:auto;background:var(--panel);padding:8px;border-radius:6px;font-size:12px;white-space:pre-wrap"></pre>
    <style>.ab-barcell{min-width:160px}.ab-bar{position:relative;height:14px;background:var(--panel);border-radius:4px;overflow:hidden}.ab-bar.off{opacity:.3}.ab-fill{height:100%;background:#4c9aff;width:0}.ab-bar.covered .ab-fill{background:#2ecc40}.ab-arm,.ab-trig{position:absolute;top:0;bottom:0;width:2px;background:#ffd400}.ab-trig{background:#d62828}</style>`;
  const $ = id => document.getElementById(id), save = patch => api.setSettings(patch).then(s => { state.settings = s; }), C = ArduinoBox.C;
  abShow(); abPinsRefresh(); abLeds();
  if (api.onHwChoose) api.onHwChoose(async (_kind, list) => { api.hwChosen(await abChoose(list)); }); // (the last page drawn answers the main process)
  abDrawPick();
  $('ab-find').onclick = async () => {
    try {
      ab.dev = await navigator.serial.requestPort(); ab.info = ab.dev.getInfo ? ab.dev.getInfo() : {};
      if (!ab.dev) return abMsg('No box chosen.');
      if (ab.info.usbVendorId !== undefined) await save({ abDevice: { vid: ab.info.usbVendorId, pid: ab.info.usbProductId }, abVirtual: false });
      renderArduinoSettings(box);
    } catch (x) { abMsg(x.name === 'NotFoundError' ? 'No box chosen.' : 'Could not find a box: ' + x.message); }
  };
  $('ab-conn').onclick = async () => { if (ab.open) await abClose(); else await abOpen(); renderArduinoSettings(box); };
  $('ab-auto').onchange = e => save({ abAuto: e.target.checked });
  $('ab-virtual').onchange = async e => { await save({ abVirtual: e.target.checked }); if (ab.open) await abClose(); if (e.target.checked) { ab.dev = ArduinoSim.createSim().asPort(); ab.info = ab.dev.getInfo(); await abOpen(); } else ab.dev = null; renderArduinoSettings(box); };
  $('ab-download').onclick = abDownloadSketch;
  $('ab-calib').onclick = () => abSend(C.calibrate(), 'calibrate');
  $('ab-blackout').onchange = e => abSend(C.option('blackout', Math.max(0, Math.min(5000, Number(e.target.value) || 0))), 'blackout');
  box.onchange = async ev => { // pins, thresholds, the lane map
    const el = ev.target; if (!el || !el.dataset) return; const d = el.dataset;
    const pinOf = i => L.pins[i] || { role: 'N', index: 0, kind: 0 };
    if (d.pinrole !== undefined || d.pinindex !== undefined || d.pinkind !== undefined) {
      const i = Number(d.pinrole ?? d.pinindex ?? d.pinkind), p = { ...pinOf(i) };
      if (d.pinrole !== undefined) { p.role = el.value; if ((p.role === 'L' || p.role === 'P') && !p.index) p.index = i + 1; }
      if (d.pinindex !== undefined) p.index = Number(el.value); if (d.pinkind !== undefined) p.kind = Number(el.value);
      L.pins[i] = p; await abSend(C.pinRole(i, p.role, p.index, p.kind), `pin A${i}`); renderArduinoSettings(box);
    } else if (d.arm !== undefined || d.trig !== undefined) {
      const i = Number(d.arm ?? d.trig), p = { ...pinOf(i) }; if (d.arm !== undefined) p.arm = Number(el.value); else p.trig = Number(el.value);
      L.pins[i] = p; await abSend(C.thresholds(i, p.arm, p.trig), `thresholds A${i}`); abPinsRefresh();
    } else if (d.sensor !== undefined) {
      const map = ArduinoBox.swapLane(abSettings().laneMap, Number(d.sensor), Number(el.value)); await save({ abLaneMap: map }); L.setMap(map); renderArduinoSettings(box);
    }
  };
  const optChange = (id, key, read) => { const el = $(id); if (el) el.onchange = e => abSend(C.option(key, read(e.target)), key); };
  optChange('ab-lights', 'lights', e => e.value); optChange('ab-pixels', 'pixels', e => e.value); optChange('ab-bright', 'bright', e => e.value); optChange('ab-lanepix', 'lanepix', e => (e.checked ? 1 : 0));
  optChange('ab-relaync', 'relaync', e => e.value); optChange('ab-lanerelays', 'lanerelays', e => e.value); optChange('ab-lanerelaysnc', 'lanerelaysnc', e => e.value); optChange('ab-safeoff', 'safeoff', e => e.value);
  optChange('ab-buzzer', 'buzzer', e => (e.checked ? 1 : 0)); optChange('ab-ladder', 'ladder', e => (e.checked ? 1 : 0));
  $('ab-lighttest').onclick = async () => { for (const c of ['1', '2', '3', '4', '5']) { await abSend(C.lights(c), 'lights ' + c); await abSend(C.beep(1)); await new Promise(r => setTimeout(r, 700)); } await abSend(C.lights('G'), 'GO'); await abSend(C.beep(3)); setTimeout(() => abSend(C.lights('Y'), 'caution'), 1500); setTimeout(() => abSend(C.lights('S'), 'STOP'), 3000); };
  $('ab-pon').onclick = () => { abSend(C.mainPower(true), 'power on'); L.setPower(true); }; $('ab-poff').onclick = () => { abSend(C.mainPower(false), 'power off'); L.setPower(false); };
  $('ab-beep').onclick = () => abSend(C.beep(2), 'beep');
  $('ab-save').onclick = () => abSend(C.save(), 'save to the box');
  $('ab-hide').onchange = e => { ab.hide = e.target.checked; };
  $('ab-clear').onclick = () => { ab.lines = []; abShow(); };
  $('ab-copy').onclick = async () => { try { await navigator.clipboard.writeText(ab.lines.join('\n')); abMsg('Copied.'); } catch (x) { abMsg('Could not copy: ' + x.message); } };
  $('ab-save-log').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ab.lines.join('\r\n')], { type: 'text/plain' })); a.download = 'arduino-box-log.txt'; document.body.appendChild(a); a.click(); a.remove(); };
}
