// Race Setup tab: race setups and timing page layouts, plus the drag-and-drop layout editor.
const PRESETS = [
  ['16:9', 16, 9],
  ['16:10', 16, 10],
  ['4:3', 4, 3],
  ['21:9', 21, 9]
];
let editorKeyHandler = null;
// The widget list and the settings panel stand beside the canvas, stay at the top of the window while the page scrolls, and scroll inside themselves when they are long.
// Their height is what the window has left from where they start (1.29.1): a panel as tall as the whole window that starts below the top bar would push the whole page past the bottom of the window, and the app got a scrollbar of its own.
const panelRoom = (windowH, top, below) => Math.max(160, Math.floor(windowH - Math.max(8, top) - Math.max(8, below || 0))); // top: where the panels start in the window; below: the room the page keeps under them (its padding)
let panelFitWired = false;
function fitEditorWidgets(elements) {
  if (!state.editing) return;
  const ed = state.editing,
    canvas = document.getElementById('canvas');
  if (!canvas) return;
  // (2.4.0) every widget's box is measured first, before any is fitted: a widget's size does not follow what it shows (.canvas>.lw contain:size), so the
  // sizes hold through the fits, and the browser lays the canvas out once instead of once per widget
  const list = [...(elements || canvas.querySelectorAll('.lw[data-i]'))].filter(el => canvas.contains(el));
  for (const el of list) el._sfBox = { width: el.getBoundingClientRect().width, cw: el.clientWidth, ch: el.clientHeight };
  try {
    fitEach(ed, list);
  } finally {
    for (const el of list) el._sfBox = null;
  }
}
function fitEach(ed, list) {
  for (const el of list) {
    const w = ed.draft.widgets[Number(el.dataset.i)],
      val = el.querySelector(':scope > .lw-val');
    if (!w || !val) continue;
    if (w.opt?.composition || w.type === 'racechart')
      val.innerHTML = previewOf(Widgets.def(w.type), { ...w, chartSize: { width: val.clientWidth, height: val.clientHeight } });
    if (ed.draft.kind === 'row') WidgetFonts.apply(el, w, ed.draft);
    const preview = typeof WidgetPreview !== 'undefined' ? WidgetPreview.content({ ...w, previewContext: editorPreviewContext(ed) }) : null;
    WidgetView.fit({ el, val, w, layout: ed.draft }, preview || {}, { cell: ed.draft.kind === 'row' });
  }
}
let editorFitFrame = null,
  editorFitAll = false;
const editorFitElements = new Set();
function scheduleEditorFit(elements) {
  if (elements) elements.forEach(el => editorFitElements.add(el));
  else editorFitAll = true;
  if (editorFitFrame !== null) return;
  editorFitFrame = requestAnimationFrame(() => {
    editorFitFrame = null;
    const list = editorFitAll ? undefined : [...editorFitElements];
    editorFitAll = false;
    editorFitElements.clear();
    fitEditorWidgets(list);
  });
}
let widgetEditorResizeWired = false;
function fitPanels() {
  const main = typeof document !== 'undefined' && document.querySelector ? document.querySelector('.ed-main') : null;
  if (!main || !main.children) return;
  if (!(window.innerHeight > 0)) return;
  let below = 0; // the padding and margin under the editor, up to the page
  if (typeof getComputedStyle === 'function')
    for (let e = main, n = 0; e && e.parentElement && e !== document.body && n < 12; e = e.parentElement, n++) {
      const c = getComputedStyle(e);
      below += (parseFloat(c.paddingBottom) || 0) + (parseFloat(c.marginBottom) || 0) + (parseFloat(c.borderBottomWidth) || 0);
    }
  const narrow = window.innerWidth <= 900,
    room = panelRoom(window.innerHeight, main.getBoundingClientRect().top, below); // (in one column, under 900 px, the panels are part of the page: the style sheet's height stays)
  Array.from(main.children)
    .filter(x => x.classList && (x.classList.contains('ed-pal') || x.classList.contains('ed-side')))
    .forEach(x => {
      x.style.maxHeight = narrow ? '' : room + 'px';
    });
}
const clone = x => JSON.parse(JSON.stringify(x));
const knownWidgets = list => (Array.isArray(list) ? list : []).filter(w => w && Widgets.def(w.type)); // a widget type this version does not know (from a file of another version) is left out instead of breaking the editor
// (2.4.0 review) ...but it is kept aside and written back on save, so saving never deletes it
const unknownWidgets = list => (Array.isArray(list) ? list : []).filter(w => w && !Widgets.def(w.type));
const editorDirty = () => !!(state.editing && state.editing.dirty);
// Every editor that holds a draft in memory, with changes that are not saved (asked before the window closes, see main.js closeGuard)
function unsavedDrafts() {
  const out = [];
  const add = (ed, name) => {
    if (ed && ed.dirty) out.push(name);
  };
  add(typeof state !== 'undefined' && state.editing, 'Layout editor');
  add(typeof audEd !== 'undefined' ? audEd : null, 'Audio set');
  add(typeof imgEd !== 'undefined' ? imgEd : null, 'Picture set');
  add(typeof wbEd !== 'undefined' ? wbEd : null, 'Widget');
  add(typeof chartEd !== 'undefined' ? chartEd : null, 'Chart');
  add(typeof rotEd !== 'undefined' ? rotEd : null, 'Rotation setup');
  add(typeof chEd !== 'undefined' ? chEd : null, 'Championship');
  add(typeof resourceEditor !== 'undefined' ? resourceEditor : null, 'Resource System');
  add(typeof multiEditor !== 'undefined' ? multiEditor : null, 'Multi-Class System');
  add(typeof rivalEditor !== 'undefined' ? rivalEditor : null, 'Virtual Rival System');
  return out;
}

function editorLeave() {
  state.editing?.cancelGesture?.();
  if (editorKeyHandler) document.removeEventListener('keydown', editorKeyHandler);
  if (state.editing && state.editing.history) state.editing.history.dispose();
  editorKeyHandler = null;
  state.editing = null;
}

// Undo and redo: a remembered state is put back into the draft itself (the editor holds on to that object). The widgets that are new or different now
// are selected, so you see what came back (a deleted widget) or what moved back.
function restoreDraft(ed, s) {
  const d = ed.draft,
    had = new Map();
  d.widgets.forEach(w => {
    const k = JSON.stringify(w);
    had.set(k, (had.get(k) || 0) + 1);
  });
  Object.keys(d).forEach(k => delete d[k]);
  Object.assign(d, s.draft);
  ed.sel = d.widgets.filter(w => {
    const k = JSON.stringify(w),
      n = had.get(k) || 0;
    if (n) {
      had.set(k, n - 1);
      return false;
    }
    return true;
  });
  ed.lastDup = null;
  ed.bgKey = null;
  ed.bgNode = null;
}
// typing in a text box has its own undo (the browser's); the other controls (a slider, a tick box, a colour) leave Ctrl+Z to the editor
const typingIn = t =>
  !!(
    t &&
    t.matches &&
    t.matches('input,textarea') &&
    !/^(checkbox|radio|range|color|button|submit|reset|file|image)$/.test(String(t.type || 'text'))
  );

// Undo and redo for the editors that hold one draft: Audio Settings, Image Settings and Widget Builder (ed is audEd, imgEd or wbEd, with its draft and dirty).
// Called every time the editor is drawn (after its HTML is in place): the steps themselves stay in ed.history, so they survive the redraws. p is the start of the
// ids of its buttons: p-undo, p-redo and p-msg. Returns mark() for a change that goes on (typing: a quiet moment ends the step) and step() for a single action.
let draftKeyHandler = null;
function draftUndo(ed, p, redraw) {
  const byId = id => document.getElementById(id);
  const hist =
    ed.history ||
    (ed.history = Undo.create({
      clean: !ed.dirty,
      get: () => ({ draft: ed.draft }),
      apply: s => {
        const d = ed.draft;
        Object.keys(d).forEach(k => delete d[k]);
        Object.assign(d, s.draft);
      }, // (put back into the draft itself: what the editor holds stays valid)
      onchange: () => {
        if (ed.syncUndo) ed.syncUndo();
      }
    }));
  ed.syncUndo = () => {
    const u = byId(p + '-undo'),
      r = byId(p + '-redo');
    if (u) u.disabled = !hist.canUndo();
    if (r) r.disabled = !hist.canRedo();
  };
  const say = t => {
    const m = byId(p + '-msg');
    if (m) m.textContent = t;
  };
  const go = redo => {
    if (!(redo ? hist.redo() : hist.undo())) {
      say(redo ? 'Nothing to redo.' : 'Nothing to undo.');
      return false;
    }
    ed.dirty = !hist.isClean();
    redraw();
    const m = byId(p + '-msg');
    if (m) m.textContent = redo ? 'Redone.' : 'Undone.';
    return true;
  };
  const u = byId(p + '-undo'),
    r = byId(p + '-redo');
  if (u) u.onclick = () => go(false);
  if (r) r.onclick = () => go(true);
  if (draftKeyHandler) document.removeEventListener('keydown', draftKeyHandler);
  draftKeyHandler = e => {
    const key = String(e.key).toLowerCase();
    if (!(e.ctrlKey || e.metaKey) || (key !== 'z' && key !== 'y') || typingIn(e.target) || dlg.open === true || !byId(p + '-undo')) return; // (a text box has its own undo; and not when this editor is not on the screen)
    e.preventDefault();
    go(key === 'y' || !!e.shiftKey);
  };
  document.addEventListener('keydown', draftKeyHandler);
  ed.syncUndo();
  const mark = () => {
    ed.dirty = true;
    hist.touch();
  };
  return {
    hist,
    mark,
    step: () => {
      mark();
      hist.commit();
    },
    go
  };
}
// the editor is closed: its steps are forgotten
function draftUndoEnd(ed) {
  if (draftKeyHandler) document.removeEventListener('keydown', draftKeyHandler);
  draftKeyHandler = null;
  if (ed && ed.history) ed.history.dispose();
}
const undoButtons = p =>
  `<button class="btn" id="${p}-undo" title="Undo the last change (Ctrl+Z)" disabled>Undo</button><button class="btn" id="${p}-redo" title="Redo (Ctrl+Y)" disabled>Redo</button>`;

// The sub-tabs of the Race Setup tab: Race Setups leads, then the race systems in
// the order they are chosen in a setup. Extras hold the standalone tools.
// Every sub-tab has the colour of its folder on the race screen: Penalty yellow, Damage red, Tyre Wear purple, Weather blue, Balance of Power white, Time Tokens teal;
// Rotation (brown) and Fuel (green) have no folder. The design is in docs/ui-reference/race-setup-tabs. The buttons keep role "tab" and data-id, as every tab in the app does.
const SETUP_HERO = ['setups', 'Race Setups', 'racesetups', 'race'];
const SETUP_GROUPS = [
  [
    'Systems',
    [
      ['fuel', 'Fuel Systems', 'fuel', 'fuel'],
      ['penalties', 'Penalty Systems', 'penalty', 'pen'],
      ['damage', 'Damage Systems', 'damage', 'dmg'],
      ['safetycar', 'Safety Car Systems', 'safetycar', 'sc'],
      ['tyrewear', 'Tyre Wear Systems', 'tyre', 'tyre'],
      ['weather', 'Weather Systems', 'weather', 'wx'],
      ['pushsave', 'Push & Save Systems', 'pushsave', 'ps']
    ]
  ],
  [
    'Setups',
    [
      ['rotation', 'Rotation Setups', 'rotation', 'rot'],
      ['championships', 'Championships', 'championship', 'ch']
    ]
  ],
  [
    'Extras',
    [
      ['bop', 'Balance of Power', 'balance', 'bop'],
      ['tokens', 'Time Tokens', 'tokens', 'tok'],
      ['virtualrivals', 'Virtual Rival Systems', 'timing', 'vr'],
      ['multiclass', 'Multi-Class Systems', 'layers', 'mc'],
      ['resources', 'Resource Systems', 'resources', 'resource']
    ]
  ]
];
// (2.3.0) a club hides the systems it never uses (App setting setupHidden): their tab is gone from this strip, and their choice from the race setup form
// when a setup does not use it. "Show N hidden" shows them for a moment; the Basic set keeps what most clubs use.
const SETUP_FIELD = {
  fuel: 'fuelRules',
  penalties: 'penaltySystem',
  damage: 'damageSystem',
  safetycar: 'safetyCar',
  tyrewear: 'tyreWear',
  weather: 'weather',
  pushsave: 'pushSave',
  bop: 'bop',
  multiclass: 'multiClass',
  resources: 'resourceSystem'
};
const SETUP_BASIC = ['fuel', 'penalties', 'damage', 'rotation', 'championships'];
const setupHidden = (settings = typeof state !== 'undefined' ? state.settings : {}) => {
  const all = SETUP_GROUPS.flatMap(g => g[1].map(t => t[0]));
  return Array.isArray(settings && settings.setupHidden) ? settings.setupHidden.filter(id => all.includes(id)) : [];
};
// the race setup fields of the hidden systems (the form leaves them out unless the setup uses one)
const setupHiddenFields = (settings = typeof state !== 'undefined' ? state.settings : {}) =>
  setupHidden(settings)
    .map(id => SETUP_FIELD[id])
    .filter(Boolean);
let setupShowHidden = false; // ("Show N hidden": for as long as the app runs)
function chooseSetupTabs() {
  const all = SETUP_GROUPS.flatMap(g => g[1]),
    hidden = new Set(setupHidden());
  const d = document.createElement('dialog');
  d.className = 'appdlg ss-choose';
  d.setAttribute('aria-labelledby', 'ss-choose-title');
  d.innerHTML = `<h3 id="ss-choose-title">Which systems does your club use?</h3><p class="muted">Ticked systems have a tab here and a choice in the race setup form. Untick what you never use: nothing is deleted, and a race setup that already uses a system keeps it.</p>
    ${SETUP_GROUPS.map(([name, items]) => `<fieldset class="vsgroup"><legend>${esc(name === 'Setups' ? 'Rotations & Championships' : name === 'Extras' ? 'More Systems' : name)}</legend>${items.map(([id, label]) => `<label class="vschip"><input type="checkbox" data-sstab="${id}"${hidden.has(id) ? '' : ' checked'}> ${esc(label)}</label>`).join('')}</fieldset>`).join('')}
    <div class="row"><button type="button" class="btn" data-sspreset="basic">Basic set (${SETUP_BASIC.length} that most clubs use)</button><button type="button" class="btn" data-sspreset="all">Everything</button></div>
    <div class="row appdlg-buttons"><button type="button" class="btn" data-ssdone="0">Cancel</button><button type="button" class="btn primary" data-ssdone="1">Save</button></div>`;
  document.body.appendChild(d);
  const boxes = () => [...d.querySelectorAll('[data-sstab]')];
  d.onclick = async ev => {
    const p = ev.target.closest('[data-sspreset]');
    if (p) boxes().forEach(b => (b.checked = p.dataset.sspreset === 'all' || SETUP_BASIC.includes(b.dataset.sstab)));
    const done = ev.target.closest('[data-ssdone]');
    if (!done) return;
    if (done.dataset.ssdone === '1')
      state.settings = await api.setSettings({
        setupHidden: boxes()
          .filter(b => !b.checked)
          .map(b => b.dataset.sstab)
      });
    d.close();
    d.remove();
    if (state.tab === 'setup') renderSetup();
  };
  d.addEventListener('cancel', () => d.remove());
  d.showModal();
  all.length && d.querySelector('[data-sstab]').focus();
}
const setupColorOf = id => {
  const all = [SETUP_HERO, ...SETUP_GROUPS.flatMap(g => g[1])].find(t => t[0] === id);
  return all ? all[3] : 'race';
};
// (2.4.0) the sections as a side list: Race Setups first, then the race systems, the events (rotations, championships) and the rest, each under a small heading.
// The icons are plain; the one of the section that is open takes its colour (the colour of its folder on the race screen). A dot marks a system that a race setup
// uses (used: the ids, filled in by renderSetup once the race setups are read). The buttons keep role "tab" and data-id, as every tab in the app does.
const SETUP_HEADINGS = { Systems: 'Race systems', Setups: 'Events', Extras: 'More' };
const setupTabsHtml = (current, used = new Set()) => {
  const [hid, hlabel, hicon] = SETUP_HERO;
  const chip = ([id, label, icon, c]) =>
    `<button type="button" class="sstab ss-${c}" role="tab" aria-selected="${id === current}" data-id="${id}">${Icons.svg(icon, { size: 16, stroke: 1.8, cls: 'ssico' })}<span class="sstext">${esc(label)}</span>${used.has(id) ? '<i class="ssuse" title="Used by a race setup"></i>' : ''}</button>`;
  const hidden = setupShowHidden ? [] : setupHidden(),
    shown = items => items.filter(t => !hidden.includes(t[0]) || t[0] === current),
    n = setupHidden().length;
  // (2.4.0) a clear button at the end of the list, with what it does in its name (it hides tabs: a race setup that uses a system keeps it)
  const tools = `<div class="sstools"><button type="button" class="sstool" data-sschoose title="Choose which systems have a tab here and a choice in the race setup form. Nothing is deleted.">${Icons.svg('sliders', { size: 16, stroke: 1.8 })}<span class="sstext">Hide unused systems…</span></button>${n ? `<button type="button" class="sstool" data-ssall aria-pressed="${setupShowHidden}">${Icons.svg(setupShowHidden ? 'up' : 'down', { size: 16, stroke: 1.8 })}<span class="sstext">${setupShowHidden ? 'Hide the ' + n + ' unused again' : 'Show ' + n + ' hidden'}</span></button>` : ''}</div>`;
  const groups = SETUP_GROUPS.map(([name, all]) => {
    const items = shown(all);
    return items.length
      ? `<div class="ssgroup"><span class="sslabel">${esc(SETUP_HEADINGS[name] || name)}</span>${items.map(chip).join('')}</div>`
      : '';
  }).join('');
  return `<div class="ssrailtitle">Race Setup</div><button type="button" class="ssbig" role="tab" aria-selected="${hid === current}" data-id="${hid}"><span class="ssbigico">${Icons.svg(hicon, { size: 18, stroke: 1.8 })}</span><span class="sstext">${esc(hlabel)}</span></button>${groups}${[...used].some(id => SETUP_GROUPS.some(g => g[1].some(t => t[0] === id && !hidden.includes(id)))) ? '<div class="sslegend"><i class="ssuse" aria-hidden="true"></i>used by a race setup</div>' : ''}${tools}`;
};
// (2.4.0) the note under the title of a page: what it is (one line), a few more words, and where you use it. A box with the icon of the section.
const SETUP_NOTES = {
  racesetups: [
    'A race setup is one kind of race you run: how it starts, how it ends and who wins.',
    'It can use the race systems in the list on the left: fuel, penalties, weather and more.',
    'Pick one on the Home tab to start a race.'
  ],
  penalties: [
    'A penalty system says how penalty points turn into time and when a driver is disqualified.',
    '',
    'Choose one in a race setup (Rules and Systems).'
  ],
  damage: [
    'A damage system gives a car damage points: a hit from the Race Director, a deslot.',
    'The level they reach says how long the car must stand in the pits to be repaired, or that it is out.',
    'Choose one in a race setup (Rules and Systems).'
  ],
  tyrewear: [
    'A tyre wear system makes the tyres lose life while a car drives, from 100% to 0%.',
    'New tyres help the car, worn out tyres hinder it, and a pit stop gives a fresh set.',
    'Choose one in a race setup (Rules and Systems).'
  ],
  safetycar: [
    'A safety car system is the Safety Car that comes out with the yellow flag, including a yellow Track Call.',
    'It says how slowly the cars must drive and how much shorter the work in a pit stop is. The folder Random Flags can also put the yellow flag up at random moments.',
    'Choose one in a race setup (Rules and Systems).'
  ],
  pushsave: [
    'A Push & Save System compares each lap with the driver’s pace benchmark (median by default).',
    'Faster laps use more tyres and fuel, slower laps save. Choose tyres, fuel or both. App Settings › Calculations selects the benchmark; older systems can keep their best-lap reference.',
    'Choose one in a race setup (Rules and Systems).'
  ],
  fuel: [
    'A Fuel System sets the tank, the fixed fuel used per lap, the refuel speed and what happens when it runs out.',
    'It can also give Push & Save a pace reference (Track or Manual).',
    'Choose one in a race setup (Rules and Systems) to race with fuel.'
  ],
  weather: [
    'A weather system is a spell of rain with a forecast: when it starts, how long it lasts, the clouds before and the drying after.',
    'Cars change tyres in the pits and can get penalty points or be hindered if they do not.',
    'Choose one in a race setup (Rules and Systems).'
  ],
  rotation: [
    'A rotation setup is a heat plan that you make yourself: which participant races in which heat and in which lane, and the order of the heats.',
    'Without one, the heats are planned from the settings of the race setup, as before.',
    'Choose one in a race setup for a Heat-based race (under Session).'
  ],
  championships: [
    'A championship is a series of rounds, with a roster of drivers.',
    'Every round has its sessions (practice, qualifying, a race), each driven with one of your race setups. The race that you drive is saved as part of the championship.',
    'On the Home tab the next session is waiting: one click loads it.'
  ],
  bop: [
    'Balance of Power evens out a race: a car that is too fast is hindered and a car that is too slow is helped.',
    'It works through its fuel use, refuelling speed and tank.',
    'Make profiles for different nights; a race setup with Balance of Power on chooses one.'
  ],
  tokens: [
    'The Time Token System sells track time: a lane is switched on with paid time and turns red when the time is up.',
    '',
    'Make profiles for different events; a Time Token Session chooses one.'
  ],
  virtualrivals: [
    'A Virtual Rival replays a saved lap sequence as an opponent in a lane.',
    'Make one from a saved race or practice recording, then link it to a virtual driver in Database. On Home, the car selector of that driver becomes the Rival Setup selector.',
    'Choose its virtual driver in a lane on Home.'
  ],
  multiclass: [
    'Multi-Class: race together, compete within your class.',
    'Overall and class points are separate. Label your cars in Database › Slotcars › Race Class, then choose those classes here and assign the drivers.',
    'Choose one in a race setup (Rules and Systems). On Home, choose cars of the matching classes.'
  ],
  resources: [
    'A Resource System is a shared supply box for each driver, slotcar or team: tyre sets, repair credits and replacement components.',
    'Balances follow the owner, not the lane.',
    'Choose one in a race setup (Rules and Systems).'
  ]
};
function setupNote(box, sub) {
  if (!box) return;
  const [lead, more, use] = SETUP_NOTES[sub] || SETUP_NOTES.racesetups;
  const tab = [SETUP_HERO, ...SETUP_GROUPS.flatMap(g => g[1])].find(t => t[0] === sub) || SETUP_HERO;
  box.innerHTML = `<span class="sn-tile">${Icons.svg(tab[2], { size: 20, stroke: 1.8 })}</span><p class="sn-lead">${esc(lead)}</p>${more ? `<p class="sn-more">${esc(more)}</p>` : ''}<p class="sn-use">${Icons.svg('arrow', { size: 14, stroke: 2 })}<span>${esc(use)}</span></p>`;
}
// (2.4.0) a race system as a card, the same as the cards of the other system pages (database/manager.js, sysCard): for the pages that draw their own list
// (Virtual Rival, Multi-Class, Resource Systems). facts: [label, value]; used: the names of what uses it; actions: the buttons (html).
const sysCardHtml = ({ look, icon, eyebrow, name, facts = [], used = [], what = 'race setup', empty, actions }) => {
  const f = facts.filter(x => x && x[1] !== '' && x[1] !== undefined && x[1] !== null);
  return `<article class="rscard syscard ss-${look}"><div class="rsidentity" data-kind="system"><div class="rshead"><span class="rstile">${Icons.svg(icon, { size: 22 })}</span><div class="rstitle"><div class="rseye">${esc(eyebrow)}</div><div class="rsname">${esc(String(name || '').trim() || '(unnamed)')}</div></div></div>
    <div class="rsfacts sysfacts">${f.map(([k, v]) => `<div class="gd"><span class="muted">${esc(k)}</span> ${esc(v)}</div>`).join('') || '<p class="muted">The standard settings.</p>'}</div></div>
    <section class="rslinked" aria-label="What uses ${esc(name)}"><div class="rslinked-head"><strong>Used by</strong><span>${used.length ? used.length + ' ' + what + (used.length === 1 ? '' : 's') : 'Not used yet'}</span></div>${
      used.length
        ? `<div class="rspills">${used
            .slice(0, 3)
            .map(u => `<span class="rspill">${esc(String(u || '').trim() || '(unnamed)')}</span>`)
            .join('')}${used.length > 3 ? `<span class="rspill">+${used.length - 3}</span>` : ''}</div>`
        : `<p class="rslinked-empty">${esc(empty || 'Choose it under Rules and systems in a race setup.')}</p>`
    }</section><div class="row rsactions">${actions}</div></article>`;
};
// the title of the page of a section
const setupTitleOf = id => ([SETUP_HERO, ...SETUP_GROUPS.flatMap(g => g[1])].find(t => t[0] === id) || SETUP_HERO)[1];

// Race Setup tab: the race setups you can pick on the Home tab, and the penalty systems they can use
async function renderSetup() {
  view.innerHTML = `<div class="setupshell"><nav class="setupstrip" id="setuptabs" role="tablist" aria-label="Race Setup sections" aria-orientation="vertical"></nav><div class="setuppage ss-${setupColorOf(state.setupSub)}" id="setuppage"><h2 id="setuptitle">${esc(setupTitleOf(state.setupSub))}</h2><div class="sn" id="setupnote"></div><div id="setupmgr"></div></div></div>`;
  const strip = document.getElementById('setuptabs');
  strip.innerHTML = setupTabsHtml(state.setupSub);
  // (the dots of the systems that a race setup uses: drawn when the race setups are read, without holding up the page)
  if (api.list)
    Promise.resolve(api.list('racesetups'))
      .then(list => {
        const used = new Set(
          Object.entries(SETUP_FIELD)
            .filter(([, field]) => (list || []).some(x => x && x[field]))
            .map(([id]) => id)
        );
        if ((list || []).some(x => x && x.rotation)) used.add('rotation');
        if (used.size && strip.isConnected !== false && state.tab === 'setup') strip.innerHTML = setupTabsHtml(state.setupSub, used);
      })
      .catch(() => {});
  strip.onclick = async e => {
    const b = e.target.closest('[data-id]');
    if (!b) {
      if (e.target.closest('[data-sschoose]')) return chooseSetupTabs();
      if (e.target.closest('[data-ssall]')) {
        setupShowHidden = !setupShowHidden;
        return renderSetup();
      }
      return;
    }
    const id = b.dataset.id;
    const sub = state.setupSub;
    // (the window goes on while a question is open: still on this page, with this same editor open?)
    const here = () => state.tab === 'setup' && state.setupSub === sub && strip.isConnected !== false;
    const discard = async (ed, message) =>
      !ed.dirty || ((await Dialog.confirm(message, { ok: 'Discard changes', cancel: 'Keep editing', danger: true })) && here());
    // the rotation setup editor is closed by another tab: ask first when there are changes that are not saved
    if (rotEd && id !== 'rotation') {
      const ed = rotEd;
      if (!(await discard(ed, 'Discard your unsaved changes to this rotation setup?')) || rotEd !== ed) return;
      draftUndoEnd(rotEd);
      rotEd = null;
    }
    if (chEd && id !== 'championships') {
      const ed = chEd;
      if (!(await discard(ed, 'Discard your unsaved changes to this championship?')) || chEd !== ed) return;
      draftUndoEnd(chEd);
      chEd = null;
    }
    if (typeof resourceEditor !== 'undefined' && resourceEditor && id !== 'resources') {
      const ed = resourceEditor;
      if (!(await discard(ed, 'Discard unsaved Resource System changes?')) || resourceEditor !== ed) return;
      resourceEditor = null;
    }
    if (typeof multiEditor !== 'undefined' && multiEditor && id !== 'multiclass') {
      const ed = multiEditor;
      if (!(await discard(ed, 'Discard unsaved Multi-Class changes?')) || multiEditor !== ed) return;
      multiEditor = null;
    }
    if (typeof rivalEditor !== 'undefined' && rivalEditor && id !== 'virtualrivals') {
      const ed = rivalEditor;
      if (!(await discard(ed, 'Discard unsaved Virtual Rival changes?')) || rivalEditor !== ed) return;
      rivalEditor.observer?.disconnect();
      rivalEditor = null;
    }
    state.setupSub = id;
    renderSetup();
  };
  const sub = state.setupSub,
    entity =
      sub === 'penalties'
        ? 'penaltysystems'
        : sub === 'damage'
          ? 'damagesystems'
          : sub === 'tyrewear'
            ? 'tyrewearsystems'
            : sub === 'safetycar'
              ? 'safetycarsystems'
              : sub === 'pushsave'
                ? 'pushsavesystems'
                : sub === 'fuel'
                  ? 'fuelrules'
                  : sub === 'weather'
                    ? 'weathersystems'
                    : 'racesetups';
  setupNote(document.getElementById('setupnote'), sub);
  if (sub === 'resources') {
    return renderResources(document.getElementById('setupmgr'));
  }
  if (sub === 'multiclass') {
    return renderMultiClass(document.getElementById('setupmgr'));
  }
  if (sub === 'virtualrivals') {
    return renderVirtualRivals(document.getElementById('setupmgr'));
  }
  if (sub === 'rotation') {
    manager = null;
    return renderRotations(document.getElementById('setupmgr'));
  }
  if (sub === 'championships') {
    manager = null;
    return renderChampionships(document.getElementById('setupmgr'));
  }
  if (sub === 'bop') {
    manager = null;
    return typeof Profiles !== 'undefined'
      ? Profiles.render('bop', document.getElementById('setupmgr'))
      : renderBopSettings(document.getElementById('setupmgr')); // (2.4.0: profiles)
  }
  if (sub === 'tokens') {
    manager = null;
    return typeof Profiles !== 'undefined'
      ? Profiles.render('tokens', document.getElementById('setupmgr'))
      : renderTokenSettings(document.getElementById('setupmgr'));
  }
  await mountManager(document.getElementById('setupmgr'), entity);
}

// Customization tab: Layout Editor, Leaderboard Editor, Race Results, Audio Settings, Image Settings and Widget Builder
// the sections of Customization: id, name, icon, and the heading of the group it starts (2.4.0: Race screen, After the race, Sound and pictures, Add-ons)
const CUSTOM_TABS = [
  ['layouts', 'Layout Editor', 'screen', 'Race screen'],
  ['rows', 'Leaderboard Editor', 'lines'],
  ['charts', 'Chart Editor', 'gauge'],
  ['widgets', 'Widget Builder', 'layers'],
  ['results', 'Race Results', 'star', 'After the race'],
  ['audio', 'Audio sets', 'say', 'Libraries'],
  ['images', 'Picture sets', 'paint'],
  ['pluginpages', 'Plugin Pages & Tools', 'cog', 'Add-ons']
];
// (2.4.0) the note under the title of a Customization page, as on the Race Setup pages (Page Note): what it is, a few more words, and where you use it
const CUSTOM_NOTES = {
  layouts: [
    'A layout is a timing page you design once and use in any race setup.',
    'Place the widgets you want on it: the leaderboard, lap times, lights, charts, pictures and more.',
    'Choose a layout in a race setup.'
  ],
  rows: [
    'A row design is one line of the leaderboard: place the driver widgets in it once and every driver gets that row.',
    'The leader, a car in the pits, a penalty or a car that is out can each have their own colours.',
    'Choose a design in the Leaderboard widget (Layout Editor) or on the Live Race page.'
  ],
  charts: [
    'A chart design is a reusable race chart: what it shows and how it looks.',
    'Changing a design updates every widget that uses it.',
    'In the Layout Editor, add Charts › Race Chart and choose a saved design.'
  ],
  widgets: [
    'Build your own widgets: values, icons, meters and pictures, arranged the way you like.',
    'A canvas widget is drawn freely, with groups, layers and snapping. A simple widget is one line of text with variables such as {name} and {best}, or a picture that changes with a rule (a trophy when the position is 1). Each card says which layouts use the widget; when you save a change, those layouts can follow it (or keep their own copy).',
    'Saved widgets appear under My widgets in the Layout Editor (and the Leaderboard Editor, for per-lane widgets).'
  ],
  results: [
    'The Results Wall shows by itself when a race or heat ends: the Victory Spotlight in gold, silver and bronze, then the other drivers.',
    'Choose the facts on the cards and the comparison chart. The preview shows a sample race with your choices.',
    'Used for every finished race and heat.'
  ],
  audio: [
    'An audio set holds everything the race says: the voice and, for each call (start, new leader, fastest lap, flags…), one or more sentences.',
    'A race setup with "No audio" stays silent. Sound is played on the computer that runs the race.',
    'Choose one in a race setup.'
  ],
  images: [
    'Pictures for the Fuel, Race flag, Start lights, Tyres, Weather Forecast and Track Conditions widgets.',
    '',
    'Make a set once here, then choose it in the widget of any layout.'
  ],
  pluginpages: [
    'Plugins can add pages that show information, and tools that you run yourself.',
    'Tools run only when you choose them, outside an active race or results review.',
    'Install plugins and switch them on in App Settings › Plugins.'
  ]
};
function customNote(box, sub) {
  if (!box) return;
  const [lead, more, use] = CUSTOM_NOTES[sub] || CUSTOM_NOTES.layouts;
  const tab = CUSTOM_TABS.find(t => t[0] === sub) || CUSTOM_TABS[0];
  box.innerHTML = `<span class="sn-tile">${Icons.svg(tab[2], { size: 20, stroke: 1.8 })}</span><p class="sn-lead">${esc(lead)}</p>${more ? `<p class="sn-more">${esc(more)}</p>` : ''}<p class="sn-use">${Icons.svg('arrow', { size: 14, stroke: 2 })}<span>${esc(use)}</span></p>`;
}
async function renderCustom() {
  if (typeof PluginDisplayClient !== 'undefined') await PluginDisplayClient.refresh();
  if (state.editing) {
    const ed = state.editing;
    await EditorData.load(api, ed, state.race?.track?.id);
    if (state.editing !== ed || state.tab !== 'custom') return;
    return renderEditor();
  }
  // (2.4.0) the sections are a side list, grouped by when you use them (the design in docs/ui-reference/redesign-2026-11), and the page has the name of its section
  const sub = CUSTOM_TABS.some(t => t[0] === state.customSub) ? state.customSub : 'layouts';
  view.innerHTML = `<div class="setupshell custshell"><nav class="custrail" aria-label="Customization sections"><div class="ssrailtitle">Customization</div><div class="sub" id="customtabs" role="tablist"></div></nav><div class="custpage"><h2 id="customtitle">${esc(CUSTOM_TABS.find(t => t[0] === sub)[1])}</h2><div class="sn" id="setupnote"></div><div id="setupbox"></div></div></div>`;
  customNote(document.getElementById('setupnote'), sub);
  const tabsEl = document.getElementById('customtabs');
  renderTabs(
    tabsEl,
    CUSTOM_TABS.map(([id, label]) => [id, label]),
    state.customSub,
    async id => {
      // the picture set, widget and chart editors are closed by another tab: ask first when there are changes that are not saved
      // (the audio set editor, audEd, is kept open with its draft when you change tab and comes back with the Audio Settings tab, so nothing is lost here; closing the window asks about it, see unsavedDrafts)
      const sub = state.customSub,
        was = [imgEd, wbEd, typeof chartEd !== 'undefined' ? chartEd : null];
      // (the window goes on while a question is open: still on this page, with the same editors open?)
      const here = () =>
        state.tab === 'custom' &&
        !state.editing &&
        state.customSub === sub &&
        imgEd === was[0] &&
        wbEd === was[1] &&
        (typeof chartEd !== 'undefined' ? chartEd : null) === was[2];
      const discard = async (ed, message) =>
        !(ed && ed.dirty) || ((await Dialog.confirm(message, { ok: 'Discard changes', cancel: 'Keep editing', danger: true })) && here());
      if (!(await discard(imgEd, 'Discard your unsaved changes to this picture set?'))) return;
      if (!(await discard(wbEd, 'Discard your unsaved changes to this widget?'))) return;
      if (typeof chartEd !== 'undefined' && !(await discard(chartEd, 'Discard unsaved changes to this chart?'))) return;
      if (typeof chartEd !== 'undefined') {
        if (chartEd && chartEd.observer) chartEd.observer.disconnect();
        chartEd = null;
      }
      state.customSub = id;
      draftUndoEnd(imgEd);
      draftUndoEnd(wbEd);
      imgEd = null;
      wbEd = null;
      renderCustom();
    },
    Object.fromEntries(CUSTOM_TABS.map(t => [t[0], t[2]]))
  );
  tabsEl.setAttribute('aria-orientation', 'vertical');
  // (a small heading before the first section of each group; the headings are for the eye, the tabs keep their names)
  CUSTOM_TABS.forEach(([id, , , group]) => {
    const b = tabsEl.querySelector?.(`[data-id="${id}"]`);
    if (b && group && b.insertAdjacentHTML)
      b.insertAdjacentHTML('beforebegin', `<span class="sslabel" aria-hidden="true">${esc(group)}</span>`);
  });
  const box = document.getElementById('setupbox');
  // (a heading of the section that only repeats the title of the page is left out of sight)
  const titled = p =>
    Promise.resolve(p).then(() => {
      const t = document.getElementById('customtitle'),
        h = box.querySelector?.('h2,h3');
      if (t && h && h.classList && String(h.textContent || '').trim() === String(t.textContent || '').trim()) h.classList.add('custdup');
    });
  if (state.customSub === 'pluginpages') return titled(renderPluginPages(box));
  if (state.customSub === 'audio') return titled(renderAudioSets(box));
  if (state.customSub === 'charts') return titled(renderChartEditor(box));
  if (state.customSub === 'rows') return titled(renderRowList(box));
  if (state.customSub === 'results') return titled(renderResultsSettings(box));
  if (state.customSub === 'images') return titled(renderImageSets(box));
  if (state.customSub === 'widgets') return titled(renderWidgetBuilder(box));
  return titled(renderLayoutList(box));
}

// The second-screen Results Wall is intentionally a focused editor. It changes
// the shared default, not the result itself, so a director can set it up once.
// (2.4.0) the preview of the Results Wall on the Race Results page: the real page, drawn with the sample race of the widget previews, cut to the number of
// drivers chosen, at the size of a race screen (1600 wide) and scaled down to the width of the preview
let rvPreviewCount = 4;
const RV_STAGE_W = 1600;
function rvPreview(box, o, designs) {
  const stage = box.querySelector?.('#rv-stage');
  if (!stage || typeof WidgetPreview === 'undefined' || typeof ResultsView === 'undefined') return;
  try {
    const S = WidgetPreview.state({ type: 'leaderboard' }, { layout: {}, imageSets: [], chartDesigns: [] }),
      eng = S.eng,
      cut = list => (list || []).slice(0, rvPreviewCount),
      sample = Object.create(eng);
    sample.standings = (...x) => cut(eng.standings(...x));
    if (eng.displayStandings) sample.displayStandings = (...x) => cut(eng.displayStandings(...x));
    stage.innerHTML = ResultsView.html(sample, o, {
      phase: 'finished',
      layout: S.layout || {},
      title: 'Sample race',
      rowDesigns: designs,
      shared: { ...S, rowDesigns: designs }
    });
  } catch {
    stage.innerHTML = '<p class="muted">The preview could not be drawn.</p>';
    return;
  }
  const screen = stage.parentElement;
  const fit = () => {
    if (!stage.isConnected) return;
    const k = Math.min(1, (screen.clientWidth || RV_STAGE_W) / RV_STAGE_W);
    stage.style.width = RV_STAGE_W + 'px';
    stage.style.transform = `scale(${k})`;
    screen.style.height = Math.ceil(stage.scrollHeight * k) + 'px';
  };
  fit();
  // (2.4.0 review) one observer for the preview: the one of the page drawn before is let go (it held the old page)
  rvObserver?.disconnect();
  rvObserver = null;
  if (typeof ResizeObserver !== 'undefined') {
    const ro = (rvObserver = new ResizeObserver(() => (stage.isConnected ? fit() : ro.disconnect())));
    ro.observe(screen);
  }
}
let rvObserver = null;
async function renderResultsSettings(box) {
  const R = ResultsView,
    o = R.clean(state.settings.resultsView),
    designs = await api.list('rowdesigns'),
    facts = (selected, optional = false) =>
      `${optional ? `<option value="none"${selected === 'none' ? ' selected' : ''}>Do not show</option>` : ''}${R.METRICS.map(([key, name]) => `<option value="${key}"${key === selected ? ' selected' : ''}>${esc(name)}</option>`).join('')}`,
    compare = selected =>
      `<option value="none"${selected === 'none' ? ' selected' : ''}>Do not show a comparison chart</option>${R.COMPARE_METRICS.map(([key, name]) => `<option value="${key}"${key === selected ? ' selected' : ''}>${esc(name)}</option>`).join('')}`,
    listMode = o.largeField === 'leaderboard';
  // (2.4.0) the settings in folders on the left, and on the right a live preview: the real Results Wall with a sample race, scaled to fit,
  // with a choice of how many drivers (5 or more shows what happens to a big field)
  const fold = (title, sub, body) =>
    `<details class="fgroup rvfold" open><summary><strong>${esc(title)}</strong><span class="muted">${esc(sub)}</span></summary><div class="rvfields">${body}</div></details>`;
  const field = (id, label, sel, hint = '') =>
    `<div class="field"><label for="${id}">${esc(label)}</label>${sel}${hint ? `<span class="muted hint">${esc(hint)}</span>` : ''}</div>`;
  box.innerHTML = `<div class="rvpage"><div class="rvsettings">${fold(
    'After the race',
    'What the second screen shows',
    field(
      'rv-after',
      'When a race is over, and between two heats',
      `<select id="rv-after" data-results-after="1"><option value="broadcast"${o.after !== 'mine' ? ' selected' : ''}>The broadcast: the winner big, the classification, the race story, the title fight</option><option value="mine"${o.after === 'mine' ? ' selected' : ''}>This Results Wall</option></select>`,
      'The broadcast is the screen the race window shows after a race, on one screen and without its buttons. The Results Wall is the page you set up below.'
    )
  )}${fold(
    'On the cards',
    'What every driver card shows',
    field(
      'rv-summary-0',
      'Featured fact (largest)',
      `<select id="rv-summary-0" data-results-summary="0">${facts(o.summary[0])}</select>`,
      'The big number on every card.'
    ) +
      o.summary
        .slice(1)
        .map((key, i) =>
          field(
            `rv-summary-${i + 1}`,
            `Supporting fact ${i + 2}`,
            `<select id="rv-summary-${i + 1}" data-results-summary="${i + 1}">${facts(key, true)}</select>`
          )
        )
        .join('')
  )}${fold(
    'Comparison chart',
    'One bar for every driver',
    field('rv-comparison', 'Compare', `<select id="rv-comparison" data-results-comparison="1">${compare(o.comparison)}</select>`)
  )}${fold(
    'Big fields',
    '5 or more results',
    field(
      'rv-large',
      'When there are 5 or more results',
      `<select id="rv-large" data-results-large="1"><option value="cards"${!listMode ? ' selected' : ''}>Victory Spotlight cards</option><option value="leaderboard"${listMode ? ' selected' : ''}>Victory Spotlight + leaderboard rows</option></select>`,
      'The winner stays featured; the leaderboard then shows the complete classification.'
    ) +
      (listMode
        ? `<div class="field"><label for="rv-leaderboard">Leaderboard design</label><select id="rv-leaderboard" data-results-leaderboard="1"><option value=""${!o.leaderboardDesign ? ' selected' : ''}>Choose a design</option>${designs.map(d => `<option value="${esc(d.id)}"${d.id === o.leaderboardDesign ? ' selected' : ''}>${esc(d.name || 'Untitled row design')}</option>`).join('')}</select>${designs.length ? '<button class="btn ghost sm" type="button" data-results-open-rows="1">Edit in Leaderboard Editor</button>' : '<span class="muted hint">Make a row design in the Leaderboard Editor first. Cards stay on until a design is chosen.</span>'}</div>`
        : '')
  )}<p class="muted rvfoot">Heat points are available for point-scored Heat Setups. Championship points show the live total after this race is counted.</p><p id="rv-results-msg" class="muted" role="status"></p></div>
    <section class="rvpreview" aria-label="Preview of the Results Wall"><header class="rvprevhead"><div><strong>Preview</strong><span class="muted">A sample race with your choices</span></div><span class="seg" role="group" aria-label="Drivers in the sample race">${[
      2, 3, 4, 6, 8
    ]
      .map(
        n =>
          `<button type="button" class="btn${n === rvPreviewCount ? ' on' : ''}" aria-pressed="${n === rvPreviewCount}" data-rv-count="${n}">${n}</button>`
      )
      .join(
        ''
      )}</span></header><div class="rvscreen"><div class="rvstage" id="rv-stage"></div></div><p class="muted rvprevnote">${rvPreviewCount} drivers · sample data, not a saved race</p></section></div>`;
  rvPreview(box, o, designs);
  box.onchange = async ev => {
    const t = ev.target,
      d = t.dataset || {};
    if (
      d.resultsSummary === undefined &&
      d.resultsComparison === undefined &&
      d.resultsLarge === undefined &&
      d.resultsLeaderboard === undefined &&
      d.resultsAfter === undefined
    )
      return;
    const next = R.clean({ ...o, summary: o.summary.slice() });
    if (d.resultsSummary !== undefined) next.summary[Number(d.resultsSummary)] = t.value;
    if (d.resultsComparison !== undefined) next.comparison = t.value;
    if (d.resultsLarge !== undefined) next.largeField = t.value;
    if (d.resultsLeaderboard !== undefined) next.leaderboardDesign = t.value;
    if (d.resultsAfter !== undefined) next.after = t.value === 'mine' ? 'mine' : 'broadcast';
    state.settings = await api.setSettings({ resultsView: R.clean(next) });
    const msg = document.getElementById('rv-results-msg');
    if (msg) msg.textContent = 'Saved. The next finished race uses this Results Wall.';
    renderResultsSettings(box);
  };
  box.onclick = ev => {
    const n = ev.target.closest('[data-rv-count]');
    if (n) {
      rvPreviewCount = Number(n.dataset.rvCount) || 4;
      return renderResultsSettings(box);
    }
    if (ev.target.closest('[data-results-open-rows]')) {
      state.customSub = 'rows';
      renderCustom();
    }
  };
}

// Image Settings: picture sets for the Fuel and Race flag widgets. A set is made once and chosen in any widget of any layout.
let imgEd = null; // the set being edited: { id, draft, dirty }
const SET_KINDS = [
  ['fuel', 'Fuel (pictures from full to empty)'],
  ['flag', 'Race flag (one picture per state)'],
  ['lights', 'Start lights (a picture per light and per race state)'],
  ['avatars', 'Avatars (a picture per lane)'],
  ['tyres', 'Tyres (a picture per tyre)'],
  ['weather', 'Weather (a picture per state of the weather)'],
  ['conditions', 'Track conditions (an icon per item)']
];
// the pictures of a Start lights set: a grid of rows (Lights off, Countdown, one per race state) by columns (all lights, light 1 to 5)
const LIGHT_SLOTS = Widgets.LIGHT_ROWS.flatMap(([row, label]) =>
  Widgets.LIGHT_COLS.map(([n, col]) => [Widgets.lightKey(row, n), `${label}, ${col.toLowerCase()}`])
);
const AVATAR_SLOTS = Array.from({ length: Avatars.LANES }, (_, i) => [String(i + 1), `Lane ${i + 1}`]);
const COND_SLOTS = [
  ['tracktemp', 'Track temperature'],
  ['airtemp', 'Air temperature'],
  ['windspeed', 'Wind speed'],
  ['winddir', 'Wind direction (draw it pointing up: it is turned the way the wind blows)']
];
const TYRE_SLOTS = Wx.TYRES.map(t => [t.code, `${t.name} (${t.code})`]);
const setSlots = d =>
  d.kind === 'avatars'
    ? AVATAR_SLOTS
    : d.kind === 'tyres'
      ? TYRE_SLOTS
      : d.kind === 'weather'
        ? Wx.STATES
        : d.kind === 'conditions'
          ? COND_SLOTS
          : d.kind === 'fuel'
            ? Array.from({ length: Widgets.clampInt(d.steps, 2, 20, 10) }, (_, i) => [
                i,
                `${i + 1}${i === 0 ? ' (full)' : i === Widgets.clampInt(d.steps, 2, 20, 10) - 1 ? ' (empty)' : ''}`
              ])
            : d.kind === 'lights'
              ? LIGHT_SLOTS
              : Widgets.FLAG_STATES;
const setCount = d => setSlots(d).filter(([k]) => (d.images || (d.kind === 'fuel' ? [] : {}))[k]).length;

async function renderImageSets(box) {
  if (imgEd) return renderImageSetEditor(box);
  manager = null;
  const sets = await EditorData.choices(api, 'imagesets', 'media');
  // (2.4.0) every set is a card: a few of its pictures, what it is for, and how many of its pictures it has
  const pics = r =>
    (Array.isArray(r.images) ? r.images : Object.values(r.images || {})).filter(x => typeof x === 'string' && x).slice(0, 6);
  box.innerHTML =
    `<div class="row"><button class="btn primary" id="newset">New picture set</button></div>` +
    (sets.length
      ? `<div class="lgrid">${sets
          .map(r => {
            const have = setCount(r),
              all = setSlots(r).length,
              p = pics(r);
            return `<div class="card lcard"><div class="lsketch lpics">${p.length ? p.map(src => `<img src="${esc(src)}" alt="" loading="lazy">`).join('') : '<span class="muted">No pictures yet</span>'}</div><div class="lbody"><h3>${esc(r.name)}</h3><p class="muted">${esc((SET_KINDS.find(k => k[0] === r.kind) || [0, r.kind])[1])}</p><div class="lprog${all && have >= all ? ' full' : ''}"><i style="width:${all ? Math.round((100 * have) / all) : 0}%"></i></div><div class="lmeta"><span>${have} of ${all}</span>${all && have >= all ? '<span>complete</span>' : ''}</div><div class="lt-usedline" data-lt-uses="${esc(r.id)}"></div></div><div class="lactions"><button class="btn" data-edit="${esc(r.id)}">Edit</button> <button class="btn" data-dup="${esc(r.id)}">Duplicate</button> <button class="btn danger" data-del="${esc(r.id)}">Delete</button></div></div>`;
          })
          .join('')}</div>`
      : '<p class="muted">No picture sets yet.</p>');

  if (typeof LayoutTry !== 'undefined') LayoutTry.uses(box).catch(() => {}); // (2.4.0: the layouts that use each set)
  const onSetClick = (box.onclick = async ev => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.id === 'newset') {
      imgEd = { id: null, draft: { name: 'New picture set', kind: 'fuel', steps: 10, images: [] }, dirty: true };
      return renderImageSets(box);
    }
    let r = sets.find(x => x.id === (b.dataset.edit || b.dataset.dup || b.dataset.del));
    if (!r || b.disabled) return;
    b.disabled = true;
    try {
      if (b.dataset.edit || b.dataset.dup) {
        r = await api.getRecord('imagesets', r.id);
        if (box.isConnected === false || box.onclick !== onSetClick) return;
        if (!r) throw Error('This picture set no longer exists. Reopen the list and try again.');
      }
      if (b.dataset.edit) {
        imgEd = {
          id: r.id,
          draft: clone({ name: r.name, kind: r.kind, steps: r.steps || 10, images: r.images || (r.kind === 'fuel' ? [] : {}) }),
          dirty: false
        };
        return renderImageSets(box);
      }
      if (b.dataset.dup) {
        await api.add('imagesets', clone({ name: r.name + ' (copy)', kind: r.kind, steps: r.steps, images: r.images }));
        if (box.isConnected !== false && box.onclick === onSetClick) return await renderImageSets(box);
      }
      if (
        b.dataset.del &&
        (await Dialog.confirm(
          `Delete the picture set "${r.name}"?\n\nWidgets that use it show text or a number instead, until you choose another set.\n\nThis can't be undone.`,
          { ok: 'Delete', danger: true }
        ))
      ) {
        await api.remove('imagesets', r.id);
        if (box.isConnected !== false && box.onclick === onSetClick) await renderImageSets(box);
      }
    } catch (error) {
      Dialog.alert(error.message);
    } finally {
      b.disabled = false;
    }
  });
}

// The grid of a Start lights set. A cell with no picture of its own shows, dimmed, the picture it will use instead (see Widgets.lightBehind); a plain circle when there is none.
function lightsGridHtml(d) {
  const im = d.images || {};
  const cell = (key, label) => {
    const own = im[key],
      behind = own ? '' : Widgets.lightBehind(im, key);
    return `<td class="lgcell"><label class="lgpick${own ? '' : behind ? ' behind' : ' none'}" title="${esc(label + (own ? '' : behind ? ': uses the ' + ((Widgets.LIGHT_ROWS.find(r => r[0] === behind.split('_')[0]) || [])[1] || behind) + ' picture' + (behind.includes('_') ? ' of light ' + behind.split('_')[1] : '') : ': a plain round light'))}">${own ? `<img src="${esc(own)}" alt="">` : behind ? `<img src="${esc(im[behind])}" alt="">` : '<span class="lgcircle" aria-hidden="true"></span>'}<input type="file" accept="image/*" aria-label="Picture for ${esc(label)}" data-slot="${key}"></label>${own ? `<button class="lgx" type="button" data-clear="${key}" aria-label="Remove the picture for ${esc(label)}" title="Remove">\u00d7</button>` : ''}</td>`;
  };
  return `<div class="wrap"><table class="fields lgrid"><tr><th>State</th>${Widgets.LIGHT_COLS.map(([, c]) => `<th>${esc(c)}</th>`).join('')}</tr>${Widgets.LIGHT_ROWS.map(([row, label]) => `<tr><th scope="row">${esc(label)}</th>${Widgets.LIGHT_COLS.map(([n, c]) => cell(Widgets.lightKey(row, n), `${label}, ${c.toLowerCase()}`)).join('')}</tr>`).join('')}</table></div>`;
}
// what the five lights look like in a state, from the pictures of the set (three lights on, two off): the countdown or a race state
const LIGHT_PREVIEWS = [['countdown', 'The countdown'], ...Widgets.FLAG_STATES];
function lightsPreviewHtml(d) {
  const st = LIGHT_PREVIEWS.some(([k]) => k === imgEd.preview) ? imgEd.preview : 'countdown',
    im = d.images || {};
  return `<div class="lgprev"><label>Preview: <select id="is-prev">${LIGHT_PREVIEWS.map(([k, t]) => `<option value="${k}"${k === st ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
    <div class="lgprevbox" id="is-prevbox">${Widgets.lightsHtml(3, { pick: (i, lit) => Widgets.lightPic(im, st, i, lit) }, Widgets.lightColor({}, st))}</div><span class="muted">Three lights on, two off.</span></div>`;
}

const PS_KIND_NAMES = {
  fuel: 'Fuel',
  flag: 'Race flag',
  lights: 'Start lights',
  avatars: 'Avatars',
  tyres: 'Tyres',
  weather: 'Weather',
  conditions: 'Conditions'
};
const PS_KIND_ICONS = {
  fuel: 'fuel',
  flag: 'flag',
  lights: 'lights',
  avatars: 'driver',
  tyres: 'tyre',
  weather: 'weather',
  conditions: 'gauge'
};
function renderImageSetEditor(box) {
  const d = imgEd.draft,
    fuel = d.kind === 'fuel';
  // (2.4.0) Picture Bench: what the set is for as seven cards, the pictures as tiles you drop a file on (or click), and a big live preview on the right
  const slots = d.kind === 'lights' ? [] : setSlots(d),
    have = setCount(d),
    all = setSlots(d).length;
  const kinds = `<fieldset id="is-kind" class="ps-kinds"${imgEd.id ? ' disabled' : ''}><legend>What is it for?${imgEd.id ? ' <span class="muted">(fixed once a set is saved)</span>' : ''}</legend><div class="ps-kgrid">${SET_KINDS.map(
    ([k, t]) =>
      `<label class="ps-kind${k === d.kind ? ' on' : ''}" title="${esc(t)}"><input type="radio" name="is-kind" value="${k}"${k === d.kind ? ' checked' : ''}${imgEd.id ? ' disabled' : ''}><span class="ps-kico">${Icons.svg(PS_KIND_ICONS[k] || 'square', { size: 18, stroke: 1.8 })}</span><b>${esc(PS_KIND_NAMES[k] || t)}</b></label>`
  ).join('')}</div></fieldset>`;
  const tile = ([k, label], i) => {
    const img = (d.images || {})[k],
      std =
        d.kind === 'avatars'
          ? `<img class="ps-std" src="${esc(Avatars.STANDARD[Number(k) - 1])}" alt="">`
          : ['tyres', 'weather', 'conditions'].includes(d.kind)
            ? `<span class="ps-std"><span class="setslot">${WxW.slotIcon(d.kind, k)}</span></span>`
            : '';
    const sub = fuel
      ? i === 0
        ? 'Full'
        : i === slots.length - 1
          ? 'Empty'
          : Math.round((100 * (slots.length - 1 - i)) / (slots.length - 1)) + '%'
      : '';
    return `<div class="ps-tile${img ? ' has' : ''}" data-drop="${esc(k)}"><label class="ps-pic" title="Choose or drop a picture for ${esc(String(label))}">${
      img
        ? `<img src="${esc(img)}" alt="">`
        : `${std}<span class="ps-drop">${Icons.svg('arrow', { size: 14, stroke: 2 })}${std ? 'Drop your own' : 'Drop a picture<br>or click'}</span>`
    }<input type="file" accept="image/*" aria-label="Picture for ${esc(String(label))}" data-slot="${k}"></label><div class="ps-lab"><b>${esc(fuel ? String(i + 1) : String(label))}</b>${sub ? `<span>${esc(sub)}</span>` : ''}${img ? `<button class="btn ghost icon sm" type="button" data-clear="${k}" title="Remove this picture" aria-label="Remove the picture of ${esc(String(label))}">${Icons.svg('trash', { size: 14, stroke: 1.8 })}</button>` : ''}</div></div>`;
  };
  const pv = () => {
    if (d.kind === 'lights') return lightsPreviewHtml(d);
    if (fuel) {
      const n = Widgets.clampInt(d.steps, 2, 20, 10),
        pct = imgEd.pvFuel ?? 62,
        frac = pct / 100,
        stepNo = Math.max(0, Math.min(n - 1, n - Math.ceil(frac * n - 1e-9))),
        img = (d.images || [])[stepNo];
      return `<div class="ps-big">${img ? `<img src="${esc(img)}" alt="">` : `<span class="ps-none">No picture ${stepNo + 1}: the widget shows the fuel number here.</span>`}</div><input type="range" id="is-fuelpct" min="0" max="100" value="${pct}" aria-label="Fuel left"><div class="ps-scale"><span>Empty</span><b>${pct}% left · picture ${stepNo + 1}</b><span>Full</span></div>`;
    }
    const keys = slots.map(x => x[0]),
      cur = keys.includes(imgEd.pvSlot) ? imgEd.pvSlot : keys[0],
      img = (d.images || {})[cur],
      label = (slots.find(x => x[0] === cur) || [0, ''])[1];
    const std =
      d.kind === 'avatars'
        ? `<img class="ps-bigstd" src="${esc(Avatars.STANDARD[Number(cur) - 1])}" alt="">`
        : ['tyres', 'weather', 'conditions'].includes(d.kind)
          ? `<span class="ps-bigstd">${WxW.slotIcon(d.kind, cur)}</span>`
          : `<span class="ps-none">No picture: the widget shows "${esc(String(label))}" as text.</span>`;
    return `<div class="ps-big">${img ? `<img src="${esc(img)}" alt="">` : std}</div><label class="ps-field">Show<select id="is-pv">${slots.map(([k, t]) => `<option value="${esc(k)}"${k === cur ? ' selected' : ''}>${esc(String(t))}</option>`).join('')}</select></label>`;
  };
  box.innerHTML = `<div class="ps-bench">${pitBoard({
    cls: 'ps-pitboard',
    back: 'Picture sets',
    backId: 'is-back',
    eyebrow: 'Picture set · ' + (PS_KIND_NAMES[d.kind] || d.kind).toLowerCase(),
    name: `<input type="text" class="pb-name" id="is-name" value="${esc(d.name)}" maxlength="40" aria-label="Name">`,
    msgId: 'is-msg',
    undoId: 'is-undo',
    redoId: 'is-redo',
    saveId: 'is-save',
    save: 'Save picture set'
  })}<div class="ps-cols"><div class="ps-main">${kinds}
    <div class="ps-head"><span class="ps-eye">Pictures</span>${fuel ? `<label class="ps-steps">How many<input type="number" id="is-steps" min="2" max="20" value="${Widgets.clampInt(d.steps, 2, 20, 10)}"></label>` : ''}<p class="ps-note">${fuel ? 'The first picture shows when the tank is full, the last when it is empty.' : d.kind === 'lights' ? 'Every light can have its own picture for every state of the race. A cell you leave empty uses the dimmed picture shown in it: the "All lights" picture of its row. Every row stands on its own: the Countdown pictures are only for the countdown, and a state with no picture is drawn as plain round lights (Lights off is for every light that is off, in every state). A light with no picture at all is drawn as a plain round light.' : d.kind === 'avatars' ? 'One avatar for each lane (up to 8). The Avatar widget shows the picture of the driver; a driver without a picture gets the avatar of the lane he or she drives in. A lane you leave empty uses the standard avatar shown dimmed in it.' : d.kind === 'tyres' ? 'One picture for each tyre. A tyre you leave empty is drawn in the colours of Formula 1 (the standard picture shown dimmed in it).' : d.kind === 'weather' ? 'One picture for each state of the weather. A state you leave empty is drawn (the standard picture is shown dimmed in it).' : d.kind === 'conditions' ? 'An icon for each item of the Track Conditions widget. An item you leave empty is drawn (the standard icon is shown dimmed in it). Draw the wind direction pointing up: it is turned to the direction the wind blows.' : 'A state without a picture shows its name as text.'} Pictures keep their transparency (a PNG stays a PNG).${Picture.NOTE}</p></div>
    ${d.kind === 'lights' ? lightsGridHtml(d) : `<div class="ps-tiles">${slots.map(tile).join('')}</div>`}
    <div class="ps-prog"><span>${have} of ${all} pictures</span><span class="ps-bar"><i style="width:${all ? Math.round((100 * have) / all) : 0}%"></i></span><span>${have >= all ? 'Complete' : 'Drop a file on a tile to fill it'}</span></div></div>
    <aside class="ps-preview" aria-label="Preview"><header><strong>Live preview</strong></header><div id="is-pvbox">${pv()}</div></aside></div></div>`;
  // Undo and redo (a typed name is one step after a quiet moment; every other change is a step of its own)
  const U = draftUndo(imgEd, 'is', () => renderImageSetEditor(box)),
    mark = U.mark,
    step = U.step;
  const $ = id => document.getElementById(id);
  $('is-name').oninput = e => {
    d.name = e.target.value;
    mark();
  };
  pbWatch(box, () => imgEd && imgEd.dirty);
  const pvBox = $('is-pvbox');
  if (pvBox)
    pvBox.oninput = pvBox.onchange = e => {
      if (e.target.id === 'is-fuelpct') {
        // (only the picture and its words change while the slider is dragged: the slider itself stays, so the drag goes on)
        imgEd.pvFuel = Number(e.target.value);
        const tmp = document.createElement('div');
        tmp.innerHTML = pv();
        ['.ps-big', '.ps-scale'].forEach(q => {
          const from = tmp.querySelector(q),
            to = pvBox.querySelector(q);
          if (from && to) to.innerHTML = from.innerHTML;
        });
      } else if (e.target.id === 'is-pv') {
        imgEd.pvSlot = e.target.value;
        renderImageSetEditor(box);
      }
    };
  if (box.addEventListener && !box._psDrop) {
    box._psDrop = true; // (one set of listeners for the box: they act on the editor that is open)
    box.addEventListener('dragover', ev => {
      const t = ev.target.closest && ev.target.closest('[data-drop]');
      if (!t || !imgEd) return;
      ev.preventDefault();
      t.classList.add('over');
    });
    box.addEventListener('dragleave', ev => {
      const t = ev.target.closest && ev.target.closest('[data-drop]');
      if (t) t.classList.remove('over');
    });
    box.addEventListener('drop', ev => {
      const t = ev.target.closest && ev.target.closest('[data-drop]');
      const file = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
      if (!t || !imgEd || !file) return;
      ev.preventDefault();
      t.classList.remove('over');
      if (box.onchange) box.onchange({ target: { dataset: { slot: t.dataset.drop }, files: [file] } });
    });
  }
  if ($('is-prev'))
    $('is-prev').onchange = e => {
      imgEd.preview = e.target.value;
      renderImageSetEditor(box);
    };
  $('is-kind').onchange = e => {
    if (!e.target.value || e.target.value === d.kind) return;
    d.kind = e.target.value;
    d.images = d.kind === 'fuel' ? [] : {};
    step();
    renderImageSetEditor(box);
  };
  if ($('is-steps'))
    $('is-steps').onchange = e => {
      d.steps = Widgets.clampInt(e.target.value, 2, 20, 10);
      d.images = (d.images || []).slice(0, d.steps);
      step();
      renderImageSetEditor(box);
    };
  let imgSaving = false; // (a second click while the first is being written would add the set twice)
  $('is-save').onclick = async () => {
    if (imgSaving) return;
    d.name = d.name.trim();
    if (!d.name) {
      $('is-msg').textContent = 'Please give the set a name.';
      return;
    }
    imgSaving = true;
    try {
      U.hist.touch();
      const token = U.hist.commit(); // (the state that is written is the one the steps call saved)
      const data = clone({
        name: d.name,
        kind: d.kind,
        ...(d.kind === 'fuel'
          ? {
              steps: Widgets.clampInt(d.steps, 2, 20, 10),
              images: Array.from({ length: Widgets.clampInt(d.steps, 2, 20, 10) }, (_, i) => (d.images || [])[i] || '')
            }
          : { images: d.images || {} })
      });
      if (imgEd.id) await api.update('imagesets', imgEd.id, data);
      else {
        const row = await api.add('imagesets', data);
        imgEd.id = row.id;
      }
      U.hist.markSaved(token);
      imgEd.dirty = !U.hist.isClean();
      $('is-msg').textContent = 'Saved.'; // (a change made while it was being written is not saved yet)
    } finally {
      imgSaving = false;
    }
  };
  $('is-back').onclick = async () => {
    const ed = imgEd;
    if (ed.dirty) {
      if (
        !(await Dialog.confirm('Discard your unsaved changes to this picture set?', {
          ok: 'Discard changes',
          cancel: 'Keep editing',
          danger: true
        }))
      )
        return;
      if (imgEd !== ed || state.tab !== 'custom') return; // (the editor was closed meanwhile)
    }
    draftUndoEnd(imgEd);
    imgEd = null;
    renderImageSets(box);
  };
  box.onclick = ev => {
    const b = ev.target.closest('button');
    if (b && b.dataset.clear !== undefined) {
      if (Array.isArray(d.images)) d.images[b.dataset.clear] = '';
      else delete d.images[b.dataset.clear];
      step();
      renderImageSetEditor(box);
    }
  }; // (a picture set of a flag or of lights is a list of the cells that have a picture: a removed picture leaves no empty entry)
  box.onchange = async ev => {
    const t = ev.target;
    if (t.dataset.slot === undefined || !t.files || !t.files[0]) return;
    try {
      const img = await resizeImage(t.files[0], fuel ? 256 : 512, true);
      if (fuel) {
        d.images = d.images || [];
        d.images[Number(t.dataset.slot)] = img;
      } else {
        d.images = d.images || {};
        d.images[t.dataset.slot] = img;
      }
      step();
      renderImageSetEditor(box);
    } catch (x) {
      $('is-msg').textContent = x.message;
    }
  };
}

// Leaderboard Editor: designs for one row of the leaderboard, built from the driver widgets
async function renderRowList(box) {
  manager = null;
  const designs = await api.list('rowdesigns');
  // (2.4.0) every design is a card: a preview of three sample drivers in it (the real rows, as in the editor), its note, its height and widgets
  box.innerHTML =
    `<div class="row"><button class="btn primary" id="newr">New row design</button></div>` +
    (designs.length
      ? `<div class="lgrid">${designs
          .map(
            l =>
              `<div class="card lcard"><div class="lsketch lrows" data-rows="${esc(l.id)}"></div><div class="lbody"><h3>${esc(l.name)}</h3>${l.note ? `<p class="muted">${esc(l.note)}</p>` : ''}<div class="lmeta"><span>Row height ${esc(l.ratioH)}</span><span>${(l.widgets || []).length} widgets</span></div></div><div class="lactions"><button class="btn" data-edit="${esc(l.id)}">Edit</button> <button class="btn" data-dup="${esc(l.id)}">Duplicate</button> <button class="btn danger" data-del="${esc(l.id)}">Delete</button></div></div>`
          )
          .join('')}</div>`
      : '<div class="lempty"><p class="muted">No row designs yet. Make one, and every leaderboard that uses it shows your rows.</p></div>');
  if (typeof document !== 'undefined' && box.querySelectorAll)
    designs.forEach(l => {
      const el = box.querySelector(`[data-rows="${typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(l.id) : l.id}"]`);
      if (!el) return;
      try {
        el.innerHTML = Rows.sampleHtml({ ...l, widgets: knownWidgets(l.widgets || []) }, 3, []);
      } catch {
        el.innerHTML = '<span class="muted">No preview</span>';
      }
    });

  const keep = l =>
    clone({
      kind: 'row',
      name: l.name,
      note: l.note || '',
      ratioW: Widgets.U,
      ratioH: l.ratioH,
      widgets: l.widgets,
      guides: l.guides || { v: [], h: [] },
      laneColors: [],
      classView: l.classView,
      classId: l.classId,
      gap: l.gap,
      radius: l.radius,
      header: l.header,
      headerH: l.headerH,
      headerBg: l.headerBg,
      headerText: l.headerText,
      rowBg: l.rowBg,
      rowText: l.rowText,
      altBg: l.altBg,
      states: l.states,
      outBg: l.outBg,
      outText: l.outText,
      pitBg: l.pitBg,
      pitText: l.pitText,
      penBg: l.penBg,
      penText: l.penText,
      leaderBg: l.leaderBg,
      leaderText: l.leaderText
    });
  const open = (draft, id) => {
    state.editing = {
      id,
      kind: 'row',
      draft: { guides: { v: [], h: [] }, laneColors: [], note: '', ...draft, widgets: knownWidgets(draft.widgets), kind: 'row' },
      unknown: unknownWidgets(draft.widgets),
      sel: [],
      snap: true,
      dirty: id === null,
      dupStep: null,
      lastDup: null
    };
    render();
  };
  box.onclick = async ev => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.id === 'newr') return open(Rows.defaultDesign(), null);
    const l = designs.find(x => x.id === (b.dataset.edit || b.dataset.dup || b.dataset.del));
    if (!l) return;
    if (b.dataset.edit) open(keep(l), l.id);
    if (b.dataset.dup) {
      await api.add('rowdesigns', { ...keep(l), name: l.name + ' (copy)' });
      renderRowList(box);
    }
    if (
      b.dataset.del &&
      (await Dialog.confirm(
        `Delete the row design "${l.name}"?\n\nLeaderboards that use it show the classic table instead.\n\nThis can't be undone.`,
        {
          ok: 'Delete',
          danger: true
        }
      ))
    ) {
      await api.remove('rowdesigns', l.id);
      if (box.isConnected !== false && !state.editing) renderRowList(box); // (the list is still on screen)
    }
  };
}

async function renderLayoutList(box) {
  manager = null;
  const layouts = await EditorData.choices(api, 'layouts');
  const prop = l => `${l.ratioW}:${l.ratioH}`;
  // (2.4.0) every layout is a card with a sketch of its page: the boxes of its widgets, drawn once the layout is read (the list itself does not carry them)
  // (2.4.0, "Try It") usedId: the race setups that use the layout come in under it
  const card = (key, name, note, ratio, count, actions, builtIn = false, usedId = '') =>
    `<div class="card lcard"><div class="lsketch" style="aspect-ratio:${ratio.replace(':', ' / ')}" data-sketch="${esc(key)}"></div><div class="lbody"><h3>${esc(name)}${builtIn ? ' <span class="ltag">Built in</span>' : ''}</h3>${note ? `<p class="muted">${esc(note)}</p>` : ''}<div class="lmeta"><span>${esc(ratio)}</span><span>${count} widgets</span></div>${usedId ? `<div class="lt-usedline" data-lt-used="${esc(usedId)}"></div>` : ''}</div><div class="lactions">${actions}</div></div>`;
  box.innerHTML =
    `<div class="row"><button class="btn primary" id="newl">New layout</button></div>
    <div class="lgrid">` +
    layouts
      .map(l =>
        card(
          l.id,
          l.name,
          l.note || '',
          prop(l),
          l.widgetCount ?? (l.widgets || []).length,
          `<button class="btn" data-try="${esc(l.id)}" title="Open it and play a sample race">Try it</button> <button class="btn" data-edit="${esc(l.id)}">Edit</button> <button class="btn" data-dup="${esc(l.id)}">Duplicate</button> <button class="btn danger" data-del="${esc(l.id)}">Delete</button>`,
          false,
          l.id
        )
      )
      .join('') +
    card(
      'builtin:default',
      'Default layout',
      'Used when a race setup has none',
      '16:9',
      Widgets.defaultLayout().widgets.length,
      '<button class="btn" id="copydef">Copy to edit</button>',
      true
    ) +
    card(
      'builtin:token',
      'Default token layout',
      'Used by a Time Token Session when its race setup has none',
      '16:9',
      Widgets.tokenLayout().widgets.length,
      '<button class="btn" id="copytok">Copy to edit</button>',
      true
    ) +
    '</div>';
  // the sketches: the widgets of each layout as boxes on its page
  const sketch = (el, l) => {
    const ws = (l && l.widgets) || [];
    if (!el || !ws.length) return;
    const W = Math.max(1, ...ws.map(w => (Number(w.x) || 0) + (Number(w.w) || 0))),
      H = Math.max(1, ...ws.map(w => (Number(w.y) || 0) + (Number(w.h) || 0)), (W * (Number(l.ratioH) || 9)) / (Number(l.ratioW) || 16));
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${ws
      .slice(0, 120)
      .map(
        w =>
          `<rect x="${Number(w.x) || 0}" y="${Number(w.y) || 0}" width="${Math.max(1, Number(w.w) || 0)}" height="${Math.max(1, Number(w.h) || 0)}" rx="${W / 160}"></rect>`
      )
      .join('')}</svg>`;
  };
  if (typeof document !== 'undefined' && box.querySelector) {
    sketch(box.querySelector('[data-sketch="builtin:default"]'), Widgets.defaultLayout());
    sketch(box.querySelector('[data-sketch="builtin:token"]'), Widgets.tokenLayout());
    if (api.getRecord)
      layouts.forEach(l =>
        Promise.resolve(api.getRecord('layouts', l.id))
          .then(
            r =>
              box.isConnected !== false &&
              sketch(box.querySelector(`[data-sketch="${typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(l.id) : l.id}"]`), r)
          )
          .catch(() => {})
      );
  }

  if (typeof LayoutTry !== 'undefined' && box.querySelector) LayoutTry.cards(box, layouts).catch(() => {});
  const open = (draft, id, tryIt = false) => {
    state.editing = {
      id,
      draft: { guides: { v: [], h: [] }, laneColors: [], note: '', ...draft, widgets: knownWidgets(draft.widgets) },
      unknown: unknownWidgets(draft.widgets),
      sel: [],
      snap: true,
      dirty: id === null,
      dupStep: null,
      lastDup: null
    };
    if (tryIt && typeof LayoutTry !== 'undefined') LayoutTry.start(state.editing, { fresh: true }); // (Try it: the editor opens playing)
    render();
  };
  box.onclick = async ev => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.id === 'newl') return open({ name: 'New layout', ratioW: 16, ratioH: 9, widgets: [] }, null);
    if (b.id === 'copytok') {
      const d = Widgets.tokenLayout();
      return open(
        { name: 'My token layout', ratioW: d.ratioW, ratioH: d.ratioH, widgets: d.widgets, guides: { v: [], h: [] }, laneColors: [] },
        null
      );
    }
    if (b.id === 'copydef') {
      const d = Widgets.defaultLayout();
      return open(
        { name: 'My layout', ratioW: d.ratioW, ratioH: d.ratioH, widgets: d.widgets, guides: { v: [], h: [] }, laneColors: [] },
        null
      );
    }
    let l = layouts.find(x => x.id === (b.dataset.edit || b.dataset.dup || b.dataset.del || b.dataset.try));
    if (!l) return;
    if (b.dataset.edit || b.dataset.dup || b.dataset.try) {
      try {
        l = api.getRecord ? await api.getRecord('layouts', l.id) : l;
        if (!l) throw Error('This layout is no longer available. Refresh the list.');
      } catch (error) {
        Dialog.alert(error.message);
        return;
      }
    }
    if (b.dataset.edit || b.dataset.try)
      open(
        clone({
          name: l.name,
          note: l.note || '',
          ratioW: l.ratioW,
          ratioH: l.ratioH,
          widgets: l.widgets,
          guides: l.guides,
          laneColors: l.laneColors,
          ...Frame.pickLayout(l),
          ...Backdrop.pick(l)
        }),
        l.id,
        !!b.dataset.try
      );
    if (b.dataset.dup) {
      await api.add(
        'layouts',
        clone({
          name: l.name + ' (copy)',
          note: l.note || '',
          ratioW: l.ratioW,
          ratioH: l.ratioH,
          widgets: l.widgets,
          guides: l.guides,
          laneColors: l.laneColors,
          ...Frame.pickLayout(l),
          ...Backdrop.pick(l)
        })
      );
      renderLayoutList(box);
    }
    // (2.4.0, "Try It") Delete names the race setups that use the layout and lets you choose what they use instead (a backup first)
    if (b.dataset.del && typeof LayoutTry !== 'undefined') {
      if ((await LayoutTry.remove(l, layouts)) && box.isConnected !== false && !state.editing) renderLayoutList(box);
    } else if (
      b.dataset.del &&
      (await Dialog.confirm(
        `Delete the layout "${l.name}"?\n\nRace setups that use it go back to the default layout (the default token layout for a Time Token Session).\n\nThis can't be undone.`,
        { ok: 'Delete', danger: true }
      ))
    ) {
      await api.remove('layouts', l.id);
      if (box.isConnected !== false && !state.editing) renderLayoutList(box); // (the list is still on screen)
    }
  };
}

// ---------------- the editor ----------------
// ed.sel holds the selected widgets themselves (one or several); everything below works on that list.
// What a widget shows in the editor. A Leaderboard that uses a row design shows that design (eight made-up drivers, the most a race has), drawn as in a race:
// the rows shrink as a whole until all of them are inside the frame.
function editorPreviewContext(ed) {
  return {
    chartPreviewTrack: (ed.previewTracks || []).find(t => t.id === ed.previewTrackId),
    layout: ed.draft,
    rowDesigns: ed.rowDesigns || [],
    chartDesigns: ed.chartDesigns || [],
    imageSets: ed.imageSets || [],
    clubLogo: state.settings?.clubLogo || '',
    play: typeof LayoutTry !== 'undefined' ? LayoutTry.shared(ed) : null // (2.4.0, "Try It": the sample race on the canvas, when it plays)
  };
}
function previewOf(def, w) {
  return Widgets.sampleOf(def, w.lane, { ...w, previewContext: editorPreviewContext(state.editing) });
}
const TINY = 60; // a widget narrower or lower than this many units (6% of the width) is small on the screen
function widgetHtml(w, sel, single, d) {
  const def = Widgets.def(w.type),
    row = d.kind === 'row',
    tiny = single && (w.w < TINY || w.h < TINY);
  const badge = def.perLane && !row ? `<span class="lw-lane">${w.follow ? 'Followed' : 'L' + (w.lane + 1)}</span>` : '';
  const handles = single
    ? '<i class="h nw" data-h="nw"></i><i class="h ne" data-h="ne"></i><i class="h sw" data-h="sw"></i><i class="h se" data-h="se"></i>'
    : '';
  // (2.4.0, "Try It") a lane the sample race does not have is faded; a custom text with a word it does not know is ringed
  const tried = typeof LayoutTry !== 'undefined' && !row;
  return WidgetView.html(w, d, previewOf(def, w), {
    row,
    extraClass:
      (sel ? ' sel' : '') +
      (tiny ? ' tiny' : '') +
      (row ? ' flat' : '') +
      (tried && LayoutTry.off(state.editing, w) ? ' lt-off' : '') +
      (tried && LayoutTry.bad(w) ? ' lt-bad' : ''),
    attributes: `data-i="${d.widgets.indexOf(w)}"`,
    decoration: badge + handles
  });
}

// is the picture set with this id one that exists (and fits the widget)? does the widget carry pictures of its own?
const setIn = (id, def) =>
  !!id &&
  (state.editing.imageSets || []).some(
    r =>
      r.id === id &&
      ((def.type === 'fuel' && r.kind === 'fuel') ||
        (def.type === 'flag' && r.kind === 'flag') ||
        (def.type === 'lights' && r.kind === 'lights') ||
        (def.type === 'avatar' && r.kind === 'avatars') ||
        (def.type === 'tyre' && r.kind === 'tyres') ||
        (def.type === 'wxforecast' && r.kind === 'weather') ||
        (def.type === 'wxconditions' && r.kind === 'conditions'))
  );
const ownPictures = w =>
  w.type === 'fuel'
    ? ((w.opt || {}).stepImages || []).some(Boolean)
    : w.type === 'flag'
      ? Widgets.FLAG_STATES.some(([k]) => (w.opt || {})['img_' + k])
      : false;

// (2.4.0, "Editor Panels") the arrange tools as small pictures: a box against a line for Align, the box in a stack for Layer
const ARR_SVG = body =>
  `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">${body}</svg>`;
const ARR_ICON = {
  'align-left': ARR_SVG(
    '<path d="M2.5 2v12"/><rect x="5" y="4" width="8" height="3" rx=".8"/><rect x="5" y="9" width="5" height="3" rx=".8"/>'
  ),
  'align-center': ARR_SVG(
    '<path d="M8 2v12"/><rect x="3.5" y="4" width="9" height="3" rx=".8"/><rect x="5" y="9" width="6" height="3" rx=".8"/>'
  ),
  'align-right': ARR_SVG(
    '<path d="M13.5 2v12"/><rect x="3" y="4" width="8" height="3" rx=".8"/><rect x="6" y="9" width="5" height="3" rx=".8"/>'
  ),
  'align-top': ARR_SVG(
    '<path d="M2 2.5h12"/><rect x="4" y="5" width="3" height="8" rx=".8"/><rect x="9" y="5" width="3" height="5" rx=".8"/>'
  ),
  'align-middle': ARR_SVG(
    '<path d="M2 8h12"/><rect x="4" y="3.5" width="3" height="9" rx=".8"/><rect x="9" y="5" width="3" height="6" rx=".8"/>'
  ),
  'align-bottom': ARR_SVG(
    '<path d="M2 13.5h12"/><rect x="4" y="3" width="3" height="8" rx=".8"/><rect x="9" y="6" width="3" height="5" rx=".8"/>'
  ),
  'layer-front': ARR_SVG('<path d="M3 2.5h10"/><path d="M8 13.5V5.5M5 8.5l3-3 3 3"/>'),
  'layer-forward': ARR_SVG('<path d="M8 12.5V3.5M5 6.5l3-3 3 3"/>'),
  'layer-backward': ARR_SVG('<path d="M8 3.5v9M5 9.5l3 3 3-3"/>'),
  'layer-back': ARR_SVG('<path d="M3 13.5h10"/><path d="M8 2.5v8M5 7.5l3 3 3-3"/>'),
  'dist-x': ARR_SVG('<path d="M2 2v12M14 2v12"/><rect x="6" y="5" width="4" height="6" rx=".8"/>'),
  'dist-y': ARR_SVG('<path d="M2 2h12M2 14h12"/><rect x="5" y="6" width="6" height="4" rx=".8"/>')
};
// (2.4.0, "Editor Panels") an explanation in the settings shows one line; More opens the rest, when there is more
function foldSideHints(root) {
  if (!root || !root.querySelectorAll) return;
  root.querySelectorAll('.hint:not([data-fold]),.sidegroup p.muted:not([data-fold])').forEach(h => {
    if (!h.offsetParent) return; // (in a closed folder: measured when it opens)
    h.dataset.fold = '1';
    if (h.scrollHeight <= h.clientHeight + 2) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'hint-more';
    b.textContent = 'More';
    b.onclick = ev => {
      ev.stopPropagation();
      b.textContent = h.classList.toggle('open') ? 'Less' : 'More';
    };
    h.after(b);
  });
}
function sideHtml() {
  const sel = state.editing.sel;
  // The settings are grouped like folders (Title, Text, Background and border, the widget's own options); they start closed, and a folder stays as you left it
  const opened = state.sideOpen || (state.sideOpen = new Set()); // (1.29.1: the folders start closed; the ones you open stay open for the next widget)
  const group = (name, label, inner) =>
    inner.trim()
      ? `<details class="sidegroup" data-side="${name}"${opened.has(name) ? ' open' : ''}><summary>${typeof WidgetSettings !== 'undefined' ? WidgetSettings.folderHeading(name, label) : esc(label)}</summary>${inner}</details>`
      : '';
  const tidyHint =
    '<span class="muted hint">Moves every edge to the nearest grid line (5 units), so widgets that touch keep touching. Undo puts them back.</span>';
  const snapHint =
    '<p class="muted hint">Hold Ctrl (Cmd on a Mac) while you drag to snap to the grid only. A pink line shows where an edge lines up with another widget or a guideline.</p>';
  if (!sel.length)
    return `<p class="muted">Click a widget to change its settings. Shift-click or drag a rectangle to select several, and Ctrl+A selects all. Add widgets from the list on the left.</p>
    ${group('arrange', 'Arrange', `${snapHint}<div class="row"><button class="btn" id="s-tidyall">Tidy all widgets to the grid</button></div>${tidyHint}`)}`;
  const single = sel.length === 1,
    w0 = sel[0],
    defs = sel.map(w => Widgets.def(w.type)),
    row = state.editing.draft.kind === 'row';
  const common = get => {
    const v = get(w0);
    return sel.every(w => get(w) === v) ? v : undefined;
  };
  const color = (key, label) => {
    const v = common(w => w[key]);
    return `<div class="field"><label>${label}</label><div class="inline"><input type="color" data-color="${key}" value="${esc(v || '#888888')}" aria-label="${label}">
      <label><input type="checkbox" data-theme="${key}" ${v === '' ? 'checked' : ''}> Theme default</label></div></div>`;
  };
  const lane = common(w => w.lane),
    follow = common(w => !!w.follow), // (2.5.2 Solo: the widget shows the lane the car is on; its own lane in every other race)
    allLane = defs.every(d => d.perLane) && !row;
  const size = common(w => w.textSize),
    tsize = common(w => w.titleSize),
    showT = common(w => w.showTitle !== false);
  const sameType = sel.every(w => w.type === w0.type),
    d0 = defs[0];
  const flagStyle = w0.type === 'flag' ? Widgets.flagStyleOf(w0.opt) : '';
  const opts = w0.opt?.composition
    ? '<p class="muted">Composed widget · content is an independent copy from Widget Builder. The appearance controls below apply to this copy.</p>'
    : !sameType
      ? ''
      : (typeof PluginDisplay !== 'undefined' && PluginDisplay.TYPES.has(w0.type)
          ? PluginDisplayClient.options(w0).filter((_, i) => i === 0 || sel.every(w => w.opt?.pluginView === w0.opt?.pluginView))
          : d0.options
        )
          .filter(
            o =>
              !(d0.type === 'clock' && o.key === 'style' && typeof WidgetSettings !== 'undefined') &&
              !(
                o.liveTrackOnly &&
                !sel.every(w => (state.editing.chartDesigns || []).find(d => d.id === w.opt?.chartDesign)?.style === 'track')
              ) &&
              !(o.classic && (w0.opt || {}).design) &&
              !(o.rowsOnly && !(w0.opt || {}).design) &&
              !(o.own && setIn((w0.opt || {}).imageSet, d0)) &&
              !(o.when && !o.when.includes(flagStyle)) &&
              !(o.show && !o.show(w0.opt || {}))
          )
          .map(o => {
            // (show: a setting that only appears when it is of use, for instance the lane to compare with)
            const v =
                o.key === 'flagStyle'
                  ? flagStyle
                  : (common(w => (w.opt || {})[o.key]) ?? (o.defaultOf ? o.defaultOf(w0.opt || {}) : o.default)),
              id = `o-${o.key}`;
            if (o.type === 'imageset')
              return `<div class="field"><label for="${id}">${esc(o.label)}</label><select id="${id}" data-opt="${o.key}"><option value="">${ownPictures(w0) ? 'None: pictures of this widget' : d0.type === 'flag' ? 'None (shows the flag name as text)' : d0.type === 'lights' ? 'None (plain round lights)' : d0.type === 'avatar' ? 'Standard avatars (built in)' : o.noneLabel || 'None'}</option>${d0.type === 'avatar' ? `<option value="none"${v === 'none' ? ' selected' : ''}>No avatars (the first letter of the name)</option>` : ''}${(
                state.editing.imageSets || []
              )
                .filter(r => r.kind === o.kind)
                .map(r => `<option value="${esc(r.id)}"${r.id === v ? ' selected' : ''}>${esc(r.name)}</option>`)
                .join(
                  ''
                )}</select>${d0.type === 'avatar' || (state.editing.imageSets || []).some(r => r.kind === o.kind) ? '' : '<p class="muted">No sets yet. Make one under Customization > Picture sets.</p>'}${!setIn(v, d0) && sameType && ownPictures(w0) ? '<button class="btn" type="button" data-saveset="1">Save this widget\'s pictures as a set</button>' : ''}</div>`;
            if (o.type === 'team')
              return `<div class="field"><label for="${id}">${esc(o.label)}</label><select id="${id}" data-opt="${o.key}"><option value="">The team of the lane</option>${(state.editing.teams || []).map(t => `<option value="${esc(t.id)}"${t.id === v ? ' selected' : ''}>${esc(t.name || '(unnamed)')}</option>`).join('')}</select><span class="muted hint">A team of the lane is the team you chose on the Home tab. Choose a team from the database to always show that team.</span></div>`;
            if (o.type === 'chartdesign')
              return `<div class="field"><label for="${id}">${esc(o.label)}</label><select id="${id}" data-opt="${o.key}"><option value="">Choose a chart design</option>${v && !(state.editing.chartDesigns || []).some(r => r.id === v) ? `<option value="${esc(v)}" selected>Missing design — choose another</option>` : ''}${(state.editing.chartDesigns || []).map(r => `<option value="${esc(r.id)}"${r.id === v ? ' selected' : ''}>${esc(r.name)}</option>`).join('')}</select><p class="muted">Create and edit designs under Customization → Chart Editor. Shared designs update every widget using them.</p>${(state.editing.chartDesigns || []).find(c => c.id === v)?.style === 'track' ? `<label for="chart-preview-track">Preview track (editor only)</label><select id="chart-preview-track" data-chart-preview><option value="">Sample oval</option>${(state.editing.previewTracks || []).map(t => `<option value="${esc(t.id)}"${t.id === state.editing.previewTrackId ? ' selected' : ''}>${esc(t.name)}${t.hasTrackDesign || t.trackDesign ? '' : ' · no imported design'}</option>`).join('')}</select><p class="muted">Racing uses the track selected in Race Setup. This choice only previews the layout; it is not saved with the widget.</p>` : ''}</div>`;
            if (o.type === 'rowdesign')
              return `<div class="field"><label for="${id}">${esc(o.label)}</label><select id="${id}" data-opt="${o.key}"><option value="">Classic table (columns below)</option>${(state.editing.rowDesigns || []).map(r => `<option value="${esc(r.id)}"${r.id === v ? ' selected' : ''}>${esc(r.name)}</option>`).join('')}</select></div>`;
            if (o.type === 'checkbox')
              return `<div class="field"><label class="inline"><input id="${id}" type="checkbox" data-opt="${o.key}" ${v ? 'checked' : ''}> ${esc(o.label)}</label></div>`;
            if (o.type === 'range')
              return `<div class="field"><label for="${id}">${esc(o.label)} <output id="${id}-v">${esc(v)}${o.unit || ''}</output></label><input id="${id}" type="range" min="${o.min ?? 0}" max="${o.max ?? 100}" step="${o.step ?? 1}" data-opt="${o.key}" data-unit="${esc(o.unit || '')}" value="${esc(v)}">${o.hint ? `<span class="muted hint">${esc(o.hint)}</span>` : ''}</div>`;
            if (o.type === 'select')
              return `<div class="field"><label for="${id}">${esc(o.label)}</label><select id="${id}" data-opt="${o.key}">${o.choices.map(([k, t]) => `<option value="${esc(k)}"${k === v ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>${(o.hintOf ? o.hintOf(v, w0.opt || {}) : o.hint) ? `<span class="muted hint">${esc(o.hintOf ? o.hintOf(v, w0.opt || {}) : o.hint)}</span>` : ''}</div>`;
            if (o.type === 'imagelist') {
              // one picture per step, from full (first) to empty (last)
              const cnt = Widgets.clampInt((w0.opt || {})[o.count] ?? d0.options.find(x => x.key === o.count).default, 2, 20, 10),
                list = (w0.opt || {})[o.key] || [];
              return `<div class="field"><label>${esc(o.label)}</label><div class="optlist">${Array.from(
                { length: cnt },
                (_, i) =>
                  `<div class="inline"><span>${i + 1}${i === 0 ? ' (full)' : i === cnt - 1 ? ' (empty)' : ''}</span>${list[i] ? `<img class="optimg" src="${esc(list[i])}" alt=""> ` : ''}` +
                  `<input type="file" accept="image/*" aria-label="Picture ${i + 1}" data-optimglist="${o.key}" data-idx="${i}">${list[i] ? ` <button class="btn" type="button" data-clearopt="${o.key}" data-idx="${i}">Remove</button>` : ''}</div>`
              ).join('')}</div></div>`;
            }
            if (o.type === 'frame') {
              const car = o.from === 'car',
                team = o.from === 'team',
                pk = car || team ? 'picture' : 'avatar',
                pic = ((car ? state.editing.cars || [] : team ? state.editing.teams || [] : state.editing.drivers || []).find(x => x[pk]) ||
                  {})[pk],
                f = Widgets.frameOf(common(w => (w.opt || {})[o.key]) ?? null);
              return `<div class="field frame" data-frame="${o.key}"><label>${esc(o.label)}</label>${pic ? '' : `<p class="muted">Add ${car ? 'a slotcar' : team ? 'a team' : 'a driver'} with a picture to see a preview. The setting still applies.</p>`}${frameInner(pic, f, `${w0.w} / ${w0.h}`, false)}</div>`;
            }
            if (o.type === 'image') {
              // `fallback`: the App Settings picture that shows while this widget has none of its own
              const fb = o.fallback ? (state.settings || {})[o.fallback] || '' : '';
              return (
                `<div class="field"><label for="${id}">${esc(o.label)}</label><div class="inline">${v ? `<img class="optimg" src="${esc(v)}" alt=""> ` : fb ? `<img class="optimg" src="${esc(fb)}" alt=""> <span class="muted">your club logo, from App Settings</span> ` : `<span class="muted">${o.fallback ? 'none: set your club logo in App Settings, or choose a picture here' : 'none (shows text)'}</span> `}` +
                `<input id="${id}" type="file" accept="image/*" data-optimg="${o.key}">${v ? ` <button class="btn" type="button" data-clearopt="${o.key}">${fb ? 'Use the club logo' : 'Remove'}</button>` : ''}</div></div>`
              );
            }
            if (o.type === 'note') return `<p class="muted">${esc(o.label)}</p>`;
            if (o.type === 'text')
              return `<div class="field"><label for="${id}">${esc(o.label)}</label><input id="${id}" type="text" maxlength="200" data-opt="${o.key}" value="${esc(v)}"></div>`;
            const num = o.type === 'number';
            return `<div class="field"><label for="${id}">${esc(o.label)}</label><input id="${id}" type="${num ? 'number' : 'color'}" ${num ? `min="${o.min ?? 0}" ${o.max ? `max="${o.max}" ` : ''}step="${o.step ?? 0.5}"` : ''} data-opt="${o.key}" value="${esc(v)}"></div>`;
          })
          .join('');
  const slider = (
    id,
    label,
    v,
    min,
    max,
    step,
    hint,
    off
  ) => `<div class="field"><label for="${id}">${label} <output id="${id}-v">${v}%</output></label>
    <input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${v}"${off ? ' disabled' : ''}>${hint ? `<span class="muted hint">${hint}</span>` : ''}</div>`;
  const rad = common(w => Frame.cornerPct(w.radius) ?? '');
  const bmode = common(w => Frame.mode(w)),
    bshade = common(w => Frame.shade(w)),
    bcolor = common(w => Frame.colorOf(w)),
    bwidth = common(w => Frame.widthOf(w) ?? ''),
    trans = common(w => Frame.transparency(w, state.editing.draft)),
    followsLayout = common(w => Frame.ownTransparency(w) === null);
  const alignSelect = (id, label, v) =>
    `<div class="field"><label for="${id}">${label}</label><select id="${id}">${v === undefined ? '<option value="" selected>(different)</option>' : ''}${Widgets.ALIGNS.map(([k, t]) => `<option value="${k}"${k === v ? ' selected' : ''}>${t}</option>`).join('')}</select></div>`;
  const titleBox = defs.some(d => !d.button)
    ? [
        single
          ? `<div class="field"><label for="s-title">${row ? 'Header text' : 'Title'} (empty = ${esc(d0.title || d0.label)})</label><input id="s-title" type="text" maxlength="40" value="${esc(w0.title || '')}"></div>`
          : '',
        row
          ? ''
          : `<div class="field"><label class="inline"><input type="checkbox" id="s-showtitle" ${showT === false ? '' : 'checked'}> Show title</label></div>
      <div class="field"><label for="s-tsize">Title size (default 12)</label><input id="s-tsize" type="number" min="3" max="60" value="${esc(tsize || '')}" placeholder="${tsize === undefined ? 'different' : 12}"></div>
      <div class="field"><label class="inline"><input type="checkbox" id="s-tbold" ${common(w => !!w.titleBold) ? 'checked' : ''}> Title in bold</label></div>
      ${alignSelect(
        's-talign',
        'Title alignment',
        common(w => Widgets.titleAlignOf(w))
      )}`
      ].join('')
    : '';
  let textBox =
    (defs.some(d => !d.button)
      ? `<div class="field"><label class="inline"><input type="checkbox" id="s-vbold" ${common(w => w.valueBold !== false) ? 'checked' : ''}> Value in bold</label>
      <label class="inline"><input type="checkbox" id="s-vital" ${common(w => !!w.valueItalic) ? 'checked' : ''}> Value in italic</label></div>`
      : '') +
    (defs.some(d => !d.button && d.type !== 'leaderboard')
      ? alignSelect(
          's-valign',
          'Text alignment',
          common(w => Widgets.valueAlignOf(w))
        )
      : '') + // (the Leaderboard has none: its columns come from the layout you make)
    `<div class="field"><label for="s-size">Text size${single ? ` (default ${d0.textSize})` : ''}</label><input id="s-size" type="number" min="5" max="200" value="${esc(size || '')}" placeholder="${size === undefined ? 'different' : single ? d0.textSize : ''}"></div>` +
    color('textColor', 'Text colour');
  if (defs.every(d => AllInOne.TYPES.has(d.type)))
    textBox =
      (typeof WidgetSettings === 'undefined' ? color('textColor', 'Text colour') : '') +
      '<p class="muted">Text sizes and alignment follow the card arrangement. Resize the widget or choose fewer optional fields to keep everything readable.</p>';
  const ownLaneStyle = common(w => Frame.ownLaneStyle(w));
  const laneStyleBox =
    !row && defs.some(d => d.perLane || d.type === 'leaderboard')
      ? `<div class="field"><label for="s-lanestyle">Lane colour style</label><select id="s-lanestyle">${ownLaneStyle === undefined ? '<option value="mixed" selected disabled>(different)</option>' : ''}${[['', 'Follow layout (' + Frame.LANE_STYLES.find(x => x[0] === Frame.layoutLaneStyle(state.editing.draft))[1] + ')'], ...Frame.LANE_STYLES, ['none', 'No lane colour']].map(([key, label]) => `<option value="${key}"${key === ownLaneStyle ? ' selected' : ''}>${label}</option>`).join('')}</select><span class="muted hint">Only the lane treatment changes. Custom backgrounds and race status colours keep their roles. Leaderboards apply it per row.</span></div>`
      : '';
  const frameBox =
    laneStyleBox +
    color('bgColor', 'Background colour') +
    (row
      ? ''
      : `<div class="field"><label for="s-bmode">Border</label><select id="s-bmode">${bmode === undefined ? '<option value="" selected>(different)</option>' : ''}${[
          ['', 'Theme default'],
          ['shade', 'Shade of the background'],
          ['custom', 'Colour of your own'],
          ['off', 'No border']
        ]
          .map(([k, t]) => `<option value="${k}"${k === bmode ? ' selected' : ''}>${t}</option>`)
          .join('')}</select></div>` +
        `<div class="field"><label for="s-bcolor">Border colour (for "Colour of your own")</label><input id="s-bcolor" type="color" value="${esc(bcolor ?? Frame.COLOR_START)}"${bmode === 'custom' ? '' : ' disabled'}></div>` +
        slider(
          's-bshade',
          'Border shade',
          bshade ?? Frame.DEFAULT_SHADE,
          0,
          100,
          0.5,
          '0% white, 50% the background colour, 100% black',
          bmode === '' || bmode === 'off' || bmode === 'custom'
        ) +
        `<div class="field"><label for="s-bwidth">Border thickness</label><input id="s-bwidth" type="number" min="0" max="40" step="0.5" value="${esc(bwidth ?? '')}" placeholder="${bwidth === undefined ? 'different' : 'standard'}"><span class="muted hint">Empty is the standard thin line. The thickness is a share of the page (a page is 1000 units wide, 40 is the most), so the border keeps its look on every screen, like the text does. It counts for every kind of border.</span></div>` +
        slider(
          's-trans',
          'Transparency',
          trans ?? 0,
          0,
          100,
          1,
          'Fades the background and the border, not the text. 0% is solid.',
          followsLayout === true
        ) +
        `<div class="field"><label class="inline"><input type="checkbox" id="s-transfollow" ${followsLayout ? 'checked' : ''}> Same as the layout (Background button in the top bar)</label></div>` +
        `<div class="field"><label for="s-radius">Rounded corners</label><input id="s-radius" type="number" min="0" max="50" step="0.5" value="${esc(rad === undefined ? '' : rad)}" placeholder="${rad === undefined ? 'different' : 'as the layout'}"><span class="muted hint">Empty follows the layout. 0 is square, 50 is fully round (on a square widget, a circle).</span></div>`);
  // Arrange (1.47.0): line up, spread out, one size, mirror. Several widgets line up with the box that holds them; one widget with the page.
  const settings = !row && typeof WidgetSettings !== 'undefined' ? WidgetSettings.panel(w0, state.editing.draft, sel) : null;
  const clockStyleBox =
    sameType && d0.type === 'clock'
      ? `<div class="field"><label for="o-style">Clock style</label><select id="o-style" data-opt="style">${Widgets.CLOCK_STYLES.map(([key, label]) => `<option value="${key}"${key === Widgets.clockStyleOf(w0) ? ' selected' : ''}>${label}</option>`).join('')}</select><p class="muted hint">Pit Wall hides secondary labels in small widgets. Follow flags controls the digits, preserving your background.</p></div>`
      : '';
  const abtn = (k, t, tip) =>
      ARR_ICON[k]
        ? `<button type="button" class="arr-i" data-arr="${k}" title="${esc(tip || t)}" aria-label="${esc(t)}">${ARR_ICON[k]}</button>`
        : `<button type="button" class="arr-t" data-arr="${k}"${tip ? ` title="${esc(tip)}"` : ''}>${t}</button>`,
    many = sel.length > 1;
  const sizeIn = (k, label) => {
    const v = common(w => w[k]);
    return `<label>${label} <input type="number" data-size="${k}" min="${Widgets.MIN}" step="1" value="${v === undefined ? '' : esc(v)}" placeholder="${v === undefined ? 'different' : ''}"></label>`;
  };
  const arrangeTools =
    `<div class="field arrf"><label>Align ${many ? 'with the selection' : 'with the page'}</label>
      <div class="arr">${[
        ['left', 'Left'],
        ['center', 'Center'],
        ['right', 'Right']
      ]
        .map(([k, t]) => abtn('align-' + k, t))
        .join('')}</div><div class="arr">${[
        ['top', 'Top'],
        ['middle', 'Middle'],
        ['bottom', 'Bottom']
      ]
        .map(([k, t]) => abtn('align-' + k, t))
        .join('')}</div></div>` +
    (sel.length > 2
      ? `<div class="field arrf"><label>Spread out evenly (the outer two stay)</label><div class="arr">${abtn('dist-x', 'Across')}${abtn('dist-y', 'Down')}</div></div>`
      : '') +
    (many
      ? `<div class="field"><label>Same size for all</label><div class="arrsize">${sizeIn('w', 'Width')}${sizeIn('h', 'Height')}</div><span class="muted hint">A widget stops at the edge of the page. Drag a corner of the frame round the selection to resize them all together.</span></div>`
      : '') +
    `<div class="field arrf"><label>Mirror</label><div class="arr">${many ? abtn('mirror-sel', 'In the selection', 'Left to right inside the box that holds the selection') : ''}${abtn('mirror-page', 'Across the page', 'To the other side of the middle of the page')}${many ? abtn('flip-sel', 'Flip top to bottom', 'Top to bottom inside the box that holds the selection') : ''}</div>
      <span class="muted hint">Mirroring left to right also swaps left and right text alignment and flips the pictures that have a Mirror setting. Made copies for the next lane with Duplicate? Mirror them across the page.</span></div>` +
    (row
      ? ''
      : `<div class="field arrf"><label>Layer</label><div class="arr">${abtn('layer-front', 'Bring to front', 'Place over every other widget')}${abtn('layer-forward', 'Bring forward', 'Move one layer closer to the front')}${abtn('layer-backward', 'Send backward', 'Move one layer closer to the back')}${abtn('layer-back', 'Send to back', 'Place behind every other widget')}</div><span class="muted hint">Layers decide which widget and shadow is on top where widgets overlap. The same order is used on every live race screen.</span></div>`);
  // (2.4.0, SlotForgeRestyle.md "Editor Panels") the head: what kind of widget, its name, and its lane as eight buttons (the Lane list stays, hidden, and does the work)
  const kindLine = single ? `${row ? 'Row cell' : d0.perLane ? 'Per lane' : 'Once on screen'} · ${esc(d0.group || '')}` : 'Selection';
  const laneBtns = allLane
    ? `<div class="insp-lanes" role="group" aria-label="Lane">${Array.from(
        { length: Widgets.LANES },
        (_, l) =>
          `<button type="button" data-lanebtn="${l}" aria-pressed="${l === lane && follow !== true}" title="Lane ${l + 1}">${l + 1}</button>`
      ).join(
        ''
      )}<button type="button" class="insp-follow" data-lanebtn="follow" aria-pressed="${follow === true}" title="Followed: in a Solo session the lane the car is on; in other races lane ${lane === undefined ? 1 : lane + 1}">Followed</button></div>`
    : '';
  return `<header class="ed-insp"><span class="insp-k">${kindLine}</span><h3>${single ? esc(d0.label) : sel.length + ' widgets selected'}</h3>${laneBtns}</header>
    ${allLane ? `<div class="field insp-lanefield" hidden><label for="s-lane">Lane</label><select id="s-lane">${lane === undefined || follow === undefined ? '<option value="" selected>(different)</option>' : ''}${Array.from({ length: Widgets.LANES }, (_, l) => `<option value="${l}"${l === lane && follow === false ? ' selected' : ''}>Lane ${l + 1}</option>`).join('')}<option value="follow"${follow === true ? ' selected' : ''}>Followed (Solo)</option></select></div>` : ''}
    ${group('arrange', 'Arrange', `${arrangeTools}${snapHint}<div class="row"><button class="btn" id="s-tidy">Tidy to grid</button></div>${tidyHint}`)}
    ${
      row && single
        ? group(
            'place',
            'Place in the row',
            `<div class="field"><label>0 to ${Widgets.U} across, 0 to ${Widgets.heightOf(state.editing.draft)} down</label><div class="inline geo">${[
              ['x', 'Left'],
              ['y', 'Top'],
              ['w', 'Width'],
              ['h', 'Height']
            ]
              .map(([k, t]) => `<label>${t} <input type="number" data-geo="${k}" value="${Math.round(w0[k])}" style="width:5em"></label>`)
              .join(' ')}</div></div>`
          )
        : ''
    }
    ${settings ? group('opts', 'Content', WidgetSettings.section('content', 'What to show', opts, 'lines')) + group('title', 'Title & text', WidgetSettings.section('title', 'Widget title', titleBox.replace(/<div class="field"><label for="s-tsize">[\s\S]*?<\/div>/, '') + settings.titleSize, 'text') + settings.text + settings.fonts) + group('text', 'Text alignment', WidgetSettings.section('alignment', 'Value styling and alignment', textBox.replace(/<div class="field"><label for="s-size">[\s\S]*$/, ''), 'alignleft')) + group('frame', 'Appearance', WidgetSettings.section('clock', 'Clock style', clockStyleBox, 'clock') + settings.appearance + (d0.type === 'leaderboard' ? WidgetSettings.section('rows', 'Leaderboard row lane colours', laneStyleBox, 'lines') : '')) + group('advanced', 'Advanced', settings.advanced) + group('status', 'Race states & Lap Highlights', settings.status) : group('title', row ? 'Header' : 'Title', titleBox) + group('text', 'Text', textBox + (typeof WidgetFonts !== 'undefined' ? WidgetFonts.panel(w0, state.editing.draft, sel) : '')) + group('frame', row ? 'Colour' : 'Background and border', frameBox) + group('opts', d0.optsLabel || d0.label + ' settings', opts)}
    <div class="row"><button class="btn" id="s-dup">Duplicate${allLane ? ' (next lane)' : ''}</button><button class="btn danger" id="s-del">Remove</button></div>`;
}

// drawing the editor: decorations, rows, geometry, the canvas and the side panel
function edDrawing({ $, Hh, U, d, ed, hasGuides, mark, mounted, paintVersion, row }) {
  const drawDecorations = () => {
    const H = Hh();
    const lines =
      d.guides.v.map(x => `<i class="gl gl-v" style="left:${(x / U) * 100}%"></i>`).join('') +
      d.guides.h.map(y => `<i class="gl gl-h" style="top:${(y / H) * 100}%"></i>`).join('');
    const gbox =
      ed.sel.length > 1
        ? (b =>
            `<div class="gbox" style="left:${(b.x / U) * 100}%;top:${(b.y / H) * 100}%;width:${(b.w / U) * 100}%;height:${(b.h / H) * 100}%">${['nw', 'ne', 'sw', 'se'].map(c => `<i class="h ${c}" data-gh="${c}"></i>`).join('')}</div>`)(
            Widgets.bbox(ed.sel)
          )
        : ''; // (the frame round several selected widgets, with a handle in each corner, 1.47.0)
    const sl = ed.snapLines
      ? ed.snapLines.v.map(x => `<i class="snapl snapl-v" style="left:${(x / U) * 100}%"></i>`).join('') +
        ed.snapLines.h.map(y => `<i class="snapl snapl-h" style="top:${(y / H) * 100}%"></i>`).join('')
      : ''; // (the pink lines while you drag: an edge lines up)
    return lines + gbox + sl;
  };
  const refreshDecorations = () => {
    $('canvas')
      .querySelectorAll(':scope > .gl,:scope > .gbox,:scope > .snapl')
      .forEach(el => el.remove());
    $('canvas').insertAdjacentHTML('beforeend', drawDecorations());
  };
  const drawRows = () => {
    if (row) {
      const components = [];
      $('e-preview').innerHTML = Rows.sampleHtml(d, 5, ed.imageSets, { components, chartDesigns: ed.chartDesigns || [] });
      Rows.fitText($('e-preview'));
      WidgetView.updateComponents({ val: $('e-preview') }, { components });
    }
  };
  const drawGeometry = group => {
    if (!mounted) {
      drawCanvas();
      return;
    }
    mounted.geometry(group, ed.sel);
    refreshDecorations();
  };
  const drawCanvas = changed => {
    const H = Hh();
    $('canvas').style.aspectRatio = `${d.ratioW} / ${d.ratioH}`;
    $('canvas').style.backgroundSize = `${(10 / U) * 100}% ${(10 / H) * 100}%`;
    if (mounted) {
      mounted.sync(ed.sel, changed);
      refreshDecorations();
    } else {
      $('canvas').innerHTML =
        d.widgets.map(w => widgetHtml(w, ed.sel.includes(w), ed.sel.length === 1 && ed.sel[0] === w, d)).join('') + drawDecorations();
      fitEditorWidgets();
    }
    // the background picture is kept as one element (a big picture is not rebuilt on every move of a widget)
    if (!row && Backdrop.has(d)) {
      const key = [d.bgImage, d.bgFit, d.bgBlur, d.bgBrightness, d.bgSaturation];
      if (!ed.bgKey || key.some((v, i) => v !== ed.bgKey[i])) {
        ed.bgNode?.remove();
        ed.bgKey = key;
        ed.bgNode = Backdrop.node(d);
      }
      if (ed.bgNode !== $('canvas').firstChild) $('canvas').insertBefore(ed.bgNode, $('canvas').firstChild);
    } else {
      ed.bgNode?.remove();
      ed.bgKey = null;
      ed.bgNode = null;
    }
    if ($('e-background')) $('e-background').setAttribute('aria-pressed', String(Backdrop.has(d)));
    if (!row && typeof LayoutTry !== 'undefined') LayoutTry.refreshWarn(ed, $('side')); // (2.4.0: the words a widget does not know)
    if ($('e-guides')) $('e-guides').setAttribute('aria-pressed', String(hasGuides()));
    drawRows();
  };
  const drawSide = () => {
    $('side').innerHTML = sideHtml();
    foldSideHints($('side'));
    if (!row && typeof LayoutTry !== 'undefined') LayoutTry.refreshWarn(ed, $('side'));
    fitPanels();
    if (typeof WidgetFonts !== 'undefined')
      for (const [role, id] of [
        ['title', 's-tbold'],
        ['value', 's-vbold']
      ]) {
        const input = $(id),
          weights = ed.sel.map(w => WidgetFonts.resolve(w, d)[role + 'Weight']);
        if (input && weights.some(Boolean)) {
          input.disabled = true;
          input.checked = weights.every(n => n >= 700);
          const note = document.createElement('small');
          note.className = 'muted hint';
          note.textContent = 'Weight is set under Fonts. Clear that weight override to use this switch.';
          input.closest('.field').appendChild(note);
        }
      }

    attachFrames(
      $('side'),
      key => (ed.sel[0].opt || {})[key],
      (key, f) => {
        ed.sel.forEach(w => {
          w.opt = w.opt || {};
          w.opt[key] = f;
        });
        mark();
      }
    );
  };
  const refreshAssets = () => {
    if (typeof EditorData === 'undefined') return;
    EditorData.refresh(api, ed)
      .then(changed => {
        if (changed && state.editing === ed && ed.paintVersion === paintVersion && $('canvas')) {
          mounted?.invalidate();
          drawCanvas();
          drawSide();
        }
      })
      .catch(error => {
        if (state.editing === ed && ed.paintVersion === paintVersion && $('e-msg'))
          $('e-msg').textContent = 'Preview could not be loaded: ' + error.message;
      });
  };
  const redraw = () => {
    drawCanvas();
    drawSide();
    refreshAssets();
  };
  redraw();
  if (!panelFitWired && window.addEventListener) {
    panelFitWired = true;
    window.addEventListener('resize', fitPanels);
    window.addEventListener('scroll', fitPanels, { passive: true });
  }
  return { drawCanvas, drawGeometry, drawRows, drawSide, redraw, refreshAssets };
}
// adding widgets; saving, going back, removing and duplicating
function edAddAndSave({ $, Hh, U, d, ed, hist, mark, redraw, row, step }) {
  window.editorAddCustom = id => {
    // a saved widget from the Widget Builder: add its kind, then give the copy its text, size and look
    const r = (ed.customWidgets || []).find(x => x.id === id);
    if (!r) return;
    const g = addWidget(r.type),
      H = Hh(),
      c = wbToWidget(r, g.lane);
    Object.assign(g, {
      opt: c.opt,
      w: Math.min(c.w, U),
      h: Math.min(c.h, H),
      textSize: c.textSize,
      valueBold: c.valueBold,
      valueItalic: c.valueItalic,
      title: c.title,
      showTitle: row ? false : c.showTitle,
      src: r.id // (2.4.0: the copy knows the widget it came from, so saving the widget can update it)
    });
    step();
    redraw();
  };
  window.editorAdd = (type, preset) => {
    const g = addWidget(type);
    // (2.4.0) a ready-made look of a widget: the Fuel Strip is the Fuel widget with its strip style (SlotForgeRestyle.md "Widget Workshop")
    if (g && preset === 'fuelstrip') {
      g.opt = { ...(g.opt || {}), mode: 'both', barStyle: 'strip' };
      g.title = 'Fuel Strip';
      g.showTitle = false; // (the strip says FUEL itself)
      g.h = Math.min(g.h, 56);
      g.w = Math.min(U, Math.max(g.w, 300));
      g.x = Math.max(0, Math.min(g.x, U - g.w)); // (2.4.0 review: the wider strip stays on the page)
      redraw();
    }
    hist.commit();
  };
  const addWidget = type => {
    const def = Widgets.def(type),
      H = Hh();
    const lane = !def.perLane ? null : row ? 0 : Math.min(Widgets.LANES - 1, d.widgets.filter(w => w.type === type).length);
    const g = Widgets.newWidget(type, lane, 20, 20);
    g.w = Math.min(g.w, U);
    g.h = Math.min(g.h, H);
    if (row) {
      g.showTitle = false;
      g.h = Math.min(g.h, Math.max(40, H - 10));
      g.textSize = 30;
    }
    const free = (x, y) => !d.widgets.some(o => x < o.x + o.w && o.x < x + g.w && y < o.y + o.h && o.y < y + g.h);
    outer: for (let y = 10; y + g.h <= H; y += 10)
      for (let x = 10; x + g.w <= U; x += 10)
        if (free(x, y)) {
          g.x = x;
          g.y = y;
          break outer;
        }
    // (2.4.0 review) no free spot (a low row, a full page): the widget still stays on the page or in the row
    g.x = Math.max(0, Math.min(g.x, U - g.w));
    g.y = Math.max(0, Math.min(g.y, H - g.h));
    d.widgets.push(g);
    ed.sel = [g];
    mark();
    redraw();
    return g;
  };
  if (row) {
    $('e-classview').onchange = e => {
      d.classView = e.target.value;
      $('e-classid').disabled = d.classView !== 'class';
      mark();
    };
    $('e-classid').onchange = e => {
      d.classId = e.target.value;
      mark();
    };
  }
  let savingP = null; // (a second click, or Ctrl+S, while the first is being written is the same save: a layout that is new would be added twice)
  const saveNow = async () => {
    ed.cancelGesture?.();
    d.name = d.name.trim();
    if (!d.name) {
      $('e-msg').textContent = `Please give the ${row ? 'row design' : 'layout'} a name.`;
      return false;
    }
    const token = hist.commit(); // what is saved is this state, whatever is changed while the save runs
    if (row) {
      const data = clone({ ...d, name: d.name, note: (d.note || '').trim(), kind: 'row', widgets: [...d.widgets, ...(ed.unknown || [])] }); // (2.4.0 review: the unknown widgets back)
      if (ed.id) await api.update('rowdesigns', ed.id, data);
      else {
        const r = await api.add('rowdesigns', data);
        ed.id = r.id;
      }
      hist.markSaved(token);
      ed.dirty = !hist.isClean();
      $('e-msg').textContent = 'Saved.';
      return true; // (a change made while it was being written is not saved yet)
    }
    const data = clone({
      name: d.name,
      note: (d.note || '').trim(),
      ratioW: d.ratioW,
      ratioH: d.ratioH,
      widgets: [...d.widgets, ...(ed.unknown || [])], // (2.4.0 review: the widgets this version does not know, back)
      guides: d.guides,
      laneColors: d.laneColors,
      ...Frame.pickLayout(d),
      ...Backdrop.pick(d)
    });
    if (ed.id) await api.update('layouts', ed.id, data);
    else {
      const row = await api.add('layouts', data);
      ed.id = row.id;
    }
    hist.markSaved(token);
    ed.dirty = !hist.isClean();
    $('e-msg').textContent = 'Saved.';
    return true;
  };
  window.editorSave = () =>
    savingP ||
    (savingP = saveNow().finally(() => {
      savingP = null;
    }));
  // Undo and redo: the editor is drawn again from the remembered state
  const goBack = redo => {
    ed.cancelGesture?.();
    if (!(redo ? hist.redo() : hist.undo())) {
      $('e-msg').textContent = redo ? 'Nothing to redo.' : 'Nothing to undo.';
      return false;
    }
    ed.dirty = !hist.isClean();
    renderEditor();
    document.getElementById('e-msg').textContent = redo ? 'Redone.' : 'Undone.';
    return true;
  };
  window.editorUndo = () => goBack(false);
  window.editorRedo = () => goBack(true);
  const removeSel = () => {
    d.widgets = d.widgets.filter(w => !ed.sel.includes(w));
    ed.sel = [];
    step();
    redraw();
  };
  const duplicateSel = () => {
    if (!ed.sel.length) return;
    const src = [...ed.sel],
      copies = Widgets.duplicateWidgets(src, ed.dupStep, U, Hh());
    if (row) copies.forEach((g, i) => (g.lane = src[i].lane)); // (2.4.0 review: a cell of a row design has no lane of its own to move on to)
    d.widgets.push(...copies);
    ed.lastDup = { srcBox: Widgets.bbox(src), copies };
    ed.sel = copies;
    step();
    redraw();
    $('e-msg').textContent = !row && src.some(w => w.lane === Widgets.LANES - 1) ? `Lane ${Widgets.LANES} is the last lane.` : '';
  };
  return { duplicateSel, removeSel };
}
// arranging and tidying the selection
function edArranging({ $, Hh, U, d, ed, mark, redraw, step }) {
  // Arrange (1.47.0): line up, spread out, mirror. Each is one step for Undo.
  const arrange = kind => {
    const list = ed.sel;
    if (!list.length) return;
    const H = Hh(),
      n = list.length,
      words = `${n} widget${n === 1 ? '' : 's'}`;
    let nb = null,
      msg = '',
      mirrorX = false;
    if (kind.startsWith('layer-')) {
      const where = kind.slice(6),
        stacked = Widgets.stackWidgets(d.widgets, list, where);
      if (stacked.every((w, i) => w === d.widgets[i])) {
        $('e-msg').textContent =
          where === 'front' ? 'Already at the front.' : where === 'back' ? 'Already at the back.' : 'Already at that layer.';
        return;
      }
      d.widgets = stacked;
      step();
      redraw();
      $('e-msg').textContent =
        `${where === 'front' ? 'Brought' : where === 'back' ? 'Sent' : 'Moved'} ${words} ${where === 'front' ? 'to the front' : where === 'back' ? 'to the back' : where === 'forward' ? 'forward' : 'backward'}.`;
      return;
    } else if (kind.startsWith('align-')) {
      const where = kind.slice(6);
      nb = Widgets.alignRects(list, where, n > 1 ? Widgets.bbox(list) : { x: 0, y: 0, w: U, h: H });
      msg = `Aligned ${words} ${{ left: 'to the left', center: 'in the center', right: 'to the right', top: 'to the top', middle: 'in the middle', bottom: 'to the bottom' }[where]}.`;
    } else if (kind === 'dist-x' || kind === 'dist-y') {
      if (n < 3) return;
      nb = Widgets.distributeRects(list, kind === 'dist-x' ? 'x' : 'y');
      if (!nb) {
        $('e-msg').textContent = 'The widgets are wider together than the room between the outer two, so there is no space to share out.';
        return;
      }
      msg = `Spread ${words} out evenly ${kind === 'dist-x' ? 'across' : 'down'}.`;
    } else if (kind === 'mirror-sel' || kind === 'mirror-page' || kind === 'flip-sel') {
      if (kind !== 'mirror-page' && n < 2) return;
      mirrorX = kind !== 'flip-sel';
      nb = Widgets.mirrorRects(list, kind === 'mirror-sel' ? 'sel-x' : kind === 'mirror-page' ? 'page-x' : 'sel-y', U, H);
      msg =
        kind === 'flip-sel'
          ? `Flipped ${words} top to bottom.`
          : `Mirrored ${words} ${kind === 'mirror-sel' ? 'in the selection' : 'across the page'}.`;
    } else return;
    const moved = list.filter((g, i) => g.x !== nb[i].x || g.y !== nb[i].y).length;
    if (!moved && !mirrorX) {
      $('e-msg').textContent = 'They were already there.';
      return;
    }
    list.forEach((g, i) => {
      Object.assign(g, nb[i]);
      if (mirrorX) Object.assign(g, Widgets.mirrorSettings(g));
    });
    step();
    redraw();
    $('e-msg').textContent = msg;
  };
  // Tidy to grid: the selected widgets, or all of them when nothing is selected
  const tidySel = () => {
    const list = ed.sel.length ? ed.sel : d.widgets,
      nb = Widgets.tidy(list, U, Hh());
    const changed = list.filter((g, i) => g.x !== nb[i].x || g.y !== nb[i].y || g.w !== nb[i].w || g.h !== nb[i].h).length;
    if (changed) {
      list.forEach((g, i) => Object.assign(g, nb[i]));
      step();
      redraw();
    }
    $('e-msg').textContent = changed
      ? `Tidied ${changed} widget${changed === 1 ? '' : 's'} to the grid.`
      : 'Everything was already on the grid.';
  };

  // toolbar
  $('e-name').oninput = e => {
    d.name = e.target.value;
    mark();
  };
  $('e-note').oninput = e => {
    d.note = e.target.value;
    mark();
  };
  return { arrange, tidySel };
}
// the size and the ratio of the canvas
function edCanvasSize({ $, Hh, U, d, drawCanvas, ed, hist, mark, redraw, row, step }) {
  if (row) {
    $('e-rowh').oninput = e => {
      const v = Math.max(20, Math.min(400, Number(e.target.value) || 70));
      d.ratioH = v;
      d.ratioW = U;
      d.widgets.forEach(g => {
        g.y = Math.min(g.y, Math.max(0, v - g.h));
        g.h = Math.min(g.h, v);
      });
      mark();
      redraw();
    };
    $('e-gap').oninput = e => {
      d.gap = Math.max(0, Math.min(100, Number(e.target.value) || 0));
      mark();
      drawCanvas();
    };
    $('e-radius').oninput = e => {
      d.radius = Math.max(0, Math.min(50, Number(e.target.value) || 0));
      mark();
      drawCanvas();
    };
    $('e-header').onchange = e => {
      d.header = e.target.checked;
      step();
      drawCanvas();
    };
    $('e-rowcolors').onclick = () => {
      const c = Rows.settings(d),
        pair = (k, t) =>
          `<tr><td>${t}</td><td><input type="color" id="rc-${k}-t" value="${esc(c[k + 'Text'] || '#ffffff')}" aria-label="${t} text colour"></td><td><input type="color" id="rc-${k}-b" value="${esc(c[k + 'Bg'] || '#333333')}" aria-label="${t} background colour"></td></tr>`;
      const theme = (k, t, v) =>
        `<tr><td>${t}</td><td><input type="color" id="rc-${k}" value="${esc(v || '#333333')}" aria-label="${t}"> <label><input type="checkbox" id="rc-${k}-th" ${v ? '' : 'checked'}> Theme</label></td></tr>`;
      dlg.innerHTML = `<form id="rcform"><h3>Row colours</h3>
        <table class="fields"><tr><th>Row</th><th>Colour</th></tr>${theme('rowText', 'Text', c.rowText)}${theme('rowBg', 'Background', c.rowBg)}${theme('altBg', 'Every second row', c.altBg)}${theme('headerText', 'Header text', c.headerText)}${theme('headerBg', 'Header background', c.headerBg)}</table>
        <p><label><input type="checkbox" id="rc-states" ${c.states ? 'checked' : ''}> Colour a row by what its driver is doing</label></p>
        <table class="fields"><tr><th>When</th><th>Text</th><th>Background</th></tr>${Rows.STATES.map(([k, t]) => pair(k, t)).join('')}</table>
        <p class="muted">The strongest state wins: out, then pits, then penalty, then leader. A widget's own colour is used over these.</p>
        <div class="row"><button class="btn primary" type="submit">Apply</button><button class="btn" type="button" id="rc-cancel">Cancel</button></div></form>`;
      $('rc-cancel').onclick = () => dlg.close();
      $('rcform').onsubmit = ev => {
        ev.preventDefault();
        ['rowText', 'rowBg', 'altBg', 'headerText', 'headerBg'].forEach(k => {
          d[k] = $('rc-' + k + '-th').checked ? '' : $('rc-' + k).value;
        });
        d.states = $('rc-states').checked;
        Rows.STATES.forEach(([k]) => {
          d[k + 'Text'] = $('rc-' + k + '-t').value;
          d[k + 'Bg'] = $('rc-' + k + '-b').value;
        });
        step();
        dlg.close();
        drawCanvas();
      };
      dlg.onclick = null;
      dlg.onchange = null;
      dlg.showModal();
    };
  }
  const setRatio = (w, h) => {
    d.ratioW = w;
    d.ratioH = h;
    const H = Hh();
    d.widgets.forEach(g => {
      g.y = Math.min(g.y, Math.max(0, H - g.h));
      g.h = Math.min(g.h, H);
    });
    mark();
    drawCanvas();
  };
  if (!row)
    $('e-ratio').onchange = e => {
      if (e.target.value === 'custom') {
        $('e-custom').hidden = false;
        return;
      }
      const p = PRESETS.find(x => x[0] === e.target.value);
      $('e-custom').hidden = true;
      $('e-rw').value = p[1];
      $('e-rh').value = p[2];
      setRatio(p[1], p[2]);
      hist.commit();
    };
  const customRatio = () => {
    const w = Number($('e-rw').value),
      h = Number($('e-rh').value);
    if (w >= 1 && h >= 1) setRatio(w, h);
  };
  if (!row) {
    $('e-rw').oninput = customRatio;
    $('e-rh').oninput = customRatio;
  }
  if (!row)
    $('e-lradius').oninput = e => {
      const v = Frame.cornerPct(e.target.value);
      d.radius = v === null ? '' : v;
      mark();
      drawCanvas();
    };
  $('e-snap').onchange = e => {
    ed.snap = e.target.checked;
  };
  if (!row)
    $('e-lanestyle').onchange = e => {
      if (!Frame.LANE_STYLES.some(x => x[0] === e.target.value)) return;
      d.laneColorStyle = e.target.value;
      step();
      redraw();
    };
  $('e-undo').onclick = () => window.editorUndo();
  $('e-redo').onclick = () => window.editorRedo();
  ed.syncUndo();
  $('e-save').onclick = () => window.editorSave();
  pbWatch(view, () => ed.dirty || !hist.isClean());
  const pbPop = $('e-pagesettings');
  if (pbPop) pbPop.ontoggle = () => (ed.pbOpen = pbPop.open);
  const palSearch = $('e-palsearch');
  if (palSearch)
    palSearch.oninput = () => {
      const q = String(palSearch.value || '')
        .trim()
        .toLowerCase();
      document.querySelectorAll('.ed-pal .palgroup').forEach(g => {
        let any = false;
        g.querySelectorAll('button').forEach(b => {
          const hit =
            !q ||
            String(b.textContent || '')
              .toLowerCase()
              .includes(q) ||
            String(g.dataset.pal || '')
              .toLowerCase()
              .includes(q);
          b.hidden = !hit;
          any = any || hit;
        });
        g.hidden = !any;
        if (q) g.open = any;
        else g.open = state.palOpen.has(g.dataset.pal);
      });
    };
}
// the palette and the back button
function edPalette({ $, Hh, U, d, drawCanvas, ed, hasGuides, redraw, row, step }) {
  $('e-back').onclick = async () => {
    if (ed.dirty) {
      if (!(await Dialog.confirm('Discard your unsaved layout changes?', { ok: 'Discard changes', cancel: 'Keep editing', danger: true })))
        return;
      if (state.editing !== ed) return; // (the editor was closed meanwhile)
    }
    editorLeave();
    render();
  };
  document.querySelector('.ed-pal').addEventListener &&
    document.querySelector('.ed-pal').addEventListener(
      'toggle',
      ev => {
        const d = ev.target;
        if (d && d.dataset && d.dataset.pal) {
          if (d.open) state.palOpen.add(d.dataset.pal);
          else state.palOpen.delete(d.dataset.pal);
        }
      },
      true
    );
  document.querySelector('.ed-pal').onclick = e => {
    const b = e.target.closest('[data-add]');
    if (b) window.editorAdd(b.dataset.add, b.dataset.preset);
    const c = e.target.closest('[data-addcw]');
    if (c) window.editorAddCustom(c.dataset.addcw);
  };

  // guidelines: evenly spaced lines to snap to, shown only here in the editor; the button again turns them off
  if (!row)
    $('e-guides').onclick = () => {
      if (hasGuides()) {
        d.guides = { v: [], h: [] };
        step();
        redraw();
        return;
      }
      dlg.innerHTML = `<form id="gform"><h3>Guidelines</h3><p class="muted">Evenly spaced lines that widgets stick to. They only show in the editor.</p>
      <div class="field"><label for="g-n">Number of lanes (2 to ${Widgets.LANES})</label><input id="g-n" type="number" min="2" max="${Widgets.LANES}" value="2"></div>
      <div class="field"><label><input type="radio" name="g-dir" id="g-dir-v" checked> Vertical lines (lanes side by side)</label>
        <label><input type="radio" name="g-dir" id="g-dir-h"> Horizontal lines (one row per lane)</label><label><input type="radio" name="g-dir" id="g-dir-b"> Both</label></div>
      <p class="error" id="gerr" role="alert"></p><div class="row"><button class="btn primary" type="submit">Place guidelines</button><button class="btn" type="button" id="g-cancel">Cancel</button></div></form>`;
      $('g-cancel').onclick = () => dlg.close();
      $('gform').onsubmit = ev => {
        ev.preventDefault();
        const n = Number($('g-n').value);
        if (!Number.isInteger(n) || n < 2 || n > Widgets.LANES) {
          $('gerr').textContent = `Please enter a number from 2 to ${Widgets.LANES}.`;
          return;
        }
        d.guides = Widgets.guidesFor(n, $('g-dir-h').checked ? 'horizontal' : $('g-dir-b').checked ? 'both' : 'vertical', U, Hh());
        step();
        dlg.close();
        redraw();
      };
      dlg.onclick = null;
      dlg.onchange = null;
      dlg.showModal();
    };

  // lane colours: a text and background colour per lane, inherited by that lane's widgets unless they have their own
  if (!row)
    $('e-lanecolors').onclick = () => {
      const row = i => {
        const c = (d.laneColors || [])[i] || {};
        return `<tr><td>Lane ${i + 1}</td><td><input type="color" id="lc-t-${i}" value="${esc(c.text || '#ffffff')}" aria-label="Lane ${i + 1} text colour"> <label><input type="checkbox" id="lc-tt-${i}" ${c.text ? '' : 'checked'}> Theme</label></td>
        <td><input type="color" id="lc-b-${i}" value="${esc(c.bg || '#333333')}" aria-label="Lane ${i + 1} background colour"> <label><input type="checkbox" id="lc-bt-${i}" ${c.bg ? '' : 'checked'}> Theme</label></td></tr>`;
      };
      dlg.innerHTML = `<form id="lform"><h3>Lane colours</h3><p class="muted">Every widget of a lane uses these colours, unless the widget has its own.</p>
      <table class="fields"><tr><th></th><th>Text</th><th>Background</th></tr>${Array.from({ length: Widgets.LANES }, (_, i) => row(i)).join('')}</table>
      <div class="row"><button class="btn primary" type="submit">Apply</button><button class="btn" type="button" id="l-cancel">Cancel</button></div></form>`;
      $('l-cancel').onclick = () => dlg.close();
      $('lform').onsubmit = ev => {
        ev.preventDefault();
        d.laneColors = Array.from({ length: Widgets.LANES }, (_, i) => ({
          text: $('lc-tt-' + i).checked ? '' : $('lc-t-' + i).value,
          bg: $('lc-bt-' + i).checked ? '' : $('lc-b-' + i).value
        }));
        step();
        dlg.close();
        drawCanvas();
      };
      dlg.onclick = null;
      dlg.onchange = null;
      dlg.showModal();
    };
}
// the appearance folder
function edAppearance({ $, d, redraw, row, step }) {
  // the page background: a picture behind all the widgets, and filters that only change the picture
  if (!row && $('e-appearance'))
    $('e-appearance').onclick = () => {
      const draft = { appearance: clone(d.widgetAppearance || {}), fonts: clone(d.widgetFonts || {}), lane: 0, w: 250, h: 170 };
      const openDefaults = new Set(['frame']);
      const show = () => {
        const panels = WidgetSettings.panel(draft, { ...d, widgetAppearance: {}, widgetFonts: {} }, [draft], { defaults: true });
        const folder = (key, label, body) =>
          `<details class="sidegroup" data-side="${key}"${openDefaults.has(key) ? ' open' : ''}><summary>${WidgetSettings.folderHeading(key, label)}</summary>${body}</details>`;
        dlg.innerHTML = `<div class="ws-defaults"><h3>Widget appearance — layout defaults</h3><p class="muted">Applies to widgets without their own override, including widgets added later. Individual settings win. Changes apply when you choose Save defaults.</p>${folder('title', 'Fonts', panels.fonts)}${folder('frame', 'Appearance', panels.appearance)}${folder('advanced', 'Advanced', panels.advanced)}${folder('status', 'Race states & Lap Highlights', panels.status)}<div class="row"><button class="btn" id="wa-cancel">Cancel</button><button class="btn" id="wa-clear">Clear defaults</button><button class="btn primary" id="wa-save">Save defaults</button></div></div>`;
        dlg.querySelectorAll('details[data-side]').forEach(
          el =>
            (el.ontoggle = () => {
              if (!el.isConnected) return;
              if (el.open) openDefaults.add(el.dataset.side);
              else openDefaults.delete(el.dataset.side);
            })
        );
        $('wa-cancel').onclick = () => dlg.close();
        $('wa-clear').onclick = () => {
          draft.appearance = {};
          draft.fonts = {};
          show();
        };
        $('wa-save').onclick = () => {
          d.widgetAppearance = Frame.cleanAppearance(draft.appearance);
          d.widgetFonts = WidgetFonts.clean(draft.fonts);
          step();
          dlg.close();
          redraw();
        };
      };
      dlg.oninput = e => {
        const t = e.target;
        if (t.type === 'range' && t.previousElementSibling?.tagName === 'OUTPUT')
          t.previousElementSibling.textContent = t.value + (t.dataset.key === 'lapDuration' ? ' ms' : '%');
        if (t.dataset.ws) WidgetSettings.change(draft, t.dataset.ws, t.dataset.key, t.type === 'checkbox' ? t.checked : t.value);
      };
      dlg.onchange = e => {
        if (e.target.dataset.ws) show();
      };
      dlg.onclick = async e => {
        const preview = e.target.closest('[data-lap-preview]');
        if (preview) {
          LapHighlights.pulse(
            dlg.querySelector('.lap-settings-preview'),
            draft,
            {},
            preview.dataset.lapPreview === 'lap' ? '' : preview.dataset.lapPreview
          );
          return;
        }
        const b = e.target.closest('[data-ws-action]');
        if (!b) return;
        if (b.dataset.wsAction === 'font-scan') {
          b.disabled = true;
          try {
            await WidgetFonts.scan();
            if (dlg.open) show();
          } catch (err) {
            b.disabled = false;
            b.closest('.ws-section').querySelector('.hint').textContent = err.message;
          }
          return;
        }
        if (b.dataset.wsAction === 'font-highvis') WidgetFonts.highVisibility(draft);
        if (b.dataset.wsAction === 'font-reset') delete draft.fonts;
        if (b.dataset.wsAction === 'reverse')
          WidgetSettings.change(draft, 'appearance', 'angle', (Frame.appearance(draft).angle + 180) % 360);
        if (b.dataset.wsAction === 'inherit' && draft.appearance) delete draft.appearance[b.dataset.key];
        if (b.dataset.wsAction === 'reset-group') WidgetSettings.resetGroup(draft, b.dataset.group);
        show();
      };
      show();
      dlg.showModal();
    };
}
// the grid
function edGrid({ $, U, d, drawCanvas, hist, mark, row }) {
  if (!row)
    $('e-background').onclick = () => {
      const slider = (id, label, v, min, max, hint, always) =>
        `<div class="field"><label for="${id}">${label} <output id="${id}-v">${v}%</output></label><input id="${id}" type="range" min="${min}" max="${max}" step="1" value="${v}"${always || Backdrop.has(d) ? '' : ' disabled'}>${hint ? `<span class="muted hint">${hint}</span>` : ''}</div>`;
      const preview = () => {
        const sample = Frame.css('', {}, 'var(--muted)', d);
        return `<div class="bgprev" id="bg-prev" style="aspect-ratio:${d.ratioW} / ${d.ratioH}">${Backdrop.html(d)}
      <div class="lw" style="left:6%;top:10%;width:38%;height:26%;font-size:5cqw;${sample}">Best lap</div><div class="lw" style="left:50%;top:10%;width:44%;height:26%;font-size:5cqw;font-weight:600;${sample}">3.421</div>
      <div class="lw" style="left:6%;top:46%;width:88%;height:40%;font-size:6cqw;font-weight:600;${sample}">Alex &nbsp; 4/10</div></div>`;
      };
      const show = () => {
        dlg.innerHTML = `<form id="bgform"><h3>Page background</h3>
        <p class="muted">A picture behind all the widgets of this layout. The filters only change the picture, never the widgets. The widgets in the preview are samples.</p>
        ${preview()}
        <div class="field"><label for="bg-file">Picture</label><div class="inline"><input type="file" id="bg-file" accept="image/*">${Backdrop.has(d) ? ' <button class="btn" type="button" id="bg-clear">Remove</button>' : ''}</div>
          ${Backdrop.has(d) ? '' : '<span class="muted hint">No picture: the theme colour is the background.</span>'}</div>
        <div class="field"><label for="bg-fit">Fit</label><select id="bg-fit"${Backdrop.has(d) ? '' : ' disabled'}>${Backdrop.FITS.map(([k, t]) => `<option value="${k}"${k === Backdrop.fit(d) ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
        ${slider('bg-blur', 'Blur', Backdrop.blur(d), 0, 100, 'Softens the picture so it does not compete with the numbers.')}
        ${slider('bg-bright', 'Brightness', Backdrop.brightness(d), 20, 150, '100% is as it is; lower makes it darker.')}
        ${slider('bg-sat', 'Colour', Backdrop.saturation(d), 0, 200, '0% is black and white, 100% is as it is.')}
        <h4>Widgets</h4>
        ${slider('bg-wtrans', 'Widget transparency', Frame.layoutTransparency(d), 0, 100, 'The look of all widgets of this layout, also the ones you add later. Fades the widget background and border, not the text. A widget can have its own setting (Background and border) that wins.', true)}
        <p class="error" id="bg-err" role="alert"></p>
        <div class="row"><button class="btn" type="button" id="bg-reset">Reset filters</button><button class="btn primary" type="submit">Done</button></div></form>`;
        const again = single => {
          mark();
          drawCanvas();
          if (single) hist.commit();
        };
        const refresh = single => {
          $('bg-prev').outerHTML = preview();
          again(single);
        };
        $('bg-file').onchange = async e => {
          const f = e.target.files && e.target.files[0];
          if (!f) return;
          try {
            d.bgImage = await resizeImage(f, 1920);
            again(true);
            show();
          } catch (x) {
            $('bg-err').textContent = x.message;
          }
        };
        if ($('bg-clear'))
          $('bg-clear').onclick = () => {
            d.bgImage = '';
            again(true);
            show();
          };
        $('bg-fit').onchange = e => {
          d.bgFit = e.target.value;
          refresh(true);
        };
        $('bg-wtrans').oninput = e => {
          d.widgetTransparency = Frame.layoutTransparency({ widgetTransparency: e.target.value });
          $('bg-wtrans-v').textContent = `${d.widgetTransparency}%`;
          refresh();
        };
        [
          ['bg-blur', 'bgBlur'],
          ['bg-bright', 'bgBrightness'],
          ['bg-sat', 'bgSaturation']
        ].forEach(([id, key]) => {
          $(id).oninput = e => {
            d[key] = Number(e.target.value);
            $(id + '-v').textContent = `${Backdrop[{ bgBlur: 'blur', bgBrightness: 'brightness', bgSaturation: 'saturation' }[key]](d)}%`;
            refresh();
          };
        });
        $('bg-reset').onclick = () => {
          d.bgBlur = 0;
          d.bgBrightness = 100;
          d.bgSaturation = 100;
          again(true);
          show();
        };
        $('bgform').onsubmit = ev => {
          ev.preventDefault();
          dlg.close();
        };
      };
      show();
      dlg.onclick = null;
      dlg.onchange = null;
      dlg.showModal();
    };

  // selecting, dragging and resizing: the geometry rules live in widgets.js
  const toUnits = (ev, rect) => ({ x: ((ev.clientX - rect.left) * U) / rect.width, y: ((ev.clientY - rect.top) * U) / rect.width });
  return { toUnits };
}
// dragging, the marquee and group resize
function edGestures({ $, Hh, U, d, drawGeometry, drawRows, drawSide, ed, hist, mark, redraw, toUnits }) {
  const gesture = (start, apply, finish) => {
    let ended = false;
    const queue =
      typeof EditorCanvas !== 'undefined'
        ? EditorCanvas.latest(ev => {
            if (!ended && state.editing === ed) apply(ev);
          })
        : null;
    const accepts = ev => start.pointerId === undefined || ev.pointerId === undefined || start.pointerId === ev.pointerId;
    const move = ev => {
      if (accepts(ev)) {
        if (queue) queue.push(ev);
        else apply(ev);
      }
    };
    const end = (draw = true) => {
      if (ended) return;
      queue?.flush();
      ended = true;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('blur', blur);
      ed.cancelGesture = null;
      finish(draw);
    };
    const up = ev => {
        if (accepts(ev)) end();
      },
      blur = () => end();
    ed.cancelGesture = () => end(false);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('blur', blur);
  };
  const marquee = e => {
    const rect = $('canvas').getBoundingClientRect(),
      s = toUnits(e, rect),
      base = e.shiftKey ? [...ed.sel] : [];
    const m = document.createElement('div');
    m.className = 'marq';
    $('canvas').appendChild(m);
    let moved = false;
    const hit = r => d.widgets.filter(w => w.x < r.x + r.w && r.x < w.x + w.w && w.y < r.y + r.h && r.y < w.y + w.h);
    const move = ev => {
      const p = toUnits(ev, rect),
        r = { x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) };
      moved = moved || r.w > 3 || r.h > 3;
      Object.assign(m.style, {
        left: `${(r.x / U) * 100}%`,
        top: `${(r.y / Hh()) * 100}%`,
        width: `${(r.w / U) * 100}%`,
        height: `${(r.h / Hh()) * 100}%`
      });
      ed.sel = [...new Set([...base, ...hit(r)])];
      $('canvas')
        .querySelectorAll('.lw')
        .forEach(el => el.classList.toggle('sel', ed.sel.includes(d.widgets[Number(el.dataset.i)])));
    };
    const up = draw => {
      if (m.remove) m.remove();
      if (!moved && !e.shiftKey) ed.sel = [];
      if (draw) redraw();
    };
    gesture(e, move, up);
  };
  // resizing the selection: a corner of the frame round several widgets. The box that holds them is resized (snapping like a single widget does); every widget scales with it.
  const groupResize = (e, handle) => {
    const rect = $('canvas').getBoundingClientRect(),
      k = U / rect.width,
      H = Hh();
    const group = [...ed.sel],
      from = group.map(g => ({ x: g.x, y: g.y, w: g.w, h: g.h })),
      box0 = Widgets.bbox(from);
    const others = d.widgets.filter(o => !group.includes(o)),
      sx = e.clientX,
      sy = e.clientY;
    let moved = false;
    hist.hold();
    const move = ev => {
      const mode = !ed.snap ? false : ev.ctrlKey || ev.metaKey ? 'grid' : true;
      const nb = Widgets.resizeWidget(box0, handle, (ev.clientX - sx) * k, (ev.clientY - sy) * k, others, U, H, mode, d.guides);
      Widgets.scaleGroup(from, box0, nb, mode, U, H).forEach((q, i) => Object.assign(group[i], q));
      ed.snapLines = Widgets.snapLines(Widgets.bbox(group), others, U, H, d.guides);
      moved = true;
      mark();
      drawGeometry(group);
    };
    const up = draw => {
      ed.snapLines = null;
      if (draw && moved) {
        drawGeometry(group);
        drawRows();
      }
      hist.release();
      if (draw) drawSide();
    };
    gesture(e, move, up);
  };
  return { gesture, groupResize, marquee };
}
// the pointer on the canvas
function edCanvasPointer({ $, Hh, U, d, drawGeometry, drawRows, drawSide, ed, gesture, groupResize, hist, mark, marquee, redraw }) {
  $('canvas').onpointerdown = e => {
    if (e.button !== undefined && e.button !== 0) return;
    ed.cancelGesture?.();
    hist.release(); // what was changed before (typing, a slider) is a step of its own
    if (e.target && e.target.dataset && e.target.dataset.gh && ed.sel.length > 1) {
      groupResize(e, e.target.dataset.gh);
      e.preventDefault();
      return;
    }
    const el = e.target.closest('.lw');
    if (!el) {
      marquee(e);
      e.preventDefault();
      return;
    }
    const w = d.widgets[Number(el.dataset.i)],
      handle = e.target.dataset.h || null;
    if (e.shiftKey) {
      ed.sel = ed.sel.includes(w) ? ed.sel.filter(x => x !== w) : [...ed.sel, w];
      redraw();
      e.preventDefault();
      return;
    }
    if (!ed.sel.includes(w)) {
      ed.sel = [w];
      redraw();
    }
    const rect = $('canvas').getBoundingClientRect(),
      k = U / rect.width,
      H = Hh();
    const group = [...ed.sel],
      from = group.map(g => ({ x: g.x, y: g.y, w: g.w, h: g.h })),
      box0 = Widgets.bbox(from);
    const others = d.widgets.filter(o => !group.includes(o)),
      sx = e.clientX,
      sy = e.clientY;
    let moved = false;
    hist.hold(); // a drag is one step, however long it takes
    const move = ev => {
      const dx = (ev.clientX - sx) * k,
        dy = (ev.clientY - sy) * k;
      const mode = !ed.snap ? false : ev.ctrlKey || ev.metaKey ? 'grid' : true; // holding Ctrl (Cmd): the grid only, no magnets
      if (handle && group.length === 1)
        Object.assign(group[0], Widgets.resizeWidget(from[0], handle, dx, dy, others, U, H, mode, d.guides));
      else {
        const nb = Widgets.moveWidget(box0, dx, dy, others, U, H, mode, d.guides),
          ox = nb.x - box0.x,
          oy = nb.y - box0.y;
        group.forEach((g, i) => {
          g.x = from[i].x + ox;
          g.y = from[i].y + oy;
        });
      }
      ed.snapLines = Widgets.snapLines(Widgets.bbox(group), others, U, H, d.guides);
      moved = true;
      mark();
      drawGeometry(group);
    };
    const up = draw => {
      ed.snapLines = null;
      if (draw && moved) {
        drawGeometry(group);
        drawRows();
      }
      // moving the copies you just made sets the step for the next duplicate
      if (moved && ed.lastDup && group.length === ed.lastDup.copies.length && group.every(g => ed.lastDup.copies.includes(g)))
        ed.dupStep = Widgets.stepFrom(ed.lastDup.srcBox, group);
      hist.release();
      if (draw) drawSide();
    };
    gesture(e, move, up);
    e.preventDefault();
  };

  // the side panel changes every selected widget at once
  const side = $('side');
  return { side };
}
// typing in the side panel
function edSideInput({ $, Hh, U, d, drawCanvas, ed, hist, mark, side }) {
  if (side.addEventListener)
    side.addEventListener(
      'toggle',
      ev => {
        const g = ev.target;
        if (g && g.dataset && g.dataset.side) {
          if (g.open) state.sideOpen.add(g.dataset.side);
          else state.sideOpen.delete(g.dataset.side);
          if (g.open) foldSideHints(g); // (the hints of a folder are measured when it opens)
          fitPanels();
        }
      },
      true
    );
  side.oninput = e => {
    const sel = ed.sel,
      t = e.target;
    if (!sel.length) return;
    if (typeof WidgetDesign !== 'undefined' && (t.dataset.wdFormat || t.dataset.wdRule !== undefined)) {
      sel.forEach(w => WidgetDesign.input(w, t));
      mark();
      drawCanvas(sel);
      return;
    }
    if (t.dataset.ws) {
      if (t.type === 'range' && t.previousElementSibling?.tagName === 'OUTPUT')
        t.previousElementSibling.textContent = t.value + (t.dataset.key === 'lapDuration' ? ' ms' : '%');
      if (t.type === 'number' && t.value !== '' && !Number.isFinite(t.valueAsNumber)) return;
      sel.forEach(w => WidgetSettings.change(w, t.dataset.ws, t.dataset.key, t.type === 'checkbox' ? t.checked : t.value));
      mark();
      drawCanvas(sel);
      return;
    }
    if (t.dataset.size) {
      const k = t.dataset.size,
        v = Number(t.value),
        H = Hh();
      if (!Number.isFinite(v) || t.value === '') return; // the same width or height for all of them (1.47.0)
      sel.forEach(g => {
        if (k === 'w') g.w = Math.max(Widgets.MIN, Math.min(U - g.x, v));
        else g.h = Math.max(Math.min(Widgets.MIN, H), Math.min(H - g.y, v));
      });
      mark();
      drawCanvas(sel);
      return;
    }
    if (t.dataset.geo && sel.length === 1) {
      const k = t.dataset.geo,
        v = Number(t.value),
        H = Hh(),
        w = sel[0];
      if (!Number.isFinite(v) || t.value === '') return;
      if (k === 'x') w.x = Math.max(0, Math.min(U - w.w, v));
      else if (k === 'y') w.y = Math.max(0, Math.min(H - w.h, v));
      else if (k === 'w') w.w = Math.max(Widgets.MIN, Math.min(U - w.x, v));
      else w.h = Math.max(Math.min(Widgets.MIN, H), Math.min(H - w.y, v));
      mark();
      drawCanvas(sel);
      return;
    }
    if (t.id === 's-size')
      sel.forEach(w => {
        w.textSize = t.value === '' ? '' : Number(t.value);
      });
    else if (t.id === 's-tsize')
      sel.forEach(w => {
        w.titleSize = t.value === '' ? '' : Number(t.value);
      });
    else if (t.id === 's-title') sel[0].title = t.value;
    else if (t.id === 's-bshade') {
      sel.forEach(w => {
        w.borderShade = Number(t.value);
      });
      const o = $('s-bshade-v');
      if (o) o.textContent = `${Frame.shade(sel[0])}%`;
    } else if (t.id === 's-bcolor') {
      const h = Frame.hex(t.value);
      if (h)
        sel.forEach(w => {
          w.borderColor = h;
        });
    } else if (t.id === 's-bwidth') {
      const v = Frame.widthOf({ borderWidth: t.value });
      sel.forEach(w => {
        w.borderWidth = v === null ? '' : v;
      });
    } else if (t.id === 's-radius') {
      const v = Frame.cornerPct(t.value);
      sel.forEach(w => {
        w.radius = v === null ? '' : v;
      });
    } else if (t.id === 's-trans') {
      sel.forEach(w => {
        w.transparency = Number(t.value);
      });
      const o = $('s-trans-v');
      if (o) o.textContent = `${Frame.transparency(sel[0], d)}%`;
    } else if (t.dataset.color) {
      sel.forEach(w => {
        w[t.dataset.color] = t.value;
      });
      const cb = side.querySelector(`[data-theme="${t.dataset.color}"]`);
      if (cb) cb.checked = false;
    } else if (t.dataset.opt)
      sel.forEach(w => {
        w.opt = w.opt || {};
        if (t.dataset.opt === 'pluginView')
          Object.keys(w.opt)
            .filter(k => k.startsWith('plugin_'))
            .forEach(k => delete w.opt[k]);
        if (t.dataset.opt === 'preset' && AllInOne.TYPES.has(w.type)) w.opt = AllInOne.applyPreset(w.opt, t.value);
        w.opt[t.dataset.opt] = t.type === 'number' || t.type === 'range' ? Number(t.value) : t.type === 'checkbox' ? !!t.checked : t.value;
      });
    else return;
    if (t.dataset.opt && t.type === 'range' && t.id) {
      const out = $(t.id + '-v');
      if (out) out.textContent = `${t.value}${t.dataset.unit || ''}`;
    } // (the figure beside a widget's own slider)
    mark();
    drawCanvas(sel);
    if (t.type === 'checkbox' || t.type === 'select-one') hist.commit(); // (a tick box or a choice from a list is one action; typing and sliders end their step after a quiet moment)
  };
}
// changes in the side panel
function edSideChange({ $, d, drawCanvas, ed, redraw, refreshAssets, side, step }) {
  side.onchange = async e => {
    const sel = ed.sel,
      t = e.target;
    if (!sel.length) return;
    if (t.dataset.chartPreview !== undefined) {
      ed.previewTrackId = t.value;
      refreshAssets();
      fitEditorWidgets(
        [...$('canvas').querySelectorAll('.lw[data-i]')].filter(el => d.widgets[Number(el.dataset.i)]?.type === 'racechart')
      );
      return;
    }
    if (t.dataset.wdImport !== undefined) {
      try {
        const file = t.files?.[0];
        if (!file) return;
        if (file.size > 100000) throw Error('Style file is too large.');
        const raw = JSON.parse(await file.text());
        if (raw.kind !== 'slotforge-widget-style' || !raw.style) throw Error('Choose an exported SlotForge widget style.');
        const clean = WidgetDesign.cleanStyles([{ id: 'imported', name: raw.name, style: raw.style }])[0];
        if (!clean) throw Error('Invalid style file.');
        const saved = WidgetDesign.saveStyle(d, ed.sel[0], clean.name);
        if (!saved) throw Error('This layout already has 50 styles.');
        saved.style = clean.style;
        step();
        redraw();
        $('e-msg').textContent = 'Imported style: ' + saved.name;
      } catch (err) {
        $('e-msg').textContent = err.message;
      }
      return;
    }
    if (t.dataset.wdFormat || t.dataset.wdRule !== undefined) {
      step();
      redraw();
      return;
    }
    if (t.dataset.ws) {
      step();
      redraw();
      return;
    }
    if (t.id === 's-lanestyle' && ['', ...Frame.LANE_STYLES.map(x => x[0]), 'none'].includes(t.value)) {
      sel.forEach(w => {
        if (t.value) w.laneColorStyle = t.value;
        else delete w.laneColorStyle;
      });
      step();
      redraw();
      return;
    }
    if (t.dataset.optimglist) {
      // one of the step pictures
      if (!t.files || !t.files[0]) return;
      try {
        const img = await resizeImage(t.files[0], 256, true),
          idx = Number(t.dataset.idx);
        sel.forEach(w => {
          w.opt = w.opt || {};
          const a = [...(w.opt[t.dataset.optimglist] || [])];
          a[idx] = img;
          w.opt[t.dataset.optimglist] = a;
        });
        step();
        redraw();
      } catch (x) {
        $('e-msg').textContent = x.message;
      }
      return;
    }
    if (
      t.dataset.opt === 'pluginView' ||
      t.dataset.opt === 'steps' ||
      t.dataset.opt === 'design' ||
      t.dataset.opt === 'imageSet' ||
      t.dataset.opt === 'flagStyle' ||
      (t.dataset.opt && ((Widgets.def(sel[0].type) || {}).options || []).some(o => o.rerender && o.key === t.dataset.opt))
    ) {
      if (t.dataset.opt !== 'steps') {
        sel.forEach(w => {
          w.opt = w.opt || {};
          w.opt[t.dataset.opt] = t.value;
        });
        step();
      }
      redraw();
      return;
    } // the number of picture slots changed
    if (t.dataset.optimg) {
      // a picture for one option: shrunk, transparency kept
      if (!t.files || !t.files[0]) return;
      try {
        const img = await resizeImage(t.files[0], 512, true);
        sel.forEach(w => {
          w.opt = w.opt || {};
          w.opt[t.dataset.optimg] = img;
        });
        step();
        redraw();
      } catch (x) {
        $('e-msg').textContent = x.message;
      }
      return;
    }
    if (t.id === 's-transfollow') {
      sel.forEach(w => {
        w.transparency = t.checked ? '' : Frame.transparency(w, d);
      });
      step();
      redraw();
      return;
    } // unticking keeps what it looks like now, as the widget's own setting
    if (t.id === 's-bmode' && Frame.MODES.includes(t.value)) {
      sel.forEach(w => {
        w.borderMode = t.value;
      });
      step();
      redraw();
      return;
    } // the shade slider is only for "Shade of the background"
    if (t.id === 's-lane' && t.value !== '') {
      sel.forEach(w => {
        if (t.value === 'follow')
          w.follow = true; // (the widget keeps its lane for every race that is not Solo)
        else {
          w.lane = Number(t.value);
          delete w.follow;
        }
      });
      step();
      drawCanvas(sel);
    }
    if (t.id === 's-tbold') {
      sel.forEach(w => {
        w.titleBold = !!t.checked;
      });
      step();
      drawCanvas(sel);
    }
    if (t.id === 's-talign' && Widgets.ALIGNS.some(a => a[0] === t.value)) {
      sel.forEach(w => {
        w.titleAlign = t.value;
      });
      step();
      drawCanvas(sel);
      return;
    }
    if (t.id === 's-valign' && Widgets.ALIGNS.some(a => a[0] === t.value)) {
      sel.forEach(w => {
        if (w.type !== 'leaderboard') w.valueAlign = t.value;
      });
      step();
      drawCanvas(sel);
      return;
    }
    if (t.id === 's-vbold') {
      sel.forEach(w => {
        w.valueBold = !!t.checked;
      });
      step();
      drawCanvas(sel);
    }
    if (t.id === 's-vital') {
      sel.forEach(w => {
        w.valueItalic = !!t.checked;
      });
      step();
      drawCanvas(sel);
    }
    if (t.id === 's-showtitle') {
      sel.forEach(w => {
        w.showTitle = !!t.checked;
      });
      step();
      drawCanvas(sel);
    }
    if (t.dataset.theme) {
      // (2.4.0 review) unticked: the colour beside it is used (before, nothing happened and the box lied)
      const pick = side.querySelector(`[data-color="${t.dataset.theme}"]`),
        v = t.checked ? '' : (pick && pick.value) || '';
      sel.forEach(w => {
        w[t.dataset.theme] = v;
      });
      step();
      drawCanvas(sel);
    }
  };
}
// clicks in the side panel
function edSideClick({ $, arrange, d, duplicateSel, ed, redraw, removeSel, side, step, tidySel }) {
  side.onclick = async e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset?.lanebtn !== undefined) {
      // (2.4.0, "Editor Panels") a lane button sets the Lane list under it, which does what it always did
      const pick = $('s-lane');
      if (pick) {
        pick.value = b.dataset.lanebtn;
        side.querySelectorAll('[data-lanebtn]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        side.onchange({ target: pick });
      }
      return;
    }
    if (b.dataset?.wdAction) {
      const action = b.dataset.wdAction,
        index = Number(b.dataset.index);
      if (action === 'export-style') {
        const id = side.querySelector('[data-wd-style]')?.value,
          s = WidgetDesign.cleanStyles(d.widgetStyles).find(s => s.id === id);
        if (!s) {
          $('e-msg').textContent = 'Choose a saved style first.';
          return;
        }
        const url = URL.createObjectURL(
            new Blob([JSON.stringify({ kind: 'slotforge-widget-style', name: s.name, style: s.style }, null, 2)], {
              type: 'application/json'
            })
          ),
          a = document.createElement('a');
        a.href = url;
        a.download = 'SlotForge-widget-style.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return;
      }
      if (action === 'rule-preview') {
        const rule = WidgetDesign.cleanRules(ed.sel[0].designRules)[index],
          demo = side.querySelector('.wd-rule-preview');
        if (rule && demo) {
          demo.style.cssText = '';
          demo.style.border = '2px solid var(--line)';
          demo.style.color = 'var(--ink)';
          demo.style.background = 'var(--panel)';
          if (rule.target.includes('text')) demo.style.color = rule.color;
          if (rule.target.includes('border')) demo.style.borderColor = rule.color;
          if (rule.target === 'background') {
            demo.style.background = rule.color;
            demo.style.color = Timing.contrast(rule.color);
          }
          if (rule.target === 'accent') demo.style.borderLeft = '6px solid ' + rule.color;
          demo.scrollIntoView({ block: 'nearest' });
        }
        return;
      }
      const message = WidgetDesign.action(action, ed.sel, d, side, index);
      step();
      redraw();
      $('e-msg').textContent = message;
      return;
    }
    if (b.dataset?.lapPreview) {
      const kind = b.dataset.lapPreview === 'lap' ? '' : b.dataset.lapPreview;
      LapHighlights.pulse(side.querySelector('.lap-settings-preview'), ed.sel[0], d, kind);
      ed.sel.forEach(w => {
        const el = document.querySelector('#canvas .lw[data-i="' + d.widgets.indexOf(w) + '"]');
        if (el) LapHighlights.pulse(el, w, d, kind);
      });
      return;
    }
    if (b.dataset?.wsAction) {
      const action = b.dataset.wsAction;
      if (action === 'font-scan') {
        b.disabled = true;
        try {
          const count = await WidgetFonts.scan();
          redraw();
          $('e-msg').textContent =
            count + ' installed font families available in the font selectors. Type a name while a selector is focused to find it.';
        } catch (err) {
          b.disabled = false;
          $('e-msg').textContent = err.message;
        }
        return;
      }
      if (action === 'font-highvis') ed.sel.forEach(w => WidgetFonts.highVisibility(w));
      if (action === 'font-reset')
        ed.sel.forEach(w => {
          delete w.fonts;
        });
      if (action === 'copy') {
        WidgetSettings.copy(ed.sel[0], d);
        $('e-msg').textContent = 'Appearance copied. Select other widgets and choose Paste appearance.';
        return;
      }
      if (action === 'paste') {
        if (!ed.sel.map(w => WidgetSettings.paste(w)).some(Boolean)) {
          $('e-msg').textContent = 'Copy an appearance first.';
          return;
        }
      }
      if (action === 'reverse')
        ed.sel.forEach(w => WidgetSettings.change(w, 'appearance', 'angle', (Frame.appearance(w, d).angle + 180) % 360));
      if (action === 'inherit')
        ed.sel.forEach(w => {
          if (w.appearance) delete w.appearance[b.dataset.key];
        });
      if (action === 'reset-group') ed.sel.forEach(w => WidgetSettings.resetGroup(w, b.dataset.group));
      if (action === 'icon-reset')
        ed.sel.forEach(w => {
          if (w.typography) delete w.typography.iconSize;
        });
      if (action === 'reset')
        ed.sel.forEach(w => {
          delete w.appearance;
        });
      step();
      redraw();
      return;
    }
    if (b.dataset && b.dataset.clearopt) {
      ed.sel.forEach(w => {
        if (!w.opt) return;
        if (b.dataset.idx !== undefined) {
          const a = [...(w.opt[b.dataset.clearopt] || [])];
          a[Number(b.dataset.idx)] = null;
          w.opt[b.dataset.clearopt] = a;
        } else delete w.opt[b.dataset.clearopt];
      });
      step();
      redraw();
      return;
    }
    if (b.dataset && b.dataset.saveset) {
      // the pictures uploaded in this widget become a set that other widgets and layouts can use too
      const w = ed.sel[0],
        o = w.opt || {},
        fuel = w.type === 'fuel',
        n = (ed.imageSets || []).filter(r => r.kind === (fuel ? 'fuel' : 'flag')).length + 1;
      const set = fuel
        ? {
            name: `Fuel pictures ${n}`,
            kind: 'fuel',
            steps: Widgets.clampInt(o.steps ?? 10, 2, 20, 10),
            images: Array.from({ length: Widgets.clampInt(o.steps ?? 10, 2, 20, 10) }, (_, i) => (o.stepImages || [])[i] || '')
          }
        : {
            name: `Flag pictures ${n}`,
            kind: 'flag',
            images: Object.fromEntries(Widgets.FLAG_STATES.map(([k]) => [k, o['img_' + k] || '']))
          };
      api.add('imagesets', set).then(async row => {
        ed.imageSets = await EditorData.choices(api, 'imagesets');
        ed.previewLoads = new Map();
        ed.sel.forEach(x => {
          x.opt = x.opt || {};
          x.opt.imageSet = row.id;
        });
        step();
        redraw();
        $('e-msg').textContent = `Saved as the set "${set.name}". You can rename it under Customization > Picture sets.`;
      });
      return;
    }
    if (b.dataset && b.dataset.arr) {
      arrange(b.dataset.arr);
      return;
    }
    if (b.id === 's-del') removeSel();
    if (b.id === 's-dup') duplicateSel();
    if (b.id === 's-tidy' || b.id === 's-tidyall') tidySel();
  };

  if (editorKeyHandler) document.removeEventListener('keydown', editorKeyHandler);
}
// the keyboard
function edKeys({ d, ed, redraw, removeSel }) {
  editorKeyHandler = e => {
    const mod = e.ctrlKey || e.metaKey,
      key = String(e.key).toLowerCase();
    if (mod && (key === 'z' || key === 'y') && !typingIn(e.target) && dlg.open !== true) {
      e.preventDefault();
      if (key === 'y' || e.shiftKey) window.editorRedo();
      else window.editorUndo();
      return;
    }
    if (e.target && e.target.matches && e.target.matches('input,select,textarea')) return;
    // (2.4.0 review) a dialog is open (lane colours, guidelines, a question): its keys are not for the widgets behind it
    if (dlg.open === true || (e.target && e.target.closest && e.target.closest('dialog'))) return;
    if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'a') {
      e.preventDefault();
      ed.sel = [...d.widgets];
      redraw();
      return;
    }
    if (!ed.sel.length) return;
    if (e.key === 'Delete' || e.key === 'Backspace') removeSel();
    else if (e.key === 'Escape') {
      ed.sel = [];
      redraw();
    }
  };
  document.addEventListener('keydown', editorKeyHandler);
}

// (2.4.0) Pit Board: the bar on top of every full-screen editor. On top: back (to the list it came from), the name in big type with the note
// under it, whether it is saved, Undo / Redo and Save. Under it: the tools in named groups. Ids stay those of each editor (o.backId…).
const PB_BACK =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
const pbIcon = name => (typeof Icons !== 'undefined' ? Icons.svg(name, { size: 16, stroke: 1.8 }) : '');
const pbGroup = (label, html) => `<div class="pb-grp">${label ? `<span class="pb-gl">${esc(label)}</span>` : ''}${html}</div>`;
function pitBoard(o) {
  const undo = o.undoId
    ? `<button class="btn ghost icon" type="button" id="${o.undoId}" title="Undo the last change (Ctrl+Z)" aria-label="Undo" disabled>${pbIcon('undo')}</button><button class="btn ghost icon" type="button" id="${o.redoId}" title="Redo (Ctrl+Y)" aria-label="Redo" disabled>${pbIcon('redo')}</button>`
    : '';
  return `<header class="pitboard${o.cls ? ' ' + o.cls : ''}"><div class="pb-top"><button type="button" class="pb-back" id="${o.backId}" title="Back to ${esc(o.back)}">${PB_BACK}<span>${esc(o.back)}</span></button><span class="pb-vline" aria-hidden="true"></span><div class="pb-who"><span class="pb-eye">${esc(o.eyebrow)}</span>${o.name}${o.note || ''}</div><div class="pb-end">${o.msgId ? `<span id="${o.msgId}" class="pb-msg" role="status"></span>` : ''}${o.end || ''}<span class="pb-state" data-pb-state aria-live="polite"></span>${undo}<button class="btn primary" type="${o.saveType || 'button'}" id="${o.saveId}">${esc(o.save)}</button></div></div>${o.tools ? `<div class="pb-tools">${o.tools}</div>` : ''}</header>`;
}
// the state beside Save: "Unsaved changes" with a yellow dot, or "Saved"; it follows the editor while it is on screen
function pbWatch(root, dirty) {
  const el = root && root.querySelector ? root.querySelector('[data-pb-state]') : null;
  if (!el) return;
  const show = () => {
    const d = !!dirty();
    if (el.dataset.dirty === String(d)) return;
    el.dataset.dirty = String(d);
    el.className = 'pb-state' + (d ? ' dirty' : ' clean');
    el.textContent = d ? 'Unsaved changes' : 'Saved';
  };
  show();
  if (el.isConnected === true && typeof setInterval === 'function') {
    const t = setInterval(() => (el.isConnected ? show() : clearInterval(t)), 400);
  }
}
function renderEditor() {
  state.editing?.cancelGesture?.();
  const ed = state.editing,
    d = ed.draft,
    paintVersion = (ed.paintVersion = (ed.paintVersion || 0) + 1);
  if (!widgetEditorResizeWired && window.addEventListener) {
    widgetEditorResizeWired = true;
    window.addEventListener('resize', () => scheduleEditorFit());
    window.addEventListener('widget-fonts-ready', e => scheduleEditorFit(e.detail?.elements));
  }
  const preset = PRESETS.find(p => p[1] === d.ratioW && p[2] === d.ratioH);
  const row = d.kind === 'row',
    REG = (row ? Widgets.REGISTRY.filter(x => x.perLane && !x.layoutOnly) : Widgets.REGISTRY).filter(x => !x.hidden); // the custom text kinds are made in the Widget Builder, not added from here
  const GROUP_ORDER = [
    'All-in-One',
    'Race',
    'Driver',
    'Slotcar',
    'Team and Swaps',
    'Position and Progress',
    'Multi-Class',
    'Lap Times and Records',
    'Pit Stops',
    'Delta Timers',
    'Tyres',
    'Push & Save',
    'Weather',
    'Charts',
    'Plugins',
    'Custom',
    'Controls'
  ]; // (every folder is in the list: the Layout Editor shows the folders in this order)
  const groups = [...new Set(REG.map(x => x.group))].sort(
    (a, b) => ((GROUP_ORDER.indexOf(a) + 100) % 100) - ((GROUP_ORDER.indexOf(b) + 100) % 100)
  );
  const savedWidgets = (ed.customWidgets || []).filter(r => !row || /lane$/.test(r.type));
  // the widget list: each group is a folder that can be opened and closed (it stays as you left it)
  state.palOpen = state.palOpen || new Set();
  // (2.4.0, SlotForgeRestyle.md "Editor Panels") a folder: its name in Barlow, how many widgets it holds, a chevron; the widgets as quiet rows with a + on hover
  const folder = (name, buttons) =>
    `<details class="palgroup" data-pal="${esc(name)}"${state.palOpen.has(name) ? ' open' : ''}><summary><span class="pal-t">${esc(name)}</span><span class="pal-n">${(buttons.match(/<button /g) || []).length}</span></summary>${buttons}</details>`;
  const palette = () =>
    groups
      .map(g =>
        folder(
          g,
          REG.filter(x => x.group === g)
            .map(
              x =>
                `<button class="pal-it" data-add="${x.type}">${esc(x.label)}</button>${x.type === 'fuel' ? '<button class="pal-it" data-add="fuel" data-preset="fuelstrip" title="The Fuel widget as a slim strip: FUEL, a bar and the value">Fuel Strip</button>' : ''}`
            )
            .join('')
        )
      )
      .join('') +
    (savedWidgets.length
      ? '<div class="pal-cap">Yours</div>' +
        folder('Custom', savedWidgets.map(r => `<button class="pal-it" data-addcw="${esc(r.id)}">${esc(r.name)}</button>`).join(''))
      : '');
  const hasGuides = () => d.guides.v.length + d.guides.h.length > 0;
  const S = row ? Rows.settings(d) : null;
  // (2.4.0) the Pit Board: back, the name and the note, Undo / Redo / Save on top; the tools in groups below; the settings of the page in one panel
  const field = (label, html, title = '') =>
    `<label class="pb-field"${title ? ` title="${esc(title)}"` : ''}><span>${label}</span>${html}</label>`;
  const pageSettings = row
    ? field('Row height', `<input type="number" id="e-rowh" min="20" max="400" value="${esc(S.rowH)}">`) +
      field('Space between rows', `<input type="number" id="e-gap" min="0" max="100" value="${esc(S.gap)}">`) +
      field('Rounded corners (0 = square)', `<input type="number" id="e-radius" min="0" max="50" value="${esc(S.radius)}">`) +
      field(
        'Classification',
        `<select id="e-classview">${[
          ['', 'Use race system'],
          ['overall', 'Overall'],
          ['class', 'One class'],
          ['grouped', 'Grouped by class']
        ]
          .map(([k, n]) => `<option value="${k}"${(d.classView || '') === k ? ' selected' : ''}>${n}</option>`)
          .join('')}</select>`
      ) +
      field(
        'Class',
        `<select id="e-classid"${d.classView === 'class' ? '' : ' disabled'}><option value="">Choose class…</option>${(ed.classDefs || []).map(c => `<option value="${esc(c.id)}"${d.classId === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select>`
      )
    : field(
        'Proportions',
        `<select id="e-ratio">${PRESETS.map(p => `<option value="${p[0]}"${preset && preset[0] === p[0] ? ' selected' : ''}>${p[0]}</option>`).join('')}<option value="custom"${preset ? '' : ' selected'}>Custom</option></select><span id="e-custom" ${preset ? 'hidden' : ''}><input type="number" id="e-rw" min="1" max="50" value="${esc(d.ratioW)}" aria-label="Width"> : <input type="number" id="e-rh" min="1" max="50" value="${esc(d.ratioH)}" aria-label="Height"></span>`
      ) +
      field(
        'Rounded corners',
        `<input type="number" id="e-lradius" min="0" max="50" step="0.5" placeholder="classic" value="${esc(Frame.cornerPct(d.radius) ?? '')}">`,
        'The corners of every widget: 0 is square, 50 is fully round. Empty keeps the classic small corners. A widget can have its own setting.'
      ) +
      field(
        'Lane colour style',
        `<select id="e-lanestyle">${Frame.LANE_STYLES.map(([key, label]) => `<option value="${key}"${key === Frame.layoutLaneStyle(d) ? ' selected' : ''}>${label}</option>`).join('')}</select>`
      );
  const toggle = (id, on, icon, label, title) =>
    `<label class="pb-tool pb-toggle" title="${esc(title)}"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}>${pbIcon(icon)}<span>${label}</span></label>`;
  const tools =
    pbGroup(
      'Arrange',
      toggle(
        'e-snap',
        ed.snap,
        'pin',
        'Snap',
        'Snap to grid, widgets and guidelines. Hold Ctrl (Cmd on a Mac) while you drag to snap to the grid only.'
      ) +
        (row
          ? ''
          : `<button class="pb-tool" type="button" id="e-guides" aria-pressed="${hasGuides()}">${pbIcon('lines')}<span>Guidelines</span></button>`)
    ) +
    pbGroup(
      'Look',
      row
        ? `<button class="pb-tool" type="button" id="e-rowcolors">${pbIcon('paint')}<span>Colours</span></button>${toggle('e-header', S.header, 'alignleft', 'Header row', 'A header row above the drivers')}`
        : `${typeof WidgetSettings !== 'undefined' ? `<button class="pb-tool" type="button" id="e-appearance">${pbIcon('paint')}<span>Widget appearance</span></button>` : ''}<button class="pb-tool" type="button" id="e-background" aria-pressed="${Backdrop.has(d)}" title="A picture behind all the widgets, with blur and other filters">${pbIcon('square')}<span>Background</span></button><button class="pb-tool" type="button" id="e-lanecolors">${pbIcon('lines')}<span>Lane colours</span></button>`
    ) +
    `<details class="pb-pop" id="e-pagesettings"${ed.pbOpen ? ' open' : ''}><summary class="pb-tool">${pbIcon('sliders')}<span>${row ? 'Row settings' : 'Page settings'}</span></summary><div class="pb-popbody"><span class="pb-eye">${row ? 'Row settings' : 'Page settings'}</span>${pageSettings}</div></details>`;
  view.innerHTML = `${pitBoard({
    cls: 'ed-pitboard',
    back: row ? 'Row designs' : 'Layouts',
    backId: 'e-back',
    eyebrow: row
      ? `${ed.id ? 'Edit row design' : 'New row design'} · height ${S.rowH}`
      : `${ed.id ? 'Edit layout' : 'New layout'} · ${preset ? preset[0] : d.ratioW + ':' + d.ratioH}`,
    name: `<input type="text" class="pb-name" id="e-name" value="${esc(d.name)}" maxlength="40" aria-label="Name">`,
    note: `<input type="text" class="pb-note" id="e-note" value="${esc(d.note || '')}" maxlength="120" placeholder="Click to add a note (shown in the list)" aria-label="Note">`,
    msgId: 'e-msg',
    undoId: 'e-undo',
    redoId: 'e-redo',
    saveId: 'e-save',
    save: row ? 'Save row design' : 'Save layout',
    tools
  })}
    <div class="ed-main"><aside class="ed-pal" aria-label="Widgets"><div class="pal-search"><input type="search" id="e-palsearch" placeholder="Find a widget" aria-label="Find a widget"></div><div class="pal-cap">Widgets</div>${palette()}</aside>
      <div class="ed-stage">${row ? '' : '<div class="lt-bar" id="e-try" role="region" aria-label="Try it with a sample race"></div>'}<div class="canvas" id="canvas"></div>${row ? '<h4>Preview: leader, normal, in the pits, penalty, out</h4><div class="rowprev" id="e-preview"></div>' : ''}</div>
      <aside class="ed-side" id="side"></aside></div>`;
  const $ = id => document.getElementById(id);
  // the steps for Undo and Redo: mark() says something changed (a drag or a typed word becomes one step after a quiet moment); step() ends the step now, for a single action
  const hist =
    ed.history ||
    (ed.history = Undo.create({
      clean: !ed.dirty,
      get: () => ({ draft: ed.draft }),
      apply: s => restoreDraft(ed, s),
      onchange: () => {
        if (ed.syncUndo) ed.syncUndo();
      }
    }));
  ed.syncUndo = () => {
    const u = document.getElementById('e-undo'),
      r = document.getElementById('e-redo');
    if (u) u.disabled = !hist.canUndo();
    if (r) r.disabled = !hist.canRedo();
  };
  const U = Widgets.U,
    mark = () => {
      ed.dirty = true;
      hist.touch();
    },
    step = () => {
      mark();
      hist.commit();
    };
  const Hh = () => Widgets.heightOf(d);
  // Static HTML hosts (including screen tests) do not install EditorCanvas.
  // The desktop editor keeps mounted nodes and only refits changed widgets.
  const mounted =
    typeof EditorCanvas !== 'undefined'
      ? EditorCanvas.create({ canvas: $('canvas'), layout: d, html: w => widgetHtml(w, false, false, d), fit: fitEditorWidgets })
      : null;
  const { drawCanvas, drawGeometry, drawRows, drawSide, redraw, refreshAssets } = edDrawing({
    $,
    Hh,
    U,
    d,
    ed,
    hasGuides,
    mark,
    mounted,
    paintVersion,
    row
  }); // (fitPanels does nothing when no editor is on the page)

  // (2.4.0, SlotForgeRestyle.md "Try It") the sample race above the canvas; the race setups that use the layout beside Saved
  if (!row && typeof LayoutTry !== 'undefined') {
    LayoutTry.mount({
      ed,
      refresh: () => {
        mounted?.invalidate();
        drawCanvas();
      },
      select: i => {
        if (!d.widgets[i]) return;
        ed.sel = [d.widgets[i]];
        drawCanvas();
        drawSide();
      }
    });
    LayoutTry.chip(ed, $('e-msg') && $('e-msg').parentElement);
  }
  const { duplicateSel, removeSel } = edAddAndSave({ $, Hh, U, d, ed, hist, mark, redraw, row, step });

  const { arrange, tidySel } = edArranging({ $, Hh, U, d, ed, mark, redraw, step });
  edCanvasSize({ $, Hh, U, d, drawCanvas, ed, hist, mark, redraw, row, step });
  edPalette({ $, Hh, U, d, drawCanvas, ed, hasGuides, redraw, row, step });

  edAppearance({ $, d, redraw, row, step });
  const { toUnits } = edGrid({ $, U, d, drawCanvas, hist, mark, row });
  const { gesture, groupResize, marquee } = edGestures({ $, Hh, U, d, drawGeometry, drawRows, drawSide, ed, hist, mark, redraw, toUnits });
  const { side } = edCanvasPointer({
    $,
    Hh,
    U,
    d,
    drawGeometry,
    drawRows,
    drawSide,
    ed,
    gesture,
    groupResize,
    hist,
    mark,
    marquee,
    redraw
  });
  edSideInput({ $, Hh, U, d, drawCanvas, ed, hist, mark, side });
  edSideChange({ $, d, drawCanvas, ed, redraw, refreshAssets, side, step });
  edSideClick({ $, arrange, d, duplicateSel, ed, redraw, removeSel, side, step, tidySel });
  edKeys({ d, ed, redraw, removeSel });
}
