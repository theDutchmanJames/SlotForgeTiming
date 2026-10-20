// The Performance line (1.60.0): what the window and the app are doing while they run, so a slow computer (a Raspberry Pi) can be looked at instead of guessed about.
// Two sides: this window measures its own frames, its screen updates and its long tasks (createMonitor); the core of the app (main.js, perfstats.js) tells about the processes,
// the graphics, the screen, the computer and the race save. This file puts the two together as a line and as a report that can be copied. Pure, so it can be tested without a screen.
(function (root) {
  const WINDOW = 10000, FPS_WINDOW = 2000; // (the figures are over the last ten seconds; the frames a second over the last two)
  const isNum = v => typeof v === 'number' && Number.isFinite(v);
  const num = (v, lo, hi, d) => (isNum(v) ? Math.min(hi, Math.max(lo, v)) : d);
  const text = (v, n = 200) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n) : '');
  const r1 = v => Math.round(v * 10) / 10;
  const f1 = v => (isNum(v) ? String(r1(v)) : '–');
  const f0 = v => (isNum(v) ? String(Math.round(v)) : '–');

  // ---- this window: frames, screen updates, long tasks ----
  function createMonitor(o = {}) {
    const clock = o.now || (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
    const st = { frames: [], updates: [], longs: [], skip: [], last: null, started: null };
    const prune = (a, t, w) => { while (a.length && t - a[0][0] > w) a.shift(); };
    const begin = t => { if (st.started === null) st.started = t; };
    return {
      // a frame was drawn (called from requestAnimationFrame): t in ms
      frame(t = clock()) { begin(t); if (st.last !== null) st.frames.push([t, t - st.last]); st.last = t; prune(st.frames, t, WINDOW); },
      // a screen update of the race took ms
      update(ms, t = clock()) { begin(t); if (isNum(ms) && ms >= 0) st.updates.push([t, ms]); prune(st.updates, t, WINDOW); },
      // the window was stuck for ms (a long task)
      long(ms, t = clock()) { begin(t); if (isNum(ms) && ms >= 0) st.longs.push([t, ms]); prune(st.longs, t, WINDOW); },
      // the total of writes to the page that were left out (quiet.js), at this moment
      skipped(total, t = clock()) { begin(t); if (isNum(total)) st.skip.push([t, total]); prune(st.skip, t, WINDOW); },
      reset() { st.frames.length = st.updates.length = st.longs.length = st.skip.length = 0; st.last = null; st.started = null; },
      snapshot(t = clock()) {
        [st.frames, st.updates, st.longs, st.skip].forEach(a => prune(a, t, WINDOW));
        const seen = st.started === null ? 0 : Math.min(WINDOW, t - st.started), fspan = Math.min(FPS_WINDOW, seen);
        const inWin = st.frames.filter(f => t - f[0] <= FPS_WINDOW).length;
        const ups = st.updates, sum = ups.reduce((n, u) => n + u[1], 0);
        const sk = st.skip.length >= 2 && st.skip[st.skip.length - 1][0] > st.skip[0][0] ? (st.skip[st.skip.length - 1][1] - st.skip[0][1]) / ((st.skip[st.skip.length - 1][0] - st.skip[0][0]) / 1000) : null;
        return {
          seconds: r1(seen / 1000),
          fps: fspan >= 500 ? Math.round(inWin / (fspan / 1000)) : null,
          slowest: st.frames.length ? Math.round(Math.max(...st.frames.map(f => f[1]))) : null,
          updates: seen >= 1000 ? r1(ups.length / (seen / 1000)) : null,
          updateAvg: ups.length ? Math.round(sum / ups.length * 100) / 100 : null,
          updateMax: ups.length ? Math.round(Math.max(...ups.map(u => u[1])) * 100) / 100 : null,
          updateLoad: seen >= 1000 ? r1(sum / seen * 100) : null,
          longCount: st.longs.length,
          longMax: st.longs.length ? Math.round(Math.max(...st.longs.map(l => l[1]))) : 0,
          skipped: sk === null ? null : Math.max(0, Math.round(sk))
        };
      }
    };
  }

  // ---- what the core of the app tells (perfstats.js), made safe: it comes over a link, and an old or odd answer must not break the page ----
  const TYPE_OF = { Tab: 'window', GPU: 'graphics', Browser: 'core' };
  const isOn = v => typeof v === 'string' && v.startsWith('enabled');
  function cleanMain(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const procs = { window: 0, graphics: 0, core: 0, other: 0, total: 0, memoryMB: 0 };
    (Array.isArray(raw.metrics) ? raw.metrics.slice(0, 64) : []).forEach(p => {
      if (!p || typeof p !== 'object') return;
      const k = TYPE_OF[p.type] || 'other', c = num(p.cpu, 0, 10000, 0);
      procs[k] += c; procs.total += c; procs.memoryMB += num(p.memMB, 0, 1e6, 0);
    });
    Object.keys(procs).forEach(k => { procs[k] = r1(procs[k]); });
    const gs = raw.gpuStatus && typeof raw.gpuStatus === 'object' ? raw.gpuStatus : {}, compositing = gs.gpu_compositing !== undefined ? gs.gpu_compositing : gs.compositing;
    const status = {}; ['gpu_compositing', 'compositing', 'rasterization', 'opengl', 'webgl', 'webgl2', 'canvas_oop_rasterization', 'vulkan'].forEach(k => { if (typeof gs[k] === 'string') status[k] = text(gs[k], 40); });
    const d = raw.display && typeof raw.display === 'object' ? raw.display : {}, o = raw.os && typeof raw.os === 'object' ? raw.os : {}, v = raw.versions && typeof raw.versions === 'object' ? raw.versions : {};
    const th = raw.thermal && typeof raw.thermal === 'object' ? raw.thermal : {}, lag = raw.lag && typeof raw.lag === 'object' ? raw.lag : {}, sv = raw.save && typeof raw.save === 'object' ? raw.save : {};
    return {
      procs,
      gpu: { drawsWindow: compositing === undefined ? null : isOn(compositing), drawsContent: gs.rasterization === undefined ? null : isOn(gs.rasterization), status, device: text(raw.gpuDevice, 160) },
      display: { width: num(d.width, 0, 100000, 0), height: num(d.height, 0, 100000, 0), scale: num(d.scale, 0, 20, 1), count: num(d.count, 0, 64, 1) },
      session: text(raw.session, 20), switches: (Array.isArray(raw.switches) ? raw.switches : []).slice(0, 12).map(s => text(s, 60)).filter(Boolean),
      os: { platform: text(o.platform, 20), arch: text(o.arch, 20), release: text(o.release, 40), model: text(o.model, 80), cpuModel: text(o.cpuModel, 80), cpus: num(o.cpus, 0, 1024, 0), memoryMB: num(o.memoryMB, 0, 1e7, 0), freeMB: num(o.freeMB, 0, 1e7, 0),
        load: (Array.isArray(o.load) ? o.load : []).slice(0, 3).map(x => num(x, 0, 10000, 0)).map(r1) },
      thermal: { tempC: isNum(th.tempC) ? r1(num(th.tempC, -50, 200, 0)) : null, mhz: isNum(th.mhz) ? Math.round(num(th.mhz, 0, 20000, 0)) : null, maxMhz: isNum(th.maxMhz) ? Math.round(num(th.maxMhz, 0, 20000, 0)) : null, governor: text(th.governor, 30) },
      versions: { app: text(v.app, 20), electron: text(v.electron, 20), chrome: text(v.chrome, 30), node: text(v.node, 20) },
      lag: { max10: isNum(lag.max10) ? Math.round(num(lag.max10, 0, 3.6e6, 0)) : null, max60: isNum(lag.max60) ? Math.round(num(lag.max60, 0, 3.6e6, 0)) : null, all: isNum(lag.all) ? Math.round(num(lag.all, 0, 3.6e6, 0)) : null },
      save: { writes: num(sv.writes, 0, 1e9, 0), lastMs: num(sv.lastMs, 0, 1e6, 0), maxMs: num(sv.maxMs, 0, 1e6, 0), failed: num(sv.failed, 0, 1e9, 0) },
      at: isNum(raw.at) ? raw.at : null
    };
  }

  // ---- the line (the race screen, small) ----
  function line(r, m) {
    const p = [];
    if (r) {
      p.push(r.fps === null ? 'measuring...' : `${r.fps} frames/s`);
      if (r.slowest !== null) p.push(`slowest frame ${r.slowest} ms`);
      if (r.updateAvg !== null) p.push(`screen update ${f1(r.updateAvg)} ms (${f0(r.updates)}/s)`);
    }
    if (m) {
      p.push(`app CPU ${f0(m.procs.total)}% (window ${f0(m.procs.window)}, graphics ${f0(m.procs.graphics)}, core ${f0(m.procs.core)})`);
      if (m.lag.max10 !== null) p.push(`core stalled up to ${m.lag.max10} ms`);
      if (m.save.writes) p.push(`race save ${f1(m.save.lastMs)} ms`);
    }
    return p.join(' · ');
  }

  // ---- notes: what the figures may mean (only what the figures show; none when all is well) ----
  function notes(r, m) {
    const n = [];
    if (m) {
      if (m.gpu.drawsWindow === false) n.push('The window is drawn in software: the processor does all the drawing, which is the most common reason for a slow screen on a Raspberry Pi. Look at the graphics lines of the report.');
      else if (m.gpu.drawsContent === false) n.push('The graphics card draws the window but not what is in it (text, shadows, pictures): the processor does that part.');
      if (m.thermal.tempC !== null && m.thermal.tempC >= 80) n.push(`The processor is hot (${m.thermal.tempC} °C): it slows itself down to cool off. A fan or a heat sink helps.`);
      else if (m.thermal.mhz && m.thermal.maxMhz && m.thermal.mhz < m.thermal.maxMhz * 0.7) n.push(`The processor runs at ${m.thermal.mhz} MHz of ${m.thermal.maxMhz} MHz. That can be the power saving, or the heat; look at the temperature.`);
      if (m.lag.max10 !== null && m.lag.max10 >= 100) n.push(`The core of the app was stuck for ${m.lag.max10} ms in the last ten seconds: the whole window waits when that happens.`);
      if (m.save.maxMs >= 150) n.push(`Saving the race took up to ${f0(m.save.maxMs)} ms. That goes on in the background, but a slow disk (an SD card) can be the cause of other waits.`);
      if (m.save.failed) n.push(`${m.save.failed} race save(s) could not be written.`);
      if (m.os.memoryMB && m.os.freeMB && m.os.freeMB < m.os.memoryMB * 0.1) n.push(`The computer is nearly out of memory (${m.os.freeMB} MB of ${m.os.memoryMB} MB free).`);
      if (m.os.cpus && m.procs.total > m.os.cpus * 70) n.push('The app uses nearly all of the processor.');
    }
    if (r) {
      if (r.fps !== null && r.fps < 25) n.push(`The window draws ${r.fps} frames a second: it looks jerky below about 30.`);
      if (r.updateLoad !== null && r.updateLoad > 10) n.push(`The race screen spends ${f0(r.updateLoad)}% of the time on its updates.`);
      if (r.longCount) n.push(`The window was stuck ${r.longCount} time(s) in the last ten seconds, the longest ${r.longMax} ms.`);
    }
    return n;
  }

  // ---- the report (to copy and send) ----
  // extra: what only the window knows: { version, when, screen: {w, h, dpr}, race: {name, widgets, lanes} | null, speedNote }
  function report(r, m, extra = {}) {
    const L = [];
    const ver = text(extra.version, 20) || (m && m.versions.app);
    L.push(`SlotForge Timing${ver ? ' ' + ver : ''}: performance report${extra.when ? ' (' + text(extra.when, 40) + ')' : ''}`);
    if (m) {
      const o = m.os, bits = [o.model || (o.platform + (o.arch ? ' ' + o.arch : '')), o.cpus ? `${o.cpus} x ${o.cpuModel || 'processor'}` : '', o.memoryMB ? `${f0(o.memoryMB / 1024 * 10) / 10} GB memory (${f0(o.freeMB / 1024 * 10) / 10} GB free)` : ''].filter(Boolean);
      L.push('Computer: ' + bits.join(', ') + (o.release ? ` [${o.platform} ${o.release}]` : ''));
      if (o.load.length) L.push(`Load average: ${o.load.join(' / ')}`);
      if (m.thermal.tempC !== null || m.thermal.mhz) L.push(`Processor: ${m.thermal.tempC !== null ? m.thermal.tempC + ' °C' : 'temperature unknown'}${m.thermal.mhz ? `, ${m.thermal.mhz} MHz` + (m.thermal.maxMhz ? ` of ${m.thermal.maxMhz} MHz` : '') : ''}${m.thermal.governor ? ', ' + m.thermal.governor : ''}`);
      const d = m.display; L.push(`Screen: ${d.width} x ${d.height}${d.scale !== 1 ? ' at ' + Math.round(d.scale * 100) + '%' : ''}${d.count > 1 ? `, ${d.count} screens` : ''}${m.session ? ', ' + m.session + ' session' : ''}`);
      if (m.versions.electron) L.push(`Electron ${m.versions.electron}, Chromium ${m.versions.chrome}, Node ${m.versions.node}`);
      L.push(`Graphics: window drawn by ${m.gpu.drawsWindow === null ? 'unknown' : m.gpu.drawsWindow ? 'the graphics card' : 'SOFTWARE (the processor)'}, contents drawn by ${m.gpu.drawsContent === null ? 'unknown' : m.gpu.drawsContent ? 'the graphics card' : 'the processor'}${m.gpu.device ? ' [' + m.gpu.device + ']' : ''}`);
      const st = Object.keys(m.gpu.status).map(k => `${k}=${m.gpu.status[k]}`).join(', '); if (st) L.push('Graphics status: ' + st);
      if (m.switches.length) L.push('Started with: ' + m.switches.join(' '));
    } else L.push('The core of the app did not answer (a page on a phone, or an older version): only the window figures follow.');
    if (extra.screen) L.push(`Window: ${f0(extra.screen.w)} x ${f0(extra.screen.h)}${extra.screen.dpr && extra.screen.dpr !== 1 ? ' at ' + Math.round(extra.screen.dpr * 100) + '%' : ''}`);
    if (extra.race) L.push(`Race screen: ${text(extra.race.name, 60) || 'open'}, ${f0(extra.race.widgets)} widgets, ${f0(extra.race.lanes)} lanes`); else L.push('Race screen: not open');
    if (r) {
      L.push(`Frames: ${r.fps === null ? 'measuring' : r.fps + ' a second'}, slowest frame ${r.slowest === null ? '–' : r.slowest + ' ms'} (last ${f0(Math.min(10, r.seconds))} seconds)`);
      L.push(`Screen updates: ${r.updateAvg === null ? 'none (no race running)' : `${f0(r.updates)} a second, ${f1(r.updateAvg)} ms each, slowest ${f1(r.updateMax)} ms, ${f1(r.updateLoad)}% of the time`}`);
      L.push(`Window stuck (long tasks over 50 ms): ${r.longCount} time(s), longest ${r.longMax} ms`);
      L.push(`Writes to the page left out because the value was the same: ${r.skipped === null ? '–' : f0(r.skipped) + ' a second'}`);
    }
    if (m) {
      L.push(`CPU of the app (% of one core): total ${f0(m.procs.total)}, window ${f0(m.procs.window)}, graphics ${f0(m.procs.graphics)}, core ${f0(m.procs.core)}, other ${f0(m.procs.other)}; memory ${f0(m.procs.memoryMB)} MB`);
      L.push(`Core of the app stalled: up to ${m.lag.max10 === null ? '–' : m.lag.max10} ms (10 s), ${m.lag.max60 === null ? '–' : m.lag.max60} ms (60 s), ${m.lag.all === null ? '–' : m.lag.all} ms (since measuring began)`);
      L.push(`Race save: ${m.save.writes} written, last ${f1(m.save.lastMs)} ms, slowest ${f1(m.save.maxMs)} ms, ${m.save.failed} failed`);
    }
    const nn = notes(r, m); if (nn.length) { L.push('', 'Notes:'); nn.forEach(x => L.push('- ' + x)); }
    return L.join('\n');
  }

  const api = { createMonitor, cleanMain, line, report, notes, WINDOW, FPS_WINDOW };
  root.Perf = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
