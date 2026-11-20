// The same `api` the app window gets from preload.js, for a browser on another device (network access).
// A browser gets the Live Race pages only: it can read, never write, and the Race Director page asks for the password.
// In the app itself window.api already exists, so nothing here runs.
(function () {
  if (typeof window === 'undefined' || window.api) return;
  const getJson = async u => {
    const r = await fetch(u, { cache: 'no-store' });
    if (!r.ok) throw new Error(r.statusText);
    return r.json();
  };
  const postJson = async (u, data) => {
    const r = await fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const e = new Error(j.error || r.statusText);
      e.code = j.error;
      throw e;
    }
    return j;
  };
  const store = (k, v) => {
    try {
      if (v === undefined) return JSON.parse(sessionStorage.getItem(k) || 'null');
      if (v === null) sessionStorage.removeItem(k);
      else sessionStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* storage blocked */
    }
    return null;
  };
  const local = v => {
    try {
      if (v === undefined) return JSON.parse(localStorage.getItem('slt-viewer') || '{}');
      localStorage.setItem('slt-viewer', JSON.stringify(v));
    } catch {
      /* storage blocked */
    }
    return v || {};
  };
  // (2.3.0) a QR code of App Settings opens this page with a one-time code: it logs this device in to the Race Director, then the code is gone from the address
  const pairCode = (/^#pair=([0-9a-f]{16,64})$/i.exec(location.hash) || [])[1] || '';
  if (pairCode) history.replaceState(null, '', location.pathname + location.search + '#live');
  let pairError = '';
  let token = store('slt-token'),
    base = {};
  const lists = { static: new Set(), push: new Set() },
    no = () => Promise.reject(new Error('This device can only follow the race.'));
  let es = null;
  const stream = () => {
    if (es || typeof EventSource === 'undefined') return;
    es = new EventSource('/events');
    // (after the stream reconnects, for instance when the wifi dropped or Timing let go of a device that fell behind, the whole state is fetched again:
    // a new picture snapshot of the same race may have been missed)
    let opened = false;
    es.addEventListener('open', () => {
      if (opened)
        getJson('/api/live')
          .then(g => {
            if (g && g.stat) lists.static.forEach(f => f(g.stat));
          })
          .catch(() => {});
      opened = true;
    });
    es.addEventListener('static', e => {
      try {
        const s = JSON.parse(e.data);
        lists.static.forEach(f => f(s));
      } catch {
        /* bad message */
      }
    });
    es.addEventListener('push', e => {
      try {
        const d = JSON.parse(e.data);
        lists.push.forEach(f => f(d));
      } catch {
        /* bad message */
      }
    });
  };
  window.api = {
    web: true,
    schema: () => getJson('/api/schema'),
    getSettings: async () => {
      base = await getJson('/api/settings');
      return { ...base, ...local() };
    }, // what this device chose itself (leaderboard options...) stays on this device
    // (a null takes the setting out of this device's own, so the computer's shows again: the Driver stats page uses it to go back to the layout of the computer)
    setSettings: async patch => {
      const next = { ...local(), ...patch };
      Object.keys(next).forEach(k => {
        if (next[k] === null) delete next[k];
      });
      local(next);
      return { ...base, ...local() };
    },
    ownSettings: () => local(), // what this device chose itself (the Driver stats page tells a layout of its own from the computer's)
    list: e => getJson('/api/list/' + encodeURIComponent(e)),
    customFields: e => getJson('/api/custom/' + encodeURIComponent(e)),
    linkedLaps: async () => 0,
    dbPath: async () => '',
    perfStats: async () => null, // (a browser on another device has no link to the core of the app)
    liveGet: () => getJson('/api/live'),
    onLiveStatic: f => {
      lists.static.add(f);
      stream();
      return () => lists.static.delete(f);
    },
    onLive: f => {
      lists.push.add(f);
      stream();
      return () => lists.push.delete(f);
    },
    liveOpen: async () => ({ second: false }),
    liveFullscreen: async on => {
      try {
        const d = document,
          want = on === undefined ? !d.fullscreenElement : !!on;
        if (want) await d.documentElement.requestFullscreen();
        else if (d.fullscreenElement) await d.exitFullscreen();
        return !!d.fullscreenElement;
      } catch {
        return false;
      }
    },
    // the Race Director
    directorInfo: () => getJson('/api/director'),
    directorAuthed: () => !!token,
    // the page to open first ('director' after scanning a pairing QR code, else '') and the pairing itself (resolves when done; pairError says why it failed)
    startPage: () => (pairCode ? 'director' : ''),
    pairing: () => paired,
    pairError: () => pairError,
    directorLogin: async password => {
      const r = await postJson('/api/auth', { password });
      token = r.token;
      store('slt-token', token);
    },
    liveCommand: async cmd => {
      try {
        await postJson('/api/command', { token, cmd });
      } catch (e) {
        if (e.code === 'login') {
          token = null;
          store('slt-token', null);
        } else if (typeof Dialog !== 'undefined')
          Dialog.alert('This did not reach the timing computer: ' + (e.message || 'no answer') + '. Try again.'); // (2.4.0 review: a command that failed is said, not lost without a word)
      }
    },
    onCommand: () => () => {},
    add: no,
    update: no,
    remove: no,
    saveSession: no,
    removeSession: no,
    addCustomField: no,
    removeCustomField: no,
    setCustomFieldGroup: no,
    exportPdf: async () => ({ saved: false })
  };
  const paired = !pairCode
    ? Promise.resolve(false)
    : postJson('/api/pair', { code: pairCode }).then(
        r => {
          token = r.token;
          store('slt-token', token);
          return true;
        },
        e => {
          pairError =
            e.code === 'pair'
              ? 'This QR code was already used or is too old. Make a new one in App Settings on the timing computer, or log in with the password.'
              : 'Could not pair: ' + e.message;
          return false;
        }
      );
  if (!location.hash) location.hash = '#live'; // a browser opens straight onto the Live Race pages
})();
