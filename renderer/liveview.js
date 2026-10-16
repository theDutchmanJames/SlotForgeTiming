// The Live Race pages: a landing page of tiles and read-only pages that follow the running race.
// They run in the main window (Live Race tab) and in the second-screen window, fed by liveshare.js.
const LiveView = (() => {
  const TILES = [
    ['timing', 'Race timing', 'Your timing page, live'],
    ['board', 'Leaderboard', 'Positions, laps, best laps and gaps'],
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
  const icon = id => Icons.svg(id, { size: 40, cls: 'lv-ico' });
  const PHASE = { ready: 'Ready to start', countdown: 'Lights', running: 'Racing', paused: 'Paused', between: 'Heat finished', finished: 'Finished', review: 'Race review' };
  let keyOff = null, host = null, V = null, page = 'tiles', nodes = null, tkPanel = null, bopPanel = null, wxPanel = null, enPanel = null, dmPanel = null, lane = null, ticker = null, offs = [], second = false, lapsHtml = '';

  const $ = id => document.getElementById(id);
  const live = () => !!V && V.hasRace();
  const S = () => V.shared(performance.now());

  // ---- the frame around every page ----
  function shell() {
    const tile = TILES.find(t => t[0] === page);
    host.innerHTML = `<div class="lv-head${isControl(page) ? ' special' : ''}">${page === 'tiles' ? '<h2 style="margin:0">Live Race</h2>' : `<button class="btn" id="lv-back">‹ Live Race</button><strong>${esc(tile[1])}</strong>${isControl(page) ? BADGE : ''}`}
      <span class="muted" id="lv-status" role="status"></span><span style="flex:1"></span>
      ${second ? '<button class="btn" id="lv-full">Full screen</button>' : '<button class="btn" id="lv-open">Open on a second screen</button>'}</div><div id="lv-body" class="lv-body"></div>`;
    if ($('lv-back')) $('lv-back').onclick = () => go('tiles');
    if ($('lv-full')) $('lv-full').onclick = async () => { const on = await api.liveFullscreen(); $('lv-full').textContent = on ? 'Exit full screen' : 'Full screen'; };
    if ($('lv-open')) $('lv-open').onclick = async () => { const r = await api.liveOpen(); $('lv-status').textContent = r && r.second ? 'Opened on your second screen.' : 'Opened. Only one screen was found, so drag the window where you want it.'; };
    status();
  }
  function status() {
    const el = $('lv-status'); if (!el) return;
    const d = live() ? V.dyn() : null, left = d && d.phase === 'between' && d.heat && d.heat.breakLeft > 0 ? Heats.clock(d.heat.breakLeft) : '';
    el.textContent = live() ? `${V.stat().title} · ${PHASE[d.phase] || ''}${left ? ` · next ${d.heat.final ? 'final ' + d.heat.final : 'heat'} in ` + left : ''}` : 'No race is running.';
  }

  function go(p) { page = p; nodes = null; tkPanel = null; bopPanel = null; wxPanel = null; enPanel = null; dmPanel = null; shell(); draw(true); }

  // ---- the pages ----
  function draw(fresh) {
    const body = $('lv-body'); if (!body) return;
    setClean(page === 'timing' && live());
    if (page === 'tiles') {
      body.innerHTML = `<div class="lv-tiles">${TILES.map(([id, name, d]) => `<button class="lv-tile${isControl(id) ? ' special' : ''}" data-go="${id}">${isControl(id) ? BADGE : ''}${icon(id)}<strong>${esc(name)}</strong><span class="muted">${esc(d)}</span></button>`).join('')}</div>`;
      body.onclick = e => { const b = e.target.closest('[data-go]'); if (b && !b.disabled) go(b.dataset.go); };
      return;
    }
    if (page === 'rules') {
      body.innerHTML = `<div class="lv-rules">${RichText.text(state.settings.rules) ? RichText.clean(state.settings.rules) : '<span class="muted">No racing rules written yet. Add them under Racing Rules.</span>'}</div>`;
      return;
    }
    if (page === 'database') {
      if (fresh) { body.innerHTML = ''; body.classList.add('ro'); renderDatabase(body); }
      return;
    }
    body.classList.remove('ro');
    if ((page === 'director' || page === 'tokens') && api.web && !api.directorAuthed()) return drawLogin(body, fresh); // log in first, race or not (one password for both pages)
    if (!live()) { body.innerHTML = '<p class="muted lv-empty">No race is running. This page fills in as soon as a race starts.</p>'; nodes = null; return; }
    if (page === 'timing') return drawTiming(body, fresh);
    if (page === 'board') return drawBoard(body, fresh);
    if (page === 'driver') return drawDriver(body, fresh);
    if (page === 'director') return drawDirector(body, fresh);
    if (page === 'tokens') return drawTokens(body, fresh);
  }

  // On another device (a browser) the Race Director page asks for the password that was set in App Settings > Network access.
  async function drawLogin(body, fresh) {
    if (!fresh && $('lv-login')) return;
    let info = { passwordSet: true };
    try { info = await api.directorInfo(); } catch { /* the host is not reachable: show the form anyway */ }
    if (!info.passwordSet) { body.innerHTML = `<div id="lv-login" class="card"><p>${page === 'tokens' ? 'The Tokens page' : 'The Race Director'} can only be used on the main computer, because no password is set. Set one in App Settings > Network access.</p></div>`; return; }
    body.innerHTML = `<form id="lv-login" class="card" style="max-width:360px"><div class="field"><label for="lv-pass">${page === 'tokens' ? 'Password for the Tokens page (the same as for the Race Director)' : 'Password for the Race Director'}</label><input id="lv-pass" type="password" autocomplete="current-password"></div>
      <div class="row"><button class="btn primary" type="submit">Log in</button><span id="lv-loginmsg" class="error" role="alert"></span></div></form>`;
    $('lv-login').onsubmit = async ev => {
      ev.preventDefault();
      try { await api.directorLogin($('lv-pass').value); draw(true); }
      catch (e) { $('lv-loginmsg').textContent = e.code === 'wrong' ? 'Wrong password.' : e.code === 'nopassword' ? 'No password is set on the main computer.' : 'Could not log in: ' + e.message; }
    };
  }

  // The timing page of a running race shows only the widgets of the layout, as large as the window allows: no bar on top, no buttons (the control widgets are left out).
  // The bar (back, status, full screen) shows when the pointer moves or the screen is touched, and goes away again after a moment.
  function drawTiming(body, fresh) {
    if (!nodes || fresh) {
      body.innerHTML = '<div class="fullview" id="lv-fv"><div class="canvas live" id="lv-canvas"></div></div>';
      nodes = LiveCanvas.build($('lv-canvas'), Widgets.withoutControls(V.stat().layout, V.stat().lanes).layout, V.stat().lanes, { maxH: 0 });
    }
    LiveCanvas.paint(nodes, S());
  }
  const setClean = on => { if (host && host.classList) { if (on) host.classList.add('lv-clean'); else { host.classList.remove('lv-clean'); host.classList.remove('lv-show'); } } };
  let revealT = null;
  const reveal = () => { if (!host || !host.classList) return; host.classList.add('lv-show'); clearTimeout(revealT); revealT = setTimeout(() => { if (host && host.classList) host.classList.remove('lv-show'); }, 2500); };

  // Leaderboard page: a grid of boards (1.11.0). You pick the grid with the little squares (up to 6 columns by 4 rows) and give every cell a leaderboard: a row design from
  // Customization > Leaderboard Editor, the classic table, or nothing. A board can cover more cells (wider, taller) and show only some places (from .. to).
  // The grid is saved for this page, on this device (the setting liveGrid; the old one or two boards are read as a grid until a grid is saved). The rules are in livegrid.js.
  const CLASSIC = '~classic'; // (the value of "Classic table" in the lists; a row design has an id of its own)
  let boardSel = 0, boardsOpen = false;
  const gridTool = (g, designs, sel) => {
    const G = LiveGrid, b = g.boards[sel], same = (n, one, many) => `${n} ${n === 1 ? one : many}`;
    const choice = cur => `<option value=""${cur === undefined ? ' selected' : ''}>(empty)</option><option value="${CLASSIC}"${cur === '' ? ' selected' : ''}>Classic table</option>${designs.map(r => `<option value="${esc(r.id)}"${cur === r.id ? ' selected' : ''}>${esc(r.name)}</option>`).join('')}`;
    const squares = Array.from({ length: G.MAXR * G.MAXC }, (_, k) => { const c = k % G.MAXC + 1, r = Math.floor(k / G.MAXC) + 1; return `<button type="button" class="lv-gp${c <= g.cols && r <= g.rows ? ' on' : ''}" data-lbgrid="${c},${r}" aria-label="${same(c, 'column', 'columns')} by ${same(r, 'row', 'rows')}" aria-pressed="${c === g.cols && r === g.rows}"></button>`; }).join('');
    const map = G.cells(g).map(x => x.board
      ? `<div class="lv-gcell${x.index === sel ? ' sel' : ''}" style="grid-column:${x.c} / span ${x.board.w};grid-row:${x.r} / span ${x.board.h}"><select aria-label="Leaderboard in ${G.where(x.board)}" data-lbcell="${x.index}">${choice(designs.some(r => r.id === x.board.opt.design) ? x.board.opt.design : '')}</select><button type="button" class="btn" data-lbsel="${x.index}" aria-pressed="${x.index === sel}">Board ${x.index + 1} settings</button></div>`
      : `<div class="lv-gcell empty" style="grid-column:${x.c};grid-row:${x.r}"><select aria-label="Leaderboard in column ${x.c}, row ${x.r}" data-lbadd="${x.c},${x.r}">${choice(undefined)}</select></div>`).join('');
    let one = '<p class="muted">Pick a leaderboard for a cell to see its settings here.</p>';
    if (b) {
      const o = b.opt, ms = G.maxSpan(g, b), shown = Widgets.def('leaderboard').options.filter(d => d.classic);
      const span = (key, n, max, label) => `<div class="field"><label for="lb-${key}">${label}</label><select id="lb-${key}" data-lbspan="${key}">${Array.from({ length: max }, (_, i) => `<option value="${i + 1}"${n === i + 1 ? ' selected' : ''}>${i + 1}</option>`).join('')}</select></div>`;
      one = `<fieldset class="lv-optset"><legend>Board ${sel + 1} (${G.where(b)})</legend><div class="lv-optgrid">
        ${span('w', b.w, ms.w, 'Columns it covers')}${span('h', b.h, ms.h, 'Rows it covers')}
        <div class="field"><label for="lb-from">From place</label><input id="lb-from" type="number" min="1" max="99" step="1" data-lb="from" value="${esc(o.from || '')}" placeholder="1"></div>
        <div class="field"><label for="lb-to">To place</label><input id="lb-to" type="number" min="0" max="99" step="1" data-lb="to" value="${esc(o.to || '')}" placeholder="last"></div>
        ${designs.some(r => r.id === o.design) ? '' : shown.map(d => d.type === 'select'
          ? `<div class="field"><label for="lb-${d.key}">${esc(d.label)}</label><select id="lb-${d.key}" data-lb="${d.key}">${d.choices.map(([k, t]) => `<option value="${k}"${(o[d.key] ?? d.default) === k ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div>`
          : `<div class="field"><label class="inline"><input id="lb-${d.key}" type="checkbox" data-lb="${d.key}" ${(o[d.key] ?? d.default) ? 'checked' : ''}> ${esc(d.label)}</label></div>`).join('')}</div></fieldset>`;
    }
    return `<div class="lv-gridtool"><div class="field"><span class="lbl" id="lb-gridlabel">Grid</span><div class="lv-gridpick" role="group" aria-labelledby="lb-gridlabel">${squares}</div><output id="lb-gridsize">${G.sizeText(g)}</output></div>
      <div class="field"><span class="lbl">Leaderboard in every cell</span><div class="lv-gridmap" style="grid-template-columns:repeat(${g.cols},minmax(0,1fr))">${map}</div></div></div>${one}`;
  };
  function drawBoard(body, fresh, keepOpen) {
    const G = LiveGrid, designs = (V.stat() && V.stat().rowDesigns) || [];
    if (fresh || !$('lv-board')) {
      if (!keepOpen) boardsOpen = false;
      const g0 = G.gridOf(state.settings); boardSel = Math.min(Math.max(boardSel, 0), Math.max(0, g0.boards.length - 1));
      body.innerHTML = `<details class="lv-opts"${boardsOpen ? ' open' : ''}><summary>Customize</summary>${gridTool(g0, designs, boardSel)}</details><div id="lv-board" class="lv-boards"></div>`;
      const save = async g => { state.settings = await api.setSettings({ liveGrid: g }); boardsOpen = true; drawBoard(body, true, true); };
      body.onclick = async e => { // a square of the grid picker, or the settings of a board
        const b = e.target.closest ? e.target.closest('[data-lbgrid],[data-lbsel]') : null, d = (b && b.dataset) || {};
        if (d.lbgrid) { const [c, r] = String(d.lbgrid).split(',').map(Number); return save(G.resize(G.gridOf(state.settings), c, r)); }
        if (d.lbsel !== undefined) { boardSel = Number(d.lbsel) || 0; boardsOpen = true; drawBoard(body, true, true); }
      };
      body.onchange = async e => {
        const t = e.target, d = t.dataset || {}, g = G.gridOf(state.settings), design = v => ({ design: v === CLASSIC ? '' : v });
        if (d.lbadd) { // a leaderboard for an empty cell
          const [c, r] = String(d.lbadd).split(',').map(Number); if (!t.value) return;
          const g2 = G.add(g, c, r, design(t.value)); boardSel = Math.max(0, g2.boards.findIndex(x => x.c === c && x.r === r)); return save(g2);
        }
        if (d.lbcell !== undefined) { // another leaderboard for a cell, or none (the board and its settings are gone)
          const i = Number(d.lbcell); boardSel = i;
          return save(t.value ? G.setOpt(g, i, design(t.value)) : G.remove(g, i));
        }
        if (d.lbspan) { const b = g.boards[boardSel]; if (!b) return; return save(G.setSpan(g, boardSel, d.lbspan === 'w' ? t.value : b.w, d.lbspan === 'h' ? t.value : b.h)); }
        if (!d.lb || !g.boards[boardSel]) return;
        const v = t.type === 'checkbox' ? t.checked : t.value;
        state.settings = await api.setSettings({ liveGrid: G.setOpt(g, boardSel, { [d.lb]: v }) }); draw(false);
      };
    }
    const g = G.gridOf(state.settings);
    $('lv-board').innerHTML = g.boards.length
      ? `<div class="lv-grid" style="grid-template-columns:repeat(${g.cols},minmax(0,1fr))">${g.boards.map(b => `<div class="lv-board" style="grid-column:${b.c} / span ${b.w};grid-row:${b.r} / span ${b.h}">${Timing.content({ type: 'leaderboard', opt: b.opt }, S()).html}</div>`).join('')}</div>`
      : '<p class="muted lv-empty">No leaderboard in the grid yet. Open Customize and pick one for a cell.</p>';
    if ($('lv-board').querySelectorAll) Rows.fitText($('lv-board')); // row designs: no text wider than its cell
  }


  // Race Director: the race's buttons and penalty points. The buttons are sent to the race in the main window.
  // The page is built once and then only updated, so a button never changes under your finger.
  const send = cmd => api.liveCommand(cmd);
  // The Race Director page (1.11.1): the buttons and the calls on top, then folders like the ones in the Help, each with a colour of its own (Penalties yellow, Balance of Power white,
  // Damage red, Weather blue). They are open to begin with, as the page was; a folder you close stays closed while the page is open.
  const dirShut = new Set();
  const folder = (id, title, note, tone, inner) => `<details class="dbfolder dirfolder${tone ? ' dir-' + tone : ''}" data-dirf="${id}"${dirShut.has(id) ? '' : ' open'}><summary><strong>${title}</strong> <span class="muted">${note}</span></summary><div class="df-body">${inner}</div></details>`;
  // The Adjust folder (1.12.0): pick a lane, then use the pads (penalty points, time, laps, championship points) for that lane. Nothing is picked to begin with, so a press never lands on the wrong lane.
  // What a pad did is kept in adjHist, to show the last action and to undo it (an undo is the same pad command with the opposite amount).
  let adjLane = null, adjRace = null, adjSig = '', rvShown = '';
  const adjHist = AdjustPad.history();
  const adjVal = (eng, lane, group) => { const c = eng.cars.find(x => x.lane === lane); return !c ? null : group === 'points' ? c.points : group === 'time' ? Math.round(c.adjMs || 0) / 1000 : group === 'laps' ? (c.adjLaps || 0) : (c.adjPoints || 0); };
  function adjDraw(st) {
    const box = $('dir-adj'); if (!box) return;
    const S = state.settings || {}, lay = AdjustPad.layoutOf(S);
    box.innerHTML = `<div class="adj-lanes" role="group" aria-label="Choose a lane">${st.cfg.entries.map(e => `<button type="button" class="btn adj-lane" data-adj-lane="${e.lane}" aria-pressed="false"><strong>Lane ${e.lane + 1}</strong><small></small></button>`).join('')}</div>
      <p class="adj-who" id="adj-who" aria-live="polite"></p>
      <div class="adj-pads" id="adj-pads">${AdjustPad.padsHtml(S, {})}</div>
      <p class="adj-line"><span id="adj-last" class="muted" aria-live="polite"></span> <button type="button" class="btn" data-adj-undo>Undo</button></p>
      <p class="adj-layout"><span class="muted">Pads:</span> <button type="button" class="btn" data-adj-layout="h" aria-pressed="${lay === 'h'}">Horizontal</button> <button type="button" class="btn" data-adj-layout="v" aria-pressed="${lay === 'v'}">Vertical</button>
        <span class="muted">The values are set in App Settings, Race Director.</span></p>`;
    adjSig = AdjustPad.signature(S);
  }
  function adjPress(pb) {
    if (pb.disabled || adjLane === null) return;
    const r = AdjustPad.read(pb), eng = V.engine(), car = eng.cars.find(c => c.lane === adjLane); if (!r || !car) return;
    adjHist.push({ lane: adjLane, group: r.group, amount: r.amount, text: AdjustPad.describe(r.group, r.amount, car.driverName), before: adjVal(eng, adjLane, r.group), at: performance.now() });
    send({ type: 'pad', group: r.group, lane: adjLane, amount: r.amount });
    drawDirector($('lv-body'), false);
  }
  function adjUndo() {
    const u = adjHist.undo(); if (u) send({ type: 'pad', group: u.group, lane: u.lane, amount: u.amount });
    drawDirector($('lv-body'), false);
  }
  async function adjLayout(v) { state.settings = await api.setSettings({ padLayout: v === 'v' ? 'v' : 'h' }); drawDirector($('lv-body'), false); }
  function adjClick(t) {
    const pick = t.closest('[data-adj-lane]'); if (pick) { if (!pick.disabled) { adjLane = Number(pick.dataset.adjLane); drawDirector($('lv-body'), false); } return; }
    const pad = t.closest('[data-pad-do]'); if (pad) return adjPress(pad);
    if (t.closest('[data-adj-undo]')) { if (adjHist.canUndo()) adjUndo(); return; }
    const lay = t.closest('[data-adj-layout]'); if (lay) adjLayout(lay.dataset.adjLayout);
  }
  // each time the page is updated: which lane is picked, which pads are shown and usable, and the line under them
  function adjUpdate(st, d, eng, on, pen) {
    const box = $('dir-adj'); if (!box) return;
    if (AdjustPad.signature(state.settings || {}) !== adjSig) adjDraw(st);
    if (adjLane !== null && !st.cfg.entries.some(e => e.lane === adjLane)) adjLane = null;
    const car = adjLane === null ? null : eng.cars.find(c => c.lane === adjLane), canAdj = eng.type === 'race' || eng.type === 'timed';
    box.querySelectorAll('[data-adj-lane]').forEach(b => {
      const l = Number(b.dataset.adjLane), c = eng.cars.find(x => x.lane === l), sm = b.querySelector ? b.querySelector('small') : null;
      b.setAttribute('aria-pressed', String(l === adjLane)); b.disabled = !on; if (sm && c) sm.textContent = c.driverName;
    });
    $('adj-who').textContent = !on ? 'The pads work while the race is running or paused.' : car ? `Lane ${car.lane + 1} · ${car.driverName}` : 'Choose a lane. The pads act on that lane.';
    box.querySelectorAll('.pad').forEach(p => {
      const id = p.dataset.pad;
      p.hidden = (id === 'points' && !pen) || (id !== 'points' && !canAdj) || (id === 'champ' && !(d.champ && d.champ.on));
      p.querySelectorAll('button,input').forEach(el => { el.disabled = !on || !car || (id === 'points' && (car.dq || (!!el.dataset && el.dataset.sign === '-1' && car.points <= 0))); });
    });
    adjHist.settle((l, g) => adjVal(eng, l, g), performance.now());
    box.querySelectorAll('[data-adj-undo]').forEach(b => { b.disabled = !on || !adjHist.canUndo(); });
    $('adj-last').textContent = adjHist.line();
    box.querySelectorAll('[data-adj-layout]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.adjLayout === AdjustPad.layoutOf(state.settings || {}))));
  }
  function drawDirector(body, fresh) {
    const st = V.stat(), pen = !!(st.cfg.penalty && st.cfg.penalty.on);
    if (fresh || !$('lv-dir')) {
      body.innerHTML = `<div id="lv-dir"><div class="lv-ctl">
          <button class="btn primary" data-cmd="start">Start</button><button class="btn" data-cmd="pause" id="dir-pause">Pause</button>
          <button class="btn" data-cmd="yellow" id="dir-yellow">Yellow flag</button><button class="btn" data-cmd="red" id="dir-red">Red flag</button>
          <button class="btn danger" data-cmd="stop">Stop race</button></div>
        <div class="card"><h3>Calls</h3>
          <div class="lv-ctl">${st.cfg.entries.map(e => `<button class="btn" data-cmd="call" data-lane="${e.lane}" title="A call from this lane: raises the yellow flag, like a call button">Call lane ${e.lane + 1}</button>`).join('')}</div>
          <ul id="dir-calls" class="lv-calls"></ul></div>
        ${st.tokenUi ? '' : folder('adjust', 'Adjust', 'Penalty points, time, laps and championship points for one lane', '', '<div id="dir-adj"></div>')}
        ${folder('penalties', 'Penalties', 'Points and penalties for each lane', 'yellow', pen ? `<div class="wrap"><table class="fields"><thead><tr><th>Lane</th><th>Driver</th><th>Points</th><th>Time penalty</th><th>Not served yet</th><th></th></tr></thead><tbody>${st.cfg.entries.map(e =>
          `<tr data-row="${e.lane}"><td>${e.lane + 1}</td><td>${esc(e.driverName)}</td><td class="num dir-pts"></td><td class="num dir-sec"></td><td class="dir-pend"></td>
           <td class="actions"><button class="btn" data-cmd="penalty" data-lane="${e.lane}" data-n="-1" aria-label="Take back a point from ${esc(e.driverName)}">−1</button> <button class="btn danger" data-cmd="penalty" data-lane="${e.lane}" data-n="1">Penalty point +1</button>
           ${(st.cfg.penalty.types || []).map((t, ti) => `<button class="btn" data-cmd="assign" data-lane="${e.lane}" data-type="${ti}" title="Costs ${t.cost} penalty points; has to be served in the pits">${esc(t.name)} (−${t.cost})</button>`).join(' ')}</td></tr>`).join('')}</tbody></table></div>
          <h3>Penalty log</h3><ol id="dir-log" class="lv-log"></ol>` : '<p class="muted">This race has no penalty system. Choose one in the race setup to give penalty points.</p>')}
        ${st.cfg.bop ? folder('bop', 'Balance of Power', 'Even out fast and slow cars', 'white', '<div id="dir-bop" class="boppanel"></div>') : ''}
        ${st.cfg.damage ? folder('damage', 'Damage', 'Incidents and repairs', 'red', '<div id="dir-dm" class="boppanel"></div>') : ''}
        ${st.cfg.weather ? folder('weather', 'Weather', 'Rain, tyres and pit stops', 'blue', '<div id="dir-wx" class="boppanel"></div>') : ''}
        ${st.cfg.endurance ? folder('endurance', 'Endurance', 'Driver swaps', '', '<div id="dir-en" class="boppanel"></div>') : ''}
        <details class="card" id="dir-lapsbox" hidden><summary>Review laps</summary><div id="dir-laps" class="rv"></div></details>
        <div id="dir-review" class="card rv" hidden></div></div>`;
      if (adjRace !== st.raceId) { adjRace = st.raceId; adjLane = null; adjHist.clear(); } adjDraw(st);
      lapsHtml = ''; rvShown = ''; bopPanel = st.cfg.bop ? BopPanel.build($('dir-bop'), { eng: () => V.engine(), lanes: st.cfg.entries.map(e => e.lane).sort((a, b) => a - b), phase: () => V.dyn().phase, send: (l, how) => send({ type: 'bop', lane: l, how }) }) : null; // Balance of Power: the same lane controls as on the main computer
      wxPanel = st.cfg.weather ? WeatherPanel.build($('dir-wx'), { eng: () => V.engine(), lanes: st.cfg.entries.map(e => e.lane).sort((a, b) => a - b), phase: () => V.dyn().phase, now: () => V.clock(performance.now()), send: state => send({ type: 'weather', state }) }) : null; // the weather: the same controls as on the main computer
      enPanel = st.cfg.endurance ? EndurancePanel.build($('dir-en'), { eng: () => V.engine(), lanes: st.cfg.entries.map(e => e.lane).sort((a, b) => a - b), phase: () => V.dyn().phase, now: () => V.clock(performance.now()), send: (l, what, id) => send(what === 'swap' ? { type: 'swap', lane: l, ...(id ? { to: id } : {}) } : { type: 'swapnext', lane: l, id }) }) : null; // an Endurance Race: the swaps, the same controls as on the main computer
      dmPanel = st.cfg.damage ? DamagePanel.build($('dir-dm'), { eng: () => V.engine(), lanes: st.cfg.entries.map(e => e.lane).sort((a, b) => a - b), incidents: st.cfg.damage.incidents, phase: () => V.dyn().phase, now: () => V.clock(performance.now()), send: (l, n) => send({ type: 'damage', lane: l, n }) }) : null; // the damage of the cars, the same controls as on the main computer
      if (body.querySelectorAll) body.querySelectorAll('details.dirfolder').forEach(el => { el.ontoggle = () => { if (el.open) dirShut.delete(el.dataset.dirf); else dirShut.add(el.dataset.dirf); }; });
      Review.bind($('dir-review'), c => send({ type: 'review', ...c }), () => drawDirector($('lv-body'), false));
      Review.bind($('dir-laps'), c => send({ type: 'review', ...c }), () => drawDirector($('lv-body'), false));
      body.onclick = e => {
        const b = e.target.closest('[data-cmd]');
        if (!b) return adjClick(e.target); // (not a button of the race: maybe one of the Adjust folder)
        if (b.disabled) return;
        if (b.dataset.cmd === 'stop' && !confirm('Stop the race now? The laps so far are saved.')) return;
        send({ type: b.dataset.cmd, lane: b.dataset.lane === undefined ? undefined : Number(b.dataset.lane), n: b.dataset.n === undefined ? undefined : Number(b.dataset.n), typeIndex: b.dataset.type === undefined ? undefined : Number(b.dataset.type), id: b.dataset.id === undefined ? undefined : Number(b.dataset.id), how: b.dataset.how });
      };
    }
    const d = V.dyn(), eng = V.engine(), on = d.phase === 'running' || d.phase === 'paused', set = (sel, fn) => body.querySelectorAll(sel).forEach(fn);
    set('[data-cmd="start"]', b => { b.disabled = !(d.phase === 'ready' || d.phase === 'between') || !!d.calling; });
    set('[data-cmd="pause"]', b => { b.disabled = !on; b.textContent = d.phase === 'paused' ? 'Resume' : 'Pause'; });
    set('[data-cmd="yellow"]', b => { b.disabled = !on; b.setAttribute('aria-pressed', String(eng.flag === 'yellow')); });
    set('[data-cmd="red"]', b => { b.disabled = !on; b.setAttribute('aria-pressed', String(eng.flag === 'red')); });
    set('[data-cmd="stop"]', b => { b.disabled = !(on || d.phase === 'between'); });
    set('[data-cmd="call"]', b => { b.disabled = !on; });
    // the calls that wait: the list is only rebuilt when they change, so a button never changes under your finger
    const open = (eng.calls || []).filter(c => c.open), list = $('dir-calls'), key = open.map(c => `${c.id}:${c.car}${eng.cars[c.car] && eng.cars[c.car].dq ? 'd' : ''}`).join() || '-';
    if (list.dataset.key !== key) {
      list.dataset.key = key;
      list.innerHTML = open.length ? open.map(c => { const car = eng.cars[c.car]; if (!car) return '';
        return `<li><span><strong>Lane ${car.lane + 1}</strong> · ${esc(car.driverName)} called</span><button class="btn" data-cmd="callresolve" data-id="${c.id}" data-how="dismiss">Dismiss</button>${pen && !car.dq ? `<button class="btn danger" data-cmd="callresolve" data-id="${c.id}" data-how="penalty">Penalty point +1</button>` : ''}</li>`; }).join('')
        : '<li class="muted">No calls waiting. A call raises the yellow flag; you decide what it means.</li>';
    }
    set('[data-cmd="callresolve"]', b => { b.disabled = !on; });
    adjUpdate(st, d, eng, on, pen);
    if (bopPanel) bopPanel.update();
    if (wxPanel) wxPanel.update();
    if (enPanel) enPanel.update();
    if (dmPanel) dmPanel.update();
    // during the race: the laps of every car, to mark a lap invalid or take it out. Drawn again only when something in it changed, so a button never changes under your finger.
    const lb = $('dir-lapsbox'), tv = d.tokens ? Tokens.view(d.tokens) : null; lb.hidden = !on;
    if (on) { const h = Review.lapsHtml(eng, { late: tv ? (i, n) => tv.lateAt(eng.cars[i].lane, n) : null }); if (h !== lapsHtml) { lapsHtml = h; $('dir-laps').innerHTML = h; } } else lapsHtml = '';
    const rv = $('dir-review'); // after the race: the review, with the same corrections as in the race window (a Time Token Session is checked on the main computer)
    if (d.phase === 'review') { // (drawn again only when it changed, so what you type in the field of a pad stays)
      const h = st.tokenUi ? '<h3>Session review</h3><p class="muted">The session is over. The stints are checked on the main computer, where Finalize is pressed.</p>' : Review.html(eng, { champ: d.champ, settings: state.settings });
      rv.hidden = false; if (h !== rvShown) { rvShown = h; rv.innerHTML = h; }
    } else if (!rv.hidden) { rv.hidden = true; rv.innerHTML = ''; rvShown = ''; }
    if (!pen) return;
    st.cfg.entries.forEach(e => {
      const row = body.querySelector(`[data-row="${e.lane}"]`), c = eng.cars.find(x => x.lane === e.lane); if (!row || !c) return;
      row.querySelector('.dir-pts').textContent = c.dq ? 'DQ' : String(c.points);
      const sec = eng.penMs(c) / 1000; row.querySelector('.dir-sec').textContent = sec ? `+${Number.isInteger(sec) ? sec : sec.toFixed(1)} s` : '–';
      row.querySelector('[data-n="1"]').disabled = !on || c.dq;
      row.querySelector('[data-n="-1"]').disabled = !(on && c.points > 0);
      row.querySelector('.dir-pend').textContent = c.pending.map(p => p.name).join(', ') || '–';
      row.querySelectorAll('[data-cmd="assign"]').forEach(b => { const ty = (st.cfg.penalty.types || [])[Number(b.dataset.type)]; b.disabled = !on || c.dq || !ty || c.points < ty.cost; });
    });
    const log = (eng.events || []).filter(x => ['penalty', 'disqualified', 'reinstated', 'assigned', 'served', 'leftearly', 'forgiven', 'timeadded', 'damage', 'repaired', 'repairearly', 'damagelate', 'damageout'].includes(x.type)).slice(-12).reverse();
    $('dir-log').innerHTML = log.length ? log.map(x => { const c = eng.cars[x.car], who = esc(c ? c.driverName : '?');
      return `<li>${x.type === 'penalty' ? `${who}: ${x.delta > 0 ? '+' : ''}${x.delta} point${Math.abs(x.delta) === 1 ? '' : 's'} (now ${x.points}${x.ms ? ', +' + x.ms / 1000 + ' s' : ''})` : x.type === 'disqualified' ? `${who} is disqualified` : x.type === 'reinstated' ? `${who} is back in the race` : x.type === 'assigned' ? `${who} must serve: ${esc(x.name)}` : x.type === 'served' ? `${who} served: ${esc(x.name)}` : x.type === 'leftearly' ? `${who} left too early (${esc(x.name)})${x.extra ? `, +${x.extra} point${x.extra === 1 ? '' : 's'}` : ''}` : x.type === 'forgiven' ? `${who}: ${esc(x.name)} forgiven` : x.type === 'damage' ? `${who}: ${x.delta > 0 ? '+' : ''}${x.delta} damage point${Math.abs(x.delta) === 1 ? '' : 's'} (now ${x.points}${x.name ? ', ' + esc(x.name) : ''})${x.why === 'deslot' ? ', a deslot' : ''}` : x.type === 'repaired' ? `${who} repaired: ${esc(x.name)} (${Math.round(x.ms / 100) / 10} s in the pits)` : x.type === 'repairearly' ? `${who} left the pits before the repair was done (${esc(x.name)})${x.extra ? `, +${x.extra} penalty point${x.extra === 1 ? '' : 's'}` : ''}` : x.type === 'damagelate' ? `${who} is late for the pits (${esc(x.name)})${x.points ? `, +${x.points} penalty point${x.points === 1 ? '' : 's'}` : ''}` : x.type === 'damageout' ? `${who} is ${x.how === 'dq' ? 'disqualified' : 'retired'} by damage (${esc(x.name)})` : `${who}: +${x.ms / 1000} s added`}</li>`; }).join('') : '<li class="muted">No penalties yet.</li>';
  }

  // Tokens (Time Token Session): the same lane controls as on the main computer. The clocks, the time buttons and the drivers come with the race;
  // what is pressed here is sent to the race window (the same way as the Race Director's buttons), which does it and sends the new state back.
  function drawTokens(body, fresh) {
    const st = V.stat(), ui = st.tokenUi;
    if (!ui) { if (fresh || body.dataset.k !== 'notoken') { body.innerHTML = '<p class="muted lv-empty">No Time Token Session is running. Open one from the Home tab (a race setup with the session type Time Token Session).</p>'; body.dataset.k = 'notoken'; } tkPanel = null; return; }
    if (fresh || !tkPanel || !$('lv-tokens')) {
      body.innerHTML = '<div class="row" id="lv-tkopen" hidden><button class="btn primary" data-cmd="start">Open the session</button><span class="muted">Until it is opened, the clocks do not run.</span></div><div id="lv-tokens" class="card tkpanel"></div>';
      const T = () => { const eng = V.engine(); return eng.elapsed(V.clock(performance.now())); };
      const K = () => (V.hasRace() ? Tokens.view(V.dyn().tokens) : null);
      const lanes = st.cfg.entries.map(e => e.lane).sort((a, b) => a - b);
      tkPanel = TokenPanel.build($('lv-tokens'), { tokens: K, lanes, drivers: ui.drivers, increments: ui.increments, decrements: ui.decrements || [], T, phase: () => V.dyn().phase,
        label: l => { const c = V.engine().cars.find(x => x.lane === l); return (c && c.driverId) || ''; },
        ops: { add: (l, m) => send({ type: 'addtime', lane: l, minutes: m }), reduce: (l, m) => send({ type: 'reducetime', lane: l, minutes: m }), undo: l => send({ type: 'undotime', lane: l }), end: l => send({ type: 'endtime', lane: l }),
          clear: l => send({ type: 'cleartime', lane: l }), who: (l, id) => send({ type: 'setdriver', lane: l, driverId: id }), pause: () => send({ type: 'pause' }) } });
      body.onclick = e => { const b = e.target.closest && e.target.closest('#lv-tkopen [data-cmd]'); if (b && !b.disabled) send({ type: 'start' }); };
    }
    const d = V.dyn(); $('lv-tkopen').hidden = d.phase !== 'ready';
    tkPanel.update();
  }

  // Driver stats: pick a lane, see the same values the widgets show
  const STATS = ['position', 'lap', 'laptime', 'bestlap', 'avglap', 'medlap', 'gap', 'recordlap', 'speed', 'fuel', 'pitstop', 'penalty', 'champpoints'];
  function drawDriver(body, fresh) {
    const entries = V.stat().cfg.entries, st = S();
    if (lane === null || !entries.some(e => e.lane === lane)) lane = entries.length ? entries[0].lane : null;
    if (fresh || !$('lv-dstats')) {
      body.innerHTML = `<div class="lv-lanes">${entries.map(e => `<button class="btn" data-lane="${e.lane}" aria-pressed="${e.lane === lane}">${esc(e.driverName)} <span class="muted">lane ${e.lane + 1}</span></button>`).join('')}</div><div id="lv-dstats" class="lv-dstats"></div>`;
      body.onclick = e => { const b = e.target.closest('[data-lane]'); if (b) { lane = Number(b.dataset.lane); draw(true); } };
    }
    if (lane === null) return;
    const W = type => Widgets.newWidget(type, lane, 0, 0), cell = (label, html) => `<div class="lv-stat"><span class="muted">${esc(label)}</span><strong>${html}</strong></div>`;
    const c = st.carByLane(lane), f = st.eng.fuel && st.eng.fuel.on;
    const lastW = { ...W('lastlap'), opt: { lapsPerColumn: 8, columns: 1, lapNumbers: true } };
    $('lv-dstats').innerHTML = `<div class="lv-who">${Timing.content(W('avatar'), st).html}<div><div class="lv-big">${Timing.content(W('name'), st).html} ${Timing.content(W('driverflag'), st).html}</div><div class="muted">${esc(c ? c.carName : '')}</div></div>${Timing.content(W('carpicture'), st).html}</div>
      <div class="lv-statgrid">${STATS.filter(t => (t !== 'fuel' || f) && (t !== 'penalty' || st.eng.penalty.on) && (t !== 'champpoints' || st.champ.on)).map(t => cell(Widgets.def(t).title || Widgets.def(t).label, Timing.content(W(t), st).html)).join('')}</div>
      <h3>Laps</h3><div class="lv-laps">${Timing.content(lastW, st).html || '<span class="muted">No laps yet</span>'}</div>`;
  }

  // ---- keeping up with the race ----
  function repaint() { status(); if (page !== 'tiles' && page !== 'rules' && page !== 'database') draw(false); }
  async function mount(el, opts = {}) {
    unmount();
    host = el; second = !!opts.second; V = LiveShare.viewer(); page = 'tiles'; nodes = null; tkPanel = null; bopPanel = null; wxPanel = null; enPanel = null; dmPanel = null; lane = null;
    try { state.settings = await api.getSettings(); } catch { /* keep what we have */ }
    let got = null; try { got = await api.liveGet(); } catch { /* no race data yet: the pages open empty and fill in from the live messages */ }
    if (got && got.stat) { V.feedStatic(got.stat); if (got.dyn) V.feedDynamic(got.dyn, performance.now()); }
    offs.push(api.onLiveStatic(s => { V.feedStatic(s); nodes = null; if (page !== 'tiles') draw(true); status(); }));
    // a message that does not fit (one was missed, for instance after the wifi dropped out for a moment): fetch the whole state from the app and carry on from there
    let syncing = false;
    const resync = async () => {
      if (syncing) return; syncing = true;
      try {
        const g = await api.liveGet(), mine = V;
        if (V === mine && g && g.stat) {
          if (!V.stat() || V.stat().raceId !== g.stat.raceId) { V.feedStatic(g.stat); nodes = null; }
          if (g.dyn && V.feedDynamic(g.dyn, performance.now())) { if (page !== 'tiles' && !nodes && page === 'timing') draw(true); else repaint(); }
        }
      } catch { /* the next message tries again */ } finally { syncing = false; }
    };
    offs.push(api.onLive(d => {
      if (!V) return;
      if (V.feedDynamic(d, performance.now())) { if (page !== 'tiles' && !nodes && page === 'timing') draw(true); else repaint(); }
      else if (V.needsSync()) resync();
    }));
    ticker = setInterval(() => { if (live() && ['running', 'countdown'].includes(V.dyn().phase)) repaint(); }, 100); // clocks keep running between messages
    if (second && !keyOff) { keyOff = ev => { if (ev.key === 'Escape') { api.liveFullscreen(false); if ($('lv-full')) $('lv-full').textContent = 'Full screen'; } }; document.addEventListener('keydown', keyOff); }
    host.onpointermove = reveal; host.onpointerdown = reveal;
    shell(); draw(true);
  }
  function unmount() { if (host) { host.onpointermove = null; host.onpointerdown = null; if (host.classList) { host.classList.remove('lv-clean'); host.classList.remove('lv-show'); } } clearTimeout(revealT); if (keyOff) { document.removeEventListener('keydown', keyOff); keyOff = null; } offs.forEach(f => f()); offs = []; clearInterval(ticker); ticker = null; host = null; V = null; nodes = null; tkPanel = null; }
  return { mount, unmount, go, nodes: () => nodes };
})();
