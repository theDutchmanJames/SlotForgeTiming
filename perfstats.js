// What the core of the app can tell about how the computer and the app are doing (1.60.0, the Performance line): the processes and their CPU, the graphics, the screen,
// the computer, the processor's temperature and speed (Linux), how long the core was stuck, and how the race save goes. Everything is given to it (app, screen, os, process,
// the database, a function that reads a text file), so it can be tested without Electron. The window turns the answer into a line and a report (renderer/perf.js).
const STEP = 100;          // the core looks at the clock every 100 ms to see whether it was stuck
const KEEP = 60000;        // ...and remembers it for a minute
const IDLE_STOP = 30000;   // nobody asked for 30 seconds: it stops looking (nothing runs when the Performance line is not shown)

function createCollector(d) {
  const now = d.now || Date.now, setI = d.setInterval || setInterval, clearI = d.clearInterval || clearInterval;
  const st = { timer: null, last: 0, lags: [], all: 0, asked: 0, gpuDevice: null };
  const sample = () => {
    const t = now(), lag = Math.max(0, t - st.last - STEP); st.last = t;
    st.lags.push([t, lag]); if (lag > st.all) st.all = lag;
    while (st.lags.length && t - st.lags[0][0] > KEEP) st.lags.shift();
    if (t - st.asked > IDLE_STOP) stop();
  };
  const stop = () => { if (st.timer !== null) { clearI(st.timer); st.timer = null; } };
  const touch = () => {
    st.asked = now();
    if (st.timer === null) { st.last = now(); st.timer = setI(sample, STEP); if (st.timer && st.timer.unref) st.timer.unref(); }
  };
  const lagOf = ms => { const t = now(); let m = 0; st.lags.forEach(([at, l]) => { if (t - at <= ms && l > m) m = l; }); return m; };
  const text = async p => { try { const s = await d.readText(p); return typeof s === 'string' ? s : null; } catch { return null; } };
  const first = (a, f) => { for (const x of a) { const v = f(x); if (v) return v; } return ''; };

  async function gpuDevice() {
    if (st.gpuDevice !== null) return st.gpuDevice;
    let timer;
    try {
      const info = await Promise.race([d.app.getGPUInfo('basic'), new Promise((_, no) => { timer = setTimeout(() => no(new Error('slow')), 800); })]);
      const devs = (info && Array.isArray(info.gpuDevice) ? info.gpuDevice : []).filter(Boolean), dev = devs.find(x => x.active) || devs[0] || {};
      const aux = info && info.auxAttributes || {};
      const name = [aux.glRenderer, dev.deviceString, dev.driverVendor, dev.driverVersion].filter(x => typeof x === 'string' && x).join(' ') || (dev.vendorId ? `vendor ${dev.vendorId} device ${dev.deviceId}` : '');
      st.gpuDevice = name;
    } catch { return ''; } finally { clearTimeout(timer); } // (an answer that did not come is not kept: asked again next time)
    return st.gpuDevice;
  }

  // the answer; touch() first, so the sampling is running from the first question on
  async function collect() {
    touch();
    const out = { at: now() };
    try { out.metrics = (d.app.getAppMetrics() || []).map(m => ({ type: m.type, cpu: m.cpu && m.cpu.percentCPUUsage, memMB: m.memory && m.memory.workingSetSize ? m.memory.workingSetSize / 1024 : 0 })); } catch { out.metrics = []; }
    try { out.gpuStatus = d.app.getGPUFeatureStatus(); } catch { out.gpuStatus = {}; }
    out.gpuDevice = await gpuDevice();
    try { const s = d.screen.getPrimaryDisplay(); out.display = { width: s.size.width, height: s.size.height, scale: s.scaleFactor, count: d.screen.getAllDisplays().length }; } catch { out.display = {}; }
    const env = d.process.env || {};
    out.session = env.XDG_SESSION_TYPE || (env.WAYLAND_DISPLAY ? 'wayland' : env.DISPLAY ? 'x11' : '');
    out.switches = (d.process.argv || []).filter(a => /^--(disable-gpu|enable-gpu|ignore-gpu|use-gl|use-angle|ozone|enable-features|disable-features|in-process-gpu|disable-software|force-device-scale|enable-unsafe-webgpu|no-sandbox)/.test(a));
    try {
      const cpus = d.os.cpus() || [];
      out.os = { platform: d.os.platform(), arch: d.os.arch(), release: d.os.release(), cpuModel: cpus[0] ? cpus[0].model : '', cpus: cpus.length, memoryMB: Math.round(d.os.totalmem() / 1048576), freeMB: Math.round(d.os.freemem() / 1048576), load: d.os.loadavg() };
    } catch { out.os = {}; }
    if (d.os && d.os.platform && d.os.platform() === 'linux') {
      // a Raspberry Pi says which one it is, and how hot and how fast the processor is (a hot processor slows itself down)
      const [model, temp, cur, max, gov] = await Promise.all(['/proc/device-tree/model', '/sys/class/thermal/thermal_zone0/temp', '/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq', '/sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_max_freq', '/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor'].map(text));
      if (model) out.os.model = model.replace(/\u0000/g, '').trim();
      const n = s => { const v = Number(s && s.trim()); return Number.isFinite(v) && s && s.trim() !== '' ? v : null; };
      out.thermal = { tempC: n(temp) === null ? null : n(temp) / 1000, mhz: n(cur) === null ? null : n(cur) / 1000, maxMhz: n(max) === null ? null : n(max) / 1000, governor: gov ? gov.trim() : '' };
    } else out.thermal = {};
    out.versions = { app: d.version || '', electron: d.process.versions && d.process.versions.electron || '', chrome: d.process.versions && d.process.versions.chrome || '', node: d.process.versions && d.process.versions.node || '' };
    out.lag = { max10: lagOf(10000), max60: lagOf(KEEP), all: st.all };
    out.save = d.db && d.db.resumeStats ? d.db.resumeStats() : {};
    return out;
  }
  return { collect, touch, stop, running: () => st.timer !== null, sample, size: () => st.lags.length };
}

module.exports = { createCollector, STEP, KEEP, IDLE_STOP };
