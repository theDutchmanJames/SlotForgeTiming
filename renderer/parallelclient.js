// One connection for the life of the main window; changing tabs never replaces its timing link.
const pp = { initialized: false, opening: false, busy: false, pending: [], backend: {}, checked: null, logs: [], detailed: false, listeners: new Set(), draft: null, dirty: false, error: '', t0: 0 };
const ppSettings = () => ParallelPort.config(state.settings.parallelPort);
const ppNotify = () => pp.listeners.forEach(f => f());
const ppLog = text => { pp.logs.push(text); if (pp.logs.length > 1000) pp.logs.splice(0, 200); ppNotify(); };
function ppInit() {
  if (pp.initialized || !api.onParallel) return;
  pp.initialized = true; ParallelPort.link.configure(ppSettings());
  if (api.parallelState) api.parallelState().then(value => { pp.backend = value; ppNotify(); }).catch(x => { pp.error = x.message; ppNotify(); });
  api.onParallel(event => {
    if (event.type === 'sample') {
      const sample = { ...event, at: event.at - performance.timeOrigin };
      const raw = event.status + ':' + event.control;
      if (pp.detailed && raw !== pp.lastRaw) ppLog(((sample.at - pp.t0) / 1000).toFixed(3).padStart(9) + ' s  INPUT seq=' + event.seq + ' status=0x' + event.status.toString(16).padStart(2, '0') + ' control=0x' + event.control.toString(16).padStart(2, '0') + ' maxGap=' + event.gap.toFixed(3) + ' ms');
      pp.lastRaw = raw;
      if (pp.opening) { if (pp.pending.length < 16384) pp.pending.push(sample); else { pp.error = 'Timing buffer overflow while connecting.'; api.parallelClose().catch(() => {}); } }
      else ParallelPort.link.feed(sample);
    } else if (event.type === 'state') {
      pp.backend = event; pp.error = event.error || '';
      if (!event.connected) ParallelPort.link.setConnected(false);
    }
    ppNotify();
  });
  if (api.parallelAlive) setInterval(() => { if (pp.backend.connected) api.parallelAlive().catch(() => {}); }, 500);
  ParallelPort.link.on(event => {
    const stamp = ((event.at - pp.t0) / 1000).toFixed(3).padStart(9);
    ppLog(stamp + ' s  ' + (event.type === 'call' ? 'Track-call button' : 'Lane ' + (event.lane + 1) + ' · ' + ({ hit: 'crossing', block: 'pit hold reached', free: 'sensor clear', pit: event.in ? 'pit entered' : 'pit left' }[event.type] || event.type)));
  });
}
async function ppConnect() {
  ppInit(); if (!api.parallelOpen) throw Error('Parallel-port access needs the Windows desktop app.');
  if (ParallelPort.link.connected) return true;
  if (pp.busy) throw Error('Wait for the current port operation.');
  const config = ppSettings(), issues = ParallelPort.validate(config); if (issues.length) throw Error(issues[0].text);
  pp.busy = pp.opening = true; pp.pending = []; pp.error = ''; pp.t0 = performance.now(); pp.lastRaw = null; ParallelPort.link.configure(config); ppNotify();
  try {
    const result = await api.parallelOpen(config); pp.backend = result;
    if (pp.error) throw Error(pp.error);
    ParallelPort.link.setConnected(true);
    pp.opening = false; for (const sample of pp.pending) ParallelPort.link.feed(sample); pp.pending = [];
    pp.checked = { accessible: true, message: 'Driver accessible. Check each sensor in the live monitor.' }; pp.lastRaw = null; ppLog('Connected to ' + config.name + '. Clock alignment uncertainty ±' + Number(result.clockUncertainty || 0).toFixed(3) + ' ms.');
    return true;
  } catch (x) { ParallelPort.link.setConnected(false); pp.error = x.message; ppLog('Connection failed: ' + x.message); throw x; }
  finally { pp.busy = pp.opening = false; ppNotify(); }
}
async function ppClose() {
  if (pp.closing) return pp.closing;
  pp.closing = (async () => { if (api.parallelClose) await api.parallelClose(); ParallelPort.link.setConnected(false); pp.backend = { connected: false }; ppNotify(); })();
  try { return await pp.closing; } finally { pp.closing = null; }
}
async function ppAutoConnect() {
  ppInit(); if (!ppSettings().autoConnect || Hardware.timingChosen(state.settings) !== 'parallel' || ParallelPort.link.connected) return false;
  try { return await ppConnect(); } catch { return false; }
}
