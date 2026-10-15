// Home / landing page: pick a race setup, assign drivers and cars to its lanes, start the race.
const optionsOf = (entity, list, chosen, blank = '(choose)') =>
  `<option value="">${esc(blank)}</option>` + list.map(i => `<option value="${esc(i.id)}"${i.id === chosen ? ' selected' : ''}>${esc(titleOf(entity, i))}</option>`).join('');

async function renderHome() {
  const [drivers, cars, tracks, setups, sessions, rotations] = await Promise.all(['drivers', 'slotcars', 'tracks', 'racesetups', 'sessions', 'rotationsetups'].map(e => api.list(e)));
  const saved = state.settings;
  const setupId = setups.some(x => x.id === saved.lastSetupId) ? saved.lastSetupId : (setups[0]?.id || '');
  const setup = setups.find(x => x.id === setupId);
  const track = setup && tracks.find(t => t.id === setup.track);
  const heats = setup?.sessionType === 'heats', tokens = setup?.sessionType === 'tokens'; // (a Time Token Session: the driver and car of a lane are optional, a lane without a driver is a Guest)
  const lanes = Math.max(0, Math.floor(Number(track?.lanes)) || 0);
  const known = (list, id) => list.some(x => x.id === id) ? id : '';

  // saved assignments for this setup, cleaned of anything that has since been deleted
  let rows = ((saved.assignments || {})[setupId] || []).map(r => ({ driverId: known(drivers, r.driverId), carId: known(cars, r.carId), ...(r.absent === true ? { absent: true } : {}) }));
  // a rotation setup (1.6.0) says how many participants there are: the rows follow it (rows that are too many stay, so that you choose which one goes)
  const rotRec = heats && setup.rotation ? rotations.find(x => x.id === setup.rotation) : null, rot = rotRec ? Rot.clean(rotRec) : null;
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
    const label = i => heats ? 'Participant ' + (i + 1) : 'Lane ' + (i + 1);
    rotProblems.forEach(t => issues.push(t));
    if (!tokens) rows.forEach((r, i) => { if (!(rot && r.absent) && (!r.driverId || !r.carId)) issues.push(label(i) + ' needs a driver and a car.'); });
    const dup = key => { const ids = here.map(r => r[key]).filter(Boolean); return ids.length !== new Set(ids).size; };
    if (dup('driverId')) issues.push('A driver is used more than once.');
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
    const names = sf.keep.map(p => { const d = drivers.find(x => x.id === rows[p].driverId); return d ? titleOf('drivers', d) : Rot.nameOf(rot, p); });
    heatPlan = { seed: 0, key, edited, schedule, names, notes, count, labels: sf.labels, rotation: true, stats: Heats.stats(schedule, count, lanes) };
  } else if (heats && track && lanes && !rot && rows.length >= 2) {
    const seeds = { ...(saved.heatSeeds || {}) };
    let seed = seeds[setupId];
    if (!Number.isInteger(seed) || seed < 1) { seed = Heats.newSeed(); seeds[setupId] = seed; saved.heatSeeds = seeds; api.setSettings({ heatSeeds: seeds }).then(s => { state.settings = s; }); } // (kept, so the plan is the same next time as well)
    // the latest qualifying on this track, when the setup wants the heats seeded by it (only the plans that choose who races together)
    let ranks = null; const notes = [], ho = Heats.optionsOf(setup);
    if (ho.seeding !== 'random' && (ho.plan === 'manual' || ho.plan === 'perdriver')) {
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
    const names = rows.map((r, i) => { const d = drivers.find(x => x.id === r.driverId); return d ? titleOf('drivers', d) : 'Participant ' + (i + 1); });
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

  const typeLabel = setup ? (state.schema.racesetups.fields.find(f => f.key === 'sessionType').options.find(o => o[0] === setup.sessionType) || [, ''])[1] : '';
  const away = r => !!rot && r.absent === true; // (not here today: the places of this participant in the rotation stay empty)
  const rowHtml = (r, i) => `<div class="lane${rot ? ' rot' : ''}${away(r) ? ' away' : ''}" data-row="${i}">
      <strong>${heats ? 'Participant ' : 'Lane '}${i + 1}${rot && rot.names[i] ? ' · ' + esc(rot.names[i]) : ''}</strong>
      <select data-k="driverId" aria-label="Driver for row ${i + 1}"${away(r) ? ' disabled' : ''}>${optionsOf('drivers', drivers, r.driverId, tokens ? 'Guest (no driver)' : undefined)}</select>
      <select data-k="carId" aria-label="Car for row ${i + 1}"${away(r) ? ' disabled' : ''}>${optionsOf('slotcars', cars, r.carId, tokens ? '(no car)' : undefined)}</select>
      ${rot ? `<label class="lane-away"><input type="checkbox" data-absent="${i}"${away(r) ? ' checked' : ''} aria-label="Participant ${i + 1} is not here today"> Not here today</label>` : ''}
      ${heats && (rot ? rows.length > rot.participants : rows.length > 2) ? `<button class="btn" data-remove="${i}">Remove</button>` : '<span></span>'}</div>`;
  const rotHtml = !rot ? '' : `<p class="hint2">Rotation setup <strong>${esc(rot.name)}</strong>: ${esc(Rot.describe(rot))}. Tick "Not here today" for anybody who does not come: their places stay empty. ${rot.names.some(x => x.trim()) ? '<button class="btn" id="rotnames" title="Choose the driver whose name is the name of a participant in the rotation (only for participants who have no driver yet)">Pick the drivers by name</button>' : ''}</p>
      ${state.rotMsg && state.rotMsg.setupId === setupId ? `<p class="hint2" role="status">${esc(state.rotMsg.text)}</p>` : ''}`;

  // drivers and slotcars: the 5 used last (then the rest in list order) and a button to the database for the full list
  const recent = (state.settings.recent || {});
  const lastUsed = (list, ids) => { const order = (ids || []).map(id => list.find(i => i.id === id)).filter(Boolean); return [...order, ...list.filter(i => !order.includes(i))]; };
  const card = (label, entity, list, more) => { const shown = more ? lastUsed(list, recent[more.key]).slice(0, 5) : list;
    return `<section class="card"><h3>${label}<span class="count">${list.length}</span></h3>` +
    (list.length ? `<ul>${shown.map(i => `<li>${esc(titleOf(entity, i))}</li>`).join('')}</ul>` : '<span class="muted">None yet.</span>') +
    (more && list.length > shown.length ? `<button class="btn" data-more="${more.sub}">Show all ${list.length} in the database</button>` : '') + '</section>'; };

  view.innerHTML = `${homeHeaderHtml(state.settings)}
    <h2>${esc(welcomeOf())}</h2>
    <section class="card"><h3>Start a race</h3>` + (setups.length ? `
      <div class="field"><label for="setup">Race setup</label>
        <select id="setup">${setups.map(s => `<option value="${esc(s.id)}"${s.id === setupId ? ' selected' : ''}>${esc(s.name || '(unnamed)')}</option>`).join('')}</select></div>
      <p class="hint2">${esc(typeLabel)}${track ? ' on ' + esc(track.name) + (lanes ? ` (${lanes} lanes)` : '') : ''}</p>
      ${qual && lanes > 1 ? `<p class="hint2">🏁 ${esc(qual.name)} won the latest qualifying on this track and picks a lane first. ${winRow >= 0
        ? `Starting lane: <select id="winlane" aria-label="Starting lane for ${esc(qual.name)}">${Array.from({ length: lanes }, (_, i) => `<option value="${i}"${i === winRow ? ' selected' : ''}>Lane ${i + 1}</option>`).join('')}</select>`
        : 'Assign them below, then choose their lane here.'} <button class="btn" id="clearqual">Clear qualifying result</button></p>` : ''}
      ${rotHtml}
      ${track && lanes ? rows.map(rowHtml).join('') : ''}
      ${heats && track && !rot ? '<button class="btn" id="addrow">Add participant</button>' : ''}
      ${heatPlanHtml}
      ${tokens ? '<p class="hint2">A Time Token Session starts with every lane switched off. You add paid time to a lane on the race screen, and can change the driver there too. Here you can already put a driver and a car on a lane.</p>' : ''}
      ${raceOn ? '<p class="hint2" id="raceon">A race is running. <button class="btn" id="gorace">Go to the race</button></p>' : ''}
      ${issues.length ? `<ul class="issues">${issues.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      <div class="row"><button class="btn primary" id="start" ${issues.length || raceOn ? 'disabled' : ''}${raceOn ? ' title="A race is still running. Open the Race tab to finish or stop it first."' : ''}>${tokens ? 'Open the session' : 'Start race'}</button></div>`
      : '<p class="muted">Create a race setup in the Race Setup tab to get started.</p>') + `</section>
    <h4>Available</h4>
    <div class="grid">${card('Drivers', 'drivers', drivers, { key: 'drivers', sub: 'drivers' })}${card('Slot cars', 'slotcars', cars, { key: 'cars', sub: 'slotcars' })}${card('Tracks', 'tracks', tracks)}${card('Race setups', 'racesetups', setups)}</div>`;

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
    if (row && ev.target.dataset.k) { rows[Number(row.dataset.row)][ev.target.dataset.k] = ev.target.value; persist(); }
  };
  view.onclick = ev => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.id === 'clearqual' && qual) { api.setSettings({ qualCleared: { ...(saved.qualCleared || {}), [track.id]: qual.id } }).then(s => { state.settings = s; renderHome(); }); return; }
    if (b.id === 'addrow') { rows.push({ driverId: '', carId: '' }); persist(); }
    if (b.id === 'rotnames' && rot) { // the drivers whose names are the names of the participants (only participants who have no driver yet)
      const m = Rot.matchDrivers(rot, drivers, d => [titleOf('drivers', d), d.name]), taken = new Set(rows.map(r => r.driverId).filter(Boolean)); let n = 0;
      m.picks.forEach((id, i) => { if (id && rows[i] && !rows[i].driverId && !taken.has(id)) { rows[i].driverId = id; taken.add(id); n++; } });
      const said = [n ? `Picked ${n} ${n === 1 ? 'driver' : 'drivers'} by name.` : 'No driver was picked by name.'];
      if (m.missing.length) said.push(`No driver is called ${m.missing.join(', ')}.`);
      if (m.ambiguous.length) said.push(`More than one driver is called ${m.ambiguous.join(', ')}.`);
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
    if (b.dataset.more) { state.sub = b.dataset.more; state.tab = 'database'; render(); return; }
    if (b.id === 'gorace') { state.tab = 'race'; render(); return; }
    if (b.id === 'start') {
      if (typeof raceActive === 'function' && raceActive()) return; // (one race at a time: the one that is running is on the Race tab)
      const front = (old, ids) => [...ids.filter(Boolean), ...(old || []).filter(x => !ids.includes(x))].slice(0, 20); // remember what was used last
      api.setSettings({ recent: { drivers: front(recent.drivers, rows.map(r => r.driverId)), cars: front(recent.cars, rows.map(r => r.carId)) } }).then(s => { state.settings = s; });
      state.race = { setup, track, rows: rot ? here : rows, ...(heatPlan ? { schedule: heatPlan.schedule, ...(heatPlan.labels ? { labels: heatPlan.labels } : {}) } : {}) }; state.tab = 'race'; render(); // (a heat race is raced as planned above; with a rotation, only the participants who are here race)
    }
  };
}
