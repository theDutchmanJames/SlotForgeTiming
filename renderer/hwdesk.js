// (2.4.0, SlotForgeRestyle.md "Timing Desk") App Settings › Timing Hardware as a desk: a big card for what counts the laps (or that nothing does), a live card
// per lane, the interfaces as cards of equal weight with Connect & use, the same big card on every interface page, finding the lane order by driving a car
// over each lane, and the devices that were set aside as "not timing hardware" (Forgotten devices).
// Pure: it makes text and numbers only, so it can be tested without a screen. renderer/app.js (renderHardwareArea) draws it and wires the buttons.
(function (root) {
  'use strict';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const LANES = ['#e5484d', '#3b82f6', '#f5c211', '#3ecf8e', '#a855f7', '#f97316', '#14b8a6', '#ec4899'];
  const LETTERS = 'ABCDEFGH';
  const ic = (d, s = 18) =>
    `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICON = {
    trackmate: d => ic('<path d="M12 3v14M8 7l4-4 4 4M8 13h8M7 17h10v4H7z"/>', d),
    arduino: d =>
      ic('<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>', d),
    parallel: d =>
      ic(
        '<rect x="3" y="7" width="18" height="10" rx="2"/><path d="M7 11h.01M10 11h.01M13 11h.01M16 11h.01M8.5 14h.01M11.5 14h.01M14.5 14h.01"/>',
        d
      ),
    ds: d => ic('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 10h4M7 14h10M15 9h2"/>', d),
    plugin: d => ic('<path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0zM12 17v5"/>', d),
    oxigen: d => ic('<path d="M2 12h3l2-6 4 12 3-9 2 3h6"/>', d),
    none: d => ic('<path d="M12 3v14M8 7l4-4 4 4M8 13h8M7 17h10v4H7z"/>', d),
    check: d => ic('<path d="m5 12 5 5 9-10"/>', d),
    bolt: d => ic('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>', d),
    swap: d => ic('<path d="M7 7h11l-3-3M17 17H6l3 3"/>', d)
  };
  // the interfaces: id, name, what it is, whether its lanes can be put in order here (a sensor-to-lane map), its developer sections (Diagnostics)
  const DEVICES = [
    { id: 'trackmate', name: 'Trackmate', sub: 'USB serial · up to 8 lanes', map: 'tmLaneMap', diag: ['advanced'] },
    { id: 'arduino', name: 'Arduino box', sub: 'SlotForge sketch · up to 8 lanes', map: 'abLaneMap', diag: ['monitor'] },
    { id: 'parallel', name: 'Parallel port', sub: 'LPT · 4 to 6 lanes', map: '', diag: [] },
    { id: 'ds', name: 'DS Electronics', sub: 'DS-030 to DS-300 RC', map: '', diag: ['guide', 'monitor', 'check'] },
    { id: 'plugin', name: 'Plugin', sub: 'From an installed plugin', map: '', diag: [] }
  ];
  const deviceOf = id => DEVICES.find(d => d.id === id) || null;
  // how an interface stands: { tone: 'use' | 'warn' | 'ready' | 'off', text }
  // ctx: { chosen, connected: { id: bool }, remembered: { id: text }, plugins (a plugin with timing is installed) }
  function standing(id, ctx = {}) {
    const on = !!(ctx.connected && ctx.connected[id]),
      mine = ctx.chosen === id,
      kept = ctx.remembered && ctx.remembered[id];
    if (mine)
      return on
        ? { tone: 'use', text: 'In use · connected' + (ctx.port && ctx.port[id] ? ' on ' + ctx.port[id] : '') }
        : { tone: 'warn', text: 'In use · not connected' };
    if (on) return { tone: 'ready', text: 'Connected · not counting laps' };
    if (id === 'plugin' && ctx.plugins === false) return { tone: 'off', text: 'No plugin with timing' };
    if (kept) return { tone: 'ready', text: 'Ready · ' + kept };
    return { tone: 'off', text: 'Not set up' };
  }
  // an interface as a card: its picture, name, what it is, how it stands, Set up and Connect & use (Connect & use is the main button only when nothing counts laps
  // or the card is the one to finish setting up)
  function cardHtml(d, st, o = {}) {
    const inUse = st.tone === 'use' || st.tone === 'warn';
    return `<article class="hd-card${st.tone === 'use' ? ' use' : ''}" data-hd-card="${esc(d.id)}"><span class="ico">${ICON[d.id](24)}</span><div><b>${esc(d.name)}</b><small>${esc(d.sub)}</small><div class="st"><i class="hd-dot ${st.tone}" aria-hidden="true"></i>${esc(st.text)}</div></div><div class="ft"><button type="button" class="btn sm" data-hd-open="${esc(d.id)}">Set up</button>${
      inUse && st.tone === 'use'
        ? ''
        : `<button type="button" class="btn sm${o.primary ? ' primary' : ''}" data-hd-use="${esc(d.id)}">${inUse ? 'Connect' : 'Connect &amp; use'}</button>`
    }</div></article>`;
  }
  const soonCard = () =>
    `<article class="hd-card soon" aria-disabled="true"><span class="ico">${ICON.oxigen(24)}</span><div><b>oXigen Digital</b><small>Digital racing</small><div class="st"><i class="hd-dot off" aria-hidden="true"></i>Coming later</div></div><div class="ft"><span class="muted">Not yet supported</span></div></article>`;
  // the big card on top: what counts the laps (or nothing), how it stands, a few facts, and its buttons
  // o: { id ('none' or an interface), name, kicker, tone, state, facts: [[value, word]], actions: [{ id, label, primary, icon }] }
  function heroHtml(o) {
    return `<section class="hd-hero ${o.tone === 'use' ? 'ok' : o.tone === 'warn' || o.tone === 'none' ? 'warn' : ''}" aria-label="${esc(o.name)}"><span class="hd-dev">${(ICON[o.id] || ICON.none)(46)}</span><div class="hd-id"><span class="hd-k">${esc(o.kicker)}</span><h1>${esc(o.name)}</h1><span class="hd-state ${o.tone === 'use' ? 'ok' : o.tone === 'ready' ? 'ready' : o.tone === 'off' ? 'off' : 'warn'}" role="status"><i aria-hidden="true"></i>${esc(o.state)}</span>${
      o.facts && o.facts.length
        ? `<div class="hd-facts">${o.facts.map(([v, w]) => `<span>${v !== '' && v !== undefined ? `<b>${esc(v)}</b>` : ''}${esc(w)}</span>`).join('')}</div>`
        : ''
    }${o.note ? `<p class="hd-note">${esc(o.note)}</p>` : ''}</div><div class="hd-acts">${(o.actions || [])
      .map(
        a =>
          `<button type="button" class="btn${a.primary ? ' primary' : ''}" data-hd-act="${esc(a.id)}"${a.disabled ? ' disabled' : ''}>${a.icon && ICON[a.icon] ? ICON[a.icon](15) : ''}${esc(a.label)}</button>`
      )
      .join('')}</div></section>`;
  }
  // a live card per lane: its light, the last lap, how long ago, which sensor, how many crossings
  // T: a tally of SensorTest ({ hits, last, lap }), sensors: the letter of each lane, now: the clock
  function laneCardsHtml(T, o = {}) {
    const n = T ? T.hits.length : o.lanes || 4,
      now = o.now || 0;
    const ago = t => {
      if (t === null || t === undefined) return '';
      const s = Math.max(0, Math.round((now - t) / 1000));
      return s < 2 ? 'just now' : s < 60 ? s + ' s ago' : Math.round(s / 60) + ' min ago';
    };
    return `<div class="hd-lanes" style="--n:${n <= 4 ? n : n <= 6 ? 3 : 4}">${Array.from({ length: n }, (_, i) => {
      const hits = T ? T.hits[i] : 0,
        lap = T ? T.lap[i] : null,
        lit = T && T.last[i] !== null && now - T.last[i] < 900;
      return `<div class="hd-lane" style="--c:${LANES[i]}" data-hd-lane="${i}"><div class="h"><b>Lane ${i + 1}</b><span class="hd-led${lit ? ' hit' : ''}" aria-hidden="true"></span></div><div class="t">${lap ? (lap / 1000).toFixed(3) : '—'}</div><small>${hits ? (lap ? 'last lap · ' : 'seen · ') + ago(T.last[i]) : o.waiting || 'no car yet'}</small><div class="sensor">${o.sensors && o.sensors[i] !== undefined ? 'sensor ' + LETTERS[o.sensors[i]] + ' · ' : ''}${hits} ${hits === 1 ? 'crossing' : 'crossings'}</div></div>`;
    }).join('')}</div>`;
  }

  // ---- finding the lane order: drive one car over the sensor of each lane, in order ----
  function orderStart(lanes, map) {
    const n = Math.max(1, Math.min(8, Math.floor(Number(lanes)) || 1));
    return { lanes: n, step: 0, sensors: [], old: Array.isArray(map) ? map.slice() : Array.from({ length: 8 }, (_, i) => i) };
  }
  // a sensor was crossed: it belongs to the lane of this step (a sensor that is already taken, or a step past the end, is not counted)
  function orderHit(W, sensor) {
    if (!Number.isInteger(sensor) || sensor < 0 || sensor > 7 || W.step >= W.lanes || W.sensors.includes(sensor)) return false;
    W.sensors[W.step] = sensor;
    W.step++;
    return true;
  }
  // do a lane again: that lane and the ones after it
  function orderRedo(W, lane) {
    W.sensors = W.sensors.slice(0, lane);
    W.step = Math.min(lane, W.sensors.length);
  }
  // the map that this gives (item n is the lane of sensor n, as Trackmate.laneMap keeps it), and what changes: [{ lane, sensor, was (the sensor it had) }]
  function orderResult(W) {
    const map = W.old.slice(0, 8);
    while (map.length < 8) map.push(map.length);
    const next = map.slice(),
      taken = new Set();
    W.sensors.forEach((sensor, lane) => {
      next[sensor] = lane;
      taken.add(sensor);
    });
    // the sensors that were not driven over keep their lanes where they can, and the lanes that are left go to them in order
    const usedLanes = new Set(W.sensors.map((_, lane) => lane)),
      free = [];
    for (let l = 0; l < 8; l++) if (!usedLanes.has(l)) free.push(l);
    let k = 0;
    for (let s = 0; s < 8; s++) if (!taken.has(s)) next[s] = free[k++];
    const sensorOf = (m, lane) => m.indexOf(lane);
    const changes = W.sensors.map((sensor, lane) => ({ lane, sensor, was: sensorOf(map, lane) })).filter(c => c.sensor !== c.was);
    return { map: next, changes, done: W.step >= W.lanes };
  }
  const changeText = c => `Lane ${c.lane + 1} is sensor ${LETTERS[c.sensor]}. It was set to sensor ${LETTERS[c.was]}.`;
  // the steps of the window: done (with its sensor), now, next
  function orderStepsHtml(W) {
    return `<div class="hd-steps">${Array.from({ length: W.lanes }, (_, i) => {
      const done = i < W.step;
      return `<div class="hd-step${done ? ' done' : i === W.step ? ' now' : ''}" style="--c:${LANES[i]}"><div class="big">${done ? '✓' : i + 1}</div><b>Lane ${i + 1}</b><small>${done ? 'sensor ' + LETTERS[W.sensors[i]] : i === W.step ? 'drive over it now…' : 'next'}</small>${done ? `<button type="button" class="btn sm ghost" data-hd-redo="${i}">Redo</button>` : ''}</div>`;
    }).join('')}</div>`;
  }

  // ---- devices set aside as "not timing hardware" ----
  // keys like "2341:0043" (USB vendor:product); names: the USB names known for them
  function forgottenHtml(keys, nameOf = () => '') {
    const list = (Array.isArray(keys) ? keys : []).filter(Boolean);
    if (!list.length)
      return `<div class="gx-empty small"><div><h3>No forgotten devices</h3><p>When a USB device is plugged in, Timing asks if it is timing hardware. A device you answer "Not timing hardware" for is listed here, so you can change your mind.</p></div></div>`;
    return `<div class="hd-forgot">${list
      .map(
        k =>
          `<div class="hd-fr"><span><b>${esc(nameOf(k) || 'USB device')}</b><small>USB ${esc(k)} · set aside as not timing hardware</small></span><button type="button" class="btn sm" data-hd-unforget="${esc(k)}">Ask again</button></div>`
      )
      .join('')}</div>`;
  }

  const api = {
    LANES,
    LETTERS,
    DEVICES,
    ICON,
    deviceOf,
    standing,
    cardHtml,
    soonCard,
    heroHtml,
    laneCardsHtml,
    orderStart,
    orderHit,
    orderRedo,
    orderResult,
    changeText,
    orderStepsHtml,
    forgottenHtml
  };
  root.HwDesk = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
