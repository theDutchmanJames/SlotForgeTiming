// database: the list page of every entity (drivers, cars, tracks, teams, setups and systems)
// (part of renderer/database.js: loaded just before it by index.html; the parts share the page's global scope)
const managerLoads = new WeakMap();
function mountManager(box, e) {
  const prior = managerLoads.get(box);
  if (prior && prior.entity === e && prior.run === subRun) return prior.promise;
  const entry = { entity: e };
  const job = mountManagerPage(box, e);
  entry.run = subRun;
  entry.promise = job
    .catch(error => {
      if (entry.run !== subRun || box.isConnected === false) return;
      box.innerHTML =
        '<p role="alert">' +
        esc(error.message || 'The database could not be loaded.') +
        '</p><button class="btn" data-retry-catalogue>Retry</button>';
      box.onclick = event => {
        if (event.target.closest('[data-retry-catalogue]')) mountManager(box, e);
      };
    })
    .finally(() => {
      if (managerLoads.get(box) === entry) managerLoads.delete(box);
    });
  managerLoads.set(box, entry);
  return entry.promise;
}
async function mountManagerPage(box, e) {
  const run = ++subRun;
  stopCataloguePictures();
  manager = { box, e, act: null }; // (act: what a button of the list does, also for the More menu of a sheet: 2.4.0)
  box.onclick = null;
  box.onchange = null;
  box.onkeydown = null;
  box.innerHTML = '<p role="status" aria-live="polite">Loading ' + esc(state.schema[e]?.plural || 'database') + '…</p>';
  let s = state.schema[e];
  const garage = typeof Garage !== 'undefined' && VIEW_ENTITIES.includes(e); // (2.4.0, "Garage": tracks, drivers, teams and slotcars as cards that say what they are)
  const direct = e === 'slotcars' && api.libraryStatus ? (await api.libraryStatus()).available : false;
  if (direct && !s.fields.some(f => f.key === 'name'))
    s = { ...s, fields: [{ key: 'name', label: 'Car name', type: 'text' }, ...s.fields] };
  const shared = !direct && e === 'slotcars' && api.paddockStatus ? (await api.paddockStatus()).connection?.mode === 'local' : false;
  if (run !== subRun || box.isConnected === false) return;
  const remoteView = () =>
    e === 'slotcars' &&
    (slotcarSource === 'paddock' || (shared && slotcarSource !== 'timing-only')) &&
    typeof PaddockBrowser !== 'undefined';
  const mountPaddock = () => {
    box.innerHTML = '<div data-paddock-browser></div>';
    box.onclick = null;
    box.onchange = null;
    box.onkeydown = null;
    PaddockBrowser.mount(box.querySelector('[data-paddock-browser]'), api, {
      shared,
      openLocal: () => {
        slotcarSource = shared ? 'timing-only' : 'local';
        mountManager(box, e);
      },
      view: async car => {
        const [custom, classes, tyres] = await Promise.all([
          api.customFields('slotcars'),
          api.list('raceclasses'),
          api.list('tyrewearsystems')
        ]);
        if (run !== subRun) return;
        state.custom.slotcars = custom;
        state.refs.raceclasses = classes;
        state.refs.tyrewearsystems = tyres;
        openView('slotcars', car);
      }
    });
  };
  // A remote listing does not need the photo-heavy local slotcar table.
  // Explicit "view this car" navigation is resolved below before choosing a view.
  if (remoteView() && !state.focusCar) return mountPaddock();
  const paged = VIEW_ENTITIES.includes(e) && typeof api.catalogue === 'function';
  if (!cataloguePages.has(e)) cataloguePages.set(e, { search: '', cursors: [null], index: 0 });
  const paging = cataloguePages.get(e);
  let page = null,
    pageNotice = '';
  async function fetchPage() {
    try {
      return await api.catalogue(e, {
        search: paging.search,
        limit: garage && e !== 'slotcars' ? 100 : 48,
        cursor: paging.cursors[paging.index]
      });
    } catch (error) {
      if (run !== subRun) return null;
      if (!/catalogue changed/i.test(error.message) || paging.index === 0) throw error;
      paging.cursors = [null];
      paging.index = 0;
      pageNotice = 'The catalogue changed. Showing the first page.';
      return api.catalogue(e, { search: paging.search, limit: garage && e !== 'slotcars' ? 100 : 48 });
    }
  }
  const [listed, custom] = await Promise.all([paged ? fetchPage() : api.list(e), s.extra === false ? [] : api.customFields(e)]);
  if (run !== subRun || box.isConnected === false) return;
  if (paged) page = listed;
  const storedItems = paged
    ? page.items.map(({ record, hasPicture, galleryCount }) => ({
        ...record,
        ...(hasPicture ? { [s.image]: { _cataloguePicture: true, id: record.id } } : {}),
        ...(s.gallery && galleryCount ? { [s.gallery]: { _catalogueGallery: galleryCount } } : {})
      }))
    : listed;
  const items = paged ? storedItems : databaseOrdered(e, e === 'slotcars' ? storedItems.filter(c => !c.paddock) : storedItems);
  if (run !== subRun) return;
  state.custom[e] = custom;
  if (e === 'racesetups') state.rulePlugins = api.pluginRuleCatalog ? await api.pluginRuleCatalog() : [];
  for (const f of s.fields)
    if (f.type === 'ref' || f.type === 'members')
      state.refs[f.ref] = typeof referenceList === 'function' && s.imageFrom !== f.key ? await referenceList(f.ref) : await api.list(f.ref);
  if (e === 'slotcars') state.refs.tyrewearsystems = await api.list('tyrewearsystems');
  if (e === 'racesetups') state.refs.championships = await api.list('championships'); // (1.71.0: the box Used by in the form of a race setup names the championships that use it)
  if (s.used) state.refs[s.used.entity] = await api.list(s.used.entity); // (1.73.0: the box Used by in the form of a system names the race setups that choose it)
  // the figures of the cards: races, wins, best laps and records, from the saved races
  const gx = garage ? garageContext(e, items, Garage.statsOf(await api.list('sessions').catch(() => [])), direct) : null;
  if (run !== subRun) return;
  let detailRequest = 0,
    pagingBusy = false,
    systemSaveBusy = false;
  const fullItem = async id => {
    const request = ++detailRequest,
      item = paged ? await api.getRecord(e, id) : storedItems.find(c => c.id === id);
    if (request !== detailRequest || run !== subRun || box.isConnected === false) return null;
    return item;
  };
  const viewItem = id => {
    if (!paged) {
      const item = storedItems.find(c => c.id === id);
      if (item) openView(e, item);
      return;
    }
    return fullItem(id).then(item => {
      if (item) openView(e, item);
    });
  };
  const focused =
    paged && e === 'slotcars' && state.focusCar ? await fullItem(state.focusCar) : storedItems.find(c => c.id === state.focusCar);
  if (e === 'slotcars' && state.focusCar && focused?.paddock) {
    state.focusCar = null;
    openView(e, focused);
  }
  if (e === 'slotcars' && state.focusCar) slotcarSource = 'local';
  if (remoteView()) return mountPaddock();
  const cols = s.list
    ? s.list.map(k => columnOf(s, k)).map(f => ({ label: fl(f), get: i => columnCell(f, i) }))
    : [
        ...s.fields.map(f => ({ label: fl(f), get: i => cell(f, i[f.key]) })),
        ...custom.map(f => ({ label: f.label, get: i => esc((i.custom || {})[f.id] ?? '') }))
      ];
  const viewKey = e === 'racesetups' ? 'setupView' : 'dbView'; // Race Setups remembers its own list / grid choice
  const mode = s.card ? state.settings[viewKey] || (e === 'racesetups' ? 'grid' : 'list') : 'list'; // (1.69.0: the Race Setups page starts as cards)
  // View settings (Tracks, Drivers, Slotcars): the columns of the list and the rows of the cards can be turned on and off. The list starts with every field, a card with the fields of the schema's card.
  const viewable = VIEW_ENTITIES.includes(e) && !!s.card && !s.list,
    cardKeys = s.card || [];
  const canView = VIEW_ENTITIES.includes(e); // a row or a card can be clicked to see everything of it (the view card)
  const customCand = f => ({ key: 'custom:' + f.id, label: f.label, custom: f });
  const listCands = !viewable
    ? null
    : [
        ...s.fields.map(f => ({ key: f.key, label: fl(f), on: !garage, field: f })),
        ...custom.map(f => ({ ...customCand(f), on: !garage }))
      ]; // (a Garage list has its figures; more columns are chosen in View settings)
  const gridCands = !viewable
    ? null
    : [
        ...cardKeys
          .map(k => s.fields.find(f => f.key === k))
          .filter(Boolean)
          .map(f => ({ key: f.key, label: fl(f), on: !garage, field: f })),
        ...s.fields
          .filter(f => !['image', 'gallery'].includes(f.type) && !(s.title || []).includes(f.key) && !cardKeys.includes(f.key))
          .map(f => ({ key: f.key, label: fl(f), on: false, field: f })),
        ...custom.map(f => ({ ...customCand(f), on: false }))
      ];
  const modeCands = mode === 'grid' ? gridCands : listCands,
    shownKeys = viewable ? ViewSet.keys(modeCands, viewSaved([e, mode])) : [];
  const candValue = (c, i) => (c.field ? i[c.field.key] : (i.custom || {})[c.custom.id]);
  const candHtml = (c, v) => (c.field ? cell(c.field, v) : esc(v ?? ''));
  const viewCols =
    !viewable || mode === 'grid'
      ? null
      : listCands.filter(c => shownKeys.includes(c.key)).map(c => ({ label: c.label, get: i => candHtml(c, candValue(c, i)) }));
  const viewId = 'mgr:' + e;
  const viewBtn = viewable ? viewButton(viewId) : '';
  const bar =
    !viewable || !viewBars.has(viewId)
      ? ''
      : viewBar(
          viewId,
          mode === 'grid'
            ? 'Turn rows of information on or off for the cards. This is remembered for the Grid view of this page.'
            : 'Turn columns of information on or off for the list. This is remembered for the List view of this page.',
          [
            viewGroup(
              mode === 'grid' ? `Rows on the ${s.label.toLowerCase()} cards` : `Columns in the ${s.label.toLowerCase()} list`,
              [e, mode],
              modeCands
            )
          ]
        );
  const toggle = !s.card
    ? ''
    : `<span class="seg" role="group" aria-label="View"><button class="btn${mode === 'list' ? ' on' : ''}" id="vlist" aria-pressed="${mode === 'list'}">${e === 'racesetups' ? 'Table' : 'List'}</button><button class="btn${mode === 'grid' ? ' on' : ''}" id="vgrid" aria-pressed="${mode === 'grid'}">${e === 'racesetups' ? 'Comparison rows' : 'Grid'}</button></span>`;
  const designButton = i =>
    e === 'tracks' ? `<button class="btn" data-track-design="${esc(i.id)}" title="Track design">Track design</button>` : '';
  const copyButton = i =>
    COPY_SETUP_ENTITIES.has(e)
      ? `<button class="btn" type="button" data-copy="${esc(i.id)}" title="Create an independent copy of ${esc(titleOf(e, i))}">Copy</button>`
      : '';
  const gridHtml = (items, skip) =>
    `<div class="cards">${items
      .map(i => {
        // the picture: the item's own, or (race setups) the picture of the track it uses; each with its own framing
        let img = s.image && i[s.image],
          frame = s.image && i[s.image + 'Frame'];
        if (s.imageFrom) {
          const rf = s.fields.find(x => x.key === s.imageFrom),
            tr = (state.refs[rf.ref] || []).find(x => x.id === i[rf.key]),
            re = state.schema[rf.ref];
          img = tr && re.image && tr[re.image];
          frame = tr && re.image && tr[re.image + 'Frame'];
        }
        const t = titleOf(e, i);
        const details =
          (viewable
            ? gridCands
                .filter(c => shownKeys.includes(c.key))
                .map(c => {
                  const v = candValue(c, i);
                  return v === undefined || v === null || v === ''
                    ? ''
                    : `<div class="gd"><span class="muted">${esc(c.label)}</span> ${candHtml(c, v)}</div>`;
                })
            : s.card
                .filter(k => k !== skip)
                .map(k => {
                  const f = columnOf(s, k),
                    v = f.virtual ? f.virtual.get(i) : i[k];
                  return v === undefined || v === null || v === ''
                    ? ''
                    : `<div class="gd"><span class="muted">${esc(fl(f))}</span> ${columnCell(f, i)}</div>`;
                })
          ).join('') +
          (s.gallery && (i[s.gallery]?._catalogueGallery || i[s.gallery]?.length)
            ? `<div class="gd muted">+${i[s.gallery]._catalogueGallery || i[s.gallery].length} more pictures</div>`
            : '');
        return `<article class="gcard${canView ? ' clickable' : ''}"${canView ? ` data-view="${esc(i.id)}" tabindex="0" aria-label="View ${esc(t)}"` : ''}><div class="gimg">${img?._cataloguePicture ? catalogueImage(img, '', frame) : img ? `<img src="${esc(img)}" alt="" style="transform:${Widgets.frameTransform(frame)}">` : noPicture(e, t)}</div>
      <div class="gbody"><h3>${esc(t)}</h3>${rowMark(e, i)}${details}${typeof RaceSystems !== 'undefined' && i.sessionType !== 'tokens' ? RaceSystems.setupHtml(i, { compact: true, id: i.id }) : ''}</div><div class="row gfoot"><button class="btn" data-edit="${esc(i.id)}"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>Edit</button>${copyButton(i)}${designButton(i).replace('>Track design<', '><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12a7 5 0 1 0 14 0a7 5 0 1 0-14 0"/></svg>Track design<')}${direct ? `<button class="btn danger" data-del="${esc(i.id)}">Archive…</button>` : `<button class="btn danger icon" data-del="${esc(i.id)}" aria-label="Delete ${esc(t)}" title="Delete"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button>`}</div></article>`;
      })
      .join('')}</div>`;
  const tableHtml = (items, cols) =>
    `<div class="wrap"><table class="fields"><tr>${cols.map(c => `<th>${esc(c.label)}</th>`).join('')}<th></th></tr>` +
    items
      .map(
        i => `<tr${canView ? ` class="clickable" data-view="${esc(i.id)}" tabindex="0" aria-label="View ${esc(titleOf(e, i))}"` : ''}>${cols.map((c, n) => `<td>${c.get(i)}${n === 0 ? rowMark(e, i) : ''}</td>`).join('')}<td class="actions">
      <button class="btn" data-edit="${esc(i.id)}">Edit</button> ${copyButton(i)} ${designButton(i)} <button class="btn danger" data-del="${esc(i.id)}">${direct ? 'Archive…' : 'Delete'}</button></td></tr>`
      )
      .join('') +
    '</table></div>';
  // Race setups (1.69.0): a row of kinds to filter on, and each setup as a card that says in words how it ends and who wins (setupwords.js). The folders per session type are gone.
  const setupRank = i => {
    const rank = SETUP_START.findIndex(([kind]) => kind === i.sessionType);
    return rank < 0 ? SETUP_START.length : rank;
  };
  const rsShown =
    e !== 'racesetups'
      ? items
      : items.filter(i => setupFilter === 'all' || i.sessionType === setupFilter).sort((a, b) => setupRank(a) - setupRank(b));
  const rsCtx = i => ({
    track: (state.refs.tracks || []).find(t => t.id === i.track) || null,
    rotation: ((state.refs.rotationsetups || []).find(r => r.id === i.rotation) || {}).name || '',
    dist: n => Distance.text(n, dUnit())
  });
  const rsCard = i => {
    const d = SetupWords.describe(i, rsCtx(i)),
      t = titleOf(e, i);
    const linked =
      typeof RaceSystems !== 'undefined' && i.sessionType !== 'tokens' ? RaceSystems.ITEMS.filter(x => RaceSystems.configured(i, x)) : [];
    const off = typeof RaceSystems !== 'undefined' ? RaceSystems.clean(i.disabledSystems) : [];
    const enabled = linked.filter(x => !off.includes(x.key)).length;
    return `<article class="rscard"><div class="rsidentity" data-kind="${esc(i.sessionType)}"><div class="rshead"><span class="rstile">${Icons.svg(SETUP_KIND_ICON[i.sessionType] || 'racesetups', { size: 22 })}</span><div class="rstitle"><div class="rseye">${esc(d.kind)}</div><div class="rsname">${esc(t)}</div></div>
      <span class="rsdot${d.ready.ok ? '' : ' off'}" role="img" title="${esc(d.ready.text)}" aria-label="${esc(d.ready.text)}"></span></div>
      <div class="rspills">${d.cardPills.map(p => `<span class="rspill${p.tone ? ' ' + p.tone : ''}">${esc(p.text)}</span>`).join('')}</div>
      <div class="rsfacts"><div class="rslv"><span class="k">Ends</span><span>${esc(d.ends)}</span></div><div class="rslv"><span class="k">Wins</span><span>${esc(d.wins)}</span></div></div></div>
      <section class="rslinked" aria-label="Systems for ${esc(t)}"><div class="rslinked-head"><strong>Race Systems</strong><span>${linked.length ? `${enabled} on${linked.length > enabled ? ` · ${linked.length - enabled} off` : ''}` : 'None linked'}</span></div>${linked.length ? RaceSystems.setupHtml(i, { compact: true, overview: true, id: i.id }) : `<p class="rslinked-empty">${i.sessionType === 'tokens' ? 'This session uses Time Tokens instead of Race Systems.' : 'A simple session without extra systems.'}</p>`}</section><div class="row rsactions"><button class="btn" data-edit="${esc(i.id)}">Edit setup</button>${copyButton(i)}${designButton(i)}<button class="btn danger" data-del="${esc(i.id)}">Delete</button></div></article>`;
  };
  // (2.4.0) a race system as a card in the grid of the race setups: what it is, its key settings, and which race setups use it
  const sysLook = e !== 'racesetups' && typeof SETUP_LOOK !== 'undefined' ? SETUP_LOOK[e] : null;
  const sysCard = i => {
    const t = titleOf(e, i),
      used = s.used ? (state.refs[s.used.entity] || []).filter(r => r && r[s.used.key] === i.id) : [];
    const facts = (s.card || [])
      .map(k => {
        const f = columnOf(s, k);
        if (!f) return '';
        const v = f.virtual ? f.virtual.get(i) : i[k];
        return v === undefined || v === null || v === ''
          ? ''
          : `<div class="gd"><span class="muted">${esc(fl(f))}</span> ${columnCell(f, i)}</div>`;
      })
      .join('');
    return `<article class="rscard syscard ss-${sysLook[1]}"${canView ? ` data-view="${esc(i.id)}" tabindex="0" aria-label="View ${esc(t)}"` : ''}><div class="rsidentity" data-kind="system"><div class="rshead"><span class="rstile">${Icons.svg(sysLook[0], { size: 22 })}</span><div class="rstitle"><div class="rseye">${esc(s.label)}</div><div class="rsname">${esc(t)}</div></div>${rowMark(e, i)}</div>
      <div class="rsfacts sysfacts">${facts || '<p class="muted">The standard settings.</p>'}</div></div>
      <section class="rslinked" aria-label="Race setups that use ${esc(t)}"><div class="rslinked-head"><strong>Used by</strong><span>${used.length ? used.length + (used.length === 1 ? ' race setup' : ' race setups') : 'Not used yet'}</span></div>${
        used.length
          ? `<div class="rspills">${used
              .slice(0, 3)
              .map(r => `<span class="rspill">${esc(String(r.name || '').trim() || '(unnamed)')}</span>`)
              .join('')}${used.length > 3 ? `<span class="rspill">+${used.length - 3}</span>` : ''}</div>`
          : '<p class="rslinked-empty">Choose it under Rules and systems in a race setup.</p>'
      }</section><div class="row rsactions"><button class="btn" data-edit="${esc(i.id)}">Edit</button>${copyButton(i)}<button class="btn danger" data-del="${esc(i.id)}">Delete</button></div></article>`;
  };
  const rsFilter =
    e !== 'racesetups'
      ? ''
      : `<span class="seg rsfilter" role="group" aria-label="Show">${SETUP_FILTERS.map(([id, label]) => `<button class="btn${setupFilter === id ? ' on' : ''}" data-rsf="${id}" aria-pressed="${setupFilter === id}">${esc(label)}</button>`).join('')}</span>`;
  const rsStart =
    e !== 'racesetups'
      ? ''
      : `<div class="rscard rsstart"><span class="rstile">${Icons.svg('plus', { size: 22 })}</span><div class="rstitle"><div class="rsname">Start from a kind</div><span class="hint">A new setup opens with the right kind already chosen.</span></div>
    <div class="rskinds">${SETUP_START.map(([id, label]) => `<button class="rspill" type="button" data-rskind="${id}">${esc(label)}</button>`).join('')}</div></div>`;
  const rsEmpty = !items.length
    ? 'No race setups yet. Use the button above, or start from a kind below.'
    : `Nothing under ${SETUP_FILTERS.find(f => f[0] === setupFilter)[1]} yet. Start one below.`;
  const rsBody =
    e !== 'racesetups'
      ? ''
      : (rsShown.length
          ? mode === 'grid'
            ? `<div class="rscards">${rsShown.map(rsCard).join('')}</div>`
            : tableHtml(rsShown, cols)
          : `<p class="muted">${esc(rsEmpty)}</p>`) + rsStart;
  // (2.4.0) a Garage list: the figures on top, the Control Strip, the cards or the rows, the empty card
  const gxFilters = garage ? Garage.filters(e, items, gx) : [];
  const gxFilter = garage ? (gxFilters.some(f => f.id === garageView.filter[e]) ? garageView.filter[e] : gxFilters[0].id) : '';
  const gxSort = garage ? garageView.sort[e] || 'name' : 'name';
  const gxShown = garage ? Garage.sortItems(e, gxSort, Garage.filterItems(e, gxFilter, items, gx), gx) : [];
  if (garage && !garageView.picked.has(e)) garageView.picked.set(e, new Set());
  const gxPicked = garage ? garageView.picked.get(e) : null;
  if (gxPicked) for (const id of [...gxPicked]) if (!items.some(i => i.id === id)) gxPicked.delete(id);
  const gxPicture = i => {
    const img = s.image && i[s.image],
      frame = s.image && i[s.image + 'Frame'];
    return img?._cataloguePicture
      ? catalogueImage(img, '', frame)
      : img
        ? `<img src="${esc(img)}" alt="" style="transform:${Widgets.frameTransform(frame)}">`
        : '';
  };
  const gxDetails = i =>
    !gridCands
      ? ''
      : gridCands
          .filter(c => shownKeys.includes(c.key))
          .map(c => {
            const v = candValue(c, i);
            return v === undefined || v === null || v === ''
              ? ''
              : `<div class="gd"><span class="muted">${esc(c.label)}</span> ${candHtml(c, v)}</div>`;
          })
          .join('');
  const gxCols =
    garage && mode === 'list' && listCands
      ? listCands.filter(
          c =>
            shownKeys.includes(c.key) &&
            !['image', 'gallery'].includes(c.field && c.field.type) &&
            !(c.field && (c.field.key === 'name' || (s.title || []).includes(c.field.key)))
        )
      : [];
  const gxMark = i =>
    e === 'slotcars' && i.paddock
      ? `<span class="badge paddock-source" title="Details managed in SlotForge Paddock">Paddock${i.paddock.archived ? ' · unavailable' : ''}</span>`
      : '';
  const gxBody = !garage
    ? ''
    : !items.length
      ? Garage.emptyHtml(e, { searching: paging.search, plural: s.plural.toLowerCase() })
      : !gxShown.length
        ? Garage.emptyHtml(e, { filtered: (gxFilters.find(f => f.id === gxFilter) || {}).label, plural: s.plural.toLowerCase() })
        : mode === 'grid'
          ? `<div class="gx-grid">${gxShown.map(i => Garage.cardHtml(e, i, gx, { picture: gxPicture(i), details: gxDetails(i), mark: gxMark(i) })).join('')}</div>`
          : `${Garage.bulkHtml(e, gxPicked.size, { direct })}<div class="gx-table" role="table" ${gxCols.length ? `style="grid-template-columns:28px 76px minmax(180px,2.2fr) repeat(${gxCols.length},minmax(70px,1fr)) repeat(3,minmax(64px,.8fr)) 112px"` : ''}>${Garage.rowHead(
              e,
              gxCols,
              gxShown.length > 0 && gxShown.every(i => gxPicked.has(i.id))
            )}${gxShown
              .map(i =>
                Garage.rowHtml(e, i, gx, {
                  picture: gxPicture(i),
                  picked: gxPicked.has(i.id),
                  cells: gxCols.map(c => candHtml(c, candValue(c, i)))
                })
              )
              .join('')}</div>`;
  const gxSource =
    e === 'slotcars'
      ? `<span class="gx-gear gx-source" role="group" aria-label="Car database"><button type="button" class="on" aria-pressed="true">${direct ? 'Slotcar library' : 'Local database'}</button><button type="button" id="paddock-view" aria-pressed="false">Dealership cars</button></span>`
      : '';
  if (garage)
    box.innerHTML = `<div class="gx"><div class="gx-top">${Garage.summary(e, items, gx)}${gxSource}</div>${Garage.stripHtml({
      e,
      label: s.label.toLowerCase(),
      plural: s.plural.toLowerCase(),
      placeholder: { slotcars: 'Find a car, a make or a number', drivers: 'Find a driver', tracks: 'Find a track', teams: 'Find a team' }[
        e
      ],
      search: paging.search,
      filters: gxFilters,
      filter: gxFilter,
      sort: gxSort,
      mode
    })}${bar}${gxBody}</div>`;
  else
    box.innerHTML =
      (e === 'slotcars'
        ? '<div class="pb-toolbar"><div class="seg" role="group" aria-label="Car database"><button class="btn on" aria-pressed="true">' +
          (direct ? 'Slotcar library' : 'Local Database') +
          '</button><button class="btn" id="paddock-view" aria-pressed="false">Dealership Cars</button></div></div>'
        : '') +
      `<div class="row${e === 'racesetups' ? ' rstoolbar' : paged ? ' catalogue-toolbar' : ''}"><button class="btn primary" id="add">Add ${esc(s.label.toLowerCase())}</button>
      ${e === 'tracks' ? '<button class="btn" id="track-import">Import from Circuit</button>' : ''}${s.extra === false ? '' : '<button class="btn ghost" id="extra">Extra fields…</button>'}${rsFilter}${viewBtn}${paged ? '<div class="catalogue-controls"><div class="catalogue-tools">' : ''}${toggle}${paged ? '</div></div>' : ''}</div>${bar}` +
      (e === 'racesetups'
        ? rsBody
        : items.length && mode === 'grid'
          ? sysLook
            ? `<div class="rscards syscards">${items.map(sysCard).join('')}</div>`
            : gridHtml(items)
          : items.length
            ? tableHtml(items, viewCols || cols)
            : `<p class="muted">${paged && paging.search ? 'No matching ' + esc(s.plural.toLowerCase()) + '.' : `No ${esc(s.plural.toLowerCase())} yet. Use the button above to add one.`}</p>`);
  if (paged) {
    // (2.4.0) the pager: where you are, then small icon buttons with their names as tooltips and for screen readers
    const navigation = `<div class="row catalogue-navigation"><span role="status">Page ${paging.index + 1} · ${items.length} shown</span><button class="btn ghost icon" type="button" data-catalogue-prev aria-label="Previous page" title="Previous page"${paging.index === 0 ? ' disabled' : ''}><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button><button class="btn ghost icon" type="button" data-catalogue-next aria-label="Next page" title="Next page"${!page.next ? ' disabled' : ''}><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button><button class="btn ghost icon" type="button" data-catalogue-refresh aria-label="Refresh" title="Refresh the list"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/></svg></button></div>`;
    if (garage) {
      if (items.length && (paging.index > 0 || page.next)) box.querySelector('.gx').insertAdjacentHTML('beforeend', navigation);
      if (pageNotice) box.querySelector('.gx-strip').insertAdjacentHTML('afterend', `<p class="muted" role="status">${pageNotice}</p>`);
    } else
      box
        .querySelector('.catalogue-tools')
        .insertAdjacentHTML(
          'afterbegin',
          `<form class="row catalogue-search" data-catalogue-search role="search"><label class="catalogue-field"><span class="hs-vh">Find ${esc(s.plural.toLowerCase())}</span><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14zM20 20l-4-4"/></svg><input name="search" type="search" maxlength="200" value="${esc(paging.search)}" placeholder="Search ${esc(s.plural.toLowerCase())}" aria-label="Search ${esc(s.plural.toLowerCase())}"></label><button class="btn" type="submit">Search</button>${pageNotice ? `<span role="status">${pageNotice}</span>` : ''}</form>`
        );
    if (!garage) {
      box.querySelector('.catalogue-controls').insertAdjacentHTML('beforeend', navigation);
      if (items.length) box.insertAdjacentHTML('beforeend', navigation);
    }
    box.onsubmit = ev => {
      if (!ev.target.matches('[data-catalogue-search]')) return;
      ev.preventDefault();
      paging.search = ev.target.elements.search.value;
      paging.index = 0;
      paging.cursors = [null];
      mountManager(box, e);
    };
    stopCataloguePictures = loadCataloguePictures(box, e, page.revision, () => run === subRun && box.isConnected !== false);
  } else box.onsubmit = null;
  const viewChange = !viewable
    ? null
    : async ev => {
        // a check box of the View settings bar
        const cb = ev.target;
        if (await viewToggle(cb, path => (path === e + '/' + mode ? modeCands : null))) {
          await mountManager(box, e);
          viewFocus(box, cb);
        }
      };
  box.onchange = async ev => {
    const t = ev.target;
    if (garage && t.matches('[data-gx-sort]')) {
      garageView.sort[e] = t.value;
      return mountManager(box, e);
    }
    if (garage && t.matches('[data-pick],[data-pick-all]')) {
      if (t.dataset.pick) t.checked ? gxPicked.add(t.dataset.pick) : gxPicked.delete(t.dataset.pick);
      else for (const i of gxShown) t.checked ? gxPicked.add(i.id) : gxPicked.delete(i.id);
      return mountManager(box, e);
    }
    if (viewChange) return viewChange(ev);
  };
  // ---- (2.4.0) what the menus and the buttons of a Garage list do ----
  const remount = () => (manager?.box === box && manager.e === e && box.isConnected !== false ? mountManager(box, e) : null);
  const gxTry = async (work, what) => {
    try {
      if ((await work()) !== false) await remount();
    } catch (err) {
      await Dialog.alert(`Could not ${what}: ${err.message}`);
      await remount();
    }
  };
  const gxDelete = async list => {
    // (2.4.0, SlotForgeRestyle.md "Driver Sheet") one driver: what goes, Retire or Merge first, and the name typed for a driver with results
    if (e === 'drivers' && list.length === 1 && typeof DbSheet !== 'undefined' && typeof document !== 'undefined') {
      const it = list[0],
        laps = s.linked !== false ? await api.linkedLaps(e, it.id) : 0,
        r = DbSheet.recordOf('drivers', it.id, await api.list('sessions').catch(() => []));
      const pick = await DbSheet.askDeleteDriver(titleOf(e, it), { races: r.races, laps: laps || r.laps, records: r.records });
      if (pick === 'retire') return garageRetire([it], true);
      if (pick === 'merge') return garageMerge(it, await referenceList('drivers'));
      if (pick !== 'delete') return false;
      return api.remove(e, it.id);
    }
    let laps = 0;
    if (s.linked !== false) for (const i of list) laps += await api.linkedLaps(e, i.id);
    const name = list.length === 1 ? `"${titleOf(e, list[0])}"` : `${list.length} ${s.plural.toLowerCase()}`;
    const extra =
      s.linked === false
        ? ''
        : `\n\nThis also deletes ${laps} saved ${laps === 1 ? 'lap' : 'laps'} and the records they hold${e === 'drivers' || e === 'slotcars' ? ', and takes them out of the results of past races' : ''}.`;
    const retire = e === 'drivers' ? '\n\nTo keep their results, choose Retire instead.' : '';
    if (!(await Dialog.confirm(`Delete ${name}?${extra}${retire}\n\nThis can't be undone.`, { ok: 'Delete', danger: true }))) return false;
    for (const i of list) await api.remove(e, i.id);
  };
  const gxAct = async (act, it) => {
    if (act === 'edit') {
      if (direct && e === 'slotcars') return PaddockShared.open(libraryEditorApi(), it.id, remount);
      const full = await fullItem(it.id);
      return full && openForm(e, full);
    }
    if (act === 'design') {
      const track = await fullItem(it.id);
      return track && TrackDesignUI.open(api, track, remount);
    }
    if (act === 'duplicate') {
      if (direct) return PaddockShared.open(libraryEditorApi(), null, remount, { copyOf: it.id });
      const full = await fullItem(it.id);
      return full && openForm(e, null, carCopy(full));
    }
    if (act === 'service')
      return gxTry(async () => {
        if (
          !(await Dialog.confirm(`Mark ${titleOf(e, it)} as serviced today? Its laps since the last service start again at 0.`, {
            ok: 'Mark serviced'
          }))
        )
          return false;
        await garageServiced(e, direct ? it : await fullItem(it.id), direct);
      }, 'mark the car serviced');
    if (act === 'archive')
      return gxTry(async () => {
        const back = !!it.archived;
        if (
          !(await Dialog.confirm(
            back ? `Restore ${titleOf(e, it)} to the library?` : `Archive ${titleOf(e, it)} in both apps? Its race history stays.`,
            back ? { ok: 'Restore' } : { ok: 'Archive', danger: true }
          ))
        )
          return false;
        await librarySaveOne(it.id, back ? 'restore' : 'archive');
      }, 'archive the car');
    if (act === 'delete') return gxTry(() => gxDelete([it]), 'delete');
    if (act === 'retire' || act === 'unretire') return gxTry(() => garageRetire([it], act === 'retire'), 'change the driver');
    if (act === 'merge') return gxTry(async () => garageMerge(it, await referenceList('drivers')), 'merge the drivers');
  };
  manager.act = gxAct;
  const gxPage = async act => {
    if (act === 'extra') return openExtra(e);
    if (act === 'view') {
      if (viewBars.has(viewId)) viewBars.delete(viewId);
      else viewBars.add(viewId);
      return remount();
    }
    if (act === 'refresh') {
      paging.index = 0;
      paging.cursors = [null];
      return remount();
    }
    if (act === 'import') return gxTry(garageImport, 'read the club list');
  };
  const gxBulk = async act => {
    const list = gxShown.filter(i => gxPicked.has(i.id));
    if (act === 'clear') {
      gxPicked.clear();
      return remount();
    }
    if (!list.length) return;
    const done = async work => {
      const r = await work();
      if (r !== false) gxPicked.clear();
      return r;
    };
    if (act === 'class') return gxTry(() => done(() => garageSetClass(e, list, direct)), 'set the class');
    if (act === 'service')
      return gxTry(
        () =>
          done(async () => {
            if (
              !(await Dialog.confirm(`Mark ${list.length} ${list.length === 1 ? 'car' : 'cars'} as serviced today?`, {
                ok: 'Mark serviced'
              }))
            )
              return false;
            for (const i of list) await garageServiced(e, direct ? i : await fullItem(i.id), direct);
          }),
        'mark the cars serviced'
      );
    if (act === 'archive')
      return gxTry(
        () =>
          done(async () => {
            if (
              !(await Dialog.confirm(
                `Archive ${list.length} ${list.length === 1 ? 'car' : 'cars'} in both apps? Their race history stays.`,
                {
                  ok: 'Archive',
                  danger: true
                }
              ))
            )
              return false;
            for (const i of list) await librarySaveOne(i.id, 'archive');
          }),
        'archive the cars'
      );
    if (act === 'delete') return gxTry(() => done(() => gxDelete(list)), 'delete');
    if (act === 'retire' || act === 'unretire') return gxTry(() => done(() => garageRetire(list, act === 'retire')), 'change the drivers');
  };
  box.onkeydown = !canView
    ? null
    : ev => {
        // Enter or Space on a focused row or card opens it
        const v = ev.target && ev.target.dataset && ev.target.dataset.view;
        if (v && (ev.key === 'Enter' || ev.key === ' ') && items.some(i => i.id === v)) {
          ev.preventDefault();
          viewItem(v);
        }
      };
  box.onclick = async ev => {
    if (garage && ev.target.closest('.gx-cb')) return; // (a tick: see onchange)
    const b = ev.target.closest('button');
    if (garage && b) {
      const it = items.find(i => i.id === b.dataset.more);
      if (it) return garageMenu(b, garageCardMenu(e, it, direct), act => gxAct(act, it));
      if (b.hasAttribute('data-gx-page-more'))
        return garageMenu(
          b,
          [
            ...(s.extra === false ? [] : [{ act: 'extra', label: 'Extra fields…' }]),
            ...(viewable ? [{ act: 'view', label: viewBars.has(viewId) ? 'Hide view settings' : 'View settings…' }] : []),
            ...(e === 'drivers' ? [{ act: 'import', label: 'Import a club list…' }] : []),
            { act: 'refresh', label: 'Refresh the list' }
          ],
          gxPage
        );
      if (b.dataset.gxFilter) {
        garageView.filter[e] = b.dataset.gxFilter;
        return mountManager(box, e);
      }
      if (b.hasAttribute('data-gx-import')) return gxPage('import');
      if (b.dataset.bulk) return gxBulk(b.dataset.bulk);
      if (b.hasAttribute('data-clear-search')) {
        paging.search = '';
        paging.index = 0;
        paging.cursors = [null];
        return mountManager(box, e);
      }
      const ed = b.dataset.edit && items.find(i => i.id === b.dataset.edit);
      if (ed) return gxAct('edit', ed);
    }
    if (!b) {
      // not on a button: a click on a row or a card shows it
      const v = canView && ev.target.closest('[data-view]'),
        it = v && items.find(i => i.id === v.dataset.view);
      if (it) await viewItem(it.id);
      return;
    }
    if (
      paged &&
      (b.hasAttribute('data-catalogue-next') || b.hasAttribute('data-catalogue-prev') || b.hasAttribute('data-catalogue-refresh'))
    ) {
      if (pagingBusy || b.disabled) return;
      pagingBusy = true;
      if (b.hasAttribute('data-catalogue-next') && page.next) {
        paging.cursors[++paging.index] = page.next;
      } else if (b.hasAttribute('data-catalogue-prev') && paging.index > 0) paging.index--;
      else if (b.hasAttribute('data-catalogue-refresh')) {
        paging.index = 0;
        paging.cursors = [null];
      }
      try {
        return await mountManager(box, e);
      } finally {
        pagingBusy = false;
      }
    }
    if (e === 'racesetups' && b.dataset.systemSetup && typeof RaceSystems !== 'undefined') {
      if (systemSaveBusy || b.disabled) return;
      const row = items.find(x => x.id === b.dataset.systemSetup);
      if (!row) return;
      systemSaveBusy = true;
      const switches = [...box.querySelectorAll('[data-system-setup]')].filter(button => !button.disabled);
      switches.forEach(button => {
        button.disabled = true;
      });
      try {
        const disabledSystems = RaceSystems.toggle(row.disabledSystems, b.dataset.systemKey, b.dataset.systemOn === '1');
        await api.update(e, row.id, { disabledSystems });
        row.disabledSystems = disabledSystems;
        if (run === subRun && manager?.box === box && manager.e === e && box.isConnected !== false) await mountManager(box, e);
      } catch (err) {
        Dialog.alert('Could not change race system: ' + err.message);
      } finally {
        systemSaveBusy = false;
        switches.forEach(button => {
          button.disabled = false;
        });
      }
      return;
    }
    if (b.dataset.rsf) {
      setupFilter = b.dataset.rsf;
      return mountManager(box, e);
    } // (Race Setups: the kind to show)
    if (b.dataset.rskind) return openForm(e, null, { sessionType: b.dataset.rskind }); // (Race Setups: Start from a kind)
    if (b.dataset.viewbar) {
      if (viewBars.has(b.dataset.viewbar)) viewBars.delete(b.dataset.viewbar);
      else viewBars.add(b.dataset.viewbar);
      return mountManager(box, e);
    }
    if (b.dataset.vsreset) {
      await viewReset([[e, mode]]);
      return mountManager(box, e);
    }
    if (e === 'tracks' && (b.id === 'track-import' || b.dataset.trackDesign)) {
      const track = b.dataset.trackDesign ? await fullItem(b.dataset.trackDesign) : null;
      if (run !== subRun) return;
      return TrackDesignUI.open(api, track, () => mountManager(box, e));
    }

    if (b.id === 'paddock-view') {
      slotcarSource = 'paddock';
      return mountManager(box, e);
    }
    if (b.id === 'add') return direct ? PaddockShared.open(libraryEditorApi(), null, () => mountManager(box, e)) : openForm(e, null);
    if (b.id === 'extra') return openExtra(e);
    if (b.id === 'vgrid' || b.id === 'vlist') {
      state.settings = await api.setSettings({ [viewKey]: b.id === 'vgrid' ? 'grid' : 'list' });
      return mountManager(box, e);
    }
    if (b.dataset.copy && COPY_SETUP_ENTITIES.has(e)) {
      if (b.disabled) return;
      b.disabled = true;
      try {
        const latest = await api.list(e),
          source = latest.find(x => x.id === b.dataset.copy);
        if (!source) throw new Error('This setup no longer exists. Reopen the list and try again.');
        await api.add(e, setupCopyData(source, latest));
        if (manager?.box === box && manager.e === e && box.isConnected !== false) await mountManager(box, e);
      } catch (err) {
        Dialog.alert('Could not copy setup: ' + err.message);
      } finally {
        b.disabled = false;
      }
      return;
    }
    const it = items.find(i => i.id === (b.dataset.edit || b.dataset.del));
    if (b.dataset.edit) {
      if (direct) return PaddockShared.open(libraryEditorApi(), it.id, () => mountManager(box, e));
      const full = await fullItem(it.id);
      if (full) openForm(e, full);
    } else if (b.dataset.del) {
      if (direct) return PaddockShared.open(libraryEditorApi(), it.id, () => mountManager(box, e));
      const n = s.linked === false ? 0 : await api.linkedLaps(e, it.id);
      const extra =
        s.linked === false
          ? ''
          : `\n\nThis also deletes ${n} saved ${n === 1 ? 'lap' : 'laps'} and the records they hold${e === 'drivers' || e === 'slotcars' ? ', and takes them out of the results of past races' : ''}.`;
      if (!(await Dialog.confirm(`Delete "${titleOf(e, it)}"?${extra}\n\nThis can't be undone.`, { ok: 'Delete', danger: true }))) return;
      await api.remove(e, it.id);
      if (manager?.box === box && manager.e === e && box.isConnected !== false) mountManager(box, e); // (the list may have been left while the question was open)
    }
  };
  if (e === 'slotcars' && state.focusCar) {
    const id = state.focusCar;
    state.focusCar = null;
    await viewItem(id);
  } // Home may focus a car beyond the current page.
}
