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
  const optText = select => (select && select.selectedOptions && select.selectedOptions[0] ? select.selectedOptions[0].textContent : '');
  const short = t =>
    String(t || '')
      .replace(/\s*\(.*\)\s*$/, '')
      .trim();

  // only (2.4.0, Settings Hub): the topics this page shows (Display and units: look, units, pictures; Home and club; Performance; Updates and help);
  // the other topics are built too, out of sight, so every control keeps its handlers and the settings search can find it
  let shownTopics = TOPICS.map(t => t[0]);
  const PAGE_NAMES = { look: 'Display and units', home: 'Home and club', performance: 'Performance', updates: 'Updates and help' };
  function build(box, only) {
    if (!box || box.nodeType !== 1) return;
    const get = id => box.querySelector('#' + id),
      fieldOf = id => get(id) && get(id).closest('.field'),
      S = (typeof state !== 'undefined' && state.settings) || {};
    if (!get('uiscale')) return;
    shownTopics = Array.isArray(only) && only.length ? only.filter(id => TOPICS.some(t => t[0] === id)) : TOPICS.map(t => t[0]);
    if (!shownTopics.includes(topic)) topic = shownTopics[0] || 'look';
    const shell = box.closest('.custshell');
    if (shell) shell.classList.add('gs-dual');

    // the status of every topic, for the side list
    const status = {
      look: `${get('uiscale').value}% · ${short(optText(get('depthlevel')))}`,
      units: `${Speed.unitName(get('speedunit').value)} · ${get('distunit').value === 'ft' ? 'feet' : 'metres'} · ${get('pdfmode') && get('pdfmode').value === 'mono' ? 'monochrome' : 'colour'} prints`,
      home:
        [S.homeHeader ? 'picture' : '', S.clubLogo ? 'logo' : '', S.appName ? 'own name' : ''].filter(Boolean).join(' · ') ||
        'standard look',
      pictures: short(optText(get('picq'))),
      performance: get('perfswitch') && get('perfswitch').checked ? 'line on the race screen' : 'quiet',
      storage: [...box.querySelectorAll('.row strong')].some(x => /^SQLite database/.test(String(x.textContent || '').trim()))
        ? 'SQLite'
        : 'JSON', // (2.4.0: the name of the database, not any mention of SQLite)
      updates: 'new versions and help'
    };
    const page = el('div', 'gs');
    const rail = el(
      'nav',
      'gs-rail',
      `<div class="gs-railtitle">${esc(PAGE_NAMES[shownTopics[0]] || 'General')}</div>${TOPICS.filter(t => shownTopics.includes(t[0]))
        .map(
          ([id, name, icon]) =>
            `<button type="button" class="gs-ri" data-gtopic-btn="${id}" aria-pressed="${id === topic}">${ico(icon)}<span><b>${esc(name)}</b><small>${esc(status[id] || '')}</small></span></button>`
        )
        .join('')}`
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
    // ---- (2.4.0) the topics as a Settings Sheet: groups of slim rows, the controls of the folders moved into them ----
    const K = SettingsSheet;
    const hintOf = id => {
      const f = fieldOf(id);
      return f ? [...f.querySelectorAll(':scope > .hint, :scope > span.muted.hint')].slice(0, 1) : [];
    };
    const ctl = (id, unit) => (get(id) ? K.kit(get(id), unit) : null);
    // a segmented choice with our own short words on its buttons
    const seg = (id, words) => {
      const s = get(id);
      if (!s) return null;
      const g = K.segmented(s) || segAny(s);
      if (g && words) g.querySelectorAll('button').forEach(b => (b.textContent = words[b.dataset.v] || b.textContent));
      return [g, s]; // (the list goes with it, out of sight: the page finds it by its id)
    };
    // (a list with more than five options: the same segmented choice, built here)
    const segAny = s => {
      const g = el('span', 'ss-seg');
      const draw = () =>
        g.querySelectorAll('button').forEach(b => {
          b.classList.toggle('on', b.dataset.v === s.value);
          b.setAttribute('aria-pressed', String(b.dataset.v === s.value));
        });
      [...s.options].forEach(o => {
        const b = el('button', '');
        b.type = 'button';
        b.dataset.v = o.value;
        b.textContent = o.textContent;
        b.onclick = () => {
          if (s.value === o.value) return;
          s.value = o.value;
          draw();
          s.dispatchEvent(new Event('change', { bubbles: true }));
        };
        g.append(b);
      });
      s.classList.add('ss-hidden');
      draw();
      return g;
    };
    const R = (title, desc, controls, o = {}) => K.row({ title, desc, hint: o.hint || [], ctl: [].concat(controls), cls: o.cls || '' });
    const group = (into, title, note, rows) => {
      if (title) into.append(el('h4', 'ss-gh', `${esc(title)}${note ? `<span>${esc(note)}</span>` : ''}`));
      const sh = el('div', 'ss-sheet');
      rows.filter(Boolean).forEach(r => sh.append(r));
      into.append(sh);
      return sh;
    };
    const hidden = ids =>
      ids
        .map(get)
        .filter(Boolean)
        .map(x => (x.classList.add('ss-hidden'), x));
    // Look and size
    group(sections.look, 'Size', '', [
      R(
        'Interface size',
        'The text, buttons and boxes of this window. Race screens always fit the window.',
        seg('uiscale', { 100: '100%', 110: '110%', 125: '125%', 150: '150%', 175: '175%', 200: '200%' }),
        { hint: hintOf('uiscale') }
      ),
      R(
        'Depth',
        'How much cards, buttons and widgets stand up from the page.',
        seg('depthlevel', { 0: 'Flat', 35: 'Soft lift', 55: 'Medium', 75: 'Thick card' }),
        {
          hint: hintOf('depthlevel')
        }
      )
    ]);
    // Units
    group(sections.units, 'Units', '', [
      R('Speed', 'In the tables and the PDF of a session: e.g. 12.4 km/h or 7.7 mph', seg('speedunit', { kmh: 'km/h', mph: 'mph' }), {
        hint: hintOf('speedunit')
      }),
      R(
        'PDF prints',
        'The race report, the heat list, the standings, the rules and the QR code',
        seg('pdfmode', { colour: 'Colour', mono: 'Monochrome' }),
        {
          hint: hintOf('pdfmode')
        }
      ),
      R(
        'Distance',
        `A lane of ${Speed.lengthText(28.45, 'm')} is ${Speed.lengthText(28.45, 'ft')}; everything stays saved in metres`,
        seg('distunit', { m: 'm · km', ft: 'ft · mi' }),
        { hint: hintOf('distunit') }
      )
    ]);
    // Home and club
    {
      group(sections.home, 'Name and welcome', '', [
        R('App name', 'At the top of the window', ctl('appname')),
        R('Welcome message', 'At the top of Home; empty shows the standard', ctl('welcome'))
      ]);
      const hasPic = !!S.homeHeader;
      const prev = get('hdrprev') || get('hdrbox'),
        frame = prev ? prev.closest('.homehead') || prev : null;
      if (get('hdrprev')) {
        // the picture moves with the arrow keys too: 1% a step, 10% with Shift
        const p = get('hdrprev');
        p.tabIndex = 0;
        p.setAttribute('aria-label', 'The header picture: drag it, or move it with the arrow keys');
        p.addEventListener('keydown', ev => {
          const k = { ArrowLeft: ['hdrx', -1], ArrowRight: ['hdrx', 1], ArrowUp: ['hdry', -1], ArrowDown: ['hdry', 1] }[ev.key];
          const inp = k && get(k[0]);
          if (!inp || inp.disabled) return;
          ev.preventDefault();
          inp.value = String(Math.max(0, Math.min(100, (Number(inp.value) || 0) + k[1] * (ev.shiftKey ? 10 : 1))));
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
        });
        p.addEventListener('dblclick', () => get('hdrcenter') && get('hdrcenter').click());
      }
      const pos = (x, y, centre) => {
        const wrap = el('span', 'ss-pos');
        [
          [x, 'Left / right'],
          [y, 'Up / down']
        ].forEach(([id, name]) => {
          if (!get(id)) return;
          const l = el('span', 'ss-posl', esc(name));
          wrap.append(l, K.kit(get(id), '%'));
        });
        if (get(centre)) {
          get(centre).classList.add('ghost', 'sm');
          get(centre).textContent = 'Centre';
          wrap.append(get(centre));
        }
        return wrap;
      };
      const hdrAuto = get('hdrauto');
      if (hdrAuto) {
        hdrAuto.classList.add('ss-switch');
        hdrAuto.title = 'Automatic: follows the shape of the picture';
      }
      group(sections.home, 'Header picture', '', [
        R('Picture', 'Across the top of Home', [ctl('hdrfile'), get('hdrclear')].filter(Boolean)),
        hasPic && frame
          ? R('Framing', 'Drag the picture, or click it and use the arrow keys; double-click to centre', frame, { cls: 'ss-framing' })
          : null,
        hasPic || get('hdrh')
          ? R(
              'Height',
              hasPic
                ? 'Automatic follows the shape of the picture; a set height is a share of the window width'
                : 'A share of the window width',
              [hdrAuto ? el('span', 'ss-swl', 'Automatic') : null, hdrAuto, get('hdrh') ? K.kit(get('hdrh'), '%') : null].filter(Boolean)
            )
          : null,
        hasPic && get('hdrx')
          ? R('Position', 'Exact numbers, if you like them better than dragging', pos('hdrx', 'hdry', 'hdrcenter'), { cls: 'ss-sub' })
          : null
      ]);
      const logoSide = get('logoside');
      group(sections.home, 'Club logo', 'also used by every Logo widget without a picture of its own', [
        R('Logo', S.clubLogo ? '' : 'No logo yet', [get('logothumb'), ctl('logofile'), get('logoclear')].filter(Boolean)),
        logoSide
          ? R('On Home', 'Where the logo stands', [
              (() => {
                const g = segAny(logoSide),
                  words = {
                    '': 'Hidden',
                    left: 'Left',
                    right: 'Right',
                    'over-left': 'On picture, left',
                    'over-right': 'On picture, right'
                  };
                g.querySelectorAll('button').forEach(x => (x.textContent = words[x.dataset.v] || x.textContent));
                return g;
              })(),
              logoSide
            ])
          : null,
        get('logow') ? R('Width', 'A share of the header', K.kit(get('logow'), '%'), { cls: 'ss-sub' }) : null,
        get('logox') ? R('Position', 'Inside the space of the logo', pos('logox', 'logoy', 'logocenter'), { cls: 'ss-sub' }) : null
      ]);
      hidden(['hdrhv', 'hdrxv', 'hdryv', 'logowv', 'logoxv', 'logoyv']).forEach(o => sections.home.append(o));
    }
    // Picture quality
    group(sections.pictures, 'Uploads', '', [
      R('Quality', 'Of the pictures you add from now on', seg('picq', { original: 'Original', high: 'High', standard: 'Standard' }), {
        hint: hintOf('picq')
      })
    ]);
    // Performance
    {
      const sw = (id, title) => {
        const f = fieldOf(id);
        const h = f ? [...f.querySelectorAll('.hint')].slice(0, 1) : [];
        return R(title, '', ctl(id), { hint: h, cls: 'ss-switchrow' });
      };
      group(sections.performance, 'Drawing and saving', '', [
        sw('layerswitch', 'Draw changing text on its own layer'),
        sw('bgsave', 'Save changes in the background'),
        sw('perfswitch', 'Show the Performance line on the race screen')
      ]);
      const rep = group(sections.performance, 'Report', 'updated every second while you look at it', []);
      if (get('perfout')) {
        const b = el('div', 'ss-block');
        b.append(get('perfout'));
        rep.append(b);
      }
      rep.append(R('', '', [get('perfmsg'), get('perfcopy')].filter(Boolean), { cls: 'ss-actions' }));
    }
    // Database storage (2.4.0, Settings Hub: on Backups and storage now; storageView draws it there)
    {
      const body = box.querySelector('[data-folder="general:data"] .fbody');
      if (body) sections.storage.append(storageView(body, R, group));
    }
    // Updates and help
    {
      // (2.4.0) the Updates section of the update check (update-ui.js draws it in this box) and the line of its messages
      ['updatehost', 'updatesay']
        .map(get)
        .filter(Boolean)
        .forEach(x => sections.updates.append(x));
      group(sections.updates, 'Help', '', [
        R(
          'Diagnostics',
          'One text file for a bug report; look it over before you send it',
          [get('diagmsg'), get('diagsave')].filter(Boolean)
        ),
        R('Setup guide', 'A track, drivers, cars, the hardware, a sensor test and a 3-lap test race', get('guiderun'))
      ]);
    }
    requestAnimationFrame(() => K.folds(page));

    // the folders are empty now: they and their Open all / Close all go
    box.querySelectorAll(':scope > details, :scope > .fgtools, :scope > .row').forEach(n => n.remove());
    box.prepend(page);
    rail.onclick = ev => {
      const b = ev.target.closest('[data-gtopic-btn]');
      if (b) show(b.dataset.gtopicBtn);
    };
  }
  // Database storage: the format with its state, the file with a copy button, then the three numbers in one row. body: the part drawn by
  // settingsStorageHtml (app.js); R and group: how a row and a group of the sheet are made (the ones of build, or of storageOn)
  function storageView(body, R, group) {
    const wrap = el('div', 'ss-storage'),
      txt = e => String((e && e.textContent) || '').trim();
    if (body) {
      const fmt = txt(body.querySelector('.row strong')),
        code = body.querySelector('code'),
        paras = [...body.querySelectorAll(':scope > p')].filter(
          p => !p.querySelector('code') && p.id !== 'storagemsg' && !p.closest('.gs-stats')
        ),
        about = paras.find(p => !p.classList.contains('muted')),
        stats = body.querySelector('.gs-stats'),
        note = paras.find(p => p.classList.contains('muted'));
      const pill = el('span', 'ss-pill ok', esc(fmt || 'Database'));
      const copy = el('button', 'btn ghost', 'Copy');
      copy.type = 'button';
      copy.onclick = async () => {
        try {
          await navigator.clipboard.writeText(txt(code));
          copy.textContent = 'Copied';
          setTimeout(() => (copy.textContent = 'Copy'), 1500);
        } catch {
          /* the clipboard is not available */
        }
      };
      if (code) code.classList.add('ss-path');
      group(wrap, 'Where it is saved', '', [
        R('Format', '', [pill, body.querySelector('#sqliteactivate')].filter(Boolean), { hint: about ? [about] : [] }),
        code ? R('File', '', [code, copy]) : null
      ]);
      if (stats) {
        wrap.append(el('h4', 'ss-gh', 'Room it takes'));
        wrap.append(stats);
      }
      if (note) {
        note.classList.add('ss-foot');
        wrap.append(note);
      }
      const msg = body.querySelector('#storagemsg');
      if (msg) wrap.append(msg);
    }
    return wrap;
  }
  // (2.4.0, Settings Hub) the storage drawn in another page (Backups and storage): the same rows as in General
  function storageOn(host) {
    if (!host || host.nodeType !== 1 || typeof SettingsSheet === 'undefined') return;
    const K = SettingsSheet;
    const R = (title, desc, controls, o = {}) => K.row({ title, desc, hint: o.hint || [], ctl: [].concat(controls), cls: o.cls || '' });
    const group = (into, title, note, rows) => {
      if (title) into.append(el('h4', 'ss-gh', `${esc(title)}${note ? `<span>${esc(note)}</span>` : ''}`));
      const sh = el('div', 'ss-sheet');
      rows.filter(Boolean).forEach(r => sh.append(r));
      into.append(sh);
      return sh;
    };
    const wrap = storageView(host, R, group);
    host.replaceChildren(wrap);
  }
  // show a topic (also used by the settings search: a setting found in another topic opens that topic first)
  function show(id) {
    if (!shownTopics.includes(id)) return;
    topic = id;
    document.querySelectorAll('.gs-topic').forEach(s => (s.hidden = s.dataset.gtopic !== id));
    document.querySelectorAll('[data-gtopic-btn]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.gtopicBtn === id)));
    const shown = document.querySelector(`.gs-topic[data-gtopic="${id}"]`);
    if (shown && typeof SettingsSheet !== 'undefined') SettingsSheet.folds(shown);
    const c = document.querySelector('.gs-canvas');
    if (c && c.scrollIntoView && c.getBoundingClientRect && c.getBoundingClientRect().top < 0) c.scrollIntoView({ block: 'start' });
  }
  return { build, show, storageOn, TOPICS };
})();

// (2.4.0) the Double Rail for the other pages of App Settings. Every page keeps drawing itself as it always did (its own tabs, the sheet with its
// sections); this puts a second side list beside it with the tabs of the page (interfaces, connections, views, topics) and its sections, and shows one
// section at a time on a plain canvas. The page's own tab buttons stay in the page, out of sight, and are clicked for you, so every handler still works.
// A page draws parts of itself again (another interface, another view): a watcher on the box redraws the side list when its tabs or sections change.
const SettingsRail = (() => {
  const PAGES = {
    theme: { lead: 'The colours of the app and of the Live Race pages.' },
    director: { lead: 'How the Race Director looks, what its buttons do, and its page on a phone.' },
    // (2.4.0, Settings Hub) the pages that were tabs or views of another page
    sharing: { lead: 'Phones, tablets and other computers that follow the race.' },
    paddock: { lead: 'SlotForge Paddock: the shared car library and the Dealership.' },
    packs: { lead: 'Named collections of layouts, widgets and more, with versions.' },
    calculations: {
      lead: 'How pace is measured and what every racing system adds.',
      tabs: '.calc-rail button',
      tabsLabel: 'Topics',
      body: '.calc-content'
    },
    network: { lead: 'Phones, tablets and other computers on your network.', tabs: '.connections-tabs > .tab', tabsLabel: 'Connections' },
    // (2.4.0, "Timing Desk") the interfaces in the rail; the sections of an interface as tabs under its big card; Diagnostics only when it is switched on
    hardware: {
      lead: 'What counts the laps.',
      tabs: '#hwtabs > .tab',
      tabsLabel: 'Timing hardware',
      secTabs: '#hwhero',
      hide: id => {
        const dev = typeof HwDesk !== 'undefined' && typeof state !== 'undefined' ? HwDesk.deviceOf(state.hwSub) : null;
        return !!dev && !(state.settings && state.settings.hwDiagnostics) && dev.diag.includes(id);
      }
    },
    transfer: { lead: 'Your backups, items to share, and where the data is kept.' },
    plugins: { lead: 'Extra features you install yourself.' }
  };
  const active = new Map(); // page (and tab) -> the section that is shown
  let obs = null,
    raf = 0,
    sig = '';
  const ico = n => (typeof Icons !== 'undefined' ? Icons.svg(Icons.has && !Icons.has(n) ? 'settings' : n, { size: 16, stroke: 1.8 }) : '');
  // (2.4.0) a section whose icon is a sign (the hardware pages: ⌁ ◉ ⇄ …) gets the line picture that means the same, like every other rail
  const GLYPH = {
    '⌁': 'parallel',
    '◉': 'gauge',
    '⇄': 'move',
    '≋': 'lines',
    '☼': 'lights',
    ϟ: 'bolt',
    '♬': 'bell',
    '↓': 'down',
    '⚙': 'cog',
    '⚑': 'flag',
    '☷': 'rules',
    '✓': 'check'
  };
  const railIcon = icon =>
    !icon
      ? ico('settings')
      : typeof Icons !== 'undefined' && (GLYPH[icon] || (Icons.has && Icons.has(icon)))
        ? ico(GLYPH[icon] || icon)
        : `<i class="sr-ico" aria-hidden="true">${/^\s*</.test(icon) ? icon : esc(icon)}</i>`; // (a picture the page drew itself stays as it is)
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
    // (2.4.0: the Parallel Port page has a side list of its own inside the page, .pp-nav buttons that open [data-section]: it joins the Double Rail too)
    const pp = [...canvas.querySelectorAll('.pp-rail .pp-nav[data-go]')];
    if (pp.length)
      return pp.map(b => {
        let c = b.previousElementSibling;
        while (c && !c.classList.contains('pp-railcap') && c.classList.contains('pp-nav')) c = c.previousElementSibling;
        return {
          id: b.dataset.go,
          title: txt(b.querySelector('b')),
          sub: txt(b.querySelector('small')),
          ready: !!b.querySelector('.pp-dot.pp-ok'),
          cap: c && c.classList.contains('pp-railcap') ? txt(c) : '',
          el: canvas.querySelector('.pp-section[data-section="' + CSS.escape(b.dataset.go || '') + '"]'),
          icon: (b.querySelector('svg') || {}).outerHTML || ''
        };
      });
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
        allSecs = sectionsOf(canvas).filter(s => s.el),
        secs = cfg.hide ? allSecs.filter(s => !cfg.hide(s.id)) : allSecs,
        tabKey = key + ':' + (tabs.find(t => t.on) || { label: '' }).label;
      if (cfg.tabs) canvas.querySelectorAll(cfg.tabs).forEach(t => t.parentElement && t.parentElement.classList.add('sr-tabsource'));
      let cur = active.get(tabKey);
      if (!secs.some(s => s.id === cur)) cur = secs[0] && secs[0].id;
      if (cur) active.set(tabKey, cur);
      // one section at a time, open, its title bar as the heading of the canvas
      allSecs.forEach(s => {
        s.el.classList.add('sr-sec');
        s.el.hidden = s.id !== cur;
        if (s.id === cur && !s.el.open) s.el.open = true;
      });
      // (2.4.0) the sections as tabs in the page, under its big card (the Timing Desk)
      if (cfg.secTabs) {
        let bar = canvas.querySelector(':scope > .sr-sectabs');
        if (secs.length > 1) {
          if (!bar) {
            bar = document.createElement('div');
            bar.className = 'sr-sectabs';
            bar.setAttribute('role', 'tablist');
            const after = canvas.querySelector(cfg.secTabs);
            if (after) after.after(bar);
            else canvas.prepend(bar);
            bar.onclick = ev => {
              const b = ev.target.closest('[data-sr-sec]');
              if (!b) return;
              const k = key + ':' + (tabsOf(canvas, cfg).find(x => x.on) || { label: '' }).label;
              active.set(k, b.dataset.srSec);
              refresh(box, key);
            };
          }
          let lastCapTab = '';
          const html = secs
            .map(s => {
              const cap = s.cap && lastCapTab && s.cap !== lastCapTab ? '<span class="sr-tabgap" aria-hidden="true"></span>' : '';
              if (s.cap) lastCapTab = s.cap;
              return `${cap}<button type="button" role="tab" class="sr-sectab${s.id === cur ? ' on' : ''}" data-sr-sec="${esc(s.id)}" aria-selected="${s.id === cur}" title="${esc(s.sub)}">${esc(s.title)}</button>`;
            })
            .join('');
          if (bar.innerHTML !== html) bar.innerHTML = html;
        } else if (bar) bar.remove();
      }
      canvas.classList.toggle('sr-hassecs', secs.length > 0);
      // (2.4.0) the Settings Sheet: the settings of what is shown become slim rows (settingssheet.js); only once per part of the page
      if (typeof SettingsSheet !== 'undefined') {
        const parts = secs.length
          ? secs.filter(s => !s.el.hidden).map(s => s.el.querySelector(':scope > .tm-content') || s.el)
          : [...canvas.querySelectorAll(cfg.body || ':scope > *')].filter(
              n => !n.matches('.sr-tabsource,#hwuse,#hwnote,#hwhero,#hwdiag,.hd-box,.sr-sectabs')
            );
        parts.forEach(p => {
          if (p.closest && p.closest('.pp-frame')) return; // (the Parallel Port page keeps its own controls)
          if (p.matches && (p.matches('.pl, .cb-on') || p.querySelector(':scope > .pl, :scope > .bv, :scope > .tmx'))) return; // (2.4.0: the Paddock Pit Lane, the Engineer's Bench and the Backup Vault are drawn as they are)
          if (SettingsSheet.fresh(p)) SettingsSheet.convert(p);
          SettingsSheet.folds(p);
          // the short words that open a section become its Page Note: the section's picture and those words
          const lead = p && p.querySelector(':scope > p.ss-note:first-child');
          if (lead && txt(lead).length > 30) {
            const sec = p.closest('.sr-sec'),
              pic = sec && sec.querySelector(':scope > summary > i');
            const note = document.createElement('div'),
              tile = document.createElement('span');
            note.className = 'sn ss-intro';
            tile.className = 'sn-tile';
            tile.innerHTML = pic ? pic.innerHTML : '';
            note.append(tile);
            lead.before(note);
            lead.classList.remove('ss-note');
            lead.classList.add('sn-lead');
            note.append(lead);
            // a long one: the first sentence leads, the rest is the quiet line under it
            const all = txt(lead),
              cut = all.search(/[.!?]\s+[A-Z]/);
            if (all.length > 130 && cut > 20) {
              const more = document.createElement('p');
              more.className = 'sn-more';
              more.textContent = all.slice(cut + 1).trim();
              lead.textContent = all.slice(0, cut + 1);
              note.append(more);
            }
          }
        });
      }
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
          (!cfg.secTabs && (secs.length > 1 || (secs.length && !tabs.length))
            ? `${secs[0].cap ? '' : `<span class="sr-cap">${tabs.length ? 'On this page' : 'Sections'}</span>`}${secs
                .map(s => {
                  const cap = s.cap && s.cap !== lastCap ? `<span class="sr-cap">${esc(s.cap)}</span>` : '';
                  if (s.cap) lastCap = s.cap;
                  return `${cap}<button type="button" class="gs-ri sr-secbtn" data-sr-sec="${esc(s.id)}" aria-pressed="${s.id === cur}">${railIcon(s.icon)}<span><b>${esc(s.title)}</b>${s.sub ? `<small>${esc(s.sub)}</small>` : ''}</span>${s.ready ? '<em class="sr-dot" aria-hidden="true"></em>' : ''}</button>`;
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
  // (2.4.0) show a section of the page that is open (the Timing Desk: Choose the port opens Connection)
  function show(id) {
    const box = document.getElementById('settingsbox');
    const key = (typeof state !== 'undefined' && state.settingsSub) || '';
    if (!box || !PAGES[key]) return;
    const canvas = box.querySelector('.sr-canvas');
    const k = key + ':' + ((canvas && tabsOf(canvas, PAGES[key]).find(x => x.on)) || { label: '' }).label;
    active.set(k, id);
    refresh(box, key);
  }
  return { attach, detach, reveal, show, PAGES };
})();
