// (2.4.0, SlotForgeRestyle.md "Find Everything") what Find (Ctrl K) searches, and how: every kind of thing of the app (drivers, cars, tracks, teams,
// past races, race setups, championships, race systems, layouts and the other Customization items, settings, Help and pages), each with a line of
// facts and a preview; the best match first (a whole word, the start of a word, a few letters in order, one letter wrong), the things linked to it
// (the races on a track, of a driver), the count of every kind for the filter chips, and the actions of each (the first one is Enter).
// Pure: mainbar.js reads the lists and draws the panel; tests/findeverything.test.js checks this file in Node.
(function (root) {
  'use strict';
  const norm = s =>
    String(s === null || s === undefined ? '' : s)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9.:]+/g, ' ')
      .trim();
  const lap = ms => (Number(ms) > 0 ? (Number(ms) / 1000).toFixed(3) : '');
  const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
  const DAY = { weekday: 'short', day: 'numeric', month: 'short' };
  // (2.4.0 review, speed) the date formats are made once: making one per date was most of the time of building the index (14x faster with 1000 races)
  const FMT = {
    day: new Intl.DateTimeFormat('en-GB', DAY),
    year: new Intl.DateTimeFormat('en-GB', { ...DAY, year: 'numeric' }),
    month: new Intl.DateTimeFormat('en-GB', { month: 'long' })
  };
  const dayText = (iso, year) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : (year ? FMT.year : FMT.day).format(d).replace(/,/g, '');
  };
  const monthText = iso => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : FMT.month.format(d);
  };
  const SESSION_KIND = {
    practice: 'Free practice',
    qualifying: 'Qualifying',
    race: 'Race',
    timed: 'Timed race',
    heats: 'Heat-based race',
    endurance: 'Endurance race',
    tokens: 'Time Tokens'
  };

  // the filter chips, in their order; the kinds that are not a chip of their own count under All only
  const KINDS = [
    ['all', 'All'],
    ['driver', 'Drivers'],
    ['car', 'Cars'],
    ['track', 'Tracks'],
    ['team', 'Teams'],
    ['race', 'Races'],
    ['setup', 'Race setups'],
    ['champ', 'Championships'],
    ['system', 'Race systems'],
    ['custom', 'Customization'],
    ['setting', 'Settings'],
    ['help', 'Help'],
    ['page', 'Pages']
  ];
  // the groups of the list, in their order (under All)
  const GROUPS = [
    ['do', 'Do'],
    ['driver', 'Drivers'],
    ['car', 'Cars'],
    ['track', 'Tracks'],
    ['team', 'Teams'],
    ['race', 'Races'],
    ['setup', 'Race setups'],
    ['champ', 'Championships'],
    ['system', 'Race systems'],
    ['custom', 'Customization'],
    ['page', 'Pages'],
    ['setting', 'Settings'],
    ['help', 'Help']
  ];
  const ORDER = Object.fromEntries(GROUPS.map(([k], i) => [k, i]));
  const ICON = {
    driver: 'driver',
    car: 'car',
    track: 'pin',
    team: 'users',
    race: 'flag',
    setup: 'setup',
    champ: 'championship',
    system: 'sliders',
    custom: 'custom',
    setting: 'settings',
    help: 'info',
    page: 'arrow',
    do: 'bolt'
  };

  // ---- what every saved race says: the winner, the drivers, the best lap ----
  function raceFacts(s) {
    const st = (Array.isArray(s.standings) ? s.standings : [])
      .filter(Boolean)
      .slice()
      .sort((a, b) => (a.pos || 99) - (b.pos || 99));
    let best = null;
    st.forEach(r => {
      if (Number(r.best) > 0 && (!best || r.best < best.best)) best = r;
    });
    return { st, winner: st[0] || null, best };
  }

  // an item ready to be searched: its key, its icon, its words
  function prep(it) {
    it.key = it.kind + ':' + (it.id || it.t);
    it.icon = it.icon || ICON[it.kind];
    it.tn = norm(it.t);
    it.tw = it.tn.split(' ').filter(Boolean);
    it.ow = norm([it.sub, it.w, ...(it.words || [])].join(' '))
      .split(' ')
      .filter(Boolean);
    return it;
  }

  // ---- the index: one item per thing, with its words, its facts and its links ----
  // D: { drivers, slotcars, tracks, teams, racesetups, championships, sessions, layouts, rowdesigns, chartdesigns, customwidgets, audiosets, imagesets,
  //      systems: [{ e, sub, label, list }], help: [{ id, title, note }], pages: [{ t, w, icon, go }], actions: [{ t, w, icon, id, sub }] }
  // ctx: { titleOf(e, x), unit: 'm' | 'ft', champ(c) -> { next, rounds, leader } }
  function build(D = {}, ctx = {}) {
    const items = [];
    const titleOf = (e, x) => (ctx.titleOf ? ctx.titleOf(e, x) : x.name) || '';
    const unit = ctx.unit || 'm';
    const list = k => (Array.isArray(D[k]) ? D[k].filter(x => x && x.id) : []);
    const sessions = list('sessions')
      .slice()
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    const add = it => {
      if (String(it.t || '').trim() && it.t !== '(unnamed)') items.push(prep(it));
    };
    // the stats of the saved races, per driver, car and track
    const per = { driver: new Map(), car: new Map(), track: new Map() };
    const stat = (m, id) => (m.has(id) ? m.get(id) : m.set(id, { races: 0, wins: 0, best: null, last: '' }).get(id));
    sessions.forEach(s => {
      const f = raceFacts(s);
      if (s.trackId) {
        const t = stat(per.track, s.trackId);
        t.races++;
        if (!t.last) t.last = s.date;
        if (f.best && (!t.best || f.best.best < t.best.best)) t.best = f.best;
      }
      f.st.forEach(r => {
        [
          ['driver', r.driverId],
          ['car', r.carId]
        ].forEach(([k, id]) => {
          if (!id) return;
          const x = stat(per[k], id);
          x.races++;
          if (r === f.winner && f.st.length > 1) x.wins++;
          if (!x.last) x.last = s.date;
          if (Number(r.best) > 0 && (!x.best || r.best < x.best.best)) x.best = { ...r, track: s.trackName };
        });
      });
    });
    const teamOf = new Map();
    list('teams').forEach(t => (t.drivers || []).forEach(d => teamOf.set(d, t)));
    const nameOf = (k, id) => {
      const x = list(k).find(y => y.id === id);
      return x ? titleOf(k, x) : '';
    };

    list('drivers').forEach(d => {
      const s = per.driver.get(d.id) || { races: 0, wins: 0 },
        team = teamOf.get(d.id);
      add({
        kind: 'driver',
        id: d.id,
        e: 'drivers',
        t: titleOf('drivers', d),
        sub: [team ? 'Team ' + team.name : '', s.races ? plural(s.races, 'race') : 'no races yet', s.best ? 'best ' + lap(s.best.best) : '']
          .filter(Boolean)
          .join(' · '),
        w: 'Driver',
        words: [d.nickname, d.callsign, team && team.name],
        rec: d,
        facts: [
          ['Races', s.races || 0],
          ['Wins', s.wins || 0],
          ['Best lap', s.best ? lap(s.best.best) : '–', 'p'],
          ['Team', team ? team.name : '–']
        ],
        kicker: ['Driver', s.last ? 'last raced ' + dayText(s.last) : ''].filter(Boolean).join(' · ')
      });
    });
    list('slotcars').forEach(c => {
      const s = per.car.get(c.id) || { races: 0 };
      add({
        kind: 'car',
        id: c.id,
        e: 'slotcars',
        t: titleOf('slotcars', c),
        sub: [
          c.brand || c.make,
          c.raceClass || c.class,
          s.races ? plural(s.races, 'race') : 'no races yet',
          s.best ? 'best ' + lap(s.best.best) : ''
        ]
          .filter(Boolean)
          .join(' · '),
        w: 'Slotcar',
        words: [c.number, c.brand, c.make, c.model],
        rec: c,
        facts: [
          ['Races', s.races || 0],
          ['Wins', s.wins || 0],
          ['Best lap', s.best ? lap(s.best.best) : '–', 'p'],
          ['By', s.best ? s.best.driverName || '–' : '–']
        ],
        kicker: 'Slotcar'
      });
    });
    list('tracks').forEach(t => {
      const s = per.track.get(t.id) || { races: 0 };
      // the lane lengths (metres; ctx.lengths: as the track sheet works them out), shown in the unit of the app
      const lens = (ctx.lengths ? ctx.lengths(t) : String(t.laneLengths || '').split(/[,;]/))
        .map(x => parseFloat(x))
        .filter(x => x > 0)
        .concat(!ctx.lengths && !String(t.laneLengths || '').trim() && Number(t.length) > 0 ? [Number(t.length)] : []);
      const u = x => String(Math.round((unit === 'ft' ? x * 3.28084 : x) * 10) / 10);
      const len = lens.length
        ? u(Math.min(...lens)) === u(Math.max(...lens))
          ? `${u(Math.min(...lens))} ${unit}`
          : `${u(Math.min(...lens))}–${u(Math.max(...lens))} ${unit}`
        : '';
      add({
        kind: 'track',
        id: t.id,
        e: 'tracks',
        t: t.name,
        sub: [plural(Number(t.lanes) || 0, 'lane'), len, s.best ? `best ${lap(s.best.best)} ${s.best.driverName || ''}`.trim() : '']
          .filter(Boolean)
          .join(' · '),
        w: 'Track',
        rec: t,
        facts: [
          ['Lanes', Number(t.lanes) || '–'],
          ['Length', len || '–'],
          ['Best lap', s.best ? lap(s.best.best) : '–', 'p'],
          ['By', s.best ? s.best.driverName || '–' : '–']
        ],
        kicker: ['Track', s.races ? 'raced on ' + plural(s.races, 'time') : 'not raced on yet'].join(' · ')
      });
    });
    list('teams').forEach(t => {
      const names = (t.drivers || []).map(id => nameOf('drivers', id)).filter(Boolean);
      add({
        kind: 'team',
        id: t.id,
        e: 'teams',
        t: t.name,
        sub: names.length
          ? plural(names.length, 'driver') + ': ' + names.slice(0, 4).join(', ') + (names.length > 4 ? '…' : '')
          : 'no drivers yet',
        w: 'Team',
        words: names,
        rec: t,
        links: t.drivers || [],
        facts: [
          ['Drivers', names.length],
          ['Class', t.raceClass || '–']
        ],
        lines: names,
        kicker: 'Team'
      });
    });
    const setups = list('racesetups');
    setups.forEach(su => {
      const track = nameOf('tracks', su.track || su.trackId);
      add({
        kind: 'setup',
        id: su.id,
        e: 'racesetups',
        t: su.name,
        sub: [SESSION_KIND[su.ofType || su.sessionType] || '', su.laps ? plural(Number(su.laps), 'lap') : '', track]
          .filter(Boolean)
          .join(' · '),
        w: 'Race setup',
        rec: su,
        facts: [
          ['Kind', SESSION_KIND[su.ofType || su.sessionType] || '–'],
          ['Track', track || '–']
        ],
        kicker: 'Race setup'
      });
    });
    sessions.forEach(s => {
      const f = raceFacts(s),
        kind = SESSION_KIND[s.sessionType] || 'Race',
        setup = setups.find(x => x.name === s.setupName);
      add({
        kind: 'race',
        id: s.id,
        e: 'sessions',
        t: s.setupName || kind,
        sub: [
          dayText(s.date),
          s.trackName,
          f.winner && f.st.length > 1 ? `${f.winner.driverName || f.winner.teamName || '?'} won` : f.winner ? f.winner.driverName : '',
          f.st.length ? plural(f.st.length, 'driver') : ''
        ]
          .filter(Boolean)
          .join(' · '),
        w: s.sessionType === 'tokens' ? 'Time Tokens' : 'Race',
        date: s.date,
        words: [
          dayText(s.date, true),
          monthText(s.date),
          kind,
          ...f.st.map(r => r.driverName),
          ...f.st.map(r => r.carName),
          s.champ && s.champ.name
        ],
        links: [s.trackId, ...f.st.map(r => r.driverId), ...f.st.map(r => r.carId), s.champ && s.champ.id].filter(Boolean),
        setupId: setup ? setup.id : '',
        tokens: s.sessionType === 'tokens',
        facts: [
          ['Winner', f.winner ? f.winner.driverName || f.winner.teamName || '–' : '–'],
          ['Best lap', f.best ? lap(f.best.best) : '–', 'p'],
          ['Drivers', f.st.length],
          ['Laps', f.winner && f.winner.laps !== undefined ? f.winner.laps : '–']
        ],
        lines: f.st
          .slice(0, 6)
          .map(r => `${r.driverName || r.teamName || '?'} · ${r.laps !== undefined ? plural(Number(r.laps) || 0, 'lap') : ''}`),
        kicker: [kind, dayText(s.date, true), s.trackName].filter(Boolean).join(' · ')
      });
    });
    list('championships').forEach(c => {
      const x = ctx.champ ? ctx.champ(c) || {} : {};
      const rounds = Array.isArray(c.rounds) ? c.rounds.length : 0,
        roster = Array.isArray(c.roster) ? c.roster.length : 0;
      add({
        kind: 'champ',
        id: c.id,
        e: 'championships',
        t: c.name,
        sub: [plural(rounds, 'round'), plural(roster, 'driver'), x.leader ? x.leader + ' leads' : '', x.next ? 'next ' + x.next : '']
          .filter(Boolean)
          .join(' · '),
        w: 'Championship',
        links: (c.roster || []).map(r => r.driver).filter(Boolean),
        facts: [
          ['Rounds', x.driven !== undefined ? `${x.driven} of ${rounds}` : rounds],
          ['Drivers', roster],
          ['Leader', x.leader || '–'],
          ['Next', x.next || '–']
        ],
        kicker: 'Championship'
      });
    });
    (Array.isArray(D.systems) ? D.systems : []).forEach(g =>
      (g.list || []).forEach(r => {
        if (r && r.id)
          add({
            kind: 'system',
            id: r.id,
            e: g.e,
            sub0: g.sub,
            t: r.name,
            sub: g.label,
            w: 'Race Setup',
            kicker: g.label,
            page: { tab: 'setup', setupSub: g.sub }
          });
      })
    );
    [
      ['layouts', 'layouts', 'Layout', 'screen'],
      ['rowdesigns', 'rows', 'Leaderboard row', 'lines'],
      ['chartdesigns', 'charts', 'Chart', 'gauge'],
      ['customwidgets', 'widgets', 'Widget', 'layers'],
      ['audiosets', 'audio', 'Audio set', 'say'],
      ['imagesets', 'images', 'Picture set', 'paint']
    ].forEach(([e, sub, what, icon]) =>
      list(e).forEach(r =>
        add({
          kind: 'custom',
          id: r.id,
          e,
          t: r.name,
          sub: [what, r.note, r.widgets ? plural(r.widgets.length, 'widget') : ''].filter(Boolean).join(' · '),
          w: 'Customization',
          icon,
          kicker: what,
          page: { tab: 'custom', customSub: sub }
        })
      )
    );
    (Array.isArray(D.help) ? D.help : []).forEach(h =>
      add({ kind: 'help', id: h.id, t: h.title, sub: h.note || '', w: 'Help', kicker: 'Help', words: h.words })
    );
    (Array.isArray(D.pages) ? D.pages : []).forEach(p => add({ kind: 'page', ...p, id: p.id || p.t + '@' + (p.w || '') }));
    (Array.isArray(D.actions) ? D.actions : []).forEach(a => add({ kind: 'do', ...a }));
    return items;
  }

  // ---- matching ----
  // the letters of a in b in order, from the first one ("clb" in "club"); one letter wrong, missing, extra or two swapped ("anan" for "anna")
  const inOrder = (a, b) => {
    if (a[0] !== b[0]) return false;
    let i = 0;
    for (const ch of b) if (ch === a[i]) i++;
    return i === a.length;
  };
  function near(a, b) {
    if (Math.abs(a.length - b.length) > 1) return false;
    const m = a.length,
      n = b.length,
      d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
    for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++)
      for (let j = 1; j <= n; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    return d[m][n] <= 1;
  }
  // how well one typed word matches: 0 not at all
  function wordScore(w, it) {
    let s = 0;
    for (const x of it.tw) {
      if (x === w) s = Math.max(s, 100);
      else if (x.startsWith(w)) s = Math.max(s, 80);
      else if (w.length >= 3 && x.includes(w)) s = Math.max(s, 55);
      else if (w.length >= 3 && inOrder(w, x)) s = Math.max(s, 35);
      else if (w.length >= 4 && (near(w, x) || near(w, x.slice(0, w.length)))) s = Math.max(s, 30);
    }
    if (s >= 80) return s;
    for (const x of it.ow) {
      if (x === w) s = Math.max(s, 45);
      else if (x.startsWith(w)) s = Math.max(s, 40);
      else if (w.length >= 4 && x.includes(w)) s = Math.max(s, 25);
      else if (w.length >= 5 && near(w, x)) s = Math.max(s, 15);
    }
    return s;
  }
  // the score of an item for what was typed: -1 when a word is not found
  function score(it, q) {
    const n = norm(q),
      words = n.split(' ').filter(Boolean);
    if (!words.length) return 0;
    let total = 0;
    for (const w of words) {
      const s = wordScore(w, it);
      if (!s) return -1;
      total += s;
    }
    total = total / words.length;
    if (it.tn === n) total += 60;
    else if (it.tn.startsWith(n)) total += 30;
    else if (it.tn.includes(n)) total += 10;
    return total;
  }

  // ---- the search: { best, list (with their groups), counts } ----
  // o: { kind: a chip ('all' default), recent: [keys], settings: [items of the settings search], max }
  function search(items, q, o = {}) {
    const raw = String(q || ''),
      only = /^\s*>/.test(raw),
      text = only ? raw.replace(/^\s*>/, '') : raw,
      kind = o.kind && o.kind !== 'all' ? o.kind : '';
    const pool = (only ? items.filter(x => x.kind === 'do') : items).concat(only ? [] : o.settings || []);
    const counts = { all: 0 };
    // "Its races": the races linked to one thing (a track, a driver, a car, a championship), the newest first
    if (o.of && o.of.id) {
      const list = items
        .filter(x => x.kind === 'race' && (x.links || []).includes(o.of.id) && (!norm(text) || score(x, text) > 0))
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
      return {
        best: list[0] || null,
        list: list.slice(0, o.max || 60).map(x => ({ ...x, g: linkedTitle(o.of) || 'Races' })),
        counts: { all: list.length, race: list.length }
      };
    }
    if (!norm(text)) {
      // nothing typed: Recent and Do; a chip lists all of its kind (the races newest first)
      if (kind) {
        const all = pool.filter(x => x.kind === kind);
        all.sort((a, b) => (kind === 'race' ? String(b.date || '').localeCompare(String(a.date || '')) : a.t.localeCompare(b.t)));
        return {
          best: all[0] || null,
          list: all.slice(0, o.max || 60).map(x => ({ ...x, g: GROUPS.find(g => g[0] === kind)[1] })),
          counts: countOf(pool)
        };
      }
      const byKey = new Map(items.map(x => [x.key, x]));
      // (a record that is gone is left out; a setting is kept as it was opened)
      const recent = (only ? [] : o.recent || [])
        .map(r => (typeof r === 'string' ? byKey.get(r) : r && (byKey.get(r.key) || (r.kind === 'setting' && r.setting ? r : null))))
        .filter(x => x && x.t);
      const dos = pool.filter(x => x.kind === 'do');
      const list = [...recent.slice(0, 6).map(x => ({ ...x, g: 'Recent' })), ...dos.map(x => ({ ...x, g: 'Do' }))];
      return { best: list[0] || null, list, counts: countOf(pool) };
    }
    const hits = [];
    pool.forEach(x => {
      const s = x.kind === 'setting' && x.score !== undefined ? x.score : score(x, text);
      if (s > 0) hits.push({ x, s });
    });
    hits.sort(
      (a, b) =>
        b.s - a.s ||
        (a.x.kind === 'race' && b.x.kind === 'race'
          ? String(b.x.date || '').localeCompare(String(a.x.date || ''))
          : ORDER[a.x.kind] - ORDER[b.x.kind])
    );
    hits.forEach(h => {
      counts.all++;
      counts[h.x.kind] = (counts[h.x.kind] || 0) + 1;
    });
    const shown = kind ? hits.filter(h => h.x.kind === kind) : hits;
    if (!shown.length) return { best: null, list: [], counts };
    const best = shown[0].x;
    const out = [{ ...best, g: 'Best match' }];
    const used = new Set([best.key]);
    // the things linked to the best match: the races on a track, of a driver or a car, of a championship; the drivers of a team
    if (!kind || kind === 'race') {
      const linked = linkedOf(items, best).filter(x => !used.has(x.key));
      if (linked.length) {
        const g = linkedTitle(best);
        linked.slice(0, kind ? 30 : 4).forEach(x => {
          used.add(x.key);
          out.push({ ...x, g });
        });
      }
    }
    const per = {};
    shown.forEach(({ x }) => {
      if (used.has(x.key)) return;
      per[x.kind] = (per[x.kind] || 0) + 1;
      if (!kind && per[x.kind] > (x.kind === 'race' ? 4 : 5)) return;
      if (kind && per[x.kind] > (o.max || 60)) return;
      used.add(x.key);
      out.push({ ...x, g: (GROUPS.find(g => g[0] === x.kind) || ['', 'More'])[1] });
    });
    // under All the groups follow each other in the order of GROUPS, after the best match and its links
    const lt = linkedTitle(best),
      head = out.filter(x => x.g === 'Best match' || (lt && x.g === lt)),
      rest = out.filter(x => !head.includes(x));
    rest.sort((a, b) => ORDER[a.kind] - ORDER[b.kind]);
    return { best, list: [...head, ...rest], counts };
  }
  const countOf = pool => {
    const c = { all: pool.length };
    pool.forEach(x => (c[x.kind] = (c[x.kind] || 0) + 1));
    return c;
  };
  function linkedOf(items, best) {
    if (!best) return [];
    if (best.kind === 'team') return items.filter(x => x.kind === 'driver' && (best.links || []).includes(x.id));
    if (best.kind === 'driver') {
      const teams = items.filter(x => x.kind === 'team' && (x.links || []).includes(best.id));
      const champs = items.filter(x => x.kind === 'champ' && (x.links || []).includes(best.id));
      return [...teams, ...champs, ...items.filter(x => x.kind === 'race' && (x.links || []).includes(best.id))];
    }
    if (['track', 'car', 'champ'].includes(best.kind)) return items.filter(x => x.kind === 'race' && (x.links || []).includes(best.id));
    return [];
  }
  const LINKED = { track: 'Races on ', car: 'Races with ', champ: 'Races of ', driver: 'With ', team: 'Drivers of ' };
  const linkedTitle = best => (best && LINKED[best.kind] ? LINKED[best.kind] + best.t : '');

  // ---- the actions of an item: [{ id, label, icon }], the first one is Enter ----
  function actionsOf(it) {
    if (!it) return [];
    const races = { id: 'races', label: 'Its races', icon: 'flag' };
    switch (it.kind) {
      case 'driver':
        return [
          { id: 'edit', label: 'Edit the driver', icon: 'driver' },
          { ...races, label: 'Their races' },
          { id: 'book', label: 'The record book', icon: 'star' }
        ];
      case 'car':
        return [{ id: 'edit', label: 'Edit the car', icon: 'car' }, races, { id: 'book', label: 'The record book', icon: 'star' }];
      case 'track':
        return [{ id: 'edit', label: 'Edit the track', icon: 'pin' }, races, { id: 'book', label: 'The record book', icon: 'star' }];
      case 'team':
        return [{ id: 'edit', label: 'Edit the team', icon: 'users' }];
      case 'race':
        return [
          { id: 'open', label: it.tokens ? 'Open in Token Records' : 'Open in Results', icon: 'flag' },
          ...(it.setupId ? [{ id: 'again', label: 'Race it again: Home', icon: 'lights' }] : [])
        ];
      case 'setup':
        return [
          { id: 'edit', label: 'Edit the race setup', icon: 'setup' },
          { id: 'home', label: 'Race with it: Home', icon: 'lights' }
        ];
      case 'champ':
        return [
          { id: 'standings', label: 'The standings', icon: 'championship' },
          { id: 'edit', label: 'Edit the championship', icon: 'setup' },
          { id: 'home', label: 'Race the next round: Home', icon: 'lights' },
          { ...races, label: 'Its races' }
        ];
      case 'system':
      case 'custom':
        return [{ id: 'edit', label: 'Edit it', icon: it.icon || 'sliders' }];
      case 'help':
        return [{ id: 'open', label: 'Read it in Help', icon: 'info' }];
      case 'do':
        return [{ id: 'open', label: it.t, icon: it.icon }];
      default:
        return [{ id: 'open', label: 'Open', icon: 'arrow' }];
    }
  }

  // ---- Recent: the last things opened (the newest first, each once) ----
  const RECENT_MAX = 8;
  function remember(list, it) {
    if (!it || !it.key || it.kind === 'do') return Array.isArray(list) ? list : [];
    const keep = { key: it.key, kind: it.kind, t: it.t, w: it.w, icon: it.icon };
    if (it.kind === 'setting') keep.setting = it.setting;
    if (it.kind === 'page') keep.go = it.go;
    return [keep, ...(Array.isArray(list) ? list : []).filter(x => x && x.key !== it.key)].slice(0, RECENT_MAX);
  }

  const api = {
    KINDS,
    GROUPS,
    ICON,
    norm,
    prep,
    lap,
    build,
    score,
    search,
    actionsOf,
    remember,
    linkedOf,
    near,
    inOrder,
    raceFacts,
    dayText
  };
  root.FindIndex = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
