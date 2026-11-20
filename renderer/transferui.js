// App Settings > Import and Export (2.4.0, SlotForgeRestyle.md "Backup Vault"): three sections.
// - Backups: how safe the data is (the last backup, the next one, a warning when the backups are on the same drive), every backup in a list with what it
//   holds and Restore… (a backup of what is there now is made first, "Before a restore"), Back up now with a note, Save a backup to…, the schedule of
//   the automatic backups, and the native backup for large collections.
// - Export: a picker (a search, the kinds as chips with counts) and Your file: what goes in it with what the items use, the file name.
// - Import: the items of a file, each New or Already here, with Add a copy, Replace mine or Skip (a backup is made first).
const trState = {
  picks: {},
  skip: new Set(),
  open: new Set(),
  pending: null,
  msg: '',
  bk: null,
  bkMsg: '',
  exKind: '',
  exQ: '',
  exName: '',
  uses: {},
  choices: {},
  bvNote: '',
  sums: {}
}; // skip: "entity:id" of things the ticked items use that the user does not want in the file; uses: "entity:id" -> what an item uses (words)
const TR_GROUPS = [
  ['Race setups', ['racesetups']],
  ['Tracks', ['tracks']],
  ['Drivers', ['drivers']],
  ['Slot cars', ['slotcars']],
  ['Teams', ['teams']],
  [
    'Systems',
    [
      'fuelrules',
      'penaltysystems',
      'damagesystems',
      'tyrewearsystems',
      'safetycarsystems',
      'pushsavesystems',
      'weathersystems',
      'raceclasses',
      'multiclasssystems',
      'virtualrivalsystems',
      'resourcesystems',
      'rotationsetups'
    ]
  ],
  ['Championships', ['championships']],
  ['Layouts and widgets', ['layouts', 'rowdesigns', 'chartdesigns', 'imagesets', 'customwidgets']],
  ['Sounds', ['audiosets']],
  ['Races', ['sessions']]
];
const ORDER_DEPS = [
  'resourcesystems',
  'tracks',
  'slotcars',
  'drivers',
  'teams',
  'layouts',
  'rowdesigns',
  'chartdesigns',
  'imagesets',
  'audiosets',
  'fuelrules',
  'penaltysystems',
  'damagesystems',
  'tyrewearsystems',
  'safetycarsystems',
  'pushsavesystems',
  'raceclasses',
  'multiclasssystems',
  'virtualrivalsystems',
  'weathersystems',
  'rotationsetups',
  'customwidgets',
  'racesetups',
  'championships',
  'sessions'
];
const trLabel = (e, r) => (e === 'sessions' ? [r.setupName, r.date].filter(Boolean).join(' · ') || '(session)' : titleOf(e, r));
const trKind = (e, n) => ((state.schema[e] && (n === 1 ? state.schema[e].label : state.schema[e].plural)) || e).toLowerCase();

const TR_FOLDERS = ['backups', 'export', 'import', 'storage'];
// ---- words of the backups (pure, for the tests too) ----
const abSize = n =>
  n >= 1e9 ? (n / 1e9).toFixed(1) + ' GB' : n >= 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1e3)) + ' kB';
const BV_WORDS = {
  drivers: ['driver', 'drivers'],
  tracks: ['track', 'tracks'],
  slotcars: ['slot car', 'slot cars'],
  racesetups: ['race setup', 'race setups'],
  sessions: ['race', 'races']
};
const bvHolds = c =>
  c ? ['drivers', 'tracks', 'sessions'].map(k => `${Number(c[k]) || 0} ${BV_WORDS[k][(Number(c[k]) || 0) === 1 ? 0 : 1]}`).join(' · ') : '';
// "Today, 21:04", "Yesterday, 08:32", "Tue 17 Nov, 08:32" (now: the moment it is said)
function bvWhen(iso, now = Date.now()) {
  const d = new Date(iso);
  if (!iso || isNaN(d)) return '–';
  const t = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    day = x => new Date(x).toDateString(),
    n = new Date(now);
  if (day(d) === day(n)) return 'Today, ' + t;
  if (day(d) === day(n - 864e5)) return 'Yesterday, ' + t;
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }) + ', ' + t;
}
function bvAgo(iso, now = Date.now()) {
  const days = Math.floor((now - Date.parse(iso)) / 864e5);
  return !Number.isFinite(days) || days < 1 ? '' : days === 1 ? '1 day ago' : `${days} days ago`;
}
// the card on top: { tone: 'ok' | 'late' | 'bad' | 'off', kicker, title, line }
function bvHealth(st, list, now = Date.now()) {
  const last = list && list.length ? list[0] : null,
    every = st && st.every === 'week' ? 'Every week' : 'Every day the app is used',
    keep = st ? `the newest ${st.keep} kept` : '';
  if (st && st.ok === false)
    return {
      tone: 'bad',
      kicker: 'Backups · the last one failed',
      title: 'The last backup failed',
      line: `${st.error || ''}${last ? ` The last good one is from ${bvWhen(last.date, now)}.` : ''}`.trim()
    };
  if (!last)
    return {
      tone: st && st.on ? 'late' : 'off',
      kicker: 'Backups · none yet',
      title: 'No backup yet',
      line:
        st && st.on
          ? 'The first one is made a minute or two after the app starts, or press Back up now.'
          : 'Automatic backups are off: press Back up now, or switch them on below.'
    };
  const late = st && st.on && st.next && Date.parse(st.next) < now - 864e5;
  const next =
    st && st.on && st.next
      ? ` The next one is due on ${new Date(st.next).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}.`
      : '';
  return {
    tone: late ? 'late' : st && st.on ? 'ok' : 'off',
    kicker: late ? 'Backups · late' : st && st.on ? 'Backups · safe' : 'Backups · automatic backups off',
    title: `Backed up ${bvWhen(last.date, now)
      .replace(/^Today/, 'today')
      .replace(/^Yesterday/, 'yesterday')}`,
    line: st && st.on ? `${every} by itself, ${keep}.${next}` : 'Automatic backups are off: make one by hand now and then.'
  };
}
// what a restore loses, in words: the races since the backup, and what is more now than in the backup
function bvLost(backupCounts, now, lost) {
  const bits = [];
  if (lost && lost.races)
    bits.push(
      `${lost.races} ${lost.races === 1 ? 'race' : 'races'} raced since then${lost.last ? ` (the last on ${new Date(lost.last.date).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}${lost.last.name ? ', “' + lost.last.name + '”' : ''})` : ''}`
    );
  if (backupCounts && now)
    ['drivers', 'tracks', 'slotcars', 'racesetups'].forEach(k => {
      const d = (Number(now[k]) || 0) - (Number(backupCounts[k]) || 0);
      if (d > 0) bits.push(`${d} ${BV_WORDS[k][d === 1 ? 0 : 1]} added since`);
    });
  return bits.length ? bits.join(', ') + '.' : 'Nothing that the backup does not have, as far as the app can tell.';
}
// the export file's name: the first ticked item, and how many more
function trFileName(first, n) {
  const base =
    String(first || 'SlotForge items')
      .replace(/[\\/:*?"<>|]/g, ' ')
      .trim() || 'SlotForge items';
  return `${base}${n > 1 ? ' + ' + (n - 1) : ''}.json`;
}

// ---- automatic backups: the schedule ----
function autoBackupText(st) {
  if (!st) return '';
  if (st.running) return 'Making a backup now…';
  const last = st.lastAt ? new Date(st.lastAt).toLocaleString() : '';
  if (st.ok === false)
    return `The last automatic backup failed${st.failedAt ? ' (' + new Date(st.failedAt).toLocaleString() + ')' : ''}: ${st.error}${last ? ' The last good one is from ' + last + '.' : ''}`;
  if (!last)
    return st.on ? 'No automatic backup yet: the first one is made a minute or two after the app starts.' : 'Automatic backups are off.';
  return `Last backup: ${last}${st.bytes ? ', ' + abSize(st.bytes) : ''}. ${st.count} kept in the folder.`;
}
function bvScheduleHtml(st) {
  if (!st) return '<p class="muted">Automatic backups work in the desktop app.</p>';
  return `<div class="bv-card"><div class="bv-ch"><h4>Schedule</h4><small>when backups are made by themselves</small><span class="bv-sp"></span><label class="bv-on"><input type="checkbox" id="ab-on"${st.on ? ' checked' : ''}> On</label></div>
    <div class="bv-sched"><label>How often<span class="bs-gearsel" role="group"><button type="button" data-ab-every="day" class="${st.every === 'day' ? 'on' : ''}">Every day used</button><button type="button" data-ab-every="week" class="${st.every === 'week' ? 'on' : ''}">Every week</button></span></label>
    <label>Keep the newest<input id="ab-keep" type="number" min="1" max="60" value="${esc(st.keep)}"></label>
    <label>Folder<span class="bv-folder"><b>${esc(st.folder)}</b><button type="button" class="btn sm" id="ab-folder">Change…</button>${st.folder !== st.defaultFolder ? '<button type="button" class="btn sm" id="ab-default">Use the standard folder</button>' : ''}</span></label></div>
    <div class="bv-foot">Never during a race. Only its own automatic backups are removed when there are more than ${esc(st.keep)}; backups made by hand stay.</div></div>`;
}
function bindAutoBackup(box) {
  const $ = id => box.querySelector('#' + id),
    redraw = () => renderTransferSettings(box);
  if (!$('ab-on')) return;
  const set = async patch => {
    state.settings = await api.setSettings({ autoBackup: { ...(state.settings.autoBackup || {}), ...patch } });
    redraw();
  };
  $('ab-on').onchange = e => set({ on: e.target.checked });
  box.querySelectorAll('[data-ab-every]').forEach(b => (b.onclick = () => set({ every: b.dataset.abEvery })));
  $('ab-keep').onchange = e => {
    const n = Math.floor(Number(e.target.value));
    if (n >= 1 && n <= 60) set({ keep: n });
  };
  $('ab-folder').onclick = async () => {
    const folder = await api.autoBackupFolder();
    if (folder) set({ folder });
  };
  if ($('ab-default')) $('ab-default').onclick = () => set({ folder: '' });
}

// ---- the restore question: what the backup holds next to what there is now, and what is lost ----
function bvRestoreHtml(pick, counts) {
  const e = pick.entry || {},
    now = pick.now || {},
    rows = ['drivers', 'tracks', 'slotcars', 'racesetups', 'sessions'];
  const when = bvWhen(e.date);
  const table = counts
    ? `<table class="bv-cmp"><thead><tr><th></th><th>In the backup</th><th>Now</th></tr></thead><tbody>${rows
        .map(k => {
          const a = Number(counts[k]) || 0,
            b = Number(now[k]) || 0;
          return `<tr><td>${esc(BV_WORDS[k][1][0].toUpperCase() + BV_WORDS[k][1].slice(1))}</td><td>${a}</td><td${a !== b ? ' class="bv-diff"' : ''}>${b}</td></tr>`;
        })
        .join('')}</tbody></table>`
    : `<p class="muted">${pick.folder ? 'A backup folder of the shared library: the car library and the racing history of both apps, and the settings of Timing.' : 'What it holds could not be read.'}</p>`;
  return `<h3>Restore the backup of ${esc(when)}?</h3><div class="appdlg-body"><p>The app goes back to how it was then.${counts ? ' Next to what you have now:' : ''}</p>${table}
    <div class="bv-lost"><b>What is lost</b><span>${esc(bvLost(counts, now, pick.lost))}</span></div>
    <p class="muted bv-safe">What you have now is first saved as a backup “Before a restore”, so you can come back to it from the list. Timing restarts to restore.</p></div>
    <div class="row appdlg-buttons"><button type="button" class="btn" data-bv-answer="">Keep what I have</button><button type="button" class="btn danger" data-bv-answer="yes">Restore the backup of ${esc(isNaN(new Date(e.date)) ? '' : new Date(e.date).toLocaleDateString([], { day: 'numeric', month: 'short' }))} and restart</button></div>`;
}
function bvAsk(html) {
  return new Promise(resolve => {
    const d = document.createElement('dialog');
    d.className = 'appdlg bv-dlg';
    d.innerHTML = html;
    document.body.appendChild(d);
    const done = v => {
      d.close();
      d.remove();
      resolve(v);
    };
    d.addEventListener('click', ev => {
      const b = ev.target.closest && ev.target.closest('[data-bv-answer]');
      if (b) done(b.dataset.bvAnswer === 'yes');
    });
    d.addEventListener('cancel', ev => {
      ev.preventDefault();
      done(false);
    });
    d.showModal();
    d.querySelector('[data-bv-answer=""]').focus();
  });
}

async function renderTransferSettings(box) {
  box.onclick = box.oninput = box.onchange = null;
  if (!api.exportData) {
    box.innerHTML = '<p class="muted">Export and import work in the Windows app.</p>';
    return;
  }
  const sqlite = api.storageStatus && (await api.storageStatus()).backend === 'sqlite';
  const sharedStatus = api.libraryStatus ? await api.libraryStatus() : null,
    shared = sharedStatus?.available;
  if (shared) trState.bk = null;
  const lists = api.transferChoices ? await api.transferChoices() : {};
  for (const [, es] of TR_GROUPS)
    for (const e of es) {
      if (!api.transferChoices) lists[e] = await api.list(e);
      else lists[e] ||= [];
    }
  const chosen = {};
  Object.entries(trState.picks).forEach(([e, set]) => {
    if (set.size) chosen[e] = [...set];
  });
  const deps = Object.keys(chosen).length ? await api.exportDeps(chosen) : {};
  const labelOf = (e, id) => {
    const r = (lists[e] || []).find(x => x.id === id);
    return r ? trLabel(e, r) : '(missing)';
  };
  const picked = () => Object.values(trState.picks).reduce((n, s) => n + s.size, 0);
  const sel = e => trState.picks[e] || (trState.picks[e] = new Set());
  const pending = trState.pending,
    bk = trState.bk;
  const tf = (id, title, note, body) => folderHtml('transfer', id, title, note, `<div class="fbody"><div class="bv">${body}</div></div>`); // (.bv: the settings sheet leaves it as it is)
  const bv = api.backupList ? await api.backupList().catch(() => null) : null,
    abSt = bv ? bv.status : api.autoBackupStatus ? await api.autoBackupStatus().catch(() => null) : null,
    blist = (bv && bv.list) || [];
  // ---- Backups ----
  const health = bvHealth(abSt, blist);
  const KIND = { auto: ['Automatic', '#3ecf8e'], hand: ['By hand', '#3b82f6'], safety: ['For safety', '#f2b705'] };
  const sumOf = b => b.counts || (trState.sums[b.id] && trState.sums[b.id].counts) || null;
  const holdsCell = b => {
    const c = sumOf(b),
      s = trState.sums[b.id];
    return c
      ? esc(bvHolds(c))
      : b.folder
        ? `Backup folder${s && s.appVersion ? ' · version ' + esc(s.appVersion) : ''}`
        : s && s.error
          ? esc(s.error)
          : '<span class="muted">reading…</span>';
  };
  const totalBytes = blist.reduce((n, b) => n + (b.bytes || 0), 0);
  const backupsBody = `<div class="bv-hero bv-${health.tone}"><span class="bv-shield" aria-hidden="true"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/>${health.tone === 'ok' ? '<path d="M8.5 12l2.5 2.5 4.5-5"/>' : '<path d="M12 8v5M12 16.5v.01"/>'}</svg></span>
    <div><span class="bv-k">${esc(health.kicker)}</span><h3>${esc(health.title)}</h3><p>${esc(health.line)}</p>
    <div class="bv-chips"><span class="bv-chip"><b>${blist.length}</b> ${blist.length === 1 ? 'backup' : 'backups'}</span>${totalBytes ? `<span class="bv-chip"><b>${esc(abSize(totalBytes))}</b> in all</span>` : ''}${bv && bv.sameDrive ? '<span class="bv-chip warn">⚠ On the same drive as your data: choose a folder on a USB stick or another drive</span>' : ''}</div></div>
    <div class="bv-act"><input id="bv-note" maxlength="120" placeholder="A note, e.g. Before club night" value="${esc(trState.bvNote)}" aria-label="A note for the backup"><button type="button" class="btn primary" id="ab-now"${abSt && abSt.running ? ' disabled' : ''}>Back up now</button><button type="button" class="btn" id="bk-save">${shared ? 'Save a backup folder to…' : 'Save a backup to…'}</button></div></div>
    <p class="muted bv-msg" id="bk-msg" role="status">${esc(trState.bkMsg)}</p>
    <div class="bv-card"><div class="bv-ch"><h4>Your backups</h4><small>newest first · Restore puts the app back as it was then</small><span class="bv-sp"></span>${api.autoBackupOpen ? '<button type="button" class="btn sm" id="ab-open">Open the folder</button>' : ''}<button type="button" class="btn sm" id="bk-open">${shared ? 'Restore from another folder…' : 'Restore from another file…'}</button></div>
    ${
      blist.length
        ? `<table class="bv-list"><thead><tr><th>When</th><th>Kind</th><th>What it holds</th><th>Size</th><th></th></tr></thead><tbody>${blist
            .map(
              (b, i) =>
                `<tr${i === 0 ? ' class="bv-latest"' : ''}><td class="bv-d"><b>${esc(bvWhen(b.date))}</b><small>${esc(b.note ? '“' + b.note + '”' : bvAgo(b.date) || b.name)}</small></td><td><span class="bv-kind" style="--c:${KIND[b.kind] ? KIND[b.kind][1] : '#888'}"><i></i>${esc(KIND[b.kind] ? KIND[b.kind][0] : b.kind)}</span></td><td class="bv-n">${holdsCell(b)}</td><td class="bv-n">${b.bytes ? esc(abSize(b.bytes)) : ''}</td><td class="bv-a"><button type="button" class="btn sm ghost" data-bv-show="${esc(b.id)}" title="Show it in its folder">Show</button><button type="button" class="btn sm" data-bv-restore="${esc(b.id)}">Restore…</button></td></tr>`
            )
            .join('')}</tbody></table>`
        : '<p class="muted bv-empty">No backup yet. Back up now makes the first one.</p>'
    }</div>
    ${
      bk
        ? `<div class="card"><strong>${esc(bk.file || 'File')}</strong>${bk.date ? ` (made ${esc(new Date(bk.date).toLocaleString())}${bk.appVersion ? `, version ${esc(bk.appVersion)}` : ''})` : ''} contains:<ul>${
            Object.entries(bk.counts || {})
              .map(([e, n]) => `<li>${n} ${esc(trKind(e, n))}</li>`)
              .join('') || '<li>no items</li>'
          }${bk.laps ? `<li>${bk.laps} laps</li>` : ''}</ul>
      <p><strong>Restoring replaces everything you have now</strong> with the contents of this file. What you have now is first saved as a backup “Before a restore”.</p>
      <div class="row"><button class="btn primary" id="bk-apply">Replace everything with this backup</button><button class="btn" id="bk-cancel">Cancel</button></div></div>`
        : ''
    }
    ${bvScheduleHtml(abSt)}
    ${
      sqlite && !shared
        ? '<div class="bv-card bv-large"><div class="bv-ch"><h4>For large collections</h4><small>a native SQLite backup folder, without the size limit of one file</small></div><p class="muted">Keep the entire folder together. Restoring verifies a separate copy on restart and keeps the previous database. It needs a Timing that can use SQLite.</p><div class="row"><button class="btn" id="bk-native-save">Create native backup folder…</button><button class="btn" id="bk-native-restore">Restore native backup folder…</button></div></div>'
        : ''
    }`;
  // ---- Export ----
  const kinds = TR_GROUPS.map(([name, es]) => ({
    name,
    es,
    n: es.reduce((a, e) => a + (lists[e] || []).length, 0),
    ticked: es.reduce((a, e) => a + sel(e).size, 0)
  }));
  if (!trState.exKind || !kinds.some(k => k.name === trState.exKind)) trState.exKind = (kinds.find(k => k.n) || kinds[0]).name;
  const kind = kinds.find(k => k.name === trState.exKind),
    q = trState.exQ.trim().toLowerCase(),
    rows = [];
  kind.es.forEach(e =>
    (lists[e] || []).forEach(r => {
      if (!q || trLabel(e, r).toLowerCase().includes(q)) rows.push({ e, r });
    })
  );
  const shown = rows.slice(0, 80);
  const firstPicked = (() => {
    for (const [, es] of TR_GROUPS) for (const e of es) for (const id of sel(e)) return labelOf(e, id);
    return '';
  })();
  const depList = ORDER_DEPS.filter(e => deps[e]);
  const depCount = depList.reduce((n, e) => n + deps[e].filter(d => d.required || !trState.skip.has(e + ':' + d.id)).length, 0);
  const fileName = trState.exName || trFileName(firstPicked, picked());
  const exportBody = `<div class="tr-ex"><div class="bv-card tr-pick"><div class="tr-bar"><input id="tr-q" placeholder="Find a track, a driver, a race setup…" value="${esc(trState.exQ)}" aria-label="Find items"><button type="button" class="btn sm" id="tr-all"${shown.length ? '' : ' disabled'}>Tick all shown</button></div>
    <div class="tr-kinds" role="group" aria-label="Kinds">${kinds.map(k => `<button type="button" class="tr-k${k.name === trState.exKind ? ' on' : ''}" data-tr-kind="${esc(k.name)}" aria-pressed="${k.name === trState.exKind}">${esc(k.name)} <b>${k.n}</b>${k.ticked ? `<i>${k.ticked} ticked</i>` : ''}</button>`).join('')}</div>
    <div class="tr-rows">${
      shown.length
        ? shown
            .map(
              ({ e, r }) =>
                `<label class="tr-row"><input type="checkbox" data-item="${e}:${esc(r.id)}"${sel(e).has(r.id) ? ' checked' : ''}><span><b>${esc(trLabel(e, r))}</b>${kind.es.length > 1 ? ` <small>· ${esc(state.schema[e].label)}</small>` : ''}</span><span class="tr-uses">${sel(e).has(r.id) && trState.uses[e + ':' + r.id] ? esc(trState.uses[e + ':' + r.id]) : ''}</span></label>`
            )
            .join('')
        : `<p class="muted tr-none">${q ? 'Nothing found.' : 'none yet'}</p>`
    }${rows.length > shown.length ? `<p class="muted tr-more">${rows.length - shown.length} more: use the search</p>` : ''}</div></div>
    <div class="bv-card tr-file"><span class="bv-k">Your file</span><h3>${picked() ? esc(fileName.replace(/\.json$/, '')) : 'Nothing ticked yet'}</h3>
    <ul class="tr-sum">${kinds
      .flatMap(k => k.es.filter(e => sel(e).size).map(e => `<li><span>${esc(state.schema[e].plural)}</span><b>${sel(e).size}</b></li>`))
      .join('')}${depList
      .map(e => {
        const on = deps[e].filter(d => d.required || !trState.skip.has(e + ':' + d.id)).length;
        return `<li class="tr-also"><details><summary><span>+ the ${esc(trKind(e, 2))} they use</span><b>${on}</b></summary><label class="inline"><input type="checkbox" data-dall="${e}"${deps[e].every(d => d.required || !trState.skip.has(e + ':' + d.id)) ? ' checked' : ''}> all</label>${deps[e].map(d => `<label class="inline"><input type="checkbox" data-dep="${e}:${esc(d.id)}"${d.required || !trState.skip.has(e + ':' + d.id) ? ' checked' : ''}${d.required ? ' disabled' : ''}> ${esc(labelOf(e, d.id))}${d.required ? ' <span class="muted">(needed by a session)</span>' : ''}</label>`).join('')}</details></li>`;
      })
      .join('')}</ul>
    ${depList.length ? '<p class="muted tr-alsonote">Also take what these items use: untick anything you do not want in the file. Links to things left out are emptied on import.</p>' : ''}
    <label class="tr-name">File name<input id="tr-name" value="${esc(fileName)}"${picked() ? '' : ' disabled'}></label>
    <button class="btn primary tr-go" id="tr-export"${picked() ? '' : ' disabled'}>Export ${picked()} ${picked() === 1 ? 'item' : 'items'}${depCount ? ' and what they use' : ''}…</button><button class="btn sm ghost" id="tr-none"${picked() ? '' : ' disabled'}>Untick all</button>
    <p class="muted tr-note">Races always take their laps, track, drivers and slot cars. The file can be imported here or on another computer.</p><p id="tr-msg" class="muted" role="status">${esc(trState.msg)}</p></div></div>`;
  // ---- Import ----
  const items = pending && Array.isArray(pending.items) ? pending.items : null;
  // (2.4.0 review) 60 rows of each kind are shown; one that is already here and not shown is skipped unless chosen (Replace mine for all above, say), so
  // nothing of yours is replaced that you did not see
  const TR_SHOWN = 60,
    unseen = new Set();
  if (items)
    [...new Set(items.map(m => m.e))].forEach(e =>
      items
        .filter(m => m.e === e)
        .slice(TR_SHOWN)
        .forEach(m => unseen.add(m))
    );
  const choiceOf = m =>
    trState.choices[m.e + ':' + m.id] ||
    (m.match ? (unseen.has(m) ? 'skip' : m.how === 'id' && m.e !== 'sessions' ? 'replace' : 'copy') : 'copy');
  const segOf = (m, now) => {
    const opts = m.match
      ? m.e === 'sessions'
        ? [
            ['copy', 'Add a copy'],
            ['skip', 'Skip']
          ]
        : [
            ['copy', 'Add a copy'],
            ['replace', 'Replace mine'],
            ['skip', 'Skip']
          ]
      : [
          ['copy', 'Add'],
          ['skip', 'Skip']
        ];
    return `<span class="bs-gearsel" role="group">${opts.map(([v, l]) => `<button type="button" class="${now === v ? 'on' : ''}" data-im="${esc(m.e + ':' + m.id)}" data-val="${v}" aria-pressed="${now === v}">${l}</button>`).join('')}</span>`;
  };
  const tally = items ? items.reduce((t, m) => ((t[choiceOf(m)] = (t[choiceOf(m)] || 0) + 1), t), {}) : {};
  const here = items ? items.filter(m => m.match).length : 0;
  const allNow = items && here ? [...new Set(items.filter(m => m.match && m.e !== 'sessions').map(choiceOf))] : [];
  const importBody = `<div class="tr-im"><div class="row"><button class="btn" id="tr-open">${pending ? 'Choose another file…' : 'Choose a file to import…'}</button>${pending ? '' : '<span class="muted">An export file from SlotForge Timing, or from SlotForge Paddock (choose SlotForge Timing as the export format there).</span>'}</div>
    ${
      pending
        ? `<div class="bv-card tr-imfile"><div class="bv-ch"><span class="tr-fi">JSON</span><div><h4>${esc(String(pending.file || 'File').replace(/\.json$/i, ''))}</h4><small>${esc(pending.file || '')}${pending.appVersion ? ' · from SlotForge Timing ' + esc(pending.appVersion) : ''}${pending.made ? ' · made ' + esc(new Date(pending.made).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })) : ''} · contains: ${Object.entries(
            pending.summary || {}
          )
            .map(([e, s]) => `${s.count} ${esc(trKind(e, s.count))}`)
            .join(', ')}</small></div></div>
        ${
          items
            ? `<div class="bv-ch tr-imhead"><h4>What is in it</h4><small>${here ? `${here} ${here === 1 ? 'is' : 'are'} already here` : 'all new'}</small><span class="bv-sp"></span>${
                here
                  ? `<small>When an item is already here</small><span class="bs-gearsel" role="group">${[
                      ['copy', 'Add a copy'],
                      ['replace', 'Replace mine'],
                      ['skip', 'Skip']
                    ]
                      .map(
                        ([v, l]) =>
                          `<button type="button" class="${allNow.length === 1 && allNow[0] === v ? 'on' : ''}" data-imall="${v}">${l}</button>`
                      )
                      .join('')}</span>`
                  : ''
              }</div>
          ${[...new Set(items.map(m => m.e))]
            .map(
              e =>
                `<div class="tr-grp">${esc(state.schema[e] ? state.schema[e].plural : e)}</div>${items
                  .filter(m => m.e === e)
                  .slice(0, TR_SHOWN)
                  .map(m => {
                    const now = choiceOf(m);
                    return `<div class="tr-it"><span><b>${esc(m.title || '(no name)')}</b></span><span class="tr-st" style="--c:${m.match ? '#f2b705' : '#3ecf8e'}"><i></i>${m.match ? `Already here: <em>${esc(m.match.title || m.match.id)}</em>` : 'New'}</span>${segOf(m, now)}</div>`;
                  })
                  .join('')}${(() => {
                  const hidden = items.filter(m => m.e === e && unseen.has(m)),
                    here = hidden.filter(m => m.match).length;
                  return hidden.length
                    ? `<p class="muted tr-more">${hidden.length} more not shown: ${hidden.length - here} new ${hidden.length - here === 1 ? 'one is' : 'ones are'} added${here ? `, ${here} already here ${here === 1 ? 'is' : 'are'} skipped unless you choose for all above` : ''}.</p>`
                    : '';
                })()}`
            )
            .join('')}
          <div class="tr-imsum"><span>Adds <b>${tally.copy || 0}</b> · replaces <b>${tally.replace || 0}</b> · skips <b>${tally.skip || 0}</b></span><span class="bv-sp"></span><span class="muted">A backup is made first</span><button class="btn" id="tr-cancel">Cancel</button><button class="btn primary" id="tr-apply"${(tally.copy || 0) + (tally.replace || 0) ? '' : ' disabled'}>Import ${(tally.copy || 0) + (tally.replace || 0)} ${(tally.copy || 0) + (tally.replace || 0) === 1 ? 'item' : 'items'}</button></div>`
            : `<div class="tr-imsum"><span>${Object.entries(pending.summary || {})
                .map(
                  ([e, s]) =>
                    `${s.count} ${esc(trKind(e, s.count))}${s.names.filter(Boolean).length ? ': ' + esc(s.names.filter(Boolean).join(', ')) + (s.count > s.names.length ? ', ...' : '') : ''}`
                )
                .join(
                  '; '
                )}</span><span class="bv-sp"></span><button class="btn" id="tr-cancel">Cancel</button><button class="btn primary" id="tr-apply">Add to my data</button></div>`
        }</div>`
        : ''
    }<p class="muted tr-msg2" role="status">${pending ? '' : esc(trState.msg)}</p></div>`;
  const bad = abSt && abSt.ok === false;
  // (2.4.0, Settings Hub) Database storage, from General: the format, where the file is, the room it takes
  const stor = typeof settingsStorageHtml === 'function' ? await settingsStorageHtml().catch(() => null) : null;
  box.innerHTML =
    folderTools +
    tf(
      'backups',
      'Backups',
      bad
        ? 'the last one failed'
        : blist.length
          ? 'last: ' +
            bvWhen(blist[0].date)
              .replace(/^Today/, 'today')
              .replace(/^Yesterday/, 'yesterday')
          : 'none yet',
      backupsBody
    ) +
    tf('export', 'Export', picked() ? picked() + ' ticked' : 'choose what to save in a file', exportBody) +
    tf('import', 'Import', pending ? 'a file is waiting' : 'add or replace items from a file', importBody) +
    (stor
      ? tf(
          'storage',
          'Database storage',
          stor.backend === 'sqlite' ? 'SQLite' : 'JSON',
          `<div class="bv-storage" data-storage-body>${stor.html}</div>`
        )
      : '');
  if (shared && box.querySelector('#bk-open')) box.querySelector('#bk-open').id = 'bk-library-restore';
  if (typeof AppSettingsPage !== 'undefined') AppSettingsPage.enhance(box, 'transfer');
  if (stor && typeof GeneralPage !== 'undefined') GeneralPage.storageOn(box.querySelector('[data-storage-body]'));
  if (stor && typeof settingsStorageBind === 'function') settingsStorageBind();
  if (typeof TransferViews !== 'undefined') TransferViews.attach(box, 'items');
  folderWire(box);
  const $ = id => document.getElementById(id),
    msg = t => {
      trState.msg = t;
      const m = $('tr-msg');
      if (m) m.textContent = t;
    };
  const bmsg = t => {
    trState.bkMsg = t;
    const m = $('bk-msg');
    if (m) m.textContent = t;
  };
  const redraw = () => renderTransferSettings(box);
  // a backup that keeps what there is now, before a restore or an import (false when it could not be made)
  const safety = async note => {
    if (!api.backupMake) return true;
    const r = await api.backupMake({ kind: 'safety', note });
    if (r && r.skipped) {
      bmsg(`Not now: ${r.skipped}.`);
      msg(`Not now: ${r.skipped}.`);
      return false;
    }
    if (r && r.ok === false) {
      bmsg('The backup before it could not be made: ' + (r.error || '') + ' Nothing was changed.');
      msg('The backup before it could not be made: ' + (r.error || '') + ' Nothing was changed.');
      return false;
    }
    return true;
  };
  box.onclick = async ev => {
    const t = ev.target && ev.target.closest ? ev.target : null;
    const fa = t ? t.closest('[data-folderall]') : null;
    if (fa) {
      folderAll('transfer', TR_FOLDERS, fa.dataset.folderall === '1');
      return redraw();
    }
    const b = t && t.closest('[data-tr-kind],[data-im],[data-imall],[data-bv-restore],[data-bv-show]');
    if (!b) return;
    const d = b.dataset;
    if (d.trKind) {
      trState.exKind = d.trKind;
      return redraw();
    }
    if (d.im) {
      trState.choices[d.im] = d.val;
      return redraw();
    }
    if (d.imall) {
      (items || [])
        .filter(m => m.match && (m.e !== 'sessions' || d.imall !== 'replace'))
        .forEach(m => (trState.choices[m.e + ':' + m.id] = d.imall));
      return redraw();
    }
    if (d.bvShow) return api.backupShow(d.bvShow).catch(x => bmsg('Could not show it: ' + x.message));
    if (d.bvRestore) {
      try {
        const pick = await api.backupPick(d.bvRestore);
        // (2.4.0 review) the app holds one backup to restore: picking this one forgets a file opened with "Restore from another file…", so its card goes
        if (trState.bk) {
          trState.bk = null;
          const card = box.querySelector('#bk-apply');
          if (card && card.closest('.card')) card.closest('.card').remove();
        }
        if (!pick || pick.ok === false) return bmsg((pick && pick.error) || 'That backup could not be read.');
        const counts =
          (pick.entry && pick.entry.counts) ||
          (trState.sums[d.bvRestore] && trState.sums[d.bvRestore].counts) ||
          (pick.counts
            ? Object.fromEntries(['drivers', 'tracks', 'slotcars', 'racesetups', 'sessions'].map(k => [k, pick.counts[k] || 0]))
            : null);
        if (!(await bvAsk(bvRestoreHtml(pick, counts)))) {
          if (api.backupCancel) await api.backupCancel();
          return;
        }
        bmsg('Saving what you have now as a backup “Before a restore”…');
        if (!(await safety('Before a restore'))) return;
        bmsg('Restoring…');
        const result = pick.folder ? await api.libraryRestore(d.bvRestore) : await api.backupRestore();
        bmsg(result?.restarting ? 'Restarting to restore the backup.' : result?.canceled ? 'Cancelled.' : 'The backup is restored.');
      } catch (x) {
        bmsg('Could not restore the backup: ' + x.message);
      }
    }
  };
  box.oninput = ev => {
    const t = ev.target;
    if (t && t.id === 'tr-q') {
      trState.exQ = t.value;
      clearTimeout(trState.qTimer);
      trState.qTimer = setTimeout(() => {
        redraw().then(() => {
          const i = $('tr-q');
          if (i) {
            i.focus();
            i.setSelectionRange(i.value.length, i.value.length);
          }
        });
      }, 250);
    }
    if (t && t.id === 'tr-name') trState.exName = t.value;
    if (t && t.id === 'bv-note') trState.bvNote = t.value;
  };
  if (shared && $('bk-library-restore'))
    $('bk-library-restore').onclick = async () => {
      const button = $('bk-library-restore');
      button.disabled = true;
      try {
        const result = await api.libraryRestore();
        bmsg(result.restarting ? 'Restarting to restore the shared library.' : 'Cancelled.');
      } catch (e) {
        bmsg(e.message);
      } finally {
        button.disabled = false;
      }
    };
  if (sqlite && !shared && $('bk-native-save'))
    for (const [id, action] of [
      ['bk-native-save', 'nativeBackup'],
      ['bk-native-restore', 'nativeRestore']
    ])
      $(id).onclick = async () => {
        const b = $(id);
        b.disabled = true;
        bmsg('Copying and verifying. Large backups can take several minutes…');
        try {
          const result = await api[action]();
          bmsg(
            result.restarting
              ? 'Restarting to verify and restore the native backup.'
              : result.saved
                ? 'Native backup saved: ' + result.path
                : 'Cancelled.'
          );
        } catch (e) {
          bmsg('Could not complete native backup operation: ' + e.message);
        } finally {
          b.disabled = false;
        }
      };
  bindAutoBackup(box);
  if ($('ab-open')) $('ab-open').onclick = () => api.autoBackupOpen().catch(e => bmsg('Could not open the folder: ' + e.message));
  if ($('ab-now'))
    $('ab-now').onclick = async () => {
      $('ab-now').disabled = true;
      bmsg('Making a backup now…');
      try {
        const r = api.backupMake ? await api.backupMake({ kind: 'hand', note: trState.bvNote }) : await api.autoBackupNow();
        if (r && r.skipped) bmsg('Not now: ' + r.skipped + '.');
        else if (r && r.ok === false) bmsg('Could not make the backup: ' + r.error);
        else {
          trState.bvNote = '';
          bmsg('Backed up.');
          redraw();
        }
      } catch (e) {
        bmsg('Could not make the backup: ' + e.message);
        if ($('ab-now')) $('ab-now').disabled = false;
      }
    };
  $('bk-save').onclick = async () => {
    try {
      const res = await api.backupSave();
      bmsg(res && res.saved ? `Backup saved: ${res.path}` : 'Not saved.');
      if (res && res.saved && api.backupList) redraw();
    } catch (x) {
      bmsg('Could not save the backup: ' + x.message);
    }
  };
  if (!shared && $('bk-open'))
    $('bk-open').onclick = async () => {
      try {
        const res = await api.backupOpen();
        if (!res || res.canceled) {
          trState.bk = null;
          return redraw();
        }
        if (!res.ok) {
          trState.bk = null;
          trState.bkMsg = res.error;
          return redraw();
        }
        trState.bk = res;
        trState.bkMsg = '';
        redraw();
      } catch (x) {
        bmsg('Could not read the file: ' + x.message);
      }
    };
  if (bk) {
    $('bk-cancel').onclick = async () => {
      await api.backupCancel();
      trState.bk = null;
      redraw();
    };
    $('bk-apply').onclick = async () => {
      const chosenBk = trState.bk;
      if (
        !(await Dialog.confirm(
          'Replace everything you have now with this backup? What you have now is first saved as a backup “Before a restore”.',
          { ok: 'Replace with backup', danger: true }
        ))
      )
        return;
      if (trState.bk !== chosenBk) return; // (the backup was cancelled or another one chosen meanwhile)
      try {
        if (!(await safety('Before a restore'))) return;
        const result = await api.backupRestore();
        trState.bk = null;
        bmsg(result?.restarting ? 'Restarting to verify and restore the backup.' : 'The backup is restored.');
      } catch (x) {
        bmsg('Could not restore the backup: ' + x.message);
      }
    };
  }
  box.onchange = ev => {
    const t = ev.target,
      ds = (t && t.dataset) || {};
    if (ds.dall) {
      const e = ds.dall;
      (deps[e] || [])
        .filter(d => !d.required)
        .forEach(d => {
          if (t.checked) trState.skip.delete(e + ':' + d.id);
          else trState.skip.add(e + ':' + d.id);
        });
      return redraw();
    }
    if (ds.dep) {
      if (t.checked) trState.skip.delete(ds.dep);
      else trState.skip.add(ds.dep);
      return redraw();
    }
    if (ds.all) {
      const e = ds.all;
      trState.picks[e] = new Set(t.checked ? lists[e].map(r => r.id) : []);
      return redraw();
    }
    if (ds.item) {
      const i = ds.item.indexOf(':'),
        e = ds.item.slice(0, i),
        id = ds.item.slice(i + 1);
      if (t.checked) sel(e).add(id);
      else sel(e).delete(id);
      trState.msg = '';
      trState.exName = '';
      // what the ticked item uses, in words, next to it
      if (t.checked && api.exportDeps && !trState.uses[ds.item])
        Promise.resolve(api.exportDeps({ [e]: [id] }))
          .then(dd => {
            const words = ORDER_DEPS.filter(x => dd && dd[x] && dd[x].length)
              .map(x => dd[x].map(d => labelOf(x, d.id)).filter(n => n !== '(missing)'))
              .flat();
            trState.uses[ds.item] = words.length
              ? 'uses ' + words.slice(0, 3).join(', ') + (words.length > 3 ? ` +${words.length - 3}` : '')
              : '';
            redraw();
          })
          .catch(() => {});
      return redraw();
    }
  };
  if (typeof box.addEventListener === 'function') {
    // a <details> that is opened or closed is remembered, so ticking a box does not close it
    if (box._trToggle) box.removeEventListener('toggle', box._trToggle, true);
    box._trToggle = ev => {
      const d = ev.target;
      if (d && d.dataset && d.dataset.key) {
        if (d.open) trState.open.add(d.dataset.key);
        else trState.open.delete(d.dataset.key);
      }
    };
    box.addEventListener('toggle', box._trToggle, true);
  }
  if (sharedStatus?.restoreRecovery?.held) {
    const notice = document.createElement('p');
    notice.className = 'muted';
    notice.setAttribute('role', 'status');
    notice.textContent =
      'A restore was held for reconciliation. Current library remains in use. Exact request and safety copies: ' +
      sharedStatus.restoreRecovery.folder;
    box.prepend(notice);
  }
  if ($('tr-all'))
    $('tr-all').onclick = () => {
      shown.forEach(({ e, r }) => sel(e).add(r.id));
      trState.exName = '';
      redraw();
    };
  $('tr-none').onclick = () => {
    trState.picks = {};
    trState.msg = '';
    trState.exName = '';
    redraw();
  };
  $('tr-export').onclick = async () => {
    const extras = {};
    Object.entries(deps).forEach(([e, list]) => {
      const ids = list.filter(d => d.required || !trState.skip.has(e + ':' + d.id)).map(d => d.id);
      if (ids.length) extras[e] = ids;
    });
    try {
      const res = await api.exportData(chosen, extras, ($('tr-name') && $('tr-name').value) || fileName);
      msg(res && res.saved ? `Saved ${Object.values(res.counts || {}).reduce((a, b) => a + b, 0)} items: ${res.path}` : 'Not saved.');
    } catch (x) {
      msg('Could not export: ' + x.message);
    }
  };
  $('tr-open').onclick = async () => {
    try {
      const res = await api.importOpen();
      trState.choices = {};
      if (!res || res.canceled) {
        trState.pending = null;
        return redraw();
      }
      if (!res.ok) {
        trState.pending = null;
        trState.msg = res.error;
        return redraw();
      }
      trState.pending = res;
      trState.msg = '';
      redraw();
    } catch (x) {
      msg('Could not read the file: ' + x.message);
    }
  };
  if (pending) {
    $('tr-cancel').onclick = async () => {
      await api.importCancel();
      trState.pending = null;
      trState.choices = {};
      redraw();
    };
    $('tr-apply').onclick = async () => {
      try {
        const choices = {};
        (items || []).forEach(m => (choices[m.e + ':' + m.id] = choiceOf(m)));
        if (items && !(await safety('Before an import'))) return;
        const counts = await api.importApply(items ? choices : undefined);
        const replaced = counts._replaced || 0,
          skipped = counts._skipped || 0;
        delete counts._replaced;
        delete counts._skipped;
        trState.pending = null;
        trState.choices = {};
        const added = Object.entries(counts).map(([e, n]) => `${n} ${trKind(e, n)}`);
        trState.msg =
          (added.length ? 'Added ' + added.join(', ') : 'Nothing added') +
          (replaced ? `, replaced ${replaced}` : '') +
          (skipped ? `, skipped ${skipped}` : '') +
          '.';
        redraw();
      } catch (x) {
        msg('Could not import: ' + x.message);
      }
    };
  }
  // the backups that do not say what they hold yet are read, one at a time (once per run of the app)
  if (api.backupSummary) {
    const todo = blist.filter(b => !b.counts && !trState.sums[b.id]).slice(0, 6);
    if (todo.length)
      (async () => {
        for (const b of todo) trState.sums[b.id] = await api.backupSummary(b.id).catch(x => ({ error: x.message }));
        if (box.isConnected !== false && state.tab === 'settings') redraw();
      })();
  }
}
if (typeof module !== 'undefined') module.exports = { bvHealth, bvLost, bvWhen, bvHolds, trFileName, bvRestoreHtml };
