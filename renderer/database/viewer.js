// database: the read-only view of a record
// (part of renderer/database.js: loaded just before it by index.html; the parts share the page's global scope)
// The view card of a slotcar, a track or a driver (click its row or card): everything that is filled in, to look at, with nothing to change here.
// The main picture is on top, then the details, then (slotcars) the other pictures as small ones to click. A click on a picture shows it large; a click on that, or Escape, closes it.
function openView(e, item) {
  const s = state.schema[e];
  const getv = k =>
    e === 'tracks' && k === 'laneModifier'
      ? Speed.modifier(item)
      : e === 'slotcars' && k === 'servicesDone'
        ? CarStats.servicesOf(item)
        : item[k]; // (a track saved before the lane length modifier shows what it always did)
  const filled = v => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length);
  const named = (s.title || []).length === 1; // (a name is the title of the card already; brand, manufacturer and model are three facts, so they stay in the list)
  const rows = [
    ...s.fields
      .filter(f => !['image', 'gallery'].includes(f.type) && !(named && s.title.includes(f.key)) && isShown(f, getv) && filled(getv(f.key)))
      .map(f => ({
        label: fl(f),
        html: f.type === 'longtext' ? esc(getv(f.key)).replace(/\n/g, '<br>') : cell(f, getv(f.key)),
        wide: f.type === 'longtext',
        sec: e === 'slotcars' && f.group === 'stats' ? 'service' : 'details'
      })),
    ...(e === 'slotcars'
      ? [
          { label: 'Next Service', html: `<span id="vc-service"></span>`, sec: 'service' },
          ...CAR_STATS.map(f => ({ label: f.label, html: `<span id="vc${f.key}">Calculating…</span>`, sec: 'stats', key: f.key })),
          { label: CAR_TRACKS.label, html: '<div id="vc_byTrack">Calculating…</div>', wide: true, sec: 'tracks' }
        ]
      : []), // (1.30.0 the mileage, 1.33.0 the rest: worked out from the laps when the card is open)
    ...(e === 'drivers' && item.driverType !== 'virtual' && typeof api.driverProgress === 'function'
      ? [{ label: 'Progress', html: '<div id="vc_progress">Calculating…</div>', wide: true, sec: 'progress' }]
      : []), // (2.3.0: faster and steadier over time, per track and month)
    ...(state.custom[e] || [])
      .filter(f => filled((item.custom || {})[f.id]))
      .map(f => ({ label: f.label, html: esc(item.custom[f.id]), sec: 'details' }))
  ];
  // (2.4.0, SlotForgeRestyle.md "Record Card") the parts of the card: the figures as tiles first, then the service with its meter, the tracks, the details, the progress of a driver last
  const SECS = [
    ['stats', 'Statistics'],
    ['service', 'Service'],
    ['tracks', ''],
    ['details', 'Details'],
    ['progress', '']
  ];
  const svcSt = e === 'slotcars' ? CarStats.status(item) : null,
    meter =
      svcSt && svcSt.interval
        ? `<div class="vcmeter${svcSt.due ? ' due' : ''}" role="img" aria-label="${esc(svcSt.since + ' of ' + svcSt.interval + ' laps since the last service')}"><i style="--p:${Math.min(100, Math.round((svcSt.since / svcSt.interval) * 100))}%"></i><span>${esc(svcSt.since.toLocaleString('en-US'))} / ${esc(svcSt.interval.toLocaleString('en-US'))} laps</span></div>`
        : '';
  const rowHtml = r => `<div${r.wide ? ' class="wide"' : ''}><dt>${esc(r.label)}</dt><dd>${r.html}</dd></div>`;
  const sections = SECS.map(([k, title]) => {
    const mine = rows.filter(r => (r.sec || 'details') === k);
    if (!mine.length) return '';
    return `<section class="vcsec vcsec-${k}">${title ? `<h4 class="vcsechead">${esc(title)}</h4>` : ''}${k === 'service' ? meter : ''}<dl class="vcfields${k === 'stats' ? ' vcstats' : ''}">${mine.map(rowHtml).join('')}</dl></section>`;
  }).join('');
  const kind = { slotcars: 'Slotcar', drivers: 'Driver', tracks: 'Track' }[e] || '';
  const t = titleOf(e, item),
    main = s.image && item[s.image],
    frame = s.image && item[s.image + 'Frame'];
  const gal = s.gallery && Array.isArray(item[s.gallery]) ? item[s.gallery].filter(Boolean) : [];
  const pics = [main, ...gal].filter(Boolean); // (what a click can show large: the main picture first)
  dlg.oninput = null;
  dlg.onchange = null;
  dlg.innerHTML = `<div class="vcard vc-${esc(e)}"><div class="vchead"><button type="button" class="vcpic gimg${main ? '' : ' nopic'}"${main ? ' data-big="0" aria-label="Show the picture large"' : ' tabindex="-1" aria-hidden="true"'}>${main ? `<img src="${esc(main)}" alt="" style="transform:${Widgets.frameTransform(frame)}">` : `<span class="ph" style="background:${hue(t)}">${esc((t.trim()[0] || '?').toUpperCase())}</span>`}</button>
    <div class="vchead-t">${kind ? `<span class="vckind">${kind}</span>` : ''}<h3 class="vctitle">${esc(t)}</h3>${svcSt && svcSt.due ? '<span class="svc-due">Service due</span>' : ''}</div></div>
    ${e === 'slotcars' && typeof PaddockSpecs !== 'undefined' ? PaddockSpecs.html(item) : ''}
    ${rows.length ? sections : '<p class="muted">Nothing more is filled in.</p>'}
    ${gal.length ? `<h4 class="vcgaltitle">${gal.length === 1 ? 'Another picture' : gal.length + ' more pictures'}</h4><div class="vcgal">${gal.map((src, i) => `<button type="button" class="vcthumb" data-big="${i + (main ? 1 : 0)}" aria-label="Show picture ${i + 1} large"><img class="galthumb" src="${esc(src)}" alt="Picture ${i + 1}"></button>`).join('')}</div>` : ''}
    <div class="row"><button class="btn" type="button" id="vcclose">Close</button><button class="btn primary" type="button" id="vcedit">${e === 'slotcars' && item.paddock ? 'Edit Timing settings' : 'Edit'}</button></div>
    <div class="vcbig" id="vcbig" hidden role="dialog" aria-label="Large picture"><img id="vcbigimg" alt=""><p>Click the picture or press Escape to close it</p></div></div>`;
  let large = false; // is a picture shown large at the moment? (it covers the card, so any click while it is shown is a click on it)
  if (e === 'slotcars' && typeof PaddockSpecs !== 'undefined') PaddockSpecs.mount(dlg.querySelector('.paddock-specs'), item);
  const showLarge = on => {
    large = on;
    byId('vcbig').hidden = !on;
  };
  dlg.oncancel = ev => {
    if (large) {
      ev.preventDefault();
      showLarge(false);
    }
  }; // (Escape closes the large picture first, then the card)
  dlg.onclick = ev => {
    if (large) return showLarge(false);
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.id === 'vcclose') return dlg.close();
    if (b.id === 'vcedit') return openForm(e, item);
    if (b.dataset && b.dataset.big !== undefined && pics[Number(b.dataset.big)]) {
      byId('vcbigimg').src = pics[Number(b.dataset.big)];
      showLarge(true);
    }
  };
  if (!dlg.open) dlg.showModal();
  if (e === 'slotcars') {
    // the statistics of the car, as in its form
    const svc = byId('vc-service'),
      st = CarStats.status(item);
    svc.textContent = CarStats.note(st);
    svc.className = st.due ? 'svc-note due' : '';
    const target = byId('vc_byTrack'),
      current = () => byId('vc_byTrack') === target;
    loadCarStats(item)
      .then(d => {
        if (!current()) return;
        const t = carStatTexts(d);
        CAR_STATS.forEach(f => {
          byId('vc' + f.key).textContent = t[f.key];
        });
        if (d.fastest && d.fastest.trackName)
          byId('vc_fastest').innerHTML = `${esc(Stats.fmtMs(d.fastest.time))}<small> on ${esc(d.fastest.trackName)}</small>`;
        target.innerHTML = carTracksHtml(d);
      })
      .catch(() => {
        if (!current()) return;
        CAR_STATS.forEach(f => {
          byId('vc' + f.key).textContent = '–';
        });
        target.textContent = '–';
      });
  }
  if (e === 'drivers' && typeof api.driverProgress === 'function' && byId('vc_progress')) {
    const target = byId('vc_progress');
    api
      .driverProgress(item.id)
      .then(d => {
        if (byId('vc_progress') === target) target.innerHTML = DriverProgress.html(d);
      })
      .catch(x => {
        if (byId('vc_progress') === target) target.textContent = 'Could not work it out: ' + x.message;
      });
  }
  byId('vcclose').focus({ preventScroll: true }); // (so the card opens at its top)
}
