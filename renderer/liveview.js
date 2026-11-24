// The Live Race pages: a landing page of tiles and read-only pages that follow the running race.
// They run in the main window (Live Race tab) and in the second-screen window, fed by liveshare.js.
const LiveView = (() => {
  const TILES = [
    ['timing', 'Race timing', 'Your timing page, live'],
    ['board', 'Leaderboard', 'Positions, laps, best laps and gaps'],
    ['results', 'Race results', 'Final classification and race statistics'],
    ['driver', 'Driver stats', 'Everything about one driver'],
    ['database', 'Database', 'Tracks, drivers, cars and results (read only)'],
    ['rules', 'Racing rules', 'The rules for this club'],
    ['director', 'Race Director', 'Start, pause, flags, stop and penalty points'],
    ['tokens', 'Tokens', 'Add time to the lanes (Time Token Session)']
  ];
  // The pages that change the race (the others only show it). They get a look of their own: a tinted tile with a "Control" badge, and a tinted header on the page.
  const CONTROLS = ['director', 'tokens'];
  const isControl = id => CONTROLS.includes(id);
  const BADGE = '<span class="lv-badge">Control</span>';
  // the line pictures of the tiles live in icons.js (the tabs along the top use the same ones)
  const icon = id => (id === 'results' ? Icons.trophy({ size: 40 }) : Icons.svg(id, { size: 40, cls: 'lv-ico' }));
  const PHASE = {
    ready: 'Ready to start',
    countdown: 'Lights',
    running: 'Racing',
    paused: 'Paused',
    between: 'Heat finished',
    finished: 'Finished',
    review: 'Race review'
  };
  let keyOff = null,
    host = null,
    V = null,
    page = 'tiles',
    nodes = null,
    tkPanel = null,
    bopPanel = null,
    wxPanel = null,
    tyPanel = null,
    psPanel = null,
    enPanel = null,
    pitPanel = null,
    systemPanel = null,
    dmPanel = null,
    flPanel = null,
    lane = null,
    ticker = null,
    offs = [],
    second = false,
    lapsHtml = '',
    lapsSig = '',
    dirLogHtml = '',
    resultsFollowed = '',
    followedFrom = null, // (2.4.0 review: the page the second screen showed before it followed the results)
    homeTimer = null, // (2.5.0: the second screen's Home is drawn again a moment after the race computer's Home changed)
    mountN = 0; // (2.4.0 review: counts mount and unmount, so a mount that waits knows it is still the one)

  const $ = id => document.getElementById(id);
  const live = () => !!V && V.hasRace();
  const S = () => V.shared(performance.now());

  // ---- the frame around every page ----
  function shell() {
    if (page === 'home') {
      // (2.5.0) the second screen before a race: the Home page of the race computer for the audience; the two buttons show when the mouse moves
      host.innerHTML = `<div class="lv-head lv-homehead"><span class="lv-sr" id="lv-status" role="status"></span><span style="flex:1"></span><button class="btn" id="lv-pages">Live Race pages</button><button class="btn" id="lv-full">Full screen</button></div><div id="lv-body" class="lv-body lv-home"></div>`;
      $('lv-pages').onclick = () => go('tiles');
      $('lv-full').onclick = async () => {
        const on = await api.liveFullscreen();
        $('lv-full').textContent = on ? 'Exit full screen' : 'Full screen';
      };
      status();
      return;
    }
    const tile = TILES.find(t => t[0] === page);
    host.innerHTML = `<div class="lv-head${isControl(page) ? ' special' : ''}">${page === 'tiles' ? '<h2 style="margin:0">Live Race</h2>' : `<button class="btn" id="lv-back">‹ Live Race</button><div class="lv-titles"><strong class="lv-title">${esc(tile[1])}${isControl(page) ? BADGE : ''}</strong><span class="lv-sr" id="lv-status" role="status"></span><span class="muted lv-stline" id="lv-stline" aria-hidden="true"></span></div>`}
      ${page === 'tiles' ? '<span class="muted" id="lv-status" role="status"></span>' : ''}<span style="flex:1"></span>
      ${second ? '<button class="btn" id="lv-full">Full screen</button>' : '<button class="btn" id="lv-open">Open on a second screen</button>'}</div><div id="lv-body" class="lv-body"></div>`;
    if ($('lv-back')) $('lv-back').onclick = () => go('tiles');
    if ($('lv-full'))
      $('lv-full').onclick = async () => {
        const on = await api.liveFullscreen();
        $('lv-full').textContent = on ? 'Exit full screen' : 'Full screen';
      };
    if ($('lv-open'))
      $('lv-open').onclick = async () => {
        const r = await api.liveOpen();
        $('lv-status').textContent =
          r && r.second ? 'Opened on your second screen.' : 'Opened. Only one screen was found, so drag the window where you want it.';
        if ($('lv-stline')) {
          $('lv-stline').textContent = $('lv-status').textContent;
          $('lv-stline').dataset.k = '';
        }
      };
    status();
  }
  // the ON AIR panel of the landing page: off air, or the race with its phase, clock, lap and leader
  const mmss = ms => {
    const t = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
    return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
  };
  function air() {
    const el = $('lv-air');
    if (!el) return;
    if (!live()) {
      if (el.dataset.k === 'off') return;
      el.dataset.k = 'off';
      el.className = 'lv-air';
      el.innerHTML =
        '<span class="lv-airtag">Off air</span><div class="lv-airtext" aria-live="polite"><strong>No race is running</strong><span class="muted">The pages below fill in as soon as a race starts on the race computer.</span></div>';
      return;
    }
    const d = V.dyn(),
      st = V.stat();
    let facts = '';
    try {
      const eng = V.engine(),
        now = V.clock(performance.now()),
        top = eng.standings()[0],
        len = Number(eng.lapLimit) > 0 ? Number(eng.lapLimit) : 0; // (the engine's own, as on the race screen)
      facts =
        `<span class="lv-airfact"><small>Clock</small><b class="mono">${mmss(eng.elapsed(now))}</b></span>` +
        (top && top.car
          ? `<span class="lv-airfact"><small>${len ? 'Lap' : 'Laps'}</small><b class="mono">${len ? Math.min(len, eng.lapsOf(top.car) + 1) + ' / ' + len : eng.lapsOf(top.car)}</b></span><span class="lv-airfact lv-airlead" style="--c:${esc(HomeStats.laneColor(st.layout, top.car.lane))}"><small>Leader</small><b><i>${top.car.lane + 1}</i>${esc(top.car.teamName || top.car.driverName || '')}</b></span>`
          : '');
    } catch {
      facts = '';
    }
    // (2.4.0: the race and its phase are told to a screen reader when they change; the clock and the lap only change on the screen)
    const k = 'on|' + (st.title || '') + '|' + d.phase;
    if (el.dataset.k !== k) {
      el.dataset.k = k;
      el.className = 'lv-air on';
      el.innerHTML = `<span class="lv-airtag"><i aria-hidden="true"></i>On air</span><div class="lv-airtext" aria-live="polite"><strong>${esc(st.title || 'Race')}</strong><span class="lv-airphase">${esc(PHASE[d.phase] || '')}</span></div><div class="lv-airfacts"></div>`;
    }
    const box = el.querySelector('.lv-airfacts');
    if (box && box.innerHTML !== facts) box.innerHTML = facts;
  }
  function status() {
    air();
    const el = $('lv-status');
    if (!el) return;
    const d = live() ? V.dyn() : null,
      left = d && d.phase === 'between' && d.heat && d.heat.breakLeft > 0 ? Heats.clock(d.heat.breakLeft) : '';
    el.textContent = live()
      ? `${V.stat().title} · ${PHASE[d.phase] || ''}${left ? ` · next ${d.heat.final ? 'final ' + d.heat.final : 'heat'} in ` + left : ''}`
      : 'No race is running.';
    // (2.4.0, SlotForgeRestyle.md "Live Pages") what the eye reads: the race, and its phase as a pill (the words above are for a screen reader)
    const line = $('lv-stline');
    if (!line) return;
    const k = live()
        ? [
            V.stat().title,
            d.phase,
            PHASE[d.phase] || '',
            left ? ` · next ${d.heat.final ? 'final ' + d.heat.final : 'heat'} in ` + left : ''
          ]
        : null,
      key = JSON.stringify(k);
    if (line.dataset.k === key) return;
    line.dataset.k = key;
    line.innerHTML = k
      ? `<span class="lv-st-t">${esc(k[0])}</span><span class="lv-st-ph" data-phase="${esc(k[1])}">${esc(k[2])}${esc(k[3])}</span>`
      : '<span class="lv-st-t">No race is running</span>';
  }

  function go(p) {
    boardHighlights.forEach(n => LapHighlights.dispose(n));
    boardHighlights = [];
    page = p;
    followedFrom = null; // (2.4.0 review: a page that is picked is kept; followResults sets it again after its own go)
    dgOpen = false;
    dgSel = '';
    LiveCanvas.dispose(nodes);
    nodes = null;
    tkPanel = null;
    bopPanel = null;
    wxPanel = null;
    tyPanel = null;
    psPanel = null;
    enPanel = null;
    pitPanel = null;
    systemPanel = null;
    dmPanel = null;
    flPanel = null;
    adjPanel = null;
    if (cardsPanel) cardsPanel.off();
    cardsPanel = null;
    shell();
    draw(true);
  }

  // (2.5.0) the second screen's Home: the race computer's Home page, read-only (landing.js renderHome with into); a window without it shows the Live Race pages
  function drawHome(body) {
    if (typeof renderHome !== 'function') return go('tiles');
    // (the settings of the race computer first: the setup, the drivers and cars in the lanes, the cards)
    Promise.resolve(api.getSettings ? api.getSettings() : null)
      .then(st => {
        if (st) state.settings = st;
        if (page === 'home' && body.isConnected) return renderHome({ into: body });
      })
      .catch(() => {});
  }
  const homeAgain = () => {
    clearTimeout(homeTimer);
    homeTimer = setTimeout(() => {
      if (page === 'home' && $('lv-body')) drawHome($('lv-body'));
    }, 500);
  };

  // ---- the pages ----
  function draw(fresh) {
    const body = $('lv-body');
    if (!body) return;
    const timingResults = page === 'timing' && live() && ['review', 'finished'].includes(V.dyn().phase);
    setClean((page === 'timing' && live() && !timingResults) || page === 'home');
    if (page === 'home') {
      if (fresh) drawHome(body);
      return;
    }
    if (page === 'tiles') {
      // Live Desk (2.4.0): the ON AIR panel on top, then the pages that follow the race and the ones that run it, each as its own group
      const tile = ([id, name, d]) =>
        `<button class="lv-tile${isControl(id) ? ' special' : ''}" data-go="${id}">${isControl(id) ? BADGE : ''}${icon(id)}<strong>${esc(name)}</strong><span class="muted">${esc(d)}</span><i class="lv-go" aria-hidden="true"></i></button>`;
      body.innerHTML = `<div class="lv-desk"><section class="lv-air" id="lv-air"></section>
        <section class="lv-group"><h3 class="lv-gh">Follow the race<small>These pages only show the race</small></h3><div class="lv-tiles">${TILES.filter(
          t => !isControl(t[0])
        )
          .map(tile)
          .join('')}</div></section>
        <section class="lv-group lv-run"><h3 class="lv-gh">Run the race<small>These pages change the race</small></h3><div class="lv-tiles">${TILES.filter(
          t => isControl(t[0])
        )
          .map(tile)
          .join('')}</div></section></div>`;
      air();
      body.onclick = e => {
        const b = e.target.closest('[data-go]');
        if (b && !b.disabled) go(b.dataset.go);
      };
      return;
    }
    if (page === 'rules') {
      body.innerHTML = `<div class="lv-rules">${RichText.text(state.settings.rules) ? RichText.clean(state.settings.rules) : '<span class="muted">No racing rules written yet. Add them under Racing Rules.</span>'}</div>`;
      return;
    }
    if (page === 'database') {
      if (fresh) {
        body.innerHTML = '';
        body.classList.add('ro');
        renderDatabase(body);
      }
      return;
    }
    body.classList.remove('ro');
    if ((page === 'director' || page === 'tokens') && api.web && !api.directorAuthed()) return drawLogin(body, fresh); // log in first, race or not (one password for both pages)
    if (!live()) {
      body.innerHTML = '<p class="muted lv-empty">No race is running. This page fills in as soon as a race starts.</p>';
      LiveCanvas.dispose(nodes);
      nodes = null;
      return;
    }
    if (page === 'timing') return drawTiming(body, fresh);
    if (page === 'board') return drawBoard(body, fresh);
    if (page === 'results') return drawResults(body);
    if (page === 'driver') return drawDriver(body, fresh);
    if (page === 'director') return drawDirector(body, fresh);
    if (page === 'tokens') return drawTokens(body, fresh);
  }

  // Results are the default destination of the dedicated second screen once a
  // heat or race ends.  A new heat has a new race id, so it gets its own reveal.
  function followResults() {
    if (!second || !live()) return false;
    const d = V.dyn(),
      key = V.stat().raceId;
    // (2.4.0 review) the next heat starts: back to the page that was shown before the results were followed
    if (followedFrom !== null && page === 'results' && ['countdown', 'running'].includes(d.phase)) {
      const back = followedFrom;
      followedFrom = null;
      go(back);
      return true;
    }
    if (!(['review', 'finished'].includes(d.phase) || (d.phase === 'between' && afterOn(d))) || resultsFollowed === key) return false; // (2.4.0: and the break between two heats, on the broadcast screen)
    resultsFollowed = key;
    const from = followedFrom !== null ? followedFrom : page;
    go('results');
    followedFrom = from === 'results' ? null : from;
    return true;
  }

  // (2.4.0, SlotForgeRestyle.md "Chequered Flag") after a race and in a break between heats: the broadcast screen the race window sends (raceover.js),
  // made for 1920 px and zoomed to this window, one screen without scrolling; Customization › Race Results can keep the Results Wall instead
  function drawAfter(body, d) {
    if (body.dataset.tvk !== d.after.key) {
      body.dataset.tvk = d.after.key;
      body.classList.add('ro-tvbody');
      body.innerHTML = d.after.html;
    }
    fitAfter(body);
    const left = body.querySelector('[data-tv-left]');
    if (left) {
      const s = d.phase === 'between' && d.heat && d.heat.breakLeft > 0 ? Heats.clock(d.heat.breakLeft) : '';
      left.hidden = !s;
      if (s && left.querySelector('b')) left.querySelector('b').textContent = s;
    }
  }
  // the screen fills the window: drawn for 1920 px, zoomed to the width, as high as what is left under the page bar (again when the window changes size)
  function fitAfter(body) {
    const tv = body && body.querySelector('.ro-tv');
    if (!tv) return;
    if (!fitAfter.on && typeof addEventListener === 'function') {
      fitAfter.on = true;
      addEventListener('resize', () => fitAfter($('lv-body')));
    }
    // (the whole 1920 × 1080 screen is always seen: zoomed to the smaller of the width and the height that is left, and centred)
    const top = body.getBoundingClientRect().top,
      w = body.clientWidth || innerWidth,
      h = Math.max(240, innerHeight - Math.max(0, top) - 8),
      z = Math.max(0.15, Math.min(w / 1920, h / 1080));
    tv.style.transform = `scale(${z})`;
    tv.style.height = '1080px';
    tv.style.marginLeft = Math.max(0, Math.floor((w - 1920 * z) / 2)) + 'px';
    body.style.height = h + 'px';
  }
  const afterOn = d => !!(d && d.after && d.after.html && ResultsView.clean(state.settings.resultsView).after !== 'mine');
  function drawResults(body) {
    const d = V.dyn();
    if (afterOn(d)) return drawAfter(body, d);
    if (body.dataset.tvk) {
      delete body.dataset.tvk;
      body.classList.remove('ro-tvbody');
      body.style.height = '';
    }
    const shared = V.shared(performance.now());
    const components = [];
    const html = ResultsView.html(V.engine(), state.settings.resultsView, {
      components,
      phase: d.phase,
      title: V.stat().title,
      layout: V.stat().layout,
      heat: d.heat,
      heatPoints: d.champ,
      season: d.season,
      shared,
      rowDesigns: V.stat().rowDesigns
    });
    // (2.4.0 review, speed) the table is built again and fitted only when it changed, not on every message and clock tick
    if (body._rvHtml !== html || !body.firstChild || body._rvNode !== body.firstChild) {
      body.innerHTML = html;
      body._rvHtml = html;
      body._rvNode = body.firstChild; // (another page drawn in the same box in between: built again)
      if (body.querySelector('.rrows') && typeof Rows !== 'undefined') Rows.fitText(body);
    }
    WidgetView.updateComponents({ val: body }, { components });
  }

  // On another device (a browser) the Race Director page asks for the password that was set in App Settings > Connections > Race Sharing.
  async function drawLogin(body, fresh) {
    if (!fresh && $('lv-login')) return;
    let info = { passwordSet: true };
    try {
      info = await api.directorInfo();
    } catch {
      /* the host is not reachable: show the form anyway */
    }
    if (!info.passwordSet) {
      body.innerHTML = `<div id="lv-login" class="card"><p>${page === 'tokens' ? 'The Tokens page' : 'The Race Director'} can only be used on the main computer, because no password is set. Set one in App Settings > Connections > Race Sharing.</p></div>`;
      return;
    }
    body.innerHTML = `<form id="lv-login" class="card" style="max-width:360px"><div class="field"><label for="lv-pass">${page === 'tokens' ? 'Password for the Tokens page (the same as for the Race Director)' : 'Password for the Race Director'}</label><input id="lv-pass" type="password" autocomplete="current-password"></div>
      <div class="row"><button class="btn primary" type="submit">Log in</button><span id="lv-loginmsg" class="error" role="alert">${esc((api.pairError && api.pairError()) || '')}</span></div>
      <p class="muted">Quicker: in App Settings > Connections on the timing computer, press <em>Pair a phone</em> and scan the QR code.</p></form>`;
    $('lv-login').onsubmit = async ev => {
      ev.preventDefault();
      try {
        await api.directorLogin($('lv-pass').value);
        draw(true);
      } catch (e) {
        $('lv-loginmsg').textContent =
          e.code === 'wrong'
            ? 'Wrong password.'
            : e.code === 'nopassword'
              ? 'No password is set on the main computer.'
              : 'Could not log in: ' + e.message;
      }
    };
  }

  // The timing page of a running race shows only the widgets of the layout, as large as the window allows: no bar on top, no buttons (the control widgets are left out).
  // At review/finalization it becomes the result wall until a new race arrives. The bar (back, status, full screen) shows when the pointer moves or the screen is touched, and goes away again after a moment.
  function drawTiming(body, fresh) {
    if (['review', 'finished'].includes(V.dyn().phase)) {
      LiveCanvas.dispose(nodes);
      nodes = null;
      return drawResults(body);
    }
    if (!nodes || fresh) {
      LiveCanvas.dispose(nodes);
      body.innerHTML = '<div class="fullview" id="lv-fv"><div class="canvas live" id="lv-canvas"></div></div>';
      nodes = LiveCanvas.build($('lv-canvas'), Widgets.withoutControls(V.stat().layout, V.stat().lanes).layout, V.stat().lanes, {
        maxH: 0,
        imageSets: V.stat().imageSets
      });
    }
    LiveCanvas.paint(nodes, S());
  }
  const setClean = on => {
    if (host && host.classList) {
      if (on) host.classList.add('lv-clean');
      else {
        host.classList.remove('lv-clean');
        host.classList.remove('lv-show');
      }
    }
  };
  let revealT = null;
  const reveal = () => {
    if (!host || !host.classList) return;
    host.classList.add('lv-show');
    clearTimeout(revealT);
    revealT = setTimeout(() => {
      if (host && host.classList) host.classList.remove('lv-show');
    }, 2500);
  };

  // Leaderboard page: a grid of boards (1.11.0). You pick the grid with the little squares (up to 6 columns by 4 rows) and give every cell a leaderboard: a row design from
  // Customization > Leaderboard Editor, the classic table, or nothing. A board can cover more cells (wider, taller) and show only some places (from .. to).
  // The grid is saved for this page, on this device (the setting liveGrid; the old one or two boards are read as a grid until a grid is saved). The rules are in livegrid.js.
  const CLASSIC = '~classic'; // (the value of "Classic table" in the lists; a row design has an id of its own)
  let boardSel = 0,
    boardsOpen = false,
    boardHighlights = [];
  const gridTool = (g, designs, sel) => {
    const G = LiveGrid,
      b = g.boards[sel],
      same = (n, one, many) => `${n} ${n === 1 ? one : many}`;
    const choice = cur =>
      `<option value=""${cur === undefined ? ' selected' : ''}>(empty)</option><option value="${CLASSIC}"${cur === '' ? ' selected' : ''}>Classic table</option>${designs.map(r => `<option value="${esc(r.id)}"${cur === r.id ? ' selected' : ''}>${esc(r.name)}</option>`).join('')}`;
    const squares = Array.from({ length: G.MAXR * G.MAXC }, (_, k) => {
      const c = (k % G.MAXC) + 1,
        r = Math.floor(k / G.MAXC) + 1;
      return `<button type="button" class="lv-gp${c <= g.cols && r <= g.rows ? ' on' : ''}" data-lbgrid="${c},${r}" aria-label="${same(c, 'column', 'columns')} by ${same(r, 'row', 'rows')}" aria-pressed="${c === g.cols && r === g.rows}"></button>`;
    }).join('');
    const map = G.cells(g)
      .map(x =>
        x.board
          ? `<div class="lv-gcell${x.index === sel ? ' sel' : ''}" style="grid-column:${x.c} / span ${x.board.w};grid-row:${x.r} / span ${x.board.h}"><select aria-label="Leaderboard in ${G.where(x.board)}" data-lbcell="${x.index}">${choice(designs.some(r => r.id === x.board.opt.design) ? x.board.opt.design : '')}</select><button type="button" class="btn" data-lbsel="${x.index}" aria-pressed="${x.index === sel}">Board ${x.index + 1} settings</button></div>`
          : `<div class="lv-gcell empty" style="grid-column:${x.c};grid-row:${x.r}"><select aria-label="Leaderboard in column ${x.c}, row ${x.r}" data-lbadd="${x.c},${x.r}">${choice(undefined)}</select></div>`
      )
      .join('');
    let one = '<p class="muted">Pick a leaderboard for a cell to see its settings here.</p>';
    if (b) {
      const o = b.opt,
        ms = G.maxSpan(g, b),
        shown = Widgets.def('leaderboard').options.filter(d => d.classic);
      const countOver = Widgets.def('leaderboard').options.find(d => d.key === 'countOver'); // (1.67.0: count over all heats so far)
      const span = (key, n, max, label) =>
        `<div class="field"><label for="lb-${key}">${label}</label><select id="lb-${key}" data-lbspan="${key}">${Array.from({ length: max }, (_, i) => `<option value="${i + 1}"${n === i + 1 ? ' selected' : ''}>${i + 1}</option>`).join('')}</select></div>`;
      one = `<fieldset class="lv-optset"><legend>Board ${sel + 1} (${G.where(b)})</legend><div class="lv-optgrid">
        ${span('w', b.w, ms.w, 'Columns it covers')}${span('h', b.h, ms.h, 'Rows it covers')}
        <div class="field"><label for="lb-from">From place</label><input id="lb-from" type="number" min="1" max="99" step="1" data-lb="from" value="${esc(o.from || '')}" placeholder="1"></div>
        <div class="field"><label for="lb-to">To place</label><input id="lb-to" type="number" min="0" max="99" step="1" data-lb="to" value="${esc(o.to || '')}" placeholder="last"></div>
        <div class="field"><label for="lb-over">${esc(countOver.label)}</label><select id="lb-over" data-lb="countOver">${countOver.choices.map(([k, t]) => `<option value="${k}"${(o.countOver === 'all' ? 'all' : 'heat') === k ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
        <div class="field"><label for="lb-orderBy">Order by</label><select id="lb-orderBy" data-lb="orderBy">${BoardOrder.CHOICES.map(([k, t]) => `<option value="${k}"${BoardOrder.keyOf(o) === k ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
        ${BoardOrder.isOrdered(o) ? `<div class="field"><label for="lb-orderDir">Best or worst on top</label><select id="lb-orderDir" data-lb="orderDir">${BoardOrder.DIRECTIONS.map(([k, t]) => `<option value="${k}"${BoardOrder.dirOf(o) === k ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div>` : ''}
        ${
          designs.some(r => r.id === o.design)
            ? ''
            : shown
                .map(d =>
                  d.type === 'select'
                    ? `<div class="field"><label for="lb-${d.key}">${esc(d.label)}</label><select id="lb-${d.key}" data-lb="${d.key}">${d.choices.map(([k, t]) => `<option value="${k}"${(o[d.key] ?? d.default) === k ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div>`
                    : `<div class="field"><label class="inline"><input id="lb-${d.key}" type="checkbox" data-lb="${d.key}" ${(o[d.key] ?? d.default) ? 'checked' : ''}> ${esc(d.label)}</label></div>`
                )
                .join('')
        }</div></fieldset>`;
    }
    return `<div class="lv-gridtool"><div class="field"><span class="lbl" id="lb-gridlabel">Grid</span><div class="lv-gridpick" role="group" aria-labelledby="lb-gridlabel">${squares}</div><output id="lb-gridsize">${G.sizeText(g)}</output></div>
      <div class="field"><span class="lbl">Leaderboard in every cell</span><div class="lv-gridmap" style="grid-template-columns:repeat(${g.cols},minmax(0,1fr))">${map}</div></div></div>${one}`;
  };
  function drawBoard(body, fresh, keepOpen) {
    const G = LiveGrid,
      designs = (V.stat() && V.stat().rowDesigns) || [];
    if (fresh || !$('lv-board')) {
      if (!keepOpen) boardsOpen = false;
      const g0 = G.gridOf(state.settings);
      boardSel = Math.min(Math.max(boardSel, 0), Math.max(0, g0.boards.length - 1));
      body.innerHTML = `<details class="lv-opts"${boardsOpen ? ' open' : ''}><summary>Customize</summary>${gridTool(g0, designs, boardSel)}</details><div id="lv-board" class="lv-boards"></div>`;
      const save = async g => {
        state.settings = await api.setSettings({ liveGrid: g });
        boardsOpen = true;
        drawBoard(body, true, true);
      };
      body.onclick = async e => {
        // a square of the grid picker, or the settings of a board
        const b = e.target.closest ? e.target.closest('[data-lbgrid],[data-lbsel]') : null,
          d = (b && b.dataset) || {};
        if (d.lbgrid) {
          const [c, r] = String(d.lbgrid).split(',').map(Number);
          return save(G.resize(G.gridOf(state.settings), c, r));
        }
        if (d.lbsel !== undefined) {
          boardSel = Number(d.lbsel) || 0;
          boardsOpen = true;
          drawBoard(body, true, true);
        }
      };
      body.onchange = async e => {
        const t = e.target,
          d = t.dataset || {},
          g = G.gridOf(state.settings),
          design = v => ({ design: v === CLASSIC ? '' : v });
        if (d.lbadd) {
          // a leaderboard for an empty cell
          const [c, r] = String(d.lbadd).split(',').map(Number);
          if (!t.value) return;
          const g2 = G.add(g, c, r, design(t.value));
          boardSel = Math.max(
            0,
            g2.boards.findIndex(x => x.c === c && x.r === r)
          );
          return save(g2);
        }
        if (d.lbcell !== undefined) {
          // another leaderboard for a cell, or none (the board and its settings are gone)
          const i = Number(d.lbcell);
          boardSel = i;
          return save(t.value ? G.setOpt(g, i, design(t.value)) : G.remove(g, i));
        }
        if (d.lbspan) {
          const b = g.boards[boardSel];
          if (!b) return;
          return save(G.setSpan(g, boardSel, d.lbspan === 'w' ? t.value : b.w, d.lbspan === 'h' ? t.value : b.h));
        }
        if (!d.lb || !g.boards[boardSel]) return;
        const v = t.type === 'checkbox' ? t.checked : t.value;
        state.settings = await api.setSettings({ liveGrid: G.setOpt(g, boardSel, { [d.lb]: v }) });
        if (d.lb === 'orderBy') {
          boardsOpen = true;
          drawBoard(body, true, true);
        } else draw(false); // (another value to order by: the settings come back with or without "Best or worst on top")
      };
    }
    const g = G.gridOf(state.settings);
    const boardState = S();
    if (fresh) {
      boardHighlights.forEach(n => LapHighlights.dispose(n));
      boardHighlights = [];
    }
    const outputs = g.boards.map(b => Timing.content({ type: 'leaderboard', opt: b.opt }, boardState));
    $('lv-board').innerHTML = g.boards.length
      ? `<div class="lv-grid" style="grid-template-columns:repeat(${g.cols},minmax(0,1fr))">${g.boards.map((b, i) => `<div class="lv-board" style="grid-column:${b.c} / span ${b.w};grid-row:${b.r} / span ${b.h}">${outputs[i].html}</div>`).join('')}</div>`
      : '<p class="muted lv-empty">No leaderboard in the grid yet. Open Customize and pick one for a cell.</p>';
    if ($('lv-board').querySelectorAll) {
      // (2.4.0, SlotForgeRestyle.md "Live Pages") a classic table gets the names of its columns, and its rows the lane colour
      const NAMES = {
        pos: 'Pos',
        laps: 'Laps',
        best: 'Best',
        last: 'Last',
        current: 'Current',
        fuel: 'Fuel',
        tyres: 'Tyres',
        pace: 'Pace',
        gap: 'Gap',
        flag: ''
      };
      $('lv-board')
        .querySelectorAll('.lv-board > table.lb')
        .forEach(t => {
          const first = t.querySelector('tr');
          t.parentElement.classList.add('classic');
          if (!first || t.tHead) return;
          let driver = false;
          const head = [...first.children].map(td => {
            const k = (td.className.match(/lb-(\w+)/) || [])[1] || '';
            if (['name', 'nickname', 'callsign'].includes(k)) {
              const label = driver ? { nickname: 'Nickname', callsign: 'Callsign', name: 'Name' }[k] : 'Driver';
              driver = true;
              return `<th class="lb-${k}">${label}</th>`;
            }
            return `<th class="lb-${k}">${NAMES[k] ?? ''}</th>`;
          });
          t.insertAdjacentHTML('afterbegin', `<thead><tr>${head.join('')}</tr></thead>`);
          t.querySelectorAll('tr[data-lap-lane]').forEach(tr =>
            tr.style.setProperty('--c', HomeStats.laneColor(V.stat().layout, Number(tr.dataset.lapLane)))
          );
        });
      Rows.fitText($('lv-board')); // row designs: no text wider than its cell
    }
    $('lv-board')
      .querySelectorAll?.('.lv-board')
      .forEach((val, i) => {
        WidgetView.updateComponents({ val }, outputs[i]);
        const n = boardHighlights[i] || (boardHighlights[i] = { w: { type: 'leaderboard' }, layout: boardState.layout });
        n.el = val;
        n.val = val;
        LapHighlights.update(n, boardState);
      });
    if ($('lv-board').querySelectorAll && typeof Delta !== 'undefined') Delta.fit($('lv-board')); // a Delta Timer in a row design: the arrow and the number inside the badge
  }

  // Race Director: the race's buttons and penalty points. The buttons are sent to the race in the main window.
  // The page is built once and then only updated, so a button never changes under your finger.
  const send = cmd => api.liveCommand(cmd);
  // The Race Director page (1.11.1): the buttons and the calls on top, then folders like the ones in the Help, each with a colour of its own (Penalties yellow, Balance of Power white,
  // Damage red, Weather blue, Endurance brown). They are open to begin with, as the page was; a folder you close stays closed while the page is open.
  const folder = (id, title, note, tone, inner) => DirFolder.html(id, title, note, tone, inner); // (the folders are made in dirfolder.js, as on the Race tab)
  // The Adjust folder (1.12.0): pick a lane, then use the pads (penalty points, time, laps, championship points) for that lane. Nothing is picked to begin with, so a press never lands on the wrong lane.
  // What a pad did is kept to show the last action and to undo it (an undo is the same pad command with the opposite amount).
  // (the lane that is picked and what the pads did are kept here, so they stay when the page is drawn again; the panel itself is in adjustui.js)
  let adjPanel = null,
    cardsPanel = null,
    deck = null,
    rvShown = '';
  const adjMem = { lane: null, hist: AdjustPad.history(), key: undefined },
    cardsMem = { hist: AdjustPad.history(), key: undefined }; // (cardsMem: the lane cards of 1.72.0 keep the picked lane, the open pop-up and what was done here)
  const padSettings = () => state.settings; // Race Setups no longer override the App Settings pad values.
  function drawDirector(body, fresh) {
    const st = V.stat(),
      pen = !!(st.cfg.penalty && st.cfg.penalty.on);
    if (fresh || !$('lv-dir')) {
      const useCards = !st.tokenUi && typeof LaneCards !== 'undefined' && LaneCards.on(state.settings); // (1.72.0: a card for each lane instead of the folders Adjust, Penalties, Balance of Power, Damage and Car Failures)
      body.innerHTML = `<div id="lv-dir"><div class="lv-ctl">
          <button class="btn primary" data-cmd="start">Start</button><button class="btn" data-cmd="pause" id="dir-pause">Pause</button>
          <button class="btn" data-cmd="yellow" id="dir-yellow">Yellow flag</button><button class="btn" data-cmd="red" id="dir-red">Red flag</button>
          <button class="btn danger" data-cmd="stop">Stop race</button></div><p class="lv-notice" id="dir-notice" role="status" hidden></p>
        ${!st.tokenUi && typeof RaceSystems !== 'undefined' ? folder('systems', 'Racing systems', 'On / Off for this race', 'plain', '<div id="dir-systems"></div>') : ''}
        <div class="card"><h3>Calls</h3>
          <div class="lv-ctl">${st.cfg.entries.map(e => `<button class="btn" data-cmd="call" data-lane="${e.lane}" title="A call from this lane: raises the yellow flag, like a call button">Call lane ${e.lane + 1}</button>`).join('')}</div>
          <ul id="dir-calls" class="lv-calls"></ul></div>
        ${st.tokenUi ? '' : useCards ? folder('director', 'Race Director', 'Penalties, points, time, laps, damage and Balance of Power for each lane', 'plain', '<div id="dir-cards"></div>') : folder('adjust', 'Adjust', 'Penalty points, damage points, time, laps and championship points for one lane', 'plain', '<div id="dir-adj"></div>')}
        ${useCards ? '' : folder('penalties', 'Penalties', 'Points and penalties for each lane', 'yellow', pen ? PenaltyPanel.tableHtml(st.cfg.entries, st.cfg.penalty.types) : PenaltyPanel.NONE)}
        ${st.cfg.bop && !useCards ? folder('bop', 'Balance of Power', 'Even out fast and slow cars', 'white', '<div id="dir-bop" class="boppanel"></div>') : ''}
        ${st.cfg.damage && !useCards ? folder('damage', 'Damage', 'Incidents and repairs', 'red', '<div id="dir-dm" class="boppanel"></div>') : ''}
        ${st.cfg.damage && st.cfg.damage.failures && !useCards ? folder('failures', 'Car Failures', 'Give a car a failure, or clear it', 'red', '<div id="dir-fl" class="boppanel"></div>') : ''}
        ${st.cfg.weather ? folder('weather', 'Weather', 'Rain, tyres and pit stops', 'blue', '<div id="dir-wx" class="boppanel"></div>') : ''}
        ${st.tokenUi ? '' : folder('tyre', 'Tyre Change', 'Give a car another tyre', 'purple', '<div id="dir-ty" class="boppanel"></div>')}
        ${st.cfg.pushsave ? folder('pushsave', 'Push and Save', 'How hard each driver drives, and what it costs in tyres and fuel', 'lime', '<div id="dir-ps" class="boppanel"></div>') : ''}
        ${st.cfg.pitControl ? folder('pitstops', 'Pit stops', 'Service countdown and car release', 'teal', '<div id="dir-pithold"></div>') : ''}
        ${st.cfg.endurance ? folder('endurance', 'Endurance', 'Driver swaps', 'brown', '<div id="dir-en" class="boppanel"></div>') : ''}
        <details class="card" id="dir-lapsbox" hidden><summary>Review laps</summary><div id="dir-laps" class="rv"></div></details>
        <div id="dir-review" class="card rv race-finish" hidden></div></div>`;
      adjPanel =
        st.tokenUi || useCards
          ? null
          : AdjustPanel.build($('dir-adj'), {
              eng: () => V.engine(),
              lanes: st.cfg.entries.map(e => e.lane),
              phase: () => V.dyn().phase,
              now: () => V.clock(performance.now()),
              settings: padSettings,
              penalty: () => {
                const c = V.stat().cfg;
                return !!(c.penalty && c.penalty.on);
              },
              damage: () => !!V.stat().cfg.damage,
              champ: () => {
                const c = V.dyn().champ;
                return !!(c && c.on);
              },
              send: (group, lane, amount) => send({ type: 'pad', group, lane, amount }),
              refresh: () => drawDirector($('lv-body'), false),
              raceKey: () => V.stat().raceId,
              memory: adjMem,
              bind: false
            }); // the Adjust folder: the same pads as on the Race tab
      lapsHtml = '';
      lapsSig = '';
      dirLogHtml = '';
      rvShown = '';
      bopPanel =
        st.cfg.bop && !useCards
          ? BopPanel.build($('dir-bop'), {
              eng: () => V.engine(),
              lanes: st.cfg.entries.map(e => e.lane).sort((a, b) => a - b),
              phase: () => V.dyn().phase,
              send: (l, how) => send({ type: 'bop', lane: l, how })
            })
          : null; // Balance of Power: the same lane controls as on the main computer
      wxPanel = st.cfg.weather
        ? WeatherPanel.build($('dir-wx'), {
            buttons: !useCards,
            eng: () => V.engine(),
            lanes: st.cfg.entries.map(e => e.lane).sort((a, b) => a - b),
            phase: () => V.dyn().phase,
            now: () => V.clock(performance.now()),
            send: state => send({ type: 'weather', state })
          })
        : null; // the weather: the same controls as on the main computer
      tyPanel = st.tokenUi
        ? null
        : TyrePanel.build($('dir-ty'), {
            eng: () => V.engine(),
            lanes: st.cfg.entries.map(e => e.lane).sort((a, b) => a - b),
            phase: () => V.dyn().phase,
            now: () => V.clock(performance.now()),
            wear: !!(st.cfg.tyrewear && st.cfg.tyrewear.on),
            sets: !!(st.cfg.tyrewear && st.cfg.tyrewear.sets && st.cfg.tyrewear.sets.mode !== 'none'),
            weather: !!st.cfg.weather,
            setTyre: (l, code, save) => send({ type: 'tyre', lane: l, tyre: code, ...(save ? { save: true } : {}) }),
            queue: (l, code) => send({ type: 'tyrenext', lane: l, tyre: code })
          }); // Tyre Change: the same choice as on the main computer (every race)
      psPanel = st.cfg.pushsave
        ? PushSavePanel.build($('dir-ps'), {
            eng: () => V.engine(),
            lanes: st.cfg.entries.map(e => e.lane).sort((a, b) => a - b),
            phase: () => V.dyn().phase
          })
        : null;
      systemPanel =
        typeof RaceSystems !== 'undefined'
          ? RaceSystems.build($('dir-systems'), { eng: () => V.engine(), send: (key, enabled) => send({ type: 'system', key, enabled }) })
          : null;
      pitPanel = st.cfg.pitControl
        ? PitHoldPanel.build($('dir-pithold'), {
            eng: () => V.engine(),
            phase: () => V.dyn().phase,
            now: () => V.clock(performance.now()),
            send: (lane, early) => send({ type: early ? 'pitreleaseearly' : 'pitrelease', lane })
          })
        : null;
      enPanel = st.cfg.endurance
        ? EndurancePanel.build($('dir-en'), {
            eng: () => V.engine(),
            lanes: st.cfg.entries.map(e => e.lane).sort((a, b) => a - b),
            phase: () => V.dyn().phase,
            now: () => V.clock(performance.now()),
            send: (l, what, id) =>
              send(what === 'swap' ? { type: 'swap', lane: l, ...(id ? { to: id } : {}) } : { type: 'swapnext', lane: l, id })
          })
        : null; // an Endurance Race: the swaps, the same controls as on the main computer
      dmPanel =
        st.cfg.damage && !useCards
          ? DamagePanel.build($('dir-dm'), {
              eng: () => V.engine(),
              lanes: st.cfg.entries.map(e => e.lane).sort((a, b) => a - b),
              incidents: st.cfg.damage.incidents,
              phase: () => V.dyn().phase,
              now: () => V.clock(performance.now()),
              send: (l, n) => send({ type: 'damage', lane: l, n })
            })
          : null; // the damage of the cars, the same controls as on the main computer
      flPanel =
        st.cfg.damage && st.cfg.damage.failures && !useCards
          ? FailurePanel.build($('dir-fl'), {
              eng: () => V.engine(),
              lanes: st.cfg.entries.map(e => e.lane).sort((a, b) => a - b),
              failures: st.cfg.damage.failures.list.map((f, k) => ({ k, name: f.name, chance: f.chance })),
              phase: () => V.dyn().phase,
              now: () => V.clock(performance.now()),
              send: (l, k) => send({ type: 'failure', lane: l, k }),
              clear: l => send({ type: 'failureclear', lane: l })
            })
          : null; // Car Failures: the same controls as on the main computer (1.44.0)
      if (cardsPanel) cardsPanel.off();
      cardsPanel = useCards
        ? LaneCards.build($('dir-cards'), {
            eng: () => V.engine(),
            lanes: st.cfg.entries.map(e => e.lane).sort((a, b) => a - b),
            phase: () => V.dyn().phase,
            now: () => V.clock(performance.now()),
            settings: padSettings,
            penalty: () => {
              const c = V.stat().cfg;
              return !!(c.penalty && c.penalty.on);
            },
            penaltyTypes: () => {
              const c = V.stat().cfg;
              return (c.penalty && c.penalty.types) || [];
            },
            champ: () => {
              const c = V.dyn().champ;
              return !!(c && c.on);
            },
            send: {
              pad: (group, lane, amount) => send({ type: 'pad', group, lane, amount }),
              assign: (lane, typeIndex) => send({ type: 'assign', lane, typeIndex }),
              damage: (lane, n) => send({ type: 'damage', lane, n }),
              failure: (lane, k) => send({ type: 'failure', lane, k }),
              failureClear: lane => send({ type: 'failureclear', lane }),
              bop: (lane, how) => send({ type: 'bop', lane, how }),
              weather: state => send({ type: 'weather', state })
            },
            refresh: () => drawDirector($('lv-body'), false),
            raceKey: () => V.stat().raceId,
            memory: cardsMem,
            bind: false
          })
        : null; // the lane cards: the same commands as the folders they replace
      DirFolder.bind(body);
      // (2.4.0) the Lane Desk, as on the Race tab: a card per lane (with its Call button), a race column, the tables as tabs
      deck =
        useCards && typeof RaceDeck !== 'undefined'
          ? RaceDeck.mount(body, {
              page: 'director',
              eng: () => V.engine(),
              lanes: st.cfg.entries.map(e => e.lane).sort((a, b) => a - b),
              now: () => V.clock(performance.now()),
              phase: () => V.dyn().phase,
              elapsed: () => V.engine().elapsed(V.clock(performance.now())),
              color: l => HomeStats.laneColor(st.layout, l),
              weather: state => send({ type: 'weather', state }),
              tyreNext: (lane, code) => send({ type: 'tyrenext', lane, tyre: code })
            })
          : null;
      Review.bind(
        $('dir-review'),
        c => send({ type: 'review', ...c }),
        () => drawDirector($('lv-body'), false)
      );
      Review.bind(
        $('dir-laps'),
        c => send({ type: 'review', ...c }),
        () => drawDirector($('lv-body'), false)
      );
      body.onclick = async e => {
        const b = e.target.closest('[data-cmd]');
        if (!b) return cardsPanel ? cardsPanel.click(e.target) : adjPanel && adjPanel.click(e.target); // (not a button of the race: maybe one of the lane cards or of the Adjust folder)
        if (b.disabled) return;
        if (b.dataset.cmd === 'stop') {
          if (
            !(await Dialog.confirm('Stop the race now? The laps so far are saved.', {
              ok: 'Stop the race',
              cancel: 'Keep racing',
              danger: true
            }))
          )
            return;
          if (!['running', 'paused', 'between'].includes(V.dyn()?.phase)) return; // (the race goes on while the question is open: it may have ended by itself)
        }
        send({
          type: b.dataset.cmd,
          lane: b.dataset.lane === undefined ? undefined : Number(b.dataset.lane),
          n: b.dataset.n === undefined ? undefined : Number(b.dataset.n),
          typeIndex: b.dataset.type === undefined ? undefined : Number(b.dataset.type),
          id: b.dataset.id === undefined ? undefined : Number(b.dataset.id),
          how: b.dataset.how
        });
      };
    }
    const d = V.dyn(),
      eng = V.engine(),
      on = d.phase === 'running' || d.phase === 'paused',
      set = (sel, fn) => body.querySelectorAll(sel).forEach(fn);
    set('[data-cmd="start"]', b => {
      b.disabled = !(d.phase === 'ready' || d.phase === 'between') || !!d.calling;
    });
    {
      const n = $('dir-notice'),
        t = String(d.notice || '');
      if (n && n.textContent !== t) {
        n.textContent = t;
        n.hidden = !t;
      }
    } // (what the race screen says: why a restart was refused, what the timing hardware reported)
    set('[data-cmd="pause"]', b => {
      b.disabled = !on;
      b.textContent = d.phase === 'paused' ? 'Resume' : 'Pause';
    });
    set('[data-cmd="yellow"]', b => {
      b.disabled = !on;
      b.setAttribute('aria-pressed', String(eng.flag === 'yellow'));
      b.textContent = eng.safetyCar ? 'Safety Car' : 'Yellow flag';
    }); // (1.53.0: with a safety car system the yellow flag is the Safety Car)
    set('[data-cmd="red"]', b => {
      b.disabled = !on;
      b.setAttribute('aria-pressed', String(eng.flag === 'red'));
    });
    set('[data-cmd="stop"]', b => {
      b.disabled = !(on || d.phase === 'between');
    });
    set('[data-cmd="call"]', b => {
      b.disabled = !on;
    });
    // the calls that wait: the list is only rebuilt when they change, so a button never changes under your finger
    const open = (eng.calls || []).filter(c => c.open),
      list = $('dir-calls'),
      key = open.map(c => `${c.id}:${c.car}${eng.cars[c.car] && eng.cars[c.car].dq ? 'd' : ''}`).join() || '-';
    if (list.dataset.key !== key) {
      list.dataset.key = key;
      list.innerHTML = open.length
        ? open
            .map(c => {
              const car = eng.cars[c.car];
              if (!car) return '';
              return `<li><span><strong>Lane ${car.lane + 1}</strong> · ${esc(car.driverName)} called</span><button class="btn" data-cmd="callresolve" data-id="${c.id}" data-how="dismiss">Dismiss</button>${pen && !car.dq ? `<button class="btn danger" data-cmd="callresolve" data-id="${c.id}" data-how="penalty">Penalty point +1</button>` : ''}</li>`;
            })
            .join('')
        : '<li class="muted">No calls waiting. A call raises the yellow flag; you decide what it means.</li>';
    }
    set('[data-cmd="callresolve"]', b => {
      b.disabled = !on;
    });
    if (adjPanel) adjPanel.update();
    if (cardsPanel) {
      cardsPanel.update();
      const cv = cardsPanel.view(),
        fd = body.querySelector('[data-dirf="director"]');
      if (fd) fd.hidden = !(cv && cv.usable);
    }
    if (bopPanel) bopPanel.update();
    if (wxPanel) wxPanel.update();
    if (tyPanel) tyPanel.update();
    if (psPanel) psPanel.update();
    if (enPanel) enPanel.update();
    if (pitPanel) pitPanel.update();
    if (systemPanel) {
      systemPanel.update();
      RaceSystems.lockControls(body, eng);
      const f = body.querySelector('[data-dirf="systems"]');
      if (f) f.hidden = $('dir-systems').hidden;
    }
    if (dmPanel) dmPanel.update();
    if (flPanel) flPanel.update();
    if (deck) deck.update();
    // during the race: the laps of every car, to mark a lap invalid or take it out. Drawn again only when something in it changed, so a button never changes under your finger.
    const lb = $('dir-lapsbox'),
      tv = d.tokens ? Tokens.view(d.tokens) : null;
    lb.hidden = !on;
    if (on) {
      // (2.4.0) the laps are made again only when something in them changed, as in the race window: not ten times a second
      const R = Review.ui,
        sig = JSON.stringify([
          eng.cars.map(c => [c.laps.length, c.best, c.invalid, c.removed, c.dq, c.done, c.driverName]),
          [...R.open],
          R.del,
          R.filter,
          [...R.checked],
          R.focus,
          d.tokens ? d.tokens.lates || 0 : 0
        ]);
      if (sig !== lapsSig) {
        lapsSig = sig;
        // (2.4.0) the lap explorer, as in the review after the race; a Time Token Session keeps the list of every lane (with its laps after the paid time)
        const h = tv
          ? Review.lapsHtml(eng, { late: (i, n) => tv.lateAt(eng.cars[i].lane, n) })
          : Review.lapDeskHtml(eng, { color: l => HomeStats.laneColor(st.layout, l) });
        if (h !== lapsHtml) {
          lapsHtml = h;
          Review.render($('dir-laps'), h);
        }
      }
    } else {
      lapsHtml = '';
      lapsSig = '';
    }
    const rv = $('dir-review'); // after the race: the review, with the same corrections as in the race window (a Time Token Session is checked on the main computer)
    if (d.phase === 'review') {
      // (drawn again only when it changed, so what you type in the field of a pad stays)
      const h = st.tokenUi
        ? '<h3>Session review</h3><p class="muted">The session is over. The stints are checked on the main computer, where Finalize is pressed.</p>'
        : Review.finishHtml(eng, {
            champ: d.champ,
            settings: padSettings(),
            color: l => HomeStats.laneColor(st.layout, l),
            heat: d.review ? d.review.heat : null,
            changes: d.review ? d.review.changes : [],
            local: false // (2.4.0: the changes and Run again as on the computer; deleting the race is done there)
          }); // (2.4.0: the same finishing desk as the race window)
      rv.hidden = false;
      if (h !== rvShown) {
        rvShown = h;
        Review.render(rv, h);
      }
    } else if (!rv.hidden) {
      rv.hidden = true;
      rv.innerHTML = '';
      rvShown = '';
    }
    if (!pen || cardsPanel) return; // (the lane cards have the log themselves)
    PenaltyPanel.refresh(body, eng, st.cfg.entries, st.cfg.penalty.types, on);
    const logH = PenaltyPanel.logHtml(eng); // (the log is made in penaltyui.js, as on the Race tab)
    if (logH !== dirLogHtml) $('dir-log').innerHTML = dirLogHtml = logH; // (2.4.0: only when it changed)
  }

  // Tokens (Time Token Session): the same lane controls as on the main computer. The clocks, the time buttons and the drivers come with the race;
  // what is pressed here is sent to the race window (the same way as the Race Director's buttons), which does it and sends the new state back.
  function drawTokens(body, fresh) {
    const st = V.stat(),
      ui = st.tokenUi;
    if (!ui) {
      if (fresh || body.dataset.k !== 'notoken') {
        body.innerHTML =
          '<p class="muted lv-empty">No Time Token Session is running. Open one from the Home tab (a race setup with the session type Time Token Session).</p>';
        body.dataset.k = 'notoken';
      }
      tkPanel = null;
      return;
    }
    if (fresh || !tkPanel || !$('lv-tokens')) {
      body.innerHTML =
        '<div class="row" id="lv-tkopen" hidden><button class="btn primary" data-cmd="start">Open the session</button><span class="muted">Until it is opened, the clocks do not run.</span></div><div id="lv-tokens" class="card tkpanel"></div>';
      const T = () => {
        const eng = V.engine();
        return eng.elapsed(V.clock(performance.now()));
      };
      const K = () => (V.hasRace() ? Tokens.view(V.dyn().tokens) : null);
      const lanes = st.cfg.entries.map(e => e.lane).sort((a, b) => a - b);
      tkPanel = TokenPanel.build($('lv-tokens'), {
        tokens: K,
        lanes,
        drivers: ui.drivers,
        increments: ui.increments,
        decrements: ui.decrements || [],
        color: l => HomeStats.laneColor(V.stat().layout, l),
        T,
        phase: () => V.dyn().phase,
        label: l => {
          const c = V.engine().cars.find(x => x.lane === l);
          return (c && c.driverId) || '';
        },
        ops: {
          add: (l, m) => send({ type: 'addtime', lane: l, minutes: m }),
          reduce: (l, m) => send({ type: 'reducetime', lane: l, minutes: m }),
          undo: l => send({ type: 'undotime', lane: l }),
          end: l => send({ type: 'endtime', lane: l }),
          clear: l => send({ type: 'cleartime', lane: l }),
          who: (l, id) => send({ type: 'setdriver', lane: l, driverId: id }),
          pause: () => send({ type: 'pause' })
        }
      });
      body.onclick = e => {
        const b = e.target.closest && e.target.closest('#lv-tkopen [data-cmd]');
        if (b && !b.disabled) send({ type: 'start' });
      };
    }
    const d = V.dyn();
    $('lv-tkopen').hidden = d.phase !== 'ready';
    tkPanel.update();
  }

  // Driver stats: pick a lane, see the same values the widgets show
  // Driver stats page (1.36.0): the lanes to pick from, Customize, and the grid of the lane that is picked. What the grid shows and where is set under Customize, the way the Leaderboard
  // page sets its boards (the rules are in drivergrid.js). The grid of the computer is the default for every device; a phone that changes it keeps its own grid on that phone, and
  // can go back to the computer's. A device also remembers the lane it was on.
  let dgOpen = false,
    dgSel = '';
  const hasOwnGrid = () => (api.web ? !!(api.ownSettings && api.ownSettings().driverGrid) : !!state.settings.driverGrid);
  const dgTool = (g, entries) => {
    const D = DriverGrid,
      cs = D.cells(g),
      web = !!api.web,
      own = hasOwnGrid(),
      plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
    const sel = cs.find(x => `${x.c},${x.r}` === dgSel) || cs[0] || null;
    dgSel = sel ? `${sel.c},${sel.r}` : '';
    const squares = Array.from({ length: D.MAXR * D.MAXC }, (_, k) => {
      const c = (k % D.MAXC) + 1,
        r = Math.floor(k / D.MAXC) + 1;
      return `<button type="button" class="lv-gp${c <= g.cols && r <= g.rows ? ' on' : ''}" data-dggrid="${c},${r}" aria-label="${plural(c, 'column', 'columns')} by ${plural(r, 'row', 'rows')}" aria-pressed="${c === g.cols && r === g.rows}"></button>`;
    }).join('');
    const map = cs
      .map(x => {
        const d = x.board ? D.cellOf(x.board.opt.cell) : null,
          on = `${x.c},${x.r}` === dgSel;
        return `<button type="button" class="btn lv-dgc${x.board ? '' : ' empty'}${on ? ' sel' : ''}" style="grid-column:${x.c} / span ${x.board ? x.board.w : 1};grid-row:${x.r} / span ${x.board ? x.board.h : 1}" data-dgsel="${x.c},${x.r}" aria-pressed="${on}" aria-label="${x.board ? esc(d.label) : 'Empty cell'}, ${D.where(x)}">${x.board ? esc(d.label) : '+'}</button>`;
      })
      .join('');
    let one = '<p class="muted">The grid has no cells.</p>';
    if (sel) {
      const b = sel.board,
        d = b ? D.cellOf(b.opt.cell) : null,
        ms = b ? D.maxSpan(g, b) : null;
      const shows = `<option value=""${b ? '' : ' selected'}>${b ? '(empty)' : 'Pick what this cell shows'}</option>${D.GROUPS.map(
        gr =>
          `<optgroup label="${gr}">${D.CELLS.filter(c => c.group === gr)
            .map(c => `<option value="${c.key}"${b && b.opt.cell === c.key ? ' selected' : ''}>${esc(c.label)}</option>`)
            .join('')}</optgroup>`
      ).join('')}`;
      const span = (key, n, max, label) =>
        `<div class="field"><label for="dg-${key}">${label}</label><select id="dg-${key}" data-dgspan="${key}">${Array.from({ length: max }, (_, i) => `<option value="${i + 1}"${n === i + 1 ? ' selected' : ''}>${i + 1}</option>`).join('')}</select></div>`;
      one = `<fieldset class="lv-optset"><legend>${b ? esc(d.label) : 'Empty cell'} (${D.where(sel)})</legend><div class="lv-optgrid">
        <div class="field"><label for="dg-show">Shows</label><select id="dg-show" data-dgshow="1">${shows}</select></div>
        ${b ? `${span('w', b.w, ms.w, 'Columns it covers')}${span('h', b.h, ms.h, 'Rows it covers')}<div class="field"><label class="inline"><input type="checkbox" data-dglabel="1"${b.opt.label ? ' checked' : ''}> Show the label</label></div>` : ''}</div>
        ${d && d.needs ? `<p class="muted">${esc(D.NEEDS[d.needs])}</p>` : ''}</fieldset>`;
    }
    const cur = entries.find(e => e.lane === lane);
    const note = web
      ? own
        ? '<strong>This device only.</strong> What you change here stays on this device and does not touch the others.'
        : "You are using the computer's layout. Change anything here and this device keeps a layout of its own."
      : '<strong>This layout is the default for all devices.</strong> Phones and tablets start with it. A device that makes its own layout keeps it.';
    return `<div class="lv-gridtool"><p class="muted">${note}</p>
      <div class="field"><span class="lbl" id="dg-gridlabel">Grid size</span><div class="lv-gridpick" style="grid-template-columns:repeat(${D.MAXC},28px)" role="group" aria-labelledby="dg-gridlabel">${squares}</div><output id="dg-gridsize">${D.sizeText(g)}</output><div class="muted">Up to ${D.MAXC} columns and ${D.MAXR} rows, on every device.</div></div>
      <div class="field"><span class="lbl">Cells (pick one to change what it shows)</span><div class="lv-gridmap lv-dgmap" style="grid-template-columns:repeat(${g.cols},minmax(0,1fr))">${map}</div></div>${one}
      <div class="field"><label class="inline"><input type="checkbox" data-dgremember="1"${D.rememberOn(state.settings) ? ' checked' : ''}> Remember my lane on this device</label>${cur ? `<div class="muted">Now: ${esc(cur.driverName)}, lane ${cur.lane + 1}. A lane that is not in the race is skipped: the first lane shows.</div>` : ''}</div>
      <div class="row"><button type="button" class="btn" data-dgreset="1"${own ? '' : ' disabled'}>${web ? "Use the computer's layout again" : 'Use the standard layout again'}</button></div>
      <p class="muted">${web ? "Drops this device's own layout and follows the computer again." : 'Goes back to the standard layout. Devices without a layout of their own follow it.'}</p></div>`;
  };
  const dgPanel = () => {
    const el = $('lv-dgpanel');
    if (el) el.innerHTML = dgTool(DriverGrid.gridOf(state.settings), V.stat().cfg.entries);
  };
  // The cells of the lane that is picked. A cell the race has nothing for is blank, and a row of blank cells is not drawn (drivergrid.js layout).
  function paintDriver() {
    const el = $('lv-dstats'),
      D = DriverGrid;
    if (!el || lane === null) return;
    const st = S(),
      W = type => Widgets.newWidget(type, lane, 0, 0),
      c = st.carByLane(lane),
      html = type => Timing.content(W(type), st).html,
      dash = '–';
    const facts = {
      swaps: html('swaptimer') !== '',
      fuel: !!(st.eng.fuel && st.eng.fuel.on),
      tyres: !!st.eng.weather,
      tyrewear: !!st.eng.tyrewear,
      pushsave: !!st.eng.pushSave,
      damage: !!st.eng.damage,
      penalty: !!(st.eng.penalty && st.eng.penalty.on),
      champ: !!(st.champ && st.champ.on),
      laps: html('lapstogo') !== dash,
      driven: html('distance') !== dash,
      togo: html('distleft') !== dash
    };
    const g = D.gridOf(state.settings),
      L = D.layout(g, key => D.applies(key, facts));
    const one = x => {
      const d = D.cellOf(x.key),
        pos = `grid-column:${x.c} / span ${x.w};grid-row:${x.r} / span ${x.h}`;
      if (x.quiet) return `<div class="lv-dg quiet" style="${pos}"></div>`;
      let r;
      if (d.own === 'last') r = { html: c && c.laps.length ? RaceEngine.fmtTime(c.laps[c.laps.length - 1]) : dash };
      else {
        const w = W(d.type);
        if (d.opt) w.opt = { ...w.opt, ...d.opt };
        r = Timing.content(w, st);
      }
      const paint = r.bg ? `;background:${esc(r.bg)};color:${esc(r.color || '')};border-color:${esc(r.bg)}` : '',
        size = x.w >= 2 && x.h >= 2 ? ' big' : x.w === 1 ? ' small' : '';
      return `<div class="lv-dg lv-stat${size}${d.list ? ' list' : ''}" data-cell="${esc(x.key)}" style="${pos}${paint}">${x.label ? `<span${r.bg ? '' : ' class="muted"'}>${esc(d.label)}</span>` : ''}${d.list ? `<div class="lv-laps">${r.html || '<span class="muted">No laps yet</span>'}</div>` : `<strong>${r.html}</strong>`}</div>`;
    };
    el.innerHTML = `<div class="lv-who">${html('avatar')}<div><div class="lv-big">${html('name')} ${html('driverflag')}</div><div class="muted">${esc(c ? c.carName : '')}${c ? ` · <span class="lv-wholane" style="--c:${esc(HomeStats.laneColor(st.layout, lane))}">Lane ${lane + 1}</span>` : ''}</div></div>${html('carpicture')}</div>
      ${L.cells.length ? `<div class="lv-dgrid" style="grid-template-columns:repeat(${L.cols},minmax(0,1fr))">${L.cells.map(one).join('')}</div>` : `<p class="muted lv-empty">${g.boards.length ? 'Nothing in the grid has anything to show in this race.' : 'Nothing in the grid yet. Open Customize and pick a number for a cell.'}</p>`}`;
  }
  function drawDriver(body, fresh) {
    const D = DriverGrid,
      entries = V.stat().cfg.entries;
    lane = D.laneFor(
      entries.map(e => e.lane),
      lane,
      D.savedLane(state.settings)
    );
    if (fresh || !$('lv-dstats')) {
      const was = $('lv-dgtool');
      if (was && typeof was.open === 'boolean') dgOpen = was.open;
      body.innerHTML = `<div class="lv-lanes">${entries.map(e => `<button class="btn" data-lane="${e.lane}" aria-pressed="${e.lane === lane}" style="--c:${esc(HomeStats.laneColor(V.stat().layout, e.lane))}" aria-label="${esc(e.driverName)}, lane ${e.lane + 1}"><i>${e.lane + 1}</i>${esc(e.driverName)}</button>`).join('')}</div>
        <details class="lv-opts" id="lv-dgtool"${dgOpen ? ' open' : ''}><summary>Customize</summary><div id="lv-dgpanel"></div></details><div id="lv-dstats" class="lv-dstats"></div>`;
      const save = async g => {
        state.settings = await api.setSettings({ driverGrid: g });
        dgOpen = true;
        dgPanel();
        paintDriver();
      };
      const keep = patch =>
        Promise.resolve(api.setSettings(patch))
          .then(s => {
            if (s) state.settings = s;
          })
          .catch(() => {});
      body.onclick = async e => {
        // a lane, a square of the grid picker, a cell of the map, or the button that goes back to the layout of the computer
        const b = e.target.closest ? e.target.closest('[data-lane],[data-dggrid],[data-dgsel],[data-dgreset]') : null,
          d = (b && b.dataset) || {};
        if (d.lane !== undefined) {
          lane = Number(d.lane);
          draw(true);
          if (D.rememberOn(state.settings)) keep({ driverLane: lane });
          return;
        }
        if (d.dggrid) {
          const [c, r] = String(d.dggrid).split(',').map(Number);
          return save(D.resize(D.gridOf(state.settings), c, r));
        }
        if (d.dgsel) {
          dgSel = String(d.dgsel);
          dgOpen = true;
          return dgPanel();
        }
        if (d.dgreset && !b.disabled) {
          state.settings = await api.setSettings({ driverGrid: null });
          dgOpen = true;
          dgPanel();
          paintDriver();
        }
      };
      body.onchange = async e => {
        const t = e.target,
          d = t.dataset || {},
          g = D.gridOf(state.settings),
          sel = D.cells(g).find(x => `${x.c},${x.r}` === dgSel);
        if (d.dgremember !== undefined) {
          await keep(t.checked ? { driverRemember: true, driverLane: lane } : { driverRemember: false, driverLane: null });
          dgPanel();
          return;
        }
        if (!sel) return;
        if (d.dgshow !== undefined) {
          // another number for the cell, or none (a cell that has no number is empty)
          if (sel.board) return save(t.value ? D.setCell(g, sel.index, t.value) : D.remove(g, sel.index));
          return t.value ? save(D.add(g, sel.c, sel.r, t.value)) : undefined;
        }
        if (!sel.board) return;
        if (d.dgspan)
          return save(D.setSpan(g, sel.index, d.dgspan === 'w' ? t.value : sel.board.w, d.dgspan === 'h' ? t.value : sel.board.h));
        if (d.dglabel !== undefined) return save(D.setLabel(g, sel.index, t.checked));
      };
      dgPanel();
    }
    if (lane === null) return;
    paintDriver();
  }

  // ---- keeping up with the race ----
  let lastPaint = 0;
  function repaint() {
    lastPaint = performance.now();
    status();
    if (!['tiles', 'rules', 'database', 'home'].includes(page)) draw(false);
  }
  async function mount(el, opts = {}) {
    unmount();
    const my = mountN; // (2.4.0 review: an unmount or another mount while this one waits ends this one)
    host = el;
    second = !!opts.second;
    V = LiveShare.viewer();
    page = 'tiles';
    resultsFollowed = '';
    followedFrom = null;
    LiveCanvas.dispose(nodes);
    nodes = null;
    tkPanel = null;
    bopPanel = null;
    wxPanel = null;
    tyPanel = null;
    psPanel = null;
    enPanel = null;
    pitPanel = null;
    systemPanel = null;
    dmPanel = null;
    flPanel = null;
    adjPanel = null;
    if (cardsPanel) cardsPanel.off();
    cardsPanel = null;
    lane = null;
    try {
      state.settings = await api.getSettings();
    } catch {
      /* keep what we have */
    }
    if (my !== mountN) return;
    if (api.web && api.startPage && api.startPage()) {
      await api.pairing(); // (a scanned pairing QR code: logged in first, then straight to the page)
      if (my !== mountN) return;
      page = api.startPage();
    }
    let got = null;
    try {
      got = await api.liveGet();
    } catch {
      /* no race data yet: the pages open empty and fill in from the live messages */
    }
    if (my !== mountN) return;
    if (got && got.stat && !(second && got.closed)) {
      V.feedStatic(got.stat);
      if (got.dyn) V.feedDynamic(got.dyn, performance.now());
    }
    // (2.5.0) the second screen: Home until a race is there, then Race Timing (a phone or the Live Race tab keeps the tiles)
    if (second && page === 'tiles') page = live() ? 'timing' : 'home';
    offs.push(
      api.onLiveStatic(s => {
        V.feedStatic(s);
        LiveCanvas.dispose(nodes);
        nodes = null;
        if (second && page === 'home') return go('timing'); // (2.5.0: Start race on the race computer: Race Timing by itself)
        if (followResults()) return;
        if (page !== 'tiles') draw(true);
        status();
      })
    );
    // a message that does not fit (one was missed, for instance after the wifi dropped out for a moment): fetch the whole state from the app and carry on from there
    let syncing = false;
    const resync = async () => {
      if (syncing) return;
      syncing = true;
      const mine = V; // (2.4.0 review: the viewer from before the wait, so an unmount or a new mount is seen)
      try {
        const g = await api.liveGet();
        if (V && V === mine && g && g.stat) {
          if (!V.stat() || V.stat().raceId !== g.stat.raceId) {
            V.feedStatic(g.stat);
            LiveCanvas.dispose(nodes);
            nodes = null;
          }
          if (g.dyn && V.feedDynamic(g.dyn, performance.now())) {
            if (followResults()) return;
            if (page !== 'tiles' && !nodes && page === 'timing') draw(true);
            else repaint();
          }
        }
      } catch {
        /* the next message tries again */
      } finally {
        syncing = false;
      }
    };
    offs.push(
      api.onLive(d => {
        if (!V) return;
        if (V.feedDynamic(d, performance.now())) {
          if (followResults()) return;
          if (page !== 'tiles' && !nodes && page === 'timing') draw(true);
          else repaint();
        } else if (V.needsSync()) resync();
      })
    );
    if (second && api.onLiveClosed)
      offs.push(
        api.onLiveClosed(() => {
          // (2.5.0) the race computer left its race: Home again, and the next race starts fresh
          V = LiveShare.viewer();
          resultsFollowed = '';
          go('home');
        })
      );
    if (second && api.onHomeChanged) offs.push(api.onHomeChanged(homeAgain));
    ticker = setInterval(() => {
      // (2.4.0 review, speed) no second paint when a live message has just painted
      if (live() && ['running', 'countdown'].includes(V.dyn().phase) && performance.now() - lastPaint >= 90) repaint();
    }, 100); // clocks keep running between messages
    if (second && !keyOff) {
      keyOff = ev => {
        if (ev.key === 'Escape') {
          api.liveFullscreen(false);
          if ($('lv-full')) $('lv-full').textContent = 'Full screen';
        }
      };
      document.addEventListener('keydown', keyOff);
    }
    host.onpointermove = reveal;
    host.onpointerdown = reveal;
    shell();
    if (!followResults()) draw(true); // A second display can open after the race has already ended: use the state we just fetched, not only a later live message.
  }
  function unmount() {
    mountN++; // (2.4.0 review)
    clearTimeout(homeTimer);
    boardHighlights.forEach(n => LapHighlights.dispose(n));
    boardHighlights = [];
    if (host) {
      host.onpointermove = null;
      host.onpointerdown = null;
      if (host.classList) {
        host.classList.remove('lv-clean');
        host.classList.remove('lv-show');
      }
    }
    clearTimeout(revealT);
    if (keyOff) {
      document.removeEventListener('keydown', keyOff);
      keyOff = null;
    }
    offs.forEach(f => f());
    offs = [];
    clearInterval(ticker);
    ticker = null;
    host = null;
    V = null;
    LiveCanvas.dispose(nodes);
    nodes = null;
    tkPanel = null;
    if (cardsPanel) cardsPanel.off();
    cardsPanel = null;
  }
  return { mount, unmount, go, nodes: () => nodes };
})();
