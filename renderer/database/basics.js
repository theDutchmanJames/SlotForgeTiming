// database: the Database tab itself, its sub-tabs, units, table cells, pictures in frames and text limits
// (part of renderer/database.js: loaded just before it by index.html; the parts share the page's global scope)
// Lists, add, edit, delete and extra fields for any kind of item. Everything is driven by schema.js,
// so the Database tab and the Race Setup tab share this code.
const SUBS = [
  ['slotcars', 'Slotcars'],
  ['drivers', 'Drivers'],
  ['tracks', 'Tracks'],
  ['teams', 'Teams'],
  ['results', 'Results and Records']
];
// (2.4.0) the side list: an icon for every section, and a small heading before each group
const SUB_ICONS = { slotcars: 'car', drivers: 'driver', tracks: 'pin', teams: 'users', results: 'star' };
const SUB_GROUPS = { slotcars: 'Your club', results: 'Racing' };
const XTYPES = { text: 'Text', number: 'Number', date: 'Date', list: 'Pick-list' };
const dlg = document.getElementById('dlg');
const byId = id => document.getElementById(id);
let manager = null; // the list currently on screen: { box, e }
let subRun = 0; // numbers the drawings of the lists and of the results: an answer that comes in late never paints over the page that was asked for after it

// Copy saved configurations, never results or live state. Other system editors
// own their copy action because they also rebuild round IDs or clean their drafts.
const COPY_SETUP_ENTITIES = new Set([
  'racesetups',
  'fuelrules',
  'penaltysystems',
  'damagesystems',
  'tyrewearsystems',
  'weathersystems',
  'safetycarsystems',
  'pushsavesystems'
]);
const databaseNameOrder = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
const databaseOrdered = (entity, items) =>
  ['tracks', 'drivers', 'slotcars'].includes(entity)
    ? [...items].sort((a, b) => databaseNameOrder.compare(titleOf(entity, a).trim(), titleOf(entity, b).trim()))
    : items;
function setupCopyData(source, siblings) {
  const data = JSON.parse(JSON.stringify(source));
  delete data.id;
  const base = String(source.name || 'Untitled setup').trim();
  let n = 1,
    name;
  do {
    name = base + (n === 1 ? ' (copy)' : ` (copy ${n})`);
    n++;
  } while (siblings.some(x => databaseNameOrder.compare(String(x.name || '').trim(), name) === 0));
  data.name = name;
  return data;
}

// All countries, named by the system's own region data; flags come from the flag-icons package.
// Codes that are obsolete duplicates or not countries are left out of the picker.
const NOT_COUNTRIES = new Set('AC AN BU CP CS DD DG EA EU EZ FX IC QO SU TA TP UN XA XB YD YU ZR ZZ'.split(' '));
const COUNTRIES = (() => {
  const dn = new Intl.DisplayNames(['en'], { type: 'region' });
  const out = [];
  for (let a = 65; a <= 90; a++)
    for (let b = 65; b <= 90; b++) {
      const c = String.fromCharCode(a, b);
      try {
        const n = dn.of(c);
        if (n && n !== c && !NOT_COUNTRIES.has(c)) out.push([c, n]);
      } catch {
        /* not a region */
      }
    }
  return out.sort((x, y) => x[1].localeCompare(y[1]));
})();
const countryName = c => (COUNTRIES.find(x => x[0] === c) || [, c])[1];
const flagHtml = c => (c ? `<span class="fi fi-${esc(c.toLowerCase())}"></span>` : '');

dlg.onclose = () => {
  dlg.oninput = null;
  dlg.oncancel = null;
  if (manager && document.body.contains(manager.box)) mountManager(manager.box, manager.e);
};

async function renderDatabase(target = view) {
  target.innerHTML = sideShellHtml('Database', 'subtabs', state.sub, SUBS, 'subview');
  await drawSub();
}

async function drawSub() {
  renderTabs(
    byId('subtabs'),
    SUBS,
    state.sub,
    id => {
      if (state.sub === id) return;
      state.sub = id;
      drawSub();
    },
    SUB_ICONS
  );
  sideGroups(byId('subtabs'), SUB_GROUPS);
  const title = byId('subtabs')?.closest?.('.custshell')?.querySelector?.('.sidetitle');
  if (title) title.textContent = (SUBS.find(t => t[0] === state.sub) || SUBS[0])[1];
  const box = byId('subview');
  box.onclick = null;
  box.onchange = null; // (the page that was here before left its click handlers on this element; Results and Records draws in a box inside it and would get them too)
  if (state.sub === 'results') {
    manager = null;
    await renderResults(box);
    return;
  }
  await mountManager(box, state.sub);
}

// 1.27.0: the distance unit (App Settings, General, Display). A field with a unit in the schema is typed in feet or inches when the unit is feet and miles; what is kept stays in metres or millimetres.
const dUnit = () => Speed.distUnitOf(state.settings);
const fl = f => (f.labelFt && dUnit() === 'ft' ? f.labelFt : f.label),
  fh = f => (f.hintFt && dUnit() === 'ft' ? f.hintFt : f.hint);
// the text of the value of a field with a unit as it is shown and typed in feet or inches; null when the field is shown as it is kept
function typedText(f, v) {
  if (!f.unit || dUnit() !== 'ft') return null;
  const one = x => (f.unit === 'mm' ? Speed.smallTyped(x, 'ft') : Speed.lengthTyped(x, 'ft'));
  if (f.type === 'numberlist')
    return String(v ?? '')
      .split(',')
      .map(x => x.trim())
      .map(x => (x !== '' && Number.isFinite(Number(x)) ? String(one(x)) : x))
      .join(', ');
  if (f.type === 'tracklength' || f.type === 'number') {
    const p = f.type === 'tracklength' ? Speed.parseLength(v) : v;
    return p === '' || p === undefined || p === null ? '' : String(one(p));
  }
  return null;
}
// the attributes that let the form give back exactly what was kept when the text was not touched (feet are rounded, so the metres would drift at every save)
const unitAttrs = (f, v) => {
  const t = typedText(f, v);
  return t === null
    ? ''
    : ` data-du="ft" data-shown="${esc(t)}" data-keep="${esc(f.type === 'tracklength' ? Speed.parseLength(v) : (v ?? ''))}"`;
};
// the value to keep for a field that was typed in feet or inches: the text that was not changed gives back what was saved, the rest is converted (a lane length one at a time)
function keptValue(f, el) {
  const txt = String(el.value).trim(),
    shown = String(el.dataset.shown ?? '').trim(),
    keep = el.dataset.keep ?? '';
  if (f.type === 'numberlist') {
    if (txt === shown) return String(keep);
    const was = shown.split(',').map(x => x.trim()),
      kept = String(keep)
        .split(',')
        .map(x => x.trim());
    return ListNum.tidy(txt)
      .split(',')
      .map((x, i) => {
        x = x.trim();
        if (x === '' || !Number.isFinite(Number(x))) return x;
        return x === was[i] && kept[i] !== undefined && kept[i] !== '' ? kept[i] : String(Speed.lengthKept(x, 'ft'));
      })
      .join(', ');
  }
  if (txt === '') return '';
  if (txt === shown) return Number(keep);
  return f.unit === 'mm' ? Speed.smallKept(txt, 'ft') : Speed.lengthKept(txt, 'ft');
}

const plainDate = iso => {
  const d = iso ? new Date(iso) : null;
  return d && !isNaN(d) ? d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '';
}; // (a day, as in the Last Serviced of a slotcar)
function cell(f, v) {
  if (f.blank && (v === undefined || v === null || v === '')) return `<span class="muted">${esc(f.blank)}</span>`;
  if (v === undefined || v === null || v === '') return '';
  if (f.type === 'image') return v?._cataloguePicture ? catalogueImage(v, 'thumb') : `<img class="thumb" src="${esc(v)}" alt="">`;
  if (f.type === 'tracklength')
    return typeof v === 'number' ? esc(Speed.lengthText(v, dUnit())) : Speed.parseLength(v) === '' ? `${esc(v)} m` : esc(v);
  {
    const t = typedText(f, v);
    if (t !== null) return esc(t);
  }
  if (f.type === 'gallery') {
    const count = v?._catalogueGallery || (Array.isArray(v) ? v.length : 0);
    return count ? `${count} more` : '';
  }
  if (f.type === 'country') return flagHtml(v) + ' ' + esc(countryName(v));
  if (f.type === 'longtext') return esc(String(v).slice(0, 60));
  if (f.type === 'datetime') return esc(plainDate(v));
  if (f.type === 'select') return esc((f.options.find(o => o[0] === v) || [, v])[1]);
  if (f.type === 'ref') {
    const r = (state.refs[f.ref] || []).find(x => x.id === v);
    return r ? esc(titleOf(f.ref, r)) : '<span class="muted">(deleted)</span>';
  }
  if (f.type === 'members')
    return Array.isArray(v) && v.length
      ? v
          .map(id => {
            const r = (state.refs[f.ref] || []).find(x => x.id === id);
            return r ? esc(titleOf(f.ref, r)) : '<span class="muted">(deleted)</span>';
          })
          .join(', ')
      : '';
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
    const key = box.dataset && box.dataset.frame;
    if (!key) return;
    const pic = box.querySelector('.framebox'),
      img = box.querySelector('.framebox img'),
      zoom = box.querySelector('.framezoom'),
      reset = box.querySelector('.framereset');
    const show = f => {
      if (img) img.style.transform = Widgets.frameTransform(f);
      if (zoom) zoom.value = f.zoom;
    };
    if (zoom)
      zoom.oninput = () => {
        const f = Widgets.zoomFrame(get(key), Number(zoom.value));
        set(key, f);
        show(f);
      };
    if (reset)
      reset.onclick = () => {
        const f = Widgets.frameOf(null);
        set(key, f);
        show(f);
      };
    if (pic)
      pic.onpointerdown = ev => {
        const r = pic.getBoundingClientRect();
        if (!r.width || !r.height) return;
        let lx = ev.clientX,
          ly = ev.clientY;
        const move = m => {
          const f = Widgets.panFrame(get(key), (m.clientX - lx) / r.width, (m.clientY - ly) / r.height);
          lx = m.clientX;
          ly = m.clientY;
          set(key, f);
          show(f);
        };
        const up = () => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        ev.preventDefault();
      };
  });
}

// What a list/card column shows: a schema field, or a worked-out one written '@name'.
const limitText = i => {
  const laps = n => `${n} ${Number(n) === 1 ? 'lap' : 'laps'}`,
    mins = n => `${n} min`,
    dist = () => (i.distance === '' || i.distance === undefined ? '' : Distance.text(Number(i.distance), Speed.distUnitOf(state.settings))); // (1.35.0: a distance, in metres or feet)
  switch (i.sessionType) {
    case 'race':
      return i.raceBy === 'time'
        ? i.duration === '' || i.duration === undefined
          ? ''
          : mins(i.duration)
        : i.raceBy === 'distance'
          ? dist()
          : i.laps === '' || i.laps === undefined
            ? ''
            : laps(i.laps);
    case 'timed':
    case 'qualifying':
      return i.duration === '' || i.duration === undefined ? '' : mins(i.duration);
    case 'heats':
      return i.heatBy === 'time'
        ? `${mins(i.duration)} per heat`
        : i.heatBy === 'distance'
          ? `${dist()} per heat`
          : `${laps(i.laps)} per heat`;
    case 'endurance':
      return i.enduranceBy === 'heats'
        ? i.heatBy === 'time'
          ? `${mins(i.duration)} per heat`
          : i.heatBy === 'distance'
            ? `${dist()} per heat`
            : `${laps(i.laps)} per heat`
        : i.enduranceBy === 'laps'
          ? i.laps === '' || i.laps === undefined
            ? ''
            : laps(i.laps)
          : i.enduranceBy === 'distance'
            ? dist()
            : i.duration === '' || i.duration === undefined
              ? ''
              : mins(i.duration);
    case 'tokens':
      return 'Paid time per lane';
    default:
      return 'No limit';
  }
};
