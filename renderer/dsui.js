// App Settings > Timing Hardware > DS Electronics: the listening version.
// The data format of the DS Electronics lap counters is not known yet, so this page only listens: it connects to the unit's COM port, writes down everything that arrives
// (with the time) and saves that as a file, so the format can be worked out. It never sends anything to the unit, and a race does not use it yet.
// Setting kept: dsType (the model that was chosen). The serial settings are only kept while the app runs.
let dsc = { dev: null, info: {}, open: false, lines: [], t0: 0, bytes: 0, pieces: 0, last: null, cfg: Hardware.serialConfig(), gen: 0 };

const DSC_SHOWN = 500, DSC_KEPT = 20000; // lines shown on the page; lines kept for saving (the oldest go first)
const dscType = () => { const t = (typeof state !== 'undefined' && state.settings && state.settings.dsType) || ''; return Hardware.DS_TYPES.some(d => d[0] === t) ? t : ''; };
const dscSecs = () => ((performance.now() - dsc.t0) / 1000).toFixed(3).padStart(9);
const dscShow = () => { const l = document.getElementById('ds-log'); if (l) { l.textContent = dsc.lines.slice(-DSC_SHOWN).join('\n'); l.scrollTop = l.scrollHeight; } };
const dscPush = text => { dsc.lines.push(text); if (dsc.lines.length > DSC_KEPT) dsc.lines.splice(0, 2000); dscShow(); };
const dscLog = bytes => dscPush(Hardware.line(performance.now() - dsc.t0, '<-', bytes));
const dscNote = text => dscPush('          ' + text);
const dscMsg = t => { const m = document.getElementById('ds-msg'); if (m) m.textContent = t; };
const dscStatsText = () => !dsc.open ? (dsc.pieces ? `Last connection: ${dsc.bytes} byte(s) received in ${dsc.pieces} piece(s).` : '')
  : dsc.pieces ? `Received: ${dsc.bytes} byte(s) in ${dsc.pieces} piece(s). The last one came ${(dsc.last / 1000).toFixed(1)} s after connecting.` : 'Connected. Nothing has arrived yet: trigger a sensor of the unit, or press a button on it.';
const dscStats = () => { const e = document.getElementById('ds-stats'); if (e) e.textContent = dscStatsText(); };
const dscRedraw = () => { const b = document.getElementById('hwbox'); if (b && document.getElementById('ds-log') && typeof renderDsSettings === 'function') renderDsSettings(b); };

// A read error (a wrong speed gives framing errors, over and over): the same error in a row is one line with a count
function dscError(msg) {
  const e = dsc.err, lastLine = dsc.lines[dsc.lines.length - 1];
  if (e && e.msg === msg && lastLine === e.text) { e.n++; e.text = `${e.at}  ERROR  ${msg}  (${e.n} times)`; dsc.lines[dsc.lines.length - 1] = e.text; dscShow(); return; }
  const at = dscSecs(); dsc.err = { msg, n: 1, at, text: `${at}  ERROR  ${msg}` }; dscPush(dsc.err.text);
}
function dscReceive(bytes) { dsc.bytes += bytes.length; dsc.pieces++; dsc.last = performance.now() - dsc.t0; dscLog(bytes); dscStats(); }

// the control lines (CTS, DSR, DCD, RI) are written to the log whenever one of them changes: some units signal with them
async function dscPoll() {
  const names = { clearToSend: 'CTS', dataSetReady: 'DSR', dataCarrierDetect: 'DCD', ringIndicator: 'RI' }; let last = null; const gen = dsc.gen = dsc.gen + 1;
  const tick = async () => {
    if (!dsc.open || dsc.gen !== gen) return;
    try { const sg = await dsc.dev.getSignals(), cur = Object.keys(names).map(k => `${names[k]}=${sg[k] ? 1 : 0}`).join(' '); if (cur !== last) { dscPush(`${dscSecs()}  LINES  ${cur}`); last = cur; } } catch (x) { /* port gone */ }
    setTimeout(tick, 50);
  };
  tick();
}

// connect and listen. Nothing is written to the port.
let dscOpening = false; // (one Connect at a time, as on the Arduino page)
async function dscOpen() { if (dscOpening) return false; dscOpening = true; try { return await dscOpenNow(); } finally { dscOpening = false; } }
async function dscOpenNow() {
  const c = dsc.cfg = Hardware.serialConfig(dsc.cfg); dsc.bytes = 0; dsc.pieces = 0; dsc.last = null;
  try {
    dsc.t0 = performance.now();
    await dsc.dev.open({ baudRate: c.baud, dataBits: c.data, stopBits: c.stop, parity: c.parity, flowControl: 'none' });
    dsc.open = true; dscNote(`-- connected to the COM port at ${c.baud} baud, ${c.data} data bits, parity ${c.parity}, ${c.stop} stop bit(s), DTR ${c.dtr ? 'on' : 'off'}, RTS ${c.rts ? 'on' : 'off'} --`);
    try { await dsc.dev.setSignals({ dataTerminalReady: c.dtr, requestToSend: c.rts }); } catch (x) { /* not every port can */ }
    dscPoll();
    dsc.loop = (async () => { // read until disconnected
      while (dsc.open && dsc.dev.readable) {
        const stream = dsc.dev.readable; dsc.reader = stream.getReader();
        try { for (;;) { const { value, done } = await dsc.reader.read(); if (done) break; if (value && value.length) dscReceive(value); } }
        catch (x) { dscError(x.name ? `${x.name}: ${x.message}` : x.message); } finally { dsc.reader.releaseLock(); }
        if (dsc.dev.readable === stream) break; // a stream that has ended or failed gives nothing more; after a small error the port gives a new one, and we go on with that
      }
      if (dsc.open) { dsc.open = false; dscNote('-- the device went away --'); dscRedraw(); }
    })();
    return true;
  } catch (x) { dsc.open = false; dscMsg('Could not connect: ' + x.message + ' (is another program using this port? Close Race Coordinator and other timing programs first.)'); return false; }
}
async function dscClose() {
  dsc.open = false;
  try { if (dsc.reader) await dsc.reader.cancel().catch(() => {}); if (dsc.loop) await dsc.loop; await dsc.dev.close(); } catch (x) { dscMsg('Could not close the port: ' + x.message); } // (the reading loop lets go of the port first, or it could not be closed)
  dscNote(`-- disconnected: ${dsc.bytes} byte(s) received in ${dsc.pieces} piece(s) --`);
}

function renderDsSettings(box) {
  const H = Hardware, can = typeof navigator !== 'undefined' && !!navigator.serial, type = dscType(), c = dsc.cfg, $ = id => document.getElementById(id), save = patch => api.setSettings(patch).then(s => { state.settings = s; });
  const off = dsc.open ? ' disabled' : '';
  const sel = (id, label, list, cur) => `<label>${label} <select id="${id}"${off}>${list.map(v => `<option${v === cur ? ' selected' : ''}>${v}</option>`).join('')}</select></label>`;
  const connectionBody = `<div class="row interface-models" role="radiogroup" aria-label="Model of the DS unit"><strong>Unit</strong>${H.DS_TYPES.map(([id, name]) => `<label class="inline" style="white-space:nowrap"><input type="radio" name="dstype" value="${id}"${type === id ? ' checked' : ''}> ${name}</label>`).join('')}</div>
    <div class="row"><button class="btn primary" id="ds-find" ${can && !dsc.open ? '' : 'disabled'}>Find the DS interface (COM port)</button>
      <button class="btn primary" id="ds-conn" ${dsc.dev && type ? '' : 'disabled'}>${dsc.open ? 'Disconnect' : 'Connect'}</button>
      <span class="led${dsc.open ? ' on' : ''}" id="ds-led" role="img" aria-label="Connection: ${dsc.open ? 'connected' : 'not connected'}"></span>
      <span id="ds-dev" class="muted">${dsc.dev ? (dsc.open && type ? esc(H.dsTypeName(type)) + ' on ' : '') + esc(H.describe('serial', dsc.info)) + (dsc.open ? ' is connected' : '') : can ? 'No port chosen.' : 'COM ports can only be used in the desktop app.'}${dsc.dev && !type ? ' Choose the model above to connect.' : ''}</span><span id="ds-msg" class="muted" role="status"></span></div>
    <div id="ds-pick"></div>`;
  const serialBody = `<div class="interface-fields">${sel('ds-baud', 'Speed (baud)', H.BAUDS, c.baud)}${sel('ds-data', 'Data bits', [7, 8], c.data)}${sel('ds-parity', 'Parity', ['none', 'even', 'odd'], c.parity)}${sel('ds-stop', 'Stop bits', [1, 2], c.stop)}
      <label class="inline"><input type="checkbox" id="ds-dtr" ${c.dtr ? 'checked' : ''}> DTR on</label><label class="inline"><input type="checkbox" id="ds-rts" ${c.rts ? 'checked' : ''}> RTS on</label></div>
    <p class="muted">DTR and RTS can change the serial control lines; they do not send protocol commands. The speed and the other serial settings are set when you connect (to change them, disconnect first). If you do not know the speed of the unit, start with 9600.</p>`;
  const guideBody = `<ol class="muted">
      <li>Switch the DS unit on, connect its serial cable to the computer and connect the lane sensors.</li>
      <li>Choose the model above, press <em>Find the DS interface</em>, choose the port, then press <em>Connect</em>. The light turns green. Close other timing programs first: only one program can use a COM port.</li>
      <li>Before each thing you do, type a note below and press <em>Add note</em>, then do it. For example: <em>lane 1: car over the sensor</em>, then lane 2 and so on for every lane. Let a car pass a few times so there are several laps. Press the buttons of the unit one at a time (start, stop and so on) with a note for each.</li>
      <li>If the unit shows times on its own display, add a note with what it shows (for example <em>display lane 1: 7.35</em>). That is the best way to find out how times are sent.</li>
      <li>If nothing appears when you trigger a sensor, or only strange characters or <em>ERROR</em> lines appear (usually a sign of the wrong speed), press <em>Disconnect</em>, choose another speed (1200, 2400, 4800, 9600, 19200, 38400) and try again.</li>
      <li>Press <em>Save log</em> and send the file.</li></ol>`;
  const monitorBody = `<div class="row"><label>Note for the log <input type="text" id="ds-note" maxlength="200" ${dsc.open ? '' : 'disabled'}></label><button class="btn" id="ds-addnote" ${dsc.open ? '' : 'disabled'}>Add note</button>
      <button class="btn" id="ds-copy">Copy log</button><button class="btn primary" id="ds-save">Save log</button><button class="btn" id="ds-clear">Clear</button></div>
    <p id="ds-stats" class="muted" role="status"></p>
    <pre id="ds-log" class="hwlog tm-log" tabindex="0" aria-label="Data received from the unit"></pre>
    <p class="muted">The page shows the last ${DSC_SHOWN} lines. <em>Save log</em> and <em>Copy log</em> take everything (up to ${DSC_KEPT} lines), with a few lines at the top that say which model and port it was.</p>`;
  box.innerHTML = HardwarePage.html({
    key:'ds',title:'DS Electronics',icon:'⌁',eyebrow:'Interface capture',
    pills:[type ? H.dsTypeName(type) : 'Choose a model','USB / serial','Capture only'],
    connected:dsc.open,status:dsc.open ? 'Listening' : 'Not connected',railTitle:'Connect and capture',
    description:'<strong>Listening version.</strong> Capture what your DS lap counter sends so its data format can be identified. The app sends nothing to the unit as protocol commands, and a race does not use the unit yet. Connect its serial output directly or through a USB-to-serial adapter.',
    helpTitle:'Not race timing yet',help:'Record sensor passes and button presses with notes. Save the capture so the protocol can be checked. No laps or race results are recorded from this interface.',
    sections:[
      {id:'connection',title:'Model and connection',icon:'⌁',note:type ? H.dsTypeName(type) + ' · choose its port' : 'Choose the unit and COM port',ready:dsc.open,open:true,body:connectionBody},
      {id:'serial',title:'Serial settings',icon:'⚙',note:c.baud + ' baud · ' + c.data + ' data bits · ' + c.parity + ' parity',body:serialBody},
      {id:'guide',title:'How to make a capture',icon:'☷',note:'A guided check · about 5 minutes',body:guideBody},
      {id:'monitor',title:'Live capture',icon:'≋',note:'Add notes, inspect data and save a log',ready:dsc.open,body:monitorBody}
    ],
    footer:'<p class="muted">Model choice is saved automatically. Serial settings last for this app session. Save log exports the capture to a text file.</p>'
  });
  HardwarePage.bind(box, 'ds');
  dscShow(); dscStats();

  // the main process lists the ports it found; the person picks one here
  const choose = list => new Promise(res => {
    const el = $('ds-pick'); if (!el) return res('');
    el.innerHTML = `<div class="card"><strong>Choose a port</strong>${list.length ? list.map((d, i) => `<div class="row"><button class="btn" data-pick="${i}">${esc(d.displayName || d.name || d.portName || 'Port')} <span class="muted">${esc(d.portName || '')} ${d.vendorId !== undefined ? '(' + H.hex4(d.vendorId) + ':' + H.hex4(d.productId) + ')' : ''}</span></button></div>`).join('') : '<p class="muted">No ports found. Check the cable, or the adapter.</p>'}<button class="btn" data-pick="-1">Cancel</button></div>`;
    el.onclick = ev => { const b = ev.target.closest('[data-pick]'); if (!b) return; const i = Number(b.dataset.pick); el.innerHTML = ''; res(i >= 0 && list[i] ? list[i].portId || list[i].deviceId : ''); };
  });
  if (api.onHwChoose) api.onHwChoose(async (_kind, list) => { api.hwChosen(await choose(list)); });

  $('ds-find').onclick = async () => {
    try {
      const port = await navigator.serial.requestPort(); if (!port) return dscMsg('No port chosen.');
      dsc.dev = port; dsc.info = port.getInfo ? port.getInfo() : {}; renderDsSettings(box);
    } catch (x) { dscMsg(x.name === 'NotFoundError' ? 'No port chosen.' : 'Could not find a port: ' + x.message); }
  };
  $('ds-conn').onclick = async () => { if (dsc.open) await dscClose(); else if (dscType()) await dscOpen(); renderDsSettings(box); };
  // the model can be changed at any time (it only labels the capture); during a connection the change is written in the log
  box.onchange = ev => { const t = ev.target; if (t && t.name === 'dstype' && Hardware.DS_TYPES.some(d => d[0] === t.value)) { if (dsc.open) dscNote(`-- the unit was set to ${Hardware.dsTypeName(t.value)} --`); save({ dsType: t.value }).then(() => renderDsSettings(box)); } };
  const cfgSet = patch => { dsc.cfg = Hardware.serialConfig({ ...dsc.cfg, ...patch }); };
  $('ds-baud').onchange = e => cfgSet({ baud: Number(e.target.value) }); $('ds-data').onchange = e => cfgSet({ data: Number(e.target.value) });
  $('ds-parity').onchange = e => cfgSet({ parity: e.target.value }); $('ds-stop').onchange = e => cfgSet({ stop: Number(e.target.value) });
  const setSig = async () => { if (dsc.open) { try { await dsc.dev.setSignals({ dataTerminalReady: dsc.cfg.dtr, requestToSend: dsc.cfg.rts }); dscNote(`-- DTR ${dsc.cfg.dtr ? 'on' : 'off'}, RTS ${dsc.cfg.rts ? 'on' : 'off'} --`); } catch (x) { dscMsg('Could not set the signals: ' + x.message); } } };
  $('ds-dtr').onchange = e => { cfgSet({ dtr: e.target.checked }); setSig(); }; $('ds-rts').onchange = e => { cfgSet({ rts: e.target.checked }); setSig(); };
  const addNote = () => { const f = $('ds-note'), t = String((f && f.value) || '').trim(); if (!dsc.open || !t) return; dscPush(`${dscSecs()}  NOTE  ${t}`); f.value = ''; };
  $('ds-addnote').onclick = addNote; $('ds-note').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); addNote(); } };
  const text = () => Hardware.dsCapture({ version: Hardware.appVersion(typeof navigator !== 'undefined' ? navigator.userAgent : ''), when: new Date(), type, info: dsc.dev ? dsc.info : null }, dsc.lines);
  $('ds-clear').onclick = () => { dsc.lines = []; dscShow(); };
  $('ds-copy').onclick = async () => { try { await navigator.clipboard.writeText(text()); dscMsg('Copied.'); } catch (x) { dscMsg('Could not copy: ' + x.message); } };
  $('ds-save').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text()], { type: 'text/plain' })); a.download = Hardware.dsFileName(type); document.body.appendChild(a); a.click(); a.remove(); };
}
