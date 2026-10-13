// Lists, add, edit, delete and extra fields for any kind of item. Everything is driven by schema.js,
// so the Database tab and the Race Setup tab share this code.
const SUBS = [['tracks', 'Tracks'], ['drivers', 'Drivers'], ['slotcars', 'Slotcars'], ['results', 'Results and Records']];
const XTYPES = { text: 'Text', number: 'Number', date: 'Date', list: 'Pick-list' };
const dlg = document.getElementById('dlg');
const byId = id => document.getElementById(id);
let manager = null; // the list currently on screen: { box, e }

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

dlg.onclose = () => { dlg.oninput = null; if (manager && document.body.contains(manager.box)) mountManager(manager.box, manager.e); };

async function renderDatabase(target = view) {
  target.innerHTML = '<h2>Database</h2><div class="sub" id="subtabs" role="tablist" style="display:flex;gap:4px"></div><div id="subview"></div>';
  await drawSub();
}

async function drawSub() {
  renderTabs(byId('subtabs'), SUBS, state.sub, id => { state.sub = id; drawSub(); });
  const box = byId('subview');
  if (state.sub === 'results') {
    manager = null;
    await renderResults(box);
    return;
  }
  await mountManager(box, state.sub);
}

function cell(f, v) {
  if (f.blank && (v === undefined || v === null || v === '')) return `<span class="muted">${esc(f.blank)}</span>`;
  if (v === undefined || v === null || v === '') return '';
  if (f.type === 'image') return `<img class="thumb" src="${esc(v)}" alt="">`;
  if (f.type === 'tracklength') return typeof v === 'number' || Speed.parseLength(v) === '' ? `${esc(v)} m` : esc(v);
  if (f.type === 'gallery') return Array.isArray(v) && v.length ? `${v.length} more` : '';
  if (f.type === 'country') return flagHtml(v) + ' ' + esc(countryName(v));
  if (f.type === 'longtext') return esc(String(v).slice(0, 60));
  if (f.type === 'select') return esc((f.options.find(o => o[0] === v) || [, v])[1]);
  if (f.type === 'ref') { const r = (state.refs[f.ref] || []).find(x => x.id === v); return r ? esc(titleOf(f.ref, r)) : '<span class="muted">(deleted)</span>'; }
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
  const laps = n => `${n} ${Number(n) === 1 ? 'lap' : 'laps'}`, mins = n => `${n} min`;
  switch (i.sessionType) {
    case 'race': return i.laps === '' || i.laps === undefined ? '' : laps(i.laps);
    case 'timed': case 'qualifying': return i.duration === '' || i.duration === undefined ? '' : mins(i.duration);
    case 'heats': return i.heatBy === 'time' ? `${mins(i.duration)} per heat` : `${laps(i.laps)} per heat`;
    case 'tokens': return 'Paid time per lane';
    default: return 'No limit';
  }
};
const VIRTUAL = { limit: { label: 'Laps / time', get: limitText } };
const columnOf = (s, k) => k[0] === '@' ? { key: k, label: VIRTUAL[k.slice(1)].label, virtual: VIRTUAL[k.slice(1)] } : s.fields.find(f => f.key === k);
const columnCell = (f, i) => f.virtual ? esc(f.virtual.get(i)) : cell(f, i[f.key]);

// ---- folders: the pages that list things in folders (Results and Records, Race Setups) look like the groups of the forms ----
// A folder is open unless the person closed it; that is remembered while the app runs (key: page + folder), also when the page is drawn again.
const folderClosed = new Set();
const folderKey = (page, id) => page + ':' + id;
const folderHtml = (page, id, title, note, body) => `<details class="dbfolder" data-folder="${esc(folderKey(page, id))}"${folderClosed.has(folderKey(page, id)) ? '' : ' open'}><summary><strong>${esc(title)}</strong> <span class="muted">${esc(note)}</span></summary>${body}</details>`;
const folderTools = `<div class="fgtools"><button class="btn" type="button" data-folderall="1">Open all</button><button class="btn" type="button" data-folderall="0">Close all</button></div>`;
const folderWire = (box, after) => typeof box.querySelectorAll === 'function' && box.querySelectorAll('details.dbfolder').forEach(el => { el.ontoggle = () => { if (el.open) folderClosed.delete(el.dataset.folder); else folderClosed.add(el.dataset.folder); if (after) after(el); }; });
const folderAll = (page, ids, open) => ids.forEach(id => { if (open) folderClosed.delete(folderKey(page, id)); else folderClosed.add(folderKey(page, id)); });
// The Export to PDF button: it fills with the accent colour and has a picture of a page, so it is the first thing the eye finds (Results and Records, Racing Rules)
const pdfButton = attrs => `<button class="btn primary pdfbtn" type="button" ${attrs}>${Icons.svg('pdf', { size: 18 })}<span>Export to PDF</span></button>`;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

async function mountManager(box, e) {
  manager = { box, e };
  const s = state.schema[e];
  const [items, custom] = await Promise.all([api.list(e), s.extra === false ? [] : api.customFields(e)]);
  state.custom[e] = custom;
  for (const f of s.fields) if (f.type === 'ref') state.refs[f.ref] = await api.list(f.ref);
  const cols = s.list
    ? s.list.map(k => columnOf(s, k)).map(f => ({ label: f.label, get: i => columnCell(f, i) }))
    : [
      ...s.fields.map(f => ({ label: f.label, get: i => cell(f, i[f.key]) })),
      ...custom.map(f => ({ label: f.label, get: i => esc((i.custom || {})[f.id] ?? '') }))
    ];
  const viewKey = e === 'racesetups' ? 'setupView' : 'dbView'; // Race Setups remembers its own list / grid choice
  const mode = s.card ? (state.settings[viewKey] || 'list') : 'list';
  const toggle = !s.card ? '' : `<span class="seg" role="group" aria-label="View"><button class="btn${mode === 'list' ? ' on' : ''}" id="vlist" aria-pressed="${mode === 'list'}">List</button><button class="btn${mode === 'grid' ? ' on' : ''}" id="vgrid" aria-pressed="${mode === 'grid'}">Grid</button></span>`;
  const hue = t => { let n = 0; for (const ch of t) n = (n * 31 + ch.charCodeAt(0)) % 360; return `hsl(${n} 45% 40%)`; };
  const gridHtml = (items, skip) => `<div class="cards">${items.map(i => {
    // the picture: the item's own, or (race setups) the picture of the track it uses; each with its own framing
    let img = s.image && i[s.image], frame = s.image && i[s.image + 'Frame'];
    if (s.imageFrom) {
      const rf = s.fields.find(x => x.key === s.imageFrom), tr = (state.refs[rf.ref] || []).find(x => x.id === i[rf.key]), re = state.schema[rf.ref];
      img = tr && re.image && tr[re.image]; frame = tr && re.image && tr[re.image + 'Frame'];
    }
    const t = titleOf(e, i);
    const details = s.card.filter(k => k !== skip).map(k => {
      const f = columnOf(s, k), v = f.virtual ? f.virtual.get(i) : i[k];
      return v === undefined || v === null || v === '' ? '' : `<div class="gd"><span class="muted">${esc(f.label)}</span> ${columnCell(f, i)}</div>`;
    }).join('') + (s.gallery && Array.isArray(i[s.gallery]) && i[s.gallery].length ? `<div class="gd muted">+${i[s.gallery].length} more ${i[s.gallery].length === 1 ? 'picture' : 'pictures'}</div>` : '');
    return `<article class="gcard"><div class="gimg">${img ? `<img src="${esc(img)}" alt="" style="transform:${Widgets.frameTransform(frame)}">` : `<span class="ph" style="background:${hue(t)}">${esc((t.trim()[0] || '?').toUpperCase())}</span>`}</div>
      <h3>${esc(t)}</h3>${details}<div class="row"><button class="btn" data-edit="${esc(i.id)}">Edit</button><button class="btn danger" data-del="${esc(i.id)}">Delete</button></div></article>`;
  }).join('')}</div>`;
  const tableHtml = (items, cols) => `<div class="wrap"><table class="fields"><tr>${cols.map(c => `<th>${esc(c.label)}</th>`).join('')}<th></th></tr>` +
    items.map(i => `<tr>${cols.map(c => `<td>${c.get(i)}</td>`).join('')}<td class="actions">
      <button class="btn" data-edit="${esc(i.id)}">Edit</button> <button class="btn danger" data-del="${esc(i.id)}">Delete</button></td></tr>`).join('') + '</table></div>';
  // Race setups: one folder for each session type, with the setups of that type (a type without setups has no folder; a setup of a type that is not in the list goes in Other, so none is lost).
  // The session type is the folder, so it is not repeated in the list or on the cards.
  const folders = e !== 'racesetups' || !items.length ? null : (() => {
    const types = s.fields.find(f => f.key === 'sessionType').options.map(([id, label]) => ({ id, label, list: items.filter(i => i.sessionType === id) }));
    const other = items.filter(i => !types.some(t => t.id === i.sessionType));
    return [...types, { id: '_other', label: 'Other', list: other }].filter(t => t.list.length);
  })();
  const folderCols = !folders ? null : (s.list || []).filter(k => k !== 'sessionType').map(k => columnOf(s, k)).map(f => ({ label: f.label, get: i => columnCell(f, i) }));
  box.innerHTML = `<div class="row"><button class="btn primary" id="add">Add ${esc(s.label.toLowerCase())}</button>
      ${s.extra === false ? '' : '<button class="btn" id="extra">Extra fields…</button>'}${toggle}</div>` +
    (folders ? (folders.length > 1 ? folderTools : '') + folders.map(t => folderHtml('setups', t.id, t.label, plural(t.list.length, 'race setup', 'race setups'), mode === 'grid' ? gridHtml(t.list, 'sessionType') : tableHtml(t.list, folderCols))).join('')
      : items.length && mode === 'grid' ? gridHtml(items)
      : items.length ? tableHtml(items, cols)
      : `<p class="muted">No ${esc(s.plural.toLowerCase())} yet. Use the button above to add one.</p>`);
  if (folders) folderWire(box);
  box.onclick = async ev => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.folderall) { folderAll('setups', folders.map(t => t.id), b.dataset.folderall === '1'); return mountManager(box, e); }
    if (b.id === 'add') return openForm(e, null);
    if (b.id === 'extra') return openExtra(e);
    if (b.id === 'vgrid' || b.id === 'vlist') { state.settings = await api.setSettings({ [viewKey]: b.id === 'vgrid' ? 'grid' : 'list' }); return mountManager(box, e); }
    const it = items.find(i => i.id === (b.dataset.edit || b.dataset.del));
    if (b.dataset.edit) openForm(e, it);
    else if (b.dataset.del) {
      const n = s.linked === false ? 0 : await api.linkedLaps(e, it.id);
      const extra = s.linked === false ? '' : `\n\nThis also deletes ${n} saved ${n === 1 ? 'lap' : 'laps'} and the records they hold.`;
      if (!confirm(`Delete "${titleOf(e, it)}"?${extra}\n\nThis can't be undone.`)) return;
      await api.remove(e, it.id);
      mountManager(box, e);
    }
  };
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
const calcRows = pieces => pieces.map((p, i) => `<div class="calcrow"><input type="number" min="0" step="1" class="calc-count" data-i="${i}" value="${esc(p.count)}" aria-label="Number of pieces"> &times;
  <input type="number" min="0" step="any" class="calc-mm" data-i="${i}" value="${esc(p.mm)}" aria-label="Length of one piece in millimetres"> mm <button type="button" class="btn" data-calcdel="${i}">Remove</button></div>`).join('');
const calcHtml = pieces => `<p class="muted">Number of pieces &times; length of one piece. Add a row for every kind of piece.</p><div id="calc-rows">${calcRows(pieces)}</div>
  <div class="row"><button type="button" class="btn" data-calcadd="1">Add another piece type</button> <strong id="calc-total">${Speed.lengthFromPieces(pieces)} m</strong>
  <button type="button" class="btn primary" data-calcuse="1">Use this length</button></div>`;

function fieldHtml(f, v, extra) {
  const id = 'f-' + f.id;
  const lab = `<label for="${id}">${esc(f.label)}${f.optional ? ' <span class="muted">(optional)</span>' : ''}</label>`;
  let inp;
  switch (f.type) {
    case 'longtext': inp = `<textarea id="${id}" rows="3">${esc(v)}</textarea>`; break;
    case 'number': inp = `<input id="${id}" type="number" step="${f.step || 'any'}"${f.min !== undefined ? ` min="${f.min}"` : ''} value="${esc(v)}">`; break;
    case 'date': inp = `<input id="${id}" type="date" value="${esc(v)}">`; break;
    case 'choice': inp = `<input id="${id}" list="${id}-l" value="${esc(v)}"><datalist id="${id}-l">${f.options.map(o => `<option value="${esc(o)}">`).join('')}</datalist>`; break;
    case 'list': inp = `<select id="${id}"><option value=""></option>${f.options.map(o => `<option${o === v ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`; break;
    case 'select': inp = `<select id="${id}">${f.options.map(([k, l]) => `<option value="${esc(k)}"${k === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`; break;
    case 'ref': inp = `<select id="${id}"><option value="">${esc(f.blank || '(none)')}</option>${(state.refs[f.ref] || []).map(r => `<option value="${esc(r.id)}"${r.id === v ? ' selected' : ''}>${esc(titleOf(f.ref, r))}</option>`).join('')}</select>`; break;
    case 'country': inp = `<select id="${id}"><option value=""></option>${COUNTRIES.map(([c, n]) => `<option value="${c}"${c === v ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select><span id="${id}-flag">${flagHtml(v)}</span>`; break;
    case 'tracklength': inp = `<div class="imgrow"><input id="${id}" type="number" min="0" step="any" value="${esc(Speed.parseLength(v))}"> <span>metres</span>
      <button type="button" class="btn" data-calcopen="1">Calculate from track pieces…</button></div><div id="calc" class="card" hidden>${calcHtml((extra && extra.pieces) || [])}</div>`; break;
    case 'penaltytypes': inp = `<p class="muted">Penalties the Race Director can give instead of leaving points to turn into time. One costs points, and must be served by stopping on the sensor in the pits. A Stop-and-Go needs the car to stand still for its seconds; a Drivethrough is served when the pit stop starts.</p><div id="pt-box">${ptRows((extra && extra.types) || [])}</div><button type="button" class="btn" data-ptadd="1">Add a special penalty</button>`; break;
    case 'gallery': inp = `<div id="gal-box" class="gallery"></div><input id="${id}" type="file" accept="image/*" multiple data-gallery="1"><p class="muted">Up to ${GALLERY_MAX} extra pictures. A screenshot of a parts list is fine.</p>`; break;
    case 'image': inp = `<div class="imgrow"><img id="${id}-img" class="thumb" ${v ? `src="${esc(v)}"` : 'hidden'} alt=""><input id="${id}" type="file" accept="image/*"><button type="button" class="btn" data-clear="${f.id}">Remove</button></div>`; break;
    default: inp = `<input id="${id}" type="text"${f.maxLength ? ` maxlength="${f.maxLength}"` : ''} value="${esc(v)}">`;
  }
  if (f.automatic) inp = `<input id="${id}" type="number" value="${esc(v ?? 0)}" disabled>`;
  const wide = ['longtext', 'gallery', 'tracklength', 'image', 'penaltytypes'].includes(f.type) ? ' full' : '';
  return `<div class="field${wide}" data-key="${f.id}">${lab}${inp}${f.hint ? `<span class="muted hint">${esc(f.hint)}</span>` : ''}</div>`;
}

// A field with showIf is shown when any one of its conditions matches the current form values.
const isShown = (f, get) => !f.showIf || f.showIf.some(c => Object.entries(c).every(([k, vs]) => vs.includes(get(k))));

// Pictures are shrunk before saving so the database file stays small.
function resizeImage(file, max = 256, png = false) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const g = c.getContext('2d');
      if (!png) { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); } // pictures with transparency stay transparent as PNG
      g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(png ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error('That file is not a picture.'));
    img.src = url;
  });
}

const GALLERY_MAX = 12;

// the groups of fields that are open in the form of each kind of item (kept while the app is open); a kind of item without groups has one flat list
const formOpen = {};

function openForm(e, item) {
  const s = state.schema[e];
  const fields = [...s.fields.map(f => ({ ...f, id: f.key, custom: false })), ...(state.custom[e] || []).map(f => ({ ...f, custom: true }))];
  // a track saved before the lane length modifier shows what it always did: calculated as a loop (or what version 0.60.0's track shape said)
  const val = f => f.custom ? (item?.custom || {})[f.id] : item ? (e === 'tracks' && f.key === 'laneModifier' ? Speed.modifier(item) : e === 'tracks' && f.key === 'netTurns' && item.netTurns === undefined ? f.default : item[f.key]) : f.default;
  const imgs = {}, frames = {}, mainKey = s.image;
  let pieces = ((item && item.lengthPieces) || []).map(p => ({ count: p.count, mm: p.mm }));
  if (!pieces.length) pieces = [{ count: '', mm: 200 }];
  let types = Array.isArray(item && item.types) ? item.types.map(t => ({ ...t })) : (item ? [] : PT_DEFAULTS.map(t => ({ ...t })));
  let gal = Array.isArray(item && item[s.gallery]) ? [...item[s.gallery]] : [], galSel = null;
  fields.filter(f => f.type === 'image').forEach(f => { imgs[f.id] = val(f) || ''; if (!f.custom) frames[f.id] = Widgets.frameOf(item && item[f.key + 'Frame']); });
  const frameBlock = f => f.type === 'image' && !f.custom ? `<div class="field frame full" id="frame-${f.id}" data-frame="${f.id}">${frameInner(imgs[f.id], frames[f.id], '4 / 3', false)}</div>` : '';
  const redrawFrame = key => { byId('frame-' + key).innerHTML = frameInner(imgs[key], frames[key], '4 / 3', false); attachFrames(dlg, k => frames[k], (k, f) => { frames[k] = f; }); };
  const one = f => fieldHtml(f, val(f), { pieces, types }) + frameBlock(f);
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
  if (groups) dlg.querySelectorAll('.fgroup').forEach(el => { el.ontoggle = () => { const g = el.dataset.fg; if (el.open) opened.add(g); else opened.delete(g); }; }); // remembered for the next time the form opens
  attachFrames(dlg, k => frames[k], (k, f) => { frames[k] = f; });
  dlg.onclick = ev => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.id === 'cancel') dlg.close();
    const d = b.dataset || {};
    if (d.fgall !== undefined && groups) { // open or close every group
      opened.clear(); if (d.fgall === '1') groups.forEach(g => opened.add(g.id));
      dlg.querySelectorAll('.fgroup').forEach(el => { el.open = d.fgall === '1'; }); return;
    }
    if (d.ptadd) { types.push({ name: '', kind: 'stopgo', seconds: 5, cost: 5, extra: 1, unserved: 10 }); byId('pt-box').innerHTML = ptRows(types); return; }
    if (d.ptdel !== undefined) { types.splice(Number(d.ptdel), 1); byId('pt-box').innerHTML = ptRows(types); return; }
    if (d.calcopen) { byId('calc').hidden = !byId('calc').hidden; return; }
    if (d.calcadd) { pieces.push({ count: '', mm: pieces.length ? pieces[pieces.length - 1].mm : 200 }); byId('calc-rows').innerHTML = calcRows(pieces); byId('calc-total').textContent = Speed.lengthFromPieces(pieces) + ' m'; return; }
    if (d.calcdel !== undefined) { pieces.splice(Number(d.calcdel), 1); if (!pieces.length) pieces.push({ count: '', mm: 200 }); byId('calc-rows').innerHTML = calcRows(pieces); byId('calc-total').textContent = Speed.lengthFromPieces(pieces) + ' m'; return; }
    if (d.calcuse) { const t = Speed.lengthFromPieces(pieces); if (t > 0) byId('f-length').value = t; return; }
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
    if (t && t.dataset && t.dataset.pt !== undefined) { const ty = types[Number(t.dataset.pt)]; if (ty) ty[t.dataset.ptk] = t.value; return; }
    const c = t && t.classList && t.dataset && t.dataset.i !== undefined;
    if (!c) return;
    const p = pieces[Number(t.dataset.i)]; if (!p) return;
    if (t.className.includes('calc-count')) p.count = t.value; else if (t.className.includes('calc-mm')) p.mm = t.value;
    byId('calc-total').textContent = Speed.lengthFromPieces(pieces) + ' m';
  };
  dlg.onchange = async ev => {
    const t = ev.target;
    refreshShown();
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
  byId('frm').onsubmit = async ev => {
    ev.preventDefault();
    const built = {}, custom = { ...(item?.custom || {}) };
    for (const f of fields) {
      if (f.automatic) { if (!item) built[f.key] = 0; continue; }
      if (f.type === 'gallery') { built[f.key] = [...gal]; continue; }
      if (f.type === 'penaltytypes') { built[f.key] = types.filter(t => String(t.name || '').trim()).map(t => ({ name: String(t.name).trim(), kind: t.kind === 'drivethrough' ? 'drivethrough' : 'stopgo', seconds: Number(t.seconds) || 0, cost: Number(t.cost) || 0, extra: Number(t.extra) || 0, unserved: Number(t.unserved) || 0 })); continue; }
      const el = byId('f-' + f.id);
      let v;
      if (f.type === 'image') { v = imgs[f.id]; if (!f.custom) built[f.key + 'Frame'] = v ? frames[f.id] : null; }
      else if (f.type === 'number' || f.type === 'tracklength') v = el.value === '' ? '' : Number(el.value);
      else { v = el.value.trim(); if (f.uppercase) v = v.toUpperCase(); }
      if (f.type === 'numberlist' && isShown(f, getValue) && !/^\s*\d+(\.\d+)?(\s*,\s*\d+(\.\d+)?)*\s*$/.test(v)) {
        byId('err').textContent = 'Please enter numbers separated by commas, for example 10, 8, 6.';
        return;
      }
      if (f.type === 'tracklength') { // keep the pieces only while they still add up to the length
        const used = pieces.filter(p => Number(p.count) > 0 && Number(p.mm) > 0).map(p => ({ count: Number(p.count), mm: Number(p.mm) }));
        built.lengthPieces = used.length && Speed.lengthFromPieces(used) === v ? used : [];
      }
      if (f.custom) custom[f.id] = v; else built[f.key] = v;
    }
    if (e === 'tracks' && built.laneModifier === 'measured') { // one length for every lane
      const list = String(built.laneLengths || '').split(',').map(x => x.trim()).filter((x, i, a) => x !== '' || i < a.length - 1), n = Number(built.lanes);
      if (list.length !== n || list.some(x => !(Number(x) > 0))) {
        byId('err').textContent = `Please enter the length of every lane: ${n} numbers above 0, separated by commas (you entered ${list.filter(x => Number(x) > 0).length}).`;
        return;
      }
    }
    if (!s.title.some(k => String(built[k] ?? '').length)) {
      byId('err').textContent = 'Please fill in ' + s.title.map(k => s.fields.find(f => f.key === k).label).join(' or ') + '.';
      return;
    }
    await (item ? api.update(e, item.id, { ...built, custom }) : api.add(e, { ...built, custom }));
    dlg.close();
  };
  dlg.showModal();
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
const SESSION_LABEL = { practice: 'Free practice', qualifying: 'Qualifying', race: 'Race by laps', timed: 'Timed race', heats: 'Heat-based race', tokens: 'Time Token Session' };

// The page has two pools that never mix: Racing Records (everything raced) and Token Records (the stints of Time Token Sessions, with their own records).
async function renderResults(box) {
  manager = null;
  const pool = state.resultsSub === 'tokens' ? 'tokens' : 'racing';
  box.innerHTML = '<div class="sub" id="respool" role="tablist" style="display:flex;gap:4px"></div><div id="resbody"></div>';
  renderTabs(byId('respool'), [['racing', 'Racing Records'], ['tokens', 'Token Records']], pool, id => { state.resultsSub = id; renderResults(box); });
  await renderResultsPool(byId('resbody'), pool);
}
// time bought for a stint: "10 min", "1 min 30 s", "45 s"
const boughtText = ms => { const sec = Math.round(Number(ms) / 1000); if (!Number.isFinite(sec)) return ''; const m = Math.floor(sec / 60), s = sec % 60; return !s ? `${m} min` : m ? `${m} min ${s} s` : `${s} s`; };

async function renderResultsPool(box, pool) {
  const tokenPool = pool === 'tokens';
  const [allSessions, allLaps, drivers, cars, tracks] = await Promise.all(['sessions', 'laps', 'drivers', 'slotcars', 'tracks'].map(x => api.list(x)));
  const sessions = allSessions.filter(x => (x.sessionType === 'tokens') === tokenPool), laps = allLaps.filter(l => !!l.token === tokenPool); // (the two pools never mix)
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
  const recRow = kind => l => `<tr><td>${esc(name(tracks, l.trackId, 'tracks'))}</td><td>${esc(name(drivers, l.driverId, 'drivers'))}</td>
    <td><strong>${esc(RaceEngine.fmtTime(l.time))}</strong></td><td>${esc(name(cars, l.carId, 'slotcars'))}</td><td>${esc(dateText(l.date))}</td>
    <td class="actions"><button class="btn danger" data-delrec="${kind}" data-lap="${esc(l.id)}">Remove</button></td></tr>`;
  const head = '<tr><th>Track</th><th>Driver</th><th>Lap time</th><th>Car</th><th>Set on</th><th></th></tr>';
  const byTrack = (a, b) => name(tracks, a.trackId, 'tracks').localeCompare(name(tracks, b.trackId, 'tracks')) || a.time - b.time;
  const trackRecords = best(l => l.trackId, 'noTrackRecord').sort(byTrack);
  const personal = best(l => l.trackId + '|' + l.driverId, 'noPersonalBest').sort(byTrack);

  const recTable = (list, kind) => list.length ? `<div class="wrap"><table class="fields">${head}${list.map(recRow(kind)).join('')}</table></div>` : '<p class="muted">None yet.</p>';
  const sessionCards = [...sessions].reverse().map(s => {
    const win = s.standings[0];
    if (tokenPool) { // a stint: one driver, one lane, one paid time
      const x = win || {}, t = s.token || {}, mine = laps.filter(l => l.sessionId === s.id).sort((a, b) => a.lapNumber - b.lapNumber);
      const body = `<table class="fields"><tr><th>Driver</th><th>Car</th><th>Lane</th><th>Time bought</th><th>Laps</th><th>Late laps</th><th>Best lap</th><th>Total time</th></tr>
        <tr><td>${esc(x.driverName)}</td><td>${esc(x.carName)}</td><td>${esc(t.lane)}</td><td>${esc(boughtText(t.bought))}</td><td>${esc(x.laps)}</td><td>${esc(x.lateLaps || 0)}</td><td>${esc(RaceEngine.fmtTime(x.best))}</td><td>${esc(RaceEngine.fmtTime(x.total))}</td></tr></table>
        <p class="muted">${esc(s.endedBy || '')}${t.carried ? ` · ${esc(boughtText(t.carried))} came over from the driver before` : ''}${t.left ? ` · ${esc(boughtText(t.left))} was not used` : ''}</p>
        <h4>All lap times</h4><p><span class="muted">${mine.map(l => { const tx = esc(`${l.lapNumber}: ${RaceEngine.fmtTime(l.time)}`); return l.late || l.invalid || l.tooSlow ? `<s class="lapbad" title="${l.late ? 'Late lap: driven after the time was up' : l.invalid ? 'Invalid lap' : 'Too slow: not counted for records'}">${tx}</s>` : tx; }).join(' · ') || 'no laps'}</span></p>
        <div class="row">${pdfButton(`data-pdf="${esc(s.id)}"`)}<button class="btn danger" data-delsession="${esc(s.id)}">Delete this stint</button><span class="muted" id="pdfmsg-${esc(s.id)}" role="status"></span></div>`;
      return `<details class="card sess"><summary>${esc(dateText(s.date))} · Lane ${esc(t.lane)} · ${esc(x.driverName)} · ${esc(boughtText(t.bought))} · ${esc(x.laps)} ${Number(x.laps) === 1 ? 'lap' : 'laps'} · ${esc(s.trackName || '')}</summary><div class="sessbody">${body}</div></details>`;
    }
    const pts = s.resultBy === 'points';
    const res = s.sessionType === 'heats' && !!s.scoring && s.standings.some(x => x.score !== undefined); // a result that is not just all heats added up
    const fin = s.sessionType === 'heats' && !!s.finals, finArg = { finalMode: fin ? s.finals.finalMode : 'places', byPoints: pts };
    const body = `<table class="fields"><tr><th>Pos</th><th>Driver</th><th>Car</th><th>Laps</th>${pts ? '<th>Points</th>' : ''}${res ? '<th>Result</th>' : ''}${fin ? '<th>Final</th>' : ''}<th>Best lap</th>${s.sessionType === 'heats' ? '' : '<th>Total time</th>'}</tr>` +
      s.standings.map(x => `<tr><td>${esc(x.pos)}</td><td>${esc(x.driverName)}${x.dq ? ' <span class="muted">(disqualified)</span>' : x.retired ? ' <span class="muted">(retired, out of fuel)</span>' : ''}</td><td>${esc(x.carName)}</td><td>${esc(x.laps)}</td>${pts ? `<td>${esc(x.points)}</td>` : ''}${res ? `<td>${esc(Heats.scoreText(x, s.scoring, finArg))}</td>` : ''}${fin ? `<td>${esc(Heats.finalCell(x))}</td>` : ''}<td>${esc(RaceEngine.fmtTime(x.best))}</td>${s.sessionType === 'heats' ? '' : `<td>${esc(RaceEngine.fmtTime(x.total + (x.penalty || 0)))}${x.penalty ? ` <span class="muted">(includes +${esc(RaceEngine.fmtTime(x.penalty))} penalty, ${esc(x.penaltyPoints)} points)</span>` : ''}</td>`}</tr>`).join('') + '</table>' +
      (s.sessionType === 'heats' && s.scoring && Heats.scoringText(s.scoring, pts) ? `<p class="muted">${esc(Heats.scoringText(s.scoring, pts))}</p>` : '') + (fin ? `<p class="muted">${esc(Heats.finalsSaid(s.finals))}</p>` : '') +
      (s.heatResults ? `<h4>${s.finals ? 'Heats and finals' : 'Heats'}</h4>` + s.heatResults.map(h => `<p><strong>${esc(Heats.raceName(h))}</strong><br><span class="muted">${h.rows.map(r => `${esc(r.pos)}. ${esc(r.driverName)} (${esc(r.laps)} laps${pts ? ', ' + esc(r.points) + ' pts' + (r.bonus ? ' incl. ' + esc(r.bonus) + ' for the fastest lap' : '') : ''})`).join(' · ')}</span></p>`).join('') : '') +
      '<h4>All lap times</h4>' + s.standings.map(x => {
        const mine = laps.filter(l => l.sessionId === s.id && l.driverId === x.driverId).sort((a, b) => (a.heat || 0) - (b.heat || 0) || a.lapNumber - b.lapNumber);
        return `<p><strong>${esc(x.driverName)}</strong><br><span class="muted">${mine.map(l => { const t = esc(`${l.heat ? (l.final ? 'F' + l.final : 'H' + l.heat) + ' ' : ''}${l.lapNumber}: ${RaceEngine.fmtTime(l.time)}`); return l.invalid || l.tooSlow ? `<s class="lapbad" title="${l.invalid ? 'Invalid lap' : 'Too slow: not counted for records'}">${t}</s>` : t; }).join(' · ') || 'no laps'}</span></p>`;
      }).join('') + `<div class="row">${pdfButton(`data-pdf="${esc(s.id)}"`)}<button class="btn danger" data-delsession="${esc(s.id)}">Delete this session</button><span class="muted" id="pdfmsg-${esc(s.id)}" role="status"></span></div>`;
    return `<details class="card sess"><summary>${esc(dateText(s.date))} · ${esc(s.setupName)} · ${esc(SESSION_LABEL[s.sessionType] || '')} · ${esc(s.trackName || '')}${win ? ' · Winner: ' + esc(win.driverName) : ''}</summary><div class="sessbody">${body}</div></details>`;
  }).join('');
  const RES_FOLDERS = ['tracks', 'pb', 'sessions'];
  box.innerHTML = folderTools + folderHtml(folderPage, 'tracks', 'Track records', plural(trackRecords.length, 'record', 'records'), recTable(trackRecords, 'track'))
    + folderHtml(folderPage, 'pb', 'Personal bests', plural(personal.length, 'personal best', 'personal bests'), recTable(personal, 'pb'))
    + folderHtml(folderPage, 'sessions', tokenPool ? 'Stints' : 'Sessions', tokenPool ? plural(sessions.length, 'stint', 'stints') : plural(sessions.length, 'session', 'sessions'), sessionCards);
  folderWire(box);
  box.onclick = async ev => {
    const fa = ev.target.closest('[data-folderall]');
    if (fa) { folderAll(folderPage, RES_FOLDERS, fa.dataset.folderall === '1'); return renderResultsPool(box, pool); }
    const p = ev.target.closest('[data-pdf]');
    if (p) {
      const s = sessions.find(x => x.id === p.dataset.pdf), msg = byId('pdfmsg-' + s.id);
      msg.textContent = 'Making the PDF...';
      try {
        const res = await api.exportPdf(Report.sessionHtml({ session: s, laps: laps.filter(l => l.sessionId === s.id) }), Report.fileName(s));
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
  };
}
