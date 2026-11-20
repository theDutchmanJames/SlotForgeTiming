// Help navigation and learning examples. The source articles stay in help.js.
(function (root) {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const plain = s =>
    String(s)
      .replace(/<[^>]*>/g, ' ')
      .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, x) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' })[x])
      .replace(/\s+/g, ' ')
      .trim();
  const normal = s =>
    plain(s)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/pit\s*stops?/g, 'pitstop')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  const GROUPS = [
    [
      'events',
      'Race setups & events',
      [
        'home',
        'racingrules',
        'setups',
        'setupwords',
        'types',
        'distance',
        'comparedist',
        'heatraces',
        'heatplan',
        'rotation',
        'teams',
        'endurance',
        'heatresults',
        'heatfinals',
        'totaltime'
      ]
    ],
    [
      'systems',
      'Race Systems',
      [
        'fuel',
        'tyrewear',
        'tyretemperature',
        'customtyres',
        'weather',
        'pushsave',
        'safetycar',
        'damage',
        'carfailures',
        'penaltytiers',
        'bop',
        'servicestop',
        'resources',
        'resourcerecovery',
        'multiclass',
        'classlabels',
        'classpoints',
        'virtualrivals',
        'rivalracing',
        'tokens',
        'championships',
        'championshippoints',
        'systemforms',
        'systemformsmore'
      ]
    ],
    ['widgets', 'Race screens & widgets', []],
    ['audio', 'Audio & appearance', ['audio', 'audiobooth', 'ambient', 'audioconditions', 'audiocategories', 'audioevents', 'look']],
    [
      'hardware',
      'Timing hardware',
      ['timingdesk', 'hardware', 'arduino', 'arduinoracelock', 'interfacepages', 'parallel', 'timingplugins']
    ],
    [
      'results',
      'Results & race control',
      [
        'results',
        'recordbook',
        'paddockhistory',
        'paddockhistorical',
        'paddockhistoryuploads',
        'start',
        'screen',
        'sectors',
        'director',
        'lanecards'
      ]
    ],
    [
      'settings',
      'Database & app settings',
      [
        'database',
        'garage',
        'sqlitestorage',
        'sqlitebackups',
        'sqliteperformance',
        'paddock',
        'paddocklocal',
        'paddocksharededit',
        'paddocksharedsaves',
        'paddocktransfers',
        'paddockreconcile',
        'paddockcatalogue',
        'paddockfiles',
        'trackbuilder',
        'settingsnavigation',
        'find',
        'copyandorder',
        'calculations',
        'performance',
        'contentpacks',
        'transfer'
      ]
    ],
    ['network', 'Screens & network', ['live', 'driverstats', 'network']]
  ];
  // (2.4.0, SlotForgeRestyle.md "Help Desk") every page of the app and its article: the "?" beside the page title and F1 open it, and the article has
  // "Open <page>". [page key, article, the words of the button]; the first page of an article is the one it opens.
  const PAGE_LIST = [
    ['home', 'home', 'Open Home'],
    ['rules', 'racingrules', 'Open Racing Rules'],
    ['live', 'live', 'Open the Live Race'],
    ['database/slotcars', 'garage', 'Open Slotcars'],
    ['database/drivers', 'garage', 'Open Drivers'],
    ['database/tracks', 'trackbuilder', 'Open Tracks'],
    ['database/teams', 'teams', 'Open Teams'],
    ['database/results', 'recordbook', 'Open Results and Records'],
    ['setup/setups', 'setups', 'Open Race Setups'],
    ['setup/fuel', 'fuel', 'Open Fuel Systems'],
    ['setup/penalties', 'penaltytiers', 'Open Penalty Systems'],
    ['setup/damage', 'damage', 'Open Damage Systems'],
    ['setup/safetycar', 'safetycar', 'Open Safety Car Systems'],
    ['setup/tyrewear', 'tyrewear', 'Open Tyre Wear Systems'],
    ['setup/weather', 'weather', 'Open Weather Systems'],
    ['setup/pushsave', 'pushsave', 'Open Push & Save Systems'],
    ['setup/rotation', 'rotation', 'Open Rotation Setups'],
    ['setup/championships', 'championships', 'Open Championships'],
    ['setup/bop', 'bop', 'Open Balance of Power'],
    ['setup/tokens', 'tokens', 'Open Time Tokens'],
    ['setup/virtualrivals', 'virtualrivals', 'Open Virtual Rival Systems'],
    ['setup/multiclass', 'multiclass', 'Open Multi-Class Systems'],
    ['setup/resources', 'resources', 'Open Resource Systems'],
    ['custom/layouts', 'layouteditor', 'Open the Layout Editor'],
    ['custom/rows', 'custom', 'Open the Leaderboard Editor'],
    ['custom/charts', 'charteditor', 'Open the Chart Editor'],
    ['custom/widgets', 'widgetcomposer', 'Open the Widget Builder'],
    ['custom/results', 'results', 'Open Race Results'],
    ['custom/audio', 'audio', 'Open Audio Settings'],
    ['custom/images', 'look', 'Open Image Settings'],
    ['custom/pluginpages', 'plugindisplays', 'Open Plugin Pages & Tools'],
    ['settings/overview', 'settingsnavigation', 'Open the App Settings Overview'],
    ['settings/display', 'look', 'Open Display and units'],
    ['settings/theme', 'look', 'Open App Theme'],
    ['settings/home', 'look', 'Open Home and club'],
    ['settings/hardware', 'hardware', 'Open Timing Hardware'],
    ['settings/director', 'director', 'Open Race Director'],
    ['settings/sharing', 'network', 'Open Share the race'],
    ['settings/calculations', 'calculations', 'Open Calculations'],
    ['settings/transfer', 'transfer', 'Open Backups and storage'],
    ['settings/paddock', 'paddock', 'Open Paddock'],
    ['settings/packs', 'contentpacks', 'Open Content Packs'],
    ['settings/plugins', 'pluginrules', 'Open Plugins'],
    ['settings/performance', 'performance', 'Open Performance'],
    ['settings/updates', 'settingsnavigation', 'Open Updates and help']
  ];
  const routeOfKey = key => {
    const [tab, sub] = key.split('/');
    if (!sub) return { tab };
    return { tab, [{ database: 'sub', setup: 'setupSub', custom: 'customSub', settings: 'settingsSub' }[tab]]: sub };
  };
  // a page as a key: "setup/fuel", "database/drivers", "rules"
  const pageKey = st =>
    !st || !st.tab
      ? ''
      : {
          database: 'database/' + st.sub,
          setup: 'setup/' + st.setupSub,
          custom: 'custom/' + st.customSub,
          settings: 'settings/' + st.settingsSub
        }[st.tab] || st.tab;
  const PAGE_HELP = Object.fromEntries(PAGE_LIST.map(([k, id]) => [k, id]));
  const topicOfPage = st => PAGE_HELP[pageKey(st)] || '';
  // Only these known destinations can navigate out of Help; articles never supply commands.
  const ROUTES = {
    pluginrules: { tab: 'setup', setupSub: 'setups' },
    plugindisplays: { tab: 'custom', customSub: 'pluginpages' },
    layouts: { tab: 'custom', customSub: 'layouts' },
    'step-tracks': { tab: 'database', sub: 'tracks' },
    'step-drivers': { tab: 'database', sub: 'drivers' },
    'step-setups': { tab: 'setup', setupSub: 'setups' },
    'step-race': { tab: 'home' }
  };
  const ROUTE_LABEL = {};
  PAGE_LIST.forEach(([k, id, label]) => {
    if (ROUTE_LABEL[id]) return;
    if (!ROUTES[id]) ROUTES[id] = routeOfKey(k);
    ROUTE_LABEL[id] = label;
  });
  ROUTE_LABEL.pluginrules = 'Open Race Setups';
  // the groups on the Help home: an icon, a colour and what is in it
  const GROUP_LOOK = {
    events: ['flag', 'blue', 'Home, race setups, kinds of session, heats, endurance, teams'],
    systems: ['fuel', 'green', 'Fuel, tyres, weather, damage, penalties, safety car, classes, championships'],
    widgets: ['screen', 'yellow', 'Layouts, leaderboard rows, charts, widgets and their looks'],
    audio: ['say', 'purple', 'Calls, the commentary booth, sounds, themes and pictures'],
    hardware: ['timing', 'red', 'The Timing Desk, Trackmate, DS, Arduino, the parallel port'],
    results: ['star', 'orange', 'The record book, starting a race, the race screen, the Race Director'],
    settings: ['database', 'teal', 'Drivers, cars, tracks, the Paddock, backups, import and export'],
    network: ['users', 'grey', 'The Live Race, phones and tablets, a second screen']
  };
  const RELATED = {
    paddockhistorical: ['paddockhistoryuploads', 'paddockhistory', 'results'],
    paddockhistoryuploads: ['paddockhistorical', 'paddockhistory', 'paddock'],
    paddockhistory: ['results', 'paddockhistorical', 'paddockhistoryuploads', 'paddocklocal'],
    paddocklocal: ['paddocksharededit', 'paddocksharedsaves', 'paddocktransfers'],
    paddocksharededit: ['paddocksharedsaves', 'paddocklocal'],
    paddocksharedsaves: ['paddocksharededit', 'paddockreconcile'],
    paddockcatalogue: ['paddock', 'paddockfiles'],
    paddock: ['paddockcatalogue', 'paddockfiles', 'paddocklocal'],
    paddockfiles: ['paddock', 'transfer'],
    fuel: ['servicestop', 'pushsave', 'calculations'],
    laphighlights: ['laphighlightbehaviour', 'widgetstatecolours', 'widgetappearance'],
    tyrewear: ['customtyres', 'tyretemperature', 'servicestop'],
    hardware: ['parallel', 'arduino'],
    widgetcomposer: ['widgetfreecanvas', 'widgetcomposeroptions', 'widgetappearance']
  };
  function fuelExample(tank, burn, rate) {
    const v = [tank, burn, rate].map(x => (typeof x === 'string' && x.trim() === '' ? NaN : Number(x)));
    if (v.some(x => !Number.isFinite(x) || x <= 0) || v[0] > 10000 || v[1] > 1000 || v[2] > 1000) return null;
    return { laps: v[0] / v[1], seconds: v[0] / v[2] };
  }
  function create(source) {
    const topics = source.folders(),
      byId = new Map(topics.map(t => [t.id, t]));
    const assigned = new Set(GROUPS.flatMap(g => g[2]));
    const groups = GROUPS.map(([id, title, ids]) => ({
      id,
      title,
      ids: (id === 'widgets' ? topics.filter(t => !assigned.has(t.id)).map(t => t.id) : ids).filter(id => byId.has(id))
    }));
    // (2.4.0) in each group the article of a page comes first, the articles that go deeper after it
    const lead = new Set(PAGE_LIST.map(x => x[1]));
    groups.forEach(g => (g.ids = [...g.ids.filter(id => lead.has(id)), ...g.ids.filter(id => !lead.has(id))]));
    const groupOf = id => groups.find(g => g.ids.includes(id));
    const index = topics.map(t => ({
      ...t,
      text: plain(t.body),
      titleKey: normal(t.title),
      key: normal(t.title + ' ' + t.note + ' ' + t.body + (t.id.startsWith('laphighlight') ? ' flash glow' : ''))
    }));
    const state = {
      topic: 'help-home', // (2.4.0: the Help home; 'start-guide' is the first-race guide in full)
      drawer: false,
      page: '', // (the article of the page the drawer was opened on)
      progress: null,
      settings: [],
      query: '',
      mobile: false,
      opened: new Set(),
      articleOpened: new Set(),
      fuel: { tank: 100, burn: 2, rate: 10 }
    };
    function search(query) {
      const q = normal(String(query || '').slice(0, 200)),
        terms = q.split(' ').filter(Boolean);
      if (!terms.length) return [];
      return index
        .filter(t => terms.every(w => t.key.includes(w)))
        .map(t => ({ ...t, score: t.titleKey === q ? 3 : t.titleKey.includes(q) ? 2 : terms.some(w => t.titleKey.includes(w)) ? 1 : 0 }))
        .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
    }
    const tone = id => source.tones?.[id] || '';
    const attr = id => (tone(id) ? ` data-system="${tone(id)}"` : '');
    function select(id) {
      if (id !== 'start-guide' && id !== 'help-home' && !byId.has(id)) return false;
      state.topic = id;
      if (byId.has(id) && source.read) source.read(id);
      state.query = '';
      state.mobile = false;
      state.opened.clear();
      const g = groupOf(id);
      if (g) state.opened.add(g.id);
      return true;
    }
    const links = ids =>
      ids
        .filter(id => byId.has(id))
        .map(id => `<button class="btn" type="button" data-help-topic="${id}">${esc(byId.get(id).title)} →</button>`)
        .join('');
    function rail() {
      return `<button type="button" class="help-topic help-start" data-help-topic="help-home"${state.topic === 'help-home' && !state.query ? ' aria-current="page"' : ''}>Help home</button><button type="button" class="help-topic help-start" data-help-topic="start-guide"${state.topic === 'start-guide' && !state.query ? ' aria-current="page"' : ''}>Start here · Your first race</button><button class="btn help-browse" type="button" data-help-browse aria-expanded="${state.mobile}" aria-controls="help-groups">Browse help topics ▾</button><div id="help-groups" class="help-groups${state.mobile ? ' expanded' : ''}">${groups.map(g => `<details data-help-group="${g.id}"${state.opened.has(g.id) ? ' open' : ''}><summary>${esc(g.title)}<span class="help-count">${g.ids.length}</span></summary>${g.ids.map(id => `<button type="button" class="help-topic" data-help-topic="${id}"${attr(id)}${state.topic === id && !state.query ? ' aria-current="page"' : ''}>${esc(byId.get(id).title)}</button>`).join('')}</details>`).join('')}</div><p class="help-offline">Available offline<br>${topics.length} topics · All themes</p>`;
    }
    // (2.4.0) over a form (state.locked) the drawer does not leave the page: no page buttons
    const route = (id, label) =>
      state.locked ? '' : `<button class="btn help-open" type="button" data-help-route="${id}">${esc(label)} ↗</button>`;
    function reader() {
      const q = state.query.trim();
      if (q) {
        const hits = search(q);
        const sets = source.settings ? source.settings(q).slice(0, 4) : [];
        state.settings = sets;
        return `<div class="help-crumb">Help / Search</div><h3 tabindex="-1">Find an answer</h3><p class="muted" role="status">${hits.length} ${hits.length === 1 ? 'topic' : 'topics'} matching “${esc(q)}”</p>${hits.map(t => `<button type="button" class="help-hit" data-help-topic="${t.id}"><strong>${marked(t.title, q)}</strong><small>${esc(groupOf(t.id)?.title)} · ${esc(t.note)}</small><span>${marked(snippet(t.text, q), q)}</span></button>`).join('') || '<p>No matching topics. Try “fuel”, “sensor” or “layout”.</p>'}${
          sets.length
            ? `<h4>Settings</h4><div class="help-sets">${sets.map((e, i) => `<button type="button" class="help-hit help-set" data-help-setting="${i}"><strong>${marked(e.t, q)}</strong><small>${esc(e.where || 'App Settings')}</small><span class="help-go">Go to setting →</span></button>`).join('')}</div>`
            : ''
        }`;
      }
      if (state.topic === 'help-home') return homeHtml();
      if (state.topic === 'start-guide')
        return `<div class="help-crumb">Help / Start here</div>${source.WELCOME}<div class="help-actions">${route('setups', 'Open Race Setups')}<button class="btn" type="button" data-help-topic="hardware">Connect timing hardware →</button></div><h4>What would you like to do next?</h4><div class="help-related">${links(['fuel', 'widgetappearance', 'audio', 'laphighlights'])}</div>`;
      const t = byId.get(state.topic),
        id = t.id,
        g = groupOf(id);
      let content = `<div class="help-plain"><b>In plain words</b><p>${esc(t.note)}.</p></div><div class="help-article-body">${t.body}</div>`;
      if (id === 'fuel')
        content = `<div class="help-plain"><b>In plain words</b><p>Cars use virtual fuel as they race. The tank size and consumption determine how far they can go; the refuel speed determines how long a stop takes.</p></div><h4>Try a base-fuel example</h4><div class="help-example"><div class="help-fields">${[
          ['tank', 'Tank size · litres', 10000],
          ['burn', 'Use per lap · litres', 1000],
          ['rate', 'Refuel speed · litres/s', 1000]
        ]
          .map(
            ([key, label, max]) =>
              `<label>${label}<input type="number" data-help-fuel="${key}" min="0.1" max="${max}" step="0.1" value="${state.fuel[key]}"></label>`
          )
          .join(
            ''
          )}</div><div class="help-fuel-result" aria-live="polite">${fuelResult()}</div><p class="help-note">Learning example only. Race settings are not changed. Push &amp; Save and other active modifiers can change actual consumption.</p></div>${state.drawer && state.page === 'fuel' ? '' : `<div class="help-actions">${route('fuel', 'Open Fuel Systems')}</div>`}${more(t, 'How the settings work together')}`;
      if (id === 'laphighlights')
        content = `<div class="help-plain"><b>In plain words</b><p>A short inward glow shows that a lap registered. Green celebrates a personal best; purple celebrates a track record. You can change these colours.</p></div><h4>See the difference</h4><div class="help-example"><div class="help-lap-demo"><small>LAP TIME · LANE 1</small><strong>8.402</strong></div><div class="help-actions">${[
          ['lap', 'Lap recorded'],
          ['pb', 'Personal best'],
          ['record', 'Track record']
        ]
          .map(([key, label]) => `<button class="btn" type="button" data-help-flash="${key}">${label}</button>`)
          .join(
            ''
          )}</div></div><h4>Where to change it</h4><p><b>Layout Editor → Widget appearance → Race states &amp; Lap Highlights</b> sets the layout defaults. Select a widget and open the same folder to override them.</p><div class="help-actions">${route('layouts', 'Open Layouts')}</div>${more(t, 'Colours, duration and per-widget settings')}`;
      // (2.4.0) every article of a page opens it (not in the drawer opened on that page: you are there)
      if (ROUTES[id] && ROUTE_LABEL[id] && !content.includes(`data-help-route="${id}"`) && !(state.drawer && state.page === id))
        content += `<div class="help-actions">${route(id, ROUTE_LABEL[id])}</div>`;
      const at = g.ids.indexOf(id),
        prev = g.ids[at - 1],
        next = g.ids[at + 1];
      const step = (x, dir) =>
        x
          ? `<button type="button" class="help-step ${dir}" data-help-topic="${x}"><small>${dir === 'prev' ? '← Before' : 'Next →'}</small>${esc(byId.get(x).title)}</button>`
          : '<span></span>';
      return `<article class="help-article"${attr(id)}><div class="help-crumb">Help / ${esc(g?.title)}</div><h3 tabindex="-1">${esc(id === 'fuel' ? 'Fuel Systems' : t.title)}</h3>${state.drawer && state.page === id ? '<span class="help-here">About this page</span>' : ''}<p class="help-lead">${esc(t.note)}</p>${content}<h4>Related guides</h4><div class="help-related">${links(RELATED[id] || g.ids.filter(x => x !== id).slice(0, 3))}</div><nav class="help-pager" aria-label="Before and next in ${esc(g.title)}">${step(prev, 'prev')}${step(next, 'next')}</nav></article>`;
    }
    // (2.4.0, SlotForgeRestyle.md "Help Desk") the Help home: your first race (ticked from your data), what you read lately, a tile per group
    function homeHtml() {
      const p = state.progress;
      const steps = [
        ['step-tracks', 'Add your track', p && p.tracks, p ? plural(p.tracks, 'track') : 'Database → Tracks'],
        [
          'step-drivers',
          'A driver and a slotcar',
          p && p.drivers && p.cars,
          p ? `${plural(p.drivers, 'driver')} · ${plural(p.cars, 'car')}` : 'Database → Drivers, Slotcars'
        ],
        ['step-setups', 'A race setup', p && p.setups, p ? plural(p.setups, 'setup') : 'Race Setup → Race Setups'],
        ['step-race', 'Pick who drives and start', p && p.races, p && p.races ? plural(p.races, 'race') + ' run' : 'Home → Start a Race']
      ];
      const done = p ? steps.filter(x => x[2]).length : 0,
        nextAt = p ? steps.findIndex(x => !x[2]) : -1;
      const recent = (source.recent ? source.recent() : []).filter(id => byId.has(id)).slice(0, 6);
      return `<div class="help-home"><section class="help-startcard"><span class="help-k">Start here${p ? ` · ${done} of 4 done` : ''}</span><h3 tabindex="-1">Your first race, step by step</h3>${
        p
          ? `<div class="help-progress" role="progressbar" aria-label="Your first race" aria-valuemin="0" aria-valuemax="4" aria-valuenow="${done}"><span style="width:${done * 25}%"></span></div>`
          : ''
      }<ol class="help-steps">${steps
        .map(
          ([r, t, ok, sub], i) =>
            `<li class="${p && ok ? 'done' : i === nextAt ? 'next' : ''}"><button type="button" data-help-route="${r}"><i>${p && ok ? '✓ Done' : i === nextAt ? 'Next' : 'Step ' + (i + 1)}</i><b>${esc(t)}</b><small>${esc(sub)}</small></button></li>`
        )
        .join('')}</ol><button type="button" class="btn ghost sm" data-help-topic="start-guide">Read the whole guide →</button></section>${
        recent.length ? `<div><span class="help-k">You read lately</span><div class="help-related">${links(recent)}</div></div>` : ''
      }<div><span class="help-k">Browse by task · ${topics.length} articles</span><div class="help-tiles">${groups
        .map(g => {
          const [icon, tone, words] = GROUP_LOOK[g.id] || ['info', 'grey', ''];
          const ico = typeof Icons !== 'undefined' && Icons.has && Icons.has(icon) ? Icons.svg(icon, { size: 20, stroke: 1.8 }) : '';
          return `<button type="button" class="help-tile" data-tone="${tone}" data-help-topic="${g.ids[0]}"><span class="help-tileico">${ico}</span><b>${esc(g.title)}</b><em>${g.ids.length}</em><small>${esc(words)}</small></button>`;
        })
        .join('')}</div></div></div>`;
    }
    const plural = (n, w) => `${n} ${n === 1 ? w : w + 's'}`;
    // the typed words marked in a text (escaped)
    function marked(text, q) {
      const terms = String(q)
        .toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 1)
        .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      if (!terms.length) return esc(text);
      const re = new RegExp('(' + terms.join('|') + ')', 'gi');
      return String(text)
        .split(re)
        .map((part, i) => (i % 2 ? `<mark>${esc(part)}</mark>` : esc(part)))
        .join('');
    }
    function more(t, title) {
      return `<details class="help-more" data-help-more="${t.id}"${state.articleOpened.has(t.id) ? ' open' : ''}><summary>${title}</summary><div class="help-article-body">${t.body}</div></details>`;
    }
    function snippet(text, q) {
      const terms = String(q).toLowerCase().split(/\s+/);
      const at = Math.max(0, terms.map(w => text.toLowerCase().indexOf(w)).find(n => n >= 0) || 0),
        start = Math.max(0, at - 45);
      return (start ? '…' : '') + text.slice(start, start + 190) + (text.length > start + 190 ? '…' : '');
    }
    function fuelResult() {
      const r = fuelExample(state.fuel.tank, state.fuel.burn, state.fuel.rate),
        fmt = n => Number(n.toFixed(1)).toLocaleString();
      return r
        ? `<div><small>Base range · tank ÷ use</small><strong>${fmt(r.laps)} laps</strong></div><div><small>Empty to full · tank ÷ rate</small><strong>${fmt(r.seconds)} seconds</strong></div>`
        : 'Enter a positive value within each field’s range.';
    }
    function html() {
      if (state.drawer)
        return `<section class="help-hub help-drawer-in" aria-label="Help"><header class="help-dhead"><label class="help-search help-dsearch"><span class="help-k">Search Help</span><input type="search" data-help-search maxlength="200" placeholder="Search Help" value="${esc(state.query)}" aria-controls="help-reader"></label><button type="button" class="btn ghost sm" data-help-close aria-label="Close Help">Esc</button></header><div id="help-reader" class="help-reader">${reader()}</div><footer class="help-dfoot"><span><kbd>F1</kbd> help for this page</span>${state.locked ? '' : '<button type="button" class="btn sm" data-help-full>Open in Help ↗</button>'}</footer></section>`;
      return `<section class="help-hub" aria-label="Help and Guides"><header class="help-header"><div class="help-heading"><h2>Help &amp; Guides</h2><p>From your first lap to your own race experience.</p></div><label class="help-search">Find an answer<input type="search" data-help-search maxlength="200" placeholder="Try “pit stop”, “tyres” or “flash”…" value="${esc(state.query)}" aria-controls="help-reader"></label></header><div class="help-shell"><nav class="help-rail" aria-label="Help topics">${rail()}</nav><div id="help-reader" class="help-reader">${reader()}</div></div></section>`;
    }
    function render(box, options = {}) {
      box.innerHTML = html();
      const watch = () => {
        box.querySelectorAll?.('[data-help-group]').forEach(el => {
          el.ontoggle = () => {
            if (el.isConnected === false) return;
            if (el.open) {
              state.opened.clear();
              state.opened.add(el.dataset.helpGroup);
              box.querySelectorAll('[data-help-group]').forEach(other => {
                if (other !== el) other.open = false;
              });
            } else state.opened.delete(el.dataset.helpGroup);
          };
        });
        box.querySelectorAll?.('[data-help-more]').forEach(el => {
          el.ontoggle = () => {
            if (el.isConnected === false) return;
            if (el.open) state.articleOpened.add(el.dataset.helpMore);
            else state.articleOpened.delete(el.dataset.helpMore);
          };
        });
      };
      const repaint = (focus = false) => {
        const r = box.querySelector?.('#help-reader'),
          n = box.querySelector?.('.help-rail');
        if (!r || (!n && !state.drawer)) return;
        r.innerHTML = reader();
        if (n) n.innerHTML = rail();
        watch();
        if (focus) {
          r.querySelector('h3')?.focus({ preventScroll: true });
          r.scrollIntoView?.({ block: 'nearest' });
        }
      };
      box.onclick = e => {
        const b = e.target?.closest?.('button');
        if (!b) return;
        if (b.dataset.helpTopic && select(b.dataset.helpTopic)) {
          const input = box.querySelector?.('[data-help-search]');
          if (input) input.value = '';
          repaint(true);
        }
        if (b.hasAttribute?.('data-help-browse')) {
          state.mobile = !state.mobile;
          box.querySelector('.help-groups')?.classList.toggle('expanded', state.mobile);
          b.setAttribute('aria-expanded', String(state.mobile));
        }
        if (b.hasAttribute?.('data-help-close') && options.onClose) return options.onClose();
        if (b.hasAttribute?.('data-help-full') && options.onFull) return options.onFull(state.topic);
        if (b.dataset.helpSetting !== undefined && options.onSetting && state.settings[Number(b.dataset.helpSetting)])
          return options.onSetting(state.settings[Number(b.dataset.helpSetting)]);
        if (b.dataset.helpRoute && ROUTES[b.dataset.helpRoute] && options.onNavigate)
          Promise.resolve()
            .then(() => options.onNavigate({ ...ROUTES[b.dataset.helpRoute] }))
            .catch(() => {
              if (box.isConnected) {
                const r = box.querySelector('#help-reader');
                if (r) r.insertAdjacentHTML('beforeend', '<p role="alert">Could not open that page. Please try its tab.</p>');
              }
            });
        if (b.dataset.helpFlash) {
          const demo = box.querySelector('.help-lap-demo'),
            L = typeof module !== 'undefined' ? require('./laphighlights') : root.LapHighlights;
          L?.pulse(demo, { appearance: { lapDuration: 700 } }, {}, b.dataset.helpFlash === 'lap' ? '' : b.dataset.helpFlash);
        }
      };
      box.oninput = e => {
        if (e.target?.hasAttribute?.('data-help-search')) {
          state.query = e.target.value.slice(0, 200);
          repaint();
        }
        const key = e.target?.dataset?.helpFuel;
        if (['tank', 'burn', 'rate'].includes(key)) {
          state.fuel[key] = e.target.value;
          const result = box.querySelector('.help-fuel-result');
          if (result) result.innerHTML = fuelResult();
        }
      };
      box.onkeydown = e => {
        if (e.key === 'Escape' && e.target?.hasAttribute?.('data-help-search')) {
          state.query = '';
          e.target.value = '';
          repaint();
        }
      };
      watch();
      // (2.4.0) the figures of the first race come in later: the home is drawn again with them
      if (options.progress)
        Promise.resolve(options.progress)
          .then(p => {
            if (!p) return;
            state.progress = p;
            if (state.topic === 'help-home' && !state.query.trim() && box.isConnected !== false) repaint();
          })
          .catch(() => {});
    }
    return { html, render, search, groups, select, state };
  }
  const api = { create, plain, normal, fuelExample, ROUTES, ROUTE_LABEL, PAGE_LIST, PAGE_HELP, pageKey, topicOfPage, GROUP_LOOK };
  root.HelpView = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
