// The Performance line on screen (1.60.0): the small line under the buttons of the race screen, and the Performance folder of App Settings > General with the report and its Copy button.
// Nothing runs while neither is shown: the frames are only watched while a line or the report is visible, and the core of the app only looks while somebody asks (perfstats.js).
// The figures and the texts are made in perf.js.
const PerfUI = (() => {
  let monitor = null, watchers = 0, raf = null, observer = null, loafObserver = null;
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
      // the browser's own account of every frame over 50 ms (1.60.1): how much was script, how much was drawing the page (not in every browser)
      try { if (typeof PerformanceObserver === 'function' && (PerformanceObserver.supportedEntryTypes || []).includes('long-animation-frame')) { loafObserver = new PerformanceObserver(l => l.getEntries().forEach(e => { const x = Perf.loafFrom(e); if (x) mon().loaf(x, e.startTime + e.duration); })); loafObserver.observe({ type: 'long-animation-frame' }); } } catch (x) { loafObserver = null; }
    }
    let on = true;
    return () => {
      if (!on) return; on = false; watchers--;
      if (watchers === 0) { if (raf !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf); raf = null; if (observer) { try { observer.disconnect(); } catch (x) { /* gone */ } observer = null; } if (loafObserver) { try { loafObserver.disconnect(); } catch (x) { /* gone */ } loafObserver = null; } }
    };
  }
  // the race screen tells how long an update took (only measured while somebody is looking)
  const active = () => watchers > 0;
  const noteUpdate = ms => { if (watchers > 0) mon().update(ms); };
  // (1.60.1) where the time of a screen update goes. p = PerfUI.phases(); ...; p('widgets'); ...; p('panels'): the time since the last call is put on that name. Null while nobody looks.
  const pnow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const phases = () => { if (watchers <= 0) return null; let last = pnow(); return name => { const t = pnow(); mon().part(name, t - last); last = t; }; };
  // the same for the widgets: handed to LiveCanvas.paint, which says per widget how long making the text, writing it to the page and fitting it took. Null while nobody looks.
  const widgetTimer = () => (watchers > 0 ? { now: pnow, add: (type, drawMs, writeMs, fitMs) => mon().widget(type, drawMs, writeMs, fitMs) } : null);
  // something that happened, for the report ("Live Race window opened"); the race starting also starts the worst figures and the rows of the report again
  const mark = txt => { try { mon().mark(txt); } catch (x) { /* a note that does not fit is left out */ } };
  const raceStarted = () => { try { mon().newRace(); mon().mark('Race started'); } catch (x) { /* nothing to start */ } };
  // a row of the history (once in 30 seconds in a race): what the page holds, which only the window can tell
  const extras = () => {
    let heapMB = null, dom = null; // (heapMB is not a number when the browser does not tell: the row then says null)
    try { const pm = typeof performance !== 'undefined' && performance.memory; if (pm) heapMB = pm.usedJSHeapSize / 1048576; } catch (x) { /* not in every browser */ }
    try { if (typeof document !== 'undefined' && document.getElementsByTagName) dom = document.getElementsByTagName('*').length; } catch (x) { /* none */ }
    return { heapMB, dom };
  };
  const note = (snap, main) => { try { if (mon().due()) mon().sample(snap, main, extras()); } catch (x) { /* a row that does not fit is left out */ } };
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
      const snap = mon().snapshot(); note(snap, main); el.hidden = false; el.textContent = Perf.line(snap, main);
    };
    const off = timer(show, 1000), stop = () => { if (gone) return; gone = true; off(); if (unwatch) { unwatch(); unwatch = null; } el.hidden = true; };
    show();
    return stop;
  }

  // the look of the page that decides how heavy it is to draw (the depth, and since 1.60.3 the widgets on their own layers): the report says it, so a copied report needs no explanation
  function lookOf() {
    try {
      const S = typeof state !== 'undefined' && state ? state.settings : null;
      if (!S || typeof Depth === 'undefined') return null;
      const lvl = Depth.levelOf(S.depth), name = String((Depth.LEVELS.find(l => l[0] === lvl) || [0, ''])[1]).replace(/ \(.*\)$/, '');
      return { depth: name + (lvl ? ` (${lvl})` : ''), layers: Depth.layersOn(S) };
    } catch (e) { return null; }
  }
  // the report in a box (App Settings > General > Performance): out is the element it is written to, copy the button, msg where it says "Copied."
  // race: what the race screen tells about itself (PerfUI.race, set by race.js); the version comes from the core of the app
  function panel(o) {
    const out = o.out; if (!out) return () => {};
    let unwatch = null, busy = false, gone = false, last = '';
    const make = (r, main) => Perf.report(r, main, { when: new Date().toLocaleString(), screen: typeof window !== 'undefined' ? { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio } : null, look: lookOf(), race: PerfUI.race ? PerfUI.race() : null });
    const show = async () => {
      if (gone || busy) return;
      if (out.isConnected === false) return stop();
      if (!visible(out)) { if (unwatch) { unwatch(); unwatch = null; } return; } // (the folder is closed: nothing is measured and nothing is shown)
      if (!unwatch) unwatch = watch();
      busy = true; const main = await ask(); busy = false;
      if (gone) return;
      const snap = mon().snapshot(); note(snap, main); last = make(snap, main); out.textContent = last;
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

  return { watch, active, watching: () => watchers, noteUpdate, phases, widgetTimer, mark, raceStarted, line, panel, monitor: mon, race: null };
})();
if (typeof module !== 'undefined') module.exports = PerfUI;
