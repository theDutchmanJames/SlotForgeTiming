// The live timing page: your layout filled with the running race, plus saving every lap.
// Keys: Space starts / pauses / resumes, Y yellow flag, R red flag, 1-6 cross the line on that lane.
let live = null; // { phase, timers, sim, key, laps, stopping, flash, lights, nodes, ... }
const raceActive = () => !!live && ['countdown', 'running', 'paused', 'between', 'review'].includes(live.phase);

// The race screen has its own place on the page (#racehost), so a race can keep running while another tab is shown (app.js: showRace, raceKept).
// Coming back to the Race tab shows the same race again: nothing is built a second time.
const raceHost = () => document.getElementById('racehost') || view;

async function renderRace() {
  const r = state.race;
  if (!r) { state.tab = 'home'; return render(); }
  if (live && live.alive && live.raceRef === r) { if (live.shown) live.shown(); return; } // the same race, still there: show it again
  const [drivers, cars, layouts, allLaps, penSystems, fuelRules, rowDesigns, imageSets, audioSets] = await Promise.all(['drivers', 'slotcars', 'layouts', 'laps', 'penaltysystems', 'fuelrules', 'rowdesigns', 'imagesets', 'audiosets'].map(e => api.list(e)));
  const find = (list, id) => list.find(x => x.id === id);
  const speed = state.speed || 1; // only changed by automated tests
  const setup = r.setup, heats = setup.sessionType === 'heats', tokenSession = setup.sessionType === 'tokens'; // (a Time Token Session: lanes are switched on with paid time, see tokens.js)
  const nameOf = (entity, list, id) => { const it = find(list, id); return it ? titleOf(entity, it) : ''; };
  const personOf = driverId => { const d = find(drivers, driverId); return { driverId: d ? d.id : '', driverName: d ? titleOf('drivers', d) : 'Guest', nickname: d ? d.nickname || '' : '', callsign: d ? d.callsign || '' : '', flag: d ? d.flag || '' : '', avatar: d ? d.avatar || '' : '' }; };
  const people = r.rows.map(x => {
    const d = find(drivers, x.driverId) || {};
    return { driverId: x.driverId || '', carId: x.carId || '', driverName: nameOf('drivers', drivers, x.driverId) || (tokenSession ? 'Guest' : ''), carName: nameOf('slotcars', cars, x.carId), carPicture: (find(cars, x.carId) || {}).picture || '', carScale: (find(cars, x.carId) || {}).scale || '',
      nickname: d.nickname || '', callsign: d.callsign || '', flag: d.flag || '', avatar: d.avatar || '' };
  });
  const lanes = Math.max(1, Math.floor(Number(r.track.lanes)) || people.length);
  const engineType = tokenSession ? 'practice' : heats ? (setup.heatBy === 'time' ? 'timed' : 'race') : setup.sessionType;
  const fuelCfg = RaceEngine.fuelConfig(setup, find(fuelRules, setup.fuelRules)), pitMs = fuelCfg.pitHold; // fuel on/off, tank, use per lap, refuel speed; pit stop hold time
  const penCfg = RaceEngine.penaltyConfig(find(penSystems, setup.penaltySystem)); // penalty points and how they turn into time
  // a final has its own length (0 is the same as a heat). lenNow: the length of the race that is racing, or is next while the race waits between two races
  const finalLen = () => ({ laps: Number(setup.finalLaps) > 0 ? Number(setup.finalLaps) : setup.laps, duration: Number(setup.finalDuration) > 0 ? Number(setup.finalDuration) : setup.duration });
  const lenNow = () => (heat && heat.isFinal() ? finalLen() : { laps: setup.laps, duration: setup.duration });
  const setupNow = () => (heat && heat.isFinal() ? { ...setup, ...finalLen() } : setup);
  const mk = entries => RaceEngine.createRace({ penalty: penCfg, type: engineType, laps: lenNow().laps, duration: lenNow().duration, endRule: setup.endRule, minLap: Math.max(RaceEngine.MIN_LAP, (Number(r.track.minLap) || 0) * 1000) / speed, maxLap: (Number(r.track.maxLap) || 0) * 1000 / speed, fuel: fuelCfg, yellow: RaceEngine.yellowConfig(setup), skipFirst: tokenSession || setup.firstLap === 'skip', entries });
  const pointList = String(setup.points || '').split(',').filter(t => t.trim() !== '').map(Number).filter(n => !isNaN(n)); // '10, 8, 6' -> [10, 8, 6]; blank pieces are skipped (Number('') would make them 0)

  let heat = null, eng;
  if (heats) {
    const schedule = Heats.fits(r.schedule, people.length, lanes) ? r.schedule : Heats.plan({ count: people.length, lanes, setup, seed: Heats.newSeed() }); // (the plan from the Home tab, when there is one that fits)
    heat = RaceEngine.createHeatRace({ participants: people, schedule, lanes, resultBy: setup.resultBy, points: setup.resultBy === 'points' ? pointList : [], ...RaceEngine.scoringOf(setup), ...RaceEngine.finalsOf(setup) });
    eng = mk(heat.entries());
  } else if (tokenSession) eng = mk(Array.from({ length: lanes }, (_, i) => ({ lane: i, ...(people[i] || { driverId: '', carId: '', driverName: 'Guest', carName: '', carPicture: '', carScale: '', nickname: '', callsign: '', flag: '', avatar: '' }) }))); // every lane of the track can be sold, with or without a driver
  else eng = mk(people.map((p, i) => ({ lane: i, ...p })));

  if (live) { if (live.fsView) live.fsView.close(); document.removeEventListener('keydown', live.fsKey); live.callRun = -1; live.calling = false; clearTimeout(live.callTimer); Sound.stop(); if (live.offTm) live.offTm(); if (live.offTmStatus) live.offTmStatus(); if (live.offCmd) live.offCmd(); if (live.offResync) live.offResync(); clearTimeout(live.shareTimer); clearInterval(live.timers); clearInterval(live.breakTimer); (live.sim || []).forEach(clearTimeout); if (live.flushTokens) live.flushTokens(); document.removeEventListener('keydown', live.key); }
  // earlier laps on this track, for personal best / track record highlights and the record lap widget
  const base = { personal: new Map(), track: Infinity, trackName: '' };
  // laps removed from the records (but kept in their session) do not count here
  allLaps.filter(l => l.trackId === r.track.id && !!l.token === tokenSession).forEach(l => { // (Racing Records and Token Records are separate pools)
    if (!l.noTrackRecord && l.time < base.track) { base.trackName = nameOf('drivers', drivers, l.driverId) || (l.driverId ? '(deleted)' : 'Guest'); base.track = l.time; } // (a Guest, who has no driver in the database, can hold the track record of the Token Records)
    if (!l.noPersonalBest && l.driverId) base.personal.set(l.driverId, Math.min(base.personal.get(l.driverId) ?? Infinity, l.time)); // (a Guest has no personal best)
  });
  live = { penBtns: [], phase: 'ready', calling: false, callRun: 0, callTimer: null, timers: null, sim: [], key: null, laps: [], stopping: false, flash: new Map(), lights: 0, nodes: [], lapBtns: [], pitBtns: [], callBtns: [], callsKey: null, // (null: the strip is drawn the first time)
    alive: true, raceRef: r, extraBy: new Map(), bestBy: new Map(), bestAll: Infinity, bestAllName: '', priorBy: new Map(), priorAll: Infinity, priorAllName: '', lapsOpen: false, lapSig: null, rvHtml: '' }; // (prior: the bests of the heats that are finished)
  Review.reset();
  // a Time Token Session: the token clocks of the lanes (tokens.js). They run on the race clock, so a pause stops them.
  const tokenSet = Tokens.settingsOf(state.settings);
  const tokens = tokenSession ? Tokens.create({ lanes, warnSeconds: tokenSet.warnSeconds, warnColor: tokenSet.warnColor, outColor: tokenSet.outColor }) : null;
  live.tokens = tokens; live.base = base; // (for the automated tests, and the lane controls)
  if (tokens) eng.cars.forEach(c => tokens.assign(c.lane, { driverId: c.driverId || '', driverName: c.driverName || 'Guest', carId: c.carId || '', carName: c.carName || '' }));
  const layout = find(layouts, setup.layout) || (tokenSession ? Widgets.tokenLayout() : Widgets.defaultLayout());

  const brk = heats ? Heats.breakOf(setup) : { seconds: 0, auto: false }; // the break between two heats
  const finalsOn = heats && heat.total > heat.count, fmode = heats ? RaceEngine.finalsOf(setup) : null, byPts = setup.resultBy === 'points';
  const finalsSaid = !finalsOn ? '' : Heats.finalsSaid(fmode);
  const scoreNote = heats ? [Heats.scoringText(heat.scoring, byPts), finalsSaid].filter(Boolean).join(' ') : ''; // how the overall result is counted, when it is not the standard
  const scoreCol = heats && (heat.scoring.countBy !== 'total' || heat.scoring.dropWorst || (finalsOn && fmode.finalMode === 'added')); // a column with the result that counts (average, best heats, worst heat dropped, a final that is added)
  const finalsNote = !finalsOn ? '' : `, then ${heat.total - heat.count === 2 ? 'finals B and A' : 'a final A'}${setup.heatBy === 'time' ? (Number(setup.finalDuration) > 0 ? ` of ${setup.finalDuration} minutes` : '') : (Number(setup.finalLaps) > 0 ? ` of ${setup.finalLaps} laps` : '')}`;
  const limit = tokenSession ? 'paid time per lane' : heats ? `${heat.count} heats, each ${setup.heatBy === 'time' ? setup.duration + ' minutes' : setup.laps + ' laps'}${finalsNote}`
    : setup.sessionType === 'race' ? `${setup.laps} laps` : (setup.sessionType === 'timed' || setup.sessionType === 'qualifying') ? `${setup.duration} minutes` : 'no limit';
  const planHtml = !heats ? '' : `<details class="card" style="margin-top:12px"><summary>Heat schedule (${heat.count} heats)</summary>
    <table class="fields"><tr><th>Heat</th><th>Drivers by lane</th></tr>${heat.schedule.map((h, i) =>
      `<tr><td>${i + 1}</td><td>${[...h].sort((a, b) => a.lane - b.lane).map(e => `Lane ${e.lane + 1}: ${esc(people[e.p].driverName)}`).join(' · ')}</td></tr>`).join('')}</table></details>`;
  const host = raceHost();
  host.innerHTML = `<p class="muted rt-title"><strong>${esc(setup.name)}</strong> · ${esc(SESSION_LABEL[setup.sessionType])} on ${esc(r.track.name)} · ${esc(limit)}</p>
    <div class="rt-stage"><div class="canvas live" id="canvas"></div></div>
    <div class="bar rt-tools"><label><input type="checkbox" id="sim"> Simulated cars</label><span id="tmstatus" class="muted" role="status"></span><span id="lapbtns"></span><span id="pitbtns"></span><span id="callbtns"></span><span id="penbtns"></span>
      <button class="btn" id="fsbtn" type="button" title="Show only the widgets, as large as the window allows (F). Esc closes it.">Full screen widgets</button><button class="btn" id="lapsbtn" aria-expanded="false" hidden title="Check the laps while the race goes on: mark a lap invalid or take it out of the records">Review laps</button><span id="msg" class="muted" role="status"></span><button class="btn danger stopbtn" id="stopbtn">Stop race</button><button class="btn" id="back">Back to Home</button></div>
    <div id="tokenpanel" class="card tkpanel" hidden></div>
    <div id="finalpick" class="card" hidden></div>
    <div id="calls" class="card calls" hidden></div>
    <div id="lapreview" class="card rv" hidden></div>
    <div id="review" class="card rv" hidden></div>
    <p class="muted">Space starts, pauses and resumes · Y yellow flag · R red flag · S stops the race · F shows the widgets full screen (Esc closes it) · press a lane's number key (or its Lap button) each time a car crosses the line${tokenSession ? ' (a lane without paid time ignores it, and a lane whose time is up records the lap but does not count it)' : ''} · Shift + number (or the Pit button) puts that lane's car on the sensor, press again to drive off · Ctrl + number (or the Call button) is a call from that lane: the yellow flag goes up and the Race Director decides what happens.</p>
    ${planHtml}${heats ? '<h4>Overall result</h4>' + (scoreNote ? `<p class="hint2" id="overallnote">${esc(scoreNote)}</p>` : '') + `<div class="wrap"><table class="fields"><thead><tr><th>Pos</th><th>Driver</th><th>Heats</th><th>Laps</th><th>Points</th>${scoreCol ? '<th>Result</th>' : ''}${finalsOn ? '<th>Final</th>' : ''}<th>Best lap</th></tr></thead><tbody id="overall"></tbody></table></div>` : ''}`;

  const now = () => performance.now();
  const ui = id => { // (the race screen has a place of its own: its ids can not be mixed up with those of the screen that is shown)
    const el = typeof HTMLElement !== 'undefined' && host instanceof HTMLElement ? host.querySelector(`[id="${id}"]`) : null;
    return el || document.getElementById(id);
  };

  // ---- build the page from the layout (once); widgets for lanes the track does not have are left out ----
  live.nodes = LiveCanvas.build(ui('canvas'), layout, lanes, { onButton: type => actions[type]() });
  for (let l = 0; l < lanes; l++) {
    const b = document.createElement('button'); b.className = 'btn'; b.textContent = `Lap ${l + 1}`; b.onclick = () => crossLane(l);
    ui('lapbtns').appendChild(b); live.lapBtns.push({ lane: l, b });
    if (!tokenSession) { const pb = document.createElement('button'); pb.className = 'btn'; pb.textContent = `Pit ${l + 1}`; pb.onclick = () => togglePit(l);
      ui('pitbtns').appendChild(pb); live.pitBtns.push({ lane: l, b: pb }); }
    const cb = document.createElement('button'); cb.className = 'btn'; cb.textContent = `Call ${l + 1}`; cb.title = 'A call from this lane: raises the yellow flag, the Race Director decides'; cb.onclick = () => actions.call(l);
    ui('callbtns').appendChild(cb); live.callBtns.push({ lane: l, b: cb });
    if (penCfg.on) { const qb = document.createElement('button'); qb.className = 'btn'; qb.textContent = `Penalty ${l + 1}`; qb.title = 'Give this lane one penalty point'; qb.onclick = () => actions.penalty(l, 1); ui('penbtns').appendChild(qb); live.penBtns.push({ lane: l, b: qb }); }
  }

  // championship points of the heats finished so far: { on, list: points per position, done: [[driverId, points]] }
  const champOf = () => (heats && setup.resultBy === 'points' ? { on: true, list: pointList, done: heat.overall().map(o => [o.driverId, o.points]) } : { on: false, list: [], done: [] });
  const shared = () => LiveShare.makeShared({ rowDesigns, imageSets, clubLogo: state.settings.clubLogo, champ: champOf(), eng, track: r.track, now: now(), phase: live.phase, calling: live.calling, lights: live.lights, setup: setupNow(), heat: heatInfo(),
    flash: live.flash, layout, bestAll: live.bestAll, bestAllName: live.bestAllName, bestBy: live.bestBy, base, tokens: tokens ? tokens.snapshot() : null });
  // ---- share the race with the second-screen window (and later other devices) ----
  const shareTitle = `${setup.name} · ${SESSION_LABEL[setup.sessionType]} on ${r.track.name} · ${limit}`;
  const tokenUi = () => (tokenSession ? { increments: tokenSet.increments.slice(), decrements: tokenSet.decrements.slice(), drivers: drivers.map(d => ({ id: d.id, name: titleOf('drivers', d) })) } : null); // what the Tokens page on other screens needs: the time buttons and the drivers to choose from
  const shareStatic = () => { // everything heavy, once per heat
    live.raceId = String(Date.now()) + Math.random().toString(36).slice(2, 6);
    if (live.sender) live.sender.reset(); // a new heat: the first message after the static part holds everything
    if (api.liveStatic) api.liveStatic(LiveShare.packStatic({ rowDesigns, imageSets, clubLogo: state.settings.clubLogo, tokenUi: tokenUi(), raceId: live.raceId, title: shareTitle, eng, setup: setupNow(), layout: find(layouts, setup.layout2) || layout, track: r.track, lanes, base }));
  };
  const share = () => { // the light part: only when something changed (at most about ten times a second), and a small message every second so the clocks stay right
    if (!api.livePush) return;
    const t = now();
    if (t - (live.lastShare || -1e9) < 80) { if (!live.shareTimer) live.shareTimer = setTimeout(() => { live.shareTimer = null; share(); }, 90); return; }
    live.lastShare = t;
    if (!live.sender) live.sender = LiveShare.sender();
    const msg = live.sender.pack({ champ: champOf(), raceId: live.raceId, eng, phase: live.phase, calling: live.calling, lights: live.lights, heat: heatInfo(), flash: live.flash, bestAll: live.bestAll, bestAllName: live.bestAllName, bestBy: live.bestBy, tokens: tokens ? tokens.snapshot() : null, now: t }, t);
    if (msg) api.livePush(msg);
  };
  // announcements: only on this computer, and only when the race setup has an audio set
  Sound.resetCool(); // (a new race: nothing was said lately, for the "not again within" waits of the audio set)
  const audioSet = find(audioSets, setup.audioSet), mkAnn = () => Announcer.create({ driverBy: audioSet && audioSet.driverBy, distances: audioSet ? Sound.distances(audioSet.distances) : [], lapsToGo: audioSet ? Sound.counts(audioSet.lapsToGo, [3]) : [], minutesToGo: audioSet ? Sound.counts(audioSet.minutesToGo, [1]) : [],
    closeGap: audioSet ? Sound.bounded(audioSet.closeGap, 1, 0.1, 30) : 1, battleLaps: audioSet ? Sound.bounded(audioSet.battleLaps, 3, 2, 20) : 3,
    nearRecord: audioSet ? Sound.bounded(audioSet.nearRecord, 0.1, 0.01, 5) : 0.1, noLapSeconds: audioSet ? Math.round(Sound.bounded(audioSet.noLapSeconds, 30, 5, 600)) : 30, trackName: (r.track && r.track.name) || '', lapLimit: engineType === 'race' ? Number(lenNow().laps) || 0 : 0, base });
  // the race that is racing, or the next one while the race waits between two races. final: 'A' or 'B' when that race is a final (and also after the last final, when it is over);
  // total: the number of races with the finals; picking: the lanes of the final are not all chosen; breakLeft: the seconds of the break that are left
  const finalAt = () => { const i = Math.min(heat.idx, heat.total - 1); return i >= heat.count ? heat.raceName(i).slice(6) : ''; };
  const heatInfo = () => (heats ? { idx: heat.idx, count: heat.count, ...(finalsOn ? { total: heat.total } : {}), ...(finalsOn && finalAt() ? { final: finalAt() } : {}),
    ...(live.phase === 'between' && !heat.picksDone() ? { picking: true } : {}), ...(live.breakLeft > 0 ? { breakLeft: live.breakLeft } : {}) } : null);
  const announce = () => {
    if (!audioSet || !live.ann) return;
    try { live.ann.observe(eng, { phase: live.phase, lights: live.lights, now: now(), heat: heatInfo(), trackmate: typeof Trackmate !== 'undefined' && Trackmate.link ? !!Trackmate.link.connected : undefined, idle: c => !!tokens && ['idle', 'out'].includes(tokens.stateOf(c.lane, raceT())) }).forEach(e => Sound.say(audioSet, e.call, e.vars, undefined, undefined, e.facts)); } catch (x) { /* a sound problem never stops the race */ }
  };
  live.ann = mkAnn(); live.announce = announce;
  // Time Token Session: the calls "time almost up" and "time is up", said once when a lane moves into that state (not for a lane that is restored, or has its time added),
  // "time added" when time is bought for a lane (the first look at a lane never says anything), and "lane free" when the operator clears a lane
  const tkSeen = new Map(), tkEnd = new Map(), tkClosed = new Set();
  let tkFirst = true;
  const announceTokens = () => {
    if (!tokens) return;
    const T = raceT(), V = tokens.view(), on = live.phase === 'running' || live.phase === 'paused', said = [];
    const nameOf = (c, by) => (by === 'nickname' ? c.nickname || c.driverName : by === 'callsign' ? c.callsign || c.driverName : c.driverName);
    eng.cars.forEach(c => {
      const st = tokens.stateOf(c.lane, T), was = tkSeen.get(c.lane), end = V.endOf(c.lane), wasEnd = tkEnd.get(c.lane); tkSeen.set(c.lane, st); tkEnd.set(c.lane, end);
      if (!audioSet || was === undefined) return;
      const vars = { driver: nameOf(c, audioSet.driverBy), lane: c.lane + 1, seconds: Math.round(tokens.warnMs / 1000) };
      const facts = { driverId: c.driverId || '', place: null, time: null, gap: null };
      if (on && end !== null && (st === 'running' || st === 'warning')) { // time was bought: a longer stint end, or a stint that started
        const ms = was === 'running' || was === 'warning' ? (wasEnd !== null && wasEnd !== undefined ? end - wasEnd : 0) : end - T;
        if (ms > 1000 - 1e-6 || (ms > 0 && (was === 'idle' || was === 'out'))) said.push(['tokenadded', { ...vars, added: Announcer.speakSpan(ms), seconds: Math.round(ms / 1000) }, facts]);
      }
      if (live.phase !== 'running') return;
      if (st === 'warning' && was === 'running') said.push(['tokenwarning', vars, facts]);
      else if (st === 'out' && (was === 'running' || was === 'warning')) said.push(['tokenout', vars, facts]);
    });
    tokens.closedMeta().forEach(r => { // a lane the operator cleared (stints that ended in another way are not "freed")
      if (tkClosed.has(r.id)) return; tkClosed.add(r.id);
      const c = eng.cars.find(x => x.lane === r.lane);
      if (!tkFirst && audioSet && on && r.closedBy === 'cleared') said.push(['tokenfree', { driver: nameOf(c && c.driverName === r.driverName ? c : { driverName: r.driverName }, audioSet.driverBy), lane: r.lane + 1 }, { driverId: r.driverId || '', place: null, time: null, gap: null }]);
    });
    tkFirst = false;
    said.forEach(([id, vars, facts]) => { try { Sound.say(audioSet, id, vars, undefined, undefined, facts); } catch (x) { /* a sound problem never stops the session */ } });
  };
  // ---- reviewing laps while the race goes on (any session type) ----
  // The panel is opened with the "Review laps" button; it is only drawn again when something in it changed.
  const drawLapReview = () => {
    const on = live.phase === 'running' || live.phase === 'paused', btn = ui('lapsbtn'), box = ui('lapreview');
    btn.hidden = !on;
    const label = live.lapsOpen ? 'Hide lap review' : 'Review laps'; if (btn.textContent !== label) btn.textContent = label;
    if (!on || !live.lapsOpen) { box.hidden = true; if (live.lapSig !== null) { box.innerHTML = ''; live.lapSig = null; } return; }
    const R = Review.ui, sig = JSON.stringify([eng.cars.map(c => [c.laps.length, c.best, c.invalid, c.removed, c.dq, c.done, c.driverName]), [...R.open], R.del, tokens ? tokens.snapshot().lates : 0]);
    if (sig === live.lapSig) return;
    live.lapSig = sig; box.hidden = false;
    const tv = tokens ? tokens.view() : null;
    box.innerHTML = Review.lapsHtml(eng, { late: tv ? (i, n) => tv.lateAt(eng.cars[i].lane, n) : null });
  };
  // after a correction: the best laps that are shown (the highlights, the record lap) are worked out again from the laps that still count
  const recomputeBests = () => {
    const by = new Map(live.priorBy); let all = live.priorAll, who = live.priorAllName;
    const put = (d, t, name) => { if (t < (by.get(d) ?? Infinity)) by.set(d, t); if (t < all) { all = t; who = name; } };
    eng.cars.forEach(c => c.laps.forEach((t, n) => { if (!c.bad[n] && !c.invalid.includes(n) && !c.removed.includes(n)) put(c.driverId, t, c.driverName); }));
    if (tokens) tokens.closedList().forEach(x => x.laps.forEach(l => { if (!l.late && !l.bad && !l.invalid && !l.removed) put(x.who.driverId || '', l.t, x.who.driverName || 'Guest'); }));
    live.bestBy = by; live.bestAll = all; live.bestAllName = who;
  };
  // A correction of a lap during the race: mark it invalid (or valid again) or take it out. Only these two; the rest is for the review after the race.
  // A lap that is driven after the paid time is up stays invalid; a car that has finished only takes a lap out of the records.
  const lapFix = c => {
    if (!c || (c.op !== 'invalid' && c.op !== 'removelap') || !Number.isInteger(c.car) || !Number.isInteger(c.lap)) return false;
    const car = eng.cars[c.car]; if (!car || c.lap < 0 || c.lap >= car.laps.length) return false;
    const recalc = c.op === 'removelap' && !!c.recalc;
    if (recalc && car.done) return false;
    if (c.op === 'invalid' && !c.on && tokens && tokens.view().lateAt(car.lane, c.lap)) return false;
    if (!Review.apply(eng, { op: c.op, car: c.car, lap: c.lap, on: !!c.on, recalc })) return false;
    if (tokens) tokens.fixLap(car.lane, c.lap, c.op === 'invalid' ? { invalid: !!c.on } : { remove: recalc ? 'stint' : 'records' });
    recomputeBests(); if (tokens) persistTokens(false);
    update(); return true;
  };
  const update = () => {
    announce(); announceTokens(); if (live.powerFollow) live.powerFollow();
    const S = shared();
    LiveCanvas.paint(live.nodes, S);
    if (live.fsView) LiveCanvas.paint(live.fsView.nodes, S);
    live.pitBtns.forEach(x => {
      const c = S.carByLane(x.lane), blocked = !!c && c.blockAt !== null;
      x.b.disabled = !(live.phase === 'running' && c && !c.done); x.b.hidden = !c; x.b.textContent = blocked ? `Leave pit ${x.lane + 1}` : `Pit ${x.lane + 1}`;
    });
    if (live.phase === 'review') {
      ui('review').hidden = false; live.reviewShown = true;
      if (!live.tkBusy) { const h = tokens ? Review.stintsHtml(tokens.closedList().filter(x => x.laps.length), { failed: live.tkFailed }) : Review.html(eng); if (h !== live.rvHtml) { live.rvHtml = h; ui('review').innerHTML = h; } } // (only when it changed: a button never changes under your finger; not while the stints are being saved)
    } else if (live.reviewShown) { ui('review').innerHTML = ''; ui('review').hidden = true; live.reviewShown = false; live.rvHtml = ''; }
    drawLapReview(); drawFinalPick();
    live.penBtns.forEach(x => { const c = S.carByLane(x.lane); x.b.disabled = !(['running', 'paused'].includes(live.phase) && c && !c.dq); x.b.hidden = !c; });
    live.lapBtns.forEach(x => { const c = S.carByLane(x.lane); x.b.disabled = !(live.phase === 'running' && c && !c.done); x.b.hidden = !c; });
    live.callBtns.forEach(x => { const c = S.carByLane(x.lane); x.b.disabled = !(['running', 'paused'].includes(live.phase) && c && !c.done); x.b.hidden = !c; });
    drawCalls();
    if (live.tkPanel) live.tkPanel.update();
    if (tokens && live.phase === 'running' && now() - (live.tkAt || -1e9) > 10000) persistTokens(true); // (the clocks that run: kept every ten seconds)
    ui('back').disabled = raceActive();
    ui('stopbtn').disabled = !(live.phase === 'running' || live.phase === 'paused' || live.phase === 'between');
    share();
  };
  // the calls that wait for the Race Director. The strip is only rebuilt when the calls change, so a button never changes under a finger.
  const drawCalls = () => {
    const open = eng.calls.filter(c => c.open), key = open.map(c => `${c.id}:${c.car}${eng.cars[c.car].dq ? 'd' : ''}`).join(); // (a new heat starts counting again, so the car is part of the key too)
    if (key === live.callsKey) return;
    live.callsKey = key; ui('calls').hidden = !open.length;
    ui('calls').innerHTML = open.length ? '<strong>Calls</strong> ' + open.map(c => { const car = eng.cars[c.car];
      return `<span class="callitem">⚠ Lane ${car.lane + 1} · ${esc(car.driverName)} called <button class="btn" data-call="dismiss" data-id="${c.id}">Dismiss</button>${penCfg.on && !car.dq ? ` <button class="btn danger" data-call="penalty" data-id="${c.id}">Penalty point</button>` : ''}</span>`; }).join('') : '';
  };
  ui('calls').onclick = ev => { const b = ev.target.closest && ev.target.closest('[data-call]'); if (b) actions.callResolve(Number(b.dataset.id), b.dataset.call); };
  const drawOverall = () => {
    if (!heats) return;
    ui('overall').innerHTML = heat.overall().map(o => `<tr><td>${o.pos}</td><td>${esc(o.driverName)}</td><td class="num">${o.heats}</td><td class="num">${o.laps}</td>
      <td class="num">${setup.resultBy === 'points' ? o.points : ''}</td>${scoreCol ? `<td class="num">${esc(Heats.scoreText(o, heat.scoring, { finalMode: fmode.finalMode, byPoints: byPts }))}</td>` : ''}${finalsOn ? `<td>${esc(Heats.finalCell(o))}</td>` : ''}<td class="num">${RaceEngine.fmtTime(o.best)}</td></tr>`).join('');
  };

  // ---- crossings, simulated cars ----
  const crossCar = (i, at) => {
    if (live.phase !== 'running') return;
    const c = eng.cars[i], d = c.driverId, tAt = at !== undefined ? at : now();
    const tokenT = tokens ? eng.elapsed(tAt) : 0, lateLap = !!tokens && tokens.stateOf(c.lane, tokenT) === 'out'; // after the paid time is up a lap is kept, but does not count
    if (tokens && tokens.stateOf(c.lane, tokenT) === 'idle') return; // a lane nobody paid for: the crossing is ignored
    const prevPersonal = Math.min(base.personal.get(d) ?? Infinity, live.bestBy.get(d) ?? Infinity), prevTrack = Math.min(base.track, live.bestAll);
    if (!eng.cross(i, tAt)) { if (eng.status === 'finished') engineFinished(); else update(); return; } // a car out of fuel may retire or not count
    const time = c.laps[c.laps.length - 1], slow = c.bad[c.bad.length - 1];
    if (tokens) { tokens.lap(c.lane, time, tokenT, slow); if (lateLap) eng.setInvalid(i, c.laps.length - 1, true); persistTokens(false); }
    if (!slow && !lateLap) { // a lap over the track's maximum lap time never counts as a best lap or record
      live.flash.set(c, { at: now(), time, kind: Timing.classifyLap(time, prevPersonal, prevTrack) });
      live.bestBy.set(d, Math.min(live.bestBy.get(d) ?? Infinity, time));
      if (time < live.bestAll) { live.bestAll = time; live.bestAllName = c.driverName; }
    }
    if (eng.status === 'finished') engineFinished(); else update();
  };
  // a car stops over the sensor (crossing counts as a lap), and later drives off
  const blockCar = i => { if (live.phase === 'running') { eng.block(i, now()); if (eng.status === 'finished') engineFinished(); else update(); } };
  const unblockCar = i => { eng.unblock(i, now()); update(); };
  const togglePit = lane => { const i = eng.cars.findIndex(c => c.lane === lane); if (i < 0) return; if (eng.cars[i].blockAt !== null) unblockCar(i); else blockCar(i); };
  const crossLane = lane => { const i = eng.cars.findIndex(c => c.lane === lane); if (i >= 0) crossCar(i); };
  const simulate = i => {
    const pace = (4200 + Math.random() * 1800) / speed;
    const next = () => {
      if (live.phase !== 'running' || eng.cars[i].done) return;
      live.sim[i] = setTimeout(() => {
        const c = eng.cars[i];
        if (fuelCfg.on && c.fuel <= fuelCfg.perLap * 1.5 && c.blockAt === null) { // low on fuel: the simulated car pits, stays until the tank is full
          blockCar(i);
          const stay = pitMs + 100 + (((fuelCfg.tank - c.fuel) / (fuelCfg.rate || 1)) * 1000 + 300) / speed; // the hold time is real time; the rest follows the test speed
          live.sim[i] = setTimeout(() => { unblockCar(i); next(); }, stay);
        } else { crossCar(i); next(); }
      }, pace + (Math.random() - 0.5) * 700 / speed);
    };
    next();
  };
  const startSim = () => { if (ui('sim').checked) eng.cars.forEach((_, i) => simulate(i)); };
  // keep the page's phase in step with the engine after a pause, resume or red flag
  const syncPhase = () => {
    if (eng.status === 'paused' && live.phase === 'running') { live.phase = 'paused'; live.sim.forEach(clearTimeout); }
    else if (eng.status === 'running' && live.phase === 'paused') { live.phase = 'running'; startSim(); }
    update();
  };

  // pit stops and penalty points of a car, saved with the standings (a heat race adds up what every heat brought)
  const pitFigures = c => ({ pits: c.pits.length, pitTime: c.pits.reduce((a, p) => a + p.duration, 0) });
  const hasPits = c => fuelCfg.on || c.pits.length > 0;
  // the lap rows saved for the database: laps removed in the review are left out, invalid and too slow laps are kept but never count for records
  const lapRows = (c, date, extra) => c.laps.map((time, n) => ({ time, n })).filter(x => !c.removed.includes(x.n)).map(x => ({ driverId: c.driverId, carId: c.carId, trackId: r.track.id, ...extra, lane: c.lane + 1, lapNumber: x.n + 1, time: x.time, date,
    ...((c.pitLaps || []).includes(x.n) ? { pit: true } : {}),
    ...(c.bad[x.n] ? { noTrackRecord: true, noPersonalBest: true, tooSlow: true } : {}), ...(c.invalid.includes(x.n) ? { noTrackRecord: true, noPersonalBest: true, invalid: true } : {}) }));

  // a heat (or the single race) has ended: the Race Director reviews the result before it is saved
  function engineFinished() {
    if (live.phase !== 'running' && live.phase !== 'paused') return;
    clearInterval(live.timers); live.sim.forEach(clearTimeout);
    if (tokens) return finishTokens(); // (the stints are checked in their own review)
    live.phase = 'review'; ui('msg').textContent = 'The race is over. Check the result below, then press Finalize.';
    update();
    if (state.autoFinalize) finalize(); // only the automated tests skip the review
  }
  const reviewCommand = c => {
    if (!c || typeof c !== 'object') return;
    if (live.phase === 'running' || live.phase === 'paused') { lapFix(c); return; } // during the race: laps only
    if (live.phase !== 'review') return;
    if (c.op === 'finalize') return tokens ? finalizeTokens() : finalize();
    if (c.op === 'discard') return tokens ? discardTokens() : discardAll();
    if (tokens) return tokenReview(c);
    Review.apply(eng, c); recomputeBests(); update();
  };
  // The break between two races: a countdown (when the race setup has a break), and then either the lights start by themselves or the race waits for Start.
  // Space (Start) at any moment ends the break and starts the next race; Stop ends the race. Before a final the race also waits until the drivers have chosen their lanes.
  const lc = n => n.replace(/^Heat/, 'heat').replace(/^Final/, 'final'); // "Heat 2" -> "heat 2", "Final A" -> "final A" (inside a sentence)
  const picking = () => live.phase === 'between' && !heat.picksDone();
  const betweenMsg = () => {
    const done = heat.raceName(heat.idx - 1), next = heat.raceName(heat.idx), isFinal = heat.isFinal(), over = brk.seconds > 0 && live.breakLeft <= 0;
    if (picking()) return `${over ? 'The break is over' : done + ' finished'}. Choose the lanes for ${next} first, then press Space.`;
    if (!brk.seconds) return `${done} finished. Press Space for ${isFinal ? lc(next) : 'the next heat'}.`;
    if (live.breakLeft > 0) return `${done} finished. ${next} starts ${brk.auto ? 'by itself' : 'when you press Space'} in ${Heats.clock(live.breakLeft)}${brk.auto ? ' (Space starts it now)' : ' or after the break'}.`;
    return `The break is over. Press Space for ${lc(next)}.`;
  };
  function stopBreak() { clearInterval(live.breakTimer); live.breakTimer = null; live.breakLeft = 0; }
  function startBreak() {
    stopBreak();
    if (!brk.seconds) { ui('msg').textContent = betweenMsg(); return; }
    const end = now() + brk.seconds * 1000 / speed, left = () => Math.max(0, Math.ceil((end - now()) * speed / 1000));
    live.breakLeft = left();
    ui('msg').textContent = betweenMsg();
    live.breakTimer = setInterval(() => {
      if (live.phase !== 'between') return stopBreak();
      const l = left();
      if (l === live.breakLeft) return;
      live.breakLeft = l;
      const go = l === 0 && brk.auto && heat.picksDone(); // (a final waits for the lanes: the race does not start by itself with a lane not chosen)
      ui('msg').textContent = go ? `${heat.raceName(heat.idx)} is starting.` : betweenMsg(); update();
      if (l === 0) { clearInterval(live.breakTimer); live.breakTimer = null; if (go) actions.start(); }
    }, 100 / Math.min(speed, 10));
  }
  // ---- before a final: the drivers choose their lanes, the best-placed driver first ----
  // The race is built again after every choice, so the grid, the widgets and the other screens always show the lanes as chosen so far.
  const regrid = () => {
    eng = mk(heat.entries()); live.ann = mkAnn(); live.flash = new Map(); live.fpKey = null;
    try { live.ann.observe(eng, { phase: 'between', now: now(), heat: heatInfo() }); } catch (x) { /* (the new announcer is told the race is waiting, and what it would say is thrown away: "next final A" was said already, once) */ }
    shareStatic(); ui('msg').textContent = betweenMsg(); update();
  };
  const pickAction = (what, lane) => {
    if (!heats || live.phase !== 'between' || !heat.isFinal()) return false;
    if (what === 'lane') { const res = heat.pick(lane); if (res.error) { ui('msg').textContent = res.error; return false; } }
    else if (what === 'random') { if (!heat.randomRest()) return false; }
    else if (what === 'clear') heat.clearPicks();
    else return false;
    regrid(); return true;
  };
  live.pickAction = pickAction; // (for the automated tests)
  const drawFinalPick = () => {
    const box = ui('finalpick'), f = heats && live.phase === 'between' ? heat.finalNow() : null;
    if (!f) { if (live.fpKey !== null) { box.innerHTML = ''; live.fpKey = null; } box.hidden = true; return; }
    const key = JSON.stringify([f.name, f.picks, f.next]);
    box.hidden = false;
    if (key === live.fpKey) return; // (only when something changed: a button never changes under a finger)
    live.fpKey = key;
    const who = p => esc(people[p].driverName), done = f.next === null;
    const grid = [...Array(lanes).keys()].map(l => { const x = f.picks.find(k => k.lane === l); return { l, x }; });
    box.innerHTML = `<strong>Final ${f.name}: choose the lanes</strong>
      <p class="hint2">The best-placed driver of the heat result chooses first. The drivers of this final, best first: ${f.drivers.map((p, i) => `${i + 1}. ${who(p)}`).join(' · ')}.</p>
      ${done ? '<p><strong>All lanes are chosen.</strong> Press Space (or Start) for the final, or change the choices.</p>' : `<p><strong>${who(f.next)}</strong> chooses a lane:</p>`}
      <p>${grid.map(({ l, x }) => x ? `<button class="btn" disabled data-fp="taken">Lane ${l + 1}: ${who(x.p)}</button>` : `<button class="btn" data-fp="lane" data-lane="${l}"${done ? ' disabled' : ''}>Lane ${l + 1}</button>`).join(' ')}</p>
      <p><button class="btn" data-fp="random"${done ? ' disabled' : ''}>Pick the rest at random</button> <button class="btn" data-fp="clear"${f.picks.length ? '' : ' disabled'}>Clear choices</button></p>`;
  };
  ui('finalpick').onclick = ev => { const b = ev.target.closest && ev.target.closest('[data-fp]'); if (b && !b.disabled) pickAction(b.dataset.fp, b.dataset.lane); };
  function finalize() {
    if (live.phase !== 'review') return;
    ui('review').innerHTML = ''; live.reviewShown = false;
    if (heats) {
      const raceNo = heat.idx + 1, date = new Date().toISOString(), fin = heat.isFinal() ? heat.raceName(heat.idx).slice(6) : '';
      const res = heat.record(eng);
      eng.cars.forEach(c => { const a = live.extraBy.get(c.participant) || { pits: 0, pitTime: 0, has: false, pen: 0 }, p = pitFigures(c); live.extraBy.set(c.participant, { pits: a.pits + p.pits, pitTime: a.pitTime + p.pitTime, has: a.has || hasPits(c), pen: a.pen + (c.points || 0) }); });
      eng.cars.forEach(c => live.laps.push(...lapRows(c, date, { heat: raceNo, ...(fin ? { final: fin } : {}) })));
      live.priorBy = new Map(live.bestBy); live.priorAll = live.bestAll; live.priorAllName = live.bestAllName; // (the next race starts from what this one has set)
      res.rows.forEach(x => { x.driverName = people[x.participant].driverName; });
      drawOverall();
      if (heat.hasNext() && !live.stopping) {
        live.phase = 'between'; eng = mk(heat.entries()); startBreak(); // (a final: the grid shows the lanes in the order of the heat result until the drivers have chosen)
        live.ann = mkAnn(); live.flash = new Map(); shareStatic(); update(); return;
      }
    }
    finishAll();
  }

  // "Delete all data": the race ends and nothing is saved (in a heat race that includes the earlier heats)
  function discardAll() {
    if (live.phase !== 'review') return;
    ui('review').innerHTML = ''; live.reviewShown = false; live.laps = [];
    live.phase = 'finished'; clearInterval(live.timers); stopBreak(); live.sim.forEach(clearTimeout); document.removeEventListener('keydown', live.key);
    ui('msg').textContent = 'The race was deleted. Nothing was saved.';
    update();
  }

  async function finishAll() {
    live.phase = 'finished';
    clearInterval(live.timers); stopBreak(); live.sim.forEach(clearTimeout);
    document.removeEventListener('keydown', live.key);
    update();
    const date = new Date().toISOString();
    let standings, laps = live.laps;
    if (heats) {
      standings = heat.overall().map(o => ({ pos: o.pos, driverId: o.driverId, carId: o.carId, driverName: o.driverName, carName: o.carName, laps: o.laps, points: o.points, best: o.best, total: null,
        ...(live.extraBy.has(o.participant) && live.extraBy.get(o.participant).has ? { pits: live.extraBy.get(o.participant).pits, pitTime: live.extraBy.get(o.participant).pitTime } : {}),
        ...(penCfg.on && live.extraBy.has(o.participant) ? { penaltyPoints: live.extraBy.get(o.participant).pen } : {}),
        ...(scoreCol ? { score: o.score, counted: o.counted, heats: o.heats, dropped: o.dropped.length ? o.dropped : undefined } : {}),
        ...(finalsOn && o.finalName ? { finalName: o.finalName, ...(o.finalPos !== null ? { finalPos: o.finalPos } : {}) } : {}),
        ...(finalsOn && fmode.finalMode === 'added' && o.finalPos !== null ? { heatScore: o.heatScore, finalPoints: o.finalPoints, finalLaps: o.finalLaps } : {}) }));
    } else {
      standings = eng.standings().map(x => ({ pos: x.pos, driverId: x.car.driverId, carId: x.car.carId, driverName: x.car.driverName, carName: x.car.carName, laps: x.car.laps.length, best: x.car.best, total: x.car.total, retired: (x.car.retired && !x.car.dq) || undefined,
        ...(hasPits(x.car) ? pitFigures(x.car) : {}), ...(penCfg.on ? { penaltyPoints: x.car.points, penalty: eng.penMs(x.car), dq: x.car.dq || undefined } : {}) }));
      laps = [];
      eng.cars.forEach(c => laps.push(...lapRows(c, date, {})));
    }
    if (!laps.length) { ui('msg').textContent = 'No laps were recorded, so nothing was saved.'; return; }
    const session = { setupName: setup.name, sessionType: setup.sessionType, trackId: r.track.id, trackName: r.track.name, date, endedBy: heats ? '' : eng.endedBy, standings };
    if (heats) { session.resultBy = setup.resultBy; session.heatResults = heat.results.map(h => ({ heat: h.heat, ...(h.final ? { final: h.final } : {}), rows: h.rows })); if (scoreNote) session.scoring = heat.scoring; if (finalsOn) session.finals = { finals: fmode.finals, finalMode: fmode.finalMode }; }
    try { await api.saveSession(session, laps); ui('msg').textContent = `Saved ${laps.length} laps. See Database > Results and Records.`; }
    catch (x) { ui('msg').textContent = 'Could not save the results: ' + x.message; }
  }

  // ---- the controls (widgets and keys do the same things) ----
  // five lights, one per second; when all are on, a random wait (set in the race setup), then go() is called (lights out)
  function runLights(go) {
    const id = live.runId = (live.runId || 0) + 1; // pressing red again during a restart cancels this run
    const num = (v, d) => (v === '' || v === undefined || v === null || !Number.isFinite(Number(v)) ? d : Math.max(0, Number(v)));
    const lo = num(setup.lightsMin, 1), hi = num(setup.lightsMax, 5), a = Math.min(lo, hi), b = Math.max(lo, hi);
    let n = 0;
    const step = () => {
      if (live.phase !== 'countdown' || live.runId !== id) return;
      if (n < 5) { n++; live.lights = n; update(); setTimeout(step, 1000 / speed); return; }
      if (n === 5) { n++; const wait = a + (state.rand || Math.random)() * (b - a); live.lastWait = wait; setTimeout(step, wait * 1000 / speed); return; }
      go();
    };
    step();
  }
  // The pre-race call: said first when Start is pressed. The start lights wait until it has been said, then a short pause (set in the audio set), then go() (the lights).
  // With no audio set, or the call turned off or empty, there is nothing to wait for and go() runs at once. If the sound never says it has finished, the start goes on after a minute.
  const MAX_CALL = 60000;
  function preRace(go) {
    const L = live, token = L.callRun = (L.callRun || 0) + 1; let went = false;
    const current = () => live === L && L.callRun === token; // false once the screen was left or the race was opened again
    const done = () => {
      if (went || !current()) return; went = true; clearTimeout(L.callTimer);
      L.callTimer = setTimeout(() => { if (!current()) return; L.calling = false; go(); }, Sound.pauseOf(audioSet) * 1000 / speed);
    };
    L.calling = true; let said = null;
    try { said = audioSet ? Sound.say(audioSet, 'prerace', { track: (r.track && r.track.name) || '', heat: heats && !heat.isFinal() ? heat.idx + 1 : '', heats: heats && !heat.isFinal() ? heat.count : '', final: heats && heat.isFinal() ? heat.raceName(heat.idx).slice(6) : '' }, undefined, done) : null; } catch (x) { said = null; } // a sound problem never stops the race
    if (!said) { L.calling = false; return go(); }
    ui('msg').textContent = 'The pre-race call is being said. The start lights follow when it is finished.';
    if (!went) L.callTimer = setTimeout(done, MAX_CALL / speed);
    update();
  }
  const goRunning = () => {
    live.lights = 0; live.phase = 'running'; eng.start(now()); power(true); update();
    live.timers = setInterval(() => { eng.tick(now()); if (eng.status === 'finished') engineFinished(); else update(); }, 100 / Math.min(speed, 10));
    startSim();
  };
  function startCountdown() {
    live.phase = 'countdown'; live.lights = 0; ui('msg').textContent = ''; power(setup.startPower !== 'off'); ui('sim').disabled = true; update();
    runLights(goRunning);
  }
  // after a red flag the race restarts like a start: the lights count down, and at lights out the flag is cleared and the race goes on
  function restartCountdown() {
    live.restarting = true; live.phase = 'countdown'; live.lights = 0; update();
    runLights(() => { live.restarting = false; live.lights = 0; live.phase = 'paused'; eng.setFlag('red', now()); syncPhase(); });
  }
  function cancelRestart() { // red again, or stop, during the countdown: the race stays stopped under the red flag
    if (!live.restarting) return false;
    live.runId++; live.restarting = false; live.lights = 0; live.phase = 'paused'; update(); return true;
  }
  const actions = {
    start() {
      if (!((live.phase === 'ready' || live.phase === 'between') && !live.calling)) return;
      if (tokens) { ui('msg').textContent = ''; ui('sim').disabled = true; return goRunning(); } // a Time Token Session has no start lights: it opens at once
      if (picking()) { ui('msg').textContent = betweenMsg(); return; } // (a final does not start before every driver has chosen a lane)
      if (live.phase === 'between') { stopBreak(); live.flash = new Map(); } preRace(startCountdown);
    },
    pause() {
      if (live.phase === 'running') eng.pause(now()); else if (live.phase === 'paused') eng.resume(now());
      syncPhase();
    },
    stop(force) { // force: the Race Director page has already asked
      cancelRestart();
      if (!['running', 'paused', 'between'].includes(live.phase) || (force !== true && !confirm(tokens ? 'End the session now? Every lane is switched off. You check the results before they are saved.' : 'Stop the race now? The laps so far are saved.'))) return;
      live.stopping = true;
      if (live.phase === 'between') return finishAll();
      eng.stop(now()); engineFinished();
    },
    penalty(lane, n = 1) { // penalty points for the car on this lane (a negative number takes points back)
      if (!['running', 'paused'].includes(live.phase)) return;
      const i = eng.cars.findIndex(c => c.lane === lane);
      if (i < 0 || !eng.addPoints(i, n, now())) return;
      if (eng.status === 'finished') engineFinished(); else update();
    },
    assign(lane, typeIndex) { // a special penalty (Drivethrough, Stop-and-Go...) for the car on this lane
      if (!['running', 'paused'].includes(live.phase)) return;
      const i = eng.cars.findIndex(c => c.lane === lane);
      if (i >= 0 && eng.assign(i, typeIndex, now())) update();
    },
    call(lane) { // a call from a lane (its Call button, Ctrl + number or a hardware button): the yellow flag goes up and the Race Director decides
      if (!['running', 'paused'].includes(live.phase)) return;
      const i = eng.cars.findIndex(c => c.lane === lane);
      if (i >= 0 && eng.call(i, now())) update();
    },
    callResolve(id, how) { // the Race Director's decision on a call: 'penalty' (one point) or 'dismiss'
      if (!['running', 'paused'].includes(live.phase) || !eng.resolveCall(id, how, now())) return;
      if (eng.status === 'finished') engineFinished(); else update();
    },
    yellow() { if (live.restarting) return; eng.setFlag('yellow', now()); syncPhase(); },
    red() {
      if (cancelRestart()) return;
      if (eng.flag === 'red' && live.phase === 'paused' && setup.restartAfterRed !== 'resume' && !tokens) return restartCountdown(); // lifting the red flag: restart with the lights
      eng.setFlag('red', now()); syncPhase();
    }
  };
  live.actions = actions; actions.finalize = () => (tokens ? finalizeTokens() : finalize()); live.reviewCommand = reviewCommand; // (for the automated tests)
  // ---- the Trackmate: sensor hits count laps, the Trackcall button flags the race ----
  const tmWord = () => (Trackmate.link.connected ? 'Trackmate connected' : 'Trackmate not connected');
  const drawTm = () => { const e = ui('tmstatus'); if (e) e.textContent = ' · ' + tmWord() + (Trackmate.link.connected && Trackmate.link.power !== null ? (Trackmate.link.power ? ', track power on' : ', track power off') : ''); };
  drawTm(); live.offTmStatus = Trackmate.link.onStatus(drawTm);
  // the track power (the Trackmate relay): only when it is connected
  const power = on => { if (Trackmate.link.connected && typeof tmPower === 'function') tmPower(on); };
  const CUTS = { yellowredcut: ['red'], yellowcut: ['yellow'], redcut: ['red'] }; // which flags switch the power off, per Trackcall choice
  if (Trackmate.link.connected && typeof tmSetup === 'function') tmSetup(lanes).then(() => power(setup.startPower !== 'off')); // the interface is told the lanes; the track starts with or without power
  let callAt = 0; // when the last Trackcall press was
  const trackcall = () => {
    const mode = setup.trackcall || 'yellowred', t = now();
    if (mode === 'power') return power(Trackmate.link.power === false); // switches the relay, in any phase of the race screen
    if (!['running', 'paused'].includes(live.phase) || mode === 'none') return;
    if (mode === 'yellow' || mode === 'yellowcut') return actions.yellow();
    if (mode === 'red' || mode === 'redcut') return actions.red();
    const win = (Number(setup.trackcallWindow) > 0 ? Number(setup.trackcallWindow) : 3) * 1000 / speed;
    if (eng.flag === 'red') { callAt = 0; return actions.red(); } // a press while stopped starts the race again
    if (callAt && t - callAt <= win) { callAt = 0; return actions.red(); } // second press: red flag
    callAt = t; actions.yellow(); // first press: yellow flag on or off
  };
  // the power follows the flag for the "power off" choices (also when the flag comes from the keyboard or the Race Director); it is back on when the flag ends
  live.pwWant = true;
  live.powerFollow = () => { const cut = CUTS[setup.trackcall]; if (!cut) return; const want = !cut.includes(eng.flag); if (want !== live.pwWant) { live.pwWant = want; power(want); } };
  live.trackcall = trackcall;
  live.offTm = Trackmate.link.on(e => {
    if (e.type === 'hit') { const lane = Trackmate.laneMap(state.settings.tmLaneMap)[e.lane]; const i = eng.cars.findIndex(c => c.lane === lane); if (i >= 0) crossCar(i, e.at); } // the sensor's lane can be changed in Timing hardware
    else if (e.type === 'call') { if (Number.isInteger(e.lane)) actions.call(e.lane); else trackcall(); } // a call button of one lane, or the one Trackcall button
  });
  Review.bind(ui('review'), reviewCommand, () => update());
  Review.bind(ui('lapreview'), reviewCommand, () => update());
  ui('lapsbtn').onclick = ev => {
    if (ev && ev.currentTarget && ev.currentTarget.blur) ev.currentTarget.blur();
    live.lapsOpen = !live.lapsOpen; ui('lapsbtn').setAttribute('aria-expanded', String(live.lapsOpen)); update();
  };
  // the Race Director page (in the Live Race window) sends its buttons here
  if (api.onLiveResync) live.offResync = api.onLiveResync(() => { if (live && live.sender) { live.sender.reset(); live.lastShare = 0; share(); } }); // the app lost track of the messages: send everything again
  if (api.onCommand) live.offCmd = api.onCommand(cmd => {
    if (!live || live.actions !== actions || !cmd) return;
    if (cmd.type === 'start') actions.start(); else if (cmd.type === 'pause') actions.pause(); else if (cmd.type === 'stop') actions.stop(true);
    else if (cmd.type === 'yellow') actions.yellow(); else if (cmd.type === 'red') actions.red();
    else if (cmd.type === 'penalty') actions.penalty(Number(cmd.lane), Number(cmd.n) || 1);
    else if (cmd.type === 'assign') actions.assign(Number(cmd.lane), Number(cmd.typeIndex));
    else if (cmd.type === 'call') actions.call(Number(cmd.lane));
    else if (cmd.type === 'callresolve') actions.callResolve(Number(cmd.id), cmd.how);
    else if (cmd.type === 'review') reviewCommand(cmd);
    else if (tokens && TOKEN_CMD[cmd.type]) TOKEN_CMD[cmd.type](cmd);
  });
  live.engine = () => eng; // for automated tests
  ui('stopbtn').onclick = ev => { if (ev && ev.currentTarget && ev.currentTarget.blur) ev.currentTarget.blur(); actions.stop(); };
  ui('sim').onchange = ev => { if (ev.target && ev.target.blur) ev.target.blur(); };
  ui('back').onclick = () => { if (!raceActive()) { state.tab = 'home'; render(); } };
  live.key = ev => {
    if (state.tab !== 'race') return; // (the race goes on while another tab is shown, but the keys are for that tab then: Space and the letters would be typed into its fields)
    if (ev.target && ev.target.matches && ev.target.matches('input,select,textarea')) return;
    if (ev.key === ' ') { ev.preventDefault(); if (live.phase === 'ready' || live.phase === 'between') actions.start(); else actions.pause(); return; }
    const k = String(ev.key).toLowerCase();
    if (k === 'y') return actions.yellow();
    if (k === 'r') return actions.red();
    if (k === 's') return actions.stop(); // still asks "Stop the race now?"
    if (ev.ctrlKey && /^Digit[1-8]$/.test(ev.code || '')) { ev.preventDefault(); const l = Number(ev.code.slice(5)) - 1; if (l < lanes) actions.call(l); return; }
    if (ev.shiftKey && /^Digit[1-8]$/.test(ev.code || '')) { const l = Number(ev.code.slice(5)) - 1; if (l < lanes) togglePit(l); return; }
    const lane = Number(ev.key) - 1;
    if (lane >= 0 && lane < lanes) crossLane(lane);
  };
  document.addEventListener('keydown', live.key);
  // The fullscreen widget view: only the widgets of the layout, as large as the window allows (the window itself goes full screen too). F opens and closes it, Esc closes it.
  // It has its own key listener, so it also works when the race is over and the race keys are off. The race keeps going and is run with the keys as before.
  const toggleFull = () => {
    if (live.fsView) { live.fsView.close(); return; }
    let was = null;
    live.fsView = LiveCanvas.fullView(layout, lanes, { onClose: () => { live.fsView = null; if (api.windowFullscreen && was !== null) api.windowFullscreen(was); } });
    if (api.windowFullscreen) Promise.resolve(api.windowFullscreen(true)).then(r => { was = r && typeof r.was === 'boolean' ? r.was : false; if (!live.fsView) api.windowFullscreen(was); }).catch(() => { was = false; });
    update();
  };
  live.fsKey = ev => {
    if (state.tab !== 'race') return;
    if (ev.target && ev.target.matches && ev.target.matches('input,select,textarea')) return;
    if (String(ev.key).toLowerCase() === 'f' && !ev.ctrlKey && !ev.altKey && !ev.metaKey) toggleFull();
  };
  document.addEventListener('keydown', live.fsKey);
  ui('fsbtn').onclick = ev => { if (ev && ev.currentTarget && ev.currentTarget.blur) ev.currentTarget.blur(); toggleFull(); };
  live.shown = () => { live.nodes.forEach(n => { n.last = null; }); update(); }; // the Race tab is shown again: everything is drawn once more (a leaderboard fits its text to the size it has now)
  // leaving the race screen (before the start, or after the end): the keys, the Trackmate and the Race Director buttons stop working on the other pages
  live.leave = () => { if (live.fsView) live.fsView.close(); document.removeEventListener('keydown', live.fsKey); if (live.calling) { live.callRun = -1; live.calling = false; clearTimeout(live.callTimer); Sound.stop(); } document.removeEventListener('keydown', live.key); ['offTm', 'offTmStatus', 'offCmd', 'offResync'].forEach(k => { if (live[k]) { live[k](); live[k] = null; } }); clearTimeout(live.shareTimer); live.shareTimer = null; if (live.flushTokens) live.flushTokens(); clearTimeout(live.tkTimer); live.tkTimer = null; };

  // ---- Time Token Session: the lane controls, saving every stint, keeping the session across a restart ----
  const raceT = () => eng.elapsed(now()); // the race clock: the token clocks run on it, so a pause stops them
  const carIndex = lane => eng.cars.findIndex(c => c.lane === lane);
  const STINT_END = { expired: 'The time ran out', cleared: 'The lane was switched off', driver: 'The driver changed', session: 'The session ended' };
  live.tkChain = Promise.resolve(); live.tkTotal = 0;
  // When the Race Director presses Finalize, every stint is saved as a result of its own (with its laps). One at a time, in order. A stint without any laps is not saved. A stint that could not be saved is offered again.
  // (Until then the stints are held, also across a restart, so they can be checked and corrected in the review.)
  const saveStints = () => {
    live.tkChain = live.tkChain.then(async () => {
      const list = tokens.takeClosed(), failed = [];
      for (const st of list) {
        if (!st.laps.length) continue;
        const date = st.startAt || new Date().toISOString(), counted = st.laps.filter(l => !l.late), who = st.who;
        const rows = st.laps.map((l, n) => ({ l, n })).filter(x => !x.l.removed).map(({ l, n }) => ({ driverId: who.driverId || '', carId: who.carId || '', trackId: r.track.id, token: true, stint: st.id, lane: st.lane + 1, lapNumber: n + 1, time: l.t, date, // (a lap taken out in the review is not saved)
          ...(l.bad ? { noTrackRecord: true, noPersonalBest: true, tooSlow: true } : {}), ...(l.late || l.invalid ? { noTrackRecord: true, noPersonalBest: true, invalid: true } : {}), ...(l.late ? { late: true } : {}) }));
        if (!rows.length) continue;
        const session = { setupName: setup.name, sessionType: 'tokens', trackId: r.track.id, trackName: r.track.name, date, endedBy: STINT_END[st.closedBy] || '',
          token: { stint: st.id, lane: st.lane + 1, bought: st.bought, carried: st.carried, left: st.left },
          standings: [{ pos: 1, driverId: who.driverId || '', carId: who.carId || '', driverName: who.driverName || 'Guest', carName: who.carName || '', laps: counted.length, lateLaps: st.laps.length - counted.length, best: st.best, total: counted.reduce((a, l) => a + l.t, 0), lane: st.lane + 1, bought: st.bought }] };
        try { await api.saveSession(session, rows); live.tkTotal++; } catch (x) { failed.push(st); }
      }
      if (failed.length) { tokens.putBack(failed); ui('msg').textContent = `Could not save ${failed.length} ${failed.length === 1 ? 'stint' : 'stints'}; it will be tried again.`; }
    });
    return live.tkChain;
  };
  // the session is kept in the settings at every change of the time (and every few seconds for laps and the running clocks), so a crash or a restart loses nothing
  const persistTokens = force => {
    if (!tokens || !api.setSettings) return;
    const t = now(), since = t - (live.tkAt || -1e9);
    if (!force && since < 5000) { if (!live.tkTimer) live.tkTimer = setTimeout(() => { live.tkTimer = null; persistTokens(true); }, 5050 - since); return; }
    clearTimeout(live.tkTimer); live.tkTimer = null; live.tkAt = t;
    const all = { ...(state.settings.tokenSessions || {}) };
    const T = raceT(), nothing = !tokens.hasPending() && eng.cars.every(c => tokens.stateOf(c.lane, T) === 'idle'); // (no lane has time or laps: there is nothing to carry on with)
    if ((live.phase === 'finished' || nothing) && !tokens.hasPending()) delete all[setup.id]; else all[setup.id] = { setupId: setup.id, trackId: r.track.id, savedAt: new Date().toISOString(), data: tokens.serialise(T), review: live.phase === 'review' }; // (review: the session had ended and its stints waited for the review)
    state.settings = { ...state.settings, tokenSessions: all }; // (at once, so the next time the screen is opened it finds it)
    Promise.resolve(api.setSettings({ tokenSessions: all })).then(st => { if (st) state.settings = st; }).catch(() => {});
  };
  live.flushTokens = () => persistTokens(true);
  const afterTokenChange = () => { persistTokens(true); update(); }; // (a stint that ends is held for the review at the end of the session)
  const tkOpen = () => ['ready', 'running', 'paused', 'between'].includes(live.phase);
  // what the lane controls do (the Live Race page will send the same commands)
  // the Tokens page of the Live Race pages sends these. The numbers are checked again here (they also come from a window that no server has looked at).
  const laneNo = v => (Number.isInteger(v) && v >= 0 && v < 16 ? v : -1);
  const TOKEN_CMD = {
    addtime: c => { const m = c.minutes; if (laneNo(c.lane) >= 0 && typeof m === 'number' && Number.isFinite(m) && m > 0 && m <= 1440) tokenOps.add(c.lane, m); },
    reducetime: c => { const m = c.minutes; if (laneNo(c.lane) >= 0 && typeof m === 'number' && Number.isFinite(m) && m > 0 && m <= 1440) tokenOps.reduce(c.lane, m); },
    undotime: c => { if (laneNo(c.lane) >= 0) tokenOps.undo(c.lane); },
    endtime: c => { if (laneNo(c.lane) >= 0) tokenOps.end(c.lane); },
    cleartime: c => { if (laneNo(c.lane) >= 0) tokenOps.clear(c.lane); },
    setdriver: c => { if (laneNo(c.lane) >= 0 && typeof c.driverId === 'string') tokenOps.who(c.lane, c.driverId); }
  };
  const tokenOps = {
    add(lane, minutes) {
      const i = carIndex(lane); if (!tokens || !tkOpen() || i < 0 || !(minutes > 0)) return false;
      const res = tokens.add(lane, minutes * 60000, raceT(), new Date().toISOString()); if (!res.ok) return false;
      if (res.started) { eng.restartCar(i, now()); live.flash.delete(eng.cars[i]); } // a new stint: the lane starts again from nothing
      afterTokenChange(); return true;
    },
    reduce(lane, minutes) { // take time off a lane that is on (never more than what is left: then the time is up at once)
      if (!tokens || !tkOpen() || carIndex(lane) < 0 || !(minutes > 0) || !tokens.reduce(lane, minutes * 60000, raceT()).ok) return false;
      afterTokenChange(); return true;
    },
    undo(lane) { if (!tokens || !tkOpen() || !tokens.undo(lane, raceT())) return false; afterTokenChange(); return true; },
    end(lane) { if (!tokens || !tkOpen() || !tokens.endNow(lane, raceT())) return false; afterTokenChange(); return true; },
    clear(lane) {
      const i = carIndex(lane); if (!tokens || !tkOpen() || i < 0 || !tokens.clear(lane, raceT())) return false;
      eng.restartCar(i, now()); live.flash.delete(eng.cars[i]); afterTokenChange(); return true;
    },
    who(lane, driverId) { // another driver on this lane (or a Guest): the time that is left goes with the lane
      const i = carIndex(lane); if (!tokens || !tkOpen() || i < 0 || (driverId && !find(drivers, driverId))) return false; // (a driver that is not in the database is not made a Guest by mistake)
      const p = personOf(driverId), car = eng.cars[i];
      const res = tokens.setWho(lane, { driverId: p.driverId, driverName: p.driverName, carId: car.carId || '', carName: car.carName || '' }, raceT(), new Date().toISOString());
      if (!res.changed) return false;
      eng.restartCar(i, now(), p); live.flash.delete(car);
      Object.assign(eng.cfg.entries[i], p); shareStatic(); live.lastShare = 0; // the other screens get the new driver with the next message (the names are part of the static data of a race)
      afterTokenChange(); return true;
    },
    pause: () => actions.pause()
  };
  live.tokenOps = tokenOps;
  // The session ends: every open stint is finished and the Race Director checks them before anything is saved (a session without a single lap has nothing to check).
  function finishTokens() {
    tokens.closeAll(raceT());
    if (!tokens.closedList().some(x => x.laps.length)) { tokens.discardClosed(); return endTokens('The session ended. No laps were driven, so nothing was saved.'); }
    live.phase = 'review'; live.tkFailed = ''; ui('msg').textContent = 'The session is over. Check the stints below, then press Finalize.';
    persistTokens(true); update();
    if (state.autoFinalize) finalizeTokens(); // only the automated tests skip the review
  }
  const tokenReview = c => { // a correction of a lap of a stint that waits to be saved
    const n = c.lap, id = c.sid; if (!Number.isInteger(id) || !Number.isInteger(n) || live.tkBusy) return;
    const ok = c.op === 'tkinvalid' ? tokens.fixClosed(id, n, { invalid: !!c.on }) : c.op === 'tkremove' ? tokens.fixClosed(id, n, { remove: c.recalc ? 'stint' : 'records' }) : false;
    if (ok) { recomputeBests(); persistTokens(true); }
    update();
  };
  async function finalizeTokens() {
    if (live.phase !== 'review' || live.tkBusy) return;
    live.tkBusy = true; live.tkFailed = ''; ui('msg').textContent = 'Saving…';
    try { await saveStints(); } finally { live.tkBusy = false; }
    if (tokens.hasPending()) {
      live.tkFailed = 'Some stints could not be saved. Press Finalize to try again.'; ui('msg').textContent = 'Some results could not be saved. Press Finalize to try again.';
      persistTokens(true); update(); return;
    }
    endTokens(live.tkTotal ? `The session ended. ${live.tkTotal} ${live.tkTotal === 1 ? 'stint was' : 'stints were'} saved. See Database > Results and Records > Token Records.` : 'The session ended. No laps were driven, so nothing was saved.');
  }
  function discardTokens() { // "Delete all data": nothing of the session is saved
    if (live.phase !== 'review' || live.tkBusy) return;
    tokens.discardClosed(); live.tkTotal = 0;
    endTokens('The session was deleted. Nothing was saved.');
  }
  function endTokens(msg) {
    live.phase = 'finished'; clearInterval(live.timers); live.sim.forEach(clearTimeout); document.removeEventListener('keydown', live.key);
    update(); persistTokens(true); ui('msg').textContent = msg;
  }
  if (tokens) {
    live.tkPanel = TokenPanel.build(ui('tokenpanel'), { tokens, lanes: eng.cars.map(c => c.lane).sort((a, b) => a - b), drivers: drivers.map(d => ({ id: d.id, name: titleOf('drivers', d) })), increments: tokenSet.increments, decrements: tokenSet.decrements,
      T: raceT, phase: () => live.phase, label: lane => (eng.cars[carIndex(lane)] || {}).driverId || '', ops: tokenOps });
    // a session that was not ended (the app was closed or crashed): carry on with the time that was left, or save what it recorded
    const kept = (state.settings.tokenSessions || {})[setup.id];
    if (kept && kept.data && tokens.restore(kept.data, 0)) {
      const carryOn = typeof confirm !== 'function' || confirm('A Time Token Session of this race setup was not ended (the app was closed). OK: carry on with the time that was left on each lane. Cancel: save what it recorded and start a new session.');
      if (carryOn) {
        eng.cars.forEach((c, i) => {
          const who = tokens.whoOf(c.lane), s = tokens.stintOf(c.lane);
          eng.restartCar(i, 0, who ? personOf(who.driverId) : undefined); if (who) Object.assign(eng.cfg.entries[i], personOf(who.driverId)); // (the names the other screens get are the ones of the earlier session)
          if (s) { s.laps.forEach(l => { c.laps.push(l.t); c.bad.push(!!l.bad); if (l.late || l.invalid) c.invalid.push(c.laps.length - 1); if (l.removed) c.removed.push(c.laps.length - 1); }); c.started = c.laps.length > 0; c.total = c.laps.reduce((a, b) => a + b, 0); const g = RaceEngine.goodLaps(c); c.best = g.length ? Math.min(...g) : null; }
        });
        ui('msg').textContent = 'The earlier session is back. Press Start to let the clocks run again.';
        if (kept.review && tokens.hasPending()) { live.phase = 'review'; ui('sim').disabled = true; ui('msg').textContent = 'The earlier session had ended. Check the stints below, then press Finalize.'; } // (it was waiting for the review)
      } else { tokens.closeAll(0); eng.cars.forEach(c => tokens.assign(c.lane, { driverId: c.driverId || '', driverName: c.driverName || 'Guest', carId: c.carId || '', carName: c.carName || '' })); saveStints().then(() => persistTokens(true)); }
    }
    if (!(kept && kept.data)) ui('msg').textContent = 'Press Start to open the session, then add time to a lane.';
  }
  shareStatic(); update(); drawOverall();
}
