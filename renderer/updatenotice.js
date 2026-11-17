// A newer release on GitHub (update-check.js in the main process): a notice on Home with Download (opens the release page) and
// Not now (hides it until an even newer release appears), and the Updates folder in App Settings > General. Notify only: the app
// never downloads or installs anything itself.
(function (root) {
  const escH = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const dateOf = iso => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  };
  // the Home notice: only when a newer release is known, it was not put away with Not now, and the checks are on
  function homeHtml(status, settings) {
    const s = status || {};
    if (!s.available || !s.latest || s.enabled === false || (settings && settings.updateDismissed === s.latest.version)) return '';
    const when = dateOf(s.latest.publishedAt);
    return `<section class="card hm-update" role="status" aria-live="polite"><div><strong>SlotForge Timing ${escH(s.latest.version)} is available</strong>
      <span class="muted">You have ${escH(s.current)}.${when ? ' Released ' + escH(when) + '.' : ''} Back up first (App Settings, Import and Export), then install the new version.</span></div>
      <div class="row"><button type="button" class="btn primary" data-update="open">Download</button><button type="button" class="btn" data-update="later">Not now</button></div></section>`;
  }
  // the line in App Settings: what is known, in words
  function statusText(s) {
    if (!s) return '';
    if (s.enabled === false) return 'Checking for updates is off.';
    const when = s.checkedAt ? ' Last checked ' + new Date(s.checkedAt).toLocaleString() + '.' : ' Not checked yet.';
    if (s.available && s.latest) return `Version ${s.latest.version} is available (you have ${s.current}).` + when;
    if (s.error && !s.latest) return `Could not check: ${s.error}` + when;
    return `You have the newest version (${s.current}).` + when;
  }
  async function mountHome(el) {
    if (!el || typeof api === 'undefined' || !api.updateStatus) return;
    let s;
    try {
      s = await api.updateStatus();
    } catch {
      return;
    }
    el.innerHTML = homeHtml(s, state.settings);
    el.hidden = !el.innerHTML;
    el.onclick = async ev => {
      const b = ev.target.closest('[data-update]');
      if (!b) return;
      if (b.dataset.update === 'open') api.updateOpen().catch(() => {});
      if (b.dataset.update === 'later') {
        state.settings = await api.setSettings({ updateDismissed: s.latest.version });
        el.innerHTML = '';
        el.hidden = true;
      }
    };
  }
  // when a check finishes while Home is on screen, the notice follows
  function listen() {
    if (typeof api === 'undefined' || !api.onUpdateStatus) return;
    api.onUpdateStatus(() => {
      const el = typeof document !== 'undefined' && document.getElementById('hm-update');
      if (el) mountHome(el);
    });
  }
  const api_ = { homeHtml, statusText, mountHome, listen };
  root.UpdateNotice = api_;
  if (typeof module !== 'undefined') module.exports = api_;
})(typeof window !== 'undefined' ? window : globalThis);
