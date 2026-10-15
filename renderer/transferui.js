// App Settings > Import and Export: pick items (a layout, a driver, a whole race setup...) and save them to a file; read such a file and add its items as copies.
const trState = { picks: {}, skip: new Set(), open: new Set(), pending: null, msg: '', bk: null, bkMsg: '' }; // skip: "entity:id" of things the ticked items use that the user does not want in the file
const TR_GROUPS = [['Database', ['tracks', 'slotcars', 'drivers', 'racesetups', 'fuelrules', 'penaltysystems', 'weathersystems', 'rotationsetups']], ['Look and sound', ['layouts', 'rowdesigns', 'imagesets', 'audiosets', 'customwidgets']], ['History', ['sessions']]];
const ORDER_DEPS = ['tracks', 'slotcars', 'drivers', 'layouts', 'rowdesigns', 'imagesets', 'audiosets', 'fuelrules', 'penaltysystems', 'weathersystems', 'rotationsetups', 'customwidgets', 'racesetups', 'sessions'];
const trLabel = (e, r) => (e === 'sessions' ? [r.setupName, r.date].filter(Boolean).join(' · ') || '(session)' : titleOf(e, r));

const TR_FOLDERS = ['backup', 'export', 'import'];
async function renderTransferSettings(box) {
  if (!api.exportData) { box.innerHTML = '<p class="muted">Export and import work in the Windows app.</p>'; return; }
  const lists = {}; for (const [, es] of TR_GROUPS) for (const e of es) lists[e] = await api.list(e);
  const chosen = {}; Object.entries(trState.picks).forEach(([e, set]) => { if (set.size) chosen[e] = [...set]; });
  const deps = Object.keys(chosen).length ? await api.exportDeps(chosen) : {};
  const labelOf = (e, id) => { const r = (lists[e] || []).find(x => x.id === id); return r ? trLabel(e, r) : '(missing)'; };
  const picked = () => Object.values(trState.picks).reduce((n, s) => n + s.size, 0);
  const sel = e => trState.picks[e] || (trState.picks[e] = new Set());
  const itemsHtml = e => lists[e].length ? `<label class="inline"><input type="checkbox" data-all="${e}"${lists[e].every(r => sel(e).has(r.id)) ? ' checked' : ''}> All ${esc(state.schema[e].plural.toLowerCase())}</label><div class="trlist">${lists[e].map(r => `<label class="inline"><input type="checkbox" data-item="${e}:${esc(r.id)}"${sel(e).has(r.id) ? ' checked' : ''}> ${esc(trLabel(e, r))}</label>`).join('')}</div>` : '<span class="muted">none yet</span>';
  const pending = trState.pending, bk = trState.bk;
  // three folders, as on the Results and Records page: each opens and closes, the choice is remembered while the app runs
  const tf = (id, title, note, body) => folderHtml('transfer', id, title, note, `<div class="fbody">${body}</div>`);
  box.innerHTML = folderTools
    + tf('backup', 'Complete backup', bk ? 'a backup file is waiting' : 'everything in one file', `<p class="muted">A backup is everything in one file: the database, layouts, pictures, sounds, settings, past races and laps. Restoring it puts the app back exactly as it was when the backup was made. The file also holds your settings, including the Race Director password, so keep it somewhere safe.</p>
    <div class="row"><button class="btn primary" id="bk-save">Save a complete backup...</button><button class="btn" id="bk-open">Restore from a backup...</button></div>
    <p class="muted" id="bk-msg">${esc(trState.bkMsg)}</p>
    ${bk ? `<div class="card"><strong>${esc(bk.file || 'File')}</strong>${bk.date ? ` (made ${esc(new Date(bk.date).toLocaleString())}${bk.appVersion ? `, version ${esc(bk.appVersion)}` : ''})` : ''} contains:<ul>${Object.entries(bk.counts || {}).map(([e, n]) => `<li>${n} ${esc(((state.schema[e] && (n === 1 ? state.schema[e].label : state.schema[e].plural)) || e).toLowerCase())}</li>`).join('') || '<li>no items</li>'}${bk.laps ? `<li>${bk.laps} laps</li>` : ''}</ul>
      <p><strong>Restoring replaces everything you have now</strong> with the contents of this file. The data you have now is first kept in a safety file next to the database.</p>
      <div class="row"><button class="btn primary" id="bk-apply">Replace everything with this backup</button><button class="btn" id="bk-cancel">Cancel</button></div></div>` : ''}`)
    + tf('export', 'Export', picked() ? picked() + ' ticked' : 'choose what to save in a file', `<p class="muted">Tick what to save in a file: single items or whole groups. The file can be imported on this or another computer.</p>
    ${TR_GROUPS.map(([g, es]) => `<details class="trgroup" data-key="g:${esc(g)}"${trState.open.has('g:' + g) ? ' open' : ''}><summary><strong>${esc(g)}</strong></summary>${es.map(e => `<details class="trent" data-key="e:${e}"${trState.open.has('e:' + e) ? ' open' : ''}><summary>${esc(state.schema[e].plural)} (${lists[e].length})${sel(e).size ? ` · ${sel(e).size} ticked` : ''}</summary>${itemsHtml(e)}</details>`).join('')}</details>`).join('')}
    ${Object.keys(deps).length ? `<h4>Also take what these items use</h4><p class="muted">Untick anything you do not want in the file (for example the track of a race setup). Links to things left out are emptied on import.</p>
      ${ORDER_DEPS.filter(e => deps[e]).map(e => `<div class="trdep"><strong>${esc(state.schema[e].plural)}</strong> <label class="inline"><input type="checkbox" data-dall="${e}"${deps[e].every(d => d.required || !trState.skip.has(e + ':' + d.id)) ? ' checked' : ''}> all</label><div class="trlist">${deps[e].map(d => `<label class="inline"><input type="checkbox" data-dep="${e}:${esc(d.id)}"${d.required || !trState.skip.has(e + ':' + d.id) ? ' checked' : ''}${d.required ? ' disabled' : ''}> ${esc(labelOf(e, d.id))}${d.required ? ' <span class="muted">(needed by a session)</span>' : ''}</label>`).join('')}</div></div>`).join('')}` : ''}
    <p class="muted">Sessions always include their laps, track, drivers and slotcars.</p>
    <div class="row"><button class="btn primary" id="tr-export"${picked() ? '' : ' disabled'}>Export ${picked()} ticked item${picked() === 1 ? '' : 's'} to a file...</button><button class="btn" id="tr-none"${picked() ? '' : ' disabled'}>Untick all</button><span id="tr-msg" class="muted" role="status">${esc(trState.msg)}</span></div>`)
    + tf('import', 'Import', pending ? 'a file is waiting' : 'add items from a file', `<p class="muted">Items from a file are added as copies: nothing you have is changed. Links between the items are kept, and a name you already have gets "(imported)" after it.</p>
    <div class="row"><button class="btn" id="tr-open">Choose a file to import...</button></div>
    ${pending ? `<div class="card"><strong>${esc(pending.file || 'File')}</strong> contains:<ul>${Object.entries(pending.summary).map(([e, s]) => `<li>${s.count} ${esc((s.count === 1 ? state.schema[e].label : state.schema[e].plural).toLowerCase())}${s.names.filter(Boolean).length ? ': ' + esc(s.names.filter(Boolean).join(', ')) + (s.count > s.names.length ? ', ...' : '') : ''}</li>`).join('')}</ul>
      <div class="row"><button class="btn primary" id="tr-apply">Add to my data</button><button class="btn" id="tr-cancel">Cancel</button></div></div>` : ''}`);
  folderWire(box);
  box.onclick = ev => { const fa = ev.target && ev.target.closest ? ev.target.closest('[data-folderall]') : null; if (fa) { folderAll('transfer', TR_FOLDERS, fa.dataset.folderall === '1'); renderTransferSettings(box); } };
  const $ = id => document.getElementById(id), msg = t => { trState.msg = t; const m = $('tr-msg'); if (m) m.textContent = t; };
  const bmsg = t => { trState.bkMsg = t; const m = $('bk-msg'); if (m) m.textContent = t; };
  $('bk-save').onclick = async () => { try { const res = await api.backupSave(); bmsg(res && res.saved ? `Backup saved: ${res.path}` : 'Not saved.'); } catch (x) { bmsg('Could not save the backup: ' + x.message); } };
  $('bk-open').onclick = async () => {
    try { const res = await api.backupOpen(); if (!res || res.canceled) return; if (!res.ok) { trState.bk = null; trState.bkMsg = res.error; return renderTransferSettings(box); } trState.bk = res; trState.bkMsg = ''; renderTransferSettings(box); } catch (x) { bmsg('Could not read the file: ' + x.message); }
  };
  if (bk) {
    $('bk-cancel').onclick = async () => { await api.backupCancel(); trState.bk = null; renderTransferSettings(box); };
    $('bk-apply').onclick = async () => {
      if (!confirm('Replace everything you have now with this backup? This cannot be undone from the app (a safety file is kept next to the database).')) return;
      try { await api.backupRestore(); trState.bk = null; trState.bkMsg = 'The backup is restored.'; } catch (x) { bmsg('Could not restore the backup: ' + x.message); }
    };
  }
  box.onchange = ev => {
    const t = ev.target, ds = (t && t.dataset) || {};
    if (ds.dall) { const e = ds.dall; (deps[e] || []).filter(d => !d.required).forEach(d => { if (t.checked) trState.skip.delete(e + ':' + d.id); else trState.skip.add(e + ':' + d.id); }); return renderTransferSettings(box); }
    if (ds.dep) { if (t.checked) trState.skip.delete(ds.dep); else trState.skip.add(ds.dep); return renderTransferSettings(box); }
    if (ds.all) { const e = ds.all; trState.picks[e] = new Set(t.checked ? lists[e].map(r => r.id) : []); return renderTransferSettings(box); }
    if (ds.item) { const i = ds.item.indexOf(':'), e = ds.item.slice(0, i), id = ds.item.slice(i + 1); if (t.checked) sel(e).add(id); else sel(e).delete(id); trState.msg = ''; return renderTransferSettings(box); }
  };
  if (typeof box.addEventListener === 'function') { // a <details> that is opened or closed is remembered, so ticking a box does not close it
    if (box._trToggle) box.removeEventListener('toggle', box._trToggle, true);
    box._trToggle = ev => { const d = ev.target; if (d && d.dataset && d.dataset.key) { if (d.open) trState.open.add(d.dataset.key); else trState.open.delete(d.dataset.key); } };
    box.addEventListener('toggle', box._trToggle, true);
  }
  $('tr-none').onclick = () => { trState.picks = {}; trState.msg = ''; renderTransferSettings(box); };
  $('tr-export').onclick = async () => {
    const extras = {}; Object.entries(deps).forEach(([e, list]) => { const ids = list.filter(d => d.required || !trState.skip.has(e + ':' + d.id)).map(d => d.id); if (ids.length) extras[e] = ids; });
    try { const res = await api.exportData(chosen, extras); msg(res && res.saved ? `Saved ${Object.values(res.counts || {}).reduce((a, b) => a + b, 0)} items: ${res.path}` : 'Not saved.'); } catch (x) { msg('Could not export: ' + x.message); }
  };
  $('tr-open').onclick = async () => {
    try { const res = await api.importOpen(); if (!res || res.canceled) return; if (!res.ok) { trState.pending = null; msg(res.error); return renderTransferSettings(box); } trState.pending = res; trState.msg = ''; renderTransferSettings(box); } catch (x) { msg('Could not read the file: ' + x.message); }
  };
  if (pending) {
    $('tr-cancel').onclick = async () => { await api.importCancel(); trState.pending = null; renderTransferSettings(box); };
    $('tr-apply').onclick = async () => {
      try { const counts = await api.importApply(); trState.pending = null; trState.msg = 'Added ' + Object.entries(counts).map(([e, n]) => `${n} ${(n === 1 ? state.schema[e].label : state.schema[e].plural).toLowerCase()}`).join(', ') + '.'; renderTransferSettings(box); } catch (x) { msg('Could not import: ' + x.message); }
    };
  }
}
