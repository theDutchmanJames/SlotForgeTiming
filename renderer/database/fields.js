// database: form fields: one input of a form, pictures (resized), galleries
// (part of renderer/database.js: loaded just before it by index.html; the parts share the page's global scope)
function fieldHtml(f, v, extra) {
  if (f.ui && FormUI.has(f.ui))
    return FormUI.field(f, v, {
      label: f.ask || ffl(f),
      hint: fh(f),
      icon: n => Icons.svg(n, { size: 18, stroke: 1.8 }),
      picker: SetupWords.PICKER,
      parts: extra && extra.parts,
      partner: extra && extra.partner,
      unitWord: extra && extra.words && extra.words.unit
    }); // (switches, buttons, cards and boxes for a setting: 1.70.0, formui.js; a sentence with two numbers: 1.73.0)
  const id = 'f-' + f.id;
  if (BAR_TYPES.includes(f.type) || f.type === 'wxhinder' || f.type === 'wxcond') {
    // visual/transient fields
    const body =
      f.type === 'pstimeline'
        ? `<div id="ps-curve-box">${psCurve((extra && extra.value) || (() => ''))}</div>`
        : BAR_TYPES.includes(f.type)
          ? '<div id="rs-strip"></div>'
          : f.type === 'wxhinder'
            ? `<div id="wx-hinder-map">${wxHinderMap((extra && extra.value) || (() => ''), extra && extra.wxhFocus)}</div>`
            : wxCondTable((extra && extra.value) || (() => ''), (extra && extra.words) || { temp: '°C', speed: 'km/h' });
    return `<div class="field full fu wxfield" data-key="${f.id}"><span class="fu-q">${esc(ffl(f))}${BAR_TYPES.includes(f.type) && fh(f) ? `<small class="muted">${esc(fh(f))}</small>` : ''}</span>${body}</div>`;
  }
  const lab = `<label for="${id}">${f.icon ? `<span class="field-label-icon" aria-hidden="true">${Icons.svg(f.icon, { size: 16, stroke: 1.8 })}</span>` : ''}${esc(ffl(f))}${f.optional ? ' <span class="muted">(optional)</span>' : ''}</label>`;
  let inp;
  switch (f.type) {
    case 'longtext':
      inp = `<textarea id="${id}" rows="3">${esc(v)}</textarea>`;
      break;
    case 'number':
      inp = `<input id="${id}" type="number" step="${f.step || 'any'}"${f.min !== undefined ? ` min="${f.min}"` : ''} value="${esc(typedText(f, v) ?? v)}"${unitAttrs(f, v)}>`;
      if (f.suffix)
        inp = `<span class="inunit">${inp}${FormUI.unitSpan(f.suffix, { unitWord: extra && extra.words && extra.words.unit })}</span>`;
      break; // (suffix: the unit in the box, 1.73.0)
    case 'date':
      inp = `<input id="${id}" type="date" value="${esc(v)}">`;
      break;
    case 'choice':
      inp = `<input id="${id}" list="${id}-l" value="${esc(v)}"><datalist id="${id}-l">${f.options.map(o => `<option value="${esc(o)}">`).join('')}</datalist>`;
      break;
    case 'list':
      inp = `<select id="${id}"><option value=""></option>${f.options.map(o => `<option${o === v ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
      break;
    case 'select':
      inp = `<select id="${id}">${f.options.map(([k, l]) => `<option value="${esc(k)}"${k === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
      break;
    case 'ref': {
      const pick = `<select id="${id}"><option value="">${esc(f.blank || '(none)')}</option>${(state.refs[f.ref] || []).map(r => `<option value="${esc(r.id)}"${r.id === v ? ' selected' : ''}>${esc(titleOf(f.ref, r))}</option>`).join('')}</select>`;
      inp = f.createClass
        ? pick +
          `<div class="row class-create"><input id="${id}-new" maxlength="60" placeholder="New class, e.g. GT3 or Prototype" aria-label="New Race Class name"><button type="button" class="btn" data-class-create="${f.id}">Create class</button></div>`
        : f.featured
          ? `<div class="rs-track-pick">${pick}<div class="rs-track-preview" id="${id}-preview"></div></div>`
          : f.preview === 'fueltrack' || f.preview === 'safetytrack'
            ? `<div class="fuel-track-pick">${pick}<div class="fuel-track-preview" id="${id}-preview"></div></div>`
            : pick;
      break;
    }
    case 'fuelmath':
      inp = `<div class="fuel-math" id="fuel-math"><div class="fuel-math-meter" aria-hidden="true"><i></i></div><div class="fuel-math-stat"><b id="fuel-math-laps">–</b><small>from a full tank</small></div><div class="fuel-math-stat"><b id="fuel-math-fill">–</b><small>empty → full</small></div><p class="muted hint" id="fuel-math-note"></p></div>`;
      break;
    case 'trackcallsummary':
      inp = `<div class="rs-trackcall-summary" id="${id}-summary"></div>`;
      break;
    case 'country':
      inp = `<select id="${id}"><option value=""></option>${COUNTRIES.map(([c, n]) => `<option value="${c}"${c === v ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select><span id="${id}-flag">${flagHtml(v)}</span>`;
      break;
    case 'tracklength':
      inp = `<div class="imgrow"><input id="${id}" type="number" min="0" step="any" value="${esc(typedText(f, v) ?? Speed.parseLength(v))}"${unitAttrs(f, v)}> <span>${dUnit() === 'ft' ? 'feet' : 'metres'}</span>
      <button type="button" class="btn" data-calcopen="1">Calculate from track pieces…</button></div><div id="calc" class="card" hidden>${calcHtml((extra && extra.pieces) || [])}</div>`;
      break;
    case 'penaltytypes':
      inp = `<p class="muted hint">A named button for the Race Director. It can add penalty points and/or immediately add time, deduct scoring laps or queue a mandatory pit stop. Older saved pit penalties remain available unchanged.</p><div id="pt-box">${ptRows((extra && extra.types) || [])}</div><button type="button" class="btn" data-ptadd="1">Add a special penalty</button>`;
      break;
    case 'penaltyrules':
      inp = `<p class="muted hint">The highest level reached is the total result. For example: 3 points = 5 seconds, then 5 points = 10 seconds means 5 points is +10 seconds, not +15.</p><div id="pr-box">${prRows((extra && extra.prules) || [])}</div><button type="button" class="btn" data-pradd="1">Add a point level</button>`;
      break;
    case 'damagelevels':
      inp = `<p class="muted hint">The highest level a car has reached counts. A car must stand still on the sensor in the pits for the seconds of its level: that repairs the damage (the points go back to 0), or retires or disqualifies the car. Leave a gap between the levels, so a hit does not skip one.</p><div id="rs-strip"></div><div id="dl-box">${dlRows((extra && extra.dlevels) || [])}</div><button type="button" class="btn" data-dladd="1">Add a level</button>`;
      break;
    case 'damageincidents':
      inp = `<p class="muted hint">Buttons for the Race Director (on the race screen, the Race Director page and the phones): each gives a car these damage points. A deslot is counted by itself when the track has a deslot time.</p><div id="di-box">${diRows((extra && extra.dincs) || [])}</div><button type="button" class="btn" data-diadd="1">Add an incident</button>`;
      break;
    case 'carfailures':
      inp = `<p class="muted hint">Each failure has a chance (in percent) that a car gets it, at a random moment of the race. It borrows the rules of a level: pit whenever you can or as fast as you can, the deadline in laps, and what the stop does (repair, retire or disqualify the car). Stand still is the time the car must stand on the sensor in the pits to clear it. A failure adds no damage points.</p><div id="cf-box">${cfRows((extra && extra.cfails) || [], (extra && extra.dlevels) || [])}</div><button type="button" class="btn" data-cfadd="1">Add a failure</button> <button type="button" class="btn" data-cfstd="1">Add the standard failures</button>`;
      break; // (1.43.0)
    case 'tyretemperature':
      inp = `<div id="tt-box">${TemperatureEditor.html(extra?.tt || {}, extra?.twt || {})}</div>`;
      break;
    case 'tyretable':
      inp = `<div id="tw-box">${twTable((extra && extra.twt) || {}, (extra && extra.twunit) || 'lap', (extra && extra.twsel) || 'S')}</div>`;
      break; // (1.40.0)
    case 'wxmult':
      inp = `<div id="tw-mult">${twMult((extra && extra.twm) || {})}</div>`;
      break;
    case 'tyresets':
      inp = twSets((extra && extra.tws) || {}, extra && extra.twt);
      break; // (1.41.0)
    case 'pspresets':
      inp = psPresets((extra && extra.psKey) || '');
      break; // (1.54.0)
    case 'carstat':
      inp = `<input id="${id}" type="text" value="${esc(v ?? '')}" disabled>`;
      break; // (1.30.0: a figure worked out for the form, such as the Mileage of a slotcar; the screen fills it in)
    case 'cartracks':
      inp = `<div id="${id}" class="svc-tracks-box"></div>`;
      break; // (1.33.0: the table of the tracks of a slotcar; the screen fills it in)
    case 'members':
      inp = `<div id="mem-box">${memRows((extra && extra.members) || [], state.refs[f.ref] || [])}</div>`;
      break;
    case 'gallery':
      inp = `<div id="gal-box" class="gallery"></div><input id="${id}" type="file" accept="image/*" multiple data-gallery="1"><p class="muted">Up to ${GALLERY_MAX} extra pictures. A screenshot of a parts list is fine.</p>`;
      break;
    case 'image':
      inp = `<div class="imgrow"><img id="${id}-img" class="thumb" ${v ? `src="${esc(v)}"` : 'hidden'} alt=""><input id="${id}" type="file" accept="image/*"><button type="button" class="btn" data-clear="${f.id}">Remove</button></div>`;
      break;
    default:
      inp = `<input id="${id}" type="text"${f.maxLength ? ` maxlength="${f.maxLength}"` : ''}${f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : ''} value="${esc(typedText(f, v) ?? v)}"${unitAttrs(f, v)}>`;
  }
  if (f.automatic) {
    // (a number or a day that the database keeps by itself; Laps Since Last Interval has the button that starts the count again, 1.30.0)
    inp =
      f.type === 'datetime'
        ? `<input id="${id}" type="text" value="${esc(v ? plainDate(v) : 'Never')}" disabled>`
        : `<input id="${id}" type="number" value="${esc(v ?? 0)}" disabled>`;
    if (f.reset) inp = `<div class="imgrow">${inp}<button type="button" class="btn" data-svcreset="1">Reset</button></div>`;
  }
  const wide =
    (f.full ? ' full' : '') +
    ([
      'longtext',
      'gallery',
      'tracklength',
      'image',
      'penaltytypes',
      'penaltyrules',
      'damagelevels',
      'damageincidents',
      'carfailures',
      'tyretable',
      'wxmult',
      'tyresets',
      'pspresets',
      'members',
      'cartracks',
      'trackcallsummary',
      'fuelmath'
    ].includes(f.type)
      ? ' full'
      : '') +
    (['penaltytypes', 'penaltyrules', 'damagelevels', 'damageincidents', 'carfailures', 'tyretable', 'wxmult', 'tyresets'].includes(f.type)
      ? ' listfield'
      : '') +
    (f.tone ? ` rs-system-field rs-system-${esc(f.tone)}` : ''); // (listfield: a table of rows that has a section of its own; in the rail form the section says what it is, so its name is not repeated, 1.73.0)
  return `<div class="field${wide}" data-key="${f.id}">${lab}${inp}${fh(f) ? `<span class="muted hint">${esc(fh(f))}</span>` : ''}${f.reset ? '<span class="muted hint svc-note" id="svc-note"></span>' : ''}</div>`;
}

// A field with showIf is shown when any one of its conditions matches the current form values.
const isShown = (f, get) => !f.showIf || f.showIf.some(c => Object.entries(c).every(([k, vs]) => vs.includes(get(k) ?? ''))); // (a setting that has no value yet is empty: a race setup from before the setting existed)

// A picture file as the address to keep in the database. How much it is shrunk depends on the picture quality setting (picture.js, App Settings > General > Pictures):
// by default it is kept as it was uploaded. `max` is the size the place was made for (used by the standard quality); `png` is not needed any more: a picture is kept in the kind it came in.
const fileAsDataUrl = file =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('That file could not be read.'));
    r.readAsDataURL(file);
  });
function resizeImage(file, max = 256, png = false) {
  // eslint-disable-line no-unused-vars
  return Picture.load(file, max, Picture.levelOf(state.settings && state.settings.pictureQuality), {
    url: { create: f => URL.createObjectURL(f), revoke: u => URL.revokeObjectURL(u) },
    newImage: () => new Image(),
    read: fileAsDataUrl,
    newCanvas: (w, h) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return c;
    }
  });
}

const GALLERY_MAX = 12;

// the groups of fields that are open in the form of each kind of item (kept while the app is open); a kind of item without groups has one flat list
const formOpen = {};
