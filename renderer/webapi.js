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
  let es = null,
    everOpened = false,
    retryT = null,
    retryMs = 2000;
  // (audit 2026-11) whether the live stream is up, for a "Reconnecting" sign: { connected, since }
  const link = { connected: false, since: Date.now() },
    linkLists = new Set();
  const setLink = on => {
    if (link.connected === on) return;
    link.connected = on;
    link.since = Date.now();
    linkLists.forEach(f => f({ ...link }));
  };
  const stream = () => {
    if (es || typeof EventSource === 'undefined') return;
    if (retryT) clearTimeout(retryT);
    es = new EventSource('/events');
    const mine = es;
    // (after the stream reconnects, for instance when the wifi dropped or Timing let go of a device that fell behind, the whole state is fetched again:
    // a new picture snapshot of the same race may have been missed. Audit 2026-11: the moving part goes along, so the next message fits and is not
    // fetched a second time)
    es.addEventListener('open', () => {
      retryMs = 2000;
      setLink(true);
      if (everOpened)
        getJson('/api/live')
          .then(g => {
            if (!g || !g.stat) return;
            lists.static.forEach(f => f(g.stat));
            if (g.dyn) lists.push.forEach(f => f(g.dyn));
          })
          .catch(() => {});
      everOpened = true;
    });
    // (audit 2026-11) an answer that is not a stream (503: too many connections, or Timing restarting its server) ends an EventSource for good:
    // make a new one after a while, longer each time (up to 30 s)
    es.addEventListener('error', () => {
      if (es !== mine) return;
      setLink(false);
      if (mine.readyState !== 2) return; // (CONNECTING: the browser tries again by itself)
      mine.close();
      es = null;
      retryT = setTimeout(stream, retryMs);
      retryMs = Math.min(30000, retryMs * 2);
    });
    es.addEventListener('static', e => {
      lastEventAt = Date.now();
      try {
        const s = JSON.parse(e.data);
        lists.static.forEach(f => f(s));
      } catch {
        /* bad message */
      }
    });
    es.addEventListener('push', e => {
      lastEventAt = Date.now();
      try {
        const d = JSON.parse(e.data);
        lists.push.forEach(f => f(d));
      } catch {
        /* bad message */
      }
    });
  };
  let lastEventAt = 0;
  const reconnectNow = force => {
    if (!force && link.connected && es && es.readyState === 1) return false;
    if (retryT) clearTimeout(retryT);
    retryT = null;
    retryMs = 2000;
    if (es) {
      try {
        es.close();
      } catch {
        /* gone */
      }
      es = null;
    }
    stream();
    return true;
  };
  if (typeof document !== 'undefined' && document.addEventListener)
    document.addEventListener('visibilitychange', () => {
      // (a phone that slept may hold a connection that only looks open: nothing came for a while, so a new one)
      if (document.visibilityState === 'visible' && (lists.push.size || lists.static.size)) reconnectNow(Date.now() - lastEventAt > 5000);
    });
  if (typeof window.addEventListener === 'function')
    window.addEventListener('online', () => {
      if (lists.push.size || lists.static.size) reconnectNow();
    });
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
    liveLink: () => ({ ...link }),
    // (2.5.2) reconnect now: a tap on the Reconnecting pill, or a phone that wakes up or gets its wifi back (no waiting for the next try)
    liveReconnect: () => reconnectNow(true),
    onLiveLink: f => {
      linkLists.add(f);
      return () => linkLists.delete(f);
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
        return true; // (2.5.2: it reached the timing computer; the race answers in its live messages)
      } catch (e) {
        if (e.code === 'login') {
          token = null;
          store('slt-token', null);
          // (audit 2026-11: said, not lost without a word)
          if (typeof Dialog !== 'undefined')
            Dialog.alert('This was not sent: your Race Director login ran out. Log in again, then press the button once more.');
        } else if (typeof Dialog !== 'undefined')
          Dialog.alert('This did not reach the timing computer: ' + (e.message || 'no answer') + '. Try again.'); // (2.4.0 review: a command that failed is said, not lost without a word)
        return false;
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
