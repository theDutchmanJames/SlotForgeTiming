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

  // ---- this window: frames, screen updates, long tasks, and (1.60.1) where the time of an update goes, the worst of the race, a row every 30 seconds ----
  const HIST_EVERY = 30000, HIST_MAX = 240, MARKS_MAX = 40;
  const mean = (a, f) => (a.length ? a.reduce((n, x) => n + f(x), 0) / a.length : 0);
  // the parts of one update, added up by name, the biggest three of at least a millisecond (a list of [name, ms]); the rest is small enough to leave out
  const worstParts = list => {
    const by = new Map(); list.forEach(([n, v]) => by.set(n, (by.get(n) || 0) + v));
    return [...by.entries()].filter(x => x[1] >= 1).sort((a, b) => b[1] - a[1]).slice(0, 3);
  };
  // 1.60.5: the widgets of one update, added up by type, the biggest four of at least a millisecond ([type, draw, write, fit] each; count = how many of that type)
  const worstWidgets = list => {
    const by = new Map(); list.forEach(([t, d, w, f]) => { const a = by.get(t) || { type: t, count: 0, draw: 0, write: 0, fit: 0 }; a.count++; a.draw += d; a.write += w; a.fit += f; by.set(t, a); });
    return [...by.values()].map(a => ({ ...a, ms: a.draw + a.write + a.fit })).filter(a => a.ms >= 1).sort((a, b) => b.ms - a.ms).slice(0, 4);
  };
  const SLOW_UPDATE = 20, SLOW_KEEP = 60; // (an update of this many ms or more keeps its parts and its widgets for a while, so a row of the report can say what its slowest update was)
  // the reasons a Delta Timer badge is measured (delta.js fitBadge), and how that measure turned out
  const DELTA_WHY = ['skip', 'first', 'shape', 'recheck', 'again', 'resize'], DELTA_HOW = ['roomy', 'shrunk', 'tight', 'unknown'];
  const outParts = list => (list || []).map(x => ({ name: x[0], ms: r1(x[1]) }));
  const outWidgets = list => (list || []).map(a => ({ type: a.type, count: a.count, ms: r1(a.ms), draw: r1(a.draw), write: r1(a.write), fit: r1(a.fit) }));
  const geo = m => (m && typeof m === 'object' ? { boxW: r1(num(m.boxW, 0, 1e5, 0)), boxH: r1(num(m.boxH, 0, 1e5, 0)), w: r1(num(m.w, 0, 1e5, 0)), h: r1(num(m.h, 0, 1e5, 0)), row: m.row === true ? true : m.row === false ? false : null } : null);
  function createMonitor(o = {}) {
    const clock = o.now || (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
    const wallNow = o.wall || Date.now;
    const st = { frames: [], updates: [], longs: [], skip: [], loafs: [], buckets: [], cur: null, last: null, started: null, race: null, hist: [], histAt: null, marks: [], upd: [], updw: [], slowups: [], dlast: Object.create(null) };
    const prune = (a, t, w) => { while (a.length && t - a[0][0] > w) a.shift(); };
    const begin = t => { if (st.started === null) st.started = t; };
    const peak = (k, v) => { if (st.race && v > st.race[k]) st.race[k] = v; }; // (the callers only give numbers or null; null is never more)
    const pile = t => { // (the one-second pile that the times of the parts and of the widgets are added to)
      if (!st.cur || t - st.cur.start >= 1000) { if (st.cur) st.buckets.push(st.cur); st.cur = { start: t, parts: Object.create(null), widgets: Object.create(null), deltas: Object.create(null) }; }
      while (st.buckets.length && t - st.buckets[0].start > WINDOW) st.buckets.shift();
      return st.cur;
    };
    // (1.60.5) what the slowest update of the last ten seconds was, when it kept its parts and widgets (it took SLOW_UPDATE ms or more) and it is the one the row's 'slowest' is about
    const slowOf = (r, t) => {
      const sl = st.slowups.filter(x => t - x[0] <= WINDOW).reduce((a, x) => (!a || x[1] > a[1] ? x : a), null);
      return sl && isNum(r.updateMax) && Math.abs(Math.round(sl[1] * 100) / 100 - r.updateMax) < 0.011 ? { ms: r1(sl[1]), parts: outParts(sl[2]), widgets: outWidgets(sl[3]) } : null;
    };
    const due = (t = clock()) => st.race !== null && (st.histAt === null || t - st.histAt >= HIST_EVERY);
    return {
      // a frame was drawn (called from requestAnimationFrame): t in ms
      frame(t = clock()) { begin(t); if (st.last !== null) { st.frames.push([t, t - st.last]); if (t - st.last <= 2000) peak('frame', t - st.last); } st.last = t; prune(st.frames, t, WINDOW); }, // (a gap of more than two seconds is a window that was hidden, not a slow frame)
      // a screen update of the race took ms
      // (1.60.4: the update that is the longest of the race keeps which parts it spent its time on, and when: a report with 227 ms as the longest update then says whether that was the save point, the widgets or something else)
      update(ms, t = clock()) {
        begin(t);
        if (isNum(ms) && ms >= 0) {
          // (1.60.5: also which widgets; and an update of SLOW_UPDATE ms or more keeps its parts and widgets for the window, so the row of the report that has it as its slowest can say what it was)
          const longest = !!st.race && ms > st.race.update, keep = ms >= SLOW_UPDATE;
          const parts = longest || keep ? worstParts(st.upd) : null, wids = longest || keep ? worstWidgets(st.updw) : null;
          if (longest) { st.race.updateAt = (t - st.race.t0) / 1000; st.race.updateParts = parts; st.race.updateWidgets = wids; }
          if (keep) { st.slowups.push([t, ms, parts, wids]); if (st.slowups.length > SLOW_KEEP) st.slowups.shift(); }
          st.updates.push([t, ms]); peak('update', ms);
        }
        st.upd = []; st.updw = []; prune(st.updates, t, WINDOW); prune(st.slowups, t, WINDOW);
      },
      // the window was stuck for ms (a long task)
      long(ms, t = clock()) { begin(t); if (isNum(ms) && ms >= 0) { st.longs.push([t, ms]); peak('long', ms); } prune(st.longs, t, WINDOW); },
      // the total of writes to the page that were left out (quiet.js), at this moment
      skipped(total, t = clock()) { begin(t); if (isNum(total)) st.skip.push([t, total]); prune(st.skip, t, WINDOW); },
      // a part of a screen update (the state, the widgets, the panels...) took ms
      part(name, ms, t = clock()) { begin(t); if (typeof name !== 'string' || !isNum(ms) || ms < 0) return; const b = pile(t); b.parts[name] = (b.parts[name] || 0) + ms; st.upd.push([name, ms]); if (st.upd.length > 40) st.upd.shift(); },
      // a widget of this type was drawn: ms to make its text, to put it in the page, to fit it to its place
      widget(type, drawMs, writeMs, fitMs, t = clock()) {
        begin(t); if (typeof type !== 'string' || ![drawMs, writeMs, fitMs].every(v => isNum(v) && v >= 0)) return;
        const b = pile(t), a = b.widgets[type] || (b.widgets[type] = [0, 0, 0, 0]); a[0] += drawMs; a[1] += writeMs; a[2] += fitMs; a[3]++;
        st.updw.push([type, drawMs, writeMs, fitMs]); if (st.updw.length > 300) st.updw.shift();
      },
      // 1.60.5: a Delta Timer badge was looked at (delta.js fitBadge): r.why = skip (left alone), first, shape (the text changed shape), recheck (every 30th), again (it did not fit with room
      // to spare the last time), resize (the widget or the window changed size); when it was measured r.how = roomy, shrunk, tight (fitted, but with no room to spare) or unknown, r.steps = how
      // many times it was made smaller, r.m = the first measure (the badge box and its text, px), r.key / r.prev = the shape of the text now and before (when it changed shape)
      delta(type, r, t = clock()) {
        begin(t); if (typeof type !== 'string' || !r || typeof r !== 'object' || !DELTA_WHY.includes(r.why)) return;
        const b = pile(t), a = b.deltas[type] || (b.deltas[type] = { calls: 0, skip: 0, first: 0, shape: 0, recheck: 0, again: 0, resize: 0, kept: 0, roomy: 0, shrunk: 0, tight: 0, unknown: 0, steps: 0 });
        if (r.why === 'resize') { a.resize++; return; } // (the widget or the window changed size: delta.js fit() measures every badge of the widget again; not one of the calls of the update)
        a.calls++; a[r.why]++;
        if (r.why === 'skip') { if (r.how === 'kept') a.kept++; return; } // (1.60.7: left alone, and given the smaller size that was found before)
        const how = DELTA_HOW.includes(r.how) ? r.how : 'unknown'; a[how]++; a.steps += num(r.steps, 0, 10, 0);
        const d = st.dlast[type] || (st.dlast[type] = { m: null, how: null, steps: 0, from: null, to: null });
        d.m = geo(r.m); d.how = how; d.steps = num(r.steps, 0, 10, 0);
        if (r.why === 'shape' && typeof r.key === 'string') { d.from = text(r.prev, 100); d.to = text(r.key, 100); }
      },
      // a long animation frame (a frame that took over 50 ms; see loafFrom)
      loaf(x, t = clock()) { begin(t); if (x && isNum(x.dur) && x.dur <= 2000) { st.loafs.push([t, x]); peak('loaf', x.dur); } prune(st.loafs, t, WINDOW); }, // (as with a frame: over two seconds is a window that was hidden, not a slow frame; 1.60.3)
      // something happened that is worth knowing when the figures are read (a race started, a window was opened): it gets the clock time
      mark(txt, wall = wallNow()) { const s = text(txt, 80); if (!s) return; st.marks.push({ at: wall, text: s }); while (st.marks.length > MARKS_MAX) st.marks.shift(); },
      // a race starts: the worst figures and the rows start again (they stay after the race, so a report copied afterwards still has them)
      newRace(t = clock(), wall = wallNow()) { st.race = { wall, t0: t, frame: 0, update: 0, updateAt: null, updateParts: [], updateWidgets: [], long: 0, load: 0, loaf: 0, minFps: null }; st.hist = []; st.histAt = null; st.upd = []; st.updw = []; },
      due,
      // a row of the history: only once in 30 seconds, and only in a race
      sample(r, m, extra, t = clock()) {
        if (!r || !due(t)) return false;
        st.histAt = t;
        const e = extra || {};
        st.hist.push({ at: Math.round((t - st.race.t0) / 1000), fps: r.fps, update: r.updateAvg, updateMax: r.updateMax, load: r.updateLoad, memMB: m ? Math.round(m.procs.memoryMB) : null, winCpu: m ? Math.round(m.procs.window) : null,
          heapMB: isNum(e.heapMB) ? Math.round(e.heapMB) : null, dom: isNum(e.dom) ? Math.round(e.dom) : null, slow: slowOf(r, t) });
        while (st.hist.length > HIST_MAX) st.hist.shift();
        return true;
      },
      // the window figures start again (somebody looks again); the worst of the race, its rows and the marks stay
      reset() { st.frames.length = st.updates.length = st.longs.length = st.skip.length = st.loafs.length = st.buckets.length = 0; st.cur = null; st.last = null; st.started = null; st.upd = []; st.updw = []; st.slowups.length = 0; st.dlast = Object.create(null); },
      snapshot(t = clock()) {
        [st.frames, st.updates, st.longs, st.skip, st.loafs].forEach(a => prune(a, t, WINDOW));
        const seen = st.started === null ? 0 : Math.min(WINDOW, t - st.started), fspan = Math.min(FPS_WINDOW, seen);
        const inWin = st.frames.filter(f => t - f[0] <= FPS_WINDOW).length;
        const ups = st.updates, sum = ups.reduce((n, u) => n + u[1], 0);
        const sk = st.skip.length >= 2 && st.skip[st.skip.length - 1][0] > st.skip[0][0] ? (st.skip[st.skip.length - 1][1] - st.skip[0][1]) / ((st.skip[st.skip.length - 1][0] - st.skip[0][0]) / 1000) : null;
        // where the time of an update goes: the totals of the last ten seconds, shared over the updates
        const partTot = Object.create(null), widTot = Object.create(null);
        st.buckets.concat(st.cur ? [st.cur] : []).filter(b => t - b.start <= WINDOW).forEach(b => {
          Object.keys(b.parts).forEach(k => { partTot[k] = (partTot[k] || 0) + b.parts[k]; });
          Object.keys(b.widgets).forEach(k => { const a = widTot[k] || (widTot[k] = [0, 0, 0, 0]), v = b.widgets[k]; for (let i = 0; i < 4; i++) a[i] += v[i]; });
        });
        const dTot = Object.create(null); // (1.60.5) the Delta Timer badges of the last ten seconds, by widget type
        st.buckets.concat(st.cur ? [st.cur] : []).filter(b => t - b.start <= WINDOW).forEach(b => Object.keys(b.deltas).forEach(k => { const a = dTot[k] || (dTot[k] = {}); Object.keys(b.deltas[k]).forEach(f => { a[f] = (a[f] || 0) + b.deltas[k][f]; }); }));
        const delta = Object.keys(dTot).map(k => { const a = dTot[k], d = st.dlast[k]; return { type: k, calls: a.calls, skipped: a.skip, measured: a.calls - a.skip, first: a.first, shape: a.shape, recheck: a.recheck, again: a.again, resize: a.resize, kept: a.kept || 0, roomy: a.roomy, shrunk: a.shrunk, tight: a.tight, unknown: a.unknown, steps: a.steps, last: d ? { m: d.m, how: d.how, steps: d.steps, from: d.from, to: d.to } : null }; })
          .filter(x => x.calls > 0 || x.resize > 0).sort((a, b) => b.measured - a.measured || b.calls - a.calls || b.resize - a.resize).slice(0, 5);
        const per = v => Math.round(v / ups.length * 100) / 100; // (only used when there are updates)
        const parts = ups.length ? Object.keys(partTot).map(k => ({ name: k, avg: per(partTot[k]) })).sort((a, b) => b.avg - a.avg).slice(0, 12) : [];
        const widgets = ups.length ? Object.keys(widTot).map(k => { const a = widTot[k]; return { type: k, avg: per(a[0] + a[1] + a[2]), draw: per(a[0]), write: per(a[1]), fit: per(a[2]), count: Math.round(a[3] / ups.length) }; }).sort((a, b) => b.avg - a.avg).slice(0, 8) : [];
        const lf = st.loafs.map(x => x[1]);
        const tops = Object.create(null); lf.forEach(x => { if (x.top) tops[x.top.name] = (tops[x.top.name] || 0) + x.top.ms; });
        const loaf = lf.length ? { count: lf.length, avg: mean(lf, x => x.dur), max: Math.max(...lf.map(x => x.dur)), script: mean(lf, x => x.script), render: mean(lf, x => x.render), forced: mean(lf, x => x.forced),
          top: Object.keys(tops).map(k => ({ name: k, ms: tops[k] / lf.length })).sort((a, b) => b.ms - a.ms).slice(0, 3) } : null;
        const out = {
          seconds: r1(seen / 1000),
          fps: fspan >= 500 ? Math.round(inWin / (fspan / 1000)) : null,
          slowest: st.frames.length ? Math.round(Math.max(...st.frames.map(f => f[1]))) : null,
          updates: seen >= 1000 ? r1(ups.length / (seen / 1000)) : null,
          updateAvg: ups.length ? Math.round(sum / ups.length * 100) / 100 : null,
          updateMax: ups.length ? Math.round(Math.max(...ups.map(u => u[1])) * 100) / 100 : null,
          updateLoad: seen >= 1000 ? r1(sum / seen * 100) : null,
          longCount: st.longs.length,
          longMax: st.longs.length ? Math.round(Math.max(...st.longs.map(l => l[1]))) : 0,
          skipped: sk === null ? null : Math.max(0, Math.round(sk)),
          parts, widgets, delta, loaf
        };
        if (st.race) { // the worst figures of the race that started last
          if (out.fps !== null && (st.race.minFps === null || out.fps < st.race.minFps)) st.race.minFps = out.fps;
          peak('load', out.updateLoad);
          out.race = { wall: st.race.wall, seconds: Math.round((t - st.race.t0) / 1000), frame: Math.round(st.race.frame), update: r1(st.race.update), updateAt: st.race.updateAt === null ? null : Math.round(st.race.updateAt), updateParts: outParts(st.race.updateParts), updateWidgets: outWidgets(st.race.updateWidgets), long: Math.round(st.race.long), load: r1(st.race.load), loaf: Math.round(st.race.loaf), minFps: st.race.minFps };
        } else out.race = null;
        out.history = st.hist.map(h => ({ ...h }));
        out.marks = st.marks.map(x => ({ ...x }));
        return out;
      }
    };
  }
  // a long animation frame (the browser's own account of a frame over 50 ms: how much was script, how much was drawing the page, how much of the script made the page measure itself) made safe
  function loafFrom(e) {
    if (!e || typeof e !== 'object' || !isNum(e.duration) || e.duration < 0) return null;
    const start = isNum(e.startTime) ? e.startTime : 0, end = start + e.duration, rs = isNum(e.renderStart) && e.renderStart > 0 ? e.renderStart : null;
    const scripts = (Array.isArray(e.scripts) ? e.scripts : []).slice(0, 60).filter(s => s && typeof s === 'object' && isNum(s.duration) && s.duration >= 0);
    const script = Math.min(e.duration, scripts.reduce((n, s) => n + s.duration, 0)), forced = Math.min(script, scripts.reduce((n, s) => n + (isNum(s.forcedStyleAndLayoutDuration) && s.forcedStyleAndLayoutDuration > 0 ? s.forcedStyleAndLayoutDuration : 0), 0));
    const big = scripts.reduce((m, s) => (!m || s.duration > m.duration ? s : m), null);
    const file = u => text(String(u || '').split('/').pop().split('?')[0], 30);
    return { dur: e.duration, script, render: rs === null ? 0 : Math.max(0, end - rs), forced,
      top: big ? { name: [text(big.sourceFunctionName, 40) || text(big.invoker, 40) || 'script', file(big.sourceURL)].filter(Boolean).join(' '), ms: big.duration } : null };
  }

  // ---- what the core of the app tells (perfstats.js), made safe: it comes over a link, and an old or odd answer must not break the page ----
  const TYPE_OF = { Tab: 'window', GPU: 'graphics', Browser: 'core' };
  const isOn = v => typeof v === 'string' && v.startsWith('enabled');
  function cleanMain(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const procs = { window: 0, graphics: 0, core: 0, other: 0, total: 0, memoryMB: 0 };
    const byPid = {}; // (the window processes by number, so a window can be given its own CPU and memory)
    (Array.isArray(raw.metrics) ? raw.metrics.slice(0, 64) : []).forEach(p => {
      if (!p || typeof p !== 'object') return;
      const k = TYPE_OF[p.type] || 'other', c = num(p.cpu, 0, 10000, 0);
      procs[k] += c; procs.total += c; procs.memoryMB += num(p.memMB, 0, 1e6, 0);
      if (k === 'window' && isNum(p.pid)) byPid[p.pid] = { cpu: c, memMB: num(p.memMB, 0, 1e6, 0) };
    });
    Object.keys(procs).forEach(k => { procs[k] = r1(procs[k]); });
    const gs = raw.gpuStatus && typeof raw.gpuStatus === 'object' ? raw.gpuStatus : {}, compositing = gs.gpu_compositing !== undefined ? gs.gpu_compositing : gs.compositing;
    const status = {}; ['gpu_compositing', 'compositing', 'rasterization', 'opengl', 'webgl', 'webgl2', 'canvas_oop_rasterization', 'vulkan'].forEach(k => { if (typeof gs[k] === 'string') status[k] = text(gs[k], 40); });
    const d = raw.display && typeof raw.display === 'object' ? raw.display : {}, o = raw.os && typeof raw.os === 'object' ? raw.os : {}, v = raw.versions && typeof raw.versions === 'object' ? raw.versions : {};
    const th = raw.thermal && typeof raw.thermal === 'object' ? raw.thermal : {}, lag = raw.lag && typeof raw.lag === 'object' ? raw.lag : {}, sv = raw.save && typeof raw.save === 'object' ? raw.save : {};
    const windows = (Array.isArray(raw.windows) ? raw.windows : []).filter(w => w && typeof w === 'object').slice(0, 8).map(w => {
      const pr = byPid[w.pid] || null;
      return { title: text(w.title, 60), live: !!w.live, visible: w.visible !== false, minimized: !!w.minimized, focused: !!w.focused, pid: isNum(w.pid) ? w.pid : null, cpu: pr ? r1(pr.cpu) : null, memMB: pr ? Math.round(pr.memMB) : null, shares: false };
    });
    windows.forEach(w => { w.shares = w.pid !== null && windows.some(x => x !== w && x.pid === w.pid); }); // (two windows in one process: their figures are the same, and are of both together)
    const stalls = (Array.isArray(raw.stalls) ? raw.stalls : []).filter(s => s && isNum(s.at) && isNum(s.ms)).slice(-10).map(s => ({ at: s.at, ms: Math.round(num(s.ms, 0, 3.6e6, 0)) }));
    const marks = (Array.isArray(raw.marks) ? raw.marks : []).filter(x => x && isNum(x.at)).map(x => ({ at: x.at, text: text(x.text, 100) })).filter(x => x.text).slice(-20);
    return {
      procs, windows, stalls, marks,
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

  // ---- small helpers for the texts ----
  const pad2 = n => String(n).padStart(2, '0');
  const clockText = at => { const d = new Date(at); return isNum(at) && !Number.isNaN(d.getTime()) ? `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}` : '–'; };
  const spanText = s => (s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`);
  const rowTime = s => `${Math.floor(s / 60)}:${pad2(s % 60)}`;
  // 1.60.5: the widgets of one update, as in the table of the slowest widgets: 'dlaptime x2: 60 ms (text 0.4, page 0.5, fit 59)'
  const widText = a => `${a.type}${a.count > 1 ? ' x' + a.count : ''}: ${f1(a.ms)} ms (text ${f1(a.draw)}, page ${f1(a.write)}, fit ${f1(a.fit)})`;
  const partText = x => `${x.name} ${f0(x.ms)} ms`;
  // the Delta Timer badges of one widget type: how often they were looked at, measured and why (the counts that are not 0)
  function deltaLines(d) {
    const L = [], list = a => a.filter(x => x[0] > 0).map(x => `${x[0]} ${x[1]}`).join(', ');
    L.push(`  ${d.type}: ${d.calls} badge${d.calls === 1 ? '' : 's'} looked at in the last ${f0(d.span)} s, ${d.measured} measured, ${d.skipped} left alone${d.kept ? ` (${d.kept} of them put at the smaller size that was found before)` : ''}${d.resize ? `; the widget or the window changed size ${d.resize} time(s) (each time every badge is measured again)` : ''}`);
    if (d.measured) {
      L.push('    why measured: ' + list([[d.first, 'for the first time'], [d.shape, 'the text changed shape (signs, number of figures, class or style)'], [d.recheck, 'the regular check (every 30th time)'], [d.again, 'it did not fit with room to spare the last time']]));
      L.push('    how it came out: ' + list([[d.roomy, 'fitted with room to spare'], [d.shrunk, `had to be made smaller (${d.shrunk ? Math.round(d.steps / d.shrunk * 10) / 10 : 0} steps on average)`], [d.tight, 'fitted, but without room to spare'], [d.unknown, 'could not be measured (not on the screen yet)']]));
    }
    const l = d.last;
    if (l && l.m) L.push(`    last measured: badge box ${f0(l.m.boxW)} x ${f0(l.m.boxH)} px, text ${f1(l.m.w)} x ${f1(l.m.h)} px, ${l.m.row === true ? 'value and badge side by side' : l.m.row === false ? 'badge below the value' : 'layout not known'}`);
    if (l && l.to) L.push(`    last change of shape: "${l.from || ''}" -> "${l.to}"`);
    return L;
  }
  const thin = (a, n) => (a.length <= n ? a : Array.from({ length: n }, (_, i) => a[Math.round(i * (a.length - 1) / (n - 1))])); // (at most n rows, the first and the last always there)

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
    if (m) {
      if (m.windows.some(w => w.live)) n.push('The Live Race window is open: it draws the timing page a second time, in a process of its own.');
      const big = m.stalls.filter(s => s.ms >= 500).pop(); if (big) n.push(`The core of the app was stuck for ${big.ms} ms at ${clockText(big.at)}.`);
    }
    if (r) {
      const w0 = r.widgets && r.widgets[0];
      if (w0 && r.updateAvg && w0.avg >= 8 && w0.avg >= r.updateAvg * 0.35) n.push(`The widget "${w0.type}"${w0.count > 1 ? ` (${w0.count} of them)` : ''} takes ${f1(w0.avg)} ms of every update, ${f0(w0.avg / r.updateAvg * 100)}% of it${w0.fit >= w0.avg * 0.5 ? ', mostly in fitting it to its place' : w0.write >= w0.avg * 0.5 ? ', mostly in putting it in the page' : ''}.`);
      if (r.loaf && r.loaf.render >= 5 && r.loaf.render > r.loaf.script) n.push('In the slow frames more time goes in drawing the page (style, layout, paint) than in the scripts of the app.');
      if (r.loaf && r.loaf.forced >= 5 && r.loaf.forced >= r.loaf.script * 0.25) n.push(`In the slow frames ${f0(r.loaf.forced)} ms of the scripts is the page measuring itself again and again (layout forced by a script).`);
      const h = (r.history || []).filter(x => x.update !== null);
      if (h.length >= 3) {
        const a = h[0], b = h[h.length - 1];
        if (b.at - a.at >= 60 && b.update >= a.update * 1.4 && b.update - a.update >= 15) n.push(`A screen update took ${f1(a.update)} ms at ${rowTime(a.at)} of the race and ${f1(b.update)} ms at ${rowTime(b.at)}: it gets slower during the race.`);
        if (a.heapMB !== null && b.heapMB !== null && b.heapMB >= a.heapMB * 2 && b.heapMB - a.heapMB >= 100) n.push(`The memory of the page grew from ${a.heapMB} MB to ${b.heapMB} MB during the race.`);
        if (a.dom !== null && b.dom !== null && b.dom >= a.dom * 1.5 && b.dom - a.dom >= 1000) n.push(`The page grew from ${a.dom} to ${b.dom} elements during the race.`);
        if (a.memMB !== null && b.memMB !== null && b.memMB >= a.memMB * 1.5 && b.memMB - a.memMB >= 500) n.push(`The memory of the app grew from ${a.memMB} MB to ${b.memMB} MB during the race.`);
      }
      if (r.fps !== null && r.fps < 25) n.push(`The window draws ${r.fps} frames a second: it looks jerky below about 30.`);
      if (r.updateLoad !== null && r.updateLoad > 10) n.push(`The race screen spends ${f0(r.updateLoad)}% of the time on its updates.`);
      if (r.longCount) n.push(`The window was stuck ${r.longCount} time(s) in the last ten seconds, the longest ${r.longMax} ms.`);
    }
    return n;
  }

  // ---- the parts of the report that say where the time goes and what happened during the race (1.60.1) ----
  function detail(r, m) {
    const L = [];
    if (r) {
      if (r.parts && r.parts.length) { L.push('', `Where a screen update spends its time (average per update, last ${f0(Math.min(10, r.seconds))} seconds):`, '  ' + r.parts.map(x => `${x.name} ${f1(x.avg)} ms`).join(' · ')); }
      if (r.widgets && r.widgets.length) {
        L.push('', 'Slowest widgets (average per update: making the text and seeing whether it changed + putting it in the page + fitting it to its place):');
        r.widgets.forEach(w => L.push(`  ${w.type}${w.count > 1 ? ' x' + w.count : ''}: ${f1(w.avg)} ms (text ${f1(w.draw)}, page ${f1(w.write)}, fit ${f1(w.fit)})`));
      }
      if (r.delta && r.delta.length) {
        L.push('', 'Delta Timer badges (the arrow and the number are fitted inside the badge; a badge that fitted with room to spare is left alone while its text keeps the same shape, and one that had to be made smaller is put at the size found before):');
        r.delta.forEach(d => deltaLines({ ...d, span: Math.min(10, r.seconds) }).forEach(x => L.push(x)));
      }
      if (r.loaf) {
        L.push('', `Slow frames (over 50 ms) in the last ${f0(Math.min(10, r.seconds))} seconds: ${r.loaf.count}, ${f0(r.loaf.avg)} ms on average, the longest ${f0(r.loaf.max)} ms. On average: scripts ${f0(r.loaf.script)} ms (of which the page measuring itself ${f0(r.loaf.forced)} ms), drawing the page ${f0(r.loaf.render)} ms${r.loaf.script + r.loaf.render < r.loaf.avg * 0.25 ? ' (the browser does not say where the rest of the time went)' : ''}`);
        if (r.loaf.top.length) L.push('  slowest scripts: ' + r.loaf.top.map(x => `${x.name} ${f0(x.ms)} ms`).join(' · '));
      }
      if (r.race) L.push('', `Worst since the race started (${clockText(r.race.wall)}, ${spanText(r.race.seconds)} ago): slowest frame ${r.race.frame} ms, longest screen update ${f1(r.race.update)} ms${r.race.updateParts && r.race.updateParts.length ? ` (at ${rowTime(r.race.updateAt || 0)}: ${r.race.updateParts.map(x => `${x.name} ${f0(x.ms)} ms`).join(', ')})` : ''}, longest stuck ${r.race.long} ms, longest slow frame ${r.race.loaf} ms, fewest frames ${r.race.minFps === null ? '–' : r.race.minFps + ' a second'}, busiest ${f0(r.race.load)}% of the time on updates`);
      if (r.race && r.race.updateWidgets && r.race.updateWidgets.length) L.push('  The widgets in that update: ' + r.race.updateWidgets.map(widText).join(' · '));
      if (r.history && r.history.length) {
        L.push('', 'Since the race started, one row every 30 seconds (time, frames, screen update, app memory, memory of the page, page elements, CPU of the window):');
        thin(r.history, 24).forEach(h => { L.push(`  ${rowTime(h.at)}  ${h.fps === null ? '–' : h.fps} frames/s · update ${f1(h.update)} ms (${f0(h.load)}% of the time, slowest ${f1(h.updateMax)}) · app ${h.memMB === null ? '–' : h.memMB} MB · page ${h.heapMB === null ? '–' : h.heapMB} MB · ${h.dom === null ? '–' : h.dom} elements · window CPU ${h.winCpu === null ? '–' : h.winCpu}%`);
          if (h.slow && (h.slow.parts.length || h.slow.widgets.length)) L.push(`        its slowest update (${f1(h.slow.ms)} ms): ${[h.slow.parts.map(partText).join(', '), h.slow.widgets.map(widText).join(' · ')].filter(Boolean).join(' · ')}`);
        });
      }
    }
    if (m && m.windows.length) {
      L.push('', `Windows (${m.windows.length} open):`);
      m.windows.forEach(w => L.push(`  ${w.title || 'untitled'}${w.live && !/live race/i.test(w.title) ? ' [Live Race]' : ''}: ${w.cpu === null ? 'CPU unknown' : 'CPU ' + f0(w.cpu) + '%'}, ${w.memMB === null ? 'memory unknown' : w.memMB + ' MB'}${w.shares ? ' (one process for both windows)' : ''}${w.visible ? '' : ', hidden'}${w.minimized ? ', minimized' : ''}${w.focused ? ', in front' : ''}`));
    }
    if (m && m.stalls.length) L.push('', 'The core of the app was stuck for over 100 ms at: ' + m.stalls.map(s => `${clockText(s.at)} (${s.ms} ms)`).join(', '));
    const ev = ((r && r.marks) || []).concat((m && m.marks) || []).sort((a, b) => a.at - b.at).slice(-14);
    if (ev.length) { L.push('', 'What happened (clock time):'); ev.forEach(x => L.push(`  ${clockText(x.at)}  ${x.text}`)); }
    return L;
  }

  // ---- the report (to copy and send) ----
  // extra: what only the window knows: { version, when, screen: {w, h, dpr}, look: {depth, layers} | null, links: {on, count, bytes} | null (1.60.6), race: {name, widgets, lanes} | null, speedNote }
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
    if (extra.look) L.push(`Look: depth ${text(extra.look.depth, 40) || 'unknown'}, widgets on their own layers: ${extra.look.layers ? 'on' : 'off'}`);
    if (extra.links && typeof extra.links === 'object') L.push(`Big pictures in the widgets as short links (1.60.6): ${extra.links.on ? 'on' : 'off'}${extra.links.on ? `, ${f0(extra.links.count)} kept, ${f1((Number(extra.links.bytes) || 0) / 1e6)} MB` : ''}`);
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
    detail(r, m).forEach(x => L.push(x));
    const nn = notes(r, m); if (nn.length) { L.push('', 'Notes:'); nn.forEach(x => L.push('- ' + x)); }
    return L.join('\n');
  }

  const api = { createMonitor, loafFrom, cleanMain, line, report, notes, WINDOW, FPS_WINDOW, HIST_EVERY, HIST_MAX, MARKS_MAX };
  root.Perf = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
