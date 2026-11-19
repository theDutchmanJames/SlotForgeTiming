// database: what the buttons and menus of the Garage lists do (2.4.0, SlotForgeRestyle.md "Garage"): the looks of a car kept by Timing (its livery colours and its
// service log, for a car of the shared library too), mark serviced, duplicate, archive, a race class for many cars at once, retire a driver, merge two drivers,
// and a club list of drivers read from a CSV file.
// (part of renderer/database.js: loaded just before it by index.html; the parts share the page's global scope)

// ---- the looks of a car: settings.garage.cars[id] = { colors: ['#rrggbb', …], log: [{ date, note, laps }] } ----
const GarageLooks = {
  of(id) {
    const g = state.settings && state.settings.garage;
    return (g && g.cars && g.cars[id]) || {};
  },
  async set(id, patch) {
    const g = (state.settings && state.settings.garage) || {},
      cars = { ...(g.cars || {}) };
    const next = { ...(cars[id] || {}), ...patch };
    if (Array.isArray(next.colors) && !next.colors.length) delete next.colors;
    if (Array.isArray(next.log) && !next.log.length) delete next.log;
    if (Object.keys(next).length) cars[id] = next;
    else delete cars[id];
    state.settings = await api.setSettings({ garage: { ...g, cars } });
  },
  async log(id, entry) {
    await GarageLooks.set(id, { log: Garage.logAdd(GarageLooks.of(id).log, { date: new Date().toISOString(), ...entry }) });
  }
};
// the lane colours as swatches (the field type 'color' of a form, and the livery of a car): a click sets the hidden box, and tells the form it changed
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('click', ev => {
    const b = ev.target && ev.target.closest && ev.target.closest('[data-swatch]');
    if (!b) return;
    const box = document.getElementById(b.dataset.for);
    if (!box) return;
    box.value = b.dataset.swatch;
    b.parentElement.querySelectorAll('[data-swatch]').forEach(x => {
      x.classList.toggle('on', x === b);
      x.setAttribute('aria-pressed', String(x === b));
    });
    box.dispatchEvent(new Event('input', { bubbles: true }));
    box.dispatchEvent(new Event('change', { bubbles: true }));
  });
  document.addEventListener('input', ev => {
    const own = ev.target && ev.target.matches && ev.target.matches('[data-swatch-own]') ? ev.target : null;
    if (!own) return;
    const box = document.getElementById(own.dataset.for);
    if (!box) return;
    box.value = own.value;
    own.parentElement.querySelectorAll('[data-swatch]').forEach(x => {
      x.classList.remove('on');
      x.setAttribute('aria-pressed', 'false');
    });
    box.dispatchEvent(new Event('input', { bubbles: true }));
    box.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

// a small window of the app with a title, words, a body and buttons; resolves with the button pressed (its value) or null
function garageAsk({ title, lead = '', body = '', ok = 'OK', okDanger = false, read = () => true }) {
  return new Promise(resolve => {
    const d = document.createElement('dialog');
    d.className = 'appdlg gx-ask';
    d.innerHTML = `<h3>${esc(title)}</h3><div class="appdlg-body">${lead ? `<p>${esc(lead)}</p>` : ''}${body}</div><p class="error" data-err role="alert"></p><div class="row appdlg-buttons"><button type="button" class="btn" data-no>Cancel</button><button type="button" class="btn ${okDanger ? 'danger' : 'primary'}" data-ok>${esc(ok)}</button></div>`;
    document.body.appendChild(d);
    const done = v => {
      d.close();
      d.remove();
      resolve(v);
    };
    d.querySelector('[data-no]').onclick = () => done(null);
    d.querySelector('[data-ok]').onclick = () => {
      const v = read(d);
      if (v === false || v === undefined) return;
      if (typeof v === 'string' && v.startsWith('!')) {
        d.querySelector('[data-err]').textContent = v.slice(1);
        return;
      }
      done(v);
    };
    d.addEventListener('cancel', ev => {
      ev.preventDefault();
      done(null);
    });
    d.showModal();
    (d.querySelector('select,input') || d.querySelector('[data-ok]')).focus();
  });
}

// ---- cars ----
// a car of the shared library: its record, revision and service counters (the editor's own reading)
const libraryRead = id => api.libraryCar(id);
async function librarySaveOne(id, action, delta = {}) {
  const loaded = await libraryRead(id),
    { schema, car } = loaded;
  if (!car) throw Error('This car is no longer in the library.');
  const r = await api.librarySave({
    databaseId: schema.databaseId,
    recoveryId: schema.recoveryId,
    action,
    carId: car.id,
    expectedRevision: car.revision,
    ...delta
  });
  if (r.state !== 'committed') throw Error(r.error || 'The library has not applied it yet. Check Save history before trying again.');
  return r;
}
// mark a car serviced: the laps since the last service start again at 0, the day is today, one more service; a line in its service log
async function garageServiced(e, item, direct, note = '') {
  let before = CarStats.sinceOf(item);
  if (direct) {
    const loaded = await libraryRead(item.id);
    if (!loaded.service || !api.libraryService) throw Error('This library does not keep service counters.');
    before = Number(loaded.service.service.lapsSinceService) || 0;
    const r = await api.libraryService({
      databaseId: loaded.schema.databaseId,
      recoveryId: loaded.schema.recoveryId,
      carId: loaded.car.id,
      expectedCarRevision: loaded.car.revision,
      expectedRevision: loaded.service.service.revision,
      action: 'reset'
    });
    if (r.state !== 'committed') throw Error(r.error || 'The service is not saved yet. Check Save history before trying again.');
  } else
    await api.update(e, item.id, {
      lapsSinceService: 0,
      serviceDate: new Date().toISOString(),
      servicesDone: CarStats.servicesOf(item) + 1
    });
  await GarageLooks.log(item.id, { note, laps: before });
}
// a race class for many cars at once (or none)
async function garageSetClass(e, items, direct) {
  const classes = state.refs.raceclasses || [];
  const v = await garageAsk({
    title: `Race class for ${items.length} ${items.length === 1 ? 'car' : 'cars'}`,
    lead: 'Choose the class these cars race in.',
    body: `<label class="gx-asklab">Race class<select data-class><option value="">No class</option>${classes.map(c => `<option value="${esc(c.id)}">${esc(c.name || 'Unnamed class')}</option>`).join('')}</select></label>`,
    ok: 'Set class',
    read: d => ({ id: d.querySelector('[data-class]').value })
  });
  if (!v) return false;
  const name = (classes.find(c => c.id === v.id) || {}).name || '';
  for (const i of items)
    if (direct) await librarySaveOne(i.id, 'patch', name ? { set: { raceClass: name }, clear: [] } : { set: {}, clear: ['raceClass'] });
    else await api.update(e, i.id, { raceClass: v.id });
  return true;
}
// duplicate a car: the same car with no number, no laps and no service history (a photo is not copied)
const COPY_SKIP = [
  'id',
  'number',
  'lapsDriven',
  'lapsSinceService',
  'serviceDate',
  'servicesDone',
  'picture',
  'pictureFrame',
  'extraPictures',
  'paddock',
  'custom',
  'revision'
];
function carCopy(full) {
  const out = {};
  for (const [k, v] of Object.entries(full || {})) if (!COPY_SKIP.includes(k) && v !== undefined && v !== null) out[k] = v;
  if (full && full.custom) out.custom = { ...full.custom };
  return out;
}

// ---- drivers ----
async function garageRetire(items, retired) {
  for (const i of items) await api.update('drivers', i.id, { retired: retired ? 'retired' : '' });
}
// merge a driver into another: the other keeps the name and gets every race, lap and record of this one; this one is gone
async function garageMerge(from, all) {
  if (typeof api.mergeDrivers !== 'function') {
    await Dialog.alert('This version of Timing cannot merge drivers.');
    return false;
  }
  const others = all.filter(d => d.id !== from.id),
    alike = Garage.lookAlikes(from, others).map(d => d.id),
    ordered = [...others.filter(d => alike.includes(d.id)), ...others.filter(d => !alike.includes(d.id))];
  if (!ordered.length) {
    await Dialog.alert('There is no other driver to merge with.');
    return false;
  }
  const v = await garageAsk({
    title: `Merge ${from.name || 'this driver'}`,
    lead: `Choose the driver to keep. ${from.name || 'This driver'}'s races, laps, records, teams and championship places move to them, and ${from.name || 'this driver'} is removed.`,
    body: `<label class="gx-asklab">Keep<select data-into>${ordered.map((d, n) => `<option value="${esc(d.id)}">${esc(d.name || 'Unnamed')}${n < alike.length ? ' · looks the same' : ''}</option>`).join('')}</select></label><p class="muted">This can't be undone. Make a backup first if you are unsure (App Settings › Import and Export).</p>`,
    ok: 'Merge drivers',
    okDanger: true,
    read: d => d.querySelector('[data-into]').value
  });
  if (!v) return false;
  const r = await api.mergeDrivers(from.id, v);
  if (r && r.unsupported) {
    await Dialog.alert(r.reason || 'Merging drivers is not available with this database.');
    return false;
  }
  return true;
}
// read a club list (CSV) and add the drivers that are new
async function garageImport() {
  const file = await new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.txt,text/csv';
    input.onchange = () => resolve(input.files && input.files[0]);
    input.click();
  });
  if (!file) return false;
  if (file.size > 2e6) {
    await Dialog.alert('That file is too big for a club list (more than 2 MB).');
    return false;
  }
  const text = await file.text(),
    existing = await referenceList('drivers'),
    r = Garage.roster(text, existing, typeof COUNTRIES !== 'undefined' ? COUNTRIES : []);
  if (!r.drivers.length) {
    await Dialog.alert(
      r.skipped.length
        ? `Nothing to add: ${r.skipped.length} ${r.skipped.length === 1 ? 'line was' : 'lines were'} skipped (${[...new Set(r.skipped.map(s => s.why))].join(', ')}).`
        : 'No drivers were found in that file. The first line can name the columns: Name, Nickname, Callsign, Country.'
    );
    return false;
  }
  const rows = r.drivers
    .slice(0, 12)
    .map(
      d =>
        `<li><b>${esc(d.name)}</b>${d.nickname ? ` “${esc(d.nickname)}”` : ''}${d.callsign ? ` <code>${esc(d.callsign)}</code>` : ''}${d.flag ? ` <span class="fi fi-${esc(d.flag.toLowerCase())}"></span>` : ''}</li>`
    )
    .join('');
  const ok = await garageAsk({
    title: `Add ${r.drivers.length} ${r.drivers.length === 1 ? 'driver' : 'drivers'}`,
    lead: `From ${file.name}. Columns read: ${r.columns.join(', ')}.`,
    body: `<ul class="gx-asklist">${rows}${r.drivers.length > 12 ? `<li class="muted">and ${r.drivers.length - 12} more</li>` : ''}</ul>${
      r.skipped.length
        ? `<p class="muted">Skipped ${r.skipped.length}: ${esc(
            r.skipped
              .slice(0, 6)
              .map(s => `${s.name} (${s.why})`)
              .join(', ')
          )}${r.skipped.length > 6 ? ', …' : ''}.</p>`
        : ''
    }`,
    ok: `Add ${r.drivers.length}`
  });
  if (!ok) return false;
  for (const d of r.drivers) await api.add('drivers', d);
  return true;
}

// ---- the page ----
// what the cards of a list need to know: names, figures from the races, classes, service, the looks of a car
const garageView = { filter: {}, sort: {}, picked: new Map() };
function garageContext(e, items, stats, direct) {
  const map = { slotcars: 'cars', drivers: 'drivers', tracks: 'tracks', teams: 'teams' }[e],
    of = stats[map] || new Map();
  let most = '';
  if (e === 'tracks') {
    let n = 0;
    for (const i of items) {
      const r = (of.get(i.id) || {}).races || 0;
      if (r > n) {
        n = r;
        most = i.id;
      }
    }
  }
  return {
    direct,
    most,
    title: i => titleOf(e, i),
    stat: i => of.get(i.id),
    laps: i => (e === 'slotcars' ? CarStats.lapsDriven(i) || (of.get(i.id) || {}).laps || 0 : 0),
    due: i => e === 'slotcars' && CarStats.status(i).due,
    archived: i => !!(i.archived || (i.paddock && i.paddock.archived)),
    className: i => {
      if (!i.raceClass) return '';
      const c = (state.refs.raceclasses || []).find(x => x.id === i.raceClass);
      return c
        ? c.name || ''
        : typeof i.raceClass === 'string' && i.raceClass.length < 40 && !/^[0-9a-f-]{20,}$/i.test(i.raceClass)
          ? i.raceClass
          : '';
    },
    colors: i => GarageLooks.of(i.id).colors || (i.colour ? [i.colour] : undefined),
    dist: n => (typeof Distance !== 'undefined' ? Distance.text(n, dUnit()) : n + ' m')
  };
}
// a menu that opens under its button; a click on an item calls act(name); a click elsewhere or Escape closes it
let garageMenuClose = () => {};
function garageMenu(button, items, act) {
  garageMenuClose();
  const layer = document.createElement('div');
  layer.className = 'gx-menulayer';
  layer.innerHTML = Garage.menuHtml(items);
  document.body.appendChild(layer);
  const menu = layer.firstElementChild,
    r = button.getBoundingClientRect();
  const w = menu.offsetWidth || 220,
    h = menu.offsetHeight || 200;
  menu.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w)) + 'px';
  menu.style.top = (r.bottom + h + 8 > window.innerHeight ? Math.max(8, r.top - h - 6) : r.bottom + 6) + 'px';
  button.setAttribute('aria-expanded', 'true');
  const close = () => {
    layer.remove();
    button.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', away, true);
    document.removeEventListener('keydown', key, true);
    garageMenuClose = () => {};
  };
  const away = ev => {
    if (!menu.contains(ev.target)) close();
  };
  const key = ev => {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      close();
      button.focus();
    }
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      const all = [...menu.querySelectorAll('button:not([disabled])')],
        at = all.indexOf(document.activeElement);
      (all[(at + (ev.key === 'ArrowDown' ? 1 : all.length - 1)) % all.length] || all[0])?.focus();
    }
  };
  menu.onclick = ev => {
    const b = ev.target.closest('[data-act]');
    if (!b || b.disabled) return;
    close();
    act(b.dataset.act);
  };
  document.addEventListener('mousedown', away, true);
  document.addEventListener('keydown', key, true);
  garageMenuClose = close;
  menu.querySelector('button:not([disabled])')?.focus();
}
// the items of the More menu of a card
function garageCardMenu(e, i, direct) {
  if (e === 'slotcars')
    return [
      { act: 'edit', label: 'Edit' },
      { act: 'duplicate', label: 'Duplicate' },
      { act: 'service', label: 'Mark serviced' },
      '-',
      direct ? { act: 'archive', label: i.archived ? 'Restore…' : 'Archive…' } : { act: 'delete', label: 'Delete…', danger: true }
    ];
  if (e === 'drivers')
    return [
      { act: 'edit', label: 'Edit' },
      { act: 'merge', label: 'Merge with another driver…' },
      i.retired ? { act: 'unretire', label: 'Back to racing' } : { act: 'retire', label: 'Retire' },
      '-',
      { act: 'delete', label: 'Delete…', danger: true, note: 'Retire keeps their results' }
    ];
  if (e === 'tracks')
    return [
      { act: 'edit', label: 'Edit' },
      { act: 'design', label: 'Track design' },
      '-',
      { act: 'delete', label: 'Delete…', danger: true }
    ];
  return [{ act: 'edit', label: 'Edit' }, '-', { act: 'delete', label: 'Delete…', danger: true }];
}
