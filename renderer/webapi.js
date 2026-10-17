// The same `api` the app window gets from preload.js, for a browser on another device (network access).
// A browser gets the Live Race pages only: it can read, never write, and the Race Director page asks for the password.
// In the app itself window.api already exists, so nothing here runs.
(function () {
  if (typeof window === 'undefined' || window.api) return;
  const getJson = async u => { const r = await fetch(u, { cache: 'no-store' }); if (!r.ok) throw new Error(r.statusText); return r.json(); };
  const postJson = async (u, data) => {
    const r = await fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const j = await r.json().catch(() => ({})); if (!r.ok) { const e = new Error(j.error || r.statusText); e.code = j.error; throw e; } return j;
  };
  const store = (k, v) => { try { if (v === undefined) return JSON.parse(sessionStorage.getItem(k) || 'null'); if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } return null; };
  const local = (v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem('slt-viewer') || '{}'); localStorage.setItem('slt-viewer', JSON.stringify(v)); } catch { /* storage blocked */ } return v || {}; };
  let token = store('slt-token'), base = {};
  const lists = { static: new Set(), push: new Set() }, no = () => Promise.reject(new Error('This device can only follow the race.'));
  let es = null;
  const stream = () => {
    if (es || typeof EventSource === 'undefined') return;
    es = new EventSource('/events');
    es.addEventListener('static', e => { try { const s = JSON.parse(e.data); lists.static.forEach(f => f(s)); } catch { /* bad message */ } });
    es.addEventListener('push', e => { try { const d = JSON.parse(e.data); lists.push.forEach(f => f(d)); } catch { /* bad message */ } });
  };
  window.api = {
    web: true,
    schema: () => getJson('/api/schema'),
    getSettings: async () => { base = await getJson('/api/settings'); return { ...base, ...local() }; }, // what this device chose itself (leaderboard options...) stays on this device
    // (a null takes the setting out of this device's own, so the computer's shows again: the Driver stats page uses it to go back to the layout of the computer)
    setSettings: async patch => { const next = { ...local(), ...patch }; Object.keys(next).forEach(k => { if (next[k] === null) delete next[k]; }); local(next); return { ...base, ...local() }; },
    ownSettings: () => local(), // what this device chose itself (the Driver stats page tells a layout of its own from the computer's)
    list: e => getJson('/api/list/' + encodeURIComponent(e)),
    customFields: e => getJson('/api/custom/' + encodeURIComponent(e)),
    linkedLaps: async () => 0, dbPath: async () => '',
    liveGet: () => getJson('/api/live'),
    onLiveStatic: f => { lists.static.add(f); stream(); return () => lists.static.delete(f); },
    onLive: f => { lists.push.add(f); stream(); return () => lists.push.delete(f); },
    liveOpen: async () => ({ second: false }),
    liveFullscreen: async on => {
      try { const d = document, want = on === undefined ? !d.fullscreenElement : !!on; if (want) await d.documentElement.requestFullscreen(); else if (d.fullscreenElement) await d.exitFullscreen(); return !!d.fullscreenElement; } catch { return false; }
    },
    // the Race Director
    directorInfo: () => getJson('/api/director'),
    directorAuthed: () => !!token,
    directorLogin: async password => { const r = await postJson('/api/auth', { password }); token = r.token; store('slt-token', token); },
    liveCommand: async cmd => { try { await postJson('/api/command', { token, cmd }); } catch (e) { if (e.code === 'login') { token = null; store('slt-token', null); } } },
    onCommand: () => () => {},
    add: no, update: no, remove: no, saveSession: no, removeSession: no, addCustomField: no, removeCustomField: no, setCustomFieldGroup: no, exportPdf: async () => ({ saved: false })
  };
  if (!location.hash) location.hash = '#live'; // a browser opens straight onto the Live Race pages
})();
