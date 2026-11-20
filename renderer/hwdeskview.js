// App Settings › Timing Hardware as a Timing Desk (2.4.0, SlotForgeRestyle.md "Timing Desk"): the overview with the big card and the live lanes, the interfaces
// as cards with Connect & use, every interface page under the same big card with its sections as tabs (SettingsRail, secTabs), Diagnostics behind a switch,
// finding the lane order, and the Forgotten devices. The words and the cards are made by renderer/hwdesk.js.
// Uses the page's globals (state, api, render, setTimingHw, timingConnectedNow, the connect and close functions of every interface page).

// ---- the crossings since the app started, from the interface that counts the laps (every lane: hits, last crossing, last lap) ----
const HwLive = (() => {
  let T = null,
    off = null,
    key = '',
    timer = 0;
  const listeners = new Set();
  const lanes = () => deskLanes().lanes;
  function watch() {
    if (typeof SensorTest === 'undefined' || typeof state === 'undefined' || !state.settings) return;
    const chosen = Hardware.timingChosen(state.settings),
      src = chosen === 'none' ? null : SensorTest.source(chosen, state.settings),
      on = !!(src && src.connected()),
      n = lanes(),
      k = [chosen, on, n, JSON.stringify(state.settings.tmLaneMap || ''), JSON.stringify(state.settings.abLaneMap || '')].join('|');
    if (k === key) return;
    key = k;
    if (off) off();
    off = null;
    if (!T || T.lanes !== n) T = SensorTest.createTally(n);
    if (src && on)
      off = src.listen((lane, at, measured) => {
        SensorTest.hit(T, lane, typeof performance !== 'undefined' ? performance.now() : Date.now(), measured);
        listeners.forEach(f => {
          try {
            f(lane);
          } catch (x) {
            /* a page that is gone */
          }
        });
      });
  }
  function start() {
    if (timer) return;
    watch();
    timer = setInterval(watch, 1500);
    if (timer && timer.unref) timer.unref(); // (a test without a window ends)
  }
  return {
    start,
    watch,
    tally: () => T,
    total: () => (T ? T.hits.reduce((a, b) => a + b, 0) : 0),
    on(f) {
      listeners.add(f);
      return () => listeners.delete(f);
    },
    reset() {
      T = SensorTest.createTally(lanes());
    }
  };
})();
// the lanes to show: the track of the next race (Home), else the lanes set on the interface, else 4
function deskLanes() {
  const r = (typeof state !== 'undefined' && state.raceCheckInput) || {};
  if (Number(r.lanes) > 0) return { lanes: Math.min(8, Number(r.lanes)), from: r.trackName || 'the next race' };
  const s = (typeof state !== 'undefined' && state.settings) || {},
    chosen = typeof Hardware !== 'undefined' ? Hardware.timingChosen(s) : 'none';
  const own = chosen === 'trackmate' ? Number(s.tmLanes) : chosen === 'parallel' ? Number((s.parallelPort || {}).lanes) : 0;
  return { lanes: own > 0 ? Math.min(8, own) : 4, from: '' };
}
// the sensor of every lane (for the live cards): the lane map of the interface, inverted
function deskSensors(id, n) {
  if (typeof Trackmate === 'undefined') return null;
  const key = (HwDesk.deviceOf(id) || {}).map;
  if (!key) return null;
  const map = Trackmate.laneMap(state.settings[key]);
  return Array.from({ length: n }, (_, lane) => map.indexOf(lane));
}
// (2.4.0 review) a Connect press connects: the port chosen on the page, else the remembered one, also when "connect when the app starts" is off
const DESK_CONNECT = {
  trackmate: () =>
    typeof hw !== 'undefined' && hw.dev && !hw.open && typeof tmOpen === 'function'
      ? tmOpen(hw.kind === 'serial')
      : typeof tmAutoConnect === 'function' && tmAutoConnect(true),
  arduino: () =>
    typeof ab !== 'undefined' && ab.dev && !ab.open && typeof abOpen === 'function'
      ? abOpen()
      : typeof abAutoConnect === 'function' && abAutoConnect(true),
  parallel: () => typeof ppAutoConnect === 'function' && ppAutoConnect(true),
  ds: () =>
    typeof dsc !== 'undefined' && dsc.dev && !dsc.open && typeof dscOpen === 'function'
      ? dscOpen()
      : typeof dscAutoConnect === 'function' && dscAutoConnect(),
  plugin: () => typeof ptConnect === 'function' && ptConnect()
};
const DESK_CLOSE = {
  trackmate: () => typeof tmClose === 'function' && tmClose(),
  arduino: () => typeof abClose === 'function' && abClose(),
  parallel: () => typeof ppClose === 'function' && ppClose(),
  ds: () => typeof dscClose === 'function' && dscClose(),
  plugin: () => typeof ptClose === 'function' && ptClose()
};
let deskNote = '',
  deskTimer = 0;
// Connect & use: this interface counts the laps from now on, and it connects by itself when it is remembered or plugged in; else its Connection section opens
async function deskUse(id, box) {
  if ((await setTimingHw(id)) === false) return;
  try {
    await DESK_CONNECT[id]();
  } catch (x) {
    /* said below */
  }
  await new Promise(r => setTimeout(r, 400));
  const on = timingConnectedNow()[id];
  deskNote = on ? '' : 'It counts the laps once it is connected: choose its port under Connection.';
  state.hwSub = id;
  renderHardwareArea(box);
}
function deskStanding() {
  const s = state.settings || {},
    chosen = Hardware.timingChosen(s),
    connected = timingConnectedNow();
  const remembered = {};
  for (const [id, k] of Object.entries({ trackmate: 'tmDevice', arduino: 'abDevice', ds: 'dsDevice' }))
    if (s[k]) remembered[id] = 'remembered device';
  if (s.abVirtual) remembered.arduino = 'virtual box';
  return { chosen, connected, remembered };
}
// the big card of an interface page, or of the overview
function deskHero(id) {
  const ctx = deskStanding(),
    L = deskLanes(),
    d = HwDesk.deviceOf(id);
  if (id === 'overview' && ctx.chosen === 'none')
    return HwDesk.heroHtml({
      id: 'none',
      kicker: 'Timing hardware',
      name: 'Nothing counts laps yet',
      tone: 'none',
      state: 'Laps are only counted by hand',
      note: 'Plug in your timing interface: Timing finds it and asks if it should count the laps. Or choose one below.',
      actions: [
        { id: 'find', label: 'Find my interface', primary: true, icon: 'bolt' },
        { id: 'virtual', label: 'Try a virtual one' }
      ]
    });
  const shown = id === 'overview' ? HwDesk.deviceOf(ctx.chosen) : d;
  if (!shown) return '';
  const st = HwDesk.standing(shown.id, ctx),
    counting = ctx.chosen === shown.id,
    on = !!ctx.connected[shown.id];
  const facts = [[L.lanes, L.from ? ` lanes, from ${L.from}` : ' lanes']];
  if (shown.id === 'ds' && state.settings.dsType) facts.push([Hardware.dsTypeName(state.settings.dsType), ' model']);
  const actions = counting
    ? on
      ? [
          { id: 'test', label: 'Test the sensors', primary: id === 'overview', icon: 'check' },
          { id: 'disconnect', label: 'Disconnect' }
        ]
      : [
          { id: 'connect', label: 'Connect', primary: true, icon: 'bolt' },
          { id: 'connection', label: 'Choose the port' }
        ]
    : [{ id: 'use', label: 'Connect & use', primary: true, icon: 'bolt' }, ...(on ? [{ id: 'disconnect', label: 'Disconnect' }] : [])];
  if (HwDesk.deviceOf(shown.id).map && on && id !== 'overview') actions.push({ id: 'order', label: 'Find the lane order', icon: 'swap' });
  if (id === 'overview') actions.push({ id: 'none', label: 'Count laps by hand' }); // (no timing hardware: the keys or simulated cars)
  return HwDesk.heroHtml({
    id: shown.id,
    kicker: counting ? 'Counts the laps' : 'Interface',
    name: shown.name,
    tone: counting ? (on ? 'use' : 'warn') : on ? 'ready' : 'off',
    state: counting
      ? on
        ? 'Connected · counting laps'
        : 'Not connected · no laps are counted'
      : on
        ? 'Connected · not counting laps'
        : st.text,
    facts,
    note: id === shown.id && deskNote ? deskNote : '',
    actions
  });
}
function renderTimingDesk(box) {
  if (typeof ptPageDispose === 'function') ptPageDispose();
  if (typeof ppPageDispose === 'function') ppPageDispose();
  clearInterval(deskTimer);
  HwLive.start();
  HwLive.watch();
  const ids = ['overview', ...HwDesk.DEVICES.map(d => d.id), 'forgotten'];
  if (!ids.includes(state.hwSub)) state.hwSub = 'overview';
  const ctx = deskStanding();
  box.innerHTML = `<div class="sub" id="hwtabs" role="tablist"></div><div id="hwhero"></div><div id="hwbox" class="hd-box"></div><div id="hwdiag"></div>`;
  renderTabs(
    document.getElementById('hwtabs'),
    [['overview', 'Overview'], ...HwDesk.DEVICES.map(d => [d.id, d.name]), ['forgotten', 'Forgotten devices']],
    state.hwSub,
    id => {
      deskNote = '';
      state.hwSub = id;
      renderHardwareArea(box);
    }
  );
  // every tab says how it stands
  document.querySelectorAll?.('#hwtabs .tab').forEach(b => {
    const id = b.dataset.id,
      st =
        id === 'overview'
          ? ctx.chosen === 'none'
            ? ['warn', 'Nothing counts laps yet']
            : [ctx.connected[ctx.chosen] ? 'use' : 'warn', `${(HwDesk.deviceOf(ctx.chosen) || {}).name} counts the laps`]
          : id === 'forgotten'
            ? ['off', `${(state.settings.hwIgnored || []).length} set aside`]
            : (s => [s.tone, s.text])(HwDesk.standing(id, ctx));
    b.classList.toggle('inuse', id === ctx.chosen);
    b.insertAdjacentHTML?.(
      'beforeend',
      `<span class="hwt-state" data-state="${st[0] === 'use' ? 'on' : st[0]}"><i aria-hidden="true"></i>${esc(st[1])}</span>`
    );
  });
  const hero = document.getElementById('hwhero'),
    body = document.getElementById('hwbox'),
    diag = document.getElementById('hwdiag');
  if (state.hwSub !== 'forgotten') hero.innerHTML = deskHero(state.hwSub);
  hero.onclick = ev => deskAct(ev.target.closest('[data-hd-act]'), box);
  // the live lanes of what counts the laps: on the overview, and on its own page
  const drawLanes = () => {
    const lanesBox = document.getElementById('hd-lanes');
    if (!lanesBox || !lanesBox.isConnected) return;
    const T = HwLive.tally(),
      on = ctx.chosen !== 'none' && timingConnectedNow()[ctx.chosen];
    const html = on ? HwDesk.laneCardsHtml(T, { now: performance.now(), sensors: deskSensors(ctx.chosen, T ? T.hits.length : 4) }) : '';
    if (lanesBox.innerHTML !== html) lanesBox.innerHTML = html;
  };
  if (state.hwSub === ctx.chosen && ctx.connected[ctx.chosen]) hero.insertAdjacentHTML('beforeend', '<div id="hd-lanes"></div>');
  // the page follows a connection that changes (a port chosen below, a cable pulled): the big card, the tabs and the lanes are drawn again
  const sigOf = () => JSON.stringify([Hardware.timingChosen(state.settings), timingConnectedNow()]);
  const sig = sigOf();
  deskTimer = setInterval(() => {
    if (!hero.isConnected) return clearInterval(deskTimer);
    if (sigOf() !== sig) {
      if (timingConnectedNow()[Hardware.timingChosen(state.settings)]) deskNote = '';
      clearInterval(deskTimer);
      return renderHardwareArea(box);
    }
    drawLanes();
  }, 500);
  if (deskTimer && deskTimer.unref) deskTimer.unref();
  drawLanes();
  if (state.hwSub === 'overview') {
    body.innerHTML = `<div id="hd-lanes"></div><div class="hd-h"><h3>Interfaces</h3><span>One counts the laps at a time. Connect &amp; use connects it and puts it in use.</span></div><div class="hd-cards">${HwDesk.DEVICES.map(
      d =>
        HwDesk.cardHtml(d, HwDesk.standing(d.id, ctx), {
          primary: ctx.chosen === 'none' ? false : d.id !== ctx.chosen && !!ctx.remembered[d.id] && !ctx.connected[ctx.chosen]
        })
    ).join('')}${HwDesk.soonCard()}</div>`;
    drawLanes();
    body.onclick = ev => {
      const open = ev.target.closest('[data-hd-open]'),
        use = ev.target.closest('[data-hd-use]');
      if (open) {
        state.hwSub = open.dataset.hdOpen;
        return renderHardwareArea(box);
      }
      if (use) return deskUse(use.dataset.hdUse, box);
    };
    return;
  }
  if (state.hwSub === 'forgotten') {
    hero.innerHTML = '';
    body.innerHTML = `<div class="hd-h"><h3>Forgotten devices</h3><span>USB devices you said are not timing hardware. Timing does not ask about them again until you choose Ask again.</span></div>${HwDesk.forgottenHtml(state.settings.hwIgnored, k => (typeof HwDetect !== 'undefined' && HwDetect.nameOf ? HwDetect.nameOf(k) : ''))}`;
    body.onclick = async ev => {
      const b = ev.target.closest('[data-hd-unforget]');
      if (!b) return;
      state.settings = await api.setSettings({ hwIgnored: (state.settings.hwIgnored || []).filter(k => k !== b.dataset.hdUnforget) });
      renderHardwareArea(box);
    };
    return;
  }
  // an interface page: its own page under the big card, the Diagnostics switch under it
  const dev = HwDesk.deviceOf(state.hwSub);
  diag.innerHTML = dev.diag.length
    ? `<label class="hd-fold"><span class="ico">${HwDesk.ICON.plugin(16)}</span><span><b>Diagnostics</b> · ${
        dev.id === 'ds'
          ? 'making a capture for the developers, checking a saved capture, the raw data'
          : dev.id === 'trackmate'
            ? 'the raw serial data, a HID finder and sending bytes by hand'
            : 'the raw data and the saved logs'
      }. For finding faults with the interface.</span><input type="checkbox" role="switch" data-hd-diag${state.settings.hwDiagnostics ? ' checked' : ''}></label>`
    : '';
  diag.onchange = async ev => {
    if (!ev.target.matches('[data-hd-diag]')) return;
    state.settings = await api.setSettings({ hwDiagnostics: ev.target.checked });
    renderHardwareArea(box);
  };
  if (state.hwSub === 'arduino') return renderArduinoSettings(body);
  if (state.hwSub === 'plugin') return renderPluginTimingSettings(body);
  if (state.hwSub === 'parallel') return renderParallelSettings(body);
  if (state.hwSub === 'ds') return renderDsSettings(body);
  renderHardwareSettings(body);
}
async function deskAct(b, box) {
  if (!b || b.disabled) return;
  const ctx = deskStanding(),
    id = HwDesk.deviceOf(state.hwSub) ? state.hwSub : ctx.chosen,
    act = b.dataset.hdAct;
  if (act === 'use') return deskUse(id, box);
  if (act === 'none') {
    if ((await setTimingHw('none')) === false) return;
    return renderHardwareArea(box);
  }
  if (act === 'find' || act === 'virtual') {
    // nothing is chosen: the Trackmate is the most common; its page has the port finder and the virtual Trackmate
    state.hwSub = 'trackmate';
    deskNote =
      act === 'virtual'
        ? 'Use the virtual Trackmate under Connection, then Connect & use.'
        : 'Plug it in, then press Find the Trackmate under Connection (or open the page of your interface).';
    return renderHardwareArea(box);
  }
  if (act === 'test')
    return SensorTest.openDialog({
      lanes: deskLanes().lanes,
      hw: ctx.chosen,
      name: (HwDesk.deviceOf(ctx.chosen) || {}).name,
      settings: state.settings
    });
  if (act === 'disconnect') {
    b.disabled = true;
    try {
      await DESK_CLOSE[id]();
    } finally {
      renderHardwareArea(box);
    }
    return;
  }
  if (act === 'connect') {
    b.disabled = true;
    try {
      await DESK_CONNECT[id]();
    } catch (x) {
      /* said below */
    }
    await new Promise(r => setTimeout(r, 400));
    deskNote = timingConnectedNow()[id] ? '' : 'Not connected yet: choose its port under Connection.';
    return renderHardwareArea(box);
  }
  if (act === 'connection') {
    if (state.hwSub !== id) {
      state.hwSub = id;
      renderHardwareArea(box);
    }
    return SettingsRail.show && SettingsRail.show('connection');
  }
  if (act === 'order') return deskOrder(id, box);
}
// find the lane order: drive one car over the sensor of each lane, in order; Timing sets which sensor counts for which lane
function deskOrder(id, box) {
  const dev = HwDesk.deviceOf(id);
  if (!dev || !dev.map) return;
  const n = deskLanes().lanes,
    oldMap = Trackmate.laneMap(state.settings[dev.map]),
    W = HwDesk.orderStart(n, oldMap);
  const d = document.createElement('dialog');
  d.className = 'appdlg hd-win';
  d.innerHTML = `<div class="hd-whd"><div><span class="hd-k">${esc(dev.name)} · lanes</span><h2>Find the lane order</h2></div></div><div class="hd-wb"><p class="muted">Drive one car over the sensor of each lane, in order: lane 1 first. Timing listens and sets which sensor counts for which lane.</p><div data-steps></div><div data-say role="status"></div></div><div class="row appdlg-buttons"><button type="button" class="btn" data-cancel>Cancel</button><button type="button" class="btn primary" data-ok disabled>Use this order</button></div>`;
  document.body.appendChild(d);
  // the raw sensor of a crossing: the Trackmate sends its sensor; the Arduino box sends its lane, so its own map is turned back
  const link = id === 'trackmate' ? Trackmate.link : ArduinoBox.link;
  const draw = () => {
    d.querySelector('[data-steps]').innerHTML = HwDesk.orderStepsHtml(W);
    const r = HwDesk.orderResult(W);
    d.querySelector('[data-say]').innerHTML = r.changes.length
      ? `<div class="hd-say">${r.changes.map(c => esc(HwDesk.changeText(c))).join(' ')} ${r.done ? 'Use this order to swap them.' : ''}</div>`
      : W.step
        ? `<div class="hd-say ok">So far every lane is on the sensor it was set to.</div>`
        : '';
    d.querySelector('[data-ok]').disabled = !r.done;
  };
  let lastAt = 0;
  const off = link.on(e => {
    if (!e || e.type !== 'hit') return;
    const now = performance.now();
    if (now - lastAt < 250) return; // (one car on one sensor sends more than one crossing)
    lastAt = now;
    const sensor = id === 'trackmate' ? e.lane : oldMap.indexOf(e.lane);
    if (HwDesk.orderHit(W, sensor)) draw();
  });
  const close = () => {
    off();
    d.close();
    d.remove();
  };
  d.onclick = async ev => {
    const redo = ev.target.closest('[data-hd-redo]');
    if (redo) {
      HwDesk.orderRedo(W, Number(redo.dataset.hdRedo));
      return draw();
    }
    if (ev.target.closest('[data-cancel]')) return close();
    if (ev.target.closest('[data-ok]')) {
      const r = HwDesk.orderResult(W);
      state.settings = await api.setSettings({ [dev.map]: r.map });
      if (id === 'arduino' && ArduinoBox.link && typeof ArduinoBox.link.setMap === 'function') ArduinoBox.link.setMap(r.map);
      close();
      renderHardwareArea(box);
    }
  };
  d.addEventListener('cancel', ev => {
    ev.preventDefault();
    close();
  });
  draw();
  d.showModal();
}
