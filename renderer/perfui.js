// The Performance line on screen (1.60.0): the small line under the buttons of the race screen, and the Performance folder of App Settings > General with the report and its Copy button.
// Nothing runs while neither is shown: the frames are only watched while a line or the report is visible, and the core of the app only looks while somebody asks (perfstats.js).
// The figures and the texts are made in perf.js.
const PerfUI = (() => {
  let monitor = null, watchers = 0, raf = null, observer = null;
  const mon = () => monitor || (monitor = Perf.createMonitor());
  const frame = t => {
    mon().frame(t);
    if (typeof Quiet !== 'undefined') mon().skipped(Quiet.skipped(), t);
    raf = watchers > 0 && typeof requestAnimationFrame === 'function' ? requestAnimationFrame(frame) : null;
  };
  // somebody is looking at a figure: the frames are watched. Returns what to call when they stop looking.
  function watch() {
    watchers++;
    if (watchers === 1) {
      mon().reset();
      if (typeof requestAnimationFrame === 'function') raf = requestAnimationFrame(frame);
      try { if (typeof PerformanceObserver === 'function' && !observer) { observer = new PerformanceObserver(l => l.getEntries().forEach(e => mon().long(e.duration, e.startTime + e.duration))); observer.observe({ entryTypes: ['longtask'] }); } } catch (x) { observer = null; /* no long task figures here */ }
    }
    let on = true;
    return () => {
      if (!on) return; on = false; watchers--;
      if (watchers === 0) { if (raf !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf); raf = null; if (observer) { try { observer.disconnect(); } catch (x) { /* gone */ } observer = null; } }
    };
  }
  // the race screen tells how long an update took (only measured while somebody is looking)
  const active = () => watchers > 0;
  const noteUpdate = ms => { if (watchers > 0) mon().update(ms); };
  // is the place of an element on the screen? (looked at through its parent: the line itself is hidden until there is something to say)
  const visible = el => { if (!el) return false; const p = el.parentElement; return !p || typeof p.getClientRects !== 'function' || p.getClientRects().length > 0; };
  const ask = async () => { try { return typeof api !== 'undefined' && api && typeof api.perfStats === 'function' ? Perf.cleanMain(await api.perfStats()) : null; } catch (x) { return null; } };
  const timer = (f, ms) => { const id = setInterval(f, ms); return () => clearInterval(id); };

  // the line under the buttons of the race screen. Returns what to call to take it away.
  function line(el) {
    if (!el) return () => {};
    let unwatch = null, busy = false, gone = false;
    const show = async () => {
      if (gone || busy) return;
      if (!el.isConnected && el.isConnected !== undefined) return stop();
      if (!visible(el)) { if (unwatch) { unwatch(); unwatch = null; } return; } // (the race screen is parked behind another tab: nothing is measured then)
      if (!unwatch) unwatch = watch();
      busy = true; const main = await ask(); busy = false;
      if (gone) return;
      el.hidden = false; el.textContent = Perf.line(mon().snapshot(), main);
    };
    const off = timer(show, 1000), stop = () => { if (gone) return; gone = true; off(); if (unwatch) { unwatch(); unwatch = null; } el.hidden = true; };
    show();
    return stop;
  }

  // the report in a box (App Settings > General > Performance): out is the element it is written to, copy the button, msg where it says "Copied."
  // race: what the race screen tells about itself (PerfUI.race, set by race.js); the version comes from the core of the app
  function panel(o) {
    const out = o.out; if (!out) return () => {};
    let unwatch = null, busy = false, gone = false, last = '';
    const make = (r, main) => Perf.report(r, main, { when: new Date().toLocaleString(), screen: typeof window !== 'undefined' ? { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio } : null, race: PerfUI.race ? PerfUI.race() : null });
    const show = async () => {
      if (gone || busy) return;
      if (out.isConnected === false) return stop();
      if (!visible(out)) { if (unwatch) { unwatch(); unwatch = null; } return; } // (the folder is closed: nothing is measured and nothing is shown)
      if (!unwatch) unwatch = watch();
      busy = true; const main = await ask(); busy = false;
      if (gone) return;
      last = make(mon().snapshot(), main); out.textContent = last;
    };
    const off = timer(show, 1000), stop = () => { if (gone) return; gone = true; off(); if (unwatch) { unwatch(); unwatch = null; } };
    if (o.copy) o.copy.onclick = async () => {
      const msg = o.msg || { textContent: '' };
      const main = await ask(); last = make(mon().snapshot(), main); out.textContent = last;
      try { await navigator.clipboard.writeText(last); msg.textContent = 'Copied. Paste it in a message.'; } catch (x) { msg.textContent = 'Could not copy: select the text and copy it with Ctrl+C.'; }
    };
    show();
    return stop;
  }

  return { watch, active, watching: () => watchers, noteUpdate, line, panel, monitor: mon, race: null };
})();
if (typeof module !== 'undefined') module.exports = PerfUI;
