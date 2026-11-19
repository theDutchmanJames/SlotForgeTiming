function openForm(e, item, preset) {
  // preset: values a new item starts with (Race Setups: Start from a kind)
  if (e === 'slotcars' && item?.sharedLibrary)
    return PaddockShared.open(libraryEditorApi(), item.id, () =>
      manager?.e === 'slotcars' ? mountManager(manager.box, 'slotcars') : render()
    );
  const s = state.schema[e];
  const fields = [
    ...s.fields.map(f => ({ ...f, id: f.key, custom: false })),
    ...(e === 'slotcars' ? [...CAR_STATS, CAR_TRACKS] : []),
    ...(state.custom[e] || []).map(f => ({ ...f, custom: true }))
  ];
  if (e === 'racesetups') {
    const f = fields.find(f => f.key === 'rulePlugin');
    if (f) {
      f.options = [['', 'None — built-in race rules'], ...(state.rulePlugins || []).map(p => [p.id, `${p.label} · ${p.state}`])];
      const id = item?.rulePlugin || preset?.rulePlugin;
      if (id && !f.options.some(x => x[0] === id)) f.options.push([id, id + ' — unavailable']);
    }
    // (2.3.0) the systems the club hid (Race Setup, Choose systems): their choice is left out, unless this setup uses one
    const hide = typeof setupHiddenFields === 'function' ? setupHiddenFields() : [],
      has = k => {
        const v = (item || preset || {})[k];
        return v !== undefined && v !== null && v !== '' && v !== 'none';
      };
    for (let i = fields.length - 1; i >= 0; i--)
      if (!fields[i].custom && hide.includes(fields[i].key) && !has(fields[i].key)) fields.splice(i, 1);
  }
  if (e === 'slotcars') {
    const f = fields.find(f => f.key === 'tyreCompound');
    if (f) {
      const choices = new Map(f.options);
      for (const system of state.refs.tyrewearsystems || [])
        for (const tyre of Wx.withTyres(system.tyres).TYRES.filter(t => t.custom)) choices.set(tyre.code, `${tyre.name} — ${system.name}`);
      if (item?.tyreCompound && !choices.has(item.tyreCompound))
        choices.set(item.tyreCompound, 'Previously selected custom tyre (system unavailable)');
      f.options = [...choices];
    }
  }
  // a track saved before the lane length modifier shows what it always did: calculated as a loop (or what version 0.60.0's track shape said)
  const legacyTrackCall =
    item && item.trackCallAction === undefined
      ? {
          yellowred: ['yellowred', 'on', 'on'],
          yellowredcut: ['yellowred', 'on', 'off'],
          yellow: ['yellow', 'on', 'on'],
          yellowcut: ['yellow', 'off', 'on'],
          red: ['red', 'on', 'on'],
          redcut: ['red', 'on', 'off'],
          power: ['power', 'on', 'on'],
          none: ['none', 'on', 'on']
        }[item.trackcall || 'yellowred'] || ['yellowred', 'on', 'on']
      : null;
  const val = f =>
    f.custom
      ? (item?.custom || {})[f.id]
      : item
        ? e === 'pushsavesystems' && f.key === 'mode' && item.mode === undefined
          ? 'legacy'
          : e === 'racesetups' && legacyTrackCall && f.key === 'trackCallAction'
            ? legacyTrackCall[0]
            : e === 'racesetups' && legacyTrackCall && f.key === 'trackCallYellowPower'
              ? legacyTrackCall[1]
              : e === 'racesetups' && legacyTrackCall && f.key === 'trackCallRedPower'
                ? legacyTrackCall[2]
                : e === 'slotcars' && f.key === 'lapsSinceService'
                  ? CarStats.sinceOf(item)
                  : e === 'slotcars' && f.key === 'lapsDriven'
                    ? CarStats.lapsDriven(item)
                    : e === 'slotcars' && f.key === 'servicesDone'
                      ? CarStats.servicesOf(item)
                      : e === 'tracks' && f.key === 'laneModifier'
                        ? Speed.modifier(item)
                        : e === 'tracks' && f.key === 'netTurns' && item.netTurns === undefined
                          ? f.default
                          : item[f.key]
        : preset && !f.custom && preset[f.key] !== undefined
          ? preset[f.key]
          : f.default;
  const imgs = {},
    frames = {},
    mainKey = s.image;
  let pieces = ((item && item.lengthPieces) || []).map(p => ({ count: p.count, mm: p.mm }));
  if (!pieces.length) pieces = [{ count: '', mm: 200 }];
  let types = Array.isArray(item && item.types) ? item.types.map(t => ({ ...t })) : item ? [] : PT_DEFAULTS.map(t => ({ ...t }));
  // A record from before the ladder keeps its old rule until the user deliberately adds a level.
  let prules = Array.isArray(item && item.rules) ? item.rules.map(r => ({ ...r })) : item ? null : [];
  const dmDef = Damage.defaults(); // (a new damage system starts with the examples: light, medium, heavy and critical damage)
  let dlevels = Array.isArray(item && item.levels) ? item.levels.map(x => ({ ...x })) : item ? [] : dmDef.levels,
    dincs = Array.isArray(item && item.incidents) ? item.incidents.map(x => ({ ...x })) : item ? [] : dmDef.incidents,
    cfails = Array.isArray(item && item.failures) ? item.failures.map(x => ({ ...x })) : item ? [] : dmDef.failures;
  let tt = TyreWear.Temperature.clean(
      item?.temperature,
      Wx.withTyres(item?.tyres).TYRES.map(x => x.code)
    ),
    ttSelected = 'M';
  let twt = TyreWear.cleanTyres(item && item.tyres),
    twm = TyreWear.cleanMult(item && item.mult),
    tws = TyreWear.withTyres(twt).cleanSets(item && item.sets),
    twsel = 'S',
    twShownUnit = (item && item.unit) || TyreWear.DEFAULTS.unit; // (a tyre wear system: the tyre table, the weather table and the tyre whose grip curve is shown; a new one starts as the Standard system)
  let wxhFocus = { state: 'wet', cls: 'dry' }; // the cell whose real fuel consequence is explained below the weather effect map
  let gal = Array.isArray(item && item[s.gallery]) ? [...item[s.gallery]] : [],
    galSel = null;
  const memF = fields.find(f => f.type === 'members');
  let members = memF && item && Array.isArray(item[memF.key]) ? item[memF.key].filter(Boolean) : []; // (the drivers of a team, in order)
  fields
    .filter(f => f.type === 'image')
    .forEach(f => {
      imgs[f.id] = val(f) || '';
      if (!f.custom) frames[f.id] = Widgets.frameOf(item && item[f.key + 'Frame']);
    });
  const frameBlock = f =>
    f.type === 'image' && !f.custom
      ? `<div class="field frame full" id="frame-${f.id}" data-frame="${f.id}">${frameInner(imgs[f.id], frames[f.id], '4 / 3', false)}</div>`
      : '';
  const redrawFrame = key => {
    byId('frame-' + key).innerHTML = frameInner(imgs[key], frames[key], '4 / 3', false);
    attachFrames(
      dlg,
      k => frames[k],
      (k, f) => {
        frames[k] = f;
      }
    );
  };
  // Race Setups (1.70.0): the three answers that the Session type used to give at once (kind, format, swaps) and the list of the points in boxes
  const fieldOf = k => fields.find(f => !f.custom && f.key === k);
  const startParts =
    e === 'racesetups' && fieldOf('sessionType')
      ? SetupWords.parts({
          sessionType: val(fieldOf('sessionType')),
          enduranceBy: fieldOf('enduranceBy') ? val(fieldOf('enduranceBy')) : ''
        })
      : null;
  let raceMemory =
    startParts && startParts.kind === 'race' ? { format: startParts.format, swaps: startParts.swaps } : { format: 'one', swaps: false }; // (what the race was before another kind was chosen, so Race comes back as it was)
  const places = {}; // the numbers of a list that is shown in boxes, by setting
  fields
    .filter(f => f.ui === 'boxes')
    .forEach(f => {
      const l = FormUI.listOf(val(f));
      places[f.id] = l.length ? l : FormUI.listOf(f.default);
    }); // (a setup that has no list yet counts the standard one, as the race does: its boxes show it)
  // A weather system (1.74.0): the words of the units follow the form (laps or minutes; Celsius and km/h or Fahrenheit and mph), and its two tables are drawn from the values of the numbers they hold
  const wxWords = get =>
    e === 'weathersystems'
      ? {
          unit: get('unit') === 'time' ? 'minutes' : 'laps',
          temp: get('units') === 'imperial' ? '°F' : '°C',
          speed: get('units') === 'imperial' ? 'mph' : 'km/h'
        }
      : null;
  const startWords = wxWords(k => {
    const g = fieldOf(k);
    return g ? val(g) : undefined;
  });
  const valueOf = k => {
    const g = fieldOf(k);
    const x = g ? val(g) : '';
    return x === undefined || x === null ? '' : x;
  };
  const psNow = get => PushSave.presetOf(Object.fromEntries(['tyreExtra', 'tyreSave', 'fuelExtra', 'fuelSave'].map(k => [k, get(k)]))); // (a push and save system: the ready-made system whose four wear numbers the form holds, '' = its own numbers)
  const one = f =>
    (e === 'racesetups' && f.key === 'disabledSystems'
      ? `<div class="field full" data-key="disabledSystems"><label>${esc(f.label)}</label><input type="hidden" id="f-disabledSystems" value="${esc(val(f) || '')}"><div id="f-system-switches"></div><small class="muted">${esc(f.hint)}</small></div>`
      : fieldHtml(f, f.ui === 'boxes' ? FormUI.joinList(places[f.id]) : val(f), {
          psKey: e === 'pushsavesystems' ? psNow(valueOf) : '',
          pieces,
          types,
          prules,
          members,
          dlevels,
          dincs,
          cfails,
          tt,
          twt,
          twm,
          tws,
          twsel,
          twunit: (item && item.unit) || TyreWear.DEFAULTS.unit,
          wxhFocus,
          parts: startParts,
          words: startWords,
          value: valueOf,
          partner: f.with && fieldOf(f.with) ? { f: fieldOf(f.with), v: val(fieldOf(f.with)) } : null
        })) + frameBlock(f);
  // a schema with groups: the fields in collapsible sections with a coloured header, in the order of the groups (fields without a group of their own, such as your own fields, go last)
  const defs = Array.isArray(s.groups) && s.groups.length ? s.groups : null;
  const groups = defs
    ? [
        ...defs.map(g => ({ ...g, fields: fields.filter(f => f.group === g.id) })),
        { id: '_more', title: 'More', note: '', fields: fields.filter(f => !defs.some(g => g.id === f.group)) }
      ].filter(g => g.fields.length)
    : null;
  // Race Setups (1.71.0) and the Penalty and Damage systems (1.73.0): the form has a rail, and its sections are made of the groups (Advanced holds four of them); see schema.js, rail
  const railDefs = groups && Array.isArray(s.rail) && s.rail.length ? s.rail : null;
  const sections = railDefs
    ? railDefs.map(r => ({ ...r, groups: r.groups.map(id => groups.find(g => g.id === id)).filter(Boolean) })).filter(r => r.groups.length)
    : null;
  if (sections) {
    const left = groups.filter(g => !sections.some(x => x.groups.includes(g)));
    if (left.length) sections.push({ id: '_more', title: 'More', ask: 'Other settings.', icon: 'sliders', optional: true, groups: left });
  } // (a setting that is in no section is not lost)
  const opened = defs ? (formOpen[e] = formOpen[e] || new Set((railDefs || defs).filter(g => g.open).map(g => g.id))) : null;
  const nameField = sections ? fieldOf('name') : null; // (in a form with a rail the name is in the header, not in the first section)
  const usedBy = !sections
    ? null
    : e === 'racesetups'
      ? item && Array.isArray(state.refs.championships)
        ? state.refs.championships
            .filter(c => (c.rounds || []).some(r => (r.sessions || []).some(x => x.setup === item.id)))
            .map(c => String(c.name || '').trim() || '(unnamed)')
        : null
      : s.used && Array.isArray(state.refs[s.used.entity])
        ? state.refs[s.used.entity].filter(r => item && r[s.used.key] === item.id).map(r => String(r.name || '').trim() || '(unnamed)')
        : null; // (a system: the race setups that choose it)
  const tileName = v =>
    e === 'racesetups'
      ? SETUP_KIND_ICON[v.sessionType] || 'racesetups'
      : e === 'slotcars'
        ? 'car'
        : (SETUP_LOOK[e] || [])[0] || 'racesetups'; // (the picture in the header: the kind of a race setup, the picture of a system)
  const frameWords =
    e === 'racesetups'
      ? {}
      : {
          navLabel: `The sections of this ${s.label.toLowerCase()}`,
          caption: e === 'slotcars' ? 'This car' : 'This system',
          save: `Save ${s.label.toLowerCase()}`,
          usedNone: 'Not used yet. Choose it under Rules and systems in a race setup.',
          usedIcon: 'racesetups'
        };
  let railCurrent = sections ? (sections.find(x => opened.has(x.id)) || sections[0]).id : ''; // (the section that the rail points at: the one that was opened last)
  const sectionBody = x =>
    x.groups.length === 1 && x.groups[0].id === x.id
      ? RailForm.grid(
          x.groups[0].fields
            .filter(f => f !== nameField)
            .map(one)
            .join(''),
          x.cols
        )
      : x.groups
          .map(g =>
            RailForm.sub(
              g.id,
              g.bare ? '' : g.title,
              g.bare ? '' : g.note,
              g.fields
                .filter(f => f !== nameField)
                .map(one)
                .join(''),
              x.cols
            )
          )
          .join('');
  dlg.innerHTML = sections
    ? RailForm.shell({
        eyebrow: `${item ? 'Edit' : 'Add'} ${s.label.toLowerCase()}`,
        cls: setupToneClass(e).trim(),
        icon: n => Icons.svg(n, { size: 20, stroke: 1.7 }),
        used: usedBy,
        ...frameWords,
        tile: Icons.svg(tileName(e === 'racesetups' ? { sessionType: val(fieldOf('sessionType')) } : {}), { size: 26, stroke: 1.6 }),
        name: nameField ? one(nameField) : '',
        sections: sections.map(x => ({
          id: x.id,
          title: x.title,
          ask: x.ask,
          icon: x.icon,
          open: opened.has(x.id),
          optional: !!x.optional,
          live: !!x.live,
          body: sectionBody(x)
        }))
      })
    : `<form id="frm"${setupToneClass(e) ? ` class="${setupToneClass(e).trim()}"` : ''}><h3>${item ? 'Edit' : 'Add'} ${esc(s.label.toLowerCase())}</h3>
    ${
      groups
        ? `<div class="formgrid grouped"><div class="fgtools"><button type="button" class="btn" data-fgall="1">Open all</button><button type="button" class="btn" data-fgall="0">Close all</button></div>${groups
            .map(
              g =>
                `<details class="fgroup" data-fg="${esc(g.id)}"${opened.has(g.id) ? ' open' : ''}><summary><strong>${esc(g.title)}</strong>${g.note ? ` <span class="muted">${esc(g.note)}</span>` : ''}</summary><div class="fgrid">${g.fields.map(one).join('')}</div></details>`
            )
            .join('')}</div>`
        : `<div class="formgrid">${fields.map(one).join('')}</div>`
    }
    <p class="error" id="err" role="alert"></p>
    <div class="row"><button class="btn primary" type="submit">Save</button><button class="btn" type="button" id="cancel">Cancel</button></div></form>`;
  const getValue = k => byId('f-' + k)?.value;
  const markWxHinderProfile = () => {
    if (e !== 'weathersystems') return;
    const now = wxHinderPresetOf(getValue);
    dlg.querySelectorAll('[data-wxhprofile]').forEach(b => {
      const on = b.dataset && b.dataset.wxhprofile === now;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
  };
  const drawWxHinderPreview = () => {
    if (e !== 'weathersystems') return;
    const box = byId('wx-hinder-preview');
    if (box) box.innerHTML = wxHinderPreview(getValue, wxhFocus);
    markWxHinderProfile();
  };
  const drawSystemSwitches = () => {
    if (e !== 'racesetups' || typeof RaceSystems === 'undefined') return;
    const el = byId('f-system-switches');
    if (!el) return;
    const draft = { disabledSystems: getValue('disabledSystems') };
    RaceSystems.ITEMS.forEach(x => {
      draft[x.setup] = getValue(x.setup);
    });
    el.innerHTML = RaceSystems.setupHtml(draft);
    // (2.4.0, Setup Sheet) one row per system: its switch "On at the start" goes next to the system that is chosen, so one row says both (the row of
    // switches under them is then empty and hidden; Balance of Power is a switch itself)
    if (!el.querySelectorAll || typeof el.appendChild !== 'function' || !dlg.querySelector) return;
    [...el.querySelectorAll('[data-system-key]')].forEach(b => {
      const item = RaceSystems.ITEMS.find(x => x.key === b.dataset.systemKey),
        row = item ? dlg.querySelector(`.field[data-key="${item.setup}"]`) : null;
      // (a system that is hidden on this computer, or not chosen, has nothing to switch: its switch goes)
      if (!row || row.hidden || (row.closest && row.closest('[hidden]'))) {
        if (b.disabled) b.remove();
        return;
      }
      let slot = row.querySelector('.rs-onstart');
      if (!slot) {
        slot = document.createElement('span');
        slot.className = 'rs-onstart';
        (row.querySelector('.ss-ctl') || row).appendChild(slot);
      }
      slot.hidden = !getValue(item.setup) || (item.key === 'bop' && getValue('bop') !== 'on');
      slot.innerHTML = '<span>On at the start</span>';
      slot.appendChild(b);
    });
    const left = el.querySelectorAll('[data-system-key]').length;
    const host = dlg.querySelector('.field[data-key="disabledSystems"]');
    if (host) host.hidden = !left;
  };
  const drawTrackPreview = () => {
    if (e !== 'racesetups') return;
    const box = byId('f-track-preview');
    if (!box) return;
    const track = (state.refs.tracks || []).find(x => x.id === getValue('track'));
    if (!track) {
      box.innerHTML = `<span>${Icons.svg('racesetups', { size: 18, stroke: 1.8 })}</span><p><b>Choose a track</b><small>The lane count and track picture will appear here.</small></p>`;
      drawTrackCards();
      return;
    }
    const lanes = Number(track.lanes) > 0 ? `${track.lanes} ${Number(track.lanes) === 1 ? 'lane' : 'lanes'}` : 'Lane count not set';
    const pic = track.picture
      ? `<img src="${esc(track.picture)}" alt="">`
      : `<span>${Icons.svg('racesetups', { size: 18, stroke: 1.8 })}</span>`;
    box.innerHTML = `${pic}<p><b>${esc(track.name || 'Unnamed track')}</b><small>${esc(lanes)}${track.length ? ` · ${esc(Distance.text(track.length, dUnit()))}` : ''}</small></p>`;
    drawTrackCards();
  };
  // (2.4.0, Setup Sheet) the tracks as cards under the choice: the picture (or a drawn oval with its lanes), the name, the lanes and the length; the
  // chosen one is lit. A click chooses it (the list stays, for a keyboard and a screen reader).
  const drawTrackCards = () => {
    if (e !== 'racesetups') return;
    const row = dlg.querySelector('.field[data-key="track"]');
    if (!row || typeof row.appendChild !== 'function' || typeof document === 'undefined') return;
    let grid = row.querySelector('.rs-tracks');
    if (!grid) {
      grid = document.createElement('div');
      grid.className = 'rs-tracks';
      grid.setAttribute('role', 'group');
      grid.setAttribute('aria-label', 'Tracks');
      row.appendChild(grid);
    }
    const now = getValue('track'),
      LC = ['#e5484d', '#3b82f6', '#f5c211', '#3ecf8e'];
    const oval = n =>
      `<svg viewBox="0 0 64 40" aria-hidden="true"><rect x="3" y="3" width="58" height="34" rx="17" fill="none" stroke="currentColor" stroke-opacity=".22" stroke-width="6"/>${Array.from({ length: Math.min(4, Math.max(1, Number(n) || 1)) }, (_, k) => `<rect x="${3 + k * 1.6}" y="${3 + k * 1.6}" width="${58 - k * 3.2}" height="${34 - k * 3.2}" rx="${17 - k * 1.6}" fill="none" stroke="${LC[k]}" stroke-width="1"/>`).join('')}</svg>`;
    const html = (state.refs.tracks || [])
      .map(t => {
        const n = Number(t.lanes) > 0 ? Number(t.lanes) : 0;
        return `<button type="button" class="rs-track${t.id === now ? ' on' : ''}" data-trackpick="${esc(t.id)}" aria-pressed="${t.id === now}">${t.picture ? `<img src="${esc(t.picture)}" alt="">` : oval(n)}<span><b>${esc(t.name || 'Unnamed track')}</b><small>${n ? `${n} ${n === 1 ? 'lane' : 'lanes'}` : 'lanes not set'}${t.length ? ' · ' + esc(Distance.text(t.length, dUnit())) : ''}</small></span></button>`;
      })
      .join('');
    if (grid.innerHTML !== html) grid.innerHTML = html;
  };
  // (2.4.0, Setup Sheet) quick picks for the length: a few common numbers of laps and minutes beside their field
  const drawQuickPicks = () => {
    if (e !== 'racesetups') return;
    [
      ['laps', [20, 50, 100, 200]],
      ['duration', [5, 10, 15, 30]]
    ].forEach(([key, list]) => {
      const row = dlg.querySelector(`.field[data-key="${key}"]`);
      if (!row || typeof row.appendChild !== 'function' || !row.querySelector || row.querySelector('.rs-quick')) return;
      const q = document.createElement('span');
      q.className = 'rs-quick';
      q.setAttribute('role', 'group');
      q.setAttribute('aria-label', 'Quick picks');
      q.innerHTML = list.map(n => `<button type="button" class="btn" data-quick="${n}" data-quick-key="${key}">${n}</button>`).join('');
      row.appendChild(q);
    });
  };
  // Fuel Systems can borrow the deliberately entered reference lap from a Track. Keep the
  // selected Track and its current value visible together so a missing reference is obvious.
  const drawFuelTrackPreview = () => {
    if (e !== 'fuelrules') return;
    const box = byId('f-paceTrack-preview');
    if (!box) return;
    const track = (state.refs.tracks || []).find(x => x.id === getValue('paceTrack'));
    if (!track) {
      box.innerHTML = `<span>${Icons.svg('racesetups', { size: 18, stroke: 1.8 })}</span><p><b>Choose a track</b><small>Its Fuel reference lap time will appear here.</small></p>`;
      return;
    }
    const target = Number(track.targetLap);
    const lap = Number.isFinite(target) && target > 0 ? `${target} seconds` : 'No Fuel reference lap time yet';
    box.innerHTML = `<span>${Icons.svg('racesetups', { size: 18, stroke: 1.8 })}</span><p><b>${esc(track.name || 'Unnamed track')}</b><small${target > 0 ? '' : ' class="warn"'}>${esc(lap)}</small></p>`;
  };
  // Safety Car Systems may show a Track as a visual reference only. The explicit
  // button copies its saved target into the draft; merely selecting a Track never
  // changes a race rule.
  const drawSafetyTrackPreview = () => {
    if (e !== 'safetycarsystems') return;
    const box = byId('f-safetyTrack-preview');
    if (!box) return;
    const track = (state.refs.tracks || []).find(x => x.id === getValue('safetyTrack'));
    if (!track) {
      box.innerHTML = `<span>${Icons.svg('safetycar', { size: 18, stroke: 1.8 })}</span><p><b>Choose a reference Track</b><small>Its saved Fuel reference lap will appear here.</small></p>`;
      return;
    }
    const target = Number(track.targetLap),
      has = Number.isFinite(target) && target > 0;
    box.innerHTML = `<span>${Icons.svg('safetycar', { size: 18, stroke: 1.8 })}</span><p><b>${esc(track.name || 'Unnamed track')}</b><small${has ? '' : ' class="warn"'}>${esc(has ? `Reference lap: ${target} seconds` : 'No Fuel reference lap time yet')}</small></p>${has ? `<button type="button" class="btn" data-sctarget="${target}">Use ${esc(String(target))} s</button>` : ''}`;
  };
  const drawFuelMath = v => {
    if (e !== 'fuelrules') return;
    const box = byId('fuel-math');
    if (!box) return;
    const track = (state.refs.tracks || []).find(x => x.id === v.paceTrack) || null;
    const F = RaceEngine.fuelConfig({}, v, track),
      laps = F.perLap > 0 ? F.tank / F.perLap : null,
      fill = F.rate > 0 ? F.tank / F.rate : null;
    const text = n => (Number.isInteger(n) ? String(n) : (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, ''));
    const lapEl = byId('fuel-math-laps'),
      fillEl = byId('fuel-math-fill'),
      note = byId('fuel-math-note');
    if (lapEl) lapEl.textContent = laps === null ? 'No fuel used' : `${text(laps)} ${laps === 1 ? 'lap' : 'laps'}`;
    if (fillEl) fillEl.textContent = fill === null ? 'Does not refuel' : `${text(fill)} ${fill === 1 ? 'second' : 'seconds'}`;
    if (note)
      note.textContent =
        F.paceSource === 'track'
          ? F.paceTarget > 0
            ? `Legacy Push & Save reference: ${text(F.paceTarget / 1000)} seconds from ${track && track.name ? track.name : 'this track'}.`
            : 'Set a Fuel reference lap time on this Track to complete the reference.'
          : F.paceSource === 'manual'
            ? F.paceTarget > 0
              ? `Legacy Push & Save reference: manual ${text(F.paceTarget / 1000)} seconds.`
              : 'Enter a manual reference time to complete the reference.'
            : "Base fuel use is fixed per lap. Legacy Push & Save uses each driver's best lap; current Push & Save uses App Settings > Calculations. Enabled racing effects can still change consumption.";
  };
  const drawTrackCallSummary = () => {
    if (e !== 'racesetups') return;
    const box = byId('f-trackCallSummary-summary');
    if (!box) return;
    const action = getValue('trackCallAction') || 'yellowred';
    const words = {
      yellowred: 'Yellow on one press; Red on a second quick press',
      yellow: 'Toggle the Yellow flag',
      red: 'Toggle the Red flag',
      power: 'Toggle track power',
      none: 'Do nothing'
    };
    const power =
      action === 'yellowred'
        ? `Yellow power ${getValue('trackCallYellowPower') === 'off' ? 'off' : 'on'} · Red power ${getValue('trackCallRedPower') === 'off' ? 'off' : 'on'}`
        : '';
    box.innerHTML = `<b>${esc(words[action] || words.yellowred)}</b>${power ? `<small>${esc(power)}</small>` : ''}`;
  };
  // the ready-made push and save system whose four wear numbers the form holds is marked (1.76.0)
  const markPs = () => {
    if (e !== 'pushsavesystems') return;
    const k = psNow(getValue);
    dlg.querySelectorAll('[data-pspreset]').forEach(b => {
      const on = (b.dataset || {}).pspreset === k;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
  };
  // Race Setups (1.69.0): the pills and the sentence "In plain words" at the top of the form follow what is typed (the words are made in setupwords.js)
  const formValues = () => {
    // what the form holds now, by setting
    const v = {};
    fields.forEach(f => {
      if (f.custom) return;
      const el = byId('f-' + f.id);
      if (el) v[f.key] = el.dataset && el.dataset.du === 'ft' ? keptValue(f, el) : el.value;
    });
    if (e === 'penaltysystems') {
      v.types = types;
      if (Array.isArray(prules)) v.rules = prules;
    } // the tables of a system are not fields: the words read their live rows
    if (e === 'damagesystems') {
      v.levels = dlevels;
      v.incidents = dincs;
      v.failures = cfails;
    }
    if (e === 'tyrewearsystems') {
      v.temperature = tt;
      v.tyres = twt;
      v.mult = twm;
      v.sets = tws;
      v.disp = dUnit();
    } // (1.75.0: the three tables as they are edited, and the distance unit of the app for the words)
    return v;
  };
  // the notes and the dots of the rail (1.71.0): worked out in setupwords.js from the values of the form, drawn by railform.js
  const defaultsOf = {};
  fields.forEach(f => {
    if (!f.custom) defaultsOf[f.key] = f.default;
  });
  // (2.4.0, "Build Sheet") a car in one line: its name, scale, number and gearing; ready to race once it has a name
  const carSheet = v => {
    const t = titleOf(e, v),
      gear = typeof Garage !== 'undefined' ? Garage.gearing({ gearing: v.gearing }, v.scale) : null,
      pills = [v.scale, v.number ? '#' + v.number : '', gear ? gear.ratioText : '', v.availability || '']
        .filter(Boolean)
        .map(text => ({ text, tone: '' }));
    const say = t
      ? [
          { t: t, b: true },
          {
            t:
              [v.scale ? ', ' + v.scale : '', v.motor ? ', with a ' + v.motor : '', gear ? `, geared ${gear.ratioText}` : ''].join('') + '.'
          }
        ]
      : [{ t: 'Give the car a brand or a model, so it can be found on the grid.' }];
    return {
      pills,
      say,
      ready: t ? { ok: true, text: v.availability ? v.availability : 'Ready to race' } : { ok: false, text: 'Give it a name' },
      notes: {},
      strip: null
    };
  };
  const railDraw = (v, rctx, notes) => {
    if (!sections) return;
    const info =
      e === 'racesetups'
        ? SetupWords.rail(v, {
            ...rctx,
            defaults: defaultsOf,
            shown: k => {
              const f = fieldOf(k);
              return !!f && isShown(f, getValue);
            }
          })
        : SystemWords.rail(e, v, {
            ...rctx,
            defaults: defaultsOf,
            lists: { types: PT_DEFAULTS, rules: [], levels: dmDef.levels, incidents: dmDef.incidents, failures: dmDef.failures }
          });
    const visible = {};
    sections.forEach(x => {
      visible[x.id] = x.groups.some(g => g.fields.some(f => isShown(f, getValue)));
    });
    RailForm.sync(byId, info, visible, railCurrent);
    RailForm.live(byId, info, notes, n => Icons.svg(n, { size: 18, stroke: 1.8 })); // (1.73.0: the note under the settings of a section that has one)
  };
  // the header (the picture of the kind, the pills, Ready to race), the sentence "In plain words" and the rail follow what is typed and chosen
  const sayDraw = () => {
    drawSystemSwitches();
    drawTrackPreview();
    drawQuickPicks();
    drawTrackCallSummary();
    drawFuelTrackPreview();
    drawSafetyTrackPreview();
    const box = byId('rssay');
    if (!box) return;
    markPs();
    const v = formValues();
    if (e === 'racesetups') {
      const form = byId('frm');
      if (form) form.dataset.sessionKind = v.sessionType || 'race';
    }
    const rctx =
      e === 'racesetups'
        ? {
            track: (state.refs.tracks || []).find(t => t.id === v.track) || null,
            rotation: ((state.refs.rotationsetups || []).find(r => r.id === v.rotation) || {}).name || '',
            dist: n => Distance.text(n, dUnit())
          }
        : e === 'fuelrules'
          ? { track: (state.refs.tracks || []).find(t => t.id === v.paceTrack) || null }
          : e === 'safetycarsystems'
            ? { track: (state.refs.tracks || []).find(t => t.id === v.safetyTrack) || null }
            : {};
    const d = e === 'racesetups' ? SetupWords.describe(v, rctx) : e === 'slotcars' ? carSheet(v) : SystemWords.describe(e, v, rctx);
    const pills = byId('rspills'),
      ready = byId('rsready'),
      tile = byId('rstile');
    if (pills) pills.innerHTML = d.pills.map(p => `<span class="rspill${p.tone ? ' ' + p.tone : ''}">${esc(p.text)}</span>`).join('');
    if (ready) {
      ready.className = 'rsready' + (d.ready.ok ? ' ok' : '');
      ready.innerHTML = `${Icons.svg(d.ready.ok ? 'check' : 'penalty', { size: 15, stroke: 2 })}${esc(d.ready.text)}`;
    }
    if (tile)
      tile.innerHTML =
        e === 'slotcars' && typeof Garage !== 'undefined'
          ? Garage.carSvg(
              Garage.carColors(
                { id: item?.id || 'new', name: titleOf(e, v) },
                v.colour ? [v.colour] : (item && GarageLooks.of(item.id).colors) || []
              ),
              Garage.numberOf(v, titleOf(e, v)),
              'form'
            )
          : Icons.svg(tileName(v), { size: 26, stroke: 1.6 });
    if (tile) tile.classList.toggle('rscar', e === 'slotcars');
    const bar = byId('rs-strip');
    if (bar) bar.innerHTML = RailForm.strip(d.strip); // (the bar of the levels of a damage system)
    // (2.4.0, SlotForgeRestyle.md "Setup Sheet") a race setup in one line, with chips: ready or not, Track Call, the systems, the screens and the sound
    const sheetChips = () => {
      if (e !== 'racesetups' || typeof SetupWords.rail !== 'function') return '';
      const r = SetupWords.rail(v, rctx),
        chip = (text, c) => `<span class="rs-chip" style="--c:${c || '#8a93a0'}"><i aria-hidden="true"></i>${esc(text)}</span>`;
      return `<div class="rs-chips">${[
        chip(d.ready.ok ? 'Ready to race' : d.ready.text, d.ready.ok ? '#3ecf8e' : '#f2b705'),
        r.start && r.start.rail ? chip(r.start.rail.split(' · ').pop(), '#f5c518') : '',
        ...String((r.rules && r.rules.rail) || '')
          .split(' · ')
          .filter(Boolean)
          .map(x => chip(x, /off$|No systems/.test(x) ? '' : '#3ecf8e')),
        ...String((r.screens && r.screens.rail) || '')
          .split(' · ')
          .filter(Boolean)
          .map(x => chip(x, ''))
      ].join('')}</div>`;
    };
    box.innerHTML = `<span class="rsic rssayic">${Icons.svg(e === 'racesetups' ? tileName(v) : 'say', { size: 20, stroke: 1.7 })}</span><div class="rssaytext"><span class="rseye">${e === 'racesetups' ? 'This race in one line' : 'In plain words'}</span><p>${d.say.map(p => (p.b ? `<b>${esc(p.t)}</b>` : esc(p.t))).join('')}</p>${sheetChips()}</div>`;
    drawFuelMath(v);
    railDraw(v, rctx, d.notes);
  };
  // the buttons, the switches and the cards show what the form holds (1.70.0: they are only a face for the settings, which are kept as before)
  const syncControls = () => {
    fields.forEach(f => {
      if (f.ui === 'switch' || f.ui === 'seg' || f.ui === 'cards') FormUI.sync(dlg, f, getValue(f.key));
    });
    if (fields.some(f => f.ui === 'kind'))
      FormUI.syncKind(dlg, byId, SetupWords.parts({ sessionType: getValue('sessionType'), enduranceBy: getValue('enduranceBy') }));
  };
  // a button was pressed: the setting takes its value, and everything that follows from it (what is shown, the words, the buttons) is drawn again
  const setValues = out => {
    let changed = false;
    Object.entries(out).forEach(([k, v]) => {
      const el = byId('f-' + k);
      if (el && el.value !== v) {
        el.value = v;
        changed = true;
      }
    });
    if (changed) refreshShown();
  };
  const refreshShown = () => {
    sayDraw();
    syncControls();
    if (e === 'drivers' && typeof VirtualRival !== 'undefined') {
      const field = dlg.querySelector('[data-key="virtualRivalSystem"]');
      if (field) {
        let preview = field.querySelector('.vr-info');
        if (!preview) {
          preview = document.createElement('div');
          preview.className = 'vr-info';
          field.appendChild(preview);
        }
        const profile = (state.refs.virtualrivalsystems || []).find(p => p.id === getValue('virtualRivalSystem'));
        preview.textContent = profile
          ? `${profile.trackName} · ${VirtualRival.sequence(profile).length} replay laps · ${profile.speed}% speed · ${profile.mode === 'competitor' ? 'Race competitor' : 'Comparison only'}`
          : 'Choose a linked system before this virtual driver can race.';
      }
    }
    if (e === 'weathersystems') FormUI.syncUnits(dlg, wxWords(getValue)); // (laps or minutes, the units of the conditions)
    if (e === 'tyrewearsystems' && byId('tw-box') && getValue('unit') && getValue('unit') !== twShownUnit) {
      twShownUnit = getValue('unit');
      byId('tw-box').innerHTML = twTable(twt, twShownUnit, twsel);
    } // (1.75.0: per lap or per distance changes the heading of the table and its Lasts about)
    fields.forEach(f => {
      const w = dlg.querySelector(`[data-key="${f.id}"]`);
      if (w) w.hidden = !isShown(f, getValue);
    });
    if (groups)
      groups.forEach(g => {
        const el = dlg.querySelector(`[data-fg="${g.id}"]`);
        if (el) el.hidden = !g.fields.some(f => isShown(f, getValue));
      }); // a group with nothing to show is not shown
    if (sections)
      sections.forEach(x => {
        const el = dlg.querySelector(`[data-fg="${x.id}"]`);
        if (el) el.hidden = !x.groups.some(g => g.fields.some(f => isShown(f, getValue)));
      }); // (1.71.0: nor is a section whose groups have nothing to show)
  };
  const drawGallery = () => {
    const box = byId('gal-box');
    if (!box) return;
    box.innerHTML =
      gal
        .map(
          (
            src,
            i
          ) => `<figure class="galitem${i === galSel ? ' sel' : ''}"><img class="galthumb" src="${esc(src)}" alt="Picture ${i + 1}" data-galview="${i}">
      <figcaption><button type="button" class="btn" data-galmain="${i}">Make main</button> <button type="button" class="btn danger" data-galdel="${i}">Remove</button></figcaption></figure>`
        )
        .join('') + (galSel !== null && gal[galSel] ? `<img class="galbig" src="${esc(gal[galSel])}" alt="Selected picture">` : '');
  };
  drawGallery();
  refreshShown();
  // the statistics of a slotcar (1.30.0): what the form says about the service interval, the button that starts the count again, and the mileage
  let serviceReset = false;
  const syncService = () => {
    const el = byId('svc-note');
    if (!el) return;
    const st = CarStats.status(
      { serviceInterval: (byId('f-serviceInterval') || {}).value },
      serviceReset ? 0 : item ? CarStats.sinceOf(item) : 0
    );
    el.textContent = CarStats.note(st) + (serviceReset ? ' The count starts again at 0 when you save.' : '');
    el.classList.toggle('due', st.due);
  };
  syncService();
  if (e === 'slotcars' && byId('f-_mileage')) {
    // the statistics that are worked out from the database (1.30.0 the mileage, 1.33.0 the others)
    const target = byId('f-_byTrack'),
      current = () => byId('f-_byTrack') === target;
    const fill = d => {
      if (!current()) return;
      const t = carStatTexts(d);
      CAR_STATS.forEach(f => {
        byId('f-' + f.key).value = t[f.key];
      });
      target.innerHTML = carTracksHtml(d);
      if (serviceReset) byId('f-_mileageSince').value = Stats.fmtDist(0, dUnit());
    }; // (after Reset the distance since the service starts again at 0)
    if (!item) fill(CarStats.details({}, [], [], []));
    else {
      CAR_STATS.forEach(f => {
        byId('f-' + f.key).value = 'Calculating…';
      });
      loadCarStats(item)
        .then(fill)
        .catch(() => {
          if (!current()) return;
          CAR_STATS.forEach(f => {
            byId('f-' + f.key).value = '–';
          });
          target.textContent = '–';
        });
    }
  }
  if (groups)
    dlg.querySelectorAll('.fgroup').forEach(el => {
      el.ontoggle = () => {
        const g = el.dataset.fg;
        if (el.open) {
          const fresh = !opened.has(g);
          opened.add(g);
          if (sections && fresh) {
            railCurrent = g;
            sayDraw();
          }
        } else opened.delete(g);
      };
    }); // remembered for the next time the form opens (1.71.0: the rail points at the section that was opened last)
  attachFrames(
    dlg,
    k => frames[k],
    (k, f) => {
      frames[k] = f;
    }
  );
  const onClick = ev => {
    const wxh = ev.target && typeof ev.target.closest === 'function' ? ev.target.closest('[data-wxhcell]') : null;
    if (wxh && wxh.dataset && wxh.dataset.wxhstate && wxh.dataset.wxhclass) {
      wxhFocus = { state: wxh.dataset.wxhstate, cls: wxh.dataset.wxhclass };
      drawWxHinderPreview();
    }
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.id === 'cancel') dlg.close();
    const d = b.dataset || {};
    if (d.rail !== undefined && sections) {
      // a row of the rail: open that section and go to it (1.71.0)
      const el = dlg.querySelector(`[data-fg="${d.rail}"]`);
      if (!el) return;
      el.open = true;
      opened.add(d.rail);
      railCurrent = d.rail;
      sayDraw();
      const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'start', behavior: calm ? 'auto' : 'smooth' });
      const head = el.querySelector && el.querySelector('summary');
      if (head && typeof head.focus === 'function') head.focus({ preventScroll: true });
      return;
    }
    if (d.systemKey && typeof RaceSystems !== 'undefined') {
      setValues({ disabledSystems: RaceSystems.toggle(getValue('disabledSystems'), d.systemKey, d.systemOn === '1') });
      return;
    }
    // (2.4.0, Setup Sheet) a track card, and the quick picks of the length (laps, minutes)
    if (d.trackpick !== undefined) {
      setValues({ track: d.trackpick });
      return;
    }
    if (d.quick !== undefined && d.quickKey) {
      setValues({ [d.quickKey]: d.quick });
      return;
    }
    if (d.pick) {
      setValues({ [d.pick]: d.on !== undefined ? (getValue(d.pick) === d.on ? d.off : d.on) : d.val });
      return;
    } // (a button of a segmented choice or of cards, or a switch: 1.70.0)
    if (d.kind !== undefined || d.format !== undefined || d.swaps !== undefined) {
      // the picker of a race setup: another kind, format or swaps
      const now = SetupWords.parts(formValues());
      if (now.kind === 'race') raceMemory = { format: now.format, swaps: now.swaps };
      setValues(
        SetupWords.pick(
          formValues(),
          d.kind !== undefined ? { kind: d.kind } : d.format !== undefined ? { format: d.format } : { swaps: !now.swaps },
          raceMemory
        )
      );
      return;
    }
    if (d.pbadd !== undefined || d.pbdrop !== undefined) {
      // the points of a list in boxes: one place more, or one less
      const id = d.pbadd !== undefined ? d.pbadd : d.pbdrop,
        list = places[id];
      if (!list) return;
      places[id] = d.pbadd !== undefined ? (list.length >= FormUI.MAX_BOXES ? list : FormUI.addPlace(list)) : FormUI.dropPlace(list);
      byId('pb-' + id).innerHTML = FormUI.boxRows(id, places[id]);
      byId('f-' + id).value = FormUI.joinList(places[id]);
      byId('pb-add-' + id).disabled = places[id].length >= FormUI.MAX_BOXES;
      byId('pb-drop-' + id).disabled = places[id].length <= 1;
      refreshShown();
      return;
    }
    if (d.svcreset) {
      // the car was serviced: the count starts again at 0 (kept when the form is saved), and the day is today
      serviceReset ||= new Date().toISOString();
      byId('f-lapsSinceService').value = 0;
      byId('f-serviceDate').value = plainDate(serviceReset);
      byId('f-servicesDone').value = CarStats.servicesOf(item) + 1;
      byId('f-_mileageSince').value = Stats.fmtDist(0, dUnit());
      syncService();
      return;
    }
    if (d.fgall !== undefined && groups) {
      // open or close every group
      opened.clear();
      if (d.fgall === '1') groups.forEach(g => opened.add(g.id));
      dlg.querySelectorAll('.fgroup').forEach(el => {
        el.open = d.fgall === '1';
      });
      return;
    }
    if (memF && (d.memadd || d.memup !== undefined || d.memdown !== undefined || d.memdel !== undefined)) {
      // the drivers of a team: add, move, remove
      if (d.memadd) {
        const pick = byId('mem-pick').value;
        if (pick && !members.includes(pick)) members.push(pick);
      } else if (d.memdel !== undefined) members.splice(Number(d.memdel), 1);
      else {
        const i = Number(d.memup !== undefined ? d.memup : d.memdown),
          j = d.memup !== undefined ? i - 1 : i + 1;
        if (j >= 0 && j < members.length && i >= 0 && i < members.length) [members[i], members[j]] = [members[j], members[i]];
      }
      byId('mem-box').innerHTML = memRows(members, state.refs[memF.ref] || []);
      return;
    }
    if (d.pspreset) {
      const pr = PushSave.PRESETS[d.pspreset];
      if (pr)
        Object.keys(pr.values).forEach(k => {
          const el = byId('f-' + k);
          if (el) el.value = pr.values[k];
        });
      return;
    } // (1.54.0: a ready-made push and save system changes the four wear numbers)
    if (d.wxhprofile) {
      // a profile is only a quick way to fill the twelve ordinary, independently saved weather values
      const profile = Wx.HINDER_PRESETS && Wx.HINDER_PRESETS[d.wxhprofile];
      if (!profile) return;
      Wx.STATES.forEach(([state]) =>
        Wx.CLASSES.forEach(cls => {
          const el = byId('f-' + Wx.HKEYS[state + '/' + cls]);
          if (el) el.value = profile.table[state][cls];
        })
      );
      const map = byId('wx-hinder-map');
      if (map) map.innerHTML = wxHinderMap(getValue, wxhFocus);
      return;
    }
    if (d.sctarget !== undefined) {
      const el = byId('f-target');
      if (el) {
        el.value = d.sctarget;
        const on = byId('f-targetOn');
        if (on) on.value = 'on';
        refreshShown();
      }
      return;
    }
    if (d.ttReset) {
      tt.tyres[d.ttReset] = { ...TyreWear.Temperature.DEFAULT };
      byId('tt-box').innerHTML = TemperatureEditor.html(tt, twt, ttSelected);
      sayDraw();
      return;
    }
    if (d.twpreset) {
      const pr = TyreWear.PRESETS[d.twpreset];
      if (pr) {
        twt = { ...twt, ...JSON.parse(JSON.stringify(pr.tyres)) };
        byId('tw-box').innerHTML = twTable(twt, getValue('unit') || 'lap', twsel);
      }
      return;
    }
    if (d.twadd || d.twremove) {
      if (d.twadd) {
        if (Object.keys(twt).filter(k => k.startsWith('C_')).length >= 32) return;
        const code = 'C_' + crypto.randomUUID().replace(/-/g, '').toUpperCase();
        twt[code] = {
          ...TyreWear.DEFAULT_TYRES.M,
          name: 'Custom tyre ' + (Object.keys(twt).filter(k => k.startsWith('C_')).length + 1),
          icon: 'M',
          cls: 'dry'
        };
        tws[code] = 2;
        twsel = code;
      } else if (d.twremove.startsWith('C_')) {
        delete twt[d.twremove];
        delete tws[d.twremove];
        if (twsel === d.twremove) twsel = 'S';
      }
      byId('tw-box').innerHTML = twTable(twt, getValue('unit') || 'lap', twsel);
      if (byId('tw-sets')) byId('tw-sets').outerHTML = twSets(tws, twt);
      tt = TyreWear.Temperature.clean(
        tt,
        Wx.withTyres(twt).TYRES.map(x => x.code)
      );
      if (byId('tt-box')) byId('tt-box').innerHTML = TemperatureEditor.html(tt, twt, ttSelected);
      sayDraw();
      return;
    }
    if (d.twsel) {
      twsel = d.twsel;
      byId('tw-box').innerHTML = twTable(twt, getValue('unit') || 'lap', twsel);
      const profile = dlg.querySelector('.twadvanced');
      if (profile) {
        profile.open = true;
        profile.querySelector('summary')?.focus({ preventScroll: true });
        profile.scrollIntoView({ block: 'start' });
      }
      return;
    }
    if (d.cfadd) {
      cfails.push({ name: '', level: dlevels.length ? String(dlevels[0].name || '') : '', chance: 5, seconds: 10 });
      byId('cf-box').innerHTML = cfRows(cfails, dlevels);
      return;
    }
    if (d.cfdel !== undefined) {
      cfails.splice(Number(d.cfdel), 1);
      byId('cf-box').innerHTML = cfRows(cfails, dlevels);
      return;
    }
    if (d.cfstd) {
      Failures.DEFAULT_FAILURES.forEach(x => {
        if (
          !cfails.some(
            y =>
              String(y.name || '')
                .trim()
                .toLowerCase() === x.name.toLowerCase()
          )
        )
          cfails.push({ ...x });
      });
      byId('cf-box').innerHTML = cfRows(cfails, dlevels);
      return;
    }
    if (d.dladd) {
      dlevels.push({
        name: '',
        from: dlevels.length ? (Number(dlevels[dlevels.length - 1].from) || 0) + 3 : 3,
        seconds: 10,
        urgency: 'whenever',
        within: 0,
        action: 'repair'
      });
      byId('dl-box').innerHTML = dlRows(dlevels);
      if (byId('cf-box')) byId('cf-box').innerHTML = cfRows(cfails, dlevels);
      return;
    }
    if (d.dldel !== undefined) {
      dlevels.splice(Number(d.dldel), 1);
      byId('dl-box').innerHTML = dlRows(dlevels);
      if (byId('cf-box')) byId('cf-box').innerHTML = cfRows(cfails, dlevels);
      return;
    }
    if (d.diadd) {
      dincs.push({ name: '', points: 1 });
      byId('di-box').innerHTML = diRows(dincs);
      return;
    }
    if (d.didel !== undefined) {
      dincs.splice(Number(d.didel), 1);
      byId('di-box').innerHTML = diRows(dincs);
      return;
    }
    if (d.ptadd) {
      types.push({ name: '', points: 0, effect: 'none', amount: 0 });
      byId('pt-box').innerHTML = ptRows(types);
      return;
    }
    if (d.ptdel !== undefined) {
      types.splice(Number(d.ptdel), 1);
      byId('pt-box').innerHTML = ptRows(types);
      return;
    }
    if (d.pradd) {
      if (!Array.isArray(prules)) prules = [];
      prules.push({ from: prules.length ? Math.max(...prules.map(r => Number(r.from) || 0)) + 1 : 1, time: 0, laps: 0, pit: 0 });
      byId('pr-box').innerHTML = prRows(prules);
      return;
    }
    if (d.prdel !== undefined && Array.isArray(prules)) {
      prules.splice(Number(d.prdel), 1);
      byId('pr-box').innerHTML = prRows(prules);
      return;
    }
    if (d.calcopen) {
      byId('calc').hidden = !byId('calc').hidden;
      return;
    }
    if (d.calcadd) {
      pieces.push({ count: '', mm: pieces.length ? pieces[pieces.length - 1].mm : 200 });
      byId('calc-rows').innerHTML = calcRows(pieces);
      byId('calc-total').textContent = Speed.lengthText(Speed.lengthFromPieces(pieces), dUnit());
      return;
    }
    if (d.calcdel !== undefined) {
      pieces.splice(Number(d.calcdel), 1);
      if (!pieces.length) pieces.push({ count: '', mm: 200 });
      byId('calc-rows').innerHTML = calcRows(pieces);
      byId('calc-total').textContent = Speed.lengthText(Speed.lengthFromPieces(pieces), dUnit());
      return;
    }
    if (d.calcuse) {
      const t = Speed.lengthFromPieces(pieces);
      if (t > 0) {
        const el = byId('f-length');
        el.value = Speed.lengthTyped(t, dUnit());
        if (dUnit() === 'ft' && el.dataset) {
          el.dataset.du = 'ft';
          el.dataset.shown = String(el.value);
          el.dataset.keep = String(t);
        }
      }
      return;
    }
    if (d.galview !== undefined) {
      galSel = galSel === Number(d.galview) ? null : Number(d.galview);
      drawGallery();
      return;
    }
    if (d.galdel !== undefined) {
      gal.splice(Number(d.galdel), 1);
      galSel = null;
      drawGallery();
      return;
    }
    if (d.galmain !== undefined) {
      // this picture becomes the main one; the old main picture goes into the gallery
      const i = Number(d.galmain),
        old = imgs[mainKey];
      imgs[mainKey] = gal[i];
      frames[mainKey] = Widgets.frameOf(null);
      if (old) gal[i] = old;
      else gal.splice(i, 1);
      galSel = null;
      const im = byId('f-' + mainKey + '-img');
      im.src = imgs[mainKey];
      im.hidden = false;
      redrawFrame(mainKey);
      drawGallery();
      return;
    }
    if (b.dataset.clear) {
      imgs[b.dataset.clear] = '';
      frames[b.dataset.clear] = Widgets.frameOf(null);
      byId('f-' + b.dataset.clear + '-img').hidden = true;
      byId('f-' + b.dataset.clear).value = '';
      redrawFrame(b.dataset.clear);
    }
  };
  let classSaving = false;
  dlg.onclick = async ev => {
    const button = ev.target.closest('[data-class-create]');
    if (button?.dataset?.classCreate) {
      if (classSaving) return;
      const key = button.dataset.classCreate,
        input = byId('f-' + key + '-new'),
        label = input.value.trim();
      if (!label) {
        byId('err').textContent = 'Enter a Race Class name, such as GT3 or Prototype.';
        input.focus();
        return;
      }
      classSaving = true;
      button.disabled = true;
      try {
        const list = await api.list('raceclasses');
        let cls = list.find(c => c.name.trim().toLocaleLowerCase() === label.toLocaleLowerCase());
        if (!cls) {
          cls = await api.add('raceclasses', { name: label, color: '#63b9db', icon: 'car' });
          list.push(cls);
        }
        state.refs.raceclasses = list;
        const select = byId('f-' + key);
        select.innerHTML =
          '<option value="">No class selected</option>' + list.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
        select.value = cls.id;
        input.value = '';
        onInput({ target: select });
        byId('err').textContent = '';
      } catch (x) {
        byId('err').textContent = 'Could not create the Race Class: ' + x.message;
      } finally {
        classSaving = false;
        button.disabled = false;
      }
      return;
    }
    onClick(ev);
    if (sections && e !== 'racesetups') sayDraw();
  }; // (1.73.0: a system's words follow a row that is added or taken away; the table is changed first)
  // the ready-made system whose numbers the table holds is marked (1.75.0)
  const markPreset = () => {
    const k = TyreWear.presetOf(twt);
    dlg.querySelectorAll('[data-twpreset]').forEach(b => {
      const on = !!k && (b.dataset || {}).twpreset === k;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
  };
  const onInput = ev => {
    const t = ev.target;
    if (e === 'racesetups') sayDraw(); // (the sentence follows every key that is typed)
    if (e === 'pushsavesystems' && t && t.dataset && t.dataset.pscurve) {
      const field = byId('f-' + t.dataset.pscurve);
      if (field) field.value = t.value;
      // Keep the active range node connected so pointer capture survives a drag.
      const curve = byId('ps-curve'),
        { push, save, time } = psCurveData(getValue);
      if (curve) {
        const labels = curve.querySelectorAll('.pscurve-labels strong');
        labels[0].textContent = time(-push);
        labels[1].textContent = time(save);
        curve.querySelector('p').innerHTML =
          `<b>Full push</b> at ${esc(time(-push))} · the App Settings <b>benchmark</b> is normal use and wear · <b>full save</b> at ${esc(time(save))}. Drag either marker or type the exact value below.`;
      }
      return;
    }
    if (e === 'pushsavesystems' && ['f-pushAt', 'f-saveAt'].includes(t?.id)) {
      const curve = byId('ps-curve-box');
      if (curve) curve.innerHTML = psCurve(getValue);
    }
    if (t && t.dataset && t.dataset.pbf !== undefined) {
      // a box of a list of numbers: the list is kept as text, as it always was ("10, 8, 6")
      const id = t.dataset.pbf,
        list = places[id];
      if (list) {
        list[Number(t.dataset.pb)] = t.value;
        byId('f-' + id).value = FormUI.joinList(list);
        sayDraw();
      }
      return;
    }
    if (t && t.id === 'f-serviceInterval') {
      syncService();
      return;
    }
    if (t && t.dataset && t.dataset.wxh !== undefined) {
      // keep the map and its concrete fuel consequence live while the number is typed
      const cell = typeof t.closest === 'function' ? t.closest('[data-wxhcell]') : null;
      if (cell && cell.dataset) {
        cell.style.setProperty('--wxh', wxHinderNumber(t.value, Wx.DEFAULTS[t.id.slice(2)]) + '%');
        if (cell.dataset.wxhstate && cell.dataset.wxhclass) wxhFocus = { state: cell.dataset.wxhstate, cls: cell.dataset.wxhclass };
      }
      drawWxHinderPreview();
      return;
    }
    if (t?.dataset?.ttSource !== undefined) {
      tt.ambientSource = t.value;
      sayDraw();
      return;
    }
    if (t?.dataset?.ttSelect !== undefined) {
      ttSelected = t.value;
      byId('tt-box').innerHTML = TemperatureEditor.html(tt, twt, ttSelected);
      return;
    }
    if (t?.dataset?.ttAmbient || t?.dataset?.ttKey) {
      if (t.dataset.ttAmbient) tt.ambient[t.dataset.ttAmbient] = t.value;
      else tt.tyres[t.dataset.ttCode][t.dataset.ttKey] = t.value;
      byId('tt-chart').innerHTML = TemperatureEditor.chart(tt, ttSelected);
      sayDraw();
      return;
    }
    if (t?.dataset?.twmeta && twt[t.dataset.twmeta] && ['name', 'icon', 'cls'].includes(t.dataset.twkey)) {
      const code = t.dataset.twmeta;
      twt[code][t.dataset.twkey] = t.value;
      if (t.dataset.twkey === 'name') {
        dlg.querySelectorAll(`[data-twrow="${code}"] .twname,.twprofile:has([data-tw="${code}"]) .twname`).forEach(label => {
          if (label.lastChild?.nodeType === 3) label.lastChild.textContent = ' ' + t.value;
        });
        const curve = byId('tw-curve');
        if (curve && twsel === code) curve.innerHTML = twCurve(twt, twsel);
      }
      return;
    }
    if (t && t.dataset && t.dataset.twlife !== undefined) {
      // the human-friendly tyre-life input stores the established percentage-wear value
      const code = t.dataset.twlife,
        life = Number(String(t.value || '').replace(',', '.'));
      if (twt[code]) twt[code].wear = TyreWear.wearForLife(getValue('unit') || 'lap', dUnit(), life);
      const wearEl = dlg.querySelector(`[data-twwear="${code}"]`);
      if (wearEl) {
        const w = Number(twt[code].wear);
        wearEl.textContent = twWearLabel(getValue('unit') || 'lap') + ': ' + (w > 0 ? w.toLocaleString() + '%' : 'no wear');
      }
      // Editing lifespan does not silently switch the selected performance profile.
      const curve = byId('tw-curve');
      if (curve && twsel === code) curve.innerHTML = twCurve(twt, twsel);
      markPreset();
      return;
    }
    if (t && t.dataset && t.dataset.tw !== undefined) {
      // a number of a tyre: the "lasts about" and the grip curve follow
      const code = t.dataset.tw;
      if (twt[code]) twt[code][t.dataset.twk] = t.value;
      // Editing lifespan does not silently switch the selected performance profile.
      const curve = byId('tw-curve');
      if (curve && twsel === code) curve.innerHTML = twCurve(twt, twsel);
      markPreset();
      return;
    }
    if (t && t.dataset && t.dataset.tws !== undefined) {
      if (tws[t.dataset.tws] !== undefined) tws[t.dataset.tws] = t.value;
      return;
    }
    if (t && t.dataset && t.dataset.twm !== undefined) {
      if (twm[t.dataset.twm]) twm[t.dataset.twm][t.dataset.twmc] = t.value;
      return;
    }
    if (t && t.dataset && t.dataset.dl !== undefined) {
      const lv = dlevels[Number(t.dataset.dl)];
      if (lv) {
        const was = lv[t.dataset.dlk];
        lv[t.dataset.dlk] = t.value;
        if (t.dataset.dlk === 'name' && byId('cf-box')) {
          cfails.forEach(x => {
            if (String(x.level || '') === String(was || '')) x.level = t.value;
          });
          byId('cf-box').innerHTML = cfRows(cfails, dlevels);
        }
      } // (a failure follows its level when the level is renamed)
      return;
    }
    if (t && t.dataset && t.dataset.cf !== undefined) {
      const fl = cfails[Number(t.dataset.cf)];
      if (fl) fl[t.dataset.cfk] = t.value;
      return;
    }
    if (t && t.dataset && t.dataset.di !== undefined) {
      const ic = dincs[Number(t.dataset.di)];
      if (ic) ic[t.dataset.dik] = t.value;
      return;
    }
    if (t && t.dataset && t.dataset.pt !== undefined) {
      const ty = types[Number(t.dataset.pt)];
      if (ty) ty[t.dataset.ptk] = t.value;
      return;
    }
    if (t && t.dataset && t.dataset.pr !== undefined) {
      const rule = Array.isArray(prules) && prules[Number(t.dataset.pr)];
      if (rule) rule[t.dataset.prk] = t.value;
      return;
    }
    const c = t && t.classList && t.dataset && t.dataset.i !== undefined;
    if (!c) return;
    const p = pieces[Number(t.dataset.i)];
    if (!p) return;
    if (t.className.includes('calc-count')) p.count = t.value;
    else if (t.className.includes('calc-mm')) p.mm = dUnit() === 'ft' && t.value !== '' ? Speed.smallKept(t.value, 'ft') : t.value;
    byId('calc-total').textContent = Speed.lengthText(Speed.lengthFromPieces(pieces), dUnit());
  };
  dlg.oninput = ev => {
    onInput(ev);
    if (sections && e !== 'racesetups') sayDraw();
  }; // (and a system's words follow every key that is typed, also in a table: the row is changed first)
  dlg.onchange = async ev => {
    const t = ev.target;
    refreshShown();
    if (t?.dataset?.twmeta) {
      onInput(ev);
      if (t.dataset.twkey !== 'name' && twt[t.dataset.twmeta]?.name.trim()) {
        byId('tw-box').innerHTML = twTable(twt, getValue('unit') || 'lap', twsel);
        if (byId('tw-sets')) byId('tw-sets').outerHTML = twSets(tws, twt);
      }
      sayDraw();
      return;
    }
    if (e === 'pushsavesystems' && ['f-mode', 'f-previewTrack', 'f-pushAt', 'f-saveAt'].includes(t.id || '')) {
      const curve = byId('ps-curve-box');
      if (curve) curve.innerHTML = psCurve(getValue);
    }
    if (t && t.id === 'f-unit' && byId('tw-box')) {
      byId('tw-box').innerHTML = twTable(twt, t.value, twsel);
      return;
    } // (per lap or per distance: the heading and the lasts about change)
    if (t && t.dataset && t.dataset.twm !== undefined && byId('tw-mult')) {
      byId('tw-mult').innerHTML = twMult(twm);
      return;
    } // update the weather-life comparison after a finished edit without interrupting typing
    if (t.dataset && t.dataset.gallery && t.files) {
      // more pictures for the gallery
      const room = GALLERY_MAX - gal.length;
      try {
        for (const file of [...t.files].slice(0, Math.max(0, room))) gal.push(await resizeImage(file, 1024));
        byId('err').textContent = t.files.length > room ? `Only ${GALLERY_MAX} extra pictures fit; the rest were skipped.` : '';
      } catch (x) {
        byId('err').textContent = x.message;
      }
      t.value = '';
      drawGallery();
      return;
    }
    if (t.type === 'file' && t.files[0]) {
      const key = t.id.slice(2);
      try {
        imgs[key] = await resizeImage(t.files[0], 512);
        frames[key] = Widgets.frameOf(null); // a new picture starts centred
        const im = byId(t.id + '-img');
        im.src = imgs[key];
        im.hidden = false;
        redrawFrame(key);
        byId('err').textContent = '';
      } catch (x) {
        byId('err').textContent = x.message;
      }
    }
    if (t.tagName === 'SELECT' && byId(t.id + '-flag')) byId(t.id + '-flag').innerHTML = flagHtml(t.value);
  };
  let saving = false;
  byId('frm').onsubmit = async ev => {
    ev.preventDefault();
    if (saving || classSaving) return;
    if (e === 'tyrewearsystems' && Object.values(tt.tyres).some(v => Number(v.high) <= Number(v.low))) {
      byId('err').textContent = 'Each temperature working range must end above its starting value.';
      return;
    }
    if (e === 'tyrewearsystems' && Object.entries(twt).some(([k, v]) => k.startsWith('C_') && !String(v.name || '').trim())) {
      byId('err').textContent = 'Give every custom tyre a name before saving.';
      return;
    }
    const built = {},
      custom = { ...(item?.custom || {}) };
    for (const f of fields) {
      if (f.automatic) {
        if (!item) built[f.key] = f.type === 'datetime' ? '' : 0;
        continue;
      }
      if (
        f.transient ||
        f.type === 'carstat' ||
        f.type === 'cartracks' ||
        f.type === 'pspresets' ||
        BAR_TYPES.includes(f.type) ||
        f.type === 'wxhinder' ||
        f.type === 'wxcond'
      )
        continue; // (worked out or drawn for the form, not kept)
      if (f.type === 'gallery') {
        built[f.key] = [...gal];
        continue;
      }
      if (f.type === 'members') {
        built[f.key] = members.filter(id => (state.refs[f.ref] || []).some(x => x.id === id));
        continue;
      }
      if (f.type === 'damagelevels') {
        built[f.key] = dlevels
          .filter(l => String(l.name || '').trim() || Number(l.from) > 0)
          .map(l => ({
            name: String(l.name || '').trim(),
            from: Math.max(0, Math.floor(Number(l.from)) || 0),
            seconds: Math.max(0, Number(l.seconds) || 0),
            urgency: l.urgency === 'asap' ? 'asap' : 'whenever',
            within: Math.max(0, Math.floor(Number(l.within)) || 0),
            action: Damage.ACTIONS.includes(l.action) ? l.action : 'repair'
          }));
        continue;
      }
      if (f.type === 'tyretemperature') {
        built[f.key] = TyreWear.Temperature.clean(
          tt,
          Wx.withTyres(twt).TYRES.map(x => x.code)
        );
        continue;
      }
      if (f.type === 'tyretable') {
        built[f.key] = TyreWear.cleanTyres(twt);
        continue;
      }
      if (f.type === 'wxmult') {
        built[f.key] = TyreWear.cleanMult(twm);
        continue;
      }
      if (f.type === 'tyresets') {
        built[f.key] = TyreWear.withTyres(twt).cleanSets(tws);
        continue;
      }
      if (f.type === 'carfailures') {
        built[f.key] = cfails
          .filter(x => String(x.name || '').trim())
          .map(x => ({
            name: String(x.name).trim(),
            level: String(x.level || '').trim(),
            chance: Math.min(100, Math.max(0, Math.round((Number(x.chance) || 0) * 100) / 100)),
            seconds: Math.max(0, Math.round((Number(x.seconds) || 0) * 100) / 100),
            ...(r => (r ? { rules: r } : {}))(
              String(x.level || '').trim()
                ? Failures.rulesOf(x.level, dlevels) ||
                    Failures.rulesOf(x.level, item && item.levels) ||
                    (x.rules && typeof x.rules === 'object' ? x.rules : null)
                : null
            )
          }));
        continue;
      } // (rules: what the level asked when it was saved, kept for when the level is renamed or removed later, see failures.js clean)
      if (f.type === 'damageincidents') {
        built[f.key] = dincs
          .filter(x => String(x.name || '').trim())
          .map(x => ({ name: String(x.name).trim(), points: Math.max(1, Math.floor(Number(x.points)) || 1) }));
        continue;
      }
      if (f.type === 'penaltytypes') {
        built[f.key] = types
          .filter(t => String(t.name || '').trim())
          .map(t =>
            t.effect === undefined
              ? {
                  name: String(t.name).trim(),
                  kind: t.kind === 'drivethrough' ? 'drivethrough' : 'stopgo',
                  seconds: Number(t.seconds) || 0,
                  cost: Number(t.cost) || 0,
                  extra: Number(t.extra) || 0,
                  unserved: Number(t.unserved) || 0
                }
              : {
                  name: String(t.name).trim(),
                  points: Math.max(0, Math.floor(Number(t.points) || 0)),
                  effect: ['time', 'laps', 'pit'].includes(t.effect) ? t.effect : 'none',
                  amount: Math.max(0, Number(t.amount) || 0)
                }
          );
        continue;
      }
      if (f.type === 'penaltyrules') {
        if (Array.isArray(prules))
          built[f.key] = prules
            .map(r => ({
              from: Math.max(1, Math.floor(Number(r.from) || 1)),
              time: Math.max(0, Number(r.time) || 0),
              laps: Math.max(0, Math.floor(Number(r.laps) || 0)),
              pit: Math.max(0, Number(r.pit) || 0)
            }))
            .sort((a, b) => a.from - b.from);
        continue;
      }
      const el = byId('f-' + f.id);
      let v;
      if (f.type === 'image') {
        v = imgs[f.id];
        if (!f.custom) built[f.key + 'Frame'] = v ? frames[f.id] : null;
      } else if (f.type === 'number' || f.type === 'tracklength')
        v = el.value === '' ? '' : el.dataset && el.dataset.du === 'ft' ? keptValue(f, el) : Number(el.value);
      else {
        v = el.dataset && el.dataset.du === 'ft' ? keptValue(f, el) : el.value.trim();
        if (f.uppercase) v = v.toUpperCase();
      }
      if (f.type === 'padlist' && v !== '' && isShown(f, getValue)) {
        // (the values of an Adjust pad: tidied up - smallest first, no doubles, at most six - or the field is empty, which means the App Settings values)
        const own = AdjustPad.ownOf({ [AdjustPad.byId(f.pad).key]: v }, f.pad);
        if (!own) {
          byId('err').textContent =
            'Please enter numbers above zero, separated by commas, for example 1, 3, 10. Leave the field empty to use the values from App Settings.';
          return;
        }
        v = AdjustPad.listText(own);
      }
      if (f.type === 'numberlist' && isShown(f, getValue)) {
        v = ListNum.tidy(v); // (a decimal comma is made a dot: 15,4 is 15.4 metres)
        if (!(f.optional && v === '') && !/^\s*\d+(\.\d+)?(\s*,\s*\d+(\.\d+)?)*\s*$/.test(v)) {
          // (an optional list may stay empty)
          byId('err').textContent = 'Please enter numbers separated by commas, for example 10, 8, 6.';
          return;
        }
      }
      if (f.type === 'tracklength') {
        // keep the pieces only while they still add up to the length
        const used = pieces.filter(p => Number(p.count) > 0 && Number(p.mm) > 0).map(p => ({ count: Number(p.count), mm: Number(p.mm) }));
        built.lengthPieces = used.length && Speed.lengthFromPieces(used) === v ? used : [];
      }
      if (f.custom) custom[f.id] = v;
      else built[f.key] = v;
    }
    if (e === 'slotcars') {
      // the service interval is a whole number of laps (empty = none); Reset starts the count again today
      // Laps Driven (1.51.0) can be typed: a whole number from 0. It is only sent when it was changed (a race that is saved while the form is open keeps its laps), and an empty box leaves it as it is (a new car starts at 0).
      const typedLaps = built.lapsDriven;
      if (typedLaps !== '' && typedLaps !== undefined && !(Number.isInteger(typedLaps) && typedLaps >= 0)) {
        byId('err').textContent = 'Please enter Laps Driven as a whole number, 0 or more.';
        return;
      }
      if (item && (typedLaps === '' || typedLaps === undefined || typedLaps === CarStats.lapsDriven(item))) delete built.lapsDriven;
      else if (typedLaps === '' || typedLaps === undefined) built.lapsDriven = 0;
      if (built.serviceInterval !== '' && built.serviceInterval !== undefined)
        built.serviceInterval = Math.max(1, Math.floor(Number(built.serviceInterval)) || 1);
      if (serviceReset) {
        built.lapsSinceService = 0;
        built.serviceDate = serviceReset;
        built.servicesDone = CarStats.servicesOf(item) + 1;
      }
    }
    if (e === 'tracks' && built.laneModifier === 'measured') {
      // one length for every lane
      const list = String(built.laneLengths || '')
          .split(',')
          .map(x => x.trim())
          .filter((x, i, a) => x !== '' || i < a.length - 1),
        n = Number(built.lanes);
      if (list.length !== n || list.some(x => !(Number(x) > 0))) {
        byId('err').textContent =
          `Please enter the length of every lane: ${n} numbers above 0, separated by commas (you entered ${list.filter(x => Number(x) > 0).length}).`;
        return;
      }
    }
    if (
      e === 'pushsavesystems' &&
      built.mode !== 'median' &&
      built.normal !== '' &&
      built.saveAt !== '' &&
      Number(built.saveAt) <= Number(built.normal)
    ) {
      // the most saving pace must be slower than normal pace (1.54.0)
      byId('err').textContent = 'The most saving pace must be more than the normal pace (the saving needs some room to grow in).';
      return;
    }
    if (e === 'tyrewearsystems' && Number(built.crit) > Number(built.warn)) {
      // the red level must be at or below the amber level
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
      if (e === 'slotcars' && item && serviceReset && typeof GarageLooks !== 'undefined')
        await GarageLooks.log(item.id, { laps: CarStats.sinceOf(item) }).catch(() => {}); // (2.4.0: a line in the service log of the car)
      dlg.close();
    } catch (x) {
      byId('err').textContent = 'It could not be saved: ' + (x && x.message ? x.message : x);
    } finally {
      // (the form stays open: nothing is lost)
      saving = false;
    }
  };
  if (!dlg.open) dlg.showModal(); // (it is already open when Edit was pressed in the view card)
  if (e === 'slotcars' && item?.paddock) {
    for (const key of ['brand', 'manufacturer', 'model', 'scale', 'motor', 'gearing', 'tyres', 'weight', 'picture', 'raceClass'])
      dlg
        .querySelectorAll('[data-key="' + key + '"] input,[data-key="' + key + '"] select,[data-key="' + key + '"] button')
        .forEach(el => (el.disabled = true));
    const note = document.createElement('p');
    note.className = 'muted';
    note.textContent =
      'Linked to Paddock. Edit catalogue details there, then use App Settings → Connections → Dealership Mode → Available cars → Refresh linked cars. Simulation settings and service history remain local.';
    byId('frm').prepend(note);
  }
  if (e === 'slotcars' && item?.paddock && typeof PaddockSpecs !== 'undefined') {
    const holder = document.createElement('details');
    holder.className = 'full';
    holder.dataset.pcsEditor = '';
    holder.style.gridColumn = '1 / -1';
    holder.innerHTML = '<summary>Paddock specifications · read only</summary>' + PaddockSpecs.html(item);
    byId('frm').querySelector('.formgrid').prepend(holder);
    PaddockSpecs.mount(holder.querySelector('.paddock-specs'), item);
  }
  if (groups) {
    const first = byId('f-' + fields[0].id);
    if (first && first.focus) first.focus();
  } // the first field, as before, not the Open all button above the groups
}

// The groups an extra field can be put in: the groups of the form, then More (the default, and where a field goes whose group is not known)
const groupChoices = (e, current) => {
  const known = (state.schema[e].groups || []).some(g => g.id === current);
  return [...(state.schema[e].groups || []).map(g => [g.id, g.title]), ['', 'More']]
    .map(([id, title]) => `<option value="${esc(id)}"${id === (known ? current : '') ? ' selected' : ''}>${esc(title)}</option>`)
    .join('');
};

async function openExtra(e) {
  const s = state.schema[e];
  const list = await api.customFields(e);
  state.custom[e] = list;
  const grouped = (s.groups || []).length > 0;
  dlg.innerHTML =
    `<div${setupToneClass(e) ? ` class="${setupToneClass(e).trim()}"` : ''}><h3>Extra fields for ${esc(s.plural.toLowerCase())}</h3>
    <p class="muted">Extra fields are for your own information. They don't affect lap times or records.</p>` +
    (list.length
      ? `<ul class="xf">${list.map(f => `<li><span>${esc(f.label)} <span class="muted">(${XTYPES[f.type]})</span></span>${grouped ? `<select data-grp="${esc(f.id)}" aria-label="Group of ${esc(f.label)}" title="Where this field appears in the form">${groupChoices(e, f.group)}</select>` : ''}${f.shared ? '<span class="muted">Shared field</span>' : `<button class="btn danger" data-rm="${esc(f.id)}">Delete</button>`}</li>`).join('')}</ul>`
      : '<p class="muted">No extra fields yet.</p>') +
    `<div class="field"><label for="xl">New field name</label><input id="xl" type="text"></div>
     <div class="field"><label for="xt">Type</label><select id="xt">${Object.entries(XTYPES)
       .map(([k, v]) => `<option value="${k}">${v}</option>`)
       .join('')}</select></div>
     <div class="field" id="xow" hidden><label for="xo">Options (separate with commas)</label><input id="xo" type="text"></div>
     ${grouped ? `<div class="field"><label for="xg">Group in the form</label><select id="xg">${groupChoices(e, '')}</select><span class="muted hint">Where the field appears. You can change it later in the list above.</span></div>` : ''}
     <p class="error" id="err" role="alert"></p>
     <div class="row"><button class="btn primary" id="xadd">Add field</button><button class="btn" id="xclose">Close</button></div></div>`;
  dlg.onchange = async ev => {
    const t = ev.target;
    if (t.id === 'xt') byId('xow').hidden = t.value !== 'list';
    if (t.dataset && t.dataset.grp) {
      const f = list.find(x => x.id === t.dataset.grp);
      if (!f) return;
      const before = f.group || '';
      try {
        const saved = await api.setCustomFieldGroup(e, f.id, t.value);
        f.group = saved && typeof saved.group === 'string' ? saved.group : t.value;
      } catch (x) {
        t.value = before;
        byId('err').textContent = 'The group could not be changed: ' + x.message;
      }
    }
  };
  dlg.onclick = async ev => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.id === 'xclose') return dlg.close();
    if (
      b.dataset.rm &&
      (await Dialog.confirm('Delete this extra field? Its values are removed from every item.', { ok: 'Delete the field', danger: true }))
    ) {
      await api.removeCustomField(e, b.dataset.rm);
      if (b.isConnected === false) return; // (the window was closed or changed while the question was open)
      return openExtra(e);
    }
    if (b.id === 'xadd') {
      const label = byId('xl').value.trim(),
        type = byId('xt').value;
      const options = byId('xo')
        .value.split(',')
        .map(x => x.trim())
        .filter(Boolean);
      if (!label) return void (byId('err').textContent = 'Please enter a name for the field.');
      if (type === 'list' && !options.length) return void (byId('err').textContent = 'Please enter at least one option.');
      await api.addCustomField(e, { label, type, options: type === 'list' ? options : [], group: grouped ? byId('xg').value : '' });
      openExtra(e);
    }
  };
  if (!dlg.open) dlg.showModal();
}
