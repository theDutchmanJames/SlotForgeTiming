// Race Setup tab: race setups and timing page layouts, plus the drag-and-drop layout editor.
const PRESETS = [['16:9', 16, 9], ['16:10', 16, 10], ['4:3', 4, 3], ['21:9', 21, 9]];
let editorKeyHandler = null;
const clone = x => JSON.parse(JSON.stringify(x));
const knownWidgets = list => (Array.isArray(list) ? list : []).filter(w => w && Widgets.def(w.type)); // a widget type this version does not know (from a file of another version) is left out instead of breaking the editor
const editorDirty = () => !!(state.editing && state.editing.dirty);

function editorLeave() {
  if (editorKeyHandler) document.removeEventListener('keydown', editorKeyHandler);
  if (state.editing && state.editing.history) state.editing.history.dispose();
  editorKeyHandler = null; state.editing = null;
}

// Undo and redo: a remembered state is put back into the draft itself (the editor holds on to that object). The widgets that are new or different now
// are selected, so you see what came back (a deleted widget) or what moved back.
function restoreDraft(ed, s) {
  const d = ed.draft, had = new Map();
  d.widgets.forEach(w => { const k = JSON.stringify(w); had.set(k, (had.get(k) || 0) + 1); });
  Object.keys(d).forEach(k => delete d[k]); Object.assign(d, s.draft);
  ed.sel = d.widgets.filter(w => { const k = JSON.stringify(w), n = had.get(k) || 0; if (n) { had.set(k, n - 1); return false; } return true; });
  ed.lastDup = null; ed.bgKey = null; ed.bgNode = null;
}
// typing in a text box has its own undo (the browser's); the other controls (a slider, a tick box, a colour) leave Ctrl+Z to the editor
const typingIn = t => !!(t && t.matches && t.matches('input,textarea') && !/^(checkbox|radio|range|color|button|submit|reset|file|image)$/.test(String(t.type || 'text')));

// Undo and redo for the editors that hold one draft: Audio Settings, Image Settings and Widget Builder (ed is audEd, imgEd or wbEd, with its draft and dirty).
// Called every time the editor is drawn (after its HTML is in place): the steps themselves stay in ed.history, so they survive the redraws. p is the start of the
// ids of its buttons: p-undo, p-redo and p-msg. Returns mark() for a change that goes on (typing: a quiet moment ends the step) and step() for a single action.
let draftKeyHandler = null;
function draftUndo(ed, p, redraw) {
  const byId = id => document.getElementById(id);
  const hist = ed.history || (ed.history = Undo.create({ clean: !ed.dirty, get: () => ({ draft: ed.draft }),
    apply: s => { const d = ed.draft; Object.keys(d).forEach(k => delete d[k]); Object.assign(d, s.draft); }, // (put back into the draft itself: what the editor holds stays valid)
    onchange: () => { if (ed.syncUndo) ed.syncUndo(); } }));
  ed.syncUndo = () => { const u = byId(p + '-undo'), r = byId(p + '-redo'); if (u) u.disabled = !hist.canUndo(); if (r) r.disabled = !hist.canRedo(); };
  const say = t => { const m = byId(p + '-msg'); if (m) m.textContent = t; };
  const go = redo => {
    if (!(redo ? hist.redo() : hist.undo())) { say(redo ? 'Nothing to redo.' : 'Nothing to undo.'); return false; }
    ed.dirty = !hist.isClean(); redraw(); const m = byId(p + '-msg'); if (m) m.textContent = redo ? 'Redone.' : 'Undone.'; return true;
  };
  const u = byId(p + '-undo'), r = byId(p + '-redo');
  if (u) u.onclick = () => go(false);
  if (r) r.onclick = () => go(true);
  if (draftKeyHandler) document.removeEventListener('keydown', draftKeyHandler);
  draftKeyHandler = e => {
    const key = String(e.key).toLowerCase();
    if (!(e.ctrlKey || e.metaKey) || (key !== 'z' && key !== 'y') || typingIn(e.target) || dlg.open === true || !byId(p + '-undo')) return; // (a text box has its own undo; and not when this editor is not on the screen)
    e.preventDefault(); go(key === 'y' || !!e.shiftKey);
  };
  document.addEventListener('keydown', draftKeyHandler);
  ed.syncUndo();
  const mark = () => { ed.dirty = true; hist.touch(); };
  return { hist, mark, step: () => { mark(); hist.commit(); }, go };
}
// the editor is closed: its steps are forgotten
function draftUndoEnd(ed) {
  if (draftKeyHandler) document.removeEventListener('keydown', draftKeyHandler);
  draftKeyHandler = null;
  if (ed && ed.history) ed.history.dispose();
}
const undoButtons = p => `<button class="btn" id="${p}-undo" title="Undo the last change (Ctrl+Z)" disabled>Undo</button><button class="btn" id="${p}-redo" title="Redo (Ctrl+Y)" disabled>Redo</button>`;

// Race Setup tab: the race setups you can pick on the Home tab, and the penalty systems they can use
async function renderSetup() {
  view.innerHTML = '<h2>Race Setup</h2><div class="sub" id="setuptabs" role="tablist" style="display:flex;gap:4px"></div><p class="muted" id="setupnote"></p><div id="setupmgr"></div>';
  renderTabs(document.getElementById('setuptabs'), [['setups', 'Race Setups'], ['fuel', 'Fuel Setups'], ['penalties', 'Penalty Systems'], ['tokens', 'Time Tokens']], state.setupSub, id => { state.setupSub = id; renderSetup(); });
  const sub = state.setupSub, entity = sub === 'penalties' ? 'penaltysystems' : sub === 'fuel' ? 'fuelrules' : 'racesetups';
  document.getElementById('setupnote').textContent = sub === 'penalties' ? 'A penalty system says how penalty points turn into time and when a driver is disqualified. Choose one in a race setup.'
    : sub === 'fuel' ? 'A fuel setup sets the tank, how much fuel a lap uses (more when faster, less when slower) and what happens when it runs out. Choose one in a race setup to race with fuel.'
    : sub === 'tokens' ? 'The Time Token System sells track time: a lane is switched on with paid time and turns red when the time is up. These settings are used by every Time Token Session.'
    : 'Create the race setups you want to use. Pick one on the Home tab to start a race.';
  if (sub === 'tokens') { manager = null; return renderTokenSettings(document.getElementById('setupmgr')); }
  await mountManager(document.getElementById('setupmgr'), entity);
}

// Customization tab: Layout Editor, Leaderboard Editor, Audio Settings, Image Settings and Widget Builder
async function renderCustom() {
  if (state.editing) { state.editing.drivers = await api.list('drivers'); state.editing.cars = await api.list('slotcars'); state.editing.rowDesigns = await api.list('rowdesigns'); state.editing.imageSets = await api.list('imagesets'); state.editing.customWidgets = await api.list('customwidgets'); return renderEditor(); } // drivers' pictures are used to preview the Avatar framing
  view.innerHTML = '<h2>Customization</h2><div class="sub" id="customtabs" role="tablist" style="display:flex;gap:4px"></div><div id="setupbox"></div>';
  renderTabs(document.getElementById('customtabs'), [['layouts', 'Layout Editor'], ['rows', 'Leaderboard Editor'], ['audio', 'Audio Settings'], ['images', 'Image Settings'], ['widgets', 'Widget Builder']], state.customSub, id => {
    // the picture set and widget editors are closed by another tab: ask first when there are changes that are not saved
    if (imgEd && imgEd.dirty && !confirm('Discard your unsaved changes to this picture set?')) return;
    if (wbEd && wbEd.dirty && !confirm('Discard your unsaved changes to this widget?')) return;
    state.customSub = id; draftUndoEnd(imgEd); draftUndoEnd(wbEd); imgEd = null; wbEd = null; renderCustom();
  });
  const box = document.getElementById('setupbox');
  if (state.customSub === 'audio') return renderAudioSets(box);
  if (state.customSub === 'rows') return renderRowList(box);
  if (state.customSub === 'images') return renderImageSets(box);
  if (state.customSub === 'widgets') return renderWidgetBuilder(box);
  return renderLayoutList(box);
}

// Image Settings: picture sets for the Fuel and Race flag widgets. A set is made once and chosen in any widget of any layout.
let imgEd = null; // the set being edited: { id, draft, dirty }
const SET_KINDS = [['fuel', 'Fuel (pictures from full to empty)'], ['flag', 'Race flag (one picture per state)'], ['lights', 'Start lights (a picture per light and per race state)'], ['avatars', 'Avatars (a picture per lane)']];
// the pictures of a Start lights set: a grid of rows (Light off, Light on, one per race state) by columns (all lights, light 1 to 5)
const LIGHT_SLOTS = Widgets.LIGHT_ROWS.flatMap(([row, label]) => Widgets.LIGHT_COLS.map(([n, col]) => [Widgets.lightKey(row, n), `${label}, ${col.toLowerCase()}`]));
const AVATAR_SLOTS = Array.from({ length: Avatars.LANES }, (_, i) => [String(i + 1), `Lane ${i + 1}`]);
const setSlots = d => (d.kind === 'avatars' ? AVATAR_SLOTS : d.kind === 'fuel' ? Array.from({ length: Widgets.clampInt(d.steps, 2, 20, 10) }, (_, i) => [i, `${i + 1}${i === 0 ? ' (full)' : i === Widgets.clampInt(d.steps, 2, 20, 10) - 1 ? ' (empty)' : ''}`]) : d.kind === 'lights' ? LIGHT_SLOTS : Widgets.FLAG_STATES);
const setCount = d => setSlots(d).filter(([k]) => (d.images || (d.kind === 'fuel' ? [] : {}))[k]).length;

async function renderImageSets(box) {
  if (imgEd) return renderImageSetEditor(box);
  manager = null;
  const sets = await api.list('imagesets');
  box.innerHTML = `<p class="muted">A picture set is a group of pictures for a widget: the Fuel widget (full to empty), the Race flag widget (one per state) or the Start lights widget (a lit and an unlit light). Make a set once here, then choose it in the widget of any layout instead of uploading the pictures again.</p>
    <div class="row"><button class="btn primary" id="newset">New picture set</button></div>
    <div class="wrap"><table class="fields"><tr><th>Name</th><th>For</th><th>Pictures</th><th></th></tr>` +
    (sets.length ? sets.map(r => `<tr><td>${esc(r.name)}</td><td>${esc((SET_KINDS.find(k => k[0] === r.kind) || [0, r.kind])[1])}</td><td>${setCount(r)} of ${setSlots(r).length}</td><td class="actions">
      <button class="btn" data-edit="${esc(r.id)}">Edit</button> <button class="btn" data-dup="${esc(r.id)}">Duplicate</button> <button class="btn danger" data-del="${esc(r.id)}">Delete</button></td></tr>`).join('') : '<tr><td colspan="4" class="muted">No picture sets yet.</td></tr>') + '</table></div>';
  box.onclick = async ev => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.id === 'newset') { imgEd = { id: null, draft: { name: 'New picture set', kind: 'fuel', steps: 10, images: [] }, dirty: true }; return renderImageSets(box); }
    const r = sets.find(x => x.id === (b.dataset.edit || b.dataset.dup || b.dataset.del)); if (!r) return;
    if (b.dataset.edit) { imgEd = { id: r.id, draft: clone({ name: r.name, kind: r.kind, steps: r.steps || 10, images: r.images || (r.kind === 'fuel' ? [] : {}) }), dirty: false }; return renderImageSets(box); }
    if (b.dataset.dup) { await api.add('imagesets', clone({ name: r.name + ' (copy)', kind: r.kind, steps: r.steps, images: r.images })); return renderImageSets(box); }
    if (b.dataset.del && confirm(`Delete the picture set "${r.name}"?\n\nWidgets that use it show text or a number instead, until you choose another set.\n\nThis can't be undone.`)) { await api.remove('imagesets', r.id); renderImageSets(box); }
  };
}

// The grid of a Start lights set. A cell with no picture of its own shows, dimmed, the picture it will use instead (see Widgets.lightBehind); a plain circle when there is none.
function lightsGridHtml(d) {
  const im = d.images || {};
  const cell = (key, label) => {
    const own = im[key], behind = own ? '' : Widgets.lightBehind(im, key);
    return `<td class="lgcell"><label class="lgpick${own ? '' : behind ? ' behind' : ' none'}" title="${esc(label + (own ? '' : behind ? ': uses the picture of ' + behind.replace('_', ', light ') : ': a plain round light'))}">${own ? `<img src="${esc(own)}" alt="">` : behind ? `<img src="${esc(im[behind])}" alt="">` : '<span class="lgcircle" aria-hidden="true"></span>'}<input type="file" accept="image/*" aria-label="Picture for ${esc(label)}" data-slot="${key}"></label>${own ? `<button class="lgx" type="button" data-clear="${key}" aria-label="Remove the picture for ${esc(label)}" title="Remove">\u00d7</button>` : ''}</td>`;
  };
  return `<div class="wrap"><table class="fields lgrid"><tr><th>State</th>${Widgets.LIGHT_COLS.map(([, c]) => `<th>${esc(c)}</th>`).join('')}</tr>${Widgets.LIGHT_ROWS.map(([row, label]) => `<tr><th scope="row">${esc(label)}</th>${Widgets.LIGHT_COLS.map(([n, c]) => cell(Widgets.lightKey(row, n), `${label}, ${c.toLowerCase()}`)).join('')}</tr>`).join('')}</table></div>`;
}
// what the five lights look like in a state, from the pictures of the set (three lights on, two off): the countdown or a race state
const LIGHT_PREVIEWS = [['countdown', 'The countdown'], ...Widgets.FLAG_STATES];
function lightsPreviewHtml(d) {
  const st = LIGHT_PREVIEWS.some(([k]) => k === imgEd.preview) ? imgEd.preview : 'countdown', im = d.images || {};
  return `<div class="lgprev"><label>Preview: <select id="is-prev">${LIGHT_PREVIEWS.map(([k, t]) => `<option value="${k}"${k === st ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
    <div class="lgprevbox" id="is-prevbox">${Widgets.lightsHtml(3, { pick: (i, lit) => Widgets.lightPic(im, st, i, lit) }, Widgets.lightColor({}, st))}</div><span class="muted">Three lights on, two off.</span></div>`;
}

function renderImageSetEditor(box) {
  const d = imgEd.draft, fuel = d.kind === 'fuel';
  box.innerHTML = `<div class="ed-bar"><label>Name <input type="text" id="is-name" value="${esc(d.name)}" maxlength="40"></label>
      <label>For <select id="is-kind" ${imgEd.id ? 'disabled' : ''}>${SET_KINDS.map(([k, t]) => `<option value="${k}"${k === d.kind ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
      ${fuel ? `<label>Number of pictures (2 to 20) <input type="number" id="is-steps" min="2" max="20" value="${Widgets.clampInt(d.steps, 2, 20, 10)}" style="width:5em"></label>` : ''}
      ${undoButtons('is')}<button class="btn primary" id="is-save">Save picture set</button><button class="btn" id="is-back">Back</button><span id="is-msg" class="muted" role="status"></span></div>
    <p class="muted">${fuel ? 'The first picture shows when the tank is full, the last when it is empty.' : d.kind === 'lights' ? 'Every light can have its own picture for every state of the race. A cell you leave empty uses the dimmed picture shown in it: the "All lights" picture of its row, then Light on (or Light off for a light that is off). A light with no picture at all is drawn as a plain round light. Light on is also what the countdown uses.' : d.kind === 'avatars' ? 'One avatar for each lane (up to 8). The Avatar widget shows the picture of the driver; a driver without a picture gets the avatar of the lane he or she drives in. A lane you leave empty uses the standard avatar shown dimmed in it.' : 'A state without a picture shows its name as text.'} Pictures keep their transparency (a PNG stays a PNG).${Picture.NOTE}</p>
    ${d.kind === 'lights' ? lightsPreviewHtml(d) + lightsGridHtml(d) : `<div class="wrap"><table class="fields"><tr><th>${fuel ? 'Picture' : 'State'}</th><th>Preview</th><th></th></tr>${setSlots(d).map(([k, label]) => { const img = (d.images || {})[k];
      return `<tr><td>${esc(label)}</td><td>${img ? `<img class="optimg" src="${esc(img)}" alt="">` : d.kind === 'avatars' ? `<img class="optimg dim" src="${esc(Avatars.STANDARD[Number(k) - 1])}" alt=""> <span class="muted">the standard avatar</span>` : '<span class="muted">none</span>'}</td><td class="actions"><input type="file" accept="image/*" aria-label="Picture for ${esc(String(label))}" data-slot="${k}">${img ? ` <button class="btn" type="button" data-clear="${k}">Remove</button>` : ''}</td></tr>`; }).join('')}</table></div>`}`;
  // Undo and redo (a typed name is one step after a quiet moment; every other change is a step of its own)
  const U = draftUndo(imgEd, 'is', () => renderImageSetEditor(box)), mark = U.mark, step = U.step;
  const $ = id => document.getElementById(id);
  $('is-name').oninput = e => { d.name = e.target.value; mark(); };
  if ($('is-prev')) $('is-prev').onchange = e => { imgEd.preview = e.target.value; renderImageSetEditor(box); };
  $('is-kind').onchange = e => { d.kind = e.target.value; d.images = d.kind === 'fuel' ? [] : {}; step(); renderImageSetEditor(box); };
  if ($('is-steps')) $('is-steps').onchange = e => { d.steps = Widgets.clampInt(e.target.value, 2, 20, 10); d.images = (d.images || []).slice(0, d.steps); step(); renderImageSetEditor(box); };
  $('is-save').onclick = async () => {
    d.name = d.name.trim(); if (!d.name) { $('is-msg').textContent = 'Please give the set a name.'; return; }
    U.hist.touch(); const token = U.hist.commit(); // (the state that is written is the one the steps call saved)
    const data = clone({ name: d.name, kind: d.kind, ...(d.kind === 'fuel' ? { steps: Widgets.clampInt(d.steps, 2, 20, 10), images: Array.from({ length: Widgets.clampInt(d.steps, 2, 20, 10) }, (_, i) => (d.images || [])[i] || '') } : { images: d.images || {} }) });
    if (imgEd.id) await api.update('imagesets', imgEd.id, data); else { const row = await api.add('imagesets', data); imgEd.id = row.id; }
    U.hist.markSaved(token); imgEd.dirty = !U.hist.isClean(); $('is-msg').textContent = 'Saved.'; // (a change made while it was being written is not saved yet)
  };
  $('is-back').onclick = () => { if (imgEd.dirty && !confirm('Discard your unsaved changes to this picture set?')) return; draftUndoEnd(imgEd); imgEd = null; renderImageSets(box); };
  box.onclick = ev => { const b = ev.target.closest('button'); if (b && b.dataset.clear !== undefined) { if (Array.isArray(d.images)) d.images[b.dataset.clear] = ''; else delete d.images[b.dataset.clear]; step(); renderImageSetEditor(box); } }; // (a picture set of a flag or of lights is a list of the cells that have a picture: a removed picture leaves no empty entry)
  box.onchange = async ev => {
    const t = ev.target; if (t.dataset.slot === undefined || !t.files || !t.files[0]) return;
    try { const img = await resizeImage(t.files[0], fuel ? 256 : 512, true); if (fuel) { d.images = d.images || []; d.images[Number(t.dataset.slot)] = img; } else { d.images = d.images || {}; d.images[t.dataset.slot] = img; } step(); renderImageSetEditor(box); }
    catch (x) { $('is-msg').textContent = x.message; }
  };
}

// Leaderboard Editor: designs for one row of the leaderboard, built from the driver widgets
async function renderRowList(box) {
  manager = null;
  const designs = await api.list('rowdesigns');
  box.innerHTML = `<p class="muted">A row design is one line of the leaderboard: place the driver widgets in it once and every driver gets that row. Choose a design in the Leaderboard widget (Layout Editor) or on the Live Race page.</p>
    <div class="row"><button class="btn primary" id="newr">New row design</button></div>
    <div class="wrap"><table class="fields"><tr><th>Name</th><th>Note</th><th>Row height</th><th>Widgets</th><th></th></tr>` +
    (designs.length ? designs.map(l => `<tr><td>${esc(l.name)}</td><td class="muted">${esc(l.note || '')}</td><td>${esc(l.ratioH)}</td><td>${(l.widgets || []).length}</td><td class="actions">
      <button class="btn" data-edit="${esc(l.id)}">Edit</button> <button class="btn" data-dup="${esc(l.id)}">Duplicate</button> <button class="btn danger" data-del="${esc(l.id)}">Delete</button></td></tr>`).join('') : '<tr><td colspan="5" class="muted">No row designs yet.</td></tr>') + '</table></div>';
  const keep = l => clone({ kind: 'row', name: l.name, note: l.note || '', ratioW: Widgets.U, ratioH: l.ratioH, widgets: l.widgets, guides: l.guides || { v: [], h: [] }, laneColors: [],
    gap: l.gap, radius: l.radius, header: l.header, headerH: l.headerH, headerBg: l.headerBg, headerText: l.headerText, rowBg: l.rowBg, rowText: l.rowText, altBg: l.altBg, states: l.states,
    outBg: l.outBg, outText: l.outText, pitBg: l.pitBg, pitText: l.pitText, penBg: l.penBg, penText: l.penText, leaderBg: l.leaderBg, leaderText: l.leaderText });
  const open = (draft, id) => { state.editing = { id, kind: 'row', draft: { guides: { v: [], h: [] }, laneColors: [], note: '', ...draft, widgets: knownWidgets(draft.widgets), kind: 'row' }, sel: [], snap: true, dirty: id === null, dupStep: null, lastDup: null }; render(); };
  box.onclick = async ev => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.id === 'newr') return open(Rows.defaultDesign(), null);
    const l = designs.find(x => x.id === (b.dataset.edit || b.dataset.dup || b.dataset.del));
    if (!l) return;
    if (b.dataset.edit) open(keep(l), l.id);
    if (b.dataset.dup) { await api.add('rowdesigns', { ...keep(l), name: l.name + ' (copy)' }); renderRowList(box); }
    if (b.dataset.del && confirm(`Delete the row design "${l.name}"?\n\nLeaderboards that use it show the classic table instead.\n\nThis can't be undone.`)) { await api.remove('rowdesigns', l.id); renderRowList(box); }
  };
}

async function renderLayoutList(box) {
  manager = null;
  const layouts = await api.list('layouts');
  const prop = l => `${l.ratioW}:${l.ratioH}`;
  box.innerHTML = `<p class="muted">A layout is a timing page you design once and use in any race setup.</p>
    <div class="row"><button class="btn primary" id="newl">New layout</button></div>
    <div class="wrap"><table class="fields"><tr><th>Name</th><th>Note</th><th>Proportions</th><th>Widgets</th><th></th></tr>
    <tr><td>Default layout</td><td class="muted">Built in, used when a race setup has none</td><td>16:9</td><td>${Widgets.defaultLayout().widgets.length}</td>
      <td class="actions"><button class="btn" id="copydef">Copy to edit</button></td></tr>
    <tr><td>Default token layout</td><td class="muted">Built in, used by a Time Token Session when its race setup has none</td><td>16:9</td><td>${Widgets.tokenLayout().widgets.length}</td>
      <td class="actions"><button class="btn" id="copytok">Copy to edit</button></td></tr>` +
    layouts.map(l => `<tr><td>${esc(l.name)}</td><td class="muted">${esc(l.note || '')}</td><td>${esc(prop(l))}</td><td>${(l.widgets || []).length}</td><td class="actions">
      <button class="btn" data-edit="${esc(l.id)}">Edit</button> <button class="btn" data-dup="${esc(l.id)}">Duplicate</button> <button class="btn danger" data-del="${esc(l.id)}">Delete</button></td></tr>`).join('') +
    '</table></div>';
  const open = (draft, id) => { state.editing = { id, draft: { guides: { v: [], h: [] }, laneColors: [], note: '', ...draft, widgets: knownWidgets(draft.widgets) }, sel: [], snap: true, dirty: id === null, dupStep: null, lastDup: null }; render(); };
  box.onclick = async ev => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.id === 'newl') return open({ name: 'New layout', ratioW: 16, ratioH: 9, widgets: [] }, null);
    if (b.id === 'copytok') { const d = Widgets.tokenLayout(); return open({ name: 'My token layout', ratioW: d.ratioW, ratioH: d.ratioH, widgets: d.widgets, guides: { v: [], h: [] }, laneColors: [] }, null); }
    if (b.id === 'copydef') { const d = Widgets.defaultLayout(); return open({ name: 'My layout', ratioW: d.ratioW, ratioH: d.ratioH, widgets: d.widgets, guides: { v: [], h: [] }, laneColors: [] }, null); }
    const l = layouts.find(x => x.id === (b.dataset.edit || b.dataset.dup || b.dataset.del));
    if (!l) return;
    if (b.dataset.edit) open(clone({ name: l.name, note: l.note || '', ratioW: l.ratioW, ratioH: l.ratioH, widgets: l.widgets, guides: l.guides, laneColors: l.laneColors, ...Frame.pickLayout(l), ...Backdrop.pick(l) }), l.id);
    if (b.dataset.dup) { await api.add('layouts', clone({ name: l.name + ' (copy)', note: l.note || '', ratioW: l.ratioW, ratioH: l.ratioH, widgets: l.widgets, guides: l.guides, laneColors: l.laneColors, ...Frame.pickLayout(l), ...Backdrop.pick(l) })); renderLayoutList(box); }
    if (b.dataset.del && confirm(`Delete the layout "${l.name}"?\n\nRace setups that use it go back to the default layout (the default token layout for a Time Token Session).\n\nThis can't be undone.`)) { await api.remove('layouts', l.id); renderLayoutList(box); }
  };
}

// ---------------- the editor ----------------
// ed.sel holds the selected widgets themselves (one or several); everything below works on that list.
// What a widget shows in the editor. A Leaderboard that uses a row design shows that design (eight made-up drivers, the most a race has), drawn as in a race:
// the rows shrink as a whole until all of them are inside the frame.
function previewOf(def, w) {
  const ed = state.editing, o = w.opt || {};
  if (w.type === 'leaderboard' && o.design) {
    const design = (ed.rowDesigns || []).find(x => x.id === o.design);
    if (design) return Rows.sampleHtml(design, 8, ed.imageSets, { scale: o.scale, gaps: o.gaps, fill: o.fill });
  }
  return Widgets.sampleOf(def, w.lane, { ...w, opt: Widgets.resolveOpt(w, ed.imageSets, state.settings.clubLogo) });
}
function widgetHtml(w, sel, single, d) {
  const def = Widgets.def(w.type), H = Widgets.heightOf(d), U = Widgets.U, col = Widgets.colorsOf(w, d);
  const style = `left:${w.x / U * 100}%;top:${w.y / H * 100}%;width:${w.w / U * 100}%;height:${w.h / H * 100}%;font-size:${(w.textSize || def.textSize) / 10}cqw;` +
    `color:${Widgets.cssVal(col.color) || 'var(--ink)'};${Frame.css(col.bg, w, 'var(--muted)', d)}${d.kind !== 'row' && Frame.corner(w, d, U) ? ';border-radius:' + Frame.corner(w, d, U) : ''}`; // (a row design has its own corner setting, used by Rows)
  return `<div class="lw${sel ? ' sel' : ''}${def.button ? ' btnw' : ''}${w.titleSpace ? ' tspace' : ''}${Widgets.alignClassOf(w)}" data-i="${d.widgets.indexOf(w)}" style="${style}">
    ${Widgets.showTitleOf(w) && d.kind !== 'row' ? `<span class="lw-title" style="${Widgets.titleStyleOf(w)}">${esc(Widgets.titleOf(w))}</span>` : ''}
    ${def.perLane && d.kind !== 'row' ? `<span class="lw-lane">L${w.lane + 1}</span>` : ''}<span class="lw-val"${def.button ? '' : ` style="${Widgets.valueStyleOf(w)}"`}>${previewOf(def, w)}</span>
    ${single ? '<i class="h nw" data-h="nw"></i><i class="h ne" data-h="ne"></i><i class="h sw" data-h="sw"></i><i class="h se" data-h="se"></i>' : ''}</div>`;
}

// is the picture set with this id one that exists (and fits the widget)? does the widget carry pictures of its own?
const setIn = (id, def) => !!id && (state.editing.imageSets || []).some(r => r.id === id && ((def.type === 'fuel' && r.kind === 'fuel') || (def.type === 'flag' && r.kind === 'flag') || (def.type === 'lights' && r.kind === 'lights') || (def.type === 'avatar' && r.kind === 'avatars')));
const ownPictures = w => (w.type === 'fuel' ? ((w.opt || {}).stepImages || []).some(Boolean) : w.type === 'flag' ? Widgets.FLAG_STATES.some(([k]) => (w.opt || {})['img_' + k]) : false);

function sideHtml() {
  const sel = state.editing.sel;
  if (!sel.length) return '<p class="muted">Click a widget to change its settings. Shift-click or drag a rectangle to select several, and Ctrl+A selects all. Add widgets from the list on the left.</p>';
  const single = sel.length === 1, w0 = sel[0], defs = sel.map(w => Widgets.def(w.type)), row = state.editing.draft.kind === 'row';
  const common = get => { const v = get(w0); return sel.every(w => get(w) === v) ? v : undefined; };
  const color = (key, label) => {
    const v = common(w => w[key]);
    return `<div class="field"><label>${label}</label><div class="inline"><input type="color" data-color="${key}" value="${esc(v || '#888888')}" aria-label="${label}">
      <label><input type="checkbox" data-theme="${key}" ${v === '' ? 'checked' : ''}> Theme default</label></div></div>`;
  };
  const lane = common(w => w.lane), allLane = defs.every(d => d.perLane) && !row;
  const size = common(w => w.textSize), tsize = common(w => w.titleSize), showT = common(w => w.showTitle !== false);
  const sameType = sel.every(w => w.type === w0.type), d0 = defs[0];
  const flagStyle = w0.type === 'flag' ? Widgets.flagStyleOf(w0.opt) : '';
  const opts = !sameType ? '' : d0.options.filter(o => !(o.classic && (w0.opt || {}).design) && !(o.rowsOnly && !(w0.opt || {}).design) && !(o.own && setIn((w0.opt || {}).imageSet, d0)) && !(o.when && !o.when.includes(flagStyle)) && !(o.show && !o.show(w0.opt || {}))).map(o => { // (show: a setting that only appears when it is of use, for instance the lane to compare with)
    const v = o.key === 'flagStyle' ? flagStyle : common(w => (w.opt || {})[o.key]) ?? (o.defaultOf ? o.defaultOf(w0.opt || {}) : o.default), id = `o-${o.key}`;
    if (o.type === 'imageset') return `<div class="field"><label for="${id}">${esc(o.label)}</label><select id="${id}" data-opt="${o.key}"><option value="">${ownPictures(w0) ? 'None: pictures of this widget' : d0.type === 'flag' ? 'None (shows the flag name as text)' : d0.type === 'lights' ? 'None (plain round lights)' : d0.type === 'avatar' ? 'Standard avatars (built in)' : 'None'}</option>${d0.type === 'avatar' ? `<option value="none"${v === 'none' ? ' selected' : ''}>No avatars (the first letter of the name)</option>` : ''}${(state.editing.imageSets || []).filter(r => r.kind === o.kind).map(r => `<option value="${esc(r.id)}"${r.id === v ? ' selected' : ''}>${esc(r.name)}</option>`).join('')}</select>${d0.type === 'avatar' || (state.editing.imageSets || []).some(r => r.kind === o.kind) ? '' : '<p class="muted">No sets yet. Make one under Customization > Image Settings.</p>'}${!setIn(v, d0) && sameType && ownPictures(w0) ? '<button class="btn" type="button" data-saveset="1">Save this widget\'s pictures as a set</button>' : ''}</div>`;
    if (o.type === 'rowdesign') return `<div class="field"><label for="${id}">${esc(o.label)}</label><select id="${id}" data-opt="${o.key}"><option value="">Classic table (columns below)</option>${(state.editing.rowDesigns || []).map(r => `<option value="${esc(r.id)}"${r.id === v ? ' selected' : ''}>${esc(r.name)}</option>`).join('')}</select></div>`;
    if (o.type === 'checkbox') return `<div class="field"><label class="inline"><input id="${id}" type="checkbox" data-opt="${o.key}" ${v ? 'checked' : ''}> ${esc(o.label)}</label></div>`;
    if (o.type === 'range') return `<div class="field"><label for="${id}">${esc(o.label)} <output id="${id}-v">${esc(v)}${o.unit || ''}</output></label><input id="${id}" type="range" min="${o.min ?? 0}" max="${o.max ?? 100}" step="${o.step ?? 1}" data-opt="${o.key}" data-unit="${esc(o.unit || '')}" value="${esc(v)}">${o.hint ? `<span class="muted hint">${esc(o.hint)}</span>` : ''}</div>`;
    if (o.type === 'select') return `<div class="field"><label for="${id}">${esc(o.label)}</label><select id="${id}" data-opt="${o.key}">${o.choices.map(([k, t]) => `<option value="${k}"${k === v ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>${(o.hintOf ? o.hintOf(v, (w0.opt || {})) : o.hint) ? `<span class="muted hint">${esc(o.hintOf ? o.hintOf(v, (w0.opt || {})) : o.hint)}</span>` : ''}</div>`;
    if (o.type === 'imagelist') { // one picture per step, from full (first) to empty (last)
      const cnt = Widgets.clampInt((w0.opt || {})[o.count] ?? d0.options.find(x => x.key === o.count).default, 2, 20, 10), list = (w0.opt || {})[o.key] || [];
      return `<div class="field"><label>${esc(o.label)}</label><div class="optlist">${Array.from({ length: cnt }, (_, i) =>
        `<div class="inline"><span>${i + 1}${i === 0 ? ' (full)' : i === cnt - 1 ? ' (empty)' : ''}</span>${list[i] ? `<img class="optimg" src="${esc(list[i])}" alt=""> ` : ''}` +
        `<input type="file" accept="image/*" aria-label="Picture ${i + 1}" data-optimglist="${o.key}" data-idx="${i}">${list[i] ? ` <button class="btn" type="button" data-clearopt="${o.key}" data-idx="${i}">Remove</button>` : ''}</div>`).join('')}</div></div>`;
    }
    if (o.type === 'frame') {
      const car = o.from === 'car', pic = ((car ? state.editing.cars || [] : state.editing.drivers || []).find(x => x[car ? 'picture' : 'avatar']) || {})[car ? 'picture' : 'avatar'], f = Widgets.frameOf((common(w => (w.opt || {})[o.key]) ?? null));
      return `<div class="field frame" data-frame="${o.key}"><label>${esc(o.label)}</label>${pic ? '' : `<p class="muted">Add ${car ? 'a slotcar' : 'a driver'} with a picture to see a preview. The setting still applies.</p>`}${frameInner(pic, f, `${w0.w} / ${w0.h}`, false)}</div>`;
    }
    if (o.type === 'image') { // `fallback`: the App Settings picture that shows while this widget has none of its own
      const fb = o.fallback ? (state.settings || {})[o.fallback] || '' : '';
      return `<div class="field"><label for="${id}">${esc(o.label)}</label><div class="inline">${v ? `<img class="optimg" src="${esc(v)}" alt=""> ` : fb ? `<img class="optimg" src="${esc(fb)}" alt=""> <span class="muted">your club logo, from App Settings</span> ` : `<span class="muted">${o.fallback ? 'none: set your club logo in App Settings, or choose a picture here' : 'none (shows text)'}</span> `}` +
        `<input id="${id}" type="file" accept="image/*" data-optimg="${o.key}">${v ? ` <button class="btn" type="button" data-clearopt="${o.key}">${fb ? 'Use the club logo' : 'Remove'}</button>` : ''}</div></div>`;
    }
    if (o.type === 'note') return `<p class="muted">${esc(o.label)}</p>`;
    if (o.type === 'text') return `<div class="field"><label for="${id}">${esc(o.label)}</label><input id="${id}" type="text" maxlength="200" data-opt="${o.key}" value="${esc(v)}"></div>`;
    const num = o.type === 'number';
    return `<div class="field"><label for="${id}">${esc(o.label)}</label><input id="${id}" type="${num ? 'number' : 'color'}" ${num ? `min="${o.min ?? 0}" ${o.max ? `max="${o.max}" ` : ''}step="${o.step ?? 0.5}"` : ''} data-opt="${o.key}" value="${esc(v)}"></div>`;
  }).join('');
  // The settings are grouped like folders (Title, Text, Background and border, the widget's own options); a folder stays as you left it
  const closed = state.sideClosed || (state.sideClosed = new Set());
  const group = (name, label, inner) => (inner.trim() ? `<details class="sidegroup" data-side="${name}"${closed.has(name) ? '' : ' open'}><summary>${esc(label)}</summary>${inner}</details>` : '');
  const slider = (id, label, v, min, max, step, hint, off) => `<div class="field"><label for="${id}">${label} <output id="${id}-v">${v}%</output></label>
    <input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${v}"${off ? ' disabled' : ''}>${hint ? `<span class="muted hint">${hint}</span>` : ''}</div>`;
  const rad = common(w => Frame.cornerPct(w.radius) ?? '');
  const bmode = common(w => Frame.mode(w)), bshade = common(w => Frame.shade(w)), trans = common(w => Frame.transparency(w, state.editing.draft)), followsLayout = common(w => Frame.ownTransparency(w) === null);
  const alignSelect = (id, label, v) => `<div class="field"><label for="${id}">${label}</label><select id="${id}">${v === undefined ? '<option value="" selected>(different)</option>' : ''}${Widgets.ALIGNS.map(([k, t]) => `<option value="${k}"${k === v ? ' selected' : ''}>${t}</option>`).join('')}</select></div>`;
  const titleBox = defs.some(d => !d.button) ? [
    single ? `<div class="field"><label for="s-title">${row ? 'Header text' : 'Title'} (empty = ${esc(d0.title || d0.label)})</label><input id="s-title" type="text" maxlength="40" value="${esc(w0.title || '')}"></div>` : '',
    row ? '' : `<div class="field"><label class="inline"><input type="checkbox" id="s-showtitle" ${showT === false ? '' : 'checked'}> Show title</label></div>
      <div class="field"><label for="s-tsize">Title size (default 12)</label><input id="s-tsize" type="number" min="3" max="60" value="${esc(tsize || '')}" placeholder="${tsize === undefined ? 'different' : 12}"></div>
      <div class="field"><label class="inline"><input type="checkbox" id="s-tbold" ${common(w => !!w.titleBold) ? 'checked' : ''}> Title in bold</label></div>
      <div class="field"><label class="inline"><input type="checkbox" id="s-tspace" ${common(w => !!w.titleSpace) ? 'checked' : ''}> Title takes its own space (the value moves down)</label></div>
      ${alignSelect('s-talign', 'Title alignment', common(w => Widgets.titleAlignOf(w)))}`].join('') : '';
  const textBox = (defs.some(d => !d.button) ? `<div class="field"><label class="inline"><input type="checkbox" id="s-vbold" ${common(w => w.valueBold !== false) ? 'checked' : ''}> Value in bold</label>
      <label class="inline"><input type="checkbox" id="s-vital" ${common(w => !!w.valueItalic) ? 'checked' : ''}> Value in italic</label></div>` : '') +
    (defs.some(d => !d.button && d.type !== 'leaderboard') ? alignSelect('s-valign', 'Text alignment', common(w => Widgets.valueAlignOf(w))) : '') + // (the Leaderboard has none: its columns come from the layout you make)
    `<div class="field"><label for="s-size">Text size${single ? ` (default ${d0.textSize})` : ''}</label><input id="s-size" type="number" min="5" max="200" value="${esc(size || '')}" placeholder="${size === undefined ? 'different' : (single ? d0.textSize : '')}"></div>` + color('textColor', 'Text colour');
  const frameBox = color('bgColor', 'Background colour') + (row ? '' :
    `<div class="field"><label for="s-bmode">Border</label><select id="s-bmode">${bmode === undefined ? '<option value="" selected>(different)</option>' : ''}${[['', 'Theme default'], ['shade', 'Shade of the background'], ['off', 'No border']].map(([k, t]) => `<option value="${k}"${k === bmode ? ' selected' : ''}>${t}</option>`).join('')}</select></div>` +
    slider('s-bshade', 'Border shade', bshade ?? Frame.DEFAULT_SHADE, 0, 100, 0.5, '0% white, 50% the background colour, 100% black', bmode === '' || bmode === 'off') +
    slider('s-trans', 'Transparency', trans ?? 0, 0, 100, 1, 'Fades the background and the border, not the text. 0% is solid.', followsLayout === true) +
    `<div class="field"><label class="inline"><input type="checkbox" id="s-transfollow" ${followsLayout ? 'checked' : ''}> Same as the layout (Background button in the top bar)</label></div>` +
    `<div class="field"><label for="s-radius">Rounded corners</label><input id="s-radius" type="number" min="0" max="50" step="0.5" value="${esc(rad === undefined ? '' : rad)}" placeholder="${rad === undefined ? 'different' : 'as the layout'}"><span class="muted hint">Empty follows the layout. 0 is square, 50 is fully round (on a square widget, a circle).</span></div>`);
  return `<h3>${single ? esc(d0.label) : sel.length + ' widgets selected'}</h3>
    ${allLane ? `<div class="field"><label for="s-lane">Lane</label><select id="s-lane">${lane === undefined ? '<option value="" selected>(different)</option>' : ''}${Array.from({ length: Widgets.LANES }, (_, l) => `<option value="${l}"${l === lane ? ' selected' : ''}>Lane ${l + 1}</option>`).join('')}</select></div>` : ''}
    ${row && single ? group('place', 'Place in the row', `<div class="field"><label>0 to ${Widgets.U} across, 0 to ${Widgets.heightOf(state.editing.draft)} down</label><div class="inline">${[['x', 'Left'], ['y', 'Top'], ['w', 'Width'], ['h', 'Height']].map(([k, t]) => `<label>${t} <input type="number" data-geo="${k}" value="${Math.round(w0[k])}" style="width:5em"></label>`).join(' ')}</div></div>`) : ''}
    ${group('title', row ? 'Header' : 'Title', titleBox)}${group('text', 'Text', textBox)}${group('frame', row ? 'Colour' : 'Background and border', frameBox)}${group('opts', d0.optsLabel || d0.label + ' settings', opts)}
    <div class="row"><button class="btn" id="s-dup">Duplicate${allLane ? ' (next lane)' : ''}</button><button class="btn danger" id="s-del">Remove</button></div>`;
}

function renderEditor() {
  const ed = state.editing, d = ed.draft;
  const preset = PRESETS.find(p => p[1] === d.ratioW && p[2] === d.ratioH);
  const row = d.kind === 'row', REG = (row ? Widgets.REGISTRY.filter(x => x.perLane) : Widgets.REGISTRY).filter(x => !x.hidden); // the custom text kinds are made in the Widget Builder, not added from here
  const GROUP_ORDER = ['Race', 'Driver', 'Slotcar', 'Timing', 'Timing Records', 'Delta Timers', 'Controls'];
  const groups = [...new Set(REG.map(x => x.group))].sort((a, b) => (GROUP_ORDER.indexOf(a) + 100) % 100 - (GROUP_ORDER.indexOf(b) + 100) % 100);
  const savedWidgets = (ed.customWidgets || []).filter(r => !row || /lane$/.test(r.type));
  // the widget list: each group is a folder that can be opened and closed (it stays as you left it)
  state.palOpen = state.palOpen || new Set();
  const folder = (name, buttons) => `<details class="palgroup" data-pal="${esc(name)}"${state.palOpen.has(name) ? ' open' : ''}><summary>${esc(name)}</summary>${buttons}</details>`;
  const palette = () => groups.map(g => folder(g, REG.filter(x => x.group === g).map(x => `<button class="btn" data-add="${x.type}">${esc(x.label)}</button>`).join(''))).join('')
    + (savedWidgets.length ? folder('Custom', savedWidgets.map(r => `<button class="btn" data-addcw="${esc(r.id)}">${esc(r.name)}</button>`).join('')) : '');
  const hasGuides = () => (d.guides.v.length + d.guides.h.length) > 0;
  const S = row ? Rows.settings(d) : null, yn = (id, v, t) => `<label><input type="checkbox" id="${id}" ${v ? 'checked' : ''}> ${t}</label>`;
  const rowBar = row ? `<label>Row height <input type="number" id="e-rowh" min="20" max="400" value="${esc(S.rowH)}" style="width:5em"></label>
      <label>Space between rows <input type="number" id="e-gap" min="0" max="100" value="${esc(S.gap)}" style="width:5em"></label>
      <label>Rounded corners (0 = square) <input type="number" id="e-radius" min="0" max="50" value="${esc(S.radius)}" style="width:5em"></label>
      ${yn('e-header', S.header, 'Header row')}<button class="btn" id="e-rowcolors">Colours...</button>` : '';
  view.innerHTML = `<h2>${row ? (ed.id ? 'Edit row design' : 'New row design') : (ed.id ? 'Edit layout' : 'New layout')}</h2>
    <div class="ed-bar">
      <label>Name <input type="text" id="e-name" value="${esc(d.name)}" maxlength="40"></label>
      <label>Note <input type="text" id="e-note" value="${esc(d.note || '')}" maxlength="120" placeholder="Optional, shown in the layout list"></label>
      ${row ? rowBar : `<label>Proportions <select id="e-ratio">${PRESETS.map(p => `<option value="${p[0]}"${preset && preset[0] === p[0] ? ' selected' : ''}>${p[0]}</option>`).join('')}<option value="custom"${preset ? '' : ' selected'}>Custom</option></select></label>
      <span id="e-custom" ${preset ? 'hidden' : ''}><input type="number" id="e-rw" min="1" max="50" value="${esc(d.ratioW)}" aria-label="Width"> : <input type="number" id="e-rh" min="1" max="50" value="${esc(d.ratioH)}" aria-label="Height"></span>`}
      ${row ? '' : `<label title="The corners of every widget: 0 is square, 50 is fully round. Empty keeps the classic small corners. A widget can have its own setting.">Rounded corners <input type="number" id="e-lradius" min="0" max="50" step="0.5" placeholder="classic" value="${esc(Frame.cornerPct(d.radius) ?? '')}" style="width:5.5em"></label>`}
      <label><input type="checkbox" id="e-snap" ${ed.snap ? 'checked' : ''}> Snap to grid, widgets and guidelines</label>
      ${row ? '' : `<button class="btn" id="e-guides" aria-pressed="${hasGuides()}">Guidelines</button><button class="btn" id="e-lanecolors">Lane colours</button><button class="btn" id="e-background" aria-pressed="${Backdrop.has(d)}" title="A picture behind all the widgets, with blur and other filters">Background</button>`}
      <button class="btn" id="e-undo" title="Undo the last change (Ctrl+Z)" disabled>Undo</button><button class="btn" id="e-redo" title="Redo (Ctrl+Y)" disabled>Redo</button>
      <button class="btn primary" id="e-save">${row ? 'Save row design' : 'Save layout'}</button><button class="btn" id="e-back">Back</button><span id="e-msg" class="muted" role="status"></span></div>
    <div class="ed-main"><aside class="ed-pal" aria-label="Widgets">${palette()}</aside>
      <div class="ed-stage"><div class="canvas" id="canvas"></div>${row ? '<h4>Preview: leader, normal, in the pits, penalty, out</h4><div class="rowprev" id="e-preview"></div>' : ''}</div>
      <aside class="ed-side" id="side"></aside></div>`;
  const $ = id => document.getElementById(id);
  // the steps for Undo and Redo: mark() says something changed (a drag or a typed word becomes one step after a quiet moment); step() ends the step now, for a single action
  const hist = ed.history || (ed.history = Undo.create({ clean: !ed.dirty, get: () => ({ draft: ed.draft }), apply: s => restoreDraft(ed, s), onchange: () => { if (ed.syncUndo) ed.syncUndo(); } }));
  ed.syncUndo = () => { const u = document.getElementById('e-undo'), r = document.getElementById('e-redo'); if (u) u.disabled = !hist.canUndo(); if (r) r.disabled = !hist.canRedo(); };
  const U = Widgets.U, mark = () => { ed.dirty = true; hist.touch(); }, step = () => { mark(); hist.commit(); };
  const Hh = () => Widgets.heightOf(d);
  const drawCanvas = () => {
    const H = Hh();
    $('canvas').style.aspectRatio = `${d.ratioW} / ${d.ratioH}`;
    $('canvas').style.backgroundSize = `${10 / U * 100}% ${10 / H * 100}%`;
    const lines = d.guides.v.map(x => `<i class="gl gl-v" style="left:${x / U * 100}%"></i>`).join('') + d.guides.h.map(y => `<i class="gl gl-h" style="top:${y / H * 100}%"></i>`).join('');
    const single = ed.sel.length === 1;
    const order = [...d.widgets].sort((a, b) => ed.sel.includes(a) - ed.sel.includes(b));
    $('canvas').innerHTML = lines + order.map(w => widgetHtml(w, ed.sel.includes(w), single && ed.sel[0] === w, d)).join('');
    // the background picture is kept as one element (a big picture is not rebuilt on every move of a widget)
    if (!row && Backdrop.has(d)) {
      const key = [d.bgImage, d.bgFit, d.bgBlur, d.bgBrightness, d.bgSaturation];
      if (!ed.bgKey || key.some((v, i) => v !== ed.bgKey[i])) { ed.bgKey = key; ed.bgNode = Backdrop.node(d); }
      $('canvas').insertBefore(ed.bgNode, $('canvas').firstChild);
    } else { ed.bgKey = null; ed.bgNode = null; }
    if (String($('canvas').innerHTML).includes('class="rrows"')) Rows.fitText($('canvas')); // a Leaderboard with a row design: no text wider than its cell
    if ($('e-background')) $('e-background').setAttribute('aria-pressed', String(Backdrop.has(d)));
    if ($('e-guides')) $('e-guides').setAttribute('aria-pressed', String(hasGuides()));
    if (row) { $('e-preview').innerHTML = Rows.sampleHtml(d, 5, ed.imageSets); Rows.fitText($('e-preview')); }
  };
  const drawSide = () => {
    $('side').innerHTML = sideHtml();
    attachFrames($('side'), key => (ed.sel[0].opt || {})[key], (key, f) => { ed.sel.forEach(w => { w.opt = w.opt || {}; w.opt[key] = f; }); mark(); });
  };
  const redraw = () => { drawCanvas(); drawSide(); };
  redraw();

  window.editorAddCustom = id => { // a saved widget from the Widget Builder: add its kind, then give the copy its text, size and look
    const r = (ed.customWidgets || []).find(x => x.id === id); if (!r) return;
    const g = addWidget(r.type), H = Hh(), c = wbToWidget(r, g.lane);
    Object.assign(g, { opt: c.opt, w: Math.min(c.w, U), h: Math.min(c.h, H), textSize: c.textSize, valueBold: c.valueBold, valueItalic: c.valueItalic, title: c.title, showTitle: row ? false : c.showTitle });
    step(); redraw();
  };
  window.editorAdd = type => { addWidget(type); hist.commit(); };
  const addWidget = type => {
    const def = Widgets.def(type), H = Hh();
    const lane = !def.perLane ? null : row ? 0 : Math.min(Widgets.LANES - 1, d.widgets.filter(w => w.type === type).length);
    const g = Widgets.newWidget(type, lane, 20, 20);
    g.w = Math.min(g.w, U); g.h = Math.min(g.h, H); if (row) { g.showTitle = false; g.h = Math.min(g.h, Math.max(40, H - 10)); g.textSize = 30; }
    const free = (x, y) => !d.widgets.some(o => x < o.x + o.w && o.x < x + g.w && y < o.y + o.h && o.y < y + g.h);
    outer: for (let y = 10; y + g.h <= H; y += 10) for (let x = 10; x + g.w <= U; x += 10) if (free(x, y)) { g.x = x; g.y = y; break outer; }
    d.widgets.push(g); ed.sel = [g]; mark(); redraw(); return g;
  };
  window.editorSave = async () => {
    d.name = d.name.trim();
    if (!d.name) { $('e-msg').textContent = `Please give the ${row ? 'row design' : 'layout'} a name.`; return false; }
    const token = hist.commit(); // what is saved is this state, whatever is changed while the save runs
    if (row) {
      const data = clone({ ...d, name: d.name, note: (d.note || '').trim(), kind: 'row' });
      if (ed.id) await api.update('rowdesigns', ed.id, data); else { const r = await api.add('rowdesigns', data); ed.id = r.id; }
      ed.dirty = false; hist.markSaved(token); $('e-msg').textContent = 'Saved.'; return true;
    }
    const data = clone({ name: d.name, note: (d.note || '').trim(), ratioW: d.ratioW, ratioH: d.ratioH, widgets: d.widgets, guides: d.guides, laneColors: d.laneColors, ...Frame.pickLayout(d), ...Backdrop.pick(d) });
    if (ed.id) await api.update('layouts', ed.id, data); else { const row = await api.add('layouts', data); ed.id = row.id; }
    ed.dirty = false; hist.markSaved(token); $('e-msg').textContent = 'Saved.'; return true;
  };
  // Undo and redo: the editor is drawn again from the remembered state
  const goBack = redo => {
    if (!(redo ? hist.redo() : hist.undo())) { $('e-msg').textContent = redo ? 'Nothing to redo.' : 'Nothing to undo.'; return false; }
    ed.dirty = !hist.isClean(); renderEditor(); document.getElementById('e-msg').textContent = redo ? 'Redone.' : 'Undone.'; return true;
  };
  window.editorUndo = () => goBack(false);
  window.editorRedo = () => goBack(true);
  const removeSel = () => { d.widgets = d.widgets.filter(w => !ed.sel.includes(w)); ed.sel = []; step(); redraw(); };
  const duplicateSel = () => {
    if (!ed.sel.length) return;
    const src = [...ed.sel], copies = Widgets.duplicateWidgets(src, ed.dupStep, U, Hh());
    d.widgets.push(...copies);
    ed.lastDup = { srcBox: Widgets.bbox(src), copies }; ed.sel = copies; step(); redraw();
    $('e-msg').textContent = src.some(w => w.lane === Widgets.LANES - 1) ? `Lane ${Widgets.LANES} is the last lane.` : '';
  };

  // toolbar
  $('e-name').oninput = e => { d.name = e.target.value; mark(); };
  $('e-note').oninput = e => { d.note = e.target.value; mark(); };
  if (row) {
    $('e-rowh').oninput = e => { const v = Math.max(20, Math.min(400, Number(e.target.value) || 70)); d.ratioH = v; d.ratioW = U; d.widgets.forEach(g => { g.y = Math.min(g.y, Math.max(0, v - g.h)); g.h = Math.min(g.h, v); }); mark(); redraw(); };
    $('e-gap').oninput = e => { d.gap = Math.max(0, Math.min(100, Number(e.target.value) || 0)); mark(); drawCanvas(); };
    $('e-radius').oninput = e => { d.radius = Math.max(0, Math.min(50, Number(e.target.value) || 0)); mark(); drawCanvas(); };
    $('e-header').onchange = e => { d.header = e.target.checked; step(); drawCanvas(); };
    $('e-rowcolors').onclick = () => {
      const c = Rows.settings(d), pair = (k, t) => `<tr><td>${t}</td><td><input type="color" id="rc-${k}-t" value="${esc(c[k + 'Text'] || '#ffffff')}" aria-label="${t} text colour"></td><td><input type="color" id="rc-${k}-b" value="${esc(c[k + 'Bg'] || '#333333')}" aria-label="${t} background colour"></td></tr>`;
      const theme = (k, t, v) => `<tr><td>${t}</td><td><input type="color" id="rc-${k}" value="${esc(v || '#333333')}" aria-label="${t}"> <label><input type="checkbox" id="rc-${k}-th" ${v ? '' : 'checked'}> Theme</label></td></tr>`;
      dlg.innerHTML = `<form id="rcform"><h3>Row colours</h3>
        <table class="fields"><tr><th>Row</th><th>Colour</th></tr>${theme('rowText', 'Text', c.rowText)}${theme('rowBg', 'Background', c.rowBg)}${theme('altBg', 'Every second row', c.altBg)}${theme('headerText', 'Header text', c.headerText)}${theme('headerBg', 'Header background', c.headerBg)}</table>
        <p><label><input type="checkbox" id="rc-states" ${c.states ? 'checked' : ''}> Colour a row by what its driver is doing</label></p>
        <table class="fields"><tr><th>When</th><th>Text</th><th>Background</th></tr>${Rows.STATES.map(([k, t]) => pair(k, t)).join('')}</table>
        <p class="muted">The strongest state wins: out, then pits, then penalty, then leader. A widget's own colour is used over these.</p>
        <div class="row"><button class="btn primary" type="submit">Apply</button><button class="btn" type="button" id="rc-cancel">Cancel</button></div></form>`;
      $('rc-cancel').onclick = () => dlg.close();
      $('rcform').onsubmit = ev => {
        ev.preventDefault();
        ['rowText', 'rowBg', 'altBg', 'headerText', 'headerBg'].forEach(k => { d[k] = $('rc-' + k + '-th').checked ? '' : $('rc-' + k).value; });
        d.states = $('rc-states').checked;
        Rows.STATES.forEach(([k]) => { d[k + 'Text'] = $('rc-' + k + '-t').value; d[k + 'Bg'] = $('rc-' + k + '-b').value; });
        step(); dlg.close(); drawCanvas();
      };
      dlg.onclick = null; dlg.onchange = null; dlg.showModal();
    };
  }
  const setRatio = (w, h) => { d.ratioW = w; d.ratioH = h; const H = Hh(); d.widgets.forEach(g => { g.y = Math.min(g.y, Math.max(0, H - g.h)); g.h = Math.min(g.h, H); }); mark(); drawCanvas(); };
  if (!row) $('e-ratio').onchange = e => {
    if (e.target.value === 'custom') { $('e-custom').hidden = false; return; }
    const p = PRESETS.find(x => x[0] === e.target.value); $('e-custom').hidden = true; $('e-rw').value = p[1]; $('e-rh').value = p[2]; setRatio(p[1], p[2]); hist.commit();
  };
  const customRatio = () => { const w = Number($('e-rw').value), h = Number($('e-rh').value); if (w >= 1 && h >= 1) setRatio(w, h); };
  if (!row) { $('e-rw').oninput = customRatio; $('e-rh').oninput = customRatio; }
  if (!row) $('e-lradius').oninput = e => { const v = Frame.cornerPct(e.target.value); d.radius = v === null ? '' : v; mark(); drawCanvas(); };
  $('e-snap').onchange = e => { ed.snap = e.target.checked; };
  $('e-undo').onclick = () => window.editorUndo();
  $('e-redo').onclick = () => window.editorRedo();
  ed.syncUndo();
  $('e-save').onclick = () => window.editorSave();
  $('e-back').onclick = () => { if (ed.dirty && !confirm('Discard your unsaved layout changes?')) return; editorLeave(); render(); };
  document.querySelector('.ed-pal').addEventListener && document.querySelector('.ed-pal').addEventListener('toggle', ev => { const d = ev.target; if (d && d.dataset && d.dataset.pal) { if (d.open) state.palOpen.add(d.dataset.pal); else state.palOpen.delete(d.dataset.pal); } }, true);
  document.querySelector('.ed-pal').onclick = e => { const b = e.target.closest('[data-add]'); if (b) window.editorAdd(b.dataset.add); const c = e.target.closest('[data-addcw]'); if (c) window.editorAddCustom(c.dataset.addcw); };

  // guidelines: evenly spaced lines to snap to, shown only here in the editor; the button again turns them off
  if (!row) $('e-guides').onclick = () => {
    if (hasGuides()) { d.guides = { v: [], h: [] }; step(); redraw(); return; }
    dlg.innerHTML = `<form id="gform"><h3>Guidelines</h3><p class="muted">Evenly spaced lines that widgets stick to. They only show in the editor.</p>
      <div class="field"><label for="g-n">Number of lanes (2 to ${Widgets.LANES})</label><input id="g-n" type="number" min="2" max="${Widgets.LANES}" value="2"></div>
      <div class="field"><label><input type="radio" name="g-dir" id="g-dir-v" checked> Vertical lines (lanes side by side)</label>
        <label><input type="radio" name="g-dir" id="g-dir-h"> Horizontal lines (one row per lane)</label><label><input type="radio" name="g-dir" id="g-dir-b"> Both</label></div>
      <p class="error" id="gerr" role="alert"></p><div class="row"><button class="btn primary" type="submit">Place guidelines</button><button class="btn" type="button" id="g-cancel">Cancel</button></div></form>`;
    $('g-cancel').onclick = () => dlg.close();
    $('gform').onsubmit = ev => {
      ev.preventDefault();
      const n = Number($('g-n').value);
      if (!Number.isInteger(n) || n < 2 || n > Widgets.LANES) { $('gerr').textContent = `Please enter a number from 2 to ${Widgets.LANES}.`; return; }
      d.guides = Widgets.guidesFor(n, $('g-dir-h').checked ? 'horizontal' : $('g-dir-b').checked ? 'both' : 'vertical', U, Hh());
      step(); dlg.close(); redraw();
    };
    dlg.onclick = null; dlg.onchange = null; dlg.showModal();
  };

  // lane colours: a text and background colour per lane, inherited by that lane's widgets unless they have their own
  if (!row) $('e-lanecolors').onclick = () => {
    const row = i => { const c = (d.laneColors || [])[i] || {};
      return `<tr><td>Lane ${i + 1}</td><td><input type="color" id="lc-t-${i}" value="${esc(c.text || '#ffffff')}" aria-label="Lane ${i + 1} text colour"> <label><input type="checkbox" id="lc-tt-${i}" ${c.text ? '' : 'checked'}> Theme</label></td>
        <td><input type="color" id="lc-b-${i}" value="${esc(c.bg || '#333333')}" aria-label="Lane ${i + 1} background colour"> <label><input type="checkbox" id="lc-bt-${i}" ${c.bg ? '' : 'checked'}> Theme</label></td></tr>`; };
    dlg.innerHTML = `<form id="lform"><h3>Lane colours</h3><p class="muted">Every widget of a lane uses these colours, unless the widget has its own.</p>
      <table class="fields"><tr><th></th><th>Text</th><th>Background</th></tr>${Array.from({ length: Widgets.LANES }, (_, i) => row(i)).join('')}</table>
      <div class="row"><button class="btn primary" type="submit">Apply</button><button class="btn" type="button" id="l-cancel">Cancel</button></div></form>`;
    $('l-cancel').onclick = () => dlg.close();
    $('lform').onsubmit = ev => {
      ev.preventDefault();
      d.laneColors = Array.from({ length: Widgets.LANES }, (_, i) => ({ text: $('lc-tt-' + i).checked ? '' : $('lc-t-' + i).value, bg: $('lc-bt-' + i).checked ? '' : $('lc-b-' + i).value }));
      step(); dlg.close(); drawCanvas();
    };
    dlg.onclick = null; dlg.onchange = null; dlg.showModal();
  };

  // the page background: a picture behind all the widgets, and filters that only change the picture
  if (!row) $('e-background').onclick = () => {
    const slider = (id, label, v, min, max, hint, always) => `<div class="field"><label for="${id}">${label} <output id="${id}-v">${v}%</output></label><input id="${id}" type="range" min="${min}" max="${max}" step="1" value="${v}"${always || Backdrop.has(d) ? '' : ' disabled'}>${hint ? `<span class="muted hint">${hint}</span>` : ''}</div>`;
    const preview = () => { const sample = Frame.css('', {}, 'var(--muted)', d); return `<div class="bgprev" id="bg-prev" style="aspect-ratio:${d.ratioW} / ${d.ratioH}">${Backdrop.html(d)}
      <div class="lw" style="left:6%;top:10%;width:38%;height:26%;font-size:5cqw;${sample}">Best lap</div><div class="lw" style="left:50%;top:10%;width:44%;height:26%;font-size:5cqw;font-weight:600;${sample}">3.421</div>
      <div class="lw" style="left:6%;top:46%;width:88%;height:40%;font-size:6cqw;font-weight:600;${sample}">Alex &nbsp; 4/10</div></div>`; };
    const show = () => {
      dlg.innerHTML = `<form id="bgform"><h3>Page background</h3>
        <p class="muted">A picture behind all the widgets of this layout. The filters only change the picture, never the widgets. The widgets in the preview are samples.</p>
        ${preview()}
        <div class="field"><label for="bg-file">Picture</label><div class="inline"><input type="file" id="bg-file" accept="image/*">${Backdrop.has(d) ? ' <button class="btn" type="button" id="bg-clear">Remove</button>' : ''}</div>
          ${Backdrop.has(d) ? '' : '<span class="muted hint">No picture: the theme colour is the background.</span>'}</div>
        <div class="field"><label for="bg-fit">Fit</label><select id="bg-fit"${Backdrop.has(d) ? '' : ' disabled'}>${Backdrop.FITS.map(([k, t]) => `<option value="${k}"${k === Backdrop.fit(d) ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
        ${slider('bg-blur', 'Blur', Backdrop.blur(d), 0, 100, 'Softens the picture so it does not compete with the numbers.')}
        ${slider('bg-bright', 'Brightness', Backdrop.brightness(d), 20, 150, '100% is as it is; lower makes it darker.')}
        ${slider('bg-sat', 'Colour', Backdrop.saturation(d), 0, 200, '0% is black and white, 100% is as it is.')}
        <h4>Widgets</h4>
        ${slider('bg-wtrans', 'Widget transparency', Frame.layoutTransparency(d), 0, 100, 'The look of all widgets of this layout, also the ones you add later. Fades the widget background and border, not the text. A widget can have its own setting (Background and border) that wins.', true)}
        <p class="error" id="bg-err" role="alert"></p>
        <div class="row"><button class="btn" type="button" id="bg-reset">Reset filters</button><button class="btn primary" type="submit">Done</button></div></form>`;
      const again = single => { mark(); drawCanvas(); if (single) hist.commit(); };
      const refresh = single => { $('bg-prev').outerHTML = preview(); again(single); };
      $('bg-file').onchange = async e => {
        const f = e.target.files && e.target.files[0]; if (!f) return;
        try { d.bgImage = await resizeImage(f, 1920); again(true); show(); } catch (x) { $('bg-err').textContent = x.message; }
      };
      if ($('bg-clear')) $('bg-clear').onclick = () => { d.bgImage = ''; again(true); show(); };
      $('bg-fit').onchange = e => { d.bgFit = e.target.value; refresh(true); };
      $('bg-wtrans').oninput = e => { d.widgetTransparency = Frame.layoutTransparency({ widgetTransparency: e.target.value }); $('bg-wtrans-v').textContent = `${d.widgetTransparency}%`; refresh(); };
      [['bg-blur', 'bgBlur'], ['bg-bright', 'bgBrightness'], ['bg-sat', 'bgSaturation']].forEach(([id, key]) => {
        $(id).oninput = e => { d[key] = Number(e.target.value); $(id + '-v').textContent = `${Backdrop[{ bgBlur: 'blur', bgBrightness: 'brightness', bgSaturation: 'saturation' }[key]](d)}%`; refresh(); };
      });
      $('bg-reset').onclick = () => { d.bgBlur = 0; d.bgBrightness = 100; d.bgSaturation = 100; again(true); show(); };
      $('bgform').onsubmit = ev => { ev.preventDefault(); dlg.close(); };
    };
    show(); dlg.onclick = null; dlg.onchange = null; dlg.showModal();
  };

  // selecting, dragging and resizing: the geometry rules live in widgets.js
  const toUnits = (ev, rect) => ({ x: (ev.clientX - rect.left) * U / rect.width, y: (ev.clientY - rect.top) * U / rect.width });
  const marquee = e => {
    const rect = $('canvas').getBoundingClientRect(), s = toUnits(e, rect), base = e.shiftKey ? [...ed.sel] : [];
    const m = document.createElement('div'); m.className = 'marq'; $('canvas').appendChild(m);
    let moved = false;
    const hit = r => d.widgets.filter(w => w.x < r.x + r.w && r.x < w.x + w.w && w.y < r.y + r.h && r.y < w.y + w.h);
    const move = ev => {
      const p = toUnits(ev, rect), r = { x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) };
      moved = moved || r.w > 3 || r.h > 3;
      Object.assign(m.style, { left: `${r.x / U * 100}%`, top: `${r.y / Hh() * 100}%`, width: `${r.w / U * 100}%`, height: `${r.h / Hh() * 100}%` });
      ed.sel = [...new Set([...base, ...hit(r)])];
      $('canvas').querySelectorAll('.lw').forEach(el => el.classList.toggle('sel', ed.sel.includes(d.widgets[Number(el.dataset.i)])));
    };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      if (m.remove) m.remove();
      if (!moved && !e.shiftKey) ed.sel = [];
      redraw();
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  $('canvas').onpointerdown = e => {
    hist.release(); // what was changed before (typing, a slider) is a step of its own
    const el = e.target.closest('.lw');
    if (!el) { marquee(e); e.preventDefault(); return; }
    const w = d.widgets[Number(el.dataset.i)], handle = e.target.dataset.h || null;
    if (e.shiftKey) { ed.sel = ed.sel.includes(w) ? ed.sel.filter(x => x !== w) : [...ed.sel, w]; redraw(); e.preventDefault(); return; }
    if (!ed.sel.includes(w)) { ed.sel = [w]; redraw(); }
    const rect = $('canvas').getBoundingClientRect(), k = U / rect.width, H = Hh();
    const group = [...ed.sel], from = group.map(g => ({ x: g.x, y: g.y, w: g.w, h: g.h })), box0 = Widgets.bbox(from);
    const others = d.widgets.filter(o => !group.includes(o)), sx = e.clientX, sy = e.clientY;
    let moved = false; hist.hold(); // a drag is one step, however long it takes
    const move = ev => {
      const dx = (ev.clientX - sx) * k, dy = (ev.clientY - sy) * k;
      if (handle && group.length === 1) Object.assign(group[0], Widgets.resizeWidget(from[0], handle, dx, dy, others, U, H, ed.snap, d.guides));
      else {
        const nb = Widgets.moveWidget(box0, dx, dy, others, U, H, ed.snap, d.guides), ox = nb.x - box0.x, oy = nb.y - box0.y;
        group.forEach((g, i) => { g.x = from[i].x + ox; g.y = from[i].y + oy; });
      }
      moved = true; mark(); drawCanvas();
    };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      // moving the copies you just made sets the step for the next duplicate
      if (moved && ed.lastDup && group.length === ed.lastDup.copies.length && group.every(g => ed.lastDup.copies.includes(g))) ed.dupStep = Widgets.stepFrom(ed.lastDup.srcBox, group);
      hist.release();
      drawSide();
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    e.preventDefault();
  };

  // the side panel changes every selected widget at once
  const side = $('side');
  if (side.addEventListener) side.addEventListener('toggle', ev => { const g = ev.target; if (g && g.dataset && g.dataset.side) { if (g.open) state.sideClosed.delete(g.dataset.side); else state.sideClosed.add(g.dataset.side); } }, true);
  side.oninput = e => {
    const sel = ed.sel, t = e.target; if (!sel.length) return;
    if (t.dataset.geo && sel.length === 1) { const k = t.dataset.geo, v = Number(t.value), H = Hh(), w = sel[0]; if (!Number.isFinite(v) || t.value === '') return;
      if (k === 'x') w.x = Math.max(0, Math.min(U - w.w, v)); else if (k === 'y') w.y = Math.max(0, Math.min(H - w.h, v)); else if (k === 'w') w.w = Math.max(Widgets.MIN, Math.min(U - w.x, v)); else w.h = Math.max(Math.min(Widgets.MIN, H), Math.min(H - w.y, v));
      mark(); drawCanvas(); return; }
    if (t.id === 's-size') sel.forEach(w => { w.textSize = t.value === '' ? '' : Number(t.value); });
    else if (t.id === 's-tsize') sel.forEach(w => { w.titleSize = t.value === '' ? '' : Number(t.value); });
    else if (t.id === 's-title') sel[0].title = t.value;
    else if (t.id === 's-bshade') { sel.forEach(w => { w.borderShade = Number(t.value); }); const o = $('s-bshade-v'); if (o) o.textContent = `${Frame.shade(sel[0])}%`; }
    else if (t.id === 's-radius') { const v = Frame.cornerPct(t.value); sel.forEach(w => { w.radius = v === null ? '' : v; }); }
    else if (t.id === 's-trans') { sel.forEach(w => { w.transparency = Number(t.value); }); const o = $('s-trans-v'); if (o) o.textContent = `${Frame.transparency(sel[0], d)}%`; }
    else if (t.dataset.color) { sel.forEach(w => { w[t.dataset.color] = t.value; }); const cb = side.querySelector(`[data-theme="${t.dataset.color}"]`); if (cb) cb.checked = false; }
    else if (t.dataset.opt) sel.forEach(w => { w.opt = w.opt || {}; w.opt[t.dataset.opt] = t.type === 'number' || t.type === 'range' ? Number(t.value) : t.type === 'checkbox' ? !!t.checked : t.value; });
    else return;
    if (t.dataset.opt && t.type === 'range' && t.id) { const out = $(t.id + '-v'); if (out) out.textContent = `${t.value}${t.dataset.unit || ''}`; } // (the figure beside a widget's own slider)
    mark(); drawCanvas();
    if (t.type === 'checkbox' || t.type === 'select-one') hist.commit(); // (a tick box or a choice from a list is one action; typing and sliders end their step after a quiet moment)
  };
  side.onchange = async e => {
    const sel = ed.sel, t = e.target; if (!sel.length) return;
    if (t.dataset.optimglist) { // one of the step pictures
      if (!t.files || !t.files[0]) return;
      try {
        const img = await resizeImage(t.files[0], 256, true), idx = Number(t.dataset.idx);
        sel.forEach(w => { w.opt = w.opt || {}; const a = [...(w.opt[t.dataset.optimglist] || [])]; a[idx] = img; w.opt[t.dataset.optimglist] = a; });
        step(); redraw();
      } catch (x) { $('e-msg').textContent = x.message; }
      return;
    }
    if (t.dataset.opt === 'steps' || t.dataset.opt === 'design' || t.dataset.opt === 'imageSet' || t.dataset.opt === 'flagStyle' || (t.dataset.opt && ((Widgets.def(sel[0].type) || {}).options || []).some(o => o.rerender && o.key === t.dataset.opt))) { if (t.dataset.opt !== 'steps') { sel.forEach(w => { w.opt = w.opt || {}; w.opt[t.dataset.opt] = t.value; }); step(); } redraw(); return; } // the number of picture slots changed
    if (t.dataset.optimg) { // a picture for one option: shrunk, transparency kept
      if (!t.files || !t.files[0]) return;
      try { const img = await resizeImage(t.files[0], 512, true); sel.forEach(w => { w.opt = w.opt || {}; w.opt[t.dataset.optimg] = img; }); step(); redraw(); }
      catch (x) { $('e-msg').textContent = x.message; }
      return;
    }
    if (t.id === 's-transfollow') { sel.forEach(w => { w.transparency = t.checked ? '' : Frame.transparency(w, d); }); step(); redraw(); return; } // unticking keeps what it looks like now, as the widget's own setting
    if (t.id === 's-bmode' && Frame.MODES.includes(t.value)) { sel.forEach(w => { w.borderMode = t.value; }); step(); redraw(); return; } // the shade slider is only for "Shade of the background"
    if (t.id === 's-lane' && t.value !== '') { sel.forEach(w => { w.lane = Number(t.value); }); step(); drawCanvas(); }
    if (t.id === 's-tbold') { sel.forEach(w => { w.titleBold = !!t.checked; }); step(); drawCanvas(); }
    if (t.id === 's-tspace') { sel.forEach(w => { w.titleSpace = !!t.checked; }); step(); drawCanvas(); }
    if (t.id === 's-talign' && Widgets.ALIGNS.some(a => a[0] === t.value)) { sel.forEach(w => { w.titleAlign = t.value; }); step(); drawCanvas(); return; }
    if (t.id === 's-valign' && Widgets.ALIGNS.some(a => a[0] === t.value)) { sel.forEach(w => { if (w.type !== 'leaderboard') w.valueAlign = t.value; }); step(); drawCanvas(); return; }
    if (t.id === 's-vbold') { sel.forEach(w => { w.valueBold = !!t.checked; }); step(); drawCanvas(); }
    if (t.id === 's-vital') { sel.forEach(w => { w.valueItalic = !!t.checked; }); step(); drawCanvas(); }
    if (t.id === 's-showtitle') { sel.forEach(w => { w.showTitle = !!t.checked; }); step(); drawCanvas(); }
    if (t.dataset.theme && t.checked) { sel.forEach(w => { w[t.dataset.theme] = ''; }); step(); drawCanvas(); }
  };
  side.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset && b.dataset.clearopt) {
      ed.sel.forEach(w => {
        if (!w.opt) return;
        if (b.dataset.idx !== undefined) { const a = [...(w.opt[b.dataset.clearopt] || [])]; a[Number(b.dataset.idx)] = null; w.opt[b.dataset.clearopt] = a; } else delete w.opt[b.dataset.clearopt];
      });
      step(); redraw(); return;
    }
    if (b.dataset && b.dataset.saveset) { // the pictures uploaded in this widget become a set that other widgets and layouts can use too
      const w = ed.sel[0], o = w.opt || {}, fuel = w.type === 'fuel', n = (ed.imageSets || []).filter(r => r.kind === (fuel ? 'fuel' : 'flag')).length + 1;
      const set = fuel ? { name: `Fuel pictures ${n}`, kind: 'fuel', steps: Widgets.clampInt(o.steps ?? 10, 2, 20, 10), images: Array.from({ length: Widgets.clampInt(o.steps ?? 10, 2, 20, 10) }, (_, i) => (o.stepImages || [])[i] || '') }
        : { name: `Flag pictures ${n}`, kind: 'flag', images: Object.fromEntries(Widgets.FLAG_STATES.map(([k]) => [k, o['img_' + k] || ''])) };
      api.add('imagesets', set).then(async row => { ed.imageSets = await api.list('imagesets'); ed.sel.forEach(x => { x.opt = x.opt || {}; x.opt.imageSet = row.id; }); step(); redraw(); $('e-msg').textContent = `Saved as the set "${set.name}". You can rename it under Customization > Image Settings.`; });
      return;
    }
    if (b.id === 's-del') removeSel();
    if (b.id === 's-dup') duplicateSel();
  };

  if (editorKeyHandler) document.removeEventListener('keydown', editorKeyHandler);
  editorKeyHandler = e => {
    const mod = e.ctrlKey || e.metaKey, key = String(e.key).toLowerCase();
    if (mod && (key === 'z' || key === 'y') && !typingIn(e.target) && dlg.open !== true) { e.preventDefault(); if (key === 'y' || e.shiftKey) window.editorRedo(); else window.editorUndo(); return; }
    if (e.target && e.target.matches && e.target.matches('input,select,textarea')) return;
    if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'a') { e.preventDefault(); ed.sel = [...d.widgets]; redraw(); return; }
    if (!ed.sel.length) return;
    if (e.key === 'Delete' || e.key === 'Backspace') removeSel();
    else if (e.key === 'Escape') { ed.sel = []; redraw(); }
  };
  document.addEventListener('keydown', editorKeyHandler);
}
