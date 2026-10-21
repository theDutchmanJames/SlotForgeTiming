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
  const [drivers, cars, layouts, allLaps, penSystems, fuelRules, weatherSystems, rowDesigns, imageSets, audioSets, teams, damageSystems] = await Promise.all(['drivers', 'slotcars', 'layouts', 'laps', 'penaltysystems', 'fuelrules', 'weathersystems', 'rowdesigns', 'imagesets', 'audiosets', 'teams', 'damagesystems'].map(e => api.list(e)));
  let twSystems = []; try { twSystems = (await api.list('tyrewearsystems')) || []; } catch (x) { twSystems = []; } // (Tyre Wear Systems, 1.40.0)
  let scSystems = []; try { scSystems = (await api.list('safetycarsystems')) || []; } catch (x) { scSystems = []; } // (Safety Car Systems, 1.53.0)
  let psSystems = []; try { psSystems = (await api.list('pushsavesystems')) || []; } catch (x) { psSystems = []; } // (Push and Save Systems, 1.54.0)
  const find = (list, id) => list.find(x => x.id === id);
  const speed = state.speed || 1; // only changed by automated tests
  const setup = Endurance.effective(r.setup), heats = setup.sessionType === 'heats', tokenSession = setup.sessionType === 'tokens'; // (a Time Token Session: lanes are switched on with paid time, see tokens.js)
  const nameOf = (entity, list, id) => { const it = find(list, id); return it ? titleOf(entity, it) : ''; };
  const personOf = driverId => { const d = find(drivers, driverId); return { driverId: d ? d.id : '', driverName: d ? titleOf('drivers', d) : 'Guest', nickname: d ? d.nickname || '' : '', callsign: d ? d.callsign || '' : '', flag: d ? d.flag || '' : '', avatar: d ? d.avatar || '' : '' }; };
  const byTeam = heats && r.byTeam === true; // (1.8.0: the participants are teams; the driver of a team is chosen for every heat, see assignDrivers)
  const enduOn = !!setup.endurance; // (1.9.0: an Endurance Race: a team has a roster of the drivers who swap in the pits)
  const people = r.rows.map(x0 => {
    const x = byTeam ? { ...x0, driverId: '' } : x0, d = find(drivers, x.driverId) || {}, tm = find(teams, x.teamId);
    const mates = (Array.isArray(tm && tm.drivers) ? tm.drivers : []).filter(id => find(drivers, id)), asRace = enduOn && !!tm && mates.length >= 2; // (a team of two drivers or more swaps)
    return { driverId: x.driverId || '', carId: x.carId || '', driverName: nameOf('drivers', drivers, x.driverId) || (tokenSession ? 'Guest' : ''), carName: nameOf('slotcars', cars, x.carId), carPicture: (find(cars, x.carId) || {}).picture || '', carScale: (find(cars, x.carId) || {}).scale || '', tyre: (find(cars, x.carId) || {}).tyreCompound || '', // (the tyre the car races on when it is dry: the weather changes it in the pits)
      ...(find(cars, x.carId) && Number.isFinite(Number(find(cars, x.carId).damageFactor)) && String(find(cars, x.carId).damageFactor).trim() !== '' ? { damageFactor: Math.max(0, Number(find(cars, x.carId).damageFactor)) } : {}), // (a fragile car gets more damage from a hit, see damage.js)
      ...(find(cars, x.carId) && Number.isFinite(Number(find(cars, x.carId).failureFactor)) && String(find(cars, x.carId).failureFactor).trim() !== '' ? { failureFactor: Math.max(0, Number(find(cars, x.carId).failureFactor)) } : {}), // (a tired old car has more failures, see failures.js)
      nickname: d.nickname || '', callsign: d.callsign || '', flag: d.flag || '', avatar: d.avatar || '',
      ...(tm ? { teamId: tm.id, teamName: titleOf('teams', tm), teamPicture: tm.picture || '' } : {}),
      ...(byTeam || asRace ? { asTeam: true, teamDrivers: mates } : {}),
      ...(asRace ? { roster: mates.map(id => { const m = find(drivers, id); return { id, name: titleOf('drivers', m), nickname: m.nickname || '', callsign: m.callsign || '', flag: m.flag || '', avatar: m.avatar || '' }; }) } : {}) };
  });
  const lanes = Math.max(1, Math.floor(Number(r.track.lanes)) || people.length);
  const engineType = tokenSession ? 'practice' : heats ? (setup.heatBy === 'time' ? 'timed' : 'race') : setup.sessionType;
  const fuelCfg = RaceEngine.fuelConfig(setup, find(fuelRules, setup.fuelRules)), pitMs = fuelCfg.pitHold; // fuel on/off, tank, use per lap, refuel speed; pit stop hold time
  // Balance of Power: only for a race or a timed race with a Fuel System, when the race setup has it on (the settings are those of Race Setup > Balance of Power; the lane lengths are for the lane correction)
  const bopCfg = setup.bop === 'on' && fuelCfg.on && (engineType === 'race' || engineType === 'timed') ? Bop.engineConfig(state.settings, Array.from({ length: lanes }, (_, l) => Speed.laneLength(r.track, l))) : null;
  const penCfg = RaceEngine.penaltyConfig(find(penSystems, setup.penaltySystem)); // penalty points and how they turn into time
  const damCfg = tokenSession ? null : Damage.clean(find(damageSystems, setup.damageSystem), r.track.deslotTime); // damage points, the levels and the repair in the pits (a race or a timed race; the deslot time is that of the track)
  // Weather: only for a race or a timed race, with the weather system the setup has. Every engine (every heat) gets the settings with a seed for the random choices: the same one in every heat, unless the system says every heat has new weather
  const wxRec = !tokenSession && (engineType === 'race' || engineType === 'timed') ? find(weatherSystems, setup.weather) : null, wxSeed = (r.resume && r.resume.wxSeed) || Heats.newSeed(); // (a race that is carried on after an interruption has the weather it had)
  // wxLast: the seed of the race that was made last (kept in the snapshot of an interrupted race); wxForce: the seed of the race that was interrupted, so the weather goes on as it was planned (1.24.0)
  let wxLast = 0, wxForce = r.resume && r.resume.wxHeat !== undefined && r.resume.wxHeat !== null && Number.isFinite(Number(r.resume.wxHeat)) ? Number(r.resume.wxHeat) : null;
  const wxFor = () => { if (!wxRec) return null; const seed = Wx.clean(wxRec, 0).same ? wxSeed : wxForce !== null ? wxForce : Heats.newSeed(); wxForce = null; wxLast = seed; return Wx.clean(wxRec, seed); };
  // a final has its own length (0 is the same as a heat). lenNow: the length of the race that is racing, or is next while the race waits between two races
  const finalLen = () => ({ laps: Number(setup.finalLaps) > 0 ? Number(setup.finalLaps) : setup.laps, duration: Number(setup.finalDuration) > 0 ? Number(setup.finalDuration) : setup.duration, distance: Number(setup.finalDistance) > 0 ? Number(setup.finalDistance) : setup.distance });
  const lenNow = () => (heat && heat.isFinal() ? finalLen() : { laps: setup.laps, duration: setup.duration, distance: setup.distance });
  const setupNow = () => (heat && heat.isFinal() ? { ...setup, ...finalLen() } : setup);
  // 1.35.1: swaps counted in distance need the length of every lane (metres) and the unit to say it in (App Settings: metres or feet)
  const laneLens = Array.from({ length: lanes }, (_, l) => Number(Speed.laneLength(r.track || {}, l)) || 0);
  // Tyre Wear (1.40.0): the system of the setup, with the lane lengths (for a system that counts the wear per distance) and the distance unit of the app; never in a Time Token Session. The engine decides by the kind of session if it is used (practice and qualifying: when the system says so)
  const twCfg = tokenSession ? null : TyreWear.clean(find(twSystems, setup.tyreWear), { laneLen: laneLens, disp: Speed.distUnitOf(state.settings) });
  // Safety Car (1.53.0): the system of the setup (never in a Time Token Session); its lap target and points replace the Yellow flag fields of the setup
  const scCfg = tokenSession ? null : SafetyCar.clean(find(scSystems, setup.safetyCar));
  // Push and Save (1.54.0): the system of the setup (never in a Time Token Session) and the best lap of every driver on this track (the records), the reference lap of the pace; a lap that was removed from the records does not count
  const psCfg = tokenSession ? null : PushSave.clean(find(psSystems, setup.pushSave));
  const psRecs = new Map(); if (psCfg) allLaps.filter(l => l.trackId === r.track.id && !l.token && !l.noPersonalBest && l.driverId && l.time > 0).forEach(l => psRecs.set(l.driverId, Math.min(psRecs.get(l.driverId) ?? Infinity, l.time / speed)));
  const psEntries = entries => (psCfg ? entries.map(e => ({ ...e, psRec: psRecs.get(e.driverId) || 0 })) : entries);
  const enduCfg = setup.endurance && setup.endurance.unit === 'distance' ? { ...setup.endurance, disp: Speed.distUnitOf(state.settings) } : setup.endurance || null;
  const mk = entries => RaceEngine.createRace({ penalty: penCfg, damage: damCfg, type: engineType, laps: lenNow().laps, duration: lenNow().duration, distance: engineType === 'race' ? Distance.config(setupNow(), r.track, lanes) : null, compare: engineType === 'timed' ? Distance.compare(setup, r.track, lanes) : null, sectors: Distance.sectors(r.track), endRule: setup.endRule, minLap: Math.max(RaceEngine.MIN_LAP, (Number(r.track.minLap) || 0) * 1000) / speed, maxLap: (Number(r.track.maxLap) || 0) * 1000 / speed, fuel: fuelCfg, bop: bopCfg, yellow: RaceEngine.yellowConfig(setup), weather: wxFor(), tyrewear: twCfg, safetycar: scCfg, pushsave: psCfg, skipFirst: tokenSession || setup.firstLap === 'skip', endurance: enduCfg, laneLengths: setup.endurance && setup.endurance.unit === 'distance' ? laneLens : null, rnd: state.rand || Math.random, entries: psEntries(entries) });
  const pointList = String(setup.points || '').split(',').filter(t => t.trim() !== '').map(Number).filter(n => !isNaN(n)); // '10, 8, 6' -> [10, 8, 6]; blank pieces are skipped (Number('') would make them 0)

  let heat = null, eng;
  // Teams as participants (1.8.0): the driver of a team in a heat comes from the roster of the team (Heats.driversForHeat). The drivers who have driven are remembered per participant.
  const teamHist = people.map(() => []), teamChosen = {}; let teamNote = '';
  const setDriver = (p, id) => { const d = find(drivers, id) || {}; Object.assign(people[p], { driverId: d.id || '', driverName: d.id ? titleOf('drivers', d) : '', nickname: d.nickname || '', callsign: d.callsign || '', flag: d.flag || '', avatar: d.avatar || '' }); };
  const nextParticipants = () => { if (!heat || !heat.hasNext()) return []; if (heat.isFinal()) { const f = heat.finalNow(); return f ? f.drivers : []; } return (heat.schedule[heat.idx] || []).map(e => e.p); };
  const assignDrivers = () => {
    teamNote = ''; if (!byTeam || !heat.hasNext()) return;
    const ps = nextParticipants(), rosters = {}; ps.forEach(p => { rosters[p] = people[p].teamDrivers; });
    const res = Heats.driversForHeat({ rosters, heat: ps, rule: setup.teamDriver, history: teamHist, chosen: teamChosen, rnd: state.rand || Math.random });
    ps.forEach(p => setDriver(p, res.picks[p]));
    const nm = list => Heats.andList(list.map(p => people[p].teamName || 'Team ' + (p + 1)));
    teamNote = [res.empty.length ? `${nm(res.empty)} ${res.empty.length === 1 ? 'has' : 'have'} no drivers.` : '', res.clash.length ? `${nm(res.clash)} ${res.clash.length === 1 ? 'has' : 'have'} no driver who is free: ${res.clash.length === 1 ? 'its' : 'their'} first driver drives anyway, although that driver is also driving for another team in this heat.` : ''].filter(Boolean).join(' ');
  };
  if (heats) {
    const schedule = Heats.fits(r.schedule, people.length, lanes) ? r.schedule : Heats.plan({ count: people.length, lanes, setup, seed: Heats.newSeed() }); // (the plan from the Home tab, when there is one that fits)
    heat = RaceEngine.createHeatRace({ participants: people, schedule, lanes, resultBy: setup.resultBy, points: setup.resultBy === 'points' ? pointList : [], ...RaceEngine.scoringOf(setup), ...RaceEngine.finalsOf(setup) });
    assignDrivers();
    eng = mk(heat.entries());
  } else if (tokenSession) eng = mk(Array.from({ length: lanes }, (_, i) => ({ lane: i, ...(people[i] || { driverId: '', carId: '', driverName: 'Guest', carName: '', carPicture: '', carScale: '', nickname: '', callsign: '', flag: '', avatar: '' }) }))); // every lane of the track can be sold, with or without a driver
  else eng = mk(people.map((p, i) => ({ lane: i, ...p })));

  if (live) { if (live.perfStop) live.perfStop(); if (live.fsView) live.fsView.close(); document.removeEventListener('keydown', live.fsKey); live.callRun = -1; live.calling = false; clearTimeout(live.callTimer); Sound.stop(); if (live.offTm) live.offTm(); if (live.box) { live.box.off(); live.box = null; } if (live.offTmStatus) live.offTmStatus(); if (live.offCmd) live.offCmd(); if (live.offResync) live.offResync(); clearTimeout(live.shareTimer); clearInterval(live.timers); clearInterval(live.breakTimer); (live.sim || []).forEach(clearTimeout); if (live.flushTokens) live.flushTokens(); document.removeEventListener('keydown', live.key); }
  // earlier laps on this track, for personal best / track record highlights and the record lap widget
  const base = { personal: new Map(), track: Infinity, trackName: '' };
  // laps removed from the records (but kept in their session) do not count here
  allLaps.filter(l => l.trackId === r.track.id && !!l.token === tokenSession).forEach(l => { // (Racing Records and Token Records are separate pools)
    if (!l.noTrackRecord && l.time < base.track) { base.trackName = nameOf('drivers', drivers, l.driverId) || (l.driverId ? '(deleted)' : 'Guest'); base.track = l.time; } // (a Guest, who has no driver in the database, can hold the track record of the Token Records)
    if (!l.noPersonalBest && l.driverId) base.personal.set(l.driverId, Math.min(base.personal.get(l.driverId) ?? Infinity, l.time)); // (a Guest has no personal best)
  });
  live = { trkCards: [], phase: 'ready', calling: false, callRun: 0, callTimer: null, timers: null, sim: [], key: null, laps: [], stopping: false, flash: new Map(), lights: 0, nodes: [], lapBtns: [], pitBtns: [], callBtns: [], callsKey: null, // (null: the strip is drawn the first time)
    alive: true, raceRef: r, stintBy: new Map(), extraBy: new Map(), tyreBy: new Map(), bestBy: new Map(), bestAll: Infinity, bestAllName: '', priorBy: new Map(), priorAll: Infinity, priorAllName: '', lapsOpen: false, lapSig: null, rvHtml: '' }; // (prior: the bests of the heats that are finished)
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
  const scoreCol = heats && (heat.scoring.countBy !== 'total' || heat.scoring.dropWorst || heat.scoring.byTime || (heat.scoring.lapsFirst && !byPts) || (finalsOn && fmode.finalMode === 'added')); // a column with the result that counts (average, best heats, worst heat dropped, a final that is added)
  const dUnit = Speed.distUnitOf(state.settings); // (the unit of a distance on the screen: metres or feet)
  const finalsNote = !finalsOn ? '' : `, then ${heat.total - heat.count === 2 ? 'finals B and A' : 'a final A'}${setup.heatBy === 'time' ? (Number(setup.finalDuration) > 0 ? ` of ${setup.finalDuration} minutes` : '') : setup.heatBy === 'distance' ? (Number(setup.finalDistance) > 0 ? ` of ${Distance.text(Number(setup.finalDistance), dUnit)}` : '') : (Number(setup.finalLaps) > 0 ? ` of ${setup.finalLaps} laps` : '')}`;
  const byDist = Distance.compareOn(setup) ? ', compared by distance' : ''; // (1.64.0: a time race whose cars are ranked by the distance they drove)
  const limit = tokenSession ? 'paid time per lane' : heats ? `${heat.count} heats, each ${setup.heatBy === 'time' ? setup.duration + ' minutes' + byDist : setup.heatBy === 'distance' ? Distance.lengthText(setup, dUnit) : setup.laps + ' laps'}${finalsNote}`
    : setup.sessionType === 'race' ? (Distance.isOn(setup) ? Distance.lengthText(setup, dUnit) : `${setup.laps} laps`) : (setup.sessionType === 'timed' || setup.sessionType === 'qualifying') ? `${setup.duration} minutes${setup.sessionType === 'timed' ? byDist : ''}` : 'no limit';
  const limitFull = setup.endurance && !tokenSession ? `${limit}, ${Endurance.rulesText(enduCfg)}` : limit; // (an Endurance Race says how it swaps)
  const planHtml = !heats ? '' : `<details class="card" id="heatlistcard" style="margin-top:12px" open><summary>Heat list (${heat.count} ${heat.count === 1 ? 'heat' : 'heats'}${finalsOn ? (heat.total - heat.count === 2 ? ' and 2 finals' : ' and a final') : ''})</summary>
    <div class="wrap" id="heatlist"></div><div class="row"><button class="btn" id="heatprint" type="button" title="Make a PDF of the heat list, to print or pin up">Print the heat list</button> <span id="heatprintmsg" class="muted" role="status"></span></div></details>`;
  const host = raceHost();
  const folderHtml = (id, title, note, tone, inner) => DirFolder.html(id, title, note, tone, inner, { id: 'fd-' + id }); // (1.15.0: the folders of the Race Director page, with the same colours and order)
  host.innerHTML = `<p class="muted rt-title"><strong>${esc(setup.name)}</strong> · ${esc(SESSION_LABEL[setup.ofType || setup.sessionType])} on ${esc(r.track.name)} · ${esc(limitFull)}${r.champ ? ` · <span class="chtag" id="chtag" title="This race is saved as part of the championship">${esc(Champ.tagText(r.champ))}</span>` : ''}</p>
    <div class="rt-stage"><div class="canvas live" id="canvas"></div></div>
    <div class="bar rt-tools"><label><input type="checkbox" id="sim"> Simulated cars</label><span id="tmstatus" class="muted" role="status"></span>
      <button class="btn" id="fsbtn" type="button" title="Show only the widgets, as large as the window allows (F). Esc closes it.">Full screen widgets</button><button class="btn" id="lapsbtn" aria-expanded="false" hidden title="Check the laps while the race goes on: mark a lap invalid or take it out of the records">Review laps</button><span id="msg" class="muted" role="status"></span><button class="btn danger stopbtn" id="stopbtn">Stop race</button><button class="btn" id="back">Back to Home</button></div>
    <p id="perfline" class="muted perfline" hidden role="status" aria-label="Performance"></p>
    <div id="calls" class="card calls" hidden></div>
    <div id="finalpick" class="card" hidden></div>
    <div id="teampick" class="card" hidden></div>
    <div class="rt-folders">
      ${folderHtml('track', 'Track actions', 'Lap, pit and call buttons for each lane', 'green', '<p class="trk-hint muted" id="trkhint" role="status" hidden></p><div id="trackgrid" class="trk-grid"></div>')}
      ${tokenSession ? folderHtml('tokens', 'Time tokens', 'Add time to a lane to switch it on', 'teal', '<div id="tokenpanel" class="tkpanel"></div>') : folderHtml('adjust', 'Adjust', 'Penalty points, damage points, time, laps and championship points for one lane', 'plain', '<div id="adjpanel" class="boppanel adjpanel"></div>')}
      ${penCfg.on ? folderHtml('penalties', 'Penalties', 'Points and penalties for each lane', 'yellow', '<div id="penpanel"></div>') : ''}
      ${bopCfg ? folderHtml('bop', 'Balance of Power', 'Even out fast and slow cars', 'white', '<div id="boppanel" class="boppanel"></div>') : ''}
      ${eng.damage ? folderHtml('damage', 'Damage', 'Incidents and repairs', 'red', '<div id="dmpanel" class="boppanel"></div>') : ''}
      ${eng.failures ? folderHtml('failures', 'Car Failures', 'Give a car a failure, or clear it', 'red', '<div id="flpanel" class="boppanel"></div>') : ''}
      ${eng.weather ? folderHtml('weather', 'Weather', 'Rain, tyres and pit stops', 'blue', '<div id="wxpanel" class="boppanel"></div>') : ''}
      ${tokenSession ? '' : folderHtml('tyre', 'Tyre Change', 'Give a car another tyre', 'purple', '<div id="typanel" class="boppanel"></div>')}
      ${eng.pushSave ? folderHtml('pushsave', 'Push and Save', 'How hard each driver drives, and what it costs in tyres and fuel', 'lime', '<div id="pspanel" class="boppanel"></div>') : ''}
      ${setup.endurance ? folderHtml('endurance', 'Endurance', 'Driver swaps', 'brown', '<div id="enpanel" class="boppanel"></div>') : ''}
    </div>
    <div id="lapreview" class="card rv" hidden></div>
    <div id="review" class="card rv" hidden></div>
    <div id="champpanel" class="card chpanelbox" hidden></div>
    <p class="muted">Space starts, pauses and resumes · Y yellow flag · R red flag · S stops the race · F shows the widgets full screen (Esc closes it) · press a lane's number key (or its Lap button) each time a car crosses the line${tokenSession ? ' (a lane without paid time ignores it, and a lane whose time is up records the lap but does not count it)' : ''}${tokenSession ? '' : ' · Shift + number (or the Pit button) puts that lane\'s car on the sensor, press again to drive off'} · Ctrl + number (or the Call button) is a call from that lane: the yellow flag goes up and the Race Director decides what happens.</p>
    ${planHtml}${heats ? '<h4>Overall result</h4>' + (scoreNote ? `<p class="hint2" id="overallnote">${esc(scoreNote)}</p>` : '') + `<div class="wrap"><table class="fields"><thead><tr><th>Pos</th><th>${byTeam ? 'Team' : 'Driver'}</th><th>Heats</th><th>Laps</th><th>Points</th>${scoreCol ? '<th>Result</th>' : ''}${finalsOn ? '<th>Final</th>' : ''}<th>Best lap</th></tr></thead><tbody id="overall"></tbody></table></div>` : ''}`;

  const now = () => performance.now();
  const ui = id => { // (the race screen has a place of its own: its ids can not be mixed up with those of the screen that is shown)
    const el = typeof HTMLElement !== 'undefined' && host instanceof HTMLElement ? host.querySelector(`[id="${id}"]`) : null;
    return el || document.getElementById(id);
  };

  // ---- build the page from the layout (once); widgets for lanes the track does not have are left out ----
  live.nodes = LiveCanvas.build(ui('canvas'), layout, lanes, { onButton: type => actions[type](), imageSets });
  // the Performance line (App Settings > General > Performance, 1.60.0): a small line under the buttons with the frames a second, the time of a screen update and the CPU of the app, when it is switched on
  const syncPerfLine = () => {
    if (typeof PerfUI === 'undefined') return;
    const want = !!(state.settings && state.settings.perfLine) && !!ui('perfline');
    if (want && !live.perfStop) live.perfStop = PerfUI.line(ui('perfline'));
    else if (!want && live.perfStop) { live.perfStop(); live.perfStop = null; }
  };
  if (typeof PerfUI !== 'undefined') PerfUI.race = () => ({ name: setup.name, widgets: live.nodes.length, lanes });
  syncPerfLine();
  // Track actions (1.15.0): a card for each lane with the buttons Lap, Pit and Call, large and in colour. The keys are said on the buttons (1-8 for Lap, Shift + number for Pit, Ctrl + number for Call).
  const LAP_TITLE = 'A car crosses the line on this lane: counts a lap by hand, as if the sensor had seen the car';
  // Why the Lap, Pit and Call buttons are dimmed (1.16.1): they only work while the race is running (Call also while it is paused)
  const trackHint = () => ({ ready: 'The Lap, Pit and Call buttons work while the race is running. Press Start (or Space) first.', countdown: 'The race is starting. The buttons work when the lights go out.',
    paused: 'The race is paused. Lap and Pit work again when you resume (Space); Call works now.', between: 'Between two heats. The buttons work when the next heat starts.', review: 'The race is over, so the buttons are off.' })[live.phase] || '';
  const mkEl = (tag, cls, text) => { const el = document.createElement(tag); el.className = cls; if (text !== undefined) el.textContent = text; return el; };
  for (let l = 0; l < lanes; l++) {
    const card = mkEl('div', 'trk-card'), head = mkEl('div', 'trk-head'), num = mkEl('span', 'trk-lane', String(l + 1)), who = mkEl('span', 'trk-who'), row = mkEl('div', 'trk-sub');
    head.appendChild(num); head.appendChild(who); card.appendChild(head);
    const b = mkEl('button', 'btn trk-btn trk-lap', `Lap ${l + 1}`); b.onclick = () => crossLane(l); b.title = LAP_TITLE; if (l < 8) b.setAttribute('data-key', String(l + 1));
    card.appendChild(b); live.lapBtns.push({ lane: l, b });
    if (!tokenSession) { const pb = mkEl('button', 'btn trk-btn trk-pit', `Pit ${l + 1}`); pb.onclick = () => togglePit(l); pb.title = 'Put this lane\'s car on the pit sensor; press again to drive off'; if (l < 8) pb.setAttribute('data-key', '⇧' + (l + 1));
      row.appendChild(pb); live.pitBtns.push({ lane: l, b: pb }); }
    const cb = mkEl('button', 'btn trk-btn trk-call', `Call ${l + 1}`); cb.title = 'A call from this lane: raises the yellow flag, the Race Director decides'; cb.onclick = () => actions.call(l); if (l < 8) cb.setAttribute('data-key', 'Ctrl ' + (l + 1));
    row.appendChild(cb); live.callBtns.push({ lane: l, b: cb });
    card.appendChild(row); ui('trackgrid').appendChild(card); live.trkCards.push({ lane: l, card, who });
  }

  // championship points of the heats finished so far: { on, list: points per position, done: [[driverId, points]] }
  const champOf = () => (heats && setup.resultBy === 'points' ? { on: true, list: pointList, done: heat.overall().map(o => [o.asTeam ? o.teamId : o.driverId, o.points]) } : { on: false, list: [], done: [] });
  const shared = () => LiveShare.makeShared({ rowDesigns, imageSets, teams: teams.map(t => ({ id: t.id, name: t.name || '', picture: t.picture || '' })), clubLogo: state.settings.clubLogo, distUnit: dUnit, champ: champOf(), eng, track: r.track, now: now(), phase: live.phase, calling: live.calling, lights: live.lights, setup: setupNow(), heat: heatInfo(),
    flash: live.flash, layout, bestAll: live.bestAll, bestAllName: live.bestAllName, bestBy: live.bestBy, base, tokens: tokens ? tokens.snapshot() : null });
  // ---- share the race with the second-screen window (and later other devices) ----
  const shareTitle = `${setup.name} · ${SESSION_LABEL[setup.ofType || setup.sessionType]} on ${r.track.name} · ${limit}`;
  const tokenUi = () => (tokenSession ? { increments: tokenSet.increments.slice(), decrements: tokenSet.decrements.slice(), drivers: drivers.map(d => ({ id: d.id, name: titleOf('drivers', d) })) } : null); // what the Tokens page on other screens needs: the time buttons and the drivers to choose from
  const shareStatic = () => { // everything heavy, once per heat
    live.raceId = String(Date.now()) + Math.random().toString(36).slice(2, 6);
    if (live.sender) live.sender.reset(); // a new heat: the first message after the static part holds everything
    if (api.liveStatic) api.liveStatic(LiveShare.packStatic({ rowDesigns, imageSets, teams: LiveShare.teamsUsed(teams, find(layouts, setup.layout2) || layout, rowDesigns), clubLogo: state.settings.clubLogo, distUnit: dUnit, tokenUi: tokenUi(), raceId: live.raceId, title: shareTitle, eng, setup: setupNow(), layout: find(layouts, setup.layout2) || layout, track: r.track, lanes, base }));
  };
  const share = () => { // the light part: only when something changed (at most about ten times a second), and a small message every second so the clocks stay right
    if (!api.livePush) return;
    const t = now();
    if (t - (live.lastShare || -1e9) < 80) { if (!live.shareTimer) { const L = live; L.shareTimer = setTimeout(() => { L.shareTimer = null; if (live === L) share(); }, 90); } return; }
    live.lastShare = t;
    if (!live.sender) live.sender = LiveShare.sender();
    const msg = live.sender.pack({ champ: champOf(), raceId: live.raceId, eng, phase: live.phase, calling: live.calling, lights: live.lights, heat: heatInfo(), flash: live.flash, bestAll: live.bestAll, bestAllName: live.bestAllName, bestBy: live.bestBy, tokens: tokens ? tokens.snapshot() : null, now: t }, t);
    if (msg) api.livePush(msg);
  };
  // announcements: only on this computer, and only when the race setup has an audio set
  Sound.resetCool(); // (a new race: nothing was said lately, for the "not again within" waits of the audio set)
  // what the announcer measures a lap against: the records of the database and the laps of the heats that are already driven in this event (the next heat has a new announcer)
  const annBase = () => { const personal = new Map(base.personal); live.priorBy.forEach((t, id) => { if (id && t < (personal.get(id) ?? Infinity)) personal.set(id, t); }); return { personal, track: Math.min(base.track, live.priorAll), trackName: base.trackName }; };
  const audioSet = find(audioSets, setup.audioSet), mkAnn = () => Announcer.create({ driverBy: audioSet && audioSet.driverBy, distances: audioSet ? Sound.distances(audioSet.distances) : [], lapsToGo: audioSet ? Sound.counts(audioSet.lapsToGo, [3]) : [], minutesToGo: audioSet ? Sound.counts(audioSet.minutesToGo, [1]) : [],
    closeGap: audioSet ? Sound.bounded(audioSet.closeGap, 1, 0.1, 30) : 1, battleLaps: audioSet ? Sound.bounded(audioSet.battleLaps, 3, 2, 20) : 3,
    nearRecord: audioSet ? Sound.bounded(audioSet.nearRecord, 0.1, 0.01, 5) : 0.1, noLapSeconds: audioSet ? Math.round(Sound.bounded(audioSet.noLapSeconds, 30, 5, 600)) : 30, trackName: (r.track && r.track.name) || '', lapSound: audioSet ? Sound.wantsLaps(audioSet) : false, lapLimit: engineType === 'race' && !Distance.isOn(setupNow()) ? Number(lenNow().laps) || 0 : 0, base: annBase() });
  // the race that is racing, or the next one while the race waits between two races. final: 'A' or 'B' when that race is a final (and also after the last final, when it is over);
  // total: the number of races with the finals; picking: the lanes of the final are not all chosen; breakLeft: the seconds of the break that are left
  const finalAt = () => { const i = Math.min(heat.idx, heat.total - 1); return i >= heat.count ? heat.raceName(i).slice(6) : ''; };
  // the heat list for the other screens, made again only when a heat is finished or the lanes of a final change
  const heatListLite = () => { const k = heat.results.length + ':' + heat.idx + ':' + Object.values(heat.picks).reduce((n, x) => n + x.length, 0); if (live.hlKey !== k) { live.hlKey = k; live.hlLite = Heats.listLite(Heats.listOf(heat, people, { labels: r.labels })); } return live.hlLite; };
  // the time every driver has raced in the heats that are done (the Total Time widget, 1.63.0), made again only when a heat is finished
  const heatBefore = () => { const k = heat.results.length; if (live.tbKey !== k) { live.tbKey = k; live.tbList = heat.spentBy(); } return live.tbList; };
  const heatInfo = () => (heats ? { idx: heat.idx, count: heat.count, by: byPts ? 'points' : heat.scoring.byTime ? 'time' : 'laps', list: heatListLite(), ...(heat.results.length ? { before: heatBefore() } : {}), ...(finalsOn ? { total: heat.total } : {}), ...(finalsOn && finalAt() ? { final: finalAt() } : {}),
    ...(live.phase === 'between' && !heat.picksDone() ? { picking: true } : {}), ...(live.breakLeft > 0 ? { breakLeft: live.breakLeft } : {}) } : null);
  // the drivers of the heat that is next, for the announcer to read out (with the lanes they race in)
  const lineupNow = () => (heats && heat.hasNext() ? heat.entries().map(e => ({ lane: heat.isFinal() && !heat.picksDone() ? -1 : e.lane, name: e.asTeam && e.teamName ? `${e.teamName}${e.driverName ? ' with ' + e.driverName : ''}` : e.driverName || '', nickname: e.nickname || '', callsign: e.callsign || '' })).sort((a, b) => a.lane - b.lane) : []);
  const announce = () => {
    if (!audioSet || !live.ann) return;
    try { live.ann.observe(eng, { phase: live.phase, lights: live.lights, now: now(), heat: heatInfo(), lineup: heats && live.phase === 'between' ? lineupNow() : undefined, trackmate: typeof Trackmate !== 'undefined' && Trackmate.link && Hardware.timingChosen(state.settings) === 'trackmate' ? !!Trackmate.link.connected : undefined /* (only when the Trackmate is the timing hardware: the box has no such call) */, idle: c => !!tokens && ['idle', 'out'].includes(tokens.stateOf(c.lane, raceT())) }).forEach(e => Sound.say(audioSet, e.call, e.vars, undefined, undefined, e.facts)); } catch (x) { /* a sound problem never stops the race */ }
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
    const put = (d, t, name) => { if (d && t < (by.get(d) ?? Infinity)) by.set(d, t); if (t < all) { all = t; who = name; } };
    eng.cars.forEach(c => c.laps.forEach((t, n) => { if (!c.bad[n] && !c.invalid.includes(n) && !c.removed.includes(n)) put(c.en ? Endurance.driverAtLap(c.en, n) : c.driverId, t, c.driverName); })); // (an Endurance Race: the driver who drove that lap)
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
  const updateNow = () => {
    const ph = (typeof PerfUI !== 'undefined' && PerfUI.phases()) || (() => {}); // (how long each part of an update takes: only while the Performance line or report is shown, 1.60.1)
    checkpoint(); ph('save point');
    if (live.box) live.box.sync();
    drawHeatList(); ph('heat list');
    announce(); announceTokens(); if (live.powerFollow) live.powerFollow(); ph('announcer');
    const S = shared(); ph('state');
    LiveCanvas.paint(live.nodes, S, typeof PerfUI !== 'undefined' ? PerfUI.widgetTimer() : null); ph('widgets');
    if (live.fsView) { LiveCanvas.paint(live.fsView.nodes, S); ph('full screen widgets'); }
    live.pitBtns.forEach(x => {
      const c = S.carByLane(x.lane), blocked = !!c && c.blockAt !== null;
      x.b.disabled = !(live.phase === 'running' && c && !c.done); x.b.hidden = !c; x.b.textContent = blocked ? `Leave pit ${x.lane + 1}` : `Pit ${x.lane + 1}`; x.b.setAttribute('aria-pressed', String(blocked)); // (the button stays lit while the car is in the pit)
    }); ph('pit buttons');
    if (live.phase === 'review') {
      ui('review').hidden = false; live.reviewShown = true;
      if (!live.tkBusy) { const h = tokens ? Review.stintsHtml(tokens.closedList().filter(x => x.laps.length), { failed: live.tkFailed }) : Review.html(eng, { champ: champOf(), settings: AdjustPad.forSetup(state.settings, setup) }); if (h !== live.rvHtml) { live.rvHtml = h; ui('review').innerHTML = h; } } // (only when it changed: a button never changes under your finger; not while the stints are being saved)
    } else if (live.reviewShown) { ui('review').innerHTML = ''; ui('review').hidden = true; live.reviewShown = false; live.rvHtml = ''; }
    ph('review');
    drawLapReview(); drawFinalPick(); drawTeamPick(); ph('lap review');
    live.lapBtns.forEach(x => { const c = S.carByLane(x.lane); x.b.disabled = !(live.phase === 'running' && c && !c.done); x.b.hidden = !c; x.b.title = x.b.disabled ? (c && c.done && live.phase === 'running' ? 'This car has finished' : trackHint() || 'Not now') : LAP_TITLE; });
    { const h = trackHint(); if (ui('trkhint') && ui('trkhint').textContent !== h) { ui('trkhint').textContent = h; ui('trkhint').hidden = !h; } } // (why the buttons are dimmed: they only work while the race runs)
    live.callBtns.forEach(x => { const c = S.carByLane(x.lane), calling = !!c && eng.calls.some(k => k.open && eng.cars[k.car] && eng.cars[k.car].lane === x.lane); x.b.disabled = !(['running', 'paused'].includes(live.phase) && c && !c.done); x.b.hidden = !c; x.b.setAttribute('data-active', String(calling)); }); // (a lane with a call that waits for the Race Director stays lit)
    live.trkCards.forEach(x => { const c = S.carByLane(x.lane), name = c ? (c.driverName || '') : ''; x.card.hidden = !c; if (x.who.textContent !== name) x.who.textContent = name; });
    ph('lane buttons');
    drawCalls(); ph('calls');
    drawAdjust(); ph('adjust pad');
    if (live.penPanel) live.penPanel.update();
    if (live.tkPanel) live.tkPanel.update();
    if (live.bopPanel) live.bopPanel.update();
    if (live.wxPanel) live.wxPanel.update();
    if (live.tyPanel) live.tyPanel.update();
    if (live.psPanel) live.psPanel.update();
    if (live.enPanel) live.enPanel.update();
    if (live.dmPanel) live.dmPanel.update();
    if (live.flPanel) live.flPanel.update();
    ph('panels');
    syncFolders(); ph('folders');
    if (tokens && live.phase === 'running' && now() - (live.tkAt || -1e9) > 10000) persistTokens(true); // (the clocks that run: kept every ten seconds)
    ui('back').disabled = raceActive();
    ui('stopbtn').disabled = !(live.phase === 'running' || live.phase === 'paused' || live.phase === 'between');
    ph('buttons');
    share(); ph('share');
  };
  // (how long a screen update takes is measured for the Performance line, only while it is shown: 1.60.0)
  const update = () => {
    const t0 = typeof PerfUI !== 'undefined' && PerfUI.active() ? performance.now() : -1;
    updateNow();
    if (t0 >= 0) PerfUI.noteUpdate(performance.now() - t0);
  };
  // the Adjust folder (1.13.0, a folder since 1.15.0): the pads of the Race Director page (penalty points, damage points, time, laps, championship points) on the Race tab; there while the race is waiting, running or paused
  const drawAdjust = () => {
    const p = live.adjPanel, f = ui('fd-adjust'); if (!p || !f) return;
    const show = ['ready', 'running', 'paused', 'between'].includes(live.phase) && p.usable();
    f.hidden = !show; if (show) p.update();
  };
  // the folders of the panels that decide themselves whether they have anything to show (Balance of Power, Damage, Weather, Endurance): when the panel is hidden, its folder goes too
  const syncFolders = () => [['bop', 'boppanel'], ['damage', 'dmpanel'], ['failures', 'flpanel'], ['weather', 'wxpanel'], ['endurance', 'enpanel']].forEach(([f, pn]) => { const fd = ui('fd-' + f), pb = ui(pn); if (fd && pb) fd.hidden = !!pb.hidden; });
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
    drawHeatList();
    ui('overall').innerHTML = heat.overall().map(o => `<tr><td>${o.pos}</td><td>${esc(o.asTeam ? o.teamName : o.driverName)}</td><td class="num">${o.heats}</td><td class="num">${o.laps}</td>
      <td class="num">${setup.resultBy === 'points' ? o.points : ''}</td>${scoreCol ? `<td class="num">${esc(Heats.scoreText(o, heat.scoring, { finalMode: fmode.finalMode, byPoints: byPts, unit: dUnit }))}</td>` : ''}${finalsOn ? `<td>${esc(Heats.finalCell(o))}</td>` : ''}<td class="num">${RaceEngine.fmtTime(o.best)}</td></tr>`).join('');
  };

  // the heat list: every heat with its drivers by lane, how it went and what it gave. The heat that is racing (or is next) is marked. Only drawn again when something in it changed.
  const heatListOf = () => Heats.listOf(heat, people, { live: ['countdown', 'running', 'paused', 'review'].includes(live.phase), labels: r.labels });
  const drawHeatList = () => {
    if (!heats || !ui('heatlist')) return;
    const list = heatListOf(), sig = JSON.stringify(list.map(x => [x.state, x.drivers.map(d => [d.p, d.lane]), x.rows.map(y => [y.participant, y.pos, y.points, y.tm, y.fin, y.laps])]));
    if (sig === live.heatListSig) return;
    live.heatListSig = sig;
    const STATE = { done: 'Done', current: 'Racing now', next: 'Next', later: '' }, tmOn = !!heat.scoring.byTime;
    ui('heatlist').innerHTML = `<table class="fields hl"><thead><tr><th>Heat</th><th>Drivers by lane</th><th>Winner</th><th>${byPts ? 'Points' : tmOn ? 'Times' : 'Laps'}</th>${byPts || tmOn ? '<th>Laps</th>' : ''}</tr></thead><tbody>${list.map(x => {
      const lanes = x.drivers.map(d => `${Number.isInteger(d.lane) ? 'Lane ' + (d.lane + 1) + ': ' : ''}${esc(d.name)}`).join(' · ') || '<span class="muted">decided after the heats</span>';
      const res = x.rows.map(y => `${esc(y.pos)}. ${esc(y.name)} ${esc(byPts ? (y.points || 0) : tmOn ? (Heats.rowFigure(y, { time: true }) || y.laps + ' laps') : y.laps + (y.laps === 1 ? ' lap' : ' laps'))}`).join(' · ');
      return `<tr class="hl-${x.state}"${x.state === 'current' || x.state === 'next' ? ' aria-current="step"' : ''}><td>${esc(x.name)}${x.label ? ` <span class="muted">${esc(x.label)}</span>` : ''}${STATE[x.state] ? ` <span class="hl-tag">${STATE[x.state]}</span>` : ''}</td><td>${lanes}</td><td>${x.winner ? esc(x.winner.name) : ''}</td><td>${res}</td>${byPts || tmOn ? `<td>${x.rows.map(y => esc(y.laps)).join(' · ')}</td>` : ''}</tr>`;
    }).join('')}</tbody></table>`;
  };
  if (heats && ui('heatprint')) ui('heatprint').onclick = () => {
    const say = t => { ui('heatprintmsg').textContent = t; }, byTm = !!heat.scoring.byTime;
    say('Making the PDF...');
    api.exportPdf(Report.heatSheetHtml({ title: `${setup.name}: heat list`, subtitle: `${r.track.name} · ${heat.count} ${heat.count === 1 ? 'heat' : 'heats'}${finalsOn ? finalsNote : ''}`, list: heatListOf(), lanes, points: byPts, time: byTm }), `${setup.name} heat list.pdf`.replace(/[\\/:*?"<>|]/g, '-'))
      .then(res => say(res.saved ? 'Saved to ' + res.path : 'Export cancelled.'), x => say('Could not make the PDF: ' + x.message));
  };

  // ---- crossings, simulated cars ----
  // held: the crossing of a Trackmate sensor, which is also where a car stops for the pits: the tyres that are due are judged when it is known whether the car stays (engine.js, wxFlush)
  const crossCar = (i, at, held) => {
    if (live.phase !== 'running') return;
    const c = eng.cars[i], d = c.driverId, tAt = at !== undefined ? at : now();
    const tokenT = tokens ? eng.elapsed(tAt) : 0, lateLap = !!tokens && tokens.stateOf(c.lane, tokenT) === 'out'; // after the paid time is up a lap is kept, but does not count
    if (tokens && tokens.stateOf(c.lane, tokenT) === 'idle') return; // a lane nobody paid for: the crossing is ignored
    const prevPersonal = d ? Math.min(base.personal.get(d) ?? Infinity, live.bestBy.get(d) ?? Infinity) : Infinity, prevTrack = Math.min(base.track, live.bestAll);
    if (!eng.cross(i, tAt, held ? { holdDue: true } : undefined)) { if (eng.status === 'finished') engineFinished(); else update(); return; } // a car out of fuel may retire or not count
    const time = c.laps[c.laps.length - 1], slow = c.bad[c.bad.length - 1];
    if (tokens) { tokens.lap(c.lane, time, tokenT, slow); if (lateLap) eng.setInvalid(i, c.laps.length - 1, true); persistTokens(false); }
    if (!slow && !lateLap) { // a lap over the track's maximum lap time never counts as a best lap or record
      live.flash.set(c, { at: now(), time, kind: Timing.classifyLap(time, prevPersonal, prevTrack) });
      if (d) live.bestBy.set(d, Math.min(live.bestBy.get(d) ?? Infinity, time)); // (a Guest has no personal best: the Guests are not one driver)
      if (time < live.bestAll) { live.bestAll = time; live.bestAllName = c.driverName; }
    }
    if (eng.status === 'finished') engineFinished(); else update();
  };
  // a car stops over the sensor (crossing counts as a lap), and later drives off
  const blockCar = i => { if (live.phase === 'running') { eng.block(i, now()); if (eng.status === 'finished') engineFinished(); else update(); } };
  const unblockCar = (i, at) => { eng.unblock(i, at !== undefined ? Math.min(at, now()) : now()); update(); }; // (at: when a sensor says the car has gone, which is a little earlier than now)
  // a Trackmate sensor has been covered for the pit hold time: the car stands in the pits. Its crossing was counted when it arrived (at); only the stop starts, counted from then.
  const holdCar = (i, at) => { if (live.phase === 'running') { eng.block(i, Math.min(at, now()), true); if (eng.status === 'finished') engineFinished(); else update(); } };
  const togglePit = lane => { if (tokens) return; /* (a token session has no pit: a crossing that way would count for the engine, not for the stint) */ const i = eng.cars.findIndex(c => c.lane === lane); if (i < 0) return; if (eng.cars[i].blockAt !== null) unblockCar(i); else blockCar(i); };
  const crossLane = lane => { const i = eng.cars.findIndex(c => c.lane === lane); if (i >= 0) crossCar(i); };
  const simulate = i => {
    const pace = (4200 + Math.random() * 1800) / speed;
    // how long a simulated car stays in the pit: until the tank is full (the hold time is real time; the rest follows the test speed)
    const stayOf = () => { const c = eng.cars[i], fx = eng.factorsOf(i); /* (Balance of Power and the weather change the use, the refuelling speed and the tank) */ return pitMs + 100 + (((eng.tankOf(i) - c.fuel) / ((fuelCfg.rate * fx.rate) || 1)) * 1000 + 300) / speed; };
    const leave = () => { live.sim[i] = setTimeout(() => { unblockCar(i); next(); }, stayOf()); };
    const next = () => {
      if (live.phase !== 'running' || eng.cars[i].done) return;
      live.sim[i] = setTimeout(() => {
        const c = eng.cars[i];
        const fx = eng.factorsOf(i);
        if (((fuelCfg.on && c.fuel <= fuelCfg.perLap * fx.use * 1.5) || (eng.weather && eng.wxOf(i).need)) && c.blockAt === null) { // low on fuel, or on the wrong tyres for the weather: the simulated car pits, stays until the tank is full
          blockCar(i); leave();
        } else { crossCar(i); next(); }
      }, pace + (Math.random() - 0.5) * 700 / speed);
    };
    if (eng.cars[i].blockAt !== null) leave(); // (a pause stopped the timer of a car that was in the pit: after the pause it still drives off)
    else next();
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
  const lapRows = (c, date, extra) => c.laps.map((time, n) => ({ time, n })).filter(x => !c.removed.includes(x.n)).map(x => ({ driverId: c.en ? Endurance.driverAtLap(c.en, x.n) : c.driverId, carId: c.carId, ...(c.teamId ? { teamId: c.teamId } : {}), trackId: r.track.id, ...extra, lane: c.lane + 1, lapNumber: x.n + 1, time: x.time, date,
    ...((c.pitLaps || []).includes(x.n) ? { pit: true } : {}),
    ...(c.bad[x.n] ? { noTrackRecord: true, noPersonalBest: true, tooSlow: true } : {}), ...(c.invalid.includes(x.n) ? { noTrackRecord: true, noPersonalBest: true, invalid: true } : {}) }));

  // Endurance Race: who drove what. The stints of a car, as they are saved: [{ driverId, driverName, laps, ms, from, to, by }] (from and to: the race clock in ms), and the drivers with their laps and time.
  const enDist = !!(enduCfg && enduCfg.unit === 'distance');
  const stintsOf = c => (c.en ? Endurance.stints(c.en, 0, c.laps.length).map(s => ({ driverId: s.d, driverName: nameOf('drivers', drivers, s.d) || (c.roster || []).map(m => (m.id === s.d ? m.name : '')).join(''), laps: s.laps, ms: s.ms, from: s.ms0, to: s.ms1, by: s.by, ...(enDist ? { meters: Math.round(s.m * 100) / 100 } : {}) })) : []); // (meters: swaps counted in distance say how far the driver drove in the stint)
  const driversOf = (c, mine) => { // (the laps counted from the lap rows, so a lap that was taken out is not in them)
    const out = []; stintsOf(c).forEach(s => { let d = out.find(x => x.driverId === s.driverId); if (!d) { d = { driverId: s.driverId, driverName: s.driverName, laps: 0, ms: 0, ...(enDist ? { meters: 0 } : {}) }; out.push(d); } d.ms += s.ms; if (enDist) d.meters = Math.round((d.meters + s.meters) * 100) / 100; });
    out.forEach(d => { d.laps = mine.filter(l => l.driverId === d.driverId).length; });
    return out;
  };
  // 1.57.0: the driver of a team who set the best lap of the team (for the fastest lap bonus of a championship, which goes to the team and to him)
  const bestByOf = (laps, best) => {
    if (!(Number(best) > 0)) return '';
    const ok = laps.filter(l => l.driverId && !l.invalid), hit = ok.find(l => l.time === best) || ok.reduce((a, l) => (!a || l.time < a.time ? l : a), null);
    return hit ? hit.driverId : '';
  };

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
    eng = mk(heat.entries()); live.ann = mkAnn(); live.flash = new Map(); live.fpKey = null; live.tpKey = null;
    try { live.ann.observe(eng, { phase: live.phase === 'between' ? 'between' : live.phase, now: now(), heat: heatInfo() }); } catch (x) { /* (the new announcer is told the race is waiting, and what it would say is thrown away: "next final A" was said already, once) */ }
    shareStatic(); if (live.phase === 'between') ui('msg').textContent = betweenMsg(); update();
  };
  const pickAction = (what, lane) => {
    if (!heats || live.phase !== 'between' || !heat.isFinal()) return false;
    if (what === 'lane') { const res = heat.pick(lane); if (res.error) { ui('msg').textContent = res.error; return false; } }
    else if (what === 'random') { if (!heat.randomRest()) return false; }
    else if (what === 'clear') heat.clearPicks();
    else return false;
    live.cpAt = undefined; regrid(); return true; // (the lanes that are chosen are kept at once)
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
  // ---- teams as participants: who drives the next heat (when the Race Director chooses), and a warning when a team has no free driver ----
  const drawTeamPick = () => {
    const box = ui('teampick'), ps = byTeam && (live.phase === 'between' || live.phase === 'ready') ? nextParticipants() : [];
    if (!ps.length || !(setup.teamDriver === 'chosen' || teamNote)) { if (live.tpKey) { box.innerHTML = ''; live.tpKey = null; } box.hidden = true; return; }
    const key = JSON.stringify([heat.idx, ps.map(p => people[p].driverId), teamNote, setup.teamDriver]);
    box.hidden = false;
    if (key === live.tpKey) return; // (only when something changed: a choice never changes under a finger)
    live.tpKey = key;
    const entries = heat.entries(), laneOf = p => { const e = entries.find(x => x.participant === p); return e && !heat.isFinal() ? 'Lane ' + (e.lane + 1) + ' · ' : ''; };
    const taken = (id, p) => ps.some(q => q !== p && people[q].driverId === id);
    box.innerHTML = `<strong>${esc(heat.raceName(heat.idx))}: who drives?</strong>
      ${teamNote ? `<p class="hint2 hpwarn" role="alert">${esc(teamNote)}</p>` : ''}
      ${setup.teamDriver === 'chosen' ? `<p class="hint2">Choose the driver of every team. The one whose turn it is, is suggested. A driver who is in two teams can drive for one of them in a heat.</p>` + ps.map(p => `<p><label>${esc(laneOf(p))}${esc(people[p].teamName || 'Team')} <select data-tp="${p}" aria-label="Driver for ${esc(people[p].teamName || 'team ' + (p + 1))}">${people[p].teamDrivers.map(id => { const d = find(drivers, id); return `<option value="${esc(id)}"${id === people[p].driverId ? ' selected' : ''}${taken(id, p) ? ' disabled' : ''}>${esc(d ? titleOf('drivers', d) : '?')}${taken(id, p) ? ' (drives for another team)' : ''}</option>`; }).join('')}</select></label></p>`).join('') : ''}`;
  };
  ui('teampick').onchange = ev => { const t = ev.target; if (!t || !t.dataset || t.dataset.tp === undefined || !byTeam || !['between', 'ready'].includes(live.phase)) return; const p = Number(t.dataset.tp); if (!people[p] || !(people[p].teamDrivers || []).includes(t.value)) return; teamChosen[p] = t.value; assignDrivers(); regrid(); }; // (only a driver of the team can be chosen)
  function finalize() {
    if (live.phase !== 'review') return;
    ui('review').innerHTML = ''; live.reviewShown = false;
    if (heats) {
      const raceNo = heat.idx + 1, date = new Date().toISOString(), fin = heat.isFinal() ? heat.raceName(heat.idx).slice(6) : '';
      const res = heat.record(eng);
      eng.cars.forEach(c => { const a = live.extraBy.get(c.participant) || { pits: 0, pitTime: 0, has: false, pen: 0 }, p = pitFigures(c); live.extraBy.set(c.participant, { pits: a.pits + p.pits, pitTime: a.pitTime + p.pitTime, has: a.has || hasPits(c), pen: a.pen + (c.points || 0) }); });
      eng.cars.forEach((c, k) => { // the tyre stints of this heat (every heat starts on fresh tyres): added to what the car has from the heats before
        const t = eng.twStintsOf ? eng.twStintsOf(k) : null; if (!t) return;
        const a = live.tyreBy.get(c.participant) || { unit: t.unit, warn: t.warn, crit: t.crit, stints: [], stops: 0, ms: 0, worn: 0, last: '' };
        live.tyreBy.set(c.participant, { ...a, stints: [...a.stints, ...t.stints.map(q => ({ ...q, heat: raceNo, ...(fin ? { final: fin } : {}) }))], stops: a.stops + t.stops, ms: a.ms + t.ms, worn: a.worn + t.worn, last: t.last });
      });
      eng.cars.forEach(c => live.laps.push(...lapRows(c, date, { heat: raceNo, ...(fin ? { final: fin } : {}) })));
      eng.cars.forEach(c => { if (c.en) live.stintBy.set(c.participant, [...(live.stintBy.get(c.participant) || []), ...stintsOf(c).map(q => ({ ...q, heat: raceNo, ...(fin ? { final: fin } : {}) }))]); }); // (the stints of every heat, for the result)
      live.priorBy = new Map(live.bestBy); live.priorAll = live.bestAll; live.priorAllName = live.bestAllName; // (the next race starts from what this one has set)
      res.rows.forEach(x => { // the name of a row: the driver; of a team that races as a team: "Team (driver)", and who drove
        const pp = people[x.participant], car = eng.cars.find(c => c.participant === x.participant), sts = car && car.en ? stintsOf(car) : null; // (an Endurance Race: the drivers swapped, so more than one drove)
        if (pp.asTeam) {
          const drove = sts ? sts.map(q => q.driverId).filter((id, i, a) => id && a.indexOf(id) === i) : [pp.driverId], names = sts ? drove.map(id => nameOf('drivers', drivers, id)).filter(Boolean).join(', ') : pp.driverName;
          teamHist[x.participant].push(...drove); x.driverName = names ? `${pp.teamName} (${names})` : pp.teamName; x.by = names; x.driverId = sts ? '' : pp.driverId; x.teamId = pp.teamId || '';
          if (sts) x.stints = sts.map(q => ({ driverId: q.driverId, driverName: q.driverName, laps: q.laps, ms: q.ms }));
        }
        else { x.driverName = pp.driverName; if (pp.teamId) { x.teamId = pp.teamId; x.teamName = pp.teamName; } }
      });
      Object.keys(teamChosen).forEach(k => { delete teamChosen[k]; }); // (what was chosen was for that heat)
      drawOverall();
      if (heat.hasNext() && !live.stopping) {
        assignDrivers();
        live.phase = 'between'; eng = mk(heat.entries()); startBreak(); // (a final: the grid shows the lanes in the order of the heat result until the drivers have chosen)
        live.ann = mkAnn(); live.flash = new Map(); live.cpAt = undefined; shareStatic(); update(); return; // (cpAt: the heat that is done is kept at once)
      }
    }
    finishAll();
  }

  // "Delete all data": the race ends and nothing is saved (in a heat race that includes the earlier heats)
  function discardAll() {
    if (live.phase !== 'review') return;
    ui('review').innerHTML = ''; live.reviewShown = false; live.laps = [];
    live.phase = 'finished'; clearInterval(live.timers); stopBreak(); live.sim.forEach(clearTimeout); document.removeEventListener('keydown', live.key);
    clearCheckpoint();
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
      const teamStanding = o => { // a team that raced as a team: the team is the row, with the drivers who drove for it
        const mine = laps.filter(l => l.teamId === o.teamId), ids = []; mine.forEach(l => { if (l.driverId && !ids.includes(l.driverId)) ids.push(l.driverId); });
        const sts = live.stintBy.get(o.participant) || []; // (an Endurance Race: how long every driver was at the wheel, and the stints)
        return { asTeam: true, driverId: '', driverName: o.teamName || '', teamId: o.teamId || '', teamName: o.teamName || '', bestBy: bestByOf(mine, o.best), drivers: ids.map(id => ({ driverId: id, driverName: nameOf('drivers', drivers, id), laps: mine.filter(l => l.driverId === id).length, ...(sts.length ? { ms: sts.filter(q => q.driverId === id).reduce((n, q) => n + q.ms, 0), ...(enDist ? { meters: Math.round(sts.filter(q => q.driverId === id).reduce((n, q) => n + (q.meters || 0), 0) * 100) / 100 } : {}) } : {}) })),
          ...(sts.length ? { stints: sts.map(q => ({ driverId: q.driverId, driverName: q.driverName, laps: q.laps, ms: q.ms, heat: q.heat, ...(enDist ? { meters: q.meters } : {}), ...(q.final ? { final: q.final } : {}) })) } : {}) };
      };
      standings = heat.overall().map(o => ({ pos: o.pos, driverId: o.driverId, carId: o.carId, driverName: o.driverName, carName: o.carName, laps: o.laps, points: o.points, best: o.best, total: null,
        ...(o.asTeam ? teamStanding(o) : o.teamId ? { teamId: o.teamId, teamName: o.teamName } : {}),
        ...(o.adjMs ? { adjMs: o.adjMs } : {}), ...(o.adjLaps ? { adjLaps: o.adjLaps } : {}), ...(o.adjPoints ? { adjPoints: o.adjPoints } : {}), ...(o.damageNote ? { damageNote: o.damageNote, damagePoints: o.damagePoints, repairs: o.repairs, repairMs: o.repairMs } : {}), ...(o.failureNote ? { failureNote: o.failureNote, failures: o.failures, failureRepairs: o.failureRepairs, failureMs: o.failureMs } : {}),
        ...(live.extraBy.has(o.participant) && live.extraBy.get(o.participant).has ? { pits: live.extraBy.get(o.participant).pits, pitTime: live.extraBy.get(o.participant).pitTime } : {}),
        ...(penCfg.on && live.extraBy.has(o.participant) ? { penaltyPoints: live.extraBy.get(o.participant).pen } : {}),
        ...(live.tyreBy.has(o.participant) ? { tyres: live.tyreBy.get(o.participant) } : {}),
        ...(scoreCol ? { score: o.score, counted: o.counted, heats: o.heats, dropped: o.dropped.length ? o.dropped : undefined, ...(o.measure ? { measure: o.measure } : {}), ...(o.timeAll !== undefined ? { timeAll: o.timeAll } : {}) } : {}),
        ...(heat.scoring.byTime ? { incomplete: o.incomplete, estimated: o.estimated } : {}),
        ...(finalsOn && o.finalName ? { finalName: o.finalName, ...(o.finalPos !== null ? { finalPos: o.finalPos } : {}) } : {}),
        ...(finalsOn && fmode.finalMode === 'added' && o.finalPos !== null ? { heatScore: o.heatScore, finalPoints: o.finalPoints, finalLaps: o.finalLaps, ...(o.measure ? { finalDist: o.finalDist } : {}), ...(heat.scoring.byTime ? { finalTime: o.finalTime } : {}) } : {}) }));
    } else {
      const teamRow = c => { // an Endurance Race: the team is the row, with the drivers who drove for it (their laps and time at the wheel) and the stints
        const mine = lapRows(c, date, {});
        return { asTeam: true, driverId: '', driverName: c.teamName || '', bestBy: bestByOf(mine, c.best), drivers: driversOf(c, mine), stints: stintsOf(c).map(q => ({ driverId: q.driverId, driverName: q.driverName, laps: q.laps, ms: q.ms, from: q.from, to: q.to, by: q.by, ...(enDist ? { meters: q.meters } : {}) })) };
      };
      standings = eng.standings().map(x => ({ pos: x.pos, driverId: x.car.driverId, carId: x.car.carId, ...(x.car.teamId ? { teamId: x.car.teamId, teamName: x.car.teamName } : {}), driverName: x.car.driverName, carName: x.car.carName, laps: eng.lapsOf(x.car), best: x.car.best, total: x.car.total, retired: (x.car.retired && !x.car.dq) || undefined, ...(x.car.sector ? { sector: x.car.sector, ...(eng.sectorName(x.car.sector) ? { sectorName: eng.sectorName(x.car.sector) } : {}) } : {}),
        ...(x.car.adjMs ? { adjMs: x.car.adjMs } : {}), ...(x.car.adjLaps ? { adjLaps: x.car.adjLaps } : {}), ...(eng.bopNoteOf(eng.cars.indexOf(x.car)) ? { bopNote: eng.bopNoteOf(eng.cars.indexOf(x.car)) } : {}), ...(eng.damageNoteOf(eng.cars.indexOf(x.car)) ? { damageNote: eng.damageNoteOf(eng.cars.indexOf(x.car)), damagePoints: x.car.dmgTotal, repairs: x.car.repairs.filter(q => !q.out).length, repairMs: x.car.repairMs, ...(x.car.dmgOut ? { damageOut: x.car.dmgOut } : {}) } : {}), ...(eng.failureNoteOf && eng.failureNoteOf(eng.cars.indexOf(x.car)) ? { failureNote: eng.failureNoteOf(eng.cars.indexOf(x.car)), failures: x.car.failN, failureRepairs: Failures.repairsOf(x.car), failureMs: x.car.failMs, ...(x.car.failOut ? { failureOut: x.car.failOut } : {}) } : {}), ...(eng.tyreNoteOf(eng.cars.indexOf(x.car)) ? { tyreNote: eng.tyreNoteOf(eng.cars.indexOf(x.car)) } : {}), // (what Balance of Power and the tyres did to the car, in words)
        ...(hasPits(x.car) ? pitFigures(x.car) : {}), ...(penCfg.on ? { penaltyPoints: x.car.points, penalty: eng.penMs(x.car), dq: x.car.dq || undefined } : {}),
        ...(eng.twStintsOf && eng.twStintsOf(eng.cars.indexOf(x.car)) ? { tyres: eng.twStintsOf(eng.cars.indexOf(x.car)) } : {}),
        ...(x.car.en ? { ...teamRow(x.car), ...(x.car.swapLost ? { swapLost: x.car.swapLost } : {}), swaps: x.car.en.swaps } : {}) }));
      laps = [];
      eng.cars.forEach(c => laps.push(...lapRows(c, date, {})));
    }
    if (!laps.length) { clearCheckpoint(); ui('msg').textContent = 'No laps were recorded, so nothing was saved.'; return; }
    const session = { setupName: setup.name, sessionType: setup.ofType || setup.sessionType, trackId: r.track.id, trackName: r.track.name, date, ...(r.champ ? { champ: r.champ } : {}), endedBy: heats ? '' : eng.endedBy, ...(Distance.compareOn(setup) ? { compareBy: 'distance' } : {}), ...(!heats && eng.resumes ? { resumed: eng.resumes } : {}), ...(heats && live.resumeCount ? { resumed: live.resumeCount } : {}), standings, ...(!heats && eng.weatherNote() ? { weatherNote: eng.weatherNote() } : {}) };
    if (heats) { session.resultBy = heat.scoring.byTime ? 'time' : setup.resultBy;
      const wn = heat.results.map(h => h.weatherNote || ''), wxAll = wn.length > 0 && wn[0] !== '' && wn.every(n => n === wn[0]); // the weather of the heats: said once when it was the same in every heat, otherwise with every heat
      if (wxAll) session.weatherNote = wn[0];
      session.heatResults = heat.results.map(h => ({ heat: h.heat, ...(h.final ? { final: h.final } : {}), ...(h.weatherNote && !wxAll ? { weatherNote: h.weatherNote } : {}), rows: h.rows })); if (scoreNote) session.scoring = heat.scoring; if (finalsOn) session.finals = { finals: fmode.finals, finalMode: fmode.finalMode }; }
    try {
      const savedId = await api.saveSession(session, laps); clearCheckpoint(); ui('msg').textContent = `Saved ${laps.length} laps.${r.champ ? ' It is part of ' + (r.champ.name || 'the championship') + '.' : ''} See Database > Results and Records.`;
      if (r.champ && state.settings && state.settings.champTag) { try { state.settings = await api.setSettings({ champTag: null }); } catch (x) { /* the card on Home stays as it was */ } } // (the next race is a normal race until a session is loaded again)
      if (r.champ && typeof champPanelsFor === 'function') { const cp = ui('champpanel'); if (cp) { cp.hidden = false; cp.dataset.cpbox = savedId; champPanelsFor([cp]).catch(() => { cp.hidden = true; }); } } // (1.56.0: the points of this race, to award)
    }
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
    startTimers();
    startSim();
  };
  const startTimers = () => { live.timers = setInterval(() => { eng.tick(now()); if (eng.status === 'finished') engineFinished(); else update(); }, 100 / Math.min(speed, 10)); };
  function startCountdown() {
    if (typeof PerfUI !== 'undefined') PerfUI.raceStarted(); // (the worst figures and the rows of the Performance report start again, 1.60.1)
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
  // The Race Director also wants a new dry tyre on the Slotcar itself (1.31.0): the Database keeps it, and so do the participants of this race (the heats that are still to come start from them)
  const saveTyreChoice = async (carId, code) => {
    if (!carId || !code) return;
    people.forEach(p => { if (p.carId === carId) p.tyre = code; });
    try { await api.update('slotcars', carId, { tyreCompound: code }); } catch { /* the race goes on; the Database keeps what it had */ }
  };
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
    bop(lane, how) { // Balance of Power for the car on this lane (the buttons of the panel, or the Race Director page): hinder, help, off, auto or accept
      if (!eng.bop || !['hinder', 'help', 'off', 'auto', 'accept'].includes(how) || live.phase === 'finished' || live.phase === 'review') return;
      const i = eng.cars.findIndex(c => c.lane === lane);
      if (i >= 0 && eng.bopPress(i, how, now())) update();
    },
    weather(state) { // the Race Director sets the weather (the buttons of the panel, or the Race Director page); only when the weather system leaves it to him
      if (!eng.weather || !eng.wxPlan || !eng.wxPlan.director || !['ready', 'countdown', 'running', 'paused', 'between'].includes(live.phase)) return;
      if (eng.wxSet(state, now(), 'director')) update();
    },
    tyre(lane, code, save) { // the Race Director gives the car on this lane another tyre (the Tyre Change folder, or the Race Director page), in every race and until it is over; save: also on the Slotcar in the Database
      if (!['ready', 'countdown', 'running', 'paused', 'between'].includes(live.phase)) return;
      const i = eng.cars.findIndex(c => c.lane === lane);
      if (i >= 0 && eng.setTyre(i, code, now())) { if (save === true) saveTyreChoice(eng.cars[i].carId, eng.cars[i].tyreOwn); update(); }
    },
    tyreNext(lane, code) { // the Race Director queues a tyre for the next pit stop of the car on this lane ('' = the same tyre); Tyre Wear only
      if (!eng.tyrewear || !['ready', 'countdown', 'running', 'paused', 'between'].includes(live.phase)) return;
      const i = eng.cars.findIndex(c => c.lane === lane);
      if (i >= 0 && eng.twQueue(i, code, now())) update();
    },
    swap(lane, to) { // Endurance Race: the team on this lane has swapped drivers (the Swap done button, or the Race Director page); to: the driver who steps in (only when the setup lets the Race Director choose)
      if (!eng.endurance || !['running', 'paused'].includes(live.phase)) return;
      const i = eng.cars.findIndex(c => c.lane === lane);
      if (i >= 0 && eng.swap(i, now(), typeof to === 'string' && to ? to : undefined)) update();
    },
    damage(lane, n) { // the Race Director gives the car on this lane damage points (an incident of the Damage System, or +1), or takes them back (a negative number)
      if (!eng.damage || !['running', 'paused'].includes(live.phase) || !Number.isInteger(n) || n === 0) return;
      const i = eng.cars.findIndex(c => c.lane === lane);
      if (i >= 0 && eng.addDamage(i, n, now(), 'director')) update();
    },
    failure(lane, k) { // the Race Director gives the car on this lane a failure (k: its number in the list of the Damage System, or -1 for one at random)
      if (!eng.failures || !['running', 'paused'].includes(live.phase)) return;
      const i = eng.cars.findIndex(c => c.lane === lane);
      if (i >= 0 && eng.giveFailure(i, Number.isInteger(k) ? k : -1, now())) update();
    },
    failureClear(lane) { // ... or clears the failure the car has (a car that a failure put out is back in the race)
      if (!eng.failures || !['running', 'paused'].includes(live.phase)) return;
      const i = eng.cars.findIndex(c => c.lane === lane);
      if (i >= 0 && eng.clearFailure(i, now())) update();
    },
    pad(group, lane, amount) { // the adjust pads of the Race Director page (1.12.0): add (a positive amount) or take off (a negative one) penalty points, seconds of race time, laps or championship points for the car on this lane, during the race
      if (tokens || !['running', 'paused'].includes(live.phase) || !Number.isFinite(amount) || !amount) return false;
      const i = eng.cars.findIndex(c => c.lane === lane), car = eng.cars[i]; if (!car) return false;
      if (group === 'points') { if (!eng.penalty.on || !eng.addPoints(i, Math.round(amount), now())) return false; }
      else if (group === 'damage') { if (!eng.damage || !Number.isInteger(amount) || Math.abs(amount) > 20 || !eng.addDamage(i, amount, now(), 'director')) return false; } // (the damage points of the Damage System, as the damage command)
      else if (['time', 'laps', 'champ'].includes(group) && (eng.type === 'race' || eng.type === 'timed')) { // (practice and qualifying are about the best lap: nothing to adjust)
        if (!eng.adjust(i, group === 'time' ? { ms: Math.round(amount * 1000) } : group === 'laps' ? { laps: Math.round(amount) } : { points: amount })) return false;
      } else return false;
      if (eng.status === 'finished') engineFinished(); else update();
      return true;
    },
    swapNext(lane, id) { // Endurance Race: the Race Director chooses who steps in next
      if (!eng.endurance || live.phase === 'finished' || live.phase === 'review') return;
      const i = eng.cars.findIndex(c => c.lane === lane);
      if (i >= 0 && eng.swapNext(i, id)) update();
    },
    yellow() { if (live.restarting) return; eng.setFlag('yellow', now()); syncPhase(); },
    red() {
      if (cancelRestart()) return;
      if (eng.flag === 'red' && live.phase === 'paused' && setup.restartAfterRed !== 'resume' && !tokens) return restartCountdown(); // lifting the red flag: restart with the lights
      eng.setFlag('red', now()); syncPhase();
    }
  };
  live.annBase = annBase; // (for the automated tests)
  live.actions = actions; actions.finalize = () => (tokens ? finalizeTokens() : finalize()); live.reviewCommand = reviewCommand; // (for the automated tests)
  // ---- the Trackmate: sensor hits count laps, the Trackcall button flags the race ----
  // One timing hardware at a time: the one chosen in App Settings, Timing Hardware. Only it counts laps and is told about the lights and the power; the status line names it, red when it is not connected.
  const hwUse = Hardware.timingChosen(state.settings), abLinkNow = () => (typeof ArduinoBox !== 'undefined' ? ArduinoBox.link : null);
  const tmWord = () => HomeStats.timing({ hardware: hwUse, trackmate: Trackmate.link.connected, arduino: !!(abLinkNow() && abLinkNow().connected), virtual: state.settings.abVirtual === true });
  const drawTm = () => { const e = ui('tmstatus'); if (e) { const st = tmWord(); e.textContent = ' · ' + st.text + (hwUse === 'trackmate' && Trackmate.link.connected && Trackmate.link.power !== null ? (Trackmate.link.power ? ', track power on' : ', track power off') : ''); if (e.classList) e.classList.toggle('hwwarn', st.state === 'warn'); } };
  drawTm();
  { const offT = Trackmate.link.onStatus(drawTm), offA = abLinkNow() ? abLinkNow().onStatus(drawTm) : null; live.offTmStatus = () => { offT(); if (offA) offA(); }; }
  // the track power (the Trackmate relay): only when it is connected
  const power = on => { if (hwUse === 'trackmate' && Trackmate.link.connected && typeof tmPower === 'function') tmPower(on); if (live.box) live.box.power(on); };
  const CUTS = { yellowredcut: ['red'], yellowcut: ['yellow'], redcut: ['red'] }; // which flags switch the power off, per Trackcall choice
  if (typeof tmUseLanes === 'function') tmUseLanes(hwUse === 'trackmate' ? lanes : 0);
  if (hwUse === 'trackmate' && Trackmate.link.connected && typeof tmSetup === 'function') tmSetup(lanes).then(() => power(setup.startPower !== 'off')); // the interface is told the lanes; the track starts with or without power
  let callAt = 0; // when the last Trackcall press was
  const trackcall = () => {
    const mode = setup.trackcall || 'yellowred', t = now();
    if (mode === 'power') { const l = hwUse === 'arduino' ? abLinkNow() : Trackmate.link; return power(!!l && l.power === false); } // switches the relay of the timing hardware in use, in any phase of the race screen
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
  if (hwUse === 'trackmate') Trackmate.link.setHold(pitMs); // how long a car must stand on the sensor to be in the pits: the pit hold time of the race setup
  live.offTm = hwUse !== 'trackmate' ? null : Trackmate.link.on(e => {
    if (e.type === 'hit') { const lane = Trackmate.laneMap(state.settings.tmLaneMap)[e.lane]; const i = eng.cars.findIndex(c => c.lane === lane); if (i >= 0) crossCar(i, e.at, true); } // the sensor's lane can be changed in Timing hardware
    else if (e.type === 'block' || e.type === 'free') { // a car that stands on the sensor is in the pits (a token session has no pit)
      const lane = Trackmate.laneMap(state.settings.tmLaneMap)[e.lane], i = eng.cars.findIndex(c => c.lane === lane);
      if (i >= 0 && !tokens) { if (e.type === 'block') holdCar(i, e.at); else unblockCar(i, e.at); }
    }
    else if (e.type === 'call') { if (Number.isInteger(e.lane)) actions.call(e.lane); else trackcall(); } // a call button of one lane, or the one Trackcall button
  });
  // ---- the SlotForge box (Arduino): laps, pit sensors, buttons and the speed trap come in; the start lights, the power and the buzzer follow the race ----
  if (hwUse === 'arduino' && typeof ArduinoRace !== 'undefined' && ArduinoBox.link.connected) {
    live.box = ArduinoRace.bind({ link: ArduinoBox.link, cars: () => eng.cars, crossCar, blockCar, unblockCar, actions, trackcall, phase: () => live.phase, lights: () => live.lights, flag: () => eng.flag,
      setup: { ...setup, boxBeeps: setup.boxBeeps !== 'no', boxLaneLights: setup.boxLaneLights === 'yes' }, // (the race setup form has Yes/No choices, no tick boxes: the box wants true/false)
      onJump: (lane, at) => { /* a crossing during the countdown: the jump-start handling is not built yet */ },
      onTrap: (lane, ms) => { const i = eng.cars.findIndex(c => c.lane === lane); if (i >= 0) eng.cars[i].trapMs = ms; } });
  }
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
    else if (cmd.type === 'bop') actions.bop(Number(cmd.lane), cmd.how);
    else if (cmd.type === 'weather') actions.weather(cmd.state);
    else if (cmd.type === 'tyre') actions.tyre(Number(cmd.lane), cmd.tyre, cmd.save === true);
    else if (cmd.type === 'tyrenext') actions.tyreNext(Number(cmd.lane), cmd.tyre);
    else if (cmd.type === 'swap') actions.swap(Number(cmd.lane), cmd.to);
    else if (cmd.type === 'swapnext') actions.swapNext(Number(cmd.lane), cmd.id);
    else if (cmd.type === 'damage') actions.damage(Number(cmd.lane), Number(cmd.n));
    else if (cmd.type === 'failure') actions.failure(Number(cmd.lane), Number(cmd.k));
    else if (cmd.type === 'failureclear') actions.failureClear(Number(cmd.lane));
    else if (cmd.type === 'pad') actions.pad(cmd.group, Number(cmd.lane), Number(cmd.amount));
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
    if (ev.key === ' ') { ev.preventDefault(); if (ev.repeat || ev.ctrlKey || ev.metaKey || ev.altKey) return; if (live.phase === 'ready' || live.phase === 'between') actions.start(); else actions.pause(); return; }
    if (ev.repeat || ev.metaKey || ev.altKey) return; // a key that is held down is one press; Alt and Cmd belong to the menu and the system
    const code = String(ev.code || ''), digit = /^(?:Digit|Numpad)([1-8])$/.exec(code), main = /^Digit([1-8])$/.exec(code);
    if (ev.ctrlKey) { // Ctrl + number is a call; the other Ctrl keys (Ctrl+R reload, Ctrl+S ...) are not ours
      if (main) { ev.preventDefault(); const l = Number(main[1]) - 1; if (l < lanes) actions.call(l); }
      return;
    }
    const k = String(ev.key).toLowerCase();
    if (k === 'y') return actions.yellow();
    if (k === 'r') return actions.red();
    if (k === 's') return actions.stop(); // still asks "Stop the race now?"
    if (ev.shiftKey && main) { const l = Number(main[1]) - 1; if (l < lanes) togglePit(l); return; }
    // the lane from the key itself when the browser says which one it is (a keyboard whose number row types other characters, as on AZERTY, still works), else from the character
    const lane = digit ? Number(digit[1]) - 1 : Number(ev.key) - 1;
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
  live.shown = () => { live.nodes.forEach(n => { n.last = null; }); syncPerfLine(); update(); }; // the Race tab is shown again: everything is drawn once more (a leaderboard fits its text to the size it has now)
  // leaving the race screen (before the start, or after the end): the keys, the Trackmate and the Race Director buttons stop working on the other pages
  live.leave = () => { if (live.fsView) live.fsView.close(); document.removeEventListener('keydown', live.fsKey); if (live.calling) { live.callRun = -1; live.calling = false; clearTimeout(live.callTimer); Sound.stop(); } document.removeEventListener('keydown', live.key); if (typeof tmUseLanes === 'function') tmUseLanes(0); ['offTm', 'offTmStatus', 'offCmd', 'offResync'].forEach(k => { if (live[k]) { live[k](); live[k] = null; } }); if (live.box) { live.box.off(); live.box = null; } clearTimeout(live.shareTimer); live.shareTimer = null; if (live.flushTokens) live.flushTokens(); clearTimeout(live.tkTimer); live.tkTimer = null; };

  // ---- Time Token Session: the lane controls, saving every stint, keeping the session across a restart ----
  const raceT = () => eng.elapsed(now()); // the race clock: the token clocks run on it, so a pause stops them
  const carIndex = lane => eng.cars.findIndex(c => c.lane === lane);
  const STINT_END = { expired: 'The time ran out', cleared: 'The lane was switched off', driver: 'The driver changed', session: 'The session ended' };
  live.tkChain = Promise.resolve(); live.tkTotal = 0;
  // When the Race Director presses Finalize, every stint is saved as a result of its own (with its laps). One at a time, in order. A stint without any laps is not saved. A stint that could not be saved is offered again.
  // (Until then the stints are held, also across a restart, so they can be checked and corrected in the review.)
  const saveStints = home => { // (home: the track the stints were driven on, when that is not the track of this race)
    live.tkChain = live.tkChain.then(async () => {
      const where = home || r.track;
      const list = tokens.takeClosed(), failed = [];
      for (const st of list) {
        if (!st.laps.length) continue;
        const date = st.startAt || new Date().toISOString(), counted = st.laps.filter(l => !l.late), who = st.who;
        const rows = st.laps.map((l, n) => ({ l, n })).filter(x => !x.l.removed).map(({ l, n }) => ({ driverId: who.driverId || '', carId: who.carId || '', trackId: where.id, token: true, stint: st.id, lane: st.lane + 1, lapNumber: n + 1, time: l.t, date, // (a lap taken out in the review is not saved)
          ...(l.bad ? { noTrackRecord: true, noPersonalBest: true, tooSlow: true } : {}), ...(l.late || l.invalid ? { noTrackRecord: true, noPersonalBest: true, invalid: true } : {}), ...(l.late ? { late: true } : {}) }));
        if (!rows.length) continue;
        const session = { setupName: setup.name, sessionType: 'tokens', trackId: where.id, trackName: where.name, date, endedBy: STINT_END[st.closedBy] || '',
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
    if (kept && kept.data && kept.trackId && kept.trackId !== r.track.id && tokens.restore(kept.data, 0)) {
      // the session that was not ended was driven on another track: it is not carried onto this one (its laps would count for the wrong track records), what it recorded is saved with the track it was driven on
      tokens.closeAll(0); eng.cars.forEach(c => tokens.assign(c.lane, { driverId: c.driverId || '', driverName: c.driverName || 'Guest', carId: c.carId || '', carName: c.carName || '' }));
      Promise.resolve(api.list ? api.list('tracks') : []).catch(() => []).then(list => { const t = (list || []).find(x => x.id === kept.trackId); return t ? saveStints({ id: t.id, name: titleOf('tracks', t) }) : tokens.takeClosed(); /* (that track is gone, and its sessions with it) */ }).then(() => { if (live.alive) ui('msg').textContent = 'A Time Token Session of this setup from another track was not ended: what it recorded is saved with that track. This is a new session.'; persistTokens(true); });
    } else if (kept && kept.data && tokens.restore(kept.data, 0)) {
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
  if (bopCfg) live.bopPanel = BopPanel.build(ui('boppanel'), { eng: () => eng, lanes: Array.from({ length: lanes }, (_, l) => l), phase: () => live.phase, send: (lane, how) => actions.bop(lane, how) }); // the Balance of Power lane controls
  if (setup.endurance) live.enPanel = EndurancePanel.build(ui('enpanel'), { eng: () => eng, lanes: Array.from({ length: lanes }, (_, l) => l), phase: () => live.phase, now, send: (lane, what, id) => (what === 'swap' ? actions.swap(lane, id) : actions.swapNext(lane, id)) }); // the swaps of an Endurance Race
  if (eng.damage) live.dmPanel = DamagePanel.build(ui('dmpanel'), { eng: () => eng, lanes: Array.from({ length: lanes }, (_, l) => l), incidents: eng.damage.incidents, phase: () => live.phase, now, send: (lane, n) => actions.damage(lane, n) }); // the damage of the cars (the Damage System)
  if (eng.failures) live.flPanel = FailurePanel.build(ui('flpanel'), { eng: () => eng, lanes: Array.from({ length: lanes }, (_, l) => l), failures: eng.failures.list.map((f, k) => ({ k, name: f.name, chance: f.chance })), phase: () => live.phase, now, send: (lane, k) => actions.failure(lane, k), clear: lane => actions.failureClear(lane) }); // Car Failures: give a car a failure or clear it (1.44.0)
  if (!tokens) live.adjPanel = AdjustPanel.build(ui('adjpanel'), { id: 'radj', find: ui, eng: () => eng, lanes: Array.from({ length: lanes }, (_, l) => l), phase: () => live.phase, now, settings: () => AdjustPad.forSetup(state.settings, setup), // (the values of this race setup, else the ones from App Settings)
    penalty: () => !!(eng.penalty && eng.penalty.on), damage: () => !!eng.damage, champ: () => !!(heats && setup.resultBy === 'points'), send: (group, lane, amount) => actions.pad(group, lane, amount), refresh: () => update(), raceKey: () => eng }); // the Adjust pads: the same as on the Race Director page, but they adjust the race directly
  if (eng.weather) live.wxPanel = WeatherPanel.build(ui('wxpanel'), { eng: () => eng, lanes: Array.from({ length: lanes }, (_, l) => l), phase: () => live.phase, now, send: state => actions.weather(state) }); // the weather controls
  if (!tokenSession) live.tyPanel = TyrePanel.build(ui('typanel'), { eng: () => eng, lanes: Array.from({ length: lanes }, (_, l) => l), phase: () => live.phase, now, wear: !!eng.tyrewear, sets: !!(eng.tyrewear && eng.tyrewear.sets && eng.tyrewear.sets.mode !== 'none'), weather: !!eng.weather, setTyre: (lane, code, save) => actions.tyre(lane, code, save), queue: (lane, code) => actions.tyreNext(lane, code) }); // Tyre Change: the tyre of each car (every race)
  if (eng.pushSave) live.psPanel = PushSavePanel.build(ui('pspanel'), { eng: () => eng, lanes: Array.from({ length: lanes }, (_, l) => l), phase: () => live.phase });
  if (penCfg.on) live.penPanel = PenaltyPanel.build(ui('penpanel'), { eng: () => eng, entries: () => eng.cars.map(c => ({ lane: c.lane, driverName: c.driverName })).sort((a, b) => a.lane - b.lane), cfg: () => penCfg, phase: () => live.phase,
    send: cmd => (cmd.type === 'penalty' ? actions.penalty(cmd.lane, cmd.n) : actions.assign(cmd.lane, cmd.typeIndex)) }); // the Penalties folder: the same table as on the Race Director page, but the penalties are given right here
  DirFolder.bind(host); // (a folder that is closed stays closed, also when the next race is shown)

  // ---- a race that was interrupted can be carried on (1.9.0) ----
  // While a single race runs (or waits in the review), a snapshot of it goes to a file every few seconds and whenever something changes (a lap, a swap, a flag, a pause). After a crash or a power cut the Home tab
  // offers to carry on: the race comes back paused, with its clock where it was in the last snapshot, and starts again with Space. The laps that were driven in between are lost (the review can add them),
  // and the lap that was being driven is left out of the records. The file goes when the result is saved or deleted.
  function lean(o) { return Object.fromEntries(Object.entries(o || {}).filter(([, v]) => !(typeof v === 'string' && v.length > 2000))); } // (a picture does not need to be written again every few seconds)
  // A heat race (1.24.0) keeps the same: the heats that are done (their results and laps), the finals and the lanes chosen for them, and the race that is racing now (or none while it waits between two races)
  const heatState = () => ({ state: heat.snapshot(), phase: live.phase, laps: live.laps, extraBy: [...live.extraBy], tyreBy: [...live.tyreBy], stintBy: [...live.stintBy], priorBy: [...live.priorBy], priorAll: Number.isFinite(live.priorAll) ? live.priorAll : null, priorAllName: live.priorAllName, resumes: live.resumeCount || 0,
    ...(byTeam ? { drivers: people.map(p => p.driverId) } : {}), teamHist: teamHist.map(l => l.slice()) });
  function checkpoint() {
    const waiting = heats && !!live && live.phase === 'between'; // (a heat race also waits between two races)
    if (!api.saveResume || tokens || !live || !live.alive || live.cpOff || !(waiting || ['running', 'paused', 'review'].includes(live.phase))) return;
    const t = now(), sig = [live.phase, eng.status, eng.flag, heats ? heat.idx + ':' + Object.values(heat.picks).reduce((n, x) => n + x.length, 0) : '', eng.cars.reduce((n, c) => n + c.laps.length + c.points + (c.en ? c.en.swaps : 0) + (c.blockAt !== null ? 1 : 0), 0)].join('|');
    if (live.cpAt !== undefined && (t - live.cpAt < 2000 / speed || (sig === live.cpSig && t - live.cpAt < 5000 / speed))) return;
    live.cpAt = t; live.cpSig = sig;
    const where = !heats ? '' : waiting ? `between ${lc(heat.raceName(heat.idx - 1))} and ${lc(heat.raceName(heat.idx))}` : `${Endurance.clock(eng.elapsed(t))} into ${lc(heat.raceName(heat.idx))}${heat.idx < heat.count ? ' of ' + heat.count : ''}`; // (for the note on the Home tab)
    try { Promise.resolve(api.saveResume({ v: 1, savedAt: new Date().toISOString(), name: setup.name, kind: SESSION_LABEL[setup.ofType || setup.sessionType] || '', trackName: r.track.name, wxSeed, wxHeat: wxLast, elapsed: waiting ? 0 : eng.elapsed(t), phase: live.phase,
      ...(heats ? { where, heat: heatState() } : {}),
      race: { setup: lean(r.setup), track: lean(r.track), rows: r.rows, ...(r.champ ? { champ: r.champ } : {}), ...(byTeam ? { byTeam: true } : {}), ...(heats ? { schedule: heat.schedule, ...(r.labels ? { labels: r.labels } : {}) } : {}) }, eng: waiting ? null : eng.snapshot(t) })).catch(() => {}); } catch { /* a snapshot that can not be kept must never stop the race */ }
  }
  function clearCheckpoint() { live.cpOff = true; if (api.clearResume && !tokens) Promise.resolve(api.clearResume()).catch(() => {}); }
  // A heat race that comes back: the heats that are done, the finals, the laps and figures of the finished races, and the drivers of the teams are put back, and the race is made again for the race that was racing (or is next).
  // Says false when there is nothing more to restore (the race waits between two races, or it does not fit); true when the race that was racing is to be put back.
  function resumeHeats(snap) {
    const hs = snap.heat, mapOf = x => new Map(Array.isArray(x) ? x.filter(e => Array.isArray(e) && e.length === 2) : []);
    if (!hs || typeof hs !== 'object' || !heat.restore(hs.state)) { live.cpOff = true; ui('msg').textContent = 'The saved race does not fit this race setup any more, so it could not be carried on.'; return false; }
    if (byTeam && Array.isArray(hs.drivers)) hs.drivers.forEach((id, i) => { if (people[i] && typeof id === 'string') setDriver(i, id); });
    if (Array.isArray(hs.teamHist)) hs.teamHist.forEach((l, i) => { if (teamHist[i] && Array.isArray(l)) { teamHist[i].length = 0; teamHist[i].push(...l.filter(x => typeof x === 'string')); } });
    live.laps = Array.isArray(hs.laps) ? hs.laps : []; live.extraBy = mapOf(hs.extraBy); live.tyreBy = mapOf(hs.tyreBy); live.stintBy = mapOf(hs.stintBy); live.priorBy = mapOf(hs.priorBy);
    live.priorAll = typeof hs.priorAll === 'number' && Number.isFinite(hs.priorAll) ? hs.priorAll : Infinity; live.priorAllName = String(hs.priorAllName || '');
    wxForce = snap.wxHeat !== undefined && snap.wxHeat !== null && Number.isFinite(Number(snap.wxHeat)) ? Number(snap.wxHeat) : null; // (the weather of the race that was interrupted goes on)
    eng = mk(heat.entries()); live.ann = mkAnn(); live.flash = new Map(); live.fpKey = null; live.tpKey = null; live.breakLeft = 0;
    live.resumeCount = (Number(hs.resumes) || 0) + (snap.eng ? 1 : 0); // (how many times a race that was racing came back: the result says so; coming back between two races loses no lap)
    if (snap.stopNow) live.stopping = true; // ("Save what was recorded": the race ends with the race that was racing, it does not go on with the next one)
    if (snap.eng) return true;
    live.phase = 'between'; recomputeBests();
    if (snap.stopNow) { finishAll(); return false; }
    ui('msg').textContent = 'The race was interrupted and is back, between two races. ' + betweenMsg();
    return false;
  }
  function resumeRace(snap) {
    if (heats && !resumeHeats(snap)) return;
    if (!eng.restore(snap.eng)) { live.cpOff = true; ui('msg').textContent = 'The saved race does not fit this race setup any more, so it could not be carried on.'; return; }
    recomputeBests(); live.cpAt = now();
    ui('sim').disabled = true;
    if (snap.stopNow || eng.status === 'finished') {
      live.phase = 'paused';
      if (eng.status !== 'finished') eng.stop(eng.pausedAt);
      engineFinished();
      ui('msg').textContent = 'The race was interrupted. Check what was recorded below, then press Finalize.';
      return;
    }
    live.phase = 'paused'; startTimers();
    ui('msg').textContent = 'The race was interrupted and is back, paused where it was at the last saving point. Check the laps, then press Space (Pause / Resume) to carry on.';
  }
  if (r.resume && !tokens) resumeRace(r.resume);
  shareStatic(); update(); drawOverall();
}
