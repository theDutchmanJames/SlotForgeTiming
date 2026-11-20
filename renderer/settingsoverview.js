// App Settings › Overview (2.4.0, SlotForgeRestyle.md "Settings Hub"): the first page of App Settings. The pages grouped by task (Look and feel, Race
// night, Your data, This computer), a tile for each with how it stands in a short line, and a dot when it is set (green) or asks for a look (amber); on
// top a band that says whether race night is ready and what to look at. A tile opens its page. The words are made by tiles(), a pure function (tested).
const SettingsOverview = (() => {
  const h = s =>
    String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  const GROUPS = [
    ['Look and feel', 'How the app looks on this computer', ['display', 'theme', 'home']],
    ['Race night', 'What you set up before the first race', ['hardware', 'director', 'sharing', 'calculations']],
    ['Your data', 'Where everything is kept, and copies of it', ['transfer', 'paddock', 'packs', 'plugins']],
    ['This computer', 'How the app runs here', ['performance', 'updates']]
  ];
  const ICON = {
    display: 'screen',
    theme: 'paint',
    home: 'home',
    hardware: 'timing',
    director: 'director',
    sharing: 'parallel',
    calculations: 'sliders',
    transfer: 'database',
    paddock: 'garage',
    packs: 'layers',
    plugins: 'bolt',
    performance: 'gauge',
    updates: 'bell'
  };
  const NAME = {
    display: 'Display and units',
    theme: 'App Theme',
    home: 'Home and club',
    hardware: 'Timing Hardware',
    director: 'Race Director',
    sharing: 'Share the race',
    calculations: 'Calculations',
    transfer: 'Backups and storage',
    paddock: 'Paddock',
    packs: 'Content Packs',
    plugins: 'Plugins',
    performance: 'Performance',
    updates: 'Updates and help'
  };
  const cap = t => (t ? t[0].toUpperCase() + t.slice(1) : '');
  const plural = (n, one, more) => `${n} ${n === 1 ? one : more}`;
  // what every tile says. S: the settings; x (all may be missing): { hw: { name, id, device }, backups: (api.backupList), library, paddock, plugins,
  // packs, version, lib: { uiScale, depth, speed, dist } (the words of the levels) } -> { page: { line, tone: 'ok' | 'warn' | '', note } }
  function tiles(S, x = {}) {
    S = S || {};
    const t = {};
    const L = x.lib || {};
    t.display = {
      line: [L.uiScale || '', L.depth || '', L.speed || '', L.dist || ''].filter(Boolean).join(' · ') || 'size, depth and units'
    };
    t.theme = { line: cap(String(S.theme || 'dark').replace(/-/g, ' ')) + (S.accent ? ' · own accent' : '') };
    t.home = {
      line: [S.appName ? 'own name' : 'the standard name', S.homeHeader ? 'header picture' : '', S.clubLogo ? 'club logo' : '']
        .filter(Boolean)
        .join(' · ')
    };
    const hw = x.hw || {};
    t.hardware =
      !hw.id || hw.id === 'none'
        ? { line: 'None: keys or simulated cars', tone: 'warn', note: 'No timing hardware chosen' }
        : { line: hw.name + (hw.device ? ' · remembered' : ''), tone: 'ok' };
    t.director = {
      line: `${x.cards === false ? 'Folders' : 'Lane cards'} · ${S.netPassword ? 'phones with a password' : 'this computer only'}`,
      tone: S.netPassword ? 'ok' : ''
    };
    t.sharing = S.netOn ? { line: `On · port ${S.netPort || 8787}`, tone: 'ok' } : { line: 'Off: nothing follows the race' };
    t.calculations = { line: 'Pace and what every system adds' };
    const b = x.backups;
    if (b && Array.isArray(b.list)) {
      const last = b.list[0],
        st = b.status || {};
      const late = st.on && st.next && Date.parse(st.next) < (x.now || Date.now()) - 864e5;
      const bad = st.ok === false;
      t.transfer = {
        line:
          (last
            ? 'Backed up ' +
              String(x.when ? x.when(last.date) : last.date)
                .replace(/^Today/, 'today')
                .replace(/^Yesterday/, 'yesterday')
            : 'No backup yet') + (x.storage ? ' · ' + x.storage : ''),
        tone: bad || !last || late || b.sameDrive ? 'warn' : 'ok',
        note: bad
          ? 'The last backup failed'
          : !last
            ? 'No backup yet'
            : late
              ? 'The automatic backup is late'
              : b.sameDrive
                ? 'The backups are on the same drive'
                : ''
      };
    } else t.transfer = { line: 'Backups, export, import' + (x.storage ? ' · ' + x.storage : '') };
    t.paddock = x.library
      ? { line: 'Shared library · in use', tone: 'ok' }
      : x.paddock && x.paddock.connection
        ? { line: 'Connected to ' + (x.paddock.connection.name || 'Paddock'), tone: 'ok' }
        : { line: 'Not connected' };
    t.packs = {
      line: Number.isFinite(x.packs)
        ? x.packs
          ? plural(x.packs, 'pack', 'packs') + ' installed'
          : 'None installed'
        : 'Collections to share'
    };
    t.plugins = {
      line: Number.isFinite(x.plugins)
        ? x.plugins
          ? plural(x.plugins, 'plugin', 'plugins') + ' installed'
          : 'None installed'
        : 'Extra features'
    };
    t.performance = {
      line: [S.perfLine ? 'line on the race screen' : 'quiet', S.layers === false ? 'one layer' : ''].filter(Boolean).join(' · ')
    };
    t.updates = { line: x.version ? 'Version ' + x.version : 'New versions and help' };
    return t;
  }
  // the band on top: ready for race night, and what to look at
  function band(t) {
    const ready = t.hardware.tone === 'ok';
    const look = Object.keys(t).filter(k => t[k].tone === 'warn');
    return { ready, look: look.map(k => t[k].note || NAME[k]) };
  }
  function html(t) {
    const ico = n => (typeof Icons !== 'undefined' ? Icons.svg(n, { size: 20, stroke: 1.7 }) : '');
    const b = band(t);
    return `<div class="so"><div class="so-hd"><h2>App Settings</h2><p>Grouped by what you are doing. Every part says how it stands; a dot asks for a look.</p></div>
      <div class="so-band"><span class="so-pill" style="--c:${b.ready ? '#3ecf8e' : '#f2b705'}"><i></i><b>${b.ready ? 'Ready for race night' : 'Not ready for race night'}</b>${b.ready ? ' · the timing hardware is set' : ' · choose the timing hardware'}</span>${
        b.look.length
          ? `<span class="so-pill" style="--c:#f2b705"><i></i><b>${plural(b.look.length, 'thing', 'things')} to look at</b> · ${h(b.look.join(' · ').toLowerCase())}</span>`
          : ''
      }</div>
      ${GROUPS.map(
        ([g, sub, ids]) =>
          `<section class="so-grp"><div class="so-gh"><h3>${h(g)}</h3><small>${h(sub)}</small></div><div class="so-tiles">${ids
            .map(id => {
              const x = t[id] || { line: '' };
              return `<button type="button" class="so-t" data-so-go="${id}"><span class="so-ic">${ico(ICON[id])}</span><b>${h(NAME[id])}</b><small>${h(x.line)}</small>${x.tone ? `<i class="so-dot ${x.tone}" aria-label="${x.tone === 'ok' ? 'Set' : 'Look at it'}"></i>` : ''}${x.tone === 'warn' && x.note ? `<span class="so-note">⚠ ${h(x.note)}</span>` : ''}</button>`;
            })
            .join('')}</div></section>`
      ).join('')}</div>`;
  }
  async function gather() {
    const S = (typeof state !== 'undefined' && state.settings) || {};
    const safe = async (f, d = null) => {
      try {
        return await f();
      } catch {
        return d;
      }
    };
    const id = typeof Hardware !== 'undefined' ? Hardware.timingChosen(S) : '';
    const hwName =
      typeof Hardware !== 'undefined' ? ((Hardware.TIMING.find(x => x[0] === id) || [])[1] || '').replace(/\s*\(.*\)$/, '') : '';
    const level = (L, v) => (L ? ((L.LEVELS || []).find(x => x[0] === v) || [])[1] || '' : '');
    const store = api.storageStatus ? await safe(() => api.storageStatus()) : null;
    const lib = await safe(() => (api.libraryStatus ? api.libraryStatus() : null));
    const plugins = await safe(() => (api.pluginsList ? api.pluginsList() : null));
    const packs = await safe(() => (api.packsList ? api.packsList() : null));
    return {
      hw: { id, name: hwName, device: !!(S.tmDevice || S.abDevice || S.dsPort) },
      cards: typeof LaneCards === 'undefined' || LaneCards.on(S),
      backups: await safe(() => (api.backupList ? api.backupList() : null)),
      when: typeof bvWhen === 'function' ? bvWhen : null,
      storage: store ? (store.backend === 'sqlite' ? 'SQLite' : 'JSON') : '',
      library: !!(lib && lib.available),
      paddock: await safe(() => (api.paddockStatus ? api.paddockStatus() : null)),
      plugins: plugins && Array.isArray(plugins.plugins) ? plugins.plugins.length : NaN,
      packs: packs && Array.isArray(packs.packs) ? packs.packs.length : NaN,
      version: (plugins && plugins.appVersion) || (packs && packs.appVersion) || '',
      lib: {
        uiScale: typeof UiScale !== 'undefined' ? UiScale.levelOf(S.uiScale) + '%' : '',
        depth: typeof Depth !== 'undefined' ? String(level(Depth, Depth.levelOf(S.depth))).replace(/\s*\(.*\)$/, '') : '',
        speed: typeof Speed !== 'undefined' ? Speed.unitName(Speed.unitOf(S)) : '',
        dist: typeof Speed !== 'undefined' ? (Speed.distUnitOf(S) === 'ft' ? 'feet' : 'metres') : ''
      }
    };
  }
  async function render(box) {
    if (!box) return;
    const S = (typeof state !== 'undefined' && state.settings) || {};
    box.innerHTML = html(tiles(S, {}));
    const ticket = (render.n = (render.n || 0) + 1);
    box.onclick = ev => {
      const b = ev.target && ev.target.closest ? ev.target.closest('[data-so-go]') : null;
      if (!b) return;
      state.settingsSub = b.dataset.soGo;
      renderSettings();
    };
    const x = await gather();
    if (ticket !== render.n || (typeof state !== 'undefined' && state.settingsSub !== 'overview') || box.isConnected === false) return;
    box.innerHTML = html(tiles(S, x));
  }
  return { tiles, band, html, render, GROUPS, NAME };
})();
if (typeof module !== 'undefined') module.exports = SettingsOverview;
