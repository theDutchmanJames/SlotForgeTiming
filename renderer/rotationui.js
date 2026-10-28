// Rotation Setups on screen (1.6.0): the list and the editor in Race Setup > Rotation Setups. What a rotation is and every change to it is in rotation.js;
// this file draws it and passes on what is clicked. A race setup chooses a rotation (Home and the race use it, see landing.js).
let rotEd = null; // the rotation being edited: { id, draft, dirty, hold (the participant or the place that is picked), gen (the plan to start from), msg, history }
const ROT_PLANS = [['manual', 'Shuffled', 'Mixes everybody over a number of heats that you choose.'], ['perdriver', 'Same number each', 'Everybody races the same number of heats.'],
  ['roundrobin', 'Round robin', 'Everybody meets everybody.'], ['rotation', 'Lane rotation', 'Everybody races once in every lane.']];
// 1.77.0: the editor has the look of the system forms: a header, a rail and sections that fold (the design is board 9 in docs/ui-reference/race-systems). id: the section and its row in the rail; dom: the id of the card.
const ROT_SECTIONS = [
  { id: 'size', dom: 'ro-sizebox', title: 'Size', ask: 'How many participants and lanes?', icon: 'sliders' },
  { id: 'plan', dom: 'ro-genbox', title: 'Start from a plan', ask: 'Fill the heats from one of the plans a race setup can make', icon: 'dice' },
  { id: 'names', dom: 'ro-namesbox', title: 'Participants', ask: 'Names are optional. Take one out, or add one', icon: 'driver' },
  { id: 'heats', dom: 'ro-heatsbox', title: 'Heats', ask: 'Who races in which heat and lane?', icon: 'lines' },
  { id: 'how', dom: 'ro-howbox', title: 'How often', ask: 'How often everybody races, and in which lane', icon: 'balance' },
  { id: 'groups', dom: 'ro-groupsbox', title: 'Groups', ask: 'Some participants who belong together, such as the juniors', icon: 'layers', optional: true }];
// the sections that are open when the editor opens: the size and the heats, the plan while there are no heats, and the names and the groups when there are some
const rotOpenAtStart = d => {
  const s = new Set(['size', 'heats']); if (!d.heats.length) s.add('plan');
  if ((d.names || []).some(x => String(x || '').trim())) s.add('names'); if ((d.groups || []).length) s.add('groups'); return s;
};
// the race setups that choose this rotation (the box Used by in the rail), or null for a rotation that is not saved yet
async function rotUsedBy(id) {
  if (!id) return null;
  return ((await api.list('racesetups')) || []).filter(x => x.rotation === id).map(x => String(x.name || '').trim() || '(unnamed)');
}

async function renderRotations(box) {
  if (rotEd) { if (!Array.isArray(rotEd.used)) rotEd.used = await rotUsedBy(rotEd.id); return renderRotationEditor(box); }
  manager = null;
  const [list, setups] = await Promise.all([api.list('rotationsetups'), api.list('racesetups')]);
  const usedBy = r => setups.filter(s => s.rotation === r.id).map(s => s.name || '(unnamed)');
  box.innerHTML = `<p class="muted">A rotation setup is a heat plan that you make yourself: how many heats there are, which participant races in which heat and in which lane, and in which order the heats are raced. The participants are numbers (participant 1, 2, 3...), so the same rotation works every club night with other drivers: on the Home tab you choose who is participant 1, 2, 3... Choose a rotation in a race setup (a Heat-based race, under Session).</p>
    <div class="row"><button class="btn primary" id="newrot">New rotation setup</button></div>
    <div class="wrap"><table class="fields"><tr><th>Name</th><th>Size</th><th>Used by</th><th></th></tr>` +
    (list.length ? list.map(r => `<tr><td>${esc(r.name)}</td><td>${esc(Rot.describe(Rot.clean(r)))}</td><td>${usedBy(r).map(esc).join(', ') || '<span class="muted">no race setup</span>'}</td><td class="actions">
      <button class="btn" data-edit="${esc(r.id)}">Edit</button> <button class="btn" data-dup="${esc(r.id)}">Duplicate</button> <button class="btn danger" data-del="${esc(r.id)}">Delete</button></td></tr>`).join('') : '<tr><td colspan="4" class="muted">No rotation setups yet.</td></tr>') + '</table></div>';
  box.onpointerdown = box.onpointermove = box.onpointerup = box.onpointercancel = null; // (dragging belongs to the editor: the list has none)
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
  if (!rotEd.open) rotEd.open = rotOpenAtStart(d); // (the sections that are open; what you open or close is kept while you edit)
  if (!rotEd.rail) rotEd.rail = 'size'; // (the row of the rail that is marked: the section that was opened last)
  const lanes = Array.from({ length: d.lanes }, (_, l) => l);
  const I = (name, size) => Icons.svg(name, { size: size || 16, stroke: 2 });

  // ---- the parts of the page (each can be drawn again by itself, so that a click does not move the page and typing keeps its place) ----
  const poolHtml = () => `<div class="ropool" role="group" aria-label="Participants">${Rot.perParticipant(d).map((x, p) => {
    const on = !!rotEd.hold && rotEd.hold.kind === 'p' && rotEd.hold.p === p;
    return `<button type="button" class="rochip${on ? ' sel' : ''}${x.heats ? '' : ' none'}" data-pp="${p}" aria-pressed="${on}" style="--pc:${Rot.colorOf(p)}" data-color="${Rot.colorOf(p)}" data-short="${esc(Rot.shortOf(d, p))}" title="${esc(Rot.nameOf(d, p))}: races ${x.heats} ${x.heats === 1 ? 'heat' : 'heats'}">${esc(Rot.shortOf(d, p))} <small>${x.heats}</small></button>`; }).join('')}</div>`;
  const holdHtml = () => {
    const h = rotEd.hold;
    if (!h) return '<p class="hint2 ro-help">To fill a place: drag a participant onto it, or click a participant and then a place. To swap two places: drag one onto the other, or click one and then the other. Drag a place back onto the participants to empty it, and drag a heat by its grip (the dots in the first column) to move it. The small number on a participant is the number of heats that participant races.</p>';
    if (h.kind === 'p') return `<p class="hint2 ro-help" role="status">${esc(Rot.nameOf(d, h.p))} is picked. Click a place to put them there; whoever stood there leaves the heat. <button type="button" class="btn" id="ro-drop">Let go</button></p>
      <p class="hint2"><label>Name <input type="text" id="ro-pname" data-pname="${h.p}" value="${esc(d.names[h.p] || '')}" maxlength="${Rot.LIMITS.person}" placeholder="${Rot.isTeams(d) ? 'Team' : 'Participant'} ${h.p + 1}" aria-label="Name of ${Rot.isTeams(d) ? 'team' : 'participant'} ${h.p + 1}"></label> <span class="muted">(optional: it shows on the chip and on the Home tab)</span></p>`;
    const e = d.heats[h.heat] && d.heats[h.heat].places.find(x => x.lane === h.lane);
    return `<p class="hint2 ro-help" role="status">Heat ${h.heat + 1}, lane ${h.lane + 1} (${e ? esc(Rot.nameOf(d, e.p)) : 'empty'}) is picked. Click another place to swap the two. <button type="button" class="btn" id="ro-empty"${e ? '' : ' disabled'}>Empty this place</button> <button type="button" class="btn" id="ro-drop">Let go</button></p>`;
  };
  // the participant whose places are marked: the one that is picked (a participant, or the one in a picked place)
  const focusP = () => { const h = rotEd.hold; if (!h) return null; if (h.kind === 'p') return h.p; const x = d.heats[h.heat], e = x && x.places.find(y => y.lane === h.lane); return e ? e.p : null; };
  const gridHtml = () => {
    if (!d.heats.length) return '<p class="muted">No heats yet. Add a heat, or start from a plan.</p>';
    const h0 = rotEd.hold && rotEd.hold.kind === 'cell' ? rotEd.hold : null, fp = focusP();
    return `<div class="wrap"><table class="fields heatplan-table rogrid${fp !== null ? ' hl' : ''}"><thead><tr><th>Heat</th><th>Label</th>${lanes.map(l => `<th>Lane ${l + 1}</th>`).join('')}<th>Group</th><th>This heat</th></tr></thead><tbody>${d.heats.map((h, i) => `<tr${h.locked ? ' class="rolocked"' : ''} data-hrow="${i}">
      <td><span class="ro-grip" data-hh="${i}"${h.locked ? ' data-lk="1"' : ''} aria-hidden="true" title="${h.locked ? 'This heat is locked' : 'Drag to move this heat'}"></span>${i + 1}${h.locked ? ` <span class="rolockic" title="Locked" aria-hidden="true">${I('lock', 14)}</span>` : ''}</td>
      <td><input type="text" class="rolabel" data-label="${i}" value="${esc(h.label)}" maxlength="${Rot.LIMITS.label}" placeholder="Label" aria-label="Label of heat ${i + 1}"></td>
      ${lanes.map(l => { const e = h.places.find(x => x.lane === l), on = !!h0 && h0.heat === i && h0.lane === l;
        return `<td><button type="button" class="hpcell${e ? '' : ' empty'}${on ? ' sel' : ''}${e && e.p === fp ? ' mine' : ''}" data-cell="${i}:${l}"${e ? ` data-p="${e.p}" data-color="${Rot.colorOf(e.p)}" data-short="${esc(Rot.shortOf(d, e.p))}" style="--pc:${Rot.colorOf(e.p)}"${h.locked ? ' data-lk="1"' : ''}` : ''} aria-pressed="${on}" aria-label="Heat ${i + 1}, lane ${l + 1}: ${e ? esc(Rot.nameOf(d, e.p)) : 'empty'}"${h.locked ? ' title="This heat is locked"' : ''}>${e ? esc(Rot.shortOf(d, e.p)) : '<span>empty</span>'}</button></td>`; }).join('')}
      <td>${d.groups.length ? `<select data-grp="${i}" aria-label="Put a group in heat ${i + 1}"${h.locked ? ' disabled' : ''}><option value="">Put a group here</option>${d.groups.map((g, k) => `<option value="${k}">${esc(g.name || 'Group ' + (k + 1))} (${g.members.length})</option>`).join('')}</select>` : '<span class="muted">–</span>'}</td>
      <td class="actions"><button type="button" class="ib" data-up="${i}" aria-label="Move heat ${i + 1} up" title="Move up"${i === 0 ? ' disabled' : ''}>${I('up')}</button><button type="button" class="ib" data-down="${i}" aria-label="Move heat ${i + 1} down" title="Move down"${i === d.heats.length - 1 ? ' disabled' : ''}>${I('down')}</button><button type="button" class="ib${h.locked ? ' on' : ''}" data-lock="${i}" aria-pressed="${h.locked}" aria-label="${h.locked ? 'Unlock' : 'Lock'} heat ${i + 1}" title="${h.locked ? 'Unlock this heat' : 'Lock this heat'}: a locked heat stays where it is when you shuffle, and its places cannot be changed until you unlock it">${I('lock')}</button>
        <details class="romenu romenu-row"><summary class="ib" aria-label="More for heat ${i + 1}" title="Copy, empty or delete this heat">${I('more')}</summary><div class="romenu-list">
          <button type="button" class="btn" data-dup="${i}" title="Copy this heat, right below itself">Copy this heat</button> <button type="button" class="btn" data-clear="${i}" title="Take everybody out of this heat">Empty this heat</button> <button type="button" class="btn danger" data-del="${i}">Delete this heat</button></div></details></td></tr>`).join('')}</tbody></table></div>`;
  };
  const fixLabel = f => (f.kind === 'idle' ? (f.ps.length === 1 ? 'Add a heat for this participant' : f.ps.length <= d.lanes ? 'Add a heat for them' : `Add a heat for the first ${d.lanes}`) : '');
  const remarksHtml = () => Rot.check(d).map(c => `<p class="rsnote ${c.level === 'warn' ? 'warn' : 'info'}"><span class="rsnic">${Icons.svg(c.level === 'warn' ? 'alert' : 'info', { size: 18, stroke: 1.8 })}</span><span>${esc(c.text)}${c.fix ? ` <button type="button" class="btn" data-fix="${c.fix.kind}">${esc(fixLabel(c.fix))}</button>` : ''}</span></p>`).join('');
  const groupsHtml = () => d.groups.map((g, k) => `<div class="rogroup"><div class="row"><input type="text" data-gname="${k}" value="${esc(g.name)}" maxlength="${Rot.LIMITS.label}" aria-label="Name of group ${k + 1}"> <button type="button" class="btn danger" data-gdel="${k}">Remove this group</button></div>
    <div class="ropool" role="group" aria-label="Participants in ${esc(g.name || 'group ' + (k + 1))}">${Array.from({ length: d.participants }, (_, p) => { const on = g.members.includes(p);
      return `<button type="button" class="rochip${on ? ' sel' : ''}" data-gm="${k}:${p}" aria-pressed="${on}" style="--pc:${Rot.colorOf(p)}" title="${esc(Rot.nameOf(d, p))}">${esc(Rot.shortOf(d, p))}</button>`; }).join('')}</div></div>`).join('') || '<p class="muted">No groups yet.</p>';
  // (1.45.0: every participant has a button that takes it out; the button that adds one is in the section Participants, above the list of names)
  const namesHtml = () => `<div class="ronames">${Array.from({ length: d.participants }, (_, p) => { const w = Rot.isTeams(d) ? 'team' : 'participant';
    return `<span class="roname"><label><i class="rodot" style="--pc:${Rot.colorOf(p)}"></i>P${p + 1} <input type="text" data-name="${p}" value="${esc(d.names[p])}" maxlength="${Rot.LIMITS.person}" placeholder="${Rot.isTeams(d) ? 'Team' : 'Participant'} ${p + 1}" aria-label="Name of ${w} ${p + 1}"></label>`
      + `<button type="button" class="ib rodel" data-delp="${p}" aria-label="Take ${w} ${p + 1} out" title="Take ${w} ${p + 1} out of the rotation"${d.participants <= Rot.LIMITS.minP ? ' disabled' : ''}>${I('x')}</button></span>`; }).join('')}</div>`;
  const addpHtml = () => { const w = Rot.isTeams(d) ? 'team' : 'participant', full = d.participants >= Rot.LIMITS.maxP;
    return `<button type="button" class="btn" data-addp="1"${full ? ' disabled' : ''} title="${full ? `A rotation holds at most ${Rot.LIMITS.maxP}` : `Adds ${w} ${d.participants + 1}, who is in no heat yet`}">${I('plus')} Add a ${w}</button>`; };
  const card = (attr, val, title, note, on) => `<button type="button" class="fu-card${on ? ' on' : ''}" ${attr}="${esc(val)}" aria-pressed="${on}"><span class="fu-ct"><b>${esc(title)}</b></span><span class="fu-cd">${esc(note)}</span><span class="fu-ck" aria-hidden="true">${Icons.svg('check', { size: 14, stroke: 3 })}</span></button>`;
  const plansHtml = () => ROT_PLANS.map(([k, t, note]) => card('data-plan', k, t, note, k === gen.plan)).join('');
  const genOptsHtml = () => (gen.plan === 'manual' ? `<label>Heats <input type="number" id="ro-gheats" min="1" max="${Rot.LIMITS.maxHeats}" value="${esc(gen.heats)}"></label>`
    : gen.plan === 'perdriver' ? `<label>Heats for everybody <input type="number" id="ro-geach" min="1" max="50" value="${esc(gen.each)}"></label>`
    : gen.plan === 'roundrobin' ? `<label><input type="checkbox" id="ro-geven"${gen.even ? ' checked' : ''}> Everybody races the same number of heats</label>` : '');

  // ---- the sections ----
  const sizeBody = () => `<div class="fgrid"><div class="field"><label for="ro-n">Participants</label><input type="number" id="ro-n" min="${Rot.LIMITS.minP}" max="${Rot.LIMITS.maxP}" value="${d.participants}"></div>
      <div class="field"><label for="ro-lanes">Lanes</label><input type="number" id="ro-lanes" min="1" max="${Rot.LIMITS.maxLanes}" value="${d.lanes}"></div>
      <div class="field fu fu-cardfield full"><span class="fu-q" id="ro-kindq">The participants are <small class="muted">Drivers are chosen one by one on Home. Teams are chosen on Home too, and the drivers of a team take turns in the heats.</small></span>
        <div class="fu-cards fu-c2" id="ro-kind" role="group" aria-labelledby="ro-kindq">${card('data-pk', 'drivers', 'Drivers', 'Drivers are chosen one by one on Home.', !Rot.isTeams(d))}${card('data-pk', 'teams', 'Teams', 'Teams are chosen on Home too, and the drivers of a team take turns in the heats.', Rot.isTeams(d))}</div></div>
      <div class="field full"><label for="ro-note">Note <span class="muted">(optional)</span></label><input type="text" id="ro-note" value="${esc(d.note)}" maxlength="${Rot.LIMITS.note}"></div></div>`;
  const planBody = () => `<div class="fgrid"><p class="muted hint full">Fills the rotation with the heats of one of the plans a race setup can make. Change whatever you like afterwards. It replaces all the heats you have now (locked ones too); Undo brings them back.</p>
      <div class="field full"><div class="fu-cards fu-c4" id="ro-plans" role="group" aria-label="Plan">${plansHtml()}</div></div>
      <div class="field full ro-genrow"><span id="ro-genopts">${genOptsHtml()}</span><button type="button" class="btn" id="ro-gen">Make the heats</button></div></div>`;
  const namesBody = () => `<div class="fgrid"><div class="field full ro-nameshead"><span class="muted ro-count" id="ro-count">${d.participants} in all</span>${addpHtml()}</div>
      <div class="field full" id="ro-names">${namesHtml()}</div>
      <p class="muted hint full">${Rot.isTeams(d) ? 'A name only helps you here and on the Home tab, where one button picks the teams that have these names. It does not have to be the name of a team.' : 'A name only helps you here and on the Home tab, where one button picks the drivers who have these names. It does not have to be the name of a driver.'} You can also name a participant by picking it in the section Heats. The × takes a participant out of the rotation (and out of its heats); the ones after it move up one number.</p></div>`;
  const heatsBody = () => `<div class="fgrid"><div class="field full"><div class="ro-heatshead"><h4>Participants <span class="muted ro-sub">Drag one to a place, or click it to pick it up</span></h4></div><div id="ro-pool">${poolHtml()}</div><div id="ro-hold">${holdHtml()}</div></div>
      <div class="field full"><div class="ro-heatshead"><h4>Heats <span class="muted ro-sub">Drag a participant or a place onto a place, or click a place to fill it or to swap it with another place</span></h4>
      <div class="row"><button type="button" class="btn" id="ro-add">${I('plus')} Add a heat</button>
        <details class="romenu" id="ro-tools"><summary class="btn" title="Shuffle the heats or the lanes, or even out the lanes">${I('cog')} Tools</summary><div class="romenu-list">
          <button type="button" class="btn" id="ro-shufo"><strong>Shuffle the heat order</strong><small>Puts the heats in another order. Locked heats stay where they are.</small></button>
          <button type="button" class="btn" id="ro-rev"><strong>Reverse the order</strong><small>Turns the order of the heats round. Locked heats stay where they are.</small></button>
          <button type="button" class="btn" id="ro-shufl"><strong>Shuffle the lanes</strong><small>Puts the participants of every heat in other lanes.</small></button>
          <button type="button" class="btn" id="ro-even"><strong>Even out the lanes</strong><small>Gives out the lanes again so that everybody drives in every lane about equally often. Who races in which heat stays as it is.</small></button></div></details></div></div>
      <div id="ro-grid">${gridHtml()}</div><div id="ro-remarks" class="ro-remarks">${remarksHtml()}</div></div></div>`;
  const howBody = () => `<div class="fgrid"><div class="wrap field full"><table class="fields heatplan-table rohow"><thead><tr><th>Participant</th><th>Heats</th>${lanes.map(l => `<th>Lane ${l + 1}</th>`).join('')}</tr></thead><tbody id="ro-how">${howHtml(d)}</tbody></table></div></div>`;
  const groupsBody = () => `<div class="fgrid"><p class="muted hint full">A group is some participants who belong together, such as the juniors. Put a group in a heat with the choice in the row of that heat: it takes the lanes in the order of the numbers.</p>
      <div class="field full" id="ro-groups">${groupsHtml()}</div><div class="field full"><button type="button" class="btn" id="ro-addgrp">${I('plus')} Add a group</button></div></div>`;
  const BODY = { size: sizeBody, plan: planBody, names: namesBody, heats: heatsBody, how: howBody, groups: groupsBody };
  const sayHtml = parts => `<span class="rsic rssayic">${Icons.svg('say', { size: 20, stroke: 1.7 })}</span><div class="rssaytext"><span class="rseye">In plain words</span><p>${parts.map(p => (p.b ? `<b>${esc(p.t)}</b>` : esc(p.t))).join('')}</p></div>`;
  const words = RotWords.describe(d);

  box.innerHTML = RailForm.shell({ page: true, tag: 'div', formId: 'ro-form', eyebrow: `${rotEd.id ? 'Edit' : 'Add'} rotation setup`, cls: 'setupform ss-rot', icon: n => Icons.svg(n, { size: 20, stroke: 1.7 }),
    tile: Icons.svg('rotation', { size: 26, stroke: 1.6 }), navLabel: 'The sections of this rotation setup', caption: 'This rotation', used: Array.isArray(rotEd.used) ? rotEd.used : null, usedIcon: 'racesetups',
    usedNone: 'Not used yet. Choose it under Session in a race setup (a Heat-based race).',
    name: `<div class="field"><label for="ro-name">Name</label><input type="text" id="ro-name" value="${esc(d.name)}" maxlength="${Rot.LIMITS.name}"></div>`,
    tools: `<button type="button" class="ib" id="ro-undo" title="Undo the last change (Ctrl+Z)" aria-label="Undo" disabled>${I('undo', 18)}</button><button type="button" class="ib" id="ro-redo" title="Redo (Ctrl+Y)" aria-label="Redo" disabled>${I('redo', 18)}</button>`,
    say: sayHtml(words.say),
    sections: ROT_SECTIONS.map(x => ({ id: x.id, domId: x.dom, title: x.title, ask: x.ask, icon: x.icon, optional: !!x.optional, open: rotEd.open.has(x.id), body: BODY[x.id]() })),
    foot: '<span class="muted rsdef">Nothing is written until you press Save. Back asks first if something is not saved.</span><span id="ro-msg" class="muted ro-msg" role="status"></span><button class="btn" type="button" id="ro-back">Back</button><button class="btn primary" type="button" id="ro-save">Save rotation setup</button>' });
  // the header, the sentence and the rail follow what is done (the words are made in rotationwords.js)
  const frame = () => {
    const w = RotWords.describe(d), info = RotWords.rail(d, { plan: gen.plan, heats: gen.heats, each: gen.each });
    const pills = $('rspills'), ready = $('rsready'), say = $('rssay');
    if (pills) pills.innerHTML = w.pills.map(p => `<span class="rspill${p.tone ? ' ' + p.tone : ''}">${esc(p.text)}</span>`).join('');
    if (ready) { ready.className = 'rsready' + (w.ready.ok ? ' ok' : ''); ready.innerHTML = `${Icons.svg(w.ready.ok ? 'check' : 'penalty', { size: 15, stroke: 2 })}${esc(w.ready.text)}`; }
    if (say) say.innerHTML = sayHtml(w.say);
    RailForm.sync(id => document.getElementById(id), info, null, rotEd.rail);
  };
  frame();
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
    const c = $('ro-count'); if (c) c.textContent = `${d.participants} in all`;
    frame();
  });
  const scrolled = fn => { const y = typeof window !== 'undefined' && typeof window.scrollY === 'number' ? window.scrollY : null; fn(); if (y !== null && window.scrollTo) window.scrollTo(0, y); };
  // a change from rotation.js: { rec } goes into the draft (one step to undo), { error } is said
  const apply = (res, full) => {
    if (res.error) { say(res.error); return; }
    Object.keys(d).forEach(k => delete d[k]); Object.assign(d, res.rec);
    rotEd.hold = null; step();
    if (full) scrolled(() => renderRotationEditor(box)); else { refresh(); say(''); }
  };

  // ---- the header and the size ----
  $('ro-name').oninput = e => { d.name = e.target.value; mark(); frame(); };
  $('ro-note').oninput = e => { d.note = e.target.value; mark(); };
  const resize = () => {
    const res = Rot.resize(d, Number($('ro-n').value), Number($('ro-lanes').value));
    if (res.dropped > 0 && !confirm(`This takes away ${res.dropped} ${res.dropped === 1 ? 'place' : 'places'} that no longer fit. Undo brings ${res.dropped === 1 ? 'it' : 'them'} back.\n\nContinue?`)) { renderRotationEditor(box); return; }
    apply(res, true);
  };
  $('ro-n').onchange = resize; $('ro-lanes').onchange = resize;
  let saving = false; // (a second click while the first is being written would add the setup twice)
  $('ro-save').onclick = async () => {
    if (saving) return;
    if (!String(d.name).trim()) { say('Please give the rotation setup a name.'); return; }
    saving = true;
    try {
      U.hist.touch(); const token = U.hist.commit(); // (the state that is written is the one the steps call saved)
      const data = clone(Rot.clean(d));
      if (rotEd.id) await api.update('rotationsetups', rotEd.id, data); else { const row = await api.add('rotationsetups', data); rotEd.id = row.id; }
      U.hist.markSaved(token); rotEd.dirty = !U.hist.isClean(); say('Saved.');
    } finally { saving = false; }
  };
  $('ro-back').onclick = () => { if (rotEd.dirty && !confirm('Discard your unsaved changes to this rotation setup?')) return; draftUndoEnd(rotEd); rotEd = null; renderRotations(box); };

  // ---- the sections: what is open is kept while you edit, and the rail points at the section that was opened last ----
  ROT_SECTIONS.forEach(x => {
    const el = $(x.dom); if (!el) return;
    el.ontoggle = () => { if (el.open === true) { const fresh = !rotEd.open.has(x.id); rotEd.open.add(x.id); if (fresh) { rotEd.rail = x.id; frame(); } } else rotEd.open.delete(x.id); };
  });

  // ---- typing in the page (the parts that hold the text that is typed are not drawn again) ----
  box.oninput = ev => {
    const t = ev.target, ds = t.dataset || {};
    if (t.id === 'ro-gheats') { gen.heats = t.value; gen.chosen = true; frame(); return; }
    if (t.id === 'ro-geach') { gen.each = t.value; frame(); return; }
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
  const drag = RotDrag.attach(box, { d: () => d,
    drop: (from, to) => { const res = RotDrag.plan(d, from, to); if (!res) return false; apply(res); return !res.error; }, // (the same changes as the buttons: an error is said, nothing changes)
    end: changed => { if (!changed) refresh(); } });
  box.onclick = ev => {
    if (drag.suppressed()) return; // (the click that comes after a drag is not a click)
    if (box.querySelectorAll) box.querySelectorAll('details.romenu[open]').forEach(m => { if (!(m.contains && m.contains(ev.target))) m.open = false; }); // (a menu closes when you click somewhere else)
    const b = ev.target.closest('button'); if (!b || b.disabled) return;
    const ds = b.dataset || {}, n = k => Number(ds[k]);
    if (ds.rail !== undefined) { // a row of the rail: open that section and go to it
      const el = $(ROT_SECTIONS.find(x => x.id === ds.rail).dom); if (!el) return;
      el.open = true; rotEd.open.add(ds.rail); rotEd.rail = ds.rail; frame();
      const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'start', behavior: calm ? 'auto' : 'smooth' });
      const head = el.querySelector && el.querySelector('summary'); if (head && typeof head.focus === 'function') head.focus({ preventScroll: true });
      return;
    }
    if (ds.pk !== undefined) { if (ds.pk !== (Rot.isTeams(d) ? 'teams' : 'drivers')) apply(Rot.setParticipantsAre(d, ds.pk), true); return; } // (the cards Drivers and Teams)
    if (ds.addp !== undefined) { const before = d.participants; apply(Rot.addParticipants(d, 1), true); if (d.participants > before && box.querySelector) { const i = box.querySelector(`[data-name="${d.participants - 1}"]`); if (i && i.focus) i.focus(); } return; }
    if (ds.delp !== undefined) {
      const p = n('delp'), res = Rot.removeParticipant(d, p), who = Rot.nameOf(d, p);
      if (!res.error && res.dropped > 0 && !confirm(`${who} is in ${res.dropped} ${res.dropped === 1 ? 'heat' : 'heats'}. Taking them out removes them from ${res.dropped === 1 ? 'that heat' : 'those heats'}, and everybody after them moves up one number. Undo brings them back.\n\nContinue?`)) return;
      apply(res, true); return;
    }
    if (ds.plan !== undefined) { gen.plan = ds.plan; $('ro-plans').innerHTML = plansHtml(); $('ro-genopts').innerHTML = genOptsHtml(); frame(); return; }
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
    if (b.id === 'ro-addgrp') { apply(Rot.addGroup(d)); rotEd.open.add('groups'); $('ro-groupsbox').open = true; return; }
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
function howHtml(d) { return Rot.perParticipant(d).map((x, p) => `<tr><td><i class="rodot" style="--pc:${Rot.colorOf(p)}"></i>${esc(Rot.nameOf(d, p))}</td><td class="num">${x.heats}</td>${x.lanes.map(n => `<td class="num">${n}</td>`).join('')}</tr>`).join(''); }
