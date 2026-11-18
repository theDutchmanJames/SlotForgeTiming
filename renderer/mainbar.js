// (2.4.0) Pit Wall: the main menu as one slim bar. The tabs that app.js draws (renderTabs) are put into three groups, with on the right the status lights
// (the timing hardware, the shared library, the network), Find (Ctrl K) and Live Race as an ON AIR button. While a race runs and another page is shown,
// a race strip under the bar says the lap, the clock and the leader, with Back to the race. The tabs stay the buttons they were: a click does what it did.
const MainBar = (() => {
  const esc = s =>
    String(s === null || s === undefined ? '' : s).replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const ico = (n, size = 16) => (typeof Icons !== 'undefined' && Icons.has(n) ? Icons.svg(n, { size, stroke: 1.8 }) : '');
  // the groups, in the order of the tabs: Home (and a race that is kept) on its own, then the club, then the rest
  const GROUPS = [
    ['race', 'home'],
    ['database', 'setup'],
    ['custom', 'settings', 'rules']
  ];

  // ---- the bar ----
  function decorate(nav) {
    if (!nav || nav.dataset.mb === String(nav.childElementCount) + nav.textContent.length) return;
    const tabs = [...nav.querySelectorAll(':scope > button.tab, :scope > .mb-grp > button.tab')];
    if (!tabs.length) return;
    const byId = id => tabs.find(b => b.dataset.id === id);
    const grps = GROUPS.map(ids => {
      const g = document.createElement('span');
      g.className = 'mb-grp';
      ids
        .map(byId)
        .filter(Boolean)
        .forEach(b => g.append(b));
      return g;
    }).filter(g => g.childElementCount);
    const rest = tabs.filter(b => !GROUPS.flat().includes(b.dataset.id) && b.dataset.id !== 'live');
    if (rest.length) {
      const g = document.createElement('span');
      g.className = 'mb-grp';
      rest.forEach(b => g.append(b));
      grps.push(g);
    }
    const right = document.createElement('span');
    right.className = 'mb-right';
    right.innerHTML = `<span class="mb-lights" id="mb-lights" role="status"></span><button type="button" class="mb-find" id="mb-find" title="Find a page, a setting, a driver, a car or a track (Ctrl K)">${ico('search')}<span>Find</span><kbd>Ctrl K</kbd></button>`;
    const live = byId('live');
    if (live) right.append(live);
    nav.replaceChildren(...grps, right);
    // (every tab says its name when the bar is so narrow that only the pictures show)
    nav.querySelectorAll('button.tab').forEach(b => {
      if (!b.title) b.title = b.textContent.trim();
    });
    nav.querySelector('#mb-find').onclick = ev => {
      ev.stopPropagation();
      Find.open();
    };
    nav.dataset.mb = String(nav.childElementCount) + nav.textContent.length;
    lights();
    fit(true);
  }

  // ---- the status lights: the timing hardware, the shared library, the network ----
  function lights() {
    const el = document.getElementById('mb-lights');
    if (!el || typeof HomeStats === 'undefined' || typeof state === 'undefined') return;
    let list = [];
    try {
      const ab = typeof ArduinoBox !== 'undefined' && ArduinoBox.link ? ArduinoBox.link : null;
      list = HomeStats.chips({
        hardware: typeof Hardware !== 'undefined' ? Hardware.timingChosen(state.settings) : '',
        ds: typeof DsTiming !== 'undefined' && DsTiming.link.connected,
        trackmate: typeof Trackmate !== 'undefined' && !!Trackmate.link.connected,
        arduino: !!(ab && ab.connected),
        plugin: typeof pt !== 'undefined' && pt.link.connected,
        pluginName: typeof pt !== 'undefined' && pt.identity && pt.identity.name,
        parallel: typeof ParallelPort !== 'undefined' && ParallelPort.link.connected,
        virtual: state.settings.abVirtual === true,
        netOn: !!state.settings.netOn,
        libraryWaiting: typeof homeLibraryWaiting !== 'undefined' ? homeLibraryWaiting : 0
      }).filter(c => ['tm', 'library', 'net'].includes(c.key));
    } catch {
      list = [];
    }
    const NAME = { library: 'Library', net: 'Network' };
    const html = list
      .slice(0, 3)
      .map(c => {
        const st = c.state === 'on' || c.state === 'ok' ? 'on' : c.state === 'warn' || c.state === 'bad' ? 'warn' : 'off';
        const name = NAME[c.key] || 'Timing';
        return `<span class="mb-light ${st}" title="${esc(c.text)}"><i aria-hidden="true"></i><span>${esc(name)}</span></span>`;
      })
      .join('');
    if (el.innerHTML !== html) el.innerHTML = html;
  }

  // ---- fitting: when the bar does not fit (a narrow window, or the Race tab of a kept race), it steps down until it does ----
  // mb-t1 the names of the lights go, mb-t2 the word Find, mb-t3 the app name beside the logo, mb-t4 the tab names small under their pictures,
  // mb-t5 ON AIR and the lights tighter, mb-t6 everything tighter, mb-t7 (a big Interface size on a small window) only the pictures, the names as tooltips. (The widths in styles.css do the same for a window of a known size; this catches the rest.)
  let fitKey = '';
  function fit(force) {
    const header = document.querySelector('.app-shell > header'),
      nav = header && header.querySelector('#tabs');
    if (!header || !nav || header.hidden) return;
    const key = innerWidth + '|' + nav.textContent.length + '|' + nav.childElementCount;
    if (!force && key === fitKey) return;
    fitKey = key;
    const over = () => header.scrollWidth > header.clientWidth + 1 || nav.scrollWidth > nav.clientWidth + 1;
    for (let i = 1; i <= 7; i++) header.classList.remove('mb-t' + i);
    for (let i = 1; i <= 7 && over(); i++) header.classList.add('mb-t' + i);
  }
  if (typeof addEventListener === 'function') addEventListener('resize', () => fit(true));

  // (2.4.0) leaving the page the way a tab does: unsaved layout changes are asked about first, and the layout editor lets go of its keys
  async function leave() {
    if (typeof editorDirty === 'function' && editorDirty()) {
      const ok = await Dialog.confirm('Discard your unsaved layout changes?', {
        ok: 'Discard changes',
        cancel: 'Keep editing',
        danger: true
      });
      if (!ok) return false;
    }
    if (typeof editorLeave === 'function') editorLeave();
    return true;
  }

  // ---- the race strip ----
  function strip() {
    let el = document.getElementById('mb-strip');
    const header = document.querySelector('.app-shell > header');
    const kept = typeof raceKept === 'function' && raceKept() && typeof state !== 'undefined' && state.tab !== 'race';
    const s = kept && typeof live !== 'undefined' && live && live.strip;
    if (!s) {
      if (el) el.hidden = true;
      return;
    }
    if (!el && header) {
      el = document.createElement('div');
      el.id = 'mb-strip';
      el.className = 'mb-strip';
      el.setAttribute('aria-label', 'The race that is running'); // (2.4.0: no live region: its clock changes all the time)
      header.after(el);
      el.onclick = async ev => {
        if (ev.target.closest('[data-back]') && (await leave())) {
          state.tab = 'race';
          render();
        }
      };
    }
    if (!el) return;
    el.hidden = false;
    const clock = ms => {
      const t = Math.max(0, Math.floor(ms / 100)),
        m = Math.floor(t / 600),
        sec = ((t % 600) / 10).toFixed(1).padStart(4, '0');
      return `${m}:${sec}`;
    };
    const phase =
      { running: '', paused: 'Paused', countdown: 'Starting', between: 'Between heats', review: 'Check the laps' }[s.phase] || '';
    const lap =
      s.laps > 0 && s.leader ? `Lap <b class="mono">${Math.min(s.laps, s.leader.laps + 1)} / ${s.laps}</b>` : s.heat ? esc(s.heat) : '';
    const html =
      `<span class="mb-sname">${esc(s.name || 'Race')}</span>${phase ? `<span class="mb-sphase">${esc(phase)}</span>` : ''}` +
      (lap ? `<span>${lap}</span>` : '') +
      `<span class="mono">${clock(s.elapsed || 0)}</span>` +
      (s.leader
        ? `<span class="mb-slead">Leader <i style="--c:${esc(s.leader.color || '#98a0ab')}">${esc(s.leader.lane)}</i>${esc(s.leader.name)}</span>`
        : '') +
      '<button type="button" class="btn primary mb-sback" data-back>Back to the race</button>';
    if (el.innerHTML !== html) el.innerHTML = html;
  }

  // ---- Find (Ctrl K): pages, settings, drivers, cars, tracks and race setups, and a few things to do ----
  const Find = (() => {
    let box = null,
      items = [],
      sel = 0,
      records = null;
    const norm = s =>
      String(s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '');
    const pages = () => {
      const out = [];
      const tabName = id => ((typeof TABS !== 'undefined' && TABS.find(t => t[0] === id)) || [id, id])[1];
      (typeof TABS !== 'undefined' ? TABS : []).forEach(([id, label]) =>
        out.push({ g: 'Pages', t: label, w: '', icon: (typeof TAB_ICONS !== 'undefined' && TAB_ICONS[id]) || 'flag', go: { tab: id } })
      );
      if (typeof SUBS !== 'undefined')
        SUBS.forEach(([id, label]) =>
          out.push({ g: 'Pages', t: label, w: tabName('database'), icon: 'database', go: { tab: 'database', sub: id } })
        );
      if (typeof SETUP_HERO !== 'undefined')
        out.push({ g: 'Pages', t: SETUP_HERO[1], w: tabName('setup'), icon: 'setup', go: { tab: 'setup', setupSub: SETUP_HERO[0] } });
      if (typeof SETUP_GROUPS !== 'undefined')
        SETUP_GROUPS.forEach(([, list]) =>
          list.forEach(([id, label]) =>
            out.push({ g: 'Pages', t: label, w: tabName('setup'), icon: 'setup', go: { tab: 'setup', setupSub: id } })
          )
        );
      if (typeof CUSTOM_TABS !== 'undefined')
        CUSTOM_TABS.forEach(([id, label]) =>
          out.push({ g: 'Pages', t: label, w: tabName('custom'), icon: 'custom', go: { tab: 'custom', customSub: id } })
        );
      return out;
    };
    const ACTIONS = [
      { g: 'Do', t: 'Open the Live Race on a second screen', w: '', icon: 'screen', act: () => api.liveOpen && api.liveOpen() },
      { g: 'Do', t: 'Test the sensors', w: 'Home', icon: 'timing', act: () => homeThen('#sensortest') },
      { g: 'Do', t: 'Start the race', w: 'Home', icon: 'flag', act: () => homeThen('#start') }
    ];
    const homeThen = async sel2 => {
      if (!(await leave())) return;
      state.tab = 'home';
      await render();
      for (let i = 0; i < 20; i++) {
        const b = document.querySelector(sel2);
        if (b && !b.disabled) return b.click();
        await new Promise(r => setTimeout(r, 100));
      }
    };
    // (2.4.0) read once per opening, into a list of its own: a Find closed and opened again while one was still reading does not get them twice
    let loading = null,
      gen = 0;
    const loadRecords = () => {
      if (records) return Promise.resolve(records);
      if (loading) return loading;
      const my = ++gen,
        out = [];
      loading = readRecords(out).then(() => {
        if (my === gen) {
          records = out;
          loading = null;
        }
        return out;
      });
      return loading;
    };
    const readRecords = async records => {
      const kinds = [
        ['drivers', 'Drivers', 'driver'],
        ['slotcars', 'Slotcars', 'car'],
        ['tracks', 'Tracks', 'pin'],
        ['racesetups', 'Race Setups', 'setup']
      ];
      await Promise.all(
        kinds.map(async ([e, w, icon]) => {
          try {
            const list = (await api.list(e)) || [];
            list.forEach(x => {
              const t = typeof titleOf === 'function' && state.schema && state.schema[e] ? titleOf(e, x) : x.name;
              if (t && t !== '(unnamed)') records.push({ g: w, t, w, icon, rec: { e, id: x.id } });
            });
          } catch {
            /* a list that cannot be read is left out */
          }
        })
      );
    };
    const search = q => {
      const n = norm(q).trim();
      const words = n.split(/\s+/).filter(Boolean);
      const hit = x => words.every(w => norm(x.t + ' ' + x.w).includes(w));
      const rank = x => (norm(x.t).startsWith(n) ? 0 : norm(x.t).includes(n) ? 1 : 2);
      if (!words.length) return [...ACTIONS, ...pages().slice(0, 6)];
      const settings =
        typeof SettingsIndex !== 'undefined'
          ? SettingsIndex.search(q)
              .slice(0, 6)
              .map(e => ({
                g: 'Settings',
                t: e.t,
                w: typeof SettingsIndex.where === 'function' ? SettingsIndex.where(e) : 'App Settings',
                icon: 'settings',
                setting: e
              }))
          : [];
      const groups = [
        ACTIONS.filter(hit),
        pages()
          .filter(hit)
          .sort((a, b) => rank(a) - rank(b))
          .slice(0, 6),
        settings,
        (records || [])
          .filter(hit)
          .sort((a, b) => rank(a) - rank(b))
          .slice(0, 8)
      ];
      return groups.flat();
    };
    const go = async x => {
      close();
      if (!x) return;
      if (x.act) return x.act();
      if (!(await leave())) return;
      if (x.go) {
        Object.assign(state, x.go);
        return render();
      }
      if (x.setting && typeof settingsGo === 'function') {
        state.tab = 'settings';
        await render();
        return settingsGo(x.setting);
      }
      if (x.rec) {
        const items2 = await api.list(x.rec.e).catch(() => []);
        const item = (items2 || []).find(r => r.id === x.rec.id);
        if (x.rec.e === 'racesetups') {
          state.tab = 'setup';
          state.setupSub = 'setups';
          await render();
        } else {
          state.tab = 'database';
          state.sub = x.rec.e;
          await render();
        }
        if (item && typeof openForm === 'function') openForm(x.rec.e, item);
      }
    };
    const draw = () => {
      const list = box.querySelector('.mb-flist');
      let g = '';
      list.innerHTML = items.length
        ? items
            .map((x, i) => {
              const head = x.g !== g ? `<li class="mb-fgh" role="presentation">${esc((g = x.g))}</li>` : '';
              return `${head}<li role="option" id="mb-fo${i}" class="mb-fit${i === sel ? ' sel' : ''}" aria-selected="${i === sel}" data-i="${i}">${ico(x.icon, 16)}<span class="t">${esc(x.t)}</span>${x.w ? `<small>${esc(x.w)}</small>` : ''}</li>`;
            })
            .join('')
        : '<li class="mb-fnone">Nothing found. Try another word.</li>';
      box.querySelector('input').setAttribute('aria-activedescendant', items.length ? 'mb-fo' + sel : '');
      const s = list.querySelector('.sel');
      if (s && s.scrollIntoView) s.scrollIntoView({ block: 'nearest' });
    };
    const update = () => {
      items = search(box.querySelector('input').value);
      sel = 0;
      draw();
    };
    function open() {
      if (!box) {
        box = document.createElement('div');
        box.className = 'mb-find-box';
        box.innerHTML = `<div class="mb-fshade" data-close></div><div class="mb-fpanel" role="dialog" aria-modal="true" aria-label="Find"><label class="mb-fin">${ico('search', 18)}<input type="search" placeholder="Find a page, a setting, a driver, a car or a track" role="combobox" aria-expanded="true" aria-controls="mb-flist" autocomplete="off"><kbd>Esc</kbd></label><ul class="mb-flist" id="mb-flist" role="listbox"></ul></div>`;
        document.body.append(box);
        const inp = box.querySelector('input');
        inp.oninput = update;
        inp.onkeydown = ev => {
          if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
            ev.preventDefault();
            if (items.length) sel = (sel + (ev.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
            draw();
          } else if (ev.key === 'Enter') {
            ev.preventDefault();
            go(items[sel]);
          } else if (ev.key === 'Escape') {
            ev.preventDefault();
            close();
          } else if (ev.key === 'Tab') ev.preventDefault(); // (a modal window: the focus stays in the search)
        };
        box.onclick = ev => {
          if (ev.target.closest('[data-close]')) return close();
          const li = ev.target.closest('[data-i]');
          if (li) go(items[Number(li.dataset.i)]);
        };
      }
      if (box.hidden !== false) before = document.activeElement;
      box.hidden = false;
      const inp = box.querySelector('input');
      inp.value = '';
      update();
      inp.focus();
      loadRecords().then(() => {
        if (!box.hidden && inp.value) update();
      });
    }
    let before = null;
    function close() {
      const was = box && !box.hidden;
      if (box) box.hidden = true;
      records = null; // (read again next time: a new driver or car is found too)
      gen++;
      loading = null;
      if (was) {
        if (before && before !== document.body && before.isConnected && typeof before.focus === 'function')
          before.focus(); // (the focus goes back where it was)
        else if (document.activeElement && box.contains(document.activeElement)) document.activeElement.blur(); // (nothing had it: no hidden search keeps it)
      }
      before = null;
    }
    return { open, close, search };
  })();

  // (the second screen and the phones load the same page with only the Live Race pages: no menu, no Find there)
  const liveOnly = () => typeof document !== 'undefined' && !!document.body && document.body.classList.contains('lv-window');
  document.addEventListener('keydown', ev => {
    if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && ev.key.toLowerCase() === 'k') {
      if (liveOnly() || document.querySelector('dialog[open]') || (typeof state !== 'undefined' && state.tab === 'race')) return;
      ev.preventDefault();
      Find.open();
    }
  });
  // the lights follow the hardware and the network; the strip follows the race
  setInterval(() => {
    if (liveOnly()) return;
    lights();
    strip();
    fit();
  }, 500);
  return { decorate, lights, strip, fit, Find };
})();
