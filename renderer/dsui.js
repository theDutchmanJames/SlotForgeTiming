// DS-200/DS-300 race timing and passive capture diagnostics for other DS models.
// No protocol commands are sent. Timing remains the race controller.
// Setting kept: dsType (the model that was chosen). The serial settings are only kept while the app runs.
let dsc = { dev: null, info: {}, open: false, lines: [], t0: 0, bytes: 0, pieces: 0, last: null, cfg: Hardware.serialConfig(), gen: 0, omitted: 0, message: '', capture: null };

const DSC_SHOWN = 500, DSC_KEPT = 20000; // lines shown on the page; lines kept for saving (the oldest go first)
const dscType = () => { const t = (typeof state !== 'undefined' && state.settings && state.settings.dsType) || ''; return Hardware.DS_TYPES.some(d => d[0] === t) ? t : ''; };
const dscSecs = () => ((performance.now() - dsc.t0) / 1000).toFixed(3).padStart(9);
const dscShow = () => { const l = document.getElementById('ds-log'); if (l) { l.textContent = dsc.lines.slice(-DSC_SHOWN).join('\n'); l.scrollTop = l.scrollHeight; } };
// Serial traffic must not rebuild the entire monitor for every incoming chunk.
let dscPaint = null;
const dscRefresh = () => { if (dscPaint === null) dscPaint = setTimeout(() => { dscPaint = null; dscShow(); dscStats(); }, 100); };
const dscPush = text => { dsc.lines.push(text); if (dsc.lines.length > DSC_KEPT) dsc.omitted += dsc.lines.splice(0, 2000).length; dscRefresh(); };
const dscLog = bytes => { const ms = performance.now() - dsc.t0; for (let i = 0; i < bytes.length; i += 64) dscPush(Hardware.line(ms, '<-', bytes.slice(i, i + 64))); };
const dscNote = text => dscPush('          ' + text);
const dscMsg = t => { dsc.message = t; const m = document.getElementById('ds-msg'); if (m) m.textContent = t; };
const dscStatsText = () => !dsc.open ? (dsc.pieces ? `Last connection: ${dsc.bytes} byte(s) received in ${dsc.pieces} piece(s).` : '')
  : dsc.pieces ? `Received: ${dsc.bytes} byte(s) in ${dsc.pieces} piece(s). The last one came ${(dsc.last / 1000).toFixed(1)} s after connecting.` : 'Connected. No data yet: check the serial settings and pass a car over a sensor.';
const dscStats = () => { const e = document.getElementById('ds-stats'); if (e) e.textContent = dscStatsText() + (DsTiming.link.connected ? ' Decoded packets: ' + DsTiming.link.packets + '; rejected frames: ' + DsTiming.link.rejected + '.' : ''); };
const dscRedraw = () => { const b = document.getElementById('hwbox'); if (b && document.getElementById('ds-log') && typeof renderDsSettings === 'function') renderDsSettings(b); };

// A read error (a wrong speed gives framing errors, over and over): the same error in a row is one line with a count
function dscError(msg) {
  const e = dsc.err, lastLine = dsc.lines[dsc.lines.length - 1];
  if (e && e.msg === msg && lastLine === e.text) { e.n++; e.text = `${e.at}  ERROR  ${msg}  (${e.n} times)`; dsc.lines[dsc.lines.length - 1] = e.text; dscRefresh(); return; }
  const at = dscSecs(); dsc.err = { msg, n: 1, at, text: `${at}  ERROR  ${msg}` }; dscPush(dsc.err.text);
}
function dscReceive(bytes) { dsc.bytes += bytes.length; dsc.pieces++; dsc.last = performance.now() - dsc.t0; dscLog(bytes); DsTiming.link.feed(bytes); }

// the control lines (CTS, DSR, DCD, RI) are written to the log whenever one of them changes: some units signal with them
async function dscPoll() {
  const names = { clearToSend: 'CTS', dataSetReady: 'DSR', dataCarrierDetect: 'DCD', ringIndicator: 'RI' }; let last = null; const gen = dsc.gen, dev = dsc.dev;
  const tick = async () => {
    if (!dsc.open || dsc.gen !== gen) return;
    try { const sg = await dev.getSignals(); if (!dsc.open || dsc.gen !== gen) return; const cur = Object.keys(names).map(k => `${names[k]}=${sg[k] ? 1 : 0}`).join(' '); if (cur !== last) { dscPush(`${dscSecs()}  LINES  ${cur}`); last = cur; } } catch (x) { /* port gone */ }
    if (dsc.open && dsc.gen === gen) setTimeout(tick, 100);
  };
  tick();
}

// connect and listen. Nothing is written to the port.
let dscOpening = false, dscClosing = false, dscFinding = false, dscSaving = false;
async function dscReleasePort(dev) {
  dsc.needsClose = dev;
  try { await dev.close(); dsc.needsClose = null; return true; }
  catch (x) { dscMsg('Could not close the port: ' + x.message + '. Use Retry disconnect before reconnecting.'); return false; }
}
async function dscOpen() { if (dscOpening || dscClosing || dscFinding || dscSaving || dsc.needsClose || dsc.open) return false; dscOpening = true; dscRedraw(); try { return await dscOpenNow(); } finally { dscOpening = false; dscRedraw(); } }
async function dscOpenNow() {
  if (!dsc.dev || !dscType()) return false;
  const c = dsc.cfg = Hardware.serialConfig(dsc.cfg); dsc.bytes = 0; dsc.pieces = 0; dsc.last = null;
  const dev = dsc.dev, type = dscType(), info = { ...dsc.info }; let opened = false;
  dscMsg('');
  try {
    dsc.t0 = performance.now();
    await dev.open({ baudRate: c.baud, dataBits: c.data, stopBits: c.stop, parity: c.parity, flowControl: 'none' }); opened = true;
    dsc.open = true; dsc.gen++; DsTiming.link.setConnected(true, type); dsc.capture = { type, info, cfg: { ...c } }; dsc.err = null;
    dscNote(`-- connected to ${Hardware.dsTypeName(type)} / ${Hardware.describe('serial', info)} at ${c.baud} baud, ${c.data} data bits, parity ${c.parity}, ${c.stop} stop bit(s), DTR ${c.dtr ? 'on' : 'off'}, RTS ${c.rts ? 'on' : 'off'} --`);
    try { await dev.setSignals({ dataTerminalReady: c.dtr, requestToSend: c.rts }); } catch (x) { dscError('Could not set DTR/RTS: ' + x.message); }
    dscPoll();
    dsc.loop = (async () => { // read until disconnected
      try {
        while (dsc.open && dev.readable) {
          const stream = dev.readable, reader = stream.getReader(); dsc.reader = reader;
          try { for (;;) { const { value, done } = await reader.read(); if (done) break; if (dsc.open && value && value.length) dscReceive(value); } }
          catch (x) { dscError(x.name ? `${x.name}: ${x.message}` : x.message); }
          finally { reader.releaseLock(); dsc.reader = null; }
          if (dev.readable === stream) break;
        }
      } catch (x) { dscError('Read failed: ' + x.message); }
      if (dsc.open) {
        dsc.open = false; dsc.gen++; DsTiming.link.setConnected(false); dscClosing = true;
        dscNote('-- receive stream ended --');
        try { if (await dscReleasePort(dev)) dscNote('-- connection closed --'); }
        finally { dscClosing = false; dscRedraw(); }
      }
    })();
    return true;
  } catch (x) { dsc.open = false; dsc.gen++; DsTiming.link.setConnected(false); if (opened) await dscReleasePort(dev); if (!dsc.needsClose) dscMsg('Could not connect: ' + x.message + ' (is another program using this port? Close PC Lap Counter, Race Coordinator and other timing programs first.)'); return false; }
}
async function dscClose() {
  if (dscOpening || dscClosing || (!dsc.open && !dsc.needsClose)) return;
  const dev = dsc.needsClose || dsc.dev;
  dscClosing = true; dsc.open = false; dsc.gen++; DsTiming.link.setConnected(false); dscRedraw();
  try { if (dsc.reader) await dsc.reader.cancel().catch(() => {}); if (dsc.loop) await dsc.loop; if (await dscReleasePort(dev)) dscMsg(''); } catch (x) { dsc.needsClose = dev; dscMsg('Could not close the port: ' + x.message + '. Use Retry disconnect.'); }
  finally { dscClosing = false; dsc.reader = null; dsc.loop = null; }
  dscNote(`-- ${dsc.needsClose ? 'receive stopped; port close needs retry' : 'disconnected'}: ${dsc.bytes} byte(s) received in ${dsc.pieces} piece(s) --`);
  dscRedraw();
}

function renderDsSettings(box) {
  const H = Hardware, can = typeof navigator !== 'undefined' && !!navigator.serial, type = dscType(), c = dsc.cfg, $ = id => document.getElementById(id), save = patch => api.setSettings(patch).then(s => { state.settings = s; });
  const busy = dscOpening || dscClosing || dscFinding || dscSaving, off = dsc.open || dsc.needsClose || busy ? ' disabled' : '', guidance = H.dsGuidance(type);
  const sel = (id, label, list, cur) => `<label>${label} <select id="${id}"${off}>${list.map(v => `<option${v === cur ? ' selected' : ''}>${v}</option>`).join('')}</select></label>`;
  const connectionBody = `<div class="row interface-models" role="radiogroup" aria-label="Model of the DS unit"><strong>Unit</strong>${H.DS_TYPES.map(([id, name]) => `<label class="inline" style="white-space:nowrap"><input type="radio" name="dstype" value="${id}"${type === id ? ' checked' : ''}${off}> ${name}</label>`).join('')}</div>
    <div class="row"><button class="btn primary" id="ds-find" ${can && !dsc.open && !dsc.needsClose && !busy ? '' : 'disabled'}>Find the DS interface (COM port)</button>
      <button class="btn primary" id="ds-conn" ${dsc.dev && (type || dsc.needsClose) && !busy ? '' : 'disabled'}>${busy ? 'Please wait…' : dsc.needsClose ? 'Retry disconnect' : dsc.open ? 'Disconnect' : 'Connect'}</button>
      <span class="led${dsc.open ? ' on' : ''}" id="ds-led" role="img" aria-label="Connection: ${dsc.open ? 'connected' : 'not connected'}"></span>
      <span id="ds-dev" class="muted">${dsc.dev ? (dsc.open && type ? esc(H.dsTypeName(type)) + ' on ' : '') + esc(H.describe('serial', dsc.info)) + (dsc.open ? ' is connected' : '') : can ? 'No port chosen.' : 'COM ports can only be used in the desktop app.'}${dsc.dev && !type ? ' Choose the model above to connect.' : ''}</span><span id="ds-msg" class="muted" role="status"></span></div>
    <div id="ds-pick"></div>`;
  const serialBody = `<div class="interface-fields">${sel('ds-baud', 'Speed (baud)', H.BAUDS, c.baud)}${sel('ds-data', 'Data bits', [7, 8], c.data)}${sel('ds-parity', 'Parity', ['none', 'even', 'odd'], c.parity)}${sel('ds-stop', 'Stop bits', [1, 2], c.stop)}
      <label class="inline"><input type="checkbox" id="ds-dtr" ${c.dtr ? 'checked' : ''}${busy ? ' disabled' : ''}> DTR on</label><label class="inline"><input type="checkbox" id="ds-rts" ${c.rts ? 'checked' : ''}${busy ? ' disabled' : ''}> RTS on</label></div>
    <p class="muted">${esc(guidance.text)}</p>${guidance.baud ? `<button class="btn" id="ds-preset"${off}>Use ${guidance.baud} baud · 8N1</button>` : ''}
    <p class="muted">Model selection does not change your serial settings. The button above, when available, applies a reference starting point. DTR and RTS change control lines, not protocol commands. Disconnect before changing speed, data bits, parity or stop bits.</p>`;
  const guideBody = `<ol class="muted">
      <li>Switch the DS unit on, connect its serial cable to the computer and connect the lane sensors.</li>
      <li>Choose the model above, press <em>Find the DS interface</em>, choose the port, then press <em>Connect</em>. The light turns green. Close other timing programs first: only one program can use a COM port.</li>
      <li>Before each thing you do, type a note below and press <em>Add note</em>, then do it. For example: <em>lane 1: car over the sensor</em>, then lane 2 and so on for every lane. Let a car pass a few times so there are several laps. Press the buttons of the unit one at a time (start, stop and so on) with a note for each.</li>
      <li>If the unit shows times on its own display, add a note with what it shows (for example <em>display lane 1: 7.35</em>). That is the best way to find out how times are sent.</li>
      <li>If nothing appears, check your cable, model and the speed guidance in <em>Serial settings</em>. Framing errors can indicate a wrong speed. Dots in the text column are normal for binary data; use the hex bytes to compare captures. For a DS-200 / DS-300, press a box button or pass a car over a sensor after connecting.</li>
      <li>To compare with PC Lap Counter, close Timing’s connection first, then open the matching DS interface and its <em>Debug</em> window. Capture the same sensor passes, displayed lap times and start / pause / resume / stop actions. Save both logs separately; their formats differ. A green COM connection in Timing does not mean protocol synchronization or valid laps.</li>
      <li>Press <em>Save log</em> and send the file.</li></ol>`;
  const monitorBody = `<div class="row"><label>Note for the log <input type="text" id="ds-note" maxlength="200" ${dsc.open ? '' : 'disabled'}></label><button class="btn" id="ds-addnote" ${dsc.open ? '' : 'disabled'}>Add note</button>
      <button class="btn" id="ds-copy">Copy log</button><button class="btn primary" id="ds-save">Save log</button><button class="btn" id="ds-clear">Clear</button></div>
    <p id="ds-stats" class="muted" role="status"></p>
    <pre id="ds-log" class="hwlog tm-log" tabindex="0" aria-label="Data received from the unit"></pre>
    <p class="muted">The page shows the last ${DSC_SHOWN} lines and saves up to ${DSC_KEPT}. Long reads are split into 64-byte display rows; rows are not protocol packets. Omitted lines are reported in the saved file.</p>`;
  const checkBody = `<p class="muted">Check a saved SlotForge DS log for valid hex data and byte counts without connecting hardware. This checks the capture file, not DS protocol compatibility. It does not replay a race or send data to a port. PC Lap Counter debug files must be reviewed separately.</p><label>Choose capture log <input id="ds-check" type="file" accept=".txt,text/plain" style="max-width:100%"></label><p id="ds-check-result" role="status" class="muted"></p>`;
  box.innerHTML = HardwarePage.html({
    key:'ds',title:'DS Electronics',icon:'⌁',eyebrow:'Timing interface',
    pills:[type ? H.dsTypeName(type) : 'Choose a model','USB / serial',DsTiming.supported(type) ? 'Race timing · physical verification pending' : 'Capture only'],
    connected:dsc.open,status:dsc.open ? (DsTiming.supported(type) ? 'Connected for timing' : 'Listening') : dsc.needsClose ? 'Close needs retry' : 'Not connected',railTitle:'Connect and test',
    description:'<strong>DS-200 and DS-300 race timing.</strong> Connect the serial output directly or through a USB-to-serial adapter, then select DS Electronics as the timing hardware in use. Other DS models remain capture-only. Protocol replay tests passed; physical hardware verification is still outstanding.',
    helpTitle:'Timing controls the race',help:'Start and resume in Timing. DS stop, pause, abort or a connection fault pauses the race for review. Timing does not control DS track power. Use manual pit controls: DS packets do not report a held pit sensor.',
    sections:[
      {id:'connection',title:'Model and connection',icon:'⌁',note:type ? H.dsTypeName(type) + ' · choose its port' : 'Choose the unit and COM port',ready:dsc.open,open:true,body:connectionBody},
      {id:'serial',title:'Serial settings',icon:'⚙',note:c.baud + ' baud · ' + c.data + ' data bits · ' + c.parity + ' parity',body:serialBody},
      {id:'racing',title:'Race timing',icon:'⚑',note:'DS-200: 2 lanes · DS-300: up to 8 lanes',open:true,body:'<ol class="muted"><li>Choose DS-200 or DS-300, set the serial speed to match the box and connect. Select DS Electronics in <em>Timing hardware in use</em>.</li><li>Before racing, check every lane using the live capture. Lane 1 on the DS is lane 1 in Timing, and so on. A connected port alone does not confirm valid packets.</li><li>Prepare the DS box to report crossings, then start the race in Timing. DS start/resume buttons never start Timing automatically.</li><li>First-crossing markers start lap measurement and never set a lap record. Consecutive laps use the DS measured duration. The first lap after a pause uses Timing’s pause-adjusted clock; race elapsed time stays on Timing’s clock.</li><li>A lost connection, counter reset or missing packet pauses Timing for review. No missing laps are invented. Check the results before resuming manually. Stop physical cars separately: Timing sends no DS power commands.</li></ol>'},
      {id:'guide',title:'How to make a capture',icon:'☷',note:'A guided check · about 5 minutes',body:guideBody},
      {id:'monitor',title:'Live capture',icon:'≋',note:'Add notes, inspect data and save a log',ready:dsc.open,body:monitorBody},
      {id:'check',title:'Check saved capture',icon:'✓',note:'Offline byte-count and format check',body:checkBody}
    ],
    footer:'<p class="muted">Model choice is saved automatically. Serial settings last for this app session. Save log exports the capture to a text file.</p>'
  });
  HardwarePage.bind(box, 'ds');
  dscShow(); dscStats(); dscMsg(dsc.message);

  // the main process lists the ports it found; the person picks one here
  const choose = list => new Promise(res => {
    const el = $('ds-pick'); if (!el) return res('');
    el.innerHTML = `<div class="card"><strong>Choose a port</strong>${list.length ? list.map((d, i) => `<div class="row"><button class="btn" data-pick="${i}">${esc(d.displayName || d.name || d.portName || 'Port')} <span class="muted">${esc(d.portName || '')} ${d.vendorId !== undefined ? '(' + H.hex4(d.vendorId) + ':' + H.hex4(d.productId) + ')' : ''}</span></button></div>`).join('') : '<p class="muted">No ports found. Check the cable, or the adapter.</p>'}<button class="btn" data-pick="-1">Cancel</button></div>`;
    el.onclick = ev => { const b = ev.target.closest('[data-pick]'); if (!b) return; const i = Number(b.dataset.pick); el.innerHTML = ''; res(i >= 0 && list[i] ? list[i].portId || list[i].deviceId : ''); };
  });
  if (api.onHwChoose) api.onHwChoose(async (_kind, list) => { api.hwChosen(await choose(list)); });

  $('ds-find').onclick = async () => {
    if (dsc.open || dsc.needsClose || dscOpening || dscClosing || dscFinding || dscSaving) return;
    dscFinding = true; dscRedraw();
    try {
      const port = await navigator.serial.requestPort(); if (!port) return dscMsg('No port chosen.');
      dsc.dev = port; dsc.info = port.getInfo ? port.getInfo() : {}; dscMsg('');
    } catch (x) { dscMsg(x.name === 'NotFoundError' ? 'No port chosen.' : 'Could not find a port: ' + x.message); }
    finally { dscFinding = false; dscRedraw(); }
  };
  $('ds-conn').onclick = async () => { if (dsc.open || dsc.needsClose) await dscClose(); else if (dscType()) await dscOpen(); dscRedraw(); };
  box.onchange = async ev => { const t = ev.target; if (!dsc.open && !dsc.needsClose && !dscOpening && !dscClosing && !dscFinding && !dscSaving && t && t.name === 'dstype' && Hardware.DS_TYPES.some(d => d[0] === t.value)) {
    const type = t.value; dscSaving = true; dscRedraw();
    try { await save({ dsType: type }); } catch (x) { dscMsg('Could not save model: ' + x.message); }
    finally { dscSaving = false; dscRedraw(); }
  } };
  const cfgSet = patch => { dsc.cfg = Hardware.serialConfig({ ...dsc.cfg, ...patch }); };
  $('ds-baud').onchange = e => cfgSet({ baud: Number(e.target.value) }); $('ds-data').onchange = e => cfgSet({ data: Number(e.target.value) });
  $('ds-parity').onchange = e => cfgSet({ parity: e.target.value }); $('ds-stop').onchange = e => cfgSet({ stop: Number(e.target.value) });
  if ($('ds-preset')) $('ds-preset').onclick = () => { if (dsc.open || dsc.needsClose || dscOpening || dscClosing || dscFinding || dscSaving) return; cfgSet({ baud: guidance.baud, data: 8, parity: 'none', stop: 1 }); renderDsSettings(box); };
  const setSig = async () => { if (dsc.open) { const dev = dsc.dev, gen = dsc.gen, cfg = { ...dsc.cfg }; try { await dev.setSignals({ dataTerminalReady: cfg.dtr, requestToSend: cfg.rts }); if (dsc.open && dsc.gen === gen) dscNote(`-- DTR ${cfg.dtr ? 'on' : 'off'}, RTS ${cfg.rts ? 'on' : 'off'} --`); } catch (x) { if (dsc.open && dsc.gen === gen) dscMsg('Could not set the signals: ' + x.message); } } };
  $('ds-dtr').onchange = e => { cfgSet({ dtr: e.target.checked }); setSig(); }; $('ds-rts').onchange = e => { cfgSet({ rts: e.target.checked }); setSig(); };
  const addNote = () => { const f = $('ds-note'), t = String((f && f.value) || '').trim(); if (!dsc.open || !t) return; dscPush(`${dscSecs()}  NOTE  ${t}`); f.value = ''; };
  $('ds-addnote').onclick = addNote; $('ds-note').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); addNote(); } };
  const text = () => Hardware.dsCapture({ version: Hardware.appVersion(typeof navigator !== 'undefined' ? navigator.userAgent : ''), when: new Date(), ...(dsc.capture || { type, info: dsc.dev ? dsc.info : null }), omitted: dsc.omitted }, dsc.lines);
  $('ds-clear').onclick = () => { dsc.omitted += dsc.lines.length; dsc.lines = []; dsc.err = null; dscNote('-- log cleared by user; counters still describe this connection --'); dscShow(); };
  $('ds-copy').onclick = async () => { try { await navigator.clipboard.writeText(text()); dscMsg('Copied.'); } catch (x) { dscMsg('Could not copy: ' + x.message); } };
  $('ds-save').onclick = () => { const a = document.createElement('a'), url = URL.createObjectURL(new Blob([text()], { type: 'text/plain' })); a.href = url; a.download = Hardware.dsFileName(dsc.capture?.type || type); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  let checkRequest = 0;
  $('ds-check').onchange = async e => {
    const request = ++checkRequest, output = $('ds-check-result'), file = e.target.files?.[0]; output.textContent = ''; if (!file) return;
    try {
      if (file.size > 8 * 1024 * 1024) throw Error('Choose a capture smaller than 8 MB.');
      const result = H.dsInspectCapture(await file.text());
      if (request !== checkRequest || !output.isConnected) return;
      output.textContent = `${result.bytes} byte(s) in ${result.chunks} receive row(s), ${result.sessions} connection marker(s). ${result.chunks ? 'Hex data and byte counts agree.' : 'No received data to check.'}${result.omitted ? ` Incomplete capture: ${result.omitted} log lines were omitted.` : ''} This is not a protocol or hardware validation.`;
    } catch (x) { if (request === checkRequest && output.isConnected) output.textContent = 'Could not check capture: ' + x.message; }
  };
}
