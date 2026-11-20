// (2.4.0, SlotForgeRestyle.md "Profile Cards") Balance of Power and Time Tokens as named profiles, as the other race systems are: Race Setup > Balance of Power and
// Race Setup > Time Tokens list the Club default (the settings of before, used by a setup that chooses no profile) and the profiles as cards, with which race
// setups use them; a race setup chooses one (bopSystem, tokenSystem). A profile record holds the same keys as the settings (bopMode…, tokenIncrements…), so
// Bop.settingsOf and Tokens.settingsOf read either, and the editors of before (bopui.js, tokenui.js) edit whichever profile is open.
// Pure part (tested without a screen): KINDS, usedBy, copyOf, nameError. The page uses the app's globals.
(function (root) {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const BOP_KEYS = [
    'bopMode',
    'bopWho',
    'bopGrade',
    'bopPercent',
    'bopScale',
    'bopFull',
    'bopMeasure',
    'bopWindow',
    'bopMinLaps',
    'bopApply',
    'bopRemove',
    'bopLanes',
    'bopUse',
    'bopRate',
    'bopTank'
  ];
  const TOKEN_KEYS = ['tokenIncrements', 'tokenDecrements', 'tokenWarnSeconds', 'tokenWarnColor', 'tokenOutColor'];
  const KINDS = {
    bop: {
      entity: 'bopsystems',
      field: 'bopSystem',
      keys: BOP_KEYS,
      title: 'Balance of Power',
      one: 'Balance of Power profile',
      icon: 'balance',
      tone: '#a855f7'
    },
    tokens: {
      entity: 'tokensystems',
      field: 'tokenSystem',
      keys: TOKEN_KEYS,
      title: 'Time Tokens',
      one: 'Time Token profile',
      icon: 'tokens',
      tone: '#14b8a6'
    }
  };
  // the race setups that use a profile (id '' = the Club default): Balance of Power only counts when the setup has it on; Time Tokens only in a Time Token Session
  function usedBy(kind, setups, id, ids = []) {
    const K = KINDS[kind],
      known = new Set(ids);
    return (setups || [])
      .filter(s =>
        kind === 'bop'
          ? s && s.bop === 'on' && ['race', 'heats', 'endurance'].includes(s.sessionType || 'race')
          : s && s.sessionType === 'tokens'
      )
      .filter(s => {
        const own = s[K.field] && known.has(s[K.field]) ? s[K.field] : ''; // (a profile that is gone: the Club default)
        return own === (id || '');
      })
      .map(s => s.name || 'Race setup');
  }
  // the settings of a profile (or of the settings): only its own keys
  function copyOf(kind, from) {
    const out = {};
    for (const k of KINDS[kind].keys) if (from && from[k] !== undefined) out[k] = JSON.parse(JSON.stringify(from[k]));
    return out;
  }
  function nameError(name, others = []) {
    const n = String(name || '').trim();
    if (!n) return 'Give the profile a name.';
    if (n.length > 60) return 'Use 60 letters or fewer.';
    if (/^club default$/i.test(n)) return 'That name is kept for the Club default.';
    if (
      others.some(
        o =>
          String(o || '')
            .trim()
            .toLowerCase() === n.toLowerCase()
      )
    )
      return 'Another profile has that name.';
    return '';
  }

  // ---- which profile the editor of a kind is editing: null = the Club default (the settings) ----
  const editing = { bop: null, tokens: null };
  const source = kind => editing[kind] || (typeof state !== 'undefined' ? state.settings : {});
  async function save(kind, patch) {
    const rec = editing[kind];
    if (!rec) {
      state.settings = await api.setSettings(patch);
      return state.settings;
    }
    await api.update(KINDS[kind].entity, rec.id, patch);
    Object.assign(rec, patch);
    return rec;
  }
  const eyebrow = (kind, fallback) =>
    editing[kind] ? `${KINDS[kind].one} · ${editing[kind].name || 'Profile'}` : `Club default · ${fallback}`;

  // ---- the page: the Club default and the profiles as cards ----
  async function render(kind, box, note = '') {
    const K = KINDS[kind];
    const [list, setups] = await Promise.all([api.list(K.entity).catch(() => []), api.list('racesetups').catch(() => [])]);
    if (box.isConnected === false) return;
    const ids = list.map(r => r.id);
    const describe = src =>
      kind === 'bop'
        ? Object.values(BopSettings.describe(Bop.settingsOf(src)).rail || {})
        : Object.values(TokenSettings.describe(Tokens.settingsOf(src)).rail || {});
    const titles =
      kind === 'bop'
        ? ['Who decides', 'How much', 'What changes', 'Suggest and Automatic']
        : ['Time to add', 'Time to take off', 'Warning and colours'];
    const pills = src => {
      if (kind === 'bop') {
        const s = Bop.settingsOf(src);
        return [
          { manual: 'Manual', suggest: 'Suggest', auto: 'Automatic' }[s.mode] || s.mode,
          s.percent + '%',
          { both: 'Both', hinder: 'Hinder only', help: 'Help only' }[s.who] || s.who
        ];
      }
      return TokenSettings.describe(Tokens.settingsOf(src)).pills || [];
    };
    const ico = n => (typeof Icons !== 'undefined' && Icons.has && Icons.has(n) ? Icons.svg(n, { size: 20, stroke: 1.8 }) : '');
    const card = (rec, src) => {
      const used = usedBy(kind, setups, rec ? rec.id : '', ids),
        rows = describe(src);
      return `<article class="pf-card${rec ? '' : ' pf-def'}" data-pf="${rec ? esc(rec.id) : ''}" style="--pf:${K.tone}"><div class="pf-top"><span class="pf-ic">${ico(K.icon)}</span><div><span class="pf-k">${esc(K.title)}</span><h3>${esc(rec ? rec.name || 'Profile' : 'Club default')}</h3></div>${
        rec ? '' : '<span class="pf-badge" title="Used by a race setup that chooses no profile">Club default</span>'
      }</div><div class="pf-chips">${pills(src)
        .filter(Boolean)
        .map(p => `<span>${esc(p)}</span>`)
        .join('')}</div><div class="pf-rows">${rows
        .slice(0, titles.length)
        .map((r, i) => `<div><b>${esc(titles[i] || '')}</b><span>${esc((r && (r.rail || r.row)) || '')}</span></div>`)
        .join('')}</div><div class="pf-used">${
        used.length
          ? `Used by ${used
              .slice(0, 3)
              .map(n => `<b>${esc(n)}</b>`)
              .join(', ')}${used.length > 3 ? ` +${used.length - 3}` : ''}`
          : rec
            ? 'Not used by a race setup yet'
            : 'Used by setups that choose no profile'
      }</div><div class="pf-foot"><button type="button" class="btn sm" data-pf-edit>Edit</button><button type="button" class="btn sm" data-pf-copy>Copy</button>${
        rec
          ? `<button type="button" class="btn sm ghost" data-pf-rename>Rename</button><button type="button" class="btn sm ghost pf-del" data-pf-del${used.length ? ` title="Used by ${esc(used.join(', '))}"` : ''}>Delete</button>`
          : ''
      }</div></article>`;
    };
    const explainer =
      kind === 'bop'
        ? 'A race setup with Balance of Power on chooses one; the Club default is used when it chooses none.'
        : 'A Time Token Session chooses one; the Club default is used when it chooses none.';
    box.innerHTML = `<div class="pf"><div class="pf-bar"><button type="button" class="btn primary" data-pf-new>＋ New ${esc(K.one)}</button><span>${esc(explainer)}</span></div>${note ? `<p class="pf-note" role="status">${esc(note)}</p>` : ''}<div class="pf-grid">${card(null, state.settings)}${list
      .map(r => card(r, r))
      .join('')}</div><div class="pf-ed" hidden></div></div>`;
    box.onclick = async ev => {
      const b = ev.target.closest && ev.target.closest('button');
      if (!b || !box.contains(b)) return;
      const c = b.closest('[data-pf]'),
        rec = c && c.dataset.pf ? list.find(r => r.id === c.dataset.pf) : null;
      const names = list.map(r => r.name);
      if (b.hasAttribute('data-pf-new') || b.hasAttribute('data-pf-copy')) {
        const from = b.hasAttribute('data-pf-copy') ? (rec ? rec : state.settings) : null;
        const name = await ask(
          b.hasAttribute('data-pf-copy') ? `Copy of ${rec ? rec.name : 'Club default'}` : '',
          names,
          b.hasAttribute('data-pf-copy') ? 'Copy the profile' : 'New ' + K.one
        );
        if (name === null) return;
        const made = await api.add(K.entity, {
          name,
          ...copyOf(kind, from || (kind === 'bop' ? Bop.standardSettings() : TokenSettings.settings(Tokens.settingsOf({}))))
        });
        editing[kind] = made;
        await render(kind, box, `${name} is made. A race setup chooses it under ${kind === 'bop' ? 'Rules and Systems' : 'its session'}.`);
        return open(kind, box);
      }
      if (b.hasAttribute('data-pf-rename') && rec) {
        const name = await ask(
          rec.name,
          names.filter(n => n !== rec.name),
          'Rename the profile'
        );
        if (name === null) return;
        await api.update(K.entity, rec.id, { name });
        return render(kind, box);
      }
      if (b.hasAttribute('data-pf-del') && rec) {
        const used = usedBy(kind, setups, rec.id, ids);
        if (used.length)
          return Dialog.alert(
            `${rec.name} is used by ${used.join(', ')}.\n\nChoose another profile in ${used.length === 1 ? 'that race setup' : 'those race setups'} first.`
          );
        if (!(await Dialog.confirm(`Delete the profile "${rec.name}"?\n\nThis can't be undone.`, { ok: 'Delete', danger: true }))) return;
        await api.remove(K.entity, rec.id);
        return render(kind, box, `${rec.name} is deleted.`);
      }
      if (b.hasAttribute('data-pf-edit')) {
        editing[kind] = rec;
        return open(kind, box);
      }
    };
  }
  // the editor of before, for the profile that is open, as its window; when it is closed the cards are drawn again
  async function open(kind, box) {
    const host = box.querySelector('.pf-ed');
    if (!host) return;
    host.hidden = false;
    host.innerHTML = '';
    if (kind === 'bop') await renderBopSettings(host);
    else await renderTokenSettings(host);
    let tries = 0;
    const pop = () => {
      const go = host.querySelector('.sy-lopen');
      if (go) {
        go.click();
        // (the editor draws itself again as it saves: the whole editor area is watched; closed = no window of it is open any more)
        if (typeof MutationObserver !== 'undefined') {
          const mo = new MutationObserver(() => {
            const form = host.querySelector('.rsform');
            if (!form || (form.hidden && !host.querySelector('.rsform.sy-pop'))) {
              mo.disconnect();
              editing[kind] = null;
              if (box.isConnected !== false) render(kind, box);
            }
          });
          mo.observe(host, { attributes: true, attributeFilter: ['hidden', 'class'], subtree: true, childList: true });
        }
      } else if (tries++ < 20) setTimeout(pop, 25);
    };
    pop();
  }
  // a name, asked in the app's own window: the name, or null
  function ask(value, others, title) {
    return new Promise(resolve => {
      const d = document.createElement('dialog');
      d.className = 'appdlg pf-ask';
      d.innerHTML = `<h3>${esc(title)}</h3><label class="pf-f">Name<input type="text" maxlength="60" value="${esc(value)}" autocomplete="off"></label><p class="pf-err" role="alert"></p><div class="row appdlg-buttons"><button type="button" class="btn" data-no>Cancel</button><button type="button" class="btn primary" data-yes>Save</button></div>`;
      document.body.appendChild(d);
      const input = d.querySelector('input'),
        err = d.querySelector('.pf-err');
      const done = v => {
        d.close();
        d.remove();
        resolve(v);
      };
      const yes = () => {
        const e = nameError(input.value, others);
        if (e) return (err.textContent = e);
        done(input.value.trim());
      };
      d.querySelector('[data-yes]').onclick = yes;
      d.querySelector('[data-no]').onclick = () => done(null);
      input.onkeydown = ev => ev.key === 'Enter' && yes();
      d.addEventListener('cancel', ev => {
        ev.preventDefault();
        done(null);
      });
      d.showModal();
      input.focus();
      input.select();
    });
  }

  const api_ = { KINDS, BOP_KEYS, TOKEN_KEYS, usedBy, copyOf, nameError, editing, source, save, eyebrow, render, open };
  root.Profiles = api_;
  if (typeof module !== 'undefined') module.exports = api_;
})(typeof window !== 'undefined' ? window : globalThis);
