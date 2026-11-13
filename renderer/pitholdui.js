// The same held-pit controls on the race computer and the authenticated phone/second-screen director.
(function (root) {
  const clock = ms => { const s = Math.ceil(Math.max(0, ms) / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  function build(host, o) {
    if (!host) return null;
    host.innerHTML = '<p class="muted">Remove the car for service. Lap and pit triggers for that lane are ignored during the stop. The Race Director can release at any time. Fuel already added is kept; unfinished tyre changes, repairs and penalties stay unfinished. Penalties add time after service.</p><div class="pit-hold-grid"></div>';
    const grid = host.querySelector('.pit-hold-grid'), rows = new Map();
    const make = lane => {
      const el = document.createElement('section'); el.className = 'card pit-hold-card';
      el.innerHTML = '<strong class="pit-hold-who"></strong><span class="pit-hold-clock"></span><span class="pit-hold-status"></span><small class="muted pit-hold-work"></small><div class="pit-hold-buttons"><button class="btn primary pit-hold-release">Release car</button></div>';
      el.querySelector('.pit-hold-release').onclick = () => o.send(lane, false);
      grid.appendChild(el); return el;
    };
    const update = () => {
      const r = o.eng(), t = o.now(); if (!r) return;
      const present = new Set(r.cars.map(c => c.lane)); rows.forEach((el, lane) => { if (!present.has(lane)) { el.remove(); rows.delete(lane); } });
      r.cars.forEach((c, i) => {
        let el = rows.get(c.lane); if (!el) { el = make(c.lane); rows.set(c.lane, el); }
        const h = r.pitHoldOf(i, t), running = o.phase() === 'running' && !c.done;
        el.querySelector('.pit-hold-who').textContent = `Lane ${c.lane + 1} · ${c.driverName || 'Driver'}`;
        el.querySelector('.pit-hold-clock').textContent = h ? clock(h.remaining) : '—';
        el.querySelector('.pit-hold-status').textContent = c.done ? 'Finished' : h ? h.text : c.blockAt !== null ? 'Confirming pit entry…' : c.pitRearm ? 'Clear sensor to rearm' : 'On track';
        el.querySelector('.pit-hold-work').textContent = h ? `${r.cfg.pitControl.seconds}s service${c.pitHold.extraMs ? ' + ' + c.pitHold.extraMs / 1000 + 's penalties' : ''}${o.phase() === 'paused' ? ' · Paused' : ''}` : '';
        el.querySelector('.pit-hold-release').disabled = !(running && h && h.canRelease);
        el.querySelector('.pit-hold-buttons').hidden = !h;
      });
    };
    update(); return { update };
  }
  const api = { build, clock }; root.PitHoldPanel = api; if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
