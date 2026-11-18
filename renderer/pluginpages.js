async function renderPluginPages(box) {
  const D = PluginDisplay,
    C = PluginDisplayClient;
  await C.refresh();
  if (!box.isConnected) return;
  const entries = C.catalog().flatMap(p => [
    ...p.display.pages.map(d => ({ p, d, kind: 'pages' })),
    ...p.display.tools.map(d => ({ p, d, kind: 'tools' }))
  ]);
  let selected = entries[0],
    values = {},
    result = null,
    pending = false,
    revision = 0;
  const readFields = () =>
    Object.fromEntries(
      (selected?.d.settings || []).map(f => {
        const el = box.querySelector(`[data-plugin-setting="${f.id}"]`);
        return [
          f.id,
          f.type === 'boolean' ? el.checked : f.type === 'number' ? (el.value.trim() === '' ? null : Number(el.value)) : el.value
        ];
      })
    );
  const req = () => ({
    key: JSON.stringify([selected.p.id, selected.d.id, values]),
    kind: selected.kind,
    plugin: selected.p.id,
    item: selected.d.id,
    settings: values,
    lane: null
  });
  const S = () =>
    typeof live !== 'undefined' && live?.alive && live?.pluginDisplayState ? live.pluginDisplayState() : WidgetPreview.state({});
  const show = () => {
    // (2.4.0) the pages and tools of the plugins in a side list (as the side lists of the app) with the open one beside it;
    // without any, one calm box that says what they are and opens App Settings › Plugins (the words about them are in the note above)
    box.innerHTML = entries.length
      ? `<div class="plugin-pages pd-workspace"><nav class="pd-list" aria-label="Plugin pages">${entries
          .map(
            (x, i) =>
              `<button type="button" class="pd-item${x === selected ? ' on' : ''}" aria-pressed="${x === selected}" data-page="${i}"><span class="pd-ico">${typeof Icons !== 'undefined' ? Icons.svg(x.kind === 'tools' ? 'bolt' : 'screen', { size: 16, stroke: 1.8 }) : ''}</span><span class="pd-label">${D.esc(x.d.label)}<small>${D.esc(x.p.name)} · ${x.kind === 'tools' ? 'Tool' : 'Page'}</small></span></button>`
          )
          .join(
            ''
          )}</nav><section class="card pd-panel">${`<h3>${D.esc(selected.d.label)}</h3><p>${D.esc(selected.d.description)}</p><p class="muted" data-page-runtime>${D.esc(selected.p.name)} · ${D.esc(selected.p.state)}${S().preview ? ' · Sample race data' : ''}</p><div class="formgrid">${selected.d.settings.map(f => PluginsPage.field(f, values[f.id] ?? f.default, false)).join('')}</div><div class="row">${selected.kind === 'pages' && selected.d.settings.length ? '<button class="btn" data-refresh>Apply inputs</button>' : ''}${selected.kind === 'tools' ? '<button class="btn primary" data-run>Run tool</button>' : ''}</div><p data-page-message role="status"></p><div class="pd-page-output" aria-live="polite"></div>`}</section></div>`
      : `<div class="plugin-pages lempty pd-empty"><span class="pd-emptyico">${typeof Icons !== 'undefined' ? Icons.svg('layers', { size: 26, stroke: 1.6 }) : ''}</span><h3>No plugin pages installed</h3><p class="muted">Install a code plugin that contributes pages or tools under App Settings → Plugins. They show up here.</p><button type="button" class="btn primary" data-open-plugins>Open App Settings › Plugins</button></div>`;
    result = null;
    revision++;
  };
  function demand() {
    if (!box.isConnected) {
      C.setPage(null);
      return;
    }
    if (selected?.kind === 'pages') C.read(req(), S());
  }
  function paint() {
    if (!box.isConnected) return;
    const status = box.querySelector('[data-page-runtime]');
    if (status && selected)
      status.textContent =
        selected.p.name +
        ' / ' +
        (C.catalog().find(p => p.id === selected.p.id)?.state || 'Missing') +
        (S().preview ? ' / Sample race data' : '');
    const action = box.querySelector('[data-run]'),
      s = S();
    if (action) {
      action.disabled = pending || (!s.preview && ['countdown', 'running', 'paused', 'between', 'review'].includes(s.phase));
      action.textContent = pending ? 'Running tool…' : 'Run tool';
    }
    const el = box.querySelector('.pd-page-output');
    if (!el) return;
    const entry = selected?.kind === 'pages' ? C.read(req(), S()) : result;
    let html = '';
    try {
      html = entry?.view
        ? D.html(entry.view)
        : D.html({
            kind: 'text',
            text: entry?.error || (selected?.kind === 'pages' ? 'Loading plugin page…' : 'Choose Run tool to start.'),
            tone: 'muted'
          });
    } catch {
      html = 'Invalid plugin display';
    }
    if (el.innerHTML !== html) el.innerHTML = html;
  }
  box.onclick = async ev => {
    const b = ev.target.closest('button');
    if (!b || b.disabled) return;
    if (b.hasAttribute('data-open-plugins')) {
      state.tab = 'settings';
      state.settingsSub = 'plugins';
      return render();
    }
    if (b.dataset.page !== undefined) {
      selected = entries[Number(b.dataset.page)];
      values = {};
      show();
      demand();
      paint();
      return;
    }
    if (b.hasAttribute('data-refresh')) {
      values = readFields();
      demand();
      paint();
      return;
    }
    if (b.hasAttribute('data-run')) {
      if (pending) return;
      pending = true;
      values = readFields();
      const active = selected,
        version = revision,
        request = req();
      b.disabled = true;
      const msg = box.querySelector('[data-page-message]');
      msg.textContent = 'Running tool…';
      result = { view: { kind: 'text', text: 'Waiting for the plugin to finish.', tone: 'muted' } };
      paint();
      try {
        const output = await api.pluginDisplayTool(request);
        if (selected !== active || revision !== version || !box.isConnected) return;
        result = { view: output };
        msg.textContent = 'Tool completed.';
      } catch (e) {
        if (selected !== active || revision !== version || !box.isConnected) return;
        result = { error: String(e.message || e) };
        msg.textContent = 'Tool did not complete.';
      } finally {
        pending = false;
        paint();
      }
    }
  };
  show();
  C.setPage({ demand, paint });
  demand();
  paint();
}
