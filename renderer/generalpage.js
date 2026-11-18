// App Settings › General (2.4.0): a second side list with the topics of General, stuck to the side list of App Settings, and beside it a canvas
// that shows one topic at a time. The page is first drawn as folders (renderGeneralSettings in app.js: the screen tests, the settings search and the
// wiring use those controls); in a real window this moves the very same controls into the topics. Nothing is copied: every control keeps its id,
// and its handlers are wired after this. A choice that was a drop-down list gets picture tiles that set the list (which stays, hidden).
const GeneralPage = (() => {
  let topic = 'look';
  const TOPICS = [
    ['look', 'Look and size', 'screen', 'How big the app is drawn, and how much it stands up from the page.'],
    ['units', 'Units', 'gauge', 'How speeds and distances are written in the tables, on Home and in the track editor.'],
    ['home', 'Home and club', 'home', 'The name of the app, the welcome on Home, the header picture and the club logo.'],
    ['pictures', 'Picture quality', 'square', 'How sharp the pictures you upload are kept, and how big that makes the database.'],
    ['performance', 'Performance', 'bolt', 'How the race screen is drawn and saved, and a report of how the computer is doing.'],
    ['storage', 'Database storage', 'database', 'Where everything is saved, and how much room it takes.'],
    ['updates', 'Updates and help', 'info', 'New versions, a file for bug reports, and the setup guide.']
  ];
  const ico = (n, size = 16) => (typeof Icons !== 'undefined' ? Icons.svg(n, { size, stroke: 1.8 }) : '');
  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  };
  // a card: a title in Barlow, one line that says what it is for, then the controls
  const card = (title, lead, cls = '') => {
    const c = el(
      'section',
      'gs-card' + (cls ? ' ' + cls : ''),
      `<h3>${esc(title)}</h3>${lead ? `<p class="gs-lead">${esc(lead)}</p>` : ''}`
    );
    return c;
  };
  // picture tiles for a drop-down list: a click sets the list and tells it so, as if it was chosen there
  const tiles = (select, draw, cls = '') => {
    const wrap = el('div', 'gs-tiles' + (cls ? ' ' + cls : ''));
    wrap.setAttribute('role', 'group');
    [...select.options].forEach(o => {
      const b = el('button', 'gs-tile', draw(o));
      b.type = 'button';
      b.setAttribute('aria-pressed', String(o.selected));
      b.onclick = () => {
        wrap.querySelectorAll('.gs-tile').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        if (select.value === o.value) return;
        select.value = o.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      };
      wrap.append(b);
    });
    select.classList.add('gs-hidden');
    return wrap;
  };
  const optText = select => (select && select.selectedOptions && select.selectedOptions[0] ? select.selectedOptions[0].textContent : '');
  const short = t =>
    String(t || '')
      .replace(/\s*\(.*\)\s*$/, '')
      .trim();

  function build(box) {
    if (!box || box.nodeType !== 1) return;
    const get = id => box.querySelector('#' + id),
      fieldOf = id => get(id) && get(id).closest('.field'),
      S = (typeof state !== 'undefined' && state.settings) || {};
    if (!get('uiscale')) return;
    if (!TOPICS.some(t => t[0] === topic)) topic = 'look';
    const shell = box.closest('.custshell');
    if (shell) shell.classList.add('gs-dual');

    // the status of every topic, for the side list
    const status = {
      look: `${get('uiscale').value}% · ${short(optText(get('depthlevel')))}`,
      units: `${Speed.unitName(get('speedunit').value)} · ${get('distunit').value === 'ft' ? 'feet' : 'metres'}`,
      home:
        [S.homeHeader ? 'picture' : '', S.clubLogo ? 'logo' : '', S.appName ? 'own name' : ''].filter(Boolean).join(' · ') ||
        'standard look',
      pictures: short(optText(get('picq'))),
      performance: get('perfswitch') && get('perfswitch').checked ? 'line on the race screen' : 'quiet',
      storage: /SQLite/.test(box.textContent) ? 'SQLite' : 'JSON',
      updates: get('updcheck') && get('updcheck').checked ? 'checks for updates' : 'update checks off'
    };
    const page = el('div', 'gs');
    const rail = el(
      'nav',
      'gs-rail',
      `<div class="gs-railtitle">General</div>${TOPICS.map(
        ([id, name, icon]) =>
          `<button type="button" class="gs-ri" data-gtopic-btn="${id}" aria-pressed="${id === topic}">${ico(icon)}<span><b>${esc(name)}</b><small>${esc(status[id] || '')}</small></span></button>`
      ).join('')}`
    );
    rail.setAttribute('aria-label', 'General topics');
    const canvas = el('div', 'gs-canvas');
    page.append(rail, canvas);
    const sections = {};
    TOPICS.forEach(([id, name, icon, lead]) => {
      const s = el(
        'section',
        'gs-topic',
        `<header class="gs-head"><span class="gs-headico">${ico(icon, 20)}</span><div><h2>${esc(name)}</h2><p>${esc(lead)}</p></div></header>`
      );
      s.dataset.gtopic = id;
      s.hidden = id !== topic;
      sections[id] = s;
      canvas.append(s);
    });
    const keepHint = (fid, into, titled = false) => {
      const f = fieldOf(fid);
      if (!f) return;
      f.classList.add('gs-field');
      if (titled) f.classList.add('gs-titled'); // (its label only says what the card title says: kept for the search, out of sight)
      if (f.querySelector('.gs-hidden')) f.classList.add('gs-tiled'); // (a list shown as tiles: its label stays for screen readers and the search, out of sight)
      into.append(f);
      return f; // (once moved it is in a card that is not on the page yet: look it up from here, not from the box)
    };

    // ---- Look and size: the sizes as letters that grow, the depth as small cards that stand up more ----
    {
      const size = card('Interface size', 'The text, buttons and boxes of this window. The race screen layouts always fit the window.');
      const sel = get('uiscale');
      size.append(
        tiles(
          sel,
          o =>
            `<span class="gs-aa" style="font-size:${Math.round((15 * Number(o.value)) / 100)}px">Aa</span><b>${esc(o.value)}%</b><small>${esc((o.textContent.match(/\((.*)\)/) || [0, ''])[1])}</small>`,
          'gs-sizes'
        )
      );
      keepHint('uiscale', size);
      const depth = card('Depth', 'How much cards, buttons and widgets stand up from the page, here and on the race screens.');
      const dsel = get('depthlevel');
      depth.append(
        tiles(
          dsel,
          o =>
            `<span class="gs-depth" style="--gd:${Number(o.value) / 100}"><i></i></span><b>${esc(short(o.textContent))}</b>${/standard/.test(o.textContent) ? '<small>standard</small>' : ''}`,
          'gs-depths'
        )
      );
      keepHint('depthlevel', depth);
      sections.look.append(size, depth);
    }
    // ---- Units: each unit as a tile with real examples, written the way the app writes them ----
    {
      const speed = card('Speed', 'The average and scale speed in the tables and the PDF of a session.');
      const ssel = get('speedunit');
      speed.append(
        tiles(
          ssel,
          o =>
            `<b>${esc(Speed.unitName(o.value))}</b><small>${esc(short(o.textContent))}</small><em>${o.value === 'mph' ? '7.7 mph' : '12.4 km/h'}</em>`,
          'gs-units'
        )
      );
      keepHint('speedunit', speed);
      const dist = card('Distance', 'The distance driven in the tables and on Home, and the lengths of a track.');
      const dsel = get('distunit');
      dist.append(
        tiles(
          dsel,
          o =>
            `<b>${o.value === 'ft' ? 'ft · mi' : 'm · km'}</b><small>${esc(short(o.textContent))}</small><em>A lane: ${esc(Speed.lengthText(28.45, o.value))}<br>A race: ${esc(Speed.distText(1250, o.value))}</em>`,
          'gs-units'
        )
      );
      keepHint('distunit', dist);
      sections.units.append(speed, dist);
    }
    // ---- Home and club: the name and welcome with a small preview, the header picture with its own preview, the club logo ----
    {
      const grid = el('div', 'gs-grid2');
      const names = card('Name and welcome', 'The name at the top of the window and the words at the top of Home.');
      const prev = el('div', 'gs-namepv');
      const drawName = () => {
        const an = names.querySelector('#appname'),
          wl = names.querySelector('#welcome'); // (the fields are in this card, which is put on the page at the end)
        prev.innerHTML = `<span class="gs-eye">Preview</span><b>${esc((an && an.value) || (an && an.placeholder) || '')}</b><span>${esc((wl && wl.value) || (wl && wl.placeholder) || '')}</span>`;
      };
      names.append(prev);
      keepHint('appname', names);
      keepHint('welcome', names);
      drawName();
      names.addEventListener('input', drawName);
      const header = card(
        'Header picture',
        'The picture across the top of Home. Drag it, or use the sliders, to choose what shows.',
        'gs-wide'
      );
      keepHint('hdrfile', header, true);
      const logo = card('Club logo', 'On Home if you choose a side, and in every Logo widget without a picture of its own.');
      keepHint('logofile', logo, true);
      grid.append(header, names, logo);
      sections.home.append(grid);
    }
    // ---- Picture quality: the three levels as cards ----
    {
      const q = card(
        'Quality of uploads',
        'Drivers, slotcars, widgets, picture sets, the logo and the header picture you add from now on.'
      );
      const qsel = get('picq');
      const notes = {
        original: 'Exactly as uploaded, with transparency. Largest database.',
        high: 'Sharp on any screen, a lot smaller.',
        standard: 'Smallest and quickest. Best for a Raspberry Pi.'
      };
      q.append(
        tiles(
          qsel,
          o =>
            `${ico(o.value === 'original' ? 'star' : o.value === 'high' ? 'square' : 'bolt', 18)}<b>${esc(short(o.textContent))}</b><small>${esc((o.textContent.match(/\((.*)\)/) || [0, ''])[1])}</small><em>${esc(notes[o.value] || '')}</em>`,
          'gs-quality'
        )
      );
      keepHint('picq', q);
      sections.pictures.append(q);
    }
    // ---- Performance: three switches, then the report ----
    {
      const sw = card('How the app works', 'Each one is on or off; the words under it say what it changes.');
      ['layerswitch', 'bgsave', 'perfswitch'].forEach(id => {
        const f = fieldOf(id);
        if (!f) return;
        f.classList.add('gs-switchrow');
        sw.append(f);
      });
      const rep = card('Report', 'Updated every second while you look at it. Copy it and send it if the computer gets slow.');
      keepHint('perfout', rep, true);
      sections.performance.append(sw, rep);
    }
    // ---- Database storage ----
    {
      const st = card('Where it is saved', '');
      const body = box.querySelector('[data-folder="general:data"] .fbody');
      if (body) st.append(...body.childNodes);
      sections.storage.append(st);
    }
    // ---- Updates and help: three cards side by side ----
    {
      const grid = el('div', 'gs-grid3');
      const up = card('Updates', 'Home tells you when a newer version is out. Nothing is downloaded by itself.');
      const uf = keepHint('updcheck', up);
      if (uf) uf.classList.add('gs-switchrow');
      const guide = card('Setup guide', 'A track, drivers, cars, the timing hardware, a sensor test and a 3-lap test race.');
      const gf = fieldOf('guiderun');
      if (gf) {
        gf.classList.add('gs-field', 'gs-titled');
        guide.append(gf);
      }
      const diag = card('Diagnostics', 'One text file for a bug report. Look it over before you send it.');
      const df = fieldOf('diagsave');
      if (df) {
        df.classList.add('gs-field', 'gs-titled');
        diag.append(df);
      }
      grid.append(up, diag, guide);
      sections.updates.append(grid);
    }

    // the folders are empty now: they and their Open all / Close all go
    box.querySelectorAll(':scope > details, :scope > .fgtools, :scope > .row').forEach(n => n.remove());
    box.prepend(page);
    rail.onclick = ev => {
      const b = ev.target.closest('[data-gtopic-btn]');
      if (b) show(b.dataset.gtopicBtn);
    };
  }
  // show a topic (also used by the settings search: a setting found in another topic opens that topic first)
  function show(id) {
    if (!TOPICS.some(t => t[0] === id)) return;
    topic = id;
    document.querySelectorAll('.gs-topic').forEach(s => (s.hidden = s.dataset.gtopic !== id));
    document.querySelectorAll('[data-gtopic-btn]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.gtopicBtn === id)));
    const c = document.querySelector('.gs-canvas');
    if (c && c.scrollIntoView && c.getBoundingClientRect && c.getBoundingClientRect().top < 0) c.scrollIntoView({ block: 'start' });
  }
  return { build, show, TOPICS };
})();

// (2.4.0) the Double Rail for the other pages of App Settings. Every page keeps drawing itself as it always did (its own tabs, the sheet with its
// sections); this puts a second side list beside it with the tabs of the page (interfaces, connections, views, topics) and its sections, and shows one
// section at a time on a plain canvas. The page's own tab buttons stay in the page, out of sight, and are clicked for you, so every handler still works.
// A page draws parts of itself again (another interface, another view): a watcher on the box redraws the side list when its tabs or sections change.
const SettingsRail = (() => {
  const PAGES = {
    theme: { lead: 'The colours of the app and of the Live Race pages.' },
    director: { lead: 'How the Race Director looks, and what its buttons add or take away.' },
    calculations: { lead: 'How pace is measured and what every racing system adds.', tabs: '.calc-rail button', tabsLabel: 'Topics' },
    network: { lead: 'Phones, tablets and other computers on your network.', tabs: '.connections-tabs > .tab', tabsLabel: 'Connections' },
    hardware: { lead: 'What counts the laps, and how it is set up.', tabs: '#hwtabs > .tab', tabsLabel: 'Interfaces' },
    transfer: { lead: 'Backups, sharing items, and content packs.', tabs: '.transfer-views > button', tabsLabel: 'Views' },
    plugins: { lead: 'Extra features you install yourself.' }
  };
  const active = new Map(); // page (and tab) -> the section that is shown
  let obs = null,
    raf = 0,
    sig = '';
  const ico = n => (typeof Icons !== 'undefined' ? Icons.svg(Icons.has && !Icons.has(n) ? 'settings' : n, { size: 16, stroke: 1.8 }) : '');
  const txt = e => String((e && e.textContent) || '').trim();
  function detach() {
    if (obs) obs.disconnect();
    obs = null;
    if (raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf);
    raf = 0;
    sig = '';
  }
  function attach(box, key) {
    detach();
    if (!box || box.nodeType !== 1 || !PAGES[key] || typeof MutationObserver === 'undefined') return;
    const run = () => {
      raf = 0;
      if (!box.isConnected) return detach();
      refresh(box, key);
    };
    obs = new MutationObserver(() => {
      if (!raf) raf = requestAnimationFrame(run);
    });
    obs.observe(box, { childList: true, subtree: true });
    raf = requestAnimationFrame(run);
  }
  // the tabs of the page: what they are called, what they say under it, and which one is open
  const tabsOf = (canvas, cfg) =>
    cfg.tabs
      ? [...canvas.querySelectorAll(cfg.tabs)].map(el => {
          const small = el.querySelector('small,.hwt-state'),
            strong = el.querySelector('strong');
          const label = strong ? txt(strong) : txt(el).replace(txt(small), '').trim();
          return {
            el,
            label,
            sub: small ? txt(small) : '',
            on:
              el.getAttribute('aria-selected') === 'true' ||
              el.getAttribute('aria-pressed') === 'true' ||
              el.getAttribute('aria-current') === 'true' ||
              el.classList.contains('on') ||
              el.classList.contains('active')
          };
        })
      : [];
  // the sections of the sheet on the page: the buttons of its own side list say what they are, and which part of the page they open
  const sectionsOf = canvas => {
    const sheet = sheetSections(canvas);
    if (sheet.length) return sheet;
    // (Dealership Mode has a small list of its own: buttons that jump to #paddock-<name>)
    return [...canvas.querySelectorAll('.paddock-shell > nav [data-jump]')].map(b => ({
      id: b.dataset.jump,
      title: txt(b),
      sub: '',
      ready: false,
      cap: '',
      el: canvas.querySelector('#paddock-' + CSS.escape(b.dataset.jump || '')),
      icon: ''
    }));
  };
  const sheetSections = canvas =>
    [...canvas.querySelectorAll('.tm-nav[data-interface-go],.tm-nav[data-tm-go]')].map(b => {
      const go = b.dataset.interfaceGo || b.dataset.tmGo || ''; // (the Timing Hardware pages name them data-tm-go)
      const cap =
        b.previousElementSibling && b.previousElementSibling.classList.contains('tm-railcap') ? txt(b.previousElementSibling) : '';
      return {
        id: go,
        title: txt(b.querySelector('b')),
        sub: txt(b.querySelector('small')),
        ready: !!b.querySelector('.tm-dot.on'),
        cap,
        el: (() => {
          // (the part of the page it opens: named by aria-controls, or found by its section name in the same sheet)
          const ctl = b.getAttribute('aria-controls'),
            frame = b.closest('.tm-frame') || canvas,
            id = CSS.escape(go);
          return (
            (ctl && canvas.querySelector('#' + CSS.escape(ctl))) ||
            frame.querySelector(`[data-interface-section="${id}"],[data-settings-section="${id}"],[data-tm-section="${id}"]`) ||
            null
          );
        })(),
        icon: (b.querySelector('i') || {}).innerHTML || ''
      };
    });
  function refresh(box, key) {
    const cfg = PAGES[key];
    if (obs) obs.disconnect();
    try {
      let gs = box.querySelector(':scope > .gs.sr');
      if (!gs) {
        gs = document.createElement('div');
        gs.className = 'gs sr';
        gs.innerHTML = '<nav class="gs-rail sr-rail" aria-label="Sections of this page"></nav><div class="gs-canvas sr-canvas"></div>';
        box.prepend(gs);
        sig = '';
      }
      const shell = box.closest('.custshell');
      if (shell) shell.classList.add('gs-dual');
      const rail = gs.querySelector('.sr-rail'),
        canvas = gs.querySelector('.sr-canvas');
      // what the page drew again outside the canvas goes into it
      [...box.childNodes].filter(n => n !== gs).forEach(n => canvas.append(n));
      const tabs = tabsOf(canvas, cfg),
        secs = sectionsOf(canvas).filter(s => s.el),
        tabKey = key + ':' + (tabs.find(t => t.on) || { label: '' }).label;
      if (cfg.tabs) canvas.querySelectorAll(cfg.tabs).forEach(t => t.parentElement && t.parentElement.classList.add('sr-tabsource'));
      let cur = active.get(tabKey);
      if (!secs.some(s => s.id === cur)) cur = secs[0] && secs[0].id;
      if (cur) active.set(tabKey, cur);
      // one section at a time, open, its title bar as the heading of the canvas
      secs.forEach(s => {
        s.el.classList.add('sr-sec');
        s.el.hidden = s.id !== cur;
        if (s.id === cur && !s.el.open) s.el.open = true;
      });
      canvas.classList.toggle('sr-hassecs', secs.length > 0);
      const title = (typeof SETTINGS_TABS !== 'undefined' && (SETTINGS_TABS.find(t => t[0] === key) || [])[1]) || '';
      const nextSig = JSON.stringify([
        key,
        title,
        tabs.map(t => [t.label, t.sub, t.on]),
        secs.map(s => [s.id, s.title, s.sub, s.ready, s.cap]),
        cur
      ]);
      if (nextSig !== sig) {
        sig = nextSig;
        let lastCap = null;
        rail.innerHTML =
          `<div class="gs-railtitle">${esc(title)}</div>${cfg.lead ? `<p class="sr-lead">${esc(cfg.lead)}</p>` : ''}` +
          (tabs.length
            ? `<span class="sr-cap">${esc(cfg.tabsLabel || 'Pages')}</span>${tabs
                .map(
                  (t, i) =>
                    `<button type="button" class="gs-ri sr-tab" data-sr-tab="${i}" aria-pressed="${t.on}"><span><b>${esc(t.label)}</b>${t.sub ? `<small>${esc(t.sub)}</small>` : ''}</span></button>`
                )
                .join('')}`
            : '') +
          (secs.length > 1 || (secs.length && !tabs.length)
            ? `${secs[0].cap ? '' : `<span class="sr-cap">${tabs.length ? 'On this page' : 'Sections'}</span>`}${secs
                .map(s => {
                  const cap = s.cap && s.cap !== lastCap ? `<span class="sr-cap">${esc(s.cap)}</span>` : '';
                  if (s.cap) lastCap = s.cap;
                  return `${cap}<button type="button" class="gs-ri sr-secbtn" data-sr-sec="${esc(s.id)}" aria-pressed="${s.id === cur}">${s.icon ? `<i class="sr-ico" aria-hidden="true">${s.icon}</i>` : ico('settings')}<span><b>${esc(s.title)}</b>${s.sub ? `<small>${esc(s.sub)}</small>` : ''}</span>${s.ready ? '<em class="sr-dot" aria-hidden="true"></em>' : ''}</button>`;
                })
                .join('')}`
            : '');
        rail.onclick = ev => {
          const t = ev.target.closest('[data-sr-tab]');
          if (t) {
            const tab = tabsOf(canvas, cfg)[Number(t.dataset.srTab)];
            if (tab) tab.el.click();
            return;
          }
          const s = ev.target.closest('[data-sr-sec]');
          if (s) {
            const k = key + ':' + (tabsOf(canvas, cfg).find(x => x.on) || { label: '' }).label;
            active.set(k, s.dataset.srSec);
            refresh(box, key);
            if (canvas.getBoundingClientRect && canvas.getBoundingClientRect().top < 0) canvas.scrollIntoView({ block: 'start' });
          }
        };
      }
    } finally {
      if (obs) obs.observe(box, { childList: true, subtree: true });
    }
  }
  // the settings search found something in a section that is not shown: show that section
  function reveal(el) {
    const sec = el && el.closest && el.closest('.sr-sec');
    const box = el && el.closest && el.closest('#settingsbox');
    if (!sec || !box || !sec.hidden) return;
    const id = sec.dataset.interfaceSection || sec.dataset.settingsSection || sec.dataset.tmSection;
    const btn = box.querySelector(`[data-sr-sec="${CSS.escape(id || '')}"]`);
    if (btn) btn.click();
  }
  return { attach, detach, reveal, PAGES };
})();
