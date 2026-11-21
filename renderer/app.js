const view = document.getElementById('view');
const tabsEl = document.getElementById('tabs');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const TABS = [
  ['home', 'Home'],
  ['database', 'Database'],
  ['setup', 'Race Setup'],
  ['custom', 'Customization'],
  ['settings', 'App Settings'],
  ['rules', 'Racing Rules'],
  ['live', 'Live Race', 'onair']
]; // 'onair': the tab looks like a Live on Air sign (a red light and red letters, always, it does not follow the race)
// The line picture to the left of each main tab (icons.js). The Live Race tab has none: it has its own look. The tabs inside a screen have none either.
const TAB_ICONS = { home: 'home', database: 'database', setup: 'setup', custom: 'custom', settings: 'settings', rules: 'rules' };
const state = {
  tab: 'home',
  sub: 'tracks',
  schema: {},
  settings: { theme: 'dark' },
  custom: {},
  refs: {},
  setupSub: 'setups',
  customSub: 'layouts',
  settingsSub: 'overview',
  hwSub: 'trackmate',
  editing: null
};

const titleOf = (entity, item) =>
  (entity === 'slotcars' && (item.sharedLibrary ? item.name : item.paddock?.name)) ||
  state.schema[entity].title
    .map(k => item[k])
    .filter(Boolean)
    .join(' ') ||
  '(unnamed)';

// Native selectors still offer every record. Fetch metadata in bounded pages,
// restarting the complete read if a concurrent edit invalidates a cursor.
const REFERENCE_ENTITIES = new Set(['tracks', 'drivers', 'slotcars', 'teams', 'layouts', 'audiosets', 'imagesets']);
async function readReferenceSet(entity) {
  if (!api.referencePage || !REFERENCE_ENTITIES.has(entity)) return { items: await api.list(entity), revision: null };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const items = [];
      let cursor = null,
        revision,
        scope;
      do {
        const page = await api.referencePage(entity, { cursor });
        items.push(...page.items);
        cursor = page.next;
        revision = page.revision;
        scope = page.scope;
      } while (cursor);
      return { items, revision, ...(scope ? { scope } : {}) };
    } catch (error) {
      if (attempt === 2 || !(error.code === 'CATALOGUE_CHANGED' || /catalogue changed/i.test(error.message))) throw error;
    }
  }
}
const referenceList = async entity => (await readReferenceSet(entity)).items;
async function readReferenceGroups(entities) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const groups = await Promise.all(entities.map(readReferenceSet));
    const scopes = new Map();
    for (const g of groups)
      if (g.revision) {
        const k = g.scope || 'timing';
        if (!scopes.has(k)) scopes.set(k, new Set());
        scopes.get(k).add(g.revision);
      }
    if ([...scopes.values()].every(revisions => revisions.size <= 1)) return groups;
  }
  throw Error('The catalogue changed while loading choices. Please refresh the page.');
}

const DEFAULT_NAME = 'SlotForge Timing';
const DEFAULT_WELCOME = 'Welcome to the SlotForge Slotcar Timing App!';
// the welcome message at the top of the Home tab (changeable in App Settings); empty means the default
const welcomeOf = () => (state.settings.welcome || '').trim() || DEFAULT_WELCOME;
// the name shown in the app's header and window title (changeable in App Settings)
function applyName() {
  const n = (state.settings.appName || '').trim() || DEFAULT_NAME,
    h = document.querySelector('.app-identity h1');
  if (h) {
    // As in Telemetry, the slogan sets the wordmark width beside the 42px icon.
    // A user-defined app name remains readable text, rather than being replaced.
    const branded = n.toLowerCase() === DEFAULT_NAME.toLowerCase();
    h.parentElement.classList.toggle('is-brand', branded);
    h.innerHTML = branded
      ? `<span class="header-wordmark" role="img" aria-label="SlotForge Timing"><img class="header-light-ink" src="assets/brand/timing-wordmark-dark.svg" alt="" width="456.49" height="90.34" draggable="false"><img class="header-dark-ink" src="assets/brand/timing-wordmark-light.svg" alt="" width="456.49" height="90.34" draggable="false"></span>`
      : esc(n);
  }
  document.title = n;
}

// The header picture on the Home tab: its size and position come from banner.js. `automatic` is the style to use when the height is automatic.
const bannerStyle = (s, automatic = '') => {
  const c = Banner.css(s, automatic);
  return c ? ` style="${c}"` : '';
};

// The header of the Home tab, or its preview in App Settings (`preview`): the header picture and, beside it, the club logo when that is shown.
// Without a logo it is just the picture, as it always was. With one, the header is two columns that share one height: the logo is always shown whole,
// and the picture fills the rest (cropped as needed). With an automatic height the picture's own shape decides the height, from a hidden copy that spans the full width.
function homeHeaderHtml(s, preview = false) {
  const pic = s.homeHeader,
    logo = Banner.logoOn(s);
  if (!pic && !logo) return '';
  if (!logo)
    return preview
      ? `<img class="homebanner" id="hdrprev" src="${esc(pic)}" alt="" draggable="false"${bannerStyle(s, 'max-height:110px')}>`
      : `<div class="homehead"><img class="homebanner" src="${esc(pic)}" alt=""${bannerStyle(s)}></div>`;
  const left = Banner.logoSide(s) === 'left',
    over = Banner.logoOver(s), // (2.4.0: the picture fills the header and the logo stands on it, at its left or right, as wide as its share)
    col = n => `grid-column:${over ? 1 : n};`,
    pc = Banner.posCss(Banner.pos(s)),
    lc = Banner.posCss(Banner.logoPos(s));
  const bannerCell = pic
    ? `<div class="hcell" style="${col(left ? 2 : 1)}"><img class="homebanner"${preview ? ' id="hdrprev" draggable="false"' : ''} src="${esc(pic)}" alt=""${pc ? ` style="${pc}"` : ''}></div>`
    : '';
  const overCss = over ? `width:${Banner.logoShare(s)}%;justify-self:${Banner.logoLeft(s) ? 'start' : 'end'};` : '';
  const logoCell = `<div class="hcell hlogo${over ? ' over' : ''}" style="${col(left ? 1 : 2)}${overCss}"><img${preview ? ' id="logoprev"' : ''} src="${esc(s.clubLogo)}" alt=""${lc ? ` style="${lc}"` : ''}></div>`;
  const sizer =
    pic && !Banner.height(s)
      ? `<img class="hsizer" src="${esc(pic)}" alt="" aria-hidden="true"${preview ? ' style="max-height:110px"' : ''}>`
      : '';
  return `<div class="homehead withlogo"${preview ? ' id="hdrbox"' : ''} style="${Banner.boxCss(s)}">${sizer}${left ? logoCell + bannerCell : bannerCell + logoCell}</div>`;
}

// `icons` (only the main tabs pass it) says which line picture goes to the left of the text of a tab: { tab id: picture name from icons.js }
// (2.4.0) a page with a side list of sections (Database, Customization, App Settings): the title of the tab and what goes under it in the list (a search),
// the tab list, and the page with the name of its section as its title. sideGroups puts a small heading before the first section of each group.
const sideShellHtml = (title, tabsId, current, names, boxId, extra = '') =>
  `<div class="setupshell custshell"><nav class="custrail" aria-label="${esc(title)} sections"><div class="ssrailtitle">${esc(title)}</div>${extra}<div class="sub" id="${tabsId}" role="tablist"></div></nav><div class="custpage"><h2 class="sidetitle">${esc((names.find(t => t[0] === current) || names[0] || [0, ''])[1])}</h2><div id="${boxId}"></div></div></div>`;
function sideGroups(el, groups) {
  if (!el) return;
  el.setAttribute?.('aria-orientation', 'vertical');
  Object.entries(groups).forEach(([id, group]) => {
    const b = el.querySelector?.(`[data-id="${id}"]`);
    if (b && b.insertAdjacentHTML) b.insertAdjacentHTML('beforebegin', `<span class="sslabel" aria-hidden="true">${esc(group)}</span>`);
  });
}

function renderTabs(el, items, current, onPick, icons = {}) {
  el.innerHTML = items
    .map(([id, label, look]) =>
      look === 'racing'
        ? `<button class="tab racetab" role="tab" aria-selected="${id === current}" data-id="${id}" title="${esc(raceTabTitle())}"><span class="led on" aria-hidden="true"></span>${esc(label)}</button>`
        : look === 'onair'
          ? `<button class="tab onair" role="tab" aria-selected="${id === current}" data-id="${id}" title="Opens the Live Race on a second screen"><span class="led red" aria-hidden="true"></span>${esc(label)}</button>`
          : look === 'offair'
            ? `<button class="tab onair off" role="tab" aria-selected="${id === current}" data-id="${id}" title="No race is running. Opens the Live Race on a second screen anyway."><span class="led" aria-hidden="true"></span>${esc(label)}</button>`
            : Icons.has(icons[id])
              ? `<button class="tab hasico" role="tab" aria-selected="${id === current}" data-id="${id}">${Icons.svg(icons[id], { size: 18, cls: 'tabico' })}${esc(label)}</button>`
              : `<button class="tab" role="tab" aria-selected="${id === current}" data-id="${id}">${esc(label)}</button>`
    )
    .join('');
  el.onclick = e => {
    const b = e.target.closest('[data-id]');
    if (b) return onPick(b.dataset.id); // (a pick may ask first: the caller can wait for it)
  };
}

// ---- the race that keeps running ----
// The race screen lives in its own place on the page (#racehost, see race.js), so another tab can be shown while the race goes on: it keeps timing, counting laps and sharing
// to the Live Race pages. While another tab is shown the race is "parked" (out of sight, but still laid out and drawn). A red Race tab takes you back to it.
// A race that has not started yet (or is over and was left with the Back button) is not kept: leaving it closes it, as it always did.
const raceKept = () => !!state.race && typeof live !== 'undefined' && !!live && !!live.alive;
const RACE_WORDS = {
  ready: 'not started yet',
  countdown: 'starting',
  running: 'running',
  paused: 'paused',
  between: 'waiting for the next heat',
  review: 'waiting for you to check the laps',
  finished: 'finished'
};
const raceTabTitle = () =>
  `The race is ${RACE_WORDS[typeof live !== 'undefined' && live ? live.phase : ''] || 'on'}. Click to go back to it.`;
// The Live Race tab has two looks (1.10.1): lit (red light) while a race is on, switched off (grey, the light out) when no race is running. It opens the Live Race pages in both cases.
const tabsNow = () =>
  raceKept()
    ? [...TABS.slice(0, -1), ['race', 'Race', 'racing'], TABS[TABS.length - 1]]
    : TABS.map(t => (t[2] === 'onair' ? [t[0], t[1], 'offair'] : t));
function showRace(on) {
  // on: the Race tab is shown; otherwise the race (if there is one) is parked out of sight
  const h = document.getElementById('racehost');
  if (h) h.classList.toggle('parked', !on);
  view.hidden = !!(h && on);
  const footer = document.getElementById('app-footer'),
    credits = document.getElementById('app-credits');
  if (footer) footer.hidden = !!on;
  if (credits) {
    credits.hidden = state.tab !== 'rules';
    credits.innerHTML = state.tab === 'rules' ? Report.CREDIT.map(esc).join('<br>') : '';
  }
}

// App Settings: General and Network
// ---- searching App Settings (2.3.0, settingsindex.js): type a few words, pick a result, and the page opens with that setting in view ----
async function settingsGo(e) {
  if (e.ct && typeof connectionsTab !== 'undefined') connectionsTab = e.ct;
  state.settingsSub = settingsRoute(e.s, e.ct);
  if (e.hw) state.hwSub = e.hw;
  await renderSettings();
  if (e.k === 'page') return;
  await new Promise(r => setTimeout(r, 300)); // (some pages draw their parts a moment later)
  const box = document.getElementById('settingsbox');
  if (!box) return;
  const want = SettingsIndex.norm(e.t),
    els = [...box.querySelectorAll('label,summary,h2,h3,h4,legend,button,b,strong')],
    hit =
      els.find(x => SettingsIndex.norm(x.textContent) === want) ||
      els.find(x => SettingsIndex.norm(x.textContent).startsWith(want)) ||
      els.find(x => SettingsIndex.norm(x.textContent).includes(want));
  if (!hit) return;
  for (let d = hit.closest('details'); d; d = d.parentElement && d.parentElement.closest('details')) d.open = true;
  const topic = hit.closest('[data-gtopic]'); // (2.4.0: a setting in another topic of General opens that topic first)
  if (topic && GENERAL_TOPIC_PAGE[topic.dataset.gtopic] && GENERAL_TOPIC_PAGE[topic.dataset.gtopic] !== state.settingsSub)
    return settingsGo({ ...e, s: GENERAL_TOPIC_PAGE[topic.dataset.gtopic] }); // (2.4.0, Settings Hub: that topic is a page of its own now)
  if (topic && typeof GeneralPage !== 'undefined') GeneralPage.show(topic.dataset.gtopic);
  if (typeof SettingsRail !== 'undefined') SettingsRail.reveal(hit); // (and a section of another page that is not shown)
  const mark = hit.closest('.gs-card,.field,label,summary,.row') || hit;
  mark.scrollIntoView({ block: 'center' });
  mark.classList.add('search-hit');
  setTimeout(() => mark.classList.remove('search-hit'), 2600);
  const input =
    (hit.matches('label') && (hit.control || hit.querySelector('input,select,textarea'))) || (hit.matches('button') ? hit : null);
  if (input && typeof input.focus === 'function') input.focus({ preventScroll: true });
}
function settingsSearchBind() {
  const input = document.getElementById('settings-q'),
    list = document.getElementById('settings-hits');
  if (!input || typeof SettingsIndex === 'undefined') return;
  let hits = [],
    at = -1;
  const show = () => {
    hits = SettingsIndex.search(input.value);
    at = hits.length ? 0 : -1;
    list.hidden = !input.value.trim();
    list.innerHTML = hits.length
      ? hits
          .map(
            (h, i) =>
              `<li role="option" id="settings-hit-${i}" data-hit="${i}" aria-selected="${i === at}"><b>${esc(h.t)}</b><small>${esc(h.where)}</small></li>`
          )
          .join('')
      : '<li class="muted" role="presentation">Nothing found. Try another word.</li>';
    input.setAttribute('aria-expanded', String(!list.hidden));
    input.setAttribute('aria-activedescendant', at >= 0 ? 'settings-hit-' + at : '');
  };
  const pick = i => {
    const h = hits[i];
    if (!h) return;
    input.value = '';
    list.hidden = true;
    settingsGo(h);
  };
  input.oninput = show;
  input.onkeydown = ev => {
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      if (!hits.length) return;
      ev.preventDefault();
      at = (at + (ev.key === 'ArrowDown' ? 1 : hits.length - 1)) % hits.length;
      list.querySelectorAll('[data-hit]').forEach(li => li.setAttribute('aria-selected', String(Number(li.dataset.hit) === at)));
      input.setAttribute('aria-activedescendant', 'settings-hit-' + at);
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      pick(at);
    } else if (ev.key === 'Escape') {
      input.value = '';
      list.hidden = true;
    }
  };
  list.onmousedown = ev => {
    const li = ev.target.closest('[data-hit]');
    if (!li) return;
    ev.preventDefault(); // (the field keeps the focus until the page opens)
    pick(Number(li.dataset.hit));
  };
  input.onblur = () => setTimeout(() => (list.hidden = true), 150);
}
// the sections of App Settings: id, name and icon (2.4.0: a side list; SlotForgeRestyle.md "Settings Hub": grouped by task, an Overview first)
const SETTINGS_TABS = [
  ['overview', 'Overview', 'home'],
  ['display', 'Display and units', 'screen'],
  ['theme', 'App Theme', 'paint'],
  ['home', 'Home and club', 'home'],
  ['hardware', 'Timing Hardware', 'timing'],
  ['director', 'Race Director', 'director'],
  ['sharing', 'Share the race', 'parallel'],
  ['calculations', 'Calculations', 'sliders'],
  ['transfer', 'Backups and storage', 'database'],
  ['paddock', 'Paddock', 'garage'],
  ['packs', 'Content Packs', 'layers'],
  ['plugins', 'Plugins', 'bolt'],
  ['performance', 'Performance', 'gauge'],
  ['updates', 'Updates and help', 'bell'],
  ['help', 'Help', 'info']
];
const SETTINGS_GROUPS = {
  display: 'Look and feel',
  hardware: 'Race night',
  transfer: 'Your data',
  performance: 'This computer',
  help: 'Help'
};
// (2.4.0) the topics of the old General page, each on the page of its task (storage: Backups and storage)
const GENERAL_PAGES = { display: ['look', 'units', 'pictures'], home: ['home'], performance: ['performance'], updates: ['updates'] };
const GENERAL_TOPIC_PAGE = {
  look: 'display',
  units: 'display',
  pictures: 'display',
  home: 'home',
  performance: 'performance',
  updates: 'updates',
  storage: 'transfer'
};
// an old page (a link, a search word, a Help article) opens the page it is on now: General -> Display and units, Connections -> Share the race or Paddock
function settingsRoute(sub, ct) {
  if (sub === 'general') return 'display';
  if (sub === 'network' || sub === 'connections')
    return ['paddock', 'dealership', 'library'].includes(ct || (typeof connectionsTab !== 'undefined' ? connectionsTab : ''))
      ? 'paddock'
      : 'sharing';
  if (sub === 'contentpacks') return 'packs';
  return SETTINGS_TABS.some(t => t[0] === sub) ? sub : 'overview';
}
async function renderSettings() {
  state.settingsSub = settingsRoute(state.settingsSub);
  if (typeof ptPageDispose === 'function') ptPageDispose();
  if (typeof ppPageDispose === 'function') ppPageDispose();
  view.innerHTML = sideShellHtml(
    'App Settings',
    'settingstabs',
    state.settingsSub,
    SETTINGS_TABS,
    'settingsbox',
    '<div class="settings-search" role="search"><input type="search" id="settings-q" placeholder="Search settings…" aria-label="Search the settings" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="settings-hits" aria-autocomplete="list"><ul id="settings-hits" role="listbox" aria-label="Settings found" hidden></ul></div>'
  );
  view.firstElementChild?.classList?.add('nosidetitle'); // (every page of App Settings has its own big heading)
  settingsSearchBind();
  renderTabs(
    document.getElementById('settingstabs'),
    SETTINGS_TABS.map(([id, label]) => [id, label]),
    state.settingsSub,
    id => {
      state.settingsSub = id;
      renderSettings();
    },
    Object.fromEntries(SETTINGS_TABS.map(t => [t[0], t[2]]))
  );
  sideGroups(document.getElementById('settingstabs'), SETTINGS_GROUPS);
  // (2.4.0) the pages get a second side list with their tabs and sections (generalpage.js; General draws its own, Help has its own list)
  if (typeof SettingsRail !== 'undefined') SettingsRail.attach(document.getElementById('settingsbox'), state.settingsSub);
  if (state.settingsSub === 'plugins') return PluginsPage.render(document.getElementById('settingsbox'));
  if (state.settingsSub === 'help')
    return Help.render(document.getElementById('settingsbox'), {
      onNavigate: destination => {
        Object.assign(state, destination);
        return render();
      },
      // (2.4.0, "Help Desk") the first race ticked from your data; a setting found by the search opens where it is
      progress: typeof HelpDesk !== 'undefined' ? HelpDesk.progress() : null,
      onSetting: async e => {
        state.tab = 'settings';
        await render();
        if (typeof settingsGo === 'function') settingsGo(e);
      }
    });
  const sbox = document.getElementById('settingsbox');
  if (state.settingsSub === 'overview') return typeof SettingsOverview !== 'undefined' ? SettingsOverview.render(sbox) : null;
  if (state.settingsSub === 'transfer') return renderTransferSettings(sbox);
  if (state.settingsSub === 'packs') return typeof ContentPacksPage !== 'undefined' ? ContentPacksPage.render(sbox) : null;
  if (state.settingsSub === 'paddock')
    return typeof renderPitLane === 'function' ? renderPitLane(sbox) : typeof PaddockUI !== 'undefined' ? PaddockUI.mount(api, sbox) : null;
  if (state.settingsSub === 'sharing') return renderNetworkSettings(sbox, 'sharing');
  if (state.settingsSub === 'theme') return renderThemeSettings(document.getElementById('settingsbox'));
  if (state.settingsSub === 'director') return renderPadSettings(document.getElementById('settingsbox'));
  if (state.settingsSub === 'calculations') return renderCalculationSettings(document.getElementById('settingsbox'));
  if (state.settingsSub === 'hardware') return renderHardwareArea(document.getElementById('settingsbox'));
  return renderGeneralSettings(sbox, GENERAL_PAGES[state.settingsSub] || GENERAL_PAGES.display);
}

// App Settings > Calculations: plain-language formula library. The controls are
// deliberately named calculation methods instead of an arbitrary code editor: a
// formula must stay safe, repeatable, and understandable in saved race results.
function renderCalculationSettings(box) {
  return CalculationPage.render(box);
}

// Timing Hardware has a page per kind of hardware: the Trackmate Interface, the Arduino Sketch, DS Electronics (DS-200 / DS-300 timing), oXigen Digital (a place held for it, nothing to set up yet) and Other (empty for now).
// At the top the person chooses the timing hardware IN USE, one at a time (Hardware.timingChosen): only that one connects by itself at the start, counts laps in a race and is shown on Home and on the race screen.
// The other pages stay usable for setting up and testing; a page that is not the one in use says so and has a "Use this one" button.
async function setTimingHw(id) {
  // saves the choice and lets go of the hardware that was in use; connecting the new one and drawing the page is up to the caller
  const old = Hardware.timingChosen(state.settings);
  if (old !== id && raceKept()) {
    Dialog.alert('Finish or leave the race before changing its timing hardware.');
    return false;
  }
  state.settings = await api.setSettings({ timingHw: id });
  {
    const sel = document.getElementById('hw-use'),
      n = document.getElementById('hwnote'); // (the page may be on screen: it follows)
    if (sel) sel.value = id;
    if (n && state.hwSub === id) {
      n.hidden = true;
      n.innerHTML = '';
    }
  }
  if (old !== id) {
    try {
      if (old === 'trackmate' && typeof hw !== 'undefined' && hw.open && typeof tmClose === 'function') await tmClose();
    } catch (x) {
      /* already gone */
    }
    try {
      if (old === 'arduino' && typeof ab !== 'undefined' && ab.open && typeof abClose === 'function') await abClose();
    } catch (x) {
      /* already gone */
    }
    if (old === 'parallel' && typeof ppClose === 'function') await ppClose();
    if (old === 'plugin' && typeof ptClose === 'function') await ptClose();
    if (old === 'ds' && typeof dscClose === 'function') await dscClose();
  }
}
// Timing hardware that is connected but is not the one in use: it can be tested, but its laps never count in a race.
// (Connecting an interface on its own page does not make it the one in use; that was easy to miss and cost whole races.)
const TIMING_NAMES = {
  ds: 'DS Electronics',
  trackmate: 'Trackmate Interface',
  arduino: 'Arduino Sketch',
  parallel: 'Parallel Port',
  plugin: 'Plugin interface',
  none: 'None (keys or simulated cars)'
};
const timingConnectedNow = () => ({
  trackmate: typeof Trackmate !== 'undefined' && !!Trackmate.link?.connected,
  arduino: typeof ArduinoBox !== 'undefined' && !!ArduinoBox.link?.connected,
  parallel: typeof ParallelPort !== 'undefined' && !!ParallelPort.link?.connected,
  plugin: typeof pt !== 'undefined' && !!pt.link?.connected,
  ds: typeof DsTiming !== 'undefined' && !!DsTiming.link?.connected
});
function unusedTimingConnected(settings = state.settings) {
  const chosen = Hardware.timingChosen(settings),
    on = timingConnectedNow();
  return Object.keys(on).filter(id => on[id] && id !== chosen);
}
// ---- timing hardware that is plugged in (2.3.0, hwdetect.js): the remembered one connects by itself, another one is offered on Home ----
const hwPortUse = { trackmate: p => tmUsePort(p), arduino: p => abUsePort(p), ds: p => dscUsePort(p) };
function mountHwDetect() {
  if (typeof HwDetect === 'undefined' || state.tab !== 'home') return;
  // (2.4.0, SlotForgeRestyle.md "Plugged In") the card says why it asks, keeps a failed connect on the card, takes the DS model, and can undo "Not timing hardware"
  HwDetect.mountHome(document.getElementById('hm-detect'), {
    context: () => {
      const chosen = Hardware.timingChosen(state.settings);
      return { chosen, chosenOn: !!timingConnectedNow()[chosen], names: TIMING_NAMES, lastUsed: hwLastUsed };
    },
    async use(id, offer, o = {}) {
      if (raceKept()) {
        await Dialog.alert('Finish or leave the race before changing its timing hardware.');
        return { ok: true };
      }
      const patch = { [HwDetect.KEYS[id]]: { vid: offer.info.usbVendorId, pid: offer.info.usbProductId, at: new Date().toISOString() } };
      if (id === 'arduino') patch.abVirtual = false;
      if (id === 'ds') patch.dsType = o.ds === 'ds200' ? 'ds200' : 'ds300'; // (the model, chosen on the card)
      try {
        state.settings = await api.setSettings(patch);
        if ((await setTimingHw(id)) === false) return { ok: true };
      } catch (e) {
        return { ok: false, error: String(e && e.message ? e.message : e).replace(/^.*Error: /, '') };
      }
      let ok = false,
        error = '';
      try {
        ok = await hwPortUse[id](offer.port);
      } catch (e) {
        error = e && e.message ? e.message : String(e);
      }
      if (!ok) return { ok: false, error };
      await render();
      return { ok: true };
    },
    confirmIgnore: offer =>
      Dialog.confirm(
        `Set ${HwDetect.describe(offer.info).name} aside?

Timing will not ask about it again. You can bring it back under App Settings, Timing Hardware, Forgotten devices.`,
        {
          title: 'Not timing hardware',
          ok: 'Set it aside',
          cancel: 'Keep asking'
        }
      ),
    async ignore(offer) {
      state.settings = await api.setSettings({ hwIgnored: [...new Set([...(state.settings.hwIgnored || []), offer.key])] });
    },
    async unignore(offer) {
      state.settings = await api.setSettings({ hwIgnored: (state.settings.hwIgnored || []).filter(k => k !== offer.key) });
    },
    open(id) {
      state.tab = 'settings';
      state.settingsSub = 'hardware';
      state.hwSub = id;
      render();
    },
    forgotten() {
      state.tab = 'settings';
      state.settingsSub = 'hardware';
      state.hwSub = 'forgotten';
      render();
    }
  });
}
// (2.4.0) when a remembered device was last connected, as "12 Nov" ('' when not known)
function hwLastUsed(id) {
  const d = HwDetect.KEYS[id] && state.settings[HwDetect.KEYS[id]];
  const t = d && d.at ? new Date(d.at) : null;
  return t && !isNaN(t) ? t.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';
}
// (2.4.0) a remembered device that connects: the day is noted (once a day at most)
async function hwNoteUsed(id) {
  const k = HwDetect.KEYS[id],
    d = k && state.settings[k];
  if (!d || typeof d !== 'object') return;
  const today = new Date().toISOString().slice(0, 10);
  if (String(d.at || '').slice(0, 10) === today) return;
  state.settings = await api.setSettings({ [k]: { ...d, at: new Date().toISOString() } });
}
function startHwDetect() {
  if (typeof HwDetect === 'undefined') return;
  HwDetect.start({
    context: () => {
      const chosen = Hardware.timingChosen(state.settings);
      return { settings: state.settings, chosen, open: !!timingConnectedNow()[chosen], racing: raceKept() };
    },
    connect: async (id, port) => {
      if (hwPortUse[id] && (await hwPortUse[id](port))) {
        hwNoteUsed(id).catch(() => {});
        if (['home', 'settings'].includes(state.tab) && !state.editing) render();
      }
    },
    changed: () => mountHwDetect()
  });
}
function unusedTimingText(settings = state.settings) {
  const ids = unusedTimingConnected(settings);
  if (!ids.length) return '';
  const chosen = Hardware.timingChosen(settings);
  return `${ids.map(id => TIMING_NAMES[id]).join(' and ')} ${ids.length > 1 ? 'are' : 'is'} connected but not the timing hardware in use (${TIMING_NAMES[chosen] || chosen}), so ${ids.length > 1 ? 'their' : 'its'} laps are not counted. Press Connect & use on its card in App Settings, Timing Hardware.`;
}
function renderHardwareArea(box) {
  // (2.4.0, SlotForgeRestyle.md "Timing Desk": hwdesk.js and hwdeskview.js) the overview, the interfaces as cards, every interface under one big card
  return renderTimingDesk(box);
}

// App Settings > Timing Hardware > oXigen Digital: only a place held for it. Nothing connects, nothing is saved and a race does not use it yet; the page is filled in when the support for oXigen Digital comes.
function renderOxigenSettings(box) {
  box.innerHTML = `<p class="muted"><strong>Coming.</strong> This page is the place for <strong>oXigen Digital</strong> timing. There is nothing to set up here yet: the app does not connect to anything on this page, and a race does not use it.</p>`;
}

const GENERAL_FOLDERS = ['display', 'names', 'header', 'logo', 'pictures', 'performance', 'updates'];
// the size of the interface: the window is zoomed (the Live Race window and the pages on phones are not; see UiScale)
const applyUiScale = () => {
  if (typeof api !== 'undefined' && api.setZoom) api.setZoom(UiScale.factorOf(state.settings && state.settings.uiScale));
};
// (2.4.0) the update check (update-ui.js): the name of the app in its words, what an update keeps, and where its messages go: the line under
// Updates in App Settings; elsewhere only an error, as a message window
const UPDATE_UI = {
  appName: 'Timing',
  keeps: 'your races, drivers and cars stay where they are',
  say: (message, isError) => {
    const line = document.getElementById('updatesay');
    if (line && line.isConnected) {
      line.textContent = message;
      line.classList.toggle('error', !!isError);
    } else if (isError && typeof Dialog !== 'undefined') Dialog.alert(message);
  }
};
// (2.4.0, Settings Hub) Database storage: the format, where the file is and how much room it takes; on Backups and storage
async function settingsStorageHtml() {
  const path = await api.dbPath();
  const storage = api.storageStatus ? await api.storageStatus() : { backend: 'json' };
  const mb = n => {
      if (!Number.isFinite(n)) return 'Unavailable';
      const unit = n >= 1073741824 ? [1073741824, 'GiB'] : n >= 1048576 ? [1048576, 'MiB'] : n >= 1024 ? [1024, 'KiB'] : [1, 'bytes'];
      return (n / unit[0]).toLocaleString(undefined, { maximumFractionDigits: 1 }) + ' ' + unit[1];
    },
    usage = storage.usage;
  const storageUsage = usage
    ? // (2.4.0) the three numbers as tiles, with what they mean under them
      `<div class="gs-stats" data-storage-usage><div class="gs-stat"><span>Database file</span><b>${mb(usage.physicalBytes)}</b><small>${mb(usage.reusableBytes)} of it free for reuse</small></div><div class="gs-stat"><span>Pictures and sounds</span><b>${mb(usage.media?.bytes)}</b><small>${Number(usage.media?.uniqueCount) || 0} files, used ${Number(usage.media?.count) || 0} times · sharing saves ${mb(usage.media?.savedBytes)}</small></div><div class="gs-stat"><span>Free on this disk</span><b>${mb(usage.freeBytes)}</b><small>Backups and recovery copies need room too</small></div></div><p class="muted">Deleting pictures may not make the file smaller. The totals are refreshed once a minute.</p>`
    : '';
  return {
    backend: storage.backend,
    html: `<div class="row"><strong>${storage.backend === 'sqlite' ? 'SQLite database' : 'JSON database'}</strong></div><p>Saved in: <code>${esc(path)}</code></p>${storage.backend === 'sqlite' ? '<p>Changes are saved by the SQLite worker. Any pre-conversion JSON files are retained, but no longer receive updates. Make a backup before moving to an older build.</p>' : '<p>SQLite saves individual records without rewriting the whole collection. Timing will restart, convert and verify a separate copy, then switch storage. Your original files are kept. Allow enough disk space for the original files, recovery copy and SQLite database.</p><button class="btn" id="sqliteactivate">Convert to SQLite and restart…</button>'}${storageUsage}<p id="storagemsg" role="status"></p>`
  };
}
function settingsStorageBind() {
  const $ = id => document.getElementById(id);
  if ($('sqliteactivate'))
    $('sqliteactivate').onclick = async () => {
      const button = $('sqliteactivate');
      button.disabled = true;
      try {
        const result = await api.activateSqlite();
        $('storagemsg').textContent = result.restarting ? 'Restarting to convert a verified copy…' : 'Conversion cancelled.';
      } catch (e) {
        $('storagemsg').textContent = e.message;
      } finally {
        button.disabled = false;
      }
    };
}
// only: the topics of General that this page shows (2.4.0, Settings Hub: Display and units, Home and club, Performance, Updates and help)
async function renderGeneralSettings(box, only) {
  const S = state.settings,
    hh = Banner.height(S),
    pos = Banner.pos(S),
    lpos = Banner.logoPos(S);
  const storage = api.storageStatus ? await api.storageStatus() : { backend: 'json' };
  if (box.isConnected === false) return; // (2.4.0 review: another page of App Settings was opened meanwhile; its controls are not ours)
  const us = UiScale.levelOf(S.uiScale),
    dp = Depth.levelOf(S.depth),
    su = Speed.unitOf(S),
    du = Speed.distUnitOf(S),
    pq = Picture.levelOf(S.pictureQuality),
    pic = !!S.homeHeader,
    logoOn = Banner.logoOn(S),
    hasLogo = !!S.clubLogo,
    side = Banner.logoSide(S),
    share = Banner.logoShare(S);
  // the page is made of folders, as the Results and Records page is: each opens and closes, the choice is remembered while the app runs
  const sf = (id, title, note, body) => folderHtml('general', id, title, note, `<div class="fbody">${body}</div>`);
  box.innerHTML =
    folderTools +
    sf(
      'display',
      'Display',
      'interface size ' + us + '%, speeds in ' + Speed.unitName(su) + ', distances in ' + Speed.distUnitName(du),
      `<div class="field" style="max-width:480px"><label for="uiscale">Interface size (the text, buttons and check boxes of the whole app)</label>
      <select id="uiscale">${UiScale.LEVELS.map(([k, t]) => `<option value="${k}"${k === us ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>
      <span class="muted hint">Makes everything in this window bigger, for reading from a distance or with glasses. It does not change the layouts of the race screens: they always fit the window, and the size of their widgets is set in the Layout Editor. It is only for this window: the Live Race window and the pages on phones keep their size.</span></div>
    <div class="field" style="max-width:480px"><label for="depthlevel">Depth (how much cards, buttons, folders and widgets stand up from the page)</label>
      <select id="depthlevel">${Depth.LEVELS.map(([k, t]) => `<option value="${k}"${k === dp ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>
      <span class="muted hint">A light edge on top, a thin lip underneath and a soft shadow, so a card looks a little thick and a button a little shallow. A pressed button moves down. Flat is the plain look of before, and it is a little lighter to draw, which can help on a slow computer such as a Raspberry Pi. It applies to the whole app, the Live Race pages and the widgets of your layouts, on this computer and on the devices that follow the race.</span></div>
    <div class="field" style="max-width:480px"><label for="speedunit">Speed unit in the tables (Results and Records, the PDF of a session)</label>
      <select id="speedunit">${Speed.UNITS.map(([k, t]) => `<option value="${k}"${k === su ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>
      <span class="muted hint">The average speed and the scale speed of the laps, sessions, stints and records. The Speed widget in a layout has a Unit choice of its own.</span></div>
    <div class="field" style="max-width:480px"><label for="pdfmode">PDF prints (the race report, the heat list, the standings, the racing rules, the QR code)</label>
      <select id="pdfmode"><option value="colour"${state.settings.pdfMode === 'mono' ? '' : ' selected'}>Colour</option><option value="mono"${state.settings.pdfMode === 'mono' ? ' selected' : ''}>Monochrome (saves ink)</option></select>
      <span class="muted hint">Colour keeps the page white and uses colour only in thin lines and pale tints. Monochrome uses no colour at all: the lanes are numbers in a ring, the best lap is underlined. Export to PDF of a race can change it too.</span></div>
    <div class="field" style="max-width:480px"><label for="distunit">Distance unit (the distance driven in the tables and on Home, and the lengths of a track)</label>
      <select id="distunit">${Speed.DIST_UNITS.map(([k, t]) => `<option value="${k}"${k === du ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>
      <span class="muted hint">Feet and miles show the distance in the tables and on the At a glance card in feet (up to a mile) and miles, and you type the length of a track, its lanes and its pieces in feet and inches. Everything stays saved in metres, so you can change this at any time and nothing is lost.</span></div>`
    ) +
    sf(
      'names',
      'Name and welcome',
      S.appName ? S.appName : 'the standard name',
      `<div class="field" style="max-width:360px"><label for="appname">App Name (shown at the top of the window)</label><input id="appname" type="text" maxlength="40" value="${esc(S.appName || '')}" placeholder="${DEFAULT_NAME}"></div>
    <div class="field" style="max-width:560px"><label for="welcome">Welcome Message (shown at the top of the Home tab)</label><input id="welcome" type="text" maxlength="120" value="${esc(S.welcome || '')}" placeholder="${esc(DEFAULT_WELCOME)}"><span class="muted hint">Leave it empty for the standard message.</span></div>`
    ) +
    sf(
      'header',
      'Header picture',
      pic ? 'a picture is set' : 'no picture',
      `<div class="field" style="max-width:480px"><label for="hdrfile">Header picture on the Home tab</label>
      ${homeHeaderHtml(S, true)}
      <div class="row"><input id="hdrfile" type="file" accept="image/*">${pic ? '<button class="btn" id="hdrclear">Remove picture</button>' : ''}</div>
      ${
        pic || logoOn
          ? `<div class="row"><label for="hdrh" style="min-width:5.5em">Height</label><input id="hdrh" type="range" min="5" max="60" step="1" value="${hh || Banner.DEFAULT_HEIGHT}"${hh || !pic ? '' : ' disabled'} aria-describedby="hdrhv" style="flex:1"><output id="hdrhv" for="hdrh" style="min-width:5em">${hh || !pic ? (hh || Banner.DEFAULT_HEIGHT) + '% of the width' : 'automatic'}</output>
        ${pic ? `<label class="inline"><input id="hdrauto" type="checkbox"${hh ? '' : ' checked'}> Automatic</label>` : ''}</div>
      <span class="muted hint">${pic ? 'Automatic follows the shape of the picture. A set height is a share of the window width, so the header looks the same on every screen; a picture that is taller than that is cropped.' + (logoOn ? ' The club logo beside the picture has the same height.' : '') : 'The height is a share of the window width, so the header looks the same on every screen.'}</span>`
          : ''
      }
      ${
        pic
          ? `<div class="row"><label for="hdrx" style="min-width:5.5em">Left / right</label><input id="hdrx" type="range" min="0" max="100" step="1" value="${Math.round(pos.x)}" aria-describedby="hdrxv" style="flex:1"><output id="hdrxv" for="hdrx" style="min-width:5em">${Math.round(pos.x)}%</output></div>
      <div class="row"><label for="hdry" style="min-width:5.5em">Up / down</label><input id="hdry" type="range" min="0" max="100" step="1" value="${Math.round(pos.y)}" aria-describedby="hdryv" style="flex:1"><output id="hdryv" for="hdry" style="min-width:5em">${Math.round(pos.y)}%</output></div>
      <div class="row"><button class="btn" id="hdrcenter">Center the picture</button></div>
      <span class="muted hint">Drag the picture, or use the sliders, to choose which part of it shows. It can only move in the direction in which it is cropped; a slider is greyed out when nothing is cropped that way.</span>`
          : ''
      }</div>`
    ) +
    sf(
      'logo',
      'Club logo',
      !hasLogo ? 'no logo yet' : logoOn ? 'shown on the Home tab' : 'not on the Home tab',
      `<div class="field" style="max-width:480px"><label for="logofile">Club logo</label>
      ${hasLogo && !logoOn ? `<img class="optimg" id="logothumb" src="${esc(S.clubLogo)}" alt="Your club logo">` : ''}
      <div class="row"><input id="logofile" type="file" accept="image/*">${hasLogo ? '<button class="btn" id="logoclear">Remove logo</button>' : ''}</div>
      <span class="muted hint">Shown on the Home tab if you choose a side below, and by every Logo widget in a layout that has no logo picture of its own.</span>
      ${hasLogo ? `<div class="row"><label for="logoside" style="min-width:5.5em">On the Home tab</label><select id="logoside"><option value=""${side ? '' : ' selected'}>Not shown</option><option value="left"${side === 'left' ? ' selected' : ''}>Left of the header picture</option><option value="right"${side === 'right' ? ' selected' : ''}>Right of the header picture</option><option value="over-left"${side === 'over-left' ? ' selected' : ''}>On the header picture, at the left</option><option value="over-right"${side === 'over-right' ? ' selected' : ''}>On the header picture, at the right</option></select></div>` : ''}
      ${
        logoOn
          ? `<div class="row"><label for="logow" style="min-width:5.5em">Width</label><input id="logow" type="range" min="10" max="50" step="1" value="${share}" aria-describedby="logowv" style="flex:1"><output id="logowv" for="logow" style="min-width:5em">${share}% of the header</output></div>
      <div class="row"><label for="logox" style="min-width:5.5em">Left / right</label><input id="logox" type="range" min="0" max="100" step="1" value="${Math.round(lpos.x)}" aria-describedby="logoxv" style="flex:1"><output id="logoxv" for="logox" style="min-width:5em">${Math.round(lpos.x)}%</output></div>
      <div class="row"><label for="logoy" style="min-width:5.5em">Up / down</label><input id="logoy" type="range" min="0" max="100" step="1" value="${Math.round(lpos.y)}" aria-describedby="logoyv" style="flex:1"><output id="logoyv" for="logoy" style="min-width:5em">${Math.round(lpos.y)}%</output></div>
      <div class="row"><button class="btn" id="logocenter">Center the logo</button></div>
      <span class="muted hint">The logo is always shown whole, as large as its space allows, and takes its height from the header. Its width is a share of the header: beside the picture, the picture gets the rest; on the picture, the picture fills the whole header and the logo stands on it. The sliders move the logo inside its space: a slider is greyed out when the logo already fills it that way.</span>`
          : ''
      }</div>`
    ) +
    sf(
      'pictures',
      'Pictures',
      (Picture.LEVELS.find(l => l[0] === pq) || [0, ''])[1],
      `<div class="field" style="max-width:480px"><label for="picq">Quality of the pictures you upload (drivers, slotcars, widgets, picture sets, logo, header)</label>
      <select id="picq">${Picture.LEVELS.map(([k, t]) => `<option value="${k}"${k === pq ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>
      <span class="muted hint">Original keeps a picture exactly as you uploaded it, with its transparency (only a picture over 4000 px or 12 MB is made smaller). Pictures are saved inside the database file, so many large originals make the database bigger and the app slower to open, especially on a small computer such as a Raspberry Pi: choose High or Standard then. This applies to pictures you upload from now on; pictures that are already saved stay as they are.</span></div>`
    ) +
    sf(
      'performance',
      'Performance',
      'how the computer and the app are doing',
      `<div class="field" style="max-width:640px"><label class="inline"><input id="layerswitch" type="checkbox"${Depth.layersOn(S) ? ' checked' : ''}> Draw the changing text of each widget on its own layer</label>
      <span class="muted hint">Makes the race screen much lighter for the graphics card, most of all on a slow computer such as a Raspberry Pi: when a number changes, only that number is drawn again, not the whole page with every shadow. The look stays the same, but text can be a little softer on some Windows computers: switch this off if you see that. It applies to the race screen and the Live Race pages.</span></div>
      <div class="field" style="max-width:640px"><label class="inline"><input id="bgsave" type="checkbox"${S.backgroundSave === false ? '' : ' checked'}> Save changes to the database in the background</label>
      <span class="muted hint">When you save a driver, a slotcar, a race setup or a finished race, the whole database file is written again. With big pictures that takes a third of a second or more, and the program used to stand still for that time. In the background the program goes on while the file is written, and the change is on the disk when the screen says it is saved. Switch this off to go back to the old way (the program waits for the disk).</span></div>
      <div class="field" style="max-width:640px"><label class="inline"><input id="perfswitch" type="checkbox"${S.perfLine ? ' checked' : ''}> Show the Performance line on the race screen</label>
      <span class="muted hint">A small line under the buttons of the race screen: how many frames a second the window draws, how long a screen update takes, the CPU the app uses (window, graphics and the core of the app) and how long the core was stuck. Nothing is measured while it is off.</span></div>
      <div class="field"><label for="perfout">Report (updated every second while this folder is open)</label>
      <pre id="perfout" class="perfout" tabindex="0">measuring...</pre>
      <div class="row"><button class="btn" id="perfcopy" type="button">Copy report</button><span id="perfmsg" class="muted" role="status"></span></div>
      <span class="muted hint">Open the race screen with a race running while you look at this, or leave the line on and look at it during a race. If the Raspberry Pi gets slow, copy the report and send it: it shows whether the window is drawn by the graphics card or by the processor, how hot the processor is, and what the app is busy with. Measuring costs a little itself.</span></div>`
    ) +
    sf(
      'updates',
      'Updates and diagnostics',
      'new versions, a file for bug reports',
      `<div class="field" id="updatehost"></div><p class="muted" id="updatesay" role="status"></p>
      <div class="field" style="max-width:640px"><label>Diagnostics</label>
      <span class="muted hint">Saves one text file that helps with a bug report: the app and system versions, the timing hardware and connections, the storage, the settings (without passwords, names or pictures) and recent errors. Look it over before you send it to anyone.</span>
      <div class="row"><button type="button" class="btn" id="diagsave">Save diagnostics…</button></div><p class="muted" id="diagmsg" role="status"></p>
      <div class="field" style="max-width:560px"><label>Setup guide</label><div class="row"><button type="button" class="btn" id="guiderun">Start the setup guide again</button></div><span class="muted hint">Walks through a track, drivers, cars, the timing hardware, a sensor test and a 3-lap test race, on Home. What you already have stays.</span></div></div>`
    );
  // (2.4.0) General has a second side list with its topics and a canvas of its own (generalpage.js), not the sheet of the other pages
  if (typeof GeneralPage !== 'undefined') GeneralPage.build(box, only);
  else if (typeof AppSettingsPage !== 'undefined') AppSettingsPage.enhance(box, 'general');
  folderWire(box);
  box.onclick = ev => {
    const fa = ev.target && ev.target.closest ? ev.target.closest('[data-folderall]') : null;
    if (fa) {
      folderAll('general', GENERAL_FOLDERS, fa.dataset.folderall === '1');
      renderGeneralSettings(box);
    }
  };
  const $ = id => document.getElementById(id);
  if (storage.backend === 'sqlite') {
    $('bgsave').disabled = true;
    $('bgsave').closest('.field').querySelector('.hint').textContent =
      'SQLite always writes through a background worker. This legacy JSON setting does not apply.';
  }
  // (2.4.0) Updates: the update check of every SlotForge app (update-ui.js), its section in this page
  if ($('updatehost') && typeof UpdateUI !== 'undefined') UpdateUI.start({ settings: $('updatehost'), ...UPDATE_UI });
  if ($('guiderun'))
    $('guiderun').onclick = async () => {
      state.settings = await api.setSettings({ setupGuide: { step: 0 } });
      state.tab = 'home';
      await render();
    };
  if ($('diagsave'))
    $('diagsave').onclick = async () => {
      $('diagsave').disabled = true;
      $('diagmsg').textContent = '';
      try {
        const r = await api.diagnosticsSave();
        $('diagmsg').textContent = r && r.saved ? 'Saved: ' + r.path : '';
      } catch (error) {
        $('diagmsg').textContent = 'Could not save the diagnostics: ' + error.message;
      } finally {
        $('diagsave').disabled = false;
      }
    };
  $('uiscale').onchange = async ev => {
    state.settings = await api.setSettings({ uiScale: UiScale.levelOf(ev.target.value) });
    applyUiScale();
    renderSettings();
  };
  $('depthlevel').onchange = async ev => {
    state.settings = await api.setSettings({ depth: Depth.levelOf(ev.target.value) });
    applyDepth();
    renderSettings();
  };
  $('speedunit').onchange = async ev => {
    state.settings = await api.setSettings({ speedUnit: Speed.unitOf({ speedUnit: ev.target.value }) });
    renderSettings();
  };
  $('pdfmode').onchange = async ev => {
    state.settings = await api.setSettings({ pdfMode: ev.target.value === 'mono' ? 'mono' : 'colour' });
    renderSettings();
  };
  $('distunit').onchange = async ev => {
    state.settings = await api.setSettings({ distanceUnit: Speed.distUnitOf({ distanceUnit: ev.target.value }) });
    renderSettings();
  };
  $('bgsave').onchange = async ev => {
    state.settings = await api.setSettings({ backgroundSave: !!ev.target.checked });
  }; // (1.61.2: the core reads it from the settings at once)
  $('layerswitch').onchange = async ev => {
    state.settings = await api.setSettings({ widgetLayers: !!ev.target.checked });
    applyLayers();
  }; // (the page is not drawn again: the style sheet does the rest)
  $('perfswitch').onchange = async ev => {
    state.settings = await api.setSettings({ perfLine: !!ev.target.checked });
  }; // (the page is not drawn again: the report goes on)
  if (typeof PerfUI !== 'undefined') PerfUI.panel({ out: $('perfout'), copy: $('perfcopy'), msg: $('perfmsg') });
  $('picq').onchange = async ev => {
    state.settings = await api.setSettings({ pictureQuality: Picture.levelOf(ev.target.value) });
    renderSettings();
  };
  $('appname').onchange = async ev => {
    state.settings = await api.setSettings({ appName: ev.target.value.trim() });
    applyName();
  };
  $('welcome').onchange = async ev => {
    state.settings = await api.setSettings({ welcome: ev.target.value.trim() });
  };
  $('hdrfile').onchange = async ev => {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    try {
      state.settings = await api.setSettings({ homeHeader: await resizeImage(f, 1600), homeHeaderPos: { x: 50, y: 50 } });
    } catch (x) {
      Dialog.alert(x.message);
    }
    renderSettings();
  };
  if (pic)
    $('hdrclear').onclick = async () => {
      state.settings = await api.setSettings({ homeHeader: '' });
      renderSettings();
    };
  $('logofile').onchange = async ev => {
    // shrunk, and transparency is kept
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    try {
      state.settings = await api.setSettings({ clubLogo: await resizeImage(f, 600, true), homeLogoPos: { x: 50, y: 50 } });
    } catch (x) {
      Dialog.alert(x.message);
    }
    renderSettings();
  };
  if (hasLogo)
    $('logoclear').onclick = async () => {
      state.settings = await api.setSettings({ clubLogo: '' });
      renderSettings();
    };
  if (hasLogo)
    $('logoside').onchange = async ev => {
      state.settings = await api.setSettings({ homeLogoSide: ev.target.value });
      renderSettings();
    };
  if (!pic && !logoOn) return;
  // The Home header and the logo: what is changed is shown while a control moves or the picture is dragged, and saved when it is let go
  const at = (on, id) => (on ? $(id) : null); // the controls that were drawn
  const prev = at(pic, 'hdrprev'),
    hbox = at(logoOn, 'hdrbox'),
    lprev = at(logoOn, 'logoprev'),
    slider = at(true, 'hdrh'),
    auto = at(pic, 'hdrauto'),
    px = at(pic, 'hdrx'),
    py = at(pic, 'hdry'),
    lw = at(logoOn, 'logow'),
    lx = at(logoOn, 'logox'),
    ly = at(logoOn, 'logoy');
  let cur = pos,
    lcur = lpos,
    grab = null,
    movable = false; // the positions being shown; while the picture is dragged: where the pointer and the picture were at the start; whether the picture can be moved at all
  const sizes = () => ({ box: { w: prev.clientWidth, h: prev.clientHeight }, natural: { w: prev.naturalWidth, h: prev.naturalHeight } });
  const draft = () => ({
    ...state.settings,
    homeHeaderHeight: slider ? (auto && auto.checked ? '' : slider.value) : state.settings.homeHeaderHeight,
    homeHeaderPos: cur,
    homeLogoShare: lw ? lw.value : state.settings.homeLogoShare,
    homeLogoPos: lcur
  });
  const show = () => {
    // the pictures, the sliders and the cursor follow the height, the width of the logo and the positions
    const d = draft();
    if (hbox) hbox.style.cssText = Banner.boxCss(d);
    if (prev) prev.style.cssText = hbox ? Banner.posCss(cur) : Banner.css(d, 'max-height:110px');
    if (lprev) lprev.style.cssText = Banner.posCss(lcur);
    if (px) {
      const z = sizes(),
        room = Banner.overflow(z.box, z.natural); // how far the picture sticks out of its box: only that can move
      px.value = cur.x;
      py.value = cur.y;
      $('hdrxv').textContent = Math.round(cur.x) + '%';
      $('hdryv').textContent = Math.round(cur.y) + '%';
      px.disabled = room.x < 1;
      py.disabled = room.y < 1;
      movable = room.x >= 1 || room.y >= 1;
      prev.classList.toggle('movable', movable);
    }
    if (lx) {
      const room = Banner.logoRoom({ w: lprev.clientWidth, h: lprev.clientHeight }, { w: lprev.naturalWidth, h: lprev.naturalHeight }); // how much space the whole logo leaves in its box: only that can move
      lx.value = lcur.x;
      ly.value = lcur.y;
      $('logoxv').textContent = Math.round(lcur.x) + '%';
      $('logoyv').textContent = Math.round(lcur.y) + '%';
      lx.disabled = room.x < 1;
      ly.disabled = room.y < 1;
    }
  };
  const savePos = async () => {
    state.settings = await api.setSettings({ homeHeaderPos: { ...cur } });
  };
  const saveLogoPos = async () => {
    state.settings = await api.setSettings({ homeLogoPos: { ...lcur } });
  };
  if (prev) prev.onload = show;
  if (lprev) lprev.onload = show;
  show(); // (if a picture is not ready yet, show runs again when it is)
  folderWire(box, show); // (a folder that is closed has no size: the preview is measured again when one is opened)
  if (slider) {
    slider.oninput = () => {
      $('hdrhv').textContent = slider.value + '% of the width';
      show();
    };
    slider.onchange = async () => {
      state.settings = await api.setSettings({ homeHeaderHeight: Number(slider.value) });
    };
  }
  if (auto)
    auto.onchange = async () => {
      state.settings = await api.setSettings({ homeHeaderHeight: auto.checked ? '' : Number(slider.value) });
      renderSettings();
    };
  if (px) {
    px.oninput = () => {
      cur = { ...cur, x: Number(px.value) };
      show();
    };
    px.onchange = savePos;
    py.oninput = () => {
      cur = { ...cur, y: Number(py.value) };
      show();
    };
    py.onchange = savePos;
    $('hdrcenter').onclick = () => {
      cur = { x: 50, y: 50 };
      show();
      savePos();
    };
    prev.onpointerdown = ev => {
      if (ev.button || !movable) return;
      grab = { x: ev.clientX, y: ev.clientY, from: cur, ...sizes() };
      prev.setPointerCapture(ev.pointerId);
      prev.classList.add('dragging');
    };
    prev.onpointermove = ev => {
      if (grab) {
        cur = Banner.drag(grab.box, grab.natural, grab.from, ev.clientX - grab.x, ev.clientY - grab.y);
        show();
      }
    };
    prev.onpointerup = prev.onpointercancel = () => {
      if (grab) {
        grab = null;
        prev.classList.remove('dragging');
        savePos();
      }
    };
  }
  if (lw) {
    lw.oninput = () => {
      $('logowv').textContent = lw.value + '% of the header';
      show();
    };
    lw.onchange = async () => {
      state.settings = await api.setSettings({ homeLogoShare: Number(lw.value) });
    };
    lx.oninput = () => {
      lcur = { ...lcur, x: Number(lx.value) };
      show();
    };
    lx.onchange = saveLogoPos;
    ly.oninput = () => {
      lcur = { ...lcur, y: Number(ly.value) };
      show();
    };
    ly.onchange = saveLogoPos;
    $('logocenter').onclick = () => {
      lcur = { x: 50, y: 50 };
      show();
      saveLogoPos();
    };
  }
}

let connectionsTab = 'race';
async function renderConnectionsSettings(box) {
  // Preserve the stored network route and its existing race-sharing settings.
  if (box.nodeType !== 1) return renderNetworkSettings(box);
  box.innerHTML = '<div class="sub connections-tabs" role="tablist" aria-label="Connections"></div><div data-connections-body></div>';
  const body = box.querySelector('[data-connections-body]');
  // (2.4.0, "Paddock Pit Lane") Dealership Mode and Shared Library are one page: Paddock
  if (['dealership', 'library'].includes(connectionsTab)) connectionsTab = 'paddock';
  renderTabs(
    box.querySelector('.connections-tabs'),
    [
      ['race', 'Race Sharing'],
      ['paddock', 'Paddock']
    ],
    connectionsTab,
    id => {
      connectionsTab = id;
      renderConnectionsSettings(box);
    }
  );
  if (connectionsTab === 'paddock') return typeof renderPitLane === 'function' ? renderPitLane(body) : PaddockUI.mount(api, body);
  return renderNetworkSettings(body);
}

// (audit 2.2.5, #14) The race results the shared library could not take: a result refused after a restore of the library (it holds another version
// of the race), changes from before a restore that are held, or another error. Retry offers the ones that can be sent again.
async function renderSharedLibraryResults(box, note = '') {
  let view;
  try {
    view = await api.libraryResults();
  } catch (error) {
    box.innerHTML = `<p class="err">Could not read the shared race results: ${esc(error.message)}</p>`;
    return;
  }
  if (!box.isConnected && box.isConnected !== undefined) return;
  if (typeof homeLibraryWaiting !== 'undefined') homeLibraryWaiting = view.results.length; // (2.4.0: the light in the main menu follows right away, after a Retry or a Remove)
  const rows = view.results
    .map(
      r =>
        `<div class="paddock-delivery" data-library-result><b>${esc(r.name)}</b><span>${r.status === 'attention' ? 'Needs attention' : 'Waiting to send again'}</span>${r.error ? `<p>${esc(r.error)}</p>` : ''}${r.removable && api.libraryResultsRemove ? `<button type="button" class="btn small" data-library-remove="${esc(r.sessionId)}" title="The race stays in Timing; only its copy for the shared library is dropped">Remove from this list</button>` : ''}</div>`
    )
    .join('');
  box.innerHTML = `<section data-settings-group="library-results"><h3>Race results in the shared library</h3><p class="muted">Finished races are sent to the shared slotcar library by themselves. A result that could not be sent is listed here with the reason.</p>
    ${view.deliveryError ? `<p class="paddock-warning" data-library-error>Last delivery attempt: ${esc(view.deliveryError)}</p>` : ''}
    ${rows || '<p class="muted" data-library-none>All race results have been sent.</p>'}
    <div class="row"><button class="btn" data-library-retry ${rows ? '' : 'disabled'}>Retry</button></div><p data-library-msg role="status">${esc(note)}</p></section>`;
  const b = box.querySelector('[data-library-retry]');
  b.onclick = async () => {
    b.disabled = true;
    const m = box.querySelector('[data-library-msg]');
    if (m) m.textContent = 'Working…';
    let msg;
    try {
      const r = await api.libraryResultsRetry();
      const conv = r?.converted ? `Converted ${r.converted} race${r.converted === 1 ? '' : 's'} again. ` : '',
        still = r?.failed
          ? `${r.failed} race${r.failed === 1 ? '' : 's'} still cannot be converted: remove ${r.failed === 1 ? 'it' : 'them'} from this list, or keep ${r.failed === 1 ? 'it' : 'them'} for a later version. `
          : '';
      msg = r?.background
        ? conv + still + 'Sending goes on by itself: this list shows it when it is done.'
        : r?.deferred
          ? conv + still + 'Results are sent after the race.'
          : conv + still + `Sent ${r?.sent || 0} of ${r?.offered || 0} result${r?.offered === 1 ? '' : 's'} offered again.`;
    } catch (error) {
      msg = 'Retry failed: ' + error.message;
    }
    await renderSharedLibraryResults(box, msg);
  };
  box.querySelectorAll('[data-library-remove]').forEach(x => {
    x.onclick = async () => {
      if (
        !(await Dialog.confirm(
          'Remove this race from the shared library list? The race stays in Timing; it is only not sent to the shared library.',
          { ok: 'Remove', danger: true }
        ))
      )
        return;
      x.disabled = true;
      let msg;
      try {
        await api.libraryResultsRemove(x.dataset.libraryRemove);
        msg = 'Removed from the list. The race stays in Timing.';
      } catch (error) {
        msg = 'Could not remove it: ' + error.message;
      }
      await renderSharedLibraryResults(box, msg);
    };
  });
}

// (2.4.0, Settings Hub) the password, pairing a phone and the warning: a part of the Race Director page ("Phones and tablets")
function netAccessHtml() {
  const S = state.settings || {};
  return `<section data-settings-group="phones"><h3>Phones and tablets</h3><p class="muted">The Race Director page on a phone or tablet: the same pads, penalties and review as on this computer. Sharing must be on, under Share the race: it is ${S.netOn ? `on, port ${esc(S.netPort || 8787)}` : 'off'}.</p>
    ${netAccessBody()}</section>`;
}
function netAccessBody() {
  return `<div class="settings-network-fields"><div class="field"><label for="net-pass">Password for the Race Director</label><input id="net-pass" type="text" maxlength="40" value="${esc(state.settings.netPassword || '')}" placeholder="none: the Race Director stays on this computer"></div></div><p class="muted">Leave this empty to keep Race Director controls on this computer. Other devices can still watch when sharing is enabled.</p>
    <div class="row"><button type="button" class="btn" id="net-pairbtn">Pair a phone…</button><span class="muted">A QR code that logs one phone or tablet in to the Race Director, without typing the password.</span></div><div id="net-pair"></div>
    <p class="muted net-warn">The connection is not encrypted (http), as with most club timing programs: use it on your own club or home wifi, not on a public network. Anyone on the same wifi can watch the race, and could see the password while it is typed; pairing by QR code keeps the password off the phone.</p>`;
}
// part: 'sharing' (Share the race: sharing and the devices), 'phones' (only the bindings of Phones and tablets, drawn by the Race Director page), or all
async function renderNetworkSettings(box, part = 'all') {
  if (part === 'phones') return bindNetAccess(async () => {});
  box.innerHTML = `<section data-settings-group="sharing"><h3>Share the race</h3><p class="muted">Let tablets and phones on your wifi follow the race in a browser: race timing, leaderboard, driver stats and the other Live Race pages. They can only watch. The Race Director page on a phone needs a password: ${part === 'sharing' ? 'set it under Race Director › Phones and tablets.' : 'see below.'}</p>
    <div class="field"><label class="inline"><input id="net-on" type="checkbox" ${state.settings.netOn ? 'checked' : ''}> Share on my network</label></div>
    <div class="settings-network-fields"><div class="field"><label for="net-port">Port</label><input id="net-port" type="number" min="1" max="65535" value="${esc(state.settings.netPort || 8787)}" style="width:7em"></div></div></section>
    ${part === 'sharing' ? '' : `<section data-settings-group="access"><h3>Director access</h3>${netAccessBody()}</section>`}
    <section data-settings-group="devices"><h3>Connect devices</h3><p class="muted">While sharing is enabled, this folder shows this computer’s addresses and QR codes.</p><div id="net-info"></div></section>`;
  if (typeof AppSettingsPage !== 'undefined') AppSettingsPage.enhance(box, 'network');
  if (box.addEventListener && !box._goBound) {
    box._goBound = true;
    box.addEventListener('click', ev => {
      const g = ev.target.closest && ev.target.closest('[data-settings-go]');
      if (!g) return;
      state.settingsSub = g.dataset.settingsGo;
      renderSettings();
    });
  }
  const netInfo = async () => {
    const el = document.getElementById('net-info');
    if (!el) return;
    const st = api.netStatus ? await api.netStatus() : null;
    if (!st) {
      el.innerHTML = '';
      return;
    }
    el.innerHTML = st.error
      ? `<p class="error" role="alert">${esc(st.error)}</p>`
      : !st.on
        ? ''
        : `<p>Open one of these addresses on the other device, or scan its QR code:</p>
      <div class="netlist">${st.urls.length ? st.urls.map((u, i) => `<div class="netaddr"><div class="netqr">${u.svg}</div><code>${esc(u.url)}</code><button class="btn" data-qrpdf="${i}">Save QR code as PDF</button></div>`).join('') : '<p class="muted">No wifi or network connection was found on this computer.</p>'}</div>
      ${st.passwordSet ? '' : '<p class="muted">No password is set, so the Race Director page is closed to other devices.</p>'}
      <p id="net-msg" class="muted" role="status"></p>
      <p class="muted">The first time, Windows may ask whether the app can use the network: allow it on private networks.</p>`;
  };
  document.getElementById('net-info').onclick = async ev => {
    // print-ready QR code
    const b = ev.target.closest('[data-qrpdf]');
    if (!b) return;
    const st = api.netStatus ? await api.netStatus() : null,
      u = st && st.urls && st.urls[Number(b.dataset.qrpdf)],
      msg = document.getElementById('net-msg');
    if (!u) return;
    msg.textContent = 'Making the PDF...';
    try {
      const name = (state.settings.appName || '').trim() || DEFAULT_NAME;
      const res = await api.exportPdf(
        Report.qrHtml({ mono: state.settings.pdfMode === 'mono', title: name + ' – Live Race', url: u.url, svg: u.svg }),
        'QR code live race.pdf'
      );
      msg.textContent = res && res.saved ? 'Saved: ' + res.path : 'Not saved.';
    } catch (x) {
      msg.textContent = 'Could not make the PDF: ' + x.message;
    }
  };
  const setNet = async patch => {
    state.settings = await api.setSettings(patch);
    await netInfo();
  };
  bindNetAccess(netInfo);
  document.getElementById('net-on').onchange = ev => setNet({ netOn: ev.target.checked });
  document.getElementById('net-port').onchange = ev => {
    const n = Math.round(Number(ev.target.value));
    setNet({ netPort: n >= 1 && n <= 65535 ? n : 8787 });
    if (!(n >= 1 && n <= 65535)) ev.target.value = 8787;
  };
  netInfo();
}
// the password and pairing a phone (Phones and tablets on the Race Director page; Director access on the old Connections page)
function bindNetAccess(after) {
  if (!document.getElementById('net-pairbtn')) return;
  const setNet = async patch => {
    state.settings = await api.setSettings(patch);
    if (after) await after();
  };
  // (2.3.0) pairing by QR code: one code for every address of this computer, once, for 10 minutes
  let pairTimer = null;
  document.getElementById('net-pairbtn').onclick = async () => {
    const el = document.getElementById('net-pair');
    clearInterval(pairTimer);
    try {
      const p = await api.netPair();
      if (p.error) {
        el.innerHTML = `<p class="error" role="alert">${esc(p.error)}</p>`;
        return;
      }
      el.innerHTML = `<div class="card net-paircard"><strong>Scan this with the phone's camera</strong><p class="muted">It opens the Race Director, logged in. One phone, once; it stays logged in for 12 hours. <span id="net-pairleft"></span></p>
        <div class="netlist">${p.urls.length ? p.urls.map(u => `<div class="netaddr"><div class="netqr">${u.svg}</div><code>${esc(u.url.replace(/#pair=.*/, ''))}</code></div>`).join('') : '<p class="muted">No wifi or network connection was found on this computer.</p>'}</div>
        <div class="row"><button type="button" class="btn" id="net-pairdone">Done</button><button type="button" class="btn" id="net-pairnew">Another phone</button></div></div>`;
      const left = () => {
        const n = Math.round((Date.parse(p.expiresAt) - Date.now()) / 1000),
          t = document.getElementById('net-pairleft');
        if (!t) return clearInterval(pairTimer);
        if (n <= 0) {
          clearInterval(pairTimer);
          el.innerHTML = '<p class="muted">The QR code has expired. Press Pair a phone for a new one.</p>';
        } else t.textContent = `Valid for ${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}.`;
      };
      left();
      pairTimer = setInterval(left, 1000);
      document.getElementById('net-pairdone').onclick = () => {
        clearInterval(pairTimer);
        el.innerHTML = '';
      };
      document.getElementById('net-pairnew').onclick = () => document.getElementById('net-pairbtn').click();
    } catch (e) {
      el.innerHTML = `<p class="error" role="alert">Could not make a QR code: ${esc(e.message)}</p>`;
    }
  };
  document.getElementById('net-pass').onchange = ev => setNet({ netPassword: ev.target.value });
}

// Racing Rules: one text for the whole app (a club's code of conduct, for example) with a little formatting, saved as you type.
const RULE_SIZES = [
  ['2', 'Small'],
  ['3', 'Normal'],
  ['5', 'Large'],
  ['6', 'Extra large']
];
async function renderRules() {
  // (2.4.0) the rules are a document: a header (title, saved, Export to PDF), then a sheet with the toolbar on top and the text under it
  const tool = (cmd, label, inner, title = label) =>
    `<button class="rte-b" type="button" data-cmd="${cmd}" title="${esc(title)}" aria-label="${esc(label)}">${inner}</button>`;
  view.innerHTML = `<div class="rulespage">
    <div class="rules-head"><div class="rules-title"><span class="rules-eyebrow">${Icons.svg('rules', { size: 14 })}Club handbook</span><h2>Racing Rules</h2>
      <p class="muted">General rules for racing, for example your club's code of conduct. They are saved as you type, and Export to PDF makes a page to print or share.</p></div>
      <div class="rules-actions"><span id="rulesmsg" class="rules-saved" role="status"></span>${pdfButton('id="rules-pdf"')}</div></div>
    <div class="rules-sheet">
      <div class="rte-bar" id="rte-bar" role="toolbar" aria-label="Text formatting">
        <span class="rte-group">${tool('undo', 'Undo', '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3"/></svg>', 'Undo (Ctrl+Z)')}${tool('redo', 'Redo', '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3"/></svg>', 'Redo (Ctrl+Y)')}</span>
        <span class="rte-group"><select id="rte-block" aria-label="Paragraph style"><option value="">Paragraph style</option><option value="div">Normal text</option><option value="h2">Heading</option><option value="h3">Subheading</option><option value="blockquote">Quote</option></select></span>
        <span class="rte-group">${tool('bold', 'Bold', '<b>B</b>')}${tool('italic', 'Italic', '<i>I</i>')}${tool('underline', 'Underline', '<u>U</u>')}${tool('strikeThrough', 'Strikethrough', '<s>S</s>')}</span>
        <span class="rte-group"><select id="rte-size" aria-label="Text size"><option value="">Text size</option>${RULE_SIZES.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select>
          <label class="rte-colour" title="Text colour"><input type="color" id="rte-color" value="#d62828" aria-label="Text colour"><span>Colour</span></label>
          <label class="rte-colour" title="Highlight the text"><input type="color" id="rte-mark" value="#f2b84b" aria-label="Highlight colour"><span>Highlight</span></label></span>
        <span class="rte-group">${tool('justifyLeft', 'Align left', '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h10M4 18h14"/></svg>')}${tool('justifyCenter', 'Centre', '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M5 18h14"/></svg>')}${tool('justifyRight', 'Align right', '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M10 12h10M6 18h14"/></svg>')}</span>
        <span class="rte-group">${tool('insertUnorderedList', 'Bulleted list', '&bull; List')}${tool('insertOrderedList', 'Numbered list', '1. List')}${tool('outdent', 'Less indent', '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M20 6H9M20 12h-8M20 18H9M7 9l-3 3 3 3"/></svg>')}${tool('indent', 'More indent', '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M20 6H9M20 12h-8M20 18H9M4 9l3 3-3 3"/></svg>')}${tool('insertHorizontalRule', 'Line', '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 12h18"/></svg>', 'A line across the page')}</span>
        <span class="rte-group rte-end">${tool('removeFormat', 'Clear formatting', 'Clear formatting')}</span></div>
      <div id="rules" class="rules rte" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Racing rules" data-placeholder="Write your racing rules here. For example: Always leave room for the other car. A deslot is put back by the marshal nearest to it.">${RichText.clean(state.settings.rules || '')}</div>
      <div class="rules-foot"><span id="rulescount"></span></div>
    </div></div>`;
  const box = document.getElementById('rules'),
    msg = document.getElementById('rulesmsg'),
    bar = document.getElementById('rte-bar');
  let timer = null,
    range = null;
  const save = async () => {
    clearTimeout(timer);
    timer = null;
    state.settings = await api.setSettings({ rules: RichText.clean(box.innerHTML) });
    msg.textContent = 'Saved.';
  };
  const count = () => {
    const el = document.getElementById('rulescount'),
      n = String(box.textContent || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;
    if (el) el.textContent = n ? `${n} ${n === 1 ? 'word' : 'words'}` : '';
  };
  count();
  const changed = () => {
    state.settings.rules = RichText.clean(box.innerHTML);
    count();
    msg.textContent = 'Saving...';
    clearTimeout(timer);
    timer = setTimeout(save, 600);
  };
  // the colour picker and the size list take the focus: remember where the selection was and put it back before formatting
  const keep = () => {
    const sel = window.getSelection && window.getSelection();
    if (sel && sel.rangeCount && box.contains(sel.anchorNode)) range = sel.getRangeAt(0).cloneRange();
  };
  const restore = () => {
    box.focus();
    const sel = window.getSelection && window.getSelection();
    if (sel && range) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
  };
  const exec = (cmd, val) => {
    restore();
    try {
      document.execCommand('styleWithCSS', false, false);
    } catch {
      /* not supported */
    }
    document.execCommand(cmd, false, val);
    keep();
    changed();
  };
  box.onkeyup = keep;
  box.onmouseup = keep;
  box.onblur = () => {
    keep();
    if (timer) save();
  }; // leaving the box (or the tab) saves straight away
  box.oninput = changed;
  box.onpaste = ev => {
    ev.preventDefault();
    const t = (ev.clipboardData && ev.clipboardData.getData('text/plain')) || '';
    document.execCommand('insertText', false, t);
  }; // pasted text arrives without foreign formatting
  bar.onmousedown = ev => {
    if (ev.target.closest && ev.target.closest('button')) ev.preventDefault();
  }; // pressing a button keeps the selection
  bar.onclick = ev => {
    const b = ev.target.closest && ev.target.closest('[data-cmd]');
    if (!b) return;
    if (b.dataset.cmd === 'heading') {
      restore();
      const inH =
        (window.getSelection().anchorNode || {}).parentElement &&
        window.getSelection().anchorNode.parentElement.closest &&
        window.getSelection().anchorNode.parentElement.closest('h2');
      exec('formatBlock', inH ? 'div' : 'h2');
      return;
    }
    exec(b.dataset.cmd);
  };
  document.getElementById('rte-size').onchange = ev => {
    if (ev.target.value) exec('fontSize', ev.target.value);
    ev.target.value = '';
  };
  document.getElementById('rte-color').onchange = ev => exec('foreColor', ev.target.value);
  // (2.4.0) a highlight behind the text, and the style of a paragraph (normal text, heading, subheading, quote)
  document.getElementById('rte-mark').onchange = ev => exec('hiliteColor', ev.target.value);
  document.getElementById('rte-block').onchange = ev => {
    if (ev.target.value) exec('formatBlock', ev.target.value);
    ev.target.value = '';
  };
  // a neat A4 page of the rules to print and hand out (what is typed so far, saved or not)
  document.getElementById('rules-pdf').onclick = async () => {
    if (!RichText.text(box.innerHTML)) {
      msg.textContent = 'Write some rules first.';
      return;
    }
    msg.textContent = 'Making the PDF...';
    try {
      const name = (state.settings.appName || '').trim() || DEFAULT_NAME;
      const res = await api.exportPdf(
        Report.rulesHtml({ mono: state.settings.pdfMode === 'mono', title: name + ' – Racing Rules', html: box.innerHTML }),
        'Racing Rules.pdf'
      );
      msg.textContent = res.saved ? 'Saved to ' + res.path : 'Export cancelled.';
    } catch (x) {
      msg.textContent = 'Could not make the PDF: ' + x.message;
    }
  };
}

async function render() {
  if (typeof ptPageDispose === 'function') ptPageDispose();
  if (typeof ppPageDispose === 'function') ppPageDispose();
  view.onclick = null;
  view.onchange = null; // each screen sets up its own handlers
  if (typeof SetupWizard !== 'undefined') SetupWizard.stop(); // (the sensor test of the setup guide stops listening)
  if (typeof SetupWizard !== 'undefined' && SetupWizard.pill) SetupWizard.pill(); // (2.4.0: Back to the guide, on the page the guide sent you to)
  LiveView.unmount();
  if (state.tab !== 'race' && typeof live !== 'undefined' && live && live.alive && !raceActive()) {
    // a race that is not on (not started, or over): the race screen is gone, no more keys, Trackmate or Race Director buttons
    if (live.leave) live.leave();
    live.alive = false;
    const h = document.getElementById('racehost');
    if (h) h.innerHTML = '';
  }
  showRace(state.tab === 'race');
  const pick = async id => {
    if (id === 'live') {
      if (typeof PerfUI !== 'undefined') PerfUI.mark('Live Race tab pressed');
      api.liveOpen();
      return;
    } // Live Race is the second screen: it opens its own window, also during a race
    if (typeof editorDirty === 'function' && editorDirty()) {
      const ed = state.editing,
        tab = state.tab;
      if (!(await Dialog.confirm('Discard your unsaved layout changes?', { ok: 'Discard changes', cancel: 'Keep editing', danger: true })))
        return;
      if (state.editing !== ed || state.tab !== tab) return; // (the editor was closed, or another tab opened, meanwhile)
    }
    if (typeof editorLeave === 'function') editorLeave();
    if (typeof PerfUI !== 'undefined') PerfUI.mark(`Tab: ${id}`); // (for the Performance report, 1.60.1: what was on the screen when the figures changed)
    state.tab = id;
    render();
  };
  renderTabs(tabsEl, tabsNow(), state.tab, pick, TAB_ICONS);
  if (typeof MainBar !== 'undefined') MainBar.decorate(tabsEl); // (2.4.0: Pit Wall, the groups, the lights, Find and ON AIR)
  try {
    if (state.tab === 'home') {
      if (typeof resetHome === 'function') resetHome();
      await renderHome();
    } // (the laps for the cards on Home are fetched again every time Home is shown)
    else if (state.tab === 'race') await renderRace();
    else if (state.tab === 'database') await renderDatabase();
    else if (state.tab === 'settings') await renderSettings();
    else if (state.tab === 'rules') await renderRules();
    else if (state.tab === 'setup') await renderSetup();
    else if (state.tab === 'custom') await renderCustom();
    if (state.tab === 'race') renderTabs(tabsEl, tabsNow(), state.tab, pick, TAB_ICONS); // (the race exists now: its tab is shown, and it is the one that is open)
    if (state.tab === 'race' && typeof MainBar !== 'undefined') MainBar.decorate(tabsEl);
  } catch (e) {
    screenFailed(e);
  }
}

// A screen that cannot be drawn must never leave a dead page behind (the old page with its buttons switched off, as happened when a race could not be opened):
// it says what went wrong and offers the way back to Home.
function screenFailed(e) {
  console.error(e);
  if (state.tab === 'race') state.race = null; // (the race that could not be opened is not kept)
  showRace(false); // (this page is shown in the place of the other screens)
  view.onchange = null;
  view.innerHTML = `<section class="card" id="screenerror" role="alert"><h3>This screen could not be opened</h3><p>${esc(e && e.message ? e.message : e)}</p>
    <p class="muted">Nothing was lost: what was saved is still in the database. Go back to Home to carry on.</p><div class="row"><button class="btn primary" id="errhome">Back to Home</button></div></section>`;
  view.onclick = ev => {
    const b = ev.target && ev.target.closest ? ev.target.closest('#errhome') : null;
    if (b) {
      state.tab = 'home';
      render();
    }
  };
}

// A window that cannot start (the Live Race window on a second screen most of all) shows why, in place of an empty page; "Try again" loads it once more.
function bootFailed(e) {
  console.error(e);
  try {
    view.hidden = false;
    view.onchange = null;
    view.innerHTML = `<section class="card" id="bootfailed" role="alert"><h3>This window could not be opened</h3><p>${esc(e && e.message ? e.message : e)}</p>
      <p class="muted">Nothing was lost: what was saved is still in the database.</p><div class="row"><button class="btn primary" id="bootagain">Try again</button></div></section>`;
    view.onclick = ev => {
      const b = ev.target && ev.target.closest ? ev.target.closest('#bootagain') : null;
      if (b) location.reload();
    };
  } catch (x) {
    /* the console has it */
  }
}

(async () => {
  state.schema = await api.schema();
  state.settings = await api.getSettings();
  applyTheme();
  applyDepth();
  applyLayers();
  applyName();
  if (typeof PicMemo !== 'undefined' && PicMemo.setLinks) PicMemo.setLinks(true); // big pictures in the widgets go to the page as short links (1.60.6): this window and the second screen
  if (typeof location !== 'undefined' && location.hash === '#live') {
    // the second-screen window: only the Live Race pages
    document.body.classList.add('lv-window');
    document.querySelector('header').hidden = true;
    document.title = (state.settings.appName || DEFAULT_NAME) + ' – Live Race';
    if (api.setZoom) api.setZoom(1);
    return LiveView.mount(view, { second: true }); // (the second screen keeps its own size)
  }
  if (typeof UpdateUI !== 'undefined') UpdateUI.start(UPDATE_UI); // (2.4.0: a newer version opens a window by itself, once at the start)
  if (api.onUnsavedQuery) api.onUnsavedQuery(() => (typeof unsavedDrafts === 'function' ? unsavedDrafts() : [])); // (closing the window asks first when an editor has unsaved changes)
  if (typeof ppInit === 'function') ppInit();
  if (typeof ptInit === 'function') ptInit();
  if (typeof PluginDisplayClient !== 'undefined') PluginDisplayClient.init();
  const libraryState = api.libraryStatus ? await api.libraryStatus() : null;
  if (typeof PaddockCollection !== 'undefined' && !libraryState?.available) PaddockCollection.init(api);
  applyUiScale();
  // (2.4.0) the window is shown when the first screen is drawn, at most 3 s after this: Home fills in its statistics afterwards. With a
  // large history the statistics took minutes, and the opening gave up after 3 minutes ("The first screen is taking too long to open").
  const firstScreen = render();
  await Promise.race([firstScreen, new Promise(resolve => setTimeout(resolve, 3000))]);
  firstScreen.catch(e => console.error('First screen:', e));
  if (libraryState?.available && typeof SharedLibraryWatch !== 'undefined') {
    const stop = SharedLibraryWatch.watch({
      initial: libraryState,
      read: () => api.libraryStatus(),
      refresh: () => render(),
      canRefresh: () =>
        !document.hidden &&
        ['home', 'database'].includes(state.tab) &&
        !raceActive() &&
        !state.editing &&
        !document.querySelector('dialog[open],.central-session[open],details.sess[open]') &&
        !document.activeElement?.matches('input,select,textarea,[contenteditable="true"]') &&
        !state.homeCustom?.typing
    });
    addEventListener('beforeunload', stop, { once: true });
  }
  if (api.onHwChoose && typeof tmAutoConnect === 'function') tmAutoConnect(); // the remembered Trackmate, if it is plugged in
  if (typeof abAutoConnect === 'function') abAutoConnect(); // the remembered SlotForge box, or the virtual one when that is chosen
  if (typeof ppAutoConnect === 'function') ppAutoConnect();
  if (typeof dscAutoConnect === 'function') await dscAutoConnect(); // (2.3.0: the remembered DS interface)
  setTimeout(startHwDetect, 2500); // (after the remembered devices had their chance: what is left is offered on Home)
})()
  .catch(bootFailed)
  .finally(() => {
    if (api.startupReady && location.hash !== '#live') api.startupReady();
  });
