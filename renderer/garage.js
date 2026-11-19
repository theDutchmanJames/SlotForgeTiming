// (2.4.0, SlotForgeRestyle.md "Garage") the Database lists of tracks, drivers, teams and slotcars: a card that says what a thing is at a glance (a car drawn
// in its livery with its number, a driver's helmet and callsign, a track drawn with its lanes), its figures from the races, the filters and the sorts of the
// Control Strip, the rows of the list, the empty card, the gearing of a car worked out, and a club list read from a CSV file.
// Pure: it makes text and numbers only, so it can be tested without a screen. renderer/database/manager.js draws it and wires the buttons.
(function (root) {
  'use strict';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const LANES = ['#e5484d', '#3b82f6', '#f5c211', '#3ecf8e', '#a855f7', '#f97316', '#14b8a6', '#ec4899'];
  // the colours a car can be painted in when nothing is set: from the words of its livery, or one made from its name
  const WORDS = [
    ['red', '#d92d20'],
    ['rosso', '#d92d20'],
    ['blue', '#1f6feb'],
    ['gulf', '#7cc4e8'],
    ['green', '#0f9d58'],
    ['yellow', '#f5c211'],
    ['orange', '#f97316'],
    ['white', '#eeeeee'],
    ['silver', '#b8bec7'],
    ['black', '#22262c'],
    ['purple', '#7c3aed'],
    ['pink', '#ec4899'],
    ['gold', '#d4a017']
  ];
  const PAINT = ['#1f6feb', '#d92d20', '#0f9d58', '#f97316', '#7c3aed', '#14b8a6', '#d4a017', '#eeeeee', '#4d8fd6', '#e11d2e'];
  const hash = t => {
    let n = 0;
    for (const ch of String(t || '')) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
    return n;
  };
  const isColor = c => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
  // the light letters or the dark ones on a colour
  const light = c => {
    const n = parseInt(c.slice(1), 16);
    return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 170;
  };
  // [body, stripe] of a car: the colours chosen for it, else the colour words of its livery, else one from its name
  function carColors(car, colors) {
    const own = (Array.isArray(colors) ? colors : []).filter(isColor);
    if (own.length) return [own[0], own[1] || (light(own[0]) ? '#22262c' : '#ffffff')];
    const words = String((car && car.livery) || '').toLowerCase(),
      found = WORDS.filter(([w]) => words.includes(w)).map(([, c]) => c);
    if (found.length) return [found[0], found[1] || (light(found[0]) ? '#22262c' : '#ffffff')];
    const body = PAINT[hash(car && (car.id || car.name)) % PAINT.length];
    return [body, light(body) ? '#e11d2e' : '#ffffff'];
  }
  // the race number of a car: its own, or the "#18" at the end of its name
  function numberOf(car, title) {
    const own = String((car && car.number) ?? '').trim();
    if (own) return own.slice(0, 3);
    const m = /#\s*(\d{1,3})\b/.exec(String(title || (car && car.name) || ''));
    return m ? m[1] : '';
  }
  // a slot car seen from above, in its livery, with its number on the roundel
  function carSvg(colors, number, key = 'c') {
    const [body, stripe] = colors,
      g = 'gx' + (hash(key + body + number) % 1e6);
    return `<svg viewBox="0 0 220 124" aria-hidden="true" class="gx-carsvg"><defs><linearGradient id="${g}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${body}"/><stop offset="1" stop-color="${body}" stop-opacity=".72"/></linearGradient></defs><path d="M0 62h220" stroke="currentColor" stroke-opacity=".08" stroke-width="30"/><path d="M0 62h220" stroke="currentColor" stroke-opacity=".18" stroke-width="1.5" stroke-dasharray="6 8"/><rect x="52" y="30" width="18" height="12" rx="3" fill="#111"/><rect x="52" y="82" width="18" height="12" rx="3" fill="#111"/><rect x="146" y="28" width="22" height="14" rx="3" fill="#111"/><rect x="146" y="82" width="22" height="14" rx="3" fill="#111"/><path d="M34 62c0-14 10-24 30-26l60-3c22-1 40 2 58 8 8 3 12 10 12 21s-4 18-12 21c-18 6-36 9-58 8l-60-3c-20-2-30-12-30-26z" fill="url(#${g})" stroke="#000" stroke-opacity=".25"/><path d="M34 62h160" stroke="${stripe}" stroke-opacity=".85" stroke-width="7"/><path d="M96 44c8-3 26-4 38-2 6 1 9 10 9 20s-3 19-9 20c-12 2-30 1-38-2-3-5-4-11-4-18s1-13 4-18z" fill="#0d1117" fill-opacity=".82"/>${number ? `<circle cx="166" cy="62" r="13" fill="#fff"/><text x="166" y="67" text-anchor="middle" font-family="'SF Roboto Mono',Consolas,monospace" font-weight="700" font-size="${number.length > 2 ? 11 : 14}" fill="#111">${esc(number)}</text>` : ''}<rect x="26" y="50" width="6" height="24" rx="2" fill="#2a2f36"/></svg>`;
  }
  // a track drawn as an oval with its lanes in the lane colours (up to 8) and the start line
  function trackSvg(lanes) {
    const n = Math.min(8, Math.max(1, Math.floor(Number(lanes)) || 1)),
      w = 220,
      h = 124,
      gap = Math.min(7, 30 / n);
    return `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true" class="gx-tracksvg"><rect x="24" y="18" width="${w - 48}" height="${h - 36}" rx="${(h - 36) / 2}" fill="none" stroke="currentColor" stroke-opacity=".12" stroke-width="${n * gap + 10}"/>${Array.from(
      { length: n },
      (_, k) => {
        const o = (k - (n - 1) / 2) * gap;
        return `<rect x="${24 - o}" y="${18 - o}" width="${w - 48 + 2 * o}" height="${h - 36 + 2 * o}" rx="${(h - 36) / 2 + o}" fill="none" stroke="${LANES[k]}" stroke-width="1.8"/>`;
      }
    ).join(
      ''
    )}<path d="M${w / 2} ${18 - (n * gap) / 2 - 4}v${n * gap + 8}" stroke="currentColor" stroke-width="2.5" stroke-dasharray="2 2"/></svg>`;
  }
  // the colour of a driver: their own, else one of the lane colours made from their name; and the helmet picture that goes with it
  function driverColor(d) {
    return isColor(d && d.color) ? d.color : LANES[hash(d && (d.id || d.name)) % LANES.length];
  }
  function helmetOf(d) {
    const c = driverColor(d).toLowerCase(),
      at = LANES.indexOf(c);
    if (at >= 0) return at + 1;
    // the nearest lane colour
    const rgb = x => [parseInt(x.slice(1, 3), 16), parseInt(x.slice(3, 5), 16), parseInt(x.slice(5, 7), 16)];
    const [r, g, b] = rgb(c);
    let best = 0,
      gapBest = Infinity;
    LANES.forEach((l, i) => {
      const [R, G, B] = rgb(l),
        gap = (R - r) ** 2 + (G - g) ** 2 + (B - b) ** 2;
      if (gap < gapBest) {
        gapBest = gap;
        best = i;
      }
    });
    return best + 1;
  }
  const RACES = new Set(['race', 'heats', 'endurance', 'tokens']);
  // the figures of every driver, car and track from the saved sessions: races, wins, the best lap, when last raced; a track's record and who holds it
  function statsOf(sessions) {
    const drivers = new Map(),
      cars = new Map(),
      tracks = new Map(),
      teams = new Map();
    const row = (m, id) => {
      if (!m.has(id)) m.set(id, { races: 0, wins: 0, best: 0, last: '', laps: 0, holder: '' });
      return m.get(id);
    };
    for (const s of Array.isArray(sessions) ? sessions : []) {
      if (!s) continue;
      const date = String(s.date || ''),
        win = RACES.has(s.sessionType),
        seenD = new Set(),
        seenC = new Set(),
        seenT = new Set();
      const t = s.trackId ? row(tracks, s.trackId) : null;
      if (t) {
        t.races++;
        if (date > t.last) t.last = date;
      }
      for (const st of Array.isArray(s.standings) ? s.standings : []) {
        if (!st) continue;
        const best = Number(st.best) > 0 ? Number(st.best) : 0,
          won = win && Number(st.pos) === 1 && !st.dq;
        for (const [m, id, seen] of [
          [drivers, st.driverId, seenD],
          [cars, st.carId, seenC],
          [teams, st.teamId, seenT]
        ]) {
          if (!id) continue;
          const r = row(m, id);
          if (!seen.has(id)) {
            r.races++;
            seen.add(id);
            if (won) r.wins++;
          }
          if (best && (!r.best || best < r.best)) r.best = best;
          if (date > r.last) r.last = date;
          r.laps += Number(st.laps) > 0 ? Number(st.laps) : 0;
        }
        if (t && best && (!t.best || best < t.best)) {
          t.best = best;
          t.holder = String(st.driverName || st.teamName || '');
        }
      }
    }
    return { drivers, cars, tracks, teams };
  }
  const short = name => {
    const p = String(name || '')
      .trim()
      .split(/\s+/);
    return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0] || '';
  };
  const lap = ms => {
    if (!(ms > 0)) return '';
    const s = ms / 1000;
    return s < 60 ? s.toFixed(3) : `${Math.floor(s / 60)}:${(s % 60).toFixed(3).padStart(6, '0')}`;
  };
  const day = iso => {
    const t = Date.parse(iso);
    return Number.isFinite(t) ? new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
  };
  const count = n => Number(n || 0).toLocaleString('en-US');
  // the availability of a car in three words; any other text is kept as it is
  const AVAILABLE = ['Available', 'Kept for one driver', 'Out for repair'];
  const canRace = car => {
    const a = String((car && car.availability) || '').trim();
    return !a || /^avail/i.test(a);
  };
  // ---- filters and sorts of the Control Strip ----
  // [id, label, test(item, ctx)] for each list; a filter with nothing in it is left out (All stays)
  const FILTERS = {
    slotcars: [
      ['all', 'All', () => true],
      ['ready', 'Available', (i, c) => canRace(i) && !c.archived(i)],
      ['due', 'Service due', (i, c) => c.due(i), 'amber'],
      ['off', 'Not available', (i, c) => !canRace(i) && !c.archived(i)],
      ['archived', 'Archived', (i, c) => c.archived(i)]
    ],
    drivers: [
      ['racing', 'Racing', i => !i.retired && i.driverType !== 'virtual'],
      ['virtual', 'Virtual rivals', i => i.driverType === 'virtual'],
      ['retired', 'Retired', i => !!i.retired],
      ['all', 'All', () => true]
    ],
    tracks: [['all', 'All', () => true]],
    teams: [['all', 'All', () => true]]
  };
  function filters(e, items, ctx) {
    const list = (FILTERS[e] || FILTERS.teams).map(([id, label, test, tone]) => ({
      id,
      label,
      tone: tone || '',
      n: items.filter(i => test(i, ctx)).length
    }));
    if (e === 'tracks') {
      const lanes = [...new Set(items.map(i => Math.floor(Number(i.lanes)) || 0).filter(n => n > 0))].sort((a, b) => a - b);
      if (lanes.length > 1)
        for (const n of lanes)
          list.push({
            id: 'lanes' + n,
            label: `${n} ${n === 1 ? 'lane' : 'lanes'}`,
            tone: '',
            n: items.filter(i => Math.floor(Number(i.lanes)) === n).length
          });
    }
    return list.filter(f => f.n > 0 || f.id === 'all' || f.id === (FILTERS[e] || [])[0]?.[0]);
  }
  function filterItems(e, id, items, ctx) {
    if (/^lanes\d+$/.test(id)) return items.filter(i => Math.floor(Number(i.lanes)) === Number(id.slice(5)));
    const f = (FILTERS[e] || []).find(x => x[0] === id);
    return f ? items.filter(i => f[2](i, ctx)) : items;
  }
  const SORTS = {
    slotcars: [
      ['name', 'Name'],
      ['laps', 'Most laps'],
      ['best', 'Best lap'],
      ['recent', 'Raced lately'],
      ['wins', 'Most wins']
    ],
    drivers: [
      ['name', 'Name'],
      ['wins', 'Most wins'],
      ['races', 'Most races'],
      ['best', 'Best lap'],
      ['recent', 'Raced lately']
    ],
    tracks: [
      ['name', 'Name'],
      ['races', 'Most races'],
      ['lanes', 'Most lanes']
    ],
    teams: [['name', 'Name']]
  };
  // sorted: the name order of the database stays for 'name' and breaks every tie
  function sortItems(e, key, items, ctx) {
    if (key === 'name' || !(SORTS[e] || []).some(s => s[0] === key)) return items;
    const st = i => ctx.stat(i) || {};
    const by = {
      laps: i => -(ctx.laps ? ctx.laps(i) : st(i).laps || 0),
      wins: i => -(st(i).wins || 0),
      races: i => -(st(i).races || 0),
      best: i => (st(i).best > 0 ? st(i).best : Infinity),
      recent: i => -(Date.parse(st(i).last) || 0),
      lanes: i => -(Number(i.lanes) || 0)
    }[key];
    return items
      .map((i, n) => [i, n])
      .sort((a, b) => by(a[0]) - by(b[0]) || a[1] - b[1])
      .map(x => x[0]);
  }
  // ---- the figures under a card, the lines on top, the empty card ----
  const ic = (d, s = 14) =>
    `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICON = {
    edit: ic('<path d="M4 20h4L19 9l-4-4L4 16z"/>'),
    more: ic('<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>', 16),
    wrench: ic('<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-.5-.5-2.5z"/>', 12),
    oval: ic('<path d="M5 12a7 5 0 1 0 14 0a7 5 0 1 0-14 0"/>'),
    team: ic(
      '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14c2.8 0 5 2.2 5 5"/>',
      34
    ),
    driver: ic('<circle cx="12" cy="9" r="5"/><path d="M7 9h10M4 21c1-4 4-6 8-6s7 2 8 6"/>', 34),
    car: ic('<path d="M3 14l2-5h14l2 5v4H3z"/><circle cx="7.5" cy="18" r="1.8"/><circle cx="16.5" cy="18" r="1.8"/>', 34),
    track: ic('<path d="M5 12a7 5 0 1 0 14 0a7 5 0 1 0-14 0"/><path d="M12 5v3"/>', 34)
  };
  const stat = (label, value, cls = '') =>
    `<div><small>${label}</small><b class="${value ? cls : 'none'}">${value ? esc(value) : '—'}</b></div>`;
  // the three figures of a card, and the line over the name
  function figures(e, i, ctx) {
    const s = ctx.stat(i) || {};
    if (e === 'slotcars')
      return {
        eye: [i.maker || i.manufacturer || i.brand, i.scale].filter(Boolean).join(' · '),
        stats: [
          ['Laps', count(ctx.laps(i))],
          ['Best', lap(s.best), 'fl'],
          ['Raced', day(s.last)]
        ]
      };
    if (e === 'drivers') {
      const eye =
        i.driverType === 'virtual'
          ? 'Virtual rival'
          : s.wins
            ? `${s.wins} ${s.wins === 1 ? 'win' : 'wins'} · ${Math.round((100 * s.wins) / s.races)} %`
            : s.races
              ? 'No wins yet'
              : 'New driver';
      return {
        eye: i.nickname ? `“${i.nickname}” · ${eye}` : eye,
        stats: [
          ['Races', s.races ? count(s.races) : ''],
          ['Wins', s.wins ? count(s.wins) : ''],
          ['Best', lap(s.best), 'fl']
        ]
      };
    }
    if (e === 'tracks')
      return {
        eye: [i.scale, i.length > 0 ? ctx.dist(i.length) : 'length not set'].filter(Boolean).join(' · '),
        stats: [
          ['Record', lap(s.best), 'fl'],
          ['By', short(s.holder), 'who'],
          ['Races', s.races ? count(s.races) : '']
        ]
      };
    const members = Array.isArray(i.drivers) ? i.drivers.length : 0;
    return {
      eye: members ? `${members} ${members === 1 ? 'driver' : 'drivers'}` : 'No drivers yet',
      stats: [
        ['Drivers', members ? String(members) : ''],
        ['Races', s.races ? count(s.races) : ''],
        ['Wins', s.wins ? count(s.wins) : '']
      ]
    };
  }
  // the badges on the picture: [left, right] as [text, tone]
  function badges(e, i, ctx) {
    if (e === 'slotcars') {
      const left = ctx.className(i) ? [ctx.className(i), ''] : null;
      const right = ctx.archived(i)
        ? ['Archived', 'off']
        : ctx.due(i)
          ? ['Service due', 'due']
          : !canRace(i)
            ? [String(i.availability).trim(), 'off']
            : !ctx.laps(i) && !(ctx.stat(i) || {}).races
              ? ['Not raced yet', '']
              : null;
      return [left, right];
    }
    if (e === 'drivers')
      return [
        i.retired
          ? ['Retired', 'off']
          : i.driverType === 'virtual'
            ? ['Virtual rival', 'rival']
            : !(ctx.stat(i) || {}).races
              ? ['No races yet', '']
              : null,
        null
      ];
    if (e === 'tracks')
      return [
        i.lanes > 0 ? [`${i.lanes} ${Number(i.lanes) === 1 ? 'lane' : 'lanes'}`, ''] : null,
        ctx.most && ctx.most === i.id ? ['Raced most', ''] : null
      ];
    return [null, null];
  }
  const badge = (b, side) =>
    b ? `<span class="gx-badge ${side}${b[1] ? ' ' + b[1] : ''}">${b[1] === 'due' ? ICON.wrench : ''}${esc(b[0])}</span>` : '';
  // the picture of a card: the item's own photo (picture is HTML made by the page), else its drawing
  function pictureOf(e, i, ctx, picture) {
    if (picture) return picture;
    if (e === 'slotcars') return carSvg(carColors(i, ctx.colors(i)), numberOf(i, ctx.title(i)), i.id);
    if (e === 'tracks') return trackSvg(i.lanes);
    if (e === 'drivers') {
      const cs = String(i.callsign || '').trim();
      return `<div class="gx-helm"><img src="avatars/Lane${helmetOf(i)}.png" alt=""><div class="gx-cs"><b class="${cs ? '' : 'ghost'}">${esc((cs || String(i.name || '?').replace(/\s+/g, '')).slice(0, 3).toUpperCase())}</b>${i.flag ? `<span class="gx-flag"><span class="fi fi-${esc(String(i.flag).toLowerCase())}"></span>${esc(String(i.flag).toUpperCase())}</span>` : ''}</div></div>`;
    }
    return `<span class="gx-icon-big">${ICON.team}</span>`;
  }
  // a card: picture (with badges), the line over the name, the name in Barlow, three figures, extra rows chosen in View settings, the foot
  function cardHtml(e, i, ctx, o = {}) {
    const t = ctx.title(i),
      f = figures(e, i, ctx),
      [l, r] = badges(e, i, ctx),
      color = e === 'drivers' ? driverColor(i) : '';
    return `<article class="gx-card${ctx.archived(i) || i.retired ? ' dim' : ''}" data-view="${esc(i.id)}" tabindex="0" aria-label="View ${esc(t)}"${color ? ` style="--c:${color}"` : ''}><div class="gx-pic${o.picture ? ' photo' : ''}">${pictureOf(e, i, ctx, o.picture)}${color ? '<span class="gx-line"></span>' : ''}${badge(l, 'l')}${badge(r, 'r')}</div>
<div class="gx-body">${f.eye ? `<span class="gx-eye">${esc(f.eye)}</span>` : ''}<h3>${esc(t)}</h3>${o.mark || ''}<div class="gx-stats">${f.stats.map(([a, b, c]) => stat(a, b, c)).join('')}</div>${o.details || ''}</div>
<div class="gx-foot"><button class="btn sm" type="button" data-edit="${esc(i.id)}">${ICON.edit}Edit</button>${e === 'tracks' ? `<button class="btn sm" type="button" data-track-design="${esc(i.id)}">${ICON.oval}Track design</button>` : ''}<button class="btn sm ghost icon gx-more" type="button" data-more="${esc(i.id)}" aria-haspopup="menu" aria-label="More for ${esc(t)}" title="More">${ICON.more}</button></div></article>`;
  }
  // the head of the list view and a row: a tick, a small picture, the name, the figures, the extra columns, the buttons
  function rowHead(e, cols, all) {
    const f = figures(e, {}, { stat: () => ({}), laps: () => 0, dist: () => '', title: () => '' });
    return `<div class="gx-tr h" role="row"><span><input type="checkbox" class="gx-cb" data-pick-all aria-label="Choose all"${all ? ' checked' : ''}></span><span></span><span>Name</span>${cols.map(c => `<span>${esc(c.label)}</span>`).join('')}${f.stats.map(([a]) => `<span>${a}</span>`).join('')}<span></span></div>`;
  }
  function rowHtml(e, i, ctx, o = {}) {
    const t = ctx.title(i),
      f = figures(e, i, ctx),
      [, r] = badges(e, i, ctx),
      [l] = badges(e, i, ctx);
    const thumb =
      o.picture ||
      (e === 'drivers'
        ? `<img src="avatars/Lane${helmetOf(i)}.png" alt="" class="gx-thhelm">`
        : e === 'slotcars'
          ? carSvg(carColors(i, ctx.colors(i)), numberOf(i, t), i.id + 'r')
          : e === 'tracks'
            ? trackSvg(i.lanes)
            : ICON.team);
    const chip = r || l;
    return `<div class="gx-tr${o.picked ? ' sel' : ''}${ctx.archived(i) || i.retired ? ' dim' : ''}" role="row" data-view="${esc(i.id)}" tabindex="0" aria-label="View ${esc(t)}"><span><input type="checkbox" class="gx-cb" data-pick="${esc(i.id)}" aria-label="Choose ${esc(t)}"${o.picked ? ' checked' : ''}></span><span class="th">${thumb}</span><span class="n"><b>${esc(t)}</b><small>${esc(f.eye)}${chip ? ` <i class="chip${chip[1] ? ' ' + chip[1] : ''}">${esc(chip[0])}</i>` : ''}</small></span>${(o.cells || []).map(c => `<span class="x">${c}</span>`).join('')}${f.stats.map(([, v, c]) => `<span class="m${v ? (c ? ' ' + c : '') : ' none'}">${v ? esc(v) : '—'}</span>`).join('')}<span class="acts"><button class="btn sm" type="button" data-edit="${esc(i.id)}">${ICON.edit}Edit</button><button class="btn sm ghost icon gx-more" type="button" data-more="${esc(i.id)}" aria-haspopup="menu" aria-label="More for ${esc(t)}" title="More">${ICON.more}</button></span></div>`;
  }
  // the line under the title: what is in the list, in figures
  function summary(e, items, ctx) {
    const parts = [];
    const n = (v, what) => parts.push(`<span><b>${esc(v)}</b>${esc(what)}</span>`);
    if (e === 'slotcars') {
      n(count(items.length), items.length === 1 ? 'car' : 'cars');
      const laps = items.reduce((a, i) => a + (ctx.laps(i) || 0), 0);
      if (laps) n(count(laps), 'laps driven');
      const due = items.filter(i => ctx.due(i)).length;
      if (due) parts.push(`<span class="due"><b>${due}</b>${due === 1 ? 'due for a service' : 'due for a service'}</span>`);
    } else if (e === 'drivers') {
      n(count(items.length), items.length === 1 ? 'driver' : 'drivers');
      const raced = items.filter(i => (ctx.stat(i) || {}).races).length;
      if (raced) n(count(raced), 'have raced');
      const v = items.filter(i => i.driverType === 'virtual').length;
      if (v) n(count(v), v === 1 ? 'virtual rival' : 'virtual rivals');
    } else if (e === 'tracks') {
      n(count(items.length), items.length === 1 ? 'track' : 'tracks');
      const most = items.find(i => i.id === ctx.most);
      if (most) n(ctx.title(most), 'raced most');
    } else n(count(items.length), items.length === 1 ? 'team' : 'teams');
    return `<div class="gx-sum">${parts.join('')}</div>`;
  }
  const EMPTY = {
    slotcars: [
      'car',
      'No slot cars yet',
      'Add the cars of your club: what they are, what is fitted and how they look. Their laps, best laps and services are counted from your races.',
      'Add a slot car'
    ],
    drivers: [
      'driver',
      'No drivers yet',
      'Add the people who race at your club, or read them all at once from a list (a CSV file from a spreadsheet: name, nickname, callsign, country).',
      'Add a driver'
    ],
    tracks: [
      'track',
      'No tracks yet',
      'Add the track you race on: its lanes and its length. Records and races are kept per track.',
      'Add a track'
    ],
    teams: [
      'team',
      'No teams yet',
      "A team is two or more drivers who share a car in an endurance race or a heat race with driver swaps. Their laps and results add up under the team's name.",
      'Add a team'
    ]
  };
  function emptyHtml(e, o = {}) {
    if (o.searching)
      return `<div class="gx-empty small"><div><h3>Nothing found</h3><p>No ${esc(o.plural || 'items')} match “${esc(o.searching)}”.</p><div class="row"><button class="btn" type="button" data-clear-search>Clear the search</button></div></div></div>`;
    if (o.filtered)
      return `<div class="gx-empty small"><div><h3>Nothing here</h3><p>None of the ${esc(o.plural || 'items')} on this page are ${esc(o.filtered.toLowerCase())}.</p><div class="row"><button class="btn" type="button" data-gx-filter="all">Show all</button></div></div></div>`;
    const [icon, title, text, add] = EMPTY[e] || EMPTY.teams;
    return `<div class="gx-empty"><span class="t">${ICON[icon]}</span><div><h3>${esc(title)}</h3><p>${esc(text)}</p><div class="row"><button class="btn primary" type="button" id="add">${esc(add)}</button>${e === 'drivers' ? '<button class="btn" type="button" data-gx-import>Import a club list</button>' : ''}${e === 'tracks' ? '<button class="btn" type="button" id="track-import">Import from Circuit</button>' : ''}</div></div></div>`;
  }
  // the Control Strip: Add (and the page's own import), the search, the filters with their counts, the sort, List / Grid, the page's More
  function stripHtml(o) {
    const search = ic('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', 15),
      grid = ic(
        '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'
      ),
      list = ic('<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>'),
      plus = ic('<path d="M12 5v14M5 12h14"/>', 15),
      upload = ic('<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>');
    const chips =
      (o.filters || []).length > 1
        ? `<div class="gx-chips" role="group" aria-label="Show">${o.filters.map(f => `<button type="button" class="gx-chip${f.id === o.filter ? ' on' : ''}${f.tone ? ' ' + f.tone : ''}" data-gx-filter="${esc(f.id)}" aria-pressed="${f.id === o.filter}">${f.tone === 'amber' ? '<i aria-hidden="true"></i>' : ''}${esc(f.label)}<small>${count(f.n)}</small></button>`).join('')}</div>`
        : '';
    const sorts = SORTS[o.e] || [];
    return `<div class="gx-strip">
<button class="btn primary" type="button" id="add">${plus}Add ${esc(o.label)}</button>${o.e === 'drivers' ? `<button class="btn" type="button" data-gx-import>${upload}Import a club list</button>` : ''}${o.e === 'tracks' ? '<button class="btn" type="button" id="track-import">Import from Circuit</button>' : ''}
<form class="gx-search" data-catalogue-search role="search"><label>${search}<span class="hs-vh">Find ${esc(o.plural)}</span><input name="search" type="search" maxlength="200" value="${esc(o.search || '')}" placeholder="${esc(o.placeholder || 'Find ' + o.plural)}" aria-label="Find ${esc(o.plural)}"></label></form>
${chips}${sorts.length > 1 ? `<label class="gx-sort">${ic('<path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4"/>')}<span>Sort</span><select data-gx-sort aria-label="Sort">${sorts.map(([k, l]) => `<option value="${k}"${k === o.sort ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>` : ''}
<span class="gx-gear" role="group" aria-label="View"><button type="button" class="${o.mode === 'grid' ? 'on' : ''}" id="vgrid" aria-pressed="${o.mode === 'grid'}" title="Cards">${grid}<span class="hs-vh">Cards</span></button><button type="button" class="${o.mode === 'list' ? 'on' : ''}" id="vlist" aria-pressed="${o.mode === 'list'}" title="List">${list}<span class="hs-vh">List</span></button></span>
<button class="btn ghost icon gx-more" type="button" data-gx-page-more aria-haspopup="menu" aria-label="More: extra fields, view settings, refresh" title="More">${ICON.more}</button></div>`;
  }
  // the bar over the list when some are chosen: how many, and what can be done with all of them
  function bulkHtml(e, n, o = {}) {
    if (!n) return '';
    const acts =
      e === 'slotcars'
        ? [['class', 'Set class…'], ['service', 'Mark serviced'], o.direct ? ['archive', 'Archive'] : ['delete', 'Delete…']]
        : e === 'drivers'
          ? [
              ['retire', 'Retire'],
              ['unretire', 'Back to racing'],
              ['delete', 'Delete…']
            ]
          : [['delete', 'Delete…']];
    return `<div class="gx-bulk" role="region" aria-label="Chosen"><b>${n} chosen</b><span class="sp"></span>${acts.map(([k, l]) => `<button type="button" class="btn sm" data-bulk="${k}">${esc(l)}</button>`).join('')}<button type="button" class="btn sm ghost" data-bulk="clear">Clear</button></div>`;
  }
  // a menu of a card or of the page: [{ act, label, danger, disabled, note }]
  function menuHtml(items, label = 'More') {
    return `<div class="gx-menu" role="menu" aria-label="${esc(label)}">${items
      .map(m =>
        m === '-'
          ? '<hr>'
          : `<button type="button" role="menuitem" class="${m.danger ? 'danger' : ''}" data-act="${esc(m.act)}"${m.disabled ? ' disabled' : ''}${m.note ? ` title="${esc(m.note)}"` : ''}>${esc(m.label)}${m.note && m.disabled ? `<small>${esc(m.note)}</small>` : ''}</button>`
      )
      .join('')}</div>`;
  }
  // ---- the gearing of a car, worked out ----
  // pinion and crown teeth (or "12:36" typed as gearing), the rear tyre in mm, the motor's rpm, the scale: the ratio, the distance of one motor turn, the speed in theory
  function gearing(v = {}, scale = '') {
    let pinion = Number(v.pinion),
      crown = Number(v.gear);
    if (!(pinion > 0 && crown > 0)) {
      const m = /(\d+(?:\.\d+)?)\s*[:/x-]\s*(\d+(?:\.\d+)?)/i.exec(String(v.gearing || ''));
      if (m) {
        pinion = Number(m[1]);
        crown = Number(m[2]);
      }
    }
    if (!(pinion > 0 && crown > 0)) return null;
    if (pinion > crown) [pinion, crown] = [crown, pinion];
    const ratio = crown / pinion,
      tyre = Number(v.rearDiameter),
      rpm = Number(v.ratedRpm),
      per = tyre > 0 ? (Math.PI * tyre) / ratio : null,
      kmh = per && rpm > 0 ? (per * rpm * 60) / 1e6 : null,
      m = /^1\s*:\s*(\d+)$/.exec(String(scale).trim()),
      factor = m ? Number(m[1]) : 0;
    return {
      pinion,
      crown,
      ratio,
      ratioText: `${ratio.toFixed(2)} : 1`,
      per,
      perText: per ? `${per.toFixed(1)} mm` : '',
      kmh,
      kmhText: kmh ? `${Math.round(kmh)} km/h` : '',
      scaleText: kmh && factor ? `${count(Math.round(kmh * factor))} km/h at scale` : ''
    };
  }
  // ---- a club list read from a CSV file ----
  // the cells of each line (commas or semicolons, quotes as a spreadsheet writes them)
  function parseCsv(text) {
    const src = String(text || '').replace(/^﻿/, ''),
      first = src.split(/\r?\n/, 1)[0] || '',
      sep =
        (first.match(/;/g) || []).length > (first.match(/,/g) || []).length
          ? ';'
          : first.includes('\t') && !first.includes(',')
            ? '\t'
            : ',';
    const rows = [];
    let row = [],
      cell = '',
      q = false;
    for (let k = 0; k < src.length; k++) {
      const ch = src[k];
      if (q) {
        if (ch === '"' && src[k + 1] === '"') {
          cell += '"';
          k++;
        } else if (ch === '"') q = false;
        else cell += ch;
      } else if (ch === '"' && cell === '') q = true;
      else if (ch === sep) {
        row.push(cell);
        cell = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && src[k + 1] === '\n') k++;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else cell += ch;
    }
    if (cell !== '' || row.length) {
      row.push(cell);
      rows.push(row);
    }
    return rows.map(r => r.map(c => c.trim())).filter(r => r.some(c => c));
  }
  const HEADS = {
    name: /^(name|driver|full ?name|naam|driver name)$/i,
    first: /^(first ?name|given ?name|voornaam)$/i,
    last: /^(last ?name|surname|family ?name|achternaam)$/i,
    nickname: /^(nick ?name|nick|alias|bijnaam)$/i,
    callsign: /^(call ?sign|code|short|tag|abbr)$/i,
    flag: /^(country|flag|nation|land|nationality)$/i
  };
  // the drivers of a CSV: [{ name, nickname, callsign, flag }]; a name already in the database (or twice in the file) is skipped with its reason
  function roster(text, existing = [], countries = []) {
    const rows = parseCsv(text);
    if (!rows.length) return { drivers: [], skipped: [], columns: [] };
    const head = rows[0].map(h => Object.keys(HEADS).find(k => HEADS[k].test(h)) || '');
    const hasHead = head.some(Boolean);
    const cols = hasHead ? head : ['name', 'nickname', 'callsign', 'flag'];
    const body = hasHead ? rows.slice(1) : rows;
    const known = new Set(
        existing.map(d =>
          String(d.name || '')
            .trim()
            .toLowerCase()
        )
      ),
      seen = new Set();
    const codeOf = v => {
      const s = String(v || '').trim();
      if (!s) return '';
      if (/^[a-z]{2}$/i.test(s)) return s.toUpperCase();
      const hit = countries.find(([c, n]) => String(n).toLowerCase() === s.toLowerCase());
      return hit ? hit[0] : '';
    };
    const drivers = [],
      skipped = [];
    for (const r of body) {
      const v = {};
      cols.forEach((k, n) => {
        if (k && r[n] !== undefined && v[k] === undefined) v[k] = r[n];
      });
      const name = String(v.name || [v.first, v.last].filter(Boolean).join(' '))
        .trim()
        .slice(0, 80);
      if (!name) {
        skipped.push({ name: r.join(' '), why: 'no name' });
        continue;
      }
      const key = name.toLowerCase();
      if (known.has(key)) {
        skipped.push({ name, why: 'already in the database' });
        continue;
      }
      if (seen.has(key)) {
        skipped.push({ name, why: 'twice in the file' });
        continue;
      }
      seen.add(key);
      const d = { name };
      if (v.nickname) d.nickname = String(v.nickname).slice(0, 40);
      const cs = String(v.callsign || '')
        .replace(/[^a-z0-9]/gi, '')
        .slice(0, 3)
        .toUpperCase();
      if (cs) d.callsign = cs;
      const flag = codeOf(v.flag);
      if (flag) d.flag = flag;
      drivers.push(d);
    }
    return { drivers, skipped, columns: hasHead ? cols.filter(Boolean) : ['name', 'nickname', 'callsign', 'flag'] };
  }
  // two drivers that look like the same person: the same name, or one name that starts the other ("Anna" and "Anna A.")
  function lookAlikes(d, all) {
    const n = String(d.name || '')
      .trim()
      .toLowerCase()
      .replace(/\.$/, '');
    if (!n) return [];
    const first = n.split(/\s+/)[0];
    return all.filter(x => {
      if (x.id === d.id) return false;
      const m = String(x.name || '')
        .trim()
        .toLowerCase()
        .replace(/\.$/, '');
      return m === n || m.split(/\s+/)[0] === first;
    });
  }
  // the service log of a car: newest first, at most 50 lines
  function logAdd(log, entry) {
    const list = Array.isArray(log) ? log.filter(x => x && x.date) : [];
    return [
      { date: entry.date, note: String(entry.note || '').slice(0, 200), laps: Number.isFinite(entry.laps) ? entry.laps : null },
      ...list
    ].slice(0, 50);
  }
  const api = {
    LANES,
    AVAILABLE,
    SORTS,
    carColors,
    numberOf,
    carSvg,
    trackSvg,
    driverColor,
    helmetOf,
    statsOf,
    lap,
    day,
    short,
    canRace,
    filters,
    filterItems,
    sortItems,
    figures,
    badges,
    cardHtml,
    rowHead,
    rowHtml,
    summary,
    emptyHtml,
    menuHtml,
    stripHtml,
    bulkHtml,
    gearing,
    parseCsv,
    roster,
    lookAlikes,
    logAdd,
    ICON
  };
  root.Garage = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
