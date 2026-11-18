// Home / landing page: pick a race setup, assign drivers and cars to its lanes, start the race.
const optionsOf = (entity, list, chosen, blank = '(choose)') =>
  `<option value="">${esc(blank)}</option>` +
  list
    .filter(i => entity !== 'slotcars' || !i.paddock?.archived || i.id === chosen)
    .map(
      i =>
        `<option value="${esc(i.id)}"${i.id === chosen ? ' selected' : ''}${entity === 'slotcars' && i.paddock?.archived ? ' disabled' : ''}>${esc(titleOf(entity, i))}${entity === 'slotcars' && i.paddock && !i._sameComputerLibrary ? (i.paddock.archived ? ' · unavailable' : ' · Paddock') : ''}</option>`
    )
    .join('');

// Current adapters return card statistics without sending lap history to Home.
// homeLaps remains the compatibility cache for older adapters/tests without that API.
// homeRun prevents late statistics or pictures from painting over a newer draw.
let homeLaps = null,
  homeRun = 0,
  homeOffTm = null,
  homeOffAb = null,
  homeOffPp = null,
  homeOffPt = null,
  homeOffDs = null,
  homeDraw = 0; // (homeDraw numbers the drawings of Home: the one that is slow does not paint over another tab, or over a newer Home)
// 1.26.0: a line of text or a number in Customize is saved when you leave the field. Home is drawn again a moment later (HOME_SOFT_MS), so that a click or a Tab that comes next
// is not lost to a page that changes under it, and the control that has the cursor then keeps it. While you are typing in a field (an input without its change yet) nothing is drawn.
let HOME_SOFT_MS = 400;
const homeFocusId = t =>
  t && t.dataset && t.dataset.hopt && (t.type === 'text' || t.type === 'number' || t.type === 'textarea') ? t.id : ''; // (such a field of Customize: its id, else '')
const homeFieldId = t => (t && typeof t.id === 'string' && t.id.startsWith('hg-') ? t.id : ''); // (any control of the settings in Customize: the one that keeps the cursor when Home is drawn again)
// 2.4.0: how many lane cards stand side by side on Home: up to 3 lanes in one row, 4 and more in two rows (2×2, 3×2, 4×2), never more than 4 in a row.
// (A narrow Start a race card drops to 2 and then 1 column in styles.css.)
// (2.4.0) the most lanes on a row: up to 4 lanes all on one row, 5 or 6 in rows of 3, 7 or 8 in rows of 4 (less when the card is narrow: styles.css, Grid Slot)
const laneCols = n => (n <= 4 ? Math.max(1, n) : n <= 6 ? 3 : 4);

let homeChampAuto = '';
const homeAvatarCache = new Map(); // (2.4.0: the pictures of drivers in the lanes, by driver id: '' while it is read or when the driver has none) // (2.4.0: the session of a championship that Home loaded by itself last)

function homeSoftDraw() {
  // (the moment after a change in such a field)
  const c = state.homeCustom;
  if (state.tab === 'home' && !(c && c.typing)) renderHome();
}
let homeBackupFailed = false; // (2.3.0: the last automatic backup failed: the chip on Home)
let homeLibraryWaiting = 0; // (results waiting for the shared library, last known: the chip on Home)
function resetHome() {
  homeLaps = null;
}

// Starting a race while the timing hardware that was chosen is not connected: the person is told and asked (OK: start anyway with the keys or simulated cars, Cancel: go and connect it). true = go on.
async function timingReady(lanes) {
  const hw = Hardware.timingChosen(state.settings);
  // A connected interface that is not the one in use counts nothing: say so before the race, not after it
  const unused = typeof unusedTimingText === 'function' ? unusedTimingText(state.settings) : '';
  if (
    unused &&
    !(await Dialog.confirm(unused, {
      title: 'Timing hardware not in use',
      ok: hw === 'none' ? 'Start with the keys' : 'Start anyway',
      cancel: 'Do not start'
    }))
  )
    return false;
  if (hw === 'none') return true;
  if (hw === 'ds') {
    const ok = typeof DsTiming !== 'undefined' && DsTiming.link.connected && lanes <= DsTiming.lanes(DsTiming.link.model);
    if (!ok)
      await Dialog.alert(
        'Connect a DS-200 (up to 2 lanes) or DS-300 (up to 8 lanes) in App Settings first. Other DS models remain capture-only.',
        {
          title: 'DS Electronics not connected'
        }
      );
    return ok;
  }
  if (hw === 'plugin') {
    const ok = typeof pt !== 'undefined' && pt.link.connected && lanes <= pt.link.config.lanes;
    if (!ok)
      await Dialog.alert('Connect a timing plugin covering all race lanes in App Settings first, or choose None.', {
        title: 'Plugin interface not connected'
      });
    return ok;
  }
  if (
    hw === 'parallel' &&
    typeof ParallelPort !== 'undefined' &&
    ParallelPort.link.connected &&
    Number(lanes) > ParallelPort.link.config.lanes
  )
    return Dialog.confirm(
      `Parallel Port is configured for ${ParallelPort.link.config.lanes} lanes, but this race uses ${lanes}.\n\nStart anyway: the other lanes count with the keys or simulated cars.\nDo not start: adjust the lane sensors in App Settings, Timing Hardware.`,
      { title: 'Not enough lane sensors', ok: 'Start anyway', cancel: 'Do not start' }
    );
  const on =
    hw === 'parallel'
      ? typeof ParallelPort !== 'undefined' && !!ParallelPort.link.connected
      : hw === 'trackmate'
        ? typeof Trackmate !== 'undefined' && !!Trackmate.link.connected
        : typeof ArduinoBox !== 'undefined' && !!ArduinoBox.link.connected;
  if (on || unused) return true; // (with unused hardware connected the person was just asked, and chose to start anyway)
  const name =
    hw === 'parallel'
      ? 'The Parallel Port'
      : hw === 'trackmate'
        ? 'The Trackmate Interface'
        : state.settings.abVirtual === true
          ? 'The virtual Arduino Sketch'
          : 'The Arduino Sketch';
  return Dialog.confirm(
    `${name} is the timing hardware you chose, and it is not connected.\n\nStart anyway: laps can still be counted with the keys or simulated cars.\nDo not start: connect it first (App Settings, Timing Hardware).`,
    { title: 'Timing hardware not connected', ok: 'Start anyway', cancel: 'Do not start' }
  );
}
async function renderHome() {
  const draw = ++homeDraw;
  if (state.homeCustom) clearTimeout(state.homeCustom.timer); // (a drawing that was waiting is this one)
  const entities = [
    'drivers',
    'slotcars',
    'tracks',
    'racesetups',
    'sessions',
    'rotationsetups',
    'teams',
    'layouts',
    'audiosets',
    'imagesets',
    'championships'
  ];
  const readEntities = entities.filter(e => e !== 'sessions' || !api.homeSessions);
  const referenceGroups =
    typeof readReferenceGroups === 'function'
      ? await readReferenceGroups(readEntities)
      : await Promise.all(readEntities.map(async e => ({ items: await api.list(e), revision: null })));
  if (api.homeSessions) referenceGroups.splice(entities.indexOf('sessions'), 0, { items: [], revision: null });
  const [allDrivers, cars, tracks, setups, sessions, rotations, teams, layouts, audiosets, imagesets, champRaw] = referenceGroups.map(
    g => g.items
  );
  const referenceRevision = entity => referenceGroups[entities.indexOf(entity)]?.revision;
  const drivers = allDrivers.filter(d => d.driverType !== 'virtual');
  const isRival = row => VirtualRival.isDriver(row, allDrivers);
  const [multiProfiles, classDefs] = await Promise.all(['multiclasssystems', 'raceclasses'].map(e => api.list(e)));
  // Shared choices remain metadata only until selected; cache a signed racing profile before saving a local car ID.
  if (api.paddockCatalogue) {
    try {
      const shared = await api.paddockCatalogue(false);
      if (shared.connection?.mode === 'local') {
        for (const c of cars) if (c.paddock?.databaseId === shared.connection.databaseId) c._sameComputerLibrary = true;
        for (const c of shared.cars) {
          if (c.archived || cars.some(x => x.paddock?.databaseId === shared.connection.databaseId && x.paddock.carId === c.id)) continue;
          if (!shared.connected) continue;
          cars.push({
            id: 'shared:' + c.id,
            model: c.name,
            brand: c.maker || '',
            _sharedCar: c.id,
            _sameComputerLibrary: true,
            raceClass: classDefs.find(x => x.name.trim().toLocaleLowerCase() === (c.raceClass || '').trim().toLocaleLowerCase())?.id || '',
            paddock: { name: c.name, databaseId: shared.connection.databaseId, carId: c.id }
          });
        }
      }
    } catch {
      /* Local cars and captured configurations remain usable. */
    }
  }
  const rivalProfiles = await api.list('virtualrivalsystems');
  const champs = (Array.isArray(champRaw) ? champRaw : []).map(c => Champ.clean(c, true)); // (1.55.0: the championships; 1.56.1: one of them is chosen in the Start a race card, and only then its card shows, inside Start a race)
  const imageSets = Array.isArray(imagesets) ? imagesets : []; // (1.26.0: the picture sets of Customization > Image Settings, for the Weather and Tyres Available cards)
  const saved = state.settings;
  const grid = HomeGrid.gridOf(saved),
    hc = (state.homeCustom = state.homeCustom || { open: false, sel: 0 }); // (1.25.0: the cards are a grid; hc is the Customize panel: open or not, and the card whose settings show)
  hc.sel = Math.min(Math.max(Math.floor(Number(hc.sel)) || 0, 0), grid.boards.length - 1);
  if (draw !== homeDraw || state.tab !== 'home') return; // (another tab, or another drawing of Home, was asked for while the lists came in)
  const resume = api.getResume && !(typeof raceActive === 'function' && raceActive()) ? await api.getResume().catch(() => null) : null; // (1.9.0: a race that was interrupted by a crash or a power cut, kept in a file)
  if (draw !== homeDraw || state.tab !== 'home') return;
  // 2.3.0: a fresh install (no race setup yet) gets the setup guide instead, until it is finished or skipped
  if (
    typeof SetupWizard !== 'undefined' &&
    SetupWizard.shouldShow(saved, { setups: setups.length }) &&
    !(typeof raceActive === 'function' && raceActive())
  )
    return SetupWizard.render(view, { tracks, drivers, cars: cars.filter(c => !c._sharedCar) });
  const setupId = setups.some(x => x.id === saved.lastSetupId) ? saved.lastSetupId : setups[0]?.id || '';
  const rawSetup = setups.find(x => x.id === setupId);
  const setup = Endurance.effective(rawSetup); // (1.9.0: an Endurance Race is a race, a timed race or heats, with the rules of the swaps in setup.endurance)
  const ch = Champ.active(saved.champTag, champs, setups, tracks, setupId); // 1.55.0: a session of a championship that was loaded with its card: the race counts for it. It is the track of the round, else that of the race setup
  const track = setup && tracks.find(t => t.id === (ch && ch.track ? ch.track : setup.track));
  if (api.homeSessions) sessions.push(...(await api.homeSessions({ trackId: track?.id || '', champId: ch?.c?.id || saved.champId || '' })));
  if (draw !== homeDraw || state.tab !== 'home') return;
  const layout = (setup && (layouts || []).find(x => x.id === setup.layout)) || null,
    laneHue = i => HomeStats.laneColor(layout, i); // (the colour of a lane on the race screen, else one of eight)
  const heats = setup?.sessionType === 'heats',
    tokens = setup?.sessionType === 'tokens';
  const endu = !!(setup && setup.endurance),
    enduSingle = endu && !heats; // (an Endurance Race in one go: every lane is a team, with the driver who starts) // (a Time Token Session: the driver and car of a lane are optional, a lane without a driver is a Guest)
  const lanes = Math.max(0, Math.floor(Number(track?.lanes)) || 0);
  const known = (list, id) => (list.some(x => x.id === id) ? id : '');

  // saved assignments for this setup, cleaned of anything that has since been deleted
  let rows = ((saved.assignments || {})[setupId] || []).map(r => ({
    raceClass: known(classDefs, r.raceClass),
    driverId: known(allDrivers, r.driverId),
    carId: VirtualRival.isDriver(r, allDrivers) ? '' : known(cars, r.carId),
    rivalProfileId: typeof r.rivalProfileId === 'string' ? r.rivalProfileId : '',
    ...(known(teams, r.teamId) ? { teamId: r.teamId } : {}),
    ...(r.absent === true ? { absent: true } : {})
  }));
  // a rotation setup (1.6.0) says how many participants there are: the rows follow it (rows that are too many stay, so that you choose which one goes)
  const rotRec = heats && setup.rotation ? rotations.find(x => x.id === setup.rotation) : null,
    rot = rotRec ? Rot.clean(rotRec) : null;
  // 1.8.0: the participants of a heat race can be teams (a team and a car; the drivers of the team take turns in the heats). The rotation says so, or the race setup when there is no rotation.
  const byTeam = heats && (rot ? Rot.isTeams(rot) : setup.participants === 'teams');
  const withTeam = byTeam || enduSingle; // (the team is the participant: it has to be chosen)
  const allowRival = !tokens && !withTeam && !endu;
  const laneDrivers = allowRival ? allDrivers : drivers;
  if (!withTeam)
    rows.forEach(r => {
      delete r.teamId;
    }); // (1.10.1: a session without teams has no Team choice on Home, so a team that was chosen for it earlier is not used)
  const teamOf = id => teams.find(t => t.id === id) || null,
    membersOf = t => (t && Array.isArray(t.drivers) ? t.drivers : []).map(id => drivers.find(d => d.id === id)).filter(Boolean);
  const wanted = rot ? rot.participants : heats ? Math.max(rows.length, 2) : lanes;
  while (rows.length < wanted) rows.push({ driverId: '', carId: '' });
  rows = rows.slice(0, heats ? rows.length : lanes);

  // the winner of the latest qualifying on this track picks their lane first
  let qual = null;
  if (setup && track && (setup.sessionType === 'race' || setup.sessionType === 'timed')) {
    const q = sessions
      .filter(
        x =>
          x.sessionType === 'qualifying' &&
          x.trackId === track.id &&
          (!ch || (x.champ && x.champ.id === ch.c.id && x.champ.roundId === ch.tag.roundId && !x.champ.off))
      )
      .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    const w = q && q.standings && q.standings[0];
    const cleared = (saved.qualCleared || {})[track.id] === (q && q.id); // the Race Director cleared this one; a newer qualifying brings the winner back
    if (w && !cleared && drivers.some(d => d.id === w.driverId)) qual = { id: q.id, driverId: w.driverId, name: w.driverName };
  }
  const winRow = qual ? rows.findIndex(r => r.driverId === qual.driverId) : -1;

  // a rotation: who is not here today, and what stops it from being raced here (the number of participants, the lanes of the track)
  const absent = rot ? rows.map((r, i) => (r.absent ? i : -1)).filter(i => i >= 0) : [],
    here = rot ? rows.filter(r => !r.absent) : rows;
  const rotProblems = rot ? Rot.problems(rot, { rows: rows.length, trackLanes: lanes, here: here.length }) : [];

  const mc =
    !tokens && setup?.multiClass
      ? MultiClass.freeze(
          multiProfiles.find(p => p.id === setup.multiClass),
          classDefs
        )
      : null;
  const mcRows = rows.map(r => ({ ...r, raceClass: MultiClass.resolve(r, mc, { cars, drivers, teams }) }));
  const mcErrors =
    !tokens && setup?.multiClass && !mc
      ? ['The selected Multi-Class System is missing. Choose another in Race Setup.']
      : MultiClass.validate(mc, [], setup);
  const mcRowErrors = rows.map((r, i) =>
    !mc || r.absent || isRival(r)
      ? ''
      : ([...MultiClass.entryIssues(mc, [r], { cars, drivers, teams }), ...MultiClass.validate(mc, [mcRows[i]])][0] || '').replace(
          /^(Entry|Team) 1/,
          (heats ? (byTeam ? 'Team ' : 'Participant ') : 'Lane ') + (i + 1)
        )
  );
  const mcHtml = mc
    ? `<details class="mc-home"><summary>${esc(mc.name)} · Class assignments</summary><p class="muted">${mc.assignment === 'roster' ? 'Drivers are assigned in the Multi-Class setup. Only cars with matching Race Class labels can be selected.' : 'Defaults come from the ' + esc(mc.assignment) + '. Assignments lock when the event starts.'}</p></details>`
    : '';
  const classChoice = (r, i) =>
    !mc || r.absent || isRival(r)
      ? ''
      : mc.assignment === 'roster'
        ? `<span class="hs-class">Class: <b>${esc(mc.classes.find(c => c.id === mcRows[i].raceClass)?.name || 'Assign this driver in Multi-Class setup')}</b></span>`
        : `<label class="hs-class">Race class <select data-mc-entry="${i}" aria-label="Race class for entry ${i + 1}"><option value="">Database default${mcRows[i].raceClass ? ' · ' + esc(mc.classes.find(c => c.id === mcRows[i].raceClass)?.name || 'Unavailable') : ''}</option>${mc.classes.map(c => `<option value="${esc(c.id)}"${r.raceClass === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>`;

  const rivalSelection = allowRival ? VirtualRival.gridEntries(rows, allDrivers, rivalProfiles, track?.id) : { entries: [], errors: [] };
  const rivalFor = r => rivalSelection.entries.find(e => e.driverId === r.driverId);
  const rivalSelect = (r, i) => {
    const driver = allDrivers.find(d => d.id === r.driverId),
      linked = rivalProfiles.find(p => p.id === driver?.virtualRivalSystem);
    return sel2(
      'racesetups',
      `<select data-k="rivalProfileId" aria-label="Rival Setup for row ${i + 1}"${away(r) ? ' disabled' : ''}><option value="">${linked ? 'Driver default · ' + esc(linked.name) : 'Choose a Rival Setup'}</option>${rivalProfiles.map(p => `<option value="${esc(p.id)}"${r.rivalProfileId === p.id ? ' selected' : ''}>${esc(p.name)}${p.trackId !== track?.id ? ' · different track' : ''}</option>`).join('')}</select>`
    );
  };
  // what is still missing before the race can start
  const raceOn = typeof raceActive === 'function' && raceActive(); // a race is running (on the Race tab): another one can not be started
  const issues = [],
    rowMsgs = {}; // (1.58.0: what a row still needs is said in that row; it is in the list of issues too, so that Start stays off, but the list under the rows does not say it again)
  issues.push(...mcErrors);
  issues.push(...rivalSelection.errors);
  const rowMsg = (i, t) => {
    issues.push(t);
    rowMsgs[i] = t;
  };
  if (setup) {
    if (!track) issues.push('This race setup has no track. Choose one in Race Setup.');
    else if (!lanes) issues.push('The track has no number of lanes. Add it in the Database.');
    const distProblem = Distance.problem(setup, track, lanes);
    if (distProblem) issues.push(distProblem); // (1.35.0: a race by distance needs the length of the lanes)
    const swapProblem = Distance.swapProblem(setup, track, lanes);
    if (swapProblem && !/no length/.test(distProblem)) issues.push(swapProblem); // (1.35.1: so do driver swaps counted in distance)
    const label = i => (heats ? (byTeam ? 'Team ' : 'Participant ') + (i + 1) : 'Lane ' + (i + 1));
    rotProblems.forEach(t => issues.push(t));
    if (byTeam)
      rows.forEach((r, i) => {
        if (rot && r.absent) return;
        if (!r.teamId || !r.carId) rowMsg(i, label(i) + ' needs a team and a car.');
        else if (!membersOf(teamOf(r.teamId)).length)
          issues.push(`The team ${titleOf('teams', teamOf(r.teamId))} has no drivers. Add them in Database > Teams.`);
        else if (endu && membersOf(teamOf(r.teamId)).length < 2)
          issues.push(
            `The team ${titleOf('teams', teamOf(r.teamId))} has one driver only: an Endurance Race needs a team of two drivers or more. Add drivers in Database > Teams.`
          );
      });
    else if (enduSingle) {
      rows.forEach((r, i) => {
        if (!r.teamId || !r.carId) rowMsg(i, label(i) + ' needs a team and a car.');
        else if (membersOf(teamOf(r.teamId)).length < 2)
          issues.push(
            `The team ${titleOf('teams', teamOf(r.teamId))} has ${membersOf(teamOf(r.teamId)).length ? 'one driver only' : 'no drivers'}: an Endurance Race needs a team of two drivers or more. Add drivers in Database > Teams.`
          );
      });
      const st = rows.map(r => r.driverId).filter(Boolean);
      if (st.length !== new Set(st).size) issues.push('A driver starts for two teams. Choose another starting driver.');
    } else if (!tokens)
      rows.forEach((r, i) => {
        if (rot && r.absent) return;
        if (isRival(r)) {
          if (!rivalFor(r)) rowMsg(i, label(i) + ' needs a valid Rival Setup for this track.');
        } else if (!r.driverId || !r.carId) rowMsg(i, label(i) + ' needs a driver and a car.');
      });
    mcRowErrors.forEach((message, i) => {
      if (message && !rowMsgs[i]) rowMsg(i, message);
    });
    if (!allowRival && rows.some(isRival))
      issues.push('Virtual drivers are available in individual races, not team or Time Token sessions.');
    if (allowRival && !here.some(r => r.driverId && !isRival(r))) issues.push('Choose at least one human driver.');
    const dup = key => {
      const ids = here.map(r => r[key]).filter(Boolean);
      return ids.length !== new Set(ids).size;
    };
    if (withTeam) {
      if (dup('teamId')) issues.push('A team is used more than once.');
    } else if (dup('driverId')) issues.push('A driver is used more than once.');
    if (dup('carId')) issues.push('A car is used more than once.');
    if (rows.some(r => !isRival(r) && cars.find(c => c.id === r.carId)?.paddock?.archived))
      issues.push('A selected Paddock car is no longer available. Choose another car.');
  }

  // a heat-based race: the plan of the heats, made before the race so that it can be looked at (and shuffled again). The seed makes the shuffle repeatable: the plan shown here is the plan that is raced.
  let heatPlan = null;
  if (heats && track && lanes && rot && !rotProblems.length) {
    // a rotation: the heats are the ones you drew; the participants who are not here are left out
    const sf = Rot.scheduleFor(rot, absent),
      count = sf.keep.length,
      total = rot.heats.filter(h => h.places.length).length;
    const key = Heats.planKey({ count, lanes, setup, seed: 0, ranks: null, extra: Rot.signature(rot, absent) }),
      edit = (saved.heatEdits || {})[setupId];
    const edited = !!(edit && edit.key === key && Heats.fits(edit.schedule, count, lanes)); // a plan you changed by hand is kept as long as the rotation and who is here stay the same
    const schedule = edited ? edit.schedule : sf.schedule,
      notes = [`Rotation setup "${rot.name}": ${Rot.describe(rot)}.`];
    const left = total - sf.schedule.length,
      lone = sf.schedule.map((h, i) => (h.length === 1 ? i + 1 : 0)).filter(Boolean);
    if (left > 0)
      notes.push(
        `${left === 1 ? 'One heat is' : left + ' heats are'} left out, because nobody who is here races in ${left === 1 ? 'it' : 'them'}.`
      );
    if (lone.length)
      notes.push(
        `${lone.length === 1 ? 'Heat ' : 'Heats '}${lone.join(', ')} ${lone.length === 1 ? 'has' : 'have'} one car only, because the others are not here.`
      );
    if (edited) notes.push('You changed this plan by hand. "Reset my changes" brings back the rotation.');
    const names = sf.keep.map(p => {
      const d = byTeam ? teamOf(rows[p].teamId) : drivers.find(x => x.id === rows[p].driverId);
      return d ? titleOf(byTeam ? 'teams' : 'drivers', d) : Rot.nameOf(rot, p);
    });
    heatPlan = {
      seed: 0,
      key,
      edited,
      schedule,
      names,
      notes,
      count,
      labels: sf.labels,
      rotation: true,
      stats: Heats.stats(schedule, count, lanes)
    };
  } else if (heats && track && lanes && !rot && rows.length >= 2) {
    const seeds = { ...(saved.heatSeeds || {}) };
    let seed = seeds[setupId];
    if (!Number.isInteger(seed) || seed < 1) {
      seed = Heats.newSeed();
      seeds[setupId] = seed;
      saved.heatSeeds = seeds;
      api.setSettings({ heatSeeds: seeds }).then(s => {
        state.settings = s;
      });
    } // (kept, so the plan is the same next time as well)
    // the latest qualifying on this track, when the setup wants the heats seeded by it (only the plans that choose who races together)
    let ranks = null;
    const notes = [],
      ho = Heats.optionsOf(setup);
    if (ho.seeding !== 'random' && (ho.plan === 'manual' || ho.plan === 'perdriver') && !byTeam) {
      const q = sessions
        .filter(
          x =>
            x.sessionType === 'qualifying' &&
            x.trackId === track.id &&
            (!ch || (x.champ && x.champ.id === ch.c.id && x.champ.roundId === ch.tag.roundId && !x.champ.off)) &&
            x.standings &&
            x.standings.length
        )
        .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
      if (!q) notes.push('There is no qualifying on this track yet, so the drivers are shuffled.');
      else {
        ranks = rows.map(r => {
          const i = r.driverId ? q.standings.findIndex(x => x.driverId === r.driverId) : -1;
          return i < 0 ? null : i;
        });
        if (ranks.every(x => x === null)) {
          ranks = null;
          notes.push('None of these drivers took part in the latest qualifying, so they are shuffled.');
        } else
          notes.push(
            `Seeded by the latest qualifying on this track${q.date ? ' (' + (Number.isFinite(Date.parse(q.date)) ? (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date(q.date)) : String(q.date).slice(0, 10)) + ')' : ''}${ranks.some(x => x === null) ? '; drivers who did not take part are placed last' : ''}.`
          );
      }
    }
    const key = Heats.planKey({ count: rows.length, lanes, setup, seed, ranks }),
      edit = (saved.heatEdits || {})[setupId];
    const edited = !!(edit && edit.key === key && Heats.fits(edit.schedule, rows.length, lanes)); // a plan you changed by hand is kept as long as nothing it was made from changes
    const schedule = edited ? edit.schedule : Heats.plan({ count: rows.length, lanes, setup, seed, ranks });
    if (edited) notes.push('You changed this plan by hand. "Reset my changes" brings back the plan that was made.');
    const names = rows.map((r, i) => {
      const d = byTeam ? teamOf(r.teamId) : allDrivers.find(x => x.id === r.driverId);
      return d ? titleOf(byTeam ? 'teams' : 'drivers', d) : (byTeam ? 'Team ' : 'Participant ') + (i + 1);
    });
    heatPlan = { seed, key, edited, schedule, names, notes, count: rows.length, stats: Heats.stats(schedule, rows.length, lanes) };
  }
  if (heatPlan && rows.some(isRival)) {
    if (mc?.heats === 'separate') issues.push('Virtual drivers require mixed-class heats.');
    const active = rot ? here : rows;
    if (heatPlan.schedule.some(h => !h.some(e => active[e.p] && !isRival(active[e.p]))))
      issues.push('Every heat needs at least one human driver. Adjust the heat plan.');
  }
  if (heatPlan && mc?.heats === 'separate') {
    heatPlan.schedule = MultiClass.splitSchedule(heatPlan.schedule, rot ? mcRows.filter(r => !r.absent) : mcRows, mc);
    heatPlan.labels = heatPlan.schedule.map(
      h => mc.classes.find(c => c.id === (rot ? mcRows.filter(r => !r.absent) : mcRows)[h[0].p]?.raceClass)?.name || ''
    );
    heatPlan.stats = Heats.stats(heatPlan.schedule, heatPlan.count, lanes);
    heatPlan.notes.push('Class heats are separated while retaining every planned lane assignment.');
  }
  const heatPlanHtml = !heatPlan
    ? ''
    : (() => {
        const st = heatPlan.stats,
          nm = i => esc(heatPlan.names[i]),
          sel = state.heatSel && state.heatSel.setupId === setupId ? state.heatSel : null; // (the place that is clicked first, when you are swapping two places)
        return `<div class="heatplan"><h4>Heat plan</h4>
      ${[...Heats.summary({ stats: st, setup, names: heatPlan.names, custom: heatPlan.rotation, unit: Speed.distUnitOf(state.settings) }), ...heatPlan.notes].map(t => `<p class="hint2${/do not race the same|not shared evenly/.test(t) ? ' hpwarn' : ''}">${esc(t)}</p>`).join('')}
      <div class="wrap"><table class="fields heatplan-table"><thead><tr><th>Heat</th>${Array.from({ length: lanes }, (_, l) => `<th>Lane ${l + 1}</th>`).join('')}</tr></thead><tbody>${heatPlan.schedule
        .map(
          (h, i) =>
            `<tr><td>${i + 1}${heatPlan.labels && heatPlan.labels[i] ? ` <span class="muted">${esc(heatPlan.labels[i])}</span>` : ''}</td>${Array.from(
              { length: lanes },
              (_, l) => {
                const e = h.find(x => x.lane === l),
                  on = !!(sel && sel.heat === i && sel.lane === l);
                return `<td><button type="button" class="hpcell${on ? ' sel' : ''}" data-hp="${i}:${l}" aria-pressed="${on}" title="Click this place, then another one, to swap the two">${e ? nm(e.p) : '<span class="muted">–</span>'}</button></td>`;
              }
            ).join('')}</tr>`
        )
        .join('')}</tbody></table></div>
      <p class="hint2">${sel ? 'Now click the place to swap it with.' : 'To change the plan, click a place and then another place: the two swap. A place with a dash is empty, so a driver can move there.'}</p>
      ${state.heatMsg ? `<p class="hint2 hpwarn" role="alert">${esc(state.heatMsg)}</p>` : ''}
      <details class="hplanes"><summary>How often every driver races, and in which lane</summary><div class="wrap"><table class="fields heatplan-table"><thead><tr><th>Driver</th><th>Heats</th>${Array.from({ length: lanes }, (_, l) => `<th>Lane ${l + 1}</th>`).join('')}</tr></thead><tbody>${st.per
        .map((x, i) => `<tr><td>${nm(i)}</td><td class="num">${x.heats}</td>${x.lanes.map(n => `<td class="num">${n}</td>`).join('')}</tr>`)
        .join('')}</tbody></table></div></details>
      <div class="row">${heatPlan.rotation ? '' : '<button class="btn" id="reshuffle" title="Make another plan with the same settings">Shuffle again</button>'}${heatPlan.edited ? ' <button class="btn" id="resetplan" title="Go back to the plan that was made, without your changes">Reset my changes</button>' : ''} <button class="btn" id="heatsheet" title="Make a PDF of the heat list, to print or pin up">Print the heat list</button> <span id="heatsheetmsg" class="muted" role="status"></span></div></div>`;
      })();

  const typeLabel = rawSetup
    ? (state.schema.racesetups.fields.find(f => f.key === 'sessionType').options.find(o => o[0] === rawSetup.sessionType) || [, ''])[1]
    : '';
  // 1.58.0: the facts of the race setup as little pills under its name: the kind, how long (laps or minutes, where that is one number), the track and the number of lanes
  const lenText = !setup
    ? ''
    : setup.sessionType === 'race' && (!setup.raceBy || setup.raceBy === 'laps') && Number(setup.laps) > 0
      ? `${Number(setup.laps)} lap${Number(setup.laps) === 1 ? '' : 's'}`
      : (setup.sessionType === 'qualifying' || setup.sessionType === 'timed') && Number(setup.duration) > 0
        ? `${Number(setup.duration)} min${Distance.compareOn(setup) ? ' · by distance' : ''}`
        : ''; // (1.64.0: a time race whose cars are ranked by distance says so)
  const typeShort = typeLabel.replace(/ by laps or distance$/, ''); // ("Race by laps or distance" is "Race" here: the next pill says how long)
  const chipsHtml = [
    typeShort ? `<span class="hs-chip hs-type"><b>${esc(typeShort)}</b></span>` : '',
    lenText ? `<span class="hs-chip">${esc(lenText)}</span>` : '',
    track ? `<span class="hs-chip">${Icons.svg('pin', { size: 14 })}${esc(track.name)}</span>` : '',
    lanes ? `<span class="hs-chip">${lanes} lane${lanes === 1 ? '' : 's'}</span>` : ''
  ].join('');
  const away = r => !!rot && r.absent === true; // (not here today: the places of this participant in the rotation stay empty)
  // a row: the team (only in a session with teams: the team is the participant, or the team of an Endurance Race), the driver (the drivers of the team when there is one) and the car
  // 1.55.0: a session of a championship lists the drivers of its roster first (those who have joined by this round); anybody else drives as a guest
  const driverOpts = (list, chosen, blank = '(choose)') => {
    if (mc?.assignment === 'roster')
      list = list.filter(d => d.driverType === 'virtual' || mc.classes.some(c => c.id === MultiClass.driverClass(mc, d.id)));
    if (!ch)
      return (
        `<option value="">${esc(blank)}</option>` +
        list
          .map(
            d =>
              `<option value="${esc(d.id)}"${d.id === chosen ? ' selected' : ''}>${esc(titleOf('drivers', d))}${d.driverType === 'virtual' ? ' · Virtual' : ''}</option>`
          )
          .join('')
      );
    const rf = Champ.rosterFirst(list, ch.c, ch.ri + 1),
      opt = d =>
        `<option value="${esc(d.id)}"${d.id === chosen ? ' selected' : ''}>${esc(titleOf('drivers', d))}${d.driverType === 'virtual' ? ' · Virtual' : ''}</option>`;
    return (
      `<option value="">${esc(blank)}</option>` +
      (rf.roster.length
        ? `<optgroup label="${esc(ch.c.name || 'Championship')}: the roster">${rf.roster.map(opt).join('')}</optgroup>`
        : '') +
      (rf.others.length
        ? `<optgroup label="${rf.roster.length ? 'Other drivers (they drive as guests)' : 'Drivers'}">${rf.others.map(opt).join('')}</optgroup>`
        : '')
    );
  };
  const teamSelect = (r, i) =>
    `<select data-k="teamId" aria-label="Team for ${byTeam ? 'participant' : 'row'} ${i + 1}"${away(r) ? ' disabled' : ''}>${optionsOf('teams', teams, r.teamId, '(choose a team)')}</select>`;
  const driverList = r => {
    // the drivers a row can have: the members of its team, and the driver it has now (a stand-in who is not in the team stays visible)
    const t = r.teamId ? teamOf(r.teamId) : null;
    if (!t) return laneDrivers;
    const m = membersOf(t),
      cur = drivers.find(d => d.id === r.driverId);
    return cur && !m.includes(cur) ? [...m, cur] : m;
  };
  // 1.58.0: a row is a dark inset row in the colour of its lane: the number in a circle, the choices with a little picture in front, and a tick when the row is filled in. What it still needs is said inside the row.
  const sel2 = (ico, html) =>
    `<div class="hs-sel${ico ? '' : ' hs-noico'}">${ico ? `<span class="hs-sico" aria-hidden="true">${Icons.svg(ico, { size: ico === 'car' ? 22 : 17 })}</span>` : ''}${html}<span class="hs-chev" aria-hidden="true">${Icons.svg('chevron', { size: 16, stroke: 2 })}</span></div>`;
  const onLane = c => (/^#[0-9a-f]{6}$/i.test(c) && typeof AdjustPad !== 'undefined' ? AdjustPad.textOn(c) : '#ffffff'); // (the number on a lane colour: dark or white, whichever reads better)
  const rowHtml = (r, i) => {
    const gone = away(r),
      ready = rowOk.has(i) ? rowOk.get(i) : true, // (an away row is in no lamp, and has no message: it is never marked)
      who = (heats ? (byTeam ? 'Team ' : 'Participant ') : 'Lane ') + (i + 1) + (rot && rot.names[i] ? ' · ' + rot.names[i] : '');
    const note = [
      classChoice(r, i),
      isRival(r)
        ? `<span class="muted">Virtual Rival · ${rivalFor(r) ? esc(rivalFor(r).profile.name) + (mc ? ' · comparison only' : '') : 'choose a saved replay'}</span>`
        : '',
      rowMsgs[i] ? `<span class="hs-why">${esc(rowMsgs[i])}</span>` : '',
      withTeam && r.teamId
        ? `<span class="muted teamline">${
            membersOf(teamOf(r.teamId)).length
              ? 'Drivers: ' +
                esc(
                  membersOf(teamOf(r.teamId))
                    .map(d => titleOf('drivers', d))
                    .join(', ')
                )
              : 'This team has no drivers yet.'
          }</span>`
        : ''
    ]
      .filter(Boolean)
      .join(' ');
    const more =
      (rot && rot.names[i] ? `<span class="muted hs-rname">${esc(rot.names[i])}</span>` : '') +
      (rot
        ? `<label class="lane-away"><input type="checkbox" data-absent="${i}"${away(r) ? ' checked' : ''} aria-label="${byTeam ? 'Team' : 'Participant'} ${i + 1} is not here today"> Not here today</label>`
        : '') +
      (heats && (rot ? rows.length > rot.participants : rows.length > 2) ? `<button class="btn" data-remove="${i}">Remove</button>` : '');
    return `<div class="lane${rot ? ' rot' : ''}${gone ? ' away' : ''}${byTeam ? ' byteam' : ''}${withTeam && !byTeam ? ' threesel' : ''}${!ready ? ' need' : ''}" data-row="${i}" style="--c:${esc(laneHue(i))}">
      <strong class="hs-num" style="--on:${onLane(laneHue(i))}" title="${esc(who)}"><span class="hs-vh">${esc(who)}</span><span aria-hidden="true">${i + 1}</span></strong>
      <div class="hs-fields">${byTeam ? sel2('', teamSelect(r, i)) : `${withTeam ? sel2('', teamSelect(r, i)) : ''}${sel2('driver', `<select data-k="driverId" aria-label="${enduSingle ? 'Starting driver' : 'Driver'} for row ${i + 1}"${away(r) ? ' disabled' : ''}>${driverOpts(enduSingle && !r.teamId ? [] : driverList(r), r.driverId, tokens ? 'Guest (no driver)' : enduSingle ? (setup.endurance.next === 'random' ? '(starting driver: by lot)' : '(starting driver: the first of the team)') : undefined)}</select>`)}`}${isRival(r) && allowRival ? rivalSelect(r, i) : sel2('car', `<select data-k="carId" aria-label="Car for row ${i + 1}"${away(r) ? ' disabled' : ''}>${optionsOf('slotcars', MultiClass.carsFor(r, mc, { cars, drivers, teams }), r.carId, mc?.assignment === 'roster' ? (MultiClass.assignedClass(r, mc, { cars, drivers, teams }) ? 'Choose a matching car' : 'Choose an assigned driver first') : tokens ? '(no car)' : undefined)}</select>`)}</div>
      ${more || (!isRival(r) && typeof PaddockBrowser !== 'undefined') ? `<div class="hs-more">${more}${!isRival(r) && typeof PaddockBrowser !== 'undefined' ? `<button type="button" class="btn hs-paddock-pick" data-paddock-pick="${i}"${away(r) || raceOn ? ' disabled' : ''} title="Browse available slotcars">Browse cars</button>` : ''}</div>` : ''}
      ${r.driverId && !gone && !byTeam ? `<span class="hs-avatar" aria-hidden="true" data-avatar-driver="${esc(r.driverId)}"><img src="${esc(homeAvatarCache.get(r.driverId) || (typeof Avatars !== 'undefined' ? Avatars.forLane(null, i) : ''))}" alt=""${homeAvatarCache.get(r.driverId) ? ' class="own"' : ''}></span>` : ''}
      ${gone ? '<span class="hs-tick off" aria-hidden="true"></span>' : `<span class="hs-tick ${ready ? 'ok' : 'warn'}" role="img" aria-label="${ready ? 'Ready' : 'Not ready yet'}">${Icons.svg(ready ? 'check' : 'alert', { size: 13, stroke: 2.6 })}</span>`}
      ${note ? `<div class="hs-note">${note}</div>` : ''}</div>`;
  };
  const rotHtml = !rot
    ? ''
    : `<p class="hint2">Rotation setup <strong>${esc(rot.name)}</strong>: ${esc(Rot.describe(rot))}. Tick "Not here today" for ${byTeam ? 'every team' : 'anybody'} that does not come: their places stay empty. ${rot.names.some(x => x.trim()) ? `<button class="btn" id="rotnames" title="Choose the ${byTeam ? 'team' : 'driver'} whose name is the name of a participant in the rotation (only for participants who have no ${byTeam ? 'team' : 'driver'} yet)">${byTeam ? 'Pick the teams by name' : 'Pick the drivers by name'}</button>` : ''}</p>
      ${state.rotMsg && state.rotMsg.setupId === setupId ? `<p class="hint2" role="status">${esc(state.rotMsg.text)}</p>` : ''}`;

  const resumeHtml =
    !resume || !resume.race
      ? ''
      : `<section class="card resumecard" id="resumecard"><h3>A race was interrupted</h3>
      <p><strong>${esc(resume.name || '')}</strong>${resume.kind ? ' · ' + esc(resume.kind) : ''}${resume.trackName ? ' on ' + esc(resume.trackName) : ''}. It was ${resume.where ? esc(resume.where) : esc(Endurance.clock(Number(resume.elapsed) || 0)) + ' into the race'} when it was saved (${esc(resume.savedAt ? new Date(resume.savedAt).toLocaleString() : '')}).</p>
      <div class="row"><button class="btn primary" id="resumego">Resume the race</button><button class="btn" id="resumesave">Save what was recorded</button><button class="btn danger" id="resumedrop">Delete it</button></div>
      <p class="hint2">The race comes back paused, with its clock where it was. The laps driven since then are not in it (the review can add them), and the lap that was being driven is left out of the records. Press Space to carry on.${resume.heat ? ' The heats that were done are kept.' : ''}</p></section>`;
  // 1.55.0 (2.4.0): a championship is picked in the race setup list of Start a race (its own group under the race setups). While one is picked its session
  // is loaded by itself (the race setup, the track of the round, and the race counts for it), and two lines say which session is on now and which is
  // up next. A session that was driven makes way for the next one by itself the next time Home is drawn.
  const champShown = !champs.length ? null : champs.find(x => x.id === saved.champId) || (ch ? ch.c : null);
  const champNow = (() => {
    if (!champShown) return null;
    const c = champShown,
      p = Champ.progress(c, sessions),
      order = c.rounds.flatMap((r, ri) => r.sessions.map((x, si) => ({ ri, si, r, s: x }))),
      open = x => !x.s.skipped && !p.done.has(Champ.keyOf(x.r.id, x.s.id)),
      next = p.next ? order.find(x => x.ri === p.next.round && x.si === p.next.session) : null,
      again = !!(ch && ch.c.id === c.id && saved.champTag && saved.champTag.again), // (a session that was picked by hand, to drive it again)
      now = ch && ch.c.id === c.id ? order.find(x => x.ri === ch.ri && x.si === ch.si) || next : next,
      after = now ? (again && next && next !== now ? next : order.slice(order.indexOf(now) + 1).find(open) || null) : null,
      bad = next ? Champ.sessionProblems(c, next.ri, next.si, { setups, tracks }) : [],
      lastSkipped = [...order]
        .reverse()
        .find(x => x.s.skipped && !p.done.has(Champ.keyOf(x.r.id, x.s.id)) && (!next || order.indexOf(x) < order.indexOf(next)));
    return { c, p, order, next, now, after, again, bad, lastSkipped };
  })();
  // the session that is next is loaded by itself: when the championship was just picked, or when the session that was loaded has been driven
  const champAuto =
    champNow &&
    champNow.next &&
    !champNow.bad.length &&
    !(ch && ch.c.id === champNow.c.id && (ch.ri === champNow.next.ri && ch.si === champNow.next.si ? true : champNow.again))
      ? champNow.next
      : null;
  const sessionText = x => {
    const setup = x && setups.find(q => q.id === x.s.setup),
      kind = Champ.kindOf(setup),
      trackName = x ? (tracks.find(t => t.id === Champ.trackFor(x.r, setup, tracks)) || {}).name || '' : '';
    return {
      what: `${Champ.roundLabel(champShown, x.ri)} · ${kind ? Champ.KIND_LABEL[kind] : 'Session'}${kind === 'race' && x.s.share != null && x.s.share !== 100 ? (x.s.share ? ` at ${x.s.share}%` : ' (no points)') : ''}`,
      more: [setup ? setup.name || '(unnamed)' : x.s.setup ? '(deleted race setup)' : '(no race setup)', trackName]
        .filter(Boolean)
        .join(' · '),
      kind
    };
  };
  const champHtml = !champNow
    ? ''
    : (() => {
        const { c, p, now, after, next, again, bad, lastSkipped } = champNow;
        const stand = ChampPts.standings(c, sessions, {
            drivers: drivers.map(x => ({ id: x.id, name: titleOf('drivers', x) })),
            teams: teams.map(x => ({ id: x.id, name: titleOf('teams', x) })),
            setups
          }),
          lead = ChampPts.leadText(stand);
        const line = (cls, tag, x, extra = '') => {
          const t = sessionText(x);
          return `<div class="hs-cline ${cls}"><span class="hs-ctag">${tag}</span><b>${esc(t.what)}</b><span class="muted">${esc(t.more)}</span>${extra}</div>`;
        };
        const empty = !c.rounds.length || !p.total;
        const nowKind = now ? sessionText(now).kind : '';
        const picks = c.rounds
          .map((q, i) =>
            q.sessions.length
              ? `<optgroup label="${esc(Champ.roundLabel(c, i))}">${q.sessions
                  .map((x, k) => {
                    const st = setups.find(y => y.id === x.setup),
                      kind = Champ.kindOf(st);
                    return `<option value="${i}:${k}">${p.done.has(Champ.keyOf(q.id, x.id)) ? '✓ ' : x.skipped ? 'Skipped · ' : ''}${esc(kind ? Champ.KIND_LABEL[kind] : '?')}: ${esc(st ? st.name || '(unnamed)' : '(no race setup)')}</option>`;
                  })
                  .join('')}</optgroup>`
              : ''
          )
          .join('');
        const lines = empty
          ? `<div class="hs-cline now"><span class="hs-ctag">Now</span><b>No sessions yet</b><span class="muted">Add rounds and sessions in Race Setup › Championships.</span></div>`
          : p.complete && !again
            ? `<div class="hs-cline now done"><span class="hs-ctag">Finished</span><b>${p.skipped ? `${p.driven} driven, ${p.skipped} skipped` : `All ${p.total} sessions driven`}</b><span class="muted">Pick a session to drive it again.</span></div>`
            : line('now', 'Now', now) +
              (after
                ? line(
                    'next',
                    'Up next',
                    after,
                    again && after === next ? '<button type="button" class="btn hs-clink" data-chnext="1">Go to it</button>' : ''
                  )
                : `<div class="hs-cline next"><span class="hs-ctag">Up next</span><b>The end of the championship</b><span class="muted">${esc(p.driven + ' of ' + p.total + ' sessions driven')}</span></div>`);
        return `<section class="hs-championship" id="champband" aria-label="Championship ${esc(c.name || '')}"><div class="hs-clines">${lines}</div>
      <div class="hs-cside">${lead ? `<span class="hs-clead">${Icons.svg('championship', { size: 14 })}${esc(lead)}</span>` : ''}
        ${next && now === next && ['practice', 'qualifying'].includes(nowKind) ? `<button type="button" class="btn hs-clink" data-chskip="${next.ri}:${next.si}">Skip ${nowKind === 'practice' ? 'practice' : 'qualifying'}</button>` : ''}
        ${lastSkipped ? `<button type="button" class="btn hs-clink" data-chrestore="${lastSkipped.ri}:${lastSkipped.si}">Undo skip</button>` : ''}
        ${picks ? `<select id="champpick" class="hs-cpick" aria-label="Pick another session of the championship"><option value="">Other session…</option>${picks}</select>` : ''}
        <button type="button" class="btn hs-clink" data-chall="${esc(c.id)}">Standings</button></div>
      ${bad.length ? `<ul class="issues">${bad.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}${state.champMsg ? `<p class="hint2 hpwarn" role="alert">${esc(state.champMsg)}</p>` : ''}</section>`;
      })();
  // 1.17.0: the welcome band (date, track and status chips), the start card with its coloured lanes and start lights, and the cards on the right
  const audio = setup && (audiosets || []).find(x => x.id === setup.audioSet),
    audioName = audio ? audio.name || '(unnamed)' : '';
  // the timing hardware chip: the hardware that was chosen (App Settings, Timing Hardware), one at a time, and whether it is connected
  const abLink = typeof ArduinoBox !== 'undefined' && ArduinoBox.link ? ArduinoBox.link : null;
  const chipsNow = more =>
    HomeStats.chips({
      hardware: Hardware.timingChosen(state.settings),
      ds: typeof DsTiming !== 'undefined' && DsTiming.link.connected,
      trackmate: typeof Trackmate !== 'undefined' && !!Trackmate.link.connected,
      arduino: !!(abLink && abLink.connected),
      plugin: typeof pt !== 'undefined' && pt.link.connected,
      pluginName: typeof pt !== 'undefined' && pt.identity?.name,
      parallel: typeof ParallelPort !== 'undefined' && ParallelPort.link.connected,
      virtual: state.settings.abVirtual === true,
      netOn: !!state.settings.netOn,
      netError: more && more.netError,
      hasSetup: !!setup,
      audioName,
      drivers: drivers.length,
      cars: cars.length,
      tracks: tracks.length,
      unused: typeof unusedTimingConnected === 'function' ? unusedTimingConnected(state.settings).map(id => TIMING_NAMES[id] || id) : [],
      libraryWaiting: homeLibraryWaiting,
      backupFailed: homeBackupFailed
    });
  // a chip that points at a problem is a button that opens the page where it is put right
  const chipHtml = c =>
    c.go
      ? `<button type="button" class="hm-chip hm-chip-go" data-key="${c.key}" data-go="${esc(c.go)}"${c.state ? ` data-state="${c.state}"` : ''}${c.title ? ` title="${esc(c.title)}"` : ''}>${c.state ? '<i aria-hidden="true"></i>' : ''}${esc(c.text)}</button>`
      : `<span class="hm-chip" data-key="${c.key}"${c.state ? ` data-state="${c.state}"` : ''}>${c.state ? '<i aria-hidden="true"></i>' : ''}${esc(c.text)}</span>`;
  const today = new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
  const lt = HomeStats.lights(
      rows,
      { byTeam, enduSingle, tokens, ready: r => (rowMsgs[rows.indexOf(r)] ? false : isRival(r) ? allowRival && !!rivalFor(r) : null) },
      heats ? (byTeam ? 'team' : 'participant') : 'lane',
      issues.length > 0
    ),
    shown = rows.map((r, i) => ({ r, i })).filter(x => !x.r.absent);
  const laneSub = tokens
    ? 'A lane can have no driver (a Guest) and no car.'
    : heats
      ? `${rows.length} ${byTeam ? 'teams' : 'participants'} race on ${lanes} lanes. Pick who takes part.`
      : enduSingle
        ? 'Every lane is a team with its starting driver.'
        : 'Choose a human driver and car, or a Virtual Rival and its replay.';
  const rowSaid = new Set(Object.values(rowMsgs)),
    otherIssues = issues.filter(x => !rowSaid.has(x)); // (the list under the rows keeps what is not about one row)
  const rowOk = new Map(shown.map((x, k) => [x.i, lt.ok[k]])),
    allReady = !issues.length; // (1.58.0: a tick for every row, and one pill that says whether the race can start: nothing is wrong, and then every row is filled in, because what a row lacks is one of the issues)
  const lightsHtml =
    setup && track && lanes && rows.length
      ? `<div class="hs-status ${allReady ? 'ok' : 'warn'}" role="status"><div class="hm-lights" aria-hidden="true">${shown.map((x, k) => `<i${lt.ok[k] ? ' class="on"' : ''} style="--c:${esc(laneHue(x.i))}"></i>`).join('')}</div><span class="hm-ready">${esc(lt.text)}</span></div>`
      : '';
  // 1.25.0: Customize, set up like the Leaderboard grid: the little squares (up to 6 columns by 4 rows), a card for every cell, and the settings of the card that is picked
  const HG = HomeGrid,
    place = b => `grid-column:${b.c} / span ${b.w};grid-row:${b.r} / span ${b.h}`;
  const customHtml = () => {
    if (!hc.open) return '';
    const g = grid,
      sel = hc.sel,
      b = g.boards[sel],
      same = (n, one, many) => `${n} ${n === 1 ? one : many}`;
    const choice = (cur, i) =>
      `<option value=""${cur ? '' : ' selected'}>(empty)</option>${HG.available(g, i)
        .map(c => `<option value="${esc(c.key)}"${c.key === cur ? ' selected' : ''}>${esc(c.label)}</option>`)
        .join('')}`;
    const squares = Array.from({ length: HG.MAXR * HG.MAXC }, (_, k) => {
      const c = (k % HG.MAXC) + 1,
        r = Math.floor(k / HG.MAXC) + 1;
      return `<button type="button" class="lv-gp${c <= g.cols && r <= g.rows ? ' on' : ''}" data-hgrid="${c},${r}" aria-label="${same(c, 'column', 'columns')} by ${same(r, 'row', 'rows')}" aria-pressed="${c === g.cols && r === g.rows}"></button>`;
    }).join('');
    const map = HG.cells(g)
      .map(x =>
        x.board
          ? `<div class="lv-gcell${x.index === sel ? ' sel' : ''}" style="${place(x.board)}"><select aria-label="Card in ${HG.where(x.board)}" data-hcell="${x.index}">${choice(HG.cardOf(x.board), x.index)}</select><button type="button" class="btn" data-hsel="${x.index}" aria-pressed="${x.index === sel}">Card ${x.index + 1} settings</button></div>`
          : `<div class="lv-gcell empty" style="grid-column:${x.c};grid-row:${x.r}"><select aria-label="Card in column ${x.c}, row ${x.r}" data-hadd="${x.c},${x.r}">${choice('', -1)}</select></div>`
      )
      .join('');
    let one = '<p class="muted">Pick a card for a cell to see its settings here.</p>';
    if (b) {
      const ms = HG.maxSpan(g, b),
        cd = HG.info(HG.cardOf(b));
      const span = (key, n, max, label) =>
        `<div class="field"><label for="hg-${key}">${label}</label><select id="hg-${key}" data-hspan="${key}">${Array.from({ length: max }, (_, i) => `<option value="${i + 1}"${n === i + 1 ? ' selected' : ''}>${i + 1}</option>`).join('')}</select></div>`;
      // one option of the card: a tick, a choice, a number, a line of text or a picture set. The options of a row (a tyre: tick, name, how many) sit on one line (1.26.0).
      const attrs = o => `id="hg-${esc(o.key)}" data-hopt="${esc(o.key)}"`;
      const input = (o, v) =>
        o.type === 'check'
          ? `<input id="hg-${esc(o.key)}" type="checkbox" data-hopt="${esc(o.key)}" ${v ? 'checked' : ''}>`
          : o.type === 'number'
            ? `<input ${attrs(o)} type="number" min="${o.min}" max="${o.max}" step="1" value="${esc(v)}" aria-label="${esc(o.label)}">`
            : o.type === 'longtext'
              ? `<textarea ${attrs(o)} rows="${o.rows || 5}" maxlength="${o.max}" placeholder="${esc(o.placeholder || '')}" aria-label="${esc(o.label)}">${esc(v)}</textarea>`
              : o.type === 'text'
                ? `<input ${attrs(o)} type="text" maxlength="${o.max}" value="${esc(v)}" placeholder="${esc(o.placeholder || '')}" aria-label="${esc(o.label)}">`
                : o.type === 'imageset'
                  ? `<select ${attrs(o)}><option value="">None (drawn)</option>${imageSets
                      .filter(r => r.kind === o.kind)
                      .map(r => `<option value="${esc(r.id)}"${r.id === v ? ' selected' : ''}>${esc(r.name || '(unnamed)')}</option>`)
                      .join('')}</select>`
                  : `<select ${attrs(o)}>${o.choices.map(([k, t]) => `<option value="${esc(k)}"${v === k ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
      const opt = o => {
        const v = HG.optionOf(b, o.key);
        return o.type === 'check'
          ? `<div class="field"><label class="inline">${input(o, v)} ${esc(o.label)}</label></div>`
          : `<div class="field${o.type === 'longtext' ? ' hm-wide' : ''}"><label for="hg-${esc(o.key)}">${esc(o.label)}</label>${input(o, v)}</div>`;
      };
      const inRow = o => {
        const v = HG.optionOf(b, o.key);
        return o.type === 'check'
          ? `<label class="inline hm-ocheck">${input(o, v)} ${esc(o.label)}</label>`
          : `${input(o, v)}${o.suffix ? `<span class="muted">${esc(o.suffix)}</span>` : ''}`;
      };
      const optsHtml = cd.options.reduce(
        (out, o, k, all) =>
          o.row
            ? k > 0 && all[k - 1].row === o.row
              ? out
              : out +
                `<div class="hm-orow">${all
                  .filter(x => x.row === o.row)
                  .map(inRow)
                  .join('')}</div>`
            : out + opt(o),
        ''
      );
      one = `<fieldset class="lv-optset"><legend>Card ${sel + 1}: ${esc(cd.label)} (${HG.where(b)})</legend><p class="hint2">${esc(cd.note)}</p><div class="lv-optgrid">${span('w', b.w, ms.w, 'Columns it covers')}${span('h', b.h, ms.h, 'Rows it covers')}${optsHtml}</div></fieldset>`;
    }
    return `<section class="card hm-customize" id="hm-customize"><h3>Customize Home</h3><p class="hint2">Start a race always runs across the top of Home. Pick the grid for the cards under it with the little squares, then choose a card for every cell. A card can cover more cells (wider or taller). The grid is kept on this computer, and every change shows at once.</p>
      <div class="lv-gridtool"><div class="field"><span class="lbl" id="hg-gridlabel">Grid</span><div class="lv-gridpick" role="group" aria-labelledby="hg-gridlabel">${squares}</div><output id="hg-gridsize">${HG.sizeText(g)}</output></div>
      <div class="field"><span class="lbl">Card in every cell</span><div class="hm-fixedbar" aria-hidden="true">Start a race <small>always across the top of Home</small></div><div class="lv-gridmap" style="grid-template-columns:repeat(${g.cols},minmax(0,1fr))">${map}</div></div></div>${one}
      <div class="row"><button type="button" class="btn" id="hmdefault"${HG.isDefault(g) ? ' disabled' : ''} title="Put the cards back the way Home was before you customized it">Back to the usual Home</button></div></section>`;
  };
  // 2.4.0: Start a race is a bar across the whole page under the title card and not in the grid (homegrid.js): the grid holds the cards under it, each in
  // the cell Customize gave it.
  const otherCells = grid.boards
    .map(b => `<div class="hm-cell" id="hmc-${esc(HG.cardOf(b))}" data-card="${esc(HG.cardOf(b))}" style="${place(b)}"></div>`)
    .join('');
  const ae = hc.open && typeof document !== 'undefined' ? document.activeElement : null,
    keep = homeFieldId(ae) ? { id: ae.id, type: ae.type, start: ae.selectionStart, end: ae.selectionEnd } : null; // (the field of Customize that has the cursor now, and what is selected in it)
  // 2.4.0: the header picture and the welcome band are one title card, as on a race broadcast: the words sit on the picture (hm-hero.has-pic), or on a drawn
  // backdrop when there is no picture. The cards below rise into it when nothing stands between them (styles.css).
  const headerHtml = homeHeaderHtml(state.settings),
    heroCls = headerHtml
      ? ` has-pic${typeof Banner !== 'undefined' && Banner.logoOn(state.settings) && Banner.logoLeft(state.settings) ? ' logo-left' : ''}`
      : '';
  view.innerHTML =
    `<div class="hm-hero${heroCls}">${headerHtml}
    <div class="hm-band"><div class="hm-flag" aria-hidden="true"></div><button type="button" class="btn hm-customize-btn" id="hmcustom" aria-expanded="${hc.open}" aria-controls="hm-customize" title="Choose the cards of Home and where they sit">Customize</button><h2>${esc(welcomeOf())}</h2>
      <p class="hm-sub">${esc(today)}${track ? ' · ' + esc(track.name) : ''}</p></div></div>
    ${customHtml()}
    ${resumeHtml}
    <div id="hm-update" hidden></div>
    <div id="hm-detect" hidden></div>
    <section class="card hm-start" id="hmc-start">` +
    (setups.length
      ? `
      <div class="hs-head"><span class="hs-tile" aria-hidden="true">${Icons.svg('racesetups', { size: 24 })}</span>
        <div class="hs-ht"><label class="hs-label" for="setup">Start a race</label>
          <div class="hs-title"><select id="setup" aria-label="Race setup or championship"><optgroup label="Race setups">${setups.map(s => `<option value="${esc(s.id)}"${!champShown && s.id === setupId ? ' selected' : ''}>${esc(s.name || '(unnamed)')}</option>`).join('')}</optgroup>${champs.length ? `<optgroup label="Championships">${champs.map(c => `<option value="champ:${esc(c.id)}"${champShown && c.id === champShown.id ? ' selected' : ''}>${esc(c.name || '(unnamed championship)')}</option>`).join('')}</optgroup>` : ''}</select><span class="hs-chev" aria-hidden="true">${Icons.svg('chevron', { size: 16, stroke: 2 })}</span></div>
          <div class="hs-chips">${chipsHtml}</div></div></div>
      ${champHtml}
      ${
        qual && lanes > 1
          ? `<p class="hint2">🏁 ${esc(qual.name)} won the latest qualifying on this track and picks a lane first. ${
              winRow >= 0
                ? `Starting lane: <select id="winlane" aria-label="Starting lane for ${esc(qual.name)}">${Array.from({ length: lanes }, (_, i) => `<option value="${i}"${i === winRow ? ' selected' : ''}>Lane ${i + 1}</option>`).join('')}</select>`
                : 'Assign them below, then choose their lane here.'
            } <button class="btn" id="clearqual">Clear qualifying result</button></p>`
          : ''
      }
      ${rotHtml}
      ${track && lanes ? `${heats || tokens || enduSingle ? `<div class="hs-sub"><span class="hs-label hs-muted">${heats ? (byTeam ? 'Teams' : 'Participants') : 'Lanes'}</span><span class="muted">${esc(laneSub)}</span></div>` : ''}<div class="hs-lanes" data-cols="${laneCols(rows.length)}" role="group" aria-label="${esc(laneSub)}">${rows.map(rowHtml).join('')}</div>` : ''}
      ${heats && track && !rot ? `<button class="btn" id="addrow">${byTeam ? 'Add team' : 'Add participant'}</button>` : ''}
      ${mcHtml}${heatPlanHtml}
      ${tokens ? '<p class="hint2">A Time Token Session starts with every lane switched off. You add paid time to a lane on the race screen, and can change the driver there too. Here you can already put a driver and a car on a lane.</p>' : ''}
      ${raceOn ? '<p class="hint2" id="raceon">A race is running. <button class="btn" id="gorace">Go to the race</button></p>' : ''}
      ${otherIssues.length ? `<ul class="issues">${otherIssues.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      <div class="hm-go">${lightsHtml}<span class="hm-grow"></span>${!tokens && track && lanes && !raceOn ? '<button type="button" class="btn" id="sensortest" title="Drive a car over every lane before the race: each lane lights up when its sensor sees a car">Test sensors</button>' : ''}<button class="btn primary big" id="start" ${issues.length || raceOn ? 'disabled' : ''}${raceOn ? ' title="A race is still running. Open the Race tab to finish or stop it first."' : ''}>${Icons.svg('racesetups', { size: 20 })}<span>${tokens ? 'Open the session' : 'Start race'}</span></button></div>`
      : '<h3>Start a race</h3><p class="muted">Create a race setup in the Race Setup tab to get started, or let the setup guide walk you through it.</p><div class="row"><button type="button" class="btn primary" id="guideagain">Start the setup guide</button></div>') +
    `</section>
    <div class="hm-chips" id="hm-chips" role="status">${chipsNow().map(chipHtml).join('')}</div>
    <div class="hm-grid" id="homegrid" style="grid-template-columns:repeat(${grid.cols},minmax(0,1fr))">${otherCells}</div>`;
  if (typeof UpdateNotice !== 'undefined') UpdateNotice.mountHome(document.getElementById('hm-update')); // (a newer release on GitHub, if any)
  // (2.4.0) the avatars of the drivers in the lanes: Home's list of drivers has only their names, so each driver's own picture is read once and kept while the
  // app runs; until then, and for a driver without one, the standard avatar of the lane shows
  if (api.getRecord && typeof document !== 'undefined' && document.querySelectorAll)
    document.querySelectorAll('[data-avatar-driver]').forEach(el => {
      const id = el.dataset.avatarDriver;
      if (homeAvatarCache.has(id)) return;
      homeAvatarCache.set(id, '');
      Promise.resolve(api.getRecord('drivers', id))
        .then(d => {
          const pic = d && typeof d.avatar === 'string' ? d.avatar : ''; // (the same picture the race screen shows)
          homeAvatarCache.set(id, pic);
          if (pic && draw === homeDraw)
            document.querySelectorAll(`[data-avatar-driver="${CSS.escape ? CSS.escape(id) : id}"] img`).forEach(img => {
              img.src = pic;
              img.classList.add('own');
            });
        })
        .catch(() => {});
    });
  if (typeof mountHwDetect === 'function') mountHwDetect(); // (2.3.0: timing hardware that was plugged in)
  {
    // the problem chips: a click opens the page where it is put right
    const chipBox = document.getElementById('hm-chips');
    if (chipBox)
      chipBox.onclick = ev => {
        const b = ev.target.closest ? ev.target.closest('[data-go]') : null;
        if (!b) return;
        state.tab = 'settings';
        if (b.dataset.go === 'hardware') {
          state.settingsSub = 'hardware';
          const first = typeof unusedTimingConnected === 'function' ? unusedTimingConnected(state.settings)[0] : null;
          if (first) state.hwSub = first; // (the page of the hardware the chip is about)
        }
        if (b.dataset.go === 'backup') {
          state.settingsSub = 'transfer';
          if (typeof folderClosed !== 'undefined') folderClosed.delete('transfer:auto'); // (its folder is open)
        }
        if (b.dataset.go === 'connections') {
          state.settingsSub = 'network';
          if (typeof connectionsTab !== 'undefined') connectionsTab = 'library';
        }
        render();
      };
  }
  // the automatic backup (asked after the page is drawn, as below)
  if (api.autoBackupStatus)
    api
      .autoBackupStatus()
      .then(st => {
        const failed = !!(st && st.on && st.ok === false);
        if (failed !== homeBackupFailed && draw === homeDraw) {
          homeBackupFailed = failed;
          const el = document.getElementById('hm-chips');
          if (el) el.innerHTML = chipsNow().map(chipHtml).join('');
        }
      })
      .catch(() => {});
  // finished races that could not reach the shared library (asked after the page is drawn: the chip follows when the answer comes)
  if (api.libraryResults && api.libraryStatus)
    api
      .libraryStatus()
      .then(st => (st && st.available ? api.libraryResults() : null))
      .then(r => {
        const n = r && Array.isArray(r.results) ? r.results.length : 0;
        if (n !== homeLibraryWaiting && draw === homeDraw) {
          homeLibraryWaiting = n;
          const el = document.getElementById('hm-chips');
          if (el) el.innerHTML = chipsNow().map(chipHtml).join('');
        }
      })
      .catch(() => {});

  if (keep) {
    // the field that had the cursor has it again, with the same part of the text selected (a number has no part: all of it, as when you come into it with Tab)
    const el = document.getElementById(keep.id);
    if (el && typeof el.focus === 'function') {
      el.focus();
      if (typeof keep.start === 'number' && typeof el.setSelectionRange === 'function')
        el.setSelectionRange(keep.start, typeof keep.end === 'number' ? keep.end : keep.start);
      else if (keep.type === 'number' && typeof el.select === 'function') el.select();
    }
  }
  // 1.55.0: a session of the championship is loaded: its race setup is the one on Home, its track is the track of the round, and the race that is started counts for the championship
  const loadSession = (ri, si, again = false) => {
    const c = champShown,
      r = c && c.rounds[ri],
      s = r && r.sessions[si];
    if (!s) return;
    const bad = Champ.sessionProblems(c, ri, si, { setups, tracks });
    if (bad.length) {
      state.champMsg = bad[0];
      renderHome();
      return;
    }
    state.champMsg = '';
    api
      .setSettings({
        lastSetupId: s.setup,
        champId: c.id,
        champTag: { champId: c.id, roundId: r.id, sessionId: s.id, setupId: s.setup, ...(again ? { again: true } : {}) }
      })
      .then(x => {
        state.settings = x;
        renderHome();
      });
  };
  // (the next session of the championship that is picked, loaded by itself: once for each session, so a session that cannot be loaded is not asked for again and again)
  if (champAuto) {
    const key = champNow.c.id + ':' + champAuto.ri + ':' + champAuto.si;
    if (homeChampAuto !== key) {
      homeChampAuto = key;
      loadSession(champAuto.ri, champAuto.si);
    }
  }
  const changeSessionSkip = async (ri, si, skip) => {
    if (typeof raceActive === 'function' && raceActive()) {
      state.champMsg = 'Finish or discard the active session before changing the championship order.';
      renderHome();
      return;
    }
    const c = champShown;
    if (!c) return;
    const result = Champ.skipSession(c, ri, si, { setups, sessions }, skip);
    if (result.error) {
      state.champMsg = result.error;
      renderHome();
      return;
    }
    try {
      await api.update('championships', c.id, { rounds: result.rec.rounds });
      const p = Champ.progress(result.rec, sessions),
        at = p.next,
        r = at && result.rec.rounds[at.round],
        next = r && r.sessions[at.session];
      const canLoad = at && !Champ.sessionProblems(result.rec, at.round, at.session, { setups, tracks }).length;
      state.settings = await api.setSettings({
        champId: c.id,
        champTag: canLoad ? { champId: c.id, roundId: r.id, sessionId: next.id, setupId: next.setup } : null,
        ...(canLoad ? { lastSetupId: next.setup } : {})
      });
      state.champMsg = skip ? 'Session skipped. No result or points were created.' : 'Skip undone.';
    } catch (e) {
      state.champMsg = 'Could not save the skip: ' + e.message;
    }
    renderHome();
  };
  const persist = async () => {
    state.settings = await api.setSettings({ lastSetupId: setupId, assignments: { ...(saved.assignments || {}), [setupId]: rows } });
    renderHome();
  };
  // (the grid is saved for this computer; Customize stays open. soft: a field was left, so the drawing waits a moment.) The changes are made on the grid as it was saved last, not on the one this drawing started from.
  const cur = () => hc.latest || HG.gridOf(state.settings); // (hc.latest: a grid that is being saved right now)
  const saveGrid = async (g, soft) => {
    hc.latest = g;
    try {
      state.settings = await api.setSettings({ homeGrid: g });
    } finally {
      if (hc.latest === g) hc.latest = null;
    }
    hc.open = true;
    if (!soft) {
      renderHome();
      return;
    }
    clearTimeout(hc.timer);
    hc.timer = setTimeout(homeSoftDraw, HOME_SOFT_MS);
  };
  view.oninput = ev => {
    const c = state.homeCustom;
    if (c) c.typing = homeFocusId(ev.target) !== '';
  }; // (typing in such a field: Home is left alone until the field is left)
  let sharedSelecting = false;
  view.onchange = async ev => {
    if (sharedSelecting) return;
    if (ev.target.dataset?.mcEntry !== undefined) {
      rows[Number(ev.target.dataset.mcEntry)].raceClass = ev.target.value;
      persist();
      return;
    }
    state.rotMsg = null;
    const t = ev.target,
      dd = t.dataset || {};
    hc.typing = false;
    if (dd.hadd !== undefined) {
      // a card for an empty cell
      const [c, r] = String(dd.hadd).split(',').map(Number);
      if (!t.value) return;
      const g2 = HG.add(cur(), c, r, t.value);
      hc.sel = Math.max(
        0,
        g2.boards.findIndex(x => x.c === c && x.r === r)
      );
      saveGrid(g2);
      return;
    }
    if (dd.hcell !== undefined) {
      const i = Number(dd.hcell);
      hc.sel = i;
      saveGrid(t.value ? HG.setCard(cur(), i, t.value) : HG.remove(cur(), i));
      return;
    } // (another card for a cell, or none: the card and its settings are gone)
    if (dd.hspan) {
      const g = cur(),
        b = g.boards[hc.sel];
      if (b) saveGrid(HG.setSpan(g, hc.sel, dd.hspan === 'w' ? t.value : b.w, dd.hspan === 'h' ? t.value : b.h));
      return;
    }
    if (dd.hopt) {
      const g = cur();
      if (g.boards[hc.sel])
        saveGrid(
          HG.setOpt(g, hc.sel, { [dd.hopt]: t.type === 'checkbox' ? t.checked : t.value }),
          t.type === 'text' || t.type === 'number' || t.type === 'textarea'
        );
      return;
    }
    if (ev.target.id === 'winlane') {
      const to = Number(ev.target.value);
      [rows[winRow], rows[to]] = [rows[to], rows[winRow]];
      persist();
      return;
    }
    if (ev.target.id === 'champpick') {
      const [i, k] = String(ev.target.value).split(':').map(Number);
      if (Number.isInteger(i) && Number.isInteger(k))
        loadSession(i, k, !(champNow && champNow.next && champNow.next.ri === i && champNow.next.si === k));
      return;
    }
    if (ev.target.id === 'setup') {
      state.champMsg = '';
      homeChampAuto = ''; // (a championship that is picked again loads its next session again)
      const v = String(ev.target.value);
      api
        .setSettings(v.startsWith('champ:') ? { champId: v.slice(6), champTag: null } : { lastSetupId: v, champId: null, champTag: null })
        .then(s => {
          state.settings = s;
          renderHome(); // (a championship: its next session is loaded when Home is drawn)
        });
      return;
    } // (2.4.0: a race setup is a normal race; a championship from the same list loads its next session)
    if (ev.target.dataset && ev.target.dataset.absent !== undefined) {
      const r = rows[Number(ev.target.dataset.absent)];
      if (r) {
        if (ev.target.checked) r.absent = true;
        else delete r.absent;
        persist();
      }
      return;
    }
    const row = ev.target.closest('[data-row]');
    if (row && ev.target.dataset.k) {
      const i = Number(row.dataset.row),
        k = ev.target.dataset.k,
        v = ev.target.value,
        r = rows[i];
      if (k === 'carId' && v.startsWith('shared:')) {
        sharedSelecting = true;
        const controls = [...view.querySelectorAll('button,select')].map(x => [x, x.disabled]);
        controls.forEach(([x]) => (x.disabled = true));
        try {
          const car = await api.paddockLink(v.slice(7));
          if (state.tab !== 'home' || draw !== homeDraw) return;
          if (!MultiClass.carsFor(r, mc, { cars: [car], drivers, teams }).some(c => c.id === car.id))
            throw Error('This car no longer matches the driver’s race class.');
          rows[i].carId = car.id;
          await persist();
        } catch (error) {
          Dialog.alert(error.message);
          ev.target.value = r.carId || '';
        } finally {
          sharedSelecting = false;
          controls.forEach(([x, disabled]) => (x.disabled = disabled));
        }
        return;
      }
      if (k === 'teamId') {
        // a team for the row (only in a session with teams): an Endurance Race row has its starting driver from the team too
        if (!v) delete r.teamId;
        else {
          r.teamId = v;
          if (enduSingle) {
            if (!membersOf(teamOf(v)).some(d => d.id === r.driverId)) r.driverId = '';
          } // (the starting driver is chosen, or left to the rule)
        }
      } else {
        const wasRival = isRival(r);
        r[k] = v;
        if (k === 'driverId') {
          delete r.rivalProfileId;
          if (wasRival || isRival(r)) {
            r.carId = '';
            delete r.raceClass;
          }
        }
      }
      if (mc?.assignment === 'roster' && !MultiClass.carsFor(r, mc, { cars, drivers, teams }).some(c => c.id === r.carId)) r.carId = '';
      persist();
    }
  };
  view.onclick = async ev => {
    if (sharedSelecting) return;
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.paddockPick !== undefined) {
      const i = Number(b.dataset.paddockPick);
      return PaddockBrowser.pick(
        api,
        async car => {
          if (state.tab !== 'home' || draw !== homeDraw) throw Error('Race setup changed. Reopen the car selector.');
          if (!MultiClass.carsFor(rows[i], mc, { cars: [car], drivers, teams }).some(c => c.id === car.id))
            throw Error('This car does not match the driver’s assigned race class. Choose a matching car.');
          rows[i].carId = car.id;
          await persist();
        },
        mc?.assignment === 'roster'
          ? {
              guidance: 'Only cars matching this driver’s assigned race class are shown.',
              accept: (car, source) => {
                const raceClass =
                  source === 'local'
                    ? car.raceClass
                    : classDefs.find(c => c.name.trim().toLocaleLowerCase() === car.raceClass.trim().toLocaleLowerCase())?.id;
                return MultiClass.carsFor(rows[i], mc, { cars: [{ ...car, raceClass }], drivers, teams }).length > 0;
              }
            }
          : {}
      );
    }
    if (b.id === 'hmcustom') {
      hc.open = !hc.open;
      renderHome();
      return;
    }
    if (b.dataset.chst) {
      state.champHomeWhich = b.dataset.chst;
      renderHome();
      return;
    }
    if (b.dataset.chall) {
      champView.id = b.dataset.chall;
      champView.which = state.champHomeWhich === 'teams' ? 'teams' : 'drivers';
      state.resultsSub = 'champs';
      state.tab = 'database';
      state.sub = 'results';
      render();
      return;
    } // 1.56.0: the standings of the championship
    if (b.dataset.chskip || b.dataset.chrestore) {
      const [i, k] = String(b.dataset.chskip || b.dataset.chrestore)
        .split(':')
        .map(Number);
      return changeSessionSkip(i, k, !!b.dataset.chskip);
    }
    if (b.dataset.chnext && champNow && champNow.next) {
      loadSession(champNow.next.ri, champNow.next.si);
      return;
    } // (back to the session that is next, after one that was driven again)
    if (b.dataset.hgrid) {
      const [c, r] = String(b.dataset.hgrid).split(',').map(Number);
      saveGrid(HG.resize(cur(), c, r));
      return;
    } // a square of the grid picker
    if (b.dataset.hsel !== undefined) {
      hc.sel = Number(b.dataset.hsel) || 0;
      renderHome();
      return;
    } // the settings of a card
    if (b.id === 'hmdefault') {
      api.setSettings({ homeGrid: null }).then(s => {
        state.settings = s;
        hc.sel = 0;
        renderHome();
      });
      return;
    }
    if (b.dataset.car) {
      state.focusCar = b.dataset.car;
      state.tab = 'database';
      state.sub = 'slotcars';
      render();
      return;
    } // a car of the Service Due card: its card in the Database
    if (b.dataset.session) {
      state.focusSession = b.dataset.session;
      state.resultsSub = 'racing';
      state.tab = 'database';
      state.sub = 'results';
      render();
      return;
    } // a recent race: its results
    if (b.dataset.go) {
      // a shortcut
      const s = HG.SHORTCUTS.find(x => x.key === b.dataset.go);
      if (!s) return;
      if (s.key === 'live') {
        api.liveOpen();
        return;
      }
      if (s.key === 'results') state.resultsSub = 'racing';
      Object.assign(state, s.to);
      render();
      return;
    }
    if (b.id === 'clearqual' && qual) {
      api.setSettings({ qualCleared: { ...(saved.qualCleared || {}), [track.id]: qual.id } }).then(s => {
        state.settings = s;
        renderHome();
      });
      return;
    }
    if (b.id === 'addrow') {
      rows.push({ driverId: '', carId: '' });
      persist();
    }
    if (b.id === 'rotnames' && rot) {
      // the drivers whose names are the names of the participants (only participants who have no driver yet)
      const what = byTeam ? 'team' : 'driver',
        key = byTeam ? 'teamId' : 'driverId';
      const m = byTeam
          ? Rot.matchDrivers(rot, teams, t => [titleOf('teams', t), t.name])
          : Rot.matchDrivers(rot, drivers, d => [titleOf('drivers', d), d.name]),
        taken = new Set(rows.map(r => r[key]).filter(Boolean));
      let n = 0;
      m.picks.forEach((id, i) => {
        if (id && rows[i] && !rows[i][key] && !taken.has(id)) {
          rows[i][key] = id;
          taken.add(id);
          n++;
        }
      });
      const said = [n ? `Picked ${n} ${n === 1 ? what : what + 's'} by name.` : `No ${what} was picked by name.`];
      if (m.missing.length) said.push(`No ${what} is called ${m.missing.join(', ')}.`);
      if (m.ambiguous.length) said.push(`More than one ${what} is called ${m.ambiguous.join(', ')}.`);
      state.rotMsg = { setupId, text: said.join(' ') };
      persist();
      return;
    }
    if (b.id === 'heatsheet' && heatPlan) {
      // the heat list as a PDF (a sheet with the driver of every lane and a place for the winner)
      const msg = document.getElementById('heatsheetmsg'),
        say = t => {
          if (msg) msg.textContent = t;
        };
      say('Making the PDF...');
      const list = Heats.planList(heatPlan.schedule, heatPlan.names, heatPlan.labels);
      api
        .exportPdf(
          Report.heatSheetHtml({
            title: `${setup.name}: heat list`,
            subtitle: `${track ? track.name + ' · ' : ''}${heatPlan.count} ${heatPlan.count === 1 ? 'participant' : 'participants'} · ${list.length} ${list.length === 1 ? 'heat' : 'heats'}`,
            list,
            lanes
          }),
          `${setup.name} heat list.pdf`.replace(/[\\/:*?"<>|]/g, '-')
        )
        .then(
          res => say(res.saved ? 'Saved to ' + res.path : 'Export cancelled.'),
          x => say('Could not make the PDF: ' + x.message)
        );
      return;
    }
    if (b.id === 'reshuffle' && heatPlan) {
      state.heatSel = null;
      state.heatMsg = '';
      const edits = { ...(saved.heatEdits || {}) };
      delete edits[setupId];
      api.setSettings({ heatSeeds: { ...(saved.heatSeeds || {}), [setupId]: Heats.newSeed() }, heatEdits: edits }).then(s => {
        state.settings = s;
        renderHome();
      });
      return;
    }
    if (b.id === 'resetplan' && heatPlan) {
      state.heatSel = null;
      state.heatMsg = '';
      const edits = { ...(saved.heatEdits || {}) };
      delete edits[setupId];
      api.setSettings({ heatEdits: edits }).then(s => {
        state.settings = s;
        renderHome();
      });
      return;
    }
    if (b.dataset.hp !== undefined && heatPlan) {
      // the plan is changed by clicking one place and then another one
      const [h, l] = b.dataset.hp.split(':').map(Number),
        first = state.heatSel && state.heatSel.setupId === setupId ? state.heatSel : null;
      state.heatMsg = '';
      if (!first) {
        state.heatSel = { setupId, heat: h, lane: l };
        renderHome();
        return;
      }
      state.heatSel = null;
      if (first.heat === h && first.lane === l) {
        renderHome();
        return;
      } // the same place again: let go
      const res = Heats.swap(heatPlan.schedule, first, { heat: h, lane: l }, heatPlan.count, lanes);
      if (res.error) {
        state.heatMsg = res.error;
        renderHome();
        return;
      }
      api.setSettings({ heatEdits: { ...(saved.heatEdits || {}), [setupId]: { key: heatPlan.key, schedule: res.schedule } } }).then(s => {
        state.settings = s;
        renderHome();
      });
      return;
    }
    if (b.dataset.remove !== undefined) {
      rows.splice(Number(b.dataset.remove), 1);
      persist();
    }
    if (b.id === 'gorace') {
      state.tab = 'race';
      render();
      return;
    }
    if ((b.id === 'resumego' || b.id === 'resumesave') && resume && resume.race) {
      // the race that was interrupted comes back (paused), or is closed and checked for saving
      if (typeof raceActive === 'function' && raceActive()) return;
      if (b.id === 'resumego' && !(await timingReady())) return;
      if (typeof raceActive === 'function' && raceActive()) return; // (the answer may come after another race was started)
      state.race = {
        resources: resume.race.resources || null,
        multiclass: resume.race.multiclass || null,
        virtualRivals: resume.race.virtualRivals || [],
        setup: resume.race.setup,
        track: resume.race.track,
        rows: resume.race.rows,
        ...(resume.race.byTeam ? { byTeam: true } : {}),
        ...(resume.race.schedule ? { schedule: resume.race.schedule, ...(resume.race.labels ? { labels: resume.race.labels } : {}) } : {}),
        ...(resume.race.champ ? { champ: resume.race.champ } : {}),
        resume: b.id === 'resumesave' ? { ...resume, stopNow: true } : resume
      };
      state.tab = 'race';
      render();
      return;
    }
    if (b.id === 'resumedrop') {
      if (
        !(await Dialog.confirm('Delete the race that was interrupted? Its lap results are lost. Resources already consumed remain spent.', {
          ok: 'Delete the race',
          danger: true
        }))
      )
        return;
      Promise.resolve(api.clearResume()).then(() => renderHome());
      return;
    }
    if (b.id === 'guideagain') {
      state.settings = await api.setSettings({ setupGuide: { step: 0 } });
      return renderHome();
    }
    if (b.id === 'sensortest') {
      // (2.3.0: every lane lights up when its sensor sees a car; a lane that saw none is named)
      const id = Hardware.timingChosen(state.settings);
      await SensorTest.openDialog({ lanes, hw: id, name: TIMING_NAMES[id] || id, settings: state.settings });
      return;
    }
    if (b.id === 'start') {
      if (resume?.race?.resources) {
        await Dialog.alert('Resume or discard the unfinished resource event before starting another race.');
        return;
      }
      if (issues.length) return;
      if (typeof raceActive === 'function' && raceActive()) return; // (one race at a time: the one that is running is on the Race tab)
      if (!tokens && !(await timingReady(lanes))) return; // (the timing hardware that was chosen is not connected: asked, and the person may go and connect it)
      if (typeof raceActive === 'function' && raceActive()) return; // (the answer may come after another race was started)
      let go = rot ? here : rows;
      if (enduSingle) {
        // the driver who starts for every team: the one that was chosen, else the next of the team who is not starting for another team (or one picked by lot)
        const taken = new Set(rows.map(r => r.driverId).filter(Boolean)),
          rnd = state.rand || Math.random;
        go = rows.map(r => {
          if (r.driverId) return r;
          const free = membersOf(teamOf(r.teamId)).filter(d => !taken.has(d.id)),
            d = free.length ? (setup.endurance.next === 'random' ? free[Math.floor(rnd() * free.length)] : free[0]) : null;
          if (d) taken.add(d.id);
          return { ...r, driverId: d ? d.id : '' };
        });
      }
      const launch = fullTrack => {
        if (draw !== homeDraw || state.tab !== 'home' || (typeof raceActive === 'function' && raceActive())) return;
        state.race = {
          carRevision: referenceRevision('slotcars'),
          ...(referenceRevision('tracks') ? { catalogueRevision: referenceRevision('tracks') } : {}),
          multiclass: mc,
          setup: rawSetup,
          track: fullTrack,
          rows: go.map(row => ({ ...row, raceClass: MultiClass.resolve(row, mc, { cars, drivers, teams }) })),
          virtualRivals: rivalSelection.entries,
          ...(byTeam ? { byTeam: true } : {}),
          ...(heatPlan ? { schedule: heatPlan.schedule, ...(heatPlan.labels ? { labels: heatPlan.labels } : {}) } : {}),
          ...(ch ? { champ: ch.tag } : {})
        };
        state.tab = 'race';
        render();
      };
      if (api.referenceDetails && referenceRevision('tracks')) {
        if (b.disabled) return;
        b.disabled = true;
        api
          .referenceDetails('tracks', [track.id], referenceRevision('tracks'))
          .then(([full]) => {
            if (!full) throw Error('This track is no longer available.');
            launch(full);
          })
          .catch(error => {
            if (draw === homeDraw && state.tab === 'home' && typeof alert === 'function')
              Dialog.alert('Could not prepare the track: ' + error.message + ' Reopen Home and try again.');
          })
          .finally(() => {
            if (b.isConnected) b.disabled = false;
          });
      } else launch(track);
    }
  };

  // ---- the status chips stay true: the Trackmate can be plugged in while Home is open ----
  const setChips = more => {
    const el = document.getElementById('hm-chips');
    if (el) el.innerHTML = chipsNow(more).map(chipHtml).join('');
    return !!el;
  };
  const run = ++homeRun;
  let netError = '';
  if (homeOffTm) {
    homeOffTm();
    homeOffTm = null;
  }
  if (typeof Trackmate !== 'undefined' && Trackmate.link && Trackmate.link.onStatus) {
    const off = Trackmate.link.onStatus(() => {
      if (run !== homeRun || !setChips({ netError })) {
        off();
        if (homeOffTm === off) homeOffTm = null;
      }
    });
    homeOffTm = off;
  }
  // (the box connects by itself a moment after the app starts, or when the virtual box is ticked: the same chip follows it)
  if (homeOffAb) {
    homeOffAb();
    homeOffAb = null;
  }
  if (abLink && abLink.onStatus) {
    const off = abLink.onStatus(() => {
      if (run !== homeRun || !setChips({ netError })) {
        off();
        if (homeOffAb === off) homeOffAb = null;
      }
    });
    homeOffAb = off;
  }

  if (homeOffDs) {
    homeOffDs();
    homeOffDs = null;
  }
  if (typeof DsTiming !== 'undefined') {
    const off = DsTiming.link.onStatus(() => {
      if (run !== homeRun || !setChips({ netError })) {
        off();
        if (homeOffDs === off) homeOffDs = null;
      }
    });
    homeOffDs = off;
  }
  if (homeOffPt) {
    homeOffPt();
    homeOffPt = null;
  }
  if (typeof pt !== 'undefined') {
    const off = pt.link.onStatus(() => {
      if (run !== homeRun || !setChips({ netError })) {
        off();
        if (homeOffPt === off) homeOffPt = null;
      }
    });
    homeOffPt = off;
  }
  if (homeOffPp) {
    homeOffPp();
    homeOffPp = null;
  }
  if (typeof ParallelPort !== 'undefined') {
    const off = ParallelPort.link.onStatus(() => {
      if (run !== homeRun || !setChips({ netError })) {
        off();
        if (homeOffPp === off) homeOffPp = null;
      }
    });
    homeOffPp = off;
  }
  // ---- the other cards of the grid (1.25.0). The cards that need races come when the laps are in; Rules of this race needs the names of the rule sets of the setup. ----
  const dateText = iso => {
    const d = iso ? new Date(iso) : null;
    return d && !isNaN(d) ? d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  };
  const shortDate = iso => {
    const d = iso ? new Date(iso) : null;
    return d && !isNaN(d) ? d.toLocaleDateString([], { day: 'numeric', month: 'short' }) : '';
  };
  const dn = id => {
      const d = drivers.find(x => x.id === id);
      return d ? titleOf('drivers', d) : '';
    },
    cn = id => {
      const c = cars.find(x => x.id === id);
      return c ? titleOf('slotcars', c) : '';
    };
  const trackNameOf = id => {
    const t = tracks.find(x => x.id === id);
    return t ? t.name || '(unnamed)' : '';
  };
  const others = grid.boards.filter(b => HG.cardOf(b) !== 'start'),
    wants = key => others.some(b => HG.cardOf(b) === key);
  const pictureCards = [];
  const cardsHtml = (laps, lists, summary) => {
    const now = new Date(),
      last = summary ? summary.last : HomeStats.lastRace({ sessions, laps, driverName: dn }),
      out = new Map();
    const d = {
      fmtDate: dateText,
      fmtShort: shortDate,
      fmtDist: m => Stats.fmtDist(m, Speed.distUnitOf(state.settings)),
      trackName: track ? track.name || '' : '',
      hasTrack: !!track,
      hasSetup: !!setup,
      setupName: setup ? setup.name || '' : '',
      last
    };
    const setImages = (kind, id) => {
      const r = id ? imageSets.find(x => x.id === id && x.kind === kind) : null;
      return r && r.images && typeof r.images === 'object' ? r.images : null;
    }; // (the pictures of a picture set; none when it was deleted)
    const nameIn = (list, id) => {
      const x = id && (list || []).find(r => r.id === id);
      return x ? x.name || '(unnamed)' : '';
    };
    others.forEach(b => {
      const key = HG.cardOf(b),
        n = o => Number(HG.optionOf(b, o));
      if (HomeCards.NEEDS_RACES.includes(key) && !last) {
        out.set(key, '');
        return;
      } // (nothing raced yet: one friendly card, below)
      if (summary && Object.hasOwn(summary.cards, key)) Object.assign(d, summary.cards[key]);
      else if (key === 'record')
        d.rec = track
          ? HomeStats.recordCard({
              laps,
              sessions,
              trackId: track.id,
              driverIds: byTeam ? [] : rows.filter(r => !r.absent).map(r => r.driverId),
              driverName: dn,
              carName: cn
            })
          : null;
      else if (key === 'weather')
        d.images = {
          weather: setImages('weather', HG.optionOf(b, 'weatherSet')),
          conditions: setImages('conditions', HG.optionOf(b, 'condSet'))
        };
      else if (key === 'tyres') d.images = { tyres: setImages('tyres', HG.optionOf(b, 'tyreSet')) };
      else if (key === 'glance') d.glance = HomeStats.glance({ sessions, laps, tracks, driverName: dn });
      else if (key === 'recent') d.recent = HomeStats.recent({ sessions, count: n('count') });
      else if (key === 'fastest') {
        d.fastestScope = HG.optionOf(b, 'scope');
        d.fastest = HomeStats.fastestWeek({
          laps,
          sessions,
          trackId: track && track.id,
          scope: d.fastestScope,
          count: n('count'),
          now,
          driverName: dn,
          trackName: trackNameOf
        });
      } else if (key === 'records')
        d.records = HomeStats.allRecords({ laps, sessions, trackName: trackNameOf, driverName: dn, carName: cn });
      else if (key === 'top') {
        d.topPeriod = HG.optionOf(b, 'period');
        d.top = HomeStats.winners({ sessions, driverName: dn, since: d.topPeriod === 'year' ? HomeStats.yearStart(now) : null }).slice(
          0,
          n('count')
        );
      } else if (key === 'mileage') {
        d.mileage = HomeStats.mileage({
          laps,
          tracks,
          carName: cn,
          carPicture: id => {
            const c = cars.find(x => x.id === id);
            return c && typeof c.picture === 'string' ? c.picture : '';
          },
          since: HG.optionOf(b, 'period') === 'year' ? HomeStats.yearStart(now) : null
        }).slice(0, n('count'));
      } else if (key === 'service') {
        // (the cars that need servicing: no races needed)
        const due = CarStats.dueList({
          cars,
          name: c => titleOf('slotcars', c),
          picture: c => (typeof c.picture === 'string' ? c.picture : ''),
          soon: HG.optionOf(b, 'show') === 'due' ? 0 : n('within')
        });
        d.service = due.slice(0, n('count'));
        d.serviceTotal = due.length;
        d.serviceSet = cars.filter(c => CarStats.intervalOf(c) > 0).length;
      } else if (key === 'bests') {
        const grid2 = [];
        rows.forEach((r, i) => {
          if (r.absent) return;
          (byTeam ? membersOf(teamOf(r.teamId)).map(m => m.id) : [r.driverId]).forEach(id =>
            grid2.push({ driverId: id, color: laneHue(i) })
          );
        });
        d.bests = HomeStats.gridBests({ laps, trackId: track && track.id, grid: grid2, driverName: dn });
        // (2.4.0: the track record sits above the drivers of the grid)
        if (!d.rec && track)
          d.rec = HomeStats.recordCard({
            laps,
            sessions,
            trackId: track.id,
            driverIds: byTeam ? [] : rows.filter(r => !r.absent).map(r => r.driverId),
            driverName: dn,
            carName: cn
          });
      } else if (key === 'rules') {
        d.rules = HomeStats.rules(rawSetup, {
          typeLabel,
          distUnit: Speed.distUnitOf(state.settings),
          rotation: rotRec ? rotRec.name || '' : '',
          penalty: nameIn(lists.penaltysystems, setup && setup.penaltySystem),
          damage: nameIn(lists.damagesystems, setup && setup.damageSystem),
          fuel: nameIn(lists.fuelrules, setup && setup.fuelRules),
          weather: nameIn(lists.weathersystems, setup && setup.weather),
          safetyCar: nameIn(lists.safetycarsystems, setup && setup.safetyCar),
          pushSave: nameIn(lists.pushsavesystems, setup && setup.pushSave),
          tyreWear: nameIn(lists.tyrewearsystems, setup && setup.tyreWear),
          tyreWearHere:
            ((lists.tyrewearsystems || []).find(x => setup && x.id === setup.tyreWear) || {})[setup && setup.sessionType] === 'on'
        });
      }
      if (referenceRevision('slotcars') && ['mileage', 'service'].includes(key) && HG.optionOf(b, 'pics'))
        pictureCards.push({ key, data: { ...d }, board: b });
      out.set(key, HomeCards.html(key, d, b));
    });
    if (!last) {
      const first = others.find(b => HomeCards.NEEDS_RACES.includes(HG.cardOf(b)));
      if (first) out.set(HG.cardOf(first), HomeCards.empty());
    } // (the first of them says what will show up)
    return out;
  };
  let allLaps = [],
    summary = null;
  if (api.homeStatistics && !others.some(b => HomeCards.NEEDS_RACES.includes(HG.cardOf(b)))) summary = { last: null, cards: {} };
  else if (api.homeStatistics) {
    const grid2 = [];
    rows.forEach((r, i) => {
      if (!r.absent)
        (byTeam ? membersOf(teamOf(r.teamId)).map(m => m.id) : [r.driverId]).forEach(id =>
          grid2.push({ driverId: id || '', color: laneHue(i) })
        );
    });
    try {
      summary = await api.homeStatistics({
        trackId: track?.id || '',
        driverIds: byTeam ? [] : rows.filter(r => !r.absent).map(r => r.driverId || ''),
        grid: grid2,
        now: new Date().toISOString(),
        boards: others
          .filter(b => ['record', 'glance', 'recent', 'fastest', 'records', 'top', 'mileage', 'bests'].includes(HG.cardOf(b)))
          .map(b => ({
            key: HG.cardOf(b),
            count: Math.min(20, Math.max(1, Number(HG.optionOf(b, 'count')) || 5)),
            period: HG.optionOf(b, 'period') === 'year' ? 'year' : 'all',
            scope: HG.optionOf(b, 'scope') === 'all' ? 'all' : 'track'
          }))
      });
    } catch (error) {
      if (run === homeRun && draw === homeDraw && state.tab === 'home')
        for (const b of others) {
          const el = document.getElementById('hmc-' + HG.cardOf(b));
          if (el) el.innerHTML = '<p class="muted">Could not load Home statistics. Reopen Home to retry.</p>';
        }
      return;
    }
  } else
    try {
      homeLaps = homeLaps || Promise.resolve(api.list('laps'));
      allLaps = await homeLaps;
    } catch (x) {
      homeLaps = null;
      allLaps = [];
    }
  const lists = {};
  if (api.referenceDetails && referenceRevision('imagesets')) {
    const ids = [
      ...new Set(
        others
          .flatMap(b =>
            HG.cardOf(b) === 'weather'
              ? [HG.optionOf(b, 'weatherSet'), HG.optionOf(b, 'condSet')]
              : HG.cardOf(b) === 'tyres'
                ? [HG.optionOf(b, 'tyreSet')]
                : []
          )
          .filter(id => imageSets.some(s => s.id === id))
      )
    ];
    if (ids.length)
      try {
        const selected = await api.referenceDetails('imagesets', ids, referenceRevision('imagesets'));
        for (const row of selected.filter(Boolean)) {
          const index = imageSets.findIndex(s => s.id === row.id);
          imageSets[index] = row;
        }
      } catch {
        /* A changed/deleted optional image set keeps the drawn fallback until refreshed. */
      }
  }
  if (wants('rules') && setup)
    await Promise.all(
      ['penaltysystems', 'damagesystems', 'fuelrules', 'weathersystems', 'tyrewearsystems', 'safetycarsystems', 'pushsavesystems'].map(
        async e => {
          try {
            lists[e] = await api.list(e);
          } catch (x) {
            lists[e] = [];
          }
        }
      )
    );
  if (run !== homeRun || draw !== homeDraw || state.tab !== 'home') return;
  cardsHtml(Array.isArray(allLaps) ? allLaps : [], lists, summary).forEach((html, key) => {
    const el = document.getElementById('hmc-' + key);
    if (el) el.innerHTML = html;
  });
  if (pictureCards.length && api.cataloguePicture) {
    const ids = [...new Set(pictureCards.flatMap(c => (c.data[c.key] || []).map(r => r.carId)))],
      pictures = new Map();
    let next = 0;
    const current = () => run === homeRun && draw === homeDraw && state.tab === 'home';
    await Promise.all(
      Array.from({ length: Math.min(4, ids.length) }, async () => {
        while (current() && next < ids.length) {
          const id = ids[next++];
          try {
            pictures.set(id, await api.cataloguePicture('slotcars', id, referenceRevision('slotcars')));
          } catch {
            /* A missing/stale optional picture must not block Home. */
          }
        }
      })
    );
    if (!current()) return;
    for (const c of pictureCards) {
      for (const row of c.data[c.key] || []) row.picture = pictures.get(row.carId) || '';
      const el = document.getElementById('hmc-' + c.key);
      if (el) el.innerHTML = HomeCards.html(c.key, c.data, c.board);
    }
  }
  if (state.settings.netOn && api.netStatus) {
    // a network that was switched on but could not start gets a red light
    try {
      const st = await api.netStatus();
      if (run === homeRun && st && st.error) {
        netError = st.error;
        setChips({ netError });
      }
    } catch (x) {
      /* the chip stays as the setting says */
    }
  }
}
