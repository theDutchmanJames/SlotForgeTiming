// database: Results and Records: sessions, records, history pools and PDF choices
// (part of renderer/database.js: loaded just before it by index.html; the parts share the page's global scope)
// ---- Results and Records ----
// (2.4.0 review, speed) the date formatters are made once, not for every row of the results list
const RS_FMT = {};
const rsFmt = (k, o) => RS_FMT[k] || (RS_FMT[k] = new Intl.DateTimeFormat([], o));
const dateText = iso => (iso ? rsFmt('full', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) : '');
const SESSION_LABEL = {
  practice: 'Free practice',
  qualifying: 'Qualifying',
  race: 'Race',
  timed: 'Timed race',
  heats: 'Heat-based race',
  endurance: 'Endurance Race',
  tokens: 'Time Token Session'
};

// The page has two pools that never mix: Racing Records (everything raced) and Token Records (the stints of Time Token Sessions, with their own records).
async function renderResults(box) {
  manager = null;
  const pool = state.resultsSub === 'tokens' ? 'tokens' : state.resultsSub === 'champs' ? 'champs' : 'racing';
  box.innerHTML = '<div class="sub" id="respool" role="tablist"></div><div id="resbody"></div>';
  renderTabs(
    byId('respool'),
    [
      ['racing', 'Racing Records'],
      ['tokens', 'Token Records'],
      ['champs', 'Championships']
    ],
    pool,
    id => {
      state.resultsSub = id;
      renderResults(box);
    }
  );
  if (pool === 'champs') {
    await renderChampStandings(byId('resbody'));
    return;
  } // (1.56.0: the standings of the championships)
  const body = byId('resbody');
  if (pool === 'racing' && api.historyPage && typeof RecordBook !== 'undefined' && typeof renderRecordBook === 'function')
    return renderRecordBook(body); // (2.4.0: the Record Book)
  await renderResultsPool(body, pool);
}
// the lines that tell how the figures of a table are counted, as one small paragraph under it
const statNote = keys => {
  const n = Stats.notes(keys);
  return n.length ? `<p class="muted statnote">${n.map(esc).join(' ')}</p>` : '';
};
// time bought for a stint: "10 min", "1 min 30 s", "45 s"
const boughtText = ms => {
  const sec = Math.round(Number(ms) / 1000);
  if (!Number.isFinite(sec)) return '';
  const m = Math.floor(sec / 60),
    s = sec % 60;
  return !s ? `${m} min` : m ? `${m} min ${s} s` : `${s} s`;
};

// The tyre stints of a session that had Tyre Wear (1.42.0): a heading with its two switches (kept in the settings), and the bars under it. Nothing for a session without tyre wear.
const tyreStintsSection = s => {
  if (!Stats.tyreStints(s, dUnit()).length) return '';
  const on = state.settings.tyreStints !== false,
    worn = state.settings.tyreWornRed === true;
  return `<h4>Tyre stints</h4><div class="tysopt"><label class="inline"><input type="checkbox" data-tyshow="${esc(s.id)}"${on ? ' checked' : ''}> Show the tyre stints under the results</label>
    <label class="inline"><input type="checkbox" data-tyworn="${esc(s.id)}"${worn ? ' checked' : ''}> Show the laps on worn tyres (0%) in red</label></div>${on ? Stats.tyreStintsHtml(s, { distUnit: dUnit(), worn }) + `<p class="muted statnote">${esc(Stats.tyreStintsNote(s))}</p>` : ''}`;
};

// The dialog of Export to PDF: what goes in the PDF. Resolves with the options for Report.sessionHtml, or null when it was cancelled.
// The columns start as the View settings have them; the pages (results table, heats, lap times) start as they were picked the last time.
function pdfChoice(session, figs) {
  const cols = Stats.sessionColumns(session, figs),
    screen = ViewSet.keys(Stats.SESSION_COLUMNS, viewSaved(['results', 'sessions']));
  // (2.4.0) a page for every driver, and Colour or Monochrome; every lap time is a choice now (the driver pages have the lap sheet)
  const pages = { results: true, heats: true, tyres: true, laps: false, drivers: true, ...(state.settings.pdfPages || {}) };
  let mode = state.settings.pdfMode === 'mono' ? 'mono' : 'colour';
  const picked = new Set(cols.filter(c => screen.includes(c.key)).map(c => c.key));
  const items = [
    ['results', 'Results table'],
    ...(session.heatResults ? [['heats', session.finals ? 'Heats and finals' : 'Heats']] : []),
    ...(Stats.tyreStints(session, 'm').length ? [['tyres', 'Tyre stints']] : []),
    ...(session.sessionType === 'tokens' ? [] : [['drivers', 'A page for every driver']]),
    ['laps', 'Every lap time (a table at the end)']
  ];
  dlg.innerHTML = `<h3>Export to PDF</h3><p class="muted">Choose what goes in the PDF.</p>
    <fieldset class="vsgroup"><legend>Include</legend>${items.map(([k, t]) => `<label class="vschip"><input type="checkbox" data-pdfpage="${k}"${pages[k] ? ' checked' : ''}> ${esc(t)}</label>`).join('')}</fieldset>
    <fieldset class="vsgroup pdfmode"><legend>Print in</legend><label class="vschip"><input type="radio" name="pdfmode" data-pdfmode="colour"${mode === 'colour' ? ' checked' : ''}> Colour</label><label class="vschip"><input type="radio" name="pdfmode" data-pdfmode="mono"${mode === 'mono' ? ' checked' : ''}> Monochrome <span class="muted">(saves ink)</span></label></fieldset>
    <fieldset class="vsgroup"><legend>Columns of the results table</legend>${cols.map(c => `<label class="vschip"><input type="checkbox" data-pdfcol="${esc(c.key)}"${picked.has(c.key) ? ' checked' : ''}> ${esc(c.label)}</label>`).join('')}</fieldset>
    <div class="row"><button class="btn" type="button" data-pdfall="1">All columns</button><button class="btn" type="button" data-pdfall="0">No columns</button></div>
    <p class="muted">The columns start as your View settings have them. The choice of pages is remembered for the next time.</p>
    <p class="error" id="pdferr" role="alert"></p>
    <div class="row"><button class="btn primary pdfbtn" type="button" id="pdfgo">${Icons.svg('pdf', { size: 18 })}<span>Export to PDF</span></button><button class="btn" type="button" id="pdfcancel">Cancel</button></div>`;
  return new Promise(resolve => {
    let done = false;
    const finish = v => {
      if (done) return;
      done = true;
      if (dlg.open) dlg.close();
      resolve(v);
    };
    dlg.addEventListener('close', () => finish(null), { once: true }); // (Escape closes it too)
    dlg.oninput = null;
    dlg.onchange = ev => {
      const t = ev.target || {},
        d = t.dataset || {};
      if (d.pdfpage) pages[d.pdfpage] = !!t.checked;
      if (d.pdfmode && t.checked !== false) mode = d.pdfmode === 'mono' ? 'mono' : 'colour';
      if (d.pdfcol) {
        if (t.checked) picked.add(d.pdfcol);
        else picked.delete(d.pdfcol);
      }
    };
    dlg.onclick = async ev => {
      const b = ev.target && ev.target.closest ? ev.target.closest('button') : null;
      if (!b) return;
      if (b.dataset && b.dataset.pdfall !== undefined) {
        const on = b.dataset.pdfall === '1';
        picked.clear();
        if (on) cols.forEach(c => picked.add(c.key));
        if (typeof dlg.querySelectorAll === 'function')
          Array.from(dlg.querySelectorAll('[data-pdfcol]') || []).forEach(x => {
            x.checked = on;
          });
        return;
      }
      if (b.id === 'pdfcancel') return finish(null);
      if (b.id !== 'pdfgo') return;
      const err = byId('pdferr'),
        has = items.some(([k]) => pages[k]);
      if (!has) {
        err.textContent = 'Pick at least one thing to include.';
        return;
      }
      if (pages.results && !picked.size) {
        err.textContent = 'Pick at least one column, or leave the results table out.';
        return;
      }
      const chosen = { results: !!pages.results, heats: !!pages.heats, tyres: !!pages.tyres, laps: !!pages.laps, drivers: !!pages.drivers };
      try {
        state.settings = await api.setSettings({ pdfPages: chosen, pdfMode: mode });
      } catch {
        /* remembering the choice is not needed for the PDF */
      }
      finish({ ...chosen, mode, columns: cols.filter(c => picked.has(c.key)).map(c => c.key) });
    };
    if (!dlg.open) dlg.showModal();
  });
}

async function renderHistoryPool(box, pool) {
  const cursors = { sessions: [null], tracks: [null], personal: [null] },
    indices = { sessions: 0, tracks: 0, personal: 0 };
  let selected = state.focusSession || null,
    offset = 0,
    notice = '',
    staleRetries = 0,
    reveal = !!state.focusSession;
  async function load() {
    const run = ++subRun;
    let expected = run;
    try {
      const page = await api.historyPage(pool, Object.fromEntries(Object.keys(cursors).map(k => [k, cursors[k][indices[k]]])));
      if (run !== subRun) return;
      if (state.focusSession) {
        selected = state.focusSession;
        state.focusSession = null;
        offset = 0;
        reveal = true;
      }
      const detail = selected ? await api.historySession(pool, selected, { offset, revision: page.revision }) : null;
      if (run !== subRun) return;
      if (selected && !detail) {
        selected = null;
        notice = 'This session is no longer available.';
      }
      staleRetries = 0;
      const refs = {};
      for (const k of ['sessions', 'tracks', 'drivers', 'slotcars'])
        refs[k] = [...new Map([...(page.refs[k] || []), ...(detail?.refs[k] || [])].map(x => [x.id, x])).values()];
      let sessions = page.sessions.items.map(s => (s.id === detail?.session.id ? detail.session : s));
      if (detail && !sessions.some(s => s.id === detail.session.id)) sessions.unshift(detail.session);
      const reload = () => load();
      if (reveal && detail) folderClosed.delete(folderKey(pool === 'tokens' ? 'tresults' : 'results', 'sessions'));
      expected = run + 1;
      await renderResultsPool(box, pool, { sessions: sessions.slice().reverse(), laps: detail?.laps || [], refs, page, detail, reload });
      if (expected !== subRun) return;
      reveal = false;
      const rendered = subRun;
      const info = document.createElement('div');
      info.className = 'history-guidance';
      info.innerHTML = `${notice ? `<p role="status">${esc(notice)}</p>` : ''}<p class="muted">Open a session to load its results. Lap times are shown 100 at a time; statistics and PDF exports use all laps.</p>`;
      box.prepend(info);
      const folderPage = pool === 'tokens' ? 'tresults' : 'results';
      for (const [key, id, label] of [
        ['tracks', 'tracks', 'Track records'],
        ['personal', 'pb', 'Personal bests'],
        ['sessions', 'sessions', pool === 'tokens' ? 'Stints' : 'Sessions']
      ]) {
        if (!indices[key] && !page[key].next) continue;
        const folder = [...box.querySelectorAll('details.dbfolder')].find(x => x.dataset.folder === folderKey(folderPage, id));
        if (!folder) continue;
        const nav = document.createElement('nav');
        nav.className = 'history-navigation';
        nav.setAttribute('aria-label', label + ' pages');
        nav.innerHTML = `<button class="btn" type="button" data-history-prev="${key}"${indices[key] ? '' : ' disabled'}>Previous</button><span role="status">Page ${indices[key] + 1}</span><button class="btn" type="button" data-history-next="${key}"${page[key].next ? '' : ' disabled'}>Next</button>`;
        folder.querySelector('summary').after(nav);
        nav.onclick = ev => {
          ev.stopPropagation();
          if (rendered !== subRun) return;
          const prev = ev.target.closest('[data-history-prev]'),
            next = ev.target.closest('[data-history-next]');
          if (prev && !prev.disabled && indices[key] > 0) {
            indices[key]--;
            void load();
          } else if (next && !next.disabled && page[key].next) {
            cursors[key][++indices[key]] = page[key].next;
            void load();
          }
        };
      }
      for (const element of box.querySelectorAll('[data-history-open]'))
        element.onclick = ev => {
          ev.preventDefault();
          ev.stopPropagation();
          if (rendered !== subRun) return;
          selected = element.dataset.historyOpen;
          offset = 0;
          reveal = true;
          void load();
        };
      if (detail) {
        const card = [...box.querySelectorAll('details.sess')].find(x => x.dataset.sid === selected);
        if (card) {
          card.open = true;
          const paging = document.createElement('div');
          paging.className = 'row history-laps';
          paging.innerHTML = `<span>Lap times ${detail.total ? offset + 1 : 0}–${Math.min(detail.total, offset + 100)} of ${detail.total}</span><button class="btn" data-laps-prev ${offset ? '' : 'disabled'}>Previous laps</button><button class="btn" data-laps-next ${offset + 100 < detail.total ? '' : 'disabled'}>Next laps</button>`;
          const lh = card.querySelector('.rr-laphead');
          if (lh) lh.after(paging);
          else card.querySelector('.sessbody').prepend(paging); // (2.4.0: right above the lap times they page)
          paging.onclick = ev => {
            ev.stopPropagation();
            if (rendered !== subRun) return;
            if (ev.target.closest('[data-laps-prev]')) offset = Math.max(0, offset - 100);
            else if (ev.target.closest('[data-laps-next]')) offset += 100;
            else return;
            void load();
          };
        }
      }
    } catch (error) {
      if (expected !== subRun) return;
      if ((error.code === 'CATALOGUE_CHANGED' || /catalogue changed/i.test(error.message)) && ++staleRetries <= 2) {
        for (const key of Object.keys(cursors)) {
          cursors[key] = [null];
          indices[key] = 0;
        }
        offset = 0;
        notice = 'Results changed. The pages have been refreshed.';
        return load();
      }
      box.innerHTML = `<p role="alert">Could not load results: ${esc(error.message)}</p><button class="btn" data-history-retry>Try again</button>`;
      box.querySelector('[data-history-retry]').onclick = load;
    }
  }
  return load();
}

async function renderResultsPool(box, pool, supplied = null) {
  if (api.historyPage && !supplied) return renderHistoryPool(box, pool);
  const reload = () => (supplied ? supplied.reload() : renderResultsPool(box, pool));
  const tokenPool = pool === 'tokens';
  const run = ++subRun;
  const [allSessions, allLaps, drivers, cars, tracks] = supplied
    ? [supplied.sessions, supplied.laps, supplied.refs.drivers, supplied.refs.slotcars, supplied.refs.tracks]
    : await Promise.all(['sessions', 'laps', 'drivers', 'slotcars', 'tracks'].map(x => api.list(x)));
  if (run !== subRun) return;
  const sessions = allSessions
    .filter(x => (x.sessionType === 'tokens') === tokenPool)
    .map(x => (Array.isArray(x.standings) ? x : { ...x, standings: [] })); // (a session from a hand-made file may have no list of results: it shows with an empty table)
  const laps = allLaps.filter(l => !!l.token === tokenPool); // (the two pools never mix)
  if (!sessions.length) {
    // (2.4.0, SlotForgeRestyle.md "Race Report") an empty page is a card: a picture, what comes here, where it comes from
    const card = (icon, title, text) =>
      `<div class="rr-empty"><span class="rr-emptyico" aria-hidden="true">${typeof Icons !== 'undefined' ? Icons.svg(icon, { size: 26, stroke: 1.6 }) : ''}</span><h3>${title}</h3><p class="muted">${text}</p></div>`;
    box.innerHTML = tokenPool
      ? card(
          'tokens',
          'No stints yet',
          'No token results yet. Open a Time Token Session from the Home tab: every stint (one driver on one lane for one paid time) is saved here when it ends.'
        )
      : card('flag', 'No races yet', 'No results yet. Run a race from the Home tab and every lap is saved here.');
    return;
  }
  const name = (list, id, ent) => {
    const x = list.find(r => r.id === id);
    return x ? titleOf(ent, x) : tokenPool && !id ? 'Guest' : '(deleted)';
  };
  const folderPage = tokenPool ? 'tresults' : 'results';

  // fastest lap per track overall, and per driver on each track
  // a lap removed from the records stays in its session; the next fastest lap takes over
  const best = (keyFn, skip) => {
    const m = new Map();
    for (const l of laps) {
      if (l[skip] || (tokenPool && skip === 'noPersonalBest' && !l.driverId)) continue;
      const k = keyFn(l);
      if (!m.has(k) || l.time < m.get(k).time) m.set(k, l);
    }
    return [...m.values()];
  };
  // the columns of the record tables (View settings decides which are shown)
  const sessionOf = new Map([...(supplied?.refs.sessions || []), ...sessions].map(x => [x.id, x]));
  const speedOf = l => Stats.lapSpeed(l, tracks, cars);
  const lapText = l => `${l.heat ? (l.final ? 'F' + l.final : 'H' + l.heat) + ' ' : ''}${l.lapNumber}`;
  const RECCELL = {
    track: l => esc(name(tracks, l.trackId, 'tracks')),
    driver: l => esc(name(drivers, l.driverId, 'drivers')),
    time: l => `<strong>${esc(RaceEngine.fmtTime(l.time))}</strong>`,
    car: l => esc(name(cars, l.carId, 'slotcars')),
    speed: l => esc(Stats.fmtSpeed(speedOf(l).speed, Speed.unitOf(state.settings))),
    scalespeed: l => esc(Stats.fmtScale(speedOf(l).scalespeed, Speed.unitOf(state.settings))),
    session: l => (sessionOf.get(l.sessionId) ? esc(sessionOf.get(l.sessionId).setupName) : '<span class="muted">–</span>'),
    lane: l => (l.lane ? esc(l.lane) : '<span class="muted">–</span>'),
    lapno: l => esc(lapText(l)),
    date: l => esc(dateText(l.date))
  };
  const recKeys = Stats.RECORD_COLUMNS.filter(c => ViewSet.keys(Stats.RECORD_COLUMNS, viewSaved(['results', 'records'])).includes(c.key));
  const recRow = kind => l => `<tr>${recKeys.map(c => `<td>${RECCELL[c.key](l)}</td>`).join('')}
    <td class="actions">${l.pendingLibrary ? '<small class="rec-pending" title="This race has not reached the shared library yet (App Settings, Connections, Shared Library). Its record counts here until it does.">Not yet in the shared library</small> ' : ''}${l.readOnly ? '<small>Recorded by another source</small>' : `<button class="btn danger" data-delrec="${kind}" data-lap="${esc(l.id)}">Remove</button>`}</td></tr>`;
  const head = `<tr>${recKeys.map(c => `<th>${esc(c.label)}</th>`).join('')}<th></th></tr>`;
  const byTrack = (a, b) => name(tracks, a.trackId, 'tracks').localeCompare(name(tracks, b.trackId, 'tracks')) || a.time - b.time;
  const trackRecords = supplied ? supplied.page.tracks.items : best(l => l.trackId, 'noTrackRecord').sort(byTrack);
  const personal = supplied ? supplied.page.personal.items : best(l => l.trackId + '|' + l.driverId, 'noPersonalBest').sort(byTrack);

  const recTable = (list, kind) =>
    list.length
      ? `<div class="wrap"><table class="fields">${head}${list.map(recRow(kind)).join('')}</table></div>`
      : '<p class="muted">None yet.</p>';
  // The end of the summary line of a session: who won a race (the first place; a driver who was deleted takes the place with them, so the runner-up is not called the winner), and who was fastest in a practice or a qualifying
  const headline = (s, win, cup) => {
    if (!win) return '';
    if (Stats.WINNER_TYPES.includes(s.sessionType))
      return Number(win.pos) === 1
        ? '<span class="rr-win"><small>Winner: </small>' + (Stats.isWinner(s, win) ? cup + ' ' : '') + esc(win.driverName) + '</span>'
        : '';
    return Number(win.best) > 0 ? '<span class="rr-win"><small>Fastest: </small>' + esc(win.driverName) + '</span>' : '';
  };
  // (2.4.0) the head of a saved race in the list: a date tile, the name, and what kind of race on which track
  const sumHead = (s, extra) => {
    const d = s.date ? new Date(s.date) : null,
      ok = d && Number.isFinite(d.getTime());
    return `<span class="rr-date"${ok ? ` title="${esc(dateText(s.date))}"` : ''}><b>${ok ? d.getDate() : '–'}</b><small>${ok ? esc(rsFmt('mon', { month: 'short' }).format(d)) : ''}</small></span><span class="rr-what"><b>${esc(extra ? extra.name : s.setupName || 'Time token stint')}</b><small>${ok ? esc(rsFmt('when', { weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(d)) + ' · ' : ''}${esc(extra ? extra.line : [SESSION_LABEL[s.sessionType] || '', s.trackName || ''].filter(Boolean).join(' · '))}</small></span>`;
  };
  const sessionCards = [...sessions]
    .reverse()
    .map(s => {
      const win =
        typeof VirtualRival !== 'undefined' ? VirtualRival.savedStandings(s).find(x => x.pos === 1) || s.standings[0] : s.standings[0];
      if (s.historySummary)
        return `<details class="card sess" data-sid="${esc(s.id)}"><summary data-history-open="${esc(s.id)}">${sumHead(s)}${headline(s, win, Icons.trophy({ size: 16 }))}</summary><div class="sessbody">Open to load results.</div></details>`;
      if (tokenPool) {
        // a stint: one driver, one lane, one paid time
        const x = win || {},
          t = s.token || {},
          mine = laps.filter(l => l.sessionId === s.id).sort((a, b) => a.lapNumber - b.lapNumber);
        const figs = supplied?.detail?.figures || Stats.forSession(s, mine, tracks, cars),
          stintKeys = ViewSet.keys(Stats.STINT_COLUMNS, viewSaved(['results', 'stints']));
        const STCELL = {
          driver: esc(x.driverName),
          car: esc(x.carName),
          lane: esc(t.lane),
          bought: esc(boughtText(t.bought)),
          laps: esc(x.laps),
          late: esc(x.lateLaps || 0),
          best: esc(RaceEngine.fmtTime(x.best)),
          total: esc(RaceEngine.fmtTime(x.total))
        };
        const stCols = Stats.STINT_COLUMNS.filter(c => stintKeys.includes(c.key) && (c.key in STCELL || Stats.hasAny(c.key, figs)));
        const body = `<table class="fields"><tr>${stCols.map(c => `<th>${esc(c.label)}</th>`).join('')}</tr>
        <tr>${stCols.map(c => `<td>${c.key in STCELL ? STCELL[c.key] : esc(Stats.text(c.key, figs[0], Speed.unitOf(state.settings), Speed.distUnitOf(state.settings)))}</td>`).join('')}</tr></table>${stCols.length ? '' : '<p class="muted">No columns are on. Turn some on in View settings.</p>'}${statNote(stCols.map(c => c.key))}
        <p class="muted">${esc(s.endedBy || '')}${t.carried ? ` · ${esc(boughtText(t.carried))} came over from the driver before` : ''}${t.left ? ` · ${esc(boughtText(t.left))} was not used` : ''}</p>
        <h4>${supplied ? 'Lap times on this page' : 'All lap times'}</h4><p><span class="muted">${
          mine
            .map(l => {
              const tx = esc(`${l.lapNumber}: ${RaceEngine.fmtTime(l.time)}`);
              return l.late || l.invalid || l.tooSlow
                ? `<s class="lapbad" title="${l.late ? 'Late lap: driven after the time was up' : l.invalid ? 'Invalid lap' : 'Too slow: not counted for records'}">${tx}</s>`
                : tx;
            })
            .join(' · ') || 'no laps'
        }</span></p>
        <div class="row">${pdfButton(`data-pdf="${esc(s.id)}"`)}${shareButtons(s.id)}${s.readOnly ? '' : `<button class="btn danger" data-delsession="${esc(s.id)}">Delete this stint</button>`}<span class="muted" id="pdfmsg-${esc(s.id)}" role="status"></span></div>`;
        return `<details class="card sess" data-sid="${esc(s.id)}"><summary>${sumHead(s, { name: x.driverName || 'Guest', line: `Lane ${t.lane} · ${boughtText(t.bought)} · ${x.laps} ${Number(x.laps) === 1 ? 'lap' : 'laps'} · ${s.trackName || ''}` })}</summary><div class="sessbody">${body}</div></details>`;
      }
      const pts = s.resultBy === 'points';
      const fin = Stats.heated(s) && !!s.finals,
        finArg = { finalMode: fin ? s.finals.finalMode : 'places', byPoints: pts, unit: Speed.distUnitOf(state.settings) };
      const figs =
          supplied?.detail?.figures ||
          Stats.forSession(
            s,
            laps.filter(l => l.sessionId === s.id),
            tracks,
            cars
          ),
        shownKeys = ViewSet.keys(Stats.SESSION_COLUMNS, viewSaved(['results', 'sessions']));
      const cols = Stats.sessionColumns(s, figs).filter(c => shownKeys.includes(c.key));
      const cup = Icons.trophy({ size: 16 }),
        hasDriver = cols.some(c => c.key === 'driver'); // (the winner's cup goes next to the name; without the Driver column next to the position)
      const cellOf = (key, x, i) => {
        switch (key) {
          case 'pos':
            return esc(x.pos) + (!hasDriver && Stats.isWinner(s, x) ? ' ' + cup : '');
          case 'driver':
            return (
              (Stats.isWinner(s, x) ? cup + ' ' : '') +
              esc(x.driverName) +
              (Stats.outText(x) ? ` <span class="muted">(${Stats.outText(x)})</span>` : '') +
              (Stats.adjustedText(x) ? ` <span class="muted">(adjusted: ${esc(Stats.adjustedText(x))})</span>` : '') +
              (Stats.notesText(x) ? ` <span class="muted">(${esc(Stats.notesText(x))})</span>` : '') +
              (Stats.driversText(x, dUnit()) ? ` <span class="muted">(drivers: ${esc(Stats.driversText(x, dUnit()))})</span>` : '') +
              (Stats.enduranceText(x, dUnit()) ? ` <span class="muted">(${esc(Stats.enduranceText(x, dUnit()))})</span>` : '')
            );
          case 'team':
            return esc(x.teamName || '');
          case 'car':
            return esc(x.carName || (typeof SwapSeats !== 'undefined' ? SwapSeats.drivenText(s, x.participant) : ''));
          case 'laps':
            return esc(x.laps) + (Stats.sectorText(x) ? ` <span class="muted">+ ${esc(Stats.sectorText(x))}</span>` : '');
          case 'points':
            return esc(x.points);
          case 'result':
            return esc(Heats.scoreText(x, s.scoring, finArg));
          case 'final':
            return esc(Heats.finalCell(x));
          case 'best':
            return esc(RaceEngine.fmtTime(x.best));
          case 'total':
            return (
              esc(RaceEngine.fmtTime(typeof x.total === 'number' ? x.total + (x.penalty || 0) + (x.adjMs || 0) : null)) +
              (x.penalty
                ? x.penaltyPoints != null
                  ? ` <span class="muted">(includes +${esc(RaceEngine.fmtTime(x.penalty))} penalty, ${esc(x.penaltyPoints)} points)</span>`
                  : ` <span class="muted">(includes +${esc(RaceEngine.fmtTime(x.penalty))} added time)</span>`
                : '')
            ); // (2.2.5: time added without a penalty system has no points)
          default:
            return esc(Stats.text(key, figs[i], Speed.unitOf(state.settings), Speed.distUnitOf(state.settings)));
        }
      };
      // (2.4.0, SlotForgeRestyle.md "Race Report") an opened race: the actions on top, the podium, the classification, the notes, the heats, and the lap
      // times as a table (a row per lap, a column per driver) instead of lines of text
      const notes = [
        Stats.heated(s) && s.scoring && Heats.scoringText(s.scoring, pts) ? Heats.scoringText(s.scoring, pts) : '',
        fin ? Heats.finalsSaid(s.finals) : '',
        Stats.weatherText(s),
        Stats.resumeText(s),
        Stats.compareText(s)
      ].filter(Boolean);
      // (2.4.0, SlotForgeRestyle.md "Finalize Review") what was changed before saving (the director's final check) and after it (Correct), in one block
      const checkedLines = Stats.checkedLines(s),
        corrected = typeof RecordBook !== 'undefined' ? RecordBook.correctionText(s) : '';
      const checkedBlock =
        checkedLines.length || corrected
          ? `<div class="rr-checked">${checkedLines.length ? `<span class="k">Changed before saving · director's final check</span>${checkedLines.map(l => `<p>${esc(l)}</p>`).join('')}` : ''}${corrected ? `<span class="k">Corrected after saving</span><p>${esc(corrected)}</p>` : ''}</div>`
          : '';
      const podium =
        Stats.WINNER_TYPES.includes(s.sessionType) && s.standings.length > 1
          ? `<div class="rr-podium">${s.standings
              .filter(x => Number(x.pos) >= 1 && Number(x.pos) <= 3)
              .slice(0, 3)
              .map(
                x =>
                  `<div class="rr-p rr-p${esc(x.pos)}"><span class="rr-pl">${esc(x.pos)}</span><span class="rr-pw"><b>${esc(x.driverName)}</b><small>${esc(x.carName || '')}</small></span><span class="rr-pf"><b>${esc(x.laps)} ${Number(x.laps) === 1 ? 'lap' : 'laps'}</b><small>${esc(RaceEngine.fmtTime(typeof x.total === 'number' ? x.total + (x.penalty || 0) + (x.adjMs || 0) : null))}${x.best ? ' · best ' + esc(RaceEngine.fmtTime(x.best)) : ''}</small></span></div>`
              )
              .join('')}</div>`
          : '';
      const lapKey = l => `${l.heat ? (l.final ? 'F' + l.final : 'H' + l.heat) + ' ' : ''}${l.lapNumber}`;
      const per = s.standings.map(x =>
          Stats.ownLaps(x, laps)
            .filter(l => l.sessionId === s.id)
            .sort((a, b) => (a.heat || 0) - (b.heat || 0) || a.lapNumber - b.lapNumber)
        ),
        rowsOf = [],
        seenRow = new Set();
      per.forEach(list =>
        list.forEach(l => {
          const k = lapKey(l);
          if (!seenRow.has(k)) {
            seenRow.add(k);
            rowsOf.push({ k, h: l.heat || 0, n: l.lapNumber });
          }
        })
      );
      rowsOf.sort((a, b) => a.h - b.h || a.n - b.n);
      const byKey = per.map(list => new Map(list.map(l => [lapKey(l), l]))),
        bestOf = per.map(list => {
          const ok = list.filter(l => !l.invalid && !l.tooSlow && !l.pit && Number(l.time) > 0);
          return ok.length ? Math.min(...ok.map(l => l.time)) : null;
        });
      const lapCell = (l, i) => {
        if (!l) return '<td class="rr-none">–</td>';
        const t = esc(RaceEngine.fmtTime(l.time));
        if (l.invalid || l.tooSlow)
          return `<td><s class="lapbad" title="${l.invalid ? 'Invalid lap' : 'Too slow: not counted for records'}">${t}</s></td>`;
        if (l.pit) return `<td><em title="Lap with a pit stop">${t}</em></td>`;
        return bestOf[i] === l.time
          ? `<td class="rr-best" title="Best lap of ${esc(s.standings[i].driverName)}"><b>${t}</b></td>`
          : `<td>${t}</td>`;
      };
      const lapTable = rowsOf.length
        ? `<div class="rr-lapwrap"><table class="rr-laps"><thead><tr><th>Lap</th>${s.standings.map(x => `<th>${esc(x.driverName)}</th>`).join('')}</tr></thead><tbody>${rowsOf
            .map(r => `<tr><td class="rr-n">${esc(r.k)}</td>${byKey.map((m, i) => lapCell(m.get(r.k), i)).join('')}</tr>`)
            .join(
              ''
            )}</tbody></table></div><p class="rr-legend"><span class="rr-lg-best">Best lap of a driver</span><span class="rr-lg-pit">Pit stop</span><span class="rr-lg-bad">Invalid or too slow</span></p>`
        : '<p class="muted">No laps</p>';
      const actions = `<div class="rr-actions">${pdfButton(`data-pdf="${esc(s.id)}"`)}${shareButtons(s.id)}${typeof RecordBook !== 'undefined' && RecordBook.canCorrect(s) && typeof rbCorrect === 'function' ? `<button class="btn" data-correct="${esc(s.id)}">Correct the result…</button>` : ''}${!s.readOnly && api.paddockHistoricalReview ? `<button class="btn" data-historical-session="${esc(s.id)}">Historical Review…</button>` : ''}${s.readOnly ? '' : `<button class="btn danger" data-delsession="${esc(s.id)}">Delete this session</button>`}<span class="muted" id="pdfmsg-${esc(s.id)}" role="status"></span></div>`;
      const body =
        actions +
        (!s.readOnly && s.champ && typeof s.champ === 'object' && s.champ.id
          ? `<div class="chpanelbox" data-cpbox="${esc(s.id)}"></div>`
          : '') +
        podium +
        (s.virtualRivals?.length ? '<h4>Physical-field standings</h4>' : '') +
        `<div class="rr-classwrap"><table class="fields rr-class"><tr>${cols.map(c => `<th>${esc(c.label)}</th>`).join('')}</tr>` +
        s.standings.map((x, i) => `<tr>${cols.map(c => `<td>${cellOf(c.key, x, i)}</td>`).join('')}</tr>`).join('') +
        '</table></div>' +
        (s.soloTable && typeof Solo !== 'undefined'
          ? '<h4>By lane and car</h4>' +
            Solo.tableHtml(s.soloTable, esc, ms => RaceEngine.fmtTime(ms), ((s.standings[0] || {}).driverName || 'All') + ', all laps')
          : '') + // (2.5.2 Solo)
        (cols.length ? '' : '<p class="muted">No columns are on for this session. Turn some on in View settings.</p>') +
        (typeof resourceHistoryHtml === 'function' ? resourceHistoryHtml(s) : '') +
        (typeof VirtualRival !== 'undefined' ? VirtualRival.historyHtml(s) : '') +
        (typeof MultiClass !== 'undefined' ? MultiClass.resultsHtml(s.classStandings || [], s.multiclass) : '') +
        statNote(cols.map(c => c.key)) +
        (notes.length ? `<div class="rr-notes">${notes.map(n => `<p class="muted">${esc(n)}</p>`).join('')}</div>` : '') +
        checkedBlock +
        (Stats.stintLines(s, dUnit()).length
          ? '<h4>Driver swaps</h4>' +
            Stats.stintLines(s, dUnit())
              .map(
                g =>
                  `<p><strong>${esc(g.team)}</strong><br><span class="muted">${g.stints.map(q => `${esc(q.n)}. ${esc(q.text)}`).join(' · ')}</span></p>`
              )
              .join('')
          : '') +
        (s.heatResults
          ? `<h4>${s.finals ? 'Heats and finals' : 'Heats'}</h4><div class="rr-heats">` +
            s.heatResults
              .map(
                h =>
                  `<div class="rr-heat"><strong>${esc(Heats.raceName(h))}${h.checked && h.checked.reruns ? ` <span class="rr-tag">${h.checked.reruns === 1 ? 'Run twice' : 'Run ' + (h.checked.reruns + 1) + ' times'}</span>` : ''}${h.checked && (h.checked.changes || []).length ? ` <span class="rr-tag">${h.checked.changes.length} ${h.checked.changes.length === 1 ? 'change' : 'changes'}</span>` : ''}</strong>${Stats.weatherText(h) ? ` <span class="muted">· ${esc(Stats.weatherText(h))}</span>` : ''}<ol>${h.rows.map(r => `<li>${esc(r.pos)}. ${Stats.isHeatWinner(s, r) ? cup + ' ' : ''}${esc(r.driverName)}${r.carName && s.laneCars ? ' in ' + esc(r.carName) : ''} (${esc(r.laps)} laps${Stats.sectorText(r) ? ' + ' + esc(Stats.sectorText(r)) : ''}${esc(Stats.heatTimeText(s, r))}${pts ? ', ' + esc(r.points) + ' pts' + (r.bonus ? ' incl. ' + esc(r.bonus) + ' for the fastest lap' : '') : ''}${Stats.adjustedText(r) ? ', adjusted: ' + esc(Stats.adjustedText(r)) : ''}${Stats.notesText(r) ? ', ' + esc(Stats.notesText(r)) : ''})</li>`).join('')}</ol></div>`
              )
              .join('') +
            '</div>' +
            (typeof SwapSeats !== 'undefined' && SwapSeats.cars(s).length
              ? '<h4>Lane cars</h4>' +
                SwapSeats.carsTable(s, esc, ms => RaceEngine.fmtTime(ms)).replace(
                  '<table class="ss-cars">',
                  '<table class="fields ss-cars">'
                )
              : '')
          : '') +
        tyreStintsSection(s) +
        `<h4 class="rr-laphead">${supplied ? 'Lap times on this page' : 'All lap times'}</h4>` +
        lapTable;
      const champTags =
        s.champ && typeof s.champ === 'object'
          ? ` <span class="chtag" title="This race is part of a championship">${esc(Champ.tagText(s.champ))}</span>${Champ.awardText(s.champ) ? ` <span class="chaward${s.champ.awarded && !s.champ.off ? ' done' : ''}">${esc(Champ.awardText(s.champ))}</span>` : ''}`
          : '';
      return `<details class="card sess" data-sid="${esc(s.id)}"><summary>${sumHead(s)}${champTags}${headline(s, win, cup)}</summary><div class="sessbody">${body}</div></details>`;
    })
    .join('');
  const RES_FOLDERS = ['tracks', 'pb', 'sessions'];
  const sessCols = tokenPool ? Stats.STINT_COLUMNS : Stats.SESSION_COLUMNS,
    sessPath = ['results', tokenPool ? 'stints' : 'sessions'];
  const colsOf = path => (path === 'results/records' ? Stats.RECORD_COLUMNS : path === sessPath.join('/') ? sessCols : null);
  const bar = !viewBars.has('results')
    ? ''
    : viewBar(
        'results',
        'Turn columns on or off. This changes the tables on this page and is remembered. A column that has nothing to show for a session is left out of its table.',
        [
          viewGroup('Track records and personal bests', ['results', 'records'], Stats.RECORD_COLUMNS),
          viewGroup(tokenPool ? 'Stints' : 'Sessions', sessPath, sessCols)
        ]
      );
  if (state.focusSession && !tokenPool) folderClosed.delete(folderKey(folderPage, 'sessions')); // (1.25.0: a race clicked on Home opens here: its folder is open)
  const pageNote = supplied ? ' on this page' : '';
  if (supplied && supplied.only)
    box.innerHTML = sessionCards; // (2.4.0: a race opened from the Record Book: only its report)
  else
    box.innerHTML =
      folderToolsWith(viewButton('results')) +
      bar +
      folderHtml(
        folderPage,
        'tracks',
        'Track records',
        plural(trackRecords.length, 'record', 'records') + pageNote,
        recTable(trackRecords, 'track')
      ) +
      folderHtml(
        folderPage,
        'pb',
        'Personal bests',
        plural(personal.length, 'personal best', 'personal bests') + pageNote,
        recTable(personal, 'pb')
      ) +
      folderHtml(
        folderPage,
        'sessions',
        tokenPool ? 'Stints' : 'Sessions',
        (tokenPool ? plural(sessions.length, 'stint', 'stints') : plural(sessions.length, 'session', 'sessions')) + pageNote,
        sessionCards
      );
  folderWire(box);
  if (!tokenPool && String(box.innerHTML).includes('data-cpbox'))
    champPanelsIn(box, async s => {
      state.focusSession = s.id;
      await reload();
    }); // (1.56.0: the points of a race of a championship, and what to do with them)
  if (state.focusSession && !tokenPool) {
    // the race that was clicked on Home: its card is open and in view
    const id = state.focusSession;
    state.focusSession = null;
    const d = [...box.querySelectorAll('details.sess')].find(x => x.dataset && x.dataset.sid === id);
    if (d) {
      d.open = true;
      if (d.scrollIntoView) d.scrollIntoView({ block: 'center' });
    }
  }
  box.onclick = async ev => {
    const fa = ev.target.closest('[data-folderall]');
    if (fa) {
      folderAll(folderPage, RES_FOLDERS, fa.dataset.folderall === '1');
      return reload();
    }
    const vb = ev.target.closest('[data-viewbar]');
    if (vb) {
      if (viewBars.has(vb.dataset.viewbar)) viewBars.delete(vb.dataset.viewbar);
      else viewBars.add(vb.dataset.viewbar);
      return reload();
    }
    const vr = ev.target.closest('[data-vsreset]');
    if (vr) {
      await viewReset([['results', 'records'], sessPath]);
      return reload();
    }
    const corr = ev.target.closest('[data-correct]');
    if (corr) return rbCorrect(corr.dataset.correct, reload);
    const historical = ev.target.closest('[data-historical-session]');
    if (historical && typeof PaddockHistorical !== 'undefined') {
      await PaddockHistorical.open(api, historical.dataset.historicalSession);
      return;
    }
    // the whole session (with the shared library or a big database it is read in full first) -> { s, mine, pdfTracks, pdfCars } or null (said in msg)
    // (without a page to load from, the answer is there at once: the PDF choices open in the same click)
    const fullSession = (id, msg) => {
      const s = sessions.find(x => x.id === id);
      if (!supplied) return { s, mine: laps.filter(l => l.sessionId === s.id), pdfTracks: tracks, pdfCars: cars };
      return (async () => {
        try {
          const full = await api.historySession(pool, s.id, { revision: supplied.page.revision, exportAll: true });
          if (!full) throw Error('Session no longer available.');
          return { s: full.session, mine: full.laps, pdfTracks: full.refs.tracks, pdfCars: full.refs.slotcars };
        } catch (error) {
          msg.textContent = 'Could not load the complete session: ' + error.message;
          return null;
        }
      })();
    };
    const sh = ev.target.closest('[data-share]');
    if (sh) {
      const msg = byId('pdfmsg-' + sh.dataset.sid),
        got = await fullSession(sh.dataset.sid, msg);
      if (!got) return;
      const o = {
        session: got.s,
        laps: got.mine,
        tracks: got.pdfTracks,
        cars: got.pdfCars,
        unit: Speed.unitOf(state.settings),
        distUnit: Speed.distUnitOf(state.settings)
      };
      try {
        if (sh.dataset.share === 'text') {
          await navigator.clipboard.writeText(Report.sessionText(o));
          msg.textContent = 'Copied: paste it in a chat or a message.';
          return;
        }
        const csv = sh.dataset.share === 'csv',
          res = await api.shareSave(
            csv ? Report.sessionCsv(o) : Report.sessionHtml({ ...o, options: { tyreWorn: state.settings.tyreWornRed === true } }),
            Report.shareName(got.s, csv ? 'csv' : 'html'),
            csv ? 'csv' : 'html'
          );
        msg.textContent = res.saved ? 'Saved to ' + res.path : 'Not saved.';
      } catch (x) {
        msg.textContent = 'Could not share the results: ' + x.message;
      }
      return;
    }
    const p = ev.target.closest('[data-pdf]');
    if (p) {
      const msg = byId('pdfmsg-' + p.dataset.pdf),
        got = supplied ? await fullSession(p.dataset.pdf, msg) : fullSession(p.dataset.pdf, msg);
      if (!got) return;
      const { s, mine, pdfTracks, pdfCars } = got;
      const options = await pdfChoice(s, Stats.forSession(s, mine, pdfTracks, pdfCars));
      if (!options) return;
      msg.textContent = 'Making the PDF...';
      try {
        const res = await api.exportPdf(
          Report.sessionHtml({
            session: s,
            laps: mine,
            tracks: pdfTracks,
            cars: pdfCars,
            options: { ...options, tyreWorn: state.settings.tyreWornRed === true },
            unit: Speed.unitOf(state.settings),
            distUnit: Speed.distUnitOf(state.settings)
          }),
          Report.fileName(s)
        );
        msg.textContent = res.saved ? 'Saved to ' + res.path : 'Export cancelled.';
      } catch (x) {
        msg.textContent = 'Could not make the PDF: ' + x.message;
      }
      return;
    }
    const rec = ev.target.closest('[data-delrec]');
    if (rec) {
      const isTrack = rec.dataset.delrec === 'track';
      if (
        await Dialog.confirm(
          `Remove this ${isTrack ? 'track record' : 'personal best'}?\n\nOnly the record is removed. The lap stays in its session, and the next fastest lap takes over.`,
          { ok: isTrack ? 'Remove the track record' : 'Remove the personal best', danger: true }
        )
      ) {
        await api.update('laps', rec.dataset.lap, isTrack ? { noTrackRecord: true } : { noPersonalBest: true });
        reload();
      }
      return;
    }
    const b = ev.target.closest('[data-delsession]');
    if (!b) return;
    if (
      await Dialog.confirm(
        tokenPool
          ? "Delete this stint and all of its laps?\n\nThis can't be undone."
          : "Delete this session and all of its laps?\n\nThis can't be undone.",
        { ok: tokenPool ? 'Delete the stint' : 'Delete the session', danger: true }
      )
    ) {
      await api.removeSession(b.dataset.delsession);
      reload();
    }
  };
  box.onchange = async ev => {
    // a check box of the View settings bar
    const cb = ev.target;
    if (cb && cb.dataset && (cb.dataset.tyshow !== undefined || cb.dataset.tyworn !== undefined)) {
      // the tyre stints: shown or not, and the laps on worn out tyres in red (kept for every session)
      const id = cb.dataset.tyshow !== undefined ? cb.dataset.tyshow : cb.dataset.tyworn;
      try {
        state.settings = await api.setSettings(
          cb.dataset.tyshow !== undefined ? { tyreStints: !!cb.checked } : { tyreWornRed: !!cb.checked }
        );
      } catch {
        /* the choice is only a look */
      }
      state.focusSession = id;
      return reload(); // (the race stays open where it was)
    }
    if (await viewToggle(cb, colsOf)) {
      await reload();
      viewFocus(box, cb);
    }
  };
}
