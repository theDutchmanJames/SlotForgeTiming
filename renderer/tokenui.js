// Time Tokens on screen: the settings page (Race Setup > Time Tokens) and the controls for the lanes (race screen).
// The logic is in tokens.js; this file only draws and passes on what is pressed.
// Board 12 (1.80.0) changes the settings page only. The same five settings and defaults are kept.
const TokenSettings = (() => {
  const rules = () => typeof module !== 'undefined' && module.exports ? require('./tokens.js') : Tokens;
  const settings = s => ({ tokenIncrements: s.increments.join(', '), tokenDecrements: s.decrements.join(', '), tokenWarnSeconds: s.warnSeconds, tokenWarnColor: s.warnColor, tokenOutColor: s.outColor });
  const standard = () => settings(rules().settingsOf({}));
  function minutes(values, required) {
    if (values.length > 8) return { error: 'Choose up to 8 buttons.' };
    const list = values.map(x => String(x).trim()), nums = list.map(x => Number(x.replace(',', '.')));
    if (required && !list.length) return { error: 'Keep at least one add-time button.' };
    if (list.some((x, i) => !x || !Number.isFinite(nums[i]) || nums[i] <= 0 || nums[i] > 1440)) return { error: 'Use a number above 0 and up to 1,440 minutes.' };
    if (new Set(nums).size !== nums.length) return { error: 'Choose a different number of minutes for each button.' };
    return { list: nums };
  }
  function describe(s) {
    const R = rules(), d = R.settingsOf({});
    const count = (n, name) => `${n} ${name} button${n === 1 ? '' : 's'}`;
    const range = a => a.length ? `${a.length} button${a.length === 1 ? '' : 's'} · ${Math.min(...a)}${a.length > 1 ? ' to ' + Math.max(...a) : ''} min` : 'No take-off buttons';
    const entry = (text, changed) => ({ rail: text, row: text, state: changed ? 'ok' : 'plain' });
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    return { pills: [count(s.increments.length, 'add'), s.decrements.length ? count(s.decrements.length, 'take-off') : 'No take-off buttons', s.warnSeconds ? `Warning · ${s.warnSeconds} s` : 'Warning off'],
      say: `Sell track time per lane with ${count(s.increments.length, 'add-time')}${s.decrements.length ? ' and ' + count(s.decrements.length, 'take-off') : ' and no take-off buttons'}. ${s.warnSeconds ? `The Token Clock warns during the last ${s.warnSeconds} seconds.` : 'There is no early warning.'} When time is up, the lane’s timing widgets turn the time’s-up colour.`,
      rail: { add: entry(range(s.increments), !same(s.increments, d.increments)), take: entry(range(s.decrements), !same(s.decrements, d.decrements)),
        warning: entry(s.warnSeconds ? `${s.warnSeconds} s · clock colours` : 'Warning off · end colour', s.warnSeconds !== d.warnSeconds || s.warnColor !== d.warnColor || s.outColor !== d.outColor) },
      running: R.clockText(Math.max(754, s.warnSeconds + 75) * 1000), warning: s.warnSeconds ? R.clockText(s.warnSeconds * .75 * 1000) : '—:—' };
  }
  return { settings, standard, minutes, describe };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = { TokenSettings };
const TOKEN_DEFAULT_SETTINGS = TokenSettings.standard();
let tokenSettingsTail = Promise.resolve();

// ---- the settings page ----
async function renderTokenSettings(box) {
  const page = { s: Tokens.settingsOf(state.settings), rail: 'add', open: new Set(['add', 'take', 'warning']), pending: 0, lastWarning: 60, errors: {} };
  if (page.s.warnSeconds) page.lastWarning = page.s.warnSeconds;
  box.tokenPage = page;
  const active = () => box.tokenPage === page && box.isConnected !== false && (typeof state.tab !== 'string' || state.tab === 'setup') && (typeof state.setupSub !== 'string' || state.setupSub === 'tokens');
  const el = id => document.getElementById(id), I = (n, size = 18) => Icons.svg(n, { size, stroke: 1.8 });
  const keyOf = kind => kind === 'add' ? 'increments' : 'decrements';
  const editor = kind => {
    const values = page.s[keyOf(kind)];
    return values.map((n, i) => `<span class="tk-minute"><input id="tk-${kind}-${i}" type="text" inputmode="decimal" autocomplete="off" value="${n}" aria-label="${kind === 'add' ? 'Add-time' : 'Take-off'} button ${i + 1}, minutes" aria-describedby="tk-${kind}-error"><span>min</span><button class="tk-remove" type="button" data-tk-remove="${kind}" data-index="${i}" aria-label="Remove ${n}-minute ${kind === 'add' ? 'add-time' : 'take-off'} button">${I('x', 14)}</button></span>`).join('')
      + (values.length < 8 ? `<button class="tk-add" type="button" id="tk-more-${kind}" data-tk-add="${kind}" aria-label="Add a ${kind === 'add' ? 'time-to-add' : 'time-to-take-off'} button">${I('plus')}</button>` : '');
  };
  const preview = (kind, s) => s[keyOf(kind)].map(n => `<span class="tk-sample">${esc(kind === 'add' ? Tokens.incLabel(n) : Tokens.decLabel(n))}</span>`).join('') || '<span class="muted">No minus buttons</span>';
  const amountBody = kind => `<div class="tk-section"><div class="tk-question"><span id="tk-${kind}-label">How many minutes can you ${kind === 'add' ? 'add' : 'take off'}?</span><small class="muted">${kind === 'take' ? 'Optional · ' : ''}Up to 8 buttons</small></div><div class="tk-minutes" id="tk-${kind}-editor" role="group" aria-labelledby="tk-${kind}-label">${editor(kind)}</div><input id="${kind === 'add' ? 'tk-inc' : 'tk-dec'}" value="${page.s[keyOf(kind)].join(', ')}" type="hidden"><p class="muted hint">${kind === 'add' ? 'One box makes one button. Decimals such as 7.5 minutes work too.' : 'Remove all the boxes if you do not need take-off buttons.'}</p><p class="error" id="tk-${kind}-error" role="alert" hidden></p><div><p class="tk-caption">On the race screen</p><div class="tk-samples${kind === 'take' ? ' tk-minus' : ''}" id="${kind === 'add' ? 'tk-preview' : 'tk-dpreview'}">${preview(kind, page.s)}</div></div>${kind === 'take' ? `<div class="tk-info">${I('info')}<span>Taking time off reduces the time bought too. Undo gives it back. Only a lane with time running can have time taken off.</span></div>` : ''}</div>`;
  const clock = (id, title, digits, note) => `<div class="tk-clock" id="tk-clock-${id}"><span class="tk-clock-title" id="tk-clock-${id}-title">${title}</span><strong id="tk-clock-${id}-digits">${digits}</strong><small id="tk-clock-${id}-note">${note}</small></div>`;
  const sections = [
    { id: 'add', title: 'Time to add', ask: 'The time you sell to a lane', icon: 'plus', body: amountBody('add') },
    { id: 'take', title: 'Time to take off', ask: 'For a mistake or a refund', icon: 'undo', body: amountBody('take') },
    { id: 'warning', title: 'Warning and colours', ask: 'See when time is running out', icon: 'clock', body: `<div class="tk-section"><div class="tk-warning-row"><button class="fu-sw" id="tk-warning-on" type="button" role="switch" aria-checked="${!!page.s.warnSeconds}"><span class="fu-tg" aria-hidden="true"></span><span class="fu-swt"><b>Warn before time is up</b></span></button><label class="inunit"><input id="tk-warn" type="number" min="0" max="3600" step="any" value="${page.s.warnSeconds}" aria-label="Seconds before the end"><span>seconds before the end</span></label></div><div class="tk-colours"><label class="tk-colour"><input type="color" id="tk-warncolor" value="${page.s.warnColor}" aria-label="Warning colour"><span>Warning colour<small>Token Clock only</small></span></label><label class="tk-colour"><input type="color" id="tk-outcolor" value="${page.s.outColor}" aria-label="Time's-up colour"><span>Time's-up colour<small>All timing widgets of the lane</small></span></label></div><div><p class="tk-caption">How a lane looks</p><div class="tk-clocks" id="tk-chips" aria-label="Token Clock colour previews">${clock('running', 'Running', '12:34', 'Usual widget colour')}${clock('warning', 'Almost up', '00:45', 'Last 60 seconds')}${clock('out', "Time's up", '00:00', 'Time has run out')}</div></div></div>` }
  ];
  box.innerHTML = RailForm.shell({ page: true, tag: 'div', formId: 'tk-form', cls: 'setupform ss-tok', eyebrow: 'Settings for every Time Token Session', tile: I('tokens', 26), name: '<h3 class="tk-title">Time Tokens</h3>', caption: 'Time Tokens', navLabel: 'The sections of Time Tokens', icon: I,
    usedHtml: '<div class="rsused"><span class="rsrl">To use it</span><span class="muted">Choose <b>Time Token Session</b> in a race setup. Open the session, then add time to each lane. These buttons also appear on the Tokens page on a phone or tablet.</span></div>',
    sections: sections.map(s => ({ ...s, domId: 'tk-section-' + s.id, open: true })),
    foot: `<span class="muted rsdef">Applies to all Time Token Sessions.</span><span id="tk-msg" role="status"></span><button class="btn" type="button" id="tk-retry" hidden>Retry saving</button><button class="btn" type="button" id="tk-reset">${I('undo')} Back to the standard settings</button>` });
  const status = (text, ok = true) => { el('rsready').textContent = text; el('rsready').className = 'rsready' + (ok ? ' ok' : ''); };
  const error = (kind, text = '', blocking = true) => { page.errors[kind] = blocking ? text : ''; el('tk-' + kind + '-error').textContent = text; el('tk-' + kind + '-error').hidden = !text; };
  const paint = (previewOnly = false) => {
    const s = page.s, words = TokenSettings.describe(s);
    el('rspills').innerHTML = words.pills.map((p, i) => `<span class="rspill${i ? '' : ' hi'}">${esc(p)}</span>`).join('');
    el('rssay').innerHTML = `<span class="rsic rssayic">${I('say', 20)}</span><div class="rssaytext"><span class="rseye">In plain words</span><p>${esc(words.say)}</p></div>`;
    RailForm.sync(el, words.rail, null, page.rail);
    ['add', 'take'].forEach(kind => { el(kind === 'add' ? 'tk-inc' : 'tk-dec').value = s[keyOf(kind)].join(', '); el(kind === 'add' ? 'tk-preview' : 'tk-dpreview').innerHTML = preview(kind, s); });
    el('tk-warning-on').setAttribute('aria-checked', String(!!s.warnSeconds)); el('tk-warning-on').classList.toggle('on', !!s.warnSeconds);
    if (!previewOnly) el('tk-warn').disabled = !s.warnSeconds;
    el('tk-clock-running-digits').textContent = words.running;
    el('tk-clock-warning-title').textContent = s.warnSeconds ? 'Almost up' : 'Warning off'; el('tk-clock-warning-digits').textContent = words.warning;
    el('tk-clock-warning-note').textContent = s.warnSeconds ? `Last ${s.warnSeconds} seconds` : 'No early colour change';
    el('tk-clock-warning').style.background = s.warnSeconds ? s.warnColor : ''; el('tk-clock-warning').style.color = s.warnSeconds ? Tokens.onColor(s.warnColor) : '';
    el('tk-clock-out').style.background = s.outColor; el('tk-clock-out').style.color = Tokens.onColor(s.outColor);
  };
  const save = () => {
    if (Object.values(page.errors).some(Boolean)) { status('Check the minutes', false); return Promise.resolve(false); }
    const patch = TokenSettings.settings(page.s); page.pending++; status('Saving...'); el('tk-retry').hidden = true;
    const job = tokenSettingsTail.then(async () => {
      let ok = false;
      try { state.settings = await api.setSettings(patch); ok = true; if (active()) { el('tk-msg').textContent = ''; el('tk-retry').hidden = true; } }
      catch (x) { if (active()) { el('tk-msg').textContent = 'Could not save: ' + (x.message || x); el('tk-retry').hidden = false; } }
      finally { page.pending--; if (active() && !page.pending) status(ok ? 'Saved as you change it' : 'Could not save', ok); }
      return ok;
    });
    tokenSettingsTail = job.then(() => {}); return job;
  };
  const read = kind => {
    const result = TokenSettings.minutes(page.s[keyOf(kind)].map((_, i) => el(`tk-${kind}-${i}`).value), kind === 'add');
    error(kind, result.error); if (result.error) return false;
    page.s[keyOf(kind)] = result.list; paint(); return true;
  };
  const bind = kind => page.s[keyOf(kind)].forEach((n, i) => {
    const input = el(`tk-${kind}-${i}`); input.value = String(n);
    input.oninput = () => read(kind);
    input.onchange = () => read(kind) ? save() : Promise.resolve(false);
  });
  const rebuild = kind => { el('tk-' + kind + '-editor').innerHTML = editor(kind); bind(kind); };
  ['add', 'take'].forEach(bind);
  // The hidden mirrors keep the original settings names and cleaning at the boundary.
  ['add', 'take'].forEach(kind => { el(kind === 'add' ? 'tk-inc' : 'tk-dec').onchange = ev => { page.s[keyOf(kind)] = kind === 'add' ? Tokens.parseIncrements(ev.target.value) : Tokens.parseDecrements(String(ev.target.value)); error(kind); rebuild(kind); paint(); return save(); }; });
  el('tk-warn').oninput = ev => { page.s.warnSeconds = Tokens.settingsOf({ tokenWarnSeconds: ev.target.value }).warnSeconds; if (page.s.warnSeconds) page.lastWarning = page.s.warnSeconds; paint(true); };
  el('tk-warn').onchange = ev => { el('tk-warn').oninput(ev); paint(); return save(); };
  ['warn', 'out'].forEach(kind => {
    const key = kind + 'Color';
    el('tk-' + kind + 'color').oninput = ev => { page.s[key] = Tokens.settingsOf({ ['token' + (kind === 'warn' ? 'Warn' : 'Out') + 'Color']: ev.target.value })[key]; paint(); };
    el('tk-' + kind + 'color').onchange = ev => { el('tk-' + kind + 'color').oninput(ev); return save(); };
  });
  el('tk-warning-on').onclick = () => { page.s.warnSeconds = page.s.warnSeconds ? 0 : page.lastWarning; el('tk-warn').value = page.s.warnSeconds || page.lastWarning; paint(); return save(); };
  el('tk-reset').onclick = async () => {
    page.s = Tokens.settingsOf(TOKEN_DEFAULT_SETTINGS); page.lastWarning = page.s.warnSeconds;
    ['add', 'take'].forEach(kind => { error(kind); rebuild(kind); });
    el('tk-warn').value = page.s.warnSeconds; el('tk-warncolor').value = page.s.warnColor; el('tk-outcolor').value = page.s.outColor; paint();
    if (await save() && active()) el('tk-msg').textContent = 'Back to the standard settings.';
  };
  el('tk-retry').onclick = save;
  box.onclick = ev => {
    const b = ev.target.closest && ev.target.closest('button'); if (!b) return;
    const d = b.dataset || {};
    if (d.rail && sections.some(s => s.id === d.rail)) { page.rail = d.rail; const sec = el('tk-section-' + d.rail); sec.open = true; paint(); if (sec.scrollIntoView) sec.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
    const kind = d.tkAdd || d.tkRemove;
    if (!['add', 'take'].includes(kind)) return;
    const values = page.s[keyOf(kind)];
    if (d.tkAdd) {
      if (!read(kind) || values.length >= 8) return;
      page.s[keyOf(kind)].push([1, 5, 10, 15, 30, 60, 90, 120, 180].find(n => !page.s[keyOf(kind)].includes(n)));
    } else {
      const index = Number(d.index); if (!Number.isInteger(index) || index < 0 || index >= values.length) return;
      if (kind === 'add' && values.length === 1) { error(kind, 'Keep at least one add-time button.', false); return; }
      values.splice(index, 1);
    }
    error(kind); rebuild(kind); paint();
    const length = page.s[keyOf(kind)].length, index = d.tkAdd ? length - 1 : Math.min(Number(d.index), length - 1);
    const focus = el(length ? `tk-${kind}-${index}` : 'tk-more-' + kind);
    if (focus && focus.focus) focus.focus({ preventScroll: true });
    return save();
  };
  sections.forEach(s => { el('tk-section-' + s.id).ontoggle = () => { if (el('tk-section-' + s.id).open) { if (!page.open.has(s.id)) page.rail = s.id; page.open.add(s.id); } else page.open.delete(s.id); paint(); }; });
  el('tk-warn').value = page.s.warnSeconds || page.lastWarning; el('tk-warncolor').value = page.s.warnColor; el('tk-outcolor').value = page.s.outColor;
  paint(); status('Saved as you change it');
}

// ---- the lane controls ----
// o: { tokens (the token clocks; or a function that gives the current ones, for a screen that follows the race), lanes: [lane numbers (0...)], drivers: [{ id, name }], increments: [minutes], T() (the race clock), phase() (the phase of the race screen),
//      decrements: [minutes] (the buttons that take time off), ops: { add(lane, minutes), reduce(lane, minutes), undo(lane), end(lane), clear(lane), who(lane, driverId), pause() }, label(lane) (the driver now on the lane) }
// Built once; update() only changes what changed, so a button never moves under a finger.
const TokenPanel = (() => {
  const STATE_TEXT = { idle: 'No time', running: 'Running', warning: 'Almost up', out: "Time's up" };
  const ADD_GUARD = 600; // ms: a second press on the plus buttons (or on the minus buttons) of a lane this soon after the first is taken for a slip of the finger and ignored
  function build(box, o) {
    const getK = () => (typeof o.tokens === 'function' ? o.tokens() : o.tokens), clock = o.now || Date.now, lastAdd = {}, lastSub = {}, dec = o.decrements || [];
    box.hidden = false;
    box.innerHTML = `<div class="tkhead"><strong>Time tokens</strong><span class="muted">Add time to a lane to switch it on. The lane turns red when its time is up.</span><span class="tkgrow"></span>
        <button class="btn" data-tk="pause">Pause all</button></div>
      <div class="wrap"><table class="fields tktable"><thead><tr><th>Lane</th><th>Driver</th><th>Time left</th><th>${dec.length ? 'Add or take off time' : 'Add time'}</th><th></th></tr></thead><tbody>${o.lanes.map(l => `<tr data-lane="${l}">
        <td><strong>${l + 1}</strong></td>
        <td><select data-tk="who" aria-label="Driver on lane ${l + 1}"><option value="">Guest</option>${o.drivers.map(d => `<option value="${esc(d.id)}">${esc(d.name)}</option>`).join('')}</select></td>
        <td class="tkcell"><span class="tkclock" data-tk="clock">00:00</span> <span class="tkstate" data-tk="state">No time</span></td>
        <td><div class="tkbtns">${o.increments.map(m => `<button class="btn" data-tk="add" data-min="${m}">${esc(Tokens.incLabel(m))}</button>`).join('')}</div>${dec.length ? `<div class="tkbtns tkminus">${dec.map(m => `<button class="btn" data-tk="sub" data-min="${m}" aria-label="Take ${m} minutes off lane ${l + 1}">${esc(Tokens.decLabel(m))}</button>`).join('')}</div>` : ''}</td>
        <td><div class="tkbtns"><button class="btn" data-tk="undo" title="Take back the last time added (or End time now)">Undo</button><button class="btn danger" data-tk="end" title="The time is up right now">End time now</button><button class="btn" data-tk="clear" title="Switch the lane off (neutral) for the next driver">Clear</button></div></td></tr>`).join('')}</tbody></table></div>`;
    const row = l => box.querySelector(`tr[data-lane="${l}"]`);
    box.onclick = ev => {
      const b = ev.target.closest && ev.target.closest('button[data-tk]'); if (!b || b.disabled) return;
      if (b.blur) b.blur();
      const tr = b.closest('tr'), lane = tr ? Number(tr.dataset.lane) : null, k = b.dataset.tk;
      if (k === 'pause') return o.ops.pause();
      if (k === 'add') { const t = clock(); if (lastAdd[lane] !== undefined && t - lastAdd[lane] < ADD_GUARD) return; lastAdd[lane] = t; return o.ops.add(lane, Number(b.dataset.min)); }
      if (k === 'sub') { const t = clock(); if (lastSub[lane] !== undefined && t - lastSub[lane] < ADD_GUARD) return; lastSub[lane] = t; return o.ops.reduce(lane, Number(b.dataset.min)); }
      if (k === 'undo') return o.ops.undo(lane);
      if (k === 'end') return o.ops.end(lane);
      if (k === 'clear') return o.ops.clear(lane);
    };
    box.onchange = ev => { const s = ev.target; if (s && s.dataset && s.dataset.tk === 'who') { const tr = s.closest('tr'); o.ops.who(Number(tr.dataset.lane), s.value); } };
    const set = (el, text) => { if (el && el.textContent !== text) el.textContent = text; };
    function update() {
      const K = getK(); if (!K) return;
      const T = o.T(), ph = o.phase(), open = ph === 'ready' || ph === 'running' || ph === 'paused' || ph === 'countdown' || ph === 'between';
      o.lanes.forEach(l => {
        const tr = row(l); if (!tr) return;
        const st = K.stateOf(l, T), q = s => tr.querySelector(`[data-tk="${s}"]`);
        const cls = 'tk-' + st; if (tr.className !== cls) tr.className = cls;
        set(q('clock'), Tokens.clockText(K.left(l, T))); set(q('state'), STATE_TEXT[st]);
        const sc = q('state'), color = st === 'warning' ? K.warnColor : st === 'out' ? K.outColor : '';
        if (sc.dataset.c !== color) { sc.dataset.c = color; sc.style.background = color; sc.style.color = color ? Tokens.onColor(color) : ''; }
        tr.querySelectorAll('[data-tk="add"]').forEach(b => { b.disabled = !open; });
        tr.querySelectorAll('[data-tk="sub"]').forEach(b => { b.disabled = !open || !(st === 'running' || st === 'warning'); }); // (only a lane that is on has time to take off)
        q('undo').disabled = !open || !K.canUndo(l, T); q('end').disabled = !open || st === 'idle' || st === 'out'; q('clear').disabled = !open || st === 'idle';
        const sel = q('who'), want = o.label(l) || '';
        if (document.activeElement !== sel && sel.value !== want) sel.value = want;
        sel.disabled = !open;
      });
      const p = box.querySelector('[data-tk="pause"]'); if (p) { set(p, ph === 'paused' ? 'Resume all' : 'Pause all'); p.disabled = !(ph === 'running' || ph === 'paused'); }
    }
    return { update };
  }
  return { build };
})();
