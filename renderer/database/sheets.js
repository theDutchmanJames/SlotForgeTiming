// database: the Track, Driver and Team editors as sheets (2.4.0, SlotForgeRestyle.md "Track Sheet", "Driver Sheet", "Team Sheet"). The form itself is the form of
// every entity with a rail (database.js openForm, railform.js); this file gives it the words of the header and the rail, the picture in the header, and the controls
// that sit over the fields it keeps: the lanes as tiles, the length of every lane in a lane strip, a box per sector name, the callsign in three letter boxes, the
// record from the saved results, a More menu; and the question when a driver is deleted, and lane boxes in a race setup. Every control writes the field it covers,
// so what is stored does not change. The pure parts are exported for the tests.
// (part of renderer/database.js: loaded just before it by index.html; the parts share the page's global scope)
const DbSheet = (() => {
  const SP = typeof Speed !== 'undefined' ? Speed : typeof require !== 'undefined' ? require('../speed.js') : null;
  const ENTITIES = ['tracks', 'drivers', 'teams'];
  const LANES = ['#e5484d', '#3b82f6', '#f5c211', '#3ecf8e', '#a855f7', '#f97316', '#14b8a6', '#ec4899'];
  const laneColor = i => (typeof Garage !== 'undefined' && Array.isArray(Garage.LANES) && Garage.LANES[i]) || LANES[i % 8];
  const h = s =>
    String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  const entry = (rail, row, state) => ({ rail, row: rail ? rail[0].toUpperCase() + rail.slice(1) : '', state: state || 'plain' });
  const plural = (n, one, more) => `${n} ${n === 1 ? one : more}`;
  const num = v => (v === '' || v === undefined || v === null ? NaN : Number(v));
  const lanesOf = v => Math.max(1, Math.min(8, Math.round(num(v && v.lanes)) || 1));
  // a length in metres as it is shown: metres with two decimals, or feet (ctx.ft)
  const lenText = (m, ctx) =>
    !(m > 0) ? '–' : ctx && ctx.ft && SP ? `${SP.lengthTyped(m, 'ft')} ft` : `${(Math.round(m * 100) / 100).toFixed(2)} m`;
  const diffText = (m, ctx) => {
    if (!m) return '–';
    const a = Math.abs(m);
    return (m < 0 ? '−' : '+') + (ctx && ctx.ft && SP ? `${SP.lengthTyped(a, 'ft')} ft` : `${(Math.round(a * 100) / 100).toFixed(2)} m`);
  };

  // ---- the track ----
  // every lane: its length (metres), the difference to the longest lane, and where the length comes from
  function laneRows(v) {
    const n = lanesOf(v),
      mod = SP ? SP.modifier(v) : 'none',
      own = SP ? SP.parseLaneLengths(v.laneLengths) : [];
    const rows = Array.from({ length: n }, (_, i) => {
      const len = SP ? SP.laneLength({ ...v, lanes: n }, i) : null;
      const from =
        mod === 'measured' ? (own[i] > 0 ? 'measured' : 'the track length') : mod === 'bends' ? 'worked out' : 'the track length';
      return { lane: i, len: len > 0 ? len : null, from };
    });
    const top = rows.reduce((m, r) => (r.len > m ? r.len : m), 0),
      low = rows.reduce((m, r) => (r.len > 0 && (m === 0 || r.len < m) ? r.len : m), 0);
    rows.forEach(r => {
      r.diff = r.len > 0 && top > 0 ? r.len - top : 0;
      r.bar = !(r.len > 0) ? 0 : top === low ? 100 : Math.round(55 + (45 * (r.len - low)) / (top - low));
      if (mod === 'bends' && r.len === top && r.len > 0) r.from = 'the track length';
    });
    return { rows, mod, top, low };
  }
  // the lane strip in one sentence: how much shorter the shortest lane is, and what that is over a race of 20 laps
  function laneSay(v, ctx) {
    const { rows, top, low } = laneRows(v);
    if (!(top > 0)) return 'Give the track a length to get speeds and distances.';
    if (rows.length < 2 || top - low < 0.005) return `Every lane is ${lenText(top, ctx)}.`;
    const short = rows.find(r => r.len === low),
      long = rows.find(r => r.len === top);
    return `Lane ${short.lane + 1} is ${diffText(low - top, ctx).slice(1)} shorter than lane ${long.lane + 1}: over a 20-lap race a car in lane ${short.lane + 1} drives ${lenText((top - low) * 20, ctx)} less.`;
  }
  const sectorNamesOf = v =>
    String((v && v.sectorNames) || '')
      .split(',')
      .map(x => x.trim());
  function describeTrack(v, ctx) {
    const n = lanesOf(v),
      sec = Math.round(num(v.sectors)) || 0,
      { top, low } = laneRows(v),
      named = String(v.name || '').trim() !== '';
    const pills = [
      plural(n, 'lane', 'lanes'),
      v.scale || '',
      top > 0 ? (top - low > 0.005 ? `${lenText(low, ctx)} – ${lenText(top, ctx)}` : lenText(top, ctx)) : '',
      sec > 1 ? plural(sec, 'sector', 'sectors') : ''
    ]
      .filter(Boolean)
      .map(text => ({ text, tone: '' }));
    return {
      pills,
      say: [{ t: named ? laneSay(v, ctx) : 'Give the track a name, so it can be chosen in a race setup.' }],
      ready: !named
        ? { ok: false, text: 'Give it a name' }
        : top > 0
          ? { ok: true, text: 'Ready to race' }
          : { ok: false, text: 'Length not set' },
      notes: {},
      strip: null
    };
  }
  function railTrack(v, ctx) {
    const n = lanesOf(v),
      sec = Math.round(num(v.sectors)) || 0,
      names = sectorNamesOf(v).filter(Boolean).length,
      { top, low } = laneRows(v);
    const timing = [
      num(v.minLap) > 0 ? `min ${num(v.minLap)} s` : '',
      num(v.maxLap) > 0 ? `max ${num(v.maxLap)} s` : '',
      num(v.deslotTime) > 0 ? `deslot ${num(v.deslotTime)} s` : ''
    ].filter(Boolean);
    return {
      basics: entry(`${plural(n, 'lane', 'lanes')}${v.scale ? ' · ' + v.scale : ''}`, '', String(v.name || '').trim() ? 'ok' : 'todo'),
      length: entry(
        !(top > 0) ? 'Not set' : top - low > 0.005 ? `${lenText(low, ctx)} – ${lenText(top, ctx)}` : `${lenText(top, ctx)} every lane`,
        '',
        top > 0 ? 'ok' : 'todo'
      ),
      sectors: entry(
        sec > 1 ? `${plural(sec, 'sector', 'sectors')}${names ? ` · ${names} named` : ''}` : 'No sectors',
        '',
        sec > 1 ? 'ok' : 'plain'
      ),
      laps: entry(timing.length ? timing.join(' · ') : 'The standard', '', timing.length ? 'ok' : 'plain'),
      extras: entry(v.picture ? 'Own picture' : 'Drawn from the design', '', v.picture || v.notes ? 'ok' : 'plain')
    };
  }
  // the picture in the header: the lanes as rings in their colours, the outside lane the biggest, and the line
  function trackSvg(v) {
    const n = lanesOf(v),
      outFirst = v && v.outsideLane === 'first',
      step = Math.min(6, 26 / n);
    const ring = k => {
      const lane = outFirst ? k : n - 1 - k; // (k = 0 is the outside ring)
      return `<rect x="${(16 + k * step).toFixed(1)}" y="${(12 + k * step).toFixed(1)}" width="${(138 - 2 * k * step).toFixed(1)}" height="${(68 - 2 * k * step).toFixed(1)}" rx="${Math.max(8, 34 - k * step).toFixed(1)}" fill="none" stroke="${laneColor(lane)}" stroke-width="2.2"/>`;
    };
    return `<svg class="ts-pic" viewBox="0 0 170 92" aria-hidden="true">${Array.from({ length: n }, (_, k) => ring(k)).join('')}<line x1="85" y1="8" x2="85" y2="${(16 + n * step + 6).toFixed(1)}" stroke="currentColor" stroke-width="2" stroke-dasharray="3 2"/></svg>`;
  }

  // ---- the driver and the team ----
  function describeDriver(v, ctx) {
    const named = String(v.name || '').trim() !== '',
      cs = String(v.callsign || '').toUpperCase(),
      virtual = v.driverType === 'virtual',
      flag = ctx && ctx.country ? ctx.country(v.flag) : v.flag || '',
      cls = ctx && ctx.className ? ctx.className(v.raceClass) : '';
    return {
      pills: [cs, flag, virtual ? 'Virtual rival' : '', cls ? `${cls} by default` : ''].filter(Boolean).map(text => ({ text, tone: '' })),
      say: named
        ? [
            { t: v.name, b: true },
            {
              t: `${v.nickname ? ` “${v.nickname}”` : ''} ${cs ? `shows as ${cs} on the timing tower.` : 'has no callsign yet: the timing tower shows the name.'}`
            }
          ]
        : [{ t: 'Give the driver a name, so they can be put in a lane.' }],
      ready: !named
        ? { ok: false, text: 'Give it a name' }
        : v.retired === 'retired'
          ? { ok: false, text: 'Retired' }
          : { ok: true, text: virtual ? 'Virtual rival' : 'Racing' },
      notes: {},
      strip: null
    };
  }
  function railDriver(v, ctx) {
    const cs = String(v.callsign || '').toUpperCase(),
      year = /^\d{4}/.test(String(v.dateOfBirth || '')) ? String(v.dateOfBirth).slice(0, 4) : '';
    return {
      basics: entry(
        `${cs || 'No callsign'} · ${v.driverType === 'virtual' ? 'virtual' : 'human'}${v.retired === 'retired' ? ' · retired' : ''}`,
        '',
        String(v.name || '').trim() ? 'ok' : 'todo'
      ),
      personal: entry(
        [v.flag || '', year ? 'born ' + year : ''].filter(Boolean).join(' · ') || 'Nothing filled in',
        '',
        v.flag || year ? 'ok' : 'plain'
      ),
      avatar: entry(v.avatar ? 'Own picture' : 'The lane helmet', '', v.avatar ? 'ok' : 'plain'),
      virtualrival: entry(
        v.driverType === 'virtual'
          ? (ctx && ctx.rivalName ? ctx.rivalName(v.virtualRivalSystem) : '') || 'Choose its Rival Setup'
          : 'Not a virtual driver',
        '',
        v.driverType === 'virtual' ? (v.virtualRivalSystem ? 'ok' : 'todo') : 'plain'
      )
    };
  }
  const membersOf = v =>
    String((v && v.drivers) || '')
      .split(',')
      .map(x => x.trim())
      .filter(Boolean);
  function describeTeam(v, ctx) {
    const named = String(v.name || '').trim() !== '',
      n = ctx && ctx.members ? ctx.members().length : Array.isArray(v.drivers) ? v.drivers.length : membersOf(v).length,
      cls = ctx && ctx.className ? ctx.className(v.raceClass) : '';
    return {
      pills: [plural(n, 'driver', 'drivers'), cls].filter(Boolean).map(text => ({ text, tone: '' })),
      say: named ? [{ t: v.name, b: true }, { t: ` races with ${plural(n, 'driver', 'drivers')}.` }] : [{ t: 'Give the team a name.' }],
      ready: !named
        ? { ok: false, text: 'Give it a name' }
        : n
          ? { ok: true, text: 'Ready to race' }
          : { ok: false, text: 'No drivers yet' },
      notes: {},
      strip: null
    };
  }
  function railTeam(v, ctx) {
    const n = ctx && ctx.members ? ctx.members().length : Array.isArray(v.drivers) ? v.drivers.length : membersOf(v).length;
    return {
      basics: entry(plural(n, 'driver', 'drivers'), '', String(v.name || '').trim() && n ? 'ok' : 'todo'),
      picture: entry(v.picture ? 'Own picture' : 'No picture', '', v.picture ? 'ok' : 'plain')
    };
  }
  const describe = (e, v, ctx) =>
    e === 'tracks' ? describeTrack(v || {}, ctx) : e === 'drivers' ? describeDriver(v || {}, ctx) : describeTeam(v || {}, ctx);
  const rail = (e, v, ctx) =>
    e === 'tracks' ? railTrack(v || {}, ctx) : e === 'drivers' ? railDriver(v || {}, ctx) : railTeam(v || {}, ctx);

  // ---- the record from the saved results ----
  // a driver's or team's races, wins, best lap (and on which track), laps and first race; a track's races, its record and who holds it
  function recordOf(e, id, sessions) {
    const out = { races: 0, wins: 0, best: 0, bestTrack: '', laps: 0, first: '', records: 0, holder: '' };
    const RACES = new Set(['race', 'heats', 'endurance', 'tokens']),
      key = e === 'teams' ? 'teamId' : 'driverId',
      trackBest = new Map();
    for (const s of Array.isArray(sessions) ? sessions : []) {
      if (!s) continue;
      const rows = Array.isArray(s.standings) ? s.standings : [];
      rows.forEach(st => {
        const b = Number(st && st.best) > 0 ? Number(st.best) : 0;
        if (s.trackId && b) {
          const t = trackBest.get(s.trackId);
          if (!t || b < t.best) trackBest.set(s.trackId, { best: b, who: st[key], name: st.driverName || st.teamName || '' });
        }
      });
      if (e === 'tracks') {
        if (s.trackId !== id) continue;
        out.races++;
        if (!out.first || String(s.date) < out.first) out.first = String(s.date || '');
        rows.forEach(st => (out.laps += Number(st && st.laps) > 0 ? Number(st.laps) : 0));
        continue;
      }
      const mine = rows.filter(st => st && st[key] === id);
      if (!mine.length) continue;
      out.races++;
      if (!out.first || String(s.date) < out.first) out.first = String(s.date || '');
      if (RACES.has(s.sessionType) && mine.some(st => Number(st.pos) === 1 && !st.dq)) out.wins++;
      mine.forEach(st => {
        out.laps += Number(st.laps) > 0 ? Number(st.laps) : 0;
        const b = Number(st.best) > 0 ? Number(st.best) : 0;
        if (b && (!out.best || b < out.best)) {
          out.best = b;
          out.bestTrack = s.trackName || '';
        }
      });
    }
    if (e === 'tracks') {
      const t = trackBest.get(id);
      if (t) {
        out.best = t.best;
        out.holder = t.name;
      }
    } else trackBest.forEach(t => t.who === id && out.records++);
    return out;
  }
  const lapText = ms => {
    if (!(ms > 0)) return '–';
    const s = ms / 1000;
    return s < 60 ? s.toFixed(3) : `${Math.floor(s / 60)}:${(s % 60).toFixed(3).padStart(6, '0')}`;
  };
  const since = iso => {
    const d = new Date(iso);
    return iso && !isNaN(d) ? 'since ' + d.toLocaleDateString([], { month: 'short', year: 'numeric' }) : '';
  };
  // the tiles "On the record" (a driver or a team)
  function recordHtml(e, name, r) {
    const tile = (k, v, note, cls) =>
      `<div class="bs-tile"><small>${h(k)}</small><b${cls ? ` class="${cls}"` : ''}>${v}</b><em>${h(note)}</em></div>`;
    if (!r.races) return `<p class="muted ts-norec">${h(name || 'This ' + (e === 'teams' ? 'team' : 'driver'))} has no saved race yet.</p>`;
    return `<div class="ts-tiles">${tile('Races', r.races, since(r.first))}${tile('Wins', r.wins, `${Math.round((100 * r.wins) / r.races)}% of the races`)}${tile('Best lap', lapText(r.best), r.bestTrack, 'ts-purple')}${tile('Laps', r.laps.toLocaleString(), r.records ? plural(r.records, 'track record', 'track records') : 'in the records')}</div>`;
  }
  // the box under the rail
  function underRail(e, r) {
    if (e === 'tracks')
      return `<div class="ts-rec"><span>Raced on</span><b>${plural(r.races, 'race', 'races')}${r.best ? ` · record ${lapText(r.best)}` : ''}</b>${r.holder ? `<span>${h(r.holder)}</span>` : ''}</div>`;
    return `<div class="ts-rec"><span>In the results</span><b>${plural(r.races, 'race', 'races')} · ${plural(r.wins, 'win', 'wins')}</b><span>${r.laps.toLocaleString()} laps</span></div>`;
  }

  // ---- the controls over the fields ----
  const laneTilesHtml = n =>
    `<span class="ts-lanes" role="group" aria-label="Number of lanes">${[1, 2, 3, 4, 5, 6, 7, 8].map(k => `<button type="button" class="${k <= n ? 'on' : ''}${k === n ? ' last' : ''}" style="--c:${laneColor(k - 1)}" data-ts-lanes="${k}" aria-pressed="${k === n}">${k}</button>`).join('')}</span>`;
  // a row of buttons over a select (the select stays, hidden, and is what is saved)
  const segHtml = (key, pairs, v) =>
    `<span class="bs-gearsel ts-seg" role="group" data-ts-segfor="${h(key)}">${pairs.map(([k, l]) => `<button type="button" class="${k === v ? 'on' : ''}" data-ts-seg="${h(key)}" data-val="${h(k)}" aria-pressed="${k === v}">${h(l)}</button>`).join('')}</span>`;
  // the lane strip: a row per lane with its colour, its length (a box when the lanes are measured), a bar and the difference to the longest lane
  function stripHtml(v, ctx, shown) {
    const { rows, mod } = laneRows(v),
      typed = shown || [];
    return `<div class="ts-strip">${rows
      .map(
        r =>
          `<div class="ts-ln" style="--c:${laneColor(r.lane)}"><span class="n">L${r.lane + 1}</span>${
            mod === 'measured'
              ? `<span class="bs-unit ts-lv"><input type="number" step="any" min="0" data-ts-lane="${r.lane}" value="${h(typed[r.lane] ?? '')}" aria-label="Length of lane ${r.lane + 1}"><i>${ctx && ctx.ft ? 'ft' : 'm'}</i></span>`
              : `<span class="v">${lenText(r.len, ctx)}<small>${h(r.from)}</small></span>`
          }<span class="ts-bar"><i style="width:${r.bar}%"></i></span><span class="df">${r.len > 0 ? diffText(r.diff, ctx) : '–'}</span></div>`
      )
      .join('')}</div><p class="ts-say">${h(laneSay(v, ctx))}</p>`;
  }
  const SECTOR_COLORS = [
    '#e5484d',
    '#3b82f6',
    '#f5c211',
    '#3ecf8e',
    '#a855f7',
    '#f97316',
    '#14b8a6',
    '#ec4899',
    '#e5484d',
    '#3b82f6',
    '#f5c211',
    '#3ecf8e'
  ];
  function sectorsHtml(n, names) {
    if (!(n > 1)) return '<p class="muted ts-say">Two or more sectors give every part of the track a name.</p>';
    return `<div class="ts-secbar">${Array.from({ length: n }, (_, i) => `<i style="--c:${SECTOR_COLORS[i]}"></i>`).join('')}</div><div class="ts-secs">${Array.from(
      { length: n },
      (_, i) =>
        `<label class="ts-sec" style="--c:${SECTOR_COLORS[i]}"><span><i></i>Sector ${i + 1}${i === 0 ? ' · starts at the line' : ''}</span><input data-ts-sector="${i}" value="${h(names[i] || '')}" placeholder="Sector ${i + 1}"></label>`
    ).join('')}</div>`;
  }
  const lettersHtml = cs => {
    const l = String(cs || '').toUpperCase();
    return `<span class="ts-cs" role="group" aria-label="Callsign">${[0, 1, 2].map(i => `<input maxlength="1" data-ts-cs="${i}" value="${h(l[i] || '')}" aria-label="Letter ${i + 1} of the callsign">`).join('')}</span>`;
  };
  const towerHtml = (v, color) =>
    `<span class="ts-tower"><i style="background:${h(color || laneColor(0))}"></i><b>${h(v.name || 'Name')}</b>${h(String(v.callsign || '').toUpperCase())}</span>`;
  // what a list of numbers is joined back into: "15.4, 15.8" (empty places at the end go)
  const joinList = list => {
    const a = list.map(x => String(x ?? '').trim());
    while (a.length && a[a.length - 1] === '') a.pop();
    return a.join(', ');
  };

  // ---- in the form ----
  // Put the controls over the fields of the sheet. dlg: the window; e; ctx: { item, values(), ft, refs, sessions(): Promise, act(act) } -> update() (called after every change)
  // (a page that cannot hold the controls, such as the stand-in page of a test, keeps the plain fields)
  const domOk = el =>
    !!el &&
    !!el.classList &&
    typeof el.after === 'function' &&
    typeof document !== 'undefined' &&
    typeof document.createElement === 'function';
  function wire(dlg, e, ctx) {
    if (!dlg || !dlg.querySelector || !domOk(dlg.querySelector('#frm'))) return () => {};
    const $ = id => dlg.querySelector('#' + id),
      field = key => dlg.querySelector(`.field[data-key="${key}"]`);
    const fire = (el, type) => el.dispatchEvent(new Event(type, { bubbles: true }));
    const setVal = (el, v) => {
      el.value = v;
      fire(el, 'input');
      fire(el, 'change');
    };
    const form = $('frm');
    if (form) form.classList.add('ts-sheet', 'ts-' + e);
    const parts = [];
    // a select as a row of buttons
    const seg = (key, labels) => {
      const sel = $('f-' + key),
        f = field(key);
      if (!sel || !f) return;
      f.classList.add('ts-segfield');
      const box = document.createElement('span');
      box.className = 'ts-segbox';
      sel.after(box);
      sel.classList.add('ts-hidden');
      const draw = () => {
        box.innerHTML = segHtml(key, labels(), sel.value);
      };
      draw();
      parts.push(draw);
    };
    // (the window is used again for every form: one listener, of the sheet that is open now)
    if (dlg._tsClick) dlg.removeEventListener('click', dlg._tsClick);
    dlg._tsClick = ev => {
      const b = ev.target.closest && ev.target.closest('[data-ts-seg],[data-ts-lanes],[data-ts-step],[data-sheet-act]');
      if (!b || !dlg.contains(b) || !form || !form.isConnected) return;
      if (b.dataset.tsSeg) return setVal($('f-' + b.dataset.tsSeg), b.dataset.val);
      if (b.dataset.tsLanes) return setVal($('f-lanes'), b.dataset.tsLanes);
      if (b.dataset.tsStep) {
        const inp = $('f-sectors'),
          n = Math.max(0, Math.min(12, (Math.round(num(inp.value)) || 0) + Number(b.dataset.tsStep)));
        return setVal(inp, n ? String(n) : '');
      }
      if (b.dataset.sheetAct && ctx.act) {
        const d = b.closest('details');
        if (d) d.open = false;
        return ctx.act(b.dataset.sheetAct);
      }
    };
    dlg.addEventListener('click', dlg._tsClick);
    if (e === 'tracks') {
      // the lanes as tiles
      const lanes = $('f-lanes');
      if (lanes) {
        lanes.classList.add('ts-hidden');
        const box = document.createElement('span');
        lanes.after(box);
        parts.push(() => (box.innerHTML = laneTilesHtml(lanesOf({ lanes: lanes.value }))));
      }
      seg('laneModifier', () => [
        ['none', 'All the same length'],
        ['bends', 'Worked out from the bends'],
        ['measured', 'Measured: I type each one']
      ]);
      seg('outsideLane', () => [
        ['last', `Lane ${lanesOf({ lanes: lanes && lanes.value })} (outside)`],
        ['first', 'Lane 1 (outside)']
      ]);
      // the lane strip, after the lane fields; the list of lengths stays, hidden
      const list = $('f-laneLengths'),
        lf = field('laneLengths');
      if (lf) lf.classList.add('ts-hidden');
      const anchor = lf || field('netTurns') || field('laneModifier');
      if (anchor) {
        const box = document.createElement('div');
        box.className = 'field full ts-stripfield';
        box.innerHTML = '<span class="fu-q">Every lane</span><div data-ts-strip></div>';
        anchor.after(box);
        const slot = box.querySelector('[data-ts-strip]');
        slot.addEventListener('input', ev => {
          const t = ev.target;
          if (!t.dataset || t.dataset.tsLane === undefined || !list) return;
          ev.stopPropagation();
          const cur = String(list.value || '')
            .split(',')
            .map(x => x.trim());
          cur[Number(t.dataset.tsLane)] = t.value;
          setVal(list, joinList(cur));
        });
        parts.push(() => {
          const ae = document.activeElement,
            typing = !!ae && slot.contains(ae) && !!ae.dataset && ae.dataset.tsLane !== undefined;
          const v = ctx.values(),
            shown = String((list && list.value) || '')
              .split(',')
              .map(x => x.trim());
          if (!typing) return (slot.innerHTML = stripHtml(v, ctx, shown));
          // (while a lane is typed in: only the bars, the differences and the sentence follow, the boxes stay)
          const tmp = document.createElement('div');
          tmp.innerHTML = stripHtml(v, ctx, shown);
          slot.querySelectorAll('.ts-ln').forEach((row, i) => {
            const n = tmp.querySelectorAll('.ts-ln')[i];
            if (!n) return;
            row.querySelector('.ts-bar').innerHTML = n.querySelector('.ts-bar').innerHTML;
            row.querySelector('.df').textContent = n.querySelector('.df').textContent;
          });
          slot.querySelector('.ts-say').textContent = tmp.querySelector('.ts-say').textContent;
        });
      }
      // the sectors: − and +, and a box per name
      const secs = $('f-sectors'),
        names = $('f-sectorNames'),
        nf = field('sectorNames');
      if (secs) {
        secs.classList.add('ts-hidden');
        const step = document.createElement('span');
        step.className = 'ts-step';
        secs.after(step);
        parts.push(() => {
          step.innerHTML = `<button type="button" data-ts-step="-1" aria-label="One sector fewer">−</button><span>${Math.round(num(secs.value)) || 0}</span><button type="button" data-ts-step="1" aria-label="One sector more">+</button>`;
        });
      }
      if (nf && names) {
        nf.classList.add('ts-hidden');
        const box = document.createElement('div');
        box.className = 'field full ts-secfield';
        nf.after(box);
        box.addEventListener('input', ev => {
          const t = ev.target;
          if (!t.dataset || t.dataset.tsSector === undefined) return;
          ev.stopPropagation();
          const cur = sectorNamesOf({ sectorNames: names.value });
          cur[Number(t.dataset.tsSector)] = t.value.replace(/,/g, ' ');
          setVal(names, joinList(cur));
        });
        let drawn = -1;
        parts.push(() => {
          const n = Math.round(num(secs && secs.value)) || 0;
          if (n === drawn && box.innerHTML) return; // (the boxes are drawn again only when the number changes: a box keeps its cursor)
          drawn = n;
          box.innerHTML = sectorsHtml(n, sectorNamesOf({ sectorNames: names.value }));
        });
      }
    }
    if (e === 'drivers') {
      seg('retired', () => [
        ['', 'Racing'],
        ['retired', 'Retired: kept in the results']
      ]);
      seg('driverType', () => [
        ['human', 'Human'],
        ['virtual', 'Virtual rival']
      ]);
      const cs = $('f-callsign'),
        cf = field('callsign');
      if (cs && cf) {
        cs.classList.add('ts-hidden');
        const box = document.createElement('span');
        box.className = 'ts-csbox';
        box.innerHTML = lettersHtml(cs.value) + '<span data-ts-tower></span>';
        cs.after(box);
        box.addEventListener('input', ev => {
          const t = ev.target;
          if (!t.dataset || t.dataset.tsCs === undefined) return;
          ev.stopPropagation();
          t.value = t.value
            .replace(/[^a-z0-9]/gi, '')
            .toUpperCase()
            .slice(-1);
          const letters = [...box.querySelectorAll('[data-ts-cs]')].map(x => x.value || ' ');
          setVal(cs, letters.join('').trimEnd().replace(/ /g, ''));
          if (t.value && t.nextElementSibling && t.nextElementSibling.dataset.tsCs !== undefined) t.nextElementSibling.focus();
        });
        box.addEventListener('keydown', ev => {
          const t = ev.target;
          if (ev.key === 'Backspace' && t.dataset && t.dataset.tsCs !== undefined && !t.value && t.previousElementSibling)
            t.previousElementSibling.focus();
        });
        parts.push(() => {
          const v = ctx.values();
          box.querySelector('[data-ts-tower]').innerHTML = towerHtml(v, v.color);
        });
      }
    }
    // the record from the saved results (an item that is saved), on top and under the rail
    if (ctx.item && ctx.sessions) {
      const main = dlg.querySelector('.rsmain'),
        say = $('rssay');
      let sec = null;
      if (main && e !== 'tracks') {
        sec = document.createElement('section');
        sec.className = 'ts-record';
        sec.innerHTML = `<h3>On the record</h3><p class="muted">What ${h(ctx.item.name || 'this ' + (e === 'teams' ? 'team' : 'driver'))} has done so far, from the saved results.</p><div class="ts-tiles"><span class="muted">Counting…</span></div>`;
        (say || main.firstChild) && (say ? say.after(sec) : main.prepend(sec));
      }
      ctx
        .sessions()
        .then(list => {
          const r = recordOf(e, ctx.item.id, list);
          if (sec) sec.querySelector('.ts-tiles').outerHTML = recordHtml(e, ctx.item.name, r);
          const nav = dlg.querySelector('.rsrail');
          if (nav && (r.races || e === 'tracks')) nav.insertAdjacentHTML('beforeend', underRail(e, r));
          const note = dlg.querySelector('.ts-footnote');
          if (note && e === 'drivers' && r.races)
            note.textContent = `In ${plural(r.races, 'saved race', 'saved races')}: Retire keeps them, Delete takes ${ctx.item.name || 'the driver'} out of them`;
          if (note && e === 'tracks' && r.races) note.textContent = `${plural(r.races, 'race', 'races')} recorded on this track`;
        })
        .catch(() => sec && sec.remove());
    }
    const update = () => parts.forEach(p => p());
    update();
    return update;
  }
  // the More menu in the foot of a sheet (an item that is saved)
  function moreHtml(e, item) {
    if (!item) return '';
    const acts =
      e === 'tracks'
        ? [
            ['design', 'Track design…'],
            ['duplicate', 'Duplicate track'],
            ['delete', 'Delete track…']
          ]
        : e === 'drivers'
          ? [
              ['merge', 'Merge into another driver…'],
              [item.retired ? 'unretire' : 'retire', item.retired ? 'Back to racing' : 'Retire driver'],
              ['delete', 'Delete driver…']
            ]
          : [['delete', 'Delete team…']];
    return `<span class="muted ts-footnote"></span><details class="bs-more ts-more"><summary class="btn">More</summary><div class="bs-menu">${acts.map(([a, l]) => `<button type="button" class="btn${a === 'delete' ? ' ts-del' : ''}" data-sheet-act="${a}">${h(l)}</button>`).join('')}</div></details>`;
  }

  // ---- Delete a driver: what goes, Retire or Merge first, and the name typed for a driver with results ----
  // r: { races, laps, records } -> Promise of 'retire' | 'merge' | 'delete' | null
  function deleteDriverHtml(name, r) {
    const n = h(name || 'this driver'),
      has = r.races > 0 || r.laps > 0;
    return `<h3>Delete ${n}?</h3><div class="appdlg-body">${
      has
        ? `<p>${n} is in saved results. Deleting takes ${n} out of them for good:</p><div class="ts-gone"><div><small>Races</small><b>${r.races}</b></div><div><small>Laps</small><b>${r.laps.toLocaleString()}</b></div><div><small>Track records</small><b>${r.records}</b></div></div>`
        : `<p>${n} has no saved results yet.</p>`
    }<p class="ts-usually">Usually one of these is what you want:</p><div class="ts-alt"><button type="button" class="ts-rec1" data-del-pick="retire"><b>Retire ${n} instead</b><span>Off the lists for a new race; every result, lap and record stays.</span></button><button type="button" data-del-pick="merge"><b>Merge into another driver…</b><span>${n} is a duplicate: the races go to the other driver.</span></button></div>${
      has ? `<label class="ts-type">To delete anyway, type the name<input data-del-name placeholder="${n}" autocomplete="off"></label>` : ''
    }</div><div class="row appdlg-buttons"><button type="button" class="btn" data-del-pick="">Keep ${n}</button><button type="button" class="btn danger" data-del-pick="delete"${has ? ' disabled' : ''}>Delete ${n}${has ? ' and the results' : ''}</button></div>`;
  }
  const nameMatches = (typed, name) =>
    String(typed || '')
      .trim()
      .toLowerCase() ===
      String(name || '')
        .trim()
        .toLowerCase() && String(name || '').trim() !== '';
  function askDeleteDriver(name, r) {
    return new Promise(resolve => {
      const d = document.createElement('dialog');
      d.className = 'appdlg ts-deldlg';
      d.innerHTML = deleteDriverHtml(name, r);
      document.body.appendChild(d);
      const done = v => {
        d.close();
        d.remove();
        resolve(v);
      };
      const del = d.querySelector('[data-del-pick="delete"]'),
        typed = d.querySelector('[data-del-name]');
      if (typed) typed.addEventListener('input', () => (del.disabled = !nameMatches(typed.value, name)));
      d.addEventListener('click', ev => {
        const b = ev.target.closest && ev.target.closest('[data-del-pick]');
        if (!b || b.disabled) return;
        done(b.dataset.delPick || null);
      });
      d.addEventListener('cancel', ev => {
        ev.preventDefault();
        done(null);
      });
      d.showModal();
      d.querySelector('[data-del-pick="retire"]').focus();
    });
  }

  // ---- lane boxes for a list of numbers in a race setup (Distance of every lane, the swap distances) ----
  // key: the field; o: { count(): how many boxes, label(i), color(i) or none, grow (+ and − to add or take away a box) }
  function listBoxes(dlg, key, o) {
    const inp = dlg.querySelector('#f-' + key),
      f = dlg.querySelector(`.field[data-key="${key}"]`);
    if (!inp || !f || !domOk(inp)) return () => {};
    inp.classList.add('ts-hidden');
    const box = document.createElement('div');
    box.className = 'ts-boxes';
    inp.after(box);
    let extra = 0;
    const draw = () => {
      if (box.contains(document.activeElement)) return;
      const vals = String(inp.value || '')
          .split(',')
          .map(x => x.trim()),
        n = Math.max(o.grow ? 1 : 0, o.grow ? Math.max(vals.filter(Boolean).length, 1) + extra : o.count());
      box.innerHTML =
        Array.from(
          { length: n },
          (_, i) =>
            `<label class="ts-box"${o.color ? ` style="--c:${o.color(i)}"` : ''}><small>${h(o.label(i))}</small><span class="bs-unit"><input type="number" step="any" min="0" data-ts-box="${i}" value="${h(vals[i] || '')}" aria-label="${h(o.label(i))}"><i>${h(o.unit || '')}</i></span></label>`
        ).join('') +
        (o.grow
          ? `<button type="button" class="btn small" data-ts-boxadd>+</button><button type="button" class="btn small" data-ts-boxdrop${n <= 1 ? ' disabled' : ''}>−</button>`
          : '');
    };
    box.addEventListener('input', ev => {
      const t = ev.target;
      if (!t.dataset || t.dataset.tsBox === undefined) return;
      ev.stopPropagation();
      const vals = [...box.querySelectorAll('[data-ts-box]')].map(x => x.value);
      inp.value = joinList(vals);
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    });
    box.addEventListener('focusout', () => setTimeout(draw, 0));
    box.addEventListener('click', ev => {
      const b = ev.target.closest && ev.target.closest('[data-ts-boxadd],[data-ts-boxdrop]');
      if (!b) return;
      if (b.dataset.tsBoxadd !== undefined) extra++;
      else {
        const vals = String(inp.value || '')
          .split(',')
          .map(x => x.trim());
        if (extra > 0) extra--;
        else {
          vals.pop();
          inp.value = joinList(vals);
          inp.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
      draw();
    });
    draw();
    return draw;
  }

  return {
    ENTITIES,
    laneRows,
    laneSay,
    describe,
    rail,
    trackSvg,
    recordOf,
    recordHtml,
    underRail,
    laneTilesHtml,
    stripHtml,
    sectorsHtml,
    lettersHtml,
    towerHtml,
    joinList,
    moreHtml,
    deleteDriverHtml,
    nameMatches,
    askDeleteDriver,
    listBoxes,
    wire
  };
})();
if (typeof module !== 'undefined') module.exports = DbSheet;
