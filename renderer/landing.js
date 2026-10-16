// Home / landing page: pick a race setup, assign drivers and cars to its lanes, start the race.
const optionsOf = (entity, list, chosen, blank = '(choose)') =>
  `<option value="">${esc(blank)}</option>` + list.map(i => `<option value="${esc(i.id)}"${i.id === chosen ? ' selected' : ''}>${esc(titleOf(entity, i))}</option>`).join('');

// 1.17.0: the cards on the right of the Home tab need every saved lap. The laps are fetched once and kept while you stay on the Home tab (a change on Home does not fetch them again);
// app.js forgets them (resetHome) whenever another tab was shown, because a race may have been saved or a record removed since. homeRun numbers the pictures, so a late answer never lands in a newer one.
let homeLaps = null, homeRun = 0, homeOffTm = null;
function resetHome() { homeLaps = null; }

async function renderHome() {
  const [drivers, cars, tracks, setups, sessions, rotations, teams, layouts, audiosets] = await Promise.all(['drivers', 'slotcars', 'tracks', 'racesetups', 'sessions', 'rotationsetups', 'teams', 'layouts', 'audiosets'].map(e => api.list(e)));
  const saved = state.settings;
  const resume = api.getResume && !(typeof raceActive === 'function' && raceActive()) ? await api.getResume().catch(() => null) : null; // (1.9.0: a race that was interrupted by a crash or a power cut, kept in a file)
  const setupId = setups.some(x => x.id === saved.lastSetupId) ? saved.lastSetupId : (setups[0]?.id || '');
  const rawSetup = setups.find(x => x.id === setupId);
  const setup = Endurance.effective(rawSetup); // (1.9.0: an Endurance Race is a race, a timed race or heats, with the rules of the swaps in setup.endurance)
  const track = setup && tracks.find(t => t.id === setup.track);
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
  const issues = [];
  if (setup) {
    if (!track) issues.push('This race setup has no track. Choose one in Race Setup.');
    else if (!lanes) issues.push('The track has no number of lanes. Add it in the Database.');
    const label = i => heats ? (byTeam ? 'Team ' : 'Participant ') + (i + 1) : 'Lane ' + (i + 1);
    rotProblems.forEach(t => issues.push(t));
    if (byTeam) rows.forEach((r, i) => {
      if (rot && r.absent) return;
      if (!r.teamId || !r.carId) issues.push(label(i) + ' needs a team and a car.');
      else if (!membersOf(teamOf(r.teamId)).length) issues.push(`The team ${titleOf('teams', teamOf(r.teamId))} has no drivers. Add them in Database > Teams.`);
      else if (endu && membersOf(teamOf(r.teamId)).length < 2) issues.push(`The team ${titleOf('teams', teamOf(r.teamId))} has one driver only: an Endurance Race needs a team of two drivers or more. Add drivers in Database > Teams.`);
    });
    else if (enduSingle) {
      rows.forEach((r, i) => {
        if (!r.teamId || !r.carId) issues.push(label(i) + ' needs a team and a car.');
        else if (membersOf(teamOf(r.teamId)).length < 2) issues.push(`The team ${titleOf('teams', teamOf(r.teamId))} has ${membersOf(teamOf(r.teamId)).length ? 'one driver only' : 'no drivers'}: an Endurance Race needs a team of two drivers or more. Add drivers in Database > Teams.`);
      });
      const st = rows.map(r => r.driverId).filter(Boolean); if (st.length !== new Set(st).size) issues.push('A driver starts for two teams. Choose another starting driver.');
    }
    else if (!tokens) rows.forEach((r, i) => { if (!(rot && r.absent) && (!r.driverId || !r.carId)) issues.push(label(i) + ' needs a driver and a car.'); });
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
        else notes.push(`Seeded by the latest qualifying on this track${q.date ? ' (' + String(q.date).slice(0, 10) + ')' : ''}${ranks.some(x => x === null) ? '; drivers who did not take part are placed last' : ''}.`);
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
      ${[...Heats.summary({ stats: st, setup, names: heatPlan.names, custom: heatPlan.rotation }), ...heatPlan.notes].map(t => `<p class="hint2${/do not race the same|not shared evenly/.test(t) ? ' hpwarn' : ''}">${esc(t)}</p>`).join('')}
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
  const away = r => !!rot && r.absent === true; // (not here today: the places of this participant in the rotation stay empty)
  // a row: the team (only in a session with teams: the team is the participant, or the team of an Endurance Race), the driver (the drivers of the team when there is one) and the car
  const teamSelect = (r, i) => `<select data-k="teamId" aria-label="Team for ${byTeam ? 'participant' : 'row'} ${i + 1}"${away(r) ? ' disabled' : ''}>${optionsOf('teams', teams, r.teamId, '(choose a team)')}</select>`;
  const driverList = r => { // the drivers a row can have: the members of its team, and the driver it has now (a stand-in who is not in the team stays visible)
    const t = r.teamId ? teamOf(r.teamId) : null; if (!t) return drivers;
    const m = membersOf(t), cur = drivers.find(d => d.id === r.driverId);
    return cur && !m.includes(cur) ? [...m, cur] : m;
  };
  const rowHtml = (r, i) => `<div class="lane${rot ? ' rot' : ''}${away(r) ? ' away' : ''}${byTeam ? ' byteam' : ''}${withTeam && !byTeam ? ' threesel' : ''}" data-row="${i}" style="--c:${esc(laneHue(i))}">
      <strong>${heats ? (byTeam ? 'Team ' : 'Participant ') : 'Lane '}${i + 1}${rot && rot.names[i] ? ' · ' + esc(rot.names[i]) : ''}</strong>
      ${byTeam ? teamSelect(r, i) : `${withTeam ? teamSelect(r, i) : ''}<select data-k="driverId" aria-label="${enduSingle ? 'Starting driver' : 'Driver'} for row ${i + 1}"${away(r) ? ' disabled' : ''}>${optionsOf('drivers', enduSingle && !r.teamId ? [] : driverList(r), r.driverId, tokens ? 'Guest (no driver)' : enduSingle ? (setup.endurance.next === 'random' ? '(starting driver: by lot)' : '(starting driver: the first of the team)') : undefined)}</select>`}
      <select data-k="carId" aria-label="Car for row ${i + 1}"${away(r) ? ' disabled' : ''}>${optionsOf('slotcars', cars, r.carId, tokens ? '(no car)' : undefined)}</select>
      ${rot ? `<label class="lane-away"><input type="checkbox" data-absent="${i}"${away(r) ? ' checked' : ''} aria-label="${byTeam ? 'Team' : 'Participant'} ${i + 1} is not here today"> Not here today</label>` : ''}
      ${heats && (rot ? rows.length > rot.participants : rows.length > 2) ? `<button class="btn" data-remove="${i}">Remove</button>` : '<span></span>'}
      ${withTeam && r.teamId ? `<span class="muted teamline">${membersOf(teamOf(r.teamId)).length ? 'Drivers: ' + esc(membersOf(teamOf(r.teamId)).map(d => titleOf('drivers', d)).join(', ')) : 'This team has no drivers yet.'}</span>` : ''}</div>`;
  const rotHtml = !rot ? '' : `<p class="hint2">Rotation setup <strong>${esc(rot.name)}</strong>: ${esc(Rot.describe(rot))}. Tick "Not here today" for ${byTeam ? 'every team' : 'anybody'} that does not come: their places stay empty. ${rot.names.some(x => x.trim()) ? `<button class="btn" id="rotnames" title="Choose the ${byTeam ? 'team' : 'driver'} whose name is the name of a participant in the rotation (only for participants who have no ${byTeam ? 'team' : 'driver'} yet)">${byTeam ? 'Pick the teams by name' : 'Pick the drivers by name'}</button>` : ''}</p>
      ${state.rotMsg && state.rotMsg.setupId === setupId ? `<p class="hint2" role="status">${esc(state.rotMsg.text)}</p>` : ''}`;

  const resumeHtml = !resume || !resume.race ? '' : `<section class="card resumecard" id="resumecard"><h3>A race was interrupted</h3>
      <p><strong>${esc(resume.name || '')}</strong>${resume.kind ? ' · ' + esc(resume.kind) : ''}${resume.trackName ? ' on ' + esc(resume.trackName) : ''}. It was ${resume.where ? esc(resume.where) : esc(Endurance.clock(Number(resume.elapsed) || 0)) + ' into the race'} when it was saved (${esc(resume.savedAt ? new Date(resume.savedAt).toLocaleString() : '')}).</p>
      <div class="row"><button class="btn primary" id="resumego">Resume the race</button><button class="btn" id="resumesave">Save what was recorded</button><button class="btn danger" id="resumedrop">Delete it</button></div>
      <p class="hint2">The race comes back paused, with its clock where it was. The laps driven since then are not in it (the review can add them), and the lap that was being driven is left out of the records. Press Space to carry on.${resume.heat ? ' The heats that were done are kept.' : ''}</p></section>`;
  // 1.17.0: the welcome band (date, track and status chips), the start card with its coloured lanes and start lights, and the cards on the right
  const audio = setup && (audiosets || []).find(x => x.id === setup.audioSet), audioName = audio ? audio.name || '(unnamed)' : '';
  const chipsNow = more => HomeStats.chips({ trackmate: typeof Trackmate !== 'undefined' && !!Trackmate.link.connected, netOn: !!state.settings.netOn, netError: more && more.netError, hasSetup: !!setup, audioName, drivers: drivers.length, cars: cars.length, tracks: tracks.length });
  const chipHtml = c => `<span class="hm-chip" data-key="${c.key}"${c.state ? ` data-state="${c.state}"` : ''}>${c.state ? '<i aria-hidden="true"></i>' : ''}${esc(c.text)}</span>`;
  const today = new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
  const lt = HomeStats.lights(rows, { byTeam, enduSingle, tokens }, heats ? (byTeam ? 'team' : 'participant') : 'lane', issues.length > 0), shown = rows.map((r, i) => ({ r, i })).filter(x => !x.r.absent);
  const lightsHtml = setup && track && lanes && rows.length ? `<div class="hm-lights" aria-hidden="true">${shown.map((x, k) => `<i${lt.ok[k] ? ' class="on"' : ''} style="--c:${esc(laneHue(x.i))}"></i>`).join('')}</div><span class="muted hm-ready" role="status">${esc(lt.text)}</span>` : '';
  view.innerHTML = `${homeHeaderHtml(state.settings)}
    <div class="hm-band"><div class="hm-flag" aria-hidden="true"></div><h2>${esc(welcomeOf())}</h2>
      <p class="hm-sub">${esc(today)}${track ? ' · ' + esc(track.name) : ''}</p>
      <div class="hm-chips" id="hm-chips">${chipsNow().map(chipHtml).join('')}</div></div>
    ${resumeHtml}
    <div class="hm-cols"><section class="card hm-start"><h3>Start a race</h3>` + (setups.length ? `
      <div class="field"><label for="setup">Race setup</label>
        <select id="setup">${setups.map(s => `<option value="${esc(s.id)}"${s.id === setupId ? ' selected' : ''}>${esc(s.name || '(unnamed)')}</option>`).join('')}</select></div>
      <p class="hint2">${esc(typeLabel)}${track ? ' on ' + esc(track.name) + (lanes ? ` (${lanes} lanes)` : '') : ''}</p>
      ${qual && lanes > 1 ? `<p class="hint2">🏁 ${esc(qual.name)} won the latest qualifying on this track and picks a lane first. ${winRow >= 0
        ? `Starting lane: <select id="winlane" aria-label="Starting lane for ${esc(qual.name)}">${Array.from({ length: lanes }, (_, i) => `<option value="${i}"${i === winRow ? ' selected' : ''}>Lane ${i + 1}</option>`).join('')}</select>`
        : 'Assign them below, then choose their lane here.'} <button class="btn" id="clearqual">Clear qualifying result</button></p>` : ''}
      ${rotHtml}
      ${track && lanes ? rows.map(rowHtml).join('') : ''}
      ${heats && track && !rot ? `<button class="btn" id="addrow">${byTeam ? 'Add team' : 'Add participant'}</button>` : ''}
      ${heatPlanHtml}
      ${tokens ? '<p class="hint2">A Time Token Session starts with every lane switched off. You add paid time to a lane on the race screen, and can change the driver there too. Here you can already put a driver and a car on a lane.</p>' : ''}
      ${raceOn ? '<p class="hint2" id="raceon">A race is running. <button class="btn" id="gorace">Go to the race</button></p>' : ''}
      ${issues.length ? `<ul class="issues">${issues.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      <div class="hm-go">${lightsHtml}<span class="hm-grow"></span><button class="btn primary big" id="start" ${issues.length || raceOn ? 'disabled' : ''}${raceOn ? ' title="A race is still running. Open the Race tab to finish or stop it first."' : ''}>${tokens ? 'Open the session' : 'Start race'}</button></div>`
      : '<p class="muted">Create a race setup in the Race Setup tab to get started.</p>') + `</section><div class="hm-side" id="homeside"></div></div>`;

  const persist = async () => {
    state.settings = await api.setSettings({ lastSetupId: setupId, assignments: { ...(saved.assignments || {}), [setupId]: rows } });
    renderHome();
  };
  view.onchange = ev => {
    state.rotMsg = null;
    if (ev.target.id === 'winlane') { const to = Number(ev.target.value); [rows[winRow], rows[to]] = [rows[to], rows[winRow]]; persist(); return; }
    if (ev.target.id === 'setup') { api.setSettings({ lastSetupId: ev.target.value }).then(s => { state.settings = s; renderHome(); }); return; }
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
      state.race = { setup: resume.race.setup, track: resume.race.track, rows: resume.race.rows, ...(resume.race.byTeam ? { byTeam: true } : {}), ...(resume.race.schedule ? { schedule: resume.race.schedule, ...(resume.race.labels ? { labels: resume.race.labels } : {}) } : {}), resume: b.id === 'resumesave' ? { ...resume, stopNow: true } : resume }; state.tab = 'race'; render(); return;
    }
    if (b.id === 'resumedrop') {
      if (typeof confirm === 'function' && !confirm('Delete the race that was interrupted? What it recorded is lost.')) return;
      Promise.resolve(api.clearResume()).then(() => renderHome()); return;
    }
    if (b.id === 'start') {
      if (typeof raceActive === 'function' && raceActive()) return; // (one race at a time: the one that is running is on the Race tab)
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
      state.race = { setup: rawSetup, track, rows: go, ...(byTeam ? { byTeam: true } : {}), ...(heatPlan ? { schedule: heatPlan.schedule, ...(heatPlan.labels ? { labels: heatPlan.labels } : {}) } : {}) }; state.tab = 'race'; render(); // (a heat race is raced as planned above; with a rotation, only the participants who are here race)
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

  // ---- the cards on the right: the record to beat, the last race and the totals (they need every saved lap, so they come when the laps are in) ----
  const dateText = iso => { const d = iso ? new Date(iso) : null; return d && !isNaN(d) ? d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : ''; };
  const dn = id => { const d = drivers.find(x => x.id === id); return d ? titleOf('drivers', d) : ''; }, cn = id => { const c = cars.find(x => x.id === id); return c ? titleOf('slotcars', c) : ''; };
  const sideHtml = laps => {
    const last = HomeStats.lastRace({ sessions, laps, driverName: dn });
    if (!last) return `<section class="card hm-empty"><h3>Your racing shows up here</h3><p class="muted">After the first race that is saved, this place shows the record to beat on your track, the podium of the last race and your totals.</p></section>`;
    const g = HomeStats.glance({ sessions, laps, tracks, driverName: dn });
    const rec = track ? HomeStats.recordCard({ laps, sessions, trackId: track.id, driverIds: byTeam ? [] : rows.filter(r => !r.absent).map(r => r.driverId), driverName: dn, carName: cn }) : null;
    const recHtml = !rec ? '' : `<section class="card hm-rec"><h3>Record to beat<span class="hm-tag">${esc(track.name)}</span></h3>${rec.record
      ? `<div class="hm-recrow"><div class="hm-time">${esc(rec.record.text)}</div><div><strong>${esc(rec.record.driver)}</strong>${rec.record.car ? ' · ' + esc(rec.record.car) : ''}<small>${esc([dateText(rec.record.date), rec.record.setupName].filter(Boolean).join(' · '))}</small></div></div>${rec.line ? `<p class="hint2">${esc(rec.line)}</p>` : ''}`
      : '<p class="muted">No lap has been saved on this track yet. The first lap sets the record.</p>'}</section>`;
    const lastHtml = `<section class="card hm-last"><h3>${esc(last.label)}<span class="hm-tag">${esc(dateText(last.date))}</span></h3>${last.podium.length
      ? `<ol class="hm-pod">${last.podium.map(p => `<li class="p${p.pos}"><span class="n">${p.pos}</span><strong>${esc(p.name)}</strong><small>${esc(p.detail)}</small></li>`).join('')}</ol>` : '<p class="muted">No car finished a lap.</p>'}
      <p class="hint2">${esc(last.setupName)}${last.trackName ? ' on ' + esc(last.trackName) : ''}${last.fastest ? ` · Fastest lap: ${esc(last.fastest.driver ? last.fastest.driver + ', ' : '')}${esc(last.fastest.text)}` : ''}</p></section>`;
    const glanceHtml = `<section class="card hm-glance"><h3>At a glance</h3><div class="hm-tiles">
      <div class="hm-tile"><div class="v">${g.races}</div><div class="l">${g.races === 1 ? 'race' : 'races'} raced</div></div>
      <div class="hm-tile"><div class="v">${esc(g.laps.toLocaleString())}</div><div class="l">${g.laps === 1 ? 'lap' : 'laps'} driven</div></div>
      <div class="hm-tile"><div class="v">${g.distance === null ? '–' : esc(Stats.fmtDist(g.distance))}</div><div class="l">distance</div></div>
      <div class="hm-tile"><div class="v">${g.wins ? esc(g.wins.name) : '–'}</div><div class="l">${g.wins ? `most wins (${g.wins.count})` : 'most wins'}</div></div></div></section>`;
    return recHtml + lastHtml + glanceHtml;
  };
  let allLaps;
  try { homeLaps = homeLaps || Promise.resolve(api.list('laps')); allLaps = await homeLaps; } catch (x) { homeLaps = null; allLaps = []; }
  if (run !== homeRun) return; // (another picture of Home was drawn while the laps came in)
  const side = document.getElementById('homeside');
  if (side) side.innerHTML = sideHtml(Array.isArray(allLaps) ? allLaps : []);
  if (state.settings.netOn && api.netStatus) { // a network that was switched on but could not start gets a red light
    try { const st = await api.netStatus(); if (run === homeRun && st && st.error) { netError = st.error; setChips({ netError }); } } catch (x) { /* the chip stays as the setting says */ }
  }
}
