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
        // (the shared library is on this computer: its light only shows results that wait to be sent, in amber with their number, never as "not connected")
        const waiting = c.key === 'library' ? parseInt(c.text, 10) || 0 : 0;
        const st =
          c.key === 'library'
            ? 'wait'
            : c.state === 'on' || c.state === 'ok'
              ? 'on'
              : c.state === 'warn' || c.state === 'bad'
                ? 'warn'
                : 'off';
        const name = c.key === 'library' ? `${waiting} to send` : NAME[c.key] || 'Timing';
        return `<span class="mb-light ${st}" title="${esc(c.text)}"><i aria-hidden="true"></i><span>${esc(name)}</span></span>`;
      })
      .join('');
    // (2.4.0, SlotForgeRestyle.md "Status Lights") the three lights as one button (Timing · Next race · Sharing) with the checks before a race in its
    // drop-down; without RaceCheck (a test page) the lights of before
    if (typeof RaceCheck !== 'undefined') {
      const c = statusNow(list);
      const btn = RaceCheck.lightsHtml(c, statusOpen);
      if (el.innerHTML !== btn) el.innerHTML = btn;
      el.classList.add('mb-lights-one'); // (the button is the pill: the holder of the older lights draws no pill of its own behind it)
      el.onclick = ev => {
        ev.stopPropagation();
        toggleStatus();
      };
      if (statusOpen) drawStatus(c);
      return;
    }
    if (el.innerHTML !== html) el.innerHTML = html;
  }
  // what the lights know: Home's last look at the next race (state.raceCheckInput, written by landing.js), the hardware and the sharing now
  let statusOpen = false;
  function statusNow(list) {
    let full = [];
    try {
      full = HomeStats.chips({
        ...(state.raceCheckChips || {}),
        hardware: typeof Hardware !== 'undefined' ? Hardware.timingChosen(state.settings) : '',
        ds: typeof DsTiming !== 'undefined' && DsTiming.link.connected,
        trackmate: typeof Trackmate !== 'undefined' && !!Trackmate.link.connected,
        arduino: !!(typeof ArduinoBox !== 'undefined' && ArduinoBox.link && ArduinoBox.link.connected),
        plugin: typeof pt !== 'undefined' && pt.link.connected,
        pluginName: typeof pt !== 'undefined' && pt.identity && pt.identity.name,
        parallel: typeof ParallelPort !== 'undefined' && ParallelPort.link.connected,
        virtual: state.settings.abVirtual === true,
        netOn: !!state.settings.netOn,
        libraryWaiting: typeof homeLibraryWaiting !== 'undefined' ? homeLibraryWaiting : 0,
        backupFailed: typeof homeBackupFailed !== 'undefined' ? homeBackupFailed : false,
        unused:
          typeof unusedTimingConnected === 'function' && typeof TIMING_NAMES !== 'undefined'
            ? unusedTimingConnected(state.settings).map(id => TIMING_NAMES[id] || id)
            : []
      });
    } catch {
      full = list;
    }
    return RaceCheck.build({ ...(state.raceCheckInput || {}), raceOn: typeof raceActive === 'function' && raceActive(), chips: full });
  }
  function drawStatus(c) {
    let box = document.getElementById('mb-status');
    if (!box) {
      box = document.createElement('div');
      box.id = 'mb-status';
      box.className = 'mb-status';
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-label', 'Status: the next race, the timing and the sharing');
      document.body.appendChild(box);
      box.onclick = ev => {
        ev.stopPropagation();
        const b = ev.target.closest && ev.target.closest('[data-st-go]');
        if (b) statusGo(b.dataset.stGo);
      };
    }
    const html = RaceCheck.panelHtml(c);
    if (box.innerHTML !== html) box.innerHTML = html;
    const btn = document.getElementById('mb-st');
    if (btn && btn.getBoundingClientRect) {
      const r = btn.getBoundingClientRect();
      box.style.top = Math.round(r.bottom + 8) + 'px';
      box.style.right = Math.max(8, Math.round(window.innerWidth - r.right - 40)) + 'px';
    }
  }
  function toggleStatus(on) {
    statusOpen = on === undefined ? !statusOpen : !!on;
    if (!statusOpen) document.getElementById('mb-status')?.remove();
    lights();
  }
  // a button of the drop-down: the page where it is put right
  function statusGo(go) {
    toggleStatus(false);
    if (typeof state === 'undefined' || typeof render !== 'function') return;
    if (go === 'home') state.tab = 'home';
    else if (go === 'race') state.tab = 'race';
    else if (go === 'setup') {
      state.tab = 'setup';
      state.setupSub = 'racesetups';
    } else if (go === 'sensors') {
      state.tab = 'home';
      render();
      setTimeout(() => document.getElementById('sensortest')?.click(), 400);
      return;
    } else {
      state.tab = 'settings';
      state.settingsSub = { hardware: 'hardware', connections: 'paddock', qr: 'sharing', backup: 'transfer' }[go] || 'overview'; // (2.4.0, Settings Hub: the pages by task)
      if (go === 'backup' && typeof folderClosed !== 'undefined') folderClosed.delete('transfer:backups'); // (its folder is open)
      if (go === 'connections' && typeof connectionsTab !== 'undefined') connectionsTab = 'paddock';
      if (go === 'hardware' && typeof unusedTimingConnected === 'function') {
        const first = unusedTimingConnected(state.settings)[0];
        if (first) state.hwSub = first;
      }
    }
    render();
  }
  // (a click elsewhere, or Escape, closes the drop-down)
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('click', ev => {
      if (statusOpen && !(ev.target && ev.target.closest && ev.target.closest('#mb-status,#mb-st'))) toggleStatus(false);
    });
    document.addEventListener('keydown', ev => {
      if (statusOpen && ev.key === 'Escape') toggleStatus(false);
    });
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

  // ---- Find (Ctrl K) (2.4.0, SlotForgeRestyle.md "Find Everything"): every kind of thing of the app (findindex.js), the best match first with what is
  // linked to it, a filter chip per kind, a preview of the chosen one with its actions (Enter: the first, Tab: the next), Recent and Do when nothing is typed ----
  const Find = (() => {
    let box = null,
      index = [],
      res = { list: [], counts: {} },
      sel = 0,
      act = 0,
      kind = 'all',
      of = null,
      msg = '',
      moved = false, // (the choice was moved by hand: it stays on that one when the lists come in)
      lastBackup = '';
    const FI = () => (typeof FindIndex !== 'undefined' ? FindIndex : null);
    const RECENT_KEY = 'sf-find-recent';
    const readRecent = () => {
      try {
        const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
        return Array.isArray(v) ? v : [];
      } catch {
        return [];
      }
    };
    const keepRecent = it => {
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(FI().remember(readRecent(), it)));
      } catch {
        /* (no storage: no Recent) */
      }
    };
    const pages = () => {
      const out = [];
      const tabName = id => ((typeof TABS !== 'undefined' && TABS.find(t => t[0] === id)) || [id, id])[1];
      (typeof TABS !== 'undefined' ? TABS : []).forEach(([id, label]) =>
        out.push({ t: label, w: 'Page', icon: (typeof TAB_ICONS !== 'undefined' && TAB_ICONS[id]) || 'flag', go: { tab: id } })
      );
      if (typeof SUBS !== 'undefined')
        SUBS.forEach(([id, label]) => out.push({ t: label, w: tabName('database'), icon: 'database', go: { tab: 'database', sub: id } }));
      if (typeof SETUP_HERO !== 'undefined')
        out.push({ t: SETUP_HERO[1], w: tabName('setup'), icon: 'setup', go: { tab: 'setup', setupSub: SETUP_HERO[0] } });
      if (typeof SETUP_GROUPS !== 'undefined')
        SETUP_GROUPS.forEach(([, list]) =>
          list.forEach(([id, label]) => out.push({ t: label, w: tabName('setup'), icon: 'setup', go: { tab: 'setup', setupSub: id } }))
        );
      if (typeof CUSTOM_TABS !== 'undefined')
        CUSTOM_TABS.forEach(([id, label]) =>
          out.push({ t: label, w: tabName('custom'), icon: 'custom', go: { tab: 'custom', customSub: id } })
        );
      if (typeof SETTINGS_TABS !== 'undefined')
        SETTINGS_TABS.forEach(([id, label]) =>
          out.push({ t: label, w: tabName('settings'), icon: 'settings', go: { tab: 'settings', settingsSub: id } })
        );
      return out;
    };
    // the things to do: the first three as before, and more
    const actions = () => {
      const setup = ((state.refs && state.refs.racesetups) || []).find(x => x.id === (state.settings || {}).lastSetupId);
      return [
        { id: 'start', t: 'Start the race', w: 'Home', icon: 'lights', sub: setup ? setup.name : '' },
        { id: 'sensors', t: 'Test the sensors', w: 'Home', icon: 'check', sub: 'Lane Check' },
        { id: 'live', t: 'Open the Live Race on a second screen', w: 'Live Race', icon: 'screen' },
        { id: 'backup', t: 'Back up now', w: 'Backups', icon: 'shield', sub: lastBackup },
        { id: 'add:drivers', t: 'Add a driver', w: 'Database', icon: 'plus', words: ['new driver'] },
        { id: 'add:slotcars', t: 'Add a slotcar', w: 'Database', icon: 'plus', words: ['new car'] },
        { id: 'add:tracks', t: 'Add a track', w: 'Database', icon: 'plus', words: ['new track'] },
        { id: 'add:teams', t: 'Add a team', w: 'Database', icon: 'plus', words: ['new team'] },
        { id: 'add:racesetups', t: 'Add a race setup', w: 'Race Setup', icon: 'plus', words: ['new race setup'] },
        { id: 'help', t: 'Open Help', w: 'Help', icon: 'info', words: ['guides', 'manual'] },
        { id: 'guide', t: 'Run the setup guide again', w: 'Home', icon: 'arrow', words: ['first race', 'start here'] }
      ];
    };
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
    // (the Edit button of a card, once the page is drawn)
    const clickEdit = async id => {
      for (let i = 0; i < 25; i++) {
        const b = [...document.querySelectorAll('#view [data-edit]')].find(x => x.dataset.edit === id);
        if (b) return (b.click(), true);
        await new Promise(r => setTimeout(r, 80));
      }
      return false;
    };
    const SYSTEMS = {
      fuel: 'fuelrules',
      penalties: 'penaltysystems',
      damage: 'damagesystems',
      safetycar: 'safetycarsystems',
      tyrewear: 'tyrewearsystems',
      weather: 'weathersystems',
      pushsave: 'pushsavesystems',
      rotation: 'rotationsetups',
      bop: 'bopsystems',
      tokens: 'tokensystems',
      virtualrivals: 'virtualrivalsystems',
      multiclass: 'multiclasssystems',
      resources: 'resourcesystems'
    };
    const FORM = new Set([
      'drivers',
      'slotcars',
      'tracks',
      'teams',
      'racesetups',
      'fuelrules',
      'penaltysystems',
      'damagesystems',
      'safetycarsystems',
      'tyrewearsystems',
      'weathersystems',
      'pushsavesystems'
    ]);
    // (2.4.0) everything is read once per opening, into an index of its own: a Find closed and opened again while one was still reading does not mix them
    let gen = 0;
    const base = () => ({
      pages: pages(),
      actions: actions(),
      help: typeof Help !== 'undefined' && Help.folders ? Help.folders().map(h => ({ id: h.id, title: h.title, note: h.note })) : []
    });
    const ctxOf = D => ({
      titleOf: (e, x) => (typeof titleOf === 'function' && state.schema && state.schema[e] ? titleOf(e, x) : x.name),
      unit: typeof Speed !== 'undefined' && Speed.distUnitOf ? Speed.distUnitOf(state.settings) : 'm',
      lengths:
        typeof DbSheet !== 'undefined' && DbSheet.laneRows
          ? t => {
              try {
                return DbSheet.laneRows(t)
                  .rows.map(r => r.len)
                  .filter(Boolean);
              } catch {
                return [];
              }
            }
          : null,
      champ: c => {
        if (typeof Champ === 'undefined') return {};
        try {
          const cc = Champ.clean(c, true),
            p = Champ.progress(cc, D.sessions || []),
            nx = p.next ? cc.rounds[p.next.round] : null;
          let leader = '';
          if (typeof ChampPts !== 'undefined' && p.driven) {
            const st = ChampPts.standings(cc, D.sessions || [], { drivers: D.drivers || [], teams: D.teams || [] });
            leader = st.drivers && st.drivers[0] && st.drivers[0].total > 0 ? st.drivers[0].name : '';
          }
          return {
            driven: p.driven,
            leader,
            next: nx ? Champ.roundLabel(cc, p.next.round) + (nx.date ? ' · ' + Champ.dateText(nx.date, { short: true }) : '') : ''
          };
        } catch {
          return {};
        }
      }
    });
    const load = async () => {
      const my = ++gen;
      const F = FI();
      if (!F) return;
      index = F.build(base(), ctxOf({}));
      // (2.4.0 review, speed) drivers, cars, tracks, teams, layouts and sets are read as Home reads them: without their pictures (Find only needs names)
      const read = e =>
        typeof referenceList === 'function' && typeof REFERENCE_ENTITIES !== 'undefined' && REFERENCE_ENTITIES.has(e)
          ? Promise.resolve(referenceList(e)).catch(() => [])
          : api.list
            ? Promise.resolve(api.list(e)).catch(() => [])
            : Promise.resolve([]);
      const names = [
        'drivers',
        'slotcars',
        'tracks',
        'teams',
        'racesetups',
        'championships',
        'sessions',
        'layouts',
        'rowdesigns',
        'chartdesigns',
        'customwidgets',
        'audiosets',
        'imagesets'
      ];
      const subs = Object.keys(SYSTEMS);
      const [lists, systems, backups] = await Promise.all([
        Promise.all(names.map(read)),
        Promise.all(subs.map(s => read(SYSTEMS[s]))),
        api.backupList ? Promise.resolve(api.backupList()).catch(() => null) : null
      ]);
      if (my !== gen) return;
      const D = Object.fromEntries(names.map((n, i) => [n, lists[i] || []]));
      const label = sub =>
        ((typeof SETUP_GROUPS !== 'undefined' ? SETUP_GROUPS.flatMap(g => g[1]) : []).find(t => t[0] === sub) || [sub, sub])[1];
      D.systems = subs.map((sub, i) => ({ e: SYSTEMS[sub], sub, label: label(sub).replace(/s$/, ''), list: systems[i] || [] }));
      const last = backups && (backups.items || backups.list || backups)[0];
      const h = last && last.date ? (Date.now() - Date.parse(last.date)) / 36e5 : NaN;
      lastBackup = !(h >= 0)
        ? ''
        : 'last backup ' + (h < 1 ? 'less than an hour ago' : h < 24 ? Math.round(h) + ' hours ago' : FI().dayText(last.date));
      Object.assign(D, base());
      index = F.build(D, ctxOf(D));
      if (box && !box.hidden) update(true);
    };
    const settingsOf = q => {
      const F = FI();
      if (typeof SettingsIndex === 'undefined' || !String(q).trim() || /^\s*>/.test(q)) return [];
      return SettingsIndex.search(q)
        .slice(0, 8)
        .map(e => {
          const where = typeof SettingsIndex.where === 'function' ? SettingsIndex.where(e) : 'App Settings';
          const it = F.prep({
            kind: 'setting',
            id: e.t + '@' + where,
            t: e.t,
            sub: where,
            w: 'App Settings',
            kicker: 'Setting · ' + where,
            setting: e
          });
          it.score = Math.max(F.score(it, q), 20); // (the settings search found it by its own words)
          return it;
        });
    };
    // the typed words, marked in a title (at the start of a word)
    const marked = (t, q) => {
      const words = FI().norm(String(q).replace(/^\s*>/, '')).split(' ').filter(Boolean);
      const raw = String(t),
        low = [...raw].map(c => c.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')[0] || c).join(''),
        hit = new Array(low.length).fill(false);
      if (low.length === raw.length)
        words.forEach(w => {
          for (let at = low.indexOf(w); at >= 0; at = low.indexOf(w, at + 1))
            if (!at || !/[a-z0-9]/.test(low[at - 1])) for (let i = at; i < at + w.length; i++) hit[i] = true;
        });
      let out = '',
        on = false;
      for (let i = 0; i < raw.length; i++) {
        if (!!hit[i] !== on) {
          out += hit[i] ? '<mark>' : '</mark>';
          on = !!hit[i];
        }
        out += esc(raw[i]);
      }
      return out + (on ? '</mark>' : '');
    };
    const query = () => (box ? box.querySelector('input').value : '');
    const update = keep => {
      const F = FI();
      if (!F) return;
      const was = keep && moved && res.list[sel] ? res.list[sel].key : '';
      res = F.search(index, query(), { kind, of, recent: readRecent(), settings: settingsOf(query()) });
      const at = was ? res.list.findIndex(x => x.key === was) : -1;
      sel = at >= 0 ? at : 0;
      act = 0;
      draw();
    };
    const chipsHtml = () => {
      const F = FI(),
        typed = !!String(query()).trim();
      if (of)
        return `<button type="button" class="fd-chip" data-chip="all">All</button><button type="button" class="fd-chip on" data-of-clear aria-pressed="true">Races of ${esc(of.t)}<b>${res.list.length}</b><span aria-hidden="true">×</span></button>`;
      const DEFAULT = ['all', 'driver', 'car', 'track', 'team', 'race', 'setup', 'champ', 'custom', 'help'];
      return F.KINDS.filter(([k]) => k === 'all' || k === kind || (typed ? res.counts[k] : DEFAULT.includes(k)))
        .map(
          ([k, label]) =>
            `<button type="button" class="fd-chip${k === kind ? ' on' : ''}" data-chip="${k}" aria-pressed="${k === kind}">${esc(label)}${typed && res.counts[k] !== undefined ? `<b>${res.counts[k]}</b>` : ''}</button>`
        )
        .join('');
    };
    const rowsHtml = () => {
      let g = '';
      if (!res.list.length)
        return `<li class="mb-fnone">${String(query()).trim() ? 'Nothing found. Try fewer letters, or another word.' : kind !== 'all' ? 'None yet.' : 'Type a name: a driver, a car, a track, a race, a setting or a Help topic.'}</li>`;
      return res.list
        .map((x, i) => {
          const head = x.g !== g ? `<li class="mb-fgh" role="presentation">${esc((g = x.g))}</li>` : '';
          return `${head}<li role="option" id="mb-fo${i}" class="mb-fit${i === sel ? ' sel' : ''}" aria-selected="${i === sel}" data-i="${i}">${ico(x.icon, 16)}<span class="t"><span class="n">${marked(x.t, query())}</span>${x.sub ? `<span class="s">${esc(x.sub)}</span>` : ''}</span>${x.w ? `<small>${esc(x.w)}</small>` : ''}</li>`;
        })
        .join('');
    };
    const pictureOf = x => {
      if (x.kind === 'track' && x.rec && typeof DbSheet !== 'undefined' && DbSheet.trackSvg) return DbSheet.trackSvg(x.rec);
      if (x.kind === 'driver' && x.rec && typeof Garage !== 'undefined' && Garage.helmetOf)
        return `<img src="avatars/Lane${Garage.helmetOf(x.rec)}.png" alt="">`;
      return `<span class="fd-pvico">${ico(x.icon, 34)}</span>`;
    };
    const previewHtml = () => {
      const x = res.list[sel];
      if (!x) return '';
      const acts = FI().actionsOf(x);
      const big = ['track', 'driver', 'car', 'team', 'race', 'champ'].includes(x.kind);
      return `${big ? `<div class="fd-pic">${pictureOf(x)}</div>` : ''}<span class="fd-k">${esc(x.kicker || x.w || '')}</span><h3>${esc(x.t)}</h3>${!x.facts && x.sub ? `<p class="fd-sub">${esc(x.sub)}</p>` : ''}${
        x.facts
          ? `<div class="fd-tiles">${x.facts.map(([k, v, c]) => `<div class="fd-tile"><small>${esc(k)}</small><b${c ? ` class="${c}"` : ''}>${esc(v)}</b></div>`).join('')}</div>`
          : ''
      }${x.lines && x.lines.length ? `<ol class="fd-lines${x.kind === 'team' ? ' plain' : ''}">${x.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ol>` : ''}<div class="fd-acts" role="group" aria-label="Actions">${acts
        .map(
          (a, i) =>
            `<button type="button" class="fd-act${i === act ? ' on' : ''}" data-act="${i}">${ico(a.icon, 16)}<span>${esc(a.label)}</span><kbd>${i === act ? 'Enter' : 'Tab'}</kbd></button>`
        )
        .join('')}</div>`;
    };
    const draw = () => {
      if (!box) return;
      box.querySelector('.fd-chips').innerHTML = chipsHtml();
      const list = box.querySelector('.mb-flist');
      list.innerHTML = rowsHtml();
      box.querySelector('.fd-pv').innerHTML = previewHtml();
      box.querySelector('.fd-msg').textContent = msg;
      box.querySelector('input').setAttribute('aria-activedescendant', res.list.length ? 'mb-fo' + sel : '');
      const s = list.querySelector('.sel');
      if (s && s.scrollIntoView) s.scrollIntoView({ block: 'nearest' });
    };
    const drawSel = () => {
      act = 0;
      draw();
    };
    // ---- doing it ----
    const go = async (x, actIndex = act) => {
      if (!x) return;
      const a = FI().actionsOf(x)[actIndex] || { id: 'open' };
      if (a.id === 'races') {
        of = { id: x.id, kind: x.kind, t: x.t };
        kind = 'all';
        box.querySelector('input').value = '';
        keepRecent(x);
        return update();
      }
      if (x.kind === 'do' && x.id === 'backup') return backup();
      keepRecent(x);
      close();
      if (x.kind === 'do') return doIt(x.id);
      if (!(await leave())) return;
      const to = async patch => {
        Object.assign(state, patch);
        await render();
      };
      const fresh = async () => ((await Promise.resolve(api.list(x.e)).catch(() => [])) || []).find(r => r.id === x.id) || x.rec;
      if (x.kind === 'page') return to(x.go);
      if (x.kind === 'setting' && typeof settingsGo === 'function') {
        await to({ tab: 'settings' });
        return settingsGo(x.setting);
      }
      if (x.kind === 'help') {
        if (typeof Help !== 'undefined' && Help.view) Help.view().select(x.id);
        return to({ tab: 'settings', settingsSub: 'help' });
      }
      if (x.kind === 'race') {
        if (a.id === 'again') return raceWith({ lastSetupId: x.setupId, champId: null, champTag: null });
        return to({ focusSession: x.id, resultsSub: x.tokens ? 'tokens' : 'racing', tab: 'database', sub: 'results' });
      }
      if (a.id === 'book') return to({ tab: 'database', sub: 'results', resultsSub: 'racing' });
      if (x.kind === 'setup' && a.id === 'home') return raceWith({ lastSetupId: x.id, champId: null, champTag: null });
      if (x.kind === 'champ') {
        if (a.id === 'home') return raceWith({ champId: x.id, champTag: null });
        if (a.id === 'standings') {
          if (typeof champView !== 'undefined') champView.id = x.id;
          return to({ tab: 'database', sub: 'results', resultsSub: 'champs' });
        }
        await to({ tab: 'setup', setupSub: 'championships' });
        return clickEdit(x.id);
      }
      if (['driver', 'car', 'track', 'team'].includes(x.kind)) {
        await to({ tab: 'database', sub: x.e });
        const item = await fresh();
        if (item && typeof openForm === 'function') openForm(x.e, item);
        return;
      }
      if (x.kind === 'setup') {
        await to({ tab: 'setup', setupSub: 'setups' });
        const item = await fresh();
        if (item && typeof openForm === 'function') openForm('racesetups', item);
        return;
      }
      if (x.kind === 'system' || x.kind === 'custom') {
        await to(x.page);
        if (FORM.has(x.e) && typeof openForm === 'function') {
          const item = await fresh();
          if (item) return openForm(x.e, item);
        }
        return clickEdit(x.id);
      }
    };
    const raceWith = async patch => {
      if (api.setSettings) state.settings = await api.setSettings(patch);
      state.tab = 'home';
      return render();
    };
    const doIt = async id => {
      if (id === 'live') return api.liveOpen && api.liveOpen();
      if (id === 'sensors') return homeThen('#sensortest');
      if (id === 'start') return homeThen('#start');
      if (id === 'help') {
        if (!(await leave())) return;
        state.tab = 'settings';
        state.settingsSub = 'help';
        return render();
      }
      if (id === 'guide') {
        if (!(await leave())) return;
        return raceWith({ setupGuide: { step: 0 } });
      }
      if (id.startsWith('add:')) {
        const e = id.slice(4);
        if (!(await leave())) return;
        Object.assign(state, e === 'racesetups' ? { tab: 'setup', setupSub: 'setups' } : { tab: 'database', sub: e });
        await render();
        if (typeof openForm === 'function') openForm(e, null);
      }
    };
    // Back up now: made here, Find stays open and says how it went
    const backup = async () => {
      if (!api.backupMake) return;
      msg = 'Making a backup…';
      draw();
      try {
        const r = await api.backupMake({ kind: 'hand', note: 'Made from Find' });
        msg =
          r && r.skipped
            ? 'Not now: ' + r.skipped + '.'
            : r && r.ok === false
              ? 'Could not make the backup: ' + r.error
              : 'Backed up. It is in App Settings, Backups.';
        if (!(r && (r.skipped || r.ok === false))) lastBackup = 'last backup just now';
      } catch (e) {
        msg = 'Could not make the backup: ' + e.message;
      }
      if (box && !box.hidden) {
        index = index.map(x => (x.key === 'do:backup' ? FI().prep({ ...x, sub: lastBackup }) : x));
        update(true);
      }
    };
    function open() {
      if (!FI()) return;
      if (!box) {
        box = document.createElement('div');
        box.className = 'mb-find-box';
        box.innerHTML = `<div class="mb-fshade" data-close></div><div class="mb-fpanel fd" role="dialog" aria-modal="true" aria-label="Find"><label class="mb-fin">${ico('search', 18)}<input type="search" placeholder="Find a driver, a car, a track, a race, a setting or a Help topic" role="combobox" aria-expanded="true" aria-controls="mb-flist" autocomplete="off"><kbd>Esc</kbd></label><div class="fd-chips" role="group" aria-label="Show"></div><div class="fd-body"><ul class="mb-flist" id="mb-flist" role="listbox" aria-label="Found"></ul><aside class="fd-pv" aria-live="polite"></aside></div><div class="fd-foot"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>Enter</kbd> open</span><span><kbd>Tab</kbd> another action</span><span><kbd>&gt;</kbd> things to do</span><span class="fd-msg" role="status"></span><span class="fd-any">Ctrl K anywhere</span></div></div>`;
        document.body.append(box);
        const inp = box.querySelector('input');
        inp.oninput = () => {
          msg = '';
          moved = false;
          update();
        };
        inp.onkeydown = ev => {
          const n = res.list.length;
          if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
            ev.preventDefault();
            if (n) sel = (sel + (ev.key === 'ArrowDown' ? 1 : n - 1)) % n;
            moved = true;
            drawSel();
          } else if (ev.key === 'Enter') {
            ev.preventDefault();
            go(res.list[sel]);
          } else if (ev.key === 'Tab') {
            ev.preventDefault(); // (a modal window: the focus stays in the search; Tab chooses the action)
            const k = FI().actionsOf(res.list[sel]).length;
            if (k) act = (act + (ev.shiftKey ? k - 1 : 1)) % k;
            draw();
          } else if (ev.key === 'Escape') {
            ev.preventDefault();
            if (of) {
              of = null;
              update();
            } else close();
          } else if (ev.key === 'Backspace' && !inp.value && (of || kind !== 'all')) {
            of = null;
            kind = 'all';
            update();
          }
        };
        box.onclick = ev => {
          if (ev.target.closest('[data-close]')) return close();
          const chip = ev.target.closest('[data-chip]');
          if (chip) {
            of = null;
            kind = chip.dataset.chip;
            update();
            return box.querySelector('input').focus();
          }
          if (ev.target.closest('[data-of-clear]')) {
            of = null;
            update();
            return box.querySelector('input').focus();
          }
          const b = ev.target.closest('[data-act]');
          if (b) return go(res.list[sel], Number(b.dataset.act));
          const li = ev.target.closest('[data-i]');
          if (li) go(res.list[Number(li.dataset.i)], 0);
        };
        box.onmousemove = ev => {
          const li = ev.target.closest && ev.target.closest('[data-i]');
          if (li && Number(li.dataset.i) !== sel) {
            sel = Number(li.dataset.i);
            moved = true;
            drawSel();
          }
        };
      }
      if (box.hidden !== false) before = document.activeElement;
      box.hidden = false;
      kind = 'all';
      of = null;
      msg = '';
      moved = false;
      const inp = box.querySelector('input');
      inp.value = '';
      index = FI().build(base(), ctxOf({}));
      update();
      inp.focus();
      load();
    }
    let before = null;
    function close() {
      const was = box && !box.hidden;
      if (box) box.hidden = true;
      gen++; // (a reading still going is dropped; the next opening reads again: a new driver or race is found too)
      index = [];
      if (was) {
        if (before && before !== document.body && before.isConnected && typeof before.focus === 'function')
          before.focus(); // (the focus goes back where it was)
        else if (document.activeElement && box.contains(document.activeElement)) document.activeElement.blur(); // (nothing had it: no hidden search keeps it)
      }
      before = null;
    }
    const search = q => (FI() ? FI().search(index, q, { settings: settingsOf(q) }).list : []);
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
  return { decorate, lights, strip, fit, Find, leave, openStatus: () => toggleStatus(true) };
})();
