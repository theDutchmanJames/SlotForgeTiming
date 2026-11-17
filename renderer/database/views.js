// database: list views: columns, filters, folders and the view settings of each list
// (part of renderer/database.js: loaded just before it by index.html; the parts share the page's global scope)
const VIEW_ENTITIES = ['tracks', 'drivers', 'teams', 'slotcars']; // the pages with View settings (and with the view card: click a row or a card)
const hue = t => {
  let n = 0;
  for (const ch of t) n = (n * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${n} 45% 40%)`;
}; // (the colour of a picture's placeholder, from the name)
// The picture of a card that has none. On the Race Setup pages it is the icon of the system or setup, in the colour of its sub-tab (1.47.1: the same icon and colour as its button
// in the strip: see SETUP_GROUPS in editor.js); on every other page it is the first letter of the name on a colour made from the name.
const SETUP_LOOK = {
  racesetups: ['racesetups', 'race'],
  penaltysystems: ['penalty', 'pen'],
  damagesystems: ['damage', 'dmg'],
  tyrewearsystems: ['tyre', 'tyre'],
  safetycarsystems: ['safetycar', 'sc'],
  pushsavesystems: ['pushsave', 'ps'],
  weathersystems: ['weather', 'wx'],
  fuelrules: ['fuel', 'fuel']
};
const noPicture = (e, t) => {
  const l = SETUP_LOOK[e];
  return l
    ? `<span class="ph phicon ss-${l[1]}">${Icons.svg(l[0], { size: 72, stroke: 1.4 })}</span>`
    : `<span class="ph" style="background:${hue(t)}">${esc((t.trim()[0] || '?').toUpperCase())}</span>`;
};
// The windows that open from a Race Setup page (the form, the extra fields) have the colour of that sub-tab too (1.47.2): the class puts the colour on the folders, the Save button and the options in it (styles.css, .setupform).
const setupToneClass = e => (SETUP_LOOK[e] ? ` setupform ss-${SETUP_LOOK[e][1]}` : '');
const VIRTUAL = { limit: { label: 'Laps / time', get: limitText } };
const columnOf = (s, k) =>
  k[0] === '@' ? { key: k, label: VIRTUAL[k.slice(1)].label, virtual: VIRTUAL[k.slice(1)] } : s.fields.find(f => f.key === k);
const columnCell = (f, i) => (f.virtual ? esc(f.virtual.get(i)) : cell(f, i[f.key]));

// ---- folders: the pages that list things in folders (Results and Records) look like the groups of the forms ----
// A folder is open unless the person closed it; that is remembered while the app runs (key: page + folder), also when the page is drawn again.
// Race Setups (1.69.0): the kind that the page shows ('all' or a session type), the picture of each kind on a card, and the kinds of the row above the cards
let setupFilter = 'all';
const SETUP_FILTERS = [
  ['all', 'All'],
  ['practice', 'Practice'],
  ['qualifying', 'Qualifying'],
  ['race', 'Race'],
  ['heats', 'Heats'],
  ['endurance', 'Endurance'],
  ['tokens', 'Time tokens']
];
// the kinds of the row "Start from a kind": the short names of the kinds, with the session type each one starts
const SETUP_START = [
  ['practice', 'Free practice'],
  ['qualifying', 'Qualifying'],
  ['race', 'Race'],
  ['heats', 'Heats'],
  ['endurance', 'Endurance'],
  ['tokens', 'Time tokens']
];
const SETUP_KIND_ICON = {
  practice: 'car',
  qualifying: 'timing',
  race: 'racesetups',
  heats: 'layers',
  endurance: 'rotation',
  tokens: 'tokens'
};
const folderClosed = new Set();
const folderKey = (page, id) => page + ':' + id;
const folderHtml = (page, id, title, note, body) =>
  `<details class="dbfolder" data-folder="${esc(folderKey(page, id))}"${folderClosed.has(folderKey(page, id)) ? '' : ' open'}><summary><strong>${esc(title)}</strong> <span class="muted">${esc(note)}</span></summary>${body}</details>`;
const folderToolsWith = extra =>
  `<div class="fgtools"><button class="btn" type="button" data-folderall="1">Open all</button><button class="btn" type="button" data-folderall="0">Close all</button>${extra || ''}</div>`;
const folderTools = folderToolsWith('');

// ---- View settings: which columns of a table (or which rows of a grid) are shown. The choice is kept in the settings (viewSettings), for every table and view on its own. ----
const viewBars = new Set(); // the bars that are open (kept while the app runs, also when the page is drawn again)
const viewButton = id =>
  `<button class="btn vsbtn${viewBars.has(id) ? ' on' : ''}" type="button" data-viewbar="${esc(id)}" aria-expanded="${viewBars.has(id)}" title="Choose which information is shown">View settings</button>`;
const viewSaved = path => ViewSet.get(state.settings.viewSettings, path);
// one group of check boxes: where the choice is kept (path) and the columns [{ key, label, on, note }]
const viewGroup = (title, path, cols) => {
  const shown = ViewSet.keys(cols, viewSaved(path));
  return `<fieldset class="vsgroup"><legend>${esc(title)}</legend>${cols
    .map(c => {
      const on = shown.includes(c.key),
        last = on && shown.length === 1;
      return `<label class="vschip"${c.note ? ` title="${esc('Shown ' + c.note)}"` : ''}><input type="checkbox" data-vs="${esc(path.join('/'))}" data-key="${esc(c.key)}"${on ? ' checked' : ''}${last ? ' disabled title="At least one stays on"' : ''}> ${esc(c.label)}</label>`;
    })
    .join('')}</fieldset>`;
};
const viewBar = (id, hint, groups) =>
  `<div class="viewbar" role="group" aria-label="View settings"><p class="muted">${esc(hint)}</p>${groups.join('')}<div class="row"><button class="btn" type="button" data-vsreset="${esc(id)}">Back to the standard view</button></div></div>`;
// A click on a check box of a bar: the column goes on or off. colsOf(path) gives the columns of that table. Returns true when it was one of ours.
async function viewToggle(cb, colsOf) {
  if (!cb || !cb.dataset || cb.dataset.vs === undefined) return false;
  const path = cb.dataset.vs.split('/'),
    cols = colsOf(cb.dataset.vs);
  if (!cols) return false;
  const next = ViewSet.set(viewSaved(path), cols, cb.dataset.key, !!cb.checked);
  state.settings = await api.setSettings({ viewSettings: ViewSet.put(state.settings.viewSettings, path, next) });
  return true;
}
async function viewReset(paths) {
  let all = state.settings.viewSettings;
  paths.forEach(p => {
    all = ViewSet.put(all, p, {});
  });
  state.settings = await api.setSettings({ viewSettings: all });
}
// after the page was drawn again: the check box that was used gets the focus back, so the keyboard keeps its place
function viewFocus(box, cb) {
  if (!cb || !cb.dataset || typeof box.querySelectorAll !== 'function') return;
  const all = box.querySelectorAll('[data-vs]'),
    hit = Array.from(all || []).find(x => x.dataset && x.dataset.vs === cb.dataset.vs && x.dataset.key === cb.dataset.key);
  if (hit && typeof hit.focus === 'function') hit.focus();
}
const folderWire = (box, after) =>
  typeof box.querySelectorAll === 'function' &&
  box.querySelectorAll('details.dbfolder').forEach(el => {
    el.ontoggle = () => {
      if (el.open) folderClosed.delete(el.dataset.folder);
      else folderClosed.add(el.dataset.folder);
      if (after) after(el);
    };
  });
const folderAll = (page, ids, open) =>
  ids.forEach(id => {
    if (open) folderClosed.delete(folderKey(page, id));
    else folderClosed.add(folderKey(page, id));
  });
// The Export to PDF button: it fills with the accent colour and has a picture of a page, so it is the first thing the eye finds (Results and Records, Racing Rules)
const pdfButton = attrs =>
  `<button class="btn primary pdfbtn" type="button" ${attrs}>${Icons.svg('pdf', { size: 18 })}<span>Export to PDF</span></button>`;
// (2.3.0) sharing the results of a session: a web page (a club website), a CSV file (a spreadsheet), a text to paste in a chat (WhatsApp)
const shareButtons = id =>
  `<span class="sharebtns" role="group" aria-label="Share the results"><button class="btn" type="button" data-share="html" data-sid="${esc(id)}" title="A page for a club website, readable on a phone">Save as web page</button><button class="btn" type="button" data-share="csv" data-sid="${esc(id)}" title="The results table for a spreadsheet (Excel, Google Sheets)">Save as CSV</button><button class="btn" type="button" data-share="text" data-sid="${esc(id)}" title="The podium, the laps and the fastest lap as a short text, to paste in a chat such as WhatsApp">Copy as text</button></span>`;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
