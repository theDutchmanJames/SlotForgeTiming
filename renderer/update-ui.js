// "A new version is available" in the desktop app. Circuit checks once when it starts; when a
// newer version is published, a window shows it with the short What's new of the release, and
// Skip or Download. Download saves the file that matches this copy (installer or portable app,
// disk image, AppImage or .deb) in the Downloads folder; people install it themselves.
// Settings → Updates shows the versions, has Check now and turns the check at start off.
// The browser edition has no update check, so this does nothing there.
(function (root) {
  'use strict';
  const desktop = root.api; // (Timing: its preload exposes window.api, see docs/update-check-handoff.md)
  let state = null;
  let card = null;
  let say = () => {};
  let loading = null;
  let app = 'Circuit'; // the app's name in the words below
  let kept = 'your tracks stay where they are'; // what an update keeps
  const dismissed = new Set(); // versions closed this session (they come back at the next start)

  const el = (tag, props = {}, children = []) => {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children.filter(c => c != null));
    return node;
  };
  const when = ms => new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  const day = ms => new Date(ms).toLocaleDateString(undefined, { dateStyle: 'long' });
  const mb = bytes =>
    bytes < 1024 * 1024
      ? `${Math.max(1, Math.round(bytes / 1024))} KB`
      : `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;

  async function call(action, payload) {
    const answer = await desktop.updateCheck(action, payload);
    if (!answer || answer.error) throw Error(answer?.error || 'The update check is not available.');
    return answer.value;
  }

  async function load() {
    if (loading) return loading;
    loading = call('status')
      .then(s => (state = s))
      .catch(() => {}) // Optional: never get in the way of the app.
      .finally(() => {
        loading = null;
        show();
      });
    return loading;
  }

  function show() {
    maybeOpen();
    if (dialog()?.open) renderDialog();
    showCard();
  }

  // ---------------------------------------------------------------- the window

  const dialog = () => document.getElementById('update-dialog');

  function ensureDialog() {
    let d = dialog();
    if (d) return d;
    d = el('dialog', { id: 'update-dialog', className: 'update-dialog' });
    d.setAttribute('aria-labelledby', 'update-dialog-title');
    d.dataset.units = 'raw';
    d.addEventListener('close', () => state?.latest && dismissed.add(state.latest.version));
    document.body.append(d);
    return d;
  }

  // Opens by itself once per version and session, when nothing else is open (the welcome
  // screen on a first start, for example); it waits until that window is closed.
  let waiting = null;
  function maybeOpen() {
    const s = state;
    if (!s?.notify || !s.latest || dismissed.has(s.latest.version) || dialog()?.open) return;
    if (document.querySelector('dialog[open]')) {
      clearTimeout(waiting);
      waiting = setTimeout(maybeOpen, 1500);
      return;
    }
    openDialog();
  }

  function openDialog() {
    if (!state?.latest) return;
    const d = ensureDialog();
    renderDialog();
    if (!d.open) d.showModal();
  }

  const cap = text => text.charAt(0).toUpperCase() + text.slice(1);
  const DONE = () => ({
    setup: `Close ${app}, then open the installer. It replaces this version; ${kept}.`,
    portable: `Close ${app}, then start the new portable app. You can delete the old one afterwards; ${kept}.`,
    mac: `Close ${app}, open the disk image and drag ${app} to Applications. ${cap(kept)}.`,
    appimage: `Close ${app}, allow the new AppImage to run as a program, then start it. ${cap(kept)}.`,
    deb: `Close ${app}, then install the package with your software installer. ${cap(kept)}.`,
  });

  function renderDialog() {
    const d = ensureDialog();
    const s = state;
    if (!s?.latest) return d.open && d.close();
    const v = s.latest.version;
    const file = s.latest.file;
    const dl = s.download || { state: 'idle' };
    const mine = dl.name && file && dl.name === file.name;
    const phase = mine ? dl.state : 'idle';
    // While downloading only the bar and its words change, so the focus stays on Cancel.
    const key = `${v}:${phase}`;
    if (phase === 'downloading' && d.dataset.rendered === key) {
      const bar = d.querySelector('.update-progress progress');
      bar.max = dl.total || 1;
      bar.value = dl.received || 0;
      d.querySelector('.update-progress span').textContent =
        `Downloading… ${mb(dl.received || 0)} of ${mb(dl.total || 0)}`;
      return;
    }
    d.dataset.rendered = key;

    const button = (text, className, onclick, id) => {
      const b = el('button', { type: 'button', className, textContent: text, onclick });
      if (id) b.id = id;
      return b;
    };
    const close = el('button', { type: 'button', className: 'btn quiet', textContent: '✕', onclick: () => d.close() });
    close.setAttribute('aria-label', 'Close');

    const facts = el('div', { className: 'ss-sheet update-facts' }, [
      fact('Your copy', s.kindLabel ? `${s.current} · ${s.kindLabel}` : s.current),
      s.latest.publishedAt ? fact('Released', day(s.latest.publishedAt)) : null,
      file ? fact('Download', `${file.name} · ${mb(file.size)}`) : null,
    ]);

    const notes = s.latest.notes || [];
    const news = notes.length
      ? el('section', { className: 'update-news' }, [
          el('h4', { textContent: "What's new" }),
          el(
            'ul',
            {},
            notes.map(n =>
              el('li', {}, [n.title ? el('b', { textContent: n.title + (n.text ? ': ' : '') }) : null, n.text])
            )
          ),
        ])
      : el('p', { className: 'ss-note', textContent: 'The release page has the details of this version.' });

    let progress = null;
    let actions;
    if (phase === 'downloading') {
      const bar = el('progress', { max: dl.total || 1, value: dl.received || 0 });
      bar.setAttribute('aria-label', 'Download progress');
      progress = el('div', { className: 'update-progress' }, [
        bar,
        el('span', {
          textContent: `Downloading… ${mb(dl.received || 0)} of ${mb(dl.total || 0)}`,
        }),
      ]);
      actions = [button('Cancel', 'btn', cancel, 'update-cancel')];
    } else if (phase === 'done') {
      progress = el('div', { className: 'update-done', role: 'status' }, [
        el('b', { textContent: `Saved in Downloads: ${dl.name}` }),
        el('span', { textContent: DONE()[s.kind] || `Close ${app}, then install the new version.` }),
      ]);
      actions = [
        button('Close', 'btn', () => d.close()),
        button('Show in folder', 'btn primary', reveal, 'update-show'),
      ];
    } else {
      if (phase === 'failed')
        progress = el('p', { className: 'ss-note warn update-error', role: 'alert', textContent: dl.error || '' });
      actions = [
        button('Skip this version', 'btn ghost', skip, 'update-skip'),
        el('span', { className: 'spacer' }),
        file
          ? button(phase === 'failed' ? 'Try again' : 'Download', 'btn primary', download, 'update-download')
          : button('Open release page', 'btn primary', open, 'update-open'),
      ];
    }

    const parts = [
      el('div', { className: 'dialog-heading' }, [
        el('div', {}, [
          el('p', { className: 'help-crumb', textContent: 'Update available' }),
          el('h2', { id: 'update-dialog-title', textContent: `${app} ${v}` }),
        ]),
        close,
      ]),
      el('div', { className: 'help-plain' }, [
        el('p', { textContent: `A new version of ${app} is ready. You have version ${s.current}.` }),
      ]),
      news,
      facts,
      progress,
      el('div', { className: 'dialog-actions' }, actions),
    ];
    d.replaceChildren(...parts.filter(Boolean)); // no progress area before a download
  }

  function fact(name, value) {
    return el('div', { className: 'ss-row' }, [
      el('div', { className: 'ss-t' }, [el('b', { textContent: name })]),
      el('div', { className: 'ss-ctl' }, [el('span', { className: 'update-val', textContent: value })]),
    ]);
  }

  async function download() {
    try {
      state = await call('download');
      show();
    } catch (e) {
      say(e.message, true);
      load();
    }
  }

  async function cancel() {
    try {
      state = await call('cancel');
    } catch (e) {
      say(e.message, true);
    }
    load();
  }

  async function reveal() {
    try {
      await call('show');
    } catch (e) {
      say(e.message, true);
      load();
    }
  }

  async function open() {
    try {
      await call('open');
    } catch (e) {
      say(e.message, true);
    }
  }

  async function skip() {
    const version = state?.latest?.version;
    try {
      state = await call('skip', { version });
      dismissed.add(version);
      dialog()?.close();
      show();
      say(`${app} ${version} skipped. You will hear about the next version; Settings → Updates still has this one.`);
    } catch (e) {
      say(e.message, true);
      load();
    }
  }

  function check() {
    // Not awaited by the button: a slow network must not hold up the app.
    call('check').then(
      s => {
        state = s;
        if (s.latest) {
          dismissed.delete(s.latest.version);
          openDialog(); // asked for: shown even for a skipped version
        }
        show();
        say(s.latest ? `${app} ${s.latest.version} is available.` : 'You have the latest version.');
      },
      e => {
        say(e.message, true);
        load();
      }
    );
    load(); // shows "Checking…"
  }

  async function toggle() {
    try {
      state = await call('enable', { enabled: !state?.enabled });
      show();
    } catch (e) {
      say(e.message, true);
      show(); // put the switch back
    }
  }

  // ---------------------------------------------------------------- Settings → Updates

  // Settings Sheet rows: name and a short line on the left, one control on the right.
  function row(name, desc, ...controls) {
    const text = el('div', { className: 'ss-t' }, [el('b', { textContent: name })]);
    if (desc) text.append(el('span', { className: 'ss-desc', textContent: desc }));
    return el('div', { className: 'ss-row' }, [text, el('div', { className: 'ss-ctl' }, controls)]);
  }

  function showCard() {
    if (!card) return;
    const s = state;
    const body = card.querySelector('.update-body');
    body.replaceChildren();
    if (!s) return body.append(el('p', { className: 'ss-note', textContent: 'Loading…' }));
    let pill = el('span', { className: 'ss-pill', textContent: 'Not checked yet' });
    if (s.checking) pill = el('span', { className: 'ss-pill', textContent: 'Checking…' });
    else if (s.latest)
      pill = el('span', { className: 'ss-pill needs', textContent: `Version ${s.latest.version} is available` });
    else if (s.upToDate) pill = el('span', { className: 'ss-pill good', textContent: 'You have the latest version' });

    const sheet = el('div', { className: 'ss-sheet' }, [
      row('This version', s.kindLabel, el('span', { className: 'ss-val', textContent: s.current })),
      row('Newest version', null, pill),
      row('Last checked', null, el('span', { textContent: s.lastCheck ? when(s.lastCheck) : 'Never' })),
    ]);
    if (s.automatic) {
      const auto = el('input', { type: 'checkbox', className: 'ss-switch', id: 'update-toggle', checked: !!s.enabled });
      auto.setAttribute('aria-label', `Check for a new version when ${app} starts`);
      auto.onchange = toggle;
      sheet.append(
        row(
          `Check when ${app} starts`,
          s.enabled ? 'A window shows a new version with what is new in it.' : 'Off: only when you click Check now.',
          auto
        )
      );
    }
    const now = el('button', { type: 'button', className: 'btn', id: 'update-check-now', textContent: 'Check now' });
    now.disabled = !!s.checking;
    now.onclick = check;
    sheet.append(row('Check now', 'Asks GitHub for the newest version number.', now));
    if (s.latest) {
      const more = el('button', {
        type: 'button',
        className: 'btn primary',
        id: 'update-open-dialog',
        textContent: `${app} ${s.latest.version}…`,
      });
      more.onclick = openDialog;
      sheet.append(row(`Get version ${s.latest.version}`, 'What is new, and the download for this copy.', more));
    }
    body.append(sheet);
    if (s.lastError && !s.checking) body.append(el('p', { className: 'ss-note warn', textContent: s.lastError }));
    body.append(
      el('p', {
        className: 'ss-note',
        textContent:
          (s.automatic ? '' : 'This copy only checks when you click Check now. ') +
          `Only the newest release is asked for; nothing about you or your data is sent. ${app} downloads a new version only when you click Download, and never installs anything by itself.`,
      })
    );
  }

  // appName: the app's name in the window ("Circuit"); keeps: what an update leaves alone.
  function start({ settings, before, say: message, appName, keeps } = {}) {
    if (!desktop?.updateCheck) return;
    say = message || say;
    app = appName || app;
    kept = keeps || kept;
    if (settings) {
      card = el('section', { className: 'update-card ss-section' }, [
        el('h2', { id: 'update-title', textContent: 'Updates' }),
        el('div', { className: 'update-body' }),
      ]);
      card.setAttribute('aria-labelledby', 'update-title');
      card.dataset.units = 'raw';
      settings.insertBefore(card, before && before.parentNode === settings ? before : null);
    }
    desktop.onUpdateChange?.(load);
    load();
  }

  root.UpdateUI = { start };
})(typeof globalThis !== 'undefined' ? globalThis : this);
