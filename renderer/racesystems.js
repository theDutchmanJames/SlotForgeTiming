(function (root) {
  const ITEMS = [
    { key: 'fuel', label: 'Fuel', setup: 'fuelRules' }, { key: 'penalty', label: 'Penalties', setup: 'penaltySystem' }, { key: 'damage', label: 'Damage and failures', setup: 'damageSystem' },
    { key: 'safetycar', label: 'Safety car', setup: 'safetyCar' }, { key: 'tyrewear', label: 'Tyre wear', setup: 'tyreWear' }, { key: 'weather', label: 'Weather', setup: 'weather' },
    { key: 'pushsave', label: 'Push & Save', setup: 'pushSave' }, { key: 'bop', label: 'Balance of Power', setup: 'bop' }
  ];
  const KEYS = ITEMS.map(x => x.key), esc = x => String(x == null ? '' : x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clean = value => [...new Set((Array.isArray(value) ? value : String(value || '').split(',')).filter(k => KEYS.includes(k)))];
  const toggle = (value, key, on) => clean(on ? clean(value).filter(k => k !== key) : [...clean(value), key]).join(',');
  const configured = (s, item) => item.key === 'bop' ? s.bop === 'on' : item.key === 'fuel' ? !!s.fuelRules || s.fuel === 'on' : !!s[item.setup];
  const raceConfig = s => { const list = clean(s.disabledSystems); return list.length && s.sessionType !== 'tokens' ? { systemsDisabled: list } : {}; };
  function lockControls(host, r) {
    if (!host || !host.querySelectorAll || !r.systemEnabled) return;
    for (const [key, folders] of [['penalty', ['penalties']], ['damage', ['damage', 'failures']], ['bop', ['bop']], ['weather', ['weather']]]) {
      folders.forEach(id => host.querySelectorAll(`[data-dirf="${id}"] .df-body`).forEach(el => { const off = !r.systemEnabled(key); el.inert = off; el.classList.toggle('system-is-off', off); el.title = off ? 'This system is off. Enable it in Racing systems above.' : ''; }));
    }
  }
  function setupHtml(s, o = {}) {
    const off = clean(s.disabledSystems), items = ITEMS.filter(x => !o.compact || configured(s, x));
    if (!items.length) return '';
    return `<div class="system-switches${o.compact ? ' compact' : ''}" role="group" aria-label="Racing systems">${items.map(x => {
      const available = configured(s, x), on = available && !off.includes(x.key);
      return `<button type="button" class="btn system-switch system-${x.key}${on ? ' on' : ''}" role="switch" aria-checked="${on}" data-system-key="${x.key}"${o.id ? ` data-system-setup="${esc(o.id)}"` : ''} data-system-on="${on ? '0' : '1'}"${available ? '' : ' disabled'} title="${available ? 'Change the saved setup; an active race is unchanged' : 'Choose a system above first'}"><span>${x.label}</span><b>${on ? 'On' : 'Off'}</b></button>`;
    }).join('')}</div>`;
  }
  function build(host, o) {
    if (!host) return null;
    host.innerHTML = '<p class="muted">Switch selected systems on or off for this race. Values are retained; schedules pause while off. Pit work already underway and penalties already issued remain in force. Saved setups are unchanged.</p><div class="system-switches"></div>';
    const grid = host.querySelector('.system-switches'), rows = new Map();
    const update = () => {
      const r = o.eng(); if (!r || !r.systemsOf) return;
      const data = r.systemsOf(), ready = ['ready', 'running', 'paused'].includes(r.status);
      ITEMS.forEach(item => {
        const state = data[item.key]; if (!state || !state.available) return;
        let b = rows.get(item.key); if (!b) { b = document.createElement('button'); b.type = 'button'; b.className = 'btn system-switch'; b.dataset.systemKey = item.key; b.setAttribute('role', 'switch'); b.onclick = () => o.send(item.key, !o.eng().systemEnabled(item.key)); grid.appendChild(b); rows.set(item.key, b); }
        b.textContent = `${item.label} · ${state.enabled ? 'On' : 'Off'}${state.enabled && !state.effective ? ' (needs Fuel)' : ''}`;
        b.setAttribute('aria-checked', String(state.enabled)); b.classList.toggle('on', state.enabled); b.disabled = !ready;
      });
      host.hidden = !Object.values(data).some(x => x.available);
    };
    update(); return { update };
  }
  const api = { ITEMS, KEYS, clean, toggle, configured, raceConfig, setupHtml, build, lockControls }; root.RaceSystems = api; if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
