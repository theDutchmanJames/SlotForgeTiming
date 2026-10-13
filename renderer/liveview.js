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
  let keyOff = null, host = null, V = null, page = 'tiles', nodes = null, tkPanel = null, lane = null, ticker = null, offs = [], second = false, lapsHtml = '';

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

  function go(p) { page = p; nodes = null; tkPanel = null; shell(); draw(true); }

  // ---- the pages ----
  function draw(fresh) {
    const body = $('lv-body'); if (!body) return;
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

  function drawTiming(body, fresh) {
    if (!nodes || fresh) {
      body.innerHTML = '<div class="rt-stage"><div class="canvas live" id="lv-canvas"></div></div>';
      nodes = LiveCanvas.build($('lv-canvas'), V.stat().layout, V.stat().lanes, { maxH: 110 });
    }
    LiveCanvas.paint(nodes, S());
  }

  // Leaderboard page: one or two boards (one under the other, or side by side). Each board is the Leaderboard widget with its own
  // row design (Customization > Leaderboard Editor) or the classic table. The choices are saved for this page.
  const boardKey = i => (i ? 'liveBoard2' : 'liveBoard');
  function drawBoard(body, fresh) {
    const defs = Widgets.def('leaderboard').options.filter(o => o.type !== 'rowdesign' && o.type !== 'range'), designs = (V.stat() && V.stat().rowDesigns) || [];
    const cfg = state.settings.liveBoards || {}, count = cfg.count === 2 ? 2 : 1, side = cfg.side === true;
    if (fresh || !$('lv-board')) {
      const one = i => {
        const saved = state.settings[boardKey(i)] || {};
        return `<fieldset class="lv-optset"><legend>${count > 1 ? `Board ${i + 1}` : 'Board'}</legend><div class="lv-optgrid"><div class="field"><label for="lb-design${i}">Row design</label><select id="lb-design${i}" data-lb="design" data-b="${i}"><option value="">Classic table</option>${designs.map(r => `<option value="${esc(r.id)}"${saved.design === r.id ? ' selected' : ''}>${esc(r.name)}</option>`).join('')}</select></div>${saved.design ? '' : defs.map(o => o.type === 'select'
          ? `<div class="field"><label for="lb-${o.key}${i}">${esc(o.label)}</label><select id="lb-${o.key}${i}" data-lb="${o.key}" data-b="${i}">${o.choices.map(([k, t]) => `<option value="${k}"${(saved[o.key] ?? o.default) === k ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div>`
          : `<div class="field"><label class="inline"><input id="lb-${o.key}${i}" type="checkbox" data-lb="${o.key}" data-b="${i}" ${(saved[o.key] ?? o.default) ? 'checked' : ''}> ${esc(o.label)}</label></div>`).join('')}</div></fieldset>`;
      };
      body.innerHTML = `<details class="lv-opts"><summary>Customize</summary>
        <div class="lv-optgrid"><div class="field"><label for="lb-count">Boards shown</label><select id="lb-count" data-lbcfg="count"><option value="1"${count === 1 ? ' selected' : ''}>One</option><option value="2"${count === 2 ? ' selected' : ''}>Two</option></select></div>
          ${count === 2 ? `<div class="field"><label for="lb-side">Arranged</label><select id="lb-side" data-lbcfg="side"><option value="stack"${side ? '' : ' selected'}>One under the other</option><option value="side"${side ? ' selected' : ''}>Side by side</option></select></div>` : ''}</div>
        ${one(0)}${count === 2 ? one(1) : ''}</details>
        <div id="lv-board" class="lv-boards${count === 2 && side ? ' side' : ''}"></div>`;
      body.onchange = async e => {
        const t = e.target, d = t.dataset || {};
        if (d.lbcfg) { const c = { ...(state.settings.liveBoards || {}) }; if (d.lbcfg === 'count') c.count = Number(t.value); else c.side = t.value === 'side'; state.settings = await api.setSettings({ liveBoards: c }); return drawBoard(body, true); }
        if (!d.lb) return;
        const key = boardKey(Number(d.b) || 0), o = { ...(state.settings[key] || {}), [d.lb]: t.type === 'checkbox' ? t.checked : t.value };
        state.settings = await api.setSettings({ [key]: o }); if (d.lb === 'design') drawBoard(body, true); else draw(false);
      };
    }
    $('lv-board').innerHTML = Array.from({ length: count }, (_, i) => `<div class="lv-board">${Timing.content({ type: 'leaderboard', opt: state.settings[boardKey(i)] || {} }, S()).html}</div>`).join('');
    if ($('lv-board').querySelectorAll) Rows.fitText($('lv-board')); // row designs: no text wider than its cell
  }


  // Race Director: the race's buttons and penalty points. The buttons are sent to the race in the main window.
  // The page is built once and then only updated, so a button never changes under your finger.
  const send = cmd => api.liveCommand(cmd);
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
        ${pen ? `<div class="wrap"><table class="fields"><thead><tr><th>Lane</th><th>Driver</th><th>Points</th><th>Time penalty</th><th>Not served yet</th><th></th></tr></thead><tbody>${st.cfg.entries.map(e =>
          `<tr data-row="${e.lane}"><td>${e.lane + 1}</td><td>${esc(e.driverName)}</td><td class="num dir-pts"></td><td class="num dir-sec"></td><td class="dir-pend"></td>
           <td class="actions"><button class="btn" data-cmd="penalty" data-lane="${e.lane}" data-n="-1" aria-label="Take back a point from ${esc(e.driverName)}">−1</button> <button class="btn danger" data-cmd="penalty" data-lane="${e.lane}" data-n="1">Penalty point +1</button>
           ${(st.cfg.penalty.types || []).map((t, ti) => `<button class="btn" data-cmd="assign" data-lane="${e.lane}" data-type="${ti}" title="Costs ${t.cost} penalty points; has to be served in the pits">${esc(t.name)} (−${t.cost})</button>`).join(' ')}</td></tr>`).join('')}</tbody></table></div>
          <h3>Penalty log</h3><ol id="dir-log" class="lv-log"></ol>` : '<p class="muted">This race has no penalty system. Choose one in the race setup to give penalty points.</p>'}
        <details class="card" id="dir-lapsbox" hidden><summary>Review laps</summary><div id="dir-laps" class="rv"></div></details>
        <div id="dir-review" class="card rv" hidden></div></div>`;
      lapsHtml = '';
      Review.bind($('dir-review'), c => send({ type: 'review', ...c }), () => drawDirector($('lv-body'), false));
      Review.bind($('dir-laps'), c => send({ type: 'review', ...c }), () => drawDirector($('lv-body'), false));
      body.onclick = e => {
        const b = e.target.closest('[data-cmd]'); if (!b || b.disabled) return;
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
    // during the race: the laps of every car, to mark a lap invalid or take it out. Drawn again only when something in it changed, so a button never changes under your finger.
    const lb = $('dir-lapsbox'), tv = d.tokens ? Tokens.view(d.tokens) : null; lb.hidden = !on;
    if (on) { const h = Review.lapsHtml(eng, { late: tv ? (i, n) => tv.lateAt(eng.cars[i].lane, n) : null }); if (h !== lapsHtml) { lapsHtml = h; $('dir-laps').innerHTML = h; } } else lapsHtml = '';
    const rv = $('dir-review'); // after the race: the review, with the same corrections as in the race window (a Time Token Session is checked on the main computer)
    if (d.phase === 'review') { rv.hidden = false; rv.innerHTML = st.tokenUi ? '<h3>Session review</h3><p class="muted">The session is over. The stints are checked on the main computer, where Finalize is pressed.</p>' : Review.html(eng); } else if (!rv.hidden) { rv.hidden = true; rv.innerHTML = ''; }
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
    const log = (eng.events || []).filter(x => ['penalty', 'disqualified', 'reinstated', 'assigned', 'served', 'leftearly', 'forgiven', 'timeadded'].includes(x.type)).slice(-12).reverse();
    $('dir-log').innerHTML = log.length ? log.map(x => { const c = eng.cars[x.car], who = esc(c ? c.driverName : '?');
      return `<li>${x.type === 'penalty' ? `${who}: ${x.delta > 0 ? '+' : ''}${x.delta} point${Math.abs(x.delta) === 1 ? '' : 's'} (now ${x.points}${x.ms ? ', +' + x.ms / 1000 + ' s' : ''})` : x.type === 'disqualified' ? `${who} is disqualified` : x.type === 'reinstated' ? `${who} is back in the race` : x.type === 'assigned' ? `${who} must serve: ${esc(x.name)}` : x.type === 'served' ? `${who} served: ${esc(x.name)}` : x.type === 'leftearly' ? `${who} left too early (${esc(x.name)})${x.extra ? `, +${x.extra} point${x.extra === 1 ? '' : 's'}` : ''}` : x.type === 'forgiven' ? `${who}: ${esc(x.name)} forgiven` : `${who}: +${x.ms / 1000} s added`}</li>`; }).join('') : '<li class="muted">No penalties yet.</li>';
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
    host = el; second = !!opts.second; V = LiveShare.viewer(); page = 'tiles'; nodes = null; tkPanel = null; lane = null;
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
    shell(); draw(true);
  }
  function unmount() { if (keyOff) { document.removeEventListener('keydown', keyOff); keyOff = null; } offs.forEach(f => f()); offs = []; clearInterval(ticker); ticker = null; host = null; V = null; nodes = null; tkPanel = null; }
  return { mount, unmount, go, nodes: () => nodes };
})();
