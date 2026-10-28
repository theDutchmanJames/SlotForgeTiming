// App Settings > Timing Hardware > Parallel Port. Draft edits are explicit; monitoring uses the shared live link.
let ppPageDispose = null;
function renderParallelSettings(box) {
  if (ppPageDispose) ppPageDispose(); ppInit();
  box.innerHTML = '<section class="parallel-setup" aria-label="Parallel Port setup"><p class="pp-lock" data-race-lock hidden>The race owns the timing interface. Finish or leave the race before changing settings or testing outputs.</p>' + parallelPageHtml + '</section>';
  const root = box.querySelector('.parallel-setup'), q = selector => root.querySelector(selector), qa = selector => [...root.querySelectorAll(selector)], P = ParallelPort, L = P.link;
  const copy = x => JSON.parse(JSON.stringify(x)); let saved = ppSettings(), s = pp.draft ? copy(pp.draft) : copy(saved), view = 'lanes', current = 'connection', selectedPin = 10, working = false, disposed = false, updateTimer = null;
  const icons = { cable: 'parallel', plug: 'parallel', 'scan-line': 'timing', activity: 'timing', 'flag-triangle-right': 'director', lightbulb: 'lights', timer: 'clock', info: 'info', 'message-square': 'say', search: 'screen', 'plug-zap': 'bolt', 'sliders-horizontal': 'sliders', check: 'check' };
  qa('[data-lucide]').forEach(el => { el.outerHTML = Icons.svg(icons[el.dataset.lucide] || 'info', { size: 16 }); });
  const locked = () => (typeof raceKept === 'function' && raceKept()) || !!pp.backend.race;
  const dirty = () => JSON.stringify(s) !== JSON.stringify(saved), issues = () => P.validate(s), uses = () => P.assignments(s);
  const portName = () => s.port === 'manual' ? 'Manual port' : s.port.toUpperCase();
  const calibrationKey = () => JSON.stringify([s.port, s.address, s.lanes, s.map, s.signal, s.pitMode, s.pitPins, s.pitSignal, s.trackcall, s.callPin, s.callSignal]);
  const message = text => { if (!disposed) q('[data-message]').textContent = text; };
  const options = (value, optional = true) => (optional ? '<option value="0">Not assigned</option>' : '<option value="0">Choose a pin</option>') + P.INPUTS.map(pin => `<option value="${pin}"${pin === +value ? ' selected' : ''}>Pin ${pin}${P.CONTROL.includes(pin) ? ' · control' : ''}</option>`).join('');
  const signals = value => `<option value="high"${value === 'high' ? ' selected' : ''}>High</option><option value="low"${value === 'low' ? ' selected' : ''}>Low</option>`;
  function mapRows(kind) {
    const pit = kind === 'pit', map = pit ? s.pitPins : s.map, signal = pit ? s.pitSignal : s.signal;
    return Array.from({ length: s.lanes }, (_, i) => `<div class="pp-maprow" data-map-row="${kind}-${i}"><span class="pp-lane"><i class="pp-lanebar" aria-hidden="true"></i>Lane ${i + 1}</span><select data-${pit ? 'pit' : 'lane'}-pin="${i}" aria-label="${pit ? 'Pit' : 'Lap'} sensor pin for lane ${i + 1}">${options(map[i], pit)}</select><select data-signal="${kind}" data-index="${i}" aria-label="Triggered signal for lane ${i + 1}${pit ? ' pit' : ''}">${signals(signal[i])}</select><span class="pp-state" data-row-state="${kind}-${i}">—</span></div>`).join('');
  }
  function editors() {
    q('[data-sensor-rows]').innerHTML = mapRows('lap'); q('[data-pit-rows]').innerHTML = '<div class="pp-maphead"><span>Pit box</span><span>Sensor pin</span><span>Triggered when</span><span>Now</span></div>' + mapRows('pit');
    q('[data-trackcall-pin]').innerHTML = options(s.callPin);
    q('[data-output-rows]').innerHTML = [...P.DATA, ...(s.extraOutputs ? P.CONTROL : [])].map(pin => `<div class="pp-outputrow"><strong>Pin ${pin}</strong><select data-output="${pin}" aria-label="Function of output pin ${pin}">${P.outputRoles(s.lanes).map(([role, name]) => `<option value="${role}"${(s.outputs[pin] || 'none') === role ? ' selected' : ''}>${esc(name)}</option>`).join('')}</select><select data-output-signal="${pin}" aria-label="On signal for output pin ${pin}">${signals(s.outputSignal[pin] || 'high')}</select><button type="button" class="pp-button" data-output-test="${pin}">Test</button></div>`).join('');
    q('[data-monitor-lanes]').innerHTML = Array.from({ length: s.lanes }, (_, i) => `<div class="pp-monitorlane"><div class="pp-line"><b>Lane ${i + 1}</b><span class="pp-hint">Pin ${s.map[i] || '—'}</span></div><span class="pp-state" data-monitor-state="${i}">Not connected</span><span class="pp-montime" data-count="${i}">0 crossings</span></div>`).join('');
  }
  function fields() { qa('[data-setting]').forEach(el => { if (el.type === 'checkbox') el.checked = !!s[el.dataset.setting]; else el.value = s[el.dataset.setting]; }); q('[data-preset]').value = s.preset; }
  function pinRole(pin) { const a = uses().find(x => x.pin === pin); return !a ? 'none' : a.kind === 'lap' || a.kind === 'pit' ? a.kind + a.lane : a.kind === 'call' ? 'call' : a.role; }
  function inspector() {
    const ground = selectedPin >= 18, control = P.CONTROL.includes(selectedPin), status = P.STATUS.includes(selectedPin);
    q('[data-pin-name]').innerHTML = `Pin ${selectedPin}<small>${ground ? 'Signal ground' : status ? 'Status input' : control ? 'Control pin' : 'Data output'}</small>`;
    let roles = [['none', ground ? 'Ground · not assignable' : 'Unused']];
    if (!ground && (status || control)) roles.push(...Array.from({ length: s.lanes }, (_, i) => ['lap' + i, 'Lane ' + (i + 1) + ' sensor']), ...Array.from({ length: s.lanes }, (_, i) => ['pit' + i, 'Lane ' + (i + 1) + ' pit']), ['call', 'Track-call button']);
    if (!ground && !status) roles.push(...P.outputRoles(s.lanes).filter(x => x[0] !== 'none'));
    q('[data-pin-role]').innerHTML = roles.map(([role, name]) => `<option value="${role}"${role === pinRole(selectedPin) ? ' selected' : ''}>${esc(name)}</option>`).join('');
    q('[data-pin-role]').disabled = ground || locked(); q('[data-pin-select]').value = selectedPin;
    q('[data-pin-help]').textContent = ground ? 'Pins 18–25 are signal grounds.' : control ? 'Input use needs compatible hardware and a physical sensor check.' : 'This assignment also appears in its lane, pit or output section.';
    qa('[data-physical-pin]').forEach(el => el.setAttribute('aria-pressed', String(+el.dataset.physicalPin === selectedPin)));
  }
  function connector() {
    const pin = n => `<button type="button" class="pp-pin${P.STATUS.includes(n) ? ' pp-inputpin' : P.DATA.includes(n) ? ' pp-outputpin' : ''}" data-physical-pin="${n}" aria-label="Inspect pin ${n}" aria-pressed="false">${n}</button>`;
    q('[data-pin-top]').innerHTML = Array.from({ length: 13 }, (_, i) => pin(13 - i)).join(''); q('[data-pin-bottom]').innerHTML = Array.from({ length: 12 }, (_, i) => pin(25 - i)).join('');
    q('[data-pin-select]').innerHTML = Array.from({ length: 25 }, (_, i) => `<option value="${i + 1}">Pin ${i + 1}</option>`).join(''); inspector();
  }
  function stateHtml(pin, signal) { const known = L.connected && Object.prototype.hasOwnProperty.call(L.pins, pin), active = known && L.pins[pin] === (signal === 'high'); return `<i class="pp-dot${active ? ' pp-ok' : ''}" aria-hidden="true"></i><span>${!known ? 'Not connected' : active ? 'Triggered' : 'Clear'}</span>`; }
  function sync() {
    if (disposed || !root.isConnected) return;
    const errors = issues(), changed = dirty(), lock = locked(), available = !!api.parallelOpen && (!pp.backend.platform || pp.backend.platform === 'win32');
    pp.dirty = changed; q('[data-race-lock]').hidden = !lock;
    qa('[data-setting], [data-lane-pin], [data-pit-pin], [data-signal], [data-trackcall-pin], [data-output], [data-output-signal], [data-preset], [data-pit-mode], [data-reset]').forEach(el => { el.disabled = lock || working; });
    q('[data-port-pill]').textContent = portName() + ' · 0x' + (Number.isFinite(P.addressOf(s)) ? P.addressOf(s).toString(16).toUpperCase() : '—');
    q('[data-lanes-pill]').textContent = s.lanes + (s.lanes === 1 ? ' lane' : ' lanes'); q('[data-pit-pill]').textContent = { shared: 'Lap sensor for pits', separate: 'Separate pit sensors', none: 'Manual pit controls' }[s.pitMode];
    const label = pp.error ? 'Connection needs attention' : errors.length ? 'Check assignments' : changed ? 'Changes to save' : L.connected ? 'Connected' : 'Not connected';
    q('[data-header-state]').textContent = label; q('[data-header-dot]').className = 'pp-dot' + (pp.error || errors.length ? ' pp-warn' : L.connected ? ' pp-ok' : '');
    q('[data-say]').textContent = `Each of your ${s.lanes} lane sensors has its own pin. One active edge records one crossing. ${s.pitMode === 'shared' ? 'A car that stays over its lap sensor can make a pit stop.' : s.pitMode === 'separate' ? 'Separate sensors report pit stops' + (s.pitAsLap ? ' and also count a lap.' : '.') : 'Pit stops use the race’s manual controls.'} ${s.outputsOn ? 'Assigned outputs follow the race.' : 'Outputs are off.'}`;
    q('[data-errors]').hidden = !errors.length; q('[data-errors]').innerHTML = errors.slice(0, 8).map(e => '<p>' + esc(e.text) + '</p>').join('');
    q('[data-save]').disabled = lock || working || !changed || !!errors.length; q('[data-undo]').disabled = lock || working || !changed;
    q('[data-manual-field]').hidden = s.port !== 'manual'; q('[data-connect] span').textContent = pp.busy ? 'Please wait…' : L.connected ? 'Disconnect' : 'Connect';
    q('[data-connect]').disabled = !available || (lock && L.connected) || working || pp.busy || (!L.connected && (changed || !!errors.length)); q('[data-check]').disabled = !available || lock || working || pp.busy;
    q('[data-calibrate]').disabled = lock || working || !L.connected || changed;
    q('[data-driver-text]').textContent = pp.error || pp.checked?.message || (available ? 'Port access has not been checked' : 'Port access needs the Windows desktop app'); q('[data-driver-line]').classList.toggle('pp-good', !!pp.checked?.accessible && !pp.error);
    q('[data-access-note]').hidden = !pp.error; q('[data-access-note] span').textContent = pp.error;
    const notes = { connection: portName() + ' · ' + (L.connected ? 'connected' : 'not connected'), sensors: s.lanes + ' lanes · ' + ({ rc: 'RC wiring', slottrak: 'SlotTrak wiring', custom: 'custom wiring' }[s.preset]), monitor: L.connected ? L.total + ' crossings observed' : 'Waiting for a connection', pits: (s.pitMode === 'shared' ? 'Shared sensor' : s.pitMode === 'separate' ? 'Separate sensors' : 'Manual pits') + ' · ' + (s.trackcall ? 'button on' : 'no button'), outputs: s.outputsOn ? uses().filter(a => a.kind === 'out').length + ' assigned outputs' : 'Outputs off', timing: s.poll + ' ms · ' + (s.filter || s.rearm ? 'filters set' : 'filters off') };
    Object.entries(notes).forEach(([id, text]) => { q(`[data-rail="${id}"]`).textContent = text; q(`[data-dot="${id}"]`).className = 'pp-dot' + (errors.some(e => e.section === id) ? ' pp-warn' : id === 'connection' || id === 'monitor' ? L.connected ? ' pp-ok' : '' : id === 'sensors' ? ' pp-ok' : ''); });
    qa('[data-go]').forEach(el => el.setAttribute('aria-current', String(el.dataset.go === current)));
    for (const [id, key] of [['sensor', 'sensors'], ['pit', 'pits'], ['output', 'outputs'], ['timing', 'timing']]) q('[data-' + id + '-summary]').textContent = notes[key];
    qa('[data-view]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.view === view))); q('[data-lane-view]').hidden = view !== 'lanes'; q('[data-pin-view]').hidden = view !== 'pins';
    qa('[data-map-row]').forEach(row => { const [kind, i] = row.dataset.mapRow.split('-'), pin = (kind === 'lap' ? s.map : s.pitPins)[+i]; row.classList.toggle('pp-conflict', errors.some(e => e.pin === pin)); });
    qa('[data-pit-mode]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.pitMode === s.pitMode))); q('[data-pit-rows]').hidden = s.pitMode !== 'separate'; q('[data-pit-lap-label]').hidden = s.pitMode !== 'separate'; q('[data-pit-lap-help]').hidden = s.pitMode !== 'separate'; q('[data-trackcall-fields]').hidden = !s.trackcall; q('[data-output-body]').hidden = !s.outputsOn;
    q('[data-pit-hint]').textContent = s.pitMode === 'shared' ? 'The pit hold time comes from each race setup. A sensor staying covered does not keep adding laps.' : s.pitMode === 'separate' ? 'Every enabled lane needs a separate pit input. Input capacity includes track call.' : 'No automatic pit inputs. The race’s manual pit controls remain available.';
    q('[data-requested]').textContent = s.poll + ' ms'; q('[data-observed]').textContent = L.samples > 1 ? L.maxGap.toFixed(3) + ' ms' : '—'; q('[data-total]').textContent = L.total; q('[data-monitor-source]').textContent = L.connected ? 'Live inputs · ' + L.config.name : 'Not connected'; q('[data-monitor-dot]').className = 'pp-dot' + (L.connected ? ' pp-ok' : '');
    q('[data-log]').textContent = pp.logs.slice(pp.detailed ? -25 : -4).join('\n') || (L.connected ? 'Connected. Waiting for a sensor change.' : 'Connect to see input events.');
    for (let i = 0; i < s.lanes; i++) { q(`[data-count="${i}"]`).textContent = L.counts[i] + ' crossing' + (L.counts[i] === 1 ? '' : 's'); q(`[data-monitor-state="${i}"]`).innerHTML = stateHtml(s.map[i], s.signal[i]); q(`[data-row-state="lap-${i}"]`).innerHTML = stateHtml(s.map[i], s.signal[i]); q(`[data-row-state="pit-${i}"]`).innerHTML = stateHtml(s.pitPins[i], s.pitSignal[i]); }
    const calibrated = s.calibration && s.calibration.key === calibrationKey(); q('[data-calibration-status]').innerHTML = `<i class="pp-dot${calibrated ? ' pp-ok' : ''}" aria-hidden="true"></i><span>${calibrated ? 'Clear-state calibration captured' : 'Not calibrated'}</span>`;
    const testAllowed = !lock && !working && L.connected && !changed && !errors.length && s.outputsOn; q('[data-arm-tests]').disabled = !testAllowed; q('[data-arm-tests]').textContent = pp.backend.armed ? 'Disable output tests' : 'Enable output tests'; q('[data-test-note]').textContent = lock ? 'Output tests are unavailable while a race is open.' : testAllowed ? pp.backend.armed ? 'Tests enabled. Each test returns off after 1.5 seconds.' : 'Outputs remain inactive until you deliberately test one.' : 'Save and connect before enabling output tests.';
    qa('[data-output-test]').forEach(el => { el.disabled = !testAllowed || !pp.backend.armed || !s.outputs[el.dataset.outputTest] || s.outputs[el.dataset.outputTest] === 'none'; el.textContent = pp.backend.testPin === +el.dataset.outputTest ? 'On' : 'Test'; });
    qa('[data-physical-pin]').forEach(el => { const pin = +el.dataset.physicalPin; el.classList.toggle('pp-lit', L.connected && L.pins[pin] === true); }); q('[data-pin-role]').disabled = lock || selectedPin >= 18 || working;
  }
  async function operation(fn, reconnect = false) { if (working || (locked() && !reconnect)) return; working = true; sync(); try { await fn(); } catch (x) { message(x.message); } finally { working = false; if (!disposed) sync(); } }
  function changed(rebuild = false) {
    pp.draft = copy(s); pp.dirty = dirty(); pp.checked = null;
    if (L.connected) ppClose().catch(x => message(x.message));
    if (rebuild) editors(); fields(); inspector(); sync(); message(issues().length ? 'Check the highlighted assignments before saving.' : 'Changes to save. Save, then reconnect to apply them.');
  }
  function assignPin(pin, role) {
    s.map = s.map.map(v => v === pin ? 0 : v); s.pitPins = s.pitPins.map(v => v === pin ? 0 : v); if (s.callPin === pin) { s.trackcall = false; s.callPin = 0; } delete s.outputs[pin];
    if (role.startsWith('lap')) s.map[+role.slice(3)] = pin;
    else if (role.startsWith('pit')) { s.pitMode = 'separate'; s.pitPins[+role.slice(3)] = pin; }
    else if (role === 'call') { s.trackcall = true; s.callPin = pin; }
    else if (role !== 'none') { s.outputsOn = true; if (P.CONTROL.includes(pin)) s.extraOutputs = true; s.outputs[pin] = role; }
    s.preset = 'custom'; changed(true);
  }
  root.onchange = event => {
    const el = event.target;
    if (el.matches('[data-pin-select]')) { selectedPin = +el.value; inspector(); return; }
    if (el.matches('[data-keep-log]')) { pp.detailed = el.checked; sync(); return; }
    if (locked() || working) return;
    if (el.matches('[data-setting]')) { const key = el.dataset.setting; s[key] = el.type === 'checkbox' ? el.checked : ['lanes', 'poll', 'filter', 'rearm'].includes(key) ? Number(el.value) : el.value; if (key === 'lanes') { if (s.preset !== 'custom') s.map = (s.preset === 'rc' ? P.RC : P.SLOTTRAK).slice(); for (const pin of Object.keys(s.outputs)) if (/^relay\d+$/.test(s.outputs[pin]) && +s.outputs[pin].slice(5) > s.lanes) s.outputs[pin] = 'none'; } changed(['lanes', 'extraOutputs'].includes(key)); }
    else if (el.matches('[data-preset]')) { s.preset = el.value; if (s.preset !== 'custom') s.map = (s.preset === 'rc' ? P.RC : P.SLOTTRAK).slice(); changed(true); }
    else if (el.matches('[data-lane-pin]')) { s.map[+el.dataset.lanePin] = +el.value; s.preset = 'custom'; changed(); }
    else if (el.matches('[data-pit-pin]')) { s.pitPins[+el.dataset.pitPin] = +el.value; changed(); }
    else if (el.matches('[data-signal]')) { (el.dataset.signal === 'lap' ? s.signal : s.pitSignal)[+el.dataset.index] = el.value; changed(); }
    else if (el.matches('[data-trackcall-pin]')) { s.callPin = +el.value; changed(); }
    else if (el.matches('[data-output]')) { s.outputs[el.dataset.output] = el.value; changed(); }
    else if (el.matches('[data-output-signal]')) { s.outputSignal[el.dataset.outputSignal] = el.value; changed(); }
    else if (el.matches('[data-pin-role]')) assignPin(selectedPin, el.value);
  };
  root.onclick = event => {
    const button = event.target.closest('button'); if (!button || button.disabled) return;
    if (button.matches('[data-go]')) { current = button.dataset.go; const section = q('[data-section="' + current + '"]'); section.open = true; sync(); section.scrollIntoView({ block: 'nearest' }); return; }
    if (button.matches('[data-view]')) { view = button.dataset.view; inspector(); sync(); return; }
    if (button.matches('[data-physical-pin]')) { selectedPin = +button.dataset.physicalPin; inspector(); return; }
    if (button.matches('[data-clear-log]')) { L.clearMonitor(); pp.logs = []; sync(); message('Monitor cleared. Race data was not changed.'); return; }
    if (button.matches('[data-save-log]')) {
      const content = 'SlotForge Timing — Parallel Port log\r\nSaved: ' + new Date().toISOString() + '\r\nConfiguration: ' + JSON.stringify(L.connected ? L.config : saved) + '\r\nLargest measured polling gap: ' + L.maxGap.toFixed(3) + ' ms\r\n\r\n' + pp.logs.join('\r\n') + '\r\n';
      const url = URL.createObjectURL(new Blob([content], { type: 'text/plain' })), anchor = document.createElement('a'); anchor.href = url; anchor.download = 'slotforge-parallel-port-log.txt'; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); return;
    }
    if (working || (locked() && !(button.matches('[data-connect]') && !L.connected && !dirty() && !issues().length))) return;
    if (button.matches('[data-check]')) operation(async () => { pp.error = ''; pp.checked = await api.parallelCheck(copy(s)); message(pp.checked.message); });
    else if (button.matches('[data-connect]')) operation(async () => { if (L.connected) { await ppClose(); message('Disconnected. Assigned outputs are inactive.'); } else { await ppConnect(); pp.checked = { accessible: true, message: 'Driver accessible. Check each sensor in the live monitor.' }; message(locked() ? 'Reconnected. Return to the race and resume manually.' : 'Connected. Pass a car over each sensor to check its lane.'); } }, !L.connected && !dirty() && !issues().length);
    else if (button.matches('[data-calibrate]')) operation(async () => { if (P.INPUTS.some(pin => uses().some(a => a.pin === pin && a.kind !== 'out') && typeof L.pins[pin] !== 'boolean')) throw Error('Wait until input readings are available.'); const idle = {}; uses().filter(a => a.kind === 'lap' || a.kind === 'pit').forEach(a => { idle[a.pin] = L.pins[a.pin]; (a.kind === 'lap' ? s.signal : s.pitSignal)[a.lane] = L.pins[a.pin] ? 'low' : 'high'; }); s.calibration = { key: calibrationKey(), idle }; await ppClose(); changed(true); message('Clear states captured. Save the calibration, then reconnect.'); });
    else if (button.matches('[data-pit-mode]')) { s.pitMode = button.dataset.pitMode; changed(); }
    else if (button.matches('[data-arm-tests]')) operation(async () => { pp.backend = await api.parallelArm(!pp.backend.armed); });
    else if (button.matches('[data-output-test]')) operation(async () => { const pin = +button.dataset.outputTest; pp.backend = await api.parallelTest(pin, pp.backend.testPin !== pin); });
    else if (button.matches('[data-save]')) operation(async () => { if (issues().length) return; await ppClose(); const value = copy(s); const next = await api.setSettings({ parallelPort: value }); state.settings = next; saved = copy(value); s = copy(value); pp.draft = null; pp.dirty = false; L.configure(value); message('Settings saved. Ready to connect.'); });
    else if (button.matches('[data-undo]')) { s = copy(saved); pp.draft = null; pp.dirty = false; fields(); editors(); inspector(); sync(); message('Changes undone. Saved settings restored.'); }
    else if (button.matches('[data-reset]')) { s = P.defaults(); changed(true); }
  };
  qa('[data-section]').forEach(section => { let wasOpen = section.open; section.addEventListener('toggle', () => { if (section.open && !wasOpen) { current = section.dataset.section; sync(); } wasOpen = section.open; }); });
  const schedule = () => { if (!updateTimer) updateTimer = setTimeout(() => { updateTimer = null; sync(); }, 100); };
  pp.listeners.add(schedule);
  ppPageDispose = () => { disposed = true; pp.listeners.delete(schedule); clearTimeout(updateTimer); if (pp.backend.armed && api.parallelArm) api.parallelArm(false).catch(() => {}); ppPageDispose = null; };
  q('[data-keep-log]').checked = pp.detailed; fields(); editors(); connector(); sync();
  if (pp.error) message(pp.error);
}
