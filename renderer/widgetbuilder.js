// Customization > Widget Builder: make your own widgets (a line of text with {variables}), save them, and add them from the Layout Editor's "My widgets" list.
// A widget is copied into the layout when you add it, so changing it here later does not touch layouts that already use it.
let wbEd = null; // { id, draft, dirty }

const wbKinds = [['textlane', 'Text, per lane (one for each car)'], ['textrace', 'Text, race (one for the whole race)'], ['imagelane', 'Image, per lane'], ['imagerace', 'Image, race']];
const wbIsImage = t => t === 'imagelane' || t === 'imagerace';
const wbVars = t => (t === 'textrace' || t === 'imagerace' ? Widgets.TEXT_RACE_VARS : Widgets.TEXT_LANE_VARS);
const wbNew = () => ({ name: '', type: 'textlane', text: Widgets.TEXT_LANE_DEFAULT, w: 300, h: 60, textSize: 30, valueBold: true, valueItalic: false });

// a saved widget -> a widget for a layout (position is set by the editor)
function wbToWidget(r, lane) {
  const g = Widgets.newWidget(r.type, lane, 20, 20);
  g.opt = wbIsImage(r.type) ? { image: r.image || '', fit: r.fit || 'contain', rules: clone(r.rules || []) } : { text: r.text }; g.w = Number(r.w) || g.w; g.h = Number(r.h) || g.h; g.textSize = r.textSize ?? g.textSize; g.valueBold = r.valueBold !== false; g.valueItalic = !!r.valueItalic;
  g.title = r.name || ''; g.showTitle = false;
  return g;
}

async function renderWidgetBuilder(box) {
  if (wbEd) return renderWidgetBuilderEditor(box);
  manager = null; box.onchange = box.oninput = null;
  const list = await api.list('customwidgets');
  box.innerHTML = `<p class="muted">Make your own widgets here: a line of text where <code>{name}</code>, <code>{best}</code>, <code>{timeleft}</code> and many more variables are filled in during the race, or a picture that changes with a rule (for example a trophy when the position is 1). Saved widgets appear under <em>My widgets</em> in the Layout Editor (and the Leaderboard Editor, for per-lane widgets). Adding one puts a copy in the layout, so changing it here later does not change layouts that already use it.</p>
    <div class="row"><button class="btn primary" id="newwb">New widget</button></div>
    <div class="wrap"><table class="fields"><tr><th>Name</th><th>Kind</th><th>Text</th><th></th></tr>` +
    (list.length ? list.map(r => `<tr><td>${esc(r.name)}</td><td>${esc((wbKinds.find(k => k[0] === r.type) || [0, ''])[1])}</td><td>${wbIsImage(r.type) ? `${(r.rules || []).length} rule(s)${r.image ? ', fixed picture' : ''}` : esc(r.text)}</td><td class="actions"><button class="btn" data-edit="${esc(r.id)}">Edit</button> <button class="btn" data-dup="${esc(r.id)}">Duplicate</button> <button class="btn danger" data-del="${esc(r.id)}">Delete</button></td></tr>`).join('') : '<tr><td colspan="4" class="muted">No widgets yet.</td></tr>') + '</table></div>';
  box.onclick = async ev => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.id === 'newwb') { wbEd = { id: null, draft: wbNew(), dirty: true }; return renderWidgetBuilder(box); }
    const r = list.find(x => x.id === (b.dataset.edit || b.dataset.dup || b.dataset.del)); if (!r) return;
    const own = () => clone({ name: r.name, type: r.type, text: r.text, image: r.image, fit: r.fit, rules: r.rules, w: r.w, h: r.h, textSize: r.textSize, valueBold: r.valueBold, valueItalic: r.valueItalic });
    if (b.dataset.edit) { wbEd = { id: r.id, draft: own(), dirty: false }; return renderWidgetBuilder(box); }
    if (b.dataset.dup) { const d = own(); d.name = r.name + ' (copy)'; await api.add('customwidgets', d); return renderWidgetBuilder(box); }
    if (b.dataset.del && confirm(`Delete the widget "${r.name}"?\n\nLayouts that already use it keep their copy.\n\nThis can't be undone.`)) { await api.remove('customwidgets', r.id); renderWidgetBuilder(box); }
  };
}

function renderWidgetBuilderEditor(box) {
  box.onclick = box.onchange = box.oninput = null;
  const d = wbEd.draft, img = wbIsImage(d.type), vars = wbVars(d.type);
  if (img) { d.rules = d.rules || []; d.fit = d.fit || 'contain'; }
  const prevWidget = () => { const w = Widgets.newWidget(d.type, 0, 0, 0); w.opt = img ? { image: d.image, fit: d.fit, rules: d.rules } : { text: d.text }; w.valueBold = d.valueBold !== false; w.valueItalic = !!d.valueItalic; return w; };
  const preview = () => { const w = prevWidget(); return img ? `<div class="wbprev" style="width:${Math.min(300, d.w)}px;height:${Math.min(200, d.h)}px">${Widgets.sampleOf(Widgets.def(d.type), 0, w)}</div>`
    : `<div class="wbprev" style="font-size:${Math.max(8, Math.min(40, Number(d.textSize) / 2 || 15))}px;${Widgets.valueStyleOf(w)}">${Widgets.sampleOf(Widgets.def(d.type), 0, w)}</div>`; };
  const varSel = (cur, attr) => `<select ${attr} aria-label="Variable">${vars.map(v => `<option value="${v[0]}"${v[0] === cur ? ' selected' : ''}>{${v[0]}} ${esc(v[1])}</option>`).join('')}</select>`;
  const pic = (src, attr, none) => `${src ? `<img class="optimg" src="${esc(src)}" alt=""> ` : `<span class="muted">${none} </span>`}<input type="file" accept="image/*" ${attr}>${src ? ` <button class="btn" type="button" data-clr="${attr.replace(/^data-pic=/, '').replace(/"/g, '')}">Remove</button>` : ''}`;
  const textBody = `<div class="field"><label for="wb-text">Text</label><input id="wb-text" type="text" maxlength="200" value="${esc(d.text)}" style="width:100%"></div>
    <div class="field"><span class="muted">Variables (press one to put it in the text):</span><div class="wbvars">${vars.map(v => `<button class="btn" type="button" data-var="${v[0]}" title="${esc(v[1])}">{${v[0]}} <span class="muted">${esc(v[1])}</span></button>`).join(' ')}</div></div>`;
  const imgBody = () => `<div class="field"><label>Picture shown when no rule matches</label><div class="inline">${pic(d.image, 'data-pic="fixed"', 'none')}</div></div>
    <div class="field"><label for="wb-fit">Fit</label><select id="wb-fit"><option value="contain"${d.fit === 'contain' ? ' selected' : ''}>Show the whole picture</option><option value="cover"${d.fit === 'cover' ? ' selected' : ''}>Fill the widget (may crop)</option></select></div>
    <h3>Rules</h3><p class="muted">The first rule that is true shows its picture. Numbers are compared as numbers (position, lap, fuel %...); words are compared without capitals (flag, name...).</p>
    <div id="wb-rules">${d.rules.map((r, i) => `<div class="row" data-rule="${i}">If ${varSel(r.var, `data-rv="${i}"`)}
      <select data-ro="${i}" aria-label="Comparison">${Widgets.IMG_OPS.map(o => `<option value="${esc(o[0])}"${o[0] === (r.op || '=') ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select>
      <input type="text" data-rval="${i}" value="${esc(r.value)}" placeholder="value" style="width:8em" aria-label="Value"> show ${pic(r.image, `data-pic="${i}"`, 'no picture')}
      <button class="btn danger" type="button" data-rdel="${i}">Remove rule</button></div>`).join('') || '<p class="muted">No rules yet.</p>'}</div>
    <div class="row"><button class="btn" type="button" id="wb-addrule">Add a rule</button></div>`;
  box.innerHTML = `<div class="row wb-bar"><button class="btn" id="wb-back">Back to the list</button>${undoButtons('wb')}<button class="btn primary" id="wb-save">Save</button><span id="wb-msg" class="muted" role="status"></span></div>
    <div class="field"><label for="wb-name">Name</label><input id="wb-name" type="text" maxlength="60" value="${esc(d.name)}"></div>
    <div class="field"><label for="wb-type">Kind</label><select id="wb-type">${wbKinds.map(k => `<option value="${k[0]}"${k[0] === d.type ? ' selected' : ''}>${esc(k[1])}</option>`).join('')}</select></div>
    ${img ? imgBody() : textBody}
    <div class="row"><label>Width <input id="wb-w" type="number" min="${Widgets.MIN}" max="1000" step="5" value="${esc(d.w)}" style="width:5em"></label><label>Height <input id="wb-h" type="number" min="${Widgets.MIN}" max="1000" step="5" value="${esc(d.h)}" style="width:5em"></label>
      ${img ? '' : `<label>Text size <input id="wb-size" type="number" min="5" max="200" step="1" value="${esc(d.textSize)}" style="width:5em"></label>
      <label class="inline"><input type="checkbox" id="wb-bold" ${d.valueBold !== false ? 'checked' : ''}> Bold</label><label class="inline"><input type="checkbox" id="wb-italic" ${d.valueItalic ? 'checked' : ''}> Italic</label>`}</div>
    <p class="muted">Preview${img ? ' (the fixed picture, or the first rule\'s picture)' : ' with sample values'} (colours and the exact size are set in the Layout Editor):</p><div id="wb-prev">${preview()}</div>`;
  const $ = id => document.getElementById(id), show = () => { $('wb-prev').innerHTML = preview(); };
  const msg = t => { $('wb-msg').textContent = t; };
  // Undo and redo (typing is one step after a quiet moment; every other change is a step of its own)
  const U = draftUndo(wbEd, 'wb', () => renderWidgetBuilderEditor(box)), mark = U.mark, step = U.step;
  const set = (k, v, typing) => { d[k] = v; (typing ? mark : step)(); show(); };
  $('wb-name').oninput = e => { d.name = e.target.value; mark(); };
  $('wb-type').onchange = e => {
    const was = d.type; d.type = e.target.value;
    if (!wbIsImage(was) && !wbIsImage(d.type) && d.text === (was === 'textrace' ? Widgets.TEXT_RACE_DEFAULT : Widgets.TEXT_LANE_DEFAULT)) d.text = d.type === 'textrace' ? Widgets.TEXT_RACE_DEFAULT : Widgets.TEXT_LANE_DEFAULT;
    if (wbIsImage(d.type)) { const ok = wbVars(d.type).map(v => v[0]); d.rules = (d.rules || []).filter(r => ok.includes(r.var)); } // rules that use a variable the new kind does not have are dropped
    if (!d.text) d.text = d.type === 'textrace' ? Widgets.TEXT_RACE_DEFAULT : Widgets.TEXT_LANE_DEFAULT;
    step(); renderWidgetBuilderEditor(box);
  };
  $('wb-w').onchange = e => set('w', Number(e.target.value)); $('wb-h').onchange = e => set('h', Number(e.target.value));
  if (!img) {
    $('wb-text').oninput = e => set('text', e.target.value, true); $('wb-size').onchange = e => set('textSize', Number(e.target.value));
    $('wb-bold').onchange = e => set('valueBold', !!e.target.checked); $('wb-italic').onchange = e => set('valueItalic', !!e.target.checked);
    box.querySelector('.wbvars').onclick = ev => { const b = ev.target.closest('[data-var]'); if (!b) return; const t = $('wb-text'), a = t.selectionStart ?? t.value.length, z = t.selectionEnd ?? a, ins = '{' + b.dataset.var + '}'; t.value = t.value.slice(0, a) + ins + t.value.slice(z); t.focus(); try { t.setSelectionRange(a + ins.length, a + ins.length); } catch (x) { /* not a text box */ } set('text', t.value); };
  } else {
    $('wb-fit').onchange = e => set('fit', e.target.value);
    $('wb-addrule').onclick = () => { d.rules.push({ var: vars[0][0], op: '=', value: '', image: '' }); step(); renderWidgetBuilderEditor(box); };
    box.onchange = async ev => {
      const t = ev.target, ds = t.dataset || {};
      if (ds.rv !== undefined) return set('rules', (d.rules[Number(ds.rv)].var = t.value, d.rules));
      if (ds.ro !== undefined) return set('rules', (d.rules[Number(ds.ro)].op = t.value, d.rules));
      if (ds.rval !== undefined) return set('rules', (d.rules[Number(ds.rval)].value = t.value, d.rules));
      if (ds.pic !== undefined && t.files && t.files[0]) {
        try { const data = await resizeImage(t.files[0], 512, true); if (ds.pic === 'fixed') d.image = data; else d.rules[Number(ds.pic)].image = data; step(); renderWidgetBuilderEditor(box); } catch (x) { msg(x.message || 'Could not read that picture.'); }
      }
    };
    box.oninput = ev => { const ds = (ev.target && ev.target.dataset) || {}; if (ds.rval !== undefined) { d.rules[Number(ds.rval)].value = ev.target.value; mark(); show(); } };
    box.onclick = ev => {
      const b = ev.target.closest('button'); if (!b) return; const ds = b.dataset || {};
      if (ds.rdel !== undefined) { d.rules.splice(Number(ds.rdel), 1); step(); return renderWidgetBuilderEditor(box); }
      if (ds.clr !== undefined) { if (ds.clr === 'fixed') d.image = ''; else d.rules[Number(ds.clr)].image = ''; step(); return renderWidgetBuilderEditor(box); }
    };
  }
  $('wb-back').onclick = () => { if (wbEd.dirty && !confirm('Discard your unsaved changes to this widget?')) return; draftUndoEnd(wbEd); wbEd = null; renderWidgetBuilder(box); };
  $('wb-save').onclick = async () => {
    if (!String(d.name).trim()) return msg('Give the widget a name.');
    const token = U.hist.commit(), data = clone({ ...d, name: String(d.name).trim() }); // (the state that is written is the one the steps call saved)
    if (wbEd.id) await api.update('customwidgets', wbEd.id, data); else { const row = await api.add('customwidgets', data); wbEd.id = row.id; }
    U.hist.markSaved(token); wbEd.dirty = !U.hist.isClean(); msg('Saved.'); // (a change made while it was being written is not saved yet)
  };
}
