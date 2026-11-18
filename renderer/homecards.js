// The cards of the Home tab (1.17.0, a grid of them since 1.25.0): the words and the markup of every card except Start a race (that one is part of landing.js, because it
// is the form of the page). Pure: a card is made from figures that landing.js worked out with homestats.js, so it can be tested without a screen.
// (2.4.0: also laneOf { driverId: { lane, color } }, laneColor(i), now, glanceWeeks, lanes, form, h2h, champ, heats, milestones for the new cards)
// d = { fmtDate(iso), fmtShort(iso), trackName, rec, last, glance, recent, fastest, records, top, bests, rules, setupName, hasTrack, hasSetup, images }
// (1.28.0: mileage = [{ name, picture, laps, distance }] for Car Mileage; Notes needs nothing.)
// (1.34.0: service = [{ carId, name, picture, interval, since, left, over, due }], serviceTotal and serviceSet for Service Due; it needs no races, only cars.)
// (1.26.0: images = the pictures of the picture sets that the Weather and Tyres Available cards use: { weather, conditions, tyres }, each the images of a set or nothing.)
(function (root) {
  const G = typeof module !== 'undefined' ? require('./homegrid.js') : root.HomeGrid;
  const esc = s =>
    String(s === null || s === undefined ? '' : s).replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  // The pictures of the weather widgets (weatherwidgets.js) are used for the weather and the tyres: the drawn ones, or those of a picture set. Looked up when a card is made,
  // so a page that never shows these cards does not need that file.
  const wxw = () => (typeof module !== 'undefined' ? require('./weatherwidgets.js') : root.WxW),
    wx = () => (typeof module !== 'undefined' ? require('./weather.js') : root.Wx);
  const SAFE = /^(#[0-9a-f]{3,8}|(rgb|hsl)a?\([0-9 ,.%/]+\))$/i; // (a colour goes into a style: only plain colour text does)
  const tag = t => (t ? `<span class="hm-tag">${esc(t)}</span>` : '');
  const card = (cls, title, tagText, inner) => `<section class="card ${cls}"><h3>${esc(title)}${tag(tagText)}</h3>${inner}</section>`;
  const initials = name =>
    String(name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(word => (word.match(/[\p{L}\p{N}]/u) || [''])[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '•';

  // Nothing is raced yet: one friendly card instead of the cards that need races to show anything.
  const empty = () =>
    `<section class="card hm-empty"><h3>Your racing shows up here</h3><p class="muted">After the first race that is saved, this place shows the record to beat on your track, the podium of the last race and your totals.</p></section>`;

  const record = d => {
    const rec = d.rec;
    if (!rec) return card('hm-rec', 'Record to beat', '', '<p class="muted">This race setup has no track yet.</p>');
    return `<section class="card hm-rec"><h3>Record to beat<span class="hm-tag">${esc(d.trackName)}</span></h3>${
      rec.record
        ? `<div class="hm-rec-main"><div class="hm-time">${esc(rec.record.text)}</div><span class="hm-rec-label">track record</span></div><div class="hm-rec-holder"><span class="hm-rec-avatar" aria-hidden="true">${esc(initials(rec.record.driver))}</span><div><strong>${esc(rec.record.driver)}${rec.record.car ? ' · ' + esc(rec.record.car) : ''}</strong><small>${esc([d.fmtDate(rec.record.date), rec.record.setupName, rec.record.pendingLibrary ? 'not yet in the shared library' : ''].filter(Boolean).join(' · '))}</small></div></div>${rec.line ? `<p class="hm-rec-status"><i aria-hidden="true"></i>${esc(rec.line)}</p>` : ''}`
        : '<p class="muted">No lap has been saved on this track yet. The first lap sets the record.</p>'
    }</section>`;
  };
  // ---- 2.4.0: every card has an idea of its own (a result board, an odometer, a race log, a timing tower, a wall of tracks, a hall of fame, a race brief, a launch pad,
  // the sky, sidewalls, a race control board, odometers per car, a pit wall), and seven new cards. Drivers on the grid carry the colour of their lane (d.laneOf). ----
  const colorOf = c => (SAFE.test(String(c || '').trim()) ? String(c).trim() : '');
  const laneStyle = (d, driverId) => {
    const l = d.laneOf && driverId && d.laneOf[driverId];
    const c = l && colorOf(l.color);
    return c ? ` style="--c:${esc(c)}"` : '';
  };
  const secs = ms => (Number(ms) / 1000).toFixed(3);
  const foot = t => (t ? `<p class="hm-foot">${t}</p>` : '');
  // (small drawn pictures: this file is also used without a screen, where Icons is not there)
  const ICON = {
    flag: '<path d="M5 21V4M5 4h12l-2.5 4L17 12H5"/>',
    time: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M10 2h4"/>',
    fuel: '<path d="M4 20V5a1.5 1.5 0 0 1 1.5-1.5h7A1.5 1.5 0 0 1 14 5v15M3 20h12M14 9h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V8l-3-3"/>',
    pen: '<path d="M12 3 2.5 20h19zM12 9v5M12 17h.01"/>',
    dmg: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
    wx: '<path d="M7 16a4.5 4.5 0 1 1 1-8.9A6 6 0 0 1 19 9a3.5 3.5 0 0 1-1 6.9z"/>',
    bop: '<path d="M12 4v16M5 20h14M6 8h12M6 8l-3 6h6zM18 8l-3 6h6z"/>',
    tyre: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/>',
    sc: '<path d="M3 15l2-5h14l2 5v3H3zM7 18v2M17 18v2M9 6h6"/>',
    ps: '<path d="M4 17a8 8 0 1 1 16 0M12 17l4-6"/>',
    heats: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    team: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0M17 11a3 3 0 1 0 0-6M21 20a5 5 0 0 0-4-5"/>',
    dot: '<circle cx="12" cy="12" r="4"/>'
  };
  const icon = n => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[n] || ICON.dot}</svg>`;

  // Last race: a result board. The winner as a lower third, the others with what they drove, the fastest lap as a purple pill.
  const last = d => {
    const l = d.last;
    if (!l) return card('hm-last', 'Last race', '', '<p class="muted">No race has been saved yet.</p>');
    const [w, ...rest] = l.podium;
    const board = !l.podium.length
      ? `<p class="muted">${esc(l.emptyReason || 'No car finished a lap.')}</p>`
      : `<div class="hm-resw p${w.pos}"><span class="hm-respos">${w.pos}</span><span class="hm-resname"><strong>${esc(w.name)}</strong>${w.car ? `<small>${esc(w.car)}</small>` : ''}</span><span class="hm-resv">${esc(w.detail)}</span></div>` +
        rest
          .map(
            p =>
              `<div class="hm-resr p${p.pos}"><span class="hm-respos">${p.pos}</span><span class="hm-resname"><strong>${esc(p.name)}</strong>${p.car ? `<small>${esc(p.car)}</small>` : ''}</span><span class="hm-resv">${esc(p.detail)}</span></div>`
          )
          .join('');
    return `<section class="card hm-last"><h3>${esc(l.label)}<span class="hm-tag">${esc(d.fmtDate(l.date))}</span></h3>${board}${
      l.fastest
        ? `<p class="hm-fl"><i aria-hidden="true"></i>Fastest lap <b>${esc(l.fastest.text)}</b>${l.fastest.driver ? ' ' + esc(l.fastest.driver) : ''}</p>`
        : ''
    }${foot(esc(l.setupName) + (l.trackName ? ' on ' + esc(l.trackName) : ''))}</section>`;
  };

  // At a glance: an odometer. Rolling digits for the races and the laps, the distance and the driver with the most wins beside them, and a bar for the races of every week.
  const digits = n => {
    const t = String(Math.max(0, Math.floor(Number(n) || 0)));
    return t.length <= 6
      ? `<span class="hm-odo">${t
          .padStart(Math.min(6, Math.max(3, t.length)), '0')
          .split('')
          .map(c => `<i>${c}</i>`)
          .join('')}</span>`
      : `<b class="hm-odobig">${esc(Number(n).toLocaleString('en-US'))}</b>`;
  };
  const glance = d => {
    const g = d.glance,
      weeks = Array.isArray(d.glanceWeeks) ? d.glanceWeeks : [],
      max = Math.max(1, ...weeks);
    return `<section class="card hm-glance"><h3>At a glance<span class="hm-tag">all time</span></h3><div class="hm-tiles">
      <div class="hm-tile">${digits(g.races)}<div class="l">${g.races === 1 ? 'race' : 'races'} raced</div></div>
      <div class="hm-tile">${digits(g.laps)}<div class="l">${g.laps === 1 ? 'lap' : 'laps'} driven</div></div>
      <div class="hm-tile"><div class="v">${g.distance === null ? '–' : esc(d.fmtDist(g.distance))}</div><div class="l">distance</div></div>
      <div class="hm-tile"><div class="v">${g.wins ? esc(g.wins.name) : '–'}</div><div class="l">${g.wins ? `most wins (${g.wins.count})` : 'most wins'}</div></div></div>${
        weeks.length && weeks.some(Boolean)
          ? `<div class="hm-spark" role="img" aria-label="Races a week, the last ${weeks.length} weeks: ${weeks.join(', ')}">${weeks.map(v => `<i style="height:${Math.max(4, Math.round((v / max) * 100))}%"${v ? '' : ' class="z"'}></i>`).join('')}</div><div class="hm-sparkcap"><span>${weeks.length} weeks ago</span><span>races a week</span><span>this week</span></div>`
          : ''
      }</section>`;
  };

  // Recent races: a race log. A timeline with a stop for every race in the colour of its kind, the result under the name.
  const recent = d =>
    card(
      'hm-recent',
      'Recent races',
      d.recent.length ? 'last ' + d.recent.length : '',
      d.recent.length
        ? `<ul class="hm-list hm-log">${d.recent.map(r => `<li class="k-${esc(r.type || 'race')}"><button type="button" class="hm-row" data-session="${esc(r.id)}" title="Open the results of this race"><span class="n">${esc(r.name)}${r.kind && r.kind !== r.name ? `<em>${esc(r.kind)}</em>` : ''}</span><span class="d">${esc(d.fmtShort(r.date))}</span><span class="r">${esc(r.result)}</span></button></li>`).join('')}</ul>`
        : '<p class="muted">No race has been saved yet.</p>'
    );

  // Fastest laps this week: a timing tower. Position, the colour of the driver's lane (when he is on the grid), the time and the gap; the fastest in purple.
  const fastest = d => {
    const f = d.fastest,
      all = d.fastestScope === 'all',
      rows = f.tracks;
    const body = !rows.length
      ? `<p class="muted">${all ? 'No lap has been driven this week yet.' : `No lap has been driven on ${esc(d.trackName || 'this track')} this week yet.`}</p>`
      : rows
          .map(
            t =>
              `${all ? `<h4 class="hm-h4">${esc(t.trackName)}</h4>` : ''}<ol class="hm-rank hm-tower">${t.rows
                .map(
                  (r, i) =>
                    `<li${laneStyle(d, r.driverId)}><span class="n">${i + 1}</span><i class="hm-stripe" aria-hidden="true"></i><span class="w">${esc(r.driver)}</span><strong${i ? '' : ' class="pb"'}>${esc(r.text)}</strong><span class="g">${i && Number.isFinite(r.time) && Number.isFinite(t.rows[0].time) ? '+' + secs(r.time - t.rows[0].time) : ''}</span></li>`
                )
                .join('')}</ol>`
          )
          .join('');
    return card('hm-fastest', 'Fastest laps this week', all ? 'all tracks' : d.trackName, body);
  };

  // Records on all tracks: a wall of tiles, the track of the race setup with a red edge.
  const records = d =>
    card(
      'hm-records',
      'Records on all tracks',
      d.records.length ? `${d.records.length} ${d.records.length === 1 ? 'track' : 'tracks'}` : '',
      d.records.length
        ? `<div class="hm-wall">${d.records
            .map(
              r =>
                `<div class="hm-recrow2${r.trackName === d.trackName && d.trackName ? ' here' : ''}"><span class="who"><strong>${esc(r.trackName)}</strong><b class="hm-time sm">${esc(r.text)}</b><small>${esc([r.driver, r.car].filter(Boolean).join(' · '))}</small><small class="dt">${esc(d.fmtDate(r.date))}</small></span></div>`
            )
            .join('')}</div>`
        : '<p class="muted">No lap has been saved yet.</p>'
    );

  // Top drivers: a hall of fame. The leader as a gold banner with the number of wins, the others as bars.
  const top = d => {
    const year = d.topPeriod !== 'all',
      list = d.top,
      max = list.length ? list[0].count : 1;
    if (!list.length)
      return card(
        'hm-top',
        'Top drivers',
        year ? 'wins this year' : 'wins, all time',
        `<p class="muted">${year ? 'Nobody has won a race this year yet.' : 'Nobody has won a race yet.'}</p>`
      );
    const [first, ...rest] = list;
    return card(
      'hm-top',
      'Top drivers',
      year ? 'wins this year' : 'wins, all time',
      `<div class="hm-fame"><span class="hm-rec-avatar" aria-hidden="true">${esc(initials(first.name))}</span><strong>${esc(first.name)}</strong><span class="hm-famen"><b>${first.count}</b><small>${first.count === 1 ? 'win' : 'wins'}</small></span></div>` +
        rest
          .map(
            (w, i) =>
              `<div class="hm-bar"><span class="p">${i + 2}</span><span class="w">${esc(w.name)}</span><span class="b"><i style="width:${Math.max(4, Math.round((w.count / max) * 100))}%"></i></span><b>${w.count}</b></div>`
          )
          .join('')
    );
  };

  const bests = d =>
    card(
      'hm-bests',
      'Personal Bests for Drivers on the Grid',
      d.trackName,
      !d.hasTrack
        ? '<p class="muted">This race setup has no track yet.</p>'
        : !d.bests.length
          ? '<p class="muted">Choose the drivers for the lanes to see their personal bests here.</p>'
          : (() => {
              // (2.4.0) a timing tower: the drivers in order of pace (a driver with no lap yet last), the fastest of the grid in purple, the others with their gap
              const ok = b => b.time !== null && Number.isFinite(b.time) && b.time > 0,
                order = d.bests
                  .map((b, i) => ({ b, i }))
                  .sort((x, y) => (ok(x.b) ? (ok(y.b) ? x.b.time - y.b.time : -1) : ok(y.b) ? 1 : x.i - y.i)),
                best = order.length && ok(order[0].b) ? order[0].b.time : null,
                rec = d.rec && d.rec.record;
              let pos = 0;
              return (
                (rec
                  ? `<div class="hm-pbrec"><i aria-hidden="true"></i>Track record <b>${esc(rec.text)}</b>${rec.driver ? ' · ' + esc(rec.driver) : ''}</div>`
                  : '') +
                `<div class="hm-pblist">${order
                  .map(({ b }) => {
                    const has = ok(b) && best !== null,
                      c = SAFE.test(String(b.color).trim()) ? '--c:' + esc(String(b.color).trim()) : '';
                    if (has) pos++;
                    const chip = !has
                      ? '<span class="hm-pbchip none">no lap</span>'
                      : b.time === best
                        ? '<span class="hm-pbchip best">fastest</span>'
                        : `<span class="hm-pbchip down">+${((b.time - best) / 1000).toFixed(3)}</span>`;
                    return `<div class="hm-kv"><span class="hm-pbpos">${has ? pos : '–'}</span><span class="who"><i class="hm-dot" style="${c}"></i>${esc(b.name)}</span><strong${b.time === null ? ' class="muted"' : ''}>${esc(b.text)}</strong>${chip}</div>`;
                  })
                  .join('')}</div>`
              );
            })()
    );

  // Rules of this race: a race brief. A tile per rule in its own colour, with the one value that matters; a system that is off fades.
  const BRIEF = {
    Race: ['flag', '#e5484d'],
    Length: ['time', '#e8e6e1'],
    Finals: ['flag', '#f5c211'],
    Penalties: ['pen', '#f5c211'],
    Damage: ['dmg', '#ff7a3d'],
    Fuel: ['fuel', '#3ecf8e'],
    Weather: ['wx', '#3b82f6'],
    'Balance of Power': ['bop', '#22c5d6'],
    'Tyre wear': ['tyre', '#a46bff'],
    'Safety car': ['sc', '#ff7a3d'],
    'Push and save': ['ps', '#a3e635']
  };
  const rules = d =>
    card(
      'hm-rules',
      'Rules of this race',
      d.setupName,
      !d.hasSetup
        ? '<p class="muted">Create a race setup in the Race Setup tab to see its rules here.</p>'
        : `<div class="hm-brief">${d.rules
            .map(([k, v]) => {
              const [ic, c] = BRIEF[k] || [/heat/i.test(k) ? 'heats' : /team|driver/i.test(k) ? 'team' : 'dot', '#98a0ab'];
              return `<div class="hm-kv hm-bi${v === 'Off' ? ' off' : ''}" style="--c:${c}"><span class="hm-bic">${icon(ic)}</span><span class="muted">${esc(k)}</span><strong>${esc(v)}</strong></div>`;
            })
            .join('')}</div>`
    );

  // Shortcuts: a launch pad. Tiles with a picture, the first one twice as wide.
  const GO_ICON = {
    results: 'flag',
    drivers: 'team',
    slotcars: 'sc',
    tracks: 'ps',
    teams: 'team',
    setup: 'flag',
    custom: 'wx',
    settings: 'dot',
    rules: 'pen',
    live: 'time',
    help: 'dot'
  };
  const shortcuts = (d, board) => {
    const list = G.shortcutsOf(board);
    return card(
      'hm-shortcuts',
      'Shortcuts',
      '',
      list.length
        ? `<div class="hm-go2">${list.map((s, i) => `<button type="button" class="btn${i ? '' : ' main'}" data-go="${esc(s.key)}">${icon(GO_ICON[s.key] || 'dot')}<span>${esc(s.label)}</span></button>`).join('')}</div>`
        : '<p class="muted">No shortcut is switched on. Open Customize and tick the pages you want here.</p>'
    );
  };

  // 1.26.0 Weather (2.4.0: the sky itself): the card takes the colour of the weather, the air temperature big, the conditions as tiles. Nothing is read from a race.
  const weather = (d, board) => {
    const W = wxw(),
      X = wx(),
      o = k => G.optionOf(board, k),
      img = d.images || {},
      state = o('state');
    const c = { units: o('units'), state, track: o('track'), air: o('air'), wind: o('wind'), dir: o('dir') },
      tx = X.condText(c),
      line = o('line');
    const tiles = [
      [o('showTrack'), 'tracktemp', tx.track, 'Track'],
      [o('showAir'), 'airtemp', tx.air, 'Air'],
      [o('showWind'), 'windspeed', tx.wind, 'Wind'],
      [o('showDir'), 'winddir', o('showDegrees') ? `${tx.dir} ${tx.degrees}` : tx.dir, 'From']
    ]
      .filter(t => t[0])
      .map(
        ([, kind, text, label]) =>
          `<div class="hm-ctile">${W.icon('cond', kind, img.conditions, c.dir, false)}<div><b>${esc(text)}</b><small>${label}</small></div></div>`
      )
      .join('');
    return `<section class="card hm-weather hm-wx-${esc(String(state).replace(/[^a-z]/gi, ''))}"><h3>Weather</h3><div class="hm-sky">${W.icon('state', state, img.weather, 0, false)}<div>${o('showAir') ? `<span class="hm-skyt">${esc(tx.air)}</span>` : ''}<strong>${esc(X.stateName(state))}</strong>${line ? `<small>${esc(line)}</small>` : ''}</div></div>${tiles ? `<div class="hm-ctiles cd-${esc(o('layout'))}">${tiles}</div>` : ''}</section>`;
  };

  // 1.26.0 Tyres Available (2.4.0: sidewalls): every tyre on a dark ring, its name, and the sets as small blocks (a number past eight sets)
  const tyres = (d, board) => {
    const W = wxw(),
      list = G.tyresOf(board),
      count = G.optionOf(board, 'showCount'),
      img = d.images || {};
    const pips = n =>
      n > 8 || n < 1
        ? `<strong class="c">× ${n}</strong>`
        : `<span class="hm-pips" aria-label="${n} ${n === 1 ? 'set' : 'sets'}">${'<i></i>'.repeat(n)}</span>`;
    return card(
      'hm-tyrecard',
      'Tyres Available',
      '',
      list.length
        ? `<ul class="hm-tyres hm-ty-${esc(G.optionOf(board, 'layout'))}">${list.map(t => `<li><span class="hm-wall2">${W.icon('tyre', t.code, img.tyres, 0, false)}</span><span class="n">${esc(t.name)}</span>${count ? pips(t.count) : ''}</li>`).join('')}</ul>`
        : '<p class="muted">No tyre is ticked. Open Customize and tick the tyres you want here.</p>'
    );
  };

  // 1.28.0 Notes (2.4.0: a race control board): more than one line becomes numbered points; one line stays as it was typed
  const notes = (d, board) => {
    const o = k => G.optionOf(board, k),
      text = o('text'),
      title = o('showTitle') ? o('title') || 'Notes' : '';
    const lines = String(text || '')
      .split('\n')
      .map(x => x.trim())
      .filter(Boolean);
    const body = !text
      ? '<p class="muted">No notes yet. Open Customize and type them here.</p>'
      : lines.length > 1
        ? `<ol class="hm-ntext hm-points">${lines.map(x => `<li>${esc(x)}</li>`).join('')}</ol>`
        : `<div class="hm-ntext">${esc(text)}</div>`;
    return `<section class="card hm-notes hm-n-${esc(o('size'))}"><i class="hm-tape" aria-hidden="true"></i>${title ? `<h3>${esc(title)}</h3>` : ''}${body}</section>`;
  };

  // 1.28.0 Car Mileage: the slotcars with the most laps (d.mileage, the cars that are shown), the laps and the distance, a bar and the picture of the car, as the settings of the card say
  const PIC = /^data:image\//i; // (only a picture that is in the file itself goes into the page)
  const mileage = (d, board) => {
    const o = k => G.optionOf(board, k),
      show = o('show'),
      list = d.mileage || [],
      year = o('period') === 'year',
      byDist = show === 'distance';
    const val = r => (byDist ? r.distance || 0 : r.laps),
      max = Math.max(1, ...list.map(val)),
      pics = o('pics') && list.some(r => PIC.test(String(r.picture || '')));
    const rows = list
      .map(r => {
        const laps = `${r.laps.toLocaleString('en-US')} ${r.laps === 1 ? 'lap' : 'laps'}`,
          dist = r.distance === null || r.distance === undefined ? null : d.fmtDist(r.distance);
        const v =
          show === 'laps'
            ? `<strong>${esc(laps)}</strong>`
            : byDist
              ? `<strong>${esc(dist === null ? '–' : dist)}</strong>`
              : `<strong>${esc(laps)}</strong>${dist === null ? '' : ` · <span class="muted">${esc(dist)}</span>`}`;
        return `<div class="hm-mrow">${pics ? (PIC.test(String(r.picture || '')) ? `<img class="hm-carpic" src="${esc(r.picture)}" alt="">` : '<span class="hm-carpic"></span>') : ''}<div class="mm"><div class="mt"><span class="mn">${esc(r.name)}</span><span class="mv">${v}</span></div>${o('bars') ? `<div class="hm-mbar"><i style="width:${Math.max(4, Math.round((val(r) / max) * 100))}%"></i></div>` : ''}</div></div>`;
      })
      .join('');
    return card(
      'hm-mileage',
      'Car Mileage',
      year ? 'this year' : 'all time',
      rows || `<p class="muted">${year ? 'No lap has been driven with a car this year yet.' : 'No lap has been saved with a car yet.'}</p>`
    );
  };

  // 1.34.0 Service Due: the slotcars that need servicing, or soon will (d.service = [{ carId, name, picture, interval, since, left, over, due }], the cars that are shown, from CarStats.dueList;
  // d.serviceTotal = how many cars there are before the list was cut, d.serviceSet = how many cars have a service interval). With a bar or a picture a car is a row like Car Mileage has;
  // with neither it is one line with a dot. A click on a car opens its card (data-car).
  // (2.4.0) the gauge of a car on the pit wall: the laps since the service against the interval; red past it
  const gauge = (r, cls) => {
    const p = Math.max(0.02, Math.min(1, r.since / Math.max(1, r.interval))),
      pct = Math.round((r.since / Math.max(1, r.interval)) * 100);
    return `<svg class="hm-svg ${cls}" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="26" fill="none" stroke="var(--line)" stroke-width="7"/><circle class="arc" cx="32" cy="32" r="26" fill="none" stroke-width="7" stroke-linecap="round" stroke-dasharray="${(163.4 * p).toFixed(1)} 163.4" transform="rotate(-90 32 32)"/><text x="32" y="37" text-anchor="middle">${pct}%</text></svg>`;
  };
  const lapsText = n => `${Number(n).toLocaleString('en-US')} ${Number(n) === 1 ? 'lap' : 'laps'}`;
  const service = (d, board) => {
    const o = k => G.optionOf(board, k),
      list = d.service || [],
      total = Math.max(list.length, Number(d.serviceTotal) || 0),
      dueOnly = o('show') === 'due';
    if (!list.length) {
      return card(
        'hm-svc',
        'Service Due',
        Number(d.serviceSet) > 0 ? 'all good' : '',
        `<p class="muted">${
          Number(d.serviceSet) > 0
            ? `No car needs servicing. A car shows here when ${dueOnly ? 'it has reached its service interval' : `it is within ${esc(o('within'))}% of its service interval, or past it`}.`
            : 'No slotcar has a service interval yet. Set one in Database > Slotcars, in the Statistics folder of a car.'
        }</p>`
      );
    }
    const rich = o('bars') || o('pics'),
      pics = o('pics') && list.some(r => PIC.test(String(r.picture || '')));
    const status = r => (r.due ? 'Service due' : `${lapsText(r.left)} to go`);
    const short = r => (r.due ? (r.over > 0 ? `${lapsText(r.over)} over` : 'due now') : `${lapsText(r.left)} to go`);
    const rows = list
      .map(r => {
        const cls = r.due ? 'due' : 'soon',
          go = `type="button" data-car="${esc(r.carId)}" title="Open the card of this car"`;
        if (!rich)
          return `<button class="hm-kv hm-carbtn" ${go}><span class="who"><i class="sv-dot ${cls}"></i>${esc(r.name)}</span><strong class="sv-st ${cls}">${esc(short(r))}</strong></button>`;
        const more = `${Number(r.since).toLocaleString('en-US')} of ${lapsText(r.interval)}${r.due ? (r.over > 0 ? ` · ${r.over.toLocaleString('en-US')} over` : ' · due now') : ''}`;
        return `<button class="hm-mrow hm-carbtn" ${go}>${pics ? (PIC.test(String(r.picture || '')) ? `<img class="hm-carpic" src="${esc(r.picture)}" alt="">` : '<span class="hm-carpic"></span>') : ''}<span class="mm"><span class="mt"><span class="mn">${esc(r.name)}</span><span class="mv"><strong class="sv-st ${cls}">${esc(status(r))}</strong><small>${esc(more)}</small></span></span>${o('bars') ? `<span class="hm-mbar sv-bar"><i class="${cls}" style="width:${Math.max(4, Math.min(100, Math.round((r.since / r.interval) * 100)))}%"></i></span>${gauge(r, cls)}` : ''}</span></button>`;
      })
      .join('');
    return card(
      'hm-svc',
      'Service Due',
      total > list.length ? `${list.length} of ${total} cars` : `${total} ${total === 1 ? 'car' : 'cars'}`,
      rows
    );
  };

  // ---- 2.4.0: the new cards ----
  const laneHue = (d, i) => colorOf(typeof d.laneColor === 'function' ? d.laneColor(i) : '') || '#98a0ab';
  const laneChip = (d, i) => `<span class="hm-lane" style="--c:${esc(laneHue(d, i))}">${i + 1}</span>`;

  // Lane balance: the best lap of every lane as a bar in its colour (the fastest the longest: a bar loses its length with every per cent it is slower)
  const lanes = d => {
    const list = d.lanes || [];
    if (!d.hasTrack) return card('hm-lanes', 'Lane balance', '', '<p class="muted">This race setup has no track yet.</p>');
    if (!list.length)
      return card(
        'hm-lanes',
        'Lane balance',
        d.trackName,
        `<p class="muted">No lap has been driven on ${esc(d.trackName || 'this track')} yet.</p>`
      );
    const best = Math.min(...list.map(r => r.time)),
      worst = Math.max(...list.map(r => r.time)),
      fast = list.find(r => r.time === best);
    const rows = list
      .map(r => {
        const w = Math.max(10, Math.round(100 - ((r.time - best) / best) * 100 * 4));
        return `<div class="hm-lbrow">${laneChip(d, r.lane - 1)}<span class="hm-lbbar"><i style="--c:${esc(laneHue(d, r.lane - 1))};width:${w}%"></i></span><strong${r.time === best ? ' class="pb"' : ''}>${esc(r.text)}</strong></div>`;
      })
      .join('');
    const laps = list.reduce((a, r) => a + r.laps, 0);
    return card(
      'hm-lanes',
      'Lane balance',
      `${list.length} ${list.length === 1 ? 'lane' : 'lanes'} · ${d.trackName}`,
      `<div class="hm-lb${list.length > 4 ? ' tight' : ''}">${rows}</div><p class="hm-lbsum"><span>Fastest lane <b>${fast.lane}</b></span><span>Spread <b>${secs(worst - best)} s</b></span><span>Laps <b>${esc(laps.toLocaleString('en-US'))}</b></span></p>`
    );
  };

  // Grid form: the drivers in the lanes, the places of their last races as squares in podium colours; a few drivers: the last ten and a line about their form
  const placeSq = p => `<i class="${p === 'dq' ? 'dq' : p <= 3 ? 'p' + p : ''}">${p === 'dq' ? 'DQ' : p}</i>`;
  const formLine = f => {
    const p = f.places.filter(x => x !== 'dq');
    if (!f.races) return 'No race yet';
    const w4 = f.places.slice(0, 4).filter(x => x === 1).length;
    if (w4 >= 2) return `Won ${w4} of the last ${Math.min(4, f.places.length)}`;
    if (p.length >= 3 && p.slice(0, 5).every(x => x <= 3)) return `On the podium in each of the last ${Math.min(5, p.length)}`;
    if (f.places[0] === 1) return 'Won the last race';
    return `${f.races} ${f.races === 1 ? 'race' : 'races'} · ${f.wins} ${f.wins === 1 ? 'win' : 'wins'}`;
  };
  const form = d => {
    const list = (d.form || []).filter(f => f.name);
    if (!list.length)
      return card('hm-form', 'Grid form', '', '<p class="muted">Choose the drivers for the lanes to see their form here.</p>');
    const big = list.length <= 4;
    return card(
      'hm-form',
      'Grid form',
      big ? 'last 10 races' : 'last 5 races',
      `<div class="hm-gf${big ? ' big' : ' tight'}">${list
        .map(f => {
          const lane = d.laneOf && d.laneOf[f.driverId];
          return `<div class="hm-gfrow">${lane ? laneChip(d, lane.lane - 1) : '<span class="hm-lane"></span>'}<span class="nm"><strong>${esc(f.name)}</strong>${big ? `<small>${esc(formLine(f))}</small>` : ''}</span><span class="fm">${(big ? f.places : f.places.slice(0, 5)).map(placeSq).join('') || '<small class="muted">no race yet</small>'}</span></div>`;
        })
        .join('')}</div>`
    );
  };

  // Head to head: two drivers in the lanes face off; more drivers make a table of who finished ahead of whom
  const h2h = d => {
    const h = d.h2h,
      k = h ? h.ids.length : 0;
    if (k < 2) return card('hm-h2h', 'Head to head', '', '<p class="muted">Put two or more drivers in the lanes to compare them here.</p>');
    const col = i => {
      const l = d.laneOf && d.laneOf[h.ids[i]];
      return l ? laneHue(d, l.lane - 1) : '#98a0ab';
    };
    if (k === 2) {
      const a = h.wins[0][1],
        b = h.wins[1][0],
        met = h.met[0][1],
        share = a + b ? Math.round((a / (a + b)) * 100) : 50;
      const side = i =>
        `<div class="hm-h2hs"><span class="hm-rec-avatar" style="--c:${esc(col(i))}" aria-hidden="true">${esc(initials(h.names[i]))}</span><strong>${esc(h.names[i])}</strong></div>`;
      return card(
        'hm-h2h',
        'Head to head',
        `${met} ${met === 1 ? 'race' : 'races'} together`,
        met
          ? `<div class="hm-h2hv">${side(0)}<div class="hm-h2hsc">${a}<span>–</span>${b}</div>${side(1)}</div><div class="hm-h2hbar"><i style="width:${share}%;background:${esc(col(0))}"></i><i style="width:${100 - share}%;background:${esc(col(1))}"></i></div><p class="hm-h2hf"><span>Best lap <b>${h.best[0] ? esc(secs(h.best[0])) : '–'}</b></span><span>Last met <b>${esc(d.fmtShort(h.last[0][1]))}</b></span><span>Best lap <b>${h.best[1] ? esc(secs(h.best[1])) : '–'}</b></span></p>`
          : `<div class="hm-h2hv">${side(0)}<div class="hm-h2hsc">0<span>–</span>0</div>${side(1)}</div><p class="muted">They have not raced each other yet.</p>`
      );
    }
    const head = h.ids.map((_, i) => `<th style="color:${esc(col(i))}">${esc(initials(h.names[i]))}</th>`).join('');
    const body = h.ids
      .map(
        (_, r) =>
          `<tr><th class="r"><i style="background:${esc(col(r))}"></i>${esc(h.names[r])}</th>${h.ids
            .map((__, c) => {
              if (r === c) return '<td class="x"></td>';
              const w = h.wins[r][c],
                l = h.wins[c][r];
              if (!h.met[r][c]) return '<td class="n">·</td>';
              return `<td class="${w > l ? 'w' : w < l ? 'l' : 'e'}">${w}–${l}</td>`;
            })
            .join('')}</tr>`
      )
      .join('');
    return card(
      'hm-h2h',
      'Rivalry',
      `${k} drivers on the grid`,
      `<table class="hm-mx"><tr><th></th>${head}</tr>${body}</table>${foot('Wins of the row against the column')}`
    );
  };

  // Championship: the top of the standings with the gap, the rounds as a strip, and the next round
  const champ = (d, board) => {
    const x = d.champ;
    if (!x || !x.c)
      return card('hm-champ', 'Championship', '', '<p class="muted">No championship yet. Make one in Race Setup › Championships.</p>');
    const n = Math.max(1, Number(G.optionOf(board, 'count')) || 5),
      rows = ((x.st && x.st.drivers) || []).slice(0, n),
      lead = rows.length ? Number(rows[0].total) || 0 : 0,
      rounds = (x.p && x.p.rounds) || [],
      done = rounds.filter(r => r.state === 'done').length;
    const strip = rounds.length
      ? `<p class="hm-chhead"><span>${done} of ${rounds.length} ${rounds.length === 1 ? 'round' : 'rounds'}</span><span class="hm-chstrip">${rounds.map(r => `<i class="${esc(r.state)}"></i>`).join('')}</span></p>`
      : '';
    const table = rows.length
      ? rows
          .map(
            (r, i) =>
              `<div class="hm-chrow"${laneStyle(d, r.id)}><span class="p">${esc(r.pos || i + 1)}</span><i class="hm-stripe" aria-hidden="true"></i><strong>${esc(r.name)}</strong><b>${esc(r.total)}</b><span class="g">${i ? '−' + esc(lead - (Number(r.total) || 0)) : ''}</span></div>`
          )
          .join('')
      : '<p class="muted">No round has been driven yet.</p>';
    const next = x.next
      ? `<p class="hm-chnext">Next: <b>${esc(x.next.label)}</b>${x.next.track ? ' · ' + esc(x.next.track) : ''}${x.next.date ? ' · ' + esc(d.fmtShort(x.next.date)) : ''}</p>`
      : x.p && x.p.complete
        ? '<p class="hm-chnext"><b>Finished</b></p>'
        : '';
    return card('hm-champ', 'Championship', x.c.name || '', strip + table + next);
  };

  // Heat standings: the overall standings of the last heat-based race
  const heats = (d, board) => {
    const h = d.heats;
    if (!h || !h.rows.length) return card('hm-heats', 'Heat standings', '', '<p class="muted">No heat-based race has been saved yet.</p>');
    const n = Math.max(1, Number(G.optionOf(board, 'count')) || 8),
      rows = h.rows.slice(0, n),
      best = Math.min(...rows.map(r => r.best || Infinity));
    return card(
      'hm-heats',
      'Heat standings',
      [h.setupName, d.fmtShort(h.date)].filter(Boolean).join(' · '),
      `<div class="hm-hs">${rows
        .map(
          r =>
            `<div class="hm-hsrow${r.dq ? ' dq' : ''}${r.pos && r.pos <= 3 && !r.dq ? ' p' + r.pos : ''}"${laneStyle(d, r.driverId)}><span class="p">${r.dq ? 'DQ' : esc(r.pos || '–')}</span><i class="hm-stripe" aria-hidden="true"></i><span class="nm"><strong>${esc(r.name)}</strong>${r.car ? `<small>${esc(r.car)}</small>` : ''}</span><b>${h.byPoints && r.points !== null ? esc(r.points) + '<small> pts</small>' : esc(r.laps) + '<small> laps</small>'}</b><span class="t${r.best === best ? ' pb' : ''}">${esc(r.bestText)}</span></div>`
        )
        .join('')}</div>${h.trackName ? foot(esc(h.trackName)) : ''}`
    );
  };

  // Countdown: the days, hours and minutes to an event you type; at zero it says so for twelve hours
  const countdown = (d, board) => {
    const o = k => G.optionOf(board, k),
      when = String(o('when') || ''),
      m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(when),
      title = o('title') || 'Club night',
      where = o('where');
    if (!m)
      return card(
        'hm-count',
        'Countdown',
        '',
        `<p class="hm-cdwhat">${esc(title)}</p><p class="muted">Open Customize and set when it is.</p>`
      );
    const at = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]),
      now = d.now instanceof Date ? d.now : new Date(),
      left = at.getTime() - now.getTime(),
      dateText = at.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) + ' · ' + m[4] + ':' + m[5];
    const sub = `<p class="hm-cdwhen">${esc(dateText)}${where ? ' · ' + esc(where) : ''}</p>`;
    if (left <= 0)
      return card(
        'hm-count',
        'Countdown',
        '',
        `<p class="hm-cdwhat">${esc(title)}</p>${sub}<p class="hm-cdnow">${esc(left > -12 * 36e5 ? o('done') || 'Race night!' : 'Set the next one in Customize')}</p>`
      );
    const days = Math.floor(left / 864e5),
      hours = Math.floor((left % 864e5) / 36e5),
      mins = Math.floor((left % 36e5) / 6e4);
    const cell = (v, l) => `<div><b>${String(v).padStart(2, '0')}</b><span>${l}</span></div>`;
    return card(
      'hm-count',
      'Countdown',
      '',
      `<p class="hm-cdwhat">${esc(title)}</p>${sub}<div class="hm-cd">${cell(days, days === 1 ? 'day' : 'days')}${cell(hours, hours === 1 ? 'hour' : 'hours')}${cell(mins, 'min')}</div>`
    );
  };

  // Milestones: the next round numbers of the drivers and cars on the grid, the nearest first; gold when it is the next race
  const MS_WORD = { races: ['race', 'races'], wins: ['win', 'wins'], laps: ['lap', 'laps'] };
  const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  const milestones = (d, board) => {
    const n = Math.max(1, Number(G.optionOf(board, 'count')) || 3),
      list = (d.milestones || []).slice(0, n);
    if (!list.length)
      return card('hm-ms', 'Milestones', '', '<p class="muted">Put drivers and cars in the lanes to see their next milestones here.</p>');
    const ring = m => {
      const p = Math.max(0.04, Math.min(1, m.now / m.at)),
        c = m.tonight ? '#f5c211' : m.kind === 'laps' ? '#3ecf8e' : m.kind === 'wins' ? '#a46bff' : '#3b82f6';
      return `<svg class="hm-msr" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16" fill="none" stroke="var(--line)" stroke-width="4"/><circle cx="20" cy="20" r="16" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round" stroke-dasharray="${(100.5 * p).toFixed(1)} 100.5" transform="rotate(-90 20 20)"/></svg>`;
    };
    const words = m => {
      const [one, many] = MS_WORD[m.kind] || ['', ''];
      const n2 = Number(m.at).toLocaleString('en-US');
      if (m.tonight && m.kind === 'races')
        return [`${m.name}: ${ordinal(m.at)} race next`, `The next race ${m.name} drives is the ${ordinal(m.at)}`];
      return [`${m.name}: ${n2} ${m.at === 1 ? one : many}`, `${Number(m.left).toLocaleString('en-US')} to go`];
    };
    return card(
      'hm-ms',
      'Milestones',
      'coming up',
      list
        .map(m => {
          const [b, s] = words(m);
          return `<div class="hm-msrow${m.tonight ? ' hit' : ''}">${ring(m)}<span><strong>${esc(b)}</strong><small>${esc(s)}</small></span></div>`;
        })
        .join('')
    );
  };

  // The card for a key, from the figures d (and the board, for the options of the card). Start a race is not made here.
  function html(key, d, board) {
    switch (key) {
      case 'record':
        return record(d);
      case 'last':
        return last(d);
      case 'glance':
        return glance(d);
      case 'recent':
        return recent(d);
      case 'fastest':
        return fastest(d);
      case 'records':
        return records(d);
      case 'top':
        return top(d);
      case 'bests':
        return bests(d);
      case 'rules':
        return rules(d);
      case 'shortcuts':
        return shortcuts(d, board);
      case 'weather':
        return weather(d, board);
      case 'tyres':
        return tyres(d, board);
      case 'notes':
        return notes(d, board);
      case 'mileage':
        return mileage(d, board);
      case 'service':
        return service(d, board);
      case 'lanes':
        return lanes(d);
      case 'form':
        return form(d);
      case 'h2h':
        return h2h(d);
      case 'champ':
        return champ(d, board);
      case 'heats':
        return heats(d, board);
      case 'countdown':
        return countdown(d, board);
      case 'milestones':
        return milestones(d, board);
      default:
        return '';
    }
  }
  // Cards that have nothing to show before a race is saved: they give way to one friendly card.
  const NEEDS_RACES = [
    'record',
    'last',
    'glance',
    'recent',
    'fastest',
    'records',
    'top',
    'bests',
    'mileage',
    'lanes',
    'form',
    'h2h',
    'heats'
  ];

  const api = { html, empty, NEEDS_RACES, esc };
  root.HomeCards = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
