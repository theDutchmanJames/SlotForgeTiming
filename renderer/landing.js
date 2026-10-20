// Home / landing page: pick a race setup, assign drivers and cars to its lanes, start the race.
const optionsOf = (entity, list, chosen, blank = '(choose)') =>
  `<option value="">${esc(blank)}</option>` + list.map(i => `<option value="${esc(i.id)}"${i.id === chosen ? ' selected' : ''}>${esc(titleOf(entity, i))}</option>`).join('');

// 1.17.0: the cards on the right of the Home tab need every saved lap. The laps are fetched once and kept while you stay on the Home tab (a change on Home does not fetch them again);
// app.js forgets them (resetHome) whenever another tab was shown, because a race may have been saved or a record removed since. homeRun numbers the pictures, so a late answer never lands in a newer one.
let homeLaps = null, homeRun = 0, homeOffTm = null, homeOffAb = null, homeDraw = 0; // (homeDraw numbers the drawings of Home: the one that is slow does not paint over another tab, or over a newer Home)
// 1.26.0: a line of text or a number in Customize is saved when you leave the field. Home is drawn again a moment later (HOME_SOFT_MS), so that a click or a Tab that comes next
// is not lost to a page that changes under it, and the control that has the cursor then keeps it. While you are typing in a field (an input without its change yet) nothing is drawn.
let HOME_SOFT_MS = 400;
const homeFocusId = t => (t && t.dataset && t.dataset.hopt && (t.type === 'text' || t.type === 'number' || t.type === 'textarea') ? t.id : ''); // (such a field of Customize: its id, else '')
const homeFieldId = t => (t && typeof t.id === 'string' && t.id.startsWith('hg-') ? t.id : ''); // (any control of the settings in Customize: the one that keeps the cursor when Home is drawn again)
function homeSoftDraw() { // (the moment after a change in such a field)
  const c = state.homeCustom;
  if (state.tab === 'home' && !(c && c.typing)) renderHome();
}
function resetHome() { homeLaps = null; }

// Starting a race while the timing hardware that was chosen is not connected: the person is told and asked (OK: start anyway with the keys or simulated cars, Cancel: go and connect it). true = go on.
function timingReady() {
  const hw = Hardware.timingChosen(state.settings);
  if (hw === 'none') return true;
  const on = hw === 'trackmate' ? typeof Trackmate !== 'undefined' && !!Trackmate.link.connected : typeof ArduinoBox !== 'undefined' && !!ArduinoBox.link.connected;
  if (on) return true;
  const name = hw === 'trackmate' ? 'The Trackmate Interface' : state.settings.abVirtual === true ? 'The virtual Arduino box' : 'The Arduino box';
  return typeof confirm !== 'function' || confirm(`${name} is the timing hardware you chose, and it is not connected.\n\nOK: start anyway (laps can still be counted with the keys or simulated cars).\nCancel: do not start, so you can connect it (App Settings, Timing Hardware).`);
}
async function renderHome() {
  const draw = ++homeDraw;
  if (state.homeCustom) clearTimeout(state.homeCustom.timer); // (a drawing that was waiting is this one)
  const [drivers, cars, tracks, setups, sessions, rotations, teams, layouts, audiosets, imagesets, champRaw] = await Promise.all(['drivers', 'slotcars', 'tracks', 'racesetups', 'sessions', 'rotationsetups', 'teams', 'layouts', 'audiosets', 'imagesets', 'championships'].map(e => api.list(e)));
  const champs = (Array.isArray(champRaw) ? champRaw : []).map(c => Champ.clean(c, true)); // (1.55.0: the championships; 1.56.1: one of them is chosen in the Start a race card, and only then its card shows, inside Start a race)
  const imageSets = Array.isArray(imagesets) ? imagesets : []; // (1.26.0: the picture sets of Customization > Image Settings, for the Weather and Tyres Available cards)
  const saved = state.settings;
  const grid = HomeGrid.gridOf(saved), hc = state.homeCustom = state.homeCustom || { open: false, sel: 0 }; // (1.25.0: the cards are a grid; hc is the Customize panel: open or not, and the card whose settings show)
  hc.sel = Math.min(Math.max(Math.floor(Number(hc.sel)) || 0, 0), grid.boards.length - 1);
  if (draw !== homeDraw || state.tab !== 'home') return; // (another tab, or another drawing of Home, was asked for while the lists came in)
  const resume = api.getResume && !(typeof raceActive === 'function' && raceActive()) ? await api.getResume().catch(() => null) : null; // (1.9.0: a race that was interrupted by a crash or a power cut, kept in a file)
  if (draw !== homeDraw || state.tab !== 'home') return;
  const setupId = setups.some(x => x.id === saved.lastSetupId) ? saved.lastSetupId : (setups[0]?.id || '');
  const rawSetup = setups.find(x => x.id === setupId);
  const setup = Endurance.effective(rawSetup); // (1.9.0: an Endurance Race is a race, a timed race or heats, with the rules of the swaps in setup.endurance)
  const ch = Champ.active(saved.champTag, champs, setups, tracks, setupId); // 1.55.0: a session of a championship that was loaded with its card: the race counts for it. It is the track of the round, else that of the race setup
  const track = setup && tracks.find(t => t.id === (ch && ch.track ? ch.track : setup.track));
  const layout = (setup && (layouts || []).find(x => x.id === setup.layout)) || null, laneHue = i => HomeStats.laneColor(layout, i); // (the colour of a lane on the race screen, else one of eight)
  const heats = setup?.sessionType === 'heats', tokens = setup?.sessionType === 'tokens';
  const endu = !!(setup && setup.endurance), enduSingle = endu && !heats; // (an Endurance Race in one go: every lane is a team, with the driver who starts) // (a Time Token Session: the driver and car of a lane are optional, a lane without a driver is a Guest)
  const lanes = Math.max(0, Math.floor(Number(track?.lanes)) || 0);
  const known = (list, id) => list.some(x => x.id === id) ? id : '';

  // saved assignments for this setup, cleaned of anything that has since been deleted
  let rows = ((saved.assignments || {})[setupId] || []).map(r => ({ driverId: known(drivers, r.driverId), carId: known(cars, r.carId), ...(known(teams, r.teamId) ? { teamId: r.teamId } : {}), ...(r.absent === true ? { absent: true } : {}) }));
  // a rotation setup (1.6.0) says how many participants there are: the rows follow it (rows that are too many stay, so that you choose which one goes)
  const rotRec = heats && setup.rotation ? rotations.find(x => x.id === setup.rotation) : null, rot = rotRec ? Rot.clean(rotRec) : null;
  // 1.8.0: the participants of a heat race can be teams (a team and a car; the drivers of the team take turns in the heats). The rotation says so, or the race setup when there is no rotation.
  const byTeam = heats && (rot ? Rot.isTeams(rot) : setup.participants === 'teams');
  const withTeam = byTeam || enduSingle; // (the team is the participant: it has to be chosen)
  if (!withTeam) rows.forEach(r => { delete r.teamId; }); // (1.10.1: a session without teams has no Team choice on Home, so a team that was chosen for it earlier is not used)
  const teamOf = id => teams.find(t => t.id === id) || null, membersOf = t => (t && Array.isArray(t.drivers) ? t.drivers : []).map(id => drivers.find(d => d.id === id)).filter(Boolean);
  const wanted = rot ? rot.participants : heats ? Math.max(rows.length, 2) : lanes;
  while (rows.length < wanted) rows.push({ driverId: '', carId: '' });
  rows = rows.slice(0, heats ? rows.length : lanes);

  // the winner of the latest qualifying on this track picks their lane first
  let qual = null;
  if (setup && track && (setup.sessionType === 'race' || setup.sessionType === 'timed')) {
    const q = sessions.filter(x => x.sessionType === 'qualifying' && x.trackId === track.id).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    const w = q && q.standings && q.standings[0];
    const cleared = ((saved.qualCleared || {})[track.id]) === (q && q.id); // the Race Director cleared this one; a newer qualifying brings the winner back
    if (w && !cleared && drivers.some(d => d.id === w.driverId)) qual = { id: q.id, driverId: w.driverId, name: w.driverName };
  }
  const winRow = qual ? rows.findIndex(r => r.driverId === qual.driverId) : -1;

  // a rotation: who is not here today, and what stops it from being raced here (the number of participants, the lanes of the track)
  const absent = rot ? rows.map((r, i) => (r.absent ? i : -1)).filter(i => i >= 0) : [], here = rot ? rows.filter(r => !r.absent) : rows;
  const rotProblems = rot ? Rot.problems(rot, { rows: rows.length, trackLanes: lanes, here: here.length }) : [];

  // what is still missing before the race can start
  const raceOn = typeof raceActive === 'function' && raceActive(); // a race is running (on the Race tab): another one can not be started
  const issues = [], rowMsgs = {}; // (1.58.0: what a row still needs is said in that row; it is in the list of issues too, so that Start stays off, but the list under the rows does not say it again)
  const rowMsg = (i, t) => { issues.push(t); rowMsgs[i] = t; };
  if (setup) {
    if (!track) issues.push('This race setup has no track. Choose one in Race Setup.');
    else if (!lanes) issues.push('The track has no number of lanes. Add it in the Database.');
    const distProblem = Distance.problem(setup, track, lanes); if (distProblem) issues.push(distProblem); // (1.35.0: a race by distance needs the length of the lanes)
    const swapProblem = Distance.swapProblem(setup, track, lanes); if (swapProblem && !/no length/.test(distProblem)) issues.push(swapProblem); // (1.35.1: so do driver swaps counted in distance)
    const label = i => heats ? (byTeam ? 'Team ' : 'Participant ') + (i + 1) : 'Lane ' + (i + 1);
    rotProblems.forEach(t => issues.push(t));
    if (byTeam) rows.forEach((r, i) => {
      if (rot && r.absent) return;
      if (!r.teamId || !r.carId) rowMsg(i, label(i) + ' needs a team and a car.');
      else if (!membersOf(teamOf(r.teamId)).length) issues.push(`The team ${titleOf('teams', teamOf(r.teamId))} has no drivers. Add them in Database > Teams.`);
      else if (endu && membersOf(teamOf(r.teamId)).length < 2) issues.push(`The team ${titleOf('teams', teamOf(r.teamId))} has one driver only: an Endurance Race needs a team of two drivers or more. Add drivers in Database > Teams.`);
    });
    else if (enduSingle) {
      rows.forEach((r, i) => {
        if (!r.teamId || !r.carId) rowMsg(i, label(i) + ' needs a team and a car.');
        else if (membersOf(teamOf(r.teamId)).length < 2) issues.push(`The team ${titleOf('teams', teamOf(r.teamId))} has ${membersOf(teamOf(r.teamId)).length ? 'one driver only' : 'no drivers'}: an Endurance Race needs a team of two drivers or more. Add drivers in Database > Teams.`);
      });
      const st = rows.map(r => r.driverId).filter(Boolean); if (st.length !== new Set(st).size) issues.push('A driver starts for two teams. Choose another starting driver.');
    }
    else if (!tokens) rows.forEach((r, i) => { if (!(rot && r.absent) && (!r.driverId || !r.carId)) rowMsg(i, label(i) + ' needs a driver and a car.'); });
    const dup = key => { const ids = here.map(r => r[key]).filter(Boolean); return ids.length !== new Set(ids).size; };
    if (withTeam) { if (dup('teamId')) issues.push('A team is used more than once.'); }
    else if (dup('driverId')) issues.push('A driver is used more than once.');
    if (dup('carId')) issues.push('A car is used more than once.');
  }

  // a heat-based race: the plan of the heats, made before the race so that it can be looked at (and shuffled again). The seed makes the shuffle repeatable: the plan shown here is the plan that is raced.
  let heatPlan = null;
  if (heats && track && lanes && rot && !rotProblems.length) { // a rotation: the heats are the ones you drew; the participants who are not here are left out
    const sf = Rot.scheduleFor(rot, absent), count = sf.keep.length, total = rot.heats.filter(h => h.places.length).length;
    const key = Heats.planKey({ count, lanes, setup, seed: 0, ranks: null, extra: Rot.signature(rot, absent) }), edit = (saved.heatEdits || {})[setupId];
    const edited = !!(edit && edit.key === key && Heats.fits(edit.schedule, count, lanes)); // a plan you changed by hand is kept as long as the rotation and who is here stay the same
    const schedule = edited ? edit.schedule : sf.schedule, notes = [`Rotation setup "${rot.name}": ${Rot.describe(rot)}.`];
    const left = total - sf.schedule.length, lone = sf.schedule.map((h, i) => (h.length === 1 ? i + 1 : 0)).filter(Boolean);
    if (left > 0) notes.push(`${left === 1 ? 'One heat is' : left + ' heats are'} left out, because nobody who is here races in ${left === 1 ? 'it' : 'them'}.`);
    if (lone.length) notes.push(`${lone.length === 1 ? 'Heat ' : 'Heats '}${lone.join(', ')} ${lone.length === 1 ? 'has' : 'have'} one car only, because the others are not here.`);
    if (edited) notes.push('You changed this plan by hand. "Reset my changes" brings back the rotation.');
    const names = sf.keep.map(p => { const d = byTeam ? teamOf(rows[p].teamId) : drivers.find(x => x.id === rows[p].driverId); return d ? titleOf(byTeam ? 'teams' : 'drivers', d) : Rot.nameOf(rot, p); });
    heatPlan = { seed: 0, key, edited, schedule, names, notes, count, labels: sf.labels, rotation: true, stats: Heats.stats(schedule, count, lanes) };
  } else if (heats && track && lanes && !rot && rows.length >= 2) {
    const seeds = { ...(saved.heatSeeds || {}) };
    let seed = seeds[setupId];
    if (!Number.isInteger(seed) || seed < 1) { seed = Heats.newSeed(); seeds[setupId] = seed; saved.heatSeeds = seeds; api.setSettings({ heatSeeds: seeds }).then(s => { state.settings = s; }); } // (kept, so the plan is the same next time as well)
    // the latest qualifying on this track, when the setup wants the heats seeded by it (only the plans that choose who races together)
    let ranks = null; const notes = [], ho = Heats.optionsOf(setup);
    if (ho.seeding !== 'random' && (ho.plan === 'manual' || ho.plan === 'perdriver') && !byTeam) {
      const q = sessions.filter(x => x.sessionType === 'qualifying' && x.trackId === track.id && x.standings && x.standings.length).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
      if (!q) notes.push('There is no qualifying on this track yet, so the drivers are shuffled.');
      else {
        ranks = rows.map(r => { const i = r.driverId ? q.standings.findIndex(x => x.driverId === r.driverId) : -1; return i < 0 ? null : i; });
        if (ranks.every(x => x === null)) { ranks = null; notes.push('None of these drivers took part in the latest qualifying, so they are shuffled.'); }
        else notes.push(`Seeded by the latest qualifying on this track${q.date ? ' (' + (Number.isFinite(Date.parse(q.date)) ? (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date(q.date)) : String(q.date).slice(0, 10)) + ')' : ''}${ranks.some(x => x === null) ? '; drivers who did not take part are placed last' : ''}.`);
      }
    }
    const key = Heats.planKey({ count: rows.length, lanes, setup, seed, ranks }), edit = (saved.heatEdits || {})[setupId];
    const edited = !!(edit && edit.key === key && Heats.fits(edit.schedule, rows.length, lanes)); // a plan you changed by hand is kept as long as nothing it was made from changes
    const schedule = edited ? edit.schedule : Heats.plan({ count: rows.length, lanes, setup, seed, ranks });
    if (edited) notes.push('You changed this plan by hand. "Reset my changes" brings back the plan that was made.');
    const names = rows.map((r, i) => { const d = byTeam ? teamOf(r.teamId) : drivers.find(x => x.id === r.driverId); return d ? titleOf(byTeam ? 'teams' : 'drivers', d) : (byTeam ? 'Team ' : 'Participant ') + (i + 1); });
    heatPlan = { seed, key, edited, schedule, names, notes, count: rows.length, stats: Heats.stats(schedule, rows.length, lanes) };
  }
  const heatPlanHtml = !heatPlan ? '' : (() => {
    const st = heatPlan.stats, nm = i => esc(heatPlan.names[i]), sel = state.heatSel && state.heatSel.setupId === setupId ? state.heatSel : null; // (the place that is clicked first, when you are swapping two places)
    return `<div class="heatplan"><h4>Heat plan</h4>
      ${[...Heats.summary({ stats: st, setup, names: heatPlan.names, custom: heatPlan.rotation, unit: Speed.distUnitOf(state.settings) }), ...heatPlan.notes].map(t => `<p class="hint2${/do not race the same|not shared evenly/.test(t) ? ' hpwarn' : ''}">${esc(t)}</p>`).join('')}
      <div class="wrap"><table class="fields heatplan-table"><thead><tr><th>Heat</th>${Array.from({ length: lanes }, (_, l) => `<th>Lane ${l + 1}</th>`).join('')}</tr></thead><tbody>${heatPlan.schedule.map((h, i) =>
        `<tr><td>${i + 1}${heatPlan.labels && heatPlan.labels[i] ? ` <span class="muted">${esc(heatPlan.labels[i])}</span>` : ''}</td>${Array.from({ length: lanes }, (_, l) => { const e = h.find(x => x.lane === l), on = !!(sel && sel.heat === i && sel.lane === l);
          return `<td><button type="button" class="hpcell${on ? ' sel' : ''}" data-hp="${i}:${l}" aria-pressed="${on}" title="Click this place, then another one, to swap the two">${e ? nm(e.p) : '<span class="muted">–</span>'}</button></td>`; }).join('')}</tr>`).join('')}</tbody></table></div>
      <p class="hint2">${sel ? 'Now click the place to swap it with.' : 'To change the plan, click a place and then another place: the two swap. A place with a dash is empty, so a driver can move there.'}</p>
      ${state.heatMsg ? `<p class="hint2 hpwarn" role="alert">${esc(state.heatMsg)}</p>` : ''}
      <details class="hplanes"><summary>How often every driver races, and in which lane</summary><div class="wrap"><table class="fields heatplan-table"><thead><tr><th>Driver</th><th>Heats</th>${Array.from({ length: lanes }, (_, l) => `<th>Lane ${l + 1}</th>`).join('')}</tr></thead><tbody>${st.per.map((x, i) =>
        `<tr><td>${nm(i)}</td><td class="num">${x.heats}</td>${x.lanes.map(n => `<td class="num">${n}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>
      <div class="row">${heatPlan.rotation ? '' : '<button class="btn" id="reshuffle" title="Make another plan with the same settings">Shuffle again</button>'}${heatPlan.edited ? ' <button class="btn" id="resetplan" title="Go back to the plan that was made, without your changes">Reset my changes</button>' : ''} <button class="btn" id="heatsheet" title="Make a PDF of the heat list, to print or pin up">Print the heat list</button> <span id="heatsheetmsg" class="muted" role="status"></span></div></div>`;
  })();

  const typeLabel = rawSetup ? (state.schema.racesetups.fields.find(f => f.key === 'sessionType').options.find(o => o[0] === rawSetup.sessionType) || [, ''])[1] : '';
  // 1.58.0: the facts of the race setup as little pills under its name: the kind, how long (laps or minutes, where that is one number), the track and the number of lanes
  const lenText = !setup ? '' : setup.sessionType === 'race' && (!setup.raceBy || setup.raceBy === 'laps') && Number(setup.laps) > 0 ? `${Number(setup.laps)} lap${Number(setup.laps) === 1 ? '' : 's'}`
    : (setup.sessionType === 'qualifying' || setup.sessionType === 'timed') && Number(setup.duration) > 0 ? `${Number(setup.duration)} min` : '';
  const typeShort = typeLabel.replace(/ by laps or distance$/, ''); // ("Race by laps or distance" is "Race" here: the next pill says how long)
  const chipsHtml = [typeShort ? `<span class="hs-chip hs-type"><b>${esc(typeShort)}</b></span>` : '', lenText ? `<span class="hs-chip">${esc(lenText)}</span>` : '', track ? `<span class="hs-chip">${Icons.svg('pin', { size: 14 })}${esc(track.name)}</span>` : '',
    lanes ? `<span class="hs-chip">${lanes} lane${lanes === 1 ? '' : 's'}</span>` : ''].join('');
  const away = r => !!rot && r.absent === true; // (not here today: the places of this participant in the rotation stay empty)
  // a row: the team (only in a session with teams: the team is the participant, or the team of an Endurance Race), the driver (the drivers of the team when there is one) and the car
  // 1.55.0: a session of a championship lists the drivers of its roster first (those who have joined by this round); anybody else drives as a guest
  const driverOpts = (list, chosen, blank = '(choose)') => {
    if (!ch) return optionsOf('drivers', list, chosen, blank);
    const rf = Champ.rosterFirst(list, ch.c, ch.ri + 1), opt = d => `<option value="${esc(d.id)}"${d.id === chosen ? ' selected' : ''}>${esc(titleOf('drivers', d))}</option>`;
    return `<option value="">${esc(blank)}</option>` + (rf.roster.length ? `<optgroup label="${esc(ch.c.name || 'Championship')}: the roster">${rf.roster.map(opt).join('')}</optgroup>` : '')
      + (rf.others.length ? `<optgroup label="${rf.roster.length ? 'Other drivers (they drive as guests)' : 'Drivers'}">${rf.others.map(opt).join('')}</optgroup>` : '');
  };
  const teamSelect = (r, i) => `<select data-k="teamId" aria-label="Team for ${byTeam ? 'participant' : 'row'} ${i + 1}"${away(r) ? ' disabled' : ''}>${optionsOf('teams', teams, r.teamId, '(choose a team)')}</select>`;
  const driverList = r => { // the drivers a row can have: the members of its team, and the driver it has now (a stand-in who is not in the team stays visible)
    const t = r.teamId ? teamOf(r.teamId) : null; if (!t) return drivers;
    const m = membersOf(t), cur = drivers.find(d => d.id === r.driverId);
    return cur && !m.includes(cur) ? [...m, cur] : m;
  };
  // 1.58.0: a row is a dark inset row in the colour of its lane: the number in a circle, the choices with a little picture in front, and a tick when the row is filled in. What it still needs is said inside the row.
  const sel2 = (ico, html) => `<div class="hs-sel${ico ? '' : ' hs-noico'}">${ico ? `<span class="hs-sico" aria-hidden="true">${Icons.svg(ico, { size: ico === 'car' ? 22 : 17 })}</span>` : ''}${html}<span class="hs-chev" aria-hidden="true">${Icons.svg('chevron', { size: 16, stroke: 2 })}</span></div>`;
  const onLane = c => (/^#[0-9a-f]{6}$/i.test(c) && typeof AdjustPad !== 'undefined' ? AdjustPad.textOn(c) : '#ffffff'); // (the number on a lane colour: dark or white, whichever reads better)
  const rowHtml = (r, i) => {
    const gone = away(r), ready = rowOk.has(i) ? rowOk.get(i) : true, // (an away row is in no lamp, and has no message: it is never marked)
      who = (heats ? (byTeam ? 'Team ' : 'Participant ') : 'Lane ') + (i + 1) + (rot && rot.names[i] ? ' · ' + rot.names[i] : '');
    const note = [rowMsgs[i] ? `<span class="hs-why">${esc(rowMsgs[i])}</span>` : '',
      withTeam && r.teamId ? `<span class="muted teamline">${membersOf(teamOf(r.teamId)).length ? 'Drivers: ' + esc(membersOf(teamOf(r.teamId)).map(d => titleOf('drivers', d)).join(', ')) : 'This team has no drivers yet.'}</span>` : ''].filter(Boolean).join(' ');
    const more = (rot && rot.names[i] ? `<span class="muted hs-rname">${esc(rot.names[i])}</span>` : '') + (rot ? `<label class="lane-away"><input type="checkbox" data-absent="${i}"${away(r) ? ' checked' : ''} aria-label="${byTeam ? 'Team' : 'Participant'} ${i + 1} is not here today"> Not here today</label>` : '')
      + (heats && (rot ? rows.length > rot.participants : rows.length > 2) ? `<button class="btn" data-remove="${i}">Remove</button>` : '');
    return `<div class="lane${rot ? ' rot' : ''}${gone ? ' away' : ''}${byTeam ? ' byteam' : ''}${withTeam && !byTeam ? ' threesel' : ''}${!ready ? ' need' : ''}" data-row="${i}" style="--c:${esc(laneHue(i))}">
      <strong class="hs-num" style="--on:${onLane(laneHue(i))}" title="${esc(who)}"><span class="hs-vh">${esc(who)}</span><span aria-hidden="true">${i + 1}</span></strong>
      <div class="hs-fields">${byTeam ? sel2('', teamSelect(r, i)) : `${withTeam ? sel2('', teamSelect(r, i)) : ''}${sel2('driver', `<select data-k="driverId" aria-label="${enduSingle ? 'Starting driver' : 'Driver'} for row ${i + 1}"${away(r) ? ' disabled' : ''}>${driverOpts(enduSingle && !r.teamId ? [] : driverList(r), r.driverId, tokens ? 'Guest (no driver)' : enduSingle ? (setup.endurance.next === 'random' ? '(starting driver: by lot)' : '(starting driver: the first of the team)') : undefined)}</select>`)}`}${sel2('car', `<select data-k="carId" aria-label="Car for row ${i + 1}"${away(r) ? ' disabled' : ''}>${optionsOf('slotcars', cars, r.carId, tokens ? '(no car)' : undefined)}</select>`)}</div>
      ${more ? `<div class="hs-more">${more}</div>` : ''}
      ${gone ? '<span class="hs-tick off" aria-hidden="true"></span>' : `<span class="hs-tick ${ready ? 'ok' : 'warn'}" role="img" aria-label="${ready ? 'Ready' : 'Not ready yet'}">${Icons.svg(ready ? 'check' : 'alert', { size: 13, stroke: 2.6 })}</span>`}
      ${note ? `<div class="hs-note">${note}</div>` : ''}</div>`;
  };
  const rotHtml = !rot ? '' : `<p class="hint2">Rotation setup <strong>${esc(rot.name)}</strong>: ${esc(Rot.describe(rot))}. Tick "Not here today" for ${byTeam ? 'every team' : 'anybody'} that does not come: their places stay empty. ${rot.names.some(x => x.trim()) ? `<button class="btn" id="rotnames" title="Choose the ${byTeam ? 'team' : 'driver'} whose name is the name of a participant in the rotation (only for participants who have no ${byTeam ? 'team' : 'driver'} yet)">${byTeam ? 'Pick the teams by name' : 'Pick the drivers by name'}</button>` : ''}</p>
      ${state.rotMsg && state.rotMsg.setupId === setupId ? `<p class="hint2" role="status">${esc(state.rotMsg.text)}</p>` : ''}`;

  const resumeHtml = !resume || !resume.race ? '' : `<section class="card resumecard" id="resumecard"><h3>A race was interrupted</h3>
      <p><strong>${esc(resume.name || '')}</strong>${resume.kind ? ' · ' + esc(resume.kind) : ''}${resume.trackName ? ' on ' + esc(resume.trackName) : ''}. It was ${resume.where ? esc(resume.where) : esc(Endurance.clock(Number(resume.elapsed) || 0)) + ' into the race'} when it was saved (${esc(resume.savedAt ? new Date(resume.savedAt).toLocaleString() : '')}).</p>
      <div class="row"><button class="btn primary" id="resumego">Resume the race</button><button class="btn" id="resumesave">Save what was recorded</button><button class="btn danger" id="resumedrop">Delete it</button></div>
      <p class="hint2">The race comes back paused, with its clock where it was. The laps driven since then are not in it (the review can add them), and the lap that was being driven is left out of the records. Press Space to carry on.${resume.heat ? ' The heats that were done are kept.' : ''}</p></section>`;
  // 1.55.0: the card of the championship: the round that is next, its sessions (done, next, to do), and one click to load the session that is next. Nothing starts until Start race is pressed.
  const champShown = !champs.length ? null : (ch ? ch.c : champs.find(x => x.id === saved.champId) || null); // 1.56.1: only a championship that was chosen in Start a race (or whose session is loaded) shows; there is no first-one fallback any more
  const champHtml = !champShown ? '' : (() => {
    const c = champShown, p = Champ.progress(c, sessions), ctx = { setups, tracks }, at = p.next || null, ri = at ? at.round : Math.max(0, c.rounds.length - 1), r = c.rounds[ri];
    const bad = at ? Champ.sessionProblems(c, at.round, at.session, ctx) : [];
    const nextSetup = at ? setups.find(q => q.id === r.sessions[at.session].setup) : null, nextKind = nextSetup ? Champ.kindOf(nextSetup) : '';
    const refSetup = r && r.sessions[at ? at.session : 0] ? setups.find(q => q.id === r.sessions[at ? at.session : 0].setup) : null, trackName = r ? (tracks.find(t => t.id === Champ.trackFor(r, refSetup, tracks)) || {}).name || '' : '';
    const step = (s, k) => {
      const done = p.done.has(Champ.keyOf(r.id, s.id)), next = at && at.round === ri && at.session === k, setup = setups.find(q => q.id === s.setup), kind = Champ.kindOf(setup);
      return `<li class="chstep${done ? ' done' : ''}${next ? ' next' : ''}"><span class="si" aria-hidden="true">${done ? '&#10003;' : k + 1}</span><span class="grow">${next ? '<strong>' : ''}${esc(kind ? Champ.KIND_LABEL[kind] : '?')}: ${esc(setup ? setup.name || '(unnamed)' : s.setup ? '(deleted race setup)' : '(no race setup)')}${next ? '</strong>' : ''}</span>
        <span class="muted">${done ? 'done' : next ? 'next' : kind === 'race' ? 'points: ' + (s.share ? s.share + '%' : 'none') : ''}</span></li>`;
    };
    const picks = c.rounds.map((q, i) => q.sessions.length ? `<optgroup label="${esc(Champ.roundLabel(c, i))}">${q.sessions.map((s, k) => { const x = setups.find(y => y.id === s.setup), kind = Champ.kindOf(x);
      return `<option value="${i}:${k}">${p.done.has(Champ.keyOf(q.id, s.id)) ? '✓ ' : ''}${esc(kind ? Champ.KIND_LABEL[kind] : '?')}: ${esc(x ? x.name || '(unnamed)' : '(no race setup)')}</option>`; }).join('')}</optgroup>` : '').join('');
    const loaded = !!(ch && at && ch.c.id === c.id && ch.ri === at.round && ch.si === at.session);
    // 1.56.0: who leads, and the top of the standings (the points of the races that are awarded)
    const stand = ChampPts.standings(c, sessions, { drivers: drivers.map(x => ({ id: x.id, name: titleOf('drivers', x) })), teams: teams.map(x => ({ id: x.id, name: titleOf('teams', x) })), setups }), lead = ChampPts.leadText(stand);
    const standWhich = state.champHomeWhich === 'teams' && stand.teams ? 'teams' : 'drivers', topRows = (standWhich === 'teams' ? stand.teams : stand.drivers).slice(0, 5), more = ChampPts.remainingNote(c, stand, setups);
    const standHtml = !stand.decided ? '' : `<div class="chstand" id="chstand"><div class="chsthead"><b>Standings after round ${stand.last}</b>${stand.teams ? `<span class="chswitch"><button type="button" class="btn${standWhich === 'drivers' ? ' on' : ''}" data-chst="drivers">Drivers</button><button type="button" class="btn${standWhich === 'teams' ? ' on' : ''}" data-chst="teams">Teams</button></span>` : ''}</div>
      <table class="num chmini"><tbody>${topRows.map(x => `<tr><td class="muted">${x.pos}</td><td><b>${esc(x.name)}</b></td><td class="r"><b>${esc(ChampPts.fmt(x.total))}</b></td></tr>`).join('')}</tbody></table>
      ${more ? `<p class="hint2">${esc(more)}</p>` : ''}<div class="row"><button type="button" class="btn" data-chall="${esc(c.id)}">All standings</button></div></div>`;
    return `<section class="champband" id="champband" aria-label="Championship ${esc(c.name || '')}">
      <div class="chhead"><div class="chline">${!c.rounds.length ? 'It has no rounds yet. Make them in Race Setup > Championships.' : p.complete ? `Finished: all ${p.total} sessions are driven.` : !p.total ? 'It has no sessions yet. Add them in Race Setup > Championships.'
          : `Round ${ri + 1} of ${c.rounds.length}${r.name ? ' · ' + esc(r.name) : ''}${trackName ? ' · ' + esc(trackName) : ''}${r.date ? ' · ' + esc(r.date) : ''}`}</div>
        <div class="chtags">${lead ? `<span class="chtag chlead">${esc(lead)}</span>` : ''}${p.total ? `<span class="chtag">${p.driven} of ${p.total} sessions driven</span>` : ''}</div></div>
      ${r && r.sessions.length && !p.complete ? `<ul class="chsteps">${r.sessions.map(step).join('')}</ul>` : ''}
      ${bad.length ? `<ul class="issues">${bad.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}${state.champMsg ? `<p class="hint2 hpwarn" role="alert">${esc(state.champMsg)}</p>` : ''}
      <div class="row">${at ? `<button type="button" class="btn chload" id="champload" data-load="${at.round}:${at.session}"${bad.length ? ' disabled' : ''}>${loaded ? 'Loaded: ' : 'Load '}${esc(nextKind ? Champ.KIND_LABEL[nextKind] : 'the next session')}</button>` : ''}
        ${picks ? `<select id="champpick" aria-label="Load another session"><option value="">${at ? 'Another session...' : 'Drive a session again...'}</option>${picks}</select>` : ''}
        <span class="muted">Fills the race setup and the lanes below; nothing starts until you press Start race.</span></div>${standHtml}</section>`;
  })();
  // 1.56.1: the choice of the championship, at the top of Start a race: None (a normal race) or one of the championships. Only the one that is chosen shows its card.
  const champPickHtml = !champs.length ? '' : `<div class="hs-champ"><span class="hs-ctile" aria-hidden="true">${Icons.svg('championship', { size: 18 })}</span><label class="hs-clabel" for="champsel">Championship</label>
        <div class="hs-sel hs-noico hs-grow2"><select id="champsel"><option value="">None: a normal race</option>${champs.map(x => `<option value="${esc(x.id)}"${champShown && x.id === champShown.id ? ' selected' : ''}>${esc(x.name || '(unnamed)')}</option>`).join('')}</select><span class="hs-chev" aria-hidden="true">${Icons.svg('chevron', { size: 16, stroke: 2 })}</span></div></div>`;
  // 1.17.0: the welcome band (date, track and status chips), the start card with its coloured lanes and start lights, and the cards on the right
  const audio = setup && (audiosets || []).find(x => x.id === setup.audioSet), audioName = audio ? audio.name || '(unnamed)' : '';
  // the timing hardware chip: the hardware that was chosen (App Settings, Timing Hardware), one at a time, and whether it is connected
  const abLink = typeof ArduinoBox !== 'undefined' && ArduinoBox.link ? ArduinoBox.link : null;
  const chipsNow = more => HomeStats.chips({ hardware: Hardware.timingChosen(state.settings), trackmate: typeof Trackmate !== 'undefined' && !!Trackmate.link.connected, arduino: !!(abLink && abLink.connected), virtual: state.settings.abVirtual === true,
    netOn: !!state.settings.netOn, netError: more && more.netError, hasSetup: !!setup, audioName, drivers: drivers.length, cars: cars.length, tracks: tracks.length });
  const chipHtml = c => `<span class="hm-chip" data-key="${c.key}"${c.state ? ` data-state="${c.state}"` : ''}>${c.state ? '<i aria-hidden="true"></i>' : ''}${esc(c.text)}</span>`;
  const today = new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
  const lt = HomeStats.lights(rows, { byTeam, enduSingle, tokens }, heats ? (byTeam ? 'team' : 'participant') : 'lane', issues.length > 0), shown = rows.map((r, i) => ({ r, i })).filter(x => !x.r.absent);
  const laneSub = tokens ? 'A lane can have no driver (a Guest) and no car.' : heats ? `${rows.length} ${byTeam ? 'teams' : 'participants'} race on ${lanes} lanes. Pick who takes part.` : enduSingle ? 'Every lane is a team with its starting driver.' : 'Pick who drives what.';
  const rowSaid = new Set(Object.values(rowMsgs)), otherIssues = issues.filter(x => !rowSaid.has(x)); // (the list under the rows keeps what is not about one row)
  const rowOk = new Map(shown.map((x, k) => [x.i, lt.ok[k]])), allReady = !issues.length; // (1.58.0: a tick for every row, and one pill that says whether the race can start: nothing is wrong, and then every row is filled in, because what a row lacks is one of the issues)
  const lightsHtml = setup && track && lanes && rows.length ? `<div class="hs-status ${allReady ? 'ok' : 'warn'}" role="status"><div class="hm-lights" aria-hidden="true">${shown.map((x, k) => `<i${lt.ok[k] ? ' class="on"' : ''} style="--c:${esc(laneHue(x.i))}"></i>`).join('')}</div><span class="hm-ready">${esc(lt.text)}</span></div>` : '';
  // 1.25.0: Customize, set up like the Leaderboard grid: the little squares (up to 6 columns by 4 rows), a card for every cell, and the settings of the card that is picked
  const HG = HomeGrid, place = b => `grid-column:${b.c} / span ${b.w};grid-row:${b.r} / span ${b.h}`;
  const customHtml = () => {
    if (!hc.open) return '';
    const g = grid, sel = hc.sel, b = g.boards[sel], same = (n, one, many) => `${n} ${n === 1 ? one : many}`;
    const choice = (cur, i) => `<option value=""${cur ? '' : ' selected'}>(empty)</option>${HG.available(g, i).map(c => `<option value="${esc(c.key)}"${c.key === cur ? ' selected' : ''}>${esc(c.label)}</option>`).join('')}`;
    const squares = Array.from({ length: HG.MAXR * HG.MAXC }, (_, k) => { const c = k % HG.MAXC + 1, r = Math.floor(k / HG.MAXC) + 1; return `<button type="button" class="lv-gp${c <= g.cols && r <= g.rows ? ' on' : ''}" data-hgrid="${c},${r}" aria-label="${same(c, 'column', 'columns')} by ${same(r, 'row', 'rows')}" aria-pressed="${c === g.cols && r === g.rows}"></button>`; }).join('');
    const map = HG.cells(g).map(x => x.board
      ? `<div class="lv-gcell${x.index === sel ? ' sel' : ''}" style="${place(x.board)}">${HG.cardOf(x.board) === 'start' ? '<span class="hm-fixed">Start a race <small>(always on Home)</small></span>'
        : `<select aria-label="Card in ${HG.where(x.board)}" data-hcell="${x.index}">${choice(HG.cardOf(x.board), x.index)}</select>`}<button type="button" class="btn" data-hsel="${x.index}" aria-pressed="${x.index === sel}">Card ${x.index + 1} settings</button></div>`
      : `<div class="lv-gcell empty" style="grid-column:${x.c};grid-row:${x.r}"><select aria-label="Card in column ${x.c}, row ${x.r}" data-hadd="${x.c},${x.r}">${choice('', -1)}</select></div>`).join('');
    let one = '<p class="muted">Pick a card for a cell to see its settings here.</p>';
    if (b) {
      const ms = HG.maxSpan(g, b), cd = HG.info(HG.cardOf(b));
      const span = (key, n, max, label) => `<div class="field"><label for="hg-${key}">${label}</label><select id="hg-${key}" data-hspan="${key}">${Array.from({ length: max }, (_, i) => `<option value="${i + 1}"${n === i + 1 ? ' selected' : ''}>${i + 1}</option>`).join('')}</select></div>`;
      // one option of the card: a tick, a choice, a number, a line of text or a picture set. The options of a row (a tyre: tick, name, how many) sit on one line (1.26.0).
      const attrs = o => `id="hg-${esc(o.key)}" data-hopt="${esc(o.key)}"`;
      const input = (o, v) => o.type === 'check' ? `<input id="hg-${esc(o.key)}" type="checkbox" data-hopt="${esc(o.key)}" ${v ? 'checked' : ''}>`
        : o.type === 'number' ? `<input ${attrs(o)} type="number" min="${o.min}" max="${o.max}" step="1" value="${esc(v)}" aria-label="${esc(o.label)}">`
        : o.type === 'longtext' ? `<textarea ${attrs(o)} rows="${o.rows || 5}" maxlength="${o.max}" placeholder="${esc(o.placeholder || '')}" aria-label="${esc(o.label)}">${esc(v)}</textarea>`
        : o.type === 'text' ? `<input ${attrs(o)} type="text" maxlength="${o.max}" value="${esc(v)}" placeholder="${esc(o.placeholder || '')}" aria-label="${esc(o.label)}">`
        : o.type === 'imageset' ? `<select ${attrs(o)}><option value="">None (drawn)</option>${imageSets.filter(r => r.kind === o.kind).map(r => `<option value="${esc(r.id)}"${r.id === v ? ' selected' : ''}>${esc(r.name || '(unnamed)')}</option>`).join('')}</select>`
        : `<select ${attrs(o)}>${o.choices.map(([k, t]) => `<option value="${esc(k)}"${v === k ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
      const opt = o => { const v = HG.optionOf(b, o.key); return o.type === 'check' ? `<div class="field"><label class="inline">${input(o, v)} ${esc(o.label)}</label></div>`
        : `<div class="field${o.type === 'longtext' ? ' hm-wide' : ''}"><label for="hg-${esc(o.key)}">${esc(o.label)}</label>${input(o, v)}</div>`; };
      const inRow = o => { const v = HG.optionOf(b, o.key); return o.type === 'check' ? `<label class="inline hm-ocheck">${input(o, v)} ${esc(o.label)}</label>` : `${input(o, v)}${o.suffix ? `<span class="muted">${esc(o.suffix)}</span>` : ''}`; };
      const optsHtml = cd.options.reduce((out, o, k, all) => o.row ? (k > 0 && all[k - 1].row === o.row ? out : out + `<div class="hm-orow">${all.filter(x => x.row === o.row).map(inRow).join('')}</div>`) : out + opt(o), '');
      one = `<fieldset class="lv-optset"><legend>Card ${sel + 1}: ${esc(cd.label)} (${HG.where(b)})</legend><p class="hint2">${esc(cd.note)}</p><div class="lv-optgrid">${span('w', b.w, ms.w, 'Columns it covers')}${span('h', b.h, ms.h, 'Rows it covers')}${optsHtml}</div></fieldset>`;
    }
    return `<section class="card hm-customize" id="hm-customize"><h3>Customize Home</h3><p class="hint2">Pick the grid with the little squares, then choose a card for every cell. A card can cover more cells (wider or taller). The grid is kept on this computer, and every change shows at once.</p>
      <div class="lv-gridtool"><div class="field"><span class="lbl" id="hg-gridlabel">Grid</span><div class="lv-gridpick" role="group" aria-labelledby="hg-gridlabel">${squares}</div><output id="hg-gridsize">${HG.sizeText(g)}</output></div>
      <div class="field"><span class="lbl">Card in every cell</span><div class="lv-gridmap" style="grid-template-columns:repeat(${g.cols},minmax(0,1fr))">${map}</div></div></div>${one}
      <div class="row"><button type="button" class="btn" id="hmdefault"${HG.isDefault(g) ? ' disabled' : ''} title="Put the cards back the way Home was before you customized it">Back to the usual Home</button></div></section>`;
  };
  const startBoard = grid.boards.find(b => HG.cardOf(b) === 'start'), otherCells = grid.boards.filter(b => HG.cardOf(b) !== 'start').map(b => `<div class="hm-cell" id="hmc-${esc(HG.cardOf(b))}" data-card="${esc(HG.cardOf(b))}" style="${place(b)}"></div>`).join('');
  const ae = hc.open && typeof document !== 'undefined' ? document.activeElement : null, keep = homeFieldId(ae) ? { id: ae.id, type: ae.type, start: ae.selectionStart, end: ae.selectionEnd } : null; // (the field of Customize that has the cursor now, and what is selected in it)
  view.innerHTML = `${homeHeaderHtml(state.settings)}
    <div class="hm-band"><div class="hm-flag" aria-hidden="true"></div><button type="button" class="btn hm-customize-btn" id="hmcustom" aria-expanded="${hc.open}" aria-controls="hm-customize" title="Choose the cards of Home and where they sit">Customize</button><h2>${esc(welcomeOf())}</h2>
      <p class="hm-sub">${esc(today)}${track ? ' · ' + esc(track.name) : ''}</p>
      <div class="hm-chips" id="hm-chips">${chipsNow().map(chipHtml).join('')}</div></div>
    ${customHtml()}
    ${resumeHtml}
    <div class="hm-grid" id="homegrid" style="grid-template-columns:repeat(${grid.cols},minmax(0,1fr))"><section class="card hm-start" id="hmc-start" style="${place(startBoard)}">` + (setups.length ? `
      <div class="hs-head"><span class="hs-tile" aria-hidden="true">${Icons.svg('racesetups', { size: 24 })}</span>
        <div class="hs-ht"><label class="hs-label" for="setup">Start a race</label>
          <div class="hs-title"><select id="setup" aria-label="Race setup">${setups.map(s => `<option value="${esc(s.id)}"${s.id === setupId ? ' selected' : ''}>${esc(s.name || '(unnamed)')}</option>`).join('')}</select><span class="hs-chev" aria-hidden="true">${Icons.svg('chevron', { size: 16, stroke: 2 })}</span></div>
          <div class="hs-chips">${chipsHtml}</div></div></div>
      ${champPickHtml}${champHtml}
      ${ch ? `<p class="chcounts" id="chcounts"><b>Counts for ${esc(ch.c.name || 'the championship')}</b> · ${esc(Champ.roundKindText(ch.tag))} <span class="muted">(change the race setup and it is a normal race again)</span></p>` : ''}
      ${qual && lanes > 1 ? `<p class="hint2">🏁 ${esc(qual.name)} won the latest qualifying on this track and picks a lane first. ${winRow >= 0
        ? `Starting lane: <select id="winlane" aria-label="Starting lane for ${esc(qual.name)}">${Array.from({ length: lanes }, (_, i) => `<option value="${i}"${i === winRow ? ' selected' : ''}>Lane ${i + 1}</option>`).join('')}</select>`
        : 'Assign them below, then choose their lane here.'} <button class="btn" id="clearqual">Clear qualifying result</button></p>` : ''}
      ${rotHtml}
      ${track && lanes ? `<div class="hs-sub"><span class="hs-label hs-muted">${heats ? (byTeam ? 'Teams' : 'Participants') : 'Lanes'}</span><span class="muted">${esc(laneSub)}</span></div><div class="hs-lanes">${rows.map(rowHtml).join('')}</div>` : ''}
      ${heats && track && !rot ? `<button class="btn" id="addrow">${byTeam ? 'Add team' : 'Add participant'}</button>` : ''}
      ${heatPlanHtml}
      ${tokens ? '<p class="hint2">A Time Token Session starts with every lane switched off. You add paid time to a lane on the race screen, and can change the driver there too. Here you can already put a driver and a car on a lane.</p>' : ''}
      ${raceOn ? '<p class="hint2" id="raceon">A race is running. <button class="btn" id="gorace">Go to the race</button></p>' : ''}
      ${otherIssues.length ? `<ul class="issues">${otherIssues.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      <div class="hm-go">${lightsHtml}<span class="hm-grow"></span><button class="btn primary big" id="start" ${issues.length || raceOn ? 'disabled' : ''}${raceOn ? ' title="A race is still running. Open the Race tab to finish or stop it first."' : ''}>${Icons.svg('racesetups', { size: 20 })}<span>${tokens ? 'Open the session' : 'Start race'}</span></button></div>`
      : '<h3>Start a race</h3><p class="muted">Create a race setup in the Race Setup tab to get started.</p>') + `</section>${otherCells}</div>`;

  if (keep) { // the field that had the cursor has it again, with the same part of the text selected (a number has no part: all of it, as when you come into it with Tab)
    const el = document.getElementById(keep.id);
    if (el && typeof el.focus === 'function') {
      el.focus();
      if (typeof keep.start === 'number' && typeof el.setSelectionRange === 'function') el.setSelectionRange(keep.start, typeof keep.end === 'number' ? keep.end : keep.start);
      else if (keep.type === 'number' && typeof el.select === 'function') el.select();
    }
  }
  // 1.55.0: a session of the championship is loaded: its race setup is the one on Home, its track is the track of the round, and the race that is started counts for the championship
  const loadSession = (ri, si) => {
    const c = champShown, r = c && c.rounds[ri], s = r && r.sessions[si]; if (!s) return;
    const bad = Champ.sessionProblems(c, ri, si, { setups, tracks });
    if (bad.length) { state.champMsg = bad[0]; renderHome(); return; }
    state.champMsg = '';
    api.setSettings({ lastSetupId: s.setup, champId: c.id, champTag: { champId: c.id, roundId: r.id, sessionId: s.id, setupId: s.setup } }).then(x => { state.settings = x; renderHome(); });
  };
  const persist = async () => {
    state.settings = await api.setSettings({ lastSetupId: setupId, assignments: { ...(saved.assignments || {}), [setupId]: rows } });
    renderHome();
  };
  // (the grid is saved for this computer; Customize stays open. soft: a field was left, so the drawing waits a moment.) The changes are made on the grid as it was saved last, not on the one this drawing started from.
  const cur = () => hc.latest || HG.gridOf(state.settings); // (hc.latest: a grid that is being saved right now)
  const saveGrid = async (g, soft) => {
    hc.latest = g;
    try { state.settings = await api.setSettings({ homeGrid: g }); } finally { if (hc.latest === g) hc.latest = null; }
    hc.open = true;
    if (!soft) { renderHome(); return; }
    clearTimeout(hc.timer); hc.timer = setTimeout(homeSoftDraw, HOME_SOFT_MS);
  };
  view.oninput = ev => { const c = state.homeCustom; if (c) c.typing = homeFocusId(ev.target) !== ''; }; // (typing in such a field: Home is left alone until the field is left)
  view.onchange = ev => {
    state.rotMsg = null;
    const t = ev.target, dd = t.dataset || {};
    hc.typing = false;
    if (dd.hadd !== undefined) { // a card for an empty cell
      const [c, r] = String(dd.hadd).split(',').map(Number); if (!t.value) return;
      const g2 = HG.add(cur(), c, r, t.value); hc.sel = Math.max(0, g2.boards.findIndex(x => x.c === c && x.r === r)); saveGrid(g2); return;
    }
    if (dd.hcell !== undefined) { const i = Number(dd.hcell); hc.sel = i; saveGrid(t.value ? HG.setCard(cur(), i, t.value) : HG.remove(cur(), i)); return; } // (another card for a cell, or none: the card and its settings are gone)
    if (dd.hspan) { const g = cur(), b = g.boards[hc.sel]; if (b) saveGrid(HG.setSpan(g, hc.sel, dd.hspan === 'w' ? t.value : b.w, dd.hspan === 'h' ? t.value : b.h)); return; }
    if (dd.hopt) { const g = cur(); if (g.boards[hc.sel]) saveGrid(HG.setOpt(g, hc.sel, { [dd.hopt]: t.type === 'checkbox' ? t.checked : t.value }), t.type === 'text' || t.type === 'number' || t.type === 'textarea'); return; }
    if (ev.target.id === 'winlane') { const to = Number(ev.target.value); [rows[winRow], rows[to]] = [rows[to], rows[winRow]]; persist(); return; }
    if (ev.target.id === 'champsel') { // 1.56.1: a championship chosen in Start a race shows its card there; None is a normal race again. A session that was loaded is let go either way (the race setup and the lanes stay as they are)
      state.champMsg = ''; const id = ev.target.value;
      api.setSettings({ champId: id || null, champTag: null }).then(s => { state.settings = s; renderHome(); }); return; }
    if (ev.target.id === 'champpick') { const [i, k] = String(ev.target.value).split(':').map(Number); if (Number.isInteger(i) && Number.isInteger(k)) loadSession(i, k); return; }
    if (ev.target.id === 'setup') { api.setSettings({ lastSetupId: ev.target.value, champTag: null }).then(s => { state.settings = s; renderHome(); }); return; } // (another race setup: it is a normal race again)
    if (ev.target.dataset && ev.target.dataset.absent !== undefined) { const r = rows[Number(ev.target.dataset.absent)]; if (r) { if (ev.target.checked) r.absent = true; else delete r.absent; persist(); } return; }
    const row = ev.target.closest('[data-row]');
    if (row && ev.target.dataset.k) {
      const i = Number(row.dataset.row), k = ev.target.dataset.k, v = ev.target.value, r = rows[i];
      if (k === 'teamId') { // a team for the row (only in a session with teams): an Endurance Race row has its starting driver from the team too
        if (!v) delete r.teamId;
        else {
          r.teamId = v;
          if (enduSingle) { if (!membersOf(teamOf(v)).some(d => d.id === r.driverId)) r.driverId = ''; } // (the starting driver is chosen, or left to the rule)
        }
      } else r[k] = v;
      persist();
    }
  };
  view.onclick = ev => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.id === 'hmcustom') { hc.open = !hc.open; renderHome(); return; }
    if (b.dataset.chst) { state.champHomeWhich = b.dataset.chst; renderHome(); return; }
    if (b.dataset.chall) { champView.id = b.dataset.chall; champView.which = state.champHomeWhich === 'teams' ? 'teams' : 'drivers'; state.resultsSub = 'champs'; state.tab = 'database'; state.sub = 'results'; render(); return; } // 1.56.0: the standings of the championship
    if (b.id === 'champload') { const [i, k] = String(b.dataset.load).split(':').map(Number); loadSession(i, k); return; }
    if (b.dataset.hgrid) { const [c, r] = String(b.dataset.hgrid).split(',').map(Number); saveGrid(HG.resize(cur(), c, r)); return; } // a square of the grid picker
    if (b.dataset.hsel !== undefined) { hc.sel = Number(b.dataset.hsel) || 0; renderHome(); return; } // the settings of a card
    if (b.id === 'hmdefault') { api.setSettings({ homeGrid: null }).then(s => { state.settings = s; hc.sel = 0; renderHome(); }); return; }
    if (b.dataset.car) { state.focusCar = b.dataset.car; state.tab = 'database'; state.sub = 'slotcars'; render(); return; } // a car of the Service Due card: its card in the Database
    if (b.dataset.session) { state.focusSession = b.dataset.session; state.resultsSub = 'racing'; state.tab = 'database'; state.sub = 'results'; render(); return; } // a recent race: its results
    if (b.dataset.go) { // a shortcut
      const s = HG.SHORTCUTS.find(x => x.key === b.dataset.go);
      if (!s) return;
      if (s.key === 'live') { api.liveOpen(); return; }
      if (s.key === 'results') state.resultsSub = 'racing';
      Object.assign(state, s.to); render(); return;
    }
    if (b.id === 'clearqual' && qual) { api.setSettings({ qualCleared: { ...(saved.qualCleared || {}), [track.id]: qual.id } }).then(s => { state.settings = s; renderHome(); }); return; }
    if (b.id === 'addrow') { rows.push({ driverId: '', carId: '' }); persist(); }
    if (b.id === 'rotnames' && rot) { // the drivers whose names are the names of the participants (only participants who have no driver yet)
      const what = byTeam ? 'team' : 'driver', key = byTeam ? 'teamId' : 'driverId';
      const m = byTeam ? Rot.matchDrivers(rot, teams, t => [titleOf('teams', t), t.name]) : Rot.matchDrivers(rot, drivers, d => [titleOf('drivers', d), d.name]), taken = new Set(rows.map(r => r[key]).filter(Boolean)); let n = 0;
      m.picks.forEach((id, i) => { if (id && rows[i] && !rows[i][key] && !taken.has(id)) { rows[i][key] = id; taken.add(id); n++; } });
      const said = [n ? `Picked ${n} ${n === 1 ? what : what + 's'} by name.` : `No ${what} was picked by name.`];
      if (m.missing.length) said.push(`No ${what} is called ${m.missing.join(', ')}.`);
      if (m.ambiguous.length) said.push(`More than one ${what} is called ${m.ambiguous.join(', ')}.`);
      state.rotMsg = { setupId, text: said.join(' ') }; persist(); return;
    }
    if (b.id === 'heatsheet' && heatPlan) { // the heat list as a PDF (a sheet with the driver of every lane and a place for the winner)
      const msg = document.getElementById('heatsheetmsg'), say = t => { if (msg) msg.textContent = t; };
      say('Making the PDF...');
      const list = Heats.planList(heatPlan.schedule, heatPlan.names, heatPlan.labels);
      api.exportPdf(Report.heatSheetHtml({ title: `${setup.name}: heat list`, subtitle: `${track ? track.name + ' · ' : ''}${heatPlan.count} ${heatPlan.count === 1 ? 'participant' : 'participants'} · ${list.length} ${list.length === 1 ? 'heat' : 'heats'}`, list, lanes }), `${setup.name} heat list.pdf`.replace(/[\\/:*?"<>|]/g, '-'))
        .then(res => say(res.saved ? 'Saved to ' + res.path : 'Export cancelled.'), x => say('Could not make the PDF: ' + x.message));
      return;
    }
    if (b.id === 'reshuffle' && heatPlan) { state.heatSel = null; state.heatMsg = ''; const edits = { ...(saved.heatEdits || {}) }; delete edits[setupId]; api.setSettings({ heatSeeds: { ...(saved.heatSeeds || {}), [setupId]: Heats.newSeed() }, heatEdits: edits }).then(s => { state.settings = s; renderHome(); }); return; }
    if (b.id === 'resetplan' && heatPlan) { state.heatSel = null; state.heatMsg = ''; const edits = { ...(saved.heatEdits || {}) }; delete edits[setupId]; api.setSettings({ heatEdits: edits }).then(s => { state.settings = s; renderHome(); }); return; }
    if (b.dataset.hp !== undefined && heatPlan) { // the plan is changed by clicking one place and then another one
      const [h, l] = b.dataset.hp.split(':').map(Number), first = state.heatSel && state.heatSel.setupId === setupId ? state.heatSel : null;
      state.heatMsg = '';
      if (!first) { state.heatSel = { setupId, heat: h, lane: l }; renderHome(); return; }
      state.heatSel = null;
      if (first.heat === h && first.lane === l) { renderHome(); return; } // the same place again: let go
      const res = Heats.swap(heatPlan.schedule, first, { heat: h, lane: l }, heatPlan.count, lanes);
      if (res.error) { state.heatMsg = res.error; renderHome(); return; }
      api.setSettings({ heatEdits: { ...(saved.heatEdits || {}), [setupId]: { key: heatPlan.key, schedule: res.schedule } } }).then(s => { state.settings = s; renderHome(); }); return;
    }
    if (b.dataset.remove !== undefined) { rows.splice(Number(b.dataset.remove), 1); persist(); }
    if (b.id === 'gorace') { state.tab = 'race'; render(); return; }
    if ((b.id === 'resumego' || b.id === 'resumesave') && resume && resume.race) { // the race that was interrupted comes back (paused), or is closed and checked for saving
      if (typeof raceActive === 'function' && raceActive()) return;
      if (b.id === 'resumego' && !timingReady()) return;
      state.race = { setup: resume.race.setup, track: resume.race.track, rows: resume.race.rows, ...(resume.race.byTeam ? { byTeam: true } : {}), ...(resume.race.schedule ? { schedule: resume.race.schedule, ...(resume.race.labels ? { labels: resume.race.labels } : {}) } : {}), ...(resume.race.champ ? { champ: resume.race.champ } : {}), resume: b.id === 'resumesave' ? { ...resume, stopNow: true } : resume }; state.tab = 'race'; render(); return;
    }
    if (b.id === 'resumedrop') {
      if (typeof confirm === 'function' && !confirm('Delete the race that was interrupted? What it recorded is lost.')) return;
      Promise.resolve(api.clearResume()).then(() => renderHome()); return;
    }
    if (b.id === 'start') {
      if (typeof raceActive === 'function' && raceActive()) return; // (one race at a time: the one that is running is on the Race tab)
      if (!tokens && !timingReady()) return; // (the timing hardware that was chosen is not connected: asked, and the person may go and connect it)
      let go = rot ? here : rows;
      if (enduSingle) { // the driver who starts for every team: the one that was chosen, else the next of the team who is not starting for another team (or one picked by lot)
        const taken = new Set(rows.map(r => r.driverId).filter(Boolean)), rnd = state.rand || Math.random;
        go = rows.map(r => {
          if (r.driverId) return r;
          const free = membersOf(teamOf(r.teamId)).filter(d => !taken.has(d.id)), d = free.length ? (setup.endurance.next === 'random' ? free[Math.floor(rnd() * free.length)] : free[0]) : null;
          if (d) taken.add(d.id);
          return { ...r, driverId: d ? d.id : '' };
        });
      }
      state.race = { setup: rawSetup, track, rows: go, ...(byTeam ? { byTeam: true } : {}), ...(heatPlan ? { schedule: heatPlan.schedule, ...(heatPlan.labels ? { labels: heatPlan.labels } : {}) } : {}), ...(ch ? { champ: ch.tag } : {}) }; state.tab = 'race'; render(); // (a heat race is raced as planned above; with a rotation, only the participants who are here race)
    }
  };

  // ---- the status chips stay true: the Trackmate can be plugged in while Home is open ----
  const setChips = more => { const el = document.getElementById('hm-chips'); if (el) el.innerHTML = chipsNow(more).map(chipHtml).join(''); return !!el; };
  const run = ++homeRun; let netError = '';
  if (homeOffTm) { homeOffTm(); homeOffTm = null; }
  if (typeof Trackmate !== 'undefined' && Trackmate.link && Trackmate.link.onStatus) {
    const off = Trackmate.link.onStatus(() => { if (run !== homeRun || !setChips({ netError })) { off(); if (homeOffTm === off) homeOffTm = null; } });
    homeOffTm = off;
  }
  // (the box connects by itself a moment after the app starts, or when the virtual box is ticked: the same chip follows it)
  if (homeOffAb) { homeOffAb(); homeOffAb = null; }
  if (abLink && abLink.onStatus) {
    const off = abLink.onStatus(() => { if (run !== homeRun || !setChips({ netError })) { off(); if (homeOffAb === off) homeOffAb = null; } });
    homeOffAb = off;
  }

  // ---- the other cards of the grid (1.25.0). The cards that need races come when the laps are in; Rules of this race needs the names of the rule sets of the setup. ----
  const dateText = iso => { const d = iso ? new Date(iso) : null; return d && !isNaN(d) ? d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : ''; };
  const shortDate = iso => { const d = iso ? new Date(iso) : null; return d && !isNaN(d) ? d.toLocaleDateString([], { day: 'numeric', month: 'short' }) : ''; };
  const dn = id => { const d = drivers.find(x => x.id === id); return d ? titleOf('drivers', d) : ''; }, cn = id => { const c = cars.find(x => x.id === id); return c ? titleOf('slotcars', c) : ''; };
  const trackNameOf = id => { const t = tracks.find(x => x.id === id); return t ? t.name || '(unnamed)' : ''; };
  const others = grid.boards.filter(b => HG.cardOf(b) !== 'start'), wants = key => others.some(b => HG.cardOf(b) === key);
  const cardsHtml = (laps, lists) => {
    const now = new Date(), last = HomeStats.lastRace({ sessions, laps, driverName: dn }), out = new Map();
    const d = { fmtDate: dateText, fmtShort: shortDate, fmtDist: m => Stats.fmtDist(m, Speed.distUnitOf(state.settings)), trackName: track ? track.name || '' : '', hasTrack: !!track, hasSetup: !!setup, setupName: setup ? setup.name || '' : '', last };
    const setImages = (kind, id) => { const r = id ? imageSets.find(x => x.id === id && x.kind === kind) : null; return r && r.images && typeof r.images === 'object' ? r.images : null; }; // (the pictures of a picture set; none when it was deleted)
    const nameIn = (list, id) => { const x = id && (list || []).find(r => r.id === id); return x ? x.name || '(unnamed)' : ''; };
    others.forEach(b => {
      const key = HG.cardOf(b), n = o => Number(HG.optionOf(b, o));
      if (HomeCards.NEEDS_RACES.includes(key) && !last) { out.set(key, ''); return; } // (nothing raced yet: one friendly card, below)
      if (key === 'record') d.rec = track ? HomeStats.recordCard({ laps, sessions, trackId: track.id, driverIds: byTeam ? [] : rows.filter(r => !r.absent).map(r => r.driverId), driverName: dn, carName: cn }) : null;
      else if (key === 'weather') d.images = { weather: setImages('weather', HG.optionOf(b, 'weatherSet')), conditions: setImages('conditions', HG.optionOf(b, 'condSet')) };
      else if (key === 'tyres') d.images = { tyres: setImages('tyres', HG.optionOf(b, 'tyreSet')) };
      else if (key === 'glance') d.glance = HomeStats.glance({ sessions, laps, tracks, driverName: dn });
      else if (key === 'recent') d.recent = HomeStats.recent({ sessions, count: n('count') });
      else if (key === 'fastest') { d.fastestScope = HG.optionOf(b, 'scope'); d.fastest = HomeStats.fastestWeek({ laps, sessions, trackId: track && track.id, scope: d.fastestScope, count: n('count'), now, driverName: dn, trackName: trackNameOf }); }
      else if (key === 'records') d.records = HomeStats.allRecords({ laps, sessions, trackName: trackNameOf, driverName: dn, carName: cn });
      else if (key === 'top') { d.topPeriod = HG.optionOf(b, 'period'); d.top = HomeStats.winners({ sessions, driverName: dn, since: d.topPeriod === 'year' ? HomeStats.yearStart(now) : null }).slice(0, n('count')); }
      else if (key === 'mileage') { d.mileage = HomeStats.mileage({ laps, tracks, carName: cn, carPicture: id => { const c = cars.find(x => x.id === id); return c && typeof c.picture === 'string' ? c.picture : ''; }, since: HG.optionOf(b, 'period') === 'year' ? HomeStats.yearStart(now) : null }).slice(0, n('count')); }
      else if (key === 'service') { // (the cars that need servicing: no races needed)
        const due = CarStats.dueList({ cars, name: c => titleOf('slotcars', c), picture: c => (typeof c.picture === 'string' ? c.picture : ''), soon: HG.optionOf(b, 'show') === 'due' ? 0 : n('within') });
        d.service = due.slice(0, n('count')); d.serviceTotal = due.length; d.serviceSet = cars.filter(c => CarStats.intervalOf(c) > 0).length;
      }
      else if (key === 'bests') {
        const grid2 = []; rows.forEach((r, i) => { if (r.absent) return; (byTeam ? membersOf(teamOf(r.teamId)).map(m => m.id) : [r.driverId]).forEach(id => grid2.push({ driverId: id, color: laneHue(i) })); });
        d.bests = HomeStats.gridBests({ laps, trackId: track && track.id, grid: grid2, driverName: dn });
      } else if (key === 'rules') {
        d.rules = HomeStats.rules(rawSetup, { typeLabel, distUnit: Speed.distUnitOf(state.settings), rotation: rotRec ? rotRec.name || '' : '', penalty: nameIn(lists.penaltysystems, setup && setup.penaltySystem), damage: nameIn(lists.damagesystems, setup && setup.damageSystem), fuel: nameIn(lists.fuelrules, setup && setup.fuelRules), weather: nameIn(lists.weathersystems, setup && setup.weather), safetyCar: nameIn(lists.safetycarsystems, setup && setup.safetyCar), pushSave: nameIn(lists.pushsavesystems, setup && setup.pushSave), tyreWear: nameIn(lists.tyrewearsystems, setup && setup.tyreWear), tyreWearHere: ((lists.tyrewearsystems || []).find(x => setup && x.id === setup.tyreWear) || {})[setup && setup.sessionType] === 'on' });
      }
      out.set(key, HomeCards.html(key, d, b));
    });
    if (!last) { const first = others.find(b => HomeCards.NEEDS_RACES.includes(HG.cardOf(b))); if (first) out.set(HG.cardOf(first), HomeCards.empty()); } // (the first of them says what will show up)
    return out;
  };
  let allLaps;
  try { homeLaps = homeLaps || Promise.resolve(api.list('laps')); allLaps = await homeLaps; } catch (x) { homeLaps = null; allLaps = []; }
  const lists = {};
  if (wants('rules') && setup) await Promise.all(['penaltysystems', 'damagesystems', 'fuelrules', 'weathersystems', 'tyrewearsystems', 'safetycarsystems', 'pushsavesystems'].map(async e => { try { lists[e] = await api.list(e); } catch (x) { lists[e] = []; } }));
  if (run !== homeRun) return; // (another picture of Home was drawn while the laps came in)
  cardsHtml(Array.isArray(allLaps) ? allLaps : [], lists).forEach((html, key) => { const el = document.getElementById('hmc-' + key); if (el) el.innerHTML = html; });
  if (state.settings.netOn && api.netStatus) { // a network that was switched on but could not start gets a red light
    try { const st = await api.netStatus(); if (run === homeRun && st && st.error) { netError = st.error; setChips({ netError }); } } catch (x) { /* the chip stays as the setting says */ }
  }
}
