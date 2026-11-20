// The sensor test (2.3.0): before a race, drive a car over every lane's sensor and see each lane light up, with the number of crossings and the lap time.
// Most race-night problems are sensors and cables; a lane that has not seen a car is named, so it is found before the race and not during it.
// Pure part (tested without a screen): the tally and its words. The source(): how each timing interface reports a crossing, as one shape (lane from 0, time in ms).
// mount() draws the panel into an element and listens until close() (Home's Test sensors dialog and the setup guide use it).
(function (root) {
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const MIN_GAP = 300; // (two crossings closer than this are one car on a sensor that bounced, not a lap)
  // o.order (2.4.0, "Lane Check"): the lanes are asked for one at a time (lane 1 first), so a car that lights another lane's sensor is caught
  function createTally(lanes, o = {}) {
    const n = Math.max(1, Math.min(8, Math.floor(Number(lanes)) || 1));
    return {
      lanes: n,
      hits: Array(n).fill(0),
      last: Array(n).fill(null),
      lap: Array(n).fill(null),
      best: Array(n).fill(null),
      stray: 0,
      strayLanes: [],
      order: !!o.order && n > 1,
      wrong: Array(n).fill(null), // (the lane whose sensor lit when this lane was asked for)
      swap: null, // { lane, lit, sensor }: the lane asked for, and the lane (and sensor) that lit instead
      pit: Array(n).fill(false),
      pitLit: Array(8).fill(null), // (2.4.0 review: when each pit sensor last lit up)
      pitSel: null, // (the pit sensor whose lane is being chosen)
      call: null,
      power: { off: false, on: false }
    };
  }
  // the lane to drive now (in order), or -1
  const expected = T => (T.order ? T.hits.findIndex(h => !h) : -1);
  // one crossing; measuredMs: the lap time the hardware measured itself (DS). Returns the lane, or -1 for a sensor of a lane this race does not have.
  function hit(T, lane, at, measuredMs, sensor) {
    if (!Number.isInteger(lane) || lane < 0 || lane >= T.lanes) {
      T.stray++;
      if (Number.isInteger(lane) && lane >= 0 && !T.strayLanes.includes(lane)) T.strayLanes.push(lane);
      return -1;
    }
    const want = expected(T);
    if (want >= 0 && lane !== want && !T.hits[lane]) {
      // (2.4.0) another lane lit while this one was asked for: its sensor is probably on the wrong lane
      T.wrong[want] = lane;
      T.swap = { lane: want, lit: lane, sensor: Number.isInteger(sensor) ? sensor : null };
      return -2;
    }
    const prev = T.last[lane];
    if (prev !== null && Number.isFinite(at) && at - prev < MIN_GAP && !(measuredMs > 0)) return lane; // (a bounce: still lit, not counted twice)
    const lap = measuredMs > 0 ? measuredMs : prev !== null && Number.isFinite(at) ? at - prev : null;
    T.hits[lane]++;
    if (T.wrong[lane] !== null) T.wrong[lane] = null;
    if (T.swap && T.swap.lane === lane) T.swap = null;
    T.last[lane] = Number.isFinite(at) ? at : prev;
    if (lap !== null) {
      T.lap[lane] = lap;
      if (T.best[lane] === null || lap < T.best[lane]) T.best[lane] = lap;
    }
    return lane;
  }
  const missing = T => T.hits.map((h, i) => (h ? -1 : i)).filter(i => i >= 0);
  // (2.4.0) the swap is done (or the lanes are counted as they are): the lane that was asked for has seen its car
  function swapped(T, at) {
    if (!T.swap) return;
    const a = T.swap.lane;
    T.wrong[a] = null;
    T.swap = null;
    T.hits[a]++;
    T.last[a] = Number.isFinite(at) ? at : null;
  }
  // "Not now": no more asking in order; the lanes count where their sensors are
  function noOrder(T) {
    T.order = false;
    T.swap = null;
    T.wrong.fill(null);
  }
  const pitSeen = (T, lane) => (Number.isInteger(lane) && lane >= 0 && lane < T.lanes ? ((T.pit[lane] = true), lane) : -1);
  // (2.4.0 review) pit sensor `sensor` is for `lane`: the sensor that had that lane takes the lane this one had, so every lane keeps one sensor
  function pitAssign(map, sensor, lane) {
    const m = map.slice(),
      old = m[sensor],
      other = m.indexOf(lane);
    m[sensor] = lane;
    if (other >= 0 && other !== sensor) m[other] = old;
    return m;
  }
  const callSeen = (T, at) => (T.call = Number.isFinite(at) ? at : Date.now());
  const powerSet = (T, on) => (on ? (T.power.on = true) : (T.power.off = true));
  // the checks of the panel, as a list: lanes, then what the hardware has (pit sensors, the Track call button, track power)
  function steps(T, caps = {}) {
    const seen = T.hits.filter(Boolean).length,
      pits = T.pit.filter(Boolean).length;
    return [
      { id: 'lanes', label: 'Lanes', done: seen === T.lanes && !T.swap, note: `${seen} of ${T.lanes}` },
      ...(caps.pit ? [{ id: 'pit', label: 'Pit lane', done: pits === T.lanes, note: `${pits} of ${T.lanes}` }] : []),
      ...(caps.call ? [{ id: 'call', label: 'Track call', done: T.call !== null, note: '' }] : []),
      ...(caps.power ? [{ id: 'power', label: 'Track power', done: T.power.off && T.power.on, note: '' }] : [])
    ];
  }
  // the swap in words: what lit, and what to do about it
  function swapText(T, canSwap) {
    if (!T.swap) return null;
    const a = T.swap.lane + 1,
      b = T.swap.lit + 1;
    return {
      head: `Lane ${a} lit lane ${b}`,
      text: canSwap
        ? `The car in lane ${a} crossed the sensor set for lane ${b}. Swap lanes ${a} and ${b}?`
        : `The car in lane ${a} crossed the sensor of lane ${b}. Check the cables of lanes ${a} and ${b}, or drive lane ${a} again.`,
      button: `Swap ${Math.min(a, b)} and ${Math.max(a, b)}`
    };
  }
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
    if (T.swap) {
      const left = m.filter(i => i !== T.swap.lane);
      return {
        ok: false,
        text: `${left.length ? `Lane${left.length > 1 ? 's' : ''} ${list(left)} ${left.length > 1 ? 'have' : 'has'} not seen a car yet · ` : ''}lanes ${T.swap.lane + 1} and ${T.swap.lit + 1} may be swapped.`
      };
    }
    if (!m.length) return { ok: true, text: 'Every lane has seen a car. The sensors are ready.' + stray };
    if (m.length === T.lanes)
      return {
        ok: false,
        text:
          (T.order
            ? 'No lane has seen a car yet. Drive a car over the line in lane 1 first.'
            : 'No lane has seen a car yet. Drive a car over the line in every lane.') + stray
      };
    if (T.order)
      return {
        ok: false,
        text: `Now lane ${m[0] + 1}: drive a car over its line.${m.length > 1 ? ` (${m.length - 1} more after it.)` : ''}` + stray
      };
    return { ok: false, text: `Lane${m.length > 1 ? 's' : ''} ${list(m)} ${m.length > 1 ? 'have' : 'has'} not seen a car yet.` + stray };
  }
  const secs = ms => (ms === null || ms === undefined ? '–' : (ms / 1000).toFixed(3) + ' s');

  // ---- where the crossings come from: { listen(cb(lane, at, measuredMs)) -> off, connected() } or null (no timing hardware: the keys) ----
  function source(hw, settings = {}, g = root) {
    const on = (link, type, f) => link.on(e => (e && e.type === type ? f(e) : undefined));
    const status = link => cb => (link && typeof link.onStatus === 'function' ? link.onStatus(cb) : () => {});
    const hits = (link, extra = {}) => ({
      connected: () => !!(link && link.connected),
      listen: cb => link.on(e => (e && e.type === 'hit' ? cb(e.lane, e.at, undefined, e.lane) : undefined)),
      status: status(link),
      ...extra
    });
    if (hw === 'trackmate' && g.Trackmate) {
      const L = g.Trackmate.link,
        map = () => g.Trackmate.laneMap(settings.tmLaneMap);
      return {
        connected: () => !!L.connected,
        listen: cb => on(L, 'hit', e => cb(map()[e.lane], e.at, undefined, e.lane)),
        status: status(L),
        // a car standing on the line is a car in the pits (after the pit hold time)
        pits: cb => on(L, 'block', e => cb(map()[e.lane])),
        calls: cb => on(L, 'call', e => cb(e.at)),
        power: typeof g.tmPower === 'function' ? { get: () => L.power, set: v => g.tmPower(v) } : null,
        map: { key: 'tmLaneMap', of: () => map() }
      };
    }
    if (hw === 'arduino' && g.ArduinoBox) {
      const L = g.ArduinoBox.link,
        C = g.ArduinoBox.C;
      const mapOf = () => (g.Trackmate ? g.Trackmate.laneMap(settings.abLaneMap) : Array.from({ length: 8 }, (_, i) => i));
      return hits(L, {
        listen: cb => on(L, 'hit', e => cb(e.lane, e.at, undefined, mapOf().indexOf(e.lane))),
        // (2.4.0 review) the pit sensor's lane is the one chosen by clicking its light (abPitMap), the same as in the race
        pits: cb => on(L, 'pit', e => (e.in ? cb(Number.isInteger(e.lane) ? e.lane : e.pit) : undefined)),
        pitSensors: {
          key: 'abPitMap',
          listen: cb => on(L, 'pit', e => cb(e.pit, !!e.in)),
          of: () => (Array.isArray(L.pitMap) ? L.pitMap.slice() : Array.from({ length: 8 }, (_, i) => i)),
          apply: m => typeof L.setPitMap === 'function' && L.setPitMap(m)
        },
        calls: cb => on(L, 'call', e => cb(e.at)),
        power:
          C && typeof g.abSend === 'function'
            ? {
                get: () => L.power,
                set: async v => {
                  await g.abSend(C.mainPower(!!v), v ? 'power on' : 'power off');
                  if (typeof L.setPower === 'function') L.setPower(!!v);
                  return true;
                }
              }
            : null,
        map: { key: 'abLaneMap', of: mapOf, apply: m => typeof L.setMap === 'function' && L.setMap(m) }
      });
    }
    if (hw === 'parallel' && g.ParallelPort)
      return hits(g.ParallelPort.link, {
        pits:
          (g.ParallelPort.link.config || {}).pitMode === 'separate'
            ? cb => on(g.ParallelPort.link, 'pit', e => (e.in ? cb(e.lane) : undefined))
            : null
      });
    if (hw === 'plugin' && g.pt && g.pt.link) return hits(g.pt.link);
    if (hw === 'ds' && g.DsTiming)
      return {
        connected: () => !!g.DsTiming.link.connected,
        status: status(g.DsTiming.link),
        listen: cb =>
          g.DsTiming.link.on(e =>
            e && (e.kind === 'lap' || e.kind === 'first-crossing-marker')
              ? cb(e.lane - 1, e.at, e.kind === 'lap' ? e.timeTicks / 10 : undefined)
              : undefined
          )
      };
    return null;
  }

  // ---- the panel (2.4.0, SlotForgeRestyle.md "Lane Check") ----
  // o: { lanes, hw, name (of the hardware), settings, note, color(i), layout, connect(), openHardware(), saveMap(key, map) -> settings, dialog (the dialog it is in) }
  // The lanes are asked for one at a time, so a sensor on the wrong lane is caught (and swapped in one click where the lane order can be set); then what the
  // hardware has: the pit sensors, the Track call button and the track power. Not connected: Connect, or open Timing Hardware.
  function mount(el, o = {}) {
    const g = o.global || root,
      live = { ...(o.settings || {}) },
      src = source(o.hw, live, g),
      T = createTally(o.lanes, { order: !!src }),
      caps = { pit: !!(src && src.pits), call: !!(src && src.calls), power: !!(src && src.power) },
      offs = [],
      timers = [];
    let closed = false,
      note = '',
      busy = false,
      lastOn = !!(src && src.connected());
    const hue = i =>
      (o.color && o.color(i)) ||
      (root.HomeStats && root.HomeStats.laneColor ? root.HomeStats.laneColor(o.layout || null, i) : '') ||
      '#98a0ab';
    const cols = n => (n <= 4 ? Math.max(1, n) : n <= 6 ? 3 : 4); // (the rows of Home's lanes: 5 and 6 lanes in rows of three, 7 and 8 in rows of four)
    const racing = () => typeof g.raceActive === 'function' && !!g.raceActive();
    const canSwap = () => !!(src && src.map);
    const clock = t => {
      const d = new Date(t);
      return [d.getHours(), d.getMinutes(), d.getSeconds()].map(x => String(x).padStart(2, '0')).join(':');
    };
    // what to do next, in words: the lanes first, then the pit lane, the Track call button and the power
    const next = () => {
      const s = summary(T),
        st = steps(T, caps);
      if (!st[0].done) return s;
      const pit = st.find(x => x.id === 'pit'),
        call = st.find(x => x.id === 'call'),
        power = st.find(x => x.id === 'power');
      if (pit && !pit.done) {
        const lane = T.pit.findIndex(x => !x) + 1;
        return {
          ok: false,
          text:
            o.hw === 'trackmate'
              ? `Now the pit lane: stop a car on the line of lane ${lane} for two seconds.`
              : `Now the pit lane: drive a car into the pit of lane ${lane}.`
        };
      }
      if (call && !call.done) return { ok: false, text: 'Now press the Track call button.' };
      if (power && !power.done)
        return {
          ok: false,
          text: racing()
            ? 'The track power is not switched during a race.'
            : T.power.off
              ? 'Now switch the track power on again: the cars should run.'
              : 'Now switch the track power off: the cars should stop.'
        };
      return { ok: true, text: 'Every check is done. The track is ready.' };
    };
    const draw = () => {
      if (closed || !el) return;
      const on = !!(src && src.connected());
      lastOn = on;
      const pill = o.dialog && o.dialog.querySelector('[data-lc-pill]');
      if (pill) {
        pill.hidden = !src;
        pill.className = 'lc-pill ' + (on ? 'lc-pon' : 'lc-poff');
        pill.innerHTML = src ? `<i></i>${on ? `Connected · ${T.lanes} ${T.lanes === 1 ? 'lane' : 'lanes'}` : 'Not connected'}` : '';
      }
      const close = o.dialog ? `<button type="button" class="btn${src && !on ? '' : ' primary'}" data-stclose>Done</button>` : '';
      if (!src) {
        el.innerHTML = `<p class="muted">No timing hardware is in use: laps are counted with the keys or simulated cars, so there are no sensors to test.</p>${close ? `<div class="row lc-foot">${close}</div>` : ''}`;
        return;
      }
      const s = next(),
        want = on ? expected(T) : -1,
        sw = swapText(T, canSwap()),
        st = steps(T, caps);
      const tile = (h, i) =>
        `<div class="st-lane${h ? ' st-seen' : ''}${T.wrong[i] !== null ? ' lc-wrong' : ''}${i === want && !T.swap ? ' lc-want' : ''}" data-stlane="${i}" style="--c:${esc(hue(i))}"><span class="st-num"><i aria-hidden="true">${i + 1}</i>Lane ${i + 1}</span><span class="st-light" aria-hidden="true"></span><span class="st-count">${
          T.wrong[i] !== null
            ? `<b class="lc-q">!</b><small>lit lane ${T.wrong[i] + 1}</small>`
            : h
              ? `<b>${h}</b><small>${h === 1 ? 'crossing' : 'crossings'}${T.lap[i] !== null ? ' · ' + secs(T.lap[i]) : ''}</small>`
              : i === want
                ? '<b class="lc-go">Go</b><small>drive now</small>'
                : '<b>–</b><small>waiting</small>'
        }</span>${caps.pit ? `<span class="lc-pit"><span>Pit lane</span><b class="${T.pit[i] ? 'lc-yes' : ''}">${T.pit[i] ? '✓ seen' : 'waiting'}</b></span>` : ''}</div>`;
      // (2.4.0 review) the pit sensors: a light per sensor that lights up when a car is on it; click it, then choose its lane
      const ps = src.pitSensors,
        pmap = ps ? ps.of() : null,
        pitN = ps ? Math.min(8, Math.max(T.lanes, ...T.pitLit.map((t, i) => (t !== null ? i + 1 : 0)))) : 0,
        litNow = i => T.pitLit[i] !== null && Date.now() - T.pitLit[i] < 1500;
      const pits =
        on && ps && st[0].done
          ? `<div class="lc-pits"><p class="muted lc-pithint">A pit sensor lights up when a car is on it. Click a light to choose its lane.</p><div class="lc-pitgrid" style="--n:${cols(pitN)}">${Array.from(
              { length: pitN },
              (_, i) =>
                `<button type="button" class="lc-pitsensor${litNow(i) ? ' lc-lit' : ''}${T.pitSel === i ? ' lc-sel' : ''}" data-lc-pitsel="${i}" aria-pressed="${T.pitSel === i}"><span class="lc-pitlight" aria-hidden="true"></span><b>Pit sensor ${i + 1}</b><small>${
                  litNow(i)
                    ? 'Lit up just now'
                    : pmap[i] < T.lanes
                      ? `Lane ${pmap[i] + 1}${T.pit[pmap[i]] ? ' · seen' : ''}`
                      : 'No lane in this race'
                }</small></button>`
            ).join('')}</div>${
              T.pitSel !== null && T.pitSel < pitN
                ? `<div class="lc-pitpick" role="group" aria-label="The lane of pit sensor ${T.pitSel + 1}"><span>Pit sensor ${T.pitSel + 1} is for</span>${Array.from(
                    { length: T.lanes },
                    (_, l) =>
                      `<button type="button" class="btn sm${pmap[T.pitSel] === l ? ' primary' : ''}" data-lc-pitlane="${l}" aria-pressed="${pmap[T.pitSel] === l}"${racing() ? ' disabled' : ''}>Lane ${l + 1}</button>`
                  ).join('')}<small class="muted">${racing() ? 'Not during a race' : 'Saved at once · the race uses it'}</small></div>`
                : ''
            }</div>`
          : '';
      const p = caps.power ? src.power.get() : null;
      const extra =
        on && (caps.call || caps.power)
          ? `<div class="lc-extra">${
              caps.call
                ? `<div class="lc-box" style="--c:#3b82f6"><span class="lc-ic" aria-hidden="true">◉</span><div><b>Track call button</b><small>${T.call !== null ? 'Pressed at ' + clock(T.call) : 'Press it once'}</small></div><span class="lc-r">${T.call !== null ? '<span class="lc-yes">✓ Works</span>' : '<span class="lc-wait">waiting</span>'}</span></div>`
                : ''
            }${
              caps.power
                ? `<div class="lc-box" style="--c:#f2b705"><span class="lc-ic" aria-hidden="true">⚡</span><div><b>Track power</b><small>${
                    racing()
                      ? 'Not during a race'
                      : !T.power.off
                        ? 'Switch it off: the cars should stop'
                        : !T.power.on
                          ? 'Switch it on again: the cars run'
                          : '✓ Off and on both work'
                  }</small></div><span class="lc-r"><span class="lc-seg" role="group" aria-label="Track power"><button type="button" data-lc-power="0" class="${p === false ? 'on' : ''}" aria-pressed="${p === false}"${racing() ? ' disabled' : ''}>Off</button><button type="button" data-lc-power="1" class="${p === true ? 'on' : ''}" aria-pressed="${p === true}"${racing() ? ' disabled' : ''}>On</button></span></span></div>`
                : ''
            }</div>`
          : '';
      el.innerHTML =
        (on
          ? ''
          : `<div class="lc-offbox"><b>Connect the ${esc(o.name || 'timing hardware')} first</b><p>Plug it in and connect: the lanes light up here as cars cross the line.</p><div class="row"><button type="button" class="btn primary" data-lc-connect${busy ? ' disabled' : ''}>${busy ? 'Connecting…' : 'Connect'}</button><button type="button" class="btn" data-lc-hw>Open Timing Hardware</button></div></div>`) +
        (note ? `<p class="lc-note" role="status">${esc(note)}</p>` : '') +
        (o.note ? `<p class="muted lc-onote">${esc(o.note)}</p>` : '') +
        (on && st.length > 1
          ? `<div class="lc-steps" style="--n:${st.length}">${st
              .map(
                (x, i) =>
                  `<div class="lc-step${x.done ? ' lc-done' : ''}${!x.done && st.slice(0, i).every(y => y.done) ? ' lc-now' : ''}"><em>${x.done ? '✓' : i + 1}</em>${esc(x.label)}${x.note ? `<small>${esc(x.note)}</small>` : ''}</div>`
              )
              .join('')}</div>`
          : '') +
        `<div class="st-lanes" style="--n:${cols(T.lanes)}">${T.hits.map(tile).join('')}</div>` +
        (sw
          ? `<div class="lc-swap" role="alert"><div><b>${esc(sw.head)}</b><p>${esc(sw.text)}</p></div>${canSwap() && !racing() ? `<button type="button" class="btn primary sm" data-lc-swap>${esc(sw.button)}</button>` : ''}<button type="button" class="btn sm ghost" data-lc-notnow>Not now</button></div>`
          : '') +
        pits +
        extra +
        `<div class="row st-foot lc-foot"><p class="st-sum ${s.ok ? 'st-ok' : 'st-warn'}" role="status">${esc(s.text)}</p><button type="button" class="btn ghost sm" data-streset>Start again</button>${close}</div>`;
    };
    const flash = lane => {
      const tile = el && el.querySelector && el.querySelector(`[data-stlane="${lane}"]`);
      if (!tile) return;
      tile.classList.add('st-flash');
      timers.push(setTimeout(() => tile.classList.remove('st-flash'), 350));
    };
    if (src) {
      offs.push(
        src.listen((lane, at, measured, sensor) => {
          if (closed) return;
          const i = hit(T, lane, at, measured, sensor);
          draw();
          if (i >= 0) flash(i);
        })
      );
      if (src.pits)
        offs.push(
          src.pits(lane => {
            if (!closed && pitSeen(T, lane) >= 0) draw();
          })
        );
      if (src.pitSensors)
        offs.push(
          src.pitSensors.listen((sensor, onIt) => {
            if (closed || !Number.isInteger(sensor) || sensor < 0 || sensor > 7) return;
            if (onIt) {
              T.pitLit[sensor] = Date.now();
              if (!busy) T.pitSel = sensor; // (the light that lit is the one to choose a lane for)
              timers.push(setTimeout(() => !closed && draw(), 1600)); // (it dims again)
            }
            draw();
          })
        );
      if (src.calls)
        offs.push(
          src.calls(() => {
            if (closed) return;
            callSeen(T, Date.now());
            draw();
          })
        );
      if (src.status) offs.push(src.status(() => draw()));
      // (a connection made elsewhere, or lost, shows here too)
      timers.push(
        setInterval(() => {
          if (!closed && !!src.connected() !== lastOn) draw();
        }, 1000)
      );
    }
    const offStatus = src && o.onStatusLink && o.onStatusLink(draw);
    const connect = async () => {
      if (typeof o.connect === 'function') return o.connect();
      // (the same connect as Connect & use on the Timing Desk)
      if (typeof DESK_CONNECT !== 'undefined' && DESK_CONNECT[o.hw]) return DESK_CONNECT[o.hw]();
    };
    const openHardware = () => {
      if (typeof o.openHardware === 'function') return o.openHardware();
      if (o.dialog) o.dialog.querySelector('[data-stclose]')?.click();
      if (typeof state !== 'undefined' && typeof render === 'function') {
        state.tab = 'settings';
        state.settingsSub = 'hardware';
        state.hwSub = o.hw;
        render();
      }
    };
    const saveMap = async (key, m) => {
      if (typeof o.saveMap === 'function') return o.saveMap(key, m);
      // (2.4.0 review) the app's window.api: inside this file the name `api` is Lane Check's own export, so the lane swap and the pit lights saved nothing
      const appApi = g.api || root.api;
      if (!appApi || typeof appApi.setSettings !== 'function') return { [key]: m };
      const st = await appApi.setSettings({ [key]: m });
      if (typeof state !== 'undefined') state.settings = st;
      return st;
    };
    draw();
    if (el)
      el.addEventListener('click', async ev => {
        const b = ev.target && ev.target.closest && ev.target.closest('button');
        if (!b || closed) return;
        if (b.hasAttribute('data-streset')) {
          Object.assign(T, createTally(T.lanes, { order: !!src }));
          note = '';
          return draw();
        }
        if (b.hasAttribute('data-lc-notnow')) {
          noOrder(T);
          return draw();
        }
        if (b.hasAttribute('data-lc-hw')) return openHardware();
        if (b.hasAttribute('data-lc-connect')) {
          busy = true;
          note = '';
          draw();
          try {
            await connect();
          } catch (e) {
            note = 'Could not connect: ' + e.message;
          }
          await new Promise(r => timers.push(setTimeout(r, 500)));
          busy = false;
          if (!src.connected() && !note) note = 'Not connected yet: plug it in, or open Timing Hardware to choose its port.';
          return draw();
        }
        if (b.dataset.lcPitsel !== undefined) {
          T.pitSel = Number(b.dataset.lcPitsel);
          return draw();
        }
        if (b.dataset.lcPitlane !== undefined && src.pitSensors && T.pitSel !== null && !racing()) {
          const sensor = T.pitSel,
            lane = Number(b.dataset.lcPitlane),
            m = pitAssign(src.pitSensors.of(), sensor, lane);
          b.disabled = true;
          try {
            const st = await saveMap(src.pitSensors.key, m);
            Object.assign(live, st && st[src.pitSensors.key] ? st : { [src.pitSensors.key]: m });
            src.pitSensors.apply(m);
            pitSeen(T, lane);
            T.pitSel = null;
            note = `Pit sensor ${sensor + 1} is now lane ${lane + 1}.`;
          } catch (e) {
            note = 'Could not save the pit sensor: ' + e.message;
          }
          return draw();
        }
        if (b.hasAttribute('data-lc-swap') && T.swap && src.map) {
          const a = T.swap.lane,
            lit = T.swap.lit,
            m0 = src.map.of(),
            sensor = T.swap.sensor !== null && T.swap.sensor >= 0 ? T.swap.sensor : m0.indexOf(lit);
          const m = g.Trackmate && g.Trackmate.swapLane ? g.Trackmate.swapLane(m0, sensor, a) : m0;
          b.disabled = true;
          try {
            const st = await saveMap(src.map.key, m);
            Object.assign(live, st && st[src.map.key] ? st : { [src.map.key]: m });
            if (src.map.apply) src.map.apply(m);
            swapped(T, Date.now());
            note = `Lanes ${a + 1} and ${lit + 1} are swapped: lane ${a + 1} now counts on that sensor.`;
          } catch (e) {
            note = 'Could not swap the lanes: ' + e.message;
          }
          return draw();
        }
        if (b.dataset.lcPower !== undefined && src.power && !racing()) {
          const v = b.dataset.lcPower === '1';
          b.disabled = true;
          try {
            const ok = await src.power.set(v);
            if (ok !== false) powerSet(T, v);
            else note = 'The interface did not answer.';
          } catch (e) {
            note = 'Could not switch the power: ' + e.message;
          }
          return draw();
        }
      });
    return {
      tally: T,
      redraw: draw,
      close() {
        closed = true;
        offs.forEach(f => typeof f === 'function' && f());
        if (typeof offStatus === 'function') offStatus();
        timers.forEach(t => {
          clearTimeout(t);
          clearInterval(t);
        });
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
      d.innerHTML = `<div class="lc-head"><div><span class="lc-k">Lane Check${o.name ? ' · ' + esc(o.name) : ''}</span><h3 id="st-title">Test the sensors</h3></div><span class="lc-pill" data-lc-pill></span></div><div class="st-body"></div>`;
      o = { ...o, dialog: d };
      document.body.appendChild(d);
      const panel = mount(d.querySelector('.st-body'), o);
      const finish = () => {
        if (!d.isConnected) return;
        panel.close();
        d.close();
        d.remove();
        resolve(summary(panel.tally));
      };
      d.addEventListener('click', ev => {
        if (ev.target && ev.target.closest && ev.target.closest('[data-stclose]')) finish();
      });
      d.addEventListener('cancel', ev => {
        ev.preventDefault();
        finish();
      });
      d.showModal();
      d.querySelector('[data-stclose]')?.focus();
    });
  }

  const api = {
    createTally,
    hit,
    missing,
    summary,
    source,
    mount,
    openDialog,
    MIN_GAP,
    expected,
    swapped,
    noOrder,
    pitSeen,
    pitAssign,
    callSeen,
    powerSet,
    steps,
    swapText
  };
  root.SensorTest = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
