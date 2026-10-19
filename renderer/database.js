// Lists, add, edit, delete and extra fields for any kind of item. Everything is driven by schema.js,
// so the Database tab and the Race Setup tab share this code.
const SUBS = [['tracks', 'Tracks'], ['drivers', 'Drivers'], ['teams', 'Teams'], ['slotcars', 'Slotcars'], ['results', 'Results and Records']];
const XTYPES = { text: 'Text', number: 'Number', date: 'Date', list: 'Pick-list' };
const dlg = document.getElementById('dlg');
const byId = id => document.getElementById(id);
let manager = null; // the list currently on screen: { box, e }
let subRun = 0; // numbers the drawings of the lists and of the results: an answer that comes in late never paints over the page that was asked for after it

// All countries, named by the system's own region data; flags come from the flag-icons package.
// Codes that are obsolete duplicates or not countries are left out of the picker.
const NOT_COUNTRIES = new Set('AC AN BU CP CS DD DG EA EU EZ FX IC QO SU TA TP UN XA XB YD YU ZR ZZ'.split(' '));
const COUNTRIES = (() => {
  const dn = new Intl.DisplayNames(['en'], { type: 'region' });
  const out = [];
  for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
    const c = String.fromCharCode(a, b);
    try { const n = dn.of(c); if (n && n !== c && !NOT_COUNTRIES.has(c)) out.push([c, n]); } catch { /* not a region */ }
  }
  return out.sort((x, y) => x[1].localeCompare(y[1]));
})();
const countryName = c => (COUNTRIES.find(x => x[0] === c) || [, c])[1];
const flagHtml = c => c ? `<span class="fi fi-${esc(c.toLowerCase())}"></span>` : '';

dlg.onclose = () => { dlg.oninput = null; dlg.oncancel = null; if (manager && document.body.contains(manager.box)) mountManager(manager.box, manager.e); };

async function renderDatabase(target = view) {
  target.innerHTML = '<h2>Database</h2><div class="sub" id="subtabs" role="tablist" style="display:flex;gap:4px"></div><div id="subview"></div>';
  await drawSub();
}

async function drawSub() {
  renderTabs(byId('subtabs'), SUBS, state.sub, id => { state.sub = id; drawSub(); });
  const box = byId('subview');
  box.onclick = null; box.onchange = null; // (the page that was here before left its click handlers on this element; Results and Records draws in a box inside it and would get them too)
  if (state.sub === 'results') {
    manager = null;
    await renderResults(box);
    return;
  }
  await mountManager(box, state.sub);
}

// 1.27.0: the distance unit (App Settings, General, Display). A field with a unit in the schema is typed in feet or inches when the unit is feet and miles; what is kept stays in metres or millimetres.
const dUnit = () => Speed.distUnitOf(state.settings);
const fl = f => (f.labelFt && dUnit() === 'ft' ? f.labelFt : f.label), fh = f => (f.hintFt && dUnit() === 'ft' ? f.hintFt : f.hint);
// the text of the value of a field with a unit as it is shown and typed in feet or inches; null when the field is shown as it is kept
function typedText(f, v) {
  if (!f.unit || dUnit() !== 'ft') return null;
  const one = x => (f.unit === 'mm' ? Speed.smallTyped(x, 'ft') : Speed.lengthTyped(x, 'ft'));
  if (f.type === 'numberlist') return String(v ?? '').split(',').map(x => x.trim()).map(x => (x !== '' && Number.isFinite(Number(x)) ? String(one(x)) : x)).join(', ');
  if (f.type === 'tracklength' || f.type === 'number') { const p = f.type === 'tracklength' ? Speed.parseLength(v) : v; return p === '' || p === undefined || p === null ? '' : String(one(p)); }
  return null;
}
// the attributes that let the form give back exactly what was kept when the text was not touched (feet are rounded, so the metres would drift at every save)
const unitAttrs = (f, v) => { const t = typedText(f, v); return t === null ? '' : ` data-du="ft" data-shown="${esc(t)}" data-keep="${esc(f.type === 'tracklength' ? Speed.parseLength(v) : v ?? '')}"`; };
// the value to keep for a field that was typed in feet or inches: the text that was not changed gives back what was saved, the rest is converted (a lane length one at a time)
function keptValue(f, el) {
  const txt = String(el.value).trim(), shown = String(el.dataset.shown ?? '').trim(), keep = el.dataset.keep ?? '';
  if (f.type === 'numberlist') {
    if (txt === shown) return String(keep);
    const was = shown.split(',').map(x => x.trim()), kept = String(keep).split(',').map(x => x.trim());
    return ListNum.tidy(txt).split(',').map((x, i) => { x = x.trim(); if (x === '' || !Number.isFinite(Number(x))) return x; return x === was[i] && kept[i] !== undefined && kept[i] !== '' ? kept[i] : String(Speed.lengthKept(x, 'ft')); }).join(', ');
  }
  if (txt === '') return '';
  if (txt === shown) return Number(keep);
  return f.unit === 'mm' ? Speed.smallKept(txt, 'ft') : Speed.lengthKept(txt, 'ft');
}

const plainDate = iso => { const d = iso ? new Date(iso) : null; return d && !isNaN(d) ? d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : ''; }; // (a day, as in the Last Serviced of a slotcar)
function cell(f, v) {
  if (f.blank && (v === undefined || v === null || v === '')) return `<span class="muted">${esc(f.blank)}</span>`;
  if (v === undefined || v === null || v === '') return '';
  if (f.type === 'image') return `<img class="thumb" src="${esc(v)}" alt="">`;
  if (f.type === 'tracklength') return typeof v === 'number' ? esc(Speed.lengthText(v, dUnit())) : Speed.parseLength(v) === '' ? `${esc(v)} m` : esc(v);
  { const t = typedText(f, v); if (t !== null) return esc(t); }
  if (f.type === 'gallery') return Array.isArray(v) && v.length ? `${v.length} more` : '';
  if (f.type === 'country') return flagHtml(v) + ' ' + esc(countryName(v));
  if (f.type === 'longtext') return esc(String(v).slice(0, 60));
  if (f.type === 'datetime') return esc(plainDate(v));
  if (f.type === 'select') return esc((f.options.find(o => o[0] === v) || [, v])[1]);
  if (f.type === 'ref') { const r = (state.refs[f.ref] || []).find(x => x.id === v); return r ? esc(titleOf(f.ref, r)) : '<span class="muted">(deleted)</span>'; }
  if (f.type === 'members') return Array.isArray(v) && v.length ? v.map(id => { const r = (state.refs[f.ref] || []).find(x => x.id === id); return r ? esc(titleOf(f.ref, r)) : '<span class="muted">(deleted)</span>'; }).join(', ') : '';
  return esc(v);
}

// ---- picture framing (used by the item forms here and by the Avatar widget's settings in the layout editor) ----
const frameInner = (src, frame, aspect, round) => {
  const f = Widgets.frameOf(frame);
  return `<div class="framebox${round ? ' round' : ''}" style="aspect-ratio:${aspect}">${src ? `<img src="${esc(src)}" alt="" style="transform:${Widgets.frameTransform(f)}">` : '<span class="muted">Pick a picture to adjust it</span>'}</div>
    <label class="inline">Zoom <input class="framezoom" type="range" min="1" max="4" step="0.05" value="${f.zoom}" aria-label="Zoom"></label>
    <button type="button" class="btn framereset">Reset</button><span class="muted"> Drag the picture to move it.</span>`;
};
// Wires every .frame inside root. get(key) / set(key, frame) read and store the frame; the preview picture follows live.
function attachFrames(root, get, set) {
  root.querySelectorAll('.frame').forEach(box => {
    const key = box.dataset && box.dataset.frame; if (!key) return;
    const pic = box.querySelector('.framebox'), img = box.querySelector('.framebox img'), zoom = box.querySelector('.framezoom'), reset = box.querySelector('.framereset');
    const show = f => { if (img) img.style.transform = Widgets.frameTransform(f); if (zoom) zoom.value = f.zoom; };
    if (zoom) zoom.oninput = () => { const f = Widgets.zoomFrame(get(key), Number(zoom.value)); set(key, f); show(f); };
    if (reset) reset.onclick = () => { const f = Widgets.frameOf(null); set(key, f); show(f); };
    if (pic) pic.onpointerdown = ev => {
      const r = pic.getBoundingClientRect(); if (!r.width || !r.height) return;
      let lx = ev.clientX, ly = ev.clientY;
      const move = m => { const f = Widgets.panFrame(get(key), (m.clientX - lx) / r.width, (m.clientY - ly) / r.height); lx = m.clientX; ly = m.clientY; set(key, f); show(f); };
      const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
      ev.preventDefault();
    };
  });
}

// What a list/card column shows: a schema field, or a worked-out one written '@name'.
const limitText = i => {
  const laps = n => `${n} ${Number(n) === 1 ? 'lap' : 'laps'}`, mins = n => `${n} min`, dist = () => (i.distance === '' || i.distance === undefined ? '' : Distance.text(Number(i.distance), Speed.distUnitOf(state.settings))); // (1.35.0: a distance, in metres or feet)
  switch (i.sessionType) {
    case 'race': return i.raceBy === 'distance' ? dist() : i.laps === '' || i.laps === undefined ? '' : laps(i.laps);
    case 'timed': case 'qualifying': return i.duration === '' || i.duration === undefined ? '' : mins(i.duration);
    case 'heats': return i.heatBy === 'time' ? `${mins(i.duration)} per heat` : i.heatBy === 'distance' ? `${dist()} per heat` : `${laps(i.laps)} per heat`;
    case 'endurance': return i.enduranceBy === 'heats' ? (i.heatBy === 'time' ? `${mins(i.duration)} per heat` : i.heatBy === 'distance' ? `${dist()} per heat` : `${laps(i.laps)} per heat`) : i.enduranceBy === 'laps' ? (i.laps === '' || i.laps === undefined ? '' : laps(i.laps)) : i.enduranceBy === 'distance' ? dist() : (i.duration === '' || i.duration === undefined ? '' : mins(i.duration));
    case 'tokens': return 'Paid time per lane';
    default: return 'No limit';
  }
};
const VIEW_ENTITIES = ['tracks', 'drivers', 'teams', 'slotcars']; // the pages with View settings (and with the view card: click a row or a card)
const hue = t => { let n = 0; for (const ch of t) n = (n * 31 + ch.charCodeAt(0)) % 360; return `hsl(${n} 45% 40%)`; }; // (the colour of a picture's placeholder, from the name)
const VIRTUAL = { limit: { label: 'Laps / time', get: limitText } };
const columnOf = (s, k) => k[0] === '@' ? { key: k, label: VIRTUAL[k.slice(1)].label, virtual: VIRTUAL[k.slice(1)] } : s.fields.find(f => f.key === k);
const columnCell = (f, i) => f.virtual ? esc(f.virtual.get(i)) : cell(f, i[f.key]);

// ---- folders: the pages that list things in folders (Results and Records, Race Setups) look like the groups of the forms ----
// A folder is open unless the person closed it; that is remembered while the app runs (key: page + folder), also when the page is drawn again.
const folderClosed = new Set();
const folderKey = (page, id) => page + ':' + id;
const folderHtml = (page, id, title, note, body) => `<details class="dbfolder" data-folder="${esc(folderKey(page, id))}"${folderClosed.has(folderKey(page, id)) ? '' : ' open'}><summary><strong>${esc(title)}</strong> <span class="muted">${esc(note)}</span></summary>${body}</details>`;
const folderToolsWith = extra => `<div class="fgtools"><button class="btn" type="button" data-folderall="1">Open all</button><button class="btn" type="button" data-folderall="0">Close all</button>${extra || ''}</div>`;
const folderTools = folderToolsWith('');

// ---- View settings: which columns of a table (or which rows of a grid) are shown. The choice is kept in the settings (viewSettings), for every table and view on its own. ----
const viewBars = new Set(); // the bars that are open (kept while the app runs, also when the page is drawn again)
const viewButton = id => `<button class="btn vsbtn${viewBars.has(id) ? ' on' : ''}" type="button" data-viewbar="${esc(id)}" aria-expanded="${viewBars.has(id)}" title="Choose which information is shown">View settings</button>`;
const viewSaved = path => ViewSet.get(state.settings.viewSettings, path);
// one group of check boxes: where the choice is kept (path) and the columns [{ key, label, on, note }]
const viewGroup = (title, path, cols) => {
  const shown = ViewSet.keys(cols, viewSaved(path));
  return `<fieldset class="vsgroup"><legend>${esc(title)}</legend>${cols.map(c => {
    const on = shown.includes(c.key), last = on && shown.length === 1;
    return `<label class="vschip"${c.note ? ` title="${esc('Shown ' + c.note)}"` : ''}><input type="checkbox" data-vs="${esc(path.join('/'))}" data-key="${esc(c.key)}"${on ? ' checked' : ''}${last ? ' disabled title="At least one stays on"' : ''}> ${esc(c.label)}</label>`;
  }).join('')}</fieldset>`;
};
const viewBar = (id, hint, groups) => `<div class="viewbar" role="group" aria-label="View settings"><p class="muted">${esc(hint)}</p>${groups.join('')}<div class="row"><button class="btn" type="button" data-vsreset="${esc(id)}">Back to the standard view</button></div></div>`;
// A click on a check box of a bar: the column goes on or off. colsOf(path) gives the columns of that table. Returns true when it was one of ours.
async function viewToggle(cb, colsOf) {
  if (!cb || !cb.dataset || cb.dataset.vs === undefined) return false;
  const path = cb.dataset.vs.split('/'), cols = colsOf(cb.dataset.vs); if (!cols) return false;
  const next = ViewSet.set(viewSaved(path), cols, cb.dataset.key, !!cb.checked);
  state.settings = await api.setSettings({ viewSettings: ViewSet.put(state.settings.viewSettings, path, next) });
  return true;
}
async function viewReset(paths) {
  let all = state.settings.viewSettings;
  paths.forEach(p => { all = ViewSet.put(all, p, {}); });
  state.settings = await api.setSettings({ viewSettings: all });
}
// after the page was drawn again: the check box that was used gets the focus back, so the keyboard keeps its place
function viewFocus(box, cb) {
  if (!cb || !cb.dataset || typeof box.querySelectorAll !== 'function') return;
  const all = box.querySelectorAll('[data-vs]'), hit = Array.from(all || []).find(x => x.dataset && x.dataset.vs === cb.dataset.vs && x.dataset.key === cb.dataset.key);
  if (hit && typeof hit.focus === 'function') hit.focus();
}
const folderWire = (box, after) => typeof box.querySelectorAll === 'function' && box.querySelectorAll('details.dbfolder').forEach(el => { el.ontoggle = () => { if (el.open) folderClosed.delete(el.dataset.folder); else folderClosed.add(el.dataset.folder); if (after) after(el); }; });
const folderAll = (page, ids, open) => ids.forEach(id => { if (open) folderClosed.delete(folderKey(page, id)); else folderClosed.add(folderKey(page, id)); });
// The Export to PDF button: it fills with the accent colour and has a picture of a page, so it is the first thing the eye finds (Results and Records, Racing Rules)
const pdfButton = attrs => `<button class="btn primary pdfbtn" type="button" ${attrs}>${Icons.svg('pdf', { size: 18 })}<span>Export to PDF</span></button>`;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

async function mountManager(box, e) {
  const run = ++subRun;
  manager = { box, e };
  const s = state.schema[e];
  const [items, custom] = await Promise.all([api.list(e), s.extra === false ? [] : api.customFields(e)]);
  if (run !== subRun) return;
  state.custom[e] = custom;
  for (const f of s.fields) if (f.type === 'ref' || f.type === 'members') state.refs[f.ref] = await api.list(f.ref);
  if (run !== subRun) return;
  const cols = s.list
    ? s.list.map(k => columnOf(s, k)).map(f => ({ label: fl(f), get: i => columnCell(f, i) }))
    : [
      ...s.fields.map(f => ({ label: fl(f), get: i => cell(f, i[f.key]) })),
      ...custom.map(f => ({ label: f.label, get: i => esc((i.custom || {})[f.id] ?? '') }))
    ];
  const viewKey = e === 'racesetups' ? 'setupView' : 'dbView'; // Race Setups remembers its own list / grid choice
  const mode = s.card ? (state.settings[viewKey] || 'list') : 'list';
  // View settings (Tracks, Drivers, Slotcars): the columns of the list and the rows of the cards can be turned on and off. The list starts with every field, a card with the fields of the schema's card.
  const viewable = VIEW_ENTITIES.includes(e) && !!s.card && !s.list, cardKeys = s.card || [];
  const canView = VIEW_ENTITIES.includes(e); // a row or a card can be clicked to see everything of it (the view card)
  const customCand = f => ({ key: 'custom:' + f.id, label: f.label, custom: f });
  const listCands = !viewable ? null : [...s.fields.map(f => ({ key: f.key, label: fl(f), on: true, field: f })), ...custom.map(f => ({ ...customCand(f), on: true }))];
  const gridCands = !viewable ? null : [...cardKeys.map(k => s.fields.find(f => f.key === k)).filter(Boolean).map(f => ({ key: f.key, label: fl(f), on: true, field: f })),
    ...s.fields.filter(f => !['image', 'gallery'].includes(f.type) && !(s.title || []).includes(f.key) && !cardKeys.includes(f.key)).map(f => ({ key: f.key, label: fl(f), on: false, field: f })),
    ...custom.map(f => ({ ...customCand(f), on: false }))];
  const modeCands = mode === 'grid' ? gridCands : listCands, shownKeys = viewable ? ViewSet.keys(modeCands, viewSaved([e, mode])) : [];
  const candValue = (c, i) => (c.field ? i[c.field.key] : (i.custom || {})[c.custom.id]);
  const candHtml = (c, v) => (c.field ? cell(c.field, v) : esc(v ?? ''));
  const viewCols = !viewable || mode === 'grid' ? null : listCands.filter(c => shownKeys.includes(c.key)).map(c => ({ label: c.label, get: i => candHtml(c, candValue(c, i)) }));
  const viewId = 'mgr:' + e;
  const viewBtn = viewable ? viewButton(viewId) : '';
  const bar = !viewable || !viewBars.has(viewId) ? '' : viewBar(viewId, mode === 'grid' ? 'Turn rows of information on or off for the cards. This is remembered for the Grid view of this page.' : 'Turn columns of information on or off for the list. This is remembered for the List view of this page.',
    [viewGroup(mode === 'grid' ? `Rows on the ${s.label.toLowerCase()} cards` : `Columns in the ${s.label.toLowerCase()} list`, [e, mode], modeCands)]);
  const toggle = !s.card ? '' : `<span class="seg" role="group" aria-label="View"><button class="btn${mode === 'list' ? ' on' : ''}" id="vlist" aria-pressed="${mode === 'list'}">List</button><button class="btn${mode === 'grid' ? ' on' : ''}" id="vgrid" aria-pressed="${mode === 'grid'}">Grid</button></span>`;
  const gridHtml = (items, skip) => `<div class="cards">${items.map(i => {
    // the picture: the item's own, or (race setups) the picture of the track it uses; each with its own framing
    let img = s.image && i[s.image], frame = s.image && i[s.image + 'Frame'];
    if (s.imageFrom) {
      const rf = s.fields.find(x => x.key === s.imageFrom), tr = (state.refs[rf.ref] || []).find(x => x.id === i[rf.key]), re = state.schema[rf.ref];
      img = tr && re.image && tr[re.image]; frame = tr && re.image && tr[re.image + 'Frame'];
    }
    const t = titleOf(e, i);
    const details = (viewable ? gridCands.filter(c => shownKeys.includes(c.key)).map(c => {
      const v = candValue(c, i);
      return v === undefined || v === null || v === '' ? '' : `<div class="gd"><span class="muted">${esc(c.label)}</span> ${candHtml(c, v)}</div>`;
    }) : s.card.filter(k => k !== skip).map(k => {
      const f = columnOf(s, k), v = f.virtual ? f.virtual.get(i) : i[k];
      return v === undefined || v === null || v === '' ? '' : `<div class="gd"><span class="muted">${esc(fl(f))}</span> ${columnCell(f, i)}</div>`;
    })).join('') + (s.gallery && Array.isArray(i[s.gallery]) && i[s.gallery].length ? `<div class="gd muted">+${i[s.gallery].length} more ${i[s.gallery].length === 1 ? 'picture' : 'pictures'}</div>` : '');
    return `<article class="gcard${canView ? ' clickable' : ''}"${canView ? ` data-view="${esc(i.id)}" tabindex="0" aria-label="View ${esc(t)}"` : ''}><div class="gimg">${img ? `<img src="${esc(img)}" alt="" style="transform:${Widgets.frameTransform(frame)}">` : `<span class="ph" style="background:${hue(t)}">${esc((t.trim()[0] || '?').toUpperCase())}</span>`}</div>
      <h3>${esc(t)}</h3>${rowMark(e, i)}${details}<div class="row"><button class="btn" data-edit="${esc(i.id)}">Edit</button><button class="btn danger" data-del="${esc(i.id)}">Delete</button></div></article>`;
  }).join('')}</div>`;
  const tableHtml = (items, cols) => `<div class="wrap"><table class="fields"><tr>${cols.map(c => `<th>${esc(c.label)}</th>`).join('')}<th></th></tr>` +
    items.map(i => `<tr${canView ? ` class="clickable" data-view="${esc(i.id)}" tabindex="0" aria-label="View ${esc(titleOf(e, i))}"` : ''}>${cols.map((c, n) => `<td>${c.get(i)}${n === 0 ? rowMark(e, i) : ''}</td>`).join('')}<td class="actions">
      <button class="btn" data-edit="${esc(i.id)}">Edit</button> <button class="btn danger" data-del="${esc(i.id)}">Delete</button></td></tr>`).join('') + '</table></div>';
  // Race setups: one folder for each session type, with the setups of that type (a type without setups has no folder; a setup of a type that is not in the list goes in Other, so none is lost).
  // The session type is the folder, so it is not repeated in the list or on the cards.
  const folders = e !== 'racesetups' || !items.length ? null : (() => {
    const types = s.fields.find(f => f.key === 'sessionType').options.map(([id, label]) => ({ id, label, list: items.filter(i => i.sessionType === id) }));
    const other = items.filter(i => !types.some(t => t.id === i.sessionType));
    return [...types, { id: '_other', label: 'Other', list: other }].filter(t => t.list.length);
  })();
  const folderCols = !folders ? null : (s.list || []).filter(k => k !== 'sessionType').map(k => columnOf(s, k)).map(f => ({ label: fl(f), get: i => columnCell(f, i) }));
  box.innerHTML = `<div class="row"><button class="btn primary" id="add">Add ${esc(s.label.toLowerCase())}</button>
      ${s.extra === false ? '' : '<button class="btn" id="extra">Extra fields…</button>'}${viewBtn}${toggle}</div>${bar}` +
    (folders ? (folders.length > 1 ? folderTools : '') + folders.map(t => folderHtml('setups', t.id, t.label, plural(t.list.length, 'race setup', 'race setups'), mode === 'grid' ? gridHtml(t.list, 'sessionType') : tableHtml(t.list, folderCols))).join('')
      : items.length && mode === 'grid' ? gridHtml(items)
      : items.length ? tableHtml(items, viewCols || cols)
      : `<p class="muted">No ${esc(s.plural.toLowerCase())} yet. Use the button above to add one.</p>`);
  if (folders) folderWire(box);
  box.onchange = !viewable ? null : async ev => { // a check box of the View settings bar
    const cb = ev.target;
    if (await viewToggle(cb, path => (path === e + '/' + mode ? modeCands : null))) { await mountManager(box, e); viewFocus(box, cb); }
  };
  box.onkeydown = !canView ? null : ev => { // Enter or Space on a focused row or card opens it
    const v = ev.target && ev.target.dataset && ev.target.dataset.view;
    if (v && (ev.key === 'Enter' || ev.key === ' ') && items.some(i => i.id === v)) { ev.preventDefault(); openView(e, items.find(i => i.id === v)); }
  };
  box.onclick = async ev => {
    const b = ev.target.closest('button');
    if (!b) { // not on a button: a click on a row or a card shows it
      const v = canView && ev.target.closest('[data-view]'), it = v && items.find(i => i.id === v.dataset.view);
      if (it) openView(e, it);
      return;
    }
    if (b.dataset.folderall) { folderAll('setups', folders.map(t => t.id), b.dataset.folderall === '1'); return mountManager(box, e); }
    if (b.dataset.viewbar) { if (viewBars.has(b.dataset.viewbar)) viewBars.delete(b.dataset.viewbar); else viewBars.add(b.dataset.viewbar); return mountManager(box, e); }
    if (b.dataset.vsreset) { await viewReset([[e, mode]]); return mountManager(box, e); }
    if (b.id === 'add') return openForm(e, null);
    if (b.id === 'extra') return openExtra(e);
    if (b.id === 'vgrid' || b.id === 'vlist') { state.settings = await api.setSettings({ [viewKey]: b.id === 'vgrid' ? 'grid' : 'list' }); return mountManager(box, e); }
    const it = items.find(i => i.id === (b.dataset.edit || b.dataset.del));
    if (b.dataset.edit) openForm(e, it);
    else if (b.dataset.del) {
      const n = s.linked === false ? 0 : await api.linkedLaps(e, it.id);
      const extra = s.linked === false ? '' : `\n\nThis also deletes ${n} saved ${n === 1 ? 'lap' : 'laps'} and the records they hold${e === 'drivers' || e === 'slotcars' ? ', and takes them out of the results of past races' : ''}.`;
      if (!confirm(`Delete "${titleOf(e, it)}"?${extra}\n\nThis can't be undone.`)) return;
      await api.remove(e, it.id);
      mountManager(box, e);
    }
  };
  if (e === 'slotcars' && state.focusCar) { const it = items.find(i => i.id === state.focusCar); state.focusCar = null; if (it) openView(e, it); } // (a car clicked on Home, in the Service Due card: its card opens)
}

// special penalties of a penalty system: one row each (Drivethrough, Stop-and-Go...)
const PT_DEFAULTS = [{ name: 'Drivethrough', kind: 'drivethrough', seconds: 0, cost: 5, extra: 1, unserved: 10 },
  { name: 'Stop-and-Go 5 s', kind: 'stopgo', seconds: 5, cost: 5, extra: 1, unserved: 10 }, { name: 'Stop-and-Go 10 s', kind: 'stopgo', seconds: 10, cost: 10, extra: 1, unserved: 15 }];
const ptRows = types => types.length ? `<div class="ptrow pthead muted"><span>Name</span><span>Kind</span><span>Stand still (s)</span><span>Costs (points)</span><span>Leaving early adds (points)</span><span>Never served adds (s)</span><span></span></div>` +
  types.map((t, i) => `<div class="ptrow"><input type="text" data-pt="${i}" data-ptk="name" value="${esc(t.name)}" aria-label="Name" maxlength="40">
  <select data-pt="${i}" data-ptk="kind" aria-label="Kind"><option value="drivethrough"${t.kind === 'drivethrough' ? ' selected' : ''}>Drivethrough</option><option value="stopgo"${t.kind === 'stopgo' ? ' selected' : ''}>Stop-and-Go</option></select>
  <input type="number" min="0" step="any" data-pt="${i}" data-ptk="seconds" value="${esc(t.seconds)}" aria-label="Seconds to stand still (Stop-and-Go)" title="Stop-and-Go: how long the car must stand on the sensor. A Drivethrough is served by the pit stop starting (the pit hold time of the race setup).">
  <input type="number" min="0" step="1" data-pt="${i}" data-ptk="cost" value="${esc(t.cost)}" aria-label="Points it costs"><input type="number" min="0" step="1" data-pt="${i}" data-ptk="extra" value="${esc(t.extra)}" aria-label="Points added for leaving early">
  <input type="number" min="0" step="any" data-pt="${i}" data-ptk="unserved" value="${esc(t.unserved)}" aria-label="Seconds added if never served"><button type="button" class="btn" data-ptdel="${i}">Remove</button></div>`).join('')
  : '<p class="muted">No special penalties yet.</p>';
// the levels of a damage system: one row each (a name, from how many damage points, how long to stand still, how urgent, the deadline in laps, what the stop does)
const dlRows = levels => levels.length ? `<div class="ptrow dlrow pthead muted"><span>Name</span><span>From (damage points)</span><span>Stand still (s)</span><span>Pit</span><span>Within (laps, 0 = no deadline)</span><span>The stop</span><span></span></div>` +
  levels.map((l, i) => `<div class="ptrow dlrow"><input type="text" data-dl="${i}" data-dlk="name" value="${esc(l.name)}" aria-label="Name" maxlength="40">
  <input type="number" min="1" step="1" data-dl="${i}" data-dlk="from" value="${esc(l.from)}" aria-label="From how many damage points">
  <input type="number" min="0" step="any" data-dl="${i}" data-dlk="seconds" value="${esc(l.seconds)}" aria-label="Seconds to stand still on the sensor" title="How long the car must stand on the sensor in the pits. For a car that is retired or disqualified: how long before that happens (0 = as soon as the pit stop starts).">
  <select data-dl="${i}" data-dlk="urgency" aria-label="Pit whenever you can, or as fast as you can"><option value="whenever"${l.urgency !== 'asap' ? ' selected' : ''}>Whenever you can</option><option value="asap"${l.urgency === 'asap' ? ' selected' : ''}>As fast as you can</option></select>
  <input type="number" min="0" step="1" data-dl="${i}" data-dlk="within" value="${esc(l.within)}" aria-label="Laps within which the car must be in the pits" title="After this many laps the car gets penalty points for every lap (see Penalty points below). 0 = no deadline.">
  <select data-dl="${i}" data-dlk="action" aria-label="What the stop does"><option value="repair"${l.action !== 'retire' && l.action !== 'dq' ? ' selected' : ''}>Repairs the car</option><option value="retire"${l.action === 'retire' ? ' selected' : ''}>Retires the car</option><option value="dq"${l.action === 'dq' ? ' selected' : ''}>Disqualifies the car</option></select>
  <button type="button" class="btn" data-dldel="${i}">Remove</button></div>`).join('')
  : '<p class="muted">No levels yet: damage points are counted, but no stop repairs or ends anything.</p>';
// the incidents of a damage system: a name and the damage points it gives (the buttons of the Race Director)
const diRows = incs => incs.length ? `<div class="ptrow dirow pthead muted"><span>Name</span><span>Damage points</span><span></span></div>` +
  incs.map((x, i) => `<div class="ptrow dirow"><input type="text" data-di="${i}" data-dik="name" value="${esc(x.name)}" aria-label="Name" maxlength="40">
  <input type="number" min="1" step="1" data-di="${i}" data-dik="points" value="${esc(x.points)}" aria-label="Damage points it gives"><button type="button" class="btn" data-didel="${i}">Remove</button></div>`).join('')
  : '<p class="muted">No incidents yet: the Race Director then has only the plus and minus buttons.</p>';
// the Car Failures of a damage system (1.43.0): one row each (a name, the level whose rules it borrows, the chance in percent, the seconds to stand still)
const cfRows = (list, levels) => list.length ? `<div class="ptrow cfrow pthead muted"><span>Name</span><span>Level (its rules)</span><span>Chance (%)</span><span>Stand still (s)</span><span></span></div>` +
  list.map((x, i) => {
    const names = levels.map(l => String(l.name || '').trim()).filter(Boolean), lost = String(x.level || '').trim() && !names.some(n => n.toLowerCase() === String(x.level).trim().toLowerCase());
    return `<div class="ptrow cfrow"><input type="text" data-cf="${i}" data-cfk="name" value="${esc(x.name)}" aria-label="Name" maxlength="40">
  <select data-cf="${i}" data-cfk="level" aria-label="The level whose rules the failure takes" title="The pit rules of this level (whenever you can or as fast as you can, the deadline in laps, and what the stop does: repair, retire or disqualify) are the rules of the failure."><option value="">None: pit whenever you can, no deadline, a repair</option>${names.map(n => `<option value="${esc(n)}"${String(x.level || '').trim().toLowerCase() === n.toLowerCase() ? ' selected' : ''}>${esc(n)}</option>`).join('')}${lost ? `<option value="${esc(x.level)}" selected>${esc(x.level)} (no such level)</option>` : ''}</select>
  <input type="number" min="0" max="100" step="any" data-cf="${i}" data-cfk="chance" value="${esc(x.chance)}" aria-label="Chance in percent that a car gets this failure in a race" title="The chance in percent that a car gets this failure at some point in the race (before the Failure factor of the slot car).">
  <input type="number" min="0" step="any" data-cf="${i}" data-cfk="seconds" value="${esc(x.seconds)}" aria-label="Seconds to stand still on the sensor" title="How long the car must stand on the sensor in the pits to clear the failure. For a failure that retires or disqualifies the car: how long before that happens (0 = as soon as the pit stop starts).">
  <button type="button" class="btn" data-cfdel="${i}">Remove</button></div>`; }).join('')
  : '<p class="muted">No failures yet. Add the standard failures, or make your own.</p>';
// the tyres of a tyre wear system (field type 'tyretable'): the four numbers of every tyre, what a new set lasts, and the grip curve of the tyre that is selected
const twWearLabel = unit => (unit === 'distance' ? `Wear per 100 ${dUnit() === 'ft' ? 'ft' : 'm'} (%)` : 'Wear per lap (%)');
const twHead = unit => `<div class="twrow twhead muted"><span>Tyre</span><span>${twWearLabel(unit)}</span><span>Fresh bonus (%)</span><span>Grip drops from (% life left)</span><span>Hindrance at 0% (%)</span><span>Lasts about</span></div>`;
const twRows = (tyres, unit, sel) => Wx.TYRES.map(ty => { const t = tyres[ty.code] || {}, c = ty.color;
  return `<div class="twrow${ty.code === sel ? ' sel' : ''}" data-twrow="${ty.code}"><span class="twname"><b class="twchip" style="border-color:${c};color:${c}">${esc(ty.code === 'INT' ? 'I' : ty.code)}</b> ${esc(ty.name)}
    <button type="button" class="btn small" data-twsel="${ty.code}" aria-label="Show the grip curve of the ${esc(ty.name)} tyre"${ty.code === sel ? ' disabled' : ''}>Curve</button></span>`
    + TyreWear.NUMS.map(([k, label]) => `<label class="twf"><small>${esc(k === 'wear' ? twWearLabel(unit) : label)}</small><input type="number" step="any" min="${TyreWear.LIMITS[k][0]}" max="${TyreWear.LIMITS[k][1]}" data-tw="${ty.code}" data-twk="${k}" value="${esc(t[k] ?? '')}" aria-label="${esc(ty.name)}: ${esc(label)}"></label>`).join('')
    + `<span class="twlasts" data-twlast="${ty.code}">${esc(TyreWear.lastsText(unit, dUnit(), Number(String(t.wear ?? '').replace(',', '.'))))}</span></div>`; }).join('');
const twCurve = (tyres, sel) => { const ty = Wx.tyreOf(sel) || Wx.TYRES[0], t = TyreWear.cleanTyres(tyres)[ty.code];
  return `<div class="twcurve"><div class="twsvg">${TyreWear.curveSvg(t)}</div><div class="twtext"><p><strong>${esc(ty.name)}.</strong> New tyres give the fresh bonus (${TyreWear.effectText(t.bonus)}). The bonus fades while the tyre wears.</p>
    <p><strong>At ${t.cliff}% life left</strong> the bonus is gone. Below that the tyre starts to hinder the car.</p><p><strong>At 0%</strong> the hindrance is at its worst (${TyreWear.effectText(-t.hind)}).</p>
    <p class="muted">A plus helps (less fuel used, faster refuelling), a minus hinders. Lap times are never changed.</p></div></div>`; };
const twTable = (tyres, unit, sel) => `<div class="twbtns row"><span class="muted">Start from a ready-made system (you can change every number):</span> ${TyreWear.PRESET_KEYS.map(k => `<button type="button" class="btn" data-twpreset="${k}" title="${esc(TyreWear.PRESETS[k].note)}">${esc(TyreWear.PRESETS[k].name)}</button>`).join(' ')}</div>
  <p class="muted">Standard is in between, Sprint wears the tyres quickly (short races, many stops) and Endurance wears them slowly.</p>
  <div class="twtable" id="tw-table">${twHead(unit)}${twRows(tyres, unit, sel)}</div><div id="tw-curve">${twCurve(tyres, sel)}</div>`;
// the weather table of a tyre wear system (field type 'wxmult'): how much more or less every kind of tyre wears in every weather
const twMult = mult => `<div class="twtable twmult"><div class="twrow twhead muted"><span>Weather</span><span>Dry tyres (Hard, Medium, Soft, Supersoft)</span><span>Intermediate</span><span>Wet</span></div>`
  + Wx.STATES.map(([st, name]) => `<div class="twrow"><span class="twname"><strong>${esc(name)}</strong></span>` + Wx.CLASSES.map(c => `<label class="twx"><small>${c === 'dry' ? 'Dry tyres' : c === 'inter' ? 'Intermediate' : 'Wet'}</small><input type="number" step="any" min="0" max="20" data-twm="${st}" data-twmc="${c}" value="${esc(mult[st] && mult[st][c] !== undefined ? mult[st][c] : '')}" aria-label="${esc(name)} weather, ${c === 'dry' ? 'dry' : c === 'inter' ? 'Intermediate' : 'Wet'} tyres: times the wear"><span>&times;</span></label>`).join('') + '</div>').join('') + '</div>'
  + `  <p class="muted">The numbers multiply the wear above: 1.0 is normal, 0.5 is half the wear, 3.0 is three times. Intermediate and Wet tyres wear slower in the rain and slicks wear faster on a wet track. Only used in a race with a Weather System.</p>`;
// the sets of a tyre wear system (field type 'tyresets'): how many sets of every tyre a car, or a team, has (1.41.0)
const twSets = sets => `<div class="twtable twsets" id="tw-sets">` + TyreWear.CODES.map(code => { const ty = Wx.tyreOf(code), c = ty.color;
  return `<label class="twx twsetx"><small><b class="twchip" style="border-color:${c};color:${c}">${esc(code === 'INT' ? 'I' : code)}</b> ${esc(ty.name)}</small><input type="number" step="1" min="0" max="99" data-tws="${code}" value="${esc(sets && sets[code] !== undefined ? sets[code] : '')}" aria-label="Sets of ${esc(ty.name)} tyres"></label>`; }).join('')
  + `</div>`;
const calcRows = pieces => pieces.map((p, i) => `<div class="calcrow"><input type="number" min="0" step="1" class="calc-count" data-i="${i}" value="${esc(p.count)}" aria-label="Number of pieces"> &times;
  <input type="number" min="0" step="any" class="calc-mm" data-i="${i}" value="${esc(Speed.smallTyped(p.mm, dUnit()))}" aria-label="Length of one piece in ${dUnit() === 'ft' ? 'inches' : 'millimetres'}"> ${dUnit() === 'ft' ? 'in' : 'mm'} <button type="button" class="btn" data-calcdel="${i}">Remove</button></div>`).join('');
const calcHtml = pieces => `<p class="muted">Number of pieces &times; length of one piece. Add a row for every kind of piece.</p><div id="calc-rows">${calcRows(pieces)}</div>
  <div class="row"><button type="button" class="btn" data-calcadd="1">Add another piece type</button> <strong id="calc-total">${Speed.lengthText(Speed.lengthFromPieces(pieces), dUnit())}</strong>
  <button type="button" class="btn primary" data-calcuse="1">Use this length</button></div>`;

// the drivers of a team (field type 'members'): in the order they take their turn, with a list to add one more from
const memRows = (ids, all) => `<ol class="memlist">${ids.length ? ids.map((id, i) => { const d = all.find(x => x.id === id);
  return `<li><span class="memname">${esc(d ? titleOf('drivers', d) : '(deleted)')}</span> <button type="button" class="btn" data-memup="${i}" aria-label="Move up"${i ? '' : ' disabled'}>&uarr;</button><button type="button" class="btn" data-memdown="${i}" aria-label="Move down"${i < ids.length - 1 ? '' : ' disabled'}>&darr;</button><button type="button" class="btn danger" data-memdel="${i}">Remove</button></li>`; }).join('') : '<li class="muted">No drivers in this team yet.</li>'}</ol>
  <div class="row"><select id="mem-pick" aria-label="Driver to add"><option value="">${all.some(d => !ids.includes(d.id)) ? 'Choose a driver…' : 'Every driver is in the team'}</option>${all.filter(d => !ids.includes(d.id)).map(d => `<option value="${esc(d.id)}">${esc(titleOf('drivers', d))}</option>`).join('')}</select> <button type="button" class="btn" data-memadd="1">Add to the team</button></div>`;

function fieldHtml(f, v, extra) {
  const id = 'f-' + f.id;
  const lab = `<label for="${id}">${esc(fl(f))}${f.optional ? ' <span class="muted">(optional)</span>' : ''}</label>`;
  let inp;
  switch (f.type) {
    case 'longtext': inp = `<textarea id="${id}" rows="3">${esc(v)}</textarea>`; break;
    case 'number': inp = `<input id="${id}" type="number" step="${f.step || 'any'}"${f.min !== undefined ? ` min="${f.min}"` : ''} value="${esc(typedText(f, v) ?? v)}"${unitAttrs(f, v)}>`; break;
    case 'date': inp = `<input id="${id}" type="date" value="${esc(v)}">`; break;
    case 'choice': inp = `<input id="${id}" list="${id}-l" value="${esc(v)}"><datalist id="${id}-l">${f.options.map(o => `<option value="${esc(o)}">`).join('')}</datalist>`; break;
    case 'list': inp = `<select id="${id}"><option value=""></option>${f.options.map(o => `<option${o === v ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`; break;
    case 'select': inp = `<select id="${id}">${f.options.map(([k, l]) => `<option value="${esc(k)}"${k === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`; break;
    case 'ref': inp = `<select id="${id}"><option value="">${esc(f.blank || '(none)')}</option>${(state.refs[f.ref] || []).map(r => `<option value="${esc(r.id)}"${r.id === v ? ' selected' : ''}>${esc(titleOf(f.ref, r))}</option>`).join('')}</select>`; break;
    case 'country': inp = `<select id="${id}"><option value=""></option>${COUNTRIES.map(([c, n]) => `<option value="${c}"${c === v ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select><span id="${id}-flag">${flagHtml(v)}</span>`; break;
    case 'tracklength': inp = `<div class="imgrow"><input id="${id}" type="number" min="0" step="any" value="${esc(typedText(f, v) ?? Speed.parseLength(v))}"${unitAttrs(f, v)}> <span>${dUnit() === 'ft' ? 'feet' : 'metres'}</span>
      <button type="button" class="btn" data-calcopen="1">Calculate from track pieces…</button></div><div id="calc" class="card" hidden>${calcHtml((extra && extra.pieces) || [])}</div>`; break;
    case 'penaltytypes': inp = `<p class="muted">Penalties the Race Director can give instead of leaving points to turn into time. One costs points, and must be served by stopping on the sensor in the pits. A Stop-and-Go needs the car to stand still for its seconds; a Drivethrough is served when the pit stop starts.</p><div id="pt-box">${ptRows((extra && extra.types) || [])}</div><button type="button" class="btn" data-ptadd="1">Add a special penalty</button>`; break;
    case 'damagelevels': inp = `<p class="muted">The highest level a car has reached counts. A car must stand still on the sensor in the pits for the seconds of its level: that repairs the damage (the points go back to 0), or retires or disqualifies the car. Leave a gap between the levels, so a hit does not skip one.</p><div id="dl-box">${dlRows((extra && extra.dlevels) || [])}</div><button type="button" class="btn" data-dladd="1">Add a level</button>`; break;
    case 'damageincidents': inp = `<p class="muted">Buttons for the Race Director (on the race screen, the Race Director page and the phones): each gives a car these damage points. A deslot is counted by itself when the track has a deslot time.</p><div id="di-box">${diRows((extra && extra.dincs) || [])}</div><button type="button" class="btn" data-diadd="1">Add an incident</button>`; break;
    case 'carfailures': inp = `<p class="muted">Each failure has a chance (in percent) that a car gets it, at a random moment of the race. It borrows the rules of a level: pit whenever you can or as fast as you can, the deadline in laps, and what the stop does (repair, retire or disqualify the car). Stand still is the time the car must stand on the sensor in the pits to clear it. A failure adds no damage points.</p><div id="cf-box">${cfRows((extra && extra.cfails) || [], (extra && extra.dlevels) || [])}</div><button type="button" class="btn" data-cfadd="1">Add a failure</button> <button type="button" class="btn" data-cfstd="1">Add the standard failures</button>`; break; // (1.43.0)
    case 'tyretable': inp = `<div id="tw-box">${twTable((extra && extra.twt) || {}, (extra && extra.twunit) || 'lap', (extra && extra.twsel) || 'S')}</div>`; break; // (1.40.0)
    case 'wxmult': inp = `<div id="tw-mult">${twMult((extra && extra.twm) || {})}</div>`; break;
    case 'tyresets': inp = twSets((extra && extra.tws) || {}); break; // (1.41.0)
    case 'carstat': inp = `<input id="${id}" type="text" value="${esc(v ?? '')}" disabled>`; break; // (1.30.0: a figure worked out for the form, such as the Mileage of a slotcar; the screen fills it in)
    case 'cartracks': inp = `<div id="${id}" class="svc-tracks-box"></div>`; break; // (1.33.0: the table of the tracks of a slotcar; the screen fills it in)
    case 'members': inp = `<div id="mem-box">${memRows((extra && extra.members) || [], state.refs[f.ref] || [])}</div>`; break;
    case 'gallery': inp = `<div id="gal-box" class="gallery"></div><input id="${id}" type="file" accept="image/*" multiple data-gallery="1"><p class="muted">Up to ${GALLERY_MAX} extra pictures. A screenshot of a parts list is fine.</p>`; break;
    case 'image': inp = `<div class="imgrow"><img id="${id}-img" class="thumb" ${v ? `src="${esc(v)}"` : 'hidden'} alt=""><input id="${id}" type="file" accept="image/*"><button type="button" class="btn" data-clear="${f.id}">Remove</button></div>`; break;
    default: inp = `<input id="${id}" type="text"${f.maxLength ? ` maxlength="${f.maxLength}"` : ''}${f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : ''} value="${esc(typedText(f, v) ?? v)}"${unitAttrs(f, v)}>`;
  }
  if (f.automatic) { // (a number or a day that the database keeps by itself; Laps Since Last Interval has the button that starts the count again, 1.30.0)
    inp = f.type === 'datetime' ? `<input id="${id}" type="text" value="${esc(v ? plainDate(v) : 'Never')}" disabled>` : `<input id="${id}" type="number" value="${esc(v ?? 0)}" disabled>`;
    if (f.reset) inp = `<div class="imgrow">${inp}<button type="button" class="btn" data-svcreset="1">Reset</button></div>`;
  }
  const wide = ['longtext', 'gallery', 'tracklength', 'image', 'penaltytypes', 'damagelevels', 'damageincidents', 'carfailures', 'tyretable', 'wxmult', 'tyresets', 'members', 'cartracks'].includes(f.type) ? ' full' : '';
  return `<div class="field${wide}" data-key="${f.id}">${lab}${inp}${fh(f) ? `<span class="muted hint">${esc(fh(f))}</span>` : ''}${f.reset ? '<span class="muted hint svc-note" id="svc-note"></span>' : ''}</div>`;
}

// A field with showIf is shown when any one of its conditions matches the current form values.
const isShown = (f, get) => !f.showIf || f.showIf.some(c => Object.entries(c).every(([k, vs]) => vs.includes(get(k) ?? ''))); // (a setting that has no value yet is empty: a race setup from before the setting existed)

// A picture file as the address to keep in the database. How much it is shrunk depends on the picture quality setting (picture.js, App Settings > General > Pictures):
// by default it is kept as it was uploaded. `max` is the size the place was made for (used by the standard quality); `png` is not needed any more: a picture is kept in the kind it came in.
const fileAsDataUrl = file => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result)); r.onerror = () => reject(new Error('That file could not be read.'));
  r.readAsDataURL(file);
});
function resizeImage(file, max = 256, png = false) { // eslint-disable-line no-unused-vars
  return Picture.load(file, max, Picture.levelOf(state.settings && state.settings.pictureQuality), {
    url: { create: f => URL.createObjectURL(f), revoke: u => URL.revokeObjectURL(u) }, newImage: () => new Image(), read: fileAsDataUrl,
    newCanvas: (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  });
}

const GALLERY_MAX = 12;

// the groups of fields that are open in the form of each kind of item (kept while the app is open); a kind of item without groups has one flat list
const formOpen = {};

// The view card of a slotcar, a track or a driver (click its row or card): everything that is filled in, to look at, with nothing to change here.
// The main picture is on top, then the details, then (slotcars) the other pictures as small ones to click. A click on a picture shows it large; a click on that, or Escape, closes it.
function openView(e, item) {
  const s = state.schema[e];
  const getv = k => (e === 'tracks' && k === 'laneModifier' ? Speed.modifier(item) : e === 'slotcars' && k === 'servicesDone' ? CarStats.servicesOf(item) : item[k]); // (a track saved before the lane length modifier shows what it always did)
  const filled = v => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length);
  const named = (s.title || []).length === 1; // (a name is the title of the card already; brand, manufacturer and model are three facts, so they stay in the list)
  const rows = [
    ...s.fields.filter(f => !['image', 'gallery'].includes(f.type) && !(named && s.title.includes(f.key)) && isShown(f, getv) && filled(getv(f.key)))
      .map(f => ({ label: fl(f), html: f.type === 'longtext' ? esc(getv(f.key)).replace(/\n/g, '<br>') : cell(f, getv(f.key)), wide: f.type === 'longtext' })),
    ...(e === 'slotcars' ? [{ label: 'Next Service', html: `<span id="vc-service"></span>` }, ...CAR_STATS.map(f => ({ label: f.label, html: `<span id="vc${f.key}">Calculating…</span>` })), { label: CAR_TRACKS.label, html: '<div id="vc_byTrack">Calculating…</div>', wide: true }] : []), // (1.30.0 the mileage, 1.33.0 the rest: worked out from the laps when the card is open)
    ...(state.custom[e] || []).filter(f => filled((item.custom || {})[f.id])).map(f => ({ label: f.label, html: esc(item.custom[f.id]) }))
  ];
  const t = titleOf(e, item), main = s.image && item[s.image], frame = s.image && item[s.image + 'Frame'];
  const gal = s.gallery && Array.isArray(item[s.gallery]) ? item[s.gallery].filter(Boolean) : [];
  const pics = [main, ...gal].filter(Boolean); // (what a click can show large: the main picture first)
  dlg.oninput = null; dlg.onchange = null;
  dlg.innerHTML = `<div class="vcard"><button type="button" class="vcpic gimg${main ? '' : ' nopic'}"${main ? ' data-big="0" aria-label="Show the picture large"' : ' tabindex="-1" aria-hidden="true"'}>${main ? `<img src="${esc(main)}" alt="" style="transform:${Widgets.frameTransform(frame)}">` : `<span class="ph" style="background:${hue(t)}">${esc((t.trim()[0] || '?').toUpperCase())}</span>`}</button>
    <h3 class="vctitle">${esc(t)}</h3>
    ${rows.length ? `<dl class="vcfields">${rows.map(r => `<div${r.wide ? ' class="wide"' : ''}><dt>${esc(r.label)}</dt><dd>${r.html}</dd></div>`).join('')}</dl>` : '<p class="muted">Nothing more is filled in.</p>'}
    ${gal.length ? `<h4 class="vcgaltitle">${gal.length === 1 ? 'Another picture' : gal.length + ' more pictures'}</h4><div class="vcgal">${gal.map((src, i) => `<button type="button" class="vcthumb" data-big="${i + (main ? 1 : 0)}" aria-label="Show picture ${i + 1} large"><img class="galthumb" src="${esc(src)}" alt="Picture ${i + 1}"></button>`).join('')}</div>` : ''}
    <div class="row"><button class="btn" type="button" id="vcclose">Close</button><button class="btn primary" type="button" id="vcedit">Edit</button></div>
    <div class="vcbig" id="vcbig" hidden role="dialog" aria-label="Large picture"><img id="vcbigimg" alt=""><p>Click the picture or press Escape to close it</p></div></div>`;
  let large = false; // is a picture shown large at the moment? (it covers the card, so any click while it is shown is a click on it)
  const showLarge = on => { large = on; byId('vcbig').hidden = !on; };
  dlg.oncancel = ev => { if (large) { ev.preventDefault(); showLarge(false); } }; // (Escape closes the large picture first, then the card)
  dlg.onclick = ev => {
    if (large) return showLarge(false);
    const b = ev.target.closest('button'); if (!b) return;
    if (b.id === 'vcclose') return dlg.close();
    if (b.id === 'vcedit') return openForm(e, item);
    if (b.dataset && b.dataset.big !== undefined && pics[Number(b.dataset.big)]) { byId('vcbigimg').src = pics[Number(b.dataset.big)]; showLarge(true); }
  };
  if (!dlg.open) dlg.showModal();
  if (e === 'slotcars') { // the statistics of the car, as in its form
    const svc = byId('vc-service'), st = CarStats.status(item); svc.textContent = CarStats.note(st); svc.className = st.due ? 'svc-note due' : '';
    loadCarStats(item).then(d => { const t = carStatTexts(d); CAR_STATS.forEach(f => { byId('vc' + f.key).textContent = t[f.key]; }); byId('vc_byTrack').innerHTML = carTracksHtml(d); })
      .catch(() => { CAR_STATS.forEach(f => { byId('vc' + f.key).textContent = '–'; }); byId('vc_byTrack').textContent = '–'; });
  }
  byId('vcclose').focus({ preventScroll: true }); // (so the card opens at its top)
}

// The statistics of a slotcar that are worked out when the form (or the card) opens, from the laps, the sessions and the tracks of the database (1.30.0 the Mileage, 1.33.0 the others). They are not saved.
const CAR_STATS = [
  { key: '_mileage', label: 'Mileage', hint: 'The distance this car has driven, worked out as the Car Mileage card on Home does: every lap that counts, times the length of its lane. Laps on a track without a length are left out.' },
  { key: '_mileageSince', label: 'Mileage Since Last Service', hint: 'The same distance, counted from the day of the last Reset (all of it until the car is serviced for the first time).' },
  { key: '_lastDriven', label: 'Last Driven', hint: 'The day of the last lap saved with this car (Never until it has driven).' },
  { key: '_sessions', label: 'Sessions Driven', hint: 'The sessions this car has laps in: races, qualifyings and practices. Time Token Sessions are counted apart and not here.' },
  { key: '_wins', label: 'Wins', hint: 'The races this car won: first place, not retired or disqualified. A practice or a qualifying has no winner.' },
  { key: '_deslots', label: 'Deslots', hint: 'The laps slower than the deslot time of their track (Tracks, Lap time limits), laps with a pit stop left out. A track without a deslot time has none.' },
  { key: '_fastest', label: 'Fastest Lap Ever', hint: 'The fastest valid lap of this car on any track, and the track. A lap that is invalid, too slow, late or with a pit stop does not count.' }
].map(f => ({ ...f, id: f.key, group: 'stats', type: 'carstat', custom: false }));
const CAR_TRACKS = { key: '_byTrack', id: '_byTrack', group: 'stats', label: 'Best Lap per Track', type: 'cartracks', custom: false, hint: 'The valid laps of this car on each track: how many, the best lap and the average.' };
// what the statistics say, in words: [id of the field] = text; the table of the tracks; and the loader (the laps, the sessions and the tracks of the database)
const carStatTexts = d => ({ _mileage: Stats.fmtDist(d.mileage.distance, dUnit()), _mileageSince: Stats.fmtDist(d.mileageSince.distance, dUnit()), _lastDriven: d.lastDriven ? plainDate(d.lastDriven) : 'Never',
  _sessions: String(d.sessions), _wins: String(d.wins), _deslots: String(d.deslots), _fastest: d.fastest ? `${Stats.fmtMs(d.fastest.time)}${d.fastest.trackName ? ' on ' + d.fastest.trackName : ''}` : '–' });
const carTracksHtml = d => !d.tracks.length ? '<span class="muted">No valid laps yet.</span>'
  : `<table class="fields svc-tracks"><thead><tr><th>Track</th><th>Laps</th><th>Best</th><th>Average</th></tr></thead><tbody>${d.tracks.map(t => `<tr><td>${esc(t.name || '–')}</td><td>${t.laps}</td><td>${esc(Stats.fmtMs(t.best))}</td><td>${esc(Stats.fmtMs(t.avg))}</td></tr>`).join('')}</tbody></table>`;
const loadCarStats = item => Promise.all([api.list('laps'), api.list('sessions'), api.list('tracks')]).then(([laps, sessions, tracks]) => CarStats.details(item, laps, sessions, tracks));
// a mark for the list and the cards of the slotcars that need servicing
const rowMark = (e, i) => (e === 'slotcars' && CarStats.status(i).due ? '<span class="svc-due" title="The laps since the last service have reached the service interval">Service due</span>' : '');
function openForm(e, item) {
  const s = state.schema[e];
  const fields = [...s.fields.map(f => ({ ...f, id: f.key, custom: false })), ...(e === 'slotcars' ? [...CAR_STATS, CAR_TRACKS] : []), ...(state.custom[e] || []).map(f => ({ ...f, custom: true }))];
  // a track saved before the lane length modifier shows what it always did: calculated as a loop (or what version 0.60.0's track shape said)
  const val = f => f.custom ? (item?.custom || {})[f.id] : item ? (e === 'slotcars' && f.key === 'lapsSinceService' ? CarStats.sinceOf(item) : e === 'slotcars' && f.key === 'servicesDone' ? CarStats.servicesOf(item) : e === 'tracks' && f.key === 'laneModifier' ? Speed.modifier(item) : e === 'tracks' && f.key === 'netTurns' && item.netTurns === undefined ? f.default : item[f.key]) : f.default;
  const imgs = {}, frames = {}, mainKey = s.image;
  let pieces = ((item && item.lengthPieces) || []).map(p => ({ count: p.count, mm: p.mm }));
  if (!pieces.length) pieces = [{ count: '', mm: 200 }];
  let types = Array.isArray(item && item.types) ? item.types.map(t => ({ ...t })) : (item ? [] : PT_DEFAULTS.map(t => ({ ...t })));
  const dmDef = Damage.defaults(); // (a new damage system starts with the examples: light, medium, heavy and critical damage)
  let dlevels = Array.isArray(item && item.levels) ? item.levels.map(x => ({ ...x })) : (item ? [] : dmDef.levels), dincs = Array.isArray(item && item.incidents) ? item.incidents.map(x => ({ ...x })) : (item ? [] : dmDef.incidents), cfails = Array.isArray(item && item.failures) ? item.failures.map(x => ({ ...x })) : (item ? [] : dmDef.failures);
  let twt = TyreWear.cleanTyres(item && item.tyres), twm = TyreWear.cleanMult(item && item.mult), tws = TyreWear.cleanSets(item && item.sets), twsel = 'S'; // (a tyre wear system: the tyre table, the weather table and the tyre whose grip curve is shown; a new one starts as the Standard system)
  let gal = Array.isArray(item && item[s.gallery]) ? [...item[s.gallery]] : [], galSel = null;
  const memF = fields.find(f => f.type === 'members'); let members = memF && item && Array.isArray(item[memF.key]) ? item[memF.key].filter(Boolean) : []; // (the drivers of a team, in order)
  fields.filter(f => f.type === 'image').forEach(f => { imgs[f.id] = val(f) || ''; if (!f.custom) frames[f.id] = Widgets.frameOf(item && item[f.key + 'Frame']); });
  const frameBlock = f => f.type === 'image' && !f.custom ? `<div class="field frame full" id="frame-${f.id}" data-frame="${f.id}">${frameInner(imgs[f.id], frames[f.id], '4 / 3', false)}</div>` : '';
  const redrawFrame = key => { byId('frame-' + key).innerHTML = frameInner(imgs[key], frames[key], '4 / 3', false); attachFrames(dlg, k => frames[k], (k, f) => { frames[k] = f; }); };
  const one = f => fieldHtml(f, val(f), { pieces, types, members, dlevels, dincs, cfails, twt, twm, tws, twsel, twunit: (item && item.unit) || TyreWear.DEFAULTS.unit }) + frameBlock(f);
  // a schema with groups: the fields in collapsible sections with a coloured header, in the order of the groups (fields without a group of their own, such as your own fields, go last)
  const defs = Array.isArray(s.groups) && s.groups.length ? s.groups : null;
  const groups = defs ? [...defs.map(g => ({ ...g, fields: fields.filter(f => f.group === g.id) })), { id: '_more', title: 'More', note: '', fields: fields.filter(f => !defs.some(g => g.id === f.group)) }].filter(g => g.fields.length) : null;
  const opened = defs ? (formOpen[e] = formOpen[e] || new Set(defs.filter(g => g.open).map(g => g.id))) : null;
  dlg.innerHTML = `<form id="frm"><h3>${item ? 'Edit' : 'Add'} ${esc(s.label.toLowerCase())}</h3>
    ${groups ? `<div class="formgrid grouped"><div class="fgtools"><button type="button" class="btn" data-fgall="1">Open all</button><button type="button" class="btn" data-fgall="0">Close all</button></div>${groups.map(g =>
      `<details class="fgroup" data-fg="${esc(g.id)}"${opened.has(g.id) ? ' open' : ''}><summary><strong>${esc(g.title)}</strong>${g.note ? ` <span class="muted">${esc(g.note)}</span>` : ''}</summary><div class="fgrid">${g.fields.map(one).join('')}</div></details>`).join('')}</div>`
      : `<div class="formgrid">${fields.map(one).join('')}</div>`}
    <p class="error" id="err" role="alert"></p>
    <div class="row"><button class="btn primary" type="submit">Save</button><button class="btn" type="button" id="cancel">Cancel</button></div></form>`;
  const getValue = k => byId('f-' + k)?.value;
  const refreshShown = () => {
    fields.forEach(f => { const w = dlg.querySelector(`[data-key="${f.id}"]`); if (w) w.hidden = !isShown(f, getValue); });
    if (groups) groups.forEach(g => { const el = dlg.querySelector(`[data-fg="${g.id}"]`); if (el) el.hidden = !g.fields.some(f => isShown(f, getValue)); }); // a group with nothing to show is not shown
  };
  const drawGallery = () => {
    const box = byId('gal-box'); if (!box) return;
    box.innerHTML = gal.map((src, i) => `<figure class="galitem${i === galSel ? ' sel' : ''}"><img class="galthumb" src="${esc(src)}" alt="Picture ${i + 1}" data-galview="${i}">
      <figcaption><button type="button" class="btn" data-galmain="${i}">Make main</button> <button type="button" class="btn danger" data-galdel="${i}">Remove</button></figcaption></figure>`).join('')
      + (galSel !== null && gal[galSel] ? `<img class="galbig" src="${esc(gal[galSel])}" alt="Selected picture">` : '');
  };
  drawGallery();
  refreshShown();
  // the statistics of a slotcar (1.30.0): what the form says about the service interval, the button that starts the count again, and the mileage
  let serviceReset = false;
  const syncService = () => {
    const el = byId('svc-note'); if (!el) return;
    const st = CarStats.status({ serviceInterval: (byId('f-serviceInterval') || {}).value }, serviceReset ? 0 : item ? CarStats.sinceOf(item) : 0);
    el.textContent = CarStats.note(st) + (serviceReset ? ' The count starts again at 0 when you save.' : ''); el.classList.toggle('due', st.due);
  };
  syncService();
  if (e === 'slotcars' && byId('f-_mileage')) { // the statistics that are worked out from the database (1.30.0 the mileage, 1.33.0 the others)
    const fill = d => { const t = carStatTexts(d); CAR_STATS.forEach(f => { byId('f-' + f.key).value = t[f.key]; }); byId('f-_byTrack').innerHTML = carTracksHtml(d); if (serviceReset) byId('f-_mileageSince').value = Stats.fmtDist(0, dUnit()); }; // (after Reset the distance since the service starts again at 0) // (a distance that is not known is a dash)
    if (!item) fill(CarStats.details({}, [], [], []));
    else { CAR_STATS.forEach(f => { byId('f-' + f.key).value = 'Calculating…'; }); loadCarStats(item).then(fill).catch(() => { CAR_STATS.forEach(f => { byId('f-' + f.key).value = '–'; }); byId('f-_byTrack').textContent = '–'; }); }
  }
  if (groups) dlg.querySelectorAll('.fgroup').forEach(el => { el.ontoggle = () => { const g = el.dataset.fg; if (el.open) opened.add(g); else opened.delete(g); }; }); // remembered for the next time the form opens
  attachFrames(dlg, k => frames[k], (k, f) => { frames[k] = f; });
  dlg.onclick = ev => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.id === 'cancel') dlg.close();
    const d = b.dataset || {};
    if (d.svcreset) { // the car was serviced: the count starts again at 0 (kept when the form is saved), and the day is today
      serviceReset = true; byId('f-lapsSinceService').value = 0; byId('f-serviceDate').value = plainDate(new Date().toISOString()); byId('f-servicesDone').value = CarStats.servicesOf(item) + 1; byId('f-_mileageSince').value = Stats.fmtDist(0, dUnit()); syncService(); return;
    }
    if (d.fgall !== undefined && groups) { // open or close every group
      opened.clear(); if (d.fgall === '1') groups.forEach(g => opened.add(g.id));
      dlg.querySelectorAll('.fgroup').forEach(el => { el.open = d.fgall === '1'; }); return;
    }
    if (memF && (d.memadd || d.memup !== undefined || d.memdown !== undefined || d.memdel !== undefined)) { // the drivers of a team: add, move, remove
      if (d.memadd) { const pick = byId('mem-pick').value; if (pick && !members.includes(pick)) members.push(pick); }
      else if (d.memdel !== undefined) members.splice(Number(d.memdel), 1);
      else { const i = Number(d.memup !== undefined ? d.memup : d.memdown), j = d.memup !== undefined ? i - 1 : i + 1; if (j >= 0 && j < members.length && i >= 0 && i < members.length) [members[i], members[j]] = [members[j], members[i]]; }
      byId('mem-box').innerHTML = memRows(members, state.refs[memF.ref] || []); return;
    }
    if (d.twpreset) { const pr = TyreWear.PRESETS[d.twpreset]; if (pr) { twt = JSON.parse(JSON.stringify(pr.tyres)); byId('tw-box').innerHTML = twTable(twt, getValue('unit') || 'lap', twsel); } return; }
    if (d.twsel) { twsel = d.twsel; dlg.querySelectorAll('[data-twrow]').forEach(r => { r.classList.toggle('sel', r.dataset.twrow === twsel); const bt = r.querySelector('[data-twsel]'); if (bt) bt.disabled = r.dataset.twrow === twsel; }); byId('tw-curve').innerHTML = twCurve(twt, twsel); return; }
    if (d.cfadd) { cfails.push({ name: '', level: dlevels.length ? String(dlevels[0].name || '') : '', chance: 5, seconds: 10 }); byId('cf-box').innerHTML = cfRows(cfails, dlevels); return; }
    if (d.cfdel !== undefined) { cfails.splice(Number(d.cfdel), 1); byId('cf-box').innerHTML = cfRows(cfails, dlevels); return; }
    if (d.cfstd) { Failures.DEFAULT_FAILURES.forEach(x => { if (!cfails.some(y => String(y.name || '').trim().toLowerCase() === x.name.toLowerCase())) cfails.push({ ...x }); }); byId('cf-box').innerHTML = cfRows(cfails, dlevels); return; }
    if (d.dladd) { dlevels.push({ name: '', from: dlevels.length ? (Number(dlevels[dlevels.length - 1].from) || 0) + 3 : 3, seconds: 10, urgency: 'whenever', within: 0, action: 'repair' }); byId('dl-box').innerHTML = dlRows(dlevels); if (byId('cf-box')) byId('cf-box').innerHTML = cfRows(cfails, dlevels); return; }
    if (d.dldel !== undefined) { dlevels.splice(Number(d.dldel), 1); byId('dl-box').innerHTML = dlRows(dlevels); if (byId('cf-box')) byId('cf-box').innerHTML = cfRows(cfails, dlevels); return; }
    if (d.diadd) { dincs.push({ name: '', points: 1 }); byId('di-box').innerHTML = diRows(dincs); return; }
    if (d.didel !== undefined) { dincs.splice(Number(d.didel), 1); byId('di-box').innerHTML = diRows(dincs); return; }
    if (d.ptadd) { types.push({ name: '', kind: 'stopgo', seconds: 5, cost: 5, extra: 1, unserved: 10 }); byId('pt-box').innerHTML = ptRows(types); return; }
    if (d.ptdel !== undefined) { types.splice(Number(d.ptdel), 1); byId('pt-box').innerHTML = ptRows(types); return; }
    if (d.calcopen) { byId('calc').hidden = !byId('calc').hidden; return; }
    if (d.calcadd) { pieces.push({ count: '', mm: pieces.length ? pieces[pieces.length - 1].mm : 200 }); byId('calc-rows').innerHTML = calcRows(pieces); byId('calc-total').textContent = Speed.lengthText(Speed.lengthFromPieces(pieces), dUnit()); return; }
    if (d.calcdel !== undefined) { pieces.splice(Number(d.calcdel), 1); if (!pieces.length) pieces.push({ count: '', mm: 200 }); byId('calc-rows').innerHTML = calcRows(pieces); byId('calc-total').textContent = Speed.lengthText(Speed.lengthFromPieces(pieces), dUnit()); return; }
    if (d.calcuse) { const t = Speed.lengthFromPieces(pieces); if (t > 0) { const el = byId('f-length'); el.value = Speed.lengthTyped(t, dUnit()); if (dUnit() === 'ft' && el.dataset) { el.dataset.du = 'ft'; el.dataset.shown = String(el.value); el.dataset.keep = String(t); } } return; }
    if (d.galview !== undefined) { galSel = galSel === Number(d.galview) ? null : Number(d.galview); drawGallery(); return; }
    if (d.galdel !== undefined) { gal.splice(Number(d.galdel), 1); galSel = null; drawGallery(); return; }
    if (d.galmain !== undefined) { // this picture becomes the main one; the old main picture goes into the gallery
      const i = Number(d.galmain), old = imgs[mainKey];
      imgs[mainKey] = gal[i]; frames[mainKey] = Widgets.frameOf(null);
      if (old) gal[i] = old; else gal.splice(i, 1);
      galSel = null; const im = byId('f-' + mainKey + '-img'); im.src = imgs[mainKey]; im.hidden = false; redrawFrame(mainKey); drawGallery(); return;
    }
    if (b.dataset.clear) { imgs[b.dataset.clear] = ''; frames[b.dataset.clear] = Widgets.frameOf(null); byId('f-' + b.dataset.clear + '-img').hidden = true; byId('f-' + b.dataset.clear).value = ''; redrawFrame(b.dataset.clear); }
  };
  dlg.oninput = ev => {
    const t = ev.target;
    if (t && t.id === 'f-serviceInterval') { syncService(); return; }
    if (t && t.dataset && t.dataset.tw !== undefined) { // a number of a tyre: the "lasts about" and the grip curve follow
      const code = t.dataset.tw; if (twt[code]) twt[code][t.dataset.twk] = t.value;
      const lastsEl = dlg.querySelector(`[data-twlast="${code}"]`); if (lastsEl) lastsEl.textContent = TyreWear.lastsText(getValue('unit') || 'lap', dUnit(), Number(String(twt[code].wear ?? '').replace(',', '.')));
      if (twsel !== code) { twsel = code; dlg.querySelectorAll('[data-twrow]').forEach(r => { r.classList.toggle('sel', r.dataset.twrow === twsel); const bt = r.querySelector('[data-twsel]'); if (bt) bt.disabled = r.dataset.twrow === twsel; }); }
      byId('tw-curve').innerHTML = twCurve(twt, twsel); return;
    }
    if (t && t.dataset && t.dataset.tws !== undefined) { if (tws[t.dataset.tws] !== undefined) tws[t.dataset.tws] = t.value; return; }
    if (t && t.dataset && t.dataset.twm !== undefined) { if (twm[t.dataset.twm]) twm[t.dataset.twm][t.dataset.twmc] = t.value; return; }
    if (t && t.dataset && t.dataset.dl !== undefined) {
      const lv = dlevels[Number(t.dataset.dl)];
      if (lv) { const was = lv[t.dataset.dlk]; lv[t.dataset.dlk] = t.value; if (t.dataset.dlk === 'name' && byId('cf-box')) { cfails.forEach(x => { if (String(x.level || '') === String(was || '')) x.level = t.value; }); byId('cf-box').innerHTML = cfRows(cfails, dlevels); } } // (a failure follows its level when the level is renamed)
      return;
    }
    if (t && t.dataset && t.dataset.cf !== undefined) { const fl = cfails[Number(t.dataset.cf)]; if (fl) fl[t.dataset.cfk] = t.value; return; }
    if (t && t.dataset && t.dataset.di !== undefined) { const ic = dincs[Number(t.dataset.di)]; if (ic) ic[t.dataset.dik] = t.value; return; }
    if (t && t.dataset && t.dataset.pt !== undefined) { const ty = types[Number(t.dataset.pt)]; if (ty) ty[t.dataset.ptk] = t.value; return; }
    const c = t && t.classList && t.dataset && t.dataset.i !== undefined;
    if (!c) return;
    const p = pieces[Number(t.dataset.i)]; if (!p) return;
    if (t.className.includes('calc-count')) p.count = t.value; else if (t.className.includes('calc-mm')) p.mm = dUnit() === 'ft' && t.value !== '' ? Speed.smallKept(t.value, 'ft') : t.value;
    byId('calc-total').textContent = Speed.lengthText(Speed.lengthFromPieces(pieces), dUnit());
  };
  dlg.onchange = async ev => {
    const t = ev.target;
    refreshShown();
    if (t && t.id === 'f-unit' && byId('tw-box')) { byId('tw-box').innerHTML = twTable(twt, t.value, twsel); return; } // (per lap or per distance: the heading and the lasts about change)
    if (t.dataset && t.dataset.gallery && t.files) { // more pictures for the gallery
      const room = GALLERY_MAX - gal.length;
      try { for (const file of [...t.files].slice(0, Math.max(0, room))) gal.push(await resizeImage(file, 1024)); byId('err').textContent = t.files.length > room ? `Only ${GALLERY_MAX} extra pictures fit; the rest were skipped.` : ''; }
      catch (x) { byId('err').textContent = x.message; }
      t.value = ''; drawGallery(); return;
    }
    if (t.type === 'file' && t.files[0]) {
      const key = t.id.slice(2);
      try {
        imgs[key] = await resizeImage(t.files[0], 512);
        frames[key] = Widgets.frameOf(null); // a new picture starts centred
        const im = byId(t.id + '-img'); im.src = imgs[key]; im.hidden = false; redrawFrame(key);
        byId('err').textContent = '';
      } catch (x) { byId('err').textContent = x.message; }
    }
    if (t.tagName === 'SELECT' && byId(t.id + '-flag')) byId(t.id + '-flag').innerHTML = flagHtml(t.value);
  };
  let saving = false;
  byId('frm').onsubmit = async ev => {
    ev.preventDefault();
    if (saving) return;
    const built = {}, custom = { ...(item?.custom || {}) };
    for (const f of fields) {
      if (f.automatic) { if (!item) built[f.key] = f.type === 'datetime' ? '' : 0; continue; }
      if (f.type === 'carstat' || f.type === 'cartracks') continue; // (worked out for the form, not kept)
      if (f.type === 'gallery') { built[f.key] = [...gal]; continue; }
      if (f.type === 'members') { built[f.key] = members.filter(id => (state.refs[f.ref] || []).some(x => x.id === id)); continue; }
      if (f.type === 'damagelevels') { built[f.key] = dlevels.filter(l => String(l.name || '').trim() || Number(l.from) > 0).map(l => ({ name: String(l.name || '').trim(), from: Math.max(0, Math.floor(Number(l.from)) || 0), seconds: Math.max(0, Number(l.seconds) || 0), urgency: l.urgency === 'asap' ? 'asap' : 'whenever', within: Math.max(0, Math.floor(Number(l.within)) || 0), action: Damage.ACTIONS.includes(l.action) ? l.action : 'repair' })); continue; }
      if (f.type === 'tyretable') { built[f.key] = TyreWear.cleanTyres(twt); continue; }
      if (f.type === 'wxmult') { built[f.key] = TyreWear.cleanMult(twm); continue; }
      if (f.type === 'tyresets') { built[f.key] = TyreWear.cleanSets(tws); continue; }
      if (f.type === 'carfailures') { built[f.key] = cfails.filter(x => String(x.name || '').trim()).map(x => ({ name: String(x.name).trim(), level: String(x.level || '').trim(), chance: Math.min(100, Math.max(0, Math.round((Number(x.chance) || 0) * 100) / 100)), seconds: Math.max(0, Math.round((Number(x.seconds) || 0) * 100) / 100) })); continue; }
      if (f.type === 'damageincidents') { built[f.key] = dincs.filter(x => String(x.name || '').trim()).map(x => ({ name: String(x.name).trim(), points: Math.max(1, Math.floor(Number(x.points)) || 1) })); continue; }
      if (f.type === 'penaltytypes') { built[f.key] = types.filter(t => String(t.name || '').trim()).map(t => ({ name: String(t.name).trim(), kind: t.kind === 'drivethrough' ? 'drivethrough' : 'stopgo', seconds: Number(t.seconds) || 0, cost: Number(t.cost) || 0, extra: Number(t.extra) || 0, unserved: Number(t.unserved) || 0 })); continue; }
      const el = byId('f-' + f.id);
      let v;
      if (f.type === 'image') { v = imgs[f.id]; if (!f.custom) built[f.key + 'Frame'] = v ? frames[f.id] : null; }
      else if (f.type === 'number' || f.type === 'tracklength') v = el.value === '' ? '' : el.dataset && el.dataset.du === 'ft' ? keptValue(f, el) : Number(el.value);
      else { v = el.dataset && el.dataset.du === 'ft' ? keptValue(f, el) : el.value.trim(); if (f.uppercase) v = v.toUpperCase(); }
      if (f.type === 'padlist' && v !== '' && isShown(f, getValue)) { // (the values of an Adjust pad: tidied up - smallest first, no doubles, at most six - or the field is empty, which means the App Settings values)
        const own = AdjustPad.ownOf({ [AdjustPad.byId(f.pad).key]: v }, f.pad);
        if (!own) { byId('err').textContent = 'Please enter numbers above zero, separated by commas, for example 1, 3, 10. Leave the field empty to use the values from App Settings.'; return; }
        v = AdjustPad.listText(own);
      }
      if (f.type === 'numberlist' && isShown(f, getValue)) {
        v = ListNum.tidy(v); // (a decimal comma is made a dot: 15,4 is 15.4 metres)
        if (!(f.optional && v === '') && !/^\s*\d+(\.\d+)?(\s*,\s*\d+(\.\d+)?)*\s*$/.test(v)) { // (an optional list may stay empty)
          byId('err').textContent = 'Please enter numbers separated by commas, for example 10, 8, 6.';
          return;
        }
      }
      if (f.type === 'tracklength') { // keep the pieces only while they still add up to the length
        const used = pieces.filter(p => Number(p.count) > 0 && Number(p.mm) > 0).map(p => ({ count: Number(p.count), mm: Number(p.mm) }));
        built.lengthPieces = used.length && Speed.lengthFromPieces(used) === v ? used : [];
      }
      if (f.custom) custom[f.id] = v; else built[f.key] = v;
    }
    if (e === 'slotcars') { // the service interval is a whole number of laps (empty = none); Reset starts the count again today
      if (built.serviceInterval !== '' && built.serviceInterval !== undefined) built.serviceInterval = Math.max(1, Math.floor(Number(built.serviceInterval)) || 1);
      if (serviceReset) { built.lapsSinceService = 0; built.serviceDate = new Date().toISOString(); built.servicesDone = CarStats.servicesOf(item) + 1; }
    }
    if (e === 'tracks' && built.laneModifier === 'measured') { // one length for every lane
      const list = String(built.laneLengths || '').split(',').map(x => x.trim()).filter((x, i, a) => x !== '' || i < a.length - 1), n = Number(built.lanes);
      if (list.length !== n || list.some(x => !(Number(x) > 0))) {
        byId('err').textContent = `Please enter the length of every lane: ${n} numbers above 0, separated by commas (you entered ${list.filter(x => Number(x) > 0).length}).`;
        return;
      }
    }
    if (e === 'tyrewearsystems' && Number(built.crit) > Number(built.warn)) { // the red level must be at or below the amber level
      byId('err').textContent = 'The critical (red) level must be at or below the warning (amber) level.';
      return;
    }
    if (!s.title.some(k => String(built[k] ?? '').length)) {
      byId('err').textContent = 'Please fill in ' + s.title.map(k => s.fields.find(f => f.key === k).label).join(' or ') + '.';
      return;
    }
    saving = true; // (a second click while the first is being written would add the row twice)
    try {
      await (item ? api.update(e, item.id, { ...built, custom }) : api.add(e, { ...built, custom }));
      dlg.close();
    } catch (x) { byId('err').textContent = 'It could not be saved: ' + (x && x.message ? x.message : x); } // (the form stays open: nothing is lost)
    finally { saving = false; }
  };
  if (!dlg.open) dlg.showModal(); // (it is already open when Edit was pressed in the view card)
  if (groups) { const first = byId('f-' + fields[0].id); if (first && first.focus) first.focus(); } // the first field, as before, not the Open all button above the groups
}

// The groups an extra field can be put in: the groups of the form, then More (the default, and where a field goes whose group is not known)
const groupChoices = (e, current) => {
  const known = (state.schema[e].groups || []).some(g => g.id === current);
  return [...(state.schema[e].groups || []).map(g => [g.id, g.title]), ['', 'More']]
    .map(([id, title]) => `<option value="${esc(id)}"${id === (known ? current : '') ? ' selected' : ''}>${esc(title)}</option>`).join('');
};

async function openExtra(e) {
  const s = state.schema[e];
  const list = await api.customFields(e);
  state.custom[e] = list;
  const grouped = (s.groups || []).length > 0;
  dlg.innerHTML = `<h3>Extra fields for ${esc(s.plural.toLowerCase())}</h3>
    <p class="muted">Extra fields are for your own information. They don't affect lap times or records.</p>` +
    (list.length ? `<ul class="xf">${list.map(f => `<li><span>${esc(f.label)} <span class="muted">(${XTYPES[f.type]})</span></span>${grouped ? `<select data-grp="${esc(f.id)}" aria-label="Group of ${esc(f.label)}" title="Where this field appears in the form">${groupChoices(e, f.group)}</select>` : ''}<button class="btn danger" data-rm="${esc(f.id)}">Delete</button></li>`).join('')}</ul>`
      : '<p class="muted">No extra fields yet.</p>') +
    `<div class="field"><label for="xl">New field name</label><input id="xl" type="text"></div>
     <div class="field"><label for="xt">Type</label><select id="xt">${Object.entries(XTYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
     <div class="field" id="xow" hidden><label for="xo">Options (separate with commas)</label><input id="xo" type="text"></div>
     ${grouped ? `<div class="field"><label for="xg">Group in the form</label><select id="xg">${groupChoices(e, '')}</select><span class="muted hint">Where the field appears. You can change it later in the list above.</span></div>` : ''}
     <p class="error" id="err" role="alert"></p>
     <div class="row"><button class="btn primary" id="xadd">Add field</button><button class="btn" id="xclose">Close</button></div>`;
  dlg.onchange = async ev => {
    const t = ev.target;
    if (t.id === 'xt') byId('xow').hidden = t.value !== 'list';
    if (t.dataset && t.dataset.grp) {
      const f = list.find(x => x.id === t.dataset.grp); if (!f) return;
      const before = f.group || '';
      try { const saved = await api.setCustomFieldGroup(e, f.id, t.value); f.group = saved && typeof saved.group === 'string' ? saved.group : t.value; }
      catch (x) { t.value = before; byId('err').textContent = 'The group could not be changed: ' + x.message; }
    }
  };
  dlg.onclick = async ev => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.id === 'xclose') return dlg.close();
    if (b.dataset.rm && confirm('Delete this extra field? Its values are removed from every item.')) {
      await api.removeCustomField(e, b.dataset.rm);
      return openExtra(e);
    }
    if (b.id === 'xadd') {
      const label = byId('xl').value.trim(), type = byId('xt').value;
      const options = byId('xo').value.split(',').map(x => x.trim()).filter(Boolean);
      if (!label) return void (byId('err').textContent = 'Please enter a name for the field.');
      if (type === 'list' && !options.length) return void (byId('err').textContent = 'Please enter at least one option.');
      await api.addCustomField(e, { label, type, options: type === 'list' ? options : [], group: grouped ? byId('xg').value : '' });
      openExtra(e);
    }
  };
  if (!dlg.open) dlg.showModal();
}

// ---- Results and Records ----
const dateText = iso => iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '';
const SESSION_LABEL = { practice: 'Free practice', qualifying: 'Qualifying', race: 'Race by laps or distance', timed: 'Timed race', heats: 'Heat-based race', endurance: 'Endurance Race', tokens: 'Time Token Session' };

// The page has two pools that never mix: Racing Records (everything raced) and Token Records (the stints of Time Token Sessions, with their own records).
async function renderResults(box) {
  manager = null;
  const pool = state.resultsSub === 'tokens' ? 'tokens' : 'racing';
  box.innerHTML = '<div class="sub" id="respool" role="tablist" style="display:flex;gap:4px"></div><div id="resbody"></div>';
  renderTabs(byId('respool'), [['racing', 'Racing Records'], ['tokens', 'Token Records']], pool, id => { state.resultsSub = id; renderResults(box); });
  await renderResultsPool(byId('resbody'), pool);
}
// the lines that tell how the figures of a table are counted, as one small paragraph under it
const statNote = keys => { const n = Stats.notes(keys); return n.length ? `<p class="muted statnote">${n.map(esc).join(' ')}</p>` : ''; };
// time bought for a stint: "10 min", "1 min 30 s", "45 s"
const boughtText = ms => { const sec = Math.round(Number(ms) / 1000); if (!Number.isFinite(sec)) return ''; const m = Math.floor(sec / 60), s = sec % 60; return !s ? `${m} min` : m ? `${m} min ${s} s` : `${s} s`; };

// The tyre stints of a session that had Tyre Wear (1.42.0): a heading with its two switches (kept in the settings), and the bars under it. Nothing for a session without tyre wear.
const tyreStintsSection = s => {
  if (!Stats.tyreStints(s, dUnit()).length) return '';
  const on = state.settings.tyreStints !== false, worn = state.settings.tyreWornRed === true;
  return `<h4>Tyre stints</h4><div class="tysopt"><label class="inline"><input type="checkbox" data-tyshow="${esc(s.id)}"${on ? ' checked' : ''}> Show the tyre stints under the results</label>
    <label class="inline"><input type="checkbox" data-tyworn="${esc(s.id)}"${worn ? ' checked' : ''}> Show the laps on worn tyres (0%) in red</label></div>${on ? Stats.tyreStintsHtml(s, { distUnit: dUnit(), worn }) + `<p class="muted statnote">${esc(Stats.tyreStintsNote(s))}</p>` : ''}`;
};

// The dialog of Export to PDF: what goes in the PDF. Resolves with the options for Report.sessionHtml, or null when it was cancelled.
// The columns start as the View settings have them; the pages (results table, heats, lap times) start as they were picked the last time.
function pdfChoice(session, figs) {
  const cols = Stats.sessionColumns(session, figs), screen = ViewSet.keys(Stats.SESSION_COLUMNS, viewSaved(['results', 'sessions']));
  const pages = { results: true, heats: true, tyres: true, laps: true, ...(state.settings.pdfPages || {}) };
  const picked = new Set(cols.filter(c => screen.includes(c.key)).map(c => c.key));
  const items = [['results', 'Results table'], ...(session.heatResults ? [['heats', session.finals ? 'Heats and finals' : 'Heats']] : []), ...(Stats.tyreStints(session, 'm').length ? [['tyres', 'Tyre stints']] : []), ['laps', 'Every lap time (page 2 onwards)']];
  dlg.innerHTML = `<h3>Export to PDF</h3><p class="muted">Choose what goes in the PDF.</p>
    <fieldset class="vsgroup"><legend>Include</legend>${items.map(([k, t]) => `<label class="vschip"><input type="checkbox" data-pdfpage="${k}"${pages[k] ? ' checked' : ''}> ${esc(t)}</label>`).join('')}</fieldset>
    <fieldset class="vsgroup"><legend>Columns of the results table</legend>${cols.map(c => `<label class="vschip"><input type="checkbox" data-pdfcol="${esc(c.key)}"${picked.has(c.key) ? ' checked' : ''}> ${esc(c.label)}</label>`).join('')}</fieldset>
    <div class="row"><button class="btn" type="button" data-pdfall="1">All columns</button><button class="btn" type="button" data-pdfall="0">No columns</button></div>
    <p class="muted">The columns start as your View settings have them. The choice of pages is remembered for the next time.</p>
    <p class="error" id="pdferr" role="alert"></p>
    <div class="row"><button class="btn primary pdfbtn" type="button" id="pdfgo">${Icons.svg('pdf', { size: 18 })}<span>Export to PDF</span></button><button class="btn" type="button" id="pdfcancel">Cancel</button></div>`;
  return new Promise(resolve => {
    let done = false;
    const finish = v => { if (done) return; done = true; if (dlg.open) dlg.close(); resolve(v); };
    dlg.addEventListener('close', () => finish(null), { once: true }); // (Escape closes it too)
    dlg.oninput = null;
    dlg.onchange = ev => {
      const t = ev.target || {}, d = t.dataset || {};
      if (d.pdfpage) pages[d.pdfpage] = !!t.checked;
      if (d.pdfcol) { if (t.checked) picked.add(d.pdfcol); else picked.delete(d.pdfcol); }
    };
    dlg.onclick = async ev => {
      const b = ev.target && ev.target.closest ? ev.target.closest('button') : null; if (!b) return;
      if (b.dataset && b.dataset.pdfall !== undefined) {
        const on = b.dataset.pdfall === '1'; picked.clear(); if (on) cols.forEach(c => picked.add(c.key));
        if (typeof dlg.querySelectorAll === 'function') Array.from(dlg.querySelectorAll('[data-pdfcol]') || []).forEach(x => { x.checked = on; });
        return;
      }
      if (b.id === 'pdfcancel') return finish(null);
      if (b.id !== 'pdfgo') return;
      const err = byId('pdferr'), has = items.some(([k]) => pages[k]);
      if (!has) { err.textContent = 'Pick at least one thing to include.'; return; }
      if (pages.results && !picked.size) { err.textContent = 'Pick at least one column, or leave the results table out.'; return; }
      const chosen = { results: !!pages.results, heats: !!pages.heats, tyres: !!pages.tyres, laps: !!pages.laps };
      try { state.settings = await api.setSettings({ pdfPages: chosen }); } catch { /* remembering the choice is not needed for the PDF */ }
      finish({ ...chosen, columns: cols.filter(c => picked.has(c.key)).map(c => c.key) });
    };
    if (!dlg.open) dlg.showModal();
  });
}

async function renderResultsPool(box, pool) {
  const tokenPool = pool === 'tokens';
  const run = ++subRun;
  const [allSessions, allLaps, drivers, cars, tracks] = await Promise.all(['sessions', 'laps', 'drivers', 'slotcars', 'tracks'].map(x => api.list(x)));
  if (run !== subRun) return;
  const sessions = allSessions.filter(x => (x.sessionType === 'tokens') === tokenPool).map(x => Array.isArray(x.standings) ? x : { ...x, standings: [] }); // (a session from a hand-made file may have no list of results: it shows with an empty table)
  const laps = allLaps.filter(l => !!l.token === tokenPool); // (the two pools never mix)
  if (!sessions.length) { box.innerHTML = tokenPool ? '<p class="muted">No token results yet. Open a Time Token Session from the Home tab: every stint (one driver on one lane for one paid time) is saved here when it ends.</p>' : '<p class="muted">No results yet. Run a race from the Home tab and every lap is saved here.</p>'; return; }
  const name = (list, id, ent) => { const x = list.find(r => r.id === id); return x ? titleOf(ent, x) : tokenPool && !id ? 'Guest' : '(deleted)'; };
  const folderPage = tokenPool ? 'tresults' : 'results';

  // fastest lap per track overall, and per driver on each track
  // a lap removed from the records stays in its session; the next fastest lap takes over
  const best = (keyFn, skip) => {
    const m = new Map();
    for (const l of laps) {
      if (l[skip] || (tokenPool && skip === 'noPersonalBest' && !l.driverId)) continue; const k = keyFn(l); if (!m.has(k) || l.time < m.get(k).time) m.set(k, l); }
    return [...m.values()];
  };
  // the columns of the record tables (View settings decides which are shown)
  const sessionOf = new Map(sessions.map(x => [x.id, x]));
  const speedOf = l => Stats.lapSpeed(l, tracks, cars);
  const lapText = l => `${l.heat ? (l.final ? 'F' + l.final : 'H' + l.heat) + ' ' : ''}${l.lapNumber}`;
  const RECCELL = {
    track: l => esc(name(tracks, l.trackId, 'tracks')), driver: l => esc(name(drivers, l.driverId, 'drivers')), time: l => `<strong>${esc(RaceEngine.fmtTime(l.time))}</strong>`,
    car: l => esc(name(cars, l.carId, 'slotcars')), speed: l => esc(Stats.fmtSpeed(speedOf(l).speed, Speed.unitOf(state.settings))), scalespeed: l => esc(Stats.fmtScale(speedOf(l).scalespeed, Speed.unitOf(state.settings))),
    session: l => (sessionOf.get(l.sessionId) ? esc(sessionOf.get(l.sessionId).setupName) : '<span class="muted">–</span>'), lane: l => (l.lane ? esc(l.lane) : '<span class="muted">–</span>'),
    lapno: l => esc(lapText(l)), date: l => esc(dateText(l.date))
  };
  const recKeys = Stats.RECORD_COLUMNS.filter(c => ViewSet.keys(Stats.RECORD_COLUMNS, viewSaved(['results', 'records'])).includes(c.key));
  const recRow = kind => l => `<tr>${recKeys.map(c => `<td>${RECCELL[c.key](l)}</td>`).join('')}
    <td class="actions"><button class="btn danger" data-delrec="${kind}" data-lap="${esc(l.id)}">Remove</button></td></tr>`;
  const head = `<tr>${recKeys.map(c => `<th>${esc(c.label)}</th>`).join('')}<th></th></tr>`;
  const byTrack = (a, b) => name(tracks, a.trackId, 'tracks').localeCompare(name(tracks, b.trackId, 'tracks')) || a.time - b.time;
  const trackRecords = best(l => l.trackId, 'noTrackRecord').sort(byTrack);
  const personal = best(l => l.trackId + '|' + l.driverId, 'noPersonalBest').sort(byTrack);

  const recTable = (list, kind) => list.length ? `<div class="wrap"><table class="fields">${head}${list.map(recRow(kind)).join('')}</table></div>` : '<p class="muted">None yet.</p>';
  // The end of the summary line of a session: who won a race (the first place; a driver who was deleted takes the place with them, so the runner-up is not called the winner), and who was fastest in a practice or a qualifying
  const headline = (s, win, cup) => {
    if (!win) return '';
    if (Stats.WINNER_TYPES.includes(s.sessionType)) return Number(win.pos) === 1 ? ' · Winner: ' + (Stats.isWinner(s, win) ? cup + ' ' : '') + esc(win.driverName) : '';
    return Number(win.best) > 0 ? ' · Fastest: ' + esc(win.driverName) : '';
  };
  const sessionCards = [...sessions].reverse().map(s => {
    const win = s.standings[0];
    if (tokenPool) { // a stint: one driver, one lane, one paid time
      const x = win || {}, t = s.token || {}, mine = laps.filter(l => l.sessionId === s.id).sort((a, b) => a.lapNumber - b.lapNumber);
      const figs = Stats.forSession(s, mine, tracks, cars), stintKeys = ViewSet.keys(Stats.STINT_COLUMNS, viewSaved(['results', 'stints']));
      const STCELL = { driver: esc(x.driverName), car: esc(x.carName), lane: esc(t.lane), bought: esc(boughtText(t.bought)), laps: esc(x.laps), late: esc(x.lateLaps || 0), best: esc(RaceEngine.fmtTime(x.best)), total: esc(RaceEngine.fmtTime(x.total)) };
      const stCols = Stats.STINT_COLUMNS.filter(c => stintKeys.includes(c.key) && (c.key in STCELL || Stats.hasAny(c.key, figs)));
      const body = `<table class="fields"><tr>${stCols.map(c => `<th>${esc(c.label)}</th>`).join('')}</tr>
        <tr>${stCols.map(c => `<td>${c.key in STCELL ? STCELL[c.key] : esc(Stats.text(c.key, figs[0], Speed.unitOf(state.settings), Speed.distUnitOf(state.settings)))}</td>`).join('')}</tr></table>${stCols.length ? '' : '<p class="muted">No columns are on. Turn some on in View settings.</p>'}${statNote(stCols.map(c => c.key))}
        <p class="muted">${esc(s.endedBy || '')}${t.carried ? ` · ${esc(boughtText(t.carried))} came over from the driver before` : ''}${t.left ? ` · ${esc(boughtText(t.left))} was not used` : ''}</p>
        <h4>All lap times</h4><p><span class="muted">${mine.map(l => { const tx = esc(`${l.lapNumber}: ${RaceEngine.fmtTime(l.time)}`); return l.late || l.invalid || l.tooSlow ? `<s class="lapbad" title="${l.late ? 'Late lap: driven after the time was up' : l.invalid ? 'Invalid lap' : 'Too slow: not counted for records'}">${tx}</s>` : tx; }).join(' · ') || 'no laps'}</span></p>
        <div class="row">${pdfButton(`data-pdf="${esc(s.id)}"`)}<button class="btn danger" data-delsession="${esc(s.id)}">Delete this stint</button><span class="muted" id="pdfmsg-${esc(s.id)}" role="status"></span></div>`;
      return `<details class="card sess"><summary>${esc(dateText(s.date))} · Lane ${esc(t.lane)} · ${esc(x.driverName)} · ${esc(boughtText(t.bought))} · ${esc(x.laps)} ${Number(x.laps) === 1 ? 'lap' : 'laps'} · ${esc(s.trackName || '')}</summary><div class="sessbody">${body}</div></details>`;
    }
    const pts = s.resultBy === 'points';
    const fin = Stats.heated(s) && !!s.finals, finArg = { finalMode: fin ? s.finals.finalMode : 'places', byPoints: pts };
    const figs = Stats.forSession(s, laps.filter(l => l.sessionId === s.id), tracks, cars), shownKeys = ViewSet.keys(Stats.SESSION_COLUMNS, viewSaved(['results', 'sessions']));
    const cols = Stats.sessionColumns(s, figs).filter(c => shownKeys.includes(c.key));
    const cup = Icons.trophy({ size: 16 }), hasDriver = cols.some(c => c.key === 'driver'); // (the winner's cup goes next to the name; without the Driver column next to the position)
    const cellOf = (key, x, i) => {
      switch (key) {
        case 'pos': return esc(x.pos) + (!hasDriver && Stats.isWinner(s, x) ? ' ' + cup : '');
        case 'driver': return (Stats.isWinner(s, x) ? cup + ' ' : '') + esc(x.driverName) + (Stats.outText(x) ? ` <span class="muted">(${Stats.outText(x)})</span>` : '') + (Stats.adjustedText(x) ? ` <span class="muted">(adjusted: ${esc(Stats.adjustedText(x))})</span>` : '') + (Stats.notesText(x) ? ` <span class="muted">(${esc(Stats.notesText(x))})</span>` : '') + (Stats.driversText(x, dUnit()) ? ` <span class="muted">(drivers: ${esc(Stats.driversText(x, dUnit()))})</span>` : '') + (Stats.enduranceText(x, dUnit()) ? ` <span class="muted">(${esc(Stats.enduranceText(x, dUnit()))})</span>` : '');
        case 'team': return esc(x.teamName || '');
        case 'car': return esc(x.carName);
        case 'laps': return esc(x.laps);
        case 'points': return esc(x.points);
        case 'result': return esc(Heats.scoreText(x, s.scoring, finArg));
        case 'final': return esc(Heats.finalCell(x));
        case 'best': return esc(RaceEngine.fmtTime(x.best));
        case 'total': return esc(RaceEngine.fmtTime(x.total + (x.penalty || 0) + (x.adjMs || 0))) + (x.penalty ? ` <span class="muted">(includes +${esc(RaceEngine.fmtTime(x.penalty))} penalty, ${esc(x.penaltyPoints)} points)</span>` : '');
        default: return esc(Stats.text(key, figs[i], Speed.unitOf(state.settings), Speed.distUnitOf(state.settings)));
      }
    };
    const body = `<table class="fields"><tr>${cols.map(c => `<th>${esc(c.label)}</th>`).join('')}</tr>` +
      s.standings.map((x, i) => `<tr>${cols.map(c => `<td>${cellOf(c.key, x, i)}</td>`).join('')}</tr>`).join('') + '</table>' + (cols.length ? '' : '<p class="muted">No columns are on for this session. Turn some on in View settings.</p>') +
      statNote(cols.map(c => c.key)) +
      (Stats.heated(s) && s.scoring && Heats.scoringText(s.scoring, pts) ? `<p class="muted">${esc(Heats.scoringText(s.scoring, pts))}</p>` : '') + (fin ? `<p class="muted">${esc(Heats.finalsSaid(s.finals))}</p>` : '') + (Stats.weatherText(s) ? `<p class="muted">${esc(Stats.weatherText(s))}</p>` : '') + (Stats.resumeText(s) ? `<p class="muted">${esc(Stats.resumeText(s))}</p>` : '') +
      (Stats.stintLines(s, dUnit()).length ? '<h4>Driver swaps</h4>' + Stats.stintLines(s, dUnit()).map(g => `<p><strong>${esc(g.team)}</strong><br><span class="muted">${g.stints.map(q => `${esc(q.n)}. ${esc(q.text)}`).join(' · ')}</span></p>`).join('') : '') +
      (s.heatResults ? `<h4>${s.finals ? 'Heats and finals' : 'Heats'}</h4>` + s.heatResults.map(h => `<p><strong>${esc(Heats.raceName(h))}</strong>${Stats.weatherText(h) ? ` <span class="muted">· ${esc(Stats.weatherText(h))}</span>` : ''}<br><span class="muted">${h.rows.map(r => `${esc(r.pos)}. ${Stats.isHeatWinner(s, r) ? cup + ' ' : ''}${esc(r.driverName)} (${esc(r.laps)} laps${esc(Stats.heatTimeText(s, r))}${pts ? ', ' + esc(r.points) + ' pts' + (r.bonus ? ' incl. ' + esc(r.bonus) + ' for the fastest lap' : '') : ''}${Stats.adjustedText(r) ? ', adjusted: ' + esc(Stats.adjustedText(r)) : ''}${Stats.notesText(r) ? ', ' + esc(Stats.notesText(r)) : ''})`).join(' · ')}</span></p>`).join('') : '') +
      tyreStintsSection(s) +
      '<h4>All lap times</h4>' + s.standings.map(x => {
        const mine = Stats.ownLaps(x, laps).filter(l => l.sessionId === s.id).sort((a, b) => (a.heat || 0) - (b.heat || 0) || a.lapNumber - b.lapNumber);
        return `<p><strong>${esc(x.driverName)}</strong><br><span class="muted">${mine.map(l => { const t = esc(`${l.heat ? (l.final ? 'F' + l.final : 'H' + l.heat) + ' ' : ''}${l.lapNumber}: ${RaceEngine.fmtTime(l.time)}`); return l.invalid || l.tooSlow ? `<s class="lapbad" title="${l.invalid ? 'Invalid lap' : 'Too slow: not counted for records'}">${t}</s>` : l.pit ? `<em title="Lap with a pit stop">${t}</em>` : t; }).join(' · ') || 'no laps'}</span></p>`;
      }).join('') + `<div class="row">${pdfButton(`data-pdf="${esc(s.id)}"`)}<button class="btn danger" data-delsession="${esc(s.id)}">Delete this session</button><span class="muted" id="pdfmsg-${esc(s.id)}" role="status"></span></div>`;
    return `<details class="card sess" data-sid="${esc(s.id)}"><summary>${esc(dateText(s.date))} · ${esc(s.setupName)} · ${esc(SESSION_LABEL[s.sessionType] || '')} · ${esc(s.trackName || '')}${headline(s, win, cup)}</summary><div class="sessbody">${body}</div></details>`;
  }).join('');
  const RES_FOLDERS = ['tracks', 'pb', 'sessions'];
  const sessCols = tokenPool ? Stats.STINT_COLUMNS : Stats.SESSION_COLUMNS, sessPath = ['results', tokenPool ? 'stints' : 'sessions'];
  const colsOf = path => (path === 'results/records' ? Stats.RECORD_COLUMNS : path === sessPath.join('/') ? sessCols : null);
  const bar = !viewBars.has('results') ? '' : viewBar('results', 'Turn columns on or off. This changes the tables on this page and is remembered. A column that has nothing to show for a session is left out of its table.',
    [viewGroup('Track records and personal bests', ['results', 'records'], Stats.RECORD_COLUMNS), viewGroup(tokenPool ? 'Stints' : 'Sessions', sessPath, sessCols)]);
  if (state.focusSession && !tokenPool) folderClosed.delete(folderKey(folderPage, 'sessions')); // (1.25.0: a race clicked on Home opens here: its folder is open)
  box.innerHTML = folderToolsWith(viewButton('results')) + bar + folderHtml(folderPage, 'tracks', 'Track records', plural(trackRecords.length, 'record', 'records'), recTable(trackRecords, 'track'))
    + folderHtml(folderPage, 'pb', 'Personal bests', plural(personal.length, 'personal best', 'personal bests'), recTable(personal, 'pb'))
    + folderHtml(folderPage, 'sessions', tokenPool ? 'Stints' : 'Sessions', tokenPool ? plural(sessions.length, 'stint', 'stints') : plural(sessions.length, 'session', 'sessions'), sessionCards);
  folderWire(box);
  if (state.focusSession && !tokenPool) { // the race that was clicked on Home: its card is open and in view
    const id = state.focusSession; state.focusSession = null;
    const d = [...box.querySelectorAll('details.sess')].find(x => x.dataset && x.dataset.sid === id);
    if (d) { d.open = true; if (d.scrollIntoView) d.scrollIntoView({ block: 'center' }); }
  }
  box.onclick = async ev => {
    const fa = ev.target.closest('[data-folderall]');
    if (fa) { folderAll(folderPage, RES_FOLDERS, fa.dataset.folderall === '1'); return renderResultsPool(box, pool); }
    const vb = ev.target.closest('[data-viewbar]');
    if (vb) { if (viewBars.has(vb.dataset.viewbar)) viewBars.delete(vb.dataset.viewbar); else viewBars.add(vb.dataset.viewbar); return renderResultsPool(box, pool); }
    const vr = ev.target.closest('[data-vsreset]');
    if (vr) { await viewReset([['results', 'records'], sessPath]); return renderResultsPool(box, pool); }
    const p = ev.target.closest('[data-pdf]');
    if (p) {
      const s = sessions.find(x => x.id === p.dataset.pdf), mine = laps.filter(l => l.sessionId === s.id), msg = byId('pdfmsg-' + s.id);
      const options = await pdfChoice(s, Stats.forSession(s, mine, tracks, cars));
      if (!options) return;
      msg.textContent = 'Making the PDF...';
      try {
        const res = await api.exportPdf(Report.sessionHtml({ session: s, laps: mine, tracks, cars, options: { ...options, tyreWorn: state.settings.tyreWornRed === true }, unit: Speed.unitOf(state.settings), distUnit: Speed.distUnitOf(state.settings) }), Report.fileName(s));
        msg.textContent = res.saved ? 'Saved to ' + res.path : 'Export cancelled.';
      } catch (x) { msg.textContent = 'Could not make the PDF: ' + x.message; }
      return;
    }
    const rec = ev.target.closest('[data-delrec]');
    if (rec) {
      const isTrack = rec.dataset.delrec === 'track';
      if (confirm(`Remove this ${isTrack ? 'track record' : 'personal best'}?\n\nOnly the record is removed. The lap stays in its session, and the next fastest lap takes over.`)) {
        await api.update('laps', rec.dataset.lap, isTrack ? { noTrackRecord: true } : { noPersonalBest: true }); renderResultsPool(box, pool);
      }
      return;
    }
    const b = ev.target.closest('[data-delsession]'); if (!b) return;
    if (confirm(tokenPool ? 'Delete this stint and all of its laps?\n\nThis can\'t be undone.' : 'Delete this session and all of its laps?\n\nThis can\'t be undone.')) { await api.removeSession(b.dataset.delsession); renderResultsPool(box, pool); }
  };  box.onchange = async ev => { // a check box of the View settings bar
    const cb = ev.target;
    if (cb && cb.dataset && (cb.dataset.tyshow !== undefined || cb.dataset.tyworn !== undefined)) { // the tyre stints: shown or not, and the laps on worn out tyres in red (kept for every session)
      const id = cb.dataset.tyshow !== undefined ? cb.dataset.tyshow : cb.dataset.tyworn;
      try { state.settings = await api.setSettings(cb.dataset.tyshow !== undefined ? { tyreStints: !!cb.checked } : { tyreWornRed: !!cb.checked }); } catch { /* the choice is only a look */ }
      state.focusSession = id; return renderResultsPool(box, pool); // (the race stays open where it was)
    }
    if (await viewToggle(cb, colsOf)) { await renderResultsPool(box, pool); viewFocus(box, cb); }
  };
}
