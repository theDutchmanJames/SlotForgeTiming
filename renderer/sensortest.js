// The sensor test (2.3.0): before a race, drive a car over every lane's sensor and see each lane light up, with the number of crossings and the lap time.
// Most race-night problems are sensors and cables; a lane that has not seen a car is named, so it is found before the race and not during it.
// Pure part (tested without a screen): the tally and its words. The source(): how each timing interface reports a crossing, as one shape (lane from 0, time in ms).
// mount() draws the panel into an element and listens until close() (Home's Test sensors dialog and the setup guide use it).
(function (root) {
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const MIN_GAP = 300; // (two crossings closer than this are one car on a sensor that bounced, not a lap)
  function createTally(lanes) {
    const n = Math.max(1, Math.min(8, Math.floor(Number(lanes)) || 1));
    return {
      lanes: n,
      hits: Array(n).fill(0),
      last: Array(n).fill(null),
      lap: Array(n).fill(null),
      best: Array(n).fill(null),
      stray: 0,
      strayLanes: []
    };
  }
  // one crossing; measuredMs: the lap time the hardware measured itself (DS). Returns the lane, or -1 for a sensor of a lane this race does not have.
  function hit(T, lane, at, measuredMs) {
    if (!Number.isInteger(lane) || lane < 0 || lane >= T.lanes) {
      T.stray++;
      if (Number.isInteger(lane) && lane >= 0 && !T.strayLanes.includes(lane)) T.strayLanes.push(lane);
      return -1;
    }
    const prev = T.last[lane];
    if (prev !== null && Number.isFinite(at) && at - prev < MIN_GAP && !(measuredMs > 0)) return lane; // (a bounce: still lit, not counted twice)
    const lap = measuredMs > 0 ? measuredMs : prev !== null && Number.isFinite(at) ? at - prev : null;
    T.hits[lane]++;
    T.last[lane] = Number.isFinite(at) ? at : prev;
    if (lap !== null) {
      T.lap[lane] = lap;
      if (T.best[lane] === null || lap < T.best[lane]) T.best[lane] = lap;
    }
    return lane;
  }
  const missing = T => T.hits.map((h, i) => (h ? -1 : i)).filter(i => i >= 0);
  const list = lanes => {
    const w = lanes.map(i => String(i + 1));
    return w.length > 1 ? w.slice(0, -1).join(', ') + ' and ' + w[w.length - 1] : w[0] || '';
  };
  function summary(T) {
    const m = missing(T);
    const other = T.strayLanes.slice().sort((a, b) => a - b),
      stray = !T.stray
        ? ''
        : other.length
          ? ` (Crossings also came from lane ${list(other)}, which this race does not have.)`
          : ` (${T.stray} crossing${T.stray > 1 ? 's' : ''} came without a lane number.)`;
    if (!m.length) return { ok: true, text: 'Every lane has seen a car. The sensors are ready.' + stray };
    if (m.length === T.lanes) return { ok: false, text: 'No lane has seen a car yet. Drive a car over the line in every lane.' + stray };
    return { ok: false, text: `Lane${m.length > 1 ? 's' : ''} ${list(m)} ${m.length > 1 ? 'have' : 'has'} not seen a car yet.` + stray };
  }
  const secs = ms => (ms === null || ms === undefined ? '–' : (ms / 1000).toFixed(3) + ' s');

  // ---- where the crossings come from: { listen(cb(lane, at, measuredMs)) -> off, connected() } or null (no timing hardware: the keys) ----
  function source(hw, settings = {}, g = root) {
    const hits = link => ({
      connected: () => !!(link && link.connected),
      listen: cb => link.on(e => (e && e.type === 'hit' ? cb(e.lane, e.at) : undefined))
    });
    if (hw === 'trackmate' && g.Trackmate)
      return {
        connected: () => !!g.Trackmate.link.connected,
        listen: cb =>
          g.Trackmate.link.on(e => (e && e.type === 'hit' ? cb(g.Trackmate.laneMap(settings.tmLaneMap)[e.lane], e.at) : undefined))
      };
    if (hw === 'arduino' && g.ArduinoBox) return hits(g.ArduinoBox.link);
    if (hw === 'parallel' && g.ParallelPort) return hits(g.ParallelPort.link);
    if (hw === 'plugin' && g.pt && g.pt.link) return hits(g.pt.link);
    if (hw === 'ds' && g.DsTiming)
      return {
        connected: () => !!g.DsTiming.link.connected,
        listen: cb =>
          g.DsTiming.link.on(e =>
            e && (e.kind === 'lap' || e.kind === 'first-crossing-marker')
              ? cb(e.lane - 1, e.at, e.kind === 'lap' ? e.timeTicks / 10 : undefined)
              : undefined
          )
      };
    return null;
  }

  // ---- the panel ----
  // o: { lanes, hw, name (of the hardware), settings, note (extra words under the title) }
  function mount(el, o = {}) {
    const T = createTally(o.lanes),
      src = source(o.hw, o.settings || {}, o.global || root),
      timers = [];
    let off = null,
      closed = false;
    // Lane Check (2.4.0): every lane in its colour (the race screen's, else one of eight), with a light that turns green when its sensor sees a car
    const hue = i =>
      (o.color && o.color(i)) ||
      (root.HomeStats && root.HomeStats.laneColor ? root.HomeStats.laneColor(o.layout || null, i) : '') ||
      '#98a0ab';
    const cols = n => (n <= 4 ? Math.max(1, n) : n <= 6 ? 3 : 4); // (the rows of Home's lanes: 5 and 6 lanes in rows of three, 7 and 8 in rows of four)
    const draw = () => {
      if (closed || !el) return;
      const s = summary(T),
        on = src && src.connected();
      el.innerHTML = !src
        ? `<p class="muted">No timing hardware is in use: laps are counted with the keys or simulated cars, so there are no sensors to test.</p>`
        : `<div class="st-head"><span class="st-link ${on ? 'st-on' : 'st-off'}">${esc(o.name || 'The timing hardware')} ${on ? 'is connected' : 'is not connected'}</span><span class="muted">${on ? '' : 'Connect it first (App Settings, Timing Hardware). '}Drive a car over the line in every lane.${o.note ? ' ' + esc(o.note) : ''}</span></div>
        <div class="st-lanes" style="--n:${cols(T.hits.length)}">${T.hits
          .map(
            (h, i) =>
              `<div class="st-lane${h ? ' st-seen' : ''}" data-stlane="${i}" style="--c:${esc(hue(i))}"><span class="st-num"><i aria-hidden="true">${i + 1}</i>Lane ${i + 1}</span><span class="st-light" aria-hidden="true"></span><span class="st-count">${h ? '<b>' + h + '</b> crossing' + (h > 1 ? 's' : '') : 'waiting'}</span><span class="st-lap">${T.lap[i] !== null ? 'last lap ' + secs(T.lap[i]) : ''}</span></div>`
          )
          .join('')}</div>
        <div class="row st-foot"><p class="st-sum ${s.ok ? 'st-ok' : 'st-warn'}" role="status">${esc(s.text)}</p><button type="button" class="btn" data-streset>Start again</button></div>`;
    };
    const flash = lane => {
      const tile = el && el.querySelector && el.querySelector(`[data-stlane="${lane}"]`);
      if (!tile) return;
      tile.classList.add('st-flash');
      timers.push(setTimeout(() => tile.classList.remove('st-flash'), 350));
    };
    if (src)
      off = src.listen((lane, at, measured) => {
        if (closed) return;
        const i = hit(T, lane, at, measured);
        draw();
        if (i >= 0) flash(i);
      });
    const offStatus = src && o.onStatusLink && o.onStatusLink(draw);
    draw();
    if (el)
      el.addEventListener('click', ev => {
        if (ev.target && ev.target.closest && ev.target.closest('[data-streset]')) {
          Object.assign(T, createTally(T.lanes));
          draw();
        }
      });
    return {
      tally: T,
      redraw: draw,
      close() {
        closed = true;
        if (off) off();
        if (typeof offStatus === 'function') offStatus();
        timers.forEach(clearTimeout);
      }
    };
  }

  // ---- Home's Test sensors button: the panel in a dialog (closes with Close or Escape; it stops listening then) ----
  function openDialog(o = {}) {
    if (typeof document === 'undefined') return Promise.resolve(null);
    return new Promise(resolve => {
      const d = document.createElement('dialog');
      d.className = 'appdlg st-dialog';
      d.setAttribute('aria-labelledby', 'st-title');
      d.innerHTML = `<h3 id="st-title">Test the sensors</h3><div class="st-body"></div><div class="row appdlg-buttons"><button type="button" class="btn primary" data-stclose>Close</button></div>`;
      document.body.appendChild(d);
      const panel = mount(d.querySelector('.st-body'), o);
      const finish = () => {
        panel.close();
        d.close();
        d.remove();
        resolve(summary(panel.tally));
      };
      d.querySelector('[data-stclose]').onclick = finish;
      d.addEventListener('cancel', ev => {
        ev.preventDefault();
        finish();
      });
      d.showModal();
      d.querySelector('[data-stclose]').focus();
    });
  }

  const api = { createTally, hit, missing, summary, source, mount, openDialog, MIN_GAP };
  root.SensorTest = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
