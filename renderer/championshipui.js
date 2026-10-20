// Championships on screen (1.55.0): the list and the editor in Race Setup > Championships. What a championship is and every change to it is in championship.js;
// this file draws it and passes on what is clicked. The next session of a championship waits on the Home tab (landing.js).
let chEd = null; // the championship being edited: { id, draft, dirty, open (the ids of the rounds that are open), lists, msg, history }

// the lists the page needs (race setups for the sessions, tracks for the rounds, drivers and teams for the roster, saved sessions for what was driven)
async function champLists() {
  const [setups, tracks, drivers, teams, sessions] = await Promise.all(['racesetups', 'tracks', 'drivers', 'teams', 'sessions'].map(e => api.list(e)));
  return { setups: setups || [], tracks: tracks || [], drivers: drivers || [], teams: teams || [], sessions: sessions || [] };
}

async function renderChampionships(box) {
  manager = null;
  const L = await champLists();
  if (chEd) { chEd.lists = L; return renderChampionshipEditor(box); }
  const list = (await api.list('championships')).map(r => ({ raw: r, c: Champ.clean(r, true) }));
  const row = ({ raw, c }) => {
    const p = Champ.progress(c, L.sessions), bad = Champ.problems(c, L);
    return `<tr><td><strong>${esc(c.name || '(unnamed)')}</strong></td><td>${esc(Champ.describe(c))}</td>
      <td>${p.total ? `${p.driven} of ${p.total} sessions driven${p.complete ? ' · finished' : ''}` : '<span class="muted">nothing to drive yet</span>'}</td>
      <td class="actions"><button class="btn" data-edit="${esc(raw.id)}">Edit</button> <button class="btn" data-dup="${esc(raw.id)}">Duplicate</button> <button class="btn danger" data-del="${esc(raw.id)}">Delete</button></td></tr>
      ${bad.length ? `<tr><td colspan="4"><ul class="issues">${bad.map(t => `<li>${esc(t)}</li>`).join('')}</ul></td></tr>` : ''}`;
  };
  box.innerHTML = `<p class="muted">A championship is a series of rounds. Make the rounds and their sessions here, add the drivers of the roster, and the Home tab shows which session is next. The race that you drive is saved with the name of the championship, the round and the kind of session.</p>
    <div class="row"><button class="btn primary" id="newch">New championship</button></div>
    <div class="wrap"><table class="fields" id="chlist"><tr><th>Name</th><th>Size</th><th>Driven</th><th></th></tr>` +
    (list.length ? list.map(row).join('') : '<tr><td colspan="4" class="muted">No championships yet.</td></tr>') + '</table></div>';
  box.onclick = async ev => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.id === 'newch') { chEd = { id: null, draft: Champ.blank(), dirty: true, open: new Set(), lists: L, msg: '' }; chEd.open.add(chEd.draft.rounds[0].id); return renderChampionships(box); }
    const r = list.find(x => x.raw.id === (b.dataset.edit || b.dataset.dup || b.dataset.del)); if (!r) return;
    if (b.dataset.edit) { chEd = { id: r.raw.id, draft: clone(r.c), dirty: false, open: new Set(), lists: L, msg: '' }; const n = Champ.progress(r.c, L.sessions).next; chEd.open.add((n ? r.c.rounds[n.round] : r.c.rounds[0] || { id: '' }).id); return renderChampionships(box); }
    if (b.dataset.dup) {
      const x = clone(r.c); x.name = (x.name + ' (copy)').slice(0, Champ.LIMITS.name); x.rounds.forEach(q => { delete q.id; q.sessions.forEach(s => { delete s.id; }); });
      await api.add('championships', Champ.clean(x)); return renderChampionships(box);
    }
    if (b.dataset.del && confirm(`Delete the championship "${r.c.name}"?\n\nThe races that were driven for it stay in Results and Records, as normal races.\n\nThis can't be undone.`)) { await api.remove('championships', r.raw.id); renderChampionships(box); }
  };
  box.onchange = box.oninput = box.onpointerdown = null;
}

function renderChampionshipEditor(box) {
  const d = chEd.draft, L = chEd.lists, $ = id => document.getElementById(id);
  const kindWord = Champ.KIND_LABEL;
  const setupOf = id => L.setups.find(s => s.id === id) || null;
  const prog = () => Champ.progress({ ...d, id: chEd.id }, L.sessions);
  const nameOf = (list, e, id) => { const x = list.find(r => r.id === id); return x ? titleOf(e, x) || '(unnamed)' : ''; };

  // ---- the parts of the page ----
  const setupOptions = s => {
    const ok = L.setups.filter(x => Champ.kindOf(x)), cur = s.setup && !ok.some(x => x.id === s.setup) ? setupOf(s.setup) : null;
    return `<option value="">(choose a race setup)</option>` + ok.map(x => `<option value="${esc(x.id)}"${x.id === s.setup ? ' selected' : ''}>${esc(x.name || '(unnamed)')}</option>`).join('')
      + (s.setup && !ok.some(x => x.id === s.setup) ? `<option value="${esc(s.setup)}" selected>${cur ? esc((cur.name || '(unnamed)') + ' (a Time Token Session: not allowed)') : '(this race setup was deleted)'}</option>` : '');
  };
  const sessionHtml = (r, i, s, k) => {
    const setup = setupOf(s.setup), kind = Champ.kindOf(setup), last = r.sessions.length - 1;
    const pts = kind === 'race' ? `<select data-sf="${i}:${k}:share" aria-label="Points count for session ${k + 1} of round ${i + 1}">${Champ.SHARES.map(v => `<option value="${v}"${v === s.share ? ' selected' : ''}>${v === 100 ? '100% (full points)' : v === 50 ? '50% (a sprint)' : 'None'}</option>`).join('')}</select>`
      : kind === 'qualifying' ? '<span class="muted">sets the grid of the race</span>' : kind === 'practice' ? '<span class="muted">never gives points</span>' : '<span class="muted">–</span>';
    return `<div class="chses" data-ses="${i}:${k}"><span class="chnum">${k + 1}</span>
      <select data-sf="${i}:${k}:setup" aria-label="Race setup of session ${k + 1} of round ${i + 1}">${setupOptions(s)}</select>
      <span class="chkind${kind ? ' k-' + kind : ''}">${kind ? esc(kindWord[kind]) : '–'}</span><span class="chpts">${pts}</span>
      <span class="chbtns"><button type="button" class="btn" data-sup="${i}:${k}" aria-label="Move session ${k + 1} of round ${i + 1} up" title="Move up"${k === 0 ? ' disabled' : ''}>↑</button><button type="button" class="btn" data-sdown="${i}:${k}" aria-label="Move session ${k + 1} of round ${i + 1} down" title="Move down"${k === last ? ' disabled' : ''}>↓</button><button type="button" class="btn" data-sdel="${i}:${k}" aria-label="Remove session ${k + 1} of round ${i + 1}" title="Remove this session">×</button></span></div>`;
  };
  const roundHtml = (r, i, p) => {
    const st = p.rounds[i], pill = st.state === 'done' ? 'Done' : st.state === 'next' ? 'Next' : st.state === 'todo' ? 'To do' : '', open = chEd.open.has(r.id);
    const track = nameOf(L.tracks, 'tracks', r.track);
    return `<details class="chround${st.state === 'next' ? ' next' : ''}" data-round="${i}"${open ? ' open' : ''}><summary><span class="chrn">Round ${i + 1}</span><span class="chrname">${esc(r.name)}</span><span class="chrtrack muted">${esc(track || (r.track ? '(deleted track)' : 'track of the race setup'))}</span>`
      + `<span class="muted">${r.sessions.length} ${r.sessions.length === 1 ? 'session' : 'sessions'}${st.driven ? ` · ${st.driven} driven` : ''}</span>${pill ? `<span class="chpill ${st.state}">${pill}</span>` : ''}</summary>
      <div class="chrbody"><div class="chfields">
        <div class="field"><label for="ch-rn-${i}">Round name</label><input type="text" id="ch-rn-${i}" data-rf="${i}:name" value="${esc(r.name)}" maxlength="${Champ.LIMITS.roundName}" placeholder="Round ${i + 1}"></div>
        <div class="field"><label for="ch-rt-${i}">Track</label><select id="ch-rt-${i}" data-rf="${i}:track"><option value="">(the track of the race setup)</option>${L.tracks.map(t => `<option value="${esc(t.id)}"${t.id === r.track ? ' selected' : ''}>${esc(t.name || '(unnamed)')}</option>`).join('')}</select></div>
        <div class="field"><label for="ch-rd-${i}">Date (optional)</label><input type="text" id="ch-rd-${i}" data-rf="${i}:date" value="${esc(r.date)}" maxlength="${Champ.LIMITS.date}" placeholder="Sat 24 Oct 2026"></div></div>
        <h4>Sessions of this round, in the order you drive them</h4>
        ${r.sessions.length ? r.sessions.map((s, k) => sessionHtml(r, i, s, k)).join('') : '<p class="muted">No sessions yet. Add a practice, a qualifying or a race.</p>'}
        <div class="row"><button type="button" class="btn" data-sadd="${i}"${r.sessions.length >= Champ.LIMITS.sessions ? ' disabled' : ''}>Add a session</button>
          <button type="button" class="btn" data-rup="${i}"${i === 0 ? ' disabled' : ''}>Move this round up</button><button type="button" class="btn" data-rdown="${i}"${i === d.rounds.length - 1 ? ' disabled' : ''}>Move this round down</button>
          <button type="button" class="btn danger" data-rdel="${i}">Delete this round</button></div></div></details>`;
  };
  const roundsHtml = () => { const p = prog(); return d.rounds.length ? d.rounds.map((r, i) => roundHtml(r, i, p)).join('') : '<p class="muted">No rounds yet. Add the first round.</p>'; };
  const rosterHtml = () => {
    const have = new Set(d.roster.map(x => x.driver)), free = L.drivers.filter(x => !have.has(x.id));
    return (d.roster.length ? `<div class="wrap"><table class="fields chroster"><thead><tr><th>Driver</th><th>Team</th><th>Joins in round</th><th></th></tr></thead><tbody>${d.roster.map(x => {
      const nm = nameOf(L.drivers, 'drivers', x.driver) || '(deleted driver)';
      return `<tr data-xrow="${esc(x.driver)}"><td><strong>${esc(nm)}</strong></td>
        <td><select data-xf="${esc(x.driver)}:team" aria-label="Team of ${esc(nm)}"><option value="">(no team)</option>${L.teams.map(t => `<option value="${esc(t.id)}"${t.id === x.team ? ' selected' : ''}>${esc(titleOf('teams', t) || '(unnamed)')}</option>`).join('')}</select></td>
        <td><input type="number" min="1" max="${Champ.LIMITS.rounds}" data-xf="${esc(x.driver)}:from" value="${x.from}" aria-label="Round that ${esc(nm)} joins in"></td>
        <td><button type="button" class="btn" data-xdel="${esc(x.driver)}" aria-label="Remove ${esc(nm)} from the roster" title="Remove from the roster">×</button></td></tr>`; }).join('')}</tbody></table></div>`
      : '<p class="muted">The roster is empty. Add the drivers who drive this championship.</p>')
      + `<div class="row"><select id="ch-adddriver" aria-label="Add a driver to the roster"${free.length && d.roster.length < Champ.LIMITS.roster ? '' : ' disabled'}><option value="">Add a driver...</option>${free.map(x => `<option value="${esc(x.id)}">${esc(titleOf('drivers', x) || '(unnamed)')}</option>`).join('')}</select>
        <select id="ch-addteam" aria-label="Add all drivers of a team to the roster"${L.teams.length ? '' : ' disabled'}><option value="">Add all drivers of a team...</option>${L.teams.map(t => `<option value="${esc(t.id)}">${esc(titleOf('teams', t) || '(unnamed)')}</option>`).join('')}</select></div>`;
  };

  // ---- the points: the table, the bonuses, the dropped results, the teams and the ties ----
  const ordinal = n => { const m = n % 100, k = n % 10; return n + (m >= 11 && m <= 13 ? 'th' : k === 1 ? 'st' : k === 2 ? 'nd' : k === 3 ? 'rd' : 'th'); };
  const raceRounds = () => d.rounds.filter(r => r.sessions.some(s => s.share > 0 && Champ.kindOf(setupOf(s.setup)) === 'race')).length;
  const dropSaid = () => { const n = raceRounds(); return d.drops ? (n ? `Best ${Math.max(1, n - d.drops)} of ${n} rounds count.` : 'The best results count (there is no race in the rounds yet).') : 'Every round counts.'; };
  const numIn = (key, id) => `<input type="number" step="any" min="0" id="${id}" data-pf="rule:${key}" value="${d[key]}">`;
  const choose = (key, id, list, label) => `<select id="${id}" data-pf="rule:${key}" aria-label="${esc(label)}">${list.map(([v, t]) => `<option value="${v}"${v === d[key] ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
  const pointsHtml = () => {
    const pre = Champ.presetOf(d), table = d.pointsMode === 'table', n = d.points.length;
    const presets = Champ.PRESETS.map(p => `<button type="button" class="btn${pre === p.id ? ' on' : ''}" data-preset="${p.id}">${esc(p.label)}</button>`).join('') + `<button type="button" class="btn${pre === 'own' ? ' on' : ''}" data-preset="own">My own</button>`;
    const places = table ? `<div class="chplaces">${d.points.map((v, i) => `<div class="field"><label for="ch-pl-${i}">${ordinal(i + 1)}</label><input type="number" step="any" min="0" max="${Champ.LIMITS.points}" id="ch-pl-${i}" data-pf="place:${i}" value="${v}"></div>`).join('')}</div>
      <div class="row"><button type="button" class="btn" data-padd="1"${n >= Champ.LIMITS.places ? ' disabled' : ''}>Add a place</button><button type="button" class="btn" data-prem="1"${n <= 1 ? ' disabled' : ''}>Remove the last place</button></div>
      <div class="chfields"><div class="field"><label for="ch-p-pointsRest">Every finisher after ${ordinal(n)} gets (points)</label>${numIn('pointsRest', 'ch-p-pointsRest')}</div></div>`
      : '<p class="muted">A finisher gets one point for every car that finished behind him or is out. With 4 cars the winner gets 3 points, the second 2, the third 1 and the last 0.</p>';
    return `<div class="field"><label>Points for the finishing places: start from a ready-made table (you can change every number)</label><div class="row" id="ch-presets">${presets}</div></div>${places}
      <p class="hint2">A car that was disqualified or did not finish gets no points for its place. A car that finished, even many laps down, counts as a finisher.</p>
      <h4>Bonus points</h4>
      <div class="chfields"><div class="field"><label for="ch-p-bonusFast">Fastest lap of the race (points)</label>${numIn('bonusFast', 'ch-p-bonusFast')}</div>
        <div class="field"><label for="ch-p-bonusFastTop">Only when the driver finishes in the first (places)</label>${numIn('bonusFastTop', 'ch-p-bonusFastTop')}</div>
        <div class="field"><label for="ch-p-bonusPole">Pole position, fastest in qualifying (points)</label>${numIn('bonusPole', 'ch-p-bonusPole')}</div>
        <div class="field"><label for="ch-p-bonusStart">Starting the race (points for every driver)</label>${numIn('bonusStart', 'ch-p-bonusStart')}</div></div>
      <p class="hint2">Bonus points are added to the points of the race. The fastest lap is the best lap of a car that finished; the pole bonus goes to the driver who was fastest in the qualifying of the same round, if he starts the race.</p>
      <h4>Dropped results</h4>
      <div class="chfields"><div class="field"><label for="ch-p-drops">The worst round results that do not count (per driver and per team)</label>${numIn('drops', 'ch-p-drops')}</div></div>
      <p class="hint2"><span id="ch-dropsaid">${esc(dropSaid())}</span> A dropped result is crossed out in the standings. Drivers and teams are dropped on their own: a team can drop a round that none of its drivers dropped.</p>
      <h4>Teams, ties and sprints</h4>
      <div class="chfields"><div class="field"><label for="ch-p-teamMode">Team points in a race</label>${choose('teamMode', 'ch-p-teamMode', [['best', 'The best drivers of the team'], ['all', 'All drivers of the team'], ['none', 'No team standings']], 'Team points in a race')}</div>
        <div class="field"><label for="ch-p-teamBest">How many drivers of a team count</label><input type="number" step="1" min="1" max="${Champ.LIMITS.teamBest}" id="ch-p-teamBest" data-pf="rule:teamBest" value="${d.teamBest}"${d.teamMode === 'best' ? '' : ' disabled'}></div>
        <div class="field"><label for="ch-p-teamRace">A race of teams (an Endurance Race, a heat race for teams) gives the drivers who drove for a team</label>${choose('teamRace', 'ch-p-teamRace', [['every', 'The points of the team: every driver who drove gets them'], ['split', 'A share of the points, by the laps each one drove'], ['team', 'Nothing: only the team gets points']], 'What a race of teams gives the drivers')}</div>
        <div class="field"><label for="ch-p-teamMin">A driver needs at least this share of the laps of his team (percent, 0 = no minimum)</label><input type="number" step="1" min="0" max="${Champ.LIMITS.teamMin}" id="ch-p-teamMin" data-pf="rule:teamMin" value="${d.teamMin}"${d.teamRace === 'team' ? ' disabled' : ''}></div>
        <div class="field"><label for="ch-p-tie">A tie in the standings is decided by</label>${choose('tie', 'ch-p-tie', [['wins', 'Most wins, then most 2nd places, and so on'], ['last', 'The best result of the last round'], ['qual', 'The best qualifying results (most poles, then most 2nd places, and so on)']], 'A tie in the standings is decided by')}</div>
        <div class="field"><label for="ch-p-sprintRound">A race at 50% (a sprint) gives half of the points, rounded</label>${choose('sprintRound', 'ch-p-sprintRound', [['nearest', 'To the nearest point (12.5 becomes 13)'], ['up', 'Up (12.2 becomes 13)'], ['down', 'Down (12.8 becomes 12)'], ['none', 'Not rounded (12.5 stays 12.5)']], 'Rounding of a sprint')}</div></div>
      <p class="hint2">A team that races as a team always gets the points of its place once, in the Teams standings. Fastest lap: the team and the driver who set the lap. Pole: the team of the pole sitter, and him if he drove. Starting the race: the team and every driver who drove. When two drivers or teams are still level, the order of the roster decides.</p>`;
  };

  box.innerHTML = `<div class="ed-bar ch-top"><label>Name <input type="text" id="ch-name" value="${esc(d.name)}" maxlength="${Champ.LIMITS.name}"></label>
      ${undoButtons('ch')}<button class="btn primary" id="ch-save">Save championship</button><button class="btn" id="ch-back">Back</button><span id="ch-msg" class="muted" role="status"></span></div>
    <p class="hint2">The name shows on the Home tab, on the race screen and in the results of every session of this championship.</p>
    <section class="chsec"><h3>Rounds</h3><p class="hint2">Every session uses one of your race setups, so a championship can mix a short sprint with a long final. The kind (Practice, Qualifying or Race) comes from the race setup. A round with no track of its own uses the track of the race setup. A round that is driven keeps its results: changing its sessions afterwards does not change races that were saved.</p>
      <div class="row"><button type="button" class="btn" id="ch-addround"${d.rounds.length >= Champ.LIMITS.rounds ? ' disabled' : ''} title="A new round starts with the sessions of the round before it">Add a round</button>
        <button type="button" class="btn" id="ch-copyfirst"${d.rounds.length < 2 ? ' disabled' : ''} title="Gives every other round the sessions of round 1">Copy the sessions of round 1 to all rounds</button></div>
      <div id="ch-rounds">${roundsHtml()}</div></section>
    <section class="chsec" id="ch-points"><h3>Points</h3><p class="hint2">Only a race gives points. They are worked out from the saved result of the race, and you award them after the race (a panel on the race screen and in Results and Records). The standings are in Database > Results and Records > Championships.</p>
      <div id="ch-pointsbody">${pointsHtml()}</div></section>
    <section class="chsec"><h3>Roster</h3><p class="hint2">The drivers of this championship, from Database > Drivers and Teams. On the Home tab they are listed first in the driver boxes of a session of this championship; another driver drives as a guest. A driver who joins later (the Joins in round column) is in the roster from that round.</p>
      <div id="ch-roster">${rosterHtml()}</div>
      <label class="inline chguest"><input type="checkbox" id="ch-guest" data-pf="rule:guestRule"${d.guestRule ? ' checked' : ''}> <span>A driver who is not in the roster drives as a guest: he gets no points, and the drivers behind him move up one place. <span class="muted">Switched off: the places stay as they are, and nobody moves up.</span></span></label></section>
    <section class="chsec"><h3>What the sessions need from the race setups</h3>
      <p class="hint2"><b>Race:</b> a race, a timed race, a heat race or an Endurance Race. <b>Qualifying:</b> sets the order for the next race of the round, as it does today. <b>Practice:</b> never gives points. A Time Token Session can not be part of a championship.</p></section>`;
  if (chEd.msg) { $('ch-msg').textContent = chEd.msg; chEd.msg = ''; }

  // ---- undo and redo, and the helpers that change the draft ----
  const U = draftUndo(chEd, 'ch', () => renderChampionshipEditor(box)), mark = U.mark, step = U.step;
  const say = t => { const m = $('ch-msg'); if (m) m.textContent = t; };
  const scrolled = fn => { const y = typeof window !== 'undefined' && typeof window.scrollY === 'number' ? window.scrollY : null; fn(); if (y !== null && window.scrollTo) window.scrollTo(0, y); };
  const KEYS = ['sf', 'rf', 'xf', 'pf', 'preset', 'padd', 'prem', 'sup', 'sdown', 'sdel', 'sadd', 'rup', 'rdown', 'rdel', 'xdel']; // (the control that has the cursor keeps it when the page is drawn again)
  const redraw = () => {
    const a = typeof document !== 'undefined' ? document.activeElement : null, ds = (a && a.dataset) || {}, k = KEYS.find(x => ds[x] !== undefined), id = a && a.id;
    scrolled(() => renderChampionshipEditor(box));
    const n = k ? box.querySelector(`[data-${k}="${ds[k]}"]`) : id ? $(id) : null; if (n && n.focus) n.focus();
  };
  // a change from championship.js: { rec } goes into the draft (one step to undo), { error } is said. quiet: the page is not drawn again (a number or a team that was typed or chosen: nothing else on the page depends on it)
  const apply = (res, quiet) => {
    if (res.error) { say(res.error); return false; }
    Object.keys(d).forEach(k => delete d[k]); Object.assign(d, res.rec); step(); if (!quiet) redraw(); return true;
  };
  // how many saved sessions were driven in a round or a session (they stay in the results, but are no longer part of the championship when it goes)
  const drivenIn = (r, s) => r.sessions.filter(x => (!s || x.id === s.id) && prog().done.has(Champ.keyOf(r.id, x.id))).length;
  const idx = v => String(v).split(':').map(Number);

  // ---- the bar ----
  $('ch-name').oninput = e => { d.name = e.target.value; mark(); };
  let saving = false; // (a second click while the first is being written would add the championship twice)
  $('ch-save').onclick = async () => {
    if (saving) return;
    if (!String(d.name).trim()) { say('Please give the championship a name.'); return; }
    saving = true;
    try {
      U.hist.touch(); const token = U.hist.commit(); // (the state that is written is the one the steps call saved)
      const data = clone(Champ.clean(d));
      if (chEd.id) await api.update('championships', chEd.id, data); else { const row = await api.add('championships', data); chEd.id = row.id; }
      U.hist.markSaved(token); chEd.dirty = !U.hist.isClean(); say('Saved.');
    } finally { saving = false; }
  };
  $('ch-back').onclick = () => { if (chEd.dirty && !confirm('Discard your unsaved changes to this championship?')) return; draftUndoEnd(chEd); chEd = null; renderChampionships(box); };
  $('ch-addround').onclick = () => { const res = Champ.addRound(d); if (!res.error) chEd.open.add(res.rec.rounds[res.rec.rounds.length - 1].id); apply(res); };
  $('ch-copyfirst').onclick = () => {
    if (d.rounds.slice(1).some(r => r.sessions.length) && !confirm('Give every other round the sessions of round 1?\n\nThe sessions they have now are replaced. Undo brings them back.')) return;
    apply(Champ.copyFirstToAll(d));
  };

  // ---- the rounds, the sessions and the roster ----
  box.onclick = ev => {
    const t = ev.target, sum = t.closest && t.closest('summary');
    if (sum) { const dt = sum.parentElement, r = d.rounds[Number(dt.dataset.round)]; if (r) { if (dt.open) chEd.open.delete(r.id); else chEd.open.add(r.id); } return; } // (the click comes before the page opens or closes the round)
    const b = t.closest && t.closest('button'); if (!b || !b.dataset) return;
    const ds = b.dataset;
    if (ds.sadd !== undefined) { const i = Number(ds.sadd); if (d.rounds[i]) chEd.open.add(d.rounds[i].id); apply(Champ.addSession(d, i, '')); return; }
    if (ds.sdel !== undefined) { const [i, k] = idx(ds.sdel), r = d.rounds[i], s = r && r.sessions[k]; if (!s) return; if (drivenIn(r, s) && !confirm(`Session ${k + 1} of round ${i + 1} was driven, and its race is saved. The race stays in the results, but is no longer part of the championship.\n\nRemove the session?`)) return; apply(Champ.removeSession(d, i, k)); return; }
    if (ds.sup !== undefined) { const [i, k] = idx(ds.sup); apply(Champ.moveSession(d, i, k, -1)); return; }
    if (ds.sdown !== undefined) { const [i, k] = idx(ds.sdown); apply(Champ.moveSession(d, i, k, 1)); return; }
    if (ds.rup !== undefined) { apply(Champ.moveRound(d, Number(ds.rup), -1)); return; }
    if (ds.rdown !== undefined) { apply(Champ.moveRound(d, Number(ds.rdown), 1)); return; }
    if (ds.rdel !== undefined) { const i = Number(ds.rdel), r = d.rounds[i]; if (!r) return; const n = drivenIn(r); if (n && !confirm(`Round ${i + 1} has ${n} ${n === 1 ? 'session' : 'sessions'} that ${n === 1 ? 'was' : 'were'} driven, and the races are saved. They stay in the results, but are no longer part of the championship.\n\nDelete the round?`)) return; apply(Champ.removeRound(d, i)); return; }
    if (ds.xdel !== undefined) { apply(Champ.removeDriver(d, ds.xdel)); return; }
    if (ds.preset !== undefined) { apply(Champ.applyPreset(d, ds.preset)); return; }
    if (ds.padd !== undefined) { apply(Champ.addPlace(d)); return; }
    if (ds.prem !== undefined) { apply(Champ.removePlace(d)); return; }
  };
  box.oninput = e => { // a name or a date or a number: kept in the draft as it is typed (the page is not drawn again, so the cursor stays)
    const t = e.target, ds = t.dataset || {};
    if (ds.rf !== undefined) {
      const [i, key] = String(ds.rf).split(':'), res = key === 'name' || key === 'date' ? Champ.setRound(d, Number(i), { [key]: t.value }) : null;
      if (res && !res.error) { d.rounds[Number(i)][key] = res.rec.rounds[Number(i)][key]; mark(); if (key === 'name') { const n = box.querySelector(`[data-round="${i}"] .chrname`); if (n) n.textContent = d.rounds[Number(i)].name; } }
    }
  };
  // the points: a place, a bonus, a rule. It is kept as soon as it is changed (the page is not drawn again; what depends on it is changed where it is)
  const pointsChanged = () => {
    const pre = Champ.presetOf(d), dr = $('ch-dropsaid'), tb = $('ch-p-teamBest'), tm = $('ch-p-teamMin');
    box.querySelectorAll('[data-preset]').forEach(b => { if (b.classList) b.classList.toggle('on', b.dataset.preset === pre); });
    if (dr) dr.textContent = dropSaid(); if (tb) tb.disabled = d.teamMode !== 'best'; if (tm) tm.disabled = d.teamRace === 'team';
  };
  box.onchange = e => {
    const t = e.target, ds = t.dataset || {};
    if (ds.pf !== undefined) {
      const at = String(ds.pf).indexOf(':'), kind = ds.pf.slice(0, at), key = ds.pf.slice(at + 1), isBox = t.type === 'checkbox';
      const res = kind === 'place' ? Champ.setPlace(d, Number(key), t.value) : Champ.setRule(d, key, isBox ? !!t.checked : t.value);
      if (res.error) { say(res.error); if (!isBox) t.value = kind === 'place' ? d.points[Number(key)] : d[key]; return; }
      apply(res, true); if (!isBox) t.value = kind === 'place' ? d.points[Number(key)] : d[key]; // (the number as it was kept: two decimals, in range)
      pointsChanged(); return;
    }
    if (ds.rf !== undefined) { const [i, key] = String(ds.rf).split(':'); if (key === 'track') apply(Champ.setRound(d, Number(i), { track: t.value })); else step(); return; }
    if (ds.sf !== undefined) { const [i, k, key] = String(ds.sf).split(':'); apply(Champ.setSession(d, Number(i), Number(k), { [key]: t.value }), key === 'share'); if (key === 'share') pointsChanged(); return; }
    if (ds.xf !== undefined) { const at = String(ds.xf).lastIndexOf(':'), driver = String(ds.xf).slice(0, at), key = String(ds.xf).slice(at + 1); apply(Champ.setRoster(d, driver, { [key]: t.value }), true); return; }
    if (t.id === 'ch-adddriver' && t.value) { apply(Champ.addDriver(d, t.value, Champ.teamOfDriver(L.teams, t.value))); return; }
    if (t.id === 'ch-addteam' && t.value) { const team = L.teams.find(x => x.id === t.value), res = Champ.addTeam(d, team, L.drivers); if (res.error) { say(res.error); t.value = ''; return; } apply(res); say(`Added ${res.added} ${res.added === 1 ? 'driver' : 'drivers'}.`); }
  };
}

// ---- the points after a race, and the standings (1.56.0) ----
// The pure parts are in champpoints.js (what a race gives, the standings, what the panel says); this is the screen.
const champCtx = D => ({ drivers: D.drivers.map(x => ({ id: x.id, name: titleOf('drivers', x) })), teams: D.teams.map(x => ({ id: x.id, name: titleOf('teams', x) })), setups: D.setups });
async function champData() {
  const [champs, sessions, drivers, teams, setups] = await Promise.all(['championships', 'sessions', 'drivers', 'teams', 'racesetups'].map(e => api.list(e)));
  return { champs: (champs || []).map(r => Champ.clean(r, true)), sessions: (sessions || []).map(x => (Array.isArray(x.standings) ? x : { ...x, standings: [] })), drivers: drivers || [], teams: teams || [], setups: setups || [] };
}
let champView = { id: '', which: 'drivers' }; // the standings page: the championship that is shown, and Drivers, Teams or Rounds

// The panel for one saved session of a championship: the points of a race and what to do with them.
function champPanelHtml(c, v, s) {
  const F = ChampPts.fmt, id = esc(s.id), name = esc(c.name || 'Championship'), head = t => `<div class="chphead"><b>${t}</b></div>`;
  const btn = (act, label, cls) => `<button type="button" class="btn${cls ? ' ' + cls : ''}" data-cp="${act}" data-sid="${id}">${label}</button>`;
  const wrap = (h, body, buttons) => `<div class="chpanel">${h}${body}${buttons ? `<div class="chpbtns">${buttons}</div>` : ''}</div>`;
  const note = t => `<p class="chpnote muted">${t}</p>`;
  const title = `Championship points: ${name}, Round ${v.round}`;
  if (v.state === 'notfound') return wrap(head(title), note('This session is not part of the championship any more (its round or session was removed). The race stays in the results.'));
  if (v.state === 'off') return wrap(head(title), note('Not counted: this race is not a driven session of the championship, and it gives no points.'), btn('on', 'Count it again'));
  if (v.state === 'practice') return wrap(head(title), note('Practice: nothing to award. The results are saved as always.'));
  if (v.state === 'qualifying') return wrap(head(title), note(`Qualifying: the grid for the race of this round.${c.bonusPole > 0 ? (v.pole ? ` Pole position: ${esc(v.pole)}. ${F(c.bonusPole)} bonus ${c.bonusPole === 1 ? 'point' : 'points'} if he starts the race.` : '') : ' This championship has no bonus for pole position.'}`));
  if (v.state === 'noshare') return wrap(head(title), note('This race counts for no points (Race Setup > Championships, the points of the session). It stays in the results.'));
  const cols = [c.bonusFast > 0 && 'fast', c.bonusPole > 0 && 'pole', c.bonusStart > 0 && 'start'].filter(Boolean), sprint = v.share !== 100, anyTeam = v.rows.some(x => x.kind === 'team');
  const lapText = ms => esc(RaceEngine.fmtTime(ms));
  const dash = '<span class="muted">–</span>';
  // a line of the table: a driver, a team that raced as a team (1.57.0), or a driver under the team he drove for
  const lineHtml = (x, member) => {
    const nopts = member && (x.noPoints || x.short), cls = x.guest ? 'chguest' : member ? 'chmember' : x.out ? 'chout' : x.kind === 'team' ? 'chteam' : '';
    const first = member ? '' : x.guest ? 'guest' : x.out ? esc(x.outText) : x.place;
    const who = member ? `<span class="chmem">${esc(x.name)}</span> <span class="muted">${x.laps} ${x.laps === 1 ? 'lap' : 'laps'}${x.short ? ', too few' : ''}</span>` : `<b>${esc(x.name)}</b>${x.kind === 'team' ? ' <span class="muted">team</span>' : ''}`;
    const fast = member ? (x.fastest ? `<b class="fl">+${F(x.fastest)}</b>` : dash) : x.fastest ? `<b class="fl">+${F(x.fastest)}</b> <span class="muted">${lapText(x.best)}</span>` : v.fastest && v.fastest.shown === x.shown ? `<span class="muted">${lapText(x.best)}</span>` : dash;
    return `<tr class="${cls}"><td>${first}</td><td>${who}</td>
    <td class="r">${nopts ? (x.noPoints ? dash : '0') : F(sprint ? x.pts : x.base)}</td>
    ${cols.includes('fast') ? `<td class="r">${nopts ? dash : fast}</td>` : ''}
    ${cols.includes('pole') ? `<td class="r">${!nopts && x.pole ? `<b class="fl">+${F(x.pole)}</b>` : dash}</td>` : ''}
    ${cols.includes('start') ? `<td class="r">${!nopts && x.start ? `+${F(x.start)}` : dash}</td>` : ''}
    <td class="r"><b>${x.guest || nopts || x.total === null ? '–' : F(x.round)}</b></td><td class="r"><b>${x.guest || nopts || x.total === null ? '–' : F(x.total)}</b></td><td class="r ${x.change > 0 ? 'pos' : 'muted'}">${x.guest || nopts || x.total === null ? '' : esc(ChampPts.signed(x.change))}</td></tr>`;
  };
  const rowHtml = x => lineHtml(x, false) + (x.members || []).map(m => lineHtml(m, true)).join('');
  const table = `<div class="wrap"><table class="fields chpt"><thead><tr><th>Pos</th><th>${anyTeam ? 'Driver or team' : 'Driver'}</th><th class="r">Race points${sprint ? ` (at ${v.share}%)` : ''}</th>${cols.includes('fast') ? '<th class="r">Fastest lap</th>' : ''}${cols.includes('pole') ? '<th class="r">Pole</th>' : ''}${cols.includes('start') ? '<th class="r">Start</th>' : ''}<th class="r">This round</th><th class="r">Total now</th><th class="r">Change</th></tr></thead><tbody>${v.rows.map(rowHtml).join('')}</tbody></table></div>`;
  const notes = [...v.notes.map(esc)];
  if (sprint) notes.push(`This race counts at ${v.share}%: the points of the place and the bonuses are halved together, ${{ nearest: 'rounded to the nearest point', up: 'rounded up', down: 'rounded down', none: 'not rounded' }[c.sprintRound]}.`);
  if (c.bonusFast > 0 && v.fastest && !v.fastest.got) notes.push(`The fastest lap (${esc(v.fastest.name)}${v.fastest.team && v.fastest.team !== v.fastest.name ? ' of ' + esc(v.fastest.team) : ''}) gives no bonus: it is outside the first ${c.bonusFastTop} places, or by a guest.`);
  if (c.bonusPole > 0) notes.push(!v.pole ? 'No qualifying session was driven in this round (or nobody set a lap), so nobody gets the pole bonus.' : v.pole.got ? '' : v.pole.team ? `The pole bonus (${esc(v.pole.name)} of ${esc(v.pole.team)}) is not given: the team was disqualified or is a guest.` : `The pole bonus (${esc(v.pole.name)}) is not given: he did not start the race, was disqualified, or is a guest.`);
  if (v.teams && v.teams.length) notes.push(`Teams, this round: ${v.teams.map(t => `${esc(t.name)} ${F(t.pts)}`).join(', ')}.`);
  const lines = notes.filter(Boolean).map(t => `<div>${t}</div>`).join('');
  if (v.awarded) {
    const left = `${v.decided} of ${v.total} ${v.total === 1 ? 'round' : 'rounds'} driven`;
    return wrap(head(title) + `<span class="muted chpstate">Points awarded${v.awarded === 'now' ? '' : ' ' + esc(dateText(v.awarded))}</span>`, table + (lines ? `<div class="chpnote muted">${lines}</div>` : '')
      + `<div class="chpdone"><span class="chpcheck" aria-hidden="true">✓</span><div><b>Points awarded</b><div class="muted">${name} now has ${left}.${v.lead ? ' ' + esc(v.lead) + '.' : ''}</div></div></div>`,
      btn('open', 'Open standings') + btn('undo', 'Undo') + '<span class="muted">Undo takes the points of this race out of the standings again. A race is awarded once: if you award a race again (after a re-run, say), its earlier points are replaced.</span>');
  }
  return wrap(head(title) + '<span class="muted chpstate">Not awarded yet</span>', table + (lines ? `<div class="chpnote muted">${lines}</div>` : ''),
    btn('award', 'Award these points', 'primary') + btn('off', 'Do not count this race') + '<span class="muted">You can still change penalties in the lap review first; the points are worked out from the final result.</span>');
}

// Fills the panels (boxes with data-cpbox = the id of a saved session) and wires their buttons. onDone: what to do after a button changed something (default: fill them again).
async function champPanelsFor(boxes, onDone) {
  if (!boxes.length) return;
  const D = await champData(), ctx = champCtx(D), msgOf = b => b.querySelector && b.querySelector('.chpmsg');
  const fill = () => boxes.forEach(b => {
    const s = D.sessions.find(x => x.id === b.dataset.cpbox), c = s && s.champ && D.champs.find(x => x.id === s.champ.id);
    b.innerHTML = c ? champPanelHtml(c, ChampPts.awardView(c, s, D.sessions, ctx), s) : ''; b.hidden = !b.innerHTML;
    b.onclick = async ev => {
      const btn = ev.target.closest && ev.target.closest('[data-cp]'); if (!btn) return;
      const act = btn.dataset.cp;
      if (act === 'open') { champView.id = s.champ.id; champView.which = 'drivers'; state.resultsSub = 'champs'; state.tab = 'database'; state.sub = 'results'; render(); return; }
      if (act === 'off' && !confirm('Do not count this race for the championship?\n\nIt stays in the results as a normal race and gives no points, and the Home tab offers the session again. You can count it again later.')) return;
      try { for (const p of ChampPts.awardPatches(D.sessions, s, act, new Date().toISOString())) await api.update('sessions', p.id, { champ: p.champ }); }
      catch (x) { b.insertAdjacentHTML ? b.insertAdjacentHTML('beforeend', `<p class="chpmsg" role="alert">Could not save: ${esc(x.message)}</p>`) : null; return; }
      if (onDone) await onDone(s); else await champPanelsFor(boxes, onDone);
    };
  });
  fill();
}
const champPanelsIn = (root, onDone) => champPanelsFor([...root.querySelectorAll('[data-cpbox]')], onDone);

// ---- Database > Results and Records > Championships: the standings ----
const champTableHtml = t => `<div class="wrap"><table class="fields chtable"><thead><tr>${t.columns.map(c => `<th${c.r ? ' class="r"' : ''}${c.title ? ` title="${esc(c.title)}"` : ''}>${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${t.rows.map(r =>
  `<tr${r.lead ? ' class="lead"' : ''}>${r.cells.map((c, i) => `<td class="${(t.columns[i] || {}).r ? 'r ' : ''}${c.cls || ''}">${c.b ? `<b${c.big ? ' class="big"' : ''}>${esc(c.t)}</b>` : esc(c.t)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
  + (t.legend && t.legend.length ? `<p class="muted chlegend">${t.legend.map(l => `<span class="${esc(l.cls)}">${esc(l.text)}</span>`).join(' &nbsp;&middot;&nbsp; ')}</p>` : '');

async function renderChampStandings(box) {
  const D = await champData();
  if (!D.champs.length) { box.innerHTML = '<p class="muted">No championships yet. Make one in Race Setup > Championships. After a race of a championship, its points are awarded here.</p>'; return; }
  let c = D.champs.find(x => x.id === champView.id);
  if (!c) { // the championship that was raced last, else the first
    const last = D.sessions.filter(s => s.champ && D.champs.some(x => x.id === s.champ.id)).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
    c = (last && D.champs.find(x => x.id === last.champ.id)) || D.champs[0]; champView.id = c.id;
  }
  const ctx = champCtx(D), st = ChampPts.standings(c, D.sessions, ctx), pending = ChampPts.pendingOf(c, D.sessions);
  const which = champView.which === 'teams' && st.teams ? 'teams' : champView.which === 'rounds' ? 'rounds' : 'drivers';
  const t = ChampPts.tableOf(c, st, which), lead = ChampPts.leadText(st), more = ChampPts.remainingNote(c, st, D.setups);
  const board = `<div class="chrounds">${st.board.map(b => `<div class="chrc${b.decided ? '' : ' open'}"><div class="muted">${esc(b.label)}</div>${b.decided ? `<b>${esc(b.winner || '–')}</b>` : `<span class="muted">${esc(b.date || 'not driven')}</span>`}</div>`).join('')}</div>`;
  box.innerHTML = `<div class="chstbar"><label class="field"><span class="muted">Championship</span><select id="chs-pick" aria-label="Championship">${D.champs.map(x => `<option value="${esc(x.id)}"${x.id === c.id ? ' selected' : ''}>${esc(x.name || '(unnamed)')}</option>`).join('')}</select></label>
      <div class="sub" id="chs-which" role="tablist"></div><button class="btn primary" id="chs-pdf" type="button">Export to PDF</button><span class="muted" id="chs-msg" role="status"></span></div>
    ${lead || more ? `<p class="chlead">${lead ? `<b>${esc(lead)}.</b> ` : ''}${esc(more)}</p>` : ''}
    ${pending.length ? `<p class="hint2 chpending">${pending.length} ${pending.length === 1 ? 'race of this championship is' : 'races of this championship are'} saved but not awarded yet, so ${pending.length === 1 ? 'it is' : 'they are'} not in the standings. Open ${pending.length === 1 ? 'it' : 'one'} in Racing Records to award the points.</p>` : ''}
    <section class="chsec"><h3>${esc(t.title)}</h3>${t.note && which !== 'rounds' ? `<p class="hint2">${esc(t.note)}</p>` : ''}${which === 'rounds' ? `<p class="hint2">Winner of each race</p>${board}` : champTableHtml(t)}</section>`;
  renderTabs(byId('chs-which'), [['drivers', 'Drivers'], ...(st.teams ? [['teams', 'Teams']] : []), ['rounds', 'Rounds']], which, id => { champView.which = id; renderChampStandings(box); });
  byId('chs-pick').onchange = e => { champView.id = e.target.value; renderChampStandings(box); };
  byId('chs-pdf').onclick = async () => {
    const msg = byId('chs-msg'); msg.textContent = 'Making the PDF...';
    try {
      const res = await api.exportPdf(Report.standingsHtml({ championship: c.name || 'Championship', table: t, lead }), Report.standingsFileName(c.name, which));
      msg.textContent = res.saved ? 'Saved to ' + res.path : 'Export cancelled.';
    } catch (x) { msg.textContent = 'Could not make the PDF: ' + x.message; }
  };
}
