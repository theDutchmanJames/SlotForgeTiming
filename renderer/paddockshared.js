(function (root) {
  'use strict';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const groups = [
    ['Car details', ['name', 'maker', 'marque', 'model', 'reference', 'scale', 'number', 'livery', 'raceClass', 'availability']],
    ['Fitted specification', ['motor', 'motorLayout', 'rearTyres', 'frontTyres', 'guide', 'braids', 'chassis', 'body', 'pod']],
    ['Measurements', ['pinion', 'gear', 'weight', 'rearDiameter', 'frontDiameter', 'ratedRpm', 'ratedVoltage']]
  ];
  const labels = {
    maker: 'Slotcar manufacturer',
    marque: 'Car make',
    raceClass: 'Race class',
    motorLayout: 'Motor layout',
    rearTyres: 'Rear tyres',
    frontTyres: 'Front tyres',
    pinion: 'Pinion teeth',
    gear: 'Gear teeth',
    weight: 'Weight (g)',
    rearDiameter: 'Rear tyre diameter (mm)',
    frontDiameter: 'Front tyre diameter (mm)',
    ratedRpm: 'Rated motor RPM',
    ratedVoltage: 'Rated voltage (V)'
  };
  function timingControls(t) {
    if (!t) return '';
    return `<details open class="shared-car-group"><summary>Timing race settings</summary><p class="muted">Simulation settings for this car. Physical specifications remain in the sections above.</p><div class="shared-car-fields">${t.fields
      .map(f => {
        const value = t.values[f.key] ?? f.default ?? '';
        const input =
          f.type === 'select'
            ? `<select data-timing="${f.key}">${f.options.map(([v, label]) => `<option value="${esc(v)}" ${v === value ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select>`
            : `<input data-timing="${f.key}" type="number" min="${f.min}" step="${f.step}" value="${esc(value)}">`;
        return `<label>${esc(f.label)}${input}<small>${esc(f.hint)}</small></label>`;
      })
      .join('')}</div></details>`;
  }
  function timingChanges(t, values) {
    if (!t) return null;
    const patch = {};
    for (const f of t.fields) {
      if (!Object.hasOwn(values, f.key)) continue;
      const raw = values[f.key],
        before = t.values[f.key] ?? f.default ?? '';
      if (String(before) === raw) continue;
      if (raw === '') {
        if (!f.optional) throw Error('Choose ' + f.label + '.');
        patch[f.key] = null;
        continue;
      }
      if (f.type === 'select') {
        if (!f.options.some(([v]) => v === raw)) throw Error('Check ' + f.label + '.');
        patch[f.key] = raw;
      } else {
        const value = Number(raw);
        if (
          !Number.isFinite(value) ||
          value < f.min ||
          (f.max !== undefined && value > f.max) ||
          (f.step === 1 && !Number.isInteger(value))
        )
          throw Error('Check ' + f.label + '.');
        patch[f.key] = value;
      }
    }
    return Object.keys(patch).length
      ? t.binding
        ? { expectedRevision: t.binding.revision, expectedBindingToken: t.binding.bindingToken, set: patch }
        : { sourceId: t.sourceId, originalId: t.originalId, expectedRevision: t.revision, patch }
      : null;
  }
  function serviceChanges(loaded, d) {
    if (!loaded.service) return false;
    const v = loaded.service.service;
    return [...d.querySelectorAll('[data-service]')].some(x => {
      const k = x.dataset.service;
      return k === 'lastServicedAt' ? (v[k] || '').slice(0, 10) !== x.value : String(v[k]) !== x.value;
    });
  }
  function changes(fields, before, values) {
    const set = {},
      clear = [];
    for (const [key, raw] of Object.entries(values)) {
      const rule = fields[key];
      if (!rule) continue;
      const old = before[key] ?? '';
      // Only edited controls are sent: never echo truncated or unparsed fields.
      if (String(old) === raw) continue;
      if (raw === '') {
        if (rule.clearable) clear.push(key);
        else throw Error('Enter ' + (labels[key] || key) + '.');
        continue;
      }
      if (rule.type === 'number' || rule.type === 'integer') {
        const v = Number(raw);
        if (
          !Number.isFinite(v) ||
          (rule.type === 'integer' && !Number.isInteger(v)) ||
          (rule.minimum !== undefined && v < rule.minimum) ||
          (rule.maximum !== undefined && v > rule.maximum)
        )
          throw Error('Check ' + (labels[key] || key) + '.');
        set[key] = v;
      } else {
        if (raw.length > rule.maxLength) throw Error((labels[key] || key) + ' is too long.');
        set[key] = raw;
      }
    }
    return { set, clear };
  }
  // (2.4.0, SlotForgeRestyle.md "Build Sheet") the car as a Tech Sheet: the drawn car, its name and key facts on top; the sections in a rail (The car, Motor and
  // gearing, In the race, Service, Extra fields); the gearing worked out; Cancel and Save at the bottom, the rest under More.
  const SECTIONS = [
    [
      'car',
      'The car',
      'What it is and how it looks: this is how it shows on the grid and the screens.',
      ['number', 'scale', 'reference', 'maker', 'marque', 'model', 'livery', 'raceClass', 'availability']
    ],
    [
      'gear',
      'Motor and gearing',
      'What is fitted. The numbers under it are worked out for you.',
      [
        'motor',
        'motorLayout',
        'ratedRpm',
        'ratedVoltage',
        'pinion',
        'gear',
        'rearDiameter',
        'frontDiameter',
        'weight',
        'guide',
        'rearTyres',
        'frontTyres',
        'chassis',
        'body',
        'braids',
        'pod'
      ]
    ]
  ];
  const UNITS = {
    ratedRpm: 'rpm',
    ratedVoltage: 'V',
    pinion: 'teeth',
    gear: 'teeth',
    rearDiameter: 'mm',
    frontDiameter: 'mm',
    weight: 'g'
  };
  const SHORT = {
    maker: 'Made by',
    marque: 'Car make',
    raceClass: 'Race class',
    motorLayout: 'Layout',
    ratedRpm: 'Rated',
    ratedVoltage: 'At',
    pinion: 'Pinion',
    gear: 'Crown gear',
    rearDiameter: 'Rear tyre',
    frontDiameter: 'Front tyre',
    weight: 'Weight',
    rearTyres: 'Rear tyres',
    frontTyres: 'Front tyres',
    availability: 'Can it race?',
    number: 'Number',
    livery: 'Livery'
  };
  const WIDE = {
    maker: 2,
    marque: 2,
    model: 2,
    livery: 3,
    raceClass: 3,
    motor: 3,
    rearTyres: 3,
    frontTyres: 3,
    chassis: 2,
    body: 2,
    braids: 2,
    availability: 6
  };
  const G = () => root.Garage;
  async function open(api, id, updated = () => {}, opts = {}) {
    const d = document.createElement('dialog');
    d.className = 'paddock-dialog shared-car-dialog bs-dialog';
    d.innerHTML =
      '<div class="bs-hd"><div class="bs-pic" data-bs-pic></div><div class="bs-id"><span class="bs-k" data-bs-kicker>Slotcar</span><h2>Slotcar</h2><div class="bs-pills" data-bs-pills></div></div><div class="bs-hr"><button class="btn ghost icon bs-x" type="button" data-close aria-label="Close" title="Close"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button><span class="bs-ok" data-bs-state hidden></span></div></div><p data-status role="status" class="bs-status">Opening car…</p><div data-body class="bs-bodybox"></div>';
    document.body.append(d);
    d.showModal();
    const q = s => d.querySelector(s);
    let loaded,
      busy = false,
      dirty = false,
      looks = { colors: [] };
    const close = async () => {
      if (busy) return;
      if (dirty && !(await Dialog.confirm('Close without saving these edits?', { ok: 'Discard edits', danger: true }))) return;
      if (!busy && d.open) d.close(); // (a save may have started or closed it while asking)
    };
    q('[data-close]').onclick = close;
    d.oncancel = e => {
      e.preventDefault();
      close();
    };
    d.onclose = () => d.remove();
    // the figures under the gearing, the drawn car, the pills and the notes of the rail, from what the form holds now
    const now = k => {
      const x = d.querySelector(`[data-field="${k}"]`);
      return x ? x.value : ((loaded && loaded.car && loaded.car.fields[k]) ?? '');
    };
    function redraw() {
      if (!loaded || !G()) return;
      const g = G(),
        name = now('name') || 'New car',
        car = { id: (loaded.car && loaded.car.id) || 'new', name, livery: now('livery'), number: now('number') },
        colors = g.carColors(car, looks.colors);
      q('h2').textContent = now('name') || (loaded.car ? 'Unnamed car' : 'New car');
      q('[data-bs-pic]').innerHTML = g.carSvg(colors, g.numberOf(car, name), car.id + 'bs');
      const gear = g.gearing(
        { pinion: now('pinion'), gear: now('gear'), rearDiameter: now('rearDiameter'), ratedRpm: now('ratedRpm') },
        now('scale')
      );
      const calc = q('[data-bs-calc]');
      if (calc)
        calc.innerHTML = gear
          ? `<div class="bs-tile"><small>Gear ratio</small><b>${esc(gear.ratioText)}</b><span>${gear.pinion} : ${gear.crown}</span></div><div class="bs-tile"><small>One motor turn</small><b>${esc(gear.perText || '—')}</b><span>${gear.per ? 'the car moves this far' : 'needs the rear tyre size'}</span></div><div class="bs-tile"><small>Top speed, in theory</small><b>${esc(gear.kmhText || '—')}</b><span>${gear.kmh ? esc((gear.scaleText ? gear.scaleText + ' · ' : '') + 'no slip, at the rated rpm') : 'needs the rated rpm'}</span></div>`
          : '<p class="muted bs-calcnone">Fill in the pinion and the crown gear to see the gear ratio worked out.</p>';
      const pills = [now('raceClass'), now('scale'), now('number') ? '#' + now('number') : ''].filter(Boolean);
      q('[data-bs-pills]').innerHTML = pills.map(p => `<span class="bs-pill">${esc(p)}</span>`).join('');
      const state = q('[data-bs-state]'),
        avail = now('availability'),
        sv = loaded.service && loaded.service.service,
        interval = Number(d.querySelector('[data-timing="serviceInterval"]')?.value) || 0,
        due = sv && interval > 0 && Number(sv.lapsSinceService) >= interval;
      const st =
        loaded.car && loaded.car.archived
          ? ['Archived', 'off']
          : avail && !/^avail/i.test(avail)
            ? [avail, 'off']
            : due
              ? ['Service due', 'due']
              : ['Ready to race', 'ok'];
      state.hidden = false;
      state.className = 'bs-ok ' + st[1];
      state.innerHTML = `<i aria-hidden="true"></i>${esc(st[0])}`;
      const note = {
        car:
          [now('maker'), now('number') ? '#' + now('number') : '', now('raceClass')].filter(Boolean).join(' · ') || 'Name, make and number',
        gear: gear
          ? [gear.pinion + ':' + gear.crown, gear.ratioText, now('ratedRpm') ? Math.round(Number(now('ratedRpm')) / 1000) + 'k rpm' : '']
              .filter(Boolean)
              .join(' · ')
          : now('motor') || 'Motor, gears, tyres',
        race: (() => {
          const t = d.querySelector('[data-timing="tyreCompound"]');
          return t ? t.options[t.selectedIndex]?.text.replace(/\s*\(.*\)$/, '') + ' tyres' : 'Weather, damage, failures';
        })(),
        service: sv
          ? due
            ? `Due now · ${Number(sv.lapsSinceService).toLocaleString('en-US')} laps`
            : interval
              ? `${Math.max(0, interval - Number(sv.lapsSinceService)).toLocaleString('en-US')} laps to go`
              : 'No interval set'
          : 'Not kept here'
      };
      d.querySelectorAll('[data-bs-note]').forEach(x => {
        x.textContent = note[x.dataset.bsNote] || x.textContent;
        x.classList.toggle('due', x.dataset.bsNote === 'service' && !!due);
      });
    }
    async function load() {
      loaded = await api.paddockSharedCar(id);
      if (!d.isConnected) return;
      const { schema, car } = loaded,
        here = loaded; // (this drawing of the form: a reload while a question is open replaces it)
      dirty = false;
      // a copy of another car (Duplicate): its fields without the number; it is saved as a new car
      let start = car ? car.fields : {};
      if (!car && opts.copyOf) {
        const from = await api.paddockSharedCar(opts.copyOf).catch(() => null);
        if (from && from.car) {
          start = { ...from.car.fields };
          delete start.number;
          if (start.name) start.name = String(start.name).replace(/\s*#\s*\d+\s*$/, '') + ' (copy)';
        }
      }
      looks = {
        colors: [],
        ...(car && root.GarageLooks ? root.GarageLooks.of(car.id) : opts.copyOf && root.GarageLooks ? root.GarageLooks.of(opts.copyOf) : {})
      };
      const classes = typeof api.list === 'function' ? await api.list('raceclasses').catch(() => []) : [];
      q('h2').textContent = car ? 'Edit car' : opts.copyOf ? 'Duplicate car' : 'Add car';
      q('[data-bs-kicker]').textContent = car
        ? 'Edit car · shared library'
        : opts.copyOf
          ? 'Duplicate car · shared library'
          : 'Add car · shared library';
      q('[data-status]').textContent = car?.archived ? 'Archived car: restore it (under More) before editing.' : '';
      const field = k => {
        const r = schema.fields[k];
        if (!r) return '';
        const value = start[k] ?? '',
          hint = car?.truncated?.includes(k)
            ? 'Shortened for editing. Unchanged text is preserved.'
            : car?.unparsed?.[k]
              ? 'Original value cannot be expressed numerically. Unchanged value is preserved.'
              : '';
        const label = SHORT[k] || labels[k] || k[0].toUpperCase() + k.slice(1),
          input = `<input id="bs-${k}" data-field="${k}" type="${r.type === 'string' ? 'text' : 'number'}" value="${esc(value)}" ${r.maxLength ? 'maxlength="' + r.maxLength + '"' : ''} ${r.minimum !== undefined ? 'min="' + r.minimum + '"' : ''} ${r.maximum !== undefined ? 'max="' + r.maximum + '"' : ''} step="${r.type === 'integer' ? '1' : 'any'}" ${r.clearable === false ? 'required' : ''}${k === 'raceClass' ? ' list="bs-classes"' : ''}>`;
        if (k === 'availability') {
          const words = G() ? G().AVAILABLE : ['Available'],
            cur = String(value).trim() || 'Available';
          return `<div class="bs-f s6"><span class="bs-l">${esc(label)}</span><span class="bs-gearsel" role="group" aria-label="${esc(label)}">${[...words, ...(words.includes(cur) ? [] : [cur])].map(w => `<button type="button" class="${w === cur ? 'on' : ''}" data-avail="${esc(w)}" aria-pressed="${w === cur}">${esc(w)}</button>`).join('')}</span><input data-field="availability" type="hidden" value="${esc(value)}"></div>`;
        }
        return `<div class="bs-f s${WIDE[k] || 1}"><label for="bs-${k}">${esc(label)}</label>${UNITS[k] ? `<span class="bs-unit">${input}<i>${UNITS[k]}</i></span>` : input}${hint ? `<small>${hint}</small>` : ''}</div>`;
      };
      const swatches = G()
        ? `<div class="bs-f s3"><span class="bs-l">Livery colours</span><span class="gx-swatches bs-looks">${G()
            .LANES.concat(['#ffffff', '#22262c'])
            .map(
              (c, n) =>
                `<button type="button" class="gx-sw${looks.colors.includes(c) ? ' on' : ''}" style="--sw:${c}" data-look="${c}" aria-pressed="${looks.colors.includes(c)}" aria-label="Colour ${c}"></button>`
            )
            .join('')}<small class="muted">Up to two: the body, then the stripe. Kept by Timing.</small></span></div>`
        : '';
      const timing = loaded.timing
        ? `<section class="bs-sec" data-sec="race"><h3>In the race</h3><p class="bs-q">How the race systems treat this car: its tyre in the weather, how fast it takes damage, how often it fails.</p><div class="bs-g">${loaded.timing.fields
            .filter(f => !(f.key === 'serviceInterval' && loaded.service && api.libraryService))
            .map(f => {
              const value = loaded.timing.values[f.key] ?? f.default ?? '';
              const input =
                f.type === 'select'
                  ? `<select id="bs-t-${f.key}" data-timing="${f.key}">${f.options.map(([v, label]) => `<option value="${esc(v)}" ${v === value ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select>`
                  : `<input id="bs-t-${f.key}" data-timing="${f.key}" type="number" min="${f.min}" step="${f.step}" value="${esc(value)}">`;
              return `<div class="bs-f s3"><label for="bs-t-${f.key}">${esc(f.label.replace(/\s*\(for .*\)$/, ''))}</label>${input}<small>${esc(f.hint)}</small></div>`;
            })
            .join('')}</div></section>`
        : '';
      const v = loaded.service && api.libraryService ? loaded.service.service : null;
      const log = car && root.GarageLooks ? root.GarageLooks.of(car.id).log || [] : [];
      const service = v
        ? `<section class="bs-sec" data-sec="service"><h3>Service</h3><p class="bs-q">How often the car needs a look, and when it had one.</p><div class="bs-g"><div class="bs-meter s6" data-bs-meter></div>${(f =>
            f
              ? `<div class="bs-f s2"><label for="bs-t-serviceInterval">Service every</label><span class="bs-unit"><input id="bs-t-serviceInterval" data-timing="serviceInterval" type="number" min="${f.min}" step="${f.step}" value="${esc(loaded.timing.values.serviceInterval ?? f.default ?? '')}"><i>laps</i></span></div>`
              : '')((loaded.timing && loaded.timing.fields.find(f => f.key === 'serviceInterval')) || null)}${[
            ['lapsDriven', 'Laps driven'],
            ['lapsSinceService', 'Since the last service'],
            ['servicesDone', 'Services done']
          ]
            .map(
              ([k, label]) =>
                `<div class="bs-f s1"><label for="bs-s-${k}">${label}</label><input id="bs-s-${k}" data-service="${k}" type="number" min="0" step="1" value="${v[k]}"></div>`
            )
            .join(
              ''
            )}<div class="bs-f s1"><label for="bs-s-last">Last service</label><input id="bs-s-last" data-service="lastServicedAt" type="date" value="${esc((v.lastServicedAt || '').slice(0, 10))}"></div><div class="bs-f s6"><label for="bs-s-note">A note for the log</label><input id="bs-s-note" data-log-note type="text" maxlength="200" placeholder="New braids, cleaned the gears…"></div><div class="bs-svcbtns s6"><button type="button" class="btn bs-amber" data-service-reset>Mark serviced now</button><button type="button" class="btn" data-service-save>Save the counters</button></div>${
            log.length
              ? `<div class="bs-f s6"><span class="bs-l">Service log</span><div class="bs-hist">${log
                  .map(
                    x =>
                      `<div><b>${esc(G() ? G().day(x.date) : x.date.slice(0, 10))}</b><span>${esc(x.note || 'Serviced')}</span><span>${x.laps === null || x.laps === undefined ? '—' : esc(Number(x.laps).toLocaleString('en-US') + ' laps')}</span></div>`
                  )
                  .join('')}</div></div>`
              : ''
          }</div></section>`
        : '';
      const extra =
        loaded.custom && loaded.custom.definitions.length
          ? `<section class="bs-sec" data-sec="extra"><h3>Extra fields</h3><p class="bs-q">The fields your club added to every slot car.</p><div class="bs-g">${loaded.custom.definitions.map(f => `<div class="bs-f s3"><label>${esc(f.label)}${['choice', 'yesno'].includes(f.type) ? `<select data-custom="${esc(f.id)}"><option value="">Not set</option>${(f.type === 'yesno' ? ['Yes', 'No'] : f.options).map(v => `<option ${String(loaded.custom.values[f.id] || '') === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>` : `<input data-custom="${esc(f.id)}" type="${f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}" step="any" value="${esc(loaded.custom.values[f.id] || '')}">`}</label></div>`).join('') || '<p class="muted">Add fields using Extra fields in the Slotcars database.</p>'}</div></section>`
          : '';
      const sections = [
        ...SECTIONS.map(([sid, title, ask, keys]) => [
          sid,
          title,
          `<section class="bs-sec" data-sec="${sid}"><h3>${title}</h3><p class="bs-q">${ask}</p><div class="bs-g">${keys.map(k => (k === 'livery' ? field(k) + swatches : field(k))).join('')}${sid === 'gear' ? '<div class="bs-calc s6" data-bs-calc aria-live="polite"></div>' : ''}</div></section>`
        ]),
        ...(timing ? [['race', 'In the race', timing]] : []),
        ...(service ? [['service', 'Service', service]] : []),
        ...(extra ? [['extra', 'Extra fields', extra, true]] : [])
      ];
      q('[data-body]').innerHTML =
        `<form class="bs-form"><div class="bs-mid"><nav class="bs-rail" aria-label="The sections of this car"><div class="bs-rh">This car</div>${sections
          .filter(x => !x[3])
          .map(
            ([sid, title]) =>
              `<button type="button" class="bs-ri" data-go="${sid}"><b>${title}</b><small data-bs-note="${sid}"></small></button>`
          )
          .join('')}${
          sections.some(x => x[3])
            ? `<div class="bs-rh">Only if you need it</div>${sections
                .filter(x => x[3])
                .map(
                  ([sid, title]) =>
                    `<button type="button" class="bs-ri" data-go="${sid}"><b>${title}</b><small>${loaded.custom.definitions.length} of your own</small></button>`
                )
                .join('')}`
            : ''
        }</nav><div class="bs-main">${schema.fields.name ? `<div class="bs-namebox"><label for="bs-name">Name</label><input id="bs-name" class="bs-name" data-field="name" type="text" value="${esc(start.name ?? '')}" ${schema.fields.name.maxLength ? 'maxlength="' + schema.fields.name.maxLength + '"' : ''} ${schema.fields.name.clearable === false ? 'required' : ''}></div>` : ''}${sections.map(x => x[2]).join('')}</div></div><datalist id="bs-classes">${classes.map(c => `<option value="${esc(c.name || '')}">`).join('')}</datalist><div class="bs-ft row shared-car-actions"><span class="bs-note">Saved in the shared library: Paddock sees the same car.</span><span class="sp"></span><details class="bs-more"><summary class="btn">More</summary><div class="bs-menu">${car ? `<button class="btn" type="button" data-archive>${car.archived ? 'Restore car' : 'Archive car'}</button>` : ''}<button class="btn" type="button" data-reload>Reload current record</button><button class="btn" type="button" data-saves>Save history</button></div></details><button class="btn" type="button" data-cancel>Cancel</button><button class="btn primary" type="submit" ${car?.archived ? 'disabled' : ''}>Save</button></div></form>`;
      q('[data-cancel]').onclick = close;
      d.querySelectorAll('[data-go]').forEach(b => {
        b.onclick = () => {
          d.querySelectorAll('.bs-ri').forEach(x => x.classList.toggle('on', x === b));
          d.querySelector(`[data-sec="${b.dataset.go}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
      });
      d.querySelector('.bs-ri')?.classList.add('on');
      d.querySelectorAll('[data-avail]').forEach(b => {
        b.onclick = () => {
          const box = d.querySelector('[data-field="availability"]');
          box.value = b.dataset.avail === 'Available' && !String(box.value).trim() ? '' : b.dataset.avail;
          d.querySelectorAll('[data-avail]').forEach(x => {
            x.classList.toggle('on', x === b);
            x.setAttribute('aria-pressed', String(x === b));
          });
          dirty = true;
          redraw();
        };
      });
      d.querySelectorAll('[data-look]').forEach(b => {
        b.onclick = () => {
          const c = b.dataset.look,
            list = looks.colors.includes(c) ? looks.colors.filter(x => x !== c) : [...looks.colors, c].slice(-2);
          looks = { ...looks, colors: list, changed: true };
          d.querySelectorAll('[data-look]').forEach(x => {
            const on = list.includes(x.dataset.look);
            x.classList.toggle('on', on);
            x.setAttribute('aria-pressed', String(on));
          });
          dirty = true;
          redraw();
        };
      });
      const meter = q('[data-bs-meter]');
      if (meter && v) {
        const interval = Number(loaded.timing?.values?.serviceInterval) || 0,
          since = Number(v.lapsSinceService) || 0,
          due = interval > 0 && since >= interval;
        meter.classList.toggle('due', due);
        meter.innerHTML = interval
          ? `<div class="t"><span>Laps since the last service</span><b>${since.toLocaleString('en-US')} of ${interval.toLocaleString('en-US')}</b></div><div class="bs-bar"><i style="width:${Math.min(100, Math.round((100 * since) / interval))}%"></i></div><div class="r">${due ? `Due now: ${(since - interval).toLocaleString('en-US')} laps past its interval` : `${(interval - since).toLocaleString('en-US')} laps to go`}${v.lastServicedAt ? ` · last serviced ${esc(G() ? G().day(v.lastServicedAt) : v.lastServicedAt.slice(0, 10))}` : ''}</div>`
          : `<div class="t"><span>Laps since the last service</span><b>${since.toLocaleString('en-US')}</b></div><div class="r">No service interval is set: fill in Service every.</div>`;
      }
      redraw();
      if (loaded.service && api.libraryService) {
        const v = loaded.service.service;
        const service = async action => {
          if (
            [...d.querySelectorAll('[data-field]')].some(x => String(car.fields[x.dataset.field] ?? '') !== x.value) ||
            timingChanges(
              loaded.timing,
              Object.fromEntries([...d.querySelectorAll('[data-timing]')].map(x => [x.dataset.timing, x.value]))
            ) ||
            [...d.querySelectorAll('[data-custom]')].some(x => String(loaded.custom.values[x.dataset.custom] ?? '') !== x.value)
          )
            throw Error('Save your car edits first. The maintenance draft is retained.');
          const values = {};
          for (const x of d.querySelectorAll('[data-service]')) {
            const k = x.dataset.service;
            if (k === 'lastServicedAt') values[k] = x.value ? new Date(x.value + 'T00:00:00.000Z').toISOString() : null;
            else {
              values[k] = Number(x.value);
              if (!Number.isSafeInteger(values[k]) || values[k] < 0) throw Error('Enter whole, nonnegative service counters.');
            }
          }
          const r = await api.libraryService({
            databaseId: schema.databaseId,
            recoveryId: schema.recoveryId,
            carId: car.id,
            expectedCarRevision: car.revision,
            expectedRevision: v.revision,
            action,
            ...(action === 'set' ? { values } : {})
          });
          if (r.state !== 'committed') throw Error(r.error || 'Service save retained. Check Save history before repeating it.');
          if (action === 'reset' && root.GarageLooks)
            await root.GarageLooks.log(car.id, { note: q('[data-log-note]')?.value || '', laps: Number(v.lapsSinceService) || 0 }).catch(
              () => {}
            );
          await load();
          await updated();
        };
        q('[data-service-save]').onclick = () => run(() => service('set'));
        q('[data-service-reset]').onclick = async () => {
          if (!(await Dialog.confirm('Record a service now and reset laps since service?', { ok: 'Mark serviced' }))) return;
          if (d.isConnected && loaded === here) run(() => service('reset')); // (still the same record)
        };
      }
      q('form').oninput = () => {
        dirty = true;
        redraw();
      };
      q('[data-reload]').onclick = async () => {
        if (
          dirty &&
          !(await Dialog.confirm('Reload the current record and discard this draft?', { ok: 'Discard and reload', danger: true }))
        )
          return;
        if (d.isConnected) run(load);
      };
      q('[data-saves]').onclick = () => saves(api, updated);
      q('form').onsubmit = async e => {
        e.preventDefault();
        if (
          serviceChanges(loaded, d) &&
          !(await Dialog.confirm(
            'Service counters have unsaved edits. Save the car changes and discard those counter edits? To keep them, cancel and save service counters first.',
            { ok: 'Save car, discard counters', danger: true }
          ))
        )
          return;
        if (!d.isConnected || loaded !== here) return; // (closed or reloaded while asking)
        run(async () => {
          const delta = changes(
              schema.fields,
              car?.fields || {},
              Object.fromEntries([...d.querySelectorAll('[data-field]')].map(x => [x.dataset.field, x.value]))
            ),
            extras = timingChanges(
              loaded.timing,
              Object.fromEntries([...d.querySelectorAll('[data-timing]')].map(x => [x.dataset.timing, x.value]))
            );
          if (extras) delta[loaded.timing.binding ? 'timingSettings' : 'timingExtras'] = extras;
          const customValues = { set: {}, clear: [] };
          for (const x of d.querySelectorAll('[data-custom]'))
            if (String(loaded.custom.values[x.dataset.custom] ?? '') !== x.value) {
              if (x.value === '') customValues.clear.push(x.dataset.custom);
              else customValues.set[x.dataset.custom] = x.value;
            }
          if (Object.keys(customValues.set).length || customValues.clear.length) delta.customValues = customValues;
          if (car && !Object.keys(delta.set).length && !delta.clear.length && !extras && !delta.customValues) {
            if (looks.changed && root.GarageLooks) {
              await root.GarageLooks.set(car.id, { colors: looks.colors });
              dirty = false;
              d.close();
              await updated();
              return;
            }
            q('[data-status]').textContent = 'No fields changed.';
            return;
          }
          await save(car ? 'patch' : 'create', delta);
        });
      };
      if (car)
        q('[data-archive]').onclick = async () => {
          if (
            !(await Dialog.confirm(
              car.archived
                ? 'Restore this car to the shared library?'
                : 'Archive this car in both apps? Saved race history remains intact.',
              car.archived ? { ok: 'Restore car' } : { ok: 'Archive car', danger: true }
            ))
          )
            return;
          if (d.isConnected && loaded === here) run(() => save(car.archived ? 'restore' : 'archive', {})); // (still the same record)
        };
    }
    async function save(action, delta) {
      const { schema, car } = loaded,
        r = await api.paddockSharedSave({
          databaseId: schema.databaseId,
          recoveryId: schema.recoveryId,
          action,
          ...(car ? { carId: car.id, expectedRevision: car.revision } : {}),
          ...delta
        });
      if (r.state === 'committed') {
        const carId = (car && car.id) || r.receipt?.car?.id;
        if (looks.changed && carId && root.GarageLooks) await root.GarageLooks.set(carId, { colors: looks.colors }).catch(() => {});
        dirty = false;
        d.close();
        await updated();
        return;
      }
      q('[data-status]').textContent =
        (r.state === 'pending'
          ? 'Save is safely queued. Use Save history to check its outcome; do not create it again. '
          : 'Changes were not applied. ') +
        (r.error || '') +
        (r.details?.fields ? ' Fields: ' + r.details.fields.join(', ') + '.' : '') +
        (r.code === 'REVISION_CONFLICT' ? ' Your draft is retained. Reload deliberately to edit the newer record.' : '');
    }
    async function run(fn) {
      if (busy) return;
      busy = true;
      d.querySelectorAll('button,input,select').forEach(x => (x.disabled = true));
      try {
        await fn();
      } catch (e) {
        q('[data-status]').textContent = e.message;
      } finally {
        busy = false;
        d.querySelectorAll('button,input,select').forEach(x => (x.disabled = false));
        if (loaded?.car?.archived) {
          d.querySelectorAll('[data-field],[data-timing]').forEach(x => (x.disabled = true));
          if (q('[type="submit"]')) q('[type="submit"]').disabled = true;
        }
      }
    }
    await run(load);
    return d;
  }
  async function saves(api, updated = () => {}) {
    const d = document.createElement('dialog');
    d.className = 'paddock-dialog';
    d.innerHTML =
      '<header><h2>Save history</h2><button class="btn" data-close>Close</button></header><p>Unresolved saves and the latest 200 completed saves are shown. Pending saves are recovered automatically. A restored library blocks old requests; Timing never recreates them automatically.</p><p data-error role="status"></p><div data-list></div>';
    document.body.append(d);
    d.showModal();
    d.querySelector('[data-close]').onclick = () => d.close();
    d.onclose = () => d.remove();
    async function draw() {
      const rows = await api.paddockSharedSaves();
      d.querySelector('[data-list]').innerHTML =
        [
          ...rows.filter(r => ['committed', 'reconciled'].includes(r.state)).slice(-200),
          ...rows.filter(r => !['committed', 'reconciled'].includes(r.state))
        ]
          .reverse()
          .map(
            r =>
              `<article class="paddock-delivery"><b>${esc(r.request.action)} · ${esc(r.request.set?.name || r.receipt?.car?.fields?.name || r.request.carId || r.id)}</b><span>${esc(r.state)}</span><p>${esc(r.error)}</p>${r.state === 'pending' ? `<button class="btn" data-retry="${esc(r.id)}">Check / retry saved request</button>` : ''}${r.state === 'blocked' && ['RECOVERY_CHANGED', 'RECEIPT_MISMATCH', 'OPERATION_CONFLICT', 'COMMAND_CONFLICT', 'CAR_MERGED', 'MERGE_SETTINGS_REQUIRED', 'SETTINGS_CONFLICT'].includes(r.code) ? `<button class="btn" data-resolve="${esc(r.id)}">I have reconciled this save</button>` : ''}${r.receipt?.car?.id ? `<button class="btn" data-open="${esc(r.receipt.car.id)}">Open current car${r.request.action === 'archive' ? ' / restore' : ''}</button>` : ''}</article>`
          )
          .join('') || '<p>No saves yet.</p>';
    }
    d.onclick = async e => {
      const b = e.target.closest('[data-retry],[data-open],[data-resolve]');
      if (!b) return;
      b.disabled = true;
      try {
        if (b.dataset.resolve) {
          if (
            (await Dialog.confirm(
              'Confirm you have compared the current Paddock library with this saved operation. This acknowledges the conflict only: no car is created, edited or linked. Future edits will be new deliberate operations.',
              { title: 'Mark save as reconciled', ok: 'I have reconciled it' }
            )) &&
            d.isConnected
          ) {
            await api.paddockSharedResolve(b.dataset.resolve);
            await draw();
          }
        } else if (b.dataset.retry) {
          await api.paddockSharedRetry(b.dataset.retry);
          await updated();
          await draw();
        } else
          await open(api, b.dataset.open, async () => {
            await updated();
            await draw();
          });
      } catch (e) {
        d.querySelector('[data-error]').textContent = e.message;
      } finally {
        b.disabled = false;
      }
    };
    await draw();
    return d;
  }
  root.PaddockShared = { open, saves, changes };
  if (typeof module !== 'undefined') module.exports = { changes, timingChanges };
})(globalThis);
