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

  box.innerHTML = `<div class="ed-bar ch-top"><label>Name <input type="text" id="ch-name" value="${esc(d.name)}" maxlength="${Champ.LIMITS.name}"></label>
      ${undoButtons('ch')}<button class="btn primary" id="ch-save">Save championship</button><button class="btn" id="ch-back">Back</button><span id="ch-msg" class="muted" role="status"></span></div>
    <p class="hint2">The name shows on the Home tab, on the race screen and in the results of every session of this championship.</p>
    <section class="chsec"><h3>Rounds</h3><p class="hint2">Every session uses one of your race setups, so a championship can mix a short sprint with a long final. The kind (Practice, Qualifying or Race) comes from the race setup. A round with no track of its own uses the track of the race setup. A round that is driven keeps its results: changing its sessions afterwards does not change races that were saved.</p>
      <div class="row"><button type="button" class="btn" id="ch-addround"${d.rounds.length >= Champ.LIMITS.rounds ? ' disabled' : ''} title="A new round starts with the sessions of the round before it">Add a round</button>
        <button type="button" class="btn" id="ch-copyfirst"${d.rounds.length < 2 ? ' disabled' : ''} title="Gives every other round the sessions of round 1">Copy the sessions of round 1 to all rounds</button></div>
      <div id="ch-rounds">${roundsHtml()}</div></section>
    <section class="chsec"><h3>Roster</h3><p class="hint2">The drivers of this championship, from Database > Drivers and Teams. On the Home tab they are listed first in the driver boxes of a session of this championship; another driver drives as a guest. A driver who joins later (the Joins in round column) is in the roster from that round.</p>
      <div id="ch-roster">${rosterHtml()}</div></section>
    <section class="chsec"><h3>What the sessions need from the race setups</h3>
      <p class="hint2"><b>Race:</b> a race, a timed race, a heat race or an Endurance Race. <b>Qualifying:</b> sets the order for the next race of the round, as it does today. <b>Practice:</b> never gives points. A Time Token Session can not be part of a championship.</p></section>`;
  if (chEd.msg) { $('ch-msg').textContent = chEd.msg; chEd.msg = ''; }

  // ---- undo and redo, and the helpers that change the draft ----
  const U = draftUndo(chEd, 'ch', () => renderChampionshipEditor(box)), mark = U.mark, step = U.step;
  const say = t => { const m = $('ch-msg'); if (m) m.textContent = t; };
  const scrolled = fn => { const y = typeof window !== 'undefined' && typeof window.scrollY === 'number' ? window.scrollY : null; fn(); if (y !== null && window.scrollTo) window.scrollTo(0, y); };
  const KEYS = ['sf', 'rf', 'xf', 'sup', 'sdown', 'sdel', 'sadd', 'rup', 'rdown', 'rdel', 'xdel']; // (the control that has the cursor keeps it when the page is drawn again)
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
  };
  box.oninput = e => { // a name or a date or a number: kept in the draft as it is typed (the page is not drawn again, so the cursor stays)
    const t = e.target, ds = t.dataset || {};
    if (ds.rf !== undefined) {
      const [i, key] = String(ds.rf).split(':'), res = key === 'name' || key === 'date' ? Champ.setRound(d, Number(i), { [key]: t.value }) : null;
      if (res && !res.error) { d.rounds[Number(i)][key] = res.rec.rounds[Number(i)][key]; mark(); if (key === 'name') { const n = box.querySelector(`[data-round="${i}"] .chrname`); if (n) n.textContent = d.rounds[Number(i)].name; } }
    }
  };
  box.onchange = e => {
    const t = e.target, ds = t.dataset || {};
    if (ds.rf !== undefined) { const [i, key] = String(ds.rf).split(':'); if (key === 'track') apply(Champ.setRound(d, Number(i), { track: t.value })); else step(); return; }
    if (ds.sf !== undefined) { const [i, k, key] = String(ds.sf).split(':'); apply(Champ.setSession(d, Number(i), Number(k), { [key]: t.value }), key === 'share'); return; }
    if (ds.xf !== undefined) { const at = String(ds.xf).lastIndexOf(':'), driver = String(ds.xf).slice(0, at), key = String(ds.xf).slice(at + 1); apply(Champ.setRoster(d, driver, { [key]: t.value }), true); return; }
    if (t.id === 'ch-adddriver' && t.value) { apply(Champ.addDriver(d, t.value, Champ.teamOfDriver(L.teams, t.value))); return; }
    if (t.id === 'ch-addteam' && t.value) { const team = L.teams.find(x => x.id === t.value), res = Champ.addTeam(d, team, L.drivers); if (res.error) { say(res.error); t.value = ''; return; } apply(res); say(`Added ${res.added} ${res.added === 1 ? 'driver' : 'drivers'}.`); }
  };
}
