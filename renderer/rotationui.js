// Rotation Setups on screen (1.6.0): the list and the editor in Race Setup > Rotation Setups. What a rotation is and every change to it is in rotation.js;
// this file draws it and passes on what is clicked. A race setup chooses a rotation (Home and the race use it, see landing.js).
let rotEd = null; // the rotation being edited: { id, draft, dirty, hold (the participant or the place that is picked), gen (the plan to start from), msg, history }
const ROT_PLANS = [['manual', 'Shuffled', 'Mixes everybody over a number of heats that you choose.'], ['perdriver', 'Same number each', 'Everybody races the same number of heats.'],
  ['roundrobin', 'Round robin', 'Everybody meets everybody.'], ['rotation', 'Lane rotation', 'Everybody races once in every lane.']];

async function renderRotations(box) {
  if (rotEd) return renderRotationEditor(box);
  manager = null;
  const [list, setups] = await Promise.all([api.list('rotationsetups'), api.list('racesetups')]);
  const usedBy = r => setups.filter(s => s.rotation === r.id).map(s => s.name || '(unnamed)');
  box.innerHTML = `<p class="muted">A rotation setup is a heat plan that you make yourself: how many heats there are, which participant races in which heat and in which lane, and in which order the heats are raced. The participants are numbers (participant 1, 2, 3...), so the same rotation works every club night with other drivers: on the Home tab you choose who is participant 1, 2, 3... Choose a rotation in a race setup (a Heat-based race, under Session).</p>
    <div class="row"><button class="btn primary" id="newrot">New rotation setup</button></div>
    <div class="wrap"><table class="fields"><tr><th>Name</th><th>Size</th><th>Used by</th><th></th></tr>` +
    (list.length ? list.map(r => `<tr><td>${esc(r.name)}</td><td>${esc(Rot.describe(Rot.clean(r)))}</td><td>${usedBy(r).map(esc).join(', ') || '<span class="muted">no race setup</span>'}</td><td class="actions">
      <button class="btn" data-edit="${esc(r.id)}">Edit</button> <button class="btn" data-dup="${esc(r.id)}">Duplicate</button> <button class="btn danger" data-del="${esc(r.id)}">Delete</button></td></tr>`).join('') : '<tr><td colspan="4" class="muted">No rotation setups yet.</td></tr>') + '</table></div>';
  box.onclick = async ev => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.id === 'newrot') { rotEd = { id: null, draft: Rot.blank(8, 4, 'New rotation'), dirty: true, hold: null, gen: null, msg: '' }; return renderRotations(box); }
    const r = list.find(x => x.id === (b.dataset.edit || b.dataset.dup || b.dataset.del)); if (!r) return;
    if (b.dataset.edit) { rotEd = { id: r.id, draft: Rot.clean(r, true), dirty: false, hold: null, gen: null, msg: '' }; return renderRotations(box); }
    if (b.dataset.dup) { await api.add('rotationsetups', clone({ ...Rot.clean(r), name: (r.name + ' (copy)').slice(0, Rot.LIMITS.name) })); return renderRotations(box); }
    if (b.dataset.del && confirm(`Delete the rotation setup "${r.name}"?\n\nRace setups that use it plan their heats from their own settings again.\n\nThis can't be undone.`)) { await api.remove('rotationsetups', r.id); renderRotations(box); }
  };
}

function renderRotationEditor(box) {
  const d = rotEd.draft, $ = id => document.getElementById(id);
  const gen = rotEd.gen || (rotEd.gen = { plan: 'manual', heats: 2, each: 2, even: false, chosen: false });
  if (!gen.chosen) gen.heats = Math.max(2, Math.ceil(d.participants / d.lanes)); // (until you type a number of heats, it follows the size: enough heats for everybody to race)
  const lanes = Array.from({ length: d.lanes }, (_, l) => l);

  // ---- the parts of the page (each can be drawn again by itself, so that a click does not move the page and typing keeps its place) ----
  const poolHtml = () => `<div class="ropool" role="group" aria-label="Participants">${Rot.perParticipant(d).map((x, p) => {
    const on = !!rotEd.hold && rotEd.hold.kind === 'p' && rotEd.hold.p === p;
    return `<button type="button" class="rochip${on ? ' sel' : ''}${x.heats ? '' : ' none'}" data-pp="${p}" aria-pressed="${on}" title="${esc(Rot.nameOf(d, p))}: races ${x.heats} ${x.heats === 1 ? 'heat' : 'heats'}">${esc(Rot.shortOf(d, p))} <small>${x.heats}</small></button>`; }).join('')}</div>`;
  const holdHtml = () => {
    const h = rotEd.hold;
    if (!h) return '<p class="hint2 ro-help">To fill a place: click a participant, then a place. To swap two places: click one place, then the other. The small number on a participant is the number of heats that participant races.</p>';
    if (h.kind === 'p') return `<p class="hint2 ro-help" role="status">${esc(Rot.nameOf(d, h.p))} is picked. Click a place to put them there; whoever stood there leaves the heat. <button type="button" class="btn" id="ro-drop">Let go</button></p>
      <p class="hint2"><label>Name <input type="text" id="ro-pname" data-pname="${h.p}" value="${esc(d.names[h.p] || '')}" maxlength="${Rot.LIMITS.person}" placeholder="${Rot.isTeams(d) ? 'Team' : 'Participant'} ${h.p + 1}" aria-label="Name of ${Rot.isTeams(d) ? 'team' : 'participant'} ${h.p + 1}"></label> <span class="muted">(optional: it shows on the chip and on the Home tab)</span></p>`;
    const e = d.heats[h.heat] && d.heats[h.heat].places.find(x => x.lane === h.lane);
    return `<p class="hint2 ro-help" role="status">Heat ${h.heat + 1}, lane ${h.lane + 1} (${e ? esc(Rot.nameOf(d, e.p)) : 'empty'}) is picked. Click another place to swap the two. <button type="button" class="btn" id="ro-empty"${e ? '' : ' disabled'}>Empty this place</button> <button type="button" class="btn" id="ro-drop">Let go</button></p>`;
  };
  const gridHtml = () => {
    if (!d.heats.length) return '<p class="muted">No heats yet. Add a heat, or start from a plan.</p>';
    const h0 = rotEd.hold && rotEd.hold.kind === 'cell' ? rotEd.hold : null;
    return `<div class="wrap"><table class="fields heatplan-table rogrid"><thead><tr><th>Heat</th><th>Label</th>${lanes.map(l => `<th>Lane ${l + 1}</th>`).join('')}<th>Group</th><th>This heat</th></tr></thead><tbody>${d.heats.map((h, i) => `<tr${h.locked ? ' class="rolocked"' : ''}>
      <td>${i + 1}${h.locked ? ' <span title="Locked" aria-hidden="true">🔒</span>' : ''}</td>
      <td><input type="text" class="rolabel" data-label="${i}" value="${esc(h.label)}" maxlength="${Rot.LIMITS.label}" placeholder="Label" aria-label="Label of heat ${i + 1}"></td>
      ${lanes.map(l => { const e = h.places.find(x => x.lane === l), on = !!h0 && h0.heat === i && h0.lane === l;
        return `<td><button type="button" class="hpcell${e ? '' : ' empty'}${on ? ' sel' : ''}" data-cell="${i}:${l}" aria-pressed="${on}" aria-label="Heat ${i + 1}, lane ${l + 1}: ${e ? esc(Rot.nameOf(d, e.p)) : 'empty'}"${h.locked ? ' title="This heat is locked"' : ''}>${e ? esc(Rot.shortOf(d, e.p)) : '<span>empty</span>'}</button></td>`; }).join('')}
      <td>${d.groups.length ? `<select data-grp="${i}" aria-label="Put a group in heat ${i + 1}"${h.locked ? ' disabled' : ''}><option value="">Put a group here</option>${d.groups.map((g, k) => `<option value="${k}">${esc(g.name || 'Group ' + (k + 1))} (${g.members.length})</option>`).join('')}</select>` : '<span class="muted">–</span>'}</td>
      <td class="actions"><button type="button" class="btn" data-up="${i}" aria-label="Move heat ${i + 1} up" title="Move up"${i === 0 ? ' disabled' : ''}>↑</button> <button type="button" class="btn" data-down="${i}" aria-label="Move heat ${i + 1} down" title="Move down"${i === d.heats.length - 1 ? ' disabled' : ''}>↓</button>
        <button type="button" class="btn" data-lock="${i}" aria-pressed="${h.locked}" title="A locked heat stays where it is when you shuffle, and its places cannot be changed until you unlock it">${h.locked ? 'Unlock' : 'Lock'}</button>
        <details class="romenu romenu-row"><summary class="btn" aria-label="More for heat ${i + 1}" title="Copy, empty or delete this heat">⋯</summary><div class="romenu-list">
          <button type="button" class="btn" data-dup="${i}" title="Copy this heat, right below itself">Copy this heat</button> <button type="button" class="btn" data-clear="${i}" title="Take everybody out of this heat">Empty this heat</button> <button type="button" class="btn danger" data-del="${i}">Delete this heat</button></div></details></td></tr>`).join('')}</tbody></table></div>`;
  };
  const fixLabel = f => (f.kind === 'idle' ? (f.ps.length === 1 ? 'Add a heat for this participant' : f.ps.length <= d.lanes ? 'Add a heat for them' : `Add a heat for the first ${d.lanes}`) : '');
  const remarksHtml = () => Rot.check(d).map(c => `<p class="hint2${c.level === 'warn' ? ' hpwarn' : ''}">${esc(c.text)}${c.fix ? ` <button type="button" class="btn" data-fix="${c.fix.kind}">${esc(fixLabel(c.fix))}</button>` : ''}</p>`).join('');
  const groupsHtml = () => d.groups.map((g, k) => `<div class="rogroup"><div class="row"><input type="text" data-gname="${k}" value="${esc(g.name)}" maxlength="${Rot.LIMITS.label}" aria-label="Name of group ${k + 1}"> <button type="button" class="btn danger" data-gdel="${k}">Remove this group</button></div>
    <div class="ropool" role="group" aria-label="Participants in ${esc(g.name || 'group ' + (k + 1))}">${Array.from({ length: d.participants }, (_, p) => { const on = g.members.includes(p);
      return `<button type="button" class="rochip${on ? ' sel' : ''}" data-gm="${k}:${p}" aria-pressed="${on}" title="${esc(Rot.nameOf(d, p))}">${esc(Rot.shortOf(d, p))}</button>`; }).join('')}</div></div>`).join('') || '<p class="muted">No groups yet.</p>';
  const namesHtml = () => `<div class="ronames">${Array.from({ length: d.participants }, (_, p) => `<label>P${p + 1} <input type="text" data-name="${p}" value="${esc(d.names[p])}" maxlength="${Rot.LIMITS.person}" placeholder="${Rot.isTeams(d) ? 'Team' : 'Participant'} ${p + 1}" aria-label="Name of ${Rot.isTeams(d) ? 'team' : 'participant'} ${p + 1}"></label>`).join('')}</div>`;
  const plansHtml = () => `<div class="roplans" role="group" aria-label="Plan">${ROT_PLANS.map(([k, t, note]) => `<button type="button" class="roplan${k === gen.plan ? ' sel' : ''}" data-plan="${k}" aria-pressed="${k === gen.plan}"><strong>${esc(t)}</strong><small>${esc(note)}</small></button>`).join('')}</div>`;
  const genOptsHtml = () => (gen.plan === 'manual' ? `<label>Heats <input type="number" id="ro-gheats" min="1" max="${Rot.LIMITS.maxHeats}" value="${esc(gen.heats)}"></label>`
    : gen.plan === 'perdriver' ? `<label>Heats for everybody <input type="number" id="ro-geach" min="1" max="50" value="${esc(gen.each)}"></label>`
    : gen.plan === 'roundrobin' ? `<label><input type="checkbox" id="ro-geven"${gen.even ? ' checked' : ''}> Everybody races the same number of heats</label>` : '');

  box.innerHTML = `<div class="ed-bar ro-top"><label>Name <input type="text" id="ro-name" value="${esc(d.name)}" maxlength="${Rot.LIMITS.name}"></label>
      ${undoButtons('ro')}<button class="btn primary" id="ro-save">Save rotation setup</button><button class="btn" id="ro-back">Back</button><span id="ro-msg" class="muted" role="status"></span></div>
    <div class="ed-bar ro-size"><strong>Size</strong>
      <label>Participants <input type="number" id="ro-n" min="${Rot.LIMITS.minP}" max="${Rot.LIMITS.maxP}" value="${d.participants}"></label>
      <label>Lanes <input type="number" id="ro-lanes" min="1" max="${Rot.LIMITS.maxLanes}" value="${d.lanes}"></label>
      <label>Participants are <select id="ro-kind" title="Drivers are chosen one by one on Home. Teams are chosen on Home too, and the drivers of a team take turns in the heats."><option value="drivers"${Rot.isTeams(d) ? '' : ' selected'}>Drivers</option><option value="teams"${Rot.isTeams(d) ? ' selected' : ''}>Teams</option></select></label></div>
    <div class="field"><label for="ro-note">Note (optional)</label><input type="text" id="ro-note" value="${esc(d.note)}" maxlength="${Rot.LIMITS.note}"></div>
    <details class="hplanes" id="ro-genbox"${rotEd.genOpen || !d.heats.length ? ' open' : ''}><summary>Start from a plan <span class="muted">(replaces all the heats)</span></summary>
      <p class="hint2">Fills the rotation with the heats of one of the plans a race setup can make. Change whatever you like afterwards. It replaces all the heats you have now (locked ones too); Undo brings them back.</p>
      <div id="ro-plans">${plansHtml()}</div>
      <div class="ed-bar"><span id="ro-genopts">${genOptsHtml()}</span><button type="button" class="btn" id="ro-gen">Make the heats</button></div></details>
    <h4>Participants <span class="muted ro-sub">Click one to pick it up</span></h4><div id="ro-pool">${poolHtml()}</div><div id="ro-hold">${holdHtml()}</div>
    <div class="ro-heatshead"><h4>Heats <span class="muted ro-sub">Click a place to fill it, or to swap it with another place</span></h4>
      <div class="row"><button type="button" class="btn" id="ro-add">Add a heat</button>
        <details class="romenu" id="ro-tools"><summary class="btn" title="Shuffle the heats or the lanes, or even out the lanes">Tools</summary><div class="romenu-list">
          <button type="button" class="btn" id="ro-shufo"><strong>Shuffle the heat order</strong><small>Puts the heats in another order. Locked heats stay where they are.</small></button>
          <button type="button" class="btn" id="ro-rev"><strong>Reverse the order</strong><small>Turns the order of the heats round. Locked heats stay where they are.</small></button>
          <button type="button" class="btn" id="ro-shufl"><strong>Shuffle the lanes</strong><small>Puts the participants of every heat in other lanes.</small></button>
          <button type="button" class="btn" id="ro-even"><strong>Even out the lanes</strong><small>Gives out the lanes again so that everybody drives in every lane about equally often. Who races in which heat stays as it is.</small></button></div></details></div></div>
    <div id="ro-grid">${gridHtml()}</div><div id="ro-remarks">${remarksHtml()}</div>
    <details class="hplanes" id="ro-namesbox"${d.names.some(Boolean) ? ' open' : ''}><summary>Names of the participants (optional)</summary>
      <p class="hint2">${Rot.isTeams(d) ? 'A name only helps you here and on the Home tab, where one button picks the teams that have these names. It does not have to be the name of a team.' : 'A name only helps you here and on the Home tab, where one button picks the drivers who have these names. It does not have to be the name of a driver.'} You can also name a participant by picking it above.</p><div id="ro-names">${namesHtml()}</div></details>
    <details class="hplanes" id="ro-groupsbox"${d.groups.length ? ' open' : ''}><summary>Groups</summary>
      <p class="hint2">A group is some participants who belong together, such as the juniors. Put a group in a heat with the choice in the row of that heat: it takes the lanes in the order of the numbers.</p><div id="ro-groups">${groupsHtml()}</div><button type="button" class="btn" id="ro-addgrp">Add a group</button></details>
    <details class="hplanes"><summary>How often everybody races, and in which lane</summary><div class="wrap"><table class="fields heatplan-table"><thead><tr><th>Participant</th><th>Heats</th>${lanes.map(l => `<th>Lane ${l + 1}</th>`).join('')}</tr></thead><tbody id="ro-how">${howHtml(d)}</tbody></table></div></details>`;
  if (rotEd.msg) { $('ro-msg').textContent = rotEd.msg; rotEd.msg = ''; }

  // ---- undo and redo, and the helpers that change the draft ----
  const U = draftUndo(rotEd, 'ro', () => renderRotationEditor(box)), mark = U.mark, step = U.step;
  const say = t => { const m = $('ro-msg'); if (m) m.textContent = t; };
  const keepFocus = fn => { // (a part that is drawn again keeps the focus on the same button)
    const a = typeof document !== 'undefined' ? document.activeElement : null, ds = (a && a.dataset) || {}, k = ['cell', 'pp', 'gm', 'up', 'down', 'lock', 'dup', 'clear', 'del', 'gdel'].find(x => ds[x] !== undefined);
    fn(); const n = k ? box.querySelector(`[data-${k}="${ds[k]}"]`) : null; if (n && n.focus) n.focus();
  };
  const refresh = skip => keepFocus(() => {
    const s = skip || [], put = (id, html) => { if (!s.includes(id)) $(id).innerHTML = html; };
    put('ro-pool', poolHtml()); put('ro-hold', holdHtml()); put('ro-grid', gridHtml()); put('ro-remarks', remarksHtml()); put('ro-groups', groupsHtml()); put('ro-names', namesHtml()); put('ro-how', howHtml(d));
  });
  const scrolled = fn => { const y = typeof window !== 'undefined' && typeof window.scrollY === 'number' ? window.scrollY : null; fn(); if (y !== null && window.scrollTo) window.scrollTo(0, y); };
  // a change from rotation.js: { rec } goes into the draft (one step to undo), { error } is said
  const apply = (res, full) => {
    if (res.error) { say(res.error); return; }
    Object.keys(d).forEach(k => delete d[k]); Object.assign(d, res.rec);
    rotEd.hold = null; step();
    if (full) scrolled(() => renderRotationEditor(box)); else { refresh(); say(''); }
  };

  // ---- the bar ----
  $('ro-name').oninput = e => { d.name = e.target.value; mark(); };
  $('ro-note').oninput = e => { d.note = e.target.value; mark(); };
  const resize = () => {
    const res = Rot.resize(d, Number($('ro-n').value), Number($('ro-lanes').value));
    if (res.dropped > 0 && !confirm(`This takes away ${res.dropped} ${res.dropped === 1 ? 'place' : 'places'} that no longer fit. Undo brings ${res.dropped === 1 ? 'it' : 'them'} back.\n\nContinue?`)) { renderRotationEditor(box); return; }
    apply(res, true);
  };
  $('ro-n').onchange = resize; $('ro-lanes').onchange = resize;
  $('ro-kind').onchange = e => apply(Rot.setParticipantsAre(d, e.target.value), true);
  $('ro-save').onclick = async () => {
    if (!String(d.name).trim()) { say('Please give the rotation setup a name.'); return; }
    U.hist.touch(); const token = U.hist.commit(); // (the state that is written is the one the steps call saved)
    const data = clone(Rot.clean(d));
    if (rotEd.id) await api.update('rotationsetups', rotEd.id, data); else { const row = await api.add('rotationsetups', data); rotEd.id = row.id; }
    U.hist.markSaved(token); rotEd.dirty = !U.hist.isClean(); say('Saved.');
  };
  $('ro-back').onclick = () => { if (rotEd.dirty && !confirm('Discard your unsaved changes to this rotation setup?')) return; draftUndoEnd(rotEd); rotEd = null; renderRotations(box); };

  // ---- start from a plan ----
  $('ro-genbox').ontoggle = () => { rotEd.genOpen = $('ro-genbox').open === true; };

  // ---- typing in the page (the parts that hold the text that is typed are not drawn again) ----
  box.oninput = ev => {
    const t = ev.target, ds = t.dataset || {};
    if (t.id === 'ro-gheats') { gen.heats = t.value; gen.chosen = true; return; }
    if (t.id === 'ro-geach') { gen.each = t.value; return; }
    if (t.id === 'ro-geven') { gen.even = !!t.checked; return; }
    if (ds.label !== undefined) { const h = d.heats[Number(ds.label)]; if (h) { h.label = t.value; mark(); } return; }
    if (ds.name !== undefined) { d.names[Number(ds.name)] = t.value; mark(); refresh(['ro-groups', 'ro-names']); return; }
    if (ds.pname !== undefined) { d.names[Number(ds.pname)] = t.value; mark(); refresh(['ro-hold']); return; } // (named on the picked chip: the field stays as it is)
    if (ds.gname !== undefined) { const g = d.groups[Number(ds.gname)]; if (g) { g.name = t.value; mark(); refresh(['ro-groups']); } return; }
  };
  box.onchange = ev => {
    const t = ev.target, ds = t.dataset || {};
    if (t.id === 'ro-geven') { gen.even = !!t.checked; return; }
    if (ds.grp !== undefined) { if (t.value === '') return; apply(Rot.assignGroup(d, Number(ds.grp), Number(t.value))); }
  };

  // ---- the clicks ----
  box.onclick = ev => {
    if (box.querySelectorAll) box.querySelectorAll('details.romenu[open]').forEach(m => { if (!(m.contains && m.contains(ev.target))) m.open = false; }); // (a menu closes when you click somewhere else)
    const b = ev.target.closest('button'); if (!b || b.disabled) return;
    const ds = b.dataset || {}, n = k => Number(ds[k]);
    if (ds.plan !== undefined) { gen.plan = ds.plan; $('ro-plans').innerHTML = plansHtml(); $('ro-genopts').innerHTML = genOptsHtml(); return; }
    if (ds.fix === 'idle') { const c = Rot.check(d).find(x => x.fix && x.fix.kind === 'idle'); if (c) apply(Rot.addHeatFor(d, c.fix.ps)); return; }
    if (['ro-shufo', 'ro-rev', 'ro-shufl', 'ro-even'].includes(b.id) && $('ro-tools')) $('ro-tools').open = false;
    if (b.id === 'ro-gen') {
      if (d.heats.some(h => h.places.length) && !confirm('Replace all the heats with a new plan?\n\nLocked heats are replaced too. Undo brings the old heats back.')) return;
      apply(Rot.generate(d, gen), true); return;
    }
    if (b.id === 'ro-add') { apply(Rot.addHeat(d)); return; }
    if (b.id === 'ro-shufo') { apply(Rot.shuffleOrder(d)); return; }
    if (b.id === 'ro-rev') { apply(Rot.reverseOrder(d)); return; }
    if (b.id === 'ro-shufl') { apply(Rot.shuffleLanes(d)); return; }
    if (b.id === 'ro-even') { apply(Rot.evenLanes(d)); return; }
    if (b.id === 'ro-addgrp') { apply(Rot.addGroup(d)); $('ro-groupsbox').open = true; return; }
    if (b.id === 'ro-drop') { rotEd.hold = null; refresh(); return; }
    if (b.id === 'ro-empty') { const h = rotEd.hold; if (h && h.kind === 'cell') apply(Rot.place(d, h.heat, h.lane, null)); return; }
    if (ds.pp !== undefined) { const h = rotEd.hold; rotEd.hold = h && h.kind === 'p' && h.p === n('pp') ? null : { kind: 'p', p: n('pp') }; refresh(); return; }
    if (ds.cell !== undefined) {
      const [i, l] = ds.cell.split(':').map(Number), h = rotEd.hold;
      if (!h) { rotEd.hold = { kind: 'cell', heat: i, lane: l }; refresh(); return; }
      if (h.kind === 'p') { apply(Rot.place(d, i, l, h.p)); return; }
      if (h.heat === i && h.lane === l) { rotEd.hold = null; refresh(); return; }
      apply(Rot.swap(d, h, { heat: i, lane: l })); return;
    }
    if (ds.up !== undefined) { apply(Rot.moveHeat(d, n('up'), -1)); return; }
    if (ds.down !== undefined) { apply(Rot.moveHeat(d, n('down'), 1)); return; }
    if (ds.lock !== undefined) { const h = d.heats[n('lock')]; if (h) apply(Rot.setLocked(d, n('lock'), !h.locked)); return; }
    if (ds.dup !== undefined) { apply(Rot.duplicateHeat(d, n('dup'))); return; }
    if (ds.clear !== undefined) { apply(Rot.clearHeat(d, n('clear'))); return; }
    if (ds.del !== undefined) { apply(Rot.removeHeat(d, n('del'))); return; }
    if (ds.gm !== undefined) { const [k, p] = ds.gm.split(':').map(Number); apply(Rot.toggleMember(d, k, p)); return; }
    if (ds.gdel !== undefined) { apply(Rot.removeGroup(d, n('gdel'))); return; }
  };
}
// the numbers per participant: how many heats, and how often in which lane
function howHtml(d) { return Rot.perParticipant(d).map((x, p) => `<tr><td>${esc(Rot.nameOf(d, p))}</td><td class="num">${x.heats}</td>${x.lanes.map(n => `<td class="num">${n}</td>`).join('')}</tr>`).join(''); }
