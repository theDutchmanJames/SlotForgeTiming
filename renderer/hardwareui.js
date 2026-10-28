// Timing Hardware: the connection to the Trackmate (kept while the app runs, used by the race) and the App Settings screen for it.
// Settings kept: tmAuto (connect by itself), tmDevice ({ vid, pid } of the remembered USB device), tmNC (sensors normally closed), tmDeb (debounce 0-9), tmLanes (lanes used outside a race).
let hw = { kind: '', dev: null, info: {}, lines: [], open: false, baud: 9600, data: 8, parity: 'none', stop: 1, dtr: true, rts: true, hide: true, t0: 0, lit: Array(8).fill(null), ledTimers: [] };

const tmSettings = () => { const s = (typeof state !== 'undefined' && state.settings) || {}; return { auto: s.tmAuto !== false, nc: s.tmNC !== false, deb: s.tmDeb === undefined || s.tmDeb === '' ? 1 : Number(s.tmDeb), lanes: Number(s.tmLanes) || 2, device: s.tmDevice || null, relayNC: s.tmRelayNC === true }; };
// the check lights beside the sensors: a light is green while its sensor sends letters (a car is over it) and for a moment after
const LED_HOLD = 1000;
const tmLeds = () => {
  const on = Trackmate.ledsOn(hw.lit, performance.now(), LED_HOLD);
  on.forEach((v, i) => { const el = document.getElementById('hw-led-' + i); if (el) { el.classList.toggle('on', v); el.setAttribute('aria-label', `Sensor ${i + 1}: ${v ? 'triggered' : 'not triggered'}`); } });
  return on;
};
const tmLed = i => { hw.lit[i] = performance.now(); tmLeds(); clearTimeout(hw.ledTimers[i]); hw.ledTimers[i] = setTimeout(tmLeds, LED_HOLD + 30); };
const tmLog = (dir, bytes, note) => { hw.lines.push(Hardware.line(performance.now() - (hw.t0 || 0), dir, bytes, note)); if (hw.lines.length > 3000) hw.lines.splice(0, 500); tmShow(); };
const tmNote = text => { hw.lines.push('          ' + text); tmShow(); };
const tmShow = () => { const l = document.getElementById('hw-log'); if (l) { l.textContent = hw.lines.join('\n'); l.scrollTop = l.scrollHeight; } };
const tmMsg = t => { const m = document.getElementById('hw-msg'); if (m) m.textContent = t; };
const tmRedraw = () => { const b = document.getElementById('hwbox'); if (b && document.getElementById('hw-log') && typeof renderHardwareSettings === 'function') renderHardwareSettings(b); };
const tmSleep = ms => new Promise(r => setTimeout(r, ms));

// send commands to the device, one after the other
async function tmSend(list) {
  for (const b of list) {
    try { await hw.writer.write(b); tmLog('->', b, 'command'); } catch (x) { tmMsg('Could not send: ' + x.message); return false; }
    await tmSleep(60);
  }
  return true;
}
// switch the track power through the interface's relay
async function tmPower(on) { const ok = await tmSend([Hardware.trackmatePower(on, tmSettings().relayNC)]); if (ok) Trackmate.link.setPower(on); return ok; }
// the setup the Trackmate needs before it reports sensors: number of lanes, sensor type, debounce, start
let tmRaceLanes = 0; // the lanes of the race that is open: a reconnect or "Send setup now" during that race tells the interface those, not the Lanes of the settings
const tmUseLanes = n => { tmRaceLanes = Number(n) > 0 ? Number(n) : 0; };
const tmSetup = lanes => { const t = tmSettings(); return tmSend(Hardware.trackmateInit({ lanes: lanes || tmRaceLanes || t.lanes, closed: t.nc, debounce: t.deb })); };

// bytes from the port -> whole messages for the monitor, and race events through Trackmate.link
function tmReceive(bytes) {
  Trackmate.link.feed(bytes).forEach(e => {
    if (e.type === 'lane') tmLed(e.lane - 1);
    if (e.type === 'tick') {
      const steady = hw.prevTick === undefined || hw.prevTick === e.ms; hw.prevTick = e.ms;
      if (hw.hide !== false && steady) { const t = document.getElementById('hw-ticks'); if (t) t.textContent = `ticks received: ${Trackmate.link.ticks} (last ${e.ms} ms)`; return; }
      tmLog('<-', e.raw, `tick ${e.ms} ms`);
    } else if (e.type === 'call') {
      const n = performance.now(), gap = hw.prevCall === undefined ? '' : ` (${((n - hw.prevCall) / 1000).toFixed(2)} s after the previous press)`; hw.prevCall = n;
      tmLog('<-', e.raw, 'Trackcall button' + gap);
    } else tmLog('<-', e.raw, e.type === 'lane' ? `lane ${e.lane} sensor` : 'unknown');
  });
}
async function tmPollSignals() {
  const names = { clearToSend: 'CTS', dataSetReady: 'DSR', dataCarrierDetect: 'DCD', ringIndicator: 'RI' }; let last = null; const gen = hw.gen = (hw.gen || 0) + 1;
  const tick = async () => {
    if (!hw.open || hw.gen !== gen || hw.kind !== 'serial') return;
    try { const sg = await hw.dev.getSignals(), cur = Object.keys(names).map(k => `${names[k]}=${sg[k] ? 1 : 0}`).join(' '); if (cur !== last) { hw.lines.push(`${((performance.now() - hw.t0) / 1000).toFixed(3).padStart(9)}  LINES  ${cur}`); last = cur; tmShow(); } } catch (x) { /* port gone */ }
    setTimeout(tick, 50);
  };
  tick();
}
// open the chosen device. setup: also send the Trackmate setup (a COM port device only).
let tmOpening = false; // (one Connect at a time, as on the Arduino page)
async function tmOpen(setup) { if (tmOpening) return false; tmOpening = true; try { return await tmOpenNow(setup); } finally { tmOpening = false; } }
async function tmOpenNow(setup) {
  hw.prevTick = undefined; Trackmate.link.reset();
  try {
    hw.t0 = performance.now();
    if (hw.kind === 'serial') {
      await hw.dev.open({ baudRate: hw.baud, dataBits: hw.data, stopBits: hw.stop, parity: hw.parity, flowControl: 'none' });
      hw.open = true; tmNote(`-- connected to the COM port at ${hw.baud} baud, ${hw.data} data bits, parity ${hw.parity}, ${hw.stop} stop bit(s) --`);
      try { await hw.dev.setSignals({ dataTerminalReady: hw.dtr, requestToSend: hw.rts }); } catch (x) { /* not every port can */ }
      tmPollSignals(); hw.writer = hw.dev.writable ? hw.dev.writable.getWriter() : null;
      Trackmate.link.setConnected(true);
      (async () => { // read until disconnected
        while (hw.open && hw.dev.readable) {
          hw.reader = hw.dev.readable.getReader();
          try { for (;;) { const { value, done } = await hw.reader.read(); if (done) break; if (value && value.length) tmReceive(value); } }
          catch (x) { hw.lines.push(`${((performance.now() - hw.t0) / 1000).toFixed(3).padStart(9)}  ERROR  ${x.message}`); tmShow(); } finally { hw.reader.releaseLock(); }
        }
        if (hw.open) { hw.open = false; Trackmate.link.setConnected(false); tmNote('-- the device went away --'); try { if (hw.writer) { hw.writer.releaseLock(); hw.writer = null; } await hw.dev.close(); } catch (x) { /* it is gone */ } tmRedraw(); } // (the port is let go, so that Connect works again when the cable is back)
      })();
      if (setup) await tmSetup();
    } else {
      await hw.dev.open(); hw.open = true; tmNote('-- connected to the USB device --');
      (hw.dev.collections || []).forEach(c => tmNote(`   collection: usage page ${c.usagePage} usage ${c.usage}, input reports: ${(c.inputReports || []).map(r => r.reportId).join(',') || 'none'}`));
      hw.dev.oninputreport = e => tmLog('<-', new Uint8Array(e.data.buffer, e.data.byteOffset, e.data.byteLength), `report ${e.reportId}`);
    }
    return true;
  } catch (x) { hw.open = false; Trackmate.link.setConnected(false); tmMsg('Could not connect: ' + x.message + (hw.kind === 'serial' ? ' (is another program using this port?)' : '')); return false; }
}
async function tmClose() {
  hw.open = false; Trackmate.link.setConnected(false);
  try { if (hw.kind === 'serial') { if (hw.reader) await hw.reader.cancel().catch(() => {}); if (hw.writer) { hw.writer.releaseLock(); hw.writer = null; } await hw.dev.close(); } else { hw.dev.oninputreport = null; await hw.dev.close(); } } catch (x) { /* already closed */ }
  tmNote('-- disconnected --');
}
// at startup: reconnect to the remembered device if it is plugged in. Never shows a window; quietly does nothing if anything is missing.
async function tmAutoConnect() {
  try {
    const t = tmSettings(); if (!t.auto || !t.device || typeof navigator === 'undefined' || !navigator.serial || hw.open || Hardware.timingChosen(state.settings) !== 'trackmate') return false; // (only the timing hardware in use connects by itself)
    const ports = await navigator.serial.getPorts();
    const port = ports.find(p => { const i = p.getInfo ? p.getInfo() : {}; return i.usbVendorId === t.device.vid && i.usbProductId === t.device.pid; });
    if (!port) return false;
    hw.kind = 'serial'; hw.dev = port; hw.info = port.getInfo(); hw.baud = 9600; hw.data = 8; hw.parity = 'none'; hw.stop = 1;
    return await tmOpen(true);
  } catch (x) { return false; }
}

function renderHardwareSettings(box) {
  const laneMap = Trackmate.laneMap(state.settings.tmLaneMap), H = Hardware, can = { serial: typeof navigator !== 'undefined' && !!navigator.serial, hid: typeof navigator !== 'undefined' && !!navigator.hid }, t = tmSettings();
  // one block per sensor (1 to 8): its check light, its name and the lane it counts for. Sensors beyond the number of lanes are switched off in the Trackmate, so they are dimmed.
  const lanesOn = Math.max(1, Math.min(8, t.lanes)), litNow = Trackmate.ledsOn(hw.lit, performance.now(), LED_HOLD);
  const sensors = Array.from({ length: 8 }, (_, i) => {
    const on = i < lanesOn, last = on ? Math.max(lanesOn - 1, laneMap[i]) : laneMap[i];
    const opts = Array.from({ length: last + 1 }, (_, l) => l).filter(l => on || l === laneMap[i]).map(l => `<option value="${l}"${laneMap[i] === l ? ' selected' : ''}>Lane ${l + 1}</option>`).join('');
    return `<div class="tm-sensor${on ? '' : ' off'}"${on ? '' : ` title="Switched off: Lanes above is ${lanesOn}. Raise it to use this sensor."`}><span class="led${litNow[i] ? ' on' : ''}" id="hw-led-${i}" role="img" aria-label="Sensor ${i + 1}: ${litNow[i] ? 'triggered' : 'not triggered'}"></span>` +
      `<span><b>Sensor ${i + 1} · ${String.fromCharCode(65 + i)}</b><small>${on ? 'Pass a car to test this sensor' : 'Switched off by the lane count'}</small></span><select data-sensor="${i}" aria-label="Lane of sensor ${i + 1}"${on ? '' : ' disabled'}>${opts}</select></div>`;
  }).join('');
  const bauds = [300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600, 1000000];
  box.innerHTML = `<section class="tm-setup" aria-label="Trackmate Interface setup"><div class="tm-frame"><header class="tm-header"><div class="tm-tile" aria-hidden="true">⌁</div><div class="tm-heading"><div class="tm-eyebrow">Timing interface</div><h2>Trackmate Interface</h2><div class="tm-pills"><span>USB serial</span><span>${esc(t.lanes)} ${t.lanes === 1 ? 'lane' : 'lanes'}</span><span>${t.nc ? 'Normally closed sensors' : 'Normally open sensors'}</span></div></div><div class="tm-headerstate"><i class="tm-dot${hw.open ? ' on' : ''}" aria-hidden="true"></i>${hw.open ? 'Connected' : 'Not connected'}</div></header><div class="tm-body"><nav class="tm-rail" aria-label="Trackmate sections"><div class="tm-railcap">Set up the interface</div><button type="button" class="tm-nav active" data-tm-go="connection"><i aria-hidden="true">⌁</i><span><b>Connection</b><small>${hw.dev ? esc(H.describe(hw.kind, hw.info)) : 'Choose and remember a COM port'}</small></span><em class="tm-dot${hw.open ? ' on' : ''}" aria-hidden="true"></em></button><button type="button" class="tm-nav" data-tm-go="sensors"><i aria-hidden="true">◉</i><span><b>Lane sensors</b><small>${esc(t.lanes)} lanes · ${t.nc ? 'normally closed' : 'normally open'}</small></span><em class="tm-dot on" aria-hidden="true"></em></button><button type="button" class="tm-nav" data-tm-go="monitor"><i aria-hidden="true">⌁</i><span><b>Live monitor</b><small>${hw.open ? 'Check the sensor lights' : 'Waiting for a connection'}</small></span><em class="tm-dot${hw.open ? ' on' : ''}" aria-hidden="true"></em></button><div class="tm-railcap tm-optional">Only if you need it</div><button type="button" class="tm-nav" data-tm-go="power"><i aria-hidden="true">ϟ</i><span><b>Track power</b><small>Relay control</small></span><em class="tm-dot" aria-hidden="true"></em></button><button type="button" class="tm-nav" data-tm-go="advanced"><i aria-hidden="true">⚙</i><span><b>Advanced connection</b><small>Serial settings and log</small></span><em class="tm-dot" aria-hidden="true"></em></button><aside class="tm-railhelp"><b>Before connecting</b><p>Connect the Trackmate before a race. Sensor lights let you test cables without recording a lap.</p></aside></nav><main class="tm-main"><div class="tm-say"><i aria-hidden="true">▸</i><div><div class="tm-eyebrow">In plain words</div><p>Plug the Trackmate in, choose its COM port, then tell it how many lane sensors you use. Its Trackcall button follows the behaviour chosen in Race Setup. Pit entry uses <em>Sensor must be blocked for this long to start a pit stop</em> under Race Setup &gt; Race Settings. With Service Stop off, the car leaves the pits when it drives off the sensor; with it on, the stop stays active while you remove the car for service.</p></div></div><details class="tm-section" data-tm-section="connection" open><summary><i aria-hidden="true">⌁</i><strong>Connection</strong><span>Find the interface, then connect</span><b aria-hidden="true">⌃</b></summary><div class="tm-content">
    <div class="row"><button class="btn primary" id="hw-serial" ${can.serial ? '' : 'disabled'}>Find the Trackmate (COM port)</button>
      <button class="btn primary" id="hw-conn" ${hw.dev ? '' : 'disabled'}>${hw.open ? 'Disconnect' : 'Connect'}</button>
      <span id="hw-dev" class="muted">${hw.dev ? esc(H.describe(hw.kind, hw.info)) + (hw.open ? ' is connected' : '') : 'No device chosen.'}</span><span id="hw-msg" class="muted" role="status"></span></div>
    <div id="hw-pick"></div>
    <div class="row"><label class="inline"><input type="checkbox" id="hw-auto" ${t.auto ? 'checked' : ''}> Remember this device and connect automatically when the app starts</label></div></div></details>
    <details class="tm-section" data-tm-section="sensors" open><summary><i aria-hidden="true">◉</i><strong>Lane sensors</strong><span>${esc(t.lanes)} lanes · ${t.nc ? 'normally closed' : 'normally open'}</span><b aria-hidden="true">⌃</b></summary><div class="tm-content"><div class="row"><strong>Trackmate setup</strong><label>Lanes (outside a race; a race uses its track's lanes) <input type="number" id="hw-lanes" min="1" max="8" value="${esc(t.lanes)}" style="width:4em"></label>
      <label>Sensors <select id="hw-nc"><option value="1"${t.nc ? ' selected' : ''}>normally closed</option><option value="0"${t.nc ? '' : ' selected'}>normally open</option></select></label>
      <label>Debounce (0-9) <input type="number" id="hw-deb" min="0" max="9" value="${esc(t.deb)}" style="width:4em"></label>
      <button class="btn" id="hw-init" ${hw.open ? '' : 'disabled'}>Send setup now</button></div>
    <div class="row"><strong>Sensors</strong></div>
    <div class="tm-sensors">${sensors}</div>
    <p class="muted">The light beside a sensor turns green while a car is over it, so you can test a sensor and its cable without starting a race. The lane choice says which lane the sensor counts for: use it when the sensor leads are plugged into the other lane, swapping two sensors here is quicker than changing the cables.</p>
    <p class="muted">All eight sensors (A to H) are supported. The Trackmate only reports as many sensors as <em>Lanes</em> above (a race uses the lanes of its track), so set it to the number of sensors you have connected; the others are dimmed.</p>
    <p class="muted">The setup is sent every time the app connects and when a race opens. Change the sensor type if laps do not register.</p></div></details>
    <details class="tm-section" data-tm-section="monitor"><summary><i aria-hidden="true">⌁</i><strong>Live monitor</strong><span>Check what each sensor reports</span><b aria-hidden="true">⌄</b></summary><div class="tm-content"><div class="tm-monitor"><i class="tm-dot${hw.open ? ' on' : ''}" aria-hidden="true"></i><div><strong>${hw.open ? 'Sensor lights are live' : 'Connect to begin monitoring'}</strong><small>The lights in Lane sensors turn green while a car is over a sensor. This tests the hardware without recording a lap.</small></div></div><p class="hint">Detailed incoming bytes, command history and a downloadable log are in Advanced connection.</p></div></details>
    <details class="tm-section" data-tm-section="power"><summary><i aria-hidden="true">ϟ</i><strong>Track power</strong><span>Relay control</span><b aria-hidden="true">⌄</b></summary><div class="tm-content"><div class="tm-power"><div><strong>Track power relay</strong><small>Only use this if a suitable relay circuit is connected to the Trackmate.</small></div><div class="tm-actions"><button class="btn" id="hw-pon" ${hw.open ? '' : 'disabled'}>Power on</button><button class="btn" id="hw-poff" ${hw.open ? '' : 'disabled'}>Power off</button></div></div><label>Power relay <select id="hw-relay"><option value="0"${t.relayNC ? '' : ' selected'}>Normally open</option><option value="1"${t.relayNC ? ' selected' : ''}>Normally closed</option></select><small>If Power on switches the track off, use the other relay setting.</small></label></div></details>
    <details class="tm-section" data-tm-section="advanced"><summary><i aria-hidden="true">⚙</i><strong>Advanced connection</strong><span>Serial settings and data log</span><b aria-hidden="true">⌄</b></summary><div class="tm-content">
      <div class="row"><button class="btn" id="hw-hid" ${can.hid ? '' : 'disabled'}>Find a USB (HID) device</button>
        <label>Speed (baud) <select id="hw-baud">${bauds.map(b => `<option${b === hw.baud ? ' selected' : ''}>${b}</option>`).join('')}</select></label>
        <label>Data bits <select id="hw-data">${[7, 8].map(b => `<option${b === hw.data ? ' selected' : ''}>${b}</option>`).join('')}</select></label>
        <label>Parity <select id="hw-parity">${['none', 'even', 'odd'].map(b => `<option${b === hw.parity ? ' selected' : ''}>${b}</option>`).join('')}</select></label>
        <label>Stop bits <select id="hw-stop">${[1, 2].map(b => `<option${b === hw.stop ? ' selected' : ''}>${b}</option>`).join('')}</select></label>
        <label class="inline"><input type="checkbox" id="hw-dtr" ${hw.dtr ? 'checked' : ''}> DTR on</label><label class="inline"><input type="checkbox" id="hw-rts" ${hw.rts ? 'checked' : ''}> RTS on</label></div>
      <div class="row"><label>Send bytes (hex, e.g. 01 02 FF) <input type="text" id="hw-send" style="width:14em"></label><button class="btn" id="hw-sendbtn" ${hw.open ? '' : 'disabled'}>Send</button>
        <label class="inline"><input type="checkbox" id="hw-hide" ${hw.hide === false ? '' : 'checked'}> Hide the steady 200 ms ticks</label><span id="hw-ticks" class="muted"></span>
        <button class="btn" id="hw-copy">Copy log</button><button class="btn" id="hw-save">Save log</button><button class="btn" id="hw-clear">Clear</button></div><pre id="hw-log" class="hwlog tm-log" tabindex="0" aria-label="Data received from the device"></pre></div></details></main></div></div></section>`;
  const $ = id => document.getElementById(id), save = patch => api.setSettings(patch).then(s => { state.settings = s; });
  tmShow();
  if (box.querySelectorAll) box.querySelectorAll('[data-tm-go]').forEach(button => {
    button.onclick = () => {
      const id = button.dataset.tmGo, section = box.querySelector(`[data-tm-section="${id}"]`); if (!section) return;
      section.open = true;
      box.querySelectorAll('[data-tm-go]').forEach(item => item.classList.toggle('active', item === button));
      section.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };
  });

  // the main process lists the devices it found; the user picks one here
  const choose = list => new Promise(res => {
    const el = $('hw-pick'); if (!el) return res('');
    el.innerHTML = `<div class="card"><strong>Choose a device</strong>${list.length ? list.map((d, i) => `<div class="row"><button class="btn" data-pick="${i}">${esc(d.displayName || d.name || d.deviceName || d.portName || d.productName || 'Device')} <span class="muted">${esc(d.portName || '')} ${d.vendorId !== undefined ? '(' + H.hex4(d.vendorId) + ':' + H.hex4(d.productId) + ')' : ''}</span></button></div>`).join('') : '<p class="muted">No devices found. Check the cable.</p>'}<button class="btn" data-pick="-1">Cancel</button></div>`;
    el.onclick = ev => { const b = ev.target.closest('[data-pick]'); if (!b) return; const i = Number(b.dataset.pick); el.innerHTML = ''; res(i >= 0 && list[i] ? list[i].portId || list[i].deviceId : ''); };
  });
  if (api.onHwChoose) api.onHwChoose(async (_kind, list) => { api.hwChosen(await choose(list)); });

  const find = async kind => {
    try {
      let dev = null, info = {};
      if (kind === 'serial') { dev = await navigator.serial.requestPort(); info = dev.getInfo ? dev.getInfo() : {}; }
      else { const l = await navigator.hid.requestDevice({ filters: [] }); dev = l[0] || null; info = dev ? { vendorId: dev.vendorId, productId: dev.productId, productName: dev.productName } : {}; }
      if (!dev) return tmMsg('No device chosen.');
      if (hw.open) await tmClose(); // (a new choice while connected: the old connection is closed first, not left open behind the new one)
      hw.dev = dev; hw.info = info;
      hw.kind = kind;
      if (kind === 'serial' && hw.info.usbVendorId !== undefined) await save({ tmDevice: { vid: hw.info.usbVendorId, pid: hw.info.usbProductId } }); // remembered for the next start
      if (kind === 'serial') { hw.baud = 9600; hw.data = 8; hw.parity = 'none'; hw.stop = 1; }
      renderHardwareSettings(box);
    } catch (x) { tmMsg(x.name === 'NotFoundError' ? 'No device chosen.' : 'Could not find a device: ' + x.message); }
  };
  $('hw-serial').onclick = () => find('serial'); $('hw-hid').onclick = () => find('hid');
  $('hw-conn').onclick = async () => { if (hw.open) await tmClose(); else await tmOpen(hw.kind === 'serial'); renderHardwareSettings(box); };
  $('hw-auto').onchange = e => save({ tmAuto: e.target.checked });
  $('hw-lanes').onchange = async e => { await save({ tmLanes: Math.max(1, Math.min(8, Math.round(Number(e.target.value)) || 2)) }); if (hw.open && hw.kind === 'serial') await tmSetup(); renderHardwareSettings(box); }; // a connected Trackmate hears the new number of lanes at once
  $('hw-nc').onchange = e => save({ tmNC: e.target.value === '1' });
  $('hw-deb').onchange = e => save({ tmDeb: Math.max(0, Math.min(9, Math.round(Number(e.target.value)) || 0)) });
  box.onchange = async ev => { // a sensor gets another lane
    const t = ev.target; if (!t || !t.dataset || t.dataset.sensor === undefined) return;
    await save({ tmLaneMap: Trackmate.swapLane(Trackmate.laneMap(state.settings.tmLaneMap), Number(t.dataset.sensor), Number(t.value)) }); renderHardwareSettings(box);
  };
  $('hw-init').onclick = () => tmSetup();
  $('hw-pon').onclick = () => tmPower(true); $('hw-poff').onclick = () => tmPower(false);
  $('hw-relay').onchange = e => save({ tmRelayNC: e.target.value === '1' });
  $('hw-baud').onchange = e => { hw.baud = Number(e.target.value); };
  $('hw-data').onchange = e => { hw.data = Number(e.target.value); }; $('hw-parity').onchange = e => { hw.parity = e.target.value; }; $('hw-stop').onchange = e => { hw.stop = Number(e.target.value); };
  const setSig = async () => { if (hw.open && hw.kind === 'serial') { try { await hw.dev.setSignals({ dataTerminalReady: hw.dtr, requestToSend: hw.rts }); tmNote(`-- DTR ${hw.dtr ? 'on' : 'off'}, RTS ${hw.rts ? 'on' : 'off'} --`); } catch (x) { tmMsg('Could not set the signals: ' + x.message); } } };
  $('hw-dtr').onchange = e => { hw.dtr = e.target.checked; setSig(); }; $('hw-rts').onchange = e => { hw.rts = e.target.checked; setSig(); };
  $('hw-sendbtn').onclick = async () => {
    const b = H.parseHex($('hw-send').value); if (!b) return tmMsg('Type bytes as hex, for example 01 02 FF.');
    try { if (hw.kind === 'serial') await hw.writer.write(b); else await hw.dev.sendReport(b[0], b.slice(1)); tmLog('->', b); tmMsg(''); } catch (x) { tmMsg('Could not send: ' + x.message); }
  };
  $('hw-hide').onchange = e => { hw.hide = e.target.checked; };
  $('hw-clear').onclick = () => { hw.lines = []; tmShow(); };
  $('hw-copy').onclick = async () => { try { await navigator.clipboard.writeText(hw.lines.join('\n')); tmMsg('Copied.'); } catch (x) { tmMsg('Could not copy: ' + x.message); } };
  $('hw-save').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([hw.lines.join('\r\n')], { type: 'text/plain' })); a.download = 'trackmate-log.txt'; document.body.appendChild(a); a.click(); a.remove(); };
}
// Arduino and DS share the Trackmate page frame. This only arranges controls;
// connection state, serial traffic and settings remain owned by their pages.
const HardwarePage = (() => {
  const views = new Map();
  function view(key) {
    if (!views.has(key)) views.set(key, { active: 'connection', open: {} });
    return views.get(key);
  }
  function html(o) {
    const v = view(o.key);
    const nav = o.sections.map(s => `${s.optional ? '<div class="tm-railcap tm-optional">Only if you need it</div>' : ''}<button type="button" class="tm-nav${v.active === s.id ? ' active' : ''}" data-interface-go="${s.id}" aria-controls="${o.key}-${s.id}-section"${v.active === s.id ? ' aria-current="true"' : ''}><i aria-hidden="true">${s.icon}</i><span><b>${esc(s.title)}</b><small>${esc(s.note)}</small></span><em class="tm-dot${s.ready ? ' on' : ''}" aria-hidden="true"></em></button>`).join('');
    const sections = o.sections.map(s => `<details class="tm-section" id="${o.key}-${s.id}-section" data-interface-section="${s.id}"${(v.open[s.id] ?? s.open ?? false) ? ' open' : ''}><summary><i aria-hidden="true">${s.icon}</i><strong>${esc(s.title)}</strong><span>${esc(s.note)}</span><b aria-hidden="true">⌄</b></summary><div class="tm-content">${s.body}</div></details>`).join('');
    return `<section class="tm-setup interface-setup ${o.key}-setup" aria-label="${esc(o.title)} setup"><div class="tm-frame"><header class="tm-header"><div class="tm-tile" aria-hidden="true">${o.icon}</div><div class="tm-heading"><div class="tm-eyebrow">${esc(o.eyebrow || 'Timing interface')}</div><h2>${esc(o.title)}</h2><div class="tm-pills">${o.pills.map(p => `<span>${esc(p)}</span>`).join('')}</div></div><div class="tm-headerstate" role="status"><i class="tm-dot${o.connected ? ' on' : ''}" aria-hidden="true"></i>${esc(o.status)}</div></header><div class="tm-body"><nav class="tm-rail" aria-label="${esc(o.title)} sections"><div class="tm-railcap">${esc(o.railTitle || 'Set up the interface')}</div>${nav}<aside class="tm-railhelp"><b>${esc(o.helpTitle)}</b><p>${esc(o.help)}</p></aside></nav><main class="tm-main"><div class="tm-say"><i aria-hidden="true">▸</i><div><div class="tm-eyebrow">In plain words</div><p>${o.description}</p></div></div>${sections}</main></div>${o.footer ? `<footer class="interface-footer">${o.footer}</footer>` : ''}</div></section>`;
  }
  function bind(box, key) {
    const v = view(key), sections = [], buttons = [];
    box.querySelectorAll('[data-interface-section]').forEach(s => sections.push(s));
    box.querySelectorAll('[data-interface-go]').forEach(b => buttons.push(b));
    const highlight = id => {
      v.active = id;
      buttons.forEach(b => { const active = b.dataset.interfaceGo === id; b.classList.toggle('active', active); if (active) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
    };
    sections.forEach(section => {
      section.querySelector('summary').onclick = () => {
        v.open[section.dataset.interfaceSection] = !section.open;
        if (!section.open) highlight(section.dataset.interfaceSection);
      };
      section.ontoggle = () => {
        if (!section.isConnected) return;
        v.open[section.dataset.interfaceSection] = section.open;
        if (!section.open && v.active === section.dataset.interfaceSection) highlight(sections.find(s => s.open)?.dataset.interfaceSection || '');
      };
    });
    buttons.forEach(b => { b.onclick = () => {
      const section = sections.find(s => s.dataset.interfaceSection === b.dataset.interfaceGo);
      if (!section) return;
      section.open = true; v.open[b.dataset.interfaceGo] = true; highlight(b.dataset.interfaceGo);
      section.scrollIntoView({ block: 'start', behavior: 'auto' });
      section.querySelector('summary')?.focus({ preventScroll: true });
    }; });
  }
  return { html, bind };
})();
