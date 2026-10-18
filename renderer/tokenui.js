// Time Tokens on screen: the settings page (Race Setup > Time Tokens) and the controls for the lanes (race screen).
// The logic is in tokens.js; this file only draws and passes on what is pressed.
// Settings kept: tokenIncrements ("5, 10, 15, 30, 60"), tokenWarnSeconds, tokenWarnColor, tokenOutColor.

const TOKEN_DEFAULT_SETTINGS = { tokenIncrements: '1, 5, 10, 15, 30, 60', tokenDecrements: '1, 5, 10', tokenWarnSeconds: 60, tokenWarnColor: Tokens.DEFAULTS.warnColor, tokenOutColor: Tokens.DEFAULTS.outColor };

// ---- the settings page ----
async function renderTokenSettings(box) {
  const S = Tokens.settingsOf(state.settings), incText = S.increments.join(', '), decText = S.decrements.join(', ');
  const chip = (cls, bg, text, label) => `<div class="tkchip ${cls}" style="${bg ? `background:${bg};color:${Tokens.onColor(bg)}` : ''}"><span class="tkchip-t">${text}</span><span class="tkchip-l">${label}</span></div>`;
  box.innerHTML = `<section class="card tkset">
      <h3>Time buttons</h3>
      <div class="field"><label for="tk-inc">Minutes you can add to a lane (separated by commas, up to 8)</label><input id="tk-inc" value="${esc(incText)}" inputmode="decimal" autocomplete="off"><span class="muted hint" id="tk-inc-note">Each one becomes a button on the race screen.</span></div>
      <div class="tkbtns" id="tk-preview">${S.increments.map(m => `<button class="btn" type="button" disabled>${esc(Tokens.incLabel(m))}</button>`).join('')}</div>
      <div class="field"><label for="tk-dec">Minutes you can take off a lane (separated by commas, up to 8; empty for no such buttons)</label><input id="tk-dec" value="${esc(decText)}" inputmode="decimal" autocomplete="off"><span class="muted hint" id="tk-dec-note">For a mistake or a refund: the time bought goes down too, and Undo gives it back. Only a lane that is on can have time taken off.</span></div>
      <div class="tkbtns" id="tk-dpreview">${S.decrements.map(m => `<button class="btn" type="button" disabled>${esc(Tokens.decLabel(m))}</button>`).join('') || '<span class="muted">No minus buttons</span>'}</div>
    </section>
    <section class="card tkset">
      <h3>Warning and time's up</h3>
      <div class="field"><label for="tk-warn">Warning: seconds before the end that the Token Clock turns to the warning colour (0 for no warning)</label><input id="tk-warn" type="number" min="0" max="3600" step="1" value="${S.warnSeconds}"></div>
      <div class="inline tkcolors"><label class="inline">Warning colour <input type="color" id="tk-warncolor" value="${esc(S.warnColor)}" aria-label="Warning colour"></label>
        <label class="inline">Time's-up colour <input type="color" id="tk-outcolor" value="${esc(S.outColor)}" aria-label="Time's-up colour"></label></div>
      <p class="muted hint">When the time of a lane is up, every widget of that lane on the timing pages turns the time's-up colour, whatever colour it had. The warning colour is only used by the Token Clock.</p>
      <div class="tkchips" id="tk-chips" aria-label="How a lane looks">${chip('', '', '12:34', 'Running')}${chip('', S.warnColor, '00:45', 'Almost up')}${chip('', S.outColor, '00:00', "Time's up")}</div>
      <div class="row"><button class="btn" id="tk-reset">Back to the standard settings</button> <span class="muted" id="tk-msg" role="status"></span></div>
    </section>
    <p class="muted">To use these: add a race setup with the session type Time Token Session. On the race screen you add time to a lane with the buttons; the Token Clock widget (and the default token layout) shows what is left.</p>`;
  const msg = t => { const m = document.getElementById('tk-msg'); if (m) m.textContent = t; };
  const save = async patch => { state.settings = await api.setSettings(patch); renderTokenSettings(box); };
  document.getElementById('tk-inc').onchange = ev => {
    const raw = ev.target.value, list = Tokens.parseIncrements(raw), typed = ListNum.items(raw).filter(x => x.trim() !== '');
    save({ tokenIncrements: list.join(', ') }).then(() => { const n = document.getElementById('tk-inc-note'); if (n) n.textContent = !typed.length || list.length < typed.length ? 'Some of that was not a usable number of minutes (or was there twice, or more than 8), so it was left out.' : 'Saved.'; });
  };
  document.getElementById('tk-dec').onchange = ev => {
    const raw = ev.target.value, list = Tokens.parseDecrements(String(raw)), typed = ListNum.items(raw).filter(x => x.trim() !== '');
    save({ tokenDecrements: list.join(', ') }).then(() => { const n = document.getElementById('tk-dec-note'); if (n) n.textContent = list.length < typed.length ? 'Some of that was not a usable number of minutes (or was there twice, or more than 8), so it was left out.' : 'Saved.'; });
  };
  document.getElementById('tk-warn').onchange = ev => save({ tokenWarnSeconds: Tokens.settingsOf({ tokenWarnSeconds: ev.target.value }).warnSeconds });
  document.getElementById('tk-warncolor').onchange = ev => save({ tokenWarnColor: ev.target.value });
  document.getElementById('tk-outcolor').onchange = ev => save({ tokenOutColor: ev.target.value });
  document.getElementById('tk-reset').onclick = async () => { state.settings = await api.setSettings({ ...TOKEN_DEFAULT_SETTINGS }); await renderTokenSettings(box); msg('Back to the standard settings.'); };
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
